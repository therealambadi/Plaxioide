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
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { LifecyclePhase, ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IWorkbenchThemeService } from "../../../services/themes/common/workbenchThemeService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { language } from "../../../../base/common/platform.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import ErrorTelemetry from "../../../../platform/telemetry/browser/errorTelemetry.js";
import { supportsTelemetry, TelemetryLogGroup, telemetryLogId, TelemetryTrustedValue } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { ConfigurationTarget, ConfigurationTargetToString, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { extname, basename, isEqual, isEqualOrParent } from "../../../../base/common/resources.js";
import { Schemas } from "../../../../base/common/network.js";
import { getMimeTypes } from "../../../../editor/common/services/languagesAssociations.js";
import { hash } from "../../../../base/common/hash.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { ViewContainerLocation } from "../../../common/views.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { isBoolean, isNumber, isString } from "../../../../base/common/types.js";
import { LayoutSettings } from "../../../services/layout/browser/layoutService.js";
import { AutoRestartConfigurationKey, AutoUpdateConfigurationKey } from "../../extensions/common/extensions.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { IOutputService } from "../../../services/output/common/output.js";
import { ILoggerService, LogLevel } from "../../../../platform/log/common/log.js";
let TelemetryContribution = class extends Disposable {
  constructor(telemetryService, contextService, lifecycleService, editorService, keybindingsService, themeService, environmentService, userDataProfileService, paneCompositeService, productService, loggerService, outputService, textFileService) {
    super();
    this.telemetryService = telemetryService;
    this.contextService = contextService;
    this.userDataProfileService = userDataProfileService;
    this.loggerService = loggerService;
    this.outputService = outputService;
    const { filesToOpenOrCreate, filesToDiff, filesToMerge } = environmentService;
    const activeViewlet = paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar);
    telemetryService.publicLog2("workspaceLoad", {
      windowSize: { innerHeight: mainWindow.innerHeight, innerWidth: mainWindow.innerWidth, outerHeight: mainWindow.outerHeight, outerWidth: mainWindow.outerWidth },
      emptyWorkbench: contextService.getWorkbenchState() === WorkbenchState.EMPTY,
      "workbench.filesToOpenOrCreate": filesToOpenOrCreate && filesToOpenOrCreate.length || 0,
      "workbench.filesToDiff": filesToDiff && filesToDiff.length || 0,
      "workbench.filesToMerge": filesToMerge && filesToMerge.length || 0,
      customKeybindingsCount: keybindingsService.customKeybindingsCount(),
      theme: themeService.getColorTheme().id,
      language,
      pinnedViewlets: paneCompositeService.getPinnedPaneCompositeIds(ViewContainerLocation.Sidebar),
      restoredViewlet: activeViewlet ? activeViewlet.getId() : void 0,
      restoredEditors: editorService.visibleEditors.length,
      startupKind: lifecycleService.startupKind
    });
    this._register(new ErrorTelemetry(telemetryService));
    this._register(textFileService.files.onDidResolve((e) => this.onTextFileModelResolved(e)));
    this._register(textFileService.files.onDidSave((e) => this.onTextFileModelSaved(e)));
    this._register(lifecycleService.onDidShutdown(() => this.dispose()));
    if (supportsTelemetry(productService, environmentService)) {
      this.handleTelemetryOutputVisibility();
    }
  }
  onTextFileModelResolved(e) {
    const settingsType = this.getTypeIfSettings(e.model.resource);
    if (!settingsType) {
      this.telemetryService.publicLog2("fileGet", this.getTelemetryData(e.model.resource, e.reason));
    }
  }
  onTextFileModelSaved(e) {
    const settingsType = this.getTypeIfSettings(e.model.resource);
    if (!settingsType) {
      this.telemetryService.publicLog2("filePUT", this.getTelemetryData(e.model.resource, e.reason));
    }
  }
  getTypeIfSettings(resource) {
    if (extname(resource) !== ".json") {
      return "";
    }
    if (isEqual(resource, this.userDataProfileService.currentProfile.settingsResource)) {
      return "global-settings";
    }
    if (isEqual(resource, this.userDataProfileService.currentProfile.keybindingsResource)) {
      return "keybindings";
    }
    if (isEqualOrParent(resource, this.userDataProfileService.currentProfile.snippetsHome)) {
      return "snippets";
    }
    const folders = this.contextService.getWorkspace().folders;
    for (const folder of folders) {
      if (isEqualOrParent(resource, folder.toResource(".vscode"))) {
        const filename = basename(resource);
        if (TelemetryContribution.ALLOWLIST_WORKSPACE_JSON.indexOf(filename) > -1) {
          return `.vscode/${filename}`;
        }
      }
    }
    return "";
  }
  getTelemetryData(resource, reason) {
    let ext = extname(resource);
    const queryStringLocation = ext.indexOf("?");
    ext = queryStringLocation !== -1 ? ext.substr(0, queryStringLocation) : ext;
    const fileName = basename(resource);
    const path = resource.scheme === Schemas.file ? resource.fsPath : resource.path;
    const telemetryData = {
      mimeType: new TelemetryTrustedValue(getMimeTypes(resource).join(", ")),
      ext,
      path: hash(path),
      reason,
      allowlistedjson: void 0
    };
    if (ext === ".json" && TelemetryContribution.ALLOWLIST_JSON.indexOf(fileName) > -1) {
      telemetryData["allowlistedjson"] = fileName;
    }
    return telemetryData;
  }
  async handleTelemetryOutputVisibility() {
    const that = this;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.showTelemetry",
          title: localize2("showTelemetry", "Show Telemetry"),
          category: Categories.Developer,
          f1: true
        });
      }
      async run() {
        for (const logger of that.loggerService.getRegisteredLoggers()) {
          if (logger.group?.id === TelemetryLogGroup.id) {
            that.loggerService.setLogLevel(logger.resource, LogLevel.Trace);
            that.loggerService.setVisibility(logger.resource, true);
          }
        }
        that.outputService.showChannel(TelemetryLogGroup.id);
      }
    }));
    if (![...this.loggerService.getRegisteredLoggers()].find((logger) => logger.id === telemetryLogId)) {
      await Event.toPromise(Event.filter(this.loggerService.onDidChangeLoggers, (e) => [...e.added].some((logger) => logger.id === telemetryLogId)));
    }
    let showTelemetry = false;
    for (const logger of this.loggerService.getRegisteredLoggers()) {
      if (logger.id === telemetryLogId) {
        showTelemetry = this.loggerService.getLogLevel() === LogLevel.Trace || !logger.hidden;
        if (showTelemetry) {
          this.loggerService.setVisibility(logger.id, true);
        }
        break;
      }
    }
    if (showTelemetry) {
      const showExtensionTelemetry = (loggers) => {
        for (const logger of loggers) {
          if (logger.group?.id === TelemetryLogGroup.id) {
            that.loggerService.setLogLevel(logger.resource, LogLevel.Trace);
            this.loggerService.setVisibility(logger.id, true);
          }
        }
      };
      showExtensionTelemetry(this.loggerService.getRegisteredLoggers());
      this._register(this.loggerService.onDidChangeLoggers((e) => showExtensionTelemetry(e.added)));
    }
  }
};
TelemetryContribution.ALLOWLIST_JSON = ["package.json", "package-lock.json", "tsconfig.json", "jsconfig.json", "bower.json", ".eslintrc.json", "tslint.json", "composer.json"];
TelemetryContribution.ALLOWLIST_WORKSPACE_JSON = ["settings.json", "extensions.json", "tasks.json", "launch.json"];
TelemetryContribution = __decorateClass([
  __decorateParam(0, ITelemetryService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, ILifecycleService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IWorkbenchThemeService),
  __decorateParam(6, IWorkbenchEnvironmentService),
  __decorateParam(7, IUserDataProfileService),
  __decorateParam(8, IPaneCompositePartService),
  __decorateParam(9, IProductService),
  __decorateParam(10, ILoggerService),
  __decorateParam(11, IOutputService),
  __decorateParam(12, ITextFileService)
], TelemetryContribution);
let ConfigurationTelemetryContribution = class extends Disposable {
  constructor(configurationService, userDataProfilesService, telemetryService) {
    super();
    this.configurationService = configurationService;
    this.userDataProfilesService = userDataProfilesService;
    this.telemetryService = telemetryService;
    this.configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
    const { user, workspace } = configurationService.keys();
    for (const setting of user) {
      this.reportTelemetry(setting, ConfigurationTarget.USER_LOCAL);
    }
    for (const setting of workspace) {
      this.reportTelemetry(setting, ConfigurationTarget.WORKSPACE);
    }
  }
  /**
   * Report value of a setting only if it is an enum, boolean, or number or an array of those.
   */
  getValueToReport(key, target) {
    const inpsectData = this.configurationService.inspect(key);
    const value = target === ConfigurationTarget.USER_LOCAL ? inpsectData.user?.value : inpsectData.workspace?.value;
    if (isNumber(value) || isBoolean(value)) {
      return value.toString();
    }
    const schema = this.configurationRegistry.getConfigurationProperties()[key];
    if (isString(value)) {
      if (schema?.enum?.includes(value)) {
        return value;
      }
      return void 0;
    }
    if (Array.isArray(value)) {
      if (value.every((v) => isNumber(v) || isBoolean(v) || isString(v) && schema?.enum?.includes(v))) {
        return JSON.stringify(value);
      }
    }
    return void 0;
  }
  reportTelemetry(key, target) {
    const source = ConfigurationTargetToString(target);
    switch (key) {
      case LayoutSettings.ACTIVITY_BAR_LOCATION:
        this.telemetryService.publicLog2("workbench.activityBar.location", { settingValue: this.getValueToReport(key, target), source });
        return;
      case AutoUpdateConfigurationKey:
        this.telemetryService.publicLog2("extensions.autoUpdate", { settingValue: this.getValueToReport(key, target), source });
        return;
      case "editor.stickyScroll.enabled":
        this.telemetryService.publicLog2("editor.stickyScroll.enabled", { settingValue: this.getValueToReport(key, target), source });
        return;
      case "typescript.experimental.expandableHover":
        this.telemetryService.publicLog2("typescript.experimental.expandableHover", { settingValue: this.getValueToReport(key, target), source });
        return;
      case "window.titleBarStyle":
        this.telemetryService.publicLog2("window.titleBarStyle", { settingValue: this.getValueToReport(key, target), source });
        return;
      case "extensions.verifySignature":
        this.telemetryService.publicLog2("extensions.verifySignature", { settingValue: this.getValueToReport(key, target), source });
        return;
      case "window.newWindowProfile": {
        const valueToReport = this.getValueToReport(key, target);
        const settingValue = valueToReport === null ? "null" : valueToReport === this.userDataProfilesService.defaultProfile.name ? "default" : "custom";
        this.telemetryService.publicLog2("window.newWindowProfile", { settingValue, source });
        return;
      }
      case AutoRestartConfigurationKey:
        this.telemetryService.publicLog2("extensions.autoRestart", { settingValue: this.getValueToReport(key, target), source });
        return;
    }
  }
};
ConfigurationTelemetryContribution = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IUserDataProfilesService),
  __decorateParam(2, ITelemetryService)
], ConfigurationTelemetryContribution);
const workbenchContributionRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchContributionRegistry.registerWorkbenchContribution(TelemetryContribution, LifecyclePhase.Restored);
workbenchContributionRegistry.registerWorkbenchContribution(ConfigurationTelemetryContribution, LifecyclePhase.Eventually);
export {
  TelemetryContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZWxlbWV0cnkvYnJvd3Nlci90ZWxlbWV0cnkuY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucyBhcyBXb3JrYmVuY2hFeHRlbnNpb25zLCBJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5LCBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgTGlmZWN5Y2xlUGhhc2UsIElMaWZlY3ljbGVTZXJ2aWNlLCBTdGFydHVwS2luZCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBXb3JrYmVuY2hTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaFRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3RoZW1lcy9jb21tb24vd29ya2JlbmNoVGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGxhbmd1YWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCBFcnJvclRlbGVtZXRyeSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvYnJvd3Nlci9lcnJvclRlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBzdXBwb3J0c1RlbGVtZXRyeSwgVGVsZW1ldHJ5TG9nR3JvdXAsIHRlbGVtZXRyeUxvZ0lkLCBUZWxlbWV0cnlUcnVzdGVkVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeVV0aWxzLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25UYXJnZXQsIENvbmZpZ3VyYXRpb25UYXJnZXRUb1N0cmluZywgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGV4dEZpbGVTZXJ2aWNlLCBJVGV4dEZpbGVTYXZlRXZlbnQsIElUZXh0RmlsZVJlc29sdmVFdmVudCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3RleHRmaWxlL2NvbW1vbi90ZXh0ZmlsZXMuanMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgYmFzZW5hbWUsIGlzRXF1YWwsIGlzRXF1YWxPclBhcmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgZ2V0TWltZVR5cGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZXNBc3NvY2lhdGlvbnMuanMnO1xuaW1wb3J0IHsgaGFzaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2hhc2guanMnO1xuaW1wb3J0IHsgSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3BhbmVjb21wb3NpdGUvYnJvd3Nlci9wYW5lY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IFZpZXdDb250YWluZXJMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgaXNCb29sZWFuLCBpc051bWJlciwgaXNTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBMYXlvdXRTZXR0aW5ncyB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xheW91dC9icm93c2VyL2xheW91dFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQXV0b1Jlc3RhcnRDb25maWd1cmF0aW9uS2V5LCBBdXRvVXBkYXRlQ29uZmlndXJhdGlvbktleSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ2F0ZWdvcmllcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uQ29tbW9uQ2F0ZWdvcmllcy5qcyc7XG5pbXBvcnQgeyBJT3V0cHV0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL291dHB1dC9jb21tb24vb3V0cHV0LmpzJztcbmltcG9ydCB7IElMb2dnZXJSZXNvdXJjZSwgSUxvZ2dlclNlcnZpY2UsIExvZ0xldmVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuXG50eXBlIFRlbGVtZXRyeURhdGEgPSB7XG5cdG1pbWVUeXBlOiBUZWxlbWV0cnlUcnVzdGVkVmFsdWU8c3RyaW5nPjtcblx0ZXh0OiBzdHJpbmc7XG5cdHBhdGg6IG51bWJlcjtcblx0cmVhc29uPzogbnVtYmVyO1xuXHRhbGxvd2xpc3RlZGpzb24/OiBzdHJpbmc7XG59O1xuXG50eXBlIEZpbGVUZWxlbWV0cnlEYXRhRnJhZ21lbnQgPSB7XG5cdG1pbWVUeXBlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGxhbmd1YWdlIHR5cGUgb2YgdGhlIGZpbGUgKGZvciBleGFtcGxlIFhNTCkuJyB9O1xuXHRleHQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgZmlsZSBleHRlbnNpb24gb2YgdGhlIGZpbGUgKGZvciBleGFtcGxlIHhtbCkuJyB9O1xuXHRwYXRoOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIHBhdGggb2YgdGhlIGZpbGUgYXMgYSBoYXNoLicgfTtcblx0cmVhc29uPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSByZWFzb24gd2h5IGEgZmlsZSBpcyByZWFkIG9yIHdyaXR0ZW4uIEFsbG93cyB0byBlLmcuIGRpc3Rpbmd1aXNoIGF1dG8gc2F2ZSBmcm9tIG5vcm1hbCBzYXZlLicgfTtcblx0YWxsb3dsaXN0ZWRqc29uPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBuYW1lIG9mIHRoZSBmaWxlIGJ1dCBvbmx5IGlmIGl0IG1hdGNoZXMgc29tZSB3ZWxsIGtub3duIGZpbGUgbmFtZXMgc3VjaCBhcyBwYWNrYWdlLmpzb24gb3IgdHNjb25maWcuanNvbi4nIH07XG59O1xuXG5leHBvcnQgY2xhc3MgVGVsZW1ldHJ5Q29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHByaXZhdGUgc3RhdGljIEFMTE9XTElTVF9KU09OID0gWydwYWNrYWdlLmpzb24nLCAncGFja2FnZS1sb2NrLmpzb24nLCAndHNjb25maWcuanNvbicsICdqc2NvbmZpZy5qc29uJywgJ2Jvd2VyLmpzb24nLCAnLmVzbGludHJjLmpzb24nLCAndHNsaW50Lmpzb24nLCAnY29tcG9zZXIuanNvbiddO1xuXHRwcml2YXRlIHN0YXRpYyBBTExPV0xJU1RfV09SS1NQQUNFX0pTT04gPSBbJ3NldHRpbmdzLmpzb24nLCAnZXh0ZW5zaW9ucy5qc29uJywgJ3Rhc2tzLmpzb24nLCAnbGF1bmNoLmpzb24nXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUxpZmVjeWNsZVNlcnZpY2UgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ3NTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJV29ya2JlbmNoVGhlbWVTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlU2VydmljZSxcblx0XHRASVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSBwYW5lQ29tcG9zaXRlU2VydmljZTogSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElMb2dnZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nZ2VyU2VydmljZTogSUxvZ2dlclNlcnZpY2UsXG5cdFx0QElPdXRwdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3V0cHV0U2VydmljZTogSU91dHB1dFNlcnZpY2UsXG5cdFx0QElUZXh0RmlsZVNlcnZpY2UgdGV4dEZpbGVTZXJ2aWNlOiBJVGV4dEZpbGVTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCB7IGZpbGVzVG9PcGVuT3JDcmVhdGUsIGZpbGVzVG9EaWZmLCBmaWxlc1RvTWVyZ2UgfSA9IGVudmlyb25tZW50U2VydmljZTtcblx0XHRjb25zdCBhY3RpdmVWaWV3bGV0ID0gcGFuZUNvbXBvc2l0ZVNlcnZpY2UuZ2V0QWN0aXZlUGFuZUNvbXBvc2l0ZShWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5cblx0XHR0eXBlIFdpbmRvd1NpemVGcmFnbWVudCA9IHtcblx0XHRcdGlubmVySGVpZ2h0OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGhlaWdodCBvZiB0aGUgY3VycmVudCB3aW5kb3cuJyB9O1xuXHRcdFx0aW5uZXJXaWR0aDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSB3aWR0aCBvZiB0aGUgY3VycmVudCB3aW5kb3cuJyB9O1xuXHRcdFx0b3V0ZXJIZWlnaHQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgaGVpZ2h0IG9mIHRoZSBjdXJyZW50IHdpbmRvdyB3aXRoIGFsbCBkZWNvcmF0aW9uIHJlbW92ZWQuJyB9O1xuXHRcdFx0b3V0ZXJXaWR0aDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSB3aWR0aCBvZiB0aGUgY3VycmVudCB3aW5kb3cgd2l0aCBhbGwgZGVjb3JhdGlvbiByZW1vdmVkLicgfTtcblx0XHRcdG93bmVyOiAnYnBhc2Vybyc7XG5cdFx0XHRjb21tZW50OiAnVGhlIHNpemUgb2YgdGhlIHdpbmRvdy4nO1xuXHRcdH07XG5cblx0XHR0eXBlIFdvcmtzcGFjZUxvYWRDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdG93bmVyOiAnYnBhc2Vybyc7XG5cdFx0XHRlbXB0eVdvcmtiZW5jaDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1doZXRoZXIgYSBmb2xkZXIgb3Igd29ya3NwYWNlIGlzIG9wZW5lZCBvciBub3QuJyB9O1xuXHRcdFx0d2luZG93U2l6ZTogV2luZG93U2l6ZUZyYWdtZW50O1xuXHRcdFx0J3dvcmtiZW5jaC5maWxlc1RvT3Blbk9yQ3JlYXRlJzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ051bWJlciBvZiBmaWxlcyB0aGF0IHNob3VsZCBvcGVuIG9yIGJlIGNyZWF0ZWQuJyB9O1xuXHRcdFx0J3dvcmtiZW5jaC5maWxlc1RvRGlmZic6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdOdW1iZXIgb2YgZmlsZXMgdGhhdCBzaG91bGQgYmUgY29tcGFyZWQuJyB9O1xuXHRcdFx0J3dvcmtiZW5jaC5maWxlc1RvTWVyZ2UnOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnTnVtYmVyIG9mIGZpbGVzIHRoYXQgc2hvdWxkIGJlIG1lcmdlZC4nIH07XG5cdFx0XHRjdXN0b21LZXliaW5kaW5nc0NvdW50OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnTnVtYmVyIG9mIGN1c3RvbSBrZXliaW5kaW5ncycgfTtcblx0XHRcdHRoZW1lOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGN1cnJlbnQgdGhlbWUgb2YgdGhlIHdpbmRvdy4nIH07XG5cdFx0XHRsYW5ndWFnZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0J1c2luZXNzSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgZGlzcGxheSBsYW5ndWFnZSBvZiB0aGUgd2luZG93LicgfTtcblx0XHRcdHBpbm5lZFZpZXdsZXRzOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGlkZW50aWZpZXJzIG9mIHZpZXdzIHRoYXQgYXJlIHBpbm5lZC4nIH07XG5cdFx0XHRyZXN0b3JlZFZpZXdsZXQ/OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGlkZW50aWZpZXIgb2YgdGhlIHZpZXcgdGhhdCBpcyByZXN0b3JlZC4nIH07XG5cdFx0XHRyZXN0b3JlZEVkaXRvcnM6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgbnVtYmVyIG9mIGVkaXRvcnMgdGhhdCByZXN0b3JlZC4nIH07XG5cdFx0XHRzdGFydHVwS2luZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0hvdyB0aGUgd2luZG93IHdhcyBvcGVuZWQsIGUuZyB2aWEgcmVsb2FkIG9yIG5vdC4nIH07XG5cdFx0XHRjb21tZW50OiAnTWV0YWRhdGEgYXJvdW5kIHRoZSB3b3Jrc3BhY2UgdGhhdCBpcyBiZWluZyBsb2FkZWQgaW50byBhIHdpbmRvdy4nO1xuXHRcdH07XG5cblx0XHR0eXBlIFdvcmtzcGFjZUxvYWRFdmVudCA9IHtcblx0XHRcdHdpbmRvd1NpemU6IHsgaW5uZXJIZWlnaHQ6IG51bWJlcjsgaW5uZXJXaWR0aDogbnVtYmVyOyBvdXRlckhlaWdodDogbnVtYmVyOyBvdXRlcldpZHRoOiBudW1iZXIgfTtcblx0XHRcdGVtcHR5V29ya2JlbmNoOiBib29sZWFuO1xuXHRcdFx0J3dvcmtiZW5jaC5maWxlc1RvT3Blbk9yQ3JlYXRlJzogbnVtYmVyO1xuXHRcdFx0J3dvcmtiZW5jaC5maWxlc1RvRGlmZic6IG51bWJlcjtcblx0XHRcdCd3b3JrYmVuY2guZmlsZXNUb01lcmdlJzogbnVtYmVyO1xuXHRcdFx0Y3VzdG9tS2V5YmluZGluZ3NDb3VudDogbnVtYmVyO1xuXHRcdFx0dGhlbWU6IHN0cmluZztcblx0XHRcdGxhbmd1YWdlOiBzdHJpbmc7XG5cdFx0XHRwaW5uZWRWaWV3bGV0czogc3RyaW5nW107XG5cdFx0XHRyZXN0b3JlZFZpZXdsZXQ/OiBzdHJpbmc7XG5cdFx0XHRyZXN0b3JlZEVkaXRvcnM6IG51bWJlcjtcblx0XHRcdHN0YXJ0dXBLaW5kOiBTdGFydHVwS2luZDtcblx0XHR9O1xuXG5cdFx0dGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdvcmtzcGFjZUxvYWRFdmVudCwgV29ya3NwYWNlTG9hZENsYXNzaWZpY2F0aW9uPignd29ya3NwYWNlTG9hZCcsIHtcblx0XHRcdHdpbmRvd1NpemU6IHsgaW5uZXJIZWlnaHQ6IG1haW5XaW5kb3cuaW5uZXJIZWlnaHQsIGlubmVyV2lkdGg6IG1haW5XaW5kb3cuaW5uZXJXaWR0aCwgb3V0ZXJIZWlnaHQ6IG1haW5XaW5kb3cub3V0ZXJIZWlnaHQsIG91dGVyV2lkdGg6IG1haW5XaW5kb3cub3V0ZXJXaWR0aCB9LFxuXHRcdFx0ZW1wdHlXb3JrYmVuY2g6IGNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLkVNUFRZLFxuXHRcdFx0J3dvcmtiZW5jaC5maWxlc1RvT3Blbk9yQ3JlYXRlJzogZmlsZXNUb09wZW5PckNyZWF0ZSAmJiBmaWxlc1RvT3Blbk9yQ3JlYXRlLmxlbmd0aCB8fCAwLFxuXHRcdFx0J3dvcmtiZW5jaC5maWxlc1RvRGlmZic6IGZpbGVzVG9EaWZmICYmIGZpbGVzVG9EaWZmLmxlbmd0aCB8fCAwLFxuXHRcdFx0J3dvcmtiZW5jaC5maWxlc1RvTWVyZ2UnOiBmaWxlc1RvTWVyZ2UgJiYgZmlsZXNUb01lcmdlLmxlbmd0aCB8fCAwLFxuXHRcdFx0Y3VzdG9tS2V5YmluZGluZ3NDb3VudDoga2V5YmluZGluZ3NTZXJ2aWNlLmN1c3RvbUtleWJpbmRpbmdzQ291bnQoKSxcblx0XHRcdHRoZW1lOiB0aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpLmlkLFxuXHRcdFx0bGFuZ3VhZ2UsXG5cdFx0XHRwaW5uZWRWaWV3bGV0czogcGFuZUNvbXBvc2l0ZVNlcnZpY2UuZ2V0UGlubmVkUGFuZUNvbXBvc2l0ZUlkcyhWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhciksXG5cdFx0XHRyZXN0b3JlZFZpZXdsZXQ6IGFjdGl2ZVZpZXdsZXQgPyBhY3RpdmVWaWV3bGV0LmdldElkKCkgOiB1bmRlZmluZWQsXG5cdFx0XHRyZXN0b3JlZEVkaXRvcnM6IGVkaXRvclNlcnZpY2UudmlzaWJsZUVkaXRvcnMubGVuZ3RoLFxuXHRcdFx0c3RhcnR1cEtpbmQ6IGxpZmVjeWNsZVNlcnZpY2Uuc3RhcnR1cEtpbmRcblx0XHR9KTtcblxuXHRcdC8vIEVycm9yIFRlbGVtZXRyeVxuXHRcdHRoaXMuX3JlZ2lzdGVyKG5ldyBFcnJvclRlbGVtZXRyeSh0ZWxlbWV0cnlTZXJ2aWNlKSk7XG5cblx0XHQvLyAgRmlsZXMgVGVsZW1ldHJ5XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGV4dEZpbGVTZXJ2aWNlLmZpbGVzLm9uRGlkUmVzb2x2ZShlID0+IHRoaXMub25UZXh0RmlsZU1vZGVsUmVzb2x2ZWQoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0ZXh0RmlsZVNlcnZpY2UuZmlsZXMub25EaWRTYXZlKGUgPT4gdGhpcy5vblRleHRGaWxlTW9kZWxTYXZlZChlKSkpO1xuXG5cdFx0Ly8gTGlmZWN5Y2xlXG5cdFx0dGhpcy5fcmVnaXN0ZXIobGlmZWN5Y2xlU2VydmljZS5vbkRpZFNodXRkb3duKCgpID0+IHRoaXMuZGlzcG9zZSgpKSk7XG5cblx0XHRpZiAoc3VwcG9ydHNUZWxlbWV0cnkocHJvZHVjdFNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSkpIHtcblx0XHRcdHRoaXMuaGFuZGxlVGVsZW1ldHJ5T3V0cHV0VmlzaWJpbGl0eSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25UZXh0RmlsZU1vZGVsUmVzb2x2ZWQoZTogSVRleHRGaWxlUmVzb2x2ZUV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3Qgc2V0dGluZ3NUeXBlID0gdGhpcy5nZXRUeXBlSWZTZXR0aW5ncyhlLm1vZGVsLnJlc291cmNlKTtcblx0XHRpZiAoIXNldHRpbmdzVHlwZSkge1xuXHRcdFx0dHlwZSBGaWxlR2V0Q2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdG93bmVyOiAnaXNpZG9ybic7XG5cdFx0XHRcdGNvbW1lbnQ6ICdUcmFjayB3aGVuIGEgZmlsZSB3YXMgcmVhZCwgZm9yIGV4YW1wbGUgZnJvbSBhbiBlZGl0b3IuJztcblx0XHRcdH0gJiBGaWxlVGVsZW1ldHJ5RGF0YUZyYWdtZW50O1xuXG5cdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxUZWxlbWV0cnlEYXRhLCBGaWxlR2V0Q2xhc3NpZmljYXRpb24+KCdmaWxlR2V0JywgdGhpcy5nZXRUZWxlbWV0cnlEYXRhKGUubW9kZWwucmVzb3VyY2UsIGUucmVhc29uKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvblRleHRGaWxlTW9kZWxTYXZlZChlOiBJVGV4dEZpbGVTYXZlRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBzZXR0aW5nc1R5cGUgPSB0aGlzLmdldFR5cGVJZlNldHRpbmdzKGUubW9kZWwucmVzb3VyY2UpO1xuXHRcdGlmICghc2V0dGluZ3NUeXBlKSB7XG5cdFx0XHR0eXBlIEZpbGVQdXRDbGFzc2ZpY2F0aW9uID0ge1xuXHRcdFx0XHRvd25lcjogJ2lzaWRvcm4nO1xuXHRcdFx0XHRjb21tZW50OiAnVHJhY2sgd2hlbiBhIGZpbGUgd2FzIHdyaXR0ZW4gdG8sIGZvciBleGFtcGxlIGZyb20gYW4gZWRpdG9yLic7XG5cdFx0XHR9ICYgRmlsZVRlbGVtZXRyeURhdGFGcmFnbWVudDtcblx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFRlbGVtZXRyeURhdGEsIEZpbGVQdXRDbGFzc2ZpY2F0aW9uPignZmlsZVBVVCcsIHRoaXMuZ2V0VGVsZW1ldHJ5RGF0YShlLm1vZGVsLnJlc291cmNlLCBlLnJlYXNvbikpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0VHlwZUlmU2V0dGluZ3MocmVzb3VyY2U6IFVSSSk6IHN0cmluZyB7XG5cdFx0aWYgKGV4dG5hbWUocmVzb3VyY2UpICE9PSAnLmpzb24nKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgZm9yIGdsb2JhbCBzZXR0aW5ncyBmaWxlXG5cdFx0aWYgKGlzRXF1YWwocmVzb3VyY2UsIHRoaXMudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlKSkge1xuXHRcdFx0cmV0dXJuICdnbG9iYWwtc2V0dGluZ3MnO1xuXHRcdH1cblxuXHRcdC8vIENoZWNrIGZvciBrZXliaW5kaW5ncyBmaWxlXG5cdFx0aWYgKGlzRXF1YWwocmVzb3VyY2UsIHRoaXMudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5rZXliaW5kaW5nc1Jlc291cmNlKSkge1xuXHRcdFx0cmV0dXJuICdrZXliaW5kaW5ncyc7XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgZm9yIHNuaXBwZXRzXG5cdFx0aWYgKGlzRXF1YWxPclBhcmVudChyZXNvdXJjZSwgdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLnNuaXBwZXRzSG9tZSkpIHtcblx0XHRcdHJldHVybiAnc25pcHBldHMnO1xuXHRcdH1cblxuXHRcdC8vIENoZWNrIGZvciB3b3Jrc3BhY2Ugc2V0dGluZ3MgZmlsZVxuXHRcdGNvbnN0IGZvbGRlcnMgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnM7XG5cdFx0Zm9yIChjb25zdCBmb2xkZXIgb2YgZm9sZGVycykge1xuXHRcdFx0aWYgKGlzRXF1YWxPclBhcmVudChyZXNvdXJjZSwgZm9sZGVyLnRvUmVzb3VyY2UoJy52c2NvZGUnKSkpIHtcblx0XHRcdFx0Y29uc3QgZmlsZW5hbWUgPSBiYXNlbmFtZShyZXNvdXJjZSk7XG5cdFx0XHRcdGlmIChUZWxlbWV0cnlDb250cmlidXRpb24uQUxMT1dMSVNUX1dPUktTUEFDRV9KU09OLmluZGV4T2YoZmlsZW5hbWUpID4gLTEpIHtcblx0XHRcdFx0XHRyZXR1cm4gYC52c2NvZGUvJHtmaWxlbmFtZX1gO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRUZWxlbWV0cnlEYXRhKHJlc291cmNlOiBVUkksIHJlYXNvbj86IG51bWJlcik6IFRlbGVtZXRyeURhdGEge1xuXHRcdGxldCBleHQgPSBleHRuYW1lKHJlc291cmNlKTtcblx0XHQvLyBSZW1vdmUgcXVlcnkgcGFyYW1ldGVycyBmcm9tIHRoZSByZXNvdXJjZSBleHRlbnNpb25cblx0XHRjb25zdCBxdWVyeVN0cmluZ0xvY2F0aW9uID0gZXh0LmluZGV4T2YoJz8nKTtcblx0XHRleHQgPSBxdWVyeVN0cmluZ0xvY2F0aW9uICE9PSAtMSA/IGV4dC5zdWJzdHIoMCwgcXVlcnlTdHJpbmdMb2NhdGlvbikgOiBleHQ7XG5cdFx0Y29uc3QgZmlsZU5hbWUgPSBiYXNlbmFtZShyZXNvdXJjZSk7XG5cdFx0Y29uc3QgcGF0aCA9IHJlc291cmNlLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlID8gcmVzb3VyY2UuZnNQYXRoIDogcmVzb3VyY2UucGF0aDtcblx0XHRjb25zdCB0ZWxlbWV0cnlEYXRhID0ge1xuXHRcdFx0bWltZVR5cGU6IG5ldyBUZWxlbWV0cnlUcnVzdGVkVmFsdWUoZ2V0TWltZVR5cGVzKHJlc291cmNlKS5qb2luKCcsICcpKSxcblx0XHRcdGV4dCxcblx0XHRcdHBhdGg6IGhhc2gocGF0aCksXG5cdFx0XHRyZWFzb24sXG5cdFx0XHRhbGxvd2xpc3RlZGpzb246IHVuZGVmaW5lZCBhcyBzdHJpbmcgfCB1bmRlZmluZWRcblx0XHR9O1xuXG5cdFx0aWYgKGV4dCA9PT0gJy5qc29uJyAmJiBUZWxlbWV0cnlDb250cmlidXRpb24uQUxMT1dMSVNUX0pTT04uaW5kZXhPZihmaWxlTmFtZSkgPiAtMSkge1xuXHRcdFx0dGVsZW1ldHJ5RGF0YVsnYWxsb3dsaXN0ZWRqc29uJ10gPSBmaWxlTmFtZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGVsZW1ldHJ5RGF0YTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaGFuZGxlVGVsZW1ldHJ5T3V0cHV0VmlzaWJpbGl0eSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uc2hvd1RlbGVtZXRyeScsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignc2hvd1RlbGVtZXRyeScsIFwiU2hvdyBUZWxlbWV0cnlcIiksXG5cdFx0XHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRGV2ZWxvcGVyLFxuXHRcdFx0XHRcdGYxOiB0cnVlXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0YXN5bmMgcnVuKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGxvZ2dlciBvZiB0aGF0LmxvZ2dlclNlcnZpY2UuZ2V0UmVnaXN0ZXJlZExvZ2dlcnMoKSkge1xuXHRcdFx0XHRcdGlmIChsb2dnZXIuZ3JvdXA/LmlkID09PSBUZWxlbWV0cnlMb2dHcm91cC5pZCkge1xuXHRcdFx0XHRcdFx0dGhhdC5sb2dnZXJTZXJ2aWNlLnNldExvZ0xldmVsKGxvZ2dlci5yZXNvdXJjZSwgTG9nTGV2ZWwuVHJhY2UpO1xuXHRcdFx0XHRcdFx0dGhhdC5sb2dnZXJTZXJ2aWNlLnNldFZpc2liaWxpdHkobG9nZ2VyLnJlc291cmNlLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhhdC5vdXRwdXRTZXJ2aWNlLnNob3dDaGFubmVsKFRlbGVtZXRyeUxvZ0dyb3VwLmlkKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRpZiAoIVsuLi50aGlzLmxvZ2dlclNlcnZpY2UuZ2V0UmVnaXN0ZXJlZExvZ2dlcnMoKV0uZmluZChsb2dnZXIgPT4gbG9nZ2VyLmlkID09PSB0ZWxlbWV0cnlMb2dJZCkpIHtcblx0XHRcdGF3YWl0IEV2ZW50LnRvUHJvbWlzZShFdmVudC5maWx0ZXIodGhpcy5sb2dnZXJTZXJ2aWNlLm9uRGlkQ2hhbmdlTG9nZ2VycywgZSA9PiBbLi4uZS5hZGRlZF0uc29tZShsb2dnZXIgPT4gbG9nZ2VyLmlkID09PSB0ZWxlbWV0cnlMb2dJZCkpKTtcblx0XHR9XG5cblx0XHRsZXQgc2hvd1RlbGVtZXRyeSA9IGZhbHNlO1xuXHRcdGZvciAoY29uc3QgbG9nZ2VyIG9mIHRoaXMubG9nZ2VyU2VydmljZS5nZXRSZWdpc3RlcmVkTG9nZ2VycygpKSB7XG5cdFx0XHRpZiAobG9nZ2VyLmlkID09PSB0ZWxlbWV0cnlMb2dJZCkge1xuXHRcdFx0XHRzaG93VGVsZW1ldHJ5ID0gdGhpcy5sb2dnZXJTZXJ2aWNlLmdldExvZ0xldmVsKCkgPT09IExvZ0xldmVsLlRyYWNlIHx8ICFsb2dnZXIuaGlkZGVuO1xuXHRcdFx0XHRpZiAoc2hvd1RlbGVtZXRyeSkge1xuXHRcdFx0XHRcdHRoaXMubG9nZ2VyU2VydmljZS5zZXRWaXNpYmlsaXR5KGxvZ2dlci5pZCwgdHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChzaG93VGVsZW1ldHJ5KSB7XG5cdFx0XHRjb25zdCBzaG93RXh0ZW5zaW9uVGVsZW1ldHJ5ID0gKGxvZ2dlcnM6IEl0ZXJhYmxlPElMb2dnZXJSZXNvdXJjZT4pID0+IHtcblx0XHRcdFx0Zm9yIChjb25zdCBsb2dnZXIgb2YgbG9nZ2Vycykge1xuXHRcdFx0XHRcdGlmIChsb2dnZXIuZ3JvdXA/LmlkID09PSBUZWxlbWV0cnlMb2dHcm91cC5pZCkge1xuXHRcdFx0XHRcdFx0dGhhdC5sb2dnZXJTZXJ2aWNlLnNldExvZ0xldmVsKGxvZ2dlci5yZXNvdXJjZSwgTG9nTGV2ZWwuVHJhY2UpO1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dnZXJTZXJ2aWNlLnNldFZpc2liaWxpdHkobG9nZ2VyLmlkLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRzaG93RXh0ZW5zaW9uVGVsZW1ldHJ5KHRoaXMubG9nZ2VyU2VydmljZS5nZXRSZWdpc3RlcmVkTG9nZ2VycygpKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubG9nZ2VyU2VydmljZS5vbkRpZENoYW5nZUxvZ2dlcnMoZSA9PiBzaG93RXh0ZW5zaW9uVGVsZW1ldHJ5KGUuYWRkZWQpKSk7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIENvbmZpZ3VyYXRpb25UZWxlbWV0cnlDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihDb25maWd1cmF0aW9uRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IHsgdXNlciwgd29ya3NwYWNlIH0gPSBjb25maWd1cmF0aW9uU2VydmljZS5rZXlzKCk7XG5cdFx0Zm9yIChjb25zdCBzZXR0aW5nIG9mIHVzZXIpIHtcblx0XHRcdHRoaXMucmVwb3J0VGVsZW1ldHJ5KHNldHRpbmcsIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTCk7XG5cdFx0fVxuXHRcdGZvciAoY29uc3Qgc2V0dGluZyBvZiB3b3Jrc3BhY2UpIHtcblx0XHRcdHRoaXMucmVwb3J0VGVsZW1ldHJ5KHNldHRpbmcsIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmVwb3J0IHZhbHVlIG9mIGEgc2V0dGluZyBvbmx5IGlmIGl0IGlzIGFuIGVudW0sIGJvb2xlYW4sIG9yIG51bWJlciBvciBhbiBhcnJheSBvZiB0aG9zZS5cblx0ICovXG5cdHByaXZhdGUgZ2V0VmFsdWVUb1JlcG9ydChrZXk6IHN0cmluZywgdGFyZ2V0OiBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUwgfCBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgaW5wc2VjdERhdGEgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmluc3BlY3Qoa2V5KTtcblx0XHRjb25zdCB2YWx1ZSA9IHRhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMID8gaW5wc2VjdERhdGEudXNlcj8udmFsdWUgOiBpbnBzZWN0RGF0YS53b3Jrc3BhY2U/LnZhbHVlO1xuXHRcdGlmIChpc051bWJlcih2YWx1ZSkgfHwgaXNCb29sZWFuKHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIHZhbHVlLnRvU3RyaW5nKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2NoZW1hID0gdGhpcy5jb25maWd1cmF0aW9uUmVnaXN0cnkuZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXMoKVtrZXldO1xuXHRcdGlmIChpc1N0cmluZyh2YWx1ZSkpIHtcblx0XHRcdGlmIChzY2hlbWE/LmVudW0/LmluY2x1ZGVzKHZhbHVlKSkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcblx0XHRcdGlmICh2YWx1ZS5ldmVyeSh2ID0+IGlzTnVtYmVyKHYpIHx8IGlzQm9vbGVhbih2KSB8fCAoaXNTdHJpbmcodikgJiYgc2NoZW1hPy5lbnVtPy5pbmNsdWRlcyh2KSkpKSB7XG5cdFx0XHRcdHJldHVybiBKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIHJlcG9ydFRlbGVtZXRyeShrZXk6IHN0cmluZywgdGFyZ2V0OiBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUwgfCBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRSk6IHZvaWQge1xuXHRcdHR5cGUgVXBkYXRlZFNldHRpbmdFdmVudCA9IHtcblx0XHRcdHNldHRpbmdWYWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0c291cmNlOiBzdHJpbmc7XG5cdFx0fTtcblx0XHRjb25zdCBzb3VyY2UgPSBDb25maWd1cmF0aW9uVGFyZ2V0VG9TdHJpbmcodGFyZ2V0KTtcblxuXHRcdHN3aXRjaCAoa2V5KSB7XG5cblx0XHRcdGNhc2UgTGF5b3V0U2V0dGluZ3MuQUNUSVZJVFlfQkFSX0xPQ0FUSU9OOlxuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxVcGRhdGVkU2V0dGluZ0V2ZW50LCB7XG5cdFx0XHRcdFx0b3duZXI6ICdzYW5keTA4MSc7XG5cdFx0XHRcdFx0Y29tbWVudDogJ1RoaXMgaXMgdXNlZCB0byBrbm93IHdoZXJlIGFjdGl2aXR5IGJhciBpcyBzaG93biBpbiB0aGUgd29ya2JlbmNoLic7XG5cdFx0XHRcdFx0c2V0dGluZ1ZhbHVlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAndmFsdWUgb2YgdGhlIHNldHRpbmcnIH07XG5cdFx0XHRcdFx0c291cmNlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnc291cmNlIG9mIHRoZSBzZXR0aW5nJyB9O1xuXHRcdFx0XHR9Pignd29ya2JlbmNoLmFjdGl2aXR5QmFyLmxvY2F0aW9uJywgeyBzZXR0aW5nVmFsdWU6IHRoaXMuZ2V0VmFsdWVUb1JlcG9ydChrZXksIHRhcmdldCksIHNvdXJjZSB9KTtcblx0XHRcdFx0cmV0dXJuO1xuXG5cdFx0XHRjYXNlIEF1dG9VcGRhdGVDb25maWd1cmF0aW9uS2V5OlxuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxVcGRhdGVkU2V0dGluZ0V2ZW50LCB7XG5cdFx0XHRcdFx0b3duZXI6ICdzYW5keTA4MSc7XG5cdFx0XHRcdFx0Y29tbWVudDogJ1RoaXMgaXMgdXNlZCB0byBrbm93IGlmIGV4dGVuc2lvbnMgYXJlIGdldHRpbmcgYXV0byB1cGRhdGVkIG9yIG5vdCc7XG5cdFx0XHRcdFx0c2V0dGluZ1ZhbHVlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAndmFsdWUgb2YgdGhlIHNldHRpbmcnIH07XG5cdFx0XHRcdFx0c291cmNlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnc291cmNlIG9mIHRoZSBzZXR0aW5nJyB9O1xuXHRcdFx0XHR9PignZXh0ZW5zaW9ucy5hdXRvVXBkYXRlJywgeyBzZXR0aW5nVmFsdWU6IHRoaXMuZ2V0VmFsdWVUb1JlcG9ydChrZXksIHRhcmdldCksIHNvdXJjZSB9KTtcblx0XHRcdFx0cmV0dXJuO1xuXG5cdFx0XHRjYXNlICdlZGl0b3Iuc3RpY2t5U2Nyb2xsLmVuYWJsZWQnOlxuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxVcGRhdGVkU2V0dGluZ0V2ZW50LCB7XG5cdFx0XHRcdFx0b3duZXI6ICdhaWRheS1tYXInO1xuXHRcdFx0XHRcdGNvbW1lbnQ6ICdUaGlzIGlzIHVzZWQgdG8ga25vdyBpZiBlZGl0b3Igc3RpY2t5IHNjcm9sbCBpcyBlbmFibGVkIG9yIG5vdCc7XG5cdFx0XHRcdFx0c2V0dGluZ1ZhbHVlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAndmFsdWUgb2YgdGhlIHNldHRpbmcnIH07XG5cdFx0XHRcdFx0c291cmNlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnc291cmNlIG9mIHRoZSBzZXR0aW5nJyB9O1xuXHRcdFx0XHR9PignZWRpdG9yLnN0aWNreVNjcm9sbC5lbmFibGVkJywgeyBzZXR0aW5nVmFsdWU6IHRoaXMuZ2V0VmFsdWVUb1JlcG9ydChrZXksIHRhcmdldCksIHNvdXJjZSB9KTtcblx0XHRcdFx0cmV0dXJuO1xuXG5cdFx0XHRjYXNlICd0eXBlc2NyaXB0LmV4cGVyaW1lbnRhbC5leHBhbmRhYmxlSG92ZXInOlxuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxVcGRhdGVkU2V0dGluZ0V2ZW50LCB7XG5cdFx0XHRcdFx0b3duZXI6ICdhaWRheS1tYXInO1xuXHRcdFx0XHRcdGNvbW1lbnQ6ICdUaGlzIGlzIHVzZWQgdG8ga25vdyBpZiB0aGUgVHlwZVNjcmlwdCBleHBhbmRiYWxlIGhvdmVyIGlzIGVuYWJsZWQgb3Igbm90Jztcblx0XHRcdFx0XHRzZXR0aW5nVmFsdWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICd2YWx1ZSBvZiB0aGUgc2V0dGluZycgfTtcblx0XHRcdFx0XHRzb3VyY2U6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdzb3VyY2Ugb2YgdGhlIHNldHRpbmcnIH07XG5cdFx0XHRcdH0+KCd0eXBlc2NyaXB0LmV4cGVyaW1lbnRhbC5leHBhbmRhYmxlSG92ZXInLCB7IHNldHRpbmdWYWx1ZTogdGhpcy5nZXRWYWx1ZVRvUmVwb3J0KGtleSwgdGFyZ2V0KSwgc291cmNlIH0pO1xuXHRcdFx0XHRyZXR1cm47XG5cblx0XHRcdGNhc2UgJ3dpbmRvdy50aXRsZUJhclN0eWxlJzpcblx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8VXBkYXRlZFNldHRpbmdFdmVudCwge1xuXHRcdFx0XHRcdG93bmVyOiAnYmVuaWJlbmonO1xuXHRcdFx0XHRcdGNvbW1lbnQ6ICdUaGlzIGlzIHVzZWQgdG8ga25vdyBpZiB3aW5kb3cgdGl0bGUgYmFyIHN0eWxlIGlzIHNldCB0byBjdXN0b20gb3Igbm90Jztcblx0XHRcdFx0XHRzZXR0aW5nVmFsdWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICd2YWx1ZSBvZiB0aGUgc2V0dGluZycgfTtcblx0XHRcdFx0XHRzb3VyY2U6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdzb3VyY2Ugb2YgdGhlIHNldHRpbmcnIH07XG5cdFx0XHRcdH0+KCd3aW5kb3cudGl0bGVCYXJTdHlsZScsIHsgc2V0dGluZ1ZhbHVlOiB0aGlzLmdldFZhbHVlVG9SZXBvcnQoa2V5LCB0YXJnZXQpLCBzb3VyY2UgfSk7XG5cdFx0XHRcdHJldHVybjtcblxuXHRcdFx0Y2FzZSAnZXh0ZW5zaW9ucy52ZXJpZnlTaWduYXR1cmUnOlxuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxVcGRhdGVkU2V0dGluZ0V2ZW50LCB7XG5cdFx0XHRcdFx0b3duZXI6ICdzYW5keTA4MSc7XG5cdFx0XHRcdFx0Y29tbWVudDogJ1RoaXMgaXMgdXNlZCB0byBrbm93IGlmIGV4dGVuc2lvbnMgc2lnbmF0dXJlIHZlcmlmaWNhdGlvbiBpcyBlbmFibGVkIG9yIG5vdCc7XG5cdFx0XHRcdFx0c2V0dGluZ1ZhbHVlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAndmFsdWUgb2YgdGhlIHNldHRpbmcnIH07XG5cdFx0XHRcdFx0c291cmNlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnc291cmNlIG9mIHRoZSBzZXR0aW5nJyB9O1xuXHRcdFx0XHR9PignZXh0ZW5zaW9ucy52ZXJpZnlTaWduYXR1cmUnLCB7IHNldHRpbmdWYWx1ZTogdGhpcy5nZXRWYWx1ZVRvUmVwb3J0KGtleSwgdGFyZ2V0KSwgc291cmNlIH0pO1xuXHRcdFx0XHRyZXR1cm47XG5cblx0XHRcdGNhc2UgJ3dpbmRvdy5uZXdXaW5kb3dQcm9maWxlJzpcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnN0IHZhbHVlVG9SZXBvcnQgPSB0aGlzLmdldFZhbHVlVG9SZXBvcnQoa2V5LCB0YXJnZXQpO1xuXHRcdFx0XHRcdGNvbnN0IHNldHRpbmdWYWx1ZSA9XG5cdFx0XHRcdFx0XHR2YWx1ZVRvUmVwb3J0ID09PSBudWxsID8gJ251bGwnXG5cdFx0XHRcdFx0XHRcdDogdmFsdWVUb1JlcG9ydCA9PT0gdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5uYW1lXG5cdFx0XHRcdFx0XHRcdFx0PyAnZGVmYXVsdCdcblx0XHRcdFx0XHRcdFx0XHQ6ICdjdXN0b20nO1xuXHRcdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFVwZGF0ZWRTZXR0aW5nRXZlbnQsIHtcblx0XHRcdFx0XHRcdG93bmVyOiAnc2FuZHkwODEnO1xuXHRcdFx0XHRcdFx0Y29tbWVudDogJ1RoaXMgaXMgdXNlZCB0byBrbm93IHRoZSBuZXcgd2luZG93IHByb2ZpbGUgdGhhdCBpcyBiZWluZyB1c2VkJztcblx0XHRcdFx0XHRcdHNldHRpbmdWYWx1ZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ2lmIHRoZSBwcm9maWxlIGlzIGRlZmF1bHQgb3Igbm90JyB9O1xuXHRcdFx0XHRcdFx0c291cmNlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnc291cmNlIG9mIHRoZSBzZXR0aW5nJyB9O1xuXHRcdFx0XHRcdH0+KCd3aW5kb3cubmV3V2luZG93UHJvZmlsZScsIHsgc2V0dGluZ1ZhbHVlLCBzb3VyY2UgfSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdGNhc2UgQXV0b1Jlc3RhcnRDb25maWd1cmF0aW9uS2V5OlxuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxVcGRhdGVkU2V0dGluZ0V2ZW50LCB7XG5cdFx0XHRcdFx0b3duZXI6ICdzYW5keTA4MSc7XG5cdFx0XHRcdFx0Y29tbWVudDogJ1RoaXMgaXMgdXNlZCB0byBrbm93IGlmIGV4dGVuc2lvbnMgYXJlIGdldHRpbmcgYXV0byByZXN0YXJ0ZWQgb3Igbm90Jztcblx0XHRcdFx0XHRzZXR0aW5nVmFsdWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICd2YWx1ZSBvZiB0aGUgc2V0dGluZycgfTtcblx0XHRcdFx0XHRzb3VyY2U6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdzb3VyY2Ugb2YgdGhlIHNldHRpbmcnIH07XG5cdFx0XHRcdH0+KCdleHRlbnNpb25zLmF1dG9SZXN0YXJ0JywgeyBzZXR0aW5nVmFsdWU6IHRoaXMuZ2V0VmFsdWVUb1JlcG9ydChrZXksIHRhcmdldCksIHNvdXJjZSB9KTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0fVxuXG59XG5cbmNvbnN0IHdvcmtiZW5jaENvbnRyaWJ1dGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpO1xud29ya2JlbmNoQ29udHJpYnV0aW9uUmVnaXN0cnkucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oVGVsZW1ldHJ5Q29udHJpYnV0aW9uLCBMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG53b3JrYmVuY2hDb250cmlidXRpb25SZWdpc3RyeS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihDb25maWd1cmF0aW9uVGVsZW1ldHJ5Q29udHJpYnV0aW9uLCBMaWZlY3ljbGVQaGFzZS5FdmVu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
