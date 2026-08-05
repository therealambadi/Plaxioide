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
import { safeInnerHtml } from "../../../../base/browser/dom.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { isLinux, isWindows } from "../../../../base/common/platform.js";
import Severity from "../../../../base/common/severity.js";
import { localize } from "../../../../nls.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { ExtensionIdentifier, ExtensionIdentifierSet } from "../../../../platform/extensions/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import product from "../../../../platform/product/common/product.js";
import { AuxiliaryWindowMode, IAuxiliaryWindowService } from "../../../services/auxiliaryWindow/browser/auxiliaryWindowService.js";
import { IHostService } from "../../../services/host/browser/host.js";
import BaseHtml from "./issueReporterPage.js";
import { IssueWebReporter } from "./issueReporterService.js";
import "./media/issueReporter.css";
let IssueFormService = class {
  constructor(instantiationService, auxiliaryWindowService, menuService, contextKeyService, logService, dialogService, hostService) {
    this.instantiationService = instantiationService;
    this.auxiliaryWindowService = auxiliaryWindowService;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.logService = logService;
    this.dialogService = dialogService;
    this.hostService = hostService;
    this.issueReporterWindow = null;
    this.extensionIdentifierSet = new ExtensionIdentifierSet();
    this.arch = "";
    this.release = "";
    this.type = "";
  }
  async openReporter(data) {
    if (this.hasToReload(data)) {
      return;
    }
    await this.openAuxIssueReporter(data);
    if (this.issueReporterWindow) {
      const issueReporter = this.instantiationService.createInstance(IssueWebReporter, false, data, { type: this.type, arch: this.arch, release: this.release }, product, this.issueReporterWindow);
      issueReporter.render();
    }
  }
  async openAuxIssueReporter(data, bounds) {
    let issueReporterBounds = { width: 700, height: 800 };
    if (bounds && bounds.x && bounds.y) {
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      issueReporterBounds = { ...issueReporterBounds, x: centerX - 350, y: centerY - 400 };
    }
    const disposables = new DisposableStore();
    const auxiliaryWindow = disposables.add(await this.auxiliaryWindowService.open({ mode: AuxiliaryWindowMode.Normal, bounds: issueReporterBounds, nativeTitlebar: true, disableFullscreen: true }));
    const platformClass = isWindows ? "windows" : isLinux ? "linux" : "mac";
    if (auxiliaryWindow) {
      await auxiliaryWindow.whenStylesHaveLoaded;
      auxiliaryWindow.window.document.title = "Issue Reporter";
      auxiliaryWindow.window.document.body.classList.add("issue-reporter-body", "monaco-workbench", platformClass);
      const div = document.createElement("div");
      div.classList.add("monaco-workbench");
      auxiliaryWindow.container.remove();
      auxiliaryWindow.window.document.body.appendChild(div);
      safeInnerHtml(div, BaseHtml());
      this.issueReporterWindow = auxiliaryWindow.window;
    } else {
      console.error("Failed to open auxiliary window");
      disposables.dispose();
    }
    this.issueReporterWindow?.addEventListener("beforeunload", () => {
      auxiliaryWindow.window.close();
      disposables.dispose();
      this.issueReporterWindow = null;
    });
  }
  async sendReporterMenu(extensionId) {
    const menu = this.menuService.createMenu(MenuId.IssueReporter, this.contextKeyService);
    const actions = menu.getActions({ renderShortTitle: true }).flatMap((entry) => entry[1]);
    for (const action of actions) {
      try {
        if (action.item && "source" in action.item && action.item.source?.id.toLowerCase() === extensionId.toLowerCase()) {
          this.extensionIdentifierSet.add(extensionId.toLowerCase());
          await action.run();
        }
      } catch (error) {
        console.error(error);
      }
    }
    if (!this.extensionIdentifierSet.has(extensionId)) {
      return void 0;
    }
    this.extensionIdentifierSet.delete(new ExtensionIdentifier(extensionId));
    menu.dispose();
    const result = this.currentData;
    this.currentData = void 0;
    return result ?? void 0;
  }
  //#region used by issue reporter
  async closeReporter() {
    this.issueReporterWindow?.close();
  }
  async reloadWithExtensionsDisabled() {
    if (this.issueReporterWindow) {
      try {
        await this.hostService.reload({ disableExtensions: true });
      } catch (error) {
        this.logService.error(error);
      }
    }
  }
  async showConfirmCloseDialog() {
    await this.dialogService.prompt({
      type: Severity.Warning,
      message: localize("confirmCloseIssueReporter", "Your input will not be saved. Are you sure you want to close this window?"),
      buttons: [
        {
          label: localize({ key: "yes", comment: ["&& denotes a mnemonic"] }, "&&Yes"),
          run: () => {
            this.closeReporter();
            this.issueReporterWindow = null;
          }
        },
        {
          label: localize("cancel", "Cancel"),
          run: () => {
          }
        }
      ]
    });
  }
  async showClipboardDialog() {
    let result = false;
    await this.dialogService.prompt({
      type: Severity.Warning,
      message: localize("issueReporterWriteToClipboard", "There is too much data to send to GitHub directly. The data will be copied to the clipboard, please paste it into the GitHub issue page that is opened."),
      buttons: [
        {
          label: localize({ key: "ok", comment: ["&& denotes a mnemonic"] }, "&&OK"),
          run: () => {
            result = true;
          }
        },
        {
          label: localize("cancel", "Cancel"),
          run: () => {
            result = false;
          }
        }
      ]
    });
    return result;
  }
  hasToReload(data) {
    if (data.extensionId && this.extensionIdentifierSet.has(data.extensionId)) {
      this.currentData = data;
      this.issueReporterWindow?.focus();
      return true;
    }
    if (this.issueReporterWindow) {
      this.issueReporterWindow.focus();
      return true;
    }
    return false;
  }
};
IssueFormService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IAuxiliaryWindowService),
  __decorateParam(2, IMenuService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, IHostService)
], IssueFormService);
export {
  IssueFormService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pc3N1ZS9icm93c2VyL2lzc3VlRm9ybVNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuaW1wb3J0IHsgc2FmZUlubmVySHRtbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGlzTGludXgsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJTWVudVNlcnZpY2UsIE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciwgRXh0ZW5zaW9uSWRlbnRpZmllclNldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCBwcm9kdWN0IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3QuanMnO1xuaW1wb3J0IHsgSVJlY3RhbmdsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dpbmRvdy9jb21tb24vd2luZG93LmpzJztcbmltcG9ydCB7IEF1eGlsaWFyeVdpbmRvd01vZGUsIElBdXhpbGlhcnlXaW5kb3dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvYXV4aWxpYXJ5V2luZG93L2Jyb3dzZXIvYXV4aWxpYXJ5V2luZG93U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBJSXNzdWVGb3JtU2VydmljZSwgSXNzdWVSZXBvcnRlckRhdGEgfSBmcm9tICcuLi9jb21tb24vaXNzdWUuanMnO1xuaW1wb3J0IEJhc2VIdG1sIGZyb20gJy4vaXNzdWVSZXBvcnRlclBhZ2UuanMnO1xuaW1wb3J0IHsgSXNzdWVXZWJSZXBvcnRlciB9IGZyb20gJy4vaXNzdWVSZXBvcnRlclNlcnZpY2UuanMnO1xuaW1wb3J0ICcuL21lZGlhL2lzc3VlUmVwb3J0ZXIuY3NzJztcblxuZXhwb3J0IGludGVyZmFjZSBJc3N1ZVBhc3NEYXRhIHtcblx0aXNzdWVUaXRsZTogc3RyaW5nO1xuXHRpc3N1ZUJvZHk6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIElzc3VlRm9ybVNlcnZpY2UgaW1wbGVtZW50cyBJSXNzdWVGb3JtU2VydmljZSB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByb3RlY3RlZCBjdXJyZW50RGF0YTogSXNzdWVSZXBvcnRlckRhdGEgfCB1bmRlZmluZWQ7XG5cblx0cHJvdGVjdGVkIGlzc3VlUmVwb3J0ZXJXaW5kb3c6IFdpbmRvdyB8IG51bGwgPSBudWxsO1xuXHRwcm90ZWN0ZWQgZXh0ZW5zaW9uSWRlbnRpZmllclNldDogRXh0ZW5zaW9uSWRlbnRpZmllclNldCA9IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyU2V0KCk7XG5cblx0cHJvdGVjdGVkIGFyY2g6IHN0cmluZyA9ICcnO1xuXHRwcm90ZWN0ZWQgcmVsZWFzZTogc3RyaW5nID0gJyc7XG5cdHByb3RlY3RlZCB0eXBlOiBzdHJpbmcgPSAnJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQXV4aWxpYXJ5V2luZG93U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgYXV4aWxpYXJ5V2luZG93U2VydmljZTogSUF1eGlsaWFyeVdpbmRvd1NlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlXG5cdCkgeyB9XG5cblx0YXN5bmMgb3BlblJlcG9ydGVyKGRhdGE6IElzc3VlUmVwb3J0ZXJEYXRhKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuaGFzVG9SZWxvYWQoZGF0YSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLm9wZW5BdXhJc3N1ZVJlcG9ydGVyKGRhdGEpO1xuXG5cdFx0aWYgKHRoaXMuaXNzdWVSZXBvcnRlcldpbmRvdykge1xuXHRcdFx0Y29uc3QgaXNzdWVSZXBvcnRlciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSXNzdWVXZWJSZXBvcnRlciwgZmFsc2UsIGRhdGEsIHsgdHlwZTogdGhpcy50eXBlLCBhcmNoOiB0aGlzLmFyY2gsIHJlbGVhc2U6IHRoaXMucmVsZWFzZSB9LCBwcm9kdWN0LCB0aGlzLmlzc3VlUmVwb3J0ZXJXaW5kb3cpO1xuXHRcdFx0aXNzdWVSZXBvcnRlci5yZW5kZXIoKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBvcGVuQXV4SXNzdWVSZXBvcnRlcihkYXRhOiBJc3N1ZVJlcG9ydGVyRGF0YSwgYm91bmRzPzogSVJlY3RhbmdsZSk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0bGV0IGlzc3VlUmVwb3J0ZXJCb3VuZHM6IFBhcnRpYWw8SVJlY3RhbmdsZT4gPSB7IHdpZHRoOiA3MDAsIGhlaWdodDogODAwIH07XG5cblx0XHQvLyBDZW50ZXIgSXNzdWUgUmVwb3J0ZXIgV2luZG93IGJhc2VkIG9uIGJvdW5kcyBmcm9tIG5hdGl2ZSBob3N0IHNlcnZpY2Vcblx0XHRpZiAoYm91bmRzICYmIGJvdW5kcy54ICYmIGJvdW5kcy55KSB7XG5cdFx0XHRjb25zdCBjZW50ZXJYID0gYm91bmRzLnggKyBib3VuZHMud2lkdGggLyAyO1xuXHRcdFx0Y29uc3QgY2VudGVyWSA9IGJvdW5kcy55ICsgYm91bmRzLmhlaWdodCAvIDI7XG5cdFx0XHRpc3N1ZVJlcG9ydGVyQm91bmRzID0geyAuLi5pc3N1ZVJlcG9ydGVyQm91bmRzLCB4OiBjZW50ZXJYIC0gMzUwLCB5OiBjZW50ZXJZIC0gNDAwIH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHQvLyBBdXhpbGlhcnkgV2luZG93XG5cdFx0Y29uc3QgYXV4aWxpYXJ5V2luZG93ID0gZGlzcG9zYWJsZXMuYWRkKGF3YWl0IHRoaXMuYXV4aWxpYXJ5V2luZG93U2VydmljZS5vcGVuKHsgbW9kZTogQXV4aWxpYXJ5V2luZG93TW9kZS5Ob3JtYWwsIGJvdW5kczogaXNzdWVSZXBvcnRlckJvdW5kcywgbmF0aXZlVGl0bGViYXI6IHRydWUsIGRpc2FibGVGdWxsc2NyZWVuOiB0cnVlIH0pKTtcblxuXHRcdGNvbnN0IHBsYXRmb3JtQ2xhc3MgPSBpc1dpbmRvd3MgPyAnd2luZG93cycgOiBpc0xpbnV4ID8gJ2xpbnV4JyA6ICdtYWMnO1xuXG5cdFx0aWYgKGF1eGlsaWFyeVdpbmRvdykge1xuXHRcdFx0YXdhaXQgYXV4aWxpYXJ5V2luZG93LndoZW5TdHlsZXNIYXZlTG9hZGVkO1xuXHRcdFx0YXV4aWxpYXJ5V2luZG93LndpbmRvdy5kb2N1bWVudC50aXRsZSA9ICdJc3N1ZSBSZXBvcnRlcic7XG5cdFx0XHRhdXhpbGlhcnlXaW5kb3cud2luZG93LmRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZCgnaXNzdWUtcmVwb3J0ZXItYm9keScsICdtb25hY28td29ya2JlbmNoJywgcGxhdGZvcm1DbGFzcyk7XG5cblx0XHRcdC8vIGN1c3RvbSBpc3N1ZSByZXBvcnRlciB3cmFwcGVyXG5cdFx0XHRjb25zdCBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdGRpdi5jbGFzc0xpc3QuYWRkKCdtb25hY28td29ya2JlbmNoJyk7XG5cblx0XHRcdC8vIHJlbW92ZXMgcHJlc2V0IG1vbmFjby13b3JrYmVuY2hcblx0XHRcdGF1eGlsaWFyeVdpbmRvdy5jb250YWluZXIucmVtb3ZlKCk7XG5cdFx0XHRhdXhpbGlhcnlXaW5kb3cud2luZG93LmRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGl2KTtcblx0XHRcdHNhZmVJbm5lckh0bWwoZGl2LCBCYXNlSHRtbCgpKTtcblxuXHRcdFx0dGhpcy5pc3N1ZVJlcG9ydGVyV2luZG93ID0gYXV4aWxpYXJ5V2luZG93LndpbmRvdztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc29sZS5lcnJvcignRmFpbGVkIHRvIG9wZW4gYXV4aWxpYXJ5IHdpbmRvdycpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHRcdC8vIGhhbmRsZSBjbG9zaW5nIGlzc3VlIHJlcG9ydGVyXG5cdFx0dGhpcy5pc3N1ZVJlcG9ydGVyV2luZG93Py5hZGRFdmVudExpc3RlbmVyKCdiZWZvcmV1bmxvYWQnLCAoKSA9PiB7XG5cdFx0XHRhdXhpbGlhcnlXaW5kb3cud2luZG93LmNsb3NlKCk7XG5cdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLmlzc3VlUmVwb3J0ZXJXaW5kb3cgPSBudWxsO1xuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgc2VuZFJlcG9ydGVyTWVudShleHRlbnNpb25JZDogc3RyaW5nKTogUHJvbWlzZTxJc3N1ZVJlcG9ydGVyRGF0YSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IG1lbnUgPSB0aGlzLm1lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUoTWVudUlkLklzc3VlUmVwb3J0ZXIsIHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0Ly8gcmVuZGVyIG1lbnUgYW5kIGRpc3Bvc2Vcblx0XHRjb25zdCBhY3Rpb25zID0gbWVudS5nZXRBY3Rpb25zKHsgcmVuZGVyU2hvcnRUaXRsZTogdHJ1ZSB9KS5mbGF0TWFwKGVudHJ5ID0+IGVudHJ5WzFdKTtcblx0XHRmb3IgKGNvbnN0IGFjdGlvbiBvZiBhY3Rpb25zKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRpZiAoYWN0aW9uLml0ZW0gJiYgJ3NvdXJjZScgaW4gYWN0aW9uLml0ZW0gJiYgYWN0aW9uLml0ZW0uc291cmNlPy5pZC50b0xvd2VyQ2FzZSgpID09PSBleHRlbnNpb25JZC50b0xvd2VyQ2FzZSgpKSB7XG5cdFx0XHRcdFx0dGhpcy5leHRlbnNpb25JZGVudGlmaWVyU2V0LmFkZChleHRlbnNpb25JZC50b0xvd2VyQ2FzZSgpKTtcblx0XHRcdFx0XHRhd2FpdCBhY3Rpb24ucnVuKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghdGhpcy5leHRlbnNpb25JZGVudGlmaWVyU2V0LmhhcyhleHRlbnNpb25JZCkpIHtcblx0XHRcdC8vIHNlbmQgdW5kZWZpbmVkIHRvIGluZGljYXRlIG5vIGFjdGlvbiB3YXMgdGFrZW5cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gd2UgZm91bmQgdGhlIGV4dGVuc2lvbiwgbm93IHdlIGNsZWFuIHVwIHRoZSBtZW51IGFuZCByZW1vdmUgaXQgZnJvbSB0aGUgc2V0LiBUaGlzIGlzIHRvIGVuc3VyZSB0aGF0IHdlIGRvIGR1cGxpY2F0ZSBleHRlbnNpb24gaWRlbnRpZmllcnNcblx0XHR0aGlzLmV4dGVuc2lvbklkZW50aWZpZXJTZXQuZGVsZXRlKG5ldyBFeHRlbnNpb25JZGVudGlmaWVyKGV4dGVuc2lvbklkKSk7XG5cdFx0bWVudS5kaXNwb3NlKCk7XG5cblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLmN1cnJlbnREYXRhO1xuXG5cdFx0Ly8gcmVzZXQgY3VycmVudCBkYXRhLlxuXHRcdHRoaXMuY3VycmVudERhdGEgPSB1bmRlZmluZWQ7XG5cblx0XHRyZXR1cm4gcmVzdWx0ID8/IHVuZGVmaW5lZDtcblx0fVxuXG5cdC8vI3JlZ2lvbiB1c2VkIGJ5IGlzc3VlIHJlcG9ydGVyXG5cblx0YXN5bmMgY2xvc2VSZXBvcnRlcigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmlzc3VlUmVwb3J0ZXJXaW5kb3c/LmNsb3NlKCk7XG5cdH1cblxuXHRhc3luYyByZWxvYWRXaXRoRXh0ZW5zaW9uc0Rpc2FibGVkKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmlzc3VlUmVwb3J0ZXJXaW5kb3cpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuaG9zdFNlcnZpY2UucmVsb2FkKHsgZGlzYWJsZUV4dGVuc2lvbnM6IHRydWUgfSk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHNob3dDb25maXJtQ2xvc2VEaWFsb2coKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLnByb21wdCh7XG5cdFx0XHR0eXBlOiBTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2NvbmZpcm1DbG9zZUlzc3VlUmVwb3J0ZXInLCBcIllvdXIgaW5wdXQgd2lsbCBub3QgYmUgc2F2ZWQuIEFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBjbG9zZSB0aGlzIHdpbmRvdz9cIiksXG5cdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoeyBrZXk6ICd5ZXMnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZZZXNcIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLmNsb3NlUmVwb3J0ZXIoKTtcblx0XHRcdFx0XHRcdHRoaXMuaXNzdWVSZXBvcnRlcldpbmRvdyA9IG51bGw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdjYW5jZWwnLCBcIkNhbmNlbFwiKSxcblx0XHRcdFx0XHRydW46ICgpID0+IHsgfVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBzaG93Q2xpcGJvYXJkRGlhbG9nKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGxldCByZXN1bHQgPSBmYWxzZTtcblxuXHRcdGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5wcm9tcHQoe1xuXHRcdFx0dHlwZTogU2V2ZXJpdHkuV2FybmluZyxcblx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdpc3N1ZVJlcG9ydGVyV3JpdGVUb0NsaXBib2FyZCcsIFwiVGhlcmUgaXMgdG9vIG11Y2ggZGF0YSB0byBzZW5kIHRvIEdpdEh1YiBkaXJlY3RseS4gVGhlIGRhdGEgd2lsbCBiZSBjb3BpZWQgdG8gdGhlIGNsaXBib2FyZCwgcGxlYXNlIHBhc3RlIGl0IGludG8gdGhlIEdpdEh1YiBpc3N1ZSBwYWdlIHRoYXQgaXMgb3BlbmVkLlwiKSxcblx0XHRcdGJ1dHRvbnM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSh7IGtleTogJ29rJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmT0tcIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiB7IHJlc3VsdCA9IHRydWU7IH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnY2FuY2VsJywgXCJDYW5jZWxcIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiB7IHJlc3VsdCA9IGZhbHNlOyB9XG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9KTtcblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRoYXNUb1JlbG9hZChkYXRhOiBJc3N1ZVJlcG9ydGVyRGF0YSk6IGJvb2xlYW4ge1xuXHRcdGlmIChkYXRhLmV4dGVuc2lvbklkICYmIHRoaXMuZXh0ZW5zaW9uSWRlbnRpZmllclNldC5oYXMoZGF0YS5leHRlbnNpb25JZCkpIHtcblx0XHRcdHRoaXMuY3VycmVudERhdGEgPSBkYXRhO1xuXHRcdFx0dGhpcy5pc3N1ZVJlcG9ydGVyV2luZG93Py5mb2N1cygpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaXNzdWVSZXBvcnRlcldpbmRvdykge1xuXHRcdFx0dGhpcy5pc3N1ZVJlcG9ydGVyV2luZG93LmZvY3VzKCk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBSUEsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxTQUFTLGlCQUFpQjtBQUNuQyxPQUFPLGNBQWM7QUFDckIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxjQUFjLGNBQWM7QUFDckMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxxQkFBcUIsOEJBQThCO0FBQzVELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CO0FBQzVCLE9BQU8sYUFBYTtBQUVwQixTQUFTLHFCQUFxQiwrQkFBK0I7QUFDN0QsU0FBUyxvQkFBb0I7QUFFN0IsT0FBTyxjQUFjO0FBQ3JCLFNBQVMsd0JBQXdCO0FBQ2pDLE9BQU87QUFPQSxJQUFNLG1CQUFOLE1BQW9EO0FBQUEsRUFhMUQsWUFDMkMs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
