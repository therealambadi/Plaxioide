import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { removeAnsiEscapeCodes } from "../../../../base/common/strings.js";
const _UrlFinder = class _UrlFinder extends Disposable {
  constructor(terminalService, debugService) {
    super();
    this._onDidMatchLocalUrl = new Emitter();
    this.onDidMatchLocalUrl = this._onDidMatchLocalUrl.event;
    this.listeners = /* @__PURE__ */ new Map();
    this.replPositions = /* @__PURE__ */ new Map();
    terminalService.instances.forEach((instance) => {
      this.registerTerminalInstance(instance);
    });
    this._register(terminalService.onDidCreateInstance((instance) => {
      this.registerTerminalInstance(instance);
    }));
    this._register(terminalService.onDidDisposeInstance((instance) => {
      this.listeners.get(instance)?.dispose();
      this.listeners.delete(instance);
    }));
    this._register(debugService.onDidNewSession((session) => {
      if (!session.parentSession || session.parentSession && session.hasSeparateRepl()) {
        this.listeners.set(session.getId(), session.onDidChangeReplElements(() => {
          this.processNewReplElements(session);
        }));
      }
    }));
    this._register(debugService.onDidEndSession(({ session }) => {
      if (this.listeners.has(session.getId())) {
        this.listeners.get(session.getId())?.dispose();
        this.listeners.delete(session.getId());
      }
    }));
  }
  registerTerminalInstance(instance) {
    if (!_UrlFinder.excludeTerminals.includes(instance.title)) {
      this.listeners.set(instance, instance.onData((data) => {
        this.processData(data);
      }));
    }
  }
  processNewReplElements(session) {
    const oldReplPosition = this.replPositions.get(session.getId());
    const replElements = session.getReplElements();
    this.replPositions.set(session.getId(), { position: replElements.length - 1, tail: replElements[replElements.length - 1] });
    if (!oldReplPosition && replElements.length > 0) {
      replElements.forEach((element) => this.processData(element.toString()));
    } else if (oldReplPosition && replElements.length - 1 !== oldReplPosition.position) {
      for (let i = replElements.length - 1; i >= 0; i--) {
        const element = replElements[i];
        if (element === oldReplPosition.tail) {
          break;
        } else {
          this.processData(element.toString());
        }
      }
    }
  }
  dispose() {
    super.dispose();
    const listeners = this.listeners.values();
    for (const listener of listeners) {
      listener.dispose();
    }
  }
  processData(data) {
    data = removeAnsiEscapeCodes(data);
    const urlMatches = data.match(_UrlFinder.localUrlRegex) || [];
    if (urlMatches && urlMatches.length > 0) {
      urlMatches.forEach((match) => {
        let serverUrl;
        try {
          serverUrl = new URL(match);
        } catch (e) {
        }
        if (serverUrl) {
          const portMatch = match.match(_UrlFinder.extractPortRegex);
          const port = parseFloat(serverUrl.port ? serverUrl.port : portMatch ? portMatch[2] : "NaN");
          if (!isNaN(port) && Number.isInteger(port) && port > 0 && port <= 65535) {
            let host = serverUrl.hostname;
            if (host !== "0.0.0.0" && host !== "127.0.0.1") {
              host = "localhost";
            }
            if (port !== 9229 && data.startsWith("Debugger listening on")) {
              return;
            }
            this._onDidMatchLocalUrl.fire({ port, host });
          }
        }
      });
    } else {
      const pythonMatch = data.match(_UrlFinder.localPythonServerRegex);
      if (pythonMatch && pythonMatch.length === 3) {
        this._onDidMatchLocalUrl.fire({ host: pythonMatch[1], port: Number(pythonMatch[2]) });
      }
    }
  }
};
/**
 * Local server url pattern matching following urls:
 * http://localhost:3000/ - commonly used across multiple frameworks
 * https://127.0.0.1:5001/ - ASP.NET
 * http://:8080 - Beego Golang
 * http://0.0.0.0:4000 - Elixir Phoenix
 */
