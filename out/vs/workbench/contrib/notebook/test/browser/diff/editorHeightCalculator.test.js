import assert from "assert";
import { DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { mock } from "../../../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { TestConfigurationService } from "../../../../../../platform/configuration/test/common/testConfigurationService.js";
import { DiffEditorHeightCalculatorService } from "../../../browser/diff/editorHeightCalculator.js";
import { URI } from "../../../../../../base/common/uri.js";
import { createTextModel as createTextModelWithText } from "../../../../../../editor/test/common/testTextModel.js";
import { DefaultLinesDiffComputer } from "../../../../../../editor/common/diff/defaultLinesDiffComputer/defaultLinesDiffComputer.js";
import { getEditorPadding } from "../../../browser/diff/diffCellEditorOptions.js";
import { HeightOfHiddenLinesRegionInDiffEditor } from "../../../browser/diff/diffElementViewModel.js";
suite("NotebookDiff EditorHeightCalculator", () => {
  ["Hide Unchanged Regions", "Show Unchanged Regions"].forEach((suiteTitle) => {
    suite(suiteTitle, () => {
      const fontInfo = { lineHeight: 18, fontSize: 18 };
      let disposables;
      let textModelResolver;
      let editorWorkerService;
      const original = URI.parse("original");
      const modified = URI.parse("modified");
      let originalModel;
      let modifiedModel;
      const diffComputer = new DefaultLinesDiffComputer();
      let calculator;
      const hideUnchangedRegions = suiteTitle.startsWith("Hide");
      const configurationService = new TestConfigurationService({
        notebook: { diff: { ignoreMetadata: true } },
        diffEditor: {
          hideUnchangedRegions: {
            enabled: hideUnchangedRegions,
            minimumLineCount: 3,
            contextLineCount: 3
          }
        }
      });
      function createTextModel(lines) {
        return createTextModelWithText(lines.join("\n"));
      }
      teardown(() => disposables.dispose());
      ensureNoDisposablesAreLeakedInTestSuite();
      setup(() => {
        disposables = new DisposableStore();
        textModelResolver = new class extends mock() {
          async createModelReference(resource) {
            return {
              dispose: () => {
              },
              object: {
                textEditorModel: resource === original ? originalModel : modifiedModel,
                getLanguageId: () => "javascript"
              }
            };
          }
        }();
        editorWorkerService = new class extends mock() {
          async computeDiff(_original, _modified, options, _algorithm) {
            const originalLines = new Array(originalModel.getLineCount()).fill(0).map((_, i) => originalModel.getLineContent(i + 1));
            const modifiedLines = new Array(modifiedModel.getLineCount()).fill(0).map((_, i) => modifiedModel.getLineContent(i + 1));
            const result = diffComputer.computeDiff(originalLines, modifiedLines, options);
            const identical = originalLines.join("") === modifiedLines.join("");
            return {
              identical,
              quitEarly: result.hitTimeout,
              changes: result.changes,
              moves: result.moves
            };
          }
        }();
        calculator = new DiffEditorHeightCalculatorService(fontInfo.lineHeight, textModelResolver, editorWorkerService, configurationService);
      });
      test("1 original line with change in same line", async () => {
        originalModel = disposables.add(createTextModel(["Hello World"]));
        modifiedModel = disposables.add(createTextModel(["Foo Bar"]));
        const height = await calculator.diffAndComputeHeight(original, modified);
        const expectedHeight = getExpectedHeight(1, 0);
        assert.strictEqual(height, expectedHeight);
      });
      test("1 original line with insertion of a new line", async () => {
        originalModel = disposables.add(createTextModel(["Hello World"]));
        modifiedModel = disposables.add(createTextModel(["Hello World", "Foo Bar"]));
        const height = await calculator.diffAndComputeHeight(original, modified);
        const expectedHeight = getExpectedHeight(2, 0);
        assert.strictEqual(height, expectedHeight);
      });
      test("1 line with update to a line and insert of a new line", async () => {
        originalModel = disposables.add(createTextModel(["Hello World"]));
        modifiedModel = disposables.add(createTextModel(["Foo Bar", "Bar Baz"]));
        const height = await calculator.diffAndComputeHeight(original, modified);
        const expectedHeight = getExpectedHeight(2, 0);
        assert.strictEqual(height, expectedHeight);
      });
      test("10 line with update to a line and insert of a new line", async () => {
        originalModel = disposables.add(createTextModel(createLines(10)));
        modifiedModel = disposables.add(createTextModel(createLines(10).concat("Foo Bar")));
        const height = await calculator.diffAndComputeHeight(original, modified);
        const expectedHeight = getExpectedHeight(hideUnchangedRegions ? 4 : 11, hideUnchangedRegions ? 1 : 0);
        assert.strictEqual(height, expectedHeight);
      });
      test("50 lines with updates, deletions and inserts", async () => {
        originalModel = disposables.add(createTextModel(createLines(60)));
        const modifiedLines = createLines(60);
        modifiedLines[3] = "Foo Bar";
        modifiedLines.splice(7, 3);
        modifiedLines.splice(10, 0, "Foo Bar1", "Foo Bar2", "Foo Bar3");
        modifiedLines.splice(30, 0, "", "");
        modifiedLines.splice(40, 4);
        modifiedLines.splice(50, 0, "1", "2", "3", "4", "5");
        modifiedModel = disposables.add(createTextModel(modifiedLines));
        const height = await calculator.diffAndComputeHeight(original, modified);
        const expectedHeight = getExpectedHeight(hideUnchangedRegions ? 50 : 70, hideUnchangedRegions ? 3 : 0);
        assert.strictEqual(height, expectedHeight);
      });
      function getExpectedHeight(visibleLineCount, unchangeRegionsHeight) {
        return visibleLineCount * fontInfo.lineHeight + getEditorPadding(visibleLineCount).top + getEditorPadding(visibleLineCount).bottom + unchangeRegionsHeight * HeightOfHiddenLinesRegionInDiffEditor;
      }
      function createLines(count, linePrefix = "Hello World") {
        return new Array(count).fill(0).map((_, i) => `${linePrefix} ${i}`);
      }
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvZGlmZi9lZGl0b3JIZWlnaHRDYWxjdWxhdG9yLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgbW9jayB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vbW9jay5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JIZWlnaHRDYWxjdWxhdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZGlmZi9lZGl0b3JIZWlnaHRDYWxjdWxhdG9yLmpzJztcbmltcG9ydCB7IEZvbnRJbmZvIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZm9udEluZm8uanMnO1xuaW1wb3J0IHsgSVJlc29sdmVkVGV4dEVkaXRvck1vZGVsLCBJVGV4dE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0TW9kZWwgYXMgY3JlYXRlVGV4dE1vZGVsV2l0aFRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBEZWZhdWx0TGluZXNEaWZmQ29tcHV0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2RpZmYvZGVmYXVsdExpbmVzRGlmZkNvbXB1dGVyL2RlZmF1bHRMaW5lc0RpZmZDb21wdXRlci5qcyc7XG5pbXBvcnQgeyBEaWZmQWxnb3JpdGhtTmFtZSwgSUVkaXRvcldvcmtlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2VkaXRvcldvcmtlci5qcyc7XG5pbXBvcnQgeyBJRG9jdW1lbnREaWZmUHJvdmlkZXJPcHRpb25zLCBJRG9jdW1lbnREaWZmIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9kaWZmL2RvY3VtZW50RGlmZlByb3ZpZGVyLmpzJztcbmltcG9ydCB7IGdldEVkaXRvclBhZGRpbmcgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2RpZmYvZGlmZkNlbGxFZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IEhlaWdodE9mSGlkZGVuTGluZXNSZWdpb25JbkRpZmZFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2RpZmYvZGlmZkVsZW1lbnRWaWV3TW9kZWwuanMnO1xuXG5zdWl0ZSgnTm90ZWJvb2tEaWZmIEVkaXRvckhlaWdodENhbGN1bGF0b3InLCAoKSA9PiB7XG5cdFsnSGlkZSBVbmNoYW5nZWQgUmVnaW9ucycsICdTaG93IFVuY2hhbmdlZCBSZWdpb25zJ10uZm9yRWFjaChzdWl0ZVRpdGxlID0+IHtcblx0XHRzdWl0ZShzdWl0ZVRpdGxlLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBmb250SW5mbzogRm9udEluZm8gPSB7IGxpbmVIZWlnaHQ6IDE4LCBmb250U2l6ZTogMTggfSBhcyBhbnk7XG5cdFx0XHRsZXQgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0XHRcdGxldCB0ZXh0TW9kZWxSZXNvbHZlcjogSVRleHRNb2RlbFNlcnZpY2U7XG5cdFx0XHRsZXQgZWRpdG9yV29ya2VyU2VydmljZTogSUVkaXRvcldvcmtlclNlcnZpY2U7XG5cdFx0XHRjb25zdCBvcmlnaW5hbDogVVJJID0gVVJJLnBhcnNlKCdvcmlnaW5hbCcpO1xuXHRcdFx0Y29uc3QgbW9kaWZpZWQ6IFVSSSA9IFVSSS5wYXJzZSgnbW9kaWZpZWQnKTtcblx0XHRcdGxldCBvcmlnaW5hbE1vZGVsOiBJVGV4dE1vZGVsO1xuXHRcdFx0bGV0IG1vZGlmaWVkTW9kZWw6IElUZXh0TW9kZWw7XG5cdFx0XHRjb25zdCBkaWZmQ29tcHV0ZXIgPSBuZXcgRGVmYXVsdExpbmVzRGlmZkNvbXB1dGVyKCk7XG5cdFx0XHRsZXQgY2FsY3VsYXRvcjogRGlmZkVkaXRvckhlaWdodENhbGN1bGF0b3JTZXJ2aWNlO1xuXHRcdFx0Y29uc3QgaGlkZVVuY2hhbmdlZFJlZ2lvbnMgPSBzdWl0ZVRpdGxlLnN0YXJ0c1dpdGgoJ0hpZGUnKTtcblx0XHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7XG5cdFx0XHRcdG5vdGVib29rOiB7IGRpZmY6IHsgaWdub3JlTWV0YWRhdGE6IHRydWUgfSB9LCBkaWZmRWRpdG9yOiB7XG5cdFx0XHRcdFx0aGlkZVVuY2hhbmdlZFJlZ2lvbnM6IHtcblx0XHRcdFx0XHRcdGVuYWJsZWQ6IGhpZGVVbmNoYW5nZWRSZWdpb25zLCBtaW5pbXVtTGluZUNvdW50OiAzLCBjb250ZXh0TGluZUNvdW50OiAzXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0ZnVuY3Rpb24gY3JlYXRlVGV4dE1vZGVsKGxpbmVzOiBzdHJpbmdbXSk6IElUZXh0TW9kZWwge1xuXHRcdFx0XHRyZXR1cm4gY3JlYXRlVGV4dE1vZGVsV2l0aFRleHQobGluZXMuam9pbignXFxuJykpO1xuXHRcdFx0fVxuXG5cdFx0XHR0ZWFyZG93bigoKSA9PiBkaXNwb3NhYmxlcy5kaXNwb3NlKCkpO1xuXHRcdFx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0XHRcdHNldHVwKCgpID0+IHtcblx0XHRcdFx0ZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRcdHRleHRNb2RlbFJlc29sdmVyID0gbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJVGV4dE1vZGVsU2VydmljZT4oKSB7XG5cdFx0XHRcdFx0b3ZlcnJpZGUgYXN5bmMgY3JlYXRlTW9kZWxSZWZlcmVuY2UocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SVJlZmVyZW5jZTxJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWw+PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRkaXNwb3NlOiAoKSA9PiB7IH0sXG5cdFx0XHRcdFx0XHRcdG9iamVjdDoge1xuXHRcdFx0XHRcdFx0XHRcdHRleHRFZGl0b3JNb2RlbDogcmVzb3VyY2UgPT09IG9yaWdpbmFsID8gb3JpZ2luYWxNb2RlbCA6IG1vZGlmaWVkTW9kZWwsXG5cdFx0XHRcdFx0XHRcdFx0Z2V0TGFuZ3VhZ2VJZDogKCkgPT4gJ2phdmFzY3JpcHQnLFxuXHRcdFx0XHRcdFx0XHR9IGFzIGFueVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHRcdGVkaXRvcldvcmtlclNlcnZpY2UgPSBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElFZGl0b3JXb3JrZXJTZXJ2aWNlPigpIHtcblx0XHRcdFx0XHRvdmVycmlkZSBhc3luYyBjb21wdXRlRGlmZihfb3JpZ2luYWw6IFVSSSwgX21vZGlmaWVkOiBVUkksIG9wdGlvbnM6IElEb2N1bWVudERpZmZQcm92aWRlck9wdGlvbnMsIF9hbGdvcml0aG06IERpZmZBbGdvcml0aG1OYW1lKTogUHJvbWlzZTxJRG9jdW1lbnREaWZmIHwgbnVsbD4ge1xuXHRcdFx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxMaW5lcyA9IG5ldyBBcnJheShvcmlnaW5hbE1vZGVsLmdldExpbmVDb3VudCgpKS5maWxsKDApLm1hcCgoXywgaSkgPT4gb3JpZ2luYWxNb2RlbC5nZXRMaW5lQ29udGVudChpICsgMSkpO1xuXHRcdFx0XHRcdFx0Y29uc3QgbW9kaWZpZWRMaW5lcyA9IG5ldyBBcnJheShtb2RpZmllZE1vZGVsLmdldExpbmVDb3VudCgpKS5maWxsKDApLm1hcCgoXywgaSkgPT4gbW9kaWZpZWRNb2RlbC5nZXRMaW5lQ29udGVudChpICsgMSkpO1xuXHRcdFx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gZGlmZkNvbXB1dGVyLmNvbXB1dGVEaWZmKG9yaWdpbmFsTGluZXMsIG1vZGlmaWVkTGluZXMsIG9wdGlvbnMpO1xuXHRcdFx0XHRcdFx0Y29uc3QgaWRlbnRpY2FsID0gb3JpZ2luYWxMaW5lcy5qb2luKCcnKSA9PT0gbW9kaWZpZWRMaW5lcy5qb2luKCcnKTtcblxuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0aWRlbnRpY2FsLFxuXHRcdFx0XHRcdFx0XHRxdWl0RWFybHk6IHJlc3VsdC5oaXRUaW1lb3V0LFxuXHRcdFx0XHRcdFx0XHRjaGFuZ2VzOiByZXN1bHQuY2hhbmdlcyxcblx0XHRcdFx0XHRcdFx0bW92ZXM6IHJlc3VsdC5tb3Zlcyxcblx0XHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHRcdGNhbGN1bGF0b3IgPSBuZXcgRGlmZkVkaXRvckhlaWdodENhbGN1bGF0b3JTZXJ2aWNlKGZvbnRJbmZvLmxpbmVIZWlnaHQsIHRleHRNb2RlbFJlc29sdmVyLCBlZGl0b3JXb3JrZXJTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnMSBvcmlnaW5hbCBsaW5lIHdpdGggY2hhbmdlIGluIHNhbWUgbGluZScsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0b3JpZ2luYWxNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXh0TW9kZWwoWydIZWxsbyBXb3JsZCddKSk7XG5cdFx0XHRcdG1vZGlmaWVkTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoY3JlYXRlVGV4dE1vZGVsKFsnRm9vIEJhciddKSk7XG5cblx0XHRcdFx0Y29uc3QgaGVpZ2h0ID0gYXdhaXQgY2FsY3VsYXRvci5kaWZmQW5kQ29tcHV0ZUhlaWdodChvcmlnaW5hbCwgbW9kaWZpZWQpO1xuXHRcdFx0XHRjb25zdCBleHBlY3RlZEhlaWdodCA9IGdldEV4cGVjdGVkSGVpZ2h0KDEsIDApO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWlnaHQsIGV4cGVjdGVkSGVpZ2h0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCcxIG9yaWdpbmFsIGxpbmUgd2l0aCBpbnNlcnRpb24gb2YgYSBuZXcgbGluZScsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0b3JpZ2luYWxNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXh0TW9kZWwoWydIZWxsbyBXb3JsZCddKSk7XG5cdFx0XHRcdG1vZGlmaWVkTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoY3JlYXRlVGV4dE1vZGVsKFsnSGVsbG8gV29ybGQnLCAnRm9vIEJhciddKSk7XG5cblx0XHRcdFx0Y29uc3QgaGVpZ2h0ID0gYXdhaXQgY2FsY3VsYXRvci5kaWZmQW5kQ29tcHV0ZUhlaWdodChvcmlnaW5hbCwgbW9kaWZpZWQpO1xuXHRcdFx0XHRjb25zdCBleHBlY3RlZEhlaWdodCA9IGdldEV4cGVjdGVkSGVpZ2h0KDIsIDApO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWlnaHQsIGV4cGVjdGVkSGVpZ2h0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCcxIGxpbmUgd2l0aCB1cGRhdGUgdG8gYSBsaW5lIGFuZCBpbnNlcnQgb2YgYSBuZXcgbGluZScsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0b3JpZ2luYWxNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXh0TW9kZWwoWydIZWxsbyBXb3JsZCddKSk7XG5cdFx0XHRcdG1vZGlmaWVkTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoY3JlYXRlVGV4dE1vZGVsKFsnRm9vIEJhcicsICdCYXIgQmF6J10pKTtcblxuXHRcdFx0XHRjb25zdCBoZWlnaHQgPSBhd2FpdCBjYWxjdWxhdG9yLmRpZmZBbmRDb21wdXRlSGVpZ2h0KG9yaWdpbmFsLCBtb2RpZmllZCk7XG5cdFx0XHRcdGNvbnN0IGV4cGVjdGVkSGVpZ2h0ID0gZ2V0RXhwZWN0ZWRIZWlnaHQoMiwgMCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlaWdodCwgZXhwZWN0ZWRIZWlnaHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJzEwIGxpbmUgd2l0aCB1cGRhdGUgdG8gYSBsaW5lIGFuZCBpbnNlcnQgb2YgYSBuZXcgbGluZScsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0b3JpZ2luYWxNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXh0TW9kZWwoY3JlYXRlTGluZXMoMTApKSk7XG5cdFx0XHRcdG1vZGlmaWVkTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoY3JlYXRlVGV4dE1vZGVsKGNyZWF0ZUxpbmVzKDEwKS5jb25jYXQoJ0ZvbyBCYXInKSkpO1xuXG5cdFx0XHRcdGNvbnN0IGhlaWdodCA9IGF3YWl0IGNhbGN1bGF0b3IuZGlmZkFuZENvbXB1dGVIZWlnaHQob3JpZ2luYWwsIG1vZGlmaWVkKTtcblx0XHRcdFx0Y29uc3QgZXhwZWN0ZWRIZWlnaHQgPSBnZXRFeHBlY3RlZEhlaWdodChoaWRlVW5jaGFuZ2VkUmVnaW9ucyA/IDQgOiAxMSwgaGlkZVVuY2hhbmdlZFJlZ2lvbnMgPyAxIDogMCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlaWdodCwgZXhwZWN0ZWRIZWlnaHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJzUwIGxpbmVzIHdpdGggdXBkYXRlcywgZGVsZXRpb25zIGFuZCBpbnNlcnRzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRvcmlnaW5hbE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZVRleHRNb2RlbChjcmVhdGVMaW5lcyg2MCkpKTtcblx0XHRcdFx0Y29uc3QgbW9kaWZpZWRMaW5lcyA9IGNyZWF0ZUxpbmVzKDYwKTtcblx0XHRcdFx0bW9kaWZpZWRMaW5lc1szXSA9ICdGb28gQmFyJztcblx0XHRcdFx0bW9kaWZpZWRMaW5lcy5zcGxpY2UoNywgMyk7XG5cdFx0XHRcdG1vZGlmaWVkTGluZXMuc3BsaWNlKDEwLCAwLCAnRm9vIEJhcjEnLCAnRm9vIEJhcjInLCAnRm9vIEJhcjMnKTtcblx0XHRcdFx0bW9kaWZpZWRMaW5lcy5zcGxpY2UoMzAsIDAsICcnLCAnJyk7XG5cdFx0XHRcdG1vZGlmaWVkTGluZXMuc3BsaWNlKDQwLCA0KTtcblx0XHRcdFx0bW9kaWZpZWRMaW5lcy5zcGxpY2UoNTAsIDAsICcxJywgJzInLCAnMycsICc0JywgJzUnKTtcblxuXHRcdFx0XHRtb2RpZmllZE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZVRleHRNb2RlbChtb2RpZmllZExpbmVzKSk7XG5cblx0XHRcdFx0Y29uc3QgaGVpZ2h0ID0gYXdhaXQgY2FsY3VsYXRvci5kaWZmQW5kQ29tcHV0ZUhlaWdodChvcmlnaW5hbCwgbW9kaWZpZWQpO1xuXHRcdFx0XHRjb25zdCBleHBlY3RlZEhlaWdodCA9IGdldEV4cGVjdGVkSGVpZ2h0KGhpZGVVbmNoYW5nZWRSZWdpb25zID8gNTAgOiA3MCwgaGlkZVVuY2hhbmdlZFJlZ2lvbnMgPyAzIDogMCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhlaWdodCwgZXhwZWN0ZWRIZWlnaHQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGZ1bmN0aW9uIGdldEV4cGVjdGVkSGVpZ2h0KHZpc2libGVMaW5lQ291bnQ6IG51bWJlciwgdW5jaGFuZ2VSZWdpb25zSGVpZ2h0OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdFx0XHRyZXR1cm4gKHZpc2libGVMaW5lQ291bnQgKiBmb250SW5mby5saW5lSGVpZ2h0KSArIGdldEVkaXRvclBhZGRpbmcodmlzaWJsZUxpbmVDb3VudCkudG9wICsgZ2V0RWRpdG9yUGFkZGluZyh2aXNpYmxlTGluZUNvdW50KS5ib3R0b20gKyAodW5jaGFuZ2VSZWdpb25zSGVpZ2h0ICogSGVpZ2h0T2ZIaWRkZW5MaW5lc1JlZ2lvbkluRGlmZkVkaXRvcik7XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIGNyZWF0ZUxpbmVzKGNvdW50OiBudW1iZXIsIGxpbmVQcmVmaXggPSAnSGVsbG8gV29ybGQnKTogc3RyaW5nW10ge1xuXHRcdFx0XHRyZXR1cm4gbmV3IEFycmF5KGNvdW50KS5maWxsKDApLm1hcCgoXywgaSkgPT4gYCR7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
