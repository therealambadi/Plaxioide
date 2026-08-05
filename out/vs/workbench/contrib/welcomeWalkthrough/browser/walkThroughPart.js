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
import "../common/walkThroughUtils.js";
import "./media/walkThroughPart.css";
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { EventType as TouchEventType, Gesture } from "../../../../base/browser/touch.js";
import { ScrollbarVisibility } from "../../../../base/common/scrollable.js";
import * as strings from "../../../../base/common/strings.js";
import { URI } from "../../../../base/common/uri.js";
import { dispose, toDisposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { WalkThroughInput } from "./walkThroughInput.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { CodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { localize } from "../../../../nls.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { RawContextKey, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { isObject } from "../../../../base/common/types.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { UILabelProvider } from "../../../../base/common/keybindingLabels.js";
import { OS, OperatingSystem } from "../../../../base/common/platform.js";
import { deepClone } from "../../../../base/common/objects.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { addDisposableListener, isHTMLAnchorElement, isHTMLButtonElement, isHTMLElement, safeInnerHtml, size } from "../../../../base/browser/dom.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
const WALK_THROUGH_FOCUS = new RawContextKey("interactivePlaygroundFocus", false);
const UNBOUND_COMMAND = localize("walkThrough.unboundCommand", "unbound");
const WALK_THROUGH_EDITOR_VIEW_STATE_PREFERENCE_KEY = "walkThroughEditorViewState";
let WalkThroughPart = class extends EditorPane {
  constructor(group, telemetryService, themeService, textResourceConfigurationService, instantiationService, openerService, keybindingService, storageService, contextKeyService, configurationService, notificationService, extensionService, editorGroupService) {
    super(WalkThroughPart.ID, group, telemetryService, themeService, storageService);
    this.instantiationService = instantiationService;
    this.openerService = openerService;
    this.keybindingService = keybindingService;
    this.contextKeyService = contextKeyService;
    this.configurationService = configurationService;
    this.notificationService = notificationService;
    this.extensionService = extensionService;
    this.disposables = new DisposableStore();
    this.contentDisposables = [];
    this.editorFocus = WALK_THROUGH_FOCUS.bindTo(this.contextKeyService);
    this.editorMemento = this.getEditorMemento(editorGroupService, textResourceConfigurationService, WALK_THROUGH_EDITOR_VIEW_STATE_PREFERENCE_KEY);
  }
  createEditor(container) {
    this.content = document.createElement("div");
    this.content.classList.add("welcomePageFocusElement");
    this.content.tabIndex = 0;
    this.content.style.outlineStyle = "none";
    this.scrollbar = new DomScrollableElement(this.content, {
      horizontal: ScrollbarVisibility.Auto,
      vertical: ScrollbarVisibility.Auto
    });
    this.disposables.add(this.scrollbar);
    container.appendChild(this.scrollbar.getDomNode());
    this.registerFocusHandlers();
    this.registerClickHandler();
    this.disposables.add(this.scrollbar.onScroll((e) => this.updatedScrollPosition()));
  }
  updatedScrollPosition() {
    const scrollDimensions = this.scrollbar.getScrollDimensions();
    const scrollPosition = this.scrollbar.getScrollPosition();
    const scrollHeight = scrollDimensions.scrollHeight;
    if (scrollHeight && this.input instanceof WalkThroughInput) {
      const scrollTop = scrollPosition.scrollTop;
      const height = scrollDimensions.height;
      this.input.relativeScrollPosition(scrollTop / scrollHeight, (scrollTop + height) / scrollHeight);
    }
  }
  onTouchChange(event) {
    event.preventDefault();
    event.stopPropagation();
    const scrollPosition = this.scrollbar.getScrollPosition();
    this.scrollbar.setScrollPosition({ scrollTop: scrollPosition.scrollTop - event.translationY });
  }
  addEventListener(element, type, listener, useCapture) {
    element.addEventListener(type, listener, useCapture);
    return toDisposable(() => {
      element.removeEventListener(type, listener, useCapture);
    });
  }
  registerFocusHandlers() {
    this.disposables.add(this.addEventListener(this.content, "mousedown", (e) => {
      this.focus();
    }));
    this.disposables.add(this.addEventListener(this.content, "focus", (e) => {
      this.editorFocus.set(true);
    }));
    this.disposables.add(this.addEventListener(this.content, "blur", (e) => {
      this.editorFocus.reset();
    }));
    this.disposables.add(this.addEventListener(this.content, "focusin", (e) => {
      if (isHTMLElement(e.target) && e.target.classList.contains("zone-widget-container")) {
        const scrollPosition = this.scrollbar.getScrollPosition();
        this.content.scrollTop = scrollPosition.scrollTop;
        this.content.scrollLeft = scrollPosition.scrollLeft;
      }
      if (isHTMLElement(e.target)) {
        this.lastFocus = e.target;
      }
    }));
  }
  registerClickHandler() {
    this.content.addEventListener("click", (event) => {
      for (let node = event.target; node; node = node.parentNode) {
        if (isHTMLAnchorElement(node) && node.href) {
          const baseElement = node.ownerDocument.getElementsByTagName("base")[0] || this.window.location;
          if (baseElement && node.href.indexOf(baseElement.href) >= 0 && node.hash) {
            const scrollTarget = this.content.querySelector(node.hash);
            const innerContent = this.content.firstElementChild;
            if (scrollTarget && innerContent) {
              const targetTop = scrollTarget.getBoundingClientRect().top - 20;
              const containerTop = innerContent.getBoundingClientRect().top;
              this.scrollbar.setScrollPosition({ scrollTop: targetTop - containerTop });
            }
          } else {
            this.open(URI.parse(node.href));
          }
          event.preventDefault();
          break;
        } else if (isHTMLButtonElement(node)) {
          const href = node.getAttribute("data-href");
          if (href) {
            this.open(URI.parse(href));
          }
          break;
        } else if (node === event.currentTarget) {
          break;
        }
      }
    });
  }
  open(uri) {
    if (uri.scheme === "command" && uri.path === "git.clone" && !CommandsRegistry.getCommand("git.clone")) {
      this.notificationService.info(localize("walkThrough.gitNotFound", "It looks like Git is not installed on your system."));
      return;
    }
    this.openerService.open(this.addFrom(uri), { allowCommands: true });
  }
  addFrom(uri) {
    if (uri.scheme !== "command" || !(this.input instanceof WalkThroughInput)) {
      return uri;
    }
    const query = uri.query ? JSON.parse(uri.query) : {};
    query.from = this.input.getTelemetryFrom();
    return uri.with({ query: JSON.stringify(query) });
  }
  layout(dimension) {
    this.size = dimension;
    size(this.content, dimension.width, dimension.height);
    this.updateSizeClasses();
    this.contentDisposables.forEach((disposable) => {
      if (disposable instanceof CodeEditorWidget) {
        disposable.layout();
      }
    });
    const walkthroughInput = this.input instanceof WalkThroughInput && this.input;
    if (walkthroughInput && walkthroughInput.layout) {
      walkthroughInput.layout(dimension);
    }
    this.scrollbar.scanDomNode();
  }
  updateSizeClasses() {
    const innerContent = this.content.firstElementChild;
    if (this.size && innerContent) {
      innerContent.classList.toggle("max-height-685px", this.size.height <= 685);
    }
  }
  focus() {
    super.focus();
    let active = this.content.ownerDocument.activeElement;
    while (active && active !== this.content) {
      active = active.parentElement;
    }
    if (!active) {
      (this.lastFocus || this.content).focus();
    }
    this.editorFocus.set(true);
  }
  arrowUp() {
    const scrollPosition = this.scrollbar.getScrollPosition();
    this.scrollbar.setScrollPosition({ scrollTop: scrollPosition.scrollTop - this.getArrowScrollHeight() });
  }
  arrowDown() {
    const scrollPosition = this.scrollbar.getScrollPosition();
    this.scrollbar.setScrollPosition({ scrollTop: scrollPosition.scrollTop + this.getArrowScrollHeight() });
  }
  getArrowScrollHeight() {
    let fontSize = this.configurationService.getValue("editor.fontSize");
    if (typeof fontSize !== "number" || fontSize < 1) {
      fontSize = 12;
    }
    return 3 * fontSize;
  }
  pageUp() {
    const scrollDimensions = this.scrollbar.getScrollDimensions();
    const scrollPosition = this.scrollbar.getScrollPosition();
    this.scrollbar.setScrollPosition({ scrollTop: scrollPosition.scrollTop - scrollDimensions.height });
  }
  pageDown() {
    const scrollDimensions = this.scrollbar.getScrollDimensions();
    const scrollPosition = this.scrollbar.getScrollPosition();
    this.scrollbar.setScrollPosition({ scrollTop: scrollPosition.scrollTop + scrollDimensions.height });
  }
  setInput(input, options, context, token) {
    const store = new DisposableStore();
    this.contentDisposables.push(store);
    this.content.innerText = "";
    return super.setInput(input, options, context, token).then(async () => {
      if (input.resource.path.endsWith(".md")) {
        await this.extensionService.whenInstalledExtensionsRegistered();
      }
      return input.resolve();
    }).then((model) => {
      if (token.isCancellationRequested) {
        return;
      }
      const content = model.main;
      if (!input.resource.path.endsWith(".md")) {
        safeInnerHtml(this.content, content, { ALLOW_UNKNOWN_PROTOCOLS: true });
        this.updateSizeClasses();
        this.decorateContent();
        this.contentDisposables.push(this.keybindingService.onDidUpdateKeybindings(() => this.decorateContent()));
        input.onReady?.(this.content.firstElementChild, store);
        this.scrollbar.scanDomNode();
        this.loadTextEditorViewState(input);
        this.updatedScrollPosition();
        return;
      }
      const innerContent = document.createElement("div");
      innerContent.classList.add("walkThroughContent");
      const markdown = this.expandMacros(content);
      safeInnerHtml(innerContent, markdown, { ALLOW_UNKNOWN_PROTOCOLS: true });
      this.content.appendChild(innerContent);
      model.snippets.forEach((snippet, i) => {
        const model2 = snippet.textEditorModel;
        if (!model2) {
          return;
        }
        const id = `snippet-${model2.uri.fragment}`;
        const div = innerContent.querySelector(`#${id.replace(/[\\.]/g, "\\$&")}`);
        const options2 = this.getEditorOptions(model2.getLanguageId());
        const telemetryData = {
          target: this.input instanceof WalkThroughInput ? this.input.getTelemetryFrom() : void 0,
          snippet: i
        };
        const editor = this.instantiationService.createInstance(CodeEditorWidget, div, options2, {
          telemetryData
        });
        editor.setModel(model2);
        this.contentDisposables.push(editor);
        const updateHeight = (initial) => {
          const lineHeight = editor.getOption(EditorOption.lineHeight);
          const height = `${Math.max(model2.getLineCount() + 1, 4) * lineHeight}px`;
          if (div.style.height !== height) {
            div.style.height = height;
            editor.layout();
            if (!initial) {
              this.scrollbar.scanDomNode();
            }
          }
        };
        updateHeight(true);
        this.contentDisposables.push(editor.onDidChangeModelContent(() => updateHeight(false)));
        this.contentDisposables.push(editor.onDidChangeCursorPosition((e) => {
          const innerContent2 = this.content.firstElementChild;
          if (innerContent2) {
            const targetTop = div.getBoundingClientRect().top;
            const containerTop = innerContent2.getBoundingClientRect().top;
            const lineHeight = editor.getOption(EditorOption.lineHeight);
            const lineTop = targetTop + (e.position.lineNumber - 1) * lineHeight - containerTop;
            const lineBottom = lineTop + lineHeight;
            const scrollDimensions = this.scrollbar.getScrollDimensions();
            const scrollPosition = this.scrollbar.getScrollPosition();
            const scrollTop = scrollPosition.scrollTop;
            const height = scrollDimensions.height;
            if (scrollTop > lineTop) {
              this.scrollbar.setScrollPosition({ scrollTop: lineTop });
            } else if (scrollTop < lineBottom - height) {
              this.scrollbar.setScrollPosition({ scrollTop: lineBottom - height });
            }
          }
        }));
        this.contentDisposables.push(this.configurationService.onDidChangeConfiguration((e) => {
          if (e.affectsConfiguration("editor") && snippet.textEditorModel) {
            editor.updateOptions(this.getEditorOptions(snippet.textEditorModel.getLanguageId()));
          }
        }));
      });
      this.updateSizeClasses();
      this.multiCursorModifier();
      this.contentDisposables.push(this.configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("editor.multiCursorModifier")) {
          this.multiCursorModifier();
        }
      }));
      input.onReady?.(innerContent, store);
      this.scrollbar.scanDomNode();
      this.loadTextEditorViewState(input);
      this.updatedScrollPosition();
      this.contentDisposables.push(Gesture.addTarget(innerContent));
      this.contentDisposables.push(addDisposableListener(innerContent, TouchEventType.Change, (e) => this.onTouchChange(e)));
    });
  }
  getEditorOptions(language) {
    const config = deepClone(this.configurationService.getValue("editor", { overrideIdentifier: language }));
    return {
      ...isObject(config) ? config : /* @__PURE__ */ Object.create(null),
      scrollBeyondLastLine: false,
      scrollbar: {
        verticalScrollbarSize: 14,
        horizontal: "auto",
        useShadows: true,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        alwaysConsumeMouseWheel: false
      },
      overviewRulerLanes: 3,
      fixedOverflowWidgets: false,
      lineNumbersMinChars: 1,
      minimap: { enabled: false }
    };
  }
  expandMacros(input) {
    return input.replace(/kb\(([a-z.\d\-]+)\)/gi, (match, kb) => {
      const keybinding = this.keybindingService.lookupKeybinding(kb);
      const shortcut = keybinding ? keybinding.getLabel() || "" : UNBOUND_COMMAND;
      return `<span class="shortcut">${strings.escape(shortcut)}</span>`;
    });
  }
  decorateContent() {
    const keys = this.content.querySelectorAll(".shortcut[data-command]");
    Array.prototype.forEach.call(keys, (key) => {
      const command = key.getAttribute("data-command");
      const keybinding = command && this.keybindingService.lookupKeybinding(command);
      const label = keybinding ? keybinding.getLabel() || "" : UNBOUND_COMMAND;
      while (key.firstChild) {
        key.firstChild.remove();
      }
      key.appendChild(document.createTextNode(label));
    });
    const ifkeys = this.content.querySelectorAll(".if_shortcut[data-command]");
    Array.prototype.forEach.call(ifkeys, (key) => {
      const command = key.getAttribute("data-command");
      const keybinding = command && this.keybindingService.lookupKeybinding(command);
      key.style.display = !keybinding ? "none" : "";
    });
  }
  multiCursorModifier() {
    const labels = UILabelProvider.modifierLabels[OS];
    const value = this.configurationService.getValue("editor.multiCursorModifier");
    const modifier = labels[value === "ctrlCmd" ? OS === OperatingSystem.Macintosh ? "metaKey" : "ctrlKey" : "altKey"];
    const keys = this.content.querySelectorAll(".multi-cursor-modifier");
    Array.prototype.forEach.call(keys, (key) => {
      while (key.firstChild) {
        key.firstChild.remove();
      }
      key.appendChild(document.createTextNode(modifier));
    });
  }
  saveTextEditorViewState(input) {
    const scrollPosition = this.scrollbar.getScrollPosition();
    this.editorMemento.saveEditorState(this.group, input, {
      viewState: {
        scrollTop: scrollPosition.scrollTop,
        scrollLeft: scrollPosition.scrollLeft
      }
    });
  }
  loadTextEditorViewState(input) {
    const state = this.editorMemento.loadEditorState(this.group, input);
    if (state) {
      this.scrollbar.setScrollPosition(state.viewState);
    }
  }
  clearInput() {
    if (this.input instanceof WalkThroughInput) {
      this.saveTextEditorViewState(this.input);
    }
    this.contentDisposables = dispose(this.contentDisposables);
    super.clearInput();
  }
  saveState() {
    if (this.input instanceof WalkThroughInput) {
      this.saveTextEditorViewState(this.input);
    }
    super.saveState();
  }
  dispose() {
    this.editorFocus.reset();
    this.contentDisposables = dispose(this.contentDisposables);
    this.disposables.dispose();
    super.dispose();
  }
};
WalkThroughPart.ID = "workbench.editor.walkThroughPart";
WalkThroughPart = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, ITextResourceConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IOpenerService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, INotificationService),
  __decorateParam(11, IExtensionService),
  __decorateParam(12, IEditorGroupsService)
], WalkThroughPart);
export {
  WALK_THROUGH_FOCUS,
  WalkThroughPart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93ZWxjb21lV2Fsa3Rocm91Z2gvYnJvd3Nlci93YWxrVGhyb3VnaFBhcnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4uL2NvbW1vbi93YWxrVGhyb3VnaFV0aWxzLmpzJztcbmltcG9ydCAnLi9tZWRpYS93YWxrVGhyb3VnaFBhcnQuY3NzJztcbmltcG9ydCB7IERvbVNjcm9sbGFibGVFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Njcm9sbGJhci9zY3JvbGxhYmxlRWxlbWVudC5qcyc7XG5pbXBvcnQgeyBFdmVudFR5cGUgYXMgVG91Y2hFdmVudFR5cGUsIEdlc3R1cmVFdmVudCwgR2VzdHVyZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci90b3VjaC5qcyc7XG5pbXBvcnQgeyBTY3JvbGxiYXJWaXNpYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2Nyb2xsYWJsZS5qcyc7XG5pbXBvcnQgKiBhcyBzdHJpbmdzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCBkaXNwb3NlLCB0b0Rpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yTWVtZW50bywgSUVkaXRvck9wZW5Db250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yUGFuZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IFdhbGtUaHJvdWdoSW5wdXQgfSBmcm9tICcuL3dhbGtUaHJvdWdoSW5wdXQuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3RleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2NvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgUmF3Q29udGV4dEtleSwgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBpc09iamVjdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wdGlvbnMgYXMgSUNvZGVFZGl0b3JPcHRpb25zLCBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFVJTGFiZWxQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleWJpbmRpbmdMYWJlbHMuanMnO1xuaW1wb3J0IHsgT1MsIE9wZXJhdGluZ1N5c3RlbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGRlZXBDbG9uZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIERpbWVuc2lvbiwgaXNIVE1MQW5jaG9yRWxlbWVudCwgaXNIVE1MQnV0dG9uRWxlbWVudCwgaXNIVE1MRWxlbWVudCwgc2FmZUlubmVySHRtbCwgc2l6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3VwLCBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5cbmV4cG9ydCBjb25zdCBXQUxLX1RIUk9VR0hfRk9DVVMgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignaW50ZXJhY3RpdmVQbGF5Z3JvdW5kRm9jdXMnLCBmYWxzZSk7XG5cbmNvbnN0IFVOQk9VTkRfQ09NTUFORCA9IGxvY2FsaXplKCd3YWxrVGhyb3VnaC51bmJvdW5kQ29tbWFuZCcsIFwidW5ib3VuZFwiKTtcbmNvbnN0IFdBTEtfVEhST1VHSF9FRElUT1JfVklFV19TVEFURV9QUkVGRVJFTkNFX0tFWSA9ICd3YWxrVGhyb3VnaEVkaXRvclZpZXdTdGF0ZSc7XG5cbmludGVyZmFjZSBJVmlld1N0YXRlIHtcblx0c2Nyb2xsVG9wOiBudW1iZXI7XG5cdHNjcm9sbExlZnQ6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIElXYWxrVGhyb3VnaEVkaXRvclZpZXdTdGF0ZSB7XG5cdHZpZXdTdGF0ZTogSVZpZXdTdGF0ZTtcbn1cblxuZXhwb3J0IGNsYXNzIFdhbGtUaHJvdWdoUGFydCBleHRlbmRzIEVkaXRvclBhbmUge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRDogc3RyaW5nID0gJ3dvcmtiZW5jaC5lZGl0b3Iud2Fsa1Rocm91Z2hQYXJ0JztcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIGNvbnRlbnREaXNwb3NhYmxlczogSURpc3Bvc2FibGVbXSA9IFtdO1xuXHRwcml2YXRlIGNvbnRlbnQhOiBIVE1MRGl2RWxlbWVudDtcblx0cHJpdmF0ZSBzY3JvbGxiYXIhOiBEb21TY3JvbGxhYmxlRWxlbWVudDtcblx0cHJpdmF0ZSBlZGl0b3JGb2N1czogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgbGFzdEZvY3VzOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBzaXplOiBEaW1lbnNpb24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZWRpdG9yTWVtZW50bzogSUVkaXRvck1lbWVudG88SVdhbGtUaHJvdWdoRWRpdG9yVmlld1N0YXRlPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRncm91cDogSUVkaXRvckdyb3VwLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSB0ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZTogSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoV2Fsa1Rocm91Z2hQYXJ0LklELCBncm91cCwgdGVsZW1ldHJ5U2VydmljZSwgdGhlbWVTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSk7XG5cdFx0dGhpcy5lZGl0b3JGb2N1cyA9IFdBTEtfVEhST1VHSF9GT0NVUy5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5lZGl0b3JNZW1lbnRvID0gdGhpcy5nZXRFZGl0b3JNZW1lbnRvPElXYWxrVGhyb3VnaEVkaXRvclZpZXdTdGF0ZT4oZWRpdG9yR3JvdXBTZXJ2aWNlLCB0ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSwgV0FMS19USFJPVUdIX0VESVRPUl9WSUVXX1NUQVRFX1BSRUZFUkVOQ0VfS0VZKTtcblx0fVxuXG5cdHByb3RlY3RlZCBjcmVhdGVFZGl0b3IoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuY29udGVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuY29udGVudC5jbGFzc0xpc3QuYWRkKCd3ZWxjb21lUGFnZUZvY3VzRWxlbWVudCcpO1xuXHRcdHRoaXMuY29udGVudC50YWJJbmRleCA9IDA7XG5cdFx0dGhpcy5jb250ZW50LnN0eWxlLm91dGxpbmVTdHlsZSA9ICdub25lJztcblxuXHRcdHRoaXMuc2Nyb2xsYmFyID0gbmV3IERvbVNjcm9sbGFibGVFbGVtZW50KHRoaXMuY29udGVudCwge1xuXHRcdFx0aG9yaXpvbnRhbDogU2Nyb2xsYmFyVmlzaWJpbGl0eS5BdXRvLFxuXHRcdFx0dmVydGljYWw6IFNjcm9sbGJhclZpc2liaWxpdHkuQXV0b1xuXHRcdH0pO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuc2Nyb2xsYmFyKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5zY3JvbGxiYXIuZ2V0RG9tTm9kZSgpKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJGb2N1c0hhbmRsZXJzKCk7XG5cdFx0dGhpcy5yZWdpc3RlckNsaWNrSGFuZGxlcigpO1xuXG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5zY3JvbGxiYXIub25TY3JvbGwoZSA9PiB0aGlzLnVwZGF0ZWRTY3JvbGxQb3NpdGlvbigpKSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZWRTY3JvbGxQb3NpdGlvbigpIHtcblx0XHRjb25zdCBzY3JvbGxEaW1lbnNpb25zID0gdGhpcy5zY3JvbGxiYXIuZ2V0U2Nyb2xsRGltZW5zaW9ucygpO1xuXHRcdGNvbnN0IHNjcm9sbFBvc2l0aW9uID0gdGhpcy5zY3JvbGxiYXIuZ2V0U2Nyb2xsUG9zaXRpb24oKTtcblx0XHRjb25zdCBzY3JvbGxIZWlnaHQgPSBzY3JvbGxEaW1lbnNpb25zLnNjcm9sbEhlaWdodDtcblx0XHRpZiAoc2Nyb2xsSGVpZ2h0ICYmIHRoaXMuaW5wdXQgaW5zdGFuY2VvZiBXYWxrVGhyb3VnaElucHV0KSB7XG5cdFx0XHRjb25zdCBzY3JvbGxUb3AgPSBzY3JvbGxQb3NpdGlvbi5zY3JvbGxUb3A7XG5cdFx0XHRjb25zdCBoZWlnaHQgPSBzY3JvbGxEaW1lbnNpb25zLmhlaWdodDtcblx0XHRcdHRoaXMuaW5wdXQucmVsYXRpdmVTY3JvbGxQb3NpdGlvbihzY3JvbGxUb3AgLyBzY3JvbGxIZWlnaHQsIChzY3JvbGxUb3AgKyBoZWlnaHQpIC8gc2Nyb2xsSGVpZ2h0KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uVG91Y2hDaGFuZ2UoZXZlbnQ6IEdlc3R1cmVFdmVudCkge1xuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblx0XHRjb25zdCBzY3JvbGxQb3NpdGlvbiA9IHRoaXMuc2Nyb2xsYmFyLmdldFNjcm9sbFBvc2l0aW9uKCk7XG5cdFx0dGhpcy5zY3JvbGxiYXIuc2V0U2Nyb2xsUG9zaXRpb24oeyBzY3JvbGxUb3A6IHNjcm9sbFBvc2l0aW9uLnNjcm9sbFRvcCAtIGV2ZW50LnRyYW5zbGF0aW9uWSB9KTtcblx0fVxuXG5cdHByaXZhdGUgYWRkRXZlbnRMaXN0ZW5lcjxLIGV4dGVuZHMga2V5b2YgSFRNTEVsZW1lbnRFdmVudE1hcCwgRSBleHRlbmRzIEhUTUxFbGVtZW50PihlbGVtZW50OiBFLCB0eXBlOiBLLCBsaXN0ZW5lcjogKHRoaXM6IEUsIGV2OiBIVE1MRWxlbWVudEV2ZW50TWFwW0tdKSA9PiBhbnksIHVzZUNhcHR1cmU/OiBib29sZWFuKTogSURpc3Bvc2FibGU7XG5cdHByaXZhdGUgYWRkRXZlbnRMaXN0ZW5lcjxFIGV4dGVuZHMgSFRNTEVsZW1lbnQ+KGVsZW1lbnQ6IEUsIHR5cGU6IHN0cmluZywgbGlzdGVuZXI6IEV2ZW50TGlzdGVuZXJPckV2ZW50TGlzdGVuZXJPYmplY3QsIHVzZUNhcHR1cmU/OiBib29sZWFuKTogSURpc3Bvc2FibGU7XG5cdHByaXZhdGUgYWRkRXZlbnRMaXN0ZW5lcjxFIGV4dGVuZHMgSFRNTEVsZW1lbnQ+KGVsZW1lbnQ6IEUsIHR5cGU6IHN0cmluZywgbGlzdGVuZXI6IEV2ZW50TGlzdGVuZXJPckV2ZW50TGlzdGVuZXJPYmplY3QsIHVzZUNhcHR1cmU/OiBib29sZWFuKTogSURpc3Bvc2FibGUge1xuXHRcdGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lciwgdXNlQ2FwdHVyZSk7XG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7IGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lciwgdXNlQ2FwdHVyZSk7IH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckZvY3VzSGFuZGxlcnMoKSB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5hZGRFdmVudExpc3RlbmVyKHRoaXMuY29udGVudCwgJ21vdXNlZG93bicsIGUgPT4ge1xuXHRcdFx0dGhpcy5mb2N1cygpO1xuXHRcdH0pKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5jb250ZW50LCAnZm9jdXMnLCBlID0+IHtcblx0XHRcdHRoaXMuZWRpdG9yRm9jdXMuc2V0KHRydWUpO1xuXHRcdH0pKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5jb250ZW50LCAnYmx1cicsIGUgPT4ge1xuXHRcdFx0dGhpcy5lZGl0b3JGb2N1cy5yZXNldCgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLmFkZEV2ZW50TGlzdGVuZXIodGhpcy5jb250ZW50LCAnZm9jdXNpbicsIChlOiBGb2N1c0V2ZW50KSA9PiB7XG5cdFx0XHQvLyBXb3JrIGFyb3VuZCBzY3JvbGxpbmcgYXMgc2lkZS1lZmZlY3Qgb2Ygc2V0dGluZyBmb2N1cyBvbiB0aGUgb2Zmc2NyZWVuIHpvbmUgd2lkZ2V0ICgjMTg5MjkpXG5cdFx0XHRpZiAoaXNIVE1MRWxlbWVudChlLnRhcmdldCkgJiYgZS50YXJnZXQuY2xhc3NMaXN0LmNvbnRhaW5zKCd6b25lLXdpZGdldC1jb250YWluZXInKSkge1xuXHRcdFx0XHRjb25zdCBzY3JvbGxQb3NpdGlvbiA9IHRoaXMuc2Nyb2xsYmFyLmdldFNjcm9sbFBvc2l0aW9uKCk7XG5cdFx0XHRcdHRoaXMuY29udGVudC5zY3JvbGxUb3AgPSBzY3JvbGxQb3NpdGlvbi5zY3JvbGxUb3A7XG5cdFx0XHRcdHRoaXMuY29udGVudC5zY3JvbGxMZWZ0ID0gc2Nyb2xsUG9zaXRpb24uc2Nyb2xsTGVmdDtcblx0XHRcdH1cblx0XHRcdGlmIChpc0hUTUxFbGVtZW50KGUudGFyZ2V0KSkge1xuXHRcdFx0XHR0aGlzLmxhc3RGb2N1cyA9IGUudGFyZ2V0O1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJDbGlja0hhbmRsZXIoKSB7XG5cdFx0dGhpcy5jb250ZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZXZlbnQgPT4ge1xuXHRcdFx0Zm9yIChsZXQgbm9kZSA9IGV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudDsgbm9kZTsgbm9kZSA9IG5vZGUucGFyZW50Tm9kZSBhcyBIVE1MRWxlbWVudCkge1xuXHRcdFx0XHRpZiAoaXNIVE1MQW5jaG9yRWxlbWVudChub2RlKSAmJiBub2RlLmhyZWYpIHtcblx0XHRcdFx0XHRjb25zdCBiYXNlRWxlbWVudCA9IG5vZGUub3duZXJEb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnYmFzZScpWzBdIHx8IHRoaXMud2luZG93LmxvY2F0aW9uO1xuXHRcdFx0XHRcdGlmIChiYXNlRWxlbWVudCAmJiBub2RlLmhyZWYuaW5kZXhPZihiYXNlRWxlbWVudC5ocmVmKSA+PSAwICYmIG5vZGUuaGFzaCkge1xuXHRcdFx0XHRcdFx0Y29uc3Qgc2Nyb2xsVGFyZ2V0ID0gdGhpcy5jb250ZW50LnF1ZXJ5U2VsZWN0b3Iobm9kZS5oYXNoKTtcblx0XHRcdFx0XHRcdGNvbnN0IGlubmVyQ29udGVudCA9IHRoaXMuY29udGVudC5maXJzdEVsZW1lbnRDaGlsZDtcblx0XHRcdFx0XHRcdGlmIChzY3JvbGxUYXJnZXQgJiYgaW5uZXJDb250ZW50KSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHRhcmdldFRvcCA9IHNjcm9sbFRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3AgLSAyMDtcblx0XHRcdFx0XHRcdFx0Y29uc3QgY29udGFpbmVyVG9wID0gaW5uZXJDb250ZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnRvcDtcblx0XHRcdFx0XHRcdFx0dGhpcy5zY3JvbGxiYXIuc2V0U2Nyb2xsUG9zaXRpb24oeyBzY3JvbGxUb3A6IHRhcmdldFRvcCAtIGNvbnRhaW5lclRvcCB9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5vcGVuKFVSSS5wYXJzZShub2RlLmhyZWYpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fSBlbHNlIGlmIChpc0hUTUxCdXR0b25FbGVtZW50KG5vZGUpKSB7XG5cdFx0XHRcdFx0Y29uc3QgaHJlZiA9IG5vZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWhyZWYnKTtcblx0XHRcdFx0XHRpZiAoaHJlZikge1xuXHRcdFx0XHRcdFx0dGhpcy5vcGVuKFVSSS5wYXJzZShocmVmKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9IGVsc2UgaWYgKG5vZGUgPT09IGV2ZW50LmN1cnJlbnRUYXJnZXQpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBvcGVuKHVyaTogVVJJKSB7XG5cdFx0aWYgKHVyaS5zY2hlbWUgPT09ICdjb21tYW5kJyAmJiB1cmkucGF0aCA9PT0gJ2dpdC5jbG9uZScgJiYgIUNvbW1hbmRzUmVnaXN0cnkuZ2V0Q29tbWFuZCgnZ2l0LmNsb25lJykpIHtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5pbmZvKGxvY2FsaXplKCd3YWxrVGhyb3VnaC5naXROb3RGb3VuZCcsIFwiSXQgbG9va3MgbGlrZSBHaXQgaXMgbm90IGluc3RhbGxlZCBvbiB5b3VyIHN5c3RlbS5cIikpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLm9wZW5lclNlcnZpY2Uub3Blbih0aGlzLmFkZEZyb20odXJpKSwgeyBhbGxvd0NvbW1hbmRzOiB0cnVlIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRGcm9tKHVyaTogVVJJKSB7XG5cdFx0aWYgKHVyaS5zY2hlbWUgIT09ICdjb21tYW5kJyB8fCAhKHRoaXMuaW5wdXQgaW5zdGFuY2VvZiBXYWxrVGhyb3VnaElucHV0KSkge1xuXHRcdFx0cmV0dXJuIHVyaTtcblx0XHR9XG5cdFx0Y29uc3QgcXVlcnkgPSB1cmkucXVlcnkgPyBKU09OLnBhcnNlKHVyaS5xdWVyeSkgOiB7fTtcblx0XHRxdWVyeS5mcm9tID0gdGhpcy5pbnB1dC5nZXRUZWxlbWV0cnlGcm9tKCk7XG5cdFx0cmV0dXJuIHVyaS53aXRoKHsgcXVlcnk6IEpTT04uc3RyaW5naWZ5KHF1ZXJ5KSB9KTtcblx0fVxuXG5cdGxheW91dChkaW1lbnNpb246IERpbWVuc2lvbik6IHZvaWQge1xuXHRcdHRoaXMuc2l6ZSA9IGRpbWVuc2lvbjtcblx0XHRzaXplKHRoaXMuY29udGVudCwgZGltZW5zaW9uLndpZHRoLCBkaW1lbnNpb24uaGVpZ2h0KTtcblx0XHR0aGlzLnVwZGF0ZVNpemVDbGFzc2VzKCk7XG5cdFx0dGhpcy5jb250ZW50RGlzcG9zYWJsZXMuZm9yRWFjaChkaXNwb3NhYmxlID0+IHtcblx0XHRcdGlmIChkaXNwb3NhYmxlIGluc3RhbmNlb2YgQ29kZUVkaXRvcldpZGdldCkge1xuXHRcdFx0XHRkaXNwb3NhYmxlLmxheW91dCgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGNvbnN0IHdhbGt0aHJvdWdoSW5wdXQgPSB0aGlzLmlucHV0IGluc3RhbmNlb2YgV2Fsa1Rocm91Z2hJbnB1dCAmJiB0aGlzLmlucHV0O1xuXHRcdGlmICh3YWxrdGhyb3VnaElucHV0ICYmIHdhbGt0aHJvdWdoSW5wdXQubGF5b3V0KSB7XG5cdFx0XHR3YWxrdGhyb3VnaElucHV0LmxheW91dChkaW1lbnNpb24pO1xuXHRcdH1cblx0XHR0aGlzLnNjcm9sbGJhci5zY2FuRG9tTm9kZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVTaXplQ2xhc3NlcygpIHtcblx0XHRjb25zdCBpbm5lckNvbnRlbnQgPSB0aGlzLmNvbnRlbnQuZmlyc3RFbGVtZW50Q2hpbGQ7XG5cdFx0aWYgKHRoaXMuc2l6ZSAmJiBpbm5lckNvbnRlbnQpIHtcblx0XHRcdGlubmVyQ29udGVudC5jbGFzc0xpc3QudG9nZ2xlKCdtYXgtaGVpZ2h0LTY4NXB4JywgdGhpcy5zaXplLmhlaWdodCA8PSA2ODUpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGZvY3VzKCk6IHZvaWQge1xuXHRcdHN1cGVyLmZvY3VzKCk7XG5cblx0XHRsZXQgYWN0aXZlID0gdGhpcy5jb250ZW50Lm93bmVyRG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcblx0XHR3aGlsZSAoYWN0aXZlICYmIGFjdGl2ZSAhPT0gdGhpcy5jb250ZW50KSB7XG5cdFx0XHRhY3RpdmUgPSBhY3RpdmUucGFyZW50RWxlbWVudDtcblx0XHR9XG5cdFx0aWYgKCFhY3RpdmUpIHtcblx0XHRcdCh0aGlzLmxhc3RGb2N1cyB8fCB0aGlzLmNvbnRlbnQpLmZvY3VzKCk7XG5cdFx0fVxuXHRcdHRoaXMuZWRpdG9yRm9jdXMuc2V0KHRydWUpO1xuXHR9XG5cblx0YXJyb3dVcCgpIHtcblx0XHRjb25zdCBzY3JvbGxQb3NpdGlvbiA9IHRoaXMuc2Nyb2xsYmFyLmdldFNjcm9sbFBvc2l0aW9uKCk7XG5cdFx0dGhpcy5zY3JvbGxiYXIuc2V0U2Nyb2xsUG9zaXRpb24oeyBzY3JvbGxUb3A6IHNjcm9sbFBvc2l0aW9uLnNjcm9sbFRvcCAtIHRoaXMuZ2V0QXJyb3dTY3JvbGxIZWlnaHQoKSB9KTtcblx0fVxuXG5cdGFycm93RG93bigpIHtcblx0XHRjb25zdCBzY3JvbGxQb3NpdGlvbiA9IHRoaXMuc2Nyb2xsYmFyLmdldFNjcm9sbFBvc2l0aW9uKCk7XG5cdFx0dGhpcy5zY3JvbGxiYXIuc2V0U2Nyb2xsUG9zaXRpb24oeyBzY3JvbGxUb3A6IHNjcm9sbFBvc2l0aW9uLnNjcm9sbFRvcCArIHRoaXMuZ2V0QXJyb3dTY3JvbGxIZWlnaHQoKSB9KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QXJyb3dTY3JvbGxIZWlnaHQoKSB7XG5cdFx0bGV0IGZvbnRTaXplID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnZWRpdG9yLmZvbnRTaXplJyk7XG5cdFx0aWYgKHR5cGVvZiBmb250U2l6ZSAhPT0gJ251bWJlcicgfHwgZm9udFNpemUgPCAxKSB7XG5cdFx0XHRmb250U2l6ZSA9IDEyO1xuXHRcdH1cblx0XHRyZXR1cm4gMyAqIChmb250U2l6ZSBhcyBudW1iZXIpO1xuXHR9XG5cblx0cGFnZVVwKCkge1xuXHRcdGNvbnN0IHNjcm9sbERpbWVuc2lvbnMgPSB0aGlzLnNjcm9sbGJhci5nZXRTY3JvbGxEaW1lbnNpb25zKCk7XG5cdFx0Y29uc3Qgc2Nyb2xsUG9zaXRpb24gPSB0aGlzLnNjcm9sbGJhci5nZXRTY3JvbGxQb3NpdGlvbigpO1xuXHRcdHRoaXMuc2Nyb2xsYmFyLnNldFNjcm9sbFBvc2l0aW9uKHsgc2Nyb2xsVG9wOiBzY3JvbGxQb3NpdGlvbi5zY3JvbGxUb3AgLSBzY3JvbGxEaW1lbnNpb25zLmhlaWdodCB9KTtcblx0fVxuXG5cdHBhZ2VEb3duKCkge1xuXHRcdGNvbnN0IHNjcm9sbERpbWVuc2lvbnMgPSB0aGlzLnNjcm9sbGJhci5nZXRTY3JvbGxEaW1lbnNpb25zKCk7XG5cdFx0Y29uc3Qgc2Nyb2xsUG9zaXRpb24gPSB0aGlzLnNjcm9sbGJhci5nZXRTY3JvbGxQb3NpdGlvbigpO1xuXHRcdHRoaXMuc2Nyb2xsYmFyLnNldFNjcm9sbFBvc2l0aW9uKHsgc2Nyb2xsVG9wOiBzY3JvbGxQb3NpdGlvbi5zY3JvbGxUb3AgKyBzY3JvbGxEaW1lbnNpb25zLmhlaWdodCB9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHNldElucHV0KGlucHV0OiBXYWxrVGhyb3VnaElucHV0LCBvcHRpb25zOiBJRWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCwgY29udGV4dDogSUVkaXRvck9wZW5Db250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHR0aGlzLmNvbnRlbnREaXNwb3NhYmxlcy5wdXNoKHN0b3JlKTtcblxuXHRcdHRoaXMuY29udGVudC5pbm5lclRleHQgPSAnJztcblxuXHRcdHJldHVybiBzdXBlci5zZXRJbnB1dChpbnB1dCwgb3B0aW9ucywgY29udGV4dCwgdG9rZW4pXG5cdFx0XHQudGhlbihhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGlmIChpbnB1dC5yZXNvdXJjZS5wYXRoLmVuZHNXaXRoKCcubWQnKSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uU2VydmljZS53aGVuSW5zdGFsbGVkRXh0ZW5zaW9uc1JlZ2lzdGVyZWQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gaW5wdXQucmVzb2x2ZSgpO1xuXHRcdFx0fSlcblx0XHRcdC50aGVuKG1vZGVsID0+IHtcblx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgY29udGVudCA9IG1vZGVsLm1haW47XG5cdFx0XHRcdGlmICghaW5wdXQucmVzb3VyY2UucGF0aC5lbmRzV2l0aCgnLm1kJykpIHtcblx0XHRcdFx0XHRzYWZlSW5uZXJIdG1sKHRoaXMuY29udGVudCwgY29udGVudCwgeyBBTExPV19VTktOT1dOX1BST1RPQ09MUzogdHJ1ZSB9KTtcblxuXHRcdFx0XHRcdHRoaXMudXBkYXRlU2l6ZUNsYXNzZXMoKTtcblx0XHRcdFx0XHR0aGlzLmRlY29yYXRlQ29udGVudCgpO1xuXHRcdFx0XHRcdHRoaXMuY29udGVudERpc3Bvc2FibGVzLnB1c2godGhpcy5rZXliaW5kaW5nU2VydmljZS5vbkRpZFVwZGF0ZUtleWJpbmRpbmdzKCgpID0+IHRoaXMuZGVjb3JhdGVDb250ZW50KCkpKTtcblx0XHRcdFx0XHRpbnB1dC5vblJlYWR5Py4odGhpcy5jb250ZW50LmZpcnN0RWxlbWVudENoaWxkIGFzIEhUTUxFbGVtZW50LCBzdG9yZSk7XG5cdFx0XHRcdFx0dGhpcy5zY3JvbGxiYXIuc2NhbkRvbU5vZGUoKTtcblx0XHRcdFx0XHR0aGlzLmxvYWRUZXh0RWRpdG9yVmlld1N0YXRlKGlucHV0KTtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZWRTY3JvbGxQb3NpdGlvbigpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGlubmVyQ29udGVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0XHRpbm5lckNvbnRlbnQuY2xhc3NMaXN0LmFkZCgnd2Fsa1Rocm91Z2hDb250ZW50Jyk7IC8vIG9ubHkgZm9yIG1hcmtkb3duIGZpbGVzXG5cdFx0XHRcdGNvbnN0IG1hcmtkb3duID0gdGhpcy5leHBhbmRNYWNyb3MoY29udGVudCk7XG5cdFx0XHRcdHNhZmVJbm5lckh0bWwoaW5uZXJDb250ZW50LCBtYXJrZG93biwgeyBBTExPV19VTktOT1dOX1BST1RPQ09MUzogdHJ1ZSB9KTtcblx0XHRcdFx0dGhpcy5jb250ZW50LmFwcGVuZENoaWxkKGlubmVyQ29udGVudCk7XG5cblx0XHRcdFx0bW9kZWwuc25pcHBldHMuZm9yRWFjaCgoc25pcHBldCwgaSkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG1vZGVsID0gc25pcHBldC50ZXh0RWRpdG9yTW9kZWw7XG5cdFx0XHRcdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCBpZCA9IGBzbmlwcGV0LSR7bW9kZWwudXJpLmZyYWdtZW50fWA7XG5cdFx0XHRcdFx0Y29uc3QgZGl2ID0gaW5uZXJDb250ZW50LnF1ZXJ5U2VsZWN0b3IoYCMke2lkLnJlcGxhY2UoL1tcXFxcLl0vZywgJ1xcXFwkJicpfWApIGFzIEhUTUxFbGVtZW50O1xuXG5cdFx0XHRcdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuZ2V0RWRpdG9yT3B0aW9ucyhtb2RlbC5nZXRMYW5ndWFnZUlkKCkpO1xuXHRcdFx0XHRcdGNvbnN0IHRlbGVtZXRyeURhdGEgPSB7XG5cdFx0XHRcdFx0XHR0YXJnZXQ6IHRoaXMuaW5wdXQgaW5zdGFuY2VvZiBXYWxrVGhyb3VnaElucHV0ID8gdGhpcy5pbnB1dC5nZXRUZWxlbWV0cnlGcm9tKCkgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRzbmlwcGV0OiBpXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvZGVFZGl0b3JXaWRnZXQsIGRpdiwgb3B0aW9ucywge1xuXHRcdFx0XHRcdFx0dGVsZW1ldHJ5RGF0YTogdGVsZW1ldHJ5RGF0YVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGVkaXRvci5zZXRNb2RlbChtb2RlbCk7XG5cdFx0XHRcdFx0dGhpcy5jb250ZW50RGlzcG9zYWJsZXMucHVzaChlZGl0b3IpO1xuXG5cdFx0XHRcdFx0Y29uc3QgdXBkYXRlSGVpZ2h0ID0gKGluaXRpYWw6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGxpbmVIZWlnaHQgPSBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHRcdFx0XHRcdGNvbnN0IGhlaWdodCA9IGAke01hdGgubWF4KG1vZGVsLmdldExpbmVDb3VudCgpICsgMSwgNCkgKiBsaW5lSGVpZ2h0fXB4YDtcblx0XHRcdFx0XHRcdGlmIChkaXYuc3R5bGUuaGVpZ2h0ICE9PSBoZWlnaHQpIHtcblx0XHRcdFx0XHRcdFx0ZGl2LnN0eWxlLmhlaWdodCA9IGhlaWdodDtcblx0XHRcdFx0XHRcdFx0ZWRpdG9yLmxheW91dCgpO1xuXHRcdFx0XHRcdFx0XHRpZiAoIWluaXRpYWwpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnNjcm9sbGJhci5zY2FuRG9tTm9kZSgpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR1cGRhdGVIZWlnaHQodHJ1ZSk7XG5cdFx0XHRcdFx0dGhpcy5jb250ZW50RGlzcG9zYWJsZXMucHVzaChlZGl0b3Iub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQoKCkgPT4gdXBkYXRlSGVpZ2h0KGZhbHNlKSkpO1xuXHRcdFx0XHRcdHRoaXMuY29udGVudERpc3Bvc2FibGVzLnB1c2goZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb24oZSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBpbm5lckNvbnRlbnQgPSB0aGlzLmNvbnRlbnQuZmlyc3RFbGVtZW50Q2hpbGQ7XG5cdFx0XHRcdFx0XHRpZiAoaW5uZXJDb250ZW50KSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHRhcmdldFRvcCA9IGRpdi5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3A7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNvbnRhaW5lclRvcCA9IGlubmVyQ29udGVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3A7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxpbmVIZWlnaHQgPSBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbGluZVRvcCA9ICh0YXJnZXRUb3AgKyAoZS5wb3NpdGlvbi5saW5lTnVtYmVyIC0gMSkgKiBsaW5lSGVpZ2h0KSAtIGNvbnRhaW5lclRvcDtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbGluZUJvdHRvbSA9IGxpbmVUb3AgKyBsaW5lSGVpZ2h0O1xuXHRcdFx0XHRcdFx0XHRjb25zdCBzY3JvbGxEaW1lbnNpb25zID0gdGhpcy5zY3JvbGxiYXIuZ2V0U2Nyb2xsRGltZW5zaW9ucygpO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBzY3JvbGxQb3NpdGlvbiA9IHRoaXMuc2Nyb2xsYmFyLmdldFNjcm9sbFBvc2l0aW9uKCk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHNjcm9sbFRvcCA9IHNjcm9sbFBvc2l0aW9uLnNjcm9sbFRvcDtcblx0XHRcdFx0XHRcdFx0Y29uc3QgaGVpZ2h0ID0gc2Nyb2xsRGltZW5zaW9ucy5oZWlnaHQ7XG5cdFx0XHRcdFx0XHRcdGlmIChzY3JvbGxUb3AgPiBsaW5lVG9wKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5zY3JvbGxiYXIuc2V0U2Nyb2xsUG9zaXRpb24oeyBzY3JvbGxUb3A6IGxpbmVUb3AgfSk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoc2Nyb2xsVG9wIDwgbGluZUJvdHRvbSAtIGhlaWdodCkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMuc2Nyb2xsYmFyLnNldFNjcm9sbFBvc2l0aW9uKHsgc2Nyb2xsVG9wOiBsaW5lQm90dG9tIC0gaGVpZ2h0IH0pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdFx0dGhpcy5jb250ZW50RGlzcG9zYWJsZXMucHVzaCh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdFx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3InKSAmJiBzbmlwcGV0LnRleHRFZGl0b3JNb2RlbCkge1xuXHRcdFx0XHRcdFx0XHRlZGl0b3IudXBkYXRlT3B0aW9ucyh0aGlzLmdldEVkaXRvck9wdGlvbnMoc25pcHBldC50ZXh0RWRpdG9yTW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGhpcy51cGRhdGVTaXplQ2xhc3NlcygpO1xuXHRcdFx0XHR0aGlzLm11bHRpQ3Vyc29yTW9kaWZpZXIoKTtcblx0XHRcdFx0dGhpcy5jb250ZW50RGlzcG9zYWJsZXMucHVzaCh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZWRpdG9yLm11bHRpQ3Vyc29yTW9kaWZpZXInKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5tdWx0aUN1cnNvck1vZGlmaWVyKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHRcdGlucHV0Lm9uUmVhZHk/Lihpbm5lckNvbnRlbnQsIHN0b3JlKTtcblx0XHRcdFx0dGhpcy5zY3JvbGxiYXIuc2NhbkRvbU5vZGUoKTtcblx0XHRcdFx0dGhpcy5sb2FkVGV4dEVkaXRvclZpZXdTdGF0ZShpbnB1dCk7XG5cdFx0XHRcdHRoaXMudXBkYXRlZFNjcm9sbFBvc2l0aW9uKCk7XG5cdFx0XHRcdHRoaXMuY29udGVudERpc3Bvc2FibGVzLnB1c2goR2VzdHVyZS5hZGRUYXJnZXQoaW5uZXJDb250ZW50KSk7XG5cdFx0XHRcdHRoaXMuY29udGVudERpc3Bvc2FibGVzLnB1c2goYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGlubmVyQ29udGVudCwgVG91Y2hFdmVudFR5cGUuQ2hhbmdlLCBlID0+IHRoaXMub25Ub3VjaENoYW5nZShlIGFzIEdlc3R1cmVFdmVudCkpKTtcblx0XHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRFZGl0b3JPcHRpb25zKGxhbmd1YWdlOiBzdHJpbmcpOiBJQ29kZUVkaXRvck9wdGlvbnMge1xuXHRcdGNvbnN0IGNvbmZpZyA9IGRlZXBDbG9uZSh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElFZGl0b3JPcHRpb25zPignZWRpdG9yJywgeyBvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlIH0pKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4uaXNPYmplY3QoY29uZmlnKSA/IGNvbmZpZyA6IE9iamVjdC5jcmVhdGUobnVsbCksXG5cdFx0XHRzY3JvbGxCZXlvbmRMYXN0TGluZTogZmFsc2UsXG5cdFx0XHRzY3JvbGxiYXI6IHtcblx0XHRcdFx0dmVydGljYWxTY3JvbGxiYXJTaXplOiAxNCxcblx0XHRcdFx0aG9yaXpvbnRhbDogJ2F1dG8nLFxuXHRcdFx0XHR1c2VTaGFkb3dzOiB0cnVlLFxuXHRcdFx0XHR2ZXJ0aWNhbEhhc0Fycm93czogZmFsc2UsXG5cdFx0XHRcdGhvcml6b250YWxIYXNBcnJvd3M6IGZhbHNlLFxuXHRcdFx0XHRhbHdheXNDb25zdW1lTW91c2VXaGVlbDogZmFsc2Vcblx0XHRcdH0sXG5cdFx0XHRvdmVydmlld1J1bGVyTGFuZXM6IDMsXG5cdFx0XHRmaXhlZE92ZXJmbG93V2lkZ2V0czogZmFsc2UsXG5cdFx0XHRsaW5lTnVtYmVyc01pbkNoYXJzOiAxLFxuXHRcdFx0bWluaW1hcDogeyBlbmFibGVkOiBmYWxzZSB9LFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGV4cGFuZE1hY3JvcyhpbnB1dDogc3RyaW5nKSB7XG5cdFx0cmV0dXJuIGlucHV0LnJlcGxhY2UoL2tiXFwoKFthLXouXFxkXFwtXSspXFwpL2dpLCAobWF0Y2g6IHN0cmluZywga2I6IHN0cmluZykgPT4ge1xuXHRcdFx0Y29uc3Qga2V5YmluZGluZyA9IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhrYik7XG5cdFx0XHRjb25zdCBzaG9ydGN1dCA9IGtleWJpbmRpbmcgPyBrZXliaW5kaW5nLmdldExhYmVsKCkgfHwgJycgOiBVTkJPVU5EX0NPTU1BTkQ7XG5cdFx0XHRyZXR1cm4gYDxzcGFuIGNsYXNzPVwic2hvcnRjdXRcIj4ke3N0cmluZ3MuZXNjYXBlKHNob3J0Y3V0KX08L3NwYW4+YDtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZGVjb3JhdGVDb250ZW50KCkge1xuXHRcdGNvbnN0IGtleXMgPSB0aGlzLmNvbnRlbnQucXVlcnlTZWxlY3RvckFsbCgnLnNob3J0Y3V0W2RhdGEtY29tbWFuZF0nKTtcblx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKGtleXMsIChrZXk6IEVsZW1lbnQpID0+IHtcblx0XHRcdGNvbnN0IGNvbW1hbmQgPSBrZXkuZ2V0QXR0cmlidXRlKCdkYXRhLWNvbW1hbmQnKTtcblx0XHRcdGNvbnN0IGtleWJpbmRpbmcgPSBjb21tYW5kICYmIHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhjb21tYW5kKTtcblx0XHRcdGNvbnN0IGxhYmVsID0ga2V5YmluZGluZyA/IGtleWJpbmRpbmcuZ2V0TGFiZWwoKSB8fCAnJyA6IFVOQk9VTkRfQ09NTUFORDtcblx0XHRcdHdoaWxlIChrZXkuZmlyc3RDaGlsZCkge1xuXHRcdFx0XHRrZXkuZmlyc3RDaGlsZC5yZW1vdmUoKTtcblx0XHRcdH1cblx0XHRcdGtleS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShsYWJlbCkpO1xuXHRcdH0pO1xuXHRcdGNvbnN0IGlma2V5cyA9IHRoaXMuY29udGVudC5xdWVyeVNlbGVjdG9yQWxsKCcuaWZfc2hvcnRjdXRbZGF0YS1jb21tYW5kXScpO1xuXHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoaWZrZXlzLCAoa2V5OiBIVE1MRWxlbWVudCkgPT4ge1xuXHRcdFx0Y29uc3QgY29tbWFuZCA9IGtleS5nZXRBdHRyaWJ1dGUoJ2RhdGEtY29tbWFuZCcpO1xuXHRcdFx0Y29uc3Qga2V5YmluZGluZyA9IGNvbW1hbmQgJiYgdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGNvbW1hbmQpO1xuXHRcdFx0a2V5LnN0eWxlLmRpc3BsYXkgPSAha2V5YmluZGluZyA/ICdub25lJyA6ICcnO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBtdWx0aUN1cnNvck1vZGlmaWVyKCkge1xuXHRcdGNvbnN0IGxhYmVscyA9IFVJTGFiZWxQcm92aWRlci5tb2RpZmllckxhYmVsc1tPU107XG5cdFx0Y29uc3QgdmFsdWUgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdlZGl0b3IubXVsdGlDdXJzb3JNb2RpZmllcicpO1xuXHRcdGNvbnN0IG1vZGlmaWVyID0gbGFiZWxzW3ZhbHVlID09PSAnY3RybENtZCcgPyAoT1MgPT09IE9wZXJhdGluZ1N5c3RlbS5NYWNpbnRvc2ggPyAnbWV0YUtleScgOiAnY3RybEtleScpIDogJ2FsdEtleSddO1xuXHRcdGNvbnN0IGtleXMgPSB0aGlzLmNvbnRlbnQucXVlcnlTZWxlY3RvckFsbCgnLm11bHRpLWN1cnNvci1tb2RpZmllcicpO1xuXHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoa2V5cywgKGtleTogRWxlbWVudCkgPT4ge1xuXHRcdFx0d2hpbGUgKGtleS5maXJzdENoaWxkKSB7XG5cdFx0XHRcdGtleS5maXJzdENoaWxkLnJlbW92ZSgpO1xuXHRcdFx0fVxuXHRcdFx0a2V5LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKG1vZGlmaWVyKSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHNhdmVUZXh0RWRpdG9yVmlld1N0YXRlKGlucHV0OiBXYWxrVGhyb3VnaElucHV0KTogdm9pZCB7XG5cdFx0Y29uc3Qgc2Nyb2xsUG9zaXRpb24gPSB0aGlzLnNjcm9sbGJhci5nZXRTY3JvbGxQb3NpdGlvbigpO1xuXG5cdFx0dGhpcy5lZGl0b3JNZW1lbnRvLnNhdmVFZGl0b3JTdGF0ZSh0aGlzLmdyb3VwLCBpbnB1dCwge1xuXHRcdFx0dmlld1N0YXRlOiB7XG5cdFx0XHRcdHNjcm9sbFRvcDogc2Nyb2xsUG9zaXRpb24uc2Nyb2xsVG9wLFxuXHRcdFx0XHRzY3JvbGxMZWZ0OiBzY3JvbGxQb3NpdGlvbi5zY3JvbGxMZWZ0XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGxvYWRUZXh0RWRpdG9yVmlld1N0YXRlKGlucHV0OiBXYWxrVGhyb3VnaElucHV0KSB7XG5cdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLmVkaXRvck1lbWVudG8ubG9hZEVkaXRvclN0YXRlKHRoaXMuZ3JvdXAsIGlucHV0KTtcblx0XHRpZiAoc3RhdGUpIHtcblx0XHRcdHRoaXMuc2Nyb2xsYmFyLnNldFNjcm9sbFBvc2l0aW9uKHN0YXRlLnZpZXdTdGF0ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGNsZWFySW5wdXQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaW5wdXQgaW5zdGFuY2VvZiBXYWxrVGhyb3VnaElucHV0KSB7XG5cdFx0XHR0aGlzLnNhdmVUZXh0RWRpdG9yVmlld1N0YXRlKHRoaXMuaW5wdXQpO1xuXHRcdH1cblx0XHR0aGlzLmNvbnRlbnREaXNwb3NhYmxlcyA9IGRpc3Bvc2UodGhpcy5jb250ZW50RGlzcG9zYWJsZXMpO1xuXHRcdHN1cGVyLmNsZWFySW5wdXQoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBzYXZlU3RhdGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaW5wdXQgaW5zdGFuY2VvZiBXYWxrVGhyb3VnaElucHV0KSB7XG5cdFx0XHR0aGlzLnNhdmVUZXh0RWRpdG9yVmlld1N0YXRlKHRoaXMuaW5wdXQpO1xuXHRcdH1cblxuXHRcdHN1cGVyLnNhdmVTdGF0ZSgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmVkaXRvckZvY3VzLnJlc2V0KCk7XG5cdFx0dGhpcy5jb250ZW50RGlzcG9zYWJsZXMgPSBkaXNwb3NlKHRoaXMuY29udGVudERpc3Bvc2FibGVzKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLE9BQU87QUFDUCxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGFBQWEsZ0JBQThCLGVBQWU7QUFDbkUsU0FBUywyQkFBMkI7QUFDcEMsWUFBWSxhQUFhO0FBQ3pCLFNBQVMsV0FBVztBQUNwQixTQUFzQixTQUFTLGNBQWMsdUJBQXVCO0FBRXBFLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMseUNBQXlDO0FBQ2xELFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZUFBNEIsMEJBQTBCO0FBQy9ELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQStDLG9CQUFvQjtBQUNuRSxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLElBQUksdUJBQXVCO0FBQ3BDLFNBQVMsaUJB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
