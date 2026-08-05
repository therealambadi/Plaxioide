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
import { mock } from "../../../../../base/test/common/mock.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { assertType } from "../../../../../base/common/types.js";
import { EditorWorker } from "../../../../../editor/common/services/editorWebWorker.js";
import { LineRange } from "../../../../../editor/common/core/lineRange.js";
import { MovedText } from "../../../../../editor/common/diff/linesDiffComputer.js";
import { LineRangeMapping, DetailedLineRangeMapping, RangeMapping } from "../../../../../editor/common/diff/rangeMapping.js";
let TestWorkerService = class extends mock() {
  constructor(_modelService) {
    super();
    this._modelService = _modelService;
    this._worker = new EditorWorker();
  }
  async computeMoreMinimalEdits(resource, edits, pretty) {
    return void 0;
  }
  async computeDiff(original, modified, options, algorithm) {
    const originalModel = this._modelService.getModel(original);
    const modifiedModel = this._modelService.getModel(modified);
    assertType(originalModel);
    assertType(modifiedModel);
    this._worker.$acceptNewModel({
      url: originalModel.uri.toString(),
      versionId: originalModel.getVersionId(),
      lines: originalModel.getLinesContent(),
      EOL: originalModel.getEOL()
    });
    this._worker.$acceptNewModel({
      url: modifiedModel.uri.toString(),
      versionId: modifiedModel.getVersionId(),
      lines: modifiedModel.getLinesContent(),
      EOL: modifiedModel.getEOL()
    });
    const result = await this._worker.$computeDiff(originalModel.uri.toString(), modifiedModel.uri.toString(), options, algorithm);
    if (!result) {
      return result;
    }
    const diff = {
      identical: result.identical,
      quitEarly: result.quitEarly,
      changes: toLineRangeMappings(result.changes),
      moves: result.moves.map((m) => new MovedText(
        new LineRangeMapping(new LineRange(m[0], m[1]), new LineRange(m[2], m[3])),
        toLineRangeMappings(m[4])
      ))
    };
    return diff;
    function toLineRangeMappings(changes) {
      return changes.map(
        (c) => new DetailedLineRangeMapping(
          new LineRange(c[0], c[1]),
          new LineRange(c[2], c[3]),
          c[4]?.map(
            (c2) => new RangeMapping(
              new Range(c2[0], c2[1], c2[2], c2[3]),
              new Range(c2[4], c2[5], c2[6], c2[7])
            )
          )
        )
      );
    }
  }
};
TestWorkerService = __decorateClass([
  __decorateParam(0, IModelService)
], TestWorkerService);
export {
  TestWorkerService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDaGF0L3Rlc3QvYnJvd3Nlci90ZXN0V29ya2VyU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgbW9jayB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vbW9jay5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgRGlmZkFsZ29yaXRobU5hbWUsIElFZGl0b3JXb3JrZXJTZXJ2aWNlLCBJTGluZUNoYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvZWRpdG9yV29ya2VyLmpzJztcbmltcG9ydCB7IElEb2N1bWVudERpZmYsIElEb2N1bWVudERpZmZQcm92aWRlck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2RpZmYvZG9jdW1lbnREaWZmUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yV29ya2VyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9lZGl0b3JXZWJXb3JrZXIuanMnO1xuaW1wb3J0IHsgTGluZVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL2xpbmVSYW5nZS5qcyc7XG5pbXBvcnQgeyBNb3ZlZFRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2RpZmYvbGluZXNEaWZmQ29tcHV0ZXIuanMnO1xuaW1wb3J0IHsgTGluZVJhbmdlTWFwcGluZywgRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nLCBSYW5nZU1hcHBpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2RpZmYvcmFuZ2VNYXBwaW5nLmpzJztcbmltcG9ydCB7IFRleHRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuXG5cbmV4cG9ydCBjbGFzcyBUZXN0V29ya2VyU2VydmljZSBleHRlbmRzIG1vY2s8SUVkaXRvcldvcmtlclNlcnZpY2U+KCkge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3dvcmtlciA9IG5ldyBFZGl0b3JXb3JrZXIoKTtcblxuXHRjb25zdHJ1Y3RvcihASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgY29tcHV0ZU1vcmVNaW5pbWFsRWRpdHMocmVzb3VyY2U6IFVSSSwgZWRpdHM6IFRleHRFZGl0W10gfCBudWxsIHwgdW5kZWZpbmVkLCBwcmV0dHk/OiBib29sZWFuIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxUZXh0RWRpdFtdIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIGNvbXB1dGVEaWZmKG9yaWdpbmFsOiBVUkksIG1vZGlmaWVkOiBVUkksIG9wdGlvbnM6IElEb2N1bWVudERpZmZQcm92aWRlck9wdGlvbnMsIGFsZ29yaXRobTogRGlmZkFsZ29yaXRobU5hbWUpOiBQcm9taXNlPElEb2N1bWVudERpZmYgfCBudWxsPiB7XG5cblx0XHRjb25zdCBvcmlnaW5hbE1vZGVsID0gdGhpcy5fbW9kZWxTZXJ2aWNlLmdldE1vZGVsKG9yaWdpbmFsKTtcblx0XHRjb25zdCBtb2RpZmllZE1vZGVsID0gdGhpcy5fbW9kZWxTZXJ2aWNlLmdldE1vZGVsKG1vZGlmaWVkKTtcblxuXHRcdGFzc2VydFR5cGUob3JpZ2luYWxNb2RlbCk7XG5cdFx0YXNzZXJ0VHlwZShtb2RpZmllZE1vZGVsKTtcblxuXHRcdHRoaXMuX3dvcmtlci4kYWNjZXB0TmV3TW9kZWwoe1xuXHRcdFx0dXJsOiBvcmlnaW5hbE1vZGVsLnVyaS50b1N0cmluZygpLFxuXHRcdFx0dmVyc2lvbklkOiBvcmlnaW5hbE1vZGVsLmdldFZlcnNpb25JZCgpLFxuXHRcdFx0bGluZXM6IG9yaWdpbmFsTW9kZWwuZ2V0TGluZXNDb250ZW50KCksXG5cdFx0XHRFT0w6IG9yaWdpbmFsTW9kZWwuZ2V0RU9MKCksXG5cdFx0fSk7XG5cblx0XHR0aGlzLl93b3JrZXIuJGFjY2VwdE5ld01vZGVsKHtcblx0XHRcdHVybDogbW9kaWZpZWRNb2RlbC51cmkudG9TdHJpbmcoKSxcblx0XHRcdHZlcnNpb25JZDogbW9kaWZpZWRNb2RlbC5nZXRWZXJzaW9uSWQoKSxcblx0XHRcdGxpbmVzOiBtb2RpZmllZE1vZGVsLmdldExpbmVzQ29udGVudCgpLFxuXHRcdFx0RU9MOiBtb2RpZmllZE1vZGVsLmdldEVPTCgpLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5fd29ya2VyLiRjb21wdXRlRGlmZihvcmlnaW5hbE1vZGVsLnVyaS50b1N0cmluZygpLCBtb2RpZmllZE1vZGVsLnVyaS50b1N0cmluZygpLCBvcHRpb25zLCBhbGdvcml0aG0pO1xuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0XHQvLyBDb252ZXJ0IGZyb20gc3BhY2UgZWZmaWNpZW50IEpTT04gZGF0YSB0byByaWNoIG9iamVjdHMuXG5cdFx0Y29uc3QgZGlmZjogSURvY3VtZW50RGlmZiA9IHtcblx0XHRcdGlkZW50aWNhbDogcmVzdWx0LmlkZW50aWNhbCxcblx0XHRcdHF1aXRFYXJseTogcmVzdWx0LnF1aXRFYXJseSxcblx0XHRcdGNoYW5nZXM6IHRvTGluZVJhbmdlTWFwcGluZ3MocmVzdWx0LmNoYW5nZXMpLFxuXHRcdFx0bW92ZXM6IHJlc3VsdC5tb3Zlcy5tYXAobSA9PiBuZXcgTW92ZWRUZXh0KFxuXHRcdFx0XHRuZXcgTGluZVJhbmdlTWFwcGluZyhuZXcgTGluZVJhbmdlKG1bMF0sIG1bMV0pLCBuZXcgTGluZVJhbmdlKG1bMl0sIG1bM10pKSxcblx0XHRcdFx0dG9MaW5lUmFuZ2VNYXBwaW5ncyhtWzRdKVxuXHRcdFx0KSlcblx0XHR9O1xuXHRcdHJldHVybiBkaWZmO1xuXG5cdFx0ZnVuY3Rpb24gdG9MaW5lUmFuZ2VNYXBwaW5ncyhjaGFuZ2VzOiByZWFkb25seSBJTGluZUNoYW5nZVtdKTogcmVhZG9ubHkgRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nW10ge1xuXHRcdFx0cmV0dXJuIGNoYW5nZXMubWFwKFxuXHRcdFx0XHQoYykgPT4gbmV3IERldGFpbGVkTGluZVJhbmdlTWFwcGluZyhcblx0XHRcdFx0XHRuZXcgTGluZVJhbmdlKGNbMF0sIGNbMV0pLFxuXHRcdFx0XHRcdG5ldyBMaW5lUmFuZ2UoY1syXSwgY1szXSksXG5cdFx0XHRcdFx0Y1s0XT8ubWFwKFxuXHRcdFx0XHRcdFx0KGMpID0+IG5ldyBSYW5nZU1hcHBpbmcoXG5cdFx0XHRcdFx0XHRcdG5ldyBSYW5nZShjWzBdLCBjWzFdLCBjWzJdLCBjWzNdKSxcblx0XHRcdFx0XHRcdFx0bmV3IFJhbmdlKGNbNF0sIGNbNV0sIGNbNl0sIGNbN10pXG5cdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHQpXG5cdFx0XHQpO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFlBQVk7QUFDckIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsa0JBQWtCO0FBRzNCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsa0JBQWtCLDBCQUEwQixvQkFBb0I7QUFJbEUsSUFBTSxvQkFBTixjQUFnQyxLQUEyQixFQUFFO0FBQUEsRUFJbkUsWUFBNEMsZUFBOEI7QUFDekUsVUFBTTtBQURxQztBQUY1QyxTQUFpQixVQUFVLElBQUksYUFBYTtBQUFBLEVBSTVDO0FBQUEsRUFFQSxNQUFlLHdCQUF3QixVQUFlLE9BQXNDLFFBQStEO0FBQzFKLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxNQUFlLFlBQVksVUFBZSxVQUFlLFNBQXVDLFdBQTZEO0FBRTVKLFVBQU0sZ0JBQWdCLEtBQUssY0FBYyxTQUFTLFFBQVE7QUFDMUQsVUFBTSxnQkFBZ0IsS0FBSyxjQUFjLFNBQVMsUUFBUTtBQUUxRCxlQUFXLGFBQWE7QUFDeEIsZUFBVyxhQUFhO0FBRXhCLFNBQUssUUFBUSxnQkFBZ0I7QUFBQSxNQUM1QixLQUFLLGNBQWMsSUFBSSxTQUFTO0FBQUEsTUFDaEMsV0FBVyxjQUFjLGFBQWE7QUFBQSxNQUN0QyxPQUFPLGNBQWMsZ0JBQWdCO0FBQUEsTUFDckMsS0FBSyxjQUFjLE9BQU87QUFBQSxJQUMzQixDQUFDO0FBRUQsU0FBSyxRQUFRLGdCQUFnQjtBQUFBLE1BQzVCLEtBQUssY0FBYyxJQUFJLFNBQVM7QUFBQSxNQUNoQyxXQUFXLGNBQWMsYUFBYTtBQUFBLE1BQ3RDLE9BQU8sY0FBYyxnQkFBZ0I7QUFBQSxNQUNyQyxLQUFLLGNBQWMsT0FBTztBQUFBLElBQzNCLENBQUM7QUFFRCxVQUFNLFNBQVMsTUFBTSxLQUFLLFFBQVEsYUFBYSxjQUFjLElBQUksU0FBUyxHQUFHLGNBQWMsSUFBSSxTQUFTLEdBQUcsU0FBUyxTQUFTO0FBQzdILFFBQUksQ0FBQyxRQUFRO0FBQ1osYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLE9BQXNCO0FBQUEsTUFDM0IsV0FBVyxPQUFPO0FBQUEsTUFDbEIsV0FBVyxPQUFPO0FBQUEsTUFDbEIsU0FBUyxvQkFBb0IsT0FBTyxPQUFPO0FBQUEsTUFDM0MsT0FBTyxPQUFPLE1BQU0sSUFBSSxPQUFLLElBQUk7QUFBQSxRQUNoQyxJQUFJLGlCQUFpQixJQUFJLFVBQVUsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUFBLFFBQ3pFLG9CQUFvQixFQUFFLENBQUMsQ0FBQztBQUFBLE1BQ3pCLENBQUM7QUFBQSxJQUNGO0FBQ0EsV0FBTztBQUVQLGFBQVMsb0JBQW9CLFNBQXNFO0FBQ2xHLGFBQU8sUUFBUTtBQUFBLFFBQ2QsQ0FBQyxNQUFNLElBQUk7QUFBQSxVQUNWLElBQUksVUFBVSxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztBQUFBLFVBQ3hCLElBQUksVUFBVSxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztBQUFBLFVBQ3hCLEVBQUUsQ0FBQyxHQUFHO0FBQUEsWUFDTCxDQUFDQSxPQUFNLElBQUk7QUFBQSxjQUNWLElBQUksTUFBTUEsR0FBRSxDQUFDLEdBQUdBLEdBQUUsQ0FBQyxHQUFHQSxHQUFFLENBQUMsR0FBR0EsR0FBRSxDQUFDLENBQUM7QUFBQSxjQUNoQyxJQUFJLE1BQU1BLEdBQUUsQ0FBQyxHQUFHQSxHQUFFLENBQUMsR0FBR0EsR0FBRSxDQUFDLEdBQUdBLEdBQUUsQ0FBQyxDQUFDO0FBQUEsWUFDakM7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNEO0FBakVhLG9CQUFOO0FBQUEsRUFJTztBQUFBLEdBSkQ7IiwKICAibmFtZXMiOiBbImMiXQp9Cg==
