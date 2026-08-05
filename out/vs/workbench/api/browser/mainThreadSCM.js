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
import { Barrier } from "../../../base/common/async.js";
import { isUriComponents, URI } from "../../../base/common/uri.js";
import { Event, Emitter } from "../../../base/common/event.js";
import { observableValue, observableValueOpts, transaction } from "../../../base/common/observable.js";
import { DisposableStore, combinedDisposable, dispose, Disposable } from "../../../base/common/lifecycle.js";
import { ISCMService, ISCMViewService } from "../../contrib/scm/common/scm.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { MarshalledId } from "../../../base/common/marshallingIds.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { IQuickDiffService } from "../../contrib/scm/common/quickDiff.js";
import { ResourceTree } from "../../../base/common/resourceTree.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService } from "../../../platform/workspace/common/workspace.js";
import { basename } from "../../../base/common/resources.js";
import { ILanguageService } from "../../../editor/common/languages/language.js";
import { IModelService } from "../../../editor/common/services/model.js";
import { ITextModelService } from "../../../editor/common/services/resolverService.js";
import { Schemas } from "../../../base/common/network.js";
import { structuralEquals } from "../../../base/common/equals.js";
import { historyItemBaseRefColor, historyItemRefColor, historyItemRemoteRefColor } from "../../contrib/scm/browser/scmHistory.js";
function getIconFromIconDto(iconDto) {
  if (iconDto === void 0) {
    return void 0;
  } else if (ThemeIcon.isThemeIcon(iconDto)) {
    return iconDto;
  } else if (isUriComponents(iconDto)) {
    return URI.revive(iconDto);
  } else {
    const icon = iconDto;
    return { light: URI.revive(icon.light), dark: URI.revive(icon.dark) };
  }
}
function toISCMHistoryItem(historyItemDto) {
  const authorIcon = getIconFromIconDto(historyItemDto.authorIcon);
  const references = historyItemDto.references?.map((r) => ({
    ...r,
    icon: getIconFromIconDto(r.icon)
  }));
  return { ...historyItemDto, authorIcon, references };
}
function toISCMHistoryItemRef(historyItemRefDto, color) {
  return historyItemRefDto ? { ...historyItemRefDto, icon: getIconFromIconDto(historyItemRefDto.icon), color } : void 0;
}
class SCMInputBoxContentProvider extends Disposable {
  constructor(textModelService, modelService, languageService) {
    super();
    this.modelService = modelService;
    this.languageService = languageService;
    this._register(textModelService.registerTextModelContentProvider(Schemas.vscodeSourceControl, this));
  }
  async provideTextContent(resource) {
    const existing = this.modelService.getModel(resource);
    if (existing) {
      return existing;
    }
    return this.modelService.createModel("", this.languageService.createById("scminput"), resource);
  }
}
class MainThreadSCMResourceGroup {
  constructor(sourceControlHandle, handle, provider, features, label, id, multiDiffEditorEnableViewChanges, _uriIdentService) {
    this.sourceControlHandle = sourceControlHandle;
    this.handle = handle;
    this.provider = provider;
    this.features = features;
    this.label = label;
    this.id = id;
    this.multiDiffEditorEnableViewChanges = multiDiffEditorEnableViewChanges;
    this._uriIdentService = _uriIdentService;
    this.resources = [];
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._onDidChangeResources = new Emitter();
    this.onDidChangeResources = this._onDidChangeResources.event;
  }
  get resourceTree() {
    if (!this._resourceTree) {
      const rootUri = this.provider.rootUri ?? URI.file("/");
      this._resourceTree = new ResourceTree(this, rootUri, this._uriIdentService.extUri);
      for (const resource of this.resources) {
        this._resourceTree.add(resource.sourceUri, resource);
      }
    }
    return this._resourceTree;
  }
  get hideWhenEmpty() {
    return !!this.features.hideWhenEmpty;
  }
  get contextValue() {
    return this.features.contextValue;
  }
  toJSON() {
    return {
      $mid: MarshalledId.ScmResourceGroup,
      sourceControlHandle: this.sourceControlHandle,
      groupHandle: this.handle
    };
  }
  splice(start, deleteCount, toInsert) {
    this.resources.splice(start, deleteCount, ...toInsert);
    this._resourceTree = void 0;
    this._onDidChangeResources.fire();
  }
  $updateGroup(features) {
    this.features = { ...this.features, ...features };
    this._onDidChange.fire();
  }
  $updateGroupLabel(label) {
    this.label = label;
    this._onDidChange.fire();
  }
}
class MainThreadSCMResource {
  constructor(proxy, sourceControlHandle, groupHandle, handle, sourceUri, resourceGroup, decorations, contextValue, command, multiDiffEditorOriginalUri, multiDiffEditorModifiedUri) {
    this.proxy = proxy;
    this.sourceControlHandle = sourceControlHandle;
    this.groupHandle = groupHandle;
    this.handle = handle;
    this.sourceUri = sourceUri;
    this.resourceGroup = resourceGroup;
    this.decorations = decorations;
    this.contextValue = contextValue;
    this.command = command;
    this.multiDiffEditorOriginalUri = multiDiffEditorOriginalUri;
    this.multiDiffEditorModifiedUri = multiDiffEditorModifiedUri;
  }
  open(preserveFocus) {
    return this.proxy.$executeResourceCommand(this.sourceControlHandle, this.groupHandle, this.handle, preserveFocus);
  }
  toJSON() {
    return {
      $mid: MarshalledId.ScmResource,
      sourceControlHandle: this.sourceControlHandle,
      groupHandle: this.groupHandle,
      handle: this.handle
    };
  }
}
class MainThreadSCMHistoryProvider {
  constructor(proxy, handle) {
    this.proxy = proxy;
    this.handle = handle;
    this._historyItemRef = observableValueOpts({
      owner: this,
      equalsFn: structuralEquals
    }, void 0);
    this._historyItemRemoteRef = observableValueOpts({
      owner: this,
      equalsFn: structuralEquals
    }, void 0);
    this._historyItemBaseRef = observableValueOpts({
      owner: this,
      equalsFn: structuralEquals
    }, void 0);
    this._historyItemRefChanges = observableValue(this, { added: [], modified: [], removed: [], silent: false });
  }
  get historyItemRef() {
    return this._historyItemRef;
  }
  get historyItemRemoteRef() {
    return this._historyItemRemoteRef;
  }
  get historyItemBaseRef() {
    return this._historyItemBaseRef;
  }
  get historyItemRefChanges() {
    return this._historyItemRefChanges;
  }
  async resolveHistoryItemRefsCommonAncestor(historyItemRefs) {
    return this.proxy.$resolveHistoryItemRefsCommonAncestor(this.handle, historyItemRefs, CancellationToken.None);
  }
  async provideHistoryItemRefs(historyItemsRefs) {
    const historyItemRefs = await this.proxy.$provideHistoryItemRefs(this.handle, historyItemsRefs, CancellationToken.None);
    return historyItemRefs?.map((ref) => ({ ...ref, icon: getIconFromIconDto(ref.icon) }));
  }
  async provideHistoryItems(options) {
    const historyItems = await this.proxy.$provideHistoryItems(this.handle, options, CancellationToken.None);
    return historyItems?.map((historyItem) => toISCMHistoryItem(historyItem));
  }
  async provideHistoryItemChanges(historyItemId, historyItemParentId) {
    const changes = await this.proxy.$provideHistoryItemChanges(this.handle, historyItemId, historyItemParentId, CancellationToken.None);
    return changes?.map((change) => ({
      uri: URI.revive(change.uri),
      originalUri: change.originalUri && URI.revive(change.originalUri),
      modifiedUri: change.modifiedUri && URI.revive(change.modifiedUri)
    }));
  }
  $onDidChangeCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef) {
    transaction((tx) => {
      this._historyItemRef.set(toISCMHistoryItemRef(historyItemRef, historyItemRefColor), tx);
      this._historyItemRemoteRef.set(toISCMHistoryItemRef(historyItemRemoteRef, historyItemRemoteRefColor), tx);
      this._historyItemBaseRef.set(toISCMHistoryItemRef(historyItemBaseRef, historyItemBaseRefColor), tx);
    });
  }
  $onDidChangeHistoryItemRefs(historyItemRefs) {
    const added = historyItemRefs.added.map((ref) => toISCMHistoryItemRef(ref));
    const modified = historyItemRefs.modified.map((ref) => toISCMHistoryItemRef(ref));
    const removed = historyItemRefs.removed.map((ref) => toISCMHistoryItemRef(ref));
    this._historyItemRefChanges.set({ added, modified, removed, silent: historyItemRefs.silent }, void 0);
  }
}
const _MainThreadSCMProvider = class _MainThreadSCMProvider {
  constructor(proxy, _handle, _providerId, _label, _rootUri, _inputBoxTextModel, _quickDiffService, _uriIdentService, _workspaceContextService) {
    this.proxy = proxy;
    this._handle = _handle;
    this._providerId = _providerId;
    this._label = _label;
    this._rootUri = _rootUri;
    this._inputBoxTextModel = _inputBoxTextModel;
    this._quickDiffService = _quickDiffService;
    this._uriIdentService = _uriIdentService;
    this._workspaceContextService = _workspaceContextService;
    this._id = `scm${_MainThreadSCMProvider.ID_HANDLE++}`;
    this.groups = [];
    this._onDidChangeResourceGroups = new Emitter();
    this.onDidChangeResourceGroups = this._onDidChangeResourceGroups.event;
    this._onDidChangeResources = new Emitter();
    this.onDidChangeResources = this._onDidChangeResources.event;
    this._groupsByHandle = /* @__PURE__ */ Object.create(null);
    // get groups(): ISequence<ISCMResourceGroup> {
    // 	return {
    // 		elements: this._groups,
    // 		onDidSplice: this._onDidSplice.event
    // 	};
    // 	// return this._groups
    // 	// 	.filter(g => g.resources.elements.length > 0 || !g.features.hideWhenEmpty);
    // }
    this.features = {};
    this._count = observableValue(this, void 0);
    this._statusBarCommands = observableValue(this, void 0);
    this._commitTemplate = observableValue(this, "");
    this._actionButton = observableValue(this, void 0);
    this.isSCM = true;
    this.visible = true;
    this._historyProvider = observableValue(this, void 0);
    if (_rootUri) {
      const folder = this._workspaceContextService.getWorkspaceFolder(_rootUri);
      if (folder?.uri.toString() === _rootUri.toString()) {
        this._name = folder.name;
      } else if (_rootUri.path !== "/") {
        this._name = basename(_rootUri);
      }
    }
  }
  get id() {
    return this._id;
  }
  get handle() {
    return this._handle;
  }
  get label() {
    return this._label;
  }
  get rootUri() {
    return this._rootUri;
  }
  get inputBoxTextModel() {
    return this._inputBoxTextModel;
  }
  get contextValue() {
    return this._providerId;
  }
  get acceptInputCommand() {
    return this.features.acceptInputCommand;
  }
  get count() {
    return this._count;
  }
  get statusBarCommands() {
    return this._statusBarCommands;
  }
  get name() {
    return this._name ?? this._label;
  }
  get commitTemplate() {
    return this._commitTemplate;
  }
  get actionButton() {
    return this._actionButton;
  }
  get historyProvider() {
    return this._historyProvider;
  }
  $updateSourceControl(features) {
    this.features = { ...this.features, ...features };
    if (typeof features.commitTemplate !== "undefined") {
      this._commitTemplate.set(features.commitTemplate, void 0);
    }
    if (typeof features.actionButton !== "undefined") {
      this._actionButton.set(features.actionButton ?? void 0, void 0);
    }
    if (typeof features.count !== "undefined") {
      this._count.set(features.count, void 0);
    }
    if (typeof features.statusBarCommands !== "undefined") {
      this._statusBarCommands.set(features.statusBarCommands, void 0);
    }
    if (features.hasQuickDiffProvider && !this._quickDiff) {
      this._quickDiff = this._quickDiffService.addQuickDiffProvider({
        label: features.quickDiffLabel ?? this.label,
        rootUri: this.rootUri,
        isSCM: this.isSCM,
        visible: this.visible,
        getOriginalResource: (uri) => this.getOriginalResource(uri)
      });
    } else if (features.hasQuickDiffProvider === false && this._quickDiff) {
      this._quickDiff.dispose();
      this._quickDiff = void 0;
    }
    if (features.hasHistoryProvider && !this.historyProvider.get()) {
      const historyProvider = new MainThreadSCMHistoryProvider(this.proxy, this.handle);
      this._historyProvider.set(historyProvider, void 0);
    } else if (features.hasHistoryProvider === false && this.historyProvider.get()) {
      this._historyProvider.set(void 0, void 0);
    }
  }
  $registerGroups(_groups) {
    const groups = _groups.map(([handle, id, label, features, multiDiffEditorEnableViewChanges]) => {
      const group = new MainThreadSCMResourceGroup(
        this.handle,
        handle,
        this,
        features,
        label,
        id,
        multiDiffEditorEnableViewChanges,
        this._uriIdentService
      );
      this._groupsByHandle[handle] = group;
      return group;
    });
    this.groups.splice(this.groups.length, 0, ...groups);
    this._onDidChangeResourceGroups.fire();
  }
  $updateGroup(handle, features) {
    const group = this._groupsByHandle[handle];
    if (!group) {
      return;
    }
    group.$updateGroup(features);
  }
  $updateGroupLabel(handle, label) {
    const group = this._groupsByHandle[handle];
    if (!group) {
      return;
    }
    group.$updateGroupLabel(label);
  }
  $spliceGroupResourceStates(splices) {
    for (const [groupHandle, groupSlices] of splices) {
      const group = this._groupsByHandle[groupHandle];
      if (!group) {
        console.warn(`SCM group ${groupHandle} not found in provider ${this.label}`);
        continue;
      }
      groupSlices.reverse();
      for (const [start, deleteCount, rawResources] of groupSlices) {
        const resources = rawResources.map((rawResource) => {
          const [handle, sourceUri, icons, tooltip, strikeThrough, faded, contextValue, command, multiDiffEditorOriginalUri, multiDiffEditorModifiedUri] = rawResource;
          const [light, dark] = icons;
          const icon = ThemeIcon.isThemeIcon(light) ? light : URI.revive(light);
          const iconDark = (ThemeIcon.isThemeIcon(dark) ? dark : URI.revive(dark)) || icon;
          const decorations = {
            icon,
            iconDark,
            tooltip,
            strikeThrough,
            faded
          };
          return new MainThreadSCMResource(
            this.proxy,
            this.handle,
            groupHandle,
            handle,
            URI.revive(sourceUri),
            group,
            decorations,
            contextValue || void 0,
            command,
            URI.revive(multiDiffEditorOriginalUri),
            URI.revive(multiDiffEditorModifiedUri)
          );
        });
        group.splice(start, deleteCount, resources);
      }
    }
    this._onDidChangeResources.fire();
  }
  $unregisterGroup(handle) {
    const group = this._groupsByHandle[handle];
    if (!group) {
      return;
    }
    delete this._groupsByHandle[handle];
    this.groups.splice(this.groups.indexOf(group), 1);
    this._onDidChangeResourceGroups.fire();
  }
  async getOriginalResource(uri) {
    if (!this.features.hasQuickDiffProvider) {
      return null;
    }
    const result = await this.proxy.$provideOriginalResource(this.handle, uri, CancellationToken.None);
    return result && URI.revive(result);
  }
  $onDidChangeHistoryProviderCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef) {
    if (!this.historyProvider.get()) {
      return;
    }
    this._historyProvider.get()?.$onDidChangeCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef);
  }
  $onDidChangeHistoryProviderHistoryItemRefs(historyItemRefs) {
    if (!this.historyProvider.get()) {
      return;
    }
    this._historyProvider.get()?.$onDidChangeHistoryItemRefs(historyItemRefs);
  }
  toJSON() {
    return {
      $mid: MarshalledId.ScmProvider,
      handle: this.handle
    };
  }
  dispose() {
    this._quickDiff?.dispose();
  }
};
_MainThreadSCMProvider.ID_HANDLE = 0;
let MainThreadSCMProvider = _MainThreadSCMProvider;
let MainThreadSCM = class {
  constructor(extHostContext, scmService, scmViewService, languageService, modelService, textModelService, quickDiffService, _uriIdentService, workspaceContextService) {
    this.scmService = scmService;
    this.scmViewService = scmViewService;
    this.languageService = languageService;
    this.modelService = modelService;
    this.textModelService = textModelService;
    this.quickDiffService = quickDiffService;
    this._uriIdentService = _uriIdentService;
    this.workspaceContextService = workspaceContextService;
    this._repositories = /* @__PURE__ */ new Map();
    this._repositoryBarriers = /* @__PURE__ */ new Map();
    this._repositoryDisposables = /* @__PURE__ */ new Map();
    this._disposables = new DisposableStore();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostSCM);
    this._disposables.add(new SCMInputBoxContentProvider(this.textModelService, this.modelService, this.languageService));
  }
  dispose() {
    dispose(this._repositories.values());
    this._repositories.clear();
    dispose(this._repositoryDisposables.values());
    this._repositoryDisposables.clear();
    this._disposables.dispose();
  }
  async $registerSourceControl(handle, id, label, rootUri, inputBoxDocumentUri) {
    this._repositoryBarriers.set(handle, new Barrier());
    const inputBoxTextModelRef = await this.textModelService.createModelReference(URI.revive(inputBoxDocumentUri));
    const provider = new MainThreadSCMProvider(this._proxy, handle, id, label, rootUri ? URI.revive(rootUri) : void 0, inputBoxTextModelRef.object.textEditorModel, this.quickDiffService, this._uriIdentService, this.workspaceContextService);
    const repository = this.scmService.registerSCMProvider(provider);
    this._repositories.set(handle, repository);
    const disposable = combinedDisposable(
      inputBoxTextModelRef,
      Event.filter(this.scmViewService.onDidFocusRepository, (r) => r === repository)((_) => this._proxy.$setSelectedSourceControl(handle)),
      repository.input.onDidChange(({ value }) => this._proxy.$onInputBoxValueChange(handle, value))
    );
    this._repositoryDisposables.set(handle, disposable);
    if (this.scmViewService.focusedRepository === repository) {
      setTimeout(() => this._proxy.$setSelectedSourceControl(handle), 0);
    }
    if (repository.input.value) {
      setTimeout(() => this._proxy.$onInputBoxValueChange(handle, repository.input.value), 0);
    }
    this._repositoryBarriers.get(handle)?.open();
  }
  async $updateSourceControl(handle, features) {
    await this._repositoryBarriers.get(handle)?.wait();
    const repository = this._repositories.get(handle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$updateSourceControl(features);
  }
  async $unregisterSourceControl(handle) {
    await this._repositoryBarriers.get(handle)?.wait();
    const repository = this._repositories.get(handle);
    if (!repository) {
      return;
    }
    this._repositoryDisposables.get(handle).dispose();
    this._repositoryDisposables.delete(handle);
    repository.dispose();
    this._repositories.delete(handle);
  }
  async $registerGroups(sourceControlHandle, groups, splices) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$registerGroups(groups);
    provider.$spliceGroupResourceStates(splices);
  }
  async $updateGroup(sourceControlHandle, groupHandle, features) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$updateGroup(groupHandle, features);
  }
  async $updateGroupLabel(sourceControlHandle, groupHandle, label) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$updateGroupLabel(groupHandle, label);
  }
  async $spliceResourceStates(sourceControlHandle, splices) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$spliceGroupResourceStates(splices);
  }
  async $unregisterGroup(sourceControlHandle, handle) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$unregisterGroup(handle);
  }
  async $setInputBoxValue(sourceControlHandle, value) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    repository.input.setValue(value, false);
  }
  async $setInputBoxPlaceholder(sourceControlHandle, placeholder) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    repository.input.placeholder = placeholder;
  }
  async $setInputBoxEnablement(sourceControlHandle, enabled) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    repository.input.enabled = enabled;
  }
  async $setInputBoxVisibility(sourceControlHandle, visible) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    repository.input.visible = visible;
  }
  async $showValidationMessage(sourceControlHandle, message, type) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    repository.input.showValidationMessage(message, type);
  }
  async $setValidationProviderIsEnabled(sourceControlHandle, enabled) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    if (enabled) {
      repository.input.validateInput = async (value, pos) => {
        const result = await this._proxy.$validateInput(sourceControlHandle, value, pos);
        return result && { message: result[0], type: result[1] };
      };
    } else {
      repository.input.validateInput = async () => void 0;
    }
  }
  async $onDidChangeHistoryProviderCurrentHistoryItemRefs(sourceControlHandle, historyItemRef, historyItemRemoteRef, historyItemBaseRef) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$onDidChangeHistoryProviderCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef);
  }
  async $onDidChangeHistoryProviderHistoryItemRefs(sourceControlHandle, historyItemRefs) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$onDidChangeHistoryProviderHistoryItemRefs(historyItemRefs);
  }
};
MainThreadSCM = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadSCM),
  __decorateParam(1, ISCMService),
  __decorateParam(2, ISCMViewService),
  __decorateParam(3, ILanguageService),
  __decorateParam(4, IModelService),
  __decorateParam(5, ITextModelService),
  __decorateParam(6, IQuickDiffService),
  __decorateParam(7, IUriIdentityService),
  __decorateParam(8, IWorkspaceContextService)
], MainThreadSCM);
export {
  MainThreadSCM
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZFNDTS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEJhcnJpZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBpc1VyaUNvbXBvbmVudHMsIFVSSSwgVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElPYnNlcnZhYmxlLCBvYnNlcnZhYmxlVmFsdWUsIG9ic2VydmFibGVWYWx1ZU9wdHMsIHRyYW5zYWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBjb21iaW5lZERpc3Bvc2FibGUsIGRpc3Bvc2UsIERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVNDTVNlcnZpY2UsIElTQ01SZXBvc2l0b3J5LCBJU0NNUHJvdmlkZXIsIElTQ01SZXNvdXJjZSwgSVNDTVJlc291cmNlR3JvdXAsIElTQ01SZXNvdXJjZURlY29yYXRpb25zLCBJSW5wdXRWYWxpZGF0aW9uLCBJU0NNVmlld1NlcnZpY2UsIElucHV0VmFsaWRhdGlvblR5cGUsIElTQ01BY3Rpb25CdXR0b25EZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vY29udHJpYi9zY20vY29tbW9uL3NjbS5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0Q29udGV4dCwgTWFpblRocmVhZFNDTVNoYXBlLCBFeHRIb3N0U0NNU2hhcGUsIFNDTVByb3ZpZGVyRmVhdHVyZXMsIFNDTVJhd1Jlc291cmNlU3BsaWNlcywgU0NNR3JvdXBGZWF0dXJlcywgTWFpbkNvbnRleHQsIFNDTUhpc3RvcnlJdGVtRHRvLCBTQ01IaXN0b3J5SXRlbVJlZnNDaGFuZ2VFdmVudER0bywgU0NNSGlzdG9yeUl0ZW1SZWZEdG8gfSBmcm9tICcuLi9jb21tb24vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgZXh0SG9zdE5hbWVkQ3VzdG9tZXIsIElFeHRIb3N0Q29udGV4dCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dEhvc3RDdXN0b21lcnMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgTWFyc2hhbGxlZElkIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbWFyc2hhbGxpbmdJZHMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IElRdWlja0RpZmZTZXJ2aWNlLCBRdWlja0RpZmZQcm92aWRlciB9IGZyb20gJy4uLy4uL2NvbnRyaWIvc2NtL2NvbW1vbi9xdWlja0RpZmYuanMnO1xuaW1wb3J0IHsgSVNDTUhpc3RvcnlJdGVtLCBJU0NNSGlzdG9yeUl0ZW1DaGFuZ2UsIElTQ01IaXN0b3J5SXRlbVJlZiwgSVNDTUhpc3RvcnlJdGVtUmVmc0NoYW5nZUV2ZW50LCBJU0NNSGlzdG9yeU9wdGlvbnMsIElTQ01IaXN0b3J5UHJvdmlkZXIgfSBmcm9tICcuLi8uLi9jb250cmliL3NjbS9jb21tb24vaGlzdG9yeS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZVRyZWUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZVRyZWUuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbENvbnRlbnRQcm92aWRlciwgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBzdHJ1Y3R1cmFsRXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXF1YWxzLmpzJztcbmltcG9ydCB7IGhpc3RvcnlJdGVtQmFzZVJlZkNvbG9yLCBoaXN0b3J5SXRlbVJlZkNvbG9yLCBoaXN0b3J5SXRlbVJlbW90ZVJlZkNvbG9yIH0gZnJvbSAnLi4vLi4vY29udHJpYi9zY20vYnJvd3Nlci9zY21IaXN0b3J5LmpzJztcbmltcG9ydCB7IENvbG9ySWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclV0aWxzLmpzJztcblxuZnVuY3Rpb24gZ2V0SWNvbkZyb21JY29uRHRvKGljb25EdG8/OiBVcmlDb21wb25lbnRzIHwgeyBsaWdodDogVXJpQ29tcG9uZW50czsgZGFyazogVXJpQ29tcG9uZW50cyB9IHwgVGhlbWVJY29uKTogVVJJIHwgeyBsaWdodDogVVJJOyBkYXJrOiBVUkkgfSB8IFRoZW1lSWNvbiB8IHVuZGVmaW5lZCB7XG5cdGlmIChpY29uRHRvID09PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9IGVsc2UgaWYgKFRoZW1lSWNvbi5pc1RoZW1lSWNvbihpY29uRHRvKSkge1xuXHRcdHJldHVybiBpY29uRHRvO1xuXHR9IGVsc2UgaWYgKGlzVXJpQ29tcG9uZW50cyhpY29uRHRvKSkge1xuXHRcdHJldHVybiBVUkkucmV2aXZlKGljb25EdG8pO1xuXHR9IGVsc2Uge1xuXHRcdGNvbnN0IGljb24gPSBpY29uRHRvIGFzIHsgbGlnaHQ6IFVyaUNvbXBvbmVudHM7IGRhcms6IFVyaUNvbXBvbmVudHMgfTtcblx0XHRyZXR1cm4geyBsaWdodDogVVJJLnJldml2ZShpY29uLmxpZ2h0KSwgZGFyazogVVJJLnJldml2ZShpY29uLmRhcmspIH07XG5cdH1cbn1cblxuZnVuY3Rpb24gdG9JU0NNSGlzdG9yeUl0ZW0oaGlzdG9yeUl0ZW1EdG86IFNDTUhpc3RvcnlJdGVtRHRvKTogSVNDTUhpc3RvcnlJdGVtIHtcblx0Y29uc3QgYXV0aG9ySWNvbiA9IGdldEljb25Gcm9tSWNvbkR0byhoaXN0b3J5SXRlbUR0by5hdXRob3JJY29uKTtcblxuXHRjb25zdCByZWZlcmVuY2VzID0gaGlzdG9yeUl0ZW1EdG8ucmVmZXJlbmNlcz8ubWFwKHIgPT4gKHtcblx0XHQuLi5yLCBpY29uOiBnZXRJY29uRnJvbUljb25EdG8oci5pY29uKVxuXHR9KSk7XG5cblx0cmV0dXJuIHsgLi4uaGlzdG9yeUl0ZW1EdG8sIGF1dGhvckljb24sIHJlZmVyZW5jZXMgfTtcbn1cblxuZnVuY3Rpb24gdG9JU0NNSGlzdG9yeUl0ZW1SZWYoaGlzdG9yeUl0ZW1SZWZEdG8/OiBTQ01IaXN0b3J5SXRlbVJlZkR0bywgY29sb3I/OiBDb2xvcklkZW50aWZpZXIpOiBJU0NNSGlzdG9yeUl0ZW1SZWYgfCB1bmRlZmluZWQge1xuXHRyZXR1cm4gaGlzdG9yeUl0ZW1SZWZEdG8gPyB7IC4uLmhpc3RvcnlJdGVtUmVmRHRvLCBpY29uOiBnZXRJY29uRnJvbUljb25EdG8oaGlzdG9yeUl0ZW1SZWZEdG8uaWNvbiksIGNvbG9yOiBjb2xvciB9IDogdW5kZWZpbmVkO1xufVxuXG5jbGFzcyBTQ01JbnB1dEJveENvbnRlbnRQcm92aWRlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0dGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGV4dE1vZGVsU2VydmljZS5yZWdpc3RlclRleHRNb2RlbENvbnRlbnRQcm92aWRlcihTY2hlbWFzLnZzY29kZVNvdXJjZUNvbnRyb2wsIHRoaXMpKTtcblx0fVxuXG5cdGFzeW5jIHByb3ZpZGVUZXh0Q29udGVudChyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxJVGV4dE1vZGVsIHwgbnVsbD4ge1xuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5tb2RlbFNlcnZpY2UuZ2V0TW9kZWwocmVzb3VyY2UpO1xuXHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0cmV0dXJuIGV4aXN0aW5nO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoJycsIHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5SWQoJ3NjbWlucHV0JyksIHJlc291cmNlKTtcblx0fVxufVxuXG5jbGFzcyBNYWluVGhyZWFkU0NNUmVzb3VyY2VHcm91cCBpbXBsZW1lbnRzIElTQ01SZXNvdXJjZUdyb3VwIHtcblxuXHRyZWFkb25seSByZXNvdXJjZXM6IElTQ01SZXNvdXJjZVtdID0gW107XG5cblx0cHJpdmF0ZSBfcmVzb3VyY2VUcmVlOiBSZXNvdXJjZVRyZWU8SVNDTVJlc291cmNlLCBJU0NNUmVzb3VyY2VHcm91cD4gfCB1bmRlZmluZWQ7XG5cdGdldCByZXNvdXJjZVRyZWUoKTogUmVzb3VyY2VUcmVlPElTQ01SZXNvdXJjZSwgSVNDTVJlc291cmNlR3JvdXA+IHtcblx0XHRpZiAoIXRoaXMuX3Jlc291cmNlVHJlZSkge1xuXHRcdFx0Y29uc3Qgcm9vdFVyaSA9IHRoaXMucHJvdmlkZXIucm9vdFVyaSA/PyBVUkkuZmlsZSgnLycpO1xuXHRcdFx0dGhpcy5fcmVzb3VyY2VUcmVlID0gbmV3IFJlc291cmNlVHJlZTxJU0NNUmVzb3VyY2UsIElTQ01SZXNvdXJjZUdyb3VwPih0aGlzLCByb290VXJpLCB0aGlzLl91cmlJZGVudFNlcnZpY2UuZXh0VXJpKTtcblx0XHRcdGZvciAoY29uc3QgcmVzb3VyY2Ugb2YgdGhpcy5yZXNvdXJjZXMpIHtcblx0XHRcdFx0dGhpcy5fcmVzb3VyY2VUcmVlLmFkZChyZXNvdXJjZS5zb3VyY2VVcmksIHJlc291cmNlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fcmVzb3VyY2VUcmVlO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVJlc291cmNlcyA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUmVzb3VyY2VzID0gdGhpcy5fb25EaWRDaGFuZ2VSZXNvdXJjZXMuZXZlbnQ7XG5cblx0Z2V0IGhpZGVXaGVuRW1wdHkoKTogYm9vbGVhbiB7IHJldHVybiAhIXRoaXMuZmVhdHVyZXMuaGlkZVdoZW5FbXB0eTsgfVxuXG5cdGdldCBjb250ZXh0VmFsdWUoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuZmVhdHVyZXMuY29udGV4dFZhbHVlOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBzb3VyY2VDb250cm9sSGFuZGxlOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBoYW5kbGU6IG51bWJlcixcblx0XHRwdWJsaWMgcHJvdmlkZXI6IElTQ01Qcm92aWRlcixcblx0XHRwdWJsaWMgZmVhdHVyZXM6IFNDTUdyb3VwRmVhdHVyZXMsXG5cdFx0cHVibGljIGxhYmVsOiBzdHJpbmcsXG5cdFx0cHVibGljIGlkOiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IG11bHRpRGlmZkVkaXRvckVuYWJsZVZpZXdDaGFuZ2VzOiBib29sZWFuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3VyaUlkZW50U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZVxuXHQpIHsgfVxuXG5cdHRvSlNPTigpOiBhbnkge1xuXHRcdHJldHVybiB7XG5cdFx0XHQkbWlkOiBNYXJzaGFsbGVkSWQuU2NtUmVzb3VyY2VHcm91cCxcblx0XHRcdHNvdXJjZUNvbnRyb2xIYW5kbGU6IHRoaXMuc291cmNlQ29udHJvbEhhbmRsZSxcblx0XHRcdGdyb3VwSGFuZGxlOiB0aGlzLmhhbmRsZVxuXHRcdH07XG5cdH1cblxuXHRzcGxpY2Uoc3RhcnQ6IG51bWJlciwgZGVsZXRlQ291bnQ6IG51bWJlciwgdG9JbnNlcnQ6IElTQ01SZXNvdXJjZVtdKSB7XG5cdFx0dGhpcy5yZXNvdXJjZXMuc3BsaWNlKHN0YXJ0LCBkZWxldGVDb3VudCwgLi4udG9JbnNlcnQpO1xuXHRcdHRoaXMuX3Jlc291cmNlVHJlZSA9IHVuZGVmaW5lZDtcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlUmVzb3VyY2VzLmZpcmUoKTtcblx0fVxuXG5cdCR1cGRhdGVHcm91cChmZWF0dXJlczogU0NNR3JvdXBGZWF0dXJlcyk6IHZvaWQge1xuXHRcdHRoaXMuZmVhdHVyZXMgPSB7IC4uLnRoaXMuZmVhdHVyZXMsIC4uLmZlYXR1cmVzIH07XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSgpO1xuXHR9XG5cblx0JHVwZGF0ZUdyb3VwTGFiZWwobGFiZWw6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMubGFiZWwgPSBsYWJlbDtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdH1cbn1cblxuY2xhc3MgTWFpblRocmVhZFNDTVJlc291cmNlIGltcGxlbWVudHMgSVNDTVJlc291cmNlIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHByb3h5OiBFeHRIb3N0U0NNU2hhcGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBzb3VyY2VDb250cm9sSGFuZGxlOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBncm91cEhhbmRsZTogbnVtYmVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgaGFuZGxlOiBudW1iZXIsXG5cdFx0cmVhZG9ubHkgc291cmNlVXJpOiBVUkksXG5cdFx0cmVhZG9ubHkgcmVzb3VyY2VHcm91cDogSVNDTVJlc291cmNlR3JvdXAsXG5cdFx0cmVhZG9ubHkgZGVjb3JhdGlvbnM6IElTQ01SZXNvdXJjZURlY29yYXRpb25zLFxuXHRcdHJlYWRvbmx5IGNvbnRleHRWYWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdHJlYWRvbmx5IGNvbW1hbmQ6IENvbW1hbmQgfCB1bmRlZmluZWQsXG5cdFx0cmVhZG9ubHkgbXVsdGlEaWZmRWRpdG9yT3JpZ2luYWxVcmk6IFVSSSB8IHVuZGVmaW5lZCxcblx0XHRyZWFkb25seSBtdWx0aURpZmZFZGl0b3JNb2RpZmllZFVyaTogVVJJIHwgdW5kZWZpbmVkLFxuXHQpIHsgfVxuXG5cdG9wZW4ocHJlc2VydmVGb2N1czogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLnByb3h5LiRleGVjdXRlUmVzb3VyY2VDb21tYW5kKHRoaXMuc291cmNlQ29udHJvbEhhbmRsZSwgdGhpcy5ncm91cEhhbmRsZSwgdGhpcy5oYW5kbGUsIHByZXNlcnZlRm9jdXMpO1xuXHR9XG5cblx0dG9KU09OKCk6IGFueSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdCRtaWQ6IE1hcnNoYWxsZWRJZC5TY21SZXNvdXJjZSxcblx0XHRcdHNvdXJjZUNvbnRyb2xIYW5kbGU6IHRoaXMuc291cmNlQ29udHJvbEhhbmRsZSxcblx0XHRcdGdyb3VwSGFuZGxlOiB0aGlzLmdyb3VwSGFuZGxlLFxuXHRcdFx0aGFuZGxlOiB0aGlzLmhhbmRsZVxuXHRcdH07XG5cdH1cbn1cblxuY2xhc3MgTWFpblRocmVhZFNDTUhpc3RvcnlQcm92aWRlciBpbXBsZW1lbnRzIElTQ01IaXN0b3J5UHJvdmlkZXIge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9oaXN0b3J5SXRlbVJlZiA9IG9ic2VydmFibGVWYWx1ZU9wdHM8SVNDTUhpc3RvcnlJdGVtUmVmIHwgdW5kZWZpbmVkPih7XG5cdFx0b3duZXI6IHRoaXMsXG5cdFx0ZXF1YWxzRm46IHN0cnVjdHVyYWxFcXVhbHNcblx0fSwgdW5kZWZpbmVkKTtcblx0Z2V0IGhpc3RvcnlJdGVtUmVmKCk6IElPYnNlcnZhYmxlPElTQ01IaXN0b3J5SXRlbVJlZiB8IHVuZGVmaW5lZD4geyByZXR1cm4gdGhpcy5faGlzdG9yeUl0ZW1SZWY7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9oaXN0b3J5SXRlbVJlbW90ZVJlZiA9IG9ic2VydmFibGVWYWx1ZU9wdHM8SVNDTUhpc3RvcnlJdGVtUmVmIHwgdW5kZWZpbmVkPih7XG5cdFx0b3duZXI6IHRoaXMsXG5cdFx0ZXF1YWxzRm46IHN0cnVjdHVyYWxFcXVhbHNcblx0fSwgdW5kZWZpbmVkKTtcblx0Z2V0IGhpc3RvcnlJdGVtUmVtb3RlUmVmKCk6IElPYnNlcnZhYmxlPElTQ01IaXN0b3J5SXRlbVJlZiB8IHVuZGVmaW5lZD4geyByZXR1cm4gdGhpcy5faGlzdG9yeUl0ZW1SZW1vdGVSZWY7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9oaXN0b3J5SXRlbUJhc2VSZWYgPSBvYnNlcnZhYmxlVmFsdWVPcHRzPElTQ01IaXN0b3J5SXRlbVJlZiB8IHVuZGVmaW5lZD4oe1xuXHRcdG93bmVyOiB0aGlzLFxuXHRcdGVxdWFsc0ZuOiBzdHJ1Y3R1cmFsRXF1YWxzXG5cdH0sIHVuZGVmaW5lZCk7XG5cdGdldCBoaXN0b3J5SXRlbUJhc2VSZWYoKTogSU9ic2VydmFibGU8SVNDTUhpc3RvcnlJdGVtUmVmIHwgdW5kZWZpbmVkPiB7IHJldHVybiB0aGlzLl9oaXN0b3J5SXRlbUJhc2VSZWY7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9oaXN0b3J5SXRlbVJlZkNoYW5nZXMgPSBvYnNlcnZhYmxlVmFsdWU8SVNDTUhpc3RvcnlJdGVtUmVmc0NoYW5nZUV2ZW50Pih0aGlzLCB7IGFkZGVkOiBbXSwgbW9kaWZpZWQ6IFtdLCByZW1vdmVkOiBbXSwgc2lsZW50OiBmYWxzZSB9KTtcblx0Z2V0IGhpc3RvcnlJdGVtUmVmQ2hhbmdlcygpOiBJT2JzZXJ2YWJsZTxJU0NNSGlzdG9yeUl0ZW1SZWZzQ2hhbmdlRXZlbnQ+IHsgcmV0dXJuIHRoaXMuX2hpc3RvcnlJdGVtUmVmQ2hhbmdlczsgfVxuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgcHJveHk6IEV4dEhvc3RTQ01TaGFwZSwgcHJpdmF0ZSByZWFkb25seSBoYW5kbGU6IG51bWJlcikgeyB9XG5cblx0YXN5bmMgcmVzb2x2ZUhpc3RvcnlJdGVtUmVmc0NvbW1vbkFuY2VzdG9yKGhpc3RvcnlJdGVtUmVmczogc3RyaW5nW10pOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLnByb3h5LiRyZXNvbHZlSGlzdG9yeUl0ZW1SZWZzQ29tbW9uQW5jZXN0b3IodGhpcy5oYW5kbGUsIGhpc3RvcnlJdGVtUmVmcywgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdH1cblxuXHRhc3luYyBwcm92aWRlSGlzdG9yeUl0ZW1SZWZzKGhpc3RvcnlJdGVtc1JlZnM/OiBzdHJpbmdbXSk6IFByb21pc2U8SVNDTUhpc3RvcnlJdGVtUmVmW10gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBoaXN0b3J5SXRlbVJlZnMgPSBhd2FpdCB0aGlzLnByb3h5LiRwcm92aWRlSGlzdG9yeUl0ZW1SZWZzKHRoaXMuaGFuZGxlLCBoaXN0b3J5SXRlbXNSZWZzLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRyZXR1cm4gaGlzdG9yeUl0ZW1SZWZzPy5tYXAocmVmID0+ICh7IC4uLnJlZiwgaWNvbjogZ2V0SWNvbkZyb21JY29uRHRvKHJlZi5pY29uKSB9KSk7XG5cdH1cblxuXHRhc3luYyBwcm92aWRlSGlzdG9yeUl0ZW1zKG9wdGlvbnM6IElTQ01IaXN0b3J5T3B0aW9ucyk6IFByb21pc2U8SVNDTUhpc3RvcnlJdGVtW10gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBoaXN0b3J5SXRlbXMgPSBhd2FpdCB0aGlzLnByb3h5LiRwcm92aWRlSGlzdG9yeUl0ZW1zKHRoaXMuaGFuZGxlLCBvcHRpb25zLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRyZXR1cm4gaGlzdG9yeUl0ZW1zPy5tYXAoaGlzdG9yeUl0ZW0gPT4gdG9JU0NNSGlzdG9yeUl0ZW0oaGlzdG9yeUl0ZW0pKTtcblx0fVxuXG5cdGFzeW5jIHByb3ZpZGVIaXN0b3J5SXRlbUNoYW5nZXMoaGlzdG9yeUl0ZW1JZDogc3RyaW5nLCBoaXN0b3J5SXRlbVBhcmVudElkOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBQcm9taXNlPElTQ01IaXN0b3J5SXRlbUNoYW5nZVtdIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgY2hhbmdlcyA9IGF3YWl0IHRoaXMucHJveHkuJHByb3ZpZGVIaXN0b3J5SXRlbUNoYW5nZXModGhpcy5oYW5kbGUsIGhpc3RvcnlJdGVtSWQsIGhpc3RvcnlJdGVtUGFyZW50SWQsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdHJldHVybiBjaGFuZ2VzPy5tYXAoY2hhbmdlID0+ICh7XG5cdFx0XHR1cmk6IFVSSS5yZXZpdmUoY2hhbmdlLnVyaSksXG5cdFx0XHRvcmlnaW5hbFVyaTogY2hhbmdlLm9yaWdpbmFsVXJpICYmIFVSSS5yZXZpdmUoY2hhbmdlLm9yaWdpbmFsVXJpKSxcblx0XHRcdG1vZGlmaWVkVXJpOiBjaGFuZ2UubW9kaWZpZWRVcmkgJiYgVVJJLnJldml2ZShjaGFuZ2UubW9kaWZpZWRVcmkpXG5cdFx0fSkpO1xuXHR9XG5cblx0JG9uRGlkQ2hhbmdlQ3VycmVudEhpc3RvcnlJdGVtUmVmcyhoaXN0b3J5SXRlbVJlZj86IFNDTUhpc3RvcnlJdGVtUmVmRHRvLCBoaXN0b3J5SXRlbVJlbW90ZVJlZj86IFNDTUhpc3RvcnlJdGVtUmVmRHRvLCBoaXN0b3J5SXRlbUJhc2VSZWY/OiBTQ01IaXN0b3J5SXRlbVJlZkR0byk6IHZvaWQge1xuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdHRoaXMuX2hpc3RvcnlJdGVtUmVmLnNldCh0b0lTQ01IaXN0b3J5SXRlbVJlZihoaXN0b3J5SXRlbVJlZiwgaGlzdG9yeUl0ZW1SZWZDb2xvciksIHR4KTtcblx0XHRcdHRoaXMuX2hpc3RvcnlJdGVtUmVtb3RlUmVmLnNldCh0b0lTQ01IaXN0b3J5SXRlbVJlZihoaXN0b3J5SXRlbVJlbW90ZVJlZiwgaGlzdG9yeUl0ZW1SZW1vdGVSZWZDb2xvciksIHR4KTtcblx0XHRcdHRoaXMuX2hpc3RvcnlJdGVtQmFzZVJlZi5zZXQodG9JU0NNSGlzdG9yeUl0ZW1SZWYoaGlzdG9yeUl0ZW1CYXNlUmVmLCBoaXN0b3J5SXRlbUJhc2VSZWZDb2xvciksIHR4KTtcblx0XHR9KTtcblx0fVxuXG5cdCRvbkRpZENoYW5nZUhpc3RvcnlJdGVtUmVmcyhoaXN0b3J5SXRlbVJlZnM6IFNDTUhpc3RvcnlJdGVtUmVmc0NoYW5nZUV2ZW50RHRvKTogdm9pZCB7XG5cdFx0Y29uc3QgYWRkZWQgPSBoaXN0b3J5SXRlbVJlZnMuYWRkZWQubWFwKHJlZiA9PiB0b0lTQ01IaXN0b3J5SXRlbVJlZihyZWYpISk7XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBoaXN0b3J5SXRlbVJlZnMubW9kaWZpZWQubWFwKHJlZiA9PiB0b0lTQ01IaXN0b3J5SXRlbVJlZihyZWYpISk7XG5cdFx0Y29uc3QgcmVtb3ZlZCA9IGhpc3RvcnlJdGVtUmVmcy5yZW1vdmVkLm1hcChyZWYgPT4gdG9JU0NNSGlzdG9yeUl0ZW1SZWYocmVmKSEpO1xuXG5cdFx0dGhpcy5faGlzdG9yeUl0ZW1SZWZDaGFuZ2VzLnNldCh7IGFkZGVkLCBtb2RpZmllZCwgcmVtb3ZlZCwgc2lsZW50OiBoaXN0b3J5SXRlbVJlZnMuc2lsZW50IH0sIHVuZGVmaW5lZCk7XG5cdH1cbn1cblxuY2xhc3MgTWFpblRocmVhZFNDTVByb3ZpZGVyIGltcGxlbWVudHMgSVNDTVByb3ZpZGVyLCBRdWlja0RpZmZQcm92aWRlciB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgSURfSEFORExFID0gMDtcblx0cHJpdmF0ZSBfaWQgPSBgc2NtJHtNYWluVGhyZWFkU0NNUHJvdmlkZXIuSURfSEFORExFKyt9YDtcblx0Z2V0IGlkKCk6IHN0cmluZyB7IHJldHVybiB0aGlzLl9pZDsgfVxuXG5cdHJlYWRvbmx5IGdyb3VwczogTWFpblRocmVhZFNDTVJlc291cmNlR3JvdXBbXSA9IFtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVJlc291cmNlR3JvdXBzID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VSZXNvdXJjZUdyb3VwcyA9IHRoaXMuX29uRGlkQ2hhbmdlUmVzb3VyY2VHcm91cHMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VSZXNvdXJjZXMgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVJlc291cmNlcyA9IHRoaXMuX29uRGlkQ2hhbmdlUmVzb3VyY2VzLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2dyb3Vwc0J5SGFuZGxlOiB7IFtoYW5kbGU6IG51bWJlcl06IE1haW5UaHJlYWRTQ01SZXNvdXJjZUdyb3VwIH0gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG5cdC8vIGdldCBncm91cHMoKTogSVNlcXVlbmNlPElTQ01SZXNvdXJjZUdyb3VwPiB7XG5cdC8vIFx0cmV0dXJuIHtcblx0Ly8gXHRcdGVsZW1lbnRzOiB0aGlzLl9ncm91cHMsXG5cdC8vIFx0XHRvbkRpZFNwbGljZTogdGhpcy5fb25EaWRTcGxpY2UuZXZlbnRcblx0Ly8gXHR9O1xuXG5cdC8vIFx0Ly8gcmV0dXJuIHRoaXMuX2dyb3Vwc1xuXHQvLyBcdC8vIFx0LmZpbHRlcihnID0+IGcucmVzb3VyY2VzLmVsZW1lbnRzLmxlbmd0aCA+IDAgfHwgIWcuZmVhdHVyZXMuaGlkZVdoZW5FbXB0eSk7XG5cdC8vIH1cblxuXG5cdHByaXZhdGUgZmVhdHVyZXM6IFNDTVByb3ZpZGVyRmVhdHVyZXMgPSB7fTtcblxuXHRnZXQgaGFuZGxlKCk6IG51bWJlciB7IHJldHVybiB0aGlzLl9oYW5kbGU7IH1cblx0Z2V0IGxhYmVsKCk6IHN0cmluZyB7IHJldHVybiB0aGlzLl9sYWJlbDsgfVxuXHRnZXQgcm9vdFVyaSgpOiBVUkkgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fcm9vdFVyaTsgfVxuXHRnZXQgaW5wdXRCb3hUZXh0TW9kZWwoKTogSVRleHRNb2RlbCB7IHJldHVybiB0aGlzLl9pbnB1dEJveFRleHRNb2RlbDsgfVxuXHRnZXQgY29udGV4dFZhbHVlKCk6IHN0cmluZyB7IHJldHVybiB0aGlzLl9wcm92aWRlcklkOyB9XG5cblx0Z2V0IGFjY2VwdElucHV0Q29tbWFuZCgpOiBDb21tYW5kIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuZmVhdHVyZXMuYWNjZXB0SW5wdXRDb21tYW5kOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY291bnQgPSBvYnNlcnZhYmxlVmFsdWU8bnVtYmVyIHwgdW5kZWZpbmVkPih0aGlzLCB1bmRlZmluZWQpO1xuXHRnZXQgY291bnQoKSB7IHJldHVybiB0aGlzLl9jb3VudDsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0YXR1c0JhckNvbW1hbmRzID0gb2JzZXJ2YWJsZVZhbHVlPHJlYWRvbmx5IENvbW1hbmRbXSB8IHVuZGVmaW5lZD4odGhpcywgdW5kZWZpbmVkKTtcblx0Z2V0IHN0YXR1c0JhckNvbW1hbmRzKCkgeyByZXR1cm4gdGhpcy5fc3RhdHVzQmFyQ29tbWFuZHM7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9uYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGdldCBuYW1lKCk6IHN0cmluZyB7IHJldHVybiB0aGlzLl9uYW1lID8/IHRoaXMuX2xhYmVsOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY29tbWl0VGVtcGxhdGUgPSBvYnNlcnZhYmxlVmFsdWU8c3RyaW5nPih0aGlzLCAnJyk7XG5cdGdldCBjb21taXRUZW1wbGF0ZSgpIHsgcmV0dXJuIHRoaXMuX2NvbW1pdFRlbXBsYXRlOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYWN0aW9uQnV0dG9uID0gb2JzZXJ2YWJsZVZhbHVlPElTQ01BY3Rpb25CdXR0b25EZXNjcmlwdG9yIHwgdW5kZWZpbmVkPih0aGlzLCB1bmRlZmluZWQpO1xuXHRnZXQgYWN0aW9uQnV0dG9uKCk6IElPYnNlcnZhYmxlPElTQ01BY3Rpb25CdXR0b25EZXNjcmlwdG9yIHwgdW5kZWZpbmVkPiB7IHJldHVybiB0aGlzLl9hY3Rpb25CdXR0b247IH1cblxuXHRwcml2YXRlIF9xdWlja0RpZmY6IElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkO1xuXHRwdWJsaWMgcmVhZG9ubHkgaXNTQ006IGJvb2xlYW4gPSB0cnVlO1xuXHRwdWJsaWMgcmVhZG9ubHkgdmlzaWJsZTogYm9vbGVhbiA9IHRydWU7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaGlzdG9yeVByb3ZpZGVyID0gb2JzZXJ2YWJsZVZhbHVlPE1haW5UaHJlYWRTQ01IaXN0b3J5UHJvdmlkZXIgfCB1bmRlZmluZWQ+KHRoaXMsIHVuZGVmaW5lZCk7XG5cdGdldCBoaXN0b3J5UHJvdmlkZXIoKSB7IHJldHVybiB0aGlzLl9oaXN0b3J5UHJvdmlkZXI7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHByb3h5OiBFeHRIb3N0U0NNU2hhcGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaGFuZGxlOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJvdmlkZXJJZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xhYmVsOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcm9vdFVyaTogVVJJIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2lucHV0Qm94VGV4dE1vZGVsOiBJVGV4dE1vZGVsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3F1aWNrRGlmZlNlcnZpY2U6IElRdWlja0RpZmZTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3VyaUlkZW50U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF93b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlXG5cdCkge1xuXHRcdGlmIChfcm9vdFVyaSkge1xuXHRcdFx0Y29uc3QgZm9sZGVyID0gdGhpcy5fd29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlRm9sZGVyKF9yb290VXJpKTtcblx0XHRcdGlmIChmb2xkZXI/LnVyaS50b1N0cmluZygpID09PSBfcm9vdFVyaS50b1N0cmluZygpKSB7XG5cdFx0XHRcdHRoaXMuX25hbWUgPSBmb2xkZXIubmFtZTtcblx0XHRcdH0gZWxzZSBpZiAoX3Jvb3RVcmkucGF0aCAhPT0gJy8nKSB7XG5cdFx0XHRcdHRoaXMuX25hbWUgPSBiYXNlbmFtZShfcm9vdFVyaSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0JHVwZGF0ZVNvdXJjZUNvbnRyb2woZmVhdHVyZXM6IFNDTVByb3ZpZGVyRmVhdHVyZXMpOiB2b2lkIHtcblx0XHR0aGlzLmZlYXR1cmVzID0geyAuLi50aGlzLmZlYXR1cmVzLCAuLi5mZWF0dXJlcyB9O1xuXG5cdFx0aWYgKHR5cGVvZiBmZWF0dXJlcy5jb21taXRUZW1wbGF0ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHRoaXMuX2NvbW1pdFRlbXBsYXRlLnNldChmZWF0dXJlcy5jb21taXRUZW1wbGF0ZSwgdW5kZWZpbmVkKTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIGZlYXR1cmVzLmFjdGlvbkJ1dHRvbiAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHRoaXMuX2FjdGlvbkJ1dHRvbi5zZXQoZmVhdHVyZXMuYWN0aW9uQnV0dG9uID8/IHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIGZlYXR1cmVzLmNvdW50ICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0dGhpcy5fY291bnQuc2V0KGZlYXR1cmVzLmNvdW50LCB1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgZmVhdHVyZXMuc3RhdHVzQmFyQ29tbWFuZHMgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHR0aGlzLl9zdGF0dXNCYXJDb21tYW5kcy5zZXQoZmVhdHVyZXMuc3RhdHVzQmFyQ29tbWFuZHMsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0aWYgKGZlYXR1cmVzLmhhc1F1aWNrRGlmZlByb3ZpZGVyICYmICF0aGlzLl9xdWlja0RpZmYpIHtcblx0XHRcdHRoaXMuX3F1aWNrRGlmZiA9IHRoaXMuX3F1aWNrRGlmZlNlcnZpY2UuYWRkUXVpY2tEaWZmUHJvdmlkZXIoe1xuXHRcdFx0XHRsYWJlbDogZmVhdHVyZXMucXVpY2tEaWZmTGFiZWwgPz8gdGhpcy5sYWJlbCxcblx0XHRcdFx0cm9vdFVyaTogdGhpcy5yb290VXJpLFxuXHRcdFx0XHRpc1NDTTogdGhpcy5pc1NDTSxcblx0XHRcdFx0dmlzaWJsZTogdGhpcy52aXNpYmxlLFxuXHRcdFx0XHRnZXRPcmlnaW5hbFJlc291cmNlOiAodXJpOiBVUkkpID0+IHRoaXMuZ2V0T3JpZ2luYWxSZXNvdXJjZSh1cmkpXG5cdFx0XHR9KTtcblx0XHR9IGVsc2UgaWYgKGZlYXR1cmVzLmhhc1F1aWNrRGlmZlByb3ZpZGVyID09PSBmYWxzZSAmJiB0aGlzLl9xdWlja0RpZmYpIHtcblx0XHRcdHRoaXMuX3F1aWNrRGlmZi5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9xdWlja0RpZmYgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKGZlYXR1cmVzLmhhc0hpc3RvcnlQcm92aWRlciAmJiAhdGhpcy5oaXN0b3J5UHJvdmlkZXIuZ2V0KCkpIHtcblx0XHRcdGNvbnN0IGhpc3RvcnlQcm92aWRlciA9IG5ldyBNYWluVGhyZWFkU0NNSGlzdG9yeVByb3ZpZGVyKHRoaXMucHJveHksIHRoaXMuaGFuZGxlKTtcblx0XHRcdHRoaXMuX2hpc3RvcnlQcm92aWRlci5zZXQoaGlzdG9yeVByb3ZpZGVyLCB1bmRlZmluZWQpO1xuXHRcdH0gZWxzZSBpZiAoZmVhdHVyZXMuaGFzSGlzdG9yeVByb3ZpZGVyID09PSBmYWxzZSAmJiB0aGlzLmhpc3RvcnlQcm92aWRlci5nZXQoKSkge1xuXHRcdFx0dGhpcy5faGlzdG9yeVByb3ZpZGVyLnNldCh1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0JHJlZ2lzdGVyR3JvdXBzKF9ncm91cHM6IFtudW1iZXIgLypoYW5kbGUqLywgc3RyaW5nIC8qaWQqLywgc3RyaW5nIC8qbGFiZWwqLywgU0NNR3JvdXBGZWF0dXJlcywgLyogbXVsdGlEaWZmRWRpdG9yRW5hYmxlVmlld0NoYW5nZXMgKi8gYm9vbGVhbl1bXSk6IHZvaWQge1xuXHRcdGNvbnN0IGdyb3VwcyA9IF9ncm91cHMubWFwKChbaGFuZGxlLCBpZCwgbGFiZWwsIGZlYXR1cmVzLCBtdWx0aURpZmZFZGl0b3JFbmFibGVWaWV3Q2hhbmdlc10pID0+IHtcblx0XHRcdGNvbnN0IGdyb3VwID0gbmV3IE1haW5UaHJlYWRTQ01SZXNvdXJjZUdyb3VwKFxuXHRcdFx0XHR0aGlzLmhhbmRsZSxcblx0XHRcdFx0aGFuZGxlLFxuXHRcdFx0XHR0aGlzLFxuXHRcdFx0XHRmZWF0dXJlcyxcblx0XHRcdFx0bGFiZWwsXG5cdFx0XHRcdGlkLFxuXHRcdFx0XHRtdWx0aURpZmZFZGl0b3JFbmFibGVWaWV3Q2hhbmdlcyxcblx0XHRcdFx0dGhpcy5fdXJpSWRlbnRTZXJ2aWNlXG5cdFx0XHQpO1xuXG5cdFx0XHR0aGlzLl9ncm91cHNCeUhhbmRsZVtoYW5kbGVdID0gZ3JvdXA7XG5cdFx0XHRyZXR1cm4gZ3JvdXA7XG5cdFx0fSk7XG5cblx0XHR0aGlzLmdyb3Vwcy5zcGxpY2UodGhpcy5ncm91cHMubGVuZ3RoLCAwLCAuLi5ncm91cHMpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlUmVzb3VyY2VHcm91cHMuZmlyZSgpO1xuXHR9XG5cblx0JHVwZGF0ZUdyb3VwKGhhbmRsZTogbnVtYmVyLCBmZWF0dXJlczogU0NNR3JvdXBGZWF0dXJlcyk6IHZvaWQge1xuXHRcdGNvbnN0IGdyb3VwID0gdGhpcy5fZ3JvdXBzQnlIYW5kbGVbaGFuZGxlXTtcblxuXHRcdGlmICghZ3JvdXApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRncm91cC4kdXBkYXRlR3JvdXAoZmVhdHVyZXMpO1xuXHR9XG5cblx0JHVwZGF0ZUdyb3VwTGFiZWwoaGFuZGxlOiBudW1iZXIsIGxhYmVsOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBncm91cCA9IHRoaXMuX2dyb3Vwc0J5SGFuZGxlW2hhbmRsZV07XG5cblx0XHRpZiAoIWdyb3VwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Z3JvdXAuJHVwZGF0ZUdyb3VwTGFiZWwobGFiZWwpO1xuXHR9XG5cblx0JHNwbGljZUdyb3VwUmVzb3VyY2VTdGF0ZXMoc3BsaWNlczogU0NNUmF3UmVzb3VyY2VTcGxpY2VzW10pOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IFtncm91cEhhbmRsZSwgZ3JvdXBTbGljZXNdIG9mIHNwbGljZXMpIHtcblx0XHRcdGNvbnN0IGdyb3VwID0gdGhpcy5fZ3JvdXBzQnlIYW5kbGVbZ3JvdXBIYW5kbGVdO1xuXG5cdFx0XHRpZiAoIWdyb3VwKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybihgU0NNIGdyb3VwICR7Z3JvdXBIYW5kbGV9IG5vdCBmb3VuZCBpbiBwcm92aWRlciAke3RoaXMubGFiZWx9YCk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyByZXZlcnNlIHRoZSBzcGxpY2VzIHNlcXVlbmNlIGluIG9yZGVyIHRvIGFwcGx5IHRoZW0gY29ycmVjdGx5XG5cdFx0XHRncm91cFNsaWNlcy5yZXZlcnNlKCk7XG5cblx0XHRcdGZvciAoY29uc3QgW3N0YXJ0LCBkZWxldGVDb3VudCwgcmF3UmVzb3VyY2VzXSBvZiBncm91cFNsaWNlcykge1xuXHRcdFx0XHRjb25zdCByZXNvdXJjZXMgPSByYXdSZXNvdXJjZXMubWFwKHJhd1Jlc291cmNlID0+IHtcblx0XHRcdFx0XHRjb25zdCBbaGFuZGxlLCBzb3VyY2VVcmksIGljb25zLCB0b29sdGlwLCBzdHJpa2VUaHJvdWdoLCBmYWRlZCwgY29udGV4dFZhbHVlLCBjb21tYW5kLCBtdWx0aURpZmZFZGl0b3JPcmlnaW5hbFVyaSwgbXVsdGlEaWZmRWRpdG9yTW9kaWZpZWRVcmldID0gcmF3UmVzb3VyY2U7XG5cblx0XHRcdFx0XHRjb25zdCBbbGlnaHQsIGRhcmtdID0gaWNvbnM7XG5cdFx0XHRcdFx0Y29uc3QgaWNvbiA9IFRoZW1lSWNvbi5pc1RoZW1lSWNvbihsaWdodCkgPyBsaWdodCA6IFVSSS5yZXZpdmUobGlnaHQpO1xuXHRcdFx0XHRcdGNvbnN0IGljb25EYXJrID0gKFRoZW1lSWNvbi5pc1RoZW1lSWNvbihkYXJrKSA/IGRhcmsgOiBVUkkucmV2aXZlKGRhcmspKSB8fCBpY29uO1xuXG5cdFx0XHRcdFx0Y29uc3QgZGVjb3JhdGlvbnMgPSB7XG5cdFx0XHRcdFx0XHRpY29uOiBpY29uLFxuXHRcdFx0XHRcdFx0aWNvbkRhcms6IGljb25EYXJrLFxuXHRcdFx0XHRcdFx0dG9vbHRpcCxcblx0XHRcdFx0XHRcdHN0cmlrZVRocm91Z2gsXG5cdFx0XHRcdFx0XHRmYWRlZFxuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRyZXR1cm4gbmV3IE1haW5UaHJlYWRTQ01SZXNvdXJjZShcblx0XHRcdFx0XHRcdHRoaXMucHJveHksXG5cdFx0XHRcdFx0XHR0aGlzLmhhbmRsZSxcblx0XHRcdFx0XHRcdGdyb3VwSGFuZGxlLFxuXHRcdFx0XHRcdFx0aGFuZGxlLFxuXHRcdFx0XHRcdFx0VVJJLnJldml2ZShzb3VyY2VVcmkpLFxuXHRcdFx0XHRcdFx0Z3JvdXAsXG5cdFx0XHRcdFx0XHRkZWNvcmF0aW9ucyxcblx0XHRcdFx0XHRcdGNvbnRleHRWYWx1ZSB8fCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRjb21tYW5kLFxuXHRcdFx0XHRcdFx0VVJJLnJldml2ZShtdWx0aURpZmZFZGl0b3JPcmlnaW5hbFVyaSksXG5cdFx0XHRcdFx0XHRVUkkucmV2aXZlKG11bHRpRGlmZkVkaXRvck1vZGlmaWVkVXJpKSxcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRncm91cC5zcGxpY2Uoc3RhcnQsIGRlbGV0ZUNvdW50LCByZXNvdXJjZXMpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlUmVzb3VyY2VzLmZpcmUoKTtcblx0fVxuXG5cdCR1bnJlZ2lzdGVyR3JvdXAoaGFuZGxlOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBncm91cCA9IHRoaXMuX2dyb3Vwc0J5SGFuZGxlW2hhbmRsZV07XG5cblx0XHRpZiAoIWdyb3VwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZGVsZXRlIHRoaXMuX2dyb3Vwc0J5SGFuZGxlW2hhbmRsZV07XG5cdFx0dGhpcy5ncm91cHMuc3BsaWNlKHRoaXMuZ3JvdXBzLmluZGV4T2YoZ3JvdXApLCAxKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVJlc291cmNlR3JvdXBzLmZpcmUoKTtcblx0fVxuXG5cdGFzeW5jIGdldE9yaWdpbmFsUmVzb3VyY2UodXJpOiBVUkkpOiBQcm9taXNlPFVSSSB8IG51bGw+IHtcblx0XHRpZiAoIXRoaXMuZmVhdHVyZXMuaGFzUXVpY2tEaWZmUHJvdmlkZXIpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucHJveHkuJHByb3ZpZGVPcmlnaW5hbFJlc291cmNlKHRoaXMuaGFuZGxlLCB1cmksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdHJldHVybiByZXN1bHQgJiYgVVJJLnJldml2ZShyZXN1bHQpO1xuXHR9XG5cblx0JG9uRGlkQ2hhbmdlSGlzdG9yeVByb3ZpZGVyQ3VycmVudEhpc3RvcnlJdGVtUmVmcyhoaXN0b3J5SXRlbVJlZj86IFNDTUhpc3RvcnlJdGVtUmVmRHRvLCBoaXN0b3J5SXRlbVJlbW90ZVJlZj86IFNDTUhpc3RvcnlJdGVtUmVmRHRvLCBoaXN0b3J5SXRlbUJhc2VSZWY/OiBTQ01IaXN0b3J5SXRlbVJlZkR0byk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5oaXN0b3J5UHJvdmlkZXIuZ2V0KCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9oaXN0b3J5UHJvdmlkZXIuZ2V0KCk/LiRvbkRpZENoYW5nZUN1cnJlbnRIaXN0b3J5SXRlbVJlZnMoaGlzdG9yeUl0ZW1SZWYsIGhpc3RvcnlJdGVtUmVtb3RlUmVmLCBoaXN0b3J5SXRlbUJhc2VSZWYpO1xuXHR9XG5cblx0JG9uRGlkQ2hhbmdlSGlzdG9yeVByb3ZpZGVySGlzdG9yeUl0ZW1SZWZzKGhpc3RvcnlJdGVtUmVmczogU0NNSGlzdG9yeUl0ZW1SZWZzQ2hhbmdlRXZlbnREdG8pOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaGlzdG9yeVByb3ZpZGVyLmdldCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5faGlzdG9yeVByb3ZpZGVyLmdldCgpPy4kb25EaWRDaGFuZ2VIaXN0b3J5SXRlbVJlZnMoaGlzdG9yeUl0ZW1SZWZzKTtcblx0fVxuXG5cdHRvSlNPTigpOiBhbnkge1xuXHRcdHJldHVybiB7XG5cdFx0XHQkbWlkOiBNYXJzaGFsbGVkSWQuU2NtUHJvdmlkZXIsXG5cdFx0XHRoYW5kbGU6IHRoaXMuaGFuZGxlXG5cdFx0fTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fcXVpY2tEaWZmPy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuQGV4dEhvc3ROYW1lZEN1c3RvbWVyKE1haW5Db250ZXh0Lk1haW5UaHJlYWRTQ00pXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZFNDTSBpbXBsZW1lbnRzIE1haW5UaHJlYWRTQ01TaGFwZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IEV4dEhvc3RTQ01TaGFwZTtcblx0cHJpdmF0ZSBfcmVwb3NpdG9yaWVzID0gbmV3IE1hcDxudW1iZXIsIElTQ01SZXBvc2l0b3J5PigpO1xuXHRwcml2YXRlIF9yZXBvc2l0b3J5QmFycmllcnMgPSBuZXcgTWFwPG51bWJlciwgQmFycmllcj4oKTtcblx0cHJpdmF0ZSBfcmVwb3NpdG9yeURpc3Bvc2FibGVzID0gbmV3IE1hcDxudW1iZXIsIElEaXNwb3NhYmxlPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRleHRIb3N0Q29udGV4dDogSUV4dEhvc3RDb250ZXh0LFxuXHRcdEBJU0NNU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHNjbVNlcnZpY2U6IElTQ01TZXJ2aWNlLFxuXHRcdEBJU0NNVmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzY21WaWV3U2VydmljZTogSVNDTVZpZXdTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJUXVpY2tEaWZmU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrRGlmZlNlcnZpY2U6IElRdWlja0RpZmZTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3VyaUlkZW50U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZVxuXHQpIHtcblx0XHR0aGlzLl9wcm94eSA9IGV4dEhvc3RDb250ZXh0LmdldFByb3h5KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RTQ00pO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKG5ldyBTQ01JbnB1dEJveENvbnRlbnRQcm92aWRlcih0aGlzLnRleHRNb2RlbFNlcnZpY2UsIHRoaXMubW9kZWxTZXJ2aWNlLCB0aGlzLmxhbmd1YWdlU2VydmljZSkpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRkaXNwb3NlKHRoaXMuX3JlcG9zaXRvcmllcy52YWx1ZXMoKSk7XG5cdFx0dGhpcy5fcmVwb3NpdG9yaWVzLmNsZWFyKCk7XG5cblx0XHRkaXNwb3NlKHRoaXMuX3JlcG9zaXRvcnlEaXNwb3NhYmxlcy52YWx1ZXMoKSk7XG5cdFx0dGhpcy5fcmVwb3NpdG9yeURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cblxuXHRhc3luYyAkcmVnaXN0ZXJTb3VyY2VDb250cm9sKGhhbmRsZTogbnVtYmVyLCBpZDogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCByb290VXJpOiBVcmlDb21wb25lbnRzIHwgdW5kZWZpbmVkLCBpbnB1dEJveERvY3VtZW50VXJpOiBVcmlDb21wb25lbnRzKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fcmVwb3NpdG9yeUJhcnJpZXJzLnNldChoYW5kbGUsIG5ldyBCYXJyaWVyKCkpO1xuXG5cdFx0Y29uc3QgaW5wdXRCb3hUZXh0TW9kZWxSZWYgPSBhd2FpdCB0aGlzLnRleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UoVVJJLnJldml2ZShpbnB1dEJveERvY3VtZW50VXJpKSk7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgTWFpblRocmVhZFNDTVByb3ZpZGVyKHRoaXMuX3Byb3h5LCBoYW5kbGUsIGlkLCBsYWJlbCwgcm9vdFVyaSA/IFVSSS5yZXZpdmUocm9vdFVyaSkgOiB1bmRlZmluZWQsIGlucHV0Qm94VGV4dE1vZGVsUmVmLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwsIHRoaXMucXVpY2tEaWZmU2VydmljZSwgdGhpcy5fdXJpSWRlbnRTZXJ2aWNlLCB0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0gdGhpcy5zY21TZXJ2aWNlLnJlZ2lzdGVyU0NNUHJvdmlkZXIocHJvdmlkZXIpO1xuXHRcdHRoaXMuX3JlcG9zaXRvcmllcy5zZXQoaGFuZGxlLCByZXBvc2l0b3J5KTtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBjb21iaW5lZERpc3Bvc2FibGUoXG5cdFx0XHRpbnB1dEJveFRleHRNb2RlbFJlZixcblx0XHRcdEV2ZW50LmZpbHRlcih0aGlzLnNjbVZpZXdTZXJ2aWNlLm9uRGlkRm9jdXNSZXBvc2l0b3J5LCByID0+IHIgPT09IHJlcG9zaXRvcnkpKF8gPT4gdGhpcy5fcHJveHkuJHNldFNlbGVjdGVkU291cmNlQ29udHJvbChoYW5kbGUpKSxcblx0XHRcdHJlcG9zaXRvcnkuaW5wdXQub25EaWRDaGFuZ2UoKHsgdmFsdWUgfSkgPT4gdGhpcy5fcHJveHkuJG9uSW5wdXRCb3hWYWx1ZUNoYW5nZShoYW5kbGUsIHZhbHVlKSlcblx0XHQpO1xuXHRcdHRoaXMuX3JlcG9zaXRvcnlEaXNwb3NhYmxlcy5zZXQoaGFuZGxlLCBkaXNwb3NhYmxlKTtcblxuXHRcdGlmICh0aGlzLnNjbVZpZXdTZXJ2aWNlLmZvY3VzZWRSZXBvc2l0b3J5ID09PSByZXBvc2l0b3J5KSB7XG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHRoaXMuX3Byb3h5LiRzZXRTZWxlY3RlZFNvdXJjZUNvbnRyb2woaGFuZGxlKSwgMCk7XG5cdFx0fVxuXG5cdFx0aWYgKHJlcG9zaXRvcnkuaW5wdXQudmFsdWUpIHtcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fcHJveHkuJG9uSW5wdXRCb3hWYWx1ZUNoYW5nZShoYW5kbGUsIHJlcG9zaXRvcnkuaW5wdXQudmFsdWUpLCAwKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZXBvc2l0b3J5QmFycmllcnMuZ2V0KGhhbmRsZSk/Lm9wZW4oKTtcblx0fVxuXG5cdGFzeW5jICR1cGRhdGVTb3VyY2VDb250cm9sKGhhbmRsZTogbnVtYmVyLCBmZWF0dXJlczogU0NNUHJvdmlkZXJGZWF0dXJlcyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX3JlcG9zaXRvcnlCYXJyaWVycy5nZXQoaGFuZGxlKT8ud2FpdCgpO1xuXHRcdGNvbnN0IHJlcG9zaXRvcnkgPSB0aGlzLl9yZXBvc2l0b3JpZXMuZ2V0KGhhbmRsZSk7XG5cblx0XHRpZiAoIXJlcG9zaXRvcnkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwcm92aWRlciA9IHJlcG9zaXRvcnkucHJvdmlkZXIgYXMgTWFpblRocmVhZFNDTVByb3ZpZGVyO1xuXHRcdHByb3ZpZGVyLiR1cGRhdGVTb3VyY2VDb250cm9sKGZlYXR1cmVzKTtcblx0fVxuXG5cdGFzeW5jICR1bnJlZ2lzdGVyU291cmNlQ29udHJvbChoYW5kbGU6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX3JlcG9zaXRvcnlCYXJyaWVycy5nZXQoaGFuZGxlKT8ud2FpdCgpO1xuXHRcdGNvbnN0IHJlcG9zaXRvcnkgPSB0aGlzLl9yZXBvc2l0b3JpZXMuZ2V0KGhhbmRsZSk7XG5cblx0XHRpZiAoIXJlcG9zaXRvcnkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9yZXBvc2l0b3J5RGlzcG9zYWJsZXMuZ2V0KGhhbmRsZSkhLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9yZXBvc2l0b3J5RGlzcG9zYWJsZXMuZGVsZXRlKGhhbmRsZSk7XG5cblx0XHRyZXBvc2l0b3J5LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9yZXBvc2l0b3JpZXMuZGVsZXRlKGhhbmRsZSk7XG5cdH1cblxuXHRhc3luYyAkcmVnaXN0ZXJHcm91cHMoc291cmNlQ29udHJvbEhhbmRsZTogbnVtYmVyLCBncm91cHM6IFtudW1iZXIgLypoYW5kbGUqLywgc3RyaW5nIC8qaWQqLywgc3RyaW5nIC8qbGFiZWwqLywgU0NNR3JvdXBGZWF0dXJlcywgLyogbXVsdGlEaWZmRWRpdG9yRW5hYmxlVmlld0NoYW5nZXMgKi8gYm9vbGVhbl1bXSwgc3BsaWNlczogU0NNUmF3UmVzb3VyY2VTcGxpY2VzW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9yZXBvc2l0b3J5QmFycmllcnMuZ2V0KHNvdXJjZUNvbnRyb2xIYW5kbGUpPy53YWl0KCk7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeSA9IHRoaXMuX3JlcG9zaXRvcmllcy5nZXQoc291cmNlQ29udHJvbEhhbmRsZSk7XG5cblx0XHRpZiAoIXJlcG9zaXRvcnkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwcm92aWRlciA9IHJlcG9zaXRvcnkucHJvdmlkZXIgYXMgTWFpblRocmVhZFNDTVByb3ZpZGVyO1xuXHRcdHByb3ZpZGVyLiRyZWdpc3Rlckdyb3Vwcyhncm91cHMpO1xuXHRcdHByb3ZpZGVyLiRzcGxpY2VHcm91cFJlc291cmNlU3RhdGVzKHNwbGljZXMpO1xuXHR9XG5cblx0YXN5bmMgJHVwZGF0ZUdyb3VwKHNvdXJjZUNvbnRyb2xIYW5kbGU6IG51bWJlciwgZ3JvdXBIYW5kbGU6IG51bWJlciwgZmVhdHVyZXM6IFNDTUdyb3VwRmVhdHVyZXMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9yZXBvc2l0b3J5QmFycmllcnMuZ2V0KHNvdXJjZUNvbnRyb2xIYW5kbGUpPy53YWl0KCk7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeSA9IHRoaXMuX3JlcG9zaXRvcmllcy5nZXQoc291cmNlQ29udHJvbEhhbmRsZSk7XG5cblx0XHRpZiAoIXJlcG9zaXRvcnkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwcm92aWRlciA9IHJlcG9zaXRvcnkucHJvdmlkZXIgYXMgTWFpblRocmVhZFNDTVByb3ZpZGVyO1xuXHRcdHByb3ZpZGVyLiR1cGRhdGVHcm91cChncm91cEhhbmRsZSwgZmVhdHVyZXMpO1xuXHR9XG5cblx0YXN5bmMgJHVwZGF0ZUdyb3VwTGFiZWwoc291cmNlQ29udHJvbEhhbmRsZTogbnVtYmVyLCBncm91cEhhbmRsZTogbnVtYmVyLCBsYWJlbDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fcmVwb3NpdG9yeUJhcnJpZXJzLmdldChzb3VyY2VDb250cm9sSGFuZGxlKT8ud2FpdCgpO1xuXHRcdGNvbnN0IHJlcG9zaXRvcnkgPSB0aGlzLl9yZXBvc2l0b3JpZXMuZ2V0KHNvdXJjZUNvbnRyb2xIYW5kbGUpO1xuXG5cdFx0aWYgKCFyZXBvc2l0b3J5KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSByZXBvc2l0b3J5LnByb3ZpZGVyIGFzIE1haW5UaHJlYWRTQ01Qcm92aWRlcjtcblx0XHRwcm92aWRlci4kdXBkYXRlR3JvdXBMYWJlbChncm91cEhhbmRsZSwgbGFiZWwpO1xuXHR9XG5cblx0YXN5bmMgJHNwbGljZVJlc291cmNlU3RhdGVzKHNvdXJjZUNvbnRyb2xIYW5kbGU6IG51bWJlciwgc3BsaWNlczogU0NNUmF3UmVzb3VyY2VTcGxpY2VzW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9yZXBvc2l0b3J5QmFycmllcnMuZ2V0KHNvdXJjZUNvbnRyb2xIYW5kbGUpPy53YWl0KCk7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeSA9IHRoaXMuX3JlcG9zaXRvcmllcy5nZXQoc291cmNlQ29udHJvbEhhbmRsZSk7XG5cblx0XHRpZiAoIXJlcG9zaXRvcnkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwcm92aWRlciA9IHJlcG9zaXRvcnkucHJvdmlkZXIgYXMgTWFpblRocmVhZFNDTVByb3ZpZGVyO1xuXHRcdHByb3ZpZGVyLiRzcGxpY2VHcm91cFJlc291cmNlU3RhdGVzKHNwbGljZXMpO1xuXHR9XG5cblx0YXN5bmMgJHVucmVnaXN0ZXJHcm91cChzb3VyY2VDb250cm9sSGFuZGxlOiBudW1iZXIsIGhhbmRsZTogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fcmVwb3NpdG9yeUJhcnJpZXJzLmdldChzb3VyY2VDb250cm9sSGFuZGxlKT8ud2FpdCgpO1xuXHRcdGNvbnN0IHJlcG9zaXRvcnkgPSB0aGlzLl9yZXBvc2l0b3JpZXMuZ2V0KHNvdXJjZUNvbnRyb2xIYW5kbGUpO1xuXG5cdFx0aWYgKCFyZXBvc2l0b3J5KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSByZXBvc2l0b3J5LnByb3ZpZGVyIGFzIE1haW5UaHJlYWRTQ01Qcm92aWRlcjtcblx0XHRwcm92aWRlci4kdW5yZWdpc3Rlckdyb3VwKGhhbmRsZSk7XG5cdH1cblxuXHRhc3luYyAkc2V0SW5wdXRCb3hWYWx1ZShzb3VyY2VDb250cm9sSGFuZGxlOiBudW1iZXIsIHZhbHVlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9yZXBvc2l0b3J5QmFycmllcnMuZ2V0KHNvdXJjZUNvbnRyb2xIYW5kbGUpPy53YWl0KCk7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeSA9IHRoaXMuX3JlcG9zaXRvcmllcy5nZXQoc291cmNlQ29udHJvbEhhbmRsZSk7XG5cblx0XHRpZiAoIXJlcG9zaXRvcnkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXBvc2l0b3J5LmlucHV0LnNldFZhbHVlKHZhbHVlLCBmYWxzZSk7XG5cdH1cblxuXHRhc3luYyAkc2V0SW5wdXRCb3hQbGFjZWhvbGRlcihzb3VyY2VDb250cm9sSGFuZGxlOiBudW1iZXIsIHBsYWNlaG9sZGVyOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9yZXBvc2l0b3J5QmFycmllcnMuZ2V0KHNvdXJjZUNvbnRyb2xIYW5kbGUpPy53YWl0KCk7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeSA9IHRoaXMuX3JlcG9zaXRvcmllcy5nZXQoc291cmNlQ29udHJvbEhhbmRsZSk7XG5cblx0XHRpZiAoIXJlcG9zaXRvcnkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXBvc2l0b3J5LmlucHV0LnBsYWNlaG9sZGVyID0gcGxhY2Vob2xkZXI7XG5cdH1cblxuXHRhc3luYyAkc2V0SW5wdXRCb3hFbmFibGVtZW50KHNvdXJjZUNvbnRyb2xIYW5kbGU6IG51bWJlciwgZW5hYmxlZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX3JlcG9zaXRvcnlCYXJyaWVycy5nZXQoc291cmNlQ29udHJvbEhhbmRsZSk/LndhaXQoKTtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0gdGhpcy5fcmVwb3NpdG9yaWVzLmdldChzb3VyY2VDb250cm9sSGFuZGxlKTtcblxuXHRcdGlmICghcmVwb3NpdG9yeSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJlcG9zaXRvcnkuaW5wdXQuZW5hYmxlZCA9IGVuYWJsZWQ7XG5cdH1cblxuXHRhc3luYyAkc2V0SW5wdXRCb3hWaXNpYmlsaXR5KHNvdXJjZUNvbnRyb2xIYW5kbGU6IG51bWJlciwgdmlzaWJsZTogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX3JlcG9zaXRvcnlCYXJyaWVycy5nZXQoc291cmNlQ29udHJvbEhhbmRsZSk/LndhaXQoKTtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0gdGhpcy5fcmVwb3NpdG9yaWVzLmdldChzb3VyY2VDb250cm9sSGFuZGxlKTtcblxuXHRcdGlmICghcmVwb3NpdG9yeSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJlcG9zaXRvcnkuaW5wdXQudmlzaWJsZSA9IHZpc2libGU7XG5cdH1cblxuXHRhc3luYyAkc2hvd1ZhbGlkYXRpb25NZXNzYWdlKHNvdXJjZUNvbnRyb2xIYW5kbGU6IG51bWJlciwgbWVzc2FnZTogc3RyaW5nIHwgSU1hcmtkb3duU3RyaW5nLCB0eXBlOiBJbnB1dFZhbGlkYXRpb25UeXBlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fcmVwb3NpdG9yeUJhcnJpZXJzLmdldChzb3VyY2VDb250cm9sSGFuZGxlKT8ud2FpdCgpO1xuXHRcdGNvbnN0IHJlcG9zaXRvcnkgPSB0aGlzLl9yZXBvc2l0b3JpZXMuZ2V0KHNvdXJjZUNvbnRyb2xIYW5kbGUpO1xuXHRcdGlmICghcmVwb3NpdG9yeSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJlcG9zaXRvcnkuaW5wdXQuc2hvd1ZhbGlkYXRpb25NZXNzYWdlKG1lc3NhZ2UsIHR5cGUpO1xuXHR9XG5cblx0YXN5bmMgJHNldFZhbGlkYXRpb25Qcm92aWRlcklzRW5hYmxlZChzb3VyY2VDb250cm9sSGFuZGxlOiBudW1iZXIsIGVuYWJsZWQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9yZXBvc2l0b3J5QmFycmllcnMuZ2V0KHNvdXJjZUNvbnRyb2xIYW5kbGUpPy53YWl0KCk7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeSA9IHRoaXMuX3JlcG9zaXRvcmllcy5nZXQoc291cmNlQ29udHJvbEhhbmRsZSk7XG5cblx0XHRpZiAoIXJlcG9zaXRvcnkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoZW5hYmxlZCkge1xuXHRcdFx0cmVwb3NpdG9yeS5pbnB1dC52YWxpZGF0ZUlucHV0ID0gYXN5bmMgKHZhbHVlLCBwb3MpOiBQcm9taXNlPElJbnB1dFZhbGlkYXRpb24gfCB1bmRlZmluZWQ+ID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5fcHJveHkuJHZhbGlkYXRlSW5wdXQoc291cmNlQ29udHJvbEhhbmRsZSwgdmFsdWUsIHBvcyk7XG5cdFx0XHRcdHJldHVybiByZXN1bHQgJiYgeyBtZXNzYWdlOiByZXN1bHRbMF0sIHR5cGU6IHJlc3VsdFsxXSB9O1xuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVwb3NpdG9yeS5pbnB1dC52YWxpZGF0ZUlucHV0ID0gYXN5bmMgKCkgPT4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jICRvbkRpZENoYW5nZUhpc3RvcnlQcm92aWRlckN1cnJlbnRIaXN0b3J5SXRlbVJlZnMoc291cmNlQ29udHJvbEhhbmRsZTogbnVtYmVyLCBoaXN0b3J5SXRlbVJlZj86IFNDTUhpc3RvcnlJdGVtUmVmRHRvLCBoaXN0b3J5SXRlbVJlbW90ZVJlZj86IFNDTUhpc3RvcnlJdGVtUmVmRHRvLCBoaXN0b3J5SXRlbUJhc2VSZWY/OiBTQ01IaXN0b3J5SXRlbVJlZkR0byk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX3JlcG9zaXRvcnlCYXJyaWVycy5nZXQoc291cmNlQ29udHJvbEhhbmRsZSk/LndhaXQoKTtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0gdGhpcy5fcmVwb3NpdG9yaWVzLmdldChzb3VyY2VDb250cm9sSGFuZGxlKTtcblxuXHRcdGlmICghcmVwb3NpdG9yeSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gcmVwb3NpdG9yeS5wcm92aWRlciBhcyBNYWluVGhyZWFkU0NNUHJvdmlkZXI7XG5cdFx0cHJvdmlkZXIuJG9uRGlkQ2hhbmdlSGlzdG9yeVByb3ZpZGVyQ3VycmVudEhpc3RvcnlJdGVtUmVmcyhoaXN0b3J5SXRlbVJlZiwgaGlzdG9yeUl0ZW1SZW1vdGVSZWYsIGhpc3RvcnlJdGVtQmFzZVJlZik7XG5cdH1cblxuXHRhc3luYyAkb25EaWRDaGFuZ2VIaXN0b3J5UHJvdmlkZXJIaXN0b3J5SXRlbVJlZnMoc291cmNlQ29udHJvbEhhbmRsZTogbnVtYmVyLCBoaXN0b3J5SXRlbVJlZnM6IFNDTUhpc3RvcnlJdGVtUmVmc0NoYW5nZUV2ZW50RHRvKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fcmVwb3NpdG9yeUJhcnJpZXJzLmdldChzb3VyY2VDb250cm9sSGFuZGxlKT8ud2FpdCgpO1xuXHRcdGNvbnN0IHJlcG9zaXRvcnkgPSB0aGlzLl9yZXBvc2l0b3JpZXMuZ2V0KHNvdXJjZUNvbnRyb2xIYW5kbGUpO1xuXG5cdFx0aWYgKCFyZXBvc2l0b3J5KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSByZXBvc2l0b3J5LnByb3ZpZGVyIGFzIE1haW5UaHJlYWRTQ01Qcm92aWRlcjtcblx0XHRwcm92aWRlci4kb25EaWRDaGFuZ2VIaXN0b3J5UHJvdmlkZXJIaXN0b3J5SXRlbVJlZnMoaGlzdG9yeUl0ZW1SZWZzKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUIsV0FBMEI7QUFDcEQsU0FBUyxPQUFPLGVBQWU7QUFDL0IsU0FBc0IsaUJBQWlCLHFCQUFxQixtQkFBbUI7QUFDL0UsU0FBc0IsaUJBQWlCLG9CQUFvQixTQUFTLGtCQUFrQjtBQUN0RixTQUFTLGFBQXVILHVCQUF3RTtBQUN4TSxTQUFTLGdCQUFtSCxtQkFBOEY7QUFFMU4sU0FBUyw0QkFBNkM7QUFDdEQsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxpQkFBaUI7QUFFMUIsU0FBUyx5QkFBNEM7QUFFckQsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxnQkFBZ0I7QUFD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
