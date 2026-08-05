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
import "./emptyTextEditorHint.css";
import * as dom from "../../../../../base/browser/dom.js";
import { DisposableStore, dispose } from "../../../../../base/common/lifecycle.js";
import { ContentWidgetPositionPreference } from "../../../../../editor/browser/editorBrowser.js";
import { localize } from "../../../../../nls.js";
import { ChangeLanguageAction } from "../../../../browser/parts/editor/editorStatus.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../../editor/common/languages/modesRegistry.js";
import { Schemas } from "../../../../../base/common/network.js";
import { Event } from "../../../../../base/common/event.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { EditorOption } from "../../../../../editor/common/config/editorOptions.js";
import { EditorContributionInstantiation, registerEditorContribution } from "../../../../../editor/browser/editorExtensions.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { renderFormattedText } from "../../../../../base/browser/formattedTextRenderer.js";
import { ApplyFileSnippetAction } from "../../../snippets/browser/commands/fileTemplateSnippets.js";
import { IInlineChatSessionService } from "../../../inlineChat/browser/inlineChatSessionService.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { KeybindingLabel } from "../../../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { OS } from "../../../../../base/common/platform.js";
import { status } from "../../../../../base/browser/ui/aria/aria.js";
import { AccessibilityVerbositySettingId } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { LOG_MODE_ID, OUTPUT_MODE_ID } from "../../../../services/output/common/output.js";
import { SEARCH_RESULT_LANGUAGE_ID } from "../../../../services/search/common/search.js";
import { getDefaultHoverDelegate } from "../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IChatAgentService } from "../../../chat/common/chatAgents.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { StandardMouseEvent } from "../../../../../base/browser/mouseEvent.js";
import { ChatAgentLocation } from "../../../chat/common/constants.js";
const $ = dom.$;
const emptyTextEditorHintSetting = "workbench.editor.empty.hint";
let EmptyTextEditorHintContribution = class {
  constructor(editor, editorGroupsService, commandService, configurationService, hoverService, keybindingService, inlineChatSessionService, chatAgentService, telemetryService, productService, contextMenuService) {
    this.editor = editor;
    this.editorGroupsService = editorGroupsService;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.hoverService = hoverService;
    this.keybindingService = keybindingService;
    this.inlineChatSessionService = inlineChatSessionService;
    this.chatAgentService = chatAgentService;
    this.telemetryService = telemetryService;
    this.productService = productService;
    this.contextMenuService = contextMenuService;
    this.toDispose = [];
    this.toDispose.push(this.editor.onDidChangeModel(() => this.update()));
    this.toDispose.push(this.editor.onDidChangeModelLanguage(() => this.update()));
    this.toDispose.push(this.editor.onDidChangeModelContent(() => this.update()));
    this.toDispose.push(this.chatAgentService.onDidChangeAgents(() => this.update()));
    this.toDispose.push(this.editor.onDidChangeModelDecorations(() => this.update()));
    this.toDispose.push(this.editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.readOnly)) {
        this.update();
      }
    }));
    this.toDispose.push(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(emptyTextEditorHintSetting)) {
        this.update();
      }
    }));
    this.toDispose.push(inlineChatSessionService.onWillStartSession((editor2) => {
      if (this.editor === editor2) {
        this.textHintContentWidget?.dispose();
      }
    }));
    this.toDispose.push(inlineChatSessionService.onDidEndSession((e) => {
      if (this.editor === e.editor) {
        this.update();
      }
    }));
  }
  _getOptions() {
    return { clickable: true };
  }
  _shouldRenderHint() {
    const configValue = this.configurationService.getValue(emptyTextEditorHintSetting);
    if (configValue === "hidden") {
      return false;
    }
    if (this.editor.getOption(EditorOption.readOnly)) {
      return false;
    }
    const model = this.editor.getModel();
    const languageId = model?.getLanguageId();
    if (!model || languageId === OUTPUT_MODE_ID || languageId === LOG_MODE_ID || languageId === SEARCH_RESULT_LANGUAGE_ID) {
      return false;
    }
    if (this.inlineChatSessionService.getSession(this.editor, model.uri)) {
      return false;
    }
    if (this.editor.getModel()?.getValueLength()) {
      return false;
    }
    const hasConflictingDecorations = Boolean(this.editor.getLineDecorations(1)?.find(
      (d) => d.options.beforeContentClassName || d.options.afterContentClassName || d.options.before?.content || d.options.after?.content
    ));
    if (hasConflictingDecorations) {
      return false;
    }
    const hasEditorAgents = Boolean(this.chatAgentService.getDefaultAgent(ChatAgentLocation.Editor));
    const shouldRenderDefaultHint = model?.uri.scheme === Schemas.untitled && languageId === PLAINTEXT_LANGUAGE_ID;
    return hasEditorAgents || shouldRenderDefaultHint;
  }
  update() {
    const shouldRenderHint = this._shouldRenderHint();
    if (shouldRenderHint && !this.textHintContentWidget) {
      this.textHintContentWidget = new EmptyTextEditorHintContentWidget(
        this.editor,
        this._getOptions(),
        this.editorGroupsService,
        this.commandService,
        this.configurationService,
        this.hoverService,
        this.keybindingService,
        this.chatAgentService,
        this.telemetryService,
        this.productService,
        this.contextMenuService
      );
    } else if (!shouldRenderHint && this.textHintContentWidget) {
      this.textHintContentWidget.dispose();
      this.textHintContentWidget = void 0;
    }
  }
  dispose() {
    dispose(this.toDispose);
    this.textHintContentWidget?.dispose();
  }
};
EmptyTextEditorHintContribution.ID = "editor.contrib.emptyTextEditorHint";
EmptyTextEditorHintContribution = __decorateClass([
  __decorateParam(1, IEditorGroupsService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IInlineChatSessionService),
  __decorateParam(7, IChatAgentService),
  __decorateParam(8, ITelemetryService),
  __decorateParam(9, IProductService),
  __decorateParam(10, IContextMenuService)
], EmptyTextEditorHintContribution);
const _EmptyTextEditorHintContentWidget = class _EmptyTextEditorHintContentWidget {
  constructor(editor, options, editorGroupsService, commandService, configurationService, hoverService, keybindingService, chatAgentService, telemetryService, productService, contextMenuService) {
    this.editor = editor;
    this.options = options;
    this.editorGroupsService = editorGroupsService;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.hoverService = hoverService;
    this.keybindingService = keybindingService;
    this.chatAgentService = chatAgentService;
    this.telemetryService = telemetryService;
    this.productService = productService;
    this.contextMenuService = contextMenuService;
    this.isVisible = false;
    this.ariaLabel = "";
    this.toDispose = new DisposableStore();
    this.toDispose.add(this.editor.onDidChangeConfiguration((e) => {
      if (this.domNode && e.hasChanged(EditorOption.fontInfo)) {
        this.editor.applyFontInfo(this.domNode);
      }
    }));
    const onDidFocusEditorText = Event.debounce(this.editor.onDidFocusEditorText, () => void 0, 500);
    this.toDispose.add(onDidFocusEditorText(() => {
      if (this.editor.hasTextFocus() && this.isVisible && this.ariaLabel && this.configurationService.getValue(AccessibilityVerbositySettingId.EmptyEditorHint)) {
        status(this.ariaLabel);
      }
    }));
    this.editor.addContentWidget(this);
  }
  getId() {
    return _EmptyTextEditorHintContentWidget.ID;
  }
  _disableHint(e) {
    const disableHint = () => {
      this.configurationService.updateValue(emptyTextEditorHintSetting, "hidden");
      this.dispose();
      this.editor.focus();
    };
    if (!e) {
      disableHint();
      return;
    }
    this.contextMenuService.showContextMenu({
      getAnchor: () => {
        return new StandardMouseEvent(dom.getActiveWindow(), e);
      },
      getActions: () => {
        return [
          {
            id: "workench.action.disableEmptyEditorHint",
            label: localize("disableEditorEmptyHint", "Disable Empty Editor Hint"),
            tooltip: localize("disableEditorEmptyHint", "Disable Empty Editor Hint"),
            enabled: true,
            class: void 0,
            run: () => {
              disableHint();
            }
          }
        ];
      }
    });
  }
  _getHintInlineChat(providers) {
    const providerName = (providers.length === 1 ? providers[0].fullName : void 0) ?? this.productService.nameShort;
    const inlineChatId = "inlineChat.start";
    let ariaLabel = `Ask ${providerName} something or start typing to dismiss.`;
    const handleClick = () => {
      this.telemetryService.publicLog2("workbenchActionExecuted", {
        id: "inlineChat.hintAction",
        from: "hint"
      });
      this.commandService.executeCommand(inlineChatId, { from: "hint" });
    };
    const hintHandler = {
      disposables: this.toDispose,
      callback: (index, _event) => {
        switch (index) {
          case "0":
            handleClick();
            break;
        }
      }
    };
    const hintElement = $("empty-hint-text");
    hintElement.style.display = "block";
    const keybindingHint = this.keybindingService.lookupKeybinding(inlineChatId);
    const keybindingHintLabel = keybindingHint?.getLabel();
    if (keybindingHint && keybindingHintLabel) {
      const actionPart = localize("emptyHintText", "Press {0} to ask {1} to do something. ", keybindingHintLabel, providerName);
      const [before, after] = actionPart.split(keybindingHintLabel).map((fragment) => {
        if (this.options.clickable) {
          const hintPart = $("a", void 0, fragment);
          hintPart.style.fontStyle = "italic";
          hintPart.style.cursor = "pointer";
          this.toDispose.add(dom.addDisposableListener(hintPart, dom.EventType.CONTEXT_MENU, (e) => this._disableHint(e)));
          this.toDispose.add(dom.addDisposableListener(hintPart, dom.EventType.CLICK, handleClick));
          return hintPart;
        } else {
          const hintPart = $("span", void 0, fragment);
          hintPart.style.fontStyle = "italic";
          return hintPart;
        }
      });
      hintElement.appendChild(before);
      const label = hintHandler.disposables.add(new KeybindingLabel(hintElement, OS));
      label.set(keybindingHint);
      label.element.style.width = "min-content";
      label.element.style.display = "inline";
      if (this.options.clickable) {
        label.element.style.cursor = "pointer";
        this.toDispose.add(dom.addDisposableListener(label.element, dom.EventType.CONTEXT_MENU, (e) => this._disableHint(e)));
        this.toDispose.add(dom.addDisposableListener(label.element, dom.EventType.CLICK, handleClick));
      }
      hintElement.appendChild(after);
      const typeToDismiss = localize("emptyHintTextDismiss", "Start typing to dismiss.");
      const textHint2 = $("span", void 0, typeToDismiss);
      textHint2.style.fontStyle = "italic";
      hintElement.appendChild(textHint2);
      ariaLabel = actionPart.concat(typeToDismiss);
    } else {
      const hintMsg = localize({
        key: "inlineChatHint",
        comment: [
          "Preserve double-square brackets and their order"
        ]
      }, "[[Ask {0} to do something]] or start typing to dismiss.", providerName);
      const rendered = renderFormattedText(hintMsg, { actionHandler: hintHandler });
      hintElement.appendChild(rendered);
    }
    return { ariaLabel, hintElement };
  }
  _getHintDefault() {
    const hintHandler = {
      disposables: this.toDispose,
      callback: (index, event) => {
        switch (index) {
          case "0":
            languageOnClickOrTap(event.browserEvent);
            break;
          case "1":
            snippetOnClickOrTap(event.browserEvent);
            break;
          case "2":
            chooseEditorOnClickOrTap(event.browserEvent);
            break;
          case "3":
            this._disableHint();
            break;
        }
      }
    };
    const languageOnClickOrTap = async (e) => {
      e.stopPropagation();
      this.editor.focus();
      this.telemetryService.publicLog2("workbenchActionExecuted", {
        id: ChangeLanguageAction.ID,
        from: "hint"
      });
      await this.commandService.executeCommand(ChangeLanguageAction.ID);
      this.editor.focus();
    };
    const snippetOnClickOrTap = async (e) => {
      e.stopPropagation();
      this.telemetryService.publicLog2("workbenchActionExecuted", {
        id: ApplyFileSnippetAction.Id,
        from: "hint"
      });
      await this.commandService.executeCommand(ApplyFileSnippetAction.Id);
    };
    const chooseEditorOnClickOrTap = async (e) => {
      e.stopPropagation();
      const activeEditorInput = this.editorGroupsService.activeGroup.activeEditor;
      this.telemetryService.publicLog2("workbenchActionExecuted", {
        id: "welcome.showNewFileEntries",
        from: "hint"
      });
      const newEditorSelected = await this.commandService.executeCommand("welcome.showNewFileEntries", { from: "hint" });
      if (newEditorSelected && activeEditorInput !== null && activeEditorInput.resource?.scheme === Schemas.untitled) {
        this.editorGroupsService.activeGroup.closeEditor(activeEditorInput, { preserveFocus: true });
      }
    };
    const hintMsg = localize({
      key: "message",
      comment: [
        "Preserve double-square brackets and their order",
        "language refers to a programming language"
      ]
    }, "[[Select a language]], or [[fill with template]], or [[open a different editor]] to get started.\nStart typing to dismiss or [[don't show]] this again.");
    const hintElement = renderFormattedText(hintMsg, {
      actionHandler: hintHandler,
      renderCodeSegments: false
    });
    hintElement.style.fontStyle = "italic";
    const keybindingsLookup = [ChangeLanguageAction.ID, ApplyFileSnippetAction.Id, "welcome.showNewFileEntries"];
    const keybindingLabels = keybindingsLookup.map((id) => this.keybindingService.lookupKeybinding(id)?.getLabel() ?? id);
    const ariaLabel = localize("defaultHintAriaLabel", "Execute {0} to select a language, execute {1} to fill with template, or execute {2} to open a different editor and get started. Start typing to dismiss.", ...keybindingLabels);
    for (const anchor of hintElement.querySelectorAll("a")) {
      anchor.style.cursor = "pointer";
      const id = keybindingsLookup.shift();
      const title = id && this.keybindingService.lookupKeybinding(id)?.getLabel();
      hintHandler.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), anchor, title ?? ""));
    }
    return { hintElement, ariaLabel };
  }
  getDomNode() {
    if (!this.domNode) {
      this.domNode = $(".empty-editor-hint");
      this.domNode.style.width = "max-content";
      this.domNode.style.paddingLeft = "4px";
      const inlineChatProviders = this.chatAgentService.getActivatedAgents().filter((candidate) => candidate.locations.includes(ChatAgentLocation.Editor));
      const { hintElement, ariaLabel } = !inlineChatProviders.length ? this._getHintDefault() : this._getHintInlineChat(inlineChatProviders);
      this.domNode.append(hintElement);
      this.ariaLabel = ariaLabel.concat(localize("disableHint", " Toggle {0} in settings to disable this hint.", AccessibilityVerbositySettingId.EmptyEditorHint));
      this.toDispose.add(dom.addDisposableListener(this.domNode, "click", () => {
        this.editor.focus();
      }));
      this.editor.applyFontInfo(this.domNode);
    }
    return this.domNode;
  }
  getPosition() {
    return {
      position: { lineNumber: 1, column: 1 },
      preference: [ContentWidgetPositionPreference.EXACT]
    };
  }
  dispose() {
    this.editor.removeContentWidget(this);
    dispose(this.toDispose);
  }
};
_EmptyTextEditorHintContentWidget.ID = "editor.widget.emptyHint";
let EmptyTextEditorHintContentWidget = _EmptyTextEditorHintContentWidget;
registerEditorContribution(EmptyTextEditorHintContribution.ID, EmptyTextEditorHintContribution, EditorContributionInstantiation.Eager);
export {
  EmptyTextEditorHintContribution,
  emptyTextEditorHintSetting
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvZW1wdHlUZXh0RWRpdG9ySGludC9lbXB0eVRleHRFZGl0b3JIaW50LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL2VtcHR5VGV4dEVkaXRvckhpbnQuY3NzJztcbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZSwgSUNvZGVFZGl0b3IsIElDb250ZW50V2lkZ2V0LCBJQ29udGVudFdpZGdldFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDaGFuZ2VMYW5ndWFnZUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvclN0YXR1cy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgUExBSU5URVhUX0xBTkdVQUdFX0lEIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbW9kZXNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQsIEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbiwgcmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbnRlbnRBY3Rpb25IYW5kbGVyLCByZW5kZXJGb3JtYXR0ZWRUZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2Zvcm1hdHRlZFRleHRSZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBBcHBseUZpbGVTbmlwcGV0QWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vc25pcHBldHMvYnJvd3Nlci9jb21tYW5kcy9maWxlVGVtcGxhdGVTbmlwcGV0cy5qcyc7XG5pbXBvcnQgeyBJSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vaW5saW5lQ2hhdC9icm93c2VyL2lubGluZUNoYXRTZXNzaW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkQ2xhc3NpZmljYXRpb24sIFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdMYWJlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9rZXliaW5kaW5nTGFiZWwva2V5YmluZGluZ0xhYmVsLmpzJztcbmltcG9ydCB7IE9TIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgc3RhdHVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vLi4vYWNjZXNzaWJpbGl0eS9icm93c2VyL2FjY2Vzc2liaWxpdHlDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IExPR19NT0RFX0lELCBPVVRQVVRfTU9ERV9JRCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL291dHB1dC9jb21tb24vb3V0cHV0LmpzJztcbmltcG9ydCB7IFNFQVJDSF9SRVNVTFRfTEFOR1VBR0VfSUQgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9zZWFyY2gvY29tbW9uL3NlYXJjaC5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJQ2hhdEFnZW50LCBJQ2hhdEFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NoYXQvY29tbW9uL2NoYXRBZ2VudHMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21vdXNlRXZlbnQuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50TG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jaGF0L2NvbW1vbi9jb25zdGFudHMuanMnO1xuXG5jb25zdCAkID0gZG9tLiQ7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUVtcHR5VGV4dEVkaXRvckhpbnRPcHRpb25zIHtcblx0cmVhZG9ubHkgY2xpY2thYmxlPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNvbnN0IGVtcHR5VGV4dEVkaXRvckhpbnRTZXR0aW5nID0gJ3dvcmtiZW5jaC5lZGl0b3IuZW1wdHkuaGludCc7XG5leHBvcnQgY2xhc3MgRW1wdHlUZXh0RWRpdG9ySGludENvbnRyaWJ1dGlvbiBpbXBsZW1lbnRzIElFZGl0b3JDb250cmlidXRpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yLmNvbnRyaWIuZW1wdHlUZXh0RWRpdG9ySGludCc7XG5cblx0cHJvdGVjdGVkIHRvRGlzcG9zZTogSURpc3Bvc2FibGVbXTtcblx0cHJpdmF0ZSB0ZXh0SGludENvbnRlbnRXaWRnZXQ6IEVtcHR5VGV4dEVkaXRvckhpbnRDb250ZW50V2lkZ2V0IHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvckdyb3Vwc1NlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUlubGluZUNoYXRTZXNzaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGlubGluZUNoYXRTZXNzaW9uU2VydmljZTogSUlubGluZUNoYXRTZXNzaW9uU2VydmljZSxcblx0XHRASUNoYXRBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0QWdlbnRTZXJ2aWNlOiBJQ2hhdEFnZW50U2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMudG9EaXNwb3NlID0gW107XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLmVkaXRvci5vbkRpZENoYW5nZU1vZGVsKCgpID0+IHRoaXMudXBkYXRlKCkpKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxMYW5ndWFnZSgoKSA9PiB0aGlzLnVwZGF0ZSgpKSk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLmVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoKSA9PiB0aGlzLnVwZGF0ZSgpKSk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLmNoYXRBZ2VudFNlcnZpY2Uub25EaWRDaGFuZ2VBZ2VudHMoKCkgPT4gdGhpcy51cGRhdGUoKSkpO1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbERlY29yYXRpb25zKCgpID0+IHRoaXMudXBkYXRlKCkpKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuZWRpdG9yLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoZTogQ29uZmlndXJhdGlvbkNoYW5nZWRFdmVudCkgPT4ge1xuXHRcdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ucmVhZE9ubHkpKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihlbXB0eVRleHRFZGl0b3JIaW50U2V0dGluZykpIHtcblx0XHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaChpbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2Uub25XaWxsU3RhcnRTZXNzaW9uKGVkaXRvciA9PiB7XG5cdFx0XHRpZiAodGhpcy5lZGl0b3IgPT09IGVkaXRvcikge1xuXHRcdFx0XHR0aGlzLnRleHRIaW50Q29udGVudFdpZGdldD8uZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKGlubGluZUNoYXRTZXNzaW9uU2VydmljZS5vbkRpZEVuZFNlc3Npb24oZSA9PiB7XG5cdFx0XHRpZiAodGhpcy5lZGl0b3IgPT09IGUuZWRpdG9yKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRPcHRpb25zKCk6IElFbXB0eVRleHRFZGl0b3JIaW50T3B0aW9ucyB7XG5cdFx0cmV0dXJuIHsgY2xpY2thYmxlOiB0cnVlIH07XG5cdH1cblxuXHRwcm90ZWN0ZWQgX3Nob3VsZFJlbmRlckhpbnQoKSB7XG5cdFx0Y29uc3QgY29uZmlnVmFsdWUgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKGVtcHR5VGV4dEVkaXRvckhpbnRTZXR0aW5nKTtcblx0XHRpZiAoY29uZmlnVmFsdWUgPT09ICdoaWRkZW4nKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ucmVhZE9ubHkpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSBtb2RlbD8uZ2V0TGFuZ3VhZ2VJZCgpO1xuXHRcdGlmICghbW9kZWwgfHwgbGFuZ3VhZ2VJZCA9PT0gT1VUUFVUX01PREVfSUQgfHwgbGFuZ3VhZ2VJZCA9PT0gTE9HX01PREVfSUQgfHwgbGFuZ3VhZ2VJZCA9PT0gU0VBUkNIX1JFU1VMVF9MQU5HVUFHRV9JRCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlubGluZUNoYXRTZXNzaW9uU2VydmljZS5nZXRTZXNzaW9uKHRoaXMuZWRpdG9yLCBtb2RlbC51cmkpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZWRpdG9yLmdldE1vZGVsKCk/LmdldFZhbHVlTGVuZ3RoKCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBoYXNDb25mbGljdGluZ0RlY29yYXRpb25zID0gQm9vbGVhbih0aGlzLmVkaXRvci5nZXRMaW5lRGVjb3JhdGlvbnMoMSk/LmZpbmQoKGQpID0+XG5cdFx0XHRkLm9wdGlvbnMuYmVmb3JlQ29udGVudENsYXNzTmFtZVxuXHRcdFx0fHwgZC5vcHRpb25zLmFmdGVyQ29udGVudENsYXNzTmFtZVxuXHRcdFx0fHwgZC5vcHRpb25zLmJlZm9yZT8uY29udGVudFxuXHRcdFx0fHwgZC5vcHRpb25zLmFmdGVyPy5jb250ZW50XG5cdFx0KSk7XG5cdFx0aWYgKGhhc0NvbmZsaWN0aW5nRGVjb3JhdGlvbnMpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBoYXNFZGl0b3JBZ2VudHMgPSBCb29sZWFuKHRoaXMuY2hhdEFnZW50U2VydmljZS5nZXREZWZhdWx0QWdlbnQoQ2hhdEFnZW50TG9jYXRpb24uRWRpdG9yKSk7XG5cdFx0Y29uc3Qgc2hvdWxkUmVuZGVyRGVmYXVsdEhpbnQgPSBtb2RlbD8udXJpLnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZCAmJiBsYW5ndWFnZUlkID09PSBQTEFJTlRFWFRfTEFOR1VBR0VfSUQ7XG5cdFx0cmV0dXJuIGhhc0VkaXRvckFnZW50cyB8fCBzaG91bGRSZW5kZXJEZWZhdWx0SGludDtcblx0fVxuXG5cdHByb3RlY3RlZCB1cGRhdGUoKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2hvdWxkUmVuZGVySGludCA9IHRoaXMuX3Nob3VsZFJlbmRlckhpbnQoKTtcblx0XHRpZiAoc2hvdWxkUmVuZGVySGludCAmJiAhdGhpcy50ZXh0SGludENvbnRlbnRXaWRnZXQpIHtcblx0XHRcdHRoaXMudGV4dEhpbnRDb250ZW50V2lkZ2V0ID0gbmV3IEVtcHR5VGV4dEVkaXRvckhpbnRDb250ZW50V2lkZ2V0KFxuXHRcdFx0XHR0aGlzLmVkaXRvcixcblx0XHRcdFx0dGhpcy5fZ2V0T3B0aW9ucygpLFxuXHRcdFx0XHR0aGlzLmVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UsXG5cdFx0XHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHRcdHRoaXMuaG92ZXJTZXJ2aWNlLFxuXHRcdFx0XHR0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdFx0XHR0aGlzLmNoYXRBZ2VudFNlcnZpY2UsXG5cdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZSxcblx0XHRcdFx0dGhpcy5wcm9kdWN0U2VydmljZSxcblx0XHRcdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Vcblx0XHRcdCk7XG5cdFx0fSBlbHNlIGlmICghc2hvdWxkUmVuZGVySGludCAmJiB0aGlzLnRleHRIaW50Q29udGVudFdpZGdldCkge1xuXHRcdFx0dGhpcy50ZXh0SGludENvbnRlbnRXaWRnZXQuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy50ZXh0SGludENvbnRlbnRXaWRnZXQgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRkaXNwb3NlKHRoaXMudG9EaXNwb3NlKTtcblx0XHR0aGlzLnRleHRIaW50Q29udGVudFdpZGdldD8uZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIEVtcHR5VGV4dEVkaXRvckhpbnRDb250ZW50V2lkZ2V0IGltcGxlbWVudHMgSUNvbnRlbnRXaWRnZXQge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IElEID0gJ2VkaXRvci53aWRnZXQuZW1wdHlIaW50JztcblxuXHRwcml2YXRlIGRvbU5vZGU6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IHRvRGlzcG9zZTogRGlzcG9zYWJsZVN0b3JlO1xuXHRwcml2YXRlIGlzVmlzaWJsZSA9IGZhbHNlO1xuXHRwcml2YXRlIGFyaWFMYWJlbDogc3RyaW5nID0gJyc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczogSUVtcHR5VGV4dEVkaXRvckhpbnRPcHRpb25zLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yR3JvdXBzU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjaGF0QWdlbnRTZXJ2aWNlOiBJQ2hhdEFnZW50U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy50b0Rpc3Bvc2UgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UuYWRkKHRoaXMuZWRpdG9yLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoZTogQ29uZmlndXJhdGlvbkNoYW5nZWRFdmVudCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuZG9tTm9kZSAmJiBlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLmZvbnRJbmZvKSkge1xuXHRcdFx0XHR0aGlzLmVkaXRvci5hcHBseUZvbnRJbmZvKHRoaXMuZG9tTm9kZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGNvbnN0IG9uRGlkRm9jdXNFZGl0b3JUZXh0ID0gRXZlbnQuZGVib3VuY2UodGhpcy5lZGl0b3Iub25EaWRGb2N1c0VkaXRvclRleHQsICgpID0+IHVuZGVmaW5lZCwgNTAwKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5hZGQob25EaWRGb2N1c0VkaXRvclRleHQoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuZWRpdG9yLmhhc1RleHRGb2N1cygpICYmIHRoaXMuaXNWaXNpYmxlICYmIHRoaXMuYXJpYUxhYmVsICYmIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZC5FbXB0eUVkaXRvckhpbnQpKSB7XG5cdFx0XHRcdHN0YXR1cyh0aGlzLmFyaWFMYWJlbCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuZWRpdG9yLmFkZENvbnRlbnRXaWRnZXQodGhpcyk7XG5cdH1cblxuXHRnZXRJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBFbXB0eVRleHRFZGl0b3JIaW50Q29udGVudFdpZGdldC5JRDtcblx0fVxuXG5cdHByaXZhdGUgX2Rpc2FibGVIaW50KGU/OiBNb3VzZUV2ZW50KSB7XG5cdFx0Y29uc3QgZGlzYWJsZUhpbnQgPSAoKSA9PiB7XG5cdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKGVtcHR5VGV4dEVkaXRvckhpbnRTZXR0aW5nLCAnaGlkZGVuJyk7XG5cdFx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuZWRpdG9yLmZvY3VzKCk7XG5cdFx0fTtcblxuXHRcdGlmICghZSkge1xuXHRcdFx0ZGlzYWJsZUhpbnQoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiB7IHJldHVybiBuZXcgU3RhbmRhcmRNb3VzZUV2ZW50KGRvbS5nZXRBY3RpdmVXaW5kb3coKSwgZSk7IH0sXG5cdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiB7XG5cdFx0XHRcdHJldHVybiBbe1xuXHRcdFx0XHRcdGlkOiAnd29ya2VuY2guYWN0aW9uLmRpc2FibGVFbXB0eUVkaXRvckhpbnQnLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZGlzYWJsZUVkaXRvckVtcHR5SGludCcsIFwiRGlzYWJsZSBFbXB0eSBFZGl0b3IgSGludFwiKSxcblx0XHRcdFx0XHR0b29sdGlwOiBsb2NhbGl6ZSgnZGlzYWJsZUVkaXRvckVtcHR5SGludCcsIFwiRGlzYWJsZSBFbXB0eSBFZGl0b3IgSGludFwiKSxcblx0XHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRkaXNhYmxlSGludCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRdO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0SGludElubGluZUNoYXQocHJvdmlkZXJzOiBJQ2hhdEFnZW50W10pIHtcblx0XHRjb25zdCBwcm92aWRlck5hbWUgPSAocHJvdmlkZXJzLmxlbmd0aCA9PT0gMSA/IHByb3ZpZGVyc1swXS5mdWxsTmFtZSA6IHVuZGVmaW5lZCkgPz8gdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lU2hvcnQ7XG5cblx0XHRjb25zdCBpbmxpbmVDaGF0SWQgPSAnaW5saW5lQ2hhdC5zdGFydCc7XG5cdFx0bGV0IGFyaWFMYWJlbCA9IGBBc2sgJHtwcm92aWRlck5hbWV9IHNvbWV0aGluZyBvciBzdGFydCB0eXBpbmcgdG8gZGlzbWlzcy5gO1xuXG5cdFx0Y29uc3QgaGFuZGxlQ2xpY2sgPSAoKSA9PiB7XG5cdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uPignd29ya2JlbmNoQWN0aW9uRXhlY3V0ZWQnLCB7XG5cdFx0XHRcdGlkOiAnaW5saW5lQ2hhdC5oaW50QWN0aW9uJyxcblx0XHRcdFx0ZnJvbTogJ2hpbnQnXG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoaW5saW5lQ2hhdElkLCB7IGZyb206ICdoaW50JyB9KTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgaGludEhhbmRsZXI6IElDb250ZW50QWN0aW9uSGFuZGxlciA9IHtcblx0XHRcdGRpc3Bvc2FibGVzOiB0aGlzLnRvRGlzcG9zZSxcblx0XHRcdGNhbGxiYWNrOiAoaW5kZXgsIF9ldmVudCkgPT4ge1xuXHRcdFx0XHRzd2l0Y2ggKGluZGV4KSB7XG5cdFx0XHRcdFx0Y2FzZSAnMCc6XG5cdFx0XHRcdFx0XHRoYW5kbGVDbGljaygpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgaGludEVsZW1lbnQgPSAkKCdlbXB0eS1oaW50LXRleHQnKTtcblx0XHRoaW50RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblxuXHRcdGNvbnN0IGtleWJpbmRpbmdIaW50ID0gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGlubGluZUNoYXRJZCk7XG5cdFx0Y29uc3Qga2V5YmluZGluZ0hpbnRMYWJlbCA9IGtleWJpbmRpbmdIaW50Py5nZXRMYWJlbCgpO1xuXG5cdFx0aWYgKGtleWJpbmRpbmdIaW50ICYmIGtleWJpbmRpbmdIaW50TGFiZWwpIHtcblx0XHRcdGNvbnN0IGFjdGlvblBhcnQgPSBsb2NhbGl6ZSgnZW1wdHlIaW50VGV4dCcsICdQcmVzcyB7MH0gdG8gYXNrIHsxfSB0byBkbyBzb21ldGhpbmcuICcsIGtleWJpbmRpbmdIaW50TGFiZWwsIHByb3ZpZGVyTmFtZSk7XG5cblx0XHRcdGNvbnN0IFtiZWZvcmUsIGFmdGVyXSA9IGFjdGlvblBhcnQuc3BsaXQoa2V5YmluZGluZ0hpbnRMYWJlbCkubWFwKChmcmFnbWVudCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5vcHRpb25zLmNsaWNrYWJsZSkge1xuXHRcdFx0XHRcdGNvbnN0IGhpbnRQYXJ0ID0gJCgnYScsIHVuZGVmaW5lZCwgZnJhZ21lbnQpO1xuXHRcdFx0XHRcdGhpbnRQYXJ0LnN0eWxlLmZvbnRTdHlsZSA9ICdpdGFsaWMnO1xuXHRcdFx0XHRcdGhpbnRQYXJ0LnN0eWxlLmN1cnNvciA9ICdwb2ludGVyJztcblx0XHRcdFx0XHR0aGlzLnRvRGlzcG9zZS5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihoaW50UGFydCwgZG9tLkV2ZW50VHlwZS5DT05URVhUX01FTlUsIChlKSA9PiB0aGlzLl9kaXNhYmxlSGludChlKSkpO1xuXHRcdFx0XHRcdHRoaXMudG9EaXNwb3NlLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGhpbnRQYXJ0LCBkb20uRXZlbnRUeXBlLkNMSUNLLCBoYW5kbGVDbGljaykpO1xuXHRcdFx0XHRcdHJldHVybiBoaW50UGFydDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBoaW50UGFydCA9ICQoJ3NwYW4nLCB1bmRlZmluZWQsIGZyYWdtZW50KTtcblx0XHRcdFx0XHRoaW50UGFydC5zdHlsZS5mb250U3R5bGUgPSAnaXRhbGljJztcblx0XHRcdFx0XHRyZXR1cm4gaGludFBhcnQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRoaW50RWxlbWVudC5hcHBlbmRDaGlsZChiZWZvcmUpO1xuXG5cdFx0XHRjb25zdCBsYWJlbCA9IGhpbnRIYW5kbGVyLmRpc3Bvc2FibGVzLmFkZChuZXcgS2V5YmluZGluZ0xhYmVsKGhpbnRFbGVtZW50LCBPUykpO1xuXHRcdFx0bGFiZWwuc2V0KGtleWJpbmRpbmdIaW50KTtcblx0XHRcdGxhYmVsLmVsZW1lbnQuc3R5bGUud2lkdGggPSAnbWluLWNvbnRlbnQnO1xuXHRcdFx0bGFiZWwuZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG5cblx0XHRcdGlmICh0aGlzLm9wdGlvbnMuY2xpY2thYmxlKSB7XG5cdFx0XHRcdGxhYmVsLmVsZW1lbnQuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuXHRcdFx0XHR0aGlzLnRvRGlzcG9zZS5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihsYWJlbC5lbGVtZW50LCBkb20uRXZlbnRUeXBlLkNPTlRFWFRfTUVOVSwgKGUpID0+IHRoaXMuX2Rpc2FibGVIaW50KGUpKSk7XG5cdFx0XHRcdHRoaXMudG9EaXNwb3NlLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGxhYmVsLmVsZW1lbnQsIGRvbS5FdmVudFR5cGUuQ0xJQ0ssIGhhbmRsZUNsaWNrKSk7XG5cdFx0XHR9XG5cblx0XHRcdGhpbnRFbGVtZW50LmFwcGVuZENoaWxkKGFmdGVyKTtcblxuXHRcdFx0Y29uc3QgdHlwZVRvRGlzbWlzcyA9IGxvY2FsaXplKCdlbXB0eUhpbnRUZXh0RGlzbWlzcycsICdTdGFydCB0eXBpbmcgdG8gZGlzbWlzcy4nKTtcblx0XHRcdGNvbnN0IHRleHRIaW50MiA9ICQoJ3NwYW4nLCB1bmRlZmluZWQsIHR5cGVUb0Rpc21pc3MpO1xuXHRcdFx0dGV4dEhpbnQyLnN0eWxlLmZvbnRTdHlsZSA9ICdpdGFsaWMnO1xuXHRcdFx0aGludEVsZW1lbnQuYXBwZW5kQ2hpbGQodGV4dEhpbnQyKTtcblxuXHRcdFx0YXJpYUxhYmVsID0gYWN0aW9uUGFydC5jb25jYXQodHlwZVRvRGlzbWlzcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGhpbnRNc2cgPSBsb2NhbGl6ZSh7XG5cdFx0XHRcdGtleTogJ2lubGluZUNoYXRIaW50Jyxcblx0XHRcdFx0Y29tbWVudDogW1xuXHRcdFx0XHRcdCdQcmVzZXJ2ZSBkb3VibGUtc3F1YXJlIGJyYWNrZXRzIGFuZCB0aGVpciBvcmRlcicsXG5cdFx0XHRcdF1cblx0XHRcdH0sICdbW0FzayB7MH0gdG8gZG8gc29tZXRoaW5nXV0gb3Igc3RhcnQgdHlwaW5nIHRvIGRpc21pc3MuJywgcHJvdmlkZXJOYW1lKTtcblx0XHRcdGNvbnN0IHJlbmRlcmVkID0gcmVuZGVyRm9ybWF0dGVkVGV4dChoaW50TXNnLCB7IGFjdGlvbkhhbmRsZXI6IGhpbnRIYW5kbGVyIH0pO1xuXHRcdFx0aGludEVsZW1lbnQuYXBwZW5kQ2hpbGQocmVuZGVyZWQpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IGFyaWFMYWJlbCwgaGludEVsZW1lbnQgfTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEhpbnREZWZhdWx0KCkge1xuXHRcdGNvbnN0IGhpbnRIYW5kbGVyOiBJQ29udGVudEFjdGlvbkhhbmRsZXIgPSB7XG5cdFx0XHRkaXNwb3NhYmxlczogdGhpcy50b0Rpc3Bvc2UsXG5cdFx0XHRjYWxsYmFjazogKGluZGV4LCBldmVudCkgPT4ge1xuXHRcdFx0XHRzd2l0Y2ggKGluZGV4KSB7XG5cdFx0XHRcdFx0Y2FzZSAnMCc6XG5cdFx0XHRcdFx0XHRsYW5ndWFnZU9uQ2xpY2tPclRhcChldmVudC5icm93c2VyRXZlbnQpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnMSc6XG5cdFx0XHRcdFx0XHRzbmlwcGV0T25DbGlja09yVGFwKGV2ZW50LmJyb3dzZXJFdmVudCk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICcyJzpcblx0XHRcdFx0XHRcdGNob29zZUVkaXRvck9uQ2xpY2tPclRhcChldmVudC5icm93c2VyRXZlbnQpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnMyc6XG5cdFx0XHRcdFx0XHR0aGlzLl9kaXNhYmxlSGludCgpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gdGhlIGFjdHVhbCBjb21tYW5kIGhhbmRsZXJzLi4uXG5cdFx0Y29uc3QgbGFuZ3VhZ2VPbkNsaWNrT3JUYXAgPSBhc3luYyAoZTogVUlFdmVudCkgPT4ge1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdC8vIE5lZWQgdG8gZm9jdXMgZWRpdG9yIGJlZm9yZSBzbyBjdXJyZW50IGVkaXRvciBiZWNvbWVzIGFjdGl2ZSBhbmQgdGhlIGNvbW1hbmQgaXMgcHJvcGVybHkgZXhlY3V0ZWRcblx0XHRcdHRoaXMuZWRpdG9yLmZvY3VzKCk7XG5cdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uPignd29ya2JlbmNoQWN0aW9uRXhlY3V0ZWQnLCB7XG5cdFx0XHRcdGlkOiBDaGFuZ2VMYW5ndWFnZUFjdGlvbi5JRCxcblx0XHRcdFx0ZnJvbTogJ2hpbnQnXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoQ2hhbmdlTGFuZ3VhZ2VBY3Rpb24uSUQpO1xuXHRcdFx0dGhpcy5lZGl0b3IuZm9jdXMoKTtcblx0XHR9O1xuXG5cdFx0Y29uc3Qgc25pcHBldE9uQ2xpY2tPclRhcCA9IGFzeW5jIChlOiBVSUV2ZW50KSA9PiB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uPignd29ya2JlbmNoQWN0aW9uRXhlY3V0ZWQnLCB7XG5cdFx0XHRcdGlkOiBBcHBseUZpbGVTbmlwcGV0QWN0aW9uLklkLFxuXHRcdFx0XHRmcm9tOiAnaGludCdcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChBcHBseUZpbGVTbmlwcGV0QWN0aW9uLklkKTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgY2hvb3NlRWRpdG9yT25DbGlja09yVGFwID0gYXN5bmMgKGU6IFVJRXZlbnQpID0+IHtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblx0XHRcdGNvbnN0IGFjdGl2ZUVkaXRvcklucHV0ID0gdGhpcy5lZGl0b3JHcm91cHNTZXJ2aWNlLmFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvcjtcblx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkRXZlbnQsIFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkQ2xhc3NpZmljYXRpb24+KCd3b3JrYmVuY2hBY3Rpb25FeGVjdXRlZCcsIHtcblx0XHRcdFx0aWQ6ICd3ZWxjb21lLnNob3dOZXdGaWxlRW50cmllcycsXG5cdFx0XHRcdGZyb206ICdoaW50J1xuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBuZXdFZGl0b3JTZWxlY3RlZCA9IGF3YWl0IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ3dlbGNvbWUuc2hvd05ld0ZpbGVFbnRyaWVzJywgeyBmcm9tOiAnaGludCcgfSk7XG5cblx0XHRcdC8vIENsb3NlIHRoZSBhY3RpdmUgZWRpdG9yIGFzIGxvbmcgYXMgaXQgaXMgdW50aXRsZWQgKHN3YXAgdGhlIGVkaXRvcnMgb3V0KVxuXHRcdFx0aWYgKG5ld0VkaXRvclNlbGVjdGVkICYmIGFjdGl2ZUVkaXRvcklucHV0ICE9PSBudWxsICYmIGFjdGl2ZUVkaXRvcklucHV0LnJlc291cmNlPy5zY2hlbWUgPT09IFNjaGVtYXMudW50aXRsZWQpIHtcblx0XHRcdFx0dGhpcy5lZGl0b3JHcm91cHNTZXJ2aWNlLmFjdGl2ZUdyb3VwLmNsb3NlRWRpdG9yKGFjdGl2ZUVkaXRvcklucHV0LCB7IHByZXNlcnZlRm9jdXM6IHRydWUgfSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IGhpbnRNc2cgPSBsb2NhbGl6ZSh7XG5cdFx0XHRrZXk6ICdtZXNzYWdlJyxcblx0XHRcdGNvbW1lbnQ6IFtcblx0XHRcdFx0J1ByZXNlcnZlIGRvdWJsZS1zcXVhcmUgYnJhY2tldHMgYW5kIHRoZWlyIG9yZGVyJyxcblx0XHRcdFx0J2xhbmd1YWdlIHJlZmVycyB0byBhIHByb2dyYW1taW5nIGxhbmd1YWdlJ1xuXHRcdFx0XVxuXHRcdH0sICdbW1NlbGVjdCBhIGxhbmd1YWdlXV0sIG9yIFtbZmlsbCB3aXRoIHRlbXBsYXRlXV0sIG9yIFtbb3BlbiBhIGRpZmZlcmVudCBlZGl0b3JdXSB0byBnZXQgc3RhcnRlZC5cXG5TdGFydCB0eXBpbmcgdG8gZGlzbWlzcyBvciBbW2RvblxcJ3Qgc2hvd11dIHRoaXMgYWdhaW4uJyk7XG5cdFx0Y29uc3QgaGludEVsZW1lbnQgPSByZW5kZXJGb3JtYXR0ZWRUZXh0KGhpbnRNc2csIHtcblx0XHRcdGFjdGlvbkhhbmRsZXI6IGhpbnRIYW5kbGVyLFxuXHRcdFx0cmVuZGVyQ29kZVNlZ21lbnRzOiBmYWxzZSxcblx0XHR9KTtcblx0XHRoaW50RWxlbWVudC5zdHlsZS5mb250U3R5bGUgPSAnaXRhbGljJztcblxuXHRcdC8vIHVnbHkgd2F5IHRvIGFzc29jaWF0ZSBrZXliaW5kaW5ncy4uLlxuXHRcdGNvbnN0IGtleWJpbmRpbmdzTG9va3VwID0gW0NoYW5nZUxhbmd1YWdlQWN0aW9uLklELCBBcHBseUZpbGVTbmlwcGV0QWN0aW9uLklkLCAnd2VsY29tZS5zaG93TmV3RmlsZUVudHJpZXMnXTtcblx0XHRjb25zdCBrZXliaW5kaW5nTGFiZWxzID0ga2V5YmluZGluZ3NMb29rdXAubWFwKChpZCkgPT4gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGlkKT8uZ2V0TGFiZWwoKSA/PyBpZCk7XG5cdFx0Y29uc3QgYXJpYUxhYmVsID0gbG9jYWxpemUoJ2RlZmF1bHRIaW50QXJpYUxhYmVsJywgJ0V4ZWN1dGUgezB9IHRvIHNlbGVjdCBhIGxhbmd1YWdlLCBleGVjdXRlIHsxfSB0byBmaWxsIHdpdGggdGVtcGxhdGUsIG9yIGV4ZWN1dGUgezJ9IHRvIG9wZW4gYSBkaWZmZXJlbnQgZWRpdG9yIGFuZCBnZXQgc3RhcnRlZC4gU3RhcnQgdHlwaW5nIHRvIGRpc21pc3MuJywgLi4ua2V5YmluZGluZ0xhYmVscyk7XG5cdFx0Zm9yIChjb25zdCBhbmNob3Igb2YgaGludEVsZW1lbnQucXVlcnlTZWxlY3RvckFsbCgnYScpKSB7XG5cdFx0XHRhbmNob3Iuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuXHRcdFx0Y29uc3QgaWQgPSBrZXliaW5kaW5nc0xvb2t1cC5zaGlmdCgpO1xuXHRcdFx0Y29uc3QgdGl0bGUgPSBpZCAmJiB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoaWQpPy5nZXRMYWJlbCgpO1xuXHRcdFx0aGludEhhbmRsZXIuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCBhbmNob3IsIHRpdGxlID8/ICcnKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgaGludEVsZW1lbnQsIGFyaWFMYWJlbCB9O1xuXHR9XG5cblx0Z2V0RG9tTm9kZSgpOiBIVE1MRWxlbWVudCB7XG5cdFx0aWYgKCF0aGlzLmRvbU5vZGUpIHtcblx0XHRcdHRoaXMuZG9tTm9kZSA9ICQoJy5lbXB0eS1lZGl0b3ItaGludCcpO1xuXHRcdFx0dGhpcy5kb21Ob2RlLnN0eWxlLndpZHRoID0gJ21heC1jb250ZW50Jztcblx0XHRcdHRoaXMuZG9tTm9kZS5zdHlsZS5wYWRkaW5nTGVmdCA9ICc0cHgnO1xuXG5cdFx0XHRjb25zdCBpbmxpbmVDaGF0UHJvdmlkZXJzID0gdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLmdldEFjdGl2YXRlZEFnZW50cygpLmZpbHRlcihjYW5kaWRhdGUgPT4gY2FuZGlkYXRlLmxvY2F0aW9ucy5pbmNsdWRlcyhDaGF0QWdlbnRMb2NhdGlvbi5FZGl0b3IpKTtcblx0XHRcdGNvbnN0IHsgaGludEVsZW1lbnQsIGFyaWFMYWJlbCB9ID0gIWlubGluZUNoYXRQcm92aWRlcnMubGVuZ3RoID8gdGhpcy5fZ2V0SGludERlZmF1bHQoKSA6IHRoaXMuX2dldEhpbnRJbmxpbmVDaGF0KGlubGluZUNoYXRQcm92aWRlcnMpO1xuXHRcdFx0dGhpcy5kb21Ob2RlLmFwcGVuZChoaW50RWxlbWVudCk7XG5cdFx0XHR0aGlzLmFyaWFMYWJlbCA9IGFyaWFMYWJlbC5jb25jYXQobG9jYWxpemUoJ2Rpc2FibGVIaW50JywgJyBUb2dnbGUgezB9IGluIHNldHRpbmdzIHRvIGRpc2FibGUgdGhpcyBoaW50LicsIEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuRW1wdHlFZGl0b3JIaW50KSk7XG5cblx0XHRcdHRoaXMudG9EaXNwb3NlLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuZG9tTm9kZSwgJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmVkaXRvci5mb2N1cygpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLmVkaXRvci5hcHBseUZvbnRJbmZvKHRoaXMuZG9tTm9kZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZG9tTm9kZTtcblx0fVxuXG5cdGdldFBvc2l0aW9uKCk6IElDb250ZW50V2lkZ2V0UG9zaXRpb24gfCBudWxsIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cG9zaXRpb246IHsgbGluZU51bWJlcjogMSwgY29sdW1uOiAxIH0sXG5cdFx0XHRwcmVmZXJlbmNlOiBbQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5FWEFDVF1cblx0XHR9O1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmVkaXRvci5yZW1vdmVDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHRcdGRpc3Bvc2UodGhpcy50b0Rpc3Bvc2UpO1xuXHR9XG59XG5cbnJlZ2lzdGVyRWRpdG9yQ29udHJpYnV0aW9uKEVtcHR5VGV4dEVkaXRvckhpbnRDb250cmlidXRpb24uSUQsIEVtcHR5VGV4dEVkaXRvckhpbnRDb250cmlidXRpb24sIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24uRWFnZXIpOyAvLyBlYWdlciBiZWNhdXNlIGl0IG5lZWRzIHRvIHJlbmRlciBhIGhlbHAgbWVzc2FnZVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsaUJBQWlCLGVBQTRCO0FBQ3RELFNBQVMsdUNBQTRGO0FBQ3JHLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNEJBQTRC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
