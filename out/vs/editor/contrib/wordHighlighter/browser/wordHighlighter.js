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
import { alert } from "../../../../base/browser/ui/aria/aria.js";
import { createCancelablePromise, Delayer, first } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { onUnexpectedError, onUnexpectedExternalError } from "../../../../base/common/errors.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { matchesScheme, Schemas } from "../../../../base/common/network.js";
import { isEqual } from "../../../../base/common/resources.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { isDiffEditor } from "../../../browser/editorBrowser.js";
import { EditorAction, EditorContributionInstantiation, registerEditorAction, registerEditorContribution, registerModelAndPositionCommand } from "../../../browser/editorExtensions.js";
import { ICodeEditorService } from "../../../browser/services/codeEditorService.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Range } from "../../../common/core/range.js";
import { CursorChangeReason } from "../../../common/cursorEvents.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { registerEditorFeature } from "../../../common/editorFeatures.js";
import { score } from "../../../common/languageSelector.js";
import { shouldSynchronizeModel } from "../../../common/model.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { ITextModelService } from "../../../common/services/resolverService.js";
import { getHighlightDecorationOptions } from "./highlightDecorations.js";
import { TextualMultiDocumentHighlightFeature } from "./textualHighlightProvider.js";
const ctxHasWordHighlights = new RawContextKey("hasWordHighlights", false);
function getOccurrencesAtPosition(registry, model, position, token) {
  const orderedByScore = registry.ordered(model);
  return first(orderedByScore.map((provider) => () => {
    return Promise.resolve(provider.provideDocumentHighlights(model, position, token)).then(void 0, onUnexpectedExternalError);
  }), (result) => result !== void 0 && result !== null).then((result) => {
    if (result) {
      const map = new ResourceMap();
      map.set(model.uri, result);
      return map;
    }
    return new ResourceMap();
  });
}
function getOccurrencesAcrossMultipleModels(registry, model, position, token, otherModels) {
  const orderedByScore = registry.ordered(model);
  return first(orderedByScore.map((provider) => () => {
    const filteredModels = otherModels.filter((otherModel) => {
      return shouldSynchronizeModel(otherModel);
    }).filter((otherModel) => {
      return score(provider.selector, otherModel.uri, otherModel.getLanguageId(), true, void 0, void 0) > 0;
    });
    return Promise.resolve(provider.provideMultiDocumentHighlights(model, position, filteredModels, token)).then(void 0, onUnexpectedExternalError);
  }), (result) => result !== void 0 && result !== null);
}
class OccurenceAtPositionRequest {
  constructor(_model, _selection, _wordSeparators) {
    this._model = _model;
    this._selection = _selection;
    this._wordSeparators = _wordSeparators;
    this._wordRange = this._getCurrentWordRange(_model, _selection);
    this._result = null;
  }
  get result() {
    if (!this._result) {
      this._result = createCancelablePromise((token) => this._compute(this._model, this._selection, this._wordSeparators, token));
    }
    return this._result;
  }
  _getCurrentWordRange(model, selection) {
    const word = model.getWordAtPosition(selection.getPosition());
    if (word) {
      return new Range(selection.startLineNumber, word.startColumn, selection.startLineNumber, word.endColumn);
    }
    return null;
  }
  isValid(model, selection, decorations) {
    const lineNumber = selection.startLineNumber;
    const startColumn = selection.startColumn;
    const endColumn = selection.endColumn;
    const currentWordRange = this._getCurrentWordRange(model, selection);
    let requestIsValid = Boolean(this._wordRange && this._wordRange.equalsRange(currentWordRange));
    for (let i = 0, len = decorations.length; !requestIsValid && i < len; i++) {
      const range = decorations.getRange(i);
      if (range && range.startLineNumber === lineNumber) {
        if (range.startColumn <= startColumn && range.endColumn >= endColumn) {
          requestIsValid = true;
        }
      }
    }
    return requestIsValid;
  }
  cancel() {
    this.result.cancel();
  }
}
class SemanticOccurenceAtPositionRequest extends OccurenceAtPositionRequest {
  constructor(model, selection, wordSeparators, providers) {
    super(model, selection, wordSeparators);
    this._providers = providers;
  }
  _compute(model, selection, wordSeparators, token) {
    return getOccurrencesAtPosition(this._providers, model, selection.getPosition(), token).then((value) => {
      if (!value) {
        return new ResourceMap();
      }
      return value;
    });
  }
}
class MultiModelOccurenceRequest extends OccurenceAtPositionRequest {
  constructor(model, selection, wordSeparators, providers, otherModels) {
    super(model, selection, wordSeparators);
    this._providers = providers;
    this._otherModels = otherModels;
  }
  _compute(model, selection, wordSeparators, token) {
    return getOccurrencesAcrossMultipleModels(this._providers, model, selection.getPosition(), token, this._otherModels).then((value) => {
      if (!value) {
        return new ResourceMap();
      }
      return value;
    });
  }
}
function computeOccurencesAtPosition(registry, model, selection, wordSeparators) {
  return new SemanticOccurenceAtPositionRequest(model, selection, wordSeparators, registry);
}
function computeOccurencesMultiModel(registry, model, selection, wordSeparators, otherModels) {
  return new MultiModelOccurenceRequest(model, selection, wordSeparators, registry, otherModels);
}
registerModelAndPositionCommand("_executeDocumentHighlights", async (accessor, model, position) => {
  const languageFeaturesService = accessor.get(ILanguageFeaturesService);
  const map = await getOccurrencesAtPosition(languageFeaturesService.documentHighlightProvider, model, position, CancellationToken.None);
  return map?.get(model.uri);
});
let WordHighlighter = class {
  constructor(editor, providers, multiProviders, contextKeyService, textModelService, codeEditorService, configurationService, logService) {
    this.toUnhook = new DisposableStore();
    this.workerRequestTokenId = 0;
    this.workerRequestCompleted = false;
    this.workerRequestValue = new ResourceMap();
    this.lastCursorPositionChangeTime = 0;
    this.renderDecorationsTimer = -1;
    this.runDelayer = this.toUnhook.add(new Delayer(50));
    this.editor = editor;
    this.providers = providers;
    this.multiDocumentProviders = multiProviders;
    this.codeEditorService = codeEditorService;
    this.textModelService = textModelService;
    this.configurationService = configurationService;
    this.logService = logService;
    this._hasWordHighlights = ctxHasWordHighlights.bindTo(contextKeyService);
    this._ignorePositionChangeEvent = false;
    this.occurrencesHighlightEnablement = this.editor.getOption(EditorOption.occurrencesHighlight);
    this.occurrencesHighlightDelay = this.configurationService.getValue("editor.occurrencesHighlightDelay");
    this.model = this.editor.getModel();
    this.toUnhook.add(editor.onDidChangeCursorPosition((e) => {
      if (this._ignorePositionChangeEvent) {
        return;
      }
      if (this.occurrencesHighlightEnablement === "off") {
        return;
      }
      this.runDelayer.trigger(() => {
        this._onPositionChanged(e);
      });
    }));
    this.toUnhook.add(editor.onDidFocusEditorText((e) => {
      if (this.occurrencesHighlightEnablement === "off") {
        return;
      }
      if (!this.workerRequest) {
        this.runDelayer.trigger(() => {
          this._run();
        });
      }
    }));
    this.toUnhook.add(editor.onDidChangeModelContent((e) => {
      if (!matchesScheme(this.model.uri, "output")) {
        this._stopAll();
      }
    }));
    this.toUnhook.add(editor.onDidChangeModel((e) => {
      if (!e.newModelUrl && e.oldModelUrl) {
        this._stopSingular();
      } else if (WordHighlighter.query) {
        this._run();
      }
    }));
    this.toUnhook.add(editor.onDidChangeConfiguration((e) => {
      const newEnablement = this.editor.getOption(EditorOption.occurrencesHighlight);
      if (this.occurrencesHighlightEnablement !== newEnablement) {
        this.occurrencesHighlightEnablement = newEnablement;
        switch (newEnablement) {
          case "off":
            this._stopAll();
            break;
          case "singleFile":
            this._stopAll(WordHighlighter.query?.modelInfo?.modelURI);
            break;
          case "multiFile":
            if (WordHighlighter.query) {
              this._run(true);
            }
            break;
          default:
            console.warn("Unknown occurrencesHighlight setting value:", newEnablement);
            break;
        }
      }
    }));
    this.toUnhook.add(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.occurrencesHighlightDelay")) {
        const newDelay = configurationService.getValue("editor.occurrencesHighlightDelay");
        if (this.occurrencesHighlightDelay !== newDelay) {
          this.occurrencesHighlightDelay = newDelay;
        }
      }
    }));
    this.toUnhook.add(editor.onDidBlurEditorWidget(() => {
      const activeEditor = this.codeEditorService.getFocusedCodeEditor();
      if (!activeEditor) {
        this._stopAll();
      } else if (activeEditor.getModel()?.uri.scheme === Schemas.vscodeNotebookCell && this.editor.getModel()?.uri.scheme !== Schemas.vscodeNotebookCell) {
        this._stopAll();
      }
    }));
    this.decorations = this.editor.createDecorationsCollection();
    this.workerRequestTokenId = 0;
    this.workerRequest = null;
    this.workerRequestCompleted = false;
    this.lastCursorPositionChangeTime = 0;
    this.renderDecorationsTimer = -1;
    if (WordHighlighter.query) {
      this._run();
    }
  }
  hasDecorations() {
    return this.decorations.length > 0;
  }
  restore(delay) {
    if (this.occurrencesHighlightEnablement === "off") {
      return;
    }
    this.runDelayer.cancel();
    this.runDelayer.trigger(() => {
      this._run(false, delay);
    });
  }
  trigger() {
    this.runDelayer.cancel();
    this._run(false, 0);
  }
  stop() {
    if (this.occurrencesHighlightEnablement === "off") {
      return;
    }
    this._stopAll();
  }
  _getSortedHighlights() {
    return this.decorations.getRanges().sort(Range.compareRangesUsingStarts);
  }
  moveNext() {
    const highlights = this._getSortedHighlights();
    const index = highlights.findIndex((range) => range.containsPosition(this.editor.getPosition()));
    const newIndex = (index + 1) % highlights.length;
    const dest = highlights[newIndex];
    try {
      this._ignorePositionChangeEvent = true;
      this.editor.setPosition(dest.getStartPosition());
      this.editor.revealRangeInCenterIfOutsideViewport(dest);
      const word = this._getWord();
      if (word) {
        const lineContent = this.editor.getModel().getLineContent(dest.startLineNumber);
        alert(`${lineContent}, ${newIndex + 1} of ${highlights.length} for '${word.word}'`);
      }
    } finally {
      this._ignorePositionChangeEvent = false;
    }
  }
  moveBack() {
    const highlights = this._getSortedHighlights();
    const index = highlights.findIndex((range) => range.containsPosition(this.editor.getPosition()));
    const newIndex = (index - 1 + highlights.length) % highlights.length;
    const dest = highlights[newIndex];
    try {
      this._ignorePositionChangeEvent = true;
      this.editor.setPosition(dest.getStartPosition());
      this.editor.revealRangeInCenterIfOutsideViewport(dest);
      const word = this._getWord();
      if (word) {
        const lineContent = this.editor.getModel().getLineContent(dest.startLineNumber);
        alert(`${lineContent}, ${newIndex + 1} of ${highlights.length} for '${word.word}'`);
      }
    } finally {
      this._ignorePositionChangeEvent = false;
    }
  }
  _removeSingleDecorations() {
    if (!this.editor.hasModel()) {
      return;
    }
    const currentDecorationIDs = WordHighlighter.storedDecorationIDs.get(this.editor.getModel().uri);
    if (!currentDecorationIDs) {
      return;
    }
    this.editor.removeDecorations(currentDecorationIDs);
    WordHighlighter.storedDecorationIDs.delete(this.editor.getModel().uri);
    if (this.decorations.length > 0) {
      this.decorations.clear();
      this._hasWordHighlights.set(false);
    }
  }
  _removeAllDecorations(preservedModel) {
    const currentEditors = this.codeEditorService.listCodeEditors();
    const deleteURI = [];
    for (const editor of currentEditors) {
      if (!editor.hasModel() || isEqual(editor.getModel().uri, preservedModel)) {
        continue;
      }
      const currentDecorationIDs = WordHighlighter.storedDecorationIDs.get(editor.getModel().uri);
      if (!currentDecorationIDs) {
        continue;
      }
      editor.removeDecorations(currentDecorationIDs);
      deleteURI.push(editor.getModel().uri);
      const editorHighlighterContrib = WordHighlighterContribution.get(editor);
      if (!editorHighlighterContrib?.wordHighlighter) {
        continue;
      }
      if (editorHighlighterContrib.wordHighlighter.decorations.length > 0) {
        editorHighlighterContrib.wordHighlighter.decorations.clear();
        editorHighlighterContrib.wordHighlighter.workerRequest = null;
        editorHighlighterContrib.wordHighlighter._hasWordHighlights.set(false);
      }
    }
    for (const uri of deleteURI) {
      WordHighlighter.storedDecorationIDs.delete(uri);
    }
  }
  _stopSingular() {
    this._removeSingleDecorations();
    if (this.editor.hasTextFocus()) {
      if (this.editor.getModel()?.uri.scheme !== Schemas.vscodeNotebookCell && WordHighlighter.query?.modelInfo?.modelURI.scheme !== Schemas.vscodeNotebookCell) {
        WordHighlighter.query = null;
        this._run();
      } else {
        if (WordHighlighter.query?.modelInfo) {
          WordHighlighter.query.modelInfo = null;
        }
      }
    }
    if (this.renderDecorationsTimer !== -1) {
      clearTimeout(this.renderDecorationsTimer);
      this.renderDecorationsTimer = -1;
    }
    if (this.workerRequest !== null) {
      this.workerRequest.cancel();
      this.workerRequest = null;
    }
    if (!this.workerRequestCompleted) {
      this.workerRequestTokenId++;
      this.workerRequestCompleted = true;
    }
  }
  _stopAll(preservedModel) {
    this._removeAllDecorations(preservedModel);
    if (this.renderDecorationsTimer !== -1) {
      clearTimeout(this.renderDecorationsTimer);
      this.renderDecorationsTimer = -1;
    }
    if (this.workerRequest !== null) {
      this.workerRequest.cancel();
      this.workerRequest = null;
    }
    if (!this.workerRequestCompleted) {
      this.workerRequestTokenId++;
      this.workerRequestCompleted = true;
    }
  }
  _onPositionChanged(e) {
    if (this.occurrencesHighlightEnablement === "off") {
      this._stopAll();
      return;
    }
    if (e.source !== "api" && e.reason !== CursorChangeReason.Explicit) {
      this._stopAll();
      return;
    }
    this._run();
  }
  _getWord() {
    const editorSelection = this.editor.getSelection();
    const lineNumber = editorSelection.startLineNumber;
    const startColumn = editorSelection.startColumn;
    if (this.model.isDisposed()) {
      return null;
    }
    return this.model.getWordAtPosition({
      lineNumber,
      column: startColumn
    });
  }
  getOtherModelsToHighlight(model) {
    if (!model) {
      return [];
    }
    const isNotebookEditor = model.uri.scheme === Schemas.vscodeNotebookCell;
    if (isNotebookEditor) {
      const currentModels2 = [];
      const currentEditors2 = this.codeEditorService.listCodeEditors();
      for (const editor of currentEditors2) {
        const tempModel = editor.getModel();
        if (tempModel && tempModel !== model && tempModel.uri.scheme === Schemas.vscodeNotebookCell) {
          currentModels2.push(tempModel);
        }
      }
      return currentModels2;
    }
    const currentModels = [];
    const currentEditors = this.codeEditorService.listCodeEditors();
    for (const editor of currentEditors) {
      if (!isDiffEditor(editor)) {
        continue;
      }
      const diffModel = editor.getModel();
      if (!diffModel) {
        continue;
      }
      if (model === diffModel.modified) {
        currentModels.push(diffModel.modified);
      }
    }
    if (currentModels.length) {
      return currentModels;
    }
    if (this.occurrencesHighlightEnablement === "singleFile") {
      return [];
    }
    for (const editor of currentEditors) {
      const tempModel = editor.getModel();
      const isValidModel = tempModel && tempModel !== model;
      if (isValidModel) {
        currentModels.push(tempModel);
      }
    }
    return currentModels;
  }
  async _run(multiFileConfigChange, delay) {
    const hasTextFocus = this.editor.hasTextFocus();
    if (!hasTextFocus) {
      if (!WordHighlighter.query) {
        this._stopAll();
        return;
      }
    } else {
      const editorSelection = this.editor.getSelection();
      if (!editorSelection || editorSelection.startLineNumber !== editorSelection.endLineNumber) {
        WordHighlighter.query = null;
        this._stopAll();
        return;
      }
      const startColumn = editorSelection.startColumn;
      const endColumn = editorSelection.endColumn;
      const word = this._getWord();
      if (!word || word.startColumn > startColumn || word.endColumn < endColumn) {
        WordHighlighter.query = null;
        this._stopAll();
        return;
      }
      WordHighlighter.query = {
        modelInfo: {
          modelURI: this.model.uri,
          selection: editorSelection
        }
      };
    }
    this.lastCursorPositionChangeTime = (/* @__PURE__ */ new Date()).getTime();
    if (isEqual(this.editor.getModel().uri, WordHighlighter.query.modelInfo?.modelURI)) {
      if (!multiFileConfigChange) {
        const currentModelDecorationRanges = this.decorations.getRanges();
        for (const storedRange of currentModelDecorationRanges) {
          if (storedRange.containsPosition(this.editor.getPosition())) {
            return;
          }
        }
      }
      this._stopAll(multiFileConfigChange ? this.model.uri : void 0);
      const myRequestId = ++this.workerRequestTokenId;
      this.workerRequestCompleted = false;
      const otherModelsToHighlight = this.getOtherModelsToHighlight(this.editor.getModel());
      if (!WordHighlighter.query || !WordHighlighter.query.modelInfo) {
        return;
      }
      const queryModelRef = await this.textModelService.createModelReference(WordHighlighter.query.modelInfo.modelURI);
      try {
        this.workerRequest = this.computeWithModel(queryModelRef.object.textEditorModel, WordHighlighter.query.modelInfo.selection, otherModelsToHighlight);
        this.workerRequest?.result.then((data) => {
          if (myRequestId === this.workerRequestTokenId) {
            this.workerRequestCompleted = true;
            this.workerRequestValue = data || [];
            this._beginRenderDecorations(delay ?? this.occurrencesHighlightDelay);
          }
        }, onUnexpectedError);
      } catch (e) {
        this.logService.error("Unexpected error during occurrence request. Log: ", e);
      } finally {
        queryModelRef.dispose();
      }
    } else if (this.model.uri.scheme === Schemas.vscodeNotebookCell) {
      const myRequestId = ++this.workerRequestTokenId;
      this.workerRequestCompleted = false;
      if (!WordHighlighter.query || !WordHighlighter.query.modelInfo) {
        return;
      }
      const queryModelRef = await this.textModelService.createModelReference(WordHighlighter.query.modelInfo.modelURI);
      try {
        this.workerRequest = this.computeWithModel(queryModelRef.object.textEditorModel, WordHighlighter.query.modelInfo.selection, [this.model]);
        this.workerRequest?.result.then((data) => {
          if (myRequestId === this.workerRequestTokenId) {
            this.workerRequestCompleted = true;
            this.workerRequestValue = data || [];
            this._beginRenderDecorations(delay ?? this.occurrencesHighlightDelay);
          }
        }, onUnexpectedError);
      } catch (e) {
        this.logService.error("Unexpected error during occurrence request. Log: ", e);
      } finally {
        queryModelRef.dispose();
      }
    }
  }
  computeWithModel(model, selection, otherModels) {
    if (!otherModels.length) {
      return computeOccurencesAtPosition(this.providers, model, selection, this.editor.getOption(EditorOption.wordSeparators));
    } else {
      return computeOccurencesMultiModel(this.multiDocumentProviders, model, selection, this.editor.getOption(EditorOption.wordSeparators), otherModels);
    }
  }
  _beginRenderDecorations(delay) {
    const currentTime = (/* @__PURE__ */ new Date()).getTime();
    const minimumRenderTime = this.lastCursorPositionChangeTime + delay;
    if (currentTime >= minimumRenderTime) {
      this.renderDecorationsTimer = -1;
      this.renderDecorations();
    } else {
      this.renderDecorationsTimer = setTimeout(() => {
        this.renderDecorations();
      }, minimumRenderTime - currentTime);
    }
  }
  renderDecorations() {
    this.renderDecorationsTimer = -1;
    const currentEditors = this.codeEditorService.listCodeEditors();
    for (const editor of currentEditors) {
      const editorHighlighterContrib = WordHighlighterContribution.get(editor);
      if (!editorHighlighterContrib) {
        continue;
      }
      const newDecorations = [];
      const uri = editor.getModel()?.uri;
      if (uri && this.workerRequestValue.has(uri)) {
        const oldDecorationIDs = WordHighlighter.storedDecorationIDs.get(uri);
        const newDocumentHighlights = this.workerRequestValue.get(uri);
        if (newDocumentHighlights) {
          for (const highlight of newDocumentHighlights) {
            if (!highlight.range) {
              continue;
            }
            newDecorations.push({
              range: highlight.range,
              options: getHighlightDecorationOptions(highlight.kind)
            });
          }
        }
        let newDecorationIDs = [];
        editor.changeDecorations((changeAccessor) => {
          newDecorationIDs = changeAccessor.deltaDecorations(oldDecorationIDs ?? [], newDecorations);
        });
        WordHighlighter.storedDecorationIDs = WordHighlighter.storedDecorationIDs.set(uri, newDecorationIDs);
        if (newDecorations.length > 0) {
          editorHighlighterContrib.wordHighlighter?.decorations.set(newDecorations);
          editorHighlighterContrib.wordHighlighter?._hasWordHighlights.set(true);
        }
      }
    }
    this.workerRequest = null;
  }
  dispose() {
    this._stopSingular();
    this.toUnhook.dispose();
  }
};
WordHighlighter.storedDecorationIDs = new ResourceMap();
WordHighlighter.query = null;
WordHighlighter = __decorateClass([
  __decorateParam(4, ITextModelService),
  __decorateParam(5, ICodeEditorService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, ILogService)
], WordHighlighter);
let WordHighlighterContribution = class extends Disposable {
  static get(editor) {
    return editor.getContribution(WordHighlighterContribution.ID);
  }
  constructor(editor, contextKeyService, languageFeaturesService, codeEditorService, textModelService, configurationService, logService) {
    super();
    this._wordHighlighter = null;
    const createWordHighlighterIfPossible = () => {
      if (editor.hasModel() && !editor.getModel().isTooLargeForTokenization() && editor.getModel().uri.scheme !== Schemas.accessibleView) {
        this._wordHighlighter = new WordHighlighter(editor, languageFeaturesService.documentHighlightProvider, languageFeaturesService.multiDocumentHighlightProvider, contextKeyService, textModelService, codeEditorService, configurationService, logService);
      }
    };
    this._register(editor.onDidChangeModel((e) => {
      if (this._wordHighlighter) {
        if (!e.newModelUrl && e.oldModelUrl?.scheme !== Schemas.vscodeNotebookCell) {
          this.wordHighlighter?.stop();
        }
        this._wordHighlighter.dispose();
        this._wordHighlighter = null;
      }
      createWordHighlighterIfPossible();
    }));
    createWordHighlighterIfPossible();
  }
  get wordHighlighter() {
    return this._wordHighlighter;
  }
  saveViewState() {
    if (this._wordHighlighter && this._wordHighlighter.hasDecorations()) {
      return true;
    }
    return false;
  }
  moveNext() {
    this._wordHighlighter?.moveNext();
  }
  moveBack() {
    this._wordHighlighter?.moveBack();
  }
  restoreViewState(state) {
    if (this._wordHighlighter && state) {
      this._wordHighlighter.restore(250);
    }
  }
  stopHighlighting() {
    this._wordHighlighter?.stop();
  }
  dispose() {
    if (this._wordHighlighter) {
      this._wordHighlighter.dispose();
      this._wordHighlighter = null;
    }
    super.dispose();
  }
};
WordHighlighterContribution.ID = "editor.contrib.wordHighlighter";
WordHighlighterContribution = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, ILanguageFeaturesService),
  __decorateParam(3, ICodeEditorService),
  __decorateParam(4, ITextModelService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ILogService)
], WordHighlighterContribution);
class WordHighlightNavigationAction extends EditorAction {
  constructor(next, opts) {
    super(opts);
    this._isNext = next;
  }
  run(accessor, editor) {
    const controller = WordHighlighterContribution.get(editor);
    if (!controller) {
      return;
    }
    if (this._isNext) {
      controller.moveNext();
    } else {
      controller.moveBack();
    }
  }
}
class NextWordHighlightAction extends WordHighlightNavigationAction {
  constructor() {
    super(true, {
      id: "editor.action.wordHighlight.next",
      label: nls.localize2("wordHighlight.next.label", "Go to Next Symbol Highlight"),
      precondition: ctxHasWordHighlights,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyCode.F7,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
}
class PrevWordHighlightAction extends WordHighlightNavigationAction {
  constructor() {
    super(false, {
      id: "editor.action.wordHighlight.prev",
      label: nls.localize2("wordHighlight.previous.label", "Go to Previous Symbol Highlight"),
      precondition: ctxHasWordHighlights,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.Shift | KeyCode.F7,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
}
class TriggerWordHighlightAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.wordHighlight.trigger",
      label: nls.localize2("wordHighlight.trigger.label", "Trigger Symbol Highlight"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: 0,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor, editor, args) {
    const controller = WordHighlighterContribution.get(editor);
    if (!controller) {
      return;
    }
    controller.restoreViewState(true);
  }
}
registerEditorContribution(WordHighlighterContribution.ID, WordHighlighterContribution, EditorContributionInstantiation.Eager);
registerEditorAction(NextWordHighlightAction);
registerEditorAction(PrevWordHighlightAction);
registerEditorAction(TriggerWordHighlightAction);
registerEditorFeature(TextualMultiDocumentHighlightFeature);
export {
  WordHighlighterContribution,
  getOccurrencesAcrossMultipleModels,
  getOccurrencesAtPosition
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi93b3JkSGlnaGxpZ2h0ZXIvYnJvd3Nlci93b3JkSGlnaGxpZ2h0ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGFsZXJ0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxhYmxlUHJvbWlzZSwgY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UsIERlbGF5ZXIsIGZpcnN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgb25VbmV4cGVjdGVkRXJyb3IsIG9uVW5leHBlY3RlZEV4dGVybmFsRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IG1hdGNoZXNTY2hlbWUsIFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSwgUmF3Q29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJQWN0aXZlQ29kZUVkaXRvciwgSUNvZGVFZGl0b3IsIGlzRGlmZkVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBY3Rpb24sIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24sIElBY3Rpb25PcHRpb25zLCByZWdpc3RlckVkaXRvckFjdGlvbiwgcmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24sIHJlZ2lzdGVyTW9kZWxBbmRQb3NpdGlvbkNvbW1hbmQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJV29yZEF0UG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS93b3JkSGVscGVyLmpzJztcbmltcG9ydCB7IEN1cnNvckNoYW5nZVJlYXNvbiwgSUN1cnNvclBvc2l0aW9uQ2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2N1cnNvckV2ZW50cy5qcyc7XG5pbXBvcnQgeyBJRGlmZkVkaXRvciwgSUVkaXRvckNvbnRyaWJ1dGlvbiwgSUVkaXRvckRlY29yYXRpb25zQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJFZGl0b3JGZWF0dXJlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckZlYXR1cmVzLmpzJztcbmltcG9ydCB7IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IERvY3VtZW50SGlnaGxpZ2h0LCBEb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyLCBNdWx0aURvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IHNjb3JlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlU2VsZWN0b3IuanMnO1xuaW1wb3J0IHsgSU1vZGVsRGVsdGFEZWNvcmF0aW9uLCBJVGV4dE1vZGVsLCBzaG91bGRTeW5jaHJvbml6ZU1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXRIaWdobGlnaHREZWNvcmF0aW9uT3B0aW9ucyB9IGZyb20gJy4vaGlnaGxpZ2h0RGVjb3JhdGlvbnMuanMnO1xuaW1wb3J0IHsgVGV4dHVhbE11bHRpRG9jdW1lbnRIaWdobGlnaHRGZWF0dXJlIH0gZnJvbSAnLi90ZXh0dWFsSGlnaGxpZ2h0UHJvdmlkZXIuanMnO1xuXG5jb25zdCBjdHhIYXNXb3JkSGlnaGxpZ2h0cyA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdoYXNXb3JkSGlnaGxpZ2h0cycsIGZhbHNlKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldE9jY3VycmVuY2VzQXRQb3NpdGlvbihyZWdpc3RyeTogTGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnk8RG9jdW1lbnRIaWdobGlnaHRQcm92aWRlcj4sIG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogUG9zaXRpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8UmVzb3VyY2VNYXA8RG9jdW1lbnRIaWdobGlnaHRbXT4gfCBudWxsIHwgdW5kZWZpbmVkPiB7XG5cdGNvbnN0IG9yZGVyZWRCeVNjb3JlID0gcmVnaXN0cnkub3JkZXJlZChtb2RlbCk7XG5cblx0Ly8gaW4gb3JkZXIgb2Ygc2NvcmUgYXNrIHRoZSBvY2N1cnJlbmNlcyBwcm92aWRlclxuXHQvLyB1bnRpbCBzb21lb25lIHJlc3BvbnNlIHdpdGggYSBnb29kIHJlc3VsdFxuXHQvLyAoZ29vZCA9IG5vbiB1bmRlZmluZWQgYW5kIG5vbiBudWxsIHZhbHVlKVxuXHQvLyAocmVzdWx0IG9mIHNpemUgPT0gMCBpcyB2YWxpZCwgbm8gaGlnaGxpZ2h0cyBpcyBhIHZhbGlkL2V4cGVjdGVkIHJlc3VsdCAtLSBub3QgYSBzaWduYWwgdG8gZmFsbCBiYWNrIHRvIG90aGVyIHByb3ZpZGVycylcblx0cmV0dXJuIGZpcnN0PERvY3VtZW50SGlnaGxpZ2h0W10gfCBudWxsIHwgdW5kZWZpbmVkPihvcmRlcmVkQnlTY29yZS5tYXAocHJvdmlkZXIgPT4gKCkgPT4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUocHJvdmlkZXIucHJvdmlkZURvY3VtZW50SGlnaGxpZ2h0cyhtb2RlbCwgcG9zaXRpb24sIHRva2VuKSlcblx0XHRcdC50aGVuKHVuZGVmaW5lZCwgb25VbmV4cGVjdGVkRXh0ZXJuYWxFcnJvcik7XG5cdH0pLCAocmVzdWx0KTogcmVzdWx0IGlzIERvY3VtZW50SGlnaGxpZ2h0W10gPT4gcmVzdWx0ICE9PSB1bmRlZmluZWQgJiYgcmVzdWx0ICE9PSBudWxsKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0Y29uc3QgbWFwID0gbmV3IFJlc291cmNlTWFwPERvY3VtZW50SGlnaGxpZ2h0W10+KCk7XG5cdFx0XHRtYXAuc2V0KG1vZGVsLnVyaSwgcmVzdWx0KTtcblx0XHRcdHJldHVybiBtYXA7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgUmVzb3VyY2VNYXA8RG9jdW1lbnRIaWdobGlnaHRbXT4oKTtcblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRPY2N1cnJlbmNlc0Fjcm9zc011bHRpcGxlTW9kZWxzKHJlZ2lzdHJ5OiBMYW5ndWFnZUZlYXR1cmVSZWdpc3RyeTxNdWx0aURvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXI+LCBtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIG90aGVyTW9kZWxzOiBJVGV4dE1vZGVsW10pOiBQcm9taXNlPFJlc291cmNlTWFwPERvY3VtZW50SGlnaGxpZ2h0W10+IHwgbnVsbCB8IHVuZGVmaW5lZD4ge1xuXHRjb25zdCBvcmRlcmVkQnlTY29yZSA9IHJlZ2lzdHJ5Lm9yZGVyZWQobW9kZWwpO1xuXG5cdC8vIGluIG9yZGVyIG9mIHNjb3JlIGFzayB0aGUgb2NjdXJyZW5jZXMgcHJvdmlkZXJcblx0Ly8gdW50aWwgc29tZW9uZSByZXNwb25zZSB3aXRoIGEgZ29vZCByZXN1bHRcblx0Ly8gKGdvb2QgPSBub24gdW5kZWZpbmVkIGFuZCBub24gbnVsbCBSZXNvdXJjZU1hcClcblx0Ly8gKHJlc3VsdCBvZiBzaXplID09IDAgaXMgdmFsaWQsIG5vIGhpZ2hsaWdodHMgaXMgYSB2YWxpZC9leHBlY3RlZCByZXN1bHQgLS0gbm90IGEgc2lnbmFsIHRvIGZhbGwgYmFjayB0byBvdGhlciBwcm92aWRlcnMpXG5cdHJldHVybiBmaXJzdDxSZXNvdXJjZU1hcDxEb2N1bWVudEhpZ2hsaWdodFtdPiB8IG51bGwgfCB1bmRlZmluZWQ+KG9yZGVyZWRCeVNjb3JlLm1hcChwcm92aWRlciA9PiAoKSA9PiB7XG5cdFx0Y29uc3QgZmlsdGVyZWRNb2RlbHMgPSBvdGhlck1vZGVscy5maWx0ZXIob3RoZXJNb2RlbCA9PiB7XG5cdFx0XHRyZXR1cm4gc2hvdWxkU3luY2hyb25pemVNb2RlbChvdGhlck1vZGVsKTtcblx0XHR9KS5maWx0ZXIob3RoZXJNb2RlbCA9PiB7XG5cdFx0XHRyZXR1cm4gc2NvcmUocHJvdmlkZXIuc2VsZWN0b3IsIG90aGVyTW9kZWwudXJpLCBvdGhlck1vZGVsLmdldExhbmd1YWdlSWQoKSwgdHJ1ZSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpID4gMDtcblx0XHR9KTtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHByb3ZpZGVyLnByb3ZpZGVNdWx0aURvY3VtZW50SGlnaGxpZ2h0cyhtb2RlbCwgcG9zaXRpb24sIGZpbHRlcmVkTW9kZWxzLCB0b2tlbikpXG5cdFx0XHQudGhlbih1bmRlZmluZWQsIG9uVW5leHBlY3RlZEV4dGVybmFsRXJyb3IpO1xuXHR9KSwgKHJlc3VsdCk6IHJlc3VsdCBpcyBSZXNvdXJjZU1hcDxEb2N1bWVudEhpZ2hsaWdodFtdPiA9PiByZXN1bHQgIT09IHVuZGVmaW5lZCAmJiByZXN1bHQgIT09IG51bGwpO1xufVxuXG5pbnRlcmZhY2UgSU9jY3VyZW5jZUF0UG9zaXRpb25SZXF1ZXN0IHtcblx0cmVhZG9ubHkgcmVzdWx0OiBQcm9taXNlPFJlc291cmNlTWFwPERvY3VtZW50SGlnaGxpZ2h0W10+Pjtcblx0aXNWYWxpZChtb2RlbDogSVRleHRNb2RlbCwgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIGRlY29yYXRpb25zOiBJRWRpdG9yRGVjb3JhdGlvbnNDb2xsZWN0aW9uKTogYm9vbGVhbjtcblx0Y2FuY2VsKCk6IHZvaWQ7XG59XG5cbmludGVyZmFjZSBJV29yZEhpZ2hsaWdodGVyUXVlcnkge1xuXHRtb2RlbEluZm86IHtcblx0XHRtb2RlbFVSSTogVVJJO1xuXHRcdHNlbGVjdGlvbjogU2VsZWN0aW9uO1xuXHR9IHwgbnVsbDtcbn1cblxuYWJzdHJhY3QgY2xhc3MgT2NjdXJlbmNlQXRQb3NpdGlvblJlcXVlc3QgaW1wbGVtZW50cyBJT2NjdXJlbmNlQXRQb3NpdGlvblJlcXVlc3Qge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3dvcmRSYW5nZTogUmFuZ2UgfCBudWxsO1xuXHRwcml2YXRlIF9yZXN1bHQ6IENhbmNlbGFibGVQcm9taXNlPFJlc291cmNlTWFwPERvY3VtZW50SGlnaGxpZ2h0W10+PiB8IG51bGw7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBfbW9kZWw6IElUZXh0TW9kZWwsIHByaXZhdGUgcmVhZG9ubHkgX3NlbGVjdGlvbjogU2VsZWN0aW9uLCBwcml2YXRlIHJlYWRvbmx5IF93b3JkU2VwYXJhdG9yczogc3RyaW5nKSB7XG5cdFx0dGhpcy5fd29yZFJhbmdlID0gdGhpcy5fZ2V0Q3VycmVudFdvcmRSYW5nZShfbW9kZWwsIF9zZWxlY3Rpb24pO1xuXHRcdHRoaXMuX3Jlc3VsdCA9IG51bGw7XG5cdH1cblxuXHRnZXQgcmVzdWx0KCkge1xuXHRcdGlmICghdGhpcy5fcmVzdWx0KSB7XG5cdFx0XHR0aGlzLl9yZXN1bHQgPSBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSh0b2tlbiA9PiB0aGlzLl9jb21wdXRlKHRoaXMuX21vZGVsLCB0aGlzLl9zZWxlY3Rpb24sIHRoaXMuX3dvcmRTZXBhcmF0b3JzLCB0b2tlbikpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcmVzdWx0O1xuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IF9jb21wdXRlKG1vZGVsOiBJVGV4dE1vZGVsLCBzZWxlY3Rpb246IFNlbGVjdGlvbiwgd29yZFNlcGFyYXRvcnM6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxSZXNvdXJjZU1hcDxEb2N1bWVudEhpZ2hsaWdodFtdPj47XG5cblx0cHJpdmF0ZSBfZ2V0Q3VycmVudFdvcmRSYW5nZShtb2RlbDogSVRleHRNb2RlbCwgc2VsZWN0aW9uOiBTZWxlY3Rpb24pOiBSYW5nZSB8IG51bGwge1xuXHRcdGNvbnN0IHdvcmQgPSBtb2RlbC5nZXRXb3JkQXRQb3NpdGlvbihzZWxlY3Rpb24uZ2V0UG9zaXRpb24oKSk7XG5cdFx0aWYgKHdvcmQpIHtcblx0XHRcdHJldHVybiBuZXcgUmFuZ2Uoc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciwgd29yZC5zdGFydENvbHVtbiwgc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciwgd29yZC5lbmRDb2x1bW4pO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHB1YmxpYyBpc1ZhbGlkKG1vZGVsOiBJVGV4dE1vZGVsLCBzZWxlY3Rpb246IFNlbGVjdGlvbiwgZGVjb3JhdGlvbnM6IElFZGl0b3JEZWNvcmF0aW9uc0NvbGxlY3Rpb24pOiBib29sZWFuIHtcblxuXHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyO1xuXHRcdGNvbnN0IHN0YXJ0Q29sdW1uID0gc2VsZWN0aW9uLnN0YXJ0Q29sdW1uO1xuXHRcdGNvbnN0IGVuZENvbHVtbiA9IHNlbGVjdGlvbi5lbmRDb2x1bW47XG5cdFx0Y29uc3QgY3VycmVudFdvcmRSYW5nZSA9IHRoaXMuX2dldEN1cnJlbnRXb3JkUmFuZ2UobW9kZWwsIHNlbGVjdGlvbik7XG5cblx0XHRsZXQgcmVxdWVzdElzVmFsaWQgPSBCb29sZWFuKHRoaXMuX3dvcmRSYW5nZSAmJiB0aGlzLl93b3JkUmFuZ2UuZXF1YWxzUmFuZ2UoY3VycmVudFdvcmRSYW5nZSkpO1xuXG5cdFx0Ly8gRXZlbiBpZiB3ZSBhcmUgb24gYSBkaWZmZXJlbnQgd29yZCwgaWYgdGhhdCB3b3JkIGlzIGluIHRoZSBkZWNvcmF0aW9ucyByYW5nZXMsIHRoZSByZXF1ZXN0IGlzIHN0aWxsIHZhbGlkXG5cdFx0Ly8gKFNhbWUgc3ltYm9sKVxuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBkZWNvcmF0aW9ucy5sZW5ndGg7ICFyZXF1ZXN0SXNWYWxpZCAmJiBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHJhbmdlID0gZGVjb3JhdGlvbnMuZ2V0UmFuZ2UoaSk7XG5cdFx0XHRpZiAocmFuZ2UgJiYgcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyID09PSBsaW5lTnVtYmVyKSB7XG5cdFx0XHRcdGlmIChyYW5nZS5zdGFydENvbHVtbiA8PSBzdGFydENvbHVtbiAmJiByYW5nZS5lbmRDb2x1bW4gPj0gZW5kQ29sdW1uKSB7XG5cdFx0XHRcdFx0cmVxdWVzdElzVmFsaWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlcXVlc3RJc1ZhbGlkO1xuXHR9XG5cblx0cHVibGljIGNhbmNlbCgpOiB2b2lkIHtcblx0XHR0aGlzLnJlc3VsdC5jYW5jZWwoKTtcblx0fVxufVxuXG5jbGFzcyBTZW1hbnRpY09jY3VyZW5jZUF0UG9zaXRpb25SZXF1ZXN0IGV4dGVuZHMgT2NjdXJlbmNlQXRQb3NpdGlvblJlcXVlc3Qge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyczogTGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnk8RG9jdW1lbnRIaWdobGlnaHRQcm92aWRlcj47XG5cblx0Y29uc3RydWN0b3IobW9kZWw6IElUZXh0TW9kZWwsIHNlbGVjdGlvbjogU2VsZWN0aW9uLCB3b3JkU2VwYXJhdG9yczogc3RyaW5nLCBwcm92aWRlcnM6IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5PERvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXI+KSB7XG5cdFx0c3VwZXIobW9kZWwsIHNlbGVjdGlvbiwgd29yZFNlcGFyYXRvcnMpO1xuXHRcdHRoaXMuX3Byb3ZpZGVycyA9IHByb3ZpZGVycztcblx0fVxuXG5cdHByb3RlY3RlZCBfY29tcHV0ZShtb2RlbDogSVRleHRNb2RlbCwgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIHdvcmRTZXBhcmF0b3JzOiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8UmVzb3VyY2VNYXA8RG9jdW1lbnRIaWdobGlnaHRbXT4+IHtcblx0XHRyZXR1cm4gZ2V0T2NjdXJyZW5jZXNBdFBvc2l0aW9uKHRoaXMuX3Byb3ZpZGVycywgbW9kZWwsIHNlbGVjdGlvbi5nZXRQb3NpdGlvbigpLCB0b2tlbikudGhlbih2YWx1ZSA9PiB7XG5cdFx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgUmVzb3VyY2VNYXA8RG9jdW1lbnRIaWdobGlnaHRbXT4oKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9KTtcblx0fVxufVxuXG5jbGFzcyBNdWx0aU1vZGVsT2NjdXJlbmNlUmVxdWVzdCBleHRlbmRzIE9jY3VyZW5jZUF0UG9zaXRpb25SZXF1ZXN0IHtcblx0cHJpdmF0ZSByZWFkb25seSBfcHJvdmlkZXJzOiBMYW5ndWFnZUZlYXR1cmVSZWdpc3RyeTxNdWx0aURvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXI+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vdGhlck1vZGVsczogSVRleHRNb2RlbFtdO1xuXG5cdGNvbnN0cnVjdG9yKG1vZGVsOiBJVGV4dE1vZGVsLCBzZWxlY3Rpb246IFNlbGVjdGlvbiwgd29yZFNlcGFyYXRvcnM6IHN0cmluZywgcHJvdmlkZXJzOiBMYW5ndWFnZUZlYXR1cmVSZWdpc3RyeTxNdWx0aURvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXI+LCBvdGhlck1vZGVsczogSVRleHRNb2RlbFtdKSB7XG5cdFx0c3VwZXIobW9kZWwsIHNlbGVjdGlvbiwgd29yZFNlcGFyYXRvcnMpO1xuXHRcdHRoaXMuX3Byb3ZpZGVycyA9IHByb3ZpZGVycztcblx0XHR0aGlzLl9vdGhlck1vZGVscyA9IG90aGVyTW9kZWxzO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIF9jb21wdXRlKG1vZGVsOiBJVGV4dE1vZGVsLCBzZWxlY3Rpb246IFNlbGVjdGlvbiwgd29yZFNlcGFyYXRvcnM6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxSZXNvdXJjZU1hcDxEb2N1bWVudEhpZ2hsaWdodFtdPj4ge1xuXHRcdHJldHVybiBnZXRPY2N1cnJlbmNlc0Fjcm9zc011bHRpcGxlTW9kZWxzKHRoaXMuX3Byb3ZpZGVycywgbW9kZWwsIHNlbGVjdGlvbi5nZXRQb3NpdGlvbigpLCB0b2tlbiwgdGhpcy5fb3RoZXJNb2RlbHMpLnRoZW4odmFsdWUgPT4ge1xuXHRcdFx0aWYgKCF2YWx1ZSkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFJlc291cmNlTWFwPERvY3VtZW50SGlnaGxpZ2h0W10+KCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fSk7XG5cdH1cbn1cblxuXG5mdW5jdGlvbiBjb21wdXRlT2NjdXJlbmNlc0F0UG9zaXRpb24ocmVnaXN0cnk6IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5PERvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXI+LCBtb2RlbDogSVRleHRNb2RlbCwgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIHdvcmRTZXBhcmF0b3JzOiBzdHJpbmcpOiBJT2NjdXJlbmNlQXRQb3NpdGlvblJlcXVlc3Qge1xuXHRyZXR1cm4gbmV3IFNlbWFudGljT2NjdXJlbmNlQXRQb3NpdGlvblJlcXVlc3QobW9kZWwsIHNlbGVjdGlvbiwgd29yZFNlcGFyYXRvcnMsIHJlZ2lzdHJ5KTtcbn1cblxuZnVuY3Rpb24gY29tcHV0ZU9jY3VyZW5jZXNNdWx0aU1vZGVsKHJlZ2lzdHJ5OiBMYW5ndWFnZUZlYXR1cmVSZWdpc3RyeTxNdWx0aURvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXI+LCBtb2RlbDogSVRleHRNb2RlbCwgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIHdvcmRTZXBhcmF0b3JzOiBzdHJpbmcsIG90aGVyTW9kZWxzOiBJVGV4dE1vZGVsW10pOiBJT2NjdXJlbmNlQXRQb3NpdGlvblJlcXVlc3Qge1xuXHRyZXR1cm4gbmV3IE11bHRpTW9kZWxPY2N1cmVuY2VSZXF1ZXN0KG1vZGVsLCBzZWxlY3Rpb24sIHdvcmRTZXBhcmF0b3JzLCByZWdpc3RyeSwgb3RoZXJNb2RlbHMpO1xufVxuXG5yZWdpc3Rlck1vZGVsQW5kUG9zaXRpb25Db21tYW5kKCdfZXhlY3V0ZURvY3VtZW50SGlnaGxpZ2h0cycsIGFzeW5jIChhY2Nlc3NvciwgbW9kZWwsIHBvc2l0aW9uKSA9PiB7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSk7XG5cdGNvbnN0IG1hcCA9IGF3YWl0IGdldE9jY3VycmVuY2VzQXRQb3NpdGlvbihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyLCBtb2RlbCwgcG9zaXRpb24sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRyZXR1cm4gbWFwPy5nZXQobW9kZWwudXJpKTtcbn0pO1xuXG5jbGFzcyBXb3JkSGlnaGxpZ2h0ZXIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yOiBJQWN0aXZlQ29kZUVkaXRvcjtcblx0cHJpdmF0ZSByZWFkb25seSBwcm92aWRlcnM6IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5PERvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXI+O1xuXHRwcml2YXRlIHJlYWRvbmx5IG11bHRpRG9jdW1lbnRQcm92aWRlcnM6IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5PE11bHRpRG9jdW1lbnRIaWdobGlnaHRQcm92aWRlcj47XG5cdHByaXZhdGUgcmVhZG9ubHkgbW9kZWw6IElUZXh0TW9kZWw7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGVjb3JhdGlvbnM6IElFZGl0b3JEZWNvcmF0aW9uc0NvbGxlY3Rpb247XG5cdHByaXZhdGUgcmVhZG9ubHkgdG9Vbmhvb2sgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSB0ZXh0TW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZTtcblx0cHJpdmF0ZSByZWFkb25seSBjb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2U7XG5cblx0cHJpdmF0ZSBvY2N1cnJlbmNlc0hpZ2hsaWdodEVuYWJsZW1lbnQ6IHN0cmluZztcblx0cHJpdmF0ZSBvY2N1cnJlbmNlc0hpZ2hsaWdodERlbGF5OiBudW1iZXI7XG5cblx0cHJpdmF0ZSB3b3JrZXJSZXF1ZXN0VG9rZW5JZDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSB3b3JrZXJSZXF1ZXN0OiBJT2NjdXJlbmNlQXRQb3NpdGlvblJlcXVlc3QgfCBudWxsO1xuXHRwcml2YXRlIHdvcmtlclJlcXVlc3RDb21wbGV0ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSB3b3JrZXJSZXF1ZXN0VmFsdWU6IFJlc291cmNlTWFwPERvY3VtZW50SGlnaGxpZ2h0W10+ID0gbmV3IFJlc291cmNlTWFwKCk7XG5cblx0cHJpdmF0ZSBsYXN0Q3Vyc29yUG9zaXRpb25DaGFuZ2VUaW1lOiBudW1iZXIgPSAwO1xuXHRwcml2YXRlIHJlbmRlckRlY29yYXRpb25zVGltZXI6IGFueSA9IC0xO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2hhc1dvcmRIaWdobGlnaHRzOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfaWdub3JlUG9zaXRpb25DaGFuZ2VFdmVudDogYm9vbGVhbjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHJ1bkRlbGF5ZXI6IERlbGF5ZXI8dm9pZD4gPSB0aGlzLnRvVW5ob29rLmFkZChuZXcgRGVsYXllcjx2b2lkPig1MCkpO1xuXG5cdHByaXZhdGUgc3RhdGljIHN0b3JlZERlY29yYXRpb25JRHM6IFJlc291cmNlTWFwPHN0cmluZ1tdPiA9IG5ldyBSZXNvdXJjZU1hcCgpO1xuXHRwcml2YXRlIHN0YXRpYyBxdWVyeTogSVdvcmRIaWdobGlnaHRlclF1ZXJ5IHwgbnVsbCA9IG51bGw7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZWRpdG9yOiBJQWN0aXZlQ29kZUVkaXRvcixcblx0XHRwcm92aWRlcnM6IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5PERvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXI+LFxuXHRcdG11bHRpUHJvdmlkZXJzOiBMYW5ndWFnZUZlYXR1cmVSZWdpc3RyeTxNdWx0aURvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXI+LFxuXHRcdGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHRleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLmVkaXRvciA9IGVkaXRvcjtcblx0XHR0aGlzLnByb3ZpZGVycyA9IHByb3ZpZGVycztcblx0XHR0aGlzLm11bHRpRG9jdW1lbnRQcm92aWRlcnMgPSBtdWx0aVByb3ZpZGVycztcblxuXHRcdHRoaXMuY29kZUVkaXRvclNlcnZpY2UgPSBjb2RlRWRpdG9yU2VydmljZTtcblx0XHR0aGlzLnRleHRNb2RlbFNlcnZpY2UgPSB0ZXh0TW9kZWxTZXJ2aWNlO1xuXHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UgPSBjb25maWd1cmF0aW9uU2VydmljZTtcblx0XHR0aGlzLmxvZ1NlcnZpY2UgPSBsb2dTZXJ2aWNlO1xuXG5cdFx0dGhpcy5faGFzV29yZEhpZ2hsaWdodHMgPSBjdHhIYXNXb3JkSGlnaGxpZ2h0cy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2lnbm9yZVBvc2l0aW9uQ2hhbmdlRXZlbnQgPSBmYWxzZTtcblx0XHR0aGlzLm9jY3VycmVuY2VzSGlnaGxpZ2h0RW5hYmxlbWVudCA9IHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ub2NjdXJyZW5jZXNIaWdobGlnaHQpO1xuXHRcdHRoaXMub2NjdXJyZW5jZXNIaWdobGlnaHREZWxheSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPignZWRpdG9yLm9jY3VycmVuY2VzSGlnaGxpZ2h0RGVsYXknKTtcblx0XHR0aGlzLm1vZGVsID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKTtcblxuXHRcdHRoaXMudG9Vbmhvb2suYWRkKGVkaXRvci5vbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uKChlOiBJQ3Vyc29yUG9zaXRpb25DaGFuZ2VkRXZlbnQpID0+IHtcblx0XHRcdGlmICh0aGlzLl9pZ25vcmVQb3NpdGlvbkNoYW5nZUV2ZW50KSB7XG5cdFx0XHRcdC8vIFdlIGFyZSBjaGFuZ2luZyB0aGUgcG9zaXRpb24gPT4gaWdub3JlIHRoaXMgZXZlbnRcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5vY2N1cnJlbmNlc0hpZ2hsaWdodEVuYWJsZW1lbnQgPT09ICdvZmYnKSB7XG5cdFx0XHRcdC8vIEVhcmx5IGV4aXQgaWYgbm90aGluZyBuZWVkcyB0byBiZSBkb25lIVxuXHRcdFx0XHQvLyBMZWF2ZSBzb21lIGZvcm0gb2YgZWFybHkgZXhpdCBjaGVjayBoZXJlIGlmIHlvdSB3aXNoIHRvIGNvbnRpbnVlIGJlaW5nIGEgY3Vyc29yIHBvc2l0aW9uIGNoYW5nZSBsaXN0ZW5lciA7KVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMucnVuRGVsYXllci50cmlnZ2VyKCgpID0+IHsgdGhpcy5fb25Qb3NpdGlvbkNoYW5nZWQoZSk7IH0pO1xuXHRcdH0pKTtcblx0XHR0aGlzLnRvVW5ob29rLmFkZChlZGl0b3Iub25EaWRGb2N1c0VkaXRvclRleHQoKGUpID0+IHtcblx0XHRcdGlmICh0aGlzLm9jY3VycmVuY2VzSGlnaGxpZ2h0RW5hYmxlbWVudCA9PT0gJ29mZicpIHtcblx0XHRcdFx0Ly8gRWFybHkgZXhpdCBpZiBub3RoaW5nIG5lZWRzIHRvIGJlIGRvbmVcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXRoaXMud29ya2VyUmVxdWVzdCkge1xuXHRcdFx0XHR0aGlzLnJ1bkRlbGF5ZXIudHJpZ2dlcigoKSA9PiB7IHRoaXMuX3J1bigpOyB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy50b1VuaG9vay5hZGQoZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KChlKSA9PiB7XG5cdFx0XHRpZiAoIW1hdGNoZXNTY2hlbWUodGhpcy5tb2RlbC51cmksICdvdXRwdXQnKSkge1xuXHRcdFx0XHR0aGlzLl9zdG9wQWxsKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMudG9Vbmhvb2suYWRkKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsKChlKSA9PiB7XG5cdFx0XHRpZiAoIWUubmV3TW9kZWxVcmwgJiYgZS5vbGRNb2RlbFVybCkge1xuXHRcdFx0XHR0aGlzLl9zdG9wU2luZ3VsYXIoKTtcblx0XHRcdH0gZWxzZSBpZiAoV29yZEhpZ2hsaWdodGVyLnF1ZXJ5KSB7XG5cdFx0XHRcdHRoaXMuX3J1bigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLnRvVW5ob29rLmFkZChlZGl0b3Iub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKChlKSA9PiB7XG5cdFx0XHRjb25zdCBuZXdFbmFibGVtZW50ID0gdGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5vY2N1cnJlbmNlc0hpZ2hsaWdodCk7XG5cdFx0XHRpZiAodGhpcy5vY2N1cnJlbmNlc0hpZ2hsaWdodEVuYWJsZW1lbnQgIT09IG5ld0VuYWJsZW1lbnQpIHtcblx0XHRcdFx0dGhpcy5vY2N1cnJlbmNlc0hpZ2hsaWdodEVuYWJsZW1lbnQgPSBuZXdFbmFibGVtZW50O1xuXHRcdFx0XHRzd2l0Y2ggKG5ld0VuYWJsZW1lbnQpIHtcblx0XHRcdFx0XHRjYXNlICdvZmYnOlxuXHRcdFx0XHRcdFx0dGhpcy5fc3RvcEFsbCgpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnc2luZ2xlRmlsZSc6XG5cdFx0XHRcdFx0XHR0aGlzLl9zdG9wQWxsKFdvcmRIaWdobGlnaHRlci5xdWVyeT8ubW9kZWxJbmZvPy5tb2RlbFVSSSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICdtdWx0aUZpbGUnOlxuXHRcdFx0XHRcdFx0aWYgKFdvcmRIaWdobGlnaHRlci5xdWVyeSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9ydW4odHJ1ZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdFx0Y29uc29sZS53YXJuKCdVbmtub3duIG9jY3VycmVuY2VzSGlnaGxpZ2h0IHNldHRpbmcgdmFsdWU6JywgbmV3RW5hYmxlbWVudCk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLnRvVW5ob29rLmFkZCh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoZSkgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2VkaXRvci5vY2N1cnJlbmNlc0hpZ2hsaWdodERlbGF5JykpIHtcblx0XHRcdFx0Y29uc3QgbmV3RGVsYXkgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KCdlZGl0b3Iub2NjdXJyZW5jZXNIaWdobGlnaHREZWxheScpO1xuXHRcdFx0XHRpZiAodGhpcy5vY2N1cnJlbmNlc0hpZ2hsaWdodERlbGF5ICE9PSBuZXdEZWxheSkge1xuXHRcdFx0XHRcdHRoaXMub2NjdXJyZW5jZXNIaWdobGlnaHREZWxheSA9IG5ld0RlbGF5O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMudG9Vbmhvb2suYWRkKGVkaXRvci5vbkRpZEJsdXJFZGl0b3JXaWRnZXQoKCkgPT4ge1xuXHRcdFx0Ly8gbG9naWMgaXMgYXMgZm9sbG93c1xuXHRcdFx0Ly8gLSBkaWRCbHVyID0+IGFjdGl2ZSBudWxsID0+IHN0b3BhbGxcblx0XHRcdC8vIC0gZGlkQmx1ciA9PiBhY3RpdmUgbmIgICA9PiBpZiB0aGlzLmVkaXRvciBpcyBub3RlYm9vaywgZG8gbm90aGluZyAobmV3IGNlbGwsIHNvIHdlIGRvbid0IHdhbnQgdG8gc3RvcEFsbClcblx0XHRcdC8vICAgICAgICAgICAgICBhY3RpdmUgbmIgICA9PiBpZiB0aGlzLmVkaXRvciBpcyBOT1QgbmIsICAgc3RvcEFsbFxuXG5cdFx0XHRjb25zdCBhY3RpdmVFZGl0b3IgPSB0aGlzLmNvZGVFZGl0b3JTZXJ2aWNlLmdldEZvY3VzZWRDb2RlRWRpdG9yKCk7XG5cdFx0XHRpZiAoIWFjdGl2ZUVkaXRvcikgeyAvLyBjbGlja2VkIGludG8gbmIgY2VsbCBsaXN0LCBvdXRsaW5lLCB0ZXJtaW5hbCwgZXRjXG5cdFx0XHRcdHRoaXMuX3N0b3BBbGwoKTtcblx0XHRcdH0gZWxzZSBpZiAoYWN0aXZlRWRpdG9yLmdldE1vZGVsKCk/LnVyaS5zY2hlbWUgPT09IFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsICYmIHRoaXMuZWRpdG9yLmdldE1vZGVsKCk/LnVyaS5zY2hlbWUgIT09IFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsKSB7IC8vIHN3aXRjaGVkIHRhYnMgZnJvbSBub24tbmIgdG8gbmJcblx0XHRcdFx0dGhpcy5fc3RvcEFsbCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuZGVjb3JhdGlvbnMgPSB0aGlzLmVkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oKTtcblx0XHR0aGlzLndvcmtlclJlcXVlc3RUb2tlbklkID0gMDtcblx0XHR0aGlzLndvcmtlclJlcXVlc3QgPSBudWxsO1xuXHRcdHRoaXMud29ya2VyUmVxdWVzdENvbXBsZXRlZCA9IGZhbHNlO1xuXG5cdFx0dGhpcy5sYXN0Q3Vyc29yUG9zaXRpb25DaGFuZ2VUaW1lID0gMDtcblx0XHR0aGlzLnJlbmRlckRlY29yYXRpb25zVGltZXIgPSAtMTtcblxuXHRcdC8vIGlmIHRoZXJlIGlzIGEgcXVlcnkgYWxyZWFkeSwgaGlnaGxpZ2h0IG9mZiB0aGF0IHF1ZXJ5XG5cdFx0aWYgKFdvcmRIaWdobGlnaHRlci5xdWVyeSkge1xuXHRcdFx0dGhpcy5fcnVuKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGhhc0RlY29yYXRpb25zKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAodGhpcy5kZWNvcmF0aW9ucy5sZW5ndGggPiAwKTtcblx0fVxuXG5cdHB1YmxpYyByZXN0b3JlKGRlbGF5OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5vY2N1cnJlbmNlc0hpZ2hsaWdodEVuYWJsZW1lbnQgPT09ICdvZmYnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5ydW5EZWxheWVyLmNhbmNlbCgpO1xuXHRcdHRoaXMucnVuRGVsYXllci50cmlnZ2VyKCgpID0+IHsgdGhpcy5fcnVuKGZhbHNlLCBkZWxheSk7IH0pO1xuXHR9XG5cblx0cHVibGljIHRyaWdnZXIoKSB7XG5cdFx0dGhpcy5ydW5EZWxheWVyLmNhbmNlbCgpO1xuXHRcdHRoaXMuX3J1bihmYWxzZSwgMCk7IC8vIGltbWVkaWF0ZSByZW5kZXJpbmcgKGRlbGF5ID0gMClcblx0fVxuXG5cdHB1YmxpYyBzdG9wKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLm9jY3VycmVuY2VzSGlnaGxpZ2h0RW5hYmxlbWVudCA9PT0gJ29mZicpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9zdG9wQWxsKCk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRTb3J0ZWRIaWdobGlnaHRzKCk6IFJhbmdlW10ge1xuXHRcdHJldHVybiAoXG5cdFx0XHR0aGlzLmRlY29yYXRpb25zLmdldFJhbmdlcygpXG5cdFx0XHRcdC5zb3J0KFJhbmdlLmNvbXBhcmVSYW5nZXNVc2luZ1N0YXJ0cylcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIG1vdmVOZXh0KCkge1xuXHRcdGNvbnN0IGhpZ2hsaWdodHMgPSB0aGlzLl9nZXRTb3J0ZWRIaWdobGlnaHRzKCk7XG5cdFx0Y29uc3QgaW5kZXggPSBoaWdobGlnaHRzLmZpbmRJbmRleCgocmFuZ2UpID0+IHJhbmdlLmNvbnRhaW5zUG9zaXRpb24odGhpcy5lZGl0b3IuZ2V0UG9zaXRpb24oKSkpO1xuXHRcdGNvbnN0IG5ld0luZGV4ID0gKChpbmRleCArIDEpICUgaGlnaGxpZ2h0cy5sZW5ndGgpO1xuXHRcdGNvbnN0IGRlc3QgPSBoaWdobGlnaHRzW25ld0luZGV4XTtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5faWdub3JlUG9zaXRpb25DaGFuZ2VFdmVudCA9IHRydWU7XG5cdFx0XHR0aGlzLmVkaXRvci5zZXRQb3NpdGlvbihkZXN0LmdldFN0YXJ0UG9zaXRpb24oKSk7XG5cdFx0XHR0aGlzLmVkaXRvci5yZXZlYWxSYW5nZUluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQoZGVzdCk7XG5cdFx0XHRjb25zdCB3b3JkID0gdGhpcy5fZ2V0V29yZCgpO1xuXHRcdFx0aWYgKHdvcmQpIHtcblx0XHRcdFx0Y29uc3QgbGluZUNvbnRlbnQgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpLmdldExpbmVDb250ZW50KGRlc3Quc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdFx0YWxlcnQoYCR7bGluZUNvbnRlbnR9LCAke25ld0luZGV4ICsgMX0gb2YgJHtoaWdobGlnaHRzLmxlbmd0aH0gZm9yICcke3dvcmQud29yZH0nYCk7XG5cdFx0XHR9XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX2lnbm9yZVBvc2l0aW9uQ2hhbmdlRXZlbnQgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgbW92ZUJhY2soKSB7XG5cdFx0Y29uc3QgaGlnaGxpZ2h0cyA9IHRoaXMuX2dldFNvcnRlZEhpZ2hsaWdodHMoKTtcblx0XHRjb25zdCBpbmRleCA9IGhpZ2hsaWdodHMuZmluZEluZGV4KChyYW5nZSkgPT4gcmFuZ2UuY29udGFpbnNQb3NpdGlvbih0aGlzLmVkaXRvci5nZXRQb3NpdGlvbigpKSk7XG5cdFx0Y29uc3QgbmV3SW5kZXggPSAoKGluZGV4IC0gMSArIGhpZ2hsaWdodHMubGVuZ3RoKSAlIGhpZ2hsaWdodHMubGVuZ3RoKTtcblx0XHRjb25zdCBkZXN0ID0gaGlnaGxpZ2h0c1tuZXdJbmRleF07XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuX2lnbm9yZVBvc2l0aW9uQ2hhbmdlRXZlbnQgPSB0cnVlO1xuXHRcdFx0dGhpcy5lZGl0b3Iuc2V0UG9zaXRpb24oZGVzdC5nZXRTdGFydFBvc2l0aW9uKCkpO1xuXHRcdFx0dGhpcy5lZGl0b3IucmV2ZWFsUmFuZ2VJbkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0KGRlc3QpO1xuXHRcdFx0Y29uc3Qgd29yZCA9IHRoaXMuX2dldFdvcmQoKTtcblx0XHRcdGlmICh3b3JkKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmVDb250ZW50ID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKS5nZXRMaW5lQ29udGVudChkZXN0LnN0YXJ0TGluZU51bWJlcik7XG5cdFx0XHRcdGFsZXJ0KGAke2xpbmVDb250ZW50fSwgJHtuZXdJbmRleCArIDF9IG9mICR7aGlnaGxpZ2h0cy5sZW5ndGh9IGZvciAnJHt3b3JkLndvcmR9J2ApO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLl9pZ25vcmVQb3NpdGlvbkNoYW5nZUV2ZW50ID0gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVtb3ZlU2luZ2xlRGVjb3JhdGlvbnMoKTogdm9pZCB7XG5cdFx0Ly8gcmV0dXJuIGlmIG5vIG1vZGVsXG5cdFx0aWYgKCF0aGlzLmVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3VycmVudERlY29yYXRpb25JRHMgPSBXb3JkSGlnaGxpZ2h0ZXIuc3RvcmVkRGVjb3JhdGlvbklEcy5nZXQodGhpcy5lZGl0b3IuZ2V0TW9kZWwoKS51cmkpO1xuXHRcdGlmICghY3VycmVudERlY29yYXRpb25JRHMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmVkaXRvci5yZW1vdmVEZWNvcmF0aW9ucyhjdXJyZW50RGVjb3JhdGlvbklEcyk7XG5cdFx0V29yZEhpZ2hsaWdodGVyLnN0b3JlZERlY29yYXRpb25JRHMuZGVsZXRlKHRoaXMuZWRpdG9yLmdldE1vZGVsKCkudXJpKTtcblxuXHRcdGlmICh0aGlzLmRlY29yYXRpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuZGVjb3JhdGlvbnMuY2xlYXIoKTtcblx0XHRcdHRoaXMuX2hhc1dvcmRIaWdobGlnaHRzLnNldChmYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVtb3ZlQWxsRGVjb3JhdGlvbnMocHJlc2VydmVkTW9kZWw/OiBVUkkpOiB2b2lkIHtcblx0XHRjb25zdCBjdXJyZW50RWRpdG9ycyA9IHRoaXMuY29kZUVkaXRvclNlcnZpY2UubGlzdENvZGVFZGl0b3JzKCk7XG5cdFx0Y29uc3QgZGVsZXRlVVJJID0gW107XG5cdFx0Ly8gaXRlcmF0ZSBvdmVyIGVkaXRvcnMgYW5kIHN0b3JlIG1vZGVscyBpbiBjdXJyZW50TW9kZWxzXG5cdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgY3VycmVudEVkaXRvcnMpIHtcblx0XHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkgfHwgaXNFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKS51cmksIHByZXNlcnZlZE1vZGVsKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY3VycmVudERlY29yYXRpb25JRHMgPSBXb3JkSGlnaGxpZ2h0ZXIuc3RvcmVkRGVjb3JhdGlvbklEcy5nZXQoZWRpdG9yLmdldE1vZGVsKCkudXJpKTtcblx0XHRcdGlmICghY3VycmVudERlY29yYXRpb25JRHMpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvci5yZW1vdmVEZWNvcmF0aW9ucyhjdXJyZW50RGVjb3JhdGlvbklEcyk7XG5cdFx0XHRkZWxldGVVUkkucHVzaChlZGl0b3IuZ2V0TW9kZWwoKS51cmkpO1xuXG5cdFx0XHRjb25zdCBlZGl0b3JIaWdobGlnaHRlckNvbnRyaWIgPSBXb3JkSGlnaGxpZ2h0ZXJDb250cmlidXRpb24uZ2V0KGVkaXRvcik7XG5cdFx0XHRpZiAoIWVkaXRvckhpZ2hsaWdodGVyQ29udHJpYj8ud29yZEhpZ2hsaWdodGVyKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZWRpdG9ySGlnaGxpZ2h0ZXJDb250cmliLndvcmRIaWdobGlnaHRlci5kZWNvcmF0aW9ucy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGVkaXRvckhpZ2hsaWdodGVyQ29udHJpYi53b3JkSGlnaGxpZ2h0ZXIuZGVjb3JhdGlvbnMuY2xlYXIoKTtcblx0XHRcdFx0ZWRpdG9ySGlnaGxpZ2h0ZXJDb250cmliLndvcmRIaWdobGlnaHRlci53b3JrZXJSZXF1ZXN0ID0gbnVsbDtcblx0XHRcdFx0ZWRpdG9ySGlnaGxpZ2h0ZXJDb250cmliLndvcmRIaWdobGlnaHRlci5faGFzV29yZEhpZ2hsaWdodHMuc2V0KGZhbHNlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IHVyaSBvZiBkZWxldGVVUkkpIHtcblx0XHRcdFdvcmRIaWdobGlnaHRlci5zdG9yZWREZWNvcmF0aW9uSURzLmRlbGV0ZSh1cmkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3N0b3BTaW5ndWxhcigpOiB2b2lkIHtcblx0XHQvLyBSZW1vdmUgYW55IGV4aXN0aW5nIGRlY29yYXRpb25zICsgYSBwb3NzaWJsZSBxdWVyeSwgYW5kIHJlIC0gcnVuIHRvIHVwZGF0ZSBkZWNvcmF0aW9uc1xuXHRcdHRoaXMuX3JlbW92ZVNpbmdsZURlY29yYXRpb25zKCk7XG5cblx0XHRpZiAodGhpcy5lZGl0b3IuaGFzVGV4dEZvY3VzKCkpIHtcblx0XHRcdGlmICh0aGlzLmVkaXRvci5nZXRNb2RlbCgpPy51cmkuc2NoZW1lICE9PSBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbCAmJiBXb3JkSGlnaGxpZ2h0ZXIucXVlcnk/Lm1vZGVsSW5mbz8ubW9kZWxVUkkuc2NoZW1lICE9PSBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbCkgeyAvLyBjbGVhciBxdWVyeSBpZiBmb2N1c2VkIG5vbi1uYiBlZGl0b3Jcblx0XHRcdFx0V29yZEhpZ2hsaWdodGVyLnF1ZXJ5ID0gbnVsbDtcblx0XHRcdFx0dGhpcy5fcnVuKCk7IC8vIFRPRE86IEBZb3lva3JhenkgLS0gaW52ZXN0aWdhdGUgd2h5IHdlIG5lZWQgYSBmdWxsIHJlcnVuIGhlcmUuIGxpa2VseSBhZGRyZXNzZWQgYSBjYXNlL3BhdGNoIGluIHRoZSBmaXJzdCBpdGVyYXRpb24gb2YgdGhpcyBmZWF0dXJlXG5cdFx0XHR9IGVsc2UgeyAvLyByZW1vdmUgbW9kZWxJbmZvIHRvIGFjY291bnQgZm9yIG5iIGNlbGwgYmVpbmcgZGlzcG9zZWRcblx0XHRcdFx0aWYgKFdvcmRIaWdobGlnaHRlci5xdWVyeT8ubW9kZWxJbmZvKSB7XG5cdFx0XHRcdFx0V29yZEhpZ2hsaWdodGVyLnF1ZXJ5Lm1vZGVsSW5mbyA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBDYW5jZWwgYW55IHJlbmRlckRlY29yYXRpb25zVGltZXJcblx0XHRpZiAodGhpcy5yZW5kZXJEZWNvcmF0aW9uc1RpbWVyICE9PSAtMSkge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMucmVuZGVyRGVjb3JhdGlvbnNUaW1lcik7XG5cdFx0XHR0aGlzLnJlbmRlckRlY29yYXRpb25zVGltZXIgPSAtMTtcblx0XHR9XG5cblx0XHQvLyBDYW5jZWwgYW55IHdvcmtlciByZXF1ZXN0XG5cdFx0aWYgKHRoaXMud29ya2VyUmVxdWVzdCAhPT0gbnVsbCkge1xuXHRcdFx0dGhpcy53b3JrZXJSZXF1ZXN0LmNhbmNlbCgpO1xuXHRcdFx0dGhpcy53b3JrZXJSZXF1ZXN0ID0gbnVsbDtcblx0XHR9XG5cblx0XHQvLyBJbnZhbGlkYXRlIGFueSB3b3JrZXIgcmVxdWVzdCBjYWxsYmFja1xuXHRcdGlmICghdGhpcy53b3JrZXJSZXF1ZXN0Q29tcGxldGVkKSB7XG5cdFx0XHR0aGlzLndvcmtlclJlcXVlc3RUb2tlbklkKys7XG5cdFx0XHR0aGlzLndvcmtlclJlcXVlc3RDb21wbGV0ZWQgPSB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3N0b3BBbGwocHJlc2VydmVkTW9kZWw/OiBVUkkpOiB2b2lkIHtcblx0XHQvLyBSZW1vdmUgYW55IGV4aXN0aW5nIGRlY29yYXRpb25zXG5cdFx0Ly8gVE9ETzogQFlveW9rcmF6eSAtLSB0aGlzIHRyaWdnZXJzIGFzIG5vdGVib29rcyBzY3JvbGwsIGNhdXNpbmcgaGlnaGxpZ2h0cyB0byBkaXNhcHBlYXIgbW9tZW50YXJpbHkuXG5cdFx0Ly8gbWF5YmUgYSBuYiB0eXBlIGNoZWNrP1xuXHRcdHRoaXMuX3JlbW92ZUFsbERlY29yYXRpb25zKHByZXNlcnZlZE1vZGVsKTtcblxuXHRcdC8vIENhbmNlbCBhbnkgcmVuZGVyRGVjb3JhdGlvbnNUaW1lclxuXHRcdGlmICh0aGlzLnJlbmRlckRlY29yYXRpb25zVGltZXIgIT09IC0xKSB7XG5cdFx0XHRjbGVhclRpbWVvdXQodGhpcy5yZW5kZXJEZWNvcmF0aW9uc1RpbWVyKTtcblx0XHRcdHRoaXMucmVuZGVyRGVjb3JhdGlvbnNUaW1lciA9IC0xO1xuXHRcdH1cblxuXHRcdC8vIENhbmNlbCBhbnkgd29ya2VyIHJlcXVlc3Rcblx0XHRpZiAodGhpcy53b3JrZXJSZXF1ZXN0ICE9PSBudWxsKSB7XG5cdFx0XHR0aGlzLndvcmtlclJlcXVlc3QuY2FuY2VsKCk7XG5cdFx0XHR0aGlzLndvcmtlclJlcXVlc3QgPSBudWxsO1xuXHRcdH1cblxuXHRcdC8vIEludmFsaWRhdGUgYW55IHdvcmtlciByZXF1ZXN0IGNhbGxiYWNrXG5cdFx0aWYgKCF0aGlzLndvcmtlclJlcXVlc3RDb21wbGV0ZWQpIHtcblx0XHRcdHRoaXMud29ya2VyUmVxdWVzdFRva2VuSWQrKztcblx0XHRcdHRoaXMud29ya2VyUmVxdWVzdENvbXBsZXRlZCA9IHRydWU7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfb25Qb3NpdGlvbkNoYW5nZWQoZTogSUN1cnNvclBvc2l0aW9uQ2hhbmdlZEV2ZW50KTogdm9pZCB7XG5cblx0XHQvLyBkaXNhYmxlZFxuXHRcdGlmICh0aGlzLm9jY3VycmVuY2VzSGlnaGxpZ2h0RW5hYmxlbWVudCA9PT0gJ29mZicpIHtcblx0XHRcdHRoaXMuX3N0b3BBbGwoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBpZ25vcmUgdHlwaW5nICYgb3RoZXJcblx0XHQvLyBuZWVkIHRvIGNoZWNrIGlmIHRoZSBtb2RlbCBpcyBhIG5vdGVib29rIGNlbGwsIHNob3VsZCBub3Qgc3RvcCBpZiBuYlxuXHRcdGlmIChlLnNvdXJjZSAhPT0gJ2FwaScgJiYgZS5yZWFzb24gIT09IEN1cnNvckNoYW5nZVJlYXNvbi5FeHBsaWNpdCkge1xuXHRcdFx0dGhpcy5fc3RvcEFsbCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3J1bigpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0V29yZCgpOiBJV29yZEF0UG9zaXRpb24gfCBudWxsIHtcblx0XHRjb25zdCBlZGl0b3JTZWxlY3Rpb24gPSB0aGlzLmVkaXRvci5nZXRTZWxlY3Rpb24oKTtcblx0XHRjb25zdCBsaW5lTnVtYmVyID0gZWRpdG9yU2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlcjtcblx0XHRjb25zdCBzdGFydENvbHVtbiA9IGVkaXRvclNlbGVjdGlvbi5zdGFydENvbHVtbjtcblxuXHRcdGlmICh0aGlzLm1vZGVsLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuZ2V0V29yZEF0UG9zaXRpb24oe1xuXHRcdFx0bGluZU51bWJlcjogbGluZU51bWJlcixcblx0XHRcdGNvbHVtbjogc3RhcnRDb2x1bW5cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0T3RoZXJNb2RlbHNUb0hpZ2hsaWdodChtb2RlbDogSVRleHRNb2RlbCk6IElUZXh0TW9kZWxbXSB7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdC8vIG5vdGVib29rIGNhc2Vcblx0XHRjb25zdCBpc05vdGVib29rRWRpdG9yID0gbW9kZWwudXJpLnNjaGVtZSA9PT0gU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGw7XG5cdFx0aWYgKGlzTm90ZWJvb2tFZGl0b3IpIHtcblx0XHRcdGNvbnN0IGN1cnJlbnRNb2RlbHM6IElUZXh0TW9kZWxbXSA9IFtdO1xuXHRcdFx0Y29uc3QgY3VycmVudEVkaXRvcnMgPSB0aGlzLmNvZGVFZGl0b3JTZXJ2aWNlLmxpc3RDb2RlRWRpdG9ycygpO1xuXHRcdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgY3VycmVudEVkaXRvcnMpIHtcblx0XHRcdFx0Y29uc3QgdGVtcE1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0XHRcdGlmICh0ZW1wTW9kZWwgJiYgdGVtcE1vZGVsICE9PSBtb2RlbCAmJiB0ZW1wTW9kZWwudXJpLnNjaGVtZSA9PT0gU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGwpIHtcblx0XHRcdFx0XHRjdXJyZW50TW9kZWxzLnB1c2godGVtcE1vZGVsKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGN1cnJlbnRNb2RlbHM7XG5cdFx0fVxuXG5cdFx0Ly8gaW5saW5lIGNhc2Vcblx0XHQvLyA/IGN1cnJlbnQgd29ya3Mgd2hlbiBoaWdobGlnaHRpbmcgb3V0c2lkZSBvZiBhbiBpbmxpbmUgZGlmZiwgaGlnaGxpZ2h0aW5nIGluLlxuXHRcdC8vID8gYnJva2VuIHdoZW4gaGlnaGxpZ2h0aW5nIHdpdGhpbiBhIGRpZmYgZWRpdG9yLiBoaWdobGlnaHRpbmcgdGhlIG1haW4gZWRpdG9yIGRvZXMgbm90IHdvcmtcblx0XHQvLyA/IGVkaXRvciBncm91cCBzZXJ2aWNlIGNvdWxkIGJlIHVzZWZ1bCBoZXJlXG5cdFx0Y29uc3QgY3VycmVudE1vZGVsczogSVRleHRNb2RlbFtdID0gW107XG5cdFx0Y29uc3QgY3VycmVudEVkaXRvcnMgPSB0aGlzLmNvZGVFZGl0b3JTZXJ2aWNlLmxpc3RDb2RlRWRpdG9ycygpO1xuXHRcdGZvciAoY29uc3QgZWRpdG9yIG9mIGN1cnJlbnRFZGl0b3JzKSB7XG5cdFx0XHRpZiAoIWlzRGlmZkVkaXRvcihlZGl0b3IpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZGlmZk1vZGVsID0gKGVkaXRvciBhcyBJRGlmZkVkaXRvcikuZ2V0TW9kZWwoKTtcblx0XHRcdGlmICghZGlmZk1vZGVsKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG1vZGVsID09PSBkaWZmTW9kZWwubW9kaWZpZWQpIHsgLy8gZW1iZWRkZWQgaW5saW5lIGNoYXQgZGlmZiB3b3VsZCBwYXNzIHRoaXMsIGFsbG93aW5nIGhpZ2hsaWdodHNcblx0XHRcdFx0Ly8/IGN1cnJlbnRNb2RlbHMucHVzaChkaWZmTW9kZWwub3JpZ2luYWwpO1xuXHRcdFx0XHRjdXJyZW50TW9kZWxzLnB1c2goZGlmZk1vZGVsLm1vZGlmaWVkKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGN1cnJlbnRNb2RlbHMubGVuZ3RoKSB7IC8vIG5vIG1hdGNoaW5nIGVkaXRvcnMgaGF2ZSBiZWVuIGZvdW5kXG5cdFx0XHRyZXR1cm4gY3VycmVudE1vZGVscztcblx0XHR9XG5cblx0XHQvLyBtdWx0aS1kb2MgT0ZGXG5cdFx0aWYgKHRoaXMub2NjdXJyZW5jZXNIaWdobGlnaHRFbmFibGVtZW50ID09PSAnc2luZ2xlRmlsZScpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHQvLyBtdWx0aS1kb2MgT05cblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBjdXJyZW50RWRpdG9ycykge1xuXHRcdFx0Y29uc3QgdGVtcE1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cblx0XHRcdGNvbnN0IGlzVmFsaWRNb2RlbCA9IHRlbXBNb2RlbCAmJiB0ZW1wTW9kZWwgIT09IG1vZGVsO1xuXG5cdFx0XHRpZiAoaXNWYWxpZE1vZGVsKSB7XG5cdFx0XHRcdGN1cnJlbnRNb2RlbHMucHVzaCh0ZW1wTW9kZWwpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gY3VycmVudE1vZGVscztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3J1bihtdWx0aUZpbGVDb25maWdDaGFuZ2U/OiBib29sZWFuLCBkZWxheT86IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Y29uc3QgaGFzVGV4dEZvY3VzID0gdGhpcy5lZGl0b3IuaGFzVGV4dEZvY3VzKCk7XG5cdFx0aWYgKCFoYXNUZXh0Rm9jdXMpIHsgLy8gbmV3IG5iIGNlbGwgc2Nyb2xsZWQgaW4sIGRpZENoYW5nZU1vZGVsIGZpcmVzXG5cdFx0XHRpZiAoIVdvcmRIaWdobGlnaHRlci5xdWVyeSkgeyAvLyBubyBwcmV2aW91cyBxdWVyeSwgbm90aGluZyB0byBoaWdobGlnaHQgb2ZmIG9mXG5cdFx0XHRcdHRoaXMuX3N0b3BBbGwoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7IC8vIGhhcyB0ZXh0IGZvY3VzXG5cdFx0XHRjb25zdCBlZGl0b3JTZWxlY3Rpb24gPSB0aGlzLmVkaXRvci5nZXRTZWxlY3Rpb24oKTtcblxuXHRcdFx0Ly8gaWdub3JlIG11bHRpbGluZSBzZWxlY3Rpb25cblx0XHRcdGlmICghZWRpdG9yU2VsZWN0aW9uIHx8IGVkaXRvclNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIgIT09IGVkaXRvclNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdFdvcmRIaWdobGlnaHRlci5xdWVyeSA9IG51bGw7XG5cdFx0XHRcdHRoaXMuX3N0b3BBbGwoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzdGFydENvbHVtbiA9IGVkaXRvclNlbGVjdGlvbi5zdGFydENvbHVtbjtcblx0XHRcdGNvbnN0IGVuZENvbHVtbiA9IGVkaXRvclNlbGVjdGlvbi5lbmRDb2x1bW47XG5cblx0XHRcdGNvbnN0IHdvcmQgPSB0aGlzLl9nZXRXb3JkKCk7XG5cblx0XHRcdC8vIFRoZSBzZWxlY3Rpb24gbXVzdCBiZSBpbnNpZGUgYSB3b3JkIG9yIHN1cnJvdW5kIG9uZSB3b3JkIGF0IG1vc3Rcblx0XHRcdGlmICghd29yZCB8fCB3b3JkLnN0YXJ0Q29sdW1uID4gc3RhcnRDb2x1bW4gfHwgd29yZC5lbmRDb2x1bW4gPCBlbmRDb2x1bW4pIHtcblx0XHRcdFx0Ly8gbm8gcHJldmlvdXMgcXVlcnksIG5vdGhpbmcgdG8gaGlnaGxpZ2h0XG5cdFx0XHRcdFdvcmRIaWdobGlnaHRlci5xdWVyeSA9IG51bGw7XG5cdFx0XHRcdHRoaXMuX3N0b3BBbGwoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRXb3JkSGlnaGxpZ2h0ZXIucXVlcnkgPSB7XG5cdFx0XHRcdG1vZGVsSW5mbzoge1xuXHRcdFx0XHRcdG1vZGVsVVJJOiB0aGlzLm1vZGVsLnVyaSxcblx0XHRcdFx0XHRzZWxlY3Rpb246IGVkaXRvclNlbGVjdGlvbixcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cblxuXHRcdHRoaXMubGFzdEN1cnNvclBvc2l0aW9uQ2hhbmdlVGltZSA9IChuZXcgRGF0ZSgpKS5nZXRUaW1lKCk7XG5cblx0XHRpZiAoaXNFcXVhbCh0aGlzLmVkaXRvci5nZXRNb2RlbCgpLnVyaSwgV29yZEhpZ2hsaWdodGVyLnF1ZXJ5Lm1vZGVsSW5mbz8ubW9kZWxVUkkpKSB7IC8vIG9ubHkgdHJpZ2dlciBuZXcgd29ya2VyIHJlcXVlc3RzIGZyb20gdGhlIHByaW1hcnkgbW9kZWwgdGhhdCBpbml0aWF0ZWQgdGhlIHF1ZXJ5XG5cdFx0XHQvLyBjYXNlIGQpXG5cblx0XHRcdC8vIGNoZWNrIGlmIHRoZSBuZXcgcXVlcmllZCB3b3JkIGlzIGNvbnRhaW5lZCBpbiB0aGUgcmFuZ2Ugb2YgYSBzdG9yZWQgZGVjb3JhdGlvbiBmb3IgdGhpcyBtb2RlbFxuXHRcdFx0aWYgKCFtdWx0aUZpbGVDb25maWdDaGFuZ2UpIHtcblx0XHRcdFx0Y29uc3QgY3VycmVudE1vZGVsRGVjb3JhdGlvblJhbmdlcyA9IHRoaXMuZGVjb3JhdGlvbnMuZ2V0UmFuZ2VzKCk7XG5cdFx0XHRcdGZvciAoY29uc3Qgc3RvcmVkUmFuZ2Ugb2YgY3VycmVudE1vZGVsRGVjb3JhdGlvblJhbmdlcykge1xuXHRcdFx0XHRcdGlmIChzdG9yZWRSYW5nZS5jb250YWluc1Bvc2l0aW9uKHRoaXMuZWRpdG9yLmdldFBvc2l0aW9uKCkpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIHN0b3AgYWxsIHByZXZpb3VzIGFjdGlvbnMgaWYgbmV3IHdvcmQgaXMgaGlnaGxpZ2h0ZWRcblx0XHRcdC8vIGlmIHdlIHRyaWdnZXIgdGhlIHJ1biBvZmYgYSBzZXR0aW5nIGNoYW5nZSAtPiBtdWx0aWZpbGUgaGlnaGxpZ2h0aW5nLCB3ZSBkbyBub3Qgd2FudCB0byByZW1vdmUgZGVjb3JhdGlvbnMgZnJvbSB0aGlzIG1vZGVsXG5cdFx0XHR0aGlzLl9zdG9wQWxsKG11bHRpRmlsZUNvbmZpZ0NoYW5nZSA/IHRoaXMubW9kZWwudXJpIDogdW5kZWZpbmVkKTtcblxuXHRcdFx0Y29uc3QgbXlSZXF1ZXN0SWQgPSArK3RoaXMud29ya2VyUmVxdWVzdFRva2VuSWQ7XG5cdFx0XHR0aGlzLndvcmtlclJlcXVlc3RDb21wbGV0ZWQgPSBmYWxzZTtcblxuXHRcdFx0Y29uc3Qgb3RoZXJNb2RlbHNUb0hpZ2hsaWdodCA9IHRoaXMuZ2V0T3RoZXJNb2RlbHNUb0hpZ2hsaWdodCh0aGlzLmVkaXRvci5nZXRNb2RlbCgpKTtcblxuXHRcdFx0Ly8gd2hlbiByZWFjaGluZyBoZXJlLCB0aGVyZSBhcmUgdHdvIHBvc3NpYmxlIHN0YXRlcy5cblx0XHRcdC8vIFx0XHQxKSB3ZSBoYXZlIHRleHQgZm9jdXMsIGFuZCBhIHZhbGlkIHF1ZXJ5IHdhcyB1cGRhdGVkLlxuXHRcdFx0Ly8gXHRcdDIpIHdlIGRvIG5vdCBoYXZlIHRleHQgZm9jdXMsIGFuZCBhIHZhbGlkIHF1ZXJ5IGlzIGNhY2hlZC5cblx0XHRcdC8vIHRoZSBxdWVyeSB3aWxsIEFMV0FZUyBoYXZlIHRoZSBjb3JyZWN0IGRhdGEgZm9yIHRoZSBjdXJyZW50IGhpZ2hsaWdodCByZXF1ZXN0LCBzbyBpdCBjYW4gYWx3YXlzIGJlIHBhc3NlZCB0byB0aGUgd29ya2VyUmVxdWVzdCBzYWZlbHlcblx0XHRcdGlmICghV29yZEhpZ2hsaWdodGVyLnF1ZXJ5IHx8ICFXb3JkSGlnaGxpZ2h0ZXIucXVlcnkubW9kZWxJbmZvKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcXVlcnlNb2RlbFJlZiA9IGF3YWl0IHRoaXMudGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShXb3JkSGlnaGxpZ2h0ZXIucXVlcnkubW9kZWxJbmZvLm1vZGVsVVJJKTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRoaXMud29ya2VyUmVxdWVzdCA9IHRoaXMuY29tcHV0ZVdpdGhNb2RlbChxdWVyeU1vZGVsUmVmLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwsIFdvcmRIaWdobGlnaHRlci5xdWVyeS5tb2RlbEluZm8uc2VsZWN0aW9uLCBvdGhlck1vZGVsc1RvSGlnaGxpZ2h0KTtcblx0XHRcdFx0dGhpcy53b3JrZXJSZXF1ZXN0Py5yZXN1bHQudGhlbihkYXRhID0+IHtcblx0XHRcdFx0XHRpZiAobXlSZXF1ZXN0SWQgPT09IHRoaXMud29ya2VyUmVxdWVzdFRva2VuSWQpIHtcblx0XHRcdFx0XHRcdHRoaXMud29ya2VyUmVxdWVzdENvbXBsZXRlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHR0aGlzLndvcmtlclJlcXVlc3RWYWx1ZSA9IGRhdGEgfHwgW107XG5cdFx0XHRcdFx0XHR0aGlzLl9iZWdpblJlbmRlckRlY29yYXRpb25zKGRlbGF5ID8/IHRoaXMub2NjdXJyZW5jZXNIaWdobGlnaHREZWxheSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCBvblVuZXhwZWN0ZWRFcnJvcik7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignVW5leHBlY3RlZCBlcnJvciBkdXJpbmcgb2NjdXJyZW5jZSByZXF1ZXN0LiBMb2c6ICcsIGUpO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0cXVlcnlNb2RlbFJlZi5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cblx0XHR9IGVsc2UgaWYgKHRoaXMubW9kZWwudXJpLnNjaGVtZSA9PT0gU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGwpIHtcblx0XHRcdC8vIG5ldyB3b3JkSGlnaGxpZ2h0ZXIgY29taW5nIGZyb20gYSBkaWZmZXJlbnQgbW9kZWwsIE5PVCB0aGUgcXVlcnkgbW9kZWwsIG5lZWQgdG8gY3JlYXRlIGEgdGV4dE1vZGVsIHJlZlxuXG5cdFx0XHRjb25zdCBteVJlcXVlc3RJZCA9ICsrdGhpcy53b3JrZXJSZXF1ZXN0VG9rZW5JZDtcblx0XHRcdHRoaXMud29ya2VyUmVxdWVzdENvbXBsZXRlZCA9IGZhbHNlO1xuXG5cdFx0XHRpZiAoIVdvcmRIaWdobGlnaHRlci5xdWVyeSB8fCAhV29yZEhpZ2hsaWdodGVyLnF1ZXJ5Lm1vZGVsSW5mbykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHF1ZXJ5TW9kZWxSZWYgPSBhd2FpdCB0aGlzLnRleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UoV29yZEhpZ2hsaWdodGVyLnF1ZXJ5Lm1vZGVsSW5mby5tb2RlbFVSSSk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLndvcmtlclJlcXVlc3QgPSB0aGlzLmNvbXB1dGVXaXRoTW9kZWwocXVlcnlNb2RlbFJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsLCBXb3JkSGlnaGxpZ2h0ZXIucXVlcnkubW9kZWxJbmZvLnNlbGVjdGlvbiwgW3RoaXMubW9kZWxdKTtcblx0XHRcdFx0dGhpcy53b3JrZXJSZXF1ZXN0Py5yZXN1bHQudGhlbihkYXRhID0+IHtcblx0XHRcdFx0XHRpZiAobXlSZXF1ZXN0SWQgPT09IHRoaXMud29ya2VyUmVxdWVzdFRva2VuSWQpIHtcblx0XHRcdFx0XHRcdHRoaXMud29ya2VyUmVxdWVzdENvbXBsZXRlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHR0aGlzLndvcmtlclJlcXVlc3RWYWx1ZSA9IGRhdGEgfHwgW107XG5cdFx0XHRcdFx0XHR0aGlzLl9iZWdpblJlbmRlckRlY29yYXRpb25zKGRlbGF5ID8/IHRoaXMub2NjdXJyZW5jZXNIaWdobGlnaHREZWxheSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCBvblVuZXhwZWN0ZWRFcnJvcik7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignVW5leHBlY3RlZCBlcnJvciBkdXJpbmcgb2NjdXJyZW5jZSByZXF1ZXN0LiBMb2c6ICcsIGUpO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0cXVlcnlNb2RlbFJlZi5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjb21wdXRlV2l0aE1vZGVsKG1vZGVsOiBJVGV4dE1vZGVsLCBzZWxlY3Rpb246IFNlbGVjdGlvbiwgb3RoZXJNb2RlbHM6IElUZXh0TW9kZWxbXSk6IElPY2N1cmVuY2VBdFBvc2l0aW9uUmVxdWVzdCB8IG51bGwge1xuXHRcdGlmICghb3RoZXJNb2RlbHMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gY29tcHV0ZU9jY3VyZW5jZXNBdFBvc2l0aW9uKHRoaXMucHJvdmlkZXJzLCBtb2RlbCwgc2VsZWN0aW9uLCB0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLndvcmRTZXBhcmF0b3JzKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBjb21wdXRlT2NjdXJlbmNlc011bHRpTW9kZWwodGhpcy5tdWx0aURvY3VtZW50UHJvdmlkZXJzLCBtb2RlbCwgc2VsZWN0aW9uLCB0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLndvcmRTZXBhcmF0b3JzKSwgb3RoZXJNb2RlbHMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2JlZ2luUmVuZGVyRGVjb3JhdGlvbnMoZGVsYXk6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IGN1cnJlbnRUaW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKTtcblx0XHRjb25zdCBtaW5pbXVtUmVuZGVyVGltZSA9IHRoaXMubGFzdEN1cnNvclBvc2l0aW9uQ2hhbmdlVGltZSArIGRlbGF5O1xuXG5cdFx0aWYgKGN1cnJlbnRUaW1lID49IG1pbmltdW1SZW5kZXJUaW1lKSB7XG5cdFx0XHQvLyBTeW5jaHJvbm91c1xuXHRcdFx0dGhpcy5yZW5kZXJEZWNvcmF0aW9uc1RpbWVyID0gLTE7XG5cdFx0XHR0aGlzLnJlbmRlckRlY29yYXRpb25zKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIEFzeW5jaHJvbm91c1xuXHRcdFx0dGhpcy5yZW5kZXJEZWNvcmF0aW9uc1RpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdHRoaXMucmVuZGVyRGVjb3JhdGlvbnMoKTtcblx0XHRcdH0sIChtaW5pbXVtUmVuZGVyVGltZSAtIGN1cnJlbnRUaW1lKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJEZWNvcmF0aW9ucygpOiB2b2lkIHtcblx0XHR0aGlzLnJlbmRlckRlY29yYXRpb25zVGltZXIgPSAtMTtcblx0XHQvLyBjcmVhdGUgbmV3IGxvb3AsIGl0ZXJhdGUgb3ZlciBjdXJyZW50IGVkaXRvcnMgdXNpbmcgdGhpcy5jb2RlRWRpdG9yU2VydmljZS5saXN0Q29kZUVkaXRvcnMoKSxcblx0XHQvLyBpZiB0aGUgVVJJIG9mIHRoYXQgY29kZUVkaXRvciBpcyBpbiB0aGUgbWFwLCB0aGVuIGFkZCB0aGUgZGVjb3JhdGlvbnMgdG8gdGhlIGRlY29yYXRpb25zIGFycmF5XG5cdFx0Ly8gdGhlbiBzZXQgdGhlIGRlY29yYXRpb25zIGZvciB0aGUgZWRpdG9yXG5cdFx0Y29uc3QgY3VycmVudEVkaXRvcnMgPSB0aGlzLmNvZGVFZGl0b3JTZXJ2aWNlLmxpc3RDb2RlRWRpdG9ycygpO1xuXHRcdGZvciAoY29uc3QgZWRpdG9yIG9mIGN1cnJlbnRFZGl0b3JzKSB7XG5cdFx0XHRjb25zdCBlZGl0b3JIaWdobGlnaHRlckNvbnRyaWIgPSBXb3JkSGlnaGxpZ2h0ZXJDb250cmlidXRpb24uZ2V0KGVkaXRvcik7XG5cdFx0XHRpZiAoIWVkaXRvckhpZ2hsaWdodGVyQ29udHJpYikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbmV3RGVjb3JhdGlvbnM6IElNb2RlbERlbHRhRGVjb3JhdGlvbltdID0gW107XG5cdFx0XHRjb25zdCB1cmkgPSBlZGl0b3IuZ2V0TW9kZWwoKT8udXJpO1xuXHRcdFx0aWYgKHVyaSAmJiB0aGlzLndvcmtlclJlcXVlc3RWYWx1ZS5oYXModXJpKSkge1xuXHRcdFx0XHRjb25zdCBvbGREZWNvcmF0aW9uSURzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCA9IFdvcmRIaWdobGlnaHRlci5zdG9yZWREZWNvcmF0aW9uSURzLmdldCh1cmkpO1xuXHRcdFx0XHRjb25zdCBuZXdEb2N1bWVudEhpZ2hsaWdodHMgPSB0aGlzLndvcmtlclJlcXVlc3RWYWx1ZS5nZXQodXJpKTtcblx0XHRcdFx0aWYgKG5ld0RvY3VtZW50SGlnaGxpZ2h0cykge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgaGlnaGxpZ2h0IG9mIG5ld0RvY3VtZW50SGlnaGxpZ2h0cykge1xuXHRcdFx0XHRcdFx0aWYgKCFoaWdobGlnaHQucmFuZ2UpIHtcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRuZXdEZWNvcmF0aW9ucy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0cmFuZ2U6IGhpZ2hsaWdodC5yYW5nZSxcblx0XHRcdFx0XHRcdFx0b3B0aW9uczogZ2V0SGlnaGxpZ2h0RGVjb3JhdGlvbk9wdGlvbnMoaGlnaGxpZ2h0LmtpbmQpXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXQgbmV3RGVjb3JhdGlvbklEczogc3RyaW5nW10gPSBbXTtcblx0XHRcdFx0ZWRpdG9yLmNoYW5nZURlY29yYXRpb25zKChjaGFuZ2VBY2Nlc3NvcikgPT4ge1xuXHRcdFx0XHRcdG5ld0RlY29yYXRpb25JRHMgPSBjaGFuZ2VBY2Nlc3Nvci5kZWx0YURlY29yYXRpb25zKG9sZERlY29yYXRpb25JRHMgPz8gW10sIG5ld0RlY29yYXRpb25zKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdFdvcmRIaWdobGlnaHRlci5zdG9yZWREZWNvcmF0aW9uSURzID0gV29yZEhpZ2hsaWdodGVyLnN0b3JlZERlY29yYXRpb25JRHMuc2V0KHVyaSwgbmV3RGVjb3JhdGlvbklEcyk7XG5cblx0XHRcdFx0aWYgKG5ld0RlY29yYXRpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRlZGl0b3JIaWdobGlnaHRlckNvbnRyaWIud29yZEhpZ2hsaWdodGVyPy5kZWNvcmF0aW9ucy5zZXQobmV3RGVjb3JhdGlvbnMpO1xuXHRcdFx0XHRcdGVkaXRvckhpZ2hsaWdodGVyQ29udHJpYi53b3JkSGlnaGxpZ2h0ZXI/Ll9oYXNXb3JkSGlnaGxpZ2h0cy5zZXQodHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBjbGVhciB0aGUgd29ya2VyIHJlcXVlc3Qgd2hlbiBkZWNvcmF0aW9ucyBhcmUgY29tcGxldGVkXG5cdFx0dGhpcy53b3JrZXJSZXF1ZXN0ID0gbnVsbDtcblx0fVxuXG5cdHB1YmxpYyBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3N0b3BTaW5ndWxhcigpO1xuXHRcdHRoaXMudG9Vbmhvb2suZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBXb3JkSGlnaGxpZ2h0ZXJDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUVkaXRvckNvbnRyaWJ1dGlvbiB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuY29udHJpYi53b3JkSGlnaGxpZ2h0ZXInO1xuXG5cdHB1YmxpYyBzdGF0aWMgZ2V0KGVkaXRvcjogSUNvZGVFZGl0b3IpOiBXb3JkSGlnaGxpZ2h0ZXJDb250cmlidXRpb24gfCBudWxsIHtcblx0XHRyZXR1cm4gZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxXb3JkSGlnaGxpZ2h0ZXJDb250cmlidXRpb24+KFdvcmRIaWdobGlnaHRlckNvbnRyaWJ1dGlvbi5JRCk7XG5cdH1cblxuXHRwcml2YXRlIF93b3JkSGlnaGxpZ2h0ZXI6IFdvcmRIaWdobGlnaHRlciB8IG51bGw7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl93b3JkSGlnaGxpZ2h0ZXIgPSBudWxsO1xuXHRcdGNvbnN0IGNyZWF0ZVdvcmRIaWdobGlnaHRlcklmUG9zc2libGUgPSAoKSA9PiB7XG5cdFx0XHRpZiAoZWRpdG9yLmhhc01vZGVsKCkgJiYgIWVkaXRvci5nZXRNb2RlbCgpLmlzVG9vTGFyZ2VGb3JUb2tlbml6YXRpb24oKSAmJiBlZGl0b3IuZ2V0TW9kZWwoKS51cmkuc2NoZW1lICE9PSBTY2hlbWFzLmFjY2Vzc2libGVWaWV3KSB7XG5cdFx0XHRcdHRoaXMuX3dvcmRIaWdobGlnaHRlciA9IG5ldyBXb3JkSGlnaGxpZ2h0ZXIoZWRpdG9yLCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyLCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5tdWx0aURvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIsIGNvbnRleHRLZXlTZXJ2aWNlLCB0ZXh0TW9kZWxTZXJ2aWNlLCBjb2RlRWRpdG9yU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGxvZ1NlcnZpY2UpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWwoKGUpID0+IHtcblx0XHRcdGlmICh0aGlzLl93b3JkSGlnaGxpZ2h0ZXIpIHtcblx0XHRcdFx0aWYgKCFlLm5ld01vZGVsVXJsICYmIGUub2xkTW9kZWxVcmw/LnNjaGVtZSAhPT0gU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGwpIHsgLy8gaGFwcGVucyB3aGVuIHN3aXRjaGluZyB0YWJzIHRvIGEgbm90ZWJvb2sgdGhhdCBoYXMgZm9jdXMgaW4gdGhlIGNlbGwgbGlzdCwgbm8gbmV3IG1vZGVsIFVSSSAodGhpcyBhbHNvIGRvZXNuJ3QgbWFrZSBpdCB0byB0aGUgd29yZEhpZ2hsaWdodGVyLCBiYyBubyBlZGl0b3IuaGFzTW9kZWwpXG5cdFx0XHRcdFx0dGhpcy53b3JkSGlnaGxpZ2h0ZXI/LnN0b3AoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuX3dvcmRIaWdobGlnaHRlci5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMuX3dvcmRIaWdobGlnaHRlciA9IG51bGw7XG5cdFx0XHR9XG5cdFx0XHRjcmVhdGVXb3JkSGlnaGxpZ2h0ZXJJZlBvc3NpYmxlKCk7XG5cdFx0fSkpO1xuXHRcdGNyZWF0ZVdvcmRIaWdobGlnaHRlcklmUG9zc2libGUoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgd29yZEhpZ2hsaWdodGVyKCk6IFdvcmRIaWdobGlnaHRlciB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl93b3JkSGlnaGxpZ2h0ZXI7XG5cdH1cblxuXHRwdWJsaWMgc2F2ZVZpZXdTdGF0ZSgpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5fd29yZEhpZ2hsaWdodGVyICYmIHRoaXMuX3dvcmRIaWdobGlnaHRlci5oYXNEZWNvcmF0aW9ucygpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHVibGljIG1vdmVOZXh0KCkge1xuXHRcdHRoaXMuX3dvcmRIaWdobGlnaHRlcj8ubW92ZU5leHQoKTtcblx0fVxuXG5cdHB1YmxpYyBtb3ZlQmFjaygpIHtcblx0XHR0aGlzLl93b3JkSGlnaGxpZ2h0ZXI/Lm1vdmVCYWNrKCk7XG5cdH1cblxuXHRwdWJsaWMgcmVzdG9yZVZpZXdTdGF0ZShzdGF0ZTogYm9vbGVhbiB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl93b3JkSGlnaGxpZ2h0ZXIgJiYgc3RhdGUpIHtcblx0XHRcdHRoaXMuX3dvcmRIaWdobGlnaHRlci5yZXN0b3JlKDI1MCk7IC8vIDI1MCBtcyBkZWxheSB0byByZXN0b3JpbmcgdmlldyBzdGF0ZSwgc2luY2Ugb25seSBleHRzIGNhbGwgdGhpc1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBzdG9wSGlnaGxpZ2h0aW5nKCkge1xuXHRcdHRoaXMuX3dvcmRIaWdobGlnaHRlcj8uc3RvcCgpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3dvcmRIaWdobGlnaHRlcikge1xuXHRcdFx0dGhpcy5fd29yZEhpZ2hsaWdodGVyLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX3dvcmRIaWdobGlnaHRlciA9IG51bGw7XG5cdFx0fVxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5cbmNsYXNzIFdvcmRIaWdobGlnaHROYXZpZ2F0aW9uQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9pc05leHQ6IGJvb2xlYW47XG5cblx0Y29uc3RydWN0b3IobmV4dDogYm9vbGVhbiwgb3B0czogSUFjdGlvbk9wdGlvbnMpIHtcblx0XHRzdXBlcihvcHRzKTtcblx0XHR0aGlzLl9pc05leHQgPSBuZXh0O1xuXHR9XG5cblx0cHVibGljIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBXb3JkSGlnaGxpZ2h0ZXJDb250cmlidXRpb24uZ2V0KGVkaXRvcik7XG5cdFx0aWYgKCFjb250cm9sbGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2lzTmV4dCkge1xuXHRcdFx0Y29udHJvbGxlci5tb3ZlTmV4dCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb250cm9sbGVyLm1vdmVCYWNrKCk7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIE5leHRXb3JkSGlnaGxpZ2h0QWN0aW9uIGV4dGVuZHMgV29yZEhpZ2hsaWdodE5hdmlnYXRpb25BY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih0cnVlLCB7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24ud29yZEhpZ2hsaWdodC5uZXh0Jyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCd3b3JkSGlnaGxpZ2h0Lm5leHQubGFiZWwnLCBcIkdvIHRvIE5leHQgU3ltYm9sIEhpZ2hsaWdodFwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogY3R4SGFzV29yZEhpZ2hsaWdodHMsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRjcsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuY2xhc3MgUHJldldvcmRIaWdobGlnaHRBY3Rpb24gZXh0ZW5kcyBXb3JkSGlnaGxpZ2h0TmF2aWdhdGlvbkFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKGZhbHNlLCB7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24ud29yZEhpZ2hsaWdodC5wcmV2Jyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCd3b3JkSGlnaGxpZ2h0LnByZXZpb3VzLmxhYmVsJywgXCJHbyB0byBQcmV2aW91cyBTeW1ib2wgSGlnaGxpZ2h0XCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBjdHhIYXNXb3JkSGlnaGxpZ2h0cyxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5GNyxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuXG5jbGFzcyBUcmlnZ2VyV29yZEhpZ2hsaWdodEFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi53b3JkSGlnaGxpZ2h0LnRyaWdnZXInLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ3dvcmRIaWdobGlnaHQudHJpZ2dlci5sYWJlbCcsIFwiVHJpZ2dlciBTeW1ib2wgSGlnaGxpZ2h0XCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IDAsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yLCBhcmdzOiBhbnkpOiB2b2lkIHtcblx0XHRjb25zdCBjb250cm9sbGVyID0gV29yZEhpZ2hsaWdodGVyQ29udHJpYnV0aW9uLmdldChlZGl0b3IpO1xuXHRcdGlmICghY29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnRyb2xsZXIucmVzdG9yZVZpZXdTdGF0ZSh0cnVlKTtcblx0fVxufVxuXG5yZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbihXb3JkSGlnaGxpZ2h0ZXJDb250cmlidXRpb24uSUQsIFdvcmRIaWdobGlnaHRlckNvbnRyaWJ1dGlvbiwgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbi5FYWdlcik7IC8vIGVhZ2VyIGJlY2F1c2UgaXQgdXNlcyBgc2F2ZVZpZXdTdGF0ZWAvYHJlc3RvcmVWaWV3U3RhdGVgXG5yZWdpc3RlckVkaXRvckFjdGlvbihOZXh0V29yZEhpZ2hsaWdodEFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihQcmV2V29yZEhpZ2hsaWdodEFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihUcmlnZ2VyV29yZEhpZ2hsaWdodEFjdGlvbik7XG5yZWdpc3RlckVkaXRvckZlYXR1cmUoVGV4dHVhbE11bHRpRG9jdW1lbnRIaWdobGlnaHRGZWF0dXJlKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsYUFBYTtBQUN0QixTQUE0Qix5QkFBeUIsU0FBUyxhQUFhO0FBQzNFLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsbUJBQW1CLGlDQUFpQztBQUM3RCxTQUFTLFNBQVMsY0FBYztBQUNoQyxTQUFTLFlBQVksdUJBQXVCO0FBQzVDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsZUFBZSxlQUFlO0FBQ3ZDLFNBQVMsZUFBZTtBQUV4QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFzQixvQkFBb0IscUJBQXFCO0FBRS9ELFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQXlDLG9CQUFvQjtBQUM3RCxTQUFTLGNBQWMsaUNBQWlELHNCQUFzQiw0QkFBNEIsdUNBQXVDO0FBQ2pLLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsYUFBYTtBQUd0QixTQUFTLDBCQUF1RDtBQUVoRSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDZCQUE2QjtBQUd0QyxTQUFTLGFBQWE7QUFDdEIsU0FBNEMsOEJBQThCO0FBQzFFLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMscUNB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
