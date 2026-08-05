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
import { Delayer } from "../../../../../base/common/async.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { Event } from "../../../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable, combinedDisposable, dispose } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Categories } from "../../../../../platform/action/common/actionCommonCategories.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { ITerminalLogService, TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { IStatusbarService, StatusbarAlignment } from "../../../../services/statusbar/browser/statusbar.js";
import { registerTerminalAction } from "../../../terminal/browser/terminalActions.js";
import { registerTerminalContribution } from "../../../terminal/browser/terminalExtensions.js";
import { TerminalContextKeys } from "../../../terminal/common/terminalContextKey.js";
import { TerminalDeveloperCommandId } from "../common/terminal.developer.js";
import "./media/developer.css";
registerTerminalAction({
  id: TerminalDeveloperCommandId.ShowTextureAtlas,
  title: localize2("workbench.action.terminal.showTextureAtlas", "Show Terminal Texture Atlas"),
  category: Categories.Developer,
  precondition: ContextKeyExpr.or(TerminalContextKeys.isOpen),
  run: async (c, accessor) => {
    const fileService = accessor.get(IFileService);
    const openerService = accessor.get(IOpenerService);
    const workspaceContextService = accessor.get(IWorkspaceContextService);
    const bitmap = await c.service.activeInstance?.xterm?.textureAtlas;
    if (!bitmap) {
      return;
    }
    const cwdUri = workspaceContextService.getWorkspace().folders[0].uri;
    const fileUri = URI.joinPath(cwdUri, "textureAtlas.png");
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("bitmaprenderer");
    if (!ctx) {
      return;
    }
    ctx.transferFromImageBitmap(bitmap);
    const blob = await new Promise((res) => canvas.toBlob(res));
    if (!blob) {
      return;
    }
    await fileService.writeFile(fileUri, VSBuffer.wrap(new Uint8Array(await blob.arrayBuffer())));
    openerService.open(fileUri);
  }
});
registerTerminalAction({
  id: TerminalDeveloperCommandId.WriteDataToTerminal,
  title: localize2("workbench.action.terminal.writeDataToTerminal", "Write Data to Terminal"),
  category: Categories.Developer,
  run: async (c, accessor) => {
    const quickInputService = accessor.get(IQuickInputService);
    const instance = await c.service.getActiveOrCreateInstance();
    await c.service.revealActiveTerminal();
    await instance.processReady;
    if (!instance.xterm) {
      throw new Error("Cannot write data to terminal if xterm isn't initialized");
    }
    const data = await quickInputService.input({
      value: "",
      placeHolder: "Enter data, use \\x to escape",
      prompt: localize("workbench.action.terminal.writeDataToTerminal.prompt", "Enter data to write directly to the terminal, bypassing the pty")
    });
    if (!data) {
      return;
    }
    let escapedData = data.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
    while (true) {
      const match = escapedData.match(/\\x([0-9a-fA-F]{2})/);
      if (match === null || match.index === void 0 || match.length < 2) {
        break;
      }
      escapedData = escapedData.slice(0, match.index) + String.fromCharCode(parseInt(match[1], 16)) + escapedData.slice(match.index + 4);
    }
    const xterm = instance.xterm;
    xterm._writeText(escapedData);
  }
});
registerTerminalAction({
  id: TerminalDeveloperCommandId.RecordSession,
  title: localize2("workbench.action.terminal.recordSession", "Record Terminal Session"),
  category: Categories.Developer,
  run: async (c, accessor) => {
    const clipboardService = accessor.get(IClipboardService);
    const commandService = accessor.get(ICommandService);
    const statusbarService = accessor.get(IStatusbarService);
    const store = new DisposableStore();
    const text = localize("workbench.action.terminal.recordSession.recording", "Recording terminal session...");
    const statusbarEntry = {
      text,
      name: text,
      ariaLabel: text,
      showProgress: true
    };
    const statusbarHandle = statusbarService.addEntry(statusbarEntry, "recordSession", StatusbarAlignment.LEFT);
    store.add(statusbarHandle);
    const instance = await c.service.createTerminal();
    c.service.setActiveInstance(instance);
    await c.service.revealActiveTerminal();
    await Promise.all([
      instance.processReady,
      instance.focusWhenReady(true)
    ]);
    return new Promise((resolve) => {
      const events = [];
      const endRecording = () => {
        const session = JSON.stringify(events, null, 2);
        clipboardService.writeText(session);
        store.dispose();
        resolve();
      };
      const timer = store.add(new Delayer(5e3));
      store.add(Event.runAndSubscribe(instance.onDimensionsChanged, () => {
        events.push({
          type: "resize",
          cols: instance.cols,
          rows: instance.rows
        });
        timer.trigger(endRecording);
      }));
      store.add(commandService.onWillExecuteCommand((e) => {
        events.push({
          type: "command",
          id: e.commandId
        });
        timer.trigger(endRecording);
      }));
      store.add(instance.onWillData((data) => {
        events.push({
          type: "output",
          data
        });
        timer.trigger(endRecording);
      }));
      store.add(instance.onDidSendText((data) => {
        events.push({
          type: "sendText",
          data
        });
        timer.trigger(endRecording);
      }));
      store.add(instance.xterm.raw.onData((data) => {
        events.push({
          type: "input",
          data
        });
        timer.trigger(endRecording);
      }));
      let commandDetectedRegistered = false;
      store.add(Event.runAndSubscribe(instance.capabilities.onDidAddCapability, (e) => {
        if (commandDetectedRegistered) {
          return;
        }
        const commandDetection = instance.capabilities.get(TerminalCapability.CommandDetection);
        if (!commandDetection) {
          return;
        }
        store.add(commandDetection.promptInputModel.onDidChangeInput((e2) => {
          events.push({
            type: "promptInputChange",
            data: commandDetection.promptInputModel.getCombinedString()
          });
          timer.trigger(endRecording);
        }));
        commandDetectedRegistered = true;
      }));
    });
  }
});
registerTerminalAction({
  id: TerminalDeveloperCommandId.RestartPtyHost,
  title: localize2("workbench.action.terminal.restartPtyHost", "Restart Pty Host"),
  category: Categories.Developer,
  run: async (c, accessor) => {
    const logService = accessor.get(ITerminalLogService);
    const backends = Array.from(c.instanceService.getRegisteredBackends());
    const unresponsiveBackends = backends.filter((e) => !e.isResponsive);
    const restartCandidates = unresponsiveBackends.length > 0 ? unresponsiveBackends : backends;
    for (const backend of restartCandidates) {
      logService.warn(`Restarting pty host for authority "${backend.remoteAuthority}"`);
      backend.restartPtyHost();
    }
  }
});
var DevModeContributionState = /* @__PURE__ */ ((DevModeContributionState2) => {
  DevModeContributionState2[DevModeContributionState2["Off"] = 0] = "Off";
  DevModeContributionState2[DevModeContributionState2["WaitingForCapability"] = 1] = "WaitingForCapability";
  DevModeContributionState2[DevModeContributionState2["On"] = 2] = "On";
  return DevModeContributionState2;
})(DevModeContributionState || {});
let DevModeContribution = class extends Disposable {
  constructor(_ctx, _configurationService) {
    super();
    this._ctx = _ctx;
    this._configurationService = _configurationService;
    this._activeDevModeDisposables = this._register(new MutableDisposable());
    this._currentColor = 0;
    this._state = 0 /* Off */;
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalSettingId.DevMode)) {
        this._updateDevMode();
      }
    }));
  }
  static get(instance) {
    return instance.getContribution(DevModeContribution.ID);
  }
  xtermReady(xterm) {
    this._xterm = xterm;
    this._updateDevMode();
  }
  _updateDevMode() {
    const devMode = this._isEnabled();
    this._xterm?.raw.element?.classList.toggle("dev-mode", devMode);
    const commandDetection = this._ctx.instance.capabilities.get(TerminalCapability.CommandDetection);
    if (devMode) {
      if (commandDetection) {
        if (this._state === 2 /* On */) {
          return;
        }
        this._state = 2 /* On */;
        const commandDecorations = new DisposableMap();
        const otherDisposables = new DisposableStore();
        this._activeDevModeDisposables.value = combinedDisposable(
          commandDecorations,
          otherDisposables,
          // Prompt input
          this._ctx.instance.onDidBlur(() => this._updateDevMode()),
          this._ctx.instance.onDidFocus(() => this._updateDevMode()),
          commandDetection.promptInputModel.onDidChangeInput(() => this._updateDevMode()),
          // Sequence markers
          commandDetection.onCommandFinished((command) => {
            const colorClass = `color-${this._currentColor}`;
            const decorations = [];
            commandDecorations.set(command, combinedDisposable(...decorations));
            if (command.promptStartMarker) {
              const d = this._ctx.instance.xterm.raw?.registerDecoration({
                marker: command.promptStartMarker
              });
              if (d) {
                decorations.push(d);
                otherDisposables.add(d.onRender((e) => {
                  e.textContent = "A";
                  e.classList.add("xterm-sequence-decoration", "top", "left", colorClass);
                }));
              }
            }
            if (command.marker) {
              const d = this._ctx.instance.xterm.raw?.registerDecoration({
                marker: command.marker,
                x: command.startX
              });
              if (d) {
                decorations.push(d);
                otherDisposables.add(d.onRender((e) => {
                  e.textContent = "B";
                  e.classList.add("xterm-sequence-decoration", "top", "right", colorClass);
                }));
              }
            }
            if (command.executedMarker) {
              const d = this._ctx.instance.xterm.raw?.registerDecoration({
                marker: command.executedMarker,
                x: command.executedX
              });
              if (d) {
                decorations.push(d);
                otherDisposables.add(d.onRender((e) => {
                  e.textContent = "C";
                  e.classList.add("xterm-sequence-decoration", "bottom", "left", colorClass);
                }));
              }
            }
            if (command.endMarker) {
              const d = this._ctx.instance.xterm.raw?.registerDecoration({
                marker: command.endMarker
              });
              if (d) {
                decorations.push(d);
                otherDisposables.add(d.onRender((e) => {
                  e.textContent = "D";
                  e.classList.add("xterm-sequence-decoration", "bottom", "right", colorClass);
                }));
              }
            }
            this._currentColor = (this._currentColor + 1) % 2;
          }),
          commandDetection.onCommandInvalidated((commands) => {
            for (const c of commands) {
              const decorations = commandDecorations.get(c);
              if (decorations) {
                dispose(decorations);
              }
              commandDecorations.deleteAndDispose(c);
            }
          })
        );
      } else {
        if (this._state === 1 /* WaitingForCapability */) {
          return;
        }
        this._state = 1 /* WaitingForCapability */;
        this._activeDevModeDisposables.value = this._ctx.instance.capabilities.onDidAddCapabilityType((e) => {
          if (e === TerminalCapability.CommandDetection) {
            this._updateDevMode();
          }
        });
      }
    } else {
      if (this._state === 0 /* Off */) {
        return;
      }
      this._state = 0 /* Off */;
      this._activeDevModeDisposables.clear();
    }
  }
  _isEnabled() {
    return this._configurationService.getValue(TerminalSettingId.DevMode) || false;
  }
};
DevModeContribution.ID = "terminal.devMode";
DevModeContribution = __decorateClass([
  __decorateParam(1, IConfigurationService)
], DevModeContribution);
registerTerminalContribution(DevModeContribution.ID, DevModeContribution);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvZGV2ZWxvcGVyL2Jyb3dzZXIvdGVybWluYWwuZGV2ZWxvcGVyLmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB0eXBlIHsgVGVybWluYWwgfSBmcm9tICdAeHRlcm0veHRlcm0nO1xuaW1wb3J0IHsgRGVsYXllciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZU1hcCwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUsIGNvbWJpbmVkRGlzcG9zYWJsZSwgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElUZXJtaW5hbENvbW1hbmQsIFRlcm1pbmFsQ2FwYWJpbGl0eSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9jYXBhYmlsaXRpZXMvY2FwYWJpbGl0aWVzLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbExvZ1NlcnZpY2UsIFRlcm1pbmFsU2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElTdGF0dXNiYXJTZXJ2aWNlLCBTdGF0dXNiYXJBbGlnbm1lbnQsIHR5cGUgSVN0YXR1c2JhckVudHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvc3RhdHVzYmFyL2Jyb3dzZXIvc3RhdHVzYmFyLmpzJztcbmltcG9ydCB7IElJbnRlcm5hbFh0ZXJtVGVybWluYWwsIElUZXJtaW5hbENvbnRyaWJ1dGlvbiwgSVRlcm1pbmFsSW5zdGFuY2UsIElYdGVybVRlcm1pbmFsIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyByZWdpc3RlclRlcm1pbmFsQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJUZXJtaW5hbENvbnRyaWJ1dGlvbiwgdHlwZSBJVGVybWluYWxDb250cmlidXRpb25Db250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbEV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbENvbnRleHRLZXkuanMnO1xuaW1wb3J0IHsgVGVybWluYWxEZXZlbG9wZXJDb21tYW5kSWQgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWwuZGV2ZWxvcGVyLmpzJztcbmltcG9ydCAnLi9tZWRpYS9kZXZlbG9wZXIuY3NzJztcblxucmVnaXN0ZXJUZXJtaW5hbEFjdGlvbih7XG5cdGlkOiBUZXJtaW5hbERldmVsb3BlckNvbW1hbmRJZC5TaG93VGV4dHVyZUF0bGFzLFxuXHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNob3dUZXh0dXJlQXRsYXMnLCAnU2hvdyBUZXJtaW5hbCBUZXh0dXJlIEF0bGFzJyksXG5cdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkRldmVsb3Blcixcblx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5vcihUZXJtaW5hbENvbnRleHRLZXlzLmlzT3BlbiksXG5cdHJ1bjogYXN5bmMgKGMsIGFjY2Vzc29yKSA9PiB7XG5cdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRjb25zdCBvcGVuZXJTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElPcGVuZXJTZXJ2aWNlKTtcblx0XHRjb25zdCB3b3Jrc3BhY2VDb250ZXh0U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UpO1xuXHRcdGNvbnN0IGJpdG1hcCA9IGF3YWl0IGMuc2VydmljZS5hY3RpdmVJbnN0YW5jZT8ueHRlcm0/LnRleHR1cmVBdGxhcztcblx0XHRpZiAoIWJpdG1hcCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBjd2RVcmkgPSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzWzBdLnVyaTtcblx0XHRjb25zdCBmaWxlVXJpID0gVVJJLmpvaW5QYXRoKGN3ZFVyaSwgJ3RleHR1cmVBdGxhcy5wbmcnKTtcblx0XHRjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcblx0XHRjYW52YXMud2lkdGggPSBiaXRtYXAud2lkdGg7XG5cdFx0Y2FudmFzLmhlaWdodCA9IGJpdG1hcC5oZWlnaHQ7XG5cdFx0Y29uc3QgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJ2JpdG1hcHJlbmRlcmVyJyk7XG5cdFx0aWYgKCFjdHgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y3R4LnRyYW5zZmVyRnJvbUltYWdlQml0bWFwKGJpdG1hcCk7XG5cdFx0Y29uc3QgYmxvYiA9IGF3YWl0IG5ldyBQcm9taXNlPEJsb2IgfCBudWxsPigocmVzKSA9PiBjYW52YXMudG9CbG9iKHJlcykpO1xuXHRcdGlmICghYmxvYikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUoZmlsZVVyaSwgVlNCdWZmZXIud3JhcChuZXcgVWludDhBcnJheShhd2FpdCBibG9iLmFycmF5QnVmZmVyKCkpKSk7XG5cdFx0b3BlbmVyU2VydmljZS5vcGVuKGZpbGVVcmkpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJUZXJtaW5hbEFjdGlvbih7XG5cdGlkOiBUZXJtaW5hbERldmVsb3BlckNvbW1hbmRJZC5Xcml0ZURhdGFUb1Rlcm1pbmFsLFxuXHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLndyaXRlRGF0YVRvVGVybWluYWwnLCAnV3JpdGUgRGF0YSB0byBUZXJtaW5hbCcpLFxuXHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdHJ1bjogYXN5bmMgKGMsIGFjY2Vzc29yKSA9PiB7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBpbnN0YW5jZSA9IGF3YWl0IGMuc2VydmljZS5nZXRBY3RpdmVPckNyZWF0ZUluc3RhbmNlKCk7XG5cdFx0YXdhaXQgYy5zZXJ2aWNlLnJldmVhbEFjdGl2ZVRlcm1pbmFsKCk7XG5cdFx0YXdhaXQgaW5zdGFuY2UucHJvY2Vzc1JlYWR5O1xuXHRcdGlmICghaW5zdGFuY2UueHRlcm0pIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IHdyaXRlIGRhdGEgdG8gdGVybWluYWwgaWYgeHRlcm0gaXNuXFwndCBpbml0aWFsaXplZCcpO1xuXHRcdH1cblx0XHRjb25zdCBkYXRhID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UuaW5wdXQoe1xuXHRcdFx0dmFsdWU6ICcnLFxuXHRcdFx0cGxhY2VIb2xkZXI6ICdFbnRlciBkYXRhLCB1c2UgXFxcXHggdG8gZXNjYXBlJyxcblx0XHRcdHByb21wdDogbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwud3JpdGVEYXRhVG9UZXJtaW5hbC5wcm9tcHQnLCBcIkVudGVyIGRhdGEgdG8gd3JpdGUgZGlyZWN0bHkgdG8gdGhlIHRlcm1pbmFsLCBieXBhc3NpbmcgdGhlIHB0eVwiKSxcblx0XHR9KTtcblx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bGV0IGVzY2FwZWREYXRhID0gZGF0YVxuXHRcdFx0LnJlcGxhY2UoL1xcXFxuL2csICdcXG4nKVxuXHRcdFx0LnJlcGxhY2UoL1xcXFxyL2csICdcXHInKTtcblx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0Y29uc3QgbWF0Y2ggPSBlc2NhcGVkRGF0YS5tYXRjaCgvXFxcXHgoWzAtOWEtZkEtRl17Mn0pLyk7XG5cdFx0XHRpZiAobWF0Y2ggPT09IG51bGwgfHwgbWF0Y2guaW5kZXggPT09IHVuZGVmaW5lZCB8fCBtYXRjaC5sZW5ndGggPCAyKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0ZXNjYXBlZERhdGEgPSBlc2NhcGVkRGF0YS5zbGljZSgwLCBtYXRjaC5pbmRleCkgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKHBhcnNlSW50KG1hdGNoWzFdLCAxNikpICsgZXNjYXBlZERhdGEuc2xpY2UobWF0Y2guaW5kZXggKyA0KTtcblx0XHR9XG5cdFx0Y29uc3QgeHRlcm0gPSBpbnN0YW5jZS54dGVybSBhcyBhbnkgYXMgSUludGVybmFsWHRlcm1UZXJtaW5hbDtcblx0XHR4dGVybS5fd3JpdGVUZXh0KGVzY2FwZWREYXRhKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyVGVybWluYWxBY3Rpb24oe1xuXHRpZDogVGVybWluYWxEZXZlbG9wZXJDb21tYW5kSWQuUmVjb3JkU2Vzc2lvbixcblx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5yZWNvcmRTZXNzaW9uJywgJ1JlY29yZCBUZXJtaW5hbCBTZXNzaW9uJyksXG5cdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkRldmVsb3Blcixcblx0cnVuOiBhc3luYyAoYywgYWNjZXNzb3IpID0+IHtcblx0XHRjb25zdCBjbGlwYm9hcmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDbGlwYm9hcmRTZXJ2aWNlKTtcblx0XHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXHRcdGNvbnN0IHN0YXR1c2JhclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVN0YXR1c2JhclNlcnZpY2UpO1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Ly8gU2V0IHVwIHN0YXR1cyBiYXIgZW50cnlcblx0XHRjb25zdCB0ZXh0ID0gbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwucmVjb3JkU2Vzc2lvbi5yZWNvcmRpbmcnLCBcIlJlY29yZGluZyB0ZXJtaW5hbCBzZXNzaW9uLi4uXCIpO1xuXHRcdGNvbnN0IHN0YXR1c2JhckVudHJ5OiBJU3RhdHVzYmFyRW50cnkgPSB7XG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmFtZTogdGV4dCxcblx0XHRcdGFyaWFMYWJlbDogdGV4dCxcblx0XHRcdHNob3dQcm9ncmVzczogdHJ1ZVxuXHRcdH07XG5cdFx0Y29uc3Qgc3RhdHVzYmFySGFuZGxlID0gc3RhdHVzYmFyU2VydmljZS5hZGRFbnRyeShzdGF0dXNiYXJFbnRyeSwgJ3JlY29yZFNlc3Npb24nLCBTdGF0dXNiYXJBbGlnbm1lbnQuTEVGVCk7XG5cdFx0c3RvcmUuYWRkKHN0YXR1c2JhckhhbmRsZSk7XG5cblx0XHQvLyBDcmVhdGUsIHJldmVhbCBhbmQgZm9jdXMgaW5zdGFuY2Vcblx0XHRjb25zdCBpbnN0YW5jZSA9IGF3YWl0IGMuc2VydmljZS5jcmVhdGVUZXJtaW5hbCgpO1xuXHRcdGMuc2VydmljZS5zZXRBY3RpdmVJbnN0YW5jZShpbnN0YW5jZSk7XG5cdFx0YXdhaXQgYy5zZXJ2aWNlLnJldmVhbEFjdGl2ZVRlcm1pbmFsKCk7XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0aW5zdGFuY2UucHJvY2Vzc1JlYWR5LFxuXHRcdFx0aW5zdGFuY2UuZm9jdXNXaGVuUmVhZHkodHJ1ZSlcblx0XHRdKTtcblxuXHRcdC8vIFJlY29yZCBzZXNzaW9uXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnRzOiB1bmtub3duW10gPSBbXTtcblx0XHRcdGNvbnN0IGVuZFJlY29yZGluZyA9ICgpID0+IHtcblx0XHRcdFx0Y29uc3Qgc2Vzc2lvbiA9IEpTT04uc3RyaW5naWZ5KGV2ZW50cywgbnVsbCwgMik7XG5cdFx0XHRcdGNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KHNlc3Npb24pO1xuXHRcdFx0XHRzdG9yZS5kaXNwb3NlKCk7XG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdH07XG5cblxuXHRcdFx0Y29uc3QgdGltZXIgPSBzdG9yZS5hZGQobmV3IERlbGF5ZXIoNTAwMCkpO1xuXHRcdFx0c3RvcmUuYWRkKEV2ZW50LnJ1bkFuZFN1YnNjcmliZShpbnN0YW5jZS5vbkRpbWVuc2lvbnNDaGFuZ2VkLCAoKSA9PiB7XG5cdFx0XHRcdGV2ZW50cy5wdXNoKHtcblx0XHRcdFx0XHR0eXBlOiAncmVzaXplJyxcblx0XHRcdFx0XHRjb2xzOiBpbnN0YW5jZS5jb2xzLFxuXHRcdFx0XHRcdHJvd3M6IGluc3RhbmNlLnJvd3Ncblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRpbWVyLnRyaWdnZXIoZW5kUmVjb3JkaW5nKTtcblx0XHRcdH0pKTtcblx0XHRcdHN0b3JlLmFkZChjb21tYW5kU2VydmljZS5vbldpbGxFeGVjdXRlQ29tbWFuZChlID0+IHtcblx0XHRcdFx0ZXZlbnRzLnB1c2goe1xuXHRcdFx0XHRcdHR5cGU6ICdjb21tYW5kJyxcblx0XHRcdFx0XHRpZDogZS5jb21tYW5kSWQsXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aW1lci50cmlnZ2VyKGVuZFJlY29yZGluZyk7XG5cdFx0XHR9KSk7XG5cdFx0XHRzdG9yZS5hZGQoaW5zdGFuY2Uub25XaWxsRGF0YShkYXRhID0+IHtcblx0XHRcdFx0ZXZlbnRzLnB1c2goe1xuXHRcdFx0XHRcdHR5cGU6ICdvdXRwdXQnLFxuXHRcdFx0XHRcdGRhdGEsXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aW1lci50cmlnZ2VyKGVuZFJlY29yZGluZyk7XG5cdFx0XHR9KSk7XG5cdFx0XHRzdG9yZS5hZGQoaW5zdGFuY2Uub25EaWRTZW5kVGV4dChkYXRhID0+IHtcblx0XHRcdFx0ZXZlbnRzLnB1c2goe1xuXHRcdFx0XHRcdHR5cGU6ICdzZW5kVGV4dCcsXG5cdFx0XHRcdFx0ZGF0YSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRpbWVyLnRyaWdnZXIoZW5kUmVjb3JkaW5nKTtcblx0XHRcdH0pKTtcblx0XHRcdHN0b3JlLmFkZChpbnN0YW5jZS54dGVybSEucmF3Lm9uRGF0YShkYXRhID0+IHtcblx0XHRcdFx0ZXZlbnRzLnB1c2goe1xuXHRcdFx0XHRcdHR5cGU6ICdpbnB1dCcsXG5cdFx0XHRcdFx0ZGF0YSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRpbWVyLnRyaWdnZXIoZW5kUmVjb3JkaW5nKTtcblx0XHRcdH0pKTtcblx0XHRcdGxldCBjb21tYW5kRGV0ZWN0ZWRSZWdpc3RlcmVkID0gZmFsc2U7XG5cdFx0XHRzdG9yZS5hZGQoRXZlbnQucnVuQW5kU3Vic2NyaWJlKGluc3RhbmNlLmNhcGFiaWxpdGllcy5vbkRpZEFkZENhcGFiaWxpdHksIGUgPT4ge1xuXHRcdFx0XHRpZiAoY29tbWFuZERldGVjdGVkUmVnaXN0ZXJlZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBjb21tYW5kRGV0ZWN0aW9uID0gaW5zdGFuY2UuY2FwYWJpbGl0aWVzLmdldChUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbik7XG5cdFx0XHRcdGlmICghY29tbWFuZERldGVjdGlvbikge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdG9yZS5hZGQoY29tbWFuZERldGVjdGlvbi5wcm9tcHRJbnB1dE1vZGVsLm9uRGlkQ2hhbmdlSW5wdXQoZSA9PiB7XG5cdFx0XHRcdFx0ZXZlbnRzLnB1c2goe1xuXHRcdFx0XHRcdFx0dHlwZTogJ3Byb21wdElucHV0Q2hhbmdlJyxcblx0XHRcdFx0XHRcdGRhdGE6IGNvbW1hbmREZXRlY3Rpb24ucHJvbXB0SW5wdXRNb2RlbC5nZXRDb21iaW5lZFN0cmluZygpLFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdHRpbWVyLnRyaWdnZXIoZW5kUmVjb3JkaW5nKTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRjb21tYW5kRGV0ZWN0ZWRSZWdpc3RlcmVkID0gdHJ1ZTtcblx0XHRcdH0pKTtcblx0XHR9KTtcblxuXHR9XG59KTtcblxucmVnaXN0ZXJUZXJtaW5hbEFjdGlvbih7XG5cdGlkOiBUZXJtaW5hbERldmVsb3BlckNvbW1hbmRJZC5SZXN0YXJ0UHR5SG9zdCxcblx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5yZXN0YXJ0UHR5SG9zdCcsICdSZXN0YXJ0IFB0eSBIb3N0JyksXG5cdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkRldmVsb3Blcixcblx0cnVuOiBhc3luYyAoYywgYWNjZXNzb3IpID0+IHtcblx0XHRjb25zdCBsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUZXJtaW5hbExvZ1NlcnZpY2UpO1xuXHRcdGNvbnN0IGJhY2tlbmRzID0gQXJyYXkuZnJvbShjLmluc3RhbmNlU2VydmljZS5nZXRSZWdpc3RlcmVkQmFja2VuZHMoKSk7XG5cdFx0Y29uc3QgdW5yZXNwb25zaXZlQmFja2VuZHMgPSBiYWNrZW5kcy5maWx0ZXIoZSA9PiAhZS5pc1Jlc3BvbnNpdmUpO1xuXHRcdC8vIFJlc3RhcnQgb25seSB1bnJlc3BvbnNpdmUgYmFja2VuZHMgaWYgdGhlcmUgYXJlIGFueVxuXHRcdGNvbnN0IHJlc3RhcnRDYW5kaWRhdGVzID0gdW5yZXNwb25zaXZlQmFja2VuZHMubGVuZ3RoID4gMCA/IHVucmVzcG9uc2l2ZUJhY2tlbmRzIDogYmFja2VuZHM7XG5cdFx0Zm9yIChjb25zdCBiYWNrZW5kIG9mIHJlc3RhcnRDYW5kaWRhdGVzKSB7XG5cdFx0XHRsb2dTZXJ2aWNlLndhcm4oYFJlc3RhcnRpbmcgcHR5IGhvc3QgZm9yIGF1dGhvcml0eSBcIiR7YmFja2VuZC5yZW1vdGVBdXRob3JpdHl9XCJgKTtcblx0XHRcdGJhY2tlbmQucmVzdGFydFB0eUhvc3QoKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5jb25zdCBlbnVtIERldk1vZGVDb250cmlidXRpb25TdGF0ZSB7XG5cdE9mZixcblx0V2FpdGluZ0ZvckNhcGFiaWxpdHksXG5cdE9uLFxufVxuXG5jbGFzcyBEZXZNb2RlQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUZXJtaW5hbENvbnRyaWJ1dGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd0ZXJtaW5hbC5kZXZNb2RlJztcblx0c3RhdGljIGdldChpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UpOiBEZXZNb2RlQ29udHJpYnV0aW9uIHwgbnVsbCB7XG5cdFx0cmV0dXJuIGluc3RhbmNlLmdldENvbnRyaWJ1dGlvbjxEZXZNb2RlQ29udHJpYnV0aW9uPihEZXZNb2RlQ29udHJpYnV0aW9uLklEKTtcblx0fVxuXG5cdHByaXZhdGUgX3h0ZXJtOiBJWHRlcm1UZXJtaW5hbCAmIHsgcmF3OiBUZXJtaW5hbCB9IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hY3RpdmVEZXZNb2RlRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdHByaXZhdGUgX2N1cnJlbnRDb2xvciA9IDA7XG5cblx0cHJpdmF0ZSBfc3RhdGU6IERldk1vZGVDb250cmlidXRpb25TdGF0ZSA9IERldk1vZGVDb250cmlidXRpb25TdGF0ZS5PZmY7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY3R4OiBJVGVybWluYWxDb250cmlidXRpb25Db250ZXh0LFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUZXJtaW5hbFNldHRpbmdJZC5EZXZNb2RlKSkge1xuXHRcdFx0XHR0aGlzLl91cGRhdGVEZXZNb2RlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0eHRlcm1SZWFkeSh4dGVybTogSVh0ZXJtVGVybWluYWwgJiB7IHJhdzogVGVybWluYWwgfSk6IHZvaWQge1xuXHRcdHRoaXMuX3h0ZXJtID0geHRlcm07XG5cdFx0dGhpcy5fdXBkYXRlRGV2TW9kZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlRGV2TW9kZSgpIHtcblx0XHRjb25zdCBkZXZNb2RlOiBib29sZWFuID0gdGhpcy5faXNFbmFibGVkKCk7XG5cdFx0dGhpcy5feHRlcm0/LnJhdy5lbGVtZW50Py5jbGFzc0xpc3QudG9nZ2xlKCdkZXYtbW9kZScsIGRldk1vZGUpO1xuXG5cdFx0Y29uc3QgY29tbWFuZERldGVjdGlvbiA9IHRoaXMuX2N0eC5pbnN0YW5jZS5jYXBhYmlsaXRpZXMuZ2V0KFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKTtcblx0XHRpZiAoZGV2TW9kZSkge1xuXHRcdFx0aWYgKGNvbW1hbmREZXRlY3Rpb24pIHtcblx0XHRcdFx0aWYgKHRoaXMuX3N0YXRlID09PSBEZXZNb2RlQ29udHJpYnV0aW9uU3RhdGUuT24pIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fc3RhdGUgPSBEZXZNb2RlQ29udHJpYnV0aW9uU3RhdGUuT247XG5cdFx0XHRcdGNvbnN0IGNvbW1hbmREZWNvcmF0aW9ucyA9IG5ldyBEaXNwb3NhYmxlTWFwPElUZXJtaW5hbENvbW1hbmQsIElEaXNwb3NhYmxlPigpO1xuXHRcdFx0XHRjb25zdCBvdGhlckRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0XHR0aGlzLl9hY3RpdmVEZXZNb2RlRGlzcG9zYWJsZXMudmFsdWUgPSBjb21iaW5lZERpc3Bvc2FibGUoXG5cdFx0XHRcdFx0Y29tbWFuZERlY29yYXRpb25zLFxuXHRcdFx0XHRcdG90aGVyRGlzcG9zYWJsZXMsXG5cdFx0XHRcdFx0Ly8gUHJvbXB0IGlucHV0XG5cdFx0XHRcdFx0dGhpcy5fY3R4Lmluc3RhbmNlLm9uRGlkQmx1cigoKSA9PiB0aGlzLl91cGRhdGVEZXZNb2RlKCkpLFxuXHRcdFx0XHRcdHRoaXMuX2N0eC5pbnN0YW5jZS5vbkRpZEZvY3VzKCgpID0+IHRoaXMuX3VwZGF0ZURldk1vZGUoKSksXG5cdFx0XHRcdFx0Y29tbWFuZERldGVjdGlvbi5wcm9tcHRJbnB1dE1vZGVsLm9uRGlkQ2hhbmdlSW5wdXQoKCkgPT4gdGhpcy5fdXBkYXRlRGV2TW9kZSgpKSxcblx0XHRcdFx0XHQvLyBTZXF1ZW5jZSBtYXJrZXJzXG5cdFx0XHRcdFx0Y29tbWFuZERldGVjdGlvbi5vbkNvbW1hbmRGaW5pc2hlZChjb21tYW5kID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGNvbG9yQ2xhc3MgPSBgY29sb3ItJHt0aGlzLl9jdXJyZW50Q29sb3J9YDtcblx0XHRcdFx0XHRcdGNvbnN0IGRlY29yYXRpb25zOiBJRGlzcG9zYWJsZVtdID0gW107XG5cdFx0XHRcdFx0XHRjb21tYW5kRGVjb3JhdGlvbnMuc2V0KGNvbW1hbmQsIGNvbWJpbmVkRGlzcG9zYWJsZSguLi5kZWNvcmF0aW9ucykpO1xuXHRcdFx0XHRcdFx0aWYgKGNvbW1hbmQucHJvbXB0U3RhcnRNYXJrZXIpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgZCA9IHRoaXMuX2N0eC5pbnN0YW5jZS54dGVybSEucmF3Py5yZWdpc3RlckRlY29yYXRpb24oe1xuXHRcdFx0XHRcdFx0XHRcdG1hcmtlcjogY29tbWFuZC5wcm9tcHRTdGFydE1hcmtlclxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0aWYgKGQpIHtcblx0XHRcdFx0XHRcdFx0XHRkZWNvcmF0aW9ucy5wdXNoKGQpO1xuXHRcdFx0XHRcdFx0XHRcdG90aGVyRGlzcG9zYWJsZXMuYWRkKGQub25SZW5kZXIoZSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRlLnRleHRDb250ZW50ID0gJ0EnO1xuXHRcdFx0XHRcdFx0XHRcdFx0ZS5jbGFzc0xpc3QuYWRkKCd4dGVybS1zZXF1ZW5jZS1kZWNvcmF0aW9uJywgJ3RvcCcsICdsZWZ0JywgY29sb3JDbGFzcyk7XG5cdFx0XHRcdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoY29tbWFuZC5tYXJrZXIpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgZCA9IHRoaXMuX2N0eC5pbnN0YW5jZS54dGVybSEucmF3Py5yZWdpc3RlckRlY29yYXRpb24oe1xuXHRcdFx0XHRcdFx0XHRcdG1hcmtlcjogY29tbWFuZC5tYXJrZXIsXG5cdFx0XHRcdFx0XHRcdFx0eDogY29tbWFuZC5zdGFydFhcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdGlmIChkKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZGVjb3JhdGlvbnMucHVzaChkKTtcblx0XHRcdFx0XHRcdFx0XHRvdGhlckRpc3Bvc2FibGVzLmFkZChkLm9uUmVuZGVyKGUgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZS50ZXh0Q29udGVudCA9ICdCJztcblx0XHRcdFx0XHRcdFx0XHRcdGUuY2xhc3NMaXN0LmFkZCgneHRlcm0tc2VxdWVuY2UtZGVjb3JhdGlvbicsICd0b3AnLCAncmlnaHQnLCBjb2xvckNsYXNzKTtcblx0XHRcdFx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChjb21tYW5kLmV4ZWN1dGVkTWFya2VyKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGQgPSB0aGlzLl9jdHguaW5zdGFuY2UueHRlcm0hLnJhdz8ucmVnaXN0ZXJEZWNvcmF0aW9uKHtcblx0XHRcdFx0XHRcdFx0XHRtYXJrZXI6IGNvbW1hbmQuZXhlY3V0ZWRNYXJrZXIsXG5cdFx0XHRcdFx0XHRcdFx0eDogY29tbWFuZC5leGVjdXRlZFhcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdGlmIChkKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZGVjb3JhdGlvbnMucHVzaChkKTtcblx0XHRcdFx0XHRcdFx0XHRvdGhlckRpc3Bvc2FibGVzLmFkZChkLm9uUmVuZGVyKGUgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZS50ZXh0Q29udGVudCA9ICdDJztcblx0XHRcdFx0XHRcdFx0XHRcdGUuY2xhc3NMaXN0LmFkZCgneHRlcm0tc2VxdWVuY2UtZGVjb3JhdGlvbicsICdib3R0b20nLCAnbGVmdCcsIGNvbG9yQ2xhc3MpO1xuXHRcdFx0XHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGNvbW1hbmQuZW5kTWFya2VyKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGQgPSB0aGlzLl9jdHguaW5zdGFuY2UueHRlcm0hLnJhdz8ucmVnaXN0ZXJEZWNvcmF0aW9uKHtcblx0XHRcdFx0XHRcdFx0XHRtYXJrZXI6IGNvbW1hbmQuZW5kTWFya2VyXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRpZiAoZCkge1xuXHRcdFx0XHRcdFx0XHRcdGRlY29yYXRpb25zLnB1c2goZCk7XG5cdFx0XHRcdFx0XHRcdFx0b3RoZXJEaXNwb3NhYmxlcy5hZGQoZC5vblJlbmRlcihlID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdGUudGV4dENvbnRlbnQgPSAnRCc7XG5cdFx0XHRcdFx0XHRcdFx0XHRlLmNsYXNzTGlzdC5hZGQoJ3h0ZXJtLXNlcXVlbmNlLWRlY29yYXRpb24nLCAnYm90dG9tJywgJ3JpZ2h0JywgY29sb3JDbGFzcyk7XG5cdFx0XHRcdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR0aGlzLl9jdXJyZW50Q29sb3IgPSAodGhpcy5fY3VycmVudENvbG9yICsgMSkgJSAyO1xuXHRcdFx0XHRcdH0pLFxuXHRcdFx0XHRcdGNvbW1hbmREZXRlY3Rpb24ub25Db21tYW5kSW52YWxpZGF0ZWQoY29tbWFuZHMgPT4ge1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBjIG9mIGNvbW1hbmRzKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGRlY29yYXRpb25zID0gY29tbWFuZERlY29yYXRpb25zLmdldChjKTtcblx0XHRcdFx0XHRcdFx0aWYgKGRlY29yYXRpb25zKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZGlzcG9zZShkZWNvcmF0aW9ucyk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0Y29tbWFuZERlY29yYXRpb25zLmRlbGV0ZUFuZERpc3Bvc2UoYyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICh0aGlzLl9zdGF0ZSA9PT0gRGV2TW9kZUNvbnRyaWJ1dGlvblN0YXRlLldhaXRpbmdGb3JDYXBhYmlsaXR5KSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3N0YXRlID0gRGV2TW9kZUNvbnRyaWJ1dGlvblN0YXRlLldhaXRpbmdGb3JDYXBhYmlsaXR5O1xuXHRcdFx0XHR0aGlzLl9hY3RpdmVEZXZNb2RlRGlzcG9zYWJsZXMudmFsdWUgPSB0aGlzLl9jdHguaW5zdGFuY2UuY2FwYWJpbGl0aWVzLm9uRGlkQWRkQ2FwYWJpbGl0eVR5cGUoZSA9PiB7XG5cdFx0XHRcdFx0aWYgKGUgPT09IFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl91cGRhdGVEZXZNb2RlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHRoaXMuX3N0YXRlID09PSBEZXZNb2RlQ29udHJpYnV0aW9uU3RhdGUuT2ZmKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3N0YXRlID0gRGV2TW9kZUNvbnRyaWJ1dGlvblN0YXRlLk9mZjtcblx0XHRcdHRoaXMuX2FjdGl2ZURldk1vZGVEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2lzRW5hYmxlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGVybWluYWxTZXR0aW5nSWQuRGV2TW9kZSkgfHwgZmFsc2U7XG5cdH1cbn1cblxucmVnaXN0ZXJUZXJtaW5hbENvbnRyaWJ1dGlvbihEZXZNb2RlQ29udHJpYnV0aW9u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SyxtQkFBbUI7QUFBQSxnQkFDM0QsUUFBUSxRQUFRO0FBQUEsZ0JBQ2hCLEdBQUcsUUFBUTtBQUFBLGNBQ1osQ0FBQztBQUNELGtCQUFJLEdBQUc7QUFDTiw0QkFBWSxLQUFLLENBQUM7QUFDbEIsaUNBQWlCLElBQUksRUFBRSxTQUFTLE9BQUs7QUFDcEMsb0JBQUUsY0FBYztBQUNoQixvQkFBRSxVQUFVLElBQUksNkJBQTZCLFVBQVUsUUFBUSxVQUFVO0FBQUEsZ0JBQzFFLENBQUMsQ0FBQztBQUFBLGNBQ0g7QUFBQSxZQUNEO0FBQ0EsZ0JBQUksUUFBUSxXQUFXO0FBQ3RCLG9CQUFNLElBQUksS0FBSyxLQUFLLFNBQVMsTUFBTyxLQUFLLG1CQUFtQjtBQUFBLGdCQUMzRCxRQUFRLFFBQVE7QUFBQSxjQUNqQixDQUFDO0FBQ0Qsa0JBQUksR0FBRztBQUNOLDRCQUFZLEtBQUssQ0FBQztBQUNsQixpQ0FBaUIsSUFBSSxFQUFFLFNBQVMsT0FBSztBQUNwQyxvQkFBRSxjQUFjO0FBQ2hCLG9CQUFFLFVBQVUsSUFBSSw2QkFBNkIsVUFBVSxTQUFTLFVBQVU7QUFBQSxnQkFDM0UsQ0FBQyxDQUFDO0FBQUEsY0FDSDtBQUFBLFlBQ0Q7QUFDQSxpQkFBSyxpQkFBaUIsS0FBSyxnQkFBZ0IsS0FBSztBQUFBLFVBQ2pELENBQUM7QUFBQSxVQUNELGlCQUFpQixxQkFBcUIsY0FBWTtBQUNqRCx1QkFBVyxLQUFLLFVBQVU7QUFDekIsb0JBQU0sY0FBYyxtQkFBbUIsSUFBSSxDQUFDO0FBQzVDLGtCQUFJLGFBQWE7QUFDaEIsd0JBQVEsV0FBVztBQUFBLGNBQ3BCO0FBQ0EsaUNBQW1CLGlCQUFpQixDQUFDO0FBQUEsWUFDdEM7QUFBQSxVQUNELENBQUM7QUFBQSxRQUNGO0FBQUEsTUFDRCxPQUFPO0FBQ04sWUFBSSxLQUFLLFdBQVcsOEJBQStDO0FBQ2xFO0FBQUEsUUFDRDtBQUNBLGFBQUssU0FBUztBQUNkLGFBQUssMEJBQTBCLFFBQVEsS0FBSyxLQUFLLFNBQVMsYUFBYSx1QkFBdUIsT0FBSztBQUNsRyxjQUFJLE1BQU0sbUJBQW1CLGtCQUFrQjtBQUM5QyxpQkFBSyxlQUFlO0FBQUEsVUFDckI7QUFBQSxRQUNELENBQUM7QUFBQSxNQUNGO0FBQUEsSUFDRCxPQUFPO0FBQ04sVUFBSSxLQUFLLFdBQVcsYUFBOEI7QUFDakQ7QUFBQSxNQUNEO0FBQ0EsV0FBSyxTQUFTO0FBQ2QsV0FBSywwQkFBMEIsTUFBTTtBQUFBLElBQ3RDO0FBQUEsRUFDRDtBQUFBLEVBRVEsYUFBc0I7QUFDN0IsV0FBTyxLQUFLLHNCQUFzQixTQUFTLGtCQUFrQixPQUFPLEtBQUs7QUFBQSxFQUMxRTtBQUNEO0FBM0lNLG9CQUNXLEtBQUs7QUFEaEIsc0JBQU47QUFBQSxFQWNHO0FBQUEsR0FkRztBQTZJTiw2QkFBNkIsb0JBQW9CLElBQUksbUJBQW1COyIsCiAgIm5hbWVzIjogWyJlIiwgIkRldk1vZGVDb250cmlidXRpb25TdGF0ZSJdCn0K
