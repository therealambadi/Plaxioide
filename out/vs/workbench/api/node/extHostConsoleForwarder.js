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
import { NativeLogMarkers } from "../../services/extensions/common/extensionHostProtocol.js";
const MAX_STREAM_BUFFER_LENGTH = 1024 * 1024;
let ExtHostConsoleForwarder = class extends AbstractExtHostConsoleForwarder {
  constructor(extHostRpc, initData) {
    super(extHostRpc, initData);
    this._isMakingConsoleCall = false;
    this._wrapStream("stderr", "error");
    this._wrapStream("stdout", "log");
  }
  _nativeConsoleLogMessage(method, original, args) {
    const stream = method === "error" || method === "warn" ? process.stderr : process.stdout;
    this._isMakingConsoleCall = true;
    stream.write(`
${NativeLogMarkers.Start}
`);
    original.apply(console, args);
    stream.write(`
${NativeLogMarkers.End}
`);
    this._isMakingConsoleCall = false;
  }
  /**
   * Wraps process.stderr/stdout.write() so that it is transmitted to the
   * renderer or CLI. It both calls through to the original method as well
   * as to console.log with complete lines so that they're made available
   * to the debugger/CLI.
   */
  _wrapStream(streamName, severity) {
    const stream = process[streamName];
    const original = stream.write;
    let buf = "";
    Object.defineProperty(stream, "write", {
      set: () => {
      },
      get: () => (chunk, encoding, callback) => {
        if (!this._isMakingConsoleCall) {
          buf += chunk.toString(encoding);
          const eol = buf.length > MAX_STREAM_BUFFER_LENGTH ? buf.length : buf.lastIndexOf("\n");
          if (eol !== -1) {
            console[severity](buf.slice(0, eol));
            buf = buf.slice(eol + 1);
          }
        }
        original.call(stream, chunk, encoding, callback);
      }
    });
  }
};
ExtHostConsoleForwarder = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostInitDataService)
], ExtHostConsoleForwarder);
export {
  ExtHostConsoleForwarder
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL25vZGUvZXh0SG9zdENvbnNvbGVGb3J3YXJkZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBBYnN0cmFjdEV4dEhvc3RDb25zb2xlRm9yd2FyZGVyIH0gZnJvbSAnLi4vY29tbW9uL2V4dEhvc3RDb25zb2xlRm9yd2FyZGVyLmpzJztcbmltcG9ydCB7IElFeHRIb3N0SW5pdERhdGFTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2V4dEhvc3RJbml0RGF0YVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RScGNTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2V4dEhvc3RScGNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5hdGl2ZUxvZ01hcmtlcnMgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25Ib3N0UHJvdG9jb2wuanMnO1xuXG5jb25zdCBNQVhfU1RSRUFNX0JVRkZFUl9MRU5HVEggPSAxMDI0ICogMTAyNDtcblxuZXhwb3J0IGNsYXNzIEV4dEhvc3RDb25zb2xlRm9yd2FyZGVyIGV4dGVuZHMgQWJzdHJhY3RFeHRIb3N0Q29uc29sZUZvcndhcmRlciB7XG5cblx0cHJpdmF0ZSBfaXNNYWtpbmdDb25zb2xlQ2FsbDogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0SG9zdFJwY1NlcnZpY2UgZXh0SG9zdFJwYzogSUV4dEhvc3RScGNTZXJ2aWNlLFxuXHRcdEBJRXh0SG9zdEluaXREYXRhU2VydmljZSBpbml0RGF0YTogSUV4dEhvc3RJbml0RGF0YVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGV4dEhvc3RScGMsIGluaXREYXRhKTtcblxuXHRcdHRoaXMuX3dyYXBTdHJlYW0oJ3N0ZGVycicsICdlcnJvcicpO1xuXHRcdHRoaXMuX3dyYXBTdHJlYW0oJ3N0ZG91dCcsICdsb2cnKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBfbmF0aXZlQ29uc29sZUxvZ01lc3NhZ2UobWV0aG9kOiAnbG9nJyB8ICdpbmZvJyB8ICd3YXJuJyB8ICdlcnJvcicgfCAnZGVidWcnLCBvcmlnaW5hbDogKC4uLmFyZ3M6IGFueVtdKSA9PiB2b2lkLCBhcmdzOiBJQXJndW1lbnRzKSB7XG5cdFx0Y29uc3Qgc3RyZWFtID0gbWV0aG9kID09PSAnZXJyb3InIHx8IG1ldGhvZCA9PT0gJ3dhcm4nID8gcHJvY2Vzcy5zdGRlcnIgOiBwcm9jZXNzLnN0ZG91dDtcblx0XHR0aGlzLl9pc01ha2luZ0NvbnNvbGVDYWxsID0gdHJ1ZTtcblx0XHRzdHJlYW0ud3JpdGUoYFxcbiR7TmF0aXZlTG9nTWFya2Vycy5TdGFydH1cXG5gKTtcblx0XHRvcmlnaW5hbC5hcHBseShjb25zb2xlLCBhcmdzIGFzIGFueSk7XG5cdFx0c3RyZWFtLndyaXRlKGBcXG4ke05hdGl2ZUxvZ01hcmtlcnMuRW5kfVxcbmApO1xuXHRcdHRoaXMuX2lzTWFraW5nQ29uc29sZUNhbGwgPSBmYWxzZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBXcmFwcyBwcm9jZXNzLnN0ZGVyci9zdGRvdXQud3JpdGUoKSBzbyB0aGF0IGl0IGlzIHRyYW5zbWl0dGVkIHRvIHRoZVxuXHQgKiByZW5kZXJlciBvciBDTEkuIEl0IGJvdGggY2FsbHMgdGhyb3VnaCB0byB0aGUgb3JpZ2luYWwgbWV0aG9kIGFzIHdlbGxcblx0ICogYXMgdG8gY29uc29sZS5sb2cgd2l0aCBjb21wbGV0ZSBsaW5lcyBzbyB0aGF0IHRoZXkncmUgbWFkZSBhdmFpbGFibGVcblx0ICogdG8gdGhlIGRlYnVnZ2VyL0NMSS5cblx0ICovXG5cdHByaXZhdGUgX3dyYXBTdHJlYW0oc3RyZWFtTmFtZTogJ3N0ZG91dCcgfCAnc3RkZXJyJywgc2V2ZXJpdHk6ICdsb2cnIHwgJ3dhcm4nIHwgJ2Vycm9yJykge1xuXHRcdGNvbnN0IHN0cmVhbSA9IHByb2Nlc3Nbc3RyZWFtTmFtZV07XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBzdHJlYW0ud3JpdGU7XG5cblx0XHRsZXQgYnVmID0gJyc7XG5cblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoc3RyZWFtLCAnd3JpdGUnLCB7XG5cdFx0XHRzZXQ6ICgpID0+IHsgfSxcblx0XHRcdGdldDogKCkgPT4gKGNodW5rOiBVaW50OEFycmF5IHwgc3RyaW5nLCBlbmNvZGluZz86IEJ1ZmZlckVuY29kaW5nLCBjYWxsYmFjaz86IChlcnI/OiBFcnJvcikgPT4gdm9pZCkgPT4ge1xuXHRcdFx0XHRpZiAoIXRoaXMuX2lzTWFraW5nQ29uc29sZUNhbGwpIHtcblx0XHRcdFx0XHRidWYgKz0gKGNodW5rIGFzIGFueSkudG9TdHJpbmcoZW5jb2RpbmcpO1xuXHRcdFx0XHRcdGNvbnN0IGVvbCA9IGJ1Zi5sZW5ndGggPiBNQVhfU1RSRUFNX0JVRkZFUl9MRU5HVEggPyBidWYubGVuZ3RoIDogYnVmLmxhc3RJbmRleE9mKCdcXG4nKTtcblx0XHRcdFx0XHRpZiAoZW9sICE9PSAtMSkge1xuXHRcdFx0XHRcdFx0Y29uc29sZVtzZXZlcml0eV0oYnVmLnNsaWNlKDAsIGVvbCkpO1xuXHRcdFx0XHRcdFx0YnVmID0gYnVmLnNsaWNlKGVvbCArIDEpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdG9yaWdpbmFsLmNhbGwoc3RyZWFtLCBjaHVuaywgZW5jb2RpbmcsIGNhbGxiYWNrKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUywrQkFBK0I7QUFDeEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx3QkFBd0I7QUFFakMsTUFBTSwyQkFBMkIsT0FBTztBQUVqQyxJQUFNLDBCQUFOLGNBQXNDLGdDQUFnQztBQUFBLEVBSTVFLFlBQ3FCLFlBQ0ssVUFDeEI7QUFDRCxVQUFNLFlBQVksUUFBUTtBQU4zQixTQUFRLHVCQUFnQztBQVF2QyxTQUFLLFlBQVksVUFBVSxPQUFPO0FBQ2xDLFNBQUssWUFBWSxVQUFVLEtBQUs7QUFBQSxFQUNqQztBQUFBLEVBRW1CLHlCQUF5QixRQUFxRCxVQUFvQyxNQUFrQjtBQUN0SixVQUFNLFNBQVMsV0FBVyxXQUFXLFdBQVcsU0FBUyxRQUFRLFNBQVMsUUFBUTtBQUNsRixTQUFLLHVCQUF1QjtBQUM1QixXQUFPLE1BQU07QUFBQSxFQUFLLGlCQUFpQixLQUFLO0FBQUEsQ0FBSTtBQUM1QyxhQUFTLE1BQU0sU0FBUyxJQUFXO0FBQ25DLFdBQU8sTUFBTTtBQUFBLEVBQUssaUJBQWlCLEdBQUc7QUFBQSxDQUFJO0FBQzFDLFNBQUssdUJBQXVCO0FBQUEsRUFDN0I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVFRLFlBQVksWUFBaUMsVUFBb0M7QUFDeEYsVUFBTSxTQUFTLFFBQVEsVUFBVTtBQUNqQyxVQUFNLFdBQVcsT0FBTztBQUV4QixRQUFJLE1BQU07QUFFVixXQUFPLGVBQWUsUUFBUSxTQUFTO0FBQUEsTUFDdEMsS0FBSyxNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQ2IsS0FBSyxNQUFNLENBQUMsT0FBNEIsVUFBMkIsYUFBcUM7QUFDdkcsWUFBSSxDQUFDLEtBQUssc0JBQXNCO0FBQy9CLGlCQUFRLE1BQWMsU0FBUyxRQUFRO0FBQ3ZDLGdCQUFNLE1BQU0sSUFBSSxTQUFTLDJCQUEyQixJQUFJLFNBQVMsSUFBSSxZQUFZLElBQUk7QUFDckYsY0FBSSxRQUFRLElBQUk7QUFDZixvQkFBUSxRQUFRLEVBQUUsSUFBSSxNQUFNLEdBQUcsR0FBRyxDQUFDO0FBQ25DLGtCQUFNLElBQUksTUFBTSxNQUFNLENBQUM7QUFBQSxVQUN4QjtBQUFBLFFBQ0Q7QUFFQSxpQkFBUyxLQUFLLFFBQVEsT0FBTyxVQUFVLFFBQVE7QUFBQSxNQUNoRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFDRDtBQW5EYSwwQkFBTjtBQUFBLEVBS0o7QUFBQSxFQUNBO0FBQUEsR0FOVTsiLAogICJuYW1lcyI6IFtdCn0K
