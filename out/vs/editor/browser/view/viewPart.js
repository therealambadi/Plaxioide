import { ViewEventHandler } from "../../common/viewEventHandler.js";
class ViewPart extends ViewEventHandler {
  constructor(context) {
    super();
    this._context = context;
    this._context.addEventHandler(this);
  }
  dispose() {
    this._context.removeEventHandler(this);
    super.dispose();
  }
}
var PartFingerprint = /* @__PURE__ */ ((PartFingerprint2) => {
  PartFingerprint2[PartFingerprint2["None"] = 0] = "None";
  PartFingerprint2[PartFingerprint2["ContentWidgets"] = 1] = "ContentWidgets";
  PartFingerprint2[PartFingerprint2["OverflowingContentWidgets"] = 2] = "OverflowingContentWidgets";
  PartFingerprint2[PartFingerprint2["OverflowGuard"] = 3] = "OverflowGuard";
  PartFingerprint2[PartFingerprint2["OverlayWidgets"] = 4] = "OverlayWidgets";
  PartFingerprint2[PartFingerprint2["OverflowingOverlayWidgets"] = 5] = "OverflowingOverlayWidgets";
  PartFingerprint2[PartFingerprint2["ScrollableElement"] = 6] = "ScrollableElement";
  PartFingerprint2[PartFingerprint2["TextArea"] = 7] = "TextArea";
  PartFingerprint2[PartFingerprint2["ViewLines"] = 8] = "ViewLines";
  PartFingerprint2[PartFingerprint2["Minimap"] = 9] = "Minimap";
  PartFingerprint2[PartFingerprint2["ViewLinesGpu"] = 10] = "ViewLinesGpu";
  return PartFingerprint2;
})(PartFingerprint || {});
class PartFingerprints {
  static write(target, partId) {
    target.setAttribute("data-mprt", String(partId));
  }
  static read(target) {
    const r = target.getAttribute("data-mprt");
    if (r === null) {
      return 0 /* None */;
    }
    return parseInt(r, 10);
  }
  static collect(child, stopAt) {
    const result = [];
    let resultLen = 0;
    while (child && child !== child.ownerDocument.body) {
      if (child === stopAt) {
        break;
      }
      if (child.nodeType === child.ELEMENT_NODE) {
        result[resultLen++] = this.read(child);
      }
      child = child.parentElement;
    }
    const r = new Uint8Array(resultLen);
    for (let i = 0; i < resultLen; i++) {
      r[i] = result[resultLen - i - 1];
    }
    return r;
  }
}
export {
  PartFingerprint,
  PartFingerprints,
  ViewPart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci92aWV3L3ZpZXdQYXJ0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRmFzdERvbU5vZGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZmFzdERvbU5vZGUuanMnO1xuaW1wb3J0IHsgUmVuZGVyaW5nQ29udGV4dCwgUmVzdHJpY3RlZFJlbmRlcmluZ0NvbnRleHQgfSBmcm9tICcuL3JlbmRlcmluZ0NvbnRleHQuanMnO1xuaW1wb3J0IHsgVmlld0NvbnRleHQgfSBmcm9tICcuLi8uLi9jb21tb24vdmlld01vZGVsL3ZpZXdDb250ZXh0LmpzJztcbmltcG9ydCB7IFZpZXdFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb21tb24vdmlld0V2ZW50SGFuZGxlci5qcyc7XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBWaWV3UGFydCBleHRlbmRzIFZpZXdFdmVudEhhbmRsZXIge1xuXG5cdF9jb250ZXh0OiBWaWV3Q29udGV4dDtcblxuXHRjb25zdHJ1Y3Rvcihjb250ZXh0OiBWaWV3Q29udGV4dCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fY29udGV4dCA9IGNvbnRleHQ7XG5cdFx0dGhpcy5fY29udGV4dC5hZGRFdmVudEhhbmRsZXIodGhpcyk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9jb250ZXh0LnJlbW92ZUV2ZW50SGFuZGxlcih0aGlzKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwdWJsaWMgYWJzdHJhY3QgcHJlcGFyZVJlbmRlcihjdHg6IFJlbmRlcmluZ0NvbnRleHQpOiB2b2lkO1xuXHRwdWJsaWMgYWJzdHJhY3QgcmVuZGVyKGN0eDogUmVzdHJpY3RlZFJlbmRlcmluZ0NvbnRleHQpOiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgZW51bSBQYXJ0RmluZ2VycHJpbnQge1xuXHROb25lLFxuXHRDb250ZW50V2lkZ2V0cyxcblx0T3ZlcmZsb3dpbmdDb250ZW50V2lkZ2V0cyxcblx0T3ZlcmZsb3dHdWFyZCxcblx0T3ZlcmxheVdpZGdldHMsXG5cdE92ZXJmbG93aW5nT3ZlcmxheVdpZGdldHMsXG5cdFNjcm9sbGFibGVFbGVtZW50LFxuXHRUZXh0QXJlYSxcblx0Vmlld0xpbmVzLFxuXHRNaW5pbWFwLFxuXHRWaWV3TGluZXNHcHVcbn1cblxuZXhwb3J0IGNsYXNzIFBhcnRGaW5nZXJwcmludHMge1xuXG5cdHB1YmxpYyBzdGF0aWMgd3JpdGUodGFyZ2V0OiBFbGVtZW50IHwgRmFzdERvbU5vZGU8SFRNTEVsZW1lbnQ+LCBwYXJ0SWQ6IFBhcnRGaW5nZXJwcmludCkge1xuXHRcdHRhcmdldC5zZXRBdHRyaWJ1dGUoJ2RhdGEtbXBydCcsIFN0cmluZyhwYXJ0SWQpKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZCh0YXJnZXQ6IEVsZW1lbnQpOiBQYXJ0RmluZ2VycHJpbnQge1xuXHRcdGNvbnN0IHIgPSB0YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLW1wcnQnKTtcblx0XHRpZiAociA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIFBhcnRGaW5nZXJwcmludC5Ob25lO1xuXHRcdH1cblx0XHRyZXR1cm4gcGFyc2VJbnQociwgMTApO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBjb2xsZWN0KGNoaWxkOiBFbGVtZW50IHwgbnVsbCwgc3RvcEF0OiBFbGVtZW50KTogVWludDhBcnJheSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBQYXJ0RmluZ2VycHJpbnRbXSA9IFtdO1xuXHRcdGxldCByZXN1bHRMZW4gPSAwO1xuXG5cdFx0d2hpbGUgKGNoaWxkICYmIGNoaWxkICE9PSBjaGlsZC5vd25lckRvY3VtZW50LmJvZHkpIHtcblx0XHRcdGlmIChjaGlsZCA9PT0gc3RvcEF0KSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGNoaWxkLm5vZGVUeXBlID09PSBjaGlsZC5FTEVNRU5UX05PREUpIHtcblx0XHRcdFx0cmVzdWx0W3Jlc3VsdExlbisrXSA9IHRoaXMucmVhZChjaGlsZCk7XG5cdFx0XHR9XG5cdFx0XHRjaGlsZCA9IGNoaWxkLnBhcmVudEVsZW1lbnQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgciA9IG5ldyBVaW50OEFycmF5KHJlc3VsdExlbik7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCByZXN1bHRMZW47IGkrKykge1xuXHRcdFx0cltpXSA9IHJlc3VsdFtyZXN1bHRMZW4gLSBpIC0gMV07XG5cdFx0fVxuXHRcdHJldHVybiByO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFRQSxTQUFTLHdCQUF3QjtBQUUxQixNQUFlLGlCQUFpQixpQkFBaUI7QUFBQSxFQUl2RCxZQUFZLFNBQXNCO0FBQ2pDLFVBQU07QUFDTixTQUFLLFdBQVc7QUFDaEIsU0FBSyxTQUFTLGdCQUFnQixJQUFJO0FBQUEsRUFDbkM7QUFBQSxFQUVnQixVQUFnQjtBQUMvQixTQUFLLFNBQVMsbUJBQW1CLElBQUk7QUFDckMsVUFBTSxRQUFRO0FBQUEsRUFDZjtBQUlEO0FBRU8sSUFBVyxrQkFBWCxrQkFBV0EscUJBQVg7QUFDTixFQUFBQSxrQ0FBQTtBQUNBLEVBQUFBLGtDQUFBO0FBQ0EsRUFBQUEsa0NBQUE7QUFDQSxFQUFBQSxrQ0FBQTtBQUNBLEVBQUFBLGtDQUFBO0FBQ0EsRUFBQUEsa0NBQUE7QUFDQSxFQUFBQSxrQ0FBQTtBQUNBLEVBQUFBLGtDQUFBO0FBQ0EsRUFBQUEsa0NBQUE7QUFDQSxFQUFBQSxrQ0FBQTtBQUNBLEVBQUFBLGtDQUFBO0FBWGlCLFNBQUFBO0FBQUEsR0FBQTtBQWNYLE1BQU0saUJBQWlCO0FBQUEsRUFFN0IsT0FBYyxNQUFNLFFBQTRDLFFBQXlCO0FBQ3hGLFdBQU8sYUFBYSxhQUFhLE9BQU8sTUFBTSxDQUFDO0FBQUEsRUFDaEQ7QUFBQSxFQUVBLE9BQWMsS0FBSyxRQUFrQztBQUNwRCxVQUFNLElBQUksT0FBTyxhQUFhLFdBQVc7QUFDekMsUUFBSSxNQUFNLE1BQU07QUFDZixhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU8sU0FBUyxHQUFHLEVBQUU7QUFBQSxFQUN0QjtBQUFBLEVBRUEsT0FBYyxRQUFRLE9BQXVCLFFBQTZCO0FBQ3pFLFVBQU0sU0FBNEIsQ0FBQztBQUNuQyxRQUFJLFlBQVk7QUFFaEIsV0FBTyxTQUFTLFVBQVUsTUFBTSxjQUFjLE1BQU07QUFDbkQsVUFBSSxVQUFVLFFBQVE7QUFDckI7QUFBQSxNQUNEO0FBQ0EsVUFBSSxNQUFNLGFBQWEsTUFBTSxjQUFjO0FBQzFDLGVBQU8sV0FBVyxJQUFJLEtBQUssS0FBSyxLQUFLO0FBQUEsTUFDdEM7QUFDQSxjQUFRLE1BQU07QUFBQSxJQUNmO0FBRUEsVUFBTSxJQUFJLElBQUksV0FBVyxTQUFTO0FBQ2xDLGFBQVMsSUFBSSxHQUFHLElBQUksV0FBVyxLQUFLO0FBQ25DLFFBQUUsQ0FBQyxJQUFJLE9BQU8sWUFBWSxJQUFJLENBQUM7QUFBQSxJQUNoQztBQUNBLFdBQU87QUFBQSxFQUNSO0FBQ0Q7IiwKICAibmFtZXMiOiBbIlBhcnRGaW5nZXJwcmludCJdCn0K
