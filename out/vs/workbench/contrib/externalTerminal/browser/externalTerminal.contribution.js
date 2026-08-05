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
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { URI } from "../../../../base/common/uri.js";
import { MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { ITerminalGroupService, ITerminalService as IIntegratedTerminalService } from "../../terminal/browser/terminal.js";
import { ResourceContextKey } from "../../../common/contextkeys.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { getMultiSelectedResources, IExplorerService } from "../../files/browser/files.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { Schemas } from "../../../../base/common/network.js";
import { distinct } from "../../../../base/common/arrays.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isWindows } from "../../../../base/common/platform.js";
import { dirname, basename } from "../../../../base/common/path.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IExternalTerminalService } from "../../../../platform/externalTerminal/common/externalTerminal.js";
import { TerminalLocation } from "../../../../platform/terminal/common/terminal.js";
import { IListService } from "../../../../platform/list/browser/listService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
const OPEN_IN_TERMINAL_COMMAND_ID = "openInTerminal";
const OPEN_IN_INTEGRATED_TERMINAL_COMMAND_ID = "openInIntegratedTerminal";
function registerOpenTerminalCommand(id, explorerKind) {
  CommandsRegistry.registerCommand({
    id,
    handler: async (accessor, resource) => {
      const configurationService = accessor.get(IConfigurationService);
      const fileService = accessor.get(IFileService);
      const integratedTerminalService = accessor.get(IIntegratedTerminalService);
      const remoteAgentService = accessor.get(IRemoteAgentService);
      const terminalGroupService = accessor.get(ITerminalGroupService);
      let externalTerminalService = void 0;
      try {
        externalTerminalService = accessor.get(IExternalTerminalService);
      } catch {
      }
      const resources = getMultiSelectedResources(resource, accessor.get(IListService), accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IExplorerService));
      return fileService.resolveAll(resources.map((r) => ({ resource: r }))).then(async (stats) => {
        const config = configurationService.getValue();
        const useIntegratedTerminal = remoteAgentService.getConnection() || explorerKind === "integrated";
        const targets = distinct(stats.filter((data) => data.success));
        if (useIntegratedTerminal) {
          const opened = {};
          const cwds = targets.map(({ stat }) => {
            const resource2 = stat.resource;
            if (stat.isDirectory) {
              return resource2;
            }
            return URI.from({
              scheme: resource2.scheme,
              authority: resource2.authority,
              fragment: resource2.fragment,
              query: resource2.query,
              path: dirname(resource2.path)
            });
          });
          for (const cwd of cwds) {
            if (opened[cwd.path]) {
              return;
            }
            opened[cwd.path] = true;
            const instance = await integratedTerminalService.createTerminal({ config: { cwd } });
            if (instance && instance.target !== TerminalLocation.Editor && (resources.length === 1 || !resource || cwd.path === resource.path || cwd.path === dirname(resource.path))) {
              integratedTerminalService.setActiveInstance(instance);
              terminalGroupService.showPanel(true);
            }
          }
        } else if (externalTerminalService) {
          distinct(targets.map(({ stat }) => stat.isDirectory ? stat.resource.fsPath : dirname(stat.resource.fsPath))).forEach((cwd) => {
            externalTerminalService.openTerminal(config.terminal.external, cwd);
          });
        }
      });
    }
  });
}
registerOpenTerminalCommand(OPEN_IN_TERMINAL_COMMAND_ID, "external");
registerOpenTerminalCommand(OPEN_IN_INTEGRATED_TERMINAL_COMMAND_ID, "integrated");
let ExternalTerminalContribution = class extends Disposable {
  constructor(_configurationService) {
    super();
    this._configurationService = _configurationService;
    const shouldShowIntegratedOnLocal = ContextKeyExpr.and(
      ResourceContextKey.Scheme.isEqualTo(Schemas.file),
      ContextKeyExpr.or(ContextKeyExpr.equals("config.terminal.explorerKind", "integrated"), ContextKeyExpr.equals("config.terminal.explorerKind", "both"))
    );
    const shouldShowExternalKindOnLocal = ContextKeyExpr.and(
      ResourceContextKey.Scheme.isEqualTo(Schemas.file),
      ContextKeyExpr.or(ContextKeyExpr.equals("config.terminal.explorerKind", "external"), ContextKeyExpr.equals("config.terminal.explorerKind", "both"))
    );
    this._openInIntegratedTerminalMenuItem = {
      group: "navigation",
      order: 30,
      command: {
        id: OPEN_IN_INTEGRATED_TERMINAL_COMMAND_ID,
        title: nls.localize("scopedConsoleAction.Integrated", "Open in Integrated Terminal")
      },
      when: ContextKeyExpr.or(shouldShowIntegratedOnLocal, ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeRemote))
    };
    this._openInTerminalMenuItem = {
      group: "navigation",
      order: 31,
      command: {
        id: OPEN_IN_TERMINAL_COMMAND_ID,
        title: nls.localize("scopedConsoleAction.external", "Open in External Terminal")
      },
      when: shouldShowExternalKindOnLocal
    };
    MenuRegistry.appendMenuItem(MenuId.ExplorerContext, this._openInTerminalMenuItem);
    MenuRegistry.appendMenuItem(MenuId.ExplorerContext, this._openInIntegratedTerminalMenuItem);
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("terminal.explorerKind") || e.affectsConfiguration("terminal.external")) {
        this._refreshOpenInTerminalMenuItemTitle();
      }
    }));
    this._refreshOpenInTerminalMenuItemTitle();
  }
  isWindows() {
    const config = this._configurationService.getValue().terminal;
    if (isWindows && config.external?.windowsExec) {
      const file = basename(config.external.windowsExec);
      if (file === "wt" || file === "wt.exe") {
        return true;
      }
    }
    return false;
  }
  _refreshOpenInTerminalMenuItemTitle() {
    if (this.isWindows()) {
      this._openInTerminalMenuItem.command.title = nls.localize("scopedConsoleAction.wt", "Open in Windows Terminal");
    }
  }
};
ExternalTerminalContribution = __decorateClass([
  __decorateParam(0, IConfigurationService)
], ExternalTerminalContribution);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ExternalTerminalContribution, LifecyclePhase.Restored);
export {
  ExternalTerminalContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlcm5hbFRlcm1pbmFsL2Jyb3dzZXIvZXh0ZXJuYWxUZXJtaW5hbC5jb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IE1lbnVJZCwgTWVudVJlZ2lzdHJ5LCBJTWVudUl0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbEdyb3VwU2VydmljZSwgSVRlcm1pbmFsU2VydmljZSBhcyBJSW50ZWdyYXRlZFRlcm1pbmFsU2VydmljZSB9IGZyb20gJy4uLy4uL3Rlcm1pbmFsL2Jyb3dzZXIvdGVybWluYWwuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBnZXRNdWx0aVNlbGVjdGVkUmVzb3VyY2VzLCBJRXhwbG9yZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZmlsZXMvYnJvd3Nlci9maWxlcy5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGRpc3RpbmN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBXb3JrYmVuY2hFeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBkaXJuYW1lLCBiYXNlbmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgTGlmZWN5Y2xlUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJRXh0ZXJuYWxUZXJtaW5hbENvbmZpZ3VyYXRpb24sIElFeHRlcm5hbFRlcm1pbmFsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVybmFsVGVybWluYWwvY29tbW9uL2V4dGVybmFsVGVybWluYWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBJTGlzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuXG5jb25zdCBPUEVOX0lOX1RFUk1JTkFMX0NPTU1BTkRfSUQgPSAnb3BlbkluVGVybWluYWwnO1xuY29uc3QgT1BFTl9JTl9JTlRFR1JBVEVEX1RFUk1JTkFMX0NPTU1BTkRfSUQgPSAnb3BlbkluSW50ZWdyYXRlZFRlcm1pbmFsJztcblxuZnVuY3Rpb24gcmVnaXN0ZXJPcGVuVGVybWluYWxDb21tYW5kKGlkOiBzdHJpbmcsIGV4cGxvcmVyS2luZDogJ2ludGVncmF0ZWQnIHwgJ2V4dGVybmFsJykge1xuXHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdFx0aWQ6IGlkLFxuXHRcdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvciwgcmVzb3VyY2U6IFVSSSkgPT4ge1xuXG5cdFx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGludGVncmF0ZWRUZXJtaW5hbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUludGVncmF0ZWRUZXJtaW5hbFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcmVtb3RlQWdlbnRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElSZW1vdGVBZ2VudFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgdGVybWluYWxHcm91cFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRlcm1pbmFsR3JvdXBTZXJ2aWNlKTtcblx0XHRcdGxldCBleHRlcm5hbFRlcm1pbmFsU2VydmljZTogSUV4dGVybmFsVGVybWluYWxTZXJ2aWNlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0ZXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dGVybmFsVGVybWluYWxTZXJ2aWNlKTtcblx0XHRcdH0gY2F0Y2ggeyB9XG5cblx0XHRcdGNvbnN0IHJlc291cmNlcyA9IGdldE11bHRpU2VsZWN0ZWRSZXNvdXJjZXMocmVzb3VyY2UsIGFjY2Vzc29yLmdldChJTGlzdFNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUV4cGxvcmVyU2VydmljZSkpO1xuXHRcdFx0cmV0dXJuIGZpbGVTZXJ2aWNlLnJlc29sdmVBbGwocmVzb3VyY2VzLm1hcChyID0+ICh7IHJlc291cmNlOiByIH0pKSkudGhlbihhc3luYyBzdGF0cyA9PiB7XG5cdFx0XHRcdC8vIEFsd2F5cyB1c2UgaW50ZWdyYXRlZCB0ZXJtaW5hbCB3aGVuIHVzaW5nIGEgcmVtb3RlXG5cdFx0XHRcdGNvbnN0IGNvbmZpZyA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElFeHRlcm5hbFRlcm1pbmFsQ29uZmlndXJhdGlvbj4oKTtcblxuXHRcdFx0XHRjb25zdCB1c2VJbnRlZ3JhdGVkVGVybWluYWwgPSByZW1vdGVBZ2VudFNlcnZpY2UuZ2V0Q29ubmVjdGlvbigpIHx8IGV4cGxvcmVyS2luZCA9PT0gJ2ludGVncmF0ZWQnO1xuXHRcdFx0XHRjb25zdCB0YXJnZXRzID0gZGlzdGluY3Qoc3RhdHMuZmlsdGVyKGRhdGEgPT4gZGF0YS5zdWNjZXNzKSk7XG5cdFx0XHRcdGlmICh1c2VJbnRlZ3JhdGVkVGVybWluYWwpIHtcblx0XHRcdFx0XHQvLyBUT0RPOiBVc2UgdXJpIGZvciBjd2QgaW4gY3JlYXRldGVybWluYWxcblx0XHRcdFx0XHRjb25zdCBvcGVuZWQ6IHsgW3BhdGg6IHN0cmluZ106IGJvb2xlYW4gfSA9IHt9O1xuXHRcdFx0XHRcdGNvbnN0IGN3ZHMgPSB0YXJnZXRzLm1hcCgoeyBzdGF0IH0pID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IHJlc291cmNlID0gc3RhdCEucmVzb3VyY2U7XG5cdFx0XHRcdFx0XHRpZiAoc3RhdCEuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHJlc291cmNlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIFVSSS5mcm9tKHtcblx0XHRcdFx0XHRcdFx0c2NoZW1lOiByZXNvdXJjZS5zY2hlbWUsXG5cdFx0XHRcdFx0XHRcdGF1dGhvcml0eTogcmVzb3VyY2UuYXV0aG9yaXR5LFxuXHRcdFx0XHRcdFx0XHRmcmFnbWVudDogcmVzb3VyY2UuZnJhZ21lbnQsXG5cdFx0XHRcdFx0XHRcdHF1ZXJ5OiByZXNvdXJjZS5xdWVyeSxcblx0XHRcdFx0XHRcdFx0cGF0aDogZGlybmFtZShyZXNvdXJjZS5wYXRoKVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBjd2Qgb2YgY3dkcykge1xuXHRcdFx0XHRcdFx0aWYgKG9wZW5lZFtjd2QucGF0aF0pIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0b3BlbmVkW2N3ZC5wYXRoXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRjb25zdCBpbnN0YW5jZSA9IGF3YWl0IGludGVncmF0ZWRUZXJtaW5hbFNlcnZpY2UuY3JlYXRlVGVybWluYWwoeyBjb25maWc6IHsgY3dkIH0gfSk7XG5cdFx0XHRcdFx0XHRpZiAoaW5zdGFuY2UgJiYgaW5zdGFuY2UudGFyZ2V0ICE9PSBUZXJtaW5hbExvY2F0aW9uLkVkaXRvciAmJiAocmVzb3VyY2VzLmxlbmd0aCA9PT0gMSB8fCAhcmVzb3VyY2UgfHwgY3dkLnBhdGggPT09IHJlc291cmNlLnBhdGggfHwgY3dkLnBhdGggPT09IGRpcm5hbWUocmVzb3VyY2UucGF0aCkpKSB7XG5cdFx0XHRcdFx0XHRcdGludGVncmF0ZWRUZXJtaW5hbFNlcnZpY2Uuc2V0QWN0aXZlSW5zdGFuY2UoaW5zdGFuY2UpO1xuXHRcdFx0XHRcdFx0XHR0ZXJtaW5hbEdyb3VwU2VydmljZS5zaG93UGFuZWwodHJ1ZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKGV4dGVybmFsVGVybWluYWxTZXJ2aWNlKSB7XG5cdFx0XHRcdFx0ZGlzdGluY3QodGFyZ2V0cy5tYXAoKHsgc3RhdCB9KSA9PiBzdGF0IS5pc0RpcmVjdG9yeSA/IHN0YXQhLnJlc291cmNlLmZzUGF0aCA6IGRpcm5hbWUoc3RhdCEucmVzb3VyY2UuZnNQYXRoKSkpLmZvckVhY2goY3dkID0+IHtcblx0XHRcdFx0XHRcdGV4dGVybmFsVGVybWluYWxTZXJ2aWNlLm9wZW5UZXJtaW5hbChjb25maWcudGVybWluYWwuZXh0ZXJuYWwsIGN3ZCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fSk7XG59XG5cbnJlZ2lzdGVyT3BlblRlcm1pbmFsQ29tbWFuZChPUEVOX0lOX1RFUk1JTkFMX0NPTU1BTkRfSUQsICdleHRlcm5hbCcpO1xucmVnaXN0ZXJPcGVuVGVybWluYWxDb21tYW5kKE9QRU5fSU5fSU5URUdSQVRFRF9URVJNSU5BTF9DT01NQU5EX0lELCAnaW50ZWdyYXRlZCcpO1xuXG5leHBvcnQgY2xhc3MgRXh0ZXJuYWxUZXJtaW5hbENvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0cHJpdmF0ZSBfb3BlbkluSW50ZWdyYXRlZFRlcm1pbmFsTWVudUl0ZW06IElNZW51SXRlbTtcblx0cHJpdmF0ZSBfb3BlbkluVGVybWluYWxNZW51SXRlbTogSU1lbnVJdGVtO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Y29uc3Qgc2hvdWxkU2hvd0ludGVncmF0ZWRPbkxvY2FsID0gQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0UmVzb3VyY2VDb250ZXh0S2V5LlNjaGVtZS5pc0VxdWFsVG8oU2NoZW1hcy5maWxlKSxcblx0XHRcdENvbnRleHRLZXlFeHByLm9yKENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLnRlcm1pbmFsLmV4cGxvcmVyS2luZCcsICdpbnRlZ3JhdGVkJyksIENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLnRlcm1pbmFsLmV4cGxvcmVyS2luZCcsICdib3RoJykpKTtcblxuXG5cdFx0Y29uc3Qgc2hvdWxkU2hvd0V4dGVybmFsS2luZE9uTG9jYWwgPSBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRSZXNvdXJjZUNvbnRleHRLZXkuU2NoZW1lLmlzRXF1YWxUbyhTY2hlbWFzLmZpbGUpLFxuXHRcdFx0Q29udGV4dEtleUV4cHIub3IoQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcudGVybWluYWwuZXhwbG9yZXJLaW5kJywgJ2V4dGVybmFsJyksIENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLnRlcm1pbmFsLmV4cGxvcmVyS2luZCcsICdib3RoJykpKTtcblxuXHRcdHRoaXMuX29wZW5JbkludGVncmF0ZWRUZXJtaW5hbE1lbnVJdGVtID0ge1xuXHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdG9yZGVyOiAzMCxcblx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0aWQ6IE9QRU5fSU5fSU5URUdSQVRFRF9URVJNSU5BTF9DT01NQU5EX0lELFxuXHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdzY29wZWRDb25zb2xlQWN0aW9uLkludGVncmF0ZWQnLCBcIk9wZW4gaW4gSW50ZWdyYXRlZCBUZXJtaW5hbFwiKVxuXHRcdFx0fSxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLm9yKHNob3VsZFNob3dJbnRlZ3JhdGVkT25Mb2NhbCwgUmVzb3VyY2VDb250ZXh0S2V5LlNjaGVtZS5pc0VxdWFsVG8oU2NoZW1hcy52c2NvZGVSZW1vdGUpKVxuXHRcdH07XG5cblxuXHRcdHRoaXMuX29wZW5JblRlcm1pbmFsTWVudUl0ZW0gPSB7XG5cdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0b3JkZXI6IDMxLFxuXHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRpZDogT1BFTl9JTl9URVJNSU5BTF9DT01NQU5EX0lELFxuXHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdzY29wZWRDb25zb2xlQWN0aW9uLmV4dGVybmFsJywgXCJPcGVuIGluIEV4dGVybmFsIFRlcm1pbmFsXCIpXG5cdFx0XHR9LFxuXHRcdFx0d2hlbjogc2hvdWxkU2hvd0V4dGVybmFsS2luZE9uTG9jYWxcblx0XHR9O1xuXG5cblx0XHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkV4cGxvcmVyQ29udGV4dCwgdGhpcy5fb3BlbkluVGVybWluYWxNZW51SXRlbSk7XG5cdFx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FeHBsb3JlckNvbnRleHQsIHRoaXMuX29wZW5JbkludGVncmF0ZWRUZXJtaW5hbE1lbnVJdGVtKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCd0ZXJtaW5hbC5leHBsb3JlcktpbmQnKSB8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKCd0ZXJtaW5hbC5leHRlcm5hbCcpKSB7XG5cdFx0XHRcdHRoaXMuX3JlZnJlc2hPcGVuSW5UZXJtaW5hbE1lbnVJdGVtVGl0bGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWZyZXNoT3BlbkluVGVybWluYWxNZW51SXRlbVRpdGxlKCk7XG5cdH1cblxuXHRwcml2YXRlIGlzV2luZG93cygpOiBib29sZWFuIHtcblx0XHRjb25zdCBjb25maWcgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRXh0ZXJuYWxUZXJtaW5hbENvbmZpZ3VyYXRpb24+KCkudGVybWluYWw7XG5cdFx0aWYgKGlzV2luZG93cyAmJiBjb25maWcuZXh0ZXJuYWw/LndpbmRvd3NFeGVjKSB7XG5cdFx0XHRjb25zdCBmaWxlID0gYmFzZW5hbWUoY29uZmlnLmV4dGVybmFsLndpbmRvd3NFeGVjKTtcblx0XHRcdGlmIChmaWxlID09PSAnd3QnIHx8IGZpbGUgPT09ICd3dC5leGUnKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIF9yZWZyZXNoT3BlbkluVGVybWluYWxNZW51SXRlbVRpdGxlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzV2luZG93cygpKSB7XG5cdFx0XHR0aGlzLl9vcGVuSW5UZXJtaW5hbE1lbnVJdGVtLmNvbW1hbmQudGl0bGUgPSBubHMubG9jYWxpemUoJ3Njb3BlZENvbnNvbGVBY3Rpb24ud3QnLCBcIk9wZW4gaW4gV2luZG93cyBUZXJtaW5hbFwiKTtcblx0XHR9XG5cdH1cbn1cblxuUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpLnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKEV4dGVybmFsVGVybWluYWxDb250cmlidXRpb24sIExpZmVjeWNsZVBoYXNlLlJlc3RvcmVkKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsV0FBVztBQUNwQixTQUFTLFFBQVEsb0JBQStCO0FBQ2hELFNBQVMsdUJBQXVCLG9CQUFvQixrQ0FBa0M7QUFDdEYsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUywyQkFBMkIsd0JBQXdCO0FBQzVELFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFrRSxjQUFjLDJCQUEyQjtBQUMzRyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLFNBQVMsZ0JBQWdCO0FBQ2xDLFNBQVMsc0JBQXNCO0FB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
