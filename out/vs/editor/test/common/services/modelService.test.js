import assert from "assert";
import { CharCode } from "../../../../base/common/charCode.js";
import * as platform from "../../../../base/common/platform.js";
import { URI } from "../../../../base/common/uri.js";
import { EditOperation } from "../../../common/core/editOperation.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { StringBuilder } from "../../../common/core/stringBuilder.js";
import { DefaultEndOfLine } from "../../../common/model.js";
import { createTextBuffer } from "../../../common/model/textModel.js";
import { ModelService } from "../../../common/services/modelService.js";
import { TestConfigurationService } from "../../../../platform/configuration/test/common/testConfigurationService.js";
import { createModelServices, createTextModel } from "../testTextModel.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { IModelService } from "../../../common/services/model.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
const GENERATE_TESTS = false;
suite("ModelService", () => {
  let disposables;
  let modelService;
  let instantiationService;
  setup(() => {
    disposables = new DisposableStore();
    const configService = new TestConfigurationService();
    configService.setUserConfiguration("files", { "eol": "\n" });
    configService.setUserConfiguration("files", { "eol": "\r\n" }, URI.file(platform.isWindows ? "c:\\myroot" : "/myroot"));
    instantiationService = createModelServices(disposables, [
      [IConfigurationService, configService]
    ]);
    modelService = instantiationService.get(IModelService);
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("EOL setting respected depending on root", () => {
    const model1 = modelService.createModel("farboo", null);
    const model2 = modelService.createModel("farboo", null, URI.file(platform.isWindows ? "c:\\myroot\\myfile.txt" : "/myroot/myfile.txt"));
    const model3 = modelService.createModel("farboo", null, URI.file(platform.isWindows ? "c:\\other\\myfile.txt" : "/other/myfile.txt"));
    assert.strictEqual(model1.getOptions().defaultEOL, DefaultEndOfLine.LF);
    assert.strictEqual(model2.getOptions().defaultEOL, DefaultEndOfLine.CRLF);
    assert.strictEqual(model3.getOptions().defaultEOL, DefaultEndOfLine.LF);
    model1.dispose();
    model2.dispose();
    model3.dispose();
  });
  test("_computeEdits no change", function() {
    const model = disposables.add(createTextModel(
      [
        "This is line one",
        //16
        "and this is line number two",
        //27
        "it is followed by #3",
        //20
        "and finished with the fourth."
        //29
      ].join("\n")
    ));
    const textBuffer = createAndRegisterTextBuffer(
      disposables,
      [
        "This is line one",
        //16
        "and this is line number two",
        //27
        "it is followed by #3",
        //20
        "and finished with the fourth."
        //29
      ].join("\n"),
      DefaultEndOfLine.LF
    );
    const actual = ModelService._computeEdits(model, textBuffer);
    assert.deepStrictEqual(actual, []);
  });
  test("_computeEdits first line changed", function() {
    const model = disposables.add(createTextModel(
      [
        "This is line one",
        //16
        "and this is line number two",
        //27
        "it is followed by #3",
        //20
        "and finished with the fourth."
        //29
      ].join("\n")
    ));
    const textBuffer = createAndRegisterTextBuffer(
      disposables,
      [
        "This is line One",
        //16
        "and this is line number two",
        //27
        "it is followed by #3",
        //20
        "and finished with the fourth."
        //29
      ].join("\n"),
      DefaultEndOfLine.LF
    );
    const actual = ModelService._computeEdits(model, textBuffer);
    assert.deepStrictEqual(actual, [
      EditOperation.replaceMove(new Range(1, 1, 2, 1), "This is line One\n")
    ]);
  });
  test("_computeEdits EOL changed", function() {
    const model = disposables.add(createTextModel(
      [
        "This is line one",
        //16
        "and this is line number two",
        //27
        "it is followed by #3",
        //20
        "and finished with the fourth."
        //29
      ].join("\n")
    ));
    const textBuffer = createAndRegisterTextBuffer(
      disposables,
      [
        "This is line one",
        //16
        "and this is line number two",
        //27
        "it is followed by #3",
        //20
        "and finished with the fourth."
        //29
      ].join("\r\n"),
      DefaultEndOfLine.LF
    );
    const actual = ModelService._computeEdits(model, textBuffer);
    assert.deepStrictEqual(actual, []);
  });
  test("_computeEdits EOL and other change 1", function() {
    const model = disposables.add(createTextModel(
      [
        "This is line one",
        //16
        "and this is line number two",
        //27
        "it is followed by #3",
        //20
        "and finished with the fourth."
        //29
      ].join("\n")
    ));
    const textBuffer = createAndRegisterTextBuffer(
      disposables,
      [
        "This is line One",
        //16
        "and this is line number two",
        //27
        "It is followed by #3",
        //20
        "and finished with the fourth."
        //29
      ].join("\r\n"),
      DefaultEndOfLine.LF
    );
    const actual = ModelService._computeEdits(model, textBuffer);
    assert.deepStrictEqual(actual, [
      EditOperation.replaceMove(
        new Range(1, 1, 4, 1),
        [
          "This is line One",
          "and this is line number two",
          "It is followed by #3",
          ""
        ].join("\r\n")
      )
    ]);
  });
  test("_computeEdits EOL and other change 2", function() {
    const model = disposables.add(createTextModel(
      [
        "package main",
        // 1
        "func foo() {",
        // 2
        "}"
        // 3
      ].join("\n")
    ));
    const textBuffer = createAndRegisterTextBuffer(
      disposables,
      [
        "package main",
        // 1
        "func foo() {",
        // 2
        "}",
        // 3
        ""
      ].join("\r\n"),
      DefaultEndOfLine.LF
    );
    const actual = ModelService._computeEdits(model, textBuffer);
    assert.deepStrictEqual(actual, [
      EditOperation.replaceMove(new Range(3, 2, 3, 2), "\r\n")
    ]);
  });
  test("generated1", () => {
    const file1 = ["pram", "okctibad", "pjuwtemued", "knnnm", "u", ""];
    const file2 = ["tcnr", "rxwlicro", "vnzy", "", "", "pjzcogzur", "ptmxyp", "dfyshia", "pee", "ygg"];
    assertComputeEdits(file1, file2);
  });
  test("generated2", () => {
    const file1 = ["", "itls", "hrilyhesv", ""];
    const file2 = ["vdl", "", "tchgz", "bhx", "nyl"];
    assertComputeEdits(file1, file2);
  });
  test("generated3", () => {
    const file1 = ["ubrbrcv", "wv", "xodspybszt", "s", "wednjxm", "fklajt", "fyfc", "lvejgge", "rtpjlodmmk", "arivtgmjdm"];
    const file2 = ["s", "qj", "tu", "ur", "qerhjjhyvx", "t"];
    assertComputeEdits(file1, file2);
  });
  test("generated4", () => {
    const file1 = ["ig", "kh", "hxegci", "smvker", "pkdmjjdqnv", "vgkkqqx", "", "jrzeb"];
    const file2 = ["yk", ""];
    assertComputeEdits(file1, file2);
  });
  test("does insertions in the middle of the document", () => {
    const file1 = [
      "line 1",
      "line 2",
      "line 3"
    ];
    const file2 = [
      "line 1",
      "line 2",
      "line 5",
      "line 3"
    ];
    assertComputeEdits(file1, file2);
  });
  test("does insertions at the end of the document", () => {
    const file1 = [
      "line 1",
      "line 2",
      "line 3"
    ];
    const file2 = [
      "line 1",
      "line 2",
      "line 3",
      "line 4"
    ];
    assertComputeEdits(file1, file2);
  });
  test("does insertions at the beginning of the document", () => {
    const file1 = [
      "line 1",
      "line 2",
      "line 3"
    ];
    const file2 = [
      "line 0",
      "line 1",
      "line 2",
      "line 3"
    ];
    assertComputeEdits(file1, file2);
  });
  test("does replacements", () => {
    const file1 = [
      "line 1",
      "line 2",
      "line 3"
    ];
    const file2 = [
      "line 1",
      "line 7",
      "line 3"
    ];
    assertComputeEdits(file1, file2);
  });
  test("does deletions", () => {
    const file1 = [
      "line 1",
      "line 2",
      "line 3"
    ];
    const file2 = [
      "line 1",
      "line 3"
    ];
    assertComputeEdits(file1, file2);
  });
  test("does insert, replace, and delete", () => {
    const file1 = [
      "line 1",
      "line 2",
      "line 3",
      "line 4",
      "line 5"
    ];
    const file2 = [
      "line 0",
      // insert line 0
      "line 1",
      "replace line 2",
      // replace line 2
      "line 3",
      // delete line 4
      "line 5"
    ];
    assertComputeEdits(file1, file2);
  });
  test("maintains undo for same resource and same content", () => {
    const resource = URI.parse("file://test.txt");
    const model1 = modelService.createModel("text", null, resource);
    model1.pushEditOperations(null, [{ range: new Range(1, 5, 1, 5), text: "1" }], () => [new Selection(1, 5, 1, 5)]);
    assert.strictEqual(model1.getValue(), "text1");
    modelService.destroyModel(resource);
    const model2 = modelService.createModel("text1", null, resource);
    model2.undo();
    assert.strictEqual(model2.getValue(), "text");
    modelService.destroyModel(resource);
  });
  test("maintains version id and alternative version id for same resource and same content", () => {
    const resource = URI.parse("file://test.txt");
    const model1 = modelService.createModel("text", null, resource);
    model1.pushEditOperations(null, [{ range: new Range(1, 5, 1, 5), text: "1" }], () => [new Selection(1, 5, 1, 5)]);
    assert.strictEqual(model1.getValue(), "text1");
    const versionId = model1.getVersionId();
    const alternativeVersionId = model1.getAlternativeVersionId();
    modelService.destroyModel(resource);
    const model2 = modelService.createModel("text1", null, resource);
    assert.strictEqual(model2.getVersionId(), versionId);
    assert.strictEqual(model2.getAlternativeVersionId(), alternativeVersionId);
    modelService.destroyModel(resource);
  });
  test("does not maintain undo for same resource and different content", () => {
    const resource = URI.parse("file://test.txt");
    const model1 = modelService.createModel("text", null, resource);
    model1.pushEditOperations(null, [{ range: new Range(1, 5, 1, 5), text: "1" }], () => [new Selection(1, 5, 1, 5)]);
    assert.strictEqual(model1.getValue(), "text1");
    modelService.destroyModel(resource);
    const model2 = modelService.createModel("text2", null, resource);
    model2.undo();
    assert.strictEqual(model2.getValue(), "text2");
    modelService.destroyModel(resource);
  });
  test("setValue should clear undo stack", () => {
    const resource = URI.parse("file://test.txt");
    const model = modelService.createModel("text", null, resource);
    model.pushEditOperations(null, [{ range: new Range(1, 5, 1, 5), text: "1" }], () => [new Selection(1, 5, 1, 5)]);
    assert.strictEqual(model.getValue(), "text1");
    model.setValue("text2");
    model.undo();
    assert.strictEqual(model.getValue(), "text2");
    modelService.destroyModel(resource);
  });
});
function assertComputeEdits(lines1, lines2) {
  const model = createTextModel(lines1.join("\n"));
  const { disposable, textBuffer } = createTextBuffer(lines2.join("\n"), DefaultEndOfLine.LF);
  const edits = ModelService._computeEdits(model, textBuffer);
  model.pushEditOperations([], edits, null);
  assert.strictEqual(model.getValue(), lines2.join("\n"));
  disposable.dispose();
  model.dispose();
}
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function getRandomString(minLength, maxLength) {
  const length = getRandomInt(minLength, maxLength);
  const t = new StringBuilder(length);
  for (let i = 0; i < length; i++) {
    t.appendASCIICharCode(getRandomInt(CharCode.a, CharCode.z));
  }
  return t.build();
}
function generateFile(small) {
  const lineCount = getRandomInt(1, small ? 3 : 1e4);
  const lines = [];
  for (let i = 0; i < lineCount; i++) {
    lines.push(getRandomString(0, small ? 3 : 1e4));
  }
  return lines;
}
if (GENERATE_TESTS) {
  let number = 1;
  while (true) {
    console.log("------TEST: " + number++);
    const file1 = generateFile(true);
    const file2 = generateFile(true);
    console.log("------TEST GENERATED");
    try {
      assertComputeEdits(file1, file2);
    } catch (err) {
      console.log(err);
      console.log(`
const file1 = ${JSON.stringify(file1).replace(/"/g, "'")};
const file2 = ${JSON.stringify(file2).replace(/"/g, "'")};
assertComputeEdits(file1, file2);
`);
      break;
    }
  }
}
function createAndRegisterTextBuffer(store, value, defaultEOL) {
  const { disposable, textBuffer } = createTextBuffer(value, defaultEOL);
  store.add(disposable);
  return textBuffer;
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vc2VydmljZXMvbW9kZWxTZXJ2aWNlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBDaGFyQ29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NoYXJDb2RlLmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvZWRpdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBTdHJpbmdCdWlsZGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvc3RyaW5nQnVpbGRlci5qcyc7XG5pbXBvcnQgeyBEZWZhdWx0RW5kT2ZMaW5lLCBJVGV4dEJ1ZmZlciwgSVRleHRCdWZmZXJGYWN0b3J5LCBJVGV4dFNuYXBzaG90IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRleHRCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgY3JlYXRlTW9kZWxTZXJ2aWNlcywgY3JlYXRlVGV4dE1vZGVsIH0gZnJvbSAnLi4vdGVzdFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5jb25zdCBHRU5FUkFURV9URVNUUyA9IGZhbHNlO1xuXG5zdWl0ZSgnTW9kZWxTZXJ2aWNlJywgKCkgPT4ge1xuXHRsZXQgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0bGV0IG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZTtcblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Y29uc3QgY29uZmlnU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKTtcblx0XHRjb25maWdTZXJ2aWNlLnNldFVzZXJDb25maWd1cmF0aW9uKCdmaWxlcycsIHsgJ2VvbCc6ICdcXG4nIH0pO1xuXHRcdGNvbmZpZ1NlcnZpY2Uuc2V0VXNlckNvbmZpZ3VyYXRpb24oJ2ZpbGVzJywgeyAnZW9sJzogJ1xcclxcbicgfSwgVVJJLmZpbGUocGxhdGZvcm0uaXNXaW5kb3dzID8gJ2M6XFxcXG15cm9vdCcgOiAnL215cm9vdCcpKTtcblxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gY3JlYXRlTW9kZWxTZXJ2aWNlcyhkaXNwb3NhYmxlcywgW1xuXHRcdFx0W0lDb25maWd1cmF0aW9uU2VydmljZSwgY29uZmlnU2VydmljZV1cblx0XHRdKTtcblx0XHRtb2RlbFNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSU1vZGVsU2VydmljZSk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ0VPTCBzZXR0aW5nIHJlc3BlY3RlZCBkZXBlbmRpbmcgb24gcm9vdCcsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbDEgPSBtb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoJ2ZhcmJvbycsIG51bGwpO1xuXHRcdGNvbnN0IG1vZGVsMiA9IG1vZGVsU2VydmljZS5jcmVhdGVNb2RlbCgnZmFyYm9vJywgbnVsbCwgVVJJLmZpbGUocGxhdGZvcm0uaXNXaW5kb3dzID8gJ2M6XFxcXG15cm9vdFxcXFxteWZpbGUudHh0JyA6ICcvbXlyb290L215ZmlsZS50eHQnKSk7XG5cdFx0Y29uc3QgbW9kZWwzID0gbW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKCdmYXJib28nLCBudWxsLCBVUkkuZmlsZShwbGF0Zm9ybS5pc1dpbmRvd3MgPyAnYzpcXFxcb3RoZXJcXFxcbXlmaWxlLnR4dCcgOiAnL290aGVyL215ZmlsZS50eHQnKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwxLmdldE9wdGlvbnMoKS5kZWZhdWx0RU9MLCBEZWZhdWx0RW5kT2ZMaW5lLkxGKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwyLmdldE9wdGlvbnMoKS5kZWZhdWx0RU9MLCBEZWZhdWx0RW5kT2ZMaW5lLkNSTEYpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbDMuZ2V0T3B0aW9ucygpLmRlZmF1bHRFT0wsIERlZmF1bHRFbmRPZkxpbmUuTEYpO1xuXG5cdFx0bW9kZWwxLmRpc3Bvc2UoKTtcblx0XHRtb2RlbDIuZGlzcG9zZSgpO1xuXHRcdG1vZGVsMy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ19jb21wdXRlRWRpdHMgbm8gY2hhbmdlJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnVGhpcyBpcyBsaW5lIG9uZScsIC8vMTZcblx0XHRcdFx0J2FuZCB0aGlzIGlzIGxpbmUgbnVtYmVyIHR3bycsIC8vMjdcblx0XHRcdFx0J2l0IGlzIGZvbGxvd2VkIGJ5ICMzJywgLy8yMFxuXHRcdFx0XHQnYW5kIGZpbmlzaGVkIHdpdGggdGhlIGZvdXJ0aC4nLCAvLzI5XG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KSk7XG5cblx0XHRjb25zdCB0ZXh0QnVmZmVyID0gY3JlYXRlQW5kUmVnaXN0ZXJUZXh0QnVmZmVyKFxuXHRcdFx0ZGlzcG9zYWJsZXMsXG5cdFx0XHRbXG5cdFx0XHRcdCdUaGlzIGlzIGxpbmUgb25lJywgLy8xNlxuXHRcdFx0XHQnYW5kIHRoaXMgaXMgbGluZSBudW1iZXIgdHdvJywgLy8yN1xuXHRcdFx0XHQnaXQgaXMgZm9sbG93ZWQgYnkgIzMnLCAvLzIwXG5cdFx0XHRcdCdhbmQgZmluaXNoZWQgd2l0aCB0aGUgZm91cnRoLicsIC8vMjlcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHREZWZhdWx0RW5kT2ZMaW5lLkxGXG5cdFx0KTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IE1vZGVsU2VydmljZS5fY29tcHV0ZUVkaXRzKG1vZGVsLCB0ZXh0QnVmZmVyKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ19jb21wdXRlRWRpdHMgZmlyc3QgbGluZSBjaGFuZ2VkJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnVGhpcyBpcyBsaW5lIG9uZScsIC8vMTZcblx0XHRcdFx0J2FuZCB0aGlzIGlzIGxpbmUgbnVtYmVyIHR3bycsIC8vMjdcblx0XHRcdFx0J2l0IGlzIGZvbGxvd2VkIGJ5ICMzJywgLy8yMFxuXHRcdFx0XHQnYW5kIGZpbmlzaGVkIHdpdGggdGhlIGZvdXJ0aC4nLCAvLzI5XG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KSk7XG5cblx0XHRjb25zdCB0ZXh0QnVmZmVyID0gY3JlYXRlQW5kUmVnaXN0ZXJUZXh0QnVmZmVyKFxuXHRcdFx0ZGlzcG9zYWJsZXMsXG5cdFx0XHRbXG5cdFx0XHRcdCdUaGlzIGlzIGxpbmUgT25lJywgLy8xNlxuXHRcdFx0XHQnYW5kIHRoaXMgaXMgbGluZSBudW1iZXIgdHdvJywgLy8yN1xuXHRcdFx0XHQnaXQgaXMgZm9sbG93ZWQgYnkgIzMnLCAvLzIwXG5cdFx0XHRcdCdhbmQgZmluaXNoZWQgd2l0aCB0aGUgZm91cnRoLicsIC8vMjlcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHREZWZhdWx0RW5kT2ZMaW5lLkxGXG5cdFx0KTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IE1vZGVsU2VydmljZS5fY29tcHV0ZUVkaXRzKG1vZGVsLCB0ZXh0QnVmZmVyKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBbXG5cdFx0XHRFZGl0T3BlcmF0aW9uLnJlcGxhY2VNb3ZlKG5ldyBSYW5nZSgxLCAxLCAyLCAxKSwgJ1RoaXMgaXMgbGluZSBPbmVcXG4nKVxuXHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdfY29tcHV0ZUVkaXRzIEVPTCBjaGFuZ2VkJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnVGhpcyBpcyBsaW5lIG9uZScsIC8vMTZcblx0XHRcdFx0J2FuZCB0aGlzIGlzIGxpbmUgbnVtYmVyIHR3bycsIC8vMjdcblx0XHRcdFx0J2l0IGlzIGZvbGxvd2VkIGJ5ICMzJywgLy8yMFxuXHRcdFx0XHQnYW5kIGZpbmlzaGVkIHdpdGggdGhlIGZvdXJ0aC4nLCAvLzI5XG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KSk7XG5cblx0XHRjb25zdCB0ZXh0QnVmZmVyID0gY3JlYXRlQW5kUmVnaXN0ZXJUZXh0QnVmZmVyKFxuXHRcdFx0ZGlzcG9zYWJsZXMsXG5cdFx0XHRbXG5cdFx0XHRcdCdUaGlzIGlzIGxpbmUgb25lJywgLy8xNlxuXHRcdFx0XHQnYW5kIHRoaXMgaXMgbGluZSBudW1iZXIgdHdvJywgLy8yN1xuXHRcdFx0XHQnaXQgaXMgZm9sbG93ZWQgYnkgIzMnLCAvLzIwXG5cdFx0XHRcdCdhbmQgZmluaXNoZWQgd2l0aCB0aGUgZm91cnRoLicsIC8vMjlcblx0XHRcdF0uam9pbignXFxyXFxuJyksXG5cdFx0XHREZWZhdWx0RW5kT2ZMaW5lLkxGXG5cdFx0KTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IE1vZGVsU2VydmljZS5fY29tcHV0ZUVkaXRzKG1vZGVsLCB0ZXh0QnVmZmVyKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ19jb21wdXRlRWRpdHMgRU9MIGFuZCBvdGhlciBjaGFuZ2UgMScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0J1RoaXMgaXMgbGluZSBvbmUnLCAvLzE2XG5cdFx0XHRcdCdhbmQgdGhpcyBpcyBsaW5lIG51bWJlciB0d28nLCAvLzI3XG5cdFx0XHRcdCdpdCBpcyBmb2xsb3dlZCBieSAjMycsIC8vMjBcblx0XHRcdFx0J2FuZCBmaW5pc2hlZCB3aXRoIHRoZSBmb3VydGguJywgLy8yOVxuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdCkpO1xuXG5cdFx0Y29uc3QgdGV4dEJ1ZmZlciA9IGNyZWF0ZUFuZFJlZ2lzdGVyVGV4dEJ1ZmZlcihcblx0XHRcdGRpc3Bvc2FibGVzLFxuXHRcdFx0W1xuXHRcdFx0XHQnVGhpcyBpcyBsaW5lIE9uZScsIC8vMTZcblx0XHRcdFx0J2FuZCB0aGlzIGlzIGxpbmUgbnVtYmVyIHR3bycsIC8vMjdcblx0XHRcdFx0J0l0IGlzIGZvbGxvd2VkIGJ5ICMzJywgLy8yMFxuXHRcdFx0XHQnYW5kIGZpbmlzaGVkIHdpdGggdGhlIGZvdXJ0aC4nLCAvLzI5XG5cdFx0XHRdLmpvaW4oJ1xcclxcbicpLFxuXHRcdFx0RGVmYXVsdEVuZE9mTGluZS5MRlxuXHRcdCk7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBNb2RlbFNlcnZpY2UuX2NvbXB1dGVFZGl0cyhtb2RlbCwgdGV4dEJ1ZmZlcik7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgW1xuXHRcdFx0RWRpdE9wZXJhdGlvbi5yZXBsYWNlTW92ZShcblx0XHRcdFx0bmV3IFJhbmdlKDEsIDEsIDQsIDEpLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0J1RoaXMgaXMgbGluZSBPbmUnLFxuXHRcdFx0XHRcdCdhbmQgdGhpcyBpcyBsaW5lIG51bWJlciB0d28nLFxuXHRcdFx0XHRcdCdJdCBpcyBmb2xsb3dlZCBieSAjMycsXG5cdFx0XHRcdFx0Jydcblx0XHRcdFx0XS5qb2luKCdcXHJcXG4nKVxuXHRcdFx0KVxuXHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdfY29tcHV0ZUVkaXRzIEVPTCBhbmQgb3RoZXIgY2hhbmdlIDInLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRbXG5cdFx0XHRcdCdwYWNrYWdlIG1haW4nLFx0Ly8gMVxuXHRcdFx0XHQnZnVuYyBmb28oKSB7JyxcdC8vIDJcblx0XHRcdFx0J30nXHRcdFx0XHQvLyAzXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0KSk7XG5cblx0XHRjb25zdCB0ZXh0QnVmZmVyID0gY3JlYXRlQW5kUmVnaXN0ZXJUZXh0QnVmZmVyKFxuXHRcdFx0ZGlzcG9zYWJsZXMsXG5cdFx0XHRbXG5cdFx0XHRcdCdwYWNrYWdlIG1haW4nLFx0Ly8gMVxuXHRcdFx0XHQnZnVuYyBmb28oKSB7JyxcdC8vIDJcblx0XHRcdFx0J30nLFx0XHRcdC8vIDNcblx0XHRcdFx0Jydcblx0XHRcdF0uam9pbignXFxyXFxuJyksXG5cdFx0XHREZWZhdWx0RW5kT2ZMaW5lLkxGXG5cdFx0KTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IE1vZGVsU2VydmljZS5fY29tcHV0ZUVkaXRzKG1vZGVsLCB0ZXh0QnVmZmVyKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBbXG5cdFx0XHRFZGl0T3BlcmF0aW9uLnJlcGxhY2VNb3ZlKG5ldyBSYW5nZSgzLCAyLCAzLCAyKSwgJ1xcclxcbicpXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dlbmVyYXRlZDEnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmlsZTEgPSBbJ3ByYW0nLCAnb2tjdGliYWQnLCAncGp1d3RlbXVlZCcsICdrbm5ubScsICd1JywgJyddO1xuXHRcdGNvbnN0IGZpbGUyID0gWyd0Y25yJywgJ3J4d2xpY3JvJywgJ3ZuenknLCAnJywgJycsICdwanpjb2d6dXInLCAncHRteHlwJywgJ2RmeXNoaWEnLCAncGVlJywgJ3lnZyddO1xuXHRcdGFzc2VydENvbXB1dGVFZGl0cyhmaWxlMSwgZmlsZTIpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZW5lcmF0ZWQyJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZpbGUxID0gWycnLCAnaXRscycsICdocmlseWhlc3YnLCAnJ107XG5cdFx0Y29uc3QgZmlsZTIgPSBbJ3ZkbCcsICcnLCAndGNoZ3onLCAnYmh4JywgJ255bCddO1xuXHRcdGFzc2VydENvbXB1dGVFZGl0cyhmaWxlMSwgZmlsZTIpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZW5lcmF0ZWQzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZpbGUxID0gWyd1YnJicmN2JywgJ3d2JywgJ3hvZHNweWJzenQnLCAncycsICd3ZWRuanhtJywgJ2ZrbGFqdCcsICdmeWZjJywgJ2x2ZWpnZ2UnLCAncnRwamxvZG1taycsICdhcml2dGdtamRtJ107XG5cdFx0Y29uc3QgZmlsZTIgPSBbJ3MnLCAncWonLCAndHUnLCAndXInLCAncWVyaGpqaHl2eCcsICd0J107XG5cdFx0YXNzZXJ0Q29tcHV0ZUVkaXRzKGZpbGUxLCBmaWxlMik7XG5cdH0pO1xuXG5cdHRlc3QoJ2dlbmVyYXRlZDQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmlsZTEgPSBbJ2lnJywgJ2toJywgJ2h4ZWdjaScsICdzbXZrZXInLCAncGtkbWpqZHFudicsICd2Z2trcXF4JywgJycsICdqcnplYiddO1xuXHRcdGNvbnN0IGZpbGUyID0gWyd5aycsICcnXTtcblx0XHRhc3NlcnRDb21wdXRlRWRpdHMoZmlsZTEsIGZpbGUyKTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBpbnNlcnRpb25zIGluIHRoZSBtaWRkbGUgb2YgdGhlIGRvY3VtZW50JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZpbGUxID0gW1xuXHRcdFx0J2xpbmUgMScsXG5cdFx0XHQnbGluZSAyJyxcblx0XHRcdCdsaW5lIDMnXG5cdFx0XTtcblx0XHRjb25zdCBmaWxlMiA9IFtcblx0XHRcdCdsaW5lIDEnLFxuXHRcdFx0J2xpbmUgMicsXG5cdFx0XHQnbGluZSA1Jyxcblx0XHRcdCdsaW5lIDMnXG5cdFx0XTtcblx0XHRhc3NlcnRDb21wdXRlRWRpdHMoZmlsZTEsIGZpbGUyKTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBpbnNlcnRpb25zIGF0IHRoZSBlbmQgb2YgdGhlIGRvY3VtZW50JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZpbGUxID0gW1xuXHRcdFx0J2xpbmUgMScsXG5cdFx0XHQnbGluZSAyJyxcblx0XHRcdCdsaW5lIDMnXG5cdFx0XTtcblx0XHRjb25zdCBmaWxlMiA9IFtcblx0XHRcdCdsaW5lIDEnLFxuXHRcdFx0J2xpbmUgMicsXG5cdFx0XHQnbGluZSAzJyxcblx0XHRcdCdsaW5lIDQnXG5cdFx0XTtcblx0XHRhc3NlcnRDb21wdXRlRWRpdHMoZmlsZTEsIGZpbGUyKTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBpbnNlcnRpb25zIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGRvY3VtZW50JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZpbGUxID0gW1xuXHRcdFx0J2xpbmUgMScsXG5cdFx0XHQnbGluZSAyJyxcblx0XHRcdCdsaW5lIDMnXG5cdFx0XTtcblx0XHRjb25zdCBmaWxlMiA9IFtcblx0XHRcdCdsaW5lIDAnLFxuXHRcdFx0J2xpbmUgMScsXG5cdFx0XHQnbGluZSAyJyxcblx0XHRcdCdsaW5lIDMnXG5cdFx0XTtcblx0XHRhc3NlcnRDb21wdXRlRWRpdHMoZmlsZTEsIGZpbGUyKTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyByZXBsYWNlbWVudHMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmlsZTEgPSBbXG5cdFx0XHQnbGluZSAxJyxcblx0XHRcdCdsaW5lIDInLFxuXHRcdFx0J2xpbmUgMydcblx0XHRdO1xuXHRcdGNvbnN0IGZpbGUyID0gW1xuXHRcdFx0J2xpbmUgMScsXG5cdFx0XHQnbGluZSA3Jyxcblx0XHRcdCdsaW5lIDMnXG5cdFx0XTtcblx0XHRhc3NlcnRDb21wdXRlRWRpdHMoZmlsZTEsIGZpbGUyKTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBkZWxldGlvbnMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmlsZTEgPSBbXG5cdFx0XHQnbGluZSAxJyxcblx0XHRcdCdsaW5lIDInLFxuXHRcdFx0J2xpbmUgMydcblx0XHRdO1xuXHRcdGNvbnN0IGZpbGUyID0gW1xuXHRcdFx0J2xpbmUgMScsXG5cdFx0XHQnbGluZSAzJ1xuXHRcdF07XG5cdFx0YXNzZXJ0Q29tcHV0ZUVkaXRzKGZpbGUxLCBmaWxlMik7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgaW5zZXJ0LCByZXBsYWNlLCBhbmQgZGVsZXRlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZpbGUxID0gW1xuXHRcdFx0J2xpbmUgMScsXG5cdFx0XHQnbGluZSAyJyxcblx0XHRcdCdsaW5lIDMnLFxuXHRcdFx0J2xpbmUgNCcsXG5cdFx0XHQnbGluZSA1Jyxcblx0XHRdO1xuXHRcdGNvbnN0IGZpbGUyID0gW1xuXHRcdFx0J2xpbmUgMCcsIC8vIGluc2VydCBsaW5lIDBcblx0XHRcdCdsaW5lIDEnLFxuXHRcdFx0J3JlcGxhY2UgbGluZSAyJywgLy8gcmVwbGFjZSBsaW5lIDJcblx0XHRcdCdsaW5lIDMnLFxuXHRcdFx0Ly8gZGVsZXRlIGxpbmUgNFxuXHRcdFx0J2xpbmUgNScsXG5cdFx0XTtcblx0XHRhc3NlcnRDb21wdXRlRWRpdHMoZmlsZTEsIGZpbGUyKTtcblx0fSk7XG5cblx0dGVzdCgnbWFpbnRhaW5zIHVuZG8gZm9yIHNhbWUgcmVzb3VyY2UgYW5kIHNhbWUgY29udGVudCcsICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5wYXJzZSgnZmlsZTovL3Rlc3QudHh0Jyk7XG5cblx0XHQvLyBjcmVhdGUgYSBtb2RlbFxuXHRcdGNvbnN0IG1vZGVsMSA9IG1vZGVsU2VydmljZS5jcmVhdGVNb2RlbCgndGV4dCcsIG51bGwsIHJlc291cmNlKTtcblx0XHQvLyBtYWtlIGFuIGVkaXRcblx0XHRtb2RlbDEucHVzaEVkaXRPcGVyYXRpb25zKG51bGwsIFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgNSwgMSwgNSksIHRleHQ6ICcxJyB9XSwgKCkgPT4gW25ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNSldKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwxLmdldFZhbHVlKCksICd0ZXh0MScpO1xuXHRcdC8vIGRpc3Bvc2UgaXRcblx0XHRtb2RlbFNlcnZpY2UuZGVzdHJveU1vZGVsKHJlc291cmNlKTtcblxuXHRcdC8vIGNyZWF0ZSBhIG5ldyBtb2RlbCB3aXRoIHRoZSBzYW1lIGNvbnRlbnRcblx0XHRjb25zdCBtb2RlbDIgPSBtb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoJ3RleHQxJywgbnVsbCwgcmVzb3VyY2UpO1xuXHRcdC8vIHVuZG9cblx0XHRtb2RlbDIudW5kbygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbDIuZ2V0VmFsdWUoKSwgJ3RleHQnKTtcblx0XHQvLyBkaXNwb3NlIGl0XG5cdFx0bW9kZWxTZXJ2aWNlLmRlc3Ryb3lNb2RlbChyZXNvdXJjZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21haW50YWlucyB2ZXJzaW9uIGlkIGFuZCBhbHRlcm5hdGl2ZSB2ZXJzaW9uIGlkIGZvciBzYW1lIHJlc291cmNlIGFuZCBzYW1lIGNvbnRlbnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkucGFyc2UoJ2ZpbGU6Ly90ZXN0LnR4dCcpO1xuXG5cdFx0Ly8gY3JlYXRlIGEgbW9kZWxcblx0XHRjb25zdCBtb2RlbDEgPSBtb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoJ3RleHQnLCBudWxsLCByZXNvdXJjZSk7XG5cdFx0Ly8gbWFrZSBhbiBlZGl0XG5cdFx0bW9kZWwxLnB1c2hFZGl0T3BlcmF0aW9ucyhudWxsLCBbeyByYW5nZTogbmV3IFJhbmdlKDEsIDUsIDEsIDUpLCB0ZXh0OiAnMScgfV0sICgpID0+IFtuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsMS5nZXRWYWx1ZSgpLCAndGV4dDEnKTtcblx0XHRjb25zdCB2ZXJzaW9uSWQgPSBtb2RlbDEuZ2V0VmVyc2lvbklkKCk7XG5cdFx0Y29uc3QgYWx0ZXJuYXRpdmVWZXJzaW9uSWQgPSBtb2RlbDEuZ2V0QWx0ZXJuYXRpdmVWZXJzaW9uSWQoKTtcblx0XHQvLyBkaXNwb3NlIGl0XG5cdFx0bW9kZWxTZXJ2aWNlLmRlc3Ryb3lNb2RlbChyZXNvdXJjZSk7XG5cblx0XHQvLyBjcmVhdGUgYSBuZXcgbW9kZWwgd2l0aCB0aGUgc2FtZSBjb250ZW50XG5cdFx0Y29uc3QgbW9kZWwyID0gbW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKCd0ZXh0MScsIG51bGwsIHJlc291cmNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwyLmdldFZlcnNpb25JZCgpLCB2ZXJzaW9uSWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbDIuZ2V0QWx0ZXJuYXRpdmVWZXJzaW9uSWQoKSwgYWx0ZXJuYXRpdmVWZXJzaW9uSWQpO1xuXHRcdC8vIGRpc3Bvc2UgaXRcblx0XHRtb2RlbFNlcnZpY2UuZGVzdHJveU1vZGVsKHJlc291cmNlKTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgbWFpbnRhaW4gdW5kbyBmb3Igc2FtZSByZXNvdXJjZSBhbmQgZGlmZmVyZW50IGNvbnRlbnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkucGFyc2UoJ2ZpbGU6Ly90ZXN0LnR4dCcpO1xuXG5cdFx0Ly8gY3JlYXRlIGEgbW9kZWxcblx0XHRjb25zdCBtb2RlbDEgPSBtb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoJ3RleHQnLCBudWxsLCByZXNvdXJjZSk7XG5cdFx0Ly8gbWFrZSBhbiBlZGl0XG5cdFx0bW9kZWwxLnB1c2hFZGl0T3BlcmF0aW9ucyhudWxsLCBbeyByYW5nZTogbmV3IFJhbmdlKDEsIDUsIDEsIDUpLCB0ZXh0OiAnMScgfV0sICgpID0+IFtuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsMS5nZXRWYWx1ZSgpLCAndGV4dDEnKTtcblx0XHQvLyBkaXNwb3NlIGl0XG5cdFx0bW9kZWxTZXJ2aWNlLmRlc3Ryb3lNb2RlbChyZXNvdXJjZSk7XG5cblx0XHQvLyBjcmVhdGUgYSBuZXcgbW9kZWwgd2l0aCB0aGUgc2FtZSBjb250ZW50XG5cdFx0Y29uc3QgbW9kZWwyID0gbW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKCd0ZXh0MicsIG51bGwsIHJlc291cmNlKTtcblx0XHQvLyB1bmRvXG5cdFx0bW9kZWwyLnVuZG8oKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwyLmdldFZhbHVlKCksICd0ZXh0MicpO1xuXHRcdC8vIGRpc3Bvc2UgaXRcblx0XHRtb2RlbFNlcnZpY2UuZGVzdHJveU1vZGVsKHJlc291cmNlKTtcblx0fSk7XG5cblx0dGVzdCgnc2V0VmFsdWUgc2hvdWxkIGNsZWFyIHVuZG8gc3RhY2snLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkucGFyc2UoJ2ZpbGU6Ly90ZXN0LnR4dCcpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBtb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoJ3RleHQnLCBudWxsLCByZXNvdXJjZSk7XG5cdFx0bW9kZWwucHVzaEVkaXRPcGVyYXRpb25zKG51bGwsIFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgNSwgMSwgNSksIHRleHQ6ICcxJyB9XSwgKCkgPT4gW25ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNSldKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgJ3RleHQxJyk7XG5cblx0XHRtb2RlbC5zZXRWYWx1ZSgndGV4dDInKTtcblx0XHRtb2RlbC51bmRvKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICd0ZXh0MicpO1xuXHRcdC8vIGRpc3Bvc2UgaXRcblx0XHRtb2RlbFNlcnZpY2UuZGVzdHJveU1vZGVsKHJlc291cmNlKTtcblx0fSk7XG59KTtcblxuZnVuY3Rpb24gYXNzZXJ0Q29tcHV0ZUVkaXRzKGxpbmVzMTogc3RyaW5nW10sIGxpbmVzMjogc3RyaW5nW10pOiB2b2lkIHtcblx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwobGluZXMxLmpvaW4oJ1xcbicpKTtcblx0Y29uc3QgeyBkaXNwb3NhYmxlLCB0ZXh0QnVmZmVyIH0gPSBjcmVhdGVUZXh0QnVmZmVyKGxpbmVzMi5qb2luKCdcXG4nKSwgRGVmYXVsdEVuZE9mTGluZS5MRik7XG5cblx0Ly8gY29tcHV0ZSByZXF1aXJlZCBlZGl0c1xuXHQvLyBsZXQgc3RhcnQgPSBEYXRlLm5vdygpO1xuXHRjb25zdCBlZGl0cyA9IE1vZGVsU2VydmljZS5fY29tcHV0ZUVkaXRzKG1vZGVsLCB0ZXh0QnVmZmVyKTtcblx0Ly8gY29uc29sZS5sb2coYHRvb2sgJHtEYXRlLm5vdygpIC0gc3RhcnR9IG1zLmApO1xuXG5cdC8vIGFwcGx5IGVkaXRzXG5cdG1vZGVsLnB1c2hFZGl0T3BlcmF0aW9ucyhbXSwgZWRpdHMsIG51bGwpO1xuXG5cdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBsaW5lczIuam9pbignXFxuJykpO1xuXHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0bW9kZWwuZGlzcG9zZSgpO1xufVxuXG5mdW5jdGlvbiBnZXRSYW5kb21JbnQobWluOiBudW1iZXIsIG1heDogbnVtYmVyKTogbnVtYmVyIHtcblx0cmV0dXJuIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4gKyAxKSkgKyBtaW47XG59XG5cbmZ1bmN0aW9uIGdldFJhbmRvbVN0cmluZyhtaW5MZW5ndGg6IG51bWJlciwgbWF4TGVuZ3RoOiBudW1iZXIpOiBzdHJpbmcge1xuXHRjb25zdCBsZW5ndGggPSBnZXRSYW5kb21JbnQobWluTGVuZ3RoLCBtYXhMZW5ndGgpO1xuXHRjb25zdCB0ID0gbmV3IFN0cmluZ0J1aWxkZXIobGVuZ3RoKTtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuXHRcdHQuYXBwZW5kQVNDSUlDaGFyQ29kZShnZXRSYW5kb21JbnQoQ2hhckNvZGUuYSwgQ2hhckNvZGUueikpO1xuXHR9XG5cdHJldHVybiB0LmJ1aWxkKCk7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlRmlsZShzbWFsbDogYm9vbGVhbik6IHN0cmluZ1tdIHtcblx0Y29uc3QgbGluZUNvdW50ID0gZ2V0UmFuZG9tSW50KDEsIHNtYWxsID8gMyA6IDEwMDAwKTtcblx0Y29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbGluZUNvdW50OyBpKyspIHtcblx0XHRsaW5lcy5wdXNoKGdldFJhbmRvbVN0cmluZygwLCBzbWFsbCA/IDMgOiAxMDAwMCkpO1xuXHR9XG5cdHJldHVybiBsaW5lcztcbn1cblxuaWYgKEdFTkVSQVRFX1RFU1RTKSB7XG5cdGxldCBudW1iZXIgPSAxO1xuXHR3aGlsZSAodHJ1ZSkge1xuXG5cdFx0Y29uc29sZS5sb2coJy0tLS0tLVRFU1Q6ICcgKyBudW1iZXIrKyk7XG5cblx0XHRjb25zdCBmaWxlMSA9IGdlbmVyYXRlRmlsZSh0cnVlKTtcblx0XHRjb25zdCBmaWxlMiA9IGdlbmVyYXRlRmlsZSh0cnVlKTtcblxuXHRcdGNvbnNvbGUubG9nKCctLS0tLS1URVNUIEdFTkVSQVRFRCcpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGFzc2VydENvbXB1dGVFZGl0cyhmaWxlMSwgZmlsZTIpO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0Y29uc29sZS5sb2coZXJyKTtcblx0XHRcdGNvbnNvbGUubG9nKGBcbmNvbnN0IGZpbGUxID0gJHtKU09OLnN0cmluZ2lmeShmaWxlMSkucmVwbGFjZSgvXCIvZywgJ1xcJycpfTtcbmNvbnN0IGZpbGUyID0gJHtKU09OLnN0cmluZ2lmeShmaWxlMikucmVwbGFjZSgvXCIvZywgJ1xcJycpfTtcbmFzc2VydENvbXB1dGVFZGl0cyhmaWxlMSwgZmlsZTIpO1xuYCk7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQW5kUmVnaXN0ZXJUZXh0QnVmZmVyKHN0b3JlOiBEaXNwb3NhYmxlU3RvcmUsIHZhbHVlOiBzdHJpbmcgfCBJVGV4dEJ1ZmZlckZhY3RvcnkgfCBJVGV4dFNuYXBzaG90LCBkZWZhdWx0RU9MOiBEZWZhdWx0RW5kT2ZMaW5lKTogSVRleHRCdWZmZXIge1xuXHRjb25zdCB7IGRpc3Bvc2FibGUsIHRleHRCdWZmZXIgfSA9IGNyZWF0ZVRleHRCdWZmZXIodmFsdWUsIGRlZmF1bHRFT0wpO1xuXHRzdG9yZS5hZGQoZGlzcG9zYWJsZSk7XG5cdHJldHVybiB0ZXh0QnVmZmVyO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsZ0JBQWdCO0FBQ3pCLFlBQVksY0FBYztBQUMxQixTQUFTLFdBQVc7QUFDcEIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsd0JBQXdFO0FBQ2pGLFNBQVMsd0JB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
