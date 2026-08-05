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
import { ActionViewItem } from "../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Action } from "../../../../../base/common/actions.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { NOTEBOOK_ACTIONS_CATEGORY, SELECT_KERNEL_ID } from "../controller/coreActions.js";
import { getNotebookEditorFromEditorPane } from "../notebookBrowser.js";
import { selectKernelIcon } from "../notebookIcons.js";
import { KernelPickerMRUStrategy } from "./notebookKernelQuickPickStrategy.js";
import { NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_KERNEL_COUNT } from "../../common/notebookContextKeys.js";
import { INotebookKernelHistoryService, INotebookKernelService } from "../../common/notebookKernelService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
function getEditorFromContext(editorService, context) {
  let editor;
  if (context !== void 0 && "notebookEditorId" in context) {
    const editorId = context.notebookEditorId;
    const matchingEditor = editorService.visibleEditorPanes.find((editorPane) => {
      const notebookEditor = getNotebookEditorFromEditorPane(editorPane);
      return notebookEditor?.getId() === editorId;
    });
    editor = getNotebookEditorFromEditorPane(matchingEditor);
  } else if (context !== void 0 && "notebookEditor" in context) {
    editor = context?.notebookEditor;
  } else {
    editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
  }
  return editor;
}
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: SELECT_KERNEL_ID,
      category: NOTEBOOK_ACTIONS_CATEGORY,
      title: localize2("notebookActions.selectKernel", "Select Notebook Kernel"),
      icon: selectKernelIcon,
      f1: true,
      precondition: NOTEBOOK_IS_ACTIVE_EDITOR,
      menu: [{
        id: MenuId.EditorTitle,
        when: ContextKeyExpr.and(
          NOTEBOOK_IS_ACTIVE_EDITOR,
          ContextKeyExpr.notEquals("config.notebook.globalToolbar", true)
        ),
        group: "navigation",
        order: -10
      }, {
        id: MenuId.NotebookToolbar,
        when: ContextKeyExpr.equals("config.notebook.globalToolbar", true),
        group: "status",
        order: -10
      }, {
        id: MenuId.InteractiveToolbar,
        when: NOTEBOOK_KERNEL_COUNT.notEqualsTo(0),
        group: "status",
        order: -10
      }],
      metadata: {
        description: localize("notebookActions.selectKernel.args", "Notebook Kernel Args"),
        args: [
          {
            name: "kernelInfo",
            description: "The kernel info",
            schema: {
              "type": "object",
              "required": ["id", "extension"],
              "properties": {
                "id": {
                  "type": "string"
                },
                "extension": {
                  "type": "string"
                },
                "notebookEditorId": {
                  "type": "string"
                }
              }
            }
          }
        ]
      }
    });
  }
  async run(accessor, context) {
    const instantiationService = accessor.get(IInstantiationService);
    const editorService = accessor.get(IEditorService);
    const editor = getEditorFromContext(editorService, context);
    if (!editor || !editor.hasModel()) {
      return false;
    }
    let controllerId = context && "id" in context ? context.id : void 0;
    let extensionId = context && "extension" in context ? context.extension : void 0;
    if (controllerId && (typeof controllerId !== "string" || typeof extensionId !== "string")) {
      controllerId = void 0;
      extensionId = void 0;
    }
    const notebook = editor.textModel;
    const notebookKernelService = accessor.get(INotebookKernelService);
    const matchResult = notebookKernelService.getMatchingKernel(notebook);
    const { selected } = matchResult;
    if (selected && controllerId && selected.id === controllerId && ExtensionIdentifier.equals(selected.extension, extensionId)) {
      return true;
    }
    const wantedKernelId = controllerId ? `${extensionId}/${controllerId}` : void 0;
    const strategy = instantiationService.createInstance(KernelPickerMRUStrategy);
    return strategy.showQuickPick(editor, wantedKernelId);
  }
});
let NotebooKernelActionViewItem = class extends ActionViewItem {
  constructor(actualAction, _editor, options, _notebookKernelService, _notebookKernelHistoryService) {
    const action = new Action("fakeAction", void 0, ThemeIcon.asClassName(selectKernelIcon), true, (event) => actualAction.run(event));
    super(
      void 0,
      action,
      { ...options, label: false, icon: true }
    );
    this._editor = _editor;
    this._notebookKernelService = _notebookKernelService;
    this._notebookKernelHistoryService = _notebookKernelHistoryService;
    this._register(action);
    this._register(_editor.onDidChangeModel(this._update, this));
    this._register(_notebookKernelService.onDidAddKernel(this._update, this));
    this._register(_notebookKernelService.onDidRemoveKernel(this._update, this));
    this._register(_notebookKernelService.onDidChangeNotebookAffinity(this._update, this));
    this._register(_notebookKernelService.onDidChangeSelectedNotebooks(this._update, this));
    this._register(_notebookKernelService.onDidChangeSourceActions(this._update, this));
    this._register(_notebookKernelService.onDidChangeKernelDetectionTasks(this._update, this));
  }
  render(container) {
    this._update();
    super.render(container);
    container.classList.add("kernel-action-view-item");
    this._kernelLabel = document.createElement("a");
    container.appendChild(this._kernelLabel);
    this.updateLabel();
  }
  updateLabel() {
    if (this._kernelLabel) {
      this._kernelLabel.classList.add("kernel-label");
      this._kernelLabel.innerText = this._action.label;
    }
  }
  _update() {
    const notebook = this._editor.textModel;
    if (!notebook) {
      this._resetAction();
      return;
    }
    KernelPickerMRUStrategy.updateKernelStatusAction(notebook, this._action, this._notebookKernelService, this._notebookKernelHistoryService);
    this.updateClass();
  }
  _resetAction() {
    this._action.enabled = false;
    this._action.label = "";
    this._action.class = "";
  }
};
NotebooKernelActionViewItem = __decorateClass([
  __decorateParam(3, INotebookKernelService),
  __decorateParam(4, INotebookKernelHistoryService)
], NotebooKernelActionViewItem);
export {
  NotebooKernelActionViewItem
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXdQYXJ0cy9ub3RlYm9va0tlcm5lbFZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBBY3Rpb25WaWV3SXRlbSwgSUFjdGlvblZpZXdJdGVtT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uVmlld0l0ZW1zLmpzJztcbmltcG9ydCB7IEFjdGlvbiwgSUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBOT1RFQk9PS19BQ1RJT05TX0NBVEVHT1JZLCBTRUxFQ1RfS0VSTkVMX0lEIH0gZnJvbSAnLi4vY29udHJvbGxlci9jb3JlQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBnZXROb3RlYm9va0VkaXRvckZyb21FZGl0b3JQYW5lLCBJTm90ZWJvb2tFZGl0b3IgfSBmcm9tICcuLi9ub3RlYm9va0Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgc2VsZWN0S2VybmVsSWNvbiB9IGZyb20gJy4uL25vdGVib29rSWNvbnMuanMnO1xuaW1wb3J0IHsgS2VybmVsUGlja2VyTVJVU3RyYXRlZ3ksIEtlcm5lbFF1aWNrUGlja0NvbnRleHQgfSBmcm9tICcuL25vdGVib29rS2VybmVsUXVpY2tQaWNrU3RyYXRlZ3kuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi9jb21tb24vbW9kZWwvbm90ZWJvb2tUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgTk9URUJPT0tfSVNfQUNUSVZFX0VESVRPUiwgTk9URUJPT0tfS0VSTkVMX0NPVU5UIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rS2VybmVsSGlzdG9yeVNlcnZpY2UsIElOb3RlYm9va0tlcm5lbFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcblxuZnVuY3Rpb24gZ2V0RWRpdG9yRnJvbUNvbnRleHQoZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsIGNvbnRleHQ/OiBLZXJuZWxRdWlja1BpY2tDb250ZXh0KTogSU5vdGVib29rRWRpdG9yIHwgdW5kZWZpbmVkIHtcblx0bGV0IGVkaXRvcjogSU5vdGVib29rRWRpdG9yIHwgdW5kZWZpbmVkO1xuXHRpZiAoY29udGV4dCAhPT0gdW5kZWZpbmVkICYmICdub3RlYm9va0VkaXRvcklkJyBpbiBjb250ZXh0KSB7XG5cdFx0Y29uc3QgZWRpdG9ySWQgPSBjb250ZXh0Lm5vdGVib29rRWRpdG9ySWQ7XG5cdFx0Y29uc3QgbWF0Y2hpbmdFZGl0b3IgPSBlZGl0b3JTZXJ2aWNlLnZpc2libGVFZGl0b3JQYW5lcy5maW5kKChlZGl0b3JQYW5lKSA9PiB7XG5cdFx0XHRjb25zdCBub3RlYm9va0VkaXRvciA9IGdldE5vdGVib29rRWRpdG9yRnJvbUVkaXRvclBhbmUoZWRpdG9yUGFuZSk7XG5cdFx0XHRyZXR1cm4gbm90ZWJvb2tFZGl0b3I/LmdldElkKCkgPT09IGVkaXRvcklkO1xuXHRcdH0pO1xuXHRcdGVkaXRvciA9IGdldE5vdGVib29rRWRpdG9yRnJvbUVkaXRvclBhbmUobWF0Y2hpbmdFZGl0b3IpO1xuXHR9IGVsc2UgaWYgKGNvbnRleHQgIT09IHVuZGVmaW5lZCAmJiAnbm90ZWJvb2tFZGl0b3InIGluIGNvbnRleHQpIHtcblx0XHRlZGl0b3IgPSBjb250ZXh0Py5ub3RlYm9va0VkaXRvcjtcblx0fSBlbHNlIHtcblx0XHRlZGl0b3IgPSBnZXROb3RlYm9va0VkaXRvckZyb21FZGl0b3JQYW5lKGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZSk7XG5cdH1cblxuXHRyZXR1cm4gZWRpdG9yO1xufVxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFNFTEVDVF9LRVJORUxfSUQsXG5cdFx0XHRjYXRlZ29yeTogTk9URUJPT0tfQUNUSU9OU19DQVRFR09SWSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ25vdGVib29rQWN0aW9ucy5zZWxlY3RLZXJuZWwnLCAnU2VsZWN0IE5vdGVib29rIEtlcm5lbCcpLFxuXHRcdFx0aWNvbjogc2VsZWN0S2VybmVsSWNvbixcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBOT1RFQk9PS19JU19BQ1RJVkVfRURJVE9SLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5FZGl0b3JUaXRsZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdE5PVEVCT09LX0lTX0FDVElWRV9FRElUT1IsXG5cdFx0XHRcdFx0Q29udGV4dEtleUV4cHIubm90RXF1YWxzKCdjb25maWcubm90ZWJvb2suZ2xvYmFsVG9vbGJhcicsIHRydWUpXG5cdFx0XHRcdCksXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAtMTBcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5Ob3RlYm9va1Rvb2xiYXIsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLm5vdGVib29rLmdsb2JhbFRvb2xiYXInLCB0cnVlKSxcblx0XHRcdFx0Z3JvdXA6ICdzdGF0dXMnLFxuXHRcdFx0XHRvcmRlcjogLTEwXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBNZW51SWQuSW50ZXJhY3RpdmVUb29sYmFyLFxuXHRcdFx0XHR3aGVuOiBOT1RFQk9PS19LRVJORUxfQ09VTlQubm90RXF1YWxzVG8oMCksXG5cdFx0XHRcdGdyb3VwOiAnc3RhdHVzJyxcblx0XHRcdFx0b3JkZXI6IC0xMFxuXHRcdFx0fV0sXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ25vdGVib29rQWN0aW9ucy5zZWxlY3RLZXJuZWwuYXJncycsIFwiTm90ZWJvb2sgS2VybmVsIEFyZ3NcIiksXG5cdFx0XHRcdGFyZ3M6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAna2VybmVsSW5mbycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ1RoZSBrZXJuZWwgaW5mbycsXG5cdFx0XHRcdFx0XHRzY2hlbWE6IHtcblx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdFx0J3JlcXVpcmVkJzogWydpZCcsICdleHRlbnNpb24nXSxcblx0XHRcdFx0XHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdFx0XHRcdFx0J2lkJzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0J2V4dGVuc2lvbic6IHtcblx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdCdub3RlYm9va0VkaXRvcklkJzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dD86IEtlcm5lbFF1aWNrUGlja0NvbnRleHQpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZWRpdG9yID0gZ2V0RWRpdG9yRnJvbUNvbnRleHQoZWRpdG9yU2VydmljZSwgY29udGV4dCk7XG5cblx0XHRpZiAoIWVkaXRvciB8fCAhZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRsZXQgY29udHJvbGxlcklkID0gY29udGV4dCAmJiAnaWQnIGluIGNvbnRleHQgPyBjb250ZXh0LmlkIDogdW5kZWZpbmVkO1xuXHRcdGxldCBleHRlbnNpb25JZCA9IGNvbnRleHQgJiYgJ2V4dGVuc2lvbicgaW4gY29udGV4dCA/IGNvbnRleHQuZXh0ZW5zaW9uIDogdW5kZWZpbmVkO1xuXG5cdFx0aWYgKGNvbnRyb2xsZXJJZCAmJiAodHlwZW9mIGNvbnRyb2xsZXJJZCAhPT0gJ3N0cmluZycgfHwgdHlwZW9mIGV4dGVuc2lvbklkICE9PSAnc3RyaW5nJykpIHtcblx0XHRcdC8vIHZhbGlkYXRlIGNvbnRleHQ6IGlkICYgZXh0ZW5zaW9uIE1VU1QgYmUgc3RyaW5nc1xuXHRcdFx0Y29udHJvbGxlcklkID0gdW5kZWZpbmVkO1xuXHRcdFx0ZXh0ZW5zaW9uSWQgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgbm90ZWJvb2sgPSBlZGl0b3IudGV4dE1vZGVsO1xuXHRcdGNvbnN0IG5vdGVib29rS2VybmVsU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90ZWJvb2tLZXJuZWxTZXJ2aWNlKTtcblx0XHRjb25zdCBtYXRjaFJlc3VsdCA9IG5vdGVib29rS2VybmVsU2VydmljZS5nZXRNYXRjaGluZ0tlcm5lbChub3RlYm9vayk7XG5cdFx0Y29uc3QgeyBzZWxlY3RlZCB9ID0gbWF0Y2hSZXN1bHQ7XG5cblx0XHRpZiAoc2VsZWN0ZWQgJiYgY29udHJvbGxlcklkICYmIHNlbGVjdGVkLmlkID09PSBjb250cm9sbGVySWQgJiYgRXh0ZW5zaW9uSWRlbnRpZmllci5lcXVhbHMoc2VsZWN0ZWQuZXh0ZW5zaW9uLCBleHRlbnNpb25JZCkpIHtcblx0XHRcdC8vIGN1cnJlbnQga2VybmVsIGlzIHdhbnRlZCBrZXJuZWwgLT4gZG9uZVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd2FudGVkS2VybmVsSWQgPSBjb250cm9sbGVySWQgPyBgJHtleHRlbnNpb25JZH0vJHtjb250cm9sbGVySWR9YCA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBzdHJhdGVneSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEtlcm5lbFBpY2tlck1SVVN0cmF0ZWd5KTtcblx0XHRyZXR1cm4gc3RyYXRlZ3kuc2hvd1F1aWNrUGljayhlZGl0b3IsIHdhbnRlZEtlcm5lbElkKTtcblx0fVxufSk7XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9vS2VybmVsQWN0aW9uVmlld0l0ZW0gZXh0ZW5kcyBBY3Rpb25WaWV3SXRlbSB7XG5cblx0cHJpdmF0ZSBfa2VybmVsTGFiZWw/OiBIVE1MQW5jaG9yRWxlbWVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRhY3R1YWxBY3Rpb246IElBY3Rpb24sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiB7IG9uRGlkQ2hhbmdlTW9kZWw6IEV2ZW50PHZvaWQ+OyB0ZXh0TW9kZWw6IE5vdGVib29rVGV4dE1vZGVsIHwgdW5kZWZpbmVkOyBzY29wZWRDb250ZXh0S2V5U2VydmljZT86IElDb250ZXh0S2V5U2VydmljZSB9IHwgSU5vdGVib29rRWRpdG9yLFxuXHRcdG9wdGlvbnM6IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMsXG5cdFx0QElOb3RlYm9va0tlcm5lbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tLZXJuZWxTZXJ2aWNlOiBJTm90ZWJvb2tLZXJuZWxTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tLZXJuZWxIaXN0b3J5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9ub3RlYm9va0tlcm5lbEhpc3RvcnlTZXJ2aWNlOiBJTm90ZWJvb2tLZXJuZWxIaXN0b3J5U2VydmljZSxcblx0KSB7XG5cdFx0Y29uc3QgYWN0aW9uID0gbmV3IEFjdGlvbignZmFrZUFjdGlvbicsIHVuZGVmaW5lZCwgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKHNlbGVjdEtlcm5lbEljb24pLCB0cnVlLCAoZXZlbnQpID0+IGFjdHVhbEFjdGlvbi5ydW4oZXZlbnQpKTtcblx0XHRzdXBlcihcblx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdGFjdGlvbixcblx0XHRcdHsgLi4ub3B0aW9ucywgbGFiZWw6IGZhbHNlLCBpY29uOiB0cnVlIH1cblx0XHQpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFjdGlvbik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsKHRoaXMuX3VwZGF0ZSwgdGhpcykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKF9ub3RlYm9va0tlcm5lbFNlcnZpY2Uub25EaWRBZGRLZXJuZWwodGhpcy5fdXBkYXRlLCB0aGlzKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoX25vdGVib29rS2VybmVsU2VydmljZS5vbkRpZFJlbW92ZUtlcm5lbCh0aGlzLl91cGRhdGUsIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihfbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLm9uRGlkQ2hhbmdlTm90ZWJvb2tBZmZpbml0eSh0aGlzLl91cGRhdGUsIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihfbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLm9uRGlkQ2hhbmdlU2VsZWN0ZWROb3RlYm9va3ModGhpcy5fdXBkYXRlLCB0aGlzKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoX25vdGVib29rS2VybmVsU2VydmljZS5vbkRpZENoYW5nZVNvdXJjZUFjdGlvbnModGhpcy5fdXBkYXRlLCB0aGlzKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoX25vdGVib29rS2VybmVsU2VydmljZS5vbkRpZENoYW5nZUtlcm5lbERldGVjdGlvblRhc2tzKHRoaXMuX3VwZGF0ZSwgdGhpcykpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLl91cGRhdGUoKTtcblx0XHRzdXBlci5yZW5kZXIoY29udGFpbmVyKTtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgna2VybmVsLWFjdGlvbi12aWV3LWl0ZW0nKTtcblx0XHR0aGlzLl9rZXJuZWxMYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fa2VybmVsTGFiZWwpO1xuXHRcdHRoaXMudXBkYXRlTGFiZWwoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGVMYWJlbCgpIHtcblx0XHRpZiAodGhpcy5fa2VybmVsTGFiZWwpIHtcblx0XHRcdHRoaXMuX2tlcm5lbExhYmVsLmNsYXNzTGlzdC5hZGQoJ2tlcm5lbC1sYWJlbCcpO1xuXHRcdFx0dGhpcy5fa2VybmVsTGFiZWwuaW5uZXJUZXh0ID0gdGhpcy5fYWN0aW9uLmxhYmVsO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBfdXBkYXRlKCk6IHZvaWQge1xuXHRcdGNvbnN0IG5vdGVib29rID0gdGhpcy5fZWRpdG9yLnRleHRNb2RlbDtcblxuXHRcdGlmICghbm90ZWJvb2spIHtcblx0XHRcdHRoaXMuX3Jlc2V0QWN0aW9uKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0S2VybmVsUGlja2VyTVJVU3RyYXRlZ3kudXBkYXRlS2VybmVsU3RhdHVzQWN0aW9uKG5vdGVib29rLCB0aGlzLl9hY3Rpb24sIHRoaXMuX25vdGVib29rS2VybmVsU2VydmljZSwgdGhpcy5fbm90ZWJvb2tLZXJuZWxIaXN0b3J5U2VydmljZSk7XG5cblx0XHR0aGlzLnVwZGF0ZUNsYXNzKCk7XG5cdH1cblxuXHRwcml2YXRlIF9yZXNldEFjdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLl9hY3Rpb24uZW5hYmxlZCA9IGZhbHNlO1xuXHRcdHRoaXMuX2FjdGlvbi5sYWJlbCA9ICcnO1xuXHRcdHRoaXMuX2FjdGlvbi5jbGFzcyA9ICcnO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsc0JBQThDO0FBQ3ZELFNBQVMsY0FBdUI7QUFFaEMsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFDakQsU0FBUyxzQkFBMEM7QUFDbkQsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyw2QkFBK0M7QUFDeEQsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUywyQkFBMkIsd0JBQXdCO0FBQzVELFNBQVMsdUNBQXdEO0FBQ2pFLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsK0JBQXVEO0FBRWhFLFNBQVMsMkJBQTJCLDZCQUE2QjtBQUNqRSxTQUFTLCtCQUErQiw4QkFBOEI7QUFDdEUsU0FBUyxzQkFBc0I7QUFFL0IsU0FBUyxxQkFBcUIsZUFBK0IsU0FBK0Q7QUFDM0gsTUFBSTtBQUNKLE1BQUksWUFBWSxVQUFhLHNCQUFzQixTQUFTO0FBQzNELFVBQU0sV0FBVyxRQUFRO0FBQ3pCLFVBQU0saUJBQWlCLGNBQWMsbUJBQW1CLEtBQUssQ0FBQyxlQUFlO0FBQzVFLFlBQU0saUJBQWlCLGdDQUFnQyxVQUFVO0FBQ2pFLGFBQU8sZ0JBQWdCLE1BQU0sTUFBTTtBQUFBLElBQ3BDLENBQUM7QUFDRCxhQUFTLGdDQUFnQyxjQUFjO0FBQUEsRUFDeEQsV0FBVyxZQUFZLFVBQWEsb0JBQW9CLFNBQVM7QUFDaEUsYUFBUyxTQUFTO0FBQUEsRUFDbkIsT0FBTztBQUNOLGFBQVMsZ0NBQWdDLGNBQWMsZ0JBQWdCO0FBQUEsRUFDeEU7QUFFQSxTQUFPO0FBQ1I7QUFFQSxnQkFBZ0IsY0FBYyxRQUFRO0FBQUEsRUFDckMsY0FBYztBQUNiLFVBQU07QUFBQSxNQUNMLElBQUk7QUFBQSxNQUNKLFVBQVU7QUFBQSxNQUNWLE9BQU8sVUFBVSxnQ0FBZ0Msd0JBQXdCO0FBQUEsTUFDekUsTUFBTTtBQUFBLE1BQ04sSUFBSTtBQUFBLE1BQ0osY0FBYztBQUFBLE1BQ2QsTUFBTSxDQUFDO0FBQUEsUUFDTixJQUFJLE9BQU87QUFBQSxRQUNYLE1BQU0sZUFBZTtBQUFBLFVBQ3BCO0FBQUEsVUFDQSxlQUFlLFVBQVUsaUNBQWlDLElBQUk7QUFBQSxRQUMvRDtBQUFBLFFBQ0EsT0FBTztBQUFBLFFBQ1AsT0FBTztBQUFBLE1BQ1IsR0FBRztBQUFBLFFBQ0YsSUFBSSxPQUFPO0FBQUEsUUFDWCxNQUFNLGVBQWUsT0FBTyxpQ0FBaUMsSUFBSTtBQUFBLFFBQ2pFLE9BQU87QUFBQSxRQUNQLE9BQU87QUFBQSxNQUNSLEdBQUc7QUFBQSxRQUNGLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTSxzQkFBc0IsWUFBWSxDQUFDO0FBQUEsUUFDekMsT0FBTztBQUFBLFFBQ1AsT0FBTztBQUFBLE1BQ1IsQ0FBQztBQUFBLE1BQ0QsVUFBVTtBQUFBLFFBQ1QsYUFBYSxTQUFTLHFDQUFxQyxzQkFBc0I7QUFBQSxRQUNqRixNQUFNO0FBQUEsVUFDTDtBQUFBLFlBQ0MsTUFBTTtBQUFBLFlBQ04sYUFBYTtBQUFBLFlBQ2IsUUFBUTtBQUFBLGNBQ1AsUUFBUTtBQUFBLGNBQ1IsWUFBWSxDQUFDLE1BQU0sV0FBVztBQUFBLGNBQzlCLGNBQWM7QUFBQSxnQkFDYixNQUFNO0FBQUEsa0JBQ0wsUUFBUTtBQUFBLGdCQUNUO0FBQUEsZ0JBQ0EsYUFBYTtBQUFBLGtCQUNaLFFBQVE7QUFBQSxnQkFDVDtBQUFBLGdCQUNBLG9CQUFvQjtBQUFBLGtCQUNuQixRQUFRO0FBQUEsZ0JBQ1Q7QUFBQSxjQUNEO0FBQUEsWUFDRDtBQUFBLFVBQ0Q7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQU0sSUFBSSxVQUE0QixTQUFvRDtBQUN6RixVQUFNLHVCQUF1QixTQUFTLElBQUkscUJBQXFCO0FBQy9ELFVBQU0sZ0JBQWdCLFNBQVMsSUFBSSxjQUFjO0FBRWpELFVBQU0sU0FBUyxxQkFBcUIsZUFBZSxPQUFPO0FBRTFELFFBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxTQUFTLEdBQUc7QUFDbEMsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLGVBQWUsV0FBVyxRQUFRLFVBQVUsUUFBUSxLQUFLO0FBQzdELFFBQUksY0FBYyxXQUFXLGVBQWUsVUFBVSxRQUFRLFlBQVk7QUFFMUUsUUFBSSxpQkFBaUIsT0FBTyxpQkFBaUIsWUFBWSxPQUFPLGdCQUFnQixXQUFXO0FBRTFGLHFCQUFlO0FBQ2Ysb0JBQWM7QUFBQSxJQUNmO0FBRUEsVUFBTSxXQUFXLE9BQU87QUFDeEIsVUFBTSx3QkFBd0IsU0FBUyxJQUFJLHNCQUFzQjtBQUNqRSxVQUFNLGNBQWMsc0JBQXNCLGtCQUFrQixRQUFRO0FBQ3BFLFVBQU0sRUFBRSxTQUFTLElBQUk7QUFFckIsUUFBSSxZQUFZLGdCQUFnQixTQUFTLE9BQU8sZ0JBQWdCLG9CQUFvQixPQUFPLFNBQVMsV0FBVyxXQUFXLEdBQUc7QUFFNUgsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLGlCQUFpQixlQUFlLEdBQUcsV0FBVyxJQUFJLFlBQVksS0FBSztBQUN6RSxVQUFNLFdBQVcscUJBQXFCLGVBQWUsdUJBQXVCO0FBQzVFLFdBQU8sU0FBUyxjQUFjLFFBQVEsY0FBYztBQUFBLEVBQ3JEO0FBQ0QsQ0FBQztBQUVNLElBQU0sOEJBQU4sY0FBMEMsZUFBZTtBQUFBLEVBSS9ELFlBQ0MsY0FDaUIsU0FDakIsU0FDeUMsd0JBQ08sK0JBQy9DO0FBQ0QsVUFBTSxTQUFTLElBQUksT0FBTyxjQUFjLFFBQVcsVUFBVSxZQUFZLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxVQUFVLGFBQWEsSUFBSSxLQUFLLENBQUM7QUFDcEk7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLE1BQ0EsRUFBRSxHQUFHLFNBQVMsT0FBTyxPQUFPLE1BQU0sS0FBSztBQUFBLElBQ3hDO0FBVmlCO0FBRXdCO0FBQ087QUFRaEQsU0FBSyxVQUFVLE1BQU07QUFDckIsU0FBSyxVQUFVLFFBQVEsaUJBQWlCLEtBQUssU0FBUyxJQUFJLENBQUM7QUFDM0QsU0FBSyxVQUFVLHVCQUF1QixlQUFlLEtBQUssU0FBUyxJQUFJLENBQUM7QUFDeEUsU0FBSyxVQUFVLHVCQUF1QixrQkFBa0IsS0FBSyxTQUFTLElBQUksQ0FBQztBQUMzRSxTQUFLLFVBQVUsdUJBQXVCLDRCQUE0QixLQUFLLFNBQVMsSUFBSSxDQUFDO0FBQ3JGLFNBQUssVUFBVSx1QkFBdUIsNkJBQTZCLEtBQUssU0FBUyxJQUFJLENBQUM7QUFDdEYsU0FBSyxVQUFVLHVCQUF1Qix5QkFBeUIsS0FBSyxTQUFTLElBQUksQ0FBQztBQUNsRixTQUFLLFVBQVUsdUJBQXVCLGdDQUFnQyxLQUFLLFNBQVMsSUFBSSxDQUFDO0FBQUEsRUFDMUY7QUFBQSxFQUVTLE9BQU8sV0FBOEI7QUFDN0MsU0FBSyxRQUFRO0FBQ2IsVUFBTSxPQUFPLFNBQVM7QUFDdEIsY0FBVSxVQUFVLElBQUkseUJBQXlCO0FBQ2pELFNBQUssZUFBZSxTQUFTLGNBQWMsR0FBRztBQUM5QyxjQUFVLFlBQVksS0FBSyxZQUFZO0FBQ3ZDLFNBQUssWUFBWTtBQUFBLEVBQ2xCO0FBQUEsRUFFbUIsY0FBYztBQUNoQyxRQUFJLEtBQUssY0FBYztBQUN0QixXQUFLLGFBQWEsVUFBVSxJQUFJLGNBQWM7QUFDOUMsV0FBSyxhQUFhLFlBQVksS0FBSyxRQUFRO0FBQUEsSUFDNUM7QUFBQSxFQUNEO0FBQUEsRUFFVSxVQUFnQjtBQUN6QixVQUFNLFdBQVcsS0FBSyxRQUFRO0FBRTlCLFFBQUksQ0FBQyxVQUFVO0FBQ2QsV0FBSyxhQUFhO0FBQ2xCO0FBQUEsSUFDRDtBQUVBLDRCQUF3Qix5QkFBeUIsVUFBVSxLQUFLLFNBQVMsS0FBSyx3QkFBd0IsS0FBSyw2QkFBNkI7QUFFeEksU0FBSyxZQUFZO0FBQUEsRUFDbEI7QUFBQSxFQUVRLGVBQXFCO0FBQzVCLFNBQUssUUFBUSxVQUFVO0FBQ3ZCLFNBQUssUUFBUSxRQUFRO0FBQ3JCLFNBQUssUUFBUSxRQUFRO0FBQUEsRUFDdEI7QUFDRDtBQTdEYSw4QkFBTjtBQUFBLEVBUUo7QUFBQSxFQUNBO0FBQUEsR0FUVTsiLAogICJuYW1lcyI6IFtdCn0K
