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
import * as nls from "../../../../nls.js";
import * as paths from "../../../../base/common/path.js";
import { DEFAULT_TERMINAL_OSX } from "../../../../platform/externalTerminal/common/externalTerminal.js";
import { MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { KeyMod, KeyCode } from "../../../../base/common/keyCodes.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { Schemas } from "../../../../base/common/network.js";
import { Extensions, ConfigurationScope } from "../../../../platform/configuration/common/configurationRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { IExternalTerminalService } from "../../../../platform/externalTerminal/electron-sandbox/externalTerminalService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { TerminalContextKeys } from "../../terminal/common/terminalContextKey.js";
import { IRemoteAuthorityResolverService } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
const OPEN_NATIVE_CONSOLE_COMMAND_ID = "workbench.action.terminal.openNativeConsole";
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: OPEN_NATIVE_CONSOLE_COMMAND_ID,
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyC,
  when: TerminalContextKeys.notFocus,
  weight: KeybindingWeight.WorkbenchContrib,
  handler: async (accessor) => {
    const historyService = accessor.get(IHistoryService);
    const terminalService = accessor.get(IExternalTerminalService);
    const configurationService = accessor.get(IConfigurationService);
    const remoteAuthorityResolverService = accessor.get(IRemoteAuthorityResolverService);
    const root = historyService.getLastActiveWorkspaceRoot();
    const config = configurationService.getValue("terminal.external");
    if (root?.scheme === Schemas.file) {
      terminalService.openTerminal(config, root.fsPath);
      return;
    }
    try {
      if (root?.scheme === Schemas.vscodeRemote) {
        const canonicalUri = await remoteAuthorityResolverService.getCanonicalURI(root);
        if (canonicalUri.scheme === Schemas.file) {
          terminalService.openTerminal(config, canonicalUri.fsPath);
          return;
        }
      }
    } catch {
    }
    const activeFile = historyService.getLastActiveFile(Schemas.file);
    if (activeFile?.scheme === Schemas.file) {
      terminalService.openTerminal(config, paths.dirname(activeFile.fsPath));
      return;
    }
    try {
      if (activeFile?.scheme === Schemas.vscodeRemote) {
        const canonicalUri = await remoteAuthorityResolverService.getCanonicalURI(activeFile);
        if (canonicalUri.scheme === Schemas.file) {
          terminalService.openTerminal(config, canonicalUri.fsPath);
          return;
        }
      }
    } catch {
    }
    terminalService.openTerminal(config, void 0);
  }
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: OPEN_NATIVE_CONSOLE_COMMAND_ID,
    title: nls.localize2("globalConsoleAction", "Open New External Terminal")
  }
});
let ExternalTerminalContribution = class {
  constructor(_externalTerminalService) {
    this._externalTerminalService = _externalTerminalService;
    this._updateConfiguration();
  }
  async _updateConfiguration() {
    const terminals = await this._externalTerminalService.getDefaultTerminalForPlatforms();
    const configurationRegistry = Registry.as(Extensions.Configuration);
    const terminalKindProperties = {
      type: "string",
      enum: [
        "integrated",
        "external",
        "both"
      ],
      enumDescriptions: [
        nls.localize("terminal.kind.integrated", "Show the integrated terminal action."),
        nls.localize("terminal.kind.external", "Show the external terminal action."),
        nls.localize("terminal.kind.both", "Show both integrated and external terminal actions.")
      ],
      default: "integrated"
    };
    configurationRegistry.registerConfiguration({
      id: "externalTerminal",
      order: 100,
      title: nls.localize("terminalConfigurationTitle", "External Terminal"),
      type: "object",
      properties: {
        "terminal.explorerKind": {
          ...terminalKindProperties,
          description: nls.localize("explorer.openInTerminalKind", "When opening a file from the Explorer in a terminal, determines what kind of terminal will be launched")
        },
        "terminal.sourceControlRepositoriesKind": {
          ...terminalKindProperties,
          description: nls.localize("sourceControlRepositories.openInTerminalKind", "When opening a repository from the Source Control Repositories view in a terminal, determines what kind of terminal will be launched")
        },
        "terminal.external.windowsExec": {
          type: "string",
          description: nls.localize("terminal.external.windowsExec", "Customizes which terminal to run on Windows."),
          default: terminals.windows,
          scope: ConfigurationScope.APPLICATION
        },
        "terminal.external.osxExec": {
          type: "string",
          description: nls.localize("terminal.external.osxExec", "Customizes which terminal application to run on macOS."),
          default: DEFAULT_TERMINAL_OSX,
          scope: ConfigurationScope.APPLICATION
        },
        "terminal.external.linuxExec": {
          type: "string",
          description: nls.localize("terminal.external.linuxExec", "Customizes which terminal to run on Linux."),
          default: terminals.linux,
          scope: ConfigurationScope.APPLICATION
        }
      }
    });
  }
};
ExternalTerminalContribution = __decorateClass([
  __decorateParam(0, IExternalTerminalService)
], ExternalTerminalContribution);
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(ExternalTerminalContribution, LifecyclePhase.Restored);
export {
  ExternalTerminalContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlcm5hbFRlcm1pbmFsL2VsZWN0cm9uLXNhbmRib3gvZXh0ZXJuYWxUZXJtaW5hbC5jb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCAqIGFzIHBhdGhzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgREVGQVVMVF9URVJNSU5BTF9PU1gsIElFeHRlcm5hbFRlcm1pbmFsU2V0dGluZ3MgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlcm5hbFRlcm1pbmFsL2NvbW1vbi9leHRlcm5hbFRlcm1pbmFsLmpzJztcbmltcG9ydCB7IE1lbnVJZCwgTWVudVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBLZXlNb2QsIEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBJSGlzdG9yeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9oaXN0b3J5L2NvbW1vbi9oaXN0b3J5LmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzUmVnaXN0cnksIEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uUmVnaXN0cnksIEV4dGVuc2lvbnMsIENvbmZpZ3VyYXRpb25TY29wZSwgdHlwZSBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24sIElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElFeHRlcm5hbFRlcm1pbmFsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVybmFsVGVybWluYWwvZWxlY3Ryb24tc2FuZGJveC9leHRlcm5hbFRlcm1pbmFsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi90ZXJtaW5hbC9jb21tb24vdGVybWluYWxDb250ZXh0S2V5LmpzJztcbmltcG9ydCB7IElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUF1dGhvcml0eVJlc29sdmVyLmpzJztcbmltcG9ydCB7IExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuXG5jb25zdCBPUEVOX05BVElWRV9DT05TT0xFX0NPTU1BTkRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5vcGVuTmF0aXZlQ29uc29sZSc7XG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6IE9QRU5fTkFUSVZFX0NPTlNPTEVfQ09NTUFORF9JRCxcblx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleUMsXG5cdHdoZW46IFRlcm1pbmFsQ29udGV4dEtleXMubm90Rm9jdXMsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3IpID0+IHtcblx0XHRjb25zdCBoaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJSGlzdG9yeVNlcnZpY2UpO1xuXHRcdC8vIE9wZW4gZXh0ZXJuYWwgdGVybWluYWwgaW4gbG9jYWwgd29ya3NwYWNlc1xuXHRcdGNvbnN0IHRlcm1pbmFsU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UpO1xuXHRcdGNvbnN0IHJvb3QgPSBoaXN0b3J5U2VydmljZS5nZXRMYXN0QWN0aXZlV29ya3NwYWNlUm9vdCgpO1xuXHRcdGNvbnN0IGNvbmZpZyA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElFeHRlcm5hbFRlcm1pbmFsU2V0dGluZ3M+KCd0ZXJtaW5hbC5leHRlcm5hbCcpO1xuXG5cdFx0Ly8gSXQncyBhIGxvY2FsIHdvcmtzcGFjZSwgb3BlbiB0aGUgcm9vdFxuXHRcdGlmIChyb290Py5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0dGVybWluYWxTZXJ2aWNlLm9wZW5UZXJtaW5hbChjb25maWcsIHJvb3QuZnNQYXRoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBJZiBpdCdzIGEgcmVtb3RlIHdvcmtzcGFjZSwgb3BlbiB0aGUgY2Fub25pY2FsIFVSSSBpZiBpdCBpcyBhIGxvY2FsIGZvbGRlclxuXHRcdHRyeSB7XG5cdFx0XHRpZiAocm9vdD8uc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZVJlbW90ZSkge1xuXHRcdFx0XHRjb25zdCBjYW5vbmljYWxVcmkgPSBhd2FpdCByZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UuZ2V0Q2Fub25pY2FsVVJJKHJvb3QpO1xuXHRcdFx0XHRpZiAoY2Fub25pY2FsVXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRcdFx0dGVybWluYWxTZXJ2aWNlLm9wZW5UZXJtaW5hbChjb25maWcsIGNhbm9uaWNhbFVyaS5mc1BhdGgpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggeyB9XG5cblx0XHQvLyBPcGVuIHRoZSBjdXJyZW50IGZpbGUncyBmb2xkZXIgaWYgaXQncyBsb2NhbCBvciBpdHMgY2Fub25pY2FsIFVSSSBpcyBsb2NhbFxuXHRcdC8vIE9wZW5zIGN1cnJlbnQgZmlsZSdzIGZvbGRlciwgaWYgbm8gZm9sZGVyIGlzIG9wZW4gaW4gZWRpdG9yXG5cdFx0Y29uc3QgYWN0aXZlRmlsZSA9IGhpc3RvcnlTZXJ2aWNlLmdldExhc3RBY3RpdmVGaWxlKFNjaGVtYXMuZmlsZSk7XG5cdFx0aWYgKGFjdGl2ZUZpbGU/LnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHR0ZXJtaW5hbFNlcnZpY2Uub3BlblRlcm1pbmFsKGNvbmZpZywgcGF0aHMuZGlybmFtZShhY3RpdmVGaWxlLmZzUGF0aCkpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0cnkge1xuXHRcdFx0aWYgKGFjdGl2ZUZpbGU/LnNjaGVtZSA9PT0gU2NoZW1hcy52c2NvZGVSZW1vdGUpIHtcblx0XHRcdFx0Y29uc3QgY2Fub25pY2FsVXJpID0gYXdhaXQgcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLmdldENhbm9uaWNhbFVSSShhY3RpdmVGaWxlKTtcblx0XHRcdFx0aWYgKGNhbm9uaWNhbFVyaS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0XHRcdHRlcm1pbmFsU2VydmljZS5vcGVuVGVybWluYWwoY29uZmlnLCBjYW5vbmljYWxVcmkuZnNQYXRoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGNhdGNoIHsgfVxuXG5cdFx0Ly8gRmFsbGJhY2sgdG8gb3BlbmluZyB3aXRob3V0IGEgY3dkIHdoaWNoIHdpbGwgZW5kIHVwIHVzaW5nIHRoZSBsb2NhbCBob21lIHBhdGhcblx0XHR0ZXJtaW5hbFNlcnZpY2Uub3BlblRlcm1pbmFsKGNvbmZpZywgdW5kZWZpbmVkKTtcblx0fVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQ29tbWFuZFBhbGV0dGUsIHtcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBPUEVOX05BVElWRV9DT05TT0xFX0NPTU1BTkRfSUQsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ2dsb2JhbENvbnNvbGVBY3Rpb24nLCBcIk9wZW4gTmV3IEV4dGVybmFsIFRlcm1pbmFsXCIpXG5cdH1cbn0pO1xuXG5leHBvcnQgY2xhc3MgRXh0ZXJuYWxUZXJtaW5hbENvbnRyaWJ1dGlvbiBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHB1YmxpYyBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdGNvbnN0cnVjdG9yKEBJRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2U6IElFeHRlcm5hbFRlcm1pbmFsU2VydmljZSkge1xuXHRcdHRoaXMuX3VwZGF0ZUNvbmZpZ3VyYXRpb24oKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3VwZGF0ZUNvbmZpZ3VyYXRpb24oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdGVybWluYWxzID0gYXdhaXQgdGhpcy5fZXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UuZ2V0RGVmYXVsdFRlcm1pbmFsRm9yUGxhdGZvcm1zKCk7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKTtcblx0XHRjb25zdCB0ZXJtaW5hbEtpbmRQcm9wZXJ0aWVzOiBQYXJ0aWFsPElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWE+ID0ge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbXG5cdFx0XHRcdCdpbnRlZ3JhdGVkJyxcblx0XHRcdFx0J2V4dGVybmFsJyxcblx0XHRcdFx0J2JvdGgnXG5cdFx0XHRdLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRubHMubG9jYWxpemUoJ3Rlcm1pbmFsLmtpbmQuaW50ZWdyYXRlZCcsIFwiU2hvdyB0aGUgaW50ZWdyYXRlZCB0ZXJtaW5hbCBhY3Rpb24uXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3Rlcm1pbmFsLmtpbmQuZXh0ZXJuYWwnLCBcIlNob3cgdGhlIGV4dGVybmFsIHRlcm1pbmFsIGFjdGlvbi5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgndGVybWluYWwua2luZC5ib3RoJywgXCJTaG93IGJvdGggaW50ZWdyYXRlZCBhbmQgZXh0ZXJuYWwgdGVybWluYWwgYWN0aW9ucy5cIilcblx0XHRcdF0sXG5cdFx0XHRkZWZhdWx0OiAnaW50ZWdyYXRlZCdcblx0XHR9O1xuXHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdFx0aWQ6ICdleHRlcm5hbFRlcm1pbmFsJyxcblx0XHRcdG9yZGVyOiAxMDAsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCd0ZXJtaW5hbENvbmZpZ3VyYXRpb25UaXRsZScsIFwiRXh0ZXJuYWwgVGVybWluYWxcIiksXG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0J3Rlcm1pbmFsLmV4cGxvcmVyS2luZCc6IHtcblx0XHRcdFx0XHQuLi50ZXJtaW5hbEtpbmRQcm9wZXJ0aWVzLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2V4cGxvcmVyLm9wZW5JblRlcm1pbmFsS2luZCcsIFwiV2hlbiBvcGVuaW5nIGEgZmlsZSBmcm9tIHRoZSBFeHBsb3JlciBpbiBhIHRlcm1pbmFsLCBkZXRlcm1pbmVzIHdoYXQga2luZCBvZiB0ZXJtaW5hbCB3aWxsIGJlIGxhdW5jaGVkXCIpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQndGVybWluYWwuc291cmNlQ29udHJvbFJlcG9zaXRvcmllc0tpbmQnOiB7XG5cdFx0XHRcdFx0Li4udGVybWluYWxLaW5kUHJvcGVydGllcyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzb3VyY2VDb250cm9sUmVwb3NpdG9yaWVzLm9wZW5JblRlcm1pbmFsS2luZCcsIFwiV2hlbiBvcGVuaW5nIGEgcmVwb3NpdG9yeSBmcm9tIHRoZSBTb3VyY2UgQ29udHJvbCBSZXBvc2l0b3JpZXMgdmlldyBpbiBhIHRlcm1pbmFsLCBkZXRlcm1pbmVzIHdoYXQga2luZCBvZiB0ZXJtaW5hbCB3aWxsIGJlIGxhdW5jaGVkXCIpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQndGVybWluYWwuZXh0ZXJuYWwud2luZG93c0V4ZWMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndGVybWluYWwuZXh0ZXJuYWwud2luZG93c0V4ZWMnLCBcIkN1c3RvbWl6ZXMgd2hpY2ggdGVybWluYWwgdG8gcnVuIG9uIFdpbmRvd3MuXCIpLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRlcm1pbmFscy53aW5kb3dzLFxuXHRcdFx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT05cblx0XHRcdFx0fSxcblx0XHRcdFx0J3Rlcm1pbmFsLmV4dGVybmFsLm9zeEV4ZWMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndGVybWluYWwuZXh0ZXJuYWwub3N4RXhlYycsIFwiQ3VzdG9taXplcyB3aGljaCB0ZXJtaW5hbCBhcHBsaWNhdGlvbiB0byBydW4gb24gbWFjT1MuXCIpLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IERFRkFVTFRfVEVSTUlOQUxfT1NYLFxuXHRcdFx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT05cblx0XHRcdFx0fSxcblx0XHRcdFx0J3Rlcm1pbmFsLmV4dGVybmFsLmxpbnV4RXhlYyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd0ZXJtaW5hbC5leHRlcm5hbC5saW51eEV4ZWMnLCBcIkN1c3RvbWl6ZXMgd2hpY2ggdGVybWluYWwgdG8gcnVuIG9uIExpbnV4LlwiKSxcblx0XHRcdFx0XHRkZWZhdWx0OiB0ZXJtaW5hbHMubGludXgsXG5cdFx0XHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTlxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuLy8gUmVnaXN0ZXIgd29ya2JlbmNoIGNvbnRyaWJ1dGlvbnNcbmNvbnN0IHdvcmtiZW5jaFJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpO1xud29ya2JlbmNoUmVnaXN0cnkucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oRXh0ZXJuYWxUZXJtaW5hbENvbnRyaWJ1dGlvbiwgTGlmZWN5Y2xlUGhhc2UuUmVzdG9yZWQpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsNEJBQXVEO0FBQ2hFLFNBQVMsUUFBUSxvQkFBb0I7QUFDckMsU0FBUyxRQUFRLGVBQWU7QUFDaEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxxQkFBcUIsd0JBQXdCO0FBQ3RELFNBQVMsZUFBZTtBQUN4QixTQUFpQyxZQUFZLDBCQUE2RDtBQUMxRyxTQUFTLGdCQUFnQjtBQUN6QixTQUFrRSxjQUFjLDJCQUEyQjtBQUMzRyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLHNCQUFzQjtBQUUvQixNQUFNLGlDQUFpQztBQUN2QyxvQkFBb0IsaUNBQWlDO0FBQUEsRUFDcEQsSUFBSTtBQUFBLEVBQ0osU0FBUyxPQUFPLFVBQVUsT0FBTyxRQUFRLFFBQVE7QUFBQSxFQUNqRCxNQUFN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
