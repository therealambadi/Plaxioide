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
import { Event } from "../../../../base/common/event.js";
import { dispose } from "../../../../base/common/lifecycle.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IDebugService, VIEWLET_ID } from "../common/debug.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
let DebugProgressContribution = class {
  constructor(debugService, progressService, viewsService) {
    this.toDispose = [];
    let progressListener;
    const listenOnProgress = (session) => {
      if (progressListener) {
        progressListener.dispose();
        progressListener = void 0;
      }
      if (session) {
        progressListener = session.onDidProgressStart(async (progressStartEvent) => {
          const promise = new Promise((r) => {
            const listener = Event.any(
              Event.filter(session.onDidProgressEnd, (e) => e.body.progressId === progressStartEvent.body.progressId),
              session.onDidEndAdapter
            )(() => {
              listener.dispose();
              r();
            });
          });
          if (viewsService.isViewContainerVisible(VIEWLET_ID)) {
            progressService.withProgress({ location: VIEWLET_ID }, () => promise);
          }
          const source = debugService.getAdapterManager().getDebuggerLabel(session.configuration.type);
          progressService.withProgress({
            location: ProgressLocation.Notification,
            title: progressStartEvent.body.title,
            cancellable: progressStartEvent.body.cancellable,
            source,
            delay: 500
          }, (progressStep) => {
            let total = 0;
            const reportProgress = (progress) => {
              let increment = void 0;
              if (typeof progress.percentage === "number") {
                increment = progress.percentage - total;
                total += increment;
              }
              progressStep.report({
                message: progress.message,
                increment,
                total: typeof increment === "number" ? 100 : void 0
              });
            };
            if (progressStartEvent.body.message) {
              reportProgress(progressStartEvent.body);
            }
            const progressUpdateListener = session.onDidProgressUpdate((e) => {
              if (e.body.progressId === progressStartEvent.body.progressId) {
                reportProgress(e.body);
              }
            });
            return promise.then(() => progressUpdateListener.dispose());
          }, () => session.cancel(progressStartEvent.body.progressId));
        });
      }
    };
    this.toDispose.push(debugService.getViewModel().onDidFocusSession(listenOnProgress));
    listenOnProgress(debugService.getViewModel().focusedSession);
    this.toDispose.push(debugService.onWillNewSession((session) => {
      if (!progressListener) {
        listenOnProgress(session);
      }
    }));
  }
  dispose() {
    dispose(this.toDispose);
  }
};
DebugProgressContribution = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, IProgressService),
  __decorateParam(2, IViewsService)
], DebugProgressContribution);
export {
  DebugProgressContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnUHJvZ3Jlc3MudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCBkaXNwb3NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElQcm9ncmVzc1NlcnZpY2UsIFByb2dyZXNzTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElEZWJ1Z1NlcnZpY2UsIElEZWJ1Z1Nlc3Npb24sIFZJRVdMRVRfSUQgfSBmcm9tICcuLi9jb21tb24vZGVidWcuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuXG5leHBvcnQgY2xhc3MgRGVidWdQcm9ncmVzc0NvbnRyaWJ1dGlvbiBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHByaXZhdGUgdG9EaXNwb3NlOiBJRGlzcG9zYWJsZVtdID0gW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElEZWJ1Z1NlcnZpY2UgZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHByb2dyZXNzU2VydmljZTogSVByb2dyZXNzU2VydmljZSxcblx0XHRASVZpZXdzU2VydmljZSB2aWV3c1NlcnZpY2U6IElWaWV3c1NlcnZpY2Vcblx0KSB7XG5cdFx0bGV0IHByb2dyZXNzTGlzdGVuZXI6IElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGxpc3Rlbk9uUHJvZ3Jlc3MgPSAoc2Vzc2lvbjogSURlYnVnU2Vzc2lvbiB8IHVuZGVmaW5lZCkgPT4ge1xuXHRcdFx0aWYgKHByb2dyZXNzTGlzdGVuZXIpIHtcblx0XHRcdFx0cHJvZ3Jlc3NMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHRcdHByb2dyZXNzTGlzdGVuZXIgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0XHRwcm9ncmVzc0xpc3RlbmVyID0gc2Vzc2lvbi5vbkRpZFByb2dyZXNzU3RhcnQoYXN5bmMgcHJvZ3Jlc3NTdGFydEV2ZW50ID0+IHtcblx0XHRcdFx0XHRjb25zdCBwcm9taXNlID0gbmV3IFByb21pc2U8dm9pZD4ociA9PiB7XG5cdFx0XHRcdFx0XHQvLyBTaG93IHByb2dyZXNzIHVudGlsIGEgcHJvZ3Jlc3MgZW5kIGV2ZW50IGNvbWVzIG9yIHRoZSBzZXNzaW9uIGVuZHNcblx0XHRcdFx0XHRcdGNvbnN0IGxpc3RlbmVyID0gRXZlbnQuYW55KEV2ZW50LmZpbHRlcihzZXNzaW9uLm9uRGlkUHJvZ3Jlc3NFbmQsIGUgPT4gZS5ib2R5LnByb2dyZXNzSWQgPT09IHByb2dyZXNzU3RhcnRFdmVudC5ib2R5LnByb2dyZXNzSWQpLFxuXHRcdFx0XHRcdFx0XHRzZXNzaW9uLm9uRGlkRW5kQWRhcHRlcikoKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdFx0XHRyKCk7XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0aWYgKHZpZXdzU2VydmljZS5pc1ZpZXdDb250YWluZXJWaXNpYmxlKFZJRVdMRVRfSUQpKSB7XG5cdFx0XHRcdFx0XHRwcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHsgbG9jYXRpb246IFZJRVdMRVRfSUQgfSwgKCkgPT4gcHJvbWlzZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHNvdXJjZSA9IGRlYnVnU2VydmljZS5nZXRBZGFwdGVyTWFuYWdlcigpLmdldERlYnVnZ2VyTGFiZWwoc2Vzc2lvbi5jb25maWd1cmF0aW9uLnR5cGUpO1xuXHRcdFx0XHRcdHByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3Moe1xuXHRcdFx0XHRcdFx0bG9jYXRpb246IFByb2dyZXNzTG9jYXRpb24uTm90aWZpY2F0aW9uLFxuXHRcdFx0XHRcdFx0dGl0bGU6IHByb2dyZXNzU3RhcnRFdmVudC5ib2R5LnRpdGxlLFxuXHRcdFx0XHRcdFx0Y2FuY2VsbGFibGU6IHByb2dyZXNzU3RhcnRFdmVudC5ib2R5LmNhbmNlbGxhYmxlLFxuXHRcdFx0XHRcdFx0c291cmNlLFxuXHRcdFx0XHRcdFx0ZGVsYXk6IDUwMFxuXHRcdFx0XHRcdH0sIHByb2dyZXNzU3RlcCA9PiB7XG5cdFx0XHRcdFx0XHRsZXQgdG90YWwgPSAwO1xuXHRcdFx0XHRcdFx0Y29uc3QgcmVwb3J0UHJvZ3Jlc3MgPSAocHJvZ3Jlc3M6IHsgbWVzc2FnZT86IHN0cmluZzsgcGVyY2VudGFnZT86IG51bWJlciB9KSA9PiB7XG5cdFx0XHRcdFx0XHRcdGxldCBpbmNyZW1lbnQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRcdGlmICh0eXBlb2YgcHJvZ3Jlc3MucGVyY2VudGFnZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRcdFx0XHRpbmNyZW1lbnQgPSBwcm9ncmVzcy5wZXJjZW50YWdlIC0gdG90YWw7XG5cdFx0XHRcdFx0XHRcdFx0dG90YWwgKz0gaW5jcmVtZW50O1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHByb2dyZXNzU3RlcC5yZXBvcnQoe1xuXHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2U6IHByb2dyZXNzLm1lc3NhZ2UsXG5cdFx0XHRcdFx0XHRcdFx0aW5jcmVtZW50LFxuXHRcdFx0XHRcdFx0XHRcdHRvdGFsOiB0eXBlb2YgaW5jcmVtZW50ID09PSAnbnVtYmVyJyA/IDEwMCA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0XHRpZiAocHJvZ3Jlc3NTdGFydEV2ZW50LmJvZHkubWVzc2FnZSkge1xuXHRcdFx0XHRcdFx0XHRyZXBvcnRQcm9ncmVzcyhwcm9ncmVzc1N0YXJ0RXZlbnQuYm9keSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjb25zdCBwcm9ncmVzc1VwZGF0ZUxpc3RlbmVyID0gc2Vzc2lvbi5vbkRpZFByb2dyZXNzVXBkYXRlKGUgPT4ge1xuXHRcdFx0XHRcdFx0XHRpZiAoZS5ib2R5LnByb2dyZXNzSWQgPT09IHByb2dyZXNzU3RhcnRFdmVudC5ib2R5LnByb2dyZXNzSWQpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXBvcnRQcm9ncmVzcyhlLmJvZHkpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0cmV0dXJuIHByb21pc2UudGhlbigoKSA9PiBwcm9ncmVzc1VwZGF0ZUxpc3RlbmVyLmRpc3Bvc2UoKSk7XG5cdFx0XHRcdFx0fSwgKCkgPT4gc2Vzc2lvbi5jYW5jZWwocHJvZ3Jlc3NTdGFydEV2ZW50LmJvZHkucHJvZ3Jlc3NJZCkpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2goZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLm9uRGlkRm9jdXNTZXNzaW9uKGxpc3Rlbk9uUHJvZ3Jlc3MpKTtcblx0XHRsaXN0ZW5PblByb2dyZXNzKGRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbik7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaChkZWJ1Z1NlcnZpY2Uub25XaWxsTmV3U2Vzc2lvbihzZXNzaW9uID0+IHtcblx0XHRcdGlmICghcHJvZ3Jlc3NMaXN0ZW5lcikge1xuXHRcdFx0XHRsaXN0ZW5PblByb2dyZXNzKHNlc3Npb24pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0ZGlzcG9zZSh0aGlzLnRvRGlzcG9zZSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxhQUFhO0FBQ3RCLFNBQXNCLGVBQWU7QUFDckMsU0FBUyxrQkFBa0Isd0JBQXdCO0FBRW5ELFNBQVMsZUFBOEIsa0JBQWtCO0FBQ3pELFNBQVMscUJBQXFCO0FBRXZCLElBQU0sNEJBQU4sTUFBa0U7QUFBQSxFQUl4RSxZQUNnQixjQUNHLGlCQUNILGNBQ2Q7QUFORixTQUFRLFlBQTJCLENBQUM7QUFPbkMsUUFBSTtBQUNKLFVBQU0sbUJBQW1CLENBQUMsWUFBdUM7QUFDaEUsVUFBSSxrQkFBa0I7QUFDckIseUJBQWlCLFFBQVE7QUFDekIsMkJBQW1CO0FBQUEsTUFDcEI7QUFDQSxVQUFJLFNBQVM7QUFDWiwyQkFBbUIsUUFBUSxtQkFBbUIsT0FBTSx1QkFBc0I7QUFDekUsZ0JBQU0sVUFBVSxJQUFJLFFBQWMsT0FBSztBQUV0QyxrQkFBTSxXQUFXLE1BQU07QUFBQSxjQUFJLE1BQU0sT0FBTyxRQUFRLGtCQUFrQixPQUFLLEVBQUUsS0FBSyxlQUFlLG1CQUFtQixLQUFLLFVBQVU7QUFBQSxjQUM5SCxRQUFRO0FBQUEsWUFBZSxFQUFFLE1BQU07QUFDOUIsdUJBQVMsUUFBUTtBQUNqQixnQkFBRTtBQUFBLFlBQ0gsQ0FBQztBQUFBLFVBQ0gsQ0FBQztBQUVELGNBQUksYUFBYSx1QkFBdUIsVUFBVSxHQUFHO0FBQ3BELDRCQUFnQixhQUFhLEVBQUUsVUFBVSxXQUFXLEdBQUcsTUFBTSxPQUFPO0FBQUEsVUFDckU7QUFDQSxnQkFBTSxTQUFTLGFBQWEsa0JBQWtCLEVBQUUsaUJBQWlCLFFBQVEsY0FBYyxJQUFJO0FBQzNGLDBCQUFnQixhQUFhO0FBQUEsWUFDNUIsVUFBVSxpQkFBaUI7QUFBQSxZQUMzQixPQUFPLG1CQUFtQixLQUFLO0FBQUEsWUFDL0IsYUFBYSxtQkFBbUIsS0FBSztBQUFBLFlBQ3JDO0FBQUEsWUFDQSxPQUFPO0FBQUEsVUFDUixHQUFHLGtCQUFnQjtBQUNsQixnQkFBSSxRQUFRO0FBQ1osa0JBQU0saUJBQWlCLENBQUMsYUFBd0Q7QUFDL0Usa0JBQUksWUFBWTtBQUNoQixrQkFBSSxPQUFPLFNBQVMsZUFBZSxVQUFVO0FBQzVDLDRCQUFZLFNBQVMsYUFBYTtBQUNsQyx5QkFBUztBQUFBLGNBQ1Y7QUFDQSwyQkFBYSxPQUFPO0FBQUEsZ0JBQ25CLFNBQVMsU0FBUztBQUFBLGdCQUNsQjtBQUFBLGdCQUNBLE9BQU8sT0FBTyxjQUFjLFdBQVcsTUFBTTtBQUFBLGNBQzlDLENBQUM7QUFBQSxZQUNGO0FBRUEsZ0JBQUksbUJBQW1CLEtBQUssU0FBUztBQUNwQyw2QkFBZSxtQkFBbUIsSUFBSTtBQUFBLFlBQ3ZDO0FBQ0Esa0JBQU0seUJBQXlCLFFBQVEsb0JBQW9CLE9BQUs7QUFDL0Qsa0JBQUksRUFBRSxLQUFLLGVBQWUsbUJBQW1CLEtBQUssWUFBWTtBQUM3RCwrQkFBZSxFQUFFLElBQUk7QUFBQSxjQUN0QjtBQUFBLFlBQ0QsQ0FBQztBQUVELG1CQUFPLFFBQVEsS0FBSyxNQUFNLHVCQUF1QixRQUFRLENBQUM7QUFBQSxVQUMzRCxHQUFHLE1BQU0sUUFBUSxPQUFPLG1CQUFtQixLQUFLLFVBQVUsQ0FBQztBQUFBLFFBQzVELENBQUM7QUFBQSxNQUNGO0FBQUEsSUFDRDtBQUNBLFNBQUssVUFBVSxLQUFLLGFBQWEsYUFBYSxFQUFFLGtCQUFrQixnQkFBZ0IsQ0FBQztBQUNuRixxQkFBaUIsYUFBYSxhQUFhLEVBQUUsY0FBYztBQUMzRCxTQUFLLFVBQVUsS0FBSyxhQUFhLGlCQUFpQixhQUFXO0FBQzVELFVBQUksQ0FBQyxrQkFBa0I7QUFDdEIseUJBQWlCLE9BQU87QUFBQSxNQUN6QjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRUEsVUFBZ0I7QUFDZixZQUFRLEtBQUssU0FBUztBQUFBLEVBQ3ZCO0FBQ0Q7QUE3RWEsNEJBQU47QUFBQSxFQUtKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVBVOyIsCiAgIm5hbWVzIjogW10KfQo=
