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
import * as glob from "../../../../base/common/glob.js";
import { distinct, insert } from "../../../../base/common/arrays.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { basename, extname, isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { EditorActivation, EditorResolution } from "../../../../platform/editor/common/editor.js";
import { DEFAULT_EDITOR_ASSOCIATION, EditorResourceAccessor, isEditorInputWithOptions, isEditorInputWithOptionsAndGroup, isResourceDiffEditorInput, isResourceSideBySideEditorInput, isUntitledResourceEditorInput, isResourceMergeEditorInput, SideBySideEditor, isResourceMultiDiffEditorInput } from "../../../common/editor.js";
import { IEditorGroupsService } from "../common/editorGroupsService.js";
import { Schemas } from "../../../../base/common/network.js";
import { RegisteredEditorPriority, editorsAssociationsSettingId, globMatchesResource, IEditorResolverService, priorityToRank, ResolvedStatus } from "../common/editorResolverService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { localize } from "../../../../nls.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { findGroup } from "../common/editorGroupFinder.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { SideBySideEditorInput } from "../../../common/editor/sideBySideEditorInput.js";
import { PauseableEmitter } from "../../../../base/common/event.js";
let EditorResolverService = class extends Disposable {
  constructor(editorGroupService, instantiationService, configurationService, quickInputService, notificationService, storageService, extensionService, logService) {
    super();
    this.editorGroupService = editorGroupService;
    this.instantiationService = instantiationService;
    this.configurationService = configurationService;
    this.quickInputService = quickInputService;
    this.notificationService = notificationService;
    this.storageService = storageService;
    this.extensionService = extensionService;
    this.logService = logService;
    // Events
    this._onDidChangeEditorRegistrations = this._register(new PauseableEmitter());
    this.onDidChangeEditorRegistrations = this._onDidChangeEditorRegistrations.event;
    // Data Stores
    this._editors = /* @__PURE__ */ new Map();
    this._flattenedEditors = /* @__PURE__ */ new Map();
    this._shouldReFlattenEditors = true;
    this.cache = new Set(JSON.parse(this.storageService.get(EditorResolverService.cacheStorageID, StorageScope.PROFILE, JSON.stringify([]))));
    this.storageService.remove(EditorResolverService.cacheStorageID, StorageScope.PROFILE);
    this._register(this.storageService.onWillSaveState(() => {
      this.cacheEditors();
    }));
    this._register(this.extensionService.onDidRegisterExtensions(() => {
      this.cache = void 0;
    }));
  }
  resolveUntypedInputAndGroup(editor, preferredGroup) {
    const untypedEditor = editor;
    const findGroupResult = this.instantiationService.invokeFunction(findGroup, untypedEditor, preferredGroup);
    if (findGroupResult instanceof Promise) {
      return findGroupResult.then(([group, activation]) => [untypedEditor, group, activation]);
    } else {
      const [group, activation] = findGroupResult;
      return [untypedEditor, group, activation];
    }
  }
  async resolveEditor(editor, preferredGroup) {
    this._flattenedEditors = this._flattenEditorsMap();
    if (isResourceSideBySideEditorInput(editor)) {
      return this.doResolveSideBySideEditor(editor, preferredGroup);
    }
    let resolvedUntypedAndGroup;
    const resolvedUntypedAndGroupResult = this.resolveUntypedInputAndGroup(editor, preferredGroup);
    if (resolvedUntypedAndGroupResult instanceof Promise) {
      resolvedUntypedAndGroup = await resolvedUntypedAndGroupResult;
    } else {
      resolvedUntypedAndGroup = resolvedUntypedAndGroupResult;
    }
    if (!resolvedUntypedAndGroup) {
      return ResolvedStatus.NONE;
    }
    const [untypedEditor, group, activation] = resolvedUntypedAndGroup;
    if (activation) {
      untypedEditor.options = { ...untypedEditor.options, activation };
    }
    let resource = EditorResourceAccessor.getCanonicalUri(untypedEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (this.cache && resource && this.resourceMatchesCache(resource)) {
      await this.extensionService.whenInstalledExtensionsRegistered();
    }
    if (resource === void 0) {
      resource = URI.from({ scheme: Schemas.untitled });
    } else if (resource.scheme === void 0 || resource === null) {
      return ResolvedStatus.NONE;
    }
    if (untypedEditor.options?.override === EditorResolution.PICK) {
      const picked = await this.doPickEditor(untypedEditor);
      if (!picked) {
        return ResolvedStatus.ABORT;
      }
      untypedEditor.options = picked;
    }
    let { editor: selectedEditor, conflictingDefault } = this.getEditor(resource, untypedEditor.options?.override);
    if (!selectedEditor && (untypedEditor.options?.override || isEditorInputWithOptions(editor))) {
      return ResolvedStatus.NONE;
    } else if (!selectedEditor) {
      const resolvedEditor = this.getEditor(resource, DEFAULT_EDITOR_ASSOCIATION.id);
      selectedEditor = resolvedEditor?.editor;
      conflictingDefault = resolvedEditor?.conflictingDefault;
      if (!selectedEditor) {
        return ResolvedStatus.NONE;
      }
    }
    if (isResourceDiffEditorInput(untypedEditor) && untypedEditor.options?.override === void 0) {
      let resource2 = EditorResourceAccessor.getCanonicalUri(untypedEditor, { supportSideBySide: SideBySideEditor.SECONDARY });
      if (!resource2) {
        resource2 = URI.from({ scheme: Schemas.untitled });
      }
      const { editor: selectedEditor2 } = this.getEditor(resource2, void 0);
      if (!selectedEditor2 || selectedEditor.editorInfo.id !== selectedEditor2.editorInfo.id) {
        const { editor: selectedDiff, conflictingDefault: conflictingDefaultDiff } = this.getEditor(resource, DEFAULT_EDITOR_ASSOCIATION.id);
        selectedEditor = selectedDiff;
        conflictingDefault = conflictingDefaultDiff;
      }
      if (!selectedEditor) {
        return ResolvedStatus.NONE;
      }
    }
    untypedEditor.options = { override: selectedEditor.editorInfo.id, ...untypedEditor.options };
    if (selectedEditor.editorFactoryObject.createDiffEditorInput === void 0 && isResourceDiffEditorInput(untypedEditor)) {
      return ResolvedStatus.NONE;
    }
    const input = await this.doResolveEditor(untypedEditor, group, selectedEditor);
    if (conflictingDefault && input) {
      await this.doHandleConflictingDefaults(resource, selectedEditor.editorInfo.label, untypedEditor, input.editor, group);
    }
    if (input) {
      if (input.editor.editorId !== selectedEditor.editorInfo.id) {
        this.logService.warn(`Editor ID Mismatch: ${input.editor.editorId} !== ${selectedEditor.editorInfo.id}. This will cause bugs. Please ensure editorInput.editorId matches the registered id`);
      }
      return { ...input, group };
    }
    return ResolvedStatus.ABORT;
  }
  async doResolveSideBySideEditor(editor, preferredGroup) {
    const primaryResolvedEditor = await this.resolveEditor(editor.primary, preferredGroup);
    if (!isEditorInputWithOptionsAndGroup(primaryResolvedEditor)) {
      return ResolvedStatus.NONE;
    }
    const secondaryResolvedEditor = await this.resolveEditor(editor.secondary, primaryResolvedEditor.group ?? preferredGroup);
    if (!isEditorInputWithOptionsAndGroup(secondaryResolvedEditor)) {
      return ResolvedStatus.NONE;
    }
    return {
      group: primaryResolvedEditor.group ?? secondaryResolvedEditor.group,
      editor: this.instantiationService.createInstance(SideBySideEditorInput, editor.label, editor.description, secondaryResolvedEditor.editor, primaryResolvedEditor.editor),
      options: editor.options
    };
  }
  bufferChangeEvents(callback) {
    this._onDidChangeEditorRegistrations.pause();
    try {
      callback();
    } finally {
      this._onDidChangeEditorRegistrations.resume();
    }
  }
  registerEditor(globPattern, editorInfo, options, editorFactoryObject) {
    let registeredEditor = this._editors.get(globPattern);
    if (registeredEditor === void 0) {
      registeredEditor = /* @__PURE__ */ new Map();
      this._editors.set(globPattern, registeredEditor);
    }
    let editorsWithId = registeredEditor.get(editorInfo.id);
    if (editorsWithId === void 0) {
      editorsWithId = [];
    }
    const remove = insert(editorsWithId, {
      globPattern,
      editorInfo,
      options,
      editorFactoryObject
    });
    registeredEditor.set(editorInfo.id, editorsWithId);
    this._shouldReFlattenEditors = true;
    this._onDidChangeEditorRegistrations.fire();
    return toDisposable(() => {
      remove();
      if (editorsWithId && editorsWithId.length === 0) {
        registeredEditor?.delete(editorInfo.id);
      }
      this._shouldReFlattenEditors = true;
      this._onDidChangeEditorRegistrations.fire();
    });
  }
  getAssociationsForResource(resource) {
    const associations = this.getAllUserAssociations();
    let matchingAssociations = associations.filter((association) => association.filenamePattern && globMatchesResource(association.filenamePattern, resource));
    matchingAssociations = matchingAssociations.sort((a, b) => (b.filenamePattern?.length ?? 0) - (a.filenamePattern?.length ?? 0));
    const allEditors = this._registeredEditors;
    return matchingAssociations.filter((association) => allEditors.find((c) => c.editorInfo.id === association.viewType));
  }
  getAllUserAssociations() {
    const inspectedEditorAssociations = this.configurationService.inspect(editorsAssociationsSettingId) || {};
    const defaultAssociations = inspectedEditorAssociations.defaultValue ?? {};
    const workspaceAssociations = inspectedEditorAssociations.workspaceValue ?? {};
    const userAssociations = inspectedEditorAssociations.userValue ?? {};
    const rawAssociations = { ...workspaceAssociations };
    for (const [key, value] of Object.entries({ ...defaultAssociations, ...userAssociations })) {
      if (rawAssociations[key] === void 0) {
        rawAssociations[key] = value;
      }
    }
    const associations = [];
    for (const [key, value] of Object.entries(rawAssociations)) {
      const association = {
        filenamePattern: key,
        viewType: value
      };
      associations.push(association);
    }
    return associations;
  }
  /**
   * Given the nested nature of the editors map, we merge factories of the same glob and id to make it flat
   * and easier to work with
   */
  _flattenEditorsMap() {
    if (!this._shouldReFlattenEditors) {
      return this._flattenedEditors;
    }
    this._shouldReFlattenEditors = false;
    const editors = /* @__PURE__ */ new Map();
    for (const [glob2, value] of this._editors) {
      const registeredEditors = [];
      for (const editors2 of value.values()) {
        let registeredEditor = void 0;
        for (const editor of editors2) {
          if (!registeredEditor) {
            registeredEditor = {
              editorInfo: editor.editorInfo,
              globPattern: editor.globPattern,
              options: {},
              editorFactoryObject: {}
            };
          }
          registeredEditor.options = { ...registeredEditor.options, ...editor.options };
          registeredEditor.editorFactoryObject = { ...registeredEditor.editorFactoryObject, ...editor.editorFactoryObject };
        }
        if (registeredEditor) {
          registeredEditors.push(registeredEditor);
        }
      }
      editors.set(glob2, registeredEditors);
    }
    return editors;
  }
  /**
   * Returns all editors as an array. Possible to contain duplicates
   */
  get _registeredEditors() {
    return Array.from(this._flattenedEditors.values()).flat();
  }
  updateUserAssociations(globPattern, editorID) {
    const newAssociation = { viewType: editorID, filenamePattern: globPattern };
    const currentAssociations = this.getAllUserAssociations();
    const newSettingObject = /* @__PURE__ */ Object.create(null);
    for (const association of [...currentAssociations, newAssociation]) {
      if (association.filenamePattern) {
        newSettingObject[association.filenamePattern] = association.viewType;
      }
    }
    this.configurationService.updateValue(editorsAssociationsSettingId, newSettingObject);
  }
  findMatchingEditors(resource) {
    const userSettings = this.getAssociationsForResource(resource);
    const matchingEditors = [];
    for (const [key, editors] of this._flattenedEditors) {
      for (const editor of editors) {
        const foundInSettings = userSettings.find((setting) => setting.viewType === editor.editorInfo.id);
        if (foundInSettings && editor.editorInfo.priority !== RegisteredEditorPriority.exclusive || globMatchesResource(key, resource)) {
          matchingEditors.push(editor);
        }
      }
    }
    return matchingEditors.sort((a, b) => {
      if (priorityToRank(b.editorInfo.priority) === priorityToRank(a.editorInfo.priority) && typeof b.globPattern === "string" && typeof a.globPattern === "string") {
        return b.globPattern.length - a.globPattern.length;
      }
      return priorityToRank(b.editorInfo.priority) - priorityToRank(a.editorInfo.priority);
    });
  }
  getEditors(resource) {
    this._flattenedEditors = this._flattenEditorsMap();
    if (URI.isUri(resource)) {
      const editors = this.findMatchingEditors(resource);
      if (editors.find((e) => e.editorInfo.priority === RegisteredEditorPriority.exclusive)) {
        return [];
      }
      return editors.map((editor) => editor.editorInfo);
    }
    return distinct(this._registeredEditors.map((editor) => editor.editorInfo), (editor) => editor.id);
  }
  /**
   * Given a resource and an editorId selects the best possible editor
   * @returns The editor and whether there was another default which conflicted with it
   */
  getEditor(resource, editorId) {
    const findMatchingEditor = (editors2, viewType) => {
      return editors2.find((editor) => {
        if (editor.options && editor.options.canSupportResource !== void 0) {
          return editor.editorInfo.id === viewType && editor.options.canSupportResource(resource);
        }
        return editor.editorInfo.id === viewType;
      });
    };
    if (editorId && editorId !== EditorResolution.EXCLUSIVE_ONLY) {
      const registeredEditors = this._registeredEditors;
      return {
        editor: findMatchingEditor(registeredEditors, editorId),
        conflictingDefault: false
      };
    }
    const editors = this.findMatchingEditors(resource);
    const associationsFromSetting = this.getAssociationsForResource(resource);
    const minPriority = editorId === EditorResolution.EXCLUSIVE_ONLY ? RegisteredEditorPriority.exclusive : RegisteredEditorPriority.builtin;
    let possibleEditors = editors.filter((editor) => priorityToRank(editor.editorInfo.priority) >= priorityToRank(minPriority) && editor.editorInfo.id !== DEFAULT_EDITOR_ASSOCIATION.id);
    if (possibleEditors.length === 0) {
      return {
        editor: associationsFromSetting[0] && minPriority !== RegisteredEditorPriority.exclusive ? findMatchingEditor(editors, associationsFromSetting[0].viewType) : void 0,
        conflictingDefault: false
      };
    }
    const selectedViewType = possibleEditors[0].editorInfo.priority === RegisteredEditorPriority.exclusive ? possibleEditors[0].editorInfo.id : associationsFromSetting[0]?.viewType || possibleEditors[0].editorInfo.id;
    let conflictingDefault = false;
    possibleEditors = possibleEditors.filter((editor) => editor.editorInfo.priority !== RegisteredEditorPriority.exclusive);
    if (associationsFromSetting.length === 0 && possibleEditors.length > 1) {
      conflictingDefault = true;
    }
    return {
      editor: findMatchingEditor(editors, selectedViewType),
      conflictingDefault
    };
  }
  async doResolveEditor(editor, group, selectedEditor) {
    let options = editor.options;
    const resource = EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (options && typeof options.activation === "undefined") {
      options = { ...options, activation: options.preserveFocus ? EditorActivation.RESTORE : void 0 };
    }
    if (isResourceMergeEditorInput(editor)) {
      if (!selectedEditor.editorFactoryObject.createMergeEditorInput) {
        return;
      }
      const inputWithOptions2 = await selectedEditor.editorFactoryObject.createMergeEditorInput(editor, group);
      return { editor: inputWithOptions2.editor, options: inputWithOptions2.options ?? options };
    }
    if (isResourceDiffEditorInput(editor)) {
      if (!selectedEditor.editorFactoryObject.createDiffEditorInput) {
        return;
      }
      const inputWithOptions2 = await selectedEditor.editorFactoryObject.createDiffEditorInput(editor, group);
      return { editor: inputWithOptions2.editor, options: inputWithOptions2.options ?? options };
    }
    if (isResourceMultiDiffEditorInput(editor)) {
      if (!selectedEditor.editorFactoryObject.createMultiDiffEditorInput) {
        return;
      }
      const inputWithOptions2 = await selectedEditor.editorFactoryObject.createMultiDiffEditorInput(editor, group);
      return { editor: inputWithOptions2.editor, options: inputWithOptions2.options ?? options };
    }
    if (isResourceSideBySideEditorInput(editor)) {
      throw new Error(`Untyped side by side editor input not supported here.`);
    }
    if (isUntitledResourceEditorInput(editor)) {
      if (!selectedEditor.editorFactoryObject.createUntitledEditorInput) {
        return;
      }
      const inputWithOptions2 = await selectedEditor.editorFactoryObject.createUntitledEditorInput(editor, group);
      return { editor: inputWithOptions2.editor, options: inputWithOptions2.options ?? options };
    }
    if (resource === void 0) {
      throw new Error(`Undefined resource on non untitled editor input.`);
    }
    const singleEditorPerResource = typeof selectedEditor.options?.singlePerResource === "function" ? selectedEditor.options.singlePerResource() : selectedEditor.options?.singlePerResource;
    if (singleEditorPerResource) {
      const existingEditors = this.findExistingEditorsForResource(resource, selectedEditor.editorInfo.id);
      if (existingEditors.length) {
        const editor2 = await this.moveExistingEditorForResource(existingEditors, group);
        if (editor2) {
          return { editor: editor2, options };
        } else {
          return;
        }
      }
    }
    if (!selectedEditor.editorFactoryObject.createEditorInput) {
      return;
    }
    const inputWithOptions = await selectedEditor.editorFactoryObject.createEditorInput(editor, group);
    options = inputWithOptions.options ?? options;
    const input = inputWithOptions.editor;
    return { editor: input, options };
  }
  /**
   * Moves the first existing editor for a resource to the target group unless already opened there.
   * Additionally will close any other editors that are open for that resource and viewtype besides the first one found
   * @param resource The resource of the editor
   * @param viewType the viewtype of the editor
   * @param targetGroup The group to move it to
   * @returns The moved editor input or `undefined` if the editor could not be moved
   */
  async moveExistingEditorForResource(existingEditorsForResource, targetGroup) {
    const editorToUse = existingEditorsForResource[0];
    for (const { editor, group } of existingEditorsForResource) {
      if (editor !== editorToUse.editor) {
        const closed = await group.closeEditor(editor);
        if (!closed) {
          return;
        }
      }
    }
    if (targetGroup.id !== editorToUse.group.id) {
      const moved = editorToUse.group.moveEditor(editorToUse.editor, targetGroup);
      if (!moved) {
        return;
      }
    }
    return editorToUse.editor;
  }
  /**
   * Given a resource and an editorId, returns all editors open for that resource and editorId.
   * @param resource The resource specified
   * @param editorId The editorID
   * @returns A list of editors
   */
  findExistingEditorsForResource(resource, editorId) {
    const out = [];
    const orderedGroups = distinct([
      ...this.editorGroupService.groups
    ]);
    for (const group of orderedGroups) {
      for (const editor of group.editors) {
        if (isEqual(editor.resource, resource) && editor.editorId === editorId) {
          out.push({ editor, group });
        }
      }
    }
    return out;
  }
  async doHandleConflictingDefaults(resource, editorName, untypedInput, currentEditor, group) {
    const editors = this.findMatchingEditors(resource);
    const storedChoices = JSON.parse(this.storageService.get(EditorResolverService.conflictingDefaultsStorageID, StorageScope.PROFILE, "{}"));
    const globForResource = `*${extname(resource)}`;
    const writeCurrentEditorsToStorage = () => {
      storedChoices[globForResource] = [];
      editors.forEach((editor) => storedChoices[globForResource].push(editor.editorInfo.id));
      this.storageService.store(EditorResolverService.conflictingDefaultsStorageID, JSON.stringify(storedChoices), StorageScope.PROFILE, StorageTarget.MACHINE);
    };
    if (storedChoices[globForResource] && storedChoices[globForResource].find((editorID) => editorID === currentEditor.editorId)) {
      return;
    }
    const handle = this.notificationService.prompt(
      Severity.Warning,
      localize("editorResolver.conflictingDefaults", "There are multiple default editors available for the resource."),
      [
        {
          label: localize("editorResolver.configureDefault", "Configure Default"),
          run: async () => {
            const picked = await this.doPickEditor(untypedInput, true);
            if (!picked) {
              return;
            }
            untypedInput.options = picked;
            const replacementEditor = await this.resolveEditor(untypedInput, group);
            if (replacementEditor === ResolvedStatus.ABORT || replacementEditor === ResolvedStatus.NONE) {
              return;
            }
            group.replaceEditors([
              {
                editor: currentEditor,
                replacement: replacementEditor.editor,
                options: replacementEditor.options ?? picked
              }
            ]);
          }
        },
        {
          label: localize("editorResolver.keepDefault", "Keep {0}", editorName),
          run: writeCurrentEditorsToStorage
        }
      ]
    );
    const onCloseListener = handle.onDidClose(() => {
      writeCurrentEditorsToStorage();
      onCloseListener.dispose();
    });
  }
  mapEditorsToQuickPickEntry(resource, showDefaultPicker) {
    const currentEditor = this.editorGroupService.activeGroup.findEditors(resource).at(0);
    let registeredEditors = resource.scheme === Schemas.untitled ? this._registeredEditors.filter((e) => e.editorInfo.priority !== RegisteredEditorPriority.exclusive) : this.findMatchingEditors(resource);
    registeredEditors = distinct(registeredEditors, (c) => c.editorInfo.id);
    const defaultSetting = this.getAssociationsForResource(resource)[0]?.viewType;
    registeredEditors = registeredEditors.sort((a, b) => {
      if (a.editorInfo.id === DEFAULT_EDITOR_ASSOCIATION.id) {
        return -1;
      } else if (b.editorInfo.id === DEFAULT_EDITOR_ASSOCIATION.id) {
        return 1;
      } else {
        return priorityToRank(b.editorInfo.priority) - priorityToRank(a.editorInfo.priority);
      }
    });
    const quickPickEntries = [];
    const currentlyActiveLabel = localize("promptOpenWith.currentlyActive", "Active");
    const currentDefaultLabel = localize("promptOpenWith.currentDefault", "Default");
    const currentDefaultAndActiveLabel = localize("promptOpenWith.currentDefaultAndActive", "Active and Default");
    let defaultViewType = defaultSetting;
    if (!defaultViewType && registeredEditors.length > 2 && registeredEditors[1]?.editorInfo.priority !== RegisteredEditorPriority.option) {
      defaultViewType = registeredEditors[1]?.editorInfo.id;
    }
    if (!defaultViewType) {
      defaultViewType = DEFAULT_EDITOR_ASSOCIATION.id;
    }
    registeredEditors.forEach((editor) => {
      const currentViewType = currentEditor?.editorId ?? DEFAULT_EDITOR_ASSOCIATION.id;
      const isActive = currentEditor ? editor.editorInfo.id === currentViewType : false;
      const isDefault = editor.editorInfo.id === defaultViewType;
      const quickPickEntry = {
        id: editor.editorInfo.id,
        label: editor.editorInfo.label,
        description: isActive && isDefault ? currentDefaultAndActiveLabel : isActive ? currentlyActiveLabel : isDefault ? currentDefaultLabel : void 0,
        detail: editor.editorInfo.detail ?? editor.editorInfo.priority
      };
      quickPickEntries.push(quickPickEntry);
    });
    if (!showDefaultPicker && extname(resource) !== "") {
      const separator = { type: "separator" };
      quickPickEntries.push(separator);
      const configureDefaultEntry = {
        id: EditorResolverService.configureDefaultID,
        label: localize("promptOpenWith.configureDefault", "Configure default editor for '{0}'...", `*${extname(resource)}`)
      };
      quickPickEntries.push(configureDefaultEntry);
    }
    return quickPickEntries;
  }
  async doPickEditor(editor, showDefaultPicker) {
    let resource = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (resource === void 0) {
      resource = URI.from({ scheme: Schemas.untitled });
    }
    const editorPicks = this.mapEditorsToQuickPickEntry(resource, showDefaultPicker);
    const disposables = new DisposableStore();
    const editorPicker = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
    const placeHolderMessage = showDefaultPicker ? localize("promptOpenWith.updateDefaultPlaceHolder", "Select new default editor for '{0}'", `*${extname(resource)}`) : localize("promptOpenWith.placeHolder", "Select editor for '{0}'", basename(resource));
    editorPicker.placeholder = placeHolderMessage;
    editorPicker.canAcceptInBackground = true;
    editorPicker.items = editorPicks;
    const firstItem = editorPicker.items.find((item) => item.type === "item");
    if (firstItem) {
      editorPicker.selectedItems = [firstItem];
    }
    const picked = await new Promise((resolve) => {
      disposables.add(editorPicker.onDidAccept((e) => {
        let result = void 0;
        if (editorPicker.selectedItems.length === 1) {
          result = {
            item: editorPicker.selectedItems[0],
            keyMods: editorPicker.keyMods,
            openInBackground: e.inBackground
          };
        }
        if (resource && showDefaultPicker && result?.item.id) {
          this.updateUserAssociations(`*${extname(resource)}`, result.item.id);
        }
        resolve(result);
      }));
      disposables.add(editorPicker.onDidHide(() => {
        disposables.dispose();
        resolve(void 0);
      }));
      disposables.add(editorPicker.onDidTriggerItemButton((e) => {
        resolve({ item: e.item, openInBackground: false });
        if (resource && e.item && e.item.id) {
          this.updateUserAssociations(`*${extname(resource)}`, e.item.id);
        }
      }));
      editorPicker.show();
    });
    editorPicker.dispose();
    if (picked) {
      if (picked.item.id === EditorResolverService.configureDefaultID) {
        return this.doPickEditor(editor, true);
      }
      const targetOptions = {
        ...editor.options,
        override: picked.item.id,
        preserveFocus: picked.openInBackground || editor.options?.preserveFocus
      };
      return targetOptions;
    }
    return void 0;
  }
  cacheEditors() {
    const cacheStorage = /* @__PURE__ */ new Set();
    for (const [globPattern, contribPoint] of this._flattenedEditors) {
      const nonOptional = !!contribPoint.find((c) => c.editorInfo.priority !== RegisteredEditorPriority.option && c.editorInfo.id !== DEFAULT_EDITOR_ASSOCIATION.id);
      if (!nonOptional) {
        continue;
      }
      if (glob.isRelativePattern(globPattern)) {
        cacheStorage.add(`${globPattern.pattern}`);
      } else {
        cacheStorage.add(globPattern);
      }
    }
    const userAssociations = this.getAllUserAssociations();
    for (const association of userAssociations) {
      if (association.filenamePattern) {
        cacheStorage.add(association.filenamePattern);
      }
    }
    this.storageService.store(EditorResolverService.cacheStorageID, JSON.stringify(Array.from(cacheStorage)), StorageScope.PROFILE, StorageTarget.MACHINE);
  }
  resourceMatchesCache(resource) {
    if (!this.cache) {
      return false;
    }
    for (const cacheEntry of this.cache) {
      if (globMatchesResource(cacheEntry, resource)) {
        return true;
      }
    }
    return false;
  }
};
// Constants
EditorResolverService.configureDefaultID = "promptOpenWith.configureDefault";
EditorResolverService.cacheStorageID = "editorOverrideService.cache";
EditorResolverService.conflictingDefaultsStorageID = "editorOverrideService.conflictingDefaults";
EditorResolverService = __decorateClass([
  __decorateParam(0, IEditorGroupsService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IExtensionService),
  __decorateParam(7, ILogService)
], EditorResolverService);
registerSingleton(IEditorResolverService, EditorResolverService, InstantiationType.Eager);
export {
  EditorResolverService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZWRpdG9yL2Jyb3dzZXIvZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZ2xvYiBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9nbG9iLmpzJztcbmltcG9ydCB7IGRpc3RpbmN0LCBpbnNlcnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBleHRuYW1lLCBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGl2YXRpb24sIEVkaXRvclJlc29sdXRpb24sIElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04sIEVkaXRvclJlc291cmNlQWNjZXNzb3IsIEVkaXRvcklucHV0V2l0aE9wdGlvbnMsIElSZXNvdXJjZVNpZGVCeVNpZGVFZGl0b3JJbnB1dCwgaXNFZGl0b3JJbnB1dFdpdGhPcHRpb25zLCBpc0VkaXRvcklucHV0V2l0aE9wdGlvbnNBbmRHcm91cCwgaXNSZXNvdXJjZURpZmZFZGl0b3JJbnB1dCwgaXNSZXNvdXJjZVNpZGVCeVNpZGVFZGl0b3JJbnB1dCwgaXNVbnRpdGxlZFJlc291cmNlRWRpdG9ySW5wdXQsIGlzUmVzb3VyY2VNZXJnZUVkaXRvcklucHV0LCBJVW50eXBlZEVkaXRvcklucHV0LCBTaWRlQnlTaWRlRWRpdG9yLCBpc1Jlc291cmNlTXVsdGlEaWZmRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXAsIElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgUmVnaXN0ZXJlZEVkaXRvckluZm8sIFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eSwgUmVnaXN0ZXJlZEVkaXRvck9wdGlvbnMsIEVkaXRvckFzc29jaWF0aW9uLCBFZGl0b3JBc3NvY2lhdGlvbnMsIGVkaXRvcnNBc3NvY2lhdGlvbnNTZXR0aW5nSWQsIGdsb2JNYXRjaGVzUmVzb3VyY2UsIElFZGl0b3JSZXNvbHZlclNlcnZpY2UsIHByaW9yaXR5VG9SYW5rLCBSZXNvbHZlZEVkaXRvciwgUmVzb2x2ZWRTdGF0dXMsIEVkaXRvcklucHV0RmFjdG9yeU9iamVjdCB9IGZyb20gJy4uL2NvbW1vbi9lZGl0b3JSZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUXVpY2tQaWNrSXRlbSwgSUtleU1vZHMsIElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0sIElRdWlja1BpY2tTZXBhcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IGZpbmRHcm91cCB9IGZyb20gJy4uL2NvbW1vbi9lZGl0b3JHcm91cEZpbmRlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFByZWZlcnJlZEdyb3VwIH0gZnJvbSAnLi4vY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2lkZUJ5U2lkZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9zaWRlQnlTaWRlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgUGF1c2VhYmxlRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcblxuaW50ZXJmYWNlIFJlZ2lzdGVyZWRFZGl0b3Ige1xuXHRnbG9iUGF0dGVybjogc3RyaW5nIHwgZ2xvYi5JUmVsYXRpdmVQYXR0ZXJuO1xuXHRlZGl0b3JJbmZvOiBSZWdpc3RlcmVkRWRpdG9ySW5mbztcblx0b3B0aW9ucz86IFJlZ2lzdGVyZWRFZGl0b3JPcHRpb25zO1xuXHRlZGl0b3JGYWN0b3J5T2JqZWN0OiBFZGl0b3JJbnB1dEZhY3RvcnlPYmplY3Q7XG59XG5cbnR5cGUgUmVnaXN0ZXJlZEVkaXRvcnMgPSBBcnJheTxSZWdpc3RlcmVkRWRpdG9yPjtcblxuZXhwb3J0IGNsYXNzIEVkaXRvclJlc29sdmVyU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlIHtcblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdC8vIEV2ZW50c1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUVkaXRvclJlZ2lzdHJhdGlvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgUGF1c2VhYmxlRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VFZGl0b3JSZWdpc3RyYXRpb25zID0gdGhpcy5fb25EaWRDaGFuZ2VFZGl0b3JSZWdpc3RyYXRpb25zLmV2ZW50O1xuXG5cdC8vIENvbnN0YW50c1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBjb25maWd1cmVEZWZhdWx0SUQgPSAncHJvbXB0T3BlbldpdGguY29uZmlndXJlRGVmYXVsdCc7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IGNhY2hlU3RvcmFnZUlEID0gJ2VkaXRvck92ZXJyaWRlU2VydmljZS5jYWNoZSc7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IGNvbmZsaWN0aW5nRGVmYXVsdHNTdG9yYWdlSUQgPSAnZWRpdG9yT3ZlcnJpZGVTZXJ2aWNlLmNvbmZsaWN0aW5nRGVmYXVsdHMnO1xuXG5cdC8vIERhdGEgU3RvcmVzXG5cdHByaXZhdGUgX2VkaXRvcnM6IE1hcDxzdHJpbmcgfCBnbG9iLklSZWxhdGl2ZVBhdHRlcm4sIE1hcDxzdHJpbmcsIFJlZ2lzdGVyZWRFZGl0b3JzPj4gPSBuZXcgTWFwPHN0cmluZyB8IGdsb2IuSVJlbGF0aXZlUGF0dGVybiwgTWFwPHN0cmluZywgUmVnaXN0ZXJlZEVkaXRvcnM+PigpO1xuXHRwcml2YXRlIF9mbGF0dGVuZWRFZGl0b3JzOiBNYXA8c3RyaW5nIHwgZ2xvYi5JUmVsYXRpdmVQYXR0ZXJuLCBSZWdpc3RlcmVkRWRpdG9ycz4gPSBuZXcgTWFwKCk7XG5cdHByaXZhdGUgX3Nob3VsZFJlRmxhdHRlbkVkaXRvcnM6IGJvb2xlYW4gPSB0cnVlO1xuXHRwcml2YXRlIGNhY2hlOiBTZXQ8c3RyaW5nPiB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JHcm91cFNlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0Ly8gUmVhZCBpbiB0aGUgY2FjaGUgb24gc3RhdHVwXG5cdFx0dGhpcy5jYWNoZSA9IG5ldyBTZXQ8c3RyaW5nPihKU09OLnBhcnNlKHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KEVkaXRvclJlc29sdmVyU2VydmljZS5jYWNoZVN0b3JhZ2VJRCwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIEpTT04uc3RyaW5naWZ5KFtdKSkpKTtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShFZGl0b3JSZXNvbHZlclNlcnZpY2UuY2FjaGVTdG9yYWdlSUQsIFN0b3JhZ2VTY29wZS5QUk9GSUxFKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc3RvcmFnZVNlcnZpY2Uub25XaWxsU2F2ZVN0YXRlKCgpID0+IHtcblx0XHRcdC8vIFdlIHdhbnQgdG8gc3RvcmUgdGhlIGdsb2IgcGF0dGVybnMgd2Ugd291bGQgYWN0aXZhdGUgb24sIHRoaXMgYWxsb3dzIHVzIHRvIGtub3cgaWYgd2UgbmVlZCB0byBhd2FpdCB0aGUgZXh0IGhvc3Qgb24gc3RhcnR1cCBmb3Igb3BlbmluZyBhIHJlc291cmNlXG5cdFx0XHR0aGlzLmNhY2hlRWRpdG9ycygpO1xuXHRcdH0pKTtcblxuXHRcdC8vIFdoZW4gZXh0ZW5zaW9ucyBoYXZlIHJlZ2lzdGVyZWQgd2Ugbm8gbG9uZ2VyIG5lZWQgdGhlIGNhY2hlXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5leHRlbnNpb25TZXJ2aWNlLm9uRGlkUmVnaXN0ZXJFeHRlbnNpb25zKCgpID0+IHtcblx0XHRcdHRoaXMuY2FjaGUgPSB1bmRlZmluZWQ7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlVW50eXBlZElucHV0QW5kR3JvdXAoZWRpdG9yOiBJVW50eXBlZEVkaXRvcklucHV0LCBwcmVmZXJyZWRHcm91cDogUHJlZmVycmVkR3JvdXAgfCB1bmRlZmluZWQpOiBQcm9taXNlPFtJVW50eXBlZEVkaXRvcklucHV0LCBJRWRpdG9yR3JvdXAsIEVkaXRvckFjdGl2YXRpb24gfCB1bmRlZmluZWRdIHwgdW5kZWZpbmVkPiB8IFtJVW50eXBlZEVkaXRvcklucHV0LCBJRWRpdG9yR3JvdXAsIEVkaXRvckFjdGl2YXRpb24gfCB1bmRlZmluZWRdIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCB1bnR5cGVkRWRpdG9yID0gZWRpdG9yO1xuXG5cdFx0Ly8gVXNlIHRoZSB1bnR5cGVkIGVkaXRvciB0byBmaW5kIGEgZ3JvdXBcblx0XHRjb25zdCBmaW5kR3JvdXBSZXN1bHQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGZpbmRHcm91cCwgdW50eXBlZEVkaXRvciwgcHJlZmVycmVkR3JvdXApO1xuXHRcdGlmIChmaW5kR3JvdXBSZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG5cdFx0XHRyZXR1cm4gZmluZEdyb3VwUmVzdWx0LnRoZW4oKFtncm91cCwgYWN0aXZhdGlvbl0pID0+IFt1bnR5cGVkRWRpdG9yLCBncm91cCwgYWN0aXZhdGlvbl0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBbZ3JvdXAsIGFjdGl2YXRpb25dID0gZmluZEdyb3VwUmVzdWx0O1xuXHRcdFx0cmV0dXJuIFt1bnR5cGVkRWRpdG9yLCBncm91cCwgYWN0aXZhdGlvbl07XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcmVzb2x2ZUVkaXRvcihlZGl0b3I6IElVbnR5cGVkRWRpdG9ySW5wdXQsIHByZWZlcnJlZEdyb3VwOiBQcmVmZXJyZWRHcm91cCB8IHVuZGVmaW5lZCk6IFByb21pc2U8UmVzb2x2ZWRFZGl0b3I+IHtcblx0XHQvLyBVcGRhdGUgdGhlIGZsYXR0ZW5lZCBlZGl0b3JzXG5cdFx0dGhpcy5fZmxhdHRlbmVkRWRpdG9ycyA9IHRoaXMuX2ZsYXR0ZW5FZGl0b3JzTWFwKCk7XG5cblx0XHQvLyBTcGVjaWFsIGNhc2U6IHNpZGUgYnkgc2lkZSBlZGl0b3JzIHJlcXVpcmVzIHVzIHRvXG5cdFx0Ly8gaW5kZXBlbmRlbnRseSByZXNvbHZlIGJvdGggc2lkZXMgYW5kIHRoZW4gYnVpbGRcblx0XHQvLyBhIHNpZGUgYnkgc2lkZSBlZGl0b3Igd2l0aCB0aGUgcmVzdWx0XG5cdFx0aWYgKGlzUmVzb3VyY2VTaWRlQnlTaWRlRWRpdG9ySW5wdXQoZWRpdG9yKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZG9SZXNvbHZlU2lkZUJ5U2lkZUVkaXRvcihlZGl0b3IsIHByZWZlcnJlZEdyb3VwKTtcblx0XHR9XG5cblx0XHRsZXQgcmVzb2x2ZWRVbnR5cGVkQW5kR3JvdXA6IFtJVW50eXBlZEVkaXRvcklucHV0LCBJRWRpdG9yR3JvdXAsIEVkaXRvckFjdGl2YXRpb24gfCB1bmRlZmluZWRdIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHJlc29sdmVkVW50eXBlZEFuZEdyb3VwUmVzdWx0ID0gdGhpcy5yZXNvbHZlVW50eXBlZElucHV0QW5kR3JvdXAoZWRpdG9yLCBwcmVmZXJyZWRHcm91cCk7XG5cdFx0aWYgKHJlc29sdmVkVW50eXBlZEFuZEdyb3VwUmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuXHRcdFx0cmVzb2x2ZWRVbnR5cGVkQW5kR3JvdXAgPSBhd2FpdCByZXNvbHZlZFVudHlwZWRBbmRHcm91cFJlc3VsdDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzb2x2ZWRVbnR5cGVkQW5kR3JvdXAgPSByZXNvbHZlZFVudHlwZWRBbmRHcm91cFJlc3VsdDtcblx0XHR9XG5cblx0XHRpZiAoIXJlc29sdmVkVW50eXBlZEFuZEdyb3VwKSB7XG5cdFx0XHRyZXR1cm4gUmVzb2x2ZWRTdGF0dXMuTk9ORTtcblx0XHR9XG5cdFx0Ly8gR2V0IHRoZSByZXNvbHZlZCB1bnR5cGVkIGVkaXRvciwgZ3JvdXAsIGFuZCBhY3RpdmF0aW9uXG5cdFx0Y29uc3QgW3VudHlwZWRFZGl0b3IsIGdyb3VwLCBhY3RpdmF0aW9uXSA9IHJlc29sdmVkVW50eXBlZEFuZEdyb3VwO1xuXHRcdGlmIChhY3RpdmF0aW9uKSB7XG5cdFx0XHR1bnR5cGVkRWRpdG9yLm9wdGlvbnMgPSB7IC4uLnVudHlwZWRFZGl0b3Iub3B0aW9ucywgYWN0aXZhdGlvbiB9O1xuXHRcdH1cblxuXHRcdGxldCByZXNvdXJjZSA9IEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0Q2Fub25pY2FsVXJpKHVudHlwZWRFZGl0b3IsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuUFJJTUFSWSB9KTtcblxuXHRcdC8vIElmIGl0IHdhcyByZXNvbHZlZCBiZWZvcmUgd2UgYXdhaXQgZm9yIHRoZSBleHRlbnNpb25zIHRvIGFjdGl2YXRlIGFuZCB0aGVuIHByb2NlZWQgd2l0aCByZXNvbHV0aW9uIG9yIGVsc2UgdGhlIGJhY2tpbmcgZXh0ZW5zaW9ucyB3b24ndCBiZSByZWdpc3RlcmVkXG5cdFx0aWYgKHRoaXMuY2FjaGUgJiYgcmVzb3VyY2UgJiYgdGhpcy5yZXNvdXJjZU1hdGNoZXNDYWNoZShyZXNvdXJjZSkpIHtcblx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uU2VydmljZS53aGVuSW5zdGFsbGVkRXh0ZW5zaW9uc1JlZ2lzdGVyZWQoKTtcblx0XHR9XG5cblx0XHQvLyBVbmRlZmluZWQgcmVzb3VyY2UgLT4gdW50aWx0ZWQuIE90aGVyIG1hbGZvcm1lZCBVUkkncyBhcmUgdW5yZXNvbHZhYmxlXG5cdFx0aWYgKHJlc291cmNlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJlc291cmNlID0gVVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMudW50aXRsZWQgfSk7XG5cdFx0fSBlbHNlIGlmIChyZXNvdXJjZS5zY2hlbWUgPT09IHVuZGVmaW5lZCB8fCByZXNvdXJjZSA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIFJlc29sdmVkU3RhdHVzLk5PTkU7XG5cdFx0fVxuXG5cdFx0aWYgKHVudHlwZWRFZGl0b3Iub3B0aW9ucz8ub3ZlcnJpZGUgPT09IEVkaXRvclJlc29sdXRpb24uUElDSykge1xuXHRcdFx0Y29uc3QgcGlja2VkID0gYXdhaXQgdGhpcy5kb1BpY2tFZGl0b3IodW50eXBlZEVkaXRvcik7XG5cdFx0XHQvLyBJZiB0aGUgcGlja2VyIHdhcyBjYW5jZWxsZWQgd2Ugd2lsbCBzdG9wIHJlc29sdmluZyB0aGUgZWRpdG9yXG5cdFx0XHRpZiAoIXBpY2tlZCkge1xuXHRcdFx0XHRyZXR1cm4gUmVzb2x2ZWRTdGF0dXMuQUJPUlQ7XG5cdFx0XHR9XG5cdFx0XHQvLyBQb3B1bGF0ZSB0aGUgb3B0aW9ucyB3aXRoIHRoZSBuZXcgb25lc1xuXHRcdFx0dW50eXBlZEVkaXRvci5vcHRpb25zID0gcGlja2VkO1xuXHRcdH1cblxuXHRcdC8vIFJlc29sdmVkIHRoZSBlZGl0b3IgSUQgYXMgbXVjaCBhcyBwb3NzaWJsZSwgbm93IGZpbmQgYSBnaXZlbiBlZGl0b3IgKGNhc3QgaGVyZSBpcyBvayBiZWNhdXNlIHdlIHJlc29sdmUgZG93biB0byBhIHN0cmluZyBhYm92ZSlcblx0XHRsZXQgeyBlZGl0b3I6IHNlbGVjdGVkRWRpdG9yLCBjb25mbGljdGluZ0RlZmF1bHQgfSA9IHRoaXMuZ2V0RWRpdG9yKHJlc291cmNlLCB1bnR5cGVkRWRpdG9yLm9wdGlvbnM/Lm92ZXJyaWRlIGFzIChzdHJpbmcgfCBFZGl0b3JSZXNvbHV0aW9uLkVYQ0xVU0lWRV9PTkxZIHwgdW5kZWZpbmVkKSk7XG5cdFx0Ly8gSWYgbm8gZWRpdG9yIHdhcyBmb3VuZCBhbmQgdGhpcyB3YXMgYSB0eXBlZCBlZGl0b3Igb3IgYW4gZWRpdG9yIHdpdGggYW4gZXhwbGljaXQgb3ZlcnJpZGUgd2UgY291bGQgbm90IHJlc29sdmUgaXRcblx0XHRpZiAoIXNlbGVjdGVkRWRpdG9yICYmICh1bnR5cGVkRWRpdG9yLm9wdGlvbnM/Lm92ZXJyaWRlIHx8IGlzRWRpdG9ySW5wdXRXaXRoT3B0aW9ucyhlZGl0b3IpKSkge1xuXHRcdFx0cmV0dXJuIFJlc29sdmVkU3RhdHVzLk5PTkU7XG5cdFx0fSBlbHNlIGlmICghc2VsZWN0ZWRFZGl0b3IpIHtcblx0XHRcdC8vIFNpbXBsZSB1bnR5cGVkIGVkaXRvcnMgdGhhdCB3ZSBjb3VsZCBub3QgcmVzb2x2ZSB3aWxsIGJlIHJlc29sdmVkIHRvIHRoZSBkZWZhdWx0IGVkaXRvclxuXHRcdFx0Y29uc3QgcmVzb2x2ZWRFZGl0b3IgPSB0aGlzLmdldEVkaXRvcihyZXNvdXJjZSwgREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04uaWQpO1xuXHRcdFx0c2VsZWN0ZWRFZGl0b3IgPSByZXNvbHZlZEVkaXRvcj8uZWRpdG9yO1xuXHRcdFx0Y29uZmxpY3RpbmdEZWZhdWx0ID0gcmVzb2x2ZWRFZGl0b3I/LmNvbmZsaWN0aW5nRGVmYXVsdDtcblx0XHRcdGlmICghc2VsZWN0ZWRFZGl0b3IpIHtcblx0XHRcdFx0cmV0dXJuIFJlc29sdmVkU3RhdHVzLk5PTkU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSW4gdGhlIHNwZWNpYWwgY2FzZSBvZiBkaWZmIGVkaXRvcnMgd2UgZG8gc29tZSBtb3JlIHdvcmsgdG8gZGV0ZXJtaW5lIHRoZSBjb3JyZWN0IGVkaXRvciBmb3IgYm90aCBzaWRlc1xuXHRcdGlmIChpc1Jlc291cmNlRGlmZkVkaXRvcklucHV0KHVudHlwZWRFZGl0b3IpICYmIHVudHlwZWRFZGl0b3Iub3B0aW9ucz8ub3ZlcnJpZGUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0bGV0IHJlc291cmNlMiA9IEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0Q2Fub25pY2FsVXJpKHVudHlwZWRFZGl0b3IsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuU0VDT05EQVJZIH0pO1xuXHRcdFx0aWYgKCFyZXNvdXJjZTIpIHtcblx0XHRcdFx0cmVzb3VyY2UyID0gVVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMudW50aXRsZWQgfSk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB7IGVkaXRvcjogc2VsZWN0ZWRFZGl0b3IyIH0gPSB0aGlzLmdldEVkaXRvcihyZXNvdXJjZTIsIHVuZGVmaW5lZCk7XG5cdFx0XHRpZiAoIXNlbGVjdGVkRWRpdG9yMiB8fCBzZWxlY3RlZEVkaXRvci5lZGl0b3JJbmZvLmlkICE9PSBzZWxlY3RlZEVkaXRvcjIuZWRpdG9ySW5mby5pZCkge1xuXHRcdFx0XHRjb25zdCB7IGVkaXRvcjogc2VsZWN0ZWREaWZmLCBjb25mbGljdGluZ0RlZmF1bHQ6IGNvbmZsaWN0aW5nRGVmYXVsdERpZmYgfSA9IHRoaXMuZ2V0RWRpdG9yKHJlc291cmNlLCBERUZBVUxUX0VESVRPUl9BU1NPQ0lBVElPTi5pZCk7XG5cdFx0XHRcdHNlbGVjdGVkRWRpdG9yID0gc2VsZWN0ZWREaWZmO1xuXHRcdFx0XHRjb25mbGljdGluZ0RlZmF1bHQgPSBjb25mbGljdGluZ0RlZmF1bHREaWZmO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFzZWxlY3RlZEVkaXRvcikge1xuXHRcdFx0XHRyZXR1cm4gUmVzb2x2ZWRTdGF0dXMuTk9ORTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBJZiBubyBvdmVycmlkZSB3ZSB0YWtlIHRoZSBzZWxlY3RlZCBlZGl0b3IgaWQgc28gdGhhdCBtYXRjaGVzIHdvcmtzIHdpdGggdGhlIGlzQWN0aXZlIGNoZWNrXG5cdFx0dW50eXBlZEVkaXRvci5vcHRpb25zID0geyBvdmVycmlkZTogc2VsZWN0ZWRFZGl0b3IuZWRpdG9ySW5mby5pZCwgLi4udW50eXBlZEVkaXRvci5vcHRpb25zIH07XG5cblx0XHQvLyBDaGVjayBpZiBkaWZmIGNhbiBiZSBjcmVhdGVkIGJhc2VkIG9uIHByZXNjZW5lIG9mIGZhY3RvcnkgZnVuY3Rpb25cblx0XHRpZiAoc2VsZWN0ZWRFZGl0b3IuZWRpdG9yRmFjdG9yeU9iamVjdC5jcmVhdGVEaWZmRWRpdG9ySW5wdXQgPT09IHVuZGVmaW5lZCAmJiBpc1Jlc291cmNlRGlmZkVkaXRvcklucHV0KHVudHlwZWRFZGl0b3IpKSB7XG5cdFx0XHRyZXR1cm4gUmVzb2x2ZWRTdGF0dXMuTk9ORTtcblx0XHR9XG5cblx0XHRjb25zdCBpbnB1dCA9IGF3YWl0IHRoaXMuZG9SZXNvbHZlRWRpdG9yKHVudHlwZWRFZGl0b3IsIGdyb3VwLCBzZWxlY3RlZEVkaXRvcik7XG5cdFx0aWYgKGNvbmZsaWN0aW5nRGVmYXVsdCAmJiBpbnB1dCkge1xuXHRcdFx0Ly8gU2hvdyB0aGUgY29uZmxpY3RpbmcgZGVmYXVsdCBkaWFsb2dcblx0XHRcdGF3YWl0IHRoaXMuZG9IYW5kbGVDb25mbGljdGluZ0RlZmF1bHRzKHJlc291cmNlLCBzZWxlY3RlZEVkaXRvci5lZGl0b3JJbmZvLmxhYmVsLCB1bnR5cGVkRWRpdG9yLCBpbnB1dC5lZGl0b3IsIGdyb3VwKTtcblx0XHR9XG5cblx0XHRpZiAoaW5wdXQpIHtcblx0XHRcdGlmIChpbnB1dC5lZGl0b3IuZWRpdG9ySWQgIT09IHNlbGVjdGVkRWRpdG9yLmVkaXRvckluZm8uaWQpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oYEVkaXRvciBJRCBNaXNtYXRjaDogJHtpbnB1dC5lZGl0b3IuZWRpdG9ySWR9ICE9PSAke3NlbGVjdGVkRWRpdG9yLmVkaXRvckluZm8uaWR9LiBUaGlzIHdpbGwgY2F1c2UgYnVncy4gUGxlYXNlIGVuc3VyZSBlZGl0b3JJbnB1dC5lZGl0b3JJZCBtYXRjaGVzIHRoZSByZWdpc3RlcmVkIGlkYCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4geyAuLi5pbnB1dCwgZ3JvdXAgfTtcblx0XHR9XG5cdFx0cmV0dXJuIFJlc29sdmVkU3RhdHVzLkFCT1JUO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1Jlc29sdmVTaWRlQnlTaWRlRWRpdG9yKGVkaXRvcjogSVJlc291cmNlU2lkZUJ5U2lkZUVkaXRvcklucHV0LCBwcmVmZXJyZWRHcm91cDogUHJlZmVycmVkR3JvdXAgfCB1bmRlZmluZWQpOiBQcm9taXNlPFJlc29sdmVkRWRpdG9yPiB7XG5cdFx0Y29uc3QgcHJpbWFyeVJlc29sdmVkRWRpdG9yID0gYXdhaXQgdGhpcy5yZXNvbHZlRWRpdG9yKGVkaXRvci5wcmltYXJ5LCBwcmVmZXJyZWRHcm91cCk7XG5cdFx0aWYgKCFpc0VkaXRvcklucHV0V2l0aE9wdGlvbnNBbmRHcm91cChwcmltYXJ5UmVzb2x2ZWRFZGl0b3IpKSB7XG5cdFx0XHRyZXR1cm4gUmVzb2x2ZWRTdGF0dXMuTk9ORTtcblx0XHR9XG5cdFx0Y29uc3Qgc2Vjb25kYXJ5UmVzb2x2ZWRFZGl0b3IgPSBhd2FpdCB0aGlzLnJlc29sdmVFZGl0b3IoZWRpdG9yLnNlY29uZGFyeSwgcHJpbWFyeVJlc29sdmVkRWRpdG9yLmdyb3VwID8/IHByZWZlcnJlZEdyb3VwKTtcblx0XHRpZiAoIWlzRWRpdG9ySW5wdXRXaXRoT3B0aW9uc0FuZEdyb3VwKHNlY29uZGFyeVJlc29sdmVkRWRpdG9yKSkge1xuXHRcdFx0cmV0dXJuIFJlc29sdmVkU3RhdHVzLk5PTkU7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRncm91cDogcHJpbWFyeVJlc29sdmVkRWRpdG9yLmdyb3VwID8/IHNlY29uZGFyeVJlc29sdmVkRWRpdG9yLmdyb3VwLFxuXHRcdFx0ZWRpdG9yOiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNpZGVCeVNpZGVFZGl0b3JJbnB1dCwgZWRpdG9yLmxhYmVsLCBlZGl0b3IuZGVzY3JpcHRpb24sIHNlY29uZGFyeVJlc29sdmVkRWRpdG9yLmVkaXRvciwgcHJpbWFyeVJlc29sdmVkRWRpdG9yLmVkaXRvciksXG5cdFx0XHRvcHRpb25zOiBlZGl0b3Iub3B0aW9uc1xuXHRcdH07XG5cdH1cblxuXHRidWZmZXJDaGFuZ2VFdmVudHMoY2FsbGJhY2s6IEZ1bmN0aW9uKTogdm9pZCB7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VFZGl0b3JSZWdpc3RyYXRpb25zLnBhdXNlKCk7XG5cdFx0dHJ5IHtcblx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRWRpdG9yUmVnaXN0cmF0aW9ucy5yZXN1bWUoKTtcblx0XHR9XG5cdH1cblxuXHRyZWdpc3RlckVkaXRvcihcblx0XHRnbG9iUGF0dGVybjogc3RyaW5nIHwgZ2xvYi5JUmVsYXRpdmVQYXR0ZXJuLFxuXHRcdGVkaXRvckluZm86IFJlZ2lzdGVyZWRFZGl0b3JJbmZvLFxuXHRcdG9wdGlvbnM6IFJlZ2lzdGVyZWRFZGl0b3JPcHRpb25zLFxuXHRcdGVkaXRvckZhY3RvcnlPYmplY3Q6IEVkaXRvcklucHV0RmFjdG9yeU9iamVjdFxuXHQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0bGV0IHJlZ2lzdGVyZWRFZGl0b3IgPSB0aGlzLl9lZGl0b3JzLmdldChnbG9iUGF0dGVybik7XG5cdFx0aWYgKHJlZ2lzdGVyZWRFZGl0b3IgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmVnaXN0ZXJlZEVkaXRvciA9IG5ldyBNYXA8c3RyaW5nLCBSZWdpc3RlcmVkRWRpdG9ycz4oKTtcblx0XHRcdHRoaXMuX2VkaXRvcnMuc2V0KGdsb2JQYXR0ZXJuLCByZWdpc3RlcmVkRWRpdG9yKTtcblx0XHR9XG5cblx0XHRsZXQgZWRpdG9yc1dpdGhJZCA9IHJlZ2lzdGVyZWRFZGl0b3IuZ2V0KGVkaXRvckluZm8uaWQpO1xuXHRcdGlmIChlZGl0b3JzV2l0aElkID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGVkaXRvcnNXaXRoSWQgPSBbXTtcblx0XHR9XG5cdFx0Y29uc3QgcmVtb3ZlID0gaW5zZXJ0KGVkaXRvcnNXaXRoSWQsIHtcblx0XHRcdGdsb2JQYXR0ZXJuLFxuXHRcdFx0ZWRpdG9ySW5mbyxcblx0XHRcdG9wdGlvbnMsXG5cdFx0XHRlZGl0b3JGYWN0b3J5T2JqZWN0XG5cdFx0fSk7XG5cdFx0cmVnaXN0ZXJlZEVkaXRvci5zZXQoZWRpdG9ySW5mby5pZCwgZWRpdG9yc1dpdGhJZCk7XG5cdFx0dGhpcy5fc2hvdWxkUmVGbGF0dGVuRWRpdG9ycyA9IHRydWU7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VFZGl0b3JSZWdpc3RyYXRpb25zLmZpcmUoKTtcblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHJlbW92ZSgpO1xuXHRcdFx0aWYgKGVkaXRvcnNXaXRoSWQgJiYgZWRpdG9yc1dpdGhJZC5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0cmVnaXN0ZXJlZEVkaXRvcj8uZGVsZXRlKGVkaXRvckluZm8uaWQpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fc2hvdWxkUmVGbGF0dGVuRWRpdG9ycyA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUVkaXRvclJlZ2lzdHJhdGlvbnMuZmlyZSgpO1xuXHRcdH0pO1xuXHR9XG5cblx0Z2V0QXNzb2NpYXRpb25zRm9yUmVzb3VyY2UocmVzb3VyY2U6IFVSSSk6IEVkaXRvckFzc29jaWF0aW9ucyB7XG5cdFx0Y29uc3QgYXNzb2NpYXRpb25zID0gdGhpcy5nZXRBbGxVc2VyQXNzb2NpYXRpb25zKCk7XG5cdFx0bGV0IG1hdGNoaW5nQXNzb2NpYXRpb25zID0gYXNzb2NpYXRpb25zLmZpbHRlcihhc3NvY2lhdGlvbiA9PiBhc3NvY2lhdGlvbi5maWxlbmFtZVBhdHRlcm4gJiYgZ2xvYk1hdGNoZXNSZXNvdXJjZShhc3NvY2lhdGlvbi5maWxlbmFtZVBhdHRlcm4sIHJlc291cmNlKSk7XG5cdFx0Ly8gU29ydCBtYXRjaGluZyBhc3NvY2lhdGlvbnMgYmFzZWQgb24gZ2xvYiBsZW5ndGggYXMgYSBsb25nZXIgZ2xvYiB3aWxsIGJlIG1vcmUgc3BlY2lmaWNcblx0XHRtYXRjaGluZ0Fzc29jaWF0aW9ucyA9IG1hdGNoaW5nQXNzb2NpYXRpb25zLnNvcnQoKGEsIGIpID0+IChiLmZpbGVuYW1lUGF0dGVybj8ubGVuZ3RoID8/IDApIC0gKGEuZmlsZW5hbWVQYXR0ZXJuPy5sZW5ndGggPz8gMCkpO1xuXHRcdGNvbnN0IGFsbEVkaXRvcnM6IFJlZ2lzdGVyZWRFZGl0b3JzID0gdGhpcy5fcmVnaXN0ZXJlZEVkaXRvcnM7XG5cdFx0Ly8gRW5zdXJlIHRoYXQgdGhlIHNldHRpbmdzIGFyZSB2YWxpZCBlZGl0b3JzXG5cdFx0cmV0dXJuIG1hdGNoaW5nQXNzb2NpYXRpb25zLmZpbHRlcihhc3NvY2lhdGlvbiA9PiBhbGxFZGl0b3JzLmZpbmQoYyA9PiBjLmVkaXRvckluZm8uaWQgPT09IGFzc29jaWF0aW9uLnZpZXdUeXBlKSk7XG5cdH1cblxuXHRnZXRBbGxVc2VyQXNzb2NpYXRpb25zKCk6IEVkaXRvckFzc29jaWF0aW9ucyB7XG5cdFx0Y29uc3QgaW5zcGVjdGVkRWRpdG9yQXNzb2NpYXRpb25zID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0PHsgW2ZpbGVOYW1lUGF0dGVybjogc3RyaW5nXTogc3RyaW5nIH0+KGVkaXRvcnNBc3NvY2lhdGlvbnNTZXR0aW5nSWQpIHx8IHt9O1xuXHRcdGNvbnN0IGRlZmF1bHRBc3NvY2lhdGlvbnMgPSBpbnNwZWN0ZWRFZGl0b3JBc3NvY2lhdGlvbnMuZGVmYXVsdFZhbHVlID8/IHt9O1xuXHRcdGNvbnN0IHdvcmtzcGFjZUFzc29jaWF0aW9ucyA9IGluc3BlY3RlZEVkaXRvckFzc29jaWF0aW9ucy53b3Jrc3BhY2VWYWx1ZSA/PyB7fTtcblx0XHRjb25zdCB1c2VyQXNzb2NpYXRpb25zID0gaW5zcGVjdGVkRWRpdG9yQXNzb2NpYXRpb25zLnVzZXJWYWx1ZSA/PyB7fTtcblx0XHRjb25zdCByYXdBc3NvY2lhdGlvbnM6IHsgW2ZpbGVOYW1lUGF0dGVybjogc3RyaW5nXTogc3RyaW5nIH0gPSB7IC4uLndvcmtzcGFjZUFzc29jaWF0aW9ucyB9O1xuXHRcdC8vIFdlIHdhbnQgdG8gYXBwbHkgdGhlIGRlZmF1bHQgYXNzb2NpYXRpb25zIGFuZCB1c2VyIGFzc29jaWF0aW9ucyBvbiB0b3Agb2YgdGhlIHdvcmtzcGFjZSBhc3NvY2lhdGlvbnMgYnV0IGlnbm9yZSBkdXBsaWNhdGUga2V5cy5cblx0XHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyh7IC4uLmRlZmF1bHRBc3NvY2lhdGlvbnMsIC4uLnVzZXJBc3NvY2lhdGlvbnMgfSkpIHtcblx0XHRcdGlmIChyYXdBc3NvY2lhdGlvbnNba2V5XSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJhd0Fzc29jaWF0aW9uc1trZXldID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IGFzc29jaWF0aW9ucyA9IFtdO1xuXHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHJhd0Fzc29jaWF0aW9ucykpIHtcblx0XHRcdGNvbnN0IGFzc29jaWF0aW9uOiBFZGl0b3JBc3NvY2lhdGlvbiA9IHtcblx0XHRcdFx0ZmlsZW5hbWVQYXR0ZXJuOiBrZXksXG5cdFx0XHRcdHZpZXdUeXBlOiB2YWx1ZVxuXHRcdFx0fTtcblx0XHRcdGFzc29jaWF0aW9ucy5wdXNoKGFzc29jaWF0aW9uKTtcblx0XHR9XG5cdFx0cmV0dXJuIGFzc29jaWF0aW9ucztcblx0fVxuXG5cdC8qKlxuXHQgKiBHaXZlbiB0aGUgbmVzdGVkIG5hdHVyZSBvZiB0aGUgZWRpdG9ycyBtYXAsIHdlIG1lcmdlIGZhY3RvcmllcyBvZiB0aGUgc2FtZSBnbG9iIGFuZCBpZCB0byBtYWtlIGl0IGZsYXRcblx0ICogYW5kIGVhc2llciB0byB3b3JrIHdpdGhcblx0ICovXG5cdHByaXZhdGUgX2ZsYXR0ZW5FZGl0b3JzTWFwKCkge1xuXHRcdC8vIElmIHdlIHNob3VsZG4ndCBiZSByZS1mbGF0dGVuaW5nIChkdWUgdG8gbGFjayBvZiB1cGRhdGUpIHRoZW4gcmV0dXJuIGVhcmx5XG5cdFx0aWYgKCF0aGlzLl9zaG91bGRSZUZsYXR0ZW5FZGl0b3JzKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZmxhdHRlbmVkRWRpdG9ycztcblx0XHR9XG5cdFx0dGhpcy5fc2hvdWxkUmVGbGF0dGVuRWRpdG9ycyA9IGZhbHNlO1xuXHRcdGNvbnN0IGVkaXRvcnMgPSBuZXcgTWFwPHN0cmluZyB8IGdsb2IuSVJlbGF0aXZlUGF0dGVybiwgUmVnaXN0ZXJlZEVkaXRvcnM+KCk7XG5cdFx0Zm9yIChjb25zdCBbZ2xvYiwgdmFsdWVdIG9mIHRoaXMuX2VkaXRvcnMpIHtcblx0XHRcdGNvbnN0IHJlZ2lzdGVyZWRFZGl0b3JzOiBSZWdpc3RlcmVkRWRpdG9ycyA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBlZGl0b3JzIG9mIHZhbHVlLnZhbHVlcygpKSB7XG5cdFx0XHRcdGxldCByZWdpc3RlcmVkRWRpdG9yOiBSZWdpc3RlcmVkRWRpdG9yIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHQvLyBNZXJnZSBhbGwgZWRpdG9ycyB3aXRoIHRoZSBzYW1lIGlkIGFuZCBnbG9iIHBhdHRlcm4gdG9nZXRoZXJcblx0XHRcdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgZWRpdG9ycykge1xuXHRcdFx0XHRcdGlmICghcmVnaXN0ZXJlZEVkaXRvcikge1xuXHRcdFx0XHRcdFx0cmVnaXN0ZXJlZEVkaXRvciA9IHtcblx0XHRcdFx0XHRcdFx0ZWRpdG9ySW5mbzogZWRpdG9yLmVkaXRvckluZm8sXG5cdFx0XHRcdFx0XHRcdGdsb2JQYXR0ZXJuOiBlZGl0b3IuZ2xvYlBhdHRlcm4sXG5cdFx0XHRcdFx0XHRcdG9wdGlvbnM6IHt9LFxuXHRcdFx0XHRcdFx0XHRlZGl0b3JGYWN0b3J5T2JqZWN0OiB7fVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gTWVyZ2Ugb3B0aW9ucyBhbmQgZmFjdG9yaWVzXG5cdFx0XHRcdFx0cmVnaXN0ZXJlZEVkaXRvci5vcHRpb25zID0geyAuLi5yZWdpc3RlcmVkRWRpdG9yLm9wdGlvbnMsIC4uLmVkaXRvci5vcHRpb25zIH07XG5cdFx0XHRcdFx0cmVnaXN0ZXJlZEVkaXRvci5lZGl0b3JGYWN0b3J5T2JqZWN0ID0geyAuLi5yZWdpc3RlcmVkRWRpdG9yLmVkaXRvckZhY3RvcnlPYmplY3QsIC4uLmVkaXRvci5lZGl0b3JGYWN0b3J5T2JqZWN0IH07XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHJlZ2lzdGVyZWRFZGl0b3IpIHtcblx0XHRcdFx0XHRyZWdpc3RlcmVkRWRpdG9ycy5wdXNoKHJlZ2lzdGVyZWRFZGl0b3IpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRlZGl0b3JzLnNldChnbG9iLCByZWdpc3RlcmVkRWRpdG9ycyk7XG5cdFx0fVxuXHRcdHJldHVybiBlZGl0b3JzO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgYWxsIGVkaXRvcnMgYXMgYW4gYXJyYXkuIFBvc3NpYmxlIHRvIGNvbnRhaW4gZHVwbGljYXRlc1xuXHQgKi9cblx0cHJpdmF0ZSBnZXQgX3JlZ2lzdGVyZWRFZGl0b3JzKCk6IFJlZ2lzdGVyZWRFZGl0b3JzIHtcblx0XHRyZXR1cm4gQXJyYXkuZnJvbSh0aGlzLl9mbGF0dGVuZWRFZGl0b3JzLnZhbHVlcygpKS5mbGF0KCk7XG5cdH1cblxuXHR1cGRhdGVVc2VyQXNzb2NpYXRpb25zKGdsb2JQYXR0ZXJuOiBzdHJpbmcsIGVkaXRvcklEOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBuZXdBc3NvY2lhdGlvbjogRWRpdG9yQXNzb2NpYXRpb24gPSB7IHZpZXdUeXBlOiBlZGl0b3JJRCwgZmlsZW5hbWVQYXR0ZXJuOiBnbG9iUGF0dGVybiB9O1xuXHRcdGNvbnN0IGN1cnJlbnRBc3NvY2lhdGlvbnMgPSB0aGlzLmdldEFsbFVzZXJBc3NvY2lhdGlvbnMoKTtcblx0XHRjb25zdCBuZXdTZXR0aW5nT2JqZWN0ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHQvLyBGb3JtIHRoZSBuZXcgc2V0dGluZyBvYmplY3QgaW5jbHVkaW5nIHRoZSBuZXdlc3QgYXNzb2NpYXRpb25zXG5cdFx0Zm9yIChjb25zdCBhc3NvY2lhdGlvbiBvZiBbLi4uY3VycmVudEFzc29jaWF0aW9ucywgbmV3QXNzb2NpYXRpb25dKSB7XG5cdFx0XHRpZiAoYXNzb2NpYXRpb24uZmlsZW5hbWVQYXR0ZXJuKSB7XG5cdFx0XHRcdG5ld1NldHRpbmdPYmplY3RbYXNzb2NpYXRpb24uZmlsZW5hbWVQYXR0ZXJuXSA9IGFzc29jaWF0aW9uLnZpZXdUeXBlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKGVkaXRvcnNBc3NvY2lhdGlvbnNTZXR0aW5nSWQsIG5ld1NldHRpbmdPYmplY3QpO1xuXHR9XG5cblx0cHJpdmF0ZSBmaW5kTWF0Y2hpbmdFZGl0b3JzKHJlc291cmNlOiBVUkkpOiBSZWdpc3RlcmVkRWRpdG9yW10ge1xuXHRcdC8vIFRoZSB1c2VyIHNldHRpbmcgc2hvdWxkIGJlIHJlc3BlY3RlZCBldmVuIGlmIHRoZSBlZGl0b3IgZG9lc24ndCBzcGVjaWZ5IHRoYXQgcmVzb3VyY2UgaW4gcGFja2FnZS5qc29uXG5cdFx0Y29uc3QgdXNlclNldHRpbmdzID0gdGhpcy5nZXRBc3NvY2lhdGlvbnNGb3JSZXNvdXJjZShyZXNvdXJjZSk7XG5cdFx0Y29uc3QgbWF0Y2hpbmdFZGl0b3JzOiBSZWdpc3RlcmVkRWRpdG9yW10gPSBbXTtcblx0XHQvLyBUaGVuIGFsbCBnbG9iIHBhdHRlcm5zXG5cdFx0Zm9yIChjb25zdCBba2V5LCBlZGl0b3JzXSBvZiB0aGlzLl9mbGF0dGVuZWRFZGl0b3JzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBlZGl0b3JzKSB7XG5cdFx0XHRcdGNvbnN0IGZvdW5kSW5TZXR0aW5ncyA9IHVzZXJTZXR0aW5ncy5maW5kKHNldHRpbmcgPT4gc2V0dGluZy52aWV3VHlwZSA9PT0gZWRpdG9yLmVkaXRvckluZm8uaWQpO1xuXHRcdFx0XHRpZiAoKGZvdW5kSW5TZXR0aW5ncyAmJiBlZGl0b3IuZWRpdG9ySW5mby5wcmlvcml0eSAhPT0gUmVnaXN0ZXJlZEVkaXRvclByaW9yaXR5LmV4Y2x1c2l2ZSkgfHwgZ2xvYk1hdGNoZXNSZXNvdXJjZShrZXksIHJlc291cmNlKSkge1xuXHRcdFx0XHRcdG1hdGNoaW5nRWRpdG9ycy5wdXNoKGVkaXRvcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gUmV0dXJuIHRoZSBlZGl0b3JzIHNvcnRlZCBieSB0aGVpciBwcmlvcml0eVxuXHRcdHJldHVybiBtYXRjaGluZ0VkaXRvcnMuc29ydCgoYSwgYikgPT4ge1xuXHRcdFx0Ly8gVmVyeSBjcnVkZSBpZiBwcmlvcml0aWVzIG1hdGNoIGxvbmdlciBnbG9iIHdpbnMgYXMgbG9uZ2VyIGdsb2JzIGFyZSBub3JtYWxseSBtb3JlIHNwZWNpZmljXG5cdFx0XHRpZiAocHJpb3JpdHlUb1JhbmsoYi5lZGl0b3JJbmZvLnByaW9yaXR5KSA9PT0gcHJpb3JpdHlUb1JhbmsoYS5lZGl0b3JJbmZvLnByaW9yaXR5KSAmJiB0eXBlb2YgYi5nbG9iUGF0dGVybiA9PT0gJ3N0cmluZycgJiYgdHlwZW9mIGEuZ2xvYlBhdHRlcm4gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdHJldHVybiBiLmdsb2JQYXR0ZXJuLmxlbmd0aCAtIGEuZ2xvYlBhdHRlcm4ubGVuZ3RoO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHByaW9yaXR5VG9SYW5rKGIuZWRpdG9ySW5mby5wcmlvcml0eSkgLSBwcmlvcml0eVRvUmFuayhhLmVkaXRvckluZm8ucHJpb3JpdHkpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGdldEVkaXRvcnMocmVzb3VyY2U/OiBVUkkpOiBSZWdpc3RlcmVkRWRpdG9ySW5mb1tdIHtcblx0XHR0aGlzLl9mbGF0dGVuZWRFZGl0b3JzID0gdGhpcy5fZmxhdHRlbkVkaXRvcnNNYXAoKTtcblxuXHRcdC8vIEJ5IHJlc291cmNlXG5cdFx0aWYgKFVSSS5pc1VyaShyZXNvdXJjZSkpIHtcblx0XHRcdGNvbnN0IGVkaXRvcnMgPSB0aGlzLmZpbmRNYXRjaGluZ0VkaXRvcnMocmVzb3VyY2UpO1xuXHRcdFx0aWYgKGVkaXRvcnMuZmluZChlID0+IGUuZWRpdG9ySW5mby5wcmlvcml0eSA9PT0gUmVnaXN0ZXJlZEVkaXRvclByaW9yaXR5LmV4Y2x1c2l2ZSkpIHtcblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGVkaXRvcnMubWFwKGVkaXRvciA9PiBlZGl0b3IuZWRpdG9ySW5mbyk7XG5cdFx0fVxuXG5cdFx0Ly8gQWxsXG5cdFx0cmV0dXJuIGRpc3RpbmN0KHRoaXMuX3JlZ2lzdGVyZWRFZGl0b3JzLm1hcChlZGl0b3IgPT4gZWRpdG9yLmVkaXRvckluZm8pLCBlZGl0b3IgPT4gZWRpdG9yLmlkKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHaXZlbiBhIHJlc291cmNlIGFuZCBhbiBlZGl0b3JJZCBzZWxlY3RzIHRoZSBiZXN0IHBvc3NpYmxlIGVkaXRvclxuXHQgKiBAcmV0dXJucyBUaGUgZWRpdG9yIGFuZCB3aGV0aGVyIHRoZXJlIHdhcyBhbm90aGVyIGRlZmF1bHQgd2hpY2ggY29uZmxpY3RlZCB3aXRoIGl0XG5cdCAqL1xuXHRwcml2YXRlIGdldEVkaXRvcihyZXNvdXJjZTogVVJJLCBlZGl0b3JJZDogc3RyaW5nIHwgRWRpdG9yUmVzb2x1dGlvbi5FWENMVVNJVkVfT05MWSB8IHVuZGVmaW5lZCk6IHsgZWRpdG9yOiBSZWdpc3RlcmVkRWRpdG9yIHwgdW5kZWZpbmVkOyBjb25mbGljdGluZ0RlZmF1bHQ6IGJvb2xlYW4gfSB7XG5cblx0XHRjb25zdCBmaW5kTWF0Y2hpbmdFZGl0b3IgPSAoZWRpdG9yczogUmVnaXN0ZXJlZEVkaXRvcnMsIHZpZXdUeXBlOiBzdHJpbmcpID0+IHtcblx0XHRcdHJldHVybiBlZGl0b3JzLmZpbmQoKGVkaXRvcikgPT4ge1xuXHRcdFx0XHRpZiAoZWRpdG9yLm9wdGlvbnMgJiYgZWRpdG9yLm9wdGlvbnMuY2FuU3VwcG9ydFJlc291cmNlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZWRpdG9yLmVkaXRvckluZm8uaWQgPT09IHZpZXdUeXBlICYmIGVkaXRvci5vcHRpb25zLmNhblN1cHBvcnRSZXNvdXJjZShyZXNvdXJjZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGVkaXRvci5lZGl0b3JJbmZvLmlkID09PSB2aWV3VHlwZTtcblx0XHRcdH0pO1xuXHRcdH07XG5cblx0XHRpZiAoZWRpdG9ySWQgJiYgZWRpdG9ySWQgIT09IEVkaXRvclJlc29sdXRpb24uRVhDTFVTSVZFX09OTFkpIHtcblx0XHRcdC8vIFNwZWNpZmljIGlkIHBhc3NlZCBpbiBkb2Vzbid0IGhhdmUgdG8gbWF0Y2ggdGhlIHJlc291cmNlLCBpdCBjYW4gYmUgYW55dGhpbmdcblx0XHRcdGNvbnN0IHJlZ2lzdGVyZWRFZGl0b3JzID0gdGhpcy5fcmVnaXN0ZXJlZEVkaXRvcnM7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRlZGl0b3I6IGZpbmRNYXRjaGluZ0VkaXRvcihyZWdpc3RlcmVkRWRpdG9ycywgZWRpdG9ySWQpLFxuXHRcdFx0XHRjb25mbGljdGluZ0RlZmF1bHQ6IGZhbHNlXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRvcnMgPSB0aGlzLmZpbmRNYXRjaGluZ0VkaXRvcnMocmVzb3VyY2UpO1xuXG5cdFx0Y29uc3QgYXNzb2NpYXRpb25zRnJvbVNldHRpbmcgPSB0aGlzLmdldEFzc29jaWF0aW9uc0ZvclJlc291cmNlKHJlc291cmNlKTtcblx0XHQvLyBXZSBvbmx5IHdhbnQgbWluUHJpb3JpdHkrIGlmIG5vIHVzZXIgZGVmaW5lZCBzZXR0aW5nIGlzIGZvdW5kLCBlbHNlIHdlIHdvbid0IHJlc29sdmUgYW4gZWRpdG9yXG5cdFx0Y29uc3QgbWluUHJpb3JpdHkgPSBlZGl0b3JJZCA9PT0gRWRpdG9yUmVzb2x1dGlvbi5FWENMVVNJVkVfT05MWSA/IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eS5leGNsdXNpdmUgOiBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuYnVpbHRpbjtcblx0XHRsZXQgcG9zc2libGVFZGl0b3JzID0gZWRpdG9ycy5maWx0ZXIoZWRpdG9yID0+IHByaW9yaXR5VG9SYW5rKGVkaXRvci5lZGl0b3JJbmZvLnByaW9yaXR5KSA+PSBwcmlvcml0eVRvUmFuayhtaW5Qcmlvcml0eSkgJiYgZWRpdG9yLmVkaXRvckluZm8uaWQgIT09IERFRkFVTFRfRURJVE9SX0FTU09DSUFUSU9OLmlkKTtcblx0XHRpZiAocG9zc2libGVFZGl0b3JzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZWRpdG9yOiBhc3NvY2lhdGlvbnNGcm9tU2V0dGluZ1swXSAmJiBtaW5Qcmlvcml0eSAhPT0gUmVnaXN0ZXJlZEVkaXRvclByaW9yaXR5LmV4Y2x1c2l2ZSA/IGZpbmRNYXRjaGluZ0VkaXRvcihlZGl0b3JzLCBhc3NvY2lhdGlvbnNGcm9tU2V0dGluZ1swXS52aWV3VHlwZSkgOiB1bmRlZmluZWQsXG5cdFx0XHRcdGNvbmZsaWN0aW5nRGVmYXVsdDogZmFsc2Vcblx0XHRcdH07XG5cdFx0fVxuXHRcdC8vIElmIHRoZSBlZGl0b3IgaXMgZXhjbHVzaXZlIHdlIHVzZSB0aGF0LCBlbHNlIHVzZSB0aGUgdXNlciBzZXR0aW5nLCBlbHNlIHVzZSB0aGUgYnVpbHQtaW4rIGVkaXRvclxuXHRcdGNvbnN0IHNlbGVjdGVkVmlld1R5cGUgPSBwb3NzaWJsZUVkaXRvcnNbMF0uZWRpdG9ySW5mby5wcmlvcml0eSA9PT0gUmVnaXN0ZXJlZEVkaXRvclByaW9yaXR5LmV4Y2x1c2l2ZSA/XG5cdFx0XHRwb3NzaWJsZUVkaXRvcnNbMF0uZWRpdG9ySW5mby5pZCA6XG5cdFx0XHRhc3NvY2lhdGlvbnNGcm9tU2V0dGluZ1swXT8udmlld1R5cGUgfHwgcG9zc2libGVFZGl0b3JzWzBdLmVkaXRvckluZm8uaWQ7XG5cblx0XHRsZXQgY29uZmxpY3RpbmdEZWZhdWx0ID0gZmFsc2U7XG5cblx0XHQvLyBGaWx0ZXIgb3V0IGV4Y2x1c2l2ZSBiZWZvcmUgd2UgY2hlY2sgZm9yIGNvbmZsaWN0cyBhcyBleGNsdXNpdmUgZWRpdG9ycyBjYW5ub3QgYmUgbWFudWFsbHkgY2hvc2VuXG5cdFx0cG9zc2libGVFZGl0b3JzID0gcG9zc2libGVFZGl0b3JzLmZpbHRlcihlZGl0b3IgPT4gZWRpdG9yLmVkaXRvckluZm8ucHJpb3JpdHkgIT09IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eS5leGNsdXNpdmUpO1xuXHRcdGlmIChhc3NvY2lhdGlvbnNGcm9tU2V0dGluZy5sZW5ndGggPT09IDAgJiYgcG9zc2libGVFZGl0b3JzLmxlbmd0aCA+IDEpIHtcblx0XHRcdGNvbmZsaWN0aW5nRGVmYXVsdCA9IHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGVkaXRvcjogZmluZE1hdGNoaW5nRWRpdG9yKGVkaXRvcnMsIHNlbGVjdGVkVmlld1R5cGUpLFxuXHRcdFx0Y29uZmxpY3RpbmdEZWZhdWx0XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9SZXNvbHZlRWRpdG9yKGVkaXRvcjogSVVudHlwZWRFZGl0b3JJbnB1dCwgZ3JvdXA6IElFZGl0b3JHcm91cCwgc2VsZWN0ZWRFZGl0b3I6IFJlZ2lzdGVyZWRFZGl0b3IpOiBQcm9taXNlPEVkaXRvcklucHV0V2l0aE9wdGlvbnMgfCB1bmRlZmluZWQ+IHtcblx0XHRsZXQgb3B0aW9ucyA9IGVkaXRvci5vcHRpb25zO1xuXHRcdGNvbnN0IHJlc291cmNlID0gRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRDYW5vbmljYWxVcmkoZWRpdG9yLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSk7XG5cdFx0Ly8gSWYgbm8gYWN0aXZhdGlvbiBvcHRpb24gaXMgcHJvdmlkZWQsIHBvcHVsYXRlIGl0LlxuXHRcdGlmIChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLmFjdGl2YXRpb24gPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBhY3RpdmF0aW9uOiBvcHRpb25zLnByZXNlcnZlRm9jdXMgPyBFZGl0b3JBY3RpdmF0aW9uLlJFU1RPUkUgOiB1bmRlZmluZWQgfTtcblx0XHR9XG5cblx0XHQvLyBJZiBpdCdzIGEgbWVyZ2UgZWRpdG9yIHdlIHRyaWdnZXIgdGhlIGNyZWF0ZSBtZXJnZSBlZGl0b3IgaW5wdXRcblx0XHRpZiAoaXNSZXNvdXJjZU1lcmdlRWRpdG9ySW5wdXQoZWRpdG9yKSkge1xuXHRcdFx0aWYgKCFzZWxlY3RlZEVkaXRvci5lZGl0b3JGYWN0b3J5T2JqZWN0LmNyZWF0ZU1lcmdlRWRpdG9ySW5wdXQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaW5wdXRXaXRoT3B0aW9ucyA9IGF3YWl0IHNlbGVjdGVkRWRpdG9yLmVkaXRvckZhY3RvcnlPYmplY3QuY3JlYXRlTWVyZ2VFZGl0b3JJbnB1dChlZGl0b3IsIGdyb3VwKTtcblx0XHRcdHJldHVybiB7IGVkaXRvcjogaW5wdXRXaXRoT3B0aW9ucy5lZGl0b3IsIG9wdGlvbnM6IGlucHV0V2l0aE9wdGlvbnMub3B0aW9ucyA/PyBvcHRpb25zIH07XG5cdFx0fVxuXG5cdFx0Ly8gSWYgaXQncyBhIGRpZmYgZWRpdG9yIHdlIHRyaWdnZXIgdGhlIGNyZWF0ZSBkaWZmIGVkaXRvciBpbnB1dFxuXHRcdGlmIChpc1Jlc291cmNlRGlmZkVkaXRvcklucHV0KGVkaXRvcikpIHtcblx0XHRcdGlmICghc2VsZWN0ZWRFZGl0b3IuZWRpdG9yRmFjdG9yeU9iamVjdC5jcmVhdGVEaWZmRWRpdG9ySW5wdXQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaW5wdXRXaXRoT3B0aW9ucyA9IGF3YWl0IHNlbGVjdGVkRWRpdG9yLmVkaXRvckZhY3RvcnlPYmplY3QuY3JlYXRlRGlmZkVkaXRvcklucHV0KGVkaXRvciwgZ3JvdXApO1xuXHRcdFx0cmV0dXJuIHsgZWRpdG9yOiBpbnB1dFdpdGhPcHRpb25zLmVkaXRvciwgb3B0aW9uczogaW5wdXRXaXRoT3B0aW9ucy5vcHRpb25zID8/IG9wdGlvbnMgfTtcblx0XHR9XG5cblx0XHQvLyBJZiBpdCdzIGEgZGlmZiBsaXN0IGVkaXRvciB3ZSB0cmlnZ2VyIHRoZSBjcmVhdGUgZGlmZiBsaXN0IGVkaXRvciBpbnB1dFxuXHRcdGlmIChpc1Jlc291cmNlTXVsdGlEaWZmRWRpdG9ySW5wdXQoZWRpdG9yKSkge1xuXHRcdFx0aWYgKCFzZWxlY3RlZEVkaXRvci5lZGl0b3JGYWN0b3J5T2JqZWN0LmNyZWF0ZU11bHRpRGlmZkVkaXRvcklucHV0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGlucHV0V2l0aE9wdGlvbnMgPSBhd2FpdCBzZWxlY3RlZEVkaXRvci5lZGl0b3JGYWN0b3J5T2JqZWN0LmNyZWF0ZU11bHRpRGlmZkVkaXRvcklucHV0KGVkaXRvciwgZ3JvdXApO1xuXHRcdFx0cmV0dXJuIHsgZWRpdG9yOiBpbnB1dFdpdGhPcHRpb25zLmVkaXRvciwgb3B0aW9uczogaW5wdXRXaXRoT3B0aW9ucy5vcHRpb25zID8/IG9wdGlvbnMgfTtcblx0XHR9XG5cblx0XHRpZiAoaXNSZXNvdXJjZVNpZGVCeVNpZGVFZGl0b3JJbnB1dChlZGl0b3IpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFVudHlwZWQgc2lkZSBieSBzaWRlIGVkaXRvciBpbnB1dCBub3Qgc3VwcG9ydGVkIGhlcmUuYCk7XG5cdFx0fVxuXG5cdFx0aWYgKGlzVW50aXRsZWRSZXNvdXJjZUVkaXRvcklucHV0KGVkaXRvcikpIHtcblx0XHRcdGlmICghc2VsZWN0ZWRFZGl0b3IuZWRpdG9yRmFjdG9yeU9iamVjdC5jcmVhdGVVbnRpdGxlZEVkaXRvcklucHV0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGlucHV0V2l0aE9wdGlvbnMgPSBhd2FpdCBzZWxlY3RlZEVkaXRvci5lZGl0b3JGYWN0b3J5T2JqZWN0LmNyZWF0ZVVudGl0bGVkRWRpdG9ySW5wdXQoZWRpdG9yLCBncm91cCk7XG5cdFx0XHRyZXR1cm4geyBlZGl0b3I6IGlucHV0V2l0aE9wdGlvbnMuZWRpdG9yLCBvcHRpb25zOiBpbnB1dFdpdGhPcHRpb25zLm9wdGlvbnMgPz8gb3B0aW9ucyB9O1xuXHRcdH1cblxuXHRcdC8vIFNob3VsZCBubyBsb25nZXIgaGF2ZSBhbiB1bmRlZmluZWQgcmVzb3VyY2Ugc28gbGV0cyB0aHJvdyBhbiBlcnJvciBpZiB0aGF0J3Mgc29tZWhvdyB0aGUgY2FzZVxuXHRcdGlmIChyZXNvdXJjZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFVuZGVmaW5lZCByZXNvdXJjZSBvbiBub24gdW50aXRsZWQgZWRpdG9yIGlucHV0LmApO1xuXHRcdH1cblxuXHRcdC8vIElmIHRoZSBlZGl0b3Igc3RhdGVzIGl0IGNhbiBvbmx5IGJlIG9wZW5lZCBvbmNlIHBlciByZXNvdXJjZSB3ZSBtdXN0IGNsb3NlIGFsbCBleGlzdGluZyBvbmVzIGV4Y2VwdCBvbmUgYW5kIG1vdmUgdGhlIG5ldyBvbmUgaW50byB0aGUgZ3JvdXBcblx0XHRjb25zdCBzaW5nbGVFZGl0b3JQZXJSZXNvdXJjZSA9IHR5cGVvZiBzZWxlY3RlZEVkaXRvci5vcHRpb25zPy5zaW5nbGVQZXJSZXNvdXJjZSA9PT0gJ2Z1bmN0aW9uJyA/IHNlbGVjdGVkRWRpdG9yLm9wdGlvbnMuc2luZ2xlUGVyUmVzb3VyY2UoKSA6IHNlbGVjdGVkRWRpdG9yLm9wdGlvbnM/LnNpbmdsZVBlclJlc291cmNlO1xuXHRcdGlmIChzaW5nbGVFZGl0b3JQZXJSZXNvdXJjZSkge1xuXHRcdFx0Y29uc3QgZXhpc3RpbmdFZGl0b3JzID0gdGhpcy5maW5kRXhpc3RpbmdFZGl0b3JzRm9yUmVzb3VyY2UocmVzb3VyY2UsIHNlbGVjdGVkRWRpdG9yLmVkaXRvckluZm8uaWQpO1xuXHRcdFx0aWYgKGV4aXN0aW5nRWRpdG9ycy5sZW5ndGgpIHtcblx0XHRcdFx0Y29uc3QgZWRpdG9yID0gYXdhaXQgdGhpcy5tb3ZlRXhpc3RpbmdFZGl0b3JGb3JSZXNvdXJjZShleGlzdGluZ0VkaXRvcnMsIGdyb3VwKTtcblx0XHRcdFx0aWYgKGVkaXRvcikge1xuXHRcdFx0XHRcdHJldHVybiB7IGVkaXRvciwgb3B0aW9ucyB9O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybjsgLy8gZmFpbGVkIHRvIG1vdmVcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIElmIG5vIGZhY3RvcnkgaXMgYWJvdmUsIHJldHVybiBmbG93IGJhY2sgdG8gY2FsbGVyIGxldHRpbmcgdGhlbSBrbm93IHdlIGNvdWxkIG5vdCByZXNvbHZlIGl0XG5cdFx0aWYgKCFzZWxlY3RlZEVkaXRvci5lZGl0b3JGYWN0b3J5T2JqZWN0LmNyZWF0ZUVkaXRvcklucHV0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gUmVzcGVjdCBvcHRpb25zIHBhc3NlZCBiYWNrXG5cdFx0Y29uc3QgaW5wdXRXaXRoT3B0aW9ucyA9IGF3YWl0IHNlbGVjdGVkRWRpdG9yLmVkaXRvckZhY3RvcnlPYmplY3QuY3JlYXRlRWRpdG9ySW5wdXQoZWRpdG9yLCBncm91cCk7XG5cdFx0b3B0aW9ucyA9IGlucHV0V2l0aE9wdGlvbnMub3B0aW9ucyA/PyBvcHRpb25zO1xuXHRcdGNvbnN0IGlucHV0ID0gaW5wdXRXaXRoT3B0aW9ucy5lZGl0b3I7XG5cblx0XHRyZXR1cm4geyBlZGl0b3I6IGlucHV0LCBvcHRpb25zIH07XG5cdH1cblxuXHQvKipcblx0ICogTW92ZXMgdGhlIGZpcnN0IGV4aXN0aW5nIGVkaXRvciBmb3IgYSByZXNvdXJjZSB0byB0aGUgdGFyZ2V0IGdyb3VwIHVubGVzcyBhbHJlYWR5IG9wZW5lZCB0aGVyZS5cblx0ICogQWRkaXRpb25hbGx5IHdpbGwgY2xvc2UgYW55IG90aGVyIGVkaXRvcnMgdGhhdCBhcmUgb3BlbiBmb3IgdGhhdCByZXNvdXJjZSBhbmQgdmlld3R5cGUgYmVzaWRlcyB0aGUgZmlyc3Qgb25lIGZvdW5kXG5cdCAqIEBwYXJhbSByZXNvdXJjZSBUaGUgcmVzb3VyY2Ugb2YgdGhlIGVkaXRvclxuXHQgKiBAcGFyYW0gdmlld1R5cGUgdGhlIHZpZXd0eXBlIG9mIHRoZSBlZGl0b3Jcblx0ICogQHBhcmFtIHRhcmdldEdyb3VwIFRoZSBncm91cCB0byBtb3ZlIGl0IHRvXG5cdCAqIEByZXR1cm5zIFRoZSBtb3ZlZCBlZGl0b3IgaW5wdXQgb3IgYHVuZGVmaW5lZGAgaWYgdGhlIGVkaXRvciBjb3VsZCBub3QgYmUgbW92ZWRcblx0ICovXG5cdHByaXZhdGUgYXN5bmMgbW92ZUV4aXN0aW5nRWRpdG9yRm9yUmVzb3VyY2UoXG5cdFx0ZXhpc3RpbmdFZGl0b3JzRm9yUmVzb3VyY2U6IEFycmF5PHsgZWRpdG9yOiBFZGl0b3JJbnB1dDsgZ3JvdXA6IElFZGl0b3JHcm91cCB9Pixcblx0XHR0YXJnZXRHcm91cDogSUVkaXRvckdyb3VwLFxuXHQpOiBQcm9taXNlPEVkaXRvcklucHV0IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZWRpdG9yVG9Vc2UgPSBleGlzdGluZ0VkaXRvcnNGb3JSZXNvdXJjZVswXTtcblxuXHRcdC8vIFdlIHNob3VsZCBvbmx5IGhhdmUgb25lIGVkaXRvciBidXQgaWYgdGhlcmUgYXJlIG11bHRpcGxlIHdlIGNsb3NlIHRoZSBvdGhlcnNcblx0XHRmb3IgKGNvbnN0IHsgZWRpdG9yLCBncm91cCB9IG9mIGV4aXN0aW5nRWRpdG9yc0ZvclJlc291cmNlKSB7XG5cdFx0XHRpZiAoZWRpdG9yICE9PSBlZGl0b3JUb1VzZS5lZGl0b3IpIHtcblx0XHRcdFx0Y29uc3QgY2xvc2VkID0gYXdhaXQgZ3JvdXAuY2xvc2VFZGl0b3IoZWRpdG9yKTtcblx0XHRcdFx0aWYgKCFjbG9zZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBNb3ZlIHRoZSBlZGl0b3IgYWxyZWFkeSBvcGVuZWQgdG8gdGhlIHRhcmdldCBncm91cFxuXHRcdGlmICh0YXJnZXRHcm91cC5pZCAhPT0gZWRpdG9yVG9Vc2UuZ3JvdXAuaWQpIHtcblx0XHRcdGNvbnN0IG1vdmVkID0gZWRpdG9yVG9Vc2UuZ3JvdXAubW92ZUVkaXRvcihlZGl0b3JUb1VzZS5lZGl0b3IsIHRhcmdldEdyb3VwKTtcblx0XHRcdGlmICghbW92ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBlZGl0b3JUb1VzZS5lZGl0b3I7XG5cdH1cblxuXHQvKipcblx0ICogR2l2ZW4gYSByZXNvdXJjZSBhbmQgYW4gZWRpdG9ySWQsIHJldHVybnMgYWxsIGVkaXRvcnMgb3BlbiBmb3IgdGhhdCByZXNvdXJjZSBhbmQgZWRpdG9ySWQuXG5cdCAqIEBwYXJhbSByZXNvdXJjZSBUaGUgcmVzb3VyY2Ugc3BlY2lmaWVkXG5cdCAqIEBwYXJhbSBlZGl0b3JJZCBUaGUgZWRpdG9ySURcblx0ICogQHJldHVybnMgQSBsaXN0IG9mIGVkaXRvcnNcblx0ICovXG5cdHByaXZhdGUgZmluZEV4aXN0aW5nRWRpdG9yc0ZvclJlc291cmNlKFxuXHRcdHJlc291cmNlOiBVUkksXG5cdFx0ZWRpdG9ySWQ6IHN0cmluZyxcblx0KTogQXJyYXk8eyBlZGl0b3I6IEVkaXRvcklucHV0OyBncm91cDogSUVkaXRvckdyb3VwIH0+IHtcblx0XHRjb25zdCBvdXQ6IEFycmF5PHsgZWRpdG9yOiBFZGl0b3JJbnB1dDsgZ3JvdXA6IElFZGl0b3JHcm91cCB9PiA9IFtdO1xuXHRcdGNvbnN0IG9yZGVyZWRHcm91cHMgPSBkaXN0aW5jdChbXG5cdFx0XHQuLi50aGlzLmVkaXRvckdyb3VwU2VydmljZS5ncm91cHMsXG5cdFx0XSk7XG5cblx0XHRmb3IgKGNvbnN0IGdyb3VwIG9mIG9yZGVyZWRHcm91cHMpIHtcblx0XHRcdGZvciAoY29uc3QgZWRpdG9yIG9mIGdyb3VwLmVkaXRvcnMpIHtcblx0XHRcdFx0aWYgKGlzRXF1YWwoZWRpdG9yLnJlc291cmNlLCByZXNvdXJjZSkgJiYgZWRpdG9yLmVkaXRvcklkID09PSBlZGl0b3JJZCkge1xuXHRcdFx0XHRcdG91dC5wdXNoKHsgZWRpdG9yLCBncm91cCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gb3V0O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb0hhbmRsZUNvbmZsaWN0aW5nRGVmYXVsdHMocmVzb3VyY2U6IFVSSSwgZWRpdG9yTmFtZTogc3RyaW5nLCB1bnR5cGVkSW5wdXQ6IElVbnR5cGVkRWRpdG9ySW5wdXQsIGN1cnJlbnRFZGl0b3I6IEVkaXRvcklucHV0LCBncm91cDogSUVkaXRvckdyb3VwKSB7XG5cdFx0dHlwZSBTdG9yZWRDaG9pY2UgPSB7XG5cdFx0XHRba2V5OiBzdHJpbmddOiBzdHJpbmdbXTtcblx0XHR9O1xuXHRcdGNvbnN0IGVkaXRvcnMgPSB0aGlzLmZpbmRNYXRjaGluZ0VkaXRvcnMocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHN0b3JlZENob2ljZXM6IFN0b3JlZENob2ljZSA9IEpTT04ucGFyc2UodGhpcy5zdG9yYWdlU2VydmljZS5nZXQoRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLmNvbmZsaWN0aW5nRGVmYXVsdHNTdG9yYWdlSUQsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCAne30nKSk7XG5cdFx0Y29uc3QgZ2xvYkZvclJlc291cmNlID0gYCoke2V4dG5hbWUocmVzb3VyY2UpfWA7XG5cdFx0Ly8gV3JpdGVzIHRvIHRoZSBzdG9yYWdlIHNlcnZpY2UgdGhhdCBhIGNob2ljZSBoYXMgYmVlbiBtYWRlIGZvciB0aGUgY3VycmVudGx5IGluc3RhbGxlZCBlZGl0b3JzXG5cdFx0Y29uc3Qgd3JpdGVDdXJyZW50RWRpdG9yc1RvU3RvcmFnZSA9ICgpID0+IHtcblx0XHRcdHN0b3JlZENob2ljZXNbZ2xvYkZvclJlc291cmNlXSA9IFtdO1xuXHRcdFx0ZWRpdG9ycy5mb3JFYWNoKGVkaXRvciA9PiBzdG9yZWRDaG9pY2VzW2dsb2JGb3JSZXNvdXJjZV0ucHVzaChlZGl0b3IuZWRpdG9ySW5mby5pZCkpO1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShFZGl0b3JSZXNvbHZlclNlcnZpY2UuY29uZmxpY3RpbmdEZWZhdWx0c1N0b3JhZ2VJRCwgSlNPTi5zdHJpbmdpZnkoc3RvcmVkQ2hvaWNlcyksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdH07XG5cblx0XHQvLyBJZiB0aGUgdXNlciBoYXMgYWxyZWFkeSBtYWRlIGEgY2hvaWNlIGZvciB0aGlzIGVkaXRvciB3ZSBkb24ndCB3YW50IHRvIGFzayB0aGVtIGFnYWluXG5cdFx0aWYgKHN0b3JlZENob2ljZXNbZ2xvYkZvclJlc291cmNlXSAmJiBzdG9yZWRDaG9pY2VzW2dsb2JGb3JSZXNvdXJjZV0uZmluZChlZGl0b3JJRCA9PiBlZGl0b3JJRCA9PT0gY3VycmVudEVkaXRvci5lZGl0b3JJZCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFNldmVyaXR5Lldhcm5pbmcsXG5cdFx0XHRsb2NhbGl6ZSgnZWRpdG9yUmVzb2x2ZXIuY29uZmxpY3RpbmdEZWZhdWx0cycsICdUaGVyZSBhcmUgbXVsdGlwbGUgZGVmYXVsdCBlZGl0b3JzIGF2YWlsYWJsZSBmb3IgdGhlIHJlc291cmNlLicpLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdlZGl0b3JSZXNvbHZlci5jb25maWd1cmVEZWZhdWx0JywgJ0NvbmZpZ3VyZSBEZWZhdWx0JyksXG5cdFx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdC8vIFNob3cgdGhlIHBpY2tlciBhbmQgdGVsbCBpdCB0byB1cGRhdGUgdGhlIHNldHRpbmcgdG8gd2hhdGV2ZXIgdGhlIHVzZXIgc2VsZWN0ZWRcblx0XHRcdFx0XHRjb25zdCBwaWNrZWQgPSBhd2FpdCB0aGlzLmRvUGlja0VkaXRvcih1bnR5cGVkSW5wdXQsIHRydWUpO1xuXHRcdFx0XHRcdGlmICghcGlja2VkKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHVudHlwZWRJbnB1dC5vcHRpb25zID0gcGlja2VkO1xuXHRcdFx0XHRcdGNvbnN0IHJlcGxhY2VtZW50RWRpdG9yID0gYXdhaXQgdGhpcy5yZXNvbHZlRWRpdG9yKHVudHlwZWRJbnB1dCwgZ3JvdXApO1xuXHRcdFx0XHRcdGlmIChyZXBsYWNlbWVudEVkaXRvciA9PT0gUmVzb2x2ZWRTdGF0dXMuQUJPUlQgfHwgcmVwbGFjZW1lbnRFZGl0b3IgPT09IFJlc29sdmVkU3RhdHVzLk5PTkUpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gUmVwbGFjZSB0aGUgY3VycmVudCBlZGl0b3Igd2l0aCB0aGUgcGlja2VkIG9uZVxuXHRcdFx0XHRcdGdyb3VwLnJlcGxhY2VFZGl0b3JzKFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0ZWRpdG9yOiBjdXJyZW50RWRpdG9yLFxuXHRcdFx0XHRcdFx0XHRyZXBsYWNlbWVudDogcmVwbGFjZW1lbnRFZGl0b3IuZWRpdG9yLFxuXHRcdFx0XHRcdFx0XHRvcHRpb25zOiByZXBsYWNlbWVudEVkaXRvci5vcHRpb25zID8/IHBpY2tlZCxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRdKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdlZGl0b3JSZXNvbHZlci5rZWVwRGVmYXVsdCcsICdLZWVwIHswfScsIGVkaXRvck5hbWUpLFxuXHRcdFx0XHRydW46IHdyaXRlQ3VycmVudEVkaXRvcnNUb1N0b3JhZ2Vcblx0XHRcdH1cblx0XHRcdF0pO1xuXHRcdC8vIElmIHRoZSB1c2VyIHByZXNzZWQgWCB3ZSBhc3N1bWUgdGhleSB3YW50IHRvIGtlZXAgdGhlIGN1cnJlbnQgZWRpdG9yIGFzIGRlZmF1bHRcblx0XHRjb25zdCBvbkNsb3NlTGlzdGVuZXIgPSBoYW5kbGUub25EaWRDbG9zZSgoKSA9PiB7XG5cdFx0XHR3cml0ZUN1cnJlbnRFZGl0b3JzVG9TdG9yYWdlKCk7XG5cdFx0XHRvbkNsb3NlTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBtYXBFZGl0b3JzVG9RdWlja1BpY2tFbnRyeShyZXNvdXJjZTogVVJJLCBzaG93RGVmYXVsdFBpY2tlcj86IGJvb2xlYW4pIHtcblx0XHRjb25zdCBjdXJyZW50RWRpdG9yID0gdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXAuZmluZEVkaXRvcnMocmVzb3VyY2UpLmF0KDApO1xuXHRcdC8vIElmIHVudGl0bGVkLCB3ZSB3YW50IGFsbCByZWdpc3RlcmVkIGVkaXRvcnNcblx0XHRsZXQgcmVnaXN0ZXJlZEVkaXRvcnMgPSByZXNvdXJjZS5zY2hlbWUgPT09IFNjaGVtYXMudW50aXRsZWQgPyB0aGlzLl9yZWdpc3RlcmVkRWRpdG9ycy5maWx0ZXIoZSA9PiBlLmVkaXRvckluZm8ucHJpb3JpdHkgIT09IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eS5leGNsdXNpdmUpIDogdGhpcy5maW5kTWF0Y2hpbmdFZGl0b3JzKHJlc291cmNlKTtcblx0XHQvLyBXZSBkb24ndCB3YW50IGR1cGxpY2F0ZSBJZCBlbnRyaWVzXG5cdFx0cmVnaXN0ZXJlZEVkaXRvcnMgPSBkaXN0aW5jdChyZWdpc3RlcmVkRWRpdG9ycywgYyA9PiBjLmVkaXRvckluZm8uaWQpO1xuXHRcdGNvbnN0IGRlZmF1bHRTZXR0aW5nID0gdGhpcy5nZXRBc3NvY2lhdGlvbnNGb3JSZXNvdXJjZShyZXNvdXJjZSlbMF0/LnZpZXdUeXBlO1xuXHRcdC8vIE5vdCB0aGUgbW9zdCBlZmZpY2llbnQgd2F5IHRvIGRvIHRoaXMsIGJ1dCB3ZSB3YW50IHRvIGVuc3VyZSB0aGUgdGV4dCBlZGl0b3IgaXMgYXQgdGhlIHRvcCBvZiB0aGUgcXVpY2twaWNrXG5cdFx0cmVnaXN0ZXJlZEVkaXRvcnMgPSByZWdpc3RlcmVkRWRpdG9ycy5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRpZiAoYS5lZGl0b3JJbmZvLmlkID09PSBERUZBVUxUX0VESVRPUl9BU1NPQ0lBVElPTi5pZCkge1xuXHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHR9IGVsc2UgaWYgKGIuZWRpdG9ySW5mby5pZCA9PT0gREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04uaWQpIHtcblx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gcHJpb3JpdHlUb1JhbmsoYi5lZGl0b3JJbmZvLnByaW9yaXR5KSAtIHByaW9yaXR5VG9SYW5rKGEuZWRpdG9ySW5mby5wcmlvcml0eSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0Y29uc3QgcXVpY2tQaWNrRW50cmllczogQXJyYXk8UXVpY2tQaWNrSXRlbT4gPSBbXTtcblx0XHRjb25zdCBjdXJyZW50bHlBY3RpdmVMYWJlbCA9IGxvY2FsaXplKCdwcm9tcHRPcGVuV2l0aC5jdXJyZW50bHlBY3RpdmUnLCBcIkFjdGl2ZVwiKTtcblx0XHRjb25zdCBjdXJyZW50RGVmYXVsdExhYmVsID0gbG9jYWxpemUoJ3Byb21wdE9wZW5XaXRoLmN1cnJlbnREZWZhdWx0JywgXCJEZWZhdWx0XCIpO1xuXHRcdGNvbnN0IGN1cnJlbnREZWZhdWx0QW5kQWN0aXZlTGFiZWwgPSBsb2NhbGl6ZSgncHJvbXB0T3BlbldpdGguY3VycmVudERlZmF1bHRBbmRBY3RpdmUnLCBcIkFjdGl2ZSBhbmQgRGVmYXVsdFwiKTtcblx0XHQvLyBEZWZhdWx0IG9yZGVyID0gc2V0dGluZyAtPiBoaWdoZXN0IHByaW9yaXR5IC0+IHRleHRcblx0XHRsZXQgZGVmYXVsdFZpZXdUeXBlID0gZGVmYXVsdFNldHRpbmc7XG5cdFx0aWYgKCFkZWZhdWx0Vmlld1R5cGUgJiYgcmVnaXN0ZXJlZEVkaXRvcnMubGVuZ3RoID4gMiAmJiByZWdpc3RlcmVkRWRpdG9yc1sxXT8uZWRpdG9ySW5mby5wcmlvcml0eSAhPT0gUmVnaXN0ZXJlZEVkaXRvclByaW9yaXR5Lm9wdGlvbikge1xuXHRcdFx0ZGVmYXVsdFZpZXdUeXBlID0gcmVnaXN0ZXJlZEVkaXRvcnNbMV0/LmVkaXRvckluZm8uaWQ7XG5cdFx0fVxuXHRcdGlmICghZGVmYXVsdFZpZXdUeXBlKSB7XG5cdFx0XHRkZWZhdWx0Vmlld1R5cGUgPSBERUZBVUxUX0VESVRPUl9BU1NPQ0lBVElPTi5pZDtcblx0XHR9XG5cdFx0Ly8gTWFwIHRoZSBlZGl0b3JzIHRvIHF1aWNrcGljayBlbnRyaWVzXG5cdFx0cmVnaXN0ZXJlZEVkaXRvcnMuZm9yRWFjaChlZGl0b3IgPT4ge1xuXHRcdFx0Y29uc3QgY3VycmVudFZpZXdUeXBlID0gY3VycmVudEVkaXRvcj8uZWRpdG9ySWQgPz8gREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04uaWQ7XG5cdFx0XHRjb25zdCBpc0FjdGl2ZSA9IGN1cnJlbnRFZGl0b3IgPyBlZGl0b3IuZWRpdG9ySW5mby5pZCA9PT0gY3VycmVudFZpZXdUeXBlIDogZmFsc2U7XG5cdFx0XHRjb25zdCBpc0RlZmF1bHQgPSBlZGl0b3IuZWRpdG9ySW5mby5pZCA9PT0gZGVmYXVsdFZpZXdUeXBlO1xuXHRcdFx0Y29uc3QgcXVpY2tQaWNrRW50cnk6IElRdWlja1BpY2tJdGVtID0ge1xuXHRcdFx0XHRpZDogZWRpdG9yLmVkaXRvckluZm8uaWQsXG5cdFx0XHRcdGxhYmVsOiBlZGl0b3IuZWRpdG9ySW5mby5sYWJlbCxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGlzQWN0aXZlICYmIGlzRGVmYXVsdCA/IGN1cnJlbnREZWZhdWx0QW5kQWN0aXZlTGFiZWwgOiBpc0FjdGl2ZSA/IGN1cnJlbnRseUFjdGl2ZUxhYmVsIDogaXNEZWZhdWx0ID8gY3VycmVudERlZmF1bHRMYWJlbCA6IHVuZGVmaW5lZCxcblx0XHRcdFx0ZGV0YWlsOiBlZGl0b3IuZWRpdG9ySW5mby5kZXRhaWwgPz8gZWRpdG9yLmVkaXRvckluZm8ucHJpb3JpdHksXG5cdFx0XHR9O1xuXHRcdFx0cXVpY2tQaWNrRW50cmllcy5wdXNoKHF1aWNrUGlja0VudHJ5KTtcblx0XHR9KTtcblx0XHRpZiAoIXNob3dEZWZhdWx0UGlja2VyICYmIGV4dG5hbWUocmVzb3VyY2UpICE9PSAnJykge1xuXHRcdFx0Y29uc3Qgc2VwYXJhdG9yOiBJUXVpY2tQaWNrU2VwYXJhdG9yID0geyB0eXBlOiAnc2VwYXJhdG9yJyB9O1xuXHRcdFx0cXVpY2tQaWNrRW50cmllcy5wdXNoKHNlcGFyYXRvcik7XG5cdFx0XHRjb25zdCBjb25maWd1cmVEZWZhdWx0RW50cnkgPSB7XG5cdFx0XHRcdGlkOiBFZGl0b3JSZXNvbHZlclNlcnZpY2UuY29uZmlndXJlRGVmYXVsdElELFxuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3Byb21wdE9wZW5XaXRoLmNvbmZpZ3VyZURlZmF1bHQnLCBcIkNvbmZpZ3VyZSBkZWZhdWx0IGVkaXRvciBmb3IgJ3swfScuLi5cIiwgYCoke2V4dG5hbWUocmVzb3VyY2UpfWApLFxuXHRcdFx0fTtcblx0XHRcdHF1aWNrUGlja0VudHJpZXMucHVzaChjb25maWd1cmVEZWZhdWx0RW50cnkpO1xuXHRcdH1cblx0XHRyZXR1cm4gcXVpY2tQaWNrRW50cmllcztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9QaWNrRWRpdG9yKGVkaXRvcjogSVVudHlwZWRFZGl0b3JJbnB1dCwgc2hvd0RlZmF1bHRQaWNrZXI/OiBib29sZWFuKTogUHJvbWlzZTxJRWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZD4ge1xuXG5cdFx0dHlwZSBFZGl0b3JQaWNrID0ge1xuXHRcdFx0cmVhZG9ubHkgaXRlbTogSVF1aWNrUGlja0l0ZW07XG5cdFx0XHRyZWFkb25seSBrZXlNb2RzPzogSUtleU1vZHM7XG5cdFx0XHRyZWFkb25seSBvcGVuSW5CYWNrZ3JvdW5kOiBib29sZWFuO1xuXHRcdH07XG5cblx0XHRsZXQgcmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pO1xuXG5cdFx0aWYgKHJlc291cmNlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJlc291cmNlID0gVVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMudW50aXRsZWQgfSk7XG5cdFx0fVxuXG5cdFx0Ly8gR2V0IGFsbCB0aGUgZWRpdG9ycyBmb3IgdGhlIHJlc291cmNlIGFzIHF1aWNrcGljayBlbnRyaWVzXG5cdFx0Y29uc3QgZWRpdG9yUGlja3MgPSB0aGlzLm1hcEVkaXRvcnNUb1F1aWNrUGlja0VudHJ5KHJlc291cmNlLCBzaG93RGVmYXVsdFBpY2tlcik7XG5cblx0XHQvLyBDcmVhdGUgdGhlIGVkaXRvciBwaWNrZXJcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBlZGl0b3JQaWNrZXIgPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5xdWlja0lucHV0U2VydmljZS5jcmVhdGVRdWlja1BpY2s8SVF1aWNrUGlja0l0ZW0+KHsgdXNlU2VwYXJhdG9yczogdHJ1ZSB9KSk7XG5cdFx0Y29uc3QgcGxhY2VIb2xkZXJNZXNzYWdlID0gc2hvd0RlZmF1bHRQaWNrZXIgP1xuXHRcdFx0bG9jYWxpemUoJ3Byb21wdE9wZW5XaXRoLnVwZGF0ZURlZmF1bHRQbGFjZUhvbGRlcicsIFwiU2VsZWN0IG5ldyBkZWZhdWx0IGVkaXRvciBmb3IgJ3swfSdcIiwgYCoke2V4dG5hbWUocmVzb3VyY2UpfWApIDpcblx0XHRcdGxvY2FsaXplKCdwcm9tcHRPcGVuV2l0aC5wbGFjZUhvbGRlcicsIFwiU2VsZWN0IGVkaXRvciBmb3IgJ3swfSdcIiwgYmFzZW5hbWUocmVzb3VyY2UpKTtcblx0XHRlZGl0b3JQaWNrZXIucGxhY2Vob2xkZXIgPSBwbGFjZUhvbGRlck1lc3NhZ2U7XG5cdFx0ZWRpdG9yUGlja2VyLmNhbkFjY2VwdEluQmFja2dyb3VuZCA9IHRydWU7XG5cdFx0ZWRpdG9yUGlja2VyLml0ZW1zID0gZWRpdG9yUGlja3M7XG5cdFx0Y29uc3QgZmlyc3RJdGVtID0gZWRpdG9yUGlja2VyLml0ZW1zLmZpbmQoaXRlbSA9PiBpdGVtLnR5cGUgPT09ICdpdGVtJykgYXMgSVF1aWNrUGlja0l0ZW0gfCB1bmRlZmluZWQ7XG5cdFx0aWYgKGZpcnN0SXRlbSkge1xuXHRcdFx0ZWRpdG9yUGlja2VyLnNlbGVjdGVkSXRlbXMgPSBbZmlyc3RJdGVtXTtcblx0XHR9XG5cblx0XHQvLyBQcm9tcHQgdGhlIHVzZXIgdG8gc2VsZWN0IGFuIGVkaXRvclxuXHRcdGNvbnN0IHBpY2tlZDogRWRpdG9yUGljayB8IHVuZGVmaW5lZCA9IGF3YWl0IG5ldyBQcm9taXNlPEVkaXRvclBpY2sgfCB1bmRlZmluZWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGVkaXRvclBpY2tlci5vbkRpZEFjY2VwdChlID0+IHtcblx0XHRcdFx0bGV0IHJlc3VsdDogRWRpdG9yUGljayB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdFx0XHRpZiAoZWRpdG9yUGlja2VyLnNlbGVjdGVkSXRlbXMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdFx0cmVzdWx0ID0ge1xuXHRcdFx0XHRcdFx0aXRlbTogZWRpdG9yUGlja2VyLnNlbGVjdGVkSXRlbXNbMF0sXG5cdFx0XHRcdFx0XHRrZXlNb2RzOiBlZGl0b3JQaWNrZXIua2V5TW9kcyxcblx0XHRcdFx0XHRcdG9wZW5JbkJhY2tncm91bmQ6IGUuaW5CYWNrZ3JvdW5kXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIElmIGFza2VkIHRvIGFsd2F5cyB1cGRhdGUgdGhlIHNldHRpbmcgdGhlbiB1cGRhdGUgaXQgZXZlbiBpZiB0aGUgZ2VhciBpc24ndCBjbGlja2VkXG5cdFx0XHRcdGlmIChyZXNvdXJjZSAmJiBzaG93RGVmYXVsdFBpY2tlciAmJiByZXN1bHQ/Lml0ZW0uaWQpIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZVVzZXJBc3NvY2lhdGlvbnMoYCoke2V4dG5hbWUocmVzb3VyY2UpfWAsIHJlc3VsdC5pdGVtLmlkLCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXNvbHZlKHJlc3VsdCk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZChlZGl0b3JQaWNrZXIub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHRyZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZChlZGl0b3JQaWNrZXIub25EaWRUcmlnZ2VySXRlbUJ1dHRvbihlID0+IHtcblxuXHRcdFx0XHQvLyBUcmlnZ2VyIG9wZW5pbmcgYW5kIGNsb3NlIHBpY2tlclxuXHRcdFx0XHRyZXNvbHZlKHsgaXRlbTogZS5pdGVtLCBvcGVuSW5CYWNrZ3JvdW5kOiBmYWxzZSB9KTtcblxuXHRcdFx0XHQvLyBQZXJzaXN0IHNldHRpbmdcblx0XHRcdFx0aWYgKHJlc291cmNlICYmIGUuaXRlbSAmJiBlLml0ZW0uaWQpIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZVVzZXJBc3NvY2lhdGlvbnMoYCoke2V4dG5hbWUocmVzb3VyY2UpfWAsIGUuaXRlbS5pZCwpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdGVkaXRvclBpY2tlci5zaG93KCk7XG5cdFx0fSk7XG5cblx0XHQvLyBDbG9zZSBwaWNrZXJcblx0XHRlZGl0b3JQaWNrZXIuZGlzcG9zZSgpO1xuXG5cdFx0Ly8gSWYgdGhlIHVzZXIgcGlja2VkIGFuIGVkaXRvciwgbG9vayBhdCBob3cgdGhlIHBpY2tlciB3YXNcblx0XHQvLyB1c2VkIChlLmcuIG1vZGlmaWVyIGtleXMsIG9wZW4gaW4gYmFja2dyb3VuZCkgYW5kIGNyZWF0ZSB0aGVcblx0XHQvLyBvcHRpb25zIGFuZCBncm91cCB0byB1c2UgYWNjb3JkaW5nbHlcblx0XHRpZiAocGlja2VkKSB7XG5cblx0XHRcdC8vIElmIHRoZSB1c2VyIHNlbGVjdGVkIHRvIGNvbmZpZ3VyZSBkZWZhdWx0IHdlIHRyaWdnZXIgdGhpcyBwaWNrZXIgYWdhaW4gYW5kIHRlbGwgaXQgdG8gc2hvdyB0aGUgZGVmYXVsdCBwaWNrZXJcblx0XHRcdGlmIChwaWNrZWQuaXRlbS5pZCA9PT0gRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLmNvbmZpZ3VyZURlZmF1bHRJRCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5kb1BpY2tFZGl0b3IoZWRpdG9yLCB0cnVlKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRmlndXJlIG91dCBvcHRpb25zXG5cdFx0XHRjb25zdCB0YXJnZXRPcHRpb25zOiBJRWRpdG9yT3B0aW9ucyA9IHtcblx0XHRcdFx0Li4uZWRpdG9yLm9wdGlvbnMsXG5cdFx0XHRcdG92ZXJyaWRlOiBwaWNrZWQuaXRlbS5pZCxcblx0XHRcdFx0cHJlc2VydmVGb2N1czogcGlja2VkLm9wZW5JbkJhY2tncm91bmQgfHwgZWRpdG9yLm9wdGlvbnM/LnByZXNlcnZlRm9jdXMsXG5cdFx0XHR9O1xuXG5cdFx0XHRyZXR1cm4gdGFyZ2V0T3B0aW9ucztcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBjYWNoZUVkaXRvcnMoKSB7XG5cdFx0Ly8gQ3JlYXRlIGEgc2V0IHRvIHN0b3JlIGdsb2IgcGF0dGVybnNcblx0XHRjb25zdCBjYWNoZVN0b3JhZ2U6IFNldDxzdHJpbmc+ID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0XHQvLyBTdG9yZSBqdXN0IHRoZSByZWxhdGl2ZSBwYXR0ZXJuIHBpZWNlcyB3aXRob3V0IGFueSBwYXRoIGluZm9cblx0XHRmb3IgKGNvbnN0IFtnbG9iUGF0dGVybiwgY29udHJpYlBvaW50XSBvZiB0aGlzLl9mbGF0dGVuZWRFZGl0b3JzKSB7XG5cdFx0XHRjb25zdCBub25PcHRpb25hbCA9ICEhY29udHJpYlBvaW50LmZpbmQoYyA9PiBjLmVkaXRvckluZm8ucHJpb3JpdHkgIT09IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eS5vcHRpb24gJiYgYy5lZGl0b3JJbmZvLmlkICE9PSBERUZBVUxUX0VESVRPUl9BU1NPQ0lBVElPTi5pZCk7XG5cdFx0XHQvLyBEb24ndCBrZWVwIGEgY2FjaGUgb2YgdGhlIG9wdGlvbmFsIG9uZXMgYXMgdGhvc2Ugd291bGRuJ3QgYmUgb3BlbmVkIG9uIHN0YXJ0IGFueXdheXNcblx0XHRcdGlmICghbm9uT3B0aW9uYWwpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZ2xvYi5pc1JlbGF0aXZlUGF0dGVybihnbG9iUGF0dGVybikpIHtcblx0XHRcdFx0Y2FjaGVTdG9yYWdlLmFkZChgJHtnbG9iUGF0dGVybi5wYXR0ZXJufWApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y2FjaGVTdG9yYWdlLmFkZChnbG9iUGF0dGVybik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQWxzbyBzdG9yZSB0aGUgdXNlcnMgc2V0dGluZ3MgYXMgdGhvc2Ugd291bGQgaGF2ZSB0byBhY3RpdmF0ZSBvbiBzdGFydHVwIGFzIHdlbGxcblx0XHRjb25zdCB1c2VyQXNzb2NpYXRpb25zID0gdGhpcy5nZXRBbGxVc2VyQXNzb2NpYXRpb25zKCk7XG5cdFx0Zm9yIChjb25zdCBhc3NvY2lhdGlvbiBvZiB1c2VyQXNzb2NpYXRpb25zKSB7XG5cdFx0XHRpZiAoYXNzb2NpYXRpb24uZmlsZW5hbWVQYXR0ZXJuKSB7XG5cdFx0XHRcdGNhY2hlU3RvcmFnZS5hZGQoYXNzb2NpYXRpb24uZmlsZW5hbWVQYXR0ZXJuKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShFZGl0b3JSZXNvbHZlclNlcnZpY2UuY2FjaGVTdG9yYWdlSUQsIEpTT04uc3RyaW5naWZ5KEFycmF5LmZyb20oY2FjaGVTdG9yYWdlKSksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvdXJjZU1hdGNoZXNDYWNoZShyZXNvdXJjZTogVVJJKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLmNhY2hlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBjYWNoZUVudHJ5IG9mIHRoaXMuY2FjaGUpIHtcblx0XHRcdGlmIChnbG9iTWF0Y2hlc1Jlc291cmNlKGNhY2hlRW50cnksIHJlc291cmNlKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElFZGl0b3JSZXNvbHZlclNlcnZpY2UsIEVkaXRvclJlc29sdmVyU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFVBQVU7QUFDdEIsU0FBUyxVQUFVLGNBQWM7QUFDakMsU0FBUyxZQUFZLGlCQUE4QixvQkFBb0I7QUFDdkUsU0FBUyxVQUFVLFNBQVMsZUFBZTtBQUMzQyxTQUFTLFdBQVc7QUFDcEIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxrQkFBa0Isd0JBQXdDO0FBQ25FLFNBQVMsNEJBQTRCLHdCQUFnRiwwQkFBMEIsa0NBQWtDLDJCQUEyQixpQ0FBaUMsK0JBQStCLDRCQUFpRCxrQkFB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
