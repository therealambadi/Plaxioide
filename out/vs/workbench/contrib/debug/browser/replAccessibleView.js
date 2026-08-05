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
import { AccessibleViewProviderId, AccessibleViewType, IAccessibleViewService } from "../../../../platform/accessibility/browser/accessibleView.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { getReplView } from "./repl.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Position } from "../../../../editor/common/core/position.js";
class ReplAccessibleView {
  constructor() {
    this.priority = 70;
    this.name = "debugConsole";
    this.when = ContextKeyExpr.equals("focusedView", "workbench.panel.repl.view");
    this.type = AccessibleViewType.View;
  }
  getProvider(accessor) {
    const viewsService = accessor.get(IViewsService);
    const accessibleViewService = accessor.get(IAccessibleViewService);
    const replView = getReplView(viewsService);
    if (!replView) {
      return void 0;
    }
    const focusedElement = replView.getFocusedElement();
    return new ReplOutputAccessibleViewProvider(replView, focusedElement, accessibleViewService);
  }
}
let ReplOutputAccessibleViewProvider = class extends Disposable {
  constructor(_replView, _focusedElement, _accessibleViewService) {
    super();
    this._replView = _replView;
    this._focusedElement = _focusedElement;
    this._accessibleViewService = _accessibleViewService;
    this.id = AccessibleViewProviderId.Repl;
    this._onDidChangeContent = this._register(new Emitter());
    this.onDidChangeContent = this._onDidChangeContent.event;
    this._onDidResolveChildren = this._register(new Emitter());
    this.onDidResolveChildren = this._onDidResolveChildren.event;
    this.verbositySettingKey = AccessibilityVerbositySettingId.Debug;
    this.options = {
      type: AccessibleViewType.View
    };
    this._elementPositionMap = /* @__PURE__ */ new Map();
    this._treeHadFocus = false;
    this._treeHadFocus = !!_focusedElement;
  }
  provideContent() {
    const debugSession = this._replView.getDebugSession();
    if (!debugSession) {
      return "No debug session available.";
    }
    const elements = debugSession.getReplElements();
    if (!elements.length) {
      return "No output in the debug console.";
    }
    if (!this._content) {
      this._updateContent(elements);
    }
    return this._content ?? elements.map((e) => e.toString(true)).join("\n");
  }
  onClose() {
    this._content = void 0;
    this._elementPositionMap.clear();
    if (this._treeHadFocus) {
      return this._replView.focusTree();
    }
    this._replView.getReplInput().focus();
  }
  onOpen() {
    this._register(this.onDidResolveChildren(() => {
      this._onDidChangeContent.fire();
      queueMicrotask(() => {
        if (this._focusedElement) {
          const position = this._elementPositionMap.get(this._focusedElement.getId());
          if (position) {
            this._accessibleViewService.setPosition(position, true);
          }
        }
      });
    }));
  }
  async _updateContent(elements) {
    const dataSource = this._replView.getReplDataSource();
    if (!dataSource) {
      return;
    }
    let line = 1;
    const content = [];
    for (const e of elements) {
      content.push(e.toString().replace(/\n/g, ""));
      this._elementPositionMap.set(e.getId(), new Position(line, 1));
      line++;
      if (dataSource.hasChildren(e)) {
        const childContent = [];
        const children = await dataSource.getChildren(e);
        for (const child of children) {
          const id = child.getId();
          if (!this._elementPositionMap.has(id)) {
            this._elementPositionMap.set(id, new Position(line, 1));
          }
          childContent.push("  " + child.toString());
          line++;
        }
        content.push(childContent.join("\n"));
      }
    }
    this._content = content.join("\n");
    this._onDidResolveChildren.fire();
  }
};
ReplOutputAccessibleViewProvider = __decorateClass([
  __decorateParam(2, IAccessibleViewService)
], ReplOutputAccessibleViewProvider);
export {
  ReplAccessibleView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL3JlcGxBY2Nlc3NpYmxlVmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZCwgQWNjZXNzaWJsZVZpZXdUeXBlLCBJQWNjZXNzaWJsZVZpZXdDb250ZW50UHJvdmlkZXIsIElBY2Nlc3NpYmxlVmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJsZVZpZXcuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZCB9IGZyb20gJy4uLy4uL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5Q29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmVwbEVsZW1lbnQgfSBmcm9tICcuLi9jb21tb24vZGVidWcuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2libGVWaWV3SW1wbGVtZW50YXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJsZVZpZXdSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBnZXRSZXBsVmlldywgUmVwbCB9IGZyb20gJy4vcmVwbC5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcblxuZXhwb3J0IGNsYXNzIFJlcGxBY2Nlc3NpYmxlVmlldyBpbXBsZW1lbnRzIElBY2Nlc3NpYmxlVmlld0ltcGxlbWVudGF0aW9uIHtcblx0cHJpb3JpdHkgPSA3MDtcblx0bmFtZSA9ICdkZWJ1Z0NvbnNvbGUnO1xuXHR3aGVuID0gQ29udGV4dEtleUV4cHIuZXF1YWxzKCdmb2N1c2VkVmlldycsICd3b3JrYmVuY2gucGFuZWwucmVwbC52aWV3Jyk7XG5cdHR5cGU6IEFjY2Vzc2libGVWaWV3VHlwZSA9IEFjY2Vzc2libGVWaWV3VHlwZS5WaWV3O1xuXHRnZXRQcm92aWRlcihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGNvbnN0IHZpZXdzU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKTtcblx0XHRjb25zdCBhY2Nlc3NpYmxlVmlld1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUFjY2Vzc2libGVWaWV3U2VydmljZSk7XG5cdFx0Y29uc3QgcmVwbFZpZXcgPSBnZXRSZXBsVmlldyh2aWV3c1NlcnZpY2UpO1xuXHRcdGlmICghcmVwbFZpZXcpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZm9jdXNlZEVsZW1lbnQgPSByZXBsVmlldy5nZXRGb2N1c2VkRWxlbWVudCgpO1xuXHRcdHJldHVybiBuZXcgUmVwbE91dHB1dEFjY2Vzc2libGVWaWV3UHJvdmlkZXIocmVwbFZpZXcsIGZvY3VzZWRFbGVtZW50LCBhY2Nlc3NpYmxlVmlld1NlcnZpY2UpO1xuXHR9XG59XG5cbmNsYXNzIFJlcGxPdXRwdXRBY2Nlc3NpYmxlVmlld1Byb3ZpZGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElBY2Nlc3NpYmxlVmlld0NvbnRlbnRQcm92aWRlciB7XG5cdHB1YmxpYyByZWFkb25seSBpZCA9IEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZC5SZXBsO1xuXHRwcml2YXRlIF9jb250ZW50OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQ29udGVudDogRW1pdHRlcjx2b2lkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VDb250ZW50OiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZXNvbHZlQ2hpbGRyZW46IEVtaXR0ZXI8dm9pZD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkUmVzb2x2ZUNoaWxkcmVuOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkUmVzb2x2ZUNoaWxkcmVuLmV2ZW50O1xuXG5cdHB1YmxpYyByZWFkb25seSB2ZXJib3NpdHlTZXR0aW5nS2V5ID0gQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZC5EZWJ1Zztcblx0cHVibGljIHJlYWRvbmx5IG9wdGlvbnMgPSB7XG5cdFx0dHlwZTogQWNjZXNzaWJsZVZpZXdUeXBlLlZpZXdcblx0fTtcblxuXHRwcml2YXRlIF9lbGVtZW50UG9zaXRpb25NYXA6IE1hcDxzdHJpbmcsIFBvc2l0aW9uPiA9IG5ldyBNYXA8c3RyaW5nLCBQb3NpdGlvbj4oKTtcblx0cHJpdmF0ZSBfdHJlZUhhZEZvY3VzID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcmVwbFZpZXc6IFJlcGwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZm9jdXNlZEVsZW1lbnQ6IElSZXBsRWxlbWVudCB8IHVuZGVmaW5lZCxcblx0XHRASUFjY2Vzc2libGVWaWV3U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9hY2Nlc3NpYmxlVmlld1NlcnZpY2U6IElBY2Nlc3NpYmxlVmlld1NlcnZpY2UpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3RyZWVIYWRGb2N1cyA9ICEhX2ZvY3VzZWRFbGVtZW50O1xuXHR9XG5cdHB1YmxpYyBwcm92aWRlQ29udGVudCgpOiBzdHJpbmcge1xuXHRcdGNvbnN0IGRlYnVnU2Vzc2lvbiA9IHRoaXMuX3JlcGxWaWV3LmdldERlYnVnU2Vzc2lvbigpO1xuXHRcdGlmICghZGVidWdTZXNzaW9uKSB7XG5cdFx0XHRyZXR1cm4gJ05vIGRlYnVnIHNlc3Npb24gYXZhaWxhYmxlLic7XG5cdFx0fVxuXHRcdGNvbnN0IGVsZW1lbnRzID0gZGVidWdTZXNzaW9uLmdldFJlcGxFbGVtZW50cygpO1xuXHRcdGlmICghZWxlbWVudHMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gJ05vIG91dHB1dCBpbiB0aGUgZGVidWcgY29uc29sZS4nO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuX2NvbnRlbnQpIHtcblx0XHRcdHRoaXMuX3VwZGF0ZUNvbnRlbnQoZWxlbWVudHMpO1xuXHRcdH1cblx0XHQvLyBDb250ZW50IGlzIGxvYWRlZCBhc3luY2hyb25vdXNseSwgc28gd2UgbmVlZCB0byBjaGVjayBpZiBpdCdzIGF2YWlsYWJsZSBvciBmYWxsYmFjayB0byB0aGUgZWxlbWVudHMgdGhhdCBhcmUgYWxyZWFkeSBhdmFpbGFibGUuXG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRlbnQgPz8gZWxlbWVudHMubWFwKGUgPT4gZS50b1N0cmluZyh0cnVlKSkuam9pbignXFxuJyk7XG5cdH1cblxuXHRwdWJsaWMgb25DbG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9jb250ZW50ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX2VsZW1lbnRQb3NpdGlvbk1hcC5jbGVhcigpO1xuXHRcdGlmICh0aGlzLl90cmVlSGFkRm9jdXMpIHtcblx0XHRcdHJldHVybiB0aGlzLl9yZXBsVmlldy5mb2N1c1RyZWUoKTtcblx0XHR9XG5cdFx0dGhpcy5fcmVwbFZpZXcuZ2V0UmVwbElucHV0KCkuZm9jdXMoKTtcblx0fVxuXG5cdHB1YmxpYyBvbk9wZW4oKTogdm9pZCB7XG5cdFx0Ly8gQ2hpbGRyZW4gYXJlIHJlc29sdmVkIGFzeW5jLCBzbyB3ZSBuZWVkIHRvIHVwZGF0ZSB0aGUgY29udGVudCB3aGVuIHRoZXkgYXJlIHJlc29sdmVkLlxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRSZXNvbHZlQ2hpbGRyZW4oKCkgPT4ge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50LmZpcmUoKTtcblx0XHRcdHF1ZXVlTWljcm90YXNrKCgpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX2ZvY3VzZWRFbGVtZW50KSB7XG5cdFx0XHRcdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLl9lbGVtZW50UG9zaXRpb25NYXAuZ2V0KHRoaXMuX2ZvY3VzZWRFbGVtZW50LmdldElkKCkpO1xuXHRcdFx0XHRcdGlmIChwb3NpdGlvbikge1xuXHRcdFx0XHRcdFx0dGhpcy5fYWNjZXNzaWJsZVZpZXdTZXJ2aWNlLnNldFBvc2l0aW9uKHBvc2l0aW9uLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3VwZGF0ZUNvbnRlbnQoZWxlbWVudHM6IElSZXBsRWxlbWVudFtdKSB7XG5cdFx0Y29uc3QgZGF0YVNvdXJjZSA9IHRoaXMuX3JlcGxWaWV3LmdldFJlcGxEYXRhU291cmNlKCk7XG5cdFx0aWYgKCFkYXRhU291cmNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGxldCBsaW5lID0gMTtcblx0XHRjb25zdCBjb250ZW50OiBzdHJpbmdbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZSBvZiBlbGVtZW50cykge1xuXHRcdFx0Y29udGVudC5wdXNoKGUudG9TdHJpbmcoKS5yZXBsYWNlKC9cXG4vZywgJycpKTtcblx0XHRcdHRoaXMuX2VsZW1lbnRQb3NpdGlvbk1hcC5zZXQoZS5nZXRJZCgpLCBuZXcgUG9zaXRpb24obGluZSwgMSkpO1xuXHRcdFx0bGluZSsrO1xuXHRcdFx0aWYgKGRhdGFTb3VyY2UuaGFzQ2hpbGRyZW4oZSkpIHtcblx0XHRcdFx0Y29uc3QgY2hpbGRDb250ZW50OiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0XHRjb25zdCBjaGlsZHJlbiA9IGF3YWl0IGRhdGFTb3VyY2UuZ2V0Q2hpbGRyZW4oZSk7XG5cdFx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRjb25zdCBpZCA9IGNoaWxkLmdldElkKCk7XG5cdFx0XHRcdFx0aWYgKCF0aGlzLl9lbGVtZW50UG9zaXRpb25NYXAuaGFzKGlkKSkge1xuXHRcdFx0XHRcdFx0Ly8gZG9uJ3Qgb3ZlcndyaXRlIHBhcmVudCBwb3NpdGlvblxuXHRcdFx0XHRcdFx0dGhpcy5fZWxlbWVudFBvc2l0aW9uTWFwLnNldChpZCwgbmV3IFBvc2l0aW9uKGxpbmUsIDEpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2hpbGRDb250ZW50LnB1c2goJyAgJyArIGNoaWxkLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRcdGxpbmUrKztcblx0XHRcdFx0fVxuXHRcdFx0XHRjb250ZW50LnB1c2goY2hpbGRDb250ZW50LmpvaW4oJ1xcbicpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9jb250ZW50ID0gY29udGVudC5qb2luKCdcXG4nKTtcblx0XHR0aGlzLl9vbkRpZFJlc29sdmVDaGlsZHJlbi5maXJlKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUywwQkFBMEIsb0JBQW9ELDhCQUE4QjtBQUNySCxTQUFTLHVDQUF1QztBQUloRCxTQUFTLG1CQUF5QjtBQUNsQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGVBQXNCO0FBQy9CLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsZ0JBQWdCO0FBRWxCLE1BQU0sbUJBQTREO0FBQUEsRUFBbEU7QUFDTixvQkFBVztBQUNYLGdCQUFPO0FBQ1AsZ0JBQU8sZUFBZSxPQUFPLGVBQWUsMkJBQTJCO0FBQ3ZFLGdCQUEyQixtQkFBbUI7QUFBQTtBQUFBLEVBQzlDLFlBQVksVUFBNEI7QUFDdkMsVUFBTSxlQUFlLFNBQVMsSUFBSSxhQUFhO0FBQy9DLFVBQU0sd0JBQXdCLFNBQVMsSUFBSSxzQkFBc0I7QUFDakUsVUFBTSxXQUFXLFlBQVksWUFBWTtBQUN6QyxRQUFJLENBQUMsVUFBVTtBQUNkLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxpQkFBaUIsU0FBUyxrQkFBa0I7QUFDbEQsV0FBTyxJQUFJLGlDQUFpQyxVQUFVLGdCQUFnQixxQkFBcUI7QUFBQSxFQUM1RjtBQUNEO0FBRUEsSUFBTSxtQ0FBTixjQUErQyxXQUFxRDtBQUFBLEVBZ0JuRyxZQUNrQixXQUNBLGlCQUN3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
