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
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { OpenWindowSessionLogFileAction } from "../common/logsActions.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { LogsDataCleaner } from "../common/logsDataCleaner.js";
let WebLogOutputChannels = class extends Disposable {
  constructor(instantiationService) {
    super();
    this.instantiationService = instantiationService;
    this.registerWebContributions();
  }
  registerWebContributions() {
    this.instantiationService.createInstance(LogsDataCleaner);
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: OpenWindowSessionLogFileAction.ID,
          title: OpenWindowSessionLogFileAction.TITLE,
          category: Categories.Developer,
          f1: true
        });
      }
      run(servicesAccessor) {
        return servicesAccessor.get(IInstantiationService).createInstance(OpenWindowSessionLogFileAction, OpenWindowSessionLogFileAction.ID, OpenWindowSessionLogFileAction.TITLE.value).run();
      }
    }));
  }
};
WebLogOutputChannels = __decorateClass([
  __decorateParam(0, IInstantiationService)
], WebLogOutputChannels);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(WebLogOutputChannels, LifecyclePhase.Restored);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9sb2dzL2Jyb3dzZXIvbG9ncy5jb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgT3BlbldpbmRvd1Nlc3Npb25Mb2dGaWxlQWN0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2xvZ3NBY3Rpb25zLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24sIElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTGlmZWN5Y2xlUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IExvZ3NEYXRhQ2xlYW5lciB9IGZyb20gJy4uL2NvbW1vbi9sb2dzRGF0YUNsZWFuZXIuanMnO1xuXG5jbGFzcyBXZWJMb2dPdXRwdXRDaGFubmVscyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnJlZ2lzdGVyV2ViQ29udHJpYnV0aW9ucygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlcldlYkNvbnRyaWJ1dGlvbnMoKTogdm9pZCB7XG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShMb2dzRGF0YUNsZWFuZXIpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBPcGVuV2luZG93U2Vzc2lvbkxvZ0ZpbGVBY3Rpb24uSUQsXG5cdFx0XHRcdFx0dGl0bGU6IE9wZW5XaW5kb3dTZXNzaW9uTG9nRmlsZUFjdGlvbi5USVRMRSxcblx0XHRcdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdFx0XHRcdFx0ZjE6IHRydWVcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRydW4oc2VydmljZXNBY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRyZXR1cm4gc2VydmljZXNBY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKS5jcmVhdGVJbnN0YW5jZShPcGVuV2luZG93U2Vzc2lvbkxvZ0ZpbGVBY3Rpb24sIE9wZW5XaW5kb3dTZXNzaW9uTG9nRmlsZUFjdGlvbi5JRCwgT3BlbldpbmRvd1Nlc3Npb25Mb2dGaWxlQWN0aW9uLlRJVExFLnZhbHVlKS5ydW4oKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0fVxuXG59XG5cblJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuV29ya2JlbmNoKS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihXZWJMb2dPdXRwdXRDaGFubmVscywgTGlmZWN5Y2xlUGhhc2UuUmVzdG9yZWQpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLFNBQVMsdUJBQXVCO0FBQ3pDLFNBQVMsc0NBQXNDO0FBQy9DLFNBQWtFLGNBQWMsMkJBQTJCO0FBQzNHLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsNkJBQStDO0FBQ3hELFNBQVMsdUJBQXVCO0FBRWhDLElBQU0sdUJBQU4sY0FBbUMsV0FBNkM7QUFBQSxFQUUvRSxZQUN5QyxzQkFDdkM7QUFDRCxVQUFNO0FBRmtDO0FBR3hDLFNBQUsseUJBQXlCO0FBQUEsRUFDL0I7QUFBQSxFQUVRLDJCQUFpQztBQUN4QyxTQUFLLHFCQUFxQixlQUFlLGVBQWU7QUFFeEQsU0FBSyxVQUFVLGdCQUFnQixjQUFjLFFBQVE7QUFBQSxNQUNwRCxjQUFjO0FBQ2IsY0FBTTtBQUFBLFVBQ0wsSUFBSSwrQkFBK0I7QUFBQSxVQUNuQyxPQUFPLCtCQUErQjtBQUFBLFVBQ3RDLFVBQVUsV0FBVztBQUFBLFVBQ3JCLElBQUk7QUFBQSxRQUNMLENBQUM7QUFBQSxNQUNGO0FBQUEsTUFDQSxJQUFJLGtCQUFtRDtBQUN0RCxlQUFPLGlCQUFpQixJQUFJLHFCQUFxQixFQUFFLGVBQWUsZ0NBQWdDLCtCQUErQixJQUFJLCtCQUErQixNQUFNLEtBQUssRUFBRSxJQUFJO0FBQUEsTUFDdEw7QUFBQSxJQUNELENBQUMsQ0FBQztBQUFBLEVBRUg7QUFFRDtBQTVCTSx1QkFBTjtBQUFBLEVBR0c7QUFBQSxHQUhHO0FBOEJOLFNBQVMsR0FBb0Msb0JBQW9CLFNBQVMsRUFBRSw4QkFBOEIsc0JBQXNCLGVBQWUsUUFBUTsiLAogICJuYW1lcyI6IFtdCn0K
