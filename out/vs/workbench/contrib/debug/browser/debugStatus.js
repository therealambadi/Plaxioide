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
import { dispose } from "../../../../base/common/lifecycle.js";
import { IDebugService, State } from "../common/debug.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IStatusbarService, StatusbarAlignment } from "../../../services/statusbar/browser/statusbar.js";
let DebugStatusContribution = class {
  constructor(statusBarService, debugService, configurationService) {
    this.statusBarService = statusBarService;
    this.debugService = debugService;
    this.toDispose = [];
    const addStatusBarEntry = () => {
      this.entryAccessor = this.statusBarService.addEntry(
        this.entry,
        "status.debug",
        StatusbarAlignment.LEFT,
        30
        /* Low Priority */
      );
    };
    const setShowInStatusBar = () => {
      this.showInStatusBar = configurationService.getValue("debug").showInStatusBar;
      if (this.showInStatusBar === "always" && !this.entryAccessor) {
        addStatusBarEntry();
      }
    };
    setShowInStatusBar();
    this.toDispose.push(this.debugService.onDidChangeState((state) => {
      if (state !== State.Inactive && this.showInStatusBar === "onFirstSessionStart" && !this.entryAccessor) {
        addStatusBarEntry();
      }
    }));
    this.toDispose.push(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("debug.showInStatusBar")) {
        setShowInStatusBar();
        if (this.entryAccessor && this.showInStatusBar === "never") {
          this.entryAccessor.dispose();
          this.entryAccessor = void 0;
        }
      }
    }));
    this.toDispose.push(this.debugService.getConfigurationManager().onDidSelectConfiguration((e) => {
      this.entryAccessor?.update(this.entry);
    }));
  }
  get entry() {
    let text = "";
    const manager = this.debugService.getConfigurationManager();
    const name = manager.selectedConfiguration.name || "";
    const nameAndLaunchPresent = name && manager.selectedConfiguration.launch;
    if (nameAndLaunchPresent) {
      text = manager.getLaunches().length > 1 ? `${name} (${manager.selectedConfiguration.launch.name})` : name;
    }
    return {
      name: nls.localize("status.debug", "Debug"),
      text: "$(debug-alt-small) " + text,
      ariaLabel: nls.localize("debugTarget", "Debug: {0}", text),
      tooltip: nls.localize("selectAndStartDebug", "Select and Start Debug Configuration"),
      command: "workbench.action.debug.selectandstart"
    };
  }
  dispose() {
    this.entryAccessor?.dispose();
    dispose(this.toDispose);
  }
};
DebugStatusContribution = __decorateClass([
  __decorateParam(0, IStatusbarService),
  __decorateParam(1, IDebugService),
  __decorateParam(2, IConfigurationService)
], DebugStatusContribution);
export {
  DebugStatusContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnU3RhdHVzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJRGVidWdTZXJ2aWNlLCBTdGF0ZSwgSURlYnVnQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElTdGF0dXNiYXJFbnRyeSwgSVN0YXR1c2JhclNlcnZpY2UsIFN0YXR1c2JhckFsaWdubWVudCwgSVN0YXR1c2JhckVudHJ5QWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9zdGF0dXNiYXIvYnJvd3Nlci9zdGF0dXNiYXIuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcblxuZXhwb3J0IGNsYXNzIERlYnVnU3RhdHVzQ29udHJpYnV0aW9uIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0cHJpdmF0ZSBzaG93SW5TdGF0dXNCYXIhOiAnbmV2ZXInIHwgJ2Fsd2F5cycgfCAnb25GaXJzdFNlc3Npb25TdGFydCc7XG5cdHByaXZhdGUgdG9EaXNwb3NlOiBJRGlzcG9zYWJsZVtdID0gW107XG5cdHByaXZhdGUgZW50cnlBY2Nlc3NvcjogSVN0YXR1c2JhckVudHJ5QWNjZXNzb3IgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElTdGF0dXNiYXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RhdHVzQmFyU2VydmljZTogSVN0YXR1c2JhclNlcnZpY2UsXG5cdFx0QElEZWJ1Z1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXG5cdFx0Y29uc3QgYWRkU3RhdHVzQmFyRW50cnkgPSAoKSA9PiB7XG5cdFx0XHR0aGlzLmVudHJ5QWNjZXNzb3IgPSB0aGlzLnN0YXR1c0JhclNlcnZpY2UuYWRkRW50cnkodGhpcy5lbnRyeSwgJ3N0YXR1cy5kZWJ1ZycsIFN0YXR1c2JhckFsaWdubWVudC5MRUZULCAzMCAvKiBMb3cgUHJpb3JpdHkgKi8pO1xuXHRcdH07XG5cblx0XHRjb25zdCBzZXRTaG93SW5TdGF0dXNCYXIgPSAoKSA9PiB7XG5cdFx0XHR0aGlzLnNob3dJblN0YXR1c0JhciA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElEZWJ1Z0NvbmZpZ3VyYXRpb24+KCdkZWJ1ZycpLnNob3dJblN0YXR1c0Jhcjtcblx0XHRcdGlmICh0aGlzLnNob3dJblN0YXR1c0JhciA9PT0gJ2Fsd2F5cycgJiYgIXRoaXMuZW50cnlBY2Nlc3Nvcikge1xuXHRcdFx0XHRhZGRTdGF0dXNCYXJFbnRyeSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0c2V0U2hvd0luU3RhdHVzQmFyKCk7XG5cblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuZGVidWdTZXJ2aWNlLm9uRGlkQ2hhbmdlU3RhdGUoc3RhdGUgPT4ge1xuXHRcdFx0aWYgKHN0YXRlICE9PSBTdGF0ZS5JbmFjdGl2ZSAmJiB0aGlzLnNob3dJblN0YXR1c0JhciA9PT0gJ29uRmlyc3RTZXNzaW9uU3RhcnQnICYmICF0aGlzLmVudHJ5QWNjZXNzb3IpIHtcblx0XHRcdFx0YWRkU3RhdHVzQmFyRW50cnkoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaChjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZGVidWcuc2hvd0luU3RhdHVzQmFyJykpIHtcblx0XHRcdFx0c2V0U2hvd0luU3RhdHVzQmFyKCk7XG5cdFx0XHRcdGlmICh0aGlzLmVudHJ5QWNjZXNzb3IgJiYgdGhpcy5zaG93SW5TdGF0dXNCYXIgPT09ICduZXZlcicpIHtcblx0XHRcdFx0XHR0aGlzLmVudHJ5QWNjZXNzb3IuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHRoaXMuZW50cnlBY2Nlc3NvciA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuZGVidWdTZXJ2aWNlLmdldENvbmZpZ3VyYXRpb25NYW5hZ2VyKCkub25EaWRTZWxlY3RDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0dGhpcy5lbnRyeUFjY2Vzc29yPy51cGRhdGUodGhpcy5lbnRyeSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgZW50cnkoKTogSVN0YXR1c2JhckVudHJ5IHtcblx0XHRsZXQgdGV4dCA9ICcnO1xuXHRcdGNvbnN0IG1hbmFnZXIgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRDb25maWd1cmF0aW9uTWFuYWdlcigpO1xuXHRcdGNvbnN0IG5hbWUgPSBtYW5hZ2VyLnNlbGVjdGVkQ29uZmlndXJhdGlvbi5uYW1lIHx8ICcnO1xuXHRcdGNvbnN0IG5hbWVBbmRMYXVuY2hQcmVzZW50ID0gbmFtZSAmJiBtYW5hZ2VyLnNlbGVjdGVkQ29uZmlndXJhdGlvbi5sYXVuY2g7XG5cdFx0aWYgKG5hbWVBbmRMYXVuY2hQcmVzZW50KSB7XG5cdFx0XHR0ZXh0ID0gKG1hbmFnZXIuZ2V0TGF1bmNoZXMoKS5sZW5ndGggPiAxID8gYCR7bmFtZX0gKCR7bWFuYWdlci5zZWxlY3RlZENvbmZpZ3VyYXRpb24ubGF1bmNoIS5uYW1lfSlgIDogbmFtZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZSgnc3RhdHVzLmRlYnVnJywgXCJEZWJ1Z1wiKSxcblx0XHRcdHRleHQ6ICckKGRlYnVnLWFsdC1zbWFsbCkgJyArIHRleHQsXG5cdFx0XHRhcmlhTGFiZWw6IG5scy5sb2NhbGl6ZSgnZGVidWdUYXJnZXQnLCBcIkRlYnVnOiB7MH1cIiwgdGV4dCksXG5cdFx0XHR0b29sdGlwOiBubHMubG9jYWxpemUoJ3NlbGVjdEFuZFN0YXJ0RGVidWcnLCBcIlNlbGVjdCBhbmQgU3RhcnQgRGVidWcgQ29uZmlndXJhdGlvblwiKSxcblx0XHRcdGNvbW1hbmQ6ICd3b3JrYmVuY2guYWN0aW9uLmRlYnVnLnNlbGVjdGFuZHN0YXJ0J1xuXHRcdH07XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuZW50cnlBY2Nlc3Nvcj8uZGlzcG9zZSgpO1xuXHRcdGRpc3Bv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
