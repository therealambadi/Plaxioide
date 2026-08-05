import { onUnexpectedError } from "../common/errors.js";
import { Event } from "../common/event.js";
import { escapeDoubleQuotes, isMarkdownString, parseHrefAndDimensions, removeMarkdownEscapes } from "../common/htmlContent.js";
import { markdownEscapeEscapedIcons } from "../common/iconLabels.js";
import { defaultGenerator } from "../common/idGenerator.js";
import { KeyCode } from "../common/keyCodes.js";
import { Lazy } from "../common/lazy.js";
import { DisposableStore, toDisposable } from "../common/lifecycle.js";
import * as marked from "../common/marked/marked.js";
import { parse } from "../common/marshalling.js";
import { FileAccess, Schemas } from "../common/network.js";
import { cloneAndChange } from "../common/objects.js";
import { dirname, resolvePath } from "../common/resources.js";
import { escape } from "../common/strings.js";
import { URI } from "../common/uri.js";
import * as DOM from "./dom.js";
import dompurify from "./dompurify/dompurify.js";
import { DomEmitter } from "./event.js";
import { createElement } from "./formattedTextRenderer.js";
import { StandardKeyboardEvent } from "./keyboardEvent.js";
import { StandardMouseEvent } from "./mouseEvent.js";
import { renderLabelWithIcons } from "./ui/iconLabel/iconLabels.js";
const defaultMarkedRenderers = Object.freeze({
  image: ({ href, title, text }) => {
    let dimensions = [];
    let attributes = [];
    if (href) {
      ({ href, dimensions } = parseHrefAndDimensions(href));
      attributes.push(`src="${escapeDoubleQuotes(href)}"`);
    }
    if (text) {
      attributes.push(`alt="${escapeDoubleQuotes(text)}"`);
    }
    if (title) {
      attributes.push(`title="${escapeDoubleQuotes(title)}"`);
    }
    if (dimensions.length) {
      attributes = attributes.concat(dimensions);
    }
    return "<img " + attributes.join(" ") + ">";
  },
  paragraph({ tokens }) {
    return `<p>${this.parser.parseInline(tokens)}</p>`;
  },
  link({ href, title, tokens }) {
    let text = this.parser.parseInline(tokens);
    if (typeof href !== "string") {
      return "";
    }
    if (href === text) {
      text = removeMarkdownEscapes(text);
    }
    title = typeof title === "string" ? escapeDoubleQuotes(removeMarkdownEscapes(title)) : "";
    href = removeMarkdownEscapes(href);
    href = href.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    return `<a href="${href}" title="${title || href}" draggable="false">${text}</a>`;
  }
});
function renderMarkdown(markdown, options = {}, markedOptions = {}) {
  const disposables = new DisposableStore();
  let isDisposed = false;
  const element = createElement(options);
  const { renderer, codeBlocks, syncCodeBlocks } = createMarkdownRenderer(options, markdown);
  const value = preprocessMarkdownString(markdown);
  let renderedMarkdown;
  if (options.fillInIncompleteTokens) {
    const opts = {
      ...marked.defaults,
      ...markedOptions,
      renderer
    };
    const tokens = marked.lexer(value, opts);
    const newTokens = fillInIncompleteTokens(tokens);
    renderedMarkdown = marked.parser(newTokens, opts);
  } else {
    renderedMarkdown = marked.parse(value, { ...markedOptions, renderer, async: false });
  }
  if (markdown.supportThemeIcons) {
    const elements = renderLabelWithIcons(renderedMarkdown);
    renderedMarkdown = elements.map((e) => typeof e === "string" ? e : e.outerHTML).join("");
  }
  const htmlParser = new DOMParser();
  const markdownHtmlDoc = htmlParser.parseFromString(sanitizeRenderedMarkdown({ isTrusted: markdown.isTrusted, ...options.sanitizerOptions }, renderedMarkdown), "text/html");
  rewriteRenderedLinks(markdown, options, markdownHtmlDoc.body);
  element.innerHTML = sanitizeRenderedMarkdown({ isTrusted: markdown.isTrusted, ...options.sanitizerOptions }, markdownHtmlDoc.body.innerHTML);
  if (codeBlocks.length > 0) {
    Promise.all(codeBlocks).then((tuples) => {
      if (isDisposed) {
        return;
      }
      const renderedElements = new Map(tuples);
      const placeholderElements = element.querySelectorAll(`div[data-code]`);
      for (const placeholderElement of placeholderElements) {
        const renderedElement = renderedElements.get(placeholderElement.dataset["code"] ?? "");
        if (renderedElement) {
          DOM.reset(placeholderElement, renderedElement);
        }
      }
      options.asyncRenderCallback?.();
    });
  } else if (syncCodeBlocks.length > 0) {
    const renderedElements = new Map(syncCodeBlocks);
    const placeholderElements = element.querySelectorAll(`div[data-code]`);
    for (const placeholderElement of placeholderElements) {
      const renderedElement = renderedElements.get(placeholderElement.dataset["code"] ?? "");
      if (renderedElement) {
        DOM.reset(placeholderElement, renderedElement);
      }
    }
  }
  if (options.asyncRenderCallback) {
    for (const img of element.getElementsByTagName("img")) {
      const listener = disposables.add(DOM.addDisposableListener(img, "load", () => {
        listener.dispose();
        options.asyncRenderCallback();
      }));
    }
  }
  if (options.actionHandler) {
    const onClick = options.actionHandler.disposables.add(new DomEmitter(element, "click"));
    const onAuxClick = options.actionHandler.disposables.add(new DomEmitter(element, "auxclick"));
    options.actionHandler.disposables.add(Event.any(onClick.event, onAuxClick.event)((e) => {
      const mouseEvent = new StandardMouseEvent(DOM.getWindow(element), e);
      if (!mouseEvent.leftButton && !mouseEvent.middleButton) {
        return;
      }
      activateLink(markdown, options, mouseEvent);
    }));
    options.actionHandler.disposables.add(DOM.addDisposableListener(element, "keydown", (e) => {
      const keyboardEvent = new StandardKeyboardEvent(e);
      if (!keyboardEvent.equals(KeyCode.Space) && !keyboardEvent.equals(KeyCode.Enter)) {
        return;
      }
      activateLink(markdown, options, keyboardEvent);
    }));
  }
  return {
    element,
    dispose: () => {
      isDisposed = true;
      disposables.dispose();
    }
  };
}
function rewriteRenderedLinks(markdown, options, root) {
  for (const el of root.querySelectorAll("img, audio, video, source")) {
    const src = el.getAttribute("src");
    if (src) {
      let href = src;
      try {
        if (markdown.baseUri) {
          href = resolveWithBaseUri(URI.from(markdown.baseUri), href);
        }
      } catch (err) {
      }
      el.setAttribute("src", massageHref(markdown, href, true));
      if (options.remoteImageIsAllowed) {
        const uri = URI.parse(href);
        if (uri.scheme !== Schemas.file && uri.scheme !== Schemas.data && !options.remoteImageIsAllowed(uri)) {
          el.replaceWith(DOM.$("", void 0, el.outerHTML));
        }
      }
    }
  }
  for (const el of root.querySelectorAll("a")) {
    const href = el.getAttribute("href");
    el.setAttribute("href", "");
    if (!href || /^data:|javascript:/i.test(href) || /^command:/i.test(href) && !markdown.isTrusted || /^command:(\/\/\/)?_workbench\.downloadResource/i.test(href)) {
      el.replaceWith(...el.childNodes);
    } else {
      let resolvedHref = massageHref(markdown, href, false);
      if (markdown.baseUri) {
        resolvedHref = resolveWithBaseUri(URI.from(markdown.baseUri), href);
      }
      el.dataset.href = resolvedHref;
    }
  }
}
function createMarkdownRenderer(options, markdown) {
  const renderer = new marked.Renderer();
  renderer.image = defaultMarkedRenderers.image;
  renderer.link = defaultMarkedRenderers.link;
  renderer.paragraph = defaultMarkedRenderers.paragraph;
  const codeBlocks = [];
  const syncCodeBlocks = [];
  if (options.codeBlockRendererSync) {
    renderer.code = ({ text, lang, raw }) => {
      const id = defaultGenerator.nextId();
      const value = options.codeBlockRendererSync(postProcessCodeBlockLanguageId(lang), text, raw);
      syncCodeBlocks.push([id, value]);
      return `<div class="code" data-code="${id}">${escape(text)}</div>`;
    };
  } else if (options.codeBlockRenderer) {
    renderer.code = ({ text, lang }) => {
      const id = defaultGenerator.nextId();
      const value = options.codeBlockRenderer(postProcessCodeBlockLanguageId(lang), text);
      codeBlocks.push(value.then((element) => [id, element]));
      return `<div class="code" data-code="${id}">${escape(text)}</div>`;
    };
  }
  if (!markdown.supportHtml) {
    renderer.html = ({ text }) => {
      if (options.sanitizerOptions?.replaceWithPlaintext) {
        return escape(text);
      }
      const match = markdown.isTrusted ? text.match(/^(<span[^>]+>)|(<\/\s*span>)$/) : void 0;
      return match ? text : "";
    };
  }
  return { renderer, codeBlocks, syncCodeBlocks };
}
function preprocessMarkdownString(markdown) {
  let value = markdown.value;
  if (value.length > 1e5) {
    value = `${value.substr(0, 1e5)}\u2026`;
  }
  if (markdown.supportThemeIcons) {
    value = markdownEscapeEscapedIcons(value);
  }
  return value;
}
function activateLink(markdown, options, event) {
  const target = event.target.closest("a[data-href]");
  if (!DOM.isHTMLElement(target)) {
    return;
  }
  try {
    let href = target.dataset["href"];
    if (href) {
      if (markdown.baseUri) {
        href = resolveWithBaseUri(URI.from(markdown.baseUri), href);
      }
      options.actionHandler.callback(href, event);
    }
  } catch (err) {
    onUnexpectedError(err);
  } finally {
    event.preventDefault();
  }
}
function uriMassage(markdown, part) {
  let data;
  try {
    data = parse(decodeURIComponent(part));
  } catch (e) {
  }
  if (!data) {
    return part;
  }
  data = cloneAndChange(data, (value) => {
    if (markdown.uris && markdown.uris[value]) {
      return URI.revive(markdown.uris[value]);
    } else {
      return void 0;
    }
  });
  return encodeURIComponent(JSON.stringify(data));
}
function massageHref(markdown, href, isDomUri) {
  const data = markdown.uris && markdown.uris[href];
  let uri = URI.revive(data);
  if (isDomUri) {
    if (href.startsWith(Schemas.data + ":")) {
      return href;
    }
    if (!uri) {
      uri = URI.parse(href);
    }
    return FileAccess.uriToBrowserUri(uri).toString(true);
  }
  if (!uri) {
    return href;
  }
  if (URI.parse(href).toString() === uri.toString()) {
    return href;
  }
  if (uri.query) {
    uri = uri.with({ query: uriMassage(markdown, uri.query) });
  }
  return uri.toString();
}
function postProcessCodeBlockLanguageId(lang) {
  if (!lang) {
    return "";
  }
  const parts = lang.split(/[\s+|:|,|\{|\?]/, 1);
  if (parts.length) {
    return parts[0];
  }
  return lang;
}
function resolveWithBaseUri(baseUri, href) {
  const hasScheme = /^\w[\w\d+.-]*:/.test(href);
  if (hasScheme) {
    return href;
  }
  if (baseUri.path.endsWith("/")) {
    return resolvePath(baseUri, href).toString();
  } else {
    return resolvePath(dirname(baseUri), href).toString();
  }
}
const selfClosingTags = ["area", "base", "br", "col", "command", "embed", "hr", "img", "input", "keygen", "link", "meta", "param", "source", "track", "wbr"];
function sanitizeRenderedMarkdown(options, renderedMarkdown) {
  const { config, allowedSchemes } = getSanitizerOptions(options);
  const store = new DisposableStore();
  store.add(addDompurifyHook("uponSanitizeAttribute", (element, e) => {
    if (e.attrName === "style" || e.attrName === "class") {
      if (element.tagName === "SPAN") {
        if (e.attrName === "style") {
          e.keepAttr = /^(color\:(#[0-9a-fA-F]+|var\(--vscode(-[a-zA-Z0-9]+)+\));)?(background-color\:(#[0-9a-fA-F]+|var\(--vscode(-[a-zA-Z0-9]+)+\));)?(border-radius:[0-9]+px;)?$/.test(e.attrValue);
          return;
        } else if (e.attrName === "class") {
          e.keepAttr = /^codicon codicon-[a-z\-]+( codicon-modifier-[a-z\-]+)?$/.test(e.attrValue);
          return;
        }
      }
      e.keepAttr = false;
      return;
    } else if (element.tagName === "INPUT" && element.attributes.getNamedItem("type")?.value === "checkbox") {
      if (e.attrName === "type" && e.attrValue === "checkbox" || e.attrName === "disabled" || e.attrName === "checked") {
        e.keepAttr = true;
        return;
      }
      e.keepAttr = false;
    }
  }));
  store.add(addDompurifyHook("uponSanitizeElement", (element, e) => {
    if (e.tagName === "input") {
      if (element.attributes.getNamedItem("type")?.value === "checkbox") {
        element.setAttribute("disabled", "");
      } else if (!options.replaceWithPlaintext) {
        element.remove();
      }
    }
    if (options.replaceWithPlaintext && !e.allowedTags[e.tagName] && e.tagName !== "body") {
      if (element.parentElement) {
        let startTagText;
        let endTagText;
        if (e.tagName === "#comment") {
          startTagText = `<!--${element.textContent}-->`;
        } else {
          const isSelfClosing = selfClosingTags.includes(e.tagName);
          const attrString = element.attributes.length ? " " + Array.from(element.attributes).map((attr) => `${attr.name}="${attr.value}"`).join(" ") : "";
          startTagText = `<${e.tagName}${attrString}>`;
          if (!isSelfClosing) {
            endTagText = `</${e.tagName}>`;
          }
        }
        const fragment = document.createDocumentFragment();
        const textNode = element.parentElement.ownerDocument.createTextNode(startTagText);
        fragment.appendChild(textNode);
        const endTagTextNode = endTagText ? element.parentElement.ownerDocument.createTextNode(endTagText) : void 0;
        while (element.firstChild) {
          fragment.appendChild(element.firstChild);
        }
        if (endTagTextNode) {
          fragment.appendChild(endTagTextNode);
        }
        if (element.nodeType === Node.COMMENT_NODE) {
          element.parentElement.insertBefore(fragment, element);
        } else {
          element.parentElement.replaceChild(fragment, element);
        }
      }
    }
  }));
  store.add(DOM.hookDomPurifyHrefAndSrcSanitizer(allowedSchemes));
  try {
    return dompurify.sanitize(renderedMarkdown, { ...config, RETURN_TRUSTED_TYPE: true });
  } finally {
    store.dispose();
  }
}
const allowedMarkdownAttr = [
  "align",
  "autoplay",
  "alt",
  "checked",
  "class",
  "colspan",
  "controls",
  "data-code",
  "data-href",
  "disabled",
  "draggable",
  "height",
  "href",
  "loop",
  "muted",
  "playsinline",
  "poster",
  "rowspan",
  "src",
  "style",
  "target",
  "title",
  "type",
  "width",
  "start"
];
function getSanitizerOptions(options) {
  const allowedSchemes = [
    Schemas.http,
    Schemas.https,
    Schemas.mailto,
    Schemas.data,
    Schemas.file,
    Schemas.vscodeFileResource,
    Schemas.vscodeRemote,
    Schemas.vscodeRemoteResource
  ];
  if (options.isTrusted) {
    allowedSchemes.push(Schemas.command);
  }
  return {
    config: {
      // allowedTags should included everything that markdown renders to.
      // Since we have our own sanitize function for marked, it's possible we missed some tag so let dompurify make sure.
      // HTML tags that can result from markdown are from reading https://spec.commonmark.org/0.29/
      // HTML table tags that can result from markdown are from https://github.github.com/gfm/#tables-extension-
      ALLOWED_TAGS: options.allowedTags ?? [...DOM.basicMarkupHtmlTags],
      ALLOWED_ATTR: allowedMarkdownAttr,
      ALLOW_UNKNOWN_PROTOCOLS: true
    },
    allowedSchemes
  };
}
function renderStringAsPlaintext(string) {
  return isMarkdownString(string) ? renderMarkdownAsPlaintext(string) : string;
}
function renderMarkdownAsPlaintext(markdown, withCodeBlocks) {
  let value = markdown.value ?? "";
  if (value.length > 1e5) {
    value = `${value.substr(0, 1e5)}\u2026`;
  }
  const html = marked.parse(value, { async: false, renderer: withCodeBlocks ? plainTextWithCodeBlocksRenderer.value : plainTextRenderer.value });
  return sanitizeRenderedMarkdown({ isTrusted: false }, html).toString().replace(/&(#\d+|[a-zA-Z]+);/g, (m) => unescapeInfo.get(m) ?? m).trim();
}
const unescapeInfo = /* @__PURE__ */ new Map([
  ["&quot;", '"'],
  ["&nbsp;", " "],
  ["&amp;", "&"],
  ["&#39;", "'"],
  ["&lt;", "<"],
  ["&gt;", ">"]
]);
function createPlainTextRenderer() {
  const renderer = new marked.Renderer();
  renderer.code = ({ text }) => {
    return escape(text);
  };
  renderer.blockquote = ({ text }) => {
    return text + "\n";
  };
  renderer.html = (_) => {
    return "";
  };
  renderer.heading = function({ tokens }) {
    return this.parser.parseInline(tokens) + "\n";
  };
  renderer.hr = () => {
    return "";
  };
  renderer.list = function({ items }) {
    return items.map((x) => this.listitem(x)).join("\n") + "\n";
  };
  renderer.listitem = ({ text }) => {
    return text + "\n";
  };
  renderer.paragraph = function({ tokens }) {
    return this.parser.parseInline(tokens) + "\n";
  };
  renderer.table = function({ header, rows }) {
    return header.map((cell) => this.tablecell(cell)).join(" ") + "\n" + rows.map((cells) => cells.map((cell) => this.tablecell(cell)).join(" ")).join("\n") + "\n";
  };
  renderer.tablerow = ({ text }) => {
    return text;
  };
  renderer.tablecell = function({ tokens }) {
    return this.parser.parseInline(tokens);
  };
  renderer.strong = ({ text }) => {
    return text;
  };
  renderer.em = ({ text }) => {
    return text;
  };
  renderer.codespan = ({ text }) => {
    return escape(text);
  };
  renderer.br = (_) => {
    return "\n";
  };
  renderer.del = ({ text }) => {
    return text;
  };
  renderer.image = (_) => {
    return "";
  };
  renderer.text = ({ text }) => {
    return text;
  };
  renderer.link = ({ text }) => {
    return text;
  };
  return renderer;
}
const plainTextRenderer = new Lazy(createPlainTextRenderer);
const plainTextWithCodeBlocksRenderer = new Lazy(() => {
  const renderer = createPlainTextRenderer();
  renderer.code = ({ text }) => {
    return `
\`\`\`
${escape(text)}
\`\`\`
`;
  };
  return renderer;
});
function mergeRawTokenText(tokens) {
  let mergedTokenText = "";
  tokens.forEach((token) => {
    mergedTokenText += token.raw;
  });
  return mergedTokenText;
}
function completeSingleLinePattern(token) {
  if (!token.tokens) {
    return void 0;
  }
  for (let i = token.tokens.length - 1; i >= 0; i--) {
    const subtoken = token.tokens[i];
    if (subtoken.type === "text") {
      const lines = subtoken.raw.split("\n");
      const lastLine = lines[lines.length - 1];
      if (lastLine.includes("`")) {
        return completeCodespan(token);
      } else if (lastLine.includes("**")) {
        return completeDoublestar(token);
      } else if (lastLine.match(/\*\w/)) {
        return completeStar(token);
      } else if (lastLine.match(/(^|\s)__\w/)) {
        return completeDoubleUnderscore(token);
      } else if (lastLine.match(/(^|\s)_\w/)) {
        return completeUnderscore(token);
      } else if (
        // Text with start of link target
        hasLinkTextAndStartOfLinkTarget(lastLine) || // This token doesn't have the link text, eg if it contains other markdown constructs that are in other subtokens.
        // But some preceding token does have an unbalanced [ at least
        hasStartOfLinkTargetAndNoLinkText(lastLine) && token.tokens.slice(0, i).some((t) => t.type === "text" && t.raw.match(/\[[^\]]*$/))
      ) {
        const nextTwoSubTokens = token.tokens.slice(i + 1);
        if (
          // If the link was parsed as a link, then look for a link token and a text token with a quote
          nextTwoSubTokens[0]?.type === "link" && nextTwoSubTokens[1]?.type === "text" && nextTwoSubTokens[1].raw.match(/^ *"[^"]*$/) || // And if the link was not parsed as a link (eg command link), just look for a single quote in this token
          lastLine.match(/^[^"]* +"[^"]*$/)
        ) {
          return completeLinkTargetArg(token);
        }
        return completeLinkTarget(token);
      } else if (lastLine.match(/(^|\s)\[\w*/)) {
        return completeLinkText(token);
      }
    }
  }
  return void 0;
}
function hasLinkTextAndStartOfLinkTarget(str) {
  return !!str.match(/(^|\s)\[.*\]\(\w*/);
}
function hasStartOfLinkTargetAndNoLinkText(str) {
  return !!str.match(/^[^\[]*\]\([^\)]*$/);
}
function completeListItemPattern(list) {
  const lastListItem = list.items[list.items.length - 1];
  const lastListSubToken = lastListItem.tokens ? lastListItem.tokens[lastListItem.tokens.length - 1] : void 0;
  const listEndsInHeading = (list2) => {
    const lastItem = list2.items.at(-1);
    const lastToken = lastItem?.tokens.at(-1);
    return lastToken?.type === "heading" || lastToken?.type === "list" && listEndsInHeading(lastToken);
  };
  let newToken;
  if (lastListSubToken?.type === "text" && !("inRawBlock" in lastListItem)) {
    newToken = completeSingleLinePattern(lastListSubToken);
  } else if (listEndsInHeading(list)) {
    const newList2 = marked.lexer(list.raw.trim() + " &nbsp;")[0];
    if (newList2.type !== "list") {
      return;
    }
    return newList2;
  }
  if (!newToken || newToken.type !== "paragraph") {
    return;
  }
  const previousListItemsText = mergeRawTokenText(list.items.slice(0, -1));
  const lastListItemLead = lastListItem.raw.match(/^(\s*(-|\d+\.|\*) +)/)?.[0];
  if (!lastListItemLead) {
    return;
  }
  const newListItemText = lastListItemLead + mergeRawTokenText(lastListItem.tokens.slice(0, -1)) + newToken.raw;
  const newList = marked.lexer(previousListItemsText + newListItemText)[0];
  if (newList.type !== "list") {
    return;
  }
  return newList;
}
const maxIncompleteTokensFixRounds = 3;
function fillInIncompleteTokens(tokens) {
  for (let i = 0; i < maxIncompleteTokensFixRounds; i++) {
    const newTokens = fillInIncompleteTokensOnce(tokens);
    if (newTokens) {
      tokens = newTokens;
    } else {
      break;
    }
  }
  return tokens;
}
function fillInIncompleteTokensOnce(tokens) {
  let i;
  let newTokens;
  for (i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === "paragraph" && token.raw.match(/(\n|^)\|/)) {
      newTokens = completeTable(tokens.slice(i));
      break;
    }
    if (i === tokens.length - 1 && token.type === "list") {
      const newListToken = completeListItemPattern(token);
      if (newListToken) {
        newTokens = [newListToken];
        break;
      }
    }
    if (i === tokens.length - 1 && token.type === "paragraph") {
      const newToken = completeSingleLinePattern(token);
      if (newToken) {
        newTokens = [newToken];
        break;
      }
    }
  }
  if (newTokens) {
    const newTokensList = [
      ...tokens.slice(0, i),
      ...newTokens
    ];
    newTokensList.links = tokens.links;
    return newTokensList;
  }
  return null;
}
function completeCodespan(token) {
  return completeWithString(token, "`");
}
function completeStar(tokens) {
  return completeWithString(tokens, "*");
}
function completeUnderscore(tokens) {
  return completeWithString(tokens, "_");
}
function completeLinkTarget(tokens) {
  return completeWithString(tokens, ")");
}
function completeLinkTargetArg(tokens) {
  return completeWithString(tokens, '")');
}
function completeLinkText(tokens) {
  return completeWithString(tokens, "](https://microsoft.com)");
}
function completeDoublestar(tokens) {
  return completeWithString(tokens, "**");
}
function completeDoubleUnderscore(tokens) {
  return completeWithString(tokens, "__");
}
function completeWithString(tokens, closingString) {
  const mergedRawText = mergeRawTokenText(Array.isArray(tokens) ? tokens : [tokens]);
  return marked.lexer(mergedRawText + closingString)[0];
}
function completeTable(tokens) {
  const mergedRawText = mergeRawTokenText(tokens);
  const lines = mergedRawText.split("\n");
  let numCols;
  let hasSeparatorRow = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (typeof numCols === "undefined" && line.match(/^\s*\|/)) {
      const line1Matches = line.match(/(\|[^\|]+)(?=\||$)/g);
      if (line1Matches) {
        numCols = line1Matches.length;
      }
    } else if (typeof numCols === "number") {
      if (line.match(/^\s*\|/)) {
        if (i !== lines.length - 1) {
          return void 0;
        }
        hasSeparatorRow = true;
      } else {
        return void 0;
      }
    }
  }
  if (typeof numCols === "number" && numCols > 0) {
    const prefixText = hasSeparatorRow ? lines.slice(0, -1).join("\n") : mergedRawText;
    const line1EndsInPipe = !!prefixText.match(/\|\s*$/);
    const newRawText = prefixText + (line1EndsInPipe ? "" : "|") + `
|${" --- |".repeat(numCols)}`;
    return marked.lexer(newRawText);
  }
  return void 0;
}
function addDompurifyHook(hook, cb) {
  dompurify.addHook(hook, cb);
  return toDisposable(() => dompurify.removeHook(hook));
}
export {
  allowedMarkdownAttr,
  fillInIncompleteTokens,
  renderMarkdown,
  renderMarkdownAsPlaintext,
  renderStringAsPlaintext
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBlc2NhcGVEb3VibGVRdW90ZXMsIElNYXJrZG93blN0cmluZywgaXNNYXJrZG93blN0cmluZywgTWFya2Rvd25TdHJpbmdUcnVzdGVkT3B0aW9ucywgcGFyc2VIcmVmQW5kRGltZW5zaW9ucywgcmVtb3ZlTWFya2Rvd25Fc2NhcGVzIH0gZnJvbSAnLi4vY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IG1hcmtkb3duRXNjYXBlRXNjYXBlZEljb25zIH0gZnJvbSAnLi4vY29tbW9uL2ljb25MYWJlbHMuanMnO1xuaW1wb3J0IHsgZGVmYXVsdEdlbmVyYXRvciB9IGZyb20gJy4uL2NvbW1vbi9pZEdlbmVyYXRvci5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlIH0gZnJvbSAnLi4vY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IExhenkgfSBmcm9tICcuLi9jb21tb24vbGF6eS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIG1hcmtlZCBmcm9tICcuLi9jb21tb24vbWFya2VkL21hcmtlZC5qcyc7XG5pbXBvcnQgeyBwYXJzZSB9IGZyb20gJy4uL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBGaWxlQWNjZXNzLCBTY2hlbWFzIH0gZnJvbSAnLi4vY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgY2xvbmVBbmRDaGFuZ2UgfSBmcm9tICcuLi9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBkaXJuYW1lLCByZXNvbHZlUGF0aCB9IGZyb20gJy4uL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgZXNjYXBlIH0gZnJvbSAnLi4vY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgKiBhcyBET00gZnJvbSAnLi9kb20uanMnO1xuaW1wb3J0IGRvbXB1cmlmeSBmcm9tICcuL2RvbXB1cmlmeS9kb21wdXJpZnkuanMnO1xuaW1wb3J0IHsgRG9tRW1pdHRlciB9IGZyb20gJy4vZXZlbnQuanMnO1xuaW1wb3J0IHsgY3JlYXRlRWxlbWVudCwgRm9ybWF0dGVkVGV4dFJlbmRlck9wdGlvbnMgfSBmcm9tICcuL2Zvcm1hdHRlZFRleHRSZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNb3VzZUV2ZW50IH0gZnJvbSAnLi9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IHJlbmRlckxhYmVsV2l0aEljb25zIH0gZnJvbSAnLi91aS9pY29uTGFiZWwvaWNvbkxhYmVscy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWFya2VkT3B0aW9ucyBleHRlbmRzIG1hcmtlZC5NYXJrZWRPcHRpb25zIHtcblx0YmFzZVVybD86IG5ldmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE1hcmtkb3duUmVuZGVyT3B0aW9ucyBleHRlbmRzIEZvcm1hdHRlZFRleHRSZW5kZXJPcHRpb25zIHtcblx0cmVhZG9ubHkgY29kZUJsb2NrUmVuZGVyZXI/OiAobGFuZ3VhZ2VJZDogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKSA9PiBQcm9taXNlPEhUTUxFbGVtZW50Pjtcblx0cmVhZG9ubHkgY29kZUJsb2NrUmVuZGVyZXJTeW5jPzogKGxhbmd1YWdlSWQ6IHN0cmluZywgdmFsdWU6IHN0cmluZywgcmF3Pzogc3RyaW5nKSA9PiBIVE1MRWxlbWVudDtcblx0cmVhZG9ubHkgYXN5bmNSZW5kZXJDYWxsYmFjaz86ICgpID0+IHZvaWQ7XG5cdHJlYWRvbmx5IGZpbGxJbkluY29tcGxldGVUb2tlbnM/OiBib29sZWFuO1xuXHRyZWFkb25seSByZW1vdGVJbWFnZUlzQWxsb3dlZD86ICh1cmk6IFVSSSkgPT4gYm9vbGVhbjtcblx0cmVhZG9ubHkgc2FuaXRpemVyT3B0aW9ucz86IElTYW5pdGl6ZXJPcHRpb25zO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTYW5pdGl6ZXJPcHRpb25zIHtcblx0cmVwbGFjZVdpdGhQbGFpbnRleHQ/OiBib29sZWFuO1xuXHRhbGxvd2VkVGFncz86IHN0cmluZ1tdO1xufVxuXG5jb25zdCBkZWZhdWx0TWFya2VkUmVuZGVyZXJzID0gT2JqZWN0LmZyZWV6ZSh7XG5cdGltYWdlOiAoeyBocmVmLCB0aXRsZSwgdGV4dCB9OiBtYXJrZWQuVG9rZW5zLkltYWdlKTogc3RyaW5nID0+IHtcblx0XHRsZXQgZGltZW5zaW9uczogc3RyaW5nW10gPSBbXTtcblx0XHRsZXQgYXR0cmlidXRlczogc3RyaW5nW10gPSBbXTtcblx0XHRpZiAoaHJlZikge1xuXHRcdFx0KHsgaHJlZiwgZGltZW5zaW9ucyB9ID0gcGFyc2VIcmVmQW5kRGltZW5zaW9ucyhocmVmKSk7XG5cdFx0XHRhdHRyaWJ1dGVzLnB1c2goYHNyYz1cIiR7ZXNjYXBlRG91YmxlUXVvdGVzKGhyZWYpfVwiYCk7XG5cdFx0fVxuXHRcdGlmICh0ZXh0KSB7XG5cdFx0XHRhdHRyaWJ1dGVzLnB1c2goYGFsdD1cIiR7ZXNjYXBlRG91YmxlUXVvdGVzKHRleHQpfVwiYCk7XG5cdFx0fVxuXHRcdGlmICh0aXRsZSkge1xuXHRcdFx0YXR0cmlidXRlcy5wdXNoKGB0aXRsZT1cIiR7ZXNjYXBlRG91YmxlUXVvdGVzKHRpdGxlKX1cImApO1xuXHRcdH1cblx0XHRpZiAoZGltZW5zaW9ucy5sZW5ndGgpIHtcblx0XHRcdGF0dHJpYnV0ZXMgPSBhdHRyaWJ1dGVzLmNvbmNhdChkaW1lbnNpb25zKTtcblx0XHR9XG5cdFx0cmV0dXJuICc8aW1nICcgKyBhdHRyaWJ1dGVzLmpvaW4oJyAnKSArICc+Jztcblx0fSxcblxuXHRwYXJhZ3JhcGgodGhpczogbWFya2VkLlJlbmRlcmVyLCB7IHRva2VucyB9OiBtYXJrZWQuVG9rZW5zLlBhcmFncmFwaCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGA8cD4ke3RoaXMucGFyc2VyLnBhcnNlSW5saW5lKHRva2Vucyl9PC9wPmA7XG5cdH0sXG5cblx0bGluayh0aGlzOiBtYXJrZWQuUmVuZGVyZXIsIHsgaHJlZiwgdGl0bGUsIHRva2VucyB9OiBtYXJrZWQuVG9rZW5zLkxpbmspOiBzdHJpbmcge1xuXHRcdGxldCB0ZXh0ID0gdGhpcy5wYXJzZXIucGFyc2VJbmxpbmUodG9rZW5zKTtcblx0XHRpZiAodHlwZW9mIGhyZWYgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXG5cdFx0Ly8gUmVtb3ZlIG1hcmtkb3duIGVzY2FwZXMuIFdvcmthcm91bmQgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9jaGpqL21hcmtlZC9pc3N1ZXMvODI5XG5cdFx0aWYgKGhyZWYgPT09IHRleHQpIHsgLy8gcmF3IGxpbmsgY2FzZVxuXHRcdFx0dGV4dCA9IHJlbW92ZU1hcmtkb3duRXNjYXBlcyh0ZXh0KTtcblx0XHR9XG5cblx0XHR0aXRsZSA9IHR5cGVvZiB0aXRsZSA9PT0gJ3N0cmluZycgPyBlc2NhcGVEb3VibGVRdW90ZXMocmVtb3ZlTWFya2Rvd25Fc2NhcGVzKHRpdGxlKSkgOiAnJztcblx0XHRocmVmID0gcmVtb3ZlTWFya2Rvd25Fc2NhcGVzKGhyZWYpO1xuXG5cdFx0Ly8gSFRNTCBFbmNvZGUgaHJlZlxuXHRcdGhyZWYgPSBocmVmLnJlcGxhY2UoLyYvZywgJyZhbXA7Jylcblx0XHRcdC5yZXBsYWNlKC88L2csICcmbHQ7Jylcblx0XHRcdC5yZXBsYWNlKC8+L2csICcmZ3Q7Jylcblx0XHRcdC5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7Jylcblx0XHRcdC5yZXBsYWNlKC8nL2csICcmIzM5OycpO1xuXG5cdFx0cmV0dXJuIGA8YSBocmVmPVwiJHtocmVmfVwiIHRpdGxlPVwiJHt0aXRsZSB8fCBocmVmfVwiIGRyYWdnYWJsZT1cImZhbHNlXCI+JHt0ZXh0fTwvYT5gO1xuXHR9LFxufSk7XG5cbi8qKlxuICogTG93LWxldmVsIHdheSBjcmVhdGUgYSBodG1sIGVsZW1lbnQgZnJvbSBhIG1hcmtkb3duIHN0cmluZy5cbiAqXG4gKiAqKk5vdGUqKiB0aGF0IGZvciBtb3N0IGNhc2VzIHlvdSBzaG91bGQgYmUgdXNpbmcge0BsaW5rIGltcG9ydCgnLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L21hcmtkb3duUmVuZGVyZXIvYnJvd3Nlci9tYXJrZG93blJlbmRlcmVyLmpzJykuTWFya2Rvd25SZW5kZXJlciBNYXJrZG93blJlbmRlcmVyfVxuICogd2hpY2ggY29tZXMgd2l0aCBzdXBwb3J0IGZvciBwcmV0dHkgY29kZSBibG9jayByZW5kZXJpbmcgYW5kIHdoaWNoIHVzZXMgdGhlIGRlZmF1bHQgd2F5IG9mIGhhbmRsaW5nIGxpbmtzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyTWFya2Rvd24obWFya2Rvd246IElNYXJrZG93blN0cmluZywgb3B0aW9uczogTWFya2Rvd25SZW5kZXJPcHRpb25zID0ge30sIG1hcmtlZE9wdGlvbnM6IFJlYWRvbmx5PE1hcmtlZE9wdGlvbnM+ID0ge30pOiB7IGVsZW1lbnQ6IEhUTUxFbGVtZW50OyBkaXNwb3NlOiAoKSA9PiB2b2lkIH0ge1xuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0bGV0IGlzRGlzcG9zZWQgPSBmYWxzZTtcblxuXHRjb25zdCBlbGVtZW50ID0gY3JlYXRlRWxlbWVudChvcHRpb25zKTtcblxuXHRjb25zdCB7IHJlbmRlcmVyLCBjb2RlQmxvY2tzLCBzeW5jQ29kZUJsb2NrcyB9ID0gY3JlYXRlTWFya2Rvd25SZW5kZXJlcihvcHRpb25zLCBtYXJrZG93bik7XG5cdGNvbnN0IHZhbHVlID0gcHJlcHJvY2Vzc01hcmtkb3duU3RyaW5nKG1hcmtkb3duKTtcblxuXHRsZXQgcmVuZGVyZWRNYXJrZG93bjogc3RyaW5nO1xuXHRpZiAob3B0aW9ucy5maWxsSW5JbmNvbXBsZXRlVG9rZW5zKSB7XG5cdFx0Ly8gVGhlIGRlZmF1bHRzIGFyZSBhcHBsaWVkIGJ5IHBhcnNlIGJ1dCBub3QgbGV4ZXIoKS9wYXJzZXIoKSwgYW5kIHRoZXkgbmVlZCB0byBiZSBwcmVzZW50XG5cdFx0Y29uc3Qgb3B0czogTWFya2VkT3B0aW9ucyA9IHtcblx0XHRcdC4uLm1hcmtlZC5kZWZhdWx0cyxcblx0XHRcdC4uLm1hcmtlZE9wdGlvbnMsXG5cdFx0XHRyZW5kZXJlclxuXHRcdH07XG5cdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLmxleGVyKHZhbHVlLCBvcHRzKTtcblx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cdFx0cmVuZGVyZWRNYXJrZG93biA9IG1hcmtlZC5wYXJzZXIobmV3VG9rZW5zLCBvcHRzKTtcblx0fSBlbHNlIHtcblx0XHRyZW5kZXJlZE1hcmtkb3duID0gbWFya2VkLnBhcnNlKHZhbHVlLCB7IC4uLm1hcmtlZE9wdGlvbnMsIHJlbmRlcmVyLCBhc3luYzogZmFsc2UgfSk7XG5cdH1cblxuXHQvLyBSZXdyaXRlIHRoZW1lIGljb25zXG5cdGlmIChtYXJrZG93bi5zdXBwb3J0VGhlbWVJY29ucykge1xuXHRcdGNvbnN0IGVsZW1lbnRzID0gcmVuZGVyTGFiZWxXaXRoSWNvbnMocmVuZGVyZWRNYXJrZG93bik7XG5cdFx0cmVuZGVyZWRNYXJrZG93biA9IGVsZW1lbnRzLm1hcChlID0+IHR5cGVvZiBlID09PSAnc3RyaW5nJyA/IGUgOiBlLm91dGVySFRNTCkuam9pbignJyk7XG5cdH1cblxuXHRjb25zdCBodG1sUGFyc2VyID0gbmV3IERPTVBhcnNlcigpO1xuXHRjb25zdCBtYXJrZG93bkh0bWxEb2MgPSBodG1sUGFyc2VyLnBhcnNlRnJvbVN0cmluZyhzYW5pdGl6ZVJlbmRlcmVkTWFya2Rvd24oeyBpc1RydXN0ZWQ6IG1hcmtkb3duLmlzVHJ1c3RlZCwgLi4ub3B0aW9ucy5zYW5pdGl6ZXJPcHRpb25zIH0sIHJlbmRlcmVkTWFya2Rvd24pIGFzIHVua25vd24gYXMgc3RyaW5nLCAndGV4dC9odG1sJyk7XG5cblx0cmV3cml0ZVJlbmRlcmVkTGlua3MobWFya2Rvd24sIG9wdGlvbnMsIG1hcmtkb3duSHRtbERvYy5ib2R5KTtcblxuXHRlbGVtZW50LmlubmVySFRNTCA9IHNhbml0aXplUmVuZGVyZWRNYXJrZG93bih7IGlzVHJ1c3RlZDogbWFya2Rvd24uaXNUcnVzdGVkLCAuLi5vcHRpb25zLnNhbml0aXplck9wdGlvbnMgfSwgbWFya2Rvd25IdG1sRG9jLmJvZHkuaW5uZXJIVE1MKSBhcyB1bmtub3duIGFzIHN0cmluZztcblxuXHRpZiAoY29kZUJsb2Nrcy5sZW5ndGggPiAwKSB7XG5cdFx0UHJvbWlzZS5hbGwoY29kZUJsb2NrcykudGhlbigodHVwbGVzKSA9PiB7XG5cdFx0XHRpZiAoaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZW5kZXJlZEVsZW1lbnRzID0gbmV3IE1hcCh0dXBsZXMpO1xuXHRcdFx0Y29uc3QgcGxhY2Vob2xkZXJFbGVtZW50cyA9IGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRGl2RWxlbWVudD4oYGRpdltkYXRhLWNvZGVdYCk7XG5cdFx0XHRmb3IgKGNvbnN0IHBsYWNlaG9sZGVyRWxlbWVudCBvZiBwbGFjZWhvbGRlckVsZW1lbnRzKSB7XG5cdFx0XHRcdGNvbnN0IHJlbmRlcmVkRWxlbWVudCA9IHJlbmRlcmVkRWxlbWVudHMuZ2V0KHBsYWNlaG9sZGVyRWxlbWVudC5kYXRhc2V0Wydjb2RlJ10gPz8gJycpO1xuXHRcdFx0XHRpZiAocmVuZGVyZWRFbGVtZW50KSB7XG5cdFx0XHRcdFx0RE9NLnJlc2V0KHBsYWNlaG9sZGVyRWxlbWVudCwgcmVuZGVyZWRFbGVtZW50KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0b3B0aW9ucy5hc3luY1JlbmRlckNhbGxiYWNrPy4oKTtcblx0XHR9KTtcblx0fSBlbHNlIGlmIChzeW5jQ29kZUJsb2Nrcy5sZW5ndGggPiAwKSB7XG5cdFx0Y29uc3QgcmVuZGVyZWRFbGVtZW50cyA9IG5ldyBNYXAoc3luY0NvZGVCbG9ja3MpO1xuXHRcdGNvbnN0IHBsYWNlaG9sZGVyRWxlbWVudHMgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTERpdkVsZW1lbnQ+KGBkaXZbZGF0YS1jb2RlXWApO1xuXHRcdGZvciAoY29uc3QgcGxhY2Vob2xkZXJFbGVtZW50IG9mIHBsYWNlaG9sZGVyRWxlbWVudHMpIHtcblx0XHRcdGNvbnN0IHJlbmRlcmVkRWxlbWVudCA9IHJlbmRlcmVkRWxlbWVudHMuZ2V0KHBsYWNlaG9sZGVyRWxlbWVudC5kYXRhc2V0Wydjb2RlJ10gPz8gJycpO1xuXHRcdFx0aWYgKHJlbmRlcmVkRWxlbWVudCkge1xuXHRcdFx0XHRET00ucmVzZXQocGxhY2Vob2xkZXJFbGVtZW50LCByZW5kZXJlZEVsZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIFNpZ25hbCBzaXplIGNoYW5nZXMgZm9yIGltYWdlIHRhZ3Ncblx0aWYgKG9wdGlvbnMuYXN5bmNSZW5kZXJDYWxsYmFjaykge1xuXHRcdGZvciAoY29uc3QgaW1nIG9mIGVsZW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2ltZycpKSB7XG5cdFx0XHRjb25zdCBsaXN0ZW5lciA9IGRpc3Bvc2FibGVzLmFkZChET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGltZywgJ2xvYWQnLCAoKSA9PiB7XG5cdFx0XHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0b3B0aW9ucy5hc3luY1JlbmRlckNhbGxiYWNrISgpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdC8vIEFkZCBldmVudCBsaXN0ZW5lcnMgZm9yIGxpbmtzXG5cdGlmIChvcHRpb25zLmFjdGlvbkhhbmRsZXIpIHtcblx0XHRjb25zdCBvbkNsaWNrID0gb3B0aW9ucy5hY3Rpb25IYW5kbGVyLmRpc3Bvc2FibGVzLmFkZChuZXcgRG9tRW1pdHRlcihlbGVtZW50LCAnY2xpY2snKSk7XG5cdFx0Y29uc3Qgb25BdXhDbGljayA9IG9wdGlvbnMuYWN0aW9uSGFuZGxlci5kaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIoZWxlbWVudCwgJ2F1eGNsaWNrJykpO1xuXHRcdG9wdGlvbnMuYWN0aW9uSGFuZGxlci5kaXNwb3NhYmxlcy5hZGQoRXZlbnQuYW55KG9uQ2xpY2suZXZlbnQsIG9uQXV4Q2xpY2suZXZlbnQpKGUgPT4ge1xuXHRcdFx0Y29uc3QgbW91c2VFdmVudCA9IG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQoRE9NLmdldFdpbmRvdyhlbGVtZW50KSwgZSk7XG5cdFx0XHRpZiAoIW1vdXNlRXZlbnQubGVmdEJ1dHRvbiAmJiAhbW91c2VFdmVudC5taWRkbGVCdXR0b24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YWN0aXZhdGVMaW5rKG1hcmtkb3duLCBvcHRpb25zLCBtb3VzZUV2ZW50KTtcblx0XHR9KSk7XG5cblx0XHRvcHRpb25zLmFjdGlvbkhhbmRsZXIuZGlzcG9zYWJsZXMuYWRkKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoZWxlbWVudCwgJ2tleWRvd24nLCAoZSkgPT4ge1xuXHRcdFx0Y29uc3Qga2V5Ym9hcmRFdmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRpZiAoIWtleWJvYXJkRXZlbnQuZXF1YWxzKEtleUNvZGUuU3BhY2UpICYmICFrZXlib2FyZEV2ZW50LmVxdWFscyhLZXlDb2RlLkVudGVyKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhY3RpdmF0ZUxpbmsobWFya2Rvd24sIG9wdGlvbnMsIGtleWJvYXJkRXZlbnQpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0ZWxlbWVudCxcblx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRpc0Rpc3Bvc2VkID0gdHJ1ZTtcblx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH07XG59XG5cbmZ1bmN0aW9uIHJld3JpdGVSZW5kZXJlZExpbmtzKG1hcmtkb3duOiBJTWFya2Rvd25TdHJpbmcsIG9wdGlvbnM6IE1hcmtkb3duUmVuZGVyT3B0aW9ucywgcm9vdDogSFRNTEVsZW1lbnQpIHtcblx0Zm9yIChjb25zdCBlbCBvZiByb290LnF1ZXJ5U2VsZWN0b3JBbGwoJ2ltZywgYXVkaW8sIHZpZGVvLCBzb3VyY2UnKSkge1xuXHRcdGNvbnN0IHNyYyA9IGVsLmdldEF0dHJpYnV0ZSgnc3JjJyk7IC8vIEdldCB0aGUgcmF3ICdzcmMnIGF0dHJpYnV0ZSB2YWx1ZSBhcyB0ZXh0LCBub3QgdGhlIHJlc29sdmVkICdzcmMnXG5cdFx0aWYgKHNyYykge1xuXHRcdFx0bGV0IGhyZWYgPSBzcmM7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRpZiAobWFya2Rvd24uYmFzZVVyaSkgeyAvLyBhYnNvbHV0ZSBvciByZWxhdGl2ZSBsb2NhbCBwYXRoLCBvciBmaWxlOiB1cmlcblx0XHRcdFx0XHRocmVmID0gcmVzb2x2ZVdpdGhCYXNlVXJpKFVSSS5mcm9tKG1hcmtkb3duLmJhc2VVcmkpLCBocmVmKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZXJyKSB7IH1cblxuXHRcdFx0ZWwuc2V0QXR0cmlidXRlKCdzcmMnLCBtYXNzYWdlSHJlZihtYXJrZG93biwgaHJlZiwgdHJ1ZSkpO1xuXG5cdFx0XHRpZiAob3B0aW9ucy5yZW1vdGVJbWFnZUlzQWxsb3dlZCkge1xuXHRcdFx0XHRjb25zdCB1cmkgPSBVUkkucGFyc2UoaHJlZik7XG5cdFx0XHRcdGlmICh1cmkuc2NoZW1lICE9PSBTY2hlbWFzLmZpbGUgJiYgdXJpLnNjaGVtZSAhPT0gU2NoZW1hcy5kYXRhICYmICFvcHRpb25zLnJlbW90ZUltYWdlSXNBbGxvd2VkKHVyaSkpIHtcblx0XHRcdFx0XHRlbC5yZXBsYWNlV2l0aChET00uJCgnJywgdW5kZWZpbmVkLCBlbC5vdXRlckhUTUwpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGZvciAoY29uc3QgZWwgb2Ygcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCdhJykpIHtcblx0XHRjb25zdCBocmVmID0gZWwuZ2V0QXR0cmlidXRlKCdocmVmJyk7IC8vIEdldCB0aGUgcmF3ICdocmVmJyBhdHRyaWJ1dGUgdmFsdWUgYXMgdGV4dCwgbm90IHRoZSByZXNvbHZlZCAnaHJlZidcblx0XHRlbC5zZXRBdHRyaWJ1dGUoJ2hyZWYnLCAnJyk7IC8vIENsZWFyIG91dCBocmVmLiBXZSB1c2UgdGhlIGBkYXRhLWhyZWZgIGZvciBoYW5kbGluZyBjbGlja3MgaW5zdGVhZFxuXHRcdGlmICghaHJlZlxuXHRcdFx0fHwgL15kYXRhOnxqYXZhc2NyaXB0Oi9pLnRlc3QoaHJlZilcblx0XHRcdHx8ICgvXmNvbW1hbmQ6L2kudGVzdChocmVmKSAmJiAhbWFya2Rvd24uaXNUcnVzdGVkKVxuXHRcdFx0fHwgL15jb21tYW5kOihcXC9cXC9cXC8pP193b3JrYmVuY2hcXC5kb3dubG9hZFJlc291cmNlL2kudGVzdChocmVmKSkge1xuXHRcdFx0Ly8gZHJvcCB0aGUgbGlua1xuXHRcdFx0ZWwucmVwbGFjZVdpdGgoLi4uZWwuY2hpbGROb2Rlcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxldCByZXNvbHZlZEhyZWYgPSBtYXNzYWdlSHJlZihtYXJrZG93biwgaHJlZiwgZmFsc2UpO1xuXHRcdFx0aWYgKG1hcmtkb3duLmJhc2VVcmkpIHtcblx0XHRcdFx0cmVzb2x2ZWRIcmVmID0gcmVzb2x2ZVdpdGhCYXNlVXJpKFVSSS5mcm9tKG1hcmtkb3duLmJhc2VVcmkpLCBocmVmKTtcblx0XHRcdH1cblx0XHRcdGVsLmRhdGFzZXQuaHJlZiA9IHJlc29sdmVkSHJlZjtcblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlTWFya2Rvd25SZW5kZXJlcihvcHRpb25zOiBNYXJrZG93blJlbmRlck9wdGlvbnMsIG1hcmtkb3duOiBJTWFya2Rvd25TdHJpbmcpOiB7IHJlbmRlcmVyOiBtYXJrZWQuUmVuZGVyZXI7IGNvZGVCbG9ja3M6IFByb21pc2U8W3N0cmluZywgSFRNTEVsZW1lbnRdPltdOyBzeW5jQ29kZUJsb2NrczogW3N0cmluZywgSFRNTEVsZW1lbnRdW10gfSB7XG5cdGNvbnN0IHJlbmRlcmVyID0gbmV3IG1hcmtlZC5SZW5kZXJlcigpO1xuXHRyZW5kZXJlci5pbWFnZSA9IGRlZmF1bHRNYXJrZWRSZW5kZXJlcnMuaW1hZ2U7XG5cdHJlbmRlcmVyLmxpbmsgPSBkZWZhdWx0TWFya2VkUmVuZGVyZXJzLmxpbms7XG5cdHJlbmRlcmVyLnBhcmFncmFwaCA9IGRlZmF1bHRNYXJrZWRSZW5kZXJlcnMucGFyYWdyYXBoO1xuXG5cdC8vIFdpbGwgY29sbGVjdCBbaWQsIHJlbmRlcmVkRWxlbWVudF0gdHVwbGVzXG5cdGNvbnN0IGNvZGVCbG9ja3M6IFByb21pc2U8W3N0cmluZywgSFRNTEVsZW1lbnRdPltdID0gW107XG5cdGNvbnN0IHN5bmNDb2RlQmxvY2tzOiBbc3RyaW5nLCBIVE1MRWxlbWVudF1bXSA9IFtdO1xuXG5cdGlmIChvcHRpb25zLmNvZGVCbG9ja1JlbmRlcmVyU3luYykge1xuXHRcdHJlbmRlcmVyLmNvZGUgPSAoeyB0ZXh0LCBsYW5nLCByYXcgfTogbWFya2VkLlRva2Vucy5Db2RlKSA9PiB7XG5cdFx0XHRjb25zdCBpZCA9IGRlZmF1bHRHZW5lcmF0b3IubmV4dElkKCk7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IG9wdGlvbnMuY29kZUJsb2NrUmVuZGVyZXJTeW5jIShwb3N0UHJvY2Vzc0NvZGVCbG9ja0xhbmd1YWdlSWQobGFuZyksIHRleHQsIHJhdyk7XG5cdFx0XHRzeW5jQ29kZUJsb2Nrcy5wdXNoKFtpZCwgdmFsdWVdKTtcblx0XHRcdHJldHVybiBgPGRpdiBjbGFzcz1cImNvZGVcIiBkYXRhLWNvZGU9XCIke2lkfVwiPiR7ZXNjYXBlKHRleHQpfTwvZGl2PmA7XG5cdFx0fTtcblx0fSBlbHNlIGlmIChvcHRpb25zLmNvZGVCbG9ja1JlbmRlcmVyKSB7XG5cdFx0cmVuZGVyZXIuY29kZSA9ICh7IHRleHQsIGxhbmcgfTogbWFya2VkLlRva2Vucy5Db2RlKSA9PiB7XG5cdFx0XHRjb25zdCBpZCA9IGRlZmF1bHRHZW5lcmF0b3IubmV4dElkKCk7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IG9wdGlvbnMuY29kZUJsb2NrUmVuZGVyZXIhKHBvc3RQcm9jZXNzQ29kZUJsb2NrTGFuZ3VhZ2VJZChsYW5nKSwgdGV4dCk7XG5cdFx0XHRjb2RlQmxvY2tzLnB1c2godmFsdWUudGhlbihlbGVtZW50ID0+IFtpZCwgZWxlbWVudF0pKTtcblx0XHRcdHJldHVybiBgPGRpdiBjbGFzcz1cImNvZGVcIiBkYXRhLWNvZGU9XCIke2lkfVwiPiR7ZXNjYXBlKHRleHQpfTwvZGl2PmA7XG5cdFx0fTtcblx0fVxuXG5cdGlmICghbWFya2Rvd24uc3VwcG9ydEh0bWwpIHtcblx0XHQvLyBOb3RlOiB3ZSBhbHdheXMgcGFzcyB0aGUgb3V0cHV0IHRocm91Z2ggZG9tcHVyaWZ5IGFmdGVyIHRoaXMgc28gdGhhdCB3ZSBkb24ndCByZWx5IG9uXG5cdFx0Ly8gbWFya2VkIGZvciByZWFsIHNhbml0aXphdGlvbi5cblx0XHRyZW5kZXJlci5odG1sID0gKHsgdGV4dCB9KSA9PiB7XG5cdFx0XHRpZiAob3B0aW9ucy5zYW5pdGl6ZXJPcHRpb25zPy5yZXBsYWNlV2l0aFBsYWludGV4dCkge1xuXHRcdFx0XHRyZXR1cm4gZXNjYXBlKHRleHQpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtYXRjaCA9IG1hcmtkb3duLmlzVHJ1c3RlZCA/IHRleHQubWF0Y2goL14oPHNwYW5bXj5dKz4pfCg8XFwvXFxzKnNwYW4+KSQvKSA6IHVuZGVmaW5lZDtcblx0XHRcdHJldHVybiBtYXRjaCA/IHRleHQgOiAnJztcblx0XHR9O1xuXHR9XG5cdHJldHVybiB7IHJlbmRlcmVyLCBjb2RlQmxvY2tzLCBzeW5jQ29kZUJsb2NrcyB9O1xufVxuXG5mdW5jdGlvbiBwcmVwcm9jZXNzTWFya2Rvd25TdHJpbmcobWFya2Rvd246IElNYXJrZG93blN0cmluZykge1xuXHRsZXQgdmFsdWUgPSBtYXJrZG93bi52YWx1ZTtcblxuXHQvLyB2YWx1ZXMgdGhhdCBhcmUgdG9vIGxvbmcgd2lsbCBmcmVlemUgdGhlIFVJXG5cdGlmICh2YWx1ZS5sZW5ndGggPiAxMDBfMDAwKSB7XG5cdFx0dmFsdWUgPSBgJHt2YWx1ZS5zdWJzdHIoMCwgMTAwXzAwMCl9XHUyMDI2YDtcblx0fVxuXG5cdC8vIGVzY2FwZSB0aGVtZSBpY29uc1xuXHRpZiAobWFya2Rvd24uc3VwcG9ydFRoZW1lSWNvbnMpIHtcblx0XHR2YWx1ZSA9IG1hcmtkb3duRXNjYXBlRXNjYXBlZEljb25zKHZhbHVlKTtcblx0fVxuXG5cdHJldHVybiB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gYWN0aXZhdGVMaW5rKG1hcmtkb3duOiBJTWFya2Rvd25TdHJpbmcsIG9wdGlvbnM6IE1hcmtkb3duUmVuZGVyT3B0aW9ucywgZXZlbnQ6IFN0YW5kYXJkTW91c2VFdmVudCB8IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuXHRjb25zdCB0YXJnZXQgPSBldmVudC50YXJnZXQuY2xvc2VzdCgnYVtkYXRhLWhyZWZdJyk7XG5cdGlmICghRE9NLmlzSFRNTEVsZW1lbnQodGFyZ2V0KSkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHRyeSB7XG5cdFx0bGV0IGhyZWYgPSB0YXJnZXQuZGF0YXNldFsnaHJlZiddO1xuXHRcdGlmIChocmVmKSB7XG5cdFx0XHRpZiAobWFya2Rvd24uYmFzZVVyaSkge1xuXHRcdFx0XHRocmVmID0gcmVzb2x2ZVdpdGhCYXNlVXJpKFVSSS5mcm9tKG1hcmtkb3duLmJhc2VVcmkpLCBocmVmKTtcblx0XHRcdH1cblx0XHRcdG9wdGlvbnMuYWN0aW9uSGFuZGxlciEuY2FsbGJhY2soaHJlZiwgZXZlbnQpO1xuXHRcdH1cblx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyKTtcblx0fSBmaW5hbGx5IHtcblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHVyaU1hc3NhZ2UobWFya2Rvd246IElNYXJrZG93blN0cmluZywgcGFydDogc3RyaW5nKTogc3RyaW5nIHtcblx0bGV0IGRhdGE6IGFueTtcblx0dHJ5IHtcblx0XHRkYXRhID0gcGFyc2UoZGVjb2RlVVJJQ29tcG9uZW50KHBhcnQpKTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdC8vIGlnbm9yZVxuXHR9XG5cdGlmICghZGF0YSkge1xuXHRcdHJldHVybiBwYXJ0O1xuXHR9XG5cdGRhdGEgPSBjbG9uZUFuZENoYW5nZShkYXRhLCB2YWx1ZSA9PiB7XG5cdFx0aWYgKG1hcmtkb3duLnVyaXMgJiYgbWFya2Rvd24udXJpc1t2YWx1ZV0pIHtcblx0XHRcdHJldHVybiBVUkkucmV2aXZlKG1hcmtkb3duLnVyaXNbdmFsdWVdKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH0pO1xuXHRyZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KEpTT04uc3RyaW5naWZ5KGRhdGEpKTtcbn1cblxuZnVuY3Rpb24gbWFzc2FnZUhyZWYobWFya2Rvd246IElNYXJrZG93blN0cmluZywgaHJlZjogc3RyaW5nLCBpc0RvbVVyaTogYm9vbGVhbik6IHN0cmluZyB7XG5cdGNvbnN0IGRhdGEgPSBtYXJrZG93bi51cmlzICYmIG1hcmtkb3duLnVyaXNbaHJlZl07XG5cdGxldCB1cmkgPSBVUkkucmV2aXZlKGRhdGEpO1xuXHRpZiAoaXNEb21VcmkpIHtcblx0XHRpZiAoaHJlZi5zdGFydHNXaXRoKFNjaGVtYXMuZGF0YSArICc6JykpIHtcblx0XHRcdHJldHVybiBocmVmO1xuXHRcdH1cblx0XHRpZiAoIXVyaSkge1xuXHRcdFx0dXJpID0gVVJJLnBhcnNlKGhyZWYpO1xuXHRcdH1cblx0XHQvLyB0aGlzIFVSSSB3aWxsIGVuZCB1cCBhcyBcInNyY1wiLWF0dHJpYnV0ZSBvZiBhIGRvbSBub2RlXG5cdFx0Ly8gYW5kIGJlY2F1c2Ugb2YgdGhhdCBzcGVjaWFsIHJld3JpdGluZyBuZWVkcyB0byBiZSBkb25lXG5cdFx0Ly8gc28gdGhhdCB0aGUgVVJJIHVzZXMgYSBwcm90b2NvbCB0aGF0J3MgdW5kZXJzdG9vZCBieVxuXHRcdC8vIGJyb3dzZXJzIChsaWtlIGh0dHAgb3IgaHR0cHMpXG5cdFx0cmV0dXJuIEZpbGVBY2Nlc3MudXJpVG9Ccm93c2VyVXJpKHVyaSkudG9TdHJpbmcodHJ1ZSk7XG5cdH1cblx0aWYgKCF1cmkpIHtcblx0XHRyZXR1cm4gaHJlZjtcblx0fVxuXHRpZiAoVVJJLnBhcnNlKGhyZWYpLnRvU3RyaW5nKCkgPT09IHVyaS50b1N0cmluZygpKSB7XG5cdFx0cmV0dXJuIGhyZWY7IC8vIG5vIHRyYW5zZm9ybWF0aW9uIHBlcmZvcm1lZFxuXHR9XG5cdGlmICh1cmkucXVlcnkpIHtcblx0XHR1cmkgPSB1cmkud2l0aCh7IHF1ZXJ5OiB1cmlNYXNzYWdlKG1hcmtkb3duLCB1cmkucXVlcnkpIH0pO1xuXHR9XG5cdHJldHVybiB1cmkudG9TdHJpbmcoKTtcbn1cblxuZnVuY3Rpb24gcG9zdFByb2Nlc3NDb2RlQmxvY2tMYW5ndWFnZUlkKGxhbmc6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHN0cmluZyB7XG5cdGlmICghbGFuZykge1xuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdGNvbnN0IHBhcnRzID0gbGFuZy5zcGxpdCgvW1xccyt8OnwsfFxce3xcXD9dLywgMSk7XG5cdGlmIChwYXJ0cy5sZW5ndGgpIHtcblx0XHRyZXR1cm4gcGFydHNbMF07XG5cdH1cblx0cmV0dXJuIGxhbmc7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVXaXRoQmFzZVVyaShiYXNlVXJpOiBVUkksIGhyZWY6IHN0cmluZyk6IHN0cmluZyB7XG5cdGNvbnN0IGhhc1NjaGVtZSA9IC9eXFx3W1xcd1xcZCsuLV0qOi8udGVzdChocmVmKTtcblx0aWYgKGhhc1NjaGVtZSkge1xuXHRcdHJldHVybiBocmVmO1xuXHR9XG5cblx0aWYgKGJhc2VVcmkucGF0aC5lbmRzV2l0aCgnLycpKSB7XG5cdFx0cmV0dXJuIHJlc29sdmVQYXRoKGJhc2VVcmksIGhyZWYpLnRvU3RyaW5nKCk7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIHJlc29sdmVQYXRoKGRpcm5hbWUoYmFzZVVyaSksIGhyZWYpLnRvU3RyaW5nKCk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElJbnRlcm5hbFNhbml0aXplck9wdGlvbnMgZXh0ZW5kcyBJU2FuaXRpemVyT3B0aW9ucyB7XG5cdGlzVHJ1c3RlZD86IGJvb2xlYW4gfCBNYXJrZG93blN0cmluZ1RydXN0ZWRPcHRpb25zO1xufVxuXG5jb25zdCBzZWxmQ2xvc2luZ1RhZ3MgPSBbJ2FyZWEnLCAnYmFzZScsICdicicsICdjb2wnLCAnY29tbWFuZCcsICdlbWJlZCcsICdocicsICdpbWcnLCAnaW5wdXQnLCAna2V5Z2VuJywgJ2xpbmsnLCAnbWV0YScsICdwYXJhbScsICdzb3VyY2UnLCAndHJhY2snLCAnd2JyJ107XG5cbmZ1bmN0aW9uIHNhbml0aXplUmVuZGVyZWRNYXJrZG93bihcblx0b3B0aW9uczogSUludGVybmFsU2FuaXRpemVyT3B0aW9ucyxcblx0cmVuZGVyZWRNYXJrZG93bjogc3RyaW5nLFxuKTogVHJ1c3RlZEhUTUwge1xuXHRjb25zdCB7IGNvbmZpZywgYWxsb3dlZFNjaGVtZXMgfSA9IGdldFNhbml0aXplck9wdGlvbnMob3B0aW9ucyk7XG5cdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRzdG9yZS5hZGQoYWRkRG9tcHVyaWZ5SG9vaygndXBvblNhbml0aXplQXR0cmlidXRlJywgKGVsZW1lbnQsIGUpID0+IHtcblx0XHRpZiAoZS5hdHRyTmFtZSA9PT0gJ3N0eWxlJyB8fCBlLmF0dHJOYW1lID09PSAnY2xhc3MnKSB7XG5cdFx0XHRpZiAoZWxlbWVudC50YWdOYW1lID09PSAnU1BBTicpIHtcblx0XHRcdFx0aWYgKGUuYXR0ck5hbWUgPT09ICdzdHlsZScpIHtcblx0XHRcdFx0XHRlLmtlZXBBdHRyID0gL14oY29sb3JcXDooI1swLTlhLWZBLUZdK3x2YXJcXCgtLXZzY29kZSgtW2EtekEtWjAtOV0rKStcXCkpOyk/KGJhY2tncm91bmQtY29sb3JcXDooI1swLTlhLWZBLUZdK3x2YXJcXCgtLXZzY29kZSgtW2EtekEtWjAtOV0rKStcXCkpOyk/KGJvcmRlci1yYWRpdXM6WzAtOV0rcHg7KT8kLy50ZXN0KGUuYXR0clZhbHVlKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH0gZWxzZSBpZiAoZS5hdHRyTmFtZSA9PT0gJ2NsYXNzJykge1xuXHRcdFx0XHRcdGUua2VlcEF0dHIgPSAvXmNvZGljb24gY29kaWNvbi1bYS16XFwtXSsoIGNvZGljb24tbW9kaWZpZXItW2EtelxcLV0rKT8kLy50ZXN0KGUuYXR0clZhbHVlKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGUua2VlcEF0dHIgPSBmYWxzZTtcblx0XHRcdHJldHVybjtcblx0XHR9IGVsc2UgaWYgKGVsZW1lbnQudGFnTmFtZSA9PT0gJ0lOUFVUJyAmJiBlbGVtZW50LmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtKCd0eXBlJyk/LnZhbHVlID09PSAnY2hlY2tib3gnKSB7XG5cdFx0XHRpZiAoKGUuYXR0ck5hbWUgPT09ICd0eXBlJyAmJiBlLmF0dHJWYWx1ZSA9PT0gJ2NoZWNrYm94JykgfHwgZS5hdHRyTmFtZSA9PT0gJ2Rpc2FibGVkJyB8fCBlLmF0dHJOYW1lID09PSAnY2hlY2tlZCcpIHtcblx0XHRcdFx0ZS5rZWVwQXR0ciA9IHRydWU7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGUua2VlcEF0dHIgPSBmYWxzZTtcblx0XHR9XG5cdH0pKTtcblxuXHRzdG9yZS5hZGQoYWRkRG9tcHVyaWZ5SG9vaygndXBvblNhbml0aXplRWxlbWVudCcsIChlbGVtZW50LCBlKSA9PiB7XG5cdFx0aWYgKGUudGFnTmFtZSA9PT0gJ2lucHV0Jykge1xuXHRcdFx0aWYgKGVsZW1lbnQuYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0oJ3R5cGUnKT8udmFsdWUgPT09ICdjaGVja2JveCcpIHtcblx0XHRcdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2Rpc2FibGVkJywgJycpO1xuXHRcdFx0fSBlbHNlIGlmICghb3B0aW9ucy5yZXBsYWNlV2l0aFBsYWludGV4dCkge1xuXHRcdFx0XHRlbGVtZW50LnJlbW92ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zLnJlcGxhY2VXaXRoUGxhaW50ZXh0ICYmICFlLmFsbG93ZWRUYWdzW2UudGFnTmFtZV0gJiYgZS50YWdOYW1lICE9PSAnYm9keScpIHtcblx0XHRcdGlmIChlbGVtZW50LnBhcmVudEVsZW1lbnQpIHtcblx0XHRcdFx0bGV0IHN0YXJ0VGFnVGV4dDogc3RyaW5nO1xuXHRcdFx0XHRsZXQgZW5kVGFnVGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAoZS50YWdOYW1lID09PSAnI2NvbW1lbnQnKSB7XG5cdFx0XHRcdFx0c3RhcnRUYWdUZXh0ID0gYDwhLS0ke2VsZW1lbnQudGV4dENvbnRlbnR9LS0+YDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBpc1NlbGZDbG9zaW5nID0gc2VsZkNsb3NpbmdUYWdzLmluY2x1ZGVzKGUudGFnTmFtZSk7XG5cdFx0XHRcdFx0Y29uc3QgYXR0clN0cmluZyA9IGVsZW1lbnQuYXR0cmlidXRlcy5sZW5ndGggP1xuXHRcdFx0XHRcdFx0JyAnICsgQXJyYXkuZnJvbShlbGVtZW50LmF0dHJpYnV0ZXMpXG5cdFx0XHRcdFx0XHRcdC5tYXAoYXR0ciA9PiBgJHthdHRyLm5hbWV9PVwiJHthdHRyLnZhbHVlfVwiYClcblx0XHRcdFx0XHRcdFx0LmpvaW4oJyAnKVxuXHRcdFx0XHRcdFx0OiAnJztcblx0XHRcdFx0XHRzdGFydFRhZ1RleHQgPSBgPCR7ZS50YWdOYW1lfSR7YXR0clN0cmluZ30+YDtcblx0XHRcdFx0XHRpZiAoIWlzU2VsZkNsb3NpbmcpIHtcblx0XHRcdFx0XHRcdGVuZFRhZ1RleHQgPSBgPC8ke2UudGFnTmFtZX0+YDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblx0XHRcdFx0Y29uc3QgdGV4dE5vZGUgPSBlbGVtZW50LnBhcmVudEVsZW1lbnQub3duZXJEb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShzdGFydFRhZ1RleHQpO1xuXHRcdFx0XHRmcmFnbWVudC5hcHBlbmRDaGlsZCh0ZXh0Tm9kZSk7XG5cdFx0XHRcdGNvbnN0IGVuZFRhZ1RleHROb2RlID0gZW5kVGFnVGV4dCA/IGVsZW1lbnQucGFyZW50RWxlbWVudC5vd25lckRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGVuZFRhZ1RleHQpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHR3aGlsZSAoZWxlbWVudC5maXJzdENoaWxkKSB7XG5cdFx0XHRcdFx0ZnJhZ21lbnQuYXBwZW5kQ2hpbGQoZWxlbWVudC5maXJzdENoaWxkKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChlbmRUYWdUZXh0Tm9kZSkge1xuXHRcdFx0XHRcdGZyYWdtZW50LmFwcGVuZENoaWxkKGVuZFRhZ1RleHROb2RlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChlbGVtZW50Lm5vZGVUeXBlID09PSBOb2RlLkNPTU1FTlRfTk9ERSkge1xuXHRcdFx0XHRcdC8vIFdvcmthcm91bmQgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9jdXJlNTMvRE9NUHVyaWZ5L2lzc3Vlcy8xMDA1XG5cdFx0XHRcdFx0Ly8gVGhlIGNvbW1lbnQgd2lsbCBiZSBkZWxldGVkIGluIHRoZSBuZXh0IHBoYXNlLiBIb3dldmVyIGlmIHdlIHRyeSB0byByZW1vdmUgaXQgbm93LCBpdCB3aWxsIGNhdXNlXG5cdFx0XHRcdFx0Ly8gYW4gZXhjZXB0aW9uLiBJbnN0ZWFkIHdlIGluc2VydCB0aGUgdGV4dCBub2RlIGJlZm9yZSB0aGUgY29tbWVudC5cblx0XHRcdFx0XHRlbGVtZW50LnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKGZyYWdtZW50LCBlbGVtZW50KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRlbGVtZW50LnBhcmVudEVsZW1lbnQucmVwbGFjZUNoaWxkKGZyYWdtZW50LCBlbGVtZW50KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSkpO1xuXG5cdHN0b3JlLmFkZChET00uaG9va0RvbVB1cmlmeUhyZWZBbmRTcmNTYW5pdGl6ZXIoYWxsb3dlZFNjaGVtZXMpKTtcblxuXHR0cnkge1xuXHRcdHJldHVybiBkb21wdXJpZnkuc2FuaXRpemUocmVuZGVyZWRNYXJrZG93biwgeyAuLi5jb25maWcsIFJFVFVSTl9UUlVTVEVEX1RZUEU6IHRydWUgfSk7XG5cdH0gZmluYWxseSB7XG5cdFx0c3RvcmUuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBhbGxvd2VkTWFya2Rvd25BdHRyID0gW1xuXHQnYWxpZ24nLFxuXHQnYXV0b3BsYXknLFxuXHQnYWx0Jyxcblx0J2NoZWNrZWQnLFxuXHQnY2xhc3MnLFxuXHQnY29sc3BhbicsXG5cdCdjb250cm9scycsXG5cdCdkYXRhLWNvZGUnLFxuXHQnZGF0YS1ocmVmJyxcblx0J2Rpc2FibGVkJyxcblx0J2RyYWdnYWJsZScsXG5cdCdoZWlnaHQnLFxuXHQnaHJlZicsXG5cdCdsb29wJyxcblx0J211dGVkJyxcblx0J3BsYXlzaW5saW5lJyxcblx0J3Bvc3RlcicsXG5cdCdyb3dzcGFuJyxcblx0J3NyYycsXG5cdCdzdHlsZScsXG5cdCd0YXJnZXQnLFxuXHQndGl0bGUnLFxuXHQndHlwZScsXG5cdCd3aWR0aCcsXG5cdCdzdGFydCcsXG5dO1xuXG5mdW5jdGlvbiBnZXRTYW5pdGl6ZXJPcHRpb25zKG9wdGlvbnM6IElJbnRlcm5hbFNhbml0aXplck9wdGlvbnMpOiB7IGNvbmZpZzogZG9tcHVyaWZ5LkNvbmZpZzsgYWxsb3dlZFNjaGVtZXM6IHN0cmluZ1tdIH0ge1xuXHRjb25zdCBhbGxvd2VkU2NoZW1lcyA9IFtcblx0XHRTY2hlbWFzLmh0dHAsXG5cdFx0U2NoZW1hcy5odHRwcyxcblx0XHRTY2hlbWFzLm1haWx0byxcblx0XHRTY2hlbWFzLmRhdGEsXG5cdFx0U2NoZW1hcy5maWxlLFxuXHRcdFNjaGVtYXMudnNjb2RlRmlsZVJlc291cmNlLFxuXHRcdFNjaGVtYXMudnNjb2RlUmVtb3RlLFxuXHRcdFNjaGVtYXMudnNjb2RlUmVtb3RlUmVzb3VyY2UsXG5cdF07XG5cblx0aWYgKG9wdGlvbnMuaXNUcnVzdGVkKSB7XG5cdFx0YWxsb3dlZFNjaGVtZXMucHVzaChTY2hlbWFzLmNvbW1hbmQpO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRjb25maWc6IHtcblx0XHRcdC8vIGFsbG93ZWRUYWdzIHNob3VsZCBpbmNsdWRlZCBldmVyeXRoaW5nIHRoYXQgbWFya2Rvd24gcmVuZGVycyB0by5cblx0XHRcdC8vIFNpbmNlIHdlIGhhdmUgb3VyIG93biBzYW5pdGl6ZSBmdW5jdGlvbiBmb3IgbWFya2VkLCBpdCdzIHBvc3NpYmxlIHdlIG1pc3NlZCBzb21lIHRhZyBzbyBsZXQgZG9tcHVyaWZ5IG1ha2Ugc3VyZS5cblx0XHRcdC8vIEhUTUwgdGFncyB0aGF0IGNhbiByZXN1bHQgZnJvbSBtYXJrZG93biBhcmUgZnJvbSByZWFkaW5nIGh0dHBzOi8vc3BlYy5jb21tb25tYXJrLm9yZy8wLjI5L1xuXHRcdFx0Ly8gSFRNTCB0YWJsZSB0YWdzIHRoYXQgY2FuIHJlc3VsdCBmcm9tIG1hcmtkb3duIGFyZSBmcm9tIGh0dHBzOi8vZ2l0aHViLmdpdGh1Yi5jb20vZ2ZtLyN0YWJsZXMtZXh0ZW5zaW9uLVxuXHRcdFx0QUxMT1dFRF9UQUdTOiBvcHRpb25zLmFsbG93ZWRUYWdzID8/IFsuLi5ET00uYmFzaWNNYXJrdXBIdG1sVGFnc10sXG5cdFx0XHRBTExPV0VEX0FUVFI6IGFsbG93ZWRNYXJrZG93bkF0dHIsXG5cdFx0XHRBTExPV19VTktOT1dOX1BST1RPQ09MUzogdHJ1ZSxcblx0XHR9LFxuXHRcdGFsbG93ZWRTY2hlbWVzXG5cdH07XG59XG5cbi8qKlxuICogU3RyaXBzIGFsbCBtYXJrZG93biBmcm9tIGBzdHJpbmdgLCBpZiBpdCdzIGFuIElNYXJrZG93blN0cmluZy4gRm9yIGV4YW1wbGVcbiAqIGAjIEhlYWRlcmAgd291bGQgYmUgb3V0cHV0IGFzIGBIZWFkZXJgLiBJZiBpdCdzIG5vdCwgdGhlIHN0cmluZyBpcyByZXR1cm5lZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlclN0cmluZ0FzUGxhaW50ZXh0KHN0cmluZzogSU1hcmtkb3duU3RyaW5nIHwgc3RyaW5nKSB7XG5cdHJldHVybiBpc01hcmtkb3duU3RyaW5nKHN0cmluZykgPyByZW5kZXJNYXJrZG93bkFzUGxhaW50ZXh0KHN0cmluZykgOiBzdHJpbmc7XG59XG5cbi8qKlxuICogU3RyaXBzIGFsbCBtYXJrZG93biBmcm9tIGBtYXJrZG93bmBcbiAqXG4gKiBGb3IgZXhhbXBsZSBgIyBIZWFkZXJgIHdvdWxkIGJlIG91dHB1dCBhcyBgSGVhZGVyYC5cbiAqXG4gKiBAcGFyYW0gd2l0aENvZGVCbG9ja3MgSW5jbHVkZSB0aGUgYGBgIG9mIGNvZGUgYmxvY2tzIGFzIHdlbGxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlck1hcmtkb3duQXNQbGFpbnRleHQobWFya2Rvd246IElNYXJrZG93blN0cmluZywgd2l0aENvZGVCbG9ja3M/OiBib29sZWFuKSB7XG5cdC8vIHZhbHVlcyB0aGF0IGFyZSB0b28gbG9uZyB3aWxsIGZyZWV6ZSB0aGUgVUlcblx0bGV0IHZhbHVlID0gbWFya2Rvd24udmFsdWUgPz8gJyc7XG5cdGlmICh2YWx1ZS5sZW5ndGggPiAxMDBfMDAwKSB7XG5cdFx0dmFsdWUgPSBgJHt2YWx1ZS5zdWJzdHIoMCwgMTAwXzAwMCl9XHUyMDI2YDtcblx0fVxuXG5cdGNvbnN0IGh0bWwgPSBtYXJrZWQucGFyc2UodmFsdWUsIHsgYXN5bmM6IGZhbHNlLCByZW5kZXJlcjogd2l0aENvZGVCbG9ja3MgPyBwbGFpblRleHRXaXRoQ29kZUJsb2Nrc1JlbmRlcmVyLnZhbHVlIDogcGxhaW5UZXh0UmVuZGVyZXIudmFsdWUgfSk7XG5cdHJldHVybiBzYW5pdGl6ZVJlbmRlcmVkTWFya2Rvd24oeyBpc1RydXN0ZWQ6IGZhbHNlIH0sIGh0bWwpXG5cdFx0LnRvU3RyaW5nKClcblx0XHQucmVwbGFjZSgvJigjXFxkK3xbYS16QS1aXSspOy9nLCBtID0+IHVuZXNjYXBlSW5mby5nZXQobSkgPz8gbSlcblx0XHQudHJpbSgpO1xufVxuXG5jb25zdCB1bmVzY2FwZUluZm8gPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPihbXG5cdFsnJnF1b3Q7JywgJ1wiJ10sXG5cdFsnJm5ic3A7JywgJyAnXSxcblx0WycmYW1wOycsICcmJ10sXG5cdFsnJiMzOTsnLCAnXFwnJ10sXG5cdFsnJmx0OycsICc8J10sXG5cdFsnJmd0OycsICc+J10sXG5dKTtcblxuZnVuY3Rpb24gY3JlYXRlUGxhaW5UZXh0UmVuZGVyZXIoKTogbWFya2VkLlJlbmRlcmVyIHtcblx0Y29uc3QgcmVuZGVyZXIgPSBuZXcgbWFya2VkLlJlbmRlcmVyKCk7XG5cblx0cmVuZGVyZXIuY29kZSA9ICh7IHRleHQgfTogbWFya2VkLlRva2Vucy5Db2RlKTogc3RyaW5nID0+IHtcblx0XHRyZXR1cm4gZXNjYXBlKHRleHQpO1xuXHR9O1xuXHRyZW5kZXJlci5ibG9ja3F1b3RlID0gKHsgdGV4dCB9OiBtYXJrZWQuVG9rZW5zLkJsb2NrcXVvdGUpOiBzdHJpbmcgPT4ge1xuXHRcdHJldHVybiB0ZXh0ICsgJ1xcbic7XG5cdH07XG5cdHJlbmRlcmVyLmh0bWwgPSAoXzogbWFya2VkLlRva2Vucy5IVE1MKTogc3RyaW5nID0+IHtcblx0XHRyZXR1cm4gJyc7XG5cdH07XG5cdHJlbmRlcmVyLmhlYWRpbmcgPSBmdW5jdGlvbiAoeyB0b2tlbnMgfTogbWFya2VkLlRva2Vucy5IZWFkaW5nKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5wYXJzZXIucGFyc2VJbmxpbmUodG9rZW5zKSArICdcXG4nO1xuXHR9O1xuXHRyZW5kZXJlci5ociA9ICgpOiBzdHJpbmcgPT4ge1xuXHRcdHJldHVybiAnJztcblx0fTtcblx0cmVuZGVyZXIubGlzdCA9IGZ1bmN0aW9uICh7IGl0ZW1zIH06IG1hcmtlZC5Ub2tlbnMuTGlzdCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGl0ZW1zLm1hcCh4ID0+IHRoaXMubGlzdGl0ZW0oeCkpLmpvaW4oJ1xcbicpICsgJ1xcbic7XG5cdH07XG5cdHJlbmRlcmVyLmxpc3RpdGVtID0gKHsgdGV4dCB9OiBtYXJrZWQuVG9rZW5zLkxpc3RJdGVtKTogc3RyaW5nID0+IHtcblx0XHRyZXR1cm4gdGV4dCArICdcXG4nO1xuXHR9O1xuXHRyZW5kZXJlci5wYXJhZ3JhcGggPSBmdW5jdGlvbiAoeyB0b2tlbnMgfTogbWFya2VkLlRva2Vucy5QYXJhZ3JhcGgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnBhcnNlci5wYXJzZUlubGluZSh0b2tlbnMpICsgJ1xcbic7XG5cdH07XG5cdHJlbmRlcmVyLnRhYmxlID0gZnVuY3Rpb24gKHsgaGVhZGVyLCByb3dzIH06IG1hcmtlZC5Ub2tlbnMuVGFibGUpOiBzdHJpbmcge1xuXHRcdHJldHVybiBoZWFkZXIubWFwKGNlbGwgPT4gdGhpcy50YWJsZWNlbGwoY2VsbCkpLmpvaW4oJyAnKSArICdcXG4nICsgcm93cy5tYXAoY2VsbHMgPT4gY2VsbHMubWFwKGNlbGwgPT4gdGhpcy50YWJsZWNlbGwoY2VsbCkpLmpvaW4oJyAnKSkuam9pbignXFxuJykgKyAnXFxuJztcblx0fTtcblx0cmVuZGVyZXIudGFibGVyb3cgPSAoeyB0ZXh0IH06IG1hcmtlZC5Ub2tlbnMuVGFibGVSb3cpOiBzdHJpbmcgPT4ge1xuXHRcdHJldHVybiB0ZXh0O1xuXHR9O1xuXHRyZW5kZXJlci50YWJsZWNlbGwgPSBmdW5jdGlvbiAoeyB0b2tlbnMgfTogbWFya2VkLlRva2Vucy5UYWJsZUNlbGwpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnBhcnNlci5wYXJzZUlubGluZSh0b2tlbnMpO1xuXHR9O1xuXHRyZW5kZXJlci5zdHJvbmcgPSAoeyB0ZXh0IH06IG1hcmtlZC5Ub2tlbnMuU3Ryb25nKTogc3RyaW5nID0+IHtcblx0XHRyZXR1cm4gdGV4dDtcblx0fTtcblx0cmVuZGVyZXIuZW0gPSAoeyB0ZXh0IH06IG1hcmtlZC5Ub2tlbnMuRW0pOiBzdHJpbmcgPT4ge1xuXHRcdHJldHVybiB0ZXh0O1xuXHR9O1xuXHRyZW5kZXJlci5jb2Rlc3BhbiA9ICh7IHRleHQgfTogbWFya2VkLlRva2Vucy5Db2Rlc3Bhbik6IHN0cmluZyA9PiB7XG5cdFx0cmV0dXJuIGVzY2FwZSh0ZXh0KTtcblx0fTtcblx0cmVuZGVyZXIuYnIgPSAoXzogbWFya2VkLlRva2Vucy5Ccik6IHN0cmluZyA9PiB7XG5cdFx0cmV0dXJuICdcXG4nO1xuXHR9O1xuXHRyZW5kZXJlci5kZWwgPSAoeyB0ZXh0IH06IG1hcmtlZC5Ub2tlbnMuRGVsKTogc3RyaW5nID0+IHtcblx0XHRyZXR1cm4gdGV4dDtcblx0fTtcblx0cmVuZGVyZXIuaW1hZ2UgPSAoXzogbWFya2VkLlRva2Vucy5JbWFnZSk6IHN0cmluZyA9PiB7XG5cdFx0cmV0dXJuICcnO1xuXHR9O1xuXHRyZW5kZXJlci50ZXh0ID0gKHsgdGV4dCB9OiBtYXJrZWQuVG9rZW5zLlRleHQpOiBzdHJpbmcgPT4ge1xuXHRcdHJldHVybiB0ZXh0O1xuXHR9O1xuXHRyZW5kZXJlci5saW5rID0gKHsgdGV4dCB9OiBtYXJrZWQuVG9rZW5zLkxpbmspOiBzdHJpbmcgPT4ge1xuXHRcdHJldHVybiB0ZXh0O1xuXHR9O1xuXHRyZXR1cm4gcmVuZGVyZXI7XG59XG5jb25zdCBwbGFpblRleHRSZW5kZXJlciA9IG5ldyBMYXp5PG1hcmtlZC5SZW5kZXJlcj4oY3JlYXRlUGxhaW5UZXh0UmVuZGVyZXIpO1xuXG5jb25zdCBwbGFpblRleHRXaXRoQ29kZUJsb2Nrc1JlbmRlcmVyID0gbmV3IExhenk8bWFya2VkLlJlbmRlcmVyPigoKSA9PiB7XG5cdGNvbnN0IHJlbmRlcmVyID0gY3JlYXRlUGxhaW5UZXh0UmVuZGVyZXIoKTtcblx0cmVuZGVyZXIuY29kZSA9ICh7IHRleHQgfTogbWFya2VkLlRva2Vucy5Db2RlKTogc3RyaW5nID0+IHtcblx0XHRyZXR1cm4gYFxcblxcYFxcYFxcYFxcbiR7ZXNjYXBlKHRleHQpfVxcblxcYFxcYFxcYFxcbmA7XG5cdH07XG5cdHJldHVybiByZW5kZXJlcjtcbn0pO1xuXG5mdW5jdGlvbiBtZXJnZVJhd1Rva2VuVGV4dCh0b2tlbnM6IG1hcmtlZC5Ub2tlbltdKTogc3RyaW5nIHtcblx0bGV0IG1lcmdlZFRva2VuVGV4dCA9ICcnO1xuXHR0b2tlbnMuZm9yRWFjaCh0b2tlbiA9PiB7XG5cdFx0bWVyZ2VkVG9rZW5UZXh0ICs9IHRva2VuLnJhdztcblx0fSk7XG5cdHJldHVybiBtZXJnZWRUb2tlblRleHQ7XG59XG5cbmZ1bmN0aW9uIGNvbXBsZXRlU2luZ2xlTGluZVBhdHRlcm4odG9rZW46IG1hcmtlZC5Ub2tlbnMuVGV4dCB8IG1hcmtlZC5Ub2tlbnMuUGFyYWdyYXBoKTogbWFya2VkLlRva2VuIHwgdW5kZWZpbmVkIHtcblx0aWYgKCF0b2tlbi50b2tlbnMpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Zm9yIChsZXQgaSA9IHRva2VuLnRva2Vucy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdGNvbnN0IHN1YnRva2VuID0gdG9rZW4udG9rZW5zW2ldO1xuXHRcdGlmIChzdWJ0b2tlbi50eXBlID09PSAndGV4dCcpIHtcblx0XHRcdGNvbnN0IGxpbmVzID0gc3VidG9rZW4ucmF3LnNwbGl0KCdcXG4nKTtcblx0XHRcdGNvbnN0IGxhc3RMaW5lID0gbGluZXNbbGluZXMubGVuZ3RoIC0gMV07XG5cdFx0XHRpZiAobGFzdExpbmUuaW5jbHVkZXMoJ2AnKSkge1xuXHRcdFx0XHRyZXR1cm4gY29tcGxldGVDb2Rlc3Bhbih0b2tlbik7XG5cdFx0XHR9XG5cblx0XHRcdGVsc2UgaWYgKGxhc3RMaW5lLmluY2x1ZGVzKCcqKicpKSB7XG5cdFx0XHRcdHJldHVybiBjb21wbGV0ZURvdWJsZXN0YXIodG9rZW4pO1xuXHRcdFx0fVxuXG5cdFx0XHRlbHNlIGlmIChsYXN0TGluZS5tYXRjaCgvXFwqXFx3LykpIHtcblx0XHRcdFx0cmV0dXJuIGNvbXBsZXRlU3Rhcih0b2tlbik7XG5cdFx0XHR9XG5cblx0XHRcdGVsc2UgaWYgKGxhc3RMaW5lLm1hdGNoKC8oXnxcXHMpX19cXHcvKSkge1xuXHRcdFx0XHRyZXR1cm4gY29tcGxldGVEb3VibGVVbmRlcnNjb3JlKHRva2VuKTtcblx0XHRcdH1cblxuXHRcdFx0ZWxzZSBpZiAobGFzdExpbmUubWF0Y2goLyhefFxccylfXFx3LykpIHtcblx0XHRcdFx0cmV0dXJuIGNvbXBsZXRlVW5kZXJzY29yZSh0b2tlbik7XG5cdFx0XHR9XG5cblx0XHRcdGVsc2UgaWYgKFxuXHRcdFx0XHQvLyBUZXh0IHdpdGggc3RhcnQgb2YgbGluayB0YXJnZXRcblx0XHRcdFx0aGFzTGlua1RleHRBbmRTdGFydE9mTGlua1RhcmdldChsYXN0TGluZSkgfHxcblx0XHRcdFx0Ly8gVGhpcyB0b2tlbiBkb2Vzbid0IGhhdmUgdGhlIGxpbmsgdGV4dCwgZWcgaWYgaXQgY29udGFpbnMgb3RoZXIgbWFya2Rvd24gY29uc3RydWN0cyB0aGF0IGFyZSBpbiBvdGhlciBzdWJ0b2tlbnMuXG5cdFx0XHRcdC8vIEJ1dCBzb21lIHByZWNlZGluZyB0b2tlbiBkb2VzIGhhdmUgYW4gdW5iYWxhbmNlZCBbIGF0IGxlYXN0XG5cdFx0XHRcdGhhc1N0YXJ0T2ZMaW5rVGFyZ2V0QW5kTm9MaW5rVGV4dChsYXN0TGluZSkgJiYgdG9rZW4udG9rZW5zLnNsaWNlKDAsIGkpLnNvbWUodCA9PiB0LnR5cGUgPT09ICd0ZXh0JyAmJiB0LnJhdy5tYXRjaCgvXFxbW15cXF1dKiQvKSlcblx0XHRcdCkge1xuXHRcdFx0XHRjb25zdCBuZXh0VHdvU3ViVG9rZW5zID0gdG9rZW4udG9rZW5zLnNsaWNlKGkgKyAxKTtcblxuXHRcdFx0XHQvLyBBIG1hcmtkb3duIGxpbmsgY2FuIGxvb2sgbGlrZVxuXHRcdFx0XHQvLyBbbGluayB0ZXh0XShodHRwczovL21pY3Jvc29mdC5jb20gXCJtb3JlIHRleHRcIilcblx0XHRcdFx0Ly8gV2hlcmUgXCJtb3JlIHRleHRcIiBpcyBhIHRpdGxlIGZvciB0aGUgbGluayBvciBhbiBhcmd1bWVudCB0byBhIHZzY29kZSBjb21tYW5kIGxpbmtcblx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdC8vIElmIHRoZSBsaW5rIHdhcyBwYXJzZWQgYXMgYSBsaW5rLCB0aGVuIGxvb2sgZm9yIGEgbGluayB0b2tlbiBhbmQgYSB0ZXh0IHRva2VuIHdpdGggYSBxdW90ZVxuXHRcdFx0XHRcdG5leHRUd29TdWJUb2tlbnNbMF0/LnR5cGUgPT09ICdsaW5rJyAmJiBuZXh0VHdvU3ViVG9rZW5zWzFdPy50eXBlID09PSAndGV4dCcgJiYgbmV4dFR3b1N1YlRva2Vuc1sxXS5yYXcubWF0Y2goL14gKlwiW15cIl0qJC8pIHx8XG5cdFx0XHRcdFx0Ly8gQW5kIGlmIHRoZSBsaW5rIHdhcyBub3QgcGFyc2VkIGFzIGEgbGluayAoZWcgY29tbWFuZCBsaW5rKSwganVzdCBsb29rIGZvciBhIHNpbmdsZSBxdW90ZSBpbiB0aGlzIHRva2VuXG5cdFx0XHRcdFx0bGFzdExpbmUubWF0Y2goL15bXlwiXSogK1wiW15cIl0qJC8pXG5cdFx0XHRcdCkge1xuXG5cdFx0XHRcdFx0cmV0dXJuIGNvbXBsZXRlTGlua1RhcmdldEFyZyh0b2tlbik7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGNvbXBsZXRlTGlua1RhcmdldCh0b2tlbik7XG5cdFx0XHR9XG5cblx0XHRcdC8vIENvbnRhaW5zIHRoZSBzdGFydCBvZiBsaW5rIHRleHQsIGFuZCBubyBmb2xsb3dpbmcgdG9rZW5zIGNvbnRhaW4gdGhlIGxpbmsgdGFyZ2V0XG5cdFx0XHRlbHNlIGlmIChsYXN0TGluZS5tYXRjaCgvKF58XFxzKVxcW1xcdyovKSkge1xuXHRcdFx0XHRyZXR1cm4gY29tcGxldGVMaW5rVGV4dCh0b2tlbik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gaGFzTGlua1RleHRBbmRTdGFydE9mTGlua1RhcmdldChzdHI6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gISFzdHIubWF0Y2goLyhefFxccylcXFsuKlxcXVxcKFxcdyovKTtcbn1cblxuZnVuY3Rpb24gaGFzU3RhcnRPZkxpbmtUYXJnZXRBbmROb0xpbmtUZXh0KHN0cjogc3RyaW5nKTogYm9vbGVhbiB7XG5cdHJldHVybiAhIXN0ci5tYXRjaCgvXlteXFxbXSpcXF1cXChbXlxcKV0qJC8pO1xufVxuXG5mdW5jdGlvbiBjb21wbGV0ZUxpc3RJdGVtUGF0dGVybihsaXN0OiBtYXJrZWQuVG9rZW5zLkxpc3QpOiBtYXJrZWQuVG9rZW5zLkxpc3QgfCB1bmRlZmluZWQge1xuXHQvLyBQYXRjaCB1cCB0aGlzIG9uZSBsaXN0IGl0ZW1cblx0Y29uc3QgbGFzdExpc3RJdGVtID0gbGlzdC5pdGVtc1tsaXN0Lml0ZW1zLmxlbmd0aCAtIDFdO1xuXHRjb25zdCBsYXN0TGlzdFN1YlRva2VuID0gbGFzdExpc3RJdGVtLnRva2VucyA/IGxhc3RMaXN0SXRlbS50b2tlbnNbbGFzdExpc3RJdGVtLnRva2Vucy5sZW5ndGggLSAxXSA6IHVuZGVmaW5lZDtcblxuXHQvKlxuXHRFeGFtcGxlIGxpc3QgdG9rZW4gc3RydWN0dXJlczpcblxuXHRsaXN0XG5cdFx0bGlzdF9pdGVtXG5cdFx0XHR0ZXh0XG5cdFx0XHRcdHRleHRcblx0XHRcdFx0Y29kZXNwYW5cblx0XHRcdFx0bGlua1xuXHRcdGxpc3RfaXRlbVxuXHRcdFx0dGV4dFxuXHRcdFx0Y29kZSAvLyBDb21wbGV0ZSBpbmRlbnRlZCBjb2RlYmxvY2tcblx0XHRsaXN0X2l0ZW1cblx0XHRcdHRleHRcblx0XHRcdHNwYWNlXG5cdFx0XHR0ZXh0XG5cdFx0XHRcdHRleHQgLy8gSW5jb21wbGV0ZSBpbmRlbnRlZCBjb2RlYmxvY2tcblx0XHRsaXN0X2l0ZW1cblx0XHRcdHRleHRcblx0XHRcdGxpc3QgLy8gTmVzdGVkIGxpc3Rcblx0XHRcdFx0bGlzdF9pdGVtXG5cdFx0XHRcdFx0dGV4dFxuXHRcdFx0XHRcdFx0dGV4dFxuXG5cdENvbnRyYXN0IHdpdGggcGFyYWdyYXBoOlxuXHRwYXJhZ3JhcGhcblx0XHR0ZXh0XG5cdFx0Y29kZXNwYW5cblx0Ki9cblxuXHRjb25zdCBsaXN0RW5kc0luSGVhZGluZyA9IChsaXN0OiBtYXJrZWQuVG9rZW5zLkxpc3QpOiBib29sZWFuID0+IHtcblx0XHQvLyBBIGxpc3QgaXRlbSBjYW4gYmUgcmVuZGVyZWQgYXMgYSBoZWFkaW5nIGZvciBzb21lIHJlYXNvbiB3aGVuIGl0IGhhcyBhIHN1Yml0ZW0gd2hlcmUgd2UgaGF2ZW4ndCByZW5kZXJlZCB0aGUgdGV4dCB5ZXQgbGlrZSB0aGlzOlxuXHRcdC8vIDEuIGxpc3QgaXRlbVxuXHRcdC8vICAgIC1cblx0XHRjb25zdCBsYXN0SXRlbSA9IGxpc3QuaXRlbXMuYXQoLTEpO1xuXHRcdGNvbnN0IGxhc3RUb2tlbiA9IGxhc3RJdGVtPy50b2tlbnMuYXQoLTEpO1xuXHRcdHJldHVybiBsYXN0VG9rZW4/LnR5cGUgPT09ICdoZWFkaW5nJyB8fCBsYXN0VG9rZW4/LnR5cGUgPT09ICdsaXN0JyAmJiBsaXN0RW5kc0luSGVhZGluZyhsYXN0VG9rZW4gYXMgbWFya2VkLlRva2Vucy5MaXN0KTtcblx0fTtcblxuXHRsZXQgbmV3VG9rZW46IG1hcmtlZC5Ub2tlbiB8IHVuZGVmaW5lZDtcblx0aWYgKGxhc3RMaXN0U3ViVG9rZW4/LnR5cGUgPT09ICd0ZXh0JyAmJiAhKCdpblJhd0Jsb2NrJyBpbiBsYXN0TGlzdEl0ZW0pKSB7IC8vIFdoeSBkb2VzIFRhZyBoYXZlIGEgdHlwZSBvZiAndGV4dCdcblx0XHRuZXdUb2tlbiA9IGNvbXBsZXRlU2luZ2xlTGluZVBhdHRlcm4obGFzdExpc3RTdWJUb2tlbiBhcyBtYXJrZWQuVG9rZW5zLlRleHQpO1xuXHR9IGVsc2UgaWYgKGxpc3RFbmRzSW5IZWFkaW5nKGxpc3QpKSB7XG5cdFx0Y29uc3QgbmV3TGlzdCA9IG1hcmtlZC5sZXhlcihsaXN0LnJhdy50cmltKCkgKyAnICZuYnNwOycpWzBdIGFzIG1hcmtlZC5Ub2tlbnMuTGlzdDtcblx0XHRpZiAobmV3TGlzdC50eXBlICE9PSAnbGlzdCcpIHtcblx0XHRcdC8vIFNvbWV0aGluZyB3ZW50IHdyb25nXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHJldHVybiBuZXdMaXN0O1xuXHR9XG5cblx0aWYgKCFuZXdUb2tlbiB8fCBuZXdUb2tlbi50eXBlICE9PSAncGFyYWdyYXBoJykgeyAvLyAndGV4dCcgaXRlbSBpbnNpZGUgdGhlIGxpc3QgaXRlbSB0dXJucyBpbnRvIHBhcmFncmFwaFxuXHRcdC8vIE5vdGhpbmcgdG8gZml4LCBvciBub3QgYSBwYXR0ZXJuIHdlIHdlcmUgZXhwZWN0aW5nXG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgcHJldmlvdXNMaXN0SXRlbXNUZXh0ID0gbWVyZ2VSYXdUb2tlblRleHQobGlzdC5pdGVtcy5zbGljZSgwLCAtMSkpO1xuXG5cdC8vIEdyYWJiaW5nIHRoZSBgLSBgIG9yIGAxLiBgIG9yIGAqIGAgb2ZmIHRoZSBsaXN0IGl0ZW0gYmVjYXVzZSBJIGNhbid0IGZpbmQgYSBiZXR0ZXIgd2F5IHRvIGRvIHRoaXNcblx0Y29uc3QgbGFzdExpc3RJdGVtTGVhZCA9IGxhc3RMaXN0SXRlbS5yYXcubWF0Y2goL14oXFxzKigtfFxcZCtcXC58XFwqKSArKS8pPy5bMF07XG5cdGlmICghbGFzdExpc3RJdGVtTGVhZCkge1xuXHRcdC8vIElzIGJhZGx5IGZvcm1hdHRlZFxuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IG5ld0xpc3RJdGVtVGV4dCA9IGxhc3RMaXN0SXRlbUxlYWQgK1xuXHRcdG1lcmdlUmF3VG9rZW5UZXh0KGxhc3RMaXN0SXRlbS50b2tlbnMuc2xpY2UoMCwgLTEpKSArXG5cdFx0bmV3VG9rZW4ucmF3O1xuXG5cdGNvbnN0IG5ld0xpc3QgPSBtYXJrZWQubGV4ZXIocHJldmlvdXNMaXN0SXRlbXNUZXh0ICsgbmV3TGlzdEl0ZW1UZXh0KVswXSBhcyBtYXJrZWQuVG9rZW5zLkxpc3Q7XG5cdGlmIChuZXdMaXN0LnR5cGUgIT09ICdsaXN0Jykge1xuXHRcdC8vIFNvbWV0aGluZyB3ZW50IHdyb25nXG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cmV0dXJuIG5ld0xpc3Q7XG59XG5cbmNvbnN0IG1heEluY29tcGxldGVUb2tlbnNGaXhSb3VuZHMgPSAzO1xuZXhwb3J0IGZ1bmN0aW9uIGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zOiBtYXJrZWQuVG9rZW5zTGlzdCk6IG1hcmtlZC5Ub2tlbnNMaXN0IHtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBtYXhJbmNvbXBsZXRlVG9rZW5zRml4Um91bmRzOyBpKyspIHtcblx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zT25jZSh0b2tlbnMpO1xuXHRcdGlmIChuZXdUb2tlbnMpIHtcblx0XHRcdHRva2VucyA9IG5ld1Rva2Vucztcblx0XHR9IGVsc2Uge1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRva2Vucztcbn1cblxuZnVuY3Rpb24gZmlsbEluSW5jb21wbGV0ZVRva2Vuc09uY2UodG9rZW5zOiBtYXJrZWQuVG9rZW5zTGlzdCk6IG1hcmtlZC5Ub2tlbnNMaXN0IHwgbnVsbCB7XG5cdGxldCBpOiBudW1iZXI7XG5cdGxldCBuZXdUb2tlbnM6IG1hcmtlZC5Ub2tlbltdIHwgdW5kZWZpbmVkO1xuXHRmb3IgKGkgPSAwOyBpIDwgdG9rZW5zLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgdG9rZW4gPSB0b2tlbnNbaV07XG5cblx0XHRpZiAodG9rZW4udHlwZSA9PT0gJ3BhcmFncmFwaCcgJiYgdG9rZW4ucmF3Lm1hdGNoKC8oXFxufF4pXFx8LykpIHtcblx0XHRcdG5ld1Rva2VucyA9IGNvbXBsZXRlVGFibGUodG9rZW5zLnNsaWNlKGkpKTtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdGlmIChpID09PSB0b2tlbnMubGVuZ3RoIC0gMSAmJiB0b2tlbi50eXBlID09PSAnbGlzdCcpIHtcblx0XHRcdGNvbnN0IG5ld0xpc3RUb2tlbiA9IGNvbXBsZXRlTGlzdEl0ZW1QYXR0ZXJuKHRva2VuIGFzIG1hcmtlZC5Ub2tlbnMuTGlzdCk7XG5cdFx0XHRpZiAobmV3TGlzdFRva2VuKSB7XG5cdFx0XHRcdG5ld1Rva2VucyA9IFtuZXdMaXN0VG9rZW5dO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaSA9PT0gdG9rZW5zLmxlbmd0aCAtIDEgJiYgdG9rZW4udHlwZSA9PT0gJ3BhcmFncmFwaCcpIHtcblx0XHRcdC8vIE9ubHkgb3BlcmF0ZXMgb24gYSBzaW5nbGUgdG9rZW4sIGJlY2F1c2UgYW55IG5ld2xpbmUgdGhhdCBmb2xsb3dzIHRoaXMgc2hvdWxkIGJyZWFrIHRoZXNlIHBhdHRlcm5zXG5cdFx0XHRjb25zdCBuZXdUb2tlbiA9IGNvbXBsZXRlU2luZ2xlTGluZVBhdHRlcm4odG9rZW4gYXMgbWFya2VkLlRva2Vucy5QYXJhZ3JhcGgpO1xuXHRcdFx0aWYgKG5ld1Rva2VuKSB7XG5cdFx0XHRcdG5ld1Rva2VucyA9IFtuZXdUb2tlbl07XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlmIChuZXdUb2tlbnMpIHtcblx0XHRjb25zdCBuZXdUb2tlbnNMaXN0ID0gW1xuXHRcdFx0Li4udG9rZW5zLnNsaWNlKDAsIGkpLFxuXHRcdFx0Li4ubmV3VG9rZW5zXG5cdFx0XTtcblx0XHQobmV3VG9rZW5zTGlzdCBhcyBtYXJrZWQuVG9rZW5zTGlzdCkubGlua3MgPSB0b2tlbnMubGlua3M7XG5cdFx0cmV0dXJuIG5ld1Rva2Vuc0xpc3QgYXMgbWFya2VkLlRva2Vuc0xpc3Q7XG5cdH1cblxuXHRyZXR1cm4gbnVsbDtcbn1cblxuXG5mdW5jdGlvbiBjb21wbGV0ZUNvZGVzcGFuKHRva2VuOiBtYXJrZWQuVG9rZW4pOiBtYXJrZWQuVG9rZW4ge1xuXHRyZXR1cm4gY29tcGxldGVXaXRoU3RyaW5nKHRva2VuLCAnYCcpO1xufVxuXG5mdW5jdGlvbiBjb21wbGV0ZVN0YXIodG9rZW5zOiBtYXJrZWQuVG9rZW4pOiBtYXJrZWQuVG9rZW4ge1xuXHRyZXR1cm4gY29tcGxldGVXaXRoU3RyaW5nKHRva2VucywgJyonKTtcbn1cblxuZnVuY3Rpb24gY29tcGxldGVVbmRlcnNjb3JlKHRva2VuczogbWFya2VkLlRva2VuKTogbWFya2VkLlRva2VuIHtcblx0cmV0dXJuIGNvbXBsZXRlV2l0aFN0cmluZyh0b2tlbnMsICdfJyk7XG59XG5cbmZ1bmN0aW9uIGNvbXBsZXRlTGlua1RhcmdldCh0b2tlbnM6IG1hcmtlZC5Ub2tlbik6IG1hcmtlZC5Ub2tlbiB7XG5cdHJldHVybiBjb21wbGV0ZVdpdGhTdHJpbmcodG9rZW5zLCAnKScpO1xufVxuXG5mdW5jdGlvbiBjb21wbGV0ZUxpbmtUYXJnZXRBcmcodG9rZW5zOiBtYXJrZWQuVG9rZW4pOiBtYXJrZWQuVG9rZW4ge1xuXHRyZXR1cm4gY29tcGxldGVXaXRoU3RyaW5nKHRva2VucywgJ1wiKScpO1xufVxuXG5mdW5jdGlvbiBjb21wbGV0ZUxpbmtUZXh0KHRva2VuczogbWFya2VkLlRva2VuKTogbWFya2VkLlRva2VuIHtcblx0cmV0dXJuIGNvbXBsZXRlV2l0aFN0cmluZyh0b2tlbnMsICddKGh0dHBzOi8vbWljcm9zb2Z0LmNvbSknKTtcbn1cblxuZnVuY3Rpb24gY29tcGxldGVEb3VibGVzdGFyKHRva2VuczogbWFya2VkLlRva2VuKTogbWFya2VkLlRva2VuIHtcblx0cmV0dXJuIGNvbXBsZXRlV2l0aFN0cmluZyh0b2tlbnMsICcqKicpO1xufVxuXG5mdW5jdGlvbiBjb21wbGV0ZURvdWJsZVVuZGVyc2NvcmUodG9rZW5zOiBtYXJrZWQuVG9rZW4pOiBtYXJrZWQuVG9rZW4ge1xuXHRyZXR1cm4gY29tcGxldGVXaXRoU3RyaW5nKHRva2VucywgJ19fJyk7XG59XG5cbmZ1bmN0aW9uIGNvbXBsZXRlV2l0aFN0cmluZyh0b2tlbnM6IG1hcmtlZC5Ub2tlbltdIHwgbWFya2VkLlRva2VuLCBjbG9zaW5nU3RyaW5nOiBzdHJpbmcpOiBtYXJrZWQuVG9rZW4ge1xuXHRjb25zdCBtZXJnZWRSYXdUZXh0ID0gbWVyZ2VSYXdUb2tlblRleHQoQXJyYXkuaXNBcnJheSh0b2tlbnMpID8gdG9rZW5zIDogW3Rva2Vuc10pO1xuXG5cdC8vIElmIGl0IHdhcyBjb21wbGV0ZWQgY29ycmVjdGx5LCB0aGlzIHNob3VsZCBiZSBhIHNpbmdsZSB0b2tlbi5cblx0Ly8gRXhwZWN0aW5nIGVpdGhlciBhIFBhcmFncmFwaCBvciBhIExpc3Rcblx0cmV0dXJuIG1hcmtlZC5sZXhlcihtZXJnZWRSYXdUZXh0ICsgY2xvc2luZ1N0cmluZylbMF0gYXMgbWFya2VkLlRva2VuO1xufVxuXG5mdW5jdGlvbiBjb21wbGV0ZVRhYmxlKHRva2VuczogbWFya2VkLlRva2VuW10pOiBtYXJrZWQuVG9rZW5bXSB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IG1lcmdlZFJhd1RleHQgPSBtZXJnZVJhd1Rva2VuVGV4dCh0b2tlbnMpO1xuXHRjb25zdCBsaW5lcyA9IG1lcmdlZFJhd1RleHQuc3BsaXQoJ1xcbicpO1xuXG5cdGxldCBudW1Db2xzOiBudW1iZXIgfCB1bmRlZmluZWQ7IC8vIFRoZSBudW1iZXIgb2YgbGluZTEgY29sIGhlYWRlcnNcblx0bGV0IGhhc1NlcGFyYXRvclJvdyA9IGZhbHNlO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgbGluZSA9IGxpbmVzW2ldLnRyaW0oKTtcblx0XHRpZiAodHlwZW9mIG51bUNvbHMgPT09ICd1bmRlZmluZWQnICYmIGxpbmUubWF0Y2goL15cXHMqXFx8LykpIHtcblx0XHRcdGNvbnN0IGxpbmUxTWF0Y2hlcyA9IGxpbmUubWF0Y2goLyhcXHxbXlxcfF0rKSg/PVxcfHwkKS9nKTtcblx0XHRcdGlmIChsaW5lMU1hdGNoZXMpIHtcblx0XHRcdFx0bnVtQ29scyA9IGxpbmUxTWF0Y2hlcy5sZW5ndGg7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh0eXBlb2YgbnVtQ29scyA9PT0gJ251bWJlcicpIHtcblx0XHRcdGlmIChsaW5lLm1hdGNoKC9eXFxzKlxcfC8pKSB7XG5cdFx0XHRcdGlmIChpICE9PSBsaW5lcy5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdFx0Ly8gV2UgZ290IHRoZSBsaW5lMSBoZWFkZXIgcm93LCBhbmQgdGhlIGxpbmUyIHNlcGFyYXRvciByb3csIGJ1dCB0aGVyZSBhcmUgbW9yZSBsaW5lcywgYW5kIGl0IHdhc24ndCBwYXJzZWQgYXMgYSB0YWJsZSFcblx0XHRcdFx0XHQvLyBUaGF0J3Mgc3RyYW5nZSBhbmQgbWVhbnMgdGhhdCB0aGUgdGFibGUgaXMgcHJvYmFibHkgbWFsZm9ybWVkIGluIHRoZSBzb3VyY2UsIHNvIEkgd29uJ3QgdHJ5IHRvIHBhdGNoIGl0IHVwLlxuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBHb3QgYSBsaW5lMiBzZXBhcmF0b3Igcm93LSBwYXJ0aWFsIG9yIGNvbXBsZXRlLCBkb2Vzbid0IG1hdHRlciwgd2UnbGwgcmVwbGFjZSBpdCB3aXRoIGEgY29ycmVjdCBvbmVcblx0XHRcdFx0aGFzU2VwYXJhdG9yUm93ID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFRoZSBsaW5lIGFmdGVyIHRoZSBoZWFkZXIgcm93IGlzbid0IGEgdmFsaWQgc2VwYXJhdG9yIHJvdywgc28gdGhlIHRhYmxlIGlzIG1hbGZvcm1lZCwgZG9uJ3QgZml4IGl0IHVwXG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aWYgKHR5cGVvZiBudW1Db2xzID09PSAnbnVtYmVyJyAmJiBudW1Db2xzID4gMCkge1xuXHRcdGNvbnN0IHByZWZpeFRleHQgPSBoYXNTZXBhcmF0b3JSb3cgPyBsaW5lcy5zbGljZSgwLCAtMSkuam9pbignXFxuJykgOiBtZXJnZWRSYXdUZXh0O1xuXHRcdGNvbnN0IGxpbmUxRW5kc0luUGlwZSA9ICEhcHJlZml4VGV4dC5tYXRjaCgvXFx8XFxzKiQvKTtcblx0XHRjb25zdCBuZXdSYXdUZXh0ID0gcHJlZml4VGV4dCArIChsaW5lMUVuZHNJblBpcGUgPyAnJyA6ICd8JykgKyBgXFxufCR7JyAtLS0gfCcucmVwZWF0KG51bUNvbHMpfWA7XG5cdFx0cmV0dXJuIG1hcmtlZC5sZXhlcihuZXdSYXdUZXh0KTtcblx0fVxuXG5cdHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGFkZERvbXB1cmlmeUhvb2soXG5cdGhvb2s6ICd1cG9uU2FuaXRpemVFbGVtZW50Jyxcblx0Y2I6IChjdXJyZW50Tm9kZTogRWxlbWVudCwgZGF0YTogZG9tcHVyaWZ5LlNhbml0aXplRWxlbWVudEhvb2tFdmVudCwgY29uZmlnOiBkb21wdXJpZnkuQ29uZmlnKSA9PiB2b2lkLFxuKTogSURpc3Bvc2FibGU7XG5mdW5jdGlvbiBhZGREb21wdXJpZnlIb29rKFxuXHRob29rOiAndXBvblNhbml0aXplQXR0cmlidXRlJyxcblx0Y2I6IChjdXJyZW50Tm9kZTogRWxlbWVudCwgZGF0YTogZG9tcHVyaWZ5LlNhbml0aXplQXR0cmlidXRlSG9va0V2ZW50LCBjb25maWc6IGRvbXB1cmlmeS5Db25maWcpID0+IHZvaWQsXG4pOiBJRGlzcG9zYWJsZTtcbmZ1bmN0aW9uIGFkZERvbXB1cmlmeUhvb2soaG9vazogJ3Vwb25TYW5pdGl6ZUVsZW1lbnQnIHwgJ3Vwb25TYW5pdGl6ZUF0dHJpYnV0ZScsIGNiOiBhbnkpOiBJRGlzcG9zYWJsZSB7XG5cdGRvbXB1cmlmeS5hZGRIb29rKGhvb2ssIGNiKTtcblx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiBkb21wdXJpZnkucmVtb3ZlSG9vayhob29rKSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGFBQWE7QUFDdEIsU0FBUyxvQkFBcUMsa0JBQWdELHdCQUF3Qiw2QkFBNkI7QUFDbkosU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWTtBQUNyQixTQUFTLGlCQUE4QixvQkFBb0I7QUFDM0QsWUFBWSxZQUFZO0FBQ3hCLFNBQVMsYUFBYTtBQUN0QixTQUFTLFlBQVksZUFBZTtBQUNwQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFNBQVMsbUJBQW1CO0FBQ3JDLFNBQVMsY0FBYztBQUN2QixTQUFTLFdB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bUIsUUFBUSxHQUFHO0FBQ3RDO0FBRUEsU0FBUyxzQkFBc0IsUUFBb0M7QUFDbEUsU0FBTyxtQkFBbUIsUUFBUSxJQUFJO0FBQ3ZDO0FBRUEsU0FBUyxpQkFBaUIsUUFBb0M7QUFDN0QsU0FBTyxtQkFBbUIsUUFBUSwwQkFBMEI7QUFDN0Q7QUFFQSxTQUFTLG1CQUFtQixRQUFvQztBQUMvRCxTQUFPLG1CQUFtQixRQUFRLElBQUk7QUFDdkM7QUFFQSxTQUFTLHlCQUF5QixRQUFvQztBQUNyRSxTQUFPLG1CQUFtQixRQUFRLElBQUk7QUFDdkM7QUFFQSxTQUFTLG1CQUFtQixRQUF1QyxlQUFxQztBQUN2RyxRQUFNLGdCQUFnQixrQkFBa0IsTUFBTSxRQUFRLE1BQU0sSUFBSSxTQUFTLENBQUMsTUFBTSxDQUFDO0FBSWpGLFNBQU8sT0FBTyxNQUFNLGdCQUFnQixhQUFhLEVBQUUsQ0FBQztBQUNyRDtBQUVBLFNBQVMsY0FBYyxRQUFvRDtBQUMxRSxRQUFNLGdCQUFnQixrQkFBa0IsTUFBTTtBQUM5QyxRQUFNLFFBQVEsY0FBYyxNQUFNLElBQUk7QUFFdEMsTUFBSTtBQUNKLE1BQUksa0JBQWtCO0FBQ3RCLFdBQVMsSUFBSSxHQUFHLElBQUksTUFBTSxRQUFRLEtBQUs7QUFDdEMsVUFBTSxPQUFPLE1BQU0sQ0FBQyxFQUFFLEtBQUs7QUFDM0IsUUFBSSxPQUFPLFlBQVksZUFBZSxLQUFLLE1BQU0sUUFBUSxHQUFHO0FBQzNELFlBQU0sZUFBZSxLQUFLLE1BQU0scUJBQXFCO0FBQ3JELFVBQUksY0FBYztBQUNqQixrQkFBVSxhQUFhO0FBQUEsTUFDeEI7QUFBQSxJQUNELFdBQVcsT0FBTyxZQUFZLFVBQVU7QUFDdkMsVUFBSSxLQUFLLE1BQU0sUUFBUSxHQUFHO0FBQ3pCLFlBQUksTUFBTSxNQUFNLFNBQVMsR0FBRztBQUczQixpQkFBTztBQUFBLFFBQ1I7QUFHQSwwQkFBa0I7QUFBQSxNQUNuQixPQUFPO0FBRU4sZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLE1BQUksT0FBTyxZQUFZLFlBQVksVUFBVSxHQUFHO0FBQy9DLFVBQU0sYUFBYSxrQkFBa0IsTUFBTSxNQUFNLEdBQUcsRUFBRSxFQUFFLEtBQUssSUFBSSxJQUFJO0FBQ3JFLFVBQU0sa0JBQWtCLENBQUMsQ0FBQyxXQUFXLE1BQU0sUUFBUTtBQUNuRCxVQUFNLGFBQWEsY0FBYyxrQkFBa0IsS0FBSyxPQUFPO0FBQUEsR0FBTSxTQUFTLE9BQU8sT0FBTyxDQUFDO0FBQzdGLFdBQU8sT0FBTyxNQUFNLFVBQVU7QUFBQSxFQUMvQjtBQUVBLFNBQU87QUFDUjtBQVVBLFNBQVMsaUJBQWlCLE1BQXVELElBQXNCO0FBQ3RHLFlBQVUsUUFBUSxNQUFNLEVBQUU7QUFDMUIsU0FBTyxhQUFhLE1BQU0sVUFBVSxXQUFXLElBQUksQ0FBQztBQUNyRDsiLAogICJuYW1lcyI6IFsibGlzdCIsICJuZXdMaXN0Il0KfQo=
