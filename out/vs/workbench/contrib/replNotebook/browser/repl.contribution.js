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
import { Event } from "../../../../base/common/event.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { parse } from "../../../../base/common/marshalling.js";
import { isEqual } from "../../../../base/common/resources.js";
import { isFalsyOrWhitespace } from "../../../../base/common/strings.js";
import { assertType } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { IBulkEditService } from "../../../../editor/browser/services/bulkEditService.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../editor/common/languages/modesRegistry.js";
import { localize2 } from "../../../../nls.js";
import { AccessibleViewRegistry } from "../../../../platform/accessibility/browser/accessibleViewRegistry.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { EditorExtensions } from "../../../common/editor.js";
import { IEditorResolverService, RegisteredEditorPriority } from "../../../services/editor/common/editorResolverService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { IWorkingCopyEditorService } from "../../../services/workingCopy/common/workingCopyEditorService.js";
import { ResourceNotebookCellEdit } from "../../bulkEdit/browser/bulkCellEdits.js";
import { getReplView } from "../../debug/browser/repl.js";
import { REPL_VIEW_ID } from "../../debug/common/debug.js";
import { InlineChatController } from "../../inlineChat/browser/inlineChatController.js";
import { IInteractiveHistoryService } from "../../interactive/browser/interactiveHistoryService.js";
import { NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT } from "../../notebook/browser/controller/coreActions.js";
import * as icons from "../../notebook/browser/notebookIcons.js";
import { ReplEditorAccessibleView } from "../../notebook/browser/replEditorAccessibleView.js";
import { INotebookEditorService } from "../../notebook/browser/services/notebookEditorService.js";
import { CellEditType, CellKind, NotebookSetting, NotebookWorkingCopyTypeIdentifier, REPL_EDITOR_ID } from "../../notebook/common/notebookCommon.js";
import { IS_COMPOSITE_NOTEBOOK, MOST_RECENT_REPL_EDITOR, NOTEBOOK_CELL_LIST_FOCUSED, NOTEBOOK_EDITOR_FOCUSED } from "../../notebook/common/notebookContextKeys.js";
import { INotebookEditorModelResolverService } from "../../notebook/common/notebookEditorModelResolverService.js";
import { INotebookService } from "../../notebook/common/notebookService.js";
import { isReplEditorControl, ReplEditor } from "./replEditor.js";
import { ReplEditorHistoryAccessibilityHelp, ReplEditorInputAccessibilityHelp } from "./replEditorAccessibilityHelp.js";
import { ReplEditorInput } from "./replEditorInput.js";
class ReplEditorSerializer {
  canSerialize(input) {
    return input.typeId === ReplEditorInput.ID;
  }
  serialize(input) {
    assertType(input instanceof ReplEditorInput);
    const data = {
      resource: input.resource,
      preferredResource: input.preferredResource,
      viewType: input.viewType,
      options: input.options,
      label: input.getName()
    };
    return JSON.stringify(data);
  }
  deserialize(instantiationService, raw) {
    const data = parse(raw);
    if (!data) {
      return void 0;
    }
    const { resource, viewType } = data;
    if (!data || !URI.isUri(resource) || typeof viewType !== "string") {
      return void 0;
    }
    const input = instantiationService.createInstance(ReplEditorInput, resource, data.label);
    return input;
  }
}
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    ReplEditor,
    REPL_EDITOR_ID,
    "REPL Editor"
  ),
  [
    new SyncDescriptor(ReplEditorInput)
  ]
);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(
  ReplEditorInput.ID,
  ReplEditorSerializer
);
let ReplDocumentContribution = class extends Disposable {
  constructor(notebookService, editorResolverService, notebookEditorModelResolverService, instantiationService, configurationService) {
    super();
    this.notebookEditorModelResolverService = notebookEditorModelResolverService;
    this.instantiationService = instantiationService;
    this.configurationService = configurationService;
    this.editorInputCache = new ResourceMap();
    editorResolverService.registerEditor(
      // don't match anything, we don't need to support re-opening files as REPL editor at this point
      ` `,
      {
        id: "repl",
        label: "repl Editor",
        priority: RegisteredEditorPriority.option
      },
      {
        // We want to support all notebook types which could have any file extension,
        // so we just check if the resource corresponds to a notebook
        canSupportResource: (uri) => notebookService.getNotebookTextModel(uri) !== void 0,
        singlePerResource: true
      },
      {
        createUntitledEditorInput: async ({ resource, options }) => {
          if (resource) {
            const editor2 = this.editorInputCache.get(resource);
            if (editor2 && !editor2.isDisposed()) {
              return { editor: editor2, options };
            } else if (editor2) {
              this.editorInputCache.delete(resource);
            }
          }
          const scratchpad = this.configurationService.getValue(NotebookSetting.InteractiveWindowPromptToSave) !== true;
          const ref = await this.notebookEditorModelResolverService.resolve({ untitledResource: resource }, "jupyter-notebook", { scratchpad, viewType: "repl" });
          const notebookUri = ref.object.notebook.uri;
          ref.object.notebook.onWillDispose(() => {
            ref.dispose();
          });
          const label = options?.label ?? void 0;
          const editor = this.instantiationService.createInstance(ReplEditorInput, notebookUri, label);
          this.editorInputCache.set(notebookUri, editor);
          Event.once(editor.onWillDispose)(() => this.editorInputCache.delete(notebookUri));
          return { editor, options };
        },
        createEditorInput: async ({ resource, options }) => {
          if (this.editorInputCache.has(resource)) {
            return { editor: this.editorInputCache.get(resource), options };
          }
          const label = options?.label ?? void 0;
          const editor = this.instantiationService.createInstance(ReplEditorInput, resource, label);
          this.editorInputCache.set(resource, editor);
          Event.once(editor.onWillDispose)(() => this.editorInputCache.delete(resource));
          return { editor, options };
        }
      }
    );
  }
};
ReplDocumentContribution.ID = "workbench.contrib.replDocument";
ReplDocumentContribution = __decorateClass([
  __decorateParam(0, INotebookService),
  __decorateParam(1, IEditorResolverService),
  __decorateParam(2, INotebookEditorModelResolverService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IConfigurationService)
], ReplDocumentContribution);
let ReplWindowWorkingCopyEditorHandler = class extends Disposable {
  constructor(instantiationService, workingCopyEditorService, extensionService, notebookService) {
    super();
    this.instantiationService = instantiationService;
    this.workingCopyEditorService = workingCopyEditorService;
    this.extensionService = extensionService;
    this.notebookService = notebookService;
    this._installHandler();
  }
  async handles(workingCopy) {
    const notebookType = this._getNotebookType(workingCopy);
    if (!notebookType) {
      return false;
    }
    return !!notebookType && notebookType.viewType === "repl" && await this.notebookService.canResolve(notebookType.notebookType);
  }
  isOpen(workingCopy, editor) {
    if (!this.handles(workingCopy)) {
      return false;
    }
    return editor instanceof ReplEditorInput && isEqual(workingCopy.resource, editor.resource);
  }
  createEditor(workingCopy) {
    return this.instantiationService.createInstance(ReplEditorInput, workingCopy.resource, void 0);
  }
  async _installHandler() {
    await this.extensionService.whenInstalledExtensionsRegistered();
    this._register(this.workingCopyEditorService.registerHandler(this));
  }
  _getNotebookType(workingCopy) {
    return NotebookWorkingCopyTypeIdentifier.parse(workingCopy.typeId);
  }
};
ReplWindowWorkingCopyEditorHandler.ID = "workbench.contrib.replWorkingCopyEditorHandler";
ReplWindowWorkingCopyEditorHandler = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IWorkingCopyEditorService),
  __decorateParam(2, IExtensionService),
  __decorateParam(3, INotebookService)
], ReplWindowWorkingCopyEditorHandler);
registerWorkbenchContribution2(ReplWindowWorkingCopyEditorHandler.ID, ReplWindowWorkingCopyEditorHandler, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ReplDocumentContribution.ID, ReplDocumentContribution, WorkbenchPhase.BlockRestore);
AccessibleViewRegistry.register(new ReplEditorInputAccessibilityHelp());
AccessibleViewRegistry.register(new ReplEditorHistoryAccessibilityHelp());
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "repl.focusLastItemExecuted",
      title: localize2("repl.focusLastReplOutput", "Focus Most Recent REPL Execution"),
      category: "REPL",
      menu: {
        id: MenuId.CommandPalette,
        when: MOST_RECENT_REPL_EDITOR
      },
      keybinding: [{
        primary: KeyChord(KeyMod.Alt | KeyCode.End, KeyMod.Alt | KeyCode.End),
        weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT,
        when: ContextKeyExpr.or(IS_COMPOSITE_NOTEBOOK, NOTEBOOK_CELL_LIST_FOCUSED.negate())
      }],
      precondition: MOST_RECENT_REPL_EDITOR
    });
  }
  async run(accessor, context) {
    const editorService = accessor.get(IEditorService);
    const editorControl = editorService.activeEditorPane?.getControl();
    const contextKeyService = accessor.get(IContextKeyService);
    let notebookEditor;
    if (editorControl && isReplEditorControl(editorControl)) {
      notebookEditor = editorControl.notebookEditor;
    } else {
      const uriString = MOST_RECENT_REPL_EDITOR.getValue(contextKeyService);
      const uri = uriString ? URI.parse(uriString) : void 0;
      if (!uri) {
        return;
      }
      const replEditor = editorService.findEditors(uri)[0];
      if (replEditor) {
        const editor = await editorService.openEditor(replEditor.editor, replEditor.groupId);
        const editorControl2 = editor?.getControl();
        if (editorControl2 && isReplEditorControl(editorControl2)) {
          notebookEditor = editorControl2.notebookEditor;
        }
      }
    }
    const viewModel = notebookEditor?.getViewModel();
    if (notebookEditor && viewModel) {
      const lastCellIndex = viewModel.length - 1;
      if (lastCellIndex >= 0) {
        const cell = viewModel.viewCells[lastCellIndex];
        notebookEditor.focusNotebookCell(cell, "container");
      }
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "repl.input.focus",
      title: localize2("repl.input.focus", "Focus Input Editor"),
      category: "REPL",
      menu: {
        id: MenuId.CommandPalette,
        when: MOST_RECENT_REPL_EDITOR
      },
      keybinding: [{
        when: ContextKeyExpr.and(IS_COMPOSITE_NOTEBOOK, NOTEBOOK_EDITOR_FOCUSED),
        weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT,
        primary: KeyMod.CtrlCmd | KeyCode.DownArrow
      }, {
        when: ContextKeyExpr.and(MOST_RECENT_REPL_EDITOR),
        weight: KeybindingWeight.WorkbenchContrib + 5,
        primary: KeyChord(KeyMod.Alt | KeyCode.Home, KeyMod.Alt | KeyCode.Home)
      }]
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const editorControl = editorService.activeEditorPane?.getControl();
    const contextKeyService = accessor.get(IContextKeyService);
    if (editorControl && isReplEditorControl(editorControl) && editorControl.notebookEditor) {
      editorService.activeEditorPane?.focus();
    } else {
      const uriString = MOST_RECENT_REPL_EDITOR.getValue(contextKeyService);
      const uri = uriString ? URI.parse(uriString) : void 0;
      if (!uri) {
        return;
      }
      const replEditor = editorService.findEditors(uri)[0];
      if (replEditor) {
        await editorService.openEditor({ resource: uri, options: { preserveFocus: false } }, replEditor.groupId);
      }
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "repl.execute",
      title: localize2("repl.execute", "Execute REPL input"),
      category: "REPL",
      keybinding: [{
        when: ContextKeyExpr.and(
          IS_COMPOSITE_NOTEBOOK,
          ContextKeyExpr.equals("activeEditor", "workbench.editor.repl"),
          NOTEBOOK_CELL_LIST_FOCUSED.negate()
        ),
        primary: KeyMod.CtrlCmd | KeyCode.Enter,
        weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
      }, {
        when: ContextKeyExpr.and(
          IS_COMPOSITE_NOTEBOOK,
          ContextKeyExpr.equals("activeEditor", "workbench.editor.repl"),
          ContextKeyExpr.equals("config.interactiveWindow.executeWithShiftEnter", true),
          NOTEBOOK_CELL_LIST_FOCUSED.negate()
        ),
        primary: KeyMod.Shift | KeyCode.Enter,
        weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
      }, {
        when: ContextKeyExpr.and(
          IS_COMPOSITE_NOTEBOOK,
          ContextKeyExpr.equals("activeEditor", "workbench.editor.repl"),
          ContextKeyExpr.equals("config.interactiveWindow.executeWithShiftEnter", false),
          NOTEBOOK_CELL_LIST_FOCUSED.negate()
        ),
        primary: KeyCode.Enter,
        weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
      }],
      menu: [
        {
          id: MenuId.ReplInputExecute
        }
      ],
      icon: icons.executeIcon,
      f1: false,
      metadata: {
        description: "Execute the Contents of the Input Box",
        args: [
          {
            name: "resource",
            description: "Interactive resource Uri",
            isOptional: true
          }
        ]
      }
    });
  }
  async run(accessor, context) {
    const editorService = accessor.get(IEditorService);
    const bulkEditService = accessor.get(IBulkEditService);
    const historyService = accessor.get(IInteractiveHistoryService);
    const notebookEditorService = accessor.get(INotebookEditorService);
    let editorControl;
    if (context) {
      const resourceUri = URI.revive(context);
      const editors = editorService.findEditors(resourceUri);
      for (const found of editors) {
        if (found.editor.typeId === ReplEditorInput.ID) {
          const editor = await editorService.openEditor(found.editor, found.groupId);
          editorControl = editor?.getControl();
          break;
        }
      }
    } else {
      editorControl = editorService.activeEditorPane?.getControl();
    }
    if (isReplEditorControl(editorControl)) {
      executeReplInput(bulkEditService, historyService, notebookEditorService, editorControl);
    }
  }
});
async function executeReplInput(bulkEditService, historyService, notebookEditorService, editorControl) {
  if (editorControl && editorControl.notebookEditor && editorControl.activeCodeEditor) {
    const notebookDocument = editorControl.notebookEditor.textModel;
    const textModel = editorControl.activeCodeEditor.getModel();
    const activeKernel = editorControl.notebookEditor.activeKernel;
    const language = activeKernel?.supportedLanguages[0] ?? PLAINTEXT_LANGUAGE_ID;
    if (notebookDocument && textModel) {
      const index = notebookDocument.length - 1;
      const value = textModel.getValue();
      if (isFalsyOrWhitespace(value)) {
        return;
      }
      const ctrl = InlineChatController.get(editorControl.activeCodeEditor);
      if (ctrl) {
        ctrl.acceptSession();
      }
      historyService.replaceLast(notebookDocument.uri, value);
      historyService.addToHistory(notebookDocument.uri, "");
      textModel.setValue("");
      notebookDocument.cells[index].resetTextBuffer(textModel.getTextBuffer());
      const collapseState = editorControl.notebookEditor.notebookOptions.getDisplayOptions().interactiveWindowCollapseCodeCells === "fromEditor" ? {
        inputCollapsed: false,
        outputCollapsed: false
      } : void 0;
      await bulkEditService.apply([
        new ResourceNotebookCellEdit(
          notebookDocument.uri,
          {
            editType: CellEditType.Replace,
            index,
            count: 0,
            cells: [{
              cellKind: CellKind.Code,
              mime: void 0,
              language,
              source: value,
              outputs: [],
              metadata: {},
              collapseState
            }]
          }
        )
      ]);
      const range = { start: index, end: index + 1 };
      editorControl.notebookEditor.revealCellRangeInView(range);
      await editorControl.notebookEditor.executeNotebookCells(editorControl.notebookEditor.getCellsInRange({ start: index, end: index + 1 }));
      const editor = notebookEditorService.getNotebookEditor(editorControl.notebookEditor.getId());
      if (editor) {
        editor.setSelections([range]);
        editor.setFocus(range);
      }
    }
  }
}
AccessibleViewRegistry.register(new ReplEditorAccessibleView());
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "list.find.replInputFocus",
  weight: KeybindingWeight.WorkbenchContrib + 1,
  when: ContextKeyExpr.equals("view", REPL_VIEW_ID),
  primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyF,
  secondary: [KeyCode.F3],
  handler: (accessor) => {
    getReplView(accessor.get(IViewsService))?.openFind();
  }
});
export {
  ReplDocumentContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9yZXBsTm90ZWJvb2svYnJvd3Nlci9yZXBsLmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgS2V5Q2hvcmQsIEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgcGFyc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGlzRmFsc3lPcldoaXRlc3BhY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IGFzc2VydFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUJ1bGtFZGl0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2J1bGtFZGl0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvY29kZUVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBQTEFJTlRFWFRfTEFOR1VBR0VfSUQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9tb2Rlc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmxlVmlld1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9icm93c2VyL2FjY2Vzc2libGVWaWV3UmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgTWVudUlkLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzUmVnaXN0cnksIEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEVkaXRvclBhbmVEZXNjcmlwdG9yLCBJRWRpdG9yUGFuZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgcmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yLCBXb3JrYmVuY2hQaGFzZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IEVkaXRvckV4dGVuc2lvbnMsIElFZGl0b3JDb250cm9sLCBJRWRpdG9yRmFjdG9yeVJlZ2lzdHJ5LCBJRWRpdG9yU2VyaWFsaXplciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElFZGl0b3JSZXNvbHZlclNlcnZpY2UsIFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5LmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUVkaXRvckhhbmRsZXIsIElXb3JraW5nQ29weUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJlc291cmNlTm90ZWJvb2tDZWxsRWRpdCB9IGZyb20gJy4uLy4uL2J1bGtFZGl0L2Jyb3dzZXIvYnVsa0NlbGxFZGl0cy5qcyc7XG5pbXBvcnQgeyBnZXRSZXBsVmlldyB9IGZyb20gJy4uLy4uL2RlYnVnL2Jyb3dzZXIvcmVwbC5qcyc7XG5pbXBvcnQgeyBSRVBMX1ZJRVdfSUQgfSBmcm9tICcuLi8uLi9kZWJ1Zy9jb21tb24vZGVidWcuanMnO1xuaW1wb3J0IHsgSW5saW5lQ2hhdENvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi9pbmxpbmVDaGF0L2Jyb3dzZXIvaW5saW5lQ2hhdENvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgSUludGVyYWN0aXZlSGlzdG9yeVNlcnZpY2UgfSBmcm9tICcuLi8uLi9pbnRlcmFjdGl2ZS9icm93c2VyL2ludGVyYWN0aXZlSGlzdG9yeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTk9URUJPT0tfRURJVE9SX1dJREdFVF9BQ1RJT05fV0VJR0hUIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2svYnJvd3Nlci9jb250cm9sbGVyL2NvcmVBY3Rpb25zLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0VkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9icm93c2VyL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0VkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uL25vdGVib29rL2Jyb3dzZXIvbm90ZWJvb2tFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0ICogYXMgaWNvbnMgZnJvbSAnLi4vLi4vbm90ZWJvb2svYnJvd3Nlci9ub3RlYm9va0ljb25zLmpzJztcbmltcG9ydCB7IFJlcGxFZGl0b3JBY2Nlc3NpYmxlVmlldyB9IGZyb20gJy4uLy4uL25vdGVib29rL2Jyb3dzZXIvcmVwbEVkaXRvckFjY2Vzc2libGVWaWV3LmpzJztcbmltcG9ydCB7IElOb3RlYm9va0VkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9icm93c2VyL3NlcnZpY2VzL25vdGVib29rRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDZWxsRWRpdFR5cGUsIENlbGxLaW5kLCBOb3RlYm9va1NldHRpbmcsIE5vdGVib29rV29ya2luZ0NvcHlUeXBlSWRlbnRpZmllciwgUkVQTF9FRElUT1JfSUQgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSVNfQ09NUE9TSVRFX05PVEVCT09LLCBNT1NUX1JFQ0VOVF9SRVBMX0VESVRPUiwgTk9URUJPT0tfQ0VMTF9MSVNUX0ZPQ1VTRUQsIE5PVEVCT09LX0VESVRPUl9GT0NVU0VEIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2svY29tbW9uL25vdGVib29rQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tFZGl0b3JJbnB1dE9wdGlvbnMgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFZGl0b3JNb2RlbFJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0VkaXRvck1vZGVsUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va1NlcnZpY2UgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzUmVwbEVkaXRvckNvbnRyb2wsIFJlcGxFZGl0b3IsIFJlcGxFZGl0b3JDb250cm9sIH0gZnJvbSAnLi9yZXBsRWRpdG9yLmpzJztcbmltcG9ydCB7IFJlcGxFZGl0b3JIaXN0b3J5QWNjZXNzaWJpbGl0eUhlbHAsIFJlcGxFZGl0b3JJbnB1dEFjY2Vzc2liaWxpdHlIZWxwIH0gZnJvbSAnLi9yZXBsRWRpdG9yQWNjZXNzaWJpbGl0eUhlbHAuanMnO1xuaW1wb3J0IHsgUmVwbEVkaXRvcklucHV0IH0gZnJvbSAnLi9yZXBsRWRpdG9ySW5wdXQuanMnO1xuXG50eXBlIFNlcmlhbGl6ZWROb3RlYm9va0VkaXRvckRhdGEgPSB7IHJlc291cmNlOiBVUkk7IHByZWZlcnJlZFJlc291cmNlOiBVUkk7IHZpZXdUeXBlOiBzdHJpbmc7IG9wdGlvbnM/OiBOb3RlYm9va0VkaXRvcklucHV0T3B0aW9uczsgbGFiZWw/OiBzdHJpbmcgfTtcbmNsYXNzIFJlcGxFZGl0b3JTZXJpYWxpemVyIGltcGxlbWVudHMgSUVkaXRvclNlcmlhbGl6ZXIge1xuXHRjYW5TZXJpYWxpemUoaW5wdXQ6IEVkaXRvcklucHV0KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGlucHV0LnR5cGVJZCA9PT0gUmVwbEVkaXRvcklucHV0LklEO1xuXHR9XG5cdHNlcmlhbGl6ZShpbnB1dDogRWRpdG9ySW5wdXQpOiBzdHJpbmcge1xuXHRcdGFzc2VydFR5cGUoaW5wdXQgaW5zdGFuY2VvZiBSZXBsRWRpdG9ySW5wdXQpO1xuXHRcdGNvbnN0IGRhdGE6IFNlcmlhbGl6ZWROb3RlYm9va0VkaXRvckRhdGEgPSB7XG5cdFx0XHRyZXNvdXJjZTogaW5wdXQucmVzb3VyY2UsXG5cdFx0XHRwcmVmZXJyZWRSZXNvdXJjZTogaW5wdXQucHJlZmVycmVkUmVzb3VyY2UsXG5cdFx0XHR2aWV3VHlwZTogaW5wdXQudmlld1R5cGUsXG5cdFx0XHRvcHRpb25zOiBpbnB1dC5vcHRpb25zLFxuXHRcdFx0bGFiZWw6IGlucHV0LmdldE5hbWUoKVxuXHRcdH07XG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGEpO1xuXHR9XG5cdGRlc2VyaWFsaXplKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsIHJhdzogc3RyaW5nKSB7XG5cdFx0Y29uc3QgZGF0YSA9IDxTZXJpYWxpemVkTm90ZWJvb2tFZGl0b3JEYXRhPnBhcnNlKHJhdyk7XG5cdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCB7IHJlc291cmNlLCB2aWV3VHlwZSB9ID0gZGF0YTtcblx0XHRpZiAoIWRhdGEgfHwgIVVSSS5pc1VyaShyZXNvdXJjZSkgfHwgdHlwZW9mIHZpZXdUeXBlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBpbnB1dCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlcGxFZGl0b3JJbnB1dCwgcmVzb3VyY2UsIGRhdGEubGFiZWwpO1xuXHRcdHJldHVybiBpbnB1dDtcblx0fVxufVxuXG5SZWdpc3RyeS5hczxJRWRpdG9yUGFuZVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvclBhbmUpLnJlZ2lzdGVyRWRpdG9yUGFuZShcblx0RWRpdG9yUGFuZURlc2NyaXB0b3IuY3JlYXRlKFxuXHRcdFJlcGxFZGl0b3IsXG5cdFx0UkVQTF9FRElUT1JfSUQsXG5cdFx0J1JFUEwgRWRpdG9yJ1xuXHQpLFxuXHRbXG5cdFx0bmV3IFN5bmNEZXNjcmlwdG9yKFJlcGxFZGl0b3JJbnB1dClcblx0XVxuKTtcblxuUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KS5yZWdpc3RlckVkaXRvclNlcmlhbGl6ZXIoXG5cdFJlcGxFZGl0b3JJbnB1dC5JRCxcblx0UmVwbEVkaXRvclNlcmlhbGl6ZXJcbik7XG5cbmV4cG9ydCBjbGFzcyBSZXBsRG9jdW1lbnRDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLnJlcGxEb2N1bWVudCc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3JJbnB1dENhY2hlID0gbmV3IFJlc291cmNlTWFwPFJlcGxFZGl0b3JJbnB1dD4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU5vdGVib29rU2VydmljZSBub3RlYm9va1NlcnZpY2U6IElOb3RlYm9va1NlcnZpY2UsXG5cdFx0QElFZGl0b3JSZXNvbHZlclNlcnZpY2UgZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlOiBJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tFZGl0b3JNb2RlbFJlc29sdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rRWRpdG9yTW9kZWxSZXNvbHZlclNlcnZpY2U6IElOb3RlYm9va0VkaXRvck1vZGVsUmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRlZGl0b3JSZXNvbHZlclNlcnZpY2UucmVnaXN0ZXJFZGl0b3IoXG5cdFx0XHQvLyBkb24ndCBtYXRjaCBhbnl0aGluZywgd2UgZG9uJ3QgbmVlZCB0byBzdXBwb3J0IHJlLW9wZW5pbmcgZmlsZXMgYXMgUkVQTCBlZGl0b3IgYXQgdGhpcyBwb2ludFxuXHRcdFx0YCBgLFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3JlcGwnLFxuXHRcdFx0XHRsYWJlbDogJ3JlcGwgRWRpdG9yJyxcblx0XHRcdFx0cHJpb3JpdHk6IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eS5vcHRpb25cblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdC8vIFdlIHdhbnQgdG8gc3VwcG9ydCBhbGwgbm90ZWJvb2sgdHlwZXMgd2hpY2ggY291bGQgaGF2ZSBhbnkgZmlsZSBleHRlbnNpb24sXG5cdFx0XHRcdC8vIHNvIHdlIGp1c3QgY2hlY2sgaWYgdGhlIHJlc291cmNlIGNvcnJlc3BvbmRzIHRvIGEgbm90ZWJvb2tcblx0XHRcdFx0Y2FuU3VwcG9ydFJlc291cmNlOiB1cmkgPT4gbm90ZWJvb2tTZXJ2aWNlLmdldE5vdGVib29rVGV4dE1vZGVsKHVyaSkgIT09IHVuZGVmaW5lZCxcblx0XHRcdFx0c2luZ2xlUGVyUmVzb3VyY2U6IHRydWVcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZVVudGl0bGVkRWRpdG9ySW5wdXQ6IGFzeW5jICh7IHJlc291cmNlLCBvcHRpb25zIH0pID0+IHtcblx0XHRcdFx0XHRpZiAocmVzb3VyY2UpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGVkaXRvciA9IHRoaXMuZWRpdG9ySW5wdXRDYWNoZS5nZXQocmVzb3VyY2UpO1xuXHRcdFx0XHRcdFx0aWYgKGVkaXRvciAmJiAhZWRpdG9yLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4geyBlZGl0b3IsIG9wdGlvbnMgfTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoZWRpdG9yKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZWRpdG9ySW5wdXRDYWNoZS5kZWxldGUocmVzb3VyY2UpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCBzY3JhdGNocGFkID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcuSW50ZXJhY3RpdmVXaW5kb3dQcm9tcHRUb1NhdmUpICE9PSB0cnVlO1xuXHRcdFx0XHRcdGNvbnN0IHJlZiA9IGF3YWl0IHRoaXMubm90ZWJvb2tFZGl0b3JNb2RlbFJlc29sdmVyU2VydmljZS5yZXNvbHZlKHsgdW50aXRsZWRSZXNvdXJjZTogcmVzb3VyY2UgfSwgJ2p1cHl0ZXItbm90ZWJvb2snLCB7IHNjcmF0Y2hwYWQsIHZpZXdUeXBlOiAncmVwbCcgfSk7XG5cblx0XHRcdFx0XHRjb25zdCBub3RlYm9va1VyaSA9IHJlZi5vYmplY3Qubm90ZWJvb2sudXJpO1xuXG5cdFx0XHRcdFx0Ly8gdW50aXRsZWQgbm90ZWJvb2tzIGFyZSBkaXNwb3NlZCB3aGVuIHRoZXkgZ2V0IHNhdmVkLiB3ZSBzaG91bGQgbm90IGhvbGQgYSByZWZlcmVuY2Vcblx0XHRcdFx0XHQvLyB0byBzdWNoIGEgZGlzcG9zZWQgbm90ZWJvb2sgYW5kIHRoZXJlZm9yZSBkaXNwb3NlIHRoZSByZWZlcmVuY2UgYXMgd2VsbFxuXHRcdFx0XHRcdHJlZi5vYmplY3Qubm90ZWJvb2sub25XaWxsRGlzcG9zZSgoKSA9PiB7XG5cdFx0XHRcdFx0XHRyZWYuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGNvbnN0IGxhYmVsID0gKG9wdGlvbnMgYXMgSU5vdGVib29rRWRpdG9yT3B0aW9ucyk/LmxhYmVsID8/IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlcGxFZGl0b3JJbnB1dCwgbm90ZWJvb2tVcmksIGxhYmVsKTtcblx0XHRcdFx0XHR0aGlzLmVkaXRvcklucHV0Q2FjaGUuc2V0KG5vdGVib29rVXJpLCBlZGl0b3IpO1xuXHRcdFx0XHRcdEV2ZW50Lm9uY2UoZWRpdG9yLm9uV2lsbERpc3Bvc2UpKCgpID0+IHRoaXMuZWRpdG9ySW5wdXRDYWNoZS5kZWxldGUobm90ZWJvb2tVcmkpKTtcblxuXHRcdFx0XHRcdHJldHVybiB7IGVkaXRvciwgb3B0aW9ucyB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRjcmVhdGVFZGl0b3JJbnB1dDogYXN5bmMgKHsgcmVzb3VyY2UsIG9wdGlvbnMgfSkgPT4ge1xuXHRcdFx0XHRcdGlmICh0aGlzLmVkaXRvcklucHV0Q2FjaGUuaGFzKHJlc291cmNlKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHsgZWRpdG9yOiB0aGlzLmVkaXRvcklucHV0Q2FjaGUuZ2V0KHJlc291cmNlKSEsIG9wdGlvbnMgfTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBsYWJlbCA9IChvcHRpb25zIGFzIElOb3RlYm9va0VkaXRvck9wdGlvbnMpPy5sYWJlbCA/PyB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0Y29uc3QgZWRpdG9yID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXBsRWRpdG9ySW5wdXQsIHJlc291cmNlLCBsYWJlbCk7XG5cdFx0XHRcdFx0dGhpcy5lZGl0b3JJbnB1dENhY2hlLnNldChyZXNvdXJjZSwgZWRpdG9yKTtcblx0XHRcdFx0XHRFdmVudC5vbmNlKGVkaXRvci5vbldpbGxEaXNwb3NlKSgoKSA9PiB0aGlzLmVkaXRvcklucHV0Q2FjaGUuZGVsZXRlKHJlc291cmNlKSk7XG5cblx0XHRcdFx0XHRyZXR1cm4geyBlZGl0b3IsIG9wdGlvbnMgfTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cbn1cblxuY2xhc3MgUmVwbFdpbmRvd1dvcmtpbmdDb3B5RWRpdG9ySGFuZGxlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uLCBJV29ya2luZ0NvcHlFZGl0b3JIYW5kbGVyIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIucmVwbFdvcmtpbmdDb3B5RWRpdG9ySGFuZGxlcic7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3JraW5nQ29weUVkaXRvclNlcnZpY2U6IElXb3JraW5nQ29weUVkaXRvclNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElOb3RlYm9va1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RlYm9va1NlcnZpY2U6IElOb3RlYm9va1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX2luc3RhbGxIYW5kbGVyKCk7XG5cdH1cblxuXHRhc3luYyBoYW5kbGVzKHdvcmtpbmdDb3B5OiBJV29ya2luZ0NvcHlJZGVudGlmaWVyKSB7XG5cdFx0Y29uc3Qgbm90ZWJvb2tUeXBlID0gdGhpcy5fZ2V0Tm90ZWJvb2tUeXBlKHdvcmtpbmdDb3B5KTtcblx0XHRpZiAoIW5vdGVib29rVHlwZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiAhIW5vdGVib29rVHlwZSAmJiBub3RlYm9va1R5cGUudmlld1R5cGUgPT09ICdyZXBsJyAmJiBhd2FpdCB0aGlzLm5vdGVib29rU2VydmljZS5jYW5SZXNvbHZlKG5vdGVib29rVHlwZS5ub3RlYm9va1R5cGUpO1xuXHR9XG5cblx0aXNPcGVuKHdvcmtpbmdDb3B5OiBJV29ya2luZ0NvcHlJZGVudGlmaWVyLCBlZGl0b3I6IEVkaXRvcklucHV0KTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLmhhbmRsZXMod29ya2luZ0NvcHkpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVkaXRvciBpbnN0YW5jZW9mIFJlcGxFZGl0b3JJbnB1dCAmJiBpc0VxdWFsKHdvcmtpbmdDb3B5LnJlc291cmNlLCBlZGl0b3IucmVzb3VyY2UpO1xuXHR9XG5cblx0Y3JlYXRlRWRpdG9yKHdvcmtpbmdDb3B5OiBJV29ya2luZ0NvcHlJZGVudGlmaWVyKTogRWRpdG9ySW5wdXQge1xuXHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlcGxFZGl0b3JJbnB1dCwgd29ya2luZ0NvcHkucmVzb3VyY2UsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9pbnN0YWxsSGFuZGxlcigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvblNlcnZpY2Uud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtpbmdDb3B5RWRpdG9yU2VydmljZS5yZWdpc3RlckhhbmRsZXIodGhpcykpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Tm90ZWJvb2tUeXBlKHdvcmtpbmdDb3B5OiBJV29ya2luZ0NvcHlJZGVudGlmaWVyKSB7XG5cdFx0cmV0dXJuIE5vdGVib29rV29ya2luZ0NvcHlUeXBlSWRlbnRpZmllci5wYXJzZSh3b3JraW5nQ29weS50eXBlSWQpO1xuXHR9XG59XG5cbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihSZXBsV2luZG93V29ya2luZ0NvcHlFZGl0b3JIYW5kbGVyLklELCBSZXBsV2luZG93V29ya2luZ0NvcHlFZGl0b3JIYW5kbGVyLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1Jlc3RvcmUpO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKFJlcGxEb2N1bWVudENvbnRyaWJ1dGlvbi5JRCwgUmVwbERvY3VtZW50Q29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1Jlc3RvcmUpO1xuXG5BY2Nlc3NpYmxlVmlld1JlZ2lzdHJ5LnJlZ2lzdGVyKG5ldyBSZXBsRWRpdG9ySW5wdXRBY2Nlc3NpYmlsaXR5SGVscCgpKTtcbkFjY2Vzc2libGVWaWV3UmVnaXN0cnkucmVnaXN0ZXIobmV3IFJlcGxFZGl0b3JIaXN0b3J5QWNjZXNzaWJpbGl0eUhlbHAoKSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3JlcGwuZm9jdXNMYXN0SXRlbUV4ZWN1dGVkJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3JlcGwuZm9jdXNMYXN0UmVwbE91dHB1dCcsICdGb2N1cyBNb3N0IFJlY2VudCBSRVBMIEV4ZWN1dGlvbicpLFxuXHRcdFx0Y2F0ZWdvcnk6ICdSRVBMJyxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogTU9TVF9SRUNFTlRfUkVQTF9FRElUT1IsXG5cdFx0XHR9LFxuXHRcdFx0a2V5YmluZGluZzogW3tcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkFsdCB8IEtleUNvZGUuRW5kLCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5FbmQpLFxuXHRcdFx0XHR3ZWlnaHQ6IE5PVEVCT09LX0VESVRPUl9XSURHRVRfQUNUSU9OX1dFSUdIVCxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoSVNfQ09NUE9TSVRFX05PVEVCT09LLCBOT1RFQk9PS19DRUxMX0xJU1RfRk9DVVNFRC5uZWdhdGUoKSlcblx0XHRcdH1dLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBNT1NUX1JFQ0VOVF9SRVBMX0VESVRPUlxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0PzogVXJpQ29tcG9uZW50cyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvckNvbnRyb2wgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmU/LmdldENvbnRyb2woKTtcblx0XHRjb25zdCBjb250ZXh0S2V5U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0bGV0IG5vdGVib29rRWRpdG9yOiBOb3RlYm9va0VkaXRvcldpZGdldCB8IHVuZGVmaW5lZDtcblx0XHRpZiAoZWRpdG9yQ29udHJvbCAmJiBpc1JlcGxFZGl0b3JDb250cm9sKGVkaXRvckNvbnRyb2wpKSB7XG5cdFx0XHRub3RlYm9va0VkaXRvciA9IGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3I7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHVyaVN0cmluZyA9IE1PU1RfUkVDRU5UX1JFUExfRURJVE9SLmdldFZhbHVlKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHVyaSA9IHVyaVN0cmluZyA/IFVSSS5wYXJzZSh1cmlTdHJpbmcpIDogdW5kZWZpbmVkO1xuXG5cdFx0XHRpZiAoIXVyaSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZXBsRWRpdG9yID0gZWRpdG9yU2VydmljZS5maW5kRWRpdG9ycyh1cmkpWzBdO1xuXG5cdFx0XHRpZiAocmVwbEVkaXRvcikge1xuXHRcdFx0XHRjb25zdCBlZGl0b3IgPSBhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IocmVwbEVkaXRvci5lZGl0b3IsIHJlcGxFZGl0b3IuZ3JvdXBJZCk7XG5cdFx0XHRcdGNvbnN0IGVkaXRvckNvbnRyb2wgPSBlZGl0b3I/LmdldENvbnRyb2woKTtcblxuXHRcdFx0XHRpZiAoZWRpdG9yQ29udHJvbCAmJiBpc1JlcGxFZGl0b3JDb250cm9sKGVkaXRvckNvbnRyb2wpKSB7XG5cdFx0XHRcdFx0bm90ZWJvb2tFZGl0b3IgPSBlZGl0b3JDb250cm9sLm5vdGVib29rRWRpdG9yO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3Qgdmlld01vZGVsID0gbm90ZWJvb2tFZGl0b3I/LmdldFZpZXdNb2RlbCgpO1xuXHRcdGlmIChub3RlYm9va0VkaXRvciAmJiB2aWV3TW9kZWwpIHtcblx0XHRcdC8vIGxhc3QgY2VsbCBvZiB0aGUgdmlld21vZGVsIGlzIHRoZSBsYXN0IGNlbGwgaGlzdG9yeVxuXHRcdFx0Y29uc3QgbGFzdENlbGxJbmRleCA9IHZpZXdNb2RlbC5sZW5ndGggLSAxO1xuXHRcdFx0aWYgKGxhc3RDZWxsSW5kZXggPj0gMCkge1xuXHRcdFx0XHRjb25zdCBjZWxsID0gdmlld01vZGVsLnZpZXdDZWxsc1tsYXN0Q2VsbEluZGV4XTtcblx0XHRcdFx0bm90ZWJvb2tFZGl0b3IuZm9jdXNOb3RlYm9va0NlbGwoY2VsbCwgJ2NvbnRhaW5lcicpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3JlcGwuaW5wdXQuZm9jdXMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigncmVwbC5pbnB1dC5mb2N1cycsICdGb2N1cyBJbnB1dCBFZGl0b3InKSxcblx0XHRcdGNhdGVnb3J5OiAnUkVQTCcsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IE1PU1RfUkVDRU5UX1JFUExfRURJVE9SLFxuXHRcdFx0fSxcblx0XHRcdGtleWJpbmRpbmc6IFt7XG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChJU19DT01QT1NJVEVfTk9URUJPT0ssIE5PVEVCT09LX0VESVRPUl9GT0NVU0VEKSxcblx0XHRcdFx0d2VpZ2h0OiBOT1RFQk9PS19FRElUT1JfV0lER0VUX0FDVElPTl9XRUlHSFQsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Eb3duQXJyb3dcblx0XHRcdH0sIHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKE1PU1RfUkVDRU5UX1JFUExfRURJVE9SKSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyA1LFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQWx0IHwgS2V5Q29kZS5Ib21lLCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5Ib21lKSxcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JDb250cm9sID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lPy5nZXRDb250cm9sKCk7XG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdGlmIChlZGl0b3JDb250cm9sICYmIGlzUmVwbEVkaXRvckNvbnRyb2woZWRpdG9yQ29udHJvbCkgJiYgZWRpdG9yQ29udHJvbC5ub3RlYm9va0VkaXRvcikge1xuXHRcdFx0ZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lPy5mb2N1cygpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGNvbnN0IHVyaVN0cmluZyA9IE1PU1RfUkVDRU5UX1JFUExfRURJVE9SLmdldFZhbHVlKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHVyaSA9IHVyaVN0cmluZyA/IFVSSS5wYXJzZSh1cmlTdHJpbmcpIDogdW5kZWZpbmVkO1xuXG5cdFx0XHRpZiAoIXVyaSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZXBsRWRpdG9yID0gZWRpdG9yU2VydmljZS5maW5kRWRpdG9ycyh1cmkpWzBdO1xuXG5cdFx0XHRpZiAocmVwbEVkaXRvcikge1xuXHRcdFx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZTogdXJpLCBvcHRpb25zOiB7IHByZXNlcnZlRm9jdXM6IGZhbHNlIH0gfSwgcmVwbEVkaXRvci5ncm91cElkKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdyZXBsLmV4ZWN1dGUnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigncmVwbC5leGVjdXRlJywgJ0V4ZWN1dGUgUkVQTCBpbnB1dCcpLFxuXHRcdFx0Y2F0ZWdvcnk6ICdSRVBMJyxcblx0XHRcdGtleWJpbmRpbmc6IFt7XG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRJU19DT01QT1NJVEVfTk9URUJPT0ssXG5cdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCdhY3RpdmVFZGl0b3InLCAnd29ya2JlbmNoLmVkaXRvci5yZXBsJyksXG5cdFx0XHRcdFx0Tk9URUJPT0tfQ0VMTF9MSVNUX0ZPQ1VTRUQubmVnYXRlKClcblx0XHRcdFx0KSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkVudGVyLFxuXHRcdFx0XHR3ZWlnaHQ6IE5PVEVCT09LX0VESVRPUl9XSURHRVRfQUNUSU9OX1dFSUdIVFxuXHRcdFx0fSwge1xuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0SVNfQ09NUE9TSVRFX05PVEVCT09LLFxuXHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscygnYWN0aXZlRWRpdG9yJywgJ3dvcmtiZW5jaC5lZGl0b3IucmVwbCcpLFxuXHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLmludGVyYWN0aXZlV2luZG93LmV4ZWN1dGVXaXRoU2hpZnRFbnRlcicsIHRydWUpLFxuXHRcdFx0XHRcdE5PVEVCT09LX0NFTExfTElTVF9GT0NVU0VELm5lZ2F0ZSgpXG5cdFx0XHRcdCksXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRcdHdlaWdodDogTk9URUJPT0tfRURJVE9SX1dJREdFVF9BQ1RJT05fV0VJR0hUXG5cdFx0XHR9LCB7XG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRJU19DT01QT1NJVEVfTk9URUJPT0ssXG5cdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCdhY3RpdmVFZGl0b3InLCAnd29ya2JlbmNoLmVkaXRvci5yZXBsJyksXG5cdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcuaW50ZXJhY3RpdmVXaW5kb3cuZXhlY3V0ZVdpdGhTaGlmdEVudGVyJywgZmFsc2UpLFxuXHRcdFx0XHRcdE5PVEVCT09LX0NFTExfTElTVF9GT0NVU0VELm5lZ2F0ZSgpXG5cdFx0XHRcdCksXG5cdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRcdHdlaWdodDogTk9URUJPT0tfRURJVE9SX1dJREdFVF9BQ1RJT05fV0VJR0hUXG5cdFx0XHR9XSxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuUmVwbElucHV0RXhlY3V0ZVxuXHRcdFx0XHR9XG5cdFx0XHRdLFxuXHRcdFx0aWNvbjogaWNvbnMuZXhlY3V0ZUljb24sXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogJ0V4ZWN1dGUgdGhlIENvbnRlbnRzIG9mIHRoZSBJbnB1dCBCb3gnLFxuXHRcdFx0XHRhcmdzOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmFtZTogJ3Jlc291cmNlJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAnSW50ZXJhY3RpdmUgcmVzb3VyY2UgVXJpJyxcblx0XHRcdFx0XHRcdGlzT3B0aW9uYWw6IHRydWVcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dD86IFVyaUNvbXBvbmVudHMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBidWxrRWRpdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUJ1bGtFZGl0U2VydmljZSk7XG5cdFx0Y29uc3QgaGlzdG9yeVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUludGVyYWN0aXZlSGlzdG9yeVNlcnZpY2UpO1xuXHRcdGNvbnN0IG5vdGVib29rRWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90ZWJvb2tFZGl0b3JTZXJ2aWNlKTtcblx0XHRsZXQgZWRpdG9yQ29udHJvbDogSUVkaXRvckNvbnRyb2wgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKGNvbnRleHQpIHtcblx0XHRcdGNvbnN0IHJlc291cmNlVXJpID0gVVJJLnJldml2ZShjb250ZXh0KTtcblx0XHRcdGNvbnN0IGVkaXRvcnMgPSBlZGl0b3JTZXJ2aWNlLmZpbmRFZGl0b3JzKHJlc291cmNlVXJpKTtcblx0XHRcdGZvciAoY29uc3QgZm91bmQgb2YgZWRpdG9ycykge1xuXHRcdFx0XHRpZiAoZm91bmQuZWRpdG9yLnR5cGVJZCA9PT0gUmVwbEVkaXRvcklucHV0LklEKSB7XG5cdFx0XHRcdFx0Y29uc3QgZWRpdG9yID0gYXdhaXQgZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKGZvdW5kLmVkaXRvciwgZm91bmQuZ3JvdXBJZCk7XG5cdFx0XHRcdFx0ZWRpdG9yQ29udHJvbCA9IGVkaXRvcj8uZ2V0Q29udHJvbCgpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0ZWRpdG9yQ29udHJvbCA9IGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZT8uZ2V0Q29udHJvbCgpIGFzIHsgbm90ZWJvb2tFZGl0b3I6IE5vdGVib29rRWRpdG9yV2lkZ2V0IHwgdW5kZWZpbmVkOyBjb2RlRWRpdG9yOiBDb2RlRWRpdG9yV2lkZ2V0IH0gfCB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKGlzUmVwbEVkaXRvckNvbnRyb2woZWRpdG9yQ29udHJvbCkpIHtcblx0XHRcdGV4ZWN1dGVSZXBsSW5wdXQoYnVsa0VkaXRTZXJ2aWNlLCBoaXN0b3J5U2VydmljZSwgbm90ZWJvb2tFZGl0b3JTZXJ2aWNlLCBlZGl0b3JDb250cm9sKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5hc3luYyBmdW5jdGlvbiBleGVjdXRlUmVwbElucHV0KFxuXHRidWxrRWRpdFNlcnZpY2U6IElCdWxrRWRpdFNlcnZpY2UsXG5cdGhpc3RvcnlTZXJ2aWNlOiBJSW50ZXJhY3RpdmVIaXN0b3J5U2VydmljZSxcblx0bm90ZWJvb2tFZGl0b3JTZXJ2aWNlOiBJTm90ZWJvb2tFZGl0b3JTZXJ2aWNlLFxuXHRlZGl0b3JDb250cm9sOiBSZXBsRWRpdG9yQ29udHJvbCkge1xuXG5cdGlmIChlZGl0b3JDb250cm9sICYmIGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3IgJiYgZWRpdG9yQ29udHJvbC5hY3RpdmVDb2RlRWRpdG9yKSB7XG5cdFx0Y29uc3Qgbm90ZWJvb2tEb2N1bWVudCA9IGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsO1xuXHRcdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvckNvbnRyb2wuYWN0aXZlQ29kZUVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IGFjdGl2ZUtlcm5lbCA9IGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3IuYWN0aXZlS2VybmVsO1xuXHRcdGNvbnN0IGxhbmd1YWdlID0gYWN0aXZlS2VybmVsPy5zdXBwb3J0ZWRMYW5ndWFnZXNbMF0gPz8gUExBSU5URVhUX0xBTkdVQUdFX0lEO1xuXG5cdFx0aWYgKG5vdGVib29rRG9jdW1lbnQgJiYgdGV4dE1vZGVsKSB7XG5cdFx0XHRjb25zdCBpbmRleCA9IG5vdGVib29rRG9jdW1lbnQubGVuZ3RoIC0gMTtcblx0XHRcdGNvbnN0IHZhbHVlID0gdGV4dE1vZGVsLmdldFZhbHVlKCk7XG5cblx0XHRcdGlmIChpc0ZhbHN5T3JXaGl0ZXNwYWNlKHZhbHVlKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIEp1c3QgYWNjZXB0IGFueSBleGlzdGluZyBpbmxpbmUgY2hhdCBodW5rXG5cdFx0XHRjb25zdCBjdHJsID0gSW5saW5lQ2hhdENvbnRyb2xsZXIuZ2V0KGVkaXRvckNvbnRyb2wuYWN0aXZlQ29kZUVkaXRvcik7XG5cdFx0XHRpZiAoY3RybCkge1xuXHRcdFx0XHRjdHJsLmFjY2VwdFNlc3Npb24oKTtcblx0XHRcdH1cblxuXHRcdFx0aGlzdG9yeVNlcnZpY2UucmVwbGFjZUxhc3Qobm90ZWJvb2tEb2N1bWVudC51cmksIHZhbHVlKTtcblx0XHRcdGhpc3RvcnlTZXJ2aWNlLmFkZFRvSGlzdG9yeShub3RlYm9va0RvY3VtZW50LnVyaSwgJycpO1xuXHRcdFx0dGV4dE1vZGVsLnNldFZhbHVlKCcnKTtcblx0XHRcdG5vdGVib29rRG9jdW1lbnQuY2VsbHNbaW5kZXhdLnJlc2V0VGV4dEJ1ZmZlcih0ZXh0TW9kZWwuZ2V0VGV4dEJ1ZmZlcigpKTtcblxuXHRcdFx0Y29uc3QgY29sbGFwc2VTdGF0ZSA9IGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3Iubm90ZWJvb2tPcHRpb25zLmdldERpc3BsYXlPcHRpb25zKCkuaW50ZXJhY3RpdmVXaW5kb3dDb2xsYXBzZUNvZGVDZWxscyA9PT0gJ2Zyb21FZGl0b3InID9cblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlucHV0Q29sbGFwc2VkOiBmYWxzZSxcblx0XHRcdFx0XHRvdXRwdXRDb2xsYXBzZWQ6IGZhbHNlXG5cdFx0XHRcdH0gOlxuXHRcdFx0XHR1bmRlZmluZWQ7XG5cblx0XHRcdGF3YWl0IGJ1bGtFZGl0U2VydmljZS5hcHBseShbXG5cdFx0XHRcdG5ldyBSZXNvdXJjZU5vdGVib29rQ2VsbEVkaXQobm90ZWJvb2tEb2N1bWVudC51cmksXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5SZXBsYWNlLFxuXHRcdFx0XHRcdFx0aW5kZXg6IGluZGV4LFxuXHRcdFx0XHRcdFx0Y291bnQ6IDAsXG5cdFx0XHRcdFx0XHRjZWxsczogW3tcblx0XHRcdFx0XHRcdFx0Y2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsXG5cdFx0XHRcdFx0XHRcdG1pbWU6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0bGFuZ3VhZ2UsXG5cdFx0XHRcdFx0XHRcdHNvdXJjZTogdmFsdWUsXG5cdFx0XHRcdFx0XHRcdG91dHB1dHM6IFtdLFxuXHRcdFx0XHRcdFx0XHRtZXRhZGF0YToge30sXG5cdFx0XHRcdFx0XHRcdGNvbGxhcHNlU3RhdGVcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHQpXG5cdFx0XHRdKTtcblxuXHRcdFx0Ly8gcmV2ZWFsIHRoZSBjZWxsIGludG8gdmlldyBmaXJzdFxuXHRcdFx0Y29uc3QgcmFuZ2UgPSB7IHN0YXJ0OiBpbmRleCwgZW5kOiBpbmRleCArIDEgfTtcblx0XHRcdGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3IucmV2ZWFsQ2VsbFJhbmdlSW5WaWV3KHJhbmdlKTtcblx0XHRcdGF3YWl0IGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3IuZXhlY3V0ZU5vdGVib29rQ2VsbHMoZWRpdG9yQ29udHJvbC5ub3RlYm9va0VkaXRvci5nZXRDZWxsc0luUmFuZ2UoeyBzdGFydDogaW5kZXgsIGVuZDogaW5kZXggKyAxIH0pKTtcblxuXHRcdFx0Ly8gdXBkYXRlIHRoZSBzZWxlY3Rpb24gYW5kIGZvY3VzIGluIHRoZSBleHRlbnNpb24gaG9zdCBtb2RlbFxuXHRcdFx0Y29uc3QgZWRpdG9yID0gbm90ZWJvb2tFZGl0b3JTZXJ2aWNlLmdldE5vdGVib29rRWRpdG9yKGVkaXRvckNvbnRyb2wubm90ZWJvb2tFZGl0b3IuZ2V0SWQoKSk7XG5cdFx0XHRpZiAoZWRpdG9yKSB7XG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtyYW5nZV0pO1xuXHRcdFx0XHRlZGl0b3Iuc2V0Rm9jdXMocmFuZ2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5BY2Nlc3NpYmxlVmlld1JlZ2lzdHJ5LnJlZ2lzdGVyKG5ldyBSZXBsRWRpdG9yQWNjZXNzaWJsZVZpZXcoKSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ2xpc3QuZmluZC5yZXBsSW5wdXRGb2N1cycsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgMSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgUkVQTF9WSUVXX0lEKSxcblx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5LZXlGLFxuXHRzZWNvbmRhcnk6IFtLZXlDb2RlLkYzXSxcblx0aGFuZGxlcjogKGFjY2Vzc29yKSA9PiB7XG5cdFx0Z2V0UmVwbFZpZXcoYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpKT8ub3BlbkZpbmQoKTtcblx0fVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsYUFBYTtBQUN0QixTQUFTLFVBQVUsU0FBUyxjQUFjO0FBQzFDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGVBQWU7QUFDeEIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxXQUEwQjtBQUNuQyxTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFDakQsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxnQkFBZ0IsMEJBQTBCO0FBQ25ELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsNkJBQStDO0FBQ3hELFNBQVMscUJBQXFCLHdCQUF3QjtBQUN0RCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDRCQUFpRDtBQUMxRCxTQUFpQyxnQ0FBZ0Msc0JBQXNCO0FBQ3ZGLFNBQVMsd0JBQW1GO0FBRTVGLFNBQVMsd0JBQXdCLGdDQUFnQztBQUNqRSxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQjtBQUU5QixTQUFvQyxpQ0FBaUM7QUFDckUsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyw0Q0FBNEM7QUFHckQsWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsY0FBYyxVQUFVLGlCQUFpQixtQ0FBbUMsc0JBQXNCO0FBQzNHLFNBQVMsdUJBQXVCLHlC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QixjQUFjLGVBQWUsTUFBTSxDQUFDO0FBQzNGLFVBQUksUUFBUTtBQUNYLGVBQU8sY0FBYyxDQUFDLEtBQUssQ0FBQztBQUM1QixlQUFPLFNBQVMsS0FBSztBQUFBLE1BQ3RCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQUVBLHVCQUF1QixTQUFTLElBQUkseUJBQXlCLENBQUM7QUFFOUQsb0JBQW9CLGlDQUFpQztBQUFBLEVBQ3BELElBQUk7QUFBQSxFQUNKLFFBQVEsaUJBQWlCLG1CQUFtQjtBQUFBLEVBQzVDLE1BQU0sZUFBZSxPQUFPLFFBQVEsWUFBWTtBQUFBLEVBQ2hELFNBQVMsT0FBTyxVQUFVLE9BQU8sTUFBTSxRQUFRO0FBQUEsRUFDL0MsV0FBVyxDQUFDLFFBQVEsRUFBRTtBQUFBLEVBQ3RCLFNBQVMsQ0FBQyxhQUFhO0FBQ3RCLGdCQUFZLFNBQVMsSUFBSSxhQUFhLENBQUMsR0FBRyxTQUFTO0FBQUEsRUFDcEQ7QUFDRCxDQUFDOyIsCiAgIm5hbWVzIjogWyJlZGl0b3IiLCAiZWRpdG9yQ29udHJvbCJdCn0K
