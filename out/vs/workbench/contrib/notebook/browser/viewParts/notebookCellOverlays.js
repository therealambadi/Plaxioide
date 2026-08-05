import { createFastDomNode } from "../../../../../base/browser/fastDomNode.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { localize2 } from "../../../../../nls.js";
import { Categories } from "../../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IsDevelopmentContext } from "../../../../../platform/contextkey/common/contextkeys.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { CellKind } from "../../common/notebookCommon.js";
import { getNotebookEditorFromEditorPane } from "../notebookBrowser.js";
class NotebookCellOverlays extends Disposable {
  constructor(listView) {
    super();
    this.listView = listView;
    this._lastOverlayId = 0;
    this._overlays = /* @__PURE__ */ Object.create(null);
    this.domNode = createFastDomNode(document.createElement("div"));
    this.domNode.setClassName("cell-overlays");
    this.domNode.setPosition("absolute");
    this.domNode.setAttribute("role", "presentation");
    this.domNode.setAttribute("aria-hidden", "true");
    this.domNode.setWidth("100%");
    this.listView.containerDomNode.appendChild(this.domNode.domNode);
  }
  changeCellOverlays(callback) {
    let overlaysHaveChanged = false;
    const changeAccessor = {
      addOverlay: (overlay) => {
        overlaysHaveChanged = true;
        return this._addOverlay(overlay);
      },
      removeOverlay: (id) => {
        overlaysHaveChanged = true;
        this._removeOverlay(id);
      },
      layoutOverlay: (id) => {
        overlaysHaveChanged = true;
        this._layoutOverlay(id);
      }
    };
    callback(changeAccessor);
    return overlaysHaveChanged;
  }
  onCellsChanged(e) {
    this.layout();
  }
  onHiddenRangesChange() {
    this.layout();
  }
  layout() {
    for (const id in this._overlays) {
      this._layoutOverlay(id);
    }
  }
  _addOverlay(overlay) {
    const overlayId = `${++this._lastOverlayId}`;
    const overlayWidget = {
      overlayId,
      overlay,
      domNode: createFastDomNode(overlay.domNode)
    };
    this._overlays[overlayId] = overlayWidget;
    overlayWidget.domNode.setClassName("cell-overlay");
    overlayWidget.domNode.setPosition("absolute");
    this.domNode.appendChild(overlayWidget.domNode);
    return overlayId;
  }
  _removeOverlay(id) {
    const overlay = this._overlays[id];
    if (overlay) {
      try {
        this.domNode.removeChild(overlay.domNode);
      } catch {
      }
      delete this._overlays[id];
    }
  }
  _layoutOverlay(id) {
    const overlay = this._overlays[id];
    if (!overlay) {
      return;
    }
    const isInHiddenRanges = this._isInHiddenRanges(overlay);
    if (isInHiddenRanges) {
      overlay.domNode.setDisplay("none");
      return;
    }
    overlay.domNode.setDisplay("block");
    const index = this.listView.indexOf(overlay.overlay.cell);
    if (index === -1) {
      return;
    }
    const top = this.listView.elementTop(index);
    overlay.domNode.setTop(top);
  }
  _isInHiddenRanges(zone) {
    const index = this.listView.indexOf(zone.overlay.cell);
    if (index === -1) {
      return true;
    }
    return false;
  }
}
const _ToggleNotebookCellOverlaysDeveloperAction = class _ToggleNotebookCellOverlaysDeveloperAction extends Action2 {
  constructor() {
    super({
      id: "notebook.developer.addCellOverlays",
      title: localize2("workbench.notebook.developer.addCellOverlays", "Toggle Notebook Cell Overlays"),
      category: Categories.Developer,
      precondition: IsDevelopmentContext,
      f1: true
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!editor) {
      return;
    }
    if (_ToggleNotebookCellOverlaysDeveloperAction.cellOverlayIds.length > 0) {
      editor.changeCellOverlays((accessor2) => {
        _ToggleNotebookCellOverlaysDeveloperAction.cellOverlayIds.forEach((id) => {
          accessor2.removeOverlay(id);
        });
        _ToggleNotebookCellOverlaysDeveloperAction.cellOverlayIds = [];
      });
    } else {
      editor.changeCellOverlays((accessor2) => {
        const cells = editor.getCellsInRange();
        if (cells.length === 0) {
          return;
        }
        const cellOverlayIds = [];
        for (let i = 0; i < cells.length; i++) {
          if (cells[i].cellKind !== CellKind.Markup) {
            continue;
          }
          const domNode = document.createElement("div");
          domNode.innerText = `Cell Overlay ${i}`;
          domNode.style.top = "10px";
          domNode.style.right = "10px";
          domNode.style.backgroundColor = "rgba(0, 255, 0, 0.5)";
          const overlayId = accessor2.addOverlay({
            cell: cells[i],
            domNode
          });
          cellOverlayIds.push(overlayId);
        }
        _ToggleNotebookCellOverlaysDeveloperAction.cellOverlayIds = cellOverlayIds;
      });
    }
  }
};
_ToggleNotebookCellOverlaysDeveloperAction.cellOverlayIds = [];
let ToggleNotebookCellOverlaysDeveloperAction = _ToggleNotebookCellOverlaysDeveloperAction;
registerAction2(ToggleNotebookCellOverlaysDeveloperAction);
export {
  NotebookCellOverlays
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXdQYXJ0cy9ub3RlYm9va0NlbGxPdmVybGF5cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGNyZWF0ZUZhc3REb21Ob2RlLCBGYXN0RG9tTm9kZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9mYXN0RG9tTm9kZS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSXNEZXZlbG9wbWVudENvbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDZWxsS2luZCB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBnZXROb3RlYm9va0VkaXRvckZyb21FZGl0b3JQYW5lLCBJTm90ZWJvb2tDZWxsT3ZlcmxheSwgSU5vdGVib29rQ2VsbE92ZXJsYXlDaGFuZ2VBY2Nlc3NvciwgSU5vdGVib29rVmlld0NlbGxzVXBkYXRlRXZlbnQgfSBmcm9tICcuLi9ub3RlYm9va0Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tDZWxsTGlzdFZpZXcgfSBmcm9tICcuLi92aWV3L25vdGVib29rQ2VsbExpc3RWaWV3LmpzJztcbmltcG9ydCB7IENlbGxWaWV3TW9kZWwgfSBmcm9tICcuLi92aWV3TW9kZWwvbm90ZWJvb2tWaWV3TW9kZWxJbXBsLmpzJztcblxuaW50ZXJmYWNlIElOb3RlYm9va0NlbGxPdmVybGF5V2lkZ2V0IHtcblx0b3ZlcmxheUlkOiBzdHJpbmc7XG5cdG92ZXJsYXk6IElOb3RlYm9va0NlbGxPdmVybGF5O1xuXHRkb21Ob2RlOiBGYXN0RG9tTm9kZTxIVE1MRWxlbWVudD47XG59XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va0NlbGxPdmVybGF5cyBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIF9sYXN0T3ZlcmxheUlkID0gMDtcblx0cHVibGljIGRvbU5vZGU6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50Pjtcblx0cHJpdmF0ZSBfb3ZlcmxheXM6IHsgW2tleTogc3RyaW5nXTogSU5vdGVib29rQ2VsbE92ZXJsYXlXaWRnZXQgfSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsaXN0VmlldzogTm90ZWJvb2tDZWxsTGlzdFZpZXc8Q2VsbFZpZXdNb2RlbD5cblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmRvbU5vZGUgPSBjcmVhdGVGYXN0RG9tTm9kZShkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSk7XG5cdFx0dGhpcy5kb21Ob2RlLnNldENsYXNzTmFtZSgnY2VsbC1vdmVybGF5cycpO1xuXHRcdHRoaXMuZG9tTm9kZS5zZXRQb3NpdGlvbignYWJzb2x1dGUnKTtcblx0XHR0aGlzLmRvbU5vZGUuc2V0QXR0cmlidXRlKCdyb2xlJywgJ3ByZXNlbnRhdGlvbicpO1xuXHRcdHRoaXMuZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ3RydWUnKTtcblx0XHR0aGlzLmRvbU5vZGUuc2V0V2lkdGgoJzEwMCUnKTtcblxuXHRcdHRoaXMubGlzdFZpZXcuY29udGFpbmVyRG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLmRvbU5vZGUuZG9tTm9kZSk7XG5cdH1cblxuXHRjaGFuZ2VDZWxsT3ZlcmxheXMoY2FsbGJhY2s6IChjaGFuZ2VBY2Nlc3NvcjogSU5vdGVib29rQ2VsbE92ZXJsYXlDaGFuZ2VBY2Nlc3NvcikgPT4gdm9pZCk6IGJvb2xlYW4ge1xuXHRcdGxldCBvdmVybGF5c0hhdmVDaGFuZ2VkID0gZmFsc2U7XG5cdFx0Y29uc3QgY2hhbmdlQWNjZXNzb3I6IElOb3RlYm9va0NlbGxPdmVybGF5Q2hhbmdlQWNjZXNzb3IgPSB7XG5cdFx0XHRhZGRPdmVybGF5OiAob3ZlcmxheTogSU5vdGVib29rQ2VsbE92ZXJsYXkpOiBzdHJpbmcgPT4ge1xuXHRcdFx0XHRvdmVybGF5c0hhdmVDaGFuZ2VkID0gdHJ1ZTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2FkZE92ZXJsYXkob3ZlcmxheSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVtb3ZlT3ZlcmxheTogKGlkOiBzdHJpbmcpOiB2b2lkID0+IHtcblx0XHRcdFx0b3ZlcmxheXNIYXZlQ2hhbmdlZCA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX3JlbW92ZU92ZXJsYXkoaWQpO1xuXHRcdFx0fSxcblx0XHRcdGxheW91dE92ZXJsYXk6IChpZDogc3RyaW5nKTogdm9pZCA9PiB7XG5cdFx0XHRcdG92ZXJsYXlzSGF2ZUNoYW5nZWQgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLl9sYXlvdXRPdmVybGF5KGlkKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y2FsbGJhY2soY2hhbmdlQWNjZXNzb3IpO1xuXG5cdFx0cmV0dXJuIG92ZXJsYXlzSGF2ZUNoYW5nZWQ7XG5cdH1cblxuXHRvbkNlbGxzQ2hhbmdlZChlOiBJTm90ZWJvb2tWaWV3Q2VsbHNVcGRhdGVFdmVudCk6IHZvaWQge1xuXHRcdHRoaXMubGF5b3V0KCk7XG5cdH1cblxuXHRvbkhpZGRlblJhbmdlc0NoYW5nZSgpIHtcblx0XHR0aGlzLmxheW91dCgpO1xuXHR9XG5cblx0bGF5b3V0KCkge1xuXHRcdGZvciAoY29uc3QgaWQgaW4gdGhpcy5fb3ZlcmxheXMpIHtcblx0XHRcdHRoaXMuX2xheW91dE92ZXJsYXkoaWQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2FkZE92ZXJsYXkob3ZlcmxheTogSU5vdGVib29rQ2VsbE92ZXJsYXkpOiBzdHJpbmcge1xuXHRcdGNvbnN0IG92ZXJsYXlJZCA9IGAkeysrdGhpcy5fbGFzdE92ZXJsYXlJZH1gO1xuXG5cdFx0Y29uc3Qgb3ZlcmxheVdpZGdldCA9IHtcblx0XHRcdG92ZXJsYXlJZCxcblx0XHRcdG92ZXJsYXksXG5cdFx0XHRkb21Ob2RlOiBjcmVhdGVGYXN0RG9tTm9kZShvdmVybGF5LmRvbU5vZGUpXG5cdFx0fTtcblxuXHRcdHRoaXMuX292ZXJsYXlzW292ZXJsYXlJZF0gPSBvdmVybGF5V2lkZ2V0O1xuXHRcdG92ZXJsYXlXaWRnZXQuZG9tTm9kZS5zZXRDbGFzc05hbWUoJ2NlbGwtb3ZlcmxheScpO1xuXHRcdG92ZXJsYXlXaWRnZXQuZG9tTm9kZS5zZXRQb3NpdGlvbignYWJzb2x1dGUnKTtcblx0XHR0aGlzLmRvbU5vZGUuYXBwZW5kQ2hpbGQob3ZlcmxheVdpZGdldC5kb21Ob2RlKTtcblxuXHRcdHJldHVybiBvdmVybGF5SWQ7XG5cdH1cblxuXHRwcml2YXRlIF9yZW1vdmVPdmVybGF5KGlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBvdmVybGF5ID0gdGhpcy5fb3ZlcmxheXNbaWRdO1xuXHRcdGlmIChvdmVybGF5KSB7XG5cdFx0XHQvLyBvdmVybGF5Lm92ZXJsYXkuZGlzcG9zZSgpO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5kb21Ob2RlLnJlbW92ZUNoaWxkKG92ZXJsYXkuZG9tTm9kZSk7XG5cdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0Ly8gbm8gb3Bcblx0XHRcdH1cblxuXHRcdFx0ZGVsZXRlIHRoaXMuX292ZXJsYXlzW2lkXTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9sYXlvdXRPdmVybGF5KGlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBvdmVybGF5ID0gdGhpcy5fb3ZlcmxheXNbaWRdO1xuXHRcdGlmICghb3ZlcmxheSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlzSW5IaWRkZW5SYW5nZXMgPSB0aGlzLl9pc0luSGlkZGVuUmFuZ2VzKG92ZXJsYXkpO1xuXHRcdGlmIChpc0luSGlkZGVuUmFuZ2VzKSB7XG5cdFx0XHRvdmVybGF5LmRvbU5vZGUuc2V0RGlzcGxheSgnbm9uZScpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdG92ZXJsYXkuZG9tTm9kZS5zZXREaXNwbGF5KCdibG9jaycpO1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5saXN0Vmlldy5pbmRleE9mKG92ZXJsYXkub3ZlcmxheS5jZWxsIGFzIENlbGxWaWV3TW9kZWwpO1xuXHRcdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRcdC8vIHNob3VsZCBub3QgaGFwcGVuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9wID0gdGhpcy5saXN0Vmlldy5lbGVtZW50VG9wKGluZGV4KTtcblx0XHRvdmVybGF5LmRvbU5vZGUuc2V0VG9wKHRvcCk7XG5cdH1cblxuXHRwcml2YXRlIF9pc0luSGlkZGVuUmFuZ2VzKHpvbmU6IElOb3RlYm9va0NlbGxPdmVybGF5V2lkZ2V0KSB7XG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLmxpc3RWaWV3LmluZGV4T2Yoem9uZS5vdmVybGF5LmNlbGwgYXMgQ2VsbFZpZXdNb2RlbCk7XG5cdFx0aWYgKGluZGV4ID09PSAtMSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG5cblxuXG5jbGFzcyBUb2dnbGVOb3RlYm9va0NlbGxPdmVybGF5c0RldmVsb3BlckFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRzdGF0aWMgY2VsbE92ZXJsYXlJZHM6IHN0cmluZ1tdID0gW107XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnbm90ZWJvb2suZGV2ZWxvcGVyLmFkZENlbGxPdmVybGF5cycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2gubm90ZWJvb2suZGV2ZWxvcGVyLmFkZENlbGxPdmVybGF5cycsIFwiVG9nZ2xlIE5vdGVib29rIENlbGwgT3ZlcmxheXNcIiksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdFx0XHRwcmVjb25kaXRpb246IElzRGV2ZWxvcG1lbnRDb250ZXh0LFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvciA9IGdldE5vdGVib29rRWRpdG9yRnJvbUVkaXRvclBhbmUoZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lKTtcblxuXHRcdGlmICghZWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKFRvZ2dsZU5vdGVib29rQ2VsbE92ZXJsYXlzRGV2ZWxvcGVyQWN0aW9uLmNlbGxPdmVybGF5SWRzLmxlbmd0aCA+IDApIHtcblx0XHRcdC8vIHJlbW92ZSBhbGwgdmlldyB6b25lc1xuXHRcdFx0ZWRpdG9yLmNoYW5nZUNlbGxPdmVybGF5cyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFRvZ2dsZU5vdGVib29rQ2VsbE92ZXJsYXlzRGV2ZWxvcGVyQWN0aW9uLmNlbGxPdmVybGF5SWRzLmZvckVhY2goaWQgPT4ge1xuXHRcdFx0XHRcdGFjY2Vzc29yLnJlbW92ZU92ZXJsYXkoaWQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0VG9nZ2xlTm90ZWJvb2tDZWxsT3ZlcmxheXNEZXZlbG9wZXJBY3Rpb24uY2VsbE92ZXJsYXlJZHMgPSBbXTtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRlZGl0b3IuY2hhbmdlQ2VsbE92ZXJsYXlzKGFjY2Vzc29yID0+IHtcblx0XHRcdFx0Y29uc3QgY2VsbHMgPSBlZGl0b3IuZ2V0Q2VsbHNJblJhbmdlKCk7XG5cdFx0XHRcdGlmIChjZWxscy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBjZWxsT3ZlcmxheUlkczogc3RyaW5nW10gPSBbXTtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjZWxscy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGlmIChjZWxsc1tpXS5jZWxsS2luZCAhPT0gQ2VsbEtpbmQuTWFya3VwKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgZG9tTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0XHRcdGRvbU5vZGUuaW5uZXJUZXh0ID0gYENlbGwgT3ZlcmxheSAke2l9YDtcblx0XHRcdFx0XHRkb21Ob2RlLnN0eWxlLnRvcCA9ICcxMHB4Jztcblx0XHRcdFx0XHRkb21Ob2RlLnN0eWxlLnJpZ2h0ID0gJzEwcHgnO1xuXHRcdFx0XHRcdGRvbU5vZGUuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ3JnYmEoMCwgMjU1LCAwLCAwLjUpJztcblx0XHRcdFx0XHRjb25zdCBvdmVybGF5SWQgPSBhY2Nlc3Nvci5hZGRPdmVybGF5KHtcblx0XHRcdFx0XHRcdGNlbGw6IGNlbGxzW2ldLFxuXHRcdFx0XHRcdFx0ZG9tTm9kZTogZG9tTm9kZSxcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGNlbGxPdmVybGF5SWRzLnB1c2gob3ZlcmxheUlkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRUb2dnbGVOb3RlYm9va0NlbGxPdmVybGF5c0RldmVsb3BlckFjdGlvbi5jZWxsT3ZlcmxheUlkcyA9IGNlbGxPdmVybGF5SWRzO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG59XG5cbnJlZ2lzdGVyQWN0aW9uMihUb2dnbGVOb3RlYm9va0NlbGxPdmVybGF5c0RldmVsb3BlckFjdGlvbik7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHlCQUFzQztBQUMvQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLFNBQVMsdUJBQXVCO0FBQ3pDLFNBQVMsNEJBQTRCO0FBRXJDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUNBQWdJO0FBVWxJLE1BQU0sNkJBQTZCLFdBQVc7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UUFBUTtBQUFBLEVBRS9ELGNBQWM7QUFDYixVQUFNO0FBQUEsTUFDTCxJQUFJO0FBQUEsTUFDSixPQUFPLFVBQVUsZ0RBQWdELCtCQUErQjtBQUFBLE1BQ2hHLFVBQVUsV0FBVztBQUFBLE1BQ3JCLGNBQWM7QUFBQSxNQUNkLElBQUk7QUFBQSxJQUNMLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFNLElBQUksVUFBMkM7QUFDcEQsVUFBTSxnQkFBZ0IsU0FBUyxJQUFJLGNBQWM7QUFDakQsVUFBTSxTQUFTLGdDQUFnQyxjQUFjLGdCQUFnQjtBQUU3RSxRQUFJLENBQUMsUUFBUTtBQUNaO0FBQUEsSUFDRDtBQUVBLFFBQUksMkNBQTBDLGVBQWUsU0FBUyxHQUFHO0FBRXhFLGFBQU8sbUJBQW1CLENBQUFBLGNBQVk7QUFDckMsbURBQTBDLGVBQWUsUUFBUSxRQUFNO0FBQ3RFLFVBQUFBLFVBQVMsY0FBYyxFQUFFO0FBQUEsUUFDMUIsQ0FBQztBQUNELG1EQUEwQyxpQkFBaUIsQ0FBQztBQUFBLE1BQzdELENBQUM7QUFBQSxJQUNGLE9BQU87QUFDTixhQUFPLG1CQUFtQixDQUFBQSxjQUFZO0FBQ3JDLGNBQU0sUUFBUSxPQUFPLGdCQUFnQjtBQUNyQyxZQUFJLE1BQU0sV0FBVyxHQUFHO0FBQ3ZCO0FBQUEsUUFDRDtBQUVBLGNBQU0saUJBQTJCLENBQUM7QUFDbEMsaUJBQVMsSUFBSSxHQUFHLElBQUksTUFBTSxRQUFRLEtBQUs7QUFDdEMsY0FBSSxNQUFNLENBQUMsRUFBRSxhQUFhLFNBQVMsUUFBUTtBQUMxQztBQUFBLFVBQ0Q7QUFDQSxnQkFBTSxVQUFVLFNBQVMsY0FBYyxLQUFLO0FBQzVDLGtCQUFRLFlBQVksZ0JBQWdCLENBQUM7QUFDckMsa0JBQVEsTUFBTSxNQUFNO0FBQ3BCLGtCQUFRLE1BQU0sUUFBUTtBQUN0QixrQkFBUSxNQUFNLGtCQUFrQjtBQUNoQyxnQkFBTSxZQUFZQSxVQUFTLFdBQVc7QUFBQSxZQUNyQyxNQUFNLE1BQU0sQ0FBQztBQUFBLFlBQ2I7QUFBQSxVQUNELENBQUM7QUFFRCx5QkFBZSxLQUFLLFNBQVM7QUFBQSxRQUM5QjtBQUNBLG1EQUEwQyxpQkFBaUI7QUFBQSxNQUM1RCxDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFDRDtBQXhETSwyQ0FDRSxpQkFBMkIsQ0FBQztBQURwQyxJQUFNLDRDQUFOO0FBMERBLGdCQUFnQix5Q0FBeUM7IiwKICAibmFtZXMiOiBbImFjY2Vzc29yIl0KfQo=
