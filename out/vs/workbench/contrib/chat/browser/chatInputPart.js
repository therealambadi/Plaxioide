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
import * as dom from "../../../../base/browser/dom.js";
import { addDisposableListener } from "../../../../base/browser/dom.js";
import { DEFAULT_FONT_FAMILY } from "../../../../base/browser/fonts.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import * as aria from "../../../../base/browser/ui/aria/aria.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { createInstantHoverDelegate, getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Separator, toAction } from "../../../../base/common/actions.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { HistoryNavigator2 } from "../../../../base/common/history.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { ResourceSet } from "../../../../base/common/map.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { URI } from "../../../../base/common/uri.js";
import { EditorExtensionsRegistry } from "../../../../editor/browser/editorExtensions.js";
import { CodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { EditorOptions } from "../../../../editor/common/config/editorOptions.js";
import { Range } from "../../../../editor/common/core/range.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { CopyPasteController } from "../../../../editor/contrib/dropOrPasteInto/browser/copyPasteController.js";
import { DropIntoEditorController } from "../../../../editor/contrib/dropOrPasteInto/browser/dropIntoEditorController.js";
import { ContentHoverController } from "../../../../editor/contrib/hover/browser/contentHoverController.js";
import { GlyphHoverController } from "../../../../editor/contrib/hover/browser/glyphHoverController.js";
import { LinkDetector } from "../../../../editor/contrib/links/browser/links.js";
import { SuggestController } from "../../../../editor/contrib/suggest/browser/suggestController.js";
import { localize } from "../../../../nls.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { MenuWorkbenchButtonBar } from "../../../../platform/actions/browser/buttonbar.js";
import { DropdownMenuActionViewItemWithKeybinding } from "../../../../platform/actions/browser/dropdownActionViewItemWithKeybinding.js";
import { DropdownWithPrimaryActionViewItem } from "../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js";
import { getFlatActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { IMenuService, MenuId, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { registerAndCreateHistoryNavigationContext } from "../../../../platform/history/browser/contextScopedHistoryWidget.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ISharedWebContentExtractorService } from "../../../../platform/webContentExtractor/common/webContentExtractor.js";
import { ResourceLabels } from "../../../browser/labels.js";
import { IWorkbenchAssignmentService } from "../../../services/assignment/common/assignmentService.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
import { getSimpleCodeEditorWidgetOptions, getSimpleEditorOptions, setupSimpleEditorSelectionStyling } from "../../codeEditor/browser/simpleEditorOptions.js";
import { IChatAgentService } from "../common/chatAgents.js";
import { ChatContextKeys } from "../common/chatContextKeys.js";
import { ChatEntitlement, IChatEntitlementService } from "../common/chatEntitlementService.js";
import { isImageVariableEntry, isPasteVariableEntry } from "../common/chatModel.js";
import { IChatService } from "../common/chatService.js";
import { IChatVariablesService } from "../common/chatVariables.js";
import { ChatInputHistoryMaxEntries, IChatWidgetHistoryService } from "../common/chatWidgetHistoryService.js";
import { ChatAgentLocation, ChatConfiguration, ChatMode, validateChatMode } from "../common/constants.js";
import { ILanguageModelsService } from "../common/languageModels.js";
import { CancelAction, ChatEditingSessionSubmitAction, ChatSubmitAction, ChatSwitchToNextModelActionId, ToggleAgentModeActionId } from "./actions/chatExecuteActions.js";
import { AttachToolsAction } from "./actions/chatToolActions.js";
import { ImplicitContextAttachmentWidget } from "./attachments/implicitContextAttachment.js";
import { PromptAttachmentsCollectionWidget } from "./attachments/promptAttachments/promptAttachmentsCollectionWidget.js";
import { ChatAttachmentModel } from "./chatAttachmentModel.js";
import { toChatVariable } from "./chatAttachmentModel/chatPromptAttachmentsCollection.js";
import { DefaultChatAttachmentWidget, FileAttachmentWidget, ImageAttachmentWidget, PasteAttachmentWidget } from "./chatAttachmentWidgets.js";
import { CollapsibleListPool } from "./chatContentParts/chatReferencesContentPart.js";
import { ChatDragAndDrop } from "./chatDragAndDrop.js";
import { ChatEditingRemoveAllFilesAction, ChatEditingShowChangesAction } from "./chatEditing/chatEditingActions.js";
import { ChatFollowups } from "./chatFollowups.js";
import { ChatSelectedTools } from "./chatSelectedTools.js";
import { ChatFileReference } from "./contrib/chatDynamicVariables/chatFileReference.js";
import { ChatImplicitContext } from "./contrib/chatImplicitContext.js";
import { ChatRelatedFiles } from "./contrib/chatInputRelatedFilesContrib.js";
import { resizeImage } from "./imageUtils.js";
const $ = dom.$;
const INPUT_EDITOR_MAX_HEIGHT = 250;
let ChatInputPart = class extends Disposable {
  constructor(location, options, styles, getContribsInputState, historyService, modelService, instantiationService, contextKeyService, configurationService, keybindingService, accessibilityService, languageModelsService, logService, fileService, editorService, themeService, textModelResolverService, storageService, labelService, variableService, agentService, chatService, sharedWebExtracterService, experimentService) {
    super();
    this.location = location;
    this.options = options;
    this.historyService = historyService;
    this.modelService = modelService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.configurationService = configurationService;
    this.keybindingService = keybindingService;
    this.accessibilityService = accessibilityService;
    this.languageModelsService = languageModelsService;
    this.logService = logService;
    this.fileService = fileService;
    this.editorService = editorService;
    this.themeService = themeService;
    this.textModelResolverService = textModelResolverService;
    this.storageService = storageService;
    this.labelService = labelService;
    this.variableService = variableService;
    this.agentService = agentService;
    this.chatService = chatService;
    this.sharedWebExtracterService = sharedWebExtracterService;
    this.experimentService = experimentService;
    this._onDidLoadInputState = this._register(new Emitter());
    this.onDidLoadInputState = this._onDidLoadInputState.event;
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidBlur = this._register(new Emitter());
    this.onDidBlur = this._onDidBlur.event;
    this._onDidChangeContext = this._register(new Emitter());
    this.onDidChangeContext = this._onDidChangeContext.event;
    this._onDidAcceptFollowup = this._register(new Emitter());
    this.onDidAcceptFollowup = this._onDidAcceptFollowup.event;
    this._indexOfLastAttachedContextDeletedWithKeyboard = -1;
    this._onDidChangeVisibility = this._register(new Emitter());
    this._contextResourceLabels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this._onDidChangeVisibility.event });
    this.inputEditorHeight = 0;
    this.followupsDisposables = this._register(new DisposableStore());
    this.attachedContextDisposables = this._register(new MutableDisposable());
    this._inputPartHeight = 0;
    this._followupsHeight = 0;
    this._editSessionWidgetHeight = 0;
    this._waitForPersistedLanguageModel = this._register(new MutableDisposable());
    this._onDidChangeCurrentLanguageModel = this._register(new Emitter());
    this._onDidChangeCurrentChatMode = this._register(new Emitter());
    this.onDidChangeCurrentChatMode = this._onDidChangeCurrentChatMode.event;
    this._currentMode = ChatMode.Ask;
    this.inputUri = URI.parse(`${ChatInputPart.INPUT_SCHEME}:input-${ChatInputPart._counter++}`);
    this._chatEditsActionsDisposables = this._register(new DisposableStore());
    this._chatEditsDisposables = this._register(new DisposableStore());
    this._attemptedWorkingSetEntriesCount = 0;
    this._attachmentModel = this._register(this.instantiationService.createInstance(ChatAttachmentModel));
    this.selectedToolsModel = this._register(this.instantiationService.createInstance(ChatSelectedTools));
    this.dnd = this._register(this.instantiationService.createInstance(ChatDragAndDrop, this._attachmentModel, styles));
    this.getInputState = () => {
      return {
        ...getContribsInputState(),
        chatContextAttachments: this._attachmentModel.attachments,
        chatMode: this._currentMode
      };
    };
    this.inputEditorMaxHeight = this.options.renderStyle === "compact" ? INPUT_EDITOR_MAX_HEIGHT / 3 : INPUT_EDITOR_MAX_HEIGHT;
    this.inputEditorHasText = ChatContextKeys.inputHasText.bindTo(contextKeyService);
    this.chatCursorAtTop = ChatContextKeys.inputCursorAtTop.bindTo(contextKeyService);
    this.inputEditorHasFocus = ChatContextKeys.inputHasFocus.bindTo(contextKeyService);
    this.promptInstructionsAttached = ChatContextKeys.instructionsAttached.bindTo(contextKeyService);
    this.chatMode = ChatContextKeys.chatMode.bindTo(contextKeyService);
    this.history = this.loadHistory();
    this._register(this.historyService.onDidClearHistory(() => this.history = new HistoryNavigator2([{ text: "" }], ChatInputHistoryMaxEntries, historyKeyFn)));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AccessibilityVerbositySettingId.Chat)) {
        this.inputEditor.updateOptions({ ariaLabel: this._getAriaLabel() });
      }
    }));
    this._chatEditsListPool = this._register(this.instantiationService.createInstance(CollapsibleListPool, this._onDidChangeVisibility.event, MenuId.ChatEditingWidgetModifiedFilesToolbar));
    this._hasFileAttachmentContextKey = ChatContextKeys.hasFileAttachments.bindTo(contextKeyService);
    this.instructionAttachmentsPart = this._register(
      instantiationService.createInstance(
        PromptAttachmentsCollectionWidget,
        this.attachmentModel.promptInstructions,
        this._contextResourceLabels
      )
    );
    this.instructionAttachmentsPart.onAttachmentsCountChange(() => {
      this._onDidChangeHeight.fire();
    });
    this.initSelectedModel();
  }
  get attachmentModel() {
    return this._attachmentModel;
  }
  getAttachedAndImplicitContext(sessionId) {
    const contextArr = [...this.attachmentModel.attachments];
    if (this.implicitContext?.enabled && this.implicitContext.value) {
      contextArr.push(this.implicitContext.toBaseEntry());
    }
    const variables = this.variableService.getDynamicVariables(sessionId);
    for (const variable of variables) {
      if (!(variable instanceof ChatFileReference)) {
        continue;
      }
      contextArr.push(
        ...variable.allValidReferences.map((link) => {
          return toChatVariable(link, false);
        })
      );
    }
    contextArr.push(...this.instructionAttachmentsPart.chatAttachments);
    return contextArr;
  }
  /**
   * Check if the chat input part has any prompt instruction attachments.
   */
  get hasInstructionAttachments() {
    return !this.instructionAttachmentsPart.empty;
  }
  get implicitContext() {
    return this._implicitContext;
  }
  get relatedFiles() {
    return this._relatedFiles;
  }
  get inputPartHeight() {
    return this._inputPartHeight;
  }
  get followupsHeight() {
    return this._followupsHeight;
  }
  get editSessionWidgetHeight() {
    return this._editSessionWidgetHeight;
  }
  get inputEditor() {
    return this._inputEditor;
  }
  get currentLanguageModel() {
    return this._currentLanguageModel?.identifier;
  }
  get currentMode() {
    if (this.location === ChatAgentLocation.Panel && !this.chatService.unifiedViewEnabled) {
      return ChatMode.Ask;
    }
    return this._currentMode === ChatMode.Agent && !this.agentService.hasToolsAgent ? ChatMode.Edit : this._currentMode;
  }
  get selectedElements() {
    const edits = [];
    const editsList = this._chatEditList?.object;
    const selectedElements = editsList?.getSelectedElements() ?? [];
    for (const element of selectedElements) {
      if (element.kind === "reference" && URI.isUri(element.reference)) {
        edits.push(element.reference);
      }
    }
    return edits;
  }
  /**
   * The number of working set entries that the user actually wanted to attach.
   * This is less than or equal to {@link ChatInputPart.chatEditWorkingSetFiles}.
   */
  get attemptedWorkingSetEntriesCount() {
    return this._attemptedWorkingSetEntriesCount;
  }
  getSelectedModelStorageKey() {
    return `chat.currentLanguageModel.${this.location}`;
  }
  initSelectedModel() {
    const persistedSelection = this.storageService.get(this.getSelectedModelStorageKey(), StorageScope.APPLICATION);
    if (persistedSelection) {
      const model = this.languageModelsService.lookupLanguageModel(persistedSelection);
      if (model) {
        this.setCurrentLanguageModel({ metadata: model, identifier: persistedSelection });
        this.checkModelSupported();
      } else {
        this._waitForPersistedLanguageModel.value = this.languageModelsService.onDidChangeLanguageModels((e) => {
          const persistedModel = e.added?.find((m) => m.identifier === persistedSelection);
          if (persistedModel) {
            this._waitForPersistedLanguageModel.clear();
            if (persistedModel.metadata.isUserSelectable) {
              this.setCurrentLanguageModel({ metadata: persistedModel.metadata, identifier: persistedSelection });
              this.checkModelSupported();
            }
          }
        });
      }
    }
    this._register(this._onDidChangeCurrentChatMode.event(() => {
      this.checkModelSupported();
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatConfiguration.Edits2Enabled)) {
        this.checkModelSupported();
      }
    }));
  }
  switchToNextModel() {
    const models = this.getModels();
    if (models.length > 0) {
      const currentIndex = models.findIndex((model) => model.identifier === this._currentLanguageModel?.identifier);
      const nextIndex = (currentIndex + 1) % models.length;
      this.setCurrentLanguageModel(models[nextIndex]);
    }
  }
  checkModelSupported() {
    if (this._currentLanguageModel && !this.modelSupportedForDefaultAgent(this._currentLanguageModel)) {
      this.setCurrentLanguageModelToDefault();
    }
  }
  setChatMode(mode) {
    if (!this.options.supportsChangingModes) {
      return;
    }
    mode = validateChatMode(mode) ?? (this.location === ChatAgentLocation.Panel ? ChatMode.Ask : ChatMode.Edit);
    this._currentMode = mode;
    this.chatMode.set(mode);
    this._onDidChangeCurrentChatMode.fire();
  }
  modelSupportedForDefaultAgent(model) {
    if (this.currentMode === ChatMode.Agent || this.currentMode === ChatMode.Edit && this.configurationService.getValue(ChatConfiguration.Edits2Enabled)) {
      if (this.configurationService.getValue("chat.agent.allModels")) {
        return true;
      }
      const supportsToolsAgent = typeof model.metadata.capabilities?.agentMode === "undefined" || model.metadata.capabilities.agentMode;
      return supportsToolsAgent && !!model.metadata.capabilities?.toolCalling;
    }
    return true;
  }
  getModels() {
    const models = this.languageModelsService.getLanguageModelIds().map((modelId) => ({ identifier: modelId, metadata: this.languageModelsService.lookupLanguageModel(modelId) })).filter((entry) => entry.metadata?.isUserSelectable && this.modelSupportedForDefaultAgent(entry));
    models.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
    return models;
  }
  setCurrentLanguageModelToDefault() {
    const defaultLanguageModelId = this.languageModelsService.getLanguageModelIds().find((id) => this.languageModelsService.lookupLanguageModel(id)?.isDefault);
    const hasUserSelectableLanguageModels = this.languageModelsService.getLanguageModelIds().find((id) => {
      const model = this.languageModelsService.lookupLanguageModel(id);
      return model?.isUserSelectable && !model.isDefault;
    });
    const defaultModel = hasUserSelectableLanguageModels && defaultLanguageModelId ? { metadata: this.languageModelsService.lookupLanguageModel(defaultLanguageModelId), identifier: defaultLanguageModelId } : void 0;
    if (defaultModel) {
      this.setCurrentLanguageModel(defaultModel);
    }
  }
  setCurrentLanguageModel(model) {
    this._currentLanguageModel = model;
    if (this.cachedDimensions) {
      this.layout(this.cachedDimensions.height, this.cachedDimensions.width);
    }
    this.storageService.store(this.getSelectedModelStorageKey(), model.identifier, StorageScope.APPLICATION, StorageTarget.USER);
    this._onDidChangeCurrentLanguageModel.fire(model);
  }
  loadHistory() {
    const history = this.historyService.getHistory(this.location);
    if (history.length === 0) {
      history.push({ text: "" });
    }
    return new HistoryNavigator2(history, 50, historyKeyFn);
  }
  _getAriaLabel() {
    const verbose = this.configurationService.getValue(AccessibilityVerbositySettingId.Chat);
    if (verbose) {
      const kbLabel = this.keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp)?.getLabel();
      return kbLabel ? localize("actions.chat.accessibiltyHelp", "Chat Input,  Type to ask questions or type / for topics, press enter to send out the request. Use {0} for Chat Accessibility Help.", kbLabel) : localize("chatInput.accessibilityHelpNoKb", "Chat Input,  Type code here and press Enter to run. Use the Chat Accessibility Help command for more information.");
    }
    return localize("chatInput", "Chat Input");
  }
  initForNewChatModel(state, modelIsEmpty) {
    this.history = this.loadHistory();
    this.history.add({
      text: state.inputValue ?? this.history.current().text,
      state: state.inputState ?? this.getInputState()
    });
    const attachments = state.inputState?.chatContextAttachments ?? [];
    this._attachmentModel.clearAndSetContext(...attachments);
    if (state.inputValue) {
      this.setValue(state.inputValue, false);
    }
    if (state.inputState?.chatMode) {
      this.setChatMode(state.inputState.chatMode);
    } else if (this.location === ChatAgentLocation.EditingSession) {
      this.setChatMode(ChatMode.Edit);
    }
    if (modelIsEmpty) {
      const storageKey = this.getDefaultModeExperimentStorageKey();
      const hasSetDefaultMode = this.storageService.getBoolean(storageKey, StorageScope.WORKSPACE, false);
      if (!hasSetDefaultMode) {
        Promise.all([
          this.experimentService.getTreatment("chat.defaultMode"),
          this.experimentService.getTreatment("chat.defaultLanguageModel")
        ]).then(([defaultModeTreatment, defaultLanguageModelTreatment]) => {
          if (typeof defaultModeTreatment === "string") {
            this.storageService.store(storageKey, true, StorageScope.WORKSPACE, StorageTarget.MACHINE);
            const defaultMode = validateChatMode(defaultModeTreatment);
            if (defaultMode) {
              this.logService.trace(`Applying default mode from experiment: ${defaultMode}`);
              this.setChatMode(defaultMode);
              this.checkModelSupported();
            }
          }
          if (typeof defaultLanguageModelTreatment === "string" && this._currentMode === ChatMode.Agent) {
            this.storageService.store(storageKey, true, StorageScope.WORKSPACE, StorageTarget.MACHINE);
            this.logService.trace(`Applying default language model from experiment: ${defaultLanguageModelTreatment}`);
            this.setExpModelOrWait(defaultLanguageModelTreatment);
          }
        });
      }
    }
  }
  setExpModelOrWait(modelId) {
    const model = this.languageModelsService.lookupLanguageModel(modelId);
    if (model) {
      this.setCurrentLanguageModel({ metadata: model, identifier: modelId });
      this.checkModelSupported();
      this._waitForPersistedLanguageModel.clear();
    } else {
      this._waitForPersistedLanguageModel.value = this.languageModelsService.onDidChangeLanguageModels((e) => {
        const model2 = e.added?.find((m) => m.identifier === modelId);
        if (model2) {
          this._waitForPersistedLanguageModel.clear();
          if (model2.metadata.isUserSelectable) {
            this.setCurrentLanguageModel({ metadata: model2.metadata, identifier: modelId });
            this.checkModelSupported();
          }
        }
      });
    }
  }
  getDefaultModeExperimentStorageKey() {
    const tag = this.options.widgetViewKindTag;
    return `chat.${tag}.hasSetDefaultModeByExperiment`;
  }
  logInputHistory() {
    const historyStr = [...this.history].map((entry) => JSON.stringify(entry)).join("\n");
    this.logService.info(`[${this.location}] Chat input history:`, historyStr);
  }
  setVisible(visible) {
    this._onDidChangeVisibility.fire(visible);
  }
  get element() {
    return this.container;
  }
  async showPreviousValue() {
    const inputState = this.getInputState();
    if (this.history.isAtEnd()) {
      this.saveCurrentValue(inputState);
    } else {
      const currentEntry = this.getFilteredEntry(this._inputEditor.getValue(), inputState);
      if (!this.history.has(currentEntry)) {
        this.saveCurrentValue(inputState);
        this.history.resetCursor();
      }
    }
    this.navigateHistory(true);
  }
  async showNextValue() {
    const inputState = this.getInputState();
    if (this.history.isAtEnd()) {
      return;
    } else {
      const currentEntry = this.getFilteredEntry(this._inputEditor.getValue(), inputState);
      if (!this.history.has(currentEntry)) {
        this.saveCurrentValue(inputState);
        this.history.resetCursor();
      }
    }
    this.navigateHistory(false);
  }
  async navigateHistory(previous) {
    const historyEntry = previous ? this.history.previous() : this.history.next();
    let historyAttachments = historyEntry.state?.chatContextAttachments ?? [];
    if (historyAttachments.length > 0) {
      historyAttachments = (await Promise.all(historyAttachments.map(async (attachment) => {
        if (attachment.isImage && attachment.references?.length && URI.isUri(attachment.references[0].reference)) {
          const currReference = attachment.references[0].reference;
          try {
            const imageBinary = currReference.toString(true).startsWith("http") ? await this.sharedWebExtracterService.readImage(currReference, CancellationToken.None) : (await this.fileService.readFile(currReference)).value;
            if (!imageBinary) {
              return void 0;
            }
            const newAttachment = { ...attachment };
            newAttachment.value = isImageVariableEntry(attachment) && attachment.isPasted ? imageBinary.buffer : await resizeImage(imageBinary.buffer);
            return newAttachment;
          } catch (err) {
            this.logService.error("Failed to fetch and reference.", err);
            return void 0;
          }
        }
        return attachment;
      }))).filter((attachment) => attachment !== void 0);
    }
    this._attachmentModel.clearAndSetContext(...historyAttachments);
    aria.status(historyEntry.text);
    this.setValue(historyEntry.text, true);
    this._onDidLoadInputState.fire(historyEntry.state);
    const model = this._inputEditor.getModel();
    if (!model) {
      return;
    }
    if (previous) {
      const endOfFirstViewLine = this._inputEditor._getViewModel()?.getLineLength(1) ?? 1;
      const endOfFirstModelLine = model.getLineLength(1);
      if (endOfFirstViewLine === endOfFirstModelLine) {
        this._inputEditor.setPosition({ lineNumber: 1, column: endOfFirstViewLine + 1 });
      } else {
        this._inputEditor.setPosition({ lineNumber: 1, column: endOfFirstViewLine });
      }
    } else {
      this._inputEditor.setPosition(getLastPosition(model));
    }
  }
  setValue(value, transient) {
    this.inputEditor.setValue(value);
    this.inputEditor.setPosition({ lineNumber: 1, column: value.length + 1 });
    if (!transient) {
      this.saveCurrentValue(this.getInputState());
    }
  }
  saveCurrentValue(inputState) {
    const newEntry = this.getFilteredEntry(this._inputEditor.getValue(), inputState);
    this.history.replaceLast(newEntry);
  }
  focus() {
    this._inputEditor.focus();
  }
  hasFocus() {
    return this._inputEditor.hasWidgetFocus();
  }
  /**
   * Reset the input and update history.
   * @param userQuery If provided, this will be added to the history. Followups and programmatic queries should not be passed.
   */
  async acceptInput(isUserQuery) {
    if (isUserQuery) {
      const userQuery = this._inputEditor.getValue();
      const inputState = this.getInputState();
      const entry = this.getFilteredEntry(userQuery, inputState);
      this.history.replaceLast(entry);
      this.history.add({ text: "" });
    }
    this.attachmentModel.clear();
    this._onDidLoadInputState.fire({});
    if (this.accessibilityService.isScreenReaderOptimized() && isMacintosh) {
      this._acceptInputForVoiceover();
    } else {
      this._inputEditor.focus();
      this._inputEditor.setValue("");
    }
  }
  validateCurrentMode() {
    if (!this.agentService.hasToolsAgent && this._currentMode === ChatMode.Agent) {
      this.setChatMode(ChatMode.Edit);
    }
  }
  // A funtion that filters out specifically the `value` property of the attachment.
  getFilteredEntry(query, inputState) {
    const attachmentsWithoutImageValues = inputState.chatContextAttachments?.map((attachment) => {
      if (attachment.isImage && attachment.references?.length && attachment.value) {
        const newAttachment = { ...attachment };
        newAttachment.value = void 0;
        return newAttachment;
      }
      return attachment;
    });
    inputState.chatContextAttachments = attachmentsWithoutImageValues;
    const newEntry = {
      text: query,
      state: inputState
    };
    return newEntry;
  }
  _acceptInputForVoiceover() {
    const domNode = this._inputEditor.getDomNode();
    if (!domNode) {
      return;
    }
    domNode.remove();
    this._inputEditor.setValue("");
    this._inputEditorElement.appendChild(domNode);
    this._inputEditor.focus();
  }
  _handleAttachedContextChange() {
    this._hasFileAttachmentContextKey.set(Boolean(this._attachmentModel.attachments.find((a) => a.isFile)));
    this.renderAttachedContext();
  }
  render(container, initialValue, widget) {
    let elements;
    if (this.options.renderStyle === "compact") {
      elements = dom.h(".interactive-input-part", [
        dom.h(".interactive-input-and-edit-session", [
          dom.h(".chat-editing-session@chatEditingSessionWidgetContainer"),
          dom.h(".interactive-input-and-side-toolbar@inputAndSideToolbar", [
            dom.h(".chat-input-container@inputContainer", [
              dom.h(".chat-editor-container@editorContainer"),
              dom.h(".chat-input-toolbars@inputToolbars")
            ])
          ]),
          dom.h(".chat-attachments-container@attachmentsContainer", [
            dom.h(".chat-attachment-toolbar@attachmentToolbar"),
            dom.h(".chat-attached-context@attachedContextContainer"),
            dom.h(".chat-related-files@relatedFilesContainer")
          ]),
          dom.h(".interactive-input-followups@followupsContainer")
        ])
      ]);
    } else {
      elements = dom.h(".interactive-input-part", [
        dom.h(".interactive-input-followups@followupsContainer"),
        dom.h(".chat-editing-session@chatEditingSessionWidgetContainer"),
        dom.h(".interactive-input-and-side-toolbar@inputAndSideToolbar", [
          dom.h(".chat-input-container@inputContainer", [
            dom.h(".chat-attachments-container@attachmentsContainer", [
              dom.h(".chat-attachment-toolbar@attachmentToolbar"),
              dom.h(".chat-related-files@relatedFilesContainer"),
              dom.h(".chat-attached-context@attachedContextContainer")
            ]),
            dom.h(".chat-editor-container@editorContainer"),
            dom.h(".chat-input-toolbars@inputToolbars")
          ])
        ])
      ]);
    }
    this.container = elements.root;
    container.append(this.container);
    this.container.classList.toggle("compact", this.options.renderStyle === "compact");
    this.followupsContainer = elements.followupsContainer;
    const inputAndSideToolbar = elements.inputAndSideToolbar;
    const inputContainer = elements.inputContainer;
    const editorContainer = elements.editorContainer;
    this.attachmentsContainer = elements.attachmentsContainer;
    this.attachedContextContainer = elements.attachedContextContainer;
    this.relatedFilesContainer = elements.relatedFilesContainer;
    const toolbarsContainer = elements.inputToolbars;
    const attachmentToolbarContainer = elements.attachmentToolbar;
    this.chatEditingSessionWidgetContainer = elements.chatEditingSessionWidgetContainer;
    if (this.options.enableImplicitContext) {
      this._implicitContext = this._register(new ChatImplicitContext());
      this._register(this._implicitContext.onDidChangeValue(() => this._handleAttachedContextChange()));
    }
    this.renderAttachedContext();
    this._register(this._attachmentModel.onDidChangeContext(() => this._handleAttachedContextChange()));
    this.renderChatEditingSessionState(null);
    if (this.options.renderWorkingSet) {
      this._relatedFiles = this._register(new ChatRelatedFiles());
      this._register(this._relatedFiles.onDidChange(() => this.renderChatRelatedFiles()));
    }
    this.renderChatRelatedFiles();
    this.dnd.addOverlay(container, container);
    const inputScopedContextKeyService = this._register(this.contextKeyService.createScoped(inputContainer));
    ChatContextKeys.inChatInput.bindTo(inputScopedContextKeyService).set(true);
    const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, inputScopedContextKeyService])));
    const { historyNavigationBackwardsEnablement, historyNavigationForwardsEnablement } = this._register(registerAndCreateHistoryNavigationContext(inputScopedContextKeyService, this));
    this.historyNavigationBackwardsEnablement = historyNavigationBackwardsEnablement;
    this.historyNavigationForewardsEnablement = historyNavigationForwardsEnablement;
    const options = getSimpleEditorOptions(this.configurationService);
    options.overflowWidgetsDomNode = this.options.editorOverflowWidgetsDomNode;
    options.pasteAs = EditorOptions.pasteAs.defaultValue;
    options.readOnly = false;
    options.ariaLabel = this._getAriaLabel();
    options.fontFamily = DEFAULT_FONT_FAMILY;
    options.fontSize = 13;
    options.lineHeight = 20;
    options.padding = this.options.renderStyle === "compact" ? { top: 2, bottom: 2 } : { top: 8, bottom: 8 };
    options.cursorWidth = 1;
    options.wrappingStrategy = "advanced";
    options.bracketPairColorization = { enabled: false };
    options.suggest = {
      showIcons: true,
      showSnippets: false,
      showWords: true,
      showStatusBar: false,
      insertMode: "replace"
    };
    options.scrollbar = { ...options.scrollbar ?? {}, vertical: "hidden" };
    options.stickyScroll = { enabled: false };
    this._inputEditorElement = dom.append(editorContainer, $(chatInputEditorContainerSelector));
    const editorOptions = getSimpleCodeEditorWidgetOptions();
    editorOptions.contributions?.push(...EditorExtensionsRegistry.getSomeEditorContributions([ContentHoverController.ID, GlyphHoverController.ID, CopyPasteController.ID, LinkDetector.ID]));
    this._inputEditor = this._register(scopedInstantiationService.createInstance(CodeEditorWidget, this._inputEditorElement, options, editorOptions));
    SuggestController.get(this._inputEditor)?.forceRenderingAbove();
    options.overflowWidgetsDomNode?.classList.add("hideSuggestTextIcons");
    this._inputEditorElement.classList.add("hideSuggestTextIcons");
    this._register(this._inputEditor.onDidChangeModelContent(() => {
      const currentHeight = Math.min(this._inputEditor.getContentHeight(), this.inputEditorMaxHeight);
      if (currentHeight !== this.inputEditorHeight) {
        this.inputEditorHeight = currentHeight;
        this._onDidChangeHeight.fire();
      }
      const model = this._inputEditor.getModel();
      const inputHasText = !!model && model.getValue().trim().length > 0;
      this.inputEditorHasText.set(inputHasText);
    }));
    this._register(this._inputEditor.onDidContentSizeChange((e) => {
      if (e.contentHeightChanged) {
        this.inputEditorHeight = e.contentHeight;
        this._onDidChangeHeight.fire();
      }
    }));
    this._register(this._inputEditor.onDidFocusEditorText(() => {
      this.inputEditorHasFocus.set(true);
      this._onDidFocus.fire();
      inputContainer.classList.toggle("focused", true);
    }));
    this._register(this._inputEditor.onDidBlurEditorText(() => {
      this.inputEditorHasFocus.set(false);
      inputContainer.classList.toggle("focused", false);
      this._onDidBlur.fire();
    }));
    this._register(this._inputEditor.onDidBlurEditorWidget(() => {
      CopyPasteController.get(this._inputEditor)?.clearWidgets();
      DropIntoEditorController.get(this._inputEditor)?.clearWidgets();
    }));
    const hoverDelegate = this._register(createInstantHoverDelegate());
    this._register(dom.addStandardDisposableListener(toolbarsContainer, dom.EventType.CLICK, (e) => this.inputEditor.focus()));
    this._register(dom.addStandardDisposableListener(this.attachmentsContainer, dom.EventType.CLICK, (e) => this.inputEditor.focus()));
    this.inputActionsToolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, toolbarsContainer, MenuId.ChatInput, {
      telemetrySource: this.options.menus.telemetrySource,
      menuOptions: { shouldForwardArgs: true },
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      hoverDelegate
    }));
    this.inputActionsToolbar.context = { widget };
    this._register(this.inputActionsToolbar.onDidChangeMenuItems(() => {
      if (this.cachedDimensions && typeof this.cachedInputToolbarWidth === "number" && this.cachedInputToolbarWidth !== this.inputActionsToolbar.getItemsWidth()) {
        this.layout(this.cachedDimensions.height, this.cachedDimensions.width);
      }
    }));
    this.executeToolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, toolbarsContainer, this.options.menus.executeToolbar, {
      telemetrySource: this.options.menus.telemetrySource,
      menuOptions: {
        shouldForwardArgs: true
      },
      hoverDelegate,
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      // keep it lean when hiding items and avoid a "..." overflow menu
      actionViewItemProvider: (action, options2) => {
        if (this.location === ChatAgentLocation.Panel || this.location === ChatAgentLocation.Editor) {
          if ((action.id === ChatSubmitAction.ID || action.id === CancelAction.ID || action.id === ChatEditingSessionSubmitAction.ID) && action instanceof MenuItemAction) {
            const dropdownAction = this.instantiationService.createInstance(MenuItemAction, { id: "chat.moreExecuteActions", title: localize("notebook.moreExecuteActionsLabel", "More..."), icon: Codicon.chevronDown }, void 0, void 0, void 0, void 0);
            return this.instantiationService.createInstance(ChatSubmitDropdownActionItem, action, dropdownAction, { ...options2, menuAsChild: false });
          }
        }
        if (action.id === ChatSwitchToNextModelActionId && action instanceof MenuItemAction) {
          if (!this._currentLanguageModel) {
            this.setCurrentLanguageModelToDefault();
          }
          if (this._currentLanguageModel) {
            const itemDelegate = {
              onDidChangeModel: this._onDidChangeCurrentLanguageModel.event,
              setModel: (model) => {
                this._waitForPersistedLanguageModel.clear();
                this.setCurrentLanguageModel(model);
                this.renderAttachedContext();
              },
              getModels: () => this.getModels()
            };
            return this.instantiationService.createInstance(ModelPickerActionViewItem, action, this._currentLanguageModel, itemDelegate);
          }
        } else if (action.id === ToggleAgentModeActionId && action instanceof MenuItemAction) {
          const delegate = {
            getMode: () => this.currentMode,
            onDidChangeMode: this._onDidChangeCurrentChatMode.event
          };
          return this.instantiationService.createInstance(ToggleChatModeActionViewItem, action, delegate);
        }
        return void 0;
      }
    }));
    this.executeToolbar.getElement().classList.add("chat-execute-toolbar");
    this.executeToolbar.context = { widget };
    this._register(this.executeToolbar.onDidChangeMenuItems(() => {
      if (this.cachedDimensions && typeof this.cachedExecuteToolbarWidth === "number" && this.cachedExecuteToolbarWidth !== this.executeToolbar.getItemsWidth()) {
        this.layout(this.cachedDimensions.height, this.cachedDimensions.width);
      }
    }));
    if (this.options.menus.inputSideToolbar) {
      const toolbarSide = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, inputAndSideToolbar, this.options.menus.inputSideToolbar, {
        telemetrySource: this.options.menus.telemetrySource,
        menuOptions: {
          shouldForwardArgs: true
        },
        hoverDelegate
      }));
      this.inputSideToolbarContainer = toolbarSide.getElement();
      toolbarSide.getElement().classList.add("chat-side-toolbar");
      toolbarSide.context = { widget };
    }
    let inputModel = this.modelService.getModel(this.inputUri);
    if (!inputModel) {
      inputModel = this.modelService.createModel("", null, this.inputUri, true);
    }
    this.textModelResolverService.createModelReference(this.inputUri).then((ref) => {
      if (this._store.isDisposed) {
        ref.dispose();
        return;
      }
      this._register(ref);
    });
    this.inputModel = inputModel;
    this.inputModel.updateOptions({ bracketColorizationOptions: { enabled: false, independentColorPoolPerBracketType: false } });
    this._inputEditor.setModel(this.inputModel);
    if (initialValue) {
      this.inputModel.setValue(initialValue);
      const lineNumber = this.inputModel.getLineCount();
      this._inputEditor.setPosition({ lineNumber, column: this.inputModel.getLineMaxColumn(lineNumber) });
    }
    const onDidChangeCursorPosition = () => {
      const model = this._inputEditor.getModel();
      if (!model) {
        return;
      }
      const position = this._inputEditor.getPosition();
      if (!position) {
        return;
      }
      const atTop = position.lineNumber === 1 && position.column - 1 <= (this._inputEditor._getViewModel()?.getLineLength(1) ?? 0);
      this.chatCursorAtTop.set(atTop);
      this.historyNavigationBackwardsEnablement.set(atTop);
      this.historyNavigationForewardsEnablement.set(position.equals(getLastPosition(model)));
    };
    this._register(this._inputEditor.onDidChangeCursorPosition((e) => onDidChangeCursorPosition()));
    onDidChangeCursorPosition();
    this._register(this.themeService.onDidFileIconThemeChange(() => {
      this.renderAttachedContext();
    }));
    this.addFilesToolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, attachmentToolbarContainer, MenuId.ChatInputAttachmentToolbar, {
      telemetrySource: this.options.menus.telemetrySource,
      label: true,
      menuOptions: { shouldForwardArgs: true, renderShortTitle: true },
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      hoverDelegate,
      actionViewItemProvider: (action, options2) => {
        if (action.id === "workbench.action.chat.editing.attachContext" || action.id === "workbench.action.chat.attachContext") {
          const viewItem = this.instantiationService.createInstance(AddFilesButton, void 0, action, options2);
          return viewItem;
        }
        if (action.id === AttachToolsAction.id) {
          return this.selectedToolsModel.toolsActionItemViewItemProvider(action, options2);
        }
        return void 0;
      }
    }));
    this.addFilesToolbar.context = { widget, placeholder: localize("chatAttachFiles", "Search for files and context to add to your request") };
    this._register(this.addFilesToolbar.onDidChangeMenuItems(() => {
      if (this.cachedDimensions) {
        this._onDidChangeHeight.fire();
      }
    }));
    this._register(this.selectedToolsModel.toolsActionItemViewItemProvider.onDidRender(() => this._onDidChangeHeight.fire()));
  }
  renderAttachedContext() {
    const container = this.attachedContextContainer;
    const oldHeight = this.attachmentsContainer.offsetHeight;
    const store = new DisposableStore();
    this.attachedContextDisposables.value = store;
    dom.clearNode(container);
    const hoverDelegate = store.add(createInstantHoverDelegate());
    const attachments = [...this.attachmentModel.attachments.entries()];
    const hasAttachments = Boolean(attachments.length) || Boolean(this.implicitContext?.value) || !this.instructionAttachmentsPart.empty;
    dom.setVisibility(Boolean(hasAttachments || this.addFilesToolbar && !this.addFilesToolbar.isEmpty()), this.attachmentsContainer);
    dom.setVisibility(hasAttachments, this.attachedContextContainer);
    if (!attachments.length) {
      this._indexOfLastAttachedContextDeletedWithKeyboard = -1;
    }
    if (this.implicitContext?.value) {
      const implicitPart = store.add(this.instantiationService.createInstance(ImplicitContextAttachmentWidget, this.implicitContext, this._contextResourceLabels));
      container.appendChild(implicitPart.domNode);
    }
    this.promptInstructionsAttached.set(!this.instructionAttachmentsPart.empty);
    this.instructionAttachmentsPart.render(container);
    for (const [index, attachment] of attachments) {
      const resource = URI.isUri(attachment.value) ? attachment.value : attachment.value && typeof attachment.value === "object" && "uri" in attachment.value && URI.isUri(attachment.value.uri) ? attachment.value.uri : void 0;
      const range = attachment.value && typeof attachment.value === "object" && "range" in attachment.value && Range.isIRange(attachment.value.range) ? attachment.value.range : void 0;
      const shouldFocusClearButton = index === Math.min(this._indexOfLastAttachedContextDeletedWithKeyboard, this.attachmentModel.size - 1);
      let attachmentWidget;
      if (resource && (attachment.isFile || attachment.isDirectory)) {
        attachmentWidget = this.instantiationService.createInstance(FileAttachmentWidget, resource, range, attachment, this._currentLanguageModel, shouldFocusClearButton, container, this._contextResourceLabels, hoverDelegate);
      } else if (attachment.isImage) {
        attachmentWidget = this.instantiationService.createInstance(ImageAttachmentWidget, resource, attachment, this._currentLanguageModel, shouldFocusClearButton, container, this._contextResourceLabels, hoverDelegate);
      } else if (isPasteVariableEntry(attachment)) {
        attachmentWidget = this.instantiationService.createInstance(PasteAttachmentWidget, attachment, this._currentLanguageModel, shouldFocusClearButton, container, this._contextResourceLabels, hoverDelegate);
      } else {
        attachmentWidget = this.instantiationService.createInstance(DefaultChatAttachmentWidget, resource, range, attachment, this._currentLanguageModel, shouldFocusClearButton, container, this._contextResourceLabels, hoverDelegate);
      }
      store.add(attachmentWidget);
      store.add(attachmentWidget.onDidDelete((e) => {
        this.handleAttachmentDeletion(e, index, attachment);
      }));
    }
    if (oldHeight !== this.attachmentsContainer.offsetHeight) {
      this._onDidChangeHeight.fire();
    }
  }
  handleAttachmentDeletion(e, index, attachment) {
    this._attachmentModel.delete(attachment.id);
    if (dom.isKeyboardEvent(e)) {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
        this._indexOfLastAttachedContextDeletedWithKeyboard = index;
      }
    }
    if (this._attachmentModel.size === 0) {
      this.focus();
    }
    this._onDidChangeContext.fire({ removed: [attachment] });
  }
  async renderChatEditingSessionState(chatEditingSession) {
    dom.setVisibility(Boolean(chatEditingSession), this.chatEditingSessionWidgetContainer);
    const seenEntries = new ResourceSet();
    const entries = chatEditingSession?.entries.get().map((entry) => {
      seenEntries.add(entry.modifiedURI);
      return {
        reference: entry.modifiedURI,
        state: entry.state.get(),
        kind: "reference"
      };
    }) ?? [];
    if (!chatEditingSession || !this.options.renderWorkingSet || !entries.length) {
      dom.clearNode(this.chatEditingSessionWidgetContainer);
      this._chatEditsDisposables.clear();
      this._chatEditList = void 0;
      return;
    }
    const innerContainer = this.chatEditingSessionWidgetContainer.querySelector(".chat-editing-session-container.show-file-icons") ?? dom.append(this.chatEditingSessionWidgetContainer, $(".chat-editing-session-container.show-file-icons"));
    for (const entry of chatEditingSession.entries.get()) {
      if (!seenEntries.has(entry.modifiedURI)) {
        entries.unshift({
          reference: entry.modifiedURI,
          state: entry.state.get(),
          kind: "reference"
        });
        seenEntries.add(entry.modifiedURI);
      }
    }
    entries.sort((a, b) => {
      if (a.kind === "reference" && b.kind === "reference") {
        if (a.state === b.state || a.state === void 0 || b.state === void 0) {
          return a.reference.toString().localeCompare(b.reference.toString());
        }
        return a.state - b.state;
      }
      return 0;
    });
    const overviewRegion = innerContainer.querySelector(".chat-editing-session-overview") ?? dom.append(innerContainer, $(".chat-editing-session-overview"));
    const overviewTitle = overviewRegion.querySelector(".working-set-title") ?? dom.append(overviewRegion, $(".working-set-title"));
    const overviewFileCount = overviewTitle.querySelector("span.working-set-count") ?? dom.append(overviewTitle, $("span.working-set-count"));
    overviewFileCount.textContent = entries.length === 1 ? localize("chatEditingSession.oneFile.1", "1 file changed") : localize("chatEditingSession.manyFiles.1", "{0} files changed", entries.length);
    overviewTitle.ariaLabel = overviewFileCount.textContent;
    overviewTitle.tabIndex = 0;
    this._chatEditsActionsDisposables.clear();
    const actionsContainer = overviewRegion.querySelector(".chat-editing-session-actions") ?? dom.append(overviewRegion, $(".chat-editing-session-actions"));
    this._chatEditsActionsDisposables.add(this.instantiationService.createInstance(MenuWorkbenchButtonBar, actionsContainer, MenuId.ChatEditingWidgetToolbar, {
      telemetrySource: this.options.menus.telemetrySource,
      menuOptions: {
        arg: { sessionId: chatEditingSession.chatSessionId }
      },
      buttonConfigProvider: (action) => {
        if (action.id === ChatEditingShowChangesAction.ID || action.id === ChatEditingRemoveAllFilesAction.ID) {
          return { showIcon: true, showLabel: false, isSecondary: true };
        }
        return void 0;
      }
    }));
    if (!chatEditingSession) {
      return;
    }
    const workingSetContainer = innerContainer.querySelector(".chat-editing-session-list") ?? dom.append(innerContainer, $(".chat-editing-session-list"));
    if (!this._chatEditList) {
      this._chatEditList = this._chatEditsListPool.get();
      const list2 = this._chatEditList.object;
      this._chatEditsDisposables.add(this._chatEditList);
      this._chatEditsDisposables.add(list2.onDidFocus(() => {
        this._onDidFocus.fire();
      }));
      this._chatEditsDisposables.add(list2.onDidOpen(async (e) => {
        if (e.element?.kind === "reference" && URI.isUri(e.element.reference)) {
          const modifiedFileUri = e.element.reference;
          const entry = chatEditingSession.getEntry(modifiedFileUri);
          const pane = await this.editorService.openEditor({
            resource: modifiedFileUri,
            options: e.editorOptions
          }, e.sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
          if (pane) {
            entry?.getEditorIntegration(pane).reveal(true);
          }
        }
      }));
      this._chatEditsDisposables.add(addDisposableListener(list2.getHTMLElement(), "click", (e) => {
        if (!this.hasFocus()) {
          this._onDidFocus.fire();
        }
      }, true));
      dom.append(workingSetContainer, list2.getHTMLElement());
      dom.append(innerContainer, workingSetContainer);
    }
    const maxItemsShown = 6;
    const itemsShown = Math.min(entries.length, maxItemsShown);
    const height = itemsShown * 22;
    const list = this._chatEditList.object;
    list.layout(height);
    list.getHTMLElement().style.height = `${height}px`;
    list.splice(0, list.length, entries);
    this._onDidChangeHeight.fire();
  }
  async renderChatRelatedFiles() {
    const anchor = this.relatedFilesContainer;
    dom.clearNode(anchor);
    const shouldRender = this.configurationService.getValue("chat.renderRelatedFiles");
    dom.setVisibility(Boolean(this.relatedFiles?.value.length && shouldRender), anchor);
    if (!shouldRender || !this.relatedFiles?.value.length) {
      return;
    }
    const hoverDelegate = getDefaultHoverDelegate("element");
    for (const { uri, description } of this.relatedFiles.value) {
      const uriLabel = this._chatEditsActionsDisposables.add(new Button(anchor, {
        supportIcons: true,
        secondary: true,
        hoverDelegate
      }));
      uriLabel.label = this.labelService.getUriBasenameLabel(uri);
      uriLabel.element.classList.add("monaco-icon-label");
      uriLabel.element.title = localize("suggeste.title", "{0} - {1}", this.labelService.getUriLabel(uri, { relative: true }), description ?? "");
      this._chatEditsActionsDisposables.add(uriLabel.onDidClick(async () => {
        group.remove();
        await this._attachmentModel.addFile(uri);
        this.relatedFiles?.remove(uri);
      }));
      const addButton = this._chatEditsActionsDisposables.add(new Button(anchor, {
        supportIcons: false,
        secondary: true,
        hoverDelegate,
        ariaLabel: localize("chatEditingSession.addSuggestion", "Add suggestion {0}", this.labelService.getUriLabel(uri, { relative: true }))
      }));
      addButton.icon = Codicon.add;
      addButton.setTitle(localize("chatEditingSession.addSuggested", "Add suggestion"));
      this._chatEditsActionsDisposables.add(addButton.onDidClick(async () => {
        group.remove();
        await this._attachmentModel.addFile(uri);
        this.relatedFiles?.remove(uri);
      }));
      const sep = document.createElement("div");
      sep.classList.add("separator");
      const group = document.createElement("span");
      group.classList.add("monaco-button-dropdown", "sidebyside-button");
      group.appendChild(addButton.element);
      group.appendChild(sep);
      group.appendChild(uriLabel.element);
      dom.append(anchor, group);
      this._chatEditsActionsDisposables.add(toDisposable(() => {
        group.remove();
      }));
    }
    this._onDidChangeHeight.fire();
  }
  async renderFollowups(items, response) {
    if (!this.options.renderFollowups) {
      return;
    }
    this.followupsDisposables.clear();
    dom.clearNode(this.followupsContainer);
    if (items && items.length > 0) {
      this.followupsDisposables.add(this.instantiationService.createInstance(ChatFollowups, this.followupsContainer, items, this.location, void 0, (followup) => this._onDidAcceptFollowup.fire({ followup, response })));
    }
    this._onDidChangeHeight.fire();
  }
  get contentHeight() {
    const data = this.getLayoutData();
    return data.followupsHeight + data.inputPartEditorHeight + data.inputPartVerticalPadding + data.inputEditorBorder + data.attachmentsHeight + data.toolbarsHeight + data.chatEditingStateHeight;
  }
  layout(height, width) {
    this.cachedDimensions = new dom.Dimension(width, height);
    return this._layout(height, width);
  }
  _layout(height, width, allowRecurse = true) {
    const data = this.getLayoutData();
    const inputEditorHeight = Math.min(data.inputPartEditorHeight, height - data.followupsHeight - data.attachmentsHeight - data.inputPartVerticalPadding - data.toolbarsHeight);
    const followupsWidth = width - data.inputPartHorizontalPadding;
    this.followupsContainer.style.width = `${followupsWidth}px`;
    this._inputPartHeight = data.inputPartVerticalPadding + data.followupsHeight + inputEditorHeight + data.inputEditorBorder + data.attachmentsHeight + data.toolbarsHeight + data.chatEditingStateHeight;
    this._followupsHeight = data.followupsHeight;
    this._editSessionWidgetHeight = data.chatEditingStateHeight;
    const initialEditorScrollWidth = this._inputEditor.getScrollWidth();
    const newEditorWidth = width - data.inputPartHorizontalPadding - data.editorBorder - data.inputPartHorizontalPaddingInside - data.toolbarsWidth - data.sideToolbarWidth;
    const newDimension = { width: newEditorWidth, height: inputEditorHeight };
    if (!this.previousInputEditorDimension || (this.previousInputEditorDimension.width !== newDimension.width || this.previousInputEditorDimension.height !== newDimension.height)) {
      this._inputEditor.layout(newDimension);
      this.previousInputEditorDimension = newDimension;
    }
    if (allowRecurse && initialEditorScrollWidth < 10) {
      return this._layout(height, width, false);
    }
  }
  getLayoutData() {
    const executeToolbarWidth = this.cachedExecuteToolbarWidth = this.executeToolbar.getItemsWidth();
    const inputToolbarWidth = this.cachedInputToolbarWidth = this.inputActionsToolbar.getItemsWidth();
    const executeToolbarPadding = (this.executeToolbar.getItemsLength() - 1) * 4;
    const inputToolbarPadding = this.inputActionsToolbar.getItemsLength() ? (this.inputActionsToolbar.getItemsLength() - 1) * 4 : 0;
    return {
      inputEditorBorder: 2,
      followupsHeight: this.followupsContainer.offsetHeight,
      inputPartEditorHeight: Math.min(this._inputEditor.getContentHeight(), this.inputEditorMaxHeight),
      inputPartHorizontalPadding: this.options.renderStyle === "compact" ? 16 : 32,
      inputPartVerticalPadding: this.options.renderStyle === "compact" ? 12 : 28,
      attachmentsHeight: this.attachmentsContainer.offsetHeight + (this.attachmentsContainer.checkVisibility() ? 6 : 0),
      editorBorder: 2,
      inputPartHorizontalPaddingInside: 12,
      toolbarsWidth: this.options.renderStyle === "compact" ? executeToolbarWidth + executeToolbarPadding + inputToolbarWidth + inputToolbarPadding : 0,
      toolbarsHeight: this.options.renderStyle === "compact" ? 0 : 22,
      chatEditingStateHeight: this.chatEditingSessionWidgetContainer.offsetHeight,
      sideToolbarWidth: this.inputSideToolbarContainer ? dom.getTotalWidth(this.inputSideToolbarContainer) + 4 : 0
    };
  }
  getViewState() {
    return this.getInputState();
  }
  saveState() {
    if (this.history.isAtEnd()) {
      this.saveCurrentValue(this.getInputState());
    }
    const inputHistory = [...this.history];
    this.historyService.saveHistory(this.location, inputHistory);
  }
};
ChatInputPart.INPUT_SCHEME = "chatSessionInput";
ChatInputPart._counter = 0;
ChatInputPart = __decorateClass([
  __decorateParam(4, IChatWidgetHistoryService),
  __decorateParam(5, IModelService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IKeybindingService),
  __decorateParam(10, IAccessibilityService),
  __decorateParam(11, ILanguageModelsService),
  __decorateParam(12, ILogService),
  __decorateParam(13, IFileService),
  __decorateParam(14, IEditorService),
  __decorateParam(15, IThemeService),
  __decorateParam(16, ITextModelService),
  __decorateParam(17, IStorageService),
  __decorateParam(18, ILabelService),
  __decorateParam(19, IChatVariablesService),
  __decorateParam(20, IChatAgentService),
  __decorateParam(21, IChatService),
  __decorateParam(22, ISharedWebContentExtractorService),
  __decorateParam(23, IWorkbenchAssignmentService)
], ChatInputPart);
const historyKeyFn = (entry) => JSON.stringify({ ...entry, state: { ...entry.state, chatMode: void 0 } });
function getLastPosition(model) {
  return { lineNumber: model.getLineCount(), column: model.getLineLength(model.getLineCount()) + 1 };
}
let ChatSubmitDropdownActionItem = class extends DropdownWithPrimaryActionViewItem {
  constructor(action, dropdownAction, options, menuService, contextMenuService, contextKeyService, keybindingService, notificationService, themeService, accessibilityService) {
    super(
      action,
      dropdownAction,
      [],
      "",
      {
        ...options,
        getKeyBinding: (action2) => keybindingService.lookupKeybinding(action2.id, contextKeyService)
      },
      contextMenuService,
      keybindingService,
      notificationService,
      contextKeyService,
      themeService,
      accessibilityService
    );
    const menu = menuService.createMenu(MenuId.ChatExecuteSecondary, contextKeyService);
    const setActions = () => {
      const secondary = getFlatActionBarActions(menu.getActions({ shouldForwardArgs: true }));
      this.update(dropdownAction, secondary);
    };
    setActions();
    this._register(menu.onDidChange(() => setActions()));
  }
};
ChatSubmitDropdownActionItem = __decorateClass([
  __decorateParam(3, IMenuService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, INotificationService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IAccessibilityService)
], ChatSubmitDropdownActionItem);
let ModelPickerActionViewItem = class extends DropdownMenuActionViewItemWithKeybinding {
  constructor(action, currentLanguageModel, delegate, contextMenuService, keybindingService, contextKeyService, chatEntitlementService, commandService, menuService, telemetryService) {
    const modelActionsProvider = {
      getActions: () => {
        const setLanguageModelAction = (entry) => {
          return {
            id: entry.identifier,
            label: entry.metadata.name,
            tooltip: "",
            class: void 0,
            enabled: true,
            checked: entry.identifier === this.currentLanguageModel.identifier,
            run: () => {
              this.currentLanguageModel = entry;
              this.renderLabel(this.element);
              this.delegate.setModel(entry);
            }
          };
        };
        const models = this.delegate.getModels();
        const actions = models.map((entry) => setLanguageModelAction(entry));
        const menuActions = menuService.getMenuActions(MenuId.ChatModelPicker, contextKeyService);
        const menuContributions = getFlatActionBarActions(menuActions);
        if (menuContributions.length > 0 || chatEntitlementService.entitlement === ChatEntitlement.Limited) {
          actions.push(new Separator());
        }
        actions.push(...menuContributions);
        if (chatEntitlementService.entitlement === ChatEntitlement.Limited) {
          actions.push(toAction({
            id: "moreModels",
            label: localize("chat.moreModels", "Add more Models"),
            run: () => {
              const commandId = "workbench.action.chat.upgradePlan";
              telemetryService.publicLog2("workbenchActionExecuted", { id: commandId, from: "chat-models" });
              commandService.executeCommand(commandId);
            }
          }));
        }
        return actions;
      }
    };
    const actionWithLabel = {
      ...action,
      tooltip: localize("chat.modelPicker.label", "Pick Model"),
      run: () => {
      }
    };
    super(actionWithLabel, modelActionsProvider, contextMenuService, void 0, keybindingService, contextKeyService);
    this.currentLanguageModel = currentLanguageModel;
    this.delegate = delegate;
    this._register(delegate.onDidChangeModel((modelId) => {
      this.currentLanguageModel = modelId;
      this.renderLabel(this.element);
    }));
  }
  renderLabel(element) {
    this.setAriaLabelAttributes(element);
    dom.reset(element, dom.$("span.chat-model-label", void 0, this.currentLanguageModel.metadata.name), ...renderLabelWithIcons(`$(chevron-down)`));
    return null;
  }
  render(container) {
    super.render(container);
    container.classList.add("chat-modelPicker-item");
  }
};
ModelPickerActionViewItem = __decorateClass([
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IChatEntitlementService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, IMenuService),
  __decorateParam(9, ITelemetryService)
], ModelPickerActionViewItem);
const chatInputEditorContainerSelector = ".interactive-input-editor";
setupSimpleEditorSelectionStyling(chatInputEditorContainerSelector);
let ToggleChatModeActionViewItem = class extends DropdownMenuActionViewItemWithKeybinding {
  constructor(action, delegate, contextMenuService, keybindingService, contextKeyService, chatService, chatAgentService) {
    const makeAction = (mode) => ({
      ...action,
      id: mode,
      label: this.modeToString(mode),
      class: void 0,
      enabled: true,
      checked: delegate.getMode() === mode,
      run: async () => {
        const result = await action.run({ mode });
        this.renderLabel(this.element);
        return result;
      }
    });
    const actionProvider = {
      getActions: () => {
        const agentStateActions = [
          makeAction(ChatMode.Edit)
        ];
        if (chatAgentService.hasToolsAgent) {
          agentStateActions.push(makeAction(ChatMode.Agent));
        }
        if (chatService.unifiedViewEnabled) {
          agentStateActions.unshift(makeAction(ChatMode.Ask));
        }
        return agentStateActions;
      }
    };
    super(action, actionProvider, contextMenuService, void 0, keybindingService, contextKeyService);
    this.delegate = delegate;
    this._register(delegate.onDidChangeMode(() => this.renderLabel(this.element)));
  }
  modeToString(mode) {
    switch (mode) {
      case ChatMode.Agent:
        return localize("chat.agentMode", "Agent");
      case ChatMode.Edit:
        return localize("chat.normalMode", "Edit");
      case ChatMode.Ask:
      default:
        return localize("chat.askMode", "Ask");
    }
  }
  renderLabel(element) {
    this.setAriaLabelAttributes(element);
    const state = this.modeToString(this.delegate.getMode());
    dom.reset(element, dom.$("span.chat-model-label", void 0, state), ...renderLabelWithIcons(`$(chevron-down)`));
    return null;
  }
  render(container) {
    super.render(container);
    container.classList.add("chat-modelPicker-item");
  }
};
ToggleChatModeActionViewItem = __decorateClass([
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IChatService),
  __decorateParam(6, IChatAgentService)
], ToggleChatModeActionViewItem);
class AddFilesButton extends ActionViewItem {
  constructor(context, action, options) {
    super(context, action, options);
  }
  render(container) {
    super.render(container);
    container.classList.add("chat-attached-context-attachment", "chat-add-files");
  }
}
export {
  ChatInputPart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdElucHV0UGFydC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IGFkZERpc3Bvc2FibGVMaXN0ZW5lciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgREVGQVVMVF9GT05UX0ZBTUlMWSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9mb250cy5qcyc7XG5pbXBvcnQgeyBJSGlzdG9yeU5hdmlnYXRpb25XaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvaGlzdG9yeS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBBY3Rpb25WaWV3SXRlbSwgSUFjdGlvblZpZXdJdGVtT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uVmlld0l0ZW1zLmpzJztcbmltcG9ydCAqIGFzIGFyaWEgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYnV0dG9uL2J1dHRvbi5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvZHJvcGRvd24vZHJvcGRvd24uanMnO1xuaW1wb3J0IHsgY3JlYXRlSW5zdGFudEhvdmVyRGVsZWdhdGUsIGdldERlZmF1bHRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGVGYWN0b3J5LmpzJztcbmltcG9ydCB7IHJlbmRlckxhYmVsV2l0aEljb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IElBY3Rpb24sIFNlcGFyYXRvciwgdG9BY3Rpb24sIFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkQ2xhc3NpZmljYXRpb24sIFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEhpc3RvcnlOYXZpZ2F0b3IyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGlzdG9yeS5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZVNldCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBpc01hY2ludG9zaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29uc3RydWN0aW9uT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2NvbmZpZy9lZGl0b3JDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEVkaXRvckV4dGVuc2lvbnNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2NvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSURpbWVuc2lvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9kaW1lbnNpb24uanMnO1xuaW1wb3J0IHsgSVBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29weVBhc3RlQ29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2Ryb3BPclBhc3RlSW50by9icm93c2VyL2NvcHlQYXN0ZUNvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgRHJvcEludG9FZGl0b3JDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZHJvcE9yUGFzdGVJbnRvL2Jyb3dzZXIvZHJvcEludG9FZGl0b3JDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IENvbnRlbnRIb3ZlckNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL2NvbnRlbnRIb3ZlckNvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgR2x5cGhIb3ZlckNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL2dseXBoSG92ZXJDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IExpbmtEZXRlY3RvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2xpbmtzL2Jyb3dzZXIvbGlua3MuanMnO1xuaW1wb3J0IHsgU3VnZ2VzdENvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdENvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBNZW51V29ya2JlbmNoQnV0dG9uQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL2J1dHRvbmJhci5qcyc7XG5pbXBvcnQgeyBEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbVdpdGhLZXliaW5kaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL2Ryb3Bkb3duQWN0aW9uVmlld0l0ZW1XaXRoS2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBEcm9wZG93bldpdGhQcmltYXJ5QWN0aW9uVmlld0l0ZW0sIElEcm9wZG93bldpdGhQcmltYXJ5QWN0aW9uVmlld0l0ZW1PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL2Ryb3Bkb3duV2l0aFByaW1hcnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBnZXRGbGF0QWN0aW9uQmFyQWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBIaWRkZW5JdGVtU3RyYXRlZ3ksIE1lbnVXb3JrYmVuY2hUb29sQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL3Rvb2xiYXIuanMnO1xuaW1wb3J0IHsgSU1lbnVTZXJ2aWNlLCBNZW51SWQsIE1lbnVJdGVtQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJBbmRDcmVhdGVIaXN0b3J5TmF2aWdhdGlvbkNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9oaXN0b3J5L2Jyb3dzZXIvY29udGV4dFNjb3BlZEhpc3RvcnlXaWRnZXQuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hMaXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJU2hhcmVkV2ViQ29udGVudEV4dHJhY3RvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93ZWJDb250ZW50RXh0cmFjdG9yL2NvbW1vbi93ZWJDb250ZW50RXh0cmFjdG9yLmpzJztcbmltcG9ydCB7IFJlc291cmNlTGFiZWxzIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9sYWJlbHMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEFzc2lnbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvYXNzaWdubWVudC9jb21tb24vYXNzaWdubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQUNUSVZFX0dST1VQLCBJRWRpdG9yU2VydmljZSwgU0lERV9HUk9VUCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vYWNjZXNzaWJpbGl0eS9icm93c2VyL2FjY2Vzc2liaWxpdHlDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlDb21tYW5kSWQgfSBmcm9tICcuLi8uLi9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5Q29tbWFuZHMuanMnO1xuaW1wb3J0IHsgZ2V0U2ltcGxlQ29kZUVkaXRvcldpZGdldE9wdGlvbnMsIGdldFNpbXBsZUVkaXRvck9wdGlvbnMsIHNldHVwU2ltcGxlRWRpdG9yU2VsZWN0aW9uU3R5bGluZyB9IGZyb20gJy4uLy4uL2NvZGVFZGl0b3IvYnJvd3Nlci9zaW1wbGVFZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IElDaGF0QWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRBZ2VudHMuanMnO1xuaW1wb3J0IHsgQ2hhdENvbnRleHRLZXlzIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJQ2hhdEVkaXRpbmdTZXNzaW9uIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRFZGl0aW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0RW50aXRsZW1lbnQsIElDaGF0RW50aXRsZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRFbnRpdGxlbWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSwgaXNJbWFnZVZhcmlhYmxlRW50cnksIGlzUGFzdGVWYXJpYWJsZUVudHJ5IH0gZnJvbSAnLi4vY29tbW9uL2NoYXRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJQ2hhdEZvbGxvd3VwLCBJQ2hhdFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vY2hhdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRWYXJpYWJsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRWYXJpYWJsZXMuanMnO1xuaW1wb3J0IHsgSUNoYXRSZXNwb25zZVZpZXdNb2RlbCB9IGZyb20gJy4uL2NvbW1vbi9jaGF0Vmlld01vZGVsLmpzJztcbmltcG9ydCB7IENoYXRJbnB1dEhpc3RvcnlNYXhFbnRyaWVzLCBJQ2hhdEhpc3RvcnlFbnRyeSwgSUNoYXRJbnB1dFN0YXRlLCBJQ2hhdFdpZGdldEhpc3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRXaWRnZXRIaXN0b3J5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiwgQ2hhdENvbmZpZ3VyYXRpb24sIENoYXRNb2RlLCB2YWxpZGF0ZUNoYXRNb2RlIH0gZnJvbSAnLi4vY29tbW9uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VNb2RlbENoYXRNZXRhZGF0YUFuZElkZW50aWZpZXIsIElMYW5ndWFnZU1vZGVsc1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbGFuZ3VhZ2VNb2RlbHMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsQWN0aW9uLCBDaGF0RWRpdGluZ1Nlc3Npb25TdWJtaXRBY3Rpb24sIENoYXRTdWJtaXRBY3Rpb24sIENoYXRTd2l0Y2hUb05leHRNb2RlbEFjdGlvbklkLCBJQ2hhdEV4ZWN1dGVBY3Rpb25Db250ZXh0LCBJVG9nZ2xlQ2hhdE1vZGVBcmdzLCBUb2dnbGVBZ2VudE1vZGVBY3Rpb25JZCB9IGZyb20gJy4vYWN0aW9ucy9jaGF0RXhlY3V0ZUFjdGlvbnMuanMnO1xuaW1wb3J0IHsgQXR0YWNoVG9vbHNBY3Rpb24gfSBmcm9tICcuL2FjdGlvbnMvY2hhdFRvb2xBY3Rpb25zLmpzJztcbmltcG9ydCB7IEltcGxpY2l0Q29udGV4dEF0dGFjaG1lbnRXaWRnZXQgfSBmcm9tICcuL2F0dGFjaG1lbnRzL2ltcGxpY2l0Q29udGV4dEF0dGFjaG1lbnQuanMnO1xuaW1wb3J0IHsgUHJvbXB0QXR0YWNobWVudHNDb2xsZWN0aW9uV2lkZ2V0IH0gZnJvbSAnLi9hdHRhY2htZW50cy9wcm9tcHRBdHRhY2htZW50cy9wcm9tcHRBdHRhY2htZW50c0NvbGxlY3Rpb25XaWRnZXQuanMnO1xuaW1wb3J0IHsgSUNoYXRXaWRnZXQgfSBmcm9tICcuL2NoYXQuanMnO1xuaW1wb3J0IHsgQ2hhdEF0dGFjaG1lbnRNb2RlbCB9IGZyb20gJy4vY2hhdEF0dGFjaG1lbnRNb2RlbC5qcyc7XG5pbXBvcnQgeyB0b0NoYXRWYXJpYWJsZSB9IGZyb20gJy4vY2hhdEF0dGFjaG1lbnRNb2RlbC9jaGF0UHJvbXB0QXR0YWNobWVudHNDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IERlZmF1bHRDaGF0QXR0YWNobWVudFdpZGdldCwgRmlsZUF0dGFjaG1lbnRXaWRnZXQsIEltYWdlQXR0YWNobWVudFdpZGdldCwgUGFzdGVBdHRhY2htZW50V2lkZ2V0IH0gZnJvbSAnLi9jaGF0QXR0YWNobWVudFdpZGdldHMuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGVSZWZlcmVuY2UgfSBmcm9tICcuL2NoYXRDb250ZW50UGFydHMvY2hhdENvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IENvbGxhcHNpYmxlTGlzdFBvb2wsIElDaGF0Q29sbGFwc2libGVMaXN0SXRlbSB9IGZyb20gJy4vY2hhdENvbnRlbnRQYXJ0cy9jaGF0UmVmZXJlbmNlc0NvbnRlbnRQYXJ0LmpzJztcbmltcG9ydCB7IENoYXREcmFnQW5kRHJvcCB9IGZyb20gJy4vY2hhdERyYWdBbmREcm9wLmpzJztcbmltcG9ydCB7IENoYXRFZGl0aW5nUmVtb3ZlQWxsRmlsZXNBY3Rpb24sIENoYXRFZGl0aW5nU2hvd0NoYW5nZXNBY3Rpb24gfSBmcm9tICcuL2NoYXRFZGl0aW5nL2NoYXRFZGl0aW5nQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDaGF0Rm9sbG93dXBzIH0gZnJvbSAnLi9jaGF0Rm9sbG93dXBzLmpzJztcbmltcG9ydCB7IENoYXRTZWxlY3RlZFRvb2xzIH0gZnJvbSAnLi9jaGF0U2VsZWN0ZWRUb29scy5qcyc7XG5pbXBvcnQgeyBJQ2hhdFZpZXdTdGF0ZSB9IGZyb20gJy4vY2hhdFdpZGdldC5qcyc7XG5pbXBvcnQgeyBDaGF0RmlsZVJlZmVyZW5jZSB9IGZyb20gJy4vY29udHJpYi9jaGF0RHluYW1pY1ZhcmlhYmxlcy9jaGF0RmlsZVJlZmVyZW5jZS5qcyc7XG5pbXBvcnQgeyBDaGF0SW1wbGljaXRDb250ZXh0IH0gZnJvbSAnLi9jb250cmliL2NoYXRJbXBsaWNpdENvbnRleHQuanMnO1xuaW1wb3J0IHsgQ2hhdFJlbGF0ZWRGaWxlcyB9IGZyb20gJy4vY29udHJpYi9jaGF0SW5wdXRSZWxhdGVkRmlsZXNDb250cmliLmpzJztcbmltcG9ydCB7IHJlc2l6ZUltYWdlIH0gZnJvbSAnLi9pbWFnZVV0aWxzLmpzJztcblxuY29uc3QgJCA9IGRvbS4kO1xuXG5jb25zdCBJTlBVVF9FRElUT1JfTUFYX0hFSUdIVCA9IDI1MDtcblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdElucHV0U3R5bGVzIHtcblx0b3ZlcmxheUJhY2tncm91bmQ6IHN0cmluZztcblx0bGlzdEZvcmVncm91bmQ6IHN0cmluZztcblx0bGlzdEJhY2tncm91bmQ6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIElDaGF0SW5wdXRQYXJ0T3B0aW9ucyB7XG5cdHJlbmRlckZvbGxvd3VwczogYm9vbGVhbjtcblx0cmVuZGVyU3R5bGU/OiAnY29tcGFjdCc7XG5cdG1lbnVzOiB7XG5cdFx0ZXhlY3V0ZVRvb2xiYXI6IE1lbnVJZDtcblx0XHRpbnB1dFNpZGVUb29sYmFyPzogTWVudUlkO1xuXHRcdHRlbGVtZXRyeVNvdXJjZT86IHN0cmluZztcblx0fTtcblx0ZWRpdG9yT3ZlcmZsb3dXaWRnZXRzRG9tTm9kZT86IEhUTUxFbGVtZW50O1xuXHRyZW5kZXJXb3JraW5nU2V0PzogYm9vbGVhbjtcblx0ZW5hYmxlSW1wbGljaXRDb250ZXh0PzogYm9vbGVhbjtcblx0c3VwcG9ydHNDaGFuZ2luZ01vZGVzPzogYm9vbGVhbjtcblx0d2lkZ2V0Vmlld0tpbmRUYWc6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJV29ya2luZ1NldEVudHJ5IHtcblx0dXJpOiBVUkk7XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0SW5wdXRQYXJ0IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElIaXN0b3J5TmF2aWdhdGlvbldpZGdldCB7XG5cdHN0YXRpYyByZWFkb25seSBJTlBVVF9TQ0hFTUUgPSAnY2hhdFNlc3Npb25JbnB1dCc7XG5cdHByaXZhdGUgc3RhdGljIF9jb3VudGVyID0gMDtcblxuXHRwcml2YXRlIF9vbkRpZExvYWRJbnB1dFN0YXRlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8YW55PigpKTtcblx0cmVhZG9ubHkgb25EaWRMb2FkSW5wdXRTdGF0ZSA9IHRoaXMuX29uRGlkTG9hZElucHV0U3RhdGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VIZWlnaHQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VIZWlnaHQgPSB0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZEZvY3VzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRm9jdXMgPSB0aGlzLl9vbkRpZEZvY3VzLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uRGlkQmx1ciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZEJsdXIgPSB0aGlzLl9vbkRpZEJsdXIuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VDb250ZXh0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyByZW1vdmVkPzogSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeVtdOyBhZGRlZD86IElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnlbXSB9PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDb250ZXh0ID0gdGhpcy5fb25EaWRDaGFuZ2VDb250ZXh0LmV2ZW50O1xuXG5cdHByaXZhdGUgX29uRGlkQWNjZXB0Rm9sbG93dXAgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGZvbGxvd3VwOiBJQ2hhdEZvbGxvd3VwOyByZXNwb25zZTogSUNoYXRSZXNwb25zZVZpZXdNb2RlbCB8IHVuZGVmaW5lZCB9PigpKTtcblx0cmVhZG9ubHkgb25EaWRBY2NlcHRGb2xsb3d1cCA9IHRoaXMuX29uRGlkQWNjZXB0Rm9sbG93dXAuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYXR0YWNobWVudE1vZGVsOiBDaGF0QXR0YWNobWVudE1vZGVsO1xuXHRwdWJsaWMgZ2V0IGF0dGFjaG1lbnRNb2RlbCgpOiBDaGF0QXR0YWNobWVudE1vZGVsIHtcblx0XHRyZXR1cm4gdGhpcy5fYXR0YWNobWVudE1vZGVsO1xuXHR9XG5cblx0cmVhZG9ubHkgc2VsZWN0ZWRUb29sc01vZGVsOiBDaGF0U2VsZWN0ZWRUb29scztcblxuXHRwdWJsaWMgZ2V0QXR0YWNoZWRBbmRJbXBsaWNpdENvbnRleHQoc2Vzc2lvbklkOiBzdHJpbmcpOiBJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5W10ge1xuXHRcdGNvbnN0IGNvbnRleHRBcnIgPSBbLi4udGhpcy5hdHRhY2htZW50TW9kZWwuYXR0YWNobWVudHNdO1xuXHRcdGlmICh0aGlzLmltcGxpY2l0Q29udGV4dD8uZW5hYmxlZCAmJiB0aGlzLmltcGxpY2l0Q29udGV4dC52YWx1ZSkge1xuXHRcdFx0Y29udGV4dEFyci5wdXNoKHRoaXMuaW1wbGljaXRDb250ZXh0LnRvQmFzZUVudHJ5KCkpO1xuXHRcdH1cblxuXHRcdC8vIGZhY3RvciBpbiBuZXN0ZWQgZmlsZSBsaW5rcyBvZiBhIHByb21wdCBpbnRvIHRoZSBpbXBsaWNpdCBjb250ZXh0XG5cdFx0Y29uc3QgdmFyaWFibGVzID0gdGhpcy52YXJpYWJsZVNlcnZpY2UuZ2V0RHluYW1pY1ZhcmlhYmxlcyhzZXNzaW9uSWQpO1xuXHRcdGZvciAoY29uc3QgdmFyaWFibGUgb2YgdmFyaWFibGVzKSB7XG5cdFx0XHRpZiAoISh2YXJpYWJsZSBpbnN0YW5jZW9mIENoYXRGaWxlUmVmZXJlbmNlKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gdGhlIHVzdWFsIFVSSXMgbGlzdCBvZiBwcm9tcHQgaW5zdHJ1Y3Rpb25zIGlzIGBib3R0b20tdXBgLCB0aGVyZWZvcmVcblx0XHRcdC8vIHdlIGRvIHRoZSBzYW1lIGhlcmUgLSBmaXJzdCBhZGQgYWxsIGNoaWxkIHJlZmVyZW5jZXMgdG8gdGhlIGxpc3Rcblx0XHRcdGNvbnRleHRBcnIucHVzaChcblx0XHRcdFx0Li4udmFyaWFibGUuYWxsVmFsaWRSZWZlcmVuY2VzLm1hcCgobGluaykgPT4ge1xuXHRcdFx0XHRcdHJldHVybiB0b0NoYXRWYXJpYWJsZShsaW5rLCBmYWxzZSk7XG5cdFx0XHRcdH0pLFxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHRjb250ZXh0QXJyXG5cdFx0XHQucHVzaCguLi50aGlzLmluc3RydWN0aW9uQXR0YWNobWVudHNQYXJ0LmNoYXRBdHRhY2htZW50cyk7XG5cblx0XHRyZXR1cm4gY29udGV4dEFycjtcblx0fVxuXG5cdC8qKlxuXHQgKiBDaGVjayBpZiB0aGUgY2hhdCBpbnB1dCBwYXJ0IGhhcyBhbnkgcHJvbXB0IGluc3RydWN0aW9uIGF0dGFjaG1lbnRzLlxuXHQgKi9cblx0cHVibGljIGdldCBoYXNJbnN0cnVjdGlvbkF0dGFjaG1lbnRzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhdGhpcy5pbnN0cnVjdGlvbkF0dGFjaG1lbnRzUGFydC5lbXB0eTtcblx0fVxuXG5cdHByaXZhdGUgX2luZGV4T2ZMYXN0QXR0YWNoZWRDb250ZXh0RGVsZXRlZFdpdGhLZXlib2FyZDogbnVtYmVyID0gLTE7XG5cblx0cHJpdmF0ZSBfaW1wbGljaXRDb250ZXh0OiBDaGF0SW1wbGljaXRDb250ZXh0IHwgdW5kZWZpbmVkO1xuXHRwdWJsaWMgZ2V0IGltcGxpY2l0Q29udGV4dCgpOiBDaGF0SW1wbGljaXRDb250ZXh0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5faW1wbGljaXRDb250ZXh0O1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVsYXRlZEZpbGVzOiBDaGF0UmVsYXRlZEZpbGVzIHwgdW5kZWZpbmVkO1xuXHRwdWJsaWMgZ2V0IHJlbGF0ZWRGaWxlcygpOiBDaGF0UmVsYXRlZEZpbGVzIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVsYXRlZEZpbGVzO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGFzRmlsZUF0dGFjaG1lbnRDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVZpc2liaWxpdHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxib29sZWFuPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfY29udGV4dFJlc291cmNlTGFiZWxzID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvdXJjZUxhYmVscywgeyBvbkRpZENoYW5nZVZpc2liaWxpdHk6IHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5ldmVudCB9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGlucHV0RWRpdG9yTWF4SGVpZ2h0OiBudW1iZXI7XG5cdHByaXZhdGUgaW5wdXRFZGl0b3JIZWlnaHQgPSAwO1xuXHRwcml2YXRlIGNvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgaW5wdXRTaWRlVG9vbGJhckNvbnRhaW5lcj86IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgZm9sbG93dXBzQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgZm9sbG93dXBzRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdHByaXZhdGUgYXR0YWNobWVudHNDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblxuXHRwcml2YXRlIGF0dGFjaGVkQ29udGV4dENvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IGF0dGFjaGVkQ29udGV4dERpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPERpc3Bvc2FibGVTdG9yZT4oKSk7XG5cblx0cHJpdmF0ZSByZWxhdGVkRmlsZXNDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblxuXHRwcml2YXRlIGNoYXRFZGl0aW5nU2Vzc2lvbldpZGdldENvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgX2lucHV0UGFydEhlaWdodDogbnVtYmVyID0gMDtcblx0Z2V0IGlucHV0UGFydEhlaWdodCgpIHtcblx0XHRyZXR1cm4gdGhpcy5faW5wdXRQYXJ0SGVpZ2h0O1xuXHR9XG5cblx0cHJpdmF0ZSBfZm9sbG93dXBzSGVpZ2h0OiBudW1iZXIgPSAwO1xuXHRnZXQgZm9sbG93dXBzSGVpZ2h0KCkge1xuXHRcdHJldHVybiB0aGlzLl9mb2xsb3d1cHNIZWlnaHQ7XG5cdH1cblxuXHRwcml2YXRlIF9lZGl0U2Vzc2lvbldpZGdldEhlaWdodDogbnVtYmVyID0gMDtcblx0Z2V0IGVkaXRTZXNzaW9uV2lkZ2V0SGVpZ2h0KCkge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0U2Vzc2lvbldpZGdldEhlaWdodDtcblx0fVxuXG5cdHByaXZhdGUgX2lucHV0RWRpdG9yITogQ29kZUVkaXRvcldpZGdldDtcblx0cHJpdmF0ZSBfaW5wdXRFZGl0b3JFbGVtZW50ITogSFRNTEVsZW1lbnQ7XG5cblx0cHJpdmF0ZSBleGVjdXRlVG9vbGJhciE6IE1lbnVXb3JrYmVuY2hUb29sQmFyO1xuXHRwcml2YXRlIGlucHV0QWN0aW9uc1Rvb2xiYXIhOiBNZW51V29ya2JlbmNoVG9vbEJhcjtcblxuXHRwcml2YXRlIGFkZEZpbGVzVG9vbGJhcjogTWVudVdvcmtiZW5jaFRvb2xCYXIgfCB1bmRlZmluZWQ7XG5cblx0Z2V0IGlucHV0RWRpdG9yKCkge1xuXHRcdHJldHVybiB0aGlzLl9pbnB1dEVkaXRvcjtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgZG5kOiBDaGF0RHJhZ0FuZERyb3A7XG5cblx0cHJpdmF0ZSBoaXN0b3J5OiBIaXN0b3J5TmF2aWdhdG9yMjxJQ2hhdEhpc3RvcnlFbnRyeT47XG5cdHByaXZhdGUgaGlzdG9yeU5hdmlnYXRpb25CYWNrd2FyZHNFbmFibGVtZW50ITogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgaGlzdG9yeU5hdmlnYXRpb25Gb3Jld2FyZHNFbmFibGVtZW50ITogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgaW5wdXRNb2RlbDogSVRleHRNb2RlbCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBpbnB1dEVkaXRvckhhc1RleHQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGNoYXRDdXJzb3JBdFRvcDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgaW5wdXRFZGl0b3JIYXNGb2N1czogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdC8qKlxuXHQgKiBDb250ZXh0IGtleSBpcyBzZXQgd2hlbiBwcm9tcHQgaW5zdHJ1Y3Rpb25zIGFyZSBhdHRhY2hlZC5cblx0ICovXG5cdHByaXZhdGUgcHJvbXB0SW5zdHJ1Y3Rpb25zQXR0YWNoZWQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGNoYXRNb2RlOiBJQ29udGV4dEtleTxDaGF0TW9kZT47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfd2FpdEZvclBlcnNpc3RlZExhbmd1YWdlTW9kZWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8SURpc3Bvc2FibGU+KCkpO1xuXHRwcml2YXRlIF9vbkRpZENoYW5nZUN1cnJlbnRMYW5ndWFnZU1vZGVsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUxhbmd1YWdlTW9kZWxDaGF0TWV0YWRhdGFBbmRJZGVudGlmaWVyPigpKTtcblx0cHJpdmF0ZSBfY3VycmVudExhbmd1YWdlTW9kZWw6IElMYW5ndWFnZU1vZGVsQ2hhdE1ldGFkYXRhQW5kSWRlbnRpZmllciB8IHVuZGVmaW5lZDtcblx0Z2V0IGN1cnJlbnRMYW5ndWFnZU1vZGVsKCkge1xuXHRcdHJldHVybiB0aGlzLl9jdXJyZW50TGFuZ3VhZ2VNb2RlbD8uaWRlbnRpZmllcjtcblx0fVxuXG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlQ3VycmVudENoYXRNb2RlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ3VycmVudENoYXRNb2RlID0gdGhpcy5fb25EaWRDaGFuZ2VDdXJyZW50Q2hhdE1vZGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfY3VycmVudE1vZGU6IENoYXRNb2RlID0gQ2hhdE1vZGUuQXNrO1xuXHRwdWJsaWMgZ2V0IGN1cnJlbnRNb2RlKCk6IENoYXRNb2RlIHtcblx0XHRpZiAodGhpcy5sb2NhdGlvbiA9PT0gQ2hhdEFnZW50TG9jYXRpb24uUGFuZWwgJiYgIXRoaXMuY2hhdFNlcnZpY2UudW5pZmllZFZpZXdFbmFibGVkKSB7XG5cdFx0XHRyZXR1cm4gQ2hhdE1vZGUuQXNrO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9jdXJyZW50TW9kZSA9PT0gQ2hhdE1vZGUuQWdlbnQgJiYgIXRoaXMuYWdlbnRTZXJ2aWNlLmhhc1Rvb2xzQWdlbnQgP1xuXHRcdFx0Q2hhdE1vZGUuRWRpdCA6XG5cdFx0XHR0aGlzLl9jdXJyZW50TW9kZTtcblx0fVxuXG5cdHByaXZhdGUgY2FjaGVkRGltZW5zaW9uczogZG9tLkRpbWVuc2lvbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjYWNoZWRFeGVjdXRlVG9vbGJhcldpZHRoOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgY2FjaGVkSW5wdXRUb29sYmFyV2lkdGg6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBpbnB1dFVyaSA9IFVSSS5wYXJzZShgJHtDaGF0SW5wdXRQYXJ0LklOUFVUX1NDSEVNRX06aW5wdXQtJHtDaGF0SW5wdXRQYXJ0Ll9jb3VudGVyKyt9YCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY2hhdEVkaXRzQWN0aW9uc0Rpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfY2hhdEVkaXRzRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIF9jaGF0RWRpdHNMaXN0UG9vbDogQ29sbGFwc2libGVMaXN0UG9vbDtcblx0cHJpdmF0ZSBfY2hhdEVkaXRMaXN0OiBJRGlzcG9zYWJsZVJlZmVyZW5jZTxXb3JrYmVuY2hMaXN0PElDaGF0Q29sbGFwc2libGVMaXN0SXRlbT4+IHwgdW5kZWZpbmVkO1xuXHRnZXQgc2VsZWN0ZWRFbGVtZW50cygpOiBVUklbXSB7XG5cdFx0Y29uc3QgZWRpdHMgPSBbXTtcblx0XHRjb25zdCBlZGl0c0xpc3QgPSB0aGlzLl9jaGF0RWRpdExpc3Q/Lm9iamVjdDtcblx0XHRjb25zdCBzZWxlY3RlZEVsZW1lbnRzID0gZWRpdHNMaXN0Py5nZXRTZWxlY3RlZEVsZW1lbnRzKCkgPz8gW107XG5cdFx0Zm9yIChjb25zdCBlbGVtZW50IG9mIHNlbGVjdGVkRWxlbWVudHMpIHtcblx0XHRcdGlmIChlbGVtZW50LmtpbmQgPT09ICdyZWZlcmVuY2UnICYmIFVSSS5pc1VyaShlbGVtZW50LnJlZmVyZW5jZSkpIHtcblx0XHRcdFx0ZWRpdHMucHVzaChlbGVtZW50LnJlZmVyZW5jZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBlZGl0cztcblx0fVxuXG5cdHByaXZhdGUgX2F0dGVtcHRlZFdvcmtpbmdTZXRFbnRyaWVzQ291bnQ6IG51bWJlciA9IDA7XG5cdC8qKlxuXHQgKiBUaGUgbnVtYmVyIG9mIHdvcmtpbmcgc2V0IGVudHJpZXMgdGhhdCB0aGUgdXNlciBhY3R1YWxseSB3YW50ZWQgdG8gYXR0YWNoLlxuXHQgKiBUaGlzIGlzIGxlc3MgdGhhbiBvciBlcXVhbCB0byB7QGxpbmsgQ2hhdElucHV0UGFydC5jaGF0RWRpdFdvcmtpbmdTZXRGaWxlc30uXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IGF0dGVtcHRlZFdvcmtpbmdTZXRFbnRyaWVzQ291bnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2F0dGVtcHRlZFdvcmtpbmdTZXRFbnRyaWVzQ291bnQ7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IGdldElucHV0U3RhdGU6ICgpID0+IElDaGF0SW5wdXRTdGF0ZTtcblxuXHQvKipcblx0ICogQ2hpbGQgd2lkZ2V0IG9mIHByb21wdCBpbnN0cnVjdGlvbiBhdHRhY2htZW50cy5cblx0ICogU2VlIHtAbGlua2NvZGUgUHJvbXB0QXR0YWNobWVudHNDb2xsZWN0aW9uV2lkZ2V0fS5cblx0ICovXG5cdHByaXZhdGUgaW5zdHJ1Y3Rpb25BdHRhY2htZW50c1BhcnQ6IFByb21wdEF0dGFjaG1lbnRzQ29sbGVjdGlvbldpZGdldDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHQvLyBwcml2YXRlIHJlYWRvbmx5IGVkaXRvck9wdGlvbnM6IENoYXRFZGl0b3JPcHRpb25zLCAvLyBUT0RPIHRoaXMgc2hvdWxkIGJlIHVzZWRcblx0XHRwcml2YXRlIHJlYWRvbmx5IGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM6IElDaGF0SW5wdXRQYXJ0T3B0aW9ucyxcblx0XHRzdHlsZXM6IElDaGF0SW5wdXRTdHlsZXMsXG5cdFx0Z2V0Q29udHJpYnNJbnB1dFN0YXRlOiAoKSA9PiBhbnksXG5cdFx0QElDaGF0V2lkZ2V0SGlzdG9yeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBoaXN0b3J5U2VydmljZTogSUNoYXRXaWRnZXRIaXN0b3J5U2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZSxcblx0XHRASUxhbmd1YWdlTW9kZWxzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlTW9kZWxzU2VydmljZTogSUxhbmd1YWdlTW9kZWxzU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0TW9kZWxSZXNvbHZlclNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJQ2hhdFZhcmlhYmxlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB2YXJpYWJsZVNlcnZpY2U6IElDaGF0VmFyaWFibGVzU2VydmljZSxcblx0XHRASUNoYXRBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhZ2VudFNlcnZpY2U6IElDaGF0QWdlbnRTZXJ2aWNlLFxuXHRcdEBJQ2hhdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0U2VydmljZTogSUNoYXRTZXJ2aWNlLFxuXHRcdEBJU2hhcmVkV2ViQ29udGVudEV4dHJhY3RvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzaGFyZWRXZWJFeHRyYWN0ZXJTZXJ2aWNlOiBJU2hhcmVkV2ViQ29udGVudEV4dHJhY3RvclNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hBc3NpZ25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4cGVyaW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoQXNzaWdubWVudFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9hdHRhY2htZW50TW9kZWwgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRBdHRhY2htZW50TW9kZWwpKTtcblx0XHR0aGlzLnNlbGVjdGVkVG9vbHNNb2RlbCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdFNlbGVjdGVkVG9vbHMpKTtcblx0XHR0aGlzLmRuZCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdERyYWdBbmREcm9wLCB0aGlzLl9hdHRhY2htZW50TW9kZWwsIHN0eWxlcykpO1xuXG5cdFx0dGhpcy5nZXRJbnB1dFN0YXRlID0gKCk6IElDaGF0SW5wdXRTdGF0ZSA9PiB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHQuLi5nZXRDb250cmlic0lucHV0U3RhdGUoKSxcblx0XHRcdFx0Y2hhdENvbnRleHRBdHRhY2htZW50czogdGhpcy5fYXR0YWNobWVudE1vZGVsLmF0dGFjaG1lbnRzLFxuXHRcdFx0XHRjaGF0TW9kZTogdGhpcy5fY3VycmVudE1vZGUsXG5cdFx0XHR9O1xuXHRcdH07XG5cdFx0dGhpcy5pbnB1dEVkaXRvck1heEhlaWdodCA9IHRoaXMub3B0aW9ucy5yZW5kZXJTdHlsZSA9PT0gJ2NvbXBhY3QnID8gSU5QVVRfRURJVE9SX01BWF9IRUlHSFQgLyAzIDogSU5QVVRfRURJVE9SX01BWF9IRUlHSFQ7XG5cblx0XHR0aGlzLmlucHV0RWRpdG9ySGFzVGV4dCA9IENoYXRDb250ZXh0S2V5cy5pbnB1dEhhc1RleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmNoYXRDdXJzb3JBdFRvcCA9IENoYXRDb250ZXh0S2V5cy5pbnB1dEN1cnNvckF0VG9wLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5pbnB1dEVkaXRvckhhc0ZvY3VzID0gQ2hhdENvbnRleHRLZXlzLmlucHV0SGFzRm9jdXMuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnByb21wdEluc3RydWN0aW9uc0F0dGFjaGVkID0gQ2hhdENvbnRleHRLZXlzLmluc3RydWN0aW9uc0F0dGFjaGVkLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5jaGF0TW9kZSA9IENoYXRDb250ZXh0S2V5cy5jaGF0TW9kZS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5oaXN0b3J5ID0gdGhpcy5sb2FkSGlzdG9yeSgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaGlzdG9yeVNlcnZpY2Uub25EaWRDbGVhckhpc3RvcnkoKCkgPT4gdGhpcy5oaXN0b3J5ID0gbmV3IEhpc3RvcnlOYXZpZ2F0b3IyKFt7IHRleHQ6ICcnIH1dLCBDaGF0SW5wdXRIaXN0b3J5TWF4RW50cmllcywgaGlzdG9yeUtleUZuKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkLkNoYXQpKSB7XG5cdFx0XHRcdHRoaXMuaW5wdXRFZGl0b3IudXBkYXRlT3B0aW9ucyh7IGFyaWFMYWJlbDogdGhpcy5fZ2V0QXJpYUxhYmVsKCkgfSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fY2hhdEVkaXRzTGlzdFBvb2wgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbGxhcHNpYmxlTGlzdFBvb2wsIHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5ldmVudCwgTWVudUlkLkNoYXRFZGl0aW5nV2lkZ2V0TW9kaWZpZWRGaWxlc1Rvb2xiYXIpKTtcblxuXHRcdHRoaXMuX2hhc0ZpbGVBdHRhY2htZW50Q29udGV4dEtleSA9IENoYXRDb250ZXh0S2V5cy5oYXNGaWxlQXR0YWNobWVudHMuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuaW5zdHJ1Y3Rpb25BdHRhY2htZW50c1BhcnQgPSB0aGlzLl9yZWdpc3Rlcihcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRQcm9tcHRBdHRhY2htZW50c0NvbGxlY3Rpb25XaWRnZXQsXG5cdFx0XHRcdHRoaXMuYXR0YWNobWVudE1vZGVsLnByb21wdEluc3RydWN0aW9ucyxcblx0XHRcdFx0dGhpcy5fY29udGV4dFJlc291cmNlTGFiZWxzLFxuXHRcdFx0KSxcblx0XHQpO1xuXG5cdFx0Ly8gdHJpZ2dlciByZS1sYXlvdXQgb2YgY2hhdCBpbnB1dCB3aGVuIG51bWJlciBvZiBpbnN0cnVjdGlvbiBhdHRhY2htZW50IGNoYW5nZXNcblx0XHR0aGlzLmluc3RydWN0aW9uQXR0YWNobWVudHNQYXJ0Lm9uQXR0YWNobWVudHNDb3VudENoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLmluaXRTZWxlY3RlZE1vZGVsKCk7XG5cdH1cblxuXHRwcml2YXRlIGdldFNlbGVjdGVkTW9kZWxTdG9yYWdlS2V5KCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGBjaGF0LmN1cnJlbnRMYW5ndWFnZU1vZGVsLiR7dGhpcy5sb2NhdGlvbn1gO1xuXHR9XG5cblx0cHJpdmF0ZSBpbml0U2VsZWN0ZWRNb2RlbCgpIHtcblx0XHRjb25zdCBwZXJzaXN0ZWRTZWxlY3Rpb24gPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldCh0aGlzLmdldFNlbGVjdGVkTW9kZWxTdG9yYWdlS2V5KCksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0aWYgKHBlcnNpc3RlZFNlbGVjdGlvbikge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmxhbmd1YWdlTW9kZWxzU2VydmljZS5sb29rdXBMYW5ndWFnZU1vZGVsKHBlcnNpc3RlZFNlbGVjdGlvbik7XG5cdFx0XHRpZiAobW9kZWwpIHtcblx0XHRcdFx0dGhpcy5zZXRDdXJyZW50TGFuZ3VhZ2VNb2RlbCh7IG1ldGFkYXRhOiBtb2RlbCwgaWRlbnRpZmllcjogcGVyc2lzdGVkU2VsZWN0aW9uIH0pO1xuXHRcdFx0XHR0aGlzLmNoZWNrTW9kZWxTdXBwb3J0ZWQoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX3dhaXRGb3JQZXJzaXN0ZWRMYW5ndWFnZU1vZGVsLnZhbHVlID0gdGhpcy5sYW5ndWFnZU1vZGVsc1NlcnZpY2Uub25EaWRDaGFuZ2VMYW5ndWFnZU1vZGVscyhlID0+IHtcblx0XHRcdFx0XHRjb25zdCBwZXJzaXN0ZWRNb2RlbCA9IGUuYWRkZWQ/LmZpbmQobSA9PiBtLmlkZW50aWZpZXIgPT09IHBlcnNpc3RlZFNlbGVjdGlvbik7XG5cdFx0XHRcdFx0aWYgKHBlcnNpc3RlZE1vZGVsKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl93YWl0Rm9yUGVyc2lzdGVkTGFuZ3VhZ2VNb2RlbC5jbGVhcigpO1xuXG5cdFx0XHRcdFx0XHRpZiAocGVyc2lzdGVkTW9kZWwubWV0YWRhdGEuaXNVc2VyU2VsZWN0YWJsZSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnNldEN1cnJlbnRMYW5ndWFnZU1vZGVsKHsgbWV0YWRhdGE6IHBlcnNpc3RlZE1vZGVsLm1ldGFkYXRhLCBpZGVudGlmaWVyOiBwZXJzaXN0ZWRTZWxlY3Rpb24gfSk7XG5cdFx0XHRcdFx0XHRcdHRoaXMuY2hlY2tNb2RlbFN1cHBvcnRlZCgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fb25EaWRDaGFuZ2VDdXJyZW50Q2hhdE1vZGUuZXZlbnQoKCkgPT4ge1xuXHRcdFx0dGhpcy5jaGVja01vZGVsU3VwcG9ydGVkKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oQ2hhdENvbmZpZ3VyYXRpb24uRWRpdHMyRW5hYmxlZCkpIHtcblx0XHRcdFx0dGhpcy5jaGVja01vZGVsU3VwcG9ydGVkKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHVibGljIHN3aXRjaFRvTmV4dE1vZGVsKCk6IHZvaWQge1xuXHRcdGNvbnN0IG1vZGVscyA9IHRoaXMuZ2V0TW9kZWxzKCk7XG5cdFx0aWYgKG1vZGVscy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBjdXJyZW50SW5kZXggPSBtb2RlbHMuZmluZEluZGV4KG1vZGVsID0+IG1vZGVsLmlkZW50aWZpZXIgPT09IHRoaXMuX2N1cnJlbnRMYW5ndWFnZU1vZGVsPy5pZGVudGlmaWVyKTtcblx0XHRcdGNvbnN0IG5leHRJbmRleCA9IChjdXJyZW50SW5kZXggKyAxKSAlIG1vZGVscy5sZW5ndGg7XG5cdFx0XHR0aGlzLnNldEN1cnJlbnRMYW5ndWFnZU1vZGVsKG1vZGVsc1tuZXh0SW5kZXhdKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNoZWNrTW9kZWxTdXBwb3J0ZWQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2N1cnJlbnRMYW5ndWFnZU1vZGVsICYmICF0aGlzLm1vZGVsU3VwcG9ydGVkRm9yRGVmYXVsdEFnZW50KHRoaXMuX2N1cnJlbnRMYW5ndWFnZU1vZGVsKSkge1xuXHRcdFx0dGhpcy5zZXRDdXJyZW50TGFuZ3VhZ2VNb2RlbFRvRGVmYXVsdCgpO1xuXHRcdH1cblx0fVxuXG5cdHNldENoYXRNb2RlKG1vZGU6IENoYXRNb2RlKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLm9wdGlvbnMuc3VwcG9ydHNDaGFuZ2luZ01vZGVzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bW9kZSA9IHZhbGlkYXRlQ2hhdE1vZGUobW9kZSkgPz8gKHRoaXMubG9jYXRpb24gPT09IENoYXRBZ2VudExvY2F0aW9uLlBhbmVsID8gQ2hhdE1vZGUuQXNrIDogQ2hhdE1vZGUuRWRpdCk7XG5cdFx0dGhpcy5fY3VycmVudE1vZGUgPSBtb2RlO1xuXHRcdHRoaXMuY2hhdE1vZGUuc2V0KG1vZGUpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ3VycmVudENoYXRNb2RlLmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgbW9kZWxTdXBwb3J0ZWRGb3JEZWZhdWx0QWdlbnQobW9kZWw6IElMYW5ndWFnZU1vZGVsQ2hhdE1ldGFkYXRhQW5kSWRlbnRpZmllcik6IGJvb2xlYW4ge1xuXHRcdC8vIFByb2JhYmx5IHRoaXMgbG9naWMgY291bGQgbGl2ZSBpbiBjb25maWd1cmF0aW9uIG9uIHRoZSBhZ2VudCwgb3Igc29tZXdoZXJlIGVsc2UsIGlmIGl0IGdldHMgbW9yZSBjb21wbGV4XG5cdFx0aWYgKHRoaXMuY3VycmVudE1vZGUgPT09IENoYXRNb2RlLkFnZW50IHx8ICh0aGlzLmN1cnJlbnRNb2RlID09PSBDaGF0TW9kZS5FZGl0ICYmIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoQ2hhdENvbmZpZ3VyYXRpb24uRWRpdHMyRW5hYmxlZCkpKSB7XG5cdFx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnY2hhdC5hZ2VudC5hbGxNb2RlbHMnKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc3VwcG9ydHNUb29sc0FnZW50ID0gdHlwZW9mIG1vZGVsLm1ldGFkYXRhLmNhcGFiaWxpdGllcz8uYWdlbnRNb2RlID09PSAndW5kZWZpbmVkJyB8fCBtb2RlbC5tZXRhZGF0YS5jYXBhYmlsaXRpZXMuYWdlbnRNb2RlO1xuXG5cdFx0XHQvLyBGaWx0ZXIgb3V0IG1vZGVscyB0aGF0IGRvbid0IHN1cHBvcnQgdG9vbCBjYWxsaW5nLCBhbmQgbW9kZWxzIHRoYXQgZG9uJ3Qgc3VwcG9ydCBlbm91Z2ggY29udGV4dCB0byBoYXZlIGEgZ29vZCBleHBlcmllbmNlIHdpdGggdGhlIHRvb2xzIGFnZW50XG5cdFx0XHRyZXR1cm4gc3VwcG9ydHNUb29sc0FnZW50ICYmICEhbW9kZWwubWV0YWRhdGEuY2FwYWJpbGl0aWVzPy50b29sQ2FsbGluZztcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0TW9kZWxzKCk6IElMYW5ndWFnZU1vZGVsQ2hhdE1ldGFkYXRhQW5kSWRlbnRpZmllcltdIHtcblx0XHRjb25zdCBtb2RlbHMgPSB0aGlzLmxhbmd1YWdlTW9kZWxzU2VydmljZS5nZXRMYW5ndWFnZU1vZGVsSWRzKClcblx0XHRcdC5tYXAobW9kZWxJZCA9PiAoeyBpZGVudGlmaWVyOiBtb2RlbElkLCBtZXRhZGF0YTogdGhpcy5sYW5ndWFnZU1vZGVsc1NlcnZpY2UubG9va3VwTGFuZ3VhZ2VNb2RlbChtb2RlbElkKSEgfSkpXG5cdFx0XHQuZmlsdGVyKGVudHJ5ID0+IGVudHJ5Lm1ldGFkYXRhPy5pc1VzZXJTZWxlY3RhYmxlICYmIHRoaXMubW9kZWxTdXBwb3J0ZWRGb3JEZWZhdWx0QWdlbnQoZW50cnkpKTtcblx0XHRtb2RlbHMuc29ydCgoYSwgYikgPT4gYS5tZXRhZGF0YS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5tZXRhZGF0YS5uYW1lKSk7XG5cblx0XHRyZXR1cm4gbW9kZWxzO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRDdXJyZW50TGFuZ3VhZ2VNb2RlbFRvRGVmYXVsdCgpIHtcblx0XHRjb25zdCBkZWZhdWx0TGFuZ3VhZ2VNb2RlbElkID0gdGhpcy5sYW5ndWFnZU1vZGVsc1NlcnZpY2UuZ2V0TGFuZ3VhZ2VNb2RlbElkcygpLmZpbmQoaWQgPT4gdGhpcy5sYW5ndWFnZU1vZGVsc1NlcnZpY2UubG9va3VwTGFuZ3VhZ2VNb2RlbChpZCk/LmlzRGVmYXVsdCk7XG5cdFx0Y29uc3QgaGFzVXNlclNlbGVjdGFibGVMYW5ndWFnZU1vZGVscyA9IHRoaXMubGFuZ3VhZ2VNb2RlbHNTZXJ2aWNlLmdldExhbmd1YWdlTW9kZWxJZHMoKS5maW5kKGlkID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5sYW5ndWFnZU1vZGVsc1NlcnZpY2UubG9va3VwTGFuZ3VhZ2VNb2RlbChpZCk7XG5cdFx0XHRyZXR1cm4gbW9kZWw/LmlzVXNlclNlbGVjdGFibGUgJiYgIW1vZGVsLmlzRGVmYXVsdDtcblx0XHR9KTtcblx0XHRjb25zdCBkZWZhdWx0TW9kZWwgPSBoYXNVc2VyU2VsZWN0YWJsZUxhbmd1YWdlTW9kZWxzICYmIGRlZmF1bHRMYW5ndWFnZU1vZGVsSWQgP1xuXHRcdFx0eyBtZXRhZGF0YTogdGhpcy5sYW5ndWFnZU1vZGVsc1NlcnZpY2UubG9va3VwTGFuZ3VhZ2VNb2RlbChkZWZhdWx0TGFuZ3VhZ2VNb2RlbElkKSEsIGlkZW50aWZpZXI6IGRlZmF1bHRMYW5ndWFnZU1vZGVsSWQgfSA6XG5cdFx0XHR1bmRlZmluZWQ7XG5cdFx0aWYgKGRlZmF1bHRNb2RlbCkge1xuXHRcdFx0dGhpcy5zZXRDdXJyZW50TGFuZ3VhZ2VNb2RlbChkZWZhdWx0TW9kZWwpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2V0Q3VycmVudExhbmd1YWdlTW9kZWwobW9kZWw6IElMYW5ndWFnZU1vZGVsQ2hhdE1ldGFkYXRhQW5kSWRlbnRpZmllcikge1xuXHRcdHRoaXMuX2N1cnJlbnRMYW5ndWFnZU1vZGVsID0gbW9kZWw7XG5cblx0XHRpZiAodGhpcy5jYWNoZWREaW1lbnNpb25zKSB7XG5cdFx0XHQvLyBGb3IgcXVpY2sgY2hhdCBhbmQgZWRpdG9yIGNoYXQsIHJlbGF5b3V0IGJlY2F1c2UgdGhlIGlucHV0IG1heSBuZWVkIHRvIHNocmluayB0byBhY2NvbW9kYXRlIHRoZSBtb2RlbCBuYW1lXG5cdFx0XHR0aGlzLmxheW91dCh0aGlzLmNhY2hlZERpbWVuc2lvbnMuaGVpZ2h0LCB0aGlzLmNhY2hlZERpbWVuc2lvbnMud2lkdGgpO1xuXHRcdH1cblxuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUodGhpcy5nZXRTZWxlY3RlZE1vZGVsU3RvcmFnZUtleSgpLCBtb2RlbC5pZGVudGlmaWVyLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZUN1cnJlbnRMYW5ndWFnZU1vZGVsLmZpcmUobW9kZWwpO1xuXHR9XG5cblx0cHJpdmF0ZSBsb2FkSGlzdG9yeSgpOiBIaXN0b3J5TmF2aWdhdG9yMjxJQ2hhdEhpc3RvcnlFbnRyeT4ge1xuXHRcdGNvbnN0IGhpc3RvcnkgPSB0aGlzLmhpc3RvcnlTZXJ2aWNlLmdldEhpc3RvcnkodGhpcy5sb2NhdGlvbik7XG5cdFx0aWYgKGhpc3RvcnkubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRoaXN0b3J5LnB1c2goeyB0ZXh0OiAnJyB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IEhpc3RvcnlOYXZpZ2F0b3IyKGhpc3RvcnksIDUwLCBoaXN0b3J5S2V5Rm4pO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0QXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0Y29uc3QgdmVyYm9zZSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZC5DaGF0KTtcblx0XHRpZiAodmVyYm9zZSkge1xuXHRcdFx0Y29uc3Qga2JMYWJlbCA9IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhBY2Nlc3NpYmlsaXR5Q29tbWFuZElkLk9wZW5BY2Nlc3NpYmlsaXR5SGVscCk/LmdldExhYmVsKCk7XG5cdFx0XHRyZXR1cm4ga2JMYWJlbCA/IGxvY2FsaXplKCdhY3Rpb25zLmNoYXQuYWNjZXNzaWJpbHR5SGVscCcsIFwiQ2hhdCBJbnB1dCwgIFR5cGUgdG8gYXNrIHF1ZXN0aW9ucyBvciB0eXBlIC8gZm9yIHRvcGljcywgcHJlc3MgZW50ZXIgdG8gc2VuZCBvdXQgdGhlIHJlcXVlc3QuIFVzZSB7MH0gZm9yIENoYXQgQWNjZXNzaWJpbGl0eSBIZWxwLlwiLCBrYkxhYmVsKSA6IGxvY2FsaXplKCdjaGF0SW5wdXQuYWNjZXNzaWJpbGl0eUhlbHBOb0tiJywgXCJDaGF0IElucHV0LCAgVHlwZSBjb2RlIGhlcmUgYW5kIHByZXNzIEVudGVyIHRvIHJ1bi4gVXNlIHRoZSBDaGF0IEFjY2Vzc2liaWxpdHkgSGVscCBjb21tYW5kIGZvciBtb3JlIGluZm9ybWF0aW9uLlwiKTtcblx0XHR9XG5cdFx0cmV0dXJuIGxvY2FsaXplKCdjaGF0SW5wdXQnLCBcIkNoYXQgSW5wdXRcIik7XG5cdH1cblxuXHRpbml0Rm9yTmV3Q2hhdE1vZGVsKHN0YXRlOiBJQ2hhdFZpZXdTdGF0ZSwgbW9kZWxJc0VtcHR5OiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5oaXN0b3J5ID0gdGhpcy5sb2FkSGlzdG9yeSgpO1xuXHRcdHRoaXMuaGlzdG9yeS5hZGQoe1xuXHRcdFx0dGV4dDogc3RhdGUuaW5wdXRWYWx1ZSA/PyB0aGlzLmhpc3RvcnkuY3VycmVudCgpLnRleHQsXG5cdFx0XHRzdGF0ZTogc3RhdGUuaW5wdXRTdGF0ZSA/PyB0aGlzLmdldElucHV0U3RhdGUoKVxuXHRcdH0pO1xuXHRcdGNvbnN0IGF0dGFjaG1lbnRzID0gc3RhdGUuaW5wdXRTdGF0ZT8uY2hhdENvbnRleHRBdHRhY2htZW50cyA/PyBbXTtcblx0XHR0aGlzLl9hdHRhY2htZW50TW9kZWwuY2xlYXJBbmRTZXRDb250ZXh0KC4uLmF0dGFjaG1lbnRzKTtcblxuXHRcdGlmIChzdGF0ZS5pbnB1dFZhbHVlKSB7XG5cdFx0XHR0aGlzLnNldFZhbHVlKHN0YXRlLmlucHV0VmFsdWUsIGZhbHNlKTtcblx0XHR9XG5cblx0XHRpZiAoc3RhdGUuaW5wdXRTdGF0ZT8uY2hhdE1vZGUpIHtcblx0XHRcdHRoaXMuc2V0Q2hhdE1vZGUoc3RhdGUuaW5wdXRTdGF0ZS5jaGF0TW9kZSk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmxvY2F0aW9uID09PSBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbikge1xuXHRcdFx0dGhpcy5zZXRDaGF0TW9kZShDaGF0TW9kZS5FZGl0KTtcblx0XHR9XG5cblx0XHRpZiAobW9kZWxJc0VtcHR5KSB7XG5cdFx0XHRjb25zdCBzdG9yYWdlS2V5ID0gdGhpcy5nZXREZWZhdWx0TW9kZUV4cGVyaW1lbnRTdG9yYWdlS2V5KCk7XG5cdFx0XHRjb25zdCBoYXNTZXREZWZhdWx0TW9kZSA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0Qm9vbGVhbihzdG9yYWdlS2V5LCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBmYWxzZSk7XG5cdFx0XHRpZiAoIWhhc1NldERlZmF1bHRNb2RlKSB7XG5cdFx0XHRcdFByb21pc2UuYWxsKFtcblx0XHRcdFx0XHR0aGlzLmV4cGVyaW1lbnRTZXJ2aWNlLmdldFRyZWF0bWVudCgnY2hhdC5kZWZhdWx0TW9kZScpLFxuXHRcdFx0XHRcdHRoaXMuZXhwZXJpbWVudFNlcnZpY2UuZ2V0VHJlYXRtZW50KCdjaGF0LmRlZmF1bHRMYW5ndWFnZU1vZGVsJyksXG5cdFx0XHRcdF0pLnRoZW4oKFtkZWZhdWx0TW9kZVRyZWF0bWVudCwgZGVmYXVsdExhbmd1YWdlTW9kZWxUcmVhdG1lbnRdKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBkZWZhdWx0TW9kZVRyZWF0bWVudCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoc3RvcmFnZUtleSwgdHJ1ZSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRcdFx0XHRcdGNvbnN0IGRlZmF1bHRNb2RlID0gdmFsaWRhdGVDaGF0TW9kZShkZWZhdWx0TW9kZVRyZWF0bWVudCk7XG5cdFx0XHRcdFx0XHRpZiAoZGVmYXVsdE1vZGUpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBBcHBseWluZyBkZWZhdWx0IG1vZGUgZnJvbSBleHBlcmltZW50OiAke2RlZmF1bHRNb2RlfWApO1xuXHRcdFx0XHRcdFx0XHR0aGlzLnNldENoYXRNb2RlKGRlZmF1bHRNb2RlKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5jaGVja01vZGVsU3VwcG9ydGVkKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBkZWZhdWx0TGFuZ3VhZ2VNb2RlbFRyZWF0bWVudCA9PT0gJ3N0cmluZycgJiYgdGhpcy5fY3VycmVudE1vZGUgPT09IENoYXRNb2RlLkFnZW50KSB7XG5cdFx0XHRcdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKHN0b3JhZ2VLZXksIHRydWUsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEFwcGx5aW5nIGRlZmF1bHQgbGFuZ3VhZ2UgbW9kZWwgZnJvbSBleHBlcmltZW50OiAke2RlZmF1bHRMYW5ndWFnZU1vZGVsVHJlYXRtZW50fWApO1xuXHRcdFx0XHRcdFx0dGhpcy5zZXRFeHBNb2RlbE9yV2FpdChkZWZhdWx0TGFuZ3VhZ2VNb2RlbFRyZWF0bWVudCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldEV4cE1vZGVsT3JXYWl0KG1vZGVsSWQ6IHN0cmluZykge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5sYW5ndWFnZU1vZGVsc1NlcnZpY2UubG9va3VwTGFuZ3VhZ2VNb2RlbChtb2RlbElkKTtcblx0XHRpZiAobW9kZWwpIHtcblx0XHRcdHRoaXMuc2V0Q3VycmVudExhbmd1YWdlTW9kZWwoeyBtZXRhZGF0YTogbW9kZWwsIGlkZW50aWZpZXI6IG1vZGVsSWQgfSk7XG5cdFx0XHR0aGlzLmNoZWNrTW9kZWxTdXBwb3J0ZWQoKTtcblx0XHRcdHRoaXMuX3dhaXRGb3JQZXJzaXN0ZWRMYW5ndWFnZU1vZGVsLmNsZWFyKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3dhaXRGb3JQZXJzaXN0ZWRMYW5ndWFnZU1vZGVsLnZhbHVlID0gdGhpcy5sYW5ndWFnZU1vZGVsc1NlcnZpY2Uub25EaWRDaGFuZ2VMYW5ndWFnZU1vZGVscyhlID0+IHtcblx0XHRcdFx0Y29uc3QgbW9kZWwgPSBlLmFkZGVkPy5maW5kKG0gPT4gbS5pZGVudGlmaWVyID09PSBtb2RlbElkKTtcblx0XHRcdFx0aWYgKG1vZGVsKSB7XG5cdFx0XHRcdFx0dGhpcy5fd2FpdEZvclBlcnNpc3RlZExhbmd1YWdlTW9kZWwuY2xlYXIoKTtcblxuXHRcdFx0XHRcdGlmIChtb2RlbC5tZXRhZGF0YS5pc1VzZXJTZWxlY3RhYmxlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnNldEN1cnJlbnRMYW5ndWFnZU1vZGVsKHsgbWV0YWRhdGE6IG1vZGVsLm1ldGFkYXRhLCBpZGVudGlmaWVyOiBtb2RlbElkIH0pO1xuXHRcdFx0XHRcdFx0dGhpcy5jaGVja01vZGVsU3VwcG9ydGVkKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldERlZmF1bHRNb2RlRXhwZXJpbWVudFN0b3JhZ2VLZXkoKTogc3RyaW5nIHtcblx0XHRjb25zdCB0YWcgPSB0aGlzLm9wdGlvbnMud2lkZ2V0Vmlld0tpbmRUYWc7XG5cdFx0cmV0dXJuIGBjaGF0LiR7dGFnfS5oYXNTZXREZWZhdWx0TW9kZUJ5RXhwZXJpbWVudGA7XG5cdH1cblxuXHRsb2dJbnB1dEhpc3RvcnkoKTogdm9pZCB7XG5cdFx0Y29uc3QgaGlzdG9yeVN0ciA9IFsuLi50aGlzLmhpc3RvcnldLm1hcChlbnRyeSA9PiBKU09OLnN0cmluZ2lmeShlbnRyeSkpLmpvaW4oJ1xcbicpO1xuXHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGBbJHt0aGlzLmxvY2F0aW9ufV0gQ2hhdCBpbnB1dCBoaXN0b3J5OmAsIGhpc3RvcnlTdHIpO1xuXHR9XG5cblx0c2V0VmlzaWJsZSh2aXNpYmxlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VWaXNpYmlsaXR5LmZpcmUodmlzaWJsZSk7XG5cdH1cblxuXHRnZXQgZWxlbWVudCgpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuY29udGFpbmVyO1xuXHR9XG5cblx0YXN5bmMgc2hvd1ByZXZpb3VzVmFsdWUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaW5wdXRTdGF0ZSA9IHRoaXMuZ2V0SW5wdXRTdGF0ZSgpO1xuXHRcdGlmICh0aGlzLmhpc3RvcnkuaXNBdEVuZCgpKSB7XG5cdFx0XHR0aGlzLnNhdmVDdXJyZW50VmFsdWUoaW5wdXRTdGF0ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGN1cnJlbnRFbnRyeSA9IHRoaXMuZ2V0RmlsdGVyZWRFbnRyeSh0aGlzLl9pbnB1dEVkaXRvci5nZXRWYWx1ZSgpLCBpbnB1dFN0YXRlKTtcblx0XHRcdGlmICghdGhpcy5oaXN0b3J5LmhhcyhjdXJyZW50RW50cnkpKSB7XG5cdFx0XHRcdHRoaXMuc2F2ZUN1cnJlbnRWYWx1ZShpbnB1dFN0YXRlKTtcblx0XHRcdFx0dGhpcy5oaXN0b3J5LnJlc2V0Q3Vyc29yKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5uYXZpZ2F0ZUhpc3RvcnkodHJ1ZSk7XG5cdH1cblxuXHRhc3luYyBzaG93TmV4dFZhbHVlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGlucHV0U3RhdGUgPSB0aGlzLmdldElucHV0U3RhdGUoKTtcblx0XHRpZiAodGhpcy5oaXN0b3J5LmlzQXRFbmQoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBjdXJyZW50RW50cnkgPSB0aGlzLmdldEZpbHRlcmVkRW50cnkodGhpcy5faW5wdXRFZGl0b3IuZ2V0VmFsdWUoKSwgaW5wdXRTdGF0ZSk7XG5cdFx0XHRpZiAoIXRoaXMuaGlzdG9yeS5oYXMoY3VycmVudEVudHJ5KSkge1xuXHRcdFx0XHR0aGlzLnNhdmVDdXJyZW50VmFsdWUoaW5wdXRTdGF0ZSk7XG5cdFx0XHRcdHRoaXMuaGlzdG9yeS5yZXNldEN1cnNvcigpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMubmF2aWdhdGVIaXN0b3J5KGZhbHNlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgbmF2aWdhdGVIaXN0b3J5KHByZXZpb3VzOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaGlzdG9yeUVudHJ5ID0gcHJldmlvdXMgP1xuXHRcdFx0dGhpcy5oaXN0b3J5LnByZXZpb3VzKCkgOiB0aGlzLmhpc3RvcnkubmV4dCgpO1xuXG5cdFx0bGV0IGhpc3RvcnlBdHRhY2htZW50cyA9IGhpc3RvcnlFbnRyeS5zdGF0ZT8uY2hhdENvbnRleHRBdHRhY2htZW50cyA/PyBbXTtcblxuXHRcdC8vIENoZWNrIGZvciBpbWFnZXMgaW4gaGlzdG9yeSB0byByZXN0b3JlIHRoZSB2YWx1ZS5cblx0XHRpZiAoaGlzdG9yeUF0dGFjaG1lbnRzLmxlbmd0aCA+IDApIHtcblx0XHRcdGhpc3RvcnlBdHRhY2htZW50cyA9IChhd2FpdCBQcm9taXNlLmFsbChoaXN0b3J5QXR0YWNobWVudHMubWFwKGFzeW5jIChhdHRhY2htZW50KSA9PiB7XG5cdFx0XHRcdGlmIChhdHRhY2htZW50LmlzSW1hZ2UgJiYgYXR0YWNobWVudC5yZWZlcmVuY2VzPy5sZW5ndGggJiYgVVJJLmlzVXJpKGF0dGFjaG1lbnQucmVmZXJlbmNlc1swXS5yZWZlcmVuY2UpKSB7XG5cdFx0XHRcdFx0Y29uc3QgY3VyclJlZmVyZW5jZSA9IGF0dGFjaG1lbnQucmVmZXJlbmNlc1swXS5yZWZlcmVuY2U7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGNvbnN0IGltYWdlQmluYXJ5ID0gY3VyclJlZmVyZW5jZS50b1N0cmluZyh0cnVlKS5zdGFydHNXaXRoKCdodHRwJykgPyBhd2FpdCB0aGlzLnNoYXJlZFdlYkV4dHJhY3RlclNlcnZpY2UucmVhZEltYWdlKGN1cnJSZWZlcmVuY2UsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpIDogKGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVhZEZpbGUoY3VyclJlZmVyZW5jZSkpLnZhbHVlO1xuXHRcdFx0XHRcdFx0aWYgKCFpbWFnZUJpbmFyeSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y29uc3QgbmV3QXR0YWNobWVudCA9IHsgLi4uYXR0YWNobWVudCB9O1xuXHRcdFx0XHRcdFx0bmV3QXR0YWNobWVudC52YWx1ZSA9IChpc0ltYWdlVmFyaWFibGVFbnRyeShhdHRhY2htZW50KSAmJiBhdHRhY2htZW50LmlzUGFzdGVkKSA/IGltYWdlQmluYXJ5LmJ1ZmZlciA6IGF3YWl0IHJlc2l6ZUltYWdlKGltYWdlQmluYXJ5LmJ1ZmZlcik7IC8vIGlmIHBhc3RlZCBpbWFnZSwgd2UgZG8gbm90IG5lZWQgdG8gcmVzaXplLlxuXHRcdFx0XHRcdFx0cmV0dXJuIG5ld0F0dGFjaG1lbnQ7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoJ0ZhaWxlZCB0byBmZXRjaCBhbmQgcmVmZXJlbmNlLicsIGVycik7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gYXR0YWNobWVudDtcblx0XHRcdH0pKSkuZmlsdGVyKGF0dGFjaG1lbnQgPT4gYXR0YWNobWVudCAhPT0gdW5kZWZpbmVkKTtcblx0XHR9XG5cblx0XHR0aGlzLl9hdHRhY2htZW50TW9kZWwuY2xlYXJBbmRTZXRDb250ZXh0KC4uLmhpc3RvcnlBdHRhY2htZW50cyk7XG5cblx0XHRhcmlhLnN0YXR1cyhoaXN0b3J5RW50cnkudGV4dCk7XG5cdFx0dGhpcy5zZXRWYWx1ZShoaXN0b3J5RW50cnkudGV4dCwgdHJ1ZSk7XG5cblx0XHR0aGlzLl9vbkRpZExvYWRJbnB1dFN0YXRlLmZpcmUoaGlzdG9yeUVudHJ5LnN0YXRlKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5faW5wdXRFZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHByZXZpb3VzKSB7XG5cdFx0XHRjb25zdCBlbmRPZkZpcnN0Vmlld0xpbmUgPSB0aGlzLl9pbnB1dEVkaXRvci5fZ2V0Vmlld01vZGVsKCk/LmdldExpbmVMZW5ndGgoMSkgPz8gMTtcblx0XHRcdGNvbnN0IGVuZE9mRmlyc3RNb2RlbExpbmUgPSBtb2RlbC5nZXRMaW5lTGVuZ3RoKDEpO1xuXHRcdFx0aWYgKGVuZE9mRmlyc3RWaWV3TGluZSA9PT0gZW5kT2ZGaXJzdE1vZGVsTGluZSkge1xuXHRcdFx0XHQvLyBOb3Qgd3JhcHBlZCAtIHNldCBjdXJzb3IgdG8gdGhlIGVuZCBvZiB0aGUgZmlyc3QgbGluZVxuXHRcdFx0XHR0aGlzLl9pbnB1dEVkaXRvci5zZXRQb3NpdGlvbih7IGxpbmVOdW1iZXI6IDEsIGNvbHVtbjogZW5kT2ZGaXJzdFZpZXdMaW5lICsgMSB9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFdyYXBwZWQgLSBzZXQgY3Vyc29yIG9uZSBjaGFyIHNob3J0IG9mIHRoZSBlbmQgb2YgdGhlIGZpcnN0IHZpZXcgbGluZS5cblx0XHRcdFx0Ly8gSWYgaXQncyBhZnRlciB0aGUgbmV4dCBjaGFyYWN0ZXIsIHRoZSBjdXJzb3Igc2hvd3Mgb24gdGhlIHNlY29uZCBsaW5lLlxuXHRcdFx0XHR0aGlzLl9pbnB1dEVkaXRvci5zZXRQb3NpdGlvbih7IGxpbmVOdW1iZXI6IDEsIGNvbHVtbjogZW5kT2ZGaXJzdFZpZXdMaW5lIH0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9pbnB1dEVkaXRvci5zZXRQb3NpdGlvbihnZXRMYXN0UG9zaXRpb24obW9kZWwpKTtcblx0XHR9XG5cdH1cblxuXHRzZXRWYWx1ZSh2YWx1ZTogc3RyaW5nLCB0cmFuc2llbnQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLmlucHV0RWRpdG9yLnNldFZhbHVlKHZhbHVlKTtcblx0XHQvLyBhbHdheXMgbGVhdmUgY3Vyc29yIGF0IHRoZSBlbmRcblx0XHR0aGlzLmlucHV0RWRpdG9yLnNldFBvc2l0aW9uKHsgbGluZU51bWJlcjogMSwgY29sdW1uOiB2YWx1ZS5sZW5ndGggKyAxIH0pO1xuXG5cdFx0aWYgKCF0cmFuc2llbnQpIHtcblx0XHRcdHRoaXMuc2F2ZUN1cnJlbnRWYWx1ZSh0aGlzLmdldElucHV0U3RhdGUoKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzYXZlQ3VycmVudFZhbHVlKGlucHV0U3RhdGU6IElDaGF0SW5wdXRTdGF0ZSk6IHZvaWQge1xuXHRcdGNvbnN0IG5ld0VudHJ5ID0gdGhpcy5nZXRGaWx0ZXJlZEVudHJ5KHRoaXMuX2lucHV0RWRpdG9yLmdldFZhbHVlKCksIGlucHV0U3RhdGUpO1xuXHRcdHRoaXMuaGlzdG9yeS5yZXBsYWNlTGFzdChuZXdFbnRyeSk7XG5cdH1cblxuXHRmb2N1cygpIHtcblx0XHR0aGlzLl9pbnB1dEVkaXRvci5mb2N1cygpO1xuXHR9XG5cblx0aGFzRm9jdXMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2lucHV0RWRpdG9yLmhhc1dpZGdldEZvY3VzKCk7XG5cdH1cblxuXHQvKipcblx0ICogUmVzZXQgdGhlIGlucHV0IGFuZCB1cGRhdGUgaGlzdG9yeS5cblx0ICogQHBhcmFtIHVzZXJRdWVyeSBJZiBwcm92aWRlZCwgdGhpcyB3aWxsIGJlIGFkZGVkIHRvIHRoZSBoaXN0b3J5LiBGb2xsb3d1cHMgYW5kIHByb2dyYW1tYXRpYyBxdWVyaWVzIHNob3VsZCBub3QgYmUgcGFzc2VkLlxuXHQgKi9cblx0YXN5bmMgYWNjZXB0SW5wdXQoaXNVc2VyUXVlcnk/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGlzVXNlclF1ZXJ5KSB7XG5cdFx0XHRjb25zdCB1c2VyUXVlcnkgPSB0aGlzLl9pbnB1dEVkaXRvci5nZXRWYWx1ZSgpO1xuXHRcdFx0Y29uc3QgaW5wdXRTdGF0ZSA9IHRoaXMuZ2V0SW5wdXRTdGF0ZSgpO1xuXHRcdFx0Y29uc3QgZW50cnkgPSB0aGlzLmdldEZpbHRlcmVkRW50cnkodXNlclF1ZXJ5LCBpbnB1dFN0YXRlKTtcblx0XHRcdHRoaXMuaGlzdG9yeS5yZXBsYWNlTGFzdChlbnRyeSk7XG5cdFx0XHR0aGlzLmhpc3RvcnkuYWRkKHsgdGV4dDogJycgfSk7XG5cdFx0fVxuXG5cdFx0Ly8gQ2xlYXIgYXR0YWNoZWQgY29udGV4dCwgZmlyZSBldmVudCB0byBjbGVhciBpbnB1dCBzdGF0ZSwgYW5kIGNsZWFyIHRoZSBpbnB1dCBlZGl0b3Jcblx0XHR0aGlzLmF0dGFjaG1lbnRNb2RlbC5jbGVhcigpO1xuXHRcdHRoaXMuX29uRGlkTG9hZElucHV0U3RhdGUuZmlyZSh7fSk7XG5cdFx0aWYgKHRoaXMuYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKSAmJiBpc01hY2ludG9zaCkge1xuXHRcdFx0dGhpcy5fYWNjZXB0SW5wdXRGb3JWb2ljZW92ZXIoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5faW5wdXRFZGl0b3IuZm9jdXMoKTtcblx0XHRcdHRoaXMuX2lucHV0RWRpdG9yLnNldFZhbHVlKCcnKTtcblx0XHR9XG5cdH1cblxuXHR2YWxpZGF0ZUN1cnJlbnRNb2RlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5hZ2VudFNlcnZpY2UuaGFzVG9vbHNBZ2VudCAmJiB0aGlzLl9jdXJyZW50TW9kZSA9PT0gQ2hhdE1vZGUuQWdlbnQpIHtcblx0XHRcdHRoaXMuc2V0Q2hhdE1vZGUoQ2hhdE1vZGUuRWRpdCk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gQSBmdW50aW9uIHRoYXQgZmlsdGVycyBvdXQgc3BlY2lmaWNhbGx5IHRoZSBgdmFsdWVgIHByb3BlcnR5IG9mIHRoZSBhdHRhY2htZW50LlxuXHRwcml2YXRlIGdldEZpbHRlcmVkRW50cnkocXVlcnk6IHN0cmluZywgaW5wdXRTdGF0ZTogSUNoYXRJbnB1dFN0YXRlKTogSUNoYXRIaXN0b3J5RW50cnkge1xuXHRcdGNvbnN0IGF0dGFjaG1lbnRzV2l0aG91dEltYWdlVmFsdWVzID0gaW5wdXRTdGF0ZS5jaGF0Q29udGV4dEF0dGFjaG1lbnRzPy5tYXAoYXR0YWNobWVudCA9PiB7XG5cdFx0XHRpZiAoYXR0YWNobWVudC5pc0ltYWdlICYmIGF0dGFjaG1lbnQucmVmZXJlbmNlcz8ubGVuZ3RoICYmIGF0dGFjaG1lbnQudmFsdWUpIHtcblx0XHRcdFx0Y29uc3QgbmV3QXR0YWNobWVudCA9IHsgLi4uYXR0YWNobWVudCB9O1xuXHRcdFx0XHRuZXdBdHRhY2htZW50LnZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRyZXR1cm4gbmV3QXR0YWNobWVudDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBhdHRhY2htZW50O1xuXHRcdH0pO1xuXG5cdFx0aW5wdXRTdGF0ZS5jaGF0Q29udGV4dEF0dGFjaG1lbnRzID0gYXR0YWNobWVudHNXaXRob3V0SW1hZ2VWYWx1ZXM7XG5cdFx0Y29uc3QgbmV3RW50cnkgPSB7XG5cdFx0XHR0ZXh0OiBxdWVyeSxcblx0XHRcdHN0YXRlOiBpbnB1dFN0YXRlLFxuXHRcdH07XG5cblx0XHRyZXR1cm4gbmV3RW50cnk7XG5cdH1cblxuXHRwcml2YXRlIF9hY2NlcHRJbnB1dEZvclZvaWNlb3ZlcigpOiB2b2lkIHtcblx0XHRjb25zdCBkb21Ob2RlID0gdGhpcy5faW5wdXRFZGl0b3IuZ2V0RG9tTm9kZSgpO1xuXHRcdGlmICghZG9tTm9kZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQvLyBSZW1vdmUgdGhlIGlucHV0IGVkaXRvciBmcm9tIHRoZSBET00gdGVtcG9yYXJpbHkgdG8gcHJldmVudCBWb2ljZU92ZXJcblx0XHQvLyBmcm9tIHJlYWRpbmcgdGhlIGNsZWFyZWQgdGV4dCAodGhlIHJlcXVlc3QpIHRvIHRoZSB1c2VyLlxuXHRcdGRvbU5vZGUucmVtb3ZlKCk7XG5cdFx0dGhpcy5faW5wdXRFZGl0b3Iuc2V0VmFsdWUoJycpO1xuXHRcdHRoaXMuX2lucHV0RWRpdG9yRWxlbWVudC5hcHBlbmRDaGlsZChkb21Ob2RlKTtcblx0XHR0aGlzLl9pbnB1dEVkaXRvci5mb2N1cygpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGFuZGxlQXR0YWNoZWRDb250ZXh0Q2hhbmdlKCkge1xuXHRcdHRoaXMuX2hhc0ZpbGVBdHRhY2htZW50Q29udGV4dEtleS5zZXQoQm9vbGVhbih0aGlzLl9hdHRhY2htZW50TW9kZWwuYXR0YWNobWVudHMuZmluZChhID0+IGEuaXNGaWxlKSkpO1xuXHRcdHRoaXMucmVuZGVyQXR0YWNoZWRDb250ZXh0KCk7XG5cdH1cblxuXHRyZW5kZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgaW5pdGlhbFZhbHVlOiBzdHJpbmcsIHdpZGdldDogSUNoYXRXaWRnZXQpIHtcblx0XHRsZXQgZWxlbWVudHM7XG5cdFx0aWYgKHRoaXMub3B0aW9ucy5yZW5kZXJTdHlsZSA9PT0gJ2NvbXBhY3QnKSB7XG5cdFx0XHRlbGVtZW50cyA9IGRvbS5oKCcuaW50ZXJhY3RpdmUtaW5wdXQtcGFydCcsIFtcblx0XHRcdFx0ZG9tLmgoJy5pbnRlcmFjdGl2ZS1pbnB1dC1hbmQtZWRpdC1zZXNzaW9uJywgW1xuXHRcdFx0XHRcdGRvbS5oKCcuY2hhdC1lZGl0aW5nLXNlc3Npb25AY2hhdEVkaXRpbmdTZXNzaW9uV2lkZ2V0Q29udGFpbmVyJyksXG5cdFx0XHRcdFx0ZG9tLmgoJy5pbnRlcmFjdGl2ZS1pbnB1dC1hbmQtc2lkZS10b29sYmFyQGlucHV0QW5kU2lkZVRvb2xiYXInLCBbXG5cdFx0XHRcdFx0XHRkb20uaCgnLmNoYXQtaW5wdXQtY29udGFpbmVyQGlucHV0Q29udGFpbmVyJywgW1xuXHRcdFx0XHRcdFx0XHRkb20uaCgnLmNoYXQtZWRpdG9yLWNvbnRhaW5lckBlZGl0b3JDb250YWluZXInKSxcblx0XHRcdFx0XHRcdFx0ZG9tLmgoJy5jaGF0LWlucHV0LXRvb2xiYXJzQGlucHV0VG9vbGJhcnMnKSxcblx0XHRcdFx0XHRcdF0pLFxuXHRcdFx0XHRcdF0pLFxuXHRcdFx0XHRcdGRvbS5oKCcuY2hhdC1hdHRhY2htZW50cy1jb250YWluZXJAYXR0YWNobWVudHNDb250YWluZXInLCBbXG5cdFx0XHRcdFx0XHRkb20uaCgnLmNoYXQtYXR0YWNobWVudC10b29sYmFyQGF0dGFjaG1lbnRUb29sYmFyJyksXG5cdFx0XHRcdFx0XHRkb20uaCgnLmNoYXQtYXR0YWNoZWQtY29udGV4dEBhdHRhY2hlZENvbnRleHRDb250YWluZXInKSxcblx0XHRcdFx0XHRcdGRvbS5oKCcuY2hhdC1yZWxhdGVkLWZpbGVzQHJlbGF0ZWRGaWxlc0NvbnRhaW5lcicpLFxuXHRcdFx0XHRcdF0pLFxuXHRcdFx0XHRcdGRvbS5oKCcuaW50ZXJhY3RpdmUtaW5wdXQtZm9sbG93dXBzQGZvbGxvd3Vwc0NvbnRhaW5lcicpLFxuXHRcdFx0XHRdKVxuXHRcdFx0XSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGVsZW1lbnRzID0gZG9tLmgoJy5pbnRlcmFjdGl2ZS1pbnB1dC1wYXJ0JywgW1xuXHRcdFx0XHRkb20uaCgnLmludGVyYWN0aXZlLWlucHV0LWZvbGxvd3Vwc0Bmb2xsb3d1cHNDb250YWluZXInKSxcblx0XHRcdFx0ZG9tLmgoJy5jaGF0LWVkaXRpbmctc2Vzc2lvbkBjaGF0RWRpdGluZ1Nlc3Npb25XaWRnZXRDb250YWluZXInKSxcblx0XHRcdFx0ZG9tLmgoJy5pbnRlcmFjdGl2ZS1pbnB1dC1hbmQtc2lkZS10b29sYmFyQGlucHV0QW5kU2lkZVRvb2xiYXInLCBbXG5cdFx0XHRcdFx0ZG9tLmgoJy5jaGF0LWlucHV0LWNvbnRhaW5lckBpbnB1dENvbnRhaW5lcicsIFtcblx0XHRcdFx0XHRcdGRvbS5oKCcuY2hhdC1hdHRhY2htZW50cy1jb250YWluZXJAYXR0YWNobWVudHNDb250YWluZXInLCBbXG5cdFx0XHRcdFx0XHRcdGRvbS5oKCcuY2hhdC1hdHRhY2htZW50LXRvb2xiYXJAYXR0YWNobWVudFRvb2xiYXInKSxcblx0XHRcdFx0XHRcdFx0ZG9tLmgoJy5jaGF0LXJlbGF0ZWQtZmlsZXNAcmVsYXRlZEZpbGVzQ29udGFpbmVyJyksXG5cdFx0XHRcdFx0XHRcdGRvbS5oKCcuY2hhdC1hdHRhY2hlZC1jb250ZXh0QGF0dGFjaGVkQ29udGV4dENvbnRhaW5lcicpLFxuXHRcdFx0XHRcdFx0XSksXG5cdFx0XHRcdFx0XHRkb20uaCgnLmNoYXQtZWRpdG9yLWNvbnRhaW5lckBlZGl0b3JDb250YWluZXInKSxcblx0XHRcdFx0XHRcdGRvbS5oKCcuY2hhdC1pbnB1dC10b29sYmFyc0BpbnB1dFRvb2xiYXJzJyksXG5cdFx0XHRcdFx0XSksXG5cdFx0XHRcdF0pLFxuXHRcdFx0XSk7XG5cdFx0fVxuXHRcdHRoaXMuY29udGFpbmVyID0gZWxlbWVudHMucm9vdDtcblx0XHRjb250YWluZXIuYXBwZW5kKHRoaXMuY29udGFpbmVyKTtcblx0XHR0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdjb21wYWN0JywgdGhpcy5vcHRpb25zLnJlbmRlclN0eWxlID09PSAnY29tcGFjdCcpO1xuXHRcdHRoaXMuZm9sbG93dXBzQ29udGFpbmVyID0gZWxlbWVudHMuZm9sbG93dXBzQ29udGFpbmVyO1xuXHRcdGNvbnN0IGlucHV0QW5kU2lkZVRvb2xiYXIgPSBlbGVtZW50cy5pbnB1dEFuZFNpZGVUb29sYmFyOyAvLyBUaGUgY2hhdCBpbnB1dCBhbmQgdG9vbGJhciB0byB0aGUgcmlnaHRcblx0XHRjb25zdCBpbnB1dENvbnRhaW5lciA9IGVsZW1lbnRzLmlucHV0Q29udGFpbmVyOyAvLyBUaGUgY2hhdCBlZGl0b3IsIGF0dGFjaG1lbnRzLCBhbmQgdG9vbGJhcnNcblx0XHRjb25zdCBlZGl0b3JDb250YWluZXIgPSBlbGVtZW50cy5lZGl0b3JDb250YWluZXI7XG5cdFx0dGhpcy5hdHRhY2htZW50c0NvbnRhaW5lciA9IGVsZW1lbnRzLmF0dGFjaG1lbnRzQ29udGFpbmVyO1xuXHRcdHRoaXMuYXR0YWNoZWRDb250ZXh0Q29udGFpbmVyID0gZWxlbWVudHMuYXR0YWNoZWRDb250ZXh0Q29udGFpbmVyO1xuXHRcdHRoaXMucmVsYXRlZEZpbGVzQ29udGFpbmVyID0gZWxlbWVudHMucmVsYXRlZEZpbGVzQ29udGFpbmVyO1xuXHRcdGNvbnN0IHRvb2xiYXJzQ29udGFpbmVyID0gZWxlbWVudHMuaW5wdXRUb29sYmFycztcblx0XHRjb25zdCBhdHRhY2htZW50VG9vbGJhckNvbnRhaW5lciA9IGVsZW1lbnRzLmF0dGFjaG1lbnRUb29sYmFyO1xuXHRcdHRoaXMuY2hhdEVkaXRpbmdTZXNzaW9uV2lkZ2V0Q29udGFpbmVyID0gZWxlbWVudHMuY2hhdEVkaXRpbmdTZXNzaW9uV2lkZ2V0Q29udGFpbmVyO1xuXHRcdGlmICh0aGlzLm9wdGlvbnMuZW5hYmxlSW1wbGljaXRDb250ZXh0KSB7XG5cdFx0XHR0aGlzLl9pbXBsaWNpdENvbnRleHQgPSB0aGlzLl9yZWdpc3RlcihuZXcgQ2hhdEltcGxpY2l0Q29udGV4dCgpKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2ltcGxpY2l0Q29udGV4dC5vbkRpZENoYW5nZVZhbHVlKCgpID0+IHRoaXMuX2hhbmRsZUF0dGFjaGVkQ29udGV4dENoYW5nZSgpKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5yZW5kZXJBdHRhY2hlZENvbnRleHQoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9hdHRhY2htZW50TW9kZWwub25EaWRDaGFuZ2VDb250ZXh0KCgpID0+IHRoaXMuX2hhbmRsZUF0dGFjaGVkQ29udGV4dENoYW5nZSgpKSk7XG5cdFx0dGhpcy5yZW5kZXJDaGF0RWRpdGluZ1Nlc3Npb25TdGF0ZShudWxsKTtcblxuXHRcdGlmICh0aGlzLm9wdGlvbnMucmVuZGVyV29ya2luZ1NldCkge1xuXHRcdFx0dGhpcy5fcmVsYXRlZEZpbGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IENoYXRSZWxhdGVkRmlsZXMoKSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9yZWxhdGVkRmlsZXMub25EaWRDaGFuZ2UoKCkgPT4gdGhpcy5yZW5kZXJDaGF0UmVsYXRlZEZpbGVzKCkpKTtcblx0XHR9XG5cdFx0dGhpcy5yZW5kZXJDaGF0UmVsYXRlZEZpbGVzKCk7XG5cblx0XHR0aGlzLmRuZC5hZGRPdmVybGF5KGNvbnRhaW5lciwgY29udGFpbmVyKTtcblxuXHRcdGNvbnN0IGlucHV0U2NvcGVkQ29udGV4dEtleVNlcnZpY2UgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZChpbnB1dENvbnRhaW5lcikpO1xuXHRcdENoYXRDb250ZXh0S2V5cy5pbkNoYXRJbnB1dC5iaW5kVG8oaW5wdXRTY29wZWRDb250ZXh0S2V5U2VydmljZSkuc2V0KHRydWUpO1xuXHRcdGNvbnN0IHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVDaGlsZChuZXcgU2VydmljZUNvbGxlY3Rpb24oW0lDb250ZXh0S2V5U2VydmljZSwgaW5wdXRTY29wZWRDb250ZXh0S2V5U2VydmljZV0pKSk7XG5cblx0XHRjb25zdCB7IGhpc3RvcnlOYXZpZ2F0aW9uQmFja3dhcmRzRW5hYmxlbWVudCwgaGlzdG9yeU5hdmlnYXRpb25Gb3J3YXJkc0VuYWJsZW1lbnQgfSA9IHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQW5kQ3JlYXRlSGlzdG9yeU5hdmlnYXRpb25Db250ZXh0KGlucHV0U2NvcGVkQ29udGV4dEtleVNlcnZpY2UsIHRoaXMpKTtcblx0XHR0aGlzLmhpc3RvcnlOYXZpZ2F0aW9uQmFja3dhcmRzRW5hYmxlbWVudCA9IGhpc3RvcnlOYXZpZ2F0aW9uQmFja3dhcmRzRW5hYmxlbWVudDtcblx0XHR0aGlzLmhpc3RvcnlOYXZpZ2F0aW9uRm9yZXdhcmRzRW5hYmxlbWVudCA9IGhpc3RvcnlOYXZpZ2F0aW9uRm9yd2FyZHNFbmFibGVtZW50O1xuXG5cdFx0Y29uc3Qgb3B0aW9uczogSUVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnMgPSBnZXRTaW1wbGVFZGl0b3JPcHRpb25zKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdG9wdGlvbnMub3ZlcmZsb3dXaWRnZXRzRG9tTm9kZSA9IHRoaXMub3B0aW9ucy5lZGl0b3JPdmVyZmxvd1dpZGdldHNEb21Ob2RlO1xuXHRcdG9wdGlvbnMucGFzdGVBcyA9IEVkaXRvck9wdGlvbnMucGFzdGVBcy5kZWZhdWx0VmFsdWU7XG5cdFx0b3B0aW9ucy5yZWFkT25seSA9IGZhbHNlO1xuXHRcdG9wdGlvbnMuYXJpYUxhYmVsID0gdGhpcy5fZ2V0QXJpYUxhYmVsKCk7XG5cdFx0b3B0aW9ucy5mb250RmFtaWx5ID0gREVGQVVMVF9GT05UX0ZBTUlMWTtcblx0XHRvcHRpb25zLmZvbnRTaXplID0gMTM7XG5cdFx0b3B0aW9ucy5saW5lSGVpZ2h0ID0gMjA7XG5cdFx0b3B0aW9ucy5wYWRkaW5nID0gdGhpcy5vcHRpb25zLnJlbmRlclN0eWxlID09PSAnY29tcGFjdCcgPyB7IHRvcDogMiwgYm90dG9tOiAyIH0gOiB7IHRvcDogOCwgYm90dG9tOiA4IH07XG5cdFx0b3B0aW9ucy5jdXJzb3JXaWR0aCA9IDE7XG5cdFx0b3B0aW9ucy53cmFwcGluZ1N0cmF0ZWd5ID0gJ2FkdmFuY2VkJztcblx0XHRvcHRpb25zLmJyYWNrZXRQYWlyQ29sb3JpemF0aW9uID0geyBlbmFibGVkOiBmYWxzZSB9O1xuXHRcdG9wdGlvbnMuc3VnZ2VzdCA9IHtcblx0XHRcdHNob3dJY29uczogdHJ1ZSxcblx0XHRcdHNob3dTbmlwcGV0czogZmFsc2UsXG5cdFx0XHRzaG93V29yZHM6IHRydWUsXG5cdFx0XHRzaG93U3RhdHVzQmFyOiBmYWxzZSxcblx0XHRcdGluc2VydE1vZGU6ICdyZXBsYWNlJyxcblx0XHR9O1xuXHRcdG9wdGlvbnMuc2Nyb2xsYmFyID0geyAuLi4ob3B0aW9ucy5zY3JvbGxiYXIgPz8ge30pLCB2ZXJ0aWNhbDogJ2hpZGRlbicgfTtcblx0XHRvcHRpb25zLnN0aWNreVNjcm9sbCA9IHsgZW5hYmxlZDogZmFsc2UgfTtcblxuXHRcdHRoaXMuX2lucHV0RWRpdG9yRWxlbWVudCA9IGRvbS5hcHBlbmQoZWRpdG9yQ29udGFpbmVyISwgJChjaGF0SW5wdXRFZGl0b3JDb250YWluZXJTZWxlY3RvcikpO1xuXHRcdGNvbnN0IGVkaXRvck9wdGlvbnMgPSBnZXRTaW1wbGVDb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucygpO1xuXHRcdGVkaXRvck9wdGlvbnMuY29udHJpYnV0aW9ucz8ucHVzaCguLi5FZGl0b3JFeHRlbnNpb25zUmVnaXN0cnkuZ2V0U29tZUVkaXRvckNvbnRyaWJ1dGlvbnMoW0NvbnRlbnRIb3ZlckNvbnRyb2xsZXIuSUQsIEdseXBoSG92ZXJDb250cm9sbGVyLklELCBDb3B5UGFzdGVDb250cm9sbGVyLklELCBMaW5rRGV0ZWN0b3IuSURdKSk7XG5cdFx0dGhpcy5faW5wdXRFZGl0b3IgPSB0aGlzLl9yZWdpc3RlcihzY29wZWRJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb2RlRWRpdG9yV2lkZ2V0LCB0aGlzLl9pbnB1dEVkaXRvckVsZW1lbnQsIG9wdGlvbnMsIGVkaXRvck9wdGlvbnMpKTtcblxuXHRcdFN1Z2dlc3RDb250cm9sbGVyLmdldCh0aGlzLl9pbnB1dEVkaXRvcik/LmZvcmNlUmVuZGVyaW5nQWJvdmUoKTtcblx0XHRvcHRpb25zLm92ZXJmbG93V2lkZ2V0c0RvbU5vZGU/LmNsYXNzTGlzdC5hZGQoJ2hpZGVTdWdnZXN0VGV4dEljb25zJyk7XG5cdFx0dGhpcy5faW5wdXRFZGl0b3JFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2hpZGVTdWdnZXN0VGV4dEljb25zJyk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnB1dEVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoKSA9PiB7XG5cdFx0XHRjb25zdCBjdXJyZW50SGVpZ2h0ID0gTWF0aC5taW4odGhpcy5faW5wdXRFZGl0b3IuZ2V0Q29udGVudEhlaWdodCgpLCB0aGlzLmlucHV0RWRpdG9yTWF4SGVpZ2h0KTtcblx0XHRcdGlmIChjdXJyZW50SGVpZ2h0ICE9PSB0aGlzLmlucHV0RWRpdG9ySGVpZ2h0KSB7XG5cdFx0XHRcdHRoaXMuaW5wdXRFZGl0b3JIZWlnaHQgPSBjdXJyZW50SGVpZ2h0O1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5faW5wdXRFZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdGNvbnN0IGlucHV0SGFzVGV4dCA9ICEhbW9kZWwgJiYgbW9kZWwuZ2V0VmFsdWUoKS50cmltKCkubGVuZ3RoID4gMDtcblx0XHRcdHRoaXMuaW5wdXRFZGl0b3JIYXNUZXh0LnNldChpbnB1dEhhc1RleHQpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnB1dEVkaXRvci5vbkRpZENvbnRlbnRTaXplQ2hhbmdlKGUgPT4ge1xuXHRcdFx0aWYgKGUuY29udGVudEhlaWdodENoYW5nZWQpIHtcblx0XHRcdFx0dGhpcy5pbnB1dEVkaXRvckhlaWdodCA9IGUuY29udGVudEhlaWdodDtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnB1dEVkaXRvci5vbkRpZEZvY3VzRWRpdG9yVGV4dCgoKSA9PiB7XG5cdFx0XHR0aGlzLmlucHV0RWRpdG9ySGFzRm9jdXMuc2V0KHRydWUpO1xuXHRcdFx0dGhpcy5fb25EaWRGb2N1cy5maXJlKCk7XG5cdFx0XHRpbnB1dENvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdmb2N1c2VkJywgdHJ1ZSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2lucHV0RWRpdG9yLm9uRGlkQmx1ckVkaXRvclRleHQoKCkgPT4ge1xuXHRcdFx0dGhpcy5pbnB1dEVkaXRvckhhc0ZvY3VzLnNldChmYWxzZSk7XG5cdFx0XHRpbnB1dENvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdmb2N1c2VkJywgZmFsc2UpO1xuXG5cdFx0XHR0aGlzLl9vbkRpZEJsdXIuZmlyZSgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnB1dEVkaXRvci5vbkRpZEJsdXJFZGl0b3JXaWRnZXQoKCkgPT4ge1xuXHRcdFx0Q29weVBhc3RlQ29udHJvbGxlci5nZXQodGhpcy5faW5wdXRFZGl0b3IpPy5jbGVhcldpZGdldHMoKTtcblx0XHRcdERyb3BJbnRvRWRpdG9yQ29udHJvbGxlci5nZXQodGhpcy5faW5wdXRFZGl0b3IpPy5jbGVhcldpZGdldHMoKTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCBob3ZlckRlbGVnYXRlID0gdGhpcy5fcmVnaXN0ZXIoY3JlYXRlSW5zdGFudEhvdmVyRGVsZWdhdGUoKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIodG9vbGJhcnNDb250YWluZXIsIGRvbS5FdmVudFR5cGUuQ0xJQ0ssIGUgPT4gdGhpcy5pbnB1dEVkaXRvci5mb2N1cygpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuYXR0YWNobWVudHNDb250YWluZXIsIGRvbS5FdmVudFR5cGUuQ0xJQ0ssIGUgPT4gdGhpcy5pbnB1dEVkaXRvci5mb2N1cygpKSk7XG5cdFx0dGhpcy5pbnB1dEFjdGlvbnNUb29sYmFyID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51V29ya2JlbmNoVG9vbEJhciwgdG9vbGJhcnNDb250YWluZXIsIE1lbnVJZC5DaGF0SW5wdXQsIHtcblx0XHRcdHRlbGVtZXRyeVNvdXJjZTogdGhpcy5vcHRpb25zLm1lbnVzLnRlbGVtZXRyeVNvdXJjZSxcblx0XHRcdG1lbnVPcHRpb25zOiB7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlIH0sXG5cdFx0XHRoaWRkZW5JdGVtU3RyYXRlZ3k6IEhpZGRlbkl0ZW1TdHJhdGVneS5JZ25vcmUsXG5cdFx0XHRob3ZlckRlbGVnYXRlXG5cdFx0fSkpO1xuXHRcdHRoaXMuaW5wdXRBY3Rpb25zVG9vbGJhci5jb250ZXh0ID0geyB3aWRnZXQgfSBzYXRpc2ZpZXMgSUNoYXRFeGVjdXRlQWN0aW9uQ29udGV4dDtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmlucHV0QWN0aW9uc1Rvb2xiYXIub25EaWRDaGFuZ2VNZW51SXRlbXMoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuY2FjaGVkRGltZW5zaW9ucyAmJiB0eXBlb2YgdGhpcy5jYWNoZWRJbnB1dFRvb2xiYXJXaWR0aCA9PT0gJ251bWJlcicgJiYgdGhpcy5jYWNoZWRJbnB1dFRvb2xiYXJXaWR0aCAhPT0gdGhpcy5pbnB1dEFjdGlvbnNUb29sYmFyLmdldEl0ZW1zV2lkdGgoKSkge1xuXHRcdFx0XHR0aGlzLmxheW91dCh0aGlzLmNhY2hlZERpbWVuc2lvbnMuaGVpZ2h0LCB0aGlzLmNhY2hlZERpbWVuc2lvbnMud2lkdGgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLmV4ZWN1dGVUb29sYmFyID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51V29ya2JlbmNoVG9vbEJhciwgdG9vbGJhcnNDb250YWluZXIsIHRoaXMub3B0aW9ucy5tZW51cy5leGVjdXRlVG9vbGJhciwge1xuXHRcdFx0dGVsZW1ldHJ5U291cmNlOiB0aGlzLm9wdGlvbnMubWVudXMudGVsZW1ldHJ5U291cmNlLFxuXHRcdFx0bWVudU9wdGlvbnM6IHtcblx0XHRcdFx0c2hvdWxkRm9yd2FyZEFyZ3M6IHRydWVcblx0XHRcdH0sXG5cdFx0XHRob3ZlckRlbGVnYXRlLFxuXHRcdFx0aGlkZGVuSXRlbVN0cmF0ZWd5OiBIaWRkZW5JdGVtU3RyYXRlZ3kuSWdub3JlLCAvLyBrZWVwIGl0IGxlYW4gd2hlbiBoaWRpbmcgaXRlbXMgYW5kIGF2b2lkIGEgXCIuLi5cIiBvdmVyZmxvdyBtZW51XG5cdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiAoYWN0aW9uLCBvcHRpb25zKSA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLmxvY2F0aW9uID09PSBDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCB8fCB0aGlzLmxvY2F0aW9uID09PSBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0b3IpIHtcblx0XHRcdFx0XHRpZiAoKGFjdGlvbi5pZCA9PT0gQ2hhdFN1Ym1pdEFjdGlvbi5JRCB8fCBhY3Rpb24uaWQgPT09IENhbmNlbEFjdGlvbi5JRCB8fCBhY3Rpb24uaWQgPT09IENoYXRFZGl0aW5nU2Vzc2lvblN1Ym1pdEFjdGlvbi5JRCkgJiYgYWN0aW9uIGluc3RhbmNlb2YgTWVudUl0ZW1BY3Rpb24pIHtcblx0XHRcdFx0XHRcdGNvbnN0IGRyb3Bkb3duQWN0aW9uID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51SXRlbUFjdGlvbiwgeyBpZDogJ2NoYXQubW9yZUV4ZWN1dGVBY3Rpb25zJywgdGl0bGU6IGxvY2FsaXplKCdub3RlYm9vay5tb3JlRXhlY3V0ZUFjdGlvbnNMYWJlbCcsIFwiTW9yZS4uLlwiKSwgaWNvbjogQ29kaWNvbi5jaGV2cm9uRG93biB9LCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdFN1Ym1pdERyb3Bkb3duQWN0aW9uSXRlbSwgYWN0aW9uLCBkcm9wZG93bkFjdGlvbiwgeyAuLi5vcHRpb25zLCBtZW51QXNDaGlsZDogZmFsc2UgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGFjdGlvbi5pZCA9PT0gQ2hhdFN3aXRjaFRvTmV4dE1vZGVsQWN0aW9uSWQgJiYgYWN0aW9uIGluc3RhbmNlb2YgTWVudUl0ZW1BY3Rpb24pIHtcblx0XHRcdFx0XHRpZiAoIXRoaXMuX2N1cnJlbnRMYW5ndWFnZU1vZGVsKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnNldEN1cnJlbnRMYW5ndWFnZU1vZGVsVG9EZWZhdWx0KCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHRoaXMuX2N1cnJlbnRMYW5ndWFnZU1vZGVsKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBpdGVtRGVsZWdhdGU6IE1vZGVsUGlja2VyRGVsZWdhdGUgPSB7XG5cdFx0XHRcdFx0XHRcdG9uRGlkQ2hhbmdlTW9kZWw6IHRoaXMuX29uRGlkQ2hhbmdlQ3VycmVudExhbmd1YWdlTW9kZWwuZXZlbnQsXG5cdFx0XHRcdFx0XHRcdHNldE1vZGVsOiAobW9kZWw6IElMYW5ndWFnZU1vZGVsQ2hhdE1ldGFkYXRhQW5kSWRlbnRpZmllcikgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdC8vIFRoZSB1c2VyIGNoYW5nZWQgdGhlIGxhbmd1YWdlIG1vZGVsLCBzbyB3ZSBkb24ndCB3YWl0IGZvciB0aGUgcGVyc2lzdGVkIG9wdGlvbiB0byBiZSByZWdpc3RlcmVkXG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5fd2FpdEZvclBlcnNpc3RlZExhbmd1YWdlTW9kZWwuY2xlYXIoKTtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnNldEN1cnJlbnRMYW5ndWFnZU1vZGVsKG1vZGVsKTtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnJlbmRlckF0dGFjaGVkQ29udGV4dCgpO1xuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRnZXRNb2RlbHM6ICgpID0+IHRoaXMuZ2V0TW9kZWxzKClcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNb2RlbFBpY2tlckFjdGlvblZpZXdJdGVtLCBhY3Rpb24sIHRoaXMuX2N1cnJlbnRMYW5ndWFnZU1vZGVsLCBpdGVtRGVsZWdhdGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChhY3Rpb24uaWQgPT09IFRvZ2dsZUFnZW50TW9kZUFjdGlvbklkICYmIGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGVsZWdhdGU6IElNb2RlUGlja2VyRGVsZWdhdGUgPSB7XG5cdFx0XHRcdFx0XHRnZXRNb2RlOiAoKSA9PiB0aGlzLmN1cnJlbnRNb2RlLFxuXHRcdFx0XHRcdFx0b25EaWRDaGFuZ2VNb2RlOiB0aGlzLl9vbkRpZENoYW5nZUN1cnJlbnRDaGF0TW9kZS5ldmVudFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVG9nZ2xlQ2hhdE1vZGVBY3Rpb25WaWV3SXRlbSwgYWN0aW9uLCBkZWxlZ2F0ZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLmV4ZWN1dGVUb29sYmFyLmdldEVsZW1lbnQoKS5jbGFzc0xpc3QuYWRkKCdjaGF0LWV4ZWN1dGUtdG9vbGJhcicpO1xuXHRcdHRoaXMuZXhlY3V0ZVRvb2xiYXIuY29udGV4dCA9IHsgd2lkZ2V0IH0gc2F0aXNmaWVzIElDaGF0RXhlY3V0ZUFjdGlvbkNvbnRleHQ7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5leGVjdXRlVG9vbGJhci5vbkRpZENoYW5nZU1lbnVJdGVtcygoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5jYWNoZWREaW1lbnNpb25zICYmIHR5cGVvZiB0aGlzLmNhY2hlZEV4ZWN1dGVUb29sYmFyV2lkdGggPT09ICdudW1iZXInICYmIHRoaXMuY2FjaGVkRXhlY3V0ZVRvb2xiYXJXaWR0aCAhPT0gdGhpcy5leGVjdXRlVG9vbGJhci5nZXRJdGVtc1dpZHRoKCkpIHtcblx0XHRcdFx0dGhpcy5sYXlvdXQodGhpcy5jYWNoZWREaW1lbnNpb25zLmhlaWdodCwgdGhpcy5jYWNoZWREaW1lbnNpb25zLndpZHRoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0aWYgKHRoaXMub3B0aW9ucy5tZW51cy5pbnB1dFNpZGVUb29sYmFyKSB7XG5cdFx0XHRjb25zdCB0b29sYmFyU2lkZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWVudVdvcmtiZW5jaFRvb2xCYXIsIGlucHV0QW5kU2lkZVRvb2xiYXIsIHRoaXMub3B0aW9ucy5tZW51cy5pbnB1dFNpZGVUb29sYmFyLCB7XG5cdFx0XHRcdHRlbGVtZXRyeVNvdXJjZTogdGhpcy5vcHRpb25zLm1lbnVzLnRlbGVtZXRyeVNvdXJjZSxcblx0XHRcdFx0bWVudU9wdGlvbnM6IHtcblx0XHRcdFx0XHRzaG91bGRGb3J3YXJkQXJnczogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRob3ZlckRlbGVnYXRlXG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLmlucHV0U2lkZVRvb2xiYXJDb250YWluZXIgPSB0b29sYmFyU2lkZS5nZXRFbGVtZW50KCk7XG5cdFx0XHR0b29sYmFyU2lkZS5nZXRFbGVtZW50KCkuY2xhc3NMaXN0LmFkZCgnY2hhdC1zaWRlLXRvb2xiYXInKTtcblx0XHRcdHRvb2xiYXJTaWRlLmNvbnRleHQgPSB7IHdpZGdldCB9IHNhdGlzZmllcyBJQ2hhdEV4ZWN1dGVBY3Rpb25Db250ZXh0O1xuXHRcdH1cblxuXHRcdGxldCBpbnB1dE1vZGVsID0gdGhpcy5tb2RlbFNlcnZpY2UuZ2V0TW9kZWwodGhpcy5pbnB1dFVyaSk7XG5cdFx0aWYgKCFpbnB1dE1vZGVsKSB7XG5cdFx0XHRpbnB1dE1vZGVsID0gdGhpcy5tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoJycsIG51bGwsIHRoaXMuaW5wdXRVcmksIHRydWUpO1xuXHRcdH1cblxuXHRcdHRoaXMudGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKHRoaXMuaW5wdXRVcmkpLnRoZW4ocmVmID0+IHtcblx0XHRcdC8vIG1ha2Ugc3VyZSB0byBob2xkIGEgcmVmZXJlbmNlIHNvIHRoYXQgdGhlIG1vZGVsIGRvZXNuJ3QgZ2V0IGRpc3Bvc2VkIGJ5IHRoZSB0ZXh0IG1vZGVsIHNlcnZpY2Vcblx0XHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdHJlZi5kaXNwb3NlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHJlZik7XG5cdFx0fSk7XG5cblx0XHR0aGlzLmlucHV0TW9kZWwgPSBpbnB1dE1vZGVsO1xuXHRcdHRoaXMuaW5wdXRNb2RlbC51cGRhdGVPcHRpb25zKHsgYnJhY2tldENvbG9yaXphdGlvbk9wdGlvbnM6IHsgZW5hYmxlZDogZmFsc2UsIGluZGVwZW5kZW50Q29sb3JQb29sUGVyQnJhY2tldFR5cGU6IGZhbHNlIH0gfSk7XG5cdFx0dGhpcy5faW5wdXRFZGl0b3Iuc2V0TW9kZWwodGhpcy5pbnB1dE1vZGVsKTtcblx0XHRpZiAoaW5pdGlhbFZhbHVlKSB7XG5cdFx0XHR0aGlzLmlucHV0TW9kZWwuc2V0VmFsdWUoaW5pdGlhbFZhbHVlKTtcblx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSB0aGlzLmlucHV0TW9kZWwuZ2V0TGluZUNvdW50KCk7XG5cdFx0XHR0aGlzLl9pbnB1dEVkaXRvci5zZXRQb3NpdGlvbih7IGxpbmVOdW1iZXIsIGNvbHVtbjogdGhpcy5pbnB1dE1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlcikgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbiA9ICgpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5faW5wdXRFZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdGlmICghbW9kZWwpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMuX2lucHV0RWRpdG9yLmdldFBvc2l0aW9uKCk7XG5cdFx0XHRpZiAoIXBvc2l0aW9uKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgYXRUb3AgPSBwb3NpdGlvbi5saW5lTnVtYmVyID09PSAxICYmIHBvc2l0aW9uLmNvbHVtbiAtIDEgPD0gKHRoaXMuX2lucHV0RWRpdG9yLl9nZXRWaWV3TW9kZWwoKT8uZ2V0TGluZUxlbmd0aCgxKSA/PyAwKTtcblx0XHRcdHRoaXMuY2hhdEN1cnNvckF0VG9wLnNldChhdFRvcCk7XG5cblx0XHRcdHRoaXMuaGlzdG9yeU5hdmlnYXRpb25CYWNrd2FyZHNFbmFibGVtZW50LnNldChhdFRvcCk7XG5cdFx0XHR0aGlzLmhpc3RvcnlOYXZpZ2F0aW9uRm9yZXdhcmRzRW5hYmxlbWVudC5zZXQocG9zaXRpb24uZXF1YWxzKGdldExhc3RQb3NpdGlvbihtb2RlbCkpKTtcblx0XHR9O1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2lucHV0RWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb24oZSA9PiBvbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uKCkpKTtcblx0XHRvbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRoZW1lU2VydmljZS5vbkRpZEZpbGVJY29uVGhlbWVDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy5yZW5kZXJBdHRhY2hlZENvbnRleHQoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLmFkZEZpbGVzVG9vbGJhciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWVudVdvcmtiZW5jaFRvb2xCYXIsIGF0dGFjaG1lbnRUb29sYmFyQ29udGFpbmVyLCBNZW51SWQuQ2hhdElucHV0QXR0YWNobWVudFRvb2xiYXIsIHtcblx0XHRcdHRlbGVtZXRyeVNvdXJjZTogdGhpcy5vcHRpb25zLm1lbnVzLnRlbGVtZXRyeVNvdXJjZSxcblx0XHRcdGxhYmVsOiB0cnVlLFxuXHRcdFx0bWVudU9wdGlvbnM6IHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUsIHJlbmRlclNob3J0VGl0bGU6IHRydWUgfSxcblx0XHRcdGhpZGRlbkl0ZW1TdHJhdGVneTogSGlkZGVuSXRlbVN0cmF0ZWd5Lklnbm9yZSxcblx0XHRcdGhvdmVyRGVsZWdhdGUsXG5cdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiAoYWN0aW9uLCBvcHRpb25zKSA9PiB7XG5cdFx0XHRcdGlmIChhY3Rpb24uaWQgPT09ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuZWRpdGluZy5hdHRhY2hDb250ZXh0JyB8fCBhY3Rpb24uaWQgPT09ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuYXR0YWNoQ29udGV4dCcpIHtcblx0XHRcdFx0XHRjb25zdCB2aWV3SXRlbSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQWRkRmlsZXNCdXR0b24sIHVuZGVmaW5lZCwgYWN0aW9uLCBvcHRpb25zKTtcblx0XHRcdFx0XHRyZXR1cm4gdmlld0l0ZW07XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGFjdGlvbi5pZCA9PT0gQXR0YWNoVG9vbHNBY3Rpb24uaWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zZWxlY3RlZFRvb2xzTW9kZWwudG9vbHNBY3Rpb25JdGVtVmlld0l0ZW1Qcm92aWRlcihhY3Rpb24sIG9wdGlvbnMpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuYWRkRmlsZXNUb29sYmFyLmNvbnRleHQgPSB7IHdpZGdldCwgcGxhY2Vob2xkZXI6IGxvY2FsaXplKCdjaGF0QXR0YWNoRmlsZXMnLCAnU2VhcmNoIGZvciBmaWxlcyBhbmQgY29udGV4dCB0byBhZGQgdG8geW91ciByZXF1ZXN0JykgfTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmFkZEZpbGVzVG9vbGJhci5vbkRpZENoYW5nZU1lbnVJdGVtcygoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5jYWNoZWREaW1lbnNpb25zKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlSGVpZ2h0LmZpcmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNlbGVjdGVkVG9vbHNNb2RlbC50b29sc0FjdGlvbkl0ZW1WaWV3SXRlbVByb3ZpZGVyLm9uRGlkUmVuZGVyKCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlSGVpZ2h0LmZpcmUoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJBdHRhY2hlZENvbnRleHQoKSB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gdGhpcy5hdHRhY2hlZENvbnRleHRDb250YWluZXI7XG5cdFx0Ly8gTm90ZS0gY2FuJ3QgbWVhc3VyZSBhdHRhY2hlZENvbnRleHRDb250YWluZXIsIGJlY2F1c2UgaXQgaGFzIGBkaXNwbGF5OiBjb250ZW50c2AsIHNvIG1lYXN1cmUgdGhlIHBhcmVudCB0byBjaGVjayBmb3IgaGVpZ2h0IGNoYW5nZXNcblx0XHRjb25zdCBvbGRIZWlnaHQgPSB0aGlzLmF0dGFjaG1lbnRzQ29udGFpbmVyLm9mZnNldEhlaWdodDtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHR0aGlzLmF0dGFjaGVkQ29udGV4dERpc3Bvc2FibGVzLnZhbHVlID0gc3RvcmU7XG5cblx0XHRkb20uY2xlYXJOb2RlKGNvbnRhaW5lcik7XG5cdFx0Y29uc3QgaG92ZXJEZWxlZ2F0ZSA9IHN0b3JlLmFkZChjcmVhdGVJbnN0YW50SG92ZXJEZWxlZ2F0ZSgpKTtcblxuXHRcdGNvbnN0IGF0dGFjaG1lbnRzID0gWy4uLnRoaXMuYXR0YWNobWVudE1vZGVsLmF0dGFjaG1lbnRzLmVudHJpZXMoKV07XG5cdFx0Y29uc3QgaGFzQXR0YWNobWVudHMgPSBCb29sZWFuKGF0dGFjaG1lbnRzLmxlbmd0aCkgfHwgQm9vbGVhbih0aGlzLmltcGxpY2l0Q29udGV4dD8udmFsdWUpIHx8ICF0aGlzLmluc3RydWN0aW9uQXR0YWNobWVudHNQYXJ0LmVtcHR5O1xuXHRcdGRvbS5zZXRWaXNpYmlsaXR5KEJvb2xlYW4oaGFzQXR0YWNobWVudHMgfHwgKHRoaXMuYWRkRmlsZXNUb29sYmFyICYmICF0aGlzLmFkZEZpbGVzVG9vbGJhci5pc0VtcHR5KCkpKSwgdGhpcy5hdHRhY2htZW50c0NvbnRhaW5lcik7XG5cdFx0ZG9tLnNldFZpc2liaWxpdHkoaGFzQXR0YWNobWVudHMsIHRoaXMuYXR0YWNoZWRDb250ZXh0Q29udGFpbmVyKTtcblx0XHRpZiAoIWF0dGFjaG1lbnRzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5faW5kZXhPZkxhc3RBdHRhY2hlZENvbnRleHREZWxldGVkV2l0aEtleWJvYXJkID0gLTE7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaW1wbGljaXRDb250ZXh0Py52YWx1ZSkge1xuXHRcdFx0Y29uc3QgaW1wbGljaXRQYXJ0ID0gc3RvcmUuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW1wbGljaXRDb250ZXh0QXR0YWNobWVudFdpZGdldCwgdGhpcy5pbXBsaWNpdENvbnRleHQsIHRoaXMuX2NvbnRleHRSZXNvdXJjZUxhYmVscykpO1xuXHRcdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGltcGxpY2l0UGFydC5kb21Ob2RlKTtcblx0XHR9XG5cblx0XHR0aGlzLnByb21wdEluc3RydWN0aW9uc0F0dGFjaGVkLnNldCghdGhpcy5pbnN0cnVjdGlvbkF0dGFjaG1lbnRzUGFydC5lbXB0eSk7XG5cdFx0dGhpcy5pbnN0cnVjdGlvbkF0dGFjaG1lbnRzUGFydC5yZW5kZXIoY29udGFpbmVyKTtcblxuXHRcdGZvciAoY29uc3QgW2luZGV4LCBhdHRhY2htZW50XSBvZiBhdHRhY2htZW50cykge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuaXNVcmkoYXR0YWNobWVudC52YWx1ZSkgPyBhdHRhY2htZW50LnZhbHVlIDogYXR0YWNobWVudC52YWx1ZSAmJiB0eXBlb2YgYXR0YWNobWVudC52YWx1ZSA9PT0gJ29iamVjdCcgJiYgJ3VyaScgaW4gYXR0YWNobWVudC52YWx1ZSAmJiBVUkkuaXNVcmkoYXR0YWNobWVudC52YWx1ZS51cmkpID8gYXR0YWNobWVudC52YWx1ZS51cmkgOiB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCByYW5nZSA9IGF0dGFjaG1lbnQudmFsdWUgJiYgdHlwZW9mIGF0dGFjaG1lbnQudmFsdWUgPT09ICdvYmplY3QnICYmICdyYW5nZScgaW4gYXR0YWNobWVudC52YWx1ZSAmJiBSYW5nZS5pc0lSYW5nZShhdHRhY2htZW50LnZhbHVlLnJhbmdlKSA/IGF0dGFjaG1lbnQudmFsdWUucmFuZ2UgOiB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBzaG91bGRGb2N1c0NsZWFyQnV0dG9uID0gaW5kZXggPT09IE1hdGgubWluKHRoaXMuX2luZGV4T2ZMYXN0QXR0YWNoZWRDb250ZXh0RGVsZXRlZFdpdGhLZXlib2FyZCwgdGhpcy5hdHRhY2htZW50TW9kZWwuc2l6ZSAtIDEpO1xuXG5cdFx0XHRsZXQgYXR0YWNobWVudFdpZGdldDtcblx0XHRcdGlmIChyZXNvdXJjZSAmJiAoYXR0YWNobWVudC5pc0ZpbGUgfHwgYXR0YWNobWVudC5pc0RpcmVjdG9yeSkpIHtcblx0XHRcdFx0YXR0YWNobWVudFdpZGdldCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRmlsZUF0dGFjaG1lbnRXaWRnZXQsIHJlc291cmNlLCByYW5nZSwgYXR0YWNobWVudCwgdGhpcy5fY3VycmVudExhbmd1YWdlTW9kZWwsIHNob3VsZEZvY3VzQ2xlYXJCdXR0b24sIGNvbnRhaW5lciwgdGhpcy5fY29udGV4dFJlc291cmNlTGFiZWxzLCBob3ZlckRlbGVnYXRlKTtcblx0XHRcdH0gZWxzZSBpZiAoYXR0YWNobWVudC5pc0ltYWdlKSB7XG5cdFx0XHRcdGF0dGFjaG1lbnRXaWRnZXQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEltYWdlQXR0YWNobWVudFdpZGdldCwgcmVzb3VyY2UsIGF0dGFjaG1lbnQsIHRoaXMuX2N1cnJlbnRMYW5ndWFnZU1vZGVsLCBzaG91bGRGb2N1c0NsZWFyQnV0dG9uLCBjb250YWluZXIsIHRoaXMuX2NvbnRleHRSZXNvdXJjZUxhYmVscywgaG92ZXJEZWxlZ2F0ZSk7XG5cdFx0XHR9IGVsc2UgaWYgKGlzUGFzdGVWYXJpYWJsZUVudHJ5KGF0dGFjaG1lbnQpKSB7XG5cdFx0XHRcdGF0dGFjaG1lbnRXaWRnZXQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFBhc3RlQXR0YWNobWVudFdpZGdldCwgYXR0YWNobWVudCwgdGhpcy5fY3VycmVudExhbmd1YWdlTW9kZWwsIHNob3VsZEZvY3VzQ2xlYXJCdXR0b24sIGNvbnRhaW5lciwgdGhpcy5fY29udGV4dFJlc291cmNlTGFiZWxzLCBob3ZlckRlbGVnYXRlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF0dGFjaG1lbnRXaWRnZXQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERlZmF1bHRDaGF0QXR0YWNobWVudFdpZGdldCwgcmVzb3VyY2UsIHJhbmdlLCBhdHRhY2htZW50LCB0aGlzLl9jdXJyZW50TGFuZ3VhZ2VNb2RlbCwgc2hvdWxkRm9jdXNDbGVhckJ1dHRvbiwgY29udGFpbmVyLCB0aGlzLl9jb250ZXh0UmVzb3VyY2VMYWJlbHMsIGhvdmVyRGVsZWdhdGUpO1xuXHRcdFx0fVxuXHRcdFx0c3RvcmUuYWRkKGF0dGFjaG1lbnRXaWRnZXQpO1xuXHRcdFx0c3RvcmUuYWRkKGF0dGFjaG1lbnRXaWRnZXQub25EaWREZWxldGUoKGUpID0+IHtcblx0XHRcdFx0dGhpcy5oYW5kbGVBdHRhY2htZW50RGVsZXRpb24oZSwgaW5kZXgsIGF0dGFjaG1lbnQpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdGlmIChvbGRIZWlnaHQgIT09IHRoaXMuYXR0YWNobWVudHNDb250YWluZXIub2Zmc2V0SGVpZ2h0KSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVBdHRhY2htZW50RGVsZXRpb24oZTogZ2xvYmFsVGhpcy5FdmVudCwgaW5kZXg6IG51bWJlciwgYXR0YWNobWVudDogSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSkge1xuXHRcdHRoaXMuX2F0dGFjaG1lbnRNb2RlbC5kZWxldGUoYXR0YWNobWVudC5pZCk7XG5cblx0XHQvLyBTZXQgZm9jdXMgdG8gdGhlIG5leHQgYXR0YWNoZWQgY29udGV4dCBpdGVtIGlmIGRlbGV0aW9uIHdhcyB0cmlnZ2VyZWQgYnkgYSBrZXlzdHJva2UgKHZzIGEgbW91c2UgY2xpY2spXG5cdFx0aWYgKGRvbS5pc0tleWJvYXJkRXZlbnQoZSkpIHtcblx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5FbnRlcikgfHwgZXZlbnQuZXF1YWxzKEtleUNvZGUuU3BhY2UpKSB7XG5cdFx0XHRcdHRoaXMuX2luZGV4T2ZMYXN0QXR0YWNoZWRDb250ZXh0RGVsZXRlZFdpdGhLZXlib2FyZCA9IGluZGV4O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9hdHRhY2htZW50TW9kZWwuc2l6ZSA9PT0gMCkge1xuXHRcdFx0dGhpcy5mb2N1cygpO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGV4dC5maXJlKHsgcmVtb3ZlZDogW2F0dGFjaG1lbnRdIH0pO1xuXHR9XG5cblx0YXN5bmMgcmVuZGVyQ2hhdEVkaXRpbmdTZXNzaW9uU3RhdGUoY2hhdEVkaXRpbmdTZXNzaW9uOiBJQ2hhdEVkaXRpbmdTZXNzaW9uIHwgbnVsbCkge1xuXHRcdGRvbS5zZXRWaXNpYmlsaXR5KEJvb2xlYW4oY2hhdEVkaXRpbmdTZXNzaW9uKSwgdGhpcy5jaGF0RWRpdGluZ1Nlc3Npb25XaWRnZXRDb250YWluZXIpO1xuXG5cdFx0Y29uc3Qgc2VlbkVudHJpZXMgPSBuZXcgUmVzb3VyY2VTZXQoKTtcblx0XHRjb25zdCBlbnRyaWVzOiBJQ2hhdENvbGxhcHNpYmxlTGlzdEl0ZW1bXSA9IGNoYXRFZGl0aW5nU2Vzc2lvbj8uZW50cmllcy5nZXQoKS5tYXAoKGVudHJ5KSA9PiB7XG5cdFx0XHRzZWVuRW50cmllcy5hZGQoZW50cnkubW9kaWZpZWRVUkkpO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cmVmZXJlbmNlOiBlbnRyeS5tb2RpZmllZFVSSSxcblx0XHRcdFx0c3RhdGU6IGVudHJ5LnN0YXRlLmdldCgpLFxuXHRcdFx0XHRraW5kOiAncmVmZXJlbmNlJyxcblx0XHRcdH07XG5cdFx0fSkgPz8gW107XG5cblx0XHRpZiAoIWNoYXRFZGl0aW5nU2Vzc2lvbiB8fCAhdGhpcy5vcHRpb25zLnJlbmRlcldvcmtpbmdTZXQgfHwgIWVudHJpZXMubGVuZ3RoKSB7XG5cdFx0XHRkb20uY2xlYXJOb2RlKHRoaXMuY2hhdEVkaXRpbmdTZXNzaW9uV2lkZ2V0Q29udGFpbmVyKTtcblx0XHRcdHRoaXMuX2NoYXRFZGl0c0Rpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHR0aGlzLl9jaGF0RWRpdExpc3QgPSB1bmRlZmluZWQ7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gU3VtbWFyeSBvZiBudW1iZXIgb2YgZmlsZXMgY2hhbmdlZFxuXHRcdGNvbnN0IGlubmVyQ29udGFpbmVyID0gdGhpcy5jaGF0RWRpdGluZ1Nlc3Npb25XaWRnZXRDb250YWluZXIucXVlcnlTZWxlY3RvcignLmNoYXQtZWRpdGluZy1zZXNzaW9uLWNvbnRhaW5lci5zaG93LWZpbGUtaWNvbnMnKSBhcyBIVE1MRWxlbWVudCA/PyBkb20uYXBwZW5kKHRoaXMuY2hhdEVkaXRpbmdTZXNzaW9uV2lkZ2V0Q29udGFpbmVyLCAkKCcuY2hhdC1lZGl0aW5nLXNlc3Npb24tY29udGFpbmVyLnNob3ctZmlsZS1pY29ucycpKTtcblx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIGNoYXRFZGl0aW5nU2Vzc2lvbi5lbnRyaWVzLmdldCgpKSB7XG5cdFx0XHRpZiAoIXNlZW5FbnRyaWVzLmhhcyhlbnRyeS5tb2RpZmllZFVSSSkpIHtcblx0XHRcdFx0ZW50cmllcy51bnNoaWZ0KHtcblx0XHRcdFx0XHRyZWZlcmVuY2U6IGVudHJ5Lm1vZGlmaWVkVVJJLFxuXHRcdFx0XHRcdHN0YXRlOiBlbnRyeS5zdGF0ZS5nZXQoKSxcblx0XHRcdFx0XHRraW5kOiAncmVmZXJlbmNlJyxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHNlZW5FbnRyaWVzLmFkZChlbnRyeS5tb2RpZmllZFVSSSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZW50cmllcy5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRpZiAoYS5raW5kID09PSAncmVmZXJlbmNlJyAmJiBiLmtpbmQgPT09ICdyZWZlcmVuY2UnKSB7XG5cdFx0XHRcdGlmIChhLnN0YXRlID09PSBiLnN0YXRlIHx8IGEuc3RhdGUgPT09IHVuZGVmaW5lZCB8fCBiLnN0YXRlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gYS5yZWZlcmVuY2UudG9TdHJpbmcoKS5sb2NhbGVDb21wYXJlKGIucmVmZXJlbmNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBhLnN0YXRlIC0gYi5zdGF0ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiAwO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgb3ZlcnZpZXdSZWdpb24gPSBpbm5lckNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCcuY2hhdC1lZGl0aW5nLXNlc3Npb24tb3ZlcnZpZXcnKSBhcyBIVE1MRWxlbWVudCA/PyBkb20uYXBwZW5kKGlubmVyQ29udGFpbmVyLCAkKCcuY2hhdC1lZGl0aW5nLXNlc3Npb24tb3ZlcnZpZXcnKSk7XG5cdFx0Y29uc3Qgb3ZlcnZpZXdUaXRsZSA9IG92ZXJ2aWV3UmVnaW9uLnF1ZXJ5U2VsZWN0b3IoJy53b3JraW5nLXNldC10aXRsZScpIGFzIEhUTUxFbGVtZW50ID8/IGRvbS5hcHBlbmQob3ZlcnZpZXdSZWdpb24sICQoJy53b3JraW5nLXNldC10aXRsZScpKTtcblx0XHRjb25zdCBvdmVydmlld0ZpbGVDb3VudCA9IG92ZXJ2aWV3VGl0bGUucXVlcnlTZWxlY3Rvcignc3Bhbi53b3JraW5nLXNldC1jb3VudCcpID8/IGRvbS5hcHBlbmQob3ZlcnZpZXdUaXRsZSwgJCgnc3Bhbi53b3JraW5nLXNldC1jb3VudCcpKTtcblxuXHRcdG92ZXJ2aWV3RmlsZUNvdW50LnRleHRDb250ZW50ID0gZW50cmllcy5sZW5ndGggPT09IDEgPyBsb2NhbGl6ZSgnY2hhdEVkaXRpbmdTZXNzaW9uLm9uZUZpbGUuMScsICcxIGZpbGUgY2hhbmdlZCcpIDogbG9jYWxpemUoJ2NoYXRFZGl0aW5nU2Vzc2lvbi5tYW55RmlsZXMuMScsICd7MH0gZmlsZXMgY2hhbmdlZCcsIGVudHJpZXMubGVuZ3RoKTtcblxuXHRcdG92ZXJ2aWV3VGl0bGUuYXJpYUxhYmVsID0gb3ZlcnZpZXdGaWxlQ291bnQudGV4dENvbnRlbnQ7XG5cdFx0b3ZlcnZpZXdUaXRsZS50YWJJbmRleCA9IDA7XG5cblx0XHQvLyBDbGVhciBvdXQgdGhlIHByZXZpb3VzIGFjdGlvbnMgKGlmIGFueSlcblx0XHR0aGlzLl9jaGF0RWRpdHNBY3Rpb25zRGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdC8vIENoYXQgZWRpdGluZyBzZXNzaW9uIGFjdGlvbnNcblx0XHRjb25zdCBhY3Rpb25zQ29udGFpbmVyID0gb3ZlcnZpZXdSZWdpb24ucXVlcnlTZWxlY3RvcignLmNoYXQtZWRpdGluZy1zZXNzaW9uLWFjdGlvbnMnKSBhcyBIVE1MRWxlbWVudCA/PyBkb20uYXBwZW5kKG92ZXJ2aWV3UmVnaW9uLCAkKCcuY2hhdC1lZGl0aW5nLXNlc3Npb24tYWN0aW9ucycpKTtcblxuXHRcdHRoaXMuX2NoYXRFZGl0c0FjdGlvbnNEaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51V29ya2JlbmNoQnV0dG9uQmFyLCBhY3Rpb25zQ29udGFpbmVyLCBNZW51SWQuQ2hhdEVkaXRpbmdXaWRnZXRUb29sYmFyLCB7XG5cdFx0XHR0ZWxlbWV0cnlTb3VyY2U6IHRoaXMub3B0aW9ucy5tZW51cy50ZWxlbWV0cnlTb3VyY2UsXG5cdFx0XHRtZW51T3B0aW9uczoge1xuXHRcdFx0XHRhcmc6IHsgc2Vzc2lvbklkOiBjaGF0RWRpdGluZ1Nlc3Npb24uY2hhdFNlc3Npb25JZCB9LFxuXHRcdFx0fSxcblx0XHRcdGJ1dHRvbkNvbmZpZ1Byb3ZpZGVyOiAoYWN0aW9uKSA9PiB7XG5cdFx0XHRcdGlmIChhY3Rpb24uaWQgPT09IENoYXRFZGl0aW5nU2hvd0NoYW5nZXNBY3Rpb24uSUQgfHwgYWN0aW9uLmlkID09PSBDaGF0RWRpdGluZ1JlbW92ZUFsbEZpbGVzQWN0aW9uLklEKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgc2hvd0ljb246IHRydWUsIHNob3dMYWJlbDogZmFsc2UsIGlzU2Vjb25kYXJ5OiB0cnVlIH07XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRpZiAoIWNoYXRFZGl0aW5nU2Vzc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFdvcmtpbmcgc2V0XG5cdFx0Y29uc3Qgd29ya2luZ1NldENvbnRhaW5lciA9IGlubmVyQ29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5jaGF0LWVkaXRpbmctc2Vzc2lvbi1saXN0JykgYXMgSFRNTEVsZW1lbnQgPz8gZG9tLmFwcGVuZChpbm5lckNvbnRhaW5lciwgJCgnLmNoYXQtZWRpdGluZy1zZXNzaW9uLWxpc3QnKSk7XG5cdFx0aWYgKCF0aGlzLl9jaGF0RWRpdExpc3QpIHtcblx0XHRcdHRoaXMuX2NoYXRFZGl0TGlzdCA9IHRoaXMuX2NoYXRFZGl0c0xpc3RQb29sLmdldCgpO1xuXHRcdFx0Y29uc3QgbGlzdCA9IHRoaXMuX2NoYXRFZGl0TGlzdC5vYmplY3Q7XG5cdFx0XHR0aGlzLl9jaGF0RWRpdHNEaXNwb3NhYmxlcy5hZGQodGhpcy5fY2hhdEVkaXRMaXN0KTtcblx0XHRcdHRoaXMuX2NoYXRFZGl0c0Rpc3Bvc2FibGVzLmFkZChsaXN0Lm9uRGlkRm9jdXMoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9vbkRpZEZvY3VzLmZpcmUoKTtcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX2NoYXRFZGl0c0Rpc3Bvc2FibGVzLmFkZChsaXN0Lm9uRGlkT3Blbihhc3luYyAoZSkgPT4ge1xuXHRcdFx0XHRpZiAoZS5lbGVtZW50Py5raW5kID09PSAncmVmZXJlbmNlJyAmJiBVUkkuaXNVcmkoZS5lbGVtZW50LnJlZmVyZW5jZSkpIHtcblx0XHRcdFx0XHRjb25zdCBtb2RpZmllZEZpbGVVcmkgPSBlLmVsZW1lbnQucmVmZXJlbmNlO1xuXG5cdFx0XHRcdFx0Y29uc3QgZW50cnkgPSBjaGF0RWRpdGluZ1Nlc3Npb24uZ2V0RW50cnkobW9kaWZpZWRGaWxlVXJpKTtcblxuXHRcdFx0XHRcdGNvbnN0IHBhbmUgPSBhd2FpdCB0aGlzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdFx0XHRyZXNvdXJjZTogbW9kaWZpZWRGaWxlVXJpLFxuXHRcdFx0XHRcdFx0b3B0aW9uczogZS5lZGl0b3JPcHRpb25zXG5cdFx0XHRcdFx0fSwgZS5zaWRlQnlTaWRlID8gU0lERV9HUk9VUCA6IEFDVElWRV9HUk9VUCk7XG5cblx0XHRcdFx0XHRpZiAocGFuZSkge1xuXHRcdFx0XHRcdFx0ZW50cnk/LmdldEVkaXRvckludGVncmF0aW9uKHBhbmUpLnJldmVhbCh0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX2NoYXRFZGl0c0Rpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIobGlzdC5nZXRIVE1MRWxlbWVudCgpLCAnY2xpY2snLCBlID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLmhhc0ZvY3VzKCkpIHtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZEZvY3VzLmZpcmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdHJ1ZSkpO1xuXHRcdFx0ZG9tLmFwcGVuZCh3b3JraW5nU2V0Q29udGFpbmVyLCBsaXN0LmdldEhUTUxFbGVtZW50KCkpO1xuXHRcdFx0ZG9tLmFwcGVuZChpbm5lckNvbnRhaW5lciwgd29ya2luZ1NldENvbnRhaW5lcik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWF4SXRlbXNTaG93biA9IDY7XG5cdFx0Y29uc3QgaXRlbXNTaG93biA9IE1hdGgubWluKGVudHJpZXMubGVuZ3RoLCBtYXhJdGVtc1Nob3duKTtcblx0XHRjb25zdCBoZWlnaHQgPSBpdGVtc1Nob3duICogMjI7XG5cdFx0Y29uc3QgbGlzdCA9IHRoaXMuX2NoYXRFZGl0TGlzdC5vYmplY3Q7XG5cdFx0bGlzdC5sYXlvdXQoaGVpZ2h0KTtcblx0XHRsaXN0LmdldEhUTUxFbGVtZW50KCkuc3R5bGUuaGVpZ2h0ID0gYCR7aGVpZ2h0fXB4YDtcblx0XHRsaXN0LnNwbGljZSgwLCBsaXN0Lmxlbmd0aCwgZW50cmllcyk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpO1xuXHR9XG5cblx0YXN5bmMgcmVuZGVyQ2hhdFJlbGF0ZWRGaWxlcygpIHtcblx0XHRjb25zdCBhbmNob3IgPSB0aGlzLnJlbGF0ZWRGaWxlc0NvbnRhaW5lcjtcblx0XHRkb20uY2xlYXJOb2RlKGFuY2hvcik7XG5cdFx0Y29uc3Qgc2hvdWxkUmVuZGVyID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnY2hhdC5yZW5kZXJSZWxhdGVkRmlsZXMnKTtcblx0XHRkb20uc2V0VmlzaWJpbGl0eShCb29sZWFuKHRoaXMucmVsYXRlZEZpbGVzPy52YWx1ZS5sZW5ndGggJiYgc2hvdWxkUmVuZGVyKSwgYW5jaG9yKTtcblx0XHRpZiAoIXNob3VsZFJlbmRlciB8fCAhdGhpcy5yZWxhdGVkRmlsZXM/LnZhbHVlLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhvdmVyRGVsZWdhdGUgPSBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnZWxlbWVudCcpO1xuXHRcdGZvciAoY29uc3QgeyB1cmksIGRlc2NyaXB0aW9uIH0gb2YgdGhpcy5yZWxhdGVkRmlsZXMudmFsdWUpIHtcblx0XHRcdGNvbnN0IHVyaUxhYmVsID0gdGhpcy5fY2hhdEVkaXRzQWN0aW9uc0Rpc3Bvc2FibGVzLmFkZChuZXcgQnV0dG9uKGFuY2hvciwge1xuXHRcdFx0XHRzdXBwb3J0SWNvbnM6IHRydWUsXG5cdFx0XHRcdHNlY29uZGFyeTogdHJ1ZSxcblx0XHRcdFx0aG92ZXJEZWxlZ2F0ZVxuXHRcdFx0fSkpO1xuXHRcdFx0dXJpTGFiZWwubGFiZWwgPSB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlCYXNlbmFtZUxhYmVsKHVyaSk7XG5cdFx0XHR1cmlMYWJlbC5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ21vbmFjby1pY29uLWxhYmVsJyk7XG5cdFx0XHR1cmlMYWJlbC5lbGVtZW50LnRpdGxlID0gbG9jYWxpemUoJ3N1Z2dlc3RlLnRpdGxlJywgXCJ7MH0gLSB7MX1cIiwgdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwodXJpLCB7IHJlbGF0aXZlOiB0cnVlIH0pLCBkZXNjcmlwdGlvbiA/PyAnJyk7XG5cblx0XHRcdHRoaXMuX2NoYXRFZGl0c0FjdGlvbnNEaXNwb3NhYmxlcy5hZGQodXJpTGFiZWwub25EaWRDbGljayhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGdyb3VwLnJlbW92ZSgpOyAvLyBSRU1PVkUgYXNhcFxuXHRcdFx0XHRhd2FpdCB0aGlzLl9hdHRhY2htZW50TW9kZWwuYWRkRmlsZSh1cmkpO1xuXHRcdFx0XHR0aGlzLnJlbGF0ZWRGaWxlcz8ucmVtb3ZlKHVyaSk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdGNvbnN0IGFkZEJ1dHRvbiA9IHRoaXMuX2NoYXRFZGl0c0FjdGlvbnNEaXNwb3NhYmxlcy5hZGQobmV3IEJ1dHRvbihhbmNob3IsIHtcblx0XHRcdFx0c3VwcG9ydEljb25zOiBmYWxzZSxcblx0XHRcdFx0c2Vjb25kYXJ5OiB0cnVlLFxuXHRcdFx0XHRob3ZlckRlbGVnYXRlLFxuXHRcdFx0XHRhcmlhTGFiZWw6IGxvY2FsaXplKCdjaGF0RWRpdGluZ1Nlc3Npb24uYWRkU3VnZ2VzdGlvbicsICdBZGQgc3VnZ2VzdGlvbiB7MH0nLCB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbCh1cmksIHsgcmVsYXRpdmU6IHRydWUgfSkpLFxuXHRcdFx0fSkpO1xuXHRcdFx0YWRkQnV0dG9uLmljb24gPSBDb2RpY29uLmFkZDtcblx0XHRcdGFkZEJ1dHRvbi5zZXRUaXRsZShsb2NhbGl6ZSgnY2hhdEVkaXRpbmdTZXNzaW9uLmFkZFN1Z2dlc3RlZCcsICdBZGQgc3VnZ2VzdGlvbicpKTtcblx0XHRcdHRoaXMuX2NoYXRFZGl0c0FjdGlvbnNEaXNwb3NhYmxlcy5hZGQoYWRkQnV0dG9uLm9uRGlkQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRncm91cC5yZW1vdmUoKTsgLy8gUkVNT1ZFIGFzYXBcblx0XHRcdFx0YXdhaXQgdGhpcy5fYXR0YWNobWVudE1vZGVsLmFkZEZpbGUodXJpKTtcblx0XHRcdFx0dGhpcy5yZWxhdGVkRmlsZXM/LnJlbW92ZSh1cmkpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHRjb25zdCBzZXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdHNlcC5jbGFzc0xpc3QuYWRkKCdzZXBhcmF0b3InKTtcblxuXHRcdFx0Y29uc3QgZ3JvdXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0XHRncm91cC5jbGFzc0xpc3QuYWRkKCdtb25hY28tYnV0dG9uLWRyb3Bkb3duJywgJ3NpZGVieXNpZGUtYnV0dG9uJyk7XG5cdFx0XHRncm91cC5hcHBlbmRDaGlsZChhZGRCdXR0b24uZWxlbWVudCk7XG5cdFx0XHRncm91cC5hcHBlbmRDaGlsZChzZXApO1xuXHRcdFx0Z3JvdXAuYXBwZW5kQ2hpbGQodXJpTGFiZWwuZWxlbWVudCk7XG5cdFx0XHRkb20uYXBwZW5kKGFuY2hvciwgZ3JvdXApO1xuXG5cdFx0XHR0aGlzLl9jaGF0RWRpdHNBY3Rpb25zRGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRcdGdyb3VwLnJlbW92ZSgpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0XHR0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCk7XG5cdH1cblxuXHRhc3luYyByZW5kZXJGb2xsb3d1cHMoaXRlbXM6IElDaGF0Rm9sbG93dXBbXSB8IHVuZGVmaW5lZCwgcmVzcG9uc2U6IElDaGF0UmVzcG9uc2VWaWV3TW9kZWwgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMub3B0aW9ucy5yZW5kZXJGb2xsb3d1cHMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5mb2xsb3d1cHNEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdGRvbS5jbGVhck5vZGUodGhpcy5mb2xsb3d1cHNDb250YWluZXIpO1xuXG5cdFx0aWYgKGl0ZW1zICYmIGl0ZW1zLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuZm9sbG93dXBzRGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2U8dHlwZW9mIENoYXRGb2xsb3d1cHM8SUNoYXRGb2xsb3d1cD4sIENoYXRGb2xsb3d1cHM8SUNoYXRGb2xsb3d1cD4+KENoYXRGb2xsb3d1cHMsIHRoaXMuZm9sbG93dXBzQ29udGFpbmVyLCBpdGVtcywgdGhpcy5sb2NhdGlvbiwgdW5kZWZpbmVkLCBmb2xsb3d1cCA9PiB0aGlzLl9vbkRpZEFjY2VwdEZvbGxvd3VwLmZpcmUoeyBmb2xsb3d1cCwgcmVzcG9uc2UgfSkpKTtcblx0XHR9XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpO1xuXHR9XG5cblx0Z2V0IGNvbnRlbnRIZWlnaHQoKTogbnVtYmVyIHtcblx0XHRjb25zdCBkYXRhID0gdGhpcy5nZXRMYXlvdXREYXRhKCk7XG5cdFx0cmV0dXJuIGRhdGEuZm9sbG93dXBzSGVpZ2h0ICsgZGF0YS5pbnB1dFBhcnRFZGl0b3JIZWlnaHQgKyBkYXRhLmlucHV0UGFydFZlcnRpY2FsUGFkZGluZyArIGRhdGEuaW5wdXRFZGl0b3JCb3JkZXIgKyBkYXRhLmF0dGFjaG1lbnRzSGVpZ2h0ICsgZGF0YS50b29sYmFyc0hlaWdodCArIGRhdGEuY2hhdEVkaXRpbmdTdGF0ZUhlaWdodDtcblx0fVxuXG5cdGxheW91dChoZWlnaHQ6IG51bWJlciwgd2lkdGg6IG51bWJlcikge1xuXHRcdHRoaXMuY2FjaGVkRGltZW5zaW9ucyA9IG5ldyBkb20uRGltZW5zaW9uKHdpZHRoLCBoZWlnaHQpO1xuXG5cdFx0cmV0dXJuIHRoaXMuX2xheW91dChoZWlnaHQsIHdpZHRoKTtcblx0fVxuXG5cdHByaXZhdGUgcHJldmlvdXNJbnB1dEVkaXRvckRpbWVuc2lvbjogSURpbWVuc2lvbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfbGF5b3V0KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyLCBhbGxvd1JlY3Vyc2UgPSB0cnVlKTogdm9pZCB7XG5cdFx0Y29uc3QgZGF0YSA9IHRoaXMuZ2V0TGF5b3V0RGF0YSgpO1xuXHRcdGNvbnN0IGlucHV0RWRpdG9ySGVpZ2h0ID0gTWF0aC5taW4oZGF0YS5pbnB1dFBhcnRFZGl0b3JIZWlnaHQsIGhlaWdodCAtIGRhdGEuZm9sbG93dXBzSGVpZ2h0IC0gZGF0YS5hdHRhY2htZW50c0hlaWdodCAtIGRhdGEuaW5wdXRQYXJ0VmVydGljYWxQYWRkaW5nIC0gZGF0YS50b29sYmFyc0hlaWdodCk7XG5cblx0XHRjb25zdCBmb2xsb3d1cHNXaWR0aCA9IHdpZHRoIC0gZGF0YS5pbnB1dFBhcnRIb3Jpem9udGFsUGFkZGluZztcblx0XHR0aGlzLmZvbGxvd3Vwc0NvbnRhaW5lci5zdHlsZS53aWR0aCA9IGAke2ZvbGxvd3Vwc1dpZHRofXB4YDtcblxuXHRcdHRoaXMuX2lucHV0UGFydEhlaWdodCA9IGRhdGEuaW5wdXRQYXJ0VmVydGljYWxQYWRkaW5nICsgZGF0YS5mb2xsb3d1cHNIZWlnaHQgKyBpbnB1dEVkaXRvckhlaWdodCArIGRhdGEuaW5wdXRFZGl0b3JCb3JkZXIgKyBkYXRhLmF0dGFjaG1lbnRzSGVpZ2h0ICsgZGF0YS50b29sYmFyc0hlaWdodCArIGRhdGEuY2hhdEVkaXRpbmdTdGF0ZUhlaWdodDtcblx0XHR0aGlzLl9mb2xsb3d1cHNIZWlnaHQgPSBkYXRhLmZvbGxvd3Vwc0hlaWdodDtcblx0XHR0aGlzLl9lZGl0U2Vzc2lvbldpZGdldEhlaWdodCA9IGRhdGEuY2hhdEVkaXRpbmdTdGF0ZUhlaWdodDtcblxuXHRcdGNvbnN0IGluaXRpYWxFZGl0b3JTY3JvbGxXaWR0aCA9IHRoaXMuX2lucHV0RWRpdG9yLmdldFNjcm9sbFdpZHRoKCk7XG5cdFx0Y29uc3QgbmV3RWRpdG9yV2lkdGggPSB3aWR0aCAtIGRhdGEuaW5wdXRQYXJ0SG9yaXpvbnRhbFBhZGRpbmcgLSBkYXRhLmVkaXRvckJvcmRlciAtIGRhdGEuaW5wdXRQYXJ0SG9yaXpvbnRhbFBhZGRpbmdJbnNpZGUgLSBkYXRhLnRvb2xiYXJzV2lkdGggLSBkYXRhLnNpZGVUb29sYmFyV2lkdGg7XG5cdFx0Y29uc3QgbmV3RGltZW5zaW9uID0geyB3aWR0aDogbmV3RWRpdG9yV2lkdGgsIGhlaWdodDogaW5wdXRFZGl0b3JIZWlnaHQgfTtcblx0XHRpZiAoIXRoaXMucHJldmlvdXNJbnB1dEVkaXRvckRpbWVuc2lvbiB8fCAodGhpcy5wcmV2aW91c0lucHV0RWRpdG9yRGltZW5zaW9uLndpZHRoICE9PSBuZXdEaW1lbnNpb24ud2lkdGggfHwgdGhpcy5wcmV2aW91c0lucHV0RWRpdG9yRGltZW5zaW9uLmhlaWdodCAhPT0gbmV3RGltZW5zaW9uLmhlaWdodCkpIHtcblx0XHRcdC8vIFRoaXMgbGF5b3V0IGNhbGwgaGFzIHNpZGUtZWZmZWN0cyB0aGF0IGFyZSBoYXJkIHRvIHVuZGVyc3RhbmQuIGVnIGlmIHdlIGFyZSBjYWxsaW5nIHRoaXMgaW5zaWRlIGEgb25EaWRDaGFuZ2VDb250ZW50IGhhbmRsZXIsIHRoaXMgY2FuIHRyaWdnZXIgdGhlIG5leHQgb25EaWRDaGFuZ2VDb250ZW50IGhhbmRsZXJcblx0XHRcdC8vIHRvIGJlIGludm9rZWQsIGFuZCB3ZSBoYXZlIGEgbG90IG9mIHRoZXNlIG9uIHRoaXMgZWRpdG9yLiBPbmx5IGRvaW5nIGEgbGF5b3V0IHRoaXMgd2hlbiB0aGUgZWRpdG9yIHNpemUgaGFzIGFjdHVhbGx5IGNoYW5nZWQgbWFrZXMgaXQgbXVjaCBlYXNpZXIgdG8gZm9sbG93LlxuXHRcdFx0dGhpcy5faW5wdXRFZGl0b3IubGF5b3V0KG5ld0RpbWVuc2lvbik7XG5cdFx0XHR0aGlzLnByZXZpb3VzSW5wdXRFZGl0b3JEaW1lbnNpb24gPSBuZXdEaW1lbnNpb247XG5cdFx0fVxuXG5cdFx0aWYgKGFsbG93UmVjdXJzZSAmJiBpbml0aWFsRWRpdG9yU2Nyb2xsV2lkdGggPCAxMCkge1xuXHRcdFx0Ly8gVGhpcyBpcyBwcm9iYWJseSB0aGUgaW5pdGlhbCBsYXlvdXQuIE5vdyB0aGF0IHRoZSBlZGl0b3IgaXMgbGF5ZWQgb3V0IHdpdGggaXRzIGNvcnJlY3Qgd2lkdGgsIGl0IHNob3VsZCByZXBvcnQgdGhlIGNvcnJlY3QgY29udGVudEhlaWdodFxuXHRcdFx0cmV0dXJuIHRoaXMuX2xheW91dChoZWlnaHQsIHdpZHRoLCBmYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRMYXlvdXREYXRhKCkge1xuXHRcdGNvbnN0IGV4ZWN1dGVUb29sYmFyV2lkdGggPSB0aGlzLmNhY2hlZEV4ZWN1dGVUb29sYmFyV2lkdGggPSB0aGlzLmV4ZWN1dGVUb29sYmFyLmdldEl0ZW1zV2lkdGgoKTtcblx0XHRjb25zdCBpbnB1dFRvb2xiYXJXaWR0aCA9IHRoaXMuY2FjaGVkSW5wdXRUb29sYmFyV2lkdGggPSB0aGlzLmlucHV0QWN0aW9uc1Rvb2xiYXIuZ2V0SXRlbXNXaWR0aCgpO1xuXHRcdGNvbnN0IGV4ZWN1dGVUb29sYmFyUGFkZGluZyA9ICh0aGlzLmV4ZWN1dGVUb29sYmFyLmdldEl0ZW1zTGVuZ3RoKCkgLSAxKSAqIDQ7XG5cdFx0Y29uc3QgaW5wdXRUb29sYmFyUGFkZGluZyA9IHRoaXMuaW5wdXRBY3Rpb25zVG9vbGJhci5nZXRJdGVtc0xlbmd0aCgpID8gKHRoaXMuaW5wdXRBY3Rpb25zVG9vbGJhci5nZXRJdGVtc0xlbmd0aCgpIC0gMSkgKiA0IDogMDtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5wdXRFZGl0b3JCb3JkZXI6IDIsXG5cdFx0XHRmb2xsb3d1cHNIZWlnaHQ6IHRoaXMuZm9sbG93dXBzQ29udGFpbmVyLm9mZnNldEhlaWdodCxcblx0XHRcdGlucHV0UGFydEVkaXRvckhlaWdodDogTWF0aC5taW4odGhpcy5faW5wdXRFZGl0b3IuZ2V0Q29udGVudEhlaWdodCgpLCB0aGlzLmlucHV0RWRpdG9yTWF4SGVpZ2h0KSxcblx0XHRcdGlucHV0UGFydEhvcml6b250YWxQYWRkaW5nOiB0aGlzLm9wdGlvbnMucmVuZGVyU3R5bGUgPT09ICdjb21wYWN0JyA/IDE2IDogMzIsXG5cdFx0XHRpbnB1dFBhcnRWZXJ0aWNhbFBhZGRpbmc6IHRoaXMub3B0aW9ucy5yZW5kZXJTdHlsZSA9PT0gJ2NvbXBhY3QnID8gMTIgOiAyOCxcblx0XHRcdGF0dGFjaG1lbnRzSGVpZ2h0OiB0aGlzLmF0dGFjaG1lbnRzQ29udGFpbmVyLm9mZnNldEhlaWdodCArICh0aGlzLmF0dGFjaG1lbnRzQ29udGFpbmVyLmNoZWNrVmlzaWJpbGl0eSgpID8gNiA6IDApLFxuXHRcdFx0ZWRpdG9yQm9yZGVyOiAyLFxuXHRcdFx0aW5wdXRQYXJ0SG9yaXpvbnRhbFBhZGRpbmdJbnNpZGU6IDEyLFxuXHRcdFx0dG9vbGJhcnNXaWR0aDogdGhpcy5vcHRpb25zLnJlbmRlclN0eWxlID09PSAnY29tcGFjdCcgPyBleGVjdXRlVG9vbGJhcldpZHRoICsgZXhlY3V0ZVRvb2xiYXJQYWRkaW5nICsgaW5wdXRUb29sYmFyV2lkdGggKyBpbnB1dFRvb2xiYXJQYWRkaW5nIDogMCxcblx0XHRcdHRvb2xiYXJzSGVpZ2h0OiB0aGlzLm9wdGlvbnMucmVuZGVyU3R5bGUgPT09ICdjb21wYWN0JyA/IDAgOiAyMixcblx0XHRcdGNoYXRFZGl0aW5nU3RhdGVIZWlnaHQ6IHRoaXMuY2hhdEVkaXRpbmdTZXNzaW9uV2lkZ2V0Q29udGFpbmVyLm9mZnNldEhlaWdodCxcblx0XHRcdHNpZGVUb29sYmFyV2lkdGg6IHRoaXMuaW5wdXRTaWRlVG9vbGJhckNvbnRhaW5lciA/IGRvbS5nZXRUb3RhbFdpZHRoKHRoaXMuaW5wdXRTaWRlVG9vbGJhckNvbnRhaW5lcikgKyA0IC8qZ2FwKi8gOiAwLFxuXHRcdH07XG5cdH1cblxuXHRnZXRWaWV3U3RhdGUoKTogSUNoYXRJbnB1dFN0YXRlIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRJbnB1dFN0YXRlKCk7XG5cdH1cblxuXHRzYXZlU3RhdGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaGlzdG9yeS5pc0F0RW5kKCkpIHtcblx0XHRcdHRoaXMuc2F2ZUN1cnJlbnRWYWx1ZSh0aGlzLmdldElucHV0U3RhdGUoKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5wdXRIaXN0b3J5ID0gWy4uLnRoaXMuaGlzdG9yeV07XG5cdFx0dGhpcy5oaXN0b3J5U2VydmljZS5zYXZlSGlzdG9yeSh0aGlzLmxvY2F0aW9uLCBpbnB1dEhpc3RvcnkpO1xuXHR9XG59XG5cbmNvbnN0IGhpc3RvcnlLZXlGbiA9IChlbnRyeTogSUNoYXRIaXN0b3J5RW50cnkpID0+IEpTT04uc3RyaW5naWZ5KHsgLi4uZW50cnksIHN0YXRlOiB7IC4uLmVudHJ5LnN0YXRlLCBjaGF0TW9kZTogdW5kZWZpbmVkIH0gfSk7XG5cbmZ1bmN0aW9uIGdldExhc3RQb3NpdGlvbihtb2RlbDogSVRleHRNb2RlbCk6IElQb3NpdGlvbiB7XG5cdHJldHVybiB7IGxpbmVOdW1iZXI6IG1vZGVsLmdldExpbmVDb3VudCgpLCBjb2x1bW46IG1vZGVsLmdldExpbmVMZW5ndGgobW9kZWwuZ2V0TGluZUNvdW50KCkpICsgMSB9O1xufVxuXG4vLyBUaGlzIGRvZXMgc2VlbXMgbGlrZSBhIGxvdCBqdXN0IHRvIGN1c3RvbWl6ZSBhbiBpdGVtIHdpdGggZHJvcGRvd24uIFRoaXMgd2hvbGUgY2xhc3MgZXhpc3RzIGp1c3QgYmVjYXVzZSB3ZSBuZWVkIGFuXG4vLyBvbkRpZENoYW5nZSBsaXN0ZW5lciBvbiB0aGUgc3VibWVudSwgd2hpY2ggaXMgYXBwYXJlbnRseSBub3QgbmVlZGVkIGluIG90aGVyIGNhc2VzLlxuY2xhc3MgQ2hhdFN1Ym1pdERyb3Bkb3duQWN0aW9uSXRlbSBleHRlbmRzIERyb3Bkb3duV2l0aFByaW1hcnlBY3Rpb25WaWV3SXRlbSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdGFjdGlvbjogTWVudUl0ZW1BY3Rpb24sXG5cdFx0ZHJvcGRvd25BY3Rpb246IElBY3Rpb24sXG5cdFx0b3B0aW9uczogSURyb3Bkb3duV2l0aFByaW1hcnlBY3Rpb25WaWV3SXRlbU9wdGlvbnMsXG5cdFx0QElNZW51U2VydmljZSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2VydmljZSBhY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0YWN0aW9uLFxuXHRcdFx0ZHJvcGRvd25BY3Rpb24sXG5cdFx0XHRbXSxcblx0XHRcdCcnLFxuXHRcdFx0e1xuXHRcdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0XHRnZXRLZXlCaW5kaW5nOiAoYWN0aW9uOiBJQWN0aW9uKSA9PiBrZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGFjdGlvbi5pZCwgY29udGV4dEtleVNlcnZpY2UpXG5cdFx0XHR9LFxuXHRcdFx0Y29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdFx0a2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdFx0Y29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHR0aGVtZVNlcnZpY2UsXG5cdFx0XHRhY2Nlc3NpYmlsaXR5U2VydmljZSk7XG5cdFx0Y29uc3QgbWVudSA9IG1lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUoTWVudUlkLkNoYXRFeGVjdXRlU2Vjb25kYXJ5LCBjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3Qgc2V0QWN0aW9ucyA9ICgpID0+IHtcblx0XHRcdGNvbnN0IHNlY29uZGFyeSA9IGdldEZsYXRBY3Rpb25CYXJBY3Rpb25zKG1lbnUuZ2V0QWN0aW9ucyh7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlIH0pKTtcblx0XHRcdHRoaXMudXBkYXRlKGRyb3Bkb3duQWN0aW9uLCBzZWNvbmRhcnkpO1xuXHRcdH07XG5cdFx0c2V0QWN0aW9ucygpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG1lbnUub25EaWRDaGFuZ2UoKCkgPT4gc2V0QWN0aW9ucygpKSk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIE1vZGVsUGlja2VyRGVsZWdhdGUge1xuXHRvbkRpZENoYW5nZU1vZGVsOiBFdmVudDxJTGFuZ3VhZ2VNb2RlbENoYXRNZXRhZGF0YUFuZElkZW50aWZpZXI+O1xuXHRzZXRNb2RlbChzZWxlY3RlZE1vZGVsSWQ6IElMYW5ndWFnZU1vZGVsQ2hhdE1ldGFkYXRhQW5kSWRlbnRpZmllcik6IHZvaWQ7XG5cdGdldE1vZGVscygpOiBJTGFuZ3VhZ2VNb2RlbENoYXRNZXRhZGF0YUFuZElkZW50aWZpZXJbXTtcbn1cblxuY2xhc3MgTW9kZWxQaWNrZXJBY3Rpb25WaWV3SXRlbSBleHRlbmRzIERyb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtV2l0aEtleWJpbmRpbmcge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRhY3Rpb246IE1lbnVJdGVtQWN0aW9uLFxuXHRcdHByaXZhdGUgY3VycmVudExhbmd1YWdlTW9kZWw6IElMYW5ndWFnZU1vZGVsQ2hhdE1ldGFkYXRhQW5kSWRlbnRpZmllcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGRlbGVnYXRlOiBNb2RlbFBpY2tlckRlbGVnYXRlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ2hhdEVudGl0bGVtZW50U2VydmljZSBjaGF0RW50aXRsZW1lbnRTZXJ2aWNlOiBJQ2hhdEVudGl0bGVtZW50U2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0KSB7XG5cdFx0Y29uc3QgbW9kZWxBY3Rpb25zUHJvdmlkZXI6IElBY3Rpb25Qcm92aWRlciA9IHtcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHtcblx0XHRcdFx0Y29uc3Qgc2V0TGFuZ3VhZ2VNb2RlbEFjdGlvbiA9IChlbnRyeTogSUxhbmd1YWdlTW9kZWxDaGF0TWV0YWRhdGFBbmRJZGVudGlmaWVyKTogSUFjdGlvbiA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGlkOiBlbnRyeS5pZGVudGlmaWVyLFxuXHRcdFx0XHRcdFx0bGFiZWw6IGVudHJ5Lm1ldGFkYXRhLm5hbWUsXG5cdFx0XHRcdFx0XHR0b29sdGlwOiAnJyxcblx0XHRcdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRcdFx0Y2hlY2tlZDogZW50cnkuaWRlbnRpZmllciA9PT0gdGhpcy5jdXJyZW50TGFuZ3VhZ2VNb2RlbC5pZGVudGlmaWVyLFxuXHRcdFx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuY3VycmVudExhbmd1YWdlTW9kZWwgPSBlbnRyeTtcblx0XHRcdFx0XHRcdFx0dGhpcy5yZW5kZXJMYWJlbCh0aGlzLmVsZW1lbnQhKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5kZWxlZ2F0ZS5zZXRNb2RlbChlbnRyeSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRjb25zdCBtb2RlbHM6IElMYW5ndWFnZU1vZGVsQ2hhdE1ldGFkYXRhQW5kSWRlbnRpZmllcltdID0gdGhpcy5kZWxlZ2F0ZS5nZXRNb2RlbHMoKTtcblx0XHRcdFx0Y29uc3QgYWN0aW9ucyA9IG1vZGVscy5tYXAoZW50cnkgPT4gc2V0TGFuZ3VhZ2VNb2RlbEFjdGlvbihlbnRyeSkpO1xuXG5cdFx0XHRcdC8vIEFkZCBtZW51IGNvbnRyaWJ1dGlvbnMgZnJvbSBleHRlbnNpb25zXG5cdFx0XHRcdGNvbnN0IG1lbnVBY3Rpb25zID0gbWVudVNlcnZpY2UuZ2V0TWVudUFjdGlvbnMoTWVudUlkLkNoYXRNb2RlbFBpY2tlciwgY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBtZW51Q29udHJpYnV0aW9ucyA9IGdldEZsYXRBY3Rpb25CYXJBY3Rpb25zKG1lbnVBY3Rpb25zKTtcblx0XHRcdFx0aWYgKG1lbnVDb250cmlidXRpb25zLmxlbmd0aCA+IDAgfHwgY2hhdEVudGl0bGVtZW50U2VydmljZS5lbnRpdGxlbWVudCA9PT0gQ2hhdEVudGl0bGVtZW50LkxpbWl0ZWQpIHtcblx0XHRcdFx0XHRhY3Rpb25zLnB1c2gobmV3IFNlcGFyYXRvcigpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRhY3Rpb25zLnB1c2goLi4ubWVudUNvbnRyaWJ1dGlvbnMpO1xuXHRcdFx0XHRpZiAoY2hhdEVudGl0bGVtZW50U2VydmljZS5lbnRpdGxlbWVudCA9PT0gQ2hhdEVudGl0bGVtZW50LkxpbWl0ZWQpIHtcblx0XHRcdFx0XHRhY3Rpb25zLnB1c2godG9BY3Rpb24oe1xuXHRcdFx0XHRcdFx0aWQ6ICdtb3JlTW9kZWxzJywgbGFiZWw6IGxvY2FsaXplKCdjaGF0Lm1vcmVNb2RlbHMnLCBcIkFkZCBtb3JlIE1vZGVsc1wiKSwgcnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNvbW1hbmRJZCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQudXBncmFkZVBsYW4nO1xuXHRcdFx0XHRcdFx0XHR0ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8V29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRFdmVudCwgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRDbGFzc2lmaWNhdGlvbj4oJ3dvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkJywgeyBpZDogY29tbWFuZElkLCBmcm9tOiAnY2hhdC1tb2RlbHMnIH0pO1xuXHRcdFx0XHRcdFx0XHRjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChjb21tYW5kSWQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gYWN0aW9ucztcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgYWN0aW9uV2l0aExhYmVsOiBJQWN0aW9uID0ge1xuXHRcdFx0Li4uYWN0aW9uLFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ2NoYXQubW9kZWxQaWNrZXIubGFiZWwnLCBcIlBpY2sgTW9kZWxcIiksXG5cdFx0XHRydW46ICgpID0+IHsgfVxuXHRcdH07XG5cdFx0c3VwZXIoYWN0aW9uV2l0aExhYmVsLCBtb2RlbEFjdGlvbnNQcm92aWRlciwgY29udGV4dE1lbnVTZXJ2aWNlLCB1bmRlZmluZWQsIGtleWJpbmRpbmdTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZGVsZWdhdGUub25EaWRDaGFuZ2VNb2RlbChtb2RlbElkID0+IHtcblx0XHRcdHRoaXMuY3VycmVudExhbmd1YWdlTW9kZWwgPSBtb2RlbElkO1xuXHRcdFx0dGhpcy5yZW5kZXJMYWJlbCh0aGlzLmVsZW1lbnQhKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyTGFiZWwoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBJRGlzcG9zYWJsZSB8IG51bGwge1xuXHRcdHRoaXMuc2V0QXJpYUxhYmVsQXR0cmlidXRlcyhlbGVtZW50KTtcblx0XHRkb20ucmVzZXQoZWxlbWVudCwgZG9tLiQoJ3NwYW4uY2hhdC1tb2RlbC1sYWJlbCcsIHVuZGVmaW5lZCwgdGhpcy5jdXJyZW50TGFuZ3VhZ2VNb2RlbC5tZXRhZGF0YS5uYW1lKSwgLi4ucmVuZGVyTGFiZWxXaXRoSWNvbnMoYCQoY2hldnJvbi1kb3duKWApKTtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdG92ZXJyaWRlIHJlbmRlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyKGNvbnRhaW5lcik7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2NoYXQtbW9kZWxQaWNrZXItaXRlbScpO1xuXHR9XG59XG5cbmNvbnN0IGNoYXRJbnB1dEVkaXRvckNvbnRhaW5lclNlbGVjdG9yID0gJy5pbnRlcmFjdGl2ZS1pbnB1dC1lZGl0b3InO1xuc2V0dXBTaW1wbGVFZGl0b3JTZWxlY3Rpb25TdHlsaW5nKGNoYXRJbnB1dEVkaXRvckNvbnRhaW5lclNlbGVjdG9yKTtcblxuaW50ZXJmYWNlIElNb2RlUGlja2VyRGVsZWdhdGUge1xuXHRvbkRpZENoYW5nZU1vZGU6IEV2ZW50PHZvaWQ+O1xuXHRnZXRNb2RlKCk6IENoYXRNb2RlO1xufVxuXG5jbGFzcyBUb2dnbGVDaGF0TW9kZUFjdGlvblZpZXdJdGVtIGV4dGVuZHMgRHJvcGRvd25NZW51QWN0aW9uVmlld0l0ZW1XaXRoS2V5YmluZGluZyB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdGFjdGlvbjogTWVudUl0ZW1BY3Rpb24sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBkZWxlZ2F0ZTogSU1vZGVQaWNrZXJEZWxlZ2F0ZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNoYXRTZXJ2aWNlIGNoYXRTZXJ2aWNlOiBJQ2hhdFNlcnZpY2UsXG5cdFx0QElDaGF0QWdlbnRTZXJ2aWNlIGNoYXRBZ2VudFNlcnZpY2U6IElDaGF0QWdlbnRTZXJ2aWNlLFxuXHQpIHtcblx0XHRjb25zdCBtYWtlQWN0aW9uID0gKG1vZGU6IENoYXRNb2RlKTogSUFjdGlvbiA9PiAoe1xuXHRcdFx0Li4uYWN0aW9uLFxuXHRcdFx0aWQ6IG1vZGUsXG5cdFx0XHRsYWJlbDogdGhpcy5tb2RlVG9TdHJpbmcobW9kZSksXG5cdFx0XHRjbGFzczogdW5kZWZpbmVkLFxuXHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdGNoZWNrZWQ6IGRlbGVnYXRlLmdldE1vZGUoKSA9PT0gbW9kZSxcblx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBhY3Rpb24ucnVuKHsgbW9kZSB9IHNhdGlzZmllcyBJVG9nZ2xlQ2hhdE1vZGVBcmdzKTtcblx0XHRcdFx0dGhpcy5yZW5kZXJMYWJlbCh0aGlzLmVsZW1lbnQhKTtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGFjdGlvblByb3ZpZGVyOiBJQWN0aW9uUHJvdmlkZXIgPSB7XG5cdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGFnZW50U3RhdGVBY3Rpb25zID0gW1xuXHRcdFx0XHRcdG1ha2VBY3Rpb24oQ2hhdE1vZGUuRWRpdCksXG5cdFx0XHRcdF07XG5cdFx0XHRcdGlmIChjaGF0QWdlbnRTZXJ2aWNlLmhhc1Rvb2xzQWdlbnQpIHtcblx0XHRcdFx0XHRhZ2VudFN0YXRlQWN0aW9ucy5wdXNoKG1ha2VBY3Rpb24oQ2hhdE1vZGUuQWdlbnQpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChjaGF0U2VydmljZS51bmlmaWVkVmlld0VuYWJsZWQpIHtcblx0XHRcdFx0XHRhZ2VudFN0YXRlQWN0aW9ucy51bnNoaWZ0KG1ha2VBY3Rpb24oQ2hhdE1vZGUuQXNrKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gYWdlbnRTdGF0ZUFjdGlvbnM7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHN1cGVyKGFjdGlvbiwgYWN0aW9uUHJvdmlkZXIsIGNvbnRleHRNZW51U2VydmljZSwgdW5kZWZpbmVkLCBrZXliaW5kaW5nU2VydmljZSwgY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRlbGVnYXRlLm9uRGlkQ2hhbmdlTW9kZSgoKSA9PiB0aGlzLnJlbmRlckxhYmVsKHRoaXMuZWxlbWVudCEpKSk7XG5cdH1cblxuXHRwcml2YXRlIG1vZGVUb1N0cmluZyhtb2RlOiBDaGF0TW9kZSkge1xuXHRcdHN3aXRjaCAobW9kZSkge1xuXHRcdFx0Y2FzZSBDaGF0TW9kZS5BZ2VudDpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdjaGF0LmFnZW50TW9kZScsIFwiQWdlbnRcIik7XG5cdFx0XHRjYXNlIENoYXRNb2RlLkVkaXQ6XG5cdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgnY2hhdC5ub3JtYWxNb2RlJywgXCJFZGl0XCIpO1xuXHRcdFx0Y2FzZSBDaGF0TW9kZS5Bc2s6XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ2NoYXQuYXNrTW9kZScsIFwiQXNrXCIpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZW5kZXJMYWJlbChlbGVtZW50OiBIVE1MRWxlbWVudCk6IElEaXNwb3NhYmxlIHwgbnVsbCB7XG5cdFx0Ly8gQ2FuJ3QgY2FsbCBzdXBlci5yZW5kZXJMYWJlbCBiZWNhdXNlIGl0IGhhcyBhIGhhY2sgb2YgZm9yY2luZyB0aGUgJ2NvZGljb24nIGNsYXNzXG5cdFx0dGhpcy5zZXRBcmlhTGFiZWxBdHRyaWJ1dGVzKGVsZW1lbnQpO1xuXG5cdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLm1vZGVUb1N0cmluZyh0aGlzLmRlbGVnYXRlLmdldE1vZGUoKSk7XG5cdFx0ZG9tLnJlc2V0KGVsZW1lbnQsIGRvbS4kKCdzcGFuLmNoYXQtbW9kZWwtbGFiZWwnLCB1bmRlZmluZWQsIHN0YXRlKSwgLi4ucmVuZGVyTGFiZWxXaXRoSWNvbnMoYCQoY2hldnJvbi1kb3duKWApKTtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdG92ZXJyaWRlIHJlbmRlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyKGNvbnRhaW5lcik7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2NoYXQtbW9kZWxQaWNrZXItaXRlbScpO1xuXHR9XG59XG5cbmNsYXNzIEFkZEZpbGVzQnV0dG9uIGV4dGVuZHMgQWN0aW9uVmlld0l0ZW0ge1xuXHRjb25zdHJ1Y3Rvcihjb250ZXh0OiB1bmtub3duLCBhY3Rpb246IElBY3Rpb24sIG9wdGlvbnM6IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMpIHtcblx0XHRzdXBlcihjb250ZXh0LCBhY3Rpb24sIG9wdGlvbnMpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXIoY29udGFpbmVyKTtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnY2hhdC1hdHRhY2hlZC1jb250ZXh0LWF0dGFjaG1lbnQnLCAnY2hhdC1hZGQtZmlsZXMnKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywyQkFBMkI7QUFFcEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxzQkFBOEM7QUFDdkQsWUFBWSxVQUFVO0FBQ3RCLFNBQVMsY0FBYztBQUV2QixTQUFTLDRCQUE0QiwrQkFBK0I7QUFDcEUsU0FBUyw0QkFBNEI7QUFDckMsU0FBa0IsV0FBVyxnQkFBcUY7QUFDbEgsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWSxpQkFBOEIsbUJBQW1CLG9CQUFvQjtBQUMxRixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLFdBQVc7QUFFcEIsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxxQkFB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WSxTQUEwQztBQUV4RSxTQUFLLHVCQUF1QixPQUFPO0FBRW5DLFVBQU0sUUFBUSxLQUFLLGFBQWEsS0FBSyxTQUFTLFFBQVEsQ0FBQztBQUN2RCxRQUFJLE1BQU0sU0FBUyxJQUFJLEVBQUUseUJBQXlCLFFBQVcsS0FBSyxHQUFHLEdBQUcscUJBQXFCLGlCQUFpQixDQUFDO0FBQy9HLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUyxPQUFPLFdBQThCO0FBQzdDLFVBQU0sT0FBTyxTQUFTO0FBQ3RCLGNBQVUsVUFBVSxJQUFJLHVCQUF1QjtBQUFBLEVBQ2hEO0FBQ0Q7QUF0RU0sK0JBQU47QUFBQSxFQUlHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBUkc7QUF3RU4sTUFBTSx1QkFBdUIsZUFBZTtBQUFBLEVBQzNDLFlBQVksU0FBa0IsUUFBaUIsU0FBaUM7QUFDL0UsVUFBTSxTQUFTLFFBQVEsT0FBTztBQUFBLEVBQy9CO0FBQUEsRUFFUyxPQUFPLFdBQThCO0FBQzdDLFVBQU0sT0FBTyxTQUFTO0FBQ3RCLGNBQVUsVUFBVSxJQUFJLG9DQUFvQyxnQkFBZ0I7QUFBQSxFQUM3RTtBQUNEOyIsCiAgIm5hbWVzIjogWyJtb2RlbCIsICJvcHRpb25zIiwgImxpc3QiLCAiYWN0aW9uIl0KfQo=
