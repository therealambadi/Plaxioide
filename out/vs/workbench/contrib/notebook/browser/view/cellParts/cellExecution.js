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
import * as DOM from "../../../../../../base/browser/dom.js";
import { disposableTimeout } from "../../../../../../base/common/async.js";
import { DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { clamp } from "../../../../../../base/common/numbers.js";
import { CellContentPart } from "../cellPart.js";
import { CodeCellViewModel } from "../../viewModel/codeCellViewModel.js";
import { INotebookExecutionStateService } from "../../../common/notebookExecutionStateService.js";
const UPDATE_EXECUTION_ORDER_GRACE_PERIOD = 200;
let CellExecutionPart = class extends CellContentPart {
  constructor(_notebookEditor, _executionOrderLabel, _notebookExecutionStateService) {
    super();
    this._notebookEditor = _notebookEditor;
    this._executionOrderLabel = _executionOrderLabel;
    this._notebookExecutionStateService = _notebookExecutionStateService;
    this.kernelDisposables = this._register(new DisposableStore());
    this._register(this._notebookEditor.onDidChangeActiveKernel(() => {
      if (this.currentCell) {
        this.kernelDisposables.clear();
        if (this._notebookEditor.activeKernel) {
          this.kernelDisposables.add(this._notebookEditor.activeKernel.onDidChange(() => {
            if (this.currentCell) {
              this.updateExecutionOrder(this.currentCell.internalMetadata);
            }
          }));
        }
        this.updateExecutionOrder(this.currentCell.internalMetadata);
      }
    }));
    this._register(this._notebookEditor.onDidScroll(() => {
      this._updatePosition();
    }));
  }
  didRenderCell(element) {
    this.updateExecutionOrder(element.internalMetadata, true);
  }
  updateExecutionOrder(internalMetadata, forceClear = false) {
    if (this._notebookEditor.activeKernel?.implementsExecutionOrder || !this._notebookEditor.activeKernel && typeof internalMetadata.executionOrder === "number") {
      if (typeof internalMetadata.executionOrder !== "number" && !forceClear && !!this._notebookExecutionStateService.getCellExecution(this.currentCell.uri)) {
        const renderingCell = this.currentCell;
        disposableTimeout(() => {
          if (this.currentCell === renderingCell) {
            this.updateExecutionOrder(this.currentCell.internalMetadata, true);
          }
        }, UPDATE_EXECUTION_ORDER_GRACE_PERIOD, this.cellDisposables);
        return;
      }
      const executionOrderLabel = typeof internalMetadata.executionOrder === "number" ? `[${internalMetadata.executionOrder}]` : "[ ]";
      this._executionOrderLabel.innerText = executionOrderLabel;
    } else {
      this._executionOrderLabel.innerText = "";
    }
  }
  updateState(element, e) {
    if (e.internalMetadataChanged) {
      this.updateExecutionOrder(element.internalMetadata);
    }
  }
  updateInternalLayoutNow(element) {
    this._updatePosition();
  }
  _updatePosition() {
    if (this.currentCell) {
      if (this.currentCell.isInputCollapsed) {
        DOM.hide(this._executionOrderLabel);
      } else {
        DOM.show(this._executionOrderLabel);
        let top = this.currentCell.layoutInfo.editorHeight - 22 + this.currentCell.layoutInfo.statusBarHeight;
        if (this.currentCell instanceof CodeCellViewModel) {
          const elementTop = this._notebookEditor.getAbsoluteTopOfElement(this.currentCell);
          const editorBottom = elementTop + this.currentCell.layoutInfo.outputContainerOffset;
          const scrollBottom = this._notebookEditor.scrollBottom;
          const lineHeight = 22;
          if (scrollBottom <= editorBottom) {
            const offset = editorBottom - scrollBottom;
            top -= offset;
            top = clamp(
              top,
              lineHeight + 12,
              // line height + padding for single line
              this.currentCell.layoutInfo.editorHeight - lineHeight + this.currentCell.layoutInfo.statusBarHeight
            );
          }
        }
        this._executionOrderLabel.style.top = `${top}px`;
      }
    }
  }
};
CellExecutionPart = __decorateClass([
  __decorateParam(2, INotebookExecutionStateService)
], CellExecutionPart);
export {
  CellExecutionPart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXcvY2VsbFBhcnRzL2NlbGxFeGVjdXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBET00gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBkaXNwb3NhYmxlVGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBjbGFtcCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL251bWJlcnMuanMnO1xuaW1wb3J0IHsgSUNlbGxWaWV3TW9kZWwsIElOb3RlYm9va0VkaXRvckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2tCcm93c2VyLmpzJztcbmltcG9ydCB7IENlbGxWaWV3TW9kZWxTdGF0ZUNoYW5nZUV2ZW50IH0gZnJvbSAnLi4vLi4vbm90ZWJvb2tWaWV3RXZlbnRzLmpzJztcbmltcG9ydCB7IENlbGxDb250ZW50UGFydCB9IGZyb20gJy4uL2NlbGxQYXJ0LmpzJztcbmltcG9ydCB7IENvZGVDZWxsVmlld01vZGVsIH0gZnJvbSAnLi4vLi4vdmlld01vZGVsL2NvZGVDZWxsVmlld01vZGVsLmpzJztcbmltcG9ydCB7IE5vdGVib29rQ2VsbEludGVybmFsTWV0YWRhdGEgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmpzJztcblxuY29uc3QgVVBEQVRFX0VYRUNVVElPTl9PUkRFUl9HUkFDRV9QRVJJT0QgPSAyMDA7XG5cbmV4cG9ydCBjbGFzcyBDZWxsRXhlY3V0aW9uUGFydCBleHRlbmRzIENlbGxDb250ZW50UGFydCB7XG5cdHByaXZhdGUgcmVhZG9ubHkga2VybmVsRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rRWRpdG9yOiBJTm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9leGVjdXRpb25PcmRlckxhYmVsOiBIVE1MRWxlbWVudCxcblx0XHRASU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlOiBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX25vdGVib29rRWRpdG9yLm9uRGlkQ2hhbmdlQWN0aXZlS2VybmVsKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmN1cnJlbnRDZWxsKSB7XG5cdFx0XHRcdHRoaXMua2VybmVsRGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdFx0XHRpZiAodGhpcy5fbm90ZWJvb2tFZGl0b3IuYWN0aXZlS2VybmVsKSB7XG5cdFx0XHRcdFx0dGhpcy5rZXJuZWxEaXNwb3NhYmxlcy5hZGQodGhpcy5fbm90ZWJvb2tFZGl0b3IuYWN0aXZlS2VybmVsLm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdFx0XHRcdGlmICh0aGlzLmN1cnJlbnRDZWxsKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMudXBkYXRlRXhlY3V0aW9uT3JkZXIodGhpcy5jdXJyZW50Q2VsbC5pbnRlcm5hbE1ldGFkYXRhKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLnVwZGF0ZUV4ZWN1dGlvbk9yZGVyKHRoaXMuY3VycmVudENlbGwuaW50ZXJuYWxNZXRhZGF0YSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbm90ZWJvb2tFZGl0b3Iub25EaWRTY3JvbGwoKCkgPT4ge1xuXHRcdFx0dGhpcy5fdXBkYXRlUG9zaXRpb24oKTtcblx0XHR9KSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaWRSZW5kZXJDZWxsKGVsZW1lbnQ6IElDZWxsVmlld01vZGVsKTogdm9pZCB7XG5cdFx0dGhpcy51cGRhdGVFeGVjdXRpb25PcmRlcihlbGVtZW50LmludGVybmFsTWV0YWRhdGEsIHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVFeGVjdXRpb25PcmRlcihpbnRlcm5hbE1ldGFkYXRhOiBOb3RlYm9va0NlbGxJbnRlcm5hbE1ldGFkYXRhLCBmb3JjZUNsZWFyID0gZmFsc2UpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fbm90ZWJvb2tFZGl0b3IuYWN0aXZlS2VybmVsPy5pbXBsZW1lbnRzRXhlY3V0aW9uT3JkZXIgfHwgKCF0aGlzLl9ub3RlYm9va0VkaXRvci5hY3RpdmVLZXJuZWwgJiYgdHlwZW9mIGludGVybmFsTWV0YWRhdGEuZXhlY3V0aW9uT3JkZXIgPT09ICdudW1iZXInKSkge1xuXHRcdFx0Ly8gSWYgdGhlIGV4ZWN1dGlvbk9yZGVyIHdhcyBqdXN0IGNsZWFyZWQsIGFuZCB0aGUgY2VsbCBpcyBleGVjdXRpbmcsIHdhaXQganVzdCBhIGJpdCBiZWZvcmUgY2xlYXJpbmcgdGhlIHZpZXcgdG8gYXZvaWQgZmxhc2hpbmdcblx0XHRcdGlmICh0eXBlb2YgaW50ZXJuYWxNZXRhZGF0YS5leGVjdXRpb25PcmRlciAhPT0gJ251bWJlcicgJiYgIWZvcmNlQ2xlYXIgJiYgISF0aGlzLl9ub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZS5nZXRDZWxsRXhlY3V0aW9uKHRoaXMuY3VycmVudENlbGwhLnVyaSkpIHtcblx0XHRcdFx0Y29uc3QgcmVuZGVyaW5nQ2VsbCA9IHRoaXMuY3VycmVudENlbGw7XG5cdFx0XHRcdGRpc3Bvc2FibGVUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRpZiAodGhpcy5jdXJyZW50Q2VsbCA9PT0gcmVuZGVyaW5nQ2VsbCkge1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVFeGVjdXRpb25PcmRlcih0aGlzLmN1cnJlbnRDZWxsIS5pbnRlcm5hbE1ldGFkYXRhLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIFVQREFURV9FWEVDVVRJT05fT1JERVJfR1JBQ0VfUEVSSU9ELCB0aGlzLmNlbGxEaXNwb3NhYmxlcyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZXhlY3V0aW9uT3JkZXJMYWJlbCA9IHR5cGVvZiBpbnRlcm5hbE1ldGFkYXRhLmV4ZWN1dGlvbk9yZGVyID09PSAnbnVtYmVyJyA/XG5cdFx0XHRcdGBbJHtpbnRlcm5hbE1ldGFkYXRhLmV4ZWN1dGlvbk9yZGVyfV1gIDpcblx0XHRcdFx0J1sgXSc7XG5cdFx0XHR0aGlzLl9leGVjdXRpb25PcmRlckxhYmVsLmlubmVyVGV4dCA9IGV4ZWN1dGlvbk9yZGVyTGFiZWw7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2V4ZWN1dGlvbk9yZGVyTGFiZWwuaW5uZXJUZXh0ID0gJyc7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgdXBkYXRlU3RhdGUoZWxlbWVudDogSUNlbGxWaWV3TW9kZWwsIGU6IENlbGxWaWV3TW9kZWxTdGF0ZUNoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKGUuaW50ZXJuYWxNZXRhZGF0YUNoYW5nZWQpIHtcblx0XHRcdHRoaXMudXBkYXRlRXhlY3V0aW9uT3JkZXIoZWxlbWVudC5pbnRlcm5hbE1ldGFkYXRhKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSB1cGRhdGVJbnRlcm5hbExheW91dE5vdyhlbGVtZW50OiBJQ2VsbFZpZXdNb2RlbCk6IHZvaWQge1xuXHRcdHRoaXMuX3VwZGF0ZVBvc2l0aW9uKCk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVQb3NpdGlvbigpIHtcblx0XHRpZiAodGhpcy5jdXJyZW50Q2VsbCkge1xuXHRcdFx0aWYgKHRoaXMuY3VycmVudENlbGwuaXNJbnB1dENvbGxhcHNlZCkge1xuXHRcdFx0XHRET00uaGlkZSh0aGlzLl9leGVjdXRpb25PcmRlckxhYmVsKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdERPTS5zaG93KHRoaXMuX2V4ZWN1dGlvbk9yZGVyTGFiZWwpO1xuXHRcdFx0XHRsZXQgdG9wID0gdGhpcy5jdXJyZW50Q2VsbC5sYXlvdXRJbmZvLmVkaXRvckhlaWdodCAtIDIyICsgdGhpcy5jdXJyZW50Q2VsbC5sYXlvdXRJbmZvLnN0YXR1c0JhckhlaWdodDtcblxuXHRcdFx0XHRpZiAodGhpcy5jdXJyZW50Q2VsbCBpbnN0YW5jZW9mIENvZGVDZWxsVmlld01vZGVsKSB7XG5cdFx0XHRcdFx0Y29uc3QgZWxlbWVudFRvcCA9IHRoaXMuX25vdGVib29rRWRpdG9yLmdldEFic29sdXRlVG9wT2ZFbGVtZW50KHRoaXMuY3VycmVudENlbGwpO1xuXHRcdFx0XHRcdGNvbnN0IGVkaXRvckJvdHRvbSA9IGVsZW1lbnRUb3AgKyB0aGlzLmN1cnJlbnRDZWxsLmxheW91dEluZm8ub3V0cHV0Q29udGFpbmVyT2Zmc2V0O1xuXHRcdFx0XHRcdC8vIGFub3RoZXIgYXBwcm9hY2ggdG8gYXZvaWQgdGhlIGZsaWNrZXIgY2F1c2VkIGJ5IHN0aWNreSBzY3JvbGwgaXMgbWFudWFsbHkgY2FsY3VsYXRlIHRoZSBzY3JvbGxCb3R0b206XG5cdFx0XHRcdFx0Ly8gY29uc3Qgc2Nyb2xsQm90dG9tID0gdGhpcy5fbm90ZWJvb2tFZGl0b3Iuc2Nyb2xsVG9wICsgdGhpcy5fbm90ZWJvb2tFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLmhlaWdodCAtIDI2IC0gdGhpcy5fbm90ZWJvb2tFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLnN0aWNreUhlaWdodDtcblx0XHRcdFx0XHRjb25zdCBzY3JvbGxCb3R0b20gPSB0aGlzLl9ub3RlYm9va0VkaXRvci5zY3JvbGxCb3R0b207XG5cblx0XHRcdFx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gMjI7XG5cdFx0XHRcdFx0aWYgKHNjcm9sbEJvdHRvbSA8PSBlZGl0b3JCb3R0b20pIHtcblx0XHRcdFx0XHRcdGNvbnN0IG9mZnNldCA9IGVkaXRvckJvdHRvbSAtIHNjcm9sbEJvdHRvbTtcblx0XHRcdFx0XHRcdHRvcCAtPSBvZmZzZXQ7XG5cdFx0XHRcdFx0XHR0b3AgPSBjbGFtcChcblx0XHRcdFx0XHRcdFx0dG9wLFxuXHRcdFx0XHRcdFx0XHRsaW5lSGVpZ2h0ICsgMTIsIC8vIGxpbmUgaGVpZ2h0ICsgcGFkZGluZyBmb3Igc2luZ2xlIGxpbmVcblx0XHRcdFx0XHRcdFx0dGhpcy5jdXJyZW50Q2VsbC5sYXlvdXRJbmZvLmVkaXRvckhlaWdodCAtIGxpbmVIZWlnaHQgKyB0aGlzLmN1cnJlbnRDZWxsLmxheW91dEluZm8uc3RhdHVzQmFySGVpZ2h0XG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuX2V4ZWN1dGlvbk9yZGVyTGFiZWwuc3R5bGUudG9wID0gYCR7dG9wfXB4YDtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsYUFBYTtBQUd0QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUVsQyxTQUFTLHNDQUFzQztBQUUvQyxNQUFNLHNDQUFzQztBQUVyQyxJQUFNLG9CQUFOLGNBQWdDLGdCQUFnQjtBQUFBLEVBR3RELFlBQ2tCLGlCQUNBLHNCQUNnQyxnQ0FDaEQ7QUFDRCxVQUFNO0FBSlc7QUFDQTtBQUNnQztBQUxsRCxTQUFpQixvQkFBb0IsS0FBSyxVQUFVLElBQUksZ0JBQWdCLENBQUM7QUFTeEUsU0FBSyxVQUFVLEtBQUssZ0JBQWdCLHdCQUF3QixNQUFNO0FBQ2pFLFVBQUksS0FBSyxhQUFhO0FBQ3JCLGFBQUssa0JBQWtCLE1BQU07QUFFN0IsWUFBSSxLQUFLLGdCQUFnQixjQUFjO0FBQ3RDLGVBQUssa0JBQWtCLElBQUksS0FBSyxnQkFBZ0IsYUFBYSxZQUFZLE1BQU07QUFDOUUsZ0JBQUksS0FBSyxhQUFhO0FBQ3JCLG1CQUFLLHFCQUFxQixLQUFLLFlBQVksZ0JBQWdCO0FBQUEsWUFDNUQ7QUFBQSxVQUNELENBQUMsQ0FBQztBQUFBLFFBQ0g7QUFFQSxhQUFLLHFCQUFxQixLQUFLLFlBQVksZ0JBQWdCO0FBQUEsTUFDNUQ7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFNBQUssVUFBVSxLQUFLLGdCQUFnQixZQUFZLE1BQU07QUFDckQsV0FBSyxnQkFBZ0I7QUFBQSxJQUN0QixDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUyxjQUFjLFNBQStCO0FBQ3JELFNBQUsscUJBQXFCLFFBQVEsa0JBQWtCLElBQUk7QUFBQSxFQUN6RDtBQUFBLEVBRVEscUJBQXFCLGtCQUFnRCxhQUFhLE9BQWE7QUFDdEcsUUFBSSxLQUFLLGdCQUFnQixjQUFjLDRCQUE2QixDQUFDLEtBQUssZ0JBQWdCLGdCQUFnQixPQUFPLGlCQUFpQixtQkFBbUIsVUFBVztBQUUvSixVQUFJLE9BQU8saUJBQWlCLG1CQUFtQixZQUFZLENBQUMsY0FBYyxDQUFDLENBQUMsS0FBSywrQkFBK0IsaUJBQWlCLEtBQUssWUFBYSxHQUFHLEdBQUc7QUFDeEosY0FBTSxnQkFBZ0IsS0FBSztBQUMzQiwwQkFBa0IsTUFBTTtBQUN2QixjQUFJLEtBQUssZ0JBQWdCLGVBQWU7QUFDdkMsaUJBQUsscUJBQXFCLEtBQUssWUFBYSxrQkFBa0IsSUFBSTtBQUFBLFVBQ25FO0FBQUEsUUFDRCxHQUFHLHFDQUFxQyxLQUFLLGVBQWU7QUFDNUQ7QUFBQSxNQUNEO0FBRUEsWUFBTSxzQkFBc0IsT0FBTyxpQkFBaUIsbUJBQW1CLFdBQ3RFLElBQUksaUJBQWlCLGNBQWMsTUFDbkM7QUFDRCxXQUFLLHFCQUFxQixZQUFZO0FBQUEsSUFDdkMsT0FBTztBQUNOLFdBQUsscUJBQXFCLFlBQVk7QUFBQSxJQUN2QztBQUFBLEVBQ0Q7QUFBQSxFQUVTLFlBQVksU0FBeUIsR0FBd0M7QUFDckYsUUFBSSxFQUFFLHlCQUF5QjtBQUM5QixXQUFLLHFCQUFxQixRQUFRLGdCQUFnQjtBQUFBLElBQ25EO0FBQUEsRUFDRDtBQUFBLEVBRVMsd0JBQXdCLFNBQStCO0FBQy9ELFNBQUssZ0JBQWdCO0FBQUEsRUFDdEI7QUFBQSxFQUVRLGtCQUFrQjtBQUN6QixRQUFJLEtBQUssYUFBYTtBQUNyQixVQUFJLEtBQUssWUFBWSxrQkFBa0I7QUFDdEMsWUFBSSxLQUFLLEtBQUssb0JBQW9CO0FBQUEsTUFDbkMsT0FBTztBQUNOLFlBQUksS0FBSyxLQUFLLG9CQUFvQjtBQUNsQyxZQUFJLE1BQU0sS0FBSyxZQUFZLFdBQVcsZUFBZSxLQUFLLEtBQUssWUFBWSxXQUFXO0FBRXRGLFlBQUksS0FBSyx1QkFBdUIsbUJBQW1CO0FBQ2xELGdCQUFNLGFBQWEsS0FBSyxnQkFBZ0Isd0JBQXdCLEtBQUssV0FBVztBQUNoRixnQkFBTSxlQUFlLGFBQWEsS0FBSyxZQUFZLFdBQVc7QUFHOUQsZ0JBQU0sZUFBZSxLQUFLLGdCQUFnQjtBQUUxQyxnQkFBTSxhQUFhO0FBQ25CLGNBQUksZ0JBQWdCLGNBQWM7QUFDakMsa0JBQU0sU0FBUyxlQUFlO0FBQzlCLG1CQUFPO0FBQ1Asa0JBQU07QUFBQSxjQUNMO0FBQUEsY0FDQSxhQUFhO0FBQUE7QUFBQSxjQUNiLEtBQUssWUFBWSxXQUFXLGVBQWUsYUFBYSxLQUFLLFlBQVksV0FBVztBQUFBLFlBQ3JGO0FBQUEsVUFDRDtBQUFBLFFBQ0Q7QUFFQSxhQUFLLHFCQUFxQixNQUFNLE1BQU0sR0FBRyxHQUFHO0FBQUEsTUFDN0M7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNEO0FBbEdhLG9CQUFOO0FBQUEsRUFNSjtBQUFBLEdBTlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
