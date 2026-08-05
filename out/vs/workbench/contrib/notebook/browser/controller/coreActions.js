import { URI } from "../../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, MenuRegistry } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { getNotebookEditorFromEditorPane, cellRangeToViewCells } from "../notebookBrowser.js";
import { INTERACTIVE_WINDOW_IS_ACTIVE_EDITOR, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_KERNEL_COUNT, NOTEBOOK_KERNEL_SOURCE_COUNT, REPL_NOTEBOOK_IS_ACTIVE_EDITOR } from "../../common/notebookContextKeys.js";
import { isICellRange } from "../../common/notebookRange.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { isEditorCommandsContext } from "../../../../common/editor.js";
import { INotebookEditorService } from "../services/notebookEditorService.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { MarshalledId } from "../../../../../base/common/marshallingIds.js";
import { isEqual } from "../../../../../base/common/resources.js";
const SELECT_KERNEL_ID = "_notebook.selectKernel";
const NOTEBOOK_ACTIONS_CATEGORY = localize2("notebookActions.category", "Notebook");
const CELL_TITLE_CELL_GROUP_ID = "inline/cell";
const CELL_TITLE_OUTPUT_GROUP_ID = "inline/output";
const NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT = KeybindingWeight.EditorContrib;
const NOTEBOOK_OUTPUT_WEBVIEW_ACTION_WEIGHT = KeybindingWeight.WorkbenchContrib + 1;
var CellToolbarOrder = /* @__PURE__ */ ((CellToolbarOrder2) => {
  CellToolbarOrder2[CellToolbarOrder2["RunSection"] = 0] = "RunSection";
  CellToolbarOrder2[CellToolbarOrder2["EditCell"] = 1] = "EditCell";
  CellToolbarOrder2[CellToolbarOrder2["ExecuteAboveCells"] = 2] = "ExecuteAboveCells";
  CellToolbarOrder2[CellToolbarOrder2["ExecuteCellAndBelow"] = 3] = "ExecuteCellAndBelow";
  CellToolbarOrder2[CellToolbarOrder2["SaveCell"] = 4] = "SaveCell";
  CellToolbarOrder2[CellToolbarOrder2["SplitCell"] = 5] = "SplitCell";
  CellToolbarOrder2[CellToolbarOrder2["ClearCellOutput"] = 6] = "ClearCellOutput";
  return CellToolbarOrder2;
})(CellToolbarOrder || {});
var CellOverflowToolbarGroups = /* @__PURE__ */ ((CellOverflowToolbarGroups2) => {
  CellOverflowToolbarGroups2["Copy"] = "1_copy";
  CellOverflowToolbarGroups2["Insert"] = "2_insert";
  CellOverflowToolbarGroups2["Edit"] = "3_edit";
  CellOverflowToolbarGroups2["Share"] = "4_share";
  return CellOverflowToolbarGroups2;
})(CellOverflowToolbarGroups || {});
function getContextFromActiveEditor(editorService) {
  const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
  if (!editor || !editor.hasModel()) {
    return;
  }
  const activeCell = editor.getActiveCell();
  const selectedCells = editor.getSelectionViewModels();
  return {
    cell: activeCell,
    selectedCells,
    notebookEditor: editor
  };
}
function getWidgetFromUri(accessor, uri) {
  const notebookEditorService = accessor.get(INotebookEditorService);
  const widget = notebookEditorService.listNotebookEditors().find((widget2) => widget2.hasModel() && widget2.textModel.uri.toString() === uri.toString());
  if (widget && widget.hasModel()) {
    return widget;
  }
  return void 0;
}
function getContextFromUri(accessor, context) {
  const uri = URI.revive(context);
  if (uri) {
    const widget = getWidgetFromUri(accessor, uri);
    if (widget) {
      return {
        notebookEditor: widget
      };
    }
  }
  return void 0;
}
function findTargetCellEditor(context, targetCell) {
  let foundEditor = void 0;
  for (const [, codeEditor] of context.notebookEditor.codeEditors) {
    if (isEqual(codeEditor.getModel()?.uri, targetCell.uri)) {
      foundEditor = codeEditor;
      break;
    }
  }
  return foundEditor;
}
class NotebookAction extends Action2 {
  constructor(desc) {
    if (desc.f1 !== false) {
      desc.f1 = false;
      const f1Menu = {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.or(NOTEBOOK_IS_ACTIVE_EDITOR, INTERACTIVE_WINDOW_IS_ACTIVE_EDITOR, REPL_NOTEBOOK_IS_ACTIVE_EDITOR)
      };
      if (!desc.menu) {
        desc.menu = [];
      } else if (!Array.isArray(desc.menu)) {
        desc.menu = [desc.menu];
      }
      desc.menu = [
        ...desc.menu,
        f1Menu
      ];
    }
    desc.category = NOTEBOOK_ACTIONS_CATEGORY;
    super(desc);
  }
  async run(accessor, context, ...additionalArgs) {
    sendEntryTelemetry(accessor, this.desc.id, context);
    if (!this.isNotebookActionContext(context)) {
      context = this.getEditorContextFromArgsOrActive(accessor, context, ...additionalArgs);
      if (!context) {
        return;
      }
    }
    return this.runWithContext(accessor, context);
  }
  isNotebookActionContext(context) {
    return !!context && !!context.notebookEditor;
  }
  getEditorContextFromArgsOrActive(accessor, context, ...additionalArgs) {
    return getContextFromActiveEditor(accessor.get(IEditorService));
  }
}
class NotebookMultiCellAction extends Action2 {
  constructor(desc) {
    if (desc.f1 !== false) {
      desc.f1 = false;
      const f1Menu = {
        id: MenuId.CommandPalette,
        when: NOTEBOOK_IS_ACTIVE_EDITOR
      };
      if (!desc.menu) {
        desc.menu = [];
      } else if (!Array.isArray(desc.menu)) {
        desc.menu = [desc.menu];
      }
      desc.menu = [
        ...desc.menu,
        f1Menu
      ];
    }
    desc.category = NOTEBOOK_ACTIONS_CATEGORY;
    super(desc);
  }
  parseArgs(accessor, ...args) {
    return void 0;
  }
  /**
   * The action/command args are resolved in following order
   * `run(accessor, cellToolbarContext)` from cell toolbar
   * `run(accessor, ...args)` from command service with arguments
   * `run(accessor, undefined)` from keyboard shortcuts, command palatte, etc
   */
  async run(accessor, ...additionalArgs) {
    const context = additionalArgs[0];
    sendEntryTelemetry(accessor, this.desc.id, context);
    const isFromCellToolbar = isCellToolbarContext(context);
    if (isFromCellToolbar) {
      return this.runWithContext(accessor, context);
    }
    const parsedArgs = this.parseArgs(accessor, ...additionalArgs);
    if (parsedArgs) {
      return this.runWithContext(accessor, parsedArgs);
    }
    const editor = getEditorFromArgsOrActivePane(accessor);
    if (editor) {
      const selectedCellRange = editor.getSelections().length === 0 ? [editor.getFocus()] : editor.getSelections();
      return this.runWithContext(accessor, {
        ui: false,
        notebookEditor: editor,
        selectedCells: cellRangeToViewCells(editor, selectedCellRange)
      });
    }
  }
}
class NotebookCellAction extends NotebookAction {
  isCellActionContext(context) {
    return !!context && !!context.notebookEditor && !!context.cell;
  }
  getCellContextFromArgs(accessor, context, ...additionalArgs) {
    return void 0;
  }
  async run(accessor, context, ...additionalArgs) {
    sendEntryTelemetry(accessor, this.desc.id, context);
    if (this.isCellActionContext(context)) {
      return this.runWithContext(accessor, context);
    }
    const contextFromArgs = this.getCellContextFromArgs(accessor, context, ...additionalArgs);
    if (contextFromArgs) {
      return this.runWithContext(accessor, contextFromArgs);
    }
    const activeEditorContext = this.getEditorContextFromArgsOrActive(accessor);
    if (this.isCellActionContext(activeEditorContext)) {
      return this.runWithContext(accessor, activeEditorContext);
    }
  }
}
const executeNotebookCondition = ContextKeyExpr.or(ContextKeyExpr.greater(NOTEBOOK_KERNEL_COUNT.key, 0), ContextKeyExpr.greater(NOTEBOOK_KERNEL_SOURCE_COUNT.key, 0));
function sendEntryTelemetry(accessor, id, context) {
  if (context) {
    const telemetryService = accessor.get(ITelemetryService);
    if (context.source) {
      telemetryService.publicLog2("workbenchActionExecuted", { id, from: context.source });
    } else if (URI.isUri(context)) {
      telemetryService.publicLog2("workbenchActionExecuted", { id, from: "cellEditorContextMenu" });
    } else if (context && "from" in context && context.from === "cellContainer") {
      telemetryService.publicLog2("workbenchActionExecuted", { id, from: "cellContainer" });
    } else {
      const from = isCellToolbarContext(context) ? "cellToolbar" : isEditorCommandsContext(context) ? "editorToolbar" : "other";
      telemetryService.publicLog2("workbenchActionExecuted", { id, from });
    }
  }
}
function isCellToolbarContext(context) {
  return !!context && !!context.notebookEditor && context.$mid === MarshalledId.NotebookCellActionContext;
}
function isMultiCellArgs(arg) {
  if (arg === void 0) {
    return false;
  }
  const ranges = arg.ranges;
  if (!ranges) {
    return false;
  }
  if (!Array.isArray(ranges) || ranges.some((range) => !isICellRange(range))) {
    return false;
  }
  if (arg.document) {
    const uri = URI.revive(arg.document);
    if (!uri) {
      return false;
    }
  }
  return true;
}
function getEditorFromArgsOrActivePane(accessor, context) {
  const editorFromUri = getContextFromUri(accessor, context)?.notebookEditor;
  if (editorFromUri) {
    return editorFromUri;
  }
  const editor = getNotebookEditorFromEditorPane(accessor.get(IEditorService).activeEditorPane);
  if (!editor || !editor.hasModel()) {
    return;
  }
  return editor;
}
function parseMultiCellExecutionArgs(accessor, ...args) {
  const firstArg = args[0];
  if (isMultiCellArgs(firstArg)) {
    const editor = getEditorFromArgsOrActivePane(accessor, firstArg.document);
    if (!editor) {
      return;
    }
    const ranges = firstArg.ranges;
    const selectedCells = ranges.map((range) => editor.getCellsInRange(range).slice(0)).flat();
    const autoReveal = firstArg.autoReveal;
    return {
      ui: false,
      notebookEditor: editor,
      selectedCells,
      autoReveal
    };
  }
  if (isICellRange(firstArg)) {
    const secondArg = args[1];
    const editor = getEditorFromArgsOrActivePane(accessor, secondArg);
    if (!editor) {
      return;
    }
    return {
      ui: false,
      notebookEditor: editor,
      selectedCells: editor.getCellsInRange(firstArg)
    };
  }
  const context = getContextFromActiveEditor(accessor.get(IEditorService));
  return context ? {
    ui: false,
    notebookEditor: context.notebookEditor,
    selectedCells: context.selectedCells ?? [],
    cell: context.cell
  } : void 0;
}
const cellExecutionArgs = [
  {
    isOptional: true,
    name: "options",
    description: "The cell range options",
    schema: {
      "type": "object",
      "required": ["ranges"],
      "properties": {
        "ranges": {
          "type": "array",
          items: [
            {
              "type": "object",
              "required": ["start", "end"],
              "properties": {
                "start": {
                  "type": "number"
                },
                "end": {
                  "type": "number"
                }
              }
            }
          ]
        },
        "document": {
          "type": "object",
          "description": "The document uri"
        },
        "autoReveal": {
          "type": "boolean",
          "description": "Whether the cell should be revealed into view automatically"
        }
      }
    }
  }
];
MenuRegistry.appendMenuItem(MenuId.NotebookCellTitle, {
  submenu: MenuId.NotebookCellInsert,
  title: localize("notebookMenu.insertCell", "Insert Cell"),
  group: "2_insert" /* Insert */,
  when: NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true)
});
MenuRegistry.appendMenuItem(MenuId.EditorContext, {
  submenu: MenuId.NotebookCellTitle,
  title: localize("notebookMenu.cellTitle", "Notebook Cell"),
  group: "2_insert" /* Insert */,
  when: NOTEBOOK_EDITOR_FOCUSED
});
MenuRegistry.appendMenuItem(MenuId.NotebookCellTitle, {
  title: localize("miShare", "Share"),
  submenu: MenuId.EditorContextShare,
  group: "4_share" /* Share */
});
export {
  CELL_TITLE_CELL_GROUP_ID,
  CELL_TITLE_OUTPUT_GROUP_ID,
  CellOverflowToolbarGroups,
  CellToolbarOrder,
  NOTEBOOK_ACTIONS_CATEGORY,
  NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT,
  NOTEBOOK_OUTPUT_WEBVIEW_ACTION_WEIGHT,
  NotebookAction,
  NotebookCellAction,
  NotebookMultiCellAction,
  SELECT_KERNEL_ID,
  cellExecutionArgs,
  executeNotebookCondition,
  findTargetCellEditor,
  getContextFromActiveEditor,
  getContextFromUri,
  getEditorFromArgsOrActivePane,
  parseMultiCellExecutionArgs
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyb2xsZXIvY29yZUFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBJQWN0aW9uMk9wdGlvbnMsIE1lbnVJZCwgTWVudVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgZ2V0Tm90ZWJvb2tFZGl0b3JGcm9tRWRpdG9yUGFuZSwgSUFjdGl2ZU5vdGVib29rRWRpdG9yLCBJQ2VsbFZpZXdNb2RlbCwgY2VsbFJhbmdlVG9WaWV3Q2VsbHMsIElDZWxsT3V0cHV0Vmlld01vZGVsIH0gZnJvbSAnLi4vbm90ZWJvb2tCcm93c2VyLmpzJztcbmltcG9ydCB7IElOVEVSQUNUSVZFX1dJTkRPV19JU19BQ1RJVkVfRURJVE9SLCBOT1RFQk9PS19FRElUT1JfRURJVEFCTEUsIE5PVEVCT09LX0VESVRPUl9GT0NVU0VELCBOT1RFQk9PS19JU19BQ1RJVkVfRURJVE9SLCBOT1RFQk9PS19LRVJORUxfQ09VTlQsIE5PVEVCT09LX0tFUk5FTF9TT1VSQ0VfQ09VTlQsIFJFUExfTk9URUJPT0tfSVNfQUNUSVZFX0VESVRPUiB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElDZWxsUmFuZ2UsIGlzSUNlbGxSYW5nZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va1JhbmdlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzRWRpdG9yQ29tbWFuZHNDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvbm90ZWJvb2tFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRDbGFzc2lmaWNhdGlvbiwgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgVHlwZUNvbnN0cmFpbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IHsgTWFyc2hhbGxlZElkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFyc2hhbGxpbmdJZHMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuXG4vLyBLZXJuZWwgQ29tbWFuZFxuZXhwb3J0IGNvbnN0IFNFTEVDVF9LRVJORUxfSUQgPSAnX25vdGVib29rLnNlbGVjdEtlcm5lbCc7XG5leHBvcnQgY29uc3QgTk9URUJPT0tfQUNUSU9OU19DQVRFR09SWSA9IGxvY2FsaXplMignbm90ZWJvb2tBY3Rpb25zLmNhdGVnb3J5JywgJ05vdGVib29rJyk7XG5cbmV4cG9ydCBjb25zdCBDRUxMX1RJVExFX0NFTExfR1JPVVBfSUQgPSAnaW5saW5lL2NlbGwnO1xuZXhwb3J0IGNvbnN0IENFTExfVElUTEVfT1VUUFVUX0dST1VQX0lEID0gJ2lubGluZS9vdXRwdXQnO1xuXG5leHBvcnQgY29uc3QgTk9URUJPT0tfRURJVE9SX1dJREdFVF9BQ1RJT05fV0VJR0hUID0gS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliOyAvLyBzbWFsbGVyIHRoYW4gU3VnZ2VzdCBXaWRnZXQsIGV0Y1xuZXhwb3J0IGNvbnN0IE5PVEVCT09LX09VVFBVVF9XRUJWSUVXX0FDVElPTl9XRUlHSFQgPSBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyAxOyAvLyBoaWdoZXIgdGhhbiBXb3JrYmVuY2ggY29udHJpYnV0aW9uIChzdWNoIGFzIE5vdGVib29rIExpc3QgVmlldyksIGV0Y1xuXG5leHBvcnQgY29uc3QgZW51bSBDZWxsVG9vbGJhck9yZGVyIHtcblx0UnVuU2VjdGlvbixcblx0RWRpdENlbGwsXG5cdEV4ZWN1dGVBYm92ZUNlbGxzLFxuXHRFeGVjdXRlQ2VsbEFuZEJlbG93LFxuXHRTYXZlQ2VsbCxcblx0U3BsaXRDZWxsLFxuXHRDbGVhckNlbGxPdXRwdXRcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gQ2VsbE92ZXJmbG93VG9vbGJhckdyb3VwcyB7XG5cdENvcHkgPSAnMV9jb3B5Jyxcblx0SW5zZXJ0ID0gJzJfaW5zZXJ0Jyxcblx0RWRpdCA9ICczX2VkaXQnLFxuXHRTaGFyZSA9ICc0X3NoYXJlJ1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOb3RlYm9va0FjdGlvbkNvbnRleHQge1xuXHRyZWFkb25seSBjZWxsPzogSUNlbGxWaWV3TW9kZWw7XG5cdHJlYWRvbmx5IG5vdGVib29rRWRpdG9yOiBJQWN0aXZlTm90ZWJvb2tFZGl0b3I7XG5cdHJlYWRvbmx5IHVpPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgc2VsZWN0ZWRDZWxscz86IHJlYWRvbmx5IElDZWxsVmlld01vZGVsW107XG5cdHJlYWRvbmx5IGF1dG9SZXZlYWw/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOb3RlYm9va0NlbGxUb29sYmFyQWN0aW9uQ29udGV4dCBleHRlbmRzIElOb3RlYm9va0FjdGlvbkNvbnRleHQge1xuXHRyZWFkb25seSB1aTogdHJ1ZTtcblx0cmVhZG9ubHkgY2VsbDogSUNlbGxWaWV3TW9kZWw7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGVib29rQ29tbWFuZENvbnRleHQgZXh0ZW5kcyBJTm90ZWJvb2tBY3Rpb25Db250ZXh0IHtcblx0cmVhZG9ubHkgdWk6IGZhbHNlO1xuXHRyZWFkb25seSBzZWxlY3RlZENlbGxzOiByZWFkb25seSBJQ2VsbFZpZXdNb2RlbFtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOb3RlYm9va0NlbGxBY3Rpb25Db250ZXh0IGV4dGVuZHMgSU5vdGVib29rQWN0aW9uQ29udGV4dCB7XG5cdGNlbGw6IElDZWxsVmlld01vZGVsO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOb3RlYm9va091dHB1dEFjdGlvbkNvbnRleHQgZXh0ZW5kcyBJTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dCB7XG5cdG91dHB1dFZpZXdNb2RlbDogSUNlbGxPdXRwdXRWaWV3TW9kZWw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDb250ZXh0RnJvbUFjdGl2ZUVkaXRvcihlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSk6IElOb3RlYm9va0FjdGlvbkNvbnRleHQgfCB1bmRlZmluZWQge1xuXHRjb25zdCBlZGl0b3IgPSBnZXROb3RlYm9va0VkaXRvckZyb21FZGl0b3JQYW5lKGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZSk7XG5cdGlmICghZWRpdG9yIHx8ICFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IGFjdGl2ZUNlbGwgPSBlZGl0b3IuZ2V0QWN0aXZlQ2VsbCgpO1xuXHRjb25zdCBzZWxlY3RlZENlbGxzID0gZWRpdG9yLmdldFNlbGVjdGlvblZpZXdNb2RlbHMoKTtcblx0cmV0dXJuIHtcblx0XHRjZWxsOiBhY3RpdmVDZWxsLFxuXHRcdHNlbGVjdGVkQ2VsbHMsXG5cdFx0bm90ZWJvb2tFZGl0b3I6IGVkaXRvclxuXHR9O1xufVxuXG5mdW5jdGlvbiBnZXRXaWRnZXRGcm9tVXJpKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB1cmk6IFVSSSkge1xuXHRjb25zdCBub3RlYm9va0VkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGVib29rRWRpdG9yU2VydmljZSk7XG5cdGNvbnN0IHdpZGdldCA9IG5vdGVib29rRWRpdG9yU2VydmljZS5saXN0Tm90ZWJvb2tFZGl0b3JzKCkuZmluZCh3aWRnZXQgPT4gd2lkZ2V0Lmhhc01vZGVsKCkgJiYgd2lkZ2V0LnRleHRNb2RlbC51cmkudG9TdHJpbmcoKSA9PT0gdXJpLnRvU3RyaW5nKCkpO1xuXG5cdGlmICh3aWRnZXQgJiYgd2lkZ2V0Lmhhc01vZGVsKCkpIHtcblx0XHRyZXR1cm4gd2lkZ2V0O1xuXHR9XG5cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENvbnRleHRGcm9tVXJpKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0PzogYW55KSB7XG5cdGNvbnN0IHVyaSA9IFVSSS5yZXZpdmUoY29udGV4dCk7XG5cblx0aWYgKHVyaSkge1xuXHRcdGNvbnN0IHdpZGdldCA9IGdldFdpZGdldEZyb21VcmkoYWNjZXNzb3IsIHVyaSk7XG5cblx0XHRpZiAod2lkZ2V0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRub3RlYm9va0VkaXRvcjogd2lkZ2V0LFxuXHRcdFx0fTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmluZFRhcmdldENlbGxFZGl0b3IoY29udGV4dDogSU5vdGVib29rQ2VsbEFjdGlvbkNvbnRleHQsIHRhcmdldENlbGw6IElDZWxsVmlld01vZGVsKSB7XG5cdGxldCBmb3VuZEVkaXRvcjogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGZvciAoY29uc3QgWywgY29kZUVkaXRvcl0gb2YgY29udGV4dC5ub3RlYm9va0VkaXRvci5jb2RlRWRpdG9ycykge1xuXHRcdGlmIChpc0VxdWFsKGNvZGVFZGl0b3IuZ2V0TW9kZWwoKT8udXJpLCB0YXJnZXRDZWxsLnVyaSkpIHtcblx0XHRcdGZvdW5kRWRpdG9yID0gY29kZUVkaXRvcjtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBmb3VuZEVkaXRvcjtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIE5vdGVib29rQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKGRlc2M6IElBY3Rpb24yT3B0aW9ucykge1xuXHRcdGlmIChkZXNjLmYxICE9PSBmYWxzZSkge1xuXHRcdFx0ZGVzYy5mMSA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgZjFNZW51ID0ge1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihOT1RFQk9PS19JU19BQ1RJVkVfRURJVE9SLCBJTlRFUkFDVElWRV9XSU5ET1dfSVNfQUNUSVZFX0VESVRPUiwgUkVQTF9OT1RFQk9PS19JU19BQ1RJVkVfRURJVE9SKVxuXHRcdFx0fTtcblxuXHRcdFx0aWYgKCFkZXNjLm1lbnUpIHtcblx0XHRcdFx0ZGVzYy5tZW51ID0gW107XG5cdFx0XHR9IGVsc2UgaWYgKCFBcnJheS5pc0FycmF5KGRlc2MubWVudSkpIHtcblx0XHRcdFx0ZGVzYy5tZW51ID0gW2Rlc2MubWVudV07XG5cdFx0XHR9XG5cblx0XHRcdGRlc2MubWVudSA9IFtcblx0XHRcdFx0Li4uZGVzYy5tZW51LFxuXHRcdFx0XHRmMU1lbnVcblx0XHRcdF07XG5cdFx0fVxuXG5cdFx0ZGVzYy5jYXRlZ29yeSA9IE5PVEVCT09LX0FDVElPTlNfQ0FURUdPUlk7XG5cblx0XHRzdXBlcihkZXNjKTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dD86IGFueSwgLi4uYWRkaXRpb25hbEFyZ3M6IGFueVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0c2VuZEVudHJ5VGVsZW1ldHJ5KGFjY2Vzc29yLCB0aGlzLmRlc2MuaWQsIGNvbnRleHQpO1xuXG5cdFx0aWYgKCF0aGlzLmlzTm90ZWJvb2tBY3Rpb25Db250ZXh0KGNvbnRleHQpKSB7XG5cdFx0XHRjb250ZXh0ID0gdGhpcy5nZXRFZGl0b3JDb250ZXh0RnJvbUFyZ3NPckFjdGl2ZShhY2Nlc3NvciwgY29udGV4dCwgLi4uYWRkaXRpb25hbEFyZ3MpO1xuXHRcdFx0aWYgKCFjb250ZXh0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5ydW5XaXRoQ29udGV4dChhY2Nlc3NvciwgY29udGV4dCk7XG5cdH1cblxuXHRhYnN0cmFjdCBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSU5vdGVib29rQWN0aW9uQ29udGV4dCk6IFByb21pc2U8dm9pZD47XG5cblx0cHJpdmF0ZSBpc05vdGVib29rQWN0aW9uQ29udGV4dChjb250ZXh0PzogdW5rbm93bik6IGNvbnRleHQgaXMgSU5vdGVib29rQWN0aW9uQ29udGV4dCB7XG5cdFx0cmV0dXJuICEhY29udGV4dCAmJiAhIShjb250ZXh0IGFzIElOb3RlYm9va0FjdGlvbkNvbnRleHQpLm5vdGVib29rRWRpdG9yO1xuXHR9XG5cblx0Z2V0RWRpdG9yQ29udGV4dEZyb21BcmdzT3JBY3RpdmUoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ/OiBhbnksIC4uLmFkZGl0aW9uYWxBcmdzOiBhbnlbXSk6IElOb3RlYm9va0FjdGlvbkNvbnRleHQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBnZXRDb250ZXh0RnJvbUFjdGl2ZUVkaXRvcihhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpKTtcblx0fVxufVxuXG4vLyB0b2RvQHJlYm9ybml4LCByZXBsYWNlIE5vdGVib29rQWN0aW9uIHdpdGggdGhpc1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIE5vdGVib29rTXVsdGlDZWxsQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKGRlc2M6IElBY3Rpb24yT3B0aW9ucykge1xuXHRcdGlmIChkZXNjLmYxICE9PSBmYWxzZSkge1xuXHRcdFx0ZGVzYy5mMSA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgZjFNZW51ID0ge1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBOT1RFQk9PS19JU19BQ1RJVkVfRURJVE9SXG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAoIWRlc2MubWVudSkge1xuXHRcdFx0XHRkZXNjLm1lbnUgPSBbXTtcblx0XHRcdH0gZWxzZSBpZiAoIUFycmF5LmlzQXJyYXkoZGVzYy5tZW51KSkge1xuXHRcdFx0XHRkZXNjLm1lbnUgPSBbZGVzYy5tZW51XTtcblx0XHRcdH1cblxuXHRcdFx0ZGVzYy5tZW51ID0gW1xuXHRcdFx0XHQuLi5kZXNjLm1lbnUsXG5cdFx0XHRcdGYxTWVudVxuXHRcdFx0XTtcblx0XHR9XG5cblx0XHRkZXNjLmNhdGVnb3J5ID0gTk9URUJPT0tfQUNUSU9OU19DQVRFR09SWTtcblxuXHRcdHN1cGVyKGRlc2MpO1xuXHR9XG5cblx0cGFyc2VBcmdzKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IElOb3RlYm9va0NvbW1hbmRDb250ZXh0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0YWJzdHJhY3QgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElOb3RlYm9va0NvbW1hbmRDb250ZXh0IHwgSU5vdGVib29rQ2VsbFRvb2xiYXJBY3Rpb25Db250ZXh0KTogUHJvbWlzZTx2b2lkPjtcblxuXHQvKipcblx0ICogVGhlIGFjdGlvbi9jb21tYW5kIGFyZ3MgYXJlIHJlc29sdmVkIGluIGZvbGxvd2luZyBvcmRlclxuXHQgKiBgcnVuKGFjY2Vzc29yLCBjZWxsVG9vbGJhckNvbnRleHQpYCBmcm9tIGNlbGwgdG9vbGJhclxuXHQgKiBgcnVuKGFjY2Vzc29yLCAuLi5hcmdzKWAgZnJvbSBjb21tYW5kIHNlcnZpY2Ugd2l0aCBhcmd1bWVudHNcblx0ICogYHJ1bihhY2Nlc3NvciwgdW5kZWZpbmVkKWAgZnJvbSBrZXlib2FyZCBzaG9ydGN1dHMsIGNvbW1hbmQgcGFsYXR0ZSwgZXRjXG5cdCAqL1xuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFkZGl0aW9uYWxBcmdzOiBhbnlbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbnRleHQgPSBhZGRpdGlvbmFsQXJnc1swXTtcblxuXHRcdHNlbmRFbnRyeVRlbGVtZXRyeShhY2Nlc3NvciwgdGhpcy5kZXNjLmlkLCBjb250ZXh0KTtcblxuXHRcdGNvbnN0IGlzRnJvbUNlbGxUb29sYmFyID0gaXNDZWxsVG9vbGJhckNvbnRleHQoY29udGV4dCk7XG5cdFx0aWYgKGlzRnJvbUNlbGxUb29sYmFyKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5ydW5XaXRoQ29udGV4dChhY2Nlc3NvciwgY29udGV4dCk7XG5cdFx0fVxuXG5cdFx0Ly8gaGFuZGxlIHBhcnNlZCBhcmdzXG5cdFx0Y29uc3QgcGFyc2VkQXJncyA9IHRoaXMucGFyc2VBcmdzKGFjY2Vzc29yLCAuLi5hZGRpdGlvbmFsQXJncyk7XG5cdFx0aWYgKHBhcnNlZEFyZ3MpIHtcblx0XHRcdHJldHVybiB0aGlzLnJ1bldpdGhDb250ZXh0KGFjY2Vzc29yLCBwYXJzZWRBcmdzKTtcblx0XHR9XG5cblx0XHQvLyBubyBwYXJzZWQgYXJncywgdHJ5IGhhbmRsZSBhY3RpdmUgZWRpdG9yXG5cdFx0Y29uc3QgZWRpdG9yID0gZ2V0RWRpdG9yRnJvbUFyZ3NPckFjdGl2ZVBhbmUoYWNjZXNzb3IpO1xuXHRcdGlmIChlZGl0b3IpIHtcblx0XHRcdGNvbnN0IHNlbGVjdGVkQ2VsbFJhbmdlOiBJQ2VsbFJhbmdlW10gPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpLmxlbmd0aCA9PT0gMCA/IFtlZGl0b3IuZ2V0Rm9jdXMoKV0gOiBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXG5cblx0XHRcdHJldHVybiB0aGlzLnJ1bldpdGhDb250ZXh0KGFjY2Vzc29yLCB7XG5cdFx0XHRcdHVpOiBmYWxzZSxcblx0XHRcdFx0bm90ZWJvb2tFZGl0b3I6IGVkaXRvcixcblx0XHRcdFx0c2VsZWN0ZWRDZWxsczogY2VsbFJhbmdlVG9WaWV3Q2VsbHMoZWRpdG9yLCBzZWxlY3RlZENlbGxSYW5nZSlcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgTm90ZWJvb2tDZWxsQWN0aW9uPFQgPSBJTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dD4gZXh0ZW5kcyBOb3RlYm9va0FjdGlvbiB7XG5cdHByb3RlY3RlZCBpc0NlbGxBY3Rpb25Db250ZXh0KGNvbnRleHQ/OiB1bmtub3duKTogY29udGV4dCBpcyBJTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dCB7XG5cdFx0cmV0dXJuICEhY29udGV4dCAmJiAhIShjb250ZXh0IGFzIElOb3RlYm9va0NlbGxBY3Rpb25Db250ZXh0KS5ub3RlYm9va0VkaXRvciAmJiAhIShjb250ZXh0IGFzIElOb3RlYm9va0NlbGxBY3Rpb25Db250ZXh0KS5jZWxsO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldENlbGxDb250ZXh0RnJvbUFyZ3MoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ/OiBULCAuLi5hZGRpdGlvbmFsQXJnczogYW55W10pOiBJTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dD86IElOb3RlYm9va0NlbGxBY3Rpb25Db250ZXh0LCAuLi5hZGRpdGlvbmFsQXJnczogYW55W10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRzZW5kRW50cnlUZWxlbWV0cnkoYWNjZXNzb3IsIHRoaXMuZGVzYy5pZCwgY29udGV4dCk7XG5cblx0XHRpZiAodGhpcy5pc0NlbGxBY3Rpb25Db250ZXh0KGNvbnRleHQpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5ydW5XaXRoQ29udGV4dChhY2Nlc3NvciwgY29udGV4dCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udGV4dEZyb21BcmdzID0gdGhpcy5nZXRDZWxsQ29udGV4dEZyb21BcmdzKGFjY2Vzc29yLCBjb250ZXh0LCAuLi5hZGRpdGlvbmFsQXJncyk7XG5cblx0XHRpZiAoY29udGV4dEZyb21BcmdzKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5ydW5XaXRoQ29udGV4dChhY2Nlc3NvciwgY29udGV4dEZyb21BcmdzKTtcblx0XHR9XG5cblx0XHRjb25zdCBhY3RpdmVFZGl0b3JDb250ZXh0ID0gdGhpcy5nZXRFZGl0b3JDb250ZXh0RnJvbUFyZ3NPckFjdGl2ZShhY2Nlc3Nvcik7XG5cdFx0aWYgKHRoaXMuaXNDZWxsQWN0aW9uQ29udGV4dChhY3RpdmVFZGl0b3JDb250ZXh0KSkge1xuXHRcdFx0cmV0dXJuIHRoaXMucnVuV2l0aENvbnRleHQoYWNjZXNzb3IsIGFjdGl2ZUVkaXRvckNvbnRleHQpO1xuXHRcdH1cblx0fVxuXG5cdGFic3RyYWN0IG92ZXJyaWRlIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dCk6IFByb21pc2U8dm9pZD47XG59XG5cbmV4cG9ydCBjb25zdCBleGVjdXRlTm90ZWJvb2tDb25kaXRpb24gPSBDb250ZXh0S2V5RXhwci5vcihDb250ZXh0S2V5RXhwci5ncmVhdGVyKE5PVEVCT09LX0tFUk5FTF9DT1VOVC5rZXksIDApLCBDb250ZXh0S2V5RXhwci5ncmVhdGVyKE5PVEVCT09LX0tFUk5FTF9TT1VSQ0VfQ09VTlQua2V5LCAwKSk7XG5cbmludGVyZmFjZSBJTXVsdGlDZWxsQXJncyB7XG5cdHJhbmdlczogSUNlbGxSYW5nZVtdO1xuXHRkb2N1bWVudD86IFVSSTtcblx0YXV0b1JldmVhbD86IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIHNlbmRFbnRyeVRlbGVtZXRyeShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgaWQ6IHN0cmluZywgY29udGV4dD86IGFueSkge1xuXHRpZiAoY29udGV4dCkge1xuXHRcdGNvbnN0IHRlbGVtZXRyeVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRlbGVtZXRyeVNlcnZpY2UpO1xuXHRcdGlmIChjb250ZXh0LnNvdXJjZSkge1xuXHRcdFx0dGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkRXZlbnQsIFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkQ2xhc3NpZmljYXRpb24+KCd3b3JrYmVuY2hBY3Rpb25FeGVjdXRlZCcsIHsgaWQ6IGlkLCBmcm9tOiBjb250ZXh0LnNvdXJjZSB9KTtcblx0XHR9IGVsc2UgaWYgKFVSSS5pc1VyaShjb250ZXh0KSkge1xuXHRcdFx0dGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkRXZlbnQsIFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkQ2xhc3NpZmljYXRpb24+KCd3b3JrYmVuY2hBY3Rpb25FeGVjdXRlZCcsIHsgaWQ6IGlkLCBmcm9tOiAnY2VsbEVkaXRvckNvbnRleHRNZW51JyB9KTtcblx0XHR9IGVsc2UgaWYgKGNvbnRleHQgJiYgJ2Zyb20nIGluIGNvbnRleHQgJiYgY29udGV4dC5mcm9tID09PSAnY2VsbENvbnRhaW5lcicpIHtcblx0XHRcdHRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uPignd29ya2JlbmNoQWN0aW9uRXhlY3V0ZWQnLCB7IGlkOiBpZCwgZnJvbTogJ2NlbGxDb250YWluZXInIH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBmcm9tID0gaXNDZWxsVG9vbGJhckNvbnRleHQoY29udGV4dCkgPyAnY2VsbFRvb2xiYXInIDogKGlzRWRpdG9yQ29tbWFuZHNDb250ZXh0KGNvbnRleHQpID8gJ2VkaXRvclRvb2xiYXInIDogJ290aGVyJyk7XG5cdFx0XHR0ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8V29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRFdmVudCwgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRDbGFzc2lmaWNhdGlvbj4oJ3dvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkJywgeyBpZDogaWQsIGZyb206IGZyb20gfSk7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIGlzQ2VsbFRvb2xiYXJDb250ZXh0KGNvbnRleHQ/OiB1bmtub3duKTogY29udGV4dCBpcyBJTm90ZWJvb2tDZWxsVG9vbGJhckFjdGlvbkNvbnRleHQge1xuXHRyZXR1cm4gISFjb250ZXh0ICYmICEhKGNvbnRleHQgYXMgSU5vdGVib29rQWN0aW9uQ29udGV4dCkubm90ZWJvb2tFZGl0b3IgJiYgKGNvbnRleHQgYXMgYW55KS4kbWlkID09PSBNYXJzaGFsbGVkSWQuTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dDtcbn1cblxuZnVuY3Rpb24gaXNNdWx0aUNlbGxBcmdzKGFyZzogdW5rbm93bik6IGFyZyBpcyBJTXVsdGlDZWxsQXJncyB7XG5cdGlmIChhcmcgPT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRjb25zdCByYW5nZXMgPSAoYXJnIGFzIElNdWx0aUNlbGxBcmdzKS5yYW5nZXM7XG5cdGlmICghcmFuZ2VzKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKCFBcnJheS5pc0FycmF5KHJhbmdlcykgfHwgcmFuZ2VzLnNvbWUocmFuZ2UgPT4gIWlzSUNlbGxSYW5nZShyYW5nZSkpKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKChhcmcgYXMgSU11bHRpQ2VsbEFyZ3MpLmRvY3VtZW50KSB7XG5cdFx0Y29uc3QgdXJpID0gVVJJLnJldml2ZSgoYXJnIGFzIElNdWx0aUNlbGxBcmdzKS5kb2N1bWVudCk7XG5cblx0XHRpZiAoIXVyaSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RWRpdG9yRnJvbUFyZ3NPckFjdGl2ZVBhbmUoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ/OiBVcmlDb21wb25lbnRzKTogSUFjdGl2ZU5vdGVib29rRWRpdG9yIHwgdW5kZWZpbmVkIHtcblx0Y29uc3QgZWRpdG9yRnJvbVVyaSA9IGdldENvbnRleHRGcm9tVXJpKGFjY2Vzc29yLCBjb250ZXh0KT8ubm90ZWJvb2tFZGl0b3I7XG5cblx0aWYgKGVkaXRvckZyb21VcmkpIHtcblx0XHRyZXR1cm4gZWRpdG9yRnJvbVVyaTtcblx0fVxuXG5cdGNvbnN0IGVkaXRvciA9IGdldE5vdGVib29rRWRpdG9yRnJvbUVkaXRvclBhbmUoYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKS5hY3RpdmVFZGl0b3JQYW5lKTtcblx0aWYgKCFlZGl0b3IgfHwgIWVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cmV0dXJuIGVkaXRvcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTXVsdGlDZWxsRXhlY3V0aW9uQXJncyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pOiBJTm90ZWJvb2tDb21tYW5kQ29udGV4dCB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGZpcnN0QXJnID0gYXJnc1swXTtcblxuXHRpZiAoaXNNdWx0aUNlbGxBcmdzKGZpcnN0QXJnKSkge1xuXHRcdGNvbnN0IGVkaXRvciA9IGdldEVkaXRvckZyb21BcmdzT3JBY3RpdmVQYW5lKGFjY2Vzc29yLCBmaXJzdEFyZy5kb2N1bWVudCk7XG5cdFx0aWYgKCFlZGl0b3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCByYW5nZXMgPSBmaXJzdEFyZy5yYW5nZXM7XG5cdFx0Y29uc3Qgc2VsZWN0ZWRDZWxscyA9IHJhbmdlcy5tYXAocmFuZ2UgPT4gZWRpdG9yLmdldENlbGxzSW5SYW5nZShyYW5nZSkuc2xpY2UoMCkpLmZsYXQoKTtcblx0XHRjb25zdCBhdXRvUmV2ZWFsID0gZmlyc3RBcmcuYXV0b1JldmVhbDtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dWk6IGZhbHNlLFxuXHRcdFx0bm90ZWJvb2tFZGl0b3I6IGVkaXRvcixcblx0XHRcdHNlbGVjdGVkQ2VsbHMsXG5cdFx0XHRhdXRvUmV2ZWFsXG5cdFx0fTtcblx0fVxuXG5cdC8vIGhhbmRsZSBsZWdhY3kgYXJndW1lbnRzXG5cdGlmIChpc0lDZWxsUmFuZ2UoZmlyc3RBcmcpKSB7XG5cdFx0Ly8gY2VsbFJhbmdlLCBkb2N1bWVudFxuXHRcdGNvbnN0IHNlY29uZEFyZyA9IGFyZ3NbMV07XG5cdFx0Y29uc3QgZWRpdG9yID0gZ2V0RWRpdG9yRnJvbUFyZ3NPckFjdGl2ZVBhbmUoYWNjZXNzb3IsIHNlY29uZEFyZyk7XG5cdFx0aWYgKCFlZGl0b3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0dWk6IGZhbHNlLFxuXHRcdFx0bm90ZWJvb2tFZGl0b3I6IGVkaXRvcixcblx0XHRcdHNlbGVjdGVkQ2VsbHM6IGVkaXRvci5nZXRDZWxsc0luUmFuZ2UoZmlyc3RBcmcpXG5cdFx0fTtcblx0fVxuXG5cdC8vIGxldCdzIGp1c3QgZXhlY3V0ZSB0aGUgYWN0aXZlIGNlbGxcblx0Y29uc3QgY29udGV4dCA9IGdldENvbnRleHRGcm9tQWN0aXZlRWRpdG9yKGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSkpO1xuXHRyZXR1cm4gY29udGV4dCA/IHtcblx0XHR1aTogZmFsc2UsXG5cdFx0bm90ZWJvb2tFZGl0b3I6IGNvbnRleHQubm90ZWJvb2tFZGl0b3IsXG5cdFx0c2VsZWN0ZWRDZWxsczogY29udGV4dC5zZWxlY3RlZENlbGxzID8/IFtdLFxuXHRcdGNlbGw6IGNvbnRleHQuY2VsbFxuXHR9IDogdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgY29uc3QgY2VsbEV4ZWN1dGlvbkFyZ3M6IFJlYWRvbmx5QXJyYXk8e1xuXHRyZWFkb25seSBuYW1lOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGlzT3B0aW9uYWw/OiBib29sZWFuO1xuXHRyZWFkb25seSBkZXNjcmlwdGlvbj86IHN0cmluZztcblx0cmVhZG9ubHkgY29uc3RyYWludD86IFR5cGVDb25zdHJhaW50O1xuXHRyZWFkb25seSBzY2hlbWE/OiBJSlNPTlNjaGVtYTtcbn0+ID0gW1xuXHRcdHtcblx0XHRcdGlzT3B0aW9uYWw6IHRydWUsXG5cdFx0XHRuYW1lOiAnb3B0aW9ucycsXG5cdFx0XHRkZXNjcmlwdGlvbjogJ1RoZSBjZWxsIHJhbmdlIG9wdGlvbnMnLFxuXHRcdFx0c2NoZW1hOiB7XG5cdFx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHRcdCdyZXF1aXJlZCc6IFsncmFuZ2VzJ10sXG5cdFx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHRcdCdyYW5nZXMnOiB7XG5cdFx0XHRcdFx0XHQndHlwZSc6ICdhcnJheScsXG5cdFx0XHRcdFx0XHRpdGVtczogW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdFx0XHQncmVxdWlyZWQnOiBbJ3N0YXJ0JywgJ2VuZCddLFxuXHRcdFx0XHRcdFx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0J3N0YXJ0Jzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZSc6ICdudW1iZXInXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0J2VuZCc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnbnVtYmVyJ1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0J2RvY3VtZW50Jzoge1xuXHRcdFx0XHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6ICdUaGUgZG9jdW1lbnQgdXJpJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdCdhdXRvUmV2ZWFsJzoge1xuXHRcdFx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiAnV2hldGhlciB0aGUgY2VsbCBzaG91bGQgYmUgcmV2ZWFsZWQgaW50byB2aWV3IGF1dG9tYXRpY2FsbHknXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRdO1xuXG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTm90ZWJvb2tDZWxsVGl0bGUsIHtcblx0c3VibWVudTogTWVudUlkLk5vdGVib29rQ2VsbEluc2VydCxcblx0dGl0bGU6IGxvY2FsaXplKCdub3RlYm9va01lbnUuaW5zZXJ0Q2VsbCcsIFwiSW5zZXJ0IENlbGxcIiksXG5cdGdyb3VwOiBDZWxsT3ZlcmZsb3dUb29sYmFyR3JvdXBzLkluc2VydCxcblx0d2hlbjogTk9URUJPT0tfRURJVE9SX0VESVRBQkxFLmlzRXF1YWxUbyh0cnVlKVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yQ29udGV4dCwge1xuXHRzdWJtZW51OiBNZW51SWQuTm90ZWJvb2tDZWxsVGl0bGUsXG5cdHRpdGxlOiBsb2NhbGl6ZSgnbm90ZWJvb2tNZW51LmNlbGxUaXRsZScsIFwiTm90ZWJvb2sgQ2VsbFwiKSxcblx0Z3JvdXA6IENlbGxPdmVyZmxvd1Rvb2xiYXJHcm91cHMuSW5zZXJ0LFxuXHR3aGVuOiBOT1RFQk9PS19FRElUT1JfRk9DVVNFRFxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTm90ZWJvb2tDZWxsVGl0bGUsIHtcblx0dGl0bGU6IGxvY2FsaXplKCdtaVNoYXJlJywgXCJTaGFyZVwiKSxcblx0c3VibWVudTogTWVudUlkLkVkaXRvckNvbnRleHRTaGFyZSxcblx0Z3JvdXA6IENlbGxPdmVyZmxvd1Rvb2xiYXJHcm91cHMuU2hhcmVcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxXQUEwQjtBQUNuQyxTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQVMsU0FBMEIsUUFBUSxvQkFBb0I7QUFDL0QsU0FBUyxzQkFBc0I7QUFFL0IsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxpQ0FBd0UsNEJBQWtEO0FBQ25JLFNBQVMscUNBQXFDLDBCQUEwQix5QkFBeUIsMkJBQTJCLHVCQUF1Qiw4QkFBOEIsc0NBQXNDO0FBQ3ZOLFNBQXFCLG9CQUFvQjtBQUN6QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLHlCQUF5QjtBQUlsQyxTQUFTLG9CQUFvQjtBQUU3QixTQUFTLGVBQWU7QUFHakIsTUFBTSxtQkFBbUI7QUFDekIsTUFBTSw0QkFBNEIsVUFBVSw0QkFBNEIsVUFBVTtBQUVsRixNQUFNLDJCQUEyQjtBQUNqQyxNQUFNLDZCQUE2QjtBQUVuQyxNQUFNLHVDQUF1QyxpQkFBaUI7QUFDOUQsTUFBTSx3Q0FBd0MsaUJBQWlCLG1CQUFtQjtBQUVsRixJQUFXLG1CQUFYLGtCQUFXQSxzQkFBWDtBQUNOLEVBQUFBLG9DQUFBO0FBQ0EsRUFBQUEsb0NBQUE7QUFDQSxFQUFBQSxvQ0FBQTtBQUNBLEVBQUFBLG9DQUFBO0FBQ0EsRUFBQUEsb0NBQUE7QUFDQSxFQUFBQSxvQ0FBQTtBQUNBLEVBQUFBLG9DQUFBO0FBUGlCLFNBQUFBO0FBQUEsR0FBQTtBQVVYLElBQVcs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
