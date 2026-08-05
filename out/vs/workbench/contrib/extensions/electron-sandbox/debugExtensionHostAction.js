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
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { randomPort } from "../../../../base/common/ports.js";
import * as nls from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, MenuId } from "../../../../platform/actions/common/actions.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ActiveEditorContext } from "../../../common/contextkeys.js";
import { ExtensionHostKind } from "../../../services/extensions/common/extensionHostKind.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IDebugService } from "../../debug/common/debug.js";
import { RuntimeExtensionsEditor } from "./runtimeExtensionsEditor.js";
class DebugExtensionHostAction extends Action2 {
  constructor() {
    super({
      id: "workbench.extensions.action.debugExtensionHost",
      title: { value: nls.localize("debugExtensionHost", "Start Debugging Extension Host In New Window"), original: "Start Debugging Extension Host In New Window" },
      category: Categories.Developer,
      f1: true,
      icon: Codicon.debugStart,
      menu: {
        id: MenuId.EditorTitle,
        when: ActiveEditorContext.isEqualTo(RuntimeExtensionsEditor.ID),
        group: "navigation"
      }
    });
  }
  run(accessor) {
    const nativeHostService = accessor.get(INativeHostService);
    const dialogService = accessor.get(IDialogService);
    const extensionService = accessor.get(IExtensionService);
    const productService = accessor.get(IProductService);
    const instantiationService = accessor.get(IInstantiationService);
    const hostService = accessor.get(IHostService);
    extensionService.getInspectPorts(ExtensionHostKind.LocalProcess, false).then(async (inspectPorts) => {
      if (inspectPorts.length === 0) {
        const res = await dialogService.confirm({
          message: nls.localize("restart1", "Debug Extensions"),
          detail: nls.localize("restart2", "In order to debug extensions a restart is required. Do you want to restart '{0}' now?", productService.nameLong),
          primaryButton: nls.localize({ key: "restart3", comment: ["&& denotes a mnemonic"] }, "&&Restart")
        });
        if (res.confirmed) {
          await nativeHostService.relaunch({ addArgs: [`--inspect-extensions=${randomPort()}`] });
        }
        return;
      }
      if (inspectPorts.length > 1) {
        console.warn(`There are multiple extension hosts available for debugging. Picking the first one...`);
      }
      const s = instantiationService.createInstance(Storage);
      s.storeDebugOnNewWindow(inspectPorts[0].port);
      hostService.openWindow();
    });
  }
}
let Storage = class {
  constructor(_storageService) {
    this._storageService = _storageService;
  }
  storeDebugOnNewWindow(targetPort) {
    this._storageService.store("debugExtensionHost.debugPort", targetPort, StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
  getAndDeleteDebugPortIfSet() {
    const port = this._storageService.getNumber("debugExtensionHost.debugPort", StorageScope.APPLICATION);
    if (port !== void 0) {
      this._storageService.remove("debugExtensionHost.debugPort", StorageScope.APPLICATION);
    }
    return port;
  }
};
Storage = __decorateClass([
  __decorateParam(0, IStorageService)
], Storage);
let DebugExtensionsContribution = class extends Disposable {
  constructor(_debugService, _instantiationService, _progressService) {
    super();
    this._debugService = _debugService;
    this._instantiationService = _instantiationService;
    const storage = this._instantiationService.createInstance(Storage);
    const port = storage.getAndDeleteDebugPortIfSet();
    if (port !== void 0) {
      _progressService.withProgress({
        location: ProgressLocation.Notification,
        title: nls.localize("debugExtensionHost.progress", "Attaching Debugger To Extension Host")
      }, async (p) => {
        await this._debugService.startDebugging(void 0, {
          type: "node",
          name: nls.localize("debugExtensionHost.launch.name", "Attach Extension Host"),
          request: "attach",
          port,
          trace: true,
          // resolve source maps everywhere:
          resolveSourceMapLocations: null,
          // announces sources eagerly for the loaded scripts view:
          eagerSources: true,
          // source maps of published VS Code are on the CDN and can take a while to load
          timeouts: {
            sourceMapMinPause: 3e4,
            sourceMapCumulativePause: 3e5
          }
        });
      });
    }
  }
};
DebugExtensionsContribution = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IProgressService)
], DebugExtensionsContribution);
export {
  DebugExtensionHostAction,
  DebugExtensionsContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2VsZWN0cm9uLXNhbmRib3gvZGVidWdFeHRlbnNpb25Ib3N0QWN0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgcmFuZG9tUG9ydCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BvcnRzLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ2F0ZWdvcmllcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uQ29tbW9uQ2F0ZWdvcmllcy5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElOYXRpdmVIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25hdGl2ZS9jb21tb24vbmF0aXZlLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQcm9ncmVzc1NlcnZpY2UsIFByb2dyZXNzTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IEFjdGl2ZUVkaXRvckNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkhvc3RLaW5kIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9uSG9zdEtpbmQuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IElDb25maWcsIElEZWJ1Z1NlcnZpY2UgfSBmcm9tICcuLi8uLi9kZWJ1Zy9jb21tb24vZGVidWcuanMnO1xuaW1wb3J0IHsgUnVudGltZUV4dGVuc2lvbnNFZGl0b3IgfSBmcm9tICcuL3J1bnRpbWVFeHRlbnNpb25zRWRpdG9yLmpzJztcblxuZXhwb3J0IGNsYXNzIERlYnVnRXh0ZW5zaW9uSG9zdEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5kZWJ1Z0V4dGVuc2lvbkhvc3QnLFxuXHRcdFx0dGl0bGU6IHsgdmFsdWU6IG5scy5sb2NhbGl6ZSgnZGVidWdFeHRlbnNpb25Ib3N0JywgXCJTdGFydCBEZWJ1Z2dpbmcgRXh0ZW5zaW9uIEhvc3QgSW4gTmV3IFdpbmRvd1wiKSwgb3JpZ2luYWw6ICdTdGFydCBEZWJ1Z2dpbmcgRXh0ZW5zaW9uIEhvc3QgSW4gTmV3IFdpbmRvdycgfSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkRldmVsb3Blcixcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5kZWJ1Z1N0YXJ0LFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvclRpdGxlLFxuXHRcdFx0XHR3aGVuOiBBY3RpdmVFZGl0b3JDb250ZXh0LmlzRXF1YWxUbyhSdW50aW1lRXh0ZW5zaW9uc0VkaXRvci5JRCksXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRjb25zdCBuYXRpdmVIb3N0U2VydmljZSA9IGFjY2Vzc29yLmdldChJTmF0aXZlSG9zdFNlcnZpY2UpO1xuXHRcdGNvbnN0IGRpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURpYWxvZ1NlcnZpY2UpO1xuXHRcdGNvbnN0IGV4dGVuc2lvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvblNlcnZpY2UpO1xuXHRcdGNvbnN0IHByb2R1Y3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElQcm9kdWN0U2VydmljZSk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBob3N0U2VydmljZSA9IGFjY2Vzc29yLmdldChJSG9zdFNlcnZpY2UpO1xuXG5cdFx0ZXh0ZW5zaW9uU2VydmljZS5nZXRJbnNwZWN0UG9ydHMoRXh0ZW5zaW9uSG9zdEtpbmQuTG9jYWxQcm9jZXNzLCBmYWxzZSkudGhlbihhc3luYyBpbnNwZWN0UG9ydHMgPT4ge1xuXHRcdFx0aWYgKGluc3BlY3RQb3J0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0Y29uc3QgcmVzID0gYXdhaXQgZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ3Jlc3RhcnQxJywgXCJEZWJ1ZyBFeHRlbnNpb25zXCIpLFxuXHRcdFx0XHRcdGRldGFpbDogbmxzLmxvY2FsaXplKCdyZXN0YXJ0MicsIFwiSW4gb3JkZXIgdG8gZGVidWcgZXh0ZW5zaW9ucyBhIHJlc3RhcnQgaXMgcmVxdWlyZWQuIERvIHlvdSB3YW50IHRvIHJlc3RhcnQgJ3swfScgbm93P1wiLCBwcm9kdWN0U2VydmljZS5uYW1lTG9uZyksXG5cdFx0XHRcdFx0cHJpbWFyeUJ1dHRvbjogbmxzLmxvY2FsaXplKHsga2V5OiAncmVzdGFydDMnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZSZXN0YXJ0XCIpXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRpZiAocmVzLmNvbmZpcm1lZCkge1xuXHRcdFx0XHRcdGF3YWl0IG5hdGl2ZUhvc3RTZXJ2aWNlLnJlbGF1bmNoKHsgYWRkQXJnczogW2AtLWluc3BlY3QtZXh0ZW5zaW9ucz0ke3JhbmRvbVBvcnQoKX1gXSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpbnNwZWN0UG9ydHMubGVuZ3RoID4gMSkge1xuXHRcdFx0XHQvLyBUT0RPXG5cdFx0XHRcdGNvbnNvbGUud2FybihgVGhlcmUgYXJlIG11bHRpcGxlIGV4dGVuc2lvbiBob3N0cyBhdmFpbGFibGUgZm9yIGRlYnVnZ2luZy4gUGlja2luZyB0aGUgZmlyc3Qgb25lLi4uYCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHMgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTdG9yYWdlKTtcblx0XHRcdHMuc3RvcmVEZWJ1Z09uTmV3V2luZG93KGluc3BlY3RQb3J0c1swXS5wb3J0KTtcblxuXHRcdFx0aG9zdFNlcnZpY2Uub3BlbldpbmRvdygpO1xuXHRcdH0pO1xuXHR9XG59XG5cbmNsYXNzIFN0b3JhZ2Uge1xuXHRjb25zdHJ1Y3RvcihASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsKSB7XG5cdH1cblxuXHRzdG9yZURlYnVnT25OZXdXaW5kb3codGFyZ2V0UG9ydDogbnVtYmVyKSB7XG5cdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ2RlYnVnRXh0ZW5zaW9uSG9zdC5kZWJ1Z1BvcnQnLCB0YXJnZXRQb3J0LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdH1cblxuXHRnZXRBbmREZWxldGVEZWJ1Z1BvcnRJZlNldCgpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHBvcnQgPSB0aGlzLl9zdG9yYWdlU2VydmljZS5nZXROdW1iZXIoJ2RlYnVnRXh0ZW5zaW9uSG9zdC5kZWJ1Z1BvcnQnLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXHRcdGlmIChwb3J0ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnJlbW92ZSgnZGVidWdFeHRlbnNpb25Ib3N0LmRlYnVnUG9ydCcsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0fVxuXHRcdHJldHVybiBwb3J0O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBEZWJ1Z0V4dGVuc2lvbnNDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRGVidWdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2RlYnVnU2VydmljZTogSURlYnVnU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElQcm9ncmVzc1NlcnZpY2UgX3Byb2dyZXNzU2VydmljZTogSVByb2dyZXNzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IHN0b3JhZ2UgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTdG9yYWdlKTtcblx0XHRjb25zdCBwb3J0ID0gc3RvcmFnZS5nZXRBbmREZWxldGVEZWJ1Z1BvcnRJZlNldCgpO1xuXHRcdGlmIChwb3J0ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdF9wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHtcblx0XHRcdFx0bG9jYXRpb246IFByb2dyZXNzTG9jYXRpb24uTm90aWZpY2F0aW9uLFxuXHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdkZWJ1Z0V4dGVuc2lvbkhvc3QucHJvZ3Jlc3MnLCBcIkF0dGFjaGluZyBEZWJ1Z2dlciBUbyBFeHRlbnNpb24gSG9zdFwiKSxcblx0XHRcdH0sIGFzeW5jIHAgPT4ge1xuXHRcdFx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbG9jYWwvY29kZS1uby1kYW5nZXJvdXMtdHlwZS1hc3NlcnRpb25zXG5cdFx0XHRcdGF3YWl0IHRoaXMuX2RlYnVnU2VydmljZS5zdGFydERlYnVnZ2luZyh1bmRlZmluZWQsIHtcblx0XHRcdFx0XHR0eXBlOiAnbm9kZScsXG5cdFx0XHRcdFx0bmFtZTogbmxzLmxvY2FsaXplKCdkZWJ1Z0V4dGVuc2lvbkhvc3QubGF1bmNoLm5hbWUnLCBcIkF0dGFjaCBFeHRlbnNpb24gSG9zdFwiKSxcblx0XHRcdFx0XHRyZXF1ZXN0OiAnYXR0YWNoJyxcblx0XHRcdFx0XHRwb3J0LFxuXHRcdFx0XHRcdHRyYWNlOiB0cnVlLFxuXHRcdFx0XHRcdC8vIHJlc29sdmUgc291cmNlIG1hcHMgZXZlcnl3aGVyZTpcblx0XHRcdFx0XHRyZXNvbHZlU291cmNlTWFwTG9jYXRpb25zOiBudWxsLFxuXHRcdFx0XHRcdC8vIGFubm91bmNlcyBzb3VyY2VzIGVhZ2VybHkgZm9yIHRoZSBsb2FkZWQgc2NyaXB0cyB2aWV3OlxuXHRcdFx0XHRcdGVhZ2VyU291cmNlczogdHJ1ZSxcblx0XHRcdFx0XHQvLyBzb3VyY2UgbWFwcyBvZiBwdWJsaXNoZWQgVlMgQ29kZSBhcmUgb24gdGhlIENETiBhbmQgY2FuIHRha2UgYSB3aGlsZSB0byBsb2FkXG5cdFx0XHRcdFx0dGltZW91dHM6IHtcblx0XHRcdFx0XHRcdHNvdXJjZU1hcE1pblBhdXNlOiAzMF8wMDAsXG5cdFx0XHRcdFx0XHRzb3VyY2VNYXBDdW11bGF0aXZlUGF1c2U6IDMwMF8wMDAsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSBhcyBJQ29uZmlnKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7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
