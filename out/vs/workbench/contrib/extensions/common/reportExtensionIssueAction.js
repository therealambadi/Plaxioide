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
import { Action } from "../../../../base/common/actions.js";
import { IWorkbenchIssueService } from "../../issue/common/issue.js";
let ReportExtensionIssueAction = class extends Action {
  // TODO: Consider passing in IExtensionStatus or IExtensionHostProfile for additional data
  constructor(extension, issueService) {
    super(ReportExtensionIssueAction._id, ReportExtensionIssueAction._label, "extension-action report-issue");
    this.extension = extension;
    this.issueService = issueService;
    this.enabled = extension.isBuiltin || !!extension.repository && !!extension.repository.url;
  }
  async run() {
    await this.issueService.openReporter({
      extensionId: this.extension.identifier.value
    });
  }
};
ReportExtensionIssueAction._id = "workbench.extensions.action.reportExtensionIssue";
ReportExtensionIssueAction._label = nls.localize("reportExtensionIssue", "Report Issue");
ReportExtensionIssueAction = __decorateClass([
  __decorateParam(1, IWorkbenchIssueService)
], ReportExtensionIssueAction);
export {
  ReportExtensionIssueAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2NvbW1vbi9yZXBvcnRFeHRlbnNpb25Jc3N1ZUFjdGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hJc3N1ZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9pc3N1ZS9jb21tb24vaXNzdWUuanMnO1xuXG5leHBvcnQgY2xhc3MgUmVwb3J0RXh0ZW5zaW9uSXNzdWVBY3Rpb24gZXh0ZW5kcyBBY3Rpb24ge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9pZCA9ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24ucmVwb3J0RXh0ZW5zaW9uSXNzdWUnO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBfbGFiZWwgPSBubHMubG9jYWxpemUoJ3JlcG9ydEV4dGVuc2lvbklzc3VlJywgXCJSZXBvcnQgSXNzdWVcIik7XG5cblx0Ly8gVE9ETzogQ29uc2lkZXIgcGFzc2luZyBpbiBJRXh0ZW5zaW9uU3RhdHVzIG9yIElFeHRlbnNpb25Ib3N0UHJvZmlsZSBmb3IgYWRkaXRpb25hbCBkYXRhXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sXG5cdFx0QElXb3JrYmVuY2hJc3N1ZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpc3N1ZVNlcnZpY2U6IElXb3JrYmVuY2hJc3N1ZVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoUmVwb3J0RXh0ZW5zaW9uSXNzdWVBY3Rpb24uX2lkLCBSZXBvcnRFeHRlbnNpb25Jc3N1ZUFjdGlvbi5fbGFiZWwsICdleHRlbnNpb24tYWN0aW9uIHJlcG9ydC1pc3N1ZScpO1xuXG5cdFx0dGhpcy5lbmFibGVkID0gZXh0ZW5zaW9uLmlzQnVpbHRpbiB8fCAoISFleHRlbnNpb24ucmVwb3NpdG9yeSAmJiAhIWV4dGVuc2lvbi5yZXBvc2l0b3J5LnVybCk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5pc3N1ZVNlcnZpY2Uub3BlblJlcG9ydGVyKHtcblx0XHRcdGV4dGVuc2lvbklkOiB0aGlzLmV4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlLFxuXHRcdH0pO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLGNBQWM7QUFFdkIsU0FBUyw4QkFBOEI7QUFFaEMsSUFBTSw2QkFBTixjQUF5QyxPQUFPO0FBQUE7QUFBQSxFQU10RCxZQUNTLFdBQ2lDLGNBQ3hDO0FBQ0QsVUFBTSwyQkFBMkIsS0FBSywyQkFBMkIsUUFBUSwrQkFBK0I7QUFIaEc7QUFDaUM7QUFJekMsU0FBSyxVQUFVLFVBQVUsYUFBYyxDQUFDLENBQUMsVUFBVSxjQUFjLENBQUMsQ0FBQyxVQUFVLFdBQVc7QUFBQSxFQUN6RjtBQUFBLEVBRUEsTUFBZSxNQUFxQjtBQUNuQyxVQUFNLEtBQUssYUFBYSxhQUFhO0FBQUEsTUFDcEMsYUFBYSxLQUFLLFVBQVUsV0FBVztBQUFBLElBQ3hDLENBQUM7QUFBQSxFQUNGO0FBQ0Q7QUFwQmEsMkJBRVksTUFBTTtBQUZsQiwyQkFHWSxTQUFTLElBQUksU0FBUyx3QkFBd0IsY0FBYztBQUh4RSw2QkFBTjtBQUFBLEVBUUo7QUFBQSxHQVJVOyIsCiAgIm5hbWVzIjogW10KfQo=
