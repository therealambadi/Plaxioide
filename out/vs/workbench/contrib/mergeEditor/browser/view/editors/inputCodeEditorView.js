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
import { addDisposableListener, EventType, h, reset } from "../../../../../../base/browser/dom.js";
import { renderLabelWithIcons } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Toggle } from "../../../../../../base/browser/ui/toggle/toggle.js";
import { Action, Separator } from "../../../../../../base/common/actions.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { clamp } from "../../../../../../base/common/numbers.js";
import { autorun, autorunOpts, derived, derivedOpts, observableValue, transaction } from "../../../../../../base/common/observable.js";
import { noBreakWhitespace } from "../../../../../../base/common/strings.js";
import { isDefined } from "../../../../../../base/common/types.js";
import { MinimapPosition, OverviewRulerLane } from "../../../../../../editor/common/model.js";
import { localize } from "../../../../../../nls.js";
import { MenuId } from "../../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { defaultToggleStyles } from "../../../../../../platform/theme/browser/defaultStyles.js";
import { InputState } from "../../model/modifiedBaseRange.js";
import { applyObservableDecorations, setFields } from "../../utils.js";
import { handledConflictMinimapOverViewRulerColor, unhandledConflictMinimapOverViewRulerColor } from "../colors.js";
import { EditorGutter } from "../editorGutter.js";
import { CodeEditorView, createSelectionsAutorun, TitleMenu } from "./codeEditorView.js";
let InputCodeEditorView = class extends CodeEditorView {
  constructor(inputNumber, viewModel, instantiationService, contextMenuService, configurationService) {
    super(instantiationService, viewModel, configurationService);
    this.inputNumber = inputNumber;
    this.otherInputNumber = this.inputNumber === 1 ? 2 : 1;
    this.modifiedBaseRangeGutterItemInfos = derivedOpts({ debugName: `input${this.inputNumber}.modifiedBaseRangeGutterItemInfos` }, (reader) => {
      const viewModel = this.viewModel.read(reader);
      if (!viewModel) {
        return [];
      }
      const model = viewModel.model;
      const inputNumber = this.inputNumber;
      const showNonConflictingChanges = viewModel.showNonConflictingChanges.read(reader);
      return model.modifiedBaseRanges.read(reader).filter((r) => r.getInputDiffs(this.inputNumber).length > 0 && (showNonConflictingChanges || r.isConflicting || !model.isHandled(r).read(reader))).map((baseRange, idx) => new ModifiedBaseRangeGutterItemModel(idx.toString(), baseRange, inputNumber, viewModel));
    });
    this.decorations = derivedOpts({ debugName: `input${this.inputNumber}.decorations` }, (reader) => {
      const viewModel = this.viewModel.read(reader);
      if (!viewModel) {
        return [];
      }
      const model = viewModel.model;
      const textModel = (this.inputNumber === 1 ? model.input1 : model.input2).textModel;
      const activeModifiedBaseRange = viewModel.activeModifiedBaseRange.read(reader);
      const result = new Array();
      const showNonConflictingChanges = viewModel.showNonConflictingChanges.read(reader);
      const showDeletionMarkers = this.showDeletionMarkers.read(reader);
      const diffWithThis = viewModel.baseCodeEditorView.read(reader) !== void 0 && viewModel.baseShowDiffAgainst.read(reader) === this.inputNumber;
      const useSimplifiedDecorations = !diffWithThis && this.useSimplifiedDecorations.read(reader);
      for (const modifiedBaseRange of model.modifiedBaseRanges.read(reader)) {
        const range = modifiedBaseRange.getInputRange(this.inputNumber);
        if (!range) {
          continue;
        }
        const blockClassNames = ["merge-editor-block"];
        let blockPadding = [0, 0, 0, 0];
        const isHandled = model.isInputHandled(modifiedBaseRange, this.inputNumber).read(reader);
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
        const inputClassName = this.inputNumber === 1 ? "input i1" : "input i2";
        blockClassNames.push(inputClassName);
        if (!modifiedBaseRange.isConflicting && !showNonConflictingChanges && isHandled) {
          continue;
        }
        if (useSimplifiedDecorations && !isHandled) {
          blockClassNames.push("use-simplified-decorations");
        }
        result.push({
          range: range.toInclusiveRangeOrEmpty(),
          options: {
            showIfCollapsed: true,
            blockClassName: blockClassNames.join(" "),
            blockPadding,
            blockIsAfterEnd: range.startLineNumber > textModel.getLineCount(),
            description: "Merge Editor",
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
        if (!useSimplifiedDecorations && (modifiedBaseRange.isConflicting || !model.isHandled(modifiedBaseRange).read(reader))) {
          const inputDiffs = modifiedBaseRange.getInputDiffs(this.inputNumber);
          for (const diff of inputDiffs) {
            const range2 = diff.outputRange.toInclusiveRange();
            if (range2) {
              result.push({
                range: range2,
                options: {
                  className: `merge-editor-diff ${inputClassName}`,
                  description: "Merge Editor",
                  isWholeLine: true
                }
              });
            }
            if (diff.rangeMappings) {
              for (const d of diff.rangeMappings) {
                if (showDeletionMarkers || !d.outputRange.isEmpty()) {
                  result.push({
                    range: d.outputRange,
                    options: {
                      className: d.outputRange.isEmpty() ? `merge-editor-diff-empty-word ${inputClassName}` : `merge-editor-diff-word ${inputClassName}`,
                      description: "Merge Editor",
                      showIfCollapsed: true
                    }
                  });
                }
              }
            }
          }
        }
      }
      return result;
    });
    this.htmlElements.root.classList.add(`input`);
    this._register(
      new EditorGutter(this.editor, this.htmlElements.gutterDiv, {
        getIntersectingGutterItems: (range, reader) => {
          if (this.checkboxesVisible.read(reader)) {
            return this.modifiedBaseRangeGutterItemInfos.read(reader);
          } else {
            return [];
          }
        },
        createView: (item, target) => new MergeConflictGutterItemView(item, target, contextMenuService)
      })
    );
    this._register(
      createSelectionsAutorun(
        this,
        (baseRange, viewModel2) => viewModel2.model.translateBaseRangeToInput(this.inputNumber, baseRange)
      )
    );
    this._register(
      instantiationService.createInstance(
        TitleMenu,
        inputNumber === 1 ? MenuId.MergeInput1Toolbar : MenuId.MergeInput2Toolbar,
        this.htmlElements.toolbar
      )
    );
    this._register(autorunOpts({ debugName: `input${this.inputNumber}: update labels & text model` }, (reader) => {
      const vm = this.viewModel.read(reader);
      if (!vm) {
        return;
      }
      this.editor.setModel(this.inputNumber === 1 ? vm.model.input1.textModel : vm.model.input2.textModel);
      const title = this.inputNumber === 1 ? vm.model.input1.title || localize("input1", "Input 1") : vm.model.input2.title || localize("input2", "Input 2");
      const description = this.inputNumber === 1 ? vm.model.input1.description : vm.model.input2.description;
      const detail = this.inputNumber === 1 ? vm.model.input1.detail : vm.model.input2.detail;
      reset(this.htmlElements.title, ...renderLabelWithIcons(title));
      reset(this.htmlElements.description, ...description ? renderLabelWithIcons(description) : []);
      reset(this.htmlElements.detail, ...detail ? renderLabelWithIcons(detail) : []);
    }));
    this._register(applyObservableDecorations(this.editor, this.decorations));
  }
};
InputCodeEditorView = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IConfigurationService)
], InputCodeEditorView);
class ModifiedBaseRangeGutterItemModel {
  constructor(id, baseRange, inputNumber, viewModel) {
    this.id = id;
    this.baseRange = baseRange;
    this.inputNumber = inputNumber;
    this.viewModel = viewModel;
    this.model = this.viewModel.model;
    this.range = this.baseRange.getInputRange(this.inputNumber);
    this.enabled = this.model.isUpToDate;
    this.toggleState = derived(this, (reader) => {
      const input = this.model.getState(this.baseRange).read(reader).getInput(this.inputNumber);
      return input === InputState.second && !this.baseRange.isOrderRelevant ? InputState.first : input;
    });
    this.state = derived(this, (reader) => {
      const active = this.viewModel.activeModifiedBaseRange.read(reader);
      if (!this.model.hasBaseRange(this.baseRange)) {
        return { handled: false, focused: false };
      }
      return {
        handled: this.model.isHandled(this.baseRange).read(reader),
        focused: this.baseRange === active
      };
    });
  }
  setState(value, tx) {
    this.viewModel.setState(
      this.baseRange,
      this.model.getState(this.baseRange).get().withInputValue(this.inputNumber, value),
      tx,
      this.inputNumber
    );
  }
  toggleBothSides() {
    transaction((tx) => {
      const state = this.model.getState(this.baseRange).get();
      this.model.setState(
        this.baseRange,
        state.toggle(this.inputNumber).toggle(this.inputNumber === 1 ? 2 : 1),
        true,
        tx
      );
    });
  }
  getContextMenuActions() {
    const state = this.model.getState(this.baseRange).get();
    const handled = this.model.isHandled(this.baseRange).get();
    const update = (newState) => {
      transaction((tx) => {
        return this.viewModel.setState(this.baseRange, newState, tx, this.inputNumber);
      });
    };
    function action(id, label, targetState, checked) {
      const action2 = new Action(id, label, void 0, true, () => {
        update(targetState);
      });
      action2.checked = checked;
      return action2;
    }
    const both = state.includesInput1 && state.includesInput2;
    return [
      this.baseRange.input1Diffs.length > 0 ? action(
        "mergeEditor.acceptInput1",
        localize("mergeEditor.accept", "Accept {0}", this.model.input1.title),
        state.toggle(1),
        state.includesInput1
      ) : void 0,
      this.baseRange.input2Diffs.length > 0 ? action(
        "mergeEditor.acceptInput2",
        localize("mergeEditor.accept", "Accept {0}", this.model.input2.title),
        state.toggle(2),
        state.includesInput2
      ) : void 0,
      this.baseRange.isConflicting ? setFields(
        action(
          "mergeEditor.acceptBoth",
          localize(
            "mergeEditor.acceptBoth",
            "Accept Both"
          ),
          state.withInputValue(1, !both).withInputValue(2, !both),
          both
        ),
        { enabled: this.baseRange.canBeCombined }
      ) : void 0,
      new Separator(),
      this.baseRange.isConflicting ? setFields(
        action(
          "mergeEditor.swap",
          localize("mergeEditor.swap", "Swap"),
          state.swap(),
          false
        ),
        { enabled: !state.kind && (!both || this.baseRange.isOrderRelevant) }
      ) : void 0,
      setFields(
        new Action(
          "mergeEditor.markAsHandled",
          localize("mergeEditor.markAsHandled", "Mark as Handled"),
          void 0,
          true,
          () => {
            transaction((tx) => {
              this.model.setHandled(this.baseRange, !handled, tx);
            });
          }
        ),
        { checked: handled }
      )
    ].filter(isDefined);
  }
}
class MergeConflictGutterItemView extends Disposable {
  constructor(item, target, contextMenuService) {
    super();
    this.isMultiLine = observableValue(this, false);
    this.item = observableValue(this, item);
    const checkBox = new Toggle({
      isChecked: false,
      title: "",
      icon: Codicon.check,
      ...defaultToggleStyles
    });
    checkBox.domNode.classList.add("accept-conflict-group");
    this._register(
      addDisposableListener(checkBox.domNode, EventType.MOUSE_DOWN, (e) => {
        const item2 = this.item.get();
        if (!item2) {
          return;
        }
        if (e.button === /* Right */
        2) {
          e.stopPropagation();
          e.preventDefault();
          contextMenuService.showContextMenu({
            getAnchor: () => checkBox.domNode,
            getActions: () => item2.getContextMenuActions()
          });
        } else if (e.button === /* Middle */
        1) {
          e.stopPropagation();
          e.preventDefault();
          item2.toggleBothSides();
        }
      })
    );
    this._register(
      autorun((reader) => {
        const item2 = this.item.read(reader);
        const value = item2.toggleState.read(reader);
        const iconMap = {
          [InputState.excluded]: { icon: void 0, checked: false, title: localize("accept.excluded", "Accept") },
          [InputState.unrecognized]: { icon: Codicon.circleFilled, checked: false, title: localize("accept.conflicting", "Accept (result is dirty)") },
          [InputState.first]: { icon: Codicon.check, checked: true, title: localize("accept.first", "Undo accept") },
          [InputState.second]: { icon: Codicon.checkAll, checked: true, title: localize("accept.second", "Undo accept (currently second)") }
        };
        const state = iconMap[value];
        checkBox.setIcon(state.icon);
        checkBox.checked = state.checked;
        checkBox.setTitle(state.title);
        if (!item2.enabled.read(reader)) {
          checkBox.disable();
        } else {
          checkBox.enable();
        }
      })
    );
    this._register(autorun((reader) => {
      const state = this.item.read(reader).state.read(reader);
      const classNames = [
        "merge-accept-gutter-marker",
        state.handled && "handled",
        state.focused && "focused",
        this.isMultiLine.read(reader) ? "multi-line" : "single-line"
      ];
      target.className = classNames.filter((c) => typeof c === "string").join(" ");
    }));
    this._register(checkBox.onChange(() => {
      transaction((tx) => {
        this.item.get().setState(checkBox.checked, tx);
      });
    }));
    target.appendChild(h("div.background", [noBreakWhitespace]).root);
    target.appendChild(
      this.checkboxDiv = h("div.checkbox", [h("div.checkbox-background", [checkBox.domNode])]).root
    );
  }
  layout(top, height, viewTop, viewHeight) {
    const checkboxHeight = this.checkboxDiv.clientHeight;
    const middleHeight = height / 2 - checkboxHeight / 2;
    const margin = checkboxHeight;
    let effectiveCheckboxTop = top + middleHeight;
    const preferredViewPortRange = [
      margin,
      viewTop + viewHeight - margin - checkboxHeight
    ];
    const preferredParentRange = [
      top + margin,
      top + height - checkboxHeight - margin
    ];
    if (preferredParentRange[0] < preferredParentRange[1]) {
      effectiveCheckboxTop = clamp(effectiveCheckboxTop, preferredViewPortRange[0], preferredViewPortRange[1]);
      effectiveCheckboxTop = clamp(effectiveCheckboxTop, preferredParentRange[0], preferredParentRange[1]);
    }
    this.checkboxDiv.style.top = `${effectiveCheckboxTop - top}px`;
    transaction((tx) => {
      this.isMultiLine.set(height > 30, tx);
    });
  }
  update(baseRange) {
    transaction((tx) => {
      this.item.set(baseRange, tx);
    });
  }
}
export {
  InputCodeEditorView,
  MergeConflictGutterItemView,
  ModifiedBaseRangeGutterItemModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL3ZpZXcvZWRpdG9ycy9pbnB1dENvZGVFZGl0b3JWaWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgYWRkRGlzcG9zYWJsZUxpc3RlbmVyLCBFdmVudFR5cGUsIGgsIHJlc2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyByZW5kZXJMYWJlbFdpdGhJY29ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvaWNvbkxhYmVscy5qcyc7XG5pbXBvcnQgeyBUb2dnbGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdG9nZ2xlL3RvZ2dsZS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24sIElBY3Rpb24sIFNlcGFyYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9udW1iZXJzLmpzJztcbmltcG9ydCB7IGF1dG9ydW4sIGF1dG9ydW5PcHRzLCBkZXJpdmVkLCBkZXJpdmVkT3B0cywgSU9ic2VydmFibGUsIElTZXR0YWJsZU9ic2VydmFibGUsIElUcmFuc2FjdGlvbiwgb2JzZXJ2YWJsZVZhbHVlLCB0cmFuc2FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgbm9CcmVha1doaXRlc3BhY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBpc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBJTW9kZWxEZWx0YURlY29yYXRpb24sIE1pbmltYXBQb3NpdGlvbiwgT3ZlcnZpZXdSdWxlckxhbmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IGRlZmF1bHRUb2dnbGVTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgSW5wdXRTdGF0ZSwgTW9kaWZpZWRCYXNlUmFuZ2UsIE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUgfSBmcm9tICcuLi8uLi9tb2RlbC9tb2RpZmllZEJhc2VSYW5nZS5qcyc7XG5pbXBvcnQgeyBhcHBseU9ic2VydmFibGVEZWNvcmF0aW9ucywgc2V0RmllbGRzIH0gZnJvbSAnLi4vLi4vdXRpbHMuanMnO1xuaW1wb3J0IHsgaGFuZGxlZENvbmZsaWN0TWluaW1hcE92ZXJWaWV3UnVsZXJDb2xvciwgdW5oYW5kbGVkQ29uZmxpY3RNaW5pbWFwT3ZlclZpZXdSdWxlckNvbG9yIH0gZnJvbSAnLi4vY29sb3JzLmpzJztcbmltcG9ydCB7IE1lcmdlRWRpdG9yVmlld01vZGVsIH0gZnJvbSAnLi4vdmlld01vZGVsLmpzJztcbmltcG9ydCB7IEVkaXRvckd1dHRlciwgSUd1dHRlckl0ZW1JbmZvLCBJR3V0dGVySXRlbVZpZXcgfSBmcm9tICcuLi9lZGl0b3JHdXR0ZXIuanMnO1xuaW1wb3J0IHsgQ29kZUVkaXRvclZpZXcsIGNyZWF0ZVNlbGVjdGlvbnNBdXRvcnVuLCBUaXRsZU1lbnUgfSBmcm9tICcuL2NvZGVFZGl0b3JWaWV3LmpzJztcblxuZXhwb3J0IGNsYXNzIElucHV0Q29kZUVkaXRvclZpZXcgZXh0ZW5kcyBDb2RlRWRpdG9yVmlldyB7XG5cdHB1YmxpYyByZWFkb25seSBvdGhlcklucHV0TnVtYmVyID0gdGhpcy5pbnB1dE51bWJlciA9PT0gMSA/IDIgOiAxO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBpbnB1dE51bWJlcjogMSB8IDIsXG5cdFx0dmlld01vZGVsOiBJT2JzZXJ2YWJsZTxNZXJnZUVkaXRvclZpZXdNb2RlbCB8IHVuZGVmaW5lZD4sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLCB2aWV3TW9kZWwsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdHRoaXMuaHRtbEVsZW1lbnRzLnJvb3QuY2xhc3NMaXN0LmFkZChgaW5wdXRgKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKFxuXHRcdFx0bmV3IEVkaXRvckd1dHRlcih0aGlzLmVkaXRvciwgdGhpcy5odG1sRWxlbWVudHMuZ3V0dGVyRGl2LCB7XG5cdFx0XHRcdGdldEludGVyc2VjdGluZ0d1dHRlckl0ZW1zOiAocmFuZ2UsIHJlYWRlcikgPT4ge1xuXHRcdFx0XHRcdGlmICh0aGlzLmNoZWNrYm94ZXNWaXNpYmxlLnJlYWQocmVhZGVyKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMubW9kaWZpZWRCYXNlUmFuZ2VHdXR0ZXJJdGVtSW5mb3MucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRjcmVhdGVWaWV3OiAoaXRlbSwgdGFyZ2V0KSA9PiBuZXcgTWVyZ2VDb25mbGljdEd1dHRlckl0ZW1WaWV3KGl0ZW0sIHRhcmdldCwgY29udGV4dE1lbnVTZXJ2aWNlKSxcblx0XHRcdH0pXG5cdFx0KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKFxuXHRcdFx0Y3JlYXRlU2VsZWN0aW9uc0F1dG9ydW4odGhpcywgKGJhc2VSYW5nZSwgdmlld01vZGVsKSA9PlxuXHRcdFx0XHR2aWV3TW9kZWwubW9kZWwudHJhbnNsYXRlQmFzZVJhbmdlVG9JbnB1dCh0aGlzLmlucHV0TnVtYmVyLCBiYXNlUmFuZ2UpXG5cdFx0XHQpXG5cdFx0KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRcdFRpdGxlTWVudSxcblx0XHRcdFx0aW5wdXROdW1iZXIgPT09IDEgPyBNZW51SWQuTWVyZ2VJbnB1dDFUb29sYmFyIDogTWVudUlkLk1lcmdlSW5wdXQyVG9vbGJhcixcblx0XHRcdFx0dGhpcy5odG1sRWxlbWVudHMudG9vbGJhclxuXHRcdFx0KVxuXHRcdCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuT3B0cyh7IGRlYnVnTmFtZTogYGlucHV0JHt0aGlzLmlucHV0TnVtYmVyfTogdXBkYXRlIGxhYmVscyAmIHRleHQgbW9kZWxgIH0sIHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCB2bSA9IHRoaXMudmlld01vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghdm0pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmVkaXRvci5zZXRNb2RlbCh0aGlzLmlucHV0TnVtYmVyID09PSAxID8gdm0ubW9kZWwuaW5wdXQxLnRleHRNb2RlbCA6IHZtLm1vZGVsLmlucHV0Mi50ZXh0TW9kZWwpO1xuXG5cdFx0XHRjb25zdCB0aXRsZSA9IHRoaXMuaW5wdXROdW1iZXIgPT09IDFcblx0XHRcdFx0PyB2bS5tb2RlbC5pbnB1dDEudGl0bGUgfHwgbG9jYWxpemUoJ2lucHV0MScsICdJbnB1dCAxJylcblx0XHRcdFx0OiB2bS5tb2RlbC5pbnB1dDIudGl0bGUgfHwgbG9jYWxpemUoJ2lucHV0MicsICdJbnB1dCAyJyk7XG5cblx0XHRcdGNvbnN0IGRlc2NyaXB0aW9uID0gdGhpcy5pbnB1dE51bWJlciA9PT0gMVxuXHRcdFx0XHQ/IHZtLm1vZGVsLmlucHV0MS5kZXNjcmlwdGlvblxuXHRcdFx0XHQ6IHZtLm1vZGVsLmlucHV0Mi5kZXNjcmlwdGlvbjtcblxuXHRcdFx0Y29uc3QgZGV0YWlsID0gdGhpcy5pbnB1dE51bWJlciA9PT0gMVxuXHRcdFx0XHQ/IHZtLm1vZGVsLmlucHV0MS5kZXRhaWxcblx0XHRcdFx0OiB2bS5tb2RlbC5pbnB1dDIuZGV0YWlsO1xuXG5cdFx0XHRyZXNldCh0aGlzLmh0bWxFbGVtZW50cy50aXRsZSwgLi4ucmVuZGVyTGFiZWxXaXRoSWNvbnModGl0bGUpKTtcblx0XHRcdHJlc2V0KHRoaXMuaHRtbEVsZW1lbnRzLmRlc2NyaXB0aW9uLCAuLi4oZGVzY3JpcHRpb24gPyByZW5kZXJMYWJlbFdpdGhJY29ucyhkZXNjcmlwdGlvbikgOiBbXSkpO1xuXHRcdFx0cmVzZXQodGhpcy5odG1sRWxlbWVudHMuZGV0YWlsLCAuLi4oZGV0YWlsID8gcmVuZGVyTGFiZWxXaXRoSWNvbnMoZGV0YWlsKSA6IFtdKSk7XG5cdFx0fSkpO1xuXG5cblx0XHR0aGlzLl9yZWdpc3RlcihhcHBseU9ic2VydmFibGVEZWNvcmF0aW9ucyh0aGlzLmVkaXRvciwgdGhpcy5kZWNvcmF0aW9ucykpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBtb2RpZmllZEJhc2VSYW5nZUd1dHRlckl0ZW1JbmZvcyA9IGRlcml2ZWRPcHRzKHsgZGVidWdOYW1lOiBgaW5wdXQke3RoaXMuaW5wdXROdW1iZXJ9Lm1vZGlmaWVkQmFzZVJhbmdlR3V0dGVySXRlbUluZm9zYCB9LCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IHZpZXdNb2RlbCA9IHRoaXMudmlld01vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIXZpZXdNb2RlbCkgeyByZXR1cm4gW107IH1cblx0XHRjb25zdCBtb2RlbCA9IHZpZXdNb2RlbC5tb2RlbDtcblx0XHRjb25zdCBpbnB1dE51bWJlciA9IHRoaXMuaW5wdXROdW1iZXI7XG5cblx0XHRjb25zdCBzaG93Tm9uQ29uZmxpY3RpbmdDaGFuZ2VzID0gdmlld01vZGVsLnNob3dOb25Db25mbGljdGluZ0NoYW5nZXMucmVhZChyZWFkZXIpO1xuXG5cdFx0cmV0dXJuIG1vZGVsLm1vZGlmaWVkQmFzZVJhbmdlcy5yZWFkKHJlYWRlcilcblx0XHRcdC5maWx0ZXIoKHIpID0+IHIuZ2V0SW5wdXREaWZmcyh0aGlzLmlucHV0TnVtYmVyKS5sZW5ndGggPiAwICYmIChzaG93Tm9uQ29uZmxpY3RpbmdDaGFuZ2VzIHx8IHIuaXNDb25mbGljdGluZyB8fCAhbW9kZWwuaXNIYW5kbGVkKHIpLnJlYWQocmVhZGVyKSkpXG5cdFx0XHQubWFwKChiYXNlUmFuZ2UsIGlkeCkgPT4gbmV3IE1vZGlmaWVkQmFzZVJhbmdlR3V0dGVySXRlbU1vZGVsKGlkeC50b1N0cmluZygpLCBiYXNlUmFuZ2UsIGlucHV0TnVtYmVyLCB2aWV3TW9kZWwpKTtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkZWNvcmF0aW9ucyA9IGRlcml2ZWRPcHRzKHsgZGVidWdOYW1lOiBgaW5wdXQke3RoaXMuaW5wdXROdW1iZXJ9LmRlY29yYXRpb25zYCB9LCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IHZpZXdNb2RlbCA9IHRoaXMudmlld01vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIXZpZXdNb2RlbCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0XHRjb25zdCBtb2RlbCA9IHZpZXdNb2RlbC5tb2RlbDtcblx0XHRjb25zdCB0ZXh0TW9kZWwgPSAodGhpcy5pbnB1dE51bWJlciA9PT0gMSA/IG1vZGVsLmlucHV0MSA6IG1vZGVsLmlucHV0MikudGV4dE1vZGVsO1xuXG5cdFx0Y29uc3QgYWN0aXZlTW9kaWZpZWRCYXNlUmFuZ2UgPSB2aWV3TW9kZWwuYWN0aXZlTW9kaWZpZWRCYXNlUmFuZ2UucmVhZChyZWFkZXIpO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IEFycmF5PElNb2RlbERlbHRhRGVjb3JhdGlvbj4oKTtcblxuXHRcdGNvbnN0IHNob3dOb25Db25mbGljdGluZ0NoYW5nZXMgPSB2aWV3TW9kZWwuc2hvd05vbkNvbmZsaWN0aW5nQ2hhbmdlcy5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3Qgc2hvd0RlbGV0aW9uTWFya2VycyA9IHRoaXMuc2hvd0RlbGV0aW9uTWFya2Vycy5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3QgZGlmZldpdGhUaGlzID0gdmlld01vZGVsLmJhc2VDb2RlRWRpdG9yVmlldy5yZWFkKHJlYWRlcikgIT09IHVuZGVmaW5lZCAmJiB2aWV3TW9kZWwuYmFzZVNob3dEaWZmQWdhaW5zdC5yZWFkKHJlYWRlcikgPT09IHRoaXMuaW5wdXROdW1iZXI7XG5cdFx0Y29uc3QgdXNlU2ltcGxpZmllZERlY29yYXRpb25zID0gIWRpZmZXaXRoVGhpcyAmJiB0aGlzLnVzZVNpbXBsaWZpZWREZWNvcmF0aW9ucy5yZWFkKHJlYWRlcik7XG5cblx0XHRmb3IgKGNvbnN0IG1vZGlmaWVkQmFzZVJhbmdlIG9mIG1vZGVsLm1vZGlmaWVkQmFzZVJhbmdlcy5yZWFkKHJlYWRlcikpIHtcblx0XHRcdGNvbnN0IHJhbmdlID0gbW9kaWZpZWRCYXNlUmFuZ2UuZ2V0SW5wdXRSYW5nZSh0aGlzLmlucHV0TnVtYmVyKTtcblx0XHRcdGlmICghcmFuZ2UpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGJsb2NrQ2xhc3NOYW1lcyA9IFsnbWVyZ2UtZWRpdG9yLWJsb2NrJ107XG5cdFx0XHRsZXQgYmxvY2tQYWRkaW5nOiBbdG9wOiBudW1iZXIsIHJpZ2h0OiBudW1iZXIsIGJvdHRvbTogbnVtYmVyLCBsZWZ0OiBudW1iZXJdID0gWzAsIDAsIDAsIDBdO1xuXHRcdFx0Y29uc3QgaXNIYW5kbGVkID0gbW9kZWwuaXNJbnB1dEhhbmRsZWQobW9kaWZpZWRCYXNlUmFuZ2UsIHRoaXMuaW5wdXROdW1iZXIpLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmIChpc0hhbmRsZWQpIHtcblx0XHRcdFx0YmxvY2tDbGFzc05hbWVzLnB1c2goJ2hhbmRsZWQnKTtcblx0XHRcdH1cblx0XHRcdGlmIChtb2RpZmllZEJhc2VSYW5nZSA9PT0gYWN0aXZlTW9kaWZpZWRCYXNlUmFuZ2UpIHtcblx0XHRcdFx0YmxvY2tDbGFzc05hbWVzLnB1c2goJ2ZvY3VzZWQnKTtcblx0XHRcdFx0YmxvY2tQYWRkaW5nID0gWzAsIDIsIDAsIDJdO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG1vZGlmaWVkQmFzZVJhbmdlLmlzQ29uZmxpY3RpbmcpIHtcblx0XHRcdFx0YmxvY2tDbGFzc05hbWVzLnB1c2goJ2NvbmZsaWN0aW5nJyk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpbnB1dENsYXNzTmFtZSA9IHRoaXMuaW5wdXROdW1iZXIgPT09IDEgPyAnaW5wdXQgaTEnIDogJ2lucHV0IGkyJztcblx0XHRcdGJsb2NrQ2xhc3NOYW1lcy5wdXNoKGlucHV0Q2xhc3NOYW1lKTtcblxuXHRcdFx0aWYgKCFtb2RpZmllZEJhc2VSYW5nZS5pc0NvbmZsaWN0aW5nICYmICFzaG93Tm9uQ29uZmxpY3RpbmdDaGFuZ2VzICYmIGlzSGFuZGxlZCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHVzZVNpbXBsaWZpZWREZWNvcmF0aW9ucyAmJiAhaXNIYW5kbGVkKSB7XG5cdFx0XHRcdGJsb2NrQ2xhc3NOYW1lcy5wdXNoKCd1c2Utc2ltcGxpZmllZC1kZWNvcmF0aW9ucycpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXN1bHQucHVzaCh7XG5cdFx0XHRcdHJhbmdlOiByYW5nZS50b0luY2x1c2l2ZVJhbmdlT3JFbXB0eSgpLFxuXHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0c2hvd0lmQ29sbGFwc2VkOiB0cnVlLFxuXHRcdFx0XHRcdGJsb2NrQ2xhc3NOYW1lOiBibG9ja0NsYXNzTmFtZXMuam9pbignICcpLFxuXHRcdFx0XHRcdGJsb2NrUGFkZGluZyxcblx0XHRcdFx0XHRibG9ja0lzQWZ0ZXJFbmQ6IHJhbmdlLnN0YXJ0TGluZU51bWJlciA+IHRleHRNb2RlbC5nZXRMaW5lQ291bnQoKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ01lcmdlIEVkaXRvcicsXG5cdFx0XHRcdFx0bWluaW1hcDoge1xuXHRcdFx0XHRcdFx0cG9zaXRpb246IE1pbmltYXBQb3NpdGlvbi5HdXR0ZXIsXG5cdFx0XHRcdFx0XHRjb2xvcjogeyBpZDogaXNIYW5kbGVkID8gaGFuZGxlZENvbmZsaWN0TWluaW1hcE92ZXJWaWV3UnVsZXJDb2xvciA6IHVuaGFuZGxlZENvbmZsaWN0TWluaW1hcE92ZXJWaWV3UnVsZXJDb2xvciB9LFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0b3ZlcnZpZXdSdWxlcjogbW9kaWZpZWRCYXNlUmFuZ2UuaXNDb25mbGljdGluZyA/IHtcblx0XHRcdFx0XHRcdHBvc2l0aW9uOiBPdmVydmlld1J1bGVyTGFuZS5DZW50ZXIsXG5cdFx0XHRcdFx0XHRjb2xvcjogeyBpZDogaXNIYW5kbGVkID8gaGFuZGxlZENvbmZsaWN0TWluaW1hcE92ZXJWaWV3UnVsZXJDb2xvciA6IHVuaGFuZGxlZENvbmZsaWN0TWluaW1hcE92ZXJWaWV3UnVsZXJDb2xvciB9LFxuXHRcdFx0XHRcdH0gOiB1bmRlZmluZWRcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGlmICghdXNlU2ltcGxpZmllZERlY29yYXRpb25zICYmIChtb2RpZmllZEJhc2VSYW5nZS5pc0NvbmZsaWN0aW5nIHx8ICFtb2RlbC5pc0hhbmRsZWQobW9kaWZpZWRCYXNlUmFuZ2UpLnJlYWQocmVhZGVyKSkpIHtcblx0XHRcdFx0Y29uc3QgaW5wdXREaWZmcyA9IG1vZGlmaWVkQmFzZVJhbmdlLmdldElucHV0RGlmZnModGhpcy5pbnB1dE51bWJlcik7XG5cdFx0XHRcdGZvciAoY29uc3QgZGlmZiBvZiBpbnB1dERpZmZzKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmFuZ2UgPSBkaWZmLm91dHB1dFJhbmdlLnRvSW5jbHVzaXZlUmFuZ2UoKTtcblx0XHRcdFx0XHRpZiAocmFuZ2UpIHtcblx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKHtcblx0XHRcdFx0XHRcdFx0cmFuZ2UsXG5cdFx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0XHRjbGFzc05hbWU6IGBtZXJnZS1lZGl0b3ItZGlmZiAke2lucHV0Q2xhc3NOYW1lfWAsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdNZXJnZSBFZGl0b3InLFxuXHRcdFx0XHRcdFx0XHRcdGlzV2hvbGVMaW5lOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoZGlmZi5yYW5nZU1hcHBpbmdzKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGQgb2YgZGlmZi5yYW5nZU1hcHBpbmdzKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChzaG93RGVsZXRpb25NYXJrZXJzIHx8ICFkLm91dHB1dFJhbmdlLmlzRW1wdHkoKSkge1xuXHRcdFx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHRcdHJhbmdlOiBkLm91dHB1dFJhbmdlLFxuXHRcdFx0XHRcdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRjbGFzc05hbWU6IGQub3V0cHV0UmFuZ2UuaXNFbXB0eSgpID8gYG1lcmdlLWVkaXRvci1kaWZmLWVtcHR5LXdvcmQgJHtpbnB1dENsYXNzTmFtZX1gIDogYG1lcmdlLWVkaXRvci1kaWZmLXdvcmQgJHtpbnB1dENsYXNzTmFtZX1gLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ01lcmdlIEVkaXRvcicsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHNob3dJZkNvbGxhcHNlZDogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9KTtcbn1cblxuZXhwb3J0IGNsYXNzIE1vZGlmaWVkQmFzZVJhbmdlR3V0dGVySXRlbU1vZGVsIGltcGxlbWVudHMgSUd1dHRlckl0ZW1JbmZvIHtcblx0cHJpdmF0ZSByZWFkb25seSBtb2RlbCA9IHRoaXMudmlld01vZGVsLm1vZGVsO1xuXHRwdWJsaWMgcmVhZG9ubHkgcmFuZ2UgPSB0aGlzLmJhc2VSYW5nZS5nZXRJbnB1dFJhbmdlKHRoaXMuaW5wdXROdW1iZXIpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgYmFzZVJhbmdlOiBNb2RpZmllZEJhc2VSYW5nZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGlucHV0TnVtYmVyOiAxIHwgMixcblx0XHRwcml2YXRlIHJlYWRvbmx5IHZpZXdNb2RlbDogTWVyZ2VFZGl0b3JWaWV3TW9kZWxcblx0KSB7XG5cdH1cblxuXHRwdWJsaWMgcmVhZG9ubHkgZW5hYmxlZCA9IHRoaXMubW9kZWwuaXNVcFRvRGF0ZTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgdG9nZ2xlU3RhdGU6IElPYnNlcnZhYmxlPElucHV0U3RhdGU+ID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IGlucHV0ID0gdGhpcy5tb2RlbFxuXHRcdFx0LmdldFN0YXRlKHRoaXMuYmFzZVJhbmdlKVxuXHRcdFx0LnJlYWQocmVhZGVyKVxuXHRcdFx0LmdldElucHV0KHRoaXMuaW5wdXROdW1iZXIpO1xuXHRcdHJldHVybiBpbnB1dCA9PT0gSW5wdXRTdGF0ZS5zZWNvbmQgJiYgIXRoaXMuYmFzZVJhbmdlLmlzT3JkZXJSZWxldmFudFxuXHRcdFx0PyBJbnB1dFN0YXRlLmZpcnN0XG5cdFx0XHQ6IGlucHV0O1xuXHR9KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgc3RhdGU6IElPYnNlcnZhYmxlPHsgaGFuZGxlZDogYm9vbGVhbjsgZm9jdXNlZDogYm9vbGVhbiB9PiA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRjb25zdCBhY3RpdmUgPSB0aGlzLnZpZXdNb2RlbC5hY3RpdmVNb2RpZmllZEJhc2VSYW5nZS5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCF0aGlzLm1vZGVsLmhhc0Jhc2VSYW5nZSh0aGlzLmJhc2VSYW5nZSkpIHtcblx0XHRcdHJldHVybiB7IGhhbmRsZWQ6IGZhbHNlLCBmb2N1c2VkOiBmYWxzZSB9OyAvLyBJbnZhbGlkIHN0YXRlLCBzaG91bGQgb25seSBiZSBvYnNlcnZlZCB0ZW1wb3JhcmlseVxuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0aGFuZGxlZDogdGhpcy5tb2RlbC5pc0hhbmRsZWQodGhpcy5iYXNlUmFuZ2UpLnJlYWQocmVhZGVyKSxcblx0XHRcdGZvY3VzZWQ6IHRoaXMuYmFzZVJhbmdlID09PSBhY3RpdmUsXG5cdFx0fTtcblx0fSk7XG5cblx0cHVibGljIHNldFN0YXRlKHZhbHVlOiBib29sZWFuLCB0eDogSVRyYW5zYWN0aW9uKTogdm9pZCB7XG5cdFx0dGhpcy52aWV3TW9kZWwuc2V0U3RhdGUoXG5cdFx0XHR0aGlzLmJhc2VSYW5nZSxcblx0XHRcdHRoaXMubW9kZWxcblx0XHRcdFx0LmdldFN0YXRlKHRoaXMuYmFzZVJhbmdlKVxuXHRcdFx0XHQuZ2V0KClcblx0XHRcdFx0LndpdGhJbnB1dFZhbHVlKHRoaXMuaW5wdXROdW1iZXIsIHZhbHVlKSxcblx0XHRcdHR4LFxuXHRcdFx0dGhpcy5pbnB1dE51bWJlclxuXHRcdCk7XG5cdH1cblx0cHVibGljIHRvZ2dsZUJvdGhTaWRlcygpOiB2b2lkIHtcblx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIENvbnRleHQgTWVudTogdG9nZ2xlIGJvdGggc2lkZXMgKi9cblx0XHRcdGNvbnN0IHN0YXRlID0gdGhpcy5tb2RlbFxuXHRcdFx0XHQuZ2V0U3RhdGUodGhpcy5iYXNlUmFuZ2UpXG5cdFx0XHRcdC5nZXQoKTtcblx0XHRcdHRoaXMubW9kZWwuc2V0U3RhdGUoXG5cdFx0XHRcdHRoaXMuYmFzZVJhbmdlLFxuXHRcdFx0XHRzdGF0ZVxuXHRcdFx0XHRcdC50b2dnbGUodGhpcy5pbnB1dE51bWJlcilcblx0XHRcdFx0XHQudG9nZ2xlKHRoaXMuaW5wdXROdW1iZXIgPT09IDEgPyAyIDogMSksXG5cdFx0XHRcdHRydWUsXG5cdFx0XHRcdHR4XG5cdFx0XHQpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGdldENvbnRleHRNZW51QWN0aW9ucygpOiByZWFkb25seSBJQWN0aW9uW10ge1xuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5tb2RlbC5nZXRTdGF0ZSh0aGlzLmJhc2VSYW5nZSkuZ2V0KCk7XG5cdFx0Y29uc3QgaGFuZGxlZCA9IHRoaXMubW9kZWwuaXNIYW5kbGVkKHRoaXMuYmFzZVJhbmdlKS5nZXQoKTtcblxuXHRcdGNvbnN0IHVwZGF0ZSA9IChuZXdTdGF0ZTogTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZSkgPT4ge1xuXHRcdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIENvbnRleHQgTWVudTogVXBkYXRlIEJhc2UgUmFuZ2UgU3RhdGUgKi9cblx0XHRcdFx0cmV0dXJuIHRoaXMudmlld01vZGVsLnNldFN0YXRlKHRoaXMuYmFzZVJhbmdlLCBuZXdTdGF0ZSwgdHgsIHRoaXMuaW5wdXROdW1iZXIpO1xuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGFjdGlvbihpZDogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCB0YXJnZXRTdGF0ZTogTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZSwgY2hlY2tlZDogYm9vbGVhbikge1xuXHRcdFx0Y29uc3QgYWN0aW9uID0gbmV3IEFjdGlvbihpZCwgbGFiZWwsIHVuZGVmaW5lZCwgdHJ1ZSwgKCkgPT4ge1xuXHRcdFx0XHR1cGRhdGUodGFyZ2V0U3RhdGUpO1xuXHRcdFx0fSk7XG5cdFx0XHRhY3Rpb24uY2hlY2tlZCA9IGNoZWNrZWQ7XG5cdFx0XHRyZXR1cm4gYWN0aW9uO1xuXHRcdH1cblx0XHRjb25zdCBib3RoID0gc3RhdGUuaW5jbHVkZXNJbnB1dDEgJiYgc3RhdGUuaW5jbHVkZXNJbnB1dDI7XG5cblx0XHRyZXR1cm4gW1xuXHRcdFx0dGhpcy5iYXNlUmFuZ2UuaW5wdXQxRGlmZnMubGVuZ3RoID4gMFxuXHRcdFx0XHQ/IGFjdGlvbihcblx0XHRcdFx0XHQnbWVyZ2VFZGl0b3IuYWNjZXB0SW5wdXQxJyxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnbWVyZ2VFZGl0b3IuYWNjZXB0JywgJ0FjY2VwdCB7MH0nLCB0aGlzLm1vZGVsLmlucHV0MS50aXRsZSksXG5cdFx0XHRcdFx0c3RhdGUudG9nZ2xlKDEpLFxuXHRcdFx0XHRcdHN0YXRlLmluY2x1ZGVzSW5wdXQxXG5cdFx0XHRcdClcblx0XHRcdFx0OiB1bmRlZmluZWQsXG5cdFx0XHR0aGlzLmJhc2VSYW5nZS5pbnB1dDJEaWZmcy5sZW5ndGggPiAwXG5cdFx0XHRcdD8gYWN0aW9uKFxuXHRcdFx0XHRcdCdtZXJnZUVkaXRvci5hY2NlcHRJbnB1dDInLFxuXHRcdFx0XHRcdGxvY2FsaXplKCdtZXJnZUVkaXRvci5hY2NlcHQnLCAnQWNjZXB0IHswfScsIHRoaXMubW9kZWwuaW5wdXQyLnRpdGxlKSxcblx0XHRcdFx0XHRzdGF0ZS50b2dnbGUoMiksXG5cdFx0XHRcdFx0c3RhdGUuaW5jbHVkZXNJbnB1dDJcblx0XHRcdFx0KVxuXHRcdFx0XHQ6IHVuZGVmaW5lZCxcblx0XHRcdHRoaXMuYmFzZVJhbmdlLmlzQ29uZmxpY3Rpbmdcblx0XHRcdFx0PyBzZXRGaWVsZHMoXG5cdFx0XHRcdFx0YWN0aW9uKFxuXHRcdFx0XHRcdFx0J21lcmdlRWRpdG9yLmFjY2VwdEJvdGgnLFxuXHRcdFx0XHRcdFx0bG9jYWxpemUoXG5cdFx0XHRcdFx0XHRcdCdtZXJnZUVkaXRvci5hY2NlcHRCb3RoJyxcblx0XHRcdFx0XHRcdFx0J0FjY2VwdCBCb3RoJ1xuXHRcdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRcdHN0YXRlLndpdGhJbnB1dFZhbHVlKDEsICFib3RoKS53aXRoSW5wdXRWYWx1ZSgyLCAhYm90aCksXG5cdFx0XHRcdFx0XHRib3RoXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0XHR7IGVuYWJsZWQ6IHRoaXMuYmFzZVJhbmdlLmNhbkJlQ29tYmluZWQgfVxuXHRcdFx0XHQpXG5cdFx0XHRcdDogdW5kZWZpbmVkLFxuXHRcdFx0bmV3IFNlcGFyYXRvcigpLFxuXHRcdFx0dGhpcy5iYXNlUmFuZ2UuaXNDb25mbGljdGluZ1xuXHRcdFx0XHQ/IHNldEZpZWxkcyhcblx0XHRcdFx0XHRhY3Rpb24oXG5cdFx0XHRcdFx0XHQnbWVyZ2VFZGl0b3Iuc3dhcCcsXG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnbWVyZ2VFZGl0b3Iuc3dhcCcsICdTd2FwJyksXG5cdFx0XHRcdFx0XHRzdGF0ZS5zd2FwKCksXG5cdFx0XHRcdFx0XHRmYWxzZVxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0eyBlbmFibGVkOiAhc3RhdGUua2luZCAmJiAoIWJvdGggfHwgdGhpcy5iYXNlUmFuZ2UuaXNPcmRlclJlbGV2YW50KSB9XG5cdFx0XHRcdClcblx0XHRcdFx0OiB1bmRlZmluZWQsXG5cblx0XHRcdHNldEZpZWxkcyhcblx0XHRcdFx0bmV3IEFjdGlvbihcblx0XHRcdFx0XHQnbWVyZ2VFZGl0b3IubWFya0FzSGFuZGxlZCcsXG5cdFx0XHRcdFx0bG9jYWxpemUoJ21lcmdlRWRpdG9yLm1hcmtBc0hhbmRsZWQnLCAnTWFyayBhcyBIYW5kbGVkJyksXG5cdFx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHRcdHRydWUsXG5cdFx0XHRcdFx0KCkgPT4ge1xuXHRcdFx0XHRcdFx0dHJhbnNhY3Rpb24oKHR4KSA9PiB7XG5cdFx0XHRcdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gQ29udGV4dCBNZW51OiBNYXJrIGFzIGhhbmRsZWQgKi9cblx0XHRcdFx0XHRcdFx0dGhpcy5tb2RlbC5zZXRIYW5kbGVkKHRoaXMuYmFzZVJhbmdlLCAhaGFuZGxlZCwgdHgpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHQpLFxuXHRcdFx0XHR7IGNoZWNrZWQ6IGhhbmRsZWQgfVxuXHRcdFx0KSxcblx0XHRdLmZpbHRlcihpc0RlZmluZWQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNZXJnZUNvbmZsaWN0R3V0dGVySXRlbVZpZXcgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUd1dHRlckl0ZW1WaWV3PE1vZGlmaWVkQmFzZVJhbmdlR3V0dGVySXRlbU1vZGVsPiB7XG5cdHByaXZhdGUgcmVhZG9ubHkgaXRlbTogSVNldHRhYmxlT2JzZXJ2YWJsZTxNb2RpZmllZEJhc2VSYW5nZUd1dHRlckl0ZW1Nb2RlbD47XG5cblx0cHJpdmF0ZSByZWFkb25seSBjaGVja2JveERpdjogSFRNTERpdkVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgaXNNdWx0aUxpbmUgPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgZmFsc2UpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGl0ZW06IE1vZGlmaWVkQmFzZVJhbmdlR3V0dGVySXRlbU1vZGVsLFxuXHRcdHRhcmdldDogSFRNTEVsZW1lbnQsXG5cdFx0Y29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5pdGVtID0gb2JzZXJ2YWJsZVZhbHVlKHRoaXMsIGl0ZW0pO1xuXG5cdFx0Y29uc3QgY2hlY2tCb3ggPSBuZXcgVG9nZ2xlKHtcblx0XHRcdGlzQ2hlY2tlZDogZmFsc2UsXG5cdFx0XHR0aXRsZTogJycsXG5cdFx0XHRpY29uOiBDb2RpY29uLmNoZWNrLFxuXHRcdFx0Li4uZGVmYXVsdFRvZ2dsZVN0eWxlc1xuXHRcdH0pO1xuXHRcdGNoZWNrQm94LmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnYWNjZXB0LWNvbmZsaWN0LWdyb3VwJyk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihcblx0XHRcdGFkZERpc3Bvc2FibGVMaXN0ZW5lcihjaGVja0JveC5kb21Ob2RlLCBFdmVudFR5cGUuTU9VU0VfRE9XTiwgKGUpID0+IHtcblx0XHRcdFx0Y29uc3QgaXRlbSA9IHRoaXMuaXRlbS5nZXQoKTtcblx0XHRcdFx0aWYgKCFpdGVtKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGUuYnV0dG9uID09PSAvKiBSaWdodCAqLyAyKSB7XG5cdFx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdFx0XHRjb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdFx0XHRcdGdldEFuY2hvcjogKCkgPT4gY2hlY2tCb3guZG9tTm9kZSxcblx0XHRcdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IGl0ZW0uZ2V0Q29udGV4dE1lbnVBY3Rpb25zKCksXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0fSBlbHNlIGlmIChlLmJ1dHRvbiA9PT0gLyogTWlkZGxlICovIDEpIHtcblx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0XHRcdGl0ZW0udG9nZ2xlQm90aFNpZGVzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKFxuXHRcdFx0YXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIFVwZGF0ZSBDaGVja2JveCAqL1xuXHRcdFx0XHRjb25zdCBpdGVtID0gdGhpcy5pdGVtLnJlYWQocmVhZGVyKSE7XG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gaXRlbS50b2dnbGVTdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdGNvbnN0IGljb25NYXA6IFJlY29yZDxJbnB1dFN0YXRlLCB7IGljb246IFRoZW1lSWNvbiB8IHVuZGVmaW5lZDsgY2hlY2tlZDogYm9vbGVhbjsgdGl0bGU6IHN0cmluZyB9PiA9IHtcblx0XHRcdFx0XHRbSW5wdXRTdGF0ZS5leGNsdWRlZF06IHsgaWNvbjogdW5kZWZpbmVkLCBjaGVja2VkOiBmYWxzZSwgdGl0bGU6IGxvY2FsaXplKCdhY2NlcHQuZXhjbHVkZWQnLCBcIkFjY2VwdFwiKSB9LFxuXHRcdFx0XHRcdFtJbnB1dFN0YXRlLnVucmVjb2duaXplZF06IHsgaWNvbjogQ29kaWNvbi5jaXJjbGVGaWxsZWQsIGNoZWNrZWQ6IGZhbHNlLCB0aXRsZTogbG9jYWxpemUoJ2FjY2VwdC5jb25mbGljdGluZycsIFwiQWNjZXB0IChyZXN1bHQgaXMgZGlydHkpXCIpIH0sXG5cdFx0XHRcdFx0W0lucHV0U3RhdGUuZmlyc3RdOiB7IGljb246IENvZGljb24uY2hlY2ssIGNoZWNrZWQ6IHRydWUsIHRpdGxlOiBsb2NhbGl6ZSgnYWNjZXB0LmZpcnN0JywgXCJVbmRvIGFjY2VwdFwiKSB9LFxuXHRcdFx0XHRcdFtJbnB1dFN0YXRlLnNlY29uZF06IHsgaWNvbjogQ29kaWNvbi5jaGVja0FsbCwgY2hlY2tlZDogdHJ1ZSwgdGl0bGU6IGxvY2FsaXplKCdhY2NlcHQuc2Vjb25kJywgXCJVbmRvIGFjY2VwdCAoY3VycmVudGx5IHNlY29uZClcIikgfSxcblx0XHRcdFx0fTtcblx0XHRcdFx0Y29uc3Qgc3RhdGUgPSBpY29uTWFwW3ZhbHVlXTtcblx0XHRcdFx0Y2hlY2tCb3guc2V0SWNvbihzdGF0ZS5pY29uKTtcblx0XHRcdFx0Y2hlY2tCb3guY2hlY2tlZCA9IHN0YXRlLmNoZWNrZWQ7XG5cdFx0XHRcdGNoZWNrQm94LnNldFRpdGxlKHN0YXRlLnRpdGxlKTtcblxuXHRcdFx0XHRpZiAoIWl0ZW0uZW5hYmxlZC5yZWFkKHJlYWRlcikpIHtcblx0XHRcdFx0XHRjaGVja0JveC5kaXNhYmxlKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2hlY2tCb3guZW5hYmxlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gVXBkYXRlIENoZWNrYm94IENTUyBDbGFzc05hbWVzICovXG5cdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuaXRlbS5yZWFkKHJlYWRlcikuc3RhdGUucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgY2xhc3NOYW1lcyA9IFtcblx0XHRcdFx0J21lcmdlLWFjY2VwdC1ndXR0ZXItbWFya2VyJyxcblx0XHRcdFx0c3RhdGUuaGFuZGxlZCAmJiAnaGFuZGxlZCcsXG5cdFx0XHRcdHN0YXRlLmZvY3VzZWQgJiYgJ2ZvY3VzZWQnLFxuXHRcdFx0XHR0aGlzLmlzTXVsdGlMaW5lLnJlYWQocmVhZGVyKSA/ICdtdWx0aS1saW5lJyA6ICdzaW5nbGUtbGluZScsXG5cdFx0XHRdO1xuXHRcdFx0dGFyZ2V0LmNsYXNzTmFtZSA9IGNsYXNzTmFtZXMuZmlsdGVyKGMgPT4gdHlwZW9mIGMgPT09ICdzdHJpbmcnKS5qb2luKCcgJyk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoY2hlY2tCb3gub25DaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIEhhbmRsZSBDaGVja2JveCBDaGFuZ2UgKi9cblx0XHRcdFx0dGhpcy5pdGVtLmdldCgpIS5zZXRTdGF0ZShjaGVja0JveC5jaGVja2VkLCB0eCk7XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHR0YXJnZXQuYXBwZW5kQ2hpbGQoaCgnZGl2LmJhY2tncm91bmQnLCBbbm9CcmVha1doaXRlc3BhY2VdKS5yb290KTtcblx0XHR0YXJnZXQuYXBwZW5kQ2hpbGQoXG5cdFx0XHR0aGlzLmNoZWNrYm94RGl2ID0gaCgnZGl2LmNoZWNrYm94JywgW2goJ2Rpdi5jaGVja2JveC1iYWNrZ3JvdW5kJywgW2NoZWNrQm94LmRvbU5vZGVdKV0pLnJvb3Rcblx0XHQpO1xuXHR9XG5cblx0bGF5b3V0KHRvcDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgdmlld1RvcDogbnVtYmVyLCB2aWV3SGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBjaGVja2JveEhlaWdodCA9IHRoaXMuY2hlY2tib3hEaXYuY2xpZW50SGVpZ2h0O1xuXHRcdGNvbnN0IG1pZGRsZUhlaWdodCA9IGhlaWdodCAvIDIgLSBjaGVja2JveEhlaWdodCAvIDI7XG5cblx0XHRjb25zdCBtYXJnaW4gPSBjaGVja2JveEhlaWdodDtcblxuXHRcdGxldCBlZmZlY3RpdmVDaGVja2JveFRvcCA9IHRvcCArIG1pZGRsZUhlaWdodDtcblxuXHRcdGNvbnN0IHByZWZlcnJlZFZpZXdQb3J0UmFuZ2UgPSBbXG5cdFx0XHRtYXJnaW4sXG5cdFx0XHR2aWV3VG9wICsgdmlld0hlaWdodCAtIG1hcmdpbiAtIGNoZWNrYm94SGVpZ2h0XG5cdFx0XTtcblxuXHRcdGNvbnN0IHByZWZlcnJlZFBhcmVudFJhbmdlID0gW1xuXHRcdFx0dG9wICsgbWFyZ2luLFxuXHRcdFx0dG9wICsgaGVpZ2h0IC0gY2hlY2tib3hIZWlnaHQgLSBtYXJnaW5cblx0XHRdO1xuXG5cdFx0aWYgKHByZWZlcnJlZFBhcmVudFJhbmdlWzBdIDwgcHJlZmVycmVkUGFyZW50UmFuZ2VbMV0pIHtcblx0XHRcdGVmZmVjdGl2ZUNoZWNrYm94VG9wID0gY2xhbXAoZWZmZWN0aXZlQ2hlY2tib3hUb3AsIHByZWZlcnJlZFZpZXdQb3J0UmFuZ2VbMF0sIHByZWZlcnJlZFZpZXdQb3J0UmFuZ2VbMV0pO1xuXHRcdFx0ZWZmZWN0aXZlQ2hlY2tib3hUb3AgPSBjbGFtcChlZmZlY3RpdmVDaGVja2JveFRvcCwgcHJlZmVycmVkUGFyZW50UmFuZ2VbMF0sIHByZWZlcnJlZFBhcmVudFJhbmdlWzFdKTtcblx0XHR9XG5cblx0XHR0aGlzLmNoZWNrYm94RGl2LnN0eWxlLnRvcCA9IGAke2VmZmVjdGl2ZUNoZWNrYm94VG9wIC0gdG9wfXB4YDtcblxuXHRcdHRyYW5zYWN0aW9uKCh0eCkgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBNZXJnZUNvbmZsaWN0R3V0dGVySXRlbVZpZXc6IFVwZGF0ZSBJcyBNdWx0aSBMaW5lICovXG5cdFx0XHR0aGlzLmlzTXVsdGlMaW5lLnNldChoZWlnaHQgPiAzMCwgdHgpO1xuXHRcdH0pO1xuXHR9XG5cblx0dXBkYXRlKGJhc2VSYW5nZTogTW9kaWZpZWRCYXNlUmFuZ2VHdXR0ZXJJdGVtTW9kZWwpOiB2b2lkIHtcblx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIE1lcmdlQ29uZmxpY3RHdXR0ZXJJdGVtVmlldzogVXBkYXRpbmcgbmV3IGJhc2UgcmFuZ2UgKi9cblx0XHRcdHRoaXMuaXRlbS5zZXQoYmFzZVJhbmdlLCB0eCk7XG5cdFx0fSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx1QkFBdUIsV0FBVyxHQUFHLGFBQWE7QUFDM0QsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsUUFBaUIsaUJBQWlCO0FBQzNDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGFBQWE7QUFDdEIsU0FBUyxTQUFTLGFBQWEsU0FBUyxhQUE2RCxpQkFBaUIsbUJBQW1CO0FBQ3pJLFNBQVMseUJBQXlCO0FBRWxDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQWdDLGlCQUFpQix5QkFBeUI7QUFDMUUs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QUFlLFNBQVMsSUFBSSxpQkFBaUI7QUFFbkQsVUFBTSxTQUFTO0FBRWYsUUFBSSx1QkFBdUIsTUFBTTtBQUVqQyxVQUFNLHlCQUF5QjtBQUFBLE1BQzlCO0FBQUEsTUFDQSxVQUFVLGFBQWEsU0FBUztBQUFBLElBQ2pDO0FBRUEsVUFBTSx1QkFBdUI7QUFBQSxNQUM1QixNQUFNO0FBQUEsTUFDTixNQUFNLFNBQVMsaUJBQWlCO0FBQUEsSUFDakM7QUFFQSxRQUFJLHFCQUFxQixDQUFDLElBQUkscUJBQXFCLENBQUMsR0FBRztBQUN0RCw2QkFBdUIsTUFBTSxzQkFBc0IsdUJBQXVCLENBQUMsR0FBRyx1QkFBdUIsQ0FBQyxDQUFDO0FBQ3ZHLDZCQUF1QixNQUFNLHNCQUFzQixxQkFBcUIsQ0FBQyxHQUFHLHFCQUFxQixDQUFDLENBQUM7QUFBQSxJQUNwRztBQUVBLFNBQUssWUFBWSxNQUFNLE1BQU0sR0FBRyx1QkFBdUIsR0FBRztBQUUxRCxnQkFBWSxDQUFDLE9BQU87QUFFbkIsV0FBSyxZQUFZLElBQUksU0FBUyxJQUFJLEVBQUU7QUFBQSxJQUNyQyxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsT0FBTyxXQUFtRDtBQUN6RCxnQkFBWSxRQUFNO0FBRWpCLFdBQUssS0FBSyxJQUFJLFdBQVcsRUFBRTtBQUFBLElBQzVCLENBQUM7QUFBQSxFQUNGO0FBQ0Q7IiwKICAibmFtZXMiOiBbInJhbmdlIiwgInZpZXdNb2RlbCIsICJhY3Rpb24iLCAiaXRlbSJdCn0K
