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
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IDebugService } from "./debug.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
let DebugLifecycle = class {
  constructor(lifecycleService, debugService, configurationService, dialogService) {
    this.debugService = debugService;
    this.configurationService = configurationService;
    this.dialogService = dialogService;
    this.disposable = lifecycleService.onBeforeShutdown(async (e) => e.veto(this.shouldVetoShutdown(e.reason), "veto.debug"));
  }
  shouldVetoShutdown(_reason) {
    const rootSessions = this.debugService.getModel().getSessions().filter((s) => s.parentSession === void 0);
    if (rootSessions.length === 0) {
      return false;
    }
    const shouldConfirmOnExit = this.configurationService.getValue("debug").confirmOnExit;
    if (shouldConfirmOnExit === "never") {
      return false;
    }
    return this.showWindowCloseConfirmation(rootSessions.length);
  }
  dispose() {
    return this.disposable.dispose();
  }
  async showWindowCloseConfirmation(numSessions) {
    let message;
    if (numSessions === 1) {
      message = nls.localize("debug.debugSessionCloseConfirmationSingular", "There is an active debug session, are you sure you want to stop it?");
    } else {
      message = nls.localize("debug.debugSessionCloseConfirmationPlural", "There are active debug sessions, are you sure you want to stop them?");
    }
    const res = await this.dialogService.confirm({
      message,
      type: "warning",
      primaryButton: nls.localize({ key: "debug.stop", comment: ["&& denotes a mnemonic"] }, "&&Stop Debugging")
    });
    return !res.confirmed;
  }
};
DebugLifecycle = __decorateClass([
  __decorateParam(0, ILifecycleService),
  __decorateParam(1, IDebugService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IDialogService)
], DebugLifecycle);
export {
  DebugLifecycle
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9jb21tb24vZGVidWdMaWZlY3ljbGUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRGVidWdDb25maWd1cmF0aW9uLCBJRGVidWdTZXJ2aWNlIH0gZnJvbSAnLi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSwgU2h1dGRvd25SZWFzb24gfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBEZWJ1Z0xpZmVjeWNsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXHRwcml2YXRlIGRpc3Bvc2FibGU6IElEaXNwb3NhYmxlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBsaWZlY3ljbGVTZXJ2aWNlOiBJTGlmZWN5Y2xlU2VydmljZSxcblx0XHRASURlYnVnU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlID0gbGlmZWN5Y2xlU2VydmljZS5vbkJlZm9yZVNodXRkb3duKGFzeW5jIGUgPT4gZS52ZXRvKHRoaXMuc2hvdWxkVmV0b1NodXRkb3duKGUucmVhc29uKSwgJ3ZldG8uZGVidWcnKSk7XG5cdH1cblxuXHRwcml2YXRlIHNob3VsZFZldG9TaHV0ZG93bihfcmVhc29uOiBTaHV0ZG93blJlYXNvbik6IGJvb2xlYW4gfCBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCByb290U2Vzc2lvbnMgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldFNlc3Npb25zKCkuZmlsdGVyKHMgPT4gcy5wYXJlbnRTZXNzaW9uID09PSB1bmRlZmluZWQpO1xuXHRcdGlmIChyb290U2Vzc2lvbnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2hvdWxkQ29uZmlybU9uRXhpdCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SURlYnVnQ29uZmlndXJhdGlvbj4oJ2RlYnVnJykuY29uZmlybU9uRXhpdDtcblx0XHRpZiAoc2hvdWxkQ29uZmlybU9uRXhpdCA9PT0gJ25ldmVyJykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnNob3dXaW5kb3dDbG9zZUNvbmZpcm1hdGlvbihyb290U2Vzc2lvbnMubGVuZ3RoKTtcblx0fVxuXG5cdHB1YmxpYyBkaXNwb3NlKCkge1xuXHRcdHJldHVybiB0aGlzLmRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzaG93V2luZG93Q2xvc2VDb25maXJtYXRpb24obnVtU2Vzc2lvbnM6IG51bWJlcik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGxldCBtZXNzYWdlOiBzdHJpbmc7XG5cdFx0aWYgKG51bVNlc3Npb25zID09PSAxKSB7XG5cdFx0XHRtZXNzYWdlID0gbmxzLmxvY2FsaXplKCdkZWJ1Zy5kZWJ1Z1Nlc3Npb25DbG9zZUNvbmZpcm1hdGlvblNpbmd1bGFyJywgXCJUaGVyZSBpcyBhbiBhY3RpdmUgZGVidWcgc2Vzc2lvbiwgYXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIHN0b3AgaXQ/XCIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtZXNzYWdlID0gbmxzLmxvY2FsaXplKCdkZWJ1Zy5kZWJ1Z1Nlc3Npb25DbG9zZUNvbmZpcm1hdGlvblBsdXJhbCcsIFwiVGhlcmUgYXJlIGFjdGl2ZSBkZWJ1ZyBzZXNzaW9ucywgYXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIHN0b3AgdGhlbT9cIik7XG5cdFx0fVxuXHRcdGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdG1lc3NhZ2UsXG5cdFx0XHR0eXBlOiAnd2FybmluZycsXG5cdFx0XHRwcmltYXJ5QnV0dG9uOiBubHMubG9jYWxpemUoeyBrZXk6ICdkZWJ1Zy5zdG9wJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmU3RvcCBEZWJ1Z2dpbmdcIilcblx0XHR9KTtcblx0XHRyZXR1cm4gIXJlcy5jb25maXJtZWQ7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsc0JBQXNCO0FBRS9CLFNBQThCLHFCQUFxQjtBQUNuRCxTQUFTLHlCQUF5QztBQUUzQyxJQUFNLGlCQUFOLE1BQXVEO0FBQUEsRUFHN0QsWUFDb0Isa0JBQ2EsY0FDUSxzQkFDUCxlQUNoQztBQUgrQjtBQUNRO0FBQ1A7QUFFakMsU0FBSyxhQUFhLGlCQUFpQixpQkFBaUIsT0FBTSxNQUFLLEVBQUUsS0FBSyxLQUFLLG1CQUFtQixFQUFFLE1BQU0sR0FBRyxZQUFZLENBQUM7QUFBQSxFQUN2SDtBQUFBLEVBRVEsbUJBQW1CLFNBQXFEO0FBQy9FLFVBQU0sZUFBZSxLQUFLLGFBQWEsU0FBUyxFQUFFLFlBQVksRUFBRSxPQUFPLE9BQUssRUFBRSxrQkFBa0IsTUFBUztBQUN6RyxRQUFJLGFBQWEsV0FBVyxHQUFHO0FBQzlCLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxzQkFBc0IsS0FBSyxxQkFBcUIsU0FBOEIsT0FBTyxFQUFFO0FBQzdGLFFBQUksd0JBQXdCLFNBQVM7QUFDcEMsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPLEtBQUssNEJBQTRCLGFBQWEsTUFBTTtBQUFBLEVBQzVEO0FBQUEsRUFFTyxVQUFVO0FBQ2hCLFdBQU8sS0FBSyxXQUFXLFFBQVE7QUFBQSxFQUNoQztBQUFBLEVBRUEsTUFBYyw0QkFBNEIsYUFBdUM7QUFDaEYsUUFBSTtBQUNKLFFBQUksZ0JBQWdCLEdBQUc7QUFDdEIsZ0JBQVUsSUFBSSxTQUFTLCtDQUErQyxxRUFBcUU7QUFBQSxJQUM1SSxPQUFPO0FBQ04sZ0JBQVUsSUFBSSxTQUFTLDZDQUE2QyxzRUFBc0U7QUFBQSxJQUMzSTtBQUNBLFVBQU0sTUFBTSxNQUFNLEtBQUssY0FBYyxRQUFRO0FBQUEsTUFDNUM7QUFBQSxNQUNBLE1BQU07QUFBQSxNQUNOLGVBQWUsSUFBSSxTQUFTLEVBQUUsS0FBSyxjQUFjLFNBQVMsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLGtCQUFrQjtBQUFBLElBQzFHLENBQUM7QUFDRCxXQUFPLENBQUMsSUFBSTtBQUFBLEVBQ2I7QUFDRDtBQTVDYSxpQkFBTjtBQUFBLEVBSUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVBVOyIsCiAgIm5hbWVzIjogW10KfQo=
