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
import { $, append, EventHelper, clearNode } from "../../../base/browser/dom.js";
import { DomEmitter } from "../../../base/browser/event.js";
import { StandardKeyboardEvent } from "../../../base/browser/keyboardEvent.js";
import { EventType as TouchEventType, Gesture } from "../../../base/browser/touch.js";
import { Event } from "../../../base/common/event.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { IOpenerService } from "../common/opener.js";
import "./link.css";
import { getDefaultHoverDelegate } from "../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../hover/browser/hover.js";
let Link = class extends Disposable {
  constructor(container, _link, options = {}, _hoverService, openerService) {
    super();
    this._link = _link;
    this._hoverService = _hoverService;
    this._enabled = true;
    this.el = append(container, $("a.monaco-link", {
      tabIndex: _link.tabIndex ?? 0,
      href: _link.href
    }, _link.label));
    this.hoverDelegate = options.hoverDelegate ?? getDefaultHoverDelegate("mouse");
    this.setTooltip(_link.title);
    this.el.setAttribute("role", "button");
    const onClickEmitter = this._register(new DomEmitter(this.el, "click"));
    const onKeyPress = this._register(new DomEmitter(this.el, "keypress"));
    const onEnterPress = Event.chain(
      onKeyPress.event,
      ($2) => $2.map((e) => new StandardKeyboardEvent(e)).filter((e) => e.keyCode === KeyCode.Enter)
    );
    const onTap = this._register(new DomEmitter(this.el, TouchEventType.Tap)).event;
    this._register(Gesture.addTarget(this.el));
    const onOpen = Event.any(onClickEmitter.event, onEnterPress, onTap);
    this._register(onOpen((e) => {
      if (!this.enabled) {
        return;
      }
      EventHelper.stop(e, true);
      if (options?.opener) {
        options.opener(this._link.href);
      } else {
        openerService.open(this._link.href, { allowCommands: true });
      }
    }));
    this.enabled = true;
  }
  get enabled() {
    return this._enabled;
  }
  set enabled(enabled) {
    if (enabled) {
      this.el.setAttribute("aria-disabled", "false");
      this.el.tabIndex = 0;
      this.el.style.pointerEvents = "auto";
      this.el.style.opacity = "1";
      this.el.style.cursor = "pointer";
      this._enabled = false;
    } else {
      this.el.setAttribute("aria-disabled", "true");
      this.el.tabIndex = -1;
      this.el.style.pointerEvents = "none";
      this.el.style.opacity = "0.4";
      this.el.style.cursor = "default";
      this._enabled = true;
    }
    this._enabled = enabled;
  }
  set link(link) {
    if (typeof link.label === "string") {
      this.el.textContent = link.label;
    } else {
      clearNode(this.el);
      this.el.appendChild(link.label);
    }
    this.el.href = link.href;
    if (typeof link.tabIndex !== "undefined") {
      this.el.tabIndex = link.tabIndex;
    }
    this.setTooltip(link.title);
    this._link = link;
  }
  setTooltip(title) {
    if (this.hoverDelegate.showNativeHover) {
      this.el.title = title ?? "";
    } else if (!this.hover && title) {
      this.hover = this._register(this._hoverService.setupManagedHover(this.hoverDelegate, this.el, title));
    } else if (this.hover) {
      this.hover.update(title);
    }
  }
};
Link = __decorateClass([
  __decorateParam(3, IHoverService),
  __decorateParam(4, IOpenerService)
], Link);
export {
  Link
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9vcGVuZXIvYnJvd3Nlci9saW5rLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgJCwgYXBwZW5kLCBFdmVudEhlbHBlciwgRXZlbnRMaWtlLCBjbGVhck5vZGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IERvbUVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZXZlbnQuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgRXZlbnRUeXBlIGFzIFRvdWNoRXZlbnRUeXBlLCBHZXN0dXJlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3RvdWNoLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCAnLi9saW5rLmNzcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlLmpzJztcbmltcG9ydCB0eXBlIHsgSU1hbmFnZWRIb3ZlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUxpbmtEZXNjcmlwdG9yIHtcblx0cmVhZG9ubHkgbGFiZWw6IHN0cmluZyB8IEhUTUxFbGVtZW50O1xuXHRyZWFkb25seSBocmVmOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHRpdGxlPzogc3RyaW5nO1xuXHRyZWFkb25seSB0YWJJbmRleD86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTGlua09wdGlvbnMge1xuXHRyZWFkb25seSBvcGVuZXI/OiAoaHJlZjogc3RyaW5nKSA9PiB2b2lkO1xuXHRyZWFkb25seSBob3ZlckRlbGVnYXRlPzogSUhvdmVyRGVsZWdhdGU7XG5cdHJlYWRvbmx5IHRleHRMaW5rRm9yZWdyb3VuZD86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIExpbmsgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIGVsOiBIVE1MQW5jaG9yRWxlbWVudDtcblx0cHJpdmF0ZSBob3Zlcj86IElNYW5hZ2VkSG92ZXI7XG5cdHByaXZhdGUgaG92ZXJEZWxlZ2F0ZTogSUhvdmVyRGVsZWdhdGU7XG5cblx0cHJpdmF0ZSBfZW5hYmxlZDogYm9vbGVhbiA9IHRydWU7XG5cblx0Z2V0IGVuYWJsZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2VuYWJsZWQ7XG5cdH1cblxuXHRzZXQgZW5hYmxlZChlbmFibGVkOiBib29sZWFuKSB7XG5cdFx0aWYgKGVuYWJsZWQpIHtcblx0XHRcdHRoaXMuZWwuc2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJywgJ2ZhbHNlJyk7XG5cdFx0XHR0aGlzLmVsLnRhYkluZGV4ID0gMDtcblx0XHRcdHRoaXMuZWwuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdhdXRvJztcblx0XHRcdHRoaXMuZWwuc3R5bGUub3BhY2l0eSA9ICcxJztcblx0XHRcdHRoaXMuZWwuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuXHRcdFx0dGhpcy5fZW5hYmxlZCA9IGZhbHNlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmVsLnNldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcsICd0cnVlJyk7XG5cdFx0XHR0aGlzLmVsLnRhYkluZGV4ID0gLTE7XG5cdFx0XHR0aGlzLmVsLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG5cdFx0XHR0aGlzLmVsLnN0eWxlLm9wYWNpdHkgPSAnMC40Jztcblx0XHRcdHRoaXMuZWwuc3R5bGUuY3Vyc29yID0gJ2RlZmF1bHQnO1xuXHRcdFx0dGhpcy5fZW5hYmxlZCA9IHRydWU7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZW5hYmxlZCA9IGVuYWJsZWQ7XG5cdH1cblxuXHRzZXQgbGluayhsaW5rOiBJTGlua0Rlc2NyaXB0b3IpIHtcblx0XHRpZiAodHlwZW9mIGxpbmsubGFiZWwgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLmVsLnRleHRDb250ZW50ID0gbGluay5sYWJlbDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y2xlYXJOb2RlKHRoaXMuZWwpO1xuXHRcdFx0dGhpcy5lbC5hcHBlbmRDaGlsZChsaW5rLmxhYmVsKTtcblx0XHR9XG5cblx0XHR0aGlzLmVsLmhyZWYgPSBsaW5rLmhyZWY7XG5cblx0XHRpZiAodHlwZW9mIGxpbmsudGFiSW5kZXggIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHR0aGlzLmVsLnRhYkluZGV4ID0gbGluay50YWJJbmRleDtcblx0XHR9XG5cblx0XHR0aGlzLnNldFRvb2x0aXAobGluay50aXRsZSk7XG5cblx0XHR0aGlzLl9saW5rID0gbGluaztcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSBfbGluazogSUxpbmtEZXNjcmlwdG9yLFxuXHRcdG9wdGlvbnM6IElMaW5rT3B0aW9ucyA9IHt9LFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuZWwgPSBhcHBlbmQoY29udGFpbmVyLCAkKCdhLm1vbmFjby1saW5rJywge1xuXHRcdFx0dGFiSW5kZXg6IF9saW5rLnRhYkluZGV4ID8/IDAsXG5cdFx0XHRocmVmOiBfbGluay5ocmVmLFxuXHRcdH0sIF9saW5rLmxhYmVsKSk7XG5cblx0XHR0aGlzLmhvdmVyRGVsZWdhdGUgPSBvcHRpb25zLmhvdmVyRGVsZWdhdGUgPz8gZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyk7XG5cdFx0dGhpcy5zZXRUb29sdGlwKF9saW5rLnRpdGxlKTtcblxuXHRcdHRoaXMuZWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2J1dHRvbicpO1xuXG5cdFx0Y29uc3Qgb25DbGlja0VtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRG9tRW1pdHRlcih0aGlzLmVsLCAnY2xpY2snKSk7XG5cdFx0Y29uc3Qgb25LZXlQcmVzcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEb21FbWl0dGVyKHRoaXMuZWwsICdrZXlwcmVzcycpKTtcblx0XHRjb25zdCBvbkVudGVyUHJlc3MgPSBFdmVudC5jaGFpbihvbktleVByZXNzLmV2ZW50LCAkID0+XG5cdFx0XHQkLm1hcChlID0+IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSkpXG5cdFx0XHRcdC5maWx0ZXIoZSA9PiBlLmtleUNvZGUgPT09IEtleUNvZGUuRW50ZXIpXG5cdFx0KTtcblx0XHRjb25zdCBvblRhcCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEb21FbWl0dGVyKHRoaXMuZWwsIFRvdWNoRXZlbnRUeXBlLlRhcCkpLmV2ZW50O1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEdlc3R1cmUuYWRkVGFyZ2V0KHRoaXMuZWwpKTtcblx0XHRjb25zdCBvbk9wZW4gPSBFdmVudC5hbnk8RXZlbnRMaWtlPihvbkNsaWNrRW1pdHRlci5ldmVudCwgb25FbnRlclByZXNzLCBvblRhcCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihvbk9wZW4oZSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuZW5hYmxlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZSwgdHJ1ZSk7XG5cblx0XHRcdGlmIChvcHRpb25zPy5vcGVuZXIpIHtcblx0XHRcdFx0b3B0aW9ucy5vcGVuZXIodGhpcy5fbGluay5ocmVmKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG9wZW5lclNlcnZpY2Uub3Blbih0aGlzLl9saW5rLmhyZWYsIHsgYWxsb3dDb21tYW5kczogdHJ1ZSB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRUb29sdGlwKHRpdGxlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5ob3ZlckRlbGVnYXRlLnNob3dOYXRpdmVIb3Zlcikge1xuXHRcdFx0dGhpcy5lbC50aXRsZSA9IHRpdGxlID8/ICcnO1xuXHRcdH0gZWxzZSBpZiAoIXRoaXMuaG92ZXIgJiYgdGl0bGUpIHtcblx0XHRcdHRoaXMuaG92ZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIodGhpcy5ob3ZlckRlbGVnYXRlLCB0aGlzLmVsLCB0aXRsZSkpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5ob3Zlcikge1xuXHRcdFx0dGhpcy5ob3Zlci51cGRhdGUodGl0bGUpO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLEdBQUcsUUFBUSxhQUF3QixpQkFBaUI7QUFDN0QsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxhQUFhLGdCQUFnQixlQUFlO0FBQ3JELFNBQVMsYUFBYTtBQUN0QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxzQkFBc0I7QUFDL0IsT0FBTztBQUNQLFNBQVMsK0JBQStCO0FBR3hDLFNBQVMscUJBQXFCO0FBZXZCLElBQU0sT0FBTixjQUFtQixXQUFXO0FBQUEsRUFtRHBDLFlBQ0MsV0FDUSxPQUNSLFVBQXdCLENBQUMsR0FDTyxlQUNoQixlQUNmO0FBQ0QsVUFBTTtBQUxFO0FBRXdCO0FBakRqQyxTQUFRLFdBQW9CO0FBc0QzQixTQUFLLEtBQUssT0FBTyxXQUFXLEVBQUUsaUJBQWlCO0FBQUEsTUFDOUMsVUFBVSxNQUFNLFlBQVk7QUFBQSxNQUM1QixNQUFNLE1BQU07QUFBQSxJQUNiLEdBQUcsTUFBTSxLQUFLLENBQUM7QUFFZixTQUFLLGdCQUFnQixRQUFRLGlCQUFpQix3QkFBd0IsT0FBTztBQUM3RSxTQUFLLFdBQVcsTUFBTSxLQUFLO0FBRTNCLFNBQUssR0FBRyxhQUFhLFFBQVEsUUFBUTtBQUVyQyxVQUFNLGlCQUFpQixLQUFL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
