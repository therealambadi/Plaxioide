import { basicMarkupHtmlTags, hookDomPurifyHrefAndSrcSanitizer } from "../../../../base/browser/dom.js";
import dompurify from "../../../../base/browser/dompurify/dompurify.js";
import { allowedMarkdownAttr } from "../../../../base/browser/markdownRenderer.js";
import * as marked from "../../../../base/common/marked/marked.js";
import { Schemas } from "../../../../base/common/network.js";
import { escape } from "../../../../base/common/strings.js";
import { tokenizeToString } from "../../../../editor/common/languages/textToHtmlTokenizer.js";
import { markedGfmHeadingIdPlugin } from "./markedGfmHeadingIdPlugin.js";
const DEFAULT_MARKDOWN_STYLES = `
body {
	padding: 10px 20px;
	line-height: 22px;
	max-width: 882px;
	margin: 0 auto;
}

body *:last-child {
	margin-bottom: 0;
}

img {
	max-width: 100%;
	max-height: 100%;
}

a {
	text-decoration: var(--text-link-decoration);
}

a:hover {
	text-decoration: underline;
}

a:focus,
input:focus,
select:focus,
textarea:focus {
	outline: 1px solid -webkit-focus-ring-color;
	outline-offset: -1px;
}

hr {
	border: 0;
	height: 2px;
	border-bottom: 2px solid;
}

h1 {
	padding-bottom: 0.3em;
	line-height: 1.2;
	border-bottom-width: 1px;
	border-bottom-style: solid;
}

h1, h2, h3 {
	font-weight: normal;
}

table {
	border-collapse: collapse;
}

th {
	text-align: left;
	border-bottom: 1px solid;
}

th,
td {
	padding: 5px 10px;
}

table > tbody > tr + tr > td {
	border-top-width: 1px;
	border-top-style: solid;
}

blockquote {
	margin: 0 7px 0 5px;
	padding: 0 16px 0 10px;
	border-left-width: 5px;
	border-left-style: solid;
}

code {
	font-family: "SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace;
}

pre {
	padding: 16px;
	border-radius: 3px;
	overflow: auto;
}

pre code {
	font-family: var(--vscode-editor-font-family);
	font-weight: var(--vscode-editor-font-weight);
	font-size: var(--vscode-editor-font-size);
	line-height: 1.5;
	color: var(--vscode-editor-foreground);
	tab-size: 4;
}

.monaco-tokenized-source {
	white-space: pre;
}

/** Theming */

.pre {
	background-color: var(--vscode-textCodeBlock-background);
}

.vscode-high-contrast h1 {
	border-color: rgb(0, 0, 0);
}

.vscode-light th {
	border-color: rgba(0, 0, 0, 0.69);
}

.vscode-dark th {
	border-color: rgba(255, 255, 255, 0.69);
}

.vscode-light h1,
.vscode-light hr,
.vscode-light td {
	border-color: rgba(0, 0, 0, 0.18);
}

.vscode-dark h1,
.vscode-dark hr,
.vscode-dark td {
	border-color: rgba(255, 255, 255, 0.18);
}

@media (forced-colors: active) and (prefers-color-scheme: light){
	body {
		forced-color-adjust: none;
	}
}

@media (forced-colors: active) and (prefers-color-scheme: dark){
	body {
		forced-color-adjust: none;
	}
}
`;
const allowedProtocols = [Schemas.http, Schemas.https, Schemas.command];
function sanitize(documentContent, allowUnknownProtocols) {
  const hook = hookDomPurifyHrefAndSrcSanitizer(allowedProtocols, true);
  try {
    return dompurify.sanitize(documentContent, {
      ...{
        ALLOWED_TAGS: [
          ...basicMarkupHtmlTags,
          "checkbox",
          "checklist"
        ],
        ALLOWED_ATTR: [
          ...allowedMarkdownAttr,
          "data-command",
          "name",
          "id",
          "role",
          "tabindex",
          "x-dispatch",
          "required",
          "checked",
          "placeholder",
          "when-checked",
          "checked-on"
        ]
      },
      ...allowUnknownProtocols ? { ALLOW_UNKNOWN_PROTOCOLS: true } : {}
    });
  } finally {
    hook.dispose();
  }
}
async function renderMarkdownDocument(text, extensionService, languageService, options) {
  const m = new marked.Marked(
    MarkedHighlight.markedHighlight({
      async: true,
      async highlight(code, lang) {
        if (typeof lang !== "string") {
          return escape(code);
        }
        await extensionService.whenInstalledExtensionsRegistered();
        if (options?.token?.isCancellationRequested) {
          return "";
        }
        const languageId = languageService.getLanguageIdByLanguageName(lang) ?? languageService.getLanguageIdByLanguageName(lang.split(/\s+|:|,|(?!^)\{|\?]/, 1)[0]);
        return tokenizeToString(languageService, code, languageId);
      }
    }),
    markedGfmHeadingIdPlugin(),
    ...options?.markedExtensions ?? []
  );
  const raw = await m.parse(text, { async: true });
  if (options?.shouldSanitize ?? true) {
    return sanitize(raw, options?.allowUnknownProtocols ?? false);
  } else {
    return raw;
  }
}
var MarkedHighlight;
((MarkedHighlight2) => {
  function markedHighlight(options) {
    if (typeof options === "function") {
      options = {
        highlight: options
      };
    }
    if (!options || typeof options.highlight !== "function") {
      throw new Error("Must provide highlight function");
    }
    return {
      async: !!options.async,
      walkTokens(token) {
        if (token.type !== "code") {
          return;
        }
        if (options.async) {
          return Promise.resolve(options.highlight(token.text, token.lang)).then(updateToken(token));
        }
        const code = options.highlight(token.text, token.lang);
        if (code instanceof Promise) {
          throw new Error("markedHighlight is not set to async but the highlight function is async. Set the async option to true on markedHighlight to await the async highlight function.");
        }
        updateToken(token)(code);
      },
      renderer: {
        code({ text, lang, escaped }) {
          const classAttr = lang ? ` class="language-${escape2(lang)}"` : "";
          text = text.replace(/\n$/, "");
          return `<pre><code${classAttr}>${escaped ? text : escape2(text, true)}
</code></pre>`;
        }
      }
    };
  }
  MarkedHighlight2.markedHighlight = markedHighlight;
  function updateToken(token) {
    return (code) => {
      if (typeof code === "string" && code !== token.text) {
        token.escaped = true;
        token.text = code;
      }
    };
  }
  const escapeTest = /[&<>"']/;
  const escapeReplace = new RegExp(escapeTest.source, "g");
  const escapeTestNoEncode = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/;
  const escapeReplaceNoEncode = new RegExp(escapeTestNoEncode.source, "g");
  const escapeReplacement = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    [`'`]: "&#39;"
  };
  const getEscapeReplacement = (ch) => escapeReplacement[ch];
  function escape2(html, encode) {
    if (encode) {
      if (escapeTest.test(html)) {
        return html.replace(escapeReplace, getEscapeReplacement);
      }
    } else {
      if (escapeTestNoEncode.test(html)) {
        return html.replace(escapeReplaceNoEncode, getEscapeReplacement);
      }
    }
    return html;
  }
})(MarkedHighlight || (MarkedHighlight = {}));
export {
  DEFAULT_MARKDOWN_STYLES,
  renderMarkdownDocument
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tYXJrZG93bi9icm93c2VyL21hcmtkb3duRG9jdW1lbnRSZW5kZXJlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGJhc2ljTWFya3VwSHRtbFRhZ3MsIGhvb2tEb21QdXJpZnlIcmVmQW5kU3JjU2FuaXRpemVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgZG9tcHVyaWZ5IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb21wdXJpZnkvZG9tcHVyaWZ5LmpzJztcbmltcG9ydCB7IGFsbG93ZWRNYXJrZG93bkF0dHIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgKiBhcyBtYXJrZWQgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFya2VkL21hcmtlZC5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBlc2NhcGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyB0b2tlbml6ZVRvU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvdGV4dFRvSHRtbFRva2VuaXplci5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgbWFya2VkR2ZtSGVhZGluZ0lkUGx1Z2luIH0gZnJvbSAnLi9tYXJrZWRHZm1IZWFkaW5nSWRQbHVnaW4uanMnO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9NQVJLRE9XTl9TVFlMRVMgPSBgXG5ib2R5IHtcblx0cGFkZGluZzogMTBweCAyMHB4O1xuXHRsaW5lLWhlaWdodDogMjJweDtcblx0bWF4LXdpZHRoOiA4ODJweDtcblx0bWFyZ2luOiAwIGF1dG87XG59XG5cbmJvZHkgKjpsYXN0LWNoaWxkIHtcblx0bWFyZ2luLWJvdHRvbTogMDtcbn1cblxuaW1nIHtcblx0bWF4LXdpZHRoOiAxMDAlO1xuXHRtYXgtaGVpZ2h0OiAxMDAlO1xufVxuXG5hIHtcblx0dGV4dC1kZWNvcmF0aW9uOiB2YXIoLS10ZXh0LWxpbmstZGVjb3JhdGlvbik7XG59XG5cbmE6aG92ZXIge1xuXHR0ZXh0LWRlY29yYXRpb246IHVuZGVybGluZTtcbn1cblxuYTpmb2N1cyxcbmlucHV0OmZvY3VzLFxuc2VsZWN0OmZvY3VzLFxudGV4dGFyZWE6Zm9jdXMge1xuXHRvdXRsaW5lOiAxcHggc29saWQgLXdlYmtpdC1mb2N1cy1yaW5nLWNvbG9yO1xuXHRvdXRsaW5lLW9mZnNldDogLTFweDtcbn1cblxuaHIge1xuXHRib3JkZXI6IDA7XG5cdGhlaWdodDogMnB4O1xuXHRib3JkZXItYm90dG9tOiAycHggc29saWQ7XG59XG5cbmgxIHtcblx0cGFkZGluZy1ib3R0b206IDAuM2VtO1xuXHRsaW5lLWhlaWdodDogMS4yO1xuXHRib3JkZXItYm90dG9tLXdpZHRoOiAxcHg7XG5cdGJvcmRlci1ib3R0b20tc3R5bGU6IHNvbGlkO1xufVxuXG5oMSwgaDIsIGgzIHtcblx0Zm9udC13ZWlnaHQ6IG5vcm1hbDtcbn1cblxudGFibGUge1xuXHRib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlO1xufVxuXG50aCB7XG5cdHRleHQtYWxpZ246IGxlZnQ7XG5cdGJvcmRlci1ib3R0b206IDFweCBzb2xpZDtcbn1cblxudGgsXG50ZCB7XG5cdHBhZGRpbmc6IDVweCAxMHB4O1xufVxuXG50YWJsZSA+IHRib2R5ID4gdHIgKyB0ciA+IHRkIHtcblx0Ym9yZGVyLXRvcC13aWR0aDogMXB4O1xuXHRib3JkZXItdG9wLXN0eWxlOiBzb2xpZDtcbn1cblxuYmxvY2txdW90ZSB7XG5cdG1hcmdpbjogMCA3cHggMCA1cHg7XG5cdHBhZGRpbmc6IDAgMTZweCAwIDEwcHg7XG5cdGJvcmRlci1sZWZ0LXdpZHRoOiA1cHg7XG5cdGJvcmRlci1sZWZ0LXN0eWxlOiBzb2xpZDtcbn1cblxuY29kZSB7XG5cdGZvbnQtZmFtaWx5OiBcIlNGIE1vbm9cIiwgTW9uYWNvLCBNZW5sbywgQ29uc29sYXMsIFwiVWJ1bnR1IE1vbm9cIiwgXCJMaWJlcmF0aW9uIE1vbm9cIiwgXCJEZWphVnUgU2FucyBNb25vXCIsIFwiQ291cmllciBOZXdcIiwgbW9ub3NwYWNlO1xufVxuXG5wcmUge1xuXHRwYWRkaW5nOiAxNnB4O1xuXHRib3JkZXItcmFkaXVzOiAzcHg7XG5cdG92ZXJmbG93OiBhdXRvO1xufVxuXG5wcmUgY29kZSB7XG5cdGZvbnQtZmFtaWx5OiB2YXIoLS12c2NvZGUtZWRpdG9yLWZvbnQtZmFtaWx5KTtcblx0Zm9udC13ZWlnaHQ6IHZhcigtLXZzY29kZS1lZGl0b3ItZm9udC13ZWlnaHQpO1xuXHRmb250LXNpemU6IHZhcigtLXZzY29kZS1lZGl0b3ItZm9udC1zaXplKTtcblx0bGluZS1oZWlnaHQ6IDEuNTtcblx0Y29sb3I6IHZhcigtLXZzY29kZS1lZGl0b3ItZm9yZWdyb3VuZCk7XG5cdHRhYi1zaXplOiA0O1xufVxuXG4ubW9uYWNvLXRva2VuaXplZC1zb3VyY2Uge1xuXHR3aGl0ZS1zcGFjZTogcHJlO1xufVxuXG4vKiogVGhlbWluZyAqL1xuXG4ucHJlIHtcblx0YmFja2dyb3VuZC1jb2xvcjogdmFyKC0tdnNjb2RlLXRleHRDb2RlQmxvY2stYmFja2dyb3VuZCk7XG59XG5cbi52c2NvZGUtaGlnaC1jb250cmFzdCBoMSB7XG5cdGJvcmRlci1jb2xvcjogcmdiKDAsIDAsIDApO1xufVxuXG4udnNjb2RlLWxpZ2h0IHRoIHtcblx0Ym9yZGVyLWNvbG9yOiByZ2JhKDAsIDAsIDAsIDAuNjkpO1xufVxuXG4udnNjb2RlLWRhcmsgdGgge1xuXHRib3JkZXItY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC42OSk7XG59XG5cbi52c2NvZGUtbGlnaHQgaDEsXG4udnNjb2RlLWxpZ2h0IGhyLFxuLnZzY29kZS1saWdodCB0ZCB7XG5cdGJvcmRlci1jb2xvcjogcmdiYSgwLCAwLCAwLCAwLjE4KTtcbn1cblxuLnZzY29kZS1kYXJrIGgxLFxuLnZzY29kZS1kYXJrIGhyLFxuLnZzY29kZS1kYXJrIHRkIHtcblx0Ym9yZGVyLWNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMTgpO1xufVxuXG5AbWVkaWEgKGZvcmNlZC1jb2xvcnM6IGFjdGl2ZSkgYW5kIChwcmVmZXJzLWNvbG9yLXNjaGVtZTogbGlnaHQpe1xuXHRib2R5IHtcblx0XHRmb3JjZWQtY29sb3ItYWRqdXN0OiBub25lO1xuXHR9XG59XG5cbkBtZWRpYSAoZm9yY2VkLWNvbG9yczogYWN0aXZlKSBhbmQgKHByZWZlcnMtY29sb3Itc2NoZW1lOiBkYXJrKXtcblx0Ym9keSB7XG5cdFx0Zm9yY2VkLWNvbG9yLWFkanVzdDogbm9uZTtcblx0fVxufVxuYDtcblxuY29uc3QgYWxsb3dlZFByb3RvY29scyA9IFtTY2hlbWFzLmh0dHAsIFNjaGVtYXMuaHR0cHMsIFNjaGVtYXMuY29tbWFuZF07XG5mdW5jdGlvbiBzYW5pdGl6ZShkb2N1bWVudENvbnRlbnQ6IHN0cmluZywgYWxsb3dVbmtub3duUHJvdG9jb2xzOiBib29sZWFuKTogc3RyaW5nIHtcblxuXHRjb25zdCBob29rID0gaG9va0RvbVB1cmlmeUhyZWZBbmRTcmNTYW5pdGl6ZXIoYWxsb3dlZFByb3RvY29scywgdHJ1ZSk7XG5cblx0dHJ5IHtcblx0XHRyZXR1cm4gZG9tcHVyaWZ5LnNhbml0aXplKGRvY3VtZW50Q29udGVudCwge1xuXHRcdFx0Li4ue1xuXHRcdFx0XHRBTExPV0VEX1RBR1M6IFtcblx0XHRcdFx0XHQuLi5iYXNpY01hcmt1cEh0bWxUYWdzLFxuXHRcdFx0XHRcdCdjaGVja2JveCcsXG5cdFx0XHRcdFx0J2NoZWNrbGlzdCcsXG5cdFx0XHRcdF0sXG5cdFx0XHRcdEFMTE9XRURfQVRUUjogW1xuXHRcdFx0XHRcdC4uLmFsbG93ZWRNYXJrZG93bkF0dHIsXG5cdFx0XHRcdFx0J2RhdGEtY29tbWFuZCcsICduYW1lJywgJ2lkJywgJ3JvbGUnLCAndGFiaW5kZXgnLFxuXHRcdFx0XHRcdCd4LWRpc3BhdGNoJyxcblx0XHRcdFx0XHQncmVxdWlyZWQnLCAnY2hlY2tlZCcsICdwbGFjZWhvbGRlcicsICd3aGVuLWNoZWNrZWQnLCAnY2hlY2tlZC1vbicsXG5cdFx0XHRcdF0sXG5cdFx0XHR9LFxuXHRcdFx0Li4uKGFsbG93VW5rbm93blByb3RvY29scyA/IHsgQUxMT1dfVU5LTk9XTl9QUk9UT0NPTFM6IHRydWUgfSA6IHt9KSxcblx0XHR9KTtcblx0fSBmaW5hbGx5IHtcblx0XHRob29rLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5pbnRlcmZhY2UgSVJlbmRlck1hcmtkb3duRG9jdW1lbnRPcHRpb25zIHtcblx0cmVhZG9ubHkgc2hvdWxkU2FuaXRpemU/OiBib29sZWFuO1xuXHRyZWFkb25seSBhbGxvd1Vua25vd25Qcm90b2NvbHM/OiBib29sZWFuO1xuXHRyZWFkb25seSBtYXJrZWRFeHRlbnNpb25zPzogbWFya2VkLk1hcmtlZEV4dGVuc2lvbltdO1xuXHRyZWFkb25seSB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuO1xufVxuXG4vKipcbiAqIFJlbmRlcnMgYSBzdHJpbmcgb2YgbWFya2Rvd24gYXMgYSBkb2N1bWVudC5cbiAqXG4gKiBVc2VzIFZTIENvZGUncyBzeW50YXggaGlnaGxpZ2h0aW5nIGNvZGUgYmxvY2tzLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVuZGVyTWFya2Rvd25Eb2N1bWVudChcblx0dGV4dDogc3RyaW5nLFxuXHRleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0bGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRvcHRpb25zPzogSVJlbmRlck1hcmtkb3duRG9jdW1lbnRPcHRpb25zXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuXHRjb25zdCBtID0gbmV3IG1hcmtlZC5NYXJrZWQoXG5cdFx0TWFya2VkSGlnaGxpZ2h0Lm1hcmtlZEhpZ2hsaWdodCh7XG5cdFx0XHRhc3luYzogdHJ1ZSxcblx0XHRcdGFzeW5jIGhpZ2hsaWdodChjb2RlOiBzdHJpbmcsIGxhbmc6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0XHRcdGlmICh0eXBlb2YgbGFuZyAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRyZXR1cm4gZXNjYXBlKGNvZGUpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YXdhaXQgZXh0ZW5zaW9uU2VydmljZS53aGVuSW5zdGFsbGVkRXh0ZW5zaW9uc1JlZ2lzdGVyZWQoKTtcblx0XHRcdFx0aWYgKG9wdGlvbnM/LnRva2VuPy5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHJldHVybiAnJztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGxhbmd1YWdlSWQgPSBsYW5ndWFnZVNlcnZpY2UuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKGxhbmcpID8/IGxhbmd1YWdlU2VydmljZS5nZXRMYW5ndWFnZUlkQnlMYW5ndWFnZU5hbWUobGFuZy5zcGxpdCgvXFxzK3w6fCx8KD8hXilcXHt8XFw/XS8sIDEpWzBdKTtcblx0XHRcdFx0cmV0dXJuIHRva2VuaXplVG9TdHJpbmcobGFuZ3VhZ2VTZXJ2aWNlLCBjb2RlLCBsYW5ndWFnZUlkKTtcblx0XHRcdH1cblx0XHR9KSxcblx0XHRtYXJrZWRHZm1IZWFkaW5nSWRQbHVnaW4oKSxcblx0XHQuLi4ob3B0aW9ucz8ubWFya2VkRXh0ZW5zaW9ucyA/PyBbXSksXG5cdCk7XG5cblx0Y29uc3QgcmF3ID0gYXdhaXQgbS5wYXJzZSh0ZXh0LCB7IGFzeW5jOiB0cnVlIH0pO1xuXHRpZiAob3B0aW9ucz8uc2hvdWxkU2FuaXRpemUgPz8gdHJ1ZSkge1xuXHRcdHJldHVybiBzYW5pdGl6ZShyYXcsIG9wdGlvbnM/LmFsbG93VW5rbm93blByb3RvY29scyA/PyBmYWxzZSk7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIHJhdztcblx0fVxufVxuXG5uYW1lc3BhY2UgTWFya2VkSGlnaGxpZ2h0IHtcblx0Ly8gQ29waWVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL21hcmtlZGpzL21hcmtlZC1oaWdobGlnaHQvYmxvYi9tYWluL3NyYy9pbmRleC5qc1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBtYXJrZWRIaWdobGlnaHQob3B0aW9uczogbWFya2VkLk1hcmtlZE9wdGlvbnMgJiB7IGhpZ2hsaWdodDogKGNvZGU6IHN0cmluZywgbGFuZzogc3RyaW5nKSA9PiBzdHJpbmcgfCBQcm9taXNlPHN0cmluZz4gfSk6IG1hcmtlZC5NYXJrZWRFeHRlbnNpb24ge1xuXHRcdGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0b3B0aW9ucyA9IHtcblx0XHRcdFx0aGlnaGxpZ2h0OiBvcHRpb25zLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoIW9wdGlvbnMgfHwgdHlwZW9mIG9wdGlvbnMuaGlnaGxpZ2h0ICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ011c3QgcHJvdmlkZSBoaWdobGlnaHQgZnVuY3Rpb24nKTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0YXN5bmM6ICEhb3B0aW9ucy5hc3luYyxcblx0XHRcdHdhbGtUb2tlbnModG9rZW46IG1hcmtlZC5Ub2tlbik6IFByb21pc2U8dm9pZD4gfCB2b2lkIHtcblx0XHRcdFx0aWYgKHRva2VuLnR5cGUgIT09ICdjb2RlJykge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChvcHRpb25zLmFzeW5jKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShvcHRpb25zLmhpZ2hsaWdodCh0b2tlbi50ZXh0LCB0b2tlbi5sYW5nKSkudGhlbih1cGRhdGVUb2tlbih0b2tlbikpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgY29kZSA9IG9wdGlvbnMuaGlnaGxpZ2h0KHRva2VuLnRleHQsIHRva2VuLmxhbmcpO1xuXHRcdFx0XHRpZiAoY29kZSBpbnN0YW5jZW9mIFByb21pc2UpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ21hcmtlZEhpZ2hsaWdodCBpcyBub3Qgc2V0IHRvIGFzeW5jIGJ1dCB0aGUgaGlnaGxpZ2h0IGZ1bmN0aW9uIGlzIGFzeW5jLiBTZXQgdGhlIGFzeW5jIG9wdGlvbiB0byB0cnVlIG9uIG1hcmtlZEhpZ2hsaWdodCB0byBhd2FpdCB0aGUgYXN5bmMgaGlnaGxpZ2h0IGZ1bmN0aW9uLicpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHVwZGF0ZVRva2VuKHRva2VuKShjb2RlKTtcblx0XHRcdH0sXG5cdFx0XHRyZW5kZXJlcjoge1xuXHRcdFx0XHRjb2RlKHsgdGV4dCwgbGFuZywgZXNjYXBlZCB9OiBtYXJrZWQuVG9rZW5zLkNvZGUpIHtcblx0XHRcdFx0XHRjb25zdCBjbGFzc0F0dHIgPSBsYW5nXG5cdFx0XHRcdFx0XHQ/IGAgY2xhc3M9XCJsYW5ndWFnZS0ke2VzY2FwZShsYW5nKX1cImBcblx0XHRcdFx0XHRcdDogJyc7XG5cdFx0XHRcdFx0dGV4dCA9IHRleHQucmVwbGFjZSgvXFxuJC8sICcnKTtcblx0XHRcdFx0XHRyZXR1cm4gYDxwcmU+PGNvZGUke2NsYXNzQXR0cn0+JHtlc2NhcGVkID8gdGV4dCA6IGVzY2FwZSh0ZXh0LCB0cnVlKX1cXG48L2NvZGU+PC9wcmU+YDtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIHVwZGF0ZVRva2VuKHRva2VuOiBhbnkpIHtcblx0XHRyZXR1cm4gKGNvZGU6IHN0cmluZykgPT4ge1xuXHRcdFx0aWYgKHR5cGVvZiBjb2RlID09PSAnc3RyaW5nJyAmJiBjb2RlICE9PSB0b2tlbi50ZXh0KSB7XG5cdFx0XHRcdHRva2VuLmVzY2FwZWQgPSB0cnVlO1xuXHRcdFx0XHR0b2tlbi50ZXh0ID0gY29kZTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0Ly8gY29waWVkIGZyb20gbWFya2VkIGhlbHBlcnNcblx0Y29uc3QgZXNjYXBlVGVzdCA9IC9bJjw+XCInXS87XG5cdGNvbnN0IGVzY2FwZVJlcGxhY2UgPSBuZXcgUmVnRXhwKGVzY2FwZVRlc3Quc291cmNlLCAnZycpO1xuXHRjb25zdCBlc2NhcGVUZXN0Tm9FbmNvZGUgPSAvWzw+XCInXXwmKD8hKCNcXGR7MSw3fXwjW1h4XVthLWZBLUYwLTldezEsNn18XFx3Kyk7KS87XG5cdGNvbnN0IGVzY2FwZVJlcGxhY2VOb0VuY29kZSA9IG5ldyBSZWdFeHAoZXNjYXBlVGVzdE5vRW5jb2RlLnNvdXJjZSwgJ2cnKTtcblx0Y29uc3QgZXNjYXBlUmVwbGFjZW1lbnQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG5cdFx0JyYnOiAnJmFtcDsnLFxuXHRcdCc8JzogJyZsdDsnLFxuXHRcdCc+JzogJyZndDsnLFxuXHRcdCdcIic6ICcmcXVvdDsnLFxuXHRcdFtgJ2BdOiAnJiMzOTsnLFxuXHR9O1xuXHRjb25zdCBnZXRFc2NhcGVSZXBsYWNlbWVudCA9IChjaDogc3RyaW5nKSA9PiBlc2NhcGVSZXBsYWNlbWVudFtjaF07XG5cdGZ1bmN0aW9uIGVzY2FwZShodG1sOiBzdHJpbmcsIGVuY29kZT86IGJvb2xlYW4pIHtcblx0XHRpZiAoZW5jb2RlKSB7XG5cdFx0XHRpZiAoZXNjYXBlVGVzdC50ZXN0KGh0bWwpKSB7XG5cdFx0XHRcdHJldHVybiBodG1sLnJlcGxhY2UoZXNjYXBlUmVwbGFjZSwgZ2V0RXNjYXBlUmVwbGFjZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoZXNjYXBlVGVzdE5vRW5jb2RlLnRlc3QoaHRtbCkpIHtcblx0XHRcdFx0cmV0dXJuIGh0bWwucmVwbGFjZShlc2NhcGVSZXBsYWNlTm9FbmNvZGUsIGdldEVzY2FwZVJlcGxhY2VtZW50KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gaHRtbDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxxQkFBcUIsd0NBQXdDO0FBQ3RFLE9BQU8sZUFBZTtBQUN0QixTQUFTLDJCQUEyQjtBQUVwQyxZQUFZLFlBQVk7QUFDeEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsY0FBYztBQUV2QixTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLGdDQUFnQztBQUVsQyxNQUFNLDBCQUEwQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUE4SXZDLE1BQU0sbUJBQW1CLENBQUMsUUFBUSxNQUFNLFFBQVEsT0FBTyxRQUFRLE9BQU87QUFDdEUsU0FBUyxTQUFTLGlCQUF5Qix1QkFBd0M7QUFFbEYsUUFBTSxPQUFPLGlDQUFpQyxrQkFBa0IsSUFBSTtBQUVwRSxNQUFJO0FBQ0gsV0FBTyxVQUFVLFNBQVMsaUJBQWlCO0FBQUEsTUFDMUMsR0FBRztBQUFBLFFBQ0YsY0FBYztBQUFBLFVBQ2IsR0FBRztBQUFBLFVBQ0g7QUFBQSxVQUNBO0FBQUEsUUFDRDtBQUFBLFFBQ0EsY0FBYztBQUFBLFVBQ2IsR0FBRztBQUFBLFVBQ0g7QUFBQSxVQUFnQjtBQUFBLFVBQVE7QUFBQSxVQUFNO0FBQUEsVUFBUTtBQUFBLFVBQ3RDO0FBQUEsVUFDQTtBQUFBLFVBQVk7QUFBQSxVQUFXO0FBQUEsVUFBZTtBQUFBLFVBQWdCO0FBQUEsUUFDdkQ7QUFBQSxNQUNEO0FBQUEsTUFDQSxHQUFJLHdCQUF3QixFQUFFLHlCQUF5QixLQUFLLElBQUksQ0FBQztBQUFBLElBQ2xFLENBQUM7QUFBQSxFQUNGLFVBQUU7QUFDRCxTQUFLLFFBQVE7QUFBQSxFQUNkO0FBQ0Q7QUFjQSxlQUFzQix1QkFDckIsTUFDQSxrQkFDQSxpQkFDQSxTQUNrQjtBQUNsQixRQUFNLElBQUksSUFBSSxPQUFPO0FBQUEsSUFDcEIsZ0JBQWdCLGdCQUFnQjtBQUFBLE1BQy9CLE9BQU87QUFBQSxNQUNQLE1BQU0sVUFBVSxNQUFjLE1BQStCO0FBQzVELFlBQUksT0FBTyxTQUFTLFVBQVU7QUFDN0IsaUJBQU8sT0FBTyxJQUFJO0FBQUEsUUFDbkI7QUFFQSxjQUFNLGlCQUFpQixrQ0FBa0M7QUFDekQsWUFBSSxTQUFTLE9BQU8seUJBQXlCO0FBQzVDLGlCQUFPO0FBQUEsUUFDUjtBQUVBLGNBQU0sYUFBYSxnQkFBZ0IsNEJBQTRCLElBQUksS0FBSyxnQkFBZ0IsNEJBQTRCLEtBQUssTUFBTSx1QkFBdUIsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUMzSixlQUFPLGlCQUFpQixpQkFBaUIsTUFBTSxVQUFVO0FBQUEsTUFDMUQ7QUFBQSxJQUNELENBQUM7QUFBQSxJQUNELHlCQUF5QjtBQUFBLElBQ3pCLEdBQUksU0FBUyxvQkFBb0IsQ0FBQztBQUFBLEVBQ25DO0FBRUEsUUFBTSxNQUFNLE1BQU0sRUFBRSxNQUFNLE1BQU0sRUFBRSxPQUFPLEtBQUssQ0FBQztBQUMvQyxNQUFJLFNBQVMsa0JBQWtCLE1BQU07QUFDcEMsV0FBTyxTQUFTLEtBQUssU0FBUyx5QkFBeUIsS0FBSztBQUFBLEVBQzdELE9BQU87QUFDTixXQUFPO0FBQUEsRUFDUjtBQUNEO0FBRUEsSUFBVTtBQUFBLENBQVYsQ0FBVUEscUJBQVY7QUFHUSxXQUFTLGdCQUFnQixTQUFpSTtBQUNoSyxRQUFJLE9BQU8sWUFBWSxZQUFZO0FBQ2xDLGdCQUFVO0FBQUEsUUFDVCxXQUFXO0FBQUEsTUFDWjtBQUFBLElBQ0Q7QUFFQSxRQUFJLENBQUMsV0FBVyxPQUFPLFFBQVEsY0FBYyxZQUFZO0FBQ3hELFlBQU0sSUFBSSxNQUFNLGlDQUFpQztBQUFBLElBQ2xEO0FBRUEsV0FBTztBQUFBLE1BQ04sT0FBTyxDQUFDLENBQUMsUUFBUTtBQUFBLE1BQ2pCLFdBQVcsT0FBMkM7QUFDckQsWUFBSSxNQUFNLFNBQVMsUUFBUTtBQUMxQjtBQUFBLFFBQ0Q7QUFFQSxZQUFJLFFBQVEsT0FBTztBQUNsQixpQkFBTyxRQUFRLFFBQVEsUUFBUSxVQUFVLE1BQU0sTUFBTSxNQUFNLElBQUksQ0FBQyxFQUFFLEtBQUssWUFBWSxLQUFLLENBQUM7QUFBQSxRQUMxRjtBQUVBLGNBQU0sT0FBTyxRQUFRLFVBQVUsTUFBTSxNQUFNLE1BQU0sSUFBSTtBQUNyRCxZQUFJLGdCQUFnQixTQUFTO0FBQzVCLGdCQUFNLElBQUksTUFBTSxpS0FBaUs7QUFBQSxRQUNsTDtBQUNBLG9CQUFZLEtBQUssRUFBRSxJQUFJO0FBQUEsTUFDeEI7QUFBQSxNQUNBLFVBQVU7QUFBQSxRQUNULEtBQUssRUFBRSxNQUFNLE1BQU0sUUFBUSxHQUF1QjtBQUNqRCxnQkFBTSxZQUFZLE9BQ2Ysb0JBQW9CQyxRQUFPLElBQUksQ0FBQyxNQUNoQztBQUNILGlCQUFPLEtBQUssUUFBUSxPQUFPLEVBQUU7QUFDN0IsaUJBQU8sYUFBYSxTQUFTLElBQUksVUFBVSxPQUFPQSxRQUFPLE1BQU0sSUFBSSxDQUFDO0FBQUE7QUFBQSxRQUNyRTtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQXRDTyxFQUFBRCxpQkFBUztBQXdDaEIsV0FBUyxZQUFZLE9BQVk7QUFDaEMsV0FBTyxDQUFDLFNBQWlCO0FBQ3hCLFVBQUksT0FBTyxTQUFTLFlBQVksU0FBUyxNQUFNLE1BQU07QUFDcEQsY0FBTSxVQUFVO0FBQ2hCLGNBQU0sT0FBTztBQUFBLE1BQ2Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUdBLFFBQU0sYUFBYTtBQUNuQixRQUFNLGdCQUFnQixJQUFJLE9BQU8sV0FBVyxRQUFRLEdBQUc7QUFDdkQsUUFBTSxxQkFBcUI7QUFDM0IsUUFBTSx3QkFBd0IsSUFBSSxPQUFPLG1CQUFtQixRQUFRLEdBQUc7QUFDdkUsUUFBTSxvQkFBNEM7QUFBQSxJQUNqRCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxDQUFDLEdBQUcsR0FBRztBQUFBLEVBQ1I7QUFDQSxRQUFNLHVCQUF1QixDQUFDLE9BQWUsa0JBQWtCLEVBQUU7QUFDakUsV0FBU0MsUUFBTyxNQUFjLFFBQWtCO0FBQy9DLFFBQUksUUFBUTtBQUNYLFVBQUksV0FBVyxLQUFLLElBQUksR0FBRztBQUMxQixlQUFPLEtBQUssUUFBUSxlQUFlLG9CQUFvQjtBQUFBLE1BQ3hEO0FBQUEsSUFDRCxPQUFPO0FBQ04sVUFBSSxtQkFBbUIsS0FBSyxJQUFJLEdBQUc7QUFDbEMsZUFBTyxLQUFLLFFBQVEsdUJBQXVCLG9CQUFvQjtBQUFBLE1BQ2hFO0FBQUEsSUFDRDtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsR0E3RVM7IiwKICAibmFtZXMiOiBbIk1hcmtlZEhpZ2hsaWdodCIsICJlc2NhcGUiXQp9Cg==
