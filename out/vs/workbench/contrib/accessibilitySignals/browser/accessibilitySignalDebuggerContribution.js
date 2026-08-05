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
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorunWithStore, observableFromEvent } from "../../../../base/common/observable.js";
import { IAccessibilitySignalService, AccessibilitySignal } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IDebugService } from "../../debug/common/debug.js";
let AccessibilitySignalLineDebuggerContribution = class extends Disposable {
  constructor(debugService, accessibilitySignalService) {
    super();
    this.accessibilitySignalService = accessibilitySignalService;
    const isEnabled = observableFromEvent(
      this,
      accessibilitySignalService.onSoundEnabledChanged(AccessibilitySignal.onDebugBreak),
      () => accessibilitySignalService.isSoundEnabled(AccessibilitySignal.onDebugBreak)
    );
    this._register(autorunWithStore((reader, store) => {
      if (!isEnabled.read(reader)) {
        return;
      }
      const sessionDisposables = /* @__PURE__ */ new Map();
      store.add(toDisposable(() => {
        sessionDisposables.forEach((d) => d.dispose());
        sessionDisposables.clear();
      }));
      store.add(
        debugService.onDidNewSession(
          (session) => sessionDisposables.set(session, this.handleSession(session))
        )
      );
      store.add(debugService.onDidEndSession(({ session }) => {
        sessionDisposables.get(session)?.dispose();
        sessionDisposables.delete(session);
      }));
      debugService.getModel().getSessions().forEach(
        (session) => sessionDisposables.set(session, this.handleSession(session))
      );
    }));
  }
  handleSession(session) {
    return session.onDidChangeState((e) => {
      const stoppedDetails = session.getStoppedDetails();
      const BREAKPOINT_STOP_REASON = "breakpoint";
      if (stoppedDetails && stoppedDetails.reason === BREAKPOINT_STOP_REASON) {
        this.accessibilitySignalService.playSignal(AccessibilitySignal.onDebugBreak);
      }
    });
  }
};
AccessibilitySignalLineDebuggerContribution = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, IAccessibilitySignalService)
], AccessibilitySignalLineDebuggerContribution);
export {
  AccessibilitySignalLineDebuggerContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9hY2Nlc3NpYmlsaXR5U2lnbmFscy9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxEZWJ1Z2dlckNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1bldpdGhTdG9yZSwgb2JzZXJ2YWJsZUZyb21FdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLCBBY2Nlc3NpYmlsaXR5U2lnbmFsLCBBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHlTaWduYWwvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSURlYnVnU2VydmljZSwgSURlYnVnU2Vzc2lvbiB9IGZyb20gJy4uLy4uL2RlYnVnL2NvbW1vbi9kZWJ1Zy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBBY2Nlc3NpYmlsaXR5U2lnbmFsTGluZURlYnVnZ2VyQ29udHJpYnV0aW9uXG5cdGV4dGVuZHMgRGlzcG9zYWJsZVxuXHRpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRGVidWdTZXJ2aWNlIGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2U6IEFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Y29uc3QgaXNFbmFibGVkID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLFxuXHRcdFx0YWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2Uub25Tb3VuZEVuYWJsZWRDaGFuZ2VkKEFjY2Vzc2liaWxpdHlTaWduYWwub25EZWJ1Z0JyZWFrKSxcblx0XHRcdCgpID0+IGFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmlzU291bmRFbmFibGVkKEFjY2Vzc2liaWxpdHlTaWduYWwub25EZWJ1Z0JyZWFrKVxuXHRcdCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bldpdGhTdG9yZSgocmVhZGVyLCBzdG9yZSkgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBzdWJzY3JpYmUgdG8gZGVidWcgc2Vzc2lvbnMgKi9cblx0XHRcdGlmICghaXNFbmFibGVkLnJlYWQocmVhZGVyKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHNlc3Npb25EaXNwb3NhYmxlcyA9IG5ldyBNYXA8SURlYnVnU2Vzc2lvbiwgSURpc3Bvc2FibGU+KCk7XG5cdFx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0c2Vzc2lvbkRpc3Bvc2FibGVzLmZvckVhY2goZCA9PiBkLmRpc3Bvc2UoKSk7XG5cdFx0XHRcdHNlc3Npb25EaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHRzdG9yZS5hZGQoXG5cdFx0XHRcdGRlYnVnU2VydmljZS5vbkRpZE5ld1Nlc3Npb24oKHNlc3Npb24pID0+XG5cdFx0XHRcdFx0c2Vzc2lvbkRpc3Bvc2FibGVzLnNldChzZXNzaW9uLCB0aGlzLmhhbmRsZVNlc3Npb24oc2Vzc2lvbikpXG5cdFx0XHRcdClcblx0XHRcdCk7XG5cblx0XHRcdHN0b3JlLmFkZChkZWJ1Z1NlcnZpY2Uub25EaWRFbmRTZXNzaW9uKCh7IHNlc3Npb24gfSkgPT4ge1xuXHRcdFx0XHRzZXNzaW9uRGlzcG9zYWJsZXMuZ2V0KHNlc3Npb24pPy5kaXNwb3NlKCk7XG5cdFx0XHRcdHNlc3Npb25EaXNwb3NhYmxlcy5kZWxldGUoc2Vzc2lvbik7XG5cdFx0XHR9KSk7XG5cblx0XHRcdGRlYnVnU2VydmljZVxuXHRcdFx0XHQuZ2V0TW9kZWwoKVxuXHRcdFx0XHQuZ2V0U2Vzc2lvbnMoKVxuXHRcdFx0XHQuZm9yRWFjaCgoc2Vzc2lvbikgPT5cblx0XHRcdFx0XHRzZXNzaW9uRGlzcG9zYWJsZXMuc2V0KHNlc3Npb24sIHRoaXMuaGFuZGxlU2Vzc2lvbihzZXNzaW9uKSlcblx0XHRcdFx0KTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZVNlc3Npb24oc2Vzc2lvbjogSURlYnVnU2Vzc2lvbik6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gc2Vzc2lvbi5vbkRpZENoYW5nZVN0YXRlKGUgPT4ge1xuXHRcdFx0Y29uc3Qgc3RvcHBlZERldGFpbHMgPSBzZXNzaW9uLmdldFN0b3BwZWREZXRhaWxzKCk7XG5cdFx0XHRjb25zdCBCUkVBS1BPSU5UX1NUT1BfUkVBU09OID0gJ2JyZWFrcG9pbnQnO1xuXHRcdFx0aWYgKHN0b3BwZWREZXRhaWxzICYmIHN0b3BwZWREZXRhaWxzLnJlYXNvbiA9PT0gQlJFQUtQT0lOVF9TVE9QX1JFQVNPTikge1xuXHRcdFx0XHR0aGlzLmFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLnBsYXlTaWduYWwoQWNjZXNzaWJpbGl0eVNpZ25hbC5vbkRlYnVnQnJlYWspO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsWUFBeUIsb0JBQW9CO0FBQ3RELFNBQVMsa0JBQWtCLDJCQUEyQjtBQUN0RCxTQUFTLDZCQUE2QiwyQkFBdUQ7QUFFN0YsU0FBUyxxQkFBb0M7QUFFdEMsSUFBTSw4Q0FBTixjQUNFLFdBQzBCO0FBQUEsRUFFbEMsWUFDZ0IsY0FDK0IsNEJBQzdDO0FBQ0QsVUFBTTtBQUZ3QztBQUk5QyxVQUFNLFlBQVk7QUFBQSxNQUFvQjtBQUFBLE1BQ3JDLDJCQUEyQixzQkFBc0Isb0JBQW9CLFlBQVk7QUFBQSxNQUNqRixNQUFNLDJCQUEyQixlQUFlLG9CQUFvQixZQUFZO0FBQUEsSUFDakY7QUFDQSxTQUFLLFVBQVUsaUJBQWlCLENBQUMsUUFBUSxVQUFVO0FBRWxELFVBQUksQ0FBQyxVQUFVLEtBQUssTUFBTSxHQUFHO0FBQzVCO0FBQUEsTUFDRDtBQUVBLFlBQU0scUJBQXFCLG9CQUFJLElBQWdDO0FBQy9ELFlBQU0sSUFBSSxhQUFhLE1BQU07QUFDNUIsMkJBQW1CLFFBQVEsT0FBSyxFQUFFLFFBQVEsQ0FBQztBQUMzQywyQkFBbUIsTUFBTTtBQUFBLE1BQzFCLENBQUMsQ0FBQztBQUVGLFlBQU07QUFBQSxRQUNMLGFBQWE7QUFBQSxVQUFnQixDQUFDLFlBQzdCLG1CQUFtQixJQUFJLFNBQVMsS0FBSyxjQUFjLE9BQU8sQ0FBQztBQUFBLFFBQzVEO0FBQUEsTUFDRDtBQUVBLFlBQU0sSUFBSSxhQUFhLGdCQUFnQixDQUFDLEVBQUUsUUFBUSxNQUFNO0FBQ3ZELDJCQUFtQixJQUFJLE9BQU8sR0FBRyxRQUFRO0FBQ3pDLDJCQUFtQixPQUFPLE9BQU87QUFBQSxNQUNsQyxDQUFDLENBQUM7QUFFRixtQkFDRSxTQUFTLEVBQ1QsWUFBWSxFQUNaO0FBQUEsUUFBUSxDQUFDLFlBQ1QsbUJBQW1CLElBQUksU0FBUyxLQUFLLGNBQWMsT0FBTyxDQUFDO0FBQUEsTUFDNUQ7QUFBQSxJQUNGLENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVRLGNBQWMsU0FBcUM7QUFDMUQsV0FBTyxRQUFRLGlCQUFpQixPQUFLO0FBQ3BDLFlBQU0saUJBQWlCLFFBQVEsa0JBQWtCO0FBQ2pELFlBQU0seUJBQXlCO0FBQy9CLFVBQUksa0JBQWtCLGVBQWUsV0FBVyx3QkFBd0I7QUFDdkUsYUFBSywyQkFBMkIsV0FBVyxvQkFBb0IsWUFBWTtBQUFBLE1BQzVFO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUNEO0FBdkRhLDhDQUFOO0FBQUEsRUFLSjtBQUFBLEVBQ0E7QUFBQSxHQU5VOyIsCiAgIm5hbWVzIjogW10KfQo=
