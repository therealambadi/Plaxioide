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
var _a, _b, _c, _d, _e, _f, _g;
import * as dom from "../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { SymbolKinds } from "../../../../editor/common/languages.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { getIconClasses } from "../../../../editor/common/services/getIconClasses.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { DefinitionAction } from "../../../../editor/contrib/gotoSymbol/browser/goToCommands.js";
import * as nls from "../../../../nls.js";
import { getFlatContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, IMenuService, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { FileKind, IFileService } from "../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { FolderThemeIcon, IThemeService } from "../../../../platform/theme/common/themeService.js";
import { fillEditorsDragData } from "../../../browser/dnd.js";
import { ResourceContextKey } from "../../../common/contextkeys.js";
import { IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { ExplorerFolderContext } from "../../files/common/files.js";
import { IChatVariablesService } from "../common/chatVariables.js";
import { IChatWidgetService } from "./chat.js";
import { chatAttachmentResourceContextKey, hookUpSymbolAttachmentDragAndContextMenu } from "./chatContentParts/chatAttachmentsContentPart.js";
import { IChatMarkdownAnchorService } from "./chatContentParts/chatMarkdownAnchorService.js";
let InlineAnchorWidget = class extends Disposable {
  constructor(element, inlineReference, originalContextKeyService, contextMenuService, fileService, hoverService, instantiationService, labelService, languageService, menuService, modelService, telemetryService, themeService) {
    super();
    this.element = element;
    this.inlineReference = inlineReference;
    this._isDisposed = false;
    this.data = "uri" in inlineReference.inlineReference ? inlineReference.inlineReference : "name" in inlineReference.inlineReference ? { kind: "symbol", symbol: inlineReference.inlineReference } : { uri: inlineReference.inlineReference };
    const contextKeyService = this._register(originalContextKeyService.createScoped(element));
    this._chatResourceContext = chatAttachmentResourceContextKey.bindTo(contextKeyService);
    element.classList.add(InlineAnchorWidget.className, "show-file-icons");
    let iconText;
    let iconClasses;
    let location;
    let updateContextKeys;
    if (this.data.kind === "symbol") {
      const symbol = this.data.symbol;
      location = this.data.symbol.location;
      iconText = this.data.symbol.name;
      iconClasses = ["codicon", ...getIconClasses(modelService, languageService, void 0, void 0, SymbolKinds.toIcon(symbol.kind))];
      this._store.add(instantiationService.invokeFunction((accessor) => hookUpSymbolAttachmentDragAndContextMenu(accessor, element, contextKeyService, { value: symbol.location, name: symbol.name, kind: symbol.kind }, MenuId.ChatInlineSymbolAnchorContext)));
    } else {
      location = this.data;
      const label = labelService.getUriBasenameLabel(location.uri);
      iconText = location.range && this.data.kind !== "symbol" ? `${label}#${location.range.startLineNumber}-${location.range.endLineNumber}` : label;
      let fileKind = location.uri.path.endsWith("/") ? FileKind.FOLDER : FileKind.FILE;
      const recomputeIconClasses = () => getIconClasses(modelService, languageService, location.uri, fileKind, fileKind === FileKind.FOLDER && !themeService.getFileIconTheme().hasFolderIcons ? FolderThemeIcon : void 0);
      iconClasses = recomputeIconClasses();
      const refreshIconClasses = () => {
        iconEl.classList.remove(...iconClasses);
        iconClasses = recomputeIconClasses();
        iconEl.classList.add(...iconClasses);
      };
      this._register(themeService.onDidFileIconThemeChange(() => {
        refreshIconClasses();
      }));
      const isFolderContext = ExplorerFolderContext.bindTo(contextKeyService);
      fileService.stat(location.uri).then((stat) => {
        isFolderContext.set(stat.isDirectory);
        if (stat.isDirectory) {
          fileKind = FileKind.FOLDER;
          refreshIconClasses();
        }
      }).catch(() => {
      });
      this._register(dom.addDisposableListener(element, dom.EventType.CONTEXT_MENU, async (domEvent) => {
        const event = new StandardMouseEvent(dom.getWindow(domEvent), domEvent);
        dom.EventHelper.stop(domEvent, true);
        try {
          await updateContextKeys?.();
        } catch (e) {
          console.error(e);
        }
        if (this._isDisposed) {
          return;
        }
        contextMenuService.showContextMenu({
          contextKeyService,
          getAnchor: () => event,
          getActions: () => {
            const menu = menuService.getMenuActions(MenuId.ChatInlineResourceAnchorContext, contextKeyService, { arg: location.uri });
            return getFlatContextMenuActions(menu);
          }
        });
      }));
    }
    const resourceContextKey = this._register(new ResourceContextKey(contextKeyService, fileService, languageService, modelService));
    resourceContextKey.set(location.uri);
    this._chatResourceContext.set(location.uri.toString());
    const iconEl = dom.$("span.icon");
    iconEl.classList.add(...iconClasses);
    element.replaceChildren(iconEl, dom.$("span.icon-label", {}, iconText));
    const fragment = location.range ? `${location.range.startLineNumber},${location.range.startColumn}` : "";
    element.setAttribute("data-href", (fragment ? location.uri.with({ fragment }) : location.uri).toString());
    const relativeLabel = labelService.getUriLabel(location.uri, { relative: true });
    this._register(hoverService.setupManagedHover(getDefaultHoverDelegate("element"), element, relativeLabel));
    if (this.data.kind !== "symbol") {
      element.draggable = true;
      this._register(dom.addDisposableListener(element, "dragstart", (e) => {
        const stat = {
          resource: location.uri,
          selection: location.range
        };
        instantiationService.invokeFunction((accessor) => fillEditorsDragData(accessor, [stat], e));
        e.dataTransfer?.setDragImage(element, 0, 0);
      }));
    }
  }
  dispose() {
    this._isDisposed = true;
    super.dispose();
  }
  getHTMLElement() {
    return this.element;
  }
};
InlineAnchorWidget.className = "chat-inline-anchor-widget";
InlineAnchorWidget = __decorateClass([
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IFileService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, ILabelService),
  __decorateParam(8, ILanguageService),
  __decorateParam(9, IMenuService),
  __decorateParam(10, IModelService),
  __decorateParam(11, ITelemetryService),
  __decorateParam(12, IThemeService)
], InlineAnchorWidget);
registerAction2((_a = class extends Action2 {
  constructor() {
    super({
      id: _a.id,
      title: nls.localize2("actions.attach.label", "Add File to Chat"),
      menu: [{
        id: MenuId.ChatInlineResourceAnchorContext,
        group: "chat",
        order: 1,
        when: ExplorerFolderContext.negate()
      }]
    });
  }
  async run(accessor, resource) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const variablesService = accessor.get(IChatVariablesService);
    const widget = chatWidgetService.lastFocusedWidget;
    if (!widget) {
      return;
    }
    variablesService.attachContext("file", resource, widget.location);
  }
}, _a.id = "chat.inlineResourceAnchor.addFileToChat", _a));
registerAction2((_b = class extends Action2 {
  constructor() {
    super({
      id: _b.id,
      title: nls.localize2("actions.copy.label", "Copy"),
      f1: false,
      precondition: chatAttachmentResourceContextKey,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyC
      }
    });
  }
  async run(accessor) {
    const chatWidgetService = accessor.get(IChatMarkdownAnchorService);
    const clipboardService = accessor.get(IClipboardService);
    const anchor = chatWidgetService.lastFocusedAnchor;
    if (!anchor) {
      return;
    }
    const resource = anchor.data.kind === "symbol" ? anchor.data.symbol.location.uri : anchor.data.uri;
    clipboardService.writeResources([resource]);
  }
}, _b.id = "chat.inlineResourceAnchor.copyResource", _b));
registerAction2((_c = class extends Action2 {
  constructor() {
    super({
      id: _c.id,
      title: nls.localize2("actions.openToSide.label", "Open to the Side"),
      f1: false,
      precondition: chatAttachmentResourceContextKey,
      keybinding: {
        weight: KeybindingWeight.ExternalExtension + 2,
        primary: KeyMod.CtrlCmd | KeyCode.Enter,
        mac: {
          primary: KeyMod.WinCtrl | KeyCode.Enter
        }
      },
      menu: [MenuId.ChatInlineSymbolAnchorContext, MenuId.ChatInputSymbolAttachmentContext].map((id) => ({
        id,
        group: "navigation",
        order: 1
      }))
    });
  }
  async run(accessor, arg) {
    const editorService = accessor.get(IEditorService);
    const target = this.getTarget(accessor, arg);
    if (!target) {
      return;
    }
    const input = URI.isUri(target) ? { resource: target } : {
      resource: target.uri,
      options: {
        selection: {
          startColumn: target.range.startColumn,
          startLineNumber: target.range.startLineNumber
        }
      }
    };
    await editorService.openEditors([input], SIDE_GROUP);
  }
  getTarget(accessor, arg) {
    const chatWidgetService = accessor.get(IChatMarkdownAnchorService);
    if (arg) {
      return arg;
    }
    const anchor = chatWidgetService.lastFocusedAnchor;
    if (!anchor) {
      return void 0;
    }
    return anchor.data.kind === "symbol" ? anchor.data.symbol.location : anchor.data.uri;
  }
}, _c.id = "chat.inlineResourceAnchor.openToSide", _c));
registerAction2((_d = class extends Action2 {
  constructor() {
    super({
      id: _d.id,
      title: {
        ...nls.localize2("actions.goToDecl.label", "Go to Definition"),
        mnemonicTitle: nls.localize({ key: "miGotoDefinition", comment: ["&& denotes a mnemonic"] }, "Go to &&Definition")
      },
      menu: [MenuId.ChatInlineSymbolAnchorContext, MenuId.ChatInputSymbolAttachmentContext].map((id) => ({
        id,
        group: "4_symbol_nav",
        order: 1.1,
        when: EditorContextKeys.hasDefinitionProvider
      }))
    });
  }
  async run(accessor, location) {
    const editorService = accessor.get(ICodeEditorService);
    await openEditorWithSelection(editorService, location);
    const action = new DefinitionAction({ openToSide: false, openInPeek: false, muteMessage: true }, { title: { value: "", original: "" }, id: "", precondition: void 0 });
    return action.run(accessor);
  }
}, _d.id = "chat.inlineSymbolAnchor.goToDefinition", _d));
async function openEditorWithSelection(editorService, location) {
  await editorService.openCodeEditor({
    resource: location.uri,
    options: {
      selection: {
        startColumn: location.range.startColumn,
        startLineNumber: location.range.startLineNumber
      }
    }
  }, null);
}
async function runGoToCommand(accessor, command, location) {
  const editorService = accessor.get(ICodeEditorService);
  const commandService = accessor.get(ICommandService);
  await openEditorWithSelection(editorService, location);
  return commandService.executeCommand(command);
}
registerAction2((_e = class extends Action2 {
  constructor() {
    super({
      id: _e.id,
      title: {
        ...nls.localize2("goToTypeDefinitions.label", "Go to Type Definitions"),
        mnemonicTitle: nls.localize({ key: "miGotoTypeDefinition", comment: ["&& denotes a mnemonic"] }, "Go to &&Type Definitions")
      },
      menu: [MenuId.ChatInlineSymbolAnchorContext, MenuId.ChatInputSymbolAttachmentContext].map((id) => ({
        id,
        group: "4_symbol_nav",
        order: 1.1,
        when: EditorContextKeys.hasTypeDefinitionProvider
      }))
    });
  }
  async run(accessor, location) {
    return runGoToCommand(accessor, "editor.action.goToTypeDefinition", location);
  }
}, _e.id = "chat.inlineSymbolAnchor.goToTypeDefinitions", _e));
registerAction2((_f = class extends Action2 {
  constructor() {
    super({
      id: _f.id,
      title: {
        ...nls.localize2("goToImplementations.label", "Go to Implementations"),
        mnemonicTitle: nls.localize({ key: "miGotoImplementations", comment: ["&& denotes a mnemonic"] }, "Go to &&Implementations")
      },
      menu: [MenuId.ChatInlineSymbolAnchorContext, MenuId.ChatInputSymbolAttachmentContext].map((id) => ({
        id,
        group: "4_symbol_nav",
        order: 1.2,
        when: EditorContextKeys.hasImplementationProvider
      }))
    });
  }
  async run(accessor, location) {
    return runGoToCommand(accessor, "editor.action.goToImplementation", location);
  }
}, _f.id = "chat.inlineSymbolAnchor.goToImplementations", _f));
registerAction2((_g = class extends Action2 {
  constructor() {
    super({
      id: _g.id,
      title: {
        ...nls.localize2("goToReferences.label", "Go to References"),
        mnemonicTitle: nls.localize({ key: "miGotoReference", comment: ["&& denotes a mnemonic"] }, "Go to &&References")
      },
      menu: [MenuId.ChatInlineSymbolAnchorContext, MenuId.ChatInputSymbolAttachmentContext].map((id) => ({
        id,
        group: "4_symbol_nav",
        order: 1.3,
        when: EditorContextKeys.hasReferenceProvider
      }))
    });
  }
  async run(accessor, location) {
    return runGoToCommand(accessor, "editor.action.goToReferences", location);
  }
}, _g.id = "chat.inlineSymbolAnchor.goToReferences", _g));
export {
  InlineAnchorWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdElubGluZUFuY2hvcldpZGdldC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGVGYWN0b3J5LmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgTG9jYXRpb24sIFN5bWJvbEtpbmRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IGdldEljb25DbGFzc2VzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9nZXRJY29uQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBEZWZpbml0aW9uQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZ290b1N5bWJvbC9icm93c2VyL2dvVG9Db21tYW5kcy5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGdldEZsYXRDb250ZXh0TWVudUFjdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgSU1lbnVTZXJ2aWNlLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNsaXBib2FyZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jbGlwYm9hcmQvY29tbW9uL2NsaXBib2FyZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElSZXNvdXJjZVN0YXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kbmQvYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgSVRleHRSZXNvdXJjZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRmlsZUtpbmQsIElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBGb2xkZXJUaGVtZUljb24sIElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGZpbGxFZGl0b3JzRHJhZ0RhdGEgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZUNvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UsIFNJREVfR1JPVVAgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRXhwbG9yZXJGb2xkZXJDb250ZXh0IH0gZnJvbSAnLi4vLi4vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VTeW1ib2wgfSBmcm9tICcuLi8uLi9zZWFyY2gvY29tbW9uL3NlYXJjaC5qcyc7XG5pbXBvcnQgeyBJQ2hhdENvbnRlbnRJbmxpbmVSZWZlcmVuY2UgfSBmcm9tICcuLi9jb21tb24vY2hhdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRWYXJpYWJsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRWYXJpYWJsZXMuanMnO1xuaW1wb3J0IHsgSUNoYXRXaWRnZXRTZXJ2aWNlIH0gZnJvbSAnLi9jaGF0LmpzJztcbmltcG9ydCB7IGNoYXRBdHRhY2htZW50UmVzb3VyY2VDb250ZXh0S2V5LCBob29rVXBTeW1ib2xBdHRhY2htZW50RHJhZ0FuZENvbnRleHRNZW51IH0gZnJvbSAnLi9jaGF0Q29udGVudFBhcnRzL2NoYXRBdHRhY2htZW50c0NvbnRlbnRQYXJ0LmpzJztcbmltcG9ydCB7IElDaGF0TWFya2Rvd25BbmNob3JTZXJ2aWNlIH0gZnJvbSAnLi9jaGF0Q29udGVudFBhcnRzL2NoYXRNYXJrZG93bkFuY2hvclNlcnZpY2UuanMnO1xuXG50eXBlIENvbnRlbnRSZWZEYXRhID1cblx0fCB7IHJlYWRvbmx5IGtpbmQ6ICdzeW1ib2wnOyByZWFkb25seSBzeW1ib2w6IElXb3Jrc3BhY2VTeW1ib2wgfVxuXHR8IHtcblx0XHRyZWFkb25seSBraW5kPzogdW5kZWZpbmVkO1xuXHRcdHJlYWRvbmx5IHVyaTogVVJJO1xuXHRcdHJlYWRvbmx5IHJhbmdlPzogSVJhbmdlO1xuXHR9O1xuXG5leHBvcnQgY2xhc3MgSW5saW5lQW5jaG9yV2lkZ2V0IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBjbGFzc05hbWUgPSAnY2hhdC1pbmxpbmUtYW5jaG9yLXdpZGdldCc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY2hhdFJlc291cmNlQ29udGV4dDogSUNvbnRleHRLZXk8c3RyaW5nPjtcblxuXHRyZWFkb25seSBkYXRhOiBDb250ZW50UmVmRGF0YTtcblxuXHRwcml2YXRlIF9pc0Rpc3Bvc2VkID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlbGVtZW50OiBIVE1MQW5jaG9yRWxlbWVudCB8IEhUTUxFbGVtZW50LFxuXHRcdHB1YmxpYyByZWFkb25seSBpbmxpbmVSZWZlcmVuY2U6IElDaGF0Q29udGVudElubGluZVJlZmVyZW5jZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIG9yaWdpbmFsQ29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHQvLyBUT0RPOiBNYWtlIHN1cmUgd2UgaGFuZGxlIHVwZGF0ZXMgZnJvbSBhbiBpbmxpbmVSZWZlcmVuY2UgYmVpbmcgYHJlc29sdmVkYCBsYXRlXG5cblx0XHR0aGlzLmRhdGEgPSAndXJpJyBpbiBpbmxpbmVSZWZlcmVuY2UuaW5saW5lUmVmZXJlbmNlXG5cdFx0XHQ/IGlubGluZVJlZmVyZW5jZS5pbmxpbmVSZWZlcmVuY2Vcblx0XHRcdDogJ25hbWUnIGluIGlubGluZVJlZmVyZW5jZS5pbmxpbmVSZWZlcmVuY2Vcblx0XHRcdFx0PyB7IGtpbmQ6ICdzeW1ib2wnLCBzeW1ib2w6IGlubGluZVJlZmVyZW5jZS5pbmxpbmVSZWZlcmVuY2UgfVxuXHRcdFx0XHQ6IHsgdXJpOiBpbmxpbmVSZWZlcmVuY2UuaW5saW5lUmVmZXJlbmNlIH07XG5cblx0XHRjb25zdCBjb250ZXh0S2V5U2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKG9yaWdpbmFsQ29udGV4dEtleVNlcnZpY2UuY3JlYXRlU2NvcGVkKGVsZW1lbnQpKTtcblx0XHR0aGlzLl9jaGF0UmVzb3VyY2VDb250ZXh0ID0gY2hhdEF0dGFjaG1lbnRSZXNvdXJjZUNvbnRleHRLZXkuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdGVsZW1lbnQuY2xhc3NMaXN0LmFkZChJbmxpbmVBbmNob3JXaWRnZXQuY2xhc3NOYW1lLCAnc2hvdy1maWxlLWljb25zJyk7XG5cblx0XHRsZXQgaWNvblRleHQ6IHN0cmluZztcblx0XHRsZXQgaWNvbkNsYXNzZXM6IHN0cmluZ1tdO1xuXG5cdFx0bGV0IGxvY2F0aW9uOiB7IHJlYWRvbmx5IHVyaTogVVJJOyByZWFkb25seSByYW5nZT86IElSYW5nZSB9O1xuXG5cdFx0bGV0IHVwZGF0ZUNvbnRleHRLZXlzOiAoKCkgPT4gUHJvbWlzZTx2b2lkPikgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHRoaXMuZGF0YS5raW5kID09PSAnc3ltYm9sJykge1xuXHRcdFx0Y29uc3Qgc3ltYm9sID0gdGhpcy5kYXRhLnN5bWJvbDtcblxuXHRcdFx0bG9jYXRpb24gPSB0aGlzLmRhdGEuc3ltYm9sLmxvY2F0aW9uO1xuXHRcdFx0aWNvblRleHQgPSB0aGlzLmRhdGEuc3ltYm9sLm5hbWU7XG5cdFx0XHRpY29uQ2xhc3NlcyA9IFsnY29kaWNvbicsIC4uLmdldEljb25DbGFzc2VzKG1vZGVsU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgU3ltYm9sS2luZHMudG9JY29uKHN5bWJvbC5raW5kKSldO1xuXG5cdFx0XHR0aGlzLl9zdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gaG9va1VwU3ltYm9sQXR0YWNobWVudERyYWdBbmRDb250ZXh0TWVudShhY2Nlc3NvciwgZWxlbWVudCwgY29udGV4dEtleVNlcnZpY2UsIHsgdmFsdWU6IHN5bWJvbC5sb2NhdGlvbiwgbmFtZTogc3ltYm9sLm5hbWUsIGtpbmQ6IHN5bWJvbC5raW5kIH0sIE1lbnVJZC5DaGF0SW5saW5lU3ltYm9sQW5jaG9yQ29udGV4dCkpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bG9jYXRpb24gPSB0aGlzLmRhdGE7XG5cblx0XHRcdGNvbnN0IGxhYmVsID0gbGFiZWxTZXJ2aWNlLmdldFVyaUJhc2VuYW1lTGFiZWwobG9jYXRpb24udXJpKTtcblx0XHRcdGljb25UZXh0ID0gbG9jYXRpb24ucmFuZ2UgJiYgdGhpcy5kYXRhLmtpbmQgIT09ICdzeW1ib2wnID9cblx0XHRcdFx0YCR7bGFiZWx9IyR7bG9jYXRpb24ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyfS0ke2xvY2F0aW9uLnJhbmdlLmVuZExpbmVOdW1iZXJ9YCA6XG5cdFx0XHRcdGxhYmVsO1xuXG5cdFx0XHRsZXQgZmlsZUtpbmQgPSBsb2NhdGlvbi51cmkucGF0aC5lbmRzV2l0aCgnLycpID8gRmlsZUtpbmQuRk9MREVSIDogRmlsZUtpbmQuRklMRTtcblx0XHRcdGNvbnN0IHJlY29tcHV0ZUljb25DbGFzc2VzID0gKCkgPT4gZ2V0SWNvbkNsYXNzZXMobW9kZWxTZXJ2aWNlLCBsYW5ndWFnZVNlcnZpY2UsIGxvY2F0aW9uLnVyaSwgZmlsZUtpbmQsIGZpbGVLaW5kID09PSBGaWxlS2luZC5GT0xERVIgJiYgIXRoZW1lU2VydmljZS5nZXRGaWxlSWNvblRoZW1lKCkuaGFzRm9sZGVySWNvbnMgPyBGb2xkZXJUaGVtZUljb24gOiB1bmRlZmluZWQpO1xuXG5cdFx0XHRpY29uQ2xhc3NlcyA9IHJlY29tcHV0ZUljb25DbGFzc2VzKCk7XG5cblx0XHRcdGNvbnN0IHJlZnJlc2hJY29uQ2xhc3NlcyA9ICgpID0+IHtcblx0XHRcdFx0aWNvbkVsLmNsYXNzTGlzdC5yZW1vdmUoLi4uaWNvbkNsYXNzZXMpO1xuXHRcdFx0XHRpY29uQ2xhc3NlcyA9IHJlY29tcHV0ZUljb25DbGFzc2VzKCk7XG5cdFx0XHRcdGljb25FbC5jbGFzc0xpc3QuYWRkKC4uLmljb25DbGFzc2VzKTtcblx0XHRcdH07XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoZW1lU2VydmljZS5vbkRpZEZpbGVJY29uVGhlbWVDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0XHRyZWZyZXNoSWNvbkNsYXNzZXMoKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0Y29uc3QgaXNGb2xkZXJDb250ZXh0ID0gRXhwbG9yZXJGb2xkZXJDb250ZXh0LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0XHRmaWxlU2VydmljZS5zdGF0KGxvY2F0aW9uLnVyaSlcblx0XHRcdFx0LnRoZW4oc3RhdCA9PiB7XG5cdFx0XHRcdFx0aXNGb2xkZXJDb250ZXh0LnNldChzdGF0LmlzRGlyZWN0b3J5KTtcblx0XHRcdFx0XHRpZiAoc3RhdC5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRcdFx0ZmlsZUtpbmQgPSBGaWxlS2luZC5GT0xERVI7XG5cdFx0XHRcdFx0XHRyZWZyZXNoSWNvbkNsYXNzZXMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC5jYXRjaCgoKSA9PiB7IH0pO1xuXG5cdFx0XHQvLyBDb250ZXh0IG1lbnVcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoZWxlbWVudCwgZG9tLkV2ZW50VHlwZS5DT05URVhUX01FTlUsIGFzeW5jIGRvbUV2ZW50ID0+IHtcblx0XHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRNb3VzZUV2ZW50KGRvbS5nZXRXaW5kb3coZG9tRXZlbnQpLCBkb21FdmVudCk7XG5cdFx0XHRcdGRvbS5FdmVudEhlbHBlci5zdG9wKGRvbUV2ZW50LCB0cnVlKTtcblxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHVwZGF0ZUNvbnRleHRLZXlzPy4oKTtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0XHRcdGNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0XHRcdGdldEFuY2hvcjogKCkgPT4gZXZlbnQsXG5cdFx0XHRcdFx0Z2V0QWN0aW9uczogKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgbWVudSA9IG1lbnVTZXJ2aWNlLmdldE1lbnVBY3Rpb25zKE1lbnVJZC5DaGF0SW5saW5lUmVzb3VyY2VBbmNob3JDb250ZXh0LCBjb250ZXh0S2V5U2VydmljZSwgeyBhcmc6IGxvY2F0aW9uLnVyaSB9KTtcblx0XHRcdFx0XHRcdHJldHVybiBnZXRGbGF0Q29udGV4dE1lbnVBY3Rpb25zKG1lbnUpO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc291cmNlQ29udGV4dEtleSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSZXNvdXJjZUNvbnRleHRLZXkoY29udGV4dEtleVNlcnZpY2UsIGZpbGVTZXJ2aWNlLCBsYW5ndWFnZVNlcnZpY2UsIG1vZGVsU2VydmljZSkpO1xuXHRcdHJlc291cmNlQ29udGV4dEtleS5zZXQobG9jYXRpb24udXJpKTtcblx0XHR0aGlzLl9jaGF0UmVzb3VyY2VDb250ZXh0LnNldChsb2NhdGlvbi51cmkudG9TdHJpbmcoKSk7XG5cblx0XHRjb25zdCBpY29uRWwgPSBkb20uJCgnc3Bhbi5pY29uJyk7XG5cdFx0aWNvbkVsLmNsYXNzTGlzdC5hZGQoLi4uaWNvbkNsYXNzZXMpO1xuXHRcdGVsZW1lbnQucmVwbGFjZUNoaWxkcmVuKGljb25FbCwgZG9tLiQoJ3NwYW4uaWNvbi1sYWJlbCcsIHt9LCBpY29uVGV4dCkpO1xuXG5cdFx0Y29uc3QgZnJhZ21lbnQgPSBsb2NhdGlvbi5yYW5nZSA/IGAke2xvY2F0aW9uLnJhbmdlLnN0YXJ0TGluZU51bWJlcn0sJHtsb2NhdGlvbi5yYW5nZS5zdGFydENvbHVtbn1gIDogJyc7XG5cdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2RhdGEtaHJlZicsIChmcmFnbWVudCA/IGxvY2F0aW9uLnVyaS53aXRoKHsgZnJhZ21lbnQgfSkgOiBsb2NhdGlvbi51cmkpLnRvU3RyaW5nKCkpO1xuXG5cdFx0Ly8gSG92ZXJcblx0XHRjb25zdCByZWxhdGl2ZUxhYmVsID0gbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGxvY2F0aW9uLnVyaSwgeyByZWxhdGl2ZTogdHJ1ZSB9KTtcblx0XHR0aGlzLl9yZWdpc3Rlcihob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ2VsZW1lbnQnKSwgZWxlbWVudCwgcmVsYXRpdmVMYWJlbCkpO1xuXG5cdFx0Ly8gRHJhZyBhbmQgZHJvcFxuXHRcdGlmICh0aGlzLmRhdGEua2luZCAhPT0gJ3N5bWJvbCcpIHtcblx0XHRcdGVsZW1lbnQuZHJhZ2dhYmxlID0gdHJ1ZTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoZWxlbWVudCwgJ2RyYWdzdGFydCcsIGUgPT4ge1xuXHRcdFx0XHRjb25zdCBzdGF0OiBJUmVzb3VyY2VTdGF0ID0ge1xuXHRcdFx0XHRcdHJlc291cmNlOiBsb2NhdGlvbi51cmksXG5cdFx0XHRcdFx0c2VsZWN0aW9uOiBsb2NhdGlvbi5yYW5nZSxcblx0XHRcdFx0fTtcblx0XHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gZmlsbEVkaXRvcnNEcmFnRGF0YShhY2Nlc3NvciwgW3N0YXRdLCBlKSk7XG5cblxuXHRcdFx0XHRlLmRhdGFUcmFuc2Zlcj8uc2V0RHJhZ0ltYWdlKGVsZW1lbnQsIDAsIDApO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0Z2V0SFRNTEVsZW1lbnQoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLmVsZW1lbnQ7XG5cdH1cbn1cblxuLy8jcmVnaW9uIFJlc291cmNlIGNvbnRleHQgbWVudVxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgQWRkRmlsZVRvQ2hhdEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBpZCA9ICdjaGF0LmlubGluZVJlc291cmNlQW5jaG9yLmFkZEZpbGVUb0NoYXQnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBBZGRGaWxlVG9DaGF0QWN0aW9uLmlkLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ2FjdGlvbnMuYXR0YWNoLmxhYmVsJywgXCJBZGQgRmlsZSB0byBDaGF0XCIpLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0SW5saW5lUmVzb3VyY2VBbmNob3JDb250ZXh0LFxuXHRcdFx0XHRncm91cDogJ2NoYXQnLFxuXHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdFx0d2hlbjogRXhwbG9yZXJGb2xkZXJDb250ZXh0Lm5lZ2F0ZSgpLFxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgcmVzb3VyY2U6IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNoYXRXaWRnZXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0V2lkZ2V0U2VydmljZSk7XG5cdFx0Y29uc3QgdmFyaWFibGVzU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFZhcmlhYmxlc1NlcnZpY2UpO1xuXG5cdFx0Y29uc3Qgd2lkZ2V0ID0gY2hhdFdpZGdldFNlcnZpY2UubGFzdEZvY3VzZWRXaWRnZXQ7XG5cdFx0aWYgKCF3aWRnZXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR2YXJpYWJsZXNTZXJ2aWNlLmF0dGFjaENvbnRleHQoJ2ZpbGUnLCByZXNvdXJjZSwgd2lkZ2V0LmxvY2F0aW9uKTtcblx0fVxufSk7XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gUmVzb3VyY2Uga2V5YmluZGluZ3NcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIENvcHlSZXNvdXJjZUFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBpZCA9ICdjaGF0LmlubGluZVJlc291cmNlQW5jaG9yLmNvcHlSZXNvdXJjZSc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvcHlSZXNvdXJjZUFjdGlvbi5pZCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdhY3Rpb25zLmNvcHkubGFiZWwnLCBcIkNvcHlcIiksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRwcmVjb25kaXRpb246IGNoYXRBdHRhY2htZW50UmVzb3VyY2VDb250ZXh0S2V5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUMsXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjaGF0V2lkZ2V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdE1hcmtkb3duQW5jaG9yU2VydmljZSk7XG5cdFx0Y29uc3QgY2xpcGJvYXJkU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2xpcGJvYXJkU2VydmljZSk7XG5cblx0XHRjb25zdCBhbmNob3IgPSBjaGF0V2lkZ2V0U2VydmljZS5sYXN0Rm9jdXNlZEFuY2hvcjtcblx0XHRpZiAoIWFuY2hvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFRPRE86IHdlIHNob3VsZCBhbHNvIHdyaXRlIG91dCB0aGUgc3RhbmRhcmQgbWltZSB0eXBlcyBzbyB0aGF0IGV4dGVybmFsIHByb2dyYW1zIGNhbiB1c2UgdGhlbVxuXHRcdC8vIGxpa2UgaG93IGBmaWxsRWRpdG9yc0RyYWdEYXRhYCB3b3JrcyBidXQgd2l0aG91dCBoYXZpbmcgYW4gZXZlbnQgdG8gd29yayB3aXRoLlxuXHRcdGNvbnN0IHJlc291cmNlID0gYW5jaG9yLmRhdGEua2luZCA9PT0gJ3N5bWJvbCcgPyBhbmNob3IuZGF0YS5zeW1ib2wubG9jYXRpb24udXJpIDogYW5jaG9yLmRhdGEudXJpO1xuXHRcdGNsaXBib2FyZFNlcnZpY2Uud3JpdGVSZXNvdXJjZXMoW3Jlc291cmNlXSk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgT3BlblRvU2lkZVJlc291cmNlQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IGlkID0gJ2NoYXQuaW5saW5lUmVzb3VyY2VBbmNob3Iub3BlblRvU2lkZSc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IE9wZW5Ub1NpZGVSZXNvdXJjZUFjdGlvbi5pZCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdhY3Rpb25zLm9wZW5Ub1NpZGUubGFiZWwnLCBcIk9wZW4gdG8gdGhlIFNpZGVcIiksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRwcmVjb25kaXRpb246IGNoYXRBdHRhY2htZW50UmVzb3VyY2VDb250ZXh0S2V5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRXh0ZXJuYWxFeHRlbnNpb24gKyAyLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRcdG1hYzoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5FbnRlclxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IFtNZW51SWQuQ2hhdElubGluZVN5bWJvbEFuY2hvckNvbnRleHQsIE1lbnVJZC5DaGF0SW5wdXRTeW1ib2xBdHRhY2htZW50Q29udGV4dF0ubWFwKGlkID0+ICh7XG5cdFx0XHRcdGlkOiBpZCxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdH0pKVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmc/OiBMb2NhdGlvbiB8IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgdGFyZ2V0ID0gdGhpcy5nZXRUYXJnZXQoYWNjZXNzb3IsIGFyZyk7XG5cdFx0aWYgKCF0YXJnZXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBpbnB1dDogSVRleHRSZXNvdXJjZUVkaXRvcklucHV0ID0gVVJJLmlzVXJpKHRhcmdldClcblx0XHRcdD8geyByZXNvdXJjZTogdGFyZ2V0IH1cblx0XHRcdDoge1xuXHRcdFx0XHRyZXNvdXJjZTogdGFyZ2V0LnVyaSwgb3B0aW9uczoge1xuXHRcdFx0XHRcdHNlbGVjdGlvbjoge1xuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IHRhcmdldC5yYW5nZS5zdGFydENvbHVtbixcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogdGFyZ2V0LnJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3JzKFtpbnB1dF0sIFNJREVfR1JPVVApO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRUYXJnZXQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZzogVVJJIHwgTG9jYXRpb24gfCB1bmRlZmluZWQpOiBMb2NhdGlvbiB8IFVSSSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgY2hhdFdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRNYXJrZG93bkFuY2hvclNlcnZpY2UpO1xuXG5cdFx0aWYgKGFyZykge1xuXHRcdFx0cmV0dXJuIGFyZztcblx0XHR9XG5cblx0XHRjb25zdCBhbmNob3IgPSBjaGF0V2lkZ2V0U2VydmljZS5sYXN0Rm9jdXNlZEFuY2hvcjtcblx0XHRpZiAoIWFuY2hvcikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gYW5jaG9yLmRhdGEua2luZCA9PT0gJ3N5bWJvbCcgPyBhbmNob3IuZGF0YS5zeW1ib2wubG9jYXRpb24gOiBhbmNob3IuZGF0YS51cmk7XG5cdH1cbn0pO1xuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIFN5bWJvbCBjb250ZXh0IG1lbnVcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEdvVG9EZWZpbml0aW9uQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IGlkID0gJ2NoYXQuaW5saW5lU3ltYm9sQW5jaG9yLmdvVG9EZWZpbml0aW9uJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogR29Ub0RlZmluaXRpb25BY3Rpb24uaWQsXG5cdFx0XHR0aXRsZToge1xuXHRcdFx0XHQuLi5ubHMubG9jYWxpemUyKCdhY3Rpb25zLmdvVG9EZWNsLmxhYmVsJywgXCJHbyB0byBEZWZpbml0aW9uXCIpLFxuXHRcdFx0XHRtbmVtb25pY1RpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaUdvdG9EZWZpbml0aW9uJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkdvIHRvICYmRGVmaW5pdGlvblwiKSxcblx0XHRcdH0sXG5cdFx0XHRtZW51OiBbTWVudUlkLkNoYXRJbmxpbmVTeW1ib2xBbmNob3JDb250ZXh0LCBNZW51SWQuQ2hhdElucHV0U3ltYm9sQXR0YWNobWVudENvbnRleHRdLm1hcChpZCA9PiAoe1xuXHRcdFx0XHRpZCxcblx0XHRcdFx0Z3JvdXA6ICc0X3N5bWJvbF9uYXYnLFxuXHRcdFx0XHRvcmRlcjogMS4xLFxuXHRcdFx0XHR3aGVuOiBFZGl0b3JDb250ZXh0S2V5cy5oYXNEZWZpbml0aW9uUHJvdmlkZXIsXG5cdFx0XHR9KSlcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgbG9jYXRpb246IExvY2F0aW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpO1xuXG5cdFx0YXdhaXQgb3BlbkVkaXRvcldpdGhTZWxlY3Rpb24oZWRpdG9yU2VydmljZSwgbG9jYXRpb24pO1xuXG5cdFx0Y29uc3QgYWN0aW9uID0gbmV3IERlZmluaXRpb25BY3Rpb24oeyBvcGVuVG9TaWRlOiBmYWxzZSwgb3BlbkluUGVlazogZmFsc2UsIG11dGVNZXNzYWdlOiB0cnVlIH0sIHsgdGl0bGU6IHsgdmFsdWU6ICcnLCBvcmlnaW5hbDogJycgfSwgaWQ6ICcnLCBwcmVjb25kaXRpb246IHVuZGVmaW5lZCB9KTtcblx0XHRyZXR1cm4gYWN0aW9uLnJ1bihhY2Nlc3Nvcik7XG5cdH1cbn0pO1xuXG5hc3luYyBmdW5jdGlvbiBvcGVuRWRpdG9yV2l0aFNlbGVjdGlvbihlZGl0b3JTZXJ2aWNlOiBJQ29kZUVkaXRvclNlcnZpY2UsIGxvY2F0aW9uOiBMb2NhdGlvbikge1xuXHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5Db2RlRWRpdG9yKHtcblx0XHRyZXNvdXJjZTogbG9jYXRpb24udXJpLCBvcHRpb25zOiB7XG5cdFx0XHRzZWxlY3Rpb246IHtcblx0XHRcdFx0c3RhcnRDb2x1bW46IGxvY2F0aW9uLnJhbmdlLnN0YXJ0Q29sdW1uLFxuXHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IGxvY2F0aW9uLnJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdH1cblx0XHR9XG5cdH0sIG51bGwpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBydW5Hb1RvQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29tbWFuZDogc3RyaW5nLCBsb2NhdGlvbjogTG9jYXRpb24pIHtcblx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpO1xuXHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXG5cdGF3YWl0IG9wZW5FZGl0b3JXaXRoU2VsZWN0aW9uKGVkaXRvclNlcnZpY2UsIGxvY2F0aW9uKTtcblxuXHRyZXR1cm4gY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoY29tbWFuZCk7XG59XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBHb1RvVHlwZURlZmluaXRpb25zQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IGlkID0gJ2NoYXQuaW5saW5lU3ltYm9sQW5jaG9yLmdvVG9UeXBlRGVmaW5pdGlvbnMnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBHb1RvVHlwZURlZmluaXRpb25zQWN0aW9uLmlkLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubmxzLmxvY2FsaXplMignZ29Ub1R5cGVEZWZpbml0aW9ucy5sYWJlbCcsIFwiR28gdG8gVHlwZSBEZWZpbml0aW9uc1wiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbmxzLmxvY2FsaXplKHsga2V5OiAnbWlHb3RvVHlwZURlZmluaXRpb24nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiR28gdG8gJiZUeXBlIERlZmluaXRpb25zXCIpLFxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IFtNZW51SWQuQ2hhdElubGluZVN5bWJvbEFuY2hvckNvbnRleHQsIE1lbnVJZC5DaGF0SW5wdXRTeW1ib2xBdHRhY2htZW50Q29udGV4dF0ubWFwKGlkID0+ICh7XG5cdFx0XHRcdGlkLFxuXHRcdFx0XHRncm91cDogJzRfc3ltYm9sX25hdicsXG5cdFx0XHRcdG9yZGVyOiAxLjEsXG5cdFx0XHRcdHdoZW46IEVkaXRvckNvbnRleHRLZXlzLmhhc1R5cGVEZWZpbml0aW9uUHJvdmlkZXIsXG5cdFx0XHR9KSksXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGxvY2F0aW9uOiBMb2NhdGlvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBydW5Hb1RvQ29tbWFuZChhY2Nlc3NvciwgJ2VkaXRvci5hY3Rpb24uZ29Ub1R5cGVEZWZpbml0aW9uJywgbG9jYXRpb24pO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEdvVG9JbXBsZW1lbnRhdGlvbnMgZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgaWQgPSAnY2hhdC5pbmxpbmVTeW1ib2xBbmNob3IuZ29Ub0ltcGxlbWVudGF0aW9ucyc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEdvVG9JbXBsZW1lbnRhdGlvbnMuaWQsXG5cdFx0XHR0aXRsZToge1xuXHRcdFx0XHQuLi5ubHMubG9jYWxpemUyKCdnb1RvSW1wbGVtZW50YXRpb25zLmxhYmVsJywgXCJHbyB0byBJbXBsZW1lbnRhdGlvbnNcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pR290b0ltcGxlbWVudGF0aW9ucycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJHbyB0byAmJkltcGxlbWVudGF0aW9uc1wiKSxcblx0XHRcdH0sXG5cdFx0XHRtZW51OiBbTWVudUlkLkNoYXRJbmxpbmVTeW1ib2xBbmNob3JDb250ZXh0LCBNZW51SWQuQ2hhdElucHV0U3ltYm9sQXR0YWNobWVudENvbnRleHRdLm1hcChpZCA9PiAoe1xuXHRcdFx0XHRpZCxcblx0XHRcdFx0Z3JvdXA6ICc0X3N5bWJvbF9uYXYnLFxuXHRcdFx0XHRvcmRlcjogMS4yLFxuXHRcdFx0XHR3aGVuOiBFZGl0b3JDb250ZXh0S2V5cy5oYXNJbXBsZW1lbnRhdGlvblByb3ZpZGVyLFxuXHRcdFx0fSkpLFxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBsb2NhdGlvbjogTG9jYXRpb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gcnVuR29Ub0NvbW1hbmQoYWNjZXNzb3IsICdlZGl0b3IuYWN0aW9uLmdvVG9JbXBsZW1lbnRhdGlvbicsIGxvY2F0aW9uKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBHb1RvUmVmZXJlbmNlc0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBpZCA9ICdjaGF0LmlubGluZVN5bWJvbEFuY2hvci5nb1RvUmVmZXJlbmNlcyc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEdvVG9SZWZlcmVuY2VzQWN0aW9uLmlkLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubmxzLmxvY2FsaXplMignZ29Ub1JlZmVyZW5jZXMubGFiZWwnLCBcIkdvIHRvIFJlZmVyZW5jZXNcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pR290b1JlZmVyZW5jZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJHbyB0byAmJlJlZmVyZW5jZXNcIiksXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW01lbnVJZC5DaGF0SW5saW5lU3ltYm9sQW5jaG9yQ29udGV4dCwgTWVudUlkLkNoYXRJbnB1dFN5bWJvbEF0dGFjaG1lbnRDb250ZXh0XS5tYXAoaWQgPT4gKHtcblx0XHRcdFx0aWQsXG5cdFx0XHRcdGdyb3VwOiAnNF9zeW1ib2xfbmF2Jyxcblx0XHRcdFx0b3JkZXI6IDEuMyxcblx0XHRcdFx0d2hlbjogRWRpdG9yQ29udGV4dEtleXMuaGFzUmVmZXJlbmNlUHJvdmlkZXIsXG5cdFx0XHR9KSksXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGxvY2F0aW9uOiBMb2NhdGlvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBydW5Hb1RvQ29tbWFuZChhY2Nlc3NvciwgJ2VkaXRvci5hY3Rpb24uZ29Ub1JlZmVyZW5jZXMnLCBsb2NhdGlvbik7XG5cdH1cbn0pO1xuXG4vLyNlbmRyZWdpb25cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBQUE7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxTQUFTLGNBQWM7QUFDaEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsMEJBQTBCO0FBRW5DLFNBQVMseUJBQXlCO0FBQ2xDLFNBQW1CLG1CQUFtQjtBQUN0QyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHdCQUF3QjtBQUNqQyxZQUFZLFNBQVM7QUFDckIsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyxTQUFT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
