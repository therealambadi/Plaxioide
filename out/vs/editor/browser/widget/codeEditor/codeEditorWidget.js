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
import "../../services/markerDecorations.js";
import * as dom from "../../../../base/browser/dom.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter, createEventDeliveryQueue } from "../../../../base/common/event.js";
import { hash } from "../../../../base/common/hash.js";
import { Disposable, dispose } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import "./editor.css";
import { applyFontInfo } from "../../config/domFontInfo.js";
import { EditorConfiguration } from "../../config/editorConfiguration.js";
import { TabFocus } from "../../config/tabFocus.js";
import { EditorExtensionsRegistry } from "../../editorExtensions.js";
import { ICodeEditorService } from "../../services/codeEditorService.js";
import { View } from "../../view.js";
import { DOMLineBreaksComputerFactory } from "../../view/domLineBreaksComputer.js";
import { ViewUserInputEvents } from "../../view/viewUserInputEvents.js";
import { CodeEditorContributions } from "./codeEditorContributions.js";
import { EditorOption, filterValidationDecorations } from "../../../common/config/editorOptions.js";
import { CursorColumns } from "../../../common/core/cursorColumns.js";
import { editorUnnecessaryCodeOpacity } from "../../../common/core/editorColorRegistry.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { WordOperations } from "../../../common/cursor/cursorWordOperations.js";
import { CursorChangeReason } from "../../../common/cursorEvents.js";
import { InternalEditorAction } from "../../../common/editorAction.js";
import * as editorCommon from "../../../common/editorCommon.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { EndOfLinePreference } from "../../../common/model.js";
import { ClassName } from "../../../common/model/intervalTree.js";
import { ModelDecorationOptions } from "../../../common/model/textModel.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { VerticalRevealType } from "../../../common/viewEvents.js";
import { MonospaceLineBreaksComputerFactory } from "../../../common/viewModel/monospaceLineBreaksComputer.js";
import { ViewModel } from "../../../common/viewModel/viewModelImpl.js";
import { OutgoingViewModelEventKind } from "../../../common/viewModelEventDispatcher.js";
import * as nls from "../../../../nls.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { editorErrorForeground, editorHintForeground, editorInfoForeground, editorWarningForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService, registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
let CodeEditorWidget = class extends Disposable {
  constructor(domElement, _options, codeEditorWidgetOptions, instantiationService, codeEditorService, commandService, contextKeyService, themeService, notificationService, accessibilityService, languageConfigurationService, languageFeaturesService) {
    super();
    this.languageConfigurationService = languageConfigurationService;
    //#region Eventing
    this._deliveryQueue = createEventDeliveryQueue();
    this._contributions = this._register(new CodeEditorContributions());
    this._onDidDispose = this._register(new Emitter());
    this.onDidDispose = this._onDidDispose.event;
    this._onDidChangeModelContent = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidChangeModelContent = this._onDidChangeModelContent.event;
    this._onDidChangeModelLanguage = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidChangeModelLanguage = this._onDidChangeModelLanguage.event;
    this._onDidChangeModelLanguageConfiguration = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidChangeModelLanguageConfiguration = this._onDidChangeModelLanguageConfiguration.event;
    this._onDidChangeModelOptions = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidChangeModelOptions = this._onDidChangeModelOptions.event;
    this._onDidChangeModelDecorations = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidChangeModelDecorations = this._onDidChangeModelDecorations.event;
    this._onDidChangeModelTokens = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidChangeModelTokens = this._onDidChangeModelTokens.event;
    this._onDidChangeConfiguration = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
    this._onWillChangeModel = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onWillChangeModel = this._onWillChangeModel.event;
    this._onDidChangeModel = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidChangeModel = this._onDidChangeModel.event;
    this._onDidChangeCursorPosition = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidChangeCursorPosition = this._onDidChangeCursorPosition.event;
    this._onDidChangeCursorSelection = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidChangeCursorSelection = this._onDidChangeCursorSelection.event;
    this._onDidAttemptReadOnlyEdit = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onDidAttemptReadOnlyEdit = this._onDidAttemptReadOnlyEdit.event;
    this._onDidLayoutChange = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidLayoutChange = this._onDidLayoutChange.event;
    this._editorTextFocus = this._register(new BooleanEventEmitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidFocusEditorText = this._editorTextFocus.onDidChangeToTrue;
    this.onDidBlurEditorText = this._editorTextFocus.onDidChangeToFalse;
    this._editorWidgetFocus = this._register(new BooleanEventEmitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidFocusEditorWidget = this._editorWidgetFocus.onDidChangeToTrue;
    this.onDidBlurEditorWidget = this._editorWidgetFocus.onDidChangeToFalse;
    this._onWillType = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onWillType = this._onWillType.event;
    this._onDidType = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onDidType = this._onDidType.event;
    this._onDidCompositionStart = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onDidCompositionStart = this._onDidCompositionStart.event;
    this._onDidCompositionEnd = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onDidCompositionEnd = this._onDidCompositionEnd.event;
    this._onDidPaste = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onDidPaste = this._onDidPaste.event;
    this._onMouseUp = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onMouseUp = this._onMouseUp.event;
    this._onMouseDown = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onMouseDown = this._onMouseDown.event;
    this._onMouseDrag = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onMouseDrag = this._onMouseDrag.event;
    this._onMouseDrop = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onMouseDrop = this._onMouseDrop.event;
    this._onMouseDropCanceled = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onMouseDropCanceled = this._onMouseDropCanceled.event;
    this._onDropIntoEditor = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onDropIntoEditor = this._onDropIntoEditor.event;
    this._onContextMenu = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onContextMenu = this._onContextMenu.event;
    this._onMouseMove = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onMouseMove = this._onMouseMove.event;
    this._onMouseLeave = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onMouseLeave = this._onMouseLeave.event;
    this._onMouseWheel = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onMouseWheel = this._onMouseWheel.event;
    this._onKeyUp = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onKeyUp = this._onKeyUp.event;
    this._onKeyDown = this._register(new InteractionEmitter(this._contributions, this._deliveryQueue));
    this.onKeyDown = this._onKeyDown.event;
    this._onDidContentSizeChange = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidContentSizeChange = this._onDidContentSizeChange.event;
    this._onDidScrollChange = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidScrollChange = this._onDidScrollChange.event;
    this._onDidChangeViewZones = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidChangeViewZones = this._onDidChangeViewZones.event;
    this._onDidChangeHiddenAreas = this._register(new Emitter({ deliveryQueue: this._deliveryQueue }));
    this.onDidChangeHiddenAreas = this._onDidChangeHiddenAreas.event;
    this._updateCounter = 0;
    this._onWillTriggerEditorOperationEvent = this._register(new Emitter());
    this.onWillTriggerEditorOperationEvent = this._onWillTriggerEditorOperationEvent.event;
    this._onBeginUpdate = this._register(new Emitter());
    this.onBeginUpdate = this._onBeginUpdate.event;
    this._onEndUpdate = this._register(new Emitter());
    this.onEndUpdate = this._onEndUpdate.event;
    this._onBeforeExecuteEdit = this._register(new Emitter());
    this.onBeforeExecuteEdit = this._onBeforeExecuteEdit.event;
    this._actions = /* @__PURE__ */ new Map();
    this._bannerDomNode = null;
    this._dropIntoEditorDecorations = this.createDecorationsCollection();
    this.inComposition = false;
    codeEditorService.willCreateCodeEditor();
    const options = { ..._options };
    this._domElement = domElement;
    this._overflowWidgetsDomNode = options.overflowWidgetsDomNode;
    delete options.overflowWidgetsDomNode;
    this._id = ++EDITOR_ID;
    this._decorationTypeKeysToIds = {};
    this._decorationTypeSubtypes = {};
    this._telemetryData = codeEditorWidgetOptions.telemetryData;
    this._configuration = this._register(this._createConfiguration(
      codeEditorWidgetOptions.isSimpleWidget || false,
      codeEditorWidgetOptions.contextMenuId ?? (codeEditorWidgetOptions.isSimpleWidget ? MenuId.SimpleEditorContext : MenuId.EditorContext),
      options,
      accessibilityService
    ));
    this._register(this._configuration.onDidChange((e) => {
      this._onDidChangeConfiguration.fire(e);
      const options2 = this._configuration.options;
      if (e.hasChanged(EditorOption.layoutInfo)) {
        const layoutInfo = options2.get(EditorOption.layoutInfo);
        this._onDidLayoutChange.fire(layoutInfo);
      }
    }));
    this._contextKeyService = this._register(contextKeyService.createScoped(this._domElement));
    if (codeEditorWidgetOptions.contextKeyValues) {
      for (const [key, value] of Object.entries(codeEditorWidgetOptions.contextKeyValues)) {
        this._contextKeyService.createKey(key, value);
      }
    }
    this._notificationService = notificationService;
    this._codeEditorService = codeEditorService;
    this._commandService = commandService;
    this._themeService = themeService;
    this._register(new EditorContextKeysManager(this, this._contextKeyService));
    this._register(new EditorModeContext(this, this._contextKeyService, languageFeaturesService));
    this._instantiationService = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, this._contextKeyService])));
    this._modelData = null;
    this._contentWidgets = {};
    this._overlayWidgets = {};
    this._glyphMarginWidgets = {};
    let contributions;
    if (Array.isArray(codeEditorWidgetOptions.contributions)) {
      contributions = codeEditorWidgetOptions.contributions;
    } else {
      contributions = EditorExtensionsRegistry.getEditorContributions();
    }
    this._contributions.initialize(this, contributions, this._instantiationService);
    for (const action of EditorExtensionsRegistry.getEditorActions()) {
      if (this._actions.has(action.id)) {
        onUnexpectedError(new Error(`Cannot have two actions with the same id ${action.id}`));
        continue;
      }
      const internalAction = new InternalEditorAction(
        action.id,
        action.label,
        action.alias,
        action.metadata,
        action.precondition ?? void 0,
        (args) => {
          return this._instantiationService.invokeFunction((accessor) => {
            return Promise.resolve(action.runEditorCommand(accessor, this, args));
          });
        },
        this._contextKeyService
      );
      this._actions.set(internalAction.id, internalAction);
    }
    const isDropIntoEnabled = () => {
      return !this._configuration.options.get(EditorOption.readOnly) && this._configuration.options.get(EditorOption.dropIntoEditor).enabled;
    };
    this._register(new dom.DragAndDropObserver(this._domElement, {
      onDragOver: (e) => {
        if (!isDropIntoEnabled()) {
          return;
        }
        const target = this.getTargetAtClientPoint(e.clientX, e.clientY);
        if (target?.position) {
          this.showDropIndicatorAt(target.position);
        }
      },
      onDrop: async (e) => {
        if (!isDropIntoEnabled()) {
          return;
        }
        this.removeDropIndicator();
        if (!e.dataTransfer) {
          return;
        }
        const target = this.getTargetAtClientPoint(e.clientX, e.clientY);
        if (target?.position) {
          this._onDropIntoEditor.fire({ position: target.position, event: e });
        }
      },
      onDragLeave: () => {
        this.removeDropIndicator();
      },
      onDragEnd: () => {
        this.removeDropIndicator();
      }
    }));
    this._codeEditorService.addCodeEditor(this);
  }
  //#endregion
  get isSimpleWidget() {
    return this._configuration.isSimpleWidget;
  }
  get contextMenuId() {
    return this._configuration.contextMenuId;
  }
  get contextKeyService() {
    return this._contextKeyService;
  }
  writeScreenReaderContent(reason) {
    this._modelData?.view.writeScreenReaderContent(reason);
  }
  _createConfiguration(isSimpleWidget, contextMenuId, options, accessibilityService) {
    return new EditorConfiguration(isSimpleWidget, contextMenuId, options, this._domElement, accessibilityService);
  }
  getId() {
    return this.getEditorType() + ":" + this._id;
  }
  getEditorType() {
    return editorCommon.EditorType.ICodeEditor;
  }
  dispose() {
    this._codeEditorService.removeCodeEditor(this);
    this._actions.clear();
    this._contentWidgets = {};
    this._overlayWidgets = {};
    this._removeDecorationTypes();
    this._postDetachModelCleanup(this._detachModel());
    this._onDidDispose.fire();
    super.dispose();
  }
  invokeWithinContext(fn) {
    return this._instantiationService.invokeFunction(fn);
  }
  updateOptions(newOptions) {
    this._configuration.updateOptions(newOptions || {});
  }
  getOptions() {
    return this._configuration.options;
  }
  getOption(id) {
    return this._configuration.options.get(id);
  }
  getRawOptions() {
    return this._configuration.getRawOptions();
  }
  getOverflowWidgetsDomNode() {
    return this._overflowWidgetsDomNode;
  }
  getConfiguredWordAtPosition(position) {
    if (!this._modelData) {
      return null;
    }
    return WordOperations.getWordAtPosition(this._modelData.model, this._configuration.options.get(EditorOption.wordSeparators), this._configuration.options.get(EditorOption.wordSegmenterLocales), position);
  }
  getValue(options = null) {
    if (!this._modelData) {
      return "";
    }
    const preserveBOM = options && options.preserveBOM ? true : false;
    let eolPreference = EndOfLinePreference.TextDefined;
    if (options && options.lineEnding && options.lineEnding === "\n") {
      eolPreference = EndOfLinePreference.LF;
    } else if (options && options.lineEnding && options.lineEnding === "\r\n") {
      eolPreference = EndOfLinePreference.CRLF;
    }
    return this._modelData.model.getValue(eolPreference, preserveBOM);
  }
  setValue(newValue) {
    try {
      this._beginUpdate();
      if (!this._modelData) {
        return;
      }
      this._modelData.model.setValue(newValue);
    } finally {
      this._endUpdate();
    }
  }
  getModel() {
    if (!this._modelData) {
      return null;
    }
    return this._modelData.model;
  }
  setModel(_model = null) {
    try {
      this._beginUpdate();
      const model = _model;
      if (this._modelData === null && model === null) {
        return;
      }
      if (this._modelData && this._modelData.model === model) {
        return;
      }
      const e = {
        oldModelUrl: this._modelData?.model.uri || null,
        newModelUrl: model?.uri || null
      };
      this._onWillChangeModel.fire(e);
      const hasTextFocus = this.hasTextFocus();
      const detachedModel = this._detachModel();
      this._attachModel(model);
      if (this.hasModel()) {
        if (hasTextFocus) {
          this.focus();
        }
      } else {
        this._editorTextFocus.setValue(false);
        this._editorWidgetFocus.setValue(false);
      }
      this._removeDecorationTypes();
      this._onDidChangeModel.fire(e);
      this._postDetachModelCleanup(detachedModel);
      this._contributionsDisposable = this._contributions.onAfterModelAttached();
    } finally {
      this._endUpdate();
    }
  }
  _removeDecorationTypes() {
    this._decorationTypeKeysToIds = {};
    if (this._decorationTypeSubtypes) {
      for (const decorationType in this._decorationTypeSubtypes) {
        const subTypes = this._decorationTypeSubtypes[decorationType];
        for (const subType in subTypes) {
          this._removeDecorationType(decorationType + "-" + subType);
        }
      }
      this._decorationTypeSubtypes = {};
    }
  }
  getVisibleRanges() {
    if (!this._modelData) {
      return [];
    }
    return this._modelData.viewModel.getVisibleRanges();
  }
  getVisibleRangesPlusViewportAboveBelow() {
    if (!this._modelData) {
      return [];
    }
    return this._modelData.viewModel.getVisibleRangesPlusViewportAboveBelow();
  }
  getWhitespaces() {
    if (!this._modelData) {
      return [];
    }
    return this._modelData.viewModel.viewLayout.getWhitespaces();
  }
  static _getVerticalOffsetAfterPosition(modelData, modelLineNumber, modelColumn, includeViewZones) {
    const modelPosition = modelData.model.validatePosition({
      lineNumber: modelLineNumber,
      column: modelColumn
    });
    const viewPosition = modelData.viewModel.coordinatesConverter.convertModelPositionToViewPosition(modelPosition);
    return modelData.viewModel.viewLayout.getVerticalOffsetAfterLineNumber(viewPosition.lineNumber, includeViewZones);
  }
  getTopForLineNumber(lineNumber, includeViewZones = false) {
    if (!this._modelData) {
      return -1;
    }
    return CodeEditorWidget._getVerticalOffsetForPosition(this._modelData, lineNumber, 1, includeViewZones);
  }
  getTopForPosition(lineNumber, column) {
    if (!this._modelData) {
      return -1;
    }
    return CodeEditorWidget._getVerticalOffsetForPosition(this._modelData, lineNumber, column, false);
  }
  static _getVerticalOffsetForPosition(modelData, modelLineNumber, modelColumn, includeViewZones = false) {
    const modelPosition = modelData.model.validatePosition({
      lineNumber: modelLineNumber,
      column: modelColumn
    });
    const viewPosition = modelData.viewModel.coordinatesConverter.convertModelPositionToViewPosition(modelPosition);
    return modelData.viewModel.viewLayout.getVerticalOffsetForLineNumber(viewPosition.lineNumber, includeViewZones);
  }
  getBottomForLineNumber(lineNumber, includeViewZones = false) {
    if (!this._modelData) {
      return -1;
    }
    const maxCol = this._modelData.model.getLineMaxColumn(lineNumber);
    return CodeEditorWidget._getVerticalOffsetAfterPosition(this._modelData, lineNumber, maxCol, includeViewZones);
  }
  setHiddenAreas(ranges, source, forceUpdate) {
    this._modelData?.viewModel.setHiddenAreas(ranges.map((r) => Range.lift(r)), source, forceUpdate);
  }
  getVisibleColumnFromPosition(rawPosition) {
    if (!this._modelData) {
      return rawPosition.column;
    }
    const position = this._modelData.model.validatePosition(rawPosition);
    const tabSize = this._modelData.model.getOptions().tabSize;
    return CursorColumns.visibleColumnFromColumn(this._modelData.model.getLineContent(position.lineNumber), position.column, tabSize) + 1;
  }
  getStatusbarColumn(rawPosition) {
    if (!this._modelData) {
      return rawPosition.column;
    }
    const position = this._modelData.model.validatePosition(rawPosition);
    const tabSize = this._modelData.model.getOptions().tabSize;
    return CursorColumns.toStatusbarColumn(this._modelData.model.getLineContent(position.lineNumber), position.column, tabSize);
  }
  getPosition() {
    if (!this._modelData) {
      return null;
    }
    return this._modelData.viewModel.getPosition();
  }
  setPosition(position, source = "api") {
    if (!this._modelData) {
      return;
    }
    if (!Position.isIPosition(position)) {
      throw new Error("Invalid arguments");
    }
    this._modelData.viewModel.setSelections(source, [{
      selectionStartLineNumber: position.lineNumber,
      selectionStartColumn: position.column,
      positionLineNumber: position.lineNumber,
      positionColumn: position.column
    }]);
  }
  _sendRevealRange(modelRange, verticalType, revealHorizontal, scrollType) {
    if (!this._modelData) {
      return;
    }
    if (!Range.isIRange(modelRange)) {
      throw new Error("Invalid arguments");
    }
    const validatedModelRange = this._modelData.model.validateRange(modelRange);
    const viewRange = this._modelData.viewModel.coordinatesConverter.convertModelRangeToViewRange(validatedModelRange);
    this._modelData.viewModel.revealRange("api", revealHorizontal, viewRange, verticalType, scrollType);
  }
  revealLine(lineNumber, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealLine(lineNumber, VerticalRevealType.Simple, scrollType);
  }
  revealLineInCenter(lineNumber, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealLine(lineNumber, VerticalRevealType.Center, scrollType);
  }
  revealLineInCenterIfOutsideViewport(lineNumber, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealLine(lineNumber, VerticalRevealType.CenterIfOutsideViewport, scrollType);
  }
  revealLineNearTop(lineNumber, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealLine(lineNumber, VerticalRevealType.NearTop, scrollType);
  }
  _revealLine(lineNumber, revealType, scrollType) {
    if (typeof lineNumber !== "number") {
      throw new Error("Invalid arguments");
    }
    this._sendRevealRange(
      new Range(lineNumber, 1, lineNumber, 1),
      revealType,
      false,
      scrollType
    );
  }
  revealPosition(position, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealPosition(
      position,
      VerticalRevealType.Simple,
      true,
      scrollType
    );
  }
  revealPositionInCenter(position, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealPosition(
      position,
      VerticalRevealType.Center,
      true,
      scrollType
    );
  }
  revealPositionInCenterIfOutsideViewport(position, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealPosition(
      position,
      VerticalRevealType.CenterIfOutsideViewport,
      true,
      scrollType
    );
  }
  revealPositionNearTop(position, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealPosition(
      position,
      VerticalRevealType.NearTop,
      true,
      scrollType
    );
  }
  _revealPosition(position, verticalType, revealHorizontal, scrollType) {
    if (!Position.isIPosition(position)) {
      throw new Error("Invalid arguments");
    }
    this._sendRevealRange(
      new Range(position.lineNumber, position.column, position.lineNumber, position.column),
      verticalType,
      revealHorizontal,
      scrollType
    );
  }
  getSelection() {
    if (!this._modelData) {
      return null;
    }
    return this._modelData.viewModel.getSelection();
  }
  getSelections() {
    if (!this._modelData) {
      return null;
    }
    return this._modelData.viewModel.getSelections();
  }
  setSelection(something, source = "api") {
    const isSelection = Selection.isISelection(something);
    const isRange = Range.isIRange(something);
    if (!isSelection && !isRange) {
      throw new Error("Invalid arguments");
    }
    if (isSelection) {
      this._setSelectionImpl(something, source);
    } else if (isRange) {
      const selection = {
        selectionStartLineNumber: something.startLineNumber,
        selectionStartColumn: something.startColumn,
        positionLineNumber: something.endLineNumber,
        positionColumn: something.endColumn
      };
      this._setSelectionImpl(selection, source);
    }
  }
  _setSelectionImpl(sel, source) {
    if (!this._modelData) {
      return;
    }
    const selection = new Selection(sel.selectionStartLineNumber, sel.selectionStartColumn, sel.positionLineNumber, sel.positionColumn);
    this._modelData.viewModel.setSelections(source, [selection]);
  }
  revealLines(startLineNumber, endLineNumber, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealLines(
      startLineNumber,
      endLineNumber,
      VerticalRevealType.Simple,
      scrollType
    );
  }
  revealLinesInCenter(startLineNumber, endLineNumber, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealLines(
      startLineNumber,
      endLineNumber,
      VerticalRevealType.Center,
      scrollType
    );
  }
  revealLinesInCenterIfOutsideViewport(startLineNumber, endLineNumber, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealLines(
      startLineNumber,
      endLineNumber,
      VerticalRevealType.CenterIfOutsideViewport,
      scrollType
    );
  }
  revealLinesNearTop(startLineNumber, endLineNumber, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealLines(
      startLineNumber,
      endLineNumber,
      VerticalRevealType.NearTop,
      scrollType
    );
  }
  _revealLines(startLineNumber, endLineNumber, verticalType, scrollType) {
    if (typeof startLineNumber !== "number" || typeof endLineNumber !== "number") {
      throw new Error("Invalid arguments");
    }
    this._sendRevealRange(
      new Range(startLineNumber, 1, endLineNumber, 1),
      verticalType,
      false,
      scrollType
    );
  }
  revealRange(range, scrollType = editorCommon.ScrollType.Smooth, revealVerticalInCenter = false, revealHorizontal = true) {
    this._revealRange(
      range,
      revealVerticalInCenter ? VerticalRevealType.Center : VerticalRevealType.Simple,
      revealHorizontal,
      scrollType
    );
  }
  revealRangeInCenter(range, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealRange(
      range,
      VerticalRevealType.Center,
      true,
      scrollType
    );
  }
  revealRangeInCenterIfOutsideViewport(range, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealRange(
      range,
      VerticalRevealType.CenterIfOutsideViewport,
      true,
      scrollType
    );
  }
  revealRangeNearTop(range, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealRange(
      range,
      VerticalRevealType.NearTop,
      true,
      scrollType
    );
  }
  revealRangeNearTopIfOutsideViewport(range, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealRange(
      range,
      VerticalRevealType.NearTopIfOutsideViewport,
      true,
      scrollType
    );
  }
  revealRangeAtTop(range, scrollType = editorCommon.ScrollType.Smooth) {
    this._revealRange(
      range,
      VerticalRevealType.Top,
      true,
      scrollType
    );
  }
  _revealRange(range, verticalType, revealHorizontal, scrollType) {
    if (!Range.isIRange(range)) {
      throw new Error("Invalid arguments");
    }
    this._sendRevealRange(
      Range.lift(range),
      verticalType,
      revealHorizontal,
      scrollType
    );
  }
  setSelections(ranges, source = "api", reason = CursorChangeReason.NotSet) {
    if (!this._modelData) {
      return;
    }
    if (!ranges || ranges.length === 0) {
      throw new Error("Invalid arguments");
    }
    for (let i = 0, len = ranges.length; i < len; i++) {
      if (!Selection.isISelection(ranges[i])) {
        throw new Error("Invalid arguments");
      }
    }
    this._modelData.viewModel.setSelections(source, ranges, reason);
  }
  getContentWidth() {
    if (!this._modelData) {
      return -1;
    }
    return this._modelData.viewModel.viewLayout.getContentWidth();
  }
  getScrollWidth() {
    if (!this._modelData) {
      return -1;
    }
    return this._modelData.viewModel.viewLayout.getScrollWidth();
  }
  getScrollLeft() {
    if (!this._modelData) {
      return -1;
    }
    return this._modelData.viewModel.viewLayout.getCurrentScrollLeft();
  }
  getContentHeight() {
    if (!this._modelData) {
      return -1;
    }
    return this._modelData.viewModel.viewLayout.getContentHeight();
  }
  getScrollHeight() {
    if (!this._modelData) {
      return -1;
    }
    return this._modelData.viewModel.viewLayout.getScrollHeight();
  }
  getScrollTop() {
    if (!this._modelData) {
      return -1;
    }
    return this._modelData.viewModel.viewLayout.getCurrentScrollTop();
  }
  setScrollLeft(newScrollLeft, scrollType = editorCommon.ScrollType.Immediate) {
    if (!this._modelData) {
      return;
    }
    if (typeof newScrollLeft !== "number") {
      throw new Error("Invalid arguments");
    }
    this._modelData.viewModel.viewLayout.setScrollPosition({
      scrollLeft: newScrollLeft
    }, scrollType);
  }
  setScrollTop(newScrollTop, scrollType = editorCommon.ScrollType.Immediate) {
    if (!this._modelData) {
      return;
    }
    if (typeof newScrollTop !== "number") {
      throw new Error("Invalid arguments");
    }
    this._modelData.viewModel.viewLayout.setScrollPosition({
      scrollTop: newScrollTop
    }, scrollType);
  }
  setScrollPosition(position, scrollType = editorCommon.ScrollType.Immediate) {
    if (!this._modelData) {
      return;
    }
    this._modelData.viewModel.viewLayout.setScrollPosition(position, scrollType);
  }
  hasPendingScrollAnimation() {
    if (!this._modelData) {
      return false;
    }
    return this._modelData.viewModel.viewLayout.hasPendingScrollAnimation();
  }
  saveViewState() {
    if (!this._modelData) {
      return null;
    }
    const contributionsState = this._contributions.saveViewState();
    const cursorState = this._modelData.viewModel.saveCursorState();
    const viewState = this._modelData.viewModel.saveState();
    return {
      cursorState,
      viewState,
      contributionsState
    };
  }
  restoreViewState(s) {
    if (!this._modelData || !this._modelData.hasRealView) {
      return;
    }
    const codeEditorState = s;
    if (codeEditorState && codeEditorState.cursorState && codeEditorState.viewState) {
      const cursorState = codeEditorState.cursorState;
      if (Array.isArray(cursorState)) {
        if (cursorState.length > 0) {
          this._modelData.viewModel.restoreCursorState(cursorState);
        }
      } else {
        this._modelData.viewModel.restoreCursorState([cursorState]);
      }
      this._contributions.restoreViewState(codeEditorState.contributionsState || {});
      const reducedState = this._modelData.viewModel.reduceRestoreState(codeEditorState.viewState);
      this._modelData.view.restoreState(reducedState);
    }
  }
  handleInitialized() {
    this._getViewModel()?.visibleLinesStabilized();
  }
  onVisible() {
    this._modelData?.view.refreshFocusState();
  }
  onHide() {
    this._modelData?.view.refreshFocusState();
  }
  getContribution(id) {
    return this._contributions.get(id);
  }
  getActions() {
    return Array.from(this._actions.values());
  }
  getSupportedActions() {
    let result = this.getActions();
    result = result.filter((action) => action.isSupported());
    return result;
  }
  getAction(id) {
    return this._actions.get(id) || null;
  }
  trigger(source, handlerId, payload) {
    payload = payload || {};
    try {
      this._onWillTriggerEditorOperationEvent.fire({ source, handlerId, payload });
      this._beginUpdate();
      switch (handlerId) {
        case editorCommon.Handler.CompositionStart:
          this._startComposition();
          return;
        case editorCommon.Handler.CompositionEnd:
          this._endComposition(source);
          return;
        case editorCommon.Handler.Type: {
          const args = payload;
          this._type(source, args.text || "");
          return;
        }
        case editorCommon.Handler.ReplacePreviousChar: {
          const args = payload;
          this._compositionType(source, args.text || "", args.replaceCharCnt || 0, 0, 0);
          return;
        }
        case editorCommon.Handler.CompositionType: {
          const args = payload;
          this._compositionType(source, args.text || "", args.replacePrevCharCnt || 0, args.replaceNextCharCnt || 0, args.positionDelta || 0);
          return;
        }
        case editorCommon.Handler.Paste: {
          const args = payload;
          this._paste(source, args.text || "", args.pasteOnNewLine || false, args.multicursorText || null, args.mode || null, args.clipboardEvent);
          return;
        }
        case editorCommon.Handler.Cut:
          this._cut(source);
          return;
      }
      const action = this.getAction(handlerId);
      if (action) {
        Promise.resolve(action.run(payload)).then(void 0, onUnexpectedError);
        return;
      }
      if (!this._modelData) {
        return;
      }
      if (this._triggerEditorCommand(source, handlerId, payload)) {
        return;
      }
      this._triggerCommand(handlerId, payload);
    } finally {
      this._endUpdate();
    }
  }
  _triggerCommand(handlerId, payload) {
    this._commandService.executeCommand(handlerId, payload);
  }
  _startComposition() {
    if (!this._modelData) {
      return;
    }
    this.inComposition = true;
    this._modelData.viewModel.startComposition();
    this._onDidCompositionStart.fire();
  }
  _endComposition(source) {
    if (!this._modelData) {
      return;
    }
    this.inComposition = false;
    this._modelData.viewModel.endComposition(source);
    this._onDidCompositionEnd.fire();
  }
  _type(source, text) {
    if (!this._modelData || text.length === 0) {
      return;
    }
    if (source === "keyboard") {
      this._onWillType.fire(text);
    }
    this._modelData.viewModel.type(text, source);
    if (source === "keyboard") {
      this._onDidType.fire(text);
    }
  }
  _compositionType(source, text, replacePrevCharCnt, replaceNextCharCnt, positionDelta) {
    if (!this._modelData) {
      return;
    }
    this._modelData.viewModel.compositionType(text, replacePrevCharCnt, replaceNextCharCnt, positionDelta, source);
  }
  _paste(source, text, pasteOnNewLine, multicursorText, mode, clipboardEvent) {
    if (!this._modelData) {
      return;
    }
    const viewModel = this._modelData.viewModel;
    const startPosition = viewModel.getSelection().getStartPosition();
    viewModel.paste(text, pasteOnNewLine, multicursorText, source);
    const endPosition = viewModel.getSelection().getStartPosition();
    if (source === "keyboard") {
      this._onDidPaste.fire({
        clipboardEvent,
        range: new Range(startPosition.lineNumber, startPosition.column, endPosition.lineNumber, endPosition.column),
        languageId: mode
      });
    }
  }
  _cut(source) {
    if (!this._modelData) {
      return;
    }
    this._modelData.viewModel.cut(source);
  }
  _triggerEditorCommand(source, handlerId, payload) {
    const command = EditorExtensionsRegistry.getEditorCommand(handlerId);
    if (command) {
      payload = payload || {};
      payload.source = source;
      this._instantiationService.invokeFunction((accessor) => {
        Promise.resolve(command.runEditorCommand(accessor, this, payload)).then(void 0, onUnexpectedError);
      });
      return true;
    }
    return false;
  }
  _getViewModel() {
    if (!this._modelData) {
      return null;
    }
    return this._modelData.viewModel;
  }
  pushUndoStop() {
    if (!this._modelData) {
      return false;
    }
    if (this._configuration.options.get(EditorOption.readOnly)) {
      return false;
    }
    this._modelData.model.pushStackElement();
    return true;
  }
  popUndoStop() {
    if (!this._modelData) {
      return false;
    }
    if (this._configuration.options.get(EditorOption.readOnly)) {
      return false;
    }
    this._modelData.model.popStackElement();
    return true;
  }
  executeEdits(source, edits, endCursorState) {
    if (!this._modelData) {
      return false;
    }
    if (this._configuration.options.get(EditorOption.readOnly)) {
      return false;
    }
    let cursorStateComputer;
    if (!endCursorState) {
      cursorStateComputer = () => null;
    } else if (Array.isArray(endCursorState)) {
      cursorStateComputer = () => endCursorState;
    } else {
      cursorStateComputer = endCursorState;
    }
    this._onBeforeExecuteEdit.fire({ source: source ?? void 0 });
    this._modelData.viewModel.executeEdits(source, edits, cursorStateComputer);
    return true;
  }
  executeCommand(source, command) {
    if (!this._modelData) {
      return;
    }
    this._modelData.viewModel.executeCommand(command, source);
  }
  executeCommands(source, commands) {
    if (!this._modelData) {
      return;
    }
    this._modelData.viewModel.executeCommands(commands, source);
  }
  createDecorationsCollection(decorations) {
    return new EditorDecorationsCollection(this, decorations);
  }
  changeDecorations(callback) {
    if (!this._modelData) {
      return null;
    }
    return this._modelData.model.changeDecorations(callback, this._id);
  }
  getLineDecorations(lineNumber) {
    if (!this._modelData) {
      return null;
    }
    return this._modelData.model.getLineDecorations(lineNumber, this._id, filterValidationDecorations(this._configuration.options));
  }
  getDecorationsInRange(range) {
    if (!this._modelData) {
      return null;
    }
    return this._modelData.model.getDecorationsInRange(range, this._id, filterValidationDecorations(this._configuration.options));
  }
  /**
   * @deprecated
   */
  deltaDecorations(oldDecorations, newDecorations) {
    if (!this._modelData) {
      return [];
    }
    if (oldDecorations.length === 0 && newDecorations.length === 0) {
      return oldDecorations;
    }
    return this._modelData.model.deltaDecorations(oldDecorations, newDecorations, this._id);
  }
  removeDecorations(decorationIds) {
    if (!this._modelData || decorationIds.length === 0) {
      return;
    }
    this._modelData.model.changeDecorations((changeAccessor) => {
      changeAccessor.deltaDecorations(decorationIds, []);
    });
  }
  setDecorationsByType(description, decorationTypeKey, decorationOptions) {
    const newDecorationsSubTypes = {};
    const oldDecorationsSubTypes = this._decorationTypeSubtypes[decorationTypeKey] || {};
    this._decorationTypeSubtypes[decorationTypeKey] = newDecorationsSubTypes;
    const newModelDecorations = [];
    for (const decorationOption of decorationOptions) {
      let typeKey = decorationTypeKey;
      if (decorationOption.renderOptions) {
        const subType = hash(decorationOption.renderOptions).toString(16);
        typeKey = decorationTypeKey + "-" + subType;
        if (!oldDecorationsSubTypes[subType] && !newDecorationsSubTypes[subType]) {
          this._registerDecorationType(description, typeKey, decorationOption.renderOptions, decorationTypeKey);
        }
        newDecorationsSubTypes[subType] = true;
      }
      const opts = this._resolveDecorationOptions(typeKey, !!decorationOption.hoverMessage);
      if (decorationOption.hoverMessage) {
        opts.hoverMessage = decorationOption.hoverMessage;
      }
      newModelDecorations.push({ range: decorationOption.range, options: opts });
    }
    for (const subType in oldDecorationsSubTypes) {
      if (!newDecorationsSubTypes[subType]) {
        this._removeDecorationType(decorationTypeKey + "-" + subType);
      }
    }
    const oldDecorationsIds = this._decorationTypeKeysToIds[decorationTypeKey] || [];
    this.changeDecorations((accessor) => this._decorationTypeKeysToIds[decorationTypeKey] = accessor.deltaDecorations(oldDecorationsIds, newModelDecorations));
  }
  setDecorationsByTypeFast(decorationTypeKey, ranges) {
    const oldDecorationsSubTypes = this._decorationTypeSubtypes[decorationTypeKey] || {};
    for (const subType in oldDecorationsSubTypes) {
      this._removeDecorationType(decorationTypeKey + "-" + subType);
    }
    this._decorationTypeSubtypes[decorationTypeKey] = {};
    const opts = ModelDecorationOptions.createDynamic(this._resolveDecorationOptions(decorationTypeKey, false));
    const newModelDecorations = new Array(ranges.length);
    for (let i = 0, len = ranges.length; i < len; i++) {
      newModelDecorations[i] = { range: ranges[i], options: opts };
    }
    const oldDecorationsIds = this._decorationTypeKeysToIds[decorationTypeKey] || [];
    this.changeDecorations((accessor) => this._decorationTypeKeysToIds[decorationTypeKey] = accessor.deltaDecorations(oldDecorationsIds, newModelDecorations));
  }
  removeDecorationsByType(decorationTypeKey) {
    const oldDecorationsIds = this._decorationTypeKeysToIds[decorationTypeKey];
    if (oldDecorationsIds) {
      this.changeDecorations((accessor) => accessor.deltaDecorations(oldDecorationsIds, []));
    }
    if (this._decorationTypeKeysToIds.hasOwnProperty(decorationTypeKey)) {
      delete this._decorationTypeKeysToIds[decorationTypeKey];
    }
    if (this._decorationTypeSubtypes.hasOwnProperty(decorationTypeKey)) {
      delete this._decorationTypeSubtypes[decorationTypeKey];
    }
  }
  getLayoutInfo() {
    const options = this._configuration.options;
    const layoutInfo = options.get(EditorOption.layoutInfo);
    return layoutInfo;
  }
  createOverviewRuler(cssClassName) {
    if (!this._modelData || !this._modelData.hasRealView) {
      return null;
    }
    return this._modelData.view.createOverviewRuler(cssClassName);
  }
  getContainerDomNode() {
    return this._domElement;
  }
  getDomNode() {
    if (!this._modelData || !this._modelData.hasRealView) {
      return null;
    }
    return this._modelData.view.domNode.domNode;
  }
  delegateVerticalScrollbarPointerDown(browserEvent) {
    if (!this._modelData || !this._modelData.hasRealView) {
      return;
    }
    this._modelData.view.delegateVerticalScrollbarPointerDown(browserEvent);
  }
  delegateScrollFromMouseWheelEvent(browserEvent) {
    if (!this._modelData || !this._modelData.hasRealView) {
      return;
    }
    this._modelData.view.delegateScrollFromMouseWheelEvent(browserEvent);
  }
  layout(dimension, postponeRendering = false) {
    this._configuration.observeContainer(dimension);
    if (!postponeRendering) {
      this.render();
    }
  }
  focus() {
    if (!this._modelData || !this._modelData.hasRealView) {
      return;
    }
    this._modelData.view.focus();
  }
  hasTextFocus() {
    if (!this._modelData || !this._modelData.hasRealView) {
      return false;
    }
    return this._modelData.view.isFocused();
  }
  hasWidgetFocus() {
    if (!this._modelData || !this._modelData.hasRealView) {
      return false;
    }
    return this._modelData.view.isWidgetFocused();
  }
  addContentWidget(widget) {
    const widgetData = {
      widget,
      position: widget.getPosition()
    };
    if (this._contentWidgets.hasOwnProperty(widget.getId())) {
      console.warn("Overwriting a content widget with the same id:" + widget.getId());
    }
    this._contentWidgets[widget.getId()] = widgetData;
    if (this._modelData && this._modelData.hasRealView) {
      this._modelData.view.addContentWidget(widgetData);
    }
  }
  layoutContentWidget(widget) {
    const widgetId = widget.getId();
    if (this._contentWidgets.hasOwnProperty(widgetId)) {
      const widgetData = this._contentWidgets[widgetId];
      widgetData.position = widget.getPosition();
      if (this._modelData && this._modelData.hasRealView) {
        this._modelData.view.layoutContentWidget(widgetData);
      }
    }
  }
  removeContentWidget(widget) {
    const widgetId = widget.getId();
    if (this._contentWidgets.hasOwnProperty(widgetId)) {
      const widgetData = this._contentWidgets[widgetId];
      delete this._contentWidgets[widgetId];
      if (this._modelData && this._modelData.hasRealView) {
        this._modelData.view.removeContentWidget(widgetData);
      }
    }
  }
  addOverlayWidget(widget) {
    const widgetData = {
      widget,
      position: widget.getPosition()
    };
    if (this._overlayWidgets.hasOwnProperty(widget.getId())) {
      console.warn("Overwriting an overlay widget with the same id.");
    }
    this._overlayWidgets[widget.getId()] = widgetData;
    if (this._modelData && this._modelData.hasRealView) {
      this._modelData.view.addOverlayWidget(widgetData);
    }
  }
  layoutOverlayWidget(widget) {
    const widgetId = widget.getId();
    if (this._overlayWidgets.hasOwnProperty(widgetId)) {
      const widgetData = this._overlayWidgets[widgetId];
      widgetData.position = widget.getPosition();
      if (this._modelData && this._modelData.hasRealView) {
        this._modelData.view.layoutOverlayWidget(widgetData);
      }
    }
  }
  removeOverlayWidget(widget) {
    const widgetId = widget.getId();
    if (this._overlayWidgets.hasOwnProperty(widgetId)) {
      const widgetData = this._overlayWidgets[widgetId];
      delete this._overlayWidgets[widgetId];
      if (this._modelData && this._modelData.hasRealView) {
        this._modelData.view.removeOverlayWidget(widgetData);
      }
    }
  }
  addGlyphMarginWidget(widget) {
    const widgetData = {
      widget,
      position: widget.getPosition()
    };
    if (this._glyphMarginWidgets.hasOwnProperty(widget.getId())) {
      console.warn("Overwriting a glyph margin widget with the same id.");
    }
    this._glyphMarginWidgets[widget.getId()] = widgetData;
    if (this._modelData && this._modelData.hasRealView) {
      this._modelData.view.addGlyphMarginWidget(widgetData);
    }
  }
  layoutGlyphMarginWidget(widget) {
    const widgetId = widget.getId();
    if (this._glyphMarginWidgets.hasOwnProperty(widgetId)) {
      const widgetData = this._glyphMarginWidgets[widgetId];
      widgetData.position = widget.getPosition();
      if (this._modelData && this._modelData.hasRealView) {
        this._modelData.view.layoutGlyphMarginWidget(widgetData);
      }
    }
  }
  removeGlyphMarginWidget(widget) {
    const widgetId = widget.getId();
    if (this._glyphMarginWidgets.hasOwnProperty(widgetId)) {
      const widgetData = this._glyphMarginWidgets[widgetId];
      delete this._glyphMarginWidgets[widgetId];
      if (this._modelData && this._modelData.hasRealView) {
        this._modelData.view.removeGlyphMarginWidget(widgetData);
      }
    }
  }
  changeViewZones(callback) {
    if (!this._modelData || !this._modelData.hasRealView) {
      return;
    }
    this._modelData.view.change(callback);
  }
  getTargetAtClientPoint(clientX, clientY) {
    if (!this._modelData || !this._modelData.hasRealView) {
      return null;
    }
    return this._modelData.view.getTargetAtClientPoint(clientX, clientY);
  }
  getScrolledVisiblePosition(rawPosition) {
    if (!this._modelData || !this._modelData.hasRealView) {
      return null;
    }
    const position = this._modelData.model.validatePosition(rawPosition);
    const options = this._configuration.options;
    const layoutInfo = options.get(EditorOption.layoutInfo);
    const top = CodeEditorWidget._getVerticalOffsetForPosition(this._modelData, position.lineNumber, position.column) - this.getScrollTop();
    const left = this._modelData.view.getOffsetForColumn(position.lineNumber, position.column) + layoutInfo.glyphMarginWidth + layoutInfo.lineNumbersWidth + layoutInfo.decorationsWidth - this.getScrollLeft();
    return {
      top,
      left,
      height: options.get(EditorOption.lineHeight)
    };
  }
  getOffsetForColumn(lineNumber, column) {
    if (!this._modelData || !this._modelData.hasRealView) {
      return -1;
    }
    return this._modelData.view.getOffsetForColumn(lineNumber, column);
  }
  render(forceRedraw = false) {
    if (!this._modelData || !this._modelData.hasRealView) {
      return;
    }
    this._modelData.viewModel.batchEvents(() => {
      this._modelData.view.render(true, forceRedraw);
    });
  }
  setAriaOptions(options) {
    if (!this._modelData || !this._modelData.hasRealView) {
      return;
    }
    this._modelData.view.setAriaOptions(options);
  }
  applyFontInfo(target) {
    applyFontInfo(target, this._configuration.options.get(EditorOption.fontInfo));
  }
  setBanner(domNode, domNodeHeight) {
    if (this._bannerDomNode && this._domElement.contains(this._bannerDomNode)) {
      this._bannerDomNode.remove();
    }
    this._bannerDomNode = domNode;
    this._configuration.setReservedHeight(domNode ? domNodeHeight : 0);
    if (this._bannerDomNode) {
      this._domElement.prepend(this._bannerDomNode);
    }
  }
  _attachModel(model) {
    if (!model) {
      this._modelData = null;
      return;
    }
    const listenersToRemove = [];
    this._domElement.setAttribute("data-mode-id", model.getLanguageId());
    this._configuration.setIsDominatedByLongLines(model.isDominatedByLongLines());
    this._configuration.setModelLineCount(model.getLineCount());
    const attachedView = model.onBeforeAttached();
    const viewModel = new ViewModel(
      this._id,
      this._configuration,
      model,
      DOMLineBreaksComputerFactory.create(dom.getWindow(this._domElement)),
      MonospaceLineBreaksComputerFactory.create(this._configuration.options),
      (callback) => dom.scheduleAtNextAnimationFrame(dom.getWindow(this._domElement), callback),
      this.languageConfigurationService,
      this._themeService,
      attachedView,
      {
        batchChanges: (cb) => {
          try {
            this._beginUpdate();
            return cb();
          } finally {
            this._endUpdate();
          }
        }
      }
    );
    listenersToRemove.push(model.onWillDispose(() => this.setModel(null)));
    listenersToRemove.push(viewModel.onEvent((e) => {
      switch (e.kind) {
        case OutgoingViewModelEventKind.ContentSizeChanged:
          this._onDidContentSizeChange.fire(e);
          break;
        case OutgoingViewModelEventKind.FocusChanged:
          this._editorTextFocus.setValue(e.hasFocus);
          break;
        case OutgoingViewModelEventKind.WidgetFocusChanged:
          this._editorWidgetFocus.setValue(e.hasFocus);
          break;
        case OutgoingViewModelEventKind.ScrollChanged:
          this._onDidScrollChange.fire(e);
          break;
        case OutgoingViewModelEventKind.ViewZonesChanged:
          this._onDidChangeViewZones.fire();
          break;
        case OutgoingViewModelEventKind.HiddenAreasChanged:
          this._onDidChangeHiddenAreas.fire();
          break;
        case OutgoingViewModelEventKind.ReadOnlyEditAttempt:
          this._onDidAttemptReadOnlyEdit.fire();
          break;
        case OutgoingViewModelEventKind.CursorStateChanged: {
          if (e.reachedMaxCursorCount) {
            const multiCursorLimit = this.getOption(EditorOption.multiCursorLimit);
            const message = nls.localize("cursors.maximum", "The number of cursors has been limited to {0}. Consider using [find and replace](https://code.visualstudio.com/docs/editor/codebasics#_find-and-replace) for larger changes or increase the editor multi cursor limit setting.", multiCursorLimit);
            this._notificationService.prompt(Severity.Warning, message, [
              {
                label: "Find and Replace",
                run: () => {
                  this._commandService.executeCommand("editor.action.startFindReplaceAction");
                }
              },
              {
                label: nls.localize("goToSetting", "Increase Multi Cursor Limit"),
                run: () => {
                  this._commandService.executeCommand("workbench.action.openSettings2", {
                    query: "editor.multiCursorLimit"
                  });
                }
              }
            ]);
          }
          const positions = [];
          for (let i = 0, len = e.selections.length; i < len; i++) {
            positions[i] = e.selections[i].getPosition();
          }
          const e1 = {
            position: positions[0],
            secondaryPositions: positions.slice(1),
            reason: e.reason,
            source: e.source
          };
          this._onDidChangeCursorPosition.fire(e1);
          const e2 = {
            selection: e.selections[0],
            secondarySelections: e.selections.slice(1),
            modelVersionId: e.modelVersionId,
            oldSelections: e.oldSelections,
            oldModelVersionId: e.oldModelVersionId,
            source: e.source,
            reason: e.reason
          };
          this._onDidChangeCursorSelection.fire(e2);
          break;
        }
        case OutgoingViewModelEventKind.ModelDecorationsChanged:
          this._onDidChangeModelDecorations.fire(e.event);
          break;
        case OutgoingViewModelEventKind.ModelLanguageChanged:
          this._domElement.setAttribute("data-mode-id", model.getLanguageId());
          this._onDidChangeModelLanguage.fire(e.event);
          break;
        case OutgoingViewModelEventKind.ModelLanguageConfigurationChanged:
          this._onDidChangeModelLanguageConfiguration.fire(e.event);
          break;
        case OutgoingViewModelEventKind.ModelContentChanged:
          this._onDidChangeModelContent.fire(e.event);
          break;
        case OutgoingViewModelEventKind.ModelOptionsChanged:
          this._onDidChangeModelOptions.fire(e.event);
          break;
        case OutgoingViewModelEventKind.ModelTokensChanged:
          this._onDidChangeModelTokens.fire(e.event);
          break;
      }
    }));
    const [view, hasRealView] = this._createView(viewModel);
    if (hasRealView) {
      this._domElement.appendChild(view.domNode.domNode);
      let keys = Object.keys(this._contentWidgets);
      for (let i = 0, len = keys.length; i < len; i++) {
        const widgetId = keys[i];
        view.addContentWidget(this._contentWidgets[widgetId]);
      }
      keys = Object.keys(this._overlayWidgets);
      for (let i = 0, len = keys.length; i < len; i++) {
        const widgetId = keys[i];
        view.addOverlayWidget(this._overlayWidgets[widgetId]);
      }
      keys = Object.keys(this._glyphMarginWidgets);
      for (let i = 0, len = keys.length; i < len; i++) {
        const widgetId = keys[i];
        view.addGlyphMarginWidget(this._glyphMarginWidgets[widgetId]);
      }
      view.render(false, true);
      view.domNode.domNode.setAttribute("data-uri", model.uri.toString());
    }
    this._modelData = new ModelData(model, viewModel, view, hasRealView, listenersToRemove, attachedView);
  }
  _createView(viewModel) {
    let commandDelegate;
    if (this.isSimpleWidget) {
      commandDelegate = {
        paste: (text, pasteOnNewLine, multicursorText, mode) => {
          this._paste("keyboard", text, pasteOnNewLine, multicursorText, mode);
        },
        type: (text) => {
          this._type("keyboard", text);
        },
        compositionType: (text, replacePrevCharCnt, replaceNextCharCnt, positionDelta) => {
          this._compositionType("keyboard", text, replacePrevCharCnt, replaceNextCharCnt, positionDelta);
        },
        startComposition: () => {
          this._startComposition();
        },
        endComposition: () => {
          this._endComposition("keyboard");
        },
        cut: () => {
          this._cut("keyboard");
        }
      };
    } else {
      commandDelegate = {
        paste: (text, pasteOnNewLine, multicursorText, mode) => {
          const payload = { text, pasteOnNewLine, multicursorText, mode };
          this._commandService.executeCommand(editorCommon.Handler.Paste, payload);
        },
        type: (text) => {
          const payload = { text };
          this._commandService.executeCommand(editorCommon.Handler.Type, payload);
        },
        compositionType: (text, replacePrevCharCnt, replaceNextCharCnt, positionDelta) => {
          if (replaceNextCharCnt || positionDelta) {
            const payload = { text, replacePrevCharCnt, replaceNextCharCnt, positionDelta };
            this._commandService.executeCommand(editorCommon.Handler.CompositionType, payload);
          } else {
            const payload = { text, replaceCharCnt: replacePrevCharCnt };
            this._commandService.executeCommand(editorCommon.Handler.ReplacePreviousChar, payload);
          }
        },
        startComposition: () => {
          this._commandService.executeCommand(editorCommon.Handler.CompositionStart, {});
        },
        endComposition: () => {
          this._commandService.executeCommand(editorCommon.Handler.CompositionEnd, {});
        },
        cut: () => {
          this._commandService.executeCommand(editorCommon.Handler.Cut, {});
        }
      };
    }
    const viewUserInputEvents = new ViewUserInputEvents(viewModel.coordinatesConverter);
    viewUserInputEvents.onKeyDown = (e) => this._onKeyDown.fire(e);
    viewUserInputEvents.onKeyUp = (e) => this._onKeyUp.fire(e);
    viewUserInputEvents.onContextMenu = (e) => this._onContextMenu.fire(e);
    viewUserInputEvents.onMouseMove = (e) => this._onMouseMove.fire(e);
    viewUserInputEvents.onMouseLeave = (e) => this._onMouseLeave.fire(e);
    viewUserInputEvents.onMouseDown = (e) => this._onMouseDown.fire(e);
    viewUserInputEvents.onMouseUp = (e) => this._onMouseUp.fire(e);
    viewUserInputEvents.onMouseDrag = (e) => this._onMouseDrag.fire(e);
    viewUserInputEvents.onMouseDrop = (e) => this._onMouseDrop.fire(e);
    viewUserInputEvents.onMouseDropCanceled = (e) => this._onMouseDropCanceled.fire(e);
    viewUserInputEvents.onMouseWheel = (e) => this._onMouseWheel.fire(e);
    const view = new View(
      this._domElement,
      this.getId(),
      commandDelegate,
      this._configuration,
      this._themeService.getColorTheme(),
      viewModel,
      viewUserInputEvents,
      this._overflowWidgetsDomNode,
      this._instantiationService
    );
    return [view, true];
  }
  _postDetachModelCleanup(detachedModel) {
    detachedModel?.removeAllDecorationsWithOwnerId(this._id);
  }
  _detachModel() {
    this._contributionsDisposable?.dispose();
    this._contributionsDisposable = void 0;
    if (!this._modelData) {
      return null;
    }
    const model = this._modelData.model;
    const removeDomNode = this._modelData.hasRealView ? this._modelData.view.domNode.domNode : null;
    this._modelData.dispose();
    this._modelData = null;
    this._domElement.removeAttribute("data-mode-id");
    if (removeDomNode && this._domElement.contains(removeDomNode)) {
      removeDomNode.remove();
    }
    if (this._bannerDomNode && this._domElement.contains(this._bannerDomNode)) {
      this._bannerDomNode.remove();
    }
    return model;
  }
  _registerDecorationType(description, key, options, parentTypeKey) {
    this._codeEditorService.registerDecorationType(description, key, options, parentTypeKey, this);
  }
  _removeDecorationType(key) {
    this._codeEditorService.removeDecorationType(key);
  }
  _resolveDecorationOptions(typeKey, writable) {
    return this._codeEditorService.resolveDecorationOptions(typeKey, writable);
  }
  getTelemetryData() {
    return this._telemetryData;
  }
  hasModel() {
    return this._modelData !== null;
  }
  showDropIndicatorAt(position) {
    const newDecorations = [{
      range: new Range(position.lineNumber, position.column, position.lineNumber, position.column),
      options: CodeEditorWidget.dropIntoEditorDecorationOptions
    }];
    this._dropIntoEditorDecorations.set(newDecorations);
    this.revealPosition(position, editorCommon.ScrollType.Immediate);
  }
  removeDropIndicator() {
    this._dropIntoEditorDecorations.clear();
  }
  setContextValue(key, value) {
    this._contextKeyService.createKey(key, value);
  }
  _beginUpdate() {
    this._updateCounter++;
    if (this._updateCounter === 1) {
      this._onBeginUpdate.fire();
    }
  }
  _endUpdate() {
    this._updateCounter--;
    if (this._updateCounter === 0) {
      this._onEndUpdate.fire();
    }
  }
};
CodeEditorWidget.dropIntoEditorDecorationOptions = ModelDecorationOptions.register({
  description: "workbench-dnd-target",
  className: "dnd-target"
});
CodeEditorWidget = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ICodeEditorService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, INotificationService),
  __decorateParam(9, IAccessibilityService),
  __decorateParam(10, ILanguageConfigurationService),
  __decorateParam(11, ILanguageFeaturesService)
], CodeEditorWidget);
let EDITOR_ID = 0;
class ModelData {
  constructor(model, viewModel, view, hasRealView, listenersToRemove, attachedView) {
    this.model = model;
    this.viewModel = viewModel;
    this.view = view;
    this.hasRealView = hasRealView;
    this.listenersToRemove = listenersToRemove;
    this.attachedView = attachedView;
  }
  dispose() {
    dispose(this.listenersToRemove);
    this.model.onBeforeDetached(this.attachedView);
    if (this.hasRealView) {
      this.view.dispose();
    }
    this.viewModel.dispose();
  }
}
var BooleanEventValue = /* @__PURE__ */ ((BooleanEventValue2) => {
  BooleanEventValue2[BooleanEventValue2["NotSet"] = 0] = "NotSet";
  BooleanEventValue2[BooleanEventValue2["False"] = 1] = "False";
  BooleanEventValue2[BooleanEventValue2["True"] = 2] = "True";
  return BooleanEventValue2;
})(BooleanEventValue || {});
class BooleanEventEmitter extends Disposable {
  constructor(_emitterOptions) {
    super();
    this._emitterOptions = _emitterOptions;
    this._onDidChangeToTrue = this._register(new Emitter(this._emitterOptions));
    this.onDidChangeToTrue = this._onDidChangeToTrue.event;
    this._onDidChangeToFalse = this._register(new Emitter(this._emitterOptions));
    this.onDidChangeToFalse = this._onDidChangeToFalse.event;
    this._value = 0 /* NotSet */;
  }
  setValue(_value) {
    const value = _value ? 2 /* True */ : 1 /* False */;
    if (this._value === value) {
      return;
    }
    this._value = value;
    if (this._value === 2 /* True */) {
      this._onDidChangeToTrue.fire();
    } else if (this._value === 1 /* False */) {
      this._onDidChangeToFalse.fire();
    }
  }
}
class InteractionEmitter extends Emitter {
  constructor(_contributions, deliveryQueue) {
    super({ deliveryQueue });
    this._contributions = _contributions;
  }
  fire(event) {
    this._contributions.onBeforeInteractionEvent();
    super.fire(event);
  }
}
class EditorContextKeysManager extends Disposable {
  constructor(editor, contextKeyService) {
    super();
    this._editor = editor;
    contextKeyService.createKey("editorId", editor.getId());
    this._editorSimpleInput = EditorContextKeys.editorSimpleInput.bindTo(contextKeyService);
    this._editorFocus = EditorContextKeys.focus.bindTo(contextKeyService);
    this._textInputFocus = EditorContextKeys.textInputFocus.bindTo(contextKeyService);
    this._editorTextFocus = EditorContextKeys.editorTextFocus.bindTo(contextKeyService);
    this._tabMovesFocus = EditorContextKeys.tabMovesFocus.bindTo(contextKeyService);
    this._editorReadonly = EditorContextKeys.readOnly.bindTo(contextKeyService);
    this._inDiffEditor = EditorContextKeys.inDiffEditor.bindTo(contextKeyService);
    this._editorColumnSelection = EditorContextKeys.columnSelection.bindTo(contextKeyService);
    this._hasMultipleSelections = EditorContextKeys.hasMultipleSelections.bindTo(contextKeyService);
    this._hasNonEmptySelection = EditorContextKeys.hasNonEmptySelection.bindTo(contextKeyService);
    this._canUndo = EditorContextKeys.canUndo.bindTo(contextKeyService);
    this._canRedo = EditorContextKeys.canRedo.bindTo(contextKeyService);
    this._register(this._editor.onDidChangeConfiguration(() => this._updateFromConfig()));
    this._register(this._editor.onDidChangeCursorSelection(() => this._updateFromSelection()));
    this._register(this._editor.onDidFocusEditorWidget(() => this._updateFromFocus()));
    this._register(this._editor.onDidBlurEditorWidget(() => this._updateFromFocus()));
    this._register(this._editor.onDidFocusEditorText(() => this._updateFromFocus()));
    this._register(this._editor.onDidBlurEditorText(() => this._updateFromFocus()));
    this._register(this._editor.onDidChangeModel(() => this._updateFromModel()));
    this._register(this._editor.onDidChangeConfiguration(() => this._updateFromModel()));
    this._register(TabFocus.onDidChangeTabFocus((tabFocusMode) => this._tabMovesFocus.set(tabFocusMode)));
    this._updateFromConfig();
    this._updateFromSelection();
    this._updateFromFocus();
    this._updateFromModel();
    this._editorSimpleInput.set(this._editor.isSimpleWidget);
  }
  _updateFromConfig() {
    const options = this._editor.getOptions();
    this._tabMovesFocus.set(TabFocus.getTabFocusMode());
    this._editorReadonly.set(options.get(EditorOption.readOnly));
    this._inDiffEditor.set(options.get(EditorOption.inDiffEditor));
    this._editorColumnSelection.set(options.get(EditorOption.columnSelection));
  }
  _updateFromSelection() {
    const selections = this._editor.getSelections();
    if (!selections) {
      this._hasMultipleSelections.reset();
      this._hasNonEmptySelection.reset();
    } else {
      this._hasMultipleSelections.set(selections.length > 1);
      this._hasNonEmptySelection.set(selections.some((s) => !s.isEmpty()));
    }
  }
  _updateFromFocus() {
    this._editorFocus.set(this._editor.hasWidgetFocus() && !this._editor.isSimpleWidget);
    this._editorTextFocus.set(this._editor.hasTextFocus() && !this._editor.isSimpleWidget);
    this._textInputFocus.set(this._editor.hasTextFocus());
  }
  _updateFromModel() {
    const model = this._editor.getModel();
    this._canUndo.set(Boolean(model && model.canUndo()));
    this._canRedo.set(Boolean(model && model.canRedo()));
  }
}
class EditorModeContext extends Disposable {
  constructor(_editor, _contextKeyService, _languageFeaturesService) {
    super();
    this._editor = _editor;
    this._contextKeyService = _contextKeyService;
    this._languageFeaturesService = _languageFeaturesService;
    this._langId = EditorContextKeys.languageId.bindTo(_contextKeyService);
    this._hasCompletionItemProvider = EditorContextKeys.hasCompletionItemProvider.bindTo(_contextKeyService);
    this._hasCodeActionsProvider = EditorContextKeys.hasCodeActionsProvider.bindTo(_contextKeyService);
    this._hasCodeLensProvider = EditorContextKeys.hasCodeLensProvider.bindTo(_contextKeyService);
    this._hasDefinitionProvider = EditorContextKeys.hasDefinitionProvider.bindTo(_contextKeyService);
    this._hasDeclarationProvider = EditorContextKeys.hasDeclarationProvider.bindTo(_contextKeyService);
    this._hasImplementationProvider = EditorContextKeys.hasImplementationProvider.bindTo(_contextKeyService);
    this._hasTypeDefinitionProvider = EditorContextKeys.hasTypeDefinitionProvider.bindTo(_contextKeyService);
    this._hasHoverProvider = EditorContextKeys.hasHoverProvider.bindTo(_contextKeyService);
    this._hasDocumentHighlightProvider = EditorContextKeys.hasDocumentHighlightProvider.bindTo(_contextKeyService);
    this._hasDocumentSymbolProvider = EditorContextKeys.hasDocumentSymbolProvider.bindTo(_contextKeyService);
    this._hasReferenceProvider = EditorContextKeys.hasReferenceProvider.bindTo(_contextKeyService);
    this._hasRenameProvider = EditorContextKeys.hasRenameProvider.bindTo(_contextKeyService);
    this._hasSignatureHelpProvider = EditorContextKeys.hasSignatureHelpProvider.bindTo(_contextKeyService);
    this._hasInlayHintsProvider = EditorContextKeys.hasInlayHintsProvider.bindTo(_contextKeyService);
    this._hasDocumentFormattingProvider = EditorContextKeys.hasDocumentFormattingProvider.bindTo(_contextKeyService);
    this._hasDocumentSelectionFormattingProvider = EditorContextKeys.hasDocumentSelectionFormattingProvider.bindTo(_contextKeyService);
    this._hasMultipleDocumentFormattingProvider = EditorContextKeys.hasMultipleDocumentFormattingProvider.bindTo(_contextKeyService);
    this._hasMultipleDocumentSelectionFormattingProvider = EditorContextKeys.hasMultipleDocumentSelectionFormattingProvider.bindTo(_contextKeyService);
    this._isInEmbeddedEditor = EditorContextKeys.isInEmbeddedEditor.bindTo(_contextKeyService);
    const update = () => this._update();
    this._register(_editor.onDidChangeModel(update));
    this._register(_editor.onDidChangeModelLanguage(update));
    this._register(_languageFeaturesService.completionProvider.onDidChange(update));
    this._register(_languageFeaturesService.codeActionProvider.onDidChange(update));
    this._register(_languageFeaturesService.codeLensProvider.onDidChange(update));
    this._register(_languageFeaturesService.definitionProvider.onDidChange(update));
    this._register(_languageFeaturesService.declarationProvider.onDidChange(update));
    this._register(_languageFeaturesService.implementationProvider.onDidChange(update));
    this._register(_languageFeaturesService.typeDefinitionProvider.onDidChange(update));
    this._register(_languageFeaturesService.hoverProvider.onDidChange(update));
    this._register(_languageFeaturesService.documentHighlightProvider.onDidChange(update));
    this._register(_languageFeaturesService.documentSymbolProvider.onDidChange(update));
    this._register(_languageFeaturesService.referenceProvider.onDidChange(update));
    this._register(_languageFeaturesService.renameProvider.onDidChange(update));
    this._register(_languageFeaturesService.documentFormattingEditProvider.onDidChange(update));
    this._register(_languageFeaturesService.documentRangeFormattingEditProvider.onDidChange(update));
    this._register(_languageFeaturesService.signatureHelpProvider.onDidChange(update));
    this._register(_languageFeaturesService.inlayHintsProvider.onDidChange(update));
    update();
  }
  dispose() {
    super.dispose();
  }
  reset() {
    this._contextKeyService.bufferChangeEvents(() => {
      this._langId.reset();
      this._hasCompletionItemProvider.reset();
      this._hasCodeActionsProvider.reset();
      this._hasCodeLensProvider.reset();
      this._hasDefinitionProvider.reset();
      this._hasDeclarationProvider.reset();
      this._hasImplementationProvider.reset();
      this._hasTypeDefinitionProvider.reset();
      this._hasHoverProvider.reset();
      this._hasDocumentHighlightProvider.reset();
      this._hasDocumentSymbolProvider.reset();
      this._hasReferenceProvider.reset();
      this._hasRenameProvider.reset();
      this._hasDocumentFormattingProvider.reset();
      this._hasDocumentSelectionFormattingProvider.reset();
      this._hasSignatureHelpProvider.reset();
      this._isInEmbeddedEditor.reset();
    });
  }
  _update() {
    const model = this._editor.getModel();
    if (!model) {
      this.reset();
      return;
    }
    this._contextKeyService.bufferChangeEvents(() => {
      this._langId.set(model.getLanguageId());
      this._hasCompletionItemProvider.set(this._languageFeaturesService.completionProvider.has(model));
      this._hasCodeActionsProvider.set(this._languageFeaturesService.codeActionProvider.has(model));
      this._hasCodeLensProvider.set(this._languageFeaturesService.codeLensProvider.has(model));
      this._hasDefinitionProvider.set(this._languageFeaturesService.definitionProvider.has(model));
      this._hasDeclarationProvider.set(this._languageFeaturesService.declarationProvider.has(model));
      this._hasImplementationProvider.set(this._languageFeaturesService.implementationProvider.has(model));
      this._hasTypeDefinitionProvider.set(this._languageFeaturesService.typeDefinitionProvider.has(model));
      this._hasHoverProvider.set(this._languageFeaturesService.hoverProvider.has(model));
      this._hasDocumentHighlightProvider.set(this._languageFeaturesService.documentHighlightProvider.has(model));
      this._hasDocumentSymbolProvider.set(this._languageFeaturesService.documentSymbolProvider.has(model));
      this._hasReferenceProvider.set(this._languageFeaturesService.referenceProvider.has(model));
      this._hasRenameProvider.set(this._languageFeaturesService.renameProvider.has(model));
      this._hasSignatureHelpProvider.set(this._languageFeaturesService.signatureHelpProvider.has(model));
      this._hasInlayHintsProvider.set(this._languageFeaturesService.inlayHintsProvider.has(model));
      this._hasDocumentFormattingProvider.set(this._languageFeaturesService.documentFormattingEditProvider.has(model) || this._languageFeaturesService.documentRangeFormattingEditProvider.has(model));
      this._hasDocumentSelectionFormattingProvider.set(this._languageFeaturesService.documentRangeFormattingEditProvider.has(model));
      this._hasMultipleDocumentFormattingProvider.set(this._languageFeaturesService.documentFormattingEditProvider.all(model).length + this._languageFeaturesService.documentRangeFormattingEditProvider.all(model).length > 1);
      this._hasMultipleDocumentSelectionFormattingProvider.set(this._languageFeaturesService.documentRangeFormattingEditProvider.all(model).length > 1);
      this._isInEmbeddedEditor.set(model.uri.scheme === Schemas.walkThroughSnippet || model.uri.scheme === Schemas.vscodeChatCodeBlock);
    });
  }
}
class EditorDecorationsCollection {
  constructor(_editor, decorations) {
    this._editor = _editor;
    this._decorationIds = [];
    this._isChangingDecorations = false;
    if (Array.isArray(decorations) && decorations.length > 0) {
      this.set(decorations);
    }
  }
  get length() {
    return this._decorationIds.length;
  }
  onDidChange(listener, thisArgs, disposables) {
    return this._editor.onDidChangeModelDecorations((e) => {
      if (this._isChangingDecorations) {
        return;
      }
      listener.call(thisArgs, e);
    }, disposables);
  }
  getRange(index) {
    if (!this._editor.hasModel()) {
      return null;
    }
    if (index >= this._decorationIds.length) {
      return null;
    }
    return this._editor.getModel().getDecorationRange(this._decorationIds[index]);
  }
  getRanges() {
    if (!this._editor.hasModel()) {
      return [];
    }
    const model = this._editor.getModel();
    const result = [];
    for (const decorationId of this._decorationIds) {
      const range = model.getDecorationRange(decorationId);
      if (range) {
        result.push(range);
      }
    }
    return result;
  }
  has(decoration) {
    return this._decorationIds.includes(decoration.id);
  }
  clear() {
    if (this._decorationIds.length === 0) {
      return;
    }
    this.set([]);
  }
  set(newDecorations) {
    try {
      this._isChangingDecorations = true;
      this._editor.changeDecorations((accessor) => {
        this._decorationIds = accessor.deltaDecorations(this._decorationIds, newDecorations);
      });
    } finally {
      this._isChangingDecorations = false;
    }
    return this._decorationIds;
  }
  append(newDecorations) {
    let newDecorationIds = [];
    try {
      this._isChangingDecorations = true;
      this._editor.changeDecorations((accessor) => {
        newDecorationIds = accessor.deltaDecorations([], newDecorations);
        this._decorationIds = this._decorationIds.concat(newDecorationIds);
      });
    } finally {
      this._isChangingDecorations = false;
    }
    return newDecorationIds;
  }
}
const squigglyStart = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 6 3' enable-background='new 0 0 6 3' height='3' width='6'><g fill='`);
const squigglyEnd = encodeURIComponent(`'><polygon points='5.5,0 2.5,3 1.1,3 4.1,0'/><polygon points='4,0 6,2 6,0.6 5.4,0'/><polygon points='0,2 1,3 2.4,3 0,0.6'/></g></svg>`);
function getSquigglySVGData(color) {
  return squigglyStart + encodeURIComponent(color.toString()) + squigglyEnd;
}
const dotdotdotStart = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" height="3" width="12"><g fill="`);
const dotdotdotEnd = encodeURIComponent(`"><circle cx="1" cy="1" r="1"/><circle cx="5" cy="1" r="1"/><circle cx="9" cy="1" r="1"/></g></svg>`);
function getDotDotDotSVGData(color) {
  return dotdotdotStart + encodeURIComponent(color.toString()) + dotdotdotEnd;
}
registerThemingParticipant((theme, collector) => {
  const errorForeground = theme.getColor(editorErrorForeground);
  if (errorForeground) {
    collector.addRule(`.monaco-editor .${ClassName.EditorErrorDecoration} { background: url("data:image/svg+xml,${getSquigglySVGData(errorForeground)}") repeat-x bottom left; }`);
    collector.addRule(`:root { --monaco-editor-error-decoration: url("data:image/svg+xml,${getSquigglySVGData(errorForeground)}"); }`);
  }
  const warningForeground = theme.getColor(editorWarningForeground);
  if (warningForeground) {
    collector.addRule(`.monaco-editor .${ClassName.EditorWarningDecoration} { background: url("data:image/svg+xml,${getSquigglySVGData(warningForeground)}") repeat-x bottom left; }`);
    collector.addRule(`:root { --monaco-editor-warning-decoration: url("data:image/svg+xml,${getSquigglySVGData(warningForeground)}"); }`);
  }
  const infoForeground = theme.getColor(editorInfoForeground);
  if (infoForeground) {
    collector.addRule(`.monaco-editor .${ClassName.EditorInfoDecoration} { background: url("data:image/svg+xml,${getSquigglySVGData(infoForeground)}") repeat-x bottom left; }`);
    collector.addRule(`:root { --monaco-editor-info-decoration: url("data:image/svg+xml,${getSquigglySVGData(infoForeground)}"); }`);
  }
  const hintForeground = theme.getColor(editorHintForeground);
  if (hintForeground) {
    collector.addRule(`.monaco-editor .${ClassName.EditorHintDecoration} { background: url("data:image/svg+xml,${getDotDotDotSVGData(hintForeground)}") no-repeat bottom left; }`);
    collector.addRule(`:root { --monaco-editor-hint-decoration: url("data:image/svg+xml,${getDotDotDotSVGData(hintForeground)}"); }`);
  }
  const unnecessaryForeground = theme.getColor(editorUnnecessaryCodeOpacity);
  if (unnecessaryForeground) {
    collector.addRule(`.monaco-editor.showUnused .${ClassName.EditorUnnecessaryInlineDecoration} { opacity: ${unnecessaryForeground.rgba.a}; }`);
    collector.addRule(`:root { --monaco-editor-unnecessary-decoration-opacity: ${unnecessaryForeground.rgba.a}; }`);
  }
});
export {
  BooleanEventEmitter,
  CodeEditorWidget,
  EditorModeContext
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvci9jb2RlRWRpdG9yV2lkZ2V0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuLi8uLi9zZXJ2aWNlcy9tYXJrZXJEZWNvcmF0aW9ucy5qcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IElNb3VzZVdoZWVsRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEVtaXR0ZXJPcHRpb25zLCBFdmVudCwgRXZlbnREZWxpdmVyeVF1ZXVlLCBjcmVhdGVFdmVudERlbGl2ZXJ5UXVldWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBoYXNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGFzaC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBkaXNwb3NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCAnLi9lZGl0b3IuY3NzJztcbmltcG9ydCB7IGFwcGx5Rm9udEluZm8gfSBmcm9tICcuLi8uLi9jb25maWcvZG9tRm9udEluZm8uanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29uZmlndXJhdGlvbiwgSUVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnMgfSBmcm9tICcuLi8uLi9jb25maWcvZWRpdG9yQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUYWJGb2N1cyB9IGZyb20gJy4uLy4uL2NvbmZpZy90YWJGb2N1cy5qcyc7XG5pbXBvcnQgKiBhcyBlZGl0b3JCcm93c2VyIGZyb20gJy4uLy4uL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yRXh0ZW5zaW9uc1JlZ2lzdHJ5LCBJRWRpdG9yQ29udHJpYnV0aW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZW50V2lkZ2V0RGF0YSwgSUdseXBoTWFyZ2luV2lkZ2V0RGF0YSwgSU92ZXJsYXlXaWRnZXREYXRhLCBWaWV3IH0gZnJvbSAnLi4vLi4vdmlldy5qcyc7XG5pbXBvcnQgeyBET01MaW5lQnJlYWtzQ29tcHV0ZXJGYWN0b3J5IH0gZnJvbSAnLi4vLi4vdmlldy9kb21MaW5lQnJlYWtzQ29tcHV0ZXIuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmREZWxlZ2F0ZSB9IGZyb20gJy4uLy4uL3ZpZXcvdmlld0NvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgVmlld1VzZXJJbnB1dEV2ZW50cyB9IGZyb20gJy4uLy4uL3ZpZXcvdmlld1VzZXJJbnB1dEV2ZW50cy5qcyc7XG5pbXBvcnQgeyBDb2RlRWRpdG9yQ29udHJpYnV0aW9ucyB9IGZyb20gJy4vY29kZUVkaXRvckNvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvckNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbkNoYW5nZWRFdmVudCwgRWRpdG9yTGF5b3V0SW5mbywgRWRpdG9yT3B0aW9uLCBGaW5kQ29tcHV0ZWRFZGl0b3JPcHRpb25WYWx1ZUJ5SWQsIElDb21wdXRlZEVkaXRvck9wdGlvbnMsIElFZGl0b3JPcHRpb25zLCBmaWx0ZXJWYWxpZGF0aW9uRGVjb3JhdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgQ3Vyc29yQ29sdW1ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL2N1cnNvckNvbHVtbnMuanMnO1xuaW1wb3J0IHsgSURpbWVuc2lvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL2RpbWVuc2lvbi5qcyc7XG5pbXBvcnQgeyBlZGl0b3JVbm5lY2Vzc2FyeUNvZGVPcGFjaXR5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvZWRpdG9yQ29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElTZWxlY3Rpb24sIFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJV29yZEF0UG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS93b3JkSGVscGVyLmpzJztcbmltcG9ydCB7IFdvcmRPcGVyYXRpb25zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2N1cnNvci9jdXJzb3JXb3JkT3BlcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBDdXJzb3JDaGFuZ2VSZWFzb24sIElDdXJzb3JQb3NpdGlvbkNoYW5nZWRFdmVudCwgSUN1cnNvclNlbGVjdGlvbkNoYW5nZWRFdmVudCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jdXJzb3JFdmVudHMuanMnO1xuaW1wb3J0IHsgSW50ZXJuYWxFZGl0b3JBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQWN0aW9uLmpzJztcbmltcG9ydCAqIGFzIGVkaXRvckNvbW1vbiBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBFbmRPZkxpbmVQcmVmZXJlbmNlLCBJQXR0YWNoZWRWaWV3LCBJQ3Vyc29yU3RhdGVDb21wdXRlciwgSUlkZW50aWZpZWRTaW5nbGVFZGl0T3BlcmF0aW9uLCBJTW9kZWxEZWNvcmF0aW9uLCBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucywgSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvciwgSU1vZGVsRGVsdGFEZWNvcmF0aW9uLCBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IENsYXNzTmFtZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC9pbnRlcnZhbFRyZWUuanMnO1xuaW1wb3J0IHsgTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgSU1vZGVsQ29udGVudENoYW5nZWRFdmVudCwgSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VkRXZlbnQsIElNb2RlbExhbmd1YWdlQ2hhbmdlZEV2ZW50LCBJTW9kZWxMYW5ndWFnZUNvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQsIElNb2RlbE9wdGlvbnNDaGFuZ2VkRXZlbnQsIElNb2RlbFRva2Vuc0NoYW5nZWRFdmVudCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi90ZXh0TW9kZWxFdmVudHMuanMnO1xuaW1wb3J0IHsgVmVydGljYWxSZXZlYWxUeXBlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdFdmVudHMuanMnO1xuaW1wb3J0IHsgSUVkaXRvcldoaXRlc3BhY2UsIElWaWV3TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld01vZGVsLmpzJztcbmltcG9ydCB7IE1vbm9zcGFjZUxpbmVCcmVha3NDb21wdXRlckZhY3RvcnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld01vZGVsL21vbm9zcGFjZUxpbmVCcmVha3NDb21wdXRlci5qcyc7XG5pbXBvcnQgeyBWaWV3TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld01vZGVsL3ZpZXdNb2RlbEltcGwuanMnO1xuaW1wb3J0IHsgT3V0Z29pbmdWaWV3TW9kZWxFdmVudEtpbmQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld01vZGVsRXZlbnREaXNwYXRjaGVyLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleVZhbHVlLCBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIFNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgZWRpdG9yRXJyb3JGb3JlZ3JvdW5kLCBlZGl0b3JIaW50Rm9yZWdyb3VuZCwgZWRpdG9ySW5mb0ZvcmVncm91bmQsIGVkaXRvcldhcm5pbmdGb3JlZ3JvdW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSwgcmVnaXN0ZXJUaGVtaW5nUGFydGljaXBhbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuXG5leHBvcnQgY2xhc3MgQ29kZUVkaXRvcldpZGdldCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBlZGl0b3JCcm93c2VyLklDb2RlRWRpdG9yIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBkcm9wSW50b0VkaXRvckRlY29yYXRpb25PcHRpb25zID0gTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7XG5cdFx0ZGVzY3JpcHRpb246ICd3b3JrYmVuY2gtZG5kLXRhcmdldCcsXG5cdFx0Y2xhc3NOYW1lOiAnZG5kLXRhcmdldCdcblx0fSk7XG5cblx0Ly8jcmVnaW9uIEV2ZW50aW5nXG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGVsaXZlcnlRdWV1ZSA9IGNyZWF0ZUV2ZW50RGVsaXZlcnlRdWV1ZSgpO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX2NvbnRyaWJ1dGlvbnM6IENvZGVFZGl0b3JDb250cmlidXRpb25zID0gdGhpcy5fcmVnaXN0ZXIobmV3IENvZGVFZGl0b3JDb250cmlidXRpb25zKCkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRGlzcG9zZTogRW1pdHRlcjx2b2lkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWREaXNwb3NlOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkRGlzcG9zZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZU1vZGVsQ29udGVudDogRW1pdHRlcjxJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQ+KHsgZGVsaXZlcnlRdWV1ZTogdGhpcy5fZGVsaXZlcnlRdWV1ZSB9KSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZU1vZGVsQ29udGVudDogRXZlbnQ8SU1vZGVsQ29udGVudENoYW5nZWRFdmVudD4gPSB0aGlzLl9vbkRpZENoYW5nZU1vZGVsQ29udGVudC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2U6IEVtaXR0ZXI8SU1vZGVsTGFuZ3VhZ2VDaGFuZ2VkRXZlbnQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SU1vZGVsTGFuZ3VhZ2VDaGFuZ2VkRXZlbnQ+KHsgZGVsaXZlcnlRdWV1ZTogdGhpcy5fZGVsaXZlcnlRdWV1ZSB9KSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2U6IEV2ZW50PElNb2RlbExhbmd1YWdlQ2hhbmdlZEV2ZW50PiA9IHRoaXMuX29uRGlkQ2hhbmdlTW9kZWxMYW5ndWFnZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2VDb25maWd1cmF0aW9uOiBFbWl0dGVyPElNb2RlbExhbmd1YWdlQ29uZmlndXJhdGlvbkNoYW5nZWRFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJTW9kZWxMYW5ndWFnZUNvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQ+KHsgZGVsaXZlcnlRdWV1ZTogdGhpcy5fZGVsaXZlcnlRdWV1ZSB9KSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2VDb25maWd1cmF0aW9uOiBFdmVudDxJTW9kZWxMYW5ndWFnZUNvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VNb2RlbExhbmd1YWdlQ29uZmlndXJhdGlvbi5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZU1vZGVsT3B0aW9uczogRW1pdHRlcjxJTW9kZWxPcHRpb25zQ2hhbmdlZEV2ZW50PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElNb2RlbE9wdGlvbnNDaGFuZ2VkRXZlbnQ+KHsgZGVsaXZlcnlRdWV1ZTogdGhpcy5fZGVsaXZlcnlRdWV1ZSB9KSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZU1vZGVsT3B0aW9uczogRXZlbnQ8SU1vZGVsT3B0aW9uc0NoYW5nZWRFdmVudD4gPSB0aGlzLl9vbkRpZENoYW5nZU1vZGVsT3B0aW9ucy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZU1vZGVsRGVjb3JhdGlvbnM6IEVtaXR0ZXI8SU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VkRXZlbnQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VkRXZlbnQ+KHsgZGVsaXZlcnlRdWV1ZTogdGhpcy5fZGVsaXZlcnlRdWV1ZSB9KSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZU1vZGVsRGVjb3JhdGlvbnM6IEV2ZW50PElNb2RlbERlY29yYXRpb25zQ2hhbmdlZEV2ZW50PiA9IHRoaXMuX29uRGlkQ2hhbmdlTW9kZWxEZWNvcmF0aW9ucy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZU1vZGVsVG9rZW5zOiBFbWl0dGVyPElNb2RlbFRva2Vuc0NoYW5nZWRFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJTW9kZWxUb2tlbnNDaGFuZ2VkRXZlbnQ+KHsgZGVsaXZlcnlRdWV1ZTogdGhpcy5fZGVsaXZlcnlRdWV1ZSB9KSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZU1vZGVsVG9rZW5zOiBFdmVudDxJTW9kZWxUb2tlbnNDaGFuZ2VkRXZlbnQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VNb2RlbFRva2Vucy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb246IEVtaXR0ZXI8Q29uZmlndXJhdGlvbkNoYW5nZWRFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50Pih7IGRlbGl2ZXJ5UXVldWU6IHRoaXMuX2RlbGl2ZXJ5UXVldWUgfSkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uOiBFdmVudDxDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50PiA9IHRoaXMuX29uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbi5ldmVudDtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uV2lsbENoYW5nZU1vZGVsOiBFbWl0dGVyPGVkaXRvckNvbW1vbi5JTW9kZWxDaGFuZ2VkRXZlbnQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8ZWRpdG9yQ29tbW9uLklNb2RlbENoYW5nZWRFdmVudD4oeyBkZWxpdmVyeVF1ZXVlOiB0aGlzLl9kZWxpdmVyeVF1ZXVlIH0pKTtcblx0cHVibGljIHJlYWRvbmx5IG9uV2lsbENoYW5nZU1vZGVsOiBFdmVudDxlZGl0b3JDb21tb24uSU1vZGVsQ2hhbmdlZEV2ZW50PiA9IHRoaXMuX29uV2lsbENoYW5nZU1vZGVsLmV2ZW50O1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRDaGFuZ2VNb2RlbDogRW1pdHRlcjxlZGl0b3JDb21tb24uSU1vZGVsQ2hhbmdlZEV2ZW50PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPGVkaXRvckNvbW1vbi5JTW9kZWxDaGFuZ2VkRXZlbnQ+KHsgZGVsaXZlcnlRdWV1ZTogdGhpcy5fZGVsaXZlcnlRdWV1ZSB9KSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZU1vZGVsOiBFdmVudDxlZGl0b3JDb21tb24uSU1vZGVsQ2hhbmdlZEV2ZW50PiA9IHRoaXMuX29uRGlkQ2hhbmdlTW9kZWwuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbjogRW1pdHRlcjxJQ3Vyc29yUG9zaXRpb25DaGFuZ2VkRXZlbnQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUN1cnNvclBvc2l0aW9uQ2hhbmdlZEV2ZW50Pih7IGRlbGl2ZXJ5UXVldWU6IHRoaXMuX2RlbGl2ZXJ5UXVldWUgfSkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbjogRXZlbnQ8SUN1cnNvclBvc2l0aW9uQ2hhbmdlZEV2ZW50PiA9IHRoaXMuX29uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDdXJzb3JTZWxlY3Rpb246IEVtaXR0ZXI8SUN1cnNvclNlbGVjdGlvbkNoYW5nZWRFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJQ3Vyc29yU2VsZWN0aW9uQ2hhbmdlZEV2ZW50Pih7IGRlbGl2ZXJ5UXVldWU6IHRoaXMuX2RlbGl2ZXJ5UXVldWUgfSkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VDdXJzb3JTZWxlY3Rpb246IEV2ZW50PElDdXJzb3JTZWxlY3Rpb25DaGFuZ2VkRXZlbnQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VDdXJzb3JTZWxlY3Rpb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRBdHRlbXB0UmVhZE9ubHlFZGl0OiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEludGVyYWN0aW9uRW1pdHRlcjx2b2lkPih0aGlzLl9jb250cmlidXRpb25zLCB0aGlzLl9kZWxpdmVyeVF1ZXVlKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZEF0dGVtcHRSZWFkT25seUVkaXQ6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRBdHRlbXB0UmVhZE9ubHlFZGl0LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkTGF5b3V0Q2hhbmdlOiBFbWl0dGVyPEVkaXRvckxheW91dEluZm8+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8RWRpdG9yTGF5b3V0SW5mbz4oeyBkZWxpdmVyeVF1ZXVlOiB0aGlzLl9kZWxpdmVyeVF1ZXVlIH0pKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkTGF5b3V0Q2hhbmdlOiBFdmVudDxFZGl0b3JMYXlvdXRJbmZvPiA9IHRoaXMuX29uRGlkTGF5b3V0Q2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclRleHRGb2N1czogQm9vbGVhbkV2ZW50RW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBCb29sZWFuRXZlbnRFbWl0dGVyKHsgZGVsaXZlcnlRdWV1ZTogdGhpcy5fZGVsaXZlcnlRdWV1ZSB9KSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZEZvY3VzRWRpdG9yVGV4dDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9lZGl0b3JUZXh0Rm9jdXMub25EaWRDaGFuZ2VUb1RydWU7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZEJsdXJFZGl0b3JUZXh0OiBFdmVudDx2b2lkPiA9IHRoaXMuX2VkaXRvclRleHRGb2N1cy5vbkRpZENoYW5nZVRvRmFsc2U7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yV2lkZ2V0Rm9jdXM6IEJvb2xlYW5FdmVudEVtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgQm9vbGVhbkV2ZW50RW1pdHRlcih7IGRlbGl2ZXJ5UXVldWU6IHRoaXMuX2RlbGl2ZXJ5UXVldWUgfSkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRGb2N1c0VkaXRvcldpZGdldDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9lZGl0b3JXaWRnZXRGb2N1cy5vbkRpZENoYW5nZVRvVHJ1ZTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQmx1ckVkaXRvcldpZGdldDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9lZGl0b3JXaWRnZXRGb2N1cy5vbkRpZENoYW5nZVRvRmFsc2U7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25XaWxsVHlwZTogRW1pdHRlcjxzdHJpbmc+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEludGVyYWN0aW9uRW1pdHRlcjxzdHJpbmc+KHRoaXMuX2NvbnRyaWJ1dGlvbnMsIHRoaXMuX2RlbGl2ZXJ5UXVldWUpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uV2lsbFR5cGUgPSB0aGlzLl9vbldpbGxUeXBlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkVHlwZTogRW1pdHRlcjxzdHJpbmc+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEludGVyYWN0aW9uRW1pdHRlcjxzdHJpbmc+KHRoaXMuX2NvbnRyaWJ1dGlvbnMsIHRoaXMuX2RlbGl2ZXJ5UXVldWUpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkVHlwZSA9IHRoaXMuX29uRGlkVHlwZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENvbXBvc2l0aW9uU3RhcnQ6IEVtaXR0ZXI8dm9pZD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgSW50ZXJhY3Rpb25FbWl0dGVyPHZvaWQ+KHRoaXMuX2NvbnRyaWJ1dGlvbnMsIHRoaXMuX2RlbGl2ZXJ5UXVldWUpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ29tcG9zaXRpb25TdGFydCA9IHRoaXMuX29uRGlkQ29tcG9zaXRpb25TdGFydC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENvbXBvc2l0aW9uRW5kOiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEludGVyYWN0aW9uRW1pdHRlcjx2b2lkPih0aGlzLl9jb250cmlidXRpb25zLCB0aGlzLl9kZWxpdmVyeVF1ZXVlKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENvbXBvc2l0aW9uRW5kID0gdGhpcy5fb25EaWRDb21wb3NpdGlvbkVuZC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFBhc3RlOiBFbWl0dGVyPGVkaXRvckJyb3dzZXIuSVBhc3RlRXZlbnQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEludGVyYWN0aW9uRW1pdHRlcjxlZGl0b3JCcm93c2VyLklQYXN0ZUV2ZW50Pih0aGlzLl9jb250cmlidXRpb25zLCB0aGlzLl9kZWxpdmVyeVF1ZXVlKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZFBhc3RlID0gdGhpcy5fb25EaWRQYXN0ZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbk1vdXNlVXA6IEVtaXR0ZXI8ZWRpdG9yQnJvd3Nlci5JRWRpdG9yTW91c2VFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgSW50ZXJhY3Rpb25FbWl0dGVyPGVkaXRvckJyb3dzZXIuSUVkaXRvck1vdXNlRXZlbnQ+KHRoaXMuX2NvbnRyaWJ1dGlvbnMsIHRoaXMuX2RlbGl2ZXJ5UXVldWUpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uTW91c2VVcDogRXZlbnQ8ZWRpdG9yQnJvd3Nlci5JRWRpdG9yTW91c2VFdmVudD4gPSB0aGlzLl9vbk1vdXNlVXAuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25Nb3VzZURvd246IEVtaXR0ZXI8ZWRpdG9yQnJvd3Nlci5JRWRpdG9yTW91c2VFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgSW50ZXJhY3Rpb25FbWl0dGVyPGVkaXRvckJyb3dzZXIuSUVkaXRvck1vdXNlRXZlbnQ+KHRoaXMuX2NvbnRyaWJ1dGlvbnMsIHRoaXMuX2RlbGl2ZXJ5UXVldWUpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uTW91c2VEb3duOiBFdmVudDxlZGl0b3JCcm93c2VyLklFZGl0b3JNb3VzZUV2ZW50PiA9IHRoaXMuX29uTW91c2VEb3duLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uTW91c2VEcmFnOiBFbWl0dGVyPGVkaXRvckJyb3dzZXIuSUVkaXRvck1vdXNlRXZlbnQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEludGVyYWN0aW9uRW1pdHRlcjxlZGl0b3JCcm93c2VyLklFZGl0b3JNb3VzZUV2ZW50Pih0aGlzLl9jb250cmlidXRpb25zLCB0aGlzLl9kZWxpdmVyeVF1ZXVlKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbk1vdXNlRHJhZzogRXZlbnQ8ZWRpdG9yQnJvd3Nlci5JRWRpdG9yTW91c2VFdmVudD4gPSB0aGlzLl9vbk1vdXNlRHJhZy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbk1vdXNlRHJvcDogRW1pdHRlcjxlZGl0b3JCcm93c2VyLklQYXJ0aWFsRWRpdG9yTW91c2VFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgSW50ZXJhY3Rpb25FbWl0dGVyPGVkaXRvckJyb3dzZXIuSVBhcnRpYWxFZGl0b3JNb3VzZUV2ZW50Pih0aGlzLl9jb250cmlidXRpb25zLCB0aGlzLl9kZWxpdmVyeVF1ZXVlKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbk1vdXNlRHJvcDogRXZlbnQ8ZWRpdG9yQnJvd3Nlci5JUGFydGlhbEVkaXRvck1vdXNlRXZlbnQ+ID0gdGhpcy5fb25Nb3VzZURyb3AuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25Nb3VzZURyb3BDYW5jZWxlZDogRW1pdHRlcjx2b2lkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBJbnRlcmFjdGlvbkVtaXR0ZXI8dm9pZD4odGhpcy5fY29udHJpYnV0aW9ucywgdGhpcy5fZGVsaXZlcnlRdWV1ZSkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25Nb3VzZURyb3BDYW5jZWxlZDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbk1vdXNlRHJvcENhbmNlbGVkLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRHJvcEludG9FZGl0b3IgPSB0aGlzLl9yZWdpc3RlcihuZXcgSW50ZXJhY3Rpb25FbWl0dGVyPHsgcmVhZG9ubHkgcG9zaXRpb246IElQb3NpdGlvbjsgcmVhZG9ubHkgZXZlbnQ6IERyYWdFdmVudCB9Pih0aGlzLl9jb250cmlidXRpb25zLCB0aGlzLl9kZWxpdmVyeVF1ZXVlKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRyb3BJbnRvRWRpdG9yID0gdGhpcy5fb25Ecm9wSW50b0VkaXRvci5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkNvbnRleHRNZW51OiBFbWl0dGVyPGVkaXRvckJyb3dzZXIuSUVkaXRvck1vdXNlRXZlbnQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEludGVyYWN0aW9uRW1pdHRlcjxlZGl0b3JCcm93c2VyLklFZGl0b3JNb3VzZUV2ZW50Pih0aGlzLl9jb250cmlidXRpb25zLCB0aGlzLl9kZWxpdmVyeVF1ZXVlKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkNvbnRleHRNZW51OiBFdmVudDxlZGl0b3JCcm93c2VyLklFZGl0b3JNb3VzZUV2ZW50PiA9IHRoaXMuX29uQ29udGV4dE1lbnUuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25Nb3VzZU1vdmU6IEVtaXR0ZXI8ZWRpdG9yQnJvd3Nlci5JRWRpdG9yTW91c2VFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgSW50ZXJhY3Rpb25FbWl0dGVyPGVkaXRvckJyb3dzZXIuSUVkaXRvck1vdXNlRXZlbnQ+KHRoaXMuX2NvbnRyaWJ1dGlvbnMsIHRoaXMuX2RlbGl2ZXJ5UXVldWUpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uTW91c2VNb3ZlOiBFdmVudDxlZGl0b3JCcm93c2VyLklFZGl0b3JNb3VzZUV2ZW50PiA9IHRoaXMuX29uTW91c2VNb3ZlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uTW91c2VMZWF2ZTogRW1pdHRlcjxlZGl0b3JCcm93c2VyLklQYXJ0aWFsRWRpdG9yTW91c2VFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgSW50ZXJhY3Rpb25FbWl0dGVyPGVkaXRvckJyb3dzZXIuSVBhcnRpYWxFZGl0b3JNb3VzZUV2ZW50Pih0aGlzLl9jb250cmlidXRpb25zLCB0aGlzLl9kZWxpdmVyeVF1ZXVlKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbk1vdXNlTGVhdmU6IEV2ZW50PGVkaXRvckJyb3dzZXIuSVBhcnRpYWxFZGl0b3JNb3VzZUV2ZW50PiA9IHRoaXMuX29uTW91c2VMZWF2ZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbk1vdXNlV2hlZWw6IEVtaXR0ZXI8SU1vdXNlV2hlZWxFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgSW50ZXJhY3Rpb25FbWl0dGVyPElNb3VzZVdoZWVsRXZlbnQ+KHRoaXMuX2NvbnRyaWJ1dGlvbnMsIHRoaXMuX2RlbGl2ZXJ5UXVldWUpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uTW91c2VXaGVlbDogRXZlbnQ8SU1vdXNlV2hlZWxFdmVudD4gPSB0aGlzLl9vbk1vdXNlV2hlZWwuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25LZXlVcDogRW1pdHRlcjxJS2V5Ym9hcmRFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgSW50ZXJhY3Rpb25FbWl0dGVyPElLZXlib2FyZEV2ZW50Pih0aGlzLl9jb250cmlidXRpb25zLCB0aGlzLl9kZWxpdmVyeVF1ZXVlKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbktleVVwOiBFdmVudDxJS2V5Ym9hcmRFdmVudD4gPSB0aGlzLl9vbktleVVwLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uS2V5RG93bjogRW1pdHRlcjxJS2V5Ym9hcmRFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgSW50ZXJhY3Rpb25FbWl0dGVyPElLZXlib2FyZEV2ZW50Pih0aGlzLl9jb250cmlidXRpb25zLCB0aGlzLl9kZWxpdmVyeVF1ZXVlKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbktleURvd246IEV2ZW50PElLZXlib2FyZEV2ZW50PiA9IHRoaXMuX29uS2V5RG93bi5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENvbnRlbnRTaXplQ2hhbmdlOiBFbWl0dGVyPGVkaXRvckNvbW1vbi5JQ29udGVudFNpemVDaGFuZ2VkRXZlbnQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8ZWRpdG9yQ29tbW9uLklDb250ZW50U2l6ZUNoYW5nZWRFdmVudD4oeyBkZWxpdmVyeVF1ZXVlOiB0aGlzLl9kZWxpdmVyeVF1ZXVlIH0pKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ29udGVudFNpemVDaGFuZ2U6IEV2ZW50PGVkaXRvckNvbW1vbi5JQ29udGVudFNpemVDaGFuZ2VkRXZlbnQ+ID0gdGhpcy5fb25EaWRDb250ZW50U2l6ZUNoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFNjcm9sbENoYW5nZTogRW1pdHRlcjxlZGl0b3JDb21tb24uSVNjcm9sbEV2ZW50PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPGVkaXRvckNvbW1vbi5JU2Nyb2xsRXZlbnQ+KHsgZGVsaXZlcnlRdWV1ZTogdGhpcy5fZGVsaXZlcnlRdWV1ZSB9KSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZFNjcm9sbENoYW5nZTogRXZlbnQ8ZWRpdG9yQ29tbW9uLklTY3JvbGxFdmVudD4gPSB0aGlzLl9vbkRpZFNjcm9sbENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVZpZXdab25lczogRW1pdHRlcjx2b2lkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KHsgZGVsaXZlcnlRdWV1ZTogdGhpcy5fZGVsaXZlcnlRdWV1ZSB9KSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZVZpZXdab25lczogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZVZpZXdab25lcy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUhpZGRlbkFyZWFzOiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oeyBkZWxpdmVyeVF1ZXVlOiB0aGlzLl9kZWxpdmVyeVF1ZXVlIH0pKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlSGlkZGVuQXJlYXM6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VIaWRkZW5BcmVhcy5ldmVudDtcblxuXHRwcml2YXRlIF91cGRhdGVDb3VudGVyID0gMDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbldpbGxUcmlnZ2VyRWRpdG9yT3BlcmF0aW9uRXZlbnQ6IEVtaXR0ZXI8ZWRpdG9yQ29tbW9uLklUcmlnZ2VyRWRpdG9yT3BlcmF0aW9uRXZlbnQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8ZWRpdG9yQ29tbW9uLklUcmlnZ2VyRWRpdG9yT3BlcmF0aW9uRXZlbnQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25XaWxsVHJpZ2dlckVkaXRvck9wZXJhdGlvbkV2ZW50OiBFdmVudDxlZGl0b3JDb21tb24uSVRyaWdnZXJFZGl0b3JPcGVyYXRpb25FdmVudD4gPSB0aGlzLl9vbldpbGxUcmlnZ2VyRWRpdG9yT3BlcmF0aW9uRXZlbnQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25CZWdpblVwZGF0ZTogRW1pdHRlcjx2b2lkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25CZWdpblVwZGF0ZTogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkJlZ2luVXBkYXRlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRW5kVXBkYXRlOiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkVuZFVwZGF0ZTogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkVuZFVwZGF0ZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkJlZm9yZUV4ZWN1dGVFZGl0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBzb3VyY2U6IHN0cmluZyB8IHVuZGVmaW5lZCB9PigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uQmVmb3JlRXhlY3V0ZUVkaXQgPSB0aGlzLl9vbkJlZm9yZUV4ZWN1dGVFZGl0LmV2ZW50O1xuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdHB1YmxpYyBnZXQgaXNTaW1wbGVXaWRnZXQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbmZpZ3VyYXRpb24uaXNTaW1wbGVXaWRnZXQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGNvbnRleHRNZW51SWQoKTogTWVudUlkIHtcblx0XHRyZXR1cm4gdGhpcy5fY29uZmlndXJhdGlvbi5jb250ZXh0TWVudUlkO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdGVsZW1ldHJ5RGF0YT86IG9iamVjdDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kb21FbGVtZW50OiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb3ZlcmZsb3dXaWRnZXRzRG9tTm9kZTogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2lkOiBudW1iZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb246IElFZGl0b3JDb25maWd1cmF0aW9uO1xuXHRwcml2YXRlIF9jb250cmlidXRpb25zRGlzcG9zYWJsZTogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQ7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9hY3Rpb25zID0gbmV3IE1hcDxzdHJpbmcsIGVkaXRvckNvbW1vbi5JRWRpdG9yQWN0aW9uPigpO1xuXG5cdC8vIC0tLSBNZW1iZXJzIGxvZ2ljYWxseSBhc3NvY2lhdGVkIHRvIGEgbW9kZWxcblx0cHJvdGVjdGVkIF9tb2RlbERhdGE6IE1vZGVsRGF0YSB8IG51bGw7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2U7XG5cdGdldCBjb250ZXh0S2V5U2VydmljZSgpIHsgcmV0dXJuIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlOyB9XG5cdHByaXZhdGUgcmVhZG9ubHkgX25vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX2NvZGVFZGl0b3JTZXJ2aWNlOiBJQ29kZUVkaXRvclNlcnZpY2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZTtcblxuXHRwcml2YXRlIF9jb250ZW50V2lkZ2V0czogeyBba2V5OiBzdHJpbmddOiBJQ29udGVudFdpZGdldERhdGEgfTtcblx0cHJpdmF0ZSBfb3ZlcmxheVdpZGdldHM6IHsgW2tleTogc3RyaW5nXTogSU92ZXJsYXlXaWRnZXREYXRhIH07XG5cdHByaXZhdGUgX2dseXBoTWFyZ2luV2lkZ2V0czogeyBba2V5OiBzdHJpbmddOiBJR2x5cGhNYXJnaW5XaWRnZXREYXRhIH07XG5cblx0LyoqXG5cdCAqIG1hcCBmcm9tIFwicGFyZW50XCIgZGVjb3JhdGlvbiB0eXBlIHRvIGxpdmUgZGVjb3JhdGlvbiBpZHMuXG5cdCAqL1xuXHRwcml2YXRlIF9kZWNvcmF0aW9uVHlwZUtleXNUb0lkczogeyBbZGVjb3JhdGlvblR5cGVLZXk6IHN0cmluZ106IHN0cmluZ1tdIH07XG5cdHByaXZhdGUgX2RlY29yYXRpb25UeXBlU3VidHlwZXM6IHsgW2RlY29yYXRpb25UeXBlS2V5OiBzdHJpbmddOiB7IFtzdWJ0eXBlOiBzdHJpbmddOiBib29sZWFuIH0gfTtcblxuXHRwcml2YXRlIF9iYW5uZXJEb21Ob2RlOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG5cdHByaXZhdGUgX2Ryb3BJbnRvRWRpdG9yRGVjb3JhdGlvbnM6IEVkaXRvckRlY29yYXRpb25zQ29sbGVjdGlvbiA9IHRoaXMuY3JlYXRlRGVjb3JhdGlvbnNDb2xsZWN0aW9uKCk7XG5cblx0cHVibGljIGluQ29tcG9zaXRpb246IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRkb21FbGVtZW50OiBIVE1MRWxlbWVudCxcblx0XHRfb3B0aW9uczogUmVhZG9ubHk8SUVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnM+LFxuXHRcdGNvZGVFZGl0b3JXaWRnZXRPcHRpb25zOiBJQ29kZUVkaXRvcldpZGdldE9wdGlvbnMsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2Ugbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2VydmljZSBhY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRjb2RlRWRpdG9yU2VydmljZS53aWxsQ3JlYXRlQ29kZUVkaXRvcigpO1xuXG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHsgLi4uX29wdGlvbnMgfTtcblxuXHRcdHRoaXMuX2RvbUVsZW1lbnQgPSBkb21FbGVtZW50O1xuXHRcdHRoaXMuX292ZXJmbG93V2lkZ2V0c0RvbU5vZGUgPSBvcHRpb25zLm92ZXJmbG93V2lkZ2V0c0RvbU5vZGU7XG5cdFx0ZGVsZXRlIG9wdGlvbnMub3ZlcmZsb3dXaWRnZXRzRG9tTm9kZTtcblx0XHR0aGlzLl9pZCA9ICgrK0VESVRPUl9JRCk7XG5cdFx0dGhpcy5fZGVjb3JhdGlvblR5cGVLZXlzVG9JZHMgPSB7fTtcblx0XHR0aGlzLl9kZWNvcmF0aW9uVHlwZVN1YnR5cGVzID0ge307XG5cdFx0dGhpcy5fdGVsZW1ldHJ5RGF0YSA9IGNvZGVFZGl0b3JXaWRnZXRPcHRpb25zLnRlbGVtZXRyeURhdGE7XG5cblx0XHR0aGlzLl9jb25maWd1cmF0aW9uID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5fY3JlYXRlQ29uZmlndXJhdGlvbihjb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucy5pc1NpbXBsZVdpZGdldCB8fCBmYWxzZSxcblx0XHRcdGNvZGVFZGl0b3JXaWRnZXRPcHRpb25zLmNvbnRleHRNZW51SWQgPz8gKGNvZGVFZGl0b3JXaWRnZXRPcHRpb25zLmlzU2ltcGxlV2lkZ2V0ID8gTWVudUlkLlNpbXBsZUVkaXRvckNvbnRleHQgOiBNZW51SWQuRWRpdG9yQ29udGV4dCksXG5cdFx0XHRvcHRpb25zLCBhY2Nlc3NpYmlsaXR5U2VydmljZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbmZpZ3VyYXRpb24ub25EaWRDaGFuZ2UoKGUpID0+IHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbi5maXJlKGUpO1xuXG5cdFx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5fY29uZmlndXJhdGlvbi5vcHRpb25zO1xuXHRcdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ubGF5b3V0SW5mbykpIHtcblx0XHRcdFx0Y29uc3QgbGF5b3V0SW5mbyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5sYXlvdXRJbmZvKTtcblx0XHRcdFx0dGhpcy5fb25EaWRMYXlvdXRDaGFuZ2UuZmlyZShsYXlvdXRJbmZvKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9jb250ZXh0S2V5U2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKGNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZCh0aGlzLl9kb21FbGVtZW50KSk7XG5cdFx0aWYgKGNvZGVFZGl0b3JXaWRnZXRPcHRpb25zLmNvbnRleHRLZXlWYWx1ZXMpIHtcblx0XHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGNvZGVFZGl0b3JXaWRnZXRPcHRpb25zLmNvbnRleHRLZXlWYWx1ZXMpKSB7XG5cdFx0XHRcdHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZUtleShrZXksIHZhbHVlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZSA9IG5vdGlmaWNhdGlvblNlcnZpY2U7XG5cdFx0dGhpcy5fY29kZUVkaXRvclNlcnZpY2UgPSBjb2RlRWRpdG9yU2VydmljZTtcblx0XHR0aGlzLl9jb21tYW5kU2VydmljZSA9IGNvbW1hbmRTZXJ2aWNlO1xuXHRcdHRoaXMuX3RoZW1lU2VydmljZSA9IHRoZW1lU2VydmljZTtcblx0XHR0aGlzLl9yZWdpc3RlcihuZXcgRWRpdG9yQ29udGV4dEtleXNNYW5hZ2VyKHRoaXMsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobmV3IEVkaXRvck1vZGVDb250ZXh0KHRoaXMsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSkpO1xuXG5cdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UgPSB0aGlzLl9yZWdpc3RlcihpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVDaGlsZChuZXcgU2VydmljZUNvbGxlY3Rpb24oW0lDb250ZXh0S2V5U2VydmljZSwgdGhpcy5fY29udGV4dEtleVNlcnZpY2VdKSkpO1xuXG5cdFx0dGhpcy5fbW9kZWxEYXRhID0gbnVsbDtcblxuXHRcdHRoaXMuX2NvbnRlbnRXaWRnZXRzID0ge307XG5cdFx0dGhpcy5fb3ZlcmxheVdpZGdldHMgPSB7fTtcblx0XHR0aGlzLl9nbHlwaE1hcmdpbldpZGdldHMgPSB7fTtcblxuXHRcdGxldCBjb250cmlidXRpb25zOiBJRWRpdG9yQ29udHJpYnV0aW9uRGVzY3JpcHRpb25bXTtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShjb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucy5jb250cmlidXRpb25zKSkge1xuXHRcdFx0Y29udHJpYnV0aW9ucyA9IGNvZGVFZGl0b3JXaWRnZXRPcHRpb25zLmNvbnRyaWJ1dGlvbnM7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnRyaWJ1dGlvbnMgPSBFZGl0b3JFeHRlbnNpb25zUmVnaXN0cnkuZ2V0RWRpdG9yQ29udHJpYnV0aW9ucygpO1xuXHRcdH1cblx0XHR0aGlzLl9jb250cmlidXRpb25zLmluaXRpYWxpemUodGhpcywgY29udHJpYnV0aW9ucywgdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdFx0Zm9yIChjb25zdCBhY3Rpb24gb2YgRWRpdG9yRXh0ZW5zaW9uc1JlZ2lzdHJ5LmdldEVkaXRvckFjdGlvbnMoKSkge1xuXHRcdFx0aWYgKHRoaXMuX2FjdGlvbnMuaGFzKGFjdGlvbi5pZCkpIHtcblx0XHRcdFx0b25VbmV4cGVjdGVkRXJyb3IobmV3IEVycm9yKGBDYW5ub3QgaGF2ZSB0d28gYWN0aW9ucyB3aXRoIHRoZSBzYW1lIGlkICR7YWN0aW9uLmlkfWApKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpbnRlcm5hbEFjdGlvbiA9IG5ldyBJbnRlcm5hbEVkaXRvckFjdGlvbihcblx0XHRcdFx0YWN0aW9uLmlkLFxuXHRcdFx0XHRhY3Rpb24ubGFiZWwsXG5cdFx0XHRcdGFjdGlvbi5hbGlhcyxcblx0XHRcdFx0YWN0aW9uLm1ldGFkYXRhLFxuXHRcdFx0XHRhY3Rpb24ucHJlY29uZGl0aW9uID8/IHVuZGVmaW5lZCxcblx0XHRcdFx0KGFyZ3M6IHVua25vd24pOiBQcm9taXNlPHZvaWQ+ID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oKGFjY2Vzc29yKSA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGFjdGlvbi5ydW5FZGl0b3JDb21tYW5kKGFjY2Vzc29yLCB0aGlzLCBhcmdzKSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlXG5cdFx0XHQpO1xuXHRcdFx0dGhpcy5fYWN0aW9ucy5zZXQoaW50ZXJuYWxBY3Rpb24uaWQsIGludGVybmFsQWN0aW9uKTtcblx0XHR9XG5cblx0XHRjb25zdCBpc0Ryb3BJbnRvRW5hYmxlZCA9ICgpID0+IHtcblx0XHRcdHJldHVybiAhdGhpcy5fY29uZmlndXJhdGlvbi5vcHRpb25zLmdldChFZGl0b3JPcHRpb24ucmVhZE9ubHkpXG5cdFx0XHRcdCYmIHRoaXMuX2NvbmZpZ3VyYXRpb24ub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmRyb3BJbnRvRWRpdG9yKS5lbmFibGVkO1xuXHRcdH07XG5cblx0XHR0aGlzLl9yZWdpc3RlcihuZXcgZG9tLkRyYWdBbmREcm9wT2JzZXJ2ZXIodGhpcy5fZG9tRWxlbWVudCwge1xuXHRcdFx0b25EcmFnT3ZlcjogZSA9PiB7XG5cdFx0XHRcdGlmICghaXNEcm9wSW50b0VuYWJsZWQoKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHRhcmdldCA9IHRoaXMuZ2V0VGFyZ2V0QXRDbGllbnRQb2ludChlLmNsaWVudFgsIGUuY2xpZW50WSk7XG5cdFx0XHRcdGlmICh0YXJnZXQ/LnBvc2l0aW9uKSB7XG5cdFx0XHRcdFx0dGhpcy5zaG93RHJvcEluZGljYXRvckF0KHRhcmdldC5wb3NpdGlvbik7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRvbkRyb3A6IGFzeW5jIGUgPT4ge1xuXHRcdFx0XHRpZiAoIWlzRHJvcEludG9FbmFibGVkKCkpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLnJlbW92ZURyb3BJbmRpY2F0b3IoKTtcblxuXHRcdFx0XHRpZiAoIWUuZGF0YVRyYW5zZmVyKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgdGFyZ2V0ID0gdGhpcy5nZXRUYXJnZXRBdENsaWVudFBvaW50KGUuY2xpZW50WCwgZS5jbGllbnRZKTtcblx0XHRcdFx0aWYgKHRhcmdldD8ucG9zaXRpb24pIHtcblx0XHRcdFx0XHR0aGlzLl9vbkRyb3BJbnRvRWRpdG9yLmZpcmUoeyBwb3NpdGlvbjogdGFyZ2V0LnBvc2l0aW9uLCBldmVudDogZSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdG9uRHJhZ0xlYXZlOiAoKSA9PiB7XG5cdFx0XHRcdHRoaXMucmVtb3ZlRHJvcEluZGljYXRvcigpO1xuXHRcdFx0fSxcblx0XHRcdG9uRHJhZ0VuZDogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnJlbW92ZURyb3BJbmRpY2F0b3IoKTtcblx0XHRcdH0sXG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fY29kZUVkaXRvclNlcnZpY2UuYWRkQ29kZUVkaXRvcih0aGlzKTtcblx0fVxuXG5cdHB1YmxpYyB3cml0ZVNjcmVlblJlYWRlckNvbnRlbnQocmVhc29uOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9tb2RlbERhdGE/LnZpZXcud3JpdGVTY3JlZW5SZWFkZXJDb250ZW50KHJlYXNvbik7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2NyZWF0ZUNvbmZpZ3VyYXRpb24oaXNTaW1wbGVXaWRnZXQ6IGJvb2xlYW4sIGNvbnRleHRNZW51SWQ6IE1lbnVJZCwgb3B0aW9uczogUmVhZG9ubHk8SUVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnM+LCBhY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlKTogRWRpdG9yQ29uZmlndXJhdGlvbiB7XG5cdFx0cmV0dXJuIG5ldyBFZGl0b3JDb25maWd1cmF0aW9uKGlzU2ltcGxlV2lkZ2V0LCBjb250ZXh0TWVudUlkLCBvcHRpb25zLCB0aGlzLl9kb21FbGVtZW50LCBhY2Nlc3NpYmlsaXR5U2VydmljZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0SWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRFZGl0b3JUeXBlKCkgKyAnOicgKyB0aGlzLl9pZDtcblx0fVxuXG5cdHB1YmxpYyBnZXRFZGl0b3JUeXBlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGVkaXRvckNvbW1vbi5FZGl0b3JUeXBlLklDb2RlRWRpdG9yO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fY29kZUVkaXRvclNlcnZpY2UucmVtb3ZlQ29kZUVkaXRvcih0aGlzKTtcblxuXHRcdHRoaXMuX2FjdGlvbnMuY2xlYXIoKTtcblx0XHR0aGlzLl9jb250ZW50V2lkZ2V0cyA9IHt9O1xuXHRcdHRoaXMuX292ZXJsYXlXaWRnZXRzID0ge307XG5cblx0XHR0aGlzLl9yZW1vdmVEZWNvcmF0aW9uVHlwZXMoKTtcblx0XHR0aGlzLl9wb3N0RGV0YWNoTW9kZWxDbGVhbnVwKHRoaXMuX2RldGFjaE1vZGVsKCkpO1xuXG5cdFx0dGhpcy5fb25EaWREaXNwb3NlLmZpcmUoKTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHB1YmxpYyBpbnZva2VXaXRoaW5Db250ZXh0PFQ+KGZuOiAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpID0+IFQpOiBUIHtcblx0XHRyZXR1cm4gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZm4pO1xuXHR9XG5cblx0cHVibGljIHVwZGF0ZU9wdGlvbnMobmV3T3B0aW9uczogUmVhZG9ubHk8SUVkaXRvck9wdGlvbnM+IHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5fY29uZmlndXJhdGlvbi51cGRhdGVPcHRpb25zKG5ld09wdGlvbnMgfHwge30pO1xuXHR9XG5cblx0cHVibGljIGdldE9wdGlvbnMoKTogSUNvbXB1dGVkRWRpdG9yT3B0aW9ucyB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbmZpZ3VyYXRpb24ub3B0aW9ucztcblx0fVxuXG5cdHB1YmxpYyBnZXRPcHRpb248VCBleHRlbmRzIEVkaXRvck9wdGlvbj4oaWQ6IFQpOiBGaW5kQ29tcHV0ZWRFZGl0b3JPcHRpb25WYWx1ZUJ5SWQ8VD4ge1xuXHRcdHJldHVybiB0aGlzLl9jb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KGlkKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRSYXdPcHRpb25zKCk6IElFZGl0b3JPcHRpb25zIHtcblx0XHRyZXR1cm4gdGhpcy5fY29uZmlndXJhdGlvbi5nZXRSYXdPcHRpb25zKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0T3ZlcmZsb3dXaWRnZXRzRG9tTm9kZSgpOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX292ZXJmbG93V2lkZ2V0c0RvbU5vZGU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Q29uZmlndXJlZFdvcmRBdFBvc2l0aW9uKHBvc2l0aW9uOiBQb3NpdGlvbik6IElXb3JkQXRQb3NpdGlvbiB8IG51bGwge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIFdvcmRPcGVyYXRpb25zLmdldFdvcmRBdFBvc2l0aW9uKHRoaXMuX21vZGVsRGF0YS5tb2RlbCwgdGhpcy5fY29uZmlndXJhdGlvbi5vcHRpb25zLmdldChFZGl0b3JPcHRpb24ud29yZFNlcGFyYXRvcnMpLCB0aGlzLl9jb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi53b3JkU2VnbWVudGVyTG9jYWxlcyksIHBvc2l0aW9uKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWYWx1ZShvcHRpb25zOiB7IHByZXNlcnZlQk9NOiBib29sZWFuOyBsaW5lRW5kaW5nOiBzdHJpbmcgfSB8IG51bGwgPSBudWxsKTogc3RyaW5nIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByZXNlcnZlQk9NOiBib29sZWFuID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5wcmVzZXJ2ZUJPTSkgPyB0cnVlIDogZmFsc2U7XG5cdFx0bGV0IGVvbFByZWZlcmVuY2UgPSBFbmRPZkxpbmVQcmVmZXJlbmNlLlRleHREZWZpbmVkO1xuXHRcdGlmIChvcHRpb25zICYmIG9wdGlvbnMubGluZUVuZGluZyAmJiBvcHRpb25zLmxpbmVFbmRpbmcgPT09ICdcXG4nKSB7XG5cdFx0XHRlb2xQcmVmZXJlbmNlID0gRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRjtcblx0XHR9IGVsc2UgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5saW5lRW5kaW5nICYmIG9wdGlvbnMubGluZUVuZGluZyA9PT0gJ1xcclxcbicpIHtcblx0XHRcdGVvbFByZWZlcmVuY2UgPSBFbmRPZkxpbmVQcmVmZXJlbmNlLkNSTEY7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tb2RlbERhdGEubW9kZWwuZ2V0VmFsdWUoZW9sUHJlZmVyZW5jZSwgcHJlc2VydmVCT00pO1xuXHR9XG5cblx0cHVibGljIHNldFZhbHVlKG5ld1ZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5fYmVnaW5VcGRhdGUoKTtcblx0XHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX21vZGVsRGF0YS5tb2RlbC5zZXRWYWx1ZShuZXdWYWx1ZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX2VuZFVwZGF0ZSgpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXRNb2RlbCgpOiBJVGV4dE1vZGVsIHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbW9kZWxEYXRhLm1vZGVsO1xuXHR9XG5cblx0cHVibGljIHNldE1vZGVsKF9tb2RlbDogSVRleHRNb2RlbCB8IGVkaXRvckNvbW1vbi5JRGlmZkVkaXRvck1vZGVsIHwgZWRpdG9yQ29tbW9uLklEaWZmRWRpdG9yVmlld01vZGVsIHwgbnVsbCA9IG51bGwpOiB2b2lkIHtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5fYmVnaW5VcGRhdGUoKTtcblx0XHRcdGNvbnN0IG1vZGVsID0gPElUZXh0TW9kZWwgfCBudWxsPl9tb2RlbDtcblx0XHRcdGlmICh0aGlzLl9tb2RlbERhdGEgPT09IG51bGwgJiYgbW9kZWwgPT09IG51bGwpIHtcblx0XHRcdFx0Ly8gQ3VycmVudCBtb2RlbCBpcyB0aGUgbmV3IG1vZGVsXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLl9tb2RlbERhdGEgJiYgdGhpcy5fbW9kZWxEYXRhLm1vZGVsID09PSBtb2RlbCkge1xuXHRcdFx0XHQvLyBDdXJyZW50IG1vZGVsIGlzIHRoZSBuZXcgbW9kZWxcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBlOiBlZGl0b3JDb21tb24uSU1vZGVsQ2hhbmdlZEV2ZW50ID0ge1xuXHRcdFx0XHRvbGRNb2RlbFVybDogdGhpcy5fbW9kZWxEYXRhPy5tb2RlbC51cmkgfHwgbnVsbCxcblx0XHRcdFx0bmV3TW9kZWxVcmw6IG1vZGVsPy51cmkgfHwgbnVsbFxuXHRcdFx0fTtcblx0XHRcdHRoaXMuX29uV2lsbENoYW5nZU1vZGVsLmZpcmUoZSk7XG5cblx0XHRcdGNvbnN0IGhhc1RleHRGb2N1cyA9IHRoaXMuaGFzVGV4dEZvY3VzKCk7XG5cdFx0XHRjb25zdCBkZXRhY2hlZE1vZGVsID0gdGhpcy5fZGV0YWNoTW9kZWwoKTtcblx0XHRcdHRoaXMuX2F0dGFjaE1vZGVsKG1vZGVsKTtcblx0XHRcdGlmICh0aGlzLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0Ly8gd2UgaGF2ZSBhIG5ldyBtb2RlbCAod2l0aCBhIG5ldyB2aWV3KSFcblx0XHRcdFx0aWYgKGhhc1RleHRGb2N1cykge1xuXHRcdFx0XHRcdHRoaXMuZm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gd2UgaGF2ZSBubyBtb2RlbCAoYW5kIG5vIHZpZXcpIGFueW1vcmVcblx0XHRcdFx0Ly8gbWFrZSBzdXJlIHRoZSBvdXRzaWRlIHdvcmxkIGtub3dzIHdlIGFyZSBub3QgZm9jdXNlZFxuXHRcdFx0XHR0aGlzLl9lZGl0b3JUZXh0Rm9jdXMuc2V0VmFsdWUoZmFsc2UpO1xuXHRcdFx0XHR0aGlzLl9lZGl0b3JXaWRnZXRGb2N1cy5zZXRWYWx1ZShmYWxzZSk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3JlbW92ZURlY29yYXRpb25UeXBlcygpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VNb2RlbC5maXJlKGUpO1xuXHRcdFx0dGhpcy5fcG9zdERldGFjaE1vZGVsQ2xlYW51cChkZXRhY2hlZE1vZGVsKTtcblxuXHRcdFx0dGhpcy5fY29udHJpYnV0aW9uc0Rpc3Bvc2FibGUgPSB0aGlzLl9jb250cmlidXRpb25zLm9uQWZ0ZXJNb2RlbEF0dGFjaGVkKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX2VuZFVwZGF0ZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3JlbW92ZURlY29yYXRpb25UeXBlcygpOiB2b2lkIHtcblx0XHR0aGlzLl9kZWNvcmF0aW9uVHlwZUtleXNUb0lkcyA9IHt9O1xuXHRcdGlmICh0aGlzLl9kZWNvcmF0aW9uVHlwZVN1YnR5cGVzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGRlY29yYXRpb25UeXBlIGluIHRoaXMuX2RlY29yYXRpb25UeXBlU3VidHlwZXMpIHtcblx0XHRcdFx0Y29uc3Qgc3ViVHlwZXMgPSB0aGlzLl9kZWNvcmF0aW9uVHlwZVN1YnR5cGVzW2RlY29yYXRpb25UeXBlXTtcblx0XHRcdFx0Zm9yIChjb25zdCBzdWJUeXBlIGluIHN1YlR5cGVzKSB7XG5cdFx0XHRcdFx0dGhpcy5fcmVtb3ZlRGVjb3JhdGlvblR5cGUoZGVjb3JhdGlvblR5cGUgKyAnLScgKyBzdWJUeXBlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5fZGVjb3JhdGlvblR5cGVTdWJ0eXBlcyA9IHt9O1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXRWaXNpYmxlUmFuZ2VzKCk6IFJhbmdlW10ge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tb2RlbERhdGEudmlld01vZGVsLmdldFZpc2libGVSYW5nZXMoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWaXNpYmxlUmFuZ2VzUGx1c1ZpZXdwb3J0QWJvdmVCZWxvdygpOiBSYW5nZVtdIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbW9kZWxEYXRhLnZpZXdNb2RlbC5nZXRWaXNpYmxlUmFuZ2VzUGx1c1ZpZXdwb3J0QWJvdmVCZWxvdygpO1xuXHR9XG5cblx0cHVibGljIGdldFdoaXRlc3BhY2VzKCk6IElFZGl0b3JXaGl0ZXNwYWNlW10ge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tb2RlbERhdGEudmlld01vZGVsLnZpZXdMYXlvdXQuZ2V0V2hpdGVzcGFjZXMoKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9nZXRWZXJ0aWNhbE9mZnNldEFmdGVyUG9zaXRpb24obW9kZWxEYXRhOiBNb2RlbERhdGEsIG1vZGVsTGluZU51bWJlcjogbnVtYmVyLCBtb2RlbENvbHVtbjogbnVtYmVyLCBpbmNsdWRlVmlld1pvbmVzOiBib29sZWFuKTogbnVtYmVyIHtcblx0XHRjb25zdCBtb2RlbFBvc2l0aW9uID0gbW9kZWxEYXRhLm1vZGVsLnZhbGlkYXRlUG9zaXRpb24oe1xuXHRcdFx0bGluZU51bWJlcjogbW9kZWxMaW5lTnVtYmVyLFxuXHRcdFx0Y29sdW1uOiBtb2RlbENvbHVtblxuXHRcdH0pO1xuXHRcdGNvbnN0IHZpZXdQb3NpdGlvbiA9IG1vZGVsRGF0YS52aWV3TW9kZWwuY29vcmRpbmF0ZXNDb252ZXJ0ZXIuY29udmVydE1vZGVsUG9zaXRpb25Ub1ZpZXdQb3NpdGlvbihtb2RlbFBvc2l0aW9uKTtcblx0XHRyZXR1cm4gbW9kZWxEYXRhLnZpZXdNb2RlbC52aWV3TGF5b3V0LmdldFZlcnRpY2FsT2Zmc2V0QWZ0ZXJMaW5lTnVtYmVyKHZpZXdQb3NpdGlvbi5saW5lTnVtYmVyLCBpbmNsdWRlVmlld1pvbmVzKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRUb3BGb3JMaW5lTnVtYmVyKGxpbmVOdW1iZXI6IG51bWJlciwgaW5jbHVkZVZpZXdab25lczogYm9vbGVhbiA9IGZhbHNlKTogbnVtYmVyIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSkge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblx0XHRyZXR1cm4gQ29kZUVkaXRvcldpZGdldC5fZ2V0VmVydGljYWxPZmZzZXRGb3JQb3NpdGlvbih0aGlzLl9tb2RlbERhdGEsIGxpbmVOdW1iZXIsIDEsIGluY2x1ZGVWaWV3Wm9uZXMpO1xuXHR9XG5cblx0cHVibGljIGdldFRvcEZvclBvc2l0aW9uKGxpbmVOdW1iZXI6IG51bWJlciwgY29sdW1uOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXHRcdHJldHVybiBDb2RlRWRpdG9yV2lkZ2V0Ll9nZXRWZXJ0aWNhbE9mZnNldEZvclBvc2l0aW9uKHRoaXMuX21vZGVsRGF0YSwgbGluZU51bWJlciwgY29sdW1uLCBmYWxzZSk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfZ2V0VmVydGljYWxPZmZzZXRGb3JQb3NpdGlvbihtb2RlbERhdGE6IE1vZGVsRGF0YSwgbW9kZWxMaW5lTnVtYmVyOiBudW1iZXIsIG1vZGVsQ29sdW1uOiBudW1iZXIsIGluY2x1ZGVWaWV3Wm9uZXM6IGJvb2xlYW4gPSBmYWxzZSk6IG51bWJlciB7XG5cdFx0Y29uc3QgbW9kZWxQb3NpdGlvbiA9IG1vZGVsRGF0YS5tb2RlbC52YWxpZGF0ZVBvc2l0aW9uKHtcblx0XHRcdGxpbmVOdW1iZXI6IG1vZGVsTGluZU51bWJlcixcblx0XHRcdGNvbHVtbjogbW9kZWxDb2x1bW5cblx0XHR9KTtcblx0XHRjb25zdCB2aWV3UG9zaXRpb24gPSBtb2RlbERhdGEudmlld01vZGVsLmNvb3JkaW5hdGVzQ29udmVydGVyLmNvbnZlcnRNb2RlbFBvc2l0aW9uVG9WaWV3UG9zaXRpb24obW9kZWxQb3NpdGlvbik7XG5cdFx0cmV0dXJuIG1vZGVsRGF0YS52aWV3TW9kZWwudmlld0xheW91dC5nZXRWZXJ0aWNhbE9mZnNldEZvckxpbmVOdW1iZXIodmlld1Bvc2l0aW9uLmxpbmVOdW1iZXIsIGluY2x1ZGVWaWV3Wm9uZXMpO1xuXHR9XG5cblx0cHVibGljIGdldEJvdHRvbUZvckxpbmVOdW1iZXIobGluZU51bWJlcjogbnVtYmVyLCBpbmNsdWRlVmlld1pvbmVzOiBib29sZWFuID0gZmFsc2UpOiBudW1iZXIge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXHRcdGNvbnN0IG1heENvbCA9IHRoaXMuX21vZGVsRGF0YS5tb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpO1xuXHRcdHJldHVybiBDb2RlRWRpdG9yV2lkZ2V0Ll9nZXRWZXJ0aWNhbE9mZnNldEFmdGVyUG9zaXRpb24odGhpcy5fbW9kZWxEYXRhLCBsaW5lTnVtYmVyLCBtYXhDb2wsIGluY2x1ZGVWaWV3Wm9uZXMpO1xuXHR9XG5cblx0cHVibGljIHNldEhpZGRlbkFyZWFzKHJhbmdlczogSVJhbmdlW10sIHNvdXJjZT86IHVua25vd24sIGZvcmNlVXBkYXRlPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX21vZGVsRGF0YT8udmlld01vZGVsLnNldEhpZGRlbkFyZWFzKHJhbmdlcy5tYXAociA9PiBSYW5nZS5saWZ0KHIpKSwgc291cmNlLCBmb3JjZVVwZGF0ZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VmlzaWJsZUNvbHVtbkZyb21Qb3NpdGlvbihyYXdQb3NpdGlvbjogSVBvc2l0aW9uKTogbnVtYmVyIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSkge1xuXHRcdFx0cmV0dXJuIHJhd1Bvc2l0aW9uLmNvbHVtbjtcblx0XHR9XG5cblx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMuX21vZGVsRGF0YS5tb2RlbC52YWxpZGF0ZVBvc2l0aW9uKHJhd1Bvc2l0aW9uKTtcblx0XHRjb25zdCB0YWJTaXplID0gdGhpcy5fbW9kZWxEYXRhLm1vZGVsLmdldE9wdGlvbnMoKS50YWJTaXplO1xuXG5cdFx0cmV0dXJuIEN1cnNvckNvbHVtbnMudmlzaWJsZUNvbHVtbkZyb21Db2x1bW4odGhpcy5fbW9kZWxEYXRhLm1vZGVsLmdldExpbmVDb250ZW50KHBvc2l0aW9uLmxpbmVOdW1iZXIpLCBwb3NpdGlvbi5jb2x1bW4sIHRhYlNpemUpICsgMTtcblx0fVxuXG5cdHB1YmxpYyBnZXRTdGF0dXNiYXJDb2x1bW4ocmF3UG9zaXRpb246IElQb3NpdGlvbik6IG51bWJlciB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybiByYXdQb3NpdGlvbi5jb2x1bW47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLl9tb2RlbERhdGEubW9kZWwudmFsaWRhdGVQb3NpdGlvbihyYXdQb3NpdGlvbik7XG5cdFx0Y29uc3QgdGFiU2l6ZSA9IHRoaXMuX21vZGVsRGF0YS5tb2RlbC5nZXRPcHRpb25zKCkudGFiU2l6ZTtcblxuXHRcdHJldHVybiBDdXJzb3JDb2x1bW5zLnRvU3RhdHVzYmFyQ29sdW1uKHRoaXMuX21vZGVsRGF0YS5tb2RlbC5nZXRMaW5lQ29udGVudChwb3NpdGlvbi5saW5lTnVtYmVyKSwgcG9zaXRpb24uY29sdW1uLCB0YWJTaXplKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRQb3NpdGlvbigpOiBQb3NpdGlvbiB8IG51bGwge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsRGF0YS52aWV3TW9kZWwuZ2V0UG9zaXRpb24oKTtcblx0fVxuXG5cdHB1YmxpYyBzZXRQb3NpdGlvbihwb3NpdGlvbjogSVBvc2l0aW9uLCBzb3VyY2U6IHN0cmluZyA9ICdhcGknKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCFQb3NpdGlvbi5pc0lQb3NpdGlvbihwb3NpdGlvbikpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBhcmd1bWVudHMnKTtcblx0XHR9XG5cdFx0dGhpcy5fbW9kZWxEYXRhLnZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKHNvdXJjZSwgW3tcblx0XHRcdHNlbGVjdGlvblN0YXJ0TGluZU51bWJlcjogcG9zaXRpb24ubGluZU51bWJlcixcblx0XHRcdHNlbGVjdGlvblN0YXJ0Q29sdW1uOiBwb3NpdGlvbi5jb2x1bW4sXG5cdFx0XHRwb3NpdGlvbkxpbmVOdW1iZXI6IHBvc2l0aW9uLmxpbmVOdW1iZXIsXG5cdFx0XHRwb3NpdGlvbkNvbHVtbjogcG9zaXRpb24uY29sdW1uXG5cdFx0fV0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2VuZFJldmVhbFJhbmdlKG1vZGVsUmFuZ2U6IFJhbmdlLCB2ZXJ0aWNhbFR5cGU6IFZlcnRpY2FsUmV2ZWFsVHlwZSwgcmV2ZWFsSG9yaXpvbnRhbDogYm9vbGVhbiwgc2Nyb2xsVHlwZTogZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIVJhbmdlLmlzSVJhbmdlKG1vZGVsUmFuZ2UpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgYXJndW1lbnRzJyk7XG5cdFx0fVxuXHRcdGNvbnN0IHZhbGlkYXRlZE1vZGVsUmFuZ2UgPSB0aGlzLl9tb2RlbERhdGEubW9kZWwudmFsaWRhdGVSYW5nZShtb2RlbFJhbmdlKTtcblx0XHRjb25zdCB2aWV3UmFuZ2UgPSB0aGlzLl9tb2RlbERhdGEudmlld01vZGVsLmNvb3JkaW5hdGVzQ29udmVydGVyLmNvbnZlcnRNb2RlbFJhbmdlVG9WaWV3UmFuZ2UodmFsaWRhdGVkTW9kZWxSYW5nZSk7XG5cblx0XHR0aGlzLl9tb2RlbERhdGEudmlld01vZGVsLnJldmVhbFJhbmdlKCdhcGknLCByZXZlYWxIb3Jpem9udGFsLCB2aWV3UmFuZ2UsIHZlcnRpY2FsVHlwZSwgc2Nyb2xsVHlwZSk7XG5cdH1cblxuXHRwdWJsaWMgcmV2ZWFsTGluZShsaW5lTnVtYmVyOiBudW1iZXIsIHNjcm9sbFR5cGU6IGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlID0gZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUuU21vb3RoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmV2ZWFsTGluZShsaW5lTnVtYmVyLCBWZXJ0aWNhbFJldmVhbFR5cGUuU2ltcGxlLCBzY3JvbGxUeXBlKTtcblx0fVxuXG5cdHB1YmxpYyByZXZlYWxMaW5lSW5DZW50ZXIobGluZU51bWJlcjogbnVtYmVyLCBzY3JvbGxUeXBlOiBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZSA9IGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlLlNtb290aCk6IHZvaWQge1xuXHRcdHRoaXMuX3JldmVhbExpbmUobGluZU51bWJlciwgVmVydGljYWxSZXZlYWxUeXBlLkNlbnRlciwgc2Nyb2xsVHlwZSk7XG5cdH1cblxuXHRwdWJsaWMgcmV2ZWFsTGluZUluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQobGluZU51bWJlcjogbnVtYmVyLCBzY3JvbGxUeXBlOiBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZSA9IGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlLlNtb290aCk6IHZvaWQge1xuXHRcdHRoaXMuX3JldmVhbExpbmUobGluZU51bWJlciwgVmVydGljYWxSZXZlYWxUeXBlLkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0LCBzY3JvbGxUeXBlKTtcblx0fVxuXG5cdHB1YmxpYyByZXZlYWxMaW5lTmVhclRvcChsaW5lTnVtYmVyOiBudW1iZXIsIHNjcm9sbFR5cGU6IGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlID0gZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUuU21vb3RoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmV2ZWFsTGluZShsaW5lTnVtYmVyLCBWZXJ0aWNhbFJldmVhbFR5cGUuTmVhclRvcCwgc2Nyb2xsVHlwZSk7XG5cdH1cblxuXHRwcml2YXRlIF9yZXZlYWxMaW5lKGxpbmVOdW1iZXI6IG51bWJlciwgcmV2ZWFsVHlwZTogVmVydGljYWxSZXZlYWxUeXBlLCBzY3JvbGxUeXBlOiBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZSk6IHZvaWQge1xuXHRcdGlmICh0eXBlb2YgbGluZU51bWJlciAhPT0gJ251bWJlcicpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBhcmd1bWVudHMnKTtcblx0XHR9XG5cblx0XHR0aGlzLl9zZW5kUmV2ZWFsUmFuZ2UoXG5cdFx0XHRuZXcgUmFuZ2UobGluZU51bWJlciwgMSwgbGluZU51bWJlciwgMSksXG5cdFx0XHRyZXZlYWxUeXBlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRzY3JvbGxUeXBlXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyByZXZlYWxQb3NpdGlvbihwb3NpdGlvbjogSVBvc2l0aW9uLCBzY3JvbGxUeXBlOiBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZSA9IGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlLlNtb290aCk6IHZvaWQge1xuXHRcdHRoaXMuX3JldmVhbFBvc2l0aW9uKFxuXHRcdFx0cG9zaXRpb24sXG5cdFx0XHRWZXJ0aWNhbFJldmVhbFR5cGUuU2ltcGxlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdHNjcm9sbFR5cGVcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHJldmVhbFBvc2l0aW9uSW5DZW50ZXIocG9zaXRpb246IElQb3NpdGlvbiwgc2Nyb2xsVHlwZTogZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUgPSBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZS5TbW9vdGgpOiB2b2lkIHtcblx0XHR0aGlzLl9yZXZlYWxQb3NpdGlvbihcblx0XHRcdHBvc2l0aW9uLFxuXHRcdFx0VmVydGljYWxSZXZlYWxUeXBlLkNlbnRlcixcblx0XHRcdHRydWUsXG5cdFx0XHRzY3JvbGxUeXBlXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyByZXZlYWxQb3NpdGlvbkluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQocG9zaXRpb246IElQb3NpdGlvbiwgc2Nyb2xsVHlwZTogZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUgPSBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZS5TbW9vdGgpOiB2b2lkIHtcblx0XHR0aGlzLl9yZXZlYWxQb3NpdGlvbihcblx0XHRcdHBvc2l0aW9uLFxuXHRcdFx0VmVydGljYWxSZXZlYWxUeXBlLkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0LFxuXHRcdFx0dHJ1ZSxcblx0XHRcdHNjcm9sbFR5cGVcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHJldmVhbFBvc2l0aW9uTmVhclRvcChwb3NpdGlvbjogSVBvc2l0aW9uLCBzY3JvbGxUeXBlOiBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZSA9IGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlLlNtb290aCk6IHZvaWQge1xuXHRcdHRoaXMuX3JldmVhbFBvc2l0aW9uKFxuXHRcdFx0cG9zaXRpb24sXG5cdFx0XHRWZXJ0aWNhbFJldmVhbFR5cGUuTmVhclRvcCxcblx0XHRcdHRydWUsXG5cdFx0XHRzY3JvbGxUeXBlXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgX3JldmVhbFBvc2l0aW9uKHBvc2l0aW9uOiBJUG9zaXRpb24sIHZlcnRpY2FsVHlwZTogVmVydGljYWxSZXZlYWxUeXBlLCByZXZlYWxIb3Jpem9udGFsOiBib29sZWFuLCBzY3JvbGxUeXBlOiBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZSk6IHZvaWQge1xuXHRcdGlmICghUG9zaXRpb24uaXNJUG9zaXRpb24ocG9zaXRpb24pKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgYXJndW1lbnRzJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fc2VuZFJldmVhbFJhbmdlKFxuXHRcdFx0bmV3IFJhbmdlKHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbiwgcG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uKSxcblx0XHRcdHZlcnRpY2FsVHlwZSxcblx0XHRcdHJldmVhbEhvcml6b250YWwsXG5cdFx0XHRzY3JvbGxUeXBlXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBnZXRTZWxlY3Rpb24oKTogU2VsZWN0aW9uIHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbW9kZWxEYXRhLnZpZXdNb2RlbC5nZXRTZWxlY3Rpb24oKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRTZWxlY3Rpb25zKCk6IFNlbGVjdGlvbltdIHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbW9kZWxEYXRhLnZpZXdNb2RlbC5nZXRTZWxlY3Rpb25zKCk7XG5cdH1cblxuXHRwdWJsaWMgc2V0U2VsZWN0aW9uKHJhbmdlOiBJUmFuZ2UsIHNvdXJjZT86IHN0cmluZyk6IHZvaWQ7XG5cdHB1YmxpYyBzZXRTZWxlY3Rpb24oZWRpdG9yUmFuZ2U6IFJhbmdlLCBzb3VyY2U/OiBzdHJpbmcpOiB2b2lkO1xuXHRwdWJsaWMgc2V0U2VsZWN0aW9uKHNlbGVjdGlvbjogSVNlbGVjdGlvbiwgc291cmNlPzogc3RyaW5nKTogdm9pZDtcblx0cHVibGljIHNldFNlbGVjdGlvbihlZGl0b3JTZWxlY3Rpb246IFNlbGVjdGlvbiwgc291cmNlPzogc3RyaW5nKTogdm9pZDtcblx0cHVibGljIHNldFNlbGVjdGlvbihzb21ldGhpbmc6IGFueSwgc291cmNlOiBzdHJpbmcgPSAnYXBpJyk6IHZvaWQge1xuXHRcdGNvbnN0IGlzU2VsZWN0aW9uID0gU2VsZWN0aW9uLmlzSVNlbGVjdGlvbihzb21ldGhpbmcpO1xuXHRcdGNvbnN0IGlzUmFuZ2UgPSBSYW5nZS5pc0lSYW5nZShzb21ldGhpbmcpO1xuXG5cdFx0aWYgKCFpc1NlbGVjdGlvbiAmJiAhaXNSYW5nZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGFyZ3VtZW50cycpO1xuXHRcdH1cblxuXHRcdGlmIChpc1NlbGVjdGlvbikge1xuXHRcdFx0dGhpcy5fc2V0U2VsZWN0aW9uSW1wbCg8SVNlbGVjdGlvbj5zb21ldGhpbmcsIHNvdXJjZSk7XG5cdFx0fSBlbHNlIGlmIChpc1JhbmdlKSB7XG5cdFx0XHQvLyBhY3QgYXMgaWYgaXQgd2FzIGFuIElSYW5nZVxuXHRcdFx0Y29uc3Qgc2VsZWN0aW9uOiBJU2VsZWN0aW9uID0ge1xuXHRcdFx0XHRzZWxlY3Rpb25TdGFydExpbmVOdW1iZXI6IHNvbWV0aGluZy5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdHNlbGVjdGlvblN0YXJ0Q29sdW1uOiBzb21ldGhpbmcuc3RhcnRDb2x1bW4sXG5cdFx0XHRcdHBvc2l0aW9uTGluZU51bWJlcjogc29tZXRoaW5nLmVuZExpbmVOdW1iZXIsXG5cdFx0XHRcdHBvc2l0aW9uQ29sdW1uOiBzb21ldGhpbmcuZW5kQ29sdW1uXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fc2V0U2VsZWN0aW9uSW1wbChzZWxlY3Rpb24sIHNvdXJjZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2V0U2VsZWN0aW9uSW1wbChzZWw6IElTZWxlY3Rpb24sIHNvdXJjZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gbmV3IFNlbGVjdGlvbihzZWwuc2VsZWN0aW9uU3RhcnRMaW5lTnVtYmVyLCBzZWwuc2VsZWN0aW9uU3RhcnRDb2x1bW4sIHNlbC5wb3NpdGlvbkxpbmVOdW1iZXIsIHNlbC5wb3NpdGlvbkNvbHVtbik7XG5cdFx0dGhpcy5fbW9kZWxEYXRhLnZpZXdNb2RlbC5zZXRTZWxlY3Rpb25zKHNvdXJjZSwgW3NlbGVjdGlvbl0pO1xuXHR9XG5cblx0cHVibGljIHJldmVhbExpbmVzKHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBlbmRMaW5lTnVtYmVyOiBudW1iZXIsIHNjcm9sbFR5cGU6IGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlID0gZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUuU21vb3RoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmV2ZWFsTGluZXMoXG5cdFx0XHRzdGFydExpbmVOdW1iZXIsXG5cdFx0XHRlbmRMaW5lTnVtYmVyLFxuXHRcdFx0VmVydGljYWxSZXZlYWxUeXBlLlNpbXBsZSxcblx0XHRcdHNjcm9sbFR5cGVcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHJldmVhbExpbmVzSW5DZW50ZXIoc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZExpbmVOdW1iZXI6IG51bWJlciwgc2Nyb2xsVHlwZTogZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUgPSBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZS5TbW9vdGgpOiB2b2lkIHtcblx0XHR0aGlzLl9yZXZlYWxMaW5lcyhcblx0XHRcdHN0YXJ0TGluZU51bWJlcixcblx0XHRcdGVuZExpbmVOdW1iZXIsXG5cdFx0XHRWZXJ0aWNhbFJldmVhbFR5cGUuQ2VudGVyLFxuXHRcdFx0c2Nyb2xsVHlwZVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgcmV2ZWFsTGluZXNJbkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0KHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBlbmRMaW5lTnVtYmVyOiBudW1iZXIsIHNjcm9sbFR5cGU6IGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlID0gZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUuU21vb3RoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmV2ZWFsTGluZXMoXG5cdFx0XHRzdGFydExpbmVOdW1iZXIsXG5cdFx0XHRlbmRMaW5lTnVtYmVyLFxuXHRcdFx0VmVydGljYWxSZXZlYWxUeXBlLkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0LFxuXHRcdFx0c2Nyb2xsVHlwZVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgcmV2ZWFsTGluZXNOZWFyVG9wKHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBlbmRMaW5lTnVtYmVyOiBudW1iZXIsIHNjcm9sbFR5cGU6IGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlID0gZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUuU21vb3RoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmV2ZWFsTGluZXMoXG5cdFx0XHRzdGFydExpbmVOdW1iZXIsXG5cdFx0XHRlbmRMaW5lTnVtYmVyLFxuXHRcdFx0VmVydGljYWxSZXZlYWxUeXBlLk5lYXJUb3AsXG5cdFx0XHRzY3JvbGxUeXBlXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgX3JldmVhbExpbmVzKHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBlbmRMaW5lTnVtYmVyOiBudW1iZXIsIHZlcnRpY2FsVHlwZTogVmVydGljYWxSZXZlYWxUeXBlLCBzY3JvbGxUeXBlOiBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZSk6IHZvaWQge1xuXHRcdGlmICh0eXBlb2Ygc3RhcnRMaW5lTnVtYmVyICE9PSAnbnVtYmVyJyB8fCB0eXBlb2YgZW5kTGluZU51bWJlciAhPT0gJ251bWJlcicpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBhcmd1bWVudHMnKTtcblx0XHR9XG5cblx0XHR0aGlzLl9zZW5kUmV2ZWFsUmFuZ2UoXG5cdFx0XHRuZXcgUmFuZ2Uoc3RhcnRMaW5lTnVtYmVyLCAxLCBlbmRMaW5lTnVtYmVyLCAxKSxcblx0XHRcdHZlcnRpY2FsVHlwZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0c2Nyb2xsVHlwZVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgcmV2ZWFsUmFuZ2UocmFuZ2U6IElSYW5nZSwgc2Nyb2xsVHlwZTogZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUgPSBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZS5TbW9vdGgsIHJldmVhbFZlcnRpY2FsSW5DZW50ZXI6IGJvb2xlYW4gPSBmYWxzZSwgcmV2ZWFsSG9yaXpvbnRhbDogYm9vbGVhbiA9IHRydWUpOiB2b2lkIHtcblx0XHR0aGlzLl9yZXZlYWxSYW5nZShcblx0XHRcdHJhbmdlLFxuXHRcdFx0cmV2ZWFsVmVydGljYWxJbkNlbnRlciA/IFZlcnRpY2FsUmV2ZWFsVHlwZS5DZW50ZXIgOiBWZXJ0aWNhbFJldmVhbFR5cGUuU2ltcGxlLFxuXHRcdFx0cmV2ZWFsSG9yaXpvbnRhbCxcblx0XHRcdHNjcm9sbFR5cGVcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHJldmVhbFJhbmdlSW5DZW50ZXIocmFuZ2U6IElSYW5nZSwgc2Nyb2xsVHlwZTogZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUgPSBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZS5TbW9vdGgpOiB2b2lkIHtcblx0XHR0aGlzLl9yZXZlYWxSYW5nZShcblx0XHRcdHJhbmdlLFxuXHRcdFx0VmVydGljYWxSZXZlYWxUeXBlLkNlbnRlcixcblx0XHRcdHRydWUsXG5cdFx0XHRzY3JvbGxUeXBlXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyByZXZlYWxSYW5nZUluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQocmFuZ2U6IElSYW5nZSwgc2Nyb2xsVHlwZTogZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUgPSBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZS5TbW9vdGgpOiB2b2lkIHtcblx0XHR0aGlzLl9yZXZlYWxSYW5nZShcblx0XHRcdHJhbmdlLFxuXHRcdFx0VmVydGljYWxSZXZlYWxUeXBlLkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0LFxuXHRcdFx0dHJ1ZSxcblx0XHRcdHNjcm9sbFR5cGVcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHJldmVhbFJhbmdlTmVhclRvcChyYW5nZTogSVJhbmdlLCBzY3JvbGxUeXBlOiBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZSA9IGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlLlNtb290aCk6IHZvaWQge1xuXHRcdHRoaXMuX3JldmVhbFJhbmdlKFxuXHRcdFx0cmFuZ2UsXG5cdFx0XHRWZXJ0aWNhbFJldmVhbFR5cGUuTmVhclRvcCxcblx0XHRcdHRydWUsXG5cdFx0XHRzY3JvbGxUeXBlXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyByZXZlYWxSYW5nZU5lYXJUb3BJZk91dHNpZGVWaWV3cG9ydChyYW5nZTogSVJhbmdlLCBzY3JvbGxUeXBlOiBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZSA9IGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlLlNtb290aCk6IHZvaWQge1xuXHRcdHRoaXMuX3JldmVhbFJhbmdlKFxuXHRcdFx0cmFuZ2UsXG5cdFx0XHRWZXJ0aWNhbFJldmVhbFR5cGUuTmVhclRvcElmT3V0c2lkZVZpZXdwb3J0LFxuXHRcdFx0dHJ1ZSxcblx0XHRcdHNjcm9sbFR5cGVcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIHJldmVhbFJhbmdlQXRUb3AocmFuZ2U6IElSYW5nZSwgc2Nyb2xsVHlwZTogZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUgPSBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZS5TbW9vdGgpOiB2b2lkIHtcblx0XHR0aGlzLl9yZXZlYWxSYW5nZShcblx0XHRcdHJhbmdlLFxuXHRcdFx0VmVydGljYWxSZXZlYWxUeXBlLlRvcCxcblx0XHRcdHRydWUsXG5cdFx0XHRzY3JvbGxUeXBlXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgX3JldmVhbFJhbmdlKHJhbmdlOiBJUmFuZ2UsIHZlcnRpY2FsVHlwZTogVmVydGljYWxSZXZlYWxUeXBlLCByZXZlYWxIb3Jpem9udGFsOiBib29sZWFuLCBzY3JvbGxUeXBlOiBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZSk6IHZvaWQge1xuXHRcdGlmICghUmFuZ2UuaXNJUmFuZ2UocmFuZ2UpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgYXJndW1lbnRzJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fc2VuZFJldmVhbFJhbmdlKFxuXHRcdFx0UmFuZ2UubGlmdChyYW5nZSksXG5cdFx0XHR2ZXJ0aWNhbFR5cGUsXG5cdFx0XHRyZXZlYWxIb3Jpem9udGFsLFxuXHRcdFx0c2Nyb2xsVHlwZVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgc2V0U2VsZWN0aW9ucyhyYW5nZXM6IHJlYWRvbmx5IElTZWxlY3Rpb25bXSwgc291cmNlOiBzdHJpbmcgPSAnYXBpJywgcmVhc29uID0gQ3Vyc29yQ2hhbmdlUmVhc29uLk5vdFNldCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICghcmFuZ2VzIHx8IHJhbmdlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBhcmd1bWVudHMnKTtcblx0XHR9XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHJhbmdlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0aWYgKCFTZWxlY3Rpb24uaXNJU2VsZWN0aW9uKHJhbmdlc1tpXSkpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGFyZ3VtZW50cycpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9tb2RlbERhdGEudmlld01vZGVsLnNldFNlbGVjdGlvbnMoc291cmNlLCByYW5nZXMsIHJlYXNvbik7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Q29udGVudFdpZHRoKCk6IG51bWJlciB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsRGF0YS52aWV3TW9kZWwudmlld0xheW91dC5nZXRDb250ZW50V2lkdGgoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRTY3JvbGxXaWR0aCgpOiBudW1iZXIge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tb2RlbERhdGEudmlld01vZGVsLnZpZXdMYXlvdXQuZ2V0U2Nyb2xsV2lkdGgoKTtcblx0fVxuXHRwdWJsaWMgZ2V0U2Nyb2xsTGVmdCgpOiBudW1iZXIge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tb2RlbERhdGEudmlld01vZGVsLnZpZXdMYXlvdXQuZ2V0Q3VycmVudFNjcm9sbExlZnQoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRDb250ZW50SGVpZ2h0KCk6IG51bWJlciB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsRGF0YS52aWV3TW9kZWwudmlld0xheW91dC5nZXRDb250ZW50SGVpZ2h0KCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0U2Nyb2xsSGVpZ2h0KCk6IG51bWJlciB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsRGF0YS52aWV3TW9kZWwudmlld0xheW91dC5nZXRTY3JvbGxIZWlnaHQoKTtcblx0fVxuXHRwdWJsaWMgZ2V0U2Nyb2xsVG9wKCk6IG51bWJlciB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsRGF0YS52aWV3TW9kZWwudmlld0xheW91dC5nZXRDdXJyZW50U2Nyb2xsVG9wKCk7XG5cdH1cblxuXHRwdWJsaWMgc2V0U2Nyb2xsTGVmdChuZXdTY3JvbGxMZWZ0OiBudW1iZXIsIHNjcm9sbFR5cGU6IGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlID0gZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUuSW1tZWRpYXRlKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiBuZXdTY3JvbGxMZWZ0ICE9PSAnbnVtYmVyJykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGFyZ3VtZW50cycpO1xuXHRcdH1cblx0XHR0aGlzLl9tb2RlbERhdGEudmlld01vZGVsLnZpZXdMYXlvdXQuc2V0U2Nyb2xsUG9zaXRpb24oe1xuXHRcdFx0c2Nyb2xsTGVmdDogbmV3U2Nyb2xsTGVmdFxuXHRcdH0sIHNjcm9sbFR5cGUpO1xuXHR9XG5cdHB1YmxpYyBzZXRTY3JvbGxUb3AobmV3U2Nyb2xsVG9wOiBudW1iZXIsIHNjcm9sbFR5cGU6IGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlID0gZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUuSW1tZWRpYXRlKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiBuZXdTY3JvbGxUb3AgIT09ICdudW1iZXInKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgYXJndW1lbnRzJyk7XG5cdFx0fVxuXHRcdHRoaXMuX21vZGVsRGF0YS52aWV3TW9kZWwudmlld0xheW91dC5zZXRTY3JvbGxQb3NpdGlvbih7XG5cdFx0XHRzY3JvbGxUb3A6IG5ld1Njcm9sbFRvcFxuXHRcdH0sIHNjcm9sbFR5cGUpO1xuXHR9XG5cdHB1YmxpYyBzZXRTY3JvbGxQb3NpdGlvbihwb3NpdGlvbjogZWRpdG9yQ29tbW9uLklOZXdTY3JvbGxQb3NpdGlvbiwgc2Nyb2xsVHlwZTogZWRpdG9yQ29tbW9uLlNjcm9sbFR5cGUgPSBlZGl0b3JDb21tb24uU2Nyb2xsVHlwZS5JbW1lZGlhdGUpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9tb2RlbERhdGEudmlld01vZGVsLnZpZXdMYXlvdXQuc2V0U2Nyb2xsUG9zaXRpb24ocG9zaXRpb24sIHNjcm9sbFR5cGUpO1xuXHR9XG5cdHB1YmxpYyBoYXNQZW5kaW5nU2Nyb2xsQW5pbWF0aW9uKCk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tb2RlbERhdGEudmlld01vZGVsLnZpZXdMYXlvdXQuaGFzUGVuZGluZ1Njcm9sbEFuaW1hdGlvbigpO1xuXHR9XG5cblx0cHVibGljIHNhdmVWaWV3U3RhdGUoKTogZWRpdG9yQ29tbW9uLklDb2RlRWRpdG9yVmlld1N0YXRlIHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCBjb250cmlidXRpb25zU3RhdGUgPSB0aGlzLl9jb250cmlidXRpb25zLnNhdmVWaWV3U3RhdGUoKTtcblx0XHRjb25zdCBjdXJzb3JTdGF0ZSA9IHRoaXMuX21vZGVsRGF0YS52aWV3TW9kZWwuc2F2ZUN1cnNvclN0YXRlKCk7XG5cdFx0Y29uc3Qgdmlld1N0YXRlID0gdGhpcy5fbW9kZWxEYXRhLnZpZXdNb2RlbC5zYXZlU3RhdGUoKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Y3Vyc29yU3RhdGU6IGN1cnNvclN0YXRlLFxuXHRcdFx0dmlld1N0YXRlOiB2aWV3U3RhdGUsXG5cdFx0XHRjb250cmlidXRpb25zU3RhdGU6IGNvbnRyaWJ1dGlvbnNTdGF0ZVxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgcmVzdG9yZVZpZXdTdGF0ZShzOiBlZGl0b3JDb21tb24uSUVkaXRvclZpZXdTdGF0ZSB8IG51bGwpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSB8fCAhdGhpcy5fbW9kZWxEYXRhLmhhc1JlYWxWaWV3KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGNvZGVFZGl0b3JTdGF0ZSA9IHMgYXMgZWRpdG9yQ29tbW9uLklDb2RlRWRpdG9yVmlld1N0YXRlIHwgbnVsbDtcblx0XHRpZiAoY29kZUVkaXRvclN0YXRlICYmIGNvZGVFZGl0b3JTdGF0ZS5jdXJzb3JTdGF0ZSAmJiBjb2RlRWRpdG9yU3RhdGUudmlld1N0YXRlKSB7XG5cdFx0XHRjb25zdCBjdXJzb3JTdGF0ZSA9IDxhbnk+Y29kZUVkaXRvclN0YXRlLmN1cnNvclN0YXRlO1xuXHRcdFx0aWYgKEFycmF5LmlzQXJyYXkoY3Vyc29yU3RhdGUpKSB7XG5cdFx0XHRcdGlmIChjdXJzb3JTdGF0ZS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0dGhpcy5fbW9kZWxEYXRhLnZpZXdNb2RlbC5yZXN0b3JlQ3Vyc29yU3RhdGUoPGVkaXRvckNvbW1vbi5JQ3Vyc29yU3RhdGVbXT5jdXJzb3JTdGF0ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIEJhY2t3YXJkcyBjb21wYXRpYmlsaXR5XG5cdFx0XHRcdHRoaXMuX21vZGVsRGF0YS52aWV3TW9kZWwucmVzdG9yZUN1cnNvclN0YXRlKFs8ZWRpdG9yQ29tbW9uLklDdXJzb3JTdGF0ZT5jdXJzb3JTdGF0ZV0pO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9jb250cmlidXRpb25zLnJlc3RvcmVWaWV3U3RhdGUoY29kZUVkaXRvclN0YXRlLmNvbnRyaWJ1dGlvbnNTdGF0ZSB8fCB7fSk7XG5cdFx0XHRjb25zdCByZWR1Y2VkU3RhdGUgPSB0aGlzLl9tb2RlbERhdGEudmlld01vZGVsLnJlZHVjZVJlc3RvcmVTdGF0ZShjb2RlRWRpdG9yU3RhdGUudmlld1N0YXRlKTtcblx0XHRcdHRoaXMuX21vZGVsRGF0YS52aWV3LnJlc3RvcmVTdGF0ZShyZWR1Y2VkU3RhdGUpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBoYW5kbGVJbml0aWFsaXplZCgpOiB2b2lkIHtcblx0XHR0aGlzLl9nZXRWaWV3TW9kZWwoKT8udmlzaWJsZUxpbmVzU3RhYmlsaXplZCgpO1xuXHR9XG5cblx0cHVibGljIG9uVmlzaWJsZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9tb2RlbERhdGE/LnZpZXcucmVmcmVzaEZvY3VzU3RhdGUoKTtcblx0fVxuXG5cdHB1YmxpYyBvbkhpZGUoKTogdm9pZCB7XG5cdFx0dGhpcy5fbW9kZWxEYXRhPy52aWV3LnJlZnJlc2hGb2N1c1N0YXRlKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Q29udHJpYnV0aW9uPFQgZXh0ZW5kcyBlZGl0b3JDb21tb24uSUVkaXRvckNvbnRyaWJ1dGlvbj4oaWQ6IHN0cmluZyk6IFQgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fY29udHJpYnV0aW9ucy5nZXQoaWQpIGFzIFQgfCBudWxsO1xuXHR9XG5cblx0cHVibGljIGdldEFjdGlvbnMoKTogZWRpdG9yQ29tbW9uLklFZGl0b3JBY3Rpb25bXSB7XG5cdFx0cmV0dXJuIEFycmF5LmZyb20odGhpcy5fYWN0aW9ucy52YWx1ZXMoKSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0U3VwcG9ydGVkQWN0aW9ucygpOiBlZGl0b3JDb21tb24uSUVkaXRvckFjdGlvbltdIHtcblx0XHRsZXQgcmVzdWx0ID0gdGhpcy5nZXRBY3Rpb25zKCk7XG5cblx0XHRyZXN1bHQgPSByZXN1bHQuZmlsdGVyKGFjdGlvbiA9PiBhY3Rpb24uaXNTdXBwb3J0ZWQoKSk7XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGdldEFjdGlvbihpZDogc3RyaW5nKTogZWRpdG9yQ29tbW9uLklFZGl0b3JBY3Rpb24gfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fYWN0aW9ucy5nZXQoaWQpIHx8IG51bGw7XG5cdH1cblxuXHRwdWJsaWMgdHJpZ2dlcihzb3VyY2U6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIGhhbmRsZXJJZDogc3RyaW5nLCBwYXlsb2FkOiBhbnkpOiB2b2lkIHtcblx0XHRwYXlsb2FkID0gcGF5bG9hZCB8fCB7fTtcblxuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9vbldpbGxUcmlnZ2VyRWRpdG9yT3BlcmF0aW9uRXZlbnQuZmlyZSh7IHNvdXJjZTogc291cmNlLCBoYW5kbGVySWQ6IGhhbmRsZXJJZCwgcGF5bG9hZDogcGF5bG9hZCB9KTtcblx0XHRcdHRoaXMuX2JlZ2luVXBkYXRlKCk7XG5cblx0XHRcdHN3aXRjaCAoaGFuZGxlcklkKSB7XG5cdFx0XHRcdGNhc2UgZWRpdG9yQ29tbW9uLkhhbmRsZXIuQ29tcG9zaXRpb25TdGFydDpcblx0XHRcdFx0XHR0aGlzLl9zdGFydENvbXBvc2l0aW9uKCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRjYXNlIGVkaXRvckNvbW1vbi5IYW5kbGVyLkNvbXBvc2l0aW9uRW5kOlxuXHRcdFx0XHRcdHRoaXMuX2VuZENvbXBvc2l0aW9uKHNvdXJjZSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRjYXNlIGVkaXRvckNvbW1vbi5IYW5kbGVyLlR5cGU6IHtcblx0XHRcdFx0XHRjb25zdCBhcmdzID0gPFBhcnRpYWw8ZWRpdG9yQ29tbW9uLlR5cGVQYXlsb2FkPj5wYXlsb2FkO1xuXHRcdFx0XHRcdHRoaXMuX3R5cGUoc291cmNlLCBhcmdzLnRleHQgfHwgJycpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIGVkaXRvckNvbW1vbi5IYW5kbGVyLlJlcGxhY2VQcmV2aW91c0NoYXI6IHtcblx0XHRcdFx0XHRjb25zdCBhcmdzID0gPFBhcnRpYWw8ZWRpdG9yQ29tbW9uLlJlcGxhY2VQcmV2aW91c0NoYXJQYXlsb2FkPj5wYXlsb2FkO1xuXHRcdFx0XHRcdHRoaXMuX2NvbXBvc2l0aW9uVHlwZShzb3VyY2UsIGFyZ3MudGV4dCB8fCAnJywgYXJncy5yZXBsYWNlQ2hhckNudCB8fCAwLCAwLCAwKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSBlZGl0b3JDb21tb24uSGFuZGxlci5Db21wb3NpdGlvblR5cGU6IHtcblx0XHRcdFx0XHRjb25zdCBhcmdzID0gPFBhcnRpYWw8ZWRpdG9yQ29tbW9uLkNvbXBvc2l0aW9uVHlwZVBheWxvYWQ+PnBheWxvYWQ7XG5cdFx0XHRcdFx0dGhpcy5fY29tcG9zaXRpb25UeXBlKHNvdXJjZSwgYXJncy50ZXh0IHx8ICcnLCBhcmdzLnJlcGxhY2VQcmV2Q2hhckNudCB8fCAwLCBhcmdzLnJlcGxhY2VOZXh0Q2hhckNudCB8fCAwLCBhcmdzLnBvc2l0aW9uRGVsdGEgfHwgMCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgZWRpdG9yQ29tbW9uLkhhbmRsZXIuUGFzdGU6IHtcblx0XHRcdFx0XHRjb25zdCBhcmdzID0gPFBhcnRpYWw8ZWRpdG9yQnJvd3Nlci5QYXN0ZVBheWxvYWQ+PnBheWxvYWQ7XG5cdFx0XHRcdFx0dGhpcy5fcGFzdGUoc291cmNlLCBhcmdzLnRleHQgfHwgJycsIGFyZ3MucGFzdGVPbk5ld0xpbmUgfHwgZmFsc2UsIGFyZ3MubXVsdGljdXJzb3JUZXh0IHx8IG51bGwsIGFyZ3MubW9kZSB8fCBudWxsLCBhcmdzLmNsaXBib2FyZEV2ZW50KTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSBlZGl0b3JDb21tb24uSGFuZGxlci5DdXQ6XG5cdFx0XHRcdFx0dGhpcy5fY3V0KHNvdXJjZSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBhY3Rpb24gPSB0aGlzLmdldEFjdGlvbihoYW5kbGVySWQpO1xuXHRcdFx0aWYgKGFjdGlvbikge1xuXHRcdFx0XHRQcm9taXNlLnJlc29sdmUoYWN0aW9uLnJ1bihwYXlsb2FkKSkudGhlbih1bmRlZmluZWQsIG9uVW5leHBlY3RlZEVycm9yKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLl90cmlnZ2VyRWRpdG9yQ29tbWFuZChzb3VyY2UsIGhhbmRsZXJJZCwgcGF5bG9hZCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl90cmlnZ2VyQ29tbWFuZChoYW5kbGVySWQsIHBheWxvYWQpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLl9lbmRVcGRhdGUoKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgX3RyaWdnZXJDb21tYW5kKGhhbmRsZXJJZDogc3RyaW5nLCBwYXlsb2FkOiBhbnkpOiB2b2lkIHtcblx0XHR0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChoYW5kbGVySWQsIHBheWxvYWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc3RhcnRDb21wb3NpdGlvbigpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLmluQ29tcG9zaXRpb24gPSB0cnVlO1xuXHRcdHRoaXMuX21vZGVsRGF0YS52aWV3TW9kZWwuc3RhcnRDb21wb3NpdGlvbigpO1xuXHRcdHRoaXMuX29uRGlkQ29tcG9zaXRpb25TdGFydC5maXJlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9lbmRDb21wb3NpdGlvbihzb3VyY2U6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLmluQ29tcG9zaXRpb24gPSBmYWxzZTtcblx0XHR0aGlzLl9tb2RlbERhdGEudmlld01vZGVsLmVuZENvbXBvc2l0aW9uKHNvdXJjZSk7XG5cdFx0dGhpcy5fb25EaWRDb21wb3NpdGlvbkVuZC5maXJlKCk7XG5cdH1cblxuXHRwcml2YXRlIF90eXBlKHNvdXJjZTogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCwgdGV4dDogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEgfHwgdGV4dC5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHNvdXJjZSA9PT0gJ2tleWJvYXJkJykge1xuXHRcdFx0dGhpcy5fb25XaWxsVHlwZS5maXJlKHRleHQpO1xuXHRcdH1cblx0XHR0aGlzLl9tb2RlbERhdGEudmlld01vZGVsLnR5cGUodGV4dCwgc291cmNlKTtcblx0XHRpZiAoc291cmNlID09PSAna2V5Ym9hcmQnKSB7XG5cdFx0XHR0aGlzLl9vbkRpZFR5cGUuZmlyZSh0ZXh0KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9jb21wb3NpdGlvblR5cGUoc291cmNlOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkLCB0ZXh0OiBzdHJpbmcsIHJlcGxhY2VQcmV2Q2hhckNudDogbnVtYmVyLCByZXBsYWNlTmV4dENoYXJDbnQ6IG51bWJlciwgcG9zaXRpb25EZWx0YTogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fbW9kZWxEYXRhLnZpZXdNb2RlbC5jb21wb3NpdGlvblR5cGUodGV4dCwgcmVwbGFjZVByZXZDaGFyQ250LCByZXBsYWNlTmV4dENoYXJDbnQsIHBvc2l0aW9uRGVsdGEsIHNvdXJjZSk7XG5cdH1cblxuXHRwcml2YXRlIF9wYXN0ZShzb3VyY2U6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIHRleHQ6IHN0cmluZywgcGFzdGVPbk5ld0xpbmU6IGJvb2xlYW4sIG11bHRpY3Vyc29yVGV4dDogc3RyaW5nW10gfCBudWxsLCBtb2RlOiBzdHJpbmcgfCBudWxsLCBjbGlwYm9hcmRFdmVudD86IENsaXBib2FyZEV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgdmlld01vZGVsID0gdGhpcy5fbW9kZWxEYXRhLnZpZXdNb2RlbDtcblx0XHRjb25zdCBzdGFydFBvc2l0aW9uID0gdmlld01vZGVsLmdldFNlbGVjdGlvbigpLmdldFN0YXJ0UG9zaXRpb24oKTtcblx0XHR2aWV3TW9kZWwucGFzdGUodGV4dCwgcGFzdGVPbk5ld0xpbmUsIG11bHRpY3Vyc29yVGV4dCwgc291cmNlKTtcblx0XHRjb25zdCBlbmRQb3NpdGlvbiA9IHZpZXdNb2RlbC5nZXRTZWxlY3Rpb24oKS5nZXRTdGFydFBvc2l0aW9uKCk7XG5cdFx0aWYgKHNvdXJjZSA9PT0gJ2tleWJvYXJkJykge1xuXHRcdFx0dGhpcy5fb25EaWRQYXN0ZS5maXJlKHtcblx0XHRcdFx0Y2xpcGJvYXJkRXZlbnQsXG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2Uoc3RhcnRQb3NpdGlvbi5saW5lTnVtYmVyLCBzdGFydFBvc2l0aW9uLmNvbHVtbiwgZW5kUG9zaXRpb24ubGluZU51bWJlciwgZW5kUG9zaXRpb24uY29sdW1uKSxcblx0XHRcdFx0bGFuZ3VhZ2VJZDogbW9kZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfY3V0KHNvdXJjZTogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX21vZGVsRGF0YS52aWV3TW9kZWwuY3V0KHNvdXJjZSk7XG5cdH1cblxuXHRwcml2YXRlIF90cmlnZ2VyRWRpdG9yQ29tbWFuZChzb3VyY2U6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIGhhbmRsZXJJZDogc3RyaW5nLCBwYXlsb2FkOiBhbnkpOiBib29sZWFuIHtcblx0XHRjb25zdCBjb21tYW5kID0gRWRpdG9yRXh0ZW5zaW9uc1JlZ2lzdHJ5LmdldEVkaXRvckNvbW1hbmQoaGFuZGxlcklkKTtcblx0XHRpZiAoY29tbWFuZCkge1xuXHRcdFx0cGF5bG9hZCA9IHBheWxvYWQgfHwge307XG5cdFx0XHRwYXlsb2FkLnNvdXJjZSA9IHNvdXJjZTtcblx0XHRcdHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKChhY2Nlc3NvcikgPT4ge1xuXHRcdFx0XHRQcm9taXNlLnJlc29sdmUoY29tbWFuZC5ydW5FZGl0b3JDb21tYW5kKGFjY2Vzc29yLCB0aGlzLCBwYXlsb2FkKSkudGhlbih1bmRlZmluZWQsIG9uVW5leHBlY3RlZEVycm9yKTtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHVibGljIF9nZXRWaWV3TW9kZWwoKTogSVZpZXdNb2RlbCB8IG51bGwge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsRGF0YS52aWV3TW9kZWw7XG5cdH1cblxuXHRwdWJsaWMgcHVzaFVuZG9TdG9wKCk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9jb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5yZWFkT25seSkpIHtcblx0XHRcdC8vIHJlYWQgb25seSBlZGl0b3IgPT4gc29ycnkhXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHRoaXMuX21vZGVsRGF0YS5tb2RlbC5wdXNoU3RhY2tFbGVtZW50KCk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgcG9wVW5kb1N0b3AoKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2NvbmZpZ3VyYXRpb24ub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLnJlYWRPbmx5KSkge1xuXHRcdFx0Ly8gcmVhZCBvbmx5IGVkaXRvciA9PiBzb3JyeSFcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0dGhpcy5fbW9kZWxEYXRhLm1vZGVsLnBvcFN0YWNrRWxlbWVudCgpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIGV4ZWN1dGVFZGl0cyhzb3VyY2U6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIGVkaXRzOiBJSWRlbnRpZmllZFNpbmdsZUVkaXRPcGVyYXRpb25bXSwgZW5kQ3Vyc29yU3RhdGU/OiBJQ3Vyc29yU3RhdGVDb21wdXRlciB8IFNlbGVjdGlvbltdKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2NvbmZpZ3VyYXRpb24ub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLnJlYWRPbmx5KSkge1xuXHRcdFx0Ly8gcmVhZCBvbmx5IGVkaXRvciA9PiBzb3JyeSFcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRsZXQgY3Vyc29yU3RhdGVDb21wdXRlcjogSUN1cnNvclN0YXRlQ29tcHV0ZXI7XG5cdFx0aWYgKCFlbmRDdXJzb3JTdGF0ZSkge1xuXHRcdFx0Y3Vyc29yU3RhdGVDb21wdXRlciA9ICgpID0+IG51bGw7XG5cdFx0fSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGVuZEN1cnNvclN0YXRlKSkge1xuXHRcdFx0Y3Vyc29yU3RhdGVDb21wdXRlciA9ICgpID0+IGVuZEN1cnNvclN0YXRlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjdXJzb3JTdGF0ZUNvbXB1dGVyID0gZW5kQ3Vyc29yU3RhdGU7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25CZWZvcmVFeGVjdXRlRWRpdC5maXJlKHsgc291cmNlOiBzb3VyY2UgPz8gdW5kZWZpbmVkIH0pO1xuXG5cdFx0dGhpcy5fbW9kZWxEYXRhLnZpZXdNb2RlbC5leGVjdXRlRWRpdHMoc291cmNlLCBlZGl0cywgY3Vyc29yU3RhdGVDb21wdXRlcik7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgZXhlY3V0ZUNvbW1hbmQoc291cmNlOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkLCBjb21tYW5kOiBlZGl0b3JDb21tb24uSUNvbW1hbmQpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9tb2RlbERhdGEudmlld01vZGVsLmV4ZWN1dGVDb21tYW5kKGNvbW1hbmQsIHNvdXJjZSk7XG5cdH1cblxuXHRwdWJsaWMgZXhlY3V0ZUNvbW1hbmRzKHNvdXJjZTogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCwgY29tbWFuZHM6IGVkaXRvckNvbW1vbi5JQ29tbWFuZFtdKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fbW9kZWxEYXRhLnZpZXdNb2RlbC5leGVjdXRlQ29tbWFuZHMoY29tbWFuZHMsIHNvdXJjZSk7XG5cdH1cblxuXHRwdWJsaWMgY3JlYXRlRGVjb3JhdGlvbnNDb2xsZWN0aW9uKGRlY29yYXRpb25zPzogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10pOiBFZGl0b3JEZWNvcmF0aW9uc0NvbGxlY3Rpb24ge1xuXHRcdHJldHVybiBuZXcgRWRpdG9yRGVjb3JhdGlvbnNDb2xsZWN0aW9uKHRoaXMsIGRlY29yYXRpb25zKTtcblx0fVxuXG5cdHB1YmxpYyBjaGFuZ2VEZWNvcmF0aW9ucyhjYWxsYmFjazogKGNoYW5nZUFjY2Vzc29yOiBJTW9kZWxEZWNvcmF0aW9uc0NoYW5nZUFjY2Vzc29yKSA9PiBhbnkpOiBhbnkge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHQvLyBjYWxsYmFjayB3aWxsIG5vdCBiZSBjYWxsZWRcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbW9kZWxEYXRhLm1vZGVsLmNoYW5nZURlY29yYXRpb25zKGNhbGxiYWNrLCB0aGlzLl9pZCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGluZURlY29yYXRpb25zKGxpbmVOdW1iZXI6IG51bWJlcik6IElNb2RlbERlY29yYXRpb25bXSB8IG51bGwge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsRGF0YS5tb2RlbC5nZXRMaW5lRGVjb3JhdGlvbnMobGluZU51bWJlciwgdGhpcy5faWQsIGZpbHRlclZhbGlkYXRpb25EZWNvcmF0aW9ucyh0aGlzLl9jb25maWd1cmF0aW9uLm9wdGlvbnMpKTtcblx0fVxuXG5cdHB1YmxpYyBnZXREZWNvcmF0aW9uc0luUmFuZ2UocmFuZ2U6IFJhbmdlKTogSU1vZGVsRGVjb3JhdGlvbltdIHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbW9kZWxEYXRhLm1vZGVsLmdldERlY29yYXRpb25zSW5SYW5nZShyYW5nZSwgdGhpcy5faWQsIGZpbHRlclZhbGlkYXRpb25EZWNvcmF0aW9ucyh0aGlzLl9jb25maWd1cmF0aW9uLm9wdGlvbnMpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAZGVwcmVjYXRlZFxuXHQgKi9cblx0cHVibGljIGRlbHRhRGVjb3JhdGlvbnMob2xkRGVjb3JhdGlvbnM6IHN0cmluZ1tdLCBuZXdEZWNvcmF0aW9uczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10pOiBzdHJpbmdbXSB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRpZiAob2xkRGVjb3JhdGlvbnMubGVuZ3RoID09PSAwICYmIG5ld0RlY29yYXRpb25zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIG9sZERlY29yYXRpb25zO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9tb2RlbERhdGEubW9kZWwuZGVsdGFEZWNvcmF0aW9ucyhvbGREZWNvcmF0aW9ucywgbmV3RGVjb3JhdGlvbnMsIHRoaXMuX2lkKTtcblx0fVxuXG5cdHB1YmxpYyByZW1vdmVEZWNvcmF0aW9ucyhkZWNvcmF0aW9uSWRzOiBzdHJpbmdbXSk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhIHx8IGRlY29yYXRpb25JZHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fbW9kZWxEYXRhLm1vZGVsLmNoYW5nZURlY29yYXRpb25zKChjaGFuZ2VBY2Nlc3NvcikgPT4ge1xuXHRcdFx0Y2hhbmdlQWNjZXNzb3IuZGVsdGFEZWNvcmF0aW9ucyhkZWNvcmF0aW9uSWRzLCBbXSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgc2V0RGVjb3JhdGlvbnNCeVR5cGUoZGVzY3JpcHRpb246IHN0cmluZywgZGVjb3JhdGlvblR5cGVLZXk6IHN0cmluZywgZGVjb3JhdGlvbk9wdGlvbnM6IGVkaXRvckNvbW1vbi5JRGVjb3JhdGlvbk9wdGlvbnNbXSk6IHZvaWQge1xuXG5cdFx0Y29uc3QgbmV3RGVjb3JhdGlvbnNTdWJUeXBlczogeyBba2V5OiBzdHJpbmddOiBib29sZWFuIH0gPSB7fTtcblx0XHRjb25zdCBvbGREZWNvcmF0aW9uc1N1YlR5cGVzID0gdGhpcy5fZGVjb3JhdGlvblR5cGVTdWJ0eXBlc1tkZWNvcmF0aW9uVHlwZUtleV0gfHwge307XG5cdFx0dGhpcy5fZGVjb3JhdGlvblR5cGVTdWJ0eXBlc1tkZWNvcmF0aW9uVHlwZUtleV0gPSBuZXdEZWNvcmF0aW9uc1N1YlR5cGVzO1xuXG5cdFx0Y29uc3QgbmV3TW9kZWxEZWNvcmF0aW9uczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbk9wdGlvbiBvZiBkZWNvcmF0aW9uT3B0aW9ucykge1xuXHRcdFx0bGV0IHR5cGVLZXkgPSBkZWNvcmF0aW9uVHlwZUtleTtcblx0XHRcdGlmIChkZWNvcmF0aW9uT3B0aW9uLnJlbmRlck9wdGlvbnMpIHtcblx0XHRcdFx0Ly8gaWRlbnRpZnkgY3VzdG9tIHJlbmRlciBvcHRpb25zIGJ5IGEgaGFzaCBjb2RlIG92ZXIgYWxsIGtleXMgYW5kIHZhbHVlc1xuXHRcdFx0XHQvLyBGb3IgY3VzdG9tIHJlbmRlciBvcHRpb25zIHJlZ2lzdGVyIGEgZGVjb3JhdGlvbiB0eXBlIGlmIG5lY2Vzc2FyeVxuXHRcdFx0XHRjb25zdCBzdWJUeXBlID0gaGFzaChkZWNvcmF0aW9uT3B0aW9uLnJlbmRlck9wdGlvbnMpLnRvU3RyaW5nKDE2KTtcblx0XHRcdFx0Ly8gVGhlIGZhY3QgdGhhdCBgZGVjb3JhdGlvblR5cGVLZXlgIGFwcGVhcnMgaW4gdGhlIHR5cGVLZXkgaGFzIG5vIGluZmx1ZW5jZVxuXHRcdFx0XHQvLyBpdCBpcyBqdXN0IGEgbWVjaGFuaXNtIHRvIGdldCBwcmVkaWN0YWJsZSBhbmQgdW5pcXVlIGtleXMgKHJlcGVhdGFibGUgZm9yIHRoZSBzYW1lIG9wdGlvbnMgYW5kIHVuaXF1ZSBhY3Jvc3MgY2xpZW50cylcblx0XHRcdFx0dHlwZUtleSA9IGRlY29yYXRpb25UeXBlS2V5ICsgJy0nICsgc3ViVHlwZTtcblx0XHRcdFx0aWYgKCFvbGREZWNvcmF0aW9uc1N1YlR5cGVzW3N1YlR5cGVdICYmICFuZXdEZWNvcmF0aW9uc1N1YlR5cGVzW3N1YlR5cGVdKSB7XG5cdFx0XHRcdFx0Ly8gZGVjb3JhdGlvbiB0eXBlIGRpZCBub3QgZXhpc3QgYmVmb3JlLCByZWdpc3RlciBuZXcgb25lXG5cdFx0XHRcdFx0dGhpcy5fcmVnaXN0ZXJEZWNvcmF0aW9uVHlwZShkZXNjcmlwdGlvbiwgdHlwZUtleSwgZGVjb3JhdGlvbk9wdGlvbi5yZW5kZXJPcHRpb25zLCBkZWNvcmF0aW9uVHlwZUtleSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bmV3RGVjb3JhdGlvbnNTdWJUeXBlc1tzdWJUeXBlXSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBvcHRzID0gdGhpcy5fcmVzb2x2ZURlY29yYXRpb25PcHRpb25zKHR5cGVLZXksICEhZGVjb3JhdGlvbk9wdGlvbi5ob3Zlck1lc3NhZ2UpO1xuXHRcdFx0aWYgKGRlY29yYXRpb25PcHRpb24uaG92ZXJNZXNzYWdlKSB7XG5cdFx0XHRcdG9wdHMuaG92ZXJNZXNzYWdlID0gZGVjb3JhdGlvbk9wdGlvbi5ob3Zlck1lc3NhZ2U7XG5cdFx0XHR9XG5cdFx0XHRuZXdNb2RlbERlY29yYXRpb25zLnB1c2goeyByYW5nZTogZGVjb3JhdGlvbk9wdGlvbi5yYW5nZSwgb3B0aW9uczogb3B0cyB9KTtcblx0XHR9XG5cblx0XHQvLyByZW1vdmUgZGVjb3JhdGlvbiBzdWIgdHlwZXMgdGhhdCBhcmUgbm8gbG9uZ2VyIHVzZWQsIGRlcmVnaXN0ZXIgZGVjb3JhdGlvbiB0eXBlIGlmIG5lY2Vzc2FyeVxuXHRcdGZvciAoY29uc3Qgc3ViVHlwZSBpbiBvbGREZWNvcmF0aW9uc1N1YlR5cGVzKSB7XG5cdFx0XHRpZiAoIW5ld0RlY29yYXRpb25zU3ViVHlwZXNbc3ViVHlwZV0pIHtcblx0XHRcdFx0dGhpcy5fcmVtb3ZlRGVjb3JhdGlvblR5cGUoZGVjb3JhdGlvblR5cGVLZXkgKyAnLScgKyBzdWJUeXBlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyB1cGRhdGUgYWxsIGRlY29yYXRpb25zXG5cdFx0Y29uc3Qgb2xkRGVjb3JhdGlvbnNJZHMgPSB0aGlzLl9kZWNvcmF0aW9uVHlwZUtleXNUb0lkc1tkZWNvcmF0aW9uVHlwZUtleV0gfHwgW107XG5cdFx0dGhpcy5jaGFuZ2VEZWNvcmF0aW9ucyhhY2Nlc3NvciA9PiB0aGlzLl9kZWNvcmF0aW9uVHlwZUtleXNUb0lkc1tkZWNvcmF0aW9uVHlwZUtleV0gPSBhY2Nlc3Nvci5kZWx0YURlY29yYXRpb25zKG9sZERlY29yYXRpb25zSWRzLCBuZXdNb2RlbERlY29yYXRpb25zKSk7XG5cdH1cblxuXHRwdWJsaWMgc2V0RGVjb3JhdGlvbnNCeVR5cGVGYXN0KGRlY29yYXRpb25UeXBlS2V5OiBzdHJpbmcsIHJhbmdlczogSVJhbmdlW10pOiB2b2lkIHtcblxuXHRcdC8vIHJlbW92ZSBkZWNvcmF0aW9uIHN1YiB0eXBlcyB0aGF0IGFyZSBubyBsb25nZXIgdXNlZCwgZGVyZWdpc3RlciBkZWNvcmF0aW9uIHR5cGUgaWYgbmVjZXNzYXJ5XG5cdFx0Y29uc3Qgb2xkRGVjb3JhdGlvbnNTdWJUeXBlcyA9IHRoaXMuX2RlY29yYXRpb25UeXBlU3VidHlwZXNbZGVjb3JhdGlvblR5cGVLZXldIHx8IHt9O1xuXHRcdGZvciAoY29uc3Qgc3ViVHlwZSBpbiBvbGREZWNvcmF0aW9uc1N1YlR5cGVzKSB7XG5cdFx0XHR0aGlzLl9yZW1vdmVEZWNvcmF0aW9uVHlwZShkZWNvcmF0aW9uVHlwZUtleSArICctJyArIHN1YlR5cGUpO1xuXHRcdH1cblx0XHR0aGlzLl9kZWNvcmF0aW9uVHlwZVN1YnR5cGVzW2RlY29yYXRpb25UeXBlS2V5XSA9IHt9O1xuXG5cdFx0Y29uc3Qgb3B0cyA9IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMuY3JlYXRlRHluYW1pYyh0aGlzLl9yZXNvbHZlRGVjb3JhdGlvbk9wdGlvbnMoZGVjb3JhdGlvblR5cGVLZXksIGZhbHNlKSk7XG5cdFx0Y29uc3QgbmV3TW9kZWxEZWNvcmF0aW9uczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10gPSBuZXcgQXJyYXk8SU1vZGVsRGVsdGFEZWNvcmF0aW9uPihyYW5nZXMubGVuZ3RoKTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gcmFuZ2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRuZXdNb2RlbERlY29yYXRpb25zW2ldID0geyByYW5nZTogcmFuZ2VzW2ldLCBvcHRpb25zOiBvcHRzIH07XG5cdFx0fVxuXG5cdFx0Ly8gdXBkYXRlIGFsbCBkZWNvcmF0aW9uc1xuXHRcdGNvbnN0IG9sZERlY29yYXRpb25zSWRzID0gdGhpcy5fZGVjb3JhdGlvblR5cGVLZXlzVG9JZHNbZGVjb3JhdGlvblR5cGVLZXldIHx8IFtdO1xuXHRcdHRoaXMuY2hhbmdlRGVjb3JhdGlvbnMoYWNjZXNzb3IgPT4gdGhpcy5fZGVjb3JhdGlvblR5cGVLZXlzVG9JZHNbZGVjb3JhdGlvblR5cGVLZXldID0gYWNjZXNzb3IuZGVsdGFEZWNvcmF0aW9ucyhvbGREZWNvcmF0aW9uc0lkcywgbmV3TW9kZWxEZWNvcmF0aW9ucykpO1xuXHR9XG5cblx0cHVibGljIHJlbW92ZURlY29yYXRpb25zQnlUeXBlKGRlY29yYXRpb25UeXBlS2V5OiBzdHJpbmcpOiB2b2lkIHtcblx0XHQvLyByZW1vdmUgZGVjb3JhdGlvbnMgZm9yIHR5cGUgYW5kIHN1YiB0eXBlXG5cdFx0Y29uc3Qgb2xkRGVjb3JhdGlvbnNJZHMgPSB0aGlzLl9kZWNvcmF0aW9uVHlwZUtleXNUb0lkc1tkZWNvcmF0aW9uVHlwZUtleV07XG5cdFx0aWYgKG9sZERlY29yYXRpb25zSWRzKSB7XG5cdFx0XHR0aGlzLmNoYW5nZURlY29yYXRpb25zKGFjY2Vzc29yID0+IGFjY2Vzc29yLmRlbHRhRGVjb3JhdGlvbnMob2xkRGVjb3JhdGlvbnNJZHMsIFtdKSk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9kZWNvcmF0aW9uVHlwZUtleXNUb0lkcy5oYXNPd25Qcm9wZXJ0eShkZWNvcmF0aW9uVHlwZUtleSkpIHtcblx0XHRcdGRlbGV0ZSB0aGlzLl9kZWNvcmF0aW9uVHlwZUtleXNUb0lkc1tkZWNvcmF0aW9uVHlwZUtleV07XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9kZWNvcmF0aW9uVHlwZVN1YnR5cGVzLmhhc093blByb3BlcnR5KGRlY29yYXRpb25UeXBlS2V5KSkge1xuXHRcdFx0ZGVsZXRlIHRoaXMuX2RlY29yYXRpb25UeXBlU3VidHlwZXNbZGVjb3JhdGlvblR5cGVLZXldO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXRMYXlvdXRJbmZvKCk6IEVkaXRvckxheW91dEluZm8ge1xuXHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLl9jb25maWd1cmF0aW9uLm9wdGlvbnM7XG5cdFx0Y29uc3QgbGF5b3V0SW5mbyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5sYXlvdXRJbmZvKTtcblx0XHRyZXR1cm4gbGF5b3V0SW5mbztcblx0fVxuXG5cdHB1YmxpYyBjcmVhdGVPdmVydmlld1J1bGVyKGNzc0NsYXNzTmFtZTogc3RyaW5nKTogZWRpdG9yQnJvd3Nlci5JT3ZlcnZpZXdSdWxlciB8IG51bGwge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhIHx8ICF0aGlzLl9tb2RlbERhdGEuaGFzUmVhbFZpZXcpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbW9kZWxEYXRhLnZpZXcuY3JlYXRlT3ZlcnZpZXdSdWxlcihjc3NDbGFzc05hbWUpO1xuXHR9XG5cblx0cHVibGljIGdldENvbnRhaW5lckRvbU5vZGUoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLl9kb21FbGVtZW50O1xuXHR9XG5cblx0cHVibGljIGdldERvbU5vZGUoKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSB8fCAhdGhpcy5fbW9kZWxEYXRhLmhhc1JlYWxWaWV3KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsRGF0YS52aWV3LmRvbU5vZGUuZG9tTm9kZTtcblx0fVxuXG5cdHB1YmxpYyBkZWxlZ2F0ZVZlcnRpY2FsU2Nyb2xsYmFyUG9pbnRlckRvd24oYnJvd3NlckV2ZW50OiBQb2ludGVyRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSB8fCAhdGhpcy5fbW9kZWxEYXRhLmhhc1JlYWxWaWV3KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX21vZGVsRGF0YS52aWV3LmRlbGVnYXRlVmVydGljYWxTY3JvbGxiYXJQb2ludGVyRG93bihicm93c2VyRXZlbnQpO1xuXHR9XG5cblx0cHVibGljIGRlbGVnYXRlU2Nyb2xsRnJvbU1vdXNlV2hlZWxFdmVudChicm93c2VyRXZlbnQ6IElNb3VzZVdoZWVsRXZlbnQpIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSB8fCAhdGhpcy5fbW9kZWxEYXRhLmhhc1JlYWxWaWV3KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX21vZGVsRGF0YS52aWV3LmRlbGVnYXRlU2Nyb2xsRnJvbU1vdXNlV2hlZWxFdmVudChicm93c2VyRXZlbnQpO1xuXHR9XG5cblx0cHVibGljIGxheW91dChkaW1lbnNpb24/OiBJRGltZW5zaW9uLCBwb3N0cG9uZVJlbmRlcmluZzogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XG5cdFx0dGhpcy5fY29uZmlndXJhdGlvbi5vYnNlcnZlQ29udGFpbmVyKGRpbWVuc2lvbik7XG5cdFx0aWYgKCFwb3N0cG9uZVJlbmRlcmluZykge1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZm9jdXMoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEgfHwgIXRoaXMuX21vZGVsRGF0YS5oYXNSZWFsVmlldykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9tb2RlbERhdGEudmlldy5mb2N1cygpO1xuXHR9XG5cblx0cHVibGljIGhhc1RleHRGb2N1cygpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSB8fCAhdGhpcy5fbW9kZWxEYXRhLmhhc1JlYWxWaWV3KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tb2RlbERhdGEudmlldy5pc0ZvY3VzZWQoKTtcblx0fVxuXG5cdHB1YmxpYyBoYXNXaWRnZXRGb2N1cygpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSB8fCAhdGhpcy5fbW9kZWxEYXRhLmhhc1JlYWxWaWV3KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tb2RlbERhdGEudmlldy5pc1dpZGdldEZvY3VzZWQoKTtcblx0fVxuXG5cdHB1YmxpYyBhZGRDb250ZW50V2lkZ2V0KHdpZGdldDogZWRpdG9yQnJvd3Nlci5JQ29udGVudFdpZGdldCk6IHZvaWQge1xuXHRcdGNvbnN0IHdpZGdldERhdGE6IElDb250ZW50V2lkZ2V0RGF0YSA9IHtcblx0XHRcdHdpZGdldDogd2lkZ2V0LFxuXHRcdFx0cG9zaXRpb246IHdpZGdldC5nZXRQb3NpdGlvbigpXG5cdFx0fTtcblxuXHRcdGlmICh0aGlzLl9jb250ZW50V2lkZ2V0cy5oYXNPd25Qcm9wZXJ0eSh3aWRnZXQuZ2V0SWQoKSkpIHtcblx0XHRcdGNvbnNvbGUud2FybignT3ZlcndyaXRpbmcgYSBjb250ZW50IHdpZGdldCB3aXRoIHRoZSBzYW1lIGlkOicgKyB3aWRnZXQuZ2V0SWQoKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY29udGVudFdpZGdldHNbd2lkZ2V0LmdldElkKCldID0gd2lkZ2V0RGF0YTtcblxuXHRcdGlmICh0aGlzLl9tb2RlbERhdGEgJiYgdGhpcy5fbW9kZWxEYXRhLmhhc1JlYWxWaWV3KSB7XG5cdFx0XHR0aGlzLl9tb2RlbERhdGEudmlldy5hZGRDb250ZW50V2lkZ2V0KHdpZGdldERhdGEpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBsYXlvdXRDb250ZW50V2lkZ2V0KHdpZGdldDogZWRpdG9yQnJvd3Nlci5JQ29udGVudFdpZGdldCk6IHZvaWQge1xuXHRcdGNvbnN0IHdpZGdldElkID0gd2lkZ2V0LmdldElkKCk7XG5cdFx0aWYgKHRoaXMuX2NvbnRlbnRXaWRnZXRzLmhhc093blByb3BlcnR5KHdpZGdldElkKSkge1xuXHRcdFx0Y29uc3Qgd2lkZ2V0RGF0YSA9IHRoaXMuX2NvbnRlbnRXaWRnZXRzW3dpZGdldElkXTtcblx0XHRcdHdpZGdldERhdGEucG9zaXRpb24gPSB3aWRnZXQuZ2V0UG9zaXRpb24oKTtcblx0XHRcdGlmICh0aGlzLl9tb2RlbERhdGEgJiYgdGhpcy5fbW9kZWxEYXRhLmhhc1JlYWxWaWV3KSB7XG5cdFx0XHRcdHRoaXMuX21vZGVsRGF0YS52aWV3LmxheW91dENvbnRlbnRXaWRnZXQod2lkZ2V0RGF0YSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHJlbW92ZUNvbnRlbnRXaWRnZXQod2lkZ2V0OiBlZGl0b3JCcm93c2VyLklDb250ZW50V2lkZ2V0KTogdm9pZCB7XG5cdFx0Y29uc3Qgd2lkZ2V0SWQgPSB3aWRnZXQuZ2V0SWQoKTtcblx0XHRpZiAodGhpcy5fY29udGVudFdpZGdldHMuaGFzT3duUHJvcGVydHkod2lkZ2V0SWQpKSB7XG5cdFx0XHRjb25zdCB3aWRnZXREYXRhID0gdGhpcy5fY29udGVudFdpZGdldHNbd2lkZ2V0SWRdO1xuXHRcdFx0ZGVsZXRlIHRoaXMuX2NvbnRlbnRXaWRnZXRzW3dpZGdldElkXTtcblx0XHRcdGlmICh0aGlzLl9tb2RlbERhdGEgJiYgdGhpcy5fbW9kZWxEYXRhLmhhc1JlYWxWaWV3KSB7XG5cdFx0XHRcdHRoaXMuX21vZGVsRGF0YS52aWV3LnJlbW92ZUNvbnRlbnRXaWRnZXQod2lkZ2V0RGF0YSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFkZE92ZXJsYXlXaWRnZXQod2lkZ2V0OiBlZGl0b3JCcm93c2VyLklPdmVybGF5V2lkZ2V0KTogdm9pZCB7XG5cdFx0Y29uc3Qgd2lkZ2V0RGF0YTogSU92ZXJsYXlXaWRnZXREYXRhID0ge1xuXHRcdFx0d2lkZ2V0OiB3aWRnZXQsXG5cdFx0XHRwb3NpdGlvbjogd2lkZ2V0LmdldFBvc2l0aW9uKClcblx0XHR9O1xuXG5cdFx0aWYgKHRoaXMuX292ZXJsYXlXaWRnZXRzLmhhc093blByb3BlcnR5KHdpZGdldC5nZXRJZCgpKSkge1xuXHRcdFx0Y29uc29sZS53YXJuKCdPdmVyd3JpdGluZyBhbiBvdmVybGF5IHdpZGdldCB3aXRoIHRoZSBzYW1lIGlkLicpO1xuXHRcdH1cblxuXHRcdHRoaXMuX292ZXJsYXlXaWRnZXRzW3dpZGdldC5nZXRJZCgpXSA9IHdpZGdldERhdGE7XG5cdFx0aWYgKHRoaXMuX21vZGVsRGF0YSAmJiB0aGlzLl9tb2RlbERhdGEuaGFzUmVhbFZpZXcpIHtcblx0XHRcdHRoaXMuX21vZGVsRGF0YS52aWV3LmFkZE92ZXJsYXlXaWRnZXQod2lkZ2V0RGF0YSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGxheW91dE92ZXJsYXlXaWRnZXQod2lkZ2V0OiBlZGl0b3JCcm93c2VyLklPdmVybGF5V2lkZ2V0KTogdm9pZCB7XG5cdFx0Y29uc3Qgd2lkZ2V0SWQgPSB3aWRnZXQuZ2V0SWQoKTtcblx0XHRpZiAodGhpcy5fb3ZlcmxheVdpZGdldHMuaGFzT3duUHJvcGVydHkod2lkZ2V0SWQpKSB7XG5cdFx0XHRjb25zdCB3aWRnZXREYXRhID0gdGhpcy5fb3ZlcmxheVdpZGdldHNbd2lkZ2V0SWRdO1xuXHRcdFx0d2lkZ2V0RGF0YS5wb3NpdGlvbiA9IHdpZGdldC5nZXRQb3NpdGlvbigpO1xuXHRcdFx0aWYgKHRoaXMuX21vZGVsRGF0YSAmJiB0aGlzLl9tb2RlbERhdGEuaGFzUmVhbFZpZXcpIHtcblx0XHRcdFx0dGhpcy5fbW9kZWxEYXRhLnZpZXcubGF5b3V0T3ZlcmxheVdpZGdldCh3aWRnZXREYXRhKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcmVtb3ZlT3ZlcmxheVdpZGdldCh3aWRnZXQ6IGVkaXRvckJyb3dzZXIuSU92ZXJsYXlXaWRnZXQpOiB2b2lkIHtcblx0XHRjb25zdCB3aWRnZXRJZCA9IHdpZGdldC5nZXRJZCgpO1xuXHRcdGlmICh0aGlzLl9vdmVybGF5V2lkZ2V0cy5oYXNPd25Qcm9wZXJ0eSh3aWRnZXRJZCkpIHtcblx0XHRcdGNvbnN0IHdpZGdldERhdGEgPSB0aGlzLl9vdmVybGF5V2lkZ2V0c1t3aWRnZXRJZF07XG5cdFx0XHRkZWxldGUgdGhpcy5fb3ZlcmxheVdpZGdldHNbd2lkZ2V0SWRdO1xuXHRcdFx0aWYgKHRoaXMuX21vZGVsRGF0YSAmJiB0aGlzLl9tb2RlbERhdGEuaGFzUmVhbFZpZXcpIHtcblx0XHRcdFx0dGhpcy5fbW9kZWxEYXRhLnZpZXcucmVtb3ZlT3ZlcmxheVdpZGdldCh3aWRnZXREYXRhKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYWRkR2x5cGhNYXJnaW5XaWRnZXQod2lkZ2V0OiBlZGl0b3JCcm93c2VyLklHbHlwaE1hcmdpbldpZGdldCk6IHZvaWQge1xuXHRcdGNvbnN0IHdpZGdldERhdGE6IElHbHlwaE1hcmdpbldpZGdldERhdGEgPSB7XG5cdFx0XHR3aWRnZXQ6IHdpZGdldCxcblx0XHRcdHBvc2l0aW9uOiB3aWRnZXQuZ2V0UG9zaXRpb24oKVxuXHRcdH07XG5cblx0XHRpZiAodGhpcy5fZ2x5cGhNYXJnaW5XaWRnZXRzLmhhc093blByb3BlcnR5KHdpZGdldC5nZXRJZCgpKSkge1xuXHRcdFx0Y29uc29sZS53YXJuKCdPdmVyd3JpdGluZyBhIGdseXBoIG1hcmdpbiB3aWRnZXQgd2l0aCB0aGUgc2FtZSBpZC4nKTtcblx0XHR9XG5cblx0XHR0aGlzLl9nbHlwaE1hcmdpbldpZGdldHNbd2lkZ2V0LmdldElkKCldID0gd2lkZ2V0RGF0YTtcblxuXHRcdGlmICh0aGlzLl9tb2RlbERhdGEgJiYgdGhpcy5fbW9kZWxEYXRhLmhhc1JlYWxWaWV3KSB7XG5cdFx0XHR0aGlzLl9tb2RlbERhdGEudmlldy5hZGRHbHlwaE1hcmdpbldpZGdldCh3aWRnZXREYXRhKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgbGF5b3V0R2x5cGhNYXJnaW5XaWRnZXQod2lkZ2V0OiBlZGl0b3JCcm93c2VyLklHbHlwaE1hcmdpbldpZGdldCk6IHZvaWQge1xuXHRcdGNvbnN0IHdpZGdldElkID0gd2lkZ2V0LmdldElkKCk7XG5cdFx0aWYgKHRoaXMuX2dseXBoTWFyZ2luV2lkZ2V0cy5oYXNPd25Qcm9wZXJ0eSh3aWRnZXRJZCkpIHtcblx0XHRcdGNvbnN0IHdpZGdldERhdGEgPSB0aGlzLl9nbHlwaE1hcmdpbldpZGdldHNbd2lkZ2V0SWRdO1xuXHRcdFx0d2lkZ2V0RGF0YS5wb3NpdGlvbiA9IHdpZGdldC5nZXRQb3NpdGlvbigpO1xuXHRcdFx0aWYgKHRoaXMuX21vZGVsRGF0YSAmJiB0aGlzLl9tb2RlbERhdGEuaGFzUmVhbFZpZXcpIHtcblx0XHRcdFx0dGhpcy5fbW9kZWxEYXRhLnZpZXcubGF5b3V0R2x5cGhNYXJnaW5XaWRnZXQod2lkZ2V0RGF0YSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHJlbW92ZUdseXBoTWFyZ2luV2lkZ2V0KHdpZGdldDogZWRpdG9yQnJvd3Nlci5JR2x5cGhNYXJnaW5XaWRnZXQpOiB2b2lkIHtcblx0XHRjb25zdCB3aWRnZXRJZCA9IHdpZGdldC5nZXRJZCgpO1xuXHRcdGlmICh0aGlzLl9nbHlwaE1hcmdpbldpZGdldHMuaGFzT3duUHJvcGVydHkod2lkZ2V0SWQpKSB7XG5cdFx0XHRjb25zdCB3aWRnZXREYXRhID0gdGhpcy5fZ2x5cGhNYXJnaW5XaWRnZXRzW3dpZGdldElkXTtcblx0XHRcdGRlbGV0ZSB0aGlzLl9nbHlwaE1hcmdpbldpZGdldHNbd2lkZ2V0SWRdO1xuXHRcdFx0aWYgKHRoaXMuX21vZGVsRGF0YSAmJiB0aGlzLl9tb2RlbERhdGEuaGFzUmVhbFZpZXcpIHtcblx0XHRcdFx0dGhpcy5fbW9kZWxEYXRhLnZpZXcucmVtb3ZlR2x5cGhNYXJnaW5XaWRnZXQod2lkZ2V0RGF0YSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGNoYW5nZVZpZXdab25lcyhjYWxsYmFjazogKGFjY2Vzc29yOiBlZGl0b3JCcm93c2VyLklWaWV3Wm9uZUNoYW5nZUFjY2Vzc29yKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEgfHwgIXRoaXMuX21vZGVsRGF0YS5oYXNSZWFsVmlldykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9tb2RlbERhdGEudmlldy5jaGFuZ2UoY2FsbGJhY2spO1xuXHR9XG5cblx0cHVibGljIGdldFRhcmdldEF0Q2xpZW50UG9pbnQoY2xpZW50WDogbnVtYmVyLCBjbGllbnRZOiBudW1iZXIpOiBlZGl0b3JCcm93c2VyLklNb3VzZVRhcmdldCB8IG51bGwge1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhIHx8ICF0aGlzLl9tb2RlbERhdGEuaGFzUmVhbFZpZXcpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbW9kZWxEYXRhLnZpZXcuZ2V0VGFyZ2V0QXRDbGllbnRQb2ludChjbGllbnRYLCBjbGllbnRZKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRTY3JvbGxlZFZpc2libGVQb3NpdGlvbihyYXdQb3NpdGlvbjogSVBvc2l0aW9uKTogeyB0b3A6IG51bWJlcjsgbGVmdDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9IHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEgfHwgIXRoaXMuX21vZGVsRGF0YS5oYXNSZWFsVmlldykge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLl9tb2RlbERhdGEubW9kZWwudmFsaWRhdGVQb3NpdGlvbihyYXdQb3NpdGlvbik7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuX2NvbmZpZ3VyYXRpb24ub3B0aW9ucztcblx0XHRjb25zdCBsYXlvdXRJbmZvID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxheW91dEluZm8pO1xuXG5cdFx0Y29uc3QgdG9wID0gQ29kZUVkaXRvcldpZGdldC5fZ2V0VmVydGljYWxPZmZzZXRGb3JQb3NpdGlvbih0aGlzLl9tb2RlbERhdGEsIHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbikgLSB0aGlzLmdldFNjcm9sbFRvcCgpO1xuXHRcdGNvbnN0IGxlZnQgPSB0aGlzLl9tb2RlbERhdGEudmlldy5nZXRPZmZzZXRGb3JDb2x1bW4ocG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uKSArIGxheW91dEluZm8uZ2x5cGhNYXJnaW5XaWR0aCArIGxheW91dEluZm8ubGluZU51bWJlcnNXaWR0aCArIGxheW91dEluZm8uZGVjb3JhdGlvbnNXaWR0aCAtIHRoaXMuZ2V0U2Nyb2xsTGVmdCgpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHRvcDogdG9wLFxuXHRcdFx0bGVmdDogbGVmdCxcblx0XHRcdGhlaWdodDogb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpXG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBnZXRPZmZzZXRGb3JDb2x1bW4obGluZU51bWJlcjogbnVtYmVyLCBjb2x1bW46IG51bWJlcik6IG51bWJlciB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbERhdGEgfHwgIXRoaXMuX21vZGVsRGF0YS5oYXNSZWFsVmlldykge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbW9kZWxEYXRhLnZpZXcuZ2V0T2Zmc2V0Rm9yQ29sdW1uKGxpbmVOdW1iZXIsIGNvbHVtbik7XG5cdH1cblxuXHRwdWJsaWMgcmVuZGVyKGZvcmNlUmVkcmF3OiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSB8fCAhdGhpcy5fbW9kZWxEYXRhLmhhc1JlYWxWaWV3KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX21vZGVsRGF0YS52aWV3TW9kZWwuYmF0Y2hFdmVudHMoKCkgPT4ge1xuXHRcdFx0dGhpcy5fbW9kZWxEYXRhIS52aWV3LnJlbmRlcih0cnVlLCBmb3JjZVJlZHJhdyk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgc2V0QXJpYU9wdGlvbnMob3B0aW9uczogZWRpdG9yQnJvd3Nlci5JRWRpdG9yQXJpYU9wdGlvbnMpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX21vZGVsRGF0YSB8fCAhdGhpcy5fbW9kZWxEYXRhLmhhc1JlYWxWaWV3KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX21vZGVsRGF0YS52aWV3LnNldEFyaWFPcHRpb25zKG9wdGlvbnMpO1xuXHR9XG5cblx0cHVibGljIGFwcGx5Rm9udEluZm8odGFyZ2V0OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdGFwcGx5Rm9udEluZm8odGFyZ2V0LCB0aGlzLl9jb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5mb250SW5mbykpO1xuXHR9XG5cblx0cHVibGljIHNldEJhbm5lcihkb21Ob2RlOiBIVE1MRWxlbWVudCB8IG51bGwsIGRvbU5vZGVIZWlnaHQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9iYW5uZXJEb21Ob2RlICYmIHRoaXMuX2RvbUVsZW1lbnQuY29udGFpbnModGhpcy5fYmFubmVyRG9tTm9kZSkpIHtcblx0XHRcdHRoaXMuX2Jhbm5lckRvbU5vZGUucmVtb3ZlKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fYmFubmVyRG9tTm9kZSA9IGRvbU5vZGU7XG5cdFx0dGhpcy5fY29uZmlndXJhdGlvbi5zZXRSZXNlcnZlZEhlaWdodChkb21Ob2RlID8gZG9tTm9kZUhlaWdodCA6IDApO1xuXG5cdFx0aWYgKHRoaXMuX2Jhbm5lckRvbU5vZGUpIHtcblx0XHRcdHRoaXMuX2RvbUVsZW1lbnQucHJlcGVuZCh0aGlzLl9iYW5uZXJEb21Ob2RlKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2F0dGFjaE1vZGVsKG1vZGVsOiBJVGV4dE1vZGVsIHwgbnVsbCk6IHZvaWQge1xuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHRoaXMuX21vZGVsRGF0YSA9IG51bGw7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGlzdGVuZXJzVG9SZW1vdmU6IElEaXNwb3NhYmxlW10gPSBbXTtcblxuXHRcdHRoaXMuX2RvbUVsZW1lbnQuc2V0QXR0cmlidXRlKCdkYXRhLW1vZGUtaWQnLCBtb2RlbC5nZXRMYW5ndWFnZUlkKCkpO1xuXHRcdHRoaXMuX2NvbmZpZ3VyYXRpb24uc2V0SXNEb21pbmF0ZWRCeUxvbmdMaW5lcyhtb2RlbC5pc0RvbWluYXRlZEJ5TG9uZ0xpbmVzKCkpO1xuXHRcdHRoaXMuX2NvbmZpZ3VyYXRpb24uc2V0TW9kZWxMaW5lQ291bnQobW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXG5cdFx0Y29uc3QgYXR0YWNoZWRWaWV3ID0gbW9kZWwub25CZWZvcmVBdHRhY2hlZCgpO1xuXG5cdFx0Y29uc3Qgdmlld01vZGVsID0gbmV3IFZpZXdNb2RlbChcblx0XHRcdHRoaXMuX2lkLFxuXHRcdFx0dGhpcy5fY29uZmlndXJhdGlvbixcblx0XHRcdG1vZGVsLFxuXHRcdFx0RE9NTGluZUJyZWFrc0NvbXB1dGVyRmFjdG9yeS5jcmVhdGUoZG9tLmdldFdpbmRvdyh0aGlzLl9kb21FbGVtZW50KSksXG5cdFx0XHRNb25vc3BhY2VMaW5lQnJlYWtzQ29tcHV0ZXJGYWN0b3J5LmNyZWF0ZSh0aGlzLl9jb25maWd1cmF0aW9uLm9wdGlvbnMpLFxuXHRcdFx0KGNhbGxiYWNrKSA9PiBkb20uc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZShkb20uZ2V0V2luZG93KHRoaXMuX2RvbUVsZW1lbnQpLCBjYWxsYmFjayksXG5cdFx0XHR0aGlzLmxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHR0aGlzLl90aGVtZVNlcnZpY2UsXG5cdFx0XHRhdHRhY2hlZFZpZXcsXG5cdFx0XHR7XG5cdFx0XHRcdGJhdGNoQ2hhbmdlczogKGNiKSA9PiB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdHRoaXMuX2JlZ2luVXBkYXRlKCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gY2IoKTtcblx0XHRcdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRcdFx0dGhpcy5fZW5kVXBkYXRlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHQvLyBTb21lb25lIG1pZ2h0IGRlc3Ryb3kgdGhlIG1vZGVsIGZyb20gdW5kZXIgdGhlIGVkaXRvciwgc28gcHJldmVudCBhbnkgZXhjZXB0aW9ucyBieSBzZXR0aW5nIGEgbnVsbCBtb2RlbFxuXHRcdGxpc3RlbmVyc1RvUmVtb3ZlLnB1c2gobW9kZWwub25XaWxsRGlzcG9zZSgoKSA9PiB0aGlzLnNldE1vZGVsKG51bGwpKSk7XG5cblx0XHRsaXN0ZW5lcnNUb1JlbW92ZS5wdXNoKHZpZXdNb2RlbC5vbkV2ZW50KChlKSA9PiB7XG5cdFx0XHRzd2l0Y2ggKGUua2luZCkge1xuXHRcdFx0XHRjYXNlIE91dGdvaW5nVmlld01vZGVsRXZlbnRLaW5kLkNvbnRlbnRTaXplQ2hhbmdlZDpcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENvbnRlbnRTaXplQ2hhbmdlLmZpcmUoZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgT3V0Z29pbmdWaWV3TW9kZWxFdmVudEtpbmQuRm9jdXNDaGFuZ2VkOlxuXHRcdFx0XHRcdHRoaXMuX2VkaXRvclRleHRGb2N1cy5zZXRWYWx1ZShlLmhhc0ZvY3VzKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBPdXRnb2luZ1ZpZXdNb2RlbEV2ZW50S2luZC5XaWRnZXRGb2N1c0NoYW5nZWQ6XG5cdFx0XHRcdFx0dGhpcy5fZWRpdG9yV2lkZ2V0Rm9jdXMuc2V0VmFsdWUoZS5oYXNGb2N1cyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgT3V0Z29pbmdWaWV3TW9kZWxFdmVudEtpbmQuU2Nyb2xsQ2hhbmdlZDpcblx0XHRcdFx0XHR0aGlzLl9vbkRpZFNjcm9sbENoYW5nZS5maXJlKGUpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIE91dGdvaW5nVmlld01vZGVsRXZlbnRLaW5kLlZpZXdab25lc0NoYW5nZWQ6XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VWaWV3Wm9uZXMuZmlyZSgpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIE91dGdvaW5nVmlld01vZGVsRXZlbnRLaW5kLkhpZGRlbkFyZWFzQ2hhbmdlZDpcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUhpZGRlbkFyZWFzLmZpcmUoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBPdXRnb2luZ1ZpZXdNb2RlbEV2ZW50S2luZC5SZWFkT25seUVkaXRBdHRlbXB0OlxuXHRcdFx0XHRcdHRoaXMuX29uRGlkQXR0ZW1wdFJlYWRPbmx5RWRpdC5maXJlKCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgT3V0Z29pbmdWaWV3TW9kZWxFdmVudEtpbmQuQ3Vyc29yU3RhdGVDaGFuZ2VkOiB7XG5cdFx0XHRcdFx0aWYgKGUucmVhY2hlZE1heEN1cnNvckNvdW50KSB7XG5cblx0XHRcdFx0XHRcdGNvbnN0IG11bHRpQ3Vyc29yTGltaXQgPSB0aGlzLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubXVsdGlDdXJzb3JMaW1pdCk7XG5cdFx0XHRcdFx0XHRjb25zdCBtZXNzYWdlID0gbmxzLmxvY2FsaXplKCdjdXJzb3JzLm1heGltdW0nLCBcIlRoZSBudW1iZXIgb2YgY3Vyc29ycyBoYXMgYmVlbiBsaW1pdGVkIHRvIHswfS4gQ29uc2lkZXIgdXNpbmcgW2ZpbmQgYW5kIHJlcGxhY2VdKGh0dHBzOi8vY29kZS52aXN1YWxzdHVkaW8uY29tL2RvY3MvZWRpdG9yL2NvZGViYXNpY3MjX2ZpbmQtYW5kLXJlcGxhY2UpIGZvciBsYXJnZXIgY2hhbmdlcyBvciBpbmNyZWFzZSB0aGUgZWRpdG9yIG11bHRpIGN1cnNvciBsaW1pdCBzZXR0aW5nLlwiLCBtdWx0aUN1cnNvckxpbWl0KTtcblx0XHRcdFx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFNldmVyaXR5Lldhcm5pbmcsIG1lc3NhZ2UsIFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdGxhYmVsOiAnRmluZCBhbmQgUmVwbGFjZScsXG5cdFx0XHRcdFx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnZWRpdG9yLmFjdGlvbi5zdGFydEZpbmRSZXBsYWNlQWN0aW9uJyk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnZ29Ub1NldHRpbmcnLCAnSW5jcmVhc2UgTXVsdGkgQ3Vyc29yIExpbWl0JyksXG5cdFx0XHRcdFx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnd29ya2JlbmNoLmFjdGlvbi5vcGVuU2V0dGluZ3MyJywge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRxdWVyeTogJ2VkaXRvci5tdWx0aUN1cnNvckxpbWl0J1xuXHRcdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRdKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBwb3NpdGlvbnM6IFBvc2l0aW9uW10gPSBbXTtcblx0XHRcdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gZS5zZWxlY3Rpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdFx0XHRwb3NpdGlvbnNbaV0gPSBlLnNlbGVjdGlvbnNbaV0uZ2V0UG9zaXRpb24oKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBlMTogSUN1cnNvclBvc2l0aW9uQ2hhbmdlZEV2ZW50ID0ge1xuXHRcdFx0XHRcdFx0cG9zaXRpb246IHBvc2l0aW9uc1swXSxcblx0XHRcdFx0XHRcdHNlY29uZGFyeVBvc2l0aW9uczogcG9zaXRpb25zLnNsaWNlKDEpLFxuXHRcdFx0XHRcdFx0cmVhc29uOiBlLnJlYXNvbixcblx0XHRcdFx0XHRcdHNvdXJjZTogZS5zb3VyY2Vcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb24uZmlyZShlMSk7XG5cblx0XHRcdFx0XHRjb25zdCBlMjogSUN1cnNvclNlbGVjdGlvbkNoYW5nZWRFdmVudCA9IHtcblx0XHRcdFx0XHRcdHNlbGVjdGlvbjogZS5zZWxlY3Rpb25zWzBdLFxuXHRcdFx0XHRcdFx0c2Vjb25kYXJ5U2VsZWN0aW9uczogZS5zZWxlY3Rpb25zLnNsaWNlKDEpLFxuXHRcdFx0XHRcdFx0bW9kZWxWZXJzaW9uSWQ6IGUubW9kZWxWZXJzaW9uSWQsXG5cdFx0XHRcdFx0XHRvbGRTZWxlY3Rpb25zOiBlLm9sZFNlbGVjdGlvbnMsXG5cdFx0XHRcdFx0XHRvbGRNb2RlbFZlcnNpb25JZDogZS5vbGRNb2RlbFZlcnNpb25JZCxcblx0XHRcdFx0XHRcdHNvdXJjZTogZS5zb3VyY2UsXG5cdFx0XHRcdFx0XHRyZWFzb246IGUucmVhc29uXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUN1cnNvclNlbGVjdGlvbi5maXJlKGUyKTtcblxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgT3V0Z29pbmdWaWV3TW9kZWxFdmVudEtpbmQuTW9kZWxEZWNvcmF0aW9uc0NoYW5nZWQ6XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VNb2RlbERlY29yYXRpb25zLmZpcmUoZS5ldmVudCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgT3V0Z29pbmdWaWV3TW9kZWxFdmVudEtpbmQuTW9kZWxMYW5ndWFnZUNoYW5nZWQ6XG5cdFx0XHRcdFx0dGhpcy5fZG9tRWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2RhdGEtbW9kZS1pZCcsIG1vZGVsLmdldExhbmd1YWdlSWQoKSk7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VNb2RlbExhbmd1YWdlLmZpcmUoZS5ldmVudCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgT3V0Z29pbmdWaWV3TW9kZWxFdmVudEtpbmQuTW9kZWxMYW5ndWFnZUNvbmZpZ3VyYXRpb25DaGFuZ2VkOlxuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlTW9kZWxMYW5ndWFnZUNvbmZpZ3VyYXRpb24uZmlyZShlLmV2ZW50KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBPdXRnb2luZ1ZpZXdNb2RlbEV2ZW50S2luZC5Nb2RlbENvbnRlbnRDaGFuZ2VkOlxuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlTW9kZWxDb250ZW50LmZpcmUoZS5ldmVudCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgT3V0Z29pbmdWaWV3TW9kZWxFdmVudEtpbmQuTW9kZWxPcHRpb25zQ2hhbmdlZDpcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZU1vZGVsT3B0aW9ucy5maXJlKGUuZXZlbnQpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIE91dGdvaW5nVmlld01vZGVsRXZlbnRLaW5kLk1vZGVsVG9rZW5zQ2hhbmdlZDpcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZU1vZGVsVG9rZW5zLmZpcmUoZS5ldmVudCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBbdmlldywgaGFzUmVhbFZpZXddID0gdGhpcy5fY3JlYXRlVmlldyh2aWV3TW9kZWwpO1xuXHRcdGlmIChoYXNSZWFsVmlldykge1xuXHRcdFx0dGhpcy5fZG9tRWxlbWVudC5hcHBlbmRDaGlsZCh2aWV3LmRvbU5vZGUuZG9tTm9kZSk7XG5cblx0XHRcdGxldCBrZXlzID0gT2JqZWN0LmtleXModGhpcy5fY29udGVudFdpZGdldHMpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGtleXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0Y29uc3Qgd2lkZ2V0SWQgPSBrZXlzW2ldO1xuXHRcdFx0XHR2aWV3LmFkZENvbnRlbnRXaWRnZXQodGhpcy5fY29udGVudFdpZGdldHNbd2lkZ2V0SWRdKTtcblx0XHRcdH1cblxuXHRcdFx0a2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuX292ZXJsYXlXaWRnZXRzKTtcblx0XHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBrZXlzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IHdpZGdldElkID0ga2V5c1tpXTtcblx0XHRcdFx0dmlldy5hZGRPdmVybGF5V2lkZ2V0KHRoaXMuX292ZXJsYXlXaWRnZXRzW3dpZGdldElkXSk7XG5cdFx0XHR9XG5cblx0XHRcdGtleXMgPSBPYmplY3Qua2V5cyh0aGlzLl9nbHlwaE1hcmdpbldpZGdldHMpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGtleXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0Y29uc3Qgd2lkZ2V0SWQgPSBrZXlzW2ldO1xuXHRcdFx0XHR2aWV3LmFkZEdseXBoTWFyZ2luV2lkZ2V0KHRoaXMuX2dseXBoTWFyZ2luV2lkZ2V0c1t3aWRnZXRJZF0pO1xuXHRcdFx0fVxuXG5cdFx0XHR2aWV3LnJlbmRlcihmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR2aWV3LmRvbU5vZGUuZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2RhdGEtdXJpJywgbW9kZWwudXJpLnRvU3RyaW5nKCkpO1xuXHRcdH1cblxuXHRcdHRoaXMuX21vZGVsRGF0YSA9IG5ldyBNb2RlbERhdGEobW9kZWwsIHZpZXdNb2RlbCwgdmlldywgaGFzUmVhbFZpZXcsIGxpc3RlbmVyc1RvUmVtb3ZlLCBhdHRhY2hlZFZpZXcpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9jcmVhdGVWaWV3KHZpZXdNb2RlbDogVmlld01vZGVsKTogW1ZpZXcsIGJvb2xlYW5dIHtcblx0XHRsZXQgY29tbWFuZERlbGVnYXRlOiBJQ29tbWFuZERlbGVnYXRlO1xuXHRcdGlmICh0aGlzLmlzU2ltcGxlV2lkZ2V0KSB7XG5cdFx0XHRjb21tYW5kRGVsZWdhdGUgPSB7XG5cdFx0XHRcdHBhc3RlOiAodGV4dDogc3RyaW5nLCBwYXN0ZU9uTmV3TGluZTogYm9vbGVhbiwgbXVsdGljdXJzb3JUZXh0OiBzdHJpbmdbXSB8IG51bGwsIG1vZGU6IHN0cmluZyB8IG51bGwpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9wYXN0ZSgna2V5Ym9hcmQnLCB0ZXh0LCBwYXN0ZU9uTmV3TGluZSwgbXVsdGljdXJzb3JUZXh0LCBtb2RlKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0dHlwZTogKHRleHQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX3R5cGUoJ2tleWJvYXJkJywgdGV4dCk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNvbXBvc2l0aW9uVHlwZTogKHRleHQ6IHN0cmluZywgcmVwbGFjZVByZXZDaGFyQ250OiBudW1iZXIsIHJlcGxhY2VOZXh0Q2hhckNudDogbnVtYmVyLCBwb3NpdGlvbkRlbHRhOiBudW1iZXIpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9jb21wb3NpdGlvblR5cGUoJ2tleWJvYXJkJywgdGV4dCwgcmVwbGFjZVByZXZDaGFyQ250LCByZXBsYWNlTmV4dENoYXJDbnQsIHBvc2l0aW9uRGVsdGEpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRzdGFydENvbXBvc2l0aW9uOiAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fc3RhcnRDb21wb3NpdGlvbigpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRlbmRDb21wb3NpdGlvbjogKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX2VuZENvbXBvc2l0aW9uKCdrZXlib2FyZCcpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRjdXQ6ICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9jdXQoJ2tleWJvYXJkJyk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbW1hbmREZWxlZ2F0ZSA9IHtcblx0XHRcdFx0cGFzdGU6ICh0ZXh0OiBzdHJpbmcsIHBhc3RlT25OZXdMaW5lOiBib29sZWFuLCBtdWx0aWN1cnNvclRleHQ6IHN0cmluZ1tdIHwgbnVsbCwgbW9kZTogc3RyaW5nIHwgbnVsbCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHBheWxvYWQ6IGVkaXRvckJyb3dzZXIuUGFzdGVQYXlsb2FkID0geyB0ZXh0LCBwYXN0ZU9uTmV3TGluZSwgbXVsdGljdXJzb3JUZXh0LCBtb2RlIH07XG5cdFx0XHRcdFx0dGhpcy5fY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoZWRpdG9yQ29tbW9uLkhhbmRsZXIuUGFzdGUsIHBheWxvYWQpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR0eXBlOiAodGV4dDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcGF5bG9hZDogZWRpdG9yQ29tbW9uLlR5cGVQYXlsb2FkID0geyB0ZXh0IH07XG5cdFx0XHRcdFx0dGhpcy5fY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoZWRpdG9yQ29tbW9uLkhhbmRsZXIuVHlwZSwgcGF5bG9hZCk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNvbXBvc2l0aW9uVHlwZTogKHRleHQ6IHN0cmluZywgcmVwbGFjZVByZXZDaGFyQ250OiBudW1iZXIsIHJlcGxhY2VOZXh0Q2hhckNudDogbnVtYmVyLCBwb3NpdGlvbkRlbHRhOiBudW1iZXIpID0+IHtcblx0XHRcdFx0XHQvLyBUcnkgaWYgcG9zc2libGUgdG8gZ28gdGhyb3VnaCB0aGUgZXhpc3RpbmcgYHJlcGxhY2VQcmV2aW91c0NoYXJgIGNvbW1hbmRcblx0XHRcdFx0XHRpZiAocmVwbGFjZU5leHRDaGFyQ250IHx8IHBvc2l0aW9uRGVsdGEpIHtcblx0XHRcdFx0XHRcdC8vIG11c3QgYmUgaGFuZGxlZCB0aHJvdWdoIHRoZSBuZXcgY29tbWFuZFxuXHRcdFx0XHRcdFx0Y29uc3QgcGF5bG9hZDogZWRpdG9yQ29tbW9uLkNvbXBvc2l0aW9uVHlwZVBheWxvYWQgPSB7IHRleHQsIHJlcGxhY2VQcmV2Q2hhckNudCwgcmVwbGFjZU5leHRDaGFyQ250LCBwb3NpdGlvbkRlbHRhIH07XG5cdFx0XHRcdFx0XHR0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChlZGl0b3JDb21tb24uSGFuZGxlci5Db21wb3NpdGlvblR5cGUsIHBheWxvYWQpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb25zdCBwYXlsb2FkOiBlZGl0b3JDb21tb24uUmVwbGFjZVByZXZpb3VzQ2hhclBheWxvYWQgPSB7IHRleHQsIHJlcGxhY2VDaGFyQ250OiByZXBsYWNlUHJldkNoYXJDbnQgfTtcblx0XHRcdFx0XHRcdHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGVkaXRvckNvbW1vbi5IYW5kbGVyLlJlcGxhY2VQcmV2aW91c0NoYXIsIHBheWxvYWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0c3RhcnRDb21wb3NpdGlvbjogKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGVkaXRvckNvbW1vbi5IYW5kbGVyLkNvbXBvc2l0aW9uU3RhcnQsIHt9KTtcblx0XHRcdFx0fSxcblx0XHRcdFx0ZW5kQ29tcG9zaXRpb246ICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChlZGl0b3JDb21tb24uSGFuZGxlci5Db21wb3NpdGlvbkVuZCwge30pO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRjdXQ6ICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChlZGl0b3JDb21tb24uSGFuZGxlci5DdXQsIHt9KTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRjb25zdCB2aWV3VXNlcklucHV0RXZlbnRzID0gbmV3IFZpZXdVc2VySW5wdXRFdmVudHModmlld01vZGVsLmNvb3JkaW5hdGVzQ29udmVydGVyKTtcblx0XHR2aWV3VXNlcklucHV0RXZlbnRzLm9uS2V5RG93biA9IChlKSA9PiB0aGlzLl9vbktleURvd24uZmlyZShlKTtcblx0XHR2aWV3VXNlcklucHV0RXZlbnRzLm9uS2V5VXAgPSAoZSkgPT4gdGhpcy5fb25LZXlVcC5maXJlKGUpO1xuXHRcdHZpZXdVc2VySW5wdXRFdmVudHMub25Db250ZXh0TWVudSA9IChlKSA9PiB0aGlzLl9vbkNvbnRleHRNZW51LmZpcmUoZSk7XG5cdFx0dmlld1VzZXJJbnB1dEV2ZW50cy5vbk1vdXNlTW92ZSA9IChlKSA9PiB0aGlzLl9vbk1vdXNlTW92ZS5maXJlKGUpO1xuXHRcdHZpZXdVc2VySW5wdXRFdmVudHMub25Nb3VzZUxlYXZlID0gKGUpID0+IHRoaXMuX29uTW91c2VMZWF2ZS5maXJlKGUpO1xuXHRcdHZpZXdVc2VySW5wdXRFdmVudHMub25Nb3VzZURvd24gPSAoZSkgPT4gdGhpcy5fb25Nb3VzZURvd24uZmlyZShlKTtcblx0XHR2aWV3VXNlcklucHV0RXZlbnRzLm9uTW91c2VVcCA9IChlKSA9PiB0aGlzLl9vbk1vdXNlVXAuZmlyZShlKTtcblx0XHR2aWV3VXNlcklucHV0RXZlbnRzLm9uTW91c2VEcmFnID0gKGUpID0+IHRoaXMuX29uTW91c2VEcmFnLmZpcmUoZSk7XG5cdFx0dmlld1VzZXJJbnB1dEV2ZW50cy5vbk1vdXNlRHJvcCA9IChlKSA9PiB0aGlzLl9vbk1vdXNlRHJvcC5maXJlKGUpO1xuXHRcdHZpZXdVc2VySW5wdXRFdmVudHMub25Nb3VzZURyb3BDYW5jZWxlZCA9IChlKSA9PiB0aGlzLl9vbk1vdXNlRHJvcENhbmNlbGVkLmZpcmUoZSk7XG5cdFx0dmlld1VzZXJJbnB1dEV2ZW50cy5vbk1vdXNlV2hlZWwgPSAoZSkgPT4gdGhpcy5fb25Nb3VzZVdoZWVsLmZpcmUoZSk7XG5cblx0XHRjb25zdCB2aWV3ID0gbmV3IFZpZXcoXG5cdFx0XHR0aGlzLl9kb21FbGVtZW50LFxuXHRcdFx0dGhpcy5nZXRJZCgpLFxuXHRcdFx0Y29tbWFuZERlbGVnYXRlLFxuXHRcdFx0dGhpcy5fY29uZmlndXJhdGlvbixcblx0XHRcdHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCksXG5cdFx0XHR2aWV3TW9kZWwsXG5cdFx0XHR2aWV3VXNlcklucHV0RXZlbnRzLFxuXHRcdFx0dGhpcy5fb3ZlcmZsb3dXaWRnZXRzRG9tTm9kZSxcblx0XHRcdHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlXG5cdFx0KTtcblxuXHRcdHJldHVybiBbdmlldywgdHJ1ZV07XG5cdH1cblxuXHRwcm90ZWN0ZWQgX3Bvc3REZXRhY2hNb2RlbENsZWFudXAoZGV0YWNoZWRNb2RlbDogSVRleHRNb2RlbCB8IG51bGwpOiB2b2lkIHtcblx0XHRkZXRhY2hlZE1vZGVsPy5yZW1vdmVBbGxEZWNvcmF0aW9uc1dpdGhPd25lcklkKHRoaXMuX2lkKTtcblx0fVxuXG5cdHByaXZhdGUgX2RldGFjaE1vZGVsKCk6IElUZXh0TW9kZWwgfCBudWxsIHtcblx0XHR0aGlzLl9jb250cmlidXRpb25zRGlzcG9zYWJsZT8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2NvbnRyaWJ1dGlvbnNEaXNwb3NhYmxlID0gdW5kZWZpbmVkO1xuXHRcdGlmICghdGhpcy5fbW9kZWxEYXRhKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9tb2RlbERhdGEubW9kZWw7XG5cdFx0Y29uc3QgcmVtb3ZlRG9tTm9kZSA9IHRoaXMuX21vZGVsRGF0YS5oYXNSZWFsVmlldyA/IHRoaXMuX21vZGVsRGF0YS52aWV3LmRvbU5vZGUuZG9tTm9kZSA6IG51bGw7XG5cblx0XHR0aGlzLl9tb2RlbERhdGEuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX21vZGVsRGF0YSA9IG51bGw7XG5cblx0XHR0aGlzLl9kb21FbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSgnZGF0YS1tb2RlLWlkJyk7XG5cdFx0aWYgKHJlbW92ZURvbU5vZGUgJiYgdGhpcy5fZG9tRWxlbWVudC5jb250YWlucyhyZW1vdmVEb21Ob2RlKSkge1xuXHRcdFx0cmVtb3ZlRG9tTm9kZS5yZW1vdmUoKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2Jhbm5lckRvbU5vZGUgJiYgdGhpcy5fZG9tRWxlbWVudC5jb250YWlucyh0aGlzLl9iYW5uZXJEb21Ob2RlKSkge1xuXHRcdFx0dGhpcy5fYmFubmVyRG9tTm9kZS5yZW1vdmUoKTtcblx0XHR9XG5cdFx0cmV0dXJuIG1vZGVsO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVnaXN0ZXJEZWNvcmF0aW9uVHlwZShkZXNjcmlwdGlvbjogc3RyaW5nLCBrZXk6IHN0cmluZywgb3B0aW9uczogZWRpdG9yQ29tbW9uLklEZWNvcmF0aW9uUmVuZGVyT3B0aW9ucywgcGFyZW50VHlwZUtleT86IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX2NvZGVFZGl0b3JTZXJ2aWNlLnJlZ2lzdGVyRGVjb3JhdGlvblR5cGUoZGVzY3JpcHRpb24sIGtleSwgb3B0aW9ucywgcGFyZW50VHlwZUtleSwgdGhpcyk7XG5cdH1cblxuXHRwcml2YXRlIF9yZW1vdmVEZWNvcmF0aW9uVHlwZShrZXk6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX2NvZGVFZGl0b3JTZXJ2aWNlLnJlbW92ZURlY29yYXRpb25UeXBlKGtleSk7XG5cdH1cblxuXHRwcml2YXRlIF9yZXNvbHZlRGVjb3JhdGlvbk9wdGlvbnModHlwZUtleTogc3RyaW5nLCB3cml0YWJsZTogYm9vbGVhbik6IElNb2RlbERlY29yYXRpb25PcHRpb25zIHtcblx0XHRyZXR1cm4gdGhpcy5fY29kZUVkaXRvclNlcnZpY2UucmVzb2x2ZURlY29yYXRpb25PcHRpb25zKHR5cGVLZXksIHdyaXRhYmxlKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRUZWxlbWV0cnlEYXRhKCk6IHsgW2tleTogc3RyaW5nXTogYW55IH0gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl90ZWxlbWV0cnlEYXRhO1xuXHR9XG5cblx0cHVibGljIGhhc01vZGVsKCk6IHRoaXMgaXMgZWRpdG9yQnJvd3Nlci5JQWN0aXZlQ29kZUVkaXRvciB7XG5cdFx0cmV0dXJuICh0aGlzLl9tb2RlbERhdGEgIT09IG51bGwpO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG93RHJvcEluZGljYXRvckF0KHBvc2l0aW9uOiBQb3NpdGlvbik6IHZvaWQge1xuXHRcdGNvbnN0IG5ld0RlY29yYXRpb25zOiBJTW9kZWxEZWx0YURlY29yYXRpb25bXSA9IFt7XG5cdFx0XHRyYW5nZTogbmV3IFJhbmdlKHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbiwgcG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uKSxcblx0XHRcdG9wdGlvbnM6IENvZGVFZGl0b3JXaWRnZXQuZHJvcEludG9FZGl0b3JEZWNvcmF0aW9uT3B0aW9uc1xuXHRcdH1dO1xuXG5cdFx0dGhpcy5fZHJvcEludG9FZGl0b3JEZWNvcmF0aW9ucy5zZXQobmV3RGVjb3JhdGlvbnMpO1xuXHRcdHRoaXMucmV2ZWFsUG9zaXRpb24ocG9zaXRpb24sIGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZURyb3BJbmRpY2F0b3IoKTogdm9pZCB7XG5cdFx0dGhpcy5fZHJvcEludG9FZGl0b3JEZWNvcmF0aW9ucy5jbGVhcigpO1xuXHR9XG5cblx0cHVibGljIHNldENvbnRleHRWYWx1ZShrZXk6IHN0cmluZywgdmFsdWU6IENvbnRleHRLZXlWYWx1ZSk6IHZvaWQge1xuXHRcdHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZUtleShrZXksIHZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgX2JlZ2luVXBkYXRlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3VwZGF0ZUNvdW50ZXIrKztcblx0XHRpZiAodGhpcy5fdXBkYXRlQ291bnRlciA9PT0gMSkge1xuXHRcdFx0dGhpcy5fb25CZWdpblVwZGF0ZS5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZW5kVXBkYXRlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3VwZGF0ZUNvdW50ZXItLTtcblx0XHRpZiAodGhpcy5fdXBkYXRlQ291bnRlciA9PT0gMCkge1xuXHRcdFx0dGhpcy5fb25FbmRVcGRhdGUuZmlyZSgpO1xuXHRcdH1cblx0fVxufVxuXG5sZXQgRURJVE9SX0lEID0gMDtcblxuZXhwb3J0IGludGVyZmFjZSBJQ29kZUVkaXRvcldpZGdldE9wdGlvbnMge1xuXHQvKipcblx0ICogSXMgdGhpcyBhIHNpbXBsZSB3aWRnZXQgKG5vdCBhIHJlYWwgY29kZSBlZGl0b3IpP1xuXHQgKiBEZWZhdWx0cyB0byBmYWxzZS5cblx0ICovXG5cdGlzU2ltcGxlV2lkZ2V0PzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogQ29udHJpYnV0aW9ucyB0byBpbnN0YW50aWF0ZS5cblx0ICogV2hlbiBwcm92aWRlZCwgb25seSB0aGUgY29udHJpYnV0aW9ucyBpbmNsdWRlZCB3aWxsIGJlIGluc3RhbnRpYXRlZC5cblx0ICogVG8gaW5jbHVkZSB0aGUgZGVmYXVsdHMsIHRob3NlIG11c3QgYmUgcHJvdmlkZWQgYXMgd2VsbCB2aWEgWy4uLkVkaXRvckV4dGVuc2lvbnNSZWdpc3RyeS5nZXRFZGl0b3JDb250cmlidXRpb25zKCldXG5cdCAqIERlZmF1bHRzIHRvIEVkaXRvckV4dGVuc2lvbnNSZWdpc3RyeS5nZXRFZGl0b3JDb250cmlidXRpb25zKCkuXG5cdCAqL1xuXHRjb250cmlidXRpb25zPzogSUVkaXRvckNvbnRyaWJ1dGlvbkRlc2NyaXB0aW9uW107XG5cblx0LyoqXG5cdCAqIFRlbGVtZXRyeSBkYXRhIGFzc29jaWF0ZWQgd2l0aCB0aGlzIENvZGVFZGl0b3JXaWRnZXQuXG5cdCAqIERlZmF1bHRzIHRvIG51bGwuXG5cdCAqL1xuXHR0ZWxlbWV0cnlEYXRhPzogb2JqZWN0O1xuXG5cdC8qKlxuXHQgKiBUaGUgSUQgb2YgdGhlIGNvbnRleHQgbWVudS5cblx0ICogRGVmYXVsdHMgdG8gTWVudUlkLlNpbXBsZUVkaXRvckNvbnRleHQgb3IgTWVudUlkLkVkaXRvckNvbnRleHQgZGVwZW5kaW5nIG9uIHdoZXRoZXIgdGhlIHdpZGdldCBpcyBzaW1wbGUuXG5cdCAqL1xuXHRjb250ZXh0TWVudUlkPzogTWVudUlkO1xuXG5cdC8qKlxuXHQgKiBEZWZpbmUgZXh0cmEgY29udGV4dCBrZXlzIHRoYXQgd2lsbCBiZSBkZWZpbmVkIGluIHRoZSBjb250ZXh0IHNlcnZpY2Vcblx0ICogZm9yIHRoZSBlZGl0b3IuXG5cdCAqL1xuXHRjb250ZXh0S2V5VmFsdWVzPzogUmVjb3JkPHN0cmluZywgQ29udGV4dEtleVZhbHVlPjtcbn1cblxuY2xhc3MgTW9kZWxEYXRhIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IG1vZGVsOiBJVGV4dE1vZGVsLFxuXHRcdHB1YmxpYyByZWFkb25seSB2aWV3TW9kZWw6IFZpZXdNb2RlbCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgdmlldzogVmlldyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgaGFzUmVhbFZpZXc6IGJvb2xlYW4sXG5cdFx0cHVibGljIHJlYWRvbmx5IGxpc3RlbmVyc1RvUmVtb3ZlOiBJRGlzcG9zYWJsZVtdLFxuXHRcdHB1YmxpYyByZWFkb25seSBhdHRhY2hlZFZpZXc6IElBdHRhY2hlZFZpZXcsXG5cdCkge1xuXHR9XG5cblx0cHVibGljIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0ZGlzcG9zZSh0aGlzLmxpc3RlbmVyc1RvUmVtb3ZlKTtcblx0XHR0aGlzLm1vZGVsLm9uQmVmb3JlRGV0YWNoZWQodGhpcy5hdHRhY2hlZFZpZXcpO1xuXHRcdGlmICh0aGlzLmhhc1JlYWxWaWV3KSB7XG5cdFx0XHR0aGlzLnZpZXcuZGlzcG9zZSgpO1xuXHRcdH1cblx0XHR0aGlzLnZpZXdNb2RlbC5kaXNwb3NlKCk7XG5cdH1cbn1cblxuY29uc3QgZW51bSBCb29sZWFuRXZlbnRWYWx1ZSB7XG5cdE5vdFNldCxcblx0RmFsc2UsXG5cdFRydWVcbn1cblxuZXhwb3J0IGNsYXNzIEJvb2xlYW5FdmVudEVtaXR0ZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VUb1RydWU6IEVtaXR0ZXI8dm9pZD47XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZVRvVHJ1ZTogRXZlbnQ8dm9pZD47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VUb0ZhbHNlOiBFbWl0dGVyPHZvaWQ+O1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VUb0ZhbHNlOiBFdmVudDx2b2lkPjtcblxuXHRwcml2YXRlIF92YWx1ZTogQm9vbGVhbkV2ZW50VmFsdWU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZW1pdHRlck9wdGlvbnM6IEVtaXR0ZXJPcHRpb25zXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VUb1RydWUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPih0aGlzLl9lbWl0dGVyT3B0aW9ucykpO1xuXHRcdHRoaXMub25EaWRDaGFuZ2VUb1RydWUgPSB0aGlzLl9vbkRpZENoYW5nZVRvVHJ1ZS5ldmVudDtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVRvRmFsc2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPih0aGlzLl9lbWl0dGVyT3B0aW9ucykpO1xuXHRcdHRoaXMub25EaWRDaGFuZ2VUb0ZhbHNlID0gdGhpcy5fb25EaWRDaGFuZ2VUb0ZhbHNlLmV2ZW50O1xuXHRcdHRoaXMuX3ZhbHVlID0gQm9vbGVhbkV2ZW50VmFsdWUuTm90U2V0O1xuXHR9XG5cblx0cHVibGljIHNldFZhbHVlKF92YWx1ZTogYm9vbGVhbikge1xuXHRcdGNvbnN0IHZhbHVlID0gKF92YWx1ZSA/IEJvb2xlYW5FdmVudFZhbHVlLlRydWUgOiBCb29sZWFuRXZlbnRWYWx1ZS5GYWxzZSk7XG5cdFx0aWYgKHRoaXMuX3ZhbHVlID09PSB2YWx1ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdGlmICh0aGlzLl92YWx1ZSA9PT0gQm9vbGVhbkV2ZW50VmFsdWUuVHJ1ZSkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VUb1RydWUuZmlyZSgpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5fdmFsdWUgPT09IEJvb2xlYW5FdmVudFZhbHVlLkZhbHNlKSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVRvRmFsc2UuZmlyZSgpO1xuXHRcdH1cblx0fVxufVxuXG4vKipcbiAqIEEgcmVndWxhciBldmVudCBlbWl0dGVyIHRoYXQgYWxzbyBtYWtlcyBzdXJlIGNvbnRyaWJ1dGlvbnMgYXJlIGluc3RhbnRpYXRlZCBpZiBuZWNlc3NhcnlcbiAqL1xuY2xhc3MgSW50ZXJhY3Rpb25FbWl0dGVyPFQ+IGV4dGVuZHMgRW1pdHRlcjxUPiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY29udHJpYnV0aW9uczogQ29kZUVkaXRvckNvbnRyaWJ1dGlvbnMsXG5cdFx0ZGVsaXZlcnlRdWV1ZTogRXZlbnREZWxpdmVyeVF1ZXVlXG5cdCkge1xuXHRcdHN1cGVyKHsgZGVsaXZlcnlRdWV1ZSB9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGZpcmUoZXZlbnQ6IFQpOiB2b2lkIHtcblx0XHR0aGlzLl9jb250cmlidXRpb25zLm9uQmVmb3JlSW50ZXJhY3Rpb25FdmVudCgpO1xuXHRcdHN1cGVyLmZpcmUoZXZlbnQpO1xuXHR9XG59XG5cbmNsYXNzIEVkaXRvckNvbnRleHRLZXlzTWFuYWdlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogQ29kZUVkaXRvcldpZGdldDtcblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yU2ltcGxlSW5wdXQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JGb2N1czogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX3RleHRJbnB1dEZvY3VzOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yVGV4dEZvY3VzOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfdGFiTW92ZXNGb2N1czogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclJlYWRvbmx5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfaW5EaWZmRWRpdG9yOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yQ29sdW1uU2VsZWN0aW9uOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfaGFzTXVsdGlwbGVTZWxlY3Rpb25zOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfaGFzTm9uRW1wdHlTZWxlY3Rpb246IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jYW5VbmRvOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfY2FuUmVkbzogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZWRpdG9yOiBDb2RlRWRpdG9yV2lkZ2V0LFxuXHRcdGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX2VkaXRvciA9IGVkaXRvcjtcblxuXHRcdGNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZUtleSgnZWRpdG9ySWQnLCBlZGl0b3IuZ2V0SWQoKSk7XG5cblx0XHR0aGlzLl9lZGl0b3JTaW1wbGVJbnB1dCA9IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclNpbXBsZUlucHV0LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fZWRpdG9yRm9jdXMgPSBFZGl0b3JDb250ZXh0S2V5cy5mb2N1cy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3RleHRJbnB1dEZvY3VzID0gRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9lZGl0b3JUZXh0Rm9jdXMgPSBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl90YWJNb3Zlc0ZvY3VzID0gRWRpdG9yQ29udGV4dEtleXMudGFiTW92ZXNGb2N1cy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2VkaXRvclJlYWRvbmx5ID0gRWRpdG9yQ29udGV4dEtleXMucmVhZE9ubHkuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9pbkRpZmZFZGl0b3IgPSBFZGl0b3JDb250ZXh0S2V5cy5pbkRpZmZFZGl0b3IuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9lZGl0b3JDb2x1bW5TZWxlY3Rpb24gPSBFZGl0b3JDb250ZXh0S2V5cy5jb2x1bW5TZWxlY3Rpb24uYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9oYXNNdWx0aXBsZVNlbGVjdGlvbnMgPSBFZGl0b3JDb250ZXh0S2V5cy5oYXNNdWx0aXBsZVNlbGVjdGlvbnMuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9oYXNOb25FbXB0eVNlbGVjdGlvbiA9IEVkaXRvckNvbnRleHRLZXlzLmhhc05vbkVtcHR5U2VsZWN0aW9uLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fY2FuVW5kbyA9IEVkaXRvckNvbnRleHRLZXlzLmNhblVuZG8uYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9jYW5SZWRvID0gRWRpdG9yQ29udGV4dEtleXMuY2FuUmVkby5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoKSA9PiB0aGlzLl91cGRhdGVGcm9tQ29uZmlnKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JTZWxlY3Rpb24oKCkgPT4gdGhpcy5fdXBkYXRlRnJvbVNlbGVjdGlvbigpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLm9uRGlkRm9jdXNFZGl0b3JXaWRnZXQoKCkgPT4gdGhpcy5fdXBkYXRlRnJvbUZvY3VzKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3Iub25EaWRCbHVyRWRpdG9yV2lkZ2V0KCgpID0+IHRoaXMuX3VwZGF0ZUZyb21Gb2N1cygpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLm9uRGlkRm9jdXNFZGl0b3JUZXh0KCgpID0+IHRoaXMuX3VwZGF0ZUZyb21Gb2N1cygpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLm9uRGlkQmx1ckVkaXRvclRleHQoKCkgPT4gdGhpcy5fdXBkYXRlRnJvbUZvY3VzKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbCgoKSA9PiB0aGlzLl91cGRhdGVGcm9tTW9kZWwoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oKCkgPT4gdGhpcy5fdXBkYXRlRnJvbU1vZGVsKCkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihUYWJGb2N1cy5vbkRpZENoYW5nZVRhYkZvY3VzKCh0YWJGb2N1c01vZGU6IGJvb2xlYW4pID0+IHRoaXMuX3RhYk1vdmVzRm9jdXMuc2V0KHRhYkZvY3VzTW9kZSkpKTtcblxuXHRcdHRoaXMuX3VwZGF0ZUZyb21Db25maWcoKTtcblx0XHR0aGlzLl91cGRhdGVGcm9tU2VsZWN0aW9uKCk7XG5cdFx0dGhpcy5fdXBkYXRlRnJvbUZvY3VzKCk7XG5cdFx0dGhpcy5fdXBkYXRlRnJvbU1vZGVsKCk7XG5cblx0XHR0aGlzLl9lZGl0b3JTaW1wbGVJbnB1dC5zZXQodGhpcy5fZWRpdG9yLmlzU2ltcGxlV2lkZ2V0KTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUZyb21Db25maWcoKTogdm9pZCB7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb25zKCk7XG5cblx0XHR0aGlzLl90YWJNb3Zlc0ZvY3VzLnNldChUYWJGb2N1cy5nZXRUYWJGb2N1c01vZGUoKSk7XG5cdFx0dGhpcy5fZWRpdG9yUmVhZG9ubHkuc2V0KG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5yZWFkT25seSkpO1xuXHRcdHRoaXMuX2luRGlmZkVkaXRvci5zZXQob3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmluRGlmZkVkaXRvcikpO1xuXHRcdHRoaXMuX2VkaXRvckNvbHVtblNlbGVjdGlvbi5zZXQob3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmNvbHVtblNlbGVjdGlvbikpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlRnJvbVNlbGVjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCBzZWxlY3Rpb25zID0gdGhpcy5fZWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRpZiAoIXNlbGVjdGlvbnMpIHtcblx0XHRcdHRoaXMuX2hhc011bHRpcGxlU2VsZWN0aW9ucy5yZXNldCgpO1xuXHRcdFx0dGhpcy5faGFzTm9uRW1wdHlTZWxlY3Rpb24ucmVzZXQoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5faGFzTXVsdGlwbGVTZWxlY3Rpb25zLnNldChzZWxlY3Rpb25zLmxlbmd0aCA+IDEpO1xuXHRcdFx0dGhpcy5faGFzTm9uRW1wdHlTZWxlY3Rpb24uc2V0KHNlbGVjdGlvbnMuc29tZShzID0+ICFzLmlzRW1wdHkoKSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUZyb21Gb2N1cygpOiB2b2lkIHtcblx0XHR0aGlzLl9lZGl0b3JGb2N1cy5zZXQodGhpcy5fZWRpdG9yLmhhc1dpZGdldEZvY3VzKCkgJiYgIXRoaXMuX2VkaXRvci5pc1NpbXBsZVdpZGdldCk7XG5cdFx0dGhpcy5fZWRpdG9yVGV4dEZvY3VzLnNldCh0aGlzLl9lZGl0b3IuaGFzVGV4dEZvY3VzKCkgJiYgIXRoaXMuX2VkaXRvci5pc1NpbXBsZVdpZGdldCk7XG5cdFx0dGhpcy5fdGV4dElucHV0Rm9jdXMuc2V0KHRoaXMuX2VkaXRvci5oYXNUZXh0Rm9jdXMoKSk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVGcm9tTW9kZWwoKTogdm9pZCB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHR0aGlzLl9jYW5VbmRvLnNldChCb29sZWFuKG1vZGVsICYmIG1vZGVsLmNhblVuZG8oKSkpO1xuXHRcdHRoaXMuX2NhblJlZG8uc2V0KEJvb2xlYW4obW9kZWwgJiYgbW9kZWwuY2FuUmVkbygpKSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEVkaXRvck1vZGVDb250ZXh0IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbGFuZ0lkOiBJQ29udGV4dEtleTxzdHJpbmc+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9oYXNDb21wbGV0aW9uSXRlbVByb3ZpZGVyOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfaGFzQ29kZUFjdGlvbnNQcm92aWRlcjogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2hhc0NvZGVMZW5zUHJvdmlkZXI6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9oYXNEZWZpbml0aW9uUHJvdmlkZXI6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9oYXNEZWNsYXJhdGlvblByb3ZpZGVyOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfaGFzSW1wbGVtZW50YXRpb25Qcm92aWRlcjogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2hhc1R5cGVEZWZpbml0aW9uUHJvdmlkZXI6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9oYXNIb3ZlclByb3ZpZGVyOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfaGFzRG9jdW1lbnRIaWdobGlnaHRQcm92aWRlcjogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2hhc0RvY3VtZW50U3ltYm9sUHJvdmlkZXI6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9oYXNSZWZlcmVuY2VQcm92aWRlcjogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2hhc1JlbmFtZVByb3ZpZGVyOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfaGFzRG9jdW1lbnRGb3JtYXR0aW5nUHJvdmlkZXI6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9oYXNEb2N1bWVudFNlbGVjdGlvbkZvcm1hdHRpbmdQcm92aWRlcjogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2hhc011bHRpcGxlRG9jdW1lbnRGb3JtYXR0aW5nUHJvdmlkZXI6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9oYXNNdWx0aXBsZURvY3VtZW50U2VsZWN0aW9uRm9ybWF0dGluZ1Byb3ZpZGVyOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfaGFzU2lnbmF0dXJlSGVscFByb3ZpZGVyOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfaGFzSW5sYXlIaW50c1Byb3ZpZGVyOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfaXNJbkVtYmVkZGVkRWRpdG9yOiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IENvZGVFZGl0b3JXaWRnZXQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fbGFuZ0lkID0gRWRpdG9yQ29udGV4dEtleXMubGFuZ3VhZ2VJZC5iaW5kVG8oX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9oYXNDb21wbGV0aW9uSXRlbVByb3ZpZGVyID0gRWRpdG9yQ29udGV4dEtleXMuaGFzQ29tcGxldGlvbkl0ZW1Qcm92aWRlci5iaW5kVG8oX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9oYXNDb2RlQWN0aW9uc1Byb3ZpZGVyID0gRWRpdG9yQ29udGV4dEtleXMuaGFzQ29kZUFjdGlvbnNQcm92aWRlci5iaW5kVG8oX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9oYXNDb2RlTGVuc1Byb3ZpZGVyID0gRWRpdG9yQ29udGV4dEtleXMuaGFzQ29kZUxlbnNQcm92aWRlci5iaW5kVG8oX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9oYXNEZWZpbml0aW9uUHJvdmlkZXIgPSBFZGl0b3JDb250ZXh0S2V5cy5oYXNEZWZpbml0aW9uUHJvdmlkZXIuYmluZFRvKF9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5faGFzRGVjbGFyYXRpb25Qcm92aWRlciA9IEVkaXRvckNvbnRleHRLZXlzLmhhc0RlY2xhcmF0aW9uUHJvdmlkZXIuYmluZFRvKF9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5faGFzSW1wbGVtZW50YXRpb25Qcm92aWRlciA9IEVkaXRvckNvbnRleHRLZXlzLmhhc0ltcGxlbWVudGF0aW9uUHJvdmlkZXIuYmluZFRvKF9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5faGFzVHlwZURlZmluaXRpb25Qcm92aWRlciA9IEVkaXRvckNvbnRleHRLZXlzLmhhc1R5cGVEZWZpbml0aW9uUHJvdmlkZXIuYmluZFRvKF9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5faGFzSG92ZXJQcm92aWRlciA9IEVkaXRvckNvbnRleHRLZXlzLmhhc0hvdmVyUHJvdmlkZXIuYmluZFRvKF9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5faGFzRG9jdW1lbnRIaWdobGlnaHRQcm92aWRlciA9IEVkaXRvckNvbnRleHRLZXlzLmhhc0RvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIuYmluZFRvKF9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5faGFzRG9jdW1lbnRTeW1ib2xQcm92aWRlciA9IEVkaXRvckNvbnRleHRLZXlzLmhhc0RvY3VtZW50U3ltYm9sUHJvdmlkZXIuYmluZFRvKF9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5faGFzUmVmZXJlbmNlUHJvdmlkZXIgPSBFZGl0b3JDb250ZXh0S2V5cy5oYXNSZWZlcmVuY2VQcm92aWRlci5iaW5kVG8oX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9oYXNSZW5hbWVQcm92aWRlciA9IEVkaXRvckNvbnRleHRLZXlzLmhhc1JlbmFtZVByb3ZpZGVyLmJpbmRUbyhfY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2hhc1NpZ25hdHVyZUhlbHBQcm92aWRlciA9IEVkaXRvckNvbnRleHRLZXlzLmhhc1NpZ25hdHVyZUhlbHBQcm92aWRlci5iaW5kVG8oX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9oYXNJbmxheUhpbnRzUHJvdmlkZXIgPSBFZGl0b3JDb250ZXh0S2V5cy5oYXNJbmxheUhpbnRzUHJvdmlkZXIuYmluZFRvKF9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5faGFzRG9jdW1lbnRGb3JtYXR0aW5nUHJvdmlkZXIgPSBFZGl0b3JDb250ZXh0S2V5cy5oYXNEb2N1bWVudEZvcm1hdHRpbmdQcm92aWRlci5iaW5kVG8oX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9oYXNEb2N1bWVudFNlbGVjdGlvbkZvcm1hdHRpbmdQcm92aWRlciA9IEVkaXRvckNvbnRleHRLZXlzLmhhc0RvY3VtZW50U2VsZWN0aW9uRm9ybWF0dGluZ1Byb3ZpZGVyLmJpbmRUbyhfY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2hhc011bHRpcGxlRG9jdW1lbnRGb3JtYXR0aW5nUHJvdmlkZXIgPSBFZGl0b3JDb250ZXh0S2V5cy5oYXNNdWx0aXBsZURvY3VtZW50Rm9ybWF0dGluZ1Byb3ZpZGVyLmJpbmRUbyhfY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2hhc011bHRpcGxlRG9jdW1lbnRTZWxlY3Rpb25Gb3JtYXR0aW5nUHJvdmlkZXIgPSBFZGl0b3JDb250ZXh0S2V5cy5oYXNNdWx0aXBsZURvY3VtZW50U2VsZWN0aW9uRm9ybWF0dGluZ1Byb3ZpZGVyLmJpbmRUbyhfY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2lzSW5FbWJlZGRlZEVkaXRvciA9IEVkaXRvckNvbnRleHRLZXlzLmlzSW5FbWJlZGRlZEVkaXRvci5iaW5kVG8oX2NvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHVwZGF0ZSA9ICgpID0+IHRoaXMuX3VwZGF0ZSgpO1xuXG5cdFx0Ly8gdXBkYXRlIHdoZW4gbW9kZWwvbW9kZSBjaGFuZ2VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIoX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsKHVwZGF0ZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKF9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbExhbmd1YWdlKHVwZGF0ZSkpO1xuXG5cdFx0Ly8gdXBkYXRlIHdoZW4gcmVnaXN0cmllcyBjaGFuZ2Vcblx0XHR0aGlzLl9yZWdpc3RlcihfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLm9uRGlkQ2hhbmdlKHVwZGF0ZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKF9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb2RlQWN0aW9uUHJvdmlkZXIub25EaWRDaGFuZ2UodXBkYXRlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvZGVMZW5zUHJvdmlkZXIub25EaWRDaGFuZ2UodXBkYXRlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRlZmluaXRpb25Qcm92aWRlci5vbkRpZENoYW5nZSh1cGRhdGUpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZGVjbGFyYXRpb25Qcm92aWRlci5vbkRpZENoYW5nZSh1cGRhdGUpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuaW1wbGVtZW50YXRpb25Qcm92aWRlci5vbkRpZENoYW5nZSh1cGRhdGUpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UudHlwZURlZmluaXRpb25Qcm92aWRlci5vbkRpZENoYW5nZSh1cGRhdGUpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuaG92ZXJQcm92aWRlci5vbkRpZENoYW5nZSh1cGRhdGUpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRIaWdobGlnaHRQcm92aWRlci5vbkRpZENoYW5nZSh1cGRhdGUpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRTeW1ib2xQcm92aWRlci5vbkRpZENoYW5nZSh1cGRhdGUpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UucmVmZXJlbmNlUHJvdmlkZXIub25EaWRDaGFuZ2UodXBkYXRlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLnJlbmFtZVByb3ZpZGVyLm9uRGlkQ2hhbmdlKHVwZGF0ZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKF9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudEZvcm1hdHRpbmdFZGl0UHJvdmlkZXIub25EaWRDaGFuZ2UodXBkYXRlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdFByb3ZpZGVyLm9uRGlkQ2hhbmdlKHVwZGF0ZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKF9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5zaWduYXR1cmVIZWxwUHJvdmlkZXIub25EaWRDaGFuZ2UodXBkYXRlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmlubGF5SGludHNQcm92aWRlci5vbkRpZENoYW5nZSh1cGRhdGUpKTtcblxuXHRcdHVwZGF0ZSgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRyZXNldCgpIHtcblx0XHR0aGlzLl9jb250ZXh0S2V5U2VydmljZS5idWZmZXJDaGFuZ2VFdmVudHMoKCkgPT4ge1xuXHRcdFx0dGhpcy5fbGFuZ0lkLnJlc2V0KCk7XG5cdFx0XHR0aGlzLl9oYXNDb21wbGV0aW9uSXRlbVByb3ZpZGVyLnJlc2V0KCk7XG5cdFx0XHR0aGlzLl9oYXNDb2RlQWN0aW9uc1Byb3ZpZGVyLnJlc2V0KCk7XG5cdFx0XHR0aGlzLl9oYXNDb2RlTGVuc1Byb3ZpZGVyLnJlc2V0KCk7XG5cdFx0XHR0aGlzLl9oYXNEZWZpbml0aW9uUHJvdmlkZXIucmVzZXQoKTtcblx0XHRcdHRoaXMuX2hhc0RlY2xhcmF0aW9uUHJvdmlkZXIucmVzZXQoKTtcblx0XHRcdHRoaXMuX2hhc0ltcGxlbWVudGF0aW9uUHJvdmlkZXIucmVzZXQoKTtcblx0XHRcdHRoaXMuX2hhc1R5cGVEZWZpbml0aW9uUHJvdmlkZXIucmVzZXQoKTtcblx0XHRcdHRoaXMuX2hhc0hvdmVyUHJvdmlkZXIucmVzZXQoKTtcblx0XHRcdHRoaXMuX2hhc0RvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIucmVzZXQoKTtcblx0XHRcdHRoaXMuX2hhc0RvY3VtZW50U3ltYm9sUHJvdmlkZXIucmVzZXQoKTtcblx0XHRcdHRoaXMuX2hhc1JlZmVyZW5jZVByb3ZpZGVyLnJlc2V0KCk7XG5cdFx0XHR0aGlzLl9oYXNSZW5hbWVQcm92aWRlci5yZXNldCgpO1xuXHRcdFx0dGhpcy5faGFzRG9jdW1lbnRGb3JtYXR0aW5nUHJvdmlkZXIucmVzZXQoKTtcblx0XHRcdHRoaXMuX2hhc0RvY3VtZW50U2VsZWN0aW9uRm9ybWF0dGluZ1Byb3ZpZGVyLnJlc2V0KCk7XG5cdFx0XHR0aGlzLl9oYXNTaWduYXR1cmVIZWxwUHJvdmlkZXIucmVzZXQoKTtcblx0XHRcdHRoaXMuX2lzSW5FbWJlZGRlZEVkaXRvci5yZXNldCgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlKCkge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0dGhpcy5yZXNldCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9jb250ZXh0S2V5U2VydmljZS5idWZmZXJDaGFuZ2VFdmVudHMoKCkgPT4ge1xuXHRcdFx0dGhpcy5fbGFuZ0lkLnNldChtb2RlbC5nZXRMYW5ndWFnZUlkKCkpO1xuXHRcdFx0dGhpcy5faGFzQ29tcGxldGlvbkl0ZW1Qcm92aWRlci5zZXQodGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLmhhcyhtb2RlbCkpO1xuXHRcdFx0dGhpcy5faGFzQ29kZUFjdGlvbnNQcm92aWRlci5zZXQodGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29kZUFjdGlvblByb3ZpZGVyLmhhcyhtb2RlbCkpO1xuXHRcdFx0dGhpcy5faGFzQ29kZUxlbnNQcm92aWRlci5zZXQodGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29kZUxlbnNQcm92aWRlci5oYXMobW9kZWwpKTtcblx0XHRcdHRoaXMuX2hhc0RlZmluaXRpb25Qcm92aWRlci5zZXQodGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZGVmaW5pdGlvblByb3ZpZGVyLmhhcyhtb2RlbCkpO1xuXHRcdFx0dGhpcy5faGFzRGVjbGFyYXRpb25Qcm92aWRlci5zZXQodGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZGVjbGFyYXRpb25Qcm92aWRlci5oYXMobW9kZWwpKTtcblx0XHRcdHRoaXMuX2hhc0ltcGxlbWVudGF0aW9uUHJvdmlkZXIuc2V0KHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmltcGxlbWVudGF0aW9uUHJvdmlkZXIuaGFzKG1vZGVsKSk7XG5cdFx0XHR0aGlzLl9oYXNUeXBlRGVmaW5pdGlvblByb3ZpZGVyLnNldCh0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS50eXBlRGVmaW5pdGlvblByb3ZpZGVyLmhhcyhtb2RlbCkpO1xuXHRcdFx0dGhpcy5faGFzSG92ZXJQcm92aWRlci5zZXQodGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuaG92ZXJQcm92aWRlci5oYXMobW9kZWwpKTtcblx0XHRcdHRoaXMuX2hhc0RvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIuc2V0KHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIuaGFzKG1vZGVsKSk7XG5cdFx0XHR0aGlzLl9oYXNEb2N1bWVudFN5bWJvbFByb3ZpZGVyLnNldCh0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFN5bWJvbFByb3ZpZGVyLmhhcyhtb2RlbCkpO1xuXHRcdFx0dGhpcy5faGFzUmVmZXJlbmNlUHJvdmlkZXIuc2V0KHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLnJlZmVyZW5jZVByb3ZpZGVyLmhhcyhtb2RlbCkpO1xuXHRcdFx0dGhpcy5faGFzUmVuYW1lUHJvdmlkZXIuc2V0KHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLnJlbmFtZVByb3ZpZGVyLmhhcyhtb2RlbCkpO1xuXHRcdFx0dGhpcy5faGFzU2lnbmF0dXJlSGVscFByb3ZpZGVyLnNldCh0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5zaWduYXR1cmVIZWxwUHJvdmlkZXIuaGFzKG1vZGVsKSk7XG5cdFx0XHR0aGlzLl9oYXNJbmxheUhpbnRzUHJvdmlkZXIuc2V0KHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmlubGF5SGludHNQcm92aWRlci5oYXMobW9kZWwpKTtcblx0XHRcdHRoaXMuX2hhc0RvY3VtZW50Rm9ybWF0dGluZ1Byb3ZpZGVyLnNldCh0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudEZvcm1hdHRpbmdFZGl0UHJvdmlkZXIuaGFzKG1vZGVsKSB8fCB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFJhbmdlRm9ybWF0dGluZ0VkaXRQcm92aWRlci5oYXMobW9kZWwpKTtcblx0XHRcdHRoaXMuX2hhc0RvY3VtZW50U2VsZWN0aW9uRm9ybWF0dGluZ1Byb3ZpZGVyLnNldCh0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFJhbmdlRm9ybWF0dGluZ0VkaXRQcm92aWRlci5oYXMobW9kZWwpKTtcblx0XHRcdHRoaXMuX2hhc011bHRpcGxlRG9jdW1lbnRGb3JtYXR0aW5nUHJvdmlkZXIuc2V0KHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50Rm9ybWF0dGluZ0VkaXRQcm92aWRlci5hbGwobW9kZWwpLmxlbmd0aCArIHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdFByb3ZpZGVyLmFsbChtb2RlbCkubGVuZ3RoID4gMSk7XG5cdFx0XHR0aGlzLl9oYXNNdWx0aXBsZURvY3VtZW50U2VsZWN0aW9uRm9ybWF0dGluZ1Byb3ZpZGVyLnNldCh0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFJhbmdlRm9ybWF0dGluZ0VkaXRQcm92aWRlci5hbGwobW9kZWwpLmxlbmd0aCA+IDEpO1xuXHRcdFx0dGhpcy5faXNJbkVtYmVkZGVkRWRpdG9yLnNldChtb2RlbC51cmkuc2NoZW1lID09PSBTY2hlbWFzLndhbGtUaHJvdWdoU25pcHBldCB8fCBtb2RlbC51cmkuc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZUNoYXRDb2RlQmxvY2spO1xuXHRcdH0pO1xuXHR9XG59XG5cblxuY2xhc3MgRWRpdG9yRGVjb3JhdGlvbnNDb2xsZWN0aW9uIGltcGxlbWVudHMgZWRpdG9yQ29tbW9uLklFZGl0b3JEZWNvcmF0aW9uc0NvbGxlY3Rpb24ge1xuXG5cdHByaXZhdGUgX2RlY29yYXRpb25JZHM6IHN0cmluZ1tdID0gW107XG5cdHByaXZhdGUgX2lzQ2hhbmdpbmdEZWNvcmF0aW9uczogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdHB1YmxpYyBnZXQgbGVuZ3RoKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2RlY29yYXRpb25JZHMubGVuZ3RoO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBlZGl0b3JCcm93c2VyLklDb2RlRWRpdG9yLFxuXHRcdGRlY29yYXRpb25zOiBJTW9kZWxEZWx0YURlY29yYXRpb25bXSB8IHVuZGVmaW5lZFxuXHQpIHtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShkZWNvcmF0aW9ucykgJiYgZGVjb3JhdGlvbnMubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5zZXQoZGVjb3JhdGlvbnMpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBvbkRpZENoYW5nZShsaXN0ZW5lcjogKGU6IElNb2RlbERlY29yYXRpb25zQ2hhbmdlZEV2ZW50KSA9PiBhbnksIHRoaXNBcmdzPzogYW55LCBkaXNwb3NhYmxlcz86IElEaXNwb3NhYmxlW10gfCBEaXNwb3NhYmxlU3RvcmUpOiBJRGlzcG9zYWJsZSB7XG5cdFx0cmV0dXJuIHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsRGVjb3JhdGlvbnMoKGUpID0+IHtcblx0XHRcdGlmICh0aGlzLl9pc0NoYW5naW5nRGVjb3JhdGlvbnMpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bGlzdGVuZXIuY2FsbCh0aGlzQXJncywgZSk7XG5cdFx0fSwgZGlzcG9zYWJsZXMpO1xuXHR9XG5cblx0cHVibGljIGdldFJhbmdlKGluZGV4OiBudW1iZXIpOiBSYW5nZSB8IG51bGwge1xuXHRcdGlmICghdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRpZiAoaW5kZXggPj0gdGhpcy5fZGVjb3JhdGlvbklkcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCkuZ2V0RGVjb3JhdGlvblJhbmdlKHRoaXMuX2RlY29yYXRpb25JZHNbaW5kZXhdKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRSYW5nZXMoKTogUmFuZ2VbXSB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IHJlc3VsdDogUmFuZ2VbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbklkIG9mIHRoaXMuX2RlY29yYXRpb25JZHMpIHtcblx0XHRcdGNvbnN0IHJhbmdlID0gbW9kZWwuZ2V0RGVjb3JhdGlvblJhbmdlKGRlY29yYXRpb25JZCk7XG5cdFx0XHRpZiAocmFuZ2UpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2gocmFuZ2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGhhcyhkZWNvcmF0aW9uOiBJTW9kZWxEZWNvcmF0aW9uKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2RlY29yYXRpb25JZHMuaW5jbHVkZXMoZGVjb3JhdGlvbi5pZCk7XG5cdH1cblxuXHRwdWJsaWMgY2xlYXIoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2RlY29yYXRpb25JZHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHQvLyBub3RoaW5nIHRvIGRvXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuc2V0KFtdKTtcblx0fVxuXG5cdHB1YmxpYyBzZXQobmV3RGVjb3JhdGlvbnM6IHJlYWRvbmx5IElNb2RlbERlbHRhRGVjb3JhdGlvbltdKTogc3RyaW5nW10ge1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9pc0NoYW5naW5nRGVjb3JhdGlvbnMgPSB0cnVlO1xuXHRcdFx0dGhpcy5fZWRpdG9yLmNoYW5nZURlY29yYXRpb25zKChhY2Nlc3NvcikgPT4ge1xuXHRcdFx0XHR0aGlzLl9kZWNvcmF0aW9uSWRzID0gYWNjZXNzb3IuZGVsdGFEZWNvcmF0aW9ucyh0aGlzLl9kZWNvcmF0aW9uSWRzLCBuZXdEZWNvcmF0aW9ucyk7XG5cdFx0XHR9KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5faXNDaGFuZ2luZ0RlY29yYXRpb25zID0gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9kZWNvcmF0aW9uSWRzO1xuXHR9XG5cblx0cHVibGljIGFwcGVuZChuZXdEZWNvcmF0aW9uczogcmVhZG9ubHkgSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10pOiBzdHJpbmdbXSB7XG5cdFx0bGV0IG5ld0RlY29yYXRpb25JZHM6IHN0cmluZ1tdID0gW107XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuX2lzQ2hhbmdpbmdEZWNvcmF0aW9ucyA9IHRydWU7XG5cdFx0XHR0aGlzLl9lZGl0b3IuY2hhbmdlRGVjb3JhdGlvbnMoKGFjY2Vzc29yKSA9PiB7XG5cdFx0XHRcdG5ld0RlY29yYXRpb25JZHMgPSBhY2Nlc3Nvci5kZWx0YURlY29yYXRpb25zKFtdLCBuZXdEZWNvcmF0aW9ucyk7XG5cdFx0XHRcdHRoaXMuX2RlY29yYXRpb25JZHMgPSB0aGlzLl9kZWNvcmF0aW9uSWRzLmNvbmNhdChuZXdEZWNvcmF0aW9uSWRzKTtcblx0XHRcdH0pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLl9pc0NoYW5naW5nRGVjb3JhdGlvbnMgPSBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIG5ld0RlY29yYXRpb25JZHM7XG5cdH1cbn1cblxuY29uc3Qgc3F1aWdnbHlTdGFydCA9IGVuY29kZVVSSUNvbXBvbmVudChgPHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA2IDMnIGVuYWJsZS1iYWNrZ3JvdW5kPSduZXcgMCAwIDYgMycgaGVpZ2h0PSczJyB3aWR0aD0nNic+PGcgZmlsbD0nYCk7XG5jb25zdCBzcXVpZ2dseUVuZCA9IGVuY29kZVVSSUNvbXBvbmVudChgJz48cG9seWdvbiBwb2ludHM9JzUuNSwwIDIuNSwzIDEuMSwzIDQuMSwwJy8+PHBvbHlnb24gcG9pbnRzPSc0LDAgNiwyIDYsMC42IDUuNCwwJy8+PHBvbHlnb24gcG9pbnRzPScwLDIgMSwzIDIuNCwzIDAsMC42Jy8+PC9nPjwvc3ZnPmApO1xuXG5mdW5jdGlvbiBnZXRTcXVpZ2dseVNWR0RhdGEoY29sb3I6IENvbG9yKSB7XG5cdHJldHVybiBzcXVpZ2dseVN0YXJ0ICsgZW5jb2RlVVJJQ29tcG9uZW50KGNvbG9yLnRvU3RyaW5nKCkpICsgc3F1aWdnbHlFbmQ7XG59XG5cbmNvbnN0IGRvdGRvdGRvdFN0YXJ0ID0gZW5jb2RlVVJJQ29tcG9uZW50KGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBoZWlnaHQ9XCIzXCIgd2lkdGg9XCIxMlwiPjxnIGZpbGw9XCJgKTtcbmNvbnN0IGRvdGRvdGRvdEVuZCA9IGVuY29kZVVSSUNvbXBvbmVudChgXCI+PGNpcmNsZSBjeD1cIjFcIiBjeT1cIjFcIiByPVwiMVwiLz48Y2lyY2xlIGN4PVwiNVwiIGN5PVwiMVwiIHI9XCIxXCIvPjxjaXJjbGUgY3g9XCI5XCIgY3k9XCIxXCIgcj1cIjFcIi8+PC9nPjwvc3ZnPmApO1xuXG5mdW5jdGlvbiBnZXREb3REb3REb3RTVkdEYXRhKGNvbG9yOiBDb2xvcikge1xuXHRyZXR1cm4gZG90ZG90ZG90U3RhcnQgKyBlbmNvZGVVUklDb21wb25lbnQoY29sb3IudG9TdHJpbmcoKSkgKyBkb3Rkb3Rkb3RFbmQ7XG59XG5cbnJlZ2lzdGVyVGhlbWluZ1BhcnRpY2lwYW50KCh0aGVtZSwgY29sbGVjdG9yKSA9PiB7XG5cdGNvbnN0IGVycm9yRm9yZWdyb3VuZCA9IHRoZW1lLmdldENvbG9yKGVkaXRvckVycm9yRm9yZWdyb3VuZCk7XG5cdGlmIChlcnJvckZvcmVncm91bmQpIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby1lZGl0b3IgLiR7Q2xhc3NOYW1lLkVkaXRvckVycm9yRGVjb3JhdGlvbn0geyBiYWNrZ3JvdW5kOiB1cmwoXCJkYXRhOmltYWdlL3N2Zyt4bWwsJHtnZXRTcXVpZ2dseVNWR0RhdGEoZXJyb3JGb3JlZ3JvdW5kKX1cIikgcmVwZWF0LXggYm90dG9tIGxlZnQ7IH1gKTtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgOnJvb3QgeyAtLW1vbmFjby1lZGl0b3ItZXJyb3ItZGVjb3JhdGlvbjogdXJsKFwiZGF0YTppbWFnZS9zdmcreG1sLCR7Z2V0U3F1aWdnbHlTVkdEYXRhKGVycm9yRm9yZWdyb3VuZCl9XCIpOyB9YCk7XG5cdH1cblx0Y29uc3Qgd2FybmluZ0ZvcmVncm91bmQgPSB0aGVtZS5nZXRDb2xvcihlZGl0b3JXYXJuaW5nRm9yZWdyb3VuZCk7XG5cdGlmICh3YXJuaW5nRm9yZWdyb3VuZCkge1xuXHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAubW9uYWNvLWVkaXRvciAuJHtDbGFzc05hbWUuRWRpdG9yV2FybmluZ0RlY29yYXRpb259IHsgYmFja2dyb3VuZDogdXJsKFwiZGF0YTppbWFnZS9zdmcreG1sLCR7Z2V0U3F1aWdnbHlTVkdEYXRhKHdhcm5pbmdGb3JlZ3JvdW5kKX1cIikgcmVwZWF0LXggYm90dG9tIGxlZnQ7IH1gKTtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgOnJvb3QgeyAtLW1vbmFjby1lZGl0b3Itd2FybmluZy1kZWNvcmF0aW9uOiB1cmwoXCJkYXRhOmltYWdlL3N2Zyt4bWwsJHtnZXRTcXVpZ2dseVNWR0RhdGEod2FybmluZ0ZvcmVncm91bmQpfVwiKTsgfWApO1xuXHR9XG5cdGNvbnN0IGluZm9Gb3JlZ3JvdW5kID0gdGhlbWUuZ2V0Q29sb3IoZWRpdG9ySW5mb0ZvcmVncm91bmQpO1xuXHRpZiAoaW5mb0ZvcmVncm91bmQpIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby1lZGl0b3IgLiR7Q2xhc3NOYW1lLkVkaXRvckluZm9EZWNvcmF0aW9ufSB7IGJhY2tncm91bmQ6IHVybChcImRhdGE6aW1hZ2Uvc3ZnK3htbCwke2dldFNxdWlnZ2x5U1ZHRGF0YShpbmZvRm9yZWdyb3VuZCl9XCIpIHJlcGVhdC14IGJvdHRvbSBsZWZ0OyB9YCk7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYDpyb290IHsgLS1tb25hY28tZWRpdG9yLWluZm8tZGVjb3JhdGlvbjogdXJsKFwiZGF0YTppbWFnZS9zdmcreG1sLCR7Z2V0U3F1aWdnbHlTVkdEYXRhKGluZm9Gb3JlZ3JvdW5kKX1cIik7IH1gKTtcblx0fVxuXHRjb25zdCBoaW50Rm9yZWdyb3VuZCA9IHRoZW1lLmdldENvbG9yKGVkaXRvckhpbnRGb3JlZ3JvdW5kKTtcblx0aWYgKGhpbnRGb3JlZ3JvdW5kKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYC5tb25hY28tZWRpdG9yIC4ke0NsYXNzTmFtZS5FZGl0b3JIaW50RGVjb3JhdGlvbn0geyBiYWNrZ3JvdW5kOiB1cmwoXCJkYXRhOmltYWdlL3N2Zyt4bWwsJHtnZXREb3REb3REb3RTVkdEYXRhKGhpbnRGb3JlZ3JvdW5kKX1cIikgbm8tcmVwZWF0IGJvdHRvbSBsZWZ0OyB9YCk7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYDpyb290IHsgLS1tb25hY28tZWRpdG9yLWhpbnQtZGVjb3JhdGlvbjogdXJsKFwiZGF0YTppbWFnZS9zdmcreG1sLCR7Z2V0RG90RG90RG90U1ZHRGF0YShoaW50Rm9yZWdyb3VuZCl9XCIpOyB9YCk7XG5cdH1cblx0Y29uc3QgdW5uZWNlc3NhcnlGb3JlZ3JvdW5kID0gdGhlbWUuZ2V0Q29sb3IoZWRpdG9yVW5uZWNlc3NhcnlDb2RlT3BhY2l0eSk7XG5cdGlmICh1bm5lY2Vzc2FyeUZvcmVncm91bmQpIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby1lZGl0b3Iuc2hvd1VudXNlZCAuJHtDbGFzc05hbWUuRWRpdG9yVW5uZWNlc3NhcnlJbmxpbmVEZWNvcmF0aW9ufSB7IG9wYWNpdHk6ICR7dW5uZWNlc3NhcnlGb3JlZ3JvdW5kLnJnYmEuYX07IH1gKTtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgOnJvb3QgeyAtLW1vbmFjby1lZGl0b3ItdW5uZWNlc3NhcnktZGVjb3JhdGlvbi1vcGFjaXR5OiAke3VubmVjZXNzYXJ5Rm9yZWdyb3VuZC5yZ2JhLmF9OyB9YCk7XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsWUFBWSxTQUFTO0FBSXJCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsU0FBb0QsZ0NBQWdDO0FBQzdGLFNBQVMsWUFBWTtBQUNyQixTQUFTLFlBQTBDLGVBQWU7QUFDbEUsU0FBUyxlQUFlO0FBQ3hCLE9BQU87QUFDUCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDJCQUF1RDtBQUNoRSxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLGdDQUFnRTtBQUN6RSxTQUFTLDBCQUEwQjtBQUNuQyxTQUF5RSxZQUFZO0FBQ3JGLFNBQVMsb0NBQW9DO0FBRTdDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsK0JBQStCO0FBRXhDLFNBQXNELGNBQXlGLG1DQUFtQztBQUNsTCxTQUFTLHFCQUFxQjtBQUU5QixTQUFTLG9DQUFvQztBQUM3QyxTQUFvQixnQkFBZ0I7QUFDcEMsU0FBaUIsYUFBYTtBQUM5QixTQUFxQixpQkFBaUI7QUFFdEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUywwQkFBcUY7QUFDOUYsU0FBUyw0QkFBNEI7QUFDckMsWUFBWSxrQkFBa0I7QUFDOUIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUywyQkFBK007QUFDeE4sU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxnQ0FBZ0M7QUFFekMsU0FBUyww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QjtBQUMzSyxjQUFVLFFBQVEsb0VBQW9FLG1CQUFtQixjQUFjLENBQUMsT0FBTztBQUFBLEVBQ2hJO0FBQ0EsUUFBTSxpQkFBaUIsTUFBTSxTQUFTLG9CQUFvQjtBQUMxRCxNQUFJLGdCQUFnQjtBQUNuQixjQUFVLFFBQVEsbUJBQW1CLFVBQVUsb0JBQW9CLDBDQUEwQyxvQkFBb0IsY0FBYyxDQUFDLDZCQUE2QjtBQUM3SyxjQUFVLFFBQVEsb0VBQW9FLG9CQUFvQixjQUFjLENBQUMsT0FBTztBQUFBLEVBQ2pJO0FBQ0EsUUFBTSx3QkFBd0IsTUFBTSxTQUFTLDRCQUE0QjtBQUN6RSxNQUFJLHVCQUF1QjtBQUMxQixjQUFVLFFBQVEsOEJBQThCLFVBQVUsaUNBQWlDLGVBQWUsc0JBQXNCLEtBQUssQ0FBQyxLQUFLO0FBQzNJLGNBQVUsUUFBUSwyREFBMkQsc0JBQXNCLEtBQUssQ0FBQyxLQUFLO0FBQUEsRUFDL0c7QUFDRCxDQUFDOyIsCiAgIm5hbWVzIjogWyJvcHRpb25zIiwgIkJvb2xlYW5FdmVudFZhbHVlIl0KfQo=
