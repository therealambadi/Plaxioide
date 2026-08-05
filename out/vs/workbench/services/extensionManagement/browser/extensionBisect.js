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
import { localize, localize2 } from "../../../../nls.js";
import { IExtensionManagementService, IGlobalExtensionEnablementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ExtensionType, isResolverExtension } from "../../../../platform/extensions/common/extensions.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { INotificationService, NotificationPriority, Severity } from "../../../../platform/notification/common/notification.js";
import { IHostService } from "../../host/browser/host.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { LifecyclePhase } from "../../lifecycle/common/lifecycle.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions } from "../../../common/contributions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { areSameExtensions } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { IWorkbenchExtensionEnablementService } from "../common/extensionManagement.js";
const IExtensionBisectService = createDecorator("IExtensionBisectService");
class BisectState {
  constructor(extensions, low, high, mid = (low + high) / 2 | 0) {
    this.extensions = extensions;
    this.low = low;
    this.high = high;
    this.mid = mid;
  }
  static fromJSON(raw) {
    if (!raw) {
      return void 0;
    }
    try {
      const data = JSON.parse(raw);
      return new BisectState(data.extensions, data.low, data.high, data.mid);
    } catch {
      return void 0;
    }
  }
}
let ExtensionBisectService = class {
  constructor(logService, _storageService, _envService) {
    this._storageService = _storageService;
    this._envService = _envService;
    this._disabled = /* @__PURE__ */ new Map();
    const raw = _storageService.get(ExtensionBisectService._storageKey, StorageScope.APPLICATION);
    this._state = BisectState.fromJSON(raw);
    if (this._state) {
      const { mid, high } = this._state;
      for (let i = 0; i < this._state.extensions.length; i++) {
        const isDisabled = i >= mid && i < high;
        this._disabled.set(this._state.extensions[i], isDisabled);
      }
      logService.warn("extension BISECT active", [...this._disabled]);
    }
  }
  get isActive() {
    return !!this._state;
  }
  get disabledCount() {
    return this._state ? this._state.high - this._state.mid : -1;
  }
  isDisabledByBisect(extension) {
    if (!this._state) {
      return false;
    }
    if (isResolverExtension(extension.manifest, this._envService.remoteAuthority)) {
      return false;
    }
    if (this._isEnabledInEnv(extension)) {
      return false;
    }
    const disabled = this._disabled.get(extension.identifier.id);
    return disabled ?? false;
  }
  _isEnabledInEnv(extension) {
    return Array.isArray(this._envService.enableExtensions) && this._envService.enableExtensions.some((id) => areSameExtensions({ id }, extension.identifier));
  }
  async start(extensions) {
    if (this._state) {
      throw new Error("invalid state");
    }
    const extensionIds = extensions.map((ext) => ext.identifier.id);
    const newState = new BisectState(extensionIds, 0, extensionIds.length, 0);
    this._storageService.store(ExtensionBisectService._storageKey, JSON.stringify(newState), StorageScope.APPLICATION, StorageTarget.MACHINE);
    await this._storageService.flush();
  }
  async next(seeingBad) {
    if (!this._state) {
      throw new Error("invalid state");
    }
    if (seeingBad && this._state.mid === 0 && this._state.high === this._state.extensions.length) {
      return { bad: true, id: "" };
    }
    if (this._state.low === this._state.high - 1) {
      await this.reset();
      return { id: this._state.extensions[this._state.low], bad: seeingBad };
    }
    const nextState = new BisectState(
      this._state.extensions,
      seeingBad ? this._state.low : this._state.mid,
      seeingBad ? this._state.mid : this._state.high
    );
    this._storageService.store(ExtensionBisectService._storageKey, JSON.stringify(nextState), StorageScope.APPLICATION, StorageTarget.MACHINE);
    await this._storageService.flush();
    return void 0;
  }
  async reset() {
    this._storageService.remove(ExtensionBisectService._storageKey, StorageScope.APPLICATION);
    await this._storageService.flush();
  }
};
ExtensionBisectService._storageKey = "extensionBisectState";
ExtensionBisectService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IWorkbenchEnvironmentService)
], ExtensionBisectService);
registerSingleton(IExtensionBisectService, ExtensionBisectService, InstantiationType.Delayed);
let ExtensionBisectUi = class {
  constructor(contextKeyService, _extensionBisectService, _notificationService, _commandService) {
    this._extensionBisectService = _extensionBisectService;
    this._notificationService = _notificationService;
    this._commandService = _commandService;
    if (_extensionBisectService.isActive) {
      ExtensionBisectUi.ctxIsBisectActive.bindTo(contextKeyService).set(true);
      this._showBisectPrompt();
    }
  }
  _showBisectPrompt() {
    const goodPrompt = {
      label: localize("I cannot reproduce", "I can't reproduce"),
      run: () => this._commandService.executeCommand("extension.bisect.next", false)
    };
    const badPrompt = {
      label: localize("This is Bad", "I can reproduce"),
      run: () => this._commandService.executeCommand("extension.bisect.next", true)
    };
    const stop = {
      label: "Stop Bisect",
      run: () => this._commandService.executeCommand("extension.bisect.stop")
    };
    const message = this._extensionBisectService.disabledCount === 1 ? localize("bisect.singular", "Extension Bisect is active and has disabled 1 extension. Check if you can still reproduce the problem and proceed by selecting from these options.") : localize("bisect.plural", "Extension Bisect is active and has disabled {0} extensions. Check if you can still reproduce the problem and proceed by selecting from these options.", this._extensionBisectService.disabledCount);
    this._notificationService.prompt(
      Severity.Info,
      message,
      [goodPrompt, badPrompt, stop],
      { sticky: true, priority: NotificationPriority.URGENT }
    );
  }
};
ExtensionBisectUi.ctxIsBisectActive = new RawContextKey("isExtensionBisectActive", false);
ExtensionBisectUi = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IExtensionBisectService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, ICommandService)
], ExtensionBisectUi);
Registry.as(Extensions.Workbench).registerWorkbenchContribution(
  ExtensionBisectUi,
  LifecyclePhase.Restored
);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "extension.bisect.start",
      title: localize2("title.start", "Start Extension Bisect"),
      category: Categories.Help,
      f1: true,
      precondition: ExtensionBisectUi.ctxIsBisectActive.negate(),
      menu: {
        id: MenuId.ViewContainerTitle,
        when: ContextKeyExpr.equals("viewContainer", "workbench.view.extensions"),
        group: "2_enablement",
        order: 4
      }
    });
  }
  async run(accessor) {
    const dialogService = accessor.get(IDialogService);
    const hostService = accessor.get(IHostService);
    const extensionManagement = accessor.get(IExtensionManagementService);
    const extensionEnablementService = accessor.get(IWorkbenchExtensionEnablementService);
    const extensionsBisect = accessor.get(IExtensionBisectService);
    const extensions = (await extensionManagement.getInstalled(ExtensionType.User)).filter((ext) => extensionEnablementService.isEnabled(ext));
    const res = await dialogService.confirm({
      message: localize("msg.start", "Extension Bisect"),
      detail: localize("detail.start", "Extension Bisect will use binary search to find an extension that causes a problem. During the process the window reloads repeatedly (~{0} times). Each time you must confirm if you are still seeing problems.", 2 + Math.log2(extensions.length) | 0),
      primaryButton: localize({ key: "msg2", comment: ["&& denotes a mnemonic"] }, "&&Start Extension Bisect")
    });
    if (res.confirmed) {
      await extensionsBisect.start(extensions);
      hostService.reload();
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "extension.bisect.next",
      title: localize2("title.isBad", "Continue Extension Bisect"),
      category: Categories.Help,
      f1: true,
      precondition: ExtensionBisectUi.ctxIsBisectActive
    });
  }
  async run(accessor, seeingBad) {
    const dialogService = accessor.get(IDialogService);
    const hostService = accessor.get(IHostService);
    const bisectService = accessor.get(IExtensionBisectService);
    const productService = accessor.get(IProductService);
    const extensionEnablementService = accessor.get(IGlobalExtensionEnablementService);
    const commandService = accessor.get(ICommandService);
    if (!bisectService.isActive) {
      return;
    }
    if (seeingBad === void 0) {
      const goodBadStopCancel = await this._checkForBad(dialogService, bisectService);
      if (goodBadStopCancel === null) {
        return;
      }
      seeingBad = goodBadStopCancel;
    }
    if (seeingBad === void 0) {
      await bisectService.reset();
      hostService.reload();
      return;
    }
    const done = await bisectService.next(seeingBad);
    if (!done) {
      hostService.reload();
      return;
    }
    if (done.bad) {
      await dialogService.info(
        localize("done.msg", "Extension Bisect"),
        localize("done.detail2", "Extension Bisect is done but no extension has been identified. This might be a problem with {0}.", productService.nameShort)
      );
    } else {
      const res = await dialogService.confirm({
        type: Severity.Info,
        message: localize("done.msg", "Extension Bisect"),
        primaryButton: localize({ key: "report", comment: ["&& denotes a mnemonic"] }, "&&Report Issue & Continue"),
        cancelButton: localize("continue", "Continue"),
        detail: localize("done.detail", "Extension Bisect is done and has identified {0} as the extension causing the problem.", done.id),
        checkbox: { label: localize("done.disbale", "Keep this extension disabled"), checked: true }
      });
      if (res.checkboxChecked) {
        await extensionEnablementService.disableExtension({ id: done.id }, void 0);
      }
      if (res.confirmed) {
        await commandService.executeCommand("workbench.action.openIssueReporter", done.id);
      }
    }
    await bisectService.reset();
    hostService.reload();
  }
  async _checkForBad(dialogService, bisectService) {
    const { result } = await dialogService.prompt({
      type: Severity.Info,
      message: localize("msg.next", "Extension Bisect"),
      detail: localize("bisect", "Extension Bisect is active and has disabled {0} extensions. Check if you can still reproduce the problem and proceed by selecting from these options.", bisectService.disabledCount),
      buttons: [
        {
          label: localize({ key: "next.good", comment: ["&& denotes a mnemonic"] }, "I ca&&n't reproduce"),
          run: () => false
          // good now
        },
        {
          label: localize({ key: "next.bad", comment: ["&& denotes a mnemonic"] }, "I can &&reproduce"),
          run: () => true
          // bad
        },
        {
          label: localize({ key: "next.stop", comment: ["&& denotes a mnemonic"] }, "&&Stop Bisect"),
          run: () => void 0
          // stop
        }
      ],
      cancelButton: {
        label: localize({ key: "next.cancel", comment: ["&& denotes a mnemonic"] }, "&&Cancel Bisect"),
        run: () => null
        // cancel
      }
    });
    return result;
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "extension.bisect.stop",
      title: localize2("title.stop", "Stop Extension Bisect"),
      category: Categories.Help,
      f1: true,
      precondition: ExtensionBisectUi.ctxIsBisectActive
    });
  }
  async run(accessor) {
    const extensionsBisect = accessor.get(IExtensionBisectService);
    const hostService = accessor.get(IHostService);
    await extensionsBisect.reset();
    hostService.reload();
  }
});
export {
  IExtensionBisectService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9icm93c2VyL2V4dGVuc2lvbkJpc2VjdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCBJR2xvYmFsRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIElMb2NhbEV4dGVuc2lvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblR5cGUsIElFeHRlbnNpb24sIGlzUmVzb2x2ZXJFeHRlbnNpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIElQcm9tcHRDaG9pY2UsIE5vdGlmaWNhdGlvblByaW9yaXR5LCBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgTWVudUlkLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBMaWZlY3ljbGVQaGFzZSB9IGZyb20gJy4uLy4uL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMsIElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBhcmVTYW1lRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnRVdGlsLmpzJztcbmltcG9ydCB7IENhdGVnb3JpZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbkNvbW1vbkNhdGVnb3JpZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuXG4vLyAtLS0gYmlzZWN0IHNlcnZpY2VcblxuZXhwb3J0IGNvbnN0IElFeHRlbnNpb25CaXNlY3RTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElFeHRlbnNpb25CaXNlY3RTZXJ2aWNlPignSUV4dGVuc2lvbkJpc2VjdFNlcnZpY2UnKTtcblxuZXhwb3J0IGludGVyZmFjZSBJRXh0ZW5zaW9uQmlzZWN0U2VydmljZSB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGlzRGlzYWJsZWRCeUJpc2VjdChleHRlbnNpb246IElFeHRlbnNpb24pOiBib29sZWFuO1xuXHRpc0FjdGl2ZTogYm9vbGVhbjtcblx0ZGlzYWJsZWRDb3VudDogbnVtYmVyO1xuXHRzdGFydChleHRlbnNpb25zOiBJTG9jYWxFeHRlbnNpb25bXSk6IFByb21pc2U8dm9pZD47XG5cdG5leHQoc2VlaW5nQmFkOiBib29sZWFuKTogUHJvbWlzZTx7IGlkOiBzdHJpbmc7IGJhZDogYm9vbGVhbiB9IHwgdW5kZWZpbmVkPjtcblx0cmVzZXQoKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuY2xhc3MgQmlzZWN0U3RhdGUge1xuXG5cdHN0YXRpYyBmcm9tSlNPTihyYXc6IHN0cmluZyB8IHVuZGVmaW5lZCk6IEJpc2VjdFN0YXRlIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXJhdykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0dHJ5IHtcblx0XHRcdGludGVyZmFjZSBSYXcgZXh0ZW5kcyBCaXNlY3RTdGF0ZSB7IH1cblx0XHRcdGNvbnN0IGRhdGE6IFJhdyA9IEpTT04ucGFyc2UocmF3KTtcblx0XHRcdHJldHVybiBuZXcgQmlzZWN0U3RhdGUoZGF0YS5leHRlbnNpb25zLCBkYXRhLmxvdywgZGF0YS5oaWdoLCBkYXRhLm1pZCk7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGV4dGVuc2lvbnM6IHN0cmluZ1tdLFxuXHRcdHJlYWRvbmx5IGxvdzogbnVtYmVyLFxuXHRcdHJlYWRvbmx5IGhpZ2g6IG51bWJlcixcblx0XHRyZWFkb25seSBtaWQ6IG51bWJlciA9ICgobG93ICsgaGlnaCkgLyAyKSB8IDBcblx0KSB7IH1cbn1cblxuY2xhc3MgRXh0ZW5zaW9uQmlzZWN0U2VydmljZSBpbXBsZW1lbnRzIElFeHRlbnNpb25CaXNlY3RTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBfc3RvcmFnZUtleSA9ICdleHRlbnNpb25CaXNlY3RTdGF0ZSc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc3RhdGU6IEJpc2VjdFN0YXRlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNhYmxlZCA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZW52U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZVxuXHQpIHtcblx0XHRjb25zdCByYXcgPSBfc3RvcmFnZVNlcnZpY2UuZ2V0KEV4dGVuc2lvbkJpc2VjdFNlcnZpY2UuX3N0b3JhZ2VLZXksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0dGhpcy5fc3RhdGUgPSBCaXNlY3RTdGF0ZS5mcm9tSlNPTihyYXcpO1xuXG5cdFx0aWYgKHRoaXMuX3N0YXRlKSB7XG5cdFx0XHRjb25zdCB7IG1pZCwgaGlnaCB9ID0gdGhpcy5fc3RhdGU7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3N0YXRlLmV4dGVuc2lvbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgaXNEaXNhYmxlZCA9IGkgPj0gbWlkICYmIGkgPCBoaWdoO1xuXHRcdFx0XHR0aGlzLl9kaXNhYmxlZC5zZXQodGhpcy5fc3RhdGUuZXh0ZW5zaW9uc1tpXSwgaXNEaXNhYmxlZCk7XG5cdFx0XHR9XG5cdFx0XHRsb2dTZXJ2aWNlLndhcm4oJ2V4dGVuc2lvbiBCSVNFQ1QgYWN0aXZlJywgWy4uLnRoaXMuX2Rpc2FibGVkXSk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0IGlzQWN0aXZlKCkge1xuXHRcdHJldHVybiAhIXRoaXMuX3N0YXRlO1xuXHR9XG5cblx0Z2V0IGRpc2FibGVkQ291bnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0YXRlID8gdGhpcy5fc3RhdGUuaGlnaCAtIHRoaXMuX3N0YXRlLm1pZCA6IC0xO1xuXHR9XG5cblx0aXNEaXNhYmxlZEJ5QmlzZWN0KGV4dGVuc2lvbjogSUV4dGVuc2lvbik6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5fc3RhdGUpIHtcblx0XHRcdC8vIGJpc2VjdCBpc24ndCBhY3RpdmVcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKGlzUmVzb2x2ZXJFeHRlbnNpb24oZXh0ZW5zaW9uLm1hbmlmZXN0LCB0aGlzLl9lbnZTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSkpIHtcblx0XHRcdC8vIHRoZSBjdXJyZW50IHJlbW90ZSByZXNvbHZlciBleHRlbnNpb24gY2Fubm90IGJlIGRpc2FibGVkXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9pc0VuYWJsZWRJbkVudihleHRlbnNpb24pKSB7XG5cdFx0XHQvLyBFeHRlbnNpb24gZW5hYmxlZCBpbiBlbnYgY2Fubm90IGJlIGRpc2FibGVkXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGNvbnN0IGRpc2FibGVkID0gdGhpcy5fZGlzYWJsZWQuZ2V0KGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0XHRyZXR1cm4gZGlzYWJsZWQgPz8gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIF9pc0VuYWJsZWRJbkVudihleHRlbnNpb246IElFeHRlbnNpb24pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gQXJyYXkuaXNBcnJheSh0aGlzLl9lbnZTZXJ2aWNlLmVuYWJsZUV4dGVuc2lvbnMpICYmIHRoaXMuX2VudlNlcnZpY2UuZW5hYmxlRXh0ZW5zaW9ucy5zb21lKGlkID0+IGFyZVNhbWVFeHRlbnNpb25zKHsgaWQgfSwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpKTtcblx0fVxuXG5cdGFzeW5jIHN0YXJ0KGV4dGVuc2lvbnM6IElMb2NhbEV4dGVuc2lvbltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuX3N0YXRlKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgc3RhdGUnKTtcblx0XHR9XG5cdFx0Y29uc3QgZXh0ZW5zaW9uSWRzID0gZXh0ZW5zaW9ucy5tYXAoZXh0ID0+IGV4dC5pZGVudGlmaWVyLmlkKTtcblx0XHRjb25zdCBuZXdTdGF0ZSA9IG5ldyBCaXNlY3RTdGF0ZShleHRlbnNpb25JZHMsIDAsIGV4dGVuc2lvbklkcy5sZW5ndGgsIDApO1xuXHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKEV4dGVuc2lvbkJpc2VjdFNlcnZpY2UuX3N0b3JhZ2VLZXksIEpTT04uc3RyaW5naWZ5KG5ld1N0YXRlKSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdGF3YWl0IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmZsdXNoKCk7XG5cdH1cblxuXHRhc3luYyBuZXh0KHNlZWluZ0JhZDogYm9vbGVhbik6IFByb21pc2U8eyBpZDogc3RyaW5nOyBiYWQ6IGJvb2xlYW4gfSB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghdGhpcy5fc3RhdGUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignaW52YWxpZCBzdGF0ZScpO1xuXHRcdH1cblx0XHQvLyBjaGVjayBpZiBiYWQgd2hlbiBhbGwgZXh0ZW5zaW9ucyBhcmUgZGlzYWJsZWRcblx0XHRpZiAoc2VlaW5nQmFkICYmIHRoaXMuX3N0YXRlLm1pZCA9PT0gMCAmJiB0aGlzLl9zdGF0ZS5oaWdoID09PSB0aGlzLl9zdGF0ZS5leHRlbnNpb25zLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHsgYmFkOiB0cnVlLCBpZDogJycgfTtcblx0XHR9XG5cdFx0Ly8gY2hlY2sgaWYgdGhlcmUgaXMgb25seSBvbmUgbGVmdFxuXHRcdGlmICh0aGlzLl9zdGF0ZS5sb3cgPT09IHRoaXMuX3N0YXRlLmhpZ2ggLSAxKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnJlc2V0KCk7XG5cdFx0XHRyZXR1cm4geyBpZDogdGhpcy5fc3RhdGUuZXh0ZW5zaW9uc1t0aGlzLl9zdGF0ZS5sb3ddLCBiYWQ6IHNlZWluZ0JhZCB9O1xuXHRcdH1cblx0XHQvLyB0aGUgc2Vjb25kIGhhbGYgaXMgZGlzYWJsZWQgc28gaWYgdGhlcmUgaXMgc3RpbGwgYmFkIGl0IG11c3QgYmVcblx0XHQvLyBpbiB0aGUgZmlyc3QgaGFsZlxuXHRcdGNvbnN0IG5leHRTdGF0ZSA9IG5ldyBCaXNlY3RTdGF0ZShcblx0XHRcdHRoaXMuX3N0YXRlLmV4dGVuc2lvbnMsXG5cdFx0XHRzZWVpbmdCYWQgPyB0aGlzLl9zdGF0ZS5sb3cgOiB0aGlzLl9zdGF0ZS5taWQsXG5cdFx0XHRzZWVpbmdCYWQgPyB0aGlzLl9zdGF0ZS5taWQgOiB0aGlzLl9zdGF0ZS5oaWdoLFxuXHRcdCk7XG5cdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2Uuc3RvcmUoRXh0ZW5zaW9uQmlzZWN0U2VydmljZS5fc3RvcmFnZUtleSwgSlNPTi5zdHJpbmdpZnkobmV4dFN0YXRlKSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdGF3YWl0IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmZsdXNoKCk7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGFzeW5jIHJlc2V0KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnJlbW92ZShFeHRlbnNpb25CaXNlY3RTZXJ2aWNlLl9zdG9yYWdlS2V5LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXHRcdGF3YWl0IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmZsdXNoKCk7XG5cdH1cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSUV4dGVuc2lvbkJpc2VjdFNlcnZpY2UsIEV4dGVuc2lvbkJpc2VjdFNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xuXG4vLyAtLS0gYmlzZWN0IFVJXG5cbmNsYXNzIEV4dGVuc2lvbkJpc2VjdFVpIHtcblxuXHRzdGF0aWMgY3R4SXNCaXNlY3RBY3RpdmUgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignaXNFeHRlbnNpb25CaXNlY3RBY3RpdmUnLCBmYWxzZSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uQmlzZWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25CaXNlY3RTZXJ2aWNlOiBJRXh0ZW5zaW9uQmlzZWN0U2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHQpIHtcblx0XHRpZiAoX2V4dGVuc2lvbkJpc2VjdFNlcnZpY2UuaXNBY3RpdmUpIHtcblx0XHRcdEV4dGVuc2lvbkJpc2VjdFVpLmN0eElzQmlzZWN0QWN0aXZlLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSkuc2V0KHRydWUpO1xuXHRcdFx0dGhpcy5fc2hvd0Jpc2VjdFByb21wdCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3Nob3dCaXNlY3RQcm9tcHQoKTogdm9pZCB7XG5cblx0XHRjb25zdCBnb29kUHJvbXB0OiBJUHJvbXB0Q2hvaWNlID0ge1xuXHRcdFx0bGFiZWw6IGxvY2FsaXplKCdJIGNhbm5vdCByZXByb2R1Y2UnLCBcIkkgY2FuJ3QgcmVwcm9kdWNlXCIpLFxuXHRcdFx0cnVuOiAoKSA9PiB0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnZXh0ZW5zaW9uLmJpc2VjdC5uZXh0JywgZmFsc2UpXG5cdFx0fTtcblx0XHRjb25zdCBiYWRQcm9tcHQ6IElQcm9tcHRDaG9pY2UgPSB7XG5cdFx0XHRsYWJlbDogbG9jYWxpemUoJ1RoaXMgaXMgQmFkJywgXCJJIGNhbiByZXByb2R1Y2VcIiksXG5cdFx0XHRydW46ICgpID0+IHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCdleHRlbnNpb24uYmlzZWN0Lm5leHQnLCB0cnVlKVxuXHRcdH07XG5cdFx0Y29uc3Qgc3RvcDogSVByb21wdENob2ljZSA9IHtcblx0XHRcdGxhYmVsOiAnU3RvcCBCaXNlY3QnLFxuXHRcdFx0cnVuOiAoKSA9PiB0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnZXh0ZW5zaW9uLmJpc2VjdC5zdG9wJylcblx0XHR9O1xuXG5cdFx0Y29uc3QgbWVzc2FnZSA9IHRoaXMuX2V4dGVuc2lvbkJpc2VjdFNlcnZpY2UuZGlzYWJsZWRDb3VudCA9PT0gMVxuXHRcdFx0PyBsb2NhbGl6ZSgnYmlzZWN0LnNpbmd1bGFyJywgXCJFeHRlbnNpb24gQmlzZWN0IGlzIGFjdGl2ZSBhbmQgaGFzIGRpc2FibGVkIDEgZXh0ZW5zaW9uLiBDaGVjayBpZiB5b3UgY2FuIHN0aWxsIHJlcHJvZHVjZSB0aGUgcHJvYmxlbSBhbmQgcHJvY2VlZCBieSBzZWxlY3RpbmcgZnJvbSB0aGVzZSBvcHRpb25zLlwiKVxuXHRcdFx0OiBsb2NhbGl6ZSgnYmlzZWN0LnBsdXJhbCcsIFwiRXh0ZW5zaW9uIEJpc2VjdCBpcyBhY3RpdmUgYW5kIGhhcyBkaXNhYmxlZCB7MH0gZXh0ZW5zaW9ucy4gQ2hlY2sgaWYgeW91IGNhbiBzdGlsbCByZXByb2R1Y2UgdGhlIHByb2JsZW0gYW5kIHByb2NlZWQgYnkgc2VsZWN0aW5nIGZyb20gdGhlc2Ugb3B0aW9ucy5cIiwgdGhpcy5fZXh0ZW5zaW9uQmlzZWN0U2VydmljZS5kaXNhYmxlZENvdW50KTtcblxuXHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFxuXHRcdFx0U2V2ZXJpdHkuSW5mbyxcblx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRbZ29vZFByb21wdCwgYmFkUHJvbXB0LCBzdG9wXSxcblx0XHRcdHsgc3RpY2t5OiB0cnVlLCBwcmlvcml0eTogTm90aWZpY2F0aW9uUHJpb3JpdHkuVVJHRU5UIH1cblx0XHQpO1xuXHR9XG59XG5cblJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KEV4dGVuc2lvbnMuV29ya2JlbmNoKS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihcblx0RXh0ZW5zaW9uQmlzZWN0VWksXG5cdExpZmVjeWNsZVBoYXNlLlJlc3RvcmVkXG4pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdleHRlbnNpb24uYmlzZWN0LnN0YXJ0Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3RpdGxlLnN0YXJ0JywgJ1N0YXJ0IEV4dGVuc2lvbiBCaXNlY3QnKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkhlbHAsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogRXh0ZW5zaW9uQmlzZWN0VWkuY3R4SXNCaXNlY3RBY3RpdmUubmVnYXRlKCksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld0NvbnRhaW5lclRpdGxlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXdDb250YWluZXInLCAnd29ya2JlbmNoLnZpZXcuZXh0ZW5zaW9ucycpLFxuXHRcdFx0XHRncm91cDogJzJfZW5hYmxlbWVudCcsXG5cdFx0XHRcdG9yZGVyOiA0XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBkaWFsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEaWFsb2dTZXJ2aWNlKTtcblx0XHRjb25zdCBob3N0U2VydmljZSA9IGFjY2Vzc29yLmdldChJSG9zdFNlcnZpY2UpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbk1hbmFnZW1lbnQgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlKTtcblx0XHRjb25zdCBleHRlbnNpb25FbmFibGVtZW50U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNCaXNlY3QgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbkJpc2VjdFNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZXh0ZW5zaW9ucyA9IChhd2FpdCBleHRlbnNpb25NYW5hZ2VtZW50LmdldEluc3RhbGxlZChFeHRlbnNpb25UeXBlLlVzZXIpKS5maWx0ZXIoZXh0ID0+IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZChleHQpKTtcblxuXHRcdGNvbnN0IHJlcyA9IGF3YWl0IGRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgnbXNnLnN0YXJ0JywgXCJFeHRlbnNpb24gQmlzZWN0XCIpLFxuXHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgnZGV0YWlsLnN0YXJ0JywgXCJFeHRlbnNpb24gQmlzZWN0IHdpbGwgdXNlIGJpbmFyeSBzZWFyY2ggdG8gZmluZCBhbiBleHRlbnNpb24gdGhhdCBjYXVzZXMgYSBwcm9ibGVtLiBEdXJpbmcgdGhlIHByb2Nlc3MgdGhlIHdpbmRvdyByZWxvYWRzIHJlcGVhdGVkbHkgKH57MH0gdGltZXMpLiBFYWNoIHRpbWUgeW91IG11c3QgY29uZmlybSBpZiB5b3UgYXJlIHN0aWxsIHNlZWluZyBwcm9ibGVtcy5cIiwgMiArIE1hdGgubG9nMihleHRlbnNpb25zLmxlbmd0aCkgfCAwKSxcblx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAnbXNnMicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlN0YXJ0IEV4dGVuc2lvbiBCaXNlY3RcIilcblx0XHR9KTtcblxuXHRcdGlmIChyZXMuY29uZmlybWVkKSB7XG5cdFx0XHRhd2FpdCBleHRlbnNpb25zQmlzZWN0LnN0YXJ0KGV4dGVuc2lvbnMpO1xuXHRcdFx0aG9zdFNlcnZpY2UucmVsb2FkKCk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZXh0ZW5zaW9uLmJpc2VjdC5uZXh0Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3RpdGxlLmlzQmFkJywgJ0NvbnRpbnVlIEV4dGVuc2lvbiBCaXNlY3QnKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkhlbHAsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogRXh0ZW5zaW9uQmlzZWN0VWkuY3R4SXNCaXNlY3RBY3RpdmVcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgc2VlaW5nQmFkOiBib29sZWFuIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSk7XG5cdFx0Y29uc3QgaG9zdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUhvc3RTZXJ2aWNlKTtcblx0XHRjb25zdCBiaXNlY3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25CaXNlY3RTZXJ2aWNlKTtcblx0XHRjb25zdCBwcm9kdWN0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUHJvZHVjdFNlcnZpY2UpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElHbG9iYWxFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSk7XG5cdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblxuXHRcdGlmICghYmlzZWN0U2VydmljZS5pc0FjdGl2ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoc2VlaW5nQmFkID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnN0IGdvb2RCYWRTdG9wQ2FuY2VsID0gYXdhaXQgdGhpcy5fY2hlY2tGb3JCYWQoZGlhbG9nU2VydmljZSwgYmlzZWN0U2VydmljZSk7XG5cdFx0XHRpZiAoZ29vZEJhZFN0b3BDYW5jZWwgPT09IG51bGwpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c2VlaW5nQmFkID0gZ29vZEJhZFN0b3BDYW5jZWw7XG5cdFx0fVxuXHRcdGlmIChzZWVpbmdCYWQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0YXdhaXQgYmlzZWN0U2VydmljZS5yZXNldCgpO1xuXHRcdFx0aG9zdFNlcnZpY2UucmVsb2FkKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGRvbmUgPSBhd2FpdCBiaXNlY3RTZXJ2aWNlLm5leHQoc2VlaW5nQmFkKTtcblx0XHRpZiAoIWRvbmUpIHtcblx0XHRcdGhvc3RTZXJ2aWNlLnJlbG9hZCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChkb25lLmJhZCkge1xuXHRcdFx0Ly8gRE9ORSBidXQgbm90aGluZyBmb3VuZFxuXHRcdFx0YXdhaXQgZGlhbG9nU2VydmljZS5pbmZvKFxuXHRcdFx0XHRsb2NhbGl6ZSgnZG9uZS5tc2cnLCBcIkV4dGVuc2lvbiBCaXNlY3RcIiksXG5cdFx0XHRcdGxvY2FsaXplKCdkb25lLmRldGFpbDInLCBcIkV4dGVuc2lvbiBCaXNlY3QgaXMgZG9uZSBidXQgbm8gZXh0ZW5zaW9uIGhhcyBiZWVuIGlkZW50aWZpZWQuIFRoaXMgbWlnaHQgYmUgYSBwcm9ibGVtIHdpdGggezB9LlwiLCBwcm9kdWN0U2VydmljZS5uYW1lU2hvcnQpXG5cdFx0XHQpO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIERPTkUgYW5kIGlkZW50aWZpZWQgZXh0ZW5zaW9uXG5cdFx0XHRjb25zdCByZXMgPSBhd2FpdCBkaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHR0eXBlOiBTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgnZG9uZS5tc2cnLCBcIkV4dGVuc2lvbiBCaXNlY3RcIiksXG5cdFx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAncmVwb3J0JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUmVwb3J0IElzc3VlICYgQ29udGludWVcIiksXG5cdFx0XHRcdGNhbmNlbEJ1dHRvbjogbG9jYWxpemUoJ2NvbnRpbnVlJywgXCJDb250aW51ZVwiKSxcblx0XHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgnZG9uZS5kZXRhaWwnLCBcIkV4dGVuc2lvbiBCaXNlY3QgaXMgZG9uZSBhbmQgaGFzIGlkZW50aWZpZWQgezB9IGFzIHRoZSBleHRlbnNpb24gY2F1c2luZyB0aGUgcHJvYmxlbS5cIiwgZG9uZS5pZCksXG5cdFx0XHRcdGNoZWNrYm94OiB7IGxhYmVsOiBsb2NhbGl6ZSgnZG9uZS5kaXNiYWxlJywgXCJLZWVwIHRoaXMgZXh0ZW5zaW9uIGRpc2FibGVkXCIpLCBjaGVja2VkOiB0cnVlIH1cblx0XHRcdH0pO1xuXHRcdFx0aWYgKHJlcy5jaGVja2JveENoZWNrZWQpIHtcblx0XHRcdFx0YXdhaXQgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuZGlzYWJsZUV4dGVuc2lvbih7IGlkOiBkb25lLmlkIH0sIHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAocmVzLmNvbmZpcm1lZCkge1xuXHRcdFx0XHRhd2FpdCBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnd29ya2JlbmNoLmFjdGlvbi5vcGVuSXNzdWVSZXBvcnRlcicsIGRvbmUuaWQpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRhd2FpdCBiaXNlY3RTZXJ2aWNlLnJlc2V0KCk7XG5cdFx0aG9zdFNlcnZpY2UucmVsb2FkKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jaGVja0ZvckJhZChkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSwgYmlzZWN0U2VydmljZTogSUV4dGVuc2lvbkJpc2VjdFNlcnZpY2UpOiBQcm9taXNlPGJvb2xlYW4gfCB1bmRlZmluZWQgfCBudWxsPiB7XG5cdFx0Y29uc3QgeyByZXN1bHQgfSA9IGF3YWl0IGRpYWxvZ1NlcnZpY2UucHJvbXB0PGJvb2xlYW4gfCB1bmRlZmluZWQgfCBudWxsPih7XG5cdFx0XHR0eXBlOiBTZXZlcml0eS5JbmZvLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ21zZy5uZXh0JywgXCJFeHRlbnNpb24gQmlzZWN0XCIpLFxuXHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgnYmlzZWN0JywgXCJFeHRlbnNpb24gQmlzZWN0IGlzIGFjdGl2ZSBhbmQgaGFzIGRpc2FibGVkIHswfSBleHRlbnNpb25zLiBDaGVjayBpZiB5b3UgY2FuIHN0aWxsIHJlcHJvZHVjZSB0aGUgcHJvYmxlbSBhbmQgcHJvY2VlZCBieSBzZWxlY3RpbmcgZnJvbSB0aGVzZSBvcHRpb25zLlwiLCBiaXNlY3RTZXJ2aWNlLmRpc2FibGVkQ291bnQpLFxuXHRcdFx0YnV0dG9uczogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKHsga2V5OiAnbmV4dC5nb29kJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkkgY2EmJm4ndCByZXByb2R1Y2VcIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiBmYWxzZSAvLyBnb29kIG5vd1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKHsga2V5OiAnbmV4dC5iYWQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiSSBjYW4gJiZyZXByb2R1Y2VcIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiB0cnVlIC8vIGJhZFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKHsga2V5OiAnbmV4dC5zdG9wJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmU3RvcCBCaXNlY3RcIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiB1bmRlZmluZWQgLy8gc3RvcFxuXHRcdFx0XHR9XG5cdFx0XHRdLFxuXHRcdFx0Y2FuY2VsQnV0dG9uOiB7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSh7IGtleTogJ25leHQuY2FuY2VsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmQ2FuY2VsIEJpc2VjdFwiKSxcblx0XHRcdFx0cnVuOiAoKSA9PiBudWxsIC8vIGNhbmNlbFxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdleHRlbnNpb24uYmlzZWN0LnN0b3AnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndGl0bGUuc3RvcCcsICdTdG9wIEV4dGVuc2lvbiBCaXNlY3QnKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkhlbHAsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogRXh0ZW5zaW9uQmlzZWN0VWkuY3R4SXNCaXNlY3RBY3RpdmVcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNCaXNlY3QgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbkJpc2VjdFNlcnZpY2UpO1xuXHRcdGNvbnN0IGhvc3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElIb3N0U2VydmljZSk7XG5cdFx0YXdhaXQgZXh0ZW5zaW9uc0Jpc2VjdC5yZXNldCgpO1xuXHRcdGhvc3RTZXJ2aWNlLnJlbG9hZCgpO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLDZCQUE2Qix5Q0FBMEQ7QUFDaEcsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBUyxlQUEyQiwyQkFBMkI7QUFDL0QsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsc0JBQXFDLHNCQUFzQixnQkFBZ0I7QUFDcEYsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyx1QkFBeUM7QUFDbEQsU0FBUyxTQUFTLFFBQVEsdUJBQXVCO0FBQ2pELFNBQVMsZ0JBQWdCLG9CQUFvQixxQkFBcUI7QUFDbEUsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxrQkFBbUQ7QUFDNUQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyw0Q0FBNEM7QUFJOUMsTUFBTSwwQkFBMEIsZ0JBQXlDLHlCQUF5QjtBQWN6RyxNQUFNLFlBQVk7QUFBQSxFQWVqQixZQUNVLFlB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
