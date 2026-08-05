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
import { reset } from "../../../../../../base/browser/dom.js";
import { ActionBar } from "../../../../../../base/browser/ui/actionbar/actionbar.js";
import { renderLabelWithIcons } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { CompareResult } from "../../../../../../base/common/arrays.js";
import { BugIndicatingError } from "../../../../../../base/common/errors.js";
import { toDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, derived } from "../../../../../../base/common/observable.js";
import { MinimapPosition, OverviewRulerLane } from "../../../../../../editor/common/model.js";
import { localize } from "../../../../../../nls.js";
import { MenuId } from "../../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../../platform/label/common/label.js";
import { LineRange } from "../../model/lineRange.js";
import { applyObservableDecorations, join } from "../../utils.js";
import { handledConflictMinimapOverViewRulerColor, unhandledConflictMinimapOverViewRulerColor } from "../colors.js";
import { EditorGutter } from "../editorGutter.js";
import { ctxIsMergeResultEditor } from "../../../common/mergeEditor.js";
import { CodeEditorView, createSelectionsAutorun, TitleMenu } from "./codeEditorView.js";
let ResultCodeEditorView = class extends CodeEditorView {
  constructor(viewModel, instantiationService, _labelService, configurationService) {
    super(instantiationService, viewModel, configurationService);
    this._labelService = _labelService;
    this.decorations = derived(this, (reader) => {
      const viewModel = this.viewModel.read(reader);
      if (!viewModel) {
        return [];
      }
      const model = viewModel.model;
      const textModel = model.resultTextModel;
      const result = new Array();
      const baseRangeWithStoreAndTouchingDiffs = join(
        model.modifiedBaseRanges.read(reader),
        model.baseResultDiffs.read(reader),
        (baseRange, diff) => baseRange.baseRange.touches(diff.inputRange) ? CompareResult.neitherLessOrGreaterThan : LineRange.compareByStart(
          baseRange.baseRange,
          diff.inputRange
        )
      );
      const activeModifiedBaseRange = viewModel.activeModifiedBaseRange.read(reader);
      const showNonConflictingChanges = viewModel.showNonConflictingChanges.read(reader);
      for (const m of baseRangeWithStoreAndTouchingDiffs) {
        const modifiedBaseRange = m.left;
        if (modifiedBaseRange) {
          const blockClassNames = ["merge-editor-block"];
          let blockPadding = [0, 0, 0, 0];
          const isHandled = model.isHandled(modifiedBaseRange).read(reader);
          if (isHandled) {
            blockClassNames.push("handled");
          }
          if (modifiedBaseRange === activeModifiedBaseRange) {
            blockClassNames.push("focused");
            blockPadding = [0, 2, 0, 2];
          }
          if (modifiedBaseRange.isConflicting) {
            blockClassNames.push("conflicting");
          }
          blockClassNames.push("result");
          if (!modifiedBaseRange.isConflicting && !showNonConflictingChanges && isHandled) {
            continue;
          }
          const range = model.getLineRangeInResult(modifiedBaseRange.baseRange, reader);
          result.push({
            range: range.toInclusiveRangeOrEmpty(),
            options: {
              showIfCollapsed: true,
              blockClassName: blockClassNames.join(" "),
              blockPadding,
              blockIsAfterEnd: range.startLineNumber > textModel.getLineCount(),
              description: "Result Diff",
              minimap: {
                position: MinimapPosition.Gutter,
                color: { id: isHandled ? handledConflictMinimapOverViewRulerColor : unhandledConflictMinimapOverViewRulerColor }
              },
              overviewRuler: modifiedBaseRange.isConflicting ? {
                position: OverviewRulerLane.Center,
                color: { id: isHandled ? handledConflictMinimapOverViewRulerColor : unhandledConflictMinimapOverViewRulerColor }
              } : void 0
            }
          });
        }
        if (!modifiedBaseRange || modifiedBaseRange.isConflicting) {
          for (const diff of m.rights) {
            const range = diff.outputRange.toInclusiveRange();
            if (range) {
              result.push({
                range,
                options: {
                  className: `merge-editor-diff result`,
                  description: "Merge Editor",
                  isWholeLine: true
                }
              });
            }
            if (diff.rangeMappings) {
              for (const d of diff.rangeMappings) {
                result.push({
                  range: d.outputRange,
                  options: {
                    className: `merge-editor-diff-word result`,
                    description: "Merge Editor"
                  }
                });
              }
            }
          }
        }
      }
      return result;
    });
    this.editor.invokeWithinContext((accessor) => {
      const contextKeyService = accessor.get(IContextKeyService);
      const isMergeResultEditor = ctxIsMergeResultEditor.bindTo(contextKeyService);
      isMergeResultEditor.set(true);
      this._register(toDisposable(() => isMergeResultEditor.reset()));
    });
    this.htmlElements.gutterDiv.style.width = "5px";
    this.htmlElements.root.classList.add(`result`);
    this._register(
      autorunWithStore((reader, store) => {
        if (this.checkboxesVisible.read(reader)) {
          store.add(new EditorGutter(this.editor, this.htmlElements.gutterDiv, {
            getIntersectingGutterItems: (range, reader2) => [],
            createView: (item, target) => {
              throw new BugIndicatingError();
            }
          }));
        }
      })
    );
    this._register(autorun((reader) => {
      const vm = this.viewModel.read(reader);
      if (!vm) {
        return;
      }
      this.editor.setModel(vm.model.resultTextModel);
      reset(this.htmlElements.title, ...renderLabelWithIcons(localize("result", "Result")));
      reset(this.htmlElements.description, ...renderLabelWithIcons(this._labelService.getUriLabel(vm.model.resultTextModel.uri, { relative: true })));
    }));
    const remainingConflictsActionBar = this._register(new ActionBar(this.htmlElements.detail));
    this._register(autorun((reader) => {
      const vm = this.viewModel.read(reader);
      if (!vm) {
        return;
      }
      const model = vm.model;
      if (!model) {
        return;
      }
      const count = model.unhandledConflictsCount.read(reader);
      const text = count === 1 ? localize(
        "mergeEditor.remainingConflicts",
        "{0} Conflict Remaining",
        count
      ) : localize(
        "mergeEditor.remainingConflict",
        "{0} Conflicts Remaining ",
        count
      );
      remainingConflictsActionBar.clear();
      remainingConflictsActionBar.push({
        class: void 0,
        enabled: count > 0,
        id: "nextConflict",
        label: text,
        run() {
          vm.model.telemetry.reportConflictCounterClicked();
          vm.goToNextModifiedBaseRange((m) => !model.isHandled(m).get());
        },
        tooltip: count > 0 ? localize("goToNextConflict", "Go to next conflict") : localize("allConflictHandled", "All conflicts handled, the merge can be completed now.")
      });
    }));
    this._register(applyObservableDecorations(this.editor, this.decorations));
    this._register(
      createSelectionsAutorun(
        this,
        (baseRange, viewModel2) => viewModel2.model.translateBaseRangeToResult(baseRange)
      )
    );
    this._register(
      instantiationService.createInstance(
        TitleMenu,
        MenuId.MergeInputResultToolbar,
        this.htmlElements.toolbar
      )
    );
  }
};
ResultCodeEditorView = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILabelService),
  __decorateParam(3, IConfigurationService)
], ResultCodeEditorView);
export {
  ResultCodeEditorView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL3ZpZXcvZWRpdG9ycy9yZXN1bHRDb2RlRWRpdG9yVmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IHJlc2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyByZW5kZXJMYWJlbFdpdGhJY29ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvaWNvbkxhYmVscy5qcyc7XG5pbXBvcnQgeyBDb21wYXJlUmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IEJ1Z0luZGljYXRpbmdFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1biwgYXV0b3J1bldpdGhTdG9yZSwgZGVyaXZlZCwgSU9ic2VydmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IElNb2RlbERlbHRhRGVjb3JhdGlvbiwgTWluaW1hcFBvc2l0aW9uLCBPdmVydmlld1J1bGVyTGFuZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IExpbmVSYW5nZSB9IGZyb20gJy4uLy4uL21vZGVsL2xpbmVSYW5nZS5qcyc7XG5pbXBvcnQgeyBhcHBseU9ic2VydmFibGVEZWNvcmF0aW9ucywgam9pbiB9IGZyb20gJy4uLy4uL3V0aWxzLmpzJztcbmltcG9ydCB7IGhhbmRsZWRDb25mbGljdE1pbmltYXBPdmVyVmlld1J1bGVyQ29sb3IsIHVuaGFuZGxlZENvbmZsaWN0TWluaW1hcE92ZXJWaWV3UnVsZXJDb2xvciB9IGZyb20gJy4uL2NvbG9ycy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JHdXR0ZXIgfSBmcm9tICcuLi9lZGl0b3JHdXR0ZXIuanMnO1xuaW1wb3J0IHsgTWVyZ2VFZGl0b3JWaWV3TW9kZWwgfSBmcm9tICcuLi92aWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgY3R4SXNNZXJnZVJlc3VsdEVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tZXJnZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBDb2RlRWRpdG9yVmlldywgY3JlYXRlU2VsZWN0aW9uc0F1dG9ydW4sIFRpdGxlTWVudSB9IGZyb20gJy4vY29kZUVkaXRvclZpZXcuanMnO1xuXG5leHBvcnQgY2xhc3MgUmVzdWx0Q29kZUVkaXRvclZpZXcgZXh0ZW5kcyBDb2RlRWRpdG9yVmlldyB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHZpZXdNb2RlbDogSU9ic2VydmFibGU8TWVyZ2VFZGl0b3JWaWV3TW9kZWwgfCB1bmRlZmluZWQ+LFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihpbnN0YW50aWF0aW9uU2VydmljZSwgdmlld01vZGVsLCBjb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHR0aGlzLmVkaXRvci5pbnZva2VXaXRoaW5Db250ZXh0KGFjY2Vzc29yID0+IHtcblx0XHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0XHRjb25zdCBpc01lcmdlUmVzdWx0RWRpdG9yID0gY3R4SXNNZXJnZVJlc3VsdEVkaXRvci5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0aXNNZXJnZVJlc3VsdEVkaXRvci5zZXQodHJ1ZSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gaXNNZXJnZVJlc3VsdEVkaXRvci5yZXNldCgpKSk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLmh0bWxFbGVtZW50cy5ndXR0ZXJEaXYuc3R5bGUud2lkdGggPSAnNXB4Jztcblx0XHR0aGlzLmh0bWxFbGVtZW50cy5yb290LmNsYXNzTGlzdC5hZGQoYHJlc3VsdGApO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoXG5cdFx0XHRhdXRvcnVuV2l0aFN0b3JlKChyZWFkZXIsIHN0b3JlKSA9PiB7XG5cdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gdXBkYXRlIGNoZWNrYm94ZXMgKi9cblx0XHRcdFx0aWYgKHRoaXMuY2hlY2tib3hlc1Zpc2libGUucmVhZChyZWFkZXIpKSB7XG5cdFx0XHRcdFx0c3RvcmUuYWRkKG5ldyBFZGl0b3JHdXR0ZXIodGhpcy5lZGl0b3IsIHRoaXMuaHRtbEVsZW1lbnRzLmd1dHRlckRpdiwge1xuXHRcdFx0XHRcdFx0Z2V0SW50ZXJzZWN0aW5nR3V0dGVySXRlbXM6IChyYW5nZSwgcmVhZGVyKSA9PiBbXSxcblx0XHRcdFx0XHRcdGNyZWF0ZVZpZXc6IChpdGVtLCB0YXJnZXQpID0+IHsgdGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcigpOyB9LFxuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHQpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiB1cGRhdGUgbGFiZWxzICYgdGV4dCBtb2RlbCAqL1xuXHRcdFx0Y29uc3Qgdm0gPSB0aGlzLnZpZXdNb2RlbC5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAoIXZtKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuZWRpdG9yLnNldE1vZGVsKHZtLm1vZGVsLnJlc3VsdFRleHRNb2RlbCk7XG5cdFx0XHRyZXNldCh0aGlzLmh0bWxFbGVtZW50cy50aXRsZSwgLi4ucmVuZGVyTGFiZWxXaXRoSWNvbnMobG9jYWxpemUoJ3Jlc3VsdCcsICdSZXN1bHQnKSkpO1xuXHRcdFx0cmVzZXQodGhpcy5odG1sRWxlbWVudHMuZGVzY3JpcHRpb24sIC4uLnJlbmRlckxhYmVsV2l0aEljb25zKHRoaXMuX2xhYmVsU2VydmljZS5nZXRVcmlMYWJlbCh2bS5tb2RlbC5yZXN1bHRUZXh0TW9kZWwudXJpLCB7IHJlbGF0aXZlOiB0cnVlIH0pKSk7XG5cdFx0fSkpO1xuXG5cblx0XHRjb25zdCByZW1haW5pbmdDb25mbGljdHNBY3Rpb25CYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgQWN0aW9uQmFyKHRoaXMuaHRtbEVsZW1lbnRzLmRldGFpbCkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiB1cGRhdGUgcmVtYWluaW5nQ29uZmxpY3RzIGxhYmVsICovXG5cdFx0XHRjb25zdCB2bSA9IHRoaXMudmlld01vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghdm0pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtb2RlbCA9IHZtLm1vZGVsO1xuXHRcdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBjb3VudCA9IG1vZGVsLnVuaGFuZGxlZENvbmZsaWN0c0NvdW50LnJlYWQocmVhZGVyKTtcblxuXHRcdFx0Y29uc3QgdGV4dCA9IGNvdW50ID09PSAxXG5cdFx0XHRcdD8gbG9jYWxpemUoXG5cdFx0XHRcdFx0J21lcmdlRWRpdG9yLnJlbWFpbmluZ0NvbmZsaWN0cycsXG5cdFx0XHRcdFx0J3swfSBDb25mbGljdCBSZW1haW5pbmcnLFxuXHRcdFx0XHRcdGNvdW50XG5cdFx0XHRcdClcblx0XHRcdFx0OiBsb2NhbGl6ZShcblx0XHRcdFx0XHQnbWVyZ2VFZGl0b3IucmVtYWluaW5nQ29uZmxpY3QnLFxuXHRcdFx0XHRcdCd7MH0gQ29uZmxpY3RzIFJlbWFpbmluZyAnLFxuXHRcdFx0XHRcdGNvdW50XG5cdFx0XHRcdCk7XG5cblx0XHRcdHJlbWFpbmluZ0NvbmZsaWN0c0FjdGlvbkJhci5jbGVhcigpO1xuXHRcdFx0cmVtYWluaW5nQ29uZmxpY3RzQWN0aW9uQmFyLnB1c2goe1xuXHRcdFx0XHRjbGFzczogdW5kZWZpbmVkLFxuXHRcdFx0XHRlbmFibGVkOiBjb3VudCA+IDAsXG5cdFx0XHRcdGlkOiAnbmV4dENvbmZsaWN0Jyxcblx0XHRcdFx0bGFiZWw6IHRleHQsXG5cdFx0XHRcdHJ1bigpIHtcblx0XHRcdFx0XHR2bS5tb2RlbC50ZWxlbWV0cnkucmVwb3J0Q29uZmxpY3RDb3VudGVyQ2xpY2tlZCgpO1xuXHRcdFx0XHRcdHZtLmdvVG9OZXh0TW9kaWZpZWRCYXNlUmFuZ2UobSA9PiAhbW9kZWwuaXNIYW5kbGVkKG0pLmdldCgpKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0dG9vbHRpcDogY291bnQgPiAwXG5cdFx0XHRcdFx0PyBsb2NhbGl6ZSgnZ29Ub05leHRDb25mbGljdCcsICdHbyB0byBuZXh0IGNvbmZsaWN0Jylcblx0XHRcdFx0XHQ6IGxvY2FsaXplKCdhbGxDb25mbGljdEhhbmRsZWQnLCAnQWxsIGNvbmZsaWN0cyBoYW5kbGVkLCB0aGUgbWVyZ2UgY2FuIGJlIGNvbXBsZXRlZCBub3cuJyksXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFwcGx5T2JzZXJ2YWJsZURlY29yYXRpb25zKHRoaXMuZWRpdG9yLCB0aGlzLmRlY29yYXRpb25zKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihcblx0XHRcdGNyZWF0ZVNlbGVjdGlvbnNBdXRvcnVuKHRoaXMsIChiYXNlUmFuZ2UsIHZpZXdNb2RlbCkgPT5cblx0XHRcdFx0dmlld01vZGVsLm1vZGVsLnRyYW5zbGF0ZUJhc2VSYW5nZVRvUmVzdWx0KGJhc2VSYW5nZSlcblx0XHRcdClcblx0XHQpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFx0VGl0bGVNZW51LFxuXHRcdFx0XHRNZW51SWQuTWVyZ2VJbnB1dFJlc3VsdFRvb2xiYXIsXG5cdFx0XHRcdHRoaXMuaHRtbEVsZW1lbnRzLnRvb2xiYXJcblx0XHRcdClcblx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBkZWNvcmF0aW9ucyA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRjb25zdCB2aWV3TW9kZWwgPSB0aGlzLnZpZXdNb2RlbC5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCF2aWV3TW9kZWwpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0Y29uc3QgbW9kZWwgPSB2aWV3TW9kZWwubW9kZWw7XG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gbW9kZWwucmVzdWx0VGV4dE1vZGVsO1xuXHRcdGNvbnN0IHJlc3VsdCA9IG5ldyBBcnJheTxJTW9kZWxEZWx0YURlY29yYXRpb24+KCk7XG5cblx0XHRjb25zdCBiYXNlUmFuZ2VXaXRoU3RvcmVBbmRUb3VjaGluZ0RpZmZzID0gam9pbihcblx0XHRcdG1vZGVsLm1vZGlmaWVkQmFzZVJhbmdlcy5yZWFkKHJlYWRlciksXG5cdFx0XHRtb2RlbC5iYXNlUmVzdWx0RGlmZnMucmVhZChyZWFkZXIpLFxuXHRcdFx0KGJhc2VSYW5nZSwgZGlmZikgPT4gYmFzZVJhbmdlLmJhc2VSYW5nZS50b3VjaGVzKGRpZmYuaW5wdXRSYW5nZSlcblx0XHRcdFx0PyBDb21wYXJlUmVzdWx0Lm5laXRoZXJMZXNzT3JHcmVhdGVyVGhhblxuXHRcdFx0XHQ6IExpbmVSYW5nZS5jb21wYXJlQnlTdGFydChcblx0XHRcdFx0XHRiYXNlUmFuZ2UuYmFzZVJhbmdlLFxuXHRcdFx0XHRcdGRpZmYuaW5wdXRSYW5nZVxuXHRcdFx0XHQpXG5cdFx0KTtcblxuXHRcdGNvbnN0IGFjdGl2ZU1vZGlmaWVkQmFzZVJhbmdlID0gdmlld01vZGVsLmFjdGl2ZU1vZGlmaWVkQmFzZVJhbmdlLnJlYWQocmVhZGVyKTtcblxuXHRcdGNvbnN0IHNob3dOb25Db25mbGljdGluZ0NoYW5nZXMgPSB2aWV3TW9kZWwuc2hvd05vbkNvbmZsaWN0aW5nQ2hhbmdlcy5yZWFkKHJlYWRlcik7XG5cblx0XHRmb3IgKGNvbnN0IG0gb2YgYmFzZVJhbmdlV2l0aFN0b3JlQW5kVG91Y2hpbmdEaWZmcykge1xuXHRcdFx0Y29uc3QgbW9kaWZpZWRCYXNlUmFuZ2UgPSBtLmxlZnQ7XG5cblx0XHRcdGlmIChtb2RpZmllZEJhc2VSYW5nZSkge1xuXHRcdFx0XHRjb25zdCBibG9ja0NsYXNzTmFtZXMgPSBbJ21lcmdlLWVkaXRvci1ibG9jayddO1xuXHRcdFx0XHRsZXQgYmxvY2tQYWRkaW5nOiBbdG9wOiBudW1iZXIsIHJpZ2h0OiBudW1iZXIsIGJvdHRvbTogbnVtYmVyLCBsZWZ0OiBudW1iZXJdID0gWzAsIDAsIDAsIDBdO1xuXHRcdFx0XHRjb25zdCBpc0hhbmRsZWQgPSBtb2RlbC5pc0hhbmRsZWQobW9kaWZpZWRCYXNlUmFuZ2UpLnJlYWQocmVhZGVyKTtcblx0XHRcdFx0aWYgKGlzSGFuZGxlZCkge1xuXHRcdFx0XHRcdGJsb2NrQ2xhc3NOYW1lcy5wdXNoKCdoYW5kbGVkJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG1vZGlmaWVkQmFzZVJhbmdlID09PSBhY3RpdmVNb2RpZmllZEJhc2VSYW5nZSkge1xuXHRcdFx0XHRcdGJsb2NrQ2xhc3NOYW1lcy5wdXNoKCdmb2N1c2VkJyk7XG5cdFx0XHRcdFx0YmxvY2tQYWRkaW5nID0gWzAsIDIsIDAsIDJdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChtb2RpZmllZEJhc2VSYW5nZS5pc0NvbmZsaWN0aW5nKSB7XG5cdFx0XHRcdFx0YmxvY2tDbGFzc05hbWVzLnB1c2goJ2NvbmZsaWN0aW5nJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YmxvY2tDbGFzc05hbWVzLnB1c2goJ3Jlc3VsdCcpO1xuXG5cdFx0XHRcdGlmICghbW9kaWZpZWRCYXNlUmFuZ2UuaXNDb25mbGljdGluZyAmJiAhc2hvd05vbkNvbmZsaWN0aW5nQ2hhbmdlcyAmJiBpc0hhbmRsZWQpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHJhbmdlID0gbW9kZWwuZ2V0TGluZVJhbmdlSW5SZXN1bHQobW9kaWZpZWRCYXNlUmFuZ2UuYmFzZVJhbmdlLCByZWFkZXIpO1xuXHRcdFx0XHRyZXN1bHQucHVzaCh7XG5cdFx0XHRcdFx0cmFuZ2U6IHJhbmdlLnRvSW5jbHVzaXZlUmFuZ2VPckVtcHR5KCksXG5cdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0c2hvd0lmQ29sbGFwc2VkOiB0cnVlLFxuXHRcdFx0XHRcdFx0YmxvY2tDbGFzc05hbWU6IGJsb2NrQ2xhc3NOYW1lcy5qb2luKCcgJyksXG5cdFx0XHRcdFx0XHRibG9ja1BhZGRpbmcsXG5cdFx0XHRcdFx0XHRibG9ja0lzQWZ0ZXJFbmQ6IHJhbmdlLnN0YXJ0TGluZU51bWJlciA+IHRleHRNb2RlbC5nZXRMaW5lQ291bnQoKSxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAnUmVzdWx0IERpZmYnLFxuXHRcdFx0XHRcdFx0bWluaW1hcDoge1xuXHRcdFx0XHRcdFx0XHRwb3NpdGlvbjogTWluaW1hcFBvc2l0aW9uLkd1dHRlcixcblx0XHRcdFx0XHRcdFx0Y29sb3I6IHsgaWQ6IGlzSGFuZGxlZCA/IGhhbmRsZWRDb25mbGljdE1pbmltYXBPdmVyVmlld1J1bGVyQ29sb3IgOiB1bmhhbmRsZWRDb25mbGljdE1pbmltYXBPdmVyVmlld1J1bGVyQ29sb3IgfSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRvdmVydmlld1J1bGVyOiBtb2RpZmllZEJhc2VSYW5nZS5pc0NvbmZsaWN0aW5nID8ge1xuXHRcdFx0XHRcdFx0XHRwb3NpdGlvbjogT3ZlcnZpZXdSdWxlckxhbmUuQ2VudGVyLFxuXHRcdFx0XHRcdFx0XHRjb2xvcjogeyBpZDogaXNIYW5kbGVkID8gaGFuZGxlZENvbmZsaWN0TWluaW1hcE92ZXJWaWV3UnVsZXJDb2xvciA6IHVuaGFuZGxlZENvbmZsaWN0TWluaW1hcE92ZXJWaWV3UnVsZXJDb2xvciB9LFxuXHRcdFx0XHRcdFx0fSA6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghbW9kaWZpZWRCYXNlUmFuZ2UgfHwgbW9kaWZpZWRCYXNlUmFuZ2UuaXNDb25mbGljdGluZykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGRpZmYgb2YgbS5yaWdodHMpIHtcblx0XHRcdFx0XHRjb25zdCByYW5nZSA9IGRpZmYub3V0cHV0UmFuZ2UudG9JbmNsdXNpdmVSYW5nZSgpO1xuXHRcdFx0XHRcdGlmIChyYW5nZSkge1xuXHRcdFx0XHRcdFx0cmVzdWx0LnB1c2goe1xuXHRcdFx0XHRcdFx0XHRyYW5nZSxcblx0XHRcdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRcdGNsYXNzTmFtZTogYG1lcmdlLWVkaXRvci1kaWZmIHJlc3VsdGAsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdNZXJnZSBFZGl0b3InLFxuXHRcdFx0XHRcdFx0XHRcdGlzV2hvbGVMaW5lOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoZGlmZi5yYW5nZU1hcHBpbmdzKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGQgb2YgZGlmZi5yYW5nZU1hcHBpbmdzKSB7XG5cdFx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHRyYW5nZTogZC5vdXRwdXRSYW5nZSxcblx0XHRcdFx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRjbGFzc05hbWU6IGBtZXJnZS1lZGl0b3ItZGlmZi13b3JkIHJlc3VsdGAsXG5cdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ01lcmdlIEVkaXRvcidcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9KTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsU0FBUyxrQkFBa0IsZUFBNEI7QUFDaEUsU0FBZ0MsaUJBQWlCLHlCQUF5QjtBQUMxRSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGNBQWM7QUFDdkIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyw0QkFBNEIsWUFBWTtBQUNqRCxTQUFTLDBDQUEwQyxrREFBa0Q7QUFDckcsU0FBUyxvQkFBb0I7QUFFN0IsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxnQkFBZ0IseUJBQXlCLGlCQUFpQjtBQUU1RCxJQUFNLHVCQUFOLGNBQW1DLGVBQWU7QUFBQSxFQUN4RCxZQUNDLFdBQ3VCLHNCQUNTLGVBQ1Qsc0JBQ3RCO0FBQ0Qs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YyxZQUFZLEdBQUcsTUFBTSxnQkFBZ0IsS0FBSyxFQUFFLFVBQVUsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUFBLElBQy9JLENBQUMsQ0FBQztBQUdGLFVBQU0sOEJBQThCLEtBQUssVUFBVSxJQUFJLFVBQVUsS0FBSyxhQUFhLE1BQU0sQ0FBQztBQUUxRixTQUFLLFVBQVUsUUFBUSxZQUFVO0FBRWhDLFlBQU0sS0FBSyxLQUFLLFVBQVUsS0FBSyxNQUFNO0FBQ3JDLFVBQUksQ0FBQyxJQUFJO0FBQ1I7QUFBQSxNQUNEO0FBRUEsWUFBTSxRQUFRLEdBQUc7QUFDakIsVUFBSSxDQUFDLE9BQU87QUFDWDtBQUFBLE1BQ0Q7QUFDQSxZQUFNLFFBQVEsTUFBTSx3QkFBd0IsS0FBSyxNQUFNO0FBRXZELFlBQU0sT0FBTyxVQUFVLElBQ3BCO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRCxJQUNFO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUVELGtDQUE0QixNQUFNO0FBQ2xDLGtDQUE0QixLQUFLO0FBQUEsUUFDaEMsT0FBTztBQUFBLFFBQ1AsU0FBUyxRQUFRO0FBQUEsUUFDakIsSUFBSTtBQUFBLFFBQ0osT0FBTztBQUFBLFFBQ1AsTUFBTTtBQUNMLGFBQUcsTUFBTSxVQUFVLDZCQUE2QjtBQUNoRCxhQUFHLDBCQUEwQixPQUFLLENBQUMsTUFBTSxVQUFVLENBQUMsRUFBRSxJQUFJLENBQUM7QUFBQSxRQUM1RDtBQUFBLFFBQ0EsU0FBUyxRQUFRLElBQ2QsU0FBUyxvQkFBb0IscUJBQXFCLElBQ2xELFNBQVMsc0JBQXNCLHdEQUF3RDtBQUFBLE1BQzNGLENBQUM7QUFBQSxJQUNGLENBQUMsQ0FBQztBQUdGLFNBQUssVUFBVSwyQkFBMkIsS0FBSyxRQUFRLEtBQUssV0FBVyxDQUFDO0FBRXhFLFNBQUs7QUFBQSxNQUNKO0FBQUEsUUFBd0I7QUFBQSxRQUFNLENBQUMsV0FBV0MsZUFDekNBLFdBQVUsTUFBTSwyQkFBMkIsU0FBUztBQUFBLE1BQ3JEO0FBQUEsSUFDRDtBQUVBLFNBQUs7QUFBQSxNQUNKLHFCQUFxQjtBQUFBLFFBQ3BCO0FBQUEsUUFDQSxPQUFPO0FBQUEsUUFDUCxLQUFLLGFBQWE7QUFBQSxNQUNuQjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBb0dEO0FBMU1hLHVCQUFOO0FBQUEsRUFHSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FMVTsiLAogICJuYW1lcyI6IFsicmVhZGVyIiwgInZpZXdNb2RlbCJdCn0K
