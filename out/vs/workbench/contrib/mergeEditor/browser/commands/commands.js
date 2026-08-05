import { Codicon } from "../../../../../base/common/codicons.js";
import { basename } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IStorageService, StorageScope } from "../../../../../platform/storage/common/storage.js";
import { MergeEditorInputData } from "../mergeEditorInput.js";
import { MergeEditor } from "../view/mergeEditor.js";
import { ctxIsMergeEditor, ctxMergeEditorLayout, ctxMergeEditorShowBase, ctxMergeEditorShowBaseAtTop, ctxMergeEditorShowNonConflictingChanges, StorageCloseWithConflicts } from "../../common/mergeEditor.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
class MergeEditorAction extends Action2 {
  constructor(desc) {
    super(desc);
  }
  run(accessor) {
    const { activeEditorPane } = accessor.get(IEditorService);
    if (activeEditorPane instanceof MergeEditor) {
      const vm = activeEditorPane.viewModel.get();
      if (!vm) {
        return;
      }
      this.runWithViewModel(vm, accessor);
    }
  }
}
class MergeEditorAction2 extends Action2 {
  constructor(desc) {
    super(desc);
  }
  run(accessor, ...args) {
    const { activeEditorPane } = accessor.get(IEditorService);
    if (activeEditorPane instanceof MergeEditor) {
      const vm = activeEditorPane.viewModel.get();
      if (!vm) {
        return;
      }
      return this.runWithMergeEditor({
        viewModel: vm,
        inputModel: activeEditorPane.inputModel.get(),
        input: activeEditorPane.input,
        editorIdentifier: {
          editor: activeEditorPane.input,
          groupId: activeEditorPane.group.id
        }
      }, accessor, ...args);
    }
  }
}
class OpenMergeEditor extends Action2 {
  constructor() {
    super({
      id: "_open.mergeEditor",
      title: localize2("title", "Open Merge Editor")
    });
  }
  run(accessor, ...args) {
    const validatedArgs = IRelaxedOpenArgs.validate(args[0]);
    const input = {
      base: { resource: validatedArgs.base },
      input1: { resource: validatedArgs.input1.uri, label: validatedArgs.input1.title, description: validatedArgs.input1.description, detail: validatedArgs.input1.detail },
      input2: { resource: validatedArgs.input2.uri, label: validatedArgs.input2.title, description: validatedArgs.input2.description, detail: validatedArgs.input2.detail },
      result: { resource: validatedArgs.output },
      options: { preserveFocus: true }
    };
    accessor.get(IEditorService).openEditor(input);
  }
}
var IRelaxedOpenArgs;
((IRelaxedOpenArgs2) => {
  function validate(obj) {
    if (!obj || typeof obj !== "object") {
      throw new TypeError("invalid argument");
    }
    const o = obj;
    const base = toUri(o.base);
    const output = toUri(o.output);
    const input1 = toInputData(o.input1);
    const input2 = toInputData(o.input2);
    return { base, input1, input2, output };
  }
  IRelaxedOpenArgs2.validate = validate;
  function toInputData(obj) {
    if (typeof obj === "string") {
      return new MergeEditorInputData(URI.parse(obj, true), void 0, void 0, void 0);
    }
    if (!obj || typeof obj !== "object") {
      throw new TypeError("invalid argument");
    }
    if (isUriComponents(obj)) {
      return new MergeEditorInputData(URI.revive(obj), void 0, void 0, void 0);
    }
    const o = obj;
    const title = o.title;
    const uri = toUri(o.uri);
    const detail = o.detail;
    const description = o.description;
    return new MergeEditorInputData(uri, title, detail, description);
  }
  function toUri(obj) {
    if (typeof obj === "string") {
      return URI.parse(obj, true);
    } else if (obj && typeof obj === "object") {
      return URI.revive(obj);
    }
    throw new TypeError("invalid argument");
  }
  function isUriComponents(obj) {
    if (!obj || typeof obj !== "object") {
      return false;
    }
    const o = obj;
    return typeof o.scheme === "string" && typeof o.authority === "string" && typeof o.path === "string" && typeof o.query === "string" && typeof o.fragment === "string";
  }
})(IRelaxedOpenArgs || (IRelaxedOpenArgs = {}));
class SetMixedLayout extends Action2 {
  constructor() {
    super({
      id: "merge.mixedLayout",
      title: localize2("layout.mixed", "Mixed Layout"),
      toggled: ctxMergeEditorLayout.isEqualTo("mixed"),
      menu: [
        {
          id: MenuId.EditorTitle,
          when: ctxIsMergeEditor,
          group: "1_merge",
          order: 9
        }
      ],
      precondition: ctxIsMergeEditor
    });
  }
  run(accessor) {
    const { activeEditorPane } = accessor.get(IEditorService);
    if (activeEditorPane instanceof MergeEditor) {
      activeEditorPane.setLayoutKind("mixed");
    }
  }
}
class SetColumnLayout extends Action2 {
  constructor() {
    super({
      id: "merge.columnLayout",
      title: localize2("layout.column", "Column Layout"),
      toggled: ctxMergeEditorLayout.isEqualTo("columns"),
      menu: [{
        id: MenuId.EditorTitle,
        when: ctxIsMergeEditor,
        group: "1_merge",
        order: 10
      }],
      precondition: ctxIsMergeEditor
    });
  }
  run(accessor) {
    const { activeEditorPane } = accessor.get(IEditorService);
    if (activeEditorPane instanceof MergeEditor) {
      activeEditorPane.setLayoutKind("columns");
    }
  }
}
class ShowNonConflictingChanges extends Action2 {
  constructor() {
    super({
      id: "merge.showNonConflictingChanges",
      title: localize2("showNonConflictingChanges", "Show Non-Conflicting Changes"),
      toggled: ctxMergeEditorShowNonConflictingChanges.isEqualTo(true),
      menu: [
        {
          id: MenuId.EditorTitle,
          when: ctxIsMergeEditor,
          group: "3_merge",
          order: 9
        }
      ],
      precondition: ctxIsMergeEditor
    });
  }
  run(accessor) {
    const { activeEditorPane } = accessor.get(IEditorService);
    if (activeEditorPane instanceof MergeEditor) {
      activeEditorPane.toggleShowNonConflictingChanges();
    }
  }
}
class ShowHideBase extends Action2 {
  constructor() {
    super({
      id: "merge.showBase",
      title: localize2("layout.showBase", "Show Base"),
      toggled: ctxMergeEditorShowBase.isEqualTo(true),
      menu: [
        {
          id: MenuId.EditorTitle,
          when: ContextKeyExpr.and(ctxIsMergeEditor, ctxMergeEditorLayout.isEqualTo("columns")),
          group: "2_merge",
          order: 9
        }
      ]
    });
  }
  run(accessor) {
    const { activeEditorPane } = accessor.get(IEditorService);
    if (activeEditorPane instanceof MergeEditor) {
      activeEditorPane.toggleBase();
    }
  }
}
class ShowHideTopBase extends Action2 {
  constructor() {
    super({
      id: "merge.showBaseTop",
      title: localize2("layout.showBaseTop", "Show Base Top"),
      toggled: ContextKeyExpr.and(ctxMergeEditorShowBase, ctxMergeEditorShowBaseAtTop),
      menu: [
        {
          id: MenuId.EditorTitle,
          when: ContextKeyExpr.and(ctxIsMergeEditor, ctxMergeEditorLayout.isEqualTo("mixed")),
          group: "2_merge",
          order: 10
        }
      ]
    });
  }
  run(accessor) {
    const { activeEditorPane } = accessor.get(IEditorService);
    if (activeEditorPane instanceof MergeEditor) {
      activeEditorPane.toggleShowBaseTop();
    }
  }
}
class ShowHideCenterBase extends Action2 {
  constructor() {
    super({
      id: "merge.showBaseCenter",
      title: localize2("layout.showBaseCenter", "Show Base Center"),
      toggled: ContextKeyExpr.and(ctxMergeEditorShowBase, ctxMergeEditorShowBaseAtTop.negate()),
      menu: [
        {
          id: MenuId.EditorTitle,
          when: ContextKeyExpr.and(ctxIsMergeEditor, ctxMergeEditorLayout.isEqualTo("mixed")),
          group: "2_merge",
          order: 11
        }
      ]
    });
  }
  run(accessor) {
    const { activeEditorPane } = accessor.get(IEditorService);
    if (activeEditorPane instanceof MergeEditor) {
      activeEditorPane.toggleShowBaseCenter();
    }
  }
}
const mergeEditorCategory = localize2("mergeEditor", "Merge Editor");
class OpenResultResource extends MergeEditorAction {
  constructor() {
    super({
      id: "merge.openResult",
      icon: Codicon.goToFile,
      title: localize2("openfile", "Open File"),
      category: mergeEditorCategory,
      menu: [{
        id: MenuId.EditorTitle,
        when: ctxIsMergeEditor,
        group: "navigation",
        order: 1
      }],
      precondition: ctxIsMergeEditor
    });
  }
  runWithViewModel(viewModel, accessor) {
    const editorService = accessor.get(IEditorService);
    editorService.openEditor({ resource: viewModel.model.resultTextModel.uri });
  }
}
class GoToNextUnhandledConflict extends MergeEditorAction {
  constructor() {
    super({
      id: "merge.goToNextUnhandledConflict",
      category: mergeEditorCategory,
      title: localize2("merge.goToNextUnhandledConflict", "Go to Next Unhandled Conflict"),
      icon: Codicon.arrowDown,
      menu: [
        {
          id: MenuId.EditorTitle,
          when: ctxIsMergeEditor,
          group: "navigation",
          order: 3
        }
      ],
      f1: true,
      precondition: ctxIsMergeEditor
    });
  }
  runWithViewModel(viewModel) {
    viewModel.model.telemetry.reportNavigationToNextConflict();
    viewModel.goToNextModifiedBaseRange((r) => !viewModel.model.isHandled(r).get());
  }
}
class GoToPreviousUnhandledConflict extends MergeEditorAction {
  constructor() {
    super({
      id: "merge.goToPreviousUnhandledConflict",
      category: mergeEditorCategory,
      title: localize2("merge.goToPreviousUnhandledConflict", "Go to Previous Unhandled Conflict"),
      icon: Codicon.arrowUp,
      menu: [
        {
          id: MenuId.EditorTitle,
          when: ctxIsMergeEditor,
          group: "navigation",
          order: 2
        }
      ],
      f1: true,
      precondition: ctxIsMergeEditor
    });
  }
  runWithViewModel(viewModel) {
    viewModel.model.telemetry.reportNavigationToPreviousConflict();
    viewModel.goToPreviousModifiedBaseRange((r) => !viewModel.model.isHandled(r).get());
  }
}
class ToggleActiveConflictInput1 extends MergeEditorAction {
  constructor() {
    super({
      id: "merge.toggleActiveConflictInput1",
      category: mergeEditorCategory,
      title: localize2("merge.toggleCurrentConflictFromLeft", "Toggle Current Conflict from Left"),
      f1: true,
      precondition: ctxIsMergeEditor
    });
  }
  runWithViewModel(viewModel) {
    viewModel.toggleActiveConflict(1);
  }
}
class ToggleActiveConflictInput2 extends MergeEditorAction {
  constructor() {
    super({
      id: "merge.toggleActiveConflictInput2",
      category: mergeEditorCategory,
      title: localize2("merge.toggleCurrentConflictFromRight", "Toggle Current Conflict from Right"),
      f1: true,
      precondition: ctxIsMergeEditor
    });
  }
  runWithViewModel(viewModel) {
    viewModel.toggleActiveConflict(2);
  }
}
class CompareInput1WithBaseCommand extends MergeEditorAction {
  constructor() {
    super({
      id: "mergeEditor.compareInput1WithBase",
      category: mergeEditorCategory,
      title: localize2("mergeEditor.compareInput1WithBase", "Compare Input 1 With Base"),
      shortTitle: localize("mergeEditor.compareWithBase", "Compare With Base"),
      f1: true,
      precondition: ctxIsMergeEditor,
      menu: { id: MenuId.MergeInput1Toolbar, group: "primary" },
      icon: Codicon.compareChanges
    });
  }
  runWithViewModel(viewModel, accessor) {
    const editorService = accessor.get(IEditorService);
    mergeEditorCompare(viewModel, editorService, 1);
  }
}
class CompareInput2WithBaseCommand extends MergeEditorAction {
  constructor() {
    super({
      id: "mergeEditor.compareInput2WithBase",
      category: mergeEditorCategory,
      title: localize2("mergeEditor.compareInput2WithBase", "Compare Input 2 With Base"),
      shortTitle: localize("mergeEditor.compareWithBase", "Compare With Base"),
      f1: true,
      precondition: ctxIsMergeEditor,
      menu: { id: MenuId.MergeInput2Toolbar, group: "primary" },
      icon: Codicon.compareChanges
    });
  }
  runWithViewModel(viewModel, accessor) {
    const editorService = accessor.get(IEditorService);
    mergeEditorCompare(viewModel, editorService, 2);
  }
}
async function mergeEditorCompare(viewModel, editorService, inputNumber) {
  editorService.openEditor(editorService.activeEditor, { pinned: true });
  const model = viewModel.model;
  const base = model.base;
  const input = inputNumber === 1 ? viewModel.inputCodeEditorView1.editor : viewModel.inputCodeEditorView2.editor;
  const lineNumber = input.getPosition().lineNumber;
  await editorService.openEditor({
    original: { resource: base.uri },
    modified: { resource: input.getModel().uri },
    options: {
      selection: {
        startLineNumber: lineNumber,
        startColumn: 1
      },
      revealIfOpened: true,
      revealIfVisible: true
    }
  });
}
class OpenBaseFile extends MergeEditorAction {
  constructor() {
    super({
      id: "merge.openBaseEditor",
      category: mergeEditorCategory,
      title: localize2("merge.openBaseEditor", "Open Base File"),
      f1: true,
      precondition: ctxIsMergeEditor
    });
  }
  runWithViewModel(viewModel, accessor) {
    const openerService = accessor.get(IOpenerService);
    openerService.open(viewModel.model.base.uri);
  }
}
class AcceptAllInput1 extends MergeEditorAction {
  constructor() {
    super({
      id: "merge.acceptAllInput1",
      category: mergeEditorCategory,
      title: localize2("merge.acceptAllInput1", "Accept All Changes from Left"),
      f1: true,
      precondition: ctxIsMergeEditor,
      menu: { id: MenuId.MergeInput1Toolbar, group: "primary" },
      icon: Codicon.checkAll
    });
  }
  runWithViewModel(viewModel) {
    viewModel.acceptAll(1);
  }
}
class AcceptAllInput2 extends MergeEditorAction {
  constructor() {
    super({
      id: "merge.acceptAllInput2",
      category: mergeEditorCategory,
      title: localize2("merge.acceptAllInput2", "Accept All Changes from Right"),
      f1: true,
      precondition: ctxIsMergeEditor,
      menu: { id: MenuId.MergeInput2Toolbar, group: "primary" },
      icon: Codicon.checkAll
    });
  }
  runWithViewModel(viewModel) {
    viewModel.acceptAll(2);
  }
}
class ResetToBaseAndAutoMergeCommand extends MergeEditorAction {
  constructor() {
    super({
      id: "mergeEditor.resetResultToBaseAndAutoMerge",
      category: mergeEditorCategory,
      title: localize2("mergeEditor.resetResultToBaseAndAutoMerge", "Reset Result"),
      shortTitle: localize("mergeEditor.resetResultToBaseAndAutoMerge.short", "Reset"),
      f1: true,
      precondition: ctxIsMergeEditor,
      menu: { id: MenuId.MergeInputResultToolbar, group: "primary" },
      icon: Codicon.discard
    });
  }
  runWithViewModel(viewModel, accessor) {
    viewModel.model.reset();
  }
}
class ResetCloseWithConflictsChoice extends Action2 {
  constructor() {
    super({
      id: "mergeEditor.resetCloseWithConflictsChoice",
      category: mergeEditorCategory,
      title: localize2("mergeEditor.resetChoice", "Reset Choice for 'Close with Conflicts'"),
      f1: true
    });
  }
  run(accessor) {
    accessor.get(IStorageService).remove(StorageCloseWithConflicts, StorageScope.PROFILE);
  }
}
class AcceptMerge extends MergeEditorAction2 {
  constructor() {
    super({
      id: "mergeEditor.acceptMerge",
      category: mergeEditorCategory,
      title: localize2("mergeEditor.acceptMerge", "Complete Merge"),
      f1: false,
      precondition: ctxIsMergeEditor
    });
  }
  async runWithMergeEditor({ inputModel, editorIdentifier, viewModel }, accessor) {
    const dialogService = accessor.get(IDialogService);
    const editorService = accessor.get(IEditorService);
    if (viewModel.model.unhandledConflictsCount.get() > 0) {
      const { confirmed } = await dialogService.confirm({
        message: localize("mergeEditor.acceptMerge.unhandledConflicts.message", "Do you want to complete the merge of {0}?", basename(inputModel.resultUri)),
        detail: localize("mergeEditor.acceptMerge.unhandledConflicts.detail", "The file contains unhandled conflicts."),
        primaryButton: localize({ key: "mergeEditor.acceptMerge.unhandledConflicts.accept", comment: ["&& denotes a mnemonic"] }, "&&Complete with Conflicts")
      });
      if (!confirmed) {
        return {
          successful: false
        };
      }
    }
    await inputModel.accept();
    await editorService.closeEditor(editorIdentifier);
    return {
      successful: true
    };
  }
}
export {
  AcceptAllInput1,
  AcceptAllInput2,
  AcceptMerge,
  CompareInput1WithBaseCommand,
  CompareInput2WithBaseCommand,
  GoToNextUnhandledConflict,
  GoToPreviousUnhandledConflict,
  OpenBaseFile,
  OpenMergeEditor,
  OpenResultResource,
  ResetCloseWithConflictsChoice,
  ResetToBaseAndAutoMergeCommand,
  SetColumnLayout,
  SetMixedLayout,
  ShowHideBase,
  ShowHideCenterBase,
  ShowHideTopBase,
  ShowNonConflictingChanges,
  ToggleActiveConflictInput1,
  ToggleActiveConflictInput2
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL2NvbW1hbmRzL2NvbW1hbmRzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSwgVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElMb2NhbGl6ZWRTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBJQWN0aW9uMk9wdGlvbnMsIE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJVGV4dEVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9ySWRlbnRpZmllciwgSVJlc291cmNlTWVyZ2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgTWVyZ2VFZGl0b3JJbnB1dCwgTWVyZ2VFZGl0b3JJbnB1dERhdGEgfSBmcm9tICcuLi9tZXJnZUVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElNZXJnZUVkaXRvcklucHV0TW9kZWwgfSBmcm9tICcuLi9tZXJnZUVkaXRvcklucHV0TW9kZWwuanMnO1xuaW1wb3J0IHsgTWVyZ2VFZGl0b3IgfSBmcm9tICcuLi92aWV3L21lcmdlRWRpdG9yLmpzJztcbmltcG9ydCB7IE1lcmdlRWRpdG9yVmlld01vZGVsIH0gZnJvbSAnLi4vdmlldy92aWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgY3R4SXNNZXJnZUVkaXRvciwgY3R4TWVyZ2VFZGl0b3JMYXlvdXQsIGN0eE1lcmdlRWRpdG9yU2hvd0Jhc2UsIGN0eE1lcmdlRWRpdG9yU2hvd0Jhc2VBdFRvcCwgY3R4TWVyZ2VFZGl0b3JTaG93Tm9uQ29uZmxpY3RpbmdDaGFuZ2VzLCBTdG9yYWdlQ2xvc2VXaXRoQ29uZmxpY3RzIH0gZnJvbSAnLi4vLi4vY29tbW9uL21lcmdlRWRpdG9yLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcblxuYWJzdHJhY3QgY2xhc3MgTWVyZ2VFZGl0b3JBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoZGVzYzogUmVhZG9ubHk8SUFjdGlvbjJPcHRpb25zPikge1xuXHRcdHN1cGVyKGRlc2MpO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBhY3RpdmVFZGl0b3JQYW5lIH0gPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGlmIChhY3RpdmVFZGl0b3JQYW5lIGluc3RhbmNlb2YgTWVyZ2VFZGl0b3IpIHtcblx0XHRcdGNvbnN0IHZtID0gYWN0aXZlRWRpdG9yUGFuZS52aWV3TW9kZWwuZ2V0KCk7XG5cdFx0XHRpZiAoIXZtKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMucnVuV2l0aFZpZXdNb2RlbCh2bSwgYWNjZXNzb3IpO1xuXHRcdH1cblx0fVxuXG5cdGFic3RyYWN0IHJ1bldpdGhWaWV3TW9kZWwodmlld01vZGVsOiBNZXJnZUVkaXRvclZpZXdNb2RlbCwgYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkO1xufVxuXG5pbnRlcmZhY2UgTWVyZ2VFZGl0b3JBY3Rpb24yQXJncyB7XG5cdGlucHV0TW9kZWw6IElNZXJnZUVkaXRvcklucHV0TW9kZWw7XG5cdHZpZXdNb2RlbDogTWVyZ2VFZGl0b3JWaWV3TW9kZWw7XG5cdGlucHV0OiBNZXJnZUVkaXRvcklucHV0O1xuXHRlZGl0b3JJZGVudGlmaWVyOiBJRWRpdG9ySWRlbnRpZmllcjtcbn1cblxuYWJzdHJhY3QgY2xhc3MgTWVyZ2VFZGl0b3JBY3Rpb24yIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKGRlc2M6IFJlYWRvbmx5PElBY3Rpb24yT3B0aW9ucz4pIHtcblx0XHRzdXBlcihkZXNjKTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRjb25zdCB7IGFjdGl2ZUVkaXRvclBhbmUgfSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0aWYgKGFjdGl2ZUVkaXRvclBhbmUgaW5zdGFuY2VvZiBNZXJnZUVkaXRvcikge1xuXHRcdFx0Y29uc3Qgdm0gPSBhY3RpdmVFZGl0b3JQYW5lLnZpZXdNb2RlbC5nZXQoKTtcblx0XHRcdGlmICghdm0pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdGhpcy5ydW5XaXRoTWVyZ2VFZGl0b3Ioe1xuXHRcdFx0XHR2aWV3TW9kZWw6IHZtLFxuXHRcdFx0XHRpbnB1dE1vZGVsOiBhY3RpdmVFZGl0b3JQYW5lLmlucHV0TW9kZWwuZ2V0KCkhLFxuXHRcdFx0XHRpbnB1dDogYWN0aXZlRWRpdG9yUGFuZS5pbnB1dCBhcyBNZXJnZUVkaXRvcklucHV0LFxuXHRcdFx0XHRlZGl0b3JJZGVudGlmaWVyOiB7XG5cdFx0XHRcdFx0ZWRpdG9yOiBhY3RpdmVFZGl0b3JQYW5lLmlucHV0LFxuXHRcdFx0XHRcdGdyb3VwSWQ6IGFjdGl2ZUVkaXRvclBhbmUuZ3JvdXAuaWQsXG5cdFx0XHRcdH1cblx0XHRcdH0sIGFjY2Vzc29yLCAuLi5hcmdzKSBhcyBhbnk7XG5cdFx0fVxuXHR9XG5cblx0YWJzdHJhY3QgcnVuV2l0aE1lcmdlRWRpdG9yKGNvbnRleHQ6IE1lcmdlRWRpdG9yQWN0aW9uMkFyZ3MsIGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IHVua25vd247XG59XG5cbmV4cG9ydCBjbGFzcyBPcGVuTWVyZ2VFZGl0b3IgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdfb3Blbi5tZXJnZUVkaXRvcicsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0aXRsZScsICdPcGVuIE1lcmdlIEVkaXRvcicpLFxuXHRcdH0pO1xuXHR9XG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogdW5rbm93bltdKTogdm9pZCB7XG5cdFx0Y29uc3QgdmFsaWRhdGVkQXJncyA9IElSZWxheGVkT3BlbkFyZ3MudmFsaWRhdGUoYXJnc1swXSk7XG5cblx0XHRjb25zdCBpbnB1dDogSVJlc291cmNlTWVyZ2VFZGl0b3JJbnB1dCA9IHtcblx0XHRcdGJhc2U6IHsgcmVzb3VyY2U6IHZhbGlkYXRlZEFyZ3MuYmFzZSB9LFxuXHRcdFx0aW5wdXQxOiB7IHJlc291cmNlOiB2YWxpZGF0ZWRBcmdzLmlucHV0MS51cmksIGxhYmVsOiB2YWxpZGF0ZWRBcmdzLmlucHV0MS50aXRsZSwgZGVzY3JpcHRpb246IHZhbGlkYXRlZEFyZ3MuaW5wdXQxLmRlc2NyaXB0aW9uLCBkZXRhaWw6IHZhbGlkYXRlZEFyZ3MuaW5wdXQxLmRldGFpbCB9LFxuXHRcdFx0aW5wdXQyOiB7IHJlc291cmNlOiB2YWxpZGF0ZWRBcmdzLmlucHV0Mi51cmksIGxhYmVsOiB2YWxpZGF0ZWRBcmdzLmlucHV0Mi50aXRsZSwgZGVzY3JpcHRpb246IHZhbGlkYXRlZEFyZ3MuaW5wdXQyLmRlc2NyaXB0aW9uLCBkZXRhaWw6IHZhbGlkYXRlZEFyZ3MuaW5wdXQyLmRldGFpbCB9LFxuXHRcdFx0cmVzdWx0OiB7IHJlc291cmNlOiB2YWxpZGF0ZWRBcmdzLm91dHB1dCB9LFxuXHRcdFx0b3B0aW9uczogeyBwcmVzZXJ2ZUZvY3VzOiB0cnVlIH1cblx0XHR9O1xuXHRcdGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSkub3BlbkVkaXRvcihpbnB1dCk7XG5cdH1cbn1cblxubmFtZXNwYWNlIElSZWxheGVkT3BlbkFyZ3Mge1xuXHRleHBvcnQgZnVuY3Rpb24gdmFsaWRhdGUob2JqOiB1bmtub3duKToge1xuXHRcdGJhc2U6IFVSSTtcblx0XHRpbnB1dDE6IE1lcmdlRWRpdG9ySW5wdXREYXRhO1xuXHRcdGlucHV0MjogTWVyZ2VFZGl0b3JJbnB1dERhdGE7XG5cdFx0b3V0cHV0OiBVUkk7XG5cdH0ge1xuXHRcdGlmICghb2JqIHx8IHR5cGVvZiBvYmogIT09ICdvYmplY3QnKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdpbnZhbGlkIGFyZ3VtZW50Jyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbyA9IG9iaiBhcyBJUmVsYXhlZE9wZW5BcmdzO1xuXHRcdGNvbnN0IGJhc2UgPSB0b1VyaShvLmJhc2UpO1xuXHRcdGNvbnN0IG91dHB1dCA9IHRvVXJpKG8ub3V0cHV0KTtcblx0XHRjb25zdCBpbnB1dDEgPSB0b0lucHV0RGF0YShvLmlucHV0MSk7XG5cdFx0Y29uc3QgaW5wdXQyID0gdG9JbnB1dERhdGEoby5pbnB1dDIpO1xuXHRcdHJldHVybiB7IGJhc2UsIGlucHV0MSwgaW5wdXQyLCBvdXRwdXQgfTtcblx0fVxuXG5cdGZ1bmN0aW9uIHRvSW5wdXREYXRhKG9iajogdW5rbm93bik6IE1lcmdlRWRpdG9ySW5wdXREYXRhIHtcblx0XHRpZiAodHlwZW9mIG9iaiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiBuZXcgTWVyZ2VFZGl0b3JJbnB1dERhdGEoVVJJLnBhcnNlKG9iaiwgdHJ1ZSksIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdH1cblx0XHRpZiAoIW9iaiB8fCB0eXBlb2Ygb2JqICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignaW52YWxpZCBhcmd1bWVudCcpO1xuXHRcdH1cblxuXHRcdGlmIChpc1VyaUNvbXBvbmVudHMob2JqKSkge1xuXHRcdFx0cmV0dXJuIG5ldyBNZXJnZUVkaXRvcklucHV0RGF0YShVUkkucmV2aXZlKG9iaiksIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG8gPSBvYmogYXMgSVJlbGF4ZWRJbnB1dERhdGE7XG5cdFx0Y29uc3QgdGl0bGUgPSBvLnRpdGxlO1xuXHRcdGNvbnN0IHVyaSA9IHRvVXJpKG8udXJpKTtcblx0XHRjb25zdCBkZXRhaWwgPSBvLmRldGFpbDtcblx0XHRjb25zdCBkZXNjcmlwdGlvbiA9IG8uZGVzY3JpcHRpb247XG5cdFx0cmV0dXJuIG5ldyBNZXJnZUVkaXRvcklucHV0RGF0YSh1cmksIHRpdGxlLCBkZXRhaWwsIGRlc2NyaXB0aW9uKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHRvVXJpKG9iajogdW5rbm93bik6IFVSSSB7XG5cdFx0aWYgKHR5cGVvZiBvYmogPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gVVJJLnBhcnNlKG9iaiwgdHJ1ZSk7XG5cdFx0fSBlbHNlIGlmIChvYmogJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcpIHtcblx0XHRcdHJldHVybiBVUkkucmV2aXZlKDxVcmlDb21wb25lbnRzPm9iaik7XG5cdFx0fVxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ2ludmFsaWQgYXJndW1lbnQnKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGlzVXJpQ29tcG9uZW50cyhvYmo6IHVua25vd24pOiBvYmogaXMgVXJpQ29tcG9uZW50cyB7XG5cdFx0aWYgKCFvYmogfHwgdHlwZW9mIG9iaiAhPT0gJ29iamVjdCcpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29uc3QgbyA9IG9iaiBhcyBVcmlDb21wb25lbnRzO1xuXHRcdHJldHVybiB0eXBlb2Ygby5zY2hlbWUgPT09ICdzdHJpbmcnXG5cdFx0XHQmJiB0eXBlb2Ygby5hdXRob3JpdHkgPT09ICdzdHJpbmcnXG5cdFx0XHQmJiB0eXBlb2Ygby5wYXRoID09PSAnc3RyaW5nJ1xuXHRcdFx0JiYgdHlwZW9mIG8ucXVlcnkgPT09ICdzdHJpbmcnXG5cdFx0XHQmJiB0eXBlb2Ygby5mcmFnbWVudCA9PT0gJ3N0cmluZyc7XG5cdH1cbn1cblxudHlwZSBJUmVsYXhlZElucHV0RGF0YSA9IHsgdXJpOiBVcmlDb21wb25lbnRzOyB0aXRsZT86IHN0cmluZzsgZGV0YWlsPzogc3RyaW5nOyBkZXNjcmlwdGlvbj86IHN0cmluZyB9O1xuXG50eXBlIElSZWxheGVkT3BlbkFyZ3MgPSB7XG5cdGJhc2U6IFVyaUNvbXBvbmVudHMgfCBzdHJpbmc7XG5cdGlucHV0MTogSVJlbGF4ZWRJbnB1dERhdGEgfCBzdHJpbmc7XG5cdGlucHV0MjogSVJlbGF4ZWRJbnB1dERhdGEgfCBzdHJpbmc7XG5cdG91dHB1dDogVXJpQ29tcG9uZW50cyB8IHN0cmluZztcbn07XG5cbmV4cG9ydCBjbGFzcyBTZXRNaXhlZExheW91dCBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ21lcmdlLm1peGVkTGF5b3V0Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2xheW91dC5taXhlZCcsIFwiTWl4ZWQgTGF5b3V0XCIpLFxuXHRcdFx0dG9nZ2xlZDogY3R4TWVyZ2VFZGl0b3JMYXlvdXQuaXNFcXVhbFRvKCdtaXhlZCcpLFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5FZGl0b3JUaXRsZSxcblx0XHRcdFx0XHR3aGVuOiBjdHhJc01lcmdlRWRpdG9yLFxuXHRcdFx0XHRcdGdyb3VwOiAnMV9tZXJnZScsXG5cdFx0XHRcdFx0b3JkZXI6IDksXG5cdFx0XHRcdH0sXG5cdFx0XHRdLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBjdHhJc01lcmdlRWRpdG9yLFxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBhY3RpdmVFZGl0b3JQYW5lIH0gPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGlmIChhY3RpdmVFZGl0b3JQYW5lIGluc3RhbmNlb2YgTWVyZ2VFZGl0b3IpIHtcblx0XHRcdGFjdGl2ZUVkaXRvclBhbmUuc2V0TGF5b3V0S2luZCgnbWl4ZWQnKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNldENvbHVtbkxheW91dCBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ21lcmdlLmNvbHVtbkxheW91dCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdsYXlvdXQuY29sdW1uJywgJ0NvbHVtbiBMYXlvdXQnKSxcblx0XHRcdHRvZ2dsZWQ6IGN0eE1lcmdlRWRpdG9yTGF5b3V0LmlzRXF1YWxUbygnY29sdW1ucycpLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5FZGl0b3JUaXRsZSxcblx0XHRcdFx0d2hlbjogY3R4SXNNZXJnZUVkaXRvcixcblx0XHRcdFx0Z3JvdXA6ICcxX21lcmdlJyxcblx0XHRcdFx0b3JkZXI6IDEwLFxuXHRcdFx0fV0sXG5cdFx0XHRwcmVjb25kaXRpb246IGN0eElzTWVyZ2VFZGl0b3IsXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRjb25zdCB7IGFjdGl2ZUVkaXRvclBhbmUgfSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0aWYgKGFjdGl2ZUVkaXRvclBhbmUgaW5zdGFuY2VvZiBNZXJnZUVkaXRvcikge1xuXHRcdFx0YWN0aXZlRWRpdG9yUGFuZS5zZXRMYXlvdXRLaW5kKCdjb2x1bW5zJyk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTaG93Tm9uQ29uZmxpY3RpbmdDaGFuZ2VzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnbWVyZ2Uuc2hvd05vbkNvbmZsaWN0aW5nQ2hhbmdlcycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzaG93Tm9uQ29uZmxpY3RpbmdDaGFuZ2VzJywgXCJTaG93IE5vbi1Db25mbGljdGluZyBDaGFuZ2VzXCIpLFxuXHRcdFx0dG9nZ2xlZDogY3R4TWVyZ2VFZGl0b3JTaG93Tm9uQ29uZmxpY3RpbmdDaGFuZ2VzLmlzRXF1YWxUbyh0cnVlKSxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yVGl0bGUsXG5cdFx0XHRcdFx0d2hlbjogY3R4SXNNZXJnZUVkaXRvcixcblx0XHRcdFx0XHRncm91cDogJzNfbWVyZ2UnLFxuXHRcdFx0XHRcdG9yZGVyOiA5LFxuXHRcdFx0XHR9LFxuXHRcdFx0XSxcblx0XHRcdHByZWNvbmRpdGlvbjogY3R4SXNNZXJnZUVkaXRvcixcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IHsgYWN0aXZlRWRpdG9yUGFuZSB9ID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRpZiAoYWN0aXZlRWRpdG9yUGFuZSBpbnN0YW5jZW9mIE1lcmdlRWRpdG9yKSB7XG5cdFx0XHRhY3RpdmVFZGl0b3JQYW5lLnRvZ2dsZVNob3dOb25Db25mbGljdGluZ0NoYW5nZXMoKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNob3dIaWRlQmFzZSBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ21lcmdlLnNob3dCYXNlJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2xheW91dC5zaG93QmFzZScsIFwiU2hvdyBCYXNlXCIpLFxuXHRcdFx0dG9nZ2xlZDogY3R4TWVyZ2VFZGl0b3JTaG93QmFzZS5pc0VxdWFsVG8odHJ1ZSksXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkVkaXRvclRpdGxlLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChjdHhJc01lcmdlRWRpdG9yLCBjdHhNZXJnZUVkaXRvckxheW91dC5pc0VxdWFsVG8oJ2NvbHVtbnMnKSksXG5cdFx0XHRcdFx0Z3JvdXA6ICcyX21lcmdlJyxcblx0XHRcdFx0XHRvcmRlcjogOSxcblx0XHRcdFx0fSxcblx0XHRcdF1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IHsgYWN0aXZlRWRpdG9yUGFuZSB9ID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRpZiAoYWN0aXZlRWRpdG9yUGFuZSBpbnN0YW5jZW9mIE1lcmdlRWRpdG9yKSB7XG5cdFx0XHRhY3RpdmVFZGl0b3JQYW5lLnRvZ2dsZUJhc2UoKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNob3dIaWRlVG9wQmFzZSBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ21lcmdlLnNob3dCYXNlVG9wJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2xheW91dC5zaG93QmFzZVRvcCcsIFwiU2hvdyBCYXNlIFRvcFwiKSxcblx0XHRcdHRvZ2dsZWQ6IENvbnRleHRLZXlFeHByLmFuZChjdHhNZXJnZUVkaXRvclNob3dCYXNlLCBjdHhNZXJnZUVkaXRvclNob3dCYXNlQXRUb3ApLFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5FZGl0b3JUaXRsZSxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoY3R4SXNNZXJnZUVkaXRvciwgY3R4TWVyZ2VFZGl0b3JMYXlvdXQuaXNFcXVhbFRvKCdtaXhlZCcpKSxcblx0XHRcdFx0XHRncm91cDogJzJfbWVyZ2UnLFxuXHRcdFx0XHRcdG9yZGVyOiAxMCxcblx0XHRcdFx0fSxcblx0XHRcdF0sXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRjb25zdCB7IGFjdGl2ZUVkaXRvclBhbmUgfSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0aWYgKGFjdGl2ZUVkaXRvclBhbmUgaW5zdGFuY2VvZiBNZXJnZUVkaXRvcikge1xuXHRcdFx0YWN0aXZlRWRpdG9yUGFuZS50b2dnbGVTaG93QmFzZVRvcCgpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2hvd0hpZGVDZW50ZXJCYXNlIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnbWVyZ2Uuc2hvd0Jhc2VDZW50ZXInLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbGF5b3V0LnNob3dCYXNlQ2VudGVyJywgXCJTaG93IEJhc2UgQ2VudGVyXCIpLFxuXHRcdFx0dG9nZ2xlZDogQ29udGV4dEtleUV4cHIuYW5kKGN0eE1lcmdlRWRpdG9yU2hvd0Jhc2UsIGN0eE1lcmdlRWRpdG9yU2hvd0Jhc2VBdFRvcC5uZWdhdGUoKSksXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkVkaXRvclRpdGxlLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChjdHhJc01lcmdlRWRpdG9yLCBjdHhNZXJnZUVkaXRvckxheW91dC5pc0VxdWFsVG8oJ21peGVkJykpLFxuXHRcdFx0XHRcdGdyb3VwOiAnMl9tZXJnZScsXG5cdFx0XHRcdFx0b3JkZXI6IDExLFxuXHRcdFx0XHR9LFxuXHRcdFx0XSxcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IHsgYWN0aXZlRWRpdG9yUGFuZSB9ID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRpZiAoYWN0aXZlRWRpdG9yUGFuZSBpbnN0YW5jZW9mIE1lcmdlRWRpdG9yKSB7XG5cdFx0XHRhY3RpdmVFZGl0b3JQYW5lLnRvZ2dsZVNob3dCYXNlQ2VudGVyKCk7XG5cdFx0fVxuXHR9XG59XG5cbmNvbnN0IG1lcmdlRWRpdG9yQ2F0ZWdvcnk6IElMb2NhbGl6ZWRTdHJpbmcgPSBsb2NhbGl6ZTIoJ21lcmdlRWRpdG9yJywgXCJNZXJnZSBFZGl0b3JcIik7XG5cbmV4cG9ydCBjbGFzcyBPcGVuUmVzdWx0UmVzb3VyY2UgZXh0ZW5kcyBNZXJnZUVkaXRvckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnbWVyZ2Uub3BlblJlc3VsdCcsXG5cdFx0XHRpY29uOiBDb2RpY29uLmdvVG9GaWxlLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignb3BlbmZpbGUnLCBcIk9wZW4gRmlsZVwiKSxcblx0XHRcdGNhdGVnb3J5OiBtZXJnZUVkaXRvckNhdGVnb3J5LFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5FZGl0b3JUaXRsZSxcblx0XHRcdFx0d2hlbjogY3R4SXNNZXJnZUVkaXRvcixcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHR9XSxcblx0XHRcdHByZWNvbmRpdGlvbjogY3R4SXNNZXJnZUVkaXRvcixcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bldpdGhWaWV3TW9kZWwodmlld01vZGVsOiBNZXJnZUVkaXRvclZpZXdNb2RlbCwgYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZTogdmlld01vZGVsLm1vZGVsLnJlc3VsdFRleHRNb2RlbC51cmkgfSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEdvVG9OZXh0VW5oYW5kbGVkQ29uZmxpY3QgZXh0ZW5kcyBNZXJnZUVkaXRvckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnbWVyZ2UuZ29Ub05leHRVbmhhbmRsZWRDb25mbGljdCcsXG5cdFx0XHRjYXRlZ29yeTogbWVyZ2VFZGl0b3JDYXRlZ29yeSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21lcmdlLmdvVG9OZXh0VW5oYW5kbGVkQ29uZmxpY3QnLCBcIkdvIHRvIE5leHQgVW5oYW5kbGVkIENvbmZsaWN0XCIpLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5hcnJvd0Rvd24sXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkVkaXRvclRpdGxlLFxuXHRcdFx0XHRcdHdoZW46IGN0eElzTWVyZ2VFZGl0b3IsXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRvcmRlcjogM1xuXHRcdFx0XHR9LFxuXHRcdFx0XSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBjdHhJc01lcmdlRWRpdG9yLFxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuV2l0aFZpZXdNb2RlbCh2aWV3TW9kZWw6IE1lcmdlRWRpdG9yVmlld01vZGVsKTogdm9pZCB7XG5cdFx0dmlld01vZGVsLm1vZGVsLnRlbGVtZXRyeS5yZXBvcnROYXZpZ2F0aW9uVG9OZXh0Q29uZmxpY3QoKTtcblx0XHR2aWV3TW9kZWwuZ29Ub05leHRNb2RpZmllZEJhc2VSYW5nZShyID0+ICF2aWV3TW9kZWwubW9kZWwuaXNIYW5kbGVkKHIpLmdldCgpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgR29Ub1ByZXZpb3VzVW5oYW5kbGVkQ29uZmxpY3QgZXh0ZW5kcyBNZXJnZUVkaXRvckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnbWVyZ2UuZ29Ub1ByZXZpb3VzVW5oYW5kbGVkQ29uZmxpY3QnLFxuXHRcdFx0Y2F0ZWdvcnk6IG1lcmdlRWRpdG9yQ2F0ZWdvcnksXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtZXJnZS5nb1RvUHJldmlvdXNVbmhhbmRsZWRDb25mbGljdCcsIFwiR28gdG8gUHJldmlvdXMgVW5oYW5kbGVkIENvbmZsaWN0XCIpLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5hcnJvd1VwLFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5FZGl0b3JUaXRsZSxcblx0XHRcdFx0XHR3aGVuOiBjdHhJc01lcmdlRWRpdG9yLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDJcblx0XHRcdFx0fSxcblx0XHRcdF0sXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogY3R4SXNNZXJnZUVkaXRvcixcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bldpdGhWaWV3TW9kZWwodmlld01vZGVsOiBNZXJnZUVkaXRvclZpZXdNb2RlbCk6IHZvaWQge1xuXHRcdHZpZXdNb2RlbC5tb2RlbC50ZWxlbWV0cnkucmVwb3J0TmF2aWdhdGlvblRvUHJldmlvdXNDb25mbGljdCgpO1xuXHRcdHZpZXdNb2RlbC5nb1RvUHJldmlvdXNNb2RpZmllZEJhc2VSYW5nZShyID0+ICF2aWV3TW9kZWwubW9kZWwuaXNIYW5kbGVkKHIpLmdldCgpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVG9nZ2xlQWN0aXZlQ29uZmxpY3RJbnB1dDEgZXh0ZW5kcyBNZXJnZUVkaXRvckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnbWVyZ2UudG9nZ2xlQWN0aXZlQ29uZmxpY3RJbnB1dDEnLFxuXHRcdFx0Y2F0ZWdvcnk6IG1lcmdlRWRpdG9yQ2F0ZWdvcnksXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtZXJnZS50b2dnbGVDdXJyZW50Q29uZmxpY3RGcm9tTGVmdCcsIFwiVG9nZ2xlIEN1cnJlbnQgQ29uZmxpY3QgZnJvbSBMZWZ0XCIpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IGN0eElzTWVyZ2VFZGl0b3IsXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBydW5XaXRoVmlld01vZGVsKHZpZXdNb2RlbDogTWVyZ2VFZGl0b3JWaWV3TW9kZWwpOiB2b2lkIHtcblx0XHR2aWV3TW9kZWwudG9nZ2xlQWN0aXZlQ29uZmxpY3QoMSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRvZ2dsZUFjdGl2ZUNvbmZsaWN0SW5wdXQyIGV4dGVuZHMgTWVyZ2VFZGl0b3JBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ21lcmdlLnRvZ2dsZUFjdGl2ZUNvbmZsaWN0SW5wdXQyJyxcblx0XHRcdGNhdGVnb3J5OiBtZXJnZUVkaXRvckNhdGVnb3J5LFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbWVyZ2UudG9nZ2xlQ3VycmVudENvbmZsaWN0RnJvbVJpZ2h0JywgXCJUb2dnbGUgQ3VycmVudCBDb25mbGljdCBmcm9tIFJpZ2h0XCIpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IGN0eElzTWVyZ2VFZGl0b3IsXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBydW5XaXRoVmlld01vZGVsKHZpZXdNb2RlbDogTWVyZ2VFZGl0b3JWaWV3TW9kZWwpOiB2b2lkIHtcblx0XHR2aWV3TW9kZWwudG9nZ2xlQWN0aXZlQ29uZmxpY3QoMik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbXBhcmVJbnB1dDFXaXRoQmFzZUNvbW1hbmQgZXh0ZW5kcyBNZXJnZUVkaXRvckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnbWVyZ2VFZGl0b3IuY29tcGFyZUlucHV0MVdpdGhCYXNlJyxcblx0XHRcdGNhdGVnb3J5OiBtZXJnZUVkaXRvckNhdGVnb3J5LFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbWVyZ2VFZGl0b3IuY29tcGFyZUlucHV0MVdpdGhCYXNlJywgXCJDb21wYXJlIElucHV0IDEgV2l0aCBCYXNlXCIpLFxuXHRcdFx0c2hvcnRUaXRsZTogbG9jYWxpemUoJ21lcmdlRWRpdG9yLmNvbXBhcmVXaXRoQmFzZScsICdDb21wYXJlIFdpdGggQmFzZScpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IGN0eElzTWVyZ2VFZGl0b3IsXG5cdFx0XHRtZW51OiB7IGlkOiBNZW51SWQuTWVyZ2VJbnB1dDFUb29sYmFyLCBncm91cDogJ3ByaW1hcnknIH0sXG5cdFx0XHRpY29uOiBDb2RpY29uLmNvbXBhcmVDaGFuZ2VzLFxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuV2l0aFZpZXdNb2RlbCh2aWV3TW9kZWw6IE1lcmdlRWRpdG9yVmlld01vZGVsLCBhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdG1lcmdlRWRpdG9yQ29tcGFyZSh2aWV3TW9kZWwsIGVkaXRvclNlcnZpY2UsIDEpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDb21wYXJlSW5wdXQyV2l0aEJhc2VDb21tYW5kIGV4dGVuZHMgTWVyZ2VFZGl0b3JBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ21lcmdlRWRpdG9yLmNvbXBhcmVJbnB1dDJXaXRoQmFzZScsXG5cdFx0XHRjYXRlZ29yeTogbWVyZ2VFZGl0b3JDYXRlZ29yeSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21lcmdlRWRpdG9yLmNvbXBhcmVJbnB1dDJXaXRoQmFzZScsIFwiQ29tcGFyZSBJbnB1dCAyIFdpdGggQmFzZVwiKSxcblx0XHRcdHNob3J0VGl0bGU6IGxvY2FsaXplKCdtZXJnZUVkaXRvci5jb21wYXJlV2l0aEJhc2UnLCAnQ29tcGFyZSBXaXRoIEJhc2UnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBjdHhJc01lcmdlRWRpdG9yLFxuXHRcdFx0bWVudTogeyBpZDogTWVudUlkLk1lcmdlSW5wdXQyVG9vbGJhciwgZ3JvdXA6ICdwcmltYXJ5JyB9LFxuXHRcdFx0aWNvbjogQ29kaWNvbi5jb21wYXJlQ2hhbmdlcyxcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bldpdGhWaWV3TW9kZWwodmlld01vZGVsOiBNZXJnZUVkaXRvclZpZXdNb2RlbCwgYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRtZXJnZUVkaXRvckNvbXBhcmUodmlld01vZGVsLCBlZGl0b3JTZXJ2aWNlLCAyKTtcblx0fVxufVxuXG5hc3luYyBmdW5jdGlvbiBtZXJnZUVkaXRvckNvbXBhcmUodmlld01vZGVsOiBNZXJnZUVkaXRvclZpZXdNb2RlbCwgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsIGlucHV0TnVtYmVyOiAxIHwgMikge1xuXG5cdGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcihlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvciEsIHsgcGlubmVkOiB0cnVlIH0pO1xuXG5cdGNvbnN0IG1vZGVsID0gdmlld01vZGVsLm1vZGVsO1xuXHRjb25zdCBiYXNlID0gbW9kZWwuYmFzZTtcblx0Y29uc3QgaW5wdXQgPSBpbnB1dE51bWJlciA9PT0gMSA/IHZpZXdNb2RlbC5pbnB1dENvZGVFZGl0b3JWaWV3MS5lZGl0b3IgOiB2aWV3TW9kZWwuaW5wdXRDb2RlRWRpdG9yVmlldzIuZWRpdG9yO1xuXG5cdGNvbnN0IGxpbmVOdW1iZXIgPSBpbnB1dC5nZXRQb3NpdGlvbigpIS5saW5lTnVtYmVyO1xuXHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdG9yaWdpbmFsOiB7IHJlc291cmNlOiBiYXNlLnVyaSB9LFxuXHRcdG1vZGlmaWVkOiB7IHJlc291cmNlOiBpbnB1dC5nZXRNb2RlbCgpIS51cmkgfSxcblx0XHRvcHRpb25zOiB7XG5cdFx0XHRzZWxlY3Rpb246IHtcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBsaW5lTnVtYmVyLFxuXHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdH0sXG5cdFx0XHRyZXZlYWxJZk9wZW5lZDogdHJ1ZSxcblx0XHRcdHJldmVhbElmVmlzaWJsZTogdHJ1ZSxcblx0XHR9IHNhdGlzZmllcyBJVGV4dEVkaXRvck9wdGlvbnNcblx0fSk7XG59XG5cbmV4cG9ydCBjbGFzcyBPcGVuQmFzZUZpbGUgZXh0ZW5kcyBNZXJnZUVkaXRvckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnbWVyZ2Uub3BlbkJhc2VFZGl0b3InLFxuXHRcdFx0Y2F0ZWdvcnk6IG1lcmdlRWRpdG9yQ2F0ZWdvcnksXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtZXJnZS5vcGVuQmFzZUVkaXRvcicsIFwiT3BlbiBCYXNlIEZpbGVcIiksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogY3R4SXNNZXJnZUVkaXRvcixcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bldpdGhWaWV3TW9kZWwodmlld01vZGVsOiBNZXJnZUVkaXRvclZpZXdNb2RlbCwgYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRjb25zdCBvcGVuZXJTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElPcGVuZXJTZXJ2aWNlKTtcblx0XHRvcGVuZXJTZXJ2aWNlLm9wZW4odmlld01vZGVsLm1vZGVsLmJhc2UudXJpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQWNjZXB0QWxsSW5wdXQxIGV4dGVuZHMgTWVyZ2VFZGl0b3JBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ21lcmdlLmFjY2VwdEFsbElucHV0MScsXG5cdFx0XHRjYXRlZ29yeTogbWVyZ2VFZGl0b3JDYXRlZ29yeSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21lcmdlLmFjY2VwdEFsbElucHV0MScsIFwiQWNjZXB0IEFsbCBDaGFuZ2VzIGZyb20gTGVmdFwiKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBjdHhJc01lcmdlRWRpdG9yLFxuXHRcdFx0bWVudTogeyBpZDogTWVudUlkLk1lcmdlSW5wdXQxVG9vbGJhciwgZ3JvdXA6ICdwcmltYXJ5JyB9LFxuXHRcdFx0aWNvbjogQ29kaWNvbi5jaGVja0FsbCxcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bldpdGhWaWV3TW9kZWwodmlld01vZGVsOiBNZXJnZUVkaXRvclZpZXdNb2RlbCk6IHZvaWQge1xuXHRcdHZpZXdNb2RlbC5hY2NlcHRBbGwoMSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEFjY2VwdEFsbElucHV0MiBleHRlbmRzIE1lcmdlRWRpdG9yQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdtZXJnZS5hY2NlcHRBbGxJbnB1dDInLFxuXHRcdFx0Y2F0ZWdvcnk6IG1lcmdlRWRpdG9yQ2F0ZWdvcnksXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtZXJnZS5hY2NlcHRBbGxJbnB1dDInLCBcIkFjY2VwdCBBbGwgQ2hhbmdlcyBmcm9tIFJpZ2h0XCIpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IGN0eElzTWVyZ2VFZGl0b3IsXG5cdFx0XHRtZW51OiB7IGlkOiBNZW51SWQuTWVyZ2VJbnB1dDJUb29sYmFyLCBncm91cDogJ3ByaW1hcnknIH0sXG5cdFx0XHRpY29uOiBDb2RpY29uLmNoZWNrQWxsLFxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuV2l0aFZpZXdNb2RlbCh2aWV3TW9kZWw6IE1lcmdlRWRpdG9yVmlld01vZGVsKTogdm9pZCB7XG5cdFx0dmlld01vZGVsLmFjY2VwdEFsbCgyKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVzZXRUb0Jhc2VBbmRBdXRvTWVyZ2VDb21tYW5kIGV4dGVuZHMgTWVyZ2VFZGl0b3JBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ21lcmdlRWRpdG9yLnJlc2V0UmVzdWx0VG9CYXNlQW5kQXV0b01lcmdlJyxcblx0XHRcdGNhdGVnb3J5OiBtZXJnZUVkaXRvckNhdGVnb3J5LFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbWVyZ2VFZGl0b3IucmVzZXRSZXN1bHRUb0Jhc2VBbmRBdXRvTWVyZ2UnLCBcIlJlc2V0IFJlc3VsdFwiKSxcblx0XHRcdHNob3J0VGl0bGU6IGxvY2FsaXplKCdtZXJnZUVkaXRvci5yZXNldFJlc3VsdFRvQmFzZUFuZEF1dG9NZXJnZS5zaG9ydCcsICdSZXNldCcpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IGN0eElzTWVyZ2VFZGl0b3IsXG5cdFx0XHRtZW51OiB7IGlkOiBNZW51SWQuTWVyZ2VJbnB1dFJlc3VsdFRvb2xiYXIsIGdyb3VwOiAncHJpbWFyeScgfSxcblx0XHRcdGljb246IENvZGljb24uZGlzY2FyZCxcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bldpdGhWaWV3TW9kZWwodmlld01vZGVsOiBNZXJnZUVkaXRvclZpZXdNb2RlbCwgYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHR2aWV3TW9kZWwubW9kZWwucmVzZXQoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVzZXRDbG9zZVdpdGhDb25mbGljdHNDaG9pY2UgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdtZXJnZUVkaXRvci5yZXNldENsb3NlV2l0aENvbmZsaWN0c0Nob2ljZScsXG5cdFx0XHRjYXRlZ29yeTogbWVyZ2VFZGl0b3JDYXRlZ29yeSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21lcmdlRWRpdG9yLnJlc2V0Q2hvaWNlJywgXCJSZXNldCBDaG9pY2UgZm9yIFxcJ0Nsb3NlIHdpdGggQ29uZmxpY3RzXFwnXCIpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0fSk7XG5cdH1cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0YWNjZXNzb3IuZ2V0KElTdG9yYWdlU2VydmljZSkucmVtb3ZlKFN0b3JhZ2VDbG9zZVdpdGhDb25mbGljdHMsIFN0b3JhZ2VTY29wZS5QUk9GSUxFKTtcblx0fVxufVxuXG4vLyB0aGlzIGlzIGFuIEFQSSBjb21tYW5kXG5leHBvcnQgY2xhc3MgQWNjZXB0TWVyZ2UgZXh0ZW5kcyBNZXJnZUVkaXRvckFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ21lcmdlRWRpdG9yLmFjY2VwdE1lcmdlJyxcblx0XHRcdGNhdGVnb3J5OiBtZXJnZUVkaXRvckNhdGVnb3J5LFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbWVyZ2VFZGl0b3IuYWNjZXB0TWVyZ2UnLCBcIkNvbXBsZXRlIE1lcmdlXCIpLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBjdHhJc01lcmdlRWRpdG9yXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW5XaXRoTWVyZ2VFZGl0b3IoeyBpbnB1dE1vZGVsLCBlZGl0b3JJZGVudGlmaWVyLCB2aWV3TW9kZWwgfTogTWVyZ2VFZGl0b3JBY3Rpb24yQXJncywgYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCBkaWFsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEaWFsb2dTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblxuXHRcdGlmICh2aWV3TW9kZWwubW9kZWwudW5oYW5kbGVkQ29uZmxpY3RzQ291bnQuZ2V0KCkgPiAwKSB7XG5cdFx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ21lcmdlRWRpdG9yLmFjY2VwdE1lcmdlLnVuaGFuZGxlZENvbmZsaWN0cy5tZXNzYWdlJywgXCJEbyB5b3Ugd2FudCB0byBjb21wbGV0ZSB0aGUgbWVyZ2Ugb2YgezB9P1wiLCBiYXNlbmFtZShpbnB1dE1vZGVsLnJlc3VsdFVyaSkpLFxuXHRcdFx0XHRkZXRhaWw6IGxvY2FsaXplKCdtZXJnZUVkaXRvci5hY2NlcHRNZXJnZS51bmhhbmRsZWRDb25mbGljdHMuZGV0YWlsJywgXCJUaGUgZmlsZSBjb250YWlucyB1bmhhbmRsZWQgY29uZmxpY3RzLlwiKSxcblx0XHRcdFx0cHJpbWFyeUJ1dHRvbjogbG9jYWxpemUoeyBrZXk6ICdtZXJnZUVkaXRvci5hY2NlcHRNZXJnZS51bmhhbmRsZWRDb25mbGljdHMuYWNjZXB0JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmQ29tcGxldGUgd2l0aCBDb25mbGljdHNcIilcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoIWNvbmZpcm1lZCkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Y2Nlc3NmdWw6IGZhbHNlXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0YXdhaXQgaW5wdXRNb2RlbC5hY2NlcHQoKTtcblx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLmNsb3NlRWRpdG9yKGVkaXRvcklkZW50aWZpZXIpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHN1Y2Nlc3NmdWw6IHRydWVcblx0XHR9O1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxXQUEwQjtBQUNuQyxTQUFTLFVBQVUsaUJBQWlCO0FBRXBDLFNBQVMsU0FBMEIsY0FBYztBQUNqRCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHNCQUFzQjtBQUcvQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGlCQUFpQixvQkFBb0I7QUFFOUMsU0FBMkIsNEJBQTRCO0FBRXZELFNBQVMsbUJBQW1CO0FBRTVCLFNBQVMsa0JBQWtCLHNCQUFzQix3QkFBd0IsNkJBQTZCLHlDQUF5QyxpQ0FBaUM7QUFDaEwsU0FBUyxzQkFBc0I7QUFFL0IsTUFBZSwwQkFBMEIsUUFBUTtBQUFBLEVBQ2hELFlBQVksTUFBaUM7QUFDNUMsVUFBTSxJQUFJO0FBQUEsRUFDWDtBQUFBLEVBRUEsSUFBSSxVQUFrQztBQUNyQyxVQUFNLEVBQUUsaUJBQWlCLElBQUksU0FBUyxJQUFJLGNBQWM7QUFDeEQsUUFBSSw0QkFBNEIsYUFBYTtBQUM1QyxZQUFNLEtBQUssaUJBQWlCLFVBQVUsSUFBSTtBQUMxQyxVQUFJLENBQUMsSUFBSTtBQUNSO0FBQUEsTUFDRDtBQUNBLFdBQUssaUJBQWlCLElBQUksUUFBUTtBQUFBLElBQ25DO0FBQUEsRUFDRDtBQUdEO0FBU0EsTUFBZSwyQkFBMkIsUUFBUTtBQUFBLEVBQ2pELFlBQVksTUFBaUM7QUFDNUMsVUFBTSxJQUFJO0FBQUEsRUFDWDtBQUFBLEVBRVMsSUFBSSxhQUErQixNQUFtQjtBQUM5RCxVQUFNLEVBQUUsaUJBQWlCLElBQUksU0FBUyxJQUFJLGNB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
