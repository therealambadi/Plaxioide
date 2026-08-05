import { protocol } from "electron";
import { Disposable } from "../../../base/common/lifecycle.js";
import { COI, FileAccess, Schemas } from "../../../base/common/network.js";
import { URI } from "../../../base/common/uri.js";
const _WebviewProtocolProvider = class _WebviewProtocolProvider extends Disposable {
  constructor() {
    super();
    const webviewHandler = this.handleWebviewRequest.bind(this);
    protocol.registerFileProtocol(Schemas.vscodeWebview, webviewHandler);
  }
  handleWebviewRequest(request, callback) {
    try {
      const uri = URI.parse(request.url);
      const entry = _WebviewProtocolProvider.validWebviewFilePaths.get(uri.path);
      if (typeof entry === "string") {
        const relativeResourcePath = `vs/workbench/contrib/webview/browser/pre/${entry}`;
        const url = FileAccess.asFileUri(relativeResourcePath);
        return callback({
          path: url.fsPath,
          headers: {
            ...COI.getHeadersFromQuery(request.url),
            "Cross-Origin-Resource-Policy": "cross-origin"
          }
        });
      } else {
        return callback({
          error: -10
          /* ACCESS_DENIED - https://cs.chromium.org/chromium/src/net/base/net_error_list.h?l=32 */
        });
      }
    } catch {
    }
    return callback({
      error: -2
      /* FAILED - https://cs.chromium.org/chromium/src/net/base/net_error_list.h?l=32 */
    });
  }
};
_WebviewProtocolProvider.validWebviewFilePaths = /* @__PURE__ */ new Map([
  ["/index.html", "index.html"],
  ["/fake.html", "fake.html"],
  ["/service-worker.js", "service-worker.js"]
]);
let WebviewProtocolProvider = _WebviewProtocolProvider;
export {
  WebviewProtocolProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS93ZWJ2aWV3L2VsZWN0cm9uLW1haW4vd2Vidmlld1Byb3RvY29sUHJvdmlkZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBwcm90b2NvbCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgQXBwUmVzb3VyY2VQYXRoLCBDT0ksIEZpbGVBY2Nlc3MsIFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5cblxuZXhwb3J0IGNsYXNzIFdlYnZpZXdQcm90b2NvbFByb3ZpZGVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgdmFsaWRXZWJ2aWV3RmlsZVBhdGhzID0gbmV3IE1hcChbXG5cdFx0WycvaW5kZXguaHRtbCcsICdpbmRleC5odG1sJ10sXG5cdFx0WycvZmFrZS5odG1sJywgJ2Zha2UuaHRtbCddLFxuXHRcdFsnL3NlcnZpY2Utd29ya2VyLmpzJywgJ3NlcnZpY2Utd29ya2VyLmpzJ10sXG5cdF0pO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHQvLyBSZWdpc3RlciB0aGUgcHJvdG9jb2wgZm9yIGxvYWRpbmcgd2VidmlldyBodG1sXG5cdFx0Y29uc3Qgd2Vidmlld0hhbmRsZXIgPSB0aGlzLmhhbmRsZVdlYnZpZXdSZXF1ZXN0LmJpbmQodGhpcyk7XG5cdFx0cHJvdG9jb2wucmVnaXN0ZXJGaWxlUHJvdG9jb2woU2NoZW1hcy52c2NvZGVXZWJ2aWV3LCB3ZWJ2aWV3SGFuZGxlcik7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZVdlYnZpZXdSZXF1ZXN0KFxuXHRcdHJlcXVlc3Q6IEVsZWN0cm9uLlByb3RvY29sUmVxdWVzdCxcblx0XHRjYWxsYmFjazogKHJlc3BvbnNlOiBzdHJpbmcgfCBFbGVjdHJvbi5Qcm90b2NvbFJlc3BvbnNlKSA9PiB2b2lkXG5cdCkge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCB1cmkgPSBVUkkucGFyc2UocmVxdWVzdC51cmwpO1xuXHRcdFx0Y29uc3QgZW50cnkgPSBXZWJ2aWV3UHJvdG9jb2xQcm92aWRlci52YWxpZFdlYnZpZXdGaWxlUGF0aHMuZ2V0KHVyaS5wYXRoKTtcblx0XHRcdGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGNvbnN0IHJlbGF0aXZlUmVzb3VyY2VQYXRoOiBBcHBSZXNvdXJjZVBhdGggPSBgdnMvd29ya2JlbmNoL2NvbnRyaWIvd2Vidmlldy9icm93c2VyL3ByZS8ke2VudHJ5fWA7XG5cdFx0XHRcdGNvbnN0IHVybCA9IEZpbGVBY2Nlc3MuYXNGaWxlVXJpKHJlbGF0aXZlUmVzb3VyY2VQYXRoKTtcblx0XHRcdFx0cmV0dXJuIGNhbGxiYWNrKHtcblx0XHRcdFx0XHRwYXRoOiB1cmwuZnNQYXRoLFxuXHRcdFx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0XHRcdC4uLkNPSS5nZXRIZWFkZXJzRnJvbVF1ZXJ5KHJlcXVlc3QudXJsKSxcblx0XHRcdFx0XHRcdCdDcm9zcy1PcmlnaW4tUmVzb3VyY2UtUG9saWN5JzogJ2Nyb3NzLW9yaWdpbidcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIGNhbGxiYWNrKHsgZXJyb3I6IC0xMCAvKiBBQ0NFU1NfREVOSUVEIC0gaHR0cHM6Ly9jcy5jaHJvbWl1bS5vcmcvY2hyb21pdW0vc3JjL25ldC9iYXNlL25ldF9lcnJvcl9saXN0Lmg/bD0zMiAqLyB9KTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIHtcblx0XHRcdC8vIG5vb3Bcblx0XHR9XG5cdFx0cmV0dXJuIGNhbGxiYWNrKHsgZXJyb3I6IC0yIC8qIEZBSUxFRCAtIGh0dHBzOi8vY3MuY2hyb21pdW0ub3JnL2Nocm9taXVtL3NyYy9uZXQvYmFzZS9uZXRfZXJyb3JfbGlzdC5oP2w9MzIgKi8gfSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQTBCLEtBQUssWUFBWSxlQUFlO0FBQzFELFNBQVMsV0FBVztBQUdiLE1BQU0sMkJBQU4sTUFBTSxpQ0FBZ0MsV0FBVztBQUFBLEVBUXZELGNBQWM7QUFDYixVQUFNO0FBR04sVUFBTSxpQkFBaUIsS0FBSyxxQkFBcUIsS0FBSyxJQUFJO0FBQzFELGFBQVMscUJBQXFCLFFBQVEsZUFBZSxjQUFjO0FBQUEsRUFDcEU7QUFBQSxFQUVRLHFCQUNQLFNBQ0EsVUFDQztBQUNELFFBQUk7QUFDSCxZQUFNLE1BQU0sSUFBSSxNQUFNLFFBQVEsR0FBRztBQUNqQyxZQUFNLFFBQVEseUJBQXdCLHNCQUFzQixJQUFJLElBQUksSUFBSTtBQUN4RSxVQUFJLE9BQU8sVUFBVSxVQUFVO0FBQzlCLGNBQU0sdUJBQXdDLDRDQUE0QyxLQUFLO0FBQy9GLGNBQU0sTUFBTSxXQUFXLFVBQVUsb0JBQW9CO0FBQ3JELGVBQU8sU0FBUztBQUFBLFVBQ2YsTUFBTSxJQUFJO0FBQUEsVUFDVixTQUFTO0FBQUEsWUFDUixHQUFHLElBQUksb0JBQW9CLFFBQVEsR0FBRztBQUFBLFlBQ3RDLGdDQUFnQztBQUFBLFVBQ2pDO0FBQUEsUUFDRCxDQUFDO0FBQUEsTUFDRixPQUFPO0FBQ04sZUFBTyxTQUFTO0FBQUEsVUFBRSxPQUFPO0FBQUE7QUFBQSxRQUE4RixDQUFDO0FBQUEsTUFDekg7QUFBQSxJQUNELFFBQVE7QUFBQSxJQUVSO0FBQ0EsV0FBTyxTQUFTO0FBQUEsTUFBRSxPQUFPO0FBQUE7QUFBQSxJQUFzRixDQUFDO0FBQUEsRUFDakg7QUFDRDtBQXpDYSx5QkFFRyx3QkFBd0Isb0JBQUksSUFBSTtBQUFBLEVBQzlDLENBQUMsZUFBZSxZQUFZO0FBQUEsRUFDNUIsQ0FBQyxjQUFjLFdBQVc7QUFBQSxFQUMxQixDQUFDLHNCQUFzQixtQkFBbUI7QUFDM0MsQ0FBQztBQU5LLElBQU0sMEJBQU47IiwKICAibmFtZXMiOiBbXQp9Cg==
