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
import { ILoggerService, log } from "../../../../platform/log/common/log.js";
let DelayedLogChannel = class {
  constructor(id, name, file, loggerService) {
    this.file = file;
    this.loggerService = loggerService;
    this.logger = loggerService.createLogger(file, { name, id, hidden: true });
  }
  log(level, message) {
    this.loggerService.setVisibility(this.file, true);
    log(this.logger, level, message);
  }
};
DelayedLogChannel = __decorateClass([
  __decorateParam(3, ILoggerService)
], DelayedLogChannel);
export {
  DelayedLogChannel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvb3V0cHV0L2NvbW1vbi9kZWxheWVkTG9nQ2hhbm5lbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElMb2dnZXIsIElMb2dnZXJTZXJ2aWNlLCBsb2csIExvZ0xldmVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcblxuZXhwb3J0IGNsYXNzIERlbGF5ZWRMb2dDaGFubmVsIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGxvZ2dlcjogSUxvZ2dlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRpZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIHByaXZhdGUgcmVhZG9ubHkgZmlsZTogVVJJLFxuXHRcdEBJTG9nZ2VyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ2dlclNlcnZpY2U6IElMb2dnZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLmxvZ2dlciA9IGxvZ2dlclNlcnZpY2UuY3JlYXRlTG9nZ2VyKGZpbGUsIHsgbmFtZSwgaWQsIGhpZGRlbjogdHJ1ZSB9KTtcblx0fVxuXG5cdGxvZyhsZXZlbDogTG9nTGV2ZWwsIG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMubG9nZ2VyU2VydmljZS5zZXRWaXNpYmlsaXR5KHRoaXMuZmlsZSwgdHJ1ZSk7XG5cdFx0bG9nKHRoaXMubG9nZ2VyLCBsZXZlbCwgbWVzc2FnZSk7XG5cdH1cblxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFrQixnQkFBZ0IsV0FBcUI7QUFHaEQsSUFBTSxvQkFBTixNQUF3QjtBQUFBLEVBSTlCLFlBQ0MsSUFBWSxNQUErQixNQUNWLGVBQ2hDO0FBRjBDO0FBQ1Y7QUFFakMsU0FBSyxTQUFTLGNBQWMsYUFBYSxNQUFNLEVBQUUsTUFBTSxJQUFJLFFBQVEsS0FBSyxDQUFDO0FBQUEsRUFDMUU7QUFBQSxFQUVBLElBQUksT0FBaUIsU0FBdUI7QUFDM0MsU0FBSyxjQUFjLGNBQWMsS0FBSyxNQUFNLElBQUk7QUFDaEQsUUFBSSxLQUFLLFFBQVEsT0FBTyxPQUFPO0FBQUEsRUFDaEM7QUFFRDtBQWhCYSxvQkFBTjtBQUFBLEVBTUo7QUFBQSxHQU5VOyIsCiAgIm5hbWVzIjogW10KfQo=