_UrlFinder.localUrlRegex = /\b\w{0,20}(?::\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|:\d{2,5})[\w\-\.\~:\/\?\#[\]\@!\$&\(\)\*\+\,\;\=]*/gim;
_UrlFinder.extractPortRegex = /(localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{1,5})/;
/**
 * https://github.com/microsoft/vscode-remote-release/issues/3949
 */
_UrlFinder.localPythonServerRegex = /HTTP\son\s(127\.0\.0\.1|0\.0\.0\.0)\sport\s(\d+)/;
_UrlFinder.excludeTerminals = ["Dev Containers"];
let UrlFinder = _UrlFinder;
export {
  UrlFinder
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9yZW1vdGUvYnJvd3Nlci91cmxGaW5kZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJVGVybWluYWxJbnN0YW5jZSwgSVRlcm1pbmFsU2VydmljZSB9IGZyb20gJy4uLy4uL3Rlcm1pbmFsL2Jyb3dzZXIvdGVybWluYWwuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElEZWJ1Z1NlcnZpY2UsIElEZWJ1Z1Nlc3Npb24sIElSZXBsRWxlbWVudCB9IGZyb20gJy4uLy4uL2RlYnVnL2NvbW1vbi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyByZW1vdmVBbnNpRXNjYXBlQ29kZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcblxuZXhwb3J0IGNsYXNzIFVybEZpbmRlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHQvKipcblx0ICogTG9jYWwgc2VydmVyIHVybCBwYXR0ZXJuIG1hdGNoaW5nIGZvbGxvd2luZyB1cmxzOlxuXHQgKiBodHRwOi8vbG9jYWxob3N0OjMwMDAvIC0gY29tbW9ubHkgdXNlZCBhY3Jvc3MgbXVsdGlwbGUgZnJhbWV3b3Jrc1xuXHQgKiBodHRwczovLzEyNy4wLjAuMTo1MDAxLyAtIEFTUC5ORVRcblx0ICogaHR0cDovLzo4MDgwIC0gQmVlZ28gR29sYW5nXG5cdCAqIGh0dHA6Ly8wLjAuMC4wOjQwMDAgLSBFbGl4aXIgUGhvZW5peFxuXHQgKi9cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgbG9jYWxVcmxSZWdleCA9IC9cXGJcXHd7MCwyMH0oPzo6XFwvXFwvKT8oPzpsb2NhbGhvc3R8MTI3XFwuMFxcLjBcXC4xfDBcXC4wXFwuMFxcLjB8OlxcZHsyLDV9KVtcXHdcXC1cXC5cXH46XFwvXFw/XFwjW1xcXVxcQCFcXCQmXFwoXFwpXFwqXFwrXFwsXFw7XFw9XSovZ2ltO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBleHRyYWN0UG9ydFJlZ2V4ID0gLyhsb2NhbGhvc3R8MTI3XFwuMFxcLjBcXC4xfDBcXC4wXFwuMFxcLjApOihcXGR7MSw1fSkvO1xuXHQvKipcblx0ICogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUtcmVtb3RlLXJlbGVhc2UvaXNzdWVzLzM5NDlcblx0ICovXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IGxvY2FsUHl0aG9uU2VydmVyUmVnZXggPSAvSFRUUFxcc29uXFxzKDEyN1xcLjBcXC4wXFwuMXwwXFwuMFxcLjBcXC4wKVxcc3BvcnRcXHMoXFxkKykvO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IGV4Y2x1ZGVUZXJtaW5hbHMgPSBbJ0RldiBDb250YWluZXJzJ107XG5cblx0cHJpdmF0ZSBfb25EaWRNYXRjaExvY2FsVXJsOiBFbWl0dGVyPHsgaG9zdDogc3RyaW5nOyBwb3J0OiBudW1iZXIgfT4gPSBuZXcgRW1pdHRlcigpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRNYXRjaExvY2FsVXJsID0gdGhpcy5fb25EaWRNYXRjaExvY2FsVXJsLmV2ZW50O1xuXHRwcml2YXRlIGxpc3RlbmVyczogTWFwPElUZXJtaW5hbEluc3RhbmNlIHwgc3RyaW5nLCBJRGlzcG9zYWJsZT4gPSBuZXcgTWFwKCk7XG5cblx0Y29uc3RydWN0b3IodGVybWluYWxTZXJ2aWNlOiBJVGVybWluYWxTZXJ2aWNlLCBkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UpIHtcblx0XHRzdXBlcigpO1xuXHRcdC8vIFRlcm1pbmFsXG5cdFx0dGVybWluYWxTZXJ2aWNlLmluc3RhbmNlcy5mb3JFYWNoKGluc3RhbmNlID0+IHtcblx0XHRcdHRoaXMucmVnaXN0ZXJUZXJtaW5hbEluc3RhbmNlKGluc3RhbmNlKTtcblx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0ZXJtaW5hbFNlcnZpY2Uub25EaWRDcmVhdGVJbnN0YW5jZShpbnN0YW5jZSA9PiB7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyVGVybWluYWxJbnN0YW5jZShpbnN0YW5jZSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRlcm1pbmFsU2VydmljZS5vbkRpZERpc3Bvc2VJbnN0YW5jZShpbnN0YW5jZSA9PiB7XG5cdFx0XHR0aGlzLmxpc3RlbmVycy5nZXQoaW5zdGFuY2UpPy5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLmxpc3RlbmVycy5kZWxldGUoaW5zdGFuY2UpO1xuXHRcdH0pKTtcblxuXHRcdC8vIERlYnVnXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZGVidWdTZXJ2aWNlLm9uRGlkTmV3U2Vzc2lvbihzZXNzaW9uID0+IHtcblx0XHRcdGlmICghc2Vzc2lvbi5wYXJlbnRTZXNzaW9uIHx8IChzZXNzaW9uLnBhcmVudFNlc3Npb24gJiYgc2Vzc2lvbi5oYXNTZXBhcmF0ZVJlcGwoKSkpIHtcblx0XHRcdFx0dGhpcy5saXN0ZW5lcnMuc2V0KHNlc3Npb24uZ2V0SWQoKSwgc2Vzc2lvbi5vbkRpZENoYW5nZVJlcGxFbGVtZW50cygoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5wcm9jZXNzTmV3UmVwbEVsZW1lbnRzKHNlc3Npb24pO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRlYnVnU2VydmljZS5vbkRpZEVuZFNlc3Npb24oKHsgc2Vzc2lvbiB9KSA9PiB7XG5cdFx0XHRpZiAodGhpcy5saXN0ZW5lcnMuaGFzKHNlc3Npb24uZ2V0SWQoKSkpIHtcblx0XHRcdFx0dGhpcy5saXN0ZW5lcnMuZ2V0KHNlc3Npb24uZ2V0SWQoKSk/LmRpc3Bvc2UoKTtcblx0XHRcdFx0dGhpcy5saXN0ZW5lcnMuZGVsZXRlKHNlc3Npb24uZ2V0SWQoKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlclRlcm1pbmFsSW5zdGFuY2UoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlKSB7XG5cdFx0aWYgKCFVcmxGaW5kZXIuZXhjbHVkZVRlcm1pbmFscy5pbmNsdWRlcyhpbnN0YW5jZS50aXRsZSkpIHtcblx0XHRcdHRoaXMubGlzdGVuZXJzLnNldChpbnN0YW5jZSwgaW5zdGFuY2Uub25EYXRhKGRhdGEgPT4ge1xuXHRcdFx0XHR0aGlzLnByb2Nlc3NEYXRhKGRhdGEpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVwbFBvc2l0aW9uczogTWFwPHN0cmluZywgeyBwb3NpdGlvbjogbnVtYmVyOyB0YWlsOiBJUmVwbEVsZW1lbnQgfT4gPSBuZXcgTWFwKCk7XG5cdHByaXZhdGUgcHJvY2Vzc05ld1JlcGxFbGVtZW50cyhzZXNzaW9uOiBJRGVidWdTZXNzaW9uKSB7XG5cdFx0Y29uc3Qgb2xkUmVwbFBvc2l0aW9uID0gdGhpcy5yZXBsUG9zaXRpb25zLmdldChzZXNzaW9uLmdldElkKCkpO1xuXHRcdGNvbnN0IHJlcGxFbGVtZW50cyA9IHNlc3Npb24uZ2V0UmVwbEVsZW1lbnRzKCk7XG5cdFx0dGhpcy5yZXBsUG9zaXRpb25zLnNldChzZXNzaW9uLmdldElkKCksIHsgcG9zaXRpb246IHJlcGxFbGVtZW50cy5sZW5ndGggLSAxLCB0YWlsOiByZXBsRWxlbWVudHNbcmVwbEVsZW1lbnRzLmxlbmd0aCAtIDFdIH0pO1xuXG5cdFx0aWYgKCFvbGRSZXBsUG9zaXRpb24gJiYgcmVwbEVsZW1lbnRzLmxlbmd0aCA+IDApIHtcblx0XHRcdHJlcGxFbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4gdGhpcy5wcm9jZXNzRGF0YShlbGVtZW50LnRvU3RyaW5nKCkpKTtcblx0XHR9IGVsc2UgaWYgKG9sZFJlcGxQb3NpdGlvbiAmJiAocmVwbEVsZW1lbnRzLmxlbmd0aCAtIDEgIT09IG9sZFJlcGxQb3NpdGlvbi5wb3NpdGlvbikpIHtcblx0XHRcdC8vIFByb2Nlc3MgbGluZXMgdW50aWwgd2UgcmVhY2ggdGhlIG9sZCBcInRhaWxcIlxuXHRcdFx0Zm9yIChsZXQgaSA9IHJlcGxFbGVtZW50cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0XHRjb25zdCBlbGVtZW50ID0gcmVwbEVsZW1lbnRzW2ldO1xuXHRcdFx0XHRpZiAoZWxlbWVudCA9PT0gb2xkUmVwbFBvc2l0aW9uLnRhaWwpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnByb2Nlc3NEYXRhKGVsZW1lbnQudG9TdHJpbmcoKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHRjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLmxpc3RlbmVycy52YWx1ZXMoKTtcblx0XHRmb3IgKGNvbnN0IGxpc3RlbmVyIG9mIGxpc3RlbmVycykge1xuXHRcdFx0bGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcHJvY2Vzc0RhdGEoZGF0YTogc3RyaW5nKSB7XG5cdFx0Ly8gc3RyaXAgQU5TSSB0ZXJtaW5hbCBjb2Rlc1xuXHRcdGRhdGEgPSByZW1vdmVBbnNpRXNjYXBlQ29kZXMoZGF0YSk7XG5cdFx0Y29uc3QgdXJsTWF0Y2hlcyA9IGRhdGEubWF0Y2goVXJsRmluZGVyLmxvY2FsVXJsUmVnZXgpIHx8IFtdO1xuXHRcdGlmICh1cmxNYXRjaGVzICYmIHVybE1hdGNoZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0dXJsTWF0Y2hlcy5mb3JFYWNoKChtYXRjaCkgPT4ge1xuXHRcdFx0XHQvLyBjaGVjayBpZiB2YWxpZCB1cmxcblx0XHRcdFx0bGV0IHNlcnZlclVybDtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRzZXJ2ZXJVcmwgPSBuZXcgVVJMKG1hdGNoKTtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdC8vIE5vdCBhIHZhbGlkIFVSTFxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChzZXJ2ZXJVcmwpIHtcblx0XHRcdFx0XHQvLyBjaGVjayBpZiB0aGUgcG9ydCBpcyBhIHZhbGlkIGludGVnZXIgdmFsdWVcblx0XHRcdFx0XHRjb25zdCBwb3J0TWF0Y2ggPSBtYXRjaC5tYXRjaChVcmxGaW5kZXIuZXh0cmFjdFBvcnRSZWdleCk7XG5cdFx0XHRcdFx0Y29uc3QgcG9ydCA9IHBhcnNlRmxvYXQoc2VydmVyVXJsLnBvcnQgPyBzZXJ2ZXJVcmwucG9ydCA6IChwb3J0TWF0Y2ggPyBwb3J0TWF0Y2hbMl0gOiAnTmFOJykpO1xuXHRcdFx0XHRcdGlmICghaXNOYU4ocG9ydCkgJiYgTnVtYmVyLmlzSW50ZWdlcihwb3J0KSAmJiBwb3J0ID4gMCAmJiBwb3J0IDw9IDY1NTM1KSB7XG5cdFx0XHRcdFx0XHQvLyBub3JtYWxpemUgdGhlIGhvc3QgbmFtZVxuXHRcdFx0XHRcdFx0bGV0IGhvc3QgPSBzZXJ2ZXJVcmwuaG9zdG5hbWU7XG5cdFx0XHRcdFx0XHRpZiAoaG9zdCAhPT0gJzAuMC4wLjAnICYmIGhvc3QgIT09ICcxMjcuMC4wLjEnKSB7XG5cdFx0XHRcdFx0XHRcdGhvc3QgPSAnbG9jYWxob3N0Jztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdC8vIEV4Y2x1ZGUgbm9kZSBpbnNwZWN0LCBleGNlcHQgd2hlbiB1c2luZyBkZWZhdWx0IHBvcnRcblx0XHRcdFx0XHRcdGlmIChwb3J0ICE9PSA5MjI5ICYmIGRhdGEuc3RhcnRzV2l0aCgnRGVidWdnZXIgbGlzdGVuaW5nIG9uJykpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGhpcy5fb25EaWRNYXRjaExvY2FsVXJsLmZpcmUoeyBwb3J0LCBob3N0IH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIFRyeSBzcGVjaWFsIHB5dGhvbiBjYXNlXG5cdFx0XHRjb25zdCBweXRob25NYXRjaCA9IGRhdGEubWF0Y2goVXJsRmluZGVyLmxvY2FsUHl0aG9uU2VydmVyUmVnZXgpO1xuXHRcdFx0aWYgKHB5dGhvbk1hdGNoICYmIHB5dGhvbk1hdGNoLmxlbmd0aCA9PT0gMykge1xuXHRcdFx0XHR0aGlzLl9vbkRpZE1hdGNoTG9jYWxVcmwuZmlyZSh7IGhvc3Q6IHB5dGhvbk1hdGNoWzFdLCBwb3J0OiBOdW1iZXIocHl0aG9uTWF0Y2hbMl0pIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQStCO0FBRXhDLFNBQVMsNkJBQTZCO0FBRS9CLE1BQU0sYUFBTixNQUFNLG1CQUFrQixXQUFXO0FBQUEsRUFxQnpDLFlBQVksaUJBQW1DLGNBQTZCO0FBQzNFLFVBQU07QUFMUCxTQUFRLHNCQUErRCxJQUFJLFFBQVE7QUFDbkYsU0FBZ0IscUJBQXFCLEtBQUssb0JBQW9CO0FBQzlELFNBQVEsWUFBMEQsb0JBQUksSUFBSTtBQXdDMUUsU0FB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
