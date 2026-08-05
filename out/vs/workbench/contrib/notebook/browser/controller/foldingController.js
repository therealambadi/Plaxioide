import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_IS_ACTIVE_EDITOR } from "../../common/notebookContextKeys.js";
import { getNotebookEditorFromEditorPane, CellFoldingState } from "../notebookBrowser.js";
import { FoldingModel } from "../viewModel/foldingModel.js";
import { CellKind } from "../../common/notebookCommon.js";
import { registerNotebookContribution } from "../notebookEditorExtensions.js";
import { registerAction2, Action2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { InputFocusedContextKey } from "../../../../../platform/contextkey/common/contextkeys.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { NOTEBOOK_ACTIONS_CATEGORY } from "./coreActions.js";
import { localize, localize2 } from "../../../../../nls.js";
class FoldingController extends Disposable {
  constructor(_notebookEditor) {
    super();
    this._notebookEditor = _notebookEditor;
    this._foldingModel = null;
    this._localStore = this._register(new DisposableStore());
    this._register(this._notebookEditor.onMouseUp((e) => {
      this.onMouseUp(e);
    }));
    this._register(this._notebookEditor.onDidChangeModel(() => {
      this._localStore.clear();
      if (!this._notebookEditor.hasModel()) {
        return;
      }
      this._localStore.add(this._notebookEditor.onDidChangeCellState((e) => {
        if (e.source.editStateChanged && e.cell.cellKind === CellKind.Markup) {
          this._foldingModel?.recompute();
        }
      }));
      this._foldingModel = new FoldingModel();
      this._localStore.add(this._foldingModel);
      this._foldingModel.attachViewModel(this._notebookEditor.getViewModel());
      this._localStore.add(this._foldingModel.onDidFoldingRegionChanged(() => {
        this._updateEditorFoldingRanges();
      }));
    }));
  }
  saveViewState() {
    return this._foldingModel?.getMemento() || [];
  }
  restoreViewState(state) {
    this._foldingModel?.applyMemento(state || []);
    this._updateEditorFoldingRanges();
  }
  setFoldingStateDown(index, state, levels) {
    const doCollapse = state === CellFoldingState.Collapsed;
    const region = this._foldingModel.getRegionAtLine(index + 1);
    const regions = [];
    if (region) {
      if (region.isCollapsed !== doCollapse) {
        regions.push(region);
      }
      if (levels > 1) {
        const regionsInside = this._foldingModel.getRegionsInside(region, (r, level) => r.isCollapsed !== doCollapse && level < levels);
        regions.push(...regionsInside);
      }
    }
    regions.forEach((r) => this._foldingModel.setCollapsed(r.regionIndex, state === CellFoldingState.Collapsed));
    this._updateEditorFoldingRanges();
  }
  setFoldingStateUp(index, state, levels) {
    if (!this._foldingModel) {
      return;
    }
    const regions = this._foldingModel.getAllRegionsAtLine(index + 1, (region, level) => region.isCollapsed !== (state === CellFoldingState.Collapsed) && level <= levels);
    regions.forEach((r) => this._foldingModel.setCollapsed(r.regionIndex, state === CellFoldingState.Collapsed));
    this._updateEditorFoldingRanges();
  }
  _updateEditorFoldingRanges() {
    if (!this._foldingModel) {
      return;
    }
    if (!this._notebookEditor.hasModel()) {
      return;
    }
    const vm = this._notebookEditor.getViewModel();
    vm.updateFoldingRanges(this._foldingModel.regions);
    const hiddenRanges = vm.getHiddenRanges();
    this._notebookEditor.setHiddenAreas(hiddenRanges);
  }
  onMouseUp(e) {
    if (!e.event.target) {
      return;
    }
    if (!this._notebookEditor.hasModel()) {
      return;
    }
    const viewModel = this._notebookEditor.getViewModel();
    const target = e.event.target;
    if (target.classList.contains("codicon-notebook-collapsed") || target.classList.contains("codicon-notebook-expanded")) {
      const parent = target.parentElement;
      if (!parent.classList.contains("notebook-folding-indicator")) {
        return;
      }
      const cellViewModel = e.target;
      const modelIndex = viewModel.getCellIndex(cellViewModel);
      const state = viewModel.getFoldingState(modelIndex);
      if (state === CellFoldingState.None) {
        return;
      }
      this.setFoldingStateUp(modelIndex, state === CellFoldingState.Collapsed ? CellFoldingState.Expanded : CellFoldingState.Collapsed, 1);
      this._notebookEditor.focusElement(cellViewModel);
    }
    return;
  }
  recompute() {
    this._foldingModel?.recompute();
  }
}
FoldingController.id = "workbench.notebook.foldingController";
registerNotebookContribution(FoldingController.id, FoldingController);
const NOTEBOOK_FOLD_COMMAND_LABEL = localize("fold.cell", "Fold Cell");
const NOTEBOOK_UNFOLD_COMMAND_LABEL = localize2("unfold.cell", "Unfold Cell");
const FOLDING_COMMAND_ARGS = {
  args: [{
    isOptional: true,
    name: "index",
    description: "The cell index",
    schema: {
      "type": "object",
      "required": ["index", "direction"],
      "properties": {
        "index": {
          "type": "number"
        },
        "direction": {
          "type": "string",
          "enum": ["up", "down"],
          "default": "down"
        },
        "levels": {
          "type": "number",
          "default": 1
        }
      }
    }
  }]
};
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "notebook.fold",
      title: localize2("fold.cell", "Fold Cell"),
      category: NOTEBOOK_ACTIONS_CATEGORY,
      keybinding: {
        when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey)),
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.BracketLeft,
        mac: {
          primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.BracketLeft,
          secondary: [KeyCode.LeftArrow]
        },
        secondary: [KeyCode.LeftArrow],
        weight: KeybindingWeight.WorkbenchContrib
      },
      metadata: {
        description: NOTEBOOK_FOLD_COMMAND_LABEL,
        args: FOLDING_COMMAND_ARGS.args
      },
      precondition: NOTEBOOK_IS_ACTIVE_EDITOR,
      f1: true
    });
  }
  async run(accessor, args) {
    const editorService = accessor.get(IEditorService);
    const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!editor) {
      return;
    }
    if (!editor.hasModel()) {
      return;
    }
    const levels = args && args.levels || 1;
    const direction = args && args.direction === "up" ? "up" : "down";
    let index = void 0;
    if (args) {
      index = args.index;
    } else {
      const activeCell = editor.getActiveCell();
      if (!activeCell) {
        return;
      }
      index = editor.getCellIndex(activeCell);
    }
    const controller = editor.getContribution(FoldingController.id);
    if (index !== void 0) {
      const targetCell = index < 0 || index >= editor.getLength() ? void 0 : editor.cellAt(index);
      if (targetCell?.cellKind === CellKind.Code && direction === "down") {
        return;
      }
      if (direction === "up") {
        controller.setFoldingStateUp(index, CellFoldingState.Collapsed, levels);
      } else {
        controller.setFoldingStateDown(index, CellFoldingState.Collapsed, levels);
      }
      const viewIndex = editor.getViewModel().getNearestVisibleCellIndexUpwards(index);
      editor.focusElement(editor.cellAt(viewIndex));
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "notebook.unfold",
      title: NOTEBOOK_UNFOLD_COMMAND_LABEL,
      category: NOTEBOOK_ACTIONS_CATEGORY,
      keybinding: {
        when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey)),
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.BracketRight,
        mac: {
          primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.BracketRight,
          secondary: [KeyCode.RightArrow]
        },
        secondary: [KeyCode.RightArrow],
        weight: KeybindingWeight.WorkbenchContrib
      },
      metadata: {
        description: NOTEBOOK_UNFOLD_COMMAND_LABEL,
        args: FOLDING_COMMAND_ARGS.args
      },
      precondition: NOTEBOOK_IS_ACTIVE_EDITOR,
      f1: true
    });
  }
  async run(accessor, args) {
    const editorService = accessor.get(IEditorService);
    const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!editor) {
      return;
    }
    const levels = args && args.levels || 1;
    const direction = args && args.direction === "up" ? "up" : "down";
    let index = void 0;
    if (args) {
      index = args.index;
    } else {
      const activeCell = editor.getActiveCell();
      if (!activeCell) {
        return;
      }
      index = editor.getCellIndex(activeCell);
    }
    const controller = editor.getContribution(FoldingController.id);
    if (index !== void 0) {
      if (direction === "up") {
        controller.setFoldingStateUp(index, CellFoldingState.Expanded, levels);
      } else {
        controller.setFoldingStateDown(index, CellFoldingState.Expanded, levels);
      }
    }
  }
});
export {
  FoldingController
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyb2xsZXIvZm9sZGluZ0NvbnRyb2xsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTk9URUJPT0tfRURJVE9SX0ZPQ1VTRUQsIE5PVEVCT09LX0lTX0FDVElWRV9FRElUT1IgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFZGl0b3IsIElOb3RlYm9va0VkaXRvck1vdXNlRXZlbnQsIElOb3RlYm9va0VkaXRvckNvbnRyaWJ1dGlvbiwgZ2V0Tm90ZWJvb2tFZGl0b3JGcm9tRWRpdG9yUGFuZSwgQ2VsbEZvbGRpbmdTdGF0ZSB9IGZyb20gJy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBGb2xkaW5nTW9kZWwgfSBmcm9tICcuLi92aWV3TW9kZWwvZm9sZGluZ01vZGVsLmpzJzsgaW1wb3J0IHsgQ2VsbEtpbmQgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSUNlbGxSYW5nZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va1JhbmdlLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyTm90ZWJvb2tDb250cmlidXRpb24gfSBmcm9tICcuLi9ub3RlYm9va0VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJBY3Rpb24yLCBBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSW5wdXRGb2N1c2VkQ29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5PVEVCT09LX0FDVElPTlNfQ0FURUdPUlkgfSBmcm9tICcuL2NvcmVBY3Rpb25zLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgRm9sZGluZ1JlZ2lvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2ZvbGRpbmcvYnJvd3Nlci9mb2xkaW5nUmFuZ2VzLmpzJztcbmltcG9ydCB7IElDb21tYW5kTWV0YWRhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tWaWV3TW9kZWwgfSBmcm9tICcuLi92aWV3TW9kZWwvbm90ZWJvb2tWaWV3TW9kZWxJbXBsLmpzJztcblxuZXhwb3J0IGNsYXNzIEZvbGRpbmdDb250cm9sbGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElOb3RlYm9va0VkaXRvckNvbnRyaWJ1dGlvbiB7XG5cdHN0YXRpYyBpZDogc3RyaW5nID0gJ3dvcmtiZW5jaC5ub3RlYm9vay5mb2xkaW5nQ29udHJvbGxlcic7XG5cblx0cHJpdmF0ZSBfZm9sZGluZ01vZGVsOiBGb2xkaW5nTW9kZWwgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBfbG9jYWxTdG9yZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tFZGl0b3I6IElOb3RlYm9va0VkaXRvcikge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9ub3RlYm9va0VkaXRvci5vbk1vdXNlVXAoZSA9PiB7IHRoaXMub25Nb3VzZVVwKGUpOyB9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9ub3RlYm9va0VkaXRvci5vbkRpZENoYW5nZU1vZGVsKCgpID0+IHtcblx0XHRcdHRoaXMuX2xvY2FsU3RvcmUuY2xlYXIoKTtcblxuXHRcdFx0aWYgKCF0aGlzLl9ub3RlYm9va0VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fbG9jYWxTdG9yZS5hZGQodGhpcy5fbm90ZWJvb2tFZGl0b3Iub25EaWRDaGFuZ2VDZWxsU3RhdGUoZSA9PiB7XG5cdFx0XHRcdGlmIChlLnNvdXJjZS5lZGl0U3RhdGVDaGFuZ2VkICYmIGUuY2VsbC5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuTWFya3VwKSB7XG5cdFx0XHRcdFx0dGhpcy5fZm9sZGluZ01vZGVsPy5yZWNvbXB1dGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLl9mb2xkaW5nTW9kZWwgPSBuZXcgRm9sZGluZ01vZGVsKCk7XG5cdFx0XHR0aGlzLl9sb2NhbFN0b3JlLmFkZCh0aGlzLl9mb2xkaW5nTW9kZWwpO1xuXHRcdFx0dGhpcy5fZm9sZGluZ01vZGVsLmF0dGFjaFZpZXdNb2RlbCh0aGlzLl9ub3RlYm9va0VkaXRvci5nZXRWaWV3TW9kZWwoKSk7XG5cblx0XHRcdHRoaXMuX2xvY2FsU3RvcmUuYWRkKHRoaXMuX2ZvbGRpbmdNb2RlbC5vbkRpZEZvbGRpbmdSZWdpb25DaGFuZ2VkKCgpID0+IHtcblx0XHRcdFx0dGhpcy5fdXBkYXRlRWRpdG9yRm9sZGluZ1JhbmdlcygpO1xuXHRcdFx0fSkpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHNhdmVWaWV3U3RhdGUoKTogSUNlbGxSYW5nZVtdIHtcblx0XHRyZXR1cm4gdGhpcy5fZm9sZGluZ01vZGVsPy5nZXRNZW1lbnRvKCkgfHwgW107XG5cdH1cblxuXHRyZXN0b3JlVmlld1N0YXRlKHN0YXRlOiBJQ2VsbFJhbmdlW10gfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9mb2xkaW5nTW9kZWw/LmFwcGx5TWVtZW50byhzdGF0ZSB8fCBbXSk7XG5cdFx0dGhpcy5fdXBkYXRlRWRpdG9yRm9sZGluZ1JhbmdlcygpO1xuXHR9XG5cblx0c2V0Rm9sZGluZ1N0YXRlRG93bihpbmRleDogbnVtYmVyLCBzdGF0ZTogQ2VsbEZvbGRpbmdTdGF0ZSwgbGV2ZWxzOiBudW1iZXIpIHtcblx0XHRjb25zdCBkb0NvbGxhcHNlID0gc3RhdGUgPT09IENlbGxGb2xkaW5nU3RhdGUuQ29sbGFwc2VkO1xuXHRcdGNvbnN0IHJlZ2lvbiA9IHRoaXMuX2ZvbGRpbmdNb2RlbCEuZ2V0UmVnaW9uQXRMaW5lKGluZGV4ICsgMSk7XG5cdFx0Y29uc3QgcmVnaW9uczogRm9sZGluZ1JlZ2lvbltdID0gW107XG5cdFx0aWYgKHJlZ2lvbikge1xuXHRcdFx0aWYgKHJlZ2lvbi5pc0NvbGxhcHNlZCAhPT0gZG9Db2xsYXBzZSkge1xuXHRcdFx0XHRyZWdpb25zLnB1c2gocmVnaW9uKTtcblx0XHRcdH1cblx0XHRcdGlmIChsZXZlbHMgPiAxKSB7XG5cdFx0XHRcdGNvbnN0IHJlZ2lvbnNJbnNpZGUgPSB0aGlzLl9mb2xkaW5nTW9kZWwhLmdldFJlZ2lvbnNJbnNpZGUocmVnaW9uLCAociwgbGV2ZWw6IG51bWJlcikgPT4gci5pc0NvbGxhcHNlZCAhPT0gZG9Db2xsYXBzZSAmJiBsZXZlbCA8IGxldmVscyk7XG5cdFx0XHRcdHJlZ2lvbnMucHVzaCguLi5yZWdpb25zSW5zaWRlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZWdpb25zLmZvckVhY2gociA9PiB0aGlzLl9mb2xkaW5nTW9kZWwhLnNldENvbGxhcHNlZChyLnJlZ2lvbkluZGV4LCBzdGF0ZSA9PT0gQ2VsbEZvbGRpbmdTdGF0ZS5Db2xsYXBzZWQpKTtcblx0XHR0aGlzLl91cGRhdGVFZGl0b3JGb2xkaW5nUmFuZ2VzKCk7XG5cdH1cblxuXHRzZXRGb2xkaW5nU3RhdGVVcChpbmRleDogbnVtYmVyLCBzdGF0ZTogQ2VsbEZvbGRpbmdTdGF0ZSwgbGV2ZWxzOiBudW1iZXIpIHtcblx0XHRpZiAoIXRoaXMuX2ZvbGRpbmdNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlZ2lvbnMgPSB0aGlzLl9mb2xkaW5nTW9kZWwuZ2V0QWxsUmVnaW9uc0F0TGluZShpbmRleCArIDEsIChyZWdpb24sIGxldmVsKSA9PiByZWdpb24uaXNDb2xsYXBzZWQgIT09IChzdGF0ZSA9PT0gQ2VsbEZvbGRpbmdTdGF0ZS5Db2xsYXBzZWQpICYmIGxldmVsIDw9IGxldmVscyk7XG5cdFx0cmVnaW9ucy5mb3JFYWNoKHIgPT4gdGhpcy5fZm9sZGluZ01vZGVsIS5zZXRDb2xsYXBzZWQoci5yZWdpb25JbmRleCwgc3RhdGUgPT09IENlbGxGb2xkaW5nU3RhdGUuQ29sbGFwc2VkKSk7XG5cdFx0dGhpcy5fdXBkYXRlRWRpdG9yRm9sZGluZ1JhbmdlcygpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlRWRpdG9yRm9sZGluZ1JhbmdlcygpIHtcblx0XHRpZiAoIXRoaXMuX2ZvbGRpbmdNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fbm90ZWJvb2tFZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZtID0gdGhpcy5fbm90ZWJvb2tFZGl0b3IuZ2V0Vmlld01vZGVsKCkgYXMgTm90ZWJvb2tWaWV3TW9kZWw7XG5cblx0XHR2bS51cGRhdGVGb2xkaW5nUmFuZ2VzKHRoaXMuX2ZvbGRpbmdNb2RlbC5yZWdpb25zKTtcblx0XHRjb25zdCBoaWRkZW5SYW5nZXMgPSB2bS5nZXRIaWRkZW5SYW5nZXMoKTtcblx0XHR0aGlzLl9ub3RlYm9va0VkaXRvci5zZXRIaWRkZW5BcmVhcyhoaWRkZW5SYW5nZXMpO1xuXHR9XG5cblx0b25Nb3VzZVVwKGU6IElOb3RlYm9va0VkaXRvck1vdXNlRXZlbnQpIHtcblx0XHRpZiAoIWUuZXZlbnQudGFyZ2V0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9ub3RlYm9va0VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgdmlld01vZGVsID0gdGhpcy5fbm90ZWJvb2tFZGl0b3IuZ2V0Vmlld01vZGVsKCkgYXMgTm90ZWJvb2tWaWV3TW9kZWw7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gZS5ldmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQ7XG5cblx0XHRpZiAodGFyZ2V0LmNsYXNzTGlzdC5jb250YWlucygnY29kaWNvbi1ub3RlYm9vay1jb2xsYXBzZWQnKSB8fCB0YXJnZXQuY2xhc3NMaXN0LmNvbnRhaW5zKCdjb2RpY29uLW5vdGVib29rLWV4cGFuZGVkJykpIHtcblx0XHRcdGNvbnN0IHBhcmVudCA9IHRhcmdldC5wYXJlbnRFbGVtZW50IGFzIEhUTUxFbGVtZW50O1xuXG5cdFx0XHRpZiAoIXBhcmVudC5jbGFzc0xpc3QuY29udGFpbnMoJ25vdGVib29rLWZvbGRpbmctaW5kaWNhdG9yJykpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBmb2xkaW5nIGljb25cblxuXHRcdFx0Y29uc3QgY2VsbFZpZXdNb2RlbCA9IGUudGFyZ2V0O1xuXHRcdFx0Y29uc3QgbW9kZWxJbmRleCA9IHZpZXdNb2RlbC5nZXRDZWxsSW5kZXgoY2VsbFZpZXdNb2RlbCk7XG5cdFx0XHRjb25zdCBzdGF0ZSA9IHZpZXdNb2RlbC5nZXRGb2xkaW5nU3RhdGUobW9kZWxJbmRleCk7XG5cblx0XHRcdGlmIChzdGF0ZSA9PT0gQ2VsbEZvbGRpbmdTdGF0ZS5Ob25lKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5zZXRGb2xkaW5nU3RhdGVVcChtb2RlbEluZGV4LCBzdGF0ZSA9PT0gQ2VsbEZvbGRpbmdTdGF0ZS5Db2xsYXBzZWQgPyBDZWxsRm9sZGluZ1N0YXRlLkV4cGFuZGVkIDogQ2VsbEZvbGRpbmdTdGF0ZS5Db2xsYXBzZWQsIDEpO1xuXHRcdFx0dGhpcy5fbm90ZWJvb2tFZGl0b3IuZm9jdXNFbGVtZW50KGNlbGxWaWV3TW9kZWwpO1xuXHRcdH1cblxuXHRcdHJldHVybjtcblx0fVxuXG5cdHJlY29tcHV0ZSgpIHtcblx0XHR0aGlzLl9mb2xkaW5nTW9kZWw/LnJlY29tcHV0ZSgpO1xuXHR9XG59XG5cbnJlZ2lzdGVyTm90ZWJvb2tDb250cmlidXRpb24oRm9sZGluZ0NvbnRyb2xsZXIuaWQsIEZvbGRpbmdDb250cm9sbGVyKTtcblxuXG5jb25zdCBOT1RFQk9PS19GT0xEX0NPTU1BTkRfTEFCRUwgPSBsb2NhbGl6ZSgnZm9sZC5jZWxsJywgXCJGb2xkIENlbGxcIik7XG5jb25zdCBOT1RFQk9PS19VTkZPTERfQ09NTUFORF9MQUJFTCA9IGxvY2FsaXplMigndW5mb2xkLmNlbGwnLCBcIlVuZm9sZCBDZWxsXCIpO1xuXG5jb25zdCBGT0xESU5HX0NPTU1BTkRfQVJHUzogUGljazxJQ29tbWFuZE1ldGFkYXRhLCAnYXJncyc+ID0ge1xuXHRhcmdzOiBbe1xuXHRcdGlzT3B0aW9uYWw6IHRydWUsXG5cdFx0bmFtZTogJ2luZGV4Jyxcblx0XHRkZXNjcmlwdGlvbjogJ1RoZSBjZWxsIGluZGV4Jyxcblx0XHRzY2hlbWE6IHtcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQncmVxdWlyZWQnOiBbJ2luZGV4JywgJ2RpcmVjdGlvbiddLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdpbmRleCc6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdudW1iZXInXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdkaXJlY3Rpb24nOiB7XG5cdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0XHQnZW51bSc6IFsndXAnLCAnZG93biddLFxuXHRcdFx0XHRcdCdkZWZhdWx0JzogJ2Rvd24nXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdsZXZlbHMnOiB7XG5cdFx0XHRcdFx0J3R5cGUnOiAnbnVtYmVyJyxcblx0XHRcdFx0XHQnZGVmYXVsdCc6IDFcblx0XHRcdFx0fSxcblx0XHRcdH1cblx0XHR9XG5cdH1dXG59O1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdub3RlYm9vay5mb2xkJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ZvbGQuY2VsbCcsIFwiRm9sZCBDZWxsXCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IE5PVEVCT09LX0FDVElPTlNfQ0FURUdPUlksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChOT1RFQk9PS19FRElUT1JfRk9DVVNFRCwgQ29udGV4dEtleUV4cHIubm90KElucHV0Rm9jdXNlZENvbnRleHRLZXkpKSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkJyYWNrZXRMZWZ0LFxuXHRcdFx0XHRtYWM6IHtcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLkJyYWNrZXRMZWZ0LFxuXHRcdFx0XHRcdHNlY29uZGFyeTogW0tleUNvZGUuTGVmdEFycm93XSxcblx0XHRcdFx0fSxcblx0XHRcdFx0c2Vjb25kYXJ5OiBbS2V5Q29kZS5MZWZ0QXJyb3ddLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxuXHRcdFx0fSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBOT1RFQk9PS19GT0xEX0NPTU1BTkRfTEFCRUwsXG5cdFx0XHRcdGFyZ3M6IEZPTERJTkdfQ09NTUFORF9BUkdTLmFyZ3Ncblx0XHRcdH0sXG5cdFx0XHRwcmVjb25kaXRpb246IE5PVEVCT09LX0lTX0FDVElWRV9FRElUT1IsXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzPzogeyBpbmRleDogbnVtYmVyOyBsZXZlbHM6IG51bWJlcjsgZGlyZWN0aW9uOiAndXAnIHwgJ2Rvd24nIH0pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGVkaXRvciA9IGdldE5vdGVib29rRWRpdG9yRnJvbUVkaXRvclBhbmUoZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lKTtcblx0XHRpZiAoIWVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBsZXZlbHMgPSBhcmdzICYmIGFyZ3MubGV2ZWxzIHx8IDE7XG5cdFx0Y29uc3QgZGlyZWN0aW9uID0gYXJncyAmJiBhcmdzLmRpcmVjdGlvbiA9PT0gJ3VwJyA/ICd1cCcgOiAnZG93bic7XG5cdFx0bGV0IGluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRpZiAoYXJncykge1xuXHRcdFx0aW5kZXggPSBhcmdzLmluZGV4O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBhY3RpdmVDZWxsID0gZWRpdG9yLmdldEFjdGl2ZUNlbGwoKTtcblx0XHRcdGlmICghYWN0aXZlQ2VsbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpbmRleCA9IGVkaXRvci5nZXRDZWxsSW5kZXgoYWN0aXZlQ2VsbCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udHJvbGxlciA9IGVkaXRvci5nZXRDb250cmlidXRpb248Rm9sZGluZ0NvbnRyb2xsZXI+KEZvbGRpbmdDb250cm9sbGVyLmlkKTtcblx0XHRpZiAoaW5kZXggIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Y29uc3QgdGFyZ2V0Q2VsbCA9IChpbmRleCA8IDAgfHwgaW5kZXggPj0gZWRpdG9yLmdldExlbmd0aCgpKSA/IHVuZGVmaW5lZCA6IGVkaXRvci5jZWxsQXQoaW5kZXgpO1xuXHRcdFx0aWYgKHRhcmdldENlbGw/LmNlbGxLaW5kID09PSBDZWxsS2luZC5Db2RlICYmIGRpcmVjdGlvbiA9PT0gJ2Rvd24nKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGRpcmVjdGlvbiA9PT0gJ3VwJykge1xuXHRcdFx0XHRjb250cm9sbGVyLnNldEZvbGRpbmdTdGF0ZVVwKGluZGV4LCBDZWxsRm9sZGluZ1N0YXRlLkNvbGxhcHNlZCwgbGV2ZWxzKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnRyb2xsZXIuc2V0Rm9sZGluZ1N0YXRlRG93bihpbmRleCwgQ2VsbEZvbGRpbmdTdGF0ZS5Db2xsYXBzZWQsIGxldmVscyk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHZpZXdJbmRleCA9IGVkaXRvci5nZXRWaWV3TW9kZWwoKS5nZXROZWFyZXN0VmlzaWJsZUNlbGxJbmRleFVwd2FyZHMoaW5kZXgpO1xuXHRcdFx0ZWRpdG9yLmZvY3VzRWxlbWVudChlZGl0b3IuY2VsbEF0KHZpZXdJbmRleCkpO1xuXHRcdH1cblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ25vdGVib29rLnVuZm9sZCcsXG5cdFx0XHR0aXRsZTogTk9URUJPT0tfVU5GT0xEX0NPTU1BTkRfTEFCRUwsXG5cdFx0XHRjYXRlZ29yeTogTk9URUJPT0tfQUNUSU9OU19DQVRFR09SWSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKE5PVEVCT09LX0VESVRPUl9GT0NVU0VELCBDb250ZXh0S2V5RXhwci5ub3QoSW5wdXRGb2N1c2VkQ29udGV4dEtleSkpLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuQnJhY2tldFJpZ2h0LFxuXHRcdFx0XHRtYWM6IHtcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLkJyYWNrZXRSaWdodCxcblx0XHRcdFx0XHRzZWNvbmRhcnk6IFtLZXlDb2RlLlJpZ2h0QXJyb3ddLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRzZWNvbmRhcnk6IFtLZXlDb2RlLlJpZ2h0QXJyb3ddLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxuXHRcdFx0fSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBOT1RFQk9PS19VTkZPTERfQ09NTUFORF9MQUJFTCxcblx0XHRcdFx0YXJnczogRk9MRElOR19DT01NQU5EX0FSR1MuYXJnc1xuXHRcdFx0fSxcblx0XHRcdHByZWNvbmRpdGlvbjogTk9URUJPT0tfSVNfQUNUSVZFX0VESVRPUixcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZ3M/OiB7IGluZGV4OiBudW1iZXI7IGxldmVsczogbnVtYmVyOyBkaXJlY3Rpb246ICd1cCcgfCAnZG93bicgfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZWRpdG9yID0gZ2V0Tm90ZWJvb2tFZGl0b3JGcm9tRWRpdG9yUGFuZShlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmUpO1xuXHRcdGlmICghZWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGV2ZWxzID0gYXJncyAmJiBhcmdzLmxldmVscyB8fCAxO1xuXHRcdGNvbnN0IGRpcmVjdGlvbiA9IGFyZ3MgJiYgYXJncy5kaXJlY3Rpb24gPT09ICd1cCcgPyAndXAnIDogJ2Rvd24nO1xuXHRcdGxldCBpbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0aWYgKGFyZ3MpIHtcblx0XHRcdGluZGV4ID0gYXJncy5pbmRleDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgYWN0aXZlQ2VsbCA9IGVkaXRvci5nZXRBY3RpdmVDZWxsKCk7XG5cdFx0XHRpZiAoIWFjdGl2ZUNlbGwpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aW5kZXggPSBlZGl0b3IuZ2V0Q2VsbEluZGV4KGFjdGl2ZUNlbGwpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBlZGl0b3IuZ2V0Q29udHJpYnV0aW9uPEZvbGRpbmdDb250cm9sbGVyPihGb2xkaW5nQ29udHJvbGxlci5pZCk7XG5cdFx0aWYgKGluZGV4ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmIChkaXJlY3Rpb24gPT09ICd1cCcpIHtcblx0XHRcdFx0Y29udHJvbGxlci5zZXRGb2xkaW5nU3RhdGVVcChpbmRleCwgQ2VsbEZvbGRpbmdTdGF0ZS5FeHBhbmRlZCwgbGV2ZWxzKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnRyb2xsZXIuc2V0Rm9sZGluZ1N0YXRlRG93bihpbmRleCwgQ2VsbEZvbGRpbmdTdGF0ZS5FeHBhbmRlZCwgbGV2ZWxzKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFTLHlCQUF5QixpQ0FBaUM7QUFDbkUsU0FBa0YsaUNBQWlDLHdCQUF3QjtBQUMzSSxTQUFTLG9CQUFvQjtBQUFnQyxTQUFTLGdCQUFnQjtBQUV0RixTQUFTLG9DQUFvQztBQUM3QyxTQUFTLGlCQUFpQixlQUFlO0FBQ3pDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsU0FBUyxjQUFjO0FBQ2hDLFNBQVMsd0JBQXdCO0FBRWpDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsVUFBVSxp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
