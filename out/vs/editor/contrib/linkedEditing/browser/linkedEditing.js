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
import * as arrays from "../../../../base/common/arrays.js";
import { Delayer, first } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Color } from "../../../../base/common/color.js";
import { isCancellationError, onUnexpectedError, onUnexpectedExternalError } from "../../../../base/common/errors.js";
import { Event } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import * as strings from "../../../../base/common/strings.js";
import { URI } from "../../../../base/common/uri.js";
import { EditorAction, EditorCommand, EditorContributionInstantiation, registerEditorAction, registerEditorCommand, registerEditorContribution, registerModelAndPositionCommand } from "../../../browser/editorExtensions.js";
import { ICodeEditorService } from "../../../browser/services/codeEditorService.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { TrackedRangeStickiness } from "../../../common/model.js";
import { ModelDecorationOptions } from "../../../common/model/textModel.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import * as nls from "../../../../nls.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { registerColor } from "../../../../platform/theme/common/colorRegistry.js";
import { ILanguageFeatureDebounceService } from "../../../common/services/languageFeatureDebounce.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import "./linkedEditing.css";
const CONTEXT_ONTYPE_RENAME_INPUT_VISIBLE = new RawContextKey("LinkedEditingInputVisible", false);
const DECORATION_CLASS_NAME = "linked-editing-decoration";
let LinkedEditingContribution = class extends Disposable {
  constructor(editor, contextKeyService, languageFeaturesService, languageConfigurationService, languageFeatureDebounceService) {
    super();
    this.languageConfigurationService = languageConfigurationService;
    // The one at index 0 is the reference one
    this._syncRangesToken = 0;
    this._localToDispose = this._register(new DisposableStore());
    this._editor = editor;
    this._providers = languageFeaturesService.linkedEditingRangeProvider;
    this._enabled = false;
    this._visibleContextKey = CONTEXT_ONTYPE_RENAME_INPUT_VISIBLE.bindTo(contextKeyService);
    this._debounceInformation = languageFeatureDebounceService.for(this._providers, "Linked Editing", { max: 200 });
    this._currentDecorations = this._editor.createDecorationsCollection();
    this._languageWordPattern = null;
    this._currentWordPattern = null;
    this._ignoreChangeEvent = false;
    this._localToDispose = this._register(new DisposableStore());
    this._rangeUpdateTriggerPromise = null;
    this._rangeSyncTriggerPromise = null;
    this._currentRequestCts = null;
    this._currentRequestPosition = null;
    this._currentRequestModelVersion = null;
    this._register(this._editor.onDidChangeModel(() => this.reinitialize(true)));
    this._register(this._editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.linkedEditing) || e.hasChanged(EditorOption.renameOnType)) {
        this.reinitialize(false);
      }
    }));
    this._register(this._providers.onDidChange(() => this.reinitialize(false)));
    this._register(this._editor.onDidChangeModelLanguage(() => this.reinitialize(true)));
    this.reinitialize(true);
  }
  static get(editor) {
    return editor.getContribution(LinkedEditingContribution.ID);
  }
  reinitialize(forceRefresh) {
    const model = this._editor.getModel();
    const isEnabled = model !== null && (this._editor.getOption(EditorOption.linkedEditing) || this._editor.getOption(EditorOption.renameOnType)) && this._providers.has(model);
    if (isEnabled === this._enabled && !forceRefresh) {
      return;
    }
    this._enabled = isEnabled;
    this.clearRanges();
    this._localToDispose.clear();
    if (!isEnabled || model === null) {
      return;
    }
    this._localToDispose.add(
      Event.runAndSubscribe(
        model.onDidChangeLanguageConfiguration,
        () => {
          this._languageWordPattern = this.languageConfigurationService.getLanguageConfiguration(model.getLanguageId()).getWordDefinition();
        }
      )
    );
    const rangeUpdateScheduler = new Delayer(this._debounceInformation.get(model));
    const triggerRangeUpdate = () => {
      this._rangeUpdateTriggerPromise = rangeUpdateScheduler.trigger(() => this.updateRanges(), this._debounceDuration ?? this._debounceInformation.get(model));
    };
    const rangeSyncScheduler = new Delayer(0);
    const triggerRangeSync = (token) => {
      this._rangeSyncTriggerPromise = rangeSyncScheduler.trigger(() => this._syncRanges(token));
    };
    this._localToDispose.add(this._editor.onDidChangeCursorPosition(() => {
      triggerRangeUpdate();
    }));
    this._localToDispose.add(this._editor.onDidChangeModelContent((e) => {
      if (!this._ignoreChangeEvent) {
        if (this._currentDecorations.length > 0) {
          const referenceRange = this._currentDecorations.getRange(0);
          if (referenceRange && e.changes.every((c) => referenceRange.intersectRanges(c.range))) {
            triggerRangeSync(this._syncRangesToken);
            return;
          }
        }
      }
      triggerRangeUpdate();
    }));
    this._localToDispose.add({
      dispose: () => {
        rangeUpdateScheduler.dispose();
        rangeSyncScheduler.dispose();
      }
    });
    this.updateRanges();
  }
  _syncRanges(token) {
    if (!this._editor.hasModel() || token !== this._syncRangesToken || this._currentDecorations.length === 0) {
      return;
    }
    const model = this._editor.getModel();
    const referenceRange = this._currentDecorations.getRange(0);
    if (!referenceRange || referenceRange.startLineNumber !== referenceRange.endLineNumber) {
      return this.clearRanges();
    }
    const referenceValue = model.getValueInRange(referenceRange);
    if (this._currentWordPattern) {
      const match = referenceValue.match(this._currentWordPattern);
      const matchLength = match ? match[0].length : 0;
      if (matchLength !== referenceValue.length) {
        return this.clearRanges();
      }
    }
    const edits = [];
    for (let i = 1, len = this._currentDecorations.length; i < len; i++) {
      const mirrorRange = this._currentDecorations.getRange(i);
      if (!mirrorRange) {
        continue;
      }
      if (mirrorRange.startLineNumber !== mirrorRange.endLineNumber) {
        edits.push({
          range: mirrorRange,
          text: referenceValue
        });
      } else {
        let oldValue = model.getValueInRange(mirrorRange);
        let newValue = referenceValue;
        let rangeStartColumn = mirrorRange.startColumn;
        let rangeEndColumn = mirrorRange.endColumn;
        const commonPrefixLength = strings.commonPrefixLength(oldValue, newValue);
        rangeStartColumn += commonPrefixLength;
        oldValue = oldValue.substr(commonPrefixLength);
        newValue = newValue.substr(commonPrefixLength);
        const commonSuffixLength = strings.commonSuffixLength(oldValue, newValue);
        rangeEndColumn -= commonSuffixLength;
        oldValue = oldValue.substr(0, oldValue.length - commonSuffixLength);
        newValue = newValue.substr(0, newValue.length - commonSuffixLength);
        if (rangeStartColumn !== rangeEndColumn || newValue.length !== 0) {
          edits.push({
            range: new Range(mirrorRange.startLineNumber, rangeStartColumn, mirrorRange.endLineNumber, rangeEndColumn),
            text: newValue
          });
        }
      }
    }
    if (edits.length === 0) {
      return;
    }
    try {
      this._editor.popUndoStop();
      this._ignoreChangeEvent = true;
      const prevEditOperationType = this._editor._getViewModel().getPrevEditOperationType();
      this._editor.executeEdits("linkedEditing", edits);
      this._editor._getViewModel().setPrevEditOperationType(prevEditOperationType);
    } finally {
      this._ignoreChangeEvent = false;
    }
  }
  dispose() {
    this.clearRanges();
    super.dispose();
  }
  clearRanges() {
    this._visibleContextKey.set(false);
    this._currentDecorations.clear();
    if (this._currentRequestCts) {
      this._currentRequestCts.cancel();
      this._currentRequestCts = null;
      this._currentRequestPosition = null;
    }
  }
  get currentUpdateTriggerPromise() {
    return this._rangeUpdateTriggerPromise || Promise.resolve();
  }
  get currentSyncTriggerPromise() {
    return this._rangeSyncTriggerPromise || Promise.resolve();
  }
  async updateRanges(force = false) {
    if (!this._editor.hasModel()) {
      this.clearRanges();
      return;
    }
    const position = this._editor.getPosition();
    if (!this._enabled && !force || this._editor.getSelections().length > 1) {
      this.clearRanges();
      return;
    }
    const model = this._editor.getModel();
    const modelVersionId = model.getVersionId();
    if (this._currentRequestPosition && this._currentRequestModelVersion === modelVersionId) {
      if (position.equals(this._currentRequestPosition)) {
        return;
      }
      if (this._currentDecorations.length > 0) {
        const range = this._currentDecorations.getRange(0);
        if (range && range.containsPosition(position)) {
          return;
        }
      }
    }
    this.clearRanges();
    this._currentRequestPosition = position;
    this._currentRequestModelVersion = modelVersionId;
    const currentRequestCts = this._currentRequestCts = new CancellationTokenSource();
    try {
      const sw = new StopWatch(false);
      const response = await getLinkedEditingRanges(this._providers, model, position, currentRequestCts.token);
      this._debounceInformation.update(model, sw.elapsed());
      if (currentRequestCts !== this._currentRequestCts) {
        return;
      }
      this._currentRequestCts = null;
      if (modelVersionId !== model.getVersionId()) {
        return;
      }
      let ranges = [];
      if (response?.ranges) {
        ranges = response.ranges;
      }
      this._currentWordPattern = response?.wordPattern || this._languageWordPattern;
      let foundReferenceRange = false;
      for (let i = 0, len = ranges.length; i < len; i++) {
        if (Range.containsPosition(ranges[i], position)) {
          foundReferenceRange = true;
          if (i !== 0) {
            const referenceRange = ranges[i];
            ranges.splice(i, 1);
            ranges.unshift(referenceRange);
          }
          break;
        }
      }
      if (!foundReferenceRange) {
        this.clearRanges();
        return;
      }
      const decorations = ranges.map((range) => ({ range, options: LinkedEditingContribution.DECORATION }));
      this._visibleContextKey.set(true);
      this._currentDecorations.set(decorations);
      this._syncRangesToken++;
    } catch (err) {
      if (!isCancellationError(err)) {
        onUnexpectedError(err);
      }
      if (this._currentRequestCts === currentRequestCts || !this._currentRequestCts) {
        this.clearRanges();
      }
    }
  }
  // for testing
  setDebounceDuration(timeInMS) {
    this._debounceDuration = timeInMS;
  }
  // private printDecorators(model: ITextModel) {
  // 	return this._currentDecorations.map(d => {
  // 		const range = model.getDecorationRange(d);
  // 		if (range) {
  // 			return this.printRange(range);
  // 		}
  // 		return 'invalid';
  // 	}).join(',');
  // }
  // private printChanges(changes: IModelContentChange[]) {
  // 	return changes.map(c => {
  // 		return `${this.printRange(c.range)} - ${c.text}`;
  // 	}
  // 	).join(',');
  // }
  // private printRange(range: IRange) {
  // 	return `${range.startLineNumber},${range.startColumn}/${range.endLineNumber},${range.endColumn}`;
  // }
};
LinkedEditingContribution.ID = "editor.contrib.linkedEditing";
LinkedEditingContribution.DECORATION = ModelDecorationOptions.register({
  description: "linked-editing",
  stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
  className: DECORATION_CLASS_NAME
});
LinkedEditingContribution = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, ILanguageFeaturesService),
  __decorateParam(3, ILanguageConfigurationService),
  __decorateParam(4, ILanguageFeatureDebounceService)
], LinkedEditingContribution);
class LinkedEditingAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.linkedEditing",
      label: nls.localize2("linkedEditing.label", "Start Linked Editing"),
      precondition: ContextKeyExpr.and(EditorContextKeys.writable, EditorContextKeys.hasRenameProvider),
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.F2,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  runCommand(accessor, args) {
    const editorService = accessor.get(ICodeEditorService);
    const [uri, pos] = Array.isArray(args) && args || [void 0, void 0];
    if (URI.isUri(uri) && Position.isIPosition(pos)) {
      return editorService.openCodeEditor({ resource: uri }, editorService.getActiveCodeEditor()).then((editor) => {
        if (!editor) {
          return;
        }
        editor.setPosition(pos);
        editor.invokeWithinContext((accessor2) => {
          this.reportTelemetry(accessor2, editor);
          return this.run(accessor2, editor);
        });
      }, onUnexpectedError);
    }
    return super.runCommand(accessor, args);
  }
  run(_accessor, editor) {
    const controller = LinkedEditingContribution.get(editor);
    if (controller) {
      return Promise.resolve(controller.updateRanges(true));
    }
    return Promise.resolve();
  }
}
const LinkedEditingCommand = EditorCommand.bindToContribution(LinkedEditingContribution.get);
registerEditorCommand(new LinkedEditingCommand({
  id: "cancelLinkedEditingInput",
  precondition: CONTEXT_ONTYPE_RENAME_INPUT_VISIBLE,
  handler: (x) => x.clearRanges(),
  kbOpts: {
    kbExpr: EditorContextKeys.editorTextFocus,
    weight: KeybindingWeight.EditorContrib + 99,
    primary: KeyCode.Escape,
    secondary: [KeyMod.Shift | KeyCode.Escape]
  }
}));
function getLinkedEditingRanges(providers, model, position, token) {
  const orderedByScore = providers.ordered(model);
  return first(orderedByScore.map((provider) => async () => {
    try {
      return await provider.provideLinkedEditingRanges(model, position, token);
    } catch (e) {
      onUnexpectedExternalError(e);
      return void 0;
    }
  }), (result) => !!result && arrays.isNonEmptyArray(result?.ranges));
}
const editorLinkedEditingBackground = registerColor("editor.linkedEditingBackground", { dark: Color.fromHex("#f00").transparent(0.3), light: Color.fromHex("#f00").transparent(0.3), hcDark: Color.fromHex("#f00").transparent(0.3), hcLight: Color.white }, nls.localize("editorLinkedEditingBackground", "Background color when the editor auto renames on type."));
registerModelAndPositionCommand("_executeLinkedEditingProvider", (_accessor, model, position) => {
  const { linkedEditingRangeProvider } = _accessor.get(ILanguageFeaturesService);
  return getLinkedEditingRanges(linkedEditingRangeProvider, model, position, CancellationToken.None);
});
registerEditorContribution(LinkedEditingContribution.ID, LinkedEditingContribution, EditorContributionInstantiation.AfterFirstRender);
registerEditorAction(LinkedEditingAction);
export {
  CONTEXT_ONTYPE_RENAME_INPUT_VISIBLE,
  LinkedEditingAction,
  LinkedEditingContribution,
  editorLinkedEditingBackground
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9saW5rZWRFZGl0aW5nL2Jyb3dzZXIvbGlua2VkRWRpdGluZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGFycmF5cyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgRGVsYXllciwgZmlyc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBpc0NhbmNlbGxhdGlvbkVycm9yLCBvblVuZXhwZWN0ZWRFcnJvciwgb25VbmV4cGVjdGVkRXh0ZXJuYWxFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgKiBhcyBzdHJpbmdzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGlvbiwgRWRpdG9yQ29tbWFuZCwgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbiwgcmVnaXN0ZXJFZGl0b3JBY3Rpb24sIHJlZ2lzdGVyRWRpdG9yQ29tbWFuZCwgcmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24sIHJlZ2lzdGVyTW9kZWxBbmRQb3NpdGlvbkNvbW1hbmQsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSVBvc2l0aW9uLCBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IElSYW5nZSwgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJpYnV0aW9uLCBJRWRpdG9yRGVjb3JhdGlvbnNDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJTW9kZWxEZWx0YURlY29yYXRpb24sIElUZXh0TW9kZWwsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgTGlua2VkRWRpdGluZ1JhbmdlUHJvdmlkZXIsIExpbmtlZEVkaXRpbmdSYW5nZXMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlLCBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckNvbG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVNpbmdsZUVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9lZGl0T3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IElGZWF0dXJlRGVib3VuY2VJbmZvcm1hdGlvbiwgSUxhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVEZWJvdW5jZS5qcyc7XG5pbXBvcnQgeyBTdG9wV2F0Y2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdG9wd2F0Y2guanMnO1xuaW1wb3J0ICcuL2xpbmtlZEVkaXRpbmcuY3NzJztcblxuZXhwb3J0IGNvbnN0IENPTlRFWFRfT05UWVBFX1JFTkFNRV9JTlBVVF9WSVNJQkxFID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ0xpbmtlZEVkaXRpbmdJbnB1dFZpc2libGUnLCBmYWxzZSk7XG5cbmNvbnN0IERFQ09SQVRJT05fQ0xBU1NfTkFNRSA9ICdsaW5rZWQtZWRpdGluZy1kZWNvcmF0aW9uJztcblxuZXhwb3J0IGNsYXNzIExpbmtlZEVkaXRpbmdDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUVkaXRvckNvbnRyaWJ1dGlvbiB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuY29udHJpYi5saW5rZWRFZGl0aW5nJztcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBERUNPUkFUSU9OID0gTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7XG5cdFx0ZGVzY3JpcHRpb246ICdsaW5rZWQtZWRpdGluZycsXG5cdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5BbHdheXNHcm93c1doZW5UeXBpbmdBdEVkZ2VzLFxuXHRcdGNsYXNzTmFtZTogREVDT1JBVElPTl9DTEFTU19OQU1FXG5cdH0pO1xuXG5cdHN0YXRpYyBnZXQoZWRpdG9yOiBJQ29kZUVkaXRvcik6IExpbmtlZEVkaXRpbmdDb250cmlidXRpb24gfCBudWxsIHtcblx0XHRyZXR1cm4gZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxMaW5rZWRFZGl0aW5nQ29udHJpYnV0aW9uPihMaW5rZWRFZGl0aW5nQ29udHJpYnV0aW9uLklEKTtcblx0fVxuXG5cdHByaXZhdGUgX2RlYm91bmNlRHVyYXRpb246IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm92aWRlcnM6IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5PExpbmtlZEVkaXRpbmdSYW5nZVByb3ZpZGVyPjtcblx0cHJpdmF0ZSBfZW5hYmxlZDogYm9vbGVhbjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF92aXNpYmxlQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlYm91bmNlSW5mb3JtYXRpb246IElGZWF0dXJlRGVib3VuY2VJbmZvcm1hdGlvbjtcblxuXHRwcml2YXRlIF9yYW5nZVVwZGF0ZVRyaWdnZXJQcm9taXNlOiBQcm9taXNlPGFueT4gfCBudWxsO1xuXHRwcml2YXRlIF9yYW5nZVN5bmNUcmlnZ2VyUHJvbWlzZTogUHJvbWlzZTxhbnk+IHwgbnVsbDtcblxuXHRwcml2YXRlIF9jdXJyZW50UmVxdWVzdEN0czogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfCBudWxsO1xuXHRwcml2YXRlIF9jdXJyZW50UmVxdWVzdFBvc2l0aW9uOiBQb3NpdGlvbiB8IG51bGw7XG5cdHByaXZhdGUgX2N1cnJlbnRSZXF1ZXN0TW9kZWxWZXJzaW9uOiBudW1iZXIgfCBudWxsO1xuXG5cdHByaXZhdGUgX2N1cnJlbnREZWNvcmF0aW9uczogSUVkaXRvckRlY29yYXRpb25zQ29sbGVjdGlvbjsgLy8gVGhlIG9uZSBhdCBpbmRleCAwIGlzIHRoZSByZWZlcmVuY2Ugb25lXG5cdHByaXZhdGUgX3N5bmNSYW5nZXNUb2tlbjogbnVtYmVyID0gMDtcblxuXHRwcml2YXRlIF9sYW5ndWFnZVdvcmRQYXR0ZXJuOiBSZWdFeHAgfCBudWxsO1xuXHRwcml2YXRlIF9jdXJyZW50V29yZFBhdHRlcm46IFJlZ0V4cCB8IG51bGw7XG5cdHByaXZhdGUgX2lnbm9yZUNoYW5nZUV2ZW50OiBib29sZWFuO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2xvY2FsVG9EaXNwb3NlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UgbGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fZWRpdG9yID0gZWRpdG9yO1xuXHRcdHRoaXMuX3Byb3ZpZGVycyA9IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmxpbmtlZEVkaXRpbmdSYW5nZVByb3ZpZGVyO1xuXHRcdHRoaXMuX2VuYWJsZWQgPSBmYWxzZTtcblx0XHR0aGlzLl92aXNpYmxlQ29udGV4dEtleSA9IENPTlRFWFRfT05UWVBFX1JFTkFNRV9JTlBVVF9WSVNJQkxFLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fZGVib3VuY2VJbmZvcm1hdGlvbiA9IGxhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZS5mb3IodGhpcy5fcHJvdmlkZXJzLCAnTGlua2VkIEVkaXRpbmcnLCB7IG1heDogMjAwIH0pO1xuXG5cdFx0dGhpcy5fY3VycmVudERlY29yYXRpb25zID0gdGhpcy5fZWRpdG9yLmNyZWF0ZURlY29yYXRpb25zQ29sbGVjdGlvbigpO1xuXHRcdHRoaXMuX2xhbmd1YWdlV29yZFBhdHRlcm4gPSBudWxsO1xuXHRcdHRoaXMuX2N1cnJlbnRXb3JkUGF0dGVybiA9IG51bGw7XG5cdFx0dGhpcy5faWdub3JlQ2hhbmdlRXZlbnQgPSBmYWxzZTtcblx0XHR0aGlzLl9sb2NhbFRvRGlzcG9zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0XHR0aGlzLl9yYW5nZVVwZGF0ZVRyaWdnZXJQcm9taXNlID0gbnVsbDtcblx0XHR0aGlzLl9yYW5nZVN5bmNUcmlnZ2VyUHJvbWlzZSA9IG51bGw7XG5cblx0XHR0aGlzLl9jdXJyZW50UmVxdWVzdEN0cyA9IG51bGw7XG5cdFx0dGhpcy5fY3VycmVudFJlcXVlc3RQb3NpdGlvbiA9IG51bGw7XG5cdFx0dGhpcy5fY3VycmVudFJlcXVlc3RNb2RlbFZlcnNpb24gPSBudWxsO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWwoKCkgPT4gdGhpcy5yZWluaXRpYWxpemUodHJ1ZSkpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5saW5rZWRFZGl0aW5nKSB8fCBlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLnJlbmFtZU9uVHlwZSkpIHtcblx0XHRcdFx0dGhpcy5yZWluaXRpYWxpemUoZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9wcm92aWRlcnMub25EaWRDaGFuZ2UoKCkgPT4gdGhpcy5yZWluaXRpYWxpemUoZmFsc2UpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxMYW5ndWFnZSgoKSA9PiB0aGlzLnJlaW5pdGlhbGl6ZSh0cnVlKSkpO1xuXG5cdFx0dGhpcy5yZWluaXRpYWxpemUodHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIHJlaW5pdGlhbGl6ZShmb3JjZVJlZnJlc2g6IGJvb2xlYW4pIHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IGlzRW5hYmxlZCA9IG1vZGVsICE9PSBudWxsICYmICh0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5rZWRFZGl0aW5nKSB8fCB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5yZW5hbWVPblR5cGUpKSAmJiB0aGlzLl9wcm92aWRlcnMuaGFzKG1vZGVsKTtcblx0XHRpZiAoaXNFbmFibGVkID09PSB0aGlzLl9lbmFibGVkICYmICFmb3JjZVJlZnJlc2gpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9lbmFibGVkID0gaXNFbmFibGVkO1xuXG5cdFx0dGhpcy5jbGVhclJhbmdlcygpO1xuXHRcdHRoaXMuX2xvY2FsVG9EaXNwb3NlLmNsZWFyKCk7XG5cblx0XHRpZiAoIWlzRW5hYmxlZCB8fCBtb2RlbCA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2xvY2FsVG9EaXNwb3NlLmFkZChcblx0XHRcdEV2ZW50LnJ1bkFuZFN1YnNjcmliZShcblx0XHRcdFx0bW9kZWwub25EaWRDaGFuZ2VMYW5ndWFnZUNvbmZpZ3VyYXRpb24sXG5cdFx0XHRcdCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9sYW5ndWFnZVdvcmRQYXR0ZXJuID0gdGhpcy5sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldExhbmd1YWdlQ29uZmlndXJhdGlvbihtb2RlbC5nZXRMYW5ndWFnZUlkKCkpLmdldFdvcmREZWZpbml0aW9uKCk7XG5cdFx0XHRcdH1cblx0XHRcdClcblx0XHQpO1xuXG5cdFx0Y29uc3QgcmFuZ2VVcGRhdGVTY2hlZHVsZXIgPSBuZXcgRGVsYXllcih0aGlzLl9kZWJvdW5jZUluZm9ybWF0aW9uLmdldChtb2RlbCkpO1xuXHRcdGNvbnN0IHRyaWdnZXJSYW5nZVVwZGF0ZSA9ICgpID0+IHtcblx0XHRcdHRoaXMuX3JhbmdlVXBkYXRlVHJpZ2dlclByb21pc2UgPSByYW5nZVVwZGF0ZVNjaGVkdWxlci50cmlnZ2VyKCgpID0+IHRoaXMudXBkYXRlUmFuZ2VzKCksIHRoaXMuX2RlYm91bmNlRHVyYXRpb24gPz8gdGhpcy5fZGVib3VuY2VJbmZvcm1hdGlvbi5nZXQobW9kZWwpKTtcblx0XHR9O1xuXHRcdGNvbnN0IHJhbmdlU3luY1NjaGVkdWxlciA9IG5ldyBEZWxheWVyKDApO1xuXHRcdGNvbnN0IHRyaWdnZXJSYW5nZVN5bmMgPSAodG9rZW46IG51bWJlcikgPT4ge1xuXHRcdFx0dGhpcy5fcmFuZ2VTeW5jVHJpZ2dlclByb21pc2UgPSByYW5nZVN5bmNTY2hlZHVsZXIudHJpZ2dlcigoKSA9PiB0aGlzLl9zeW5jUmFuZ2VzKHRva2VuKSk7XG5cdFx0fTtcblx0XHR0aGlzLl9sb2NhbFRvRGlzcG9zZS5hZGQodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb24oKCkgPT4ge1xuXHRcdFx0dHJpZ2dlclJhbmdlVXBkYXRlKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX2xvY2FsVG9EaXNwb3NlLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQoKGUpID0+IHtcblx0XHRcdGlmICghdGhpcy5faWdub3JlQ2hhbmdlRXZlbnQpIHtcblx0XHRcdFx0aWYgKHRoaXMuX2N1cnJlbnREZWNvcmF0aW9ucy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVmZXJlbmNlUmFuZ2UgPSB0aGlzLl9jdXJyZW50RGVjb3JhdGlvbnMuZ2V0UmFuZ2UoMCk7XG5cdFx0XHRcdFx0aWYgKHJlZmVyZW5jZVJhbmdlICYmIGUuY2hhbmdlcy5ldmVyeShjID0+IHJlZmVyZW5jZVJhbmdlLmludGVyc2VjdFJhbmdlcyhjLnJhbmdlKSkpIHtcblx0XHRcdFx0XHRcdHRyaWdnZXJSYW5nZVN5bmModGhpcy5fc3luY1Jhbmdlc1Rva2VuKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRyaWdnZXJSYW5nZVVwZGF0ZSgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9sb2NhbFRvRGlzcG9zZS5hZGQoe1xuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHRyYW5nZVVwZGF0ZVNjaGVkdWxlci5kaXNwb3NlKCk7XG5cdFx0XHRcdHJhbmdlU3luY1NjaGVkdWxlci5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy51cGRhdGVSYW5nZXMoKTtcblx0fVxuXG5cdHByaXZhdGUgX3N5bmNSYW5nZXModG9rZW46IG51bWJlcik6IHZvaWQge1xuXHRcdC8vIGRlbGF5ZWQgaW52b2NhdGlvbiwgbWFrZSBzdXJlIHdlJ3JlIHN0aWxsIG9uXG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSB8fCB0b2tlbiAhPT0gdGhpcy5fc3luY1Jhbmdlc1Rva2VuIHx8IHRoaXMuX2N1cnJlbnREZWNvcmF0aW9ucy5sZW5ndGggPT09IDApIHtcblx0XHRcdC8vIG5vdGhpbmcgdG8gZG9cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IHJlZmVyZW5jZVJhbmdlID0gdGhpcy5fY3VycmVudERlY29yYXRpb25zLmdldFJhbmdlKDApO1xuXG5cdFx0aWYgKCFyZWZlcmVuY2VSYW5nZSB8fCByZWZlcmVuY2VSYW5nZS5zdGFydExpbmVOdW1iZXIgIT09IHJlZmVyZW5jZVJhbmdlLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdHJldHVybiB0aGlzLmNsZWFyUmFuZ2VzKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVmZXJlbmNlVmFsdWUgPSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2UocmVmZXJlbmNlUmFuZ2UpO1xuXHRcdGlmICh0aGlzLl9jdXJyZW50V29yZFBhdHRlcm4pIHtcblx0XHRcdGNvbnN0IG1hdGNoID0gcmVmZXJlbmNlVmFsdWUubWF0Y2godGhpcy5fY3VycmVudFdvcmRQYXR0ZXJuKTtcblx0XHRcdGNvbnN0IG1hdGNoTGVuZ3RoID0gbWF0Y2ggPyBtYXRjaFswXS5sZW5ndGggOiAwO1xuXHRcdFx0aWYgKG1hdGNoTGVuZ3RoICE9PSByZWZlcmVuY2VWYWx1ZS5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuY2xlYXJSYW5nZXMoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBlZGl0czogSVNpbmdsZUVkaXRPcGVyYXRpb25bXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAxLCBsZW4gPSB0aGlzLl9jdXJyZW50RGVjb3JhdGlvbnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IG1pcnJvclJhbmdlID0gdGhpcy5fY3VycmVudERlY29yYXRpb25zLmdldFJhbmdlKGkpO1xuXHRcdFx0aWYgKCFtaXJyb3JSYW5nZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGlmIChtaXJyb3JSYW5nZS5zdGFydExpbmVOdW1iZXIgIT09IG1pcnJvclJhbmdlLmVuZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0ZWRpdHMucHVzaCh7XG5cdFx0XHRcdFx0cmFuZ2U6IG1pcnJvclJhbmdlLFxuXHRcdFx0XHRcdHRleHQ6IHJlZmVyZW5jZVZhbHVlXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGV0IG9sZFZhbHVlID0gbW9kZWwuZ2V0VmFsdWVJblJhbmdlKG1pcnJvclJhbmdlKTtcblx0XHRcdFx0bGV0IG5ld1ZhbHVlID0gcmVmZXJlbmNlVmFsdWU7XG5cdFx0XHRcdGxldCByYW5nZVN0YXJ0Q29sdW1uID0gbWlycm9yUmFuZ2Uuc3RhcnRDb2x1bW47XG5cdFx0XHRcdGxldCByYW5nZUVuZENvbHVtbiA9IG1pcnJvclJhbmdlLmVuZENvbHVtbjtcblxuXHRcdFx0XHRjb25zdCBjb21tb25QcmVmaXhMZW5ndGggPSBzdHJpbmdzLmNvbW1vblByZWZpeExlbmd0aChvbGRWYWx1ZSwgbmV3VmFsdWUpO1xuXHRcdFx0XHRyYW5nZVN0YXJ0Q29sdW1uICs9IGNvbW1vblByZWZpeExlbmd0aDtcblx0XHRcdFx0b2xkVmFsdWUgPSBvbGRWYWx1ZS5zdWJzdHIoY29tbW9uUHJlZml4TGVuZ3RoKTtcblx0XHRcdFx0bmV3VmFsdWUgPSBuZXdWYWx1ZS5zdWJzdHIoY29tbW9uUHJlZml4TGVuZ3RoKTtcblxuXHRcdFx0XHRjb25zdCBjb21tb25TdWZmaXhMZW5ndGggPSBzdHJpbmdzLmNvbW1vblN1ZmZpeExlbmd0aChvbGRWYWx1ZSwgbmV3VmFsdWUpO1xuXHRcdFx0XHRyYW5nZUVuZENvbHVtbiAtPSBjb21tb25TdWZmaXhMZW5ndGg7XG5cdFx0XHRcdG9sZFZhbHVlID0gb2xkVmFsdWUuc3Vic3RyKDAsIG9sZFZhbHVlLmxlbmd0aCAtIGNvbW1vblN1ZmZpeExlbmd0aCk7XG5cdFx0XHRcdG5ld1ZhbHVlID0gbmV3VmFsdWUuc3Vic3RyKDAsIG5ld1ZhbHVlLmxlbmd0aCAtIGNvbW1vblN1ZmZpeExlbmd0aCk7XG5cblx0XHRcdFx0aWYgKHJhbmdlU3RhcnRDb2x1bW4gIT09IHJhbmdlRW5kQ29sdW1uIHx8IG5ld1ZhbHVlLmxlbmd0aCAhPT0gMCkge1xuXHRcdFx0XHRcdGVkaXRzLnB1c2goe1xuXHRcdFx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZShtaXJyb3JSYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlU3RhcnRDb2x1bW4sIG1pcnJvclJhbmdlLmVuZExpbmVOdW1iZXIsIHJhbmdlRW5kQ29sdW1uKSxcblx0XHRcdFx0XHRcdHRleHQ6IG5ld1ZhbHVlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZWRpdHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuX2VkaXRvci5wb3BVbmRvU3RvcCgpO1xuXHRcdFx0dGhpcy5faWdub3JlQ2hhbmdlRXZlbnQgPSB0cnVlO1xuXHRcdFx0Y29uc3QgcHJldkVkaXRPcGVyYXRpb25UeXBlID0gdGhpcy5fZWRpdG9yLl9nZXRWaWV3TW9kZWwoKS5nZXRQcmV2RWRpdE9wZXJhdGlvblR5cGUoKTtcblx0XHRcdHRoaXMuX2VkaXRvci5leGVjdXRlRWRpdHMoJ2xpbmtlZEVkaXRpbmcnLCBlZGl0cyk7XG5cdFx0XHR0aGlzLl9lZGl0b3IuX2dldFZpZXdNb2RlbCgpLnNldFByZXZFZGl0T3BlcmF0aW9uVHlwZShwcmV2RWRpdE9wZXJhdGlvblR5cGUpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLl9pZ25vcmVDaGFuZ2VFdmVudCA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuY2xlYXJSYW5nZXMoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwdWJsaWMgY2xlYXJSYW5nZXMoKTogdm9pZCB7XG5cdFx0dGhpcy5fdmlzaWJsZUNvbnRleHRLZXkuc2V0KGZhbHNlKTtcblx0XHR0aGlzLl9jdXJyZW50RGVjb3JhdGlvbnMuY2xlYXIoKTtcblx0XHRpZiAodGhpcy5fY3VycmVudFJlcXVlc3RDdHMpIHtcblx0XHRcdHRoaXMuX2N1cnJlbnRSZXF1ZXN0Q3RzLmNhbmNlbCgpO1xuXHRcdFx0dGhpcy5fY3VycmVudFJlcXVlc3RDdHMgPSBudWxsO1xuXHRcdFx0dGhpcy5fY3VycmVudFJlcXVlc3RQb3NpdGlvbiA9IG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldCBjdXJyZW50VXBkYXRlVHJpZ2dlclByb21pc2UoKTogUHJvbWlzZTxhbnk+IHtcblx0XHRyZXR1cm4gdGhpcy5fcmFuZ2VVcGRhdGVUcmlnZ2VyUHJvbWlzZSB8fCBQcm9taXNlLnJlc29sdmUoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgY3VycmVudFN5bmNUcmlnZ2VyUHJvbWlzZSgpOiBQcm9taXNlPGFueT4ge1xuXHRcdHJldHVybiB0aGlzLl9yYW5nZVN5bmNUcmlnZ2VyUHJvbWlzZSB8fCBQcm9taXNlLnJlc29sdmUoKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyB1cGRhdGVSYW5nZXMoZm9yY2UgPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHRoaXMuY2xlYXJSYW5nZXMoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMuX2VkaXRvci5nZXRQb3NpdGlvbigpO1xuXHRcdGlmICghdGhpcy5fZW5hYmxlZCAmJiAhZm9yY2UgfHwgdGhpcy5fZWRpdG9yLmdldFNlbGVjdGlvbnMoKS5sZW5ndGggPiAxKSB7XG5cdFx0XHQvLyBkaXNhYmxlZCBvciBtdWx0aWN1cnNvclxuXHRcdFx0dGhpcy5jbGVhclJhbmdlcygpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0Y29uc3QgbW9kZWxWZXJzaW9uSWQgPSBtb2RlbC5nZXRWZXJzaW9uSWQoKTtcblx0XHRpZiAodGhpcy5fY3VycmVudFJlcXVlc3RQb3NpdGlvbiAmJiB0aGlzLl9jdXJyZW50UmVxdWVzdE1vZGVsVmVyc2lvbiA9PT0gbW9kZWxWZXJzaW9uSWQpIHtcblx0XHRcdGlmIChwb3NpdGlvbi5lcXVhbHModGhpcy5fY3VycmVudFJlcXVlc3RQb3NpdGlvbikpIHtcblx0XHRcdFx0cmV0dXJuOyAvLyBzYW1lIHBvc2l0aW9uXG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5fY3VycmVudERlY29yYXRpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Y29uc3QgcmFuZ2UgPSB0aGlzLl9jdXJyZW50RGVjb3JhdGlvbnMuZ2V0UmFuZ2UoMCk7XG5cdFx0XHRcdGlmIChyYW5nZSAmJiByYW5nZS5jb250YWluc1Bvc2l0aW9uKHBvc2l0aW9uKSkge1xuXHRcdFx0XHRcdHJldHVybjsgLy8ganVzdCBtb3ZpbmcgaW5zaWRlIHRoZSBleGlzdGluZyBwcmltYXJ5IHJhbmdlXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBDbGVhciBleGlzdGluZyBkZWNvcmF0aW9ucyB3aGlsZSB3ZSBjb21wdXRlIG5ldyBvbmVzXG5cdFx0dGhpcy5jbGVhclJhbmdlcygpO1xuXG5cdFx0dGhpcy5fY3VycmVudFJlcXVlc3RQb3NpdGlvbiA9IHBvc2l0aW9uO1xuXHRcdHRoaXMuX2N1cnJlbnRSZXF1ZXN0TW9kZWxWZXJzaW9uID0gbW9kZWxWZXJzaW9uSWQ7XG5cblx0XHRjb25zdCBjdXJyZW50UmVxdWVzdEN0cyA9IHRoaXMuX2N1cnJlbnRSZXF1ZXN0Q3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHN3ID0gbmV3IFN0b3BXYXRjaChmYWxzZSk7XG5cdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGdldExpbmtlZEVkaXRpbmdSYW5nZXModGhpcy5fcHJvdmlkZXJzLCBtb2RlbCwgcG9zaXRpb24sIGN1cnJlbnRSZXF1ZXN0Q3RzLnRva2VuKTtcblx0XHRcdHRoaXMuX2RlYm91bmNlSW5mb3JtYXRpb24udXBkYXRlKG1vZGVsLCBzdy5lbGFwc2VkKCkpO1xuXHRcdFx0aWYgKGN1cnJlbnRSZXF1ZXN0Q3RzICE9PSB0aGlzLl9jdXJyZW50UmVxdWVzdEN0cykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9jdXJyZW50UmVxdWVzdEN0cyA9IG51bGw7XG5cdFx0XHRpZiAobW9kZWxWZXJzaW9uSWQgIT09IG1vZGVsLmdldFZlcnNpb25JZCgpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bGV0IHJhbmdlczogSVJhbmdlW10gPSBbXTtcblx0XHRcdGlmIChyZXNwb25zZT8ucmFuZ2VzKSB7XG5cdFx0XHRcdHJhbmdlcyA9IHJlc3BvbnNlLnJhbmdlcztcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fY3VycmVudFdvcmRQYXR0ZXJuID0gcmVzcG9uc2U/LndvcmRQYXR0ZXJuIHx8IHRoaXMuX2xhbmd1YWdlV29yZFBhdHRlcm47XG5cblx0XHRcdGxldCBmb3VuZFJlZmVyZW5jZVJhbmdlID0gZmFsc2U7XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gcmFuZ2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGlmIChSYW5nZS5jb250YWluc1Bvc2l0aW9uKHJhbmdlc1tpXSwgcG9zaXRpb24pKSB7XG5cdFx0XHRcdFx0Zm91bmRSZWZlcmVuY2VSYW5nZSA9IHRydWU7XG5cdFx0XHRcdFx0aWYgKGkgIT09IDApIHtcblx0XHRcdFx0XHRcdGNvbnN0IHJlZmVyZW5jZVJhbmdlID0gcmFuZ2VzW2ldO1xuXHRcdFx0XHRcdFx0cmFuZ2VzLnNwbGljZShpLCAxKTtcblx0XHRcdFx0XHRcdHJhbmdlcy51bnNoaWZ0KHJlZmVyZW5jZVJhbmdlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCFmb3VuZFJlZmVyZW5jZVJhbmdlKSB7XG5cdFx0XHRcdC8vIENhbm5vdCBkbyBsaW5rZWQgZWRpdGluZyBpZiB0aGUgcmFuZ2VzIGFyZSBub3Qgd2hlcmUgdGhlIGN1cnNvciBpcy4uLlxuXHRcdFx0XHR0aGlzLmNsZWFyUmFuZ2VzKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZGVjb3JhdGlvbnM6IElNb2RlbERlbHRhRGVjb3JhdGlvbltdID0gcmFuZ2VzLm1hcChyYW5nZSA9PiAoeyByYW5nZTogcmFuZ2UsIG9wdGlvbnM6IExpbmtlZEVkaXRpbmdDb250cmlidXRpb24uREVDT1JBVElPTiB9KSk7XG5cdFx0XHR0aGlzLl92aXNpYmxlQ29udGV4dEtleS5zZXQodHJ1ZSk7XG5cdFx0XHR0aGlzLl9jdXJyZW50RGVjb3JhdGlvbnMuc2V0KGRlY29yYXRpb25zKTtcblx0XHRcdHRoaXMuX3N5bmNSYW5nZXNUb2tlbisrOyAvLyBjYW5jZWwgYW55IHBlbmRpbmcgc3luY1JhbmdlcyBjYWxsXG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRpZiAoIWlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyKSkge1xuXHRcdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlcnIpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuX2N1cnJlbnRSZXF1ZXN0Q3RzID09PSBjdXJyZW50UmVxdWVzdEN0cyB8fCAhdGhpcy5fY3VycmVudFJlcXVlc3RDdHMpIHtcblx0XHRcdFx0Ly8gc3RvcCBpZiB3ZSBhcmUgc3RpbGwgdGhlIGxhdGVzdCByZXF1ZXN0XG5cdFx0XHRcdHRoaXMuY2xlYXJSYW5nZXMoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0fVxuXG5cdC8vIGZvciB0ZXN0aW5nXG5cdHB1YmxpYyBzZXREZWJvdW5jZUR1cmF0aW9uKHRpbWVJbk1TOiBudW1iZXIpIHtcblx0XHR0aGlzLl9kZWJvdW5jZUR1cmF0aW9uID0gdGltZUluTVM7XG5cdH1cblxuXHQvLyBwcml2YXRlIHByaW50RGVjb3JhdG9ycyhtb2RlbDogSVRleHRNb2RlbCkge1xuXHQvLyBcdHJldHVybiB0aGlzLl9jdXJyZW50RGVjb3JhdGlvbnMubWFwKGQgPT4ge1xuXHQvLyBcdFx0Y29uc3QgcmFuZ2UgPSBtb2RlbC5nZXREZWNvcmF0aW9uUmFuZ2UoZCk7XG5cdC8vIFx0XHRpZiAocmFuZ2UpIHtcblx0Ly8gXHRcdFx0cmV0dXJuIHRoaXMucHJpbnRSYW5nZShyYW5nZSk7XG5cdC8vIFx0XHR9XG5cdC8vIFx0XHRyZXR1cm4gJ2ludmFsaWQnO1xuXHQvLyBcdH0pLmpvaW4oJywnKTtcblx0Ly8gfVxuXG5cdC8vIHByaXZhdGUgcHJpbnRDaGFuZ2VzKGNoYW5nZXM6IElNb2RlbENvbnRlbnRDaGFuZ2VbXSkge1xuXHQvLyBcdHJldHVybiBjaGFuZ2VzLm1hcChjID0+IHtcblx0Ly8gXHRcdHJldHVybiBgJHt0aGlzLnByaW50UmFuZ2UoYy5yYW5nZSl9IC0gJHtjLnRleHR9YDtcblx0Ly8gXHR9XG5cdC8vIFx0KS5qb2luKCcsJyk7XG5cdC8vIH1cblxuXHQvLyBwcml2YXRlIHByaW50UmFuZ2UocmFuZ2U6IElSYW5nZSkge1xuXHQvLyBcdHJldHVybiBgJHtyYW5nZS5zdGFydExpbmVOdW1iZXJ9LCR7cmFuZ2Uuc3RhcnRDb2x1bW59LyR7cmFuZ2UuZW5kTGluZU51bWJlcn0sJHtyYW5nZS5lbmRDb2x1bW59YDtcblx0Ly8gfVxufVxuXG5leHBvcnQgY2xhc3MgTGlua2VkRWRpdGluZ0FjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5saW5rZWRFZGl0aW5nJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdsaW5rZWRFZGl0aW5nLmxhYmVsJywgXCJTdGFydCBMaW5rZWQgRWRpdGluZ1wiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlLCBFZGl0b3JDb250ZXh0S2V5cy5oYXNSZW5hbWVQcm92aWRlciksXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5GMixcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bkNvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZ3M6IFtVUkksIElQb3NpdGlvbl0pOiB2b2lkIHwgUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IFt1cmksIHBvc10gPSBBcnJheS5pc0FycmF5KGFyZ3MpICYmIGFyZ3MgfHwgW3VuZGVmaW5lZCwgdW5kZWZpbmVkXTtcblxuXHRcdGlmIChVUkkuaXNVcmkodXJpKSAmJiBQb3NpdGlvbi5pc0lQb3NpdGlvbihwb3MpKSB7XG5cdFx0XHRyZXR1cm4gZWRpdG9yU2VydmljZS5vcGVuQ29kZUVkaXRvcih7IHJlc291cmNlOiB1cmkgfSwgZWRpdG9yU2VydmljZS5nZXRBY3RpdmVDb2RlRWRpdG9yKCkpLnRoZW4oZWRpdG9yID0+IHtcblx0XHRcdFx0aWYgKCFlZGl0b3IpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWRpdG9yLnNldFBvc2l0aW9uKHBvcyk7XG5cdFx0XHRcdGVkaXRvci5pbnZva2VXaXRoaW5Db250ZXh0KGFjY2Vzc29yID0+IHtcblx0XHRcdFx0XHR0aGlzLnJlcG9ydFRlbGVtZXRyeShhY2Nlc3NvciwgZWRpdG9yKTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5ydW4oYWNjZXNzb3IsIGVkaXRvcik7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSwgb25VbmV4cGVjdGVkRXJyb3IpO1xuXHRcdH1cblxuXHRcdHJldHVybiBzdXBlci5ydW5Db21tYW5kKGFjY2Vzc29yLCBhcmdzKTtcblx0fVxuXG5cdHJ1bihfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb250cm9sbGVyID0gTGlua2VkRWRpdGluZ0NvbnRyaWJ1dGlvbi5nZXQoZWRpdG9yKTtcblx0XHRpZiAoY29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShjb250cm9sbGVyLnVwZGF0ZVJhbmdlcyh0cnVlKSk7XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0fVxufVxuXG5jb25zdCBMaW5rZWRFZGl0aW5nQ29tbWFuZCA9IEVkaXRvckNvbW1hbmQuYmluZFRvQ29udHJpYnV0aW9uPExpbmtlZEVkaXRpbmdDb250cmlidXRpb24+KExpbmtlZEVkaXRpbmdDb250cmlidXRpb24uZ2V0KTtcbnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgTGlua2VkRWRpdGluZ0NvbW1hbmQoe1xuXHRpZDogJ2NhbmNlbExpbmtlZEVkaXRpbmdJbnB1dCcsXG5cdHByZWNvbmRpdGlvbjogQ09OVEVYVF9PTlRZUEVfUkVOQU1FX0lOUFVUX1ZJU0lCTEUsXG5cdGhhbmRsZXI6IHggPT4geC5jbGVhclJhbmdlcygpLFxuXHRrYk9wdHM6IHtcblx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYiArIDk5LFxuXHRcdHByaW1hcnk6IEtleUNvZGUuRXNjYXBlLFxuXHRcdHNlY29uZGFyeTogW0tleU1vZC5TaGlmdCB8IEtleUNvZGUuRXNjYXBlXVxuXHR9XG59KSk7XG5cblxuZnVuY3Rpb24gZ2V0TGlua2VkRWRpdGluZ1Jhbmdlcyhwcm92aWRlcnM6IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5PExpbmtlZEVkaXRpbmdSYW5nZVByb3ZpZGVyPiwgbW9kZWw6IElUZXh0TW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxMaW5rZWRFZGl0aW5nUmFuZ2VzIHwgdW5kZWZpbmVkIHwgbnVsbD4ge1xuXHRjb25zdCBvcmRlcmVkQnlTY29yZSA9IHByb3ZpZGVycy5vcmRlcmVkKG1vZGVsKTtcblxuXHQvLyBpbiBvcmRlciBvZiBzY29yZSBhc2sgdGhlIGxpbmtlZCBlZGl0aW5nIHJhbmdlIHByb3ZpZGVyXG5cdC8vIHVudGlsIHNvbWVvbmUgcmVzcG9uc2Ugd2l0aCBhIGdvb2QgcmVzdWx0XG5cdC8vIChnb29kID0gbm90IG51bGwpXG5cdHJldHVybiBmaXJzdDxMaW5rZWRFZGl0aW5nUmFuZ2VzIHwgdW5kZWZpbmVkIHwgbnVsbD4ob3JkZXJlZEJ5U2NvcmUubWFwKHByb3ZpZGVyID0+IGFzeW5jICgpID0+IHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVMaW5rZWRFZGl0aW5nUmFuZ2VzKG1vZGVsLCBwb3NpdGlvbiwgdG9rZW4pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdG9uVW5leHBlY3RlZEV4dGVybmFsRXJyb3IoZSk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fSksIHJlc3VsdCA9PiAhIXJlc3VsdCAmJiBhcnJheXMuaXNOb25FbXB0eUFycmF5KHJlc3VsdD8ucmFuZ2VzKSk7XG59XG5cbmV4cG9ydCBjb25zdCBlZGl0b3JMaW5rZWRFZGl0aW5nQmFja2dyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ2VkaXRvci5saW5rZWRFZGl0aW5nQmFja2dyb3VuZCcsIHsgZGFyazogQ29sb3IuZnJvbUhleCgnI2YwMCcpLnRyYW5zcGFyZW50KDAuMyksIGxpZ2h0OiBDb2xvci5mcm9tSGV4KCcjZjAwJykudHJhbnNwYXJlbnQoMC4zKSwgaGNEYXJrOiBDb2xvci5mcm9tSGV4KCcjZjAwJykudHJhbnNwYXJlbnQoMC4zKSwgaGNMaWdodDogQ29sb3Iud2hpdGUgfSwgbmxzLmxvY2FsaXplKCdlZGl0b3JMaW5rZWRFZGl0aW5nQmFja2dyb3VuZCcsICdCYWNrZ3JvdW5kIGNvbG9yIHdoZW4gdGhlIGVkaXRvciBhdXRvIHJlbmFtZXMgb24gdHlwZS4nKSk7XG5cbnJlZ2lzdGVyTW9kZWxBbmRQb3NpdGlvbkNvbW1hbmQoJ19leGVjdXRlTGlua2VkRWRpdGluZ1Byb3ZpZGVyJywgKF9hY2Nlc3NvciwgbW9kZWwsIHBvc2l0aW9uKSA9PiB7XG5cdGNvbnN0IHsgbGlua2VkRWRpdGluZ1JhbmdlUHJvdmlkZXIgfSA9IF9hY2Nlc3Nvci5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0cmV0dXJuIGdldExpbmtlZEVkaXRpbmdSYW5nZXMobGlua2VkRWRpdGluZ1JhbmdlUHJvdmlkZXIsIG1vZGVsLCBwb3NpdGlvbiwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG59KTtcblxucmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24oTGlua2VkRWRpdGluZ0NvbnRyaWJ1dGlvbi5JRCwgTGlua2VkRWRpdGluZ0NvbnRyaWJ1dGlvbiwgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbi5BZnRlckZpcnN0UmVuZGVyKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKExpbmtlZEVkaXRpbmdBY3Rpb24pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFlBQVk7QUFDeEIsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxtQkFBbUIsK0JBQStCO0FBQzNELFNBQVMs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
