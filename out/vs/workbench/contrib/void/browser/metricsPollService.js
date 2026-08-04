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
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import * as dom from "../../../../base/browser/dom.js";
import { IMetricsService } from "../common/metricsService.js";
const PING_EVERY_MS = 15 * 1e3 * 60;
const IMetricsPollService = createDecorator("voidMetricsPollService");
let MetricsPollService = class extends Disposable {
  constructor(metricsService) {
    super();
    this.metricsService = metricsService;
    const { window } = dom.getActiveWindow();
    let i = 1;
    this.intervalID = window.setInterval(() => {
      this.metricsService.capture("Alive", { iv1: i });
      i += 1;
    }, PING_EVERY_MS);
  }
  dispose() {
    super.dispose();
    const { window } = dom.getActiveWindow();
    window.clearInterval(this.intervalID);
  }
};
MetricsPollService.ID = "voidMetricsPollService";
MetricsPollService = __decorateClass([
  __decorateParam(0, IMetricsService)
], MetricsPollService);
registerWorkbenchContribution2(MetricsPollService.ID, MetricsPollService, WorkbenchPhase.BlockRestore);
export {
  IMetricsPollService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvbWV0cmljc1BvbGxTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IDIwMjUgR2xhc3MgRGV2dG9vbHMsIEluYy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wLiBTZWUgTElDRU5TRS50eHQgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMiwgV29ya2JlbmNoUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElNZXRyaWNzU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9tZXRyaWNzU2VydmljZS5qcyc7XG5cblxuXG5leHBvcnQgaW50ZXJmYWNlIElNZXRyaWNzUG9sbFNlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG59XG5cblxuY29uc3QgUElOR19FVkVSWV9NUyA9IDE1ICogMTAwMCAqIDYwICAvLyAxNSBtaW51dGVzXG5cbmV4cG9ydCBjb25zdCBJTWV0cmljc1BvbGxTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElNZXRyaWNzUG9sbFNlcnZpY2U+KCd2b2lkTWV0cmljc1BvbGxTZXJ2aWNlJyk7XG5jbGFzcyBNZXRyaWNzUG9sbFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSU1ldHJpY3NQb2xsU2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAndm9pZE1ldHJpY3NQb2xsU2VydmljZSc7XG5cblxuXHRwcml2YXRlIHJlYWRvbmx5IGludGVydmFsSUQ6IG51bWJlclxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU1ldHJpY3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWV0cmljc1NlcnZpY2U6IElNZXRyaWNzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKVxuXG5cdFx0Ly8gaW5pdGlhbCBzdGF0ZVxuXHRcdGNvbnN0IHsgd2luZG93IH0gPSBkb20uZ2V0QWN0aXZlV2luZG93KClcblx0XHRsZXQgaSA9IDFcblxuXHRcdHRoaXMuaW50ZXJ2YWxJRCA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHR0aGlzLm1ldHJpY3NTZXJ2aWNlLmNhcHR1cmUoJ0FsaXZlJywgeyBpdjE6IGkgfSlcblx0XHRcdGkgKz0gMVxuXHRcdH0sIFBJTkdfRVZFUllfTVMpXG5cblxuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHRzdXBlci5kaXNwb3NlKClcblx0XHRjb25zdCB7IHdpbmRvdyB9ID0gZG9tLmdldEFjdGl2ZVdpbmRvdygpXG5cdFx0d2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbElEKVxuXHR9XG5cblxufVxuXG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoTWV0cmljc1BvbGxTZXJ2aWNlLklELCBNZXRyaWNzUG9sbFNlcnZpY2UsIFdvcmtiZW5jaFBoYXNlLkJsb2NrUmVzdG9yZSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0NBQWdDLHNCQUFzQjtBQUUvRCxZQUFZLFNBQVM7QUFDckIsU0FBUyx1QkFBdUI7QUFTaEMsTUFBTSxnQkFBZ0IsS0FBSyxNQUFPO0FBRTNCLE1BQU0sc0JBQXNCLGdCQUFxQyx3QkFBd0I7QUFDaEcsSUFBTSxxQkFBTixjQUFpQyxXQUEwQztBQUFBLEVBTzFFLFlBQ21DLGdCQUNqQztBQUNELFVBQU07QUFGNEI7QUFLbEMsVUFBTSxFQUFFLE9BQU8sSUFBSSxJQUFJLGdCQUFnQjtBQUN2QyxRQUFJLElBQUk7QUFFUixTQUFLLGFBQWEsT0FBTyxZQUFZLE1BQU07QUFDMUMsV0FBSyxlQUFlLFFBQVEsU0FBUyxFQUFFLEtBQUssRUFBRSxDQUFDO0FBQy9DLFdBQUs7QUFBQSxJQUNOLEdBQUcsYUFBYTtBQUFBLEVBR2pCO0FBQUEsRUFFUyxVQUFVO0FBQ2xCLFVBQU0sUUFBUTtBQUNkLFVBQU0sRUFBRSxPQUFPLElBQUksSUFBSSxnQkFBZ0I7QUFDdkMsV0FBTyxjQUFjLEtBQUssVUFBVTtBQUFBLEVBQ3JDO0FBR0Q7QUEvQk0sbUJBR1csS0FBSztBQUhoQixxQkFBTjtBQUFBLEVBUUc7QUFBQSxHQVJHO0FBaUNOLCtCQUErQixtQkFBbUIsSUFBSSxvQkFBb0IsZUFBZSxZQUFZOyIsCiAgIm5hbWVzIjogW10KfQo=
