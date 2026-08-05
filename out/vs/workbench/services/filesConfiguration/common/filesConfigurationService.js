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
import { localize } from "../../../../nls.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { RawContextKey, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { AutoSaveConfiguration, HotExitConfiguration, FILES_READONLY_INCLUDE_CONFIG, FILES_READONLY_EXCLUDE_CONFIG, IFileService, hasReadonlyCapability } from "../../../../platform/files/common/files.js";
import { equals } from "../../../../base/common/objects.js";
import { isWeb } from "../../../../base/common/platform.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { ResourceGlobMatcher } from "../../../common/resources.js";
import { GlobalIdleValue } from "../../../../base/common/async.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { LRUCache, ResourceMap } from "../../../../base/common/map.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { EditorResourceAccessor, SaveReason, SideBySideEditor } from "../../../common/editor.js";
import { IMarkerService, MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
const AutoSaveAfterShortDelayContext = new RawContextKey("autoSaveAfterShortDelayContext", false, true);
var AutoSaveMode = /* @__PURE__ */ ((AutoSaveMode2) => {
  AutoSaveMode2[AutoSaveMode2["OFF"] = 0] = "OFF";
  AutoSaveMode2[AutoSaveMode2["AFTER_SHORT_DELAY"] = 1] = "AFTER_SHORT_DELAY";
  AutoSaveMode2[AutoSaveMode2["AFTER_LONG_DELAY"] = 2] = "AFTER_LONG_DELAY";
  AutoSaveMode2[AutoSaveMode2["ON_FOCUS_CHANGE"] = 3] = "ON_FOCUS_CHANGE";
  AutoSaveMode2[AutoSaveMode2["ON_WINDOW_CHANGE"] = 4] = "ON_WINDOW_CHANGE";
  return AutoSaveMode2;
})(AutoSaveMode || {});
var AutoSaveDisabledReason = /* @__PURE__ */ ((AutoSaveDisabledReason2) => {
  AutoSaveDisabledReason2[AutoSaveDisabledReason2["SETTINGS"] = 1] = "SETTINGS";
  AutoSaveDisabledReason2[AutoSaveDisabledReason2["OUT_OF_WORKSPACE"] = 2] = "OUT_OF_WORKSPACE";
  AutoSaveDisabledReason2[AutoSaveDisabledReason2["ERRORS"] = 3] = "ERRORS";
  AutoSaveDisabledReason2[AutoSaveDisabledReason2["DISABLED"] = 4] = "DISABLED";
  return AutoSaveDisabledReason2;
})(AutoSaveDisabledReason || {});
const IFilesConfigurationService = createDecorator("filesConfigurationService");
let FilesConfigurationService = class extends Disposable {
  constructor(contextKeyService, configurationService, contextService, environmentService, uriIdentityService, fileService, markerService, textResourceConfigurationService) {
    super();
    this.configurationService = configurationService;
    this.contextService = contextService;
    this.environmentService = environmentService;
    this.uriIdentityService = uriIdentityService;
    this.fileService = fileService;
    this.markerService = markerService;
    this.textResourceConfigurationService = textResourceConfigurationService;
    this._onDidChangeAutoSaveConfiguration = this._register(new Emitter());
    this.onDidChangeAutoSaveConfiguration = this._onDidChangeAutoSaveConfiguration.event;
    this._onDidChangeAutoSaveDisabled = this._register(new Emitter());
    this.onDidChangeAutoSaveDisabled = this._onDidChangeAutoSaveDisabled.event;
    this._onDidChangeFilesAssociation = this._register(new Emitter());
    this.onDidChangeFilesAssociation = this._onDidChangeFilesAssociation.event;
    this._onDidChangeReadonly = this._register(new Emitter());
    this.onDidChangeReadonly = this._onDidChangeReadonly.event;
    this.autoSaveConfigurationCache = new LRUCache(1e3);
    this.autoSaveAfterShortDelayOverrides = new ResourceMap();
    this.autoSaveDisabledOverrides = new ResourceMap();
    this.readonlyIncludeMatcher = this._register(new GlobalIdleValue(() => this.createReadonlyMatcher(FILES_READONLY_INCLUDE_CONFIG)));
    this.readonlyExcludeMatcher = this._register(new GlobalIdleValue(() => this.createReadonlyMatcher(FILES_READONLY_EXCLUDE_CONFIG)));
    this.sessionReadonlyOverrides = new ResourceMap((resource) => this.uriIdentityService.extUri.getComparisonKey(resource));
    this.autoSaveAfterShortDelayContext = AutoSaveAfterShortDelayContext.bindTo(contextKeyService);
    const configuration = configurationService.getValue();
    this.currentGlobalAutoSaveConfiguration = this.computeAutoSaveConfiguration(void 0, configuration.files);
    this.currentFilesAssociationConfiguration = configuration?.files?.associations;
    this.currentHotExitConfiguration = configuration?.files?.hotExit || HotExitConfiguration.ON_EXIT;
    this.onFilesConfigurationChange(configuration, false);
    this.registerListeners();
  }
  createReadonlyMatcher(config) {
    const matcher = this._register(new ResourceGlobMatcher(
      (resource) => this.configurationService.getValue(config, { resource }),
      (event) => event.affectsConfiguration(config),
      this.contextService,
      this.configurationService
    ));
    this._register(matcher.onExpressionChange(() => this._onDidChangeReadonly.fire()));
    return matcher;
  }
  isReadonly(resource, stat) {
    const provider = this.fileService.getProvider(resource.scheme);
    if (provider && hasReadonlyCapability(provider)) {
      return provider.readOnlyMessage ?? FilesConfigurationService.READONLY_MESSAGES.providerReadonly;
    }
    const sessionReadonlyOverride = this.sessionReadonlyOverrides.get(resource);
    if (typeof sessionReadonlyOverride === "boolean") {
      return sessionReadonlyOverride === true ? FilesConfigurationService.READONLY_MESSAGES.sessionReadonly : false;
    }
    if (this.uriIdentityService.extUri.isEqualOrParent(resource, this.environmentService.userRoamingDataHome) || this.uriIdentityService.extUri.isEqual(resource, this.contextService.getWorkspace().configuration ?? void 0)) {
      return false;
    }
    if (this.readonlyIncludeMatcher.value.matches(resource)) {
      return !this.readonlyExcludeMatcher.value.matches(resource) ? FilesConfigurationService.READONLY_MESSAGES.configuredReadonly : false;
    }
    if (this.configuredReadonlyFromPermissions && stat?.locked) {
      return FilesConfigurationService.READONLY_MESSAGES.fileLocked;
    }
    if (stat?.readonly) {
      return FilesConfigurationService.READONLY_MESSAGES.fileReadonly;
    }
    return false;
  }
  async updateReadonly(resource, readonly) {
    if (readonly === "toggle") {
      let stat = void 0;
      try {
        stat = await this.fileService.resolve(resource, { resolveMetadata: true });
      } catch (error) {
      }
      readonly = !this.isReadonly(resource, stat);
    }
    if (readonly === "reset") {
      this.sessionReadonlyOverrides.delete(resource);
    } else {
      this.sessionReadonlyOverrides.set(resource, readonly);
    }
    this._onDidChangeReadonly.fire();
  }
  registerListeners() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("files")) {
        this.onFilesConfigurationChange(this.configurationService.getValue(), true);
      }
    }));
  }
  onFilesConfigurationChange(configuration, fromEvent) {
    this.currentGlobalAutoSaveConfiguration = this.computeAutoSaveConfiguration(void 0, configuration.files);
    this.autoSaveConfigurationCache.clear();
    this.autoSaveAfterShortDelayContext.set(this.getAutoSaveMode(void 0).mode === 1 /* AFTER_SHORT_DELAY */);
    if (fromEvent) {
      this._onDidChangeAutoSaveConfiguration.fire();
    }
    const filesAssociation = configuration?.files?.associations;
    if (!equals(this.currentFilesAssociationConfiguration, filesAssociation)) {
      this.currentFilesAssociationConfiguration = filesAssociation;
      if (fromEvent) {
        this._onDidChangeFilesAssociation.fire();
      }
    }
    const hotExitMode = configuration?.files?.hotExit;
    if (hotExitMode === HotExitConfiguration.OFF || hotExitMode === HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE) {
      this.currentHotExitConfiguration = hotExitMode;
    } else {
      this.currentHotExitConfiguration = HotExitConfiguration.ON_EXIT;
    }
    const readonlyFromPermissions = Boolean(configuration?.files?.readonlyFromPermissions);
    if (readonlyFromPermissions !== Boolean(this.configuredReadonlyFromPermissions)) {
      this.configuredReadonlyFromPermissions = readonlyFromPermissions;
      if (fromEvent) {
        this._onDidChangeReadonly.fire();
      }
    }
  }
  getAutoSaveConfiguration(resourceOrEditor) {
    const resource = this.toResource(resourceOrEditor);
    if (resource) {
      let resourceAutoSaveConfiguration = this.autoSaveConfigurationCache.get(resource);
      if (!resourceAutoSaveConfiguration) {
        resourceAutoSaveConfiguration = this.computeAutoSaveConfiguration(resource, this.textResourceConfigurationService.getValue(resource, "files"));
        this.autoSaveConfigurationCache.set(resource, resourceAutoSaveConfiguration);
      }
      return resourceAutoSaveConfiguration;
    }
    return this.currentGlobalAutoSaveConfiguration;
  }
  computeAutoSaveConfiguration(resource, filesConfiguration) {
    let autoSave;
    let autoSaveDelay;
    let autoSaveWorkspaceFilesOnly;
    let autoSaveWhenNoErrors;
    let isOutOfWorkspace;
    let isShortAutoSaveDelay;
    switch (filesConfiguration?.autoSave ?? FilesConfigurationService.DEFAULT_AUTO_SAVE_MODE) {
      case AutoSaveConfiguration.AFTER_DELAY: {
        autoSave = "afterDelay";
        autoSaveDelay = typeof filesConfiguration?.autoSaveDelay === "number" && filesConfiguration.autoSaveDelay >= 0 ? filesConfiguration.autoSaveDelay : FilesConfigurationService.DEFAULT_AUTO_SAVE_DELAY;
        isShortAutoSaveDelay = autoSaveDelay <= FilesConfigurationService.DEFAULT_AUTO_SAVE_DELAY;
        break;
      }
      case AutoSaveConfiguration.ON_FOCUS_CHANGE:
        autoSave = "onFocusChange";
        break;
      case AutoSaveConfiguration.ON_WINDOW_CHANGE:
        autoSave = "onWindowChange";
        break;
    }
    if (filesConfiguration?.autoSaveWorkspaceFilesOnly === true) {
      autoSaveWorkspaceFilesOnly = true;
      if (resource && !this.contextService.isInsideWorkspace(resource)) {
        isOutOfWorkspace = true;
        isShortAutoSaveDelay = void 0;
      }
    }
    if (filesConfiguration?.autoSaveWhenNoErrors === true) {
      autoSaveWhenNoErrors = true;
      isShortAutoSaveDelay = void 0;
    }
    return {
      autoSave,
      autoSaveDelay,
      autoSaveWorkspaceFilesOnly,
      autoSaveWhenNoErrors,
      isOutOfWorkspace,
      isShortAutoSaveDelay
    };
  }
  toResource(resourceOrEditor) {
    if (resourceOrEditor instanceof EditorInput) {
      return EditorResourceAccessor.getOriginalUri(resourceOrEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    }
    return resourceOrEditor;
  }
  hasShortAutoSaveDelay(resourceOrEditor) {
    const resource = this.toResource(resourceOrEditor);
    if (resource && this.autoSaveAfterShortDelayOverrides.has(resource)) {
      return true;
    }
    if (this.getAutoSaveConfiguration(resource).isShortAutoSaveDelay) {
      return !resource || !this.autoSaveDisabledOverrides.has(resource);
    }
    return false;
  }
  getAutoSaveMode(resourceOrEditor, saveReason) {
    const resource = this.toResource(resourceOrEditor);
    if (resource && this.autoSaveAfterShortDelayOverrides.has(resource)) {
      return { mode: 1 /* AFTER_SHORT_DELAY */ };
    }
    if (resource && this.autoSaveDisabledOverrides.has(resource)) {
      return { mode: 0 /* OFF */, reason: 4 /* DISABLED */ };
    }
    const autoSaveConfiguration = this.getAutoSaveConfiguration(resource);
    if (typeof autoSaveConfiguration.autoSave === "undefined") {
      return { mode: 0 /* OFF */, reason: 1 /* SETTINGS */ };
    }
    if (typeof saveReason === "number") {
      if (autoSaveConfiguration.autoSave === "afterDelay" && saveReason !== SaveReason.AUTO || autoSaveConfiguration.autoSave === "onFocusChange" && saveReason !== SaveReason.FOCUS_CHANGE && saveReason !== SaveReason.WINDOW_CHANGE || autoSaveConfiguration.autoSave === "onWindowChange" && saveReason !== SaveReason.WINDOW_CHANGE) {
        return { mode: 0 /* OFF */, reason: 1 /* SETTINGS */ };
      }
    }
    if (resource) {
      if (autoSaveConfiguration.autoSaveWorkspaceFilesOnly && autoSaveConfiguration.isOutOfWorkspace) {
        return { mode: 0 /* OFF */, reason: 2 /* OUT_OF_WORKSPACE */ };
      }
      if (autoSaveConfiguration.autoSaveWhenNoErrors && this.markerService.read({ resource, take: 1, severities: MarkerSeverity.Error }).length > 0) {
        return { mode: 0 /* OFF */, reason: 3 /* ERRORS */ };
      }
    }
    switch (autoSaveConfiguration.autoSave) {
      case "afterDelay":
        if (typeof autoSaveConfiguration.autoSaveDelay === "number" && autoSaveConfiguration.autoSaveDelay <= FilesConfigurationService.DEFAULT_AUTO_SAVE_DELAY) {
          return { mode: autoSaveConfiguration.autoSaveWhenNoErrors ? 2 /* AFTER_LONG_DELAY */ : 1 /* AFTER_SHORT_DELAY */ };
        }
        return { mode: 2 /* AFTER_LONG_DELAY */ };
      case "onFocusChange":
        return { mode: 3 /* ON_FOCUS_CHANGE */ };
      case "onWindowChange":
        return { mode: 4 /* ON_WINDOW_CHANGE */ };
    }
  }
  async toggleAutoSave() {
    const currentSetting = this.configurationService.getValue("files.autoSave");
    let newAutoSaveValue;
    if ([AutoSaveConfiguration.AFTER_DELAY, AutoSaveConfiguration.ON_FOCUS_CHANGE, AutoSaveConfiguration.ON_WINDOW_CHANGE].some((setting) => setting === currentSetting)) {
      newAutoSaveValue = AutoSaveConfiguration.OFF;
    } else {
      newAutoSaveValue = AutoSaveConfiguration.AFTER_DELAY;
    }
    return this.configurationService.updateValue("files.autoSave", newAutoSaveValue);
  }
  enableAutoSaveAfterShortDelay(resourceOrEditor) {
    const resource = this.toResource(resourceOrEditor);
    if (!resource) {
      return Disposable.None;
    }
    const counter = this.autoSaveAfterShortDelayOverrides.get(resource) ?? 0;
    this.autoSaveAfterShortDelayOverrides.set(resource, counter + 1);
    return toDisposable(() => {
      const counter2 = this.autoSaveAfterShortDelayOverrides.get(resource) ?? 0;
      if (counter2 <= 1) {
        this.autoSaveAfterShortDelayOverrides.delete(resource);
      } else {
        this.autoSaveAfterShortDelayOverrides.set(resource, counter2 - 1);
      }
    });
  }
  disableAutoSave(resourceOrEditor) {
    const resource = this.toResource(resourceOrEditor);
    if (!resource) {
      return Disposable.None;
    }
    const counter = this.autoSaveDisabledOverrides.get(resource) ?? 0;
    this.autoSaveDisabledOverrides.set(resource, counter + 1);
    if (counter === 0) {
      this._onDidChangeAutoSaveDisabled.fire(resource);
    }
    return toDisposable(() => {
      const counter2 = this.autoSaveDisabledOverrides.get(resource) ?? 0;
      if (counter2 <= 1) {
        this.autoSaveDisabledOverrides.delete(resource);
        this._onDidChangeAutoSaveDisabled.fire(resource);
      } else {
        this.autoSaveDisabledOverrides.set(resource, counter2 - 1);
      }
    });
  }
  get isHotExitEnabled() {
    if (this.contextService.getWorkspace().transient) {
      return false;
    }
    return this.currentHotExitConfiguration !== HotExitConfiguration.OFF;
  }
  get hotExitConfiguration() {
    return this.currentHotExitConfiguration;
  }
  preventSaveConflicts(resource, language) {
    return this.configurationService.getValue("files.saveConflictResolution", { resource, overrideIdentifier: language }) !== "overwriteFileOnDisk";
  }
};
FilesConfigurationService.DEFAULT_AUTO_SAVE_MODE = isWeb ? AutoSaveConfiguration.AFTER_DELAY : AutoSaveConfiguration.OFF;
FilesConfigurationService.DEFAULT_AUTO_SAVE_DELAY = 1e3;
FilesConfigurationService.READONLY_MESSAGES = {
  providerReadonly: { value: localize("providerReadonly", "Editor is read-only because the file system of the file is read-only."), isTrusted: true },
  sessionReadonly: { value: localize({ key: "sessionReadonly", comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change', '{Locked="](command:{0})"}'] }, "Editor is read-only because the file was set read-only in this session. [Click here](command:{0}) to set writeable.", "workbench.action.files.setActiveEditorWriteableInSession"), isTrusted: true },
  configuredReadonly: { value: localize({ key: "configuredReadonly", comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change', '{Locked="](command:{0})"}'] }, "Editor is read-only because the file was set read-only via settings. [Click here](command:{0}) to configure or [toggle for this session](command:{1}).", `workbench.action.openSettings?${encodeURIComponent('["files.readonly"]')}`, "workbench.action.files.toggleActiveEditorReadonlyInSession"), isTrusted: true },
  fileLocked: { value: localize({ key: "fileLocked", comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change', '{Locked="](command:{0})"}'] }, "Editor is read-only because of file permissions. [Click here](command:{0}) to set writeable anyway.", "workbench.action.files.setActiveEditorWriteableInSession"), isTrusted: true },
  fileReadonly: { value: localize("fileReadonly", "Editor is read-only because the file is read-only."), isTrusted: true }
};
FilesConfigurationService = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IEnvironmentService),
  __decorateParam(4, IUriIdentityService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IMarkerService),
  __decorateParam(7, ITextResourceConfigurationService)
], FilesConfigurationService);
registerSingleton(IFilesConfigurationService, FilesConfigurationService, InstantiationType.Eager);
export {
  AutoSaveAfterShortDelayContext,
  AutoSaveDisabledReason,
  AutoSaveMode,
  FilesConfigurationService,
  IFilesConfigurationService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZmlsZXNDb25maWd1cmF0aW9uL2NvbW1vbi9maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSYXdDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIElDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElGaWxlc0NvbmZpZ3VyYXRpb24sIEF1dG9TYXZlQ29uZmlndXJhdGlvbiwgSG90RXhpdENvbmZpZ3VyYXRpb24sIEZJTEVTX1JFQURPTkxZX0lOQ0xVREVfQ09ORklHLCBGSUxFU19SRUFET05MWV9FWENMVURFX0NPTkZJRywgSUZpbGVTdGF0V2l0aE1ldGFkYXRhLCBJRmlsZVNlcnZpY2UsIElCYXNlRmlsZVN0YXQsIGhhc1JlYWRvbmx5Q2FwYWJpbGl0eSwgSUZpbGVzQ29uZmlndXJhdGlvbk5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgaXNXZWIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZUdsb2JNYXRjaGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBHbG9iYWxJZGxlVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgTFJVQ2FjaGUsIFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLCBTYXZlUmVhc29uLCBTaWRlQnlTaWRlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJTWFya2VyU2VydmljZSwgTWFya2VyU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9tYXJrZXJzL2NvbW1vbi9tYXJrZXJzLmpzJztcbmltcG9ydCB7IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvdGV4dFJlc291cmNlQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RyaW5nRGljdGlvbmFyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcblxuZXhwb3J0IGNvbnN0IEF1dG9TYXZlQWZ0ZXJTaG9ydERlbGF5Q29udGV4dCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdhdXRvU2F2ZUFmdGVyU2hvcnREZWxheUNvbnRleHQnLCBmYWxzZSwgdHJ1ZSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUF1dG9TYXZlQ29uZmlndXJhdGlvbiB7XG5cdGF1dG9TYXZlPzogJ2FmdGVyRGVsYXknIHwgJ29uRm9jdXNDaGFuZ2UnIHwgJ29uV2luZG93Q2hhbmdlJztcblx0YXV0b1NhdmVEZWxheT86IG51bWJlcjtcblx0YXV0b1NhdmVXb3Jrc3BhY2VGaWxlc09ubHk/OiBib29sZWFuO1xuXHRhdXRvU2F2ZVdoZW5Ob0Vycm9ycz86IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBJQ2FjaGVkQXV0b1NhdmVDb25maWd1cmF0aW9uIGV4dGVuZHMgSUF1dG9TYXZlQ29uZmlndXJhdGlvbiB7XG5cblx0Ly8gU29tZSBleHRyYSBzdGF0ZSB0aGF0IHdlIGNhY2hlIHRvIHJlZHVjZSB0aGUgYW1vdW50XG5cdC8vIG9mIGxvb2t1cCB3ZSBoYXZlIHRvIGRvIHNpbmNlIGF1dG8gc2F2ZSBtZXRob2RzXG5cdC8vIGFyZSBiZWluZyBjYWxsZWQgdmVyeSBvZnRlbiwgZS5nLiB3aGVuIGNvbnRlbnQgY2hhbmdlc1xuXG5cdGlzT3V0T2ZXb3Jrc3BhY2U/OiBib29sZWFuO1xuXHRpc1Nob3J0QXV0b1NhdmVEZWxheT86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIEF1dG9TYXZlTW9kZSB7XG5cdE9GRixcblx0QUZURVJfU0hPUlRfREVMQVksXG5cdEFGVEVSX0xPTkdfREVMQVksXG5cdE9OX0ZPQ1VTX0NIQU5HRSxcblx0T05fV0lORE9XX0NIQU5HRVxufVxuXG5leHBvcnQgY29uc3QgZW51bSBBdXRvU2F2ZURpc2FibGVkUmVhc29uIHtcblx0U0VUVElOR1MgPSAxLFxuXHRPVVRfT0ZfV09SS1NQQUNFLFxuXHRFUlJPUlMsXG5cdERJU0FCTEVEXG59XG5cbmV4cG9ydCB0eXBlIElBdXRvU2F2ZU1vZGUgPSBJRW5hYmxlZEF1dG9TYXZlTW9kZSB8IElEaXNhYmxlZEF1dG9TYXZlTW9kZTtcblxuZXhwb3J0IGludGVyZmFjZSBJRW5hYmxlZEF1dG9TYXZlTW9kZSB7XG5cdHJlYWRvbmx5IG1vZGU6IEF1dG9TYXZlTW9kZS5BRlRFUl9TSE9SVF9ERUxBWSB8IEF1dG9TYXZlTW9kZS5BRlRFUl9MT05HX0RFTEFZIHwgQXV0b1NhdmVNb2RlLk9OX0ZPQ1VTX0NIQU5HRSB8IEF1dG9TYXZlTW9kZS5PTl9XSU5ET1dfQ0hBTkdFO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElEaXNhYmxlZEF1dG9TYXZlTW9kZSB7XG5cdHJlYWRvbmx5IG1vZGU6IEF1dG9TYXZlTW9kZS5PRkY7XG5cdHJlYWRvbmx5IHJlYXNvbjogQXV0b1NhdmVEaXNhYmxlZFJlYXNvbjtcbn1cblxuZXhwb3J0IGNvbnN0IElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlPignZmlsZXNDb25maWd1cmF0aW9uU2VydmljZScpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlIHtcblxuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0Ly8jcmVnaW9uIEF1dG8gU2F2ZVxuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQXV0b1NhdmVDb25maWd1cmF0aW9uOiBFdmVudDx2b2lkPjtcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZUF1dG9TYXZlRGlzYWJsZWQ6IEV2ZW50PFVSST47XG5cblx0Z2V0QXV0b1NhdmVDb25maWd1cmF0aW9uKHJlc291cmNlT3JFZGl0b3I6IEVkaXRvcklucHV0IHwgVVJJIHwgdW5kZWZpbmVkKTogSUF1dG9TYXZlQ29uZmlndXJhdGlvbjtcblxuXHRoYXNTaG9ydEF1dG9TYXZlRGVsYXkocmVzb3VyY2VPckVkaXRvcjogRWRpdG9ySW5wdXQgfCBVUkkgfCB1bmRlZmluZWQpOiBib29sZWFuO1xuXG5cdGdldEF1dG9TYXZlTW9kZShyZXNvdXJjZU9yRWRpdG9yOiBFZGl0b3JJbnB1dCB8IFVSSSB8IHVuZGVmaW5lZCwgc2F2ZVJlYXNvbj86IFNhdmVSZWFzb24pOiBJQXV0b1NhdmVNb2RlO1xuXG5cdHRvZ2dsZUF1dG9TYXZlKCk6IFByb21pc2U8dm9pZD47XG5cblx0ZW5hYmxlQXV0b1NhdmVBZnRlclNob3J0RGVsYXkocmVzb3VyY2VPckVkaXRvcjogRWRpdG9ySW5wdXQgfCBVUkkpOiBJRGlzcG9zYWJsZTtcblx0ZGlzYWJsZUF1dG9TYXZlKHJlc291cmNlT3JFZGl0b3I6IEVkaXRvcklucHV0IHwgVVJJKTogSURpc3Bvc2FibGU7XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIENvbmZpZ3VyZWQgUmVhZG9ubHlcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZVJlYWRvbmx5OiBFdmVudDx2b2lkPjtcblxuXHRpc1JlYWRvbmx5KHJlc291cmNlOiBVUkksIHN0YXQ/OiBJQmFzZUZpbGVTdGF0KTogYm9vbGVhbiB8IElNYXJrZG93blN0cmluZztcblxuXHR1cGRhdGVSZWFkb25seShyZXNvdXJjZTogVVJJLCByZWFkb25seTogdHJ1ZSB8IGZhbHNlIHwgJ3RvZ2dsZScgfCAncmVzZXQnKTogUHJvbWlzZTx2b2lkPjtcblxuXHQvLyNlbmRyZWdpb25cblxuXHRyZWFkb25seSBvbkRpZENoYW5nZUZpbGVzQXNzb2NpYXRpb246IEV2ZW50PHZvaWQ+O1xuXG5cdHJlYWRvbmx5IGlzSG90RXhpdEVuYWJsZWQ6IGJvb2xlYW47XG5cblx0cmVhZG9ubHkgaG90RXhpdENvbmZpZ3VyYXRpb246IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRwcmV2ZW50U2F2ZUNvbmZsaWN0cyhyZXNvdXJjZTogVVJJLCBsYW5ndWFnZT86IHN0cmluZyk6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBERUZBVUxUX0FVVE9fU0FWRV9NT0RFID0gaXNXZWIgPyBBdXRvU2F2ZUNvbmZpZ3VyYXRpb24uQUZURVJfREVMQVkgOiBBdXRvU2F2ZUNvbmZpZ3VyYXRpb24uT0ZGO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBERUZBVUxUX0FVVE9fU0FWRV9ERUxBWSA9IDEwMDA7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgUkVBRE9OTFlfTUVTU0FHRVMgPSB7XG5cdFx0cHJvdmlkZXJSZWFkb25seTogeyB2YWx1ZTogbG9jYWxpemUoJ3Byb3ZpZGVyUmVhZG9ubHknLCBcIkVkaXRvciBpcyByZWFkLW9ubHkgYmVjYXVzZSB0aGUgZmlsZSBzeXN0ZW0gb2YgdGhlIGZpbGUgaXMgcmVhZC1vbmx5LlwiKSwgaXNUcnVzdGVkOiB0cnVlIH0sXG5cdFx0c2Vzc2lvblJlYWRvbmx5OiB7IHZhbHVlOiBsb2NhbGl6ZSh7IGtleTogJ3Nlc3Npb25SZWFkb25seScsIGNvbW1lbnQ6IFsnUGxlYXNlIGRvIG5vdCB0cmFuc2xhdGUgdGhlIHdvcmQgXCJjb21tYW5kXCIsIGl0IGlzIHBhcnQgb2Ygb3VyIGludGVybmFsIHN5bnRheCB3aGljaCBtdXN0IG5vdCBjaGFuZ2UnLCAne0xvY2tlZD1cIl0oY29tbWFuZDp7MH0pXCJ9J10gfSwgXCJFZGl0b3IgaXMgcmVhZC1vbmx5IGJlY2F1c2UgdGhlIGZpbGUgd2FzIHNldCByZWFkLW9ubHkgaW4gdGhpcyBzZXNzaW9uLiBbQ2xpY2sgaGVyZV0oY29tbWFuZDp7MH0pIHRvIHNldCB3cml0ZWFibGUuXCIsICd3b3JrYmVuY2guYWN0aW9uLmZpbGVzLnNldEFjdGl2ZUVkaXRvcldyaXRlYWJsZUluU2Vzc2lvbicpLCBpc1RydXN0ZWQ6IHRydWUgfSxcblx0XHRjb25maWd1cmVkUmVhZG9ubHk6IHsgdmFsdWU6IGxvY2FsaXplKHsga2V5OiAnY29uZmlndXJlZFJlYWRvbmx5JywgY29tbWVudDogWydQbGVhc2UgZG8gbm90IHRyYW5zbGF0ZSB0aGUgd29yZCBcImNvbW1hbmRcIiwgaXQgaXMgcGFydCBvZiBvdXIgaW50ZXJuYWwgc3ludGF4IHdoaWNoIG11c3Qgbm90IGNoYW5nZScsICd7TG9ja2VkPVwiXShjb21tYW5kOnswfSlcIn0nXSB9LCBcIkVkaXRvciBpcyByZWFkLW9ubHkgYmVjYXVzZSB0aGUgZmlsZSB3YXMgc2V0IHJlYWQtb25seSB2aWEgc2V0dGluZ3MuIFtDbGljayBoZXJlXShjb21tYW5kOnswfSkgdG8gY29uZmlndXJlIG9yIFt0b2dnbGUgZm9yIHRoaXMgc2Vzc2lvbl0oY29tbWFuZDp7MX0pLlwiLCBgd29ya2JlbmNoLmFjdGlvbi5vcGVuU2V0dGluZ3M/JHtlbmNvZGVVUklDb21wb25lbnQoJ1tcImZpbGVzLnJlYWRvbmx5XCJdJyl9YCwgJ3dvcmtiZW5jaC5hY3Rpb24uZmlsZXMudG9nZ2xlQWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24nKSwgaXNUcnVzdGVkOiB0cnVlIH0sXG5cdFx0ZmlsZUxvY2tlZDogeyB2YWx1ZTogbG9jYWxpemUoeyBrZXk6ICdmaWxlTG9ja2VkJywgY29tbWVudDogWydQbGVhc2UgZG8gbm90IHRyYW5zbGF0ZSB0aGUgd29yZCBcImNvbW1hbmRcIiwgaXQgaXMgcGFydCBvZiBvdXIgaW50ZXJuYWwgc3ludGF4IHdoaWNoIG11c3Qgbm90IGNoYW5nZScsICd7TG9ja2VkPVwiXShjb21tYW5kOnswfSlcIn0nXSB9LCBcIkVkaXRvciBpcyByZWFkLW9ubHkgYmVjYXVzZSBvZiBmaWxlIHBlcm1pc3Npb25zLiBbQ2xpY2sgaGVyZV0oY29tbWFuZDp7MH0pIHRvIHNldCB3cml0ZWFibGUgYW55d2F5LlwiLCAnd29ya2JlbmNoLmFjdGlvbi5maWxlcy5zZXRBY3RpdmVFZGl0b3JXcml0ZWFibGVJblNlc3Npb24nKSwgaXNUcnVzdGVkOiB0cnVlIH0sXG5cdFx0ZmlsZVJlYWRvbmx5OiB7IHZhbHVlOiBsb2NhbGl6ZSgnZmlsZVJlYWRvbmx5JywgXCJFZGl0b3IgaXMgcmVhZC1vbmx5IGJlY2F1c2UgdGhlIGZpbGUgaXMgcmVhZC1vbmx5LlwiKSwgaXNUcnVzdGVkOiB0cnVlIH1cblx0fTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUF1dG9TYXZlQ29uZmlndXJhdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUF1dG9TYXZlQ29uZmlndXJhdGlvbiA9IHRoaXMuX29uRGlkQ2hhbmdlQXV0b1NhdmVDb25maWd1cmF0aW9uLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQXV0b1NhdmVEaXNhYmxlZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFVSST4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQXV0b1NhdmVEaXNhYmxlZCA9IHRoaXMuX29uRGlkQ2hhbmdlQXV0b1NhdmVEaXNhYmxlZC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUZpbGVzQXNzb2NpYXRpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VGaWxlc0Fzc29jaWF0aW9uID0gdGhpcy5fb25EaWRDaGFuZ2VGaWxlc0Fzc29jaWF0aW9uLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlUmVhZG9ubHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VSZWFkb25seSA9IHRoaXMuX29uRGlkQ2hhbmdlUmVhZG9ubHkuZXZlbnQ7XG5cblx0cHJpdmF0ZSBjdXJyZW50R2xvYmFsQXV0b1NhdmVDb25maWd1cmF0aW9uOiBJQXV0b1NhdmVDb25maWd1cmF0aW9uO1xuXHRwcml2YXRlIGN1cnJlbnRGaWxlc0Fzc29jaWF0aW9uQ29uZmlndXJhdGlvbjogSVN0cmluZ0RpY3Rpb25hcnk8c3RyaW5nPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjdXJyZW50SG90RXhpdENvbmZpZ3VyYXRpb246IHN0cmluZztcblxuXHRwcml2YXRlIHJlYWRvbmx5IGF1dG9TYXZlQ29uZmlndXJhdGlvbkNhY2hlID0gbmV3IExSVUNhY2hlPFVSSSwgSUNhY2hlZEF1dG9TYXZlQ29uZmlndXJhdGlvbj4oMTAwMCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBhdXRvU2F2ZUFmdGVyU2hvcnREZWxheU92ZXJyaWRlcyA9IG5ldyBSZXNvdXJjZU1hcDxudW1iZXIgLyogY291bnRlciAqLz4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBhdXRvU2F2ZURpc2FibGVkT3ZlcnJpZGVzID0gbmV3IFJlc291cmNlTWFwPG51bWJlciAvKiBjb3VudGVyICovPigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgYXV0b1NhdmVBZnRlclNob3J0RGVsYXlDb250ZXh0OiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHJlYWRvbmx5SW5jbHVkZU1hdGNoZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgR2xvYmFsSWRsZVZhbHVlKCgpID0+IHRoaXMuY3JlYXRlUmVhZG9ubHlNYXRjaGVyKEZJTEVTX1JFQURPTkxZX0lOQ0xVREVfQ09ORklHKSkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHJlYWRvbmx5RXhjbHVkZU1hdGNoZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgR2xvYmFsSWRsZVZhbHVlKCgpID0+IHRoaXMuY3JlYXRlUmVhZG9ubHlNYXRjaGVyKEZJTEVTX1JFQURPTkxZX0VYQ0xVREVfQ09ORklHKSkpO1xuXHRwcml2YXRlIGNvbmZpZ3VyZWRSZWFkb25seUZyb21QZXJtaXNzaW9uczogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHNlc3Npb25SZWFkb25seU92ZXJyaWRlcyA9IG5ldyBSZXNvdXJjZU1hcDxib29sZWFuPihyZXNvdXJjZSA9PiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuZ2V0Q29tcGFyaXNvbktleShyZXNvdXJjZSkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVudmlyb25tZW50U2VydmljZTogSUVudmlyb25tZW50U2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASU1hcmtlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtYXJrZXJTZXJ2aWNlOiBJTWFya2VyU2VydmljZSxcblx0XHRASVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2U6IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5hdXRvU2F2ZUFmdGVyU2hvcnREZWxheUNvbnRleHQgPSBBdXRvU2F2ZUFmdGVyU2hvcnREZWxheUNvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb24gPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRmlsZXNDb25maWd1cmF0aW9uPigpO1xuXG5cdFx0dGhpcy5jdXJyZW50R2xvYmFsQXV0b1NhdmVDb25maWd1cmF0aW9uID0gdGhpcy5jb21wdXRlQXV0b1NhdmVDb25maWd1cmF0aW9uKHVuZGVmaW5lZCwgY29uZmlndXJhdGlvbi5maWxlcyk7XG5cdFx0dGhpcy5jdXJyZW50RmlsZXNBc3NvY2lhdGlvbkNvbmZpZ3VyYXRpb24gPSBjb25maWd1cmF0aW9uPy5maWxlcz8uYXNzb2NpYXRpb25zO1xuXHRcdHRoaXMuY3VycmVudEhvdEV4aXRDb25maWd1cmF0aW9uID0gY29uZmlndXJhdGlvbj8uZmlsZXM/LmhvdEV4aXQgfHwgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVDtcblxuXHRcdHRoaXMub25GaWxlc0NvbmZpZ3VyYXRpb25DaGFuZ2UoY29uZmlndXJhdGlvbiwgZmFsc2UpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVSZWFkb25seU1hdGNoZXIoY29uZmlnOiBzdHJpbmcpIHtcblx0XHRjb25zdCBtYXRjaGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJlc291cmNlR2xvYk1hdGNoZXIoXG5cdFx0XHRyZXNvdXJjZSA9PiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKGNvbmZpZywgeyByZXNvdXJjZSB9KSxcblx0XHRcdGV2ZW50ID0+IGV2ZW50LmFmZmVjdHNDb25maWd1cmF0aW9uKGNvbmZpZyksXG5cdFx0XHR0aGlzLmNvbnRleHRTZXJ2aWNlLFxuXHRcdFx0dGhpcy5jb25maWd1cmF0aW9uU2VydmljZVxuXHRcdCkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIobWF0Y2hlci5vbkV4cHJlc3Npb25DaGFuZ2UoKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VSZWFkb25seS5maXJlKCkpKTtcblxuXHRcdHJldHVybiBtYXRjaGVyO1xuXHR9XG5cblx0aXNSZWFkb25seShyZXNvdXJjZTogVVJJLCBzdGF0PzogSUJhc2VGaWxlU3RhdCk6IGJvb2xlYW4gfCBJTWFya2Rvd25TdHJpbmcge1xuXG5cdFx0Ly8gaWYgdGhlIGVudGlyZSBmaWxlIHN5c3RlbSBwcm92aWRlciBpcyByZWFkb25seSwgd2UgcmVzcGVjdCB0aGF0XG5cdFx0Ly8gYW5kIGRvIG5vdCBhbGxvdyB0byBjaGFuZ2UgcmVhZG9ubHkuIHdlIHRha2UgdGhpcyBhcyBhIGhpbnQgdGhhdFxuXHRcdC8vIHRoZSBwcm92aWRlciBoYXMgbm8gY2FwYWJpbGl0aWVzIG9mIHdyaXRpbmcuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLmZpbGVTZXJ2aWNlLmdldFByb3ZpZGVyKHJlc291cmNlLnNjaGVtZSk7XG5cdFx0aWYgKHByb3ZpZGVyICYmIGhhc1JlYWRvbmx5Q2FwYWJpbGl0eShwcm92aWRlcikpIHtcblx0XHRcdHJldHVybiBwcm92aWRlci5yZWFkT25seU1lc3NhZ2UgPz8gRmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5SRUFET05MWV9NRVNTQUdFUy5wcm92aWRlclJlYWRvbmx5O1xuXHRcdH1cblxuXHRcdC8vIHNlc3Npb24gb3ZlcnJpZGUgYWx3YXlzIHdpbnMgb3ZlciB0aGUgb3RoZXJzXG5cdFx0Y29uc3Qgc2Vzc2lvblJlYWRvbmx5T3ZlcnJpZGUgPSB0aGlzLnNlc3Npb25SZWFkb25seU92ZXJyaWRlcy5nZXQocmVzb3VyY2UpO1xuXHRcdGlmICh0eXBlb2Ygc2Vzc2lvblJlYWRvbmx5T3ZlcnJpZGUgPT09ICdib29sZWFuJykge1xuXHRcdFx0cmV0dXJuIHNlc3Npb25SZWFkb25seU92ZXJyaWRlID09PSB0cnVlID8gRmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5SRUFET05MWV9NRVNTQUdFUy5zZXNzaW9uUmVhZG9ubHkgOiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoXG5cdFx0XHR0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbE9yUGFyZW50KHJlc291cmNlLCB0aGlzLmVudmlyb25tZW50U2VydmljZS51c2VyUm9hbWluZ0RhdGFIb21lKSB8fFxuXHRcdFx0dGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwocmVzb3VyY2UsIHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuY29uZmlndXJhdGlvbiA/PyB1bmRlZmluZWQpXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIGV4cGxpY2l0bHkgZXhjbHVkZSBzb21lIHBhdGhzIGZyb20gcmVhZG9ubHkgdGhhdCB3ZSBuZWVkIGZvciBjb25maWd1cmF0aW9uXG5cdFx0fVxuXG5cdFx0Ly8gY29uZmlndXJlZCBnbG9iIHBhdHRlcm5zIHdpbiBvdmVyIHN0YXQgaW5mb3JtYXRpb25cblx0XHRpZiAodGhpcy5yZWFkb25seUluY2x1ZGVNYXRjaGVyLnZhbHVlLm1hdGNoZXMocmVzb3VyY2UpKSB7XG5cdFx0XHRyZXR1cm4gIXRoaXMucmVhZG9ubHlFeGNsdWRlTWF0Y2hlci52YWx1ZS5tYXRjaGVzKHJlc291cmNlKSA/IEZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuUkVBRE9OTFlfTUVTU0FHRVMuY29uZmlndXJlZFJlYWRvbmx5IDogZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gY2hlY2sgaWYgZmlsZSBpcyBsb2NrZWQgYW5kIGNvbmZpZ3VyZWQgdG8gdHJlYXQgYXMgcmVhZG9ubHlcblx0XHRpZiAodGhpcy5jb25maWd1cmVkUmVhZG9ubHlGcm9tUGVybWlzc2lvbnMgJiYgc3RhdD8ubG9ja2VkKSB7XG5cdFx0XHRyZXR1cm4gRmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5SRUFET05MWV9NRVNTQUdFUy5maWxlTG9ja2VkO1xuXHRcdH1cblxuXHRcdC8vIGNoZWNrIGlmIGZpbGUgaXMgbWFya2VkIHJlYWRvbmx5IGZyb20gdGhlIGZpbGUgc3lzdGVtIHByb3ZpZGVyXG5cdFx0aWYgKHN0YXQ/LnJlYWRvbmx5KSB7XG5cdFx0XHRyZXR1cm4gRmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5SRUFET05MWV9NRVNTQUdFUy5maWxlUmVhZG9ubHk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlUmVhZG9ubHkocmVzb3VyY2U6IFVSSSwgcmVhZG9ubHk6IHRydWUgfCBmYWxzZSB8ICd0b2dnbGUnIHwgJ3Jlc2V0Jyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChyZWFkb25seSA9PT0gJ3RvZ2dsZScpIHtcblx0XHRcdGxldCBzdGF0OiBJRmlsZVN0YXRXaXRoTWV0YWRhdGEgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzdGF0ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZXNvbHZlKHJlc291cmNlLCB7IHJlc29sdmVNZXRhZGF0YTogdHJ1ZSB9KTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdC8vIGlnbm9yZVxuXHRcdFx0fVxuXG5cdFx0XHRyZWFkb25seSA9ICF0aGlzLmlzUmVhZG9ubHkocmVzb3VyY2UsIHN0YXQpO1xuXHRcdH1cblxuXHRcdGlmIChyZWFkb25seSA9PT0gJ3Jlc2V0Jykge1xuXHRcdFx0dGhpcy5zZXNzaW9uUmVhZG9ubHlPdmVycmlkZXMuZGVsZXRlKHJlc291cmNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zZXNzaW9uUmVhZG9ubHlPdmVycmlkZXMuc2V0KHJlc291cmNlLCByZWFkb25seSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VSZWFkb25seS5maXJlKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXG5cdFx0Ly8gRmlsZXMgY29uZmlndXJhdGlvbiBjaGFuZ2VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZmlsZXMnKSkge1xuXHRcdFx0XHR0aGlzLm9uRmlsZXNDb25maWd1cmF0aW9uQ2hhbmdlKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SUZpbGVzQ29uZmlndXJhdGlvbj4oKSwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG9uRmlsZXNDb25maWd1cmF0aW9uQ2hhbmdlKGNvbmZpZ3VyYXRpb246IElGaWxlc0NvbmZpZ3VyYXRpb24sIGZyb21FdmVudDogYm9vbGVhbik6IHZvaWQge1xuXG5cdFx0Ly8gQXV0byBTYXZlXG5cdFx0dGhpcy5jdXJyZW50R2xvYmFsQXV0b1NhdmVDb25maWd1cmF0aW9uID0gdGhpcy5jb21wdXRlQXV0b1NhdmVDb25maWd1cmF0aW9uKHVuZGVmaW5lZCwgY29uZmlndXJhdGlvbi5maWxlcyk7XG5cdFx0dGhpcy5hdXRvU2F2ZUNvbmZpZ3VyYXRpb25DYWNoZS5jbGVhcigpO1xuXHRcdHRoaXMuYXV0b1NhdmVBZnRlclNob3J0RGVsYXlDb250ZXh0LnNldCh0aGlzLmdldEF1dG9TYXZlTW9kZSh1bmRlZmluZWQpLm1vZGUgPT09IEF1dG9TYXZlTW9kZS5BRlRFUl9TSE9SVF9ERUxBWSk7XG5cdFx0aWYgKGZyb21FdmVudCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBdXRvU2F2ZUNvbmZpZ3VyYXRpb24uZmlyZSgpO1xuXHRcdH1cblxuXHRcdC8vIENoZWNrIGZvciBjaGFuZ2UgaW4gZmlsZXMgYXNzb2NpYXRpb25zXG5cdFx0Y29uc3QgZmlsZXNBc3NvY2lhdGlvbiA9IGNvbmZpZ3VyYXRpb24/LmZpbGVzPy5hc3NvY2lhdGlvbnM7XG5cdFx0aWYgKCFlcXVhbHModGhpcy5jdXJyZW50RmlsZXNBc3NvY2lhdGlvbkNvbmZpZ3VyYXRpb24sIGZpbGVzQXNzb2NpYXRpb24pKSB7XG5cdFx0XHR0aGlzLmN1cnJlbnRGaWxlc0Fzc29jaWF0aW9uQ29uZmlndXJhdGlvbiA9IGZpbGVzQXNzb2NpYXRpb247XG5cdFx0XHRpZiAoZnJvbUV2ZW50KSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRmlsZXNBc3NvY2lhdGlvbi5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSG90IGV4aXRcblx0XHRjb25zdCBob3RFeGl0TW9kZSA9IGNvbmZpZ3VyYXRpb24/LmZpbGVzPy5ob3RFeGl0O1xuXHRcdGlmIChob3RFeGl0TW9kZSA9PT0gSG90RXhpdENvbmZpZ3VyYXRpb24uT0ZGIHx8IGhvdEV4aXRNb2RlID09PSBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UpIHtcblx0XHRcdHRoaXMuY3VycmVudEhvdEV4aXRDb25maWd1cmF0aW9uID0gaG90RXhpdE1vZGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuY3VycmVudEhvdEV4aXRDb25maWd1cmF0aW9uID0gSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVDtcblx0XHR9XG5cblx0XHQvLyBSZWFkb25seVxuXHRcdGNvbnN0IHJlYWRvbmx5RnJvbVBlcm1pc3Npb25zID0gQm9vbGVhbihjb25maWd1cmF0aW9uPy5maWxlcz8ucmVhZG9ubHlGcm9tUGVybWlzc2lvbnMpO1xuXHRcdGlmIChyZWFkb25seUZyb21QZXJtaXNzaW9ucyAhPT0gQm9vbGVhbih0aGlzLmNvbmZpZ3VyZWRSZWFkb25seUZyb21QZXJtaXNzaW9ucykpIHtcblx0XHRcdHRoaXMuY29uZmlndXJlZFJlYWRvbmx5RnJvbVBlcm1pc3Npb25zID0gcmVhZG9ubHlGcm9tUGVybWlzc2lvbnM7XG5cdFx0XHRpZiAoZnJvbUV2ZW50KSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlUmVhZG9ubHkuZmlyZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGdldEF1dG9TYXZlQ29uZmlndXJhdGlvbihyZXNvdXJjZU9yRWRpdG9yOiBFZGl0b3JJbnB1dCB8IFVSSSB8IHVuZGVmaW5lZCk6IElDYWNoZWRBdXRvU2F2ZUNvbmZpZ3VyYXRpb24ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdGhpcy50b1Jlc291cmNlKHJlc291cmNlT3JFZGl0b3IpO1xuXHRcdGlmIChyZXNvdXJjZSkge1xuXHRcdFx0bGV0IHJlc291cmNlQXV0b1NhdmVDb25maWd1cmF0aW9uID0gdGhpcy5hdXRvU2F2ZUNvbmZpZ3VyYXRpb25DYWNoZS5nZXQocmVzb3VyY2UpO1xuXHRcdFx0aWYgKCFyZXNvdXJjZUF1dG9TYXZlQ29uZmlndXJhdGlvbikge1xuXHRcdFx0XHRyZXNvdXJjZUF1dG9TYXZlQ29uZmlndXJhdGlvbiA9IHRoaXMuY29tcHV0ZUF1dG9TYXZlQ29uZmlndXJhdGlvbihyZXNvdXJjZSwgdGhpcy50ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRmlsZXNDb25maWd1cmF0aW9uTm9kZT4ocmVzb3VyY2UsICdmaWxlcycpKTtcblx0XHRcdFx0dGhpcy5hdXRvU2F2ZUNvbmZpZ3VyYXRpb25DYWNoZS5zZXQocmVzb3VyY2UsIHJlc291cmNlQXV0b1NhdmVDb25maWd1cmF0aW9uKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHJlc291cmNlQXV0b1NhdmVDb25maWd1cmF0aW9uO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmN1cnJlbnRHbG9iYWxBdXRvU2F2ZUNvbmZpZ3VyYXRpb247XG5cdH1cblxuXHRwcml2YXRlIGNvbXB1dGVBdXRvU2F2ZUNvbmZpZ3VyYXRpb24ocmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCwgZmlsZXNDb25maWd1cmF0aW9uOiBJRmlsZXNDb25maWd1cmF0aW9uTm9kZSB8IHVuZGVmaW5lZCk6IElDYWNoZWRBdXRvU2F2ZUNvbmZpZ3VyYXRpb24ge1xuXHRcdGxldCBhdXRvU2F2ZTogJ2FmdGVyRGVsYXknIHwgJ29uRm9jdXNDaGFuZ2UnIHwgJ29uV2luZG93Q2hhbmdlJyB8IHVuZGVmaW5lZDtcblx0XHRsZXQgYXV0b1NhdmVEZWxheTogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBhdXRvU2F2ZVdvcmtzcGFjZUZpbGVzT25seTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0XHRsZXQgYXV0b1NhdmVXaGVuTm9FcnJvcnM6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cblx0XHRsZXQgaXNPdXRPZldvcmtzcGFjZTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0XHRsZXQgaXNTaG9ydEF1dG9TYXZlRGVsYXk6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cblx0XHRzd2l0Y2ggKGZpbGVzQ29uZmlndXJhdGlvbj8uYXV0b1NhdmUgPz8gRmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5ERUZBVUxUX0FVVE9fU0FWRV9NT0RFKSB7XG5cdFx0XHRjYXNlIEF1dG9TYXZlQ29uZmlndXJhdGlvbi5BRlRFUl9ERUxBWToge1xuXHRcdFx0XHRhdXRvU2F2ZSA9ICdhZnRlckRlbGF5Jztcblx0XHRcdFx0YXV0b1NhdmVEZWxheSA9IHR5cGVvZiBmaWxlc0NvbmZpZ3VyYXRpb24/LmF1dG9TYXZlRGVsYXkgPT09ICdudW1iZXInICYmIGZpbGVzQ29uZmlndXJhdGlvbi5hdXRvU2F2ZURlbGF5ID49IDAgPyBmaWxlc0NvbmZpZ3VyYXRpb24uYXV0b1NhdmVEZWxheSA6IEZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuREVGQVVMVF9BVVRPX1NBVkVfREVMQVk7XG5cdFx0XHRcdGlzU2hvcnRBdXRvU2F2ZURlbGF5ID0gYXV0b1NhdmVEZWxheSA8PSBGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLkRFRkFVTFRfQVVUT19TQVZFX0RFTEFZO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0Y2FzZSBBdXRvU2F2ZUNvbmZpZ3VyYXRpb24uT05fRk9DVVNfQ0hBTkdFOlxuXHRcdFx0XHRhdXRvU2F2ZSA9ICdvbkZvY3VzQ2hhbmdlJztcblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgQXV0b1NhdmVDb25maWd1cmF0aW9uLk9OX1dJTkRPV19DSEFOR0U6XG5cdFx0XHRcdGF1dG9TYXZlID0gJ29uV2luZG93Q2hhbmdlJztcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0aWYgKGZpbGVzQ29uZmlndXJhdGlvbj8uYXV0b1NhdmVXb3Jrc3BhY2VGaWxlc09ubHkgPT09IHRydWUpIHtcblx0XHRcdGF1dG9TYXZlV29ya3NwYWNlRmlsZXNPbmx5ID0gdHJ1ZTtcblxuXHRcdFx0aWYgKHJlc291cmNlICYmICF0aGlzLmNvbnRleHRTZXJ2aWNlLmlzSW5zaWRlV29ya3NwYWNlKHJlc291cmNlKSkge1xuXHRcdFx0XHRpc091dE9mV29ya3NwYWNlID0gdHJ1ZTtcblx0XHRcdFx0aXNTaG9ydEF1dG9TYXZlRGVsYXkgPSB1bmRlZmluZWQ7IC8vIG91dCBvZiB3b3Jrc3BhY2UgZmlsZSBhcmUgbm90IGF1dG8gc2F2ZWQgd2l0aCB0aGlzIGNvbmZpZ3VyYXRpb25cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZmlsZXNDb25maWd1cmF0aW9uPy5hdXRvU2F2ZVdoZW5Ob0Vycm9ycyA9PT0gdHJ1ZSkge1xuXHRcdFx0YXV0b1NhdmVXaGVuTm9FcnJvcnMgPSB0cnVlO1xuXHRcdFx0aXNTaG9ydEF1dG9TYXZlRGVsYXkgPSB1bmRlZmluZWQ7IC8vIHRoaXMgY29uZmlndXJhdGlvbiBkaXNhYmxlcyBzaG9ydCBhdXRvIHNhdmUgZGVsYXlcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0YXV0b1NhdmUsXG5cdFx0XHRhdXRvU2F2ZURlbGF5LFxuXHRcdFx0YXV0b1NhdmVXb3Jrc3BhY2VGaWxlc09ubHksXG5cdFx0XHRhdXRvU2F2ZVdoZW5Ob0Vycm9ycyxcblx0XHRcdGlzT3V0T2ZXb3Jrc3BhY2UsXG5cdFx0XHRpc1Nob3J0QXV0b1NhdmVEZWxheVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHRvUmVzb3VyY2UocmVzb3VyY2VPckVkaXRvcjogRWRpdG9ySW5wdXQgfCBVUkkgfCB1bmRlZmluZWQpOiBVUkkgfCB1bmRlZmluZWQge1xuXHRcdGlmIChyZXNvdXJjZU9yRWRpdG9yIGluc3RhbmNlb2YgRWRpdG9ySW5wdXQpIHtcblx0XHRcdHJldHVybiBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKHJlc291cmNlT3JFZGl0b3IsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuUFJJTUFSWSB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzb3VyY2VPckVkaXRvcjtcblx0fVxuXG5cdGhhc1Nob3J0QXV0b1NhdmVEZWxheShyZXNvdXJjZU9yRWRpdG9yOiBFZGl0b3JJbnB1dCB8IFVSSSB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdGhpcy50b1Jlc291cmNlKHJlc291cmNlT3JFZGl0b3IpO1xuXG5cdFx0aWYgKHJlc291cmNlICYmIHRoaXMuYXV0b1NhdmVBZnRlclNob3J0RGVsYXlPdmVycmlkZXMuaGFzKHJlc291cmNlKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7IC8vIG92ZXJyaWRkZW4gdG8gYmUgZW5hYmxlZCBhZnRlciBzaG9ydCBkZWxheVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmdldEF1dG9TYXZlQ29uZmlndXJhdGlvbihyZXNvdXJjZSkuaXNTaG9ydEF1dG9TYXZlRGVsYXkpIHtcblx0XHRcdHJldHVybiAhcmVzb3VyY2UgfHwgIXRoaXMuYXV0b1NhdmVEaXNhYmxlZE92ZXJyaWRlcy5oYXMocmVzb3VyY2UpO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGdldEF1dG9TYXZlTW9kZShyZXNvdXJjZU9yRWRpdG9yOiBFZGl0b3JJbnB1dCB8IFVSSSB8IHVuZGVmaW5lZCwgc2F2ZVJlYXNvbj86IFNhdmVSZWFzb24pOiBJQXV0b1NhdmVNb2RlIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRoaXMudG9SZXNvdXJjZShyZXNvdXJjZU9yRWRpdG9yKTtcblx0XHRpZiAocmVzb3VyY2UgJiYgdGhpcy5hdXRvU2F2ZUFmdGVyU2hvcnREZWxheU92ZXJyaWRlcy5oYXMocmVzb3VyY2UpKSB7XG5cdFx0XHRyZXR1cm4geyBtb2RlOiBBdXRvU2F2ZU1vZGUuQUZURVJfU0hPUlRfREVMQVkgfTsgLy8gb3ZlcnJpZGRlbiB0byBiZSBlbmFibGVkIGFmdGVyIHNob3J0IGRlbGF5XG5cdFx0fVxuXG5cdFx0aWYgKHJlc291cmNlICYmIHRoaXMuYXV0b1NhdmVEaXNhYmxlZE92ZXJyaWRlcy5oYXMocmVzb3VyY2UpKSB7XG5cdFx0XHRyZXR1cm4geyBtb2RlOiBBdXRvU2F2ZU1vZGUuT0ZGLCByZWFzb246IEF1dG9TYXZlRGlzYWJsZWRSZWFzb24uRElTQUJMRUQgfTtcblx0XHR9XG5cblx0XHRjb25zdCBhdXRvU2F2ZUNvbmZpZ3VyYXRpb24gPSB0aGlzLmdldEF1dG9TYXZlQ29uZmlndXJhdGlvbihyZXNvdXJjZSk7XG5cdFx0aWYgKHR5cGVvZiBhdXRvU2F2ZUNvbmZpZ3VyYXRpb24uYXV0b1NhdmUgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4geyBtb2RlOiBBdXRvU2F2ZU1vZGUuT0ZGLCByZWFzb246IEF1dG9TYXZlRGlzYWJsZWRSZWFzb24uU0VUVElOR1MgfTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHNhdmVSZWFzb24gPT09ICdudW1iZXInKSB7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdChhdXRvU2F2ZUNvbmZpZ3VyYXRpb24uYXV0b1NhdmUgPT09ICdhZnRlckRlbGF5JyAmJiBzYXZlUmVhc29uICE9PSBTYXZlUmVhc29uLkFVVE8pIHx8XG5cdFx0XHRcdChhdXRvU2F2ZUNvbmZpZ3VyYXRpb24uYXV0b1NhdmUgPT09ICdvbkZvY3VzQ2hhbmdlJyAmJiBzYXZlUmVhc29uICE9PSBTYXZlUmVhc29uLkZPQ1VTX0NIQU5HRSAmJiBzYXZlUmVhc29uICE9PSBTYXZlUmVhc29uLldJTkRPV19DSEFOR0UpIHx8XG5cdFx0XHRcdChhdXRvU2F2ZUNvbmZpZ3VyYXRpb24uYXV0b1NhdmUgPT09ICdvbldpbmRvd0NoYW5nZScgJiYgc2F2ZVJlYXNvbiAhPT0gU2F2ZVJlYXNvbi5XSU5ET1dfQ0hBTkdFKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiB7IG1vZGU6IEF1dG9TYXZlTW9kZS5PRkYsIHJlYXNvbjogQXV0b1NhdmVEaXNhYmxlZFJlYXNvbi5TRVRUSU5HUyB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChyZXNvdXJjZSkge1xuXHRcdFx0aWYgKGF1dG9TYXZlQ29uZmlndXJhdGlvbi5hdXRvU2F2ZVdvcmtzcGFjZUZpbGVzT25seSAmJiBhdXRvU2F2ZUNvbmZpZ3VyYXRpb24uaXNPdXRPZldvcmtzcGFjZSkge1xuXHRcdFx0XHRyZXR1cm4geyBtb2RlOiBBdXRvU2F2ZU1vZGUuT0ZGLCByZWFzb246IEF1dG9TYXZlRGlzYWJsZWRSZWFzb24uT1VUX09GX1dPUktTUEFDRSB9O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYXV0b1NhdmVDb25maWd1cmF0aW9uLmF1dG9TYXZlV2hlbk5vRXJyb3JzICYmIHRoaXMubWFya2VyU2VydmljZS5yZWFkKHsgcmVzb3VyY2UsIHRha2U6IDEsIHNldmVyaXRpZXM6IE1hcmtlclNldmVyaXR5LkVycm9yIH0pLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0cmV0dXJuIHsgbW9kZTogQXV0b1NhdmVNb2RlLk9GRiwgcmVhc29uOiBBdXRvU2F2ZURpc2FibGVkUmVhc29uLkVSUk9SUyB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHN3aXRjaCAoYXV0b1NhdmVDb25maWd1cmF0aW9uLmF1dG9TYXZlKSB7XG5cdFx0XHRjYXNlICdhZnRlckRlbGF5Jzpcblx0XHRcdFx0aWYgKHR5cGVvZiBhdXRvU2F2ZUNvbmZpZ3VyYXRpb24uYXV0b1NhdmVEZWxheSA9PT0gJ251bWJlcicgJiYgYXV0b1NhdmVDb25maWd1cmF0aW9uLmF1dG9TYXZlRGVsYXkgPD0gRmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5ERUZBVUxUX0FVVE9fU0FWRV9ERUxBWSkge1xuXHRcdFx0XHRcdC8vIEV4cGxpY2l0bHkgbWFyayBhdXRvIHNhdmUgY29uZmlndXJhdGlvbnMgYXMgbG9uZyBydW5uaW5nXG5cdFx0XHRcdFx0Ly8gaWYgdGhleSBhcmUgY29uZmlndXJlZCB0byBub3QgcnVuIHdoZW4gdGhlcmUgYXJlIGVycm9ycy5cblx0XHRcdFx0XHQvLyBUaGUgcmF0aW9uYWxlIGhlcmUgaXMgdGhhdCBlcnJvcnMgbWF5IGNvbWUgaW4gYWZ0ZXIgYXV0b1xuXHRcdFx0XHRcdC8vIHNhdmUgaGFzIGJlZW4gc2NoZWR1bGVkIGFuZCB0aGVuIGZ1cnRoZXIgZGVsYXkgdGhlIGF1dG9cblx0XHRcdFx0XHQvLyBzYXZlIHVudGlsIHJlc29sdmVkLlxuXHRcdFx0XHRcdHJldHVybiB7IG1vZGU6IGF1dG9TYXZlQ29uZmlndXJhdGlvbi5hdXRvU2F2ZVdoZW5Ob0Vycm9ycyA/IEF1dG9TYXZlTW9kZS5BRlRFUl9MT05HX0RFTEFZIDogQXV0b1NhdmVNb2RlLkFGVEVSX1NIT1JUX0RFTEFZIH07XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHsgbW9kZTogQXV0b1NhdmVNb2RlLkFGVEVSX0xPTkdfREVMQVkgfTtcblx0XHRcdGNhc2UgJ29uRm9jdXNDaGFuZ2UnOlxuXHRcdFx0XHRyZXR1cm4geyBtb2RlOiBBdXRvU2F2ZU1vZGUuT05fRk9DVVNfQ0hBTkdFIH07XG5cdFx0XHRjYXNlICdvbldpbmRvd0NoYW5nZSc6XG5cdFx0XHRcdHJldHVybiB7IG1vZGU6IEF1dG9TYXZlTW9kZS5PTl9XSU5ET1dfQ0hBTkdFIH07XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgdG9nZ2xlQXV0b1NhdmUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY3VycmVudFNldHRpbmcgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdmaWxlcy5hdXRvU2F2ZScpO1xuXG5cdFx0bGV0IG5ld0F1dG9TYXZlVmFsdWU6IHN0cmluZztcblx0XHRpZiAoW0F1dG9TYXZlQ29uZmlndXJhdGlvbi5BRlRFUl9ERUxBWSwgQXV0b1NhdmVDb25maWd1cmF0aW9uLk9OX0ZPQ1VTX0NIQU5HRSwgQXV0b1NhdmVDb25maWd1cmF0aW9uLk9OX1dJTkRPV19DSEFOR0VdLnNvbWUoc2V0dGluZyA9PiBzZXR0aW5nID09PSBjdXJyZW50U2V0dGluZykpIHtcblx0XHRcdG5ld0F1dG9TYXZlVmFsdWUgPSBBdXRvU2F2ZUNvbmZpZ3VyYXRpb24uT0ZGO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRuZXdBdXRvU2F2ZVZhbHVlID0gQXV0b1NhdmVDb25maWd1cmF0aW9uLkFGVEVSX0RFTEFZO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKCdmaWxlcy5hdXRvU2F2ZScsIG5ld0F1dG9TYXZlVmFsdWUpO1xuXHR9XG5cblx0ZW5hYmxlQXV0b1NhdmVBZnRlclNob3J0RGVsYXkocmVzb3VyY2VPckVkaXRvcjogRWRpdG9ySW5wdXQgfCBVUkkpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0aGlzLnRvUmVzb3VyY2UocmVzb3VyY2VPckVkaXRvcik7XG5cdFx0aWYgKCFyZXNvdXJjZSkge1xuXHRcdFx0cmV0dXJuIERpc3Bvc2FibGUuTm9uZTtcblx0XHR9XG5cblx0XHRjb25zdCBjb3VudGVyID0gdGhpcy5hdXRvU2F2ZUFmdGVyU2hvcnREZWxheU92ZXJyaWRlcy5nZXQocmVzb3VyY2UpID8/IDA7XG5cdFx0dGhpcy5hdXRvU2F2ZUFmdGVyU2hvcnREZWxheU92ZXJyaWRlcy5zZXQocmVzb3VyY2UsIGNvdW50ZXIgKyAxKTtcblxuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0Y29uc3QgY291bnRlciA9IHRoaXMuYXV0b1NhdmVBZnRlclNob3J0RGVsYXlPdmVycmlkZXMuZ2V0KHJlc291cmNlKSA/PyAwO1xuXHRcdFx0aWYgKGNvdW50ZXIgPD0gMSkge1xuXHRcdFx0XHR0aGlzLmF1dG9TYXZlQWZ0ZXJTaG9ydERlbGF5T3ZlcnJpZGVzLmRlbGV0ZShyZXNvdXJjZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmF1dG9TYXZlQWZ0ZXJTaG9ydERlbGF5T3ZlcnJpZGVzLnNldChyZXNvdXJjZSwgY291bnRlciAtIDEpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0ZGlzYWJsZUF1dG9TYXZlKHJlc291cmNlT3JFZGl0b3I6IEVkaXRvcklucHV0IHwgVVJJKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdGhpcy50b1Jlc291cmNlKHJlc291cmNlT3JFZGl0b3IpO1xuXHRcdGlmICghcmVzb3VyY2UpIHtcblx0XHRcdHJldHVybiBEaXNwb3NhYmxlLk5vbmU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY291bnRlciA9IHRoaXMuYXV0b1NhdmVEaXNhYmxlZE92ZXJyaWRlcy5nZXQocmVzb3VyY2UpID8/IDA7XG5cdFx0dGhpcy5hdXRvU2F2ZURpc2FibGVkT3ZlcnJpZGVzLnNldChyZXNvdXJjZSwgY291bnRlciArIDEpO1xuXG5cdFx0aWYgKGNvdW50ZXIgPT09IDApIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQXV0b1NhdmVEaXNhYmxlZC5maXJlKHJlc291cmNlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGNvbnN0IGNvdW50ZXIgPSB0aGlzLmF1dG9TYXZlRGlzYWJsZWRPdmVycmlkZXMuZ2V0KHJlc291cmNlKSA/PyAwO1xuXHRcdFx0aWYgKGNvdW50ZXIgPD0gMSkge1xuXHRcdFx0XHR0aGlzLmF1dG9TYXZlRGlzYWJsZWRPdmVycmlkZXMuZGVsZXRlKHJlc291cmNlKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBdXRvU2F2ZURpc2FibGVkLmZpcmUocmVzb3VyY2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5hdXRvU2F2ZURpc2FibGVkT3ZlcnJpZGVzLnNldChyZXNvdXJjZSwgY291bnRlciAtIDEpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0Z2V0IGlzSG90RXhpdEVuYWJsZWQoKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkudHJhbnNpZW50KSB7XG5cdFx0XHQvLyBUcmFuc2llbnQgd29ya3NwYWNlOiBob3QgZXhpdCBpcyBkaXNhYmxlZCBiZWNhdXNlXG5cdFx0XHQvLyB0cmFuc2llbnQgd29ya3NwYWNlcyBhcmUgbm90IHJlc3RvcmVkIHVwb24gcmVzdGFydFxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmN1cnJlbnRIb3RFeGl0Q29uZmlndXJhdGlvbiAhPT0gSG90RXhpdENvbmZpZ3VyYXRpb24uT0ZGO1xuXHR9XG5cblx0Z2V0IGhvdEV4aXRDb25maWd1cmF0aW9uKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuY3VycmVudEhvdEV4aXRDb25maWd1cmF0aW9uO1xuXHR9XG5cblx0cHJldmVudFNhdmVDb25mbGljdHMocmVzb3VyY2U6IFVSSSwgbGFuZ3VhZ2U/OiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnZmlsZXMuc2F2ZUNvbmZsaWN0UmVzb2x1dGlvbicsIHsgcmVzb3VyY2UsIG92ZXJyaWRlSWRlbnRpZmllcjogbGFuZ3VhZ2UgfSkgIT09ICdvdmVyd3JpdGVGaWxlT25EaXNrJztcblx0fVxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSwgRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLG1CQUFtQix5QkFBeUI7QUFDckQsU0FBZ0IsZUFBZTtBQUMvQixT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V0FBTyxhQUFhLE1BQU07QUFDekIsWUFBTUEsV0FBVSxLQUFLLDBCQUEwQixJQUFJLFFBQVEsS0FBSztBQUNoRSxVQUFJQSxZQUFXLEdBQUc7QUFDakIsYUFBSywwQkFBMEIsT0FBTyxRQUFRO0FBQzlDLGFBQUssNkJBQTZCLEtBQUssUUFBUTtBQUFBLE1BQ2hELE9BQU87QUFDTixhQUFLLDBCQUEwQixJQUFJLFVBQVVBLFdBQVUsQ0FBQztBQUFBLE1BQ3pEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsSUFBSSxtQkFBNEI7QUFDL0IsUUFBSSxLQUFLLGVBQWUsYUFBYSxFQUFFLFdBQVc7QUFHakQsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPLEtBQUssZ0NBQWdDLHFCQUFxQjtBQUFBLEVBQ2xFO0FBQUEsRUFFQSxJQUFJLHVCQUErQjtBQUNsQyxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxxQkFBcUIsVUFBZSxVQUE0QjtBQUMvRCxXQUFPLEtBQUsscUJBQXFCLFNBQVMsZ0NBQWdDLEVBQUUsVUFBVSxvQkFBb0IsU0FBUyxDQUFDLE1BQU07QUFBQSxFQUMzSDtBQUNEO0FBcFphLDBCQUlZLHlCQUF5QixRQUFRLHNCQUFzQixjQUFjLHNCQUFzQjtBQUp2RywwQkFLWSwwQkFBMEI7QUFMdEMsMEJBT1ksb0JBQW9CO0FBQUEsRUFDM0Msa0JBQWtCLEVBQUUsT0FBTyxTQUFTLG9CQUFvQix1RUFBdUUsR0FBRyxXQUFXLEtBQUs7QUFBQSxFQUNsSixpQkFBaUIsRUFBRSxPQUFPLFNBQVMsRUFBRSxLQUFLLG1CQUFtQixTQUFTLENBQUMsdUdBQXVHLDJCQUEyQixFQUFFLEdBQUcsdUhBQXVILDBEQUEwRCxHQUFHLFdBQVcsS0FBSztBQUFBLEVBQ2xaLG9CQUFvQixFQUFFLE9BQU8sU0FBUyxFQUFFLEtBQUssc0JBQXNCLFNBQVMsQ0FBQyx1R0FBdUcsMkJBQTJCLEVBQUUsR0FBRywwSkFBMEosaUNBQWlDLG1CQUFtQixvQkFBb0IsQ0FBQyxJQUFJLDREQUE0RCxHQUFHLFdBQVcsS0FBSztBQUFBLEVBQzFnQixZQUFZLEVBQUUsT0FBTyxTQUFTLEVBQUUsS0FBSyxjQUFjLFNBQVMsQ0FBQyx1R0FBdUcsMkJBQTJCLEVBQUUsR0FBRyx1R0FBdUcsMERBQTBELEdBQUcsV0FBVyxLQUFLO0FBQUEsRUFDeFgsY0FBYyxFQUFFLE9BQU8sU0FBUyxnQkFBZ0Isb0RBQW9ELEdBQUcsV0FBVyxLQUFLO0FBQ3hIO0FBYlksNEJBQU47QUFBQSxFQTZDSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQXBEVTtBQXNaYixrQkFBa0IsNEJBQTRCLDJCQUEyQixrQkFBa0IsS0FBSzsiLAogICJuYW1lcyI6IFsiQXV0b1NhdmVNb2RlIiwgIkF1dG9TYXZlRGlzYWJsZWRSZWFzb24iLCAiY291bnRlciJdCn0K
