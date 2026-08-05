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
import { Event, Emitter } from "../../../../base/common/event.js";
import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { Disposable, DisposableMap } from "../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { OUTPUT_VIEW_ID, LOG_MIME, OUTPUT_MIME, Extensions, ACTIVE_OUTPUT_CHANNEL_CONTEXT, CONTEXT_ACTIVE_FILE_OUTPUT, CONTEXT_ACTIVE_OUTPUT_LEVEL_SETTABLE, CONTEXT_ACTIVE_OUTPUT_LEVEL, CONTEXT_ACTIVE_OUTPUT_LEVEL_IS_DEFAULT, SHOW_DEBUG_FILTER_CONTEXT, SHOW_ERROR_FILTER_CONTEXT, SHOW_INFO_FILTER_CONTEXT, SHOW_TRACE_FILTER_CONTEXT, SHOW_WARNING_FILTER_CONTEXT, CONTEXT_ACTIVE_LOG_FILE_OUTPUT, isSingleSourceOutputChannelDescriptor, HIDE_CATEGORY_FILTER_CONTEXT, isMultiSourceOutputChannelDescriptor } from "../../../services/output/common/output.js";
import { OutputLinkProvider } from "./outputLinkProvider.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { ILogService, ILoggerService, LogLevel, LogLevelToString } from "../../../../platform/log/common/log.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { DelegatedOutputChannelModel, FileOutputChannelModel, MultiFileOutputChannelModel } from "../common/outputChannelModel.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IDefaultLogLevelsService } from "../../logs/common/defaultLogLevels.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { localize } from "../../../../nls.js";
import { joinPath } from "../../../../base/common/resources.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { telemetryLogId } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { toLocalISOString } from "../../../../base/common/date.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
const OUTPUT_ACTIVE_CHANNEL_KEY = "output.activechannel";
let OutputChannel = class extends Disposable {
  constructor(outputChannelDescriptor, outputLocation, outputDirPromise, languageService, instantiationService) {
    super();
    this.outputChannelDescriptor = outputChannelDescriptor;
    this.outputLocation = outputLocation;
    this.outputDirPromise = outputDirPromise;
    this.languageService = languageService;
    this.instantiationService = instantiationService;
    this.scrollLock = false;
    this.id = outputChannelDescriptor.id;
    this.label = outputChannelDescriptor.label;
    this.uri = URI.from({ scheme: Schemas.outputChannel, path: this.id });
    this.model = this._register(this.createOutputChannelModel(this.uri, outputChannelDescriptor));
  }
  createOutputChannelModel(uri, outputChannelDescriptor) {
    const language = outputChannelDescriptor.languageId ? this.languageService.createById(outputChannelDescriptor.languageId) : this.languageService.createByMimeType(outputChannelDescriptor.log ? LOG_MIME : OUTPUT_MIME);
    if (isMultiSourceOutputChannelDescriptor(outputChannelDescriptor)) {
      return this.instantiationService.createInstance(MultiFileOutputChannelModel, uri, language, [...outputChannelDescriptor.source]);
    }
    if (isSingleSourceOutputChannelDescriptor(outputChannelDescriptor)) {
      return this.instantiationService.createInstance(FileOutputChannelModel, uri, language, outputChannelDescriptor.source);
    }
    return this.instantiationService.createInstance(DelegatedOutputChannelModel, this.id, uri, language, this.outputLocation, this.outputDirPromise);
  }
  getLogEntries() {
    return this.model.getLogEntries();
  }
  append(output) {
    this.model.append(output);
  }
  update(mode, till) {
    this.model.update(mode, till, true);
  }
  clear() {
    this.model.clear();
  }
  replace(value) {
    this.model.replace(value);
  }
};
OutputChannel = __decorateClass([
  __decorateParam(3, ILanguageService),
  __decorateParam(4, IInstantiationService)
], OutputChannel);
class OutputViewFilters extends Disposable {
  constructor(options, contextKeyService) {
    super();
    this.contextKeyService = contextKeyService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._filterText = "";
    this._trace = SHOW_TRACE_FILTER_CONTEXT.bindTo(this.contextKeyService);
    this._debug = SHOW_DEBUG_FILTER_CONTEXT.bindTo(this.contextKeyService);
    this._info = SHOW_INFO_FILTER_CONTEXT.bindTo(this.contextKeyService);
    this._warning = SHOW_WARNING_FILTER_CONTEXT.bindTo(this.contextKeyService);
    this._error = SHOW_ERROR_FILTER_CONTEXT.bindTo(this.contextKeyService);
    this._categories = HIDE_CATEGORY_FILTER_CONTEXT.bindTo(this.contextKeyService);
    this._trace.set(options.trace);
    this._debug.set(options.debug);
    this._info.set(options.info);
    this._warning.set(options.warning);
    this._error.set(options.error);
    this._categories.set(options.sources);
    this.filterHistory = options.filterHistory;
  }
  get text() {
    return this._filterText;
  }
  set text(filterText) {
    if (this._filterText !== filterText) {
      this._filterText = filterText;
      this._onDidChange.fire();
    }
  }
  get trace() {
    return !!this._trace.get();
  }
  set trace(trace) {
    if (this._trace.get() !== trace) {
      this._trace.set(trace);
      this._onDidChange.fire();
    }
  }
  get debug() {
    return !!this._debug.get();
  }
  set debug(debug) {
    if (this._debug.get() !== debug) {
      this._debug.set(debug);
      this._onDidChange.fire();
    }
  }
  get info() {
    return !!this._info.get();
  }
  set info(info) {
    if (this._info.get() !== info) {
      this._info.set(info);
      this._onDidChange.fire();
    }
  }
  get warning() {
    return !!this._warning.get();
  }
  set warning(warning) {
    if (this._warning.get() !== warning) {
      this._warning.set(warning);
      this._onDidChange.fire();
    }
  }
  get error() {
    return !!this._error.get();
  }
  set error(error) {
    if (this._error.get() !== error) {
      this._error.set(error);
      this._onDidChange.fire();
    }
  }
  get categories() {
    return this._categories.get() || ",";
  }
  set categories(categories) {
    this._categories.set(categories);
    this._onDidChange.fire();
  }
  toggleCategory(category) {
    const categories = this.categories;
    if (this.hasCategory(category)) {
      this.categories = categories.replace(`,${category},`, ",");
    } else {
      this.categories = `${categories}${category},`;
    }
  }
  hasCategory(category) {
    if (category === ",") {
      return false;
    }
    return this.categories.includes(`,${category},`);
  }
}
let OutputService = class extends Disposable {
  constructor(storageService, instantiationService, textModelService, logService, loggerService, lifecycleService, viewsService, contextKeyService, defaultLogLevelsService, fileDialogService, fileService, environmentService) {
    super();
    this.storageService = storageService;
    this.instantiationService = instantiationService;
    this.textModelService = textModelService;
    this.logService = logService;
    this.loggerService = loggerService;
    this.lifecycleService = lifecycleService;
    this.viewsService = viewsService;
    this.defaultLogLevelsService = defaultLogLevelsService;
    this.fileDialogService = fileDialogService;
    this.fileService = fileService;
    this.channels = this._register(new DisposableMap());
    this._onActiveOutputChannel = this._register(new Emitter());
    this.onActiveOutputChannel = this._onActiveOutputChannel.event;
    this.outputFolderCreationPromise = null;
    this.activeChannelIdInStorage = this.storageService.get(OUTPUT_ACTIVE_CHANNEL_KEY, StorageScope.WORKSPACE, "");
    this.activeOutputChannelContext = ACTIVE_OUTPUT_CHANNEL_CONTEXT.bindTo(contextKeyService);
    this.activeOutputChannelContext.set(this.activeChannelIdInStorage);
    this._register(this.onActiveOutputChannel((channel) => this.activeOutputChannelContext.set(channel)));
    this.activeFileOutputChannelContext = CONTEXT_ACTIVE_FILE_OUTPUT.bindTo(contextKeyService);
    this.activeLogOutputChannelContext = CONTEXT_ACTIVE_LOG_FILE_OUTPUT.bindTo(contextKeyService);
    this.activeOutputChannelLevelSettableContext = CONTEXT_ACTIVE_OUTPUT_LEVEL_SETTABLE.bindTo(contextKeyService);
    this.activeOutputChannelLevelContext = CONTEXT_ACTIVE_OUTPUT_LEVEL.bindTo(contextKeyService);
    this.activeOutputChannelLevelIsDefaultContext = CONTEXT_ACTIVE_OUTPUT_LEVEL_IS_DEFAULT.bindTo(contextKeyService);
    this.outputLocation = joinPath(environmentService.windowLogsPath, `output_${toLocalISOString(/* @__PURE__ */ new Date()).replace(/-|:|\.\d+Z$/g, "")}`);
    this._register(textModelService.registerTextModelContentProvider(Schemas.outputChannel, this));
    this._register(instantiationService.createInstance(OutputLinkProvider));
    const registry = Registry.as(Extensions.OutputChannels);
    for (const channelIdentifier of registry.getChannels()) {
      this.onDidRegisterChannel(channelIdentifier.id);
    }
    this._register(registry.onDidRegisterChannel((id) => this.onDidRegisterChannel(id)));
    this._register(registry.onDidUpdateChannelSources((channel) => this.onDidUpdateChannelSources(channel)));
    this._register(registry.onDidRemoveChannel((channel) => this.onDidRemoveChannel(channel)));
    if (!this.activeChannel) {
      const channels = this.getChannelDescriptors();
      this.setActiveChannel(channels && channels.length > 0 ? this.getChannel(channels[0].id) : void 0);
    }
    this._register(Event.filter(this.viewsService.onDidChangeViewVisibility, (e) => e.id === OUTPUT_VIEW_ID && e.visible)(() => {
      if (this.activeChannel) {
        this.viewsService.getActiveViewWithId(OUTPUT_VIEW_ID)?.showChannel(this.activeChannel, true);
      }
    }));
    this._register(this.loggerService.onDidChangeLogLevel(() => {
      this.resetLogLevelFilters();
      this.setLevelContext();
      this.setLevelIsDefaultContext();
    }));
    this._register(this.defaultLogLevelsService.onDidChangeDefaultLogLevels(() => {
      this.setLevelIsDefaultContext();
    }));
    this._register(this.lifecycleService.onDidShutdown(() => this.dispose()));
    this.filters = this._register(new OutputViewFilters({
      filterHistory: [],
      trace: true,
      debug: true,
      info: true,
      warning: true,
      error: true,
      sources: ""
    }, contextKeyService));
  }
  provideTextContent(resource) {
    const channel = this.getChannel(resource.path);
    if (channel) {
      return channel.model.loadModel();
    }
    return null;
  }
  async showChannel(id, preserveFocus) {
    const channel = this.getChannel(id);
    if (this.activeChannel?.id !== channel?.id) {
      this.setActiveChannel(channel);
      this._onActiveOutputChannel.fire(id);
    }
    const outputView = await this.viewsService.openView(OUTPUT_VIEW_ID, !preserveFocus);
    if (outputView && channel) {
      outputView.showChannel(channel, !!preserveFocus);
    }
  }
  getChannel(id) {
    return this.channels.get(id);
  }
  getChannelDescriptor(id) {
    return Registry.as(Extensions.OutputChannels).getChannel(id);
  }
  getChannelDescriptors() {
    return Registry.as(Extensions.OutputChannels).getChannels();
  }
  getActiveChannel() {
    return this.activeChannel;
  }
  canSetLogLevel(channel) {
    return channel.log && channel.id !== telemetryLogId;
  }
  getLogLevel(channel) {
    if (!channel.log) {
      return void 0;
    }
    const sources = isSingleSourceOutputChannelDescriptor(channel) ? [channel.source] : isMultiSourceOutputChannelDescriptor(channel) ? channel.source : [];
    if (sources.length === 0) {
      return void 0;
    }
    const logLevel = this.loggerService.getLogLevel();
    return sources.reduce((prev, curr) => Math.min(prev, this.loggerService.getLogLevel(curr.resource) ?? logLevel), LogLevel.Error);
  }
  setLogLevel(channel, logLevel) {
    if (!channel.log) {
      return;
    }
    const sources = isSingleSourceOutputChannelDescriptor(channel) ? [channel.source] : isMultiSourceOutputChannelDescriptor(channel) ? channel.source : [];
    if (sources.length === 0) {
      return;
    }
    for (const source of sources) {
      this.loggerService.setLogLevel(source.resource, logLevel);
    }
  }
  registerCompoundLogChannel(descriptors) {
    const outputChannelRegistry = Registry.as(Extensions.OutputChannels);
    descriptors.sort((a, b) => a.label.localeCompare(b.label));
    const id = descriptors.map((r) => r.id.toLowerCase()).join("-");
    if (!outputChannelRegistry.getChannel(id)) {
      outputChannelRegistry.registerChannel({
        id,
        label: descriptors.map((r) => r.label).join(", "),
        log: descriptors.some((r) => r.log),
        user: true,
        source: descriptors.map((descriptor) => {
          if (isSingleSourceOutputChannelDescriptor(descriptor)) {
            return [{ resource: descriptor.source.resource, name: descriptor.source.name ?? descriptor.label }];
          }
          if (isMultiSourceOutputChannelDescriptor(descriptor)) {
            return descriptor.source;
          }
          const channel = this.getChannel(descriptor.id);
          if (channel) {
            return channel.model.source;
          }
          return [];
        }).flat()
      });
    }
    return id;
  }
  async saveOutputAs(...channels) {
    let channel;
    if (channels.length > 1) {
      const compoundChannelId = this.registerCompoundLogChannel(channels);
      channel = this.getChannel(compoundChannelId);
    } else {
      channel = this.getChannel(channels[0].id);
    }
    if (!channel) {
      return;
    }
    try {
      const name = channels.length > 1 ? "output" : channels[0].label;
      const uri = await this.fileDialogService.showSaveDialog({
        title: localize("saveLog.dialogTitle", "Save Output As"),
        availableFileSystems: [Schemas.file],
        defaultUri: joinPath(await this.fileDialogService.defaultFilePath(), `${name}.log`),
        filters: [{
          name,
          extensions: ["log"]
        }]
      });
      if (!uri) {
        return;
      }
      const modelRef = await this.textModelService.createModelReference(channel.uri);
      try {
        await this.fileService.writeFile(uri, VSBuffer.fromString(modelRef.object.textEditorModel.getValue()));
      } finally {
        modelRef.dispose();
      }
      return;
    } finally {
      if (channels.length > 1) {
        Registry.as(Extensions.OutputChannels).removeChannel(channel.id);
      }
    }
  }
  async onDidRegisterChannel(channelId) {
    const channel = this.createChannel(channelId);
    this.channels.set(channelId, channel);
    if (!this.activeChannel || this.activeChannelIdInStorage === channelId) {
      this.setActiveChannel(channel);
      this._onActiveOutputChannel.fire(channelId);
      const outputView = this.viewsService.getActiveViewWithId(OUTPUT_VIEW_ID);
      outputView?.showChannel(channel, true);
    }
  }
  onDidUpdateChannelSources(channel) {
    const outputChannel = this.channels.get(channel.id);
    if (outputChannel) {
      outputChannel.model.updateChannelSources(channel.source);
    }
  }
  onDidRemoveChannel(channel) {
    if (this.activeChannel?.id === channel.id) {
      const channels = this.getChannelDescriptors();
      if (channels[0]) {
        this.showChannel(channels[0].id);
      }
    }
    this.channels.deleteAndDispose(channel.id);
  }
  createChannel(id) {
    const channel = this.instantiateChannel(id);
    this._register(Event.once(channel.model.onDispose)(() => {
      if (this.activeChannel === channel) {
        const channels = this.getChannelDescriptors();
        const channel2 = channels.length ? this.getChannel(channels[0].id) : void 0;
        if (channel2 && this.viewsService.isViewVisible(OUTPUT_VIEW_ID)) {
          this.showChannel(channel2.id);
        } else {
          this.setActiveChannel(void 0);
        }
      }
      Registry.as(Extensions.OutputChannels).removeChannel(id);
    }));
    return channel;
  }
  instantiateChannel(id) {
    const channelData = Registry.as(Extensions.OutputChannels).getChannel(id);
    if (!channelData) {
      this.logService.error(`Channel '${id}' is not registered yet`);
      throw new Error(`Channel '${id}' is not registered yet`);
    }
    if (!this.outputFolderCreationPromise) {
      this.outputFolderCreationPromise = this.fileService.createFolder(this.outputLocation).then(() => void 0);
    }
    return this.instantiationService.createInstance(OutputChannel, channelData, this.outputLocation, this.outputFolderCreationPromise);
  }
  resetLogLevelFilters() {
    const descriptor = this.activeChannel?.outputChannelDescriptor;
    const channelLogLevel = descriptor ? this.getLogLevel(descriptor) : void 0;
    if (channelLogLevel !== void 0) {
      this.filters.error = channelLogLevel <= LogLevel.Error;
      this.filters.warning = channelLogLevel <= LogLevel.Warning;
      this.filters.info = channelLogLevel <= LogLevel.Info;
      this.filters.debug = channelLogLevel <= LogLevel.Debug;
      this.filters.trace = channelLogLevel <= LogLevel.Trace;
    }
  }
  setLevelContext() {
    const descriptor = this.activeChannel?.outputChannelDescriptor;
    const channelLogLevel = descriptor ? this.getLogLevel(descriptor) : void 0;
    this.activeOutputChannelLevelContext.set(channelLogLevel !== void 0 ? LogLevelToString(channelLogLevel) : "");
  }
  async setLevelIsDefaultContext() {
    const descriptor = this.activeChannel?.outputChannelDescriptor;
    const channelLogLevel = descriptor ? this.getLogLevel(descriptor) : void 0;
    if (channelLogLevel !== void 0) {
      const channelDefaultLogLevel = await this.defaultLogLevelsService.getDefaultLogLevel(descriptor?.extensionId);
      this.activeOutputChannelLevelIsDefaultContext.set(channelDefaultLogLevel === channelLogLevel);
    } else {
      this.activeOutputChannelLevelIsDefaultContext.set(false);
    }
  }
  setActiveChannel(channel) {
    this.activeChannel = channel;
    const descriptor = channel?.outputChannelDescriptor;
    this.activeFileOutputChannelContext.set(!!descriptor && isSingleSourceOutputChannelDescriptor(descriptor));
    this.activeLogOutputChannelContext.set(!!descriptor?.log);
    this.activeOutputChannelLevelSettableContext.set(descriptor !== void 0 && this.canSetLogLevel(descriptor));
    this.setLevelIsDefaultContext();
    this.setLevelContext();
    if (this.activeChannel) {
      this.storageService.store(OUTPUT_ACTIVE_CHANNEL_KEY, this.activeChannel.id, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(OUTPUT_ACTIVE_CHANNEL_KEY, StorageScope.WORKSPACE);
    }
  }
};
OutputService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, ILogService),
  __decorateParam(4, ILoggerService),
  __decorateParam(5, ILifecycleService),
  __decorateParam(6, IViewsService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IDefaultLogLevelsService),
  __decorateParam(9, IFileDialogService),
  __decorateParam(10, IFileService),
  __decorateParam(11, IWorkbenchEnvironmentService)
], OutputService);
export {
  OutputService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9vdXRwdXQvYnJvd3Nlci9vdXRwdXRTZXJ2aWNlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSU91dHB1dENoYW5uZWwsIElPdXRwdXRTZXJ2aWNlLCBPVVRQVVRfVklFV19JRCwgTE9HX01JTUUsIE9VVFBVVF9NSU1FLCBPdXRwdXRDaGFubmVsVXBkYXRlTW9kZSwgSU91dHB1dENoYW5uZWxEZXNjcmlwdG9yLCBFeHRlbnNpb25zLCBJT3V0cHV0Q2hhbm5lbFJlZ2lzdHJ5LCBBQ1RJVkVfT1VUUFVUX0NIQU5ORUxfQ09OVEVYVCwgQ09OVEVYVF9BQ1RJVkVfRklMRV9PVVRQVVQsIENPTlRFWFRfQUNUSVZFX09VVFBVVF9MRVZFTF9TRVRUQUJMRSwgQ09OVEVYVF9BQ1RJVkVfT1VUUFVUX0xFVkVMLCBDT05URVhUX0FDVElWRV9PVVRQVVRfTEVWRUxfSVNfREVGQVVMVCwgSU91dHB1dFZpZXdGaWx0ZXJzLCBTSE9XX0RFQlVHX0ZJTFRFUl9DT05URVhULCBTSE9XX0VSUk9SX0ZJTFRFUl9DT05URVhULCBTSE9XX0lORk9fRklMVEVSX0NPTlRFWFQsIFNIT1dfVFJBQ0VfRklMVEVSX0NPTlRFWFQsIFNIT1dfV0FSTklOR19GSUxURVJfQ09OVEVYVCwgQ09OVEVYVF9BQ1RJVkVfTE9HX0ZJTEVfT1VUUFVULCBJTXVsdGlTb3VyY2VPdXRwdXRDaGFubmVsRGVzY3JpcHRvciwgaXNTaW5nbGVTb3VyY2VPdXRwdXRDaGFubmVsRGVzY3JpcHRvciwgSElERV9DQVRFR09SWV9GSUxURVJfQ09OVEVYVCwgaXNNdWx0aVNvdXJjZU91dHB1dENoYW5uZWxEZXNjcmlwdG9yLCBJTG9nRW50cnkgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9vdXRwdXQvY29tbW9uL291dHB1dC5qcyc7XG5pbXBvcnQgeyBPdXRwdXRMaW5rUHJvdmlkZXIgfSBmcm9tICcuL291dHB1dExpbmtQcm92aWRlci5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsU2VydmljZSwgSVRleHRNb2RlbENvbnRlbnRQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlLCBJTG9nZ2VyU2VydmljZSwgTG9nTGV2ZWwsIExvZ0xldmVsVG9TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IERlbGVnYXRlZE91dHB1dENoYW5uZWxNb2RlbCwgRmlsZU91dHB1dENoYW5uZWxNb2RlbCwgSU91dHB1dENoYW5uZWxNb2RlbCwgTXVsdGlGaWxlT3V0cHV0Q2hhbm5lbE1vZGVsIH0gZnJvbSAnLi4vY29tbW9uL291dHB1dENoYW5uZWxNb2RlbC5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBPdXRwdXRWaWV3UGFuZSB9IGZyb20gJy4vb3V0cHV0Vmlldy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSURlZmF1bHRMb2dMZXZlbHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9ncy9jb21tb24vZGVmYXVsdExvZ0xldmVscy5qcyc7XG5pbXBvcnQgeyBJRmlsZURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyB0ZWxlbWV0cnlMb2dJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5VXRpbHMuanMnO1xuaW1wb3J0IHsgdG9Mb2NhbElTT1N0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RhdGUuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuXG5jb25zdCBPVVRQVVRfQUNUSVZFX0NIQU5ORUxfS0VZID0gJ291dHB1dC5hY3RpdmVjaGFubmVsJztcblxuY2xhc3MgT3V0cHV0Q2hhbm5lbCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJT3V0cHV0Q2hhbm5lbCB7XG5cblx0c2Nyb2xsTG9jazogYm9vbGVhbiA9IGZhbHNlO1xuXHRyZWFkb25seSBtb2RlbDogSU91dHB1dENoYW5uZWxNb2RlbDtcblx0cmVhZG9ubHkgaWQ6IHN0cmluZztcblx0cmVhZG9ubHkgbGFiZWw6IHN0cmluZztcblx0cmVhZG9ubHkgdXJpOiBVUkk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgb3V0cHV0Q2hhbm5lbERlc2NyaXB0b3I6IElPdXRwdXRDaGFubmVsRGVzY3JpcHRvcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IG91dHB1dExvY2F0aW9uOiBVUkksXG5cdFx0cHJpdmF0ZSByZWFkb25seSBvdXRwdXREaXJQcm9taXNlOiBQcm9taXNlPHZvaWQ+LFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuaWQgPSBvdXRwdXRDaGFubmVsRGVzY3JpcHRvci5pZDtcblx0XHR0aGlzLmxhYmVsID0gb3V0cHV0Q2hhbm5lbERlc2NyaXB0b3IubGFiZWw7XG5cdFx0dGhpcy51cmkgPSBVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5vdXRwdXRDaGFubmVsLCBwYXRoOiB0aGlzLmlkIH0pO1xuXHRcdHRoaXMubW9kZWwgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmNyZWF0ZU91dHB1dENoYW5uZWxNb2RlbCh0aGlzLnVyaSwgb3V0cHV0Q2hhbm5lbERlc2NyaXB0b3IpKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlT3V0cHV0Q2hhbm5lbE1vZGVsKHVyaTogVVJJLCBvdXRwdXRDaGFubmVsRGVzY3JpcHRvcjogSU91dHB1dENoYW5uZWxEZXNjcmlwdG9yKTogSU91dHB1dENoYW5uZWxNb2RlbCB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2UgPSBvdXRwdXRDaGFubmVsRGVzY3JpcHRvci5sYW5ndWFnZUlkID8gdGhpcy5sYW5ndWFnZVNlcnZpY2UuY3JlYXRlQnlJZChvdXRwdXRDaGFubmVsRGVzY3JpcHRvci5sYW5ndWFnZUlkKSA6IHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5TWltZVR5cGUob3V0cHV0Q2hhbm5lbERlc2NyaXB0b3IubG9nID8gTE9HX01JTUUgOiBPVVRQVVRfTUlNRSk7XG5cdFx0aWYgKGlzTXVsdGlTb3VyY2VPdXRwdXRDaGFubmVsRGVzY3JpcHRvcihvdXRwdXRDaGFubmVsRGVzY3JpcHRvcikpIHtcblx0XHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE11bHRpRmlsZU91dHB1dENoYW5uZWxNb2RlbCwgdXJpLCBsYW5ndWFnZSwgWy4uLm91dHB1dENoYW5uZWxEZXNjcmlwdG9yLnNvdXJjZV0pO1xuXHRcdH1cblx0XHRpZiAoaXNTaW5nbGVTb3VyY2VPdXRwdXRDaGFubmVsRGVzY3JpcHRvcihvdXRwdXRDaGFubmVsRGVzY3JpcHRvcikpIHtcblx0XHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEZpbGVPdXRwdXRDaGFubmVsTW9kZWwsIHVyaSwgbGFuZ3VhZ2UsIG91dHB1dENoYW5uZWxEZXNjcmlwdG9yLnNvdXJjZSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERlbGVnYXRlZE91dHB1dENoYW5uZWxNb2RlbCwgdGhpcy5pZCwgdXJpLCBsYW5ndWFnZSwgdGhpcy5vdXRwdXRMb2NhdGlvbiwgdGhpcy5vdXRwdXREaXJQcm9taXNlKTtcblx0fVxuXG5cdGdldExvZ0VudHJpZXMoKTogUmVhZG9ubHlBcnJheTxJTG9nRW50cnk+IHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXRMb2dFbnRyaWVzKCk7XG5cdH1cblxuXHRhcHBlbmQob3V0cHV0OiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLm1vZGVsLmFwcGVuZChvdXRwdXQpO1xuXHR9XG5cblx0dXBkYXRlKG1vZGU6IE91dHB1dENoYW5uZWxVcGRhdGVNb2RlLCB0aWxsPzogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5tb2RlbC51cGRhdGUobW9kZSwgdGlsbCwgdHJ1ZSk7XG5cdH1cblxuXHRjbGVhcigpOiB2b2lkIHtcblx0XHR0aGlzLm1vZGVsLmNsZWFyKCk7XG5cdH1cblxuXHRyZXBsYWNlKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLm1vZGVsLnJlcGxhY2UodmFsdWUpO1xuXHR9XG59XG5cbmludGVyZmFjZSBJT3V0cHV0RmlsdGVyT3B0aW9ucyB7XG5cdGZpbHRlckhpc3Rvcnk6IHN0cmluZ1tdO1xuXHR0cmFjZTogYm9vbGVhbjtcblx0ZGVidWc6IGJvb2xlYW47XG5cdGluZm86IGJvb2xlYW47XG5cdHdhcm5pbmc6IGJvb2xlYW47XG5cdGVycm9yOiBib29sZWFuO1xuXHRzb3VyY2VzOiBzdHJpbmc7XG59XG5cbmNsYXNzIE91dHB1dFZpZXdGaWx0ZXJzIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElPdXRwdXRWaWV3RmlsdGVycyB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2UgPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRvcHRpb25zOiBJT3V0cHV0RmlsdGVyT3B0aW9ucyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3RyYWNlLnNldChvcHRpb25zLnRyYWNlKTtcblx0XHR0aGlzLl9kZWJ1Zy5zZXQob3B0aW9ucy5kZWJ1Zyk7XG5cdFx0dGhpcy5faW5mby5zZXQob3B0aW9ucy5pbmZvKTtcblx0XHR0aGlzLl93YXJuaW5nLnNldChvcHRpb25zLndhcm5pbmcpO1xuXHRcdHRoaXMuX2Vycm9yLnNldChvcHRpb25zLmVycm9yKTtcblx0XHR0aGlzLl9jYXRlZ29yaWVzLnNldChvcHRpb25zLnNvdXJjZXMpO1xuXG5cdFx0dGhpcy5maWx0ZXJIaXN0b3J5ID0gb3B0aW9ucy5maWx0ZXJIaXN0b3J5O1xuXHR9XG5cblx0ZmlsdGVySGlzdG9yeTogc3RyaW5nW107XG5cblx0cHJpdmF0ZSBfZmlsdGVyVGV4dCA9ICcnO1xuXHRnZXQgdGV4dCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9maWx0ZXJUZXh0O1xuXHR9XG5cdHNldCB0ZXh0KGZpbHRlclRleHQ6IHN0cmluZykge1xuXHRcdGlmICh0aGlzLl9maWx0ZXJUZXh0ICE9PSBmaWx0ZXJUZXh0KSB7XG5cdFx0XHR0aGlzLl9maWx0ZXJUZXh0ID0gZmlsdGVyVGV4dDtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF90cmFjZSA9IFNIT1dfVFJBQ0VfRklMVEVSX0NPTlRFWFQuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRnZXQgdHJhY2UoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5fdHJhY2UuZ2V0KCk7XG5cdH1cblx0c2V0IHRyYWNlKHRyYWNlOiBib29sZWFuKSB7XG5cdFx0aWYgKHRoaXMuX3RyYWNlLmdldCgpICE9PSB0cmFjZSkge1xuXHRcdFx0dGhpcy5fdHJhY2Uuc2V0KHRyYWNlKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWJ1ZyA9IFNIT1dfREVCVUdfRklMVEVSX0NPTlRFWFQuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRnZXQgZGVidWcoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5fZGVidWcuZ2V0KCk7XG5cdH1cblx0c2V0IGRlYnVnKGRlYnVnOiBib29sZWFuKSB7XG5cdFx0aWYgKHRoaXMuX2RlYnVnLmdldCgpICE9PSBkZWJ1Zykge1xuXHRcdFx0dGhpcy5fZGVidWcuc2V0KGRlYnVnKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9pbmZvID0gU0hPV19JTkZPX0ZJTFRFUl9DT05URVhULmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0Z2V0IGluZm8oKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5faW5mby5nZXQoKTtcblx0fVxuXHRzZXQgaW5mbyhpbmZvOiBib29sZWFuKSB7XG5cdFx0aWYgKHRoaXMuX2luZm8uZ2V0KCkgIT09IGluZm8pIHtcblx0XHRcdHRoaXMuX2luZm8uc2V0KGluZm8pO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3dhcm5pbmcgPSBTSE9XX1dBUk5JTkdfRklMVEVSX0NPTlRFWFQuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRnZXQgd2FybmluZygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLl93YXJuaW5nLmdldCgpO1xuXHR9XG5cdHNldCB3YXJuaW5nKHdhcm5pbmc6IGJvb2xlYW4pIHtcblx0XHRpZiAodGhpcy5fd2FybmluZy5nZXQoKSAhPT0gd2FybmluZykge1xuXHRcdFx0dGhpcy5fd2FybmluZy5zZXQod2FybmluZyk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZXJyb3IgPSBTSE9XX0VSUk9SX0ZJTFRFUl9DT05URVhULmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0Z2V0IGVycm9yKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuX2Vycm9yLmdldCgpO1xuXHR9XG5cdHNldCBlcnJvcihlcnJvcjogYm9vbGVhbikge1xuXHRcdGlmICh0aGlzLl9lcnJvci5nZXQoKSAhPT0gZXJyb3IpIHtcblx0XHRcdHRoaXMuX2Vycm9yLnNldChlcnJvcik7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY2F0ZWdvcmllcyA9IEhJREVfQ0FURUdPUllfRklMVEVSX0NPTlRFWFQuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRnZXQgY2F0ZWdvcmllcygpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9jYXRlZ29yaWVzLmdldCgpIHx8ICcsJztcblx0fVxuXHRzZXQgY2F0ZWdvcmllcyhjYXRlZ29yaWVzOiBzdHJpbmcpIHtcblx0XHR0aGlzLl9jYXRlZ29yaWVzLnNldChjYXRlZ29yaWVzKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdH1cblxuXHR0b2dnbGVDYXRlZ29yeShjYXRlZ29yeTogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgY2F0ZWdvcmllcyA9IHRoaXMuY2F0ZWdvcmllcztcblx0XHRpZiAodGhpcy5oYXNDYXRlZ29yeShjYXRlZ29yeSkpIHtcblx0XHRcdHRoaXMuY2F0ZWdvcmllcyA9IGNhdGVnb3JpZXMucmVwbGFjZShgLCR7Y2F0ZWdvcnl9LGAsICcsJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuY2F0ZWdvcmllcyA9IGAke2NhdGVnb3JpZXN9JHtjYXRlZ29yeX0sYDtcblx0XHR9XG5cdH1cblxuXHRoYXNDYXRlZ29yeShjYXRlZ29yeTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0aWYgKGNhdGVnb3J5ID09PSAnLCcpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuY2F0ZWdvcmllcy5pbmNsdWRlcyhgLCR7Y2F0ZWdvcnl9LGApO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBPdXRwdXRTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElPdXRwdXRTZXJ2aWNlLCBJVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGNoYW5uZWxzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVNYXA8c3RyaW5nLCBPdXRwdXRDaGFubmVsPigpKTtcblx0cHJpdmF0ZSBhY3RpdmVDaGFubmVsSWRJblN0b3JhZ2U6IHN0cmluZztcblx0cHJpdmF0ZSBhY3RpdmVDaGFubmVsPzogT3V0cHV0Q2hhbm5lbDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkFjdGl2ZU91dHB1dENoYW5uZWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxzdHJpbmc+KCkpO1xuXHRyZWFkb25seSBvbkFjdGl2ZU91dHB1dENoYW5uZWw6IEV2ZW50PHN0cmluZz4gPSB0aGlzLl9vbkFjdGl2ZU91dHB1dENoYW5uZWwuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBhY3RpdmVPdXRwdXRDaGFubmVsQ29udGV4dDogSUNvbnRleHRLZXk8c3RyaW5nPjtcblx0cHJpdmF0ZSByZWFkb25seSBhY3RpdmVGaWxlT3V0cHV0Q2hhbm5lbENvbnRleHQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGFjdGl2ZUxvZ091dHB1dENoYW5uZWxDb250ZXh0OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBhY3RpdmVPdXRwdXRDaGFubmVsTGV2ZWxTZXR0YWJsZUNvbnRleHQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGFjdGl2ZU91dHB1dENoYW5uZWxMZXZlbENvbnRleHQ6IElDb250ZXh0S2V5PHN0cmluZz47XG5cdHByaXZhdGUgcmVhZG9ubHkgYWN0aXZlT3V0cHV0Q2hhbm5lbExldmVsSXNEZWZhdWx0Q29udGV4dDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0cHJpdmF0ZSByZWFkb25seSBvdXRwdXRMb2NhdGlvbjogVVJJO1xuXG5cdHJlYWRvbmx5IGZpbHRlcnM6IE91dHB1dFZpZXdGaWx0ZXJzO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJTG9nZ2VyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ2dlclNlcnZpY2U6IElMb2dnZXJTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJVmlld3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdmlld3NTZXJ2aWNlOiBJVmlld3NTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASURlZmF1bHRMb2dMZXZlbHNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGVmYXVsdExvZ0xldmVsc1NlcnZpY2U6IElEZWZhdWx0TG9nTGV2ZWxzU2VydmljZSxcblx0XHRASUZpbGVEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZURpYWxvZ1NlcnZpY2U6IElGaWxlRGlhbG9nU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmFjdGl2ZUNoYW5uZWxJZEluU3RvcmFnZSA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KE9VVFBVVF9BQ1RJVkVfQ0hBTk5FTF9LRVksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsICcnKTtcblx0XHR0aGlzLmFjdGl2ZU91dHB1dENoYW5uZWxDb250ZXh0ID0gQUNUSVZFX09VVFBVVF9DSEFOTkVMX0NPTlRFWFQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmFjdGl2ZU91dHB1dENoYW5uZWxDb250ZXh0LnNldCh0aGlzLmFjdGl2ZUNoYW5uZWxJZEluU3RvcmFnZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkFjdGl2ZU91dHB1dENoYW5uZWwoY2hhbm5lbCA9PiB0aGlzLmFjdGl2ZU91dHB1dENoYW5uZWxDb250ZXh0LnNldChjaGFubmVsKSkpO1xuXG5cdFx0dGhpcy5hY3RpdmVGaWxlT3V0cHV0Q2hhbm5lbENvbnRleHQgPSBDT05URVhUX0FDVElWRV9GSUxFX09VVFBVVC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuYWN0aXZlTG9nT3V0cHV0Q2hhbm5lbENvbnRleHQgPSBDT05URVhUX0FDVElWRV9MT0dfRklMRV9PVVRQVVQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmFjdGl2ZU91dHB1dENoYW5uZWxMZXZlbFNldHRhYmxlQ29udGV4dCA9IENPTlRFWFRfQUNUSVZFX09VVFBVVF9MRVZFTF9TRVRUQUJMRS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuYWN0aXZlT3V0cHV0Q2hhbm5lbExldmVsQ29udGV4dCA9IENPTlRFWFRfQUNUSVZFX09VVFBVVF9MRVZFTC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuYWN0aXZlT3V0cHV0Q2hhbm5lbExldmVsSXNEZWZhdWx0Q29udGV4dCA9IENPTlRFWFRfQUNUSVZFX09VVFBVVF9MRVZFTF9JU19ERUZBVUxULmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLm91dHB1dExvY2F0aW9uID0gam9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLndpbmRvd0xvZ3NQYXRoLCBgb3V0cHV0XyR7dG9Mb2NhbElTT1N0cmluZyhuZXcgRGF0ZSgpKS5yZXBsYWNlKC8tfDp8XFwuXFxkK1okL2csICcnKX1gKTtcblxuXHRcdC8vIFJlZ2lzdGVyIGFzIHRleHQgbW9kZWwgY29udGVudCBwcm92aWRlciBmb3Igb3V0cHV0XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGV4dE1vZGVsU2VydmljZS5yZWdpc3RlclRleHRNb2RlbENvbnRlbnRQcm92aWRlcihTY2hlbWFzLm91dHB1dENoYW5uZWwsIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShPdXRwdXRMaW5rUHJvdmlkZXIpKTtcblxuXHRcdC8vIENyZWF0ZSBvdXRwdXQgY2hhbm5lbHMgZm9yIGFscmVhZHkgcmVnaXN0ZXJlZCBjaGFubmVsc1xuXHRcdGNvbnN0IHJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SU91dHB1dENoYW5uZWxSZWdpc3RyeT4oRXh0ZW5zaW9ucy5PdXRwdXRDaGFubmVscyk7XG5cdFx0Zm9yIChjb25zdCBjaGFubmVsSWRlbnRpZmllciBvZiByZWdpc3RyeS5nZXRDaGFubmVscygpKSB7XG5cdFx0XHR0aGlzLm9uRGlkUmVnaXN0ZXJDaGFubmVsKGNoYW5uZWxJZGVudGlmaWVyLmlkKTtcblx0XHR9XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0cnkub25EaWRSZWdpc3RlckNoYW5uZWwoaWQgPT4gdGhpcy5vbkRpZFJlZ2lzdGVyQ2hhbm5lbChpZCkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RyeS5vbkRpZFVwZGF0ZUNoYW5uZWxTb3VyY2VzKGNoYW5uZWwgPT4gdGhpcy5vbkRpZFVwZGF0ZUNoYW5uZWxTb3VyY2VzKGNoYW5uZWwpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0cnkub25EaWRSZW1vdmVDaGFubmVsKGNoYW5uZWwgPT4gdGhpcy5vbkRpZFJlbW92ZUNoYW5uZWwoY2hhbm5lbCkpKTtcblxuXHRcdC8vIFNldCBhY3RpdmUgY2hhbm5lbCB0byBmaXJzdCBjaGFubmVsIGlmIG5vdCBzZXRcblx0XHRpZiAoIXRoaXMuYWN0aXZlQ2hhbm5lbCkge1xuXHRcdFx0Y29uc3QgY2hhbm5lbHMgPSB0aGlzLmdldENoYW5uZWxEZXNjcmlwdG9ycygpO1xuXHRcdFx0dGhpcy5zZXRBY3RpdmVDaGFubmVsKGNoYW5uZWxzICYmIGNoYW5uZWxzLmxlbmd0aCA+IDAgPyB0aGlzLmdldENoYW5uZWwoY2hhbm5lbHNbMF0uaWQpIDogdW5kZWZpbmVkKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5maWx0ZXIodGhpcy52aWV3c1NlcnZpY2Uub25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eSwgZSA9PiBlLmlkID09PSBPVVRQVVRfVklFV19JRCAmJiBlLnZpc2libGUpKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmFjdGl2ZUNoYW5uZWwpIHtcblx0XHRcdFx0dGhpcy52aWV3c1NlcnZpY2UuZ2V0QWN0aXZlVmlld1dpdGhJZDxPdXRwdXRWaWV3UGFuZT4oT1VUUFVUX1ZJRVdfSUQpPy5zaG93Q2hhbm5lbCh0aGlzLmFjdGl2ZUNoYW5uZWwsIHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubG9nZ2VyU2VydmljZS5vbkRpZENoYW5nZUxvZ0xldmVsKCgpID0+IHtcblx0XHRcdHRoaXMucmVzZXRMb2dMZXZlbEZpbHRlcnMoKTtcblx0XHRcdHRoaXMuc2V0TGV2ZWxDb250ZXh0KCk7XG5cdFx0XHR0aGlzLnNldExldmVsSXNEZWZhdWx0Q29udGV4dCgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmRlZmF1bHRMb2dMZXZlbHNTZXJ2aWNlLm9uRGlkQ2hhbmdlRGVmYXVsdExvZ0xldmVscygoKSA9PiB7XG5cdFx0XHR0aGlzLnNldExldmVsSXNEZWZhdWx0Q29udGV4dCgpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGlmZWN5Y2xlU2VydmljZS5vbkRpZFNodXRkb3duKCgpID0+IHRoaXMuZGlzcG9zZSgpKSk7XG5cblx0XHR0aGlzLmZpbHRlcnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgT3V0cHV0Vmlld0ZpbHRlcnMoe1xuXHRcdFx0ZmlsdGVySGlzdG9yeTogW10sXG5cdFx0XHR0cmFjZTogdHJ1ZSxcblx0XHRcdGRlYnVnOiB0cnVlLFxuXHRcdFx0aW5mbzogdHJ1ZSxcblx0XHRcdHdhcm5pbmc6IHRydWUsXG5cdFx0XHRlcnJvcjogdHJ1ZSxcblx0XHRcdHNvdXJjZXM6ICcnLFxuXHRcdH0sIGNvbnRleHRLZXlTZXJ2aWNlKSk7XG5cdH1cblxuXHRwcm92aWRlVGV4dENvbnRlbnQocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SVRleHRNb2RlbD4gfCBudWxsIHtcblx0XHRjb25zdCBjaGFubmVsID0gPE91dHB1dENoYW5uZWw+dGhpcy5nZXRDaGFubmVsKHJlc291cmNlLnBhdGgpO1xuXHRcdGlmIChjaGFubmVsKSB7XG5cdFx0XHRyZXR1cm4gY2hhbm5lbC5tb2RlbC5sb2FkTW9kZWwoKTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRhc3luYyBzaG93Q2hhbm5lbChpZDogc3RyaW5nLCBwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNoYW5uZWwgPSB0aGlzLmdldENoYW5uZWwoaWQpO1xuXHRcdGlmICh0aGlzLmFjdGl2ZUNoYW5uZWw/LmlkICE9PSBjaGFubmVsPy5pZCkge1xuXHRcdFx0dGhpcy5zZXRBY3RpdmVDaGFubmVsKGNoYW5uZWwpO1xuXHRcdFx0dGhpcy5fb25BY3RpdmVPdXRwdXRDaGFubmVsLmZpcmUoaWQpO1xuXHRcdH1cblx0XHRjb25zdCBvdXRwdXRWaWV3ID0gYXdhaXQgdGhpcy52aWV3c1NlcnZpY2Uub3BlblZpZXc8T3V0cHV0Vmlld1BhbmU+KE9VVFBVVF9WSUVXX0lELCAhcHJlc2VydmVGb2N1cyk7XG5cdFx0aWYgKG91dHB1dFZpZXcgJiYgY2hhbm5lbCkge1xuXHRcdFx0b3V0cHV0Vmlldy5zaG93Q2hhbm5lbChjaGFubmVsLCAhIXByZXNlcnZlRm9jdXMpO1xuXHRcdH1cblx0fVxuXG5cdGdldENoYW5uZWwoaWQ6IHN0cmluZyk6IE91dHB1dENoYW5uZWwgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmNoYW5uZWxzLmdldChpZCk7XG5cdH1cblxuXHRnZXRDaGFubmVsRGVzY3JpcHRvcihpZDogc3RyaW5nKTogSU91dHB1dENoYW5uZWxEZXNjcmlwdG9yIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gUmVnaXN0cnkuYXM8SU91dHB1dENoYW5uZWxSZWdpc3RyeT4oRXh0ZW5zaW9ucy5PdXRwdXRDaGFubmVscykuZ2V0Q2hhbm5lbChpZCk7XG5cdH1cblxuXHRnZXRDaGFubmVsRGVzY3JpcHRvcnMoKTogSU91dHB1dENoYW5uZWxEZXNjcmlwdG9yW10ge1xuXHRcdHJldHVybiBSZWdpc3RyeS5hczxJT3V0cHV0Q2hhbm5lbFJlZ2lzdHJ5PihFeHRlbnNpb25zLk91dHB1dENoYW5uZWxzKS5nZXRDaGFubmVscygpO1xuXHR9XG5cblx0Z2V0QWN0aXZlQ2hhbm5lbCgpOiBJT3V0cHV0Q2hhbm5lbCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuYWN0aXZlQ2hhbm5lbDtcblx0fVxuXG5cdGNhblNldExvZ0xldmVsKGNoYW5uZWw6IElPdXRwdXRDaGFubmVsRGVzY3JpcHRvcik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBjaGFubmVsLmxvZyAmJiBjaGFubmVsLmlkICE9PSB0ZWxlbWV0cnlMb2dJZDtcblx0fVxuXG5cdGdldExvZ0xldmVsKGNoYW5uZWw6IElPdXRwdXRDaGFubmVsRGVzY3JpcHRvcik6IExvZ0xldmVsIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIWNoYW5uZWwubG9nKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBzb3VyY2VzID0gaXNTaW5nbGVTb3VyY2VPdXRwdXRDaGFubmVsRGVzY3JpcHRvcihjaGFubmVsKSA/IFtjaGFubmVsLnNvdXJjZV0gOiBpc011bHRpU291cmNlT3V0cHV0Q2hhbm5lbERlc2NyaXB0b3IoY2hhbm5lbCkgPyBjaGFubmVsLnNvdXJjZSA6IFtdO1xuXHRcdGlmIChzb3VyY2VzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBsb2dMZXZlbCA9IHRoaXMubG9nZ2VyU2VydmljZS5nZXRMb2dMZXZlbCgpO1xuXHRcdHJldHVybiBzb3VyY2VzLnJlZHVjZSgocHJldiwgY3VycikgPT4gTWF0aC5taW4ocHJldiwgdGhpcy5sb2dnZXJTZXJ2aWNlLmdldExvZ0xldmVsKGN1cnIucmVzb3VyY2UpID8/IGxvZ0xldmVsKSwgTG9nTGV2ZWwuRXJyb3IpO1xuXHR9XG5cblx0c2V0TG9nTGV2ZWwoY2hhbm5lbDogSU91dHB1dENoYW5uZWxEZXNjcmlwdG9yLCBsb2dMZXZlbDogTG9nTGV2ZWwpOiB2b2lkIHtcblx0XHRpZiAoIWNoYW5uZWwubG9nKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHNvdXJjZXMgPSBpc1NpbmdsZVNvdXJjZU91dHB1dENoYW5uZWxEZXNjcmlwdG9yKGNoYW5uZWwpID8gW2NoYW5uZWwuc291cmNlXSA6IGlzTXVsdGlTb3VyY2VPdXRwdXRDaGFubmVsRGVzY3JpcHRvcihjaGFubmVsKSA/IGNoYW5uZWwuc291cmNlIDogW107XG5cdFx0aWYgKHNvdXJjZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGZvciAoY29uc3Qgc291cmNlIG9mIHNvdXJjZXMpIHtcblx0XHRcdHRoaXMubG9nZ2VyU2VydmljZS5zZXRMb2dMZXZlbChzb3VyY2UucmVzb3VyY2UsIGxvZ0xldmVsKTtcblx0XHR9XG5cdH1cblxuXHRyZWdpc3RlckNvbXBvdW5kTG9nQ2hhbm5lbChkZXNjcmlwdG9yczogSU91dHB1dENoYW5uZWxEZXNjcmlwdG9yW10pOiBzdHJpbmcge1xuXHRcdGNvbnN0IG91dHB1dENoYW5uZWxSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElPdXRwdXRDaGFubmVsUmVnaXN0cnk+KEV4dGVuc2lvbnMuT3V0cHV0Q2hhbm5lbHMpO1xuXHRcdGRlc2NyaXB0b3JzLnNvcnQoKGEsIGIpID0+IGEubGFiZWwubG9jYWxlQ29tcGFyZShiLmxhYmVsKSk7XG5cdFx0Y29uc3QgaWQgPSBkZXNjcmlwdG9ycy5tYXAociA9PiByLmlkLnRvTG93ZXJDYXNlKCkpLmpvaW4oJy0nKTtcblx0XHRpZiAoIW91dHB1dENoYW5uZWxSZWdpc3RyeS5nZXRDaGFubmVsKGlkKSkge1xuXHRcdFx0b3V0cHV0Q2hhbm5lbFJlZ2lzdHJ5LnJlZ2lzdGVyQ2hhbm5lbCh7XG5cdFx0XHRcdGlkLFxuXHRcdFx0XHRsYWJlbDogZGVzY3JpcHRvcnMubWFwKHIgPT4gci5sYWJlbCkuam9pbignLCAnKSxcblx0XHRcdFx0bG9nOiBkZXNjcmlwdG9ycy5zb21lKHIgPT4gci5sb2cpLFxuXHRcdFx0XHR1c2VyOiB0cnVlLFxuXHRcdFx0XHRzb3VyY2U6IGRlc2NyaXB0b3JzLm1hcChkZXNjcmlwdG9yID0+IHtcblx0XHRcdFx0XHRpZiAoaXNTaW5nbGVTb3VyY2VPdXRwdXRDaGFubmVsRGVzY3JpcHRvcihkZXNjcmlwdG9yKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIFt7IHJlc291cmNlOiBkZXNjcmlwdG9yLnNvdXJjZS5yZXNvdXJjZSwgbmFtZTogZGVzY3JpcHRvci5zb3VyY2UubmFtZSA/PyBkZXNjcmlwdG9yLmxhYmVsIH1dO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoaXNNdWx0aVNvdXJjZU91dHB1dENoYW5uZWxEZXNjcmlwdG9yKGRlc2NyaXB0b3IpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZGVzY3JpcHRvci5zb3VyY2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IGNoYW5uZWwgPSB0aGlzLmdldENoYW5uZWwoZGVzY3JpcHRvci5pZCk7XG5cdFx0XHRcdFx0aWYgKGNoYW5uZWwpIHtcblx0XHRcdFx0XHRcdHJldHVybiBjaGFubmVsLm1vZGVsLnNvdXJjZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0XHR9KS5mbGF0KCksXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cblx0YXN5bmMgc2F2ZU91dHB1dEFzKC4uLmNoYW5uZWxzOiBJT3V0cHV0Q2hhbm5lbERlc2NyaXB0b3JbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBjaGFubmVsOiBJT3V0cHV0Q2hhbm5lbCB8IHVuZGVmaW5lZDtcblx0XHRpZiAoY2hhbm5lbHMubGVuZ3RoID4gMSkge1xuXHRcdFx0Y29uc3QgY29tcG91bmRDaGFubmVsSWQgPSB0aGlzLnJlZ2lzdGVyQ29tcG91bmRMb2dDaGFubmVsKGNoYW5uZWxzKTtcblx0XHRcdGNoYW5uZWwgPSB0aGlzLmdldENoYW5uZWwoY29tcG91bmRDaGFubmVsSWQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjaGFubmVsID0gdGhpcy5nZXRDaGFubmVsKGNoYW5uZWxzWzBdLmlkKTtcblx0XHR9XG5cblx0XHRpZiAoIWNoYW5uZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgbmFtZSA9IGNoYW5uZWxzLmxlbmd0aCA+IDEgPyAnb3V0cHV0JyA6IGNoYW5uZWxzWzBdLmxhYmVsO1xuXHRcdFx0Y29uc3QgdXJpID0gYXdhaXQgdGhpcy5maWxlRGlhbG9nU2VydmljZS5zaG93U2F2ZURpYWxvZyh7XG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnc2F2ZUxvZy5kaWFsb2dUaXRsZScsIFwiU2F2ZSBPdXRwdXQgQXNcIiksXG5cdFx0XHRcdGF2YWlsYWJsZUZpbGVTeXN0ZW1zOiBbU2NoZW1hcy5maWxlXSxcblx0XHRcdFx0ZGVmYXVsdFVyaTogam9pblBhdGgoYXdhaXQgdGhpcy5maWxlRGlhbG9nU2VydmljZS5kZWZhdWx0RmlsZVBhdGgoKSwgYCR7bmFtZX0ubG9nYCksXG5cdFx0XHRcdGZpbHRlcnM6IFt7XG5cdFx0XHRcdFx0bmFtZSxcblx0XHRcdFx0XHRleHRlbnNpb25zOiBbJ2xvZyddXG5cdFx0XHRcdH1dXG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKCF1cmkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtb2RlbFJlZiA9IGF3YWl0IHRoaXMudGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShjaGFubmVsLnVyaSk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLndyaXRlRmlsZSh1cmksIFZTQnVmZmVyLmZyb21TdHJpbmcobW9kZWxSZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbC5nZXRWYWx1ZSgpKSk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRtb2RlbFJlZi5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGZpbmFsbHkge1xuXHRcdFx0aWYgKGNoYW5uZWxzLmxlbmd0aCA+IDEpIHtcblx0XHRcdFx0UmVnaXN0cnkuYXM8SU91dHB1dENoYW5uZWxSZWdpc3RyeT4oRXh0ZW5zaW9ucy5PdXRwdXRDaGFubmVscykucmVtb3ZlQ2hhbm5lbChjaGFubmVsLmlkKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9uRGlkUmVnaXN0ZXJDaGFubmVsKGNoYW5uZWxJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY2hhbm5lbCA9IHRoaXMuY3JlYXRlQ2hhbm5lbChjaGFubmVsSWQpO1xuXHRcdHRoaXMuY2hhbm5lbHMuc2V0KGNoYW5uZWxJZCwgY2hhbm5lbCk7XG5cdFx0aWYgKCF0aGlzLmFjdGl2ZUNoYW5uZWwgfHwgdGhpcy5hY3RpdmVDaGFubmVsSWRJblN0b3JhZ2UgPT09IGNoYW5uZWxJZCkge1xuXHRcdFx0dGhpcy5zZXRBY3RpdmVDaGFubmVsKGNoYW5uZWwpO1xuXHRcdFx0dGhpcy5fb25BY3RpdmVPdXRwdXRDaGFubmVsLmZpcmUoY2hhbm5lbElkKTtcblx0XHRcdGNvbnN0IG91dHB1dFZpZXcgPSB0aGlzLnZpZXdzU2VydmljZS5nZXRBY3RpdmVWaWV3V2l0aElkPE91dHB1dFZpZXdQYW5lPihPVVRQVVRfVklFV19JRCk7XG5cdFx0XHRvdXRwdXRWaWV3Py5zaG93Q2hhbm5lbChjaGFubmVsLCB0cnVlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkVXBkYXRlQ2hhbm5lbFNvdXJjZXMoY2hhbm5lbDogSU11bHRpU291cmNlT3V0cHV0Q2hhbm5lbERlc2NyaXB0b3IpOiB2b2lkIHtcblx0XHRjb25zdCBvdXRwdXRDaGFubmVsID0gdGhpcy5jaGFubmVscy5nZXQoY2hhbm5lbC5pZCk7XG5cdFx0aWYgKG91dHB1dENoYW5uZWwpIHtcblx0XHRcdG91dHB1dENoYW5uZWwubW9kZWwudXBkYXRlQ2hhbm5lbFNvdXJjZXMoY2hhbm5lbC5zb3VyY2UpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EaWRSZW1vdmVDaGFubmVsKGNoYW5uZWw6IElPdXRwdXRDaGFubmVsRGVzY3JpcHRvcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLmFjdGl2ZUNoYW5uZWw/LmlkID09PSBjaGFubmVsLmlkKSB7XG5cdFx0XHRjb25zdCBjaGFubmVscyA9IHRoaXMuZ2V0Q2hhbm5lbERlc2NyaXB0b3JzKCk7XG5cdFx0XHRpZiAoY2hhbm5lbHNbMF0pIHtcblx0XHRcdFx0dGhpcy5zaG93Q2hhbm5lbChjaGFubmVsc1swXS5pZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuY2hhbm5lbHMuZGVsZXRlQW5kRGlzcG9zZShjaGFubmVsLmlkKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlQ2hhbm5lbChpZDogc3RyaW5nKTogT3V0cHV0Q2hhbm5lbCB7XG5cdFx0Y29uc3QgY2hhbm5lbCA9IHRoaXMuaW5zdGFudGlhdGVDaGFubmVsKGlkKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5vbmNlKGNoYW5uZWwubW9kZWwub25EaXNwb3NlKSgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5hY3RpdmVDaGFubmVsID09PSBjaGFubmVsKSB7XG5cdFx0XHRcdGNvbnN0IGNoYW5uZWxzID0gdGhpcy5nZXRDaGFubmVsRGVzY3JpcHRvcnMoKTtcblx0XHRcdFx0Y29uc3QgY2hhbm5lbCA9IGNoYW5uZWxzLmxlbmd0aCA/IHRoaXMuZ2V0Q2hhbm5lbChjaGFubmVsc1swXS5pZCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmIChjaGFubmVsICYmIHRoaXMudmlld3NTZXJ2aWNlLmlzVmlld1Zpc2libGUoT1VUUFVUX1ZJRVdfSUQpKSB7XG5cdFx0XHRcdFx0dGhpcy5zaG93Q2hhbm5lbChjaGFubmVsLmlkKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnNldEFjdGl2ZUNoYW5uZWwodW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0UmVnaXN0cnkuYXM8SU91dHB1dENoYW5uZWxSZWdpc3RyeT4oRXh0ZW5zaW9ucy5PdXRwdXRDaGFubmVscykucmVtb3ZlQ2hhbm5lbChpZCk7XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIGNoYW5uZWw7XG5cdH1cblxuXHRwcml2YXRlIG91dHB1dEZvbGRlckNyZWF0aW9uUHJvbWlzZTogUHJvbWlzZTx2b2lkPiB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGluc3RhbnRpYXRlQ2hhbm5lbChpZDogc3RyaW5nKTogT3V0cHV0Q2hhbm5lbCB7XG5cdFx0Y29uc3QgY2hhbm5lbERhdGEgPSBSZWdpc3RyeS5hczxJT3V0cHV0Q2hhbm5lbFJlZ2lzdHJ5PihFeHRlbnNpb25zLk91dHB1dENoYW5uZWxzKS5nZXRDaGFubmVsKGlkKTtcblx0XHRpZiAoIWNoYW5uZWxEYXRhKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYENoYW5uZWwgJyR7aWR9JyBpcyBub3QgcmVnaXN0ZXJlZCB5ZXRgKTtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgQ2hhbm5lbCAnJHtpZH0nIGlzIG5vdCByZWdpc3RlcmVkIHlldGApO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMub3V0cHV0Rm9sZGVyQ3JlYXRpb25Qcm9taXNlKSB7XG5cdFx0XHR0aGlzLm91dHB1dEZvbGRlckNyZWF0aW9uUHJvbWlzZSA9IHRoaXMuZmlsZVNlcnZpY2UuY3JlYXRlRm9sZGVyKHRoaXMub3V0cHV0TG9jYXRpb24pLnRoZW4oKCkgPT4gdW5kZWZpbmVkKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoT3V0cHV0Q2hhbm5lbCwgY2hhbm5lbERhdGEsIHRoaXMub3V0cHV0TG9jYXRpb24sIHRoaXMub3V0cHV0Rm9sZGVyQ3JlYXRpb25Qcm9taXNlKTtcblx0fVxuXG5cdHByaXZhdGUgcmVzZXRMb2dMZXZlbEZpbHRlcnMoKTogdm9pZCB7XG5cdFx0Y29uc3QgZGVzY3JpcHRvciA9IHRoaXMuYWN0aXZlQ2hhbm5lbD8ub3V0cHV0Q2hhbm5lbERlc2NyaXB0b3I7XG5cdFx0Y29uc3QgY2hhbm5lbExvZ0xldmVsID0gZGVzY3JpcHRvciA/IHRoaXMuZ2V0TG9nTGV2ZWwoZGVzY3JpcHRvcikgOiB1bmRlZmluZWQ7XG5cdFx0aWYgKGNoYW5uZWxMb2dMZXZlbCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLmZpbHRlcnMuZXJyb3IgPSBjaGFubmVsTG9nTGV2ZWwgPD0gTG9nTGV2ZWwuRXJyb3I7XG5cdFx0XHR0aGlzLmZpbHRlcnMud2FybmluZyA9IGNoYW5uZWxMb2dMZXZlbCA8PSBMb2dMZXZlbC5XYXJuaW5nO1xuXHRcdFx0dGhpcy5maWx0ZXJzLmluZm8gPSBjaGFubmVsTG9nTGV2ZWwgPD0gTG9nTGV2ZWwuSW5mbztcblx0XHRcdHRoaXMuZmlsdGVycy5kZWJ1ZyA9IGNoYW5uZWxMb2dMZXZlbCA8PSBMb2dMZXZlbC5EZWJ1Zztcblx0XHRcdHRoaXMuZmlsdGVycy50cmFjZSA9IGNoYW5uZWxMb2dMZXZlbCA8PSBMb2dMZXZlbC5UcmFjZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldExldmVsQ29udGV4dCgpOiB2b2lkIHtcblx0XHRjb25zdCBkZXNjcmlwdG9yID0gdGhpcy5hY3RpdmVDaGFubmVsPy5vdXRwdXRDaGFubmVsRGVzY3JpcHRvcjtcblx0XHRjb25zdCBjaGFubmVsTG9nTGV2ZWwgPSBkZXNjcmlwdG9yID8gdGhpcy5nZXRMb2dMZXZlbChkZXNjcmlwdG9yKSA6IHVuZGVmaW5lZDtcblx0XHR0aGlzLmFjdGl2ZU91dHB1dENoYW5uZWxMZXZlbENvbnRleHQuc2V0KGNoYW5uZWxMb2dMZXZlbCAhPT0gdW5kZWZpbmVkID8gTG9nTGV2ZWxUb1N0cmluZyhjaGFubmVsTG9nTGV2ZWwpIDogJycpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzZXRMZXZlbElzRGVmYXVsdENvbnRleHQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGVzY3JpcHRvciA9IHRoaXMuYWN0aXZlQ2hhbm5lbD8ub3V0cHV0Q2hhbm5lbERlc2NyaXB0b3I7XG5cdFx0Y29uc3QgY2hhbm5lbExvZ0xldmVsID0gZGVzY3JpcHRvciA/IHRoaXMuZ2V0TG9nTGV2ZWwoZGVzY3JpcHRvcikgOiB1bmRlZmluZWQ7XG5cdFx0aWYgKGNoYW5uZWxMb2dMZXZlbCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCBjaGFubmVsRGVmYXVsdExvZ0xldmVsID0gYXdhaXQgdGhpcy5kZWZhdWx0TG9nTGV2ZWxzU2VydmljZS5nZXREZWZhdWx0TG9nTGV2ZWwoZGVzY3JpcHRvcj8uZXh0ZW5zaW9uSWQpO1xuXHRcdFx0dGhpcy5hY3RpdmVPdXRwdXRDaGFubmVsTGV2ZWxJc0RlZmF1bHRDb250ZXh0LnNldChjaGFubmVsRGVmYXVsdExvZ0xldmVsID09PSBjaGFubmVsTG9nTGV2ZWwpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmFjdGl2ZU91dHB1dENoYW5uZWxMZXZlbElzRGVmYXVsdENvbnRleHQuc2V0KGZhbHNlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldEFjdGl2ZUNoYW5uZWwoY2hhbm5lbDogT3V0cHV0Q2hhbm5lbCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuYWN0aXZlQ2hhbm5lbCA9IGNoYW5uZWw7XG5cdFx0Y29uc3QgZGVzY3JpcHRvciA9IGNoYW5uZWw/Lm91dHB1dENoYW5uZWxEZXNjcmlwdG9yO1xuXHRcdHRoaXMuYWN0aXZlRmlsZU91dHB1dENoYW5uZWxDb250ZXh0LnNldCghIWRlc2NyaXB0b3IgJiYgaXNTaW5nbGVTb3VyY2VPdXRwdXRDaGFubmVsRGVzY3JpcHRvcihkZXNjcmlwdG9yKSk7XG5cdFx0dGhpcy5hY3RpdmVMb2dPdXRwdXRDaGFubmVsQ29udGV4dC5zZXQoISFkZXNjcmlwdG9yPy5sb2cpO1xuXHRcdHRoaXMuYWN0aXZlT3V0cHV0Q2hhbm5lbExldmVsU2V0dGFibGVDb250ZXh0LnNldChkZXNjcmlwdG9yICE9PSB1bmRlZmluZWQgJiYgdGhpcy5jYW5TZXRMb2dMZXZlbChkZXNjcmlwdG9yKSk7XG5cdFx0dGhpcy5zZXRMZXZlbElzRGVmYXVsdENvbnRleHQoKTtcblx0XHR0aGlzLnNldExldmVsQ29udGV4dCgpO1xuXG5cdFx0aWYgKHRoaXMuYWN0aXZlQ2hhbm5lbCkge1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShPVVRQVVRfQUNUSVZFX0NIQU5ORUxfS0VZLCB0aGlzLmFjdGl2ZUNoYW5uZWwuaWQsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2UucmVtb3ZlKE9VVFBVVF9BQ1RJVkVfQ0hBTk5FTF9LRVksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLE9BQU8sZUFBZTtBQUMvQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsWUFBWSxxQkFBcUI7QUFDMUMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBUyxnQkFBZ0I7QUFDekIsU0FBeUMsZ0JBQWdCLFVBQVUsYUFBZ0UsWUFBb0MsK0JBQStCLDRCQUE0QixzQ0FBc0MsNkJBQTZCLHdDQUE0RCwyQkFBMkIsMkJBQTJCLDBCQUEwQiwyQkFBMkIsNkJBQTZCLGdDQUFxRSx1Q0FBdUMsOEJBQThCLDRDQUF1RDtBQUMxcUIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx5QkFBb0Q7QUFFN0QsU0FBUyxhQUFhLGdCQUFnQixVQUFVLHdCQUF3QjtBQUN4RSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDZCQUE2Qix3QkFBNkMsbUNBQW1DO0FBQ3RILFNBQVMscUJBQXFCO0FBRTlCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQXNCLDBCQUEwQjtBQUNoRCxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG9DQUFvQztBQUU3QyxNQUFNLDRCQUE0QjtBQUVsQyxJQUFNLGdCQUFOLGNBQTRCLFdBQXFDO0FBQUEsRUFRaEUsWUFDVSx5QkFDUSxnQkFDQSxrQkFDa0IsaUJBQ0ssc0JBQ3ZDO0FBQ0QsVUFBTTtBQU5HO0FBQ1E7QUFDQTtBQUNrQjtBQUNLO0FBWHpDLHNCQUFzQjtBQWNyQixTQUFLLEtBQUssd0JBQXdCO0FBQ2xDLFNBQUssUUFBUSx3QkFBd0I7QUFDckMsU0FBSyxNQUFNLElBQUksS0FBSyxFQUFFLFFBQVEsUUFBUSxlQUFlLE1BQU0sS0FBSyxHQUFHLENBQUM7QUFDcEUsU0FBSyxRQUFRLEtBQUssVUFBVSxLQUFLLHlCQUF5QixLQUFLLEtBQUssdUJBQXVCLENBQUM7QUFBQSxFQUM3RjtBQUFBLEVBRVEseUJBQXlCLEtBQVUseUJBQXdFO0FBQ2xILFVBQU0sV0FBVyx3QkFBd0IsYUFBYSxLQUFLLGdCQUFnQixXQUFXLHdCQUF3QixVQUFVLElBQUksS0FBSyxnQkFBZ0IsaUJBQWlCLHdCQUF3QixNQUFNLFdBQVcsV0FBVztBQUN0TixRQUFJLHFDQUFxQyx1QkFBdUIsR0FBRztBQUNsRSxhQUFPLEtBQUsscUJBQXFCLGVBQWUsNkJBQTZCLEtBQUssVUFBVSxDQUFDLEdBQUcsd0JBQXdCLE1BQU0sQ0FBQztBQUFBLElBQ2hJO0FBQ0EsUUFBSSxzQ0FBc0MsdUJBQXVCLEdBQUc7QUFDbkUsYUFBTyxLQUFLLHFCQUFxQixlQUFlLHdCQUF3QixLQUFLLFVBQVUsd0JBQXdCLE1BQU07QUFBQSxJQUN0SDtBQUNBLFdBQU8sS0FBSyxxQkFBcUIsZUFBZSw2QkFBNkIsS0FBSyxJQUFJLEtBQUssVUFBVSxLQUFLLGdCQUFnQixLQUFLLGdCQUFnQjtBQUFBLEVBQ2hKO0FBQUEsRUFFQSxnQkFBMEM7QUFDekMsV0FBTyxLQUFLLE1BQU0sY0FBYztBQUFBLEVBQ2pDO0FBQUEsRUFFQSxPQUFPLFFBQXNCO0FBQzVCLFNBQUssTUFBTSxPQUFPLE1BQU07QUFBQSxFQUN6QjtBQUFBLEVBRUEsT0FBTyxNQUErQixNQUFxQjtBQUMxRCxTQUFLLE1BQU0sT0FBTyxNQUFNLE1BQU0sSUFBSTtBQUFBLEVBQ25DO0FBQUEsRUFFQSxRQUFjO0FBQ2IsU0FBSyxNQUFNLE1BQU07QUFBQSxFQUNsQjtBQUFBLEVBRUEsUUFBUSxPQUFxQjtBQUM1QixTQUFLLE1BQU0sUUFBUSxLQUFLO0FBQUEsRUFDekI7QUFDRDtBQXBETSxnQkFBTjtBQUFBLEVBWUc7QUFBQSxFQUNBO0FBQUEsR0FiRztBQWdFTixNQUFNLDBCQUEwQixXQUF5QztBQUFBLEVBS3hFLFlBQ0MsU0FDaUIsbUJBQ2hCO0FBQ0QsVUFBTTtBQUZXO0FBTGxCLFNBQWlCLGVBQWUsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQ2xFLFNBQVMsY0FBYyxLQUFLLGFBQWE7QUFvQnpDLFNBQVEsY0FBYztBQVd0QixTQUFpQixTQUFTLDBCQUEwQixPQUFPLEtBQUssaUJBQWlCO0FBV2pGLFNBQWlCLFNBQVMsMEJBQTBCLE9BQU8sS0FBSyxpQkFBaUI7QUFXakYsU0FBaUIsUUFBUSx5QkFBeUIsT0FBTyxLQUFLLGlCQUFpQjtBQVcvRSxTQUFpQixXQUFXLDRCQUE0QixPQUFPLEtBQUssaUJBQWlCO0FBV3JGLFNBQWlCLFNBQVMsMEJBQTBCLE9BQU8sS0FBSyxpQkFBaUI7QUFXakYsU0FBaUIsY0FBYyw2QkFBNkIsT0FBTyxLQUFLLGlCQUFpQjtBQTlFeEYsU0FBSyxPQUFPLElBQUksUUFBUSxLQUFLO0FBQzdCLFNBQUssT0FBTyxJQUFJLFFBQVEsS0FBSztBQUM3QixTQUFLLE1BQU0sSUFBSSxRQUFRLElBQUk7QUFDM0IsU0FBSyxTQUFTLElBQUksUUFBUSxPQUFPO0FBQ2pDLFNBQUssT0FBTyxJQUFJLFFBQVEsS0FBSztBQUM3QixTQUFLLFlBQVksSUFBSSxRQUFRLE9BQU87QUFFcEMsU0FBSyxnQkFBZ0IsUUFBUTtBQUFBLEVBQzlCO0FBQUEsRUFLQSxJQUFJLE9BQWU7QUFDbEIsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBQ0EsSUFBSSxLQUFLLFlBQW9CO0FBQzVCLFFBQUksS0FBSyxnQkFBZ0IsWUFBWTtBQUNwQyxXQUFLLGNBQWM7QUFDbkIsV0FBSyxhQUFhLEtBQUs7QUFBQSxJQUN4QjtBQUFBLEVBQ0Q7QUFBQSxFQUdBLElBQUksUUFBaUI7QUFDcEIsV0FBTyxDQUFDLENBQUMsS0FBSyxPQUFPLElBQUk7QUFBQSxFQUMxQjtBQUFBLEVBQ0EsSUFBSSxNQUFNLE9BQWdCO0FBQ3pCLFFBQUksS0FBSyxPQUFPLElBQUksTUFBTSxPQUFPO0FBQ2hDLFdBQUssT0FBTyxJQUFJLEtBQUs7QUFDckIsV0FBSyxhQUFhLEtBQUs7QUFBQSxJQUN4QjtBQUFBLEVBQ0Q7QUFBQSxFQUdBLElBQUksUUFBaUI7QUFDcEIsV0FBTyxDQUFDLENBQUMsS0FBSyxPQUFPLElBQUk7QUFBQSxFQUMxQjtBQUFBLEVBQ0EsSUFBSSxNQUFNLE9BQWdCO0FBQ3pCLFFBQUksS0FBSyxPQUFPLElBQUksTUFBTSxPQUFPO0FBQ2hDLFdBQUssT0FBTyxJQUFJLEtBQUs7QUFDckIsV0FBSyxhQUFhLEtBQUs7QUFBQSxJQUN4QjtBQUFBLEVBQ0Q7QUFBQSxFQUdBLElBQUksT0FBZ0I7QUFDbkIsV0FBTyxDQUFDLENBQUMsS0FBSyxNQUFNLElBQUk7QUFBQSxFQUN6QjtBQUFBLEVBQ0EsSUFBSSxLQUFLLE1BQWU7QUFDdkIsUUFBSSxLQUFLLE1BQU0sSUFBSSxNQUFNLE1BQU07QUFDOUIsV0FBSyxNQUFNLElBQUksSUFBSTtBQUNuQixXQUFLLGFBQWEsS0FBSztBQUFBLElBQ3hCO0FBQUEsRUFDRDtBQUFBLEVBR0EsSUFBSSxVQUFtQjtBQUN0QixXQUFPLENBQUMsQ0FBQyxLQUFLLFNBQVMsSUFBSTtBQUFBLEVBQzVCO0FBQUEsRUFDQSxJQUFJLFFBQVEsU0FBa0I7QUFDN0IsUUFBSSxLQUFLLFNBQVMsSUFBSSxNQUFNLFNBQVM7QUFDcEMsV0FBSyxTQUFTLElBQUksT0FBTztBQUN6QixXQUFLLGFBQWEsS0FBSztBQUFBLElBQ3hCO0FBQUEsRUFDRDtBQUFBLEVBR0EsSUFBSSxRQUFpQjtBQUNwQixXQUFPLENBQUMsQ0FBQyxLQUFLLE9BQU8sSUFBSTtBQUFBLEVBQzFCO0FBQUEsRUFDQSxJQUFJLE1BQU0sT0FBZ0I7QUFDekIsUUFBSSxLQUFLLE9BQU8sSUFBSSxNQUFNLE9BQU87QUFDaEMsV0FBSyxPQUFPLElBQUksS0FBSztBQUNyQixXQUFLLGFBQWEsS0FBSztBQUFBLElBQ3hCO0FBQUEsRUFDRDtBQUFBLEVBR0EsSUFBSSxhQUFxQjtBQUN4QixXQUFPLEtBQUssWUFBWSxJQUFJLEtBQUs7QUFBQSxFQUNsQztBQUFBLEVBQ0EsSUFBSSxXQUFXLFlBQW9CO0FBQ2xDLFNBQUssWUFBWSxJQUFJLFVBQVU7QUFDL0IsU0FBSyxhQUFhLEtBQUs7QUFBQSxFQUN4QjtBQUFBLEVBRUEsZUFBZSxVQUF3QjtBQUN0QyxVQUFNLGFBQWEsS0FBSztBQUN4QixRQUFJLEtBQUssWUFBWSxRQUFRLEdBQUc7QUFDL0IsV0FBSyxhQUFhLFdBQVcsUUFBUSxJQUFJLFFBQVEsS0FBSyxHQUFHO0FBQUEsSUFDMUQsT0FBTztBQUNOLFdBQUssYUFBYSxHQUFHLFVBQVUsR0FBRyxRQUFRO0FBQUEsSUFDM0M7QUFBQSxFQUNEO0FBQUEsRUFFQSxZQUFZLFVBQTJCO0FBQ3RDLFFBQUksYUFBYSxLQUFLO0FBQ3JCLGFBQU87QUFBQSxJQUNSO0FBQ0EsV0FBTyxLQUFLLFdBQVcsU0FBUyxJQUFJLFFBQVEsR0FBRztBQUFBLEVBQ2hEO0FBQ0Q7QUFFTyxJQUFNLGdCQUFOLGNBQTRCLFdBQWdFO0FBQUEsRUFzQmxHLFlBQ21DLGdCQUNNLHNCQUNKLGtCQUNOLFlBQ0csZUFDRyxrQkFDSixjQUNaLG1CQUN1Qix5QkFDTixtQkFDTixhQUNELG9CQUM3QjtBQUNELFVBQU07QUFiNEI7QUFDTTtBQUNKO0FBQ047QUFDRztBQUNHO0FBQ0o7QUFFVztBQUNOO0FBQ047QUE3QmhDLFNBQWlCLFdBQVcsS0FBSyxVQUFVLElBQUksY0FBcUMsQ0FBQztBQUlyRixTQUFpQix5QkFBeUIsS0FBSyxVQUFVLElBQUksUUFBZ0IsQ0FBQztBQUM5RSxTQUFTLHdCQUF1QyxLQUFLLHVCQUF1QjtBQWdSNUUsU0FBUSw4QkFBb0Q7QUFwUDNELFNBQUssMkJBQTJCLEtBQUssZUFBZSxJQUFJLDJCQUEyQixhQUFhLFdBQVcsRUFBRTtBQUM3RyxTQUFLLDZCQUE2Qiw4QkFBOEIsT0FBTyxpQkFBaUI7QUFDeEYsU0FBSywyQkFBMkIsSUFBSSxLQUFLLHdCQUF3QjtBQUNqRSxTQUFLLFVBQVUsS0FBSyxzQkFBc0IsYUFBVyxLQUFLLDJCQUEyQixJQUFJLE9BQU8sQ0FBQyxDQUFDO0FBRWxHLFNBQUssaUNBQWlDLDJCQUEyQixPQUFPLGlCQUFpQjtBQUN6RixTQUFLLGdDQUFnQywrQkFBK0IsT0FBTyxpQkFBaUI7QUFDNUYsU0FBSywwQ0FBMEMscUNBQXFDLE9BQU8saUJBQWlCO0FBQzVHLFNBQUssa0NBQWtDLDRCQUE0QixPQUFPLGlCQUFpQjtBQUMzRixTQUFLLDJDQUEyQyx1Q0FBdUMsT0FBTyxpQkFBaUI7QUFFL0csU0FBSyxpQkFBaUIsU0FBUyxtQkFBbUIsZ0JBQWdCLFVBQVUsaUJBQWlCLG9CQUFJLEtBQUssQ0FBQyxFQUFFLFFBQVEsZ0JBQWdCLEVBQUUsQ0FBQyxFQUFFO0FBR3RJLFNBQUssVUFBVSxpQkFBaUIsaUNBQWlDLFFBQVEsZUFBZSxJQUFJLENBQUM7QUFDN0YsU0FBSyxVQUFVLHFCQUFxQixlQUFlLGtCQUFrQixDQUFDO0FBR3RFLFVBQU0sV0FBVyxTQUFTLEdBQTJCLFdBQVcsY0FBYztBQUM5RSxlQUFXLHFCQUFxQixTQUFTLFlBQVksR0FBRztBQUN2RCxXQUFLLHFCQUFxQixrQkFBa0IsRUFBRTtBQUFBLElBQy9DO0FBQ0EsU0FBSyxVQUFVLFNBQVMscUJBQXFCLFFBQU0sS0FBSyxxQkFBcUIsRUFBRSxDQUFDLENBQUM7QUFDakYsU0FBSyxVQUFVLFNBQVMsMEJBQTBCLGFBQVcsS0FBSywwQkFBMEIsT0FBTyxDQUFDLENBQUM7QUFDckcsU0FBSyxVQUFVLFNBQVMsbUJBQW1CLGFBQVcsS0FBSyxtQkFBbUIsT0FBTyxDQUFDLENBQUM7QUFHdkYsUUFBSSxDQUFDLEtBQUssZUFBZTtBQUN4QixZQUFNLFdBQVcsS0FBSyxzQkFBc0I7QUFDNUMsV0FBSyxpQkFBaUIsWUFBWSxTQUFTLFNBQVMsSUFBSSxLQUFLLFdBQVcsU0FBUyxDQUFDLEVBQUUsRUFBRSxJQUFJLE1BQVM7QUFBQSxJQUNwRztBQUVBLFNBQUssVUFBVSxNQUFNLE9BQU8sS0FBSyxhQUFhLDJCQUEyQixPQUFLLEVBQUUsT0FBTyxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsTUFBTTtBQUN6SCxVQUFJLEtBQUssZUFBZTtBQUN2QixhQUFLLGFBQWEsb0JBQW9DLGNBQWMsR0FBRyxZQUFZLEtBQUssZUFBZSxJQUFJO0FBQUEsTUFDNUc7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFNBQUssVUFBVSxLQUFLLGNBQWMsb0JBQW9CLE1BQU07QUFDM0QsV0FBSyxxQkFBcUI7QUFDMUIsV0FBSyxnQkFBZ0I7QUFDckIsV0FBSyx5QkFBeUI7QUFBQSxJQUMvQixDQUFDLENBQUM7QUFDRixTQUFLLFVBQVUsS0FBSyx3QkFBd0IsNEJBQTRCLE1BQU07QUFDN0UsV0FBSyx5QkFBeUI7QUFBQSxJQUMvQixDQUFDLENBQUM7QUFFRixTQUFLLFVBQVUsS0FBSyxpQkFBaUIsY0FBYyxNQUFNLEtBQUssUUFBUSxDQUFDLENBQUM7QUFFeEUsU0FBSyxVQUFVLEtBQUssVUFBVSxJQUFJLGtCQUFrQjtBQUFBLE1BQ25ELGVBQWUsQ0FBQztBQUFBLE1BQ2hCLE9BQU87QUFBQSxNQUNQLE9BQU87QUFBQSxNQUNQLE1BQU07QUFBQSxNQUNOLFNBQVM7QUFBQSxNQUNULE9BQU87QUFBQSxNQUNQLFNBQVM7QUFBQSxJQUNWLEdBQUcsaUJBQWlCLENBQUM7QUFBQSxFQUN0QjtBQUFBLEVBRUEsbUJBQW1CLFVBQTJDO0FBQzdELFVBQU0sVUFBeUIsS0FBSyxXQUFXLFNBQVMsSUFBSTtBQUM1RCxRQUFJLFNBQVM7QUFDWixhQUFPLFFBQVEsTUFBTSxVQUFVO0FBQUEsSUFDaEM7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBTSxZQUFZLElBQVksZUFBd0M7QUFDckUsVUFBTSxVQUFVLEtBQUssV0FBVyxFQUFFO0FBQ2xDLFFBQUksS0FBSyxlQUFlLE9BQU8sU0FBUyxJQUFJO0FBQzNDLFdBQUssaUJBQWlCLE9BQU87QUFDN0IsV0FBSyx1QkFBdUIsS0FBSyxFQUFFO0FBQUEsSUFDcEM7QUFDQSxVQUFNLGFBQWEsTUFBTSxLQUFLLGFBQWEsU0FBeUIsZ0JBQWdCLENBQUMsYUFBYTtBQUNsRyxRQUFJLGNBQWMsU0FBUztBQUMxQixpQkFBVyxZQUFZLFNBQVMsQ0FBQyxDQUFDLGFBQWE7QUFBQSxJQUNoRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLFdBQVcsSUFBdUM7QUFDakQsV0FBTyxLQUFLLFNBQVMsSUFBSSxFQUFFO0FBQUEsRUFDNUI7QUFBQSxFQUVBLHFCQUFxQixJQUFrRDtBQUN0RSxXQUFPLFNBQVMsR0FBMkIsV0FBVyxjQUFjLEVBQUUsV0FBVyxFQUFFO0FBQUEsRUFDcEY7QUFBQSxFQUVBLHdCQUFvRDtBQUNuRCxXQUFPLFNBQVMsR0FBMkIsV0FBVyxjQUFjLEVBQUUsWUFBWTtBQUFBLEVBQ25GO0FBQUEsRUFFQSxtQkFBK0M7QUFDOUMsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsZUFBZSxTQUE0QztBQUMxRCxXQUFPLFFBQVEsT0FBTyxRQUFRLE9BQU87QUFBQSxFQUN0QztBQUFBLEVBRUEsWUFBWSxTQUF5RDtBQUNwRSxRQUFJLENBQUMsUUFBUSxLQUFLO0FBQ2pCLGFBQU87QUFBQSxJQUNSO0FBQ0EsVUFBTSxVQUFVLHNDQUFzQyxPQUFPLElBQUksQ0FBQyxRQUFRLE1BQU0sSUFBSSxxQ0FBcUMsT0FBTyxJQUFJLFFBQVEsU0FBUyxDQUFDO0FBQ3RKLFFBQUksUUFBUSxXQUFXLEdBQUc7QUFDekIsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLFdBQVcsS0FBSyxjQUFjLFlBQVk7QUFDaEQsV0FBTyxRQUFRLE9BQU8sQ0FBQyxNQUFNLFNBQVMsS0FBSyxJQUFJLE1BQU0sS0FBSyxjQUFjLFlBQVksS0FBSyxRQUFRLEtBQUssUUFBUSxHQUFHLFNBQVMsS0FBSztBQUFBLEVBQ2hJO0FBQUEsRUFFQSxZQUFZLFNBQW1DLFVBQTBCO0FBQ3hFLFFBQUksQ0FBQyxRQUFRLEtBQUs7QUFDakI7QUFBQSxJQUNEO0FBQ0EsVUFBTSxVQUFVLHNDQUFzQyxPQUFPLElBQUksQ0FBQyxRQUFRLE1BQU0sSUFBSSxxQ0FBcUMsT0FBTyxJQUFJLFFBQVEsU0FBUyxDQUFDO0FBQ3RKLFFBQUksUUFBUSxXQUFXLEdBQUc7QUFDekI7QUFBQSxJQUNEO0FBQ0EsZUFBVyxVQUFVLFNBQVM7QUFDN0IsV0FBSyxjQUFjLFlBQVksT0FBTyxVQUFVLFFBQVE7QUFBQSxJQUN6RDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLDJCQUEyQixhQUFpRDtBQUMzRSxVQUFNLHdCQUF3QixTQUFTLEdBQTJCLFdBQVcsY0FBYztBQUMzRixnQkFBWSxLQUFLLENBQUMsR0FBRyxNQUFNLEVBQUUsTUFBTSxjQUFjLEVBQUUsS0FBSyxDQUFDO0FBQ3pELFVBQU0sS0FBSyxZQUFZLElBQUksT0FBSyxFQUFFLEdBQUcsWUFBWSxDQUFDLEVBQUUsS0FBSyxHQUFHO0FBQzVELFFBQUksQ0FBQyxzQkFBc0IsV0FBVyxFQUFFLEdBQUc7QUFDMUMsNEJBQXNCLGdCQUFnQjtBQUFBLFFBQ3JDO0FBQUEsUUFDQSxPQUFPLFlBQVksSUFBSSxPQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssSUFBSTtBQUFBLFFBQzlDLEtBQUssWUFBWSxLQUFLLE9BQUssRUFBRSxHQUFHO0FBQUEsUUFDaEMsTUFBTTtBQUFBLFFBQ04sUUFBUSxZQUFZLElBQUksZ0JBQWM7QUFDckMsY0FBSSxzQ0FBc0MsVUFBVSxHQUFHO0FBQ3RELG1CQUFPLENBQUMsRUFBRSxVQUFVLFdBQVcsT0FBTyxVQUFVLE1BQU0sV0FBVyxPQUFPLFFBQVEsV0FBVyxNQUFNLENBQUM7QUFBQSxVQUNuRztBQUNBLGNBQUkscUNBQXFDLFVBQVUsR0FBRztBQUNyRCxtQkFBTyxXQUFXO0FBQUEsVUFDbkI7QUFDQSxnQkFBTSxVQUFVLEtBQUssV0FBVyxXQUFXLEVBQUU7QUFDN0MsY0FBSSxTQUFTO0FBQ1osbUJBQU8sUUFBUSxNQUFNO0FBQUEsVUFDdEI7QUFDQSxpQkFBTyxDQUFDO0FBQUEsUUFDVCxDQUFDLEVBQUUsS0FBSztBQUFBLE1BQ1QsQ0FBQztBQUFBLElBQ0Y7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBTSxnQkFBZ0IsVUFBcUQ7QUFDMUUsUUFBSTtBQUNKLFFBQUksU0FBUyxTQUFTLEdBQUc7QUFDeEIsWUFBTSxvQkFBb0IsS0FBSywyQkFBMkIsUUFBUTtBQUNsRSxnQkFBVSxLQUFLLFdBQVcsaUJBQWlCO0FBQUEsSUFDNUMsT0FBTztBQUNOLGdCQUFVLEtBQUssV0FBVyxTQUFTLENBQUMsRUFBRSxFQUFFO0FBQUEsSUFDekM7QUFFQSxRQUFJLENBQUMsU0FBUztBQUNiO0FBQUEsSUFDRDtBQUVBLFFBQUk7QUFDSCxZQUFNLE9BQU8sU0FBUyxTQUFTLElBQUksV0FBVyxTQUFTLENBQUMsRUFBRTtBQUMxRCxZQUFNLE1BQU0sTUFBTSxLQUFLLGtCQUFrQixlQUFlO0FBQUEsUUFDdkQsT0FBTyxTQUFTLHVCQUF1QixnQkFBZ0I7QUFBQSxRQUN2RCxzQkFBc0IsQ0FBQyxRQUFRLElBQUk7QUFBQSxRQUNuQyxZQUFZLFNBQVMsTUFBTSxLQUFLLGtCQUFrQixnQkFBZ0IsR0FBRyxHQUFHLElBQUksTUFBTTtBQUFBLFFBQ2xGLFNBQVMsQ0FBQztBQUFBLFVBQ1Q7QUFBQSxVQUNBLFlBQVksQ0FBQyxLQUFLO0FBQUEsUUFDbkIsQ0FBQztBQUFBLE1BQ0YsQ0FBQztBQUVELFVBQUksQ0FBQyxLQUFLO0FBQ1Q7QUFBQSxNQUNEO0FBRUEsWUFBTSxXQUFXLE1BQU0sS0FBSyxpQkFBaUIscUJBQXFCLFFBQVEsR0FBRztBQUM3RSxVQUFJO0FBQ0gsY0FBTSxLQUFLLFlBQVksVUFBVSxLQUFLLFNBQVMsV0FBVyxTQUFTLE9BQU8sZ0JBQWdCLFNBQVMsQ0FBQyxDQUFDO0FBQUEsTUFDdEcsVUFBRTtBQUNELGlCQUFTLFFBQVE7QUFBQSxNQUNsQjtBQUNBO0FBQUEsSUFDRCxVQUNBO0FBQ0MsVUFBSSxTQUFTLFNBQVMsR0FBRztBQUN4QixpQkFBUyxHQUEyQixXQUFXLGNBQWMsRUFBRSxjQUFjLFFBQVEsRUFBRTtBQUFBLE1BQ3hGO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWMscUJBQXFCLFdBQWtDO0FBQ3BFLFVBQU0sVUFBVSxLQUFLLGNBQWMsU0FBUztBQUM1QyxTQUFLLFNBQVMsSUFBSSxXQUFXLE9BQU87QUFDcEMsUUFBSSxDQUFDLEtBQUssaUJBQWlCLEtBQUssNkJBQTZCLFdBQVc7QUFDdkUsV0FBSyxpQkFBaUIsT0FBTztBQUM3QixXQUFLLHVCQUF1QixLQUFLLFNBQVM7QUFDMUMsWUFBTSxhQUFhLEtBQUssYUFBYSxvQkFBb0MsY0FBYztBQUN2RixrQkFBWSxZQUFZLFNBQVMsSUFBSTtBQUFBLElBQ3RDO0FBQUEsRUFDRDtBQUFBLEVBRVEsMEJBQTBCLFNBQW9EO0FBQ3JGLFVBQU0sZ0JBQWdCLEtBQUssU0FBUyxJQUFJLFFBQVEsRUFBRTtBQUNsRCxRQUFJLGVBQWU7QUFDbEIsb0JBQWMsTUFBTSxxQkFBcUIsUUFBUSxNQUFNO0FBQUEsSUFDeEQ7QUFBQSxFQUNEO0FBQUEsRUFFUSxtQkFBbUIsU0FBeUM7QUFDbkUsUUFBSSxLQUFLLGVBQWUsT0FBTyxRQUFRLElBQUk7QUFDMUMsWUFBTSxXQUFXLEtBQUssc0JBQXNCO0FBQzVDLFVBQUksU0FBUyxDQUFDLEdBQUc7QUFDaEIsYUFBSyxZQUFZLFNBQVMsQ0FBQyxFQUFFLEVBQUU7QUFBQSxNQUNoQztBQUFBLElBQ0Q7QUFDQSxTQUFLLFNBQVMsaUJBQWlCLFFBQVEsRUFBRTtBQUFBLEVBQzFDO0FBQUEsRUFFUSxjQUFjLElBQTJCO0FBQ2hELFVBQU0sVUFBVSxLQUFLLG1CQUFtQixFQUFFO0FBQzFDLFNBQUssVUFBVSxNQUFNLEtBQUssUUFBUSxNQUFNLFNBQVMsRUFBRSxNQUFNO0FBQ3hELFVBQUksS0FBSyxrQkFBa0IsU0FBUztBQUNuQyxjQUFNLFdBQVcsS0FBSyxzQkFBc0I7QUFDNUMsY0FBTUEsV0FBVSxTQUFTLFNBQVMsS0FBSyxXQUFXLFNBQVMsQ0FBQyxFQUFFLEVBQUUsSUFBSTtBQUNwRSxZQUFJQSxZQUFXLEtBQUssYUFBYSxjQUFjLGNBQWMsR0FBRztBQUMvRCxlQUFLLFlBQVlBLFNBQVEsRUFBRTtBQUFBLFFBQzVCLE9BQU87QUFDTixlQUFLLGlCQUFpQixNQUFTO0FBQUEsUUFDaEM7QUFBQSxNQUNEO0FBQ0EsZUFBUyxHQUEyQixXQUFXLGNBQWMsRUFBRSxjQUFjLEVBQUU7QUFBQSxJQUNoRixDQUFDLENBQUM7QUFFRixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBR1EsbUJBQW1CLElBQTJCO0FBQ3JELFVBQU0sY0FBYyxTQUFTLEdBQTJCLFdBQVcsY0FBYyxFQUFFLFdBQVcsRUFBRTtBQUNoRyxRQUFJLENBQUMsYUFBYTtBQUNqQixXQUFLLFdBQVcsTUFBTSxZQUFZLEVBQUUseUJBQXlCO0FBQzdELFlBQU0sSUFBSSxNQUFNLFlBQVksRUFBRSx5QkFBeUI7QUFBQSxJQUN4RDtBQUNBLFFBQUksQ0FBQyxLQUFLLDZCQUE2QjtBQUN0QyxXQUFLLDhCQUE4QixLQUFLLFlBQVksYUFBYSxLQUFLLGNBQWMsRUFBRSxLQUFLLE1BQU0sTUFBUztBQUFBLElBQzNHO0FBQ0EsV0FBTyxLQUFLLHFCQUFxQixlQUFlLGVBQWUsYUFBYSxLQUFLLGdCQUFnQixLQUFLLDJCQUEyQjtBQUFBLEVBQ2xJO0FBQUEsRUFFUSx1QkFBNkI7QUFDcEMsVUFBTSxhQUFhLEtBQUssZUFBZTtBQUN2QyxVQUFNLGtCQUFrQixhQUFhLEtBQUssWUFBWSxVQUFVLElBQUk7QUFDcEUsUUFBSSxvQkFBb0IsUUFBVztBQUNsQyxXQUFLLFFBQVEsUUFBUSxtQkFBbUIsU0FBUztBQUNqRCxXQUFLLFFBQVEsVUFBVSxtQkFBbUIsU0FBUztBQUNuRCxXQUFLLFFBQVEsT0FBTyxtQkFBbUIsU0FBUztBQUNoRCxXQUFLLFFBQVEsUUFBUSxtQkFBbUIsU0FBUztBQUNqRCxXQUFLLFFBQVEsUUFBUSxtQkFBbUIsU0FBUztBQUFBLElBQ2xEO0FBQUEsRUFDRDtBQUFBLEVBRVEsa0JBQXdCO0FBQy9CLFVBQU0sYUFBYSxLQUFLLGVBQWU7QUFDdkMsVUFBTSxrQkFBa0IsYUFBYSxLQUFLLFlBQVksVUFBVSxJQUFJO0FBQ3BFLFNBQUssZ0NBQWdDLElBQUksb0JBQW9CLFNBQVksaUJBQWlCLGVBQWUsSUFBSSxFQUFFO0FBQUEsRUFDaEg7QUFBQSxFQUVBLE1BQWMsMkJBQTBDO0FBQ3ZELFVBQU0sYUFBYSxLQUFLLGVBQWU7QUFDdkMsVUFBTSxrQkFBa0IsYUFBYSxLQUFLLFlBQVksVUFBVSxJQUFJO0FBQ3BFLFFBQUksb0JBQW9CLFFBQVc7QUFDbEMsWUFBTSx5QkFBeUIsTUFBTSxLQUFLLHdCQUF3QixtQkFBbUIsWUFBWSxXQUFXO0FBQzVHLFdBQUsseUNBQXlDLElBQUksMkJBQTJCLGVBQWU7QUFBQSxJQUM3RixPQUFPO0FBQ04sV0FBSyx5Q0FBeUMsSUFBSSxLQUFLO0FBQUEsSUFDeEQ7QUFBQSxFQUNEO0FBQUEsRUFFUSxpQkFBaUIsU0FBMEM7QUFDbEUsU0FBSyxnQkFBZ0I7QUFDckIsVUFBTSxhQUFhLFNBQVM7QUFDNUIsU0FBSywrQkFBK0IsSUFBSSxDQUFDLENBQUMsY0FBYyxzQ0FBc0MsVUFBVSxDQUFDO0FBQ3pHLFNBQUssOEJBQThCLElBQUksQ0FBQyxDQUFDLFlBQVksR0FBRztBQUN4RCxTQUFLLHdDQUF3QyxJQUFJLGVBQWUsVUFBYSxLQUFLLGVBQWUsVUFBVSxDQUFDO0FBQzVHLFNBQUsseUJBQXlCO0FBQzlCLFNBQUssZ0JBQWdCO0FBRXJCLFFBQUksS0FBSyxlQUFlO0FBQ3ZCLFdBQUssZUFBZSxNQUFNLDJCQUEyQixLQUFLLGNBQWMsSUFBSSxhQUFhLFdBQVcsY0FBYyxPQUFPO0FBQUEsSUFDMUgsT0FBTztBQUNOLFdBQUssZUFBZSxPQUFPLDJCQUEyQixhQUFhLFNBQVM7QUFBQSxJQUM3RTtBQUFBLEVBQ0Q7QUFDRDtBQWxWYSxnQkFBTjtBQUFBLEVBdUJKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWxDVTsiLAogICJuYW1lcyI6IFsiY2hhbm5lbCJdCn0K
