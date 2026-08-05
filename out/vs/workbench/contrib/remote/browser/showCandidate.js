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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { IRemoteExplorerService } from "../../../services/remote/common/remoteExplorerService.js";
let ShowCandidateContribution = class extends Disposable {
  constructor(remoteExplorerService, environmentService) {
    super();
    const showPortCandidate = environmentService.options?.tunnelProvider?.showPortCandidate;
    if (showPortCandidate) {
      this._register(remoteExplorerService.setCandidateFilter(async (candidates) => {
        const filters = await Promise.all(candidates.map((candidate) => showPortCandidate(candidate.host, candidate.port, candidate.detail ?? "")));
        const filteredCandidates = [];
        if (filters.length !== candidates.length) {
          return candidates;
        }
        for (let i = 0; i < candidates.length; i++) {
          if (filters[i]) {
            filteredCandidates.push(candidates[i]);
          }
        }
        return filteredCandidates;
      }));
    }
  }
};
ShowCandidateContribution.ID = "workbench.contrib.showPortCandidate";
ShowCandidateContribution = __decorateClass([
  __decorateParam(0, IRemoteExplorerService),
  __decorateParam(1, IBrowserWorkbenchEnvironmentService)
], ShowCandidateContribution);
export {
  ShowCandidateContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9yZW1vdGUvYnJvd3Nlci9zaG93Q2FuZGlkYXRlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lbnZpcm9ubWVudC9icm93c2VyL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVFeHBsb3JlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2FuZGlkYXRlUG9ydCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vdHVubmVsTW9kZWwuanMnO1xuXG5leHBvcnQgY2xhc3MgU2hvd0NhbmRpZGF0ZUNvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIuc2hvd1BvcnRDYW5kaWRhdGUnO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlIHJlbW90ZUV4cGxvcmVyU2VydmljZTogSVJlbW90ZUV4cGxvcmVyU2VydmljZSxcblx0XHRASUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgZW52aXJvbm1lbnRTZXJ2aWNlOiBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRjb25zdCBzaG93UG9ydENhbmRpZGF0ZSA9IGVudmlyb25tZW50U2VydmljZS5vcHRpb25zPy50dW5uZWxQcm92aWRlcj8uc2hvd1BvcnRDYW5kaWRhdGU7XG5cdFx0aWYgKHNob3dQb3J0Q2FuZGlkYXRlKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihyZW1vdGVFeHBsb3JlclNlcnZpY2Uuc2V0Q2FuZGlkYXRlRmlsdGVyKGFzeW5jIChjYW5kaWRhdGVzOiBDYW5kaWRhdGVQb3J0W10pOiBQcm9taXNlPENhbmRpZGF0ZVBvcnRbXT4gPT4ge1xuXHRcdFx0XHRjb25zdCBmaWx0ZXJzOiBib29sZWFuW10gPSBhd2FpdCBQcm9taXNlLmFsbChjYW5kaWRhdGVzLm1hcChjYW5kaWRhdGUgPT4gc2hvd1BvcnRDYW5kaWRhdGUoY2FuZGlkYXRlLmhvc3QsIGNhbmRpZGF0ZS5wb3J0LCBjYW5kaWRhdGUuZGV0YWlsID8/ICcnKSkpO1xuXHRcdFx0XHRjb25zdCBmaWx0ZXJlZENhbmRpZGF0ZXM6IENhbmRpZGF0ZVBvcnRbXSA9IFtdO1xuXHRcdFx0XHRpZiAoZmlsdGVycy5sZW5ndGggIT09IGNhbmRpZGF0ZXMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGNhbmRpZGF0ZXM7XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjYW5kaWRhdGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0aWYgKGZpbHRlcnNbaV0pIHtcblx0XHRcdFx0XHRcdGZpbHRlcmVkQ2FuZGlkYXRlcy5wdXNoKGNhbmRpZGF0ZXNbaV0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmlsdGVyZWRDYW5kaWRhdGVzO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGtCQUFrQjtBQUUzQixTQUFTLDJDQUEyQztBQUNwRCxTQUFTLDhCQUE4QjtBQUdoQyxJQUFNLDRCQUFOLGNBQXdDLFdBQTZDO0FBQUEsRUFJM0YsWUFDeUIsdUJBQ2Esb0JBQ3BDO0FBQ0QsVUFBTTtBQUNOLFVBQU0sb0JBQW9CLG1CQUFtQixTQUFTLGdCQUFnQjtBQUN0RSxRQUFJLG1CQUFtQjtBQUN0QixXQUFLLFVBQVUsc0JBQXNCLG1CQUFtQixPQUFPLGVBQTBEO0FBQ3hILGNBQU0sVUFBcUIsTUFBTSxRQUFRLElBQUksV0FBVyxJQUFJLGVBQWEsa0JBQWtCLFVBQVUsTUFBTSxVQUFVLE1BQU0sVUFBVSxVQUFVLEVBQUUsQ0FBQyxDQUFDO0FBQ25KLGNBQU0scUJBQXNDLENBQUM7QUFDN0MsWUFBSSxRQUFRLFdBQVcsV0FBVyxRQUFRO0FBQ3pDLGlCQUFPO0FBQUEsUUFDUjtBQUNBLGlCQUFTLElBQUksR0FBRyxJQUFJLFdBQVcsUUFBUSxLQUFLO0FBQzNDLGNBQUksUUFBUSxDQUFDLEdBQUc7QUFDZiwrQkFBbUIsS0FBSyxXQUFXLENBQUMsQ0FBQztBQUFBLFVBQ3RDO0FBQUEsUUFDRDtBQUNBLGVBQU87QUFBQSxNQUNSLENBQUMsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNEO0FBQ0Q7QUExQmEsMEJBRUksS0FBSztBQUZULDRCQUFOO0FBQUEsRUFLSjtBQUFBLEVBQ0E7QUFBQSxHQU5VOyIsCiAgIm5hbWVzIjogW10KfQo=
