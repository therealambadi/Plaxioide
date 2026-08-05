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
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { renderStringAsPlaintext } from "../../../../base/browser/markdownRenderer.js";
import { Action, Separator, SubmenuAction } from "../../../../base/common/actions.js";
import { equals } from "../../../../base/common/arrays.js";
import { mapFindFirst } from "../../../../base/common/arraysFind.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { stripIcons } from "../../../../base/common/iconLabels.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { clamp } from "../../../../base/common/numbers.js";
import { autorun } from "../../../../base/common/observable.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { count, truncateMiddle } from "../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Constants } from "../../../../base/common/uint.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { ContentWidgetPositionPreference, MouseTargetType } from "../../../../editor/browser/editorBrowser.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { overviewRulerError, overviewRulerInfo } from "../../../../editor/common/core/editorColorRegistry.js";
import { Position } from "../../../../editor/common/core/position.js";
import { GlyphMarginLane, OverviewRulerLane, TrackedRangeStickiness } from "../../../../editor/common/model.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { localize } from "../../../../nls.js";
import { getFlatContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { themeColorFromId } from "../../../../platform/theme/common/themeService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { EditorLineNumberContextMenu, GutterActionsRegistry } from "../../codeEditor/browser/editorLineNumberMenu.js";
import { DefaultGutterClickAction, TestingConfigKeys, getTestingConfiguration } from "../common/configuration.js";
import { Testing, labelForTestInState } from "../common/constants.js";
import { TestId } from "../common/testId.js";
import { ITestProfileService } from "../common/testProfileService.js";
import { LiveTestResult, TestResultItemChangeReason } from "../common/testResult.js";
import { ITestResultService } from "../common/testResultService.js";
import { ITestService, getContextForTestItem, simplifyTestsToExecute, testsInFile } from "../common/testService.js";
import { TestDiffOpType, TestMessageType, TestResultState, TestRunProfileBitset } from "../common/testTypes.js";
import { ITestingDecorationsService, TestDecorations } from "../common/testingDecorations.js";
import { ITestingPeekOpener } from "../common/testingPeekOpener.js";
import { isFailedState, maxPriority } from "../common/testingStates.js";
import { TestUriType, buildTestUri, parseTestUri } from "../common/testingUri.js";
import { getTestItemContextOverlay } from "./explorerProjections/testItemContextOverlay.js";
import { testingDebugAllIcon, testingDebugIcon, testingRunAllIcon, testingRunIcon, testingStatesToIcons } from "./icons.js";
import { renderTestMessageAsText } from "./testMessageColorizer.js";
import { MessageSubject } from "./testResultsView/testResultsSubject.js";
import { TestingOutputPeekController } from "./testingOutputPeek.js";
const MAX_INLINE_MESSAGE_LENGTH = 128;
const MAX_TESTS_IN_SUBMENU = 30;
const GLYPH_MARGIN_LANE = GlyphMarginLane.Center;
function isOriginalInDiffEditor(codeEditorService, codeEditor) {
  const diffEditors = codeEditorService.listDiffEditors();
  for (const diffEditor of diffEditors) {
    if (diffEditor.getOriginalEditor() === codeEditor) {
      return true;
    }
  }
  return false;
}
class CachedDecorations {
  constructor() {
    this.runByIdKey = /* @__PURE__ */ new Map();
  }
  get size() {
    return this.runByIdKey.size;
  }
  /** Gets a test run decoration that contains exactly the given test IDs */
  getForExactTests(testIds) {
    const key = testIds.sort().join("\0\0");
    return this.runByIdKey.get(key);
  }
  /** Adds a new test run decroation */
  addTest(d) {
    const key = d.testIds.sort().join("\0\0");
    this.runByIdKey.set(key, d);
  }
  /** Finds an extension by VS Code event ID */
  getById(decorationId) {
    for (const d of this.runByIdKey.values()) {
      if (d.id === decorationId) {
        return d;
      }
    }
    return void 0;
  }
  /** Iterate over all decorations */
  *[Symbol.iterator]() {
    for (const d of this.runByIdKey.values()) {
      yield d;
    }
  }
}
let TestingDecorationService = class extends Disposable {
  constructor(codeEditorService, configurationService, testService, results, instantiationService, modelService) {
    super();
    this.configurationService = configurationService;
    this.testService = testService;
    this.results = results;
    this.instantiationService = instantiationService;
    this.modelService = modelService;
    this.generation = 0;
    this.changeEmitter = new Emitter();
    this.decorationCache = new ResourceMap();
    /**
     * List of messages that should be hidden because an editor changed their
     * underlying ranges. I think this is good enough, because:
     *  - Message decorations are never shown across reloads; this does not
     *    need to persist
     *  - Message instances are stable for any completed test results for
     *    the duration of the session.
     */
    this.invalidatedMessages = /* @__PURE__ */ new WeakSet();
    /** @inheritdoc */
    this.onDidChange = this.changeEmitter.event;
    codeEditorService.registerDecorationType("test-message-decoration", TestMessageDecoration.decorationId, {}, void 0);
    this._register(modelService.onModelRemoved((e) => this.decorationCache.delete(e.uri)));
    const debounceInvalidate = this._register(new RunOnceScheduler(() => this.invalidate(), 100));
    this._register(this.testService.onWillProcessDiff((diff) => {
      for (const entry of diff) {
        if (entry.op !== TestDiffOpType.DocumentSynced) {
          continue;
        }
        const rec = this.decorationCache.get(entry.uri);
        if (rec) {
          rec.rangeUpdateVersionId = entry.docv;
        }
      }
      if (!debounceInvalidate.isScheduled()) {
        debounceInvalidate.schedule();
      }
    }));
    this._register(Event.any(
      this.results.onResultsChanged,
      this.results.onTestChanged,
      this.testService.excluded.onTestExclusionsChanged,
      Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration(TestingConfigKeys.GutterEnabled))
    )(() => {
      if (!debounceInvalidate.isScheduled()) {
        debounceInvalidate.schedule();
      }
    }));
    this._register(GutterActionsRegistry.registerGutterActionsGenerator((context, result) => {
      const model = context.editor.getModel();
      const testingDecorations = TestingDecorations.get(context.editor);
      if (!model || !testingDecorations?.currentUri) {
        return;
      }
      const currentDecorations = this.syncDecorations(testingDecorations.currentUri);
      if (!currentDecorations.size) {
        return;
      }
      const modelDecorations = model.getLinesDecorations(context.lineNumber, context.lineNumber);
      for (const { id } of modelDecorations) {
        const decoration = currentDecorations.getById(id);
        if (decoration) {
          const { object: actions } = decoration.getContextMenuActions();
          for (const action of actions) {
            result.push(action, "1_testing");
          }
        }
      }
    }));
  }
  /** @inheritdoc */
  invalidateResultMessage(message) {
    this.invalidatedMessages.add(message);
    this.invalidate();
  }
  /** @inheritdoc */
  syncDecorations(resource) {
    const model = this.modelService.getModel(resource);
    if (!model) {
      return new CachedDecorations();
    }
    const cached = this.decorationCache.get(resource);
    if (cached && cached.generation === this.generation && (cached.rangeUpdateVersionId === void 0 || cached.rangeUpdateVersionId !== model.getVersionId())) {
      return cached.value;
    }
    return this.applyDecorations(model);
  }
  /** @inheritdoc */
  getDecoratedTestPosition(resource, testId) {
    const model = this.modelService.getModel(resource);
    if (!model) {
      return void 0;
    }
    const decoration = Iterable.find(this.syncDecorations(resource), (v) => v instanceof RunTestDecoration && v.isForTest(testId));
    if (!decoration) {
      return void 0;
    }
    return model.getDecorationRange(decoration.id)?.getStartPosition();
  }
  invalidate() {
    this.generation++;
    this.changeEmitter.fire();
  }
  /**
   * Sets whether alternate actions are shown for the model.
   */
  updateDecorationsAlternateAction(resource, isAlt) {
    const model = this.modelService.getModel(resource);
    const cached = this.decorationCache.get(resource);
    if (!model || !cached || cached.isAlt === isAlt) {
      return;
    }
    cached.isAlt = isAlt;
    model.changeDecorations((accessor) => {
      for (const decoration of cached.value) {
        if (decoration instanceof RunTestDecoration && decoration.editorDecoration.alternate) {
          accessor.changeDecorationOptions(
            decoration.id,
            isAlt ? decoration.editorDecoration.alternate : decoration.editorDecoration.options
          );
        }
      }
    });
  }
  /**
   * Applies the current set of test decorations to the given text model.
   */
  applyDecorations(model) {
    const gutterEnabled = getTestingConfiguration(this.configurationService, TestingConfigKeys.GutterEnabled);
    const cached = this.decorationCache.get(model.uri);
    const testRangesUpdated = cached?.rangeUpdateVersionId === model.getVersionId();
    const lastDecorations = cached?.value ?? new CachedDecorations();
    const newDecorations = model.changeDecorations((accessor) => {
      const newDecorations2 = new CachedDecorations();
      const runDecorations = new TestDecorations();
      for (const test of this.testService.collection.getNodeByUrl(model.uri)) {
        if (!test.item.range) {
          continue;
        }
        const stateLookup = this.results.getStateById(test.item.extId);
        const line = test.item.range.startLineNumber;
        runDecorations.push({ line, id: "", test, resultItem: stateLookup?.[1] });
      }
      for (const [line, tests] of runDecorations.lines()) {
        const multi = tests.length > 1;
        let existing = lastDecorations.getForExactTests(tests.map((t) => t.test.item.extId));
        if (existing && testRangesUpdated && model.getDecorationRange(existing.id)?.startLineNumber !== line) {
          existing = void 0;
        }
        if (existing) {
          if (existing.replaceOptions(tests, gutterEnabled)) {
            accessor.changeDecorationOptions(existing.id, existing.editorDecoration.options);
          }
          newDecorations2.addTest(existing);
        } else {
          newDecorations2.addTest(multi ? this.instantiationService.createInstance(MultiRunTestDecoration, tests, gutterEnabled, model) : this.instantiationService.createInstance(RunSingleTestDecoration, tests[0].test, tests[0].resultItem, model, gutterEnabled));
        }
      }
      const saveFromRemoval = /* @__PURE__ */ new Set();
      for (const decoration of newDecorations2) {
        if (decoration.id === "") {
          decoration.id = accessor.addDecoration(decoration.editorDecoration.range, decoration.editorDecoration.options);
        } else {
          saveFromRemoval.add(decoration.id);
        }
      }
      for (const decoration of lastDecorations) {
        if (!saveFromRemoval.has(decoration.id)) {
          accessor.removeDecoration(decoration.id);
        }
      }
      this.decorationCache.set(model.uri, {
        generation: this.generation,
        rangeUpdateVersionId: cached?.rangeUpdateVersionId,
        value: newDecorations2
      });
      return newDecorations2;
    });
    return newDecorations || lastDecorations;
  }
};
TestingDecorationService = __decorateClass([
  __decorateParam(0, ICodeEditorService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ITestService),
  __decorateParam(3, ITestResultService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IModelService)
], TestingDecorationService);
let TestingDecorations = class extends Disposable {
  constructor(editor, codeEditorService, testService, decorations, uriIdentityService, results, configurationService, instantiationService) {
    super();
    this.editor = editor;
    this.codeEditorService = codeEditorService;
    this.testService = testService;
    this.decorations = decorations;
    this.uriIdentityService = uriIdentityService;
    this.results = results;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.expectedWidget = this._register(new MutableDisposable());
    this.actualWidget = this._register(new MutableDisposable());
    this.errorContentWidgets = this._register(new DisposableMap());
    this.loggedMessageDecorations = /* @__PURE__ */ new Map();
    codeEditorService.registerDecorationType("test-message-decoration", TestMessageDecoration.decorationId, {}, void 0, editor);
    this.attachModel(editor.getModel()?.uri);
    this._register(decorations.onDidChange(() => {
      if (this._currentUri) {
        decorations.syncDecorations(this._currentUri);
      }
    }));
    this._register(Event.any(
      this.results.onResultsChanged,
      editor.onDidChangeModel,
      Event.filter(this.results.onTestChanged, (c) => c.reason === TestResultItemChangeReason.NewMessage),
      this.testService.showInlineOutput.onDidChange
    )(() => this.applyResults()));
    const win = dom.getWindow(editor.getDomNode());
    this._register(dom.addDisposableListener(win, "keydown", (e) => {
      if (new StandardKeyboardEvent(e).keyCode === KeyCode.Alt && this._currentUri) {
        decorations.updateDecorationsAlternateAction(this._currentUri, true);
      }
    }));
    this._register(dom.addDisposableListener(win, "keyup", (e) => {
      if (new StandardKeyboardEvent(e).keyCode === KeyCode.Alt && this._currentUri) {
        decorations.updateDecorationsAlternateAction(this._currentUri, false);
      }
    }));
    this._register(dom.addDisposableListener(win, "blur", () => {
      if (this._currentUri) {
        decorations.updateDecorationsAlternateAction(this._currentUri, false);
      }
    }));
    this._register(this.editor.onKeyUp((e) => {
      if (e.keyCode === KeyCode.Alt && this._currentUri) {
        decorations.updateDecorationsAlternateAction(this._currentUri, false);
      }
    }));
    this._register(this.editor.onDidChangeModel((e) => this.attachModel(e.newModelUrl || void 0)));
    this._register(this.editor.onMouseDown((e) => {
      if (e.target.position && this.currentUri) {
        const modelDecorations = editor.getModel()?.getLineDecorations(e.target.position.lineNumber) ?? [];
        if (!modelDecorations.length) {
          return;
        }
        const cache = decorations.syncDecorations(this.currentUri);
        for (const { id } of modelDecorations) {
          if (cache.getById(id)?.click(e)) {
            e.event.stopPropagation();
            return;
          }
        }
      }
    }));
    this._register(Event.accumulate(this.editor.onDidChangeModelContent, 0, this._store)((evts) => {
      const model = editor.getModel();
      if (!this._currentUri || !model) {
        return;
      }
      let changed = false;
      for (const [message, deco] of this.loggedMessageDecorations) {
        const invalidate = evts.some((e) => e.changes.some(
          (c) => c.range.startLineNumber <= deco.line && c.range.endLineNumber >= deco.line || deco.resultItem?.item.range && deco.resultItem.item.range.startLineNumber <= c.range.startLineNumber && deco.resultItem.item.range.endLineNumber >= c.range.endLineNumber
        ));
        if (invalidate) {
          changed = true;
          TestingDecorations.invalidatedTests.add(deco.resultItem || message);
        }
      }
      if (changed) {
        this.applyResults();
      }
    }));
    const updateFontFamilyVar = () => {
      this.editor.getContainerDomNode().style.setProperty("--testMessageDecorationFontFamily", editor.getOption(EditorOption.fontFamily));
      this.editor.getContainerDomNode().style.setProperty("--testMessageDecorationFontSize", `${editor.getOption(EditorOption.fontSize)}px`);
    };
    this._register(this.editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.fontFamily)) {
        updateFontFamilyVar();
      }
    }));
    updateFontFamilyVar();
  }
  /**
   * Gets the decorations associated with the given code editor.
   */
  static get(editor) {
    return editor.getContribution(Testing.DecorationsContributionId);
  }
  get currentUri() {
    return this._currentUri;
  }
  attachModel(uri) {
    switch (uri && parseTestUri(uri)?.type) {
      case TestUriType.ResultExpectedOutput:
        this.expectedWidget.value = new ExpectedLensContentWidget(this.editor);
        this.actualWidget.clear();
        break;
      case TestUriType.ResultActualOutput:
        this.expectedWidget.clear();
        this.actualWidget.value = new ActualLensContentWidget(this.editor);
        break;
      default:
        this.expectedWidget.clear();
        this.actualWidget.clear();
    }
    if (isOriginalInDiffEditor(this.codeEditorService, this.editor)) {
      uri = void 0;
    }
    this._currentUri = uri;
    if (!uri) {
      return;
    }
    this.decorations.syncDecorations(uri);
    (async () => {
      for await (const _test of testsInFile(this.testService, this.uriIdentityService, uri, false)) {
        if (this._currentUri !== uri) {
          break;
        }
      }
    })();
  }
  applyResults() {
    const model = this.editor.getModel();
    if (!model) {
      return this.clearResults();
    }
    const uriStr = model.uri.toString();
    const seenLines = /* @__PURE__ */ new Set();
    this.applyResultsContentWidgets(uriStr, seenLines);
    this.applyResultsLoggedMessages(uriStr, seenLines);
  }
  clearResults() {
    this.errorContentWidgets.clearAndDisposeAll();
  }
  isMessageInvalidated(message) {
    return TestingDecorations.invalidatedTests.has(message);
  }
  applyResultsContentWidgets(uriStr, seenLines) {
    const seen = /* @__PURE__ */ new Set();
    if (getTestingConfiguration(this.configurationService, TestingConfigKeys.ShowAllMessages)) {
      this.results.results.forEach((lastResult) => this.applyContentWidgetsFromResult(lastResult, uriStr, seen, seenLines));
    } else if (this.results.results.length) {
      this.applyContentWidgetsFromResult(this.results.results[0], uriStr, seen, seenLines);
    }
    for (const message of this.errorContentWidgets.keys()) {
      if (!seen.has(message)) {
        this.errorContentWidgets.deleteAndDispose(message);
      }
    }
  }
  applyContentWidgetsFromResult(lastResult, uriStr, seen, seenLines) {
    for (const test of lastResult.tests) {
      if (TestingDecorations.invalidatedTests.has(test)) {
        continue;
      }
      for (let taskId = 0; taskId < test.tasks.length; taskId++) {
        const state = test.tasks[taskId];
        for (let i = 0; i < state.messages.length; i++) {
          const m = state.messages[i];
          if (m.type !== TestMessageType.Error || this.isMessageInvalidated(m)) {
            continue;
          }
          const line = m.location?.uri.toString() === uriStr ? m.location.range.startLineNumber : m.stackTrace && mapFindFirst(m.stackTrace, (f) => f.position && f.uri?.toString() === uriStr ? f.position.lineNumber : void 0);
          if (line === void 0 || seenLines.has(line)) {
            continue;
          }
          seenLines.add(line);
          let deco = this.errorContentWidgets.get(m);
          if (!deco) {
            const lineLength = this.editor.getModel()?.getLineLength(line) ?? 100;
            deco = this.instantiationService.createInstance(
              TestErrorContentWidget,
              this.editor,
              new Position(line, lineLength + 1),
              m,
              test,
              buildTestUri({
                type: TestUriType.ResultActualOutput,
                messageIndex: i,
                taskIndex: taskId,
                resultId: lastResult.id,
                testExtId: test.item.extId
              })
            );
            this.errorContentWidgets.set(m, deco);
          }
          seen.add(m);
        }
      }
    }
  }
  applyResultsLoggedMessages(uriStr, messageLines) {
    this.editor.changeDecorations((accessor) => {
      const seen = /* @__PURE__ */ new Set();
      if (getTestingConfiguration(this.configurationService, TestingConfigKeys.ShowAllMessages)) {
        this.results.results.forEach((r) => this.applyLoggedMessageFromResult(r, uriStr, seen, messageLines, accessor));
      } else if (this.results.results.length) {
        this.applyLoggedMessageFromResult(this.results.results[0], uriStr, seen, messageLines, accessor);
      }
      for (const [message, { id }] of this.loggedMessageDecorations) {
        if (!seen.has(message)) {
          accessor.removeDecoration(id);
        }
      }
    });
  }
  applyLoggedMessageFromResult(lastResult, uriStr, seen, messageLines, accessor) {
    if (!this.testService.showInlineOutput.value || !(lastResult instanceof LiveTestResult)) {
      return;
    }
    const tryAdd = (resultItem, m, uri) => {
      if (this.isMessageInvalidated(m) || m.location?.uri.toString() !== uriStr) {
        return;
      }
      seen.add(m);
      const line = m.location.range.startLineNumber;
      if (messageLines.has(line) || this.loggedMessageDecorations.has(m)) {
        return;
      }
      const deco = this.instantiationService.createInstance(TestMessageDecoration, m, uri, this.editor.getModel());
      messageLines.add(line);
      const id = accessor.addDecoration(
        deco.editorDecoration.range,
        deco.editorDecoration.options
      );
      this.loggedMessageDecorations.set(m, { id, line, resultItem });
    };
    for (const test of lastResult.tests) {
      if (TestingDecorations.invalidatedTests.has(test)) {
        continue;
      }
      for (let taskId = 0; taskId < test.tasks.length; taskId++) {
        const state = test.tasks[taskId];
        for (let i = state.messages.length - 1; i >= 0; i--) {
          const m = state.messages[i];
          if (m.type === TestMessageType.Output) {
            tryAdd(test, m, buildTestUri({
              type: TestUriType.ResultActualOutput,
              messageIndex: i,
              taskIndex: taskId,
              resultId: lastResult.id,
              testExtId: test.item.extId
            }));
          }
        }
      }
    }
    for (const task of lastResult.tasks) {
      for (const m of task.otherMessages) {
        tryAdd(void 0, m);
      }
    }
  }
};
/**
 * Results invalidated by editor changes.
 */
