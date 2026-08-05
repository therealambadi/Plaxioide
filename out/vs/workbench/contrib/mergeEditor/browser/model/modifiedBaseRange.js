import { compareBy, equals, numberComparator, tieBreakComparators } from "../../../../../base/common/arrays.js";
import { BugIndicatingError } from "../../../../../base/common/errors.js";
import { splitLines } from "../../../../../base/common/strings.js";
import { Constants } from "../../../../../base/common/uint.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { LineRangeEdit, RangeEdit } from "./editing.js";
import { DetailedLineRangeMapping, MappingAlignment } from "./mapping.js";
import { concatArrays } from "../utils.js";
class ModifiedBaseRange {
  constructor(baseRange, baseTextModel, input1Range, input1TextModel, input1Diffs, input2Range, input2TextModel, input2Diffs) {
    this.baseRange = baseRange;
    this.baseTextModel = baseTextModel;
    this.input1Range = input1Range;
    this.input1TextModel = input1TextModel;
    this.input1Diffs = input1Diffs;
    this.input2Range = input2Range;
    this.input2TextModel = input2TextModel;
    this.input2Diffs = input2Diffs;
    this.input1CombinedDiff = DetailedLineRangeMapping.join(this.input1Diffs);
    this.input2CombinedDiff = DetailedLineRangeMapping.join(this.input2Diffs);
    this.isEqualChange = equals(this.input1Diffs, this.input2Diffs, (a, b) => a.getLineEdit().equals(b.getLineEdit()));
    this.smartInput1LineRangeEdit = null;
    this.smartInput2LineRangeEdit = null;
    this.dumbInput1LineRangeEdit = null;
    this.dumbInput2LineRangeEdit = null;
    if (this.input1Diffs.length === 0 && this.input2Diffs.length === 0) {
      throw new BugIndicatingError("must have at least one diff");
    }
  }
  static fromDiffs(diffs1, diffs2, baseTextModel, input1TextModel, input2TextModel) {
    const alignments = MappingAlignment.compute(diffs1, diffs2);
    return alignments.map(
      (a) => new ModifiedBaseRange(
        a.inputRange,
        baseTextModel,
        a.output1Range,
        input1TextModel,
        a.output1LineMappings,
        a.output2Range,
        input2TextModel,
        a.output2LineMappings
      )
    );
  }
  getInputRange(inputNumber) {
    return inputNumber === 1 ? this.input1Range : this.input2Range;
  }
  getInputCombinedDiff(inputNumber) {
    return inputNumber === 1 ? this.input1CombinedDiff : this.input2CombinedDiff;
  }
  getInputDiffs(inputNumber) {
    return inputNumber === 1 ? this.input1Diffs : this.input2Diffs;
  }
  get isConflicting() {
    return this.input1Diffs.length > 0 && this.input2Diffs.length > 0;
  }
  get canBeCombined() {
    return this.smartCombineInputs(1) !== void 0;
  }
  get isOrderRelevant() {
    const input1 = this.smartCombineInputs(1);
    const input2 = this.smartCombineInputs(2);
    if (!input1 || !input2) {
      return false;
    }
    return !input1.equals(input2);
  }
  getEditForBase(state) {
    const diffs = [];
    if (state.includesInput1 && this.input1CombinedDiff) {
      diffs.push({ diff: this.input1CombinedDiff, inputNumber: 1 });
    }
    if (state.includesInput2 && this.input2CombinedDiff) {
      diffs.push({ diff: this.input2CombinedDiff, inputNumber: 2 });
    }
    if (diffs.length === 0) {
      return { edit: void 0, effectiveState: ModifiedBaseRangeState.base };
    }
    if (diffs.length === 1) {
      return { edit: diffs[0].diff.getLineEdit(), effectiveState: ModifiedBaseRangeState.base.withInputValue(diffs[0].inputNumber, true, false) };
    }
    if (state.kind !== 3 /* both */) {
      throw new BugIndicatingError();
    }
    const smartCombinedEdit = state.smartCombination ? this.smartCombineInputs(state.firstInput) : this.dumbCombineInputs(state.firstInput);
    if (smartCombinedEdit) {
      return { edit: smartCombinedEdit, effectiveState: state };
    }
    return {
      edit: diffs[getOtherInputNumber(state.firstInput) - 1].diff.getLineEdit(),
      effectiveState: ModifiedBaseRangeState.base.withInputValue(
        getOtherInputNumber(state.firstInput),
        true,
        false
      )
    };
  }
  smartCombineInputs(firstInput) {
    if (firstInput === 1 && this.smartInput1LineRangeEdit !== null) {
      return this.smartInput1LineRangeEdit;
    } else if (firstInput === 2 && this.smartInput2LineRangeEdit !== null) {
      return this.smartInput2LineRangeEdit;
    }
    const combinedDiffs = concatArrays(
      this.input1Diffs.flatMap(
        (diffs) => diffs.rangeMappings.map((diff) => ({ diff, input: 1 }))
      ),
      this.input2Diffs.flatMap(
        (diffs) => diffs.rangeMappings.map((diff) => ({ diff, input: 2 }))
      )
    ).sort(
      tieBreakComparators(
        compareBy((d) => d.diff.inputRange, Range.compareRangesUsingStarts),
        compareBy((d) => d.input === firstInput ? 1 : 2, numberComparator)
      )
    );
    const sortedEdits = combinedDiffs.map((d) => {
      const sourceTextModel = d.input === 1 ? this.input1TextModel : this.input2TextModel;
      return new RangeEdit(d.diff.inputRange, sourceTextModel.getValueInRange(d.diff.outputRange));
    });
    const result = editsToLineRangeEdit(this.baseRange, sortedEdits, this.baseTextModel);
    if (firstInput === 1) {
      this.smartInput1LineRangeEdit = result;
    } else {
      this.smartInput2LineRangeEdit = result;
    }
    return result;
  }
  dumbCombineInputs(firstInput) {
    if (firstInput === 1 && this.dumbInput1LineRangeEdit !== null) {
      return this.dumbInput1LineRangeEdit;
    } else if (firstInput === 2 && this.dumbInput2LineRangeEdit !== null) {
      return this.dumbInput2LineRangeEdit;
    }
    let input1Lines = this.input1Range.getLines(this.input1TextModel);
    let input2Lines = this.input2Range.getLines(this.input2TextModel);
    if (firstInput === 2) {
      [input1Lines, input2Lines] = [input2Lines, input1Lines];
    }
    const result = new LineRangeEdit(this.baseRange, input1Lines.concat(input2Lines));
    if (firstInput === 1) {
      this.dumbInput1LineRangeEdit = result;
    } else {
      this.dumbInput2LineRangeEdit = result;
    }
    return result;
  }
}
function editsToLineRangeEdit(range, sortedEdits, textModel) {
  let text = "";
  const startsLineBefore = range.startLineNumber > 1;
  let currentPosition = startsLineBefore ? new Position(
    range.startLineNumber - 1,
    textModel.getLineMaxColumn(range.startLineNumber - 1)
  ) : new Position(range.startLineNumber, 1);
  for (const edit of sortedEdits) {
    const diffStart = edit.range.getStartPosition();
    if (!currentPosition.isBeforeOrEqual(diffStart)) {
      return void 0;
    }
    let originalText2 = textModel.getValueInRange(Range.fromPositions(currentPosition, diffStart));
    if (diffStart.lineNumber > textModel.getLineCount()) {
      originalText2 += "\n";
    }
    text += originalText2;
    text += edit.newText;
    currentPosition = edit.range.getEndPosition();
  }
  const endsLineAfter = range.endLineNumberExclusive <= textModel.getLineCount();
  const end = endsLineAfter ? new Position(
    range.endLineNumberExclusive,
    1
  ) : new Position(range.endLineNumberExclusive - 1, Constants.MAX_SAFE_SMALL_INTEGER);
  const originalText = textModel.getValueInRange(
    Range.fromPositions(currentPosition, end)
  );
  text += originalText;
  const lines = splitLines(text);
  if (startsLineBefore) {
    if (lines[0] !== "") {
      return void 0;
    }
    lines.shift();
  }
  if (endsLineAfter) {
    if (lines[lines.length - 1] !== "") {
      return void 0;
    }
    lines.pop();
  }
  return new LineRangeEdit(range, lines);
}
var ModifiedBaseRangeStateKind = /* @__PURE__ */ ((ModifiedBaseRangeStateKind2) => {
  ModifiedBaseRangeStateKind2[ModifiedBaseRangeStateKind2["base"] = 0] = "base";
  ModifiedBaseRangeStateKind2[ModifiedBaseRangeStateKind2["input1"] = 1] = "input1";
  ModifiedBaseRangeStateKind2[ModifiedBaseRangeStateKind2["input2"] = 2] = "input2";
  ModifiedBaseRangeStateKind2[ModifiedBaseRangeStateKind2["both"] = 3] = "both";
  ModifiedBaseRangeStateKind2[ModifiedBaseRangeStateKind2["unrecognized"] = 4] = "unrecognized";
  return ModifiedBaseRangeStateKind2;
})(ModifiedBaseRangeStateKind || {});
function getOtherInputNumber(inputNumber) {
  return inputNumber === 1 ? 2 : 1;
}
class AbstractModifiedBaseRangeState {
  constructor() {
  }
  get includesInput1() {
    return false;
  }
  get includesInput2() {
    return false;
  }
  includesInput(inputNumber) {
    return inputNumber === 1 ? this.includesInput1 : this.includesInput2;
  }
  isInputIncluded(inputNumber) {
    return inputNumber === 1 ? this.includesInput1 : this.includesInput2;
  }
  toggle(inputNumber) {
    return this.withInputValue(inputNumber, !this.includesInput(inputNumber), true);
  }
  getInput(inputNumber) {
    if (!this.isInputIncluded(inputNumber)) {
      return 0 /* excluded */;
    }
    return 1 /* first */;
  }
}
class ModifiedBaseRangeStateBase extends AbstractModifiedBaseRangeState {
  get kind() {
    return 0 /* base */;
  }
  toString() {
    return "base";
  }
  swap() {
    return this;
  }
  withInputValue(inputNumber, value, smartCombination = false) {
    if (inputNumber === 1) {
      return value ? new ModifiedBaseRangeStateInput1() : this;
    } else {
      return value ? new ModifiedBaseRangeStateInput2() : this;
    }
  }
  equals(other) {
    return other.kind === 0 /* base */;
  }
}
class ModifiedBaseRangeStateInput1 extends AbstractModifiedBaseRangeState {
  get kind() {
    return 1 /* input1 */;
  }
  get includesInput1() {
    return true;
  }
  toString() {
    return "1\u2713";
  }
  swap() {
    return new ModifiedBaseRangeStateInput2();
  }
  withInputValue(inputNumber, value, smartCombination = false) {
    if (inputNumber === 1) {
      return value ? this : new ModifiedBaseRangeStateBase();
    } else {
      return value ? new ModifiedBaseRangeStateBoth(1, smartCombination) : new ModifiedBaseRangeStateInput2();
    }
  }
  equals(other) {
    return other.kind === 1 /* input1 */;
  }
}
class ModifiedBaseRangeStateInput2 extends AbstractModifiedBaseRangeState {
  get kind() {
    return 2 /* input2 */;
  }
  get includesInput2() {
    return true;
  }
  toString() {
    return "2\u2713";
  }
  swap() {
    return new ModifiedBaseRangeStateInput1();
  }
  withInputValue(inputNumber, value, smartCombination = false) {
    if (inputNumber === 2) {
      return value ? this : new ModifiedBaseRangeStateBase();
    } else {
      return value ? new ModifiedBaseRangeStateBoth(2, smartCombination) : new ModifiedBaseRangeStateInput2();
    }
  }
  equals(other) {
    return other.kind === 2 /* input2 */;
  }
}
class ModifiedBaseRangeStateBoth extends AbstractModifiedBaseRangeState {
  constructor(firstInput, smartCombination) {
    super();
    this.firstInput = firstInput;
    this.smartCombination = smartCombination;
  }
  get kind() {
    return 3 /* both */;
  }
  get includesInput1() {
    return true;
  }
  get includesInput2() {
    return true;
  }
  toString() {
    return "2\u2713";
  }
  swap() {
    return new ModifiedBaseRangeStateBoth(getOtherInputNumber(this.firstInput), this.smartCombination);
  }
  withInputValue(inputNumber, value, smartCombination = false) {
    if (value) {
      return this;
    }
    return inputNumber === 1 ? new ModifiedBaseRangeStateInput2() : new ModifiedBaseRangeStateInput1();
  }
  equals(other) {
    return other.kind === 3 /* both */ && this.firstInput === other.firstInput && this.smartCombination === other.smartCombination;
  }
  getInput(inputNumber) {
    return inputNumber === this.firstInput ? 1 /* first */ : 2 /* second */;
  }
}
class ModifiedBaseRangeStateUnrecognized extends AbstractModifiedBaseRangeState {
  get kind() {
    return 4 /* unrecognized */;
  }
  toString() {
    return "unrecognized";
  }
  swap() {
    return this;
  }
  withInputValue(inputNumber, value, smartCombination = false) {
    if (!value) {
      return this;
    }
    return inputNumber === 1 ? new ModifiedBaseRangeStateInput1() : new ModifiedBaseRangeStateInput2();
  }
  equals(other) {
    return other.kind === 4 /* unrecognized */;
  }
}
var ModifiedBaseRangeState;
((ModifiedBaseRangeState2) => {
  ModifiedBaseRangeState2.base = new ModifiedBaseRangeStateBase();
  ModifiedBaseRangeState2.unrecognized = new ModifiedBaseRangeStateUnrecognized();
})(ModifiedBaseRangeState || (ModifiedBaseRangeState = {}));
var InputState = /* @__PURE__ */ ((InputState2) => {
  InputState2[InputState2["excluded"] = 0] = "excluded";
  InputState2[InputState2["first"] = 1] = "first";
  InputState2[InputState2["second"] = 2] = "second";
  InputState2[InputState2["unrecognized"] = 3] = "unrecognized";
  return InputState2;
})(InputState || {});
export {
  AbstractModifiedBaseRangeState,
  InputState,
  ModifiedBaseRange,
  ModifiedBaseRangeState,
  ModifiedBaseRangeStateBase,
  ModifiedBaseRangeStateBoth,
  ModifiedBaseRangeStateInput1,
  ModifiedBaseRangeStateInput2,
  ModifiedBaseRangeStateKind,
  ModifiedBaseRangeStateUnrecognized,
  getOtherInputNumber
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL21vZGVsL21vZGlmaWVkQmFzZVJhbmdlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgY29tcGFyZUJ5LCBlcXVhbHMsIG51bWJlckNvbXBhcmF0b3IsIHRpZUJyZWFrQ29tcGFyYXRvcnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgQnVnSW5kaWNhdGluZ0Vycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IHNwbGl0TGluZXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IENvbnN0YW50cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VpbnQuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgTGluZVJhbmdlRWRpdCwgUmFuZ2VFZGl0IH0gZnJvbSAnLi9lZGl0aW5nLmpzJztcbmltcG9ydCB7IExpbmVSYW5nZSB9IGZyb20gJy4vbGluZVJhbmdlLmpzJztcbmltcG9ydCB7IERldGFpbGVkTGluZVJhbmdlTWFwcGluZywgTWFwcGluZ0FsaWdubWVudCB9IGZyb20gJy4vbWFwcGluZy5qcyc7XG5pbXBvcnQgeyBjb25jYXRBcnJheXMgfSBmcm9tICcuLi91dGlscy5qcyc7XG5cbi8qKlxuICogRGVzY3JpYmVzIG1vZGlmaWNhdGlvbnMgaW4gaW5wdXQgMSBhbmQgaW5wdXQgMiBmb3IgYSBzcGVjaWZpYyByYW5nZSBpbiBiYXNlLlxuICpcbiAqIFRoZSBVSSBvZmZlcnMgYSBtZWNoYW5pc20gdG8gZWl0aGVyIGFwcGx5IGFsbCBjaGFuZ2VzIGZyb20gaW5wdXQgMSBvciBpbnB1dCAyIG9yIGJvdGguXG4gKlxuICogSW1tdXRhYmxlLlxuKi9cbmV4cG9ydCBjbGFzcyBNb2RpZmllZEJhc2VSYW5nZSB7XG5cdHB1YmxpYyBzdGF0aWMgZnJvbURpZmZzKFxuXHRcdGRpZmZzMTogcmVhZG9ubHkgRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nW10sXG5cdFx0ZGlmZnMyOiByZWFkb25seSBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmdbXSxcblx0XHRiYXNlVGV4dE1vZGVsOiBJVGV4dE1vZGVsLFxuXHRcdGlucHV0MVRleHRNb2RlbDogSVRleHRNb2RlbCxcblx0XHRpbnB1dDJUZXh0TW9kZWw6IElUZXh0TW9kZWxcblx0KTogTW9kaWZpZWRCYXNlUmFuZ2VbXSB7XG5cdFx0Y29uc3QgYWxpZ25tZW50cyA9IE1hcHBpbmdBbGlnbm1lbnQuY29tcHV0ZShkaWZmczEsIGRpZmZzMik7XG5cdFx0cmV0dXJuIGFsaWdubWVudHMubWFwKFxuXHRcdFx0KGEpID0+IG5ldyBNb2RpZmllZEJhc2VSYW5nZShcblx0XHRcdFx0YS5pbnB1dFJhbmdlLFxuXHRcdFx0XHRiYXNlVGV4dE1vZGVsLFxuXHRcdFx0XHRhLm91dHB1dDFSYW5nZSxcblx0XHRcdFx0aW5wdXQxVGV4dE1vZGVsLFxuXHRcdFx0XHRhLm91dHB1dDFMaW5lTWFwcGluZ3MsXG5cdFx0XHRcdGEub3V0cHV0MlJhbmdlLFxuXHRcdFx0XHRpbnB1dDJUZXh0TW9kZWwsXG5cdFx0XHRcdGEub3V0cHV0MkxpbmVNYXBwaW5nc1xuXHRcdFx0KVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgcmVhZG9ubHkgaW5wdXQxQ29tYmluZWREaWZmID0gRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nLmpvaW4odGhpcy5pbnB1dDFEaWZmcyk7XG5cdHB1YmxpYyByZWFkb25seSBpbnB1dDJDb21iaW5lZERpZmYgPSBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcuam9pbih0aGlzLmlucHV0MkRpZmZzKTtcblx0cHVibGljIHJlYWRvbmx5IGlzRXF1YWxDaGFuZ2UgPSBlcXVhbHModGhpcy5pbnB1dDFEaWZmcywgdGhpcy5pbnB1dDJEaWZmcywgKGEsIGIpID0+IGEuZ2V0TGluZUVkaXQoKS5lcXVhbHMoYi5nZXRMaW5lRWRpdCgpKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGJhc2VSYW5nZTogTGluZVJhbmdlLFxuXHRcdHB1YmxpYyByZWFkb25seSBiYXNlVGV4dE1vZGVsOiBJVGV4dE1vZGVsLFxuXHRcdHB1YmxpYyByZWFkb25seSBpbnB1dDFSYW5nZTogTGluZVJhbmdlLFxuXHRcdHB1YmxpYyByZWFkb25seSBpbnB1dDFUZXh0TW9kZWw6IElUZXh0TW9kZWwsXG5cblx0XHQvKipcblx0XHQgKiBGcm9tIGJhc2UgdG8gaW5wdXQxXG5cdFx0Ki9cblx0XHRwdWJsaWMgcmVhZG9ubHkgaW5wdXQxRGlmZnM6IHJlYWRvbmx5IERldGFpbGVkTGluZVJhbmdlTWFwcGluZ1tdLFxuXHRcdHB1YmxpYyByZWFkb25seSBpbnB1dDJSYW5nZTogTGluZVJhbmdlLFxuXHRcdHB1YmxpYyByZWFkb25seSBpbnB1dDJUZXh0TW9kZWw6IElUZXh0TW9kZWwsXG5cblx0XHQvKipcblx0XHQgKiBGcm9tIGJhc2UgdG8gaW5wdXQyXG5cdFx0Ki9cblx0XHRwdWJsaWMgcmVhZG9ubHkgaW5wdXQyRGlmZnM6IHJlYWRvbmx5IERldGFpbGVkTGluZVJhbmdlTWFwcGluZ1tdXG5cdCkge1xuXHRcdGlmICh0aGlzLmlucHV0MURpZmZzLmxlbmd0aCA9PT0gMCAmJiB0aGlzLmlucHV0MkRpZmZzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcignbXVzdCBoYXZlIGF0IGxlYXN0IG9uZSBkaWZmJyk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldElucHV0UmFuZ2UoaW5wdXROdW1iZXI6IDEgfCAyKTogTGluZVJhbmdlIHtcblx0XHRyZXR1cm4gaW5wdXROdW1iZXIgPT09IDEgPyB0aGlzLmlucHV0MVJhbmdlIDogdGhpcy5pbnB1dDJSYW5nZTtcblx0fVxuXG5cdHB1YmxpYyBnZXRJbnB1dENvbWJpbmVkRGlmZihpbnB1dE51bWJlcjogMSB8IDIpOiBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBpbnB1dE51bWJlciA9PT0gMSA/IHRoaXMuaW5wdXQxQ29tYmluZWREaWZmIDogdGhpcy5pbnB1dDJDb21iaW5lZERpZmY7XG5cdH1cblxuXHRwdWJsaWMgZ2V0SW5wdXREaWZmcyhpbnB1dE51bWJlcjogMSB8IDIpOiByZWFkb25seSBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmdbXSB7XG5cdFx0cmV0dXJuIGlucHV0TnVtYmVyID09PSAxID8gdGhpcy5pbnB1dDFEaWZmcyA6IHRoaXMuaW5wdXQyRGlmZnM7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGlzQ29uZmxpY3RpbmcoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuaW5wdXQxRGlmZnMubGVuZ3RoID4gMCAmJiB0aGlzLmlucHV0MkRpZmZzLmxlbmd0aCA+IDA7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGNhbkJlQ29tYmluZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuc21hcnRDb21iaW5lSW5wdXRzKDEpICE9PSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGlzT3JkZXJSZWxldmFudCgpOiBib29sZWFuIHtcblx0XHRjb25zdCBpbnB1dDEgPSB0aGlzLnNtYXJ0Q29tYmluZUlucHV0cygxKTtcblx0XHRjb25zdCBpbnB1dDIgPSB0aGlzLnNtYXJ0Q29tYmluZUlucHV0cygyKTtcblx0XHRpZiAoIWlucHV0MSB8fCAhaW5wdXQyKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiAhaW5wdXQxLmVxdWFscyhpbnB1dDIpO1xuXHR9XG5cblx0cHVibGljIGdldEVkaXRGb3JCYXNlKHN0YXRlOiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlKTogeyBlZGl0OiBMaW5lUmFuZ2VFZGl0IHwgdW5kZWZpbmVkOyBlZmZlY3RpdmVTdGF0ZTogTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZSB9IHtcblx0XHRjb25zdCBkaWZmczogeyBkaWZmOiBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmc7IGlucHV0TnVtYmVyOiBJbnB1dE51bWJlciB9W10gPSBbXTtcblx0XHRpZiAoc3RhdGUuaW5jbHVkZXNJbnB1dDEgJiYgdGhpcy5pbnB1dDFDb21iaW5lZERpZmYpIHtcblx0XHRcdGRpZmZzLnB1c2goeyBkaWZmOiB0aGlzLmlucHV0MUNvbWJpbmVkRGlmZiwgaW5wdXROdW1iZXI6IDEgfSk7XG5cdFx0fVxuXHRcdGlmIChzdGF0ZS5pbmNsdWRlc0lucHV0MiAmJiB0aGlzLmlucHV0MkNvbWJpbmVkRGlmZikge1xuXHRcdFx0ZGlmZnMucHVzaCh7IGRpZmY6IHRoaXMuaW5wdXQyQ29tYmluZWREaWZmLCBpbnB1dE51bWJlcjogMiB9KTtcblx0XHR9XG5cblx0XHRpZiAoZGlmZnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4geyBlZGl0OiB1bmRlZmluZWQsIGVmZmVjdGl2ZVN0YXRlOiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlLmJhc2UgfTtcblx0XHR9XG5cdFx0aWYgKGRpZmZzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0cmV0dXJuIHsgZWRpdDogZGlmZnNbMF0uZGlmZi5nZXRMaW5lRWRpdCgpLCBlZmZlY3RpdmVTdGF0ZTogTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZS5iYXNlLndpdGhJbnB1dFZhbHVlKGRpZmZzWzBdLmlucHV0TnVtYmVyLCB0cnVlLCBmYWxzZSkgfTtcblx0XHR9XG5cblx0XHRpZiAoc3RhdGUua2luZCAhPT0gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQuYm90aCkge1xuXHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcigpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNtYXJ0Q29tYmluZWRFZGl0ID0gc3RhdGUuc21hcnRDb21iaW5hdGlvbiA/IHRoaXMuc21hcnRDb21iaW5lSW5wdXRzKHN0YXRlLmZpcnN0SW5wdXQpIDogdGhpcy5kdW1iQ29tYmluZUlucHV0cyhzdGF0ZS5maXJzdElucHV0KTtcblx0XHRpZiAoc21hcnRDb21iaW5lZEVkaXQpIHtcblx0XHRcdHJldHVybiB7IGVkaXQ6IHNtYXJ0Q29tYmluZWRFZGl0LCBlZmZlY3RpdmVTdGF0ZTogc3RhdGUgfTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZWRpdDogZGlmZnNbZ2V0T3RoZXJJbnB1dE51bWJlcihzdGF0ZS5maXJzdElucHV0KSAtIDFdLmRpZmYuZ2V0TGluZUVkaXQoKSxcblx0XHRcdGVmZmVjdGl2ZVN0YXRlOiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlLmJhc2Uud2l0aElucHV0VmFsdWUoXG5cdFx0XHRcdGdldE90aGVySW5wdXROdW1iZXIoc3RhdGUuZmlyc3RJbnB1dCksXG5cdFx0XHRcdHRydWUsXG5cdFx0XHRcdGZhbHNlXG5cdFx0XHQpLFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHNtYXJ0SW5wdXQxTGluZVJhbmdlRWRpdDogTGluZVJhbmdlRWRpdCB8IHVuZGVmaW5lZCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHNtYXJ0SW5wdXQyTGluZVJhbmdlRWRpdDogTGluZVJhbmdlRWRpdCB8IHVuZGVmaW5lZCB8IG51bGwgPSBudWxsO1xuXG5cdHByaXZhdGUgc21hcnRDb21iaW5lSW5wdXRzKGZpcnN0SW5wdXQ6IDEgfCAyKTogTGluZVJhbmdlRWRpdCB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGZpcnN0SW5wdXQgPT09IDEgJiYgdGhpcy5zbWFydElucHV0MUxpbmVSYW5nZUVkaXQgIT09IG51bGwpIHtcblx0XHRcdHJldHVybiB0aGlzLnNtYXJ0SW5wdXQxTGluZVJhbmdlRWRpdDtcblx0XHR9IGVsc2UgaWYgKGZpcnN0SW5wdXQgPT09IDIgJiYgdGhpcy5zbWFydElucHV0MkxpbmVSYW5nZUVkaXQgIT09IG51bGwpIHtcblx0XHRcdHJldHVybiB0aGlzLnNtYXJ0SW5wdXQyTGluZVJhbmdlRWRpdDtcblx0XHR9XG5cblx0XHRjb25zdCBjb21iaW5lZERpZmZzID0gY29uY2F0QXJyYXlzKFxuXHRcdFx0dGhpcy5pbnB1dDFEaWZmcy5mbGF0TWFwKChkaWZmcykgPT5cblx0XHRcdFx0ZGlmZnMucmFuZ2VNYXBwaW5ncy5tYXAoKGRpZmYpID0+ICh7IGRpZmYsIGlucHV0OiAxIGFzIGNvbnN0IH0pKVxuXHRcdFx0KSxcblx0XHRcdHRoaXMuaW5wdXQyRGlmZnMuZmxhdE1hcCgoZGlmZnMpID0+XG5cdFx0XHRcdGRpZmZzLnJhbmdlTWFwcGluZ3MubWFwKChkaWZmKSA9PiAoeyBkaWZmLCBpbnB1dDogMiBhcyBjb25zdCB9KSlcblx0XHRcdClcblx0XHQpLnNvcnQoXG5cdFx0XHR0aWVCcmVha0NvbXBhcmF0b3JzKFxuXHRcdFx0XHRjb21wYXJlQnkoKGQpID0+IGQuZGlmZi5pbnB1dFJhbmdlLCBSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMpLFxuXHRcdFx0XHRjb21wYXJlQnkoKGQpID0+IChkLmlucHV0ID09PSBmaXJzdElucHV0ID8gMSA6IDIpLCBudW1iZXJDb21wYXJhdG9yKVxuXHRcdFx0KVxuXHRcdCk7XG5cblx0XHRjb25zdCBzb3J0ZWRFZGl0cyA9IGNvbWJpbmVkRGlmZnMubWFwKGQgPT4ge1xuXHRcdFx0Y29uc3Qgc291cmNlVGV4dE1vZGVsID0gZC5pbnB1dCA9PT0gMSA/IHRoaXMuaW5wdXQxVGV4dE1vZGVsIDogdGhpcy5pbnB1dDJUZXh0TW9kZWw7XG5cdFx0XHRyZXR1cm4gbmV3IFJhbmdlRWRpdChkLmRpZmYuaW5wdXRSYW5nZSwgc291cmNlVGV4dE1vZGVsLmdldFZhbHVlSW5SYW5nZShkLmRpZmYub3V0cHV0UmFuZ2UpKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGVkaXRzVG9MaW5lUmFuZ2VFZGl0KHRoaXMuYmFzZVJhbmdlLCBzb3J0ZWRFZGl0cywgdGhpcy5iYXNlVGV4dE1vZGVsKTtcblx0XHRpZiAoZmlyc3RJbnB1dCA9PT0gMSkge1xuXHRcdFx0dGhpcy5zbWFydElucHV0MUxpbmVSYW5nZUVkaXQgPSByZXN1bHQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc21hcnRJbnB1dDJMaW5lUmFuZ2VFZGl0ID0gcmVzdWx0O1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBkdW1iSW5wdXQxTGluZVJhbmdlRWRpdDogTGluZVJhbmdlRWRpdCB8IHVuZGVmaW5lZCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGR1bWJJbnB1dDJMaW5lUmFuZ2VFZGl0OiBMaW5lUmFuZ2VFZGl0IHwgdW5kZWZpbmVkIHwgbnVsbCA9IG51bGw7XG5cblx0cHJpdmF0ZSBkdW1iQ29tYmluZUlucHV0cyhmaXJzdElucHV0OiAxIHwgMik6IExpbmVSYW5nZUVkaXQgfCB1bmRlZmluZWQge1xuXHRcdGlmIChmaXJzdElucHV0ID09PSAxICYmIHRoaXMuZHVtYklucHV0MUxpbmVSYW5nZUVkaXQgIT09IG51bGwpIHtcblx0XHRcdHJldHVybiB0aGlzLmR1bWJJbnB1dDFMaW5lUmFuZ2VFZGl0O1xuXHRcdH0gZWxzZSBpZiAoZmlyc3RJbnB1dCA9PT0gMiAmJiB0aGlzLmR1bWJJbnB1dDJMaW5lUmFuZ2VFZGl0ICE9PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kdW1iSW5wdXQyTGluZVJhbmdlRWRpdDtcblx0XHR9XG5cblx0XHRsZXQgaW5wdXQxTGluZXMgPSB0aGlzLmlucHV0MVJhbmdlLmdldExpbmVzKHRoaXMuaW5wdXQxVGV4dE1vZGVsKTtcblx0XHRsZXQgaW5wdXQyTGluZXMgPSB0aGlzLmlucHV0MlJhbmdlLmdldExpbmVzKHRoaXMuaW5wdXQyVGV4dE1vZGVsKTtcblx0XHRpZiAoZmlyc3RJbnB1dCA9PT0gMikge1xuXHRcdFx0W2lucHV0MUxpbmVzLCBpbnB1dDJMaW5lc10gPSBbaW5wdXQyTGluZXMsIGlucHV0MUxpbmVzXTtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQgPSBuZXcgTGluZVJhbmdlRWRpdCh0aGlzLmJhc2VSYW5nZSwgaW5wdXQxTGluZXMuY29uY2F0KGlucHV0MkxpbmVzKSk7XG5cdFx0aWYgKGZpcnN0SW5wdXQgPT09IDEpIHtcblx0XHRcdHRoaXMuZHVtYklucHV0MUxpbmVSYW5nZUVkaXQgPSByZXN1bHQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZHVtYklucHV0MkxpbmVSYW5nZUVkaXQgPSByZXN1bHQ7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuZnVuY3Rpb24gZWRpdHNUb0xpbmVSYW5nZUVkaXQocmFuZ2U6IExpbmVSYW5nZSwgc29ydGVkRWRpdHM6IFJhbmdlRWRpdFtdLCB0ZXh0TW9kZWw6IElUZXh0TW9kZWwpOiBMaW5lUmFuZ2VFZGl0IHwgdW5kZWZpbmVkIHtcblx0bGV0IHRleHQgPSAnJztcblx0Y29uc3Qgc3RhcnRzTGluZUJlZm9yZSA9IHJhbmdlLnN0YXJ0TGluZU51bWJlciA+IDE7XG5cdGxldCBjdXJyZW50UG9zaXRpb24gPSBzdGFydHNMaW5lQmVmb3JlXG5cdFx0PyBuZXcgUG9zaXRpb24oXG5cdFx0XHRyYW5nZS5zdGFydExpbmVOdW1iZXIgLSAxLFxuXHRcdFx0dGV4dE1vZGVsLmdldExpbmVNYXhDb2x1bW4ocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyIC0gMSlcblx0XHQpXG5cdFx0OiBuZXcgUG9zaXRpb24ocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCAxKTtcblxuXHRmb3IgKGNvbnN0IGVkaXQgb2Ygc29ydGVkRWRpdHMpIHtcblx0XHRjb25zdCBkaWZmU3RhcnQgPSBlZGl0LnJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKTtcblx0XHRpZiAoIWN1cnJlbnRQb3NpdGlvbi5pc0JlZm9yZU9yRXF1YWwoZGlmZlN0YXJ0KSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0bGV0IG9yaWdpbmFsVGV4dCA9IHRleHRNb2RlbC5nZXRWYWx1ZUluUmFuZ2UoUmFuZ2UuZnJvbVBvc2l0aW9ucyhjdXJyZW50UG9zaXRpb24sIGRpZmZTdGFydCkpO1xuXHRcdGlmIChkaWZmU3RhcnQubGluZU51bWJlciA+IHRleHRNb2RlbC5nZXRMaW5lQ291bnQoKSkge1xuXHRcdFx0Ly8gYXNzZXJ0IGRpZmZTdGFydC5saW5lTnVtYmVyID09PSB0ZXh0TW9kZWwuZ2V0TGluZUNvdW50KCkgKyAxXG5cdFx0XHQvLyBnZXRWYWx1ZUluUmFuZ2UgZG9lc24ndCBpbmNsdWRlIHRoaXMgdmlydHVhbCBsaW5lIGJyZWFrLCBhcyB0aGUgZG9jdW1lbnQgZW5kcyB0aGUgbGluZSBiZWZvcmUuXG5cdFx0XHQvLyBlbmRzTGluZUFmdGVyIHdpbGwgYmUgZmFsc2UuXG5cdFx0XHRvcmlnaW5hbFRleHQgKz0gJ1xcbic7XG5cdFx0fVxuXHRcdHRleHQgKz0gb3JpZ2luYWxUZXh0O1xuXHRcdHRleHQgKz0gZWRpdC5uZXdUZXh0O1xuXHRcdGN1cnJlbnRQb3NpdGlvbiA9IGVkaXQucmFuZ2UuZ2V0RW5kUG9zaXRpb24oKTtcblx0fVxuXG5cdGNvbnN0IGVuZHNMaW5lQWZ0ZXIgPSByYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlIDw9IHRleHRNb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0Y29uc3QgZW5kID0gZW5kc0xpbmVBZnRlciA/IG5ldyBQb3NpdGlvbihcblx0XHRyYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlLFxuXHRcdDFcblx0KSA6IG5ldyBQb3NpdGlvbihyYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlIC0gMSwgQ29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVIpO1xuXG5cdGNvbnN0IG9yaWdpbmFsVGV4dCA9IHRleHRNb2RlbC5nZXRWYWx1ZUluUmFuZ2UoXG5cdFx0UmFuZ2UuZnJvbVBvc2l0aW9ucyhjdXJyZW50UG9zaXRpb24sIGVuZClcblx0KTtcblx0dGV4dCArPSBvcmlnaW5hbFRleHQ7XG5cblx0Y29uc3QgbGluZXMgPSBzcGxpdExpbmVzKHRleHQpO1xuXHRpZiAoc3RhcnRzTGluZUJlZm9yZSkge1xuXHRcdGlmIChsaW5lc1swXSAhPT0gJycpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGxpbmVzLnNoaWZ0KCk7XG5cdH1cblx0aWYgKGVuZHNMaW5lQWZ0ZXIpIHtcblx0XHRpZiAobGluZXNbbGluZXMubGVuZ3RoIC0gMV0gIT09ICcnKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRsaW5lcy5wb3AoKTtcblx0fVxuXHRyZXR1cm4gbmV3IExpbmVSYW5nZUVkaXQocmFuZ2UsIGxpbmVzKTtcbn1cblxuZXhwb3J0IGVudW0gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQge1xuXHRiYXNlLFxuXHRpbnB1dDEsXG5cdGlucHV0Mixcblx0Ym90aCxcblx0dW5yZWNvZ25pemVkLFxufVxuXG5leHBvcnQgdHlwZSBJbnB1dE51bWJlciA9IDEgfCAyO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0T3RoZXJJbnB1dE51bWJlcihpbnB1dE51bWJlcjogSW5wdXROdW1iZXIpOiBJbnB1dE51bWJlciB7XG5cdHJldHVybiBpbnB1dE51bWJlciA9PT0gMSA/IDIgOiAxO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RNb2RpZmllZEJhc2VSYW5nZVN0YXRlIHtcblx0Y29uc3RydWN0b3IoKSB7IH1cblxuXHRhYnN0cmFjdCBnZXQga2luZCgpOiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZDtcblxuXHRwdWJsaWMgZ2V0IGluY2x1ZGVzSW5wdXQxKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblx0cHVibGljIGdldCBpbmNsdWRlc0lucHV0MigpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG5cblx0cHVibGljIGluY2x1ZGVzSW5wdXQoaW5wdXROdW1iZXI6IElucHV0TnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGlucHV0TnVtYmVyID09PSAxID8gdGhpcy5pbmNsdWRlc0lucHV0MSA6IHRoaXMuaW5jbHVkZXNJbnB1dDI7XG5cdH1cblxuXHRwdWJsaWMgaXNJbnB1dEluY2x1ZGVkKGlucHV0TnVtYmVyOiBJbnB1dE51bWJlcik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBpbnB1dE51bWJlciA9PT0gMSA/IHRoaXMuaW5jbHVkZXNJbnB1dDEgOiB0aGlzLmluY2x1ZGVzSW5wdXQyO1xuXHR9XG5cblx0cHVibGljIGFic3RyYWN0IHRvU3RyaW5nKCk6IHN0cmluZztcblxuXHRwdWJsaWMgYWJzdHJhY3Qgc3dhcCgpOiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlO1xuXG5cdHB1YmxpYyBhYnN0cmFjdCB3aXRoSW5wdXRWYWx1ZShpbnB1dE51bWJlcjogSW5wdXROdW1iZXIsIHZhbHVlOiBib29sZWFuLCBzbWFydENvbWJpbmF0aW9uPzogYm9vbGVhbik6IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGU7XG5cblx0cHVibGljIGFic3RyYWN0IGVxdWFscyhvdGhlcjogTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZSk6IGJvb2xlYW47XG5cblx0cHVibGljIHRvZ2dsZShpbnB1dE51bWJlcjogSW5wdXROdW1iZXIpIHtcblx0XHRyZXR1cm4gdGhpcy53aXRoSW5wdXRWYWx1ZShpbnB1dE51bWJlciwgIXRoaXMuaW5jbHVkZXNJbnB1dChpbnB1dE51bWJlciksIHRydWUpO1xuXHR9XG5cblx0cHVibGljIGdldElucHV0KGlucHV0TnVtYmVyOiAxIHwgMik6IElucHV0U3RhdGUge1xuXHRcdGlmICghdGhpcy5pc0lucHV0SW5jbHVkZWQoaW5wdXROdW1iZXIpKSB7XG5cdFx0XHRyZXR1cm4gSW5wdXRTdGF0ZS5leGNsdWRlZDtcblx0XHR9XG5cdFx0cmV0dXJuIElucHV0U3RhdGUuZmlyc3Q7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVCYXNlIGV4dGVuZHMgQWJzdHJhY3RNb2RpZmllZEJhc2VSYW5nZVN0YXRlIHtcblx0b3ZlcnJpZGUgZ2V0IGtpbmQoKTogTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQuYmFzZSB7IHJldHVybiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZC5iYXNlOyB9XG5cdHB1YmxpYyBvdmVycmlkZSB0b1N0cmluZygpOiBzdHJpbmcgeyByZXR1cm4gJ2Jhc2UnOyB9XG5cdHB1YmxpYyBvdmVycmlkZSBzd2FwKCk6IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUgeyByZXR1cm4gdGhpczsgfVxuXG5cdHB1YmxpYyBvdmVycmlkZSB3aXRoSW5wdXRWYWx1ZShpbnB1dE51bWJlcjogSW5wdXROdW1iZXIsIHZhbHVlOiBib29sZWFuLCBzbWFydENvbWJpbmF0aW9uOiBib29sZWFuID0gZmFsc2UpOiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlIHtcblx0XHRpZiAoaW5wdXROdW1iZXIgPT09IDEpIHtcblx0XHRcdHJldHVybiB2YWx1ZSA/IG5ldyBNb2RpZmllZEJhc2VSYW5nZVN0YXRlSW5wdXQxKCkgOiB0aGlzO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdmFsdWUgPyBuZXcgTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUlucHV0MigpIDogdGhpcztcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZXF1YWxzKG90aGVyOiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIG90aGVyLmtpbmQgPT09IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVLaW5kLmJhc2U7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVJbnB1dDEgZXh0ZW5kcyBBYnN0cmFjdE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUge1xuXHRvdmVycmlkZSBnZXQga2luZCgpOiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZC5pbnB1dDEgeyByZXR1cm4gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQuaW5wdXQxOyB9XG5cdG92ZXJyaWRlIGdldCBpbmNsdWRlc0lucHV0MSgpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cblx0cHVibGljIHRvU3RyaW5nKCk6IHN0cmluZyB7IHJldHVybiAnMVx1MjcxMyc7IH1cblx0cHVibGljIG92ZXJyaWRlIHN3YXAoKTogTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZSB7IHJldHVybiBuZXcgTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUlucHV0MigpOyB9XG5cblx0cHVibGljIG92ZXJyaWRlIHdpdGhJbnB1dFZhbHVlKGlucHV0TnVtYmVyOiBJbnB1dE51bWJlciwgdmFsdWU6IGJvb2xlYW4sIHNtYXJ0Q29tYmluYXRpb246IGJvb2xlYW4gPSBmYWxzZSk6IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUge1xuXHRcdGlmIChpbnB1dE51bWJlciA9PT0gMSkge1xuXHRcdFx0cmV0dXJuIHZhbHVlID8gdGhpcyA6IG5ldyBNb2RpZmllZEJhc2VSYW5nZVN0YXRlQmFzZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdmFsdWUgPyBuZXcgTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUJvdGgoMSwgc21hcnRDb21iaW5hdGlvbikgOiBuZXcgTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUlucHV0MigpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBlcXVhbHMob3RoZXI6IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gb3RoZXIua2luZCA9PT0gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQuaW5wdXQxO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNb2RpZmllZEJhc2VSYW5nZVN0YXRlSW5wdXQyIGV4dGVuZHMgQWJzdHJhY3RNb2RpZmllZEJhc2VSYW5nZVN0YXRlIHtcblx0b3ZlcnJpZGUgZ2V0IGtpbmQoKTogTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQuaW5wdXQyIHsgcmV0dXJuIE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVLaW5kLmlucHV0MjsgfVxuXHRvdmVycmlkZSBnZXQgaW5jbHVkZXNJbnB1dDIoKTogYm9vbGVhbiB7IHJldHVybiB0cnVlOyB9XG5cdHB1YmxpYyB0b1N0cmluZygpOiBzdHJpbmcgeyByZXR1cm4gJzJcdTI3MTMnOyB9XG5cdHB1YmxpYyBvdmVycmlkZSBzd2FwKCk6IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUgeyByZXR1cm4gbmV3IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVJbnB1dDEoKTsgfVxuXG5cdHB1YmxpYyB3aXRoSW5wdXRWYWx1ZShpbnB1dE51bWJlcjogSW5wdXROdW1iZXIsIHZhbHVlOiBib29sZWFuLCBzbWFydENvbWJpbmF0aW9uOiBib29sZWFuID0gZmFsc2UpOiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlIHtcblx0XHRpZiAoaW5wdXROdW1iZXIgPT09IDIpIHtcblx0XHRcdHJldHVybiB2YWx1ZSA/IHRoaXMgOiBuZXcgTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUJhc2UoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHZhbHVlID8gbmV3IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVCb3RoKDIsIHNtYXJ0Q29tYmluYXRpb24pIDogbmV3IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVJbnB1dDIoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZXF1YWxzKG90aGVyOiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIG90aGVyLmtpbmQgPT09IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVLaW5kLmlucHV0Mjtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUJvdGggZXh0ZW5kcyBBYnN0cmFjdE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgZmlyc3RJbnB1dDogSW5wdXROdW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IHNtYXJ0Q29tYmluYXRpb246IGJvb2xlYW5cblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGdldCBraW5kKCk6IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVLaW5kLmJvdGggeyByZXR1cm4gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQuYm90aDsgfVxuXHRvdmVycmlkZSBnZXQgaW5jbHVkZXNJbnB1dDEoKTogYm9vbGVhbiB7IHJldHVybiB0cnVlOyB9XG5cdG92ZXJyaWRlIGdldCBpbmNsdWRlc0lucHV0MigpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cblxuXHRwdWJsaWMgdG9TdHJpbmcoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gJzJcdTI3MTMnO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIHN3YXAoKTogTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZSB7IHJldHVybiBuZXcgTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUJvdGgoZ2V0T3RoZXJJbnB1dE51bWJlcih0aGlzLmZpcnN0SW5wdXQpLCB0aGlzLnNtYXJ0Q29tYmluYXRpb24pOyB9XG5cblx0cHVibGljIHdpdGhJbnB1dFZhbHVlKGlucHV0TnVtYmVyOiBJbnB1dE51bWJlciwgdmFsdWU6IGJvb2xlYW4sIHNtYXJ0Q29tYmluYXRpb246IGJvb2xlYW4gPSBmYWxzZSk6IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUge1xuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHRcdHJldHVybiBpbnB1dE51bWJlciA9PT0gMSA/IG5ldyBNb2RpZmllZEJhc2VSYW5nZVN0YXRlSW5wdXQyKCkgOiBuZXcgTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUlucHV0MSgpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGVxdWFscyhvdGhlcjogTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBvdGhlci5raW5kID09PSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZC5ib3RoICYmIHRoaXMuZmlyc3RJbnB1dCA9PT0gb3RoZXIuZmlyc3RJbnB1dCAmJiB0aGlzLnNtYXJ0Q29tYmluYXRpb24gPT09IG90aGVyLnNtYXJ0Q29tYmluYXRpb247XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZ2V0SW5wdXQoaW5wdXROdW1iZXI6IDEgfCAyKTogSW5wdXRTdGF0ZSB7XG5cdFx0cmV0dXJuIGlucHV0TnVtYmVyID09PSB0aGlzLmZpcnN0SW5wdXQgPyBJbnB1dFN0YXRlLmZpcnN0IDogSW5wdXRTdGF0ZS5zZWNvbmQ7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVVbnJlY29nbml6ZWQgZXh0ZW5kcyBBYnN0cmFjdE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUge1xuXHRvdmVycmlkZSBnZXQga2luZCgpOiBNb2RpZmllZEJhc2VSYW5nZVN0YXRlS2luZC51bnJlY29nbml6ZWQgeyByZXR1cm4gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQudW5yZWNvZ25pemVkOyB9XG5cdHB1YmxpYyBvdmVycmlkZSB0b1N0cmluZygpOiBzdHJpbmcgeyByZXR1cm4gJ3VucmVjb2duaXplZCc7IH1cblx0cHVibGljIG92ZXJyaWRlIHN3YXAoKTogTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZSB7IHJldHVybiB0aGlzOyB9XG5cblx0cHVibGljIHdpdGhJbnB1dFZhbHVlKGlucHV0TnVtYmVyOiBJbnB1dE51bWJlciwgdmFsdWU6IGJvb2xlYW4sIHNtYXJ0Q29tYmluYXRpb246IGJvb2xlYW4gPSBmYWxzZSk6IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUge1xuXHRcdGlmICghdmFsdWUpIHtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0XHRyZXR1cm4gaW5wdXROdW1iZXIgPT09IDEgPyBuZXcgTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUlucHV0MSgpIDogbmV3IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVJbnB1dDIoKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBlcXVhbHMob3RoZXI6IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gb3RoZXIua2luZCA9PT0gTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUtpbmQudW5yZWNvZ25pemVkO1xuXHR9XG59XG5cbmV4cG9ydCB0eXBlIE1vZGlmaWVkQmFzZVJhbmdlU3RhdGUgPSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlQmFzZSB8IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVJbnB1dDEgfCBNb2RpZmllZEJhc2VSYW5nZVN0YXRlSW5wdXQyIHwgTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUlucHV0MiB8IE1vZGlmaWVkQmFzZVJhbmdlU3RhdGVCb3RoIHwgTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZVVucmVjb2duaXplZDtcblxuZXhwb3J0IG5hbWVzcGFjZSBNb2RpZmllZEJhc2VSYW5nZVN0YXRlIHtcblx0ZXhwb3J0IGNvbnN0IGJhc2UgPSBuZXcgTW9kaWZpZWRCYXNlUmFuZ2VTdGF0ZUJhc2UoKTtcblx0ZXhwb3J0IGNvbnN0IHVucmVjb2duaXplZCA9IG5ldyBNb2RpZmllZEJhc2VSYW5nZVN0YXRlVW5yZWNvZ25pemVkKCk7XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIElucHV0U3RhdGUge1xuXHRleGNsdWRlZCA9IDAsXG5cdGZpcnN0ID0gMSxcblx0c2Vjb25kID0gMixcblx0dW5yZWNvZ25pemVkID0gM1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxXQUFXLFFBQVEsa0JBQWtCLDJCQUEyQjtBQUN6RSxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWE7QUFFdEIsU0FBUyxlQUFlLGlCQUFpQjtBQUV6QyxTQUFTLDBCQUEwQix3QkFBd0I7QUFDM0QsU0FBUyxvQkFBb0I7QUFTdEIsTUFBTSxrQkFBa0I7QUFBQSxFQTJCOUIsWUFDaUIsV0FDQSxlQUNBLGFBQ0EsaUJBS0EsYUFDQSxhQUNBLGlCQUtBLGFBQ2Y7QUFoQmU7QUFDQTtBQUNBO0FBQ0E7QUFLQTtBQUNBO0FBQ0E7QUFLQTtBQXBCakIsU0FBZ0IscUJBQXFCLHlCQUF5QixLQUFLLEtBQUssV0FBVztBQUNuRixTQUFnQixxQkFBcUIseUJBQXlCLEtBQUssS0FBSyxXQUFXO0FBQ25GLFNBQWdCLGdCQUFnQixPQUFPLEtBQUssYUFBYSxLQUFLLGFBQWEsQ0FBQyxHQUFHLE1BQU0sRUFBRSxZQUFZLEVBQUUsT0FBTyxFQUFFLFlBQVksQ0FBQyxDQUFDO0FBeUY1SCxTQUFRLDJCQUE2RDtBQUNyRSxTQUFRLDJCQUE2RDtBQXFDckUsU0FBUSwwQkFBNEQ7QUFDcEUsU0FBUSwwQkFBNEQ7QUE1R25FLFFBQUksS0FBSyxZQUFZLFdBQVcsS0FBSyxLQUFLLFlBQVksV0FBVyxHQUFHO0FBQ25FLFlBQU0sSUFBSSxtQkFBbUIsNkJBQTZCO0FBQUEsSUFDM0Q7QUFBQSxFQUNEO0FBQUEsRUEvQ0EsT0FBYyxVQUNiLFFBQ0EsUUFDQSxlQUNBLGlCQUNBLGlCQUNzQjtBQUN0QixVQUFNLGFBQWEsaUJBQWlCLFFBQVEsUUFBUSxNQUFNO0FBQzFELFdBQU8sV0FBVztBQUFBLE1BQ2pCLENBQUMsTUFBTSxJQUFJO0FBQUEsUUFDVixFQUFFO0FBQUEsUUFDRjtBQUFBLFFBQ0EsRUFBRTtBQUFBLFFBQ0Y7QUFBQSxRQUNBLEVBQUU7QUFBQSxRQUNGLEVBQUU7QUFBQSxRQUNGO0FBQUEsUUFDQSxFQUFFO0FBQUEsTUFDSDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUE2Qk8sY0FBYyxhQUErQjtBQUNuRCxXQUFPLGdCQUFnQixJQUFJLEtBQUssY0FBYyxLQUFLO0FBQUEsRUFDcEQ7QUFBQSxFQUVPLHFCQUFxQixhQUEwRDtBQUNyRixXQUFPLGdCQUFnQixJQUFJLEtBQUsscUJBQXFCLEtBQUs7QUFBQSxFQUMzRDtBQUFBLEVBRU8sY0FBYyxhQUF5RDtBQUM3RSxXQUFPLGdCQUFnQixJQUFJLEtBQUssY0FBYyxLQUFLO0FBQUEsRUFDcEQ7QUFBQSxFQUVBLElBQVcsZ0JBQXlCO0FBQ25DLFdBQU8sS0FBSyxZQUFZLFNBQVMsS0FBSyxLQUFLLFlBQVksU0FBUztBQUFBLEVBQ2pFO0FBQUEsRUFFQSxJQUFXLGdCQUF5QjtBQUNuQyxXQUFPLEtBQUssbUJBQW1CLENBQUMsTUFBTTtBQUFBLEVBQ3ZDO0FBQUEsRUFFQSxJQUFXLGtCQUEyQjtBQUNyQyxVQUFNLFNBQVMsS0FBSyxtQkFBbUIsQ0FBQztBQUN4QyxVQUFNLFNBQVMsS0FBSyxtQkFBbUIsQ0FBQztBQUN4QyxRQUFJLENBQUMsVUFBVSxDQUFDLFFBQVE7QUFDdkIsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPLENBQUMsT0FBTyxPQUFPLE1BQU07QUFBQSxFQUM3QjtBQUFBLEVBRU8sZUFBZSxPQUE0RztBQUNqSSxVQUFNLFFBQXdFLENBQUM7QUFDL0UsUUFBSSxNQUFNLGtCQUFrQixLQUFLLG9CQUFvQjtBQUNwRCxZQUFNLEtBQUssRUFBRSxNQUFNLEtBQUssb0JBQW9CLGFBQWEsRUFBRSxDQUFDO0FBQUEsSUFDN0Q7QUFDQSxRQUFJLE1BQU0sa0JBQWtCLEtBQUssb0JBQW9CO0FBQ3BELFlBQU0sS0FBSyxFQUFFLE1BQU0sS0FBSyxvQkFBb0IsYUFBYSxFQUFFLENBQUM7QUFBQSxJQUM3RDtBQUVBLFFBQUksTUFBTSxXQUFXLEdBQUc7QUFDdkIsYUFBTyxFQUFFLE1BQU0sUUFBVyxnQkFBZ0IsdUJBQXVCLEtBQUs7QUFBQSxJQUN2RTtBQUNBLFFBQUksTUFBTSxXQUFXLEdBQUc7QUFDdkIsYUFBTyxFQUFFLE1BQU0sTUFBTSxDQUFDLEVBQUUsS0FBSyxZQUFZLEdBQUcsZ0JBQWdCLHVCQUF1QixLQUFLLGVBQWUsTUFBTSxDQUFDLEVBQUUsYUFBYSxNQUFNLEtBQUssRUFBRTtBQUFBLElBQzNJO0FBRUEsUUFBSSxNQUFNLFNBQVMsY0FBaUM7QUFDbkQsWUFBTSxJQUFJLG1CQUFtQjtBQUFBLElBQzlCO0FBRUEsVUFBTSxvQkFBb0IsTUFBTSxtQkFBbUIsS0FBSyxtQkFBbUIsTUFBTSxVQUFVLElBQUksS0FBSyxrQkFBa0IsTUFBTSxVQUFVO0FBQ3RJLFFBQUksbUJBQW1CO0FBQ3RCLGFBQU8sRUFBRSxNQUFNLG1CQUFtQixnQkFBZ0IsTUFBTTtBQUFBLElBQ3pEO0FBRUEsV0FBTztBQUFBLE1BQ04sTUFBTSxNQUFNLG9CQUFvQixNQUFNLFVBQVUsSUFBSSxDQUFDLEVBQUUsS0FBSyxZQUFZO0FBQUEsTUFDeEUsZ0JBQWdCLHVCQUF1QixLQUFLO0FBQUEsUUFDM0Msb0JBQW9CLE1BQU0sVUFBVTtBQUFBLFFBQ3BDO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBS1EsbUJBQW1CLFlBQThDO0FBQ3hFLFFBQUksZUFBZSxLQUFLLEtBQUssNkJBQTZCLE1BQU07QUFDL0QsYUFBTyxLQUFLO0FBQUEsSUFDYixXQUFXLGVBQWUsS0FBSyxLQUFLLDZCQUE2QixNQUFNO0FBQ3RFLGFBQU8sS0FBSztBQUFBLElBQ2I7QUFFQSxVQUFNLGdCQUFnQjtBQUFBLE1BQ3JCLEtBQUssWUFBWTtBQUFBLFFBQVEsQ0FBQyxVQUN6QixNQUFNLGNBQWMsSUFBSSxDQUFDLFVBQVUsRUFBRSxNQUFNLE9BQU8sRUFBVyxFQUFFO0FBQUEsTUFDaEU7QUFBQSxNQUNBLEtBQUssWUFBWTtBQUFBLFFBQVEsQ0FBQyxVQUN6QixNQUFNLGNBQWMsSUFBSSxDQUFDLFVBQVUsRUFBRSxNQUFNLE9BQU8sRUFBVyxFQUFFO0FBQUEsTUFDaEU7QUFBQSxJQUNELEVBQUU7QUFBQSxNQUNEO0FBQUEsUUFDQyxVQUFVLENBQUMsTUFBTSxFQUFFLEtBQUssWUFBWSxNQUFNLHdCQUF3QjtBQUFBLFFBQ2xFLFVBQVUsQ0FBQyxNQUFPLEVBQUUsVUFBVSxhQUFhLElBQUksR0FBSSxnQkFBZ0I7QUFBQSxNQUNwRTtBQUFBLElBQ0Q7QUFFQSxVQUFNLGNBQWMsY0FBYyxJQUFJLE9BQUs7QUFDMUMsWUFBTSxrQkFBa0IsRUFBRSxVQUFVLElBQUksS0FBSyxrQkFBa0IsS0FBSztBQUNwRSxhQUFPLElBQUksVUFBVSxFQUFFLEtBQUssWUFBWSxnQkFBZ0IsZ0JBQWdCLEVBQUUsS0FBSyxXQUFXLENBQUM7QUFBQSxJQUM1RixDQUFDO0FBRUQsVUFBTSxTQUFTLHFCQUFxQixLQUFLLFdBQVcsYUFBYSxLQUFLLGFBQWE7QUFDbkYsUUFBSSxlQUFlLEdBQUc7QUFDckIsV0FBSywyQkFBMkI7QUFBQSxJQUNqQyxPQUFPO0FBQ04sV0FBSywyQkFBMkI7QUFBQSxJQUNqQztBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFLUSxrQkFBa0IsWUFBOEM7QUFDdkUsUUFBSSxlQUFlLEtBQUssS0FBSyw0QkFBNEIsTUFBTTtBQUM5RCxhQUFPLEtBQUs7QUFBQSxJQUNiLFdBQVcsZUFBZSxLQUFLLEtBQUssNEJBQTRCLE1BQU07QUFDckUsYUFBTyxLQUFLO0FBQUEsSUFDYjtBQUVBLFFBQUksY0FBYyxLQUFLLFlBQVksU0FBUyxLQUFLLGVBQWU7QUFDaEUsUUFBSSxjQUFjLEtBQUssWUFBWSxTQUFTLEtBQUssZUFBZTtBQUNoRSxRQUFJLGVBQWUsR0FBRztBQUNyQixPQUFDLGFBQWEsV0FBVyxJQUFJLENBQUMsYUFBYSxXQUFXO0FBQUEsSUFDdkQ7QUFFQSxVQUFNLFNBQVMsSUFBSSxjQUFjLEtBQUssV0FBVyxZQUFZLE9BQU8sV0FBVyxDQUFDO0FBQ2hGLFFBQUksZUFBZSxHQUFHO0FBQ3JCLFdBQUssMEJBQTBCO0FBQUEsSUFDaEMsT0FBTztBQUNOLFdBQUssMEJBQTBCO0FBQUEsSUFDaEM7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBRUEsU0FBUyxxQkFBcUIsT0FBa0IsYUFBMEIsV0FBa0Q7QUFDM0gsTUFBSSxPQUFPO0FBQ1gsUUFBTSxtQkFBbUIsTUFBTSxrQkFBa0I7QUFDakQsTUFBSSxrQkFBa0IsbUJBQ25CLElBQUk7QUFBQSxJQUNMLE1BQU0sa0JBQWtCO0FBQUEsSUFDeEIsVUFBVSxpQkFBaUIsTUFBTSxrQkFBa0IsQ0FBQztBQUFBLEVBQ3JELElBQ0UsSUFBSSxTQUFTLE1BQU0saUJBQWlCLENBQUM7QUFFeEMsYUFBVyxRQUFRLGFBQWE7QUFDL0IsVUFBTSxZQUFZLEtBQUssTUFBTSxpQkFBaUI7QUFDOUMsUUFBSSxDQUFDLGdCQUFnQixnQkFBZ0IsU0FBUyxHQUFHO0FBQ2hELGFBQU87QUFBQSxJQUNSO0FBQ0EsUUFBSUEsZ0JBQWUsVUFBVSxnQkFBZ0IsTUFBTSxjQUFjLGlCQUFpQixTQUFTLENBQUM7QUFDNUYsUUFBSSxVQUFVLGFBQWEsVUFBVSxhQUFhLEdBQUc7QUFJcEQsTUFBQUEsaUJBQWdCO0FBQUEsSUFDakI7QUFDQSxZQUFRQTtBQUNSLFlBQVEsS0FBSztBQUNiLHNCQUFrQixLQUFLLE1BQU0sZUFBZTtBQUFBLEVBQzdDO0FBRUEsUUFBTSxnQkFBZ0IsTUFBTSwwQkFBMEIsVUFBVSxhQUFhO0FBQzdFLFFBQU0sTUFBTSxnQkFBZ0IsSUFBSTtBQUFBLElBQy9CLE1BQU07QUFBQSxJQUNOO0FBQUEsRUFDRCxJQUFJLElBQUksU0FBUyxNQUFNLHlCQUF5QixHQUFHLFVBQVUsc0JBQXNCO0FBRW5GLFFBQU0sZUFBZSxVQUFVO0FBQUEsSUFDOUIsTUFBTSxjQUFjLGlCQUFpQixHQUFHO0FBQUEsRUFDekM7QUFDQSxVQUFRO0FBRVIsUUFBTSxRQUFRLFdBQVcsSUFBSTtBQUM3QixNQUFJLGtCQUFrQjtBQUNyQixRQUFJLE1BQU0sQ0FBQyxNQUFNLElBQUk7QUFDcEIsYUFBTztBQUFBLElBQ1I7QUFDQSxVQUFNLE1BQU07QUFBQSxFQUNiO0FBQ0EsTUFBSSxlQUFlO0FBQ2xCLFFBQUksTUFBTSxNQUFNLFNBQVMsQ0FBQyxNQUFNLElBQUk7QUFDbkMsYUFBTztBQUFBLElBQ1I7QUFDQSxVQUFNLElBQUk7QUFBQSxFQUNYO0FBQ0EsU0FBTyxJQUFJLGNBQWMsT0FBTyxLQUFLO0FBQ3RDO0FBRU8sSUFBSyw2QkFBTCxrQkFBS0MsZ0NBQUw7QUFDTixFQUFBQSx3REFBQTtBQUNBLEVBQUFBLHdEQUFBO0FBQ0EsRUFBQUEsd0RBQUE7QUFDQSxFQUFBQSx3REFBQTtBQUNBLEVBQUFBLHdEQUFBO0FBTFcsU0FBQUE7QUFBQSxHQUFBO0FBVUwsU0FBUyxvQkFBb0IsYUFBdUM7QUFDMUUsU0FBTyxnQkFBZ0IsSUFBSSxJQUFJO0FBQ2hDO0FBRU8sTUFBZSwrQkFBK0I7QUFBQSxFQUNwRCxjQUFjO0FBQUEsRUFBRTtBQUFBLEVBSWhCLElBQVcsaUJBQTBCO0FBQUUsV0FBTztBQUFBLEVBQU87QUFBQSxFQUNyRCxJQUFXLGlCQUEwQjtBQUFFLFdBQU87QUFBQSxFQUFPO0FBQUEsRUFFOUMsY0FBYyxhQUFtQztBQUN2RCxXQUFPLGdCQUFnQixJQUFJLEtBQUssaUJBQWlCLEtBQUs7QUFBQSxFQUN2RDtBQUFBLEVBRU8sZ0JBQWdCLGFBQW1DO0FBQ3pELFdBQU8sZ0JBQWdCLElBQUksS0FBSyxpQkFBaUIsS0FBSztBQUFBLEVBQ3ZEO0FBQUEsRUFVTyxPQUFPLGFBQTBCO0FBQ3ZDLFdBQU8sS0FBSyxlQUFlLGFBQWEsQ0FBQyxLQUFLLGNBQWMsV0FBVyxHQUFHLElBQUk7QUFBQSxFQUMvRTtBQUFBLEVBRU8sU0FBUyxhQUFnQztBQUMvQyxRQUFJLENBQUMsS0FBSyxnQkFBZ0IsV0FBVyxHQUFHO0FBQ3ZDLGFBQU87QUFBQSxJQUNSO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQUVPLE1BQU0sbUNBQW1DLCtCQUErQjtBQUFBLEVBQzlFLElBQWEsT0FBd0M7QUFBRSxXQUFPO0FBQUEsRUFBaUM7QUFBQSxFQUMvRSxXQUFtQjtBQUFFLFdBQU87QUFBQSxFQUFRO0FBQUEsRUFDcEMsT0FBK0I7QUFBRSxXQUFPO0FBQUEsRUFBTTtBQUFBLEVBRTlDLGVBQWUsYUFBMEIsT0FBZ0IsbUJBQTRCLE9BQStCO0FBQ25JLFFBQUksZ0JBQWdCLEdBQUc7QUFDdEIsYUFBTyxRQUFRLElBQUksNkJBQTZCLElBQUk7QUFBQSxJQUNyRCxPQUFPO0FBQ04sYUFBTyxRQUFRLElBQUksNkJBQTZCLElBQUk7QUFBQSxJQUNyRDtBQUFBLEVBQ0Q7QUFBQSxFQUVnQixPQUFPLE9BQXdDO0FBQzlELFdBQU8sTUFBTSxTQUFTO0FBQUEsRUFDdkI7QUFDRDtBQUVPLE1BQU0scUNBQXFDLCtCQUErQjtBQUFBLEVBQ2hGLElBQWEsT0FBMEM7QUFBRSxXQUFPO0FBQUEsRUFBbUM7QUFBQSxFQUNuRyxJQUFhLGlCQUEwQjtBQUFFLFdBQU87QUFBQSxFQUFNO0FBQUEsRUFDL0MsV0FBbUI7QUFBRSxXQUFPO0FBQUEsRUFBTTtBQUFBLEVBQ3pCLE9BQStCO0FBQUUsV0FBTyxJQUFJLDZCQUE2QjtBQUFBLEVBQUc7QUFBQSxFQUU1RSxlQUFlLGFBQTBCLE9BQWdCLG1CQUE0QixPQUErQjtBQUNuSSxRQUFJLGdCQUFnQixHQUFHO0FBQ3RCLGFBQU8sUUFBUSxPQUFPLElBQUksMkJBQTJCO0FBQUEsSUFDdEQsT0FBTztBQUNOLGFBQU8sUUFBUSxJQUFJLDJCQUEyQixHQUFHLGdCQUFnQixJQUFJLElBQUksNkJBQTZCO0FBQUEsSUFDdkc7QUFBQSxFQUNEO0FBQUEsRUFFZ0IsT0FBTyxPQUF3QztBQUM5RCxXQUFPLE1BQU0sU0FBUztBQUFBLEVBQ3ZCO0FBQ0Q7QUFFTyxNQUFNLHFDQUFxQywrQkFBK0I7QUFBQSxFQUNoRixJQUFhLE9BQTBDO0FBQUUsV0FBTztBQUFBLEVBQW1DO0FBQUEsRUFDbkcsSUFBYSxpQkFBMEI7QUFBRSxXQUFPO0FBQUEsRUFBTTtBQUFBLEVBQy9DLFdBQW1CO0FBQUUsV0FBTztBQUFBLEVBQU07QUFBQSxFQUN6QixPQUErQjtBQUFFLFdBQU8sSUFBSSw2QkFBNkI7QUFBQSxFQUFHO0FBQUEsRUFFckYsZUFBZSxhQUEwQixPQUFnQixtQkFBNEIsT0FBK0I7QUFDMUgsUUFBSSxnQkFBZ0IsR0FBRztBQUN0QixhQUFPLFFBQVEsT0FBTyxJQUFJLDJCQUEyQjtBQUFBLElBQ3RELE9BQU87QUFDTixhQUFPLFFBQVEsSUFBSSwyQkFBMkIsR0FBRyxnQkFBZ0IsSUFBSSxJQUFJLDZCQUE2QjtBQUFBLElBQ3ZHO0FBQUEsRUFDRDtBQUFBLEVBRWdCLE9BQU8sT0FBd0M7QUFDOUQsV0FBTyxNQUFNLFNBQVM7QUFBQSxFQUN2QjtBQUNEO0FBRU8sTUFBTSxtQ0FBbUMsK0JBQStCO0FBQUEsRUFDOUUsWUFDaUIsWUFDQSxrQkFDZjtBQUNELFVBQU07QUFIVTtBQUNBO0FBQUEsRUFHakI7QUFBQSxFQUVBLElBQWEsT0FBd0M7QUFBRSxXQUFPO0FBQUEsRUFBaUM7QUFBQSxFQUMvRixJQUFhLGlCQUEwQjtBQUFFLFdBQU87QUFBQSxFQUFNO0FBQUEsRUFDdEQsSUFBYSxpQkFBMEI7QUFBRSxXQUFPO0FBQUEsRUFBTTtBQUFBLEVBRS9DLFdBQW1CO0FBQ3pCLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFZ0IsT0FBK0I7QUFBRSxXQUFPLElBQUksMkJBQTJCLG9CQUFvQixLQUFLLFVBQVUsR0FBRyxLQUFLLGdCQUFnQjtBQUFBLEVBQUc7QUFBQSxFQUU5SSxlQUFlLGFBQTBCLE9BQWdCLG1CQUE0QixPQUErQjtBQUMxSCxRQUFJLE9BQU87QUFDVixhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU8sZ0JBQWdCLElBQUksSUFBSSw2QkFBNkIsSUFBSSxJQUFJLDZCQUE2QjtBQUFBLEVBQ2xHO0FBQUEsRUFFZ0IsT0FBTyxPQUF3QztBQUM5RCxXQUFPLE1BQU0sU0FBUyxnQkFBbUMsS0FBSyxlQUFlLE1BQU0sY0FBYyxLQUFLLHFCQUFxQixNQUFNO0FBQUEsRUFDbEk7QUFBQSxFQUVnQixTQUFTLGFBQWdDO0FBQ3hELFdBQU8sZ0JBQWdCLEtBQUssYUFBYSxnQkFBbUI7QUFBQSxFQUM3RDtBQUNEO0FBRU8sTUFBTSwyQ0FBMkMsK0JBQStCO0FBQUEsRUFDdEYsSUFBYSxPQUFnRDtBQUFFLFdBQU87QUFBQSxFQUF5QztBQUFBLEVBQy9GLFdBQW1CO0FBQUUsV0FBTztBQUFBLEVBQWdCO0FBQUEsRUFDNUMsT0FBK0I7QUFBRSxXQUFPO0FBQUEsRUFBTTtBQUFBLEVBRXZELGVBQWUsYUFBMEIsT0FBZ0IsbUJBQTRCLE9BQStCO0FBQzFILFFBQUksQ0FBQyxPQUFPO0FBQ1gsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPLGdCQUFnQixJQUFJLElBQUksNkJBQTZCLElBQUksSUFBSSw2QkFBNkI7QUFBQSxFQUNsRztBQUFBLEVBRWdCLE9BQU8sT0FBd0M7QUFDOUQsV0FBTyxNQUFNLFNBQVM7QUFBQSxFQUN2QjtBQUNEO0FBSU8sSUFBVTtBQUFBLENBQVYsQ0FBVUMsNEJBQVY7QUFDQyxFQUFNQSx3QkFBQSxPQUFPLElBQUksMkJBQTJCO0FBQzVDLEVBQU1BLHdCQUFBLGVBQWUsSUFBSSxtQ0FBbUM7QUFBQSxHQUZuRDtBQUtWLElBQVcsYUFBWCxrQkFBV0MsZ0JBQVg7QUFDTixFQUFBQSx3QkFBQSxjQUFXLEtBQVg7QUFDQSxFQUFBQSx3QkFBQSxXQUFRLEtBQVI7QUFDQSxFQUFBQSx3QkFBQSxZQUFTLEtBQVQ7QUFDQSxFQUFBQSx3QkFBQSxrQkFBZSxLQUFmO0FBSmlCLFNBQUFBO0FBQUEsR0FBQTsiLAogICJuYW1lcyI6IFsib3JpZ2luYWxUZXh0IiwgIk1vZGlmaWVkQmFzZVJhbmdlU3RhdGVLaW5kIiwgIk1vZGlmaWVkQmFzZVJhbmdlU3RhdGUiLCAiSW5wdXRTdGF0ZSJdCn0K
