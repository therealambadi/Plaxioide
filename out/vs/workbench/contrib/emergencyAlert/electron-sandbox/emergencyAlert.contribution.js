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
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { IBannerService } from "../../../services/banner/browser/bannerService.js";
import { asJson, IRequestService } from "../../../../platform/request/common/request.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { arch, platform } from "../../../../base/common/process.js";
let EmergencyAlert = class {
  constructor(bannerService, requestService, productService, logService) {
    this.bannerService = bannerService;
    this.requestService = requestService;
    this.productService = productService;
    this.logService = logService;
    if (productService.quality !== "insider") {
      return;
    }
    const emergencyAlertUrl = productService.emergencyAlertUrl;
    if (!emergencyAlertUrl) {
      return;
    }
    this.fetchAlerts(emergencyAlertUrl);
  }
  async fetchAlerts(url) {
    try {
      await this.doFetchAlerts(url);
    } catch (e) {
      this.logService.error(e);
    }
  }
  async doFetchAlerts(url) {
    const requestResult = await this.requestService.request({ type: "GET", url, disableCache: true }, CancellationToken.None);
    if (requestResult.res.statusCode !== 200) {
      throw new Error(`Failed to fetch emergency alerts: HTTP ${requestResult.res.statusCode}`);
    }
    const emergencyAlerts = await asJson(requestResult);
    if (!emergencyAlerts) {
      return;
    }
    for (const emergencyAlert of emergencyAlerts.alerts) {
      if (emergencyAlert.commit !== this.productService.commit || // version mismatch
      emergencyAlert.platform && emergencyAlert.platform !== platform || // platform mismatch
      emergencyAlert.arch && emergencyAlert.arch !== arch) {
        return;
      }
      this.bannerService.show({
        id: "emergencyAlert.banner",
        icon: Codicon.warning,
        message: emergencyAlert.message,
        actions: emergencyAlert.actions
      });
      break;
    }
  }
};
EmergencyAlert.ID = "workbench.contrib.emergencyAlert";
EmergencyAlert = __decorateClass([
  __decorateParam(0, IBannerService),
  __decorateParam(1, IRequestService),
  __decorateParam(2, IProductService),
  __decorateParam(3, ILogService)
], EmergencyAlert);
registerWorkbenchContribution2("workbench.emergencyAlert", EmergencyAlert, WorkbenchPhase.Eventually);
export {
  EmergencyAlert
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9lbWVyZ2VuY3lBbGVydC9lbGVjdHJvbi1zYW5kYm94L2VtZXJnZW5jeUFsZXJ0LmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24sIHJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMiwgV29ya2JlbmNoUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQmFubmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Jhbm5lci9icm93c2VyL2Jhbm5lclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgYXNKc29uLCBJUmVxdWVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZXF1ZXN0L2NvbW1vbi9yZXF1ZXN0LmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IGFyY2gsIHBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcHJvY2Vzcy5qcyc7XG5cbmludGVyZmFjZSBJRW1lcmdlbmN5QWxlcnQge1xuXHRyZWFkb25seSBjb21taXQ6IHN0cmluZztcblx0cmVhZG9ubHkgcGxhdGZvcm0/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGFyY2g/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IG1lc3NhZ2U6IHN0cmluZztcblx0cmVhZG9ubHkgYWN0aW9ucz86IFt7XG5cdFx0cmVhZG9ubHkgbGFiZWw6IHN0cmluZztcblx0XHRyZWFkb25seSBocmVmOiBzdHJpbmc7XG5cdH1dO1xufVxuXG5pbnRlcmZhY2UgSUVtZXJnZW5jeUFsZXJ0cyB7XG5cdHJlYWRvbmx5IGFsZXJ0czogSUVtZXJnZW5jeUFsZXJ0W107XG59XG5cbmV4cG9ydCBjbGFzcyBFbWVyZ2VuY3lBbGVydCBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5lbWVyZ2VuY3lBbGVydCc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElCYW5uZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYmFubmVyU2VydmljZTogSUJhbm5lclNlcnZpY2UsXG5cdFx0QElSZXF1ZXN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHJlcXVlc3RTZXJ2aWNlOiBJUmVxdWVzdFNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0aWYgKHByb2R1Y3RTZXJ2aWNlLnF1YWxpdHkgIT09ICdpbnNpZGVyJykge1xuXHRcdFx0cmV0dXJuOyAvLyBvbmx5IGVuYWJsZWQgaW4gaW5zaWRlcnMgZm9yIG5vd1xuXHRcdH1cblxuXHRcdGNvbnN0IGVtZXJnZW5jeUFsZXJ0VXJsID0gcHJvZHVjdFNlcnZpY2UuZW1lcmdlbmN5QWxlcnRVcmw7XG5cdFx0aWYgKCFlbWVyZ2VuY3lBbGVydFVybCkge1xuXHRcdFx0cmV0dXJuOyAvLyBubyBlbWVyZ2VuY3kgYWxlcnQgY29uZmlndXJlZFxuXHRcdH1cblxuXHRcdHRoaXMuZmV0Y2hBbGVydHMoZW1lcmdlbmN5QWxlcnRVcmwpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBmZXRjaEFsZXJ0cyh1cmw6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmRvRmV0Y2hBbGVydHModXJsKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb0ZldGNoQWxlcnRzKHVybDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcmVxdWVzdFJlc3VsdCA9IGF3YWl0IHRoaXMucmVxdWVzdFNlcnZpY2UucmVxdWVzdCh7IHR5cGU6ICdHRVQnLCB1cmwsIGRpc2FibGVDYWNoZTogdHJ1ZSB9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblxuXHRcdGlmIChyZXF1ZXN0UmVzdWx0LnJlcy5zdGF0dXNDb2RlICE9PSAyMDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZldGNoIGVtZXJnZW5jeSBhbGVydHM6IEhUVFAgJHtyZXF1ZXN0UmVzdWx0LnJlcy5zdGF0dXNDb2RlfWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVtZXJnZW5jeUFsZXJ0cyA9IGF3YWl0IGFzSnNvbjxJRW1lcmdlbmN5QWxlcnRzPihyZXF1ZXN0UmVzdWx0KTtcblx0XHRpZiAoIWVtZXJnZW5jeUFsZXJ0cykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgZW1lcmdlbmN5QWxlcnQgb2YgZW1lcmdlbmN5QWxlcnRzLmFsZXJ0cykge1xuXHRcdFx0aWYgKFxuXHRcdFx0XHQoZW1lcmdlbmN5QWxlcnQuY29tbWl0ICE9PSB0aGlzLnByb2R1Y3RTZXJ2aWNlLmNvbW1pdCkgfHxcdFx0XHRcdC8vIHZlcnNpb24gbWlzbWF0Y2hcblx0XHRcdFx0KGVtZXJnZW5jeUFsZXJ0LnBsYXRmb3JtICYmIGVtZXJnZW5jeUFsZXJ0LnBsYXRmb3JtICE9PSBwbGF0Zm9ybSkgfHxcdC8vIHBsYXRmb3JtIG1pc21hdGNoXG5cdFx0XHRcdChlbWVyZ2VuY3lBbGVydC5hcmNoICYmIGVtZXJnZW5jeUFsZXJ0LmFyY2ggIT09IGFyY2gpXHRcdFx0XHRcdC8vIGFyY2ggbWlzbWF0Y2hcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuYmFubmVyU2VydmljZS5zaG93KHtcblx0XHRcdFx0aWQ6ICdlbWVyZ2VuY3lBbGVydC5iYW5uZXInLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLndhcm5pbmcsXG5cdFx0XHRcdG1lc3NhZ2U6IGVtZXJnZW5jeUFsZXJ0Lm1lc3NhZ2UsXG5cdFx0XHRcdGFjdGlvbnM6IGVtZXJnZW5jeUFsZXJ0LmFjdGlvbnNcblx0XHRcdH0pO1xuXG5cdFx0XHRicmVhaztcblx0XHR9XG5cdH1cbn1cblxucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKCd3b3JrYmVuY2guZW1lcmdlbmN5QWxlcnQnLCBFbWVyZ2VuY3lBbGVydCwgV29ya2JlbmNoUGhhc2UuRXZlbnR1YWxseSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQWlDLGdDQUFnQyxzQkFBc0I7QUFDdkYsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxRQUFRLHVCQUF1QjtBQUN4QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxNQUFNLGdCQUFnQjtBQWlCeEIsSUFBTSxpQkFBTixNQUF1RDtBQUFBLEVBSTdELFlBQ2tDLGVBQ0MsZ0JBQ0EsZ0JBQ0osWUFDN0I7QUFKZ0M7QUFDQztBQUNBO0FBQ0o7QUFFOUIsUUFBSSxlQUFlLFlBQVksV0FBVztBQUN6QztBQUFBLElBQ0Q7QUFFQSxVQUFNLG9CQUFvQixlQUFlO0FBQ3pDLFFBQUksQ0FBQyxtQkFBbUI7QUFDdkI7QUFBQSxJQUNEO0FBRUEsU0FBSyxZQUFZLGlCQUFpQjtBQUFBLEVBQ25DO0FBQUEsRUFFQSxNQUFjLFlBQVksS0FBNEI7QUFDckQsUUFBSTtBQUNILFlBQU0sS0FBSyxjQUFjLEdBQUc7QUFBQSxJQUM3QixTQUFTLEdBQUc7QUFDWCxXQUFLLFdBQVcsTUFBTSxDQUFDO0FBQUEsSUFDeEI7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFjLGNBQWMsS0FBNEI7QUFDdkQsVUFBTSxnQkFBZ0IsTUFBTSxLQUFLLGVBQWUsUUFBUSxFQUFFLE1BQU0sT0FBTyxLQUFLLGNBQWMsS0FBSyxHQUFHLGtCQUFrQixJQUFJO0FBRXhILFFBQUksY0FBYyxJQUFJLGVBQWUsS0FBSztBQUN6QyxZQUFNLElBQUksTUFBTSwwQ0FBMEMsY0FBYyxJQUFJLFVBQVUsRUFBRTtBQUFBLElBQ3pGO0FBRUEsVUFBTSxrQkFBa0IsTUFBTSxPQUF5QixhQUFhO0FBQ3BFLFFBQUksQ0FBQyxpQkFBaUI7QUFDckI7QUFBQSxJQUNEO0FBRUEsZUFBVyxrQkFBa0IsZ0JBQWdCLFFBQVE7QUFDcEQsVUFDRSxlQUFlLFdBQVcsS0FBSyxlQUFlO0FBQUEsTUFDOUMsZUFBZSxZQUFZLGVBQWUsYUFBYTtBQUFBLE1BQ3ZELGVBQWUsUUFBUSxlQUFlLFNBQVMsTUFDL0M7QUFDRDtBQUFBLE1BQ0Q7QUFFQSxXQUFLLGNBQWMsS0FBSztBQUFBLFFBQ3ZCLElBQUk7QUFBQSxRQUNKLE1BQU0sUUFBUTtBQUFBLFFBQ2QsU0FBUyxlQUFlO0FBQUEsUUFDeEIsU0FBUyxlQUFlO0FBQUEsTUFDekIsQ0FBQztBQUVEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQTdEYSxlQUVJLEtBQUs7QUFGVCxpQkFBTjtBQUFBLEVBS0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVJVO0FBK0RiLCtCQUErQiw0QkFBNEIsZ0JBQWdCLGVBQWUsVUFBVTsiLAogICJuYW1lcyI6IFtdCn0K
