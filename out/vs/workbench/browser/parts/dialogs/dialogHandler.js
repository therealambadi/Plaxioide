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
import { AbstractDialogHandler } from "../../../../platform/dialogs/common/dialogs.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import Severity from "../../../../base/common/severity.js";
import { Dialog } from "../../../../base/browser/ui/dialog/dialog.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { fromNow } from "../../../../base/common/date.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { MarkdownRenderer, openLinkFromMarkdown } from "../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { createWorkbenchDialogOptions } from "../../../../platform/dialogs/browser/dialog.js";
let BrowserDialogHandler = class extends AbstractDialogHandler {
  constructor(logService, layoutService, keybindingService, instantiationService, productService, clipboardService, openerService) {
    super();
    this.logService = logService;
    this.layoutService = layoutService;
    this.keybindingService = keybindingService;
    this.productService = productService;
    this.clipboardService = clipboardService;
    this.openerService = openerService;
    this.markdownRenderer = instantiationService.createInstance(MarkdownRenderer, {});
  }
  async prompt(prompt) {
    this.logService.trace("DialogService#prompt", prompt.message);
    const buttons = this.getPromptButtons(prompt);
    const { button, checkboxChecked } = await this.doShow(prompt.type, prompt.message, buttons, prompt.detail, prompt.cancelButton ? buttons.length - 1 : -1, prompt.checkbox, void 0, typeof prompt?.custom === "object" ? prompt.custom : void 0);
    return this.getPromptResult(prompt, button, checkboxChecked);
  }
  async confirm(confirmation) {
    this.logService.trace("DialogService#confirm", confirmation.message);
    const buttons = this.getConfirmationButtons(confirmation);
    const { button, checkboxChecked } = await this.doShow(confirmation.type ?? "question", confirmation.message, buttons, confirmation.detail, buttons.length - 1, confirmation.checkbox, void 0, typeof confirmation?.custom === "object" ? confirmation.custom : void 0);
    return { confirmed: button === 0, checkboxChecked };
  }
  async input(input) {
    this.logService.trace("DialogService#input", input.message);
    const buttons = this.getInputButtons(input);
    const { button, checkboxChecked, values } = await this.doShow(input.type ?? "question", input.message, buttons, input.detail, buttons.length - 1, input?.checkbox, input.inputs, typeof input.custom === "object" ? input.custom : void 0);
    return { confirmed: button === 0, checkboxChecked, values };
  }
  async about() {
    const detailString = (useAgo) => {
      return localize(
        "aboutDetail",
        "Version: {0}\nCommit: {1}\nDate: {2}\nBrowser: {3}",
        this.productService.version || "Unknown",
        this.productService.commit || "Unknown",
        this.productService.date ? `${this.productService.date}${useAgo ? " (" + fromNow(new Date(this.productService.date), true) + ")" : ""}` : "Unknown",
        navigator.userAgent
      );
    };
    const detail = detailString(true);
    const detailToCopy = detailString(false);
    const { button } = await this.doShow(
      Severity.Info,
      this.productService.nameLong,
      [
        localize({ key: "copy", comment: ["&& denotes a mnemonic"] }, "&&Copy"),
        localize("ok", "OK")
      ],
      detail,
      1
    );
    if (button === 0) {
      this.clipboardService.writeText(detailToCopy);
    }
  }
  async doShow(type, message, buttons, detail, cancelId, checkbox, inputs, customOptions) {
    const dialogDisposables = new DisposableStore();
    const renderBody = customOptions ? (parent) => {
      parent.classList.add(...customOptions.classes || []);
      customOptions.markdownDetails?.forEach((markdownDetail) => {
        const result2 = this.markdownRenderer.render(markdownDetail.markdown, {
          actionHandler: {
            callback: (link) => {
              if (markdownDetail.dismissOnLinkClick) {
                dialog.dispose();
              }
              return openLinkFromMarkdown(
                this.openerService,
                link,
                markdownDetail.markdown.isTrusted,
                true
                /* skip URL validation to prevent another dialog from showing which is unsupported */
              );
            },
            disposables: dialogDisposables
          }
        });
        parent.appendChild(result2.element);
        result2.element.classList.add(...markdownDetail.classes || []);
        dialogDisposables.add(result2);
      });
    } : void 0;
    const dialog = new Dialog(
      this.layoutService.activeContainer,
      message,
      buttons,
      createWorkbenchDialogOptions({
        detail,
        cancelId,
        type: this.getDialogType(type),
        renderBody,
        icon: customOptions?.icon,
        disableCloseAction: customOptions?.disableCloseAction,
        buttonDetails: customOptions?.buttonDetails,
        checkboxLabel: checkbox?.label,
        checkboxChecked: checkbox?.checked,
        inputs
      }, this.keybindingService, this.layoutService, BrowserDialogHandler.ALLOWABLE_COMMANDS)
    );
    dialogDisposables.add(dialog);
    const result = await dialog.show();
    dialogDisposables.dispose();
    return result;
  }
};
BrowserDialogHandler.ALLOWABLE_COMMANDS = [
  "copy",
  "cut",
  "editor.action.selectAll",
  "editor.action.clipboardCopyAction",
  "editor.action.clipboardCutAction",
  "editor.action.clipboardPasteAction"
];
BrowserDialogHandler = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, ILayoutService),
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IProductService),
  __decorateParam(5, IClipboardService),
  __decorateParam(6, IOpenerService)
], BrowserDialogHandler);
export {
  BrowserDialogHandler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9kaWFsb2dzL2RpYWxvZ0hhbmRsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlybWF0aW9uLCBJQ29uZmlybWF0aW9uUmVzdWx0LCBJSW5wdXRSZXN1bHQsIElDaGVja2JveCwgSUlucHV0RWxlbWVudCwgSUN1c3RvbURpYWxvZ09wdGlvbnMsIElJbnB1dCwgQWJzdHJhY3REaWFsb2dIYW5kbGVyLCBEaWFsb2dUeXBlLCBJUHJvbXB0LCBJQXN5bmNQcm9tcHRSZXN1bHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IElMYXlvdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBEaWFsb2csIElEaWFsb2dSZXN1bHQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvZGlhbG9nL2RpYWxvZy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBmcm9tTm93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGF0ZS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IE1hcmtkb3duUmVuZGVyZXIsIG9wZW5MaW5rRnJvbU1hcmtkb3duIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L21hcmtkb3duUmVuZGVyZXIvYnJvd3Nlci9tYXJrZG93blJlbmRlcmVyLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgY3JlYXRlV29ya2JlbmNoRGlhbG9nT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvYnJvd3Nlci9kaWFsb2cuanMnO1xuXG5leHBvcnQgY2xhc3MgQnJvd3NlckRpYWxvZ0hhbmRsZXIgZXh0ZW5kcyBBYnN0cmFjdERpYWxvZ0hhbmRsZXIge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEFMTE9XQUJMRV9DT01NQU5EUyA9IFtcblx0XHQnY29weScsXG5cdFx0J2N1dCcsXG5cdFx0J2VkaXRvci5hY3Rpb24uc2VsZWN0QWxsJyxcblx0XHQnZWRpdG9yLmFjdGlvbi5jbGlwYm9hcmRDb3B5QWN0aW9uJyxcblx0XHQnZWRpdG9yLmFjdGlvbi5jbGlwYm9hcmRDdXRBY3Rpb24nLFxuXHRcdCdlZGl0b3IuYWN0aW9uLmNsaXBib2FyZFBhc3RlQWN0aW9uJ1xuXHRdO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbWFya2Rvd25SZW5kZXJlcjogTWFya2Rvd25SZW5kZXJlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUxheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYXlvdXRTZXJ2aWNlOiBJTGF5b3V0U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElDbGlwYm9hcmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2xpcGJvYXJkU2VydmljZTogSUNsaXBib2FyZFNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMubWFya2Rvd25SZW5kZXJlciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hcmtkb3duUmVuZGVyZXIsIHt9KTtcblx0fVxuXG5cdGFzeW5jIHByb21wdDxUPihwcm9tcHQ6IElQcm9tcHQ8VD4pOiBQcm9taXNlPElBc3luY1Byb21wdFJlc3VsdDxUPj4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnRGlhbG9nU2VydmljZSNwcm9tcHQnLCBwcm9tcHQubWVzc2FnZSk7XG5cblx0XHRjb25zdCBidXR0b25zID0gdGhpcy5nZXRQcm9tcHRCdXR0b25zKHByb21wdCk7XG5cblx0XHRjb25zdCB7IGJ1dHRvbiwgY2hlY2tib3hDaGVja2VkIH0gPSBhd2FpdCB0aGlzLmRvU2hvdyhwcm9tcHQudHlwZSwgcHJvbXB0Lm1lc3NhZ2UsIGJ1dHRvbnMsIHByb21wdC5kZXRhaWwsIHByb21wdC5jYW5jZWxCdXR0b24gPyBidXR0b25zLmxlbmd0aCAtIDEgOiAtMSAvKiBEaXNhYmxlZCAqLywgcHJvbXB0LmNoZWNrYm94LCB1bmRlZmluZWQsIHR5cGVvZiBwcm9tcHQ/LmN1c3RvbSA9PT0gJ29iamVjdCcgPyBwcm9tcHQuY3VzdG9tIDogdW5kZWZpbmVkKTtcblxuXHRcdHJldHVybiB0aGlzLmdldFByb21wdFJlc3VsdChwcm9tcHQsIGJ1dHRvbiwgY2hlY2tib3hDaGVja2VkKTtcblx0fVxuXG5cdGFzeW5jIGNvbmZpcm0oY29uZmlybWF0aW9uOiBJQ29uZmlybWF0aW9uKTogUHJvbWlzZTxJQ29uZmlybWF0aW9uUmVzdWx0PiB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdEaWFsb2dTZXJ2aWNlI2NvbmZpcm0nLCBjb25maXJtYXRpb24ubWVzc2FnZSk7XG5cblx0XHRjb25zdCBidXR0b25zID0gdGhpcy5nZXRDb25maXJtYXRpb25CdXR0b25zKGNvbmZpcm1hdGlvbik7XG5cblx0XHRjb25zdCB7IGJ1dHRvbiwgY2hlY2tib3hDaGVja2VkIH0gPSBhd2FpdCB0aGlzLmRvU2hvdyhjb25maXJtYXRpb24udHlwZSA/PyAncXVlc3Rpb24nLCBjb25maXJtYXRpb24ubWVzc2FnZSwgYnV0dG9ucywgY29uZmlybWF0aW9uLmRldGFpbCwgYnV0dG9ucy5sZW5ndGggLSAxLCBjb25maXJtYXRpb24uY2hlY2tib3gsIHVuZGVmaW5lZCwgdHlwZW9mIGNvbmZpcm1hdGlvbj8uY3VzdG9tID09PSAnb2JqZWN0JyA/IGNvbmZpcm1hdGlvbi5jdXN0b20gOiB1bmRlZmluZWQpO1xuXG5cdFx0cmV0dXJuIHsgY29uZmlybWVkOiBidXR0b24gPT09IDAsIGNoZWNrYm94Q2hlY2tlZCB9O1xuXHR9XG5cblx0YXN5bmMgaW5wdXQoaW5wdXQ6IElJbnB1dCk6IFByb21pc2U8SUlucHV0UmVzdWx0PiB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdEaWFsb2dTZXJ2aWNlI2lucHV0JywgaW5wdXQubWVzc2FnZSk7XG5cblx0XHRjb25zdCBidXR0b25zID0gdGhpcy5nZXRJbnB1dEJ1dHRvbnMoaW5wdXQpO1xuXG5cdFx0Y29uc3QgeyBidXR0b24sIGNoZWNrYm94Q2hlY2tlZCwgdmFsdWVzIH0gPSBhd2FpdCB0aGlzLmRvU2hvdyhpbnB1dC50eXBlID8/ICdxdWVzdGlvbicsIGlucHV0Lm1lc3NhZ2UsIGJ1dHRvbnMsIGlucHV0LmRldGFpbCwgYnV0dG9ucy5sZW5ndGggLSAxLCBpbnB1dD8uY2hlY2tib3gsIGlucHV0LmlucHV0cywgdHlwZW9mIGlucHV0LmN1c3RvbSA9PT0gJ29iamVjdCcgPyBpbnB1dC5jdXN0b20gOiB1bmRlZmluZWQpO1xuXG5cdFx0cmV0dXJuIHsgY29uZmlybWVkOiBidXR0b24gPT09IDAsIGNoZWNrYm94Q2hlY2tlZCwgdmFsdWVzIH07XG5cdH1cblxuXHRhc3luYyBhYm91dCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBkZXRhaWxTdHJpbmcgPSAodXNlQWdvOiBib29sZWFuKTogc3RyaW5nID0+IHtcblx0XHRcdHJldHVybiBsb2NhbGl6ZSgnYWJvdXREZXRhaWwnLFxuXHRcdFx0XHRcIlZlcnNpb246IHswfVxcbkNvbW1pdDogezF9XFxuRGF0ZTogezJ9XFxuQnJvd3NlcjogezN9XCIsXG5cdFx0XHRcdHRoaXMucHJvZHVjdFNlcnZpY2UudmVyc2lvbiB8fCAnVW5rbm93bicsXG5cdFx0XHRcdHRoaXMucHJvZHVjdFNlcnZpY2UuY29tbWl0IHx8ICdVbmtub3duJyxcblx0XHRcdFx0dGhpcy5wcm9kdWN0U2VydmljZS5kYXRlID8gYCR7dGhpcy5wcm9kdWN0U2VydmljZS5kYXRlfSR7dXNlQWdvID8gJyAoJyArIGZyb21Ob3cobmV3IERhdGUodGhpcy5wcm9kdWN0U2VydmljZS5kYXRlKSwgdHJ1ZSkgKyAnKScgOiAnJ31gIDogJ1Vua25vd24nLFxuXHRcdFx0XHRuYXZpZ2F0b3IudXNlckFnZW50XG5cdFx0XHQpO1xuXHRcdH07XG5cblx0XHRjb25zdCBkZXRhaWwgPSBkZXRhaWxTdHJpbmcodHJ1ZSk7XG5cdFx0Y29uc3QgZGV0YWlsVG9Db3B5ID0gZGV0YWlsU3RyaW5nKGZhbHNlKTtcblxuXHRcdGNvbnN0IHsgYnV0dG9uIH0gPSBhd2FpdCB0aGlzLmRvU2hvdyhcblx0XHRcdFNldmVyaXR5LkluZm8sXG5cdFx0XHR0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVMb25nLFxuXHRcdFx0W1xuXHRcdFx0XHRsb2NhbGl6ZSh7IGtleTogJ2NvcHknLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZDb3B5XCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgnb2snLCBcIk9LXCIpXG5cdFx0XHRdLFxuXHRcdFx0ZGV0YWlsLFxuXHRcdFx0MVxuXHRcdCk7XG5cblx0XHRpZiAoYnV0dG9uID09PSAwKSB7XG5cdFx0XHR0aGlzLmNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KGRldGFpbFRvQ29weSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1Nob3codHlwZTogU2V2ZXJpdHkgfCBEaWFsb2dUeXBlIHwgdW5kZWZpbmVkLCBtZXNzYWdlOiBzdHJpbmcsIGJ1dHRvbnM/OiBzdHJpbmdbXSwgZGV0YWlsPzogc3RyaW5nLCBjYW5jZWxJZD86IG51bWJlciwgY2hlY2tib3g/OiBJQ2hlY2tib3gsIGlucHV0cz86IElJbnB1dEVsZW1lbnRbXSwgY3VzdG9tT3B0aW9ucz86IElDdXN0b21EaWFsb2dPcHRpb25zKTogUHJvbWlzZTxJRGlhbG9nUmVzdWx0PiB7XG5cdFx0Y29uc3QgZGlhbG9nRGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCByZW5kZXJCb2R5ID0gY3VzdG9tT3B0aW9ucyA/IChwYXJlbnQ6IEhUTUxFbGVtZW50KSA9PiB7XG5cdFx0XHRwYXJlbnQuY2xhc3NMaXN0LmFkZCguLi4oY3VzdG9tT3B0aW9ucy5jbGFzc2VzIHx8IFtdKSk7XG5cdFx0XHRjdXN0b21PcHRpb25zLm1hcmtkb3duRGV0YWlscz8uZm9yRWFjaChtYXJrZG93bkRldGFpbCA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMubWFya2Rvd25SZW5kZXJlci5yZW5kZXIobWFya2Rvd25EZXRhaWwubWFya2Rvd24sIHtcblx0XHRcdFx0XHRhY3Rpb25IYW5kbGVyOiB7XG5cdFx0XHRcdFx0XHRjYWxsYmFjazogbGluayA9PiB7XG5cdFx0XHRcdFx0XHRcdGlmIChtYXJrZG93bkRldGFpbC5kaXNtaXNzT25MaW5rQ2xpY2spIHtcblx0XHRcdFx0XHRcdFx0XHRkaWFsb2cuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHJldHVybiBvcGVuTGlua0Zyb21NYXJrZG93bih0aGlzLm9wZW5lclNlcnZpY2UsIGxpbmssIG1hcmtkb3duRGV0YWlsLm1hcmtkb3duLmlzVHJ1c3RlZCwgdHJ1ZSAvKiBza2lwIFVSTCB2YWxpZGF0aW9uIHRvIHByZXZlbnQgYW5vdGhlciBkaWFsb2cgZnJvbSBzaG93aW5nIHdoaWNoIGlzIHVuc3VwcG9ydGVkICovKTtcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRkaXNwb3NhYmxlczogZGlhbG9nRGlzcG9zYWJsZXNcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRwYXJlbnQuYXBwZW5kQ2hpbGQocmVzdWx0LmVsZW1lbnQpO1xuXHRcdFx0XHRyZXN1bHQuZWxlbWVudC5jbGFzc0xpc3QuYWRkKC4uLihtYXJrZG93bkRldGFpbC5jbGFzc2VzIHx8IFtdKSk7XG5cdFx0XHRcdGRpYWxvZ0Rpc3Bvc2FibGVzLmFkZChyZXN1bHQpO1xuXHRcdFx0fSk7XG5cdFx0fSA6IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IGRpYWxvZyA9IG5ldyBEaWFsb2coXG5cdFx0XHR0aGlzLmxheW91dFNlcnZpY2UuYWN0aXZlQ29udGFpbmVyLFxuXHRcdFx0bWVzc2FnZSxcblx0XHRcdGJ1dHRvbnMsXG5cdFx0XHRjcmVhdGVXb3JrYmVuY2hEaWFsb2dPcHRpb25zKHtcblx0XHRcdFx0ZGV0YWlsLFxuXHRcdFx0XHRjYW5jZWxJZCxcblx0XHRcdFx0dHlwZTogdGhpcy5nZXREaWFsb2dUeXBlKHR5cGUpLFxuXHRcdFx0XHRyZW5kZXJCb2R5LFxuXHRcdFx0XHRpY29uOiBjdXN0b21PcHRpb25zPy5pY29uLFxuXHRcdFx0XHRkaXNhYmxlQ2xvc2VBY3Rpb246IGN1c3RvbU9wdGlvbnM/LmRpc2FibGVDbG9zZUFjdGlvbixcblx0XHRcdFx0YnV0dG9uRGV0YWlsczogY3VzdG9tT3B0aW9ucz8uYnV0dG9uRGV0YWlscyxcblx0XHRcdFx0Y2hlY2tib3hMYWJlbDogY2hlY2tib3g/LmxhYmVsLFxuXHRcdFx0XHRjaGVja2JveENoZWNrZWQ6IGNoZWNrYm94Py5jaGVja2VkLFxuXHRcdFx0XHRpbnB1dHNcblx0XHRcdH0sIHRoaXMua2V5YmluZGluZ1NlcnZpY2UsIHRoaXMubGF5b3V0U2VydmljZSwgQnJvd3NlckRpYWxvZ0hhbmRsZXIuQUxMT1dBQkxFX0NPTU1BTkRTKVxuXHRcdCk7XG5cblx0XHRkaWFsb2dEaXNwb3NhYmxlcy5hZGQoZGlhbG9nKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRpYWxvZy5zaG93KCk7XG5cdFx0ZGlhbG9nRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFtSCw2QkFBc0U7QUFDekwsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxtQkFBbUI7QUFDNUIsT0FBTyxjQUFjO0FBQ3JCLFNBQVMsY0FBNkI7QUFDdEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsa0JBQWtCLDRCQUE0QjtBQUN2RCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG9DQUFvQztBQUV0QyxJQUFNLHVCQUFOLGNBQW1DLHNCQUFzQjtBQUFBLEVBYS9ELFlBQytCLFlBQ0csZUFDSSxtQkFDZCxzQkFDVyxnQkFDRSxrQkFDSCxlQUNoQztBQUNELFVBQU07QUFSd0I7QUFDRztBQUNJO0FBRUg7QUFDRTtBQUNIO0FBSWpDLFNBQUssbUJBQW1CLHFCQUFxQixlQUFlLGtCQUFrQixDQUFDLENBQUM7QUFBQSxFQUNqRjtBQUFBLEVBRUEsTUFBTSxPQUFVLFFBQW9EO0FBQ25FLFNBQUssV0FBVyxNQUFNLHdCQUF3QixPQUFPLE9BQU87QUFFNUQsVUFBTSxVQUFVLEtBQUssaUJBQWlCLE1BQU07QUFFNUMsVUFBTSxFQUFFLFFBQVEsZ0JBQWdCLElBQUksTUFBTSxLQUFLLE9BQU8sT0FBTyxNQUFNLE9BQU8sU0FBUyxTQUFTLE9BQU8sUUFBUSxPQUFPLGVBQWUsUUFBUSxTQUFTLElBQUksSUFBbUIsT0FBTyxVQUFVLFFBQVcsT0FBTyxRQUFRLFdBQVcsV0FBVyxPQUFPLFNBQVMsTUFBUztBQUVuUSxXQUFPLEtBQUssZ0JBQWdCLFFBQVEsUUFBUSxlQUFlO0FBQUEsRUFDNUQ7QUFBQSxFQUVBLE1BQU0sUUFBUSxjQUEyRDtBQUN4RSxTQUFLLFdBQVcsTUFBTSx5QkFBeUIsYUFBYSxPQUFPO0FBRW5FLFVBQU0sVUFBVSxLQUFLLHVCQUF1QixZQUFZO0FBRXhELFVBQU0sRUFBRSxRQUFRLGdCQUFnQixJQUFJLE1BQU0sS0FBSyxPQUFPLGFBQWEsUUFBUSxZQUFZLGFBQWEsU0FBUyxTQUFTLGFBQWEsUUFBUSxRQUFRLFNBQVMsR0FBRyxhQUFhLFVBQVUsUUFBVyxPQUFPLGNBQWMsV0FBVyxXQUFXLGFBQWEsU0FBUyxNQUFTO0FBRTNRLFdBQU8sRUFBRSxXQUFXLFdBQVcsR0FBRyxnQkFBZ0I7QUFBQSxFQUNuRDtBQUFBLEVBRUEsTUFBTSxNQUFNLE9BQXNDO0FBQ2pELFNBQUssV0FBVyxNQUFNLHVCQUF1QixNQUFNLE9BQU87QUFFMUQsVUFBTSxVQUFVLEtBQUssZ0JBQWdCLEtBQUs7QUFFMUMsVUFBTSxFQUFFLFFBQVEsaUJBQWlCLE9BQU8sSUFBSSxNQUFNLEtBQUssT0FBTyxNQUFNLFFBQVEsWUFBWSxNQUFNLFNBQVMsU0FBUyxNQUFNLFFBQVEsUUFBUSxTQUFTLEdBQUcsT0FBTyxVQUFVLE1BQU0sUUFBUSxPQUFPLE1BQU0sV0FBVyxXQUFXLE1BQU0sU0FBUyxNQUFTO0FBRTVPLFdBQU8sRUFBRSxXQUFXLFdBQVcsR0FBRyxpQkFBaUIsT0FBTztBQUFBLEVBQzNEO0FBQUEsRUFFQSxNQUFNLFFBQXVCO0FBQzVCLFVBQU0sZUFBZSxDQUFDLFdBQTRCO0FBQ2pELGFBQU87QUFBQSxRQUFTO0FBQUEsUUFDZjtBQUFBLFFBQ0EsS0FBSyxlQUFlLFdBQVc7QUFBQSxRQUMvQixLQUFLLGVBQWUsVUFBVTtBQUFBLFFBQzlCLEtBQUssZUFBZSxPQUFPLEdBQUcsS0FBSyxlQUFlLElBQUksR0FBRyxTQUFTLE9BQU8sUUFBUSxJQUFJLEtBQUssS0FBSyxlQUFlLElBQUksR0FBRyxJQUFJLElBQUksTUFBTSxFQUFFLEtBQUs7QUFBQSxRQUMxSSxVQUFVO0FBQUEsTUFDWDtBQUFBLElBQ0Q7QUFFQSxVQUFNLFNBQVMsYUFBYSxJQUFJO0FBQ2hDLFVBQU0sZUFBZSxhQUFhLEtBQUs7QUFFdkMsVUFBTSxFQUFFLE9BQU8sSUFBSSxNQUFNLEtBQUs7QUFBQSxNQUM3QixTQUFTO0FBQUEsTUFDVCxLQUFLLGVBQWU7QUFBQSxNQUNwQjtBQUFBLFFBQ0MsU0FBUyxFQUFFLEtBQUssUUFBUSxTQUFTLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxRQUFRO0FBQUEsUUFDdEUsU0FBUyxNQUFNLElBQUk7QUFBQSxNQUNwQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUVBLFFBQUksV0FBVyxHQUFHO0FBQ2pCLFdBQUssaUJBQWlCLFVBQVUsWUFBWTtBQUFBLElBQzdDO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYyxPQUFPLE1BQXlDLFNBQWlCLFNBQW9CLFFBQWlCLFVBQW1CLFVBQXNCLFFBQTBCLGVBQThEO0FBQ3BQLFVBQU0sb0JBQW9CLElBQUksZ0JBQWdCO0FBRTlDLFVBQU0sYUFBYSxnQkFBZ0IsQ0FBQyxXQUF3QjtBQUMzRCxhQUFPLFVBQVUsSUFBSSxHQUFJLGNBQWMsV0FBVyxDQUFDLENBQUU7QUFDckQsb0JBQWMsaUJBQWlCLFFBQVEsb0JBQWtCO0FBQ3hELGNBQU1BLFVBQVMsS0FBSyxpQkFBaUIsT0FBTyxlQUFlLFVBQVU7QUFBQSxVQUNwRSxlQUFlO0FBQUEsWUFDZCxVQUFVLFVBQVE7QUFDakIsa0JBQUksZUFBZSxvQkFBb0I7QUFDdEMsdUJBQU8sUUFBUTtBQUFBLGNBQ2hCO0FBQ0EscUJBQU87QUFBQSxnQkFBcUIsS0FBSztBQUFBLGdCQUFlO0FBQUEsZ0JBQU0sZUFBZSxTQUFTO0FBQUEsZ0JBQVc7QUFBQTtBQUFBLGNBQTBGO0FBQUEsWUFDcEw7QUFBQSxZQUNBLGFBQWE7QUFBQSxVQUNkO0FBQUEsUUFDRCxDQUFDO0FBQ0QsZUFBTyxZQUFZQSxRQUFPLE9BQU87QUFDakMsUUFBQUEsUUFBTyxRQUFRLFVBQVUsSUFBSSxHQUFJLGVBQWUsV0FBVyxDQUFDLENBQUU7QUFDOUQsMEJBQWtCLElBQUlBLE9BQU07QUFBQSxNQUM3QixDQUFDO0FBQUEsSUFDRixJQUFJO0FBRUosVUFBTSxTQUFTLElBQUk7QUFBQSxNQUNsQixLQUFLLGNBQWM7QUFBQSxNQUNuQjtBQUFBLE1BQ0E7QUFBQSxNQUNBLDZCQUE2QjtBQUFBLFFBQzVCO0FBQUEsUUFDQTtBQUFBLFFBQ0EsTUFBTSxLQUFLLGNBQWMsSUFBSTtBQUFBLFFBQzdCO0FBQUEsUUFDQSxNQUFNLGVBQWU7QUFBQSxRQUNyQixvQkFBb0IsZUFBZTtBQUFBLFFBQ25DLGVBQWUsZUFBZTtBQUFBLFFBQzlCLGVBQWUsVUFBVTtBQUFBLFFBQ3pCLGlCQUFpQixVQUFVO0FBQUEsUUFDM0I7QUFBQSxNQUNELEdBQUcsS0FBSyxtQkFBbUIsS0FBSyxlQUFlLHFCQUFxQixrQkFBa0I7QUFBQSxJQUN2RjtBQUVBLHNCQUFrQixJQUFJLE1BQU07QUFFNUIsVUFBTSxTQUFTLE1BQU0sT0FBTyxLQUFLO0FBQ2pDLHNCQUFrQixRQUFRO0FBRTFCLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUF2SWEscUJBRVkscUJBQXFCO0FBQUEsRUFDNUM7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUNEO0FBVFksdUJBQU47QUFBQSxFQWNKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FwQlU7IiwKICAibmFtZXMiOiBbInJlc3VsdCJdCn0K
