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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ITerminalLogService, TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
let BufferContentTracker = class extends Disposable {
  constructor(_xterm, _configurationService, _logService) {
    super();
    this._xterm = _xterm;
    this._configurationService = _configurationService;
    this._logService = _logService;
    /**
     * The number of wrapped lines in the viewport when the last cached marker was set
     */
    this._priorEditorViewportLineCount = 0;
    this._lines = [];
    this.bufferToEditorLineMapping = /* @__PURE__ */ new Map();
  }
  get lines() {
    return this._lines;
  }
  reset() {
    this._lines = [];
    this._lastCachedMarker = void 0;
    this.update();
  }
  update() {
    if (this._lastCachedMarker?.isDisposed) {
      this._lines = [];
      this._lastCachedMarker = void 0;
    }
    this._removeViewportContent();
    this._updateCachedContent();
    this._updateViewportContent();
    this._lastCachedMarker = this._register(this._xterm.raw.registerMarker());
    this._logService.debug("Buffer content tracker: set ", this._lines.length, " lines");
  }
  _updateCachedContent() {
    const buffer = this._xterm.raw.buffer.active;
    const start = this._lastCachedMarker?.line ? this._lastCachedMarker.line - this._xterm.raw.rows + 1 : 0;
    const end = buffer.baseY;
    if (start < 0 || start > end) {
      return;
    }
    const scrollback = this._configurationService.getValue(TerminalSettingId.Scrollback);
    const maxBufferSize = scrollback + this._xterm.raw.rows - 1;
    const linesToAdd = end - start;
    if (linesToAdd + this._lines.length > maxBufferSize) {
      const numToRemove = linesToAdd + this._lines.length - maxBufferSize;
      for (let i = 0; i < numToRemove; i++) {
        this._lines.shift();
      }
      this._logService.debug("Buffer content tracker: removed ", numToRemove, " lines from top of cached lines, now ", this._lines.length, " lines");
    }
    const cachedLines = [];
    let currentLine = "";
    for (let i = start; i < end; i++) {
      const line = buffer.getLine(i);
      if (!line) {
        continue;
      }
      this.bufferToEditorLineMapping.set(i, this._lines.length + cachedLines.length);
      const isWrapped = buffer.getLine(i + 1)?.isWrapped;
      currentLine += line.translateToString(!isWrapped);
      if (currentLine && !isWrapped || i === buffer.baseY + this._xterm.raw.rows - 1) {
        if (line.length) {
          cachedLines.push(currentLine);
          currentLine = "";
        }
      }
    }
    this._logService.debug("Buffer content tracker:", cachedLines.length, " lines cached");
    this._lines.push(...cachedLines);
  }
  _removeViewportContent() {
    if (!this._lines.length) {
      return;
    }
    let linesToRemove = this._priorEditorViewportLineCount;
    let index = 1;
    while (linesToRemove) {
      this.bufferToEditorLineMapping.forEach((value, key) => {
        if (value === this._lines.length - index) {
          this.bufferToEditorLineMapping.delete(key);
        }
      });
      this._lines.pop();
      index++;
      linesToRemove--;
    }
    this._logService.debug("Buffer content tracker: removed lines from viewport, now ", this._lines.length, " lines cached");
  }
  _updateViewportContent() {
    const buffer = this._xterm.raw.buffer.active;
    this._priorEditorViewportLineCount = 0;
    let currentLine = "";
    for (let i = buffer.baseY; i < buffer.baseY + this._xterm.raw.rows; i++) {
      const line = buffer.getLine(i);
      if (!line) {
        continue;
      }
      this.bufferToEditorLineMapping.set(i, this._lines.length);
      const isWrapped = buffer.getLine(i + 1)?.isWrapped;
      currentLine += line.translateToString(!isWrapped);
      if (currentLine && !isWrapped || i === buffer.baseY + this._xterm.raw.rows - 1) {
        if (currentLine.length) {
          this._priorEditorViewportLineCount++;
          this._lines.push(currentLine);
          currentLine = "";
        }
      }
    }
    this._logService.debug("Viewport content update complete, ", this._lines.length, " lines in the viewport");
  }
};
BufferContentTracker = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ITerminalLogService)
], BufferContentTracker);
export {
  BufferContentTracker
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvYWNjZXNzaWJpbGl0eS9icm93c2VyL2J1ZmZlckNvbnRlbnRUcmFja2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbExvZ1NlcnZpY2UsIFRlcm1pbmFsU2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElYdGVybVRlcm1pbmFsIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgdHlwZSB7IElNYXJrZXIsIFRlcm1pbmFsIH0gZnJvbSAnQHh0ZXJtL3h0ZXJtJztcblxuZXhwb3J0IGNsYXNzIEJ1ZmZlckNvbnRlbnRUcmFja2VyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdC8qKlxuXHQgKiBNYXJrcyB0aGUgbGFzdCBwYXJ0IG9mIHRoZSBidWZmZXIgdGhhdCB3YXMgY2FjaGVkXG5cdCAqL1xuXHRwcml2YXRlIF9sYXN0Q2FjaGVkTWFya2VyOiBJTWFya2VyIHwgdW5kZWZpbmVkO1xuXHQvKipcblx0ICogVGhlIG51bWJlciBvZiB3cmFwcGVkIGxpbmVzIGluIHRoZSB2aWV3cG9ydCB3aGVuIHRoZSBsYXN0IGNhY2hlZCBtYXJrZXIgd2FzIHNldFxuXHQgKi9cblx0cHJpdmF0ZSBfcHJpb3JFZGl0b3JWaWV3cG9ydExpbmVDb3VudDogbnVtYmVyID0gMDtcblxuXHRwcml2YXRlIF9saW5lczogc3RyaW5nW10gPSBbXTtcblx0Z2V0IGxpbmVzKCk6IHN0cmluZ1tdIHsgcmV0dXJuIHRoaXMuX2xpbmVzOyB9XG5cblx0YnVmZmVyVG9FZGl0b3JMaW5lTWFwcGluZzogTWFwPG51bWJlciwgbnVtYmVyPiA9IG5ldyBNYXAoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF94dGVybTogUGljazxJWHRlcm1UZXJtaW5hbCwgJ2dldEZvbnQnPiAmIHsgcmF3OiBUZXJtaW5hbCB9LFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVRlcm1pbmFsTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJVGVybWluYWxMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cmVzZXQoKTogdm9pZCB7XG5cdFx0dGhpcy5fbGluZXMgPSBbXTtcblx0XHR0aGlzLl9sYXN0Q2FjaGVkTWFya2VyID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHR1cGRhdGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2xhc3RDYWNoZWRNYXJrZXI/LmlzRGlzcG9zZWQpIHtcblx0XHRcdC8vIHRoZSB0ZXJtaW5hbCB3YXMgY2xlYXJlZCwgcmVzZXQgdGhlIGNhY2hlXG5cdFx0XHR0aGlzLl9saW5lcyA9IFtdO1xuXHRcdFx0dGhpcy5fbGFzdENhY2hlZE1hcmtlciA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0dGhpcy5fcmVtb3ZlVmlld3BvcnRDb250ZW50KCk7XG5cdFx0dGhpcy5fdXBkYXRlQ2FjaGVkQ29udGVudCgpO1xuXHRcdHRoaXMuX3VwZGF0ZVZpZXdwb3J0Q29udGVudCgpO1xuXHRcdHRoaXMuX2xhc3RDYWNoZWRNYXJrZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl94dGVybS5yYXcucmVnaXN0ZXJNYXJrZXIoKSk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnQnVmZmVyIGNvbnRlbnQgdHJhY2tlcjogc2V0ICcsIHRoaXMuX2xpbmVzLmxlbmd0aCwgJyBsaW5lcycpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlQ2FjaGVkQ29udGVudCgpOiB2b2lkIHtcblx0XHRjb25zdCBidWZmZXIgPSB0aGlzLl94dGVybS5yYXcuYnVmZmVyLmFjdGl2ZTtcblx0XHRjb25zdCBzdGFydCA9IHRoaXMuX2xhc3RDYWNoZWRNYXJrZXI/LmxpbmUgPyB0aGlzLl9sYXN0Q2FjaGVkTWFya2VyLmxpbmUgLSB0aGlzLl94dGVybS5yYXcucm93cyArIDEgOiAwO1xuXHRcdGNvbnN0IGVuZCA9IGJ1ZmZlci5iYXNlWTtcblx0XHRpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID4gZW5kKSB7XG5cdFx0XHQvLyBpbiB0aGUgdmlld3BvcnQsIG5vIG5lZWQgdG8gY2FjaGVcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyB0byBrZWVwIHRoZSBjYWNoZSBzaXplIGRvd24sIHJlbW92ZSBhbnkgbGluZXMgdGhhdCBhcmUgbm8gbG9uZ2VyIGluIHRoZSBzY3JvbGxiYWNrXG5cdFx0Y29uc3Qgc2Nyb2xsYmFjazogbnVtYmVyID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGVybWluYWxTZXR0aW5nSWQuU2Nyb2xsYmFjayk7XG5cdFx0Y29uc3QgbWF4QnVmZmVyU2l6ZSA9IHNjcm9sbGJhY2sgKyB0aGlzLl94dGVybS5yYXcucm93cyAtIDE7XG5cdFx0Y29uc3QgbGluZXNUb0FkZCA9IGVuZCAtIHN0YXJ0O1xuXHRcdGlmIChsaW5lc1RvQWRkICsgdGhpcy5fbGluZXMubGVuZ3RoID4gbWF4QnVmZmVyU2l6ZSkge1xuXHRcdFx0Y29uc3QgbnVtVG9SZW1vdmUgPSBsaW5lc1RvQWRkICsgdGhpcy5fbGluZXMubGVuZ3RoIC0gbWF4QnVmZmVyU2l6ZTtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbnVtVG9SZW1vdmU7IGkrKykge1xuXHRcdFx0XHR0aGlzLl9saW5lcy5zaGlmdCgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnQnVmZmVyIGNvbnRlbnQgdHJhY2tlcjogcmVtb3ZlZCAnLCBudW1Ub1JlbW92ZSwgJyBsaW5lcyBmcm9tIHRvcCBvZiBjYWNoZWQgbGluZXMsIG5vdyAnLCB0aGlzLl9saW5lcy5sZW5ndGgsICcgbGluZXMnKTtcblx0XHR9XG5cblx0XHQvLyBpdGVyYXRlIHRocm91Z2ggdGhlIGJ1ZmZlciBsaW5lcyBhbmQgYWRkIHRoZW0gdG8gdGhlIGVkaXRvciBsaW5lIGNhY2hlXG5cdFx0Y29uc3QgY2FjaGVkTGluZXMgPSBbXTtcblx0XHRsZXQgY3VycmVudExpbmU6IHN0cmluZyA9ICcnO1xuXHRcdGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG5cdFx0XHRjb25zdCBsaW5lID0gYnVmZmVyLmdldExpbmUoaSk7XG5cdFx0XHRpZiAoIWxpbmUpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmJ1ZmZlclRvRWRpdG9yTGluZU1hcHBpbmcuc2V0KGksIHRoaXMuX2xpbmVzLmxlbmd0aCArIGNhY2hlZExpbmVzLmxlbmd0aCk7XG5cdFx0XHRjb25zdCBpc1dyYXBwZWQgPSBidWZmZXIuZ2V0TGluZShpICsgMSk/LmlzV3JhcHBlZDtcblx0XHRcdGN1cnJlbnRMaW5lICs9IGxpbmUudHJhbnNsYXRlVG9TdHJpbmcoIWlzV3JhcHBlZCk7XG5cdFx0XHRpZiAoY3VycmVudExpbmUgJiYgIWlzV3JhcHBlZCB8fCBpID09PSAoYnVmZmVyLmJhc2VZICsgdGhpcy5feHRlcm0ucmF3LnJvd3MgLSAxKSkge1xuXHRcdFx0XHRpZiAobGluZS5sZW5ndGgpIHtcblx0XHRcdFx0XHRjYWNoZWRMaW5lcy5wdXNoKGN1cnJlbnRMaW5lKTtcblx0XHRcdFx0XHRjdXJyZW50TGluZSA9ICcnO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ0J1ZmZlciBjb250ZW50IHRyYWNrZXI6JywgY2FjaGVkTGluZXMubGVuZ3RoLCAnIGxpbmVzIGNhY2hlZCcpO1xuXHRcdHRoaXMuX2xpbmVzLnB1c2goLi4uY2FjaGVkTGluZXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVtb3ZlVmlld3BvcnRDb250ZW50KCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fbGluZXMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIHJlbW92ZSBwcmV2aW91cyB2aWV3cG9ydCBjb250ZW50IGluIGNhc2UgaXQgaGFzIGNoYW5nZWRcblx0XHRsZXQgbGluZXNUb1JlbW92ZSA9IHRoaXMuX3ByaW9yRWRpdG9yVmlld3BvcnRMaW5lQ291bnQ7XG5cdFx0bGV0IGluZGV4ID0gMTtcblx0XHR3aGlsZSAobGluZXNUb1JlbW92ZSkge1xuXHRcdFx0dGhpcy5idWZmZXJUb0VkaXRvckxpbmVNYXBwaW5nLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHsgaWYgKHZhbHVlID09PSB0aGlzLl9saW5lcy5sZW5ndGggLSBpbmRleCkgeyB0aGlzLmJ1ZmZlclRvRWRpdG9yTGluZU1hcHBpbmcuZGVsZXRlKGtleSk7IH0gfSk7XG5cdFx0XHR0aGlzLl9saW5lcy5wb3AoKTtcblx0XHRcdGluZGV4Kys7XG5cdFx0XHRsaW5lc1RvUmVtb3ZlLS07XG5cdFx0fVxuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ0J1ZmZlciBjb250ZW50IHRyYWNrZXI6IHJlbW92ZWQgbGluZXMgZnJvbSB2aWV3cG9ydCwgbm93ICcsIHRoaXMuX2xpbmVzLmxlbmd0aCwgJyBsaW5lcyBjYWNoZWQnKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZVZpZXdwb3J0Q29udGVudCgpOiB2b2lkIHtcblx0XHRjb25zdCBidWZmZXIgPSB0aGlzLl94dGVybS5yYXcuYnVmZmVyLmFjdGl2ZTtcblx0XHR0aGlzLl9wcmlvckVkaXRvclZpZXdwb3J0TGluZUNvdW50ID0gMDtcblx0XHRsZXQgY3VycmVudExpbmU6IHN0cmluZyA9ICcnO1xuXHRcdGZvciAobGV0IGkgPSBidWZmZXIuYmFzZVk7IGkgPCBidWZmZXIuYmFzZVkgKyB0aGlzLl94dGVybS5yYXcucm93czsgaSsrKSB7XG5cdFx0XHRjb25zdCBsaW5lID0gYnVmZmVyLmdldExpbmUoaSk7XG5cdFx0XHRpZiAoIWxpbmUpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmJ1ZmZlclRvRWRpdG9yTGluZU1hcHBpbmcuc2V0KGksIHRoaXMuX2xpbmVzLmxlbmd0aCk7XG5cdFx0XHRjb25zdCBpc1dyYXBwZWQgPSBidWZmZXIuZ2V0TGluZShpICsgMSk/LmlzV3JhcHBlZDtcblx0XHRcdGN1cnJlbnRMaW5lICs9IGxpbmUudHJhbnNsYXRlVG9TdHJpbmcoIWlzV3JhcHBlZCk7XG5cdFx0XHRpZiAoY3VycmVudExpbmUgJiYgIWlzV3JhcHBlZCB8fCBpID09PSAoYnVmZmVyLmJhc2VZICsgdGhpcy5feHRlcm0ucmF3LnJvd3MgLSAxKSkge1xuXHRcdFx0XHRpZiAoY3VycmVudExpbmUubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dGhpcy5fcHJpb3JFZGl0b3JWaWV3cG9ydExpbmVDb3VudCsrO1xuXHRcdFx0XHRcdHRoaXMuX2xpbmVzLnB1c2goY3VycmVudExpbmUpO1xuXHRcdFx0XHRcdGN1cnJlbnRMaW5lID0gJyc7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnVmlld3BvcnQgY29udGVudCB1cGRhdGUgY29tcGxldGUsICcsIHRoaXMuX2xpbmVzLmxlbmd0aCwgJyBsaW5lcyBpbiB0aGUgdmlld3BvcnQnKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHFCQUFxQix5QkFBeUI7QUFJaEQsSUFBTSx1QkFBTixjQUFtQyxXQUFXO0FBQUEsRUFlcEQsWUFDa0IsUUFDdUIsdUJBQ0YsYUFDckM7QUFDRCxVQUFNO0FBSlc7QUFDdUI7QUFDRjtBQVZ2QztBQUFBO0FBQUE7QUFBQSxTQUFRLGdDQUF3QztBQUVoRCxTQUFRLFNBQW1CLENBQUM7QUFHNUIscUNBQWlELG9CQUFJLElBQUk7QUFBQSxFQVF6RDtBQUFBLEVBVkEsSUFBSSxRQUFrQjtBQUFFLFdBQU8sS0FBSztBQUFBLEVBQVE7QUFBQSxFQVk1QyxRQUFjO0FBQ2IsU0FBSyxTQUFTLENBQUM7QUFDZixTQUFLLG9CQUFvQjtBQUN6QixTQUFLLE9BQU87QUFBQSxFQUNiO0FBQUEsRUFFQSxTQUFlO0FBQ2QsUUFBSSxLQUFLLG1CQUFtQixZQUFZO0FBRXZDLFdBQUssU0FBUyxDQUFDO0FBQ2YsV0FBSyxvQkFBb0I7QUFBQSxJQUMxQjtBQUNBLFNBQUssdUJBQXVCO0FBQzVCLFNBQUsscUJBQXFCO0FBQzFCLFNBQUssdUJBQXVCO0FBQzVCLFNBQUssb0JBQW9CLEtBQUssVUFBVSxLQUFLLE9BQU8sSUFBSSxl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
