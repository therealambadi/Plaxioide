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
import { PickerQuickAccessProvider, TriggerAction } from "../../../../platform/quickinput/browser/pickerQuickAccess.js";
import { localize } from "../../../../nls.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IDebugService } from "../common/debug.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { matchesFuzzy } from "../../../../base/common/filters.js";
import { ADD_CONFIGURATION_ID, DEBUG_QUICK_ACCESS_PREFIX } from "./debugCommands.js";
import { debugConfigure, debugRemoveConfig } from "./debugIcons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
let StartDebugQuickAccessProvider = class extends PickerQuickAccessProvider {
  constructor(debugService, contextService, commandService, notificationService) {
    super(DEBUG_QUICK_ACCESS_PREFIX, {
      noResultsPick: {
        label: localize("noDebugResults", "No matching launch configurations")
      }
    });
    this.debugService = debugService;
    this.contextService = contextService;
    this.commandService = commandService;
    this.notificationService = notificationService;
  }
  async _getPicks(filter) {
    const picks = [];
    if (!this.debugService.getAdapterManager().hasEnabledDebuggers()) {
      return [];
    }
    picks.push({ type: "separator", label: "launch.json" });
    const configManager = this.debugService.getConfigurationManager();
    const selectedConfiguration = configManager.selectedConfiguration;
    let lastGroup;
    for (const config of configManager.getAllConfigurations()) {
      const highlights = matchesFuzzy(filter, config.name, true);
      if (highlights) {
        const pick = {
          label: config.name,
          description: this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE ? config.launch.name : "",
          highlights: { label: highlights },
          buttons: [{
            iconClass: ThemeIcon.asClassName(debugConfigure),
            tooltip: localize("customizeLaunchConfig", "Configure Launch Configuration")
          }],
          trigger: () => {
            config.launch.openConfigFile({ preserveFocus: false });
            return TriggerAction.CLOSE_PICKER;
          },
          accept: async () => {
            await configManager.selectConfiguration(config.launch, config.name);
            try {
              await this.debugService.startDebugging(config.launch, void 0, { startedByUser: true });
            } catch (error) {
              this.notificationService.error(error);
            }
          }
        };
        if (selectedConfiguration.name === config.name && selectedConfiguration.launch === config.launch) {
          const separator = { type: "separator", label: localize("mostRecent", "Most Recent") };
          picks.unshift(separator, pick);
          continue;
        }
        if (lastGroup !== config.presentation?.group) {
          picks.push({ type: "separator" });
          lastGroup = config.presentation?.group;
        }
        picks.push(pick);
      }
    }
    const dynamicProviders = await configManager.getDynamicProviders();
    if (dynamicProviders.length > 0) {
      picks.push({
        type: "separator",
        label: localize({
          key: "contributed",
          comment: ["contributed is lower case because it looks better like that in UI. Nothing preceeds it. It is a name of the grouping of debug configurations."]
        }, "contributed")
      });
    }
    configManager.getRecentDynamicConfigurations().forEach(({ name, type }) => {
      const highlights = matchesFuzzy(filter, name, true);
      if (highlights) {
        picks.push({
          label: name,
          highlights: { label: highlights },
          buttons: [{
            iconClass: ThemeIcon.asClassName(debugRemoveConfig),
            tooltip: localize("removeLaunchConfig", "Remove Launch Configuration")
          }],
          trigger: () => {
            configManager.removeRecentDynamicConfigurations(name, type);
            return TriggerAction.CLOSE_PICKER;
          },
          accept: async () => {
            await configManager.selectConfiguration(void 0, name, void 0, { type });
            try {
              const { launch, getConfig } = configManager.selectedConfiguration;
              const config = await getConfig();
              await this.debugService.startDebugging(launch, config, { startedByUser: true });
            } catch (error) {
              this.notificationService.error(error);
            }
          }
        });
      }
    });
    dynamicProviders.forEach((provider) => {
      picks.push({
        label: `$(folder) ${provider.label}...`,
        ariaLabel: localize({ key: "providerAriaLabel", comment: ['Placeholder stands for the provider label. For example "NodeJS".'] }, "{0} contributed configurations", provider.label),
        accept: async () => {
          const pick = await provider.pick();
          if (pick) {
            await configManager.selectConfiguration(pick.launch, pick.config.name, pick.config, { type: provider.type });
            this.debugService.startDebugging(pick.launch, pick.config, { startedByUser: true });
          }
        }
      });
    });
    const visibleLaunches = configManager.getLaunches().filter((launch) => !launch.hidden);
    if (visibleLaunches.length > 0) {
      picks.push({ type: "separator", label: localize("configure", "configure") });
    }
    for (const launch of visibleLaunches) {
      const label = this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE ? localize("addConfigTo", "Add Config ({0})...", launch.name) : localize("addConfiguration", "Add Configuration...");
      picks.push({
        label,
        description: this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE ? launch.name : "",
        highlights: { label: matchesFuzzy(filter, label, true) ?? void 0 },
        accept: () => this.commandService.executeCommand(ADD_CONFIGURATION_ID, launch.uri.toString())
      });
    }
    return picks;
  }
};
StartDebugQuickAccessProvider = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, INotificationService)
], StartDebugQuickAccessProvider);
export {
  StartDebugQuickAccessProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnUXVpY2tBY2Nlc3MudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJUXVpY2tQaWNrU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBQaWNrZXJRdWlja0FjY2Vzc1Byb3ZpZGVyLCBJUGlja2VyUXVpY2tBY2Nlc3NJdGVtLCBUcmlnZ2VyQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9icm93c2VyL3BpY2tlclF1aWNrQWNjZXNzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSURlYnVnU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIFdvcmtiZW5jaFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IG1hdGNoZXNGdXp6eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2ZpbHRlcnMuanMnO1xuaW1wb3J0IHsgQUREX0NPTkZJR1VSQVRJT05fSUQsIERFQlVHX1FVSUNLX0FDQ0VTU19QUkVGSVggfSBmcm9tICcuL2RlYnVnQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgZGVidWdDb25maWd1cmUsIGRlYnVnUmVtb3ZlQ29uZmlnIH0gZnJvbSAnLi9kZWJ1Z0ljb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBTdGFydERlYnVnUXVpY2tBY2Nlc3NQcm92aWRlciBleHRlbmRzIFBpY2tlclF1aWNrQWNjZXNzUHJvdmlkZXI8SVBpY2tlclF1aWNrQWNjZXNzSXRlbT4ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRGVidWdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihERUJVR19RVUlDS19BQ0NFU1NfUFJFRklYLCB7XG5cdFx0XHRub1Jlc3VsdHNQaWNrOiB7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnbm9EZWJ1Z1Jlc3VsdHMnLCBcIk5vIG1hdGNoaW5nIGxhdW5jaCBjb25maWd1cmF0aW9uc1wiKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIF9nZXRQaWNrcyhmaWx0ZXI6IHN0cmluZyk6IFByb21pc2U8KElRdWlja1BpY2tTZXBhcmF0b3IgfCBJUGlja2VyUXVpY2tBY2Nlc3NJdGVtKVtdPiB7XG5cdFx0Y29uc3QgcGlja3M6IEFycmF5PElQaWNrZXJRdWlja0FjY2Vzc0l0ZW0gfCBJUXVpY2tQaWNrU2VwYXJhdG9yPiA9IFtdO1xuXHRcdGlmICghdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0QWRhcHRlck1hbmFnZXIoKS5oYXNFbmFibGVkRGVidWdnZXJzKCkpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRwaWNrcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiAnbGF1bmNoLmpzb24nIH0pO1xuXG5cdFx0Y29uc3QgY29uZmlnTWFuYWdlciA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldENvbmZpZ3VyYXRpb25NYW5hZ2VyKCk7XG5cdFx0Y29uc3Qgc2VsZWN0ZWRDb25maWd1cmF0aW9uID0gY29uZmlnTWFuYWdlci5zZWxlY3RlZENvbmZpZ3VyYXRpb247XG5cblx0XHQvLyBFbnRyaWVzOiBjb25maWdzXG5cdFx0bGV0IGxhc3RHcm91cDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGZvciAoY29uc3QgY29uZmlnIG9mIGNvbmZpZ01hbmFnZXIuZ2V0QWxsQ29uZmlndXJhdGlvbnMoKSkge1xuXHRcdFx0Y29uc3QgaGlnaGxpZ2h0cyA9IG1hdGNoZXNGdXp6eShmaWx0ZXIsIGNvbmZpZy5uYW1lLCB0cnVlKTtcblx0XHRcdGlmIChoaWdobGlnaHRzKSB7XG5cblx0XHRcdFx0Y29uc3QgcGljayA9IHtcblx0XHRcdFx0XHRsYWJlbDogY29uZmlnLm5hbWUsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuV09SS1NQQUNFID8gY29uZmlnLmxhdW5jaC5uYW1lIDogJycsXG5cdFx0XHRcdFx0aGlnaGxpZ2h0czogeyBsYWJlbDogaGlnaGxpZ2h0cyB9LFxuXHRcdFx0XHRcdGJ1dHRvbnM6IFt7XG5cdFx0XHRcdFx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShkZWJ1Z0NvbmZpZ3VyZSksXG5cdFx0XHRcdFx0XHR0b29sdGlwOiBsb2NhbGl6ZSgnY3VzdG9taXplTGF1bmNoQ29uZmlnJywgXCJDb25maWd1cmUgTGF1bmNoIENvbmZpZ3VyYXRpb25cIilcblx0XHRcdFx0XHR9XSxcblx0XHRcdFx0XHR0cmlnZ2VyOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25maWcubGF1bmNoLm9wZW5Db25maWdGaWxlKHsgcHJlc2VydmVGb2N1czogZmFsc2UgfSk7XG5cblx0XHRcdFx0XHRcdHJldHVybiBUcmlnZ2VyQWN0aW9uLkNMT1NFX1BJQ0tFUjtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGFjY2VwdDogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0YXdhaXQgY29uZmlnTWFuYWdlci5zZWxlY3RDb25maWd1cmF0aW9uKGNvbmZpZy5sYXVuY2gsIGNvbmZpZy5uYW1lKTtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuZGVidWdTZXJ2aWNlLnN0YXJ0RGVidWdnaW5nKGNvbmZpZy5sYXVuY2gsIHVuZGVmaW5lZCwgeyBzdGFydGVkQnlVc2VyOiB0cnVlIH0pO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Ly8gTW9zdCByZWNlbnRseSB1c2VkIGNvbmZpZ3VyYXRpb25cblx0XHRcdFx0aWYgKHNlbGVjdGVkQ29uZmlndXJhdGlvbi5uYW1lID09PSBjb25maWcubmFtZSAmJiBzZWxlY3RlZENvbmZpZ3VyYXRpb24ubGF1bmNoID09PSBjb25maWcubGF1bmNoKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc2VwYXJhdG9yOiBJUXVpY2tQaWNrU2VwYXJhdG9yID0geyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IGxvY2FsaXplKCdtb3N0UmVjZW50JywgJ01vc3QgUmVjZW50JykgfTtcblx0XHRcdFx0XHRwaWNrcy51bnNoaWZ0KHNlcGFyYXRvciwgcGljayk7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBTZXBhcmF0b3Jcblx0XHRcdFx0aWYgKGxhc3RHcm91cCAhPT0gY29uZmlnLnByZXNlbnRhdGlvbj8uZ3JvdXApIHtcblx0XHRcdFx0XHRwaWNrcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicgfSk7XG5cdFx0XHRcdFx0bGFzdEdyb3VwID0gY29uZmlnLnByZXNlbnRhdGlvbj8uZ3JvdXA7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBMYXVuY2ggZW50cnlcblxuXHRcdFx0XHRwaWNrcy5wdXNoKHBpY2spO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEVudHJpZXMgZGV0ZWN0ZWQgY29uZmlndXJhdGlvbnNcblx0XHRjb25zdCBkeW5hbWljUHJvdmlkZXJzID0gYXdhaXQgY29uZmlnTWFuYWdlci5nZXREeW5hbWljUHJvdmlkZXJzKCk7XG5cdFx0aWYgKGR5bmFtaWNQcm92aWRlcnMubGVuZ3RoID4gMCkge1xuXHRcdFx0cGlja3MucHVzaCh7XG5cdFx0XHRcdHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbG9jYWxpemUoe1xuXHRcdFx0XHRcdGtleTogJ2NvbnRyaWJ1dGVkJyxcblx0XHRcdFx0XHRjb21tZW50OiBbJ2NvbnRyaWJ1dGVkIGlzIGxvd2VyIGNhc2UgYmVjYXVzZSBpdCBsb29rcyBiZXR0ZXIgbGlrZSB0aGF0IGluIFVJLiBOb3RoaW5nIHByZWNlZWRzIGl0LiBJdCBpcyBhIG5hbWUgb2YgdGhlIGdyb3VwaW5nIG9mIGRlYnVnIGNvbmZpZ3VyYXRpb25zLiddXG5cdFx0XHRcdH0sIFwiY29udHJpYnV0ZWRcIilcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNvbmZpZ01hbmFnZXIuZ2V0UmVjZW50RHluYW1pY0NvbmZpZ3VyYXRpb25zKCkuZm9yRWFjaCgoeyBuYW1lLCB0eXBlIH0pID0+IHtcblx0XHRcdGNvbnN0IGhpZ2hsaWdodHMgPSBtYXRjaGVzRnV6enkoZmlsdGVyLCBuYW1lLCB0cnVlKTtcblx0XHRcdGlmIChoaWdobGlnaHRzKSB7XG5cdFx0XHRcdHBpY2tzLnB1c2goe1xuXHRcdFx0XHRcdGxhYmVsOiBuYW1lLFxuXHRcdFx0XHRcdGhpZ2hsaWdodHM6IHsgbGFiZWw6IGhpZ2hsaWdodHMgfSxcblx0XHRcdFx0XHRidXR0b25zOiBbe1xuXHRcdFx0XHRcdFx0aWNvbkNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoZGVidWdSZW1vdmVDb25maWcpLFxuXHRcdFx0XHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ3JlbW92ZUxhdW5jaENvbmZpZycsIFwiUmVtb3ZlIExhdW5jaCBDb25maWd1cmF0aW9uXCIpXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0dHJpZ2dlcjogKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uZmlnTWFuYWdlci5yZW1vdmVSZWNlbnREeW5hbWljQ29uZmlndXJhdGlvbnMobmFtZSwgdHlwZSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gVHJpZ2dlckFjdGlvbi5DTE9TRV9QSUNLRVI7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRhY2NlcHQ6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdGF3YWl0IGNvbmZpZ01hbmFnZXIuc2VsZWN0Q29uZmlndXJhdGlvbih1bmRlZmluZWQsIG5hbWUsIHVuZGVmaW5lZCwgeyB0eXBlIH0pO1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgeyBsYXVuY2gsIGdldENvbmZpZyB9ID0gY29uZmlnTWFuYWdlci5zZWxlY3RlZENvbmZpZ3VyYXRpb247XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNvbmZpZyA9IGF3YWl0IGdldENvbmZpZygpO1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmRlYnVnU2VydmljZS5zdGFydERlYnVnZ2luZyhsYXVuY2gsIGNvbmZpZywgeyBzdGFydGVkQnlVc2VyOiB0cnVlIH0pO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0ZHluYW1pY1Byb3ZpZGVycy5mb3JFYWNoKHByb3ZpZGVyID0+IHtcblx0XHRcdHBpY2tzLnB1c2goe1xuXHRcdFx0XHRsYWJlbDogYCQoZm9sZGVyKSAke3Byb3ZpZGVyLmxhYmVsfS4uLmAsXG5cdFx0XHRcdGFyaWFMYWJlbDogbG9jYWxpemUoeyBrZXk6ICdwcm92aWRlckFyaWFMYWJlbCcsIGNvbW1lbnQ6IFsnUGxhY2Vob2xkZXIgc3RhbmRzIGZvciB0aGUgcHJvdmlkZXIgbGFiZWwuIEZvciBleGFtcGxlIFwiTm9kZUpTXCIuJ10gfSwgXCJ7MH0gY29udHJpYnV0ZWQgY29uZmlndXJhdGlvbnNcIiwgcHJvdmlkZXIubGFiZWwpLFxuXHRcdFx0XHRhY2NlcHQ6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBwaWNrID0gYXdhaXQgcHJvdmlkZXIucGljaygpO1xuXHRcdFx0XHRcdGlmIChwaWNrKSB7XG5cdFx0XHRcdFx0XHQvLyBVc2UgdGhlIHR5cGUgb2YgdGhlIHByb3ZpZGVyLCBub3Qgb2YgdGhlIGNvbmZpZyBzaW5jZSBjb25maWcgc29tZXRpbWVzIGhhdmUgc3VidHlwZXMgKGZvciBleGFtcGxlIFwibm9kZS10ZXJtaW5hbFwiKVxuXHRcdFx0XHRcdFx0YXdhaXQgY29uZmlnTWFuYWdlci5zZWxlY3RDb25maWd1cmF0aW9uKHBpY2subGF1bmNoLCBwaWNrLmNvbmZpZy5uYW1lLCBwaWNrLmNvbmZpZywgeyB0eXBlOiBwcm92aWRlci50eXBlIH0pO1xuXHRcdFx0XHRcdFx0dGhpcy5kZWJ1Z1NlcnZpY2Uuc3RhcnREZWJ1Z2dpbmcocGljay5sYXVuY2gsIHBpY2suY29uZmlnLCB7IHN0YXJ0ZWRCeVVzZXI6IHRydWUgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXG5cdFx0Ly8gRW50cmllczogbGF1bmNoZXNcblx0XHRjb25zdCB2aXNpYmxlTGF1bmNoZXMgPSBjb25maWdNYW5hZ2VyLmdldExhdW5jaGVzKCkuZmlsdGVyKGxhdW5jaCA9PiAhbGF1bmNoLmhpZGRlbik7XG5cblx0XHQvLyBTZXBhcmF0b3Jcblx0XHRpZiAodmlzaWJsZUxhdW5jaGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdHBpY2tzLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IGxvY2FsaXplKCdjb25maWd1cmUnLCBcImNvbmZpZ3VyZVwiKSB9KTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IGxhdW5jaCBvZiB2aXNpYmxlTGF1bmNoZXMpIHtcblx0XHRcdGNvbnN0IGxhYmVsID0gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5XT1JLU1BBQ0UgP1xuXHRcdFx0XHRsb2NhbGl6ZShcImFkZENvbmZpZ1RvXCIsIFwiQWRkIENvbmZpZyAoezB9KS4uLlwiLCBsYXVuY2gubmFtZSkgOlxuXHRcdFx0XHRsb2NhbGl6ZSgnYWRkQ29uZmlndXJhdGlvbicsIFwiQWRkIENvbmZpZ3VyYXRpb24uLi5cIik7XG5cblx0XHRcdC8vIEFkZCBDb25maWcgZW50cnlcblx0XHRcdHBpY2tzLnB1c2goe1xuXHRcdFx0XHRsYWJlbCxcblx0XHRcdFx0ZGVzY3JpcHRpb246IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuV09SS1NQQUNFID8gbGF1bmNoLm5hbWUgOiAnJyxcblx0XHRcdFx0aGlnaGxpZ2h0czogeyBsYWJlbDogbWF0Y2hlc0Z1enp5KGZpbHRlciwgbGFiZWwsIHRydWUpID8/IHVuZGVmaW5lZCB9LFxuXHRcdFx0XHRhY2NlcHQ6ICgpID0+IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoQUREX0NPTkZJR1VSQVRJT05fSUQsIGxhdW5jaC51cmkudG9TdHJpbmcoKSlcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBwaWNrcztcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFTLDJCQUFtRCxxQkFBcUI7QUFDakYsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUywwQkFBMEIsc0JBQXNCO0FBQ3pELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsc0JBQXNCLGlDQUFpQztBQUNoRSxTQUFTLGdCQUFnQix5QkFBeUI7QUFDbEQsU0FBUyxpQkFBaUI7QUFFbkIsSUFBTSxnQ0FBTixjQUE0QywwQkFBa0Q7QUFBQSxFQUVwRyxZQUNpQyxjQUNXLGdCQUNULGdCQUNLLHFCQUN0QztBQUNELFVBQU0sMkJBQTJCO0FBQUEsTUFDaEMsZUFBZTtBQUFBLFFBQ2QsT0FBTyxTQUFTLGtCQUFrQixtQ0FBbUM7QUFBQSxNQUN0RTtBQUFBLElBQ0QsQ0FBQztBQVQrQjtBQUNXO0FBQ1Q7QUFD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
