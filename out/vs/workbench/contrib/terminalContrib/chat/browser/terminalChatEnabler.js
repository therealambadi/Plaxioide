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
import { Event } from "../../../../../base/common/event.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IChatAgentService } from "../../../chat/common/chatAgents.js";
import { ChatAgentLocation } from "../../../chat/common/constants.js";
import { TerminalChatContextKeys } from "./terminalChat.js";
let TerminalChatEnabler = class {
  constructor(chatAgentService, contextKeyService) {
    this._store = new DisposableStore();
    this._ctxHasProvider = TerminalChatContextKeys.hasChatAgent.bindTo(contextKeyService);
    this._store.add(Event.runAndSubscribe(chatAgentService.onDidChangeAgents, () => {
      const hasTerminalAgent = Boolean(chatAgentService.getDefaultAgent(ChatAgentLocation.Terminal));
      this._ctxHasProvider.set(hasTerminalAgent);
    }));
  }
  dispose() {
    this._ctxHasProvider.reset();
    this._store.dispose();
  }
};
TerminalChatEnabler.Id = "terminalChat.enabler";
TerminalChatEnabler = __decorateClass([
  __decorateParam(0, IChatAgentService),
  __decorateParam(1, IContextKeyService)
], TerminalChatEnabler);
export {
  TerminalChatEnabler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvY2hhdC9icm93c2VyL3Rlcm1pbmFsQ2hhdEVuYWJsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ2hhdEFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NoYXQvY29tbW9uL2NoYXRBZ2VudHMuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50TG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jaGF0L2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuL3Rlcm1pbmFsQ2hhdC5qcyc7XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbENoYXRFbmFibGVyIHtcblxuXHRzdGF0aWMgSWQgPSAndGVybWluYWxDaGF0LmVuYWJsZXInO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2N0eEhhc1Byb3ZpZGVyOiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNoYXRBZ2VudFNlcnZpY2UgY2hhdEFnZW50U2VydmljZTogSUNoYXRBZ2VudFNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLl9jdHhIYXNQcm92aWRlciA9IFRlcm1pbmFsQ2hhdENvbnRleHRLZXlzLmhhc0NoYXRBZ2VudC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZChFdmVudC5ydW5BbmRTdWJzY3JpYmUoY2hhdEFnZW50U2VydmljZS5vbkRpZENoYW5nZUFnZW50cywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaGFzVGVybWluYWxBZ2VudCA9IEJvb2xlYW4oY2hhdEFnZW50U2VydmljZS5nZXREZWZhdWx0QWdlbnQoQ2hhdEFnZW50TG9jYXRpb24uVGVybWluYWwpKTtcblx0XHRcdHRoaXMuX2N0eEhhc1Byb3ZpZGVyLnNldChoYXNUZXJtaW5hbEFnZW50KTtcblx0XHR9KSk7XG5cdH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMuX2N0eEhhc1Byb3ZpZGVyLnJlc2V0KCk7XG5cdFx0dGhpcy5fc3RvcmUuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsYUFBYTtBQUN0QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFzQiwwQkFBMEI7QUFDaEQsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywrQkFBK0I7QUFFakMsSUFBTSxzQkFBTixNQUEwQjtBQUFBLEVBUWhDLFlBQ29CLGtCQUNDLG1CQUNuQjtBQUxGLFNBQWlCLFNBQVMsSUFBSSxnQkFBZ0I7QUFNN0MsU0FBSyxrQkFBa0Isd0JBQXdCLGFBQWEsT0FBTyxpQkFBaUI7QUFDcEYsU0FBSyxPQUFPLElBQUksTUFBTSxnQkFBZ0IsaUJBQWlCLG1CQUFtQixNQUFNO0FBQy9FLFlBQU0sbUJBQW1CLFFBQVEsaUJBQWlCLGdCQUFnQixrQkFBa0IsUUFBUSxDQUFDO0FBQzdGLFdBQUssZ0JBQWdCLElBQUksZ0JBQWdCO0FBQUEsSUFDMUMsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRUEsVUFBVTtBQUNULFNBQUssZ0JBQWdCLE1BQU07QUFDM0IsU0FBSyxPQUFPLFFBQVE7QUFBQSxFQUNyQjtBQUNEO0FBdkJhLG9CQUVMLEtBQUs7QUFGQSxzQkFBTjtBQUFBLEVBU0o7QUFBQSxFQUNBO0FBQUEsR0FWVTsiLAogICJuYW1lcyI6IFtdCn0K
