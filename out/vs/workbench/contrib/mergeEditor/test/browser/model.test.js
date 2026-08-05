import assert from "assert";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { transaction } from "../../../../../base/common/observable.js";
import { isDefined } from "../../../../../base/common/types.js";
import { linesDiffComputers } from "../../../../../editor/common/diff/linesDiffComputers.js";
import { EndOfLinePreference } from "../../../../../editor/common/model.js";
import { createModelServices, createTextModel } from "../../../../../editor/test/common/testTextModel.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import { toLineRange, toRangeMapping } from "../../browser/model/diffComputer.js";
import { DetailedLineRangeMapping } from "../../browser/model/mapping.js";
import { MergeEditorModel } from "../../browser/model/mergeEditorModel.js";
import { MergeEditorTelemetry } from "../../browser/telemetry.js";
suite("merge editor model", () => {
  test("prepend line", async () => {
    await testMergeModel(
      {
        "languageId": "plaintext",
        "base": "line1\nline2",
        "input1": "0\nline1\nline2",
        "input2": "0\nline1\nline2",
        "result": ""
      },
      (model) => {
        assert.deepStrictEqual(model.getProjections(), {
          base: ["\u27E6\u27E7\u2080line1", "line2"],
          input1: ["\u27E60", "\u27E7\u2080line1", "line2"],
          input2: ["\u27E60", "\u27E7\u2080line1", "line2"],
          result: ["\u27E6\u27E7{unrecognized}\u2080"]
        });
        model.toggleConflict(0, 1);
        assert.deepStrictEqual(
          { result: model.getResult() },
          { result: "0\nline1\nline2" }
        );
        model.toggleConflict(0, 2);
        assert.deepStrictEqual(
          { result: model.getResult() },
          { result: "0\n0\nline1\nline2" }
        );
      }
    );
  });
  test("empty base", async () => {
    await testMergeModel(
      {
        "languageId": "plaintext",
        "base": "",
        "input1": "input1",
        "input2": "input2",
        "result": ""
      },
      (model) => {
        assert.deepStrictEqual(model.getProjections(), {
          base: ["\u27E6\u27E7\u2080"],
          input1: ["\u27E6input1\u27E7\u2080"],
          input2: ["\u27E6input2\u27E7\u2080"],
          result: ["\u27E6\u27E7{base}\u2080"]
        });
        model.toggleConflict(0, 1);
        assert.deepStrictEqual(
          { result: model.getResult() },
          { result: "input1" }
        );
        model.toggleConflict(0, 2);
        assert.deepStrictEqual(
          { result: model.getResult() },
          { result: "input2" }
        );
      }
    );
  });
  test("can merge word changes", async () => {
    await testMergeModel(
      {
        "languageId": "plaintext",
        "base": "hello",
        "input1": "hallo",
        "input2": "helloworld",
        "result": ""
      },
      (model) => {
        assert.deepStrictEqual(model.getProjections(), {
          base: ["\u27E6hello\u27E7\u2080"],
          input1: ["\u27E6hallo\u27E7\u2080"],
          input2: ["\u27E6helloworld\u27E7\u2080"],
          result: ["\u27E6\u27E7{unrecognized}\u2080"]
        });
        model.toggleConflict(0, 1);
        model.toggleConflict(0, 2);
        assert.deepStrictEqual(
          { result: model.getResult() },
          { result: "halloworld" }
        );
      }
    );
  });
  test("can combine insertions at end of document", async () => {
    await testMergeModel(
      {
        "languageId": "plaintext",
        "base": "Z\xFCrich\nBern\nBasel\nChur\nGenf\nThun",
        "input1": "Z\xFCrich\nBern\nChur\nDavos\nGenf\nThun\nfunction f(b:boolean) {}",
        "input2": "Z\xFCrich\nBern\nBasel (FCB)\nChur\nGenf\nThun\nfunction f(a:number) {}",
        "result": "Z\xFCrich\nBern\nBasel\nChur\nDavos\nGenf\nThun"
      },
      (model) => {
        assert.deepStrictEqual(model.getProjections(), {
          base: ["Z\xFCrich", "Bern", "\u27E6Basel", "\u27E7\u2080Chur", "\u27E6\u27E7\u2081Genf", "Thun\u27E6\u27E7\u2082"],
          input1: [
            "Z\xFCrich",
            "Bern",
            "\u27E6\u27E7\u2080Chur",
            "\u27E6Davos",
            "\u27E7\u2081Genf",
            "Thun",
            "\u27E6function f(b:boolean) {}\u27E7\u2082"
          ],
          input2: [
            "Z\xFCrich",
            "Bern",
            "\u27E6Basel (FCB)",
            "\u27E7\u2080Chur",
            "\u27E6\u27E7\u2081Genf",
            "Thun",
            "\u27E6function f(a:number) {}\u27E7\u2082"
          ],
          result: [
            "Z\xFCrich",
            "Bern",
            "\u27E6Basel",
            "\u27E7{base}\u2080Chur",
            "\u27E6Davos",
            "\u27E7{1\u2713}\u2081Genf",
            "Thun\u27E6\u27E7{base}\u2082"
          ]
        });
        model.toggleConflict(2, 1);
        model.toggleConflict(2, 2);
        assert.deepStrictEqual(
          { result: model.getResult() },
          {
            result: "Z\xFCrich\nBern\nBasel\nChur\nDavos\nGenf\nThun\nfunction f(b:boolean) {}\nfunction f(a:number) {}"
          }
        );
      }
    );
  });
  test("conflicts are reset", async () => {
    await testMergeModel(
      {
        "languageId": "typescript",
        "base": "import { h } from 'vs/base/browser/dom';\nimport { Disposable, IDisposable } from 'vs/base/common/lifecycle';\nimport { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';\nimport { EditorOption } from 'vs/editor/common/config/editorOptions';\nimport { autorun, IReader, observableFromEvent, ObservableValue } from 'vs/workbench/contrib/audioCues/browser/observable';\nimport { LineRange } from 'vs/workbench/contrib/mergeEditor/browser/model/lineRange';\n",
        "input1": "import { h } from 'vs/base/browser/dom';\nimport { Disposable, IDisposable } from 'vs/base/common/lifecycle';\nimport { observableSignalFromEvent } from 'vs/base/common/observable';\nimport { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';\nimport { autorun, IReader, observableFromEvent } from 'vs/workbench/contrib/audioCues/browser/observable';\nimport { LineRange } from 'vs/workbench/contrib/mergeEditor/browser/model/lineRange';\n",
        "input2": "import { h } from 'vs/base/browser/dom';\nimport { Disposable, IDisposable } from 'vs/base/common/lifecycle';\nimport { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';\nimport { autorun, IReader, observableFromEvent, ObservableValue } from 'vs/workbench/contrib/audioCues/browser/observable';\nimport { LineRange } from 'vs/workbench/contrib/mergeEditor/browser/model/lineRange';\n",
        "result": "import { h } from 'vs/base/browser/dom';\r\nimport { Disposable, IDisposable } from 'vs/base/common/lifecycle';\r\nimport { observableSignalFromEvent } from 'vs/base/common/observable';\r\nimport { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';\r\n<<<<<<< Updated upstream\r\nimport { autorun, IReader, observableFromEvent, ObservableValue } from 'vs/workbench/contrib/audioCues/browser/observable';\r\n=======\r\nimport { autorun, IReader, observableFromEvent } from 'vs/workbench/contrib/audioCues/browser/observable';\r\n>>>>>>> Stashed changes\r\nimport { LineRange } from 'vs/workbench/contrib/mergeEditor/browser/model/lineRange';\r\n"
      },
      (model) => {
        assert.deepStrictEqual(model.getProjections(), {
          base: [
            "import { h } from 'vs/base/browser/dom';",
            "import { Disposable, IDisposable } from 'vs/base/common/lifecycle';",
            "\u27E6\u27E7\u2080import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';",
            "\u27E6import { EditorOption } from 'vs/editor/common/config/editorOptions';",
            "import { autorun, IReader, observableFromEvent, ObservableValue } from 'vs/workbench/contrib/audioCues/browser/observable';",
            "\u27E7\u2081import { LineRange } from 'vs/workbench/contrib/mergeEditor/browser/model/lineRange';",
            ""
          ],
          input1: [
            "import { h } from 'vs/base/browser/dom';",
            "import { Disposable, IDisposable } from 'vs/base/common/lifecycle';",
            "\u27E6import { observableSignalFromEvent } from 'vs/base/common/observable';",
            "\u27E7\u2080import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';",
            "\u27E6import { autorun, IReader, observableFromEvent } from 'vs/workbench/contrib/audioCues/browser/observable';",
            "\u27E7\u2081import { LineRange } from 'vs/workbench/contrib/mergeEditor/browser/model/lineRange';",
            ""
          ],
          input2: [
            "import { h } from 'vs/base/browser/dom';",
            "import { Disposable, IDisposable } from 'vs/base/common/lifecycle';",
            "\u27E6\u27E7\u2080import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';",
            "\u27E6import { autorun, IReader, observableFromEvent, ObservableValue } from 'vs/workbench/contrib/audioCues/browser/observable';",
            "\u27E7\u2081import { LineRange } from 'vs/workbench/contrib/mergeEditor/browser/model/lineRange';",
            ""
          ],
          result: [
            "import { h } from 'vs/base/browser/dom';",
            "import { Disposable, IDisposable } from 'vs/base/common/lifecycle';",
            "\u27E6import { observableSignalFromEvent } from 'vs/base/common/observable';",
            "\u27E7{1\u2713}\u2080import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';",
            "\u27E6<<<<<<< Updated upstream",
            "import { autorun, IReader, observableFromEvent, ObservableValue } from 'vs/workbench/contrib/audioCues/browser/observable';",
            "=======",
            "import { autorun, IReader, observableFromEvent } from 'vs/workbench/contrib/audioCues/browser/observable';",
            ">>>>>>> Stashed changes",
            "\u27E7{unrecognized}\u2081import { LineRange } from 'vs/workbench/contrib/mergeEditor/browser/model/lineRange';",
            ""
          ]
        });
      }
    );
  });
  test("auto-solve equal edits", async () => {
    await testMergeModel(
      {
        "languageId": "javascript",
        "base": `const { readFileSync } = require('fs');

let paths = process.argv.slice(2);
main(paths);

function main(paths) {
    // print the welcome message
    printMessage();

    let data = getLineCountInfo(paths);
    console.log("Lines: " + data.totalLineCount);
}

/**
 * Prints the welcome message
*/
function printMessage() {
    console.log("Welcome To Line Counter");
}

/**
 * @param {string[]} paths
*/
function getLineCountInfo(paths) {
    let lineCounts = paths.map(path => ({ path, count: getLinesLength(readFileSync(path, 'utf8')) }));
    return {
        totalLineCount: lineCounts.reduce((acc, { count }) => acc + count, 0),
        lineCounts,
    };
}

/**
 * @param {string} str
 */
function getLinesLength(str) {
    return str.split('\\n').length;
}
`,
        "input1": `const { readFileSync } = require('fs');

let paths = process.argv.slice(2);
main(paths);

function main(paths) {
    // print the welcome message
    printMessage();

    const data = getLineCountInfo(paths);
    console.log("Lines: " + data.totalLineCount);
}

function printMessage() {
    console.log("Welcome To Line Counter");
}

/**
 * @param {string[]} paths
*/
function getLineCountInfo(paths) {
    let lineCounts = paths.map(path => ({ path, count: getLinesLength(readFileSync(path, 'utf8')) }));
    return {
        totalLineCount: lineCounts.reduce((acc, { count }) => acc + count, 0),
        lineCounts,
    };
}

/**
 * @param {string} str
 */
function getLinesLength(str) {
    return str.split('\\n').length;
}
`,
        "input2": `const { readFileSync } = require('fs');

let paths = process.argv.slice(2);
run(paths);

function run(paths) {
    // print the welcome message
    printMessage();

    const data = getLineCountInfo(paths);
    console.log("Lines: " + data.totalLineCount);
}

function printMessage() {
    console.log("Welcome To Line Counter");
}

/**
 * @param {string[]} paths
*/
function getLineCountInfo(paths) {
    let lineCounts = paths.map(path => ({ path, count: getLinesLength(readFileSync(path, 'utf8')) }));
    return {
        totalLineCount: lineCounts.reduce((acc, { count }) => acc + count, 0),
        lineCounts,
    };
}

/**
 * @param {string} str
 */
function getLinesLength(str) {
    return str.split('\\n').length;
}
`,
        "result": "<<<<<<< uiae\n>>>>>>> Stashed changes",
        resetResult: true
      },
      async (model) => {
        await model.mergeModel.reset();
        assert.deepStrictEqual(model.getResult(), `const { readFileSync } = require('fs');

let paths = process.argv.slice(2);
run(paths);

function run(paths) {
    // print the welcome message
    printMessage();

    const data = getLineCountInfo(paths);
    console.log("Lines: " + data.totalLineCount);
}

function printMessage() {
    console.log("Welcome To Line Counter");
}

/**
 * @param {string[]} paths
*/
function getLineCountInfo(paths) {
    let lineCounts = paths.map(path => ({ path, count: getLinesLength(readFileSync(path, 'utf8')) }));
    return {
        totalLineCount: lineCounts.reduce((acc, { count }) => acc + count, 0),
        lineCounts,
    };
}

/**
 * @param {string} str
 */
function getLinesLength(str) {
    return str.split('\\n').length;
}
`);
      }
    );
  });
});
async function testMergeModel(options, fn) {
  const disposables = new DisposableStore();
  const modelInterface = disposables.add(
    new MergeModelInterface(options, createModelServices(disposables))
  );
  await modelInterface.mergeModel.onInitialized;
  await fn(modelInterface);
  disposables.dispose();
}
function toSmallNumbersDec(value) {
  const smallNumbers = ["\u2080", "\u2081", "\u2082", "\u2083", "\u2084", "\u2085", "\u2086", "\u2087", "\u2088", "\u2089"];
  return value.toString().split("").map((c) => smallNumbers[parseInt(c)]).join("");
}
class MergeModelInterface extends Disposable {
  constructor(options, instantiationService) {
    super();
    const input1TextModel = this._register(createTextModel(options.input1, options.languageId));
    const input2TextModel = this._register(createTextModel(options.input2, options.languageId));
    const baseTextModel = this._register(createTextModel(options.base, options.languageId));
    const resultTextModel = this._register(createTextModel(options.result, options.languageId));
    const diffComputer = {
      async computeDiff(textModel1, textModel2, reader) {
        const result = await linesDiffComputers.getLegacy().computeDiff(
          textModel1.getLinesContent(),
          textModel2.getLinesContent(),
          { ignoreTrimWhitespace: false, maxComputationTimeMs: 1e4, computeMoves: false }
        );
        const changes = result.changes.map(
          (c) => new DetailedLineRangeMapping(
            toLineRange(c.original),
            textModel1,
            toLineRange(c.modified),
            textModel2,
            c.innerChanges?.map((ic) => toRangeMapping(ic)).filter(isDefined)
          )
        );
        return {
          diffs: changes
        };
      }
    };
    this.mergeModel = this._register(instantiationService.createInstance(
      MergeEditorModel,
      baseTextModel,
      {
        textModel: input1TextModel,
        description: "",
        detail: "",
        title: ""
      },
      {
        textModel: input2TextModel,
        description: "",
        detail: "",
        title: ""
      },
      resultTextModel,
      diffComputer,
      {
        resetResult: options.resetResult || false
      },
      new MergeEditorTelemetry(NullTelemetryService)
    ));
  }
  getProjections() {
    function applyRanges(textModel, ranges) {
      textModel.applyEdits(ranges.map(({ range, label }) => ({
        range,
        text: `\u27E6${textModel.getValueInRange(range)}\u27E7${label}`
      })));
    }
    const baseRanges = this.mergeModel.modifiedBaseRanges.get();
    const baseTextModel = createTextModel(this.mergeModel.base.getValue());
    applyRanges(
      baseTextModel,
      baseRanges.map((r, idx) => ({
        range: r.baseRange.toRange(),
        label: toSmallNumbersDec(idx)
      }))
    );
    const input1TextModel = createTextModel(this.mergeModel.input1.textModel.getValue());
    applyRanges(
      input1TextModel,
      baseRanges.map((r, idx) => ({
        range: r.input1Range.toRange(),
        label: toSmallNumbersDec(idx)
      }))
    );
    const input2TextModel = createTextModel(this.mergeModel.input2.textModel.getValue());
    applyRanges(
      input2TextModel,
      baseRanges.map((r, idx) => ({
        range: r.input2Range.toRange(),
        label: toSmallNumbersDec(idx)
      }))
    );
    const resultTextModel = createTextModel(this.mergeModel.resultTextModel.getValue());
    applyRanges(
      resultTextModel,
      baseRanges.map((r, idx) => ({
        range: this.mergeModel.getLineRangeInResult(r.baseRange).toRange(),
        label: `{${this.mergeModel.getState(r).get()}}${toSmallNumbersDec(idx)}`
      }))
    );
    const result = {
      base: baseTextModel.getValue(EndOfLinePreference.LF).split("\n"),
      input1: input1TextModel.getValue(EndOfLinePreference.LF).split("\n"),
      input2: input2TextModel.getValue(EndOfLinePreference.LF).split("\n"),
      result: resultTextModel.getValue(EndOfLinePreference.LF).split("\n")
    };
    baseTextModel.dispose();
    input1TextModel.dispose();
    input2TextModel.dispose();
    resultTextModel.dispose();
    return result;
  }
  toggleConflict(conflictIdx, inputNumber) {
    const baseRange = this.mergeModel.modifiedBaseRanges.get()[conflictIdx];
    if (!baseRange) {
      throw new Error();
    }
    const state = this.mergeModel.getState(baseRange).get();
    transaction((tx) => {
      this.mergeModel.setState(baseRange, state.toggle(inputNumber), true, tx);
    });
  }
  getResult() {
    return this.mergeModel.resultTextModel.getValue();
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci90ZXN0L2Jyb3dzZXIvbW9kZWwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJUmVhZGVyLCB0cmFuc2FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgaXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgbGluZXNEaWZmQ29tcHV0ZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9kaWZmL2xpbmVzRGlmZkNvbXB1dGVycy5qcyc7XG5pbXBvcnQgeyBFbmRPZkxpbmVQcmVmZXJlbmNlLCBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVNb2RlbFNlcnZpY2VzLCBjcmVhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IE51bGxUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnlVdGlscy5qcyc7XG5pbXBvcnQgeyBJTWVyZ2VEaWZmQ29tcHV0ZXIsIElNZXJnZURpZmZDb21wdXRlclJlc3VsdCwgdG9MaW5lUmFuZ2UsIHRvUmFuZ2VNYXBwaW5nIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9tb2RlbC9kaWZmQ29tcHV0ZXIuanMnO1xuaW1wb3J0IHsgRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9tb2RlbC9tYXBwaW5nLmpzJztcbmltcG9ydCB7IE1lcmdlRWRpdG9yTW9kZWwgfSBmcm9tICcuLi8uLi9icm93c2VyL21vZGVsL21lcmdlRWRpdG9yTW9kZWwuanMnO1xuaW1wb3J0IHsgTWVyZ2VFZGl0b3JUZWxlbWV0cnkgfSBmcm9tICcuLi8uLi9icm93c2VyL3RlbGVtZXRyeS5qcyc7XG5cbnN1aXRlKCdtZXJnZSBlZGl0b3IgbW9kZWwnLCAoKSA9PiB7XG5cdC8vIHRvZG86IHJlbmFibGUgd2hlbiBmYWlsaW5nIGNhc2UgaXMgZm91bmQgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvcHVsbC8xOTA0NDQjaXNzdWVjb21tZW50LTE2NzgxNTE0Mjhcblx0Ly8gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgncHJlcGVuZCBsaW5lJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RNZXJnZU1vZGVsKFxuXHRcdFx0e1xuXHRcdFx0XHRcImxhbmd1YWdlSWRcIjogXCJwbGFpbnRleHRcIixcblx0XHRcdFx0XCJiYXNlXCI6IFwibGluZTFcXG5saW5lMlwiLFxuXHRcdFx0XHRcImlucHV0MVwiOiBcIjBcXG5saW5lMVxcbmxpbmUyXCIsXG5cdFx0XHRcdFwiaW5wdXQyXCI6IFwiMFxcbmxpbmUxXFxubGluZTJcIixcblx0XHRcdFx0XCJyZXN1bHRcIjogXCJcIlxuXHRcdFx0fSxcblx0XHRcdG1vZGVsID0+IHtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRQcm9qZWN0aW9ucygpLCB7XG5cdFx0XHRcdFx0YmFzZTogWydcdTI3RTZcdTI3RTdcdTIwODBsaW5lMScsICdsaW5lMiddLFxuXHRcdFx0XHRcdGlucHV0MTogWydcdTI3RTYwJywgJ1x1MjdFN1x1MjA4MGxpbmUxJywgJ2xpbmUyJ10sXG5cdFx0XHRcdFx0aW5wdXQyOiBbJ1x1MjdFNjAnLCAnXHUyN0U3XHUyMDgwbGluZTEnLCAnbGluZTInXSxcblx0XHRcdFx0XHRyZXN1bHQ6IFsnXHUyN0U2XHUyN0U3e3VucmVjb2duaXplZH1cdTIwODAnXSxcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0bW9kZWwudG9nZ2xlQ29uZmxpY3QoMCwgMSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0eyByZXN1bHQ6IG1vZGVsLmdldFJlc3VsdCgpIH0sXG5cdFx0XHRcdFx0eyByZXN1bHQ6ICcwXFxubGluZTFcXG5saW5lMicgfVxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdG1vZGVsLnRvZ2dsZUNvbmZsaWN0KDAsIDIpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdHsgcmVzdWx0OiBtb2RlbC5nZXRSZXN1bHQoKSB9LFxuXHRcdFx0XHRcdCh7IHJlc3VsdDogXCIwXFxuMFxcbmxpbmUxXFxubGluZTJcIiB9KVxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VtcHR5IGJhc2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdE1lcmdlTW9kZWwoXG5cdFx0XHR7XG5cdFx0XHRcdFwibGFuZ3VhZ2VJZFwiOiBcInBsYWludGV4dFwiLFxuXHRcdFx0XHRcImJhc2VcIjogXCJcIixcblx0XHRcdFx0XCJpbnB1dDFcIjogXCJpbnB1dDFcIixcblx0XHRcdFx0XCJpbnB1dDJcIjogXCJpbnB1dDJcIixcblx0XHRcdFx0XCJyZXN1bHRcIjogXCJcIlxuXHRcdFx0fSxcblx0XHRcdG1vZGVsID0+IHtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRQcm9qZWN0aW9ucygpLCB7XG5cdFx0XHRcdFx0YmFzZTogWydcdTI3RTZcdTI3RTdcdTIwODAnXSxcblx0XHRcdFx0XHRpbnB1dDE6IFsnXHUyN0U2aW5wdXQxXHUyN0U3XHUyMDgwJ10sXG5cdFx0XHRcdFx0aW5wdXQyOiBbJ1x1MjdFNmlucHV0Mlx1MjdFN1x1MjA4MCddLFxuXHRcdFx0XHRcdHJlc3VsdDogWydcdTI3RTZcdTI3RTd7YmFzZX1cdTIwODAnXSxcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0bW9kZWwudG9nZ2xlQ29uZmxpY3QoMCwgMSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0eyByZXN1bHQ6IG1vZGVsLmdldFJlc3VsdCgpIH0sXG5cdFx0XHRcdFx0KHsgcmVzdWx0OiBcImlucHV0MVwiIH0pXG5cdFx0XHRcdCk7XG5cblx0XHRcdFx0bW9kZWwudG9nZ2xlQ29uZmxpY3QoMCwgMik7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0eyByZXN1bHQ6IG1vZGVsLmdldFJlc3VsdCgpIH0sXG5cdFx0XHRcdFx0KHsgcmVzdWx0OiBcImlucHV0MlwiIH0pXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnY2FuIG1lcmdlIHdvcmQgY2hhbmdlcycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0TWVyZ2VNb2RlbChcblx0XHRcdHtcblx0XHRcdFx0XCJsYW5ndWFnZUlkXCI6IFwicGxhaW50ZXh0XCIsXG5cdFx0XHRcdFwiYmFzZVwiOiBcImhlbGxvXCIsXG5cdFx0XHRcdFwiaW5wdXQxXCI6IFwiaGFsbG9cIixcblx0XHRcdFx0XCJpbnB1dDJcIjogXCJoZWxsb3dvcmxkXCIsXG5cdFx0XHRcdFwicmVzdWx0XCI6IFwiXCJcblx0XHRcdH0sXG5cdFx0XHRtb2RlbCA9PiB7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0UHJvamVjdGlvbnMoKSwge1xuXHRcdFx0XHRcdGJhc2U6IFsnXHUyN0U2aGVsbG9cdTI3RTdcdTIwODAnXSxcblx0XHRcdFx0XHRpbnB1dDE6IFsnXHUyN0U2aGFsbG9cdTI3RTdcdTIwODAnXSxcblx0XHRcdFx0XHRpbnB1dDI6IFsnXHUyN0U2aGVsbG93b3JsZFx1MjdFN1x1MjA4MCddLFxuXHRcdFx0XHRcdHJlc3VsdDogWydcdTI3RTZcdTI3RTd7dW5yZWNvZ25pemVkfVx1MjA4MCddLFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRtb2RlbC50b2dnbGVDb25mbGljdCgwLCAxKTtcblx0XHRcdFx0bW9kZWwudG9nZ2xlQ29uZmxpY3QoMCwgMik7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHR7IHJlc3VsdDogbW9kZWwuZ2V0UmVzdWx0KCkgfSxcblx0XHRcdFx0XHR7IHJlc3VsdDogJ2hhbGxvd29ybGQnIH1cblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHQpO1xuXG5cdH0pO1xuXG5cdHRlc3QoJ2NhbiBjb21iaW5lIGluc2VydGlvbnMgYXQgZW5kIG9mIGRvY3VtZW50JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RNZXJnZU1vZGVsKFxuXHRcdFx0e1xuXHRcdFx0XHRcImxhbmd1YWdlSWRcIjogXCJwbGFpbnRleHRcIixcblx0XHRcdFx0XCJiYXNlXCI6IFwiWlx1MDBGQ3JpY2hcXG5CZXJuXFxuQmFzZWxcXG5DaHVyXFxuR2VuZlxcblRodW5cIixcblx0XHRcdFx0XCJpbnB1dDFcIjogXCJaXHUwMEZDcmljaFxcbkJlcm5cXG5DaHVyXFxuRGF2b3NcXG5HZW5mXFxuVGh1blxcbmZ1bmN0aW9uIGYoYjpib29sZWFuKSB7fVwiLFxuXHRcdFx0XHRcImlucHV0MlwiOiBcIlpcdTAwRkNyaWNoXFxuQmVyblxcbkJhc2VsIChGQ0IpXFxuQ2h1clxcbkdlbmZcXG5UaHVuXFxuZnVuY3Rpb24gZihhOm51bWJlcikge31cIixcblx0XHRcdFx0XCJyZXN1bHRcIjogXCJaXHUwMEZDcmljaFxcbkJlcm5cXG5CYXNlbFxcbkNodXJcXG5EYXZvc1xcbkdlbmZcXG5UaHVuXCJcblx0XHRcdH0sXG5cdFx0XHRtb2RlbCA9PiB7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0UHJvamVjdGlvbnMoKSwge1xuXHRcdFx0XHRcdGJhc2U6IFsnWlx1MDBGQ3JpY2gnLCAnQmVybicsICdcdTI3RTZCYXNlbCcsICdcdTI3RTdcdTIwODBDaHVyJywgJ1x1MjdFNlx1MjdFN1x1MjA4MUdlbmYnLCAnVGh1blx1MjdFNlx1MjdFN1x1MjA4MiddLFxuXHRcdFx0XHRcdGlucHV0MTogW1xuXHRcdFx0XHRcdFx0J1pcdTAwRkNyaWNoJyxcblx0XHRcdFx0XHRcdCdCZXJuJyxcblx0XHRcdFx0XHRcdCdcdTI3RTZcdTI3RTdcdTIwODBDaHVyJyxcblx0XHRcdFx0XHRcdCdcdTI3RTZEYXZvcycsXG5cdFx0XHRcdFx0XHQnXHUyN0U3XHUyMDgxR2VuZicsXG5cdFx0XHRcdFx0XHQnVGh1bicsXG5cdFx0XHRcdFx0XHQnXHUyN0U2ZnVuY3Rpb24gZihiOmJvb2xlYW4pIHt9XHUyN0U3XHUyMDgyJyxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdGlucHV0MjogW1xuXHRcdFx0XHRcdFx0J1pcdTAwRkNyaWNoJyxcblx0XHRcdFx0XHRcdCdCZXJuJyxcblx0XHRcdFx0XHRcdCdcdTI3RTZCYXNlbCAoRkNCKScsXG5cdFx0XHRcdFx0XHQnXHUyN0U3XHUyMDgwQ2h1cicsXG5cdFx0XHRcdFx0XHQnXHUyN0U2XHUyN0U3XHUyMDgxR2VuZicsXG5cdFx0XHRcdFx0XHQnVGh1bicsXG5cdFx0XHRcdFx0XHQnXHUyN0U2ZnVuY3Rpb24gZihhOm51bWJlcikge31cdTI3RTdcdTIwODInLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0cmVzdWx0OiBbXG5cdFx0XHRcdFx0XHQnWlx1MDBGQ3JpY2gnLFxuXHRcdFx0XHRcdFx0J0Jlcm4nLFxuXHRcdFx0XHRcdFx0J1x1MjdFNkJhc2VsJyxcblx0XHRcdFx0XHRcdCdcdTI3RTd7YmFzZX1cdTIwODBDaHVyJyxcblx0XHRcdFx0XHRcdCdcdTI3RTZEYXZvcycsXG5cdFx0XHRcdFx0XHQnXHUyN0U3ezFcdTI3MTN9XHUyMDgxR2VuZicsXG5cdFx0XHRcdFx0XHQnVGh1blx1MjdFNlx1MjdFN3tiYXNlfVx1MjA4MicsXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0bW9kZWwudG9nZ2xlQ29uZmxpY3QoMiwgMSk7XG5cdFx0XHRcdG1vZGVsLnRvZ2dsZUNvbmZsaWN0KDIsIDIpO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0eyByZXN1bHQ6IG1vZGVsLmdldFJlc3VsdCgpIH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0cmVzdWx0OlxuXHRcdFx0XHRcdFx0XHQnWlx1MDBGQ3JpY2hcXG5CZXJuXFxuQmFzZWxcXG5DaHVyXFxuRGF2b3NcXG5HZW5mXFxuVGh1blxcbmZ1bmN0aW9uIGYoYjpib29sZWFuKSB7fVxcbmZ1bmN0aW9uIGYoYTpudW1iZXIpIHt9Jyxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnY29uZmxpY3RzIGFyZSByZXNldCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0TWVyZ2VNb2RlbChcblx0XHRcdHtcblx0XHRcdFx0XCJsYW5ndWFnZUlkXCI6IFwidHlwZXNjcmlwdFwiLFxuXHRcdFx0XHRcImJhc2VcIjogXCJpbXBvcnQgeyBoIH0gZnJvbSAndnMvYmFzZS9icm93c2VyL2RvbSc7XFxuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUgfSBmcm9tICd2cy9iYXNlL2NvbW1vbi9saWZlY3ljbGUnO1xcbmltcG9ydCB7IENvZGVFZGl0b3JXaWRnZXQgfSBmcm9tICd2cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvcldpZGdldCc7XFxuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAndnMvZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucyc7XFxuaW1wb3J0IHsgYXV0b3J1biwgSVJlYWRlciwgb2JzZXJ2YWJsZUZyb21FdmVudCwgT2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAndnMvd29ya2JlbmNoL2NvbnRyaWIvYXVkaW9DdWVzL2Jyb3dzZXIvb2JzZXJ2YWJsZSc7XFxuaW1wb3J0IHsgTGluZVJhbmdlIH0gZnJvbSAndnMvd29ya2JlbmNoL2NvbnRyaWIvbWVyZ2VFZGl0b3IvYnJvd3Nlci9tb2RlbC9saW5lUmFuZ2UnO1xcblwiLFxuXHRcdFx0XHRcImlucHV0MVwiOiBcImltcG9ydCB7IGggfSBmcm9tICd2cy9iYXNlL2Jyb3dzZXIvZG9tJztcXG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSB9IGZyb20gJ3ZzL2Jhc2UvY29tbW9uL2xpZmVjeWNsZSc7XFxuaW1wb3J0IHsgb2JzZXJ2YWJsZVNpZ25hbEZyb21FdmVudCB9IGZyb20gJ3ZzL2Jhc2UvY29tbW9uL29ic2VydmFibGUnO1xcbmltcG9ydCB7IENvZGVFZGl0b3JXaWRnZXQgfSBmcm9tICd2cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvcldpZGdldCc7XFxuaW1wb3J0IHsgYXV0b3J1biwgSVJlYWRlciwgb2JzZXJ2YWJsZUZyb21FdmVudCB9IGZyb20gJ3ZzL3dvcmtiZW5jaC9jb250cmliL2F1ZGlvQ3Vlcy9icm93c2VyL29ic2VydmFibGUnO1xcbmltcG9ydCB7IExpbmVSYW5nZSB9IGZyb20gJ3ZzL3dvcmtiZW5jaC9jb250cmliL21lcmdlRWRpdG9yL2Jyb3dzZXIvbW9kZWwvbGluZVJhbmdlJztcXG5cIixcblx0XHRcdFx0XCJpbnB1dDJcIjogXCJpbXBvcnQgeyBoIH0gZnJvbSAndnMvYmFzZS9icm93c2VyL2RvbSc7XFxuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUgfSBmcm9tICd2cy9iYXNlL2NvbW1vbi9saWZlY3ljbGUnO1xcbmltcG9ydCB7IENvZGVFZGl0b3JXaWRnZXQgfSBmcm9tICd2cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvcldpZGdldCc7XFxuaW1wb3J0IHsgYXV0b3J1biwgSVJlYWRlciwgb2JzZXJ2YWJsZUZyb21FdmVudCwgT2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAndnMvd29ya2JlbmNoL2NvbnRyaWIvYXVkaW9DdWVzL2Jyb3dzZXIvb2JzZXJ2YWJsZSc7XFxuaW1wb3J0IHsgTGluZVJhbmdlIH0gZnJvbSAndnMvd29ya2JlbmNoL2NvbnRyaWIvbWVyZ2VFZGl0b3IvYnJvd3Nlci9tb2RlbC9saW5lUmFuZ2UnO1xcblwiLFxuXHRcdFx0XHRcInJlc3VsdFwiOiBcImltcG9ydCB7IGggfSBmcm9tICd2cy9iYXNlL2Jyb3dzZXIvZG9tJztcXHJcXG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSB9IGZyb20gJ3ZzL2Jhc2UvY29tbW9uL2xpZmVjeWNsZSc7XFxyXFxuaW1wb3J0IHsgb2JzZXJ2YWJsZVNpZ25hbEZyb21FdmVudCB9IGZyb20gJ3ZzL2Jhc2UvY29tbW9uL29ic2VydmFibGUnO1xcclxcbmltcG9ydCB7IENvZGVFZGl0b3JXaWRnZXQgfSBmcm9tICd2cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvcldpZGdldCc7XFxyXFxuPDw8PDw8PCBVcGRhdGVkIHVwc3RyZWFtXFxyXFxuaW1wb3J0IHsgYXV0b3J1biwgSVJlYWRlciwgb2JzZXJ2YWJsZUZyb21FdmVudCwgT2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAndnMvd29ya2JlbmNoL2NvbnRyaWIvYXVkaW9DdWVzL2Jyb3dzZXIvb2JzZXJ2YWJsZSc7XFxyXFxuPT09PT09PVxcclxcbmltcG9ydCB7IGF1dG9ydW4sIElSZWFkZXIsIG9ic2VydmFibGVGcm9tRXZlbnQgfSBmcm9tICd2cy93b3JrYmVuY2gvY29udHJpYi9hdWRpb0N1ZXMvYnJvd3Nlci9vYnNlcnZhYmxlJztcXHJcXG4+Pj4+Pj4+IFN0YXNoZWQgY2hhbmdlc1xcclxcbmltcG9ydCB7IExpbmVSYW5nZSB9IGZyb20gJ3ZzL3dvcmtiZW5jaC9jb250cmliL21lcmdlRWRpdG9yL2Jyb3dzZXIvbW9kZWwvbGluZVJhbmdlJztcXHJcXG5cIlxuXHRcdFx0fSxcblx0XHRcdG1vZGVsID0+IHtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXRQcm9qZWN0aW9ucygpLCB7XG5cdFx0XHRcdFx0YmFzZTogW1xuXHRcdFx0XHRcdFx0XCJpbXBvcnQgeyBoIH0gZnJvbSAndnMvYmFzZS9icm93c2VyL2RvbSc7XCIsXG5cdFx0XHRcdFx0XHRcImltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAndnMvYmFzZS9jb21tb24vbGlmZWN5Y2xlJztcIixcblx0XHRcdFx0XHRcdFwiXHUyN0U2XHUyN0U3XHUyMDgwaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJ3ZzL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yV2lkZ2V0JztcIixcblx0XHRcdFx0XHRcdFwiXHUyN0U2aW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAndnMvZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucyc7XCIsXG5cdFx0XHRcdFx0XHRcImltcG9ydCB7IGF1dG9ydW4sIElSZWFkZXIsIG9ic2VydmFibGVGcm9tRXZlbnQsIE9ic2VydmFibGVWYWx1ZSB9IGZyb20gJ3ZzL3dvcmtiZW5jaC9jb250cmliL2F1ZGlvQ3Vlcy9icm93c2VyL29ic2VydmFibGUnO1wiLFxuXHRcdFx0XHRcdFx0XCJcdTI3RTdcdTIwODFpbXBvcnQgeyBMaW5lUmFuZ2UgfSBmcm9tICd2cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL21vZGVsL2xpbmVSYW5nZSc7XCIsXG5cdFx0XHRcdFx0XHQnJyxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdGlucHV0MTogW1xuXHRcdFx0XHRcdFx0XCJpbXBvcnQgeyBoIH0gZnJvbSAndnMvYmFzZS9icm93c2VyL2RvbSc7XCIsXG5cdFx0XHRcdFx0XHRcImltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAndnMvYmFzZS9jb21tb24vbGlmZWN5Y2xlJztcIixcblx0XHRcdFx0XHRcdFwiXHUyN0U2aW1wb3J0IHsgb2JzZXJ2YWJsZVNpZ25hbEZyb21FdmVudCB9IGZyb20gJ3ZzL2Jhc2UvY29tbW9uL29ic2VydmFibGUnO1wiLFxuXHRcdFx0XHRcdFx0XCJcdTI3RTdcdTIwODBpbXBvcnQgeyBDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAndnMvZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3JXaWRnZXQnO1wiLFxuXHRcdFx0XHRcdFx0XCJcdTI3RTZpbXBvcnQgeyBhdXRvcnVuLCBJUmVhZGVyLCBvYnNlcnZhYmxlRnJvbUV2ZW50IH0gZnJvbSAndnMvd29ya2JlbmNoL2NvbnRyaWIvYXVkaW9DdWVzL2Jyb3dzZXIvb2JzZXJ2YWJsZSc7XCIsXG5cdFx0XHRcdFx0XHRcIlx1MjdFN1x1MjA4MWltcG9ydCB7IExpbmVSYW5nZSB9IGZyb20gJ3ZzL3dvcmtiZW5jaC9jb250cmliL21lcmdlRWRpdG9yL2Jyb3dzZXIvbW9kZWwvbGluZVJhbmdlJztcIixcblx0XHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0aW5wdXQyOiBbXG5cdFx0XHRcdFx0XHRcImltcG9ydCB7IGggfSBmcm9tICd2cy9iYXNlL2Jyb3dzZXIvZG9tJztcIixcblx0XHRcdFx0XHRcdFwiaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUgfSBmcm9tICd2cy9iYXNlL2NvbW1vbi9saWZlY3ljbGUnO1wiLFxuXHRcdFx0XHRcdFx0XCJcdTI3RTZcdTI3RTdcdTIwODBpbXBvcnQgeyBDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAndnMvZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3JXaWRnZXQnO1wiLFxuXHRcdFx0XHRcdFx0XCJcdTI3RTZpbXBvcnQgeyBhdXRvcnVuLCBJUmVhZGVyLCBvYnNlcnZhYmxlRnJvbUV2ZW50LCBPYnNlcnZhYmxlVmFsdWUgfSBmcm9tICd2cy93b3JrYmVuY2gvY29udHJpYi9hdWRpb0N1ZXMvYnJvd3Nlci9vYnNlcnZhYmxlJztcIixcblx0XHRcdFx0XHRcdFwiXHUyN0U3XHUyMDgxaW1wb3J0IHsgTGluZVJhbmdlIH0gZnJvbSAndnMvd29ya2JlbmNoL2NvbnRyaWIvbWVyZ2VFZGl0b3IvYnJvd3Nlci9tb2RlbC9saW5lUmFuZ2UnO1wiLFxuXHRcdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRyZXN1bHQ6IFtcblx0XHRcdFx0XHRcdFwiaW1wb3J0IHsgaCB9IGZyb20gJ3ZzL2Jhc2UvYnJvd3Nlci9kb20nO1wiLFxuXHRcdFx0XHRcdFx0XCJpbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSB9IGZyb20gJ3ZzL2Jhc2UvY29tbW9uL2xpZmVjeWNsZSc7XCIsXG5cdFx0XHRcdFx0XHRcIlx1MjdFNmltcG9ydCB7IG9ic2VydmFibGVTaWduYWxGcm9tRXZlbnQgfSBmcm9tICd2cy9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlJztcIixcblx0XHRcdFx0XHRcdFwiXHUyN0U3ezFcdTI3MTN9XHUyMDgwaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJ3ZzL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yV2lkZ2V0JztcIixcblx0XHRcdFx0XHRcdCdcdTI3RTY8PDw8PDw8IFVwZGF0ZWQgdXBzdHJlYW0nLFxuXHRcdFx0XHRcdFx0XCJpbXBvcnQgeyBhdXRvcnVuLCBJUmVhZGVyLCBvYnNlcnZhYmxlRnJvbUV2ZW50LCBPYnNlcnZhYmxlVmFsdWUgfSBmcm9tICd2cy93b3JrYmVuY2gvY29udHJpYi9hdWRpb0N1ZXMvYnJvd3Nlci9vYnNlcnZhYmxlJztcIixcblx0XHRcdFx0XHRcdCc9PT09PT09Jyxcblx0XHRcdFx0XHRcdFwiaW1wb3J0IHsgYXV0b3J1biwgSVJlYWRlciwgb2JzZXJ2YWJsZUZyb21FdmVudCB9IGZyb20gJ3ZzL3dvcmtiZW5jaC9jb250cmliL2F1ZGlvQ3Vlcy9icm93c2VyL29ic2VydmFibGUnO1wiLFxuXHRcdFx0XHRcdFx0Jz4+Pj4+Pj4gU3Rhc2hlZCBjaGFuZ2VzJyxcblx0XHRcdFx0XHRcdFwiXHUyN0U3e3VucmVjb2duaXplZH1cdTIwODFpbXBvcnQgeyBMaW5lUmFuZ2UgfSBmcm9tICd2cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL21vZGVsL2xpbmVSYW5nZSc7XCIsXG5cdFx0XHRcdFx0XHQnJyxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdhdXRvLXNvbHZlIGVxdWFsIGVkaXRzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RNZXJnZU1vZGVsKFxuXHRcdFx0e1xuXHRcdFx0XHRcImxhbmd1YWdlSWRcIjogXCJqYXZhc2NyaXB0XCIsXG5cdFx0XHRcdFwiYmFzZVwiOiBcImNvbnN0IHsgcmVhZEZpbGVTeW5jIH0gPSByZXF1aXJlKCdmcycpO1xcblxcbmxldCBwYXRocyA9IHByb2Nlc3MuYXJndi5zbGljZSgyKTtcXG5tYWluKHBhdGhzKTtcXG5cXG5mdW5jdGlvbiBtYWluKHBhdGhzKSB7XFxuICAgIC8vIHByaW50IHRoZSB3ZWxjb21lIG1lc3NhZ2VcXG4gICAgcHJpbnRNZXNzYWdlKCk7XFxuXFxuICAgIGxldCBkYXRhID0gZ2V0TGluZUNvdW50SW5mbyhwYXRocyk7XFxuICAgIGNvbnNvbGUubG9nKFxcXCJMaW5lczogXFxcIiArIGRhdGEudG90YWxMaW5lQ291bnQpO1xcbn1cXG5cXG4vKipcXG4gKiBQcmludHMgdGhlIHdlbGNvbWUgbWVzc2FnZVxcbiovXFxuZnVuY3Rpb24gcHJpbnRNZXNzYWdlKCkge1xcbiAgICBjb25zb2xlLmxvZyhcXFwiV2VsY29tZSBUbyBMaW5lIENvdW50ZXJcXFwiKTtcXG59XFxuXFxuLyoqXFxuICogQHBhcmFtIHtzdHJpbmdbXX0gcGF0aHNcXG4qL1xcbmZ1bmN0aW9uIGdldExpbmVDb3VudEluZm8ocGF0aHMpIHtcXG4gICAgbGV0IGxpbmVDb3VudHMgPSBwYXRocy5tYXAocGF0aCA9PiAoeyBwYXRoLCBjb3VudDogZ2V0TGluZXNMZW5ndGgocmVhZEZpbGVTeW5jKHBhdGgsICd1dGY4JykpIH0pKTtcXG4gICAgcmV0dXJuIHtcXG4gICAgICAgIHRvdGFsTGluZUNvdW50OiBsaW5lQ291bnRzLnJlZHVjZSgoYWNjLCB7IGNvdW50IH0pID0+IGFjYyArIGNvdW50LCAwKSxcXG4gICAgICAgIGxpbmVDb3VudHMsXFxuICAgIH07XFxufVxcblxcbi8qKlxcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHJcXG4gKi9cXG5mdW5jdGlvbiBnZXRMaW5lc0xlbmd0aChzdHIpIHtcXG4gICAgcmV0dXJuIHN0ci5zcGxpdCgnXFxcXG4nKS5sZW5ndGg7XFxufVxcblwiLFxuXHRcdFx0XHRcImlucHV0MVwiOiBcImNvbnN0IHsgcmVhZEZpbGVTeW5jIH0gPSByZXF1aXJlKCdmcycpO1xcblxcbmxldCBwYXRocyA9IHByb2Nlc3MuYXJndi5zbGljZSgyKTtcXG5tYWluKHBhdGhzKTtcXG5cXG5mdW5jdGlvbiBtYWluKHBhdGhzKSB7XFxuICAgIC8vIHByaW50IHRoZSB3ZWxjb21lIG1lc3NhZ2VcXG4gICAgcHJpbnRNZXNzYWdlKCk7XFxuXFxuICAgIGNvbnN0IGRhdGEgPSBnZXRMaW5lQ291bnRJbmZvKHBhdGhzKTtcXG4gICAgY29uc29sZS5sb2coXFxcIkxpbmVzOiBcXFwiICsgZGF0YS50b3RhbExpbmVDb3VudCk7XFxufVxcblxcbmZ1bmN0aW9uIHByaW50TWVzc2FnZSgpIHtcXG4gICAgY29uc29sZS5sb2coXFxcIldlbGNvbWUgVG8gTGluZSBDb3VudGVyXFxcIik7XFxufVxcblxcbi8qKlxcbiAqIEBwYXJhbSB7c3RyaW5nW119IHBhdGhzXFxuKi9cXG5mdW5jdGlvbiBnZXRMaW5lQ291bnRJbmZvKHBhdGhzKSB7XFxuICAgIGxldCBsaW5lQ291bnRzID0gcGF0aHMubWFwKHBhdGggPT4gKHsgcGF0aCwgY291bnQ6IGdldExpbmVzTGVuZ3RoKHJlYWRGaWxlU3luYyhwYXRoLCAndXRmOCcpKSB9KSk7XFxuICAgIHJldHVybiB7XFxuICAgICAgICB0b3RhbExpbmVDb3VudDogbGluZUNvdW50cy5yZWR1Y2UoKGFjYywgeyBjb3VudCB9KSA9PiBhY2MgKyBjb3VudCwgMCksXFxuICAgICAgICBsaW5lQ291bnRzLFxcbiAgICB9O1xcbn1cXG5cXG4vKipcXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyXFxuICovXFxuZnVuY3Rpb24gZ2V0TGluZXNMZW5ndGgoc3RyKSB7XFxuICAgIHJldHVybiBzdHIuc3BsaXQoJ1xcXFxuJykubGVuZ3RoO1xcbn1cXG5cIixcblx0XHRcdFx0XCJpbnB1dDJcIjogXCJjb25zdCB7IHJlYWRGaWxlU3luYyB9ID0gcmVxdWlyZSgnZnMnKTtcXG5cXG5sZXQgcGF0aHMgPSBwcm9jZXNzLmFyZ3Yuc2xpY2UoMik7XFxucnVuKHBhdGhzKTtcXG5cXG5mdW5jdGlvbiBydW4ocGF0aHMpIHtcXG4gICAgLy8gcHJpbnQgdGhlIHdlbGNvbWUgbWVzc2FnZVxcbiAgICBwcmludE1lc3NhZ2UoKTtcXG5cXG4gICAgY29uc3QgZGF0YSA9IGdldExpbmVDb3VudEluZm8ocGF0aHMpO1xcbiAgICBjb25zb2xlLmxvZyhcXFwiTGluZXM6IFxcXCIgKyBkYXRhLnRvdGFsTGluZUNvdW50KTtcXG59XFxuXFxuZnVuY3Rpb24gcHJpbnRNZXNzYWdlKCkge1xcbiAgICBjb25zb2xlLmxvZyhcXFwiV2VsY29tZSBUbyBMaW5lIENvdW50ZXJcXFwiKTtcXG59XFxuXFxuLyoqXFxuICogQHBhcmFtIHtzdHJpbmdbXX0gcGF0aHNcXG4qL1xcbmZ1bmN0aW9uIGdldExpbmVDb3VudEluZm8ocGF0aHMpIHtcXG4gICAgbGV0IGxpbmVDb3VudHMgPSBwYXRocy5tYXAocGF0aCA9PiAoeyBwYXRoLCBjb3VudDogZ2V0TGluZXNMZW5ndGgocmVhZEZpbGVTeW5jKHBhdGgsICd1dGY4JykpIH0pKTtcXG4gICAgcmV0dXJuIHtcXG4gICAgICAgIHRvdGFsTGluZUNvdW50OiBsaW5lQ291bnRzLnJlZHVjZSgoYWNjLCB7IGNvdW50IH0pID0+IGFjYyArIGNvdW50LCAwKSxcXG4gICAgICAgIGxpbmVDb3VudHMsXFxuICAgIH07XFxufVxcblxcbi8qKlxcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHJcXG4gKi9cXG5mdW5jdGlvbiBnZXRMaW5lc0xlbmd0aChzdHIpIHtcXG4gICAgcmV0dXJuIHN0ci5zcGxpdCgnXFxcXG4nKS5sZW5ndGg7XFxufVxcblwiLFxuXHRcdFx0XHRcInJlc3VsdFwiOiBcIjw8PDw8PDwgdWlhZVxcbj4+Pj4+Pj4gU3Rhc2hlZCBjaGFuZ2VzXCIsXG5cdFx0XHRcdHJlc2V0UmVzdWx0OiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdGFzeW5jIG1vZGVsID0+IHtcblx0XHRcdFx0YXdhaXQgbW9kZWwubWVyZ2VNb2RlbC5yZXNldCgpO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0UmVzdWx0KCksIGBjb25zdCB7IHJlYWRGaWxlU3luYyB9ID0gcmVxdWlyZSgnZnMnKTtcXG5cXG5sZXQgcGF0aHMgPSBwcm9jZXNzLmFyZ3Yuc2xpY2UoMik7XFxucnVuKHBhdGhzKTtcXG5cXG5mdW5jdGlvbiBydW4ocGF0aHMpIHtcXG4gICAgLy8gcHJpbnQgdGhlIHdlbGNvbWUgbWVzc2FnZVxcbiAgICBwcmludE1lc3NhZ2UoKTtcXG5cXG4gICAgY29uc3QgZGF0YSA9IGdldExpbmVDb3VudEluZm8ocGF0aHMpO1xcbiAgICBjb25zb2xlLmxvZyhcIkxpbmVzOiBcIiArIGRhdGEudG90YWxMaW5lQ291bnQpO1xcbn1cXG5cXG5mdW5jdGlvbiBwcmludE1lc3NhZ2UoKSB7XFxuICAgIGNvbnNvbGUubG9nKFwiV2VsY29tZSBUbyBMaW5lIENvdW50ZXJcIik7XFxufVxcblxcbi8qKlxcbiAqIEBwYXJhbSB7c3RyaW5nW119IHBhdGhzXFxuKi9cXG5mdW5jdGlvbiBnZXRMaW5lQ291bnRJbmZvKHBhdGhzKSB7XFxuICAgIGxldCBsaW5lQ291bnRzID0gcGF0aHMubWFwKHBhdGggPT4gKHsgcGF0aCwgY291bnQ6IGdldExpbmVzTGVuZ3RoKHJlYWRGaWxlU3luYyhwYXRoLCAndXRmOCcpKSB9KSk7XFxuICAgIHJldHVybiB7XFxuICAgICAgICB0b3RhbExpbmVDb3VudDogbGluZUNvdW50cy5yZWR1Y2UoKGFjYywgeyBjb3VudCB9KSA9PiBhY2MgKyBjb3VudCwgMCksXFxuICAgICAgICBsaW5lQ291bnRzLFxcbiAgICB9O1xcbn1cXG5cXG4vKipcXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyXFxuICovXFxuZnVuY3Rpb24gZ2V0TGluZXNMZW5ndGgoc3RyKSB7XFxuICAgIHJldHVybiBzdHIuc3BsaXQoJ1xcXFxuJykubGVuZ3RoO1xcbn1cXG5gKTtcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcbn0pO1xuXG5hc3luYyBmdW5jdGlvbiB0ZXN0TWVyZ2VNb2RlbChcblx0b3B0aW9uczogTWVyZ2VNb2RlbE9wdGlvbnMsXG5cdGZuOiAobW9kZWw6IE1lcmdlTW9kZWxJbnRlcmZhY2UpID0+IHZvaWRcbik6IFByb21pc2U8dm9pZD4ge1xuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0Y29uc3QgbW9kZWxJbnRlcmZhY2UgPSBkaXNwb3NhYmxlcy5hZGQoXG5cdFx0bmV3IE1lcmdlTW9kZWxJbnRlcmZhY2Uob3B0aW9ucywgY3JlYXRlTW9kZWxTZXJ2aWNlcyhkaXNwb3NhYmxlcykpXG5cdCk7XG5cdGF3YWl0IG1vZGVsSW50ZXJmYWNlLm1lcmdlTW9kZWwub25Jbml0aWFsaXplZDtcblx0YXdhaXQgZm4obW9kZWxJbnRlcmZhY2UpO1xuXHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG59XG5cbmludGVyZmFjZSBNZXJnZU1vZGVsT3B0aW9ucyB7XG5cdGxhbmd1YWdlSWQ6IHN0cmluZztcblx0aW5wdXQxOiBzdHJpbmc7XG5cdGlucHV0Mjogc3RyaW5nO1xuXHRiYXNlOiBzdHJpbmc7XG5cdHJlc3VsdDogc3RyaW5nO1xuXHRyZXNldFJlc3VsdD86IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIHRvU21hbGxOdW1iZXJzRGVjKHZhbHVlOiBudW1iZXIpOiBzdHJpbmcge1xuXHRjb25zdCBzbWFsbE51bWJlcnMgPSBbJ1x1MjA4MCcsICdcdTIwODEnLCAnXHUyMDgyJywgJ1x1MjA4MycsICdcdTIwODQnLCAnXHUyMDg1JywgJ1x1MjA4NicsICdcdTIwODcnLCAnXHUyMDg4JywgJ1x1MjA4OSddO1xuXHRyZXR1cm4gdmFsdWUudG9TdHJpbmcoKS5zcGxpdCgnJykubWFwKGMgPT4gc21hbGxOdW1iZXJzW3BhcnNlSW50KGMpXSkuam9pbignJyk7XG59XG5cbmNsYXNzIE1lcmdlTW9kZWxJbnRlcmZhY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHVibGljIHJlYWRvbmx5IG1lcmdlTW9kZWw6IE1lcmdlRWRpdG9yTW9kZWw7XG5cblx0Y29uc3RydWN0b3Iob3B0aW9uczogTWVyZ2VNb2RlbE9wdGlvbnMsIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpIHtcblx0XHRzdXBlcigpO1xuXHRcdGNvbnN0IGlucHV0MVRleHRNb2RlbCA9IHRoaXMuX3JlZ2lzdGVyKGNyZWF0ZVRleHRNb2RlbChvcHRpb25zLmlucHV0MSwgb3B0aW9ucy5sYW5ndWFnZUlkKSk7XG5cdFx0Y29uc3QgaW5wdXQyVGV4dE1vZGVsID0gdGhpcy5fcmVnaXN0ZXIoY3JlYXRlVGV4dE1vZGVsKG9wdGlvbnMuaW5wdXQyLCBvcHRpb25zLmxhbmd1YWdlSWQpKTtcblx0XHRjb25zdCBiYXNlVGV4dE1vZGVsID0gdGhpcy5fcmVnaXN0ZXIoY3JlYXRlVGV4dE1vZGVsKG9wdGlvbnMuYmFzZSwgb3B0aW9ucy5sYW5ndWFnZUlkKSk7XG5cdFx0Y29uc3QgcmVzdWx0VGV4dE1vZGVsID0gdGhpcy5fcmVnaXN0ZXIoY3JlYXRlVGV4dE1vZGVsKG9wdGlvbnMucmVzdWx0LCBvcHRpb25zLmxhbmd1YWdlSWQpKTtcblxuXHRcdGNvbnN0IGRpZmZDb21wdXRlcjogSU1lcmdlRGlmZkNvbXB1dGVyID0ge1xuXHRcdFx0YXN5bmMgY29tcHV0ZURpZmYodGV4dE1vZGVsMTogSVRleHRNb2RlbCwgdGV4dE1vZGVsMjogSVRleHRNb2RlbCwgcmVhZGVyOiBJUmVhZGVyKTogUHJvbWlzZTxJTWVyZ2VEaWZmQ29tcHV0ZXJSZXN1bHQ+IHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgbGluZXNEaWZmQ29tcHV0ZXJzLmdldExlZ2FjeSgpLmNvbXB1dGVEaWZmKFxuXHRcdFx0XHRcdHRleHRNb2RlbDEuZ2V0TGluZXNDb250ZW50KCksXG5cdFx0XHRcdFx0dGV4dE1vZGVsMi5nZXRMaW5lc0NvbnRlbnQoKSxcblx0XHRcdFx0XHR7IGlnbm9yZVRyaW1XaGl0ZXNwYWNlOiBmYWxzZSwgbWF4Q29tcHV0YXRpb25UaW1lTXM6IDEwMDAwLCBjb21wdXRlTW92ZXM6IGZhbHNlIH1cblx0XHRcdFx0KTtcblx0XHRcdFx0Y29uc3QgY2hhbmdlcyA9IHJlc3VsdC5jaGFuZ2VzLm1hcChjID0+XG5cdFx0XHRcdFx0bmV3IERldGFpbGVkTGluZVJhbmdlTWFwcGluZyhcblx0XHRcdFx0XHRcdHRvTGluZVJhbmdlKGMub3JpZ2luYWwpLFxuXHRcdFx0XHRcdFx0dGV4dE1vZGVsMSxcblx0XHRcdFx0XHRcdHRvTGluZVJhbmdlKGMubW9kaWZpZWQpLFxuXHRcdFx0XHRcdFx0dGV4dE1vZGVsMixcblx0XHRcdFx0XHRcdGMuaW5uZXJDaGFuZ2VzPy5tYXAoaWMgPT4gdG9SYW5nZU1hcHBpbmcoaWMpKS5maWx0ZXIoaXNEZWZpbmVkKVxuXHRcdFx0XHRcdClcblx0XHRcdFx0KTtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRkaWZmczogY2hhbmdlc1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0aGlzLm1lcmdlTW9kZWwgPSB0aGlzLl9yZWdpc3RlcihpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZXJnZUVkaXRvck1vZGVsLFxuXHRcdFx0YmFzZVRleHRNb2RlbCxcblx0XHRcdHtcblx0XHRcdFx0dGV4dE1vZGVsOiBpbnB1dDFUZXh0TW9kZWwsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAnJyxcblx0XHRcdFx0ZGV0YWlsOiAnJyxcblx0XHRcdFx0dGl0bGU6ICcnLFxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0dGV4dE1vZGVsOiBpbnB1dDJUZXh0TW9kZWwsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAnJyxcblx0XHRcdFx0ZGV0YWlsOiAnJyxcblx0XHRcdFx0dGl0bGU6ICcnLFxuXHRcdFx0fSxcblx0XHRcdHJlc3VsdFRleHRNb2RlbCxcblx0XHRcdGRpZmZDb21wdXRlcixcblx0XHRcdHtcblx0XHRcdFx0cmVzZXRSZXN1bHQ6IG9wdGlvbnMucmVzZXRSZXN1bHQgfHwgZmFsc2Vcblx0XHRcdH0sXG5cdFx0XHRuZXcgTWVyZ2VFZGl0b3JUZWxlbWV0cnkoTnVsbFRlbGVtZXRyeVNlcnZpY2UpLFxuXHRcdCkpO1xuXHR9XG5cblx0Z2V0UHJvamVjdGlvbnMoKTogdW5rbm93biB7XG5cdFx0aW50ZXJmYWNlIExhYmVsZWRSYW5nZSB7XG5cdFx0XHRyYW5nZTogUmFuZ2U7XG5cdFx0XHRsYWJlbDogc3RyaW5nO1xuXHRcdH1cblx0XHRmdW5jdGlvbiBhcHBseVJhbmdlcyh0ZXh0TW9kZWw6IElUZXh0TW9kZWwsIHJhbmdlczogTGFiZWxlZFJhbmdlW10pOiB2b2lkIHtcblx0XHRcdHRleHRNb2RlbC5hcHBseUVkaXRzKHJhbmdlcy5tYXAoKHsgcmFuZ2UsIGxhYmVsIH0pID0+ICh7XG5cdFx0XHRcdHJhbmdlOiByYW5nZSxcblx0XHRcdFx0dGV4dDogYFx1MjdFNiR7dGV4dE1vZGVsLmdldFZhbHVlSW5SYW5nZShyYW5nZSl9XHUyN0U3JHtsYWJlbH1gLFxuXHRcdFx0fSkpKTtcblx0XHR9XG5cdFx0Y29uc3QgYmFzZVJhbmdlcyA9IHRoaXMubWVyZ2VNb2RlbC5tb2RpZmllZEJhc2VSYW5nZXMuZ2V0KCk7XG5cblx0XHRjb25zdCBiYXNlVGV4dE1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKHRoaXMubWVyZ2VNb2RlbC5iYXNlLmdldFZhbHVlKCkpO1xuXHRcdGFwcGx5UmFuZ2VzKFxuXHRcdFx0YmFzZVRleHRNb2RlbCxcblx0XHRcdGJhc2VSYW5nZXMubWFwPExhYmVsZWRSYW5nZT4oKHIsIGlkeCkgPT4gKHtcblx0XHRcdFx0cmFuZ2U6IHIuYmFzZVJhbmdlLnRvUmFuZ2UoKSxcblx0XHRcdFx0bGFiZWw6IHRvU21hbGxOdW1iZXJzRGVjKGlkeCksXG5cdFx0XHR9KSlcblx0XHQpO1xuXG5cdFx0Y29uc3QgaW5wdXQxVGV4dE1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKHRoaXMubWVyZ2VNb2RlbC5pbnB1dDEudGV4dE1vZGVsLmdldFZhbHVlKCkpO1xuXHRcdGFwcGx5UmFuZ2VzKFxuXHRcdFx0aW5wdXQxVGV4dE1vZGVsLFxuXHRcdFx0YmFzZVJhbmdlcy5tYXA8TGFiZWxlZFJhbmdlPigociwgaWR4KSA9PiAoe1xuXHRcdFx0XHRyYW5nZTogci5pbnB1dDFSYW5nZS50b1JhbmdlKCksXG5cdFx0XHRcdGxhYmVsOiB0b1NtYWxsTnVtYmVyc0RlYyhpZHgpLFxuXHRcdFx0fSkpXG5cdFx0KTtcblxuXHRcdGNvbnN0IGlucHV0MlRleHRNb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCh0aGlzLm1lcmdlTW9kZWwuaW5wdXQyLnRleHRNb2RlbC5nZXRWYWx1ZSgpKTtcblx0XHRhcHBseVJhbmdlcyhcblx0XHRcdGlucHV0MlRleHRNb2RlbCxcblx0XHRcdGJhc2VSYW5nZXMubWFwPExhYmVsZWRSYW5nZT4oKHIsIGlkeCkgPT4gKHtcblx0XHRcdFx0cmFuZ2U6IHIuaW5wdXQyUmFuZ2UudG9SYW5nZSgpLFxuXHRcdFx0XHRsYWJlbDogdG9TbWFsbE51bWJlcnNEZWMoaWR4KSxcblx0XHRcdH0pKVxuXHRcdCk7XG5cblx0XHRjb25zdCByZXN1bHRUZXh0TW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwodGhpcy5tZXJnZU1vZGVsLnJlc3VsdFRleHRNb2RlbC5nZXRWYWx1ZSgpKTtcblx0XHRhcHBseVJhbmdlcyhcblx0XHRcdHJlc3VsdFRleHRNb2RlbCxcblx0XHRcdGJhc2VSYW5nZXMubWFwPExhYmVsZWRSYW5nZT4oKHIsIGlkeCkgPT4gKHtcblx0XHRcdFx0cmFuZ2U6IHRoaXMubWVyZ2VNb2RlbC5nZXRMaW5lUmFuZ2VJblJlc3VsdChyLmJhc2VSYW5nZSkudG9SYW5nZSgpLFxuXHRcdFx0XHRsYWJlbDogYHske3RoaXMubWVyZ2VNb2RlbC5nZXRTdGF0ZShyKS5nZXQoKX19JHt0b1NtYWxsTnVtYmVyc0RlYyhpZHgpfWAsXG5cdFx0XHR9KSlcblx0XHQpO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0ge1xuXHRcdFx0YmFzZTogYmFzZVRleHRNb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKS5zcGxpdCgnXFxuJyksXG5cdFx0XHRpbnB1dDE6IGlucHV0MVRleHRNb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKS5zcGxpdCgnXFxuJyksXG5cdFx0XHRpbnB1dDI6IGlucHV0MlRleHRNb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKS5zcGxpdCgnXFxuJyksXG5cdFx0XHRyZXN1bHQ6IHJlc3VsdFRleHRNb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKS5zcGxpdCgnXFxuJyksXG5cdFx0fTtcblx0XHRiYXNlVGV4dE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRpbnB1dDFUZXh0TW9kZWwuZGlzcG9zZSgpO1xuXHRcdGlucHV0MlRleHRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0cmVzdWx0VGV4dE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0dG9nZ2xlQ29uZmxpY3QoY29uZmxpY3RJZHg6IG51bWJlciwgaW5wdXROdW1iZXI6IDEgfCAyKTogdm9pZCB7XG5cdFx0Y29uc3QgYmFzZVJhbmdlID0gdGhpcy5tZXJnZU1vZGVsLm1vZGlmaWVkQmFzZVJhbmdlcy5nZXQoKVtjb25mbGljdElkeF07XG5cdFx0aWYgKCFiYXNlUmFuZ2UpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcigpO1xuXHRcdH1cblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMubWVyZ2VNb2RlbC5nZXRTdGF0ZShiYXNlUmFuZ2UpLmdldCgpO1xuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdHRoaXMubWVyZ2VNb2RlbC5zZXRTdGF0ZShiYXNlUmFuZ2UsIHN0YXRlLnRvZ2dsZShpbnB1dE51bWJlciksIHRydWUsIHR4KTtcblx0XHR9KTtcblx0fVxuXG5cdGdldFJlc3VsdCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLm1lcmdl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UUFDUixVQUFVO0FBQUEsUUFDVixVQUFVO0FBQUEsUUFDVixVQUFVO0FBQUEsTUFDWDtBQUFBLE1BQ0EsV0FBUztBQUNSLGVBQU8sZ0JBQWdCLE1BQU0sZUFBZSxHQUFHO0FBQUEsVUFDOUMsTUFBTTtBQUFBLFlBQ0w7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUNEO0FBQUEsVUFDQSxRQUFRO0FBQUEsWUFDUDtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFVBQ0Q7QUFBQSxVQUNBLFFBQVE7QUFBQSxZQUNQO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUNEO0FBQUEsVUFDQSxRQUFRO0FBQUEsWUFDUDtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUNEO0FBQUEsUUFDRCxDQUFDO0FBQUEsTUFDRjtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDBCQUEwQixZQUFZO0FBQzFDLFVBQU07QUFBQSxNQUNMO0FBQUEsUUFDQyxjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxRQUNSLFVBQVU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFB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
