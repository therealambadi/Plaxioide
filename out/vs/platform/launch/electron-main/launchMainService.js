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
import { app } from "electron";
import { coalesce } from "../../../base/common/arrays.js";
import { isMacintosh } from "../../../base/common/platform.js";
import { URI } from "../../../base/common/uri.js";
import { whenDeleted } from "../../../base/node/pfs.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { isLaunchedFromCli } from "../../environment/node/argvHelper.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { IURLService } from "../../url/common/url.js";
import { IWindowsMainService, OpenContext } from "../../windows/electron-main/windows.js";
const ID = "launchMainService";
const ILaunchMainService = createDecorator(ID);
let LaunchMainService = class {
  constructor(logService, windowsMainService, urlService, configurationService) {
    this.logService = logService;
    this.windowsMainService = windowsMainService;
    this.urlService = urlService;
    this.configurationService = configurationService;
  }
  async start(args, userEnv) {
    this.logService.trace("Received data from other instance: ", args, userEnv);
    if (isMacintosh) {
      app.focus({ steal: true });
    }
    const urlsToOpen = this.parseOpenUrl(args);
    if (urlsToOpen.length) {
      let whenWindowReady = Promise.resolve();
      if (this.windowsMainService.getWindowCount() === 0) {
        const window = (await this.windowsMainService.openEmptyWindow({ context: OpenContext.DESKTOP })).at(0);
        if (window) {
          whenWindowReady = window.ready();
        }
      }
      whenWindowReady.then(() => {
        for (const { uri, originalUrl } of urlsToOpen) {
          this.urlService.open(uri, { originalUrl });
        }
      });
    } else {
      return this.startOpenWindow(args, userEnv);
    }
  }
  parseOpenUrl(args) {
    if (args["open-url"] && args._urls && args._urls.length > 0) {
      return coalesce(args._urls.map((url) => {
        try {
          return { uri: URI.parse(url), originalUrl: url };
        } catch (err) {
          return null;
        }
      }));
    }
    return [];
  }
  async startOpenWindow(args, userEnv) {
    const context = isLaunchedFromCli(userEnv) ? OpenContext.CLI : OpenContext.DESKTOP;
    let usedWindows = [];
    const waitMarkerFileURI = args.wait && args.waitMarkerFilePath ? URI.file(args.waitMarkerFilePath) : void 0;
    const remoteAuthority = args.remote || void 0;
    const baseConfig = {
      context,
      cli: args,
      /**
       * When opening a new window from a second instance that sent args and env
       * over to this instance, we want to preserve the environment only if that second
       * instance was spawned from the CLI or used the `--preserve-env` flag (example:
       * when using `open -n "VSCode.app" --args --preserve-env WORKSPACE_FOLDER`).
       *
       * This is done to ensure that the second window gets treated exactly the same
       * as the first window, for example, it gets the same resolved user shell environment.
       *
       * https://github.com/microsoft/vscode/issues/194736
       */
      userEnv: args["preserve-env"] || context === OpenContext.CLI ? userEnv : void 0,
      waitMarkerFileURI,
      remoteAuthority,
      forceProfile: args.profile,
      forceTempProfile: args["profile-temp"]
    };
    if (!!args.extensionDevelopmentPath) {
      await this.windowsMainService.openExtensionDevelopmentHostWindow(args.extensionDevelopmentPath, baseConfig);
    } else if (!args._.length && !args["folder-uri"] && !args["file-uri"]) {
      let openNewWindow = false;
      if (args["new-window"] || baseConfig.forceProfile || baseConfig.forceTempProfile) {
        openNewWindow = true;
      } else if (args["reuse-window"]) {
        openNewWindow = false;
      } else {
        const windowConfig = this.configurationService.getValue("window");
        const openWithoutArgumentsInNewWindowConfig = windowConfig?.openWithoutArgumentsInNewWindow || "default";
        switch (openWithoutArgumentsInNewWindowConfig) {
          case "on":
            openNewWindow = true;
            break;
          case "off":
            openNewWindow = false;
            break;
          default:
            openNewWindow = !isMacintosh;
        }
      }
      if (openNewWindow) {
        usedWindows = await this.windowsMainService.open({
          ...baseConfig,
          forceNewWindow: true,
          forceEmpty: true
        });
      } else {
        const lastActive = this.windowsMainService.getLastActiveWindow();
        if (lastActive) {
          this.windowsMainService.openExistingWindow(lastActive, baseConfig);
          usedWindows = [lastActive];
        } else {
          usedWindows = await this.windowsMainService.open({
            ...baseConfig,
            forceEmpty: true
          });
        }
      }
    } else {
      usedWindows = await this.windowsMainService.open({
        ...baseConfig,
        forceNewWindow: args["new-window"],
        preferNewWindow: !args["reuse-window"] && !args.wait,
        forceReuseWindow: args["reuse-window"],
        diffMode: args.diff,
        mergeMode: args.merge,
        addMode: args.add,
        removeMode: args.remove,
        noRecentEntry: !!args["skip-add-to-recently-opened"],
        gotoLineMode: args.goto
      });
    }
    if (waitMarkerFileURI && usedWindows.length === 1 && usedWindows[0]) {
      return Promise.race([
        usedWindows[0].whenClosedOrLoaded,
        whenDeleted(waitMarkerFileURI.fsPath)
      ]).then(() => void 0, () => void 0);
    }
  }
  async getMainProcessId() {
    this.logService.trace("Received request for process ID from other instance.");
    return process.pid;
  }
};
LaunchMainService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IWindowsMainService),
  __decorateParam(2, IURLService),
  __decorateParam(3, IConfigurationService)
], LaunchMainService);
export {
  ID,
  ILaunchMainService,
  LaunchMainService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9sYXVuY2gvZWxlY3Ryb24tbWFpbi9sYXVuY2hNYWluU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGFwcCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCB7IGNvYWxlc2NlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IElQcm9jZXNzRW52aXJvbm1lbnQsIGlzTWFjaW50b3NoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IHdoZW5EZWxldGVkIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL3Bmcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IE5hdGl2ZVBhcnNlZEFyZ3MgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9jb21tb24vYXJndi5qcyc7XG5pbXBvcnQgeyBpc0xhdW5jaGVkRnJvbUNsaSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L25vZGUvYXJndkhlbHBlci5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVVSTFNlcnZpY2UgfSBmcm9tICcuLi8uLi91cmwvY29tbW9uL3VybC5qcyc7XG5pbXBvcnQgeyBJQ29kZVdpbmRvdyB9IGZyb20gJy4uLy4uL3dpbmRvdy9lbGVjdHJvbi1tYWluL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBJV2luZG93U2V0dGluZ3MgfSBmcm9tICcuLi8uLi93aW5kb3cvY29tbW9uL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBJT3BlbkNvbmZpZ3VyYXRpb24sIElXaW5kb3dzTWFpblNlcnZpY2UsIE9wZW5Db250ZXh0IH0gZnJvbSAnLi4vLi4vd2luZG93cy9lbGVjdHJvbi1tYWluL3dpbmRvd3MuanMnO1xuaW1wb3J0IHsgSVByb3RvY29sVXJsIH0gZnJvbSAnLi4vLi4vdXJsL2VsZWN0cm9uLW1haW4vdXJsLmpzJztcblxuZXhwb3J0IGNvbnN0IElEID0gJ2xhdW5jaE1haW5TZXJ2aWNlJztcbmV4cG9ydCBjb25zdCBJTGF1bmNoTWFpblNlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SUxhdW5jaE1haW5TZXJ2aWNlPihJRCk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0YXJ0QXJndW1lbnRzIHtcblx0cmVhZG9ubHkgYXJnczogTmF0aXZlUGFyc2VkQXJncztcblx0cmVhZG9ubHkgdXNlckVudjogSVByb2Nlc3NFbnZpcm9ubWVudDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTGF1bmNoTWFpblNlcnZpY2Uge1xuXG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRzdGFydChhcmdzOiBOYXRpdmVQYXJzZWRBcmdzLCB1c2VyRW52OiBJUHJvY2Vzc0Vudmlyb25tZW50KTogUHJvbWlzZTx2b2lkPjtcblxuXHRnZXRNYWluUHJvY2Vzc0lkKCk6IFByb21pc2U8bnVtYmVyPjtcbn1cblxuZXhwb3J0IGNsYXNzIExhdW5jaE1haW5TZXJ2aWNlIGltcGxlbWVudHMgSUxhdW5jaE1haW5TZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVdpbmRvd3NNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdpbmRvd3NNYWluU2VydmljZTogSVdpbmRvd3NNYWluU2VydmljZSxcblx0XHRASVVSTFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmxTZXJ2aWNlOiBJVVJMU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7IH1cblxuXHRhc3luYyBzdGFydChhcmdzOiBOYXRpdmVQYXJzZWRBcmdzLCB1c2VyRW52OiBJUHJvY2Vzc0Vudmlyb25tZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdSZWNlaXZlZCBkYXRhIGZyb20gb3RoZXIgaW5zdGFuY2U6ICcsIGFyZ3MsIHVzZXJFbnYpO1xuXG5cdFx0Ly8gbWFjT1M6IEVsZWN0cm9uID4gNy54IGNoYW5nZWQgaXRzIGJlaGF2aW91ciB0byBub3Rcblx0XHQvLyBicmluZyB0aGUgYXBwbGljYXRpb24gdG8gdGhlIGZvcmVncm91bmQgd2hlbiBhIHdpbmRvd1xuXHRcdC8vIGlzIGZvY3VzZWQgcHJvZ3JhbW1hdGljYWxseS4gT25seSB2aWEgYGFwcC5mb2N1c2AgYW5kXG5cdFx0Ly8gdGhlIG9wdGlvbiBgc3RlYWw6IHRydWVgIGNhbiB5b3UgZ2V0IHRoZSBwcmV2aW91c1xuXHRcdC8vIGJlaGF2aW91ciBiYWNrLiBUaGUgb25seSByZWFzb24gdG8gdXNlIHRoaXMgb3B0aW9uIGlzXG5cdFx0Ly8gd2hlbiBhIHdpbmRvdyBpcyBnZXR0aW5nIGZvY3VzZWQgd2hpbGUgdGhlIGFwcGxpY2F0aW9uXG5cdFx0Ly8gaXMgbm90IGluIHRoZSBmb3JlZ3JvdW5kIGFuZCBzaW5jZSB3ZSBnb3QgaW5zdHJ1Y3RlZFxuXHRcdC8vIHRvIG9wZW4gYSBuZXcgd2luZG93IGZyb20gYW5vdGhlciBpbnN0YW5jZSwgd2UgZW5zdXJlXG5cdFx0Ly8gdGhhdCB0aGUgYXBwIGhhcyBmb2N1cy5cblx0XHRpZiAoaXNNYWNpbnRvc2gpIHtcblx0XHRcdGFwcC5mb2N1cyh7IHN0ZWFsOiB0cnVlIH0pO1xuXHRcdH1cblxuXHRcdC8vIENoZWNrIGVhcmx5IGZvciBvcGVuLXVybCB3aGljaCBpcyBoYW5kbGVkIGluIFVSTCBzZXJ2aWNlXG5cdFx0Y29uc3QgdXJsc1RvT3BlbiA9IHRoaXMucGFyc2VPcGVuVXJsKGFyZ3MpO1xuXHRcdGlmICh1cmxzVG9PcGVuLmxlbmd0aCkge1xuXHRcdFx0bGV0IHdoZW5XaW5kb3dSZWFkeTogUHJvbWlzZTx1bmtub3duPiA9IFByb21pc2UucmVzb2x2ZSgpO1xuXG5cdFx0XHQvLyBDcmVhdGUgYSB3aW5kb3cgaWYgdGhlcmUgaXMgbm9uZVxuXHRcdFx0aWYgKHRoaXMud2luZG93c01haW5TZXJ2aWNlLmdldFdpbmRvd0NvdW50KCkgPT09IDApIHtcblx0XHRcdFx0Y29uc3Qgd2luZG93ID0gKGF3YWl0IHRoaXMud2luZG93c01haW5TZXJ2aWNlLm9wZW5FbXB0eVdpbmRvdyh7IGNvbnRleHQ6IE9wZW5Db250ZXh0LkRFU0tUT1AgfSkpLmF0KDApO1xuXHRcdFx0XHRpZiAod2luZG93KSB7XG5cdFx0XHRcdFx0d2hlbldpbmRvd1JlYWR5ID0gd2luZG93LnJlYWR5KCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gTWFrZSBzdXJlIGEgd2luZG93IGlzIG9wZW4sIHJlYWR5IHRvIHJlY2VpdmUgdGhlIHVybCBldmVudFxuXHRcdFx0d2hlbldpbmRvd1JlYWR5LnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHsgdXJpLCBvcmlnaW5hbFVybCB9IG9mIHVybHNUb09wZW4pIHtcblx0XHRcdFx0XHR0aGlzLnVybFNlcnZpY2Uub3Blbih1cmksIHsgb3JpZ2luYWxVcmwgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIE90aGVyd2lzZSBoYW5kbGUgaW4gd2luZG93cyBzZXJ2aWNlXG5cdFx0ZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zdGFydE9wZW5XaW5kb3coYXJncywgdXNlckVudik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBwYXJzZU9wZW5VcmwoYXJnczogTmF0aXZlUGFyc2VkQXJncyk6IElQcm90b2NvbFVybFtdIHtcblx0XHRpZiAoYXJnc1snb3Blbi11cmwnXSAmJiBhcmdzLl91cmxzICYmIGFyZ3MuX3VybHMubGVuZ3RoID4gMCkge1xuXG5cdFx0XHQvLyAtLW9wZW4tdXJsIG11c3QgY29udGFpbiAtLSBmb2xsb3dlZCBieSB0aGUgdXJsKHMpXG5cdFx0XHQvLyBwcm9jZXNzLmFyZ3YgaXMgdXNlZCBvdmVyIGFyZ3MuXyBhcyBhcmdzLl8gYXJlIHJlc29sdmVkIHRvIGZpbGUgcGF0aHMgYXQgdGhpcyBwb2ludFxuXG5cdFx0XHRyZXR1cm4gY29hbGVzY2UoYXJncy5fdXJsc1xuXHRcdFx0XHQubWFwKHVybCA9PiB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdHJldHVybiB7IHVyaTogVVJJLnBhcnNlKHVybCksIG9yaWdpbmFsVXJsOiB1cmwgfTtcblx0XHRcdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc3RhcnRPcGVuV2luZG93KGFyZ3M6IE5hdGl2ZVBhcnNlZEFyZ3MsIHVzZXJFbnY6IElQcm9jZXNzRW52aXJvbm1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb250ZXh0ID0gaXNMYXVuY2hlZEZyb21DbGkodXNlckVudikgPyBPcGVuQ29udGV4dC5DTEkgOiBPcGVuQ29udGV4dC5ERVNLVE9QO1xuXHRcdGxldCB1c2VkV2luZG93czogSUNvZGVXaW5kb3dbXSA9IFtdO1xuXG5cdFx0Y29uc3Qgd2FpdE1hcmtlckZpbGVVUkkgPSBhcmdzLndhaXQgJiYgYXJncy53YWl0TWFya2VyRmlsZVBhdGggPyBVUkkuZmlsZShhcmdzLndhaXRNYXJrZXJGaWxlUGF0aCkgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcmVtb3RlQXV0aG9yaXR5ID0gYXJncy5yZW1vdGUgfHwgdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgYmFzZUNvbmZpZzogSU9wZW5Db25maWd1cmF0aW9uID0ge1xuXHRcdFx0Y29udGV4dCxcblx0XHRcdGNsaTogYXJncyxcblx0XHRcdC8qKlxuXHRcdFx0ICogV2hlbiBvcGVuaW5nIGEgbmV3IHdpbmRvdyBmcm9tIGEgc2Vjb25kIGluc3RhbmNlIHRoYXQgc2VudCBhcmdzIGFuZCBlbnZcblx0XHRcdCAqIG92ZXIgdG8gdGhpcyBpbnN0YW5jZSwgd2Ugd2FudCB0byBwcmVzZXJ2ZSB0aGUgZW52aXJvbm1lbnQgb25seSBpZiB0aGF0IHNlY29uZFxuXHRcdFx0ICogaW5zdGFuY2Ugd2FzIHNwYXduZWQgZnJvbSB0aGUgQ0xJIG9yIHVzZWQgdGhlIGAtLXByZXNlcnZlLWVudmAgZmxhZyAoZXhhbXBsZTpcblx0XHRcdCAqIHdoZW4gdXNpbmcgYG9wZW4gLW4gXCJWU0NvZGUuYXBwXCIgLS1hcmdzIC0tcHJlc2VydmUtZW52IFdPUktTUEFDRV9GT0xERVJgKS5cblx0XHRcdCAqXG5cdFx0XHQgKiBUaGlzIGlzIGRvbmUgdG8gZW5zdXJlIHRoYXQgdGhlIHNlY29uZCB3aW5kb3cgZ2V0cyB0cmVhdGVkIGV4YWN0bHkgdGhlIHNhbWVcblx0XHRcdCAqIGFzIHRoZSBmaXJzdCB3aW5kb3csIGZvciBleGFtcGxlLCBpdCBnZXRzIHRoZSBzYW1lIHJlc29sdmVkIHVzZXIgc2hlbGwgZW52aXJvbm1lbnQuXG5cdFx0XHQgKlxuXHRcdFx0ICogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE5NDczNlxuXHRcdFx0ICovXG5cdFx0XHR1c2VyRW52OiAoYXJnc1sncHJlc2VydmUtZW52J10gfHwgY29udGV4dCA9PT0gT3BlbkNvbnRleHQuQ0xJKSA/IHVzZXJFbnYgOiB1bmRlZmluZWQsXG5cdFx0XHR3YWl0TWFya2VyRmlsZVVSSSxcblx0XHRcdHJlbW90ZUF1dGhvcml0eSxcblx0XHRcdGZvcmNlUHJvZmlsZTogYXJncy5wcm9maWxlLFxuXHRcdFx0Zm9yY2VUZW1wUHJvZmlsZTogYXJnc1sncHJvZmlsZS10ZW1wJ11cblx0XHR9O1xuXG5cdFx0Ly8gU3BlY2lhbCBjYXNlIGV4dGVuc2lvbiBkZXZlbG9wbWVudFxuXHRcdGlmICghIWFyZ3MuZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoKSB7XG5cdFx0XHRhd2FpdCB0aGlzLndpbmRvd3NNYWluU2VydmljZS5vcGVuRXh0ZW5zaW9uRGV2ZWxvcG1lbnRIb3N0V2luZG93KGFyZ3MuZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoLCBiYXNlQ29uZmlnKTtcblx0XHR9XG5cblx0XHQvLyBTdGFydCB3aXRob3V0IGZpbGUvZm9sZGVyIGFyZ3VtZW50c1xuXHRcdGVsc2UgaWYgKCFhcmdzLl8ubGVuZ3RoICYmICFhcmdzWydmb2xkZXItdXJpJ10gJiYgIWFyZ3NbJ2ZpbGUtdXJpJ10pIHtcblx0XHRcdGxldCBvcGVuTmV3V2luZG93ID0gZmFsc2U7XG5cblx0XHRcdC8vIEZvcmNlIG5ldyB3aW5kb3dcblx0XHRcdGlmIChhcmdzWyduZXctd2luZG93J10gfHwgYmFzZUNvbmZpZy5mb3JjZVByb2ZpbGUgfHwgYmFzZUNvbmZpZy5mb3JjZVRlbXBQcm9maWxlKSB7XG5cdFx0XHRcdG9wZW5OZXdXaW5kb3cgPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBGb3JjZSByZXVzZSB3aW5kb3dcblx0XHRcdGVsc2UgaWYgKGFyZ3NbJ3JldXNlLXdpbmRvdyddKSB7XG5cdFx0XHRcdG9wZW5OZXdXaW5kb3cgPSBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gT3RoZXJ3aXNlIGNoZWNrIGZvciBzZXR0aW5nc1xuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHdpbmRvd0NvbmZpZyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVdpbmRvd1NldHRpbmdzIHwgdW5kZWZpbmVkPignd2luZG93Jyk7XG5cdFx0XHRcdGNvbnN0IG9wZW5XaXRob3V0QXJndW1lbnRzSW5OZXdXaW5kb3dDb25maWcgPSB3aW5kb3dDb25maWc/Lm9wZW5XaXRob3V0QXJndW1lbnRzSW5OZXdXaW5kb3cgfHwgJ2RlZmF1bHQnIC8qIGRlZmF1bHQgKi87XG5cdFx0XHRcdHN3aXRjaCAob3BlbldpdGhvdXRBcmd1bWVudHNJbk5ld1dpbmRvd0NvbmZpZykge1xuXHRcdFx0XHRcdGNhc2UgJ29uJzpcblx0XHRcdFx0XHRcdG9wZW5OZXdXaW5kb3cgPSB0cnVlO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnb2ZmJzpcblx0XHRcdFx0XHRcdG9wZW5OZXdXaW5kb3cgPSBmYWxzZTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0XHRvcGVuTmV3V2luZG93ID0gIWlzTWFjaW50b3NoOyAvLyBwcmVmZXIgdG8gcmVzdG9yZSBydW5uaW5nIGluc3RhbmNlIG9uIG1hY09TXG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gT3BlbiBuZXcgV2luZG93XG5cdFx0XHRpZiAob3Blbk5ld1dpbmRvdykge1xuXHRcdFx0XHR1c2VkV2luZG93cyA9IGF3YWl0IHRoaXMud2luZG93c01haW5TZXJ2aWNlLm9wZW4oe1xuXHRcdFx0XHRcdC4uLmJhc2VDb25maWcsXG5cdFx0XHRcdFx0Zm9yY2VOZXdXaW5kb3c6IHRydWUsXG5cdFx0XHRcdFx0Zm9yY2VFbXB0eTogdHJ1ZVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRm9jdXMgZXhpc3Rpbmcgd2luZG93IG9yIG9wZW4gaWYgbm9uZSBvcGVuZWRcblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRjb25zdCBsYXN0QWN0aXZlID0gdGhpcy53aW5kb3dzTWFpblNlcnZpY2UuZ2V0TGFzdEFjdGl2ZVdpbmRvdygpO1xuXHRcdFx0XHRpZiAobGFzdEFjdGl2ZSkge1xuXHRcdFx0XHRcdHRoaXMud2luZG93c01haW5TZXJ2aWNlLm9wZW5FeGlzdGluZ1dpbmRvdyhsYXN0QWN0aXZlLCBiYXNlQ29uZmlnKTtcblxuXHRcdFx0XHRcdHVzZWRXaW5kb3dzID0gW2xhc3RBY3RpdmVdO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHVzZWRXaW5kb3dzID0gYXdhaXQgdGhpcy53aW5kb3dzTWFpblNlcnZpY2Uub3Blbih7XG5cdFx0XHRcdFx0XHQuLi5iYXNlQ29uZmlnLFxuXHRcdFx0XHRcdFx0Zm9yY2VFbXB0eTogdHJ1ZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gU3RhcnQgd2l0aCBmaWxlL2ZvbGRlciBhcmd1bWVudHNcblx0XHRlbHNlIHtcblx0XHRcdHVzZWRXaW5kb3dzID0gYXdhaXQgdGhpcy53aW5kb3dzTWFpblNlcnZpY2Uub3Blbih7XG5cdFx0XHRcdC4uLmJhc2VDb25maWcsXG5cdFx0XHRcdGZvcmNlTmV3V2luZG93OiBhcmdzWyduZXctd2luZG93J10sXG5cdFx0XHRcdHByZWZlck5ld1dpbmRvdzogIWFyZ3NbJ3JldXNlLXdpbmRvdyddICYmICFhcmdzLndhaXQsXG5cdFx0XHRcdGZvcmNlUmV1c2VXaW5kb3c6IGFyZ3NbJ3JldXNlLXdpbmRvdyddLFxuXHRcdFx0XHRkaWZmTW9kZTogYXJncy5kaWZmLFxuXHRcdFx0XHRtZXJnZU1vZGU6IGFyZ3MubWVyZ2UsXG5cdFx0XHRcdGFkZE1vZGU6IGFyZ3MuYWRkLFxuXHRcdFx0XHRyZW1vdmVNb2RlOiBhcmdzLnJlbW92ZSxcblx0XHRcdFx0bm9SZWNlbnRFbnRyeTogISFhcmdzWydza2lwLWFkZC10by1yZWNlbnRseS1vcGVuZWQnXSxcblx0XHRcdFx0Z290b0xpbmVNb2RlOiBhcmdzLmdvdG9cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIElmIHRoZSBvdGhlciBpbnN0YW5jZSBpcyB3YWl0aW5nIHRvIGJlIGtpbGxlZCwgd2UgaG9vayB1cCBhIHdpbmRvdyBsaXN0ZW5lciBpZiBvbmUgd2luZG93XG5cdFx0Ly8gaXMgYmVpbmcgdXNlZCBhbmQgb25seSB0aGVuIHJlc29sdmUgdGhlIHN0YXJ0dXAgcHJvbWlzZSB3aGljaCB3aWxsIGtpbGwgdGhpcyBzZWNvbmQgaW5zdGFuY2UuXG5cdFx0Ly8gSW4gYWRkaXRpb24sIHdlIHBvbGwgZm9yIHRoZSB3YWl0IG1hcmtlciBmaWxlIHRvIGJlIGRlbGV0ZWQgdG8gcmV0dXJuLlxuXHRcdGlmICh3YWl0TWFya2VyRmlsZVVSSSAmJiB1c2VkV2luZG93cy5sZW5ndGggPT09IDEgJiYgdXNlZFdpbmRvd3NbMF0pIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJhY2UoW1xuXHRcdFx0XHR1c2VkV2luZG93c1swXS53aGVuQ2xvc2VkT3JMb2FkZWQsXG5cdFx0XHRcdHdoZW5EZWxldGVkKHdhaXRNYXJrZXJGaWxlVVJJLmZzUGF0aClcblx0XHRcdF0pLnRoZW4oKCkgPT4gdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGdldE1haW5Qcm9jZXNzSWQoKTogUHJvbWlzZTxudW1iZXI+IHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ1JlY2VpdmVkIHJlcXVlc3QgZm9yIHByb2Nlc3MgSUQgZnJvbSBvdGhlciBpbnN0YW5jZS4nKTtcblxuXHRcdHJldHVybiBwcm9jZXNzLnBpZDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFdBQVc7QUFDcEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBOEIsbUJBQW1CO0FBQ2pELFNBQVMsV0FBVztBQUNwQixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDZCQUE2QjtBQUV0QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLG1CQUFtQjtBQUc1QixTQUE2QixxQkFBcUIsbUJBQW1CO0FBRzlELE1BQU0sS0FBSztBQUNYLE1BQU0scUJBQXFCLGdCQUFvQyxFQUFFO0FBZ0JqRSxJQUFNLG9CQUFOLE1BQXNEO0FBQUEsRUFJNUQsWUFDK0IsWUFDUSxvQkFDUixZQUNVLHNCQUN2QztBQUo2QjtBQUNRO0FBQ1I7QUFDVTtBQUFBLEVBQ3JDO0FBQUEsRUFFSixNQUFNLE1BQU0sTUFBd0IsU0FBNkM7QUFDaEYsU0FBSyxXQUFXLE1BQU0sdUNBQXVDLE1BQU0sT0FBTztBQVcxRSxRQUFJLGFBQWE7QUFDaEIsVUFBSSxNQUFNLEVBQUUsT0FBTyxLQUFLLENBQUM7QUFBQSxJQUMxQjtBQUdBLFVBQU0sYUFBYSxLQUFLLGFBQWEsSUFBSTtBQUN6QyxRQUFJLFdBQVcsUUFBUTtBQUN0QixVQUFJLGtCQUFvQyxRQUFRLFFBQVE7QUFHeEQsVUFBSSxLQUFLLG1CQUFtQixlQUFlLE1BQU0sR0FBRztBQUNuRCxjQUFNLFVBQVUsTUFBTSxLQUFLLG1CQUFtQixnQkFBZ0IsRUFBRSxTQUFTLFlBQVksUUFBUSxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQ3JHLFlBQUksUUFBUTtBQUNYLDRCQUFrQixPQUFPLE1BQU07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
