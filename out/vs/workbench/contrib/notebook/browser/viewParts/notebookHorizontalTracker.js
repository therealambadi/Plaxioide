import { addDisposableListener, EventType, getWindow } from "../../../../../base/browser/dom.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { isChrome, isMacintosh } from "../../../../../base/common/platform.js";
class NotebookHorizontalTracker extends Disposable {
  constructor(_notebookEditor, _listViewScrollablement) {
    super();
    this._notebookEditor = _notebookEditor;
    this._listViewScrollablement = _listViewScrollablement;
    this._register(addDisposableListener(this._listViewScrollablement, EventType.MOUSE_WHEEL, (event) => {
      let deltaX = event.deltaX;
      let deltaY = event.deltaY;
      let wheelDeltaX = event.wheelDeltaX;
      let wheelDeltaY = event.wheelDeltaY;
      const wheelDelta = event.wheelDelta;
      const shiftConvert = !isMacintosh && event.shiftKey;
      if (shiftConvert && !deltaX) {
        deltaX = deltaY;
        deltaY = 0;
        wheelDeltaX = wheelDeltaY;
        wheelDeltaY = 0;
      }
      if (deltaX === 0) {
        return;
      }
      const hoveringOnEditor = this._notebookEditor.codeEditors.find((editor) => {
        const editorLayout = editor[1].getLayoutInfo();
        if (editorLayout.contentWidth === editorLayout.width) {
          return false;
        }
        const editorDOM = editor[1].getDomNode();
        if (editorDOM && editorDOM.contains(event.target)) {
          return true;
        }
        return false;
      });
      if (!hoveringOnEditor) {
        return;
      }
      const targetWindow = getWindow(event);
      const evt = {
        deltaMode: event.deltaMode,
        deltaX,
        deltaY: 0,
        deltaZ: 0,
        wheelDelta: wheelDelta && isChrome ? wheelDelta / targetWindow.devicePixelRatio : wheelDelta,
        wheelDeltaX: wheelDeltaX && isChrome ? wheelDeltaX / targetWindow.devicePixelRatio : wheelDeltaX,
        wheelDeltaY: 0,
        detail: event.detail,
        shiftKey: event.shiftKey,
        type: event.type,
        defaultPrevented: false,
        preventDefault: () => {
        },
        stopPropagation: () => {
        }
      };
      hoveringOnEditor[1].delegateScrollFromMouseWheelEvent(evt);
    }));
  }
}
export {
  NotebookHorizontalTracker
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXdQYXJ0cy9ub3RlYm9va0hvcml6b250YWxUcmFja2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgYWRkRGlzcG9zYWJsZUxpc3RlbmVyLCBFdmVudFR5cGUsIGdldFdpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSU1vdXNlV2hlZWxFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNDaHJvbWUsIGlzTWFjaW50b3NoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2NvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRWRpdG9yRGVsZWdhdGUgfSBmcm9tICcuLi9ub3RlYm9va0Jyb3dzZXIuanMnO1xuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tIb3Jpem9udGFsVHJhY2tlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9ub3RlYm9va0VkaXRvcjogSU5vdGVib29rRWRpdG9yRGVsZWdhdGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbGlzdFZpZXdTY3JvbGxhYmxlbWVudDogSFRNTEVsZW1lbnQsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5fbGlzdFZpZXdTY3JvbGxhYmxlbWVudCwgRXZlbnRUeXBlLk1PVVNFX1dIRUVMLCAoZXZlbnQ6IElNb3VzZVdoZWVsRXZlbnQpID0+IHtcblx0XHRcdGxldCBkZWx0YVggPSBldmVudC5kZWx0YVg7XG5cdFx0XHRsZXQgZGVsdGFZID0gZXZlbnQuZGVsdGFZO1xuXHRcdFx0bGV0IHdoZWVsRGVsdGFYID0gZXZlbnQud2hlZWxEZWx0YVg7XG5cdFx0XHRsZXQgd2hlZWxEZWx0YVkgPSBldmVudC53aGVlbERlbHRhWTtcblx0XHRcdGNvbnN0IHdoZWVsRGVsdGEgPSBldmVudC53aGVlbERlbHRhO1xuXG5cdFx0XHRjb25zdCBzaGlmdENvbnZlcnQgPSAhaXNNYWNpbnRvc2ggJiYgZXZlbnQuc2hpZnRLZXk7XG5cdFx0XHRpZiAoc2hpZnRDb252ZXJ0ICYmICFkZWx0YVgpIHtcblx0XHRcdFx0ZGVsdGFYID0gZGVsdGFZO1xuXHRcdFx0XHRkZWx0YVkgPSAwO1xuXHRcdFx0XHR3aGVlbERlbHRhWCA9IHdoZWVsRGVsdGFZO1xuXHRcdFx0XHR3aGVlbERlbHRhWSA9IDA7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChkZWx0YVggPT09IDApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBob3ZlcmluZ09uRWRpdG9yID0gdGhpcy5fbm90ZWJvb2tFZGl0b3IuY29kZUVkaXRvcnMuZmluZChlZGl0b3IgPT4ge1xuXHRcdFx0XHRjb25zdCBlZGl0b3JMYXlvdXQgPSBlZGl0b3JbMV0uZ2V0TGF5b3V0SW5mbygpO1xuXHRcdFx0XHRpZiAoZWRpdG9yTGF5b3V0LmNvbnRlbnRXaWR0aCA9PT0gZWRpdG9yTGF5b3V0LndpZHRoKSB7XG5cdFx0XHRcdFx0Ly8gbm8gb3ZlcmZsb3dcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBlZGl0b3JET00gPSBlZGl0b3JbMV0uZ2V0RG9tTm9kZSgpO1xuXHRcdFx0XHRpZiAoZWRpdG9yRE9NICYmIGVkaXRvckRPTS5jb250YWlucyhldmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKCFob3ZlcmluZ09uRWRpdG9yKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgdGFyZ2V0V2luZG93ID0gZ2V0V2luZG93KGV2ZW50KTtcblx0XHRcdGNvbnN0IGV2dCA9IHtcblx0XHRcdFx0ZGVsdGFNb2RlOiBldmVudC5kZWx0YU1vZGUsXG5cdFx0XHRcdGRlbHRhWDogZGVsdGFYLFxuXHRcdFx0XHRkZWx0YVk6IDAsXG5cdFx0XHRcdGRlbHRhWjogMCxcblx0XHRcdFx0d2hlZWxEZWx0YTogd2hlZWxEZWx0YSAmJiBpc0Nocm9tZSA/ICh3aGVlbERlbHRhIC8gdGFyZ2V0V2luZG93LmRldmljZVBpeGVsUmF0aW8pIDogd2hlZWxEZWx0YSxcblx0XHRcdFx0d2hlZWxEZWx0YVg6IHdoZWVsRGVsdGFYICYmIGlzQ2hyb21lID8gKHdoZWVsRGVsdGFYIC8gdGFyZ2V0V2luZG93LmRldmljZVBpeGVsUmF0aW8pIDogd2hlZWxEZWx0YVgsXG5cdFx0XHRcdHdoZWVsRGVsdGFZOiAwLFxuXHRcdFx0XHRkZXRhaWw6IGV2ZW50LmRldGFpbCxcblx0XHRcdFx0c2hpZnRLZXk6IGV2ZW50LnNoaWZ0S2V5LFxuXHRcdFx0XHR0eXBlOiBldmVudC50eXBlLFxuXHRcdFx0XHRkZWZhdWx0UHJldmVudGVkOiBmYWxzZSxcblx0XHRcdFx0cHJldmVudERlZmF1bHQ6ICgpID0+IHsgfSxcblx0XHRcdFx0c3RvcFByb3BhZ2F0aW9uOiAoKSA9PiB7IH1cblx0XHRcdH07XG5cblx0XHRcdChob3ZlcmluZ09uRWRpdG9yWzFdIGFzIENvZGVFZGl0b3JXaWRnZXQpLmRlbGVnYXRlU2Nyb2xsRnJvbU1vdXNlV2hlZWxFdmVudChldnQgYXMgYW55KTtcblx0XHR9KSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsdUJBQXVCLFdBQVcsaUJBQWlCO0FBRTVELFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsVUFBVSxtQkFBbUI7QUFJL0IsTUFBTSxrQ0FBa0MsV0FBVztBQUFBLEVBQ3pELFlBQ2tCLGlCQUNBLHlCQUNoQjtBQUNELFVBQU07QUFIVztBQUNBO0FBSWpCLFNBQUssVUFBVSxzQkFBc0IsS0FBSyx5QkFBeUIsVUFBVSxhQUFhLENBQUMsVUFBNEI7QUFDdEgsVUFBSSxTQUFTLE1BQU07QUFDbkIsVUFBSSxTQUFTLE1BQU07QUFDbkIsVUFBSSxjQUFjLE1BQU07QUFDeEIsVUFBSSxjQUFjLE1BQU07QUFDeEIsWUFBTSxhQUFhLE1BQU07QUFFekIsWUFBTSxlQUFlLENBQUMsZUFBZSxNQUFNO0FBQzNDLFVBQUksZ0JBQWdCLENBQUMsUUFBUTtBQUM1QixpQkFBUztBQUNULGlCQUFTO0FBQ1Qsc0JBQWM7QUFDZCxzQkFBYztBQUFBLE1BQ2Y7QUFFQSxVQUFJLFdBQVcsR0FBRztBQUNqQjtBQUFBLE1BQ0Q7QUFFQSxZQUFNLG1CQUFtQixLQUFLLGdCQUFnQixZQUFZLEtBQUssWUFBVTtBQUN4RSxjQUFNLGVBQWUsT0FBTyxDQUFDLEVBQUUsY0FBYztBQUM3QyxZQUFJLGFBQWEsaUJBQWlCLGFBQWEsT0FBTztBQUVyRCxpQkFBTztBQUFBLFFBQ1I7QUFFQSxjQUFNLFlBQVksT0FBTyxDQUFDLEVBQUUsV0FBVztBQUN2QyxZQUFJLGFBQWEsVUFBVSxTQUFTLE1BQU0sTUFBcUIsR0FBRztBQUNqRSxpQkFBTztBQUFBLFFBQ1I7QUFFQSxlQUFPO0FBQUEsTUFDUixDQUFDO0FBRUQsVUFBSSxDQUFDLGtCQUFrQjtBQUN0QjtBQUFBLE1BQ0Q7QUFFQSxZQUFNLGVBQWUsVUFBVSxLQUFLO0FBQ3BDLFlBQU0sTUFBTTtBQUFBLFFBQ1gsV0FBVyxNQUFNO0FBQUEsUUFDakI7QUFBQSxRQUNBLFFBQVE7QUFBQSxRQUNSLFFBQVE7QUFBQSxRQUNSLFlBQVksY0FBYyxXQUFZLGFBQWEsYUFBYSxtQkFBb0I7QUFBQSxRQUNwRixhQUFhLGVBQWUsV0FBWSxjQUFjLGFBQWEsbUJBQW9CO0FBQUEsUUFDdkYsYUFBYTtBQUFBLFFBQ2IsUUFBUSxNQUFNO0FBQUEsUUFDZCxVQUFVLE1BQU07QUFBQSxRQUNoQixNQUFNLE1BQU07QUFBQSxRQUNaLGtCQUFrQjtBQUFBLFFBQ2xCLGdCQUFnQixNQUFNO0FBQUEsUUFBRTtBQUFBLFFBQ3hCLGlCQUFpQixNQUFNO0FBQUEsUUFBRTtBQUFBLE1BQzFCO0FBRUEsTUFBQyxpQkFBaUIsQ0FBQyxFQUF1QixrQ0FBa0MsR0FBVTtBQUFBLElBQ3ZGLENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFDRDsiLAogICJuYW1lcyI6IFtdCn0K
