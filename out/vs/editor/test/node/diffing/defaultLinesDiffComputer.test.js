import assert from "assert";
import { Range } from "../../../common/core/range.js";
import { getLineRangeMapping, RangeMapping } from "../../../common/diff/rangeMapping.js";
import { OffsetRange } from "../../../common/core/offsetRange.js";
import { LinesSliceCharSequence } from "../../../common/diff/defaultLinesDiffComputer/linesSliceCharSequence.js";
import { MyersDiffAlgorithm } from "../../../common/diff/defaultLinesDiffComputer/algorithms/myersDiffAlgorithm.js";
import "../../../common/diff/defaultLinesDiffComputer/algorithms/dynamicProgrammingDiffing.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { ArrayText } from "../../../common/core/textEdit.js";
suite("myers", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("1", () => {
    const s1 = new LinesSliceCharSequence(["hello world"], new Range(1, 1, 1, Number.MAX_SAFE_INTEGER), true);
    const s2 = new LinesSliceCharSequence(["hallo welt"], new Range(1, 1, 1, Number.MAX_SAFE_INTEGER), true);
    const a = true ? new MyersDiffAlgorithm() : new DynamicProgrammingDiffing();
    a.compute(s1, s2);
  });
});
suite("lineRangeMapping", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Simple", () => {
    assert.deepStrictEqual(
      getLineRangeMapping(
        new RangeMapping(
          new Range(2, 1, 3, 1),
          new Range(2, 1, 2, 1)
        ),
        new ArrayText([
          'const abc = "helloworld".split("");',
          "",
          ""
        ]),
        new ArrayText([
          'const asciiLower = "helloworld".split("");',
          ""
        ])
      ).toString(),
      "{[2,3)->[2,2)}"
    );
  });
  test("Empty Lines", () => {
    assert.deepStrictEqual(
      getLineRangeMapping(
        new RangeMapping(
          new Range(2, 1, 2, 1),
          new Range(2, 1, 4, 1)
        ),
        new ArrayText([
          "",
          ""
        ]),
        new ArrayText([
          "",
          "",
          "",
          ""
        ])
      ).toString(),
      "{[2,2)->[2,4)}"
    );
  });
});
suite("LinesSliceCharSequence", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const sequence = new LinesSliceCharSequence(
    [
      "line1: foo",
      "line2: fizzbuzz",
      "line3: barr",
      "line4: hello world",
      "line5: bazz"
    ],
    new Range(2, 1, 5, 1),
    true
  );
  test("translateOffset", () => {
    assert.deepStrictEqual(
      { result: OffsetRange.ofLength(sequence.length).map((offset) => sequence.translateOffset(offset).toString()) },
      {
        result: [
          "(2,1)",
          "(2,2)",
          "(2,3)",
          "(2,4)",
          "(2,5)",
          "(2,6)",
          "(2,7)",
          "(2,8)",
          "(2,9)",
          "(2,10)",
          "(2,11)",
          "(2,12)",
          "(2,13)",
          "(2,14)",
          "(2,15)",
          "(2,16)",
          "(3,1)",
          "(3,2)",
          "(3,3)",
          "(3,4)",
          "(3,5)",
          "(3,6)",
          "(3,7)",
          "(3,8)",
          "(3,9)",
          "(3,10)",
          "(3,11)",
          "(3,12)",
          "(4,1)",
          "(4,2)",
          "(4,3)",
          "(4,4)",
          "(4,5)",
          "(4,6)",
          "(4,7)",
          "(4,8)",
          "(4,9)",
          "(4,10)",
          "(4,11)",
          "(4,12)",
          "(4,13)",
          "(4,14)",
          "(4,15)",
          "(4,16)",
          "(4,17)",
          "(4,18)",
          "(4,19)"
        ]
      }
    );
  });
  test("extendToFullLines", () => {
    assert.deepStrictEqual(
      { result: sequence.getText(sequence.extendToFullLines(new OffsetRange(20, 25))) },
      { result: "line3: barr\n" }
    );
    assert.deepStrictEqual(
      { result: sequence.getText(sequence.extendToFullLines(new OffsetRange(20, 45))) },
      { result: "line3: barr\nline4: hello world\n" }
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9ub2RlL2RpZmZpbmcvZGVmYXVsdExpbmVzRGlmZkNvbXB1dGVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IGdldExpbmVSYW5nZU1hcHBpbmcsIFJhbmdlTWFwcGluZyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9kaWZmL3JhbmdlTWFwcGluZy5qcyc7XG5pbXBvcnQgeyBPZmZzZXRSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL29mZnNldFJhbmdlLmpzJztcbmltcG9ydCB7IExpbmVzU2xpY2VDaGFyU2VxdWVuY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZGlmZi9kZWZhdWx0TGluZXNEaWZmQ29tcHV0ZXIvbGluZXNTbGljZUNoYXJTZXF1ZW5jZS5qcyc7XG5pbXBvcnQgeyBNeWVyc0RpZmZBbGdvcml0aG0gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZGlmZi9kZWZhdWx0TGluZXNEaWZmQ29tcHV0ZXIvYWxnb3JpdGhtcy9teWVyc0RpZmZBbGdvcml0aG0uanMnO1xuaW1wb3J0IHsgRHluYW1pY1Byb2dyYW1taW5nRGlmZmluZyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9kaWZmL2RlZmF1bHRMaW5lc0RpZmZDb21wdXRlci9hbGdvcml0aG1zL2R5bmFtaWNQcm9ncmFtbWluZ0RpZmZpbmcuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBBcnJheVRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS90ZXh0RWRpdC5qcyc7XG5cbnN1aXRlKCdteWVycycsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnMScsICgpID0+IHtcblx0XHRjb25zdCBzMSA9IG5ldyBMaW5lc1NsaWNlQ2hhclNlcXVlbmNlKFsnaGVsbG8gd29ybGQnXSwgbmV3IFJhbmdlKDEsIDEsIDEsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSwgdHJ1ZSk7XG5cdFx0Y29uc3QgczIgPSBuZXcgTGluZXNTbGljZUNoYXJTZXF1ZW5jZShbJ2hhbGxvIHdlbHQnXSwgbmV3IFJhbmdlKDEsIDEsIDEsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSwgdHJ1ZSk7XG5cblx0XHRjb25zdCBhID0gdHJ1ZSA/IG5ldyBNeWVyc0RpZmZBbGdvcml0aG0oKSA6IG5ldyBEeW5hbWljUHJvZ3JhbW1pbmdEaWZmaW5nKCk7XG5cdFx0YS5jb21wdXRlKHMxLCBzMik7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdsaW5lUmFuZ2VNYXBwaW5nJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdTaW1wbGUnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdGdldExpbmVSYW5nZU1hcHBpbmcoXG5cdFx0XHRcdG5ldyBSYW5nZU1hcHBpbmcoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDIsIDEsIDMsIDEpLFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgyLCAxLCAyLCAxKVxuXHRcdFx0XHQpLFxuXHRcdFx0XHRuZXcgQXJyYXlUZXh0KFtcblx0XHRcdFx0XHQnY29uc3QgYWJjID0gXCJoZWxsb3dvcmxkXCIuc3BsaXQoXCJcIik7Jyxcblx0XHRcdFx0XHQnJyxcblx0XHRcdFx0XHQnJ1xuXHRcdFx0XHRdKSxcblx0XHRcdFx0bmV3IEFycmF5VGV4dChbXG5cdFx0XHRcdFx0J2NvbnN0IGFzY2lpTG93ZXIgPSBcImhlbGxvd29ybGRcIi5zcGxpdChcIlwiKTsnLFxuXHRcdFx0XHRcdCcnXG5cdFx0XHRcdF0pXG5cdFx0XHQpLnRvU3RyaW5nKCksXG5cdFx0XHRcIntbMiwzKS0+WzIsMil9XCJcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdFbXB0eSBMaW5lcycsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0Z2V0TGluZVJhbmdlTWFwcGluZyhcblx0XHRcdFx0bmV3IFJhbmdlTWFwcGluZyhcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMiwgMSwgMiwgMSksXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDIsIDEsIDQsIDEpLFxuXHRcdFx0XHQpLFxuXHRcdFx0XHRuZXcgQXJyYXlUZXh0KFtcblx0XHRcdFx0XHQnJyxcblx0XHRcdFx0XHQnJyxcblx0XHRcdFx0XSksXG5cdFx0XHRcdG5ldyBBcnJheVRleHQoW1xuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRdKVxuXHRcdFx0KS50b1N0cmluZygpLFxuXHRcdFx0XCJ7WzIsMiktPlsyLDQpfVwiXG5cdFx0KTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ0xpbmVzU2xpY2VDaGFyU2VxdWVuY2UnLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGNvbnN0IHNlcXVlbmNlID0gbmV3IExpbmVzU2xpY2VDaGFyU2VxdWVuY2UoXG5cdFx0W1xuXHRcdFx0J2xpbmUxOiBmb28nLFxuXHRcdFx0J2xpbmUyOiBmaXp6YnV6eicsXG5cdFx0XHQnbGluZTM6IGJhcnInLFxuXHRcdFx0J2xpbmU0OiBoZWxsbyB3b3JsZCcsXG5cdFx0XHQnbGluZTU6IGJhenonLFxuXHRcdF0sXG5cdFx0bmV3IFJhbmdlKDIsIDEsIDUsIDEpLCB0cnVlXG5cdCk7XG5cblx0dGVzdCgndHJhbnNsYXRlT2Zmc2V0JywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHR7IHJlc3VsdDogT2Zmc2V0UmFuZ2Uub2ZMZW5ndGgoc2VxdWVuY2UubGVuZ3RoKS5tYXAob2Zmc2V0ID0+IHNlcXVlbmNlLnRyYW5zbGF0ZU9mZnNldChvZmZzZXQpLnRvU3RyaW5nKCkpIH0sXG5cdFx0XHQoe1xuXHRcdFx0XHRyZXN1bHQ6IFtcblx0XHRcdFx0XHRcIigyLDEpXCIsIFwiKDIsMilcIiwgXCIoMiwzKVwiLCBcIigyLDQpXCIsIFwiKDIsNSlcIiwgXCIoMiw2KVwiLCBcIigyLDcpXCIsIFwiKDIsOClcIiwgXCIoMiw5KVwiLCBcIigyLDEwKVwiLCBcIigyLDExKVwiLFxuXHRcdFx0XHRcdFwiKDIsMTIpXCIsIFwiKDIsMTMpXCIsIFwiKDIsMTQpXCIsIFwiKDIsMTUpXCIsIFwiKDIsMTYpXCIsXG5cblx0XHRcdFx0XHRcIigzLDEpXCIsIFwiKDMsMilcIiwgXCIoMywzKVwiLCBcIigzLDQpXCIsIFwiKDMsNSlcIiwgXCIoMyw2KVwiLCBcIigzLDcpXCIsIFwiKDMsOClcIiwgXCIoMyw5KVwiLCBcIigzLDEwKVwiLCBcIigzLDExKVwiLCBcIigzLDEyKVwiLFxuXG5cdFx0XHRcdFx0XCIoNCwxKVwiLCBcIig0LDIpXCIsIFwiKDQsMylcIiwgXCIoNCw0KVwiLCBcIig0LDUpXCIsIFwiKDQsNilcIiwgXCIoNCw3KVwiLCBcIig0LDgpXCIsIFwiKDQsOSlcIixcblx0XHRcdFx0XHRcIig0LDEwKVwiLCBcIig0LDExKVwiLCBcIig0LDEyKVwiLCBcIig0LDEzKVwiLCBcIig0LDE0KVwiLCBcIig0LDE1KVwiLCBcIig0LDE2KVwiLCBcIig0LDE3KVwiLFxuXHRcdFx0XHRcdFwiKDQsMTgpXCIsIFwiKDQsMTkpXCJcblx0XHRcdFx0XVxuXHRcdFx0fSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdleHRlbmRUb0Z1bGxMaW5lcycsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0eyByZXN1bHQ6IHNlcXVlbmNlLmdldFRleHQoc2VxdWVuY2UuZXh0ZW5kVG9GdWxsTGluZXMobmV3IE9mZnNldFJhbmdlKDIwLCAyNSkpKSB9LFxuXHRcdFx0KHsgcmVzdWx0OiBcImxpbmUzOiBiYXJyXFxuXCIgfSlcblx0XHQpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdHsgcmVzdWx0OiBzZXF1ZW5jZS5nZXRUZXh0KHNlcXVlbmNlLmV4dGVuZFRvRnVsbExpbmVzKG5ldyBPZmZzZXRSYW5nZSgyMCwgNDUpKSkgfSxcblx0XHRcdCh7IHJlc3VsdDogXCJsaW5lMzogYmFyclxcbmxpbmU0OiBoZWxsbyB3b3JsZFxcblwiIH0pXG5cdFx0KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGFBQWE7QUFDdEIsU0FBUyxxQkFBcUIsb0JBQW9CO0FBQ2xELFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsMEJBQTBCO0FBQ25DLE9BQTBDO0FBQzFDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsaUJBQWlCO0FBRTFCLE1BQU0sU0FBUyxNQUFNO0FBQ3BCLDBD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
