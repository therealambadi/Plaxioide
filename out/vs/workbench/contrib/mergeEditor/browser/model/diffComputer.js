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
import { assertFn, checkAdjacentItems } from "../../../../../base/common/assert.js";
import { IEditorWorkerService } from "../../../../../editor/common/services/editorWorker.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { LineRange } from "./lineRange.js";
import { DetailedLineRangeMapping, RangeMapping } from "./mapping.js";
import { observableConfigValue } from "../../../../../platform/observable/common/platformObservableUtils.js";
let MergeDiffComputer = class {
  constructor(editorWorkerService, configurationService) {
    this.editorWorkerService = editorWorkerService;
    this.configurationService = configurationService;
    this.mergeAlgorithm = observableConfigValue(
      "mergeEditor.diffAlgorithm",
      "advanced",
      this.configurationService
    ).map((v) => v === "smart" ? "legacy" : v === "experimental" ? "advanced" : v);
  }
  async computeDiff(textModel1, textModel2, reader) {
    const diffAlgorithm = this.mergeAlgorithm.read(reader);
    const inputVersion = textModel1.getVersionId();
    const outputVersion = textModel2.getVersionId();
    const result = await this.editorWorkerService.computeDiff(
      textModel1.uri,
      textModel2.uri,
      {
        ignoreTrimWhitespace: false,
        maxComputationTimeMs: 0,
        computeMoves: false
      },
      diffAlgorithm
    );
    if (!result) {
      throw new Error("Diff computation failed");
    }
    if (textModel1.isDisposed() || textModel2.isDisposed()) {
      return { diffs: null };
    }
    const changes = result.changes.map(
      (c) => new DetailedLineRangeMapping(
        toLineRange(c.original),
        textModel1,
        toLineRange(c.modified),
        textModel2,
        c.innerChanges?.map((ic) => toRangeMapping(ic))
      )
    );
    const newInputVersion = textModel1.getVersionId();
    const newOutputVersion = textModel2.getVersionId();
    if (inputVersion !== newInputVersion || outputVersion !== newOutputVersion) {
      return { diffs: null };
    }
    assertFn(() => {
      for (const c of changes) {
        const inputRange = c.inputRange;
        const outputRange = c.outputRange;
        const inputTextModel = c.inputTextModel;
        const outputTextModel = c.outputTextModel;
        for (const map of c.rangeMappings) {
          let inputRangesValid = inputRange.startLineNumber - 1 <= map.inputRange.startLineNumber && map.inputRange.endLineNumber <= inputRange.endLineNumberExclusive;
          if (inputRangesValid && map.inputRange.startLineNumber === inputRange.startLineNumber - 1) {
            inputRangesValid = map.inputRange.endColumn >= inputTextModel.getLineMaxColumn(map.inputRange.startLineNumber);
          }
          if (inputRangesValid && map.inputRange.endLineNumber === inputRange.endLineNumberExclusive) {
            inputRangesValid = map.inputRange.endColumn === 1;
          }
          let outputRangesValid = outputRange.startLineNumber - 1 <= map.outputRange.startLineNumber && map.outputRange.endLineNumber <= outputRange.endLineNumberExclusive;
          if (outputRangesValid && map.outputRange.startLineNumber === outputRange.startLineNumber - 1) {
            outputRangesValid = map.outputRange.endColumn >= outputTextModel.getLineMaxColumn(map.outputRange.endLineNumber);
          }
          if (outputRangesValid && map.outputRange.endLineNumber === outputRange.endLineNumberExclusive) {
            outputRangesValid = map.outputRange.endColumn === 1;
          }
          if (!inputRangesValid || !outputRangesValid) {
            return false;
          }
        }
      }
      return changes.length === 0 || changes[0].inputRange.startLineNumber === changes[0].outputRange.startLineNumber && checkAdjacentItems(
        changes,
        (m1, m2) => m2.inputRange.startLineNumber - m1.inputRange.endLineNumberExclusive === m2.outputRange.startLineNumber - m1.outputRange.endLineNumberExclusive && // There has to be an unchanged line in between (otherwise both diffs should have been joined)
        m1.inputRange.endLineNumberExclusive < m2.inputRange.startLineNumber && m1.outputRange.endLineNumberExclusive < m2.outputRange.startLineNumber
      );
    });
    return {
      diffs: changes
    };
  }
};
MergeDiffComputer = __decorateClass([
  __decorateParam(0, IEditorWorkerService),
  __decorateParam(1, IConfigurationService)
], MergeDiffComputer);
function toLineRange(range) {
  return new LineRange(range.startLineNumber, range.length);
}
function toRangeMapping(mapping) {
  return new RangeMapping(mapping.originalRange, mapping.modifiedRange);
}
export {
  MergeDiffComputer,
  toLineRange,
  toRangeMapping
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL21vZGVsL2RpZmZDb21wdXRlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGFzc2VydEZuLCBjaGVja0FkamFjZW50SXRlbXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3NlcnQuanMnO1xuaW1wb3J0IHsgSVJlYWRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgUmFuZ2VNYXBwaW5nIGFzIERpZmZSYW5nZU1hcHBpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2RpZmYvcmFuZ2VNYXBwaW5nLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElFZGl0b3JXb3JrZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9lZGl0b3JXb3JrZXIuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBMaW5lUmFuZ2UgfSBmcm9tICcuL2xpbmVSYW5nZS5qcyc7XG5pbXBvcnQgeyBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcsIFJhbmdlTWFwcGluZyB9IGZyb20gJy4vbWFwcGluZy5qcyc7XG5pbXBvcnQgeyBvYnNlcnZhYmxlQ29uZmlnVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9vYnNlcnZhYmxlL2NvbW1vbi9wbGF0Zm9ybU9ic2VydmFibGVVdGlscy5qcyc7XG5pbXBvcnQgeyBMaW5lUmFuZ2UgYXMgRGlmZkxpbmVSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9saW5lUmFuZ2UuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElNZXJnZURpZmZDb21wdXRlciB7XG5cdGNvbXB1dGVEaWZmKHRleHRNb2RlbDE6IElUZXh0TW9kZWwsIHRleHRNb2RlbDI6IElUZXh0TW9kZWwsIHJlYWRlcjogSVJlYWRlcik6IFByb21pc2U8SU1lcmdlRGlmZkNvbXB1dGVyUmVzdWx0Pjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTWVyZ2VEaWZmQ29tcHV0ZXJSZXN1bHQge1xuXHRkaWZmczogRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nW10gfCBudWxsO1xufVxuXG5leHBvcnQgY2xhc3MgTWVyZ2VEaWZmQ29tcHV0ZXIgaW1wbGVtZW50cyBJTWVyZ2VEaWZmQ29tcHV0ZXIge1xuXHRwcml2YXRlIHJlYWRvbmx5IG1lcmdlQWxnb3JpdGhtID0gb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlPCdzbWFydCcgfCAnZXhwZXJpbWVudGFsJyB8ICdsZWdhY3knIHwgJ2FkdmFuY2VkJz4oXG5cdFx0J21lcmdlRWRpdG9yLmRpZmZBbGdvcml0aG0nLCAnYWR2YW5jZWQnLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKVxuXHRcdC5tYXAodiA9PiB2ID09PSAnc21hcnQnID8gJ2xlZ2FjeScgOiB2ID09PSAnZXhwZXJpbWVudGFsJyA/ICdhZHZhbmNlZCcgOiB2KTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUVkaXRvcldvcmtlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JXb3JrZXJTZXJ2aWNlOiBJRWRpdG9yV29ya2VyU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdH1cblxuXHRhc3luYyBjb21wdXRlRGlmZih0ZXh0TW9kZWwxOiBJVGV4dE1vZGVsLCB0ZXh0TW9kZWwyOiBJVGV4dE1vZGVsLCByZWFkZXI6IElSZWFkZXIpOiBQcm9taXNlPElNZXJnZURpZmZDb21wdXRlclJlc3VsdD4ge1xuXHRcdGNvbnN0IGRpZmZBbGdvcml0aG0gPSB0aGlzLm1lcmdlQWxnb3JpdGhtLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBpbnB1dFZlcnNpb24gPSB0ZXh0TW9kZWwxLmdldFZlcnNpb25JZCgpO1xuXHRcdGNvbnN0IG91dHB1dFZlcnNpb24gPSB0ZXh0TW9kZWwyLmdldFZlcnNpb25JZCgpO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5lZGl0b3JXb3JrZXJTZXJ2aWNlLmNvbXB1dGVEaWZmKFxuXHRcdFx0dGV4dE1vZGVsMS51cmksXG5cdFx0XHR0ZXh0TW9kZWwyLnVyaSxcblx0XHRcdHtcblx0XHRcdFx0aWdub3JlVHJpbVdoaXRlc3BhY2U6IGZhbHNlLFxuXHRcdFx0XHRtYXhDb21wdXRhdGlvblRpbWVNczogMCxcblx0XHRcdFx0Y29tcHV0ZU1vdmVzOiBmYWxzZSxcblx0XHRcdH0sXG5cdFx0XHRkaWZmQWxnb3JpdGhtLFxuXHRcdCk7XG5cblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdEaWZmIGNvbXB1dGF0aW9uIGZhaWxlZCcpO1xuXHRcdH1cblxuXHRcdGlmICh0ZXh0TW9kZWwxLmlzRGlzcG9zZWQoKSB8fCB0ZXh0TW9kZWwyLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0cmV0dXJuIHsgZGlmZnM6IG51bGwgfTtcblx0XHR9XG5cblx0XHRjb25zdCBjaGFuZ2VzID0gcmVzdWx0LmNoYW5nZXMubWFwKGMgPT5cblx0XHRcdG5ldyBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcoXG5cdFx0XHRcdHRvTGluZVJhbmdlKGMub3JpZ2luYWwpLFxuXHRcdFx0XHR0ZXh0TW9kZWwxLFxuXHRcdFx0XHR0b0xpbmVSYW5nZShjLm1vZGlmaWVkKSxcblx0XHRcdFx0dGV4dE1vZGVsMixcblx0XHRcdFx0Yy5pbm5lckNoYW5nZXM/Lm1hcChpYyA9PiB0b1JhbmdlTWFwcGluZyhpYykpXG5cdFx0XHQpXG5cdFx0KTtcblxuXHRcdGNvbnN0IG5ld0lucHV0VmVyc2lvbiA9IHRleHRNb2RlbDEuZ2V0VmVyc2lvbklkKCk7XG5cdFx0Y29uc3QgbmV3T3V0cHV0VmVyc2lvbiA9IHRleHRNb2RlbDIuZ2V0VmVyc2lvbklkKCk7XG5cblx0XHRpZiAoaW5wdXRWZXJzaW9uICE9PSBuZXdJbnB1dFZlcnNpb24gfHwgb3V0cHV0VmVyc2lvbiAhPT0gbmV3T3V0cHV0VmVyc2lvbikge1xuXHRcdFx0cmV0dXJuIHsgZGlmZnM6IG51bGwgfTtcblx0XHR9XG5cblx0XHRhc3NlcnRGbigoKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGMgb2YgY2hhbmdlcykge1xuXHRcdFx0XHRjb25zdCBpbnB1dFJhbmdlID0gYy5pbnB1dFJhbmdlO1xuXHRcdFx0XHRjb25zdCBvdXRwdXRSYW5nZSA9IGMub3V0cHV0UmFuZ2U7XG5cdFx0XHRcdGNvbnN0IGlucHV0VGV4dE1vZGVsID0gYy5pbnB1dFRleHRNb2RlbDtcblx0XHRcdFx0Y29uc3Qgb3V0cHV0VGV4dE1vZGVsID0gYy5vdXRwdXRUZXh0TW9kZWw7XG5cblx0XHRcdFx0Zm9yIChjb25zdCBtYXAgb2YgYy5yYW5nZU1hcHBpbmdzKSB7XG5cdFx0XHRcdFx0bGV0IGlucHV0UmFuZ2VzVmFsaWQgPSBpbnB1dFJhbmdlLnN0YXJ0TGluZU51bWJlciAtIDEgPD0gbWFwLmlucHV0UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyXG5cdFx0XHRcdFx0XHQmJiBtYXAuaW5wdXRSYW5nZS5lbmRMaW5lTnVtYmVyIDw9IGlucHV0UmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZTtcblx0XHRcdFx0XHRpZiAoaW5wdXRSYW5nZXNWYWxpZCAmJiBtYXAuaW5wdXRSYW5nZS5zdGFydExpbmVOdW1iZXIgPT09IGlucHV0UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyIC0gMSkge1xuXHRcdFx0XHRcdFx0aW5wdXRSYW5nZXNWYWxpZCA9IG1hcC5pbnB1dFJhbmdlLmVuZENvbHVtbiA+PSBpbnB1dFRleHRNb2RlbC5nZXRMaW5lTWF4Q29sdW1uKG1hcC5pbnB1dFJhbmdlLnN0YXJ0TGluZU51bWJlcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChpbnB1dFJhbmdlc1ZhbGlkICYmIG1hcC5pbnB1dFJhbmdlLmVuZExpbmVOdW1iZXIgPT09IGlucHV0UmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSkge1xuXHRcdFx0XHRcdFx0aW5wdXRSYW5nZXNWYWxpZCA9IG1hcC5pbnB1dFJhbmdlLmVuZENvbHVtbiA9PT0gMTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRsZXQgb3V0cHV0UmFuZ2VzVmFsaWQgPSBvdXRwdXRSYW5nZS5zdGFydExpbmVOdW1iZXIgLSAxIDw9IG1hcC5vdXRwdXRSYW5nZS5zdGFydExpbmVOdW1iZXJcblx0XHRcdFx0XHRcdCYmIG1hcC5vdXRwdXRSYW5nZS5lbmRMaW5lTnVtYmVyIDw9IG91dHB1dFJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmU7XG5cdFx0XHRcdFx0aWYgKG91dHB1dFJhbmdlc1ZhbGlkICYmIG1hcC5vdXRwdXRSYW5nZS5zdGFydExpbmVOdW1iZXIgPT09IG91dHB1dFJhbmdlLnN0YXJ0TGluZU51bWJlciAtIDEpIHtcblx0XHRcdFx0XHRcdG91dHB1dFJhbmdlc1ZhbGlkID0gbWFwLm91dHB1dFJhbmdlLmVuZENvbHVtbiA+PSBvdXRwdXRUZXh0TW9kZWwuZ2V0TGluZU1heENvbHVtbihtYXAub3V0cHV0UmFuZ2UuZW5kTGluZU51bWJlcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChvdXRwdXRSYW5nZXNWYWxpZCAmJiBtYXAub3V0cHV0UmFuZ2UuZW5kTGluZU51bWJlciA9PT0gb3V0cHV0UmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSkge1xuXHRcdFx0XHRcdFx0b3V0cHV0UmFuZ2VzVmFsaWQgPSBtYXAub3V0cHV0UmFuZ2UuZW5kQ29sdW1uID09PSAxO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghaW5wdXRSYW5nZXNWYWxpZCB8fCAhb3V0cHV0UmFuZ2VzVmFsaWQpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNoYW5nZXMubGVuZ3RoID09PSAwIHx8IChjaGFuZ2VzWzBdLmlucHV0UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyID09PSBjaGFuZ2VzWzBdLm91dHB1dFJhbmdlLnN0YXJ0TGluZU51bWJlciAmJlxuXHRcdFx0XHRjaGVja0FkamFjZW50SXRlbXMoY2hhbmdlcyxcblx0XHRcdFx0XHQobTEsIG0yKSA9PiBtMi5pbnB1dFJhbmdlLnN0YXJ0TGluZU51bWJlciAtIG0xLmlucHV0UmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSA9PT0gbTIub3V0cHV0UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyIC0gbTEub3V0cHV0UmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSAmJlxuXHRcdFx0XHRcdFx0Ly8gVGhlcmUgaGFzIHRvIGJlIGFuIHVuY2hhbmdlZCBsaW5lIGluIGJldHdlZW4gKG90aGVyd2lzZSBib3RoIGRpZmZzIHNob3VsZCBoYXZlIGJlZW4gam9pbmVkKVxuXHRcdFx0XHRcdFx0bTEuaW5wdXRSYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlIDwgbTIuaW5wdXRSYW5nZS5zdGFydExpbmVOdW1iZXIgJiZcblx0XHRcdFx0XHRcdG0xLm91dHB1dFJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgPCBtMi5vdXRwdXRSYW5nZS5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdCkpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGRpZmZzOiBjaGFuZ2VzXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9MaW5lUmFuZ2UocmFuZ2U6IERpZmZMaW5lUmFuZ2UpOiBMaW5lUmFuZ2Uge1xuXHRyZXR1cm4gbmV3IExpbmVSYW5nZShyYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLmxlbmd0aCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b1JhbmdlTWFwcGluZyhtYXBwaW5nOiBEaWZmUmFuZ2VNYXBwaW5nKTogUmFuZ2VNYXBwaW5nIHtcblx0cmV0dXJuIG5ldyBSYW5nZU1hcHBpbmcobWFwcGluZy5vcmlnaW5hbFJhbmdlLCBtYXBwaW5nLm1vZGlmaWVkUmFuZ2UpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFVBQVUsMEJBQTBCO0FBSTdDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsMEJBQTBCLG9CQUFvQjtBQUN2RCxTQUFTLDZCQUE2QjtBQVcvQixJQUFNLG9CQUFOLE1BQXNEO0FBQUEsRUFLNUQsWUFDd0MscUJBQ0Msc0JBQ3ZDO0FBRnNDO0FBQ0M7QUFOekMsU0FBaUIsaUJBQWlCO0FBQUEsTUFDakM7QUFBQSxNQUE2QjtBQUFBLE1BQVksS0FBSztBQUFBLElBQW9CLEVBQ2pFLElBQUksT0FBSyxNQUFNLFVBQVUsV0FBVyxNQUFNLGlCQUFpQixhQUFhLENBQUM7QUFBQSxFQU0zRTtBQUFBLEVBRUEsTUFBTSxZQUFZLFlBQXdCLFlBQXdCLFFBQW9EO0FBQ3JILFVBQU0sZ0JBQWdCLEtBQUssZUFBZSxLQUFLLE1BQU07QUFDckQsVUFBTSxlQUFlLFdBQVcsYUFBYTtBQUM3QyxVQUFNLGdCQUFnQixXQUFXLGFBQWE7QUFFOUMsVUFBTSxTQUFTLE1BQU0sS0FBSyxvQkFBb0I7QUFBQSxNQUM3QyxXQUFXO0FBQUEsTUFDWCxXQUFXO0FBQUEsTUFDWDtBQUFBLFFBQ0Msc0JBQXNCO0FBQUEsUUFDdEIsc0JBQXNCO0FBQUEsUUFDdEIsY0FBYztBQUFBLE1BQ2Y7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUVBLFFBQUksQ0FBQyxRQUFRO0FBQ1osWUFBTSxJQUFJLE1BQU0seUJBQXlCO0FBQUEsSUFDMUM7QUFFQSxRQUFJLFdBQVcsV0FBVyxLQUFLLFdBQVcsV0FBVyxHQUFHO0FBQ3ZELGFBQU8sRUFBRSxPQUFPLEtBQUs7QUFBQSxJQUN0QjtBQUVBLFVBQU0sVUFBVSxPQUFPLFFBQVE7QUFBQSxNQUFJLE9BQ2xDLElBQUk7QUFBQSxRQUNILFlBQVksRUFBRSxRQUFRO0FBQUEsUUFDdEI7QUFBQSxRQUNBLFlBQVksRUFBRSxRQUFRO0FBQUEsUUFDdEI7QUFBQSxRQUNBLEVBQUUsY0FBYyxJQUFJLFFBQU0sZUFBZSxFQUFFLENBQUM7QUFBQSxNQUM3QztBQUFBLElBQ0Q7QUFFQSxVQUFNLGtCQUFrQixXQUFXLGFBQWE7QUFDaEQsVUFBTSxtQkFBbUIsV0FBVyxhQUFhO0FBRWpELFFBQUksaUJBQWlCLG1CQUFtQixrQkFBa0Isa0JBQWtCO0FBQzNFLGFBQU8sRUFBRSxPQUFPLEtBQUs7QUFBQSxJQUN0QjtBQUVBLGFBQVMsTUFBTTtBQUNkLGlCQUFXLEtBQUssU0FBUztBQUN4QixjQUFNLGFBQWEsRUFBRTtBQUNyQixjQUFNLGNBQWMsRUFBRTtBQUN0QixjQUFNLGlCQUFpQixFQUFFO0FBQ3pCLGNBQU0sa0JBQWtCLEVBQUU7QUFFMUIsbUJBQVcsT0FBTyxFQUFFLGVBQWU7QUFDbEMsY0FBSSxtQkFBbUIsV0FBVyxrQkFBa0IsS0FBSyxJQUFJLFdBQVcsbUJBQ3BFLElBQUksV0FBVyxpQkFBaUIsV0FBVztBQUMvQyxjQUFJLG9CQUFvQixJQUFJLFdBQVcsb0JBQW9CLFdBQVcsa0JBQWtCLEdBQUc7QUFDMUYsK0JBQW1CLElBQUksV0FBVyxhQUFhLGVBQWUsaUJBQWlCLElBQUksV0FBVyxlQUFlO0FBQUEsVUFDOUc7QUFDQSxjQUFJLG9CQUFvQixJQUFJLFdBQVcsa0JBQWtCLFdBQVcsd0JBQXdCO0FBQzNGLCtCQUFtQixJQUFJLFdBQVcsY0FBYztBQUFBLFVBQ2pEO0FBRUEsY0FBSSxvQkFBb0IsWUFBWSxrQkFBa0IsS0FBSyxJQUFJLFlBQVksbUJBQ3ZFLElBQUksWUFBWSxpQkFBaUIsWUFBWTtBQUNqRCxjQUFJLHFCQUFxQixJQUFJLFlBQVksb0JBQW9CLFlBQVksa0JBQWtCLEdBQUc7QUFDN0YsZ0NBQW9CLElBQUksWUFBWSxhQUFhLGdCQUFnQixpQkFBaUIsSUFBSSxZQUFZLGFBQWE7QUFBQSxVQUNoSDtBQUNBLGNBQUkscUJBQXFCLElBQUksWUFBWSxrQkFBa0IsWUFBWSx3QkFBd0I7QUFDOUYsZ0NBQW9CLElBQUksWUFBWSxjQUFjO0FBQUEsVUFDbkQ7QUFFQSxjQUFJLENBQUMsb0JBQW9CLENBQUMsbUJBQW1CO0FBQzVDLG1CQUFPO0FBQUEsVUFDUjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBRUEsYUFBTyxRQUFRLFdBQVcsS0FBTSxRQUFRLENBQUMsRUFBRSxXQUFXLG9CQUFvQixRQUFRLENBQUMsRUFBRSxZQUFZLG1CQUNoRztBQUFBLFFBQW1CO0FBQUEsUUFDbEIsQ0FBQyxJQUFJLE9BQU8sR0FBRyxXQUFXLGtCQUFrQixHQUFHLFdBQVcsMkJBQTJCLEdBQUcsWUFBWSxrQkFBa0IsR0FBRyxZQUFZO0FBQUEsUUFFcEksR0FBRyxXQUFXLHlCQUF5QixHQUFHLFdBQVcsbUJBQ3JELEdBQUcsWUFBWSx5QkFBeUIsR0FBRyxZQUFZO0FBQUEsTUFDekQ7QUFBQSxJQUNGLENBQUM7QUFFRCxXQUFPO0FBQUEsTUFDTixPQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFDRDtBQWpHYSxvQkFBTjtBQUFBLEVBTUo7QUFBQSxFQUNBO0FBQUEsR0FQVTtBQW1HTixTQUFTLFlBQVksT0FBaUM7QUFDNUQsU0FBTyxJQUFJLFVBQVUsTUFBTSxpQkFBaUIsTUFBTSxNQUFNO0FBQ3pEO0FBRU8sU0FBUyxlQUFlLFNBQXlDO0FBQ3ZFLFNBQU8sSUFBSSxhQUFhLFFBQVEsZUFBZSxRQUFRLGFBQWE7QUFDckU7IiwKICAibmFtZXMiOiBbXQp9Cg==
