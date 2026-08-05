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
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { BrowserDialogHandler } from "./dialogHandler.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
let DialogHandlerContribution = class extends Disposable {
  constructor(dialogService, logService, layoutService, keybindingService, instantiationService, productService, clipboardService, openerService) {
    super();
    this.dialogService = dialogService;
    this.impl = new Lazy(() => new BrowserDialogHandler(logService, layoutService, keybindingService, instantiationService, productService, clipboardService, openerService));
    this.model = this.dialogService.model;
    this._register(this.model.onWillShowDialog(() => {
      if (!this.currentDialog) {
        this.processDialogs();
      }
    }));
    this.processDialogs();
  }
  async processDialogs() {
    while (this.model.dialogs.length) {
      this.currentDialog = this.model.dialogs[0];
      let result = void 0;
      try {
        if (this.currentDialog.args.confirmArgs) {
          const args = this.currentDialog.args.confirmArgs;
          result = await this.impl.value.confirm(args.confirmation);
        } else if (this.currentDialog.args.inputArgs) {
          const args = this.currentDialog.args.inputArgs;
          result = await this.impl.value.input(args.input);
        } else if (this.currentDialog.args.promptArgs) {
          const args = this.currentDialog.args.promptArgs;
          result = await this.impl.value.prompt(args.prompt);
        } else {
          await this.impl.value.about();
        }
      } catch (error) {
        result = error;
      }
      this.currentDialog.close(result);
      this.currentDialog = void 0;
    }
  }
};
DialogHandlerContribution.ID = "workbench.contrib.dialogHandler";
DialogHandlerContribution = __decorateClass([
  __decorateParam(0, IDialogService),
  __decorateParam(1, ILogService),
  __decorateParam(2, ILayoutService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IProductService),
  __decorateParam(6, IClipboardService),
  __decorateParam(7, IOpenerService)
], DialogHandlerContribution);
registerWorkbenchContribution2(
  DialogHandlerContribution.ID,
  DialogHandlerContribution,
  WorkbenchPhase.BlockStartup
  // Block to allow for dialogs to show before restore finished
);
export {
  DialogHandlerContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9kaWFsb2dzL2RpYWxvZy53ZWIuY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSUNsaXBib2FyZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jbGlwYm9hcmQvY29tbW9uL2NsaXBib2FyZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSURpYWxvZ0hhbmRsZXIsIElEaWFsb2dSZXN1bHQsIElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElMYXlvdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24sIFdvcmtiZW5jaFBoYXNlLCByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nc01vZGVsLCBJRGlhbG9nVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBCcm93c2VyRGlhbG9nSGFuZGxlciB9IGZyb20gJy4vZGlhbG9nSGFuZGxlci5qcyc7XG5pbXBvcnQgeyBEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZGlhbG9ncy9jb21tb24vZGlhbG9nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgTGF6eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhenkuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5cbmV4cG9ydCBjbGFzcyBEaWFsb2dIYW5kbGVyQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5kaWFsb2dIYW5kbGVyJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IG1vZGVsOiBJRGlhbG9nc01vZGVsO1xuXHRwcml2YXRlIHJlYWRvbmx5IGltcGw6IExhenk8SURpYWxvZ0hhbmRsZXI+O1xuXG5cdHByaXZhdGUgY3VycmVudERpYWxvZzogSURpYWxvZ1ZpZXdJdGVtIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUxheW91dFNlcnZpY2UgbGF5b3V0U2VydmljZTogSUxheW91dFNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElDbGlwYm9hcmRTZXJ2aWNlIGNsaXBib2FyZFNlcnZpY2U6IElDbGlwYm9hcmRTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5pbXBsID0gbmV3IExhenkoKCkgPT4gbmV3IEJyb3dzZXJEaWFsb2dIYW5kbGVyKGxvZ1NlcnZpY2UsIGxheW91dFNlcnZpY2UsIGtleWJpbmRpbmdTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgcHJvZHVjdFNlcnZpY2UsIGNsaXBib2FyZFNlcnZpY2UsIG9wZW5lclNlcnZpY2UpKTtcblxuXHRcdHRoaXMubW9kZWwgPSAodGhpcy5kaWFsb2dTZXJ2aWNlIGFzIERpYWxvZ1NlcnZpY2UpLm1vZGVsO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5tb2RlbC5vbldpbGxTaG93RGlhbG9nKCgpID0+IHtcblx0XHRcdGlmICghdGhpcy5jdXJyZW50RGlhbG9nKSB7XG5cdFx0XHRcdHRoaXMucHJvY2Vzc0RpYWxvZ3MoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLnByb2Nlc3NEaWFsb2dzKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHByb2Nlc3NEaWFsb2dzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHdoaWxlICh0aGlzLm1vZGVsLmRpYWxvZ3MubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmN1cnJlbnREaWFsb2cgPSB0aGlzLm1vZGVsLmRpYWxvZ3NbMF07XG5cblx0XHRcdGxldCByZXN1bHQ6IElEaWFsb2dSZXN1bHQgfCBFcnJvciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGlmICh0aGlzLmN1cnJlbnREaWFsb2cuYXJncy5jb25maXJtQXJncykge1xuXHRcdFx0XHRcdGNvbnN0IGFyZ3MgPSB0aGlzLmN1cnJlbnREaWFsb2cuYXJncy5jb25maXJtQXJncztcblx0XHRcdFx0XHRyZXN1bHQgPSBhd2FpdCB0aGlzLmltcGwudmFsdWUuY29uZmlybShhcmdzLmNvbmZpcm1hdGlvbik7XG5cdFx0XHRcdH0gZWxzZSBpZiAodGhpcy5jdXJyZW50RGlhbG9nLmFyZ3MuaW5wdXRBcmdzKSB7XG5cdFx0XHRcdFx0Y29uc3QgYXJncyA9IHRoaXMuY3VycmVudERpYWxvZy5hcmdzLmlucHV0QXJncztcblx0XHRcdFx0XHRyZXN1bHQgPSBhd2FpdCB0aGlzLmltcGwudmFsdWUuaW5wdXQoYXJncy5pbnB1dCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAodGhpcy5jdXJyZW50RGlhbG9nLmFyZ3MucHJvbXB0QXJncykge1xuXHRcdFx0XHRcdGNvbnN0IGFyZ3MgPSB0aGlzLmN1cnJlbnREaWFsb2cuYXJncy5wcm9tcHRBcmdzO1xuXHRcdFx0XHRcdHJlc3VsdCA9IGF3YWl0IHRoaXMuaW1wbC52YWx1ZS5wcm9tcHQoYXJncy5wcm9tcHQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuaW1wbC52YWx1ZS5hYm91dCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRyZXN1bHQgPSBlcnJvcjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5jdXJyZW50RGlhbG9nLmNsb3NlKHJlc3VsdCk7XG5cdFx0XHR0aGlzLmN1cnJlbnREaWFsb2cgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG59XG5cbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihcblx0RGlhbG9nSGFuZGxlckNvbnRyaWJ1dGlvbi5JRCxcblx0RGlhbG9nSGFuZGxlckNvbnRyaWJ1dGlvbixcblx0V29ya2JlbmNoUGhhc2UuQmxvY2tTdGFydHVwIC8vIEJsb2NrIHRvIGFsbG93IGZvciBkaWFsb2dzIHRvIHNob3cgYmVmb3JlIHJlc3RvcmUgZmluaXNoZWRcbik7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMseUJBQXlCO0FBQ2xDLFNBQXdDLHNCQUFzQjtBQUM5RCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFpQyxnQkFBZ0Isc0NBQXNDO0FBRXZGLFNBQVMsNEJBQTRCO0FBRXJDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsWUFBWTtBQUNyQixTQUFTLHNCQUFzQjtBQUV4QixJQUFNLDRCQUFOLGNBQXdDLFdBQTZDO0FBQUEsRUFTM0YsWUFDeUIsZUFDWCxZQUNHLGVBQ0ksbUJBQ0csc0JBQ04sZ0JBQ0Usa0JBQ0gsZUFDZjtBQUNELFVBQU07QUFUa0I7QUFXeEIsU0FBSyxPQUFPLElBQUksS0FBSyxNQUFNLElBQUkscUJBQXFCLFlBQVksZUFBZSxtQkFBbUIsc0JBQXNCLGdCQUFnQixrQkFBa0IsYUFBYSxDQUFDO0FBRXhLLFNBQUssUUFBUyxLQUFLLGNBQWdDO0FBRW5ELFNBQUssVUFBVSxLQUFLLE1BQU0saUJBQWlCLE1BQU07QUFDaEQsVUFBSSxDQUFDLEtBQUssZUFBZTtBQUN4QixhQUFLLGVBQWU7QUFBQSxNQUNyQjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsU0FBSyxlQUFlO0FBQUEsRUFDckI7QUFBQSxFQUVBLE1BQWMsaUJBQWdDO0FBQzdDLFdBQU8sS0FBSyxNQUFNLFFBQVEsUUFBUTtBQUNqQyxXQUFLLGdCQUFnQixLQUFLLE1BQU0sUUFBUSxDQUFDO0FBRXpDLFVBQUksU0FBNEM7QUFDaEQsVUFBSTtBQUNILFlBQUksS0FBSyxjQUFjLEtBQUssYUFBYTtBQUN4QyxnQkFBTSxPQUFPLEtBQUssY0FBYyxLQUFLO0FBQ3JDLG1CQUFTLE1BQU0sS0FBSyxLQUFLLE1BQU0sUUFBUSxLQUFLLFlBQVk7QUFBQSxRQUN6RCxXQUFXLEtBQUssY0FBYyxLQUFLLFdBQVc7QUFDN0MsZ0JBQU0sT0FBTyxLQUFLLGNBQWMsS0FBSztBQUNyQyxtQkFBUyxNQUFNLEtBQUssS0FBSyxNQUFNLE1BQU0sS0FBSyxLQUFLO0FBQUEsUUFDaEQsV0FBVyxLQUFLLGNBQWMsS0FBSyxZQUFZO0FBQzlDLGdCQUFNLE9BQU8sS0FBSyxjQUFjLEtBQUs7QUFDckMsbUJBQVMsTUFBTSxLQUFLLEtBQUssTUFBTSxPQUFPLEtBQUssTUFBTTtBQUFBLFFBQ2xELE9BQU87QUFDTixnQkFBTSxLQUFLLEtBQUssTUFBTSxNQUFNO0FBQUEsUUFDN0I7QUFBQSxNQUNELFNBQVMsT0FBTztBQUNmLGlCQUFTO0FBQUEsTUFDVjtBQUVBLFdBQUssY0FBYyxNQUFNLE1BQU07QUFDL0IsV0FBSyxnQkFBZ0I7QUFBQSxJQUN0QjtBQUFBLEVBQ0Q7QUFDRDtBQTVEYSwwQkFFSSxLQUFLO0FBRlQsNEJBQU47QUFBQSxFQVVKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBakJVO0FBOERiO0FBQUEsRUFDQywwQkFBMEI7QUFBQSxFQUMxQjtBQUFBLEVBQ0EsZUFBZTtBQUFBO0FBQ2hCOyIsCiAgIm5hbWVzIjogW10KfQo=
