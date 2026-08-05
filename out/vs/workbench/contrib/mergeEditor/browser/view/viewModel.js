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
import { findLast } from "../../../../../base/common/arraysFind.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { derived, derivedObservableWithWritableCache, observableValue, transaction } from "../../../../../base/common/observable.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { ScrollType } from "../../../../../editor/common/editorCommon.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { LineRange } from "../model/lineRange.js";
import { observableConfigValue } from "../../../../../platform/observable/common/platformObservableUtils.js";
let MergeEditorViewModel = class extends Disposable {
  constructor(model, inputCodeEditorView1, inputCodeEditorView2, resultCodeEditorView, baseCodeEditorView, showNonConflictingChanges, configurationService, notificationService) {
    super();
    this.model = model;
    this.inputCodeEditorView1 = inputCodeEditorView1;
    this.inputCodeEditorView2 = inputCodeEditorView2;
    this.resultCodeEditorView = resultCodeEditorView;
    this.baseCodeEditorView = baseCodeEditorView;
    this.showNonConflictingChanges = showNonConflictingChanges;
    this.configurationService = configurationService;
    this.notificationService = notificationService;
    this.manuallySetActiveModifiedBaseRange = observableValue(this, { range: void 0, counter: 0 });
    this.attachedHistory = this._register(new AttachedHistory(this.model.resultTextModel));
    this.shouldUseAppendInsteadOfAccept = observableConfigValue(
      "mergeEditor.shouldUseAppendInsteadOfAccept",
      false,
      this.configurationService
    );
    this.counter = 0;
    this.lastFocusedEditor = derivedObservableWithWritableCache(this, (reader, lastValue) => {
      const editors = [
        this.inputCodeEditorView1,
        this.inputCodeEditorView2,
        this.resultCodeEditorView,
        this.baseCodeEditorView.read(reader)
      ];
      const view = editors.find((e) => e && e.isFocused.read(reader));
      return view ? { view, counter: this.counter++ } : lastValue || { view: void 0, counter: this.counter++ };
    });
    this.baseShowDiffAgainst = derived(this, (reader) => {
      const lastFocusedEditor = this.lastFocusedEditor.read(reader);
      if (lastFocusedEditor.view === this.inputCodeEditorView1) {
        return 1;
      } else if (lastFocusedEditor.view === this.inputCodeEditorView2) {
        return 2;
      }
      return void 0;
    });
    this.selectionInBase = derived(this, (reader) => {
      const sourceEditor = this.lastFocusedEditor.read(reader).view;
      if (!sourceEditor) {
        return void 0;
      }
      const selections = sourceEditor.selection.read(reader) || [];
      const rangesInBase = selections.map((selection) => {
        if (sourceEditor === this.inputCodeEditorView1) {
          return this.model.translateInputRangeToBase(1, selection);
        } else if (sourceEditor === this.inputCodeEditorView2) {
          return this.model.translateInputRangeToBase(2, selection);
        } else if (sourceEditor === this.resultCodeEditorView) {
          return this.model.translateResultRangeToBase(selection);
        } else if (sourceEditor === this.baseCodeEditorView.read(reader)) {
          return selection;
        } else {
          return selection;
        }
      });
      return {
        rangesInBase,
        sourceEditor
      };
    });
    this.activeModifiedBaseRange = derived(
      this,
      (reader) => {
        const focusedEditor = this.lastFocusedEditor.read(reader);
        const manualRange = this.manuallySetActiveModifiedBaseRange.read(reader);
        if (manualRange.counter > focusedEditor.counter) {
          return manualRange.range;
        }
        if (!focusedEditor.view) {
          return;
        }
        const cursorLineNumber = focusedEditor.view.cursorLineNumber.read(reader);
        if (!cursorLineNumber) {
          return void 0;
        }
        const modifiedBaseRanges = this.model.modifiedBaseRanges.read(reader);
        return modifiedBaseRanges.find((r) => {
          const range = this.getRangeOfModifiedBaseRange(focusedEditor.view, r, reader);
          return range.isEmpty ? range.startLineNumber === cursorLineNumber : range.contains(cursorLineNumber);
        });
      }
    );
    this._register(resultCodeEditorView.editor.onDidChangeModelContent((e) => {
      if (this.model.isApplyingEditInResult || e.isRedoing || e.isUndoing) {
        return;
      }
      const baseRangeStates = [];
      for (const change of e.changes) {
        const rangeInBase = this.model.translateResultRangeToBase(Range.lift(change.range));
        const baseRanges = this.model.findModifiedBaseRangesInRange(new LineRange(rangeInBase.startLineNumber, rangeInBase.endLineNumber - rangeInBase.startLineNumber));
        if (baseRanges.length === 1) {
          const isHandled = this.model.isHandled(baseRanges[0]).get();
          if (!isHandled) {
            baseRangeStates.push(baseRanges[0]);
          }
        }
      }
      if (baseRangeStates.length === 0) {
        return;
      }
      const element = {
        model: this.model,
        redo() {
          transaction((tx) => {
            for (const r of baseRangeStates) {
              this.model.setHandled(r, true, tx);
            }
          });
        },
        undo() {
          transaction((tx) => {
            for (const r of baseRangeStates) {
              this.model.setHandled(r, false, tx);
            }
          });
        }
      };
      this.attachedHistory.pushAttachedHistoryElement(element);
      element.redo();
    }));
  }
  getRangeOfModifiedBaseRange(editor, modifiedBaseRange, reader) {
    if (editor === this.resultCodeEditorView) {
      return this.model.getLineRangeInResult(modifiedBaseRange.baseRange, reader);
    } else if (editor === this.baseCodeEditorView.get()) {
      return modifiedBaseRange.baseRange;
    } else {
      const input = editor === this.inputCodeEditorView1 ? 1 : 2;
      return modifiedBaseRange.getInputRange(input);
    }
  }
  setActiveModifiedBaseRange(range, tx) {
    this.manuallySetActiveModifiedBaseRange.set({ range, counter: this.counter++ }, tx);
  }
  setState(baseRange, state, tx, inputNumber) {
    this.manuallySetActiveModifiedBaseRange.set({ range: baseRange, counter: this.counter++ }, tx);
    this.model.setState(baseRange, state, inputNumber, tx);
    this.lastFocusedEditor.clearCache(tx);
  }
  goToConflict(getModifiedBaseRange) {
    let editor = this.lastFocusedEditor.get().view;
    if (!editor) {
      editor = this.resultCodeEditorView;
    }
    const curLineNumber = editor.editor.getPosition()?.lineNumber;
    if (curLineNumber === void 0) {
      return;
    }
    const modifiedBaseRange = getModifiedBaseRange(editor, curLineNumber);
    if (modifiedBaseRange) {
      const range = this.getRangeOfModifiedBaseRange(editor, modifiedBaseRange, void 0);
      editor.editor.focus();
      let startLineNumber = range.startLineNumber;
      let endLineNumberExclusive = range.endLineNumberExclusive;
      if (range.startLineNumber > editor.editor.getModel().getLineCount()) {
        transaction((tx) => {
          this.setActiveModifiedBaseRange(modifiedBaseRange, tx);
        });
        startLineNumber = endLineNumberExclusive = editor.editor.getModel().getLineCount();
      }
      editor.editor.setPosition({
        lineNumber: startLineNumber,
        column: editor.editor.getModel().getLineFirstNonWhitespaceColumn(startLineNumber)
      });
      editor.editor.revealLinesNearTop(startLineNumber, endLineNumberExclusive, ScrollType.Smooth);
    }
  }
  goToNextModifiedBaseRange(predicate) {
    this.goToConflict(
      (e, l) => this.model.modifiedBaseRanges.get().find(
        (r) => predicate(r) && this.getRangeOfModifiedBaseRange(e, r, void 0).startLineNumber > l
      ) || this.model.modifiedBaseRanges.get().find((r) => predicate(r))
    );
  }
  goToPreviousModifiedBaseRange(predicate) {
    this.goToConflict(
      (e, l) => findLast(
        this.model.modifiedBaseRanges.get(),
        (r) => predicate(r) && this.getRangeOfModifiedBaseRange(e, r, void 0).endLineNumberExclusive < l
      ) || findLast(
        this.model.modifiedBaseRanges.get(),
        (r) => predicate(r)
      )
    );
  }
  toggleActiveConflict(inputNumber) {
    const activeModifiedBaseRange = this.activeModifiedBaseRange.get();
    if (!activeModifiedBaseRange) {
      this.notificationService.error(localize("noConflictMessage", "There is currently no conflict focused that can be toggled."));
      return;
    }
    transaction((tx) => {
      this.setState(
        activeModifiedBaseRange,
        this.model.getState(activeModifiedBaseRange).get().toggle(inputNumber),
        tx,
        inputNumber
      );
    });
  }
  acceptAll(inputNumber) {
    transaction((tx) => {
      for (const range of this.model.modifiedBaseRanges.get()) {
        this.setState(
          range,
          this.model.getState(range).get().withInputValue(inputNumber, true),
          tx,
          inputNumber
        );
      }
    });
  }
};
MergeEditorViewModel = __decorateClass([
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, INotificationService)
], MergeEditorViewModel);
class AttachedHistory extends Disposable {
  constructor(model) {
    super();
    this.model = model;
    this.attachedHistory = [];
    this.previousAltId = this.model.getAlternativeVersionId();
    this._register(model.onDidChangeContent((e) => {
      const currentAltId = model.getAlternativeVersionId();
      if (e.isRedoing) {
        for (const item of this.attachedHistory) {
          if (this.previousAltId < item.altId && item.altId <= currentAltId) {
            item.element.redo();
          }
        }
      } else if (e.isUndoing) {
        for (let i = this.attachedHistory.length - 1; i >= 0; i--) {
          const item = this.attachedHistory[i];
          if (currentAltId < item.altId && item.altId <= this.previousAltId) {
            item.element.undo();
          }
        }
      } else {
        while (this.attachedHistory.length > 0 && this.attachedHistory[this.attachedHistory.length - 1].altId > this.previousAltId) {
          this.attachedHistory.pop();
        }
      }
      this.previousAltId = currentAltId;
    }));
  }
  /**
   * Pushes an history item that is tied to the last text edit (or an extension of it).
   * When the last text edit is undone/redone, so is is this history item.
   */
  pushAttachedHistoryElement(element) {
    this.attachedHistory.push({ altId: this.model.getAlternativeVersionId(), element });
  }
}
export {
  MergeEditorViewModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL3ZpZXcvdmlld01vZGVsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZmluZExhc3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXNGaW5kLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZGVyaXZlZCwgZGVyaXZlZE9ic2VydmFibGVXaXRoV3JpdGFibGVDYWNoZSwgSU9ic2VydmFibGUsIElSZWFkZXIsIElUcmFuc2FjdGlvbiwgb2JzZXJ2YWJsZVZhbHVlLCB0cmFuc2FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2Nyb2xsVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBMaW5lUmFuZ2UgfSBmcm9tICcuLi9tb2RlbC9saW5lUmFuZ2UuanMnO1xuaW1wb3J0IHsgTWVyZ2VFZGl0b3JNb2RlbCB9IGZyb20gJy4uL21vZGVsL21lcmdlRWRpdG9yTW9kZWwuanMnO1xuaW1wb3J0IHsgSW5wdXROdW1iZXIsIE1vZGlmaWVkQmFzZVJhbmdlLCBNb2RpZmllZEJhc2VSYW5nZVN0YXRlIH0gZnJvbSAnLi4vbW9kZWwvbW9kaWZpZWRCYXNlUmFuZ2UuanMnO1xuaW1wb3J0IHsgb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vb2JzZXJ2YWJsZS9jb21tb24vcGxhdGZvcm1PYnNlcnZhYmxlVXRpbHMuanMnO1xuaW1wb3J0IHsgQmFzZUNvZGVFZGl0b3JWaWV3IH0gZnJvbSAnLi9lZGl0b3JzL2Jhc2VDb2RlRWRpdG9yVmlldy5qcyc7XG5pbXBvcnQgeyBDb2RlRWRpdG9yVmlldyB9IGZyb20gJy4vZWRpdG9ycy9jb2RlRWRpdG9yVmlldy5qcyc7XG5pbXBvcnQgeyBJbnB1dENvZGVFZGl0b3JWaWV3IH0gZnJvbSAnLi9lZGl0b3JzL2lucHV0Q29kZUVkaXRvclZpZXcuanMnO1xuaW1wb3J0IHsgUmVzdWx0Q29kZUVkaXRvclZpZXcgfSBmcm9tICcuL2VkaXRvcnMvcmVzdWx0Q29kZUVkaXRvclZpZXcuanMnO1xuXG5leHBvcnQgY2xhc3MgTWVyZ2VFZGl0b3JWaWV3TW9kZWwgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBtYW51YWxseVNldEFjdGl2ZU1vZGlmaWVkQmFzZVJhbmdlID0gb2JzZXJ2YWJsZVZhbHVlPFxuXHRcdHsgcmFuZ2U6IE1vZGlmaWVkQmFzZVJhbmdlIHwgdW5kZWZpbmVkOyBjb3VudGVyOiBudW1iZXIgfVxuXHQ+KHRoaXMsIHsgcmFuZ2U6IHVuZGVmaW5lZCwgY291bnRlcjogMCB9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGF0dGFjaGVkSGlzdG9yeSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBBdHRhY2hlZEhpc3RvcnkodGhpcy5tb2RlbC5yZXN1bHRUZXh0TW9kZWwpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgbW9kZWw6IE1lcmdlRWRpdG9yTW9kZWwsXG5cdFx0cHVibGljIHJlYWRvbmx5IGlucHV0Q29kZUVkaXRvclZpZXcxOiBJbnB1dENvZGVFZGl0b3JWaWV3LFxuXHRcdHB1YmxpYyByZWFkb25seSBpbnB1dENvZGVFZGl0b3JWaWV3MjogSW5wdXRDb2RlRWRpdG9yVmlldyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVzdWx0Q29kZUVkaXRvclZpZXc6IFJlc3VsdENvZGVFZGl0b3JWaWV3LFxuXHRcdHB1YmxpYyByZWFkb25seSBiYXNlQ29kZUVkaXRvclZpZXc6IElPYnNlcnZhYmxlPEJhc2VDb2RlRWRpdG9yVmlldyB8IHVuZGVmaW5lZD4sXG5cdFx0cHVibGljIHJlYWRvbmx5IHNob3dOb25Db25mbGljdGluZ0NoYW5nZXM6IElPYnNlcnZhYmxlPGJvb2xlYW4+LFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVzdWx0Q29kZUVkaXRvclZpZXcuZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KGUgPT4ge1xuXHRcdFx0aWYgKHRoaXMubW9kZWwuaXNBcHBseWluZ0VkaXRJblJlc3VsdCB8fCBlLmlzUmVkb2luZyB8fCBlLmlzVW5kb2luZykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGJhc2VSYW5nZVN0YXRlczogTW9kaWZpZWRCYXNlUmFuZ2VbXSA9IFtdO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGNoYW5nZSBvZiBlLmNoYW5nZXMpIHtcblx0XHRcdFx0Y29uc3QgcmFuZ2VJbkJhc2UgPSB0aGlzLm1vZGVsLnRyYW5zbGF0ZVJlc3VsdFJhbmdlVG9CYXNlKFJhbmdlLmxpZnQoY2hhbmdlLnJhbmdlKSk7XG5cdFx0XHRcdGNvbnN0IGJhc2VSYW5nZXMgPSB0aGlzLm1vZGVsLmZpbmRNb2RpZmllZEJhc2VSYW5nZXNJblJhbmdlKG5ldyBMaW5lUmFuZ2UocmFuZ2VJbkJhc2Uuc3RhcnRMaW5lTnVtYmVyLCByYW5nZUluQmFzZS5lbmRMaW5lTnVtYmVyIC0gcmFuZ2VJbkJhc2Uuc3RhcnRMaW5lTnVtYmVyKSk7XG5cdFx0XHRcdGlmIChiYXNlUmFuZ2VzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRcdGNvbnN0IGlzSGFuZGxlZCA9IHRoaXMubW9kZWwuaXNIYW5kbGVkKGJhc2VSYW5nZXNbMF0pLmdldCgpO1xuXHRcdFx0XHRcdGlmICghaXNIYW5kbGVkKSB7XG5cdFx0XHRcdFx0XHRiYXNlUmFuZ2VTdGF0ZXMucHVzaChiYXNlUmFuZ2VzWzBdKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGJhc2VSYW5nZVN0YXRlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBlbGVtZW50ID0ge1xuXHRcdFx0XHRtb2RlbDogdGhpcy5tb2RlbCxcblx0XHRcdFx0cmVkbygpIHtcblx0XHRcdFx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIE1hcmsgY29uZmxpY3RzIHRvdWNoZWQgYnkgbWFudWFsIGVkaXRzIGFzIGhhbmRsZWQgKi9cblx0XHRcdFx0XHRcdGZvciAoY29uc3QgciBvZiBiYXNlUmFuZ2VTdGF0ZXMpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5tb2RlbC5zZXRIYW5kbGVkKHIsIHRydWUsIHR4KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSxcblx0XHRcdFx0dW5kbygpIHtcblx0XHRcdFx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIE1hcmsgY29uZmxpY3RzIHRvdWNoZWQgYnkgbWFudWFsIGVkaXRzIGFzIGhhbmRsZWQgKi9cblx0XHRcdFx0XHRcdGZvciAoY29uc3QgciBvZiBiYXNlUmFuZ2VTdGF0ZXMpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5tb2RlbC5zZXRIYW5kbGVkKHIsIGZhbHNlLCB0eCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5hdHRhY2hlZEhpc3RvcnkucHVzaEF0dGFjaGVkSGlzdG9yeUVsZW1lbnQoZWxlbWVudCk7XG5cdFx0XHRlbGVtZW50LnJlZG8oKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwdWJsaWMgcmVhZG9ubHkgc2hvdWxkVXNlQXBwZW5kSW5zdGVhZE9mQWNjZXB0ID0gb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlPGJvb2xlYW4+KFxuXHRcdCdtZXJnZUVkaXRvci5zaG91bGRVc2VBcHBlbmRJbnN0ZWFkT2ZBY2NlcHQnLFxuXHRcdGZhbHNlLFxuXHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCk7XG5cblx0cHJpdmF0ZSBjb3VudGVyID0gMDtcblx0cHJpdmF0ZSByZWFkb25seSBsYXN0Rm9jdXNlZEVkaXRvciA9IGRlcml2ZWRPYnNlcnZhYmxlV2l0aFdyaXRhYmxlQ2FjaGU8XG5cdFx0eyB2aWV3OiBDb2RlRWRpdG9yVmlldyB8IHVuZGVmaW5lZDsgY291bnRlcjogbnVtYmVyIH1cblx0Pih0aGlzLCAocmVhZGVyLCBsYXN0VmFsdWUpID0+IHtcblx0XHRjb25zdCBlZGl0b3JzID0gW1xuXHRcdFx0dGhpcy5pbnB1dENvZGVFZGl0b3JWaWV3MSxcblx0XHRcdHRoaXMuaW5wdXRDb2RlRWRpdG9yVmlldzIsXG5cdFx0XHR0aGlzLnJlc3VsdENvZGVFZGl0b3JWaWV3LFxuXHRcdFx0dGhpcy5iYXNlQ29kZUVkaXRvclZpZXcucmVhZChyZWFkZXIpLFxuXHRcdF07XG5cdFx0Y29uc3QgdmlldyA9IGVkaXRvcnMuZmluZCgoZSkgPT4gZSAmJiBlLmlzRm9jdXNlZC5yZWFkKHJlYWRlcikpO1xuXHRcdHJldHVybiB2aWV3ID8geyB2aWV3LCBjb3VudGVyOiB0aGlzLmNvdW50ZXIrKyB9IDogbGFzdFZhbHVlIHx8IHsgdmlldzogdW5kZWZpbmVkLCBjb3VudGVyOiB0aGlzLmNvdW50ZXIrKyB9O1xuXHR9KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgYmFzZVNob3dEaWZmQWdhaW5zdCA9IGRlcml2ZWQ8MSB8IDIgfCB1bmRlZmluZWQ+KHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0Y29uc3QgbGFzdEZvY3VzZWRFZGl0b3IgPSB0aGlzLmxhc3RGb2N1c2VkRWRpdG9yLnJlYWQocmVhZGVyKTtcblx0XHRpZiAobGFzdEZvY3VzZWRFZGl0b3IudmlldyA9PT0gdGhpcy5pbnB1dENvZGVFZGl0b3JWaWV3MSkge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fSBlbHNlIGlmIChsYXN0Rm9jdXNlZEVkaXRvci52aWV3ID09PSB0aGlzLmlucHV0Q29kZUVkaXRvclZpZXcyKSB7XG5cdFx0XHRyZXR1cm4gMjtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fSk7XG5cblx0cHVibGljIHJlYWRvbmx5IHNlbGVjdGlvbkluQmFzZSA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRjb25zdCBzb3VyY2VFZGl0b3IgPSB0aGlzLmxhc3RGb2N1c2VkRWRpdG9yLnJlYWQocmVhZGVyKS52aWV3O1xuXHRcdGlmICghc291cmNlRWRpdG9yKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBzZWxlY3Rpb25zID0gc291cmNlRWRpdG9yLnNlbGVjdGlvbi5yZWFkKHJlYWRlcikgfHwgW107XG5cblx0XHRjb25zdCByYW5nZXNJbkJhc2UgPSBzZWxlY3Rpb25zLm1hcCgoc2VsZWN0aW9uKSA9PiB7XG5cdFx0XHRpZiAoc291cmNlRWRpdG9yID09PSB0aGlzLmlucHV0Q29kZUVkaXRvclZpZXcxKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLm1vZGVsLnRyYW5zbGF0ZUlucHV0UmFuZ2VUb0Jhc2UoMSwgc2VsZWN0aW9uKTtcblx0XHRcdH0gZWxzZSBpZiAoc291cmNlRWRpdG9yID09PSB0aGlzLmlucHV0Q29kZUVkaXRvclZpZXcyKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLm1vZGVsLnRyYW5zbGF0ZUlucHV0UmFuZ2VUb0Jhc2UoMiwgc2VsZWN0aW9uKTtcblx0XHRcdH0gZWxzZSBpZiAoc291cmNlRWRpdG9yID09PSB0aGlzLnJlc3VsdENvZGVFZGl0b3JWaWV3KSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLm1vZGVsLnRyYW5zbGF0ZVJlc3VsdFJhbmdlVG9CYXNlKHNlbGVjdGlvbik7XG5cdFx0XHR9IGVsc2UgaWYgKHNvdXJjZUVkaXRvciA9PT0gdGhpcy5iYXNlQ29kZUVkaXRvclZpZXcucmVhZChyZWFkZXIpKSB7XG5cdFx0XHRcdHJldHVybiBzZWxlY3Rpb247XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gc2VsZWN0aW9uO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJhbmdlc0luQmFzZSxcblx0XHRcdHNvdXJjZUVkaXRvclxuXHRcdH07XG5cdH0pO1xuXG5cdHByaXZhdGUgZ2V0UmFuZ2VPZk1vZGlmaWVkQmFzZVJhbmdlKGVkaXRvcjogQ29kZUVkaXRvclZpZXcsIG1vZGlmaWVkQmFzZVJhbmdlOiBNb2RpZmllZEJhc2VSYW5nZSwgcmVhZGVyOiBJUmVhZGVyIHwgdW5kZWZpbmVkKTogTGluZVJhbmdlIHtcblx0XHRpZiAoZWRpdG9yID09PSB0aGlzLnJlc3VsdENvZGVFZGl0b3JWaWV3KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXRMaW5lUmFuZ2VJblJlc3VsdChtb2RpZmllZEJhc2VSYW5nZS5iYXNlUmFuZ2UsIHJlYWRlcik7XG5cdFx0fSBlbHNlIGlmIChlZGl0b3IgPT09IHRoaXMuYmFzZUNvZGVFZGl0b3JWaWV3LmdldCgpKSB7XG5cdFx0XHRyZXR1cm4gbW9kaWZpZWRCYXNlUmFuZ2UuYmFzZVJhbmdlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBpbnB1dCA9IGVkaXRvciA9PT0gdGhpcy5pbnB1dENvZGVFZGl0b3JWaWV3MSA/IDEgOiAyO1xuXHRcdFx0cmV0dXJuIG1vZGlmaWVkQmFzZVJhbmdlLmdldElucHV0UmFuZ2UoaW5wdXQpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyByZWFkb25seSBhY3RpdmVNb2RpZmllZEJhc2VSYW5nZSA9IGRlcml2ZWQodGhpcyxcblx0XHQocmVhZGVyKSA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIGFjdGl2ZU1vZGlmaWVkQmFzZVJhbmdlICovXG5cdFx0XHRjb25zdCBmb2N1c2VkRWRpdG9yID0gdGhpcy5sYXN0Rm9jdXNlZEVkaXRvci5yZWFkKHJlYWRlcik7XG5cdFx0XHRjb25zdCBtYW51YWxSYW5nZSA9IHRoaXMubWFudWFsbHlTZXRBY3RpdmVNb2RpZmllZEJhc2VSYW5nZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAobWFudWFsUmFuZ2UuY291bnRlciA+IGZvY3VzZWRFZGl0b3IuY291bnRlcikge1xuXHRcdFx0XHRyZXR1cm4gbWFudWFsUmFuZ2UucmFuZ2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghZm9jdXNlZEVkaXRvci52aWV3KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGN1cnNvckxpbmVOdW1iZXIgPSBmb2N1c2VkRWRpdG9yLnZpZXcuY3Vyc29yTGluZU51bWJlci5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAoIWN1cnNvckxpbmVOdW1iZXIpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbW9kaWZpZWRCYXNlUmFuZ2VzID0gdGhpcy5tb2RlbC5tb2RpZmllZEJhc2VSYW5nZXMucmVhZChyZWFkZXIpO1xuXHRcdFx0cmV0dXJuIG1vZGlmaWVkQmFzZVJhbmdlcy5maW5kKChyKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJhbmdlID0gdGhpcy5nZXRSYW5nZU9mTW9kaWZpZWRCYXNlUmFuZ2UoZm9jdXNlZEVkaXRvci52aWV3ISwgciwgcmVhZGVyKTtcblx0XHRcdFx0cmV0dXJuIHJhbmdlLmlzRW1wdHlcblx0XHRcdFx0XHQ/IHJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gY3Vyc29yTGluZU51bWJlclxuXHRcdFx0XHRcdDogcmFuZ2UuY29udGFpbnMoY3Vyc29yTGluZU51bWJlcik7XG5cdFx0XHR9KTtcblx0XHR9XG5cdCk7XG5cblx0cHVibGljIHNldEFjdGl2ZU1vZGlmaWVkQmFzZVJhbmdlKHJhbmdlOiBNb2RpZmllZEJhc2VSYW5nZSB8IHVuZGVmaW5lZCwgdHg6IElUcmFuc2FjdGlvbik6IHZvaWQge1xuXHRcdHRoaXMubWFudWFsbHlTZXRBY3RpdmVNb2RpZmllZEJhc2VSYW5nZS5zZXQoeyByYW5nZSwgY291bnRlcjogdGhpcy5jb3VudGVyKysgfSwgdHgpO1xuXHR9XG5cblx0cHVibGljIHNldFN0YXRlKFxuXHRcdGJhc2VSYW5nZTogTW9kaWZpZWRCYXNlUmFuZ2UsXG5cdFx0c3RhdGU6IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUsXG5cdFx0dHg6IElUcmFuc2FjdGlvbixcblx0XHRpbnB1dE51bWJlcjogSW5wdXROdW1iZXIsXG5cdCk6IHZvaWQge1xuXHRcdHRoaXMubWFudWFsbHlTZXRBY3RpdmVNb2RpZmllZEJhc2VSYW5nZS5zZXQoeyByYW5nZTogYmFzZVJhbmdlLCBjb3VudGVyOiB0aGlzLmNvdW50ZXIrKyB9LCB0eCk7XG5cdFx0dGhpcy5tb2RlbC5zZXRTdGF0ZShiYXNlUmFuZ2UsIHN0YXRlLCBpbnB1dE51bWJlciwgdHgpO1xuXHRcdHRoaXMubGFzdEZvY3VzZWRFZGl0b3IuY2xlYXJDYWNoZSh0eCk7XG5cdH1cblxuXHRwcml2YXRlIGdvVG9Db25mbGljdChnZXRNb2RpZmllZEJhc2VSYW5nZTogKGVkaXRvcjogQ29kZUVkaXRvclZpZXcsIGN1ckxpbmVOdW1iZXI6IG51bWJlcikgPT4gTW9kaWZpZWRCYXNlUmFuZ2UgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRsZXQgZWRpdG9yID0gdGhpcy5sYXN0Rm9jdXNlZEVkaXRvci5nZXQoKS52aWV3O1xuXHRcdGlmICghZWRpdG9yKSB7XG5cdFx0XHRlZGl0b3IgPSB0aGlzLnJlc3VsdENvZGVFZGl0b3JWaWV3O1xuXHRcdH1cblx0XHRjb25zdCBjdXJMaW5lTnVtYmVyID0gZWRpdG9yLmVkaXRvci5nZXRQb3NpdGlvbigpPy5saW5lTnVtYmVyO1xuXHRcdGlmIChjdXJMaW5lTnVtYmVyID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgbW9kaWZpZWRCYXNlUmFuZ2UgPSBnZXRNb2RpZmllZEJhc2VSYW5nZShlZGl0b3IsIGN1ckxpbmVOdW1iZXIpO1xuXHRcdGlmIChtb2RpZmllZEJhc2VSYW5nZSkge1xuXHRcdFx0Y29uc3QgcmFuZ2UgPSB0aGlzLmdldFJhbmdlT2ZNb2RpZmllZEJhc2VSYW5nZShlZGl0b3IsIG1vZGlmaWVkQmFzZVJhbmdlLCB1bmRlZmluZWQpO1xuXHRcdFx0ZWRpdG9yLmVkaXRvci5mb2N1cygpO1xuXG5cdFx0XHRsZXQgc3RhcnRMaW5lTnVtYmVyID0gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0bGV0IGVuZExpbmVOdW1iZXJFeGNsdXNpdmUgPSByYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlO1xuXHRcdFx0aWYgKHJhbmdlLnN0YXJ0TGluZU51bWJlciA+IGVkaXRvci5lZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvdW50KCkpIHtcblx0XHRcdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0XHRcdHRoaXMuc2V0QWN0aXZlTW9kaWZpZWRCYXNlUmFuZ2UobW9kaWZpZWRCYXNlUmFuZ2UsIHR4KTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHN0YXJ0TGluZU51bWJlciA9IGVuZExpbmVOdW1iZXJFeGNsdXNpdmUgPSBlZGl0b3IuZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb3VudCgpO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3IuZWRpdG9yLnNldFBvc2l0aW9uKHtcblx0XHRcdFx0bGluZU51bWJlcjogc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRjb2x1bW46IGVkaXRvci5lZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNvbHVtbihzdGFydExpbmVOdW1iZXIpLFxuXHRcdFx0fSk7XG5cdFx0XHRlZGl0b3IuZWRpdG9yLnJldmVhbExpbmVzTmVhclRvcChzdGFydExpbmVOdW1iZXIsIGVuZExpbmVOdW1iZXJFeGNsdXNpdmUsIFNjcm9sbFR5cGUuU21vb3RoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ29Ub05leHRNb2RpZmllZEJhc2VSYW5nZShwcmVkaWNhdGU6IChtOiBNb2RpZmllZEJhc2VSYW5nZSkgPT4gYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuZ29Ub0NvbmZsaWN0KFxuXHRcdFx0KGUsIGwpID0+XG5cdFx0XHRcdHRoaXMubW9kZWwubW9kaWZpZWRCYXNlUmFuZ2VzXG5cdFx0XHRcdFx0LmdldCgpXG5cdFx0XHRcdFx0LmZpbmQoXG5cdFx0XHRcdFx0XHQocikgPT5cblx0XHRcdFx0XHRcdFx0cHJlZGljYXRlKHIpICYmXG5cdFx0XHRcdFx0XHRcdHRoaXMuZ2V0UmFuZ2VPZk1vZGlmaWVkQmFzZVJhbmdlKGUsIHIsIHVuZGVmaW5lZCkuc3RhcnRMaW5lTnVtYmVyID4gbFxuXHRcdFx0XHRcdCkgfHxcblx0XHRcdFx0dGhpcy5tb2RlbC5tb2RpZmllZEJhc2VSYW5nZXNcblx0XHRcdFx0XHQuZ2V0KClcblx0XHRcdFx0XHQuZmluZCgocikgPT4gcHJlZGljYXRlKHIpKVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgZ29Ub1ByZXZpb3VzTW9kaWZpZWRCYXNlUmFuZ2UocHJlZGljYXRlOiAobTogTW9kaWZpZWRCYXNlUmFuZ2UpID0+IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLmdvVG9Db25mbGljdChcblx0XHRcdChlLCBsKSA9PlxuXHRcdFx0XHRmaW5kTGFzdChcblx0XHRcdFx0XHR0aGlzLm1vZGVsLm1vZGlmaWVkQmFzZVJhbmdlcy5nZXQoKSxcblx0XHRcdFx0XHQocikgPT5cblx0XHRcdFx0XHRcdHByZWRpY2F0ZShyKSAmJlxuXHRcdFx0XHRcdFx0dGhpcy5nZXRSYW5nZU9mTW9kaWZpZWRCYXNlUmFuZ2UoZSwgciwgdW5kZWZpbmVkKS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlIDwgbFxuXHRcdFx0XHQpIHx8XG5cdFx0XHRcdGZpbmRMYXN0KFxuXHRcdFx0XHRcdHRoaXMubW9kZWwubW9kaWZpZWRCYXNlUmFuZ2VzLmdldCgpLFxuXHRcdFx0XHRcdChyKSA9PiBwcmVkaWNhdGUocilcblx0XHRcdFx0KVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgdG9nZ2xlQWN0aXZlQ29uZmxpY3QoaW5wdXROdW1iZXI6IDEgfCAyKTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0aXZlTW9kaWZpZWRCYXNlUmFuZ2UgPSB0aGlzLmFjdGl2ZU1vZGlmaWVkQmFzZVJhbmdlLmdldCgpO1xuXHRcdGlmICghYWN0aXZlTW9kaWZpZWRCYXNlUmFuZ2UpIHtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihsb2NhbGl6ZSgnbm9Db25mbGljdE1lc3NhZ2UnLCBcIlRoZXJlIGlzIGN1cnJlbnRseSBubyBjb25mbGljdCBmb2N1c2VkIHRoYXQgY2FuIGJlIHRvZ2dsZWQuXCIpKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBUb2dnbGUgQWN0aXZlIENvbmZsaWN0ICovXG5cdFx0XHR0aGlzLnNldFN0YXRlKFxuXHRcdFx0XHRhY3RpdmVNb2RpZmllZEJhc2VSYW5nZSxcblx0XHRcdFx0dGhpcy5tb2RlbC5nZXRTdGF0ZShhY3RpdmVNb2RpZmllZEJhc2VSYW5nZSkuZ2V0KCkudG9nZ2xlKGlucHV0TnVtYmVyKSxcblx0XHRcdFx0dHgsXG5cdFx0XHRcdGlucHV0TnVtYmVyLFxuXHRcdFx0KTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhY2NlcHRBbGwoaW5wdXROdW1iZXI6IDEgfCAyKTogdm9pZCB7XG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBUb2dnbGUgQWN0aXZlIENvbmZsaWN0ICovXG5cdFx0XHRmb3IgKGNvbnN0IHJhbmdlIG9mIHRoaXMubW9kZWwubW9kaWZpZWRCYXNlUmFuZ2VzLmdldCgpKSB7XG5cdFx0XHRcdHRoaXMuc2V0U3RhdGUoXG5cdFx0XHRcdFx0cmFuZ2UsXG5cdFx0XHRcdFx0dGhpcy5tb2RlbC5nZXRTdGF0ZShyYW5nZSkuZ2V0KCkud2l0aElucHV0VmFsdWUoaW5wdXROdW1iZXIsIHRydWUpLFxuXHRcdFx0XHRcdHR4LFxuXHRcdFx0XHRcdGlucHV0TnVtYmVyXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuY2xhc3MgQXR0YWNoZWRIaXN0b3J5IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgYXR0YWNoZWRIaXN0b3J5OiB7IGVsZW1lbnQ6IElBdHRhY2hlZEhpc3RvcnlFbGVtZW50OyBhbHRJZDogbnVtYmVyIH1bXSA9IFtdO1xuXHRwcml2YXRlIHByZXZpb3VzQWx0SWQ6IG51bWJlciA9IHRoaXMubW9kZWwuZ2V0QWx0ZXJuYXRpdmVWZXJzaW9uSWQoKTtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IG1vZGVsOiBJVGV4dE1vZGVsKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKG1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudCgoZSkgPT4ge1xuXHRcdFx0Y29uc3QgY3VycmVudEFsdElkID0gbW9kZWwuZ2V0QWx0ZXJuYXRpdmVWZXJzaW9uSWQoKTtcblxuXHRcdFx0aWYgKGUuaXNSZWRvaW5nKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmF0dGFjaGVkSGlzdG9yeSkge1xuXHRcdFx0XHRcdGlmICh0aGlzLnByZXZpb3VzQWx0SWQgPCBpdGVtLmFsdElkICYmIGl0ZW0uYWx0SWQgPD0gY3VycmVudEFsdElkKSB7XG5cdFx0XHRcdFx0XHRpdGVtLmVsZW1lbnQucmVkbygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChlLmlzVW5kb2luZykge1xuXHRcdFx0XHRmb3IgKGxldCBpID0gdGhpcy5hdHRhY2hlZEhpc3RvcnkubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdFx0XHRjb25zdCBpdGVtID0gdGhpcy5hdHRhY2hlZEhpc3RvcnlbaV07XG5cdFx0XHRcdFx0aWYgKGN1cnJlbnRBbHRJZCA8IGl0ZW0uYWx0SWQgJiYgaXRlbS5hbHRJZCA8PSB0aGlzLnByZXZpb3VzQWx0SWQpIHtcblx0XHRcdFx0XHRcdGl0ZW0uZWxlbWVudC51bmRvKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFRoZSB1c2VyIGRlc3Ryb3llZCB0aGUgcmVkbyBzdGFjayBieSBwZXJmb3JtaW5nIGEgbm9uIHJlZG8vdW5kbyBvcGVyYXRpb24uXG5cdFx0XHRcdC8vIFRodXMgd2UgYWxzbyBuZWVkIHRvIHJlbW92ZSBhbGwgaGlzdG9yeSBlbGVtZW50cyBhZnRlciB0aGUgbGFzdCB2ZXJzaW9uIGlkLlxuXHRcdFx0XHR3aGlsZSAoXG5cdFx0XHRcdFx0dGhpcy5hdHRhY2hlZEhpc3RvcnkubGVuZ3RoID4gMFxuXHRcdFx0XHRcdCYmIHRoaXMuYXR0YWNoZWRIaXN0b3J5W3RoaXMuYXR0YWNoZWRIaXN0b3J5Lmxlbmd0aCAtIDFdIS5hbHRJZCA+IHRoaXMucHJldmlvdXNBbHRJZFxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHR0aGlzLmF0dGFjaGVkSGlzdG9yeS5wb3AoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnByZXZpb3VzQWx0SWQgPSBjdXJyZW50QWx0SWQ7XG5cdFx0fSkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFB1c2hlcyBhbiBoaXN0b3J5IGl0ZW0gdGhhdCBpcyB0aWVkIHRvIHRoZSBsYXN0IHRleHQgZWRpdCAob3IgYW4gZXh0ZW5zaW9uIG9mIGl0KS5cblx0ICogV2hlbiB0aGUgbGFzdCB0ZXh0IGVkaXQgaXMgdW5kb25lL3JlZG9uZSwgc28gaXMgaXMgdGhpcyBoaXN0b3J5IGl0ZW0uXG5cdCAqL1xuXHRwdWJsaWMgcHVzaEF0dGFjaGVkSGlzdG9yeUVsZW1lbnQoZWxlbWVudDogSUF0dGFjaGVkSGlzdG9yeUVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLmF0dGFjaGVkSGlzdG9yeS5wdXNoKHsgYWx0SWQ6IHRoaXMubW9kZWwuZ2V0QWx0ZXJuYXRpdmVWZXJzaW9uSWQoKSwgZWxlbWVudCB9KTtcblx0fVxufVxuXG5pbnRlcmZhY2UgSUF0dGFjaGVkSGlzdG9yeUVsZW1lbnQge1xuXHR1bmRvKCk6IHZvaWQ7XG5cdHJlZG8oKTogdm9pZDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxTQUFTLG9DQUF3RSxpQkFBaUIsbUJBQW1CO0FBQzlILFNBQVMsYUFBYTtBQUN0QixTQUFTLGtCQUFrQjtBQUUzQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGlCQUFpQjtBQUcxQixTQUFTLDZCQUE2QjtBQU0vQixJQUFNLHVCQUFOLGNBQW1DLFdBQVc7QUFBQSxFQU9wRCxZQUNpQixPQUNBLHNCQUNBLHNCQUNBLHNCQUNBLG9CQUNBLDJCQUN3QixzQkFDRCxxQkFDdEM7QUFDRCxVQUFNO0FBVFU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ3dCO0FBQ0Q7QUFkeEMsU0FBaUIscUNBQXFDLGdCQUVwRCxNQUFNLEVBQUUsT0FBTyxRQUFXLFNBQVMsRUFBRSxDQUFDO0FBRXhDLFNBQWlCLGtCQUFrQixLQUFLLFVBQVUsSUFBSSxnQkFBZ0IsS0FBSyxNQUFNLGVBQWUsQ0FBQztBQTREakcsU0FBZ0IsaUNBQWlDO0FBQUEsTUFDaEQ7QUFBQSxNQUNBO0FBQUEsTUFDQSxLQUFLO0FBQUEsSUFDTjtBQUVBLFNBQVEsVUFBVTtBQUNsQixTQUFpQixvQkFBb0IsbUNBRW5DLE1BQU0sQ0FBQyxRQUFRLGNBQWM7QUFDOUIsWUFBTSxVQUFVO0FBQUEsUUFDZixLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxLQUFLLG1CQUFtQixLQUFLLE1BQU07QUFBQSxNQUNwQztBQUNBLFlBQU0sT0FBTyxRQUFRLEtBQUssQ0FBQyxNQUFNLEtBQUssRUFBRSxVQUFVLEtB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
