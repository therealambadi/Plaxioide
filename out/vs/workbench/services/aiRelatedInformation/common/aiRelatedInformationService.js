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
import { createCancelablePromise, raceTimeout } from "../../../../base/common/async.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IAiRelatedInformationService } from "./aiRelatedInformation.js";
let AiRelatedInformationService = class {
  constructor(logService) {
    this.logService = logService;
    // 10 seconds
    this._providers = /* @__PURE__ */ new Map();
  }
  isEnabled() {
    return this._providers.size > 0;
  }
  registerAiRelatedInformationProvider(type, provider) {
    const providers = this._providers.get(type) ?? [];
    providers.push(provider);
    this._providers.set(type, providers);
    return {
      dispose: () => {
        const providers2 = this._providers.get(type) ?? [];
        const index = providers2.indexOf(provider);
        if (index !== -1) {
          providers2.splice(index, 1);
        }
        if (providers2.length === 0) {
          this._providers.delete(type);
        }
      }
    };
  }
  async getRelatedInformation(query, types, token) {
    if (this._providers.size === 0) {
      throw new Error("No related information providers registered");
    }
    const providers = [];
    for (const type of types) {
      const typeProviders = this._providers.get(type);
      if (typeProviders) {
        providers.push(...typeProviders);
      }
    }
    if (providers.length === 0) {
      throw new Error("No related information providers registered for the given types");
    }
    const stopwatch = StopWatch.create();
    const cancellablePromises = providers.map((provider) => {
      return createCancelablePromise(async (t) => {
        try {
          const result = await provider.provideAiRelatedInformation(query, t);
          return result.filter((r) => types.includes(r.type));
        } catch (e) {
        }
        return [];
      });
    });
    try {
      const results = await raceTimeout(
        Promise.allSettled(cancellablePromises),
        AiRelatedInformationService.DEFAULT_TIMEOUT,
        () => {
          cancellablePromises.forEach((p) => p.cancel());
          this.logService.warn("[AiRelatedInformationService]: Related information provider timed out");
        }
      );
      if (!results) {
        return [];
      }
      const result = results.filter((r) => r.status === "fulfilled").flatMap((r) => r.value);
      return result;
    } finally {
      stopwatch.stop();
      this.logService.trace(`[AiRelatedInformationService]: getRelatedInformation took ${stopwatch.elapsed()}ms`);
    }
  }
};
AiRelatedInformationService.DEFAULT_TIMEOUT = 1e3 * 10;
AiRelatedInformationService = __decorateClass([
  __decorateParam(0, ILogService)
], AiRelatedInformationService);
registerSingleton(IAiRelatedInformationService, AiRelatedInformationService, InstantiationType.Delayed);
export {
  AiRelatedInformationService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvYWlSZWxhdGVkSW5mb3JtYXRpb24vY29tbW9uL2FpUmVsYXRlZEluZm9ybWF0aW9uU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENhbmNlbGFibGVQcm9taXNlLCBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSwgcmFjZVRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFN0b3BXYXRjaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0b3B3YXRjaC5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElBaVJlbGF0ZWRJbmZvcm1hdGlvblNlcnZpY2UsIElBaVJlbGF0ZWRJbmZvcm1hdGlvblByb3ZpZGVyLCBSZWxhdGVkSW5mb3JtYXRpb25UeXBlLCBSZWxhdGVkSW5mb3JtYXRpb25SZXN1bHQgfSBmcm9tICcuL2FpUmVsYXRlZEluZm9ybWF0aW9uLmpzJztcblxuZXhwb3J0IGNsYXNzIEFpUmVsYXRlZEluZm9ybWF0aW9uU2VydmljZSBpbXBsZW1lbnRzIElBaVJlbGF0ZWRJbmZvcm1hdGlvblNlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0c3RhdGljIHJlYWRvbmx5IERFRkFVTFRfVElNRU9VVCA9IDEwMDAgKiAxMDsgLy8gMTAgc2Vjb25kc1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyczogTWFwPFJlbGF0ZWRJbmZvcm1hdGlvblR5cGUsIElBaVJlbGF0ZWRJbmZvcm1hdGlvblByb3ZpZGVyW10+ID0gbmV3IE1hcCgpO1xuXG5cdGNvbnN0cnVjdG9yKEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlKSB7IH1cblxuXHRpc0VuYWJsZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3ZpZGVycy5zaXplID4gMDtcblx0fVxuXG5cdHJlZ2lzdGVyQWlSZWxhdGVkSW5mb3JtYXRpb25Qcm92aWRlcih0eXBlOiBSZWxhdGVkSW5mb3JtYXRpb25UeXBlLCBwcm92aWRlcjogSUFpUmVsYXRlZEluZm9ybWF0aW9uUHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgcHJvdmlkZXJzID0gdGhpcy5fcHJvdmlkZXJzLmdldCh0eXBlKSA/PyBbXTtcblx0XHRwcm92aWRlcnMucHVzaChwcm92aWRlcik7XG5cdFx0dGhpcy5fcHJvdmlkZXJzLnNldCh0eXBlLCBwcm92aWRlcnMpO1xuXG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBwcm92aWRlcnMgPSB0aGlzLl9wcm92aWRlcnMuZ2V0KHR5cGUpID8/IFtdO1xuXHRcdFx0XHRjb25zdCBpbmRleCA9IHByb3ZpZGVycy5pbmRleE9mKHByb3ZpZGVyKTtcblx0XHRcdFx0aWYgKGluZGV4ICE9PSAtMSkge1xuXHRcdFx0XHRcdHByb3ZpZGVycy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChwcm92aWRlcnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0dGhpcy5fcHJvdmlkZXJzLmRlbGV0ZSh0eXBlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRhc3luYyBnZXRSZWxhdGVkSW5mb3JtYXRpb24ocXVlcnk6IHN0cmluZywgdHlwZXM6IFJlbGF0ZWRJbmZvcm1hdGlvblR5cGVbXSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxSZWxhdGVkSW5mb3JtYXRpb25SZXN1bHRbXT4ge1xuXHRcdGlmICh0aGlzLl9wcm92aWRlcnMuc2l6ZSA9PT0gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdObyByZWxhdGVkIGluZm9ybWF0aW9uIHByb3ZpZGVycyByZWdpc3RlcmVkJyk7XG5cdFx0fVxuXG5cdFx0Ly8gZ2V0IHByb3ZpZGVycyBmb3IgZWFjaCB0eXBlXG5cdFx0Y29uc3QgcHJvdmlkZXJzOiBJQWlSZWxhdGVkSW5mb3JtYXRpb25Qcm92aWRlcltdID0gW107XG5cdFx0Zm9yIChjb25zdCB0eXBlIG9mIHR5cGVzKSB7XG5cdFx0XHRjb25zdCB0eXBlUHJvdmlkZXJzID0gdGhpcy5fcHJvdmlkZXJzLmdldCh0eXBlKTtcblx0XHRcdGlmICh0eXBlUHJvdmlkZXJzKSB7XG5cdFx0XHRcdHByb3ZpZGVycy5wdXNoKC4uLnR5cGVQcm92aWRlcnMpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChwcm92aWRlcnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vIHJlbGF0ZWQgaW5mb3JtYXRpb24gcHJvdmlkZXJzIHJlZ2lzdGVyZWQgZm9yIHRoZSBnaXZlbiB0eXBlcycpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0b3B3YXRjaCA9IFN0b3BXYXRjaC5jcmVhdGUoKTtcblxuXHRcdGNvbnN0IGNhbmNlbGxhYmxlUHJvbWlzZXM6IEFycmF5PENhbmNlbGFibGVQcm9taXNlPFJlbGF0ZWRJbmZvcm1hdGlvblJlc3VsdFtdPj4gPSBwcm92aWRlcnMubWFwKChwcm92aWRlcikgPT4ge1xuXHRcdFx0cmV0dXJuIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKGFzeW5jIHQgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVBaVJlbGF0ZWRJbmZvcm1hdGlvbihxdWVyeSwgdCk7XG5cdFx0XHRcdFx0Ly8gZG91YmxlIGZpbHRlciBqdXN0IGluIGNhc2Vcblx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0LmZpbHRlcihyID0+IHR5cGVzLmluY2x1ZGVzKHIudHlwZSkpO1xuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0Ly8gbG9nZ2VkIGluIGV4dGVuc2lvbiBob3N0XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzdWx0cyA9IGF3YWl0IHJhY2VUaW1lb3V0KFxuXHRcdFx0XHRQcm9taXNlLmFsbFNldHRsZWQoY2FuY2VsbGFibGVQcm9taXNlcyksXG5cdFx0XHRcdEFpUmVsYXRlZEluZm9ybWF0aW9uU2VydmljZS5ERUZBVUxUX1RJTUVPVVQsXG5cdFx0XHRcdCgpID0+IHtcblx0XHRcdFx0XHRjYW5jZWxsYWJsZVByb21pc2VzLmZvckVhY2gocCA9PiBwLmNhbmNlbCgpKTtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybignW0FpUmVsYXRlZEluZm9ybWF0aW9uU2VydmljZV06IFJlbGF0ZWQgaW5mb3JtYXRpb24gcHJvdmlkZXIgdGltZWQgb3V0Jyk7XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0XHRpZiAoIXJlc3VsdHMpIHtcblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gcmVzdWx0c1xuXHRcdFx0XHQuZmlsdGVyKHIgPT4gci5zdGF0dXMgPT09ICdmdWxmaWxsZWQnKVxuXHRcdFx0XHQuZmxhdE1hcChyID0+IChyIGFzIFByb21pc2VGdWxmaWxsZWRSZXN1bHQ8UmVsYXRlZEluZm9ybWF0aW9uUmVzdWx0W10+KS52YWx1ZSk7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzdG9wd2F0Y2guc3RvcCgpO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBbQWlSZWxhdGVkSW5mb3JtYXRpb25TZXJ2aWNlXTogZ2V0UmVsYXRlZEluZm9ybWF0aW9uIHRvb2sgJHtzdG9wd2F0Y2guZWxhcHNlZCgpfW1zYCk7XG5cdFx0fVxuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElBaVJlbGF0ZWRJbmZvcm1hdGlvblNlcnZpY2UsIEFpUmVsYXRlZEluZm9ybWF0aW9uU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFNBQTRCLHlCQUF5QixtQkFBbUI7QUFFeEUsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsb0NBQXFIO0FBRXZILElBQU0sOEJBQU4sTUFBMEU7QUFBQSxFQU9oRixZQUEwQyxZQUF5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
