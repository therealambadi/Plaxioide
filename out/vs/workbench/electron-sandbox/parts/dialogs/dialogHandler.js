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
import { fromNow } from "../../../../base/common/date.js";
import { isLinuxSnap } from "../../../../base/common/platform.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { AbstractDialogHandler } from "../../../../platform/dialogs/common/dialogs.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { process } from "../../../../base/parts/sandbox/electron-sandbox/globals.js";
import { getActiveWindow } from "../../../../base/browser/dom.js";
let NativeDialogHandler = class extends AbstractDialogHandler {
  constructor(logService, nativeHostService, productService, clipboardService) {
    super();
    this.logService = logService;
    this.nativeHostService = nativeHostService;
    this.productService = productService;
    this.clipboardService = clipboardService;
  }
  async prompt(prompt) {
    this.logService.trace("DialogService#prompt", prompt.message);
    const buttons = this.getPromptButtons(prompt);
    const { response, checkboxChecked } = await this.nativeHostService.showMessageBox({
      type: this.getDialogType(prompt.type),
      title: prompt.title,
      message: prompt.message,
      detail: prompt.detail,
      buttons,
      cancelId: prompt.cancelButton ? buttons.length - 1 : -1,
      checkboxLabel: prompt.checkbox?.label,
      checkboxChecked: prompt.checkbox?.checked,
      targetWindowId: getActiveWindow().vscodeWindowId
    });
    return this.getPromptResult(prompt, response, checkboxChecked);
  }
  async confirm(confirmation) {
    this.logService.trace("DialogService#confirm", confirmation.message);
    const buttons = this.getConfirmationButtons(confirmation);
    const { response, checkboxChecked } = await this.nativeHostService.showMessageBox({
      type: this.getDialogType(confirmation.type) ?? "question",
      title: confirmation.title,
      message: confirmation.message,
      detail: confirmation.detail,
      buttons,
      cancelId: buttons.length - 1,
      checkboxLabel: confirmation.checkbox?.label,
      checkboxChecked: confirmation.checkbox?.checked,
      targetWindowId: getActiveWindow().vscodeWindowId
    });
    return { confirmed: response === 0, checkboxChecked };
  }
  input() {
    throw new Error("Unsupported");
  }
  async about() {
    let version = this.productService.version;
    if (this.productService.target) {
      version = `${version} (${this.productService.target} setup)`;
    } else if (this.productService.darwinUniversalAssetId) {
      version = `${version} (Universal)`;
    }
    const osProps = await this.nativeHostService.getOSProperties();
    const detailString = (useAgo) => {
      return localize(
        { key: "aboutDetail", comment: ["Electron, Chromium, Node.js and V8 are product names that need no translation"] },
        "VSCode Version: {0}\nVoid Version: {1}\nCommit: {2}\nDate: {3}\nElectron: {4}\nElectronBuildId: {5}\nChromium: {6}\nNode.js: {7}\nV8: {8}\nOS: {9}",
        version,
        this.productService.voidVersion || "Unknown",
        // Void added this
        this.productService.commit || "Unknown",
        this.productService.date ? `${this.productService.date}${useAgo ? " (" + fromNow(new Date(this.productService.date), true) + ")" : ""}` : "Unknown",
        process.versions["electron"],
        process.versions["microsoft-build"],
        process.versions["chrome"],
        process.versions["node"],
        process.versions["v8"],
        `${osProps.type} ${osProps.arch} ${osProps.release}${isLinuxSnap ? " snap" : ""}`
      );
    };
    const detail = detailString(true);
    const detailToCopy = detailString(false);
    const { response } = await this.nativeHostService.showMessageBox({
      type: "info",
      message: this.productService.nameLong,
      detail: `
${detail}`,
      buttons: [
        localize({ key: "copy", comment: ["&& denotes a mnemonic"] }, "&&Copy"),
        localize("okButton", "OK")
      ],
      targetWindowId: getActiveWindow().vscodeWindowId
    });
    if (response === 0) {
      this.clipboardService.writeText(detailToCopy);
    }
  }
};
NativeDialogHandler = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, INativeHostService),
  __decorateParam(2, IProductService),
  __decorateParam(3, IClipboardService)
], NativeDialogHandler);
export {
  NativeDialogHandler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvZWxlY3Ryb24tc2FuZGJveC9wYXJ0cy9kaWFsb2dzL2RpYWxvZ0hhbmRsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBmcm9tTm93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGF0ZS5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4U25hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEFic3RyYWN0RGlhbG9nSGFuZGxlciwgSUNvbmZpcm1hdGlvbiwgSUNvbmZpcm1hdGlvblJlc3VsdCwgSVByb21wdCwgSUFzeW5jUHJvbXB0UmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElOYXRpdmVIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25hdGl2ZS9jb21tb24vbmF0aXZlLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHByb2Nlc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3BhcnRzL3NhbmRib3gvZWxlY3Ryb24tc2FuZGJveC9nbG9iYWxzLmpzJztcbmltcG9ydCB7IGdldEFjdGl2ZVdpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuXG5leHBvcnQgY2xhc3MgTmF0aXZlRGlhbG9nSGFuZGxlciBleHRlbmRzIEFic3RyYWN0RGlhbG9nSGFuZGxlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElOYXRpdmVIb3N0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5hdGl2ZUhvc3RTZXJ2aWNlOiBJTmF0aXZlSG9zdFNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElDbGlwYm9hcmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2xpcGJvYXJkU2VydmljZTogSUNsaXBib2FyZFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGFzeW5jIHByb21wdDxUPihwcm9tcHQ6IElQcm9tcHQ8VD4pOiBQcm9taXNlPElBc3luY1Byb21wdFJlc3VsdDxUPj4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnRGlhbG9nU2VydmljZSNwcm9tcHQnLCBwcm9tcHQubWVzc2FnZSk7XG5cblx0XHRjb25zdCBidXR0b25zID0gdGhpcy5nZXRQcm9tcHRCdXR0b25zKHByb21wdCk7XG5cblx0XHRjb25zdCB7IHJlc3BvbnNlLCBjaGVja2JveENoZWNrZWQgfSA9IGF3YWl0IHRoaXMubmF0aXZlSG9zdFNlcnZpY2Uuc2hvd01lc3NhZ2VCb3goe1xuXHRcdFx0dHlwZTogdGhpcy5nZXREaWFsb2dUeXBlKHByb21wdC50eXBlKSxcblx0XHRcdHRpdGxlOiBwcm9tcHQudGl0bGUsXG5cdFx0XHRtZXNzYWdlOiBwcm9tcHQubWVzc2FnZSxcblx0XHRcdGRldGFpbDogcHJvbXB0LmRldGFpbCxcblx0XHRcdGJ1dHRvbnMsXG5cdFx0XHRjYW5jZWxJZDogcHJvbXB0LmNhbmNlbEJ1dHRvbiA/IGJ1dHRvbnMubGVuZ3RoIC0gMSA6IC0xIC8qIERpc2FibGVkICovLFxuXHRcdFx0Y2hlY2tib3hMYWJlbDogcHJvbXB0LmNoZWNrYm94Py5sYWJlbCxcblx0XHRcdGNoZWNrYm94Q2hlY2tlZDogcHJvbXB0LmNoZWNrYm94Py5jaGVja2VkLFxuXHRcdFx0dGFyZ2V0V2luZG93SWQ6IGdldEFjdGl2ZVdpbmRvdygpLnZzY29kZVdpbmRvd0lkXG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gdGhpcy5nZXRQcm9tcHRSZXN1bHQocHJvbXB0LCByZXNwb25zZSwgY2hlY2tib3hDaGVja2VkKTtcblx0fVxuXG5cdGFzeW5jIGNvbmZpcm0oY29uZmlybWF0aW9uOiBJQ29uZmlybWF0aW9uKTogUHJvbWlzZTxJQ29uZmlybWF0aW9uUmVzdWx0PiB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdEaWFsb2dTZXJ2aWNlI2NvbmZpcm0nLCBjb25maXJtYXRpb24ubWVzc2FnZSk7XG5cblx0XHRjb25zdCBidXR0b25zID0gdGhpcy5nZXRDb25maXJtYXRpb25CdXR0b25zKGNvbmZpcm1hdGlvbik7XG5cblx0XHRjb25zdCB7IHJlc3BvbnNlLCBjaGVja2JveENoZWNrZWQgfSA9IGF3YWl0IHRoaXMubmF0aXZlSG9zdFNlcnZpY2Uuc2hvd01lc3NhZ2VCb3goe1xuXHRcdFx0dHlwZTogdGhpcy5nZXREaWFsb2dUeXBlKGNvbmZpcm1hdGlvbi50eXBlKSA/PyAncXVlc3Rpb24nLFxuXHRcdFx0dGl0bGU6IGNvbmZpcm1hdGlvbi50aXRsZSxcblx0XHRcdG1lc3NhZ2U6IGNvbmZpcm1hdGlvbi5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsOiBjb25maXJtYXRpb24uZGV0YWlsLFxuXHRcdFx0YnV0dG9ucyxcblx0XHRcdGNhbmNlbElkOiBidXR0b25zLmxlbmd0aCAtIDEsXG5cdFx0XHRjaGVja2JveExhYmVsOiBjb25maXJtYXRpb24uY2hlY2tib3g/LmxhYmVsLFxuXHRcdFx0Y2hlY2tib3hDaGVja2VkOiBjb25maXJtYXRpb24uY2hlY2tib3g/LmNoZWNrZWQsXG5cdFx0XHR0YXJnZXRXaW5kb3dJZDogZ2V0QWN0aXZlV2luZG93KCkudnNjb2RlV2luZG93SWRcblx0XHR9KTtcblxuXHRcdHJldHVybiB7IGNvbmZpcm1lZDogcmVzcG9uc2UgPT09IDAsIGNoZWNrYm94Q2hlY2tlZCB9O1xuXHR9XG5cblx0aW5wdXQoKTogbmV2ZXIge1xuXHRcdHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQnKTsgLy8gd2UgaGF2ZSBubyBuYXRpdmUgQVBJIGZvciBwYXNzd29yZCBkaWFsb2dzIGluIEVsZWN0cm9uXG5cdH1cblxuXHRhc3luYyBhYm91dCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRsZXQgdmVyc2lvbiA9IHRoaXMucHJvZHVjdFNlcnZpY2UudmVyc2lvbjtcblx0XHRpZiAodGhpcy5wcm9kdWN0U2VydmljZS50YXJnZXQpIHtcblx0XHRcdHZlcnNpb24gPSBgJHt2ZXJzaW9ufSAoJHt0aGlzLnByb2R1Y3RTZXJ2aWNlLnRhcmdldH0gc2V0dXApYDtcblx0XHR9IGVsc2UgaWYgKHRoaXMucHJvZHVjdFNlcnZpY2UuZGFyd2luVW5pdmVyc2FsQXNzZXRJZCkge1xuXHRcdFx0dmVyc2lvbiA9IGAke3ZlcnNpb259IChVbml2ZXJzYWwpYDtcblx0XHR9XG5cblx0XHRjb25zdCBvc1Byb3BzID0gYXdhaXQgdGhpcy5uYXRpdmVIb3N0U2VydmljZS5nZXRPU1Byb3BlcnRpZXMoKTtcblxuXHRcdGNvbnN0IGRldGFpbFN0cmluZyA9ICh1c2VBZ286IGJvb2xlYW4pOiBzdHJpbmcgPT4ge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKHsga2V5OiAnYWJvdXREZXRhaWwnLCBjb21tZW50OiBbJ0VsZWN0cm9uLCBDaHJvbWl1bSwgTm9kZS5qcyBhbmQgVjggYXJlIHByb2R1Y3QgbmFtZXMgdGhhdCBuZWVkIG5vIHRyYW5zbGF0aW9uJ10gfSxcblx0XHRcdFx0XCJWU0NvZGUgVmVyc2lvbjogezB9XFxuVm9pZCBWZXJzaW9uOiB7MX1cXG5Db21taXQ6IHsyfVxcbkRhdGU6IHszfVxcbkVsZWN0cm9uOiB7NH1cXG5FbGVjdHJvbkJ1aWxkSWQ6IHs1fVxcbkNocm9taXVtOiB7Nn1cXG5Ob2RlLmpzOiB7N31cXG5WODogezh9XFxuT1M6IHs5fVwiLFxuXHRcdFx0XHR2ZXJzaW9uLFxuXHRcdFx0XHR0aGlzLnByb2R1Y3RTZXJ2aWNlLnZvaWRWZXJzaW9uIHx8ICdVbmtub3duJywgLy8gVm9pZCBhZGRlZCB0aGlzXG5cdFx0XHRcdHRoaXMucHJvZHVjdFNlcnZpY2UuY29tbWl0IHx8ICdVbmtub3duJyxcblx0XHRcdFx0dGhpcy5wcm9kdWN0U2VydmljZS5kYXRlID8gYCR7dGhpcy5wcm9kdWN0U2VydmljZS5kYXRlfSR7dXNlQWdvID8gJyAoJyArIGZyb21Ob3cobmV3IERhdGUodGhpcy5wcm9kdWN0U2VydmljZS5kYXRlKSwgdHJ1ZSkgKyAnKScgOiAnJ31gIDogJ1Vua25vd24nLFxuXHRcdFx0XHRwcm9jZXNzLnZlcnNpb25zWydlbGVjdHJvbiddLFxuXHRcdFx0XHRwcm9jZXNzLnZlcnNpb25zWydtaWNyb3NvZnQtYnVpbGQnXSxcblx0XHRcdFx0cHJvY2Vzcy52ZXJzaW9uc1snY2hyb21lJ10sXG5cdFx0XHRcdHByb2Nlc3MudmVyc2lvbnNbJ25vZGUnXSxcblx0XHRcdFx0cHJvY2Vzcy52ZXJzaW9uc1sndjgnXSxcblx0XHRcdFx0YCR7b3NQcm9wcy50eXBlfSAke29zUHJvcHMuYXJjaH0gJHtvc1Byb3BzLnJlbGVhc2V9JHtpc0xpbnV4U25hcCA/ICcgc25hcCcgOiAnJ31gXG5cdFx0XHQpO1xuXHRcdH07XG5cblx0XHRjb25zdCBkZXRhaWwgPSBkZXRhaWxTdHJpbmcodHJ1ZSk7XG5cdFx0Y29uc3QgZGV0YWlsVG9Db3B5ID0gZGV0YWlsU3RyaW5nKGZhbHNlKTtcblxuXHRcdGNvbnN0IHsgcmVzcG9uc2UgfSA9IGF3YWl0IHRoaXMubmF0aXZlSG9zdFNlcnZpY2Uuc2hvd01lc3NhZ2VCb3goe1xuXHRcdFx0dHlwZTogJ2luZm8nLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZyxcblx0XHRcdGRldGFpbDogYFxcbiR7ZGV0YWlsfWAsXG5cdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKHsga2V5OiAnY29weScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkNvcHlcIiksXG5cdFx0XHRcdGxvY2FsaXplKCdva0J1dHRvbicsIFwiT0tcIilcblx0XHRcdF0sXG5cdFx0XHR0YXJnZXRXaW5kb3dJZDogZ2V0QWN0aXZlV2luZG93KCkudnNjb2RlV2luZG93SWRcblx0XHR9KTtcblxuXHRcdGlmIChyZXNwb25zZSA9PT0gMCkge1xuXHRcdFx0dGhpcy5jbGlwYm9hcmRTZXJ2aWNlLndyaXRlVGV4dChkZXRhaWxUb0NvcHkpO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxtQkFBbUI7QUFDNUIs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
