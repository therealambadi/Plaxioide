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
import { parse } from "../../../base/common/path.js";
import { debounce, throttle } from "../../../base/common/decorators.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { listProcesses } from "../../../base/node/ps.js";
import { ILogService } from "../../log/common/log.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["InactiveThrottleDuration"] = 5e3] = "InactiveThrottleDuration";
  Constants2[Constants2["ActiveDebounceDuration"] = 1e3] = "ActiveDebounceDuration";
  return Constants2;
})(Constants || {});
const ignoreProcessNames = [];
let ChildProcessMonitor = class extends Disposable {
  constructor(_pid, _logService) {
    super();
    this._pid = _pid;
    this._logService = _logService;
    this._hasChildProcesses = false;
    this._onDidChangeHasChildProcesses = this._register(new Emitter());
    /**
     * An event that fires when whether the process has child processes changes.
     */
    this.onDidChangeHasChildProcesses = this._onDidChangeHasChildProcesses.event;
  }
  set hasChildProcesses(value) {
    if (this._hasChildProcesses !== value) {
      this._hasChildProcesses = value;
      this._logService.debug("ChildProcessMonitor: Has child processes changed", value);
      this._onDidChangeHasChildProcesses.fire(value);
    }
  }
  /**
   * Whether the process has child processes.
   */
  get hasChildProcesses() {
    return this._hasChildProcesses;
  }
  /**
   * Input was triggered on the process.
   */
  handleInput() {
    this._refreshActive();
  }
  /**
   * Output was triggered on the process.
   */
  handleOutput() {
    this._refreshInactive();
  }
  async _refreshActive() {
    if (this._store.isDisposed) {
      return;
    }
    try {
      const processItem = await listProcesses(this._pid);
      this.hasChildProcesses = this._processContainsChildren(processItem);
    } catch (e) {
      this._logService.debug("ChildProcessMonitor: Fetching process tree failed", e);
    }
  }
  _refreshInactive() {
    this._refreshActive();
  }
  _processContainsChildren(processItem) {
    if (!processItem.children) {
      return false;
    }
    if (processItem.children.length === 1) {
      const item = processItem.children[0];
      let cmd;
      if (item.cmd.startsWith(`"`)) {
        cmd = item.cmd.substring(1, item.cmd.indexOf(`"`, 1));
      } else {
        const spaceIndex = item.cmd.indexOf(` `);
        if (spaceIndex === -1) {
          cmd = item.cmd;
        } else {
          cmd = item.cmd.substring(0, spaceIndex);
        }
      }
      return ignoreProcessNames.indexOf(parse(cmd).name) === -1;
    }
    return processItem.children.length > 0;
  }
};
__decorateClass([
  debounce(1e3 /* ActiveDebounceDuration */)
], ChildProcessMonitor.prototype, "_refreshActive", 1);
__decorateClass([
  throttle(5e3 /* InactiveThrottleDuration */)
], ChildProcessMonitor.prototype, "_refreshInactive", 1);
ChildProcessMonitor = __decorateClass([
  __decorateParam(1, ILogService)
], ChildProcessMonitor);
export {
  ChildProcessMonitor,
  ignoreProcessNames
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC9ub2RlL2NoaWxkUHJvY2Vzc01vbml0b3IudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBwYXJzZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgZGVib3VuY2UsIHRocm90dGxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBQcm9jZXNzSXRlbSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Byb2Nlc3Nlcy5qcyc7XG5pbXBvcnQgeyBsaXN0UHJvY2Vzc2VzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL3BzLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuXG5jb25zdCBlbnVtIENvbnN0YW50cyB7XG5cdC8qKlxuXHQgKiBUaGUgYW1vdW50IG9mIHRpbWUgdG8gdGhyb3R0bGUgY2hlY2tzIHdoZW4gdGhlIHByb2Nlc3MgcmVjZWl2ZXMgb3V0cHV0LlxuXHQgKi9cblx0SW5hY3RpdmVUaHJvdHRsZUR1cmF0aW9uID0gNTAwMCxcblx0LyoqXG5cdCAqIFRoZSBhbW91bnQgb2YgdGltZSB0byBkZWJvdW5jZSBjaGVjayB3aGVuIHRoZSBwcm9jZXNzIHJlY2VpdmVzIGlucHV0LlxuXHQgKi9cblx0QWN0aXZlRGVib3VuY2VEdXJhdGlvbiA9IDEwMDAsXG59XG5cbmV4cG9ydCBjb25zdCBpZ25vcmVQcm9jZXNzTmFtZXM6IHN0cmluZ1tdID0gW107XG5cbi8qKlxuICogTW9uaXRvcnMgYSBwcm9jZXNzIGZvciBjaGlsZCBwcm9jZXNzZXMsIGNoZWNraW5nIGF0IGRpZmZlcmluZyB0aW1lcyBkZXBlbmRpbmcgb24gaW5wdXQgYW5kIG91dHB1dFxuICogY2FsbHMgaW50byB0aGUgbW9uaXRvci5cbiAqL1xuZXhwb3J0IGNsYXNzIENoaWxkUHJvY2Vzc01vbml0b3IgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBfaGFzQ2hpbGRQcm9jZXNzZXM6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBzZXQgaGFzQ2hpbGRQcm9jZXNzZXModmFsdWU6IGJvb2xlYW4pIHtcblx0XHRpZiAodGhpcy5faGFzQ2hpbGRQcm9jZXNzZXMgIT09IHZhbHVlKSB7XG5cdFx0XHR0aGlzLl9oYXNDaGlsZFByb2Nlc3NlcyA9IHZhbHVlO1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnQ2hpbGRQcm9jZXNzTW9uaXRvcjogSGFzIGNoaWxkIHByb2Nlc3NlcyBjaGFuZ2VkJywgdmFsdWUpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VIYXNDaGlsZFByb2Nlc3Nlcy5maXJlKHZhbHVlKTtcblx0XHR9XG5cdH1cblx0LyoqXG5cdCAqIFdoZXRoZXIgdGhlIHByb2Nlc3MgaGFzIGNoaWxkIHByb2Nlc3Nlcy5cblx0ICovXG5cdGdldCBoYXNDaGlsZFByb2Nlc3NlcygpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2hhc0NoaWxkUHJvY2Vzc2VzOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VIYXNDaGlsZFByb2Nlc3NlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPGJvb2xlYW4+KCkpO1xuXHQvKipcblx0ICogQW4gZXZlbnQgdGhhdCBmaXJlcyB3aGVuIHdoZXRoZXIgdGhlIHByb2Nlc3MgaGFzIGNoaWxkIHByb2Nlc3NlcyBjaGFuZ2VzLlxuXHQgKi9cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VIYXNDaGlsZFByb2Nlc3NlcyA9IHRoaXMuX29uRGlkQ2hhbmdlSGFzQ2hpbGRQcm9jZXNzZXMuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcGlkOiBudW1iZXIsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHQvKipcblx0ICogSW5wdXQgd2FzIHRyaWdnZXJlZCBvbiB0aGUgcHJvY2Vzcy5cblx0ICovXG5cdGhhbmRsZUlucHV0KCkge1xuXHRcdHRoaXMuX3JlZnJlc2hBY3RpdmUoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBPdXRwdXQgd2FzIHRyaWdnZXJlZCBvbiB0aGUgcHJvY2Vzcy5cblx0ICovXG5cdGhhbmRsZU91dHB1dCgpIHtcblx0XHR0aGlzLl9yZWZyZXNoSW5hY3RpdmUoKTtcblx0fVxuXG5cdEBkZWJvdW5jZShDb25zdGFudHMuQWN0aXZlRGVib3VuY2VEdXJhdGlvbilcblx0cHJpdmF0ZSBhc3luYyBfcmVmcmVzaEFjdGl2ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcHJvY2Vzc0l0ZW0gPSBhd2FpdCBsaXN0UHJvY2Vzc2VzKHRoaXMuX3BpZCk7XG5cdFx0XHR0aGlzLmhhc0NoaWxkUHJvY2Vzc2VzID0gdGhpcy5fcHJvY2Vzc0NvbnRhaW5zQ2hpbGRyZW4ocHJvY2Vzc0l0ZW0pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ0NoaWxkUHJvY2Vzc01vbml0b3I6IEZldGNoaW5nIHByb2Nlc3MgdHJlZSBmYWlsZWQnLCBlKTtcblx0XHR9XG5cdH1cblxuXHRAdGhyb3R0bGUoQ29uc3RhbnRzLkluYWN0aXZlVGhyb3R0bGVEdXJhdGlvbilcblx0cHJpdmF0ZSBfcmVmcmVzaEluYWN0aXZlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZnJlc2hBY3RpdmUoKTtcblx0fVxuXG5cdHByaXZhdGUgX3Byb2Nlc3NDb250YWluc0NoaWxkcmVuKHByb2Nlc3NJdGVtOiBQcm9jZXNzSXRlbSk6IGJvb2xlYW4ge1xuXHRcdC8vIE5vIGNoaWxkIHByb2Nlc3Nlc1xuXHRcdGlmICghcHJvY2Vzc0l0ZW0uY2hpbGRyZW4pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBBIHNpbmdsZSBjaGlsZCBwcm9jZXNzLCBoYW5kbGUgc3BlY2lhbCBjYXNlc1xuXHRcdGlmIChwcm9jZXNzSXRlbS5jaGlsZHJlbi5sZW5ndGggPT09IDEpIHtcblx0XHRcdGNvbnN0IGl0ZW0gPSBwcm9jZXNzSXRlbS5jaGlsZHJlblswXTtcblx0XHRcdGxldCBjbWQ6IHN0cmluZztcblx0XHRcdGlmIChpdGVtLmNtZC5zdGFydHNXaXRoKGBcImApKSB7XG5cdFx0XHRcdGNtZCA9IGl0ZW0uY21kLnN1YnN0cmluZygxLCBpdGVtLmNtZC5pbmRleE9mKGBcImAsIDEpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHNwYWNlSW5kZXggPSBpdGVtLmNtZC5pbmRleE9mKGAgYCk7XG5cdFx0XHRcdGlmIChzcGFjZUluZGV4ID09PSAtMSkge1xuXHRcdFx0XHRcdGNtZCA9IGl0ZW0uY21kO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNtZCA9IGl0ZW0uY21kLnN1YnN0cmluZygwLCBzcGFjZUluZGV4KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGlnbm9yZVByb2Nlc3NOYW1lcy5pbmRleE9mKHBhcnNlKGNtZCkubmFtZSkgPT09IC0xO1xuXHRcdH1cblxuXHRcdC8vIEZhbGxiYWNrLCBjb3VudCBjaGlsZCBwcm9jZXNzZXNcblx0XHRyZXR1cm4gcHJvY2Vzc0l0ZW0uY2hpbGRyZW4ubGVuZ3RoID4gMDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGFBQWE7QUFDdEIsU0FBUyxVQUFVLGdCQUFnQjtBQUNuQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxtQkFBbUI7QUFFNUIsSUFBVyxZQUFYLGtCQUFXQSxlQUFYO0FBSUMsRUFBQUEsc0JBQUEsOEJBQTJCLE9BQTNCO0FBSUEsRUFBQUEsc0JBQUEsNEJBQXlCLE9BQXpCO0FBUlUsU0FBQUE7QUFBQSxHQUFBO0FBV0osTUFBTSxxQkFBK0IsQ0FBQztBQU10QyxJQUFNLHNCQUFOLGNBQWtDLFdBQVc7QUFBQSxFQW9CbkQsWUFDa0IsTUFDYSxhQUM3QjtBQUNELFVBQU07QUFIVztBQUNhO0FBckIvQixTQUFRLHFCQUE4QjtBQWF0QyxTQUFpQixnQ0FBZ0MsS0FBSyxVQUFVLElBQUksUUFBaUIsQ0FBQztBQUl0RjtBQUFBO0FBQUE7QUFBQSxTQUFTLCtCQUErQixLQUFLLDhCQUE4QjtBQUFBLEVBTzNFO0FBQUEsRUF2QkEsSUFBWSxrQkFBa0IsT0FBZ0I7QUFDN0MsUUFBSSxLQUFLLHVCQUF1QixPQUFPO0FBQ3RDLFdBQUsscUJBQXFCO0FBQzFCLFdBQUssWUFBWSxNQUFNLG9EQUFvRCxLQUFLO0FBQ2hGLFdBQUssOEJBQThCLEtBQUssS0FBSztBQUFBLElBQzlDO0FBQUEsRUFDRDtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBSUEsSUFBSSxvQkFBNkI7QUFBRSxXQUFPLEtBQUs7QUFBQSxFQUFvQjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBa0JuRSxjQUFjO0FBQ2IsU0FBSyxlQUFlO0FBQUEsRUFDckI7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLGVBQWU7QUFDZCxTQUFLLGlCQUFpQjtBQUFBLEVBQ3ZCO0FBQUEsRUFHQSxNQUFjLGlCQUFnQztBQUM3QyxRQUFJLEtBQUssT0FBTyxZQUFZO0FBQzNCO0FBQUEsSUFDRDtBQUNBLFFBQUk7QUFDSCxZQUFNLGNBQWMsTUFBTSxjQUFjLEtBQUssSUFBSTtBQUNqRCxXQUFLLG9CQUFvQixLQUFLLHlCQUF5QixXQUFXO0FBQUEsSUFDbkUsU0FBUyxHQUFHO0FBQ1gsV0FBSyxZQUFZLE1BQU0scURBQXFELENBQUM7QUFBQSxJQUM5RTtBQUFBLEVBQ0Q7QUFBQSxFQUdRLG1CQUF5QjtBQUNoQyxTQUFLLGVBQWU7QUFBQSxFQUNyQjtBQUFBLEVBRVEseUJBQXlCLGFBQW1DO0FBRW5FLFFBQUksQ0FBQyxZQUFZLFVBQVU7QUFDMUIsYUFBTztBQUFBLElBQ1I7QUFHQSxRQUFJLFlBQVksU0FBUyxXQUFXLEdBQUc7QUFDdEMsWUFBTSxPQUFPLFlBQVksU0FBUyxDQUFDO0FBQ25DLFVBQUk7QUFDSixVQUFJLEtBQUssSUFBSSxXQUFXLEdBQUcsR0FBRztBQUM3QixjQUFNLEtBQUssSUFBSSxVQUFVLEdBQUcsS0FBSyxJQUFJLFFBQVEsS0FBSyxDQUFDLENBQUM7QUFBQSxNQUNyRCxPQUFPO0FBQ04sY0FBTSxhQUFhLEtBQUssSUFBSSxRQUFRLEdBQUc7QUFDdkMsWUFBSSxlQUFlLElBQUk7QUFDdEIsZ0JBQU0sS0FBSztBQUFBLFFBQ1osT0FBTztBQUNOLGdCQUFNLEtBQUssSUFBSSxVQUFVLEdBQUcsVUFBVTtBQUFBLFFBQ3ZDO0FBQUEsTUFDRDtBQUNBLGFBQU8sbUJBQW1CLFFBQVEsTUFBTSxHQUFHLEVBQUUsSUFBSSxNQUFNO0FBQUEsSUFDeEQ7QUFHQSxXQUFPLFlBQVksU0FBUyxTQUFTO0FBQUEsRUFDdEM7QUFDRDtBQTNDZTtBQUFBLEVBRGIsU0FBUyxnQ0FBZ0M7QUFBQSxHQXpDOUIsb0JBMENFO0FBYU47QUFBQSxFQURQLFNBQVMsa0NBQWtDO0FBQUEsR0F0RGhDLG9CQXVESjtBQXZESSxzQkFBTjtBQUFBLEVBc0JKO0FBQUEsR0F0QlU7IiwKICAibmFtZXMiOiBbIkNvbnN0YW50cyJdCn0K
