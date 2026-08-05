var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import * as dom from "../../../../base/browser/dom.js";
import * as aria from "../../../../base/browser/ui/aria/aria.js";
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { escapeRegExpCharacters } from "../../../../base/common/strings.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import "./parameterHints.css";
import { ContentWidgetPositionPreference } from "../../../browser/editorBrowser.js";
import { EDITOR_FONT_DEFAULTS, EditorOption } from "../../../common/config/editorOptions.js";
import { ILanguageService } from "../../../common/languages/language.js";
import { MarkdownRenderer } from "../../../browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { Context } from "./provideSignatureHelp.js";
import * as nls from "../../../../nls.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { listHighlightForeground, registerColor } from "../../../../platform/theme/common/colorRegistry.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
const $ = dom.$;
const parameterHintsNextIcon = registerIcon("parameter-hints-next", Codicon.chevronDown, nls.localize("parameterHintsNextIcon", "Icon for show next parameter hint."));
const parameterHintsPreviousIcon = registerIcon("parameter-hints-previous", Codicon.chevronUp, nls.localize("parameterHintsPreviousIcon", "Icon for show previous parameter hint."));
let ParameterHintsWidget = class extends Disposable {
  constructor(editor, model, contextKeyService, openerService, languageService) {
    super();
    this.editor = editor;
    this.model = model;
    this.renderDisposeables = this._register(new DisposableStore());
    this.visible = false;
    this.announcedLabel = null;
    // Editor.IContentWidget.allowEditorOverflow
    this.allowEditorOverflow = true;
    this.markdownRenderer = new MarkdownRenderer({ editor }, languageService, openerService);
    this.keyVisible = Context.Visible.bindTo(contextKeyService);
    this.keyMultipleSignatures = Context.MultipleSignatures.bindTo(contextKeyService);
  }
  createParameterHintDOMNodes() {
    const element = $(".editor-widget.parameter-hints-widget");
    const wrapper = dom.append(element, $(".phwrapper"));
    wrapper.tabIndex = -1;
    const controls = dom.append(wrapper, $(".controls"));
    const previous = dom.append(controls, $(".button" + ThemeIcon.asCSSSelector(parameterHintsPreviousIcon)));
    const overloads = dom.append(controls, $(".overloads"));
    const next = dom.append(controls, $(".button" + ThemeIcon.asCSSSelector(parameterHintsNextIcon)));
    this._register(dom.addDisposableListener(previous, "click", (e) => {
      dom.EventHelper.stop(e);
      this.previous();
    }));
    this._register(dom.addDisposableListener(next, "click", (e) => {
      dom.EventHelper.stop(e);
      this.next();
    }));
    const body = $(".body");
    const scrollbar = new DomScrollableElement(body, {
      alwaysConsumeMouseWheel: true
    });
    this._register(scrollbar);
    wrapper.appendChild(scrollbar.getDomNode());
    const signature = dom.append(body, $(".signature"));
    const docs = dom.append(body, $(".docs"));
    element.style.userSelect = "text";
    this.domNodes = {
      element,
      signature,
      overloads,
      docs,
      scrollbar
    };
    this.editor.addContentWidget(this);
    this.hide();
    this._register(this.editor.onDidChangeCursorSelection((e) => {
      if (this.visible) {
        this.editor.layoutContentWidget(this);
      }
    }));
    const updateFont = () => {
      if (!this.domNodes) {
        return;
      }
      const fontInfo = this.editor.getOption(EditorOption.fontInfo);
      const element2 = this.domNodes.element;
      element2.style.fontSize = `${fontInfo.fontSize}px`;
      element2.style.lineHeight = `${fontInfo.lineHeight / fontInfo.fontSize}`;
      element2.style.setProperty("--vscode-parameterHintsWidget-editorFontFamily", fontInfo.fontFamily);
      element2.style.setProperty("--vscode-parameterHintsWidget-editorFontFamilyDefault", EDITOR_FONT_DEFAULTS.fontFamily);
    };
    updateFont();
    this._register(Event.chain(
      this.editor.onDidChangeConfiguration.bind(this.editor),
      ($2) => $2.filter((e) => e.hasChanged(EditorOption.fontInfo))
    )(updateFont));
    this._register(this.editor.onDidLayoutChange((e) => this.updateMaxHeight()));
    this.updateMaxHeight();
  }
  show() {
    if (this.visible) {
      return;
    }
    if (!this.domNodes) {
      this.createParameterHintDOMNodes();
    }
    this.keyVisible.set(true);
    this.visible = true;
    setTimeout(() => {
      this.domNodes?.element.classList.add("visible");
    }, 100);
    this.editor.layoutContentWidget(this);
  }
  hide() {
    this.renderDisposeables.clear();
    if (!this.visible) {
      return;
    }
    this.keyVisible.reset();
    this.visible = false;
    this.announcedLabel = null;
    this.domNodes?.element.classList.remove("visible");
    this.editor.layoutContentWidget(this);
  }
  getPosition() {
    if (this.visible) {
      return {
        position: this.editor.getPosition(),
        preference: [ContentWidgetPositionPreference.ABOVE, ContentWidgetPositionPreference.BELOW]
      };
    }
    return null;
  }
  render(hints) {
    this.renderDisposeables.clear();
    if (!this.domNodes) {
      return;
    }
    const multiple = hints.signatures.length > 1;
    this.domNodes.element.classList.toggle("multiple", multiple);
    this.keyMultipleSignatures.set(multiple);
    this.domNodes.signature.innerText = "";
    this.domNodes.docs.innerText = "";
    const signature = hints.signatures[hints.activeSignature];
    if (!signature) {
      return;
    }
    const code = dom.append(this.domNodes.signature, $(".code"));
    const hasParameters = signature.parameters.length > 0;
    const activeParameterIndex = signature.activeParameter ?? hints.activeParameter;
    if (!hasParameters) {
      const label = dom.append(code, $("span"));
      label.textContent = signature.label;
    } else {
      this.renderParameters(code, signature, activeParameterIndex);
    }
    const activeParameter = signature.parameters[activeParameterIndex];
    if (activeParameter?.documentation) {
      const documentation = $("span.documentation");
      if (typeof activeParameter.documentation === "string") {
        documentation.textContent = activeParameter.documentation;
      } else {
        const renderedContents = this.renderMarkdownDocs(activeParameter.documentation);
        documentation.appendChild(renderedContents.element);
      }
      dom.append(this.domNodes.docs, $("p", {}, documentation));
    }
    if (signature.documentation === void 0) {
    } else if (typeof signature.documentation === "string") {
      dom.append(this.domNodes.docs, $("p", {}, signature.documentation));
    } else {
      const renderedContents = this.renderMarkdownDocs(signature.documentation);
      dom.append(this.domNodes.docs, renderedContents.element);
    }
    const hasDocs = this.hasDocs(signature, activeParameter);
    this.domNodes.signature.classList.toggle("has-docs", hasDocs);
    this.domNodes.docs.classList.toggle("empty", !hasDocs);
    this.domNodes.overloads.textContent = String(hints.activeSignature + 1).padStart(hints.signatures.length.toString().length, "0") + "/" + hints.signatures.length;
    if (activeParameter) {
      let labelToAnnounce = "";
      const param = signature.parameters[activeParameterIndex];
      if (Array.isArray(param.label)) {
        labelToAnnounce = signature.label.substring(param.label[0], param.label[1]);
      } else {
        labelToAnnounce = param.label;
      }
      if (param.documentation) {
        labelToAnnounce += typeof param.documentation === "string" ? `, ${param.documentation}` : `, ${param.documentation.value}`;
      }
      if (signature.documentation) {
        labelToAnnounce += typeof signature.documentation === "string" ? `, ${signature.documentation}` : `, ${signature.documentation.value}`;
      }
      if (this.announcedLabel !== labelToAnnounce) {
        aria.alert(nls.localize("hint", "{0}, hint", labelToAnnounce));
        this.announcedLabel = labelToAnnounce;
      }
    }
    this.editor.layoutContentWidget(this);
    this.domNodes.scrollbar.scanDomNode();
  }
  renderMarkdownDocs(markdown) {
    const renderedContents = this.renderDisposeables.add(this.markdownRenderer.render(markdown, {
      asyncRenderCallback: () => {
        this.domNodes?.scrollbar.scanDomNode();
      }
    }));
    renderedContents.element.classList.add("markdown-docs");
    return renderedContents;
  }
  hasDocs(signature, activeParameter) {
    if (activeParameter && typeof activeParameter.documentation === "string" && assertIsDefined(activeParameter.documentation).length > 0) {
      return true;
    }
    if (activeParameter && typeof activeParameter.documentation === "object" && assertIsDefined(activeParameter.documentation).value.length > 0) {
      return true;
    }
    if (signature.documentation && typeof signature.documentation === "string" && assertIsDefined(signature.documentation).length > 0) {
      return true;
    }
    if (signature.documentation && typeof signature.documentation === "object" && assertIsDefined(signature.documentation.value).length > 0) {
      return true;
    }
    return false;
  }
  renderParameters(parent, signature, activeParameterIndex) {
    const [start, end] = this.getParameterLabelOffsets(signature, activeParameterIndex);
    const beforeSpan = document.createElement("span");
    beforeSpan.textContent = signature.label.substring(0, start);
    const paramSpan = document.createElement("span");
    paramSpan.textContent = signature.label.substring(start, end);
    paramSpan.className = "parameter active";
    const afterSpan = document.createElement("span");
    afterSpan.textContent = signature.label.substring(end);
    dom.append(parent, beforeSpan, paramSpan, afterSpan);
  }
  getParameterLabelOffsets(signature, paramIdx) {
    const param = signature.parameters[paramIdx];
    if (!param) {
      return [0, 0];
    } else if (Array.isArray(param.label)) {
      return param.label;
    } else if (!param.label.length) {
      return [0, 0];
    } else {
      const regex = new RegExp(`(\\W|^)${escapeRegExpCharacters(param.label)}(?=\\W|$)`, "g");
      regex.test(signature.label);
      const idx = regex.lastIndex - param.label.length;
      return idx >= 0 ? [idx, regex.lastIndex] : [0, 0];
    }
  }
  next() {
    this.editor.focus();
    this.model.next();
  }
  previous() {
    this.editor.focus();
    this.model.previous();
  }
  getDomNode() {
    if (!this.domNodes) {
      this.createParameterHintDOMNodes();
    }
    return this.domNodes.element;
  }
  getId() {
    return ParameterHintsWidget.ID;
  }
  updateMaxHeight() {
    if (!this.domNodes) {
      return;
    }
    const height = Math.max(this.editor.getLayoutInfo().height / 4, 250);
    const maxHeight = `${height}px`;
    this.domNodes.element.style.maxHeight = maxHeight;
    const wrapper = this.domNodes.element.getElementsByClassName("phwrapper");
    if (wrapper.length) {
      wrapper[0].style.maxHeight = maxHeight;
    }
  }
};
ParameterHintsWidget.ID = "editor.widget.parameterHintsWidget";
ParameterHintsWidget = __decorateClass([
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IOpenerService),
  __decorateParam(4, ILanguageService)
], ParameterHintsWidget);
registerColor("editorHoverWidget.highlightForeground", listHighlightForeground, nls.localize("editorHoverWidgetHighlightForeground", "Foreground color of the active item in the parameter hint."));
export {
  ParameterHintsWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9wYXJhbWV0ZXJIaW50cy9icm93c2VyL3BhcmFtZXRlckhpbnRzV2lkZ2V0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0ICogYXMgYXJpYSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYXJpYS9hcmlhLmpzJztcbmltcG9ydCB7IERvbVNjcm9sbGFibGVFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Njcm9sbGJhci9zY3JvbGxhYmxlRWxlbWVudC5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZXNjYXBlUmVnRXhwQ2hhcmFjdGVycyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0ICcuL3BhcmFtZXRlckhpbnRzLmNzcyc7XG5pbXBvcnQgeyBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLCBJQ29kZUVkaXRvciwgSUNvbnRlbnRXaWRnZXQsIElDb250ZW50V2lkZ2V0UG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRURJVE9SX0ZPTlRfREVGQVVMVFMsIEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgKiBhcyBsYW5ndWFnZXMgZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25SZW5kZXJSZXN1bHQsIE1hcmtkb3duUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3dpZGdldC9tYXJrZG93blJlbmRlcmVyL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBQYXJhbWV0ZXJIaW50c01vZGVsIH0gZnJvbSAnLi9wYXJhbWV0ZXJIaW50c01vZGVsLmpzJztcbmltcG9ydCB7IENvbnRleHQgfSBmcm9tICcuL3Byb3ZpZGVTaWduYXR1cmVIZWxwLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBsaXN0SGlnaGxpZ2h0Rm9yZWdyb3VuZCwgcmVnaXN0ZXJDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IHJlZ2lzdGVySWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcblxuY29uc3QgJCA9IGRvbS4kO1xuXG5jb25zdCBwYXJhbWV0ZXJIaW50c05leHRJY29uID0gcmVnaXN0ZXJJY29uKCdwYXJhbWV0ZXItaGludHMtbmV4dCcsIENvZGljb24uY2hldnJvbkRvd24sIG5scy5sb2NhbGl6ZSgncGFyYW1ldGVySGludHNOZXh0SWNvbicsICdJY29uIGZvciBzaG93IG5leHQgcGFyYW1ldGVyIGhpbnQuJykpO1xuY29uc3QgcGFyYW1ldGVySGludHNQcmV2aW91c0ljb24gPSByZWdpc3Rlckljb24oJ3BhcmFtZXRlci1oaW50cy1wcmV2aW91cycsIENvZGljb24uY2hldnJvblVwLCBubHMubG9jYWxpemUoJ3BhcmFtZXRlckhpbnRzUHJldmlvdXNJY29uJywgJ0ljb24gZm9yIHNob3cgcHJldmlvdXMgcGFyYW1ldGVyIGhpbnQuJykpO1xuXG5leHBvcnQgY2xhc3MgUGFyYW1ldGVySGludHNXaWRnZXQgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNvbnRlbnRXaWRnZXQge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IElEID0gJ2VkaXRvci53aWRnZXQucGFyYW1ldGVySGludHNXaWRnZXQnO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbWFya2Rvd25SZW5kZXJlcjogTWFya2Rvd25SZW5kZXJlcjtcblx0cHJpdmF0ZSByZWFkb25seSByZW5kZXJEaXNwb3NlYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGtleVZpc2libGU6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGtleU11bHRpcGxlU2lnbmF0dXJlczogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0cHJpdmF0ZSBkb21Ob2Rlcz86IHtcblx0XHRyZWFkb25seSBlbGVtZW50OiBIVE1MRWxlbWVudDtcblx0XHRyZWFkb25seSBzaWduYXR1cmU6IEhUTUxFbGVtZW50O1xuXHRcdHJlYWRvbmx5IGRvY3M6IEhUTUxFbGVtZW50O1xuXHRcdHJlYWRvbmx5IG92ZXJsb2FkczogSFRNTEVsZW1lbnQ7XG5cdFx0cmVhZG9ubHkgc2Nyb2xsYmFyOiBEb21TY3JvbGxhYmxlRWxlbWVudDtcblx0fTtcblxuXHRwcml2YXRlIHZpc2libGU6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBhbm5vdW5jZWRMYWJlbDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cblx0Ly8gRWRpdG9yLklDb250ZW50V2lkZ2V0LmFsbG93RWRpdG9yT3ZlcmZsb3dcblx0YWxsb3dFZGl0b3JPdmVyZmxvdyA9IHRydWU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbW9kZWw6IFBhcmFtZXRlckhpbnRzTW9kZWwsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMubWFya2Rvd25SZW5kZXJlciA9IG5ldyBNYXJrZG93blJlbmRlcmVyKHsgZWRpdG9yIH0sIGxhbmd1YWdlU2VydmljZSwgb3BlbmVyU2VydmljZSk7XG5cblx0XHR0aGlzLmtleVZpc2libGUgPSBDb250ZXh0LlZpc2libGUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmtleU11bHRpcGxlU2lnbmF0dXJlcyA9IENvbnRleHQuTXVsdGlwbGVTaWduYXR1cmVzLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVBhcmFtZXRlckhpbnRET01Ob2RlcygpIHtcblx0XHRjb25zdCBlbGVtZW50ID0gJCgnLmVkaXRvci13aWRnZXQucGFyYW1ldGVyLWhpbnRzLXdpZGdldCcpO1xuXHRcdGNvbnN0IHdyYXBwZXIgPSBkb20uYXBwZW5kKGVsZW1lbnQsICQoJy5waHdyYXBwZXInKSk7XG5cdFx0d3JhcHBlci50YWJJbmRleCA9IC0xO1xuXG5cdFx0Y29uc3QgY29udHJvbHMgPSBkb20uYXBwZW5kKHdyYXBwZXIsICQoJy5jb250cm9scycpKTtcblx0XHRjb25zdCBwcmV2aW91cyA9IGRvbS5hcHBlbmQoY29udHJvbHMsICQoJy5idXR0b24nICsgVGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IocGFyYW1ldGVySGludHNQcmV2aW91c0ljb24pKSk7XG5cdFx0Y29uc3Qgb3ZlcmxvYWRzID0gZG9tLmFwcGVuZChjb250cm9scywgJCgnLm92ZXJsb2FkcycpKTtcblx0XHRjb25zdCBuZXh0ID0gZG9tLmFwcGVuZChjb250cm9scywgJCgnLmJ1dHRvbicgKyBUaGVtZUljb24uYXNDU1NTZWxlY3RvcihwYXJhbWV0ZXJIaW50c05leHRJY29uKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihwcmV2aW91cywgJ2NsaWNrJywgZSA9PiB7XG5cdFx0XHRkb20uRXZlbnRIZWxwZXIuc3RvcChlKTtcblx0XHRcdHRoaXMucHJldmlvdXMoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKG5leHQsICdjbGljaycsIGUgPT4ge1xuXHRcdFx0ZG9tLkV2ZW50SGVscGVyLnN0b3AoZSk7XG5cdFx0XHR0aGlzLm5leHQoKTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCBib2R5ID0gJCgnLmJvZHknKTtcblx0XHRjb25zdCBzY3JvbGxiYXIgPSBuZXcgRG9tU2Nyb2xsYWJsZUVsZW1lbnQoYm9keSwge1xuXHRcdFx0YWx3YXlzQ29uc3VtZU1vdXNlV2hlZWw6IHRydWUsXG5cdFx0fSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoc2Nyb2xsYmFyKTtcblx0XHR3cmFwcGVyLmFwcGVuZENoaWxkKHNjcm9sbGJhci5nZXREb21Ob2RlKCkpO1xuXG5cdFx0Y29uc3Qgc2lnbmF0dXJlID0gZG9tLmFwcGVuZChib2R5LCAkKCcuc2lnbmF0dXJlJykpO1xuXHRcdGNvbnN0IGRvY3MgPSBkb20uYXBwZW5kKGJvZHksICQoJy5kb2NzJykpO1xuXG5cdFx0ZWxlbWVudC5zdHlsZS51c2VyU2VsZWN0ID0gJ3RleHQnO1xuXG5cdFx0dGhpcy5kb21Ob2RlcyA9IHtcblx0XHRcdGVsZW1lbnQsXG5cdFx0XHRzaWduYXR1cmUsXG5cdFx0XHRvdmVybG9hZHMsXG5cdFx0XHRkb2NzLFxuXHRcdFx0c2Nyb2xsYmFyLFxuXHRcdH07XG5cblx0XHR0aGlzLmVkaXRvci5hZGRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHRcdHRoaXMuaGlkZSgpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JTZWxlY3Rpb24oZSA9PiB7XG5cdFx0XHRpZiAodGhpcy52aXNpYmxlKSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yLmxheW91dENvbnRlbnRXaWRnZXQodGhpcyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgdXBkYXRlRm9udCA9ICgpID0+IHtcblx0XHRcdGlmICghdGhpcy5kb21Ob2Rlcykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGZvbnRJbmZvID0gdGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250SW5mbyk7XG5cdFx0XHRjb25zdCBlbGVtZW50ID0gdGhpcy5kb21Ob2Rlcy5lbGVtZW50O1xuXHRcdFx0ZWxlbWVudC5zdHlsZS5mb250U2l6ZSA9IGAke2ZvbnRJbmZvLmZvbnRTaXplfXB4YDtcblx0XHRcdGVsZW1lbnQuc3R5bGUubGluZUhlaWdodCA9IGAke2ZvbnRJbmZvLmxpbmVIZWlnaHQgLyBmb250SW5mby5mb250U2l6ZX1gO1xuXHRcdFx0ZWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS12c2NvZGUtcGFyYW1ldGVySGludHNXaWRnZXQtZWRpdG9yRm9udEZhbWlseScsIGZvbnRJbmZvLmZvbnRGYW1pbHkpO1xuXHRcdFx0ZWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS12c2NvZGUtcGFyYW1ldGVySGludHNXaWRnZXQtZWRpdG9yRm9udEZhbWlseURlZmF1bHQnLCBFRElUT1JfRk9OVF9ERUZBVUxUUy5mb250RmFtaWx5KTtcblx0XHR9O1xuXG5cdFx0dXBkYXRlRm9udCgpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuY2hhaW4oXG5cdFx0XHR0aGlzLmVkaXRvci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24uYmluZCh0aGlzLmVkaXRvciksXG5cdFx0XHQkID0+ICQuZmlsdGVyKGUgPT4gZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5mb250SW5mbykpXG5cdFx0KSh1cGRhdGVGb250KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvci5vbkRpZExheW91dENoYW5nZShlID0+IHRoaXMudXBkYXRlTWF4SGVpZ2h0KCkpKTtcblx0XHR0aGlzLnVwZGF0ZU1heEhlaWdodCgpO1xuXHR9XG5cblx0cHVibGljIHNob3coKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMudmlzaWJsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5kb21Ob2Rlcykge1xuXHRcdFx0dGhpcy5jcmVhdGVQYXJhbWV0ZXJIaW50RE9NTm9kZXMoKTtcblx0XHR9XG5cblx0XHR0aGlzLmtleVZpc2libGUuc2V0KHRydWUpO1xuXHRcdHRoaXMudmlzaWJsZSA9IHRydWU7XG5cdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLmRvbU5vZGVzPy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcblx0XHR9LCAxMDApO1xuXHRcdHRoaXMuZWRpdG9yLmxheW91dENvbnRlbnRXaWRnZXQodGhpcyk7XG5cdH1cblxuXHRwdWJsaWMgaGlkZSgpOiB2b2lkIHtcblx0XHR0aGlzLnJlbmRlckRpc3Bvc2VhYmxlcy5jbGVhcigpO1xuXG5cdFx0aWYgKCF0aGlzLnZpc2libGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmtleVZpc2libGUucmVzZXQoKTtcblx0XHR0aGlzLnZpc2libGUgPSBmYWxzZTtcblx0XHR0aGlzLmFubm91bmNlZExhYmVsID0gbnVsbDtcblx0XHR0aGlzLmRvbU5vZGVzPy5lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcblx0XHR0aGlzLmVkaXRvci5sYXlvdXRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHR9XG5cblx0Z2V0UG9zaXRpb24oKTogSUNvbnRlbnRXaWRnZXRQb3NpdGlvbiB8IG51bGwge1xuXHRcdGlmICh0aGlzLnZpc2libGUpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHBvc2l0aW9uOiB0aGlzLmVkaXRvci5nZXRQb3NpdGlvbigpLFxuXHRcdFx0XHRwcmVmZXJlbmNlOiBbQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5BQk9WRSwgQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5CRUxPV11cblx0XHRcdH07XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHVibGljIHJlbmRlcihoaW50czogbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHApOiB2b2lkIHtcblx0XHR0aGlzLnJlbmRlckRpc3Bvc2VhYmxlcy5jbGVhcigpO1xuXG5cdFx0aWYgKCF0aGlzLmRvbU5vZGVzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbXVsdGlwbGUgPSBoaW50cy5zaWduYXR1cmVzLmxlbmd0aCA+IDE7XG5cdFx0dGhpcy5kb21Ob2Rlcy5lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ211bHRpcGxlJywgbXVsdGlwbGUpO1xuXHRcdHRoaXMua2V5TXVsdGlwbGVTaWduYXR1cmVzLnNldChtdWx0aXBsZSk7XG5cblx0XHR0aGlzLmRvbU5vZGVzLnNpZ25hdHVyZS5pbm5lclRleHQgPSAnJztcblx0XHR0aGlzLmRvbU5vZGVzLmRvY3MuaW5uZXJUZXh0ID0gJyc7XG5cblx0XHRjb25zdCBzaWduYXR1cmUgPSBoaW50cy5zaWduYXR1cmVzW2hpbnRzLmFjdGl2ZVNpZ25hdHVyZV07XG5cdFx0aWYgKCFzaWduYXR1cmUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjb2RlID0gZG9tLmFwcGVuZCh0aGlzLmRvbU5vZGVzLnNpZ25hdHVyZSwgJCgnLmNvZGUnKSk7XG5cdFx0Y29uc3QgaGFzUGFyYW1ldGVycyA9IHNpZ25hdHVyZS5wYXJhbWV0ZXJzLmxlbmd0aCA+IDA7XG5cdFx0Y29uc3QgYWN0aXZlUGFyYW1ldGVySW5kZXggPSBzaWduYXR1cmUuYWN0aXZlUGFyYW1ldGVyID8/IGhpbnRzLmFjdGl2ZVBhcmFtZXRlcjtcblxuXHRcdGlmICghaGFzUGFyYW1ldGVycykge1xuXHRcdFx0Y29uc3QgbGFiZWwgPSBkb20uYXBwZW5kKGNvZGUsICQoJ3NwYW4nKSk7XG5cdFx0XHRsYWJlbC50ZXh0Q29udGVudCA9IHNpZ25hdHVyZS5sYWJlbDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5yZW5kZXJQYXJhbWV0ZXJzKGNvZGUsIHNpZ25hdHVyZSwgYWN0aXZlUGFyYW1ldGVySW5kZXgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2ZVBhcmFtZXRlcjogbGFuZ3VhZ2VzLlBhcmFtZXRlckluZm9ybWF0aW9uIHwgdW5kZWZpbmVkID0gc2lnbmF0dXJlLnBhcmFtZXRlcnNbYWN0aXZlUGFyYW1ldGVySW5kZXhdO1xuXHRcdGlmIChhY3RpdmVQYXJhbWV0ZXI/LmRvY3VtZW50YXRpb24pIHtcblx0XHRcdGNvbnN0IGRvY3VtZW50YXRpb24gPSAkKCdzcGFuLmRvY3VtZW50YXRpb24nKTtcblx0XHRcdGlmICh0eXBlb2YgYWN0aXZlUGFyYW1ldGVyLmRvY3VtZW50YXRpb24gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGRvY3VtZW50YXRpb24udGV4dENvbnRlbnQgPSBhY3RpdmVQYXJhbWV0ZXIuZG9jdW1lbnRhdGlvbjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHJlbmRlcmVkQ29udGVudHMgPSB0aGlzLnJlbmRlck1hcmtkb3duRG9jcyhhY3RpdmVQYXJhbWV0ZXIuZG9jdW1lbnRhdGlvbik7XG5cdFx0XHRcdGRvY3VtZW50YXRpb24uYXBwZW5kQ2hpbGQocmVuZGVyZWRDb250ZW50cy5lbGVtZW50KTtcblx0XHRcdH1cblx0XHRcdGRvbS5hcHBlbmQodGhpcy5kb21Ob2Rlcy5kb2NzLCAkKCdwJywge30sIGRvY3VtZW50YXRpb24pKTtcblx0XHR9XG5cblx0XHRpZiAoc2lnbmF0dXJlLmRvY3VtZW50YXRpb24gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0LyoqIG5vIG9wICovXG5cdFx0fSBlbHNlIGlmICh0eXBlb2Ygc2lnbmF0dXJlLmRvY3VtZW50YXRpb24gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRkb20uYXBwZW5kKHRoaXMuZG9tTm9kZXMuZG9jcywgJCgncCcsIHt9LCBzaWduYXR1cmUuZG9jdW1lbnRhdGlvbikpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCByZW5kZXJlZENvbnRlbnRzID0gdGhpcy5yZW5kZXJNYXJrZG93bkRvY3Moc2lnbmF0dXJlLmRvY3VtZW50YXRpb24pO1xuXHRcdFx0ZG9tLmFwcGVuZCh0aGlzLmRvbU5vZGVzLmRvY3MsIHJlbmRlcmVkQ29udGVudHMuZWxlbWVudCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFzRG9jcyA9IHRoaXMuaGFzRG9jcyhzaWduYXR1cmUsIGFjdGl2ZVBhcmFtZXRlcik7XG5cblx0XHR0aGlzLmRvbU5vZGVzLnNpZ25hdHVyZS5jbGFzc0xpc3QudG9nZ2xlKCdoYXMtZG9jcycsIGhhc0RvY3MpO1xuXHRcdHRoaXMuZG9tTm9kZXMuZG9jcy5jbGFzc0xpc3QudG9nZ2xlKCdlbXB0eScsICFoYXNEb2NzKTtcblxuXHRcdHRoaXMuZG9tTm9kZXMub3ZlcmxvYWRzLnRleHRDb250ZW50ID1cblx0XHRcdFN0cmluZyhoaW50cy5hY3RpdmVTaWduYXR1cmUgKyAxKS5wYWRTdGFydChoaW50cy5zaWduYXR1cmVzLmxlbmd0aC50b1N0cmluZygpLmxlbmd0aCwgJzAnKSArICcvJyArIGhpbnRzLnNpZ25hdHVyZXMubGVuZ3RoO1xuXG5cdFx0aWYgKGFjdGl2ZVBhcmFtZXRlcikge1xuXHRcdFx0bGV0IGxhYmVsVG9Bbm5vdW5jZSA9ICcnO1xuXHRcdFx0Y29uc3QgcGFyYW0gPSBzaWduYXR1cmUucGFyYW1ldGVyc1thY3RpdmVQYXJhbWV0ZXJJbmRleF07XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShwYXJhbS5sYWJlbCkpIHtcblx0XHRcdFx0bGFiZWxUb0Fubm91bmNlID0gc2lnbmF0dXJlLmxhYmVsLnN1YnN0cmluZyhwYXJhbS5sYWJlbFswXSwgcGFyYW0ubGFiZWxbMV0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGFiZWxUb0Fubm91bmNlID0gcGFyYW0ubGFiZWw7XG5cdFx0XHR9XG5cdFx0XHRpZiAocGFyYW0uZG9jdW1lbnRhdGlvbikge1xuXHRcdFx0XHRsYWJlbFRvQW5ub3VuY2UgKz0gdHlwZW9mIHBhcmFtLmRvY3VtZW50YXRpb24gPT09ICdzdHJpbmcnID8gYCwgJHtwYXJhbS5kb2N1bWVudGF0aW9ufWAgOiBgLCAke3BhcmFtLmRvY3VtZW50YXRpb24udmFsdWV9YDtcblx0XHRcdH1cblx0XHRcdGlmIChzaWduYXR1cmUuZG9jdW1lbnRhdGlvbikge1xuXHRcdFx0XHRsYWJlbFRvQW5ub3VuY2UgKz0gdHlwZW9mIHNpZ25hdHVyZS5kb2N1bWVudGF0aW9uID09PSAnc3RyaW5nJyA/IGAsICR7c2lnbmF0dXJlLmRvY3VtZW50YXRpb259YCA6IGAsICR7c2lnbmF0dXJlLmRvY3VtZW50YXRpb24udmFsdWV9YDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2VsZWN0IG1ldGhvZCBnZXRzIGNhbGxlZCBvbiBldmVyeSB1c2VyIHR5cGUgd2hpbGUgcGFyYW1ldGVyIGhpbnRzIGFyZSB2aXNpYmxlLlxuXHRcdFx0Ly8gV2UgZG8gbm90IHdhbnQgdG8gc3BhbSB0aGUgdXNlciB3aXRoIHNhbWUgYW5ub3VuY2VtZW50cywgc28gd2Ugb25seSBhbm5vdW5jZSBpZiB0aGUgY3VycmVudCBwYXJhbWV0ZXIgY2hhbmdlZC5cblxuXHRcdFx0aWYgKHRoaXMuYW5ub3VuY2VkTGFiZWwgIT09IGxhYmVsVG9Bbm5vdW5jZSkge1xuXHRcdFx0XHRhcmlhLmFsZXJ0KG5scy5sb2NhbGl6ZSgnaGludCcsIFwiezB9LCBoaW50XCIsIGxhYmVsVG9Bbm5vdW5jZSkpO1xuXHRcdFx0XHR0aGlzLmFubm91bmNlZExhYmVsID0gbGFiZWxUb0Fubm91bmNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuZWRpdG9yLmxheW91dENvbnRlbnRXaWRnZXQodGhpcyk7XG5cdFx0dGhpcy5kb21Ob2Rlcy5zY3JvbGxiYXIuc2NhbkRvbU5vZGUoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyTWFya2Rvd25Eb2NzKG1hcmtkb3duOiBJTWFya2Rvd25TdHJpbmcgfCB1bmRlZmluZWQpOiBJTWFya2Rvd25SZW5kZXJSZXN1bHQge1xuXHRcdGNvbnN0IHJlbmRlcmVkQ29udGVudHMgPSB0aGlzLnJlbmRlckRpc3Bvc2VhYmxlcy5hZGQodGhpcy5tYXJrZG93blJlbmRlcmVyLnJlbmRlcihtYXJrZG93biwge1xuXHRcdFx0YXN5bmNSZW5kZXJDYWxsYmFjazogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmRvbU5vZGVzPy5zY3JvbGxiYXIuc2NhbkRvbU5vZGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0cmVuZGVyZWRDb250ZW50cy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ21hcmtkb3duLWRvY3MnKTtcblx0XHRyZXR1cm4gcmVuZGVyZWRDb250ZW50cztcblx0fVxuXG5cdHByaXZhdGUgaGFzRG9jcyhzaWduYXR1cmU6IGxhbmd1YWdlcy5TaWduYXR1cmVJbmZvcm1hdGlvbiwgYWN0aXZlUGFyYW1ldGVyOiBsYW5ndWFnZXMuUGFyYW1ldGVySW5mb3JtYXRpb24gfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRpZiAoYWN0aXZlUGFyYW1ldGVyICYmIHR5cGVvZiBhY3RpdmVQYXJhbWV0ZXIuZG9jdW1lbnRhdGlvbiA9PT0gJ3N0cmluZycgJiYgYXNzZXJ0SXNEZWZpbmVkKGFjdGl2ZVBhcmFtZXRlci5kb2N1bWVudGF0aW9uKS5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKGFjdGl2ZVBhcmFtZXRlciAmJiB0eXBlb2YgYWN0aXZlUGFyYW1ldGVyLmRvY3VtZW50YXRpb24gPT09ICdvYmplY3QnICYmIGFzc2VydElzRGVmaW5lZChhY3RpdmVQYXJhbWV0ZXIuZG9jdW1lbnRhdGlvbikudmFsdWUubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmIChzaWduYXR1cmUuZG9jdW1lbnRhdGlvbiAmJiB0eXBlb2Ygc2lnbmF0dXJlLmRvY3VtZW50YXRpb24gPT09ICdzdHJpbmcnICYmIGFzc2VydElzRGVmaW5lZChzaWduYXR1cmUuZG9jdW1lbnRhdGlvbikubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmIChzaWduYXR1cmUuZG9jdW1lbnRhdGlvbiAmJiB0eXBlb2Ygc2lnbmF0dXJlLmRvY3VtZW50YXRpb24gPT09ICdvYmplY3QnICYmIGFzc2VydElzRGVmaW5lZChzaWduYXR1cmUuZG9jdW1lbnRhdGlvbi52YWx1ZSkubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyUGFyYW1ldGVycyhwYXJlbnQ6IEhUTUxFbGVtZW50LCBzaWduYXR1cmU6IGxhbmd1YWdlcy5TaWduYXR1cmVJbmZvcm1hdGlvbiwgYWN0aXZlUGFyYW1ldGVySW5kZXg6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IFtzdGFydCwgZW5kXSA9IHRoaXMuZ2V0UGFyYW1ldGVyTGFiZWxPZmZzZXRzKHNpZ25hdHVyZSwgYWN0aXZlUGFyYW1ldGVySW5kZXgpO1xuXG5cdFx0Y29uc3QgYmVmb3JlU3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblx0XHRiZWZvcmVTcGFuLnRleHRDb250ZW50ID0gc2lnbmF0dXJlLmxhYmVsLnN1YnN0cmluZygwLCBzdGFydCk7XG5cblx0XHRjb25zdCBwYXJhbVNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0cGFyYW1TcGFuLnRleHRDb250ZW50ID0gc2lnbmF0dXJlLmxhYmVsLnN1YnN0cmluZyhzdGFydCwgZW5kKTtcblx0XHRwYXJhbVNwYW4uY2xhc3NOYW1lID0gJ3BhcmFtZXRlciBhY3RpdmUnO1xuXG5cdFx0Y29uc3QgYWZ0ZXJTcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdGFmdGVyU3Bhbi50ZXh0Q29udGVudCA9IHNpZ25hdHVyZS5sYWJlbC5zdWJzdHJpbmcoZW5kKTtcblxuXHRcdGRvbS5hcHBlbmQocGFyZW50LCBiZWZvcmVTcGFuLCBwYXJhbVNwYW4sIGFmdGVyU3Bhbik7XG5cdH1cblxuXHRwcml2YXRlIGdldFBhcmFtZXRlckxhYmVsT2Zmc2V0cyhzaWduYXR1cmU6IGxhbmd1YWdlcy5TaWduYXR1cmVJbmZvcm1hdGlvbiwgcGFyYW1JZHg6IG51bWJlcik6IFtudW1iZXIsIG51bWJlcl0ge1xuXHRcdGNvbnN0IHBhcmFtID0gc2lnbmF0dXJlLnBhcmFtZXRlcnNbcGFyYW1JZHhdO1xuXHRcdGlmICghcGFyYW0pIHtcblx0XHRcdHJldHVybiBbMCwgMF07XG5cdFx0fSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHBhcmFtLmxhYmVsKSkge1xuXHRcdFx0cmV0dXJuIHBhcmFtLmxhYmVsO1xuXHRcdH0gZWxzZSBpZiAoIXBhcmFtLmxhYmVsLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIFswLCAwXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgcmVnZXggPSBuZXcgUmVnRXhwKGAoXFxcXFd8Xikke2VzY2FwZVJlZ0V4cENoYXJhY3RlcnMocGFyYW0ubGFiZWwpfSg/PVxcXFxXfCQpYCwgJ2cnKTtcblx0XHRcdHJlZ2V4LnRlc3Qoc2lnbmF0dXJlLmxhYmVsKTtcblx0XHRcdGNvbnN0IGlkeCA9IHJlZ2V4Lmxhc3RJbmRleCAtIHBhcmFtLmxhYmVsLmxlbmd0aDtcblx0XHRcdHJldHVybiBpZHggPj0gMFxuXHRcdFx0XHQ/IFtpZHgsIHJlZ2V4Lmxhc3RJbmRleF1cblx0XHRcdFx0OiBbMCwgMF07XG5cdFx0fVxuXHR9XG5cblx0bmV4dCgpOiB2b2lkIHtcblx0XHR0aGlzLmVkaXRvci5mb2N1cygpO1xuXHRcdHRoaXMubW9kZWwubmV4dCgpO1xuXHR9XG5cblx0cHJldmlvdXMoKTogdm9pZCB7XG5cdFx0dGhpcy5lZGl0b3IuZm9jdXMoKTtcblx0XHR0aGlzLm1vZGVsLnByZXZpb3VzKCk7XG5cdH1cblxuXHRnZXREb21Ob2RlKCk6IEhUTUxFbGVtZW50IHtcblx0XHRpZiAoIXRoaXMuZG9tTm9kZXMpIHtcblx0XHRcdHRoaXMuY3JlYXRlUGFyYW1ldGVySGludERPTU5vZGVzKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmRvbU5vZGVzIS5lbGVtZW50O1xuXHR9XG5cblx0Z2V0SWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gUGFyYW1ldGVySGludHNXaWRnZXQuSUQ7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZU1heEhlaWdodCgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuZG9tTm9kZXMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgaGVpZ2h0ID0gTWF0aC5tYXgodGhpcy5lZGl0b3IuZ2V0TGF5b3V0SW5mbygpLmhlaWdodCAvIDQsIDI1MCk7XG5cdFx0Y29uc3QgbWF4SGVpZ2h0ID0gYCR7aGVpZ2h0fXB4YDtcblx0XHR0aGlzLmRvbU5vZGVzLmVsZW1lbnQuc3R5bGUubWF4SGVpZ2h0ID0gbWF4SGVpZ2h0O1xuXHRcdGNvbnN0IHdyYXBwZXIgPSB0aGlzLmRvbU5vZGVzLmVsZW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgncGh3cmFwcGVyJykgYXMgSFRNTENvbGxlY3Rpb25PZjxIVE1MRWxlbWVudD47XG5cdFx0aWYgKHdyYXBwZXIubGVuZ3RoKSB7XG5cdFx0XHR3cmFwcGVyWzBdLnN0eWxlLm1heEhlaWdodCA9IG1heEhlaWdodDtcblx0XHR9XG5cdH1cbn1cblxucmVnaXN0ZXJDb2xvcignZWRpdG9ySG92ZXJXaWRnZXQuaGlnaGxpZ2h0Rm9yZWdyb3VuZCcsIGxpc3RIaWdobGlnaHRGb3JlZ3JvdW5kLCBubHMubG9jYWxpemUoJ2VkaXRvckhvdmVyV2lkZ2V0SGlnaGxpZ2h0Rm9yZWdyb3VuZCcsICdGb3JlZ3JvdW5kIGNvbG9yIG9mIHRoZSBhY3RpdmUgaXRlbSBpbiB0aGUgcGFyYW1ldGVyIGhpbnQuJykpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsWUFBWSxVQUFVO0FBQ3RCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGFBQWE7QUFFdEIsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLHVCQUF1QjtBQUNoQyxPQUFPO0FBQ1AsU0FBUyx1Q0FBNEY7QUFDckcsU0FBUyxzQkFBc0Isb0JBQW9CO0FBRW5ELFNBQVMsd0JBQXdCO0FBQ2pDLFNBQWdDLHdCQUF3QjtBQUV4RCxTQUFTLGVBQWU7QUFDeEIsWUFBWSxTQUFTO0FBQ3JCLFNBQXNCLDBCQUEwQjtBQUNoRCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHlCQUF5QixxQkFBcUI7QUFDdkQsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxpQkFBaUI7QUFFMUIsTUFBTSxJQUFJLElBQUk7QUFFZCxNQUFNLHlCQUF5QixhQUFhLHdCQUF3QixRQUFRLGFBQWEsSUFBSSxTQUFTLDBCQUEwQixvQ0FBb0MsQ0FBQztBQUNySyxNQUFNLDZCQUE2QixhQUFhLDRCQUE0QixRQUFRLFdBQVcsSUFBSSxTQUFTLDhCQUE4Qix3Q0FBd0MsQ0FBQztBQUU1SyxJQUFNLHVCQUFOLGNBQW1DLFdBQXFDO0FBQUEsRUF1QjlFLFlBQ2tCLFFBQ0EsT0FDRyxtQkFDSixlQUNFLGlCQUNqQjtBQUNELFVBQU07QUFOVztBQUNBO0FBcEJsQixTQUFpQixxQkFBcUIsS0FBSyxVQUFVLElBQUksZ0JBQWdCLENBQUM7QUFZMUUsU0FBUSxVQUFtQjtBQUMzQixTQUFRLGlCQUFnQztBQUd4QztBQUFBLCtCQUFzQjtBQVdyQixTQUFLLG1CQUFtQixJQUFJLGlCQUFpQixFQUFFLE9BQU8sR0FBRyxpQkFB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QUMzQyxRQUFJLENBQUMsT0FBTztBQUNYLGFBQU8sQ0FBQyxHQUFHLENBQUM7QUFBQSxJQUNiLFdBQVcsTUFBTSxRQUFRLE1BQU0sS0FBSyxHQUFHO0FBQ3RDLGFBQU8sTUFBTTtBQUFBLElBQ2QsV0FBVyxDQUFDLE1BQU0sTUFBTSxRQUFRO0FBQy9CLGFBQU8sQ0FBQyxHQUFHLENBQUM7QUFBQSxJQUNiLE9BQU87QUFDTixZQUFNLFFBQVEsSUFBSSxPQUFPLFVBQVUsdUJBQXVCLE1BQU0sS0FBSyxDQUFDLGFBQWEsR0FBRztBQUN0RixZQUFNLEtBQUssVUFBVSxLQUFLO0FBQzFCLFlBQU0sTUFBTSxNQUFNLFlBQVksTUFBTSxNQUFNO0FBQzFDLGFBQU8sT0FBTyxJQUNYLENBQUMsS0FBSyxNQUFNLFNBQVMsSUFDckIsQ0FBQyxHQUFHLENBQUM7QUFBQSxJQUNUO0FBQUEsRUFDRDtBQUFBLEVBRUEsT0FBYTtBQUNaLFNBQUssT0FBTyxNQUFNO0FBQ2xCLFNBQUssTUFBTSxLQUFLO0FBQUEsRUFDakI7QUFBQSxFQUVBLFdBQWlCO0FBQ2hCLFNBQUssT0FBTyxNQUFNO0FBQ2xCLFNBQUssTUFBTSxTQUFTO0FBQUEsRUFDckI7QUFBQSxFQUVBLGFBQTBCO0FBQ3pCLFFBQUksQ0FBQyxLQUFLLFVBQVU7QUFDbkIsV0FBSyw0QkFBNEI7QUFBQSxJQUNsQztBQUNBLFdBQU8sS0FBSyxTQUFVO0FBQUEsRUFDdkI7QUFBQSxFQUVBLFFBQWdCO0FBQ2YsV0FBTyxxQkFBcUI7QUFBQSxFQUM3QjtBQUFBLEVBRVEsa0JBQXdCO0FBQy9CLFFBQUksQ0FBQyxLQUFLLFVBQVU7QUFDbkI7QUFBQSxJQUNEO0FBQ0EsVUFBTSxTQUFTLEtBQUssSUFBSSxLQUFLLE9BQU8sY0FBYyxFQUFFLFNBQVMsR0FBRyxHQUFHO0FBQ25FLFVBQU0sWUFBWSxHQUFHLE1BQU07QUFDM0IsU0FBSyxTQUFTLFFBQVEsTUFBTSxZQUFZO0FBQ3hDLFVBQU0sVUFBVSxLQUFLLFNBQVMsUUFBUSx1QkFBdUIsV0FBVztBQUN4RSxRQUFJLFFBQVEsUUFBUTtBQUNuQixjQUFRLENBQUMsRUFBRSxNQUFNLFlBQVk7QUFBQSxJQUM5QjtBQUFBLEVBQ0Q7QUFDRDtBQTVVYSxxQkFFWSxLQUFLO0FBRmpCLHVCQUFOO0FBQUEsRUEwQko7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBNUJVO0FBOFViLGNBQWMseUNBQXlDLHlCQUF5QixJQUFJLFNBQVMsd0NBQXdDLDREQUE0RCxDQUFDOyIsCiAgIm5hbWVzIjogWyJlbGVtZW50IiwgIiQiXQp9Cg==
