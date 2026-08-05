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
import { createSingleCallFunction } from "../../../../base/common/functional.js";
import { isLinux } from "../../../../base/common/platform.js";
import Severity from "../../../../base/common/severity.js";
import { localize } from "../../../../nls.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IEncryptionService, KnownStorageProvider, PasswordStoreCLIOption, isGnome, isKwallet } from "../../../../platform/encryption/common/encryptionService.js";
import { INativeEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { BaseSecretStorageService, ISecretStorageService } from "../../../../platform/secrets/common/secrets.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IJSONEditingService } from "../../configuration/common/jsonEditing.js";
let NativeSecretStorageService = class extends BaseSecretStorageService {
  constructor(_notificationService, _dialogService, _openerService, _jsonEditingService, _environmentService, storageService, encryptionService, logService) {
    super(
      !!_environmentService.useInMemorySecretStorage,
      storageService,
      encryptionService,
      logService
    );
    this._notificationService = _notificationService;
    this._dialogService = _dialogService;
    this._openerService = _openerService;
    this._jsonEditingService = _jsonEditingService;
    this._environmentService = _environmentService;
    this.notifyOfNoEncryptionOnce = createSingleCallFunction(() => this.notifyOfNoEncryption());
  }
  set(key, value) {
    this._sequencer.queue(key, async () => {
      await this.resolvedStorageService;
      if (this.type !== "persisted" && !this._environmentService.useInMemorySecretStorage) {
        this._logService.trace("[NativeSecretStorageService] Notifying user that secrets are not being stored on disk.");
        await this.notifyOfNoEncryptionOnce();
      }
    });
    return super.set(key, value);
  }
  async notifyOfNoEncryption() {
    const buttons = [];
    const troubleshootingButton = {
      label: localize("troubleshootingButton", "Open troubleshooting guide"),
      run: () => this._openerService.open("https://go.microsoft.com/fwlink/?linkid=2239490"),
      // doesn't close dialogs
      keepOpen: true
    };
    buttons.push(troubleshootingButton);
    let errorMessage = localize("encryptionNotAvailableJustTroubleshootingGuide", "An OS keyring couldn't be identified for storing the encryption related data in your current desktop environment.");
    if (!isLinux) {
      this._notificationService.prompt(Severity.Error, errorMessage, buttons);
      return;
    }
    const provider = await this._encryptionService.getKeyStorageProvider();
    if (provider === KnownStorageProvider.basicText) {
      const detail = localize("usePlainTextExtraSentence", "Open the troubleshooting guide to address this or you can use weaker encryption that doesn't use the OS keyring.");
      const usePlainTextButton = {
        label: localize("usePlainText", "Use weaker encryption"),
        run: async () => {
          await this._encryptionService.setUsePlainTextEncryption();
          await this._jsonEditingService.write(this._environmentService.argvResource, [{ path: ["password-store"], value: PasswordStoreCLIOption.basic }], true);
          this.reinitialize();
        }
      };
      buttons.unshift(usePlainTextButton);
      await this._dialogService.prompt({
        type: "error",
        buttons,
        message: errorMessage,
        detail
      });
      return;
    }
    if (isGnome(provider)) {
      errorMessage = localize("isGnome", "You're running in a GNOME environment but the OS keyring is not available for encryption. Ensure you have gnome-keyring or another libsecret compatible implementation installed and running.");
    } else if (isKwallet(provider)) {
      errorMessage = localize("isKwallet", "You're running in a KDE environment but the OS keyring is not available for encryption. Ensure you have kwallet running.");
    }
    this._notificationService.prompt(Severity.Error, errorMessage, buttons);
  }
};
NativeSecretStorageService = __decorateClass([
  __decorateParam(0, INotificationService),
  __decorateParam(1, IDialogService),
  __decorateParam(2, IOpenerService),
  __decorateParam(3, IJSONEditingService),
  __decorateParam(4, INativeEnvironmentService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IEncryptionService),
  __decorateParam(7, ILogService)
], NativeSecretStorageService);
registerSingleton(ISecretStorageService, NativeSecretStorageService, InstantiationType.Delayed);
export {
  NativeSecretStorageService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VjcmV0cy9lbGVjdHJvbi1zYW5kYm94L3NlY3JldFN0b3JhZ2VTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgY3JlYXRlU2luZ2xlQ2FsbEZ1bmN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZnVuY3Rpb25hbC5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IFNldmVyaXR5IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NldmVyaXR5LmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJRW5jcnlwdGlvblNlcnZpY2UsIEtub3duU3RvcmFnZVByb3ZpZGVyLCBQYXNzd29yZFN0b3JlQ0xJT3B0aW9uLCBpc0dub21lLCBpc0t3YWxsZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lbmNyeXB0aW9uL2NvbW1vbi9lbmNyeXB0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgSVByb21wdENob2ljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgQmFzZVNlY3JldFN0b3JhZ2VTZXJ2aWNlLCBJU2VjcmV0U3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zZWNyZXRzL2NvbW1vbi9zZWNyZXRzLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUpTT05FZGl0aW5nU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbmZpZ3VyYXRpb24vY29tbW9uL2pzb25FZGl0aW5nLmpzJztcblxuZXhwb3J0IGNsYXNzIE5hdGl2ZVNlY3JldFN0b3JhZ2VTZXJ2aWNlIGV4dGVuZHMgQmFzZVNlY3JldFN0b3JhZ2VTZXJ2aWNlIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2RpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9vcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUpTT05FZGl0aW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9qc29uRWRpdGluZ1NlcnZpY2U6IElKU09ORWRpdGluZ1NlcnZpY2UsXG5cdFx0QElOYXRpdmVFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZW52aXJvbm1lbnRTZXJ2aWNlOiBJTmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUVuY3J5cHRpb25TZXJ2aWNlIGVuY3J5cHRpb25TZXJ2aWNlOiBJRW5jcnlwdGlvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0ISFfZW52aXJvbm1lbnRTZXJ2aWNlLnVzZUluTWVtb3J5U2VjcmV0U3RvcmFnZSxcblx0XHRcdHN0b3JhZ2VTZXJ2aWNlLFxuXHRcdFx0ZW5jcnlwdGlvblNlcnZpY2UsXG5cdFx0XHRsb2dTZXJ2aWNlXG5cdFx0KTtcblx0fVxuXG5cdG92ZXJyaWRlIHNldChrZXk6IHN0cmluZywgdmFsdWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3NlcXVlbmNlci5xdWV1ZShrZXksIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHRoaXMucmVzb2x2ZWRTdG9yYWdlU2VydmljZTtcblxuXHRcdFx0aWYgKHRoaXMudHlwZSAhPT0gJ3BlcnNpc3RlZCcgJiYgIXRoaXMuX2Vudmlyb25tZW50U2VydmljZS51c2VJbk1lbW9yeVNlY3JldFN0b3JhZ2UpIHtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZSgnW05hdGl2ZVNlY3JldFN0b3JhZ2VTZXJ2aWNlXSBOb3RpZnlpbmcgdXNlciB0aGF0IHNlY3JldHMgYXJlIG5vdCBiZWluZyBzdG9yZWQgb24gZGlzay4nKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5ub3RpZnlPZk5vRW5jcnlwdGlvbk9uY2UoKTtcblx0XHRcdH1cblxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHN1cGVyLnNldChrZXksIHZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgbm90aWZ5T2ZOb0VuY3J5cHRpb25PbmNlID0gY3JlYXRlU2luZ2xlQ2FsbEZ1bmN0aW9uKCgpID0+IHRoaXMubm90aWZ5T2ZOb0VuY3J5cHRpb24oKSk7XG5cdHByaXZhdGUgYXN5bmMgbm90aWZ5T2ZOb0VuY3J5cHRpb24oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgYnV0dG9uczogSVByb21wdENob2ljZVtdID0gW107XG5cdFx0Y29uc3QgdHJvdWJsZXNob290aW5nQnV0dG9uOiBJUHJvbXB0Q2hvaWNlID0ge1xuXHRcdFx0bGFiZWw6IGxvY2FsaXplKCd0cm91Ymxlc2hvb3RpbmdCdXR0b24nLCBcIk9wZW4gdHJvdWJsZXNob290aW5nIGd1aWRlXCIpLFxuXHRcdFx0cnVuOiAoKSA9PiB0aGlzLl9vcGVuZXJTZXJ2aWNlLm9wZW4oJ2h0dHBzOi8vZ28ubWljcm9zb2Z0LmNvbS9md2xpbmsvP2xpbmtpZD0yMjM5NDkwJyksXG5cdFx0XHQvLyBkb2Vzbid0IGNsb3NlIGRpYWxvZ3Ncblx0XHRcdGtlZXBPcGVuOiB0cnVlXG5cdFx0fTtcblx0XHRidXR0b25zLnB1c2godHJvdWJsZXNob290aW5nQnV0dG9uKTtcblxuXHRcdGxldCBlcnJvck1lc3NhZ2UgPSBsb2NhbGl6ZSgnZW5jcnlwdGlvbk5vdEF2YWlsYWJsZUp1c3RUcm91Ymxlc2hvb3RpbmdHdWlkZScsIFwiQW4gT1Mga2V5cmluZyBjb3VsZG4ndCBiZSBpZGVudGlmaWVkIGZvciBzdG9yaW5nIHRoZSBlbmNyeXB0aW9uIHJlbGF0ZWQgZGF0YSBpbiB5b3VyIGN1cnJlbnQgZGVza3RvcCBlbnZpcm9ubWVudC5cIik7XG5cblx0XHRpZiAoIWlzTGludXgpIHtcblx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFNldmVyaXR5LkVycm9yLCBlcnJvck1lc3NhZ2UsIGJ1dHRvbnMpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gYXdhaXQgdGhpcy5fZW5jcnlwdGlvblNlcnZpY2UuZ2V0S2V5U3RvcmFnZVByb3ZpZGVyKCk7XG5cdFx0aWYgKHByb3ZpZGVyID09PSBLbm93blN0b3JhZ2VQcm92aWRlci5iYXNpY1RleHQpIHtcblx0XHRcdGNvbnN0IGRldGFpbCA9IGxvY2FsaXplKCd1c2VQbGFpblRleHRFeHRyYVNlbnRlbmNlJywgXCJPcGVuIHRoZSB0cm91Ymxlc2hvb3RpbmcgZ3VpZGUgdG8gYWRkcmVzcyB0aGlzIG9yIHlvdSBjYW4gdXNlIHdlYWtlciBlbmNyeXB0aW9uIHRoYXQgZG9lc24ndCB1c2UgdGhlIE9TIGtleXJpbmcuXCIpO1xuXHRcdFx0Y29uc3QgdXNlUGxhaW5UZXh0QnV0dG9uOiBJUHJvbXB0Q2hvaWNlID0ge1xuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3VzZVBsYWluVGV4dCcsIFwiVXNlIHdlYWtlciBlbmNyeXB0aW9uXCIpLFxuXHRcdFx0XHRydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLl9lbmNyeXB0aW9uU2VydmljZS5zZXRVc2VQbGFpblRleHRFbmNyeXB0aW9uKCk7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5fanNvbkVkaXRpbmdTZXJ2aWNlLndyaXRlKHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5hcmd2UmVzb3VyY2UsIFt7IHBhdGg6IFsncGFzc3dvcmQtc3RvcmUnXSwgdmFsdWU6IFBhc3N3b3JkU3RvcmVDTElPcHRpb24uYmFzaWMgfV0sIHRydWUpO1xuXHRcdFx0XHRcdHRoaXMucmVpbml0aWFsaXplKCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRidXR0b25zLnVuc2hpZnQodXNlUGxhaW5UZXh0QnV0dG9uKTtcblxuXHRcdFx0YXdhaXQgdGhpcy5fZGlhbG9nU2VydmljZS5wcm9tcHQoe1xuXHRcdFx0XHR0eXBlOiAnZXJyb3InLFxuXHRcdFx0XHRidXR0b25zLFxuXHRcdFx0XHRtZXNzYWdlOiBlcnJvck1lc3NhZ2UsXG5cdFx0XHRcdGRldGFpbFxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGlzR25vbWUocHJvdmlkZXIpKSB7XG5cdFx0XHRlcnJvck1lc3NhZ2UgPSBsb2NhbGl6ZSgnaXNHbm9tZScsIFwiWW91J3JlIHJ1bm5pbmcgaW4gYSBHTk9NRSBlbnZpcm9ubWVudCBidXQgdGhlIE9TIGtleXJpbmcgaXMgbm90IGF2YWlsYWJsZSBmb3IgZW5jcnlwdGlvbi4gRW5zdXJlIHlvdSBoYXZlIGdub21lLWtleXJpbmcgb3IgYW5vdGhlciBsaWJzZWNyZXQgY29tcGF0aWJsZSBpbXBsZW1lbnRhdGlvbiBpbnN0YWxsZWQgYW5kIHJ1bm5pbmcuXCIpO1xuXHRcdH0gZWxzZSBpZiAoaXNLd2FsbGV0KHByb3ZpZGVyKSkge1xuXHRcdFx0ZXJyb3JNZXNzYWdlID0gbG9jYWxpemUoJ2lzS3dhbGxldCcsIFwiWW91J3JlIHJ1bm5pbmcgaW4gYSBLREUgZW52aXJvbm1lbnQgYnV0IHRoZSBPUyBrZXlyaW5nIGlzIG5vdCBhdmFpbGFibGUgZm9yIGVuY3J5cHRpb24uIEVuc3VyZSB5b3UgaGF2ZSBrd2FsbGV0IHJ1bm5pbmcuXCIpO1xuXHRcdH1cblxuXHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFNldmVyaXR5LkVycm9yLCBlcnJvck1lc3NhZ2UsIGJ1dHRvbnMpO1xuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElTZWNyZXRTdG9yYWdlU2VydmljZSwgTmF0aXZlU2VjcmV0U3RvcmFnZVNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGVBQWU7QUFDeEIsT0FBTyxjQUFjO0FBQ3JCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsb0JBQW9CLHNCQUFzQix3QkFBd0IsU0FBUyxpQkFBaUI7QUFDckcsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsNEJBQTJDO0FBQ3BELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMEJBQTBCLDZCQUE2QjtBQUNoRSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDJCQUEyQjtBQUU3QixJQUFNLDZCQUFOLGNBQXlDLHlCQUF5QjtBQUFBLEVBRXhFLFlBQ3dDLHNCQUNOLGdCQUNBLGdCQUNLLHFCQUNNLHFCQUMzQixnQkFDRyxtQkFDUCxZQUNaO0FBQ0Q7QUFBQSxNQUNDLENBQUMsQ0FBQyxvQkFBb0I7QUFBQSxNQUN0QjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQWR1QztBQUNOO0FBQ0E7QUFDSztBQUNNO0FBMkI3QyxTQUFRLDJCQUEyQix5QkFBeUIsTUFBTSxLQUFLLHFCQUFxQixDQUFDO0FBQUEsRUFoQjdGO0FBQUEsRUFFUyxJQUFJLEtBQWEsT0FBOEI7QUFDdkQsU0FBSyxXQUFXLE1BQU0sS0FBSyxZQUFZO0FBQ3RDLFlBQU0sS0FBSztBQUVYLFVBQUksS0FBSyxTQUFTLGVBQWUsQ0FBQyxLQUFLLG9CQUFvQiwwQkFBMEI7QUFDcEYsYUFBSyxZQUFZLE1BQU0sd0ZBQXdGO0FBQy9HLGNBQU0sS0FBSyx5QkFBeUI7QUFBQSxNQUNyQztBQUFBLElBRUQsQ0FBQztBQUVELFdBQU8sTUFBTSxJQUFJLEtBQUssS0FBSztBQUFBLEVBQzVCO0FBQUEsRUFHQSxNQUFjLHVCQUFzQztBQUNuRCxVQUFNLFVBQTJCLENBQUM7QUFDbEMsVUFBTSx3QkFBdUM7QUFBQSxNQUM1QyxPQUFPLFNBQVMseUJBQXlCLDRCQUE0QjtBQUFBLE1BQ3JFLEtBQUssTUFBTSxLQUFLLGVBQWUsS0FBSyxpREFBaUQ7QUFBQTtBQUFBLE1BRXJGLFVBQVU7QUFBQSxJQUNYO0FBQ0EsWUFBUSxLQUFLLHFCQUFxQjtBQUVsQyxRQUFJLGVBQWUsU0FBUyxrREFBa0QsbUhBQW1IO0FBRWpNLFFBQUksQ0FBQyxTQUFTO0FBQ2IsV0FBSyxxQkFBcUIsT0FBTyxTQUFTLE9BQU8sY0FBYyxPQUFPO0FBQ3RFO0FBQUEsSUFDRDtBQUVBLFVBQU0sV0FBVyxNQUFNLEtBQUssbUJBQW1CLHNCQUFzQjtBQUNyRSxRQUFJLGFBQWEscUJBQXFCLFdBQVc7QUFDaEQsWUFBTSxTQUFTLFNBQVMsNkJBQTZCLGtIQUFrSDtBQUN2SyxZQUFNLHFCQUFvQztBQUFBLFFBQ3pDLE9BQU8sU0FBUyxnQkFBZ0IsdUJBQXVCO0FBQUEsUUFDdkQsS0FBSyxZQUFZO0FBQ2hCLGdCQUFNLEtBQUssbUJBQW1CLDBCQUEwQjtBQUN4RCxnQkFBTSxLQUFLLG9CQUFvQixNQUFNLEtBQUssb0JBQW9CLGNBQWMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxnQkFBZ0IsR0FBRyxPQUFPLHVCQUF1QixNQUFNLENBQUMsR0FBRyxJQUFJO0FBQ3JKLGVBQUssYUFBYTtBQUFBLFFBQ25CO0FBQUEsTUFDRDtBQUNBLGNBQVEsUUFBUSxrQkFBa0I7QUFFbEMsWUFBTSxLQUFLLGVBQWUsT0FBTztBQUFBLFFBQ2hDLE1BQU07QUFBQSxRQUNOO0FBQUEsUUFDQSxTQUFTO0FBQUEsUUFDVDtBQUFBLE1BQ0QsQ0FBQztBQUNEO0FBQUEsSUFDRDtBQUVBLFFBQUksUUFBUSxRQUFRLEdBQUc7QUFDdEIscUJBQWUsU0FBUyxXQUFXLCtMQUErTDtBQUFBLElBQ25PLFdBQVcsVUFBVSxRQUFRLEdBQUc7QUFDL0IscUJBQWUsU0FBUyxhQUFhLDBIQUEwSDtBQUFBLElBQ2hLO0FBRUEsU0FBSyxxQkFBcUIsT0FBTyxTQUFTLE9BQU8sY0FBYyxPQUFPO0FBQUEsRUFDdkU7QUFDRDtBQWxGYSw2QkFBTjtBQUFBLEVBR0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FWVTtBQW9GYixrQkFBa0IsdUJBQXVCLDRCQUE0QixrQkFBa0IsT0FBTzsiLAogICJuYW1lcyI6IFtdCn0K