TestingDecorations.invalidatedTests = /* @__PURE__ */ new WeakSet();
TestingDecorations = __decorateClass([
  __decorateParam(1, ICodeEditorService),
  __decorateParam(2, ITestService),
  __decorateParam(3, ITestingDecorationsService),
  __decorateParam(4, IUriIdentityService),
  __decorateParam(5, ITestResultService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IInstantiationService)
], TestingDecorations);
const collapseRange = (originalRange) => ({
  startLineNumber: originalRange.startLineNumber,
  endLineNumber: originalRange.startLineNumber,
  startColumn: originalRange.startColumn,
  endColumn: originalRange.startColumn
});
const createRunTestDecoration = (tests, states, visible, defaultGutterAction) => {
  const range = tests[0]?.item.range;
  if (!range) {
    throw new Error("Test decorations can only be created for tests with a range");
  }
  if (!visible) {
    return {
      range: collapseRange(range),
      options: { isWholeLine: true, description: "run-test-decoration" }
    };
  }
  let computedState = TestResultState.Unset;
  const hoverMessageParts = [];
  let testIdWithMessages;
  let retired = false;
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const resultItem = states[i];
    const state = resultItem?.computedState ?? TestResultState.Unset;
    if (hoverMessageParts.length < 10) {
      hoverMessageParts.push(labelForTestInState(test.item.label, state));
    }
    computedState = maxPriority(computedState, state);
    retired = retired || !!resultItem?.retired;
    if (!testIdWithMessages && resultItem?.tasks.some((t) => t.messages.length)) {
      testIdWithMessages = test.item.extId;
    }
  }
  const hasMultipleTests = tests.length > 1 || tests[0].children.size > 0;
  const primaryIcon = computedState === TestResultState.Unset ? hasMultipleTests ? testingRunAllIcon : testingRunIcon : testingStatesToIcons.get(computedState);
  const alternateIcon = defaultGutterAction === DefaultGutterClickAction.Debug ? hasMultipleTests ? testingRunAllIcon : testingRunIcon : hasMultipleTests ? testingDebugAllIcon : testingDebugIcon;
  let hoverMessage;
  let glyphMarginClassName = "testing-run-glyph";
  if (retired) {
    glyphMarginClassName += " retired";
  }
  const defaultOptions = {
    description: "run-test-decoration",
    showIfCollapsed: true,
    get hoverMessage() {
      if (!hoverMessage) {
        const building = hoverMessage = new MarkdownString("", true).appendText(hoverMessageParts.join(", ") + ".");
        if (testIdWithMessages) {
          const args = encodeURIComponent(JSON.stringify([testIdWithMessages]));
          building.appendMarkdown(` [${localize("peekTestOutout", "Peek Test Output")}](command:vscode.peekTestError?${args})`);
        }
      }
      return hoverMessage;
    },
    glyphMargin: { position: GLYPH_MARGIN_LANE },
    glyphMarginClassName: `${ThemeIcon.asClassName(primaryIcon)} ${glyphMarginClassName}`,
    stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
    zIndex: 1e4
  };
  const alternateOptions = {
    ...defaultOptions,
    glyphMarginClassName: `${ThemeIcon.asClassName(alternateIcon)} ${glyphMarginClassName}`
  };
  return {
    range: collapseRange(range),
    options: defaultOptions,
    alternate: alternateOptions
  };
};
var LensContentWidgetVars = /* @__PURE__ */ ((LensContentWidgetVars2) => {
  LensContentWidgetVars2["FontFamily"] = "testingDiffLensFontFamily";
  LensContentWidgetVars2["FontFeatures"] = "testingDiffLensFontFeatures";
  return LensContentWidgetVars2;
})(LensContentWidgetVars || {});
class TitleLensContentWidget {
  constructor(editor) {
    this.editor = editor;
    /** @inheritdoc */
    this.allowEditorOverflow = false;
    /** @inheritdoc */
    this.suppressMouseDown = true;
    this._domNode = dom.$("span");
    queueMicrotask(() => {
      this.applyStyling();
      this.editor.addContentWidget(this);
    });
  }
  applyStyling() {
    let fontSize = this.editor.getOption(EditorOption.codeLensFontSize);
    let height;
    if (!fontSize || fontSize < 5) {
      fontSize = this.editor.getOption(EditorOption.fontSize) * 0.9 | 0;
      height = this.editor.getOption(EditorOption.lineHeight);
    } else {
      height = fontSize * Math.max(1.3, this.editor.getOption(EditorOption.lineHeight) / this.editor.getOption(EditorOption.fontSize)) | 0;
    }
    const editorFontInfo = this.editor.getOption(EditorOption.fontInfo);
    const node = this._domNode;
    node.classList.add("testing-diff-lens-widget");
    node.textContent = this.getText();
    node.style.lineHeight = `${height}px`;
    node.style.fontSize = `${fontSize}px`;
    node.style.fontFamily = `var(--${"testingDiffLensFontFamily" /* FontFamily */})`;
    node.style.fontFeatureSettings = `var(--${"testingDiffLensFontFeatures" /* FontFeatures */})`;
    const containerStyle = this.editor.getContainerDomNode().style;
    containerStyle.setProperty("testingDiffLensFontFamily" /* FontFamily */, this.editor.getOption(EditorOption.codeLensFontFamily) ?? "inherit");
    containerStyle.setProperty("testingDiffLensFontFeatures" /* FontFeatures */, editorFontInfo.fontFeatureSettings);
    this.editor.changeViewZones((accessor) => {
      if (this.viewZoneId) {
        accessor.removeZone(this.viewZoneId);
      }
      this.viewZoneId = accessor.addZone({
        afterLineNumber: 0,
        afterColumn: Constants.MAX_SAFE_SMALL_INTEGER,
        domNode: document.createElement("div"),
        heightInPx: 20
      });
    });
  }
  /** @inheritdoc */
  getDomNode() {
    return this._domNode;
  }
  /** @inheritdoc */
  dispose() {
    this.editor.changeViewZones((accessor) => {
      if (this.viewZoneId) {
        accessor.removeZone(this.viewZoneId);
      }
    });
    this.editor.removeContentWidget(this);
  }
  /** @inheritdoc */
  getPosition() {
    return {
      position: { column: 0, lineNumber: 0 },
      preference: [ContentWidgetPositionPreference.ABOVE]
    };
  }
}
class ExpectedLensContentWidget extends TitleLensContentWidget {
  getId() {
    return "expectedTestingLens";
  }
  getText() {
    return localize("expected.title", "Expected");
  }
}
class ActualLensContentWidget extends TitleLensContentWidget {
  getId() {
    return "actualTestingLens";
  }
  getText() {
    return localize("actual.title", "Actual");
  }
}
let RunTestDecoration = class {
  constructor(tests, visible, model, codeEditorService, testService, contextMenuService, commandService, configurationService, testProfileService, contextKeyService, menuService) {
    this.tests = tests;
    this.visible = visible;
    this.model = model;
    this.codeEditorService = codeEditorService;
    this.testService = testService;
    this.contextMenuService = contextMenuService;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.testProfileService = testProfileService;
    this.contextKeyService = contextKeyService;
    this.menuService = menuService;
    /** @inheritdoc */
    this.id = "";
    this.displayedStates = tests.map((t) => t.resultItem?.computedState);
    this.editorDecoration = createRunTestDecoration(
      tests.map((t) => t.test),
      tests.map((t) => t.resultItem),
      visible,
      getTestingConfiguration(this.configurationService, TestingConfigKeys.DefaultGutterClickAction)
    );
    this.editorDecoration.options.glyphMarginHoverMessage = new MarkdownString().appendText(this.getGutterLabel());
  }
  get line() {
    return this.editorDecoration.range.startLineNumber;
  }
  get testIds() {
    return this.tests.map((t) => t.test.item.extId);
  }
  /** @inheritdoc */
  click(e) {
    if (e.target.type !== MouseTargetType.GUTTER_GLYPH_MARGIN || e.target.detail.glyphMarginLane !== GLYPH_MARGIN_LANE || e.event.rightButton || isMacintosh && e.event.leftButton && e.event.ctrlKey) {
      return false;
    }
    const alternateAction = e.event.altKey;
    switch (getTestingConfiguration(this.configurationService, TestingConfigKeys.DefaultGutterClickAction)) {
      case DefaultGutterClickAction.ContextMenu:
        this.showContextMenu(e);
        break;
      case DefaultGutterClickAction.Debug:
        this.runWith(alternateAction ? TestRunProfileBitset.Run : TestRunProfileBitset.Debug);
        break;
      case DefaultGutterClickAction.Coverage:
        this.runWith(alternateAction ? TestRunProfileBitset.Debug : TestRunProfileBitset.Coverage);
        break;
      case DefaultGutterClickAction.Run:
      default:
        this.runWith(alternateAction ? TestRunProfileBitset.Debug : TestRunProfileBitset.Run);
        break;
    }
    return true;
  }
  /**
   * Updates the decoration to match the new set of tests.
   * @returns true if options were changed, false otherwise
   */
  replaceOptions(newTests, visible) {
    const displayedStates = newTests.map((t) => t.resultItem?.computedState);
    if (visible === this.visible && equals(this.displayedStates, displayedStates)) {
      return false;
    }
    this.tests = newTests;
    this.displayedStates = displayedStates;
    this.visible = visible;
    const { options, alternate } = createRunTestDecoration(
      newTests.map((t) => t.test),
      newTests.map((t) => t.resultItem),
      visible,
      getTestingConfiguration(this.configurationService, TestingConfigKeys.DefaultGutterClickAction)
    );
    this.editorDecoration.options = options;
    this.editorDecoration.alternate = alternate;
    this.editorDecoration.options.glyphMarginHoverMessage = new MarkdownString().appendText(this.getGutterLabel());
    return true;
  }
  /**
   * Gets whether this decoration serves as the run button for the given test ID.
   */
  isForTest(testId) {
    return this.tests.some((t) => t.test.item.extId === testId);
  }
  runWith(profile) {
    return this.testService.runTests({
      tests: simplifyTestsToExecute(this.testService.collection, this.tests.map(({ test }) => test)),
      group: profile
    });
  }
  showContextMenu(e) {
    const editor = this.codeEditorService.listCodeEditors().find((e2) => e2.getModel() === this.model);
    editor?.getContribution(EditorLineNumberContextMenu.ID)?.show(e);
  }
  getGutterLabel() {
    switch (getTestingConfiguration(this.configurationService, TestingConfigKeys.DefaultGutterClickAction)) {
      case DefaultGutterClickAction.ContextMenu:
        return localize("testing.gutterMsg.contextMenu", "Click for test options");
      case DefaultGutterClickAction.Debug:
        return localize("testing.gutterMsg.debug", "Click to debug tests, right click for more options");
      case DefaultGutterClickAction.Coverage:
        return localize("testing.gutterMsg.coverage", "Click to run tests with coverage, right click for more options");
      case DefaultGutterClickAction.Run:
      default:
        return localize("testing.gutterMsg.run", "Click to run tests, right click for more options");
    }
  }
  /**
   * Gets context menu actions relevant for a singel test.
   */
  getTestContextMenuActions(test, resultItem) {
    const testActions = [];
    const capabilities = this.testProfileService.capabilitiesForTest(test.item);
    [
      { bitset: TestRunProfileBitset.Run, label: localize("run test", "Run Test") },
      { bitset: TestRunProfileBitset.Debug, label: localize("debug test", "Debug Test") },
      { bitset: TestRunProfileBitset.Coverage, label: localize("coverage test", "Run with Coverage") }
    ].forEach(({ bitset, label }) => {
      if (capabilities & bitset) {
        testActions.push(new Action(
          `testing.gutter.${bitset}`,
          label,
          void 0,
          void 0,
          () => this.testService.runTests({ group: bitset, tests: [test] })
        ));
      }
    });
    if (capabilities & TestRunProfileBitset.HasNonDefaultProfile) {
      testActions.push(new Action("testing.runUsing", localize("testing.runUsing", "Execute Using Profile..."), void 0, void 0, async () => {
        const profile = await this.commandService.executeCommand("vscode.pickTestProfile", { onlyForTest: test });
        if (!profile) {
          return;
        }
        this.testService.runResolvedTests({
          group: profile.group,
          targets: [{
            profileId: profile.profileId,
            controllerId: profile.controllerId,
            testIds: [test.item.extId]
          }]
        });
      }));
    }
    if (resultItem && isFailedState(resultItem.computedState)) {
      testActions.push(new Action(
        "testing.gutter.peekFailure",
        localize("peek failure", "Peek Error"),
        void 0,
        void 0,
        () => this.commandService.executeCommand("vscode.peekTestError", test.item.extId)
      ));
    }
    testActions.push(new Action(
      "testing.gutter.reveal",
      localize("reveal test", "Reveal in Test Explorer"),
      void 0,
      void 0,
      () => this.commandService.executeCommand("_revealTestInExplorer", test.item.extId)
    ));
    const contributed = this.getContributedTestActions(test, capabilities);
    return { object: Separator.join(testActions, contributed), dispose() {
      testActions.forEach((a) => a.dispose());
    } };
  }
  getContributedTestActions(test, capabilities) {
    const contextOverlay = this.contextKeyService.createOverlay(getTestItemContextOverlay(test, capabilities));
    const arg = getContextForTestItem(this.testService.collection, test.item.extId);
    const menu = this.menuService.getMenuActions(MenuId.TestItemGutter, contextOverlay, { shouldForwardArgs: true, arg });
    return getFlatContextMenuActions(menu);
  }
};
RunTestDecoration = __decorateClass([
  __decorateParam(3, ICodeEditorService),
  __decorateParam(4, ITestService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, ITestProfileService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IMenuService)
], RunTestDecoration);
let MultiRunTestDecoration = class extends RunTestDecoration {
  constructor(tests, visible, model, codeEditorService, testService, contextMenuService, commandService, configurationService, testProfileService, contextKeyService, menuService, quickInputService) {
    super(tests, visible, model, codeEditorService, testService, contextMenuService, commandService, configurationService, testProfileService, contextKeyService, menuService);
    this.quickInputService = quickInputService;
  }
  getContextMenuActions() {
    const disposable = new DisposableStore();
    const allActions = [];
    [
      { bitset: TestRunProfileBitset.Run, label: localize("run all test", "Run All Tests") },
      { bitset: TestRunProfileBitset.Coverage, label: localize("run all test with coverage", "Run All Tests with Coverage") },
      { bitset: TestRunProfileBitset.Debug, label: localize("debug all test", "Debug All Tests") }
    ].forEach(({ bitset, label }, i) => {
      const canRun = this.tests.some(({ test }) => this.testProfileService.capabilitiesForTest(test.item) & bitset);
      if (canRun) {
        allActions.push(new Action(`testing.gutter.run${i}`, label, void 0, void 0, () => this.runWith(bitset)));
      }
    });
    disposable.add(toDisposable(() => allActions.forEach((a) => a.dispose())));
    const testItems = this.tests.map((testItem) => ({
      currentLabel: testItem.test.item.label,
      testItem,
      parent: TestId.fromString(testItem.test.item.extId).parentId
    }));
    const getLabelConflicts = (tests) => {
      const labelCount = /* @__PURE__ */ new Map();
      for (const test of tests) {
        labelCount.set(test.currentLabel, (labelCount.get(test.currentLabel) || 0) + 1);
      }
      return tests.filter((e) => labelCount.get(e.currentLabel) > 1);
    };
    let conflicts, hasParent = true;
    while ((conflicts = getLabelConflicts(testItems)).length && hasParent) {
      for (const conflict of conflicts) {
        if (conflict.parent) {
          const parent = this.testService.collection.getNodeById(conflict.parent.toString());
          conflict.currentLabel = parent?.item.label + " > " + conflict.currentLabel;
          conflict.parent = conflict.parent.parentId;
        } else {
          hasParent = false;
        }
      }
    }
    testItems.sort((a, b) => {
      const ai = a.testItem.test.item;
      const bi = b.testItem.test.item;
      return (ai.sortText || ai.label).localeCompare(bi.sortText || bi.label);
    });
    let testSubmenus = testItems.map(({ currentLabel, testItem }) => {
      const actions = this.getTestContextMenuActions(testItem.test, testItem.resultItem);
      disposable.add(actions);
      let label = stripIcons(currentLabel);
      const lf = label.indexOf("\n");
      if (lf !== -1) {
        label = label.slice(0, lf);
      }
      return new SubmenuAction(testItem.test.item.extId, label, actions.object);
    });
    const overflow = testSubmenus.length - MAX_TESTS_IN_SUBMENU;
    if (overflow > 0) {
      testSubmenus = testSubmenus.slice(0, MAX_TESTS_IN_SUBMENU);
      testSubmenus.push(new Action(
        "testing.gutter.overflow",
        localize("testOverflowItems", "{0} more tests...", overflow),
        void 0,
        void 0,
        () => this.pickAndRun(testItems)
      ));
    }
    return { object: Separator.join(allActions, testSubmenus), dispose: () => disposable.dispose() };
  }
  async pickAndRun(testItems) {
    const doPick = (items, title) => new Promise((resolve) => {
      const disposables = new DisposableStore();
      const pick = disposables.add(this.quickInputService.createQuickPick());
      pick.placeholder = title;
      pick.items = items;
      disposables.add(pick.onDidHide(() => {
        resolve(void 0);
        disposables.dispose();
      }));
      disposables.add(pick.onDidAccept(() => {
        resolve(pick.selectedItems[0]);
        disposables.dispose();
      }));
      pick.show();
    });
    const item = await doPick(
      testItems.map(({ currentLabel, testItem }) => ({ label: currentLabel, test: testItem.test, result: testItem.resultItem })),
      localize("selectTestToRun", "Select a test to run")
    );
    if (!item) {
      return;
    }
    const actions = this.getTestContextMenuActions(item.test, item.result);
    try {
      (await doPick(actions.object, item.label))?.run();
    } finally {
      actions.dispose();
    }
  }
};
MultiRunTestDecoration = __decorateClass([
  __decorateParam(3, ICodeEditorService),
  __decorateParam(4, ITestService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, ITestProfileService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IMenuService),
  __decorateParam(11, IQuickInputService)
], MultiRunTestDecoration);
let RunSingleTestDecoration = class extends RunTestDecoration {
  constructor(test, resultItem, model, visible, codeEditorService, testService, commandService, contextMenuService, configurationService, testProfiles, contextKeyService, menuService) {
    super([{ test, resultItem }], visible, model, codeEditorService, testService, contextMenuService, commandService, configurationService, testProfiles, contextKeyService, menuService);
  }
  getContextMenuActions() {
    return this.getTestContextMenuActions(this.tests[0].test, this.tests[0].resultItem);
  }
};
RunSingleTestDecoration = __decorateClass([
  __decorateParam(4, ICodeEditorService),
  __decorateParam(5, ITestService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, ITestProfileService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IMenuService)
], RunSingleTestDecoration);
const lineBreakRe = /\r?\n\s*/g;
let TestMessageDecoration = class {
  constructor(testMessage, messageUri, textModel, peekOpener, editorService) {
    this.testMessage = testMessage;
    this.messageUri = messageUri;
    this.peekOpener = peekOpener;
    this.id = "";
    this.contentIdClass = `test-message-inline-content-id${generateUuid()}`;
    const location = testMessage.location;
    this.line = clamp(location.range.startLineNumber, 0, textModel.getLineCount());
    const severity = testMessage.type;
    const message = testMessage.message;
    const options = editorService.resolveDecorationOptions(TestMessageDecoration.decorationId, true);
    options.hoverMessage = typeof message === "string" ? new MarkdownString().appendText(message) : message;
    options.zIndex = 10;
    options.className = `testing-inline-message-severity-${severity}`;
    options.isWholeLine = true;
    options.stickiness = TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges;
    options.collapseOnReplaceEdit = true;
    let inlineText = renderTestMessageAsText(message).replace(lineBreakRe, " ");
    if (inlineText.length > MAX_INLINE_MESSAGE_LENGTH) {
      inlineText = inlineText.slice(0, MAX_INLINE_MESSAGE_LENGTH - 1) + "\u2026";
    }
    options.after = {
      content: inlineText,
      inlineClassName: `test-message-inline-content test-message-inline-content-s${severity} ${this.contentIdClass} ${messageUri ? "test-message-inline-content-clickable" : ""}`
    };
    options.showIfCollapsed = true;
    const rulerColor = severity === TestMessageType.Error ? overviewRulerError : overviewRulerInfo;
    if (rulerColor) {
      options.overviewRuler = { color: themeColorFromId(rulerColor), position: OverviewRulerLane.Right };
    }
    const lineLength = textModel.getLineLength(this.line);
    const column = lineLength ? lineLength + 1 : location.range.endColumn;
    this.editorDecoration = {
      options,
      range: {
        startLineNumber: this.line,
        startColumn: column,
        endColumn: column,
        endLineNumber: this.line
      }
    };
  }
  click(e) {
    if (e.event.rightButton) {
      return false;
    }
    if (!this.messageUri) {
      return false;
    }
    if (e.target.element?.className.includes(this.contentIdClass)) {
      this.peekOpener.peekUri(this.messageUri);
    }
    return false;
  }
  getContextMenuActions() {
    return { object: [], dispose: () => {
    } };
  }
};
TestMessageDecoration.inlineClassName = "test-message-inline-content";
TestMessageDecoration.decorationId = `testmessage-${generateUuid()}`;
TestMessageDecoration = __decorateClass([
  __decorateParam(3, ITestingPeekOpener),
  __decorateParam(4, ICodeEditorService)
], TestMessageDecoration);
const ERROR_CONTENT_WIDGET_HEIGHT = 20;
let TestErrorContentWidget = class extends Disposable {
  constructor(editor, position, message, resultItem, uri, peekOpener) {
    super();
    this.editor = editor;
    this.position = position;
    this.message = message;
    this.resultItem = resultItem;
    this.peekOpener = peekOpener;
    this.id = generateUuid();
    /** @inheritdoc */
    this.allowEditorOverflow = false;
    this.node = dom.h("div.test-error-content-widget", [
      dom.h("div.inner@inner", [
        dom.h("div.arrow@arrow"),
        dom.h(`span${ThemeIcon.asCSSSelector(testingStatesToIcons.get(TestResultState.Failed))}`),
        dom.h("span.content@name")
      ])
    ]);
    const setMarginTop = () => {
      const lineHeight = editor.getOption(EditorOption.lineHeight);
      this.node.root.style.marginTop = (lineHeight - ERROR_CONTENT_WIDGET_HEIGHT) / 2 + "px";
    };
    setMarginTop();
    this._register(editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.lineHeight)) {
        setMarginTop();
      }
    }));
    let text;
    if (message.expected !== void 0 && message.actual !== void 0) {
      text = `${truncateMiddle(message.actual.replace(/\s+/g, " "), 30)} != ${truncateMiddle(message.expected.replace(/\s+/g, " "), 30)}`;
    } else {
      const msg = renderStringAsPlaintext(message.message);
      const lf = msg.indexOf("\n");
      text = lf === -1 ? msg : msg.slice(0, lf);
    }
    this.node.root.addEventListener("click", (e) => {
      this.peekOpener.peekUri(uri);
      e.preventDefault();
    });
    const ctrl = TestingOutputPeekController.get(editor);
    if (ctrl) {
      this._register(autorun((reader) => {
        const subject = ctrl.subject.read(reader);
        const isCurrent = subject instanceof MessageSubject && subject.message === message;
        this.node.root.classList.toggle("is-current", isCurrent);
      }));
    }
    this.node.name.innerText = text || "Test Failed";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "15");
    svg.setAttribute("height", "10");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("viewBox", "0 0 15 10");
    const leftArrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
    leftArrow.setAttribute("d", "M15 0 L10 0 L0 5 L10 10 L15 10 Z");
    svg.append(leftArrow);
    this.node.arrow.appendChild(svg);
    this._register(editor.onDidChangeModelContent((e) => {
      for (const c of e.changes) {
        if (c.range.startLineNumber > this.line) {
          continue;
        }
        if (c.range.startLineNumber <= this.line && c.range.endLineNumber >= this.line || resultItem.item.range && resultItem.item.range.startLineNumber <= c.range.startLineNumber && resultItem.item.range.endLineNumber >= c.range.endLineNumber) {
          TestingDecorations.invalidatedTests.add(this.resultItem);
          this.dispose();
        }
        const adjust = count(c.text, "\n") - (c.range.endLineNumber - c.range.startLineNumber);
        if (adjust !== 0) {
          this.position = this.position.delta(adjust);
          this.editor.layoutContentWidget(this);
        }
      }
    }));
    editor.addContentWidget(this);
    this._register(toDisposable(() => editor.removeContentWidget(this)));
  }
  get line() {
    return this.position.lineNumber;
  }
  getId() {
    return this.id;
  }
  getDomNode() {
    return this.node.root;
  }
  getPosition() {
    return {
      position: this.position,
      preference: [ContentWidgetPositionPreference.EXACT]
    };
  }
  afterRender(_position, coordinate) {
    if (coordinate) {
      const { verticalScrollbarWidth } = this.editor.getLayoutInfo();
      const scrollWidth = this.editor.getScrollWidth();
      this.node.inner.style.maxWidth = `${scrollWidth - verticalScrollbarWidth - coordinate.left - 20}px`;
    }
  }
};
TestErrorContentWidget = __decorateClass([
  __decorateParam(5, ITestingPeekOpener)
], TestErrorContentWidget);
export {
  TestingDecorationService,
  TestingDecorations
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2Jyb3dzZXIvdGVzdGluZ0RlY29yYXRpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgcmVuZGVyU3RyaW5nQXNQbGFpbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBBY3Rpb24sIElBY3Rpb24sIFNlcGFyYXRvciwgU3VibWVudUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IG1hcEZpbmRGaXJzdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5c0ZpbmQuanMnO1xuaW1wb3J0IHsgUnVuT25jZVNjaGVkdWxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nLCBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IHN0cmlwSWNvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVNYXAsIERpc3Bvc2FibGVTdG9yZSwgSVJlZmVyZW5jZSwgTXV0YWJsZURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBjbGFtcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL251bWJlcnMuanMnO1xuaW1wb3J0IHsgYXV0b3J1biB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBjb3VudCwgdHJ1bmNhdGVNaWRkbGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBDb25zdGFudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91aW50LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UsIElDb2RlRWRpdG9yLCBJQ29udGVudFdpZGdldCwgSUNvbnRlbnRXaWRnZXRQb3NpdGlvbiwgSUNvbnRlbnRXaWRnZXRSZW5kZXJlZENvb3JkaW5hdGUsIElFZGl0b3JNb3VzZUV2ZW50LCBNb3VzZVRhcmdldFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgb3ZlcnZpZXdSdWxlckVycm9yLCBvdmVydmlld1J1bGVySW5mbyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9lZGl0b3JDb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IElSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgR2x5cGhNYXJnaW5MYW5lLCBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucywgSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvciwgSU1vZGVsRGVsdGFEZWNvcmF0aW9uLCBJVGV4dE1vZGVsLCBPdmVydmlld1J1bGVyTGFuZSwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgZ2V0RmxhdENvbnRleHRNZW51QWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBJTWVudVNlcnZpY2UsIE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IHRoZW1lQ29sb3JGcm9tSWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgRWRpdG9yTGluZU51bWJlckNvbnRleHRNZW51LCBHdXR0ZXJBY3Rpb25zUmVnaXN0cnkgfSBmcm9tICcuLi8uLi9jb2RlRWRpdG9yL2Jyb3dzZXIvZWRpdG9yTGluZU51bWJlck1lbnUuanMnO1xuaW1wb3J0IHsgRGVmYXVsdEd1dHRlckNsaWNrQWN0aW9uLCBUZXN0aW5nQ29uZmlnS2V5cywgZ2V0VGVzdGluZ0NvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0aW5nLCBsYWJlbEZvclRlc3RJblN0YXRlIH0gZnJvbSAnLi4vY29tbW9uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBUZXN0SWQgfSBmcm9tICcuLi9jb21tb24vdGVzdElkLmpzJztcbmltcG9ydCB7IElUZXN0UHJvZmlsZVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdGVzdFByb2ZpbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXN0UmVzdWx0LCBMaXZlVGVzdFJlc3VsdCwgVGVzdFJlc3VsdEl0ZW1DaGFuZ2VSZWFzb24gfSBmcm9tICcuLi9jb21tb24vdGVzdFJlc3VsdC5qcyc7XG5pbXBvcnQgeyBJVGVzdFJlc3VsdFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdGVzdFJlc3VsdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlc3RTZXJ2aWNlLCBnZXRDb250ZXh0Rm9yVGVzdEl0ZW0sIHNpbXBsaWZ5VGVzdHNUb0V4ZWN1dGUsIHRlc3RzSW5GaWxlIH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXN0RXJyb3JNZXNzYWdlLCBJVGVzdE1lc3NhZ2UsIElUZXN0UnVuUHJvZmlsZSwgSW5jcmVtZW50YWxUZXN0Q29sbGVjdGlvbkl0ZW0sIEludGVybmFsVGVzdEl0ZW0sIFRlc3REaWZmT3BUeXBlLCBUZXN0TWVzc2FnZVR5cGUsIFRlc3RSZXN1bHRJdGVtLCBUZXN0UmVzdWx0U3RhdGUsIFRlc3RSdW5Qcm9maWxlQml0c2V0IH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBJVGVzdERlY29yYXRpb24gYXMgSVB1YmxpY1Rlc3REZWNvcmF0aW9uLCBJVGVzdGluZ0RlY29yYXRpb25zU2VydmljZSwgVGVzdERlY29yYXRpb25zIH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RpbmdEZWNvcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBJVGVzdGluZ1BlZWtPcGVuZXIgfSBmcm9tICcuLi9jb21tb24vdGVzdGluZ1BlZWtPcGVuZXIuanMnO1xuaW1wb3J0IHsgaXNGYWlsZWRTdGF0ZSwgbWF4UHJpb3JpdHkgfSBmcm9tICcuLi9jb21tb24vdGVzdGluZ1N0YXRlcy5qcyc7XG5pbXBvcnQgeyBUZXN0VXJpVHlwZSwgYnVpbGRUZXN0VXJpLCBwYXJzZVRlc3RVcmkgfSBmcm9tICcuLi9jb21tb24vdGVzdGluZ1VyaS5qcyc7XG5pbXBvcnQgeyBnZXRUZXN0SXRlbUNvbnRleHRPdmVybGF5IH0gZnJvbSAnLi9leHBsb3JlclByb2plY3Rpb25zL3Rlc3RJdGVtQ29udGV4dE92ZXJsYXkuanMnO1xuaW1wb3J0IHsgdGVzdGluZ0RlYnVnQWxsSWNvbiwgdGVzdGluZ0RlYnVnSWNvbiwgdGVzdGluZ1J1bkFsbEljb24sIHRlc3RpbmdSdW5JY29uLCB0ZXN0aW5nU3RhdGVzVG9JY29ucyB9IGZyb20gJy4vaWNvbnMuanMnO1xuaW1wb3J0IHsgcmVuZGVyVGVzdE1lc3NhZ2VBc1RleHQgfSBmcm9tICcuL3Rlc3RNZXNzYWdlQ29sb3JpemVyLmpzJztcbmltcG9ydCB7IE1lc3NhZ2VTdWJqZWN0IH0gZnJvbSAnLi90ZXN0UmVzdWx0c1ZpZXcvdGVzdFJlc3VsdHNTdWJqZWN0LmpzJztcbmltcG9ydCB7IFRlc3RpbmdPdXRwdXRQZWVrQ29udHJvbGxlciB9IGZyb20gJy4vdGVzdGluZ091dHB1dFBlZWsuanMnO1xuXG5jb25zdCBNQVhfSU5MSU5FX01FU1NBR0VfTEVOR1RIID0gMTI4O1xuY29uc3QgTUFYX1RFU1RTX0lOX1NVQk1FTlUgPSAzMDtcbmNvbnN0IEdMWVBIX01BUkdJTl9MQU5FID0gR2x5cGhNYXJnaW5MYW5lLkNlbnRlcjtcblxuZnVuY3Rpb24gaXNPcmlnaW5hbEluRGlmZkVkaXRvcihjb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLCBjb2RlRWRpdG9yOiBJQ29kZUVkaXRvcik6IGJvb2xlYW4ge1xuXHRjb25zdCBkaWZmRWRpdG9ycyA9IGNvZGVFZGl0b3JTZXJ2aWNlLmxpc3REaWZmRWRpdG9ycygpO1xuXG5cdGZvciAoY29uc3QgZGlmZkVkaXRvciBvZiBkaWZmRWRpdG9ycykge1xuXHRcdGlmIChkaWZmRWRpdG9yLmdldE9yaWdpbmFsRWRpdG9yKCkgPT09IGNvZGVFZGl0b3IpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBmYWxzZTtcbn1cblxuaW50ZXJmYWNlIElUZXN0RGVjb3JhdGlvbiBleHRlbmRzIElQdWJsaWNUZXN0RGVjb3JhdGlvbiB7XG5cdGlkOiBzdHJpbmc7XG5cdGNsaWNrKGU6IElFZGl0b3JNb3VzZUV2ZW50KTogYm9vbGVhbjtcbn1cblxuLyoqIFZhbHVlIGZvciBzYXZlZCBkZWNvcmF0aW9ucywgcHJvdmlkaW5nIGZhc3QgYWNjZXNzb3JzIGZvciB0aGUgaG90ICdzeW5jRGVjb3JhdGlvbnMnIHBhdGggKi9cbmNsYXNzIENhY2hlZERlY29yYXRpb25zIHtcblx0cHJpdmF0ZSByZWFkb25seSBydW5CeUlkS2V5ID0gbmV3IE1hcDxzdHJpbmcsIFJ1blRlc3REZWNvcmF0aW9uPigpO1xuXG5cdHB1YmxpYyBnZXQgc2l6ZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5ydW5CeUlkS2V5LnNpemU7XG5cdH1cblxuXHQvKiogR2V0cyBhIHRlc3QgcnVuIGRlY29yYXRpb24gdGhhdCBjb250YWlucyBleGFjdGx5IHRoZSBnaXZlbiB0ZXN0IElEcyAqL1xuXHRwdWJsaWMgZ2V0Rm9yRXhhY3RUZXN0cyh0ZXN0SWRzOiBzdHJpbmdbXSkge1xuXHRcdGNvbnN0IGtleSA9IHRlc3RJZHMuc29ydCgpLmpvaW4oJ1xcMFxcMCcpO1xuXHRcdHJldHVybiB0aGlzLnJ1bkJ5SWRLZXkuZ2V0KGtleSk7XG5cdH1cblx0LyoqIEFkZHMgYSBuZXcgdGVzdCBydW4gZGVjcm9hdGlvbiAqL1xuXHRwdWJsaWMgYWRkVGVzdChkOiBSdW5UZXN0RGVjb3JhdGlvbikge1xuXHRcdGNvbnN0IGtleSA9IGQudGVzdElkcy5zb3J0KCkuam9pbignXFwwXFwwJyk7XG5cdFx0dGhpcy5ydW5CeUlkS2V5LnNldChrZXksIGQpO1xuXHR9XG5cblx0LyoqIEZpbmRzIGFuIGV4dGVuc2lvbiBieSBWUyBDb2RlIGV2ZW50IElEICovXG5cdHB1YmxpYyBnZXRCeUlkKGRlY29yYXRpb25JZDogc3RyaW5nKSB7XG5cdFx0Zm9yIChjb25zdCBkIG9mIHRoaXMucnVuQnlJZEtleS52YWx1ZXMoKSkge1xuXHRcdFx0aWYgKGQuaWQgPT09IGRlY29yYXRpb25JZCkge1xuXHRcdFx0XHRyZXR1cm4gZDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdC8qKiBJdGVyYXRlIG92ZXIgYWxsIGRlY29yYXRpb25zICovXG5cdCpbU3ltYm9sLml0ZXJhdG9yXSgpOiBJdGVyYWJsZUl0ZXJhdG9yPElUZXN0RGVjb3JhdGlvbj4ge1xuXHRcdGZvciAoY29uc3QgZCBvZiB0aGlzLnJ1bkJ5SWRLZXkudmFsdWVzKCkpIHtcblx0XHRcdHlpZWxkIGQ7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0aW5nRGVjb3JhdGlvblNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVRlc3RpbmdEZWNvcmF0aW9uc1NlcnZpY2Uge1xuXHRkZWNsYXJlIHB1YmxpYyBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBnZW5lcmF0aW9uID0gMDtcblx0cHJpdmF0ZSByZWFkb25seSBjaGFuZ2VFbWl0dGVyID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBkZWNvcmF0aW9uQ2FjaGUgPSBuZXcgUmVzb3VyY2VNYXA8e1xuXHRcdC8qKiBUaGUgZG9jdW1lbnQgdmVyc2lvbiBhdCB3aGljaCByYW5nZXMgaGF2ZSBiZWVuIHVwZGF0ZWQsIHJlcXVpcmluZyByZXJlbmRlcmluZyAqL1xuXHRcdHJhbmdlVXBkYXRlVmVyc2lvbklkPzogbnVtYmVyO1xuXHRcdC8qKiBDb3VudGVyIGZvciB0aGUgcmVzdWx0cyByZW5kZXJlZCBpbiB0aGUgZG9jdW1lbnQgKi9cblx0XHRnZW5lcmF0aW9uOiBudW1iZXI7XG5cdFx0aXNBbHQ/OiBib29sZWFuO1xuXHRcdHZhbHVlOiBDYWNoZWREZWNvcmF0aW9ucztcblx0fT4oKTtcblxuXHQvKipcblx0ICogTGlzdCBvZiBtZXNzYWdlcyB0aGF0IHNob3VsZCBiZSBoaWRkZW4gYmVjYXVzZSBhbiBlZGl0b3IgY2hhbmdlZCB0aGVpclxuXHQgKiB1bmRlcmx5aW5nIHJhbmdlcy4gSSB0aGluayB0aGlzIGlzIGdvb2QgZW5vdWdoLCBiZWNhdXNlOlxuXHQgKiAgLSBNZXNzYWdlIGRlY29yYXRpb25zIGFyZSBuZXZlciBzaG93biBhY3Jvc3MgcmVsb2FkczsgdGhpcyBkb2VzIG5vdFxuXHQgKiAgICBuZWVkIHRvIHBlcnNpc3Rcblx0ICogIC0gTWVzc2FnZSBpbnN0YW5jZXMgYXJlIHN0YWJsZSBmb3IgYW55IGNvbXBsZXRlZCB0ZXN0IHJlc3VsdHMgZm9yXG5cdCAqICAgIHRoZSBkdXJhdGlvbiBvZiB0aGUgc2Vzc2lvbi5cblx0ICovXG5cdHByaXZhdGUgcmVhZG9ubHkgaW52YWxpZGF0ZWRNZXNzYWdlcyA9IG5ldyBXZWFrU2V0PElUZXN0TWVzc2FnZT4oKTtcblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlID0gdGhpcy5jaGFuZ2VFbWl0dGVyLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVRlc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVzdFNlcnZpY2U6IElUZXN0U2VydmljZSxcblx0XHRASVRlc3RSZXN1bHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcmVzdWx0czogSVRlc3RSZXN1bHRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdGNvZGVFZGl0b3JTZXJ2aWNlLnJlZ2lzdGVyRGVjb3JhdGlvblR5cGUoJ3Rlc3QtbWVzc2FnZS1kZWNvcmF0aW9uJywgVGVzdE1lc3NhZ2VEZWNvcmF0aW9uLmRlY29yYXRpb25JZCwge30sIHVuZGVmaW5lZCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihtb2RlbFNlcnZpY2Uub25Nb2RlbFJlbW92ZWQoZSA9PiB0aGlzLmRlY29yYXRpb25DYWNoZS5kZWxldGUoZS51cmkpKSk7XG5cblx0XHRjb25zdCBkZWJvdW5jZUludmFsaWRhdGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLmludmFsaWRhdGUoKSwgMTAwKSk7XG5cblx0XHQvLyBJZiByYW5nZXMgd2VyZSB1cGRhdGVkIGluIHRoZSBkb2N1bWVudCwgbWFyayB0aGF0IHdlIHNob3VsZCBleHBsaWNpdGx5XG5cdFx0Ly8gc3luYyBkZWNvcmF0aW9ucyB0byB0aGUgcHVibGlzaGVkIGxpbmVzLCBzaW5jZSB3ZSBhc3N1bWUgdGhhdCBldmVyeXRoaW5nXG5cdFx0Ly8gaXMgdXAgdG8gZGF0ZS4gVGhpcyBwcmV2ZW50cyBpc3N1ZXMsIGFzIGluICMxMzg2MzIsICMxMzg4MzUsICMxMzg5MjIuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50ZXN0U2VydmljZS5vbldpbGxQcm9jZXNzRGlmZihkaWZmID0+IHtcblx0XHRcdGZvciAoY29uc3QgZW50cnkgb2YgZGlmZikge1xuXHRcdFx0XHRpZiAoZW50cnkub3AgIT09IFRlc3REaWZmT3BUeXBlLkRvY3VtZW50U3luY2VkKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCByZWMgPSB0aGlzLmRlY29yYXRpb25DYWNoZS5nZXQoZW50cnkudXJpKTtcblx0XHRcdFx0aWYgKHJlYykge1xuXHRcdFx0XHRcdHJlYy5yYW5nZVVwZGF0ZVZlcnNpb25JZCA9IGVudHJ5LmRvY3Y7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCFkZWJvdW5jZUludmFsaWRhdGUuaXNTY2hlZHVsZWQoKSkge1xuXHRcdFx0XHRkZWJvdW5jZUludmFsaWRhdGUuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5hbnkoXG5cdFx0XHR0aGlzLnJlc3VsdHMub25SZXN1bHRzQ2hhbmdlZCxcblx0XHRcdHRoaXMucmVzdWx0cy5vblRlc3RDaGFuZ2VkLFxuXHRcdFx0dGhpcy50ZXN0U2VydmljZS5leGNsdWRlZC5vblRlc3RFeGNsdXNpb25zQ2hhbmdlZCxcblx0XHRcdEV2ZW50LmZpbHRlcihjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24sIGUgPT4gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUZXN0aW5nQ29uZmlnS2V5cy5HdXR0ZXJFbmFibGVkKSksXG5cdFx0KSgoKSA9PiB7XG5cdFx0XHRpZiAoIWRlYm91bmNlSW52YWxpZGF0ZS5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHRcdGRlYm91bmNlSW52YWxpZGF0ZS5zY2hlZHVsZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKEd1dHRlckFjdGlvbnNSZWdpc3RyeS5yZWdpc3Rlckd1dHRlckFjdGlvbnNHZW5lcmF0b3IoKGNvbnRleHQsIHJlc3VsdCkgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBjb250ZXh0LmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdFx0Y29uc3QgdGVzdGluZ0RlY29yYXRpb25zID0gVGVzdGluZ0RlY29yYXRpb25zLmdldChjb250ZXh0LmVkaXRvcik7XG5cdFx0XHRpZiAoIW1vZGVsIHx8ICF0ZXN0aW5nRGVjb3JhdGlvbnM/LmN1cnJlbnRVcmkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjdXJyZW50RGVjb3JhdGlvbnMgPSB0aGlzLnN5bmNEZWNvcmF0aW9ucyh0ZXN0aW5nRGVjb3JhdGlvbnMuY3VycmVudFVyaSk7XG5cdFx0XHRpZiAoIWN1cnJlbnREZWNvcmF0aW9ucy5zaXplKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbW9kZWxEZWNvcmF0aW9ucyA9IG1vZGVsLmdldExpbmVzRGVjb3JhdGlvbnMoY29udGV4dC5saW5lTnVtYmVyLCBjb250ZXh0LmxpbmVOdW1iZXIpO1xuXHRcdFx0Zm9yIChjb25zdCB7IGlkIH0gb2YgbW9kZWxEZWNvcmF0aW9ucykge1xuXHRcdFx0XHRjb25zdCBkZWNvcmF0aW9uID0gY3VycmVudERlY29yYXRpb25zLmdldEJ5SWQoaWQpO1xuXHRcdFx0XHRpZiAoZGVjb3JhdGlvbikge1xuXHRcdFx0XHRcdGNvbnN0IHsgb2JqZWN0OiBhY3Rpb25zIH0gPSBkZWNvcmF0aW9uLmdldENvbnRleHRNZW51QWN0aW9ucygpO1xuXHRcdFx0XHRcdGZvciAoY29uc3QgYWN0aW9uIG9mIGFjdGlvbnMpIHtcblx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKGFjdGlvbiwgJzFfdGVzdGluZycpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgaW52YWxpZGF0ZVJlc3VsdE1lc3NhZ2UobWVzc2FnZTogSVRlc3RNZXNzYWdlKSB7XG5cdFx0dGhpcy5pbnZhbGlkYXRlZE1lc3NhZ2VzLmFkZChtZXNzYWdlKTtcblx0XHR0aGlzLmludmFsaWRhdGUoKTtcblx0fVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgc3luY0RlY29yYXRpb25zKHJlc291cmNlOiBVUkkpOiBDYWNoZWREZWNvcmF0aW9ucyB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLm1vZGVsU2VydmljZS5nZXRNb2RlbChyZXNvdXJjZSk7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuIG5ldyBDYWNoZWREZWNvcmF0aW9ucygpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNhY2hlZCA9IHRoaXMuZGVjb3JhdGlvbkNhY2hlLmdldChyZXNvdXJjZSk7XG5cdFx0aWYgKGNhY2hlZCAmJiBjYWNoZWQuZ2VuZXJhdGlvbiA9PT0gdGhpcy5nZW5lcmF0aW9uICYmIChjYWNoZWQucmFuZ2VVcGRhdGVWZXJzaW9uSWQgPT09IHVuZGVmaW5lZCB8fCBjYWNoZWQucmFuZ2VVcGRhdGVWZXJzaW9uSWQgIT09IG1vZGVsLmdldFZlcnNpb25JZCgpKSkge1xuXHRcdFx0cmV0dXJuIGNhY2hlZC52YWx1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5hcHBseURlY29yYXRpb25zKG1vZGVsKTtcblx0fVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgZ2V0RGVjb3JhdGVkVGVzdFBvc2l0aW9uKHJlc291cmNlOiBVUkksIHRlc3RJZDogc3RyaW5nKSB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLm1vZGVsU2VydmljZS5nZXRNb2RlbChyZXNvdXJjZSk7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBkZWNvcmF0aW9uID0gSXRlcmFibGUuZmluZCh0aGlzLnN5bmNEZWNvcmF0aW9ucyhyZXNvdXJjZSksIHYgPT4gdiBpbnN0YW5jZW9mIFJ1blRlc3REZWNvcmF0aW9uICYmIHYuaXNGb3JUZXN0KHRlc3RJZCkpO1xuXHRcdGlmICghZGVjb3JhdGlvbikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHQvLyBkZWNvcmF0aW9uIGlzIGNvbGxhcHNlZCwgc28gdGhlIHJhbmdlIGlzIG1lYW5pbmdsZXNzOyBvbmx5IHBvc2l0aW9uIG1hdHRlcnMuXG5cdFx0cmV0dXJuIG1vZGVsLmdldERlY29yYXRpb25SYW5nZShkZWNvcmF0aW9uLmlkKT8uZ2V0U3RhcnRQb3NpdGlvbigpO1xuXHR9XG5cblx0cHJpdmF0ZSBpbnZhbGlkYXRlKCkge1xuXHRcdHRoaXMuZ2VuZXJhdGlvbisrO1xuXHRcdHRoaXMuY2hhbmdlRW1pdHRlci5maXJlKCk7XG5cdH1cblxuXHQvKipcblx0ICogU2V0cyB3aGV0aGVyIGFsdGVybmF0ZSBhY3Rpb25zIGFyZSBzaG93biBmb3IgdGhlIG1vZGVsLlxuXHQgKi9cblx0cHVibGljIHVwZGF0ZURlY29yYXRpb25zQWx0ZXJuYXRlQWN0aW9uKHJlc291cmNlOiBVUkksIGlzQWx0OiBib29sZWFuKSB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLm1vZGVsU2VydmljZS5nZXRNb2RlbChyZXNvdXJjZSk7XG5cdFx0Y29uc3QgY2FjaGVkID0gdGhpcy5kZWNvcmF0aW9uQ2FjaGUuZ2V0KHJlc291cmNlKTtcblx0XHRpZiAoIW1vZGVsIHx8ICFjYWNoZWQgfHwgY2FjaGVkLmlzQWx0ID09PSBpc0FsdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNhY2hlZC5pc0FsdCA9IGlzQWx0O1xuXHRcdG1vZGVsLmNoYW5nZURlY29yYXRpb25zKGFjY2Vzc29yID0+IHtcblx0XHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbiBvZiBjYWNoZWQudmFsdWUpIHtcblx0XHRcdFx0aWYgKGRlY29yYXRpb24gaW5zdGFuY2VvZiBSdW5UZXN0RGVjb3JhdGlvbiAmJiBkZWNvcmF0aW9uLmVkaXRvckRlY29yYXRpb24uYWx0ZXJuYXRlKSB7XG5cdFx0XHRcdFx0YWNjZXNzb3IuY2hhbmdlRGVjb3JhdGlvbk9wdGlvbnMoXG5cdFx0XHRcdFx0XHRkZWNvcmF0aW9uLmlkLFxuXHRcdFx0XHRcdFx0aXNBbHQgPyBkZWNvcmF0aW9uLmVkaXRvckRlY29yYXRpb24uYWx0ZXJuYXRlIDogZGVjb3JhdGlvbi5lZGl0b3JEZWNvcmF0aW9uLm9wdGlvbnMsXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFwcGxpZXMgdGhlIGN1cnJlbnQgc2V0IG9mIHRlc3QgZGVjb3JhdGlvbnMgdG8gdGhlIGdpdmVuIHRleHQgbW9kZWwuXG5cdCAqL1xuXHRwcml2YXRlIGFwcGx5RGVjb3JhdGlvbnMobW9kZWw6IElUZXh0TW9kZWwpIHtcblx0XHRjb25zdCBndXR0ZXJFbmFibGVkID0gZ2V0VGVzdGluZ0NvbmZpZ3VyYXRpb24odGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgVGVzdGluZ0NvbmZpZ0tleXMuR3V0dGVyRW5hYmxlZCk7XG5cdFx0Y29uc3QgY2FjaGVkID0gdGhpcy5kZWNvcmF0aW9uQ2FjaGUuZ2V0KG1vZGVsLnVyaSk7XG5cdFx0Y29uc3QgdGVzdFJhbmdlc1VwZGF0ZWQgPSBjYWNoZWQ/LnJhbmdlVXBkYXRlVmVyc2lvbklkID09PSBtb2RlbC5nZXRWZXJzaW9uSWQoKTtcblx0XHRjb25zdCBsYXN0RGVjb3JhdGlvbnMgPSBjYWNoZWQ/LnZhbHVlID8/IG5ldyBDYWNoZWREZWNvcmF0aW9ucygpO1xuXG5cdFx0Y29uc3QgbmV3RGVjb3JhdGlvbnMgPSBtb2RlbC5jaGFuZ2VEZWNvcmF0aW9ucyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRjb25zdCBuZXdEZWNvcmF0aW9ucyA9IG5ldyBDYWNoZWREZWNvcmF0aW9ucygpO1xuXHRcdFx0Y29uc3QgcnVuRGVjb3JhdGlvbnMgPSBuZXcgVGVzdERlY29yYXRpb25zPHsgbGluZTogbnVtYmVyOyBpZDogJyc7IHRlc3Q6IEluY3JlbWVudGFsVGVzdENvbGxlY3Rpb25JdGVtOyByZXN1bHRJdGVtOiBUZXN0UmVzdWx0SXRlbSB8IHVuZGVmaW5lZCB9PigpO1xuXHRcdFx0Zm9yIChjb25zdCB0ZXN0IG9mIHRoaXMudGVzdFNlcnZpY2UuY29sbGVjdGlvbi5nZXROb2RlQnlVcmwobW9kZWwudXJpKSkge1xuXHRcdFx0XHRpZiAoIXRlc3QuaXRlbS5yYW5nZSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgc3RhdGVMb29rdXAgPSB0aGlzLnJlc3VsdHMuZ2V0U3RhdGVCeUlkKHRlc3QuaXRlbS5leHRJZCk7XG5cdFx0XHRcdGNvbnN0IGxpbmUgPSB0ZXN0Lml0ZW0ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0XHRydW5EZWNvcmF0aW9ucy5wdXNoKHsgbGluZSwgaWQ6ICcnLCB0ZXN0LCByZXN1bHRJdGVtOiBzdGF0ZUxvb2t1cD8uWzFdIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IFtsaW5lLCB0ZXN0c10gb2YgcnVuRGVjb3JhdGlvbnMubGluZXMoKSkge1xuXHRcdFx0XHRjb25zdCBtdWx0aSA9IHRlc3RzLmxlbmd0aCA+IDE7XG5cdFx0XHRcdGxldCBleGlzdGluZyA9IGxhc3REZWNvcmF0aW9ucy5nZXRGb3JFeGFjdFRlc3RzKHRlc3RzLm1hcCh0ID0+IHQudGVzdC5pdGVtLmV4dElkKSk7XG5cblx0XHRcdFx0Ly8gc2VlIGNvbW1lbnQgaW4gdGhlIGNvbnN0cnVjdG9yIGZvciB3aGF0J3MgZ29pbmcgb24gaGVyZVxuXHRcdFx0XHRpZiAoZXhpc3RpbmcgJiYgdGVzdFJhbmdlc1VwZGF0ZWQgJiYgbW9kZWwuZ2V0RGVjb3JhdGlvblJhbmdlKGV4aXN0aW5nLmlkKT8uc3RhcnRMaW5lTnVtYmVyICE9PSBsaW5lKSB7XG5cdFx0XHRcdFx0ZXhpc3RpbmcgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoZXhpc3RpbmcpIHtcblx0XHRcdFx0XHRpZiAoZXhpc3RpbmcucmVwbGFjZU9wdGlvbnModGVzdHMsIGd1dHRlckVuYWJsZWQpKSB7XG5cdFx0XHRcdFx0XHRhY2Nlc3Nvci5jaGFuZ2VEZWNvcmF0aW9uT3B0aW9ucyhleGlzdGluZy5pZCwgZXhpc3RpbmcuZWRpdG9yRGVjb3JhdGlvbi5vcHRpb25zKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bmV3RGVjb3JhdGlvbnMuYWRkVGVzdChleGlzdGluZyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bmV3RGVjb3JhdGlvbnMuYWRkVGVzdChtdWx0aVxuXHRcdFx0XHRcdFx0PyB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE11bHRpUnVuVGVzdERlY29yYXRpb24sIHRlc3RzLCBndXR0ZXJFbmFibGVkLCBtb2RlbClcblx0XHRcdFx0XHRcdDogdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSdW5TaW5nbGVUZXN0RGVjb3JhdGlvbiwgdGVzdHNbMF0udGVzdCwgdGVzdHNbMF0ucmVzdWx0SXRlbSwgbW9kZWwsIGd1dHRlckVuYWJsZWQpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzYXZlRnJvbVJlbW92YWwgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbiBvZiBuZXdEZWNvcmF0aW9ucykge1xuXHRcdFx0XHRpZiAoZGVjb3JhdGlvbi5pZCA9PT0gJycpIHtcblx0XHRcdFx0XHRkZWNvcmF0aW9uLmlkID0gYWNjZXNzb3IuYWRkRGVjb3JhdGlvbihkZWNvcmF0aW9uLmVkaXRvckRlY29yYXRpb24ucmFuZ2UsIGRlY29yYXRpb24uZWRpdG9yRGVjb3JhdGlvbi5vcHRpb25zKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzYXZlRnJvbVJlbW92YWwuYWRkKGRlY29yYXRpb24uaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbiBvZiBsYXN0RGVjb3JhdGlvbnMpIHtcblx0XHRcdFx0aWYgKCFzYXZlRnJvbVJlbW92YWwuaGFzKGRlY29yYXRpb24uaWQpKSB7XG5cdFx0XHRcdFx0YWNjZXNzb3IucmVtb3ZlRGVjb3JhdGlvbihkZWNvcmF0aW9uLmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmRlY29yYXRpb25DYWNoZS5zZXQobW9kZWwudXJpLCB7XG5cdFx0XHRcdGdlbmVyYXRpb246IHRoaXMuZ2VuZXJhdGlvbixcblx0XHRcdFx0cmFuZ2VVcGRhdGVWZXJzaW9uSWQ6IGNhY2hlZD8ucmFuZ2VVcGRhdGVWZXJzaW9uSWQsXG5cdFx0XHRcdHZhbHVlOiBuZXdEZWNvcmF0aW9ucyxcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gbmV3RGVjb3JhdGlvbnM7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gbmV3RGVjb3JhdGlvbnMgfHwgbGFzdERlY29yYXRpb25zO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0aW5nRGVjb3JhdGlvbnMgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUVkaXRvckNvbnRyaWJ1dGlvbiB7XG5cdC8qKlxuXHQgKiBSZXN1bHRzIGludmFsaWRhdGVkIGJ5IGVkaXRvciBjaGFuZ2VzLlxuXHQgKi9cblx0cHVibGljIHN0YXRpYyBpbnZhbGlkYXRlZFRlc3RzID0gbmV3IFdlYWtTZXQ8VGVzdFJlc3VsdEl0ZW0gfCBJVGVzdE1lc3NhZ2U+KCk7XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIGRlY29yYXRpb25zIGFzc29jaWF0ZWQgd2l0aCB0aGUgZ2l2ZW4gY29kZSBlZGl0b3IuXG5cdCAqL1xuXHRwdWJsaWMgc3RhdGljIGdldChlZGl0b3I6IElDb2RlRWRpdG9yKTogVGVzdGluZ0RlY29yYXRpb25zIHwgbnVsbCB7XG5cdFx0cmV0dXJuIGVkaXRvci5nZXRDb250cmlidXRpb248VGVzdGluZ0RlY29yYXRpb25zPihUZXN0aW5nLkRlY29yYXRpb25zQ29udHJpYnV0aW9uSWQpO1xuXHR9XG5cblx0cHVibGljIGdldCBjdXJyZW50VXJpKCkgeyByZXR1cm4gdGhpcy5fY3VycmVudFVyaTsgfVxuXG5cdHByaXZhdGUgX2N1cnJlbnRVcmk/OiBVUkk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZXhwZWN0ZWRXaWRnZXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8RXhwZWN0ZWRMZW5zQ29udGVudFdpZGdldD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgYWN0dWFsV2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPEFjdHVhbExlbnNDb250ZW50V2lkZ2V0PigpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGVycm9yQ29udGVudFdpZGdldHMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZU1hcDxJVGVzdE1lc3NhZ2UsIFRlc3RFcnJvckNvbnRlbnRXaWRnZXQ+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGxvZ2dlZE1lc3NhZ2VEZWNvcmF0aW9ucyA9IG5ldyBNYXA8SVRlc3RNZXNzYWdlLCB7XG5cdFx0aWQ6IHN0cmluZztcblx0XHRsaW5lOiBudW1iZXI7XG5cdFx0cmVzdWx0SXRlbTogVGVzdFJlc3VsdEl0ZW0gfCB1bmRlZmluZWQ7XG5cdH0+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJVGVzdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXN0U2VydmljZTogSVRlc3RTZXJ2aWNlLFxuXHRcdEBJVGVzdGluZ0RlY29yYXRpb25zU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRlY29yYXRpb25zOiBJVGVzdGluZ0RlY29yYXRpb25zU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASVRlc3RSZXN1bHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcmVzdWx0czogSVRlc3RSZXN1bHRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Y29kZUVkaXRvclNlcnZpY2UucmVnaXN0ZXJEZWNvcmF0aW9uVHlwZSgndGVzdC1tZXNzYWdlLWRlY29yYXRpb24nLCBUZXN0TWVzc2FnZURlY29yYXRpb24uZGVjb3JhdGlvbklkLCB7fSwgdW5kZWZpbmVkLCBlZGl0b3IpO1xuXG5cdFx0dGhpcy5hdHRhY2hNb2RlbChlZGl0b3IuZ2V0TW9kZWwoKT8udXJpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihkZWNvcmF0aW9ucy5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fY3VycmVudFVyaSkge1xuXHRcdFx0XHRkZWNvcmF0aW9ucy5zeW5jRGVjb3JhdGlvbnModGhpcy5fY3VycmVudFVyaSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuYW55KFxuXHRcdFx0dGhpcy5yZXN1bHRzLm9uUmVzdWx0c0NoYW5nZWQsXG5cdFx0XHRlZGl0b3Iub25EaWRDaGFuZ2VNb2RlbCxcblx0XHRcdEV2ZW50LmZpbHRlcih0aGlzLnJlc3VsdHMub25UZXN0Q2hhbmdlZCwgYyA9PiBjLnJlYXNvbiA9PT0gVGVzdFJlc3VsdEl0ZW1DaGFuZ2VSZWFzb24uTmV3TWVzc2FnZSksXG5cdFx0XHR0aGlzLnRlc3RTZXJ2aWNlLnNob3dJbmxpbmVPdXRwdXQub25EaWRDaGFuZ2UsXG5cdFx0KSgoKSA9PiB0aGlzLmFwcGx5UmVzdWx0cygpKSk7XG5cblx0XHRjb25zdCB3aW4gPSBkb20uZ2V0V2luZG93KGVkaXRvci5nZXREb21Ob2RlKCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIod2luLCAna2V5ZG93bicsIGUgPT4ge1xuXHRcdFx0aWYgKG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSkua2V5Q29kZSA9PT0gS2V5Q29kZS5BbHQgJiYgdGhpcy5fY3VycmVudFVyaSkge1xuXHRcdFx0XHRkZWNvcmF0aW9ucy51cGRhdGVEZWNvcmF0aW9uc0FsdGVybmF0ZUFjdGlvbih0aGlzLl9jdXJyZW50VXJpLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih3aW4sICdrZXl1cCcsIGUgPT4ge1xuXHRcdFx0aWYgKG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSkua2V5Q29kZSA9PT0gS2V5Q29kZS5BbHQgJiYgdGhpcy5fY3VycmVudFVyaSkge1xuXHRcdFx0XHRkZWNvcmF0aW9ucy51cGRhdGVEZWNvcmF0aW9uc0FsdGVybmF0ZUFjdGlvbih0aGlzLl9jdXJyZW50VXJpLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIod2luLCAnYmx1cicsICgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9jdXJyZW50VXJpKSB7XG5cdFx0XHRcdGRlY29yYXRpb25zLnVwZGF0ZURlY29yYXRpb25zQWx0ZXJuYXRlQWN0aW9uKHRoaXMuX2N1cnJlbnRVcmksIGZhbHNlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3Iub25LZXlVcChlID0+IHtcblx0XHRcdGlmIChlLmtleUNvZGUgPT09IEtleUNvZGUuQWx0ICYmIHRoaXMuX2N1cnJlbnRVcmkpIHtcblx0XHRcdFx0ZGVjb3JhdGlvbnMudXBkYXRlRGVjb3JhdGlvbnNBbHRlcm5hdGVBY3Rpb24odGhpcy5fY3VycmVudFVyaSEsIGZhbHNlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbChlID0+IHRoaXMuYXR0YWNoTW9kZWwoZS5uZXdNb2RlbFVybCB8fCB1bmRlZmluZWQpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3Iub25Nb3VzZURvd24oZSA9PiB7XG5cdFx0XHRpZiAoZS50YXJnZXQucG9zaXRpb24gJiYgdGhpcy5jdXJyZW50VXJpKSB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsRGVjb3JhdGlvbnMgPSBlZGl0b3IuZ2V0TW9kZWwoKT8uZ2V0TGluZURlY29yYXRpb25zKGUudGFyZ2V0LnBvc2l0aW9uLmxpbmVOdW1iZXIpID8/IFtdO1xuXHRcdFx0XHRpZiAoIW1vZGVsRGVjb3JhdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgY2FjaGUgPSBkZWNvcmF0aW9ucy5zeW5jRGVjb3JhdGlvbnModGhpcy5jdXJyZW50VXJpKTtcblx0XHRcdFx0Zm9yIChjb25zdCB7IGlkIH0gb2YgbW9kZWxEZWNvcmF0aW9ucykge1xuXHRcdFx0XHRcdGlmICgoY2FjaGUuZ2V0QnlJZChpZCkgYXMgSVRlc3REZWNvcmF0aW9uIHwgdW5kZWZpbmVkKT8uY2xpY2soZSkpIHtcblx0XHRcdFx0XHRcdGUuZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmFjY3VtdWxhdGUodGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQsIDAsIHRoaXMuX3N0b3JlKShldnRzID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0XHRpZiAoIXRoaXMuX2N1cnJlbnRVcmkgfHwgIW1vZGVsKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bGV0IGNoYW5nZWQgPSBmYWxzZTtcblx0XHRcdGZvciAoY29uc3QgW21lc3NhZ2UsIGRlY29dIG9mIHRoaXMubG9nZ2VkTWVzc2FnZURlY29yYXRpb25zKSB7XG5cdFx0XHRcdC8vIGludmFsaWRhdGUgZGVjb3JhdGlvbnMgaWYgZWl0aGVyIHRoZSBsaW5lIHRoZXkncmUgb24gd2FzIGNoYW5nZWQsXG5cdFx0XHRcdC8vIG9yIGlmIHRoZSByYW5nZSBvZiB0aGUgdGVzdCB3YXMgY2hhbmdlZC4gVGhlIHJhbmdlIG9mIHRoZSB0ZXN0IGlzXG5cdFx0XHRcdC8vIG5vdCBhbHdheXMgcHJlc2VudCwgc28gY2hlY2sgYm8uXG5cdFx0XHRcdGNvbnN0IGludmFsaWRhdGUgPSBldnRzLnNvbWUoZSA9PiBlLmNoYW5nZXMuc29tZShjID0+XG5cdFx0XHRcdFx0Yy5yYW5nZS5zdGFydExpbmVOdW1iZXIgPD0gZGVjby5saW5lICYmIGMucmFuZ2UuZW5kTGluZU51bWJlciA+PSBkZWNvLmxpbmVcblx0XHRcdFx0XHR8fCAoZGVjby5yZXN1bHRJdGVtPy5pdGVtLnJhbmdlICYmIGRlY28ucmVzdWx0SXRlbS5pdGVtLnJhbmdlLnN0YXJ0TGluZU51bWJlciA8PSBjLnJhbmdlLnN0YXJ0TGluZU51bWJlciAmJiBkZWNvLnJlc3VsdEl0ZW0uaXRlbS5yYW5nZS5lbmRMaW5lTnVtYmVyID49IGMucmFuZ2UuZW5kTGluZU51bWJlcilcblx0XHRcdFx0KSk7XG5cblx0XHRcdFx0aWYgKGludmFsaWRhdGUpIHtcblx0XHRcdFx0XHRjaGFuZ2VkID0gdHJ1ZTtcblx0XHRcdFx0XHRUZXN0aW5nRGVjb3JhdGlvbnMuaW52YWxpZGF0ZWRUZXN0cy5hZGQoZGVjby5yZXN1bHRJdGVtIHx8IG1lc3NhZ2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjaGFuZ2VkKSB7XG5cdFx0XHRcdHRoaXMuYXBwbHlSZXN1bHRzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgdXBkYXRlRm9udEZhbWlseVZhciA9ICgpID0+IHtcblx0XHRcdHRoaXMuZWRpdG9yLmdldENvbnRhaW5lckRvbU5vZGUoKS5zdHlsZS5zZXRQcm9wZXJ0eSgnLS10ZXN0TWVzc2FnZURlY29yYXRpb25Gb250RmFtaWx5JywgZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZm9udEZhbWlseSkpO1xuXHRcdFx0dGhpcy5lZGl0b3IuZ2V0Q29udGFpbmVyRG9tTm9kZSgpLnN0eWxlLnNldFByb3BlcnR5KCctLXRlc3RNZXNzYWdlRGVjb3JhdGlvbkZvbnRTaXplJywgYCR7ZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZm9udFNpemUpfXB4YCk7XG5cdFx0fTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oKGUpID0+IHtcblx0XHRcdGlmIChlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLmZvbnRGYW1pbHkpKSB7XG5cdFx0XHRcdHVwZGF0ZUZvbnRGYW1pbHlWYXIoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dXBkYXRlRm9udEZhbWlseVZhcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBhdHRhY2hNb2RlbCh1cmk/OiBVUkkpIHtcblx0XHRzd2l0Y2ggKHVyaSAmJiBwYXJzZVRlc3RVcmkodXJpKT8udHlwZSkge1xuXHRcdFx0Y2FzZSBUZXN0VXJpVHlwZS5SZXN1bHRFeHBlY3RlZE91dHB1dDpcblx0XHRcdFx0dGhpcy5leHBlY3RlZFdpZGdldC52YWx1ZSA9IG5ldyBFeHBlY3RlZExlbnNDb250ZW50V2lkZ2V0KHRoaXMuZWRpdG9yKTtcblx0XHRcdFx0dGhpcy5hY3R1YWxXaWRnZXQuY2xlYXIoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFRlc3RVcmlUeXBlLlJlc3VsdEFjdHVhbE91dHB1dDpcblx0XHRcdFx0dGhpcy5leHBlY3RlZFdpZGdldC5jbGVhcigpO1xuXHRcdFx0XHR0aGlzLmFjdHVhbFdpZGdldC52YWx1ZSA9IG5ldyBBY3R1YWxMZW5zQ29udGVudFdpZGdldCh0aGlzLmVkaXRvcik7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhpcy5leHBlY3RlZFdpZGdldC5jbGVhcigpO1xuXHRcdFx0XHR0aGlzLmFjdHVhbFdpZGdldC5jbGVhcigpO1xuXHRcdH1cblxuXHRcdGlmIChpc09yaWdpbmFsSW5EaWZmRWRpdG9yKHRoaXMuY29kZUVkaXRvclNlcnZpY2UsIHRoaXMuZWRpdG9yKSkge1xuXHRcdFx0dXJpID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHRoaXMuX2N1cnJlbnRVcmkgPSB1cmk7XG5cblx0XHRpZiAoIXVyaSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuZGVjb3JhdGlvbnMuc3luY0RlY29yYXRpb25zKHVyaSk7XG5cblx0XHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0Zm9yIGF3YWl0IChjb25zdCBfdGVzdCBvZiB0ZXN0c0luRmlsZSh0aGlzLnRlc3RTZXJ2aWNlLCB0aGlzLnVyaUlkZW50aXR5U2VydmljZSwgdXJpLCBmYWxzZSkpIHtcblx0XHRcdFx0Ly8gY29uc3VtZSB0aGUgaXRlcmF0b3Igc28gdGhhdCBhbGwgdGVzdHMgaW4gdGhlIGZpbGUgZ2V0IGV4cGFuZGVkLiBPclxuXHRcdFx0XHQvLyBhdCBsZWFzdCB1bnRpbCB0aGUgVVJJIGNoYW5nZXMuIElmIG5ldyBpdGVtcyBhcmUgcmVxdWVzdGVkLCBjaGFuZ2VzXG5cdFx0XHRcdC8vIHdpbGwgYmUgdHJpZ2dlZCBpbiB0aGUgYG9uRGlkUHJvY2Vzc0RpZmZgIGNhbGxiYWNrLlxuXHRcdFx0XHRpZiAodGhpcy5fY3VycmVudFVyaSAhPT0gdXJpKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhcHBseVJlc3VsdHMoKSB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHJldHVybiB0aGlzLmNsZWFyUmVzdWx0cygpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVyaVN0ciA9IG1vZGVsLnVyaS50b1N0cmluZygpO1xuXHRcdGNvbnN0IHNlZW5MaW5lcyA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuXHRcdHRoaXMuYXBwbHlSZXN1bHRzQ29udGVudFdpZGdldHModXJpU3RyLCBzZWVuTGluZXMpO1xuXHRcdHRoaXMuYXBwbHlSZXN1bHRzTG9nZ2VkTWVzc2FnZXModXJpU3RyLCBzZWVuTGluZXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhclJlc3VsdHMoKSB7XG5cdFx0dGhpcy5lcnJvckNvbnRlbnRXaWRnZXRzLmNsZWFyQW5kRGlzcG9zZUFsbCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc01lc3NhZ2VJbnZhbGlkYXRlZChtZXNzYWdlOiBJVGVzdE1lc3NhZ2UpIHtcblx0XHRyZXR1cm4gVGVzdGluZ0RlY29yYXRpb25zLmludmFsaWRhdGVkVGVzdHMuaGFzKG1lc3NhZ2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBhcHBseVJlc3VsdHNDb250ZW50V2lkZ2V0cyh1cmlTdHI6IHN0cmluZywgc2VlbkxpbmVzOiBTZXQ8bnVtYmVyPikge1xuXHRcdGNvbnN0IHNlZW4gPSBuZXcgU2V0PElUZXN0TWVzc2FnZT4oKTtcblx0XHRpZiAoZ2V0VGVzdGluZ0NvbmZpZ3VyYXRpb24odGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgVGVzdGluZ0NvbmZpZ0tleXMuU2hvd0FsbE1lc3NhZ2VzKSkge1xuXHRcdFx0dGhpcy5yZXN1bHRzLnJlc3VsdHMuZm9yRWFjaChsYXN0UmVzdWx0ID0+IHRoaXMuYXBwbHlDb250ZW50V2lkZ2V0c0Zyb21SZXN1bHQobGFzdFJlc3VsdCwgdXJpU3RyLCBzZWVuLCBzZWVuTGluZXMpKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMucmVzdWx0cy5yZXN1bHRzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5hcHBseUNvbnRlbnRXaWRnZXRzRnJvbVJlc3VsdCh0aGlzLnJlc3VsdHMucmVzdWx0c1swXSwgdXJpU3RyLCBzZWVuLCBzZWVuTGluZXMpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgbWVzc2FnZSBvZiB0aGlzLmVycm9yQ29udGVudFdpZGdldHMua2V5cygpKSB7XG5cdFx0XHRpZiAoIXNlZW4uaGFzKG1lc3NhZ2UpKSB7XG5cdFx0XHRcdHRoaXMuZXJyb3JDb250ZW50V2lkZ2V0cy5kZWxldGVBbmREaXNwb3NlKG1lc3NhZ2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXBwbHlDb250ZW50V2lkZ2V0c0Zyb21SZXN1bHQobGFzdFJlc3VsdDogSVRlc3RSZXN1bHQsIHVyaVN0cjogc3RyaW5nLCBzZWVuOiBTZXQ8SVRlc3RNZXNzYWdlPiwgc2VlbkxpbmVzOiBTZXQ8bnVtYmVyPikge1xuXHRcdGZvciAoY29uc3QgdGVzdCBvZiBsYXN0UmVzdWx0LnRlc3RzKSB7XG5cdFx0XHRpZiAoVGVzdGluZ0RlY29yYXRpb25zLmludmFsaWRhdGVkVGVzdHMuaGFzKHRlc3QpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChsZXQgdGFza0lkID0gMDsgdGFza0lkIDwgdGVzdC50YXNrcy5sZW5ndGg7IHRhc2tJZCsrKSB7XG5cdFx0XHRcdGNvbnN0IHN0YXRlID0gdGVzdC50YXNrc1t0YXNrSWRdO1xuXHRcdFx0XHQvLyBwdXNoIGVycm9yIGRlY29yYXRpb25zIGZpcnN0IHNvIHRoZXkgdGFrZSBwcmVjZWRlbmNlIG92ZXIgbm9ybWFsIG91dHB1dFxuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRlLm1lc3NhZ2VzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0Y29uc3QgbSA9IHN0YXRlLm1lc3NhZ2VzW2ldO1xuXHRcdFx0XHRcdGlmIChtLnR5cGUgIT09IFRlc3RNZXNzYWdlVHlwZS5FcnJvciB8fCB0aGlzLmlzTWVzc2FnZUludmFsaWRhdGVkKG0pKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBsaW5lOiBudW1iZXIgfCB1bmRlZmluZWQgPSBtLmxvY2F0aW9uPy51cmkudG9TdHJpbmcoKSA9PT0gdXJpU3RyXG5cdFx0XHRcdFx0XHQ/IG0ubG9jYXRpb24ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyXG5cdFx0XHRcdFx0XHQ6IG0uc3RhY2tUcmFjZSAmJiBtYXBGaW5kRmlyc3QobS5zdGFja1RyYWNlLCAoZikgPT4gZi5wb3NpdGlvbiAmJiBmLnVyaT8udG9TdHJpbmcoKSA9PT0gdXJpU3RyID8gZi5wb3NpdGlvbi5saW5lTnVtYmVyIDogdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRpZiAobGluZSA9PT0gdW5kZWZpbmVkIHx8IHNlZW5MaW5lcy5oYXMobGluZSkpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHNlZW5MaW5lcy5hZGQobGluZSk7XG5cdFx0XHRcdFx0bGV0IGRlY28gPSB0aGlzLmVycm9yQ29udGVudFdpZGdldHMuZ2V0KG0pO1xuXHRcdFx0XHRcdGlmICghZGVjbykge1xuXHRcdFx0XHRcdFx0Y29uc3QgbGluZUxlbmd0aCA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCk/LmdldExpbmVMZW5ndGgobGluZSkgPz8gMTAwO1xuXHRcdFx0XHRcdFx0ZGVjbyA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRcdFx0XHRcdFRlc3RFcnJvckNvbnRlbnRXaWRnZXQsXG5cdFx0XHRcdFx0XHRcdHRoaXMuZWRpdG9yLFxuXHRcdFx0XHRcdFx0XHRuZXcgUG9zaXRpb24obGluZSwgbGluZUxlbmd0aCArIDEpLFxuXHRcdFx0XHRcdFx0XHRtLFxuXHRcdFx0XHRcdFx0XHR0ZXN0LFxuXHRcdFx0XHRcdFx0XHRidWlsZFRlc3RVcmkoe1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6IFRlc3RVcmlUeXBlLlJlc3VsdEFjdHVhbE91dHB1dCxcblx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlSW5kZXg6IGksXG5cdFx0XHRcdFx0XHRcdFx0dGFza0luZGV4OiB0YXNrSWQsXG5cdFx0XHRcdFx0XHRcdFx0cmVzdWx0SWQ6IGxhc3RSZXN1bHQuaWQsXG5cdFx0XHRcdFx0XHRcdFx0dGVzdEV4dElkOiB0ZXN0Lml0ZW0uZXh0SWQsXG5cdFx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0dGhpcy5lcnJvckNvbnRlbnRXaWRnZXRzLnNldChtLCBkZWNvKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c2Vlbi5hZGQobSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFwcGx5UmVzdWx0c0xvZ2dlZE1lc3NhZ2VzKHVyaVN0cjogc3RyaW5nLCBtZXNzYWdlTGluZXM6IFNldDxudW1iZXI+KSB7XG5cdFx0dGhpcy5lZGl0b3IuY2hhbmdlRGVjb3JhdGlvbnMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0Y29uc3Qgc2VlbiA9IG5ldyBTZXQ8SVRlc3RNZXNzYWdlPigpO1xuXHRcdFx0aWYgKGdldFRlc3RpbmdDb25maWd1cmF0aW9uKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIFRlc3RpbmdDb25maWdLZXlzLlNob3dBbGxNZXNzYWdlcykpIHtcblx0XHRcdFx0dGhpcy5yZXN1bHRzLnJlc3VsdHMuZm9yRWFjaChyID0+IHRoaXMuYXBwbHlMb2dnZWRNZXNzYWdlRnJvbVJlc3VsdChyLCB1cmlTdHIsIHNlZW4sIG1lc3NhZ2VMaW5lcywgYWNjZXNzb3IpKTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5yZXN1bHRzLnJlc3VsdHMubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMuYXBwbHlMb2dnZWRNZXNzYWdlRnJvbVJlc3VsdCh0aGlzLnJlc3VsdHMucmVzdWx0c1swXSwgdXJpU3RyLCBzZWVuLCBtZXNzYWdlTGluZXMsIGFjY2Vzc29yKTtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBbbWVzc2FnZSwgeyBpZCB9XSBvZiB0aGlzLmxvZ2dlZE1lc3NhZ2VEZWNvcmF0aW9ucykge1xuXHRcdFx0XHRpZiAoIXNlZW4uaGFzKG1lc3NhZ2UpKSB7XG5cdFx0XHRcdFx0YWNjZXNzb3IucmVtb3ZlRGVjb3JhdGlvbihpZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXBwbHlMb2dnZWRNZXNzYWdlRnJvbVJlc3VsdChsYXN0UmVzdWx0OiBJVGVzdFJlc3VsdCwgdXJpU3RyOiBzdHJpbmcsIHNlZW46IFNldDxJVGVzdE1lc3NhZ2U+LCBtZXNzYWdlTGluZXM6IFNldDxudW1iZXI+LCBhY2Nlc3NvcjogSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3Nvcikge1xuXHRcdGlmICghdGhpcy50ZXN0U2VydmljZS5zaG93SW5saW5lT3V0cHV0LnZhbHVlIHx8ICEobGFzdFJlc3VsdCBpbnN0YW5jZW9mIExpdmVUZXN0UmVzdWx0KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRyeUFkZCA9IChyZXN1bHRJdGVtOiBUZXN0UmVzdWx0SXRlbSB8IHVuZGVmaW5lZCwgbTogSVRlc3RNZXNzYWdlLCB1cmk/OiBVUkkpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzTWVzc2FnZUludmFsaWRhdGVkKG0pIHx8IG0ubG9jYXRpb24/LnVyaS50b1N0cmluZygpICE9PSB1cmlTdHIpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzZWVuLmFkZChtKTtcblx0XHRcdGNvbnN0IGxpbmUgPSBtLmxvY2F0aW9uLnJhbmdlLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdGlmIChtZXNzYWdlTGluZXMuaGFzKGxpbmUpIHx8IHRoaXMubG9nZ2VkTWVzc2FnZURlY29yYXRpb25zLmhhcyhtKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGRlY28gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RNZXNzYWdlRGVjb3JhdGlvbiwgbSwgdXJpLCB0aGlzLmVkaXRvci5nZXRNb2RlbCgpISk7XG5cblx0XHRcdG1lc3NhZ2VMaW5lcy5hZGQobGluZSk7XG5cdFx0XHRjb25zdCBpZCA9IGFjY2Vzc29yLmFkZERlY29yYXRpb24oXG5cdFx0XHRcdGRlY28uZWRpdG9yRGVjb3JhdGlvbi5yYW5nZSxcblx0XHRcdFx0ZGVjby5lZGl0b3JEZWNvcmF0aW9uLm9wdGlvbnMsXG5cdFx0XHQpO1xuXHRcdFx0dGhpcy5sb2dnZWRNZXNzYWdlRGVjb3JhdGlvbnMuc2V0KG0sIHsgaWQsIGxpbmUsIHJlc3VsdEl0ZW0gfSk7XG5cdFx0fTtcblxuXHRcdGZvciAoY29uc3QgdGVzdCBvZiBsYXN0UmVzdWx0LnRlc3RzKSB7XG5cdFx0XHRpZiAoVGVzdGluZ0RlY29yYXRpb25zLmludmFsaWRhdGVkVGVzdHMuaGFzKHRlc3QpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGxldCB0YXNrSWQgPSAwOyB0YXNrSWQgPCB0ZXN0LnRhc2tzLmxlbmd0aDsgdGFza0lkKyspIHtcblx0XHRcdFx0Y29uc3Qgc3RhdGUgPSB0ZXN0LnRhc2tzW3Rhc2tJZF07XG5cdFx0XHRcdGZvciAobGV0IGkgPSBzdGF0ZS5tZXNzYWdlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0XHRcdGNvbnN0IG0gPSBzdGF0ZS5tZXNzYWdlc1tpXTtcblx0XHRcdFx0XHRpZiAobS50eXBlID09PSBUZXN0TWVzc2FnZVR5cGUuT3V0cHV0KSB7XG5cdFx0XHRcdFx0XHR0cnlBZGQodGVzdCwgbSwgYnVpbGRUZXN0VXJpKHtcblx0XHRcdFx0XHRcdFx0dHlwZTogVGVzdFVyaVR5cGUuUmVzdWx0QWN0dWFsT3V0cHV0LFxuXHRcdFx0XHRcdFx0XHRtZXNzYWdlSW5kZXg6IGksXG5cdFx0XHRcdFx0XHRcdHRhc2tJbmRleDogdGFza0lkLFxuXHRcdFx0XHRcdFx0XHRyZXN1bHRJZDogbGFzdFJlc3VsdC5pZCxcblx0XHRcdFx0XHRcdFx0dGVzdEV4dElkOiB0ZXN0Lml0ZW0uZXh0SWQsXG5cdFx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCB0YXNrIG9mIGxhc3RSZXN1bHQudGFza3MpIHtcblx0XHRcdGZvciAoY29uc3QgbSBvZiB0YXNrLm90aGVyTWVzc2FnZXMpIHtcblx0XHRcdFx0dHJ5QWRkKHVuZGVmaW5lZCwgbSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmNvbnN0IGNvbGxhcHNlUmFuZ2UgPSAob3JpZ2luYWxSYW5nZTogSVJhbmdlKSA9PiAoe1xuXHRzdGFydExpbmVOdW1iZXI6IG9yaWdpbmFsUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLFxuXHRlbmRMaW5lTnVtYmVyOiBvcmlnaW5hbFJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0c3RhcnRDb2x1bW46IG9yaWdpbmFsUmFuZ2Uuc3RhcnRDb2x1bW4sXG5cdGVuZENvbHVtbjogb3JpZ2luYWxSYW5nZS5zdGFydENvbHVtbixcbn0pO1xuXG5jb25zdCBjcmVhdGVSdW5UZXN0RGVjb3JhdGlvbiA9IChcblx0dGVzdHM6IHJlYWRvbmx5IEluY3JlbWVudGFsVGVzdENvbGxlY3Rpb25JdGVtW10sXG5cdHN0YXRlczogcmVhZG9ubHkgKFRlc3RSZXN1bHRJdGVtIHwgdW5kZWZpbmVkKVtdLFxuXHR2aXNpYmxlOiBib29sZWFuLFxuXHRkZWZhdWx0R3V0dGVyQWN0aW9uOiBEZWZhdWx0R3V0dGVyQ2xpY2tBY3Rpb24sXG4pOiBJTW9kZWxEZWx0YURlY29yYXRpb24gJiB7IGFsdGVybmF0ZT86IElNb2RlbERlY29yYXRpb25PcHRpb25zIH0gPT4ge1xuXHRjb25zdCByYW5nZSA9IHRlc3RzWzBdPy5pdGVtLnJhbmdlO1xuXHRpZiAoIXJhbmdlKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdUZXN0IGRlY29yYXRpb25zIGNhbiBvbmx5IGJlIGNyZWF0ZWQgZm9yIHRlc3RzIHdpdGggYSByYW5nZScpO1xuXHR9XG5cblx0aWYgKCF2aXNpYmxlKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJhbmdlOiBjb2xsYXBzZVJhbmdlKHJhbmdlKSxcblx0XHRcdG9wdGlvbnM6IHsgaXNXaG9sZUxpbmU6IHRydWUsIGRlc2NyaXB0aW9uOiAncnVuLXRlc3QtZGVjb3JhdGlvbicgfSxcblx0XHR9O1xuXHR9XG5cblx0bGV0IGNvbXB1dGVkU3RhdGUgPSBUZXN0UmVzdWx0U3RhdGUuVW5zZXQ7XG5cdGNvbnN0IGhvdmVyTWVzc2FnZVBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuXHRsZXQgdGVzdElkV2l0aE1lc3NhZ2VzOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGxldCByZXRpcmVkID0gZmFsc2U7XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgdGVzdHMubGVuZ3RoOyBpKyspIHtcblx0XHRjb25zdCB0ZXN0ID0gdGVzdHNbaV07XG5cdFx0Y29uc3QgcmVzdWx0SXRlbSA9IHN0YXRlc1tpXTtcblx0XHRjb25zdCBzdGF0ZSA9IHJlc3VsdEl0ZW0/LmNvbXB1dGVkU3RhdGUgPz8gVGVzdFJlc3VsdFN0YXRlLlVuc2V0O1xuXHRcdGlmIChob3Zlck1lc3NhZ2VQYXJ0cy5sZW5ndGggPCAxMCkge1xuXHRcdFx0aG92ZXJNZXNzYWdlUGFydHMucHVzaChsYWJlbEZvclRlc3RJblN0YXRlKHRlc3QuaXRlbS5sYWJlbCwgc3RhdGUpKTtcblx0XHR9XG5cdFx0Y29tcHV0ZWRTdGF0ZSA9IG1heFByaW9yaXR5KGNvbXB1dGVkU3RhdGUsIHN0YXRlKTtcblx0XHRyZXRpcmVkID0gcmV0aXJlZCB8fCAhIXJlc3VsdEl0ZW0/LnJldGlyZWQ7XG5cdFx0aWYgKCF0ZXN0SWRXaXRoTWVzc2FnZXMgJiYgcmVzdWx0SXRlbT8udGFza3Muc29tZSh0ID0+IHQubWVzc2FnZXMubGVuZ3RoKSkge1xuXHRcdFx0dGVzdElkV2l0aE1lc3NhZ2VzID0gdGVzdC5pdGVtLmV4dElkO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IGhhc011bHRpcGxlVGVzdHMgPSB0ZXN0cy5sZW5ndGggPiAxIHx8IHRlc3RzWzBdLmNoaWxkcmVuLnNpemUgPiAwO1xuXG5cdGNvbnN0IHByaW1hcnlJY29uID0gY29tcHV0ZWRTdGF0ZSA9PT0gVGVzdFJlc3VsdFN0YXRlLlVuc2V0XG5cdFx0PyAoaGFzTXVsdGlwbGVUZXN0cyA/IHRlc3RpbmdSdW5BbGxJY29uIDogdGVzdGluZ1J1bkljb24pXG5cdFx0OiB0ZXN0aW5nU3RhdGVzVG9JY29ucy5nZXQoY29tcHV0ZWRTdGF0ZSkhO1xuXG5cdGNvbnN0IGFsdGVybmF0ZUljb24gPSBkZWZhdWx0R3V0dGVyQWN0aW9uID09PSBEZWZhdWx0R3V0dGVyQ2xpY2tBY3Rpb24uRGVidWdcblx0XHQ/IChoYXNNdWx0aXBsZVRlc3RzID8gdGVzdGluZ1J1bkFsbEljb24gOiB0ZXN0aW5nUnVuSWNvbilcblx0XHQ6IChoYXNNdWx0aXBsZVRlc3RzID8gdGVzdGluZ0RlYnVnQWxsSWNvbiA6IHRlc3RpbmdEZWJ1Z0ljb24pO1xuXG5cdGxldCBob3Zlck1lc3NhZ2U6IElNYXJrZG93blN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRsZXQgZ2x5cGhNYXJnaW5DbGFzc05hbWUgPSAndGVzdGluZy1ydW4tZ2x5cGgnO1xuXHRpZiAocmV0aXJlZCkge1xuXHRcdGdseXBoTWFyZ2luQ2xhc3NOYW1lICs9ICcgcmV0aXJlZCc7XG5cdH1cblxuXHRjb25zdCBkZWZhdWx0T3B0aW9uczogSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMgPSB7XG5cdFx0ZGVzY3JpcHRpb246ICdydW4tdGVzdC1kZWNvcmF0aW9uJyxcblx0XHRzaG93SWZDb2xsYXBzZWQ6IHRydWUsXG5cdFx0Z2V0IGhvdmVyTWVzc2FnZSgpIHtcblx0XHRcdGlmICghaG92ZXJNZXNzYWdlKSB7XG5cdFx0XHRcdGNvbnN0IGJ1aWxkaW5nID0gaG92ZXJNZXNzYWdlID0gbmV3IE1hcmtkb3duU3RyaW5nKCcnLCB0cnVlKS5hcHBlbmRUZXh0KGhvdmVyTWVzc2FnZVBhcnRzLmpvaW4oJywgJykgKyAnLicpO1xuXHRcdFx0XHRpZiAodGVzdElkV2l0aE1lc3NhZ2VzKSB7XG5cdFx0XHRcdFx0Y29uc3QgYXJncyA9IGVuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShbdGVzdElkV2l0aE1lc3NhZ2VzXSkpO1xuXHRcdFx0XHRcdGJ1aWxkaW5nLmFwcGVuZE1hcmtkb3duKGAgWyR7bG9jYWxpemUoJ3BlZWtUZXN0T3V0b3V0JywgJ1BlZWsgVGVzdCBPdXRwdXQnKX1dKGNvbW1hbmQ6dnNjb2RlLnBlZWtUZXN0RXJyb3I/JHthcmdzfSlgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gaG92ZXJNZXNzYWdlO1xuXHRcdH0sXG5cdFx0Z2x5cGhNYXJnaW46IHsgcG9zaXRpb246IEdMWVBIX01BUkdJTl9MQU5FIH0sXG5cdFx0Z2x5cGhNYXJnaW5DbGFzc05hbWU6IGAke1RoZW1lSWNvbi5hc0NsYXNzTmFtZShwcmltYXJ5SWNvbil9ICR7Z2x5cGhNYXJnaW5DbGFzc05hbWV9YCxcblx0XHRzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcyxcblx0XHR6SW5kZXg6IDEwMDAwLFxuXHR9O1xuXG5cdGNvbnN0IGFsdGVybmF0ZU9wdGlvbnM6IElNb2RlbERlY29yYXRpb25PcHRpb25zID0ge1xuXHRcdC4uLmRlZmF1bHRPcHRpb25zLFxuXHRcdGdseXBoTWFyZ2luQ2xhc3NOYW1lOiBgJHtUaGVtZUljb24uYXNDbGFzc05hbWUoYWx0ZXJuYXRlSWNvbil9ICR7Z2x5cGhNYXJnaW5DbGFzc05hbWV9YCxcblx0fTtcblxuXHRyZXR1cm4ge1xuXHRcdHJhbmdlOiBjb2xsYXBzZVJhbmdlKHJhbmdlKSxcblx0XHRvcHRpb25zOiBkZWZhdWx0T3B0aW9ucyxcblx0XHRhbHRlcm5hdGU6IGFsdGVybmF0ZU9wdGlvbnMsXG5cdH07XG59O1xuXG5jb25zdCBlbnVtIExlbnNDb250ZW50V2lkZ2V0VmFycyB7XG5cdEZvbnRGYW1pbHkgPSAndGVzdGluZ0RpZmZMZW5zRm9udEZhbWlseScsXG5cdEZvbnRGZWF0dXJlcyA9ICd0ZXN0aW5nRGlmZkxlbnNGb250RmVhdHVyZXMnLFxufVxuXG5hYnN0cmFjdCBjbGFzcyBUaXRsZUxlbnNDb250ZW50V2lkZ2V0IHtcblx0LyoqIEBpbmhlcml0ZG9jICovXG5cdHB1YmxpYyByZWFkb25seSBhbGxvd0VkaXRvck92ZXJmbG93ID0gZmFsc2U7XG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgc3VwcHJlc3NNb3VzZURvd24gPSB0cnVlO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RvbU5vZGUgPSBkb20uJCgnc3BhbicpO1xuXHRwcml2YXRlIHZpZXdab25lSWQ/OiBzdHJpbmc7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBlZGl0b3I6IElDb2RlRWRpdG9yKSB7XG5cdFx0cXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuXHRcdFx0dGhpcy5hcHBseVN0eWxpbmcoKTtcblx0XHRcdHRoaXMuZWRpdG9yLmFkZENvbnRlbnRXaWRnZXQodGhpcyk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFwcGx5U3R5bGluZygpIHtcblx0XHRsZXQgZm9udFNpemUgPSB0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmNvZGVMZW5zRm9udFNpemUpO1xuXHRcdGxldCBoZWlnaHQ6IG51bWJlcjtcblx0XHRpZiAoIWZvbnRTaXplIHx8IGZvbnRTaXplIDwgNSkge1xuXHRcdFx0Zm9udFNpemUgPSAodGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250U2l6ZSkgKiAuOSkgfCAwO1xuXHRcdFx0aGVpZ2h0ID0gdGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aGVpZ2h0ID0gKGZvbnRTaXplICogTWF0aC5tYXgoMS4zLCB0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpIC8gdGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250U2l6ZSkpKSB8IDA7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdG9yRm9udEluZm8gPSB0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZvbnRJbmZvKTtcblx0XHRjb25zdCBub2RlID0gdGhpcy5fZG9tTm9kZTtcblx0XHRub2RlLmNsYXNzTGlzdC5hZGQoJ3Rlc3RpbmctZGlmZi1sZW5zLXdpZGdldCcpO1xuXHRcdG5vZGUudGV4dENvbnRlbnQgPSB0aGlzLmdldFRleHQoKTtcblx0XHRub2RlLnN0eWxlLmxpbmVIZWlnaHQgPSBgJHtoZWlnaHR9cHhgO1xuXHRcdG5vZGUuc3R5bGUuZm9udFNpemUgPSBgJHtmb250U2l6ZX1weGA7XG5cdFx0bm9kZS5zdHlsZS5mb250RmFtaWx5ID0gYHZhcigtLSR7TGVuc0NvbnRlbnRXaWRnZXRWYXJzLkZvbnRGYW1pbHl9KWA7XG5cdFx0bm9kZS5zdHlsZS5mb250RmVhdHVyZVNldHRpbmdzID0gYHZhcigtLSR7TGVuc0NvbnRlbnRXaWRnZXRWYXJzLkZvbnRGZWF0dXJlc30pYDtcblxuXHRcdGNvbnN0IGNvbnRhaW5lclN0eWxlID0gdGhpcy5lZGl0b3IuZ2V0Q29udGFpbmVyRG9tTm9kZSgpLnN0eWxlO1xuXHRcdGNvbnRhaW5lclN0eWxlLnNldFByb3BlcnR5KExlbnNDb250ZW50V2lkZ2V0VmFycy5Gb250RmFtaWx5LCB0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmNvZGVMZW5zRm9udEZhbWlseSkgPz8gJ2luaGVyaXQnKTtcblx0XHRjb250YWluZXJTdHlsZS5zZXRQcm9wZXJ0eShMZW5zQ29udGVudFdpZGdldFZhcnMuRm9udEZlYXR1cmVzLCBlZGl0b3JGb250SW5mby5mb250RmVhdHVyZVNldHRpbmdzKTtcblxuXHRcdHRoaXMuZWRpdG9yLmNoYW5nZVZpZXdab25lcyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRpZiAodGhpcy52aWV3Wm9uZUlkKSB7XG5cdFx0XHRcdGFjY2Vzc29yLnJlbW92ZVpvbmUodGhpcy52aWV3Wm9uZUlkKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy52aWV3Wm9uZUlkID0gYWNjZXNzb3IuYWRkWm9uZSh7XG5cdFx0XHRcdGFmdGVyTGluZU51bWJlcjogMCxcblx0XHRcdFx0YWZ0ZXJDb2x1bW46IENvbnN0YW50cy5NQVhfU0FGRV9TTUFMTF9JTlRFR0VSLFxuXHRcdFx0XHRkb21Ob2RlOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcblx0XHRcdFx0aGVpZ2h0SW5QeDogMjAsXG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgYWJzdHJhY3QgZ2V0SWQoKTogc3RyaW5nO1xuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgZ2V0RG9tTm9kZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fZG9tTm9kZTtcblx0fVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgZGlzcG9zZSgpIHtcblx0XHR0aGlzLmVkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0aWYgKHRoaXMudmlld1pvbmVJZCkge1xuXHRcdFx0XHRhY2Nlc3Nvci5yZW1vdmVab25lKHRoaXMudmlld1pvbmVJZCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLmVkaXRvci5yZW1vdmVDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHR9XG5cblx0LyoqIEBpbmhlcml0ZG9jICovXG5cdHB1YmxpYyBnZXRQb3NpdGlvbigpOiBJQ29udGVudFdpZGdldFBvc2l0aW9uIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cG9zaXRpb246IHsgY29sdW1uOiAwLCBsaW5lTnVtYmVyOiAwIH0sXG5cdFx0XHRwcmVmZXJlbmNlOiBbQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5BQk9WRV0sXG5cdFx0fTtcblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBnZXRUZXh0KCk6IHN0cmluZztcbn1cblxuY2xhc3MgRXhwZWN0ZWRMZW5zQ29udGVudFdpZGdldCBleHRlbmRzIFRpdGxlTGVuc0NvbnRlbnRXaWRnZXQge1xuXHRwdWJsaWMgZ2V0SWQoKSB7XG5cdFx0cmV0dXJuICdleHBlY3RlZFRlc3RpbmdMZW5zJztcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBnZXRUZXh0KCkge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgnZXhwZWN0ZWQudGl0bGUnLCAnRXhwZWN0ZWQnKTtcblx0fVxufVxuXG5cbmNsYXNzIEFjdHVhbExlbnNDb250ZW50V2lkZ2V0IGV4dGVuZHMgVGl0bGVMZW5zQ29udGVudFdpZGdldCB7XG5cdHB1YmxpYyBnZXRJZCgpIHtcblx0XHRyZXR1cm4gJ2FjdHVhbFRlc3RpbmdMZW5zJztcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBnZXRUZXh0KCkge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgnYWN0dWFsLnRpdGxlJywgJ0FjdHVhbCcpO1xuXHR9XG59XG5cbmFic3RyYWN0IGNsYXNzIFJ1blRlc3REZWNvcmF0aW9uIHtcblx0LyoqIEBpbmhlcml0ZG9jICovXG5cdHB1YmxpYyBpZCA9ICcnO1xuXG5cdHB1YmxpYyBnZXQgbGluZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5lZGl0b3JEZWNvcmF0aW9uLnJhbmdlLnN0YXJ0TGluZU51bWJlcjtcblx0fVxuXG5cdHB1YmxpYyBnZXQgdGVzdElkcygpIHtcblx0XHRyZXR1cm4gdGhpcy50ZXN0cy5tYXAodCA9PiB0LnRlc3QuaXRlbS5leHRJZCk7XG5cdH1cblxuXHRwdWJsaWMgZWRpdG9yRGVjb3JhdGlvbjogSU1vZGVsRGVsdGFEZWNvcmF0aW9uICYgeyBhbHRlcm5hdGU/OiBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyB9O1xuXHRwdWJsaWMgZGlzcGxheWVkU3RhdGVzOiByZWFkb25seSAoVGVzdFJlc3VsdFN0YXRlIHwgdW5kZWZpbmVkKVtdO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByb3RlY3RlZCB0ZXN0czogcmVhZG9ubHkge1xuXHRcdFx0dGVzdDogSW5jcmVtZW50YWxUZXN0Q29sbGVjdGlvbkl0ZW07XG5cdFx0XHRyZXN1bHRJdGVtOiBUZXN0UmVzdWx0SXRlbSB8IHVuZGVmaW5lZDtcblx0XHR9W10sXG5cdFx0cHJpdmF0ZSB2aXNpYmxlOiBib29sZWFuLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBtb2RlbDogSVRleHRNb2RlbCxcblx0XHRASUNvZGVFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASVRlc3RTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSB0ZXN0U2VydmljZTogSVRlc3RTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVzdFByb2ZpbGVTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSB0ZXN0UHJvZmlsZVNlcnZpY2U6IElUZXN0UHJvZmlsZVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLmRpc3BsYXllZFN0YXRlcyA9IHRlc3RzLm1hcCh0ID0+IHQucmVzdWx0SXRlbT8uY29tcHV0ZWRTdGF0ZSk7XG5cdFx0dGhpcy5lZGl0b3JEZWNvcmF0aW9uID0gY3JlYXRlUnVuVGVzdERlY29yYXRpb24oXG5cdFx0XHR0ZXN0cy5tYXAodCA9PiB0LnRlc3QpLFxuXHRcdFx0dGVzdHMubWFwKHQgPT4gdC5yZXN1bHRJdGVtKSxcblx0XHRcdHZpc2libGUsXG5cdFx0XHRnZXRUZXN0aW5nQ29uZmlndXJhdGlvbih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBUZXN0aW5nQ29uZmlnS2V5cy5EZWZhdWx0R3V0dGVyQ2xpY2tBY3Rpb24pLFxuXHRcdCk7XG5cdFx0dGhpcy5lZGl0b3JEZWNvcmF0aW9uLm9wdGlvbnMuZ2x5cGhNYXJnaW5Ib3Zlck1lc3NhZ2UgPSBuZXcgTWFya2Rvd25TdHJpbmcoKS5hcHBlbmRUZXh0KHRoaXMuZ2V0R3V0dGVyTGFiZWwoKSk7XG5cdH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIGNsaWNrKGU6IElFZGl0b3JNb3VzZUV2ZW50KTogYm9vbGVhbiB7XG5cdFx0aWYgKGUudGFyZ2V0LnR5cGUgIT09IE1vdXNlVGFyZ2V0VHlwZS5HVVRURVJfR0xZUEhfTUFSR0lOXG5cdFx0XHR8fCBlLnRhcmdldC5kZXRhaWwuZ2x5cGhNYXJnaW5MYW5lICE9PSBHTFlQSF9NQVJHSU5fTEFORVxuXHRcdFx0Ly8gaGFuZGxlZCBieSBlZGl0b3IgZ3V0dGVyIGNvbnRleHQgbWVudVxuXHRcdFx0fHwgZS5ldmVudC5yaWdodEJ1dHRvblxuXHRcdFx0fHwgaXNNYWNpbnRvc2ggJiYgZS5ldmVudC5sZWZ0QnV0dG9uICYmIGUuZXZlbnQuY3RybEtleVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFsdGVybmF0ZUFjdGlvbiA9IGUuZXZlbnQuYWx0S2V5O1xuXHRcdHN3aXRjaCAoZ2V0VGVzdGluZ0NvbmZpZ3VyYXRpb24odGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgVGVzdGluZ0NvbmZpZ0tleXMuRGVmYXVsdEd1dHRlckNsaWNrQWN0aW9uKSkge1xuXHRcdFx0Y2FzZSBEZWZhdWx0R3V0dGVyQ2xpY2tBY3Rpb24uQ29udGV4dE1lbnU6XG5cdFx0XHRcdHRoaXMuc2hvd0NvbnRleHRNZW51KGUpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgRGVmYXVsdEd1dHRlckNsaWNrQWN0aW9uLkRlYnVnOlxuXHRcdFx0XHR0aGlzLnJ1bldpdGgoYWx0ZXJuYXRlQWN0aW9uID8gVGVzdFJ1blByb2ZpbGVCaXRzZXQuUnVuIDogVGVzdFJ1blByb2ZpbGVCaXRzZXQuRGVidWcpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgRGVmYXVsdEd1dHRlckNsaWNrQWN0aW9uLkNvdmVyYWdlOlxuXHRcdFx0XHR0aGlzLnJ1bldpdGgoYWx0ZXJuYXRlQWN0aW9uID8gVGVzdFJ1blByb2ZpbGVCaXRzZXQuRGVidWcgOiBUZXN0UnVuUHJvZmlsZUJpdHNldC5Db3ZlcmFnZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBEZWZhdWx0R3V0dGVyQ2xpY2tBY3Rpb24uUnVuOlxuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhpcy5ydW5XaXRoKGFsdGVybmF0ZUFjdGlvbiA/IFRlc3RSdW5Qcm9maWxlQml0c2V0LkRlYnVnIDogVGVzdFJ1blByb2ZpbGVCaXRzZXQuUnVuKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogVXBkYXRlcyB0aGUgZGVjb3JhdGlvbiB0byBtYXRjaCB0aGUgbmV3IHNldCBvZiB0ZXN0cy5cblx0ICogQHJldHVybnMgdHJ1ZSBpZiBvcHRpb25zIHdlcmUgY2hhbmdlZCwgZmFsc2Ugb3RoZXJ3aXNlXG5cdCAqL1xuXHRwdWJsaWMgcmVwbGFjZU9wdGlvbnMobmV3VGVzdHM6IHJlYWRvbmx5IHtcblx0XHR0ZXN0OiBJbmNyZW1lbnRhbFRlc3RDb2xsZWN0aW9uSXRlbTtcblx0XHRyZXN1bHRJdGVtOiBUZXN0UmVzdWx0SXRlbSB8IHVuZGVmaW5lZDtcblx0fVtdLCB2aXNpYmxlOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgZGlzcGxheWVkU3RhdGVzID0gbmV3VGVzdHMubWFwKHQgPT4gdC5yZXN1bHRJdGVtPy5jb21wdXRlZFN0YXRlKTtcblx0XHRpZiAodmlzaWJsZSA9PT0gdGhpcy52aXNpYmxlICYmIGVxdWFscyh0aGlzLmRpc3BsYXllZFN0YXRlcywgZGlzcGxheWVkU3RhdGVzKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRoaXMudGVzdHMgPSBuZXdUZXN0cztcblx0XHR0aGlzLmRpc3BsYXllZFN0YXRlcyA9IGRpc3BsYXllZFN0YXRlcztcblx0XHR0aGlzLnZpc2libGUgPSB2aXNpYmxlO1xuXG5cdFx0Y29uc3QgeyBvcHRpb25zLCBhbHRlcm5hdGUgfSA9IGNyZWF0ZVJ1blRlc3REZWNvcmF0aW9uKFxuXHRcdFx0bmV3VGVzdHMubWFwKHQgPT4gdC50ZXN0KSxcblx0XHRcdG5ld1Rlc3RzLm1hcCh0ID0+IHQucmVzdWx0SXRlbSksXG5cdFx0XHR2aXNpYmxlLFxuXHRcdFx0Z2V0VGVzdGluZ0NvbmZpZ3VyYXRpb24odGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgVGVzdGluZ0NvbmZpZ0tleXMuRGVmYXVsdEd1dHRlckNsaWNrQWN0aW9uKVxuXHRcdCk7XG5cblx0XHR0aGlzLmVkaXRvckRlY29yYXRpb24ub3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0dGhpcy5lZGl0b3JEZWNvcmF0aW9uLmFsdGVybmF0ZSA9IGFsdGVybmF0ZTtcblx0XHR0aGlzLmVkaXRvckRlY29yYXRpb24ub3B0aW9ucy5nbHlwaE1hcmdpbkhvdmVyTWVzc2FnZSA9IG5ldyBNYXJrZG93blN0cmluZygpLmFwcGVuZFRleHQodGhpcy5nZXRHdXR0ZXJMYWJlbCgpKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXRzIHdoZXRoZXIgdGhpcyBkZWNvcmF0aW9uIHNlcnZlcyBhcyB0aGUgcnVuIGJ1dHRvbiBmb3IgdGhlIGdpdmVuIHRlc3QgSUQuXG5cdCAqL1xuXHRwdWJsaWMgaXNGb3JUZXN0KHRlc3RJZDogc3RyaW5nKSB7XG5cdFx0cmV0dXJuIHRoaXMudGVzdHMuc29tZSh0ID0+IHQudGVzdC5pdGVtLmV4dElkID09PSB0ZXN0SWQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENhbGxlZCB3aGVuIHRoZSBkZWNvcmF0aW9uIGlzIGNsaWNrZWQgb24uXG5cdCAqL1xuXHRhYnN0cmFjdCBnZXRDb250ZXh0TWVudUFjdGlvbnMoKTogSVJlZmVyZW5jZTxJQWN0aW9uW10+O1xuXG5cdHByb3RlY3RlZCBydW5XaXRoKHByb2ZpbGU6IFRlc3RSdW5Qcm9maWxlQml0c2V0KSB7XG5cdFx0cmV0dXJuIHRoaXMudGVzdFNlcnZpY2UucnVuVGVzdHMoe1xuXHRcdFx0dGVzdHM6IHNpbXBsaWZ5VGVzdHNUb0V4ZWN1dGUodGhpcy50ZXN0U2VydmljZS5jb2xsZWN0aW9uLCB0aGlzLnRlc3RzLm1hcCgoeyB0ZXN0IH0pID0+IHRlc3QpKSxcblx0XHRcdGdyb3VwOiBwcm9maWxlLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG93Q29udGV4dE1lbnUoZTogSUVkaXRvck1vdXNlRXZlbnQpIHtcblx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLmNvZGVFZGl0b3JTZXJ2aWNlLmxpc3RDb2RlRWRpdG9ycygpLmZpbmQoZSA9PiBlLmdldE1vZGVsKCkgPT09IHRoaXMubW9kZWwpO1xuXHRcdGVkaXRvcj8uZ2V0Q29udHJpYnV0aW9uPEVkaXRvckxpbmVOdW1iZXJDb250ZXh0TWVudT4oRWRpdG9yTGluZU51bWJlckNvbnRleHRNZW51LklEKT8uc2hvdyhlKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0R3V0dGVyTGFiZWwoKSB7XG5cdFx0c3dpdGNoIChnZXRUZXN0aW5nQ29uZmlndXJhdGlvbih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBUZXN0aW5nQ29uZmlnS2V5cy5EZWZhdWx0R3V0dGVyQ2xpY2tBY3Rpb24pKSB7XG5cdFx0XHRjYXNlIERlZmF1bHRHdXR0ZXJDbGlja0FjdGlvbi5Db250ZXh0TWVudTpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCd0ZXN0aW5nLmd1dHRlck1zZy5jb250ZXh0TWVudScsICdDbGljayBmb3IgdGVzdCBvcHRpb25zJyk7XG5cdFx0XHRjYXNlIERlZmF1bHRHdXR0ZXJDbGlja0FjdGlvbi5EZWJ1Zzpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCd0ZXN0aW5nLmd1dHRlck1zZy5kZWJ1ZycsICdDbGljayB0byBkZWJ1ZyB0ZXN0cywgcmlnaHQgY2xpY2sgZm9yIG1vcmUgb3B0aW9ucycpO1xuXHRcdFx0Y2FzZSBEZWZhdWx0R3V0dGVyQ2xpY2tBY3Rpb24uQ292ZXJhZ2U6XG5cdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgndGVzdGluZy5ndXR0ZXJNc2cuY292ZXJhZ2UnLCAnQ2xpY2sgdG8gcnVuIHRlc3RzIHdpdGggY292ZXJhZ2UsIHJpZ2h0IGNsaWNrIGZvciBtb3JlIG9wdGlvbnMnKTtcblx0XHRcdGNhc2UgRGVmYXVsdEd1dHRlckNsaWNrQWN0aW9uLlJ1bjpcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgndGVzdGluZy5ndXR0ZXJNc2cucnVuJywgJ0NsaWNrIHRvIHJ1biB0ZXN0cywgcmlnaHQgY2xpY2sgZm9yIG1vcmUgb3B0aW9ucycpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBHZXRzIGNvbnRleHQgbWVudSBhY3Rpb25zIHJlbGV2YW50IGZvciBhIHNpbmdlbCB0ZXN0LlxuXHQgKi9cblx0cHJvdGVjdGVkIGdldFRlc3RDb250ZXh0TWVudUFjdGlvbnModGVzdDogSW50ZXJuYWxUZXN0SXRlbSwgcmVzdWx0SXRlbT86IFRlc3RSZXN1bHRJdGVtKTogSVJlZmVyZW5jZTxJQWN0aW9uW10+IHtcblx0XHRjb25zdCB0ZXN0QWN0aW9uczogQWN0aW9uW10gPSBbXTtcblx0XHRjb25zdCBjYXBhYmlsaXRpZXMgPSB0aGlzLnRlc3RQcm9maWxlU2VydmljZS5jYXBhYmlsaXRpZXNGb3JUZXN0KHRlc3QuaXRlbSk7XG5cblx0XHRbXG5cdFx0XHR7IGJpdHNldDogVGVzdFJ1blByb2ZpbGVCaXRzZXQuUnVuLCBsYWJlbDogbG9jYWxpemUoJ3J1biB0ZXN0JywgJ1J1biBUZXN0JykgfSxcblx0XHRcdHsgYml0c2V0OiBUZXN0UnVuUHJvZmlsZUJpdHNldC5EZWJ1ZywgbGFiZWw6IGxvY2FsaXplKCdkZWJ1ZyB0ZXN0JywgJ0RlYnVnIFRlc3QnKSB9LFxuXHRcdFx0eyBiaXRzZXQ6IFRlc3RSdW5Qcm9maWxlQml0c2V0LkNvdmVyYWdlLCBsYWJlbDogbG9jYWxpemUoJ2NvdmVyYWdlIHRlc3QnLCAnUnVuIHdpdGggQ292ZXJhZ2UnKSB9LFxuXHRcdF0uZm9yRWFjaCgoeyBiaXRzZXQsIGxhYmVsIH0pID0+IHtcblx0XHRcdGlmIChjYXBhYmlsaXRpZXMgJiBiaXRzZXQpIHtcblx0XHRcdFx0dGVzdEFjdGlvbnMucHVzaChuZXcgQWN0aW9uKGB0ZXN0aW5nLmd1dHRlci4ke2JpdHNldH1gLCBsYWJlbCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0KCkgPT4gdGhpcy50ZXN0U2VydmljZS5ydW5UZXN0cyh7IGdyb3VwOiBiaXRzZXQsIHRlc3RzOiBbdGVzdF0gfSkpKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGlmIChjYXBhYmlsaXRpZXMgJiBUZXN0UnVuUHJvZmlsZUJpdHNldC5IYXNOb25EZWZhdWx0UHJvZmlsZSkge1xuXHRcdFx0dGVzdEFjdGlvbnMucHVzaChuZXcgQWN0aW9uKCd0ZXN0aW5nLnJ1blVzaW5nJywgbG9jYWxpemUoJ3Rlc3RpbmcucnVuVXNpbmcnLCAnRXhlY3V0ZSBVc2luZyBQcm9maWxlLi4uJyksIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHByb2ZpbGU6IElUZXN0UnVuUHJvZmlsZSB8IHVuZGVmaW5lZCA9IGF3YWl0IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ3ZzY29kZS5waWNrVGVzdFByb2ZpbGUnLCB7IG9ubHlGb3JUZXN0OiB0ZXN0IH0pO1xuXHRcdFx0XHRpZiAoIXByb2ZpbGUpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLnRlc3RTZXJ2aWNlLnJ1blJlc29sdmVkVGVzdHMoe1xuXHRcdFx0XHRcdGdyb3VwOiBwcm9maWxlLmdyb3VwLFxuXHRcdFx0XHRcdHRhcmdldHM6IFt7XG5cdFx0XHRcdFx0XHRwcm9maWxlSWQ6IHByb2ZpbGUucHJvZmlsZUlkLFxuXHRcdFx0XHRcdFx0Y29udHJvbGxlcklkOiBwcm9maWxlLmNvbnRyb2xsZXJJZCxcblx0XHRcdFx0XHRcdHRlc3RJZHM6IFt0ZXN0Lml0ZW0uZXh0SWRdXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fSk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0aWYgKHJlc3VsdEl0ZW0gJiYgaXNGYWlsZWRTdGF0ZShyZXN1bHRJdGVtLmNvbXB1dGVkU3RhdGUpKSB7XG5cdFx0XHR0ZXN0QWN0aW9ucy5wdXNoKG5ldyBBY3Rpb24oJ3Rlc3RpbmcuZ3V0dGVyLnBlZWtGYWlsdXJlJywgbG9jYWxpemUoJ3BlZWsgZmFpbHVyZScsICdQZWVrIEVycm9yJyksIHVuZGVmaW5lZCwgdW5kZWZpbmVkLFxuXHRcdFx0XHQoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd2c2NvZGUucGVla1Rlc3RFcnJvcicsIHRlc3QuaXRlbS5leHRJZCkpKTtcblx0XHR9XG5cblx0XHR0ZXN0QWN0aW9ucy5wdXNoKG5ldyBBY3Rpb24oJ3Rlc3RpbmcuZ3V0dGVyLnJldmVhbCcsIGxvY2FsaXplKCdyZXZlYWwgdGVzdCcsICdSZXZlYWwgaW4gVGVzdCBFeHBsb3JlcicpLCB1bmRlZmluZWQsIHVuZGVmaW5lZCxcblx0XHRcdCgpID0+IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ19yZXZlYWxUZXN0SW5FeHBsb3JlcicsIHRlc3QuaXRlbS5leHRJZCkpKTtcblxuXHRcdGNvbnN0IGNvbnRyaWJ1dGVkID0gdGhpcy5nZXRDb250cmlidXRlZFRlc3RBY3Rpb25zKHRlc3QsIGNhcGFiaWxpdGllcyk7XG5cdFx0cmV0dXJuIHsgb2JqZWN0OiBTZXBhcmF0b3Iuam9pbih0ZXN0QWN0aW9ucywgY29udHJpYnV0ZWQpLCBkaXNwb3NlKCkgeyB0ZXN0QWN0aW9ucy5mb3JFYWNoKGEgPT4gYS5kaXNwb3NlKCkpOyB9IH07XG5cdH1cblxuXHRwcml2YXRlIGdldENvbnRyaWJ1dGVkVGVzdEFjdGlvbnModGVzdDogSW50ZXJuYWxUZXN0SXRlbSwgY2FwYWJpbGl0aWVzOiBudW1iZXIpOiBJQWN0aW9uW10ge1xuXHRcdGNvbnN0IGNvbnRleHRPdmVybGF5ID0gdGhpcy5jb250ZXh0S2V5U2VydmljZS5jcmVhdGVPdmVybGF5KGdldFRlc3RJdGVtQ29udGV4dE92ZXJsYXkodGVzdCwgY2FwYWJpbGl0aWVzKSk7XG5cblx0XHRjb25zdCBhcmcgPSBnZXRDb250ZXh0Rm9yVGVzdEl0ZW0odGhpcy50ZXN0U2VydmljZS5jb2xsZWN0aW9uLCB0ZXN0Lml0ZW0uZXh0SWQpO1xuXHRcdGNvbnN0IG1lbnUgPSB0aGlzLm1lbnVTZXJ2aWNlLmdldE1lbnVBY3Rpb25zKE1lbnVJZC5UZXN0SXRlbUd1dHRlciwgY29udGV4dE92ZXJsYXksIHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUsIGFyZyB9KTtcblx0XHRyZXR1cm4gZ2V0RmxhdENvbnRleHRNZW51QWN0aW9ucyhtZW51KTtcblx0fVxufVxuXG5pbnRlcmZhY2UgSU11bHRpUnVuVGVzdCB7XG5cdGN1cnJlbnRMYWJlbDogc3RyaW5nO1xuXHRwYXJlbnQ6IFRlc3RJZCB8IHVuZGVmaW5lZDtcblx0dGVzdEl0ZW06IHtcblx0XHR0ZXN0OiBJbmNyZW1lbnRhbFRlc3RDb2xsZWN0aW9uSXRlbTtcblx0XHRyZXN1bHRJdGVtOiBUZXN0UmVzdWx0SXRlbSB8IHVuZGVmaW5lZDtcblx0fTtcbn1cblxuY2xhc3MgTXVsdGlSdW5UZXN0RGVjb3JhdGlvbiBleHRlbmRzIFJ1blRlc3REZWNvcmF0aW9uIGltcGxlbWVudHMgSVRlc3REZWNvcmF0aW9uIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0dGVzdHM6IHJlYWRvbmx5IHtcblx0XHRcdHRlc3Q6IEluY3JlbWVudGFsVGVzdENvbGxlY3Rpb25JdGVtO1xuXHRcdFx0cmVzdWx0SXRlbTogVGVzdFJlc3VsdEl0ZW0gfCB1bmRlZmluZWQ7XG5cdFx0fVtdLFxuXHRcdHZpc2libGU6IGJvb2xlYW4sXG5cdFx0bW9kZWw6IElUZXh0TW9kZWwsXG5cdFx0QElDb2RlRWRpdG9yU2VydmljZSBjb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJVGVzdFNlcnZpY2UgdGVzdFNlcnZpY2U6IElUZXN0U2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVRlc3RQcm9maWxlU2VydmljZSB0ZXN0UHJvZmlsZVNlcnZpY2U6IElUZXN0UHJvZmlsZVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIodGVzdHMsIHZpc2libGUsIG1vZGVsLCBjb2RlRWRpdG9yU2VydmljZSwgdGVzdFNlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgY29tbWFuZFNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0ZXN0UHJvZmlsZVNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCBtZW51U2VydmljZSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZ2V0Q29udGV4dE1lbnVBY3Rpb25zKCkge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgYWxsQWN0aW9uczogQWN0aW9uW10gPSBbXTtcblx0XHRbXG5cdFx0XHR7IGJpdHNldDogVGVzdFJ1blByb2ZpbGVCaXRzZXQuUnVuLCBsYWJlbDogbG9jYWxpemUoJ3J1biBhbGwgdGVzdCcsICdSdW4gQWxsIFRlc3RzJykgfSxcblx0XHRcdHsgYml0c2V0OiBUZXN0UnVuUHJvZmlsZUJpdHNldC5Db3ZlcmFnZSwgbGFiZWw6IGxvY2FsaXplKCdydW4gYWxsIHRlc3Qgd2l0aCBjb3ZlcmFnZScsICdSdW4gQWxsIFRlc3RzIHdpdGggQ292ZXJhZ2UnKSB9LFxuXHRcdFx0eyBiaXRzZXQ6IFRlc3RSdW5Qcm9maWxlQml0c2V0LkRlYnVnLCBsYWJlbDogbG9jYWxpemUoJ2RlYnVnIGFsbCB0ZXN0JywgJ0RlYnVnIEFsbCBUZXN0cycpIH0sXG5cdFx0XS5mb3JFYWNoKCh7IGJpdHNldCwgbGFiZWwgfSwgaSkgPT4ge1xuXHRcdFx0Y29uc3QgY2FuUnVuID0gdGhpcy50ZXN0cy5zb21lKCh7IHRlc3QgfSkgPT4gdGhpcy50ZXN0UHJvZmlsZVNlcnZpY2UuY2FwYWJpbGl0aWVzRm9yVGVzdCh0ZXN0Lml0ZW0pICYgYml0c2V0KTtcblx0XHRcdGlmIChjYW5SdW4pIHtcblx0XHRcdFx0YWxsQWN0aW9ucy5wdXNoKG5ldyBBY3Rpb24oYHRlc3RpbmcuZ3V0dGVyLnJ1biR7aX1gLCBsYWJlbCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsICgpID0+IHRoaXMucnVuV2l0aChiaXRzZXQpKSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRkaXNwb3NhYmxlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gYWxsQWN0aW9ucy5mb3JFYWNoKGEgPT4gYS5kaXNwb3NlKCkpKSk7XG5cblx0XHRjb25zdCB0ZXN0SXRlbXMgPSB0aGlzLnRlc3RzLm1hcCgodGVzdEl0ZW0pOiBJTXVsdGlSdW5UZXN0ID0+ICh7XG5cdFx0XHRjdXJyZW50TGFiZWw6IHRlc3RJdGVtLnRlc3QuaXRlbS5sYWJlbCxcblx0XHRcdHRlc3RJdGVtLFxuXHRcdFx0cGFyZW50OiBUZXN0SWQuZnJvbVN0cmluZyh0ZXN0SXRlbS50ZXN0Lml0ZW0uZXh0SWQpLnBhcmVudElkLFxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGdldExhYmVsQ29uZmxpY3RzID0gKHRlc3RzOiB0eXBlb2YgdGVzdEl0ZW1zKSA9PiB7XG5cdFx0XHRjb25zdCBsYWJlbENvdW50ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblx0XHRcdGZvciAoY29uc3QgdGVzdCBvZiB0ZXN0cykge1xuXHRcdFx0XHRsYWJlbENvdW50LnNldCh0ZXN0LmN1cnJlbnRMYWJlbCwgKGxhYmVsQ291bnQuZ2V0KHRlc3QuY3VycmVudExhYmVsKSB8fCAwKSArIDEpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdGVzdHMuZmlsdGVyKGUgPT4gbGFiZWxDb3VudC5nZXQoZS5jdXJyZW50TGFiZWwpISA+IDEpO1xuXHRcdH07XG5cblx0XHRsZXQgY29uZmxpY3RzLCBoYXNQYXJlbnQgPSB0cnVlO1xuXHRcdHdoaWxlICgoY29uZmxpY3RzID0gZ2V0TGFiZWxDb25mbGljdHModGVzdEl0ZW1zKSkubGVuZ3RoICYmIGhhc1BhcmVudCkge1xuXHRcdFx0Zm9yIChjb25zdCBjb25mbGljdCBvZiBjb25mbGljdHMpIHtcblx0XHRcdFx0aWYgKGNvbmZsaWN0LnBhcmVudCkge1xuXHRcdFx0XHRcdGNvbnN0IHBhcmVudCA9IHRoaXMudGVzdFNlcnZpY2UuY29sbGVjdGlvbi5nZXROb2RlQnlJZChjb25mbGljdC5wYXJlbnQudG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0Y29uZmxpY3QuY3VycmVudExhYmVsID0gcGFyZW50Py5pdGVtLmxhYmVsICsgJyA+ICcgKyBjb25mbGljdC5jdXJyZW50TGFiZWw7XG5cdFx0XHRcdFx0Y29uZmxpY3QucGFyZW50ID0gY29uZmxpY3QucGFyZW50LnBhcmVudElkO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGhhc1BhcmVudCA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGVzdEl0ZW1zLnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdGNvbnN0IGFpID0gYS50ZXN0SXRlbS50ZXN0Lml0ZW07XG5cdFx0XHRjb25zdCBiaSA9IGIudGVzdEl0ZW0udGVzdC5pdGVtO1xuXHRcdFx0cmV0dXJuIChhaS5zb3J0VGV4dCB8fCBhaS5sYWJlbCkubG9jYWxlQ29tcGFyZShiaS5zb3J0VGV4dCB8fCBiaS5sYWJlbCk7XG5cdFx0fSk7XG5cblx0XHRsZXQgdGVzdFN1Ym1lbnVzOiBJQWN0aW9uW10gPSB0ZXN0SXRlbXMubWFwKCh7IGN1cnJlbnRMYWJlbCwgdGVzdEl0ZW0gfSkgPT4ge1xuXHRcdFx0Y29uc3QgYWN0aW9ucyA9IHRoaXMuZ2V0VGVzdENvbnRleHRNZW51QWN0aW9ucyh0ZXN0SXRlbS50ZXN0LCB0ZXN0SXRlbS5yZXN1bHRJdGVtKTtcblx0XHRcdGRpc3Bvc2FibGUuYWRkKGFjdGlvbnMpO1xuXHRcdFx0bGV0IGxhYmVsID0gc3RyaXBJY29ucyhjdXJyZW50TGFiZWwpO1xuXHRcdFx0Y29uc3QgbGYgPSBsYWJlbC5pbmRleE9mKCdcXG4nKTtcblx0XHRcdGlmIChsZiAhPT0gLTEpIHtcblx0XHRcdFx0bGFiZWwgPSBsYWJlbC5zbGljZSgwLCBsZik7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBuZXcgU3VibWVudUFjdGlvbih0ZXN0SXRlbS50ZXN0Lml0ZW0uZXh0SWQsIGxhYmVsLCBhY3Rpb25zLm9iamVjdCk7XG5cdFx0fSk7XG5cblxuXHRcdGNvbnN0IG92ZXJmbG93ID0gdGVzdFN1Ym1lbnVzLmxlbmd0aCAtIE1BWF9URVNUU19JTl9TVUJNRU5VO1xuXHRcdGlmIChvdmVyZmxvdyA+IDApIHtcblx0XHRcdHRlc3RTdWJtZW51cyA9IHRlc3RTdWJtZW51cy5zbGljZSgwLCBNQVhfVEVTVFNfSU5fU1VCTUVOVSk7XG5cdFx0XHR0ZXN0U3VibWVudXMucHVzaChuZXcgQWN0aW9uKFxuXHRcdFx0XHQndGVzdGluZy5ndXR0ZXIub3ZlcmZsb3cnLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVzdE92ZXJmbG93SXRlbXMnLCAnezB9IG1vcmUgdGVzdHMuLi4nLCBvdmVyZmxvdyksXG5cdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHQoKSA9PiB0aGlzLnBpY2tBbmRSdW4odGVzdEl0ZW1zKSxcblx0XHRcdCkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IG9iamVjdDogU2VwYXJhdG9yLmpvaW4oYWxsQWN0aW9ucywgdGVzdFN1Ym1lbnVzKSwgZGlzcG9zZTogKCkgPT4gZGlzcG9zYWJsZS5kaXNwb3NlKCkgfTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcGlja0FuZFJ1bih0ZXN0SXRlbXM6IElNdWx0aVJ1blRlc3RbXSkge1xuXHRcdGNvbnN0IGRvUGljayA9IDxUIGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0+KGl0ZW1zOiBUW10sIHRpdGxlOiBzdHJpbmcpID0+IG5ldyBQcm9taXNlPFQgfCB1bmRlZmluZWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRjb25zdCBwaWNrID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMucXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrPFQ+KCkpO1xuXHRcdFx0cGljay5wbGFjZWhvbGRlciA9IHRpdGxlO1xuXHRcdFx0cGljay5pdGVtcyA9IGl0ZW1zO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHBpY2sub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocGljay5vbkRpZEFjY2VwdCgoKSA9PiB7XG5cdFx0XHRcdHJlc29sdmUocGljay5zZWxlY3RlZEl0ZW1zWzBdKTtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0fSkpO1xuXHRcdFx0cGljay5zaG93KCk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBpdGVtID0gYXdhaXQgZG9QaWNrKFxuXHRcdFx0dGVzdEl0ZW1zLm1hcCgoeyBjdXJyZW50TGFiZWwsIHRlc3RJdGVtIH0pID0+ICh7IGxhYmVsOiBjdXJyZW50TGFiZWwsIHRlc3Q6IHRlc3RJdGVtLnRlc3QsIHJlc3VsdDogdGVzdEl0ZW0ucmVzdWx0SXRlbSB9KSksXG5cdFx0XHRsb2NhbGl6ZSgnc2VsZWN0VGVzdFRvUnVuJywgJ1NlbGVjdCBhIHRlc3QgdG8gcnVuJyksXG5cdFx0KTtcblxuXHRcdGlmICghaXRlbSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGlvbnMgPSB0aGlzLmdldFRlc3RDb250ZXh0TWVudUFjdGlvbnMoaXRlbS50ZXN0LCBpdGVtLnJlc3VsdCk7XG5cdFx0dHJ5IHtcblx0XHRcdChhd2FpdCBkb1BpY2soYWN0aW9ucy5vYmplY3QsIGl0ZW0ubGFiZWwpKT8ucnVuKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGFjdGlvbnMuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBSdW5TaW5nbGVUZXN0RGVjb3JhdGlvbiBleHRlbmRzIFJ1blRlc3REZWNvcmF0aW9uIGltcGxlbWVudHMgSVRlc3REZWNvcmF0aW9uIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0dGVzdDogSW5jcmVtZW50YWxUZXN0Q29sbGVjdGlvbkl0ZW0sXG5cdFx0cmVzdWx0SXRlbTogVGVzdFJlc3VsdEl0ZW0gfCB1bmRlZmluZWQsXG5cdFx0bW9kZWw6IElUZXh0TW9kZWwsXG5cdFx0dmlzaWJsZTogYm9vbGVhbixcblx0XHRASUNvZGVFZGl0b3JTZXJ2aWNlIGNvZGVFZGl0b3JTZXJ2aWNlOiBJQ29kZUVkaXRvclNlcnZpY2UsXG5cdFx0QElUZXN0U2VydmljZSB0ZXN0U2VydmljZTogSVRlc3RTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVzdFByb2ZpbGVTZXJ2aWNlIHRlc3RQcm9maWxlczogSVRlc3RQcm9maWxlU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihbeyB0ZXN0LCByZXN1bHRJdGVtIH1dLCB2aXNpYmxlLCBtb2RlbCwgY29kZUVkaXRvclNlcnZpY2UsIHRlc3RTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbW1hbmRTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgdGVzdFByb2ZpbGVzLCBjb250ZXh0S2V5U2VydmljZSwgbWVudVNlcnZpY2UpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0Q29udGV4dE1lbnVBY3Rpb25zKCkge1xuXHRcdHJldHVybiB0aGlzLmdldFRlc3RDb250ZXh0TWVudUFjdGlvbnModGhpcy50ZXN0c1swXS50ZXN0LCB0aGlzLnRlc3RzWzBdLnJlc3VsdEl0ZW0pO1xuXHR9XG59XG5cbmNvbnN0IGxpbmVCcmVha1JlID0gL1xccj9cXG5cXHMqL2c7XG5cbmNsYXNzIFRlc3RNZXNzYWdlRGVjb3JhdGlvbiBpbXBsZW1lbnRzIElUZXN0RGVjb3JhdGlvbiB7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgaW5saW5lQ2xhc3NOYW1lID0gJ3Rlc3QtbWVzc2FnZS1pbmxpbmUtY29udGVudCc7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgZGVjb3JhdGlvbklkID0gYHRlc3RtZXNzYWdlLSR7Z2VuZXJhdGVVdWlkKCl9YDtcblxuXHRwdWJsaWMgaWQgPSAnJztcblxuXHRwdWJsaWMgcmVhZG9ubHkgZWRpdG9yRGVjb3JhdGlvbjogSU1vZGVsRGVsdGFEZWNvcmF0aW9uO1xuXHRwdWJsaWMgcmVhZG9ubHkgbGluZTogbnVtYmVyO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY29udGVudElkQ2xhc3MgPSBgdGVzdC1tZXNzYWdlLWlubGluZS1jb250ZW50LWlkJHtnZW5lcmF0ZVV1aWQoKX1gO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSB0ZXN0TWVzc2FnZTogSVRlc3RNZXNzYWdlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbWVzc2FnZVVyaTogVVJJIHwgdW5kZWZpbmVkLFxuXHRcdHRleHRNb2RlbDogSVRleHRNb2RlbCxcblx0XHRASVRlc3RpbmdQZWVrT3BlbmVyIHByaXZhdGUgcmVhZG9ubHkgcGVla09wZW5lcjogSVRlc3RpbmdQZWVrT3BlbmVyLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgZWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHQpIHtcblx0XHRjb25zdCBsb2NhdGlvbiA9IHRlc3RNZXNzYWdlLmxvY2F0aW9uITtcblx0XHR0aGlzLmxpbmUgPSBjbGFtcChsb2NhdGlvbi5yYW5nZS5zdGFydExpbmVOdW1iZXIsIDAsIHRleHRNb2RlbC5nZXRMaW5lQ291bnQoKSk7XG5cdFx0Y29uc3Qgc2V2ZXJpdHkgPSB0ZXN0TWVzc2FnZS50eXBlO1xuXHRcdGNvbnN0IG1lc3NhZ2UgPSB0ZXN0TWVzc2FnZS5tZXNzYWdlO1xuXG5cdFx0Y29uc3Qgb3B0aW9ucyA9IGVkaXRvclNlcnZpY2UucmVzb2x2ZURlY29yYXRpb25PcHRpb25zKFRlc3RNZXNzYWdlRGVjb3JhdGlvbi5kZWNvcmF0aW9uSWQsIHRydWUpO1xuXHRcdG9wdGlvbnMuaG92ZXJNZXNzYWdlID0gdHlwZW9mIG1lc3NhZ2UgPT09ICdzdHJpbmcnID8gbmV3IE1hcmtkb3duU3RyaW5nKCkuYXBwZW5kVGV4dChtZXNzYWdlKSA6IG1lc3NhZ2U7XG5cdFx0b3B0aW9ucy56SW5kZXggPSAxMDsgLy8gdG9kbzogaW4gc3BpdGUgb2YgdGhlIHotaW5kZXgsIHRoaXMgYXBwZWFycyBiZWhpbmQgZ2l0bGVuc1xuXHRcdG9wdGlvbnMuY2xhc3NOYW1lID0gYHRlc3RpbmctaW5saW5lLW1lc3NhZ2Utc2V2ZXJpdHktJHtzZXZlcml0eX1gO1xuXHRcdG9wdGlvbnMuaXNXaG9sZUxpbmUgPSB0cnVlO1xuXHRcdG9wdGlvbnMuc3RpY2tpbmVzcyA9IFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzO1xuXHRcdG9wdGlvbnMuY29sbGFwc2VPblJlcGxhY2VFZGl0ID0gdHJ1ZTtcblxuXHRcdGxldCBpbmxpbmVUZXh0ID0gcmVuZGVyVGVzdE1lc3NhZ2VBc1RleHQobWVzc2FnZSkucmVwbGFjZShsaW5lQnJlYWtSZSwgJyAnKTtcblx0XHRpZiAoaW5saW5lVGV4dC5sZW5ndGggPiBNQVhfSU5MSU5FX01FU1NBR0VfTEVOR1RIKSB7XG5cdFx0XHRpbmxpbmVUZXh0ID0gaW5saW5lVGV4dC5zbGljZSgwLCBNQVhfSU5MSU5FX01FU1NBR0VfTEVOR1RIIC0gMSkgKyAnXHUyMDI2Jztcblx0XHR9XG5cblx0XHRvcHRpb25zLmFmdGVyID0ge1xuXHRcdFx0Y29udGVudDogaW5saW5lVGV4dCxcblx0XHRcdGlubGluZUNsYXNzTmFtZTogYHRlc3QtbWVzc2FnZS1pbmxpbmUtY29udGVudCB0ZXN0LW1lc3NhZ2UtaW5saW5lLWNvbnRlbnQtcyR7c2V2ZXJpdHl9ICR7dGhpcy5jb250ZW50SWRDbGFzc30gJHttZXNzYWdlVXJpID8gJ3Rlc3QtbWVzc2FnZS1pbmxpbmUtY29udGVudC1jbGlja2FibGUnIDogJyd9YFxuXHRcdH07XG5cdFx0b3B0aW9ucy5zaG93SWZDb2xsYXBzZWQgPSB0cnVlO1xuXG5cdFx0Y29uc3QgcnVsZXJDb2xvciA9IHNldmVyaXR5ID09PSBUZXN0TWVzc2FnZVR5cGUuRXJyb3Jcblx0XHRcdD8gb3ZlcnZpZXdSdWxlckVycm9yXG5cdFx0XHQ6IG92ZXJ2aWV3UnVsZXJJbmZvO1xuXG5cdFx0aWYgKHJ1bGVyQ29sb3IpIHtcblx0XHRcdG9wdGlvbnMub3ZlcnZpZXdSdWxlciA9IHsgY29sb3I6IHRoZW1lQ29sb3JGcm9tSWQocnVsZXJDb2xvciksIHBvc2l0aW9uOiBPdmVydmlld1J1bGVyTGFuZS5SaWdodCB9O1xuXHRcdH1cblxuXHRcdGNvbnN0IGxpbmVMZW5ndGggPSB0ZXh0TW9kZWwuZ2V0TGluZUxlbmd0aCh0aGlzLmxpbmUpO1xuXHRcdGNvbnN0IGNvbHVtbiA9IGxpbmVMZW5ndGggPyAobGluZUxlbmd0aCArIDEpIDogbG9jYXRpb24ucmFuZ2UuZW5kQ29sdW1uO1xuXHRcdHRoaXMuZWRpdG9yRGVjb3JhdGlvbiA9IHtcblx0XHRcdG9wdGlvbnMsXG5cdFx0XHRyYW5nZToge1xuXHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IHRoaXMubGluZSxcblx0XHRcdFx0c3RhcnRDb2x1bW46IGNvbHVtbixcblx0XHRcdFx0ZW5kQ29sdW1uOiBjb2x1bW4sXG5cdFx0XHRcdGVuZExpbmVOdW1iZXI6IHRoaXMubGluZSxcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0Y2xpY2soZTogSUVkaXRvck1vdXNlRXZlbnQpOiBib29sZWFuIHtcblx0XHRpZiAoZS5ldmVudC5yaWdodEJ1dHRvbikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5tZXNzYWdlVXJpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKGUudGFyZ2V0LmVsZW1lbnQ/LmNsYXNzTmFtZS5pbmNsdWRlcyh0aGlzLmNvbnRlbnRJZENsYXNzKSkge1xuXHRcdFx0dGhpcy5wZWVrT3BlbmVyLnBlZWtVcmkodGhpcy5tZXNzYWdlVXJpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRnZXRDb250ZXh0TWVudUFjdGlvbnMoKSB7XG5cdFx0cmV0dXJuIHsgb2JqZWN0OiBbXSwgZGlzcG9zZTogKCkgPT4geyB9IH07XG5cdH1cbn1cblxuY29uc3QgRVJST1JfQ09OVEVOVF9XSURHRVRfSEVJR0hUID0gMjA7XG5cbmNsYXNzIFRlc3RFcnJvckNvbnRlbnRXaWRnZXQgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNvbnRlbnRXaWRnZXQge1xuXHRwcml2YXRlIHJlYWRvbmx5IGlkID0gZ2VuZXJhdGVVdWlkKCk7XG5cblx0LyoqIEBpbmhlcml0ZG9jICovXG5cdHB1YmxpYyByZWFkb25seSBhbGxvd0VkaXRvck92ZXJmbG93ID0gZmFsc2U7XG5cblx0cHJpdmF0ZSByZWFkb25seSBub2RlID0gZG9tLmgoJ2Rpdi50ZXN0LWVycm9yLWNvbnRlbnQtd2lkZ2V0JywgW1xuXHRcdGRvbS5oKCdkaXYuaW5uZXJAaW5uZXInLCBbXG5cdFx0XHRkb20uaCgnZGl2LmFycm93QGFycm93JyksXG5cdFx0XHRkb20uaChgc3BhbiR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IodGVzdGluZ1N0YXRlc1RvSWNvbnMuZ2V0KFRlc3RSZXN1bHRTdGF0ZS5GYWlsZWQpISl9YCksXG5cdFx0XHRkb20uaCgnc3Bhbi5jb250ZW50QG5hbWUnKSxcblx0XHRdKSxcblx0XSk7XG5cblx0cHVibGljIGdldCBsaW5lKCkge1xuXHRcdHJldHVybiB0aGlzLnBvc2l0aW9uLmxpbmVOdW1iZXI7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0cHJpdmF0ZSBwb3NpdGlvbjogUG9zaXRpb24sXG5cdFx0cHVibGljIHJlYWRvbmx5IG1lc3NhZ2U6IElUZXN0RXJyb3JNZXNzYWdlLFxuXHRcdHB1YmxpYyByZWFkb25seSByZXN1bHRJdGVtOiBUZXN0UmVzdWx0SXRlbSxcblx0XHR1cmk6IFVSSSxcblx0XHRASVRlc3RpbmdQZWVrT3BlbmVyIHJlYWRvbmx5IHBlZWtPcGVuZXI6IElUZXN0aW5nUGVla09wZW5lcixcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IHNldE1hcmdpblRvcCA9ICgpID0+IHtcblx0XHRcdGNvbnN0IGxpbmVIZWlnaHQgPSBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHRcdHRoaXMubm9kZS5yb290LnN0eWxlLm1hcmdpblRvcCA9IChsaW5lSGVpZ2h0IC0gRVJST1JfQ09OVEVOVF9XSURHRVRfSEVJR0hUKSAvIDIgKyAncHgnO1xuXHRcdH07XG5cblx0XHRzZXRNYXJnaW5Ub3AoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3Iub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ubGluZUhlaWdodCkpIHtcblx0XHRcdFx0c2V0TWFyZ2luVG9wKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0bGV0IHRleHQ6IHN0cmluZztcblx0XHRpZiAobWVzc2FnZS5leHBlY3RlZCAhPT0gdW5kZWZpbmVkICYmIG1lc3NhZ2UuYWN0dWFsICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRleHQgPSBgJHt0cnVuY2F0ZU1pZGRsZShtZXNzYWdlLmFjdHVhbC5yZXBsYWNlKC9cXHMrL2csICcgJyksIDMwKX0gIT0gJHt0cnVuY2F0ZU1pZGRsZShtZXNzYWdlLmV4cGVjdGVkLnJlcGxhY2UoL1xccysvZywgJyAnKSwgMzApfWA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IG1zZyA9IHJlbmRlclN0cmluZ0FzUGxhaW50ZXh0KG1lc3NhZ2UubWVzc2FnZSk7XG5cdFx0XHRjb25zdCBsZiA9IG1zZy5pbmRleE9mKCdcXG4nKTtcblx0XHRcdHRleHQgPSBsZiA9PT0gLTEgPyBtc2cgOiBtc2cuc2xpY2UoMCwgbGYpO1xuXHRcdH1cblxuXHRcdHRoaXMubm9kZS5yb290LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XG5cdFx0XHR0aGlzLnBlZWtPcGVuZXIucGVla1VyaSh1cmkpO1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgY3RybCA9IFRlc3RpbmdPdXRwdXRQZWVrQ29udHJvbGxlci5nZXQoZWRpdG9yKTtcblx0XHRpZiAoY3RybCkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHRjb25zdCBzdWJqZWN0ID0gY3RybC5zdWJqZWN0LnJlYWQocmVhZGVyKTtcblx0XHRcdFx0Y29uc3QgaXNDdXJyZW50ID0gc3ViamVjdCBpbnN0YW5jZW9mIE1lc3NhZ2VTdWJqZWN0ICYmIHN1YmplY3QubWVzc2FnZSA9PT0gbWVzc2FnZTtcblx0XHRcdFx0dGhpcy5ub2RlLnJvb3QuY2xhc3NMaXN0LnRvZ2dsZSgnaXMtY3VycmVudCcsIGlzQ3VycmVudCk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5ub2RlLm5hbWUuaW5uZXJUZXh0ID0gdGV4dCB8fCAnVGVzdCBGYWlsZWQnO1xuXG5cdFx0Y29uc3Qgc3ZnID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKCdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZycsICdzdmcnKTtcblx0XHRzdmcuc2V0QXR0cmlidXRlKCd3aWR0aCcsICcxNScpO1xuXHRcdHN2Zy5zZXRBdHRyaWJ1dGUoJ2hlaWdodCcsICcxMCcpO1xuXHRcdHN2Zy5zZXRBdHRyaWJ1dGUoJ3ByZXNlcnZlQXNwZWN0UmF0aW8nLCAnbm9uZScpO1xuXHRcdHN2Zy5zZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnLCAnMCAwIDE1IDEwJyk7XG5cblx0XHRjb25zdCBsZWZ0QXJyb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJywgJ3BhdGgnKTtcblx0XHRsZWZ0QXJyb3cuc2V0QXR0cmlidXRlKCdkJywgJ00xNSAwIEwxMCAwIEwwIDUgTDEwIDEwIEwxNSAxMCBaJyk7XG5cdFx0c3ZnLmFwcGVuZChsZWZ0QXJyb3cpO1xuXG5cdFx0dGhpcy5ub2RlLmFycm93LmFwcGVuZENoaWxkKHN2Zyk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3Iub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQoZSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGMgb2YgZS5jaGFuZ2VzKSB7XG5cdFx0XHRcdGlmIChjLnJhbmdlLnN0YXJ0TGluZU51bWJlciA+IHRoaXMubGluZSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChcblx0XHRcdFx0XHRjLnJhbmdlLnN0YXJ0TGluZU51bWJlciA8PSB0aGlzLmxpbmUgJiYgYy5yYW5nZS5lbmRMaW5lTnVtYmVyID49IHRoaXMubGluZVxuXHRcdFx0XHRcdHx8IChyZXN1bHRJdGVtLml0ZW0ucmFuZ2UgJiYgcmVzdWx0SXRlbS5pdGVtLnJhbmdlLnN0YXJ0TGluZU51bWJlciA8PSBjLnJhbmdlLnN0YXJ0TGluZU51bWJlciAmJiByZXN1bHRJdGVtLml0ZW0ucmFuZ2UuZW5kTGluZU51bWJlciA+PSBjLnJhbmdlLmVuZExpbmVOdW1iZXIpXG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdFRlc3RpbmdEZWNvcmF0aW9ucy5pbnZhbGlkYXRlZFRlc3RzLmFkZCh0aGlzLnJlc3VsdEl0ZW0pO1xuXHRcdFx0XHRcdHRoaXMuZGlzcG9zZSgpOyAvLyB0b2RvXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBhZGp1c3QgPSBjb3VudChjLnRleHQsICdcXG4nKSAtIChjLnJhbmdlLmVuZExpbmVOdW1iZXIgLSBjLnJhbmdlLnN0YXJ0TGluZU51bWJlcik7XG5cdFx0XHRcdGlmIChhZGp1c3QgIT09IDApIHtcblx0XHRcdFx0XHR0aGlzLnBvc2l0aW9uID0gdGhpcy5wb3NpdGlvbi5kZWx0YShhZGp1c3QpO1xuXHRcdFx0XHRcdHRoaXMuZWRpdG9yLmxheW91dENvbnRlbnRXaWRnZXQodGhpcyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRlZGl0b3IuYWRkQ29udGVudFdpZGdldCh0aGlzKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gZWRpdG9yLnJlbW92ZUNvbnRlbnRXaWRnZXQodGhpcykpKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmlkO1xuXHR9XG5cblx0cHVibGljIGdldERvbU5vZGUoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLm5vZGUucm9vdDtcblx0fVxuXG5cdHB1YmxpYyBnZXRQb3NpdGlvbigpOiBJQ29udGVudFdpZGdldFBvc2l0aW9uIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHBvc2l0aW9uOiB0aGlzLnBvc2l0aW9uLFxuXHRcdFx0cHJlZmVyZW5jZTogW0NvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuRVhBQ1RdLFxuXHRcdH07XG5cdH1cblxuXHRhZnRlclJlbmRlcihfcG9zaXRpb246IENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UgfCBudWxsLCBjb29yZGluYXRlOiBJQ29udGVudFdpZGdldFJlbmRlcmVkQ29vcmRpbmF0ZSB8IG51bGwpOiB2b2lkIHtcblx0XHRpZiAoY29vcmRpbmF0ZSkge1xuXHRcdFx0Y29uc3QgeyB2ZXJ0aWNhbFNjcm9sbGJhcldpZHRoIH0gPSB0aGlzLmVkaXRvci5nZXRMYXlvdXRJbmZvKCk7XG5cdFx0XHRjb25zdCBzY3JvbGxXaWR0aCA9IHRoaXMuZWRpdG9yLmdldFNjcm9sbFdpZHRoKCk7XG5cdFx0XHR0aGlzLm5vZGUuaW5uZXIuc3R5bGUubWF4V2lkdGggPSBgJHtzY3JvbGxXaWR0aCAtIHZlcnRpY2FsU2Nyb2xsYmFyV2lkdGggLSBjb29yZGluYXRlLmxlZnQgLSAyMH1weGA7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLFFBQWlCLFdBQVcscUJBQXFCO0FBQzFELFNBQVMsY0FBYztBQUN2QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUEwQixzQkFBc0I7QUFDaEQsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWSxlQUFlLGlCQUE2QixtQkFBbUIsb0JBQW9CO0FBQ3hHLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxPQUFPLHNCQUFzQjtBQUN0QyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGlCQUFpQjtBQUUxQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGlDQUEySSx1QkFBdUI7QUFDM0ssU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxvQkFBb0IseUJBQXlCO0FBQ3RELFNBQVMsZ0JBQWdCO0FBR3pCLFNBQVMsaUJBQThHLG1CQUFtQiw4QkFBOEI7QUFDeEssU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyxjQUFjLGNBQWM7QUFDckMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyw2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Qy9CLFFBQUksYUFBYSx1QkFBdUIsTUFBTTtBQUM5QyxRQUFJLGFBQWEsV0FBVyxXQUFXO0FBRXZDLFVBQU0sWUFBWSxTQUFTLGdCQUFnQiw4QkFBOEIsTUFBTTtBQUMvRSxjQUFVLGFBQWEsS0FBSyxrQ0FBa0M7QUFDOUQsUUFBSSxPQUFPLFNBQVM7QUFFcEIsU0FBSyxLQUFLLE1BQU0sWUFBWSxHQUFHO0FBRS9CLFNBQUssVUFBVSxPQUFPLHdCQUF3QixPQUFLO0FBQ2xELGlCQUFXLEtBQUssRUFBRSxTQUFTO0FBQzFCLFlBQUksRUFBRSxNQUFNLGtCQUFrQixLQUFLLE1BQU07QUFDeEM7QUFBQSxRQUNEO0FBQ0EsWUFDQyxFQUFFLE1BQU0sbUJBQW1CLEtBQUssUUFBUSxFQUFFLE1BQU0saUJBQWlCLEtBQUssUUFDbEUsV0FBVyxLQUFLLFNBQVMsV0FBVyxLQUFLLE1BQU0sbUJBQW1CLEVBQUUsTUFBTSxtQkFBbUIsV0FBVyxLQUFLLE1BQU0saUJBQWlCLEVBQUUsTUFBTSxlQUMvSTtBQUNELDZCQUFtQixpQkFBaUIsSUFBSSxLQUFLLFVBQVU7QUFDdkQsZUFBSyxRQUFRO0FBQUEsUUFDZDtBQUVBLGNBQU0sU0FBUyxNQUFNLEVBQUUsTUFBTSxJQUFJLEtBQUssRUFBRSxNQUFNLGdCQUFnQixFQUFFLE1BQU07QUFDdEUsWUFBSSxXQUFXLEdBQUc7QUFDakIsZUFBSyxXQUFXLEtBQUssU0FBUyxNQUFNLE1BQU07QUFDMUMsZUFBSyxPQUFPLG9CQUFvQixJQUFJO0FBQUEsUUFDckM7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixXQUFPLGlCQUFpQixJQUFJO0FBQzVCLFNBQUssVUFBVSxhQUFhLE1BQU0sT0FBTyxvQkFBb0IsSUFBSSxDQUFDLENBQUM7QUFBQSxFQUNwRTtBQUFBLEVBdEZBLElBQVcsT0FBTztBQUNqQixXQUFPLEtBQUssU0FBUztBQUFBLEVBQ3RCO0FBQUEsRUFzRk8sUUFBZ0I7QUFDdEIsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRU8sYUFBMEI7QUFDaEMsV0FBTyxLQUFLLEtBQUs7QUFBQSxFQUNsQjtBQUFBLEVBRU8sY0FBNkM7QUFDbkQsV0FBTztBQUFBLE1BQ04sVUFBVSxLQUFLO0FBQUEsTUFDZixZQUFZLENBQUMsZ0NBQWdDLEtBQUs7QUFBQSxJQUNuRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLFlBQVksV0FBbUQsWUFBMkQ7QUFDekgsUUFBSSxZQUFZO0FBQ2YsWUFBTSxFQUFFLHVCQUF1QixJQUFJLEtBQUssT0FBTyxjQUFjO0FBQzdELFlBQU0sY0FBYyxLQUFLLE9BQU8sZUFBZTtBQUMvQyxXQUFLLEtBQUssTUFBTSxNQUFNLFdBQVcsR0FBRyxjQUFjLHlCQUF5QixXQUFXLE9BQU8sRUFBRTtBQUFBLElBQ2hHO0FBQUEsRUFDRDtBQUNEO0FBNUhNLHlCQUFOO0FBQUEsRUF3Qkc7QUFBQSxHQXhCRzsiLAogICJuYW1lcyI6IFsibmV3RGVjb3JhdGlvbnMiLCAiTGVuc0NvbnRlbnRXaWRnZXRWYXJzIiwgImUiXQp9Cg==
