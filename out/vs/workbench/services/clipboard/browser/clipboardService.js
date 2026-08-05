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
import { localize } from "../../../../nls.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { BrowserClipboardService as BaseBrowserClipboardService } from "../../../../platform/clipboard/browser/clipboardService.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { Event } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { getActiveWindow } from "../../../../base/browser/dom.js";
let BrowserClipboardService = class extends BaseBrowserClipboardService {
  constructor(notificationService, openerService, environmentService, logService, layoutService) {
    super(layoutService, logService);
    this.notificationService = notificationService;
    this.openerService = openerService;
    this.environmentService = environmentService;
  }
  async writeText(text, type) {
    if (!!this.environmentService.extensionTestsLocationURI && typeof type !== "string") {
      type = "vscode-tests";
    }
    return super.writeText(text, type);
  }
  async readText(type) {
    if (!!this.environmentService.extensionTestsLocationURI && typeof type !== "string") {
      type = "vscode-tests";
    }
    if (type) {
      return super.readText(type);
    }
    try {
      return await getActiveWindow().navigator.clipboard.readText();
    } catch (error) {
      return new Promise((resolve) => {
        const listener = new DisposableStore();
        const handle = this.notificationService.prompt(
          Severity.Error,
          localize("clipboardError", "Unable to read from the browser's clipboard. Please make sure you have granted access for this website to read from the clipboard."),
          [{
            label: localize("retry", "Retry"),
            run: async () => {
              listener.dispose();
              resolve(await this.readText(type));
            }
          }, {
            label: localize("learnMore", "Learn More"),
            run: () => this.openerService.open("https://go.microsoft.com/fwlink/?linkid=2151362")
          }],
          {
            sticky: true
          }
        );
        listener.add(Event.once(handle.onDidClose)(() => resolve("")));
      });
    }
  }
};
BrowserClipboardService = __decorateClass([
  __decorateParam(0, INotificationService),
  __decorateParam(1, IOpenerService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, ILogService),
  __decorateParam(4, ILayoutService)
], BrowserClipboardService);
registerSingleton(IClipboardService, BrowserClipboardService, InstantiationType.Delayed);
export {
  BrowserClipboardService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvY2xpcGJvYXJkL2Jyb3dzZXIvY2xpcGJvYXJkU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUNsaXBib2FyZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jbGlwYm9hcmQvY29tbW9uL2NsaXBib2FyZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQnJvd3NlckNsaXBib2FyZFNlcnZpY2UgYXMgQmFzZUJyb3dzZXJDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2Jyb3dzZXIvY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSUxheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGdldEFjdGl2ZVdpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuXG5leHBvcnQgY2xhc3MgQnJvd3NlckNsaXBib2FyZFNlcnZpY2UgZXh0ZW5kcyBCYXNlQnJvd3NlckNsaXBib2FyZFNlcnZpY2Uge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUxheW91dFNlcnZpY2UgbGF5b3V0U2VydmljZTogSUxheW91dFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIobGF5b3V0U2VydmljZSwgbG9nU2VydmljZSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyB3cml0ZVRleHQodGV4dDogc3RyaW5nLCB0eXBlPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCEhdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuZXh0ZW5zaW9uVGVzdHNMb2NhdGlvblVSSSAmJiB0eXBlb2YgdHlwZSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHR5cGUgPSAndnNjb2RlLXRlc3RzJzsgLy8gZm9yY2UgaW4tbWVtb3J5IGNsaXBib2FyZCBmb3IgdGVzdHMgdG8gYXZvaWQgcGVybWlzc2lvbiBpc3N1ZXNcblx0XHR9XG5cblx0XHRyZXR1cm4gc3VwZXIud3JpdGVUZXh0KHRleHQsIHR5cGUpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcmVhZFRleHQodHlwZT86IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0aWYgKCEhdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuZXh0ZW5zaW9uVGVzdHNMb2NhdGlvblVSSSAmJiB0eXBlb2YgdHlwZSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHR5cGUgPSAndnNjb2RlLXRlc3RzJzsgLy8gZm9yY2UgaW4tbWVtb3J5IGNsaXBib2FyZCBmb3IgdGVzdHMgdG8gYXZvaWQgcGVybWlzc2lvbiBpc3N1ZXNcblx0XHR9XG5cblx0XHRpZiAodHlwZSkge1xuXHRcdFx0cmV0dXJuIHN1cGVyLnJlYWRUZXh0KHR5cGUpO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgZ2V0QWN0aXZlV2luZG93KCkubmF2aWdhdG9yLmNsaXBib2FyZC5yZWFkVGV4dCgpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRyZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPihyZXNvbHZlID0+IHtcblxuXHRcdFx0XHQvLyBJbmZvcm0gdXNlciBhYm91dCBwZXJtaXNzaW9ucyBwcm9ibGVtIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTEyMDg5KVxuXHRcdFx0XHRjb25zdCBsaXN0ZW5lciA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChcblx0XHRcdFx0XHRTZXZlcml0eS5FcnJvcixcblx0XHRcdFx0XHRsb2NhbGl6ZSgnY2xpcGJvYXJkRXJyb3InLCBcIlVuYWJsZSB0byByZWFkIGZyb20gdGhlIGJyb3dzZXIncyBjbGlwYm9hcmQuIFBsZWFzZSBtYWtlIHN1cmUgeW91IGhhdmUgZ3JhbnRlZCBhY2Nlc3MgZm9yIHRoaXMgd2Vic2l0ZSB0byByZWFkIGZyb20gdGhlIGNsaXBib2FyZC5cIiksXG5cdFx0XHRcdFx0W3tcblx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgncmV0cnknLCBcIlJldHJ5XCIpLFxuXHRcdFx0XHRcdFx0cnVuOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdFx0cmVzb2x2ZShhd2FpdCB0aGlzLnJlYWRUZXh0KHR5cGUpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2xlYXJuTW9yZScsIFwiTGVhcm4gTW9yZVwiKSxcblx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4oJ2h0dHBzOi8vZ28ubWljcm9zb2Z0LmNvbS9md2xpbmsvP2xpbmtpZD0yMTUxMzYyJylcblx0XHRcdFx0XHR9XSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzdGlja3k6IHRydWVcblx0XHRcdFx0XHR9XG5cdFx0XHRcdCk7XG5cblx0XHRcdFx0Ly8gQWx3YXlzIHJlc29sdmUgdGhlIHByb21pc2Ugb25jZSB0aGUgbm90aWZpY2F0aW9uIGNsb3Nlc1xuXHRcdFx0XHRsaXN0ZW5lci5hZGQoRXZlbnQub25jZShoYW5kbGUub25EaWRDbG9zZSkoKCkgPT4gcmVzb2x2ZSgnJykpKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJQ2xpcGJvYXJkU2VydmljZSwgQnJvd3NlckNsaXBib2FyZFNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLG1CQUFtQix5QkFBeUI7QUFDckQsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywyQkFBMkIsbUNBQW1DO0FBQ3ZFLFNBQVMsc0JBQXNCLGdCQUFnQjtBQUMvQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGFBQWE7QUFDdEIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx1QkFBdUI7QUFFekIsSUFBTSwwQkFBTixjQUFzQyw0QkFBNEI7QUFBQSxFQUV4RSxZQUN3QyxxQkFDTixlQUNjLG9CQUNsQyxZQUNHLGVBQ2Y7QUFDRCxVQUFNLGVBQWUsVUFBVTtBQU5RO0FBQ047QUFDYztBQUFBLEVBS2hEO0FBQUEsRUFFQSxNQUFlLFVBQVUsTUFBYyxNQUE4QjtBQUNwRSxRQUFJLENBQUMsQ0FBQyxLQUFLLG1CQUFtQiw2QkFBNkIsT0FBTyxTQUFTLFVBQVU7QUFDcEYsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPLE1BQU0sVUFBVSxNQUFNLElBQUk7QUFBQSxFQUNsQztBQUFBLEVBRUEsTUFBZSxTQUFTLE1BQWdDO0FBQ3ZELFFBQUksQ0FBQyxDQUFDLEtBQUssbUJBQW1CLDZCQUE2QixPQUFPLFNBQVMsVUFBVTtBQUNwRixhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksTUFBTTtBQUNULGFBQU8sTUFBTSxTQUFTLElBQUk7QUFBQSxJQUMzQjtBQUVBLFFBQUk7QUFDSCxhQUFPLE1BQU0sZ0JBQWdCLEVBQUUsVUFBVSxVQUFVLFNBQVM7QUFBQSxJQUM3RCxTQUFTLE9BQU87QUFDZixhQUFPLElBQUksUUFBZ0IsYUFBVztBQUdyQyxjQUFNLFdBQVcsSUFBSSxnQkFBZ0I7QUFDckMsY0FBTSxTQUFTLEtBQUssb0JBQW9CO0FBQUEsVUFDdkMsU0FBUztBQUFBLFVBQ1QsU0FBUyxrQkFBa0Isb0lBQW9JO0FBQUEsVUFDL0osQ0FBQztBQUFBLFlBQ0EsT0FBTyxTQUFTLFNBQVMsT0FBTztBQUFBLFlBQ2hDLEtBQUssWUFBWTtBQUNoQix1QkFBUyxRQUFRO0FBQ2pCLHNCQUFRLE1BQU0sS0FBSyxTQUFTLElBQUksQ0FBQztBQUFBLFlBQ2xDO0FBQUEsVUFDRCxHQUFHO0FBQUEsWUFDRixPQUFPLFNBQVMsYUFBYSxZQUFZO0FBQUEsWUFDekMsS0FBSyxNQUFNLEtBQUssY0FBYyxLQUFLLGlEQUFpRDtBQUFBLFVBQ3JGLENBQUM7QUFBQSxVQUNEO0FBQUEsWUFDQyxRQUFRO0FBQUEsVUFDVDtBQUFBLFFBQ0Q7QUFHQSxpQkFBUyxJQUFJLE1BQU0sS0FBSyxPQUFPLFVBQVUsRUFBRSxNQUFNLFFBQVEsRUFBRSxDQUFDLENBQUM7QUFBQSxNQUM5RCxDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFDRDtBQTNEYSwwQkFBTjtBQUFBLEVBR0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FQVTtBQTZEYixrQkFBa0IsbUJBQW1CLHlCQUF5QixrQkFBa0IsT0FBTzsiLAogICJuYW1lcyI6IFtdCn0K
