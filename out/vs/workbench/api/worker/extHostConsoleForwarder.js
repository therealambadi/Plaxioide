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
import { AbstractExtHostConsoleForwarder } from "../common/extHostConsoleForwarder.js";
import { IExtHostInitDataService } from "../common/extHostInitDataService.js";
import { IExtHostRpcService } from "../common/extHostRpcService.js";
let ExtHostConsoleForwarder = class extends AbstractExtHostConsoleForwarder {
  constructor(extHostRpc, initData) {
    super(extHostRpc, initData);
  }
  _nativeConsoleLogMessage(_method, original, args) {
    original.apply(console, args);
  }
};
ExtHostConsoleForwarder = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostInitDataService)
], ExtHostConsoleForwarder);
export {
  ExtHostConsoleForwarder
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3dvcmtlci9leHRIb3N0Q29uc29sZUZvcndhcmRlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEFic3RyYWN0RXh0SG9zdENvbnNvbGVGb3J3YXJkZXIgfSBmcm9tICcuLi9jb21tb24vZXh0SG9zdENvbnNvbGVGb3J3YXJkZXIuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RJbml0RGF0YVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vZXh0SG9zdEluaXREYXRhU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdFJwY1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vZXh0SG9zdFJwY1NlcnZpY2UuanMnO1xuXG5leHBvcnQgY2xhc3MgRXh0SG9zdENvbnNvbGVGb3J3YXJkZXIgZXh0ZW5kcyBBYnN0cmFjdEV4dEhvc3RDb25zb2xlRm9yd2FyZGVyIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dEhvc3RScGNTZXJ2aWNlIGV4dEhvc3RScGM6IElFeHRIb3N0UnBjU2VydmljZSxcblx0XHRASUV4dEhvc3RJbml0RGF0YVNlcnZpY2UgaW5pdERhdGE6IElFeHRIb3N0SW5pdERhdGFTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihleHRIb3N0UnBjLCBpbml0RGF0YSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX25hdGl2ZUNvbnNvbGVMb2dNZXNzYWdlKF9tZXRob2Q6IHVua25vd24sIG9yaWdpbmFsOiAoLi4uYXJnczogYW55W10pID0+IHZvaWQsIGFyZ3M6IElBcmd1bWVudHMpIHtcblx0XHRvcmlnaW5hbC5hcHBseShjb25zb2xlLCBhcmdzIGFzIGFueSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUywrQkFBK0I7QUFDeEMsU0FBUywwQkFBMEI7QUFFNUIsSUFBTSwwQkFBTixjQUFzQyxnQ0FBZ0M7QUFBQSxFQUU1RSxZQUNxQixZQUNLLFVBQ3hCO0FBQ0QsVUFBTSxZQUFZLFFBQVE7QUFBQSxFQUMzQjtBQUFBLEVBRW1CLHlCQUF5QixTQUFrQixVQUFvQyxNQUFrQjtBQUNuSCxhQUFTLE1BQU0sU0FBUyxJQUFXO0FBQUEsRUFDcEM7QUFDRDtBQVphLDBCQUFOO0FBQUEsRUFHSjtBQUFBLEVBQ0E7QUFBQSxHQUpVOyIsCiAgIm5hbWVzIjogW10KfQo=
