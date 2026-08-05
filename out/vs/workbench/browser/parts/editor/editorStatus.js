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
import "./media/editorstatus.css";
import { localize, localize2 } from "../../../../nls.js";
import { getWindowById, runAtThisOrScheduleAtNextAnimationFrame } from "../../../../base/browser/dom.js";
import { format, compare, splitLines } from "../../../../base/common/strings.js";
import { extname, basename, isEqual } from "../../../../base/common/resources.js";
import { areFunctions, assertIsDefined } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { Action } from "../../../../base/common/actions.js";
import { Language } from "../../../../base/common/platform.js";
import { UntitledTextEditorInput } from "../../../services/untitled/common/untitledTextEditorInput.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../common/editor.js";
import { Disposable, MutableDisposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { EndOfLineSequence } from "../../../../editor/common/model.js";
import { TrimTrailingWhitespaceAction } from "../../../../editor/contrib/linesOperations/browser/linesOperations.js";
import { IndentUsingSpaces, IndentUsingTabs, ChangeTabDisplaySize, DetectIndentation, IndentationToSpacesAction, IndentationToTabsAction } from "../../../../editor/contrib/indentation/browser/indentation.js";
import { BaseBinaryResourceEditor } from "./binaryEditor.js";
import { BinaryResourceDiffEditor } from "./binaryDiffEditor.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IFileService, FILES_ASSOCIATIONS_CONFIG } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { Range } from "../../../../editor/common/core/range.js";
import { Selection } from "../../../../editor/common/core/selection.js";
import { ICommandService, CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { IExtensionGalleryService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { EncodingMode, ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { SUPPORTED_ENCODINGS } from "../../../services/textfile/common/encoding.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { deepClone } from "../../../../base/common/objects.js";
import { getCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { Schemas } from "../../../../base/common/network.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { getIconClassesForLanguageId } from "../../../../editor/common/services/getIconClasses.js";
import { Promises, timeout } from "../../../../base/common/async.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { IStatusbarService, StatusbarAlignment } from "../../../services/statusbar/browser/statusbar.js";
import { IMarkerService, MarkerSeverity, IMarkerData } from "../../../../platform/markers/common/markers.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { SideBySideEditorInput } from "../../../common/editor/sideBySideEditorInput.js";
import { AutomaticLanguageDetectionLikelyWrongId, ILanguageDetectionService } from "../../../services/languageDetection/common/languageDetectionWorkerService.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { Action2 } from "../../../../platform/actions/common/actions.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { TabFocus } from "../../../../editor/browser/config/tabFocus.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { InputMode } from "../../../../editor/common/inputMode.js";
class SideBySideEditorEncodingSupport {
  constructor(primary, secondary) {
    this.primary = primary;
    this.secondary = secondary;
  }
  getEncoding() {
    return this.primary.getEncoding();
  }
  async setEncoding(encoding, mode) {
    await Promises.settled([this.primary, this.secondary].map((editor) => editor.setEncoding(encoding, mode)));
  }
}
class SideBySideEditorLanguageSupport {
  constructor(primary, secondary) {
    this.primary = primary;
    this.secondary = secondary;
  }
  setLanguageId(languageId, source) {
    [this.primary, this.secondary].forEach((editor) => editor.setLanguageId(languageId, source));
  }
}
function toEditorWithEncodingSupport(input) {
  if (input instanceof UntitledTextEditorInput) {
    return input;
  }
  if (input instanceof SideBySideEditorInput) {
    const primaryEncodingSupport = toEditorWithEncodingSupport(input.primary);
    const secondaryEncodingSupport = toEditorWithEncodingSupport(input.secondary);
    if (primaryEncodingSupport && secondaryEncodingSupport) {
      return new SideBySideEditorEncodingSupport(primaryEncodingSupport, secondaryEncodingSupport);
    }
    return primaryEncodingSupport;
  }
  const encodingSupport = input;
  if (areFunctions(encodingSupport.setEncoding, encodingSupport.getEncoding)) {
    return encodingSupport;
  }
  return null;
}
function toEditorWithLanguageSupport(input) {
  if (input instanceof UntitledTextEditorInput) {
    return input;
  }
  if (input instanceof SideBySideEditorInput) {
    const primaryLanguageSupport = toEditorWithLanguageSupport(input.primary);
    const secondaryLanguageSupport = toEditorWithLanguageSupport(input.secondary);
    if (primaryLanguageSupport && secondaryLanguageSupport) {
      return new SideBySideEditorLanguageSupport(primaryLanguageSupport, secondaryLanguageSupport);
    }
    return primaryLanguageSupport;
  }
  const languageSupport = input;
  if (typeof languageSupport.setLanguageId === "function") {
    return languageSupport;
  }
  return null;
}
class StateChange {
  constructor() {
    this.indentation = false;
    this.selectionStatus = false;
    this.languageId = false;
    this.languageStatus = false;
    this.encoding = false;
    this.EOL = false;
    this.tabFocusMode = false;
    this.inputMode = false;
    this.columnSelectionMode = false;
    this.metadata = false;
  }
  combine(other) {
    this.indentation = this.indentation || other.indentation;
    this.selectionStatus = this.selectionStatus || other.selectionStatus;
    this.languageId = this.languageId || other.languageId;
    this.languageStatus = this.languageStatus || other.languageStatus;
    this.encoding = this.encoding || other.encoding;
    this.EOL = this.EOL || other.EOL;
    this.tabFocusMode = this.tabFocusMode || other.tabFocusMode;
    this.inputMode = this.inputMode || other.inputMode;
    this.columnSelectionMode = this.columnSelectionMode || other.columnSelectionMode;
    this.metadata = this.metadata || other.metadata;
  }
  hasChanges() {
    return this.indentation || this.selectionStatus || this.languageId || this.languageStatus || this.encoding || this.EOL || this.tabFocusMode || this.inputMode || this.columnSelectionMode || this.metadata;
  }
}
class State {
  get selectionStatus() {
    return this._selectionStatus;
  }
  get languageId() {
    return this._languageId;
  }
  get encoding() {
    return this._encoding;
  }
  get EOL() {
    return this._EOL;
  }
  get indentation() {
    return this._indentation;
  }
  get tabFocusMode() {
    return this._tabFocusMode;
  }
  get inputMode() {
    return this._inputMode;
  }
  get columnSelectionMode() {
    return this._columnSelectionMode;
  }
  get metadata() {
    return this._metadata;
  }
  update(update) {
    const change = new StateChange();
    switch (update.type) {
      case "selectionStatus":
        if (this._selectionStatus !== update.selectionStatus) {
          this._selectionStatus = update.selectionStatus;
          change.selectionStatus = true;
        }
        break;
      case "indentation":
        if (this._indentation !== update.indentation) {
          this._indentation = update.indentation;
          change.indentation = true;
        }
        break;
      case "languageId":
        if (this._languageId !== update.languageId) {
          this._languageId = update.languageId;
          change.languageId = true;
        }
        break;
      case "encoding":
        if (this._encoding !== update.encoding) {
          this._encoding = update.encoding;
          change.encoding = true;
        }
        break;
      case "EOL":
        if (this._EOL !== update.EOL) {
          this._EOL = update.EOL;
          change.EOL = true;
        }
        break;
      case "tabFocusMode":
        if (this._tabFocusMode !== update.tabFocusMode) {
          this._tabFocusMode = update.tabFocusMode;
          change.tabFocusMode = true;
        }
        break;
      case "inputMode":
        if (this._inputMode !== update.inputMode) {
          this._inputMode = update.inputMode;
          change.inputMode = true;
        }
        break;
      case "columnSelectionMode":
        if (this._columnSelectionMode !== update.columnSelectionMode) {
          this._columnSelectionMode = update.columnSelectionMode;
          change.columnSelectionMode = true;
        }
        break;
      case "metadata":
        if (this._metadata !== update.metadata) {
          this._metadata = update.metadata;
          change.metadata = true;
        }
        break;
    }
    return change;
  }
}
let TabFocusMode = class extends Disposable {
  constructor(configurationService) {
    super();
    this.configurationService = configurationService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.registerListeners();
    const tabFocusModeConfig = configurationService.getValue("editor.tabFocusMode") === true ? true : false;
    TabFocus.setTabFocusMode(tabFocusModeConfig);
  }
  registerListeners() {
    this._register(TabFocus.onDidChangeTabFocus((tabFocusMode) => this._onDidChange.fire(tabFocusMode)));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.tabFocusMode")) {
        const tabFocusModeConfig = this.configurationService.getValue("editor.tabFocusMode") === true ? true : false;
        TabFocus.setTabFocusMode(tabFocusModeConfig);
        this._onDidChange.fire(tabFocusModeConfig);
      }
    }));
  }
};
TabFocusMode = __decorateClass([
  __decorateParam(0, IConfigurationService)
], TabFocusMode);
class StatusInputMode extends Disposable {
  constructor() {
    super();
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    InputMode.setInputMode("insert");
    this._register(InputMode.onDidChangeInputMode((inputMode) => this._onDidChange.fire(inputMode)));
  }
}
const nlsSingleSelectionRange = localize("singleSelectionRange", "Ln {0}, Col {1} ({2} selected)");
const nlsSingleSelection = localize("singleSelection", "Ln {0}, Col {1}");
const nlsMultiSelectionRange = localize("multiSelectionRange", "{0} selections ({1} characters selected)");
const nlsMultiSelection = localize("multiSelection", "{0} selections");
const nlsEOLLF = localize("endOfLineLineFeed", "LF");
const nlsEOLCRLF = localize("endOfLineCarriageReturnLineFeed", "CRLF");
let EditorStatus = class extends Disposable {
  constructor(targetWindowId, editorService, quickInputService, languageService, textFileService, statusbarService, instantiationService, configurationService) {
    super();
    this.targetWindowId = targetWindowId;
    this.editorService = editorService;
    this.quickInputService = quickInputService;
    this.languageService = languageService;
    this.textFileService = textFileService;
    this.statusbarService = statusbarService;
    this.configurationService = configurationService;
    this.tabFocusModeElement = this._register(new MutableDisposable());
    this.inputModeElement = this._register(new MutableDisposable());
    this.columnSelectionModeElement = this._register(new MutableDisposable());
    this.indentationElement = this._register(new MutableDisposable());
    this.selectionElement = this._register(new MutableDisposable());
    this.encodingElement = this._register(new MutableDisposable());
    this.eolElement = this._register(new MutableDisposable());
    this.languageElement = this._register(new MutableDisposable());
    this.metadataElement = this._register(new MutableDisposable());
    this.state = new State();
    this.toRender = void 0;
    this.activeEditorListeners = this._register(new DisposableStore());
    this.delayedRender = this._register(new MutableDisposable());
    this.currentMarkerStatus = this._register(instantiationService.createInstance(ShowCurrentMarkerInStatusbarContribution));
    this.tabFocusMode = this._register(instantiationService.createInstance(TabFocusMode));
    this.inputMode = this._register(instantiationService.createInstance(StatusInputMode));
    this.registerCommands();
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.editorService.onDidActiveEditorChange(() => this.updateStatusBar()));
    this._register(this.textFileService.untitled.onDidChangeEncoding((model) => this.onResourceEncodingChange(model.resource)));
    this._register(this.textFileService.files.onDidChangeEncoding((model) => this.onResourceEncodingChange(model.resource)));
    this._register(Event.runAndSubscribe(this.tabFocusMode.onDidChange, (tabFocusMode) => {
      if (tabFocusMode !== void 0) {
        this.onTabFocusModeChange(tabFocusMode);
      } else {
        this.onTabFocusModeChange(this.configurationService.getValue("editor.tabFocusMode"));
      }
    }));
    this._register(Event.runAndSubscribe(this.inputMode.onDidChange, (inputMode) => this.onInputModeChange(inputMode ?? "insert")));
  }
  registerCommands() {
    this._register(CommandsRegistry.registerCommand({ id: `changeEditorIndentation${this.targetWindowId}`, handler: () => this.showIndentationPicker() }));
  }
  async showIndentationPicker() {
    const activeTextEditorControl = getCodeEditor(this.editorService.activeTextEditorControl);
    if (!activeTextEditorControl) {
      return this.quickInputService.pick([{ label: localize("noEditor", "No text editor active at this time") }]);
    }
    if (this.editorService.activeEditor?.isReadonly()) {
      return this.quickInputService.pick([{ label: localize("noWritableCodeEditor", "The active code editor is read-only.") }]);
    }
    const picks = [
      assertIsDefined(activeTextEditorControl.getAction(IndentUsingSpaces.ID)),
      assertIsDefined(activeTextEditorControl.getAction(IndentUsingTabs.ID)),
      assertIsDefined(activeTextEditorControl.getAction(ChangeTabDisplaySize.ID)),
      assertIsDefined(activeTextEditorControl.getAction(DetectIndentation.ID)),
      assertIsDefined(activeTextEditorControl.getAction(IndentationToSpacesAction.ID)),
      assertIsDefined(activeTextEditorControl.getAction(IndentationToTabsAction.ID)),
      assertIsDefined(activeTextEditorControl.getAction(TrimTrailingWhitespaceAction.ID))
    ].map((a) => {
      return {
        id: a.id,
        label: a.label,
        detail: Language.isDefaultVariant() || a.label === a.alias ? void 0 : a.alias,
        run: () => {
          activeTextEditorControl.focus();
          a.run();
        }
      };
    });
    picks.splice(3, 0, { type: "separator", label: localize("indentConvert", "convert file") });
    picks.unshift({ type: "separator", label: localize("indentView", "change view") });
    const action = await this.quickInputService.pick(picks, { placeHolder: localize("pickAction", "Select Action"), matchOnDetail: true });
    return action?.run();
  }
  updateTabFocusModeElement(visible) {
    if (visible) {
      if (!this.tabFocusModeElement.value) {
        const text = localize("tabFocusModeEnabled", "Tab Moves Focus");
        this.tabFocusModeElement.value = this.statusbarService.addEntry({
          name: localize("status.editor.tabFocusMode", "Accessibility Mode"),
          text,
          ariaLabel: text,
          tooltip: localize("disableTabMode", "Disable Accessibility Mode"),
          command: "editor.action.toggleTabFocusMode",
          kind: "prominent"
        }, "status.editor.tabFocusMode", StatusbarAlignment.RIGHT, 100.7);
      }
    } else {
      this.tabFocusModeElement.clear();
    }
  }
  updateInputModeElement(inputMode) {
    if (inputMode === "overtype") {
      if (!this.inputModeElement.value) {
        const text = localize("inputModeOvertype", "OVR");
        const name = localize("status.editor.enableInsertMode", "Enable Insert Mode");
        this.inputModeElement.value = this.statusbarService.addEntry({
          name,
          text,
          ariaLabel: text,
          tooltip: name,
          command: "editor.action.toggleOvertypeInsertMode",
          kind: "prominent"
        }, "status.editor.inputMode", StatusbarAlignment.RIGHT, 100.6);
      }
    } else {
      this.inputModeElement.clear();
    }
  }
  updateColumnSelectionModeElement(visible) {
    if (visible) {
      if (!this.columnSelectionModeElement.value) {
        const text = localize("columnSelectionModeEnabled", "Column Selection");
        this.columnSelectionModeElement.value = this.statusbarService.addEntry({
          name: localize("status.editor.columnSelectionMode", "Column Selection Mode"),
          text,
          ariaLabel: text,
          tooltip: localize("disableColumnSelectionMode", "Disable Column Selection Mode"),
          command: "editor.action.toggleColumnSelection",
          kind: "prominent"
        }, "status.editor.columnSelectionMode", StatusbarAlignment.RIGHT, 100.8);
      }
    } else {
      this.columnSelectionModeElement.clear();
    }
  }
  updateSelectionElement(text) {
    if (!text) {
      this.selectionElement.clear();
      return;
    }
    const editorURI = getCodeEditor(this.editorService.activeTextEditorControl)?.getModel()?.uri;
    if (editorURI?.scheme === Schemas.vscodeNotebookCell) {
      this.selectionElement.clear();
      return;
    }
    const props = {
      name: localize("status.editor.selection", "Editor Selection"),
      text,
      ariaLabel: text,
      tooltip: localize("gotoLine", "Go to Line/Column"),
      command: "workbench.action.gotoLine"
    };
    this.updateElement(this.selectionElement, props, "status.editor.selection", StatusbarAlignment.RIGHT, 100.5);
  }
  updateIndentationElement(text) {
    if (!text) {
      this.indentationElement.clear();
      return;
    }
    const editorURI = getCodeEditor(this.editorService.activeTextEditorControl)?.getModel()?.uri;
    if (editorURI?.scheme === Schemas.vscodeNotebookCell) {
      this.indentationElement.clear();
      return;
    }
    const props = {
      name: localize("status.editor.indentation", "Editor Indentation"),
      text,
      ariaLabel: text,
      tooltip: localize("selectIndentation", "Select Indentation"),
      command: `changeEditorIndentation${this.targetWindowId}`
    };
    this.updateElement(this.indentationElement, props, "status.editor.indentation", StatusbarAlignment.RIGHT, 100.4);
  }
  updateEncodingElement(text) {
    if (!text) {
      this.encodingElement.clear();
      return;
    }
    const props = {
      name: localize("status.editor.encoding", "Editor Encoding"),
      text,
      ariaLabel: text,
      tooltip: localize("selectEncoding", "Select Encoding"),
      command: "workbench.action.editor.changeEncoding"
    };
    this.updateElement(this.encodingElement, props, "status.editor.encoding", StatusbarAlignment.RIGHT, 100.3);
  }
  updateEOLElement(text) {
    if (!text) {
      this.eolElement.clear();
      return;
    }
    const props = {
      name: localize("status.editor.eol", "Editor End of Line"),
      text,
      ariaLabel: text,
      tooltip: localize("selectEOL", "Select End of Line Sequence"),
      command: "workbench.action.editor.changeEOL"
    };
    this.updateElement(this.eolElement, props, "status.editor.eol", StatusbarAlignment.RIGHT, 100.2);
  }
  updateLanguageIdElement(text) {
    if (!text) {
      this.languageElement.clear();
      return;
    }
    const props = {
      name: localize("status.editor.mode", "Editor Language"),
      text,
      ariaLabel: text,
      tooltip: localize("selectLanguageMode", "Select Language Mode"),
      command: "workbench.action.editor.changeLanguageMode"
    };
    this.updateElement(this.languageElement, props, "status.editor.mode", StatusbarAlignment.RIGHT, 100.1);
  }
  updateMetadataElement(text) {
    if (!text) {
      this.metadataElement.clear();
      return;
    }
    const props = {
      name: localize("status.editor.info", "File Information"),
      text,
      ariaLabel: text,
      tooltip: localize("fileInfo", "File Information")
    };
    this.updateElement(this.metadataElement, props, "status.editor.info", StatusbarAlignment.RIGHT, 100);
  }
  updateElement(element, props, id, alignment, priority) {
    if (!element.value) {
      element.value = this.statusbarService.addEntry(props, id, alignment, priority);
    } else {
      element.value.update(props);
    }
  }
  updateState(update) {
    const changed = this.state.update(update);
    if (!changed.hasChanges()) {
      return;
    }
    if (!this.toRender) {
      this.toRender = changed;
      this.delayedRender.value = runAtThisOrScheduleAtNextAnimationFrame(getWindowById(this.targetWindowId, true).window, () => {
        this.delayedRender.clear();
        const toRender = this.toRender;
        this.toRender = void 0;
        if (toRender) {
          this.doRenderNow();
        }
      });
    } else {
      this.toRender.combine(changed);
    }
  }
  doRenderNow() {
    this.updateTabFocusModeElement(!!this.state.tabFocusMode);
    this.updateInputModeElement(this.state.inputMode);
    this.updateColumnSelectionModeElement(!!this.state.columnSelectionMode);
    this.updateIndentationElement(this.state.indentation);
    this.updateSelectionElement(this.state.selectionStatus);
    this.updateEncodingElement(this.state.encoding);
    this.updateEOLElement(this.state.EOL ? this.state.EOL === "\r\n" ? nlsEOLCRLF : nlsEOLLF : void 0);
    this.updateLanguageIdElement(this.state.languageId);
    this.updateMetadataElement(this.state.metadata);
  }
  getSelectionLabel(info) {
    if (!info || !info.selections) {
      return void 0;
    }
    if (info.selections.length === 1) {
      if (info.charactersSelected) {
        return format(nlsSingleSelectionRange, info.selections[0].positionLineNumber, info.selections[0].positionColumn, info.charactersSelected);
      }
      return format(nlsSingleSelection, info.selections[0].positionLineNumber, info.selections[0].positionColumn);
    }
    if (info.charactersSelected) {
      return format(nlsMultiSelectionRange, info.selections.length, info.charactersSelected);
    }
    if (info.selections.length > 0) {
      return format(nlsMultiSelection, info.selections.length);
    }
    return void 0;
  }
  updateStatusBar() {
    const activeInput = this.editorService.activeEditor;
    const activeEditorPane = this.editorService.activeEditorPane;
    const activeCodeEditor = activeEditorPane ? getCodeEditor(activeEditorPane.getControl()) ?? void 0 : void 0;
    this.onColumnSelectionModeChange(activeCodeEditor);
    this.onSelectionChange(activeCodeEditor);
    this.onLanguageChange(activeCodeEditor, activeInput);
    this.onEOLChange(activeCodeEditor);
    this.onEncodingChange(activeEditorPane, activeCodeEditor);
    this.onIndentationChange(activeCodeEditor);
    this.onMetadataChange(activeEditorPane);
    this.currentMarkerStatus.update(activeCodeEditor);
    this.activeEditorListeners.clear();
    if (activeEditorPane) {
      this.activeEditorListeners.add(activeEditorPane.onDidChangeControl(() => {
        this.updateStatusBar();
      }));
    }
    if (activeCodeEditor) {
      this.activeEditorListeners.add(activeCodeEditor.onDidChangeConfiguration((event) => {
        if (event.hasChanged(EditorOption.columnSelection)) {
          this.onColumnSelectionModeChange(activeCodeEditor);
        }
      }));
      this.activeEditorListeners.add(Event.defer(activeCodeEditor.onDidChangeCursorPosition)(() => {
        this.onSelectionChange(activeCodeEditor);
        this.currentMarkerStatus.update(activeCodeEditor);
      }));
      this.activeEditorListeners.add(activeCodeEditor.onDidChangeModelLanguage(() => {
        this.onLanguageChange(activeCodeEditor, activeInput);
      }));
      this.activeEditorListeners.add(Event.accumulate(activeCodeEditor.onDidChangeModelContent)((e) => {
        this.onEOLChange(activeCodeEditor);
        this.currentMarkerStatus.update(activeCodeEditor);
        const selections = activeCodeEditor.getSelections();
        if (selections) {
          for (const inner of e) {
            for (const change of inner.changes) {
              if (selections.some((selection) => Range.areIntersecting(selection, change.range))) {
                this.onSelectionChange(activeCodeEditor);
                break;
              }
            }
          }
        }
      }));
      this.activeEditorListeners.add(activeCodeEditor.onDidChangeModelOptions(() => {
        this.onIndentationChange(activeCodeEditor);
      }));
    } else if (activeEditorPane instanceof BaseBinaryResourceEditor || activeEditorPane instanceof BinaryResourceDiffEditor) {
      const binaryEditors = [];
      if (activeEditorPane instanceof BinaryResourceDiffEditor) {
        const primary = activeEditorPane.getPrimaryEditorPane();
        if (primary instanceof BaseBinaryResourceEditor) {
          binaryEditors.push(primary);
        }
        const secondary = activeEditorPane.getSecondaryEditorPane();
        if (secondary instanceof BaseBinaryResourceEditor) {
          binaryEditors.push(secondary);
        }
      } else {
        binaryEditors.push(activeEditorPane);
      }
      for (const editor of binaryEditors) {
        this.activeEditorListeners.add(editor.onDidChangeMetadata(() => {
          this.onMetadataChange(activeEditorPane);
        }));
        this.activeEditorListeners.add(editor.onDidOpenInPlace(() => {
          this.updateStatusBar();
        }));
      }
    }
  }
  onLanguageChange(editorWidget, editorInput) {
    const info = { type: "languageId", languageId: void 0 };
    if (editorWidget && editorInput && toEditorWithLanguageSupport(editorInput)) {
      const textModel = editorWidget.getModel();
      if (textModel) {
        const languageId = textModel.getLanguageId();
        info.languageId = this.languageService.getLanguageName(languageId) ?? void 0;
      }
    }
    this.updateState(info);
  }
  onIndentationChange(editorWidget) {
    const update = { type: "indentation", indentation: void 0 };
    if (editorWidget) {
      const model = editorWidget.getModel();
      if (model) {
        const modelOpts = model.getOptions();
        update.indentation = modelOpts.insertSpaces ? modelOpts.tabSize === modelOpts.indentSize ? localize("spacesSize", "Spaces: {0}", modelOpts.indentSize) : localize("spacesAndTabsSize", "Spaces: {0} (Tab Size: {1})", modelOpts.indentSize, modelOpts.tabSize) : localize({ key: "tabSize", comment: ["Tab corresponds to the tab key"] }, "Tab Size: {0}", modelOpts.tabSize);
      }
    }
    this.updateState(update);
  }
  onMetadataChange(editor) {
    const update = { type: "metadata", metadata: void 0 };
    if (editor instanceof BaseBinaryResourceEditor || editor instanceof BinaryResourceDiffEditor) {
      update.metadata = editor.getMetadata();
    }
    this.updateState(update);
  }
  onColumnSelectionModeChange(editorWidget) {
    const info = { type: "columnSelectionMode", columnSelectionMode: false };
    if (editorWidget?.getOption(EditorOption.columnSelection)) {
      info.columnSelectionMode = true;
    }
    this.updateState(info);
  }
  onSelectionChange(editorWidget) {
    const info = /* @__PURE__ */ Object.create(null);
    if (editorWidget) {
      info.selections = editorWidget.getSelections() || [];
      info.charactersSelected = 0;
      const textModel = editorWidget.getModel();
      if (textModel) {
        for (const selection of info.selections) {
          if (typeof info.charactersSelected !== "number") {
            info.charactersSelected = 0;
          }
          info.charactersSelected += textModel.getCharacterCountInRange(selection);
        }
      }
      if (info.selections.length === 1) {
        const editorPosition = editorWidget.getPosition();
        const selectionClone = new Selection(
          info.selections[0].selectionStartLineNumber,
          info.selections[0].selectionStartColumn,
          info.selections[0].positionLineNumber,
          editorPosition ? editorWidget.getStatusbarColumn(editorPosition) : info.selections[0].positionColumn
        );
        info.selections[0] = selectionClone;
      }
    }
    this.updateState({ type: "selectionStatus", selectionStatus: this.getSelectionLabel(info) });
  }
  onEOLChange(editorWidget) {
    const info = { type: "EOL", EOL: void 0 };
    if (editorWidget && !editorWidget.getOption(EditorOption.readOnly)) {
      const codeEditorModel = editorWidget.getModel();
      if (codeEditorModel) {
        info.EOL = codeEditorModel.getEOL();
      }
    }
    this.updateState(info);
  }
  onEncodingChange(editor, editorWidget) {
    if (editor && !this.isActiveEditor(editor)) {
      return;
    }
    const info = { type: "encoding", encoding: void 0 };
    if (editor && editorWidget?.hasModel()) {
      const encodingSupport = editor.input ? toEditorWithEncodingSupport(editor.input) : null;
      if (encodingSupport) {
        const rawEncoding = encodingSupport.getEncoding();
        const encodingInfo = typeof rawEncoding === "string" ? SUPPORTED_ENCODINGS[rawEncoding] : void 0;
        if (encodingInfo) {
          info.encoding = encodingInfo.labelShort;
        } else {
          info.encoding = rawEncoding;
        }
      }
    }
    this.updateState(info);
  }
  onResourceEncodingChange(resource) {
    const activeEditorPane = this.editorService.activeEditorPane;
    if (activeEditorPane) {
      const activeResource = EditorResourceAccessor.getCanonicalUri(activeEditorPane.input, { supportSideBySide: SideBySideEditor.PRIMARY });
      if (activeResource && isEqual(activeResource, resource)) {
        const activeCodeEditor = getCodeEditor(activeEditorPane.getControl()) ?? void 0;
        return this.onEncodingChange(activeEditorPane, activeCodeEditor);
      }
    }
  }
  onTabFocusModeChange(tabFocusMode) {
    const info = { type: "tabFocusMode", tabFocusMode };
    this.updateState(info);
  }
  onInputModeChange(inputMode) {
    const info = { type: "inputMode", inputMode };
    this.updateState(info);
  }
  isActiveEditor(control) {
    const activeEditorPane = this.editorService.activeEditorPane;
    return !!activeEditorPane && activeEditorPane === control;
  }
};
EditorStatus = __decorateClass([
  __decorateParam(1, IEditorService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, ILanguageService),
  __decorateParam(4, ITextFileService),
  __decorateParam(5, IStatusbarService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IConfigurationService)
], EditorStatus);
let EditorStatusContribution = class extends Disposable {
  constructor(editorGroupService) {
    super();
    this.editorGroupService = editorGroupService;
    for (const part of editorGroupService.parts) {
      this.createEditorStatus(part);
    }
    this._register(editorGroupService.onDidCreateAuxiliaryEditorPart((part) => this.createEditorStatus(part)));
  }
  createEditorStatus(part) {
    const disposables = new DisposableStore();
    Event.once(part.onWillDispose)(() => disposables.dispose());
    const scopedInstantiationService = this.editorGroupService.getScopedInstantiationService(part);
    disposables.add(scopedInstantiationService.createInstance(EditorStatus, part.windowId));
  }
};
EditorStatusContribution.ID = "workbench.contrib.editorStatus";
EditorStatusContribution = __decorateClass([
  __decorateParam(0, IEditorGroupsService)
], EditorStatusContribution);
let ShowCurrentMarkerInStatusbarContribution = class extends Disposable {
  constructor(statusbarService, markerService, configurationService) {
    super();
    this.statusbarService = statusbarService;
    this.markerService = markerService;
    this.configurationService = configurationService;
    this.editor = void 0;
    this.markers = [];
    this.currentMarker = null;
    this.statusBarEntryAccessor = this._register(new MutableDisposable());
    this._register(markerService.onMarkerChanged((changedResources) => this.onMarkerChanged(changedResources)));
    this._register(Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("problems.showCurrentInStatus"))(() => this.updateStatus()));
  }
  update(editor) {
    this.editor = editor;
    this.updateMarkers();
    this.updateStatus();
  }
  updateStatus() {
    const previousMarker = this.currentMarker;
    this.currentMarker = this.getMarker();
    if (this.hasToUpdateStatus(previousMarker, this.currentMarker)) {
      if (this.currentMarker) {
        const line = splitLines(this.currentMarker.message)[0];
        const text = `${this.getType(this.currentMarker)} ${line}`;
        if (!this.statusBarEntryAccessor.value) {
          this.statusBarEntryAccessor.value = this.statusbarService.addEntry({ name: localize("currentProblem", "Current Problem"), text, ariaLabel: text }, "statusbar.currentProblem", StatusbarAlignment.LEFT);
        } else {
          this.statusBarEntryAccessor.value.update({ name: localize("currentProblem", "Current Problem"), text, ariaLabel: text });
        }
      } else {
        this.statusBarEntryAccessor.clear();
      }
    }
  }
  hasToUpdateStatus(previousMarker, currentMarker) {
    if (!currentMarker) {
      return true;
    }
    if (!previousMarker) {
      return true;
    }
    return IMarkerData.makeKey(previousMarker) !== IMarkerData.makeKey(currentMarker);
  }
  getType(marker) {
    switch (marker.severity) {
      case MarkerSeverity.Error:
        return "$(error)";
      case MarkerSeverity.Warning:
        return "$(warning)";
      case MarkerSeverity.Info:
        return "$(info)";
    }
    return "";
  }
  getMarker() {
    if (!this.configurationService.getValue("problems.showCurrentInStatus")) {
      return null;
    }
    if (!this.editor) {
      return null;
    }
    const model = this.editor.getModel();
    if (!model) {
      return null;
    }
    const position = this.editor.getPosition();
    if (!position) {
      return null;
    }
    return this.markers.find((marker) => Range.containsPosition(marker, position)) || null;
  }
  onMarkerChanged(changedResources) {
    if (!this.editor) {
      return;
    }
    const model = this.editor.getModel();
    if (!model) {
      return;
    }
    if (model && !changedResources.some((r) => isEqual(model.uri, r))) {
      return;
    }
    this.updateMarkers();
  }
  updateMarkers() {
    if (!this.editor) {
      return;
    }
    const model = this.editor.getModel();
    if (!model) {
      return;
    }
    if (model) {
      this.markers = this.markerService.read({
        resource: model.uri,
        severities: MarkerSeverity.Error | MarkerSeverity.Warning | MarkerSeverity.Info
      });
      this.markers.sort(this.compareMarker);
    } else {
      this.markers = [];
    }
    this.updateStatus();
  }
  compareMarker(a, b) {
    let res = compare(a.resource.toString(), b.resource.toString());
    if (res === 0) {
      res = MarkerSeverity.compare(a.severity, b.severity);
    }
    if (res === 0) {
      res = Range.compareRangesUsingStarts(a, b);
    }
    return res;
  }
};
ShowCurrentMarkerInStatusbarContribution = __decorateClass([
  __decorateParam(0, IStatusbarService),
  __decorateParam(1, IMarkerService),
  __decorateParam(2, IConfigurationService)
], ShowCurrentMarkerInStatusbarContribution);
let ShowLanguageExtensionsAction = class extends Action {
  constructor(fileExtension, commandService, galleryService) {
    super(ShowLanguageExtensionsAction.ID, localize("showLanguageExtensions", "Search Marketplace Extensions for '{0}'...", fileExtension));
    this.fileExtension = fileExtension;
    this.commandService = commandService;
    this.enabled = galleryService.isEnabled();
  }
  async run() {
    await this.commandService.executeCommand("workbench.extensions.action.showExtensionsForLanguage", this.fileExtension);
  }
};
ShowLanguageExtensionsAction.ID = "workbench.action.showLanguageExtensions";
ShowLanguageExtensionsAction = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, IExtensionGalleryService)
], ShowLanguageExtensionsAction);
const _ChangeLanguageAction = class _ChangeLanguageAction extends Action2 {
  constructor() {
    super({
      id: _ChangeLanguageAction.ID,
      title: localize2("changeMode", "Change Language Mode"),
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyM)
      },
      precondition: ContextKeyExpr.not("notebookEditorFocused"),
      metadata: {
        description: localize("changeLanguageMode.description", "Change the language mode of the active text editor."),
        args: [
          {
            name: localize("changeLanguageMode.arg.name", "The name of the language mode to change to."),
            constraint: (value) => typeof value === "string"
          }
        ]
      }
    });
  }
  async run(accessor, languageMode) {
    const quickInputService = accessor.get(IQuickInputService);
    const editorService = accessor.get(IEditorService);
    const languageService = accessor.get(ILanguageService);
    const languageDetectionService = accessor.get(ILanguageDetectionService);
    const textFileService = accessor.get(ITextFileService);
    const preferencesService = accessor.get(IPreferencesService);
    const instantiationService = accessor.get(IInstantiationService);
    const configurationService = accessor.get(IConfigurationService);
    const telemetryService = accessor.get(ITelemetryService);
    const activeTextEditorControl = getCodeEditor(editorService.activeTextEditorControl);
    if (!activeTextEditorControl) {
      await quickInputService.pick([{ label: localize("noEditor", "No text editor active at this time") }]);
      return;
    }
    const textModel = activeTextEditorControl.getModel();
    const resource = EditorResourceAccessor.getOriginalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    let currentLanguageName;
    let currentLanguageId;
    if (textModel) {
      currentLanguageId = textModel.getLanguageId();
      currentLanguageName = languageService.getLanguageName(currentLanguageId) ?? void 0;
    }
    let hasLanguageSupport = !!resource;
    if (resource?.scheme === Schemas.untitled && !textFileService.untitled.get(resource)?.hasAssociatedFilePath) {
      hasLanguageSupport = false;
    }
    const languages = languageService.getSortedRegisteredLanguageNames();
    const picks = languages.map(({ languageName, languageId }) => {
      const extensions = languageService.getExtensions(languageId).join(" ");
      let description;
      if (currentLanguageName === languageName) {
        description = localize("languageDescription", "({0}) - Configured Language", languageId);
      } else {
        description = localize("languageDescriptionConfigured", "({0})", languageId);
      }
      return {
        label: languageName,
        meta: extensions,
        iconClasses: getIconClassesForLanguageId(languageId),
        description
      };
    });
    picks.unshift({ type: "separator", label: localize("languagesPicks", "languages (identifier)") });
    let configureLanguageAssociations;
    let configureLanguageSettings;
    let galleryAction;
    if (hasLanguageSupport && resource) {
      const ext = extname(resource) || basename(resource);
      galleryAction = instantiationService.createInstance(ShowLanguageExtensionsAction, ext);
      if (galleryAction.enabled) {
        picks.unshift(galleryAction);
      }
      configureLanguageSettings = { label: localize("configureModeSettings", "Configure '{0}' language based settings...", currentLanguageName) };
      picks.unshift(configureLanguageSettings);
      configureLanguageAssociations = { label: localize("configureAssociationsExt", "Configure File Association for '{0}'...", ext) };
      picks.unshift(configureLanguageAssociations);
    }
    const autoDetectLanguage = {
      label: localize("autoDetect", "Auto Detect")
    };
    picks.unshift(autoDetectLanguage);
    const pick = typeof languageMode === "string" ? { label: languageMode } : await quickInputService.pick(picks, { placeHolder: localize("pickLanguage", "Select Language Mode"), matchOnDescription: true });
    if (!pick) {
      return;
    }
    if (pick === galleryAction) {
      galleryAction.run();
      return;
    }
    if (pick === configureLanguageAssociations) {
      if (resource) {
        this.configureFileAssociation(resource, languageService, quickInputService, configurationService);
      }
      return;
    }
    if (pick === configureLanguageSettings) {
      preferencesService.openUserSettings({ jsonEditor: true, revealSetting: { key: `[${currentLanguageId ?? null}]`, edit: true } });
      return;
    }
    const activeEditor = editorService.activeEditor;
    if (activeEditor) {
      const languageSupport = toEditorWithLanguageSupport(activeEditor);
      if (languageSupport) {
        let languageSelection;
        let detectedLanguage;
        if (pick === autoDetectLanguage) {
          if (textModel) {
            const resource2 = EditorResourceAccessor.getOriginalUri(activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
            if (resource2) {
              let languageId = languageService.guessLanguageIdByFilepathOrFirstLine(resource2, textModel.getLineContent(1)) ?? void 0;
              if (!languageId || languageId === "unknown") {
                detectedLanguage = await languageDetectionService.detectLanguage(resource2);
                languageId = detectedLanguage;
              }
              if (languageId) {
                languageSelection = languageService.createById(languageId);
              }
            }
          }
        } else {
          const languageId = languageService.getLanguageIdByLanguageName(pick.label);
          languageSelection = languageService.createById(languageId);
          if (resource) {
            languageDetectionService.detectLanguage(resource).then((detectedLanguageId) => {
              const chosenLanguageId = languageService.getLanguageIdByLanguageName(pick.label) || "unknown";
              if (detectedLanguageId === currentLanguageId && currentLanguageId !== chosenLanguageId) {
                const modelPreference = configurationService.getValue("workbench.editor.preferHistoryBasedLanguageDetection") ? "history" : "classic";
                telemetryService.publicLog2(AutomaticLanguageDetectionLikelyWrongId, {
                  currentLanguageId: currentLanguageName ?? "unknown",
                  nextLanguageId: pick.label,
                  lineCount: textModel?.getLineCount() ?? -1,
                  modelPreference
                });
              }
            });
          }
        }
        if (typeof languageSelection !== "undefined") {
          languageSupport.setLanguageId(languageSelection.languageId, _ChangeLanguageAction.ID);
          if (resource?.scheme === Schemas.untitled) {
            const modelPreference = configurationService.getValue("workbench.editor.preferHistoryBasedLanguageDetection") ? "history" : "classic";
            telemetryService.publicLog2("setUntitledDocumentLanguage", {
              to: languageSelection.languageId,
              from: currentLanguageId ?? "none",
              modelPreference
            });
          }
        }
      }
      activeTextEditorControl.focus();
    }
  }
  configureFileAssociation(resource, languageService, quickInputService, configurationService) {
    const extension = extname(resource);
    const base = basename(resource);
    const currentAssociation = languageService.guessLanguageIdByFilepathOrFirstLine(URI.file(base));
    const languages = languageService.getSortedRegisteredLanguageNames();
    const picks = languages.map(({ languageName, languageId }) => {
      return {
        id: languageId,
        label: languageName,
        iconClasses: getIconClassesForLanguageId(languageId),
        description: languageId === currentAssociation ? localize("currentAssociation", "Current Association") : void 0
      };
    });
    setTimeout(
      async () => {
        const language = await quickInputService.pick(picks, { placeHolder: localize("pickLanguageToConfigure", "Select Language Mode to Associate with '{0}'", extension || base) });
        if (language) {
          const fileAssociationsConfig = configurationService.inspect(FILES_ASSOCIATIONS_CONFIG);
          let associationKey;
          if (extension && base[0] !== ".") {
            associationKey = `*${extension}`;
          } else {
            associationKey = base;
          }
          let target = ConfigurationTarget.USER;
          if (fileAssociationsConfig.workspaceValue && !!fileAssociationsConfig.workspaceValue[associationKey]) {
            target = ConfigurationTarget.WORKSPACE;
          }
          const currentAssociations = deepClone(target === ConfigurationTarget.WORKSPACE ? fileAssociationsConfig.workspaceValue : fileAssociationsConfig.userValue) || /* @__PURE__ */ Object.create(null);
          currentAssociations[associationKey] = language.id;
          configurationService.updateValue(FILES_ASSOCIATIONS_CONFIG, currentAssociations, target);
        }
      },
      50
      /* quick input is sensitive to being opened so soon after another */
    );
  }
};
_ChangeLanguageAction.ID = "workbench.action.editor.changeLanguageMode";
let ChangeLanguageAction = _ChangeLanguageAction;
class ChangeEOLAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.editor.changeEOL",
      title: localize2("changeEndOfLine", "Change End of Line Sequence"),
      f1: true
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const quickInputService = accessor.get(IQuickInputService);
    const activeTextEditorControl = getCodeEditor(editorService.activeTextEditorControl);
    if (!activeTextEditorControl) {
      await quickInputService.pick([{ label: localize("noEditor", "No text editor active at this time") }]);
      return;
    }
    if (editorService.activeEditor?.isReadonly()) {
      await quickInputService.pick([{ label: localize("noWritableCodeEditor", "The active code editor is read-only.") }]);
      return;
    }
    let textModel = activeTextEditorControl.getModel();
    const EOLOptions = [
      { label: nlsEOLLF, eol: EndOfLineSequence.LF },
      { label: nlsEOLCRLF, eol: EndOfLineSequence.CRLF }
    ];
    const selectedIndex = textModel?.getEOL() === "\n" ? 0 : 1;
    const eol = await quickInputService.pick(EOLOptions, { placeHolder: localize("pickEndOfLine", "Select End of Line Sequence"), activeItem: EOLOptions[selectedIndex] });
    if (eol) {
      const activeCodeEditor = getCodeEditor(editorService.activeTextEditorControl);
      if (activeCodeEditor?.hasModel() && !editorService.activeEditor?.isReadonly()) {
        textModel = activeCodeEditor.getModel();
        textModel.pushStackElement();
        textModel.pushEOL(eol.eol);
        textModel.pushStackElement();
      }
    }
    activeTextEditorControl.focus();
  }
}
class ChangeEncodingAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.editor.changeEncoding",
      title: localize2("changeEncoding", "Change File Encoding"),
      f1: true
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const quickInputService = accessor.get(IQuickInputService);
    const fileService = accessor.get(IFileService);
    const textFileService = accessor.get(ITextFileService);
    const textResourceConfigurationService = accessor.get(ITextResourceConfigurationService);
    const activeTextEditorControl = getCodeEditor(editorService.activeTextEditorControl);
    if (!activeTextEditorControl) {
      await quickInputService.pick([{ label: localize("noEditor", "No text editor active at this time") }]);
      return;
    }
    const activeEditorPane = editorService.activeEditorPane;
    if (!activeEditorPane) {
      await quickInputService.pick([{ label: localize("noEditor", "No text editor active at this time") }]);
      return;
    }
    const encodingSupport = toEditorWithEncodingSupport(activeEditorPane.input);
    if (!encodingSupport) {
      await quickInputService.pick([{ label: localize("noFileEditor", "No file active at this time") }]);
      return;
    }
    const saveWithEncodingPick = { label: localize("saveWithEncoding", "Save with Encoding") };
    const reopenWithEncodingPick = { label: localize("reopenWithEncoding", "Reopen with Encoding") };
    if (!Language.isDefaultVariant()) {
      const saveWithEncodingAlias = "Save with Encoding";
      if (saveWithEncodingAlias !== saveWithEncodingPick.label) {
        saveWithEncodingPick.detail = saveWithEncodingAlias;
      }
      const reopenWithEncodingAlias = "Reopen with Encoding";
      if (reopenWithEncodingAlias !== reopenWithEncodingPick.label) {
        reopenWithEncodingPick.detail = reopenWithEncodingAlias;
      }
    }
    let action;
    if (encodingSupport instanceof UntitledTextEditorInput) {
      action = saveWithEncodingPick;
    } else if (activeEditorPane.input.isReadonly()) {
      action = reopenWithEncodingPick;
    } else {
      action = await quickInputService.pick([reopenWithEncodingPick, saveWithEncodingPick], { placeHolder: localize("pickAction", "Select Action"), matchOnDetail: true });
    }
    if (!action) {
      return;
    }
    await timeout(50);
    const resource = EditorResourceAccessor.getOriginalUri(activeEditorPane.input, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (!resource || !fileService.hasProvider(resource) && resource.scheme !== Schemas.untitled) {
      return;
    }
    let guessedEncoding = void 0;
    if (fileService.hasProvider(resource)) {
      const content = await textFileService.readStream(resource, {
        autoGuessEncoding: true,
        candidateGuessEncodings: textResourceConfigurationService.getValue(resource, "files.candidateGuessEncodings")
      });
      guessedEncoding = content.encoding;
    }
    const isReopenWithEncoding = action === reopenWithEncodingPick;
    const configuredEncoding = textResourceConfigurationService.getValue(resource, "files.encoding");
    let directMatchIndex;
    let aliasMatchIndex;
    const picks = Object.keys(SUPPORTED_ENCODINGS).sort((k1, k2) => {
      if (k1 === configuredEncoding) {
        return -1;
      } else if (k2 === configuredEncoding) {
        return 1;
      }
      return SUPPORTED_ENCODINGS[k1].order - SUPPORTED_ENCODINGS[k2].order;
    }).filter((k) => {
      if (k === guessedEncoding && guessedEncoding !== configuredEncoding) {
        return false;
      }
      return !isReopenWithEncoding || !SUPPORTED_ENCODINGS[k].encodeOnly;
    }).map((key, index) => {
      if (key === encodingSupport.getEncoding()) {
        directMatchIndex = index;
      } else if (SUPPORTED_ENCODINGS[key].alias === encodingSupport.getEncoding()) {
        aliasMatchIndex = index;
      }
      return { id: key, label: SUPPORTED_ENCODINGS[key].labelLong, description: key };
    });
    const items = picks.slice();
    if (guessedEncoding && configuredEncoding !== guessedEncoding && SUPPORTED_ENCODINGS[guessedEncoding]) {
      picks.unshift({ type: "separator" });
      picks.unshift({ id: guessedEncoding, label: SUPPORTED_ENCODINGS[guessedEncoding].labelLong, description: localize("guessedEncoding", "Guessed from content") });
    }
    const encoding = await quickInputService.pick(picks, {
      placeHolder: isReopenWithEncoding ? localize("pickEncodingForReopen", "Select File Encoding to Reopen File") : localize("pickEncodingForSave", "Select File Encoding to Save with"),
      activeItem: items[typeof directMatchIndex === "number" ? directMatchIndex : typeof aliasMatchIndex === "number" ? aliasMatchIndex : -1]
    });
    if (!encoding) {
      return;
    }
    if (!editorService.activeEditorPane) {
      return;
    }
    const activeEncodingSupport = toEditorWithEncodingSupport(editorService.activeEditorPane.input);
    if (typeof encoding.id !== "undefined" && activeEncodingSupport) {
      await activeEncodingSupport.setEncoding(encoding.id, isReopenWithEncoding ? EncodingMode.Decode : EncodingMode.Encode);
    }
    activeTextEditorControl.focus();
  }
}
export {
  ChangeEOLAction,
  ChangeEncodingAction,
  ChangeLanguageAction,
  EditorStatusContribution,
  ShowLanguageExtensionsAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yU3RhdHVzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL21lZGlhL2VkaXRvcnN0YXR1cy5jc3MnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBnZXRXaW5kb3dCeUlkLCBydW5BdFRoaXNPclNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IGZvcm1hdCwgY29tcGFyZSwgc3BsaXRMaW5lcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgYmFzZW5hbWUsIGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgYXJlRnVuY3Rpb25zLCBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFVudGl0bGVkVGV4dEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdW50aXRsZWQvY29tbW9uL3VudGl0bGVkVGV4dEVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElGaWxlRWRpdG9ySW5wdXQsIEVkaXRvclJlc291cmNlQWNjZXNzb3IsIElFZGl0b3JQYW5lLCBTaWRlQnlTaWRlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgRW5kT2ZMaW5lU2VxdWVuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IFRyaW1UcmFpbGluZ1doaXRlc3BhY2VBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9saW5lc09wZXJhdGlvbnMvYnJvd3Nlci9saW5lc09wZXJhdGlvbnMuanMnO1xuaW1wb3J0IHsgSW5kZW50VXNpbmdTcGFjZXMsIEluZGVudFVzaW5nVGFicywgQ2hhbmdlVGFiRGlzcGxheVNpemUsIERldGVjdEluZGVudGF0aW9uLCBJbmRlbnRhdGlvblRvU3BhY2VzQWN0aW9uLCBJbmRlbnRhdGlvblRvVGFic0FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2luZGVudGF0aW9uL2Jyb3dzZXIvaW5kZW50YXRpb24uanMnO1xuaW1wb3J0IHsgQmFzZUJpbmFyeVJlc291cmNlRWRpdG9yIH0gZnJvbSAnLi9iaW5hcnlFZGl0b3IuanMnO1xuaW1wb3J0IHsgQmluYXJ5UmVzb3VyY2VEaWZmRWRpdG9yIH0gZnJvbSAnLi9iaW5hcnlEaWZmRWRpdG9yLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSwgRklMRVNfQVNTT0NJQVRJT05TX0NPTkZJRyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UsIElMYW5ndWFnZVNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlLCBDb21tYW5kc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgRW5jb2RpbmdNb2RlLCBJRW5jb2RpbmdTdXBwb3J0LCBJTGFuZ3VhZ2VTdXBwb3J0LCBJVGV4dEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL3RleHRmaWxlcy5qcyc7XG5pbXBvcnQgeyBTVVBQT1JURURfRU5DT0RJTkdTIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL2VuY29kaW5nLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQsIEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25UYXJnZXQsIElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgZGVlcENsb25lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciwgZ2V0Q29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSVByZWZlcmVuY2VzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ByZWZlcmVuY2VzL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtLCBRdWlja1BpY2tJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgZ2V0SWNvbkNsYXNzZXNGb3JMYW5ndWFnZUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9nZXRJY29uQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgeyBQcm9taXNlcywgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yLCBJU3RhdHVzYmFyU2VydmljZSwgU3RhdHVzYmFyQWxpZ25tZW50LCBJU3RhdHVzYmFyRW50cnkgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9zdGF0dXNiYXIvYnJvd3Nlci9zdGF0dXNiYXIuanMnO1xuaW1wb3J0IHsgSU1hcmtlciwgSU1hcmtlclNlcnZpY2UsIE1hcmtlclNldmVyaXR5LCBJTWFya2VyRGF0YSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBTaWRlQnlTaWRlRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL3NpZGVCeVNpZGVFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBBdXRvbWF0aWNMYW5ndWFnZURldGVjdGlvbkxpa2VseVdyb25nQ2xhc3NpZmljYXRpb24sIEF1dG9tYXRpY0xhbmd1YWdlRGV0ZWN0aW9uTGlrZWx5V3JvbmdJZCwgSUF1dG9tYXRpY0xhbmd1YWdlRGV0ZWN0aW9uTGlrZWx5V3JvbmdEYXRhLCBJTGFuZ3VhZ2VEZXRlY3Rpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGFuZ3VhZ2VEZXRlY3Rpb24vY29tbW9uL2xhbmd1YWdlRGV0ZWN0aW9uV29ya2VyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgS2V5Q2hvcmQsIEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IFRhYkZvY3VzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvY29uZmlnL3RhYkZvY3VzLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cHNTZXJ2aWNlLCBJRWRpdG9yUGFydCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJbnB1dE1vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2lucHV0TW9kZS5qcyc7XG5cbmNsYXNzIFNpZGVCeVNpZGVFZGl0b3JFbmNvZGluZ1N1cHBvcnQgaW1wbGVtZW50cyBJRW5jb2RpbmdTdXBwb3J0IHtcblx0Y29uc3RydWN0b3IocHJpdmF0ZSBwcmltYXJ5OiBJRW5jb2RpbmdTdXBwb3J0LCBwcml2YXRlIHNlY29uZGFyeTogSUVuY29kaW5nU3VwcG9ydCkgeyB9XG5cblx0Z2V0RW5jb2RpbmcoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5wcmltYXJ5LmdldEVuY29kaW5nKCk7IC8vIGFsd2F5cyByZXBvcnQgZnJvbSBtb2RpZmllZCAocmlnaHQgaGFuZCkgc2lkZVxuXHR9XG5cblx0YXN5bmMgc2V0RW5jb2RpbmcoZW5jb2Rpbmc6IHN0cmluZywgbW9kZTogRW5jb2RpbmdNb2RlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgUHJvbWlzZXMuc2V0dGxlZChbdGhpcy5wcmltYXJ5LCB0aGlzLnNlY29uZGFyeV0ubWFwKGVkaXRvciA9PiBlZGl0b3Iuc2V0RW5jb2RpbmcoZW5jb2RpbmcsIG1vZGUpKSk7XG5cdH1cbn1cblxuY2xhc3MgU2lkZUJ5U2lkZUVkaXRvckxhbmd1YWdlU3VwcG9ydCBpbXBsZW1lbnRzIElMYW5ndWFnZVN1cHBvcnQge1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcHJpbWFyeTogSUxhbmd1YWdlU3VwcG9ydCwgcHJpdmF0ZSBzZWNvbmRhcnk6IElMYW5ndWFnZVN1cHBvcnQpIHsgfVxuXG5cdHNldExhbmd1YWdlSWQobGFuZ3VhZ2VJZDogc3RyaW5nLCBzb3VyY2U/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRbdGhpcy5wcmltYXJ5LCB0aGlzLnNlY29uZGFyeV0uZm9yRWFjaChlZGl0b3IgPT4gZWRpdG9yLnNldExhbmd1YWdlSWQobGFuZ3VhZ2VJZCwgc291cmNlKSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gdG9FZGl0b3JXaXRoRW5jb2RpbmdTdXBwb3J0KGlucHV0OiBFZGl0b3JJbnB1dCk6IElFbmNvZGluZ1N1cHBvcnQgfCBudWxsIHtcblxuXHQvLyBVbnRpdGxlZCBUZXh0IEVkaXRvclxuXHRpZiAoaW5wdXQgaW5zdGFuY2VvZiBVbnRpdGxlZFRleHRFZGl0b3JJbnB1dCkge1xuXHRcdHJldHVybiBpbnB1dDtcblx0fVxuXG5cdC8vIFNpZGUgYnkgU2lkZSAoZGlmZikgRWRpdG9yXG5cdGlmIChpbnB1dCBpbnN0YW5jZW9mIFNpZGVCeVNpZGVFZGl0b3JJbnB1dCkge1xuXHRcdGNvbnN0IHByaW1hcnlFbmNvZGluZ1N1cHBvcnQgPSB0b0VkaXRvcldpdGhFbmNvZGluZ1N1cHBvcnQoaW5wdXQucHJpbWFyeSk7XG5cdFx0Y29uc3Qgc2Vjb25kYXJ5RW5jb2RpbmdTdXBwb3J0ID0gdG9FZGl0b3JXaXRoRW5jb2RpbmdTdXBwb3J0KGlucHV0LnNlY29uZGFyeSk7XG5cblx0XHRpZiAocHJpbWFyeUVuY29kaW5nU3VwcG9ydCAmJiBzZWNvbmRhcnlFbmNvZGluZ1N1cHBvcnQpIHtcblx0XHRcdHJldHVybiBuZXcgU2lkZUJ5U2lkZUVkaXRvckVuY29kaW5nU3VwcG9ydChwcmltYXJ5RW5jb2RpbmdTdXBwb3J0LCBzZWNvbmRhcnlFbmNvZGluZ1N1cHBvcnQpO1xuXHRcdH1cblxuXHRcdHJldHVybiBwcmltYXJ5RW5jb2RpbmdTdXBwb3J0O1xuXHR9XG5cblx0Ly8gRmlsZSBvciBSZXNvdXJjZSBFZGl0b3Jcblx0Y29uc3QgZW5jb2RpbmdTdXBwb3J0ID0gaW5wdXQgYXMgSUZpbGVFZGl0b3JJbnB1dDtcblx0aWYgKGFyZUZ1bmN0aW9ucyhlbmNvZGluZ1N1cHBvcnQuc2V0RW5jb2RpbmcsIGVuY29kaW5nU3VwcG9ydC5nZXRFbmNvZGluZykpIHtcblx0XHRyZXR1cm4gZW5jb2RpbmdTdXBwb3J0O1xuXHR9XG5cblx0Ly8gVW5zdXBwb3J0ZWQgZm9yIGFueSBvdGhlciBlZGl0b3Jcblx0cmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIHRvRWRpdG9yV2l0aExhbmd1YWdlU3VwcG9ydChpbnB1dDogRWRpdG9ySW5wdXQpOiBJTGFuZ3VhZ2VTdXBwb3J0IHwgbnVsbCB7XG5cblx0Ly8gVW50aXRsZWQgVGV4dCBFZGl0b3Jcblx0aWYgKGlucHV0IGluc3RhbmNlb2YgVW50aXRsZWRUZXh0RWRpdG9ySW5wdXQpIHtcblx0XHRyZXR1cm4gaW5wdXQ7XG5cdH1cblxuXHQvLyBTaWRlIGJ5IFNpZGUgKGRpZmYpIEVkaXRvclxuXHRpZiAoaW5wdXQgaW5zdGFuY2VvZiBTaWRlQnlTaWRlRWRpdG9ySW5wdXQpIHtcblx0XHRjb25zdCBwcmltYXJ5TGFuZ3VhZ2VTdXBwb3J0ID0gdG9FZGl0b3JXaXRoTGFuZ3VhZ2VTdXBwb3J0KGlucHV0LnByaW1hcnkpO1xuXHRcdGNvbnN0IHNlY29uZGFyeUxhbmd1YWdlU3VwcG9ydCA9IHRvRWRpdG9yV2l0aExhbmd1YWdlU3VwcG9ydChpbnB1dC5zZWNvbmRhcnkpO1xuXG5cdFx0aWYgKHByaW1hcnlMYW5ndWFnZVN1cHBvcnQgJiYgc2Vjb25kYXJ5TGFuZ3VhZ2VTdXBwb3J0KSB7XG5cdFx0XHRyZXR1cm4gbmV3IFNpZGVCeVNpZGVFZGl0b3JMYW5ndWFnZVN1cHBvcnQocHJpbWFyeUxhbmd1YWdlU3VwcG9ydCwgc2Vjb25kYXJ5TGFuZ3VhZ2VTdXBwb3J0KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcHJpbWFyeUxhbmd1YWdlU3VwcG9ydDtcblx0fVxuXG5cdC8vIEZpbGUgb3IgUmVzb3VyY2UgRWRpdG9yXG5cdGNvbnN0IGxhbmd1YWdlU3VwcG9ydCA9IGlucHV0IGFzIElGaWxlRWRpdG9ySW5wdXQ7XG5cdGlmICh0eXBlb2YgbGFuZ3VhZ2VTdXBwb3J0LnNldExhbmd1YWdlSWQgPT09ICdmdW5jdGlvbicpIHtcblx0XHRyZXR1cm4gbGFuZ3VhZ2VTdXBwb3J0O1xuXHR9XG5cblx0Ly8gVW5zdXBwb3J0ZWQgZm9yIGFueSBvdGhlciBlZGl0b3Jcblx0cmV0dXJuIG51bGw7XG59XG5cbmludGVyZmFjZSBJRWRpdG9yU2VsZWN0aW9uU3RhdHVzIHtcblx0c2VsZWN0aW9ucz86IFNlbGVjdGlvbltdO1xuXHRjaGFyYWN0ZXJzU2VsZWN0ZWQ/OiBudW1iZXI7XG59XG5cbmNsYXNzIFN0YXRlQ2hhbmdlIHtcblx0aW5kZW50YXRpb246IGJvb2xlYW4gPSBmYWxzZTtcblx0c2VsZWN0aW9uU3RhdHVzOiBib29sZWFuID0gZmFsc2U7XG5cdGxhbmd1YWdlSWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0bGFuZ3VhZ2VTdGF0dXM6IGJvb2xlYW4gPSBmYWxzZTtcblx0ZW5jb2Rpbmc6IGJvb2xlYW4gPSBmYWxzZTtcblx0RU9MOiBib29sZWFuID0gZmFsc2U7XG5cdHRhYkZvY3VzTW9kZTogYm9vbGVhbiA9IGZhbHNlO1xuXHRpbnB1dE1vZGU6IGJvb2xlYW4gPSBmYWxzZTtcblx0Y29sdW1uU2VsZWN0aW9uTW9kZTogYm9vbGVhbiA9IGZhbHNlO1xuXHRtZXRhZGF0YTogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGNvbWJpbmUob3RoZXI6IFN0YXRlQ2hhbmdlKSB7XG5cdFx0dGhpcy5pbmRlbnRhdGlvbiA9IHRoaXMuaW5kZW50YXRpb24gfHwgb3RoZXIuaW5kZW50YXRpb247XG5cdFx0dGhpcy5zZWxlY3Rpb25TdGF0dXMgPSB0aGlzLnNlbGVjdGlvblN0YXR1cyB8fCBvdGhlci5zZWxlY3Rpb25TdGF0dXM7XG5cdFx0dGhpcy5sYW5ndWFnZUlkID0gdGhpcy5sYW5ndWFnZUlkIHx8IG90aGVyLmxhbmd1YWdlSWQ7XG5cdFx0dGhpcy5sYW5ndWFnZVN0YXR1cyA9IHRoaXMubGFuZ3VhZ2VTdGF0dXMgfHwgb3RoZXIubGFuZ3VhZ2VTdGF0dXM7XG5cdFx0dGhpcy5lbmNvZGluZyA9IHRoaXMuZW5jb2RpbmcgfHwgb3RoZXIuZW5jb2Rpbmc7XG5cdFx0dGhpcy5FT0wgPSB0aGlzLkVPTCB8fCBvdGhlci5FT0w7XG5cdFx0dGhpcy50YWJGb2N1c01vZGUgPSB0aGlzLnRhYkZvY3VzTW9kZSB8fCBvdGhlci50YWJGb2N1c01vZGU7XG5cdFx0dGhpcy5pbnB1dE1vZGUgPSB0aGlzLmlucHV0TW9kZSB8fCBvdGhlci5pbnB1dE1vZGU7XG5cdFx0dGhpcy5jb2x1bW5TZWxlY3Rpb25Nb2RlID0gdGhpcy5jb2x1bW5TZWxlY3Rpb25Nb2RlIHx8IG90aGVyLmNvbHVtblNlbGVjdGlvbk1vZGU7XG5cdFx0dGhpcy5tZXRhZGF0YSA9IHRoaXMubWV0YWRhdGEgfHwgb3RoZXIubWV0YWRhdGE7XG5cdH1cblxuXHRoYXNDaGFuZ2VzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmluZGVudGF0aW9uXG5cdFx0XHR8fCB0aGlzLnNlbGVjdGlvblN0YXR1c1xuXHRcdFx0fHwgdGhpcy5sYW5ndWFnZUlkXG5cdFx0XHR8fCB0aGlzLmxhbmd1YWdlU3RhdHVzXG5cdFx0XHR8fCB0aGlzLmVuY29kaW5nXG5cdFx0XHR8fCB0aGlzLkVPTFxuXHRcdFx0fHwgdGhpcy50YWJGb2N1c01vZGVcblx0XHRcdHx8IHRoaXMuaW5wdXRNb2RlXG5cdFx0XHR8fCB0aGlzLmNvbHVtblNlbGVjdGlvbk1vZGVcblx0XHRcdHx8IHRoaXMubWV0YWRhdGE7XG5cdH1cbn1cblxudHlwZSBTdGF0ZURlbHRhID0gKFxuXHR7IHR5cGU6ICdzZWxlY3Rpb25TdGF0dXMnOyBzZWxlY3Rpb25TdGF0dXM6IHN0cmluZyB8IHVuZGVmaW5lZCB9XG5cdHwgeyB0eXBlOiAnbGFuZ3VhZ2VJZCc7IGxhbmd1YWdlSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCB9XG5cdHwgeyB0eXBlOiAnZW5jb2RpbmcnOyBlbmNvZGluZzogc3RyaW5nIHwgdW5kZWZpbmVkIH1cblx0fCB7IHR5cGU6ICdFT0wnOyBFT0w6IHN0cmluZyB8IHVuZGVmaW5lZCB9XG5cdHwgeyB0eXBlOiAnaW5kZW50YXRpb24nOyBpbmRlbnRhdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkIH1cblx0fCB7IHR5cGU6ICd0YWJGb2N1c01vZGUnOyB0YWJGb2N1c01vZGU6IGJvb2xlYW4gfVxuXHR8IHsgdHlwZTogJ2NvbHVtblNlbGVjdGlvbk1vZGUnOyBjb2x1bW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuIH1cblx0fCB7IHR5cGU6ICdtZXRhZGF0YSc7IG1ldGFkYXRhOiBzdHJpbmcgfCB1bmRlZmluZWQgfVxuXHR8IHsgdHlwZTogJ2lucHV0TW9kZSc7IGlucHV0TW9kZTogJ292ZXJ0eXBlJyB8ICdpbnNlcnQnIH1cbik7XG5cbmNsYXNzIFN0YXRlIHtcblxuXHRwcml2YXRlIF9zZWxlY3Rpb25TdGF0dXM6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Z2V0IHNlbGVjdGlvblN0YXR1cygpOiBzdHJpbmcgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fc2VsZWN0aW9uU3RhdHVzOyB9XG5cblx0cHJpdmF0ZSBfbGFuZ3VhZ2VJZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRnZXQgbGFuZ3VhZ2VJZCgpOiBzdHJpbmcgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fbGFuZ3VhZ2VJZDsgfVxuXG5cdHByaXZhdGUgX2VuY29kaW5nOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGdldCBlbmNvZGluZygpOiBzdHJpbmcgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fZW5jb2Rpbmc7IH1cblxuXHRwcml2YXRlIF9FT0w6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Z2V0IEVPTCgpOiBzdHJpbmcgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fRU9MOyB9XG5cblx0cHJpdmF0ZSBfaW5kZW50YXRpb246IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Z2V0IGluZGVudGF0aW9uKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9pbmRlbnRhdGlvbjsgfVxuXG5cdHByaXZhdGUgX3RhYkZvY3VzTW9kZTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0Z2V0IHRhYkZvY3VzTW9kZSgpOiBib29sZWFuIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX3RhYkZvY3VzTW9kZTsgfVxuXG5cdHByaXZhdGUgX2lucHV0TW9kZTogJ292ZXJ0eXBlJyB8ICdpbnNlcnQnIHwgdW5kZWZpbmVkO1xuXHRnZXQgaW5wdXRNb2RlKCk6ICdvdmVydHlwZScgfCAnaW5zZXJ0JyB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9pbnB1dE1vZGU7IH1cblxuXHRwcml2YXRlIF9jb2x1bW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRnZXQgY29sdW1uU2VsZWN0aW9uTW9kZSgpOiBib29sZWFuIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2NvbHVtblNlbGVjdGlvbk1vZGU7IH1cblxuXHRwcml2YXRlIF9tZXRhZGF0YTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRnZXQgbWV0YWRhdGEoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX21ldGFkYXRhOyB9XG5cblx0dXBkYXRlKHVwZGF0ZTogU3RhdGVEZWx0YSk6IFN0YXRlQ2hhbmdlIHtcblx0XHRjb25zdCBjaGFuZ2UgPSBuZXcgU3RhdGVDaGFuZ2UoKTtcblxuXHRcdHN3aXRjaCAodXBkYXRlLnR5cGUpIHtcblx0XHRcdGNhc2UgJ3NlbGVjdGlvblN0YXR1cyc6XG5cdFx0XHRcdGlmICh0aGlzLl9zZWxlY3Rpb25TdGF0dXMgIT09IHVwZGF0ZS5zZWxlY3Rpb25TdGF0dXMpIHtcblx0XHRcdFx0XHR0aGlzLl9zZWxlY3Rpb25TdGF0dXMgPSB1cGRhdGUuc2VsZWN0aW9uU3RhdHVzO1xuXHRcdFx0XHRcdGNoYW5nZS5zZWxlY3Rpb25TdGF0dXMgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlICdpbmRlbnRhdGlvbic6XG5cdFx0XHRcdGlmICh0aGlzLl9pbmRlbnRhdGlvbiAhPT0gdXBkYXRlLmluZGVudGF0aW9uKSB7XG5cdFx0XHRcdFx0dGhpcy5faW5kZW50YXRpb24gPSB1cGRhdGUuaW5kZW50YXRpb247XG5cdFx0XHRcdFx0Y2hhbmdlLmluZGVudGF0aW9uID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Y2FzZSAnbGFuZ3VhZ2VJZCc6XG5cdFx0XHRcdGlmICh0aGlzLl9sYW5ndWFnZUlkICE9PSB1cGRhdGUubGFuZ3VhZ2VJZCkge1xuXHRcdFx0XHRcdHRoaXMuX2xhbmd1YWdlSWQgPSB1cGRhdGUubGFuZ3VhZ2VJZDtcblx0XHRcdFx0XHRjaGFuZ2UubGFuZ3VhZ2VJZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgJ2VuY29kaW5nJzpcblx0XHRcdFx0aWYgKHRoaXMuX2VuY29kaW5nICE9PSB1cGRhdGUuZW5jb2RpbmcpIHtcblx0XHRcdFx0XHR0aGlzLl9lbmNvZGluZyA9IHVwZGF0ZS5lbmNvZGluZztcblx0XHRcdFx0XHRjaGFuZ2UuZW5jb2RpbmcgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlICdFT0wnOlxuXHRcdFx0XHRpZiAodGhpcy5fRU9MICE9PSB1cGRhdGUuRU9MKSB7XG5cdFx0XHRcdFx0dGhpcy5fRU9MID0gdXBkYXRlLkVPTDtcblx0XHRcdFx0XHRjaGFuZ2UuRU9MID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Y2FzZSAndGFiRm9jdXNNb2RlJzpcblx0XHRcdFx0aWYgKHRoaXMuX3RhYkZvY3VzTW9kZSAhPT0gdXBkYXRlLnRhYkZvY3VzTW9kZSkge1xuXHRcdFx0XHRcdHRoaXMuX3RhYkZvY3VzTW9kZSA9IHVwZGF0ZS50YWJGb2N1c01vZGU7XG5cdFx0XHRcdFx0Y2hhbmdlLnRhYkZvY3VzTW9kZSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgJ2lucHV0TW9kZSc6XG5cdFx0XHRcdGlmICh0aGlzLl9pbnB1dE1vZGUgIT09IHVwZGF0ZS5pbnB1dE1vZGUpIHtcblx0XHRcdFx0XHR0aGlzLl9pbnB1dE1vZGUgPSB1cGRhdGUuaW5wdXRNb2RlO1xuXHRcdFx0XHRcdGNoYW5nZS5pbnB1dE1vZGUgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlICdjb2x1bW5TZWxlY3Rpb25Nb2RlJzpcblx0XHRcdFx0aWYgKHRoaXMuX2NvbHVtblNlbGVjdGlvbk1vZGUgIT09IHVwZGF0ZS5jb2x1bW5TZWxlY3Rpb25Nb2RlKSB7XG5cdFx0XHRcdFx0dGhpcy5fY29sdW1uU2VsZWN0aW9uTW9kZSA9IHVwZGF0ZS5jb2x1bW5TZWxlY3Rpb25Nb2RlO1xuXHRcdFx0XHRcdGNoYW5nZS5jb2x1bW5TZWxlY3Rpb25Nb2RlID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Y2FzZSAnbWV0YWRhdGEnOlxuXHRcdFx0XHRpZiAodGhpcy5fbWV0YWRhdGEgIT09IHVwZGF0ZS5tZXRhZGF0YSkge1xuXHRcdFx0XHRcdHRoaXMuX21ldGFkYXRhID0gdXBkYXRlLm1ldGFkYXRhO1xuXHRcdFx0XHRcdGNoYW5nZS5tZXRhZGF0YSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNoYW5nZTtcblx0fVxufVxuXG5jbGFzcyBUYWJGb2N1c01vZGUgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPGJvb2xlYW4+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblxuXHRcdGNvbnN0IHRhYkZvY3VzTW9kZUNvbmZpZyA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KCdlZGl0b3IudGFiRm9jdXNNb2RlJykgPT09IHRydWUgPyB0cnVlIDogZmFsc2U7XG5cdFx0VGFiRm9jdXMuc2V0VGFiRm9jdXNNb2RlKHRhYkZvY3VzTW9kZUNvbmZpZyk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKFRhYkZvY3VzLm9uRGlkQ2hhbmdlVGFiRm9jdXModGFiRm9jdXNNb2RlID0+IHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUodGFiRm9jdXNNb2RlKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZWRpdG9yLnRhYkZvY3VzTW9kZScpKSB7XG5cdFx0XHRcdGNvbnN0IHRhYkZvY3VzTW9kZUNvbmZpZyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ2VkaXRvci50YWJGb2N1c01vZGUnKSA9PT0gdHJ1ZSA/IHRydWUgOiBmYWxzZTtcblx0XHRcdFx0VGFiRm9jdXMuc2V0VGFiRm9jdXNNb2RlKHRhYkZvY3VzTW9kZUNvbmZpZyk7XG5cblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh0YWJGb2N1c01vZGVDb25maWcpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxufVxuXG5jbGFzcyBTdGF0dXNJbnB1dE1vZGUgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPCdvdmVydHlwZScgfCAnaW5zZXJ0Jz4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0SW5wdXRNb2RlLnNldElucHV0TW9kZSgnaW5zZXJ0Jyk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoSW5wdXRNb2RlLm9uRGlkQ2hhbmdlSW5wdXRNb2RlKGlucHV0TW9kZSA9PiB0aGlzLl9vbkRpZENoYW5nZS5maXJlKGlucHV0TW9kZSkpKTtcblx0fVxufVxuXG5jb25zdCBubHNTaW5nbGVTZWxlY3Rpb25SYW5nZSA9IGxvY2FsaXplKCdzaW5nbGVTZWxlY3Rpb25SYW5nZScsIFwiTG4gezB9LCBDb2wgezF9ICh7Mn0gc2VsZWN0ZWQpXCIpO1xuY29uc3QgbmxzU2luZ2xlU2VsZWN0aW9uID0gbG9jYWxpemUoJ3NpbmdsZVNlbGVjdGlvbicsIFwiTG4gezB9LCBDb2wgezF9XCIpO1xuY29uc3QgbmxzTXVsdGlTZWxlY3Rpb25SYW5nZSA9IGxvY2FsaXplKCdtdWx0aVNlbGVjdGlvblJhbmdlJywgXCJ7MH0gc2VsZWN0aW9ucyAoezF9IGNoYXJhY3RlcnMgc2VsZWN0ZWQpXCIpO1xuY29uc3QgbmxzTXVsdGlTZWxlY3Rpb24gPSBsb2NhbGl6ZSgnbXVsdGlTZWxlY3Rpb24nLCBcInswfSBzZWxlY3Rpb25zXCIpO1xuY29uc3QgbmxzRU9MTEYgPSBsb2NhbGl6ZSgnZW5kT2ZMaW5lTGluZUZlZWQnLCBcIkxGXCIpO1xuY29uc3QgbmxzRU9MQ1JMRiA9IGxvY2FsaXplKCdlbmRPZkxpbmVDYXJyaWFnZVJldHVybkxpbmVGZWVkJywgXCJDUkxGXCIpO1xuXG5jbGFzcyBFZGl0b3JTdGF0dXMgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHRhYkZvY3VzTW9kZUVsZW1lbnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8SVN0YXR1c2JhckVudHJ5QWNjZXNzb3I+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGlucHV0TW9kZUVsZW1lbnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8SVN0YXR1c2JhckVudHJ5QWNjZXNzb3I+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbHVtblNlbGVjdGlvbk1vZGVFbGVtZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBpbmRlbnRhdGlvbkVsZW1lbnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8SVN0YXR1c2JhckVudHJ5QWNjZXNzb3I+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHNlbGVjdGlvbkVsZW1lbnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8SVN0YXR1c2JhckVudHJ5QWNjZXNzb3I+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGVuY29kaW5nRWxlbWVudCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJU3RhdHVzYmFyRW50cnlBY2Nlc3Nvcj4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZW9sRWxlbWVudCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJU3RhdHVzYmFyRW50cnlBY2Nlc3Nvcj4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VFbGVtZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBtZXRhZGF0YUVsZW1lbnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8SVN0YXR1c2JhckVudHJ5QWNjZXNzb3I+KCkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY3VycmVudE1hcmtlclN0YXR1czogU2hvd0N1cnJlbnRNYXJrZXJJblN0YXR1c2JhckNvbnRyaWJ1dGlvbjtcblx0cHJpdmF0ZSByZWFkb25seSB0YWJGb2N1c01vZGU6IFRhYkZvY3VzTW9kZTtcblx0cHJpdmF0ZSByZWFkb25seSBpbnB1dE1vZGU6IFN0YXR1c0lucHV0TW9kZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHN0YXRlID0gbmV3IFN0YXRlKCk7XG5cdHByaXZhdGUgdG9SZW5kZXI6IFN0YXRlQ2hhbmdlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgYWN0aXZlRWRpdG9yTGlzdGVuZXJzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBkZWxheWVkUmVuZGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdGFyZ2V0V2luZG93SWQ6IG51bWJlcixcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASVRleHRGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRleHRGaWxlU2VydmljZTogSVRleHRGaWxlU2VydmljZSxcblx0XHRASVN0YXR1c2JhclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdGF0dXNiYXJTZXJ2aWNlOiBJU3RhdHVzYmFyU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuY3VycmVudE1hcmtlclN0YXR1cyA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNob3dDdXJyZW50TWFya2VySW5TdGF0dXNiYXJDb250cmlidXRpb24pKTtcblx0XHR0aGlzLnRhYkZvY3VzTW9kZSA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRhYkZvY3VzTW9kZSkpO1xuXHRcdHRoaXMuaW5wdXRNb2RlID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU3RhdHVzSW5wdXRNb2RlKSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyQ29tbWFuZHMoKTtcblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yU2VydmljZS5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSgoKSA9PiB0aGlzLnVwZGF0ZVN0YXR1c0JhcigpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50ZXh0RmlsZVNlcnZpY2UudW50aXRsZWQub25EaWRDaGFuZ2VFbmNvZGluZyhtb2RlbCA9PiB0aGlzLm9uUmVzb3VyY2VFbmNvZGluZ0NoYW5nZShtb2RlbC5yZXNvdXJjZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRleHRGaWxlU2VydmljZS5maWxlcy5vbkRpZENoYW5nZUVuY29kaW5nKG1vZGVsID0+IHRoaXMub25SZXNvdXJjZUVuY29kaW5nQ2hhbmdlKChtb2RlbC5yZXNvdXJjZSkpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQucnVuQW5kU3Vic2NyaWJlKHRoaXMudGFiRm9jdXNNb2RlLm9uRGlkQ2hhbmdlLCAodGFiRm9jdXNNb2RlKSA9PiB7XG5cdFx0XHRpZiAodGFiRm9jdXNNb2RlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5vblRhYkZvY3VzTW9kZUNoYW5nZSh0YWJGb2N1c01vZGUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5vblRhYkZvY3VzTW9kZUNoYW5nZSh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdlZGl0b3IudGFiRm9jdXNNb2RlJykpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUodGhpcy5pbnB1dE1vZGUub25EaWRDaGFuZ2UsIChpbnB1dE1vZGUpID0+IHRoaXMub25JbnB1dE1vZGVDaGFuZ2UoaW5wdXRNb2RlID8/ICdpbnNlcnQnKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckNvbW1hbmRzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHsgaWQ6IGBjaGFuZ2VFZGl0b3JJbmRlbnRhdGlvbiR7dGhpcy50YXJnZXRXaW5kb3dJZH1gLCBoYW5kbGVyOiAoKSA9PiB0aGlzLnNob3dJbmRlbnRhdGlvblBpY2tlcigpIH0pKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2hvd0luZGVudGF0aW9uUGlja2VyKCk6IFByb21pc2U8dW5rbm93bj4ge1xuXHRcdGNvbnN0IGFjdGl2ZVRleHRFZGl0b3JDb250cm9sID0gZ2V0Q29kZUVkaXRvcih0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wpO1xuXHRcdGlmICghYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wpIHtcblx0XHRcdHJldHVybiB0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLnBpY2soW3sgbGFiZWw6IGxvY2FsaXplKCdub0VkaXRvcicsIFwiTm8gdGV4dCBlZGl0b3IgYWN0aXZlIGF0IHRoaXMgdGltZVwiKSB9XSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3I/LmlzUmVhZG9ubHkoKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMucXVpY2tJbnB1dFNlcnZpY2UucGljayhbeyBsYWJlbDogbG9jYWxpemUoJ25vV3JpdGFibGVDb2RlRWRpdG9yJywgXCJUaGUgYWN0aXZlIGNvZGUgZWRpdG9yIGlzIHJlYWQtb25seS5cIikgfV0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBpY2tzOiBRdWlja1BpY2tJbnB1dDxJUXVpY2tQaWNrSXRlbSAmIHsgcnVuKCk6IHZvaWQgfT5bXSA9IFtcblx0XHRcdGFzc2VydElzRGVmaW5lZChhY3RpdmVUZXh0RWRpdG9yQ29udHJvbC5nZXRBY3Rpb24oSW5kZW50VXNpbmdTcGFjZXMuSUQpKSxcblx0XHRcdGFzc2VydElzRGVmaW5lZChhY3RpdmVUZXh0RWRpdG9yQ29udHJvbC5nZXRBY3Rpb24oSW5kZW50VXNpbmdUYWJzLklEKSksXG5cdFx0XHRhc3NlcnRJc0RlZmluZWQoYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wuZ2V0QWN0aW9uKENoYW5nZVRhYkRpc3BsYXlTaXplLklEKSksXG5cdFx0XHRhc3NlcnRJc0RlZmluZWQoYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wuZ2V0QWN0aW9uKERldGVjdEluZGVudGF0aW9uLklEKSksXG5cdFx0XHRhc3NlcnRJc0RlZmluZWQoYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wuZ2V0QWN0aW9uKEluZGVudGF0aW9uVG9TcGFjZXNBY3Rpb24uSUQpKSxcblx0XHRcdGFzc2VydElzRGVmaW5lZChhY3RpdmVUZXh0RWRpdG9yQ29udHJvbC5nZXRBY3Rpb24oSW5kZW50YXRpb25Ub1RhYnNBY3Rpb24uSUQpKSxcblx0XHRcdGFzc2VydElzRGVmaW5lZChhY3RpdmVUZXh0RWRpdG9yQ29udHJvbC5nZXRBY3Rpb24oVHJpbVRyYWlsaW5nV2hpdGVzcGFjZUFjdGlvbi5JRCkpXG5cdFx0XS5tYXAoKGE6IElFZGl0b3JBY3Rpb24pID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGlkOiBhLmlkLFxuXHRcdFx0XHRsYWJlbDogYS5sYWJlbCxcblx0XHRcdFx0ZGV0YWlsOiAoTGFuZ3VhZ2UuaXNEZWZhdWx0VmFyaWFudCgpIHx8IGEubGFiZWwgPT09IGEuYWxpYXMpID8gdW5kZWZpbmVkIDogYS5hbGlhcyxcblx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0YWN0aXZlVGV4dEVkaXRvckNvbnRyb2wuZm9jdXMoKTtcblx0XHRcdFx0XHRhLnJ1bigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH0pO1xuXG5cdFx0cGlja3Muc3BsaWNlKDMsIDAsIHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBsb2NhbGl6ZSgnaW5kZW50Q29udmVydCcsIFwiY29udmVydCBmaWxlXCIpIH0pO1xuXHRcdHBpY2tzLnVuc2hpZnQoeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IGxvY2FsaXplKCdpbmRlbnRWaWV3JywgXCJjaGFuZ2Ugdmlld1wiKSB9KTtcblxuXHRcdGNvbnN0IGFjdGlvbiA9IGF3YWl0IHRoaXMucXVpY2tJbnB1dFNlcnZpY2UucGljayhwaWNrcywgeyBwbGFjZUhvbGRlcjogbG9jYWxpemUoJ3BpY2tBY3Rpb24nLCBcIlNlbGVjdCBBY3Rpb25cIiksIG1hdGNoT25EZXRhaWw6IHRydWUgfSk7XG5cdFx0cmV0dXJuIGFjdGlvbj8ucnVuKCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVRhYkZvY3VzTW9kZUVsZW1lbnQodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh2aXNpYmxlKSB7XG5cdFx0XHRpZiAoIXRoaXMudGFiRm9jdXNNb2RlRWxlbWVudC52YWx1ZSkge1xuXHRcdFx0XHRjb25zdCB0ZXh0ID0gbG9jYWxpemUoJ3RhYkZvY3VzTW9kZUVuYWJsZWQnLCBcIlRhYiBNb3ZlcyBGb2N1c1wiKTtcblx0XHRcdFx0dGhpcy50YWJGb2N1c01vZGVFbGVtZW50LnZhbHVlID0gdGhpcy5zdGF0dXNiYXJTZXJ2aWNlLmFkZEVudHJ5KHtcblx0XHRcdFx0XHRuYW1lOiBsb2NhbGl6ZSgnc3RhdHVzLmVkaXRvci50YWJGb2N1c01vZGUnLCBcIkFjY2Vzc2liaWxpdHkgTW9kZVwiKSxcblx0XHRcdFx0XHR0ZXh0LFxuXHRcdFx0XHRcdGFyaWFMYWJlbDogdGV4dCxcblx0XHRcdFx0XHR0b29sdGlwOiBsb2NhbGl6ZSgnZGlzYWJsZVRhYk1vZGUnLCBcIkRpc2FibGUgQWNjZXNzaWJpbGl0eSBNb2RlXCIpLFxuXHRcdFx0XHRcdGNvbW1hbmQ6ICdlZGl0b3IuYWN0aW9uLnRvZ2dsZVRhYkZvY3VzTW9kZScsXG5cdFx0XHRcdFx0a2luZDogJ3Byb21pbmVudCdcblx0XHRcdFx0fSwgJ3N0YXR1cy5lZGl0b3IudGFiRm9jdXNNb2RlJywgU3RhdHVzYmFyQWxpZ25tZW50LlJJR0hULCAxMDAuNyk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudGFiRm9jdXNNb2RlRWxlbWVudC5jbGVhcigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlSW5wdXRNb2RlRWxlbWVudChpbnB1dE1vZGU6ICdvdmVydHlwZScgfCAnaW5zZXJ0JyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmIChpbnB1dE1vZGUgPT09ICdvdmVydHlwZScpIHtcblx0XHRcdGlmICghdGhpcy5pbnB1dE1vZGVFbGVtZW50LnZhbHVlKSB7XG5cdFx0XHRcdGNvbnN0IHRleHQgPSBsb2NhbGl6ZSgnaW5wdXRNb2RlT3ZlcnR5cGUnLCAnT1ZSJyk7XG5cdFx0XHRcdGNvbnN0IG5hbWUgPSBsb2NhbGl6ZSgnc3RhdHVzLmVkaXRvci5lbmFibGVJbnNlcnRNb2RlJywgXCJFbmFibGUgSW5zZXJ0IE1vZGVcIik7XG5cdFx0XHRcdHRoaXMuaW5wdXRNb2RlRWxlbWVudC52YWx1ZSA9IHRoaXMuc3RhdHVzYmFyU2VydmljZS5hZGRFbnRyeSh7XG5cdFx0XHRcdFx0bmFtZSxcblx0XHRcdFx0XHR0ZXh0LFxuXHRcdFx0XHRcdGFyaWFMYWJlbDogdGV4dCxcblx0XHRcdFx0XHR0b29sdGlwOiBuYW1lLFxuXHRcdFx0XHRcdGNvbW1hbmQ6ICdlZGl0b3IuYWN0aW9uLnRvZ2dsZU92ZXJ0eXBlSW5zZXJ0TW9kZScsXG5cdFx0XHRcdFx0a2luZDogJ3Byb21pbmVudCdcblx0XHRcdFx0fSwgJ3N0YXR1cy5lZGl0b3IuaW5wdXRNb2RlJywgU3RhdHVzYmFyQWxpZ25tZW50LlJJR0hULCAxMDAuNik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuaW5wdXRNb2RlRWxlbWVudC5jbGVhcigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQ29sdW1uU2VsZWN0aW9uTW9kZUVsZW1lbnQodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh2aXNpYmxlKSB7XG5cdFx0XHRpZiAoIXRoaXMuY29sdW1uU2VsZWN0aW9uTW9kZUVsZW1lbnQudmFsdWUpIHtcblx0XHRcdFx0Y29uc3QgdGV4dCA9IGxvY2FsaXplKCdjb2x1bW5TZWxlY3Rpb25Nb2RlRW5hYmxlZCcsIFwiQ29sdW1uIFNlbGVjdGlvblwiKTtcblx0XHRcdFx0dGhpcy5jb2x1bW5TZWxlY3Rpb25Nb2RlRWxlbWVudC52YWx1ZSA9IHRoaXMuc3RhdHVzYmFyU2VydmljZS5hZGRFbnRyeSh7XG5cdFx0XHRcdFx0bmFtZTogbG9jYWxpemUoJ3N0YXR1cy5lZGl0b3IuY29sdW1uU2VsZWN0aW9uTW9kZScsIFwiQ29sdW1uIFNlbGVjdGlvbiBNb2RlXCIpLFxuXHRcdFx0XHRcdHRleHQsXG5cdFx0XHRcdFx0YXJpYUxhYmVsOiB0ZXh0LFxuXHRcdFx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdkaXNhYmxlQ29sdW1uU2VsZWN0aW9uTW9kZScsIFwiRGlzYWJsZSBDb2x1bW4gU2VsZWN0aW9uIE1vZGVcIiksXG5cdFx0XHRcdFx0Y29tbWFuZDogJ2VkaXRvci5hY3Rpb24udG9nZ2xlQ29sdW1uU2VsZWN0aW9uJyxcblx0XHRcdFx0XHRraW5kOiAncHJvbWluZW50J1xuXHRcdFx0XHR9LCAnc3RhdHVzLmVkaXRvci5jb2x1bW5TZWxlY3Rpb25Nb2RlJywgU3RhdHVzYmFyQWxpZ25tZW50LlJJR0hULCAxMDAuOCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuY29sdW1uU2VsZWN0aW9uTW9kZUVsZW1lbnQuY2xlYXIoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVNlbGVjdGlvbkVsZW1lbnQodGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0aWYgKCF0ZXh0KSB7XG5cdFx0XHR0aGlzLnNlbGVjdGlvbkVsZW1lbnQuY2xlYXIoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0b3JVUkkgPSBnZXRDb2RlRWRpdG9yKHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVUZXh0RWRpdG9yQ29udHJvbCk/LmdldE1vZGVsKCk/LnVyaTtcblx0XHRpZiAoZWRpdG9yVVJJPy5zY2hlbWUgPT09IFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsKSB7XG5cdFx0XHR0aGlzLnNlbGVjdGlvbkVsZW1lbnQuY2xlYXIoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwcm9wczogSVN0YXR1c2JhckVudHJ5ID0ge1xuXHRcdFx0bmFtZTogbG9jYWxpemUoJ3N0YXR1cy5lZGl0b3Iuc2VsZWN0aW9uJywgXCJFZGl0b3IgU2VsZWN0aW9uXCIpLFxuXHRcdFx0dGV4dCxcblx0XHRcdGFyaWFMYWJlbDogdGV4dCxcblx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdnb3RvTGluZScsIFwiR28gdG8gTGluZS9Db2x1bW5cIiksXG5cdFx0XHRjb21tYW5kOiAnd29ya2JlbmNoLmFjdGlvbi5nb3RvTGluZSdcblx0XHR9O1xuXG5cdFx0dGhpcy51cGRhdGVFbGVtZW50KHRoaXMuc2VsZWN0aW9uRWxlbWVudCwgcHJvcHMsICdzdGF0dXMuZWRpdG9yLnNlbGVjdGlvbicsIFN0YXR1c2JhckFsaWdubWVudC5SSUdIVCwgMTAwLjUpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVJbmRlbnRhdGlvbkVsZW1lbnQodGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0aWYgKCF0ZXh0KSB7XG5cdFx0XHR0aGlzLmluZGVudGF0aW9uRWxlbWVudC5jbGVhcigpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRvclVSSSA9IGdldENvZGVFZGl0b3IodGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZVRleHRFZGl0b3JDb250cm9sKT8uZ2V0TW9kZWwoKT8udXJpO1xuXHRcdGlmIChlZGl0b3JVUkk/LnNjaGVtZSA9PT0gU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGwpIHtcblx0XHRcdHRoaXMuaW5kZW50YXRpb25FbGVtZW50LmNsZWFyKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJvcHM6IElTdGF0dXNiYXJFbnRyeSA9IHtcblx0XHRcdG5hbWU6IGxvY2FsaXplKCdzdGF0dXMuZWRpdG9yLmluZGVudGF0aW9uJywgXCJFZGl0b3IgSW5kZW50YXRpb25cIiksXG5cdFx0XHR0ZXh0LFxuXHRcdFx0YXJpYUxhYmVsOiB0ZXh0LFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ3NlbGVjdEluZGVudGF0aW9uJywgXCJTZWxlY3QgSW5kZW50YXRpb25cIiksXG5cdFx0XHRjb21tYW5kOiBgY2hhbmdlRWRpdG9ySW5kZW50YXRpb24ke3RoaXMudGFyZ2V0V2luZG93SWR9YFxuXHRcdH07XG5cblx0XHR0aGlzLnVwZGF0ZUVsZW1lbnQodGhpcy5pbmRlbnRhdGlvbkVsZW1lbnQsIHByb3BzLCAnc3RhdHVzLmVkaXRvci5pbmRlbnRhdGlvbicsIFN0YXR1c2JhckFsaWdubWVudC5SSUdIVCwgMTAwLjQpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVFbmNvZGluZ0VsZW1lbnQodGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0aWYgKCF0ZXh0KSB7XG5cdFx0XHR0aGlzLmVuY29kaW5nRWxlbWVudC5jbGVhcigpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb3BzOiBJU3RhdHVzYmFyRW50cnkgPSB7XG5cdFx0XHRuYW1lOiBsb2NhbGl6ZSgnc3RhdHVzLmVkaXRvci5lbmNvZGluZycsIFwiRWRpdG9yIEVuY29kaW5nXCIpLFxuXHRcdFx0dGV4dCxcblx0XHRcdGFyaWFMYWJlbDogdGV4dCxcblx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdzZWxlY3RFbmNvZGluZycsIFwiU2VsZWN0IEVuY29kaW5nXCIpLFxuXHRcdFx0Y29tbWFuZDogJ3dvcmtiZW5jaC5hY3Rpb24uZWRpdG9yLmNoYW5nZUVuY29kaW5nJ1xuXHRcdH07XG5cblx0XHR0aGlzLnVwZGF0ZUVsZW1lbnQodGhpcy5lbmNvZGluZ0VsZW1lbnQsIHByb3BzLCAnc3RhdHVzLmVkaXRvci5lbmNvZGluZycsIFN0YXR1c2JhckFsaWdubWVudC5SSUdIVCwgMTAwLjMpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVFT0xFbGVtZW50KHRleHQ6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmICghdGV4dCkge1xuXHRcdFx0dGhpcy5lb2xFbGVtZW50LmNsZWFyKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJvcHM6IElTdGF0dXNiYXJFbnRyeSA9IHtcblx0XHRcdG5hbWU6IGxvY2FsaXplKCdzdGF0dXMuZWRpdG9yLmVvbCcsIFwiRWRpdG9yIEVuZCBvZiBMaW5lXCIpLFxuXHRcdFx0dGV4dCxcblx0XHRcdGFyaWFMYWJlbDogdGV4dCxcblx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdzZWxlY3RFT0wnLCBcIlNlbGVjdCBFbmQgb2YgTGluZSBTZXF1ZW5jZVwiKSxcblx0XHRcdGNvbW1hbmQ6ICd3b3JrYmVuY2guYWN0aW9uLmVkaXRvci5jaGFuZ2VFT0wnXG5cdFx0fTtcblxuXHRcdHRoaXMudXBkYXRlRWxlbWVudCh0aGlzLmVvbEVsZW1lbnQsIHByb3BzLCAnc3RhdHVzLmVkaXRvci5lb2wnLCBTdGF0dXNiYXJBbGlnbm1lbnQuUklHSFQsIDEwMC4yKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlTGFuZ3VhZ2VJZEVsZW1lbnQodGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0aWYgKCF0ZXh0KSB7XG5cdFx0XHR0aGlzLmxhbmd1YWdlRWxlbWVudC5jbGVhcigpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb3BzOiBJU3RhdHVzYmFyRW50cnkgPSB7XG5cdFx0XHRuYW1lOiBsb2NhbGl6ZSgnc3RhdHVzLmVkaXRvci5tb2RlJywgXCJFZGl0b3IgTGFuZ3VhZ2VcIiksXG5cdFx0XHR0ZXh0LFxuXHRcdFx0YXJpYUxhYmVsOiB0ZXh0LFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ3NlbGVjdExhbmd1YWdlTW9kZScsIFwiU2VsZWN0IExhbmd1YWdlIE1vZGVcIiksXG5cdFx0XHRjb21tYW5kOiAnd29ya2JlbmNoLmFjdGlvbi5lZGl0b3IuY2hhbmdlTGFuZ3VhZ2VNb2RlJ1xuXHRcdH07XG5cblx0XHR0aGlzLnVwZGF0ZUVsZW1lbnQodGhpcy5sYW5ndWFnZUVsZW1lbnQsIHByb3BzLCAnc3RhdHVzLmVkaXRvci5tb2RlJywgU3RhdHVzYmFyQWxpZ25tZW50LlJJR0hULCAxMDAuMSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZU1ldGFkYXRhRWxlbWVudCh0ZXh0OiBzdHJpbmcgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAoIXRleHQpIHtcblx0XHRcdHRoaXMubWV0YWRhdGFFbGVtZW50LmNsZWFyKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJvcHM6IElTdGF0dXNiYXJFbnRyeSA9IHtcblx0XHRcdG5hbWU6IGxvY2FsaXplKCdzdGF0dXMuZWRpdG9yLmluZm8nLCBcIkZpbGUgSW5mb3JtYXRpb25cIiksXG5cdFx0XHR0ZXh0LFxuXHRcdFx0YXJpYUxhYmVsOiB0ZXh0LFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ2ZpbGVJbmZvJywgXCJGaWxlIEluZm9ybWF0aW9uXCIpXG5cdFx0fTtcblxuXHRcdHRoaXMudXBkYXRlRWxlbWVudCh0aGlzLm1ldGFkYXRhRWxlbWVudCwgcHJvcHMsICdzdGF0dXMuZWRpdG9yLmluZm8nLCBTdGF0dXNiYXJBbGlnbm1lbnQuUklHSFQsIDEwMCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUVsZW1lbnQoZWxlbWVudDogTXV0YWJsZURpc3Bvc2FibGU8SVN0YXR1c2JhckVudHJ5QWNjZXNzb3I+LCBwcm9wczogSVN0YXR1c2JhckVudHJ5LCBpZDogc3RyaW5nLCBhbGlnbm1lbnQ6IFN0YXR1c2JhckFsaWdubWVudCwgcHJpb3JpdHk6IG51bWJlcikge1xuXHRcdGlmICghZWxlbWVudC52YWx1ZSkge1xuXHRcdFx0ZWxlbWVudC52YWx1ZSA9IHRoaXMuc3RhdHVzYmFyU2VydmljZS5hZGRFbnRyeShwcm9wcywgaWQsIGFsaWdubWVudCwgcHJpb3JpdHkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRlbGVtZW50LnZhbHVlLnVwZGF0ZShwcm9wcyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVTdGF0ZSh1cGRhdGU6IFN0YXRlRGVsdGEpOiB2b2lkIHtcblx0XHRjb25zdCBjaGFuZ2VkID0gdGhpcy5zdGF0ZS51cGRhdGUodXBkYXRlKTtcblx0XHRpZiAoIWNoYW5nZWQuaGFzQ2hhbmdlcygpKSB7XG5cdFx0XHRyZXR1cm47IC8vIE5vdGhpbmcgcmVhbGx5IGNoYW5nZWRcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMudG9SZW5kZXIpIHtcblx0XHRcdHRoaXMudG9SZW5kZXIgPSBjaGFuZ2VkO1xuXG5cdFx0XHR0aGlzLmRlbGF5ZWRSZW5kZXIudmFsdWUgPSBydW5BdFRoaXNPclNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUoZ2V0V2luZG93QnlJZCh0aGlzLnRhcmdldFdpbmRvd0lkLCB0cnVlKS53aW5kb3csICgpID0+IHtcblx0XHRcdFx0dGhpcy5kZWxheWVkUmVuZGVyLmNsZWFyKCk7XG5cblx0XHRcdFx0Y29uc3QgdG9SZW5kZXIgPSB0aGlzLnRvUmVuZGVyO1xuXHRcdFx0XHR0aGlzLnRvUmVuZGVyID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAodG9SZW5kZXIpIHtcblx0XHRcdFx0XHR0aGlzLmRvUmVuZGVyTm93KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnRvUmVuZGVyLmNvbWJpbmUoY2hhbmdlZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBkb1JlbmRlck5vdygpOiB2b2lkIHtcblx0XHR0aGlzLnVwZGF0ZVRhYkZvY3VzTW9kZUVsZW1lbnQoISF0aGlzLnN0YXRlLnRhYkZvY3VzTW9kZSk7XG5cdFx0dGhpcy51cGRhdGVJbnB1dE1vZGVFbGVtZW50KHRoaXMuc3RhdGUuaW5wdXRNb2RlKTtcblx0XHR0aGlzLnVwZGF0ZUNvbHVtblNlbGVjdGlvbk1vZGVFbGVtZW50KCEhdGhpcy5zdGF0ZS5jb2x1bW5TZWxlY3Rpb25Nb2RlKTtcblx0XHR0aGlzLnVwZGF0ZUluZGVudGF0aW9uRWxlbWVudCh0aGlzLnN0YXRlLmluZGVudGF0aW9uKTtcblx0XHR0aGlzLnVwZGF0ZVNlbGVjdGlvbkVsZW1lbnQodGhpcy5zdGF0ZS5zZWxlY3Rpb25TdGF0dXMpO1xuXHRcdHRoaXMudXBkYXRlRW5jb2RpbmdFbGVtZW50KHRoaXMuc3RhdGUuZW5jb2RpbmcpO1xuXHRcdHRoaXMudXBkYXRlRU9MRWxlbWVudCh0aGlzLnN0YXRlLkVPTCA/IHRoaXMuc3RhdGUuRU9MID09PSAnXFxyXFxuJyA/IG5sc0VPTENSTEYgOiBubHNFT0xMRiA6IHVuZGVmaW5lZCk7XG5cdFx0dGhpcy51cGRhdGVMYW5ndWFnZUlkRWxlbWVudCh0aGlzLnN0YXRlLmxhbmd1YWdlSWQpO1xuXHRcdHRoaXMudXBkYXRlTWV0YWRhdGFFbGVtZW50KHRoaXMuc3RhdGUubWV0YWRhdGEpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRTZWxlY3Rpb25MYWJlbChpbmZvOiBJRWRpdG9yU2VsZWN0aW9uU3RhdHVzKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIWluZm8gfHwgIWluZm8uc2VsZWN0aW9ucykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAoaW5mby5zZWxlY3Rpb25zLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0aWYgKGluZm8uY2hhcmFjdGVyc1NlbGVjdGVkKSB7XG5cdFx0XHRcdHJldHVybiBmb3JtYXQobmxzU2luZ2xlU2VsZWN0aW9uUmFuZ2UsIGluZm8uc2VsZWN0aW9uc1swXS5wb3NpdGlvbkxpbmVOdW1iZXIsIGluZm8uc2VsZWN0aW9uc1swXS5wb3NpdGlvbkNvbHVtbiwgaW5mby5jaGFyYWN0ZXJzU2VsZWN0ZWQpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZm9ybWF0KG5sc1NpbmdsZVNlbGVjdGlvbiwgaW5mby5zZWxlY3Rpb25zWzBdLnBvc2l0aW9uTGluZU51bWJlciwgaW5mby5zZWxlY3Rpb25zWzBdLnBvc2l0aW9uQ29sdW1uKTtcblx0XHR9XG5cblx0XHRpZiAoaW5mby5jaGFyYWN0ZXJzU2VsZWN0ZWQpIHtcblx0XHRcdHJldHVybiBmb3JtYXQobmxzTXVsdGlTZWxlY3Rpb25SYW5nZSwgaW5mby5zZWxlY3Rpb25zLmxlbmd0aCwgaW5mby5jaGFyYWN0ZXJzU2VsZWN0ZWQpO1xuXHRcdH1cblxuXHRcdGlmIChpbmZvLnNlbGVjdGlvbnMubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuIGZvcm1hdChubHNNdWx0aVNlbGVjdGlvbiwgaW5mby5zZWxlY3Rpb25zLmxlbmd0aCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlU3RhdHVzQmFyKCk6IHZvaWQge1xuXHRcdGNvbnN0IGFjdGl2ZUlucHV0ID0gdGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvcjtcblx0XHRjb25zdCBhY3RpdmVFZGl0b3JQYW5lID0gdGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0Y29uc3QgYWN0aXZlQ29kZUVkaXRvciA9IGFjdGl2ZUVkaXRvclBhbmUgPyBnZXRDb2RlRWRpdG9yKGFjdGl2ZUVkaXRvclBhbmUuZ2V0Q29udHJvbCgpKSA/PyB1bmRlZmluZWQgOiB1bmRlZmluZWQ7XG5cblx0XHQvLyBVcGRhdGUgYWxsIHN0YXRlc1xuXHRcdHRoaXMub25Db2x1bW5TZWxlY3Rpb25Nb2RlQ2hhbmdlKGFjdGl2ZUNvZGVFZGl0b3IpO1xuXHRcdHRoaXMub25TZWxlY3Rpb25DaGFuZ2UoYWN0aXZlQ29kZUVkaXRvcik7XG5cdFx0dGhpcy5vbkxhbmd1YWdlQ2hhbmdlKGFjdGl2ZUNvZGVFZGl0b3IsIGFjdGl2ZUlucHV0KTtcblx0XHR0aGlzLm9uRU9MQ2hhbmdlKGFjdGl2ZUNvZGVFZGl0b3IpO1xuXHRcdHRoaXMub25FbmNvZGluZ0NoYW5nZShhY3RpdmVFZGl0b3JQYW5lLCBhY3RpdmVDb2RlRWRpdG9yKTtcblx0XHR0aGlzLm9uSW5kZW50YXRpb25DaGFuZ2UoYWN0aXZlQ29kZUVkaXRvcik7XG5cdFx0dGhpcy5vbk1ldGFkYXRhQ2hhbmdlKGFjdGl2ZUVkaXRvclBhbmUpO1xuXHRcdHRoaXMuY3VycmVudE1hcmtlclN0YXR1cy51cGRhdGUoYWN0aXZlQ29kZUVkaXRvcik7XG5cblx0XHQvLyBEaXNwb3NlIG9sZCBhY3RpdmUgZWRpdG9yIGxpc3RlbmVyc1xuXHRcdHRoaXMuYWN0aXZlRWRpdG9yTGlzdGVuZXJzLmNsZWFyKCk7XG5cblx0XHQvLyBBdHRhY2ggbmV3IGxpc3RlbmVycyB0byBhY3RpdmUgZWRpdG9yXG5cdFx0aWYgKGFjdGl2ZUVkaXRvclBhbmUpIHtcblx0XHRcdHRoaXMuYWN0aXZlRWRpdG9yTGlzdGVuZXJzLmFkZChhY3RpdmVFZGl0b3JQYW5lLm9uRGlkQ2hhbmdlQ29udHJvbCgoKSA9PiB7XG5cdFx0XHRcdC8vIFNpbmNlIG91ciBlZGl0b3Igc3RhdHVzIGlzIG1haW5seSBvYnNlcnZpbmcgdGhlXG5cdFx0XHRcdC8vIGFjdGl2ZSBlZGl0b3IgY29udHJvbCwgZG8gYSBmdWxsIHVwZGF0ZSB3aGVuZXZlclxuXHRcdFx0XHQvLyB0aGUgY29udHJvbCBjaGFuZ2VzLlxuXHRcdFx0XHR0aGlzLnVwZGF0ZVN0YXR1c0JhcigpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdC8vIEF0dGFjaCBuZXcgbGlzdGVuZXJzIHRvIGFjdGl2ZSBjb2RlIGVkaXRvclxuXHRcdGlmIChhY3RpdmVDb2RlRWRpdG9yKSB7XG5cblx0XHRcdC8vIEhvb2sgTGlzdGVuZXIgZm9yIENvbmZpZ3VyYXRpb24gY2hhbmdlc1xuXHRcdFx0dGhpcy5hY3RpdmVFZGl0b3JMaXN0ZW5lcnMuYWRkKGFjdGl2ZUNvZGVFZGl0b3Iub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKChldmVudDogQ29uZmlndXJhdGlvbkNoYW5nZWRFdmVudCkgPT4ge1xuXHRcdFx0XHRpZiAoZXZlbnQuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24uY29sdW1uU2VsZWN0aW9uKSkge1xuXHRcdFx0XHRcdHRoaXMub25Db2x1bW5TZWxlY3Rpb25Nb2RlQ2hhbmdlKGFjdGl2ZUNvZGVFZGl0b3IpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdC8vIEhvb2sgTGlzdGVuZXIgZm9yIFNlbGVjdGlvbiBjaGFuZ2VzXG5cdFx0XHR0aGlzLmFjdGl2ZUVkaXRvckxpc3RlbmVycy5hZGQoRXZlbnQuZGVmZXIoYWN0aXZlQ29kZUVkaXRvci5vbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uKSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMub25TZWxlY3Rpb25DaGFuZ2UoYWN0aXZlQ29kZUVkaXRvcik7XG5cdFx0XHRcdHRoaXMuY3VycmVudE1hcmtlclN0YXR1cy51cGRhdGUoYWN0aXZlQ29kZUVkaXRvcik7XG5cdFx0XHR9KSk7XG5cblx0XHRcdC8vIEhvb2sgTGlzdGVuZXIgZm9yIGxhbmd1YWdlIGNoYW5nZXNcblx0XHRcdHRoaXMuYWN0aXZlRWRpdG9yTGlzdGVuZXJzLmFkZChhY3RpdmVDb2RlRWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxMYW5ndWFnZSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMub25MYW5ndWFnZUNoYW5nZShhY3RpdmVDb2RlRWRpdG9yLCBhY3RpdmVJbnB1dCk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdC8vIEhvb2sgTGlzdGVuZXIgZm9yIGNvbnRlbnQgY2hhbmdlc1xuXHRcdFx0dGhpcy5hY3RpdmVFZGl0b3JMaXN0ZW5lcnMuYWRkKEV2ZW50LmFjY3VtdWxhdGUoYWN0aXZlQ29kZUVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCkoZSA9PiB7XG5cdFx0XHRcdHRoaXMub25FT0xDaGFuZ2UoYWN0aXZlQ29kZUVkaXRvcik7XG5cdFx0XHRcdHRoaXMuY3VycmVudE1hcmtlclN0YXR1cy51cGRhdGUoYWN0aXZlQ29kZUVkaXRvcik7XG5cblx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IGFjdGl2ZUNvZGVFZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdFx0XHRpZiAoc2VsZWN0aW9ucykge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgaW5uZXIgb2YgZSkge1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBjaGFuZ2Ugb2YgaW5uZXIuY2hhbmdlcykge1xuXHRcdFx0XHRcdFx0XHRpZiAoc2VsZWN0aW9ucy5zb21lKHNlbGVjdGlvbiA9PiBSYW5nZS5hcmVJbnRlcnNlY3Rpbmcoc2VsZWN0aW9uLCBjaGFuZ2UucmFuZ2UpKSkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMub25TZWxlY3Rpb25DaGFuZ2UoYWN0aXZlQ29kZUVkaXRvcik7XG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0Ly8gSG9vayBMaXN0ZW5lciBmb3IgY29udGVudCBvcHRpb25zIGNoYW5nZXNcblx0XHRcdHRoaXMuYWN0aXZlRWRpdG9yTGlzdGVuZXJzLmFkZChhY3RpdmVDb2RlRWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxPcHRpb25zKCgpID0+IHtcblx0XHRcdFx0dGhpcy5vbkluZGVudGF0aW9uQ2hhbmdlKGFjdGl2ZUNvZGVFZGl0b3IpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdC8vIEhhbmRsZSBiaW5hcnkgZWRpdG9yc1xuXHRcdGVsc2UgaWYgKGFjdGl2ZUVkaXRvclBhbmUgaW5zdGFuY2VvZiBCYXNlQmluYXJ5UmVzb3VyY2VFZGl0b3IgfHwgYWN0aXZlRWRpdG9yUGFuZSBpbnN0YW5jZW9mIEJpbmFyeVJlc291cmNlRGlmZkVkaXRvcikge1xuXHRcdFx0Y29uc3QgYmluYXJ5RWRpdG9yczogQmFzZUJpbmFyeVJlc291cmNlRWRpdG9yW10gPSBbXTtcblx0XHRcdGlmIChhY3RpdmVFZGl0b3JQYW5lIGluc3RhbmNlb2YgQmluYXJ5UmVzb3VyY2VEaWZmRWRpdG9yKSB7XG5cdFx0XHRcdGNvbnN0IHByaW1hcnkgPSBhY3RpdmVFZGl0b3JQYW5lLmdldFByaW1hcnlFZGl0b3JQYW5lKCk7XG5cdFx0XHRcdGlmIChwcmltYXJ5IGluc3RhbmNlb2YgQmFzZUJpbmFyeVJlc291cmNlRWRpdG9yKSB7XG5cdFx0XHRcdFx0YmluYXJ5RWRpdG9ycy5wdXNoKHByaW1hcnkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgc2Vjb25kYXJ5ID0gYWN0aXZlRWRpdG9yUGFuZS5nZXRTZWNvbmRhcnlFZGl0b3JQYW5lKCk7XG5cdFx0XHRcdGlmIChzZWNvbmRhcnkgaW5zdGFuY2VvZiBCYXNlQmluYXJ5UmVzb3VyY2VFZGl0b3IpIHtcblx0XHRcdFx0XHRiaW5hcnlFZGl0b3JzLnB1c2goc2Vjb25kYXJ5KTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YmluYXJ5RWRpdG9ycy5wdXNoKGFjdGl2ZUVkaXRvclBhbmUpO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBiaW5hcnlFZGl0b3JzKSB7XG5cdFx0XHRcdHRoaXMuYWN0aXZlRWRpdG9yTGlzdGVuZXJzLmFkZChlZGl0b3Iub25EaWRDaGFuZ2VNZXRhZGF0YSgoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5vbk1ldGFkYXRhQ2hhbmdlKGFjdGl2ZUVkaXRvclBhbmUpO1xuXHRcdFx0XHR9KSk7XG5cblx0XHRcdFx0dGhpcy5hY3RpdmVFZGl0b3JMaXN0ZW5lcnMuYWRkKGVkaXRvci5vbkRpZE9wZW5JblBsYWNlKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZVN0YXR1c0JhcigpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkxhbmd1YWdlQ2hhbmdlKGVkaXRvcldpZGdldDogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQsIGVkaXRvcklucHV0OiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IGluZm86IFN0YXRlRGVsdGEgPSB7IHR5cGU6ICdsYW5ndWFnZUlkJywgbGFuZ3VhZ2VJZDogdW5kZWZpbmVkIH07XG5cblx0XHQvLyBXZSBvbmx5IHN1cHBvcnQgdGV4dCBiYXNlZCBlZGl0b3JzXG5cdFx0aWYgKGVkaXRvcldpZGdldCAmJiBlZGl0b3JJbnB1dCAmJiB0b0VkaXRvcldpdGhMYW5ndWFnZVN1cHBvcnQoZWRpdG9ySW5wdXQpKSB7XG5cdFx0XHRjb25zdCB0ZXh0TW9kZWwgPSBlZGl0b3JXaWRnZXQuZ2V0TW9kZWwoKTtcblx0XHRcdGlmICh0ZXh0TW9kZWwpIHtcblx0XHRcdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9IHRleHRNb2RlbC5nZXRMYW5ndWFnZUlkKCk7XG5cdFx0XHRcdGluZm8ubGFuZ3VhZ2VJZCA9IHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmdldExhbmd1YWdlTmFtZShsYW5ndWFnZUlkKSA/PyB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy51cGRhdGVTdGF0ZShpbmZvKTtcblx0fVxuXG5cdHByaXZhdGUgb25JbmRlbnRhdGlvbkNoYW5nZShlZGl0b3JXaWRnZXQ6IElDb2RlRWRpdG9yIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3QgdXBkYXRlOiBTdGF0ZURlbHRhID0geyB0eXBlOiAnaW5kZW50YXRpb24nLCBpbmRlbnRhdGlvbjogdW5kZWZpbmVkIH07XG5cblx0XHRpZiAoZWRpdG9yV2lkZ2V0KSB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvcldpZGdldC5nZXRNb2RlbCgpO1xuXHRcdFx0aWYgKG1vZGVsKSB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsT3B0cyA9IG1vZGVsLmdldE9wdGlvbnMoKTtcblx0XHRcdFx0dXBkYXRlLmluZGVudGF0aW9uID0gKFxuXHRcdFx0XHRcdG1vZGVsT3B0cy5pbnNlcnRTcGFjZXNcblx0XHRcdFx0XHRcdD8gbW9kZWxPcHRzLnRhYlNpemUgPT09IG1vZGVsT3B0cy5pbmRlbnRTaXplXG5cdFx0XHRcdFx0XHRcdD8gbG9jYWxpemUoJ3NwYWNlc1NpemUnLCBcIlNwYWNlczogezB9XCIsIG1vZGVsT3B0cy5pbmRlbnRTaXplKVxuXHRcdFx0XHRcdFx0XHQ6IGxvY2FsaXplKCdzcGFjZXNBbmRUYWJzU2l6ZScsIFwiU3BhY2VzOiB7MH0gKFRhYiBTaXplOiB7MX0pXCIsIG1vZGVsT3B0cy5pbmRlbnRTaXplLCBtb2RlbE9wdHMudGFiU2l6ZSlcblx0XHRcdFx0XHRcdDogbG9jYWxpemUoeyBrZXk6ICd0YWJTaXplJywgY29tbWVudDogWydUYWIgY29ycmVzcG9uZHMgdG8gdGhlIHRhYiBrZXknXSB9LCBcIlRhYiBTaXplOiB7MH1cIiwgbW9kZWxPcHRzLnRhYlNpemUpXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy51cGRhdGVTdGF0ZSh1cGRhdGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbk1ldGFkYXRhQ2hhbmdlKGVkaXRvcjogSUVkaXRvclBhbmUgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCB1cGRhdGU6IFN0YXRlRGVsdGEgPSB7IHR5cGU6ICdtZXRhZGF0YScsIG1ldGFkYXRhOiB1bmRlZmluZWQgfTtcblxuXHRcdGlmIChlZGl0b3IgaW5zdGFuY2VvZiBCYXNlQmluYXJ5UmVzb3VyY2VFZGl0b3IgfHwgZWRpdG9yIGluc3RhbmNlb2YgQmluYXJ5UmVzb3VyY2VEaWZmRWRpdG9yKSB7XG5cdFx0XHR1cGRhdGUubWV0YWRhdGEgPSBlZGl0b3IuZ2V0TWV0YWRhdGEoKTtcblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZVN0YXRlKHVwZGF0ZSk7XG5cdH1cblxuXHRwcml2YXRlIG9uQ29sdW1uU2VsZWN0aW9uTW9kZUNoYW5nZShlZGl0b3JXaWRnZXQ6IElDb2RlRWRpdG9yIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3QgaW5mbzogU3RhdGVEZWx0YSA9IHsgdHlwZTogJ2NvbHVtblNlbGVjdGlvbk1vZGUnLCBjb2x1bW5TZWxlY3Rpb25Nb2RlOiBmYWxzZSB9O1xuXG5cdFx0aWYgKGVkaXRvcldpZGdldD8uZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5jb2x1bW5TZWxlY3Rpb24pKSB7XG5cdFx0XHRpbmZvLmNvbHVtblNlbGVjdGlvbk1vZGUgPSB0cnVlO1xuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlU3RhdGUoaW5mbyk7XG5cdH1cblxuXHRwcml2YXRlIG9uU2VsZWN0aW9uQ2hhbmdlKGVkaXRvcldpZGdldDogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCBpbmZvOiBJRWRpdG9yU2VsZWN0aW9uU3RhdHVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuXHRcdC8vIFdlIG9ubHkgc3VwcG9ydCB0ZXh0IGJhc2VkIGVkaXRvcnNcblx0XHRpZiAoZWRpdG9yV2lkZ2V0KSB7XG5cblx0XHRcdC8vIENvbXB1dGUgc2VsZWN0aW9uKHMpXG5cdFx0XHRpbmZvLnNlbGVjdGlvbnMgPSBlZGl0b3JXaWRnZXQuZ2V0U2VsZWN0aW9ucygpIHx8IFtdO1xuXG5cdFx0XHQvLyBDb21wdXRlIHNlbGVjdGlvbiBsZW5ndGhcblx0XHRcdGluZm8uY2hhcmFjdGVyc1NlbGVjdGVkID0gMDtcblx0XHRcdGNvbnN0IHRleHRNb2RlbCA9IGVkaXRvcldpZGdldC5nZXRNb2RlbCgpO1xuXHRcdFx0aWYgKHRleHRNb2RlbCkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHNlbGVjdGlvbiBvZiBpbmZvLnNlbGVjdGlvbnMpIHtcblx0XHRcdFx0XHRpZiAodHlwZW9mIGluZm8uY2hhcmFjdGVyc1NlbGVjdGVkICE9PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdFx0aW5mby5jaGFyYWN0ZXJzU2VsZWN0ZWQgPSAwO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGluZm8uY2hhcmFjdGVyc1NlbGVjdGVkICs9IHRleHRNb2RlbC5nZXRDaGFyYWN0ZXJDb3VudEluUmFuZ2Uoc2VsZWN0aW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBDb21wdXRlIHRoZSB2aXNpYmxlIGNvbHVtbiBmb3Igb25lIHNlbGVjdGlvbi4gVGhpcyB3aWxsIHByb3Blcmx5IGhhbmRsZSB0YWJzIGFuZCB0aGVpciBjb25maWd1cmVkIHdpZHRoc1xuXHRcdFx0aWYgKGluZm8uc2VsZWN0aW9ucy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0Y29uc3QgZWRpdG9yUG9zaXRpb24gPSBlZGl0b3JXaWRnZXQuZ2V0UG9zaXRpb24oKTtcblxuXHRcdFx0XHRjb25zdCBzZWxlY3Rpb25DbG9uZSA9IG5ldyBTZWxlY3Rpb24oXG5cdFx0XHRcdFx0aW5mby5zZWxlY3Rpb25zWzBdLnNlbGVjdGlvblN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0XHRpbmZvLnNlbGVjdGlvbnNbMF0uc2VsZWN0aW9uU3RhcnRDb2x1bW4sXG5cdFx0XHRcdFx0aW5mby5zZWxlY3Rpb25zWzBdLnBvc2l0aW9uTGluZU51bWJlcixcblx0XHRcdFx0XHRlZGl0b3JQb3NpdGlvbiA/IGVkaXRvcldpZGdldC5nZXRTdGF0dXNiYXJDb2x1bW4oZWRpdG9yUG9zaXRpb24pIDogaW5mby5zZWxlY3Rpb25zWzBdLnBvc2l0aW9uQ29sdW1uXG5cdFx0XHRcdCk7XG5cblx0XHRcdFx0aW5mby5zZWxlY3Rpb25zWzBdID0gc2VsZWN0aW9uQ2xvbmU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy51cGRhdGVTdGF0ZSh7IHR5cGU6ICdzZWxlY3Rpb25TdGF0dXMnLCBzZWxlY3Rpb25TdGF0dXM6IHRoaXMuZ2V0U2VsZWN0aW9uTGFiZWwoaW5mbykgfSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRU9MQ2hhbmdlKGVkaXRvcldpZGdldDogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCBpbmZvOiBTdGF0ZURlbHRhID0geyB0eXBlOiAnRU9MJywgRU9MOiB1bmRlZmluZWQgfTtcblxuXHRcdGlmIChlZGl0b3JXaWRnZXQgJiYgIWVkaXRvcldpZGdldC5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnJlYWRPbmx5KSkge1xuXHRcdFx0Y29uc3QgY29kZUVkaXRvck1vZGVsID0gZWRpdG9yV2lkZ2V0LmdldE1vZGVsKCk7XG5cdFx0XHRpZiAoY29kZUVkaXRvck1vZGVsKSB7XG5cdFx0XHRcdGluZm8uRU9MID0gY29kZUVkaXRvck1vZGVsLmdldEVPTCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlU3RhdGUoaW5mbyk7XG5cdH1cblxuXHRwcml2YXRlIG9uRW5jb2RpbmdDaGFuZ2UoZWRpdG9yOiBJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZCwgZWRpdG9yV2lkZ2V0OiBJQ29kZUVkaXRvciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmIChlZGl0b3IgJiYgIXRoaXMuaXNBY3RpdmVFZGl0b3IoZWRpdG9yKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluZm86IFN0YXRlRGVsdGEgPSB7IHR5cGU6ICdlbmNvZGluZycsIGVuY29kaW5nOiB1bmRlZmluZWQgfTtcblxuXHRcdC8vIFdlIG9ubHkgc3VwcG9ydCB0ZXh0IGJhc2VkIGVkaXRvcnMgdGhhdCBoYXZlIGEgbW9kZWwgYXNzb2NpYXRlZFxuXHRcdC8vIFRoaXMgZW5zdXJlcyB3ZSBkbyBub3Qgc2hvdyB0aGUgZW5jb2RpbmcgcGlja2VyIHdoaWxlIGFuIGVkaXRvclxuXHRcdC8vIGlzIHN0aWxsIGxvYWRpbmcuXG5cdFx0aWYgKGVkaXRvciAmJiBlZGl0b3JXaWRnZXQ/Lmhhc01vZGVsKCkpIHtcblx0XHRcdGNvbnN0IGVuY29kaW5nU3VwcG9ydDogSUVuY29kaW5nU3VwcG9ydCB8IG51bGwgPSBlZGl0b3IuaW5wdXQgPyB0b0VkaXRvcldpdGhFbmNvZGluZ1N1cHBvcnQoZWRpdG9yLmlucHV0KSA6IG51bGw7XG5cdFx0XHRpZiAoZW5jb2RpbmdTdXBwb3J0KSB7XG5cdFx0XHRcdGNvbnN0IHJhd0VuY29kaW5nID0gZW5jb2RpbmdTdXBwb3J0LmdldEVuY29kaW5nKCk7XG5cdFx0XHRcdGNvbnN0IGVuY29kaW5nSW5mbyA9IHR5cGVvZiByYXdFbmNvZGluZyA9PT0gJ3N0cmluZycgPyBTVVBQT1JURURfRU5DT0RJTkdTW3Jhd0VuY29kaW5nXSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0aWYgKGVuY29kaW5nSW5mbykge1xuXHRcdFx0XHRcdGluZm8uZW5jb2RpbmcgPSBlbmNvZGluZ0luZm8ubGFiZWxTaG9ydDsgLy8gaWYgd2UgaGF2ZSBhIGxhYmVsLCB0YWtlIGl0IGZyb20gdGhlcmVcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpbmZvLmVuY29kaW5nID0gcmF3RW5jb2Rpbmc7IC8vIG90aGVyd2lzZSB1c2UgaXQgcmF3XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZVN0YXRlKGluZm8pO1xuXHR9XG5cblx0cHJpdmF0ZSBvblJlc291cmNlRW5jb2RpbmdDaGFuZ2UocmVzb3VyY2U6IFVSSSk6IHZvaWQge1xuXHRcdGNvbnN0IGFjdGl2ZUVkaXRvclBhbmUgPSB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRpZiAoYWN0aXZlRWRpdG9yUGFuZSkge1xuXHRcdFx0Y29uc3QgYWN0aXZlUmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldENhbm9uaWNhbFVyaShhY3RpdmVFZGl0b3JQYW5lLmlucHV0LCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSk7XG5cdFx0XHRpZiAoYWN0aXZlUmVzb3VyY2UgJiYgaXNFcXVhbChhY3RpdmVSZXNvdXJjZSwgcmVzb3VyY2UpKSB7XG5cdFx0XHRcdGNvbnN0IGFjdGl2ZUNvZGVFZGl0b3IgPSBnZXRDb2RlRWRpdG9yKGFjdGl2ZUVkaXRvclBhbmUuZ2V0Q29udHJvbCgpKSA/PyB1bmRlZmluZWQ7XG5cblx0XHRcdFx0cmV0dXJuIHRoaXMub25FbmNvZGluZ0NoYW5nZShhY3RpdmVFZGl0b3JQYW5lLCBhY3RpdmVDb2RlRWRpdG9yKTsgLy8gb25seSB1cGRhdGUgaWYgdGhlIGVuY29kaW5nIGNoYW5nZWQgZm9yIHRoZSBhY3RpdmUgcmVzb3VyY2Vcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uVGFiRm9jdXNNb2RlQ2hhbmdlKHRhYkZvY3VzTW9kZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IGluZm86IFN0YXRlRGVsdGEgPSB7IHR5cGU6ICd0YWJGb2N1c01vZGUnLCB0YWJGb2N1c01vZGUgfTtcblx0XHR0aGlzLnVwZGF0ZVN0YXRlKGluZm8pO1xuXHR9XG5cblx0cHJpdmF0ZSBvbklucHV0TW9kZUNoYW5nZShpbnB1dE1vZGU6ICdpbnNlcnQnIHwgJ292ZXJ0eXBlJyk6IHZvaWQge1xuXHRcdGNvbnN0IGluZm86IFN0YXRlRGVsdGEgPSB7IHR5cGU6ICdpbnB1dE1vZGUnLCBpbnB1dE1vZGUgfTtcblx0XHR0aGlzLnVwZGF0ZVN0YXRlKGluZm8pO1xuXHR9XG5cblx0cHJpdmF0ZSBpc0FjdGl2ZUVkaXRvcihjb250cm9sOiBJRWRpdG9yUGFuZSk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGFjdGl2ZUVkaXRvclBhbmUgPSB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZTtcblxuXHRcdHJldHVybiAhIWFjdGl2ZUVkaXRvclBhbmUgJiYgYWN0aXZlRWRpdG9yUGFuZSA9PT0gY29udHJvbDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRWRpdG9yU3RhdHVzQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5lZGl0b3JTdGF0dXMnO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRmb3IgKGNvbnN0IHBhcnQgb2YgZWRpdG9yR3JvdXBTZXJ2aWNlLnBhcnRzKSB7XG5cdFx0XHR0aGlzLmNyZWF0ZUVkaXRvclN0YXR1cyhwYXJ0KTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3JHcm91cFNlcnZpY2Uub25EaWRDcmVhdGVBdXhpbGlhcnlFZGl0b3JQYXJ0KHBhcnQgPT4gdGhpcy5jcmVhdGVFZGl0b3JTdGF0dXMocGFydCkpKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlRWRpdG9yU3RhdHVzKHBhcnQ6IElFZGl0b3JQYXJ0KTogdm9pZCB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0RXZlbnQub25jZShwYXJ0Lm9uV2lsbERpc3Bvc2UpKCgpID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKSk7XG5cblx0XHRjb25zdCBzY29wZWRJbnN0YW50aWF0aW9uU2VydmljZSA9IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmdldFNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlKHBhcnQpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChzY29wZWRJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFZGl0b3JTdGF0dXMsIHBhcnQud2luZG93SWQpKTtcblx0fVxufVxuXG5jbGFzcyBTaG93Q3VycmVudE1hcmtlckluU3RhdHVzYmFyQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBzdGF0dXNCYXJFbnRyeUFjY2Vzc29yOiBNdXRhYmxlRGlzcG9zYWJsZTxJU3RhdHVzYmFyRW50cnlBY2Nlc3Nvcj47XG5cdHByaXZhdGUgZWRpdG9yOiBJQ29kZUVkaXRvciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBtYXJrZXJzOiBJTWFya2VyW10gPSBbXTtcblx0cHJpdmF0ZSBjdXJyZW50TWFya2VyOiBJTWFya2VyIHwgbnVsbCA9IG51bGw7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElTdGF0dXNiYXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RhdHVzYmFyU2VydmljZTogSVN0YXR1c2JhclNlcnZpY2UsXG5cdFx0QElNYXJrZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWFya2VyU2VydmljZTogSU1hcmtlclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnN0YXR1c0JhckVudHJ5QWNjZXNzb3IgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8SVN0YXR1c2JhckVudHJ5QWNjZXNzb3I+KCkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIobWFya2VyU2VydmljZS5vbk1hcmtlckNoYW5nZWQoY2hhbmdlZFJlc291cmNlcyA9PiB0aGlzLm9uTWFya2VyQ2hhbmdlZChjaGFuZ2VkUmVzb3VyY2VzKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZpbHRlcihjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24sIGUgPT4gZS5hZmZlY3RzQ29uZmlndXJhdGlvbigncHJvYmxlbXMuc2hvd0N1cnJlbnRJblN0YXR1cycpKSgoKSA9PiB0aGlzLnVwZGF0ZVN0YXR1cygpKSk7XG5cdH1cblxuXHR1cGRhdGUoZWRpdG9yOiBJQ29kZUVkaXRvciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuZWRpdG9yID0gZWRpdG9yO1xuXG5cdFx0dGhpcy51cGRhdGVNYXJrZXJzKCk7XG5cdFx0dGhpcy51cGRhdGVTdGF0dXMoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlU3RhdHVzKCk6IHZvaWQge1xuXHRcdGNvbnN0IHByZXZpb3VzTWFya2VyID0gdGhpcy5jdXJyZW50TWFya2VyO1xuXHRcdHRoaXMuY3VycmVudE1hcmtlciA9IHRoaXMuZ2V0TWFya2VyKCk7XG5cdFx0aWYgKHRoaXMuaGFzVG9VcGRhdGVTdGF0dXMocHJldmlvdXNNYXJrZXIsIHRoaXMuY3VycmVudE1hcmtlcikpIHtcblx0XHRcdGlmICh0aGlzLmN1cnJlbnRNYXJrZXIpIHtcblx0XHRcdFx0Y29uc3QgbGluZSA9IHNwbGl0TGluZXModGhpcy5jdXJyZW50TWFya2VyLm1lc3NhZ2UpWzBdO1xuXHRcdFx0XHRjb25zdCB0ZXh0ID0gYCR7dGhpcy5nZXRUeXBlKHRoaXMuY3VycmVudE1hcmtlcil9ICR7bGluZX1gO1xuXHRcdFx0XHRpZiAoIXRoaXMuc3RhdHVzQmFyRW50cnlBY2Nlc3Nvci52YWx1ZSkge1xuXHRcdFx0XHRcdHRoaXMuc3RhdHVzQmFyRW50cnlBY2Nlc3Nvci52YWx1ZSA9IHRoaXMuc3RhdHVzYmFyU2VydmljZS5hZGRFbnRyeSh7IG5hbWU6IGxvY2FsaXplKCdjdXJyZW50UHJvYmxlbScsIFwiQ3VycmVudCBQcm9ibGVtXCIpLCB0ZXh0LCBhcmlhTGFiZWw6IHRleHQgfSwgJ3N0YXR1c2Jhci5jdXJyZW50UHJvYmxlbScsIFN0YXR1c2JhckFsaWdubWVudC5MRUZUKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnN0YXR1c0JhckVudHJ5QWNjZXNzb3IudmFsdWUudXBkYXRlKHsgbmFtZTogbG9jYWxpemUoJ2N1cnJlbnRQcm9ibGVtJywgXCJDdXJyZW50IFByb2JsZW1cIiksIHRleHQsIGFyaWFMYWJlbDogdGV4dCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5zdGF0dXNCYXJFbnRyeUFjY2Vzc29yLmNsZWFyKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBoYXNUb1VwZGF0ZVN0YXR1cyhwcmV2aW91c01hcmtlcjogSU1hcmtlciB8IG51bGwsIGN1cnJlbnRNYXJrZXI6IElNYXJrZXIgfCBudWxsKTogYm9vbGVhbiB7XG5cdFx0aWYgKCFjdXJyZW50TWFya2VyKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAoIXByZXZpb3VzTWFya2VyKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gSU1hcmtlckRhdGEubWFrZUtleShwcmV2aW91c01hcmtlcikgIT09IElNYXJrZXJEYXRhLm1ha2VLZXkoY3VycmVudE1hcmtlcik7XG5cdH1cblxuXHRwcml2YXRlIGdldFR5cGUobWFya2VyOiBJTWFya2VyKTogc3RyaW5nIHtcblx0XHRzd2l0Y2ggKG1hcmtlci5zZXZlcml0eSkge1xuXHRcdFx0Y2FzZSBNYXJrZXJTZXZlcml0eS5FcnJvcjogcmV0dXJuICckKGVycm9yKSc7XG5cdFx0XHRjYXNlIE1hcmtlclNldmVyaXR5Lldhcm5pbmc6IHJldHVybiAnJCh3YXJuaW5nKSc7XG5cdFx0XHRjYXNlIE1hcmtlclNldmVyaXR5LkluZm86IHJldHVybiAnJChpbmZvKSc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRNYXJrZXIoKTogSU1hcmtlciB8IG51bGwge1xuXHRcdGlmICghdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPigncHJvYmxlbXMuc2hvd0N1cnJlbnRJblN0YXR1cycpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuZWRpdG9yKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLmVkaXRvci5nZXRQb3NpdGlvbigpO1xuXHRcdGlmICghcG9zaXRpb24pIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLm1hcmtlcnMuZmluZChtYXJrZXIgPT4gUmFuZ2UuY29udGFpbnNQb3NpdGlvbihtYXJrZXIsIHBvc2l0aW9uKSkgfHwgbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgb25NYXJrZXJDaGFuZ2VkKGNoYW5nZWRSZXNvdXJjZXM6IHJlYWRvbmx5IFVSSVtdKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKG1vZGVsICYmICFjaGFuZ2VkUmVzb3VyY2VzLnNvbWUociA9PiBpc0VxdWFsKG1vZGVsLnVyaSwgcikpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy51cGRhdGVNYXJrZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZU1hcmtlcnMoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKG1vZGVsKSB7XG5cdFx0XHR0aGlzLm1hcmtlcnMgPSB0aGlzLm1hcmtlclNlcnZpY2UucmVhZCh7XG5cdFx0XHRcdHJlc291cmNlOiBtb2RlbC51cmksXG5cdFx0XHRcdHNldmVyaXRpZXM6IE1hcmtlclNldmVyaXR5LkVycm9yIHwgTWFya2VyU2V2ZXJpdHkuV2FybmluZyB8IE1hcmtlclNldmVyaXR5LkluZm9cblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5tYXJrZXJzLnNvcnQodGhpcy5jb21wYXJlTWFya2VyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5tYXJrZXJzID0gW107XG5cdFx0fVxuXG5cdFx0dGhpcy51cGRhdGVTdGF0dXMoKTtcblx0fVxuXG5cdHByaXZhdGUgY29tcGFyZU1hcmtlcihhOiBJTWFya2VyLCBiOiBJTWFya2VyKTogbnVtYmVyIHtcblx0XHRsZXQgcmVzID0gY29tcGFyZShhLnJlc291cmNlLnRvU3RyaW5nKCksIGIucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0aWYgKHJlcyA9PT0gMCkge1xuXHRcdFx0cmVzID0gTWFya2VyU2V2ZXJpdHkuY29tcGFyZShhLnNldmVyaXR5LCBiLnNldmVyaXR5KTtcblx0XHR9XG5cblx0XHRpZiAocmVzID09PSAwKSB7XG5cdFx0XHRyZXMgPSBSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMoYSwgYik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlcztcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2hvd0xhbmd1YWdlRXh0ZW5zaW9uc0FjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uc2hvd0xhbmd1YWdlRXh0ZW5zaW9ucyc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBmaWxlRXh0ZW5zaW9uOiBzdHJpbmcsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSBnYWxsZXJ5U2VydmljZTogSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKFNob3dMYW5ndWFnZUV4dGVuc2lvbnNBY3Rpb24uSUQsIGxvY2FsaXplKCdzaG93TGFuZ3VhZ2VFeHRlbnNpb25zJywgXCJTZWFyY2ggTWFya2V0cGxhY2UgRXh0ZW5zaW9ucyBmb3IgJ3swfScuLi5cIiwgZmlsZUV4dGVuc2lvbikpO1xuXG5cdFx0dGhpcy5lbmFibGVkID0gZ2FsbGVyeVNlcnZpY2UuaXNFbmFibGVkKCk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnNob3dFeHRlbnNpb25zRm9yTGFuZ3VhZ2UnLCB0aGlzLmZpbGVFeHRlbnNpb24pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGFuZ2VMYW5ndWFnZUFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmVkaXRvci5jaGFuZ2VMYW5ndWFnZU1vZGUnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDaGFuZ2VMYW5ndWFnZUFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2NoYW5nZU1vZGUnLCAnQ2hhbmdlIExhbmd1YWdlIE1vZGUnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleUNvZGUuS2V5TSlcblx0XHRcdH0sXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLm5vdCgnbm90ZWJvb2tFZGl0b3JGb2N1c2VkJyksXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NoYW5nZUxhbmd1YWdlTW9kZS5kZXNjcmlwdGlvbicsIFwiQ2hhbmdlIHRoZSBsYW5ndWFnZSBtb2RlIG9mIHRoZSBhY3RpdmUgdGV4dCBlZGl0b3IuXCIpLFxuXHRcdFx0XHRhcmdzOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmFtZTogbG9jYWxpemUoJ2NoYW5nZUxhbmd1YWdlTW9kZS5hcmcubmFtZScsIFwiVGhlIG5hbWUgb2YgdGhlIGxhbmd1YWdlIG1vZGUgdG8gY2hhbmdlIHRvLlwiKSxcblx0XHRcdFx0XHRcdGNvbnN0cmFpbnQ6ICh2YWx1ZTogYW55KSA9PiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBsYW5ndWFnZU1vZGU/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKTtcblx0XHRjb25zdCBsYW5ndWFnZURldGVjdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlRGV0ZWN0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgdGV4dEZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUZXh0RmlsZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHByZWZlcmVuY2VzU2VydmljZSA9IGFjY2Vzc29yLmdldChJUHJlZmVyZW5jZXNTZXJ2aWNlKTtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgdGVsZW1ldHJ5U2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVsZW1ldHJ5U2VydmljZSk7XG5cblx0XHRjb25zdCBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbCA9IGdldENvZGVFZGl0b3IoZWRpdG9yU2VydmljZS5hY3RpdmVUZXh0RWRpdG9yQ29udHJvbCk7XG5cdFx0aWYgKCFhY3RpdmVUZXh0RWRpdG9yQ29udHJvbCkge1xuXHRcdFx0YXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhbeyBsYWJlbDogbG9jYWxpemUoJ25vRWRpdG9yJywgXCJObyB0ZXh0IGVkaXRvciBhY3RpdmUgYXQgdGhpcyB0aW1lXCIpIH1dKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB0ZXh0TW9kZWwgPSBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbC5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IHJlc291cmNlID0gRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRPcmlnaW5hbFVyaShlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pO1xuXG5cdFx0Ly8gQ29tcHV0ZSBsYW5ndWFnZVxuXHRcdGxldCBjdXJyZW50TGFuZ3VhZ2VOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGN1cnJlbnRMYW5ndWFnZUlkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHRleHRNb2RlbCkge1xuXHRcdFx0Y3VycmVudExhbmd1YWdlSWQgPSB0ZXh0TW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpO1xuXHRcdFx0Y3VycmVudExhbmd1YWdlTmFtZSA9IGxhbmd1YWdlU2VydmljZS5nZXRMYW5ndWFnZU5hbWUoY3VycmVudExhbmd1YWdlSWQpID8/IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRsZXQgaGFzTGFuZ3VhZ2VTdXBwb3J0ID0gISFyZXNvdXJjZTtcblx0XHRpZiAocmVzb3VyY2U/LnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZCAmJiAhdGV4dEZpbGVTZXJ2aWNlLnVudGl0bGVkLmdldChyZXNvdXJjZSk/Lmhhc0Fzc29jaWF0ZWRGaWxlUGF0aCkge1xuXHRcdFx0aGFzTGFuZ3VhZ2VTdXBwb3J0ID0gZmFsc2U7IC8vIG5vIGNvbmZpZ3VyYXRpb24gZm9yIHVudGl0bGVkIHJlc291cmNlcyAoZS5nLiBcIlVudGl0bGVkLTFcIilcblx0XHR9XG5cblx0XHQvLyBBbGwgbGFuZ3VhZ2VzIGFyZSB2YWxpZCBwaWNrc1xuXHRcdGNvbnN0IGxhbmd1YWdlcyA9IGxhbmd1YWdlU2VydmljZS5nZXRTb3J0ZWRSZWdpc3RlcmVkTGFuZ3VhZ2VOYW1lcygpO1xuXHRcdGNvbnN0IHBpY2tzOiBRdWlja1BpY2tJbnB1dFtdID0gbGFuZ3VhZ2VzXG5cdFx0XHQubWFwKCh7IGxhbmd1YWdlTmFtZSwgbGFuZ3VhZ2VJZCB9KSA9PiB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbnMgPSBsYW5ndWFnZVNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhsYW5ndWFnZUlkKS5qb2luKCcgJyk7XG5cdFx0XHRcdGxldCBkZXNjcmlwdGlvbjogc3RyaW5nO1xuXHRcdFx0XHRpZiAoY3VycmVudExhbmd1YWdlTmFtZSA9PT0gbGFuZ3VhZ2VOYW1lKSB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb24gPSBsb2NhbGl6ZSgnbGFuZ3VhZ2VEZXNjcmlwdGlvbicsIFwiKHswfSkgLSBDb25maWd1cmVkIExhbmd1YWdlXCIsIGxhbmd1YWdlSWQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uID0gbG9jYWxpemUoJ2xhbmd1YWdlRGVzY3JpcHRpb25Db25maWd1cmVkJywgXCIoezB9KVwiLCBsYW5ndWFnZUlkKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bGFiZWw6IGxhbmd1YWdlTmFtZSxcblx0XHRcdFx0XHRtZXRhOiBleHRlbnNpb25zLFxuXHRcdFx0XHRcdGljb25DbGFzc2VzOiBnZXRJY29uQ2xhc3Nlc0Zvckxhbmd1YWdlSWQobGFuZ3VhZ2VJZCksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb25cblx0XHRcdFx0fTtcblx0XHRcdH0pO1xuXG5cdFx0cGlja3MudW5zaGlmdCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbG9jYWxpemUoJ2xhbmd1YWdlc1BpY2tzJywgXCJsYW5ndWFnZXMgKGlkZW50aWZpZXIpXCIpIH0pO1xuXG5cdFx0Ly8gT2ZmZXIgYWN0aW9uIHRvIGNvbmZpZ3VyZSB2aWEgc2V0dGluZ3Ncblx0XHRsZXQgY29uZmlndXJlTGFuZ3VhZ2VBc3NvY2lhdGlvbnM6IElRdWlja1BpY2tJdGVtIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBjb25maWd1cmVMYW5ndWFnZVNldHRpbmdzOiBJUXVpY2tQaWNrSXRlbSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgZ2FsbGVyeUFjdGlvbjogQWN0aW9uIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChoYXNMYW5ndWFnZVN1cHBvcnQgJiYgcmVzb3VyY2UpIHtcblx0XHRcdGNvbnN0IGV4dCA9IGV4dG5hbWUocmVzb3VyY2UpIHx8IGJhc2VuYW1lKHJlc291cmNlKTtcblxuXHRcdFx0Z2FsbGVyeUFjdGlvbiA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNob3dMYW5ndWFnZUV4dGVuc2lvbnNBY3Rpb24sIGV4dCk7XG5cdFx0XHRpZiAoZ2FsbGVyeUFjdGlvbi5lbmFibGVkKSB7XG5cdFx0XHRcdHBpY2tzLnVuc2hpZnQoZ2FsbGVyeUFjdGlvbik7XG5cdFx0XHR9XG5cblx0XHRcdGNvbmZpZ3VyZUxhbmd1YWdlU2V0dGluZ3MgPSB7IGxhYmVsOiBsb2NhbGl6ZSgnY29uZmlndXJlTW9kZVNldHRpbmdzJywgXCJDb25maWd1cmUgJ3swfScgbGFuZ3VhZ2UgYmFzZWQgc2V0dGluZ3MuLi5cIiwgY3VycmVudExhbmd1YWdlTmFtZSkgfTtcblx0XHRcdHBpY2tzLnVuc2hpZnQoY29uZmlndXJlTGFuZ3VhZ2VTZXR0aW5ncyk7XG5cdFx0XHRjb25maWd1cmVMYW5ndWFnZUFzc29jaWF0aW9ucyA9IHsgbGFiZWw6IGxvY2FsaXplKCdjb25maWd1cmVBc3NvY2lhdGlvbnNFeHQnLCBcIkNvbmZpZ3VyZSBGaWxlIEFzc29jaWF0aW9uIGZvciAnezB9Jy4uLlwiLCBleHQpIH07XG5cdFx0XHRwaWNrcy51bnNoaWZ0KGNvbmZpZ3VyZUxhbmd1YWdlQXNzb2NpYXRpb25zKTtcblx0XHR9XG5cblx0XHQvLyBPZmZlciB0byBcIkF1dG8gRGV0ZWN0XCJcblx0XHRjb25zdCBhdXRvRGV0ZWN0TGFuZ3VhZ2U6IElRdWlja1BpY2tJdGVtID0ge1xuXHRcdFx0bGFiZWw6IGxvY2FsaXplKCdhdXRvRGV0ZWN0JywgXCJBdXRvIERldGVjdFwiKVxuXHRcdH07XG5cdFx0cGlja3MudW5zaGlmdChhdXRvRGV0ZWN0TGFuZ3VhZ2UpO1xuXG5cdFx0Y29uc3QgcGljayA9IHR5cGVvZiBsYW5ndWFnZU1vZGUgPT09ICdzdHJpbmcnID8geyBsYWJlbDogbGFuZ3VhZ2VNb2RlIH0gOiBhd2FpdCBxdWlja0lucHV0U2VydmljZS5waWNrKHBpY2tzLCB7IHBsYWNlSG9sZGVyOiBsb2NhbGl6ZSgncGlja0xhbmd1YWdlJywgXCJTZWxlY3QgTGFuZ3VhZ2UgTW9kZVwiKSwgbWF0Y2hPbkRlc2NyaXB0aW9uOiB0cnVlIH0pO1xuXHRcdGlmICghcGljaykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChwaWNrID09PSBnYWxsZXJ5QWN0aW9uKSB7XG5cdFx0XHRnYWxsZXJ5QWN0aW9uLnJ1bigpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFVzZXIgZGVjaWRlZCB0byBwZXJtYW5lbnRseSBjb25maWd1cmUgYXNzb2NpYXRpb25zLCByZXR1cm4gcmlnaHQgYWZ0ZXJcblx0XHRpZiAocGljayA9PT0gY29uZmlndXJlTGFuZ3VhZ2VBc3NvY2lhdGlvbnMpIHtcblx0XHRcdGlmIChyZXNvdXJjZSkge1xuXHRcdFx0XHR0aGlzLmNvbmZpZ3VyZUZpbGVBc3NvY2lhdGlvbihyZXNvdXJjZSwgbGFuZ3VhZ2VTZXJ2aWNlLCBxdWlja0lucHV0U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFVzZXIgZGVjaWRlZCB0byBjb25maWd1cmUgc2V0dGluZ3MgZm9yIGN1cnJlbnQgbGFuZ3VhZ2Vcblx0XHRpZiAocGljayA9PT0gY29uZmlndXJlTGFuZ3VhZ2VTZXR0aW5ncykge1xuXHRcdFx0cHJlZmVyZW5jZXNTZXJ2aWNlLm9wZW5Vc2VyU2V0dGluZ3MoeyBqc29uRWRpdG9yOiB0cnVlLCByZXZlYWxTZXR0aW5nOiB7IGtleTogYFske2N1cnJlbnRMYW5ndWFnZUlkID8/IG51bGx9XWAsIGVkaXQ6IHRydWUgfSB9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBDaGFuZ2UgbGFuZ3VhZ2UgZm9yIGFjdGl2ZSBlZGl0b3Jcblx0XHRjb25zdCBhY3RpdmVFZGl0b3IgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvcjtcblx0XHRpZiAoYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRjb25zdCBsYW5ndWFnZVN1cHBvcnQgPSB0b0VkaXRvcldpdGhMYW5ndWFnZVN1cHBvcnQoYWN0aXZlRWRpdG9yKTtcblx0XHRcdGlmIChsYW5ndWFnZVN1cHBvcnQpIHtcblxuXHRcdFx0XHQvLyBGaW5kIGxhbmd1YWdlXG5cdFx0XHRcdGxldCBsYW5ndWFnZVNlbGVjdGlvbjogSUxhbmd1YWdlU2VsZWN0aW9uIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRsZXQgZGV0ZWN0ZWRMYW5ndWFnZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAocGljayA9PT0gYXV0b0RldGVjdExhbmd1YWdlKSB7XG5cdFx0XHRcdFx0aWYgKHRleHRNb2RlbCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgcmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGFjdGl2ZUVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pO1xuXHRcdFx0XHRcdFx0aWYgKHJlc291cmNlKSB7XG5cdFx0XHRcdFx0XHRcdC8vIERldGVjdCBsYW5ndWFnZXMgc2luY2Ugd2UgYXJlIGluIGFuIHVudGl0bGVkIGZpbGVcblx0XHRcdFx0XHRcdFx0bGV0IGxhbmd1YWdlSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IGxhbmd1YWdlU2VydmljZS5ndWVzc0xhbmd1YWdlSWRCeUZpbGVwYXRoT3JGaXJzdExpbmUocmVzb3VyY2UsIHRleHRNb2RlbC5nZXRMaW5lQ29udGVudCgxKSkgPz8gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0XHRpZiAoIWxhbmd1YWdlSWQgfHwgbGFuZ3VhZ2VJZCA9PT0gJ3Vua25vd24nKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZGV0ZWN0ZWRMYW5ndWFnZSA9IGF3YWl0IGxhbmd1YWdlRGV0ZWN0aW9uU2VydmljZS5kZXRlY3RMYW5ndWFnZShyZXNvdXJjZSk7XG5cdFx0XHRcdFx0XHRcdFx0bGFuZ3VhZ2VJZCA9IGRldGVjdGVkTGFuZ3VhZ2U7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKGxhbmd1YWdlSWQpIHtcblx0XHRcdFx0XHRcdFx0XHRsYW5ndWFnZVNlbGVjdGlvbiA9IGxhbmd1YWdlU2VydmljZS5jcmVhdGVCeUlkKGxhbmd1YWdlSWQpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGxhbmd1YWdlSWQgPSBsYW5ndWFnZVNlcnZpY2UuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKHBpY2subGFiZWwpO1xuXHRcdFx0XHRcdGxhbmd1YWdlU2VsZWN0aW9uID0gbGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5SWQobGFuZ3VhZ2VJZCk7XG5cblx0XHRcdFx0XHRpZiAocmVzb3VyY2UpIHtcblx0XHRcdFx0XHRcdC8vIGZpcmUgYW5kIGZvcmdldCB0byBub3Qgc2xvdyB0aGluZ3MgZG93blxuXHRcdFx0XHRcdFx0bGFuZ3VhZ2VEZXRlY3Rpb25TZXJ2aWNlLmRldGVjdExhbmd1YWdlKHJlc291cmNlKS50aGVuKGRldGVjdGVkTGFuZ3VhZ2VJZCA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNob3Nlbkxhbmd1YWdlSWQgPSBsYW5ndWFnZVNlcnZpY2UuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKHBpY2subGFiZWwpIHx8ICd1bmtub3duJztcblx0XHRcdFx0XHRcdFx0aWYgKGRldGVjdGVkTGFuZ3VhZ2VJZCA9PT0gY3VycmVudExhbmd1YWdlSWQgJiYgY3VycmVudExhbmd1YWdlSWQgIT09IGNob3Nlbkxhbmd1YWdlSWQpIHtcblx0XHRcdFx0XHRcdFx0XHQvLyBJZiB0aGV5IGRpZG4ndCBjaG9vc2UgdGhlIGRldGVjdGVkIGxhbmd1YWdlICh3aGljaCBzaG91bGQgYWxzbyBiZSB0aGUgYWN0aXZlIGxhbmd1YWdlIGlmIGF1dG9tYXRpYyBkZXRlY3Rpb24gaXMgZW5hYmxlZClcblx0XHRcdFx0XHRcdFx0XHQvLyB0aGVuIHRoZSBhdXRvbWF0aWMgbGFuZ3VhZ2UgZGV0ZWN0aW9uIHdhcyBsaWtlbHkgd3JvbmcgYW5kIHRoZSB1c2VyIGlzIGNvcnJlY3RpbmcgaXQuIEluIHRoaXMgY2FzZSwgd2Ugd2FudCB0ZWxlbWV0cnkuXG5cdFx0XHRcdFx0XHRcdFx0Ly8gS2VlcCB0cmFjayBvZiB3aGF0IG1vZGVsIHdhcyBwcmVmZXJyZWQgYW5kIGxlbmd0aCBvZiBpbnB1dCB0byBoZWxwIHRyYWNrIGRvd24gcG90ZW50aWFsIGRpZmZlcmVuY2VzIGJldHdlZW4gdGhlIHJlc3VsdCBxdWFsaXR5IGFjcm9zcyBtb2RlbHMgYW5kIGNvbnRlbnQgc2l6ZS5cblx0XHRcdFx0XHRcdFx0XHRjb25zdCBtb2RlbFByZWZlcmVuY2UgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignd29ya2JlbmNoLmVkaXRvci5wcmVmZXJIaXN0b3J5QmFzZWRMYW5ndWFnZURldGVjdGlvbicpID8gJ2hpc3RvcnknIDogJ2NsYXNzaWMnO1xuXHRcdFx0XHRcdFx0XHRcdHRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxJQXV0b21hdGljTGFuZ3VhZ2VEZXRlY3Rpb25MaWtlbHlXcm9uZ0RhdGEsIEF1dG9tYXRpY0xhbmd1YWdlRGV0ZWN0aW9uTGlrZWx5V3JvbmdDbGFzc2lmaWNhdGlvbj4oQXV0b21hdGljTGFuZ3VhZ2VEZXRlY3Rpb25MaWtlbHlXcm9uZ0lkLCB7XG5cdFx0XHRcdFx0XHRcdFx0XHRjdXJyZW50TGFuZ3VhZ2VJZDogY3VycmVudExhbmd1YWdlTmFtZSA/PyAndW5rbm93bicsXG5cdFx0XHRcdFx0XHRcdFx0XHRuZXh0TGFuZ3VhZ2VJZDogcGljay5sYWJlbCxcblx0XHRcdFx0XHRcdFx0XHRcdGxpbmVDb3VudDogdGV4dE1vZGVsPy5nZXRMaW5lQ291bnQoKSA/PyAtMSxcblx0XHRcdFx0XHRcdFx0XHRcdG1vZGVsUHJlZmVyZW5jZSxcblx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gQ2hhbmdlIGxhbmd1YWdlXG5cdFx0XHRcdGlmICh0eXBlb2YgbGFuZ3VhZ2VTZWxlY3Rpb24gIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRcdFx0bGFuZ3VhZ2VTdXBwb3J0LnNldExhbmd1YWdlSWQobGFuZ3VhZ2VTZWxlY3Rpb24ubGFuZ3VhZ2VJZCwgQ2hhbmdlTGFuZ3VhZ2VBY3Rpb24uSUQpO1xuXG5cdFx0XHRcdFx0aWYgKHJlc291cmNlPy5zY2hlbWUgPT09IFNjaGVtYXMudW50aXRsZWQpIHtcblx0XHRcdFx0XHRcdHR5cGUgU2V0VW50aXRsZWREb2N1bWVudExhbmd1YWdlRXZlbnQgPSB7IHRvOiBzdHJpbmc7IGZyb206IHN0cmluZzsgbW9kZWxQcmVmZXJlbmNlOiBzdHJpbmcgfTtcblx0XHRcdFx0XHRcdHR5cGUgU2V0VW50aXRsZWREb2N1bWVudExhbmd1YWdlQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdFx0XHRcdG93bmVyOiAnVHlsZXJMZW9uaGFyZHQnO1xuXHRcdFx0XHRcdFx0XHRjb21tZW50OiAnSGVscHMgdW5kZXJzdGFuZCB3aGF0IHRoZSBhdXRvbWF0aWMgbGFuZ3VhZ2UgZGV0ZWN0aW9uIGRvZXMgZm9yIHVudGl0bGVkIGZpbGVzJztcblx0XHRcdFx0XHRcdFx0dG86IHtcblx0XHRcdFx0XHRcdFx0XHRjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJztcblx0XHRcdFx0XHRcdFx0XHRwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnO1xuXHRcdFx0XHRcdFx0XHRcdG93bmVyOiAnVHlsZXJMZW9uaGFyZHQnO1xuXHRcdFx0XHRcdFx0XHRcdGNvbW1lbnQ6ICdIZWxwIHVuZGVyc3RhbmQgZWZmZWN0aXZlbmVzcyBvZiBhdXRvbWF0aWMgbGFuZ3VhZ2UgZGV0ZWN0aW9uJztcblx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0ZnJvbToge1xuXHRcdFx0XHRcdFx0XHRcdGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnO1xuXHRcdFx0XHRcdFx0XHRcdHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7XG5cdFx0XHRcdFx0XHRcdFx0b3duZXI6ICdUeWxlckxlb25oYXJkdCc7XG5cdFx0XHRcdFx0XHRcdFx0Y29tbWVudDogJ0hlbHAgdW5kZXJzdGFuZCBlZmZlY3RpdmVuZXNzIG9mIGF1dG9tYXRpYyBsYW5ndWFnZSBkZXRlY3Rpb24nO1xuXHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHRtb2RlbFByZWZlcmVuY2U6IHtcblx0XHRcdFx0XHRcdFx0XHRjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJztcblx0XHRcdFx0XHRcdFx0XHRwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnO1xuXHRcdFx0XHRcdFx0XHRcdG93bmVyOiAnVHlsZXJMZW9uaGFyZHQnO1xuXHRcdFx0XHRcdFx0XHRcdGNvbW1lbnQ6ICdIZWxwIHVuZGVyc3RhbmQgZWZmZWN0aXZlbmVzcyBvZiBhdXRvbWF0aWMgbGFuZ3VhZ2UgZGV0ZWN0aW9uJztcblx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRjb25zdCBtb2RlbFByZWZlcmVuY2UgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignd29ya2JlbmNoLmVkaXRvci5wcmVmZXJIaXN0b3J5QmFzZWRMYW5ndWFnZURldGVjdGlvbicpID8gJ2hpc3RvcnknIDogJ2NsYXNzaWMnO1xuXHRcdFx0XHRcdFx0dGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFNldFVudGl0bGVkRG9jdW1lbnRMYW5ndWFnZUV2ZW50LCBTZXRVbnRpdGxlZERvY3VtZW50TGFuZ3VhZ2VDbGFzc2lmaWNhdGlvbj4oJ3NldFVudGl0bGVkRG9jdW1lbnRMYW5ndWFnZScsIHtcblx0XHRcdFx0XHRcdFx0dG86IGxhbmd1YWdlU2VsZWN0aW9uLmxhbmd1YWdlSWQsXG5cdFx0XHRcdFx0XHRcdGZyb206IGN1cnJlbnRMYW5ndWFnZUlkID8/ICdub25lJyxcblx0XHRcdFx0XHRcdFx0bW9kZWxQcmVmZXJlbmNlLFxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGFjdGl2ZVRleHRFZGl0b3JDb250cm9sLmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjb25maWd1cmVGaWxlQXNzb2NpYXRpb24ocmVzb3VyY2U6IFVSSSwgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLCBxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTogdm9pZCB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uID0gZXh0bmFtZShyZXNvdXJjZSk7XG5cdFx0Y29uc3QgYmFzZSA9IGJhc2VuYW1lKHJlc291cmNlKTtcblx0XHRjb25zdCBjdXJyZW50QXNzb2NpYXRpb24gPSBsYW5ndWFnZVNlcnZpY2UuZ3Vlc3NMYW5ndWFnZUlkQnlGaWxlcGF0aE9yRmlyc3RMaW5lKFVSSS5maWxlKGJhc2UpKTtcblxuXHRcdGNvbnN0IGxhbmd1YWdlcyA9IGxhbmd1YWdlU2VydmljZS5nZXRTb3J0ZWRSZWdpc3RlcmVkTGFuZ3VhZ2VOYW1lcygpO1xuXHRcdGNvbnN0IHBpY2tzOiBJUXVpY2tQaWNrSXRlbVtdID0gbGFuZ3VhZ2VzLm1hcCgoeyBsYW5ndWFnZU5hbWUsIGxhbmd1YWdlSWQgfSkgPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aWQ6IGxhbmd1YWdlSWQsXG5cdFx0XHRcdGxhYmVsOiBsYW5ndWFnZU5hbWUsXG5cdFx0XHRcdGljb25DbGFzc2VzOiBnZXRJY29uQ2xhc3Nlc0Zvckxhbmd1YWdlSWQobGFuZ3VhZ2VJZCksXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAobGFuZ3VhZ2VJZCA9PT0gY3VycmVudEFzc29jaWF0aW9uKSA/IGxvY2FsaXplKCdjdXJyZW50QXNzb2NpYXRpb24nLCBcIkN1cnJlbnQgQXNzb2NpYXRpb25cIikgOiB1bmRlZmluZWRcblx0XHRcdH07XG5cdFx0fSk7XG5cblx0XHRzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGxhbmd1YWdlID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhwaWNrcywgeyBwbGFjZUhvbGRlcjogbG9jYWxpemUoJ3BpY2tMYW5ndWFnZVRvQ29uZmlndXJlJywgXCJTZWxlY3QgTGFuZ3VhZ2UgTW9kZSB0byBBc3NvY2lhdGUgd2l0aCAnezB9J1wiLCBleHRlbnNpb24gfHwgYmFzZSkgfSk7XG5cdFx0XHRpZiAobGFuZ3VhZ2UpIHtcblx0XHRcdFx0Y29uc3QgZmlsZUFzc29jaWF0aW9uc0NvbmZpZyA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmluc3BlY3Q8e30+KEZJTEVTX0FTU09DSUFUSU9OU19DT05GSUcpO1xuXG5cdFx0XHRcdGxldCBhc3NvY2lhdGlvbktleTogc3RyaW5nO1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uICYmIGJhc2VbMF0gIT09ICcuJykge1xuXHRcdFx0XHRcdGFzc29jaWF0aW9uS2V5ID0gYCoke2V4dGVuc2lvbn1gOyAvLyBvbmx5IHVzZSBcIiouZXh0XCIgaWYgdGhlIGZpbGUgcGF0aCBpcyBpbiB0aGUgZm9ybSBvZiA8bmFtZT4uPGV4dD5cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhc3NvY2lhdGlvbktleSA9IGJhc2U7IC8vIG90aGVyd2lzZSB1c2UgdGhlIGJhc2VuYW1lIChlLmcuIC5naXRpZ25vcmUsIERvY2tlcmZpbGUpXG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBJZiB0aGUgYXNzb2NpYXRpb24gaXMgYWxyZWFkeSBiZWluZyBtYWRlIGluIHRoZSB3b3Jrc3BhY2UsIG1ha2Ugc3VyZSB0byB0YXJnZXQgd29ya3NwYWNlIHNldHRpbmdzXG5cdFx0XHRcdGxldCB0YXJnZXQgPSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVI7XG5cdFx0XHRcdGlmIChmaWxlQXNzb2NpYXRpb25zQ29uZmlnLndvcmtzcGFjZVZhbHVlICYmICEhKGZpbGVBc3NvY2lhdGlvbnNDb25maWcud29ya3NwYWNlVmFsdWUgYXMgYW55KVthc3NvY2lhdGlvbktleV0pIHtcblx0XHRcdFx0XHR0YXJnZXQgPSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIE1ha2Ugc3VyZSB0byB3cml0ZSBpbnRvIHRoZSB2YWx1ZSBvZiB0aGUgdGFyZ2V0IGFuZCBub3QgdGhlIG1lcmdlZCB2YWx1ZSBmcm9tIFVTRVIgYW5kIFdPUktTUEFDRSBjb25maWdcblx0XHRcdFx0Y29uc3QgY3VycmVudEFzc29jaWF0aW9ucyA9IGRlZXBDbG9uZSgodGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRSkgPyBmaWxlQXNzb2NpYXRpb25zQ29uZmlnLndvcmtzcGFjZVZhbHVlIDogZmlsZUFzc29jaWF0aW9uc0NvbmZpZy51c2VyVmFsdWUpIHx8IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0XHRcdGN1cnJlbnRBc3NvY2lhdGlvbnNbYXNzb2NpYXRpb25LZXldID0gbGFuZ3VhZ2UuaWQ7XG5cblx0XHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoRklMRVNfQVNTT0NJQVRJT05TX0NPTkZJRywgY3VycmVudEFzc29jaWF0aW9ucywgdGFyZ2V0KTtcblx0XHRcdH1cblx0XHR9LCA1MCAvKiBxdWljayBpbnB1dCBpcyBzZW5zaXRpdmUgdG8gYmVpbmcgb3BlbmVkIHNvIHNvb24gYWZ0ZXIgYW5vdGhlciAqLyk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElDaGFuZ2VFT0xFbnRyeSBleHRlbmRzIElRdWlja1BpY2tJdGVtIHtcblx0ZW9sOiBFbmRPZkxpbmVTZXF1ZW5jZTtcbn1cblxuZXhwb3J0IGNsYXNzIENoYW5nZUVPTEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5lZGl0b3IuY2hhbmdlRU9MJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2NoYW5nZUVuZE9mTGluZScsICdDaGFuZ2UgRW5kIG9mIExpbmUgU2VxdWVuY2UnKSxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wgPSBnZXRDb2RlRWRpdG9yKGVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wpO1xuXHRcdGlmICghYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wpIHtcblx0XHRcdGF3YWl0IHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2soW3sgbGFiZWw6IGxvY2FsaXplKCdub0VkaXRvcicsIFwiTm8gdGV4dCBlZGl0b3IgYWN0aXZlIGF0IHRoaXMgdGltZVwiKSB9XSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yPy5pc1JlYWRvbmx5KCkpIHtcblx0XHRcdGF3YWl0IHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2soW3sgbGFiZWw6IGxvY2FsaXplKCdub1dyaXRhYmxlQ29kZUVkaXRvcicsIFwiVGhlIGFjdGl2ZSBjb2RlIGVkaXRvciBpcyByZWFkLW9ubHkuXCIpIH1dKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgdGV4dE1vZGVsID0gYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wuZ2V0TW9kZWwoKTtcblxuXHRcdGNvbnN0IEVPTE9wdGlvbnM6IElDaGFuZ2VFT0xFbnRyeVtdID0gW1xuXHRcdFx0eyBsYWJlbDogbmxzRU9MTEYsIGVvbDogRW5kT2ZMaW5lU2VxdWVuY2UuTEYgfSxcblx0XHRcdHsgbGFiZWw6IG5sc0VPTENSTEYsIGVvbDogRW5kT2ZMaW5lU2VxdWVuY2UuQ1JMRiB9LFxuXHRcdF07XG5cblx0XHRjb25zdCBzZWxlY3RlZEluZGV4ID0gKHRleHRNb2RlbD8uZ2V0RU9MKCkgPT09ICdcXG4nKSA/IDAgOiAxO1xuXG5cdFx0Y29uc3QgZW9sID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhFT0xPcHRpb25zLCB7IHBsYWNlSG9sZGVyOiBsb2NhbGl6ZSgncGlja0VuZE9mTGluZScsIFwiU2VsZWN0IEVuZCBvZiBMaW5lIFNlcXVlbmNlXCIpLCBhY3RpdmVJdGVtOiBFT0xPcHRpb25zW3NlbGVjdGVkSW5kZXhdIH0pO1xuXHRcdGlmIChlb2wpIHtcblx0XHRcdGNvbnN0IGFjdGl2ZUNvZGVFZGl0b3IgPSBnZXRDb2RlRWRpdG9yKGVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wpO1xuXHRcdFx0aWYgKGFjdGl2ZUNvZGVFZGl0b3I/Lmhhc01vZGVsKCkgJiYgIWVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yPy5pc1JlYWRvbmx5KCkpIHtcblx0XHRcdFx0dGV4dE1vZGVsID0gYWN0aXZlQ29kZUVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdFx0XHR0ZXh0TW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdFx0XHR0ZXh0TW9kZWwucHVzaEVPTChlb2wuZW9sKTtcblx0XHRcdFx0dGV4dE1vZGVsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRhY3RpdmVUZXh0RWRpdG9yQ29udHJvbC5mb2N1cygpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGFuZ2VFbmNvZGluZ0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5lZGl0b3IuY2hhbmdlRW5jb2RpbmcnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignY2hhbmdlRW5jb2RpbmcnLCAnQ2hhbmdlIEZpbGUgRW5jb2RpbmcnKSxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0Y29uc3QgdGV4dEZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUZXh0RmlsZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRjb25zdCBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbCA9IGdldENvZGVFZGl0b3IoZWRpdG9yU2VydmljZS5hY3RpdmVUZXh0RWRpdG9yQ29udHJvbCk7XG5cdFx0aWYgKCFhY3RpdmVUZXh0RWRpdG9yQ29udHJvbCkge1xuXHRcdFx0YXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhbeyBsYWJlbDogbG9jYWxpemUoJ25vRWRpdG9yJywgXCJObyB0ZXh0IGVkaXRvciBhY3RpdmUgYXQgdGhpcyB0aW1lXCIpIH1dKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBhY3RpdmVFZGl0b3JQYW5lID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdGlmICghYWN0aXZlRWRpdG9yUGFuZSkge1xuXHRcdFx0YXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhbeyBsYWJlbDogbG9jYWxpemUoJ25vRWRpdG9yJywgXCJObyB0ZXh0IGVkaXRvciBhY3RpdmUgYXQgdGhpcyB0aW1lXCIpIH1dKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlbmNvZGluZ1N1cHBvcnQ6IElFbmNvZGluZ1N1cHBvcnQgfCBudWxsID0gdG9FZGl0b3JXaXRoRW5jb2RpbmdTdXBwb3J0KGFjdGl2ZUVkaXRvclBhbmUuaW5wdXQpO1xuXHRcdGlmICghZW5jb2RpbmdTdXBwb3J0KSB7XG5cdFx0XHRhd2FpdCBxdWlja0lucHV0U2VydmljZS5waWNrKFt7IGxhYmVsOiBsb2NhbGl6ZSgnbm9GaWxlRWRpdG9yJywgXCJObyBmaWxlIGFjdGl2ZSBhdCB0aGlzIHRpbWVcIikgfV0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNhdmVXaXRoRW5jb2RpbmdQaWNrOiBJUXVpY2tQaWNrSXRlbSA9IHsgbGFiZWw6IGxvY2FsaXplKCdzYXZlV2l0aEVuY29kaW5nJywgXCJTYXZlIHdpdGggRW5jb2RpbmdcIikgfTtcblx0XHRjb25zdCByZW9wZW5XaXRoRW5jb2RpbmdQaWNrOiBJUXVpY2tQaWNrSXRlbSA9IHsgbGFiZWw6IGxvY2FsaXplKCdyZW9wZW5XaXRoRW5jb2RpbmcnLCBcIlJlb3BlbiB3aXRoIEVuY29kaW5nXCIpIH07XG5cblx0XHRpZiAoIUxhbmd1YWdlLmlzRGVmYXVsdFZhcmlhbnQoKSkge1xuXHRcdFx0Y29uc3Qgc2F2ZVdpdGhFbmNvZGluZ0FsaWFzID0gJ1NhdmUgd2l0aCBFbmNvZGluZyc7XG5cdFx0XHRpZiAoc2F2ZVdpdGhFbmNvZGluZ0FsaWFzICE9PSBzYXZlV2l0aEVuY29kaW5nUGljay5sYWJlbCkge1xuXHRcdFx0XHRzYXZlV2l0aEVuY29kaW5nUGljay5kZXRhaWwgPSBzYXZlV2l0aEVuY29kaW5nQWxpYXM7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlb3BlbldpdGhFbmNvZGluZ0FsaWFzID0gJ1Jlb3BlbiB3aXRoIEVuY29kaW5nJztcblx0XHRcdGlmIChyZW9wZW5XaXRoRW5jb2RpbmdBbGlhcyAhPT0gcmVvcGVuV2l0aEVuY29kaW5nUGljay5sYWJlbCkge1xuXHRcdFx0XHRyZW9wZW5XaXRoRW5jb2RpbmdQaWNrLmRldGFpbCA9IHJlb3BlbldpdGhFbmNvZGluZ0FsaWFzO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGxldCBhY3Rpb246IElRdWlja1BpY2tJdGVtIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChlbmNvZGluZ1N1cHBvcnQgaW5zdGFuY2VvZiBVbnRpdGxlZFRleHRFZGl0b3JJbnB1dCkge1xuXHRcdFx0YWN0aW9uID0gc2F2ZVdpdGhFbmNvZGluZ1BpY2s7XG5cdFx0fSBlbHNlIGlmIChhY3RpdmVFZGl0b3JQYW5lLmlucHV0LmlzUmVhZG9ubHkoKSkge1xuXHRcdFx0YWN0aW9uID0gcmVvcGVuV2l0aEVuY29kaW5nUGljaztcblx0XHR9IGVsc2Uge1xuXHRcdFx0YWN0aW9uID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhbcmVvcGVuV2l0aEVuY29kaW5nUGljaywgc2F2ZVdpdGhFbmNvZGluZ1BpY2tdLCB7IHBsYWNlSG9sZGVyOiBsb2NhbGl6ZSgncGlja0FjdGlvbicsIFwiU2VsZWN0IEFjdGlvblwiKSwgbWF0Y2hPbkRldGFpbDogdHJ1ZSB9KTtcblx0XHR9XG5cblx0XHRpZiAoIWFjdGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRpbWVvdXQoNTApOyAvLyBxdWljayBpbnB1dCBpcyBzZW5zaXRpdmUgdG8gYmVpbmcgb3BlbmVkIHNvIHNvb24gYWZ0ZXIgYW5vdGhlclxuXG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGFjdGl2ZUVkaXRvclBhbmUuaW5wdXQsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuUFJJTUFSWSB9KTtcblx0XHRpZiAoIXJlc291cmNlIHx8ICghZmlsZVNlcnZpY2UuaGFzUHJvdmlkZXIocmVzb3VyY2UpICYmIHJlc291cmNlLnNjaGVtZSAhPT0gU2NoZW1hcy51bnRpdGxlZCkpIHtcblx0XHRcdHJldHVybjsgLy8gZW5jb2RpbmcgZGV0ZWN0aW9uIG9ubHkgcG9zc2libGUgZm9yIHJlc291cmNlcyB0aGUgZmlsZSBzZXJ2aWNlIGNhbiBoYW5kbGUgb3IgdGhhdCBhcmUgdW50aXRsZWRcblx0XHR9XG5cblx0XHRsZXQgZ3Vlc3NlZEVuY29kaW5nOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGZpbGVTZXJ2aWNlLmhhc1Byb3ZpZGVyKHJlc291cmNlKSkge1xuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRleHRGaWxlU2VydmljZS5yZWFkU3RyZWFtKHJlc291cmNlLCB7XG5cdFx0XHRcdGF1dG9HdWVzc0VuY29kaW5nOiB0cnVlLFxuXHRcdFx0XHRjYW5kaWRhdGVHdWVzc0VuY29kaW5nczogdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUocmVzb3VyY2UsICdmaWxlcy5jYW5kaWRhdGVHdWVzc0VuY29kaW5ncycpXG5cdFx0XHR9KTtcblx0XHRcdGd1ZXNzZWRFbmNvZGluZyA9IGNvbnRlbnQuZW5jb2Rpbmc7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXNSZW9wZW5XaXRoRW5jb2RpbmcgPSAoYWN0aW9uID09PSByZW9wZW5XaXRoRW5jb2RpbmdQaWNrKTtcblxuXHRcdGNvbnN0IGNvbmZpZ3VyZWRFbmNvZGluZyA9IHRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKHJlc291cmNlLCAnZmlsZXMuZW5jb2RpbmcnKTtcblxuXHRcdGxldCBkaXJlY3RNYXRjaEluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGFsaWFzTWF0Y2hJbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXG5cdFx0Ly8gQWxsIGVuY29kaW5ncyBhcmUgdmFsaWQgcGlja3Ncblx0XHRjb25zdCBwaWNrczogUXVpY2tQaWNrSW5wdXRbXSA9IE9iamVjdC5rZXlzKFNVUFBPUlRFRF9FTkNPRElOR1MpXG5cdFx0XHQuc29ydCgoazEsIGsyKSA9PiB7XG5cdFx0XHRcdGlmIChrMSA9PT0gY29uZmlndXJlZEVuY29kaW5nKSB7XG5cdFx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGsyID09PSBjb25maWd1cmVkRW5jb2RpbmcpIHtcblx0XHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBTVVBQT1JURURfRU5DT0RJTkdTW2sxXS5vcmRlciAtIFNVUFBPUlRFRF9FTkNPRElOR1NbazJdLm9yZGVyO1xuXHRcdFx0fSlcblx0XHRcdC5maWx0ZXIoayA9PiB7XG5cdFx0XHRcdGlmIChrID09PSBndWVzc2VkRW5jb2RpbmcgJiYgZ3Vlc3NlZEVuY29kaW5nICE9PSBjb25maWd1cmVkRW5jb2RpbmcpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7IC8vIGRvIG5vdCBzaG93IGVuY29kaW5nIGlmIGl0IGlzIHRoZSBndWVzc2VkIGVuY29kaW5nIHRoYXQgZG9lcyBub3QgbWF0Y2ggdGhlIGNvbmZpZ3VyZWRcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiAhaXNSZW9wZW5XaXRoRW5jb2RpbmcgfHwgIVNVUFBPUlRFRF9FTkNPRElOR1Nba10uZW5jb2RlT25seTsgLy8gaGlkZSB0aG9zZSB0aGF0IGNhbiBvbmx5IGJlIHVzZWQgZm9yIGVuY29kaW5nIGlmIHdlIGFyZSBhYm91dCB0byBkZWNvZGVcblx0XHRcdH0pXG5cdFx0XHQubWFwKChrZXksIGluZGV4KSA9PiB7XG5cdFx0XHRcdGlmIChrZXkgPT09IGVuY29kaW5nU3VwcG9ydC5nZXRFbmNvZGluZygpKSB7XG5cdFx0XHRcdFx0ZGlyZWN0TWF0Y2hJbmRleCA9IGluZGV4O1xuXHRcdFx0XHR9IGVsc2UgaWYgKFNVUFBPUlRFRF9FTkNPRElOR1Nba2V5XS5hbGlhcyA9PT0gZW5jb2RpbmdTdXBwb3J0LmdldEVuY29kaW5nKCkpIHtcblx0XHRcdFx0XHRhbGlhc01hdGNoSW5kZXggPSBpbmRleDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB7IGlkOiBrZXksIGxhYmVsOiBTVVBQT1JURURfRU5DT0RJTkdTW2tleV0ubGFiZWxMb25nLCBkZXNjcmlwdGlvbjoga2V5IH07XG5cdFx0XHR9KTtcblxuXHRcdGNvbnN0IGl0ZW1zID0gcGlja3Muc2xpY2UoKSBhcyBJUXVpY2tQaWNrSXRlbVtdO1xuXG5cdFx0Ly8gSWYgd2UgaGF2ZSBhIGd1ZXNzZWQgZW5jb2RpbmcsIHNob3cgaXQgZmlyc3QgdW5sZXNzIGl0IG1hdGNoZXMgdGhlIGNvbmZpZ3VyZWQgZW5jb2Rpbmdcblx0XHRpZiAoZ3Vlc3NlZEVuY29kaW5nICYmIGNvbmZpZ3VyZWRFbmNvZGluZyAhPT0gZ3Vlc3NlZEVuY29kaW5nICYmIFNVUFBPUlRFRF9FTkNPRElOR1NbZ3Vlc3NlZEVuY29kaW5nXSkge1xuXHRcdFx0cGlja3MudW5zaGlmdCh7IHR5cGU6ICdzZXBhcmF0b3InIH0pO1xuXHRcdFx0cGlja3MudW5zaGlmdCh7IGlkOiBndWVzc2VkRW5jb2RpbmcsIGxhYmVsOiBTVVBQT1JURURfRU5DT0RJTkdTW2d1ZXNzZWRFbmNvZGluZ10ubGFiZWxMb25nLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2d1ZXNzZWRFbmNvZGluZycsIFwiR3Vlc3NlZCBmcm9tIGNvbnRlbnRcIikgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZW5jb2RpbmcgPSBhd2FpdCBxdWlja0lucHV0U2VydmljZS5waWNrKHBpY2tzLCB7XG5cdFx0XHRwbGFjZUhvbGRlcjogaXNSZW9wZW5XaXRoRW5jb2RpbmcgPyBsb2NhbGl6ZSgncGlja0VuY29kaW5nRm9yUmVvcGVuJywgXCJTZWxlY3QgRmlsZSBFbmNvZGluZyB0byBSZW9wZW4gRmlsZVwiKSA6IGxvY2FsaXplKCdwaWNrRW5jb2RpbmdGb3JTYXZlJywgXCJTZWxlY3QgRmlsZSBFbmNvZGluZyB0byBTYXZlIHdpdGhcIiksXG5cdFx0XHRhY3RpdmVJdGVtOiBpdGVtc1t0eXBlb2YgZGlyZWN0TWF0Y2hJbmRleCA9PT0gJ251bWJlcicgPyBkaXJlY3RNYXRjaEluZGV4IDogdHlwZW9mIGFsaWFzTWF0Y2hJbmRleCA9PT0gJ251bWJlcicgPyBhbGlhc01hdGNoSW5kZXggOiAtMV1cblx0XHR9KTtcblxuXHRcdGlmICghZW5jb2RpbmcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIWVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2ZUVuY29kaW5nU3VwcG9ydCA9IHRvRWRpdG9yV2l0aEVuY29kaW5nU3VwcG9ydChlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmUuaW5wdXQpO1xuXHRcdGlmICh0eXBlb2YgZW5jb2RpbmcuaWQgIT09ICd1bmRlZmluZWQnICYmIGFjdGl2ZUVuY29kaW5nU3VwcG9ydCkge1xuXHRcdFx0YXdhaXQgYWN0aXZlRW5jb2RpbmdTdXBwb3J0LnNldEVuY29kaW5nKGVuY29kaW5nLmlkLCBpc1Jlb3BlbldpdGhFbmNvZGluZyA/IEVuY29kaW5nTW9kZS5EZWNvZGUgOiBFbmNvZGluZ01vZGUuRW5jb2RlKTsgLy8gU2V0IG5ldyBlbmNvZGluZ1xuXHRcdH1cblxuXHRcdGFjdGl2ZVRleHRFZGl0b3JDb250cm9sLmZvY3VzKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUyxlQUFlLCtDQUErQztBQUN2RSxTQUFTLFFB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
