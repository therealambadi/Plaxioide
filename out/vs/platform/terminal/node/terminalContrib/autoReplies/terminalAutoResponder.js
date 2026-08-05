import { timeout } from "../../../../../base/common/async.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { isWindows } from "../../../../../base/common/platform.js";
class TerminalAutoResponder extends Disposable {
  constructor(proc, matchWord, response, logService) {
    super();
    this._pointer = 0;
    this._paused = false;
    /**
     * Each reply is throttled by a second to avoid resource starvation and responding to screen
     * reprints on Winodws.
     */
    this._throttled = false;
    this._register(proc.onProcessData((e) => {
      if (this._paused || this._throttled) {
        return;
      }
      const data = typeof e === "string" ? e : e.data;
      for (let i = 0; i < data.length; i++) {
        if (data[i] === matchWord[this._pointer]) {
          this._pointer++;
        } else {
          this._reset();
        }
        if (this._pointer === matchWord.length) {
          logService.debug(`Auto reply match: "${matchWord}", response: "${response}"`);
          proc.input(response);
          this._throttled = true;
          timeout(1e3).then(() => this._throttled = false);
          this._reset();
        }
      }
    }));
  }
  _reset() {
    this._pointer = 0;
  }
  /**
   * No auto response will happen after a resize on Windows in case the resize is a result of
   * reprinting the screen.
   */
  handleResize() {
    if (isWindows) {
      this._paused = true;
    }
  }
  handleInput() {
    this._paused = false;
  }
}
export {
  TerminalAutoResponder
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC9ub2RlL3Rlcm1pbmFsQ29udHJpYi9hdXRvUmVwbGllcy90ZXJtaW5hbEF1dG9SZXNwb25kZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbENoaWxkUHJvY2VzcyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5cbi8qKlxuICogVHJhY2tzIGEgdGVybWluYWwgcHJvY2VzcydzIGRhdGEgc3RyZWFtIGFuZCByZXNwb25kcyBpbW1lZGlhdGVseSB3aGVuIGEgbWF0Y2hpbmcgc3RyaW5nIGlzXG4gKiByZWNlaXZlZC4gVGhpcyBpcyBkb25lIGluIGEgbG93IG92ZXJoZWFkIHdheSBhbmQgaXMgaWRlYWxseSBydW4gb24gdGhlIHNhbWUgcHJvY2VzcyBhcyB0aGVcbiAqIHdoZXJlIHRoZSBwcm9jZXNzIGlzIGhhbmRsZWQgdG8gbWluaW1pemUgbGF0ZW5jeS5cbiAqL1xuZXhwb3J0IGNsYXNzIFRlcm1pbmFsQXV0b1Jlc3BvbmRlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIF9wb2ludGVyID0gMDtcblx0cHJpdmF0ZSBfcGF1c2VkID0gZmFsc2U7XG5cblx0LyoqXG5cdCAqIEVhY2ggcmVwbHkgaXMgdGhyb3R0bGVkIGJ5IGEgc2Vjb25kIHRvIGF2b2lkIHJlc291cmNlIHN0YXJ2YXRpb24gYW5kIHJlc3BvbmRpbmcgdG8gc2NyZWVuXG5cdCAqIHJlcHJpbnRzIG9uIFdpbm9kd3MuXG5cdCAqL1xuXHRwcml2YXRlIF90aHJvdHRsZWQgPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm9jOiBJVGVybWluYWxDaGlsZFByb2Nlc3MsXG5cdFx0bWF0Y2hXb3JkOiBzdHJpbmcsXG5cdFx0cmVzcG9uc2U6IHN0cmluZyxcblx0XHRsb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIocHJvYy5vblByb2Nlc3NEYXRhKGUgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX3BhdXNlZCB8fCB0aGlzLl90aHJvdHRsZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZGF0YSA9IHR5cGVvZiBlID09PSAnc3RyaW5nJyA/IGUgOiBlLmRhdGE7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKGRhdGFbaV0gPT09IG1hdGNoV29yZFt0aGlzLl9wb2ludGVyXSkge1xuXHRcdFx0XHRcdHRoaXMuX3BvaW50ZXIrKztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLl9yZXNldCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIEF1dG8gcmVwbHkgYW5kIHJlc2V0XG5cdFx0XHRcdGlmICh0aGlzLl9wb2ludGVyID09PSBtYXRjaFdvcmQubGVuZ3RoKSB7XG5cdFx0XHRcdFx0bG9nU2VydmljZS5kZWJ1ZyhgQXV0byByZXBseSBtYXRjaDogXCIke21hdGNoV29yZH1cIiwgcmVzcG9uc2U6IFwiJHtyZXNwb25zZX1cImApO1xuXHRcdFx0XHRcdHByb2MuaW5wdXQocmVzcG9uc2UpO1xuXHRcdFx0XHRcdHRoaXMuX3Rocm90dGxlZCA9IHRydWU7XG5cdFx0XHRcdFx0dGltZW91dCgxMDAwKS50aGVuKCgpID0+IHRoaXMuX3Rocm90dGxlZCA9IGZhbHNlKTtcblx0XHRcdFx0XHR0aGlzLl9yZXNldCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVzZXQoKSB7XG5cdFx0dGhpcy5fcG9pbnRlciA9IDA7XG5cdH1cblxuXHQvKipcblx0ICogTm8gYXV0byByZXNwb25zZSB3aWxsIGhhcHBlbiBhZnRlciBhIHJlc2l6ZSBvbiBXaW5kb3dzIGluIGNhc2UgdGhlIHJlc2l6ZSBpcyBhIHJlc3VsdCBvZlxuXHQgKiByZXByaW50aW5nIHRoZSBzY3JlZW4uXG5cdCAqL1xuXHRoYW5kbGVSZXNpemUoKSB7XG5cdFx0aWYgKGlzV2luZG93cykge1xuXHRcdFx0dGhpcy5fcGF1c2VkID0gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRoYW5kbGVJbnB1dCgpIHtcblx0XHR0aGlzLl9wYXVzZWQgPSBmYWxzZTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsaUJBQWlCO0FBU25CLE1BQU0sOEJBQThCLFdBQVc7QUFBQSxFQVVyRCxZQUNDLE1BQ0EsV0FDQSxVQUNBLFlBQ0M7QUFDRCxVQUFNO0FBZlAsU0FBUSxXQUFXO0FBQ25CLFNBQVEsVUFBVTtBQU1sQjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBQVEsYUFBYTtBQVVwQixTQUFLLFVBQVUsS0FBSyxjQUFjLE9BQUs7QUFDdEMsVUFBSSxLQUFLLFdBQVcsS0FBSyxZQUFZO0FBQ3BDO0FBQUEsTUFDRDtBQUNBLFlBQU0sT0FBTyxPQUFPLE1BQU0sV0FBVyxJQUFJLEVBQUU7QUFDM0MsZUFBUyxJQUFJLEdBQUcsSUFBSSxLQUFLLFFBQVEsS0FBSztBQUNyQyxZQUFJLEtBQUssQ0FBQyxNQUFNLFVBQVUsS0FBSyxRQUFRLEdBQUc7QUFDekMsZUFBSztBQUFBLFFBQ04sT0FBTztBQUNOLGVBQUssT0FBTztBQUFBLFFBQ2I7QUFFQSxZQUFJLEtBQUssYUFBYSxVQUFVLFFBQVE7QUFDdkMscUJBQVcsTUFBTSxzQkFBc0IsU0FBUyxpQkFBaUIsUUFBUSxHQUFHO0FBQzVFLGVBQUssTUFBTSxRQUFRO0FBQ25CLGVBQUssYUFBYTtBQUNsQixrQkFBUSxHQUFJLEVBQUUsS0FBSyxNQUFNLEtBQUssYUFBYSxLQUFLO0FBQ2hELGVBQUssT0FBTztBQUFBLFFBQ2I7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUSxTQUFTO0FBQ2hCLFNBQUssV0FBVztBQUFBLEVBQ2pCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLGVBQWU7QUFDZCxRQUFJLFdBQVc7QUFDZCxXQUFLLFVBQVU7QUFBQSxJQUNoQjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLGNBQWM7QUFDYixTQUFLLFVBQVU7QUFBQSxFQUNoQjtBQUNEOyIsCiAgIm5hbWVzIjogW10KfQo=
