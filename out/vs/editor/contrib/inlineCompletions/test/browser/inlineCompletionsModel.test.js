import assert from "assert";
import { Position } from "../../../../common/core/position.js";
import { getSecondaryEdits } from "../../browser/model/inlineCompletionsModel.js";
import { SingleTextEdit } from "../../../../common/core/textEdit.js";
import { createTextModel } from "../../../../test/common/testTextModel.js";
import { Range } from "../../../../common/core/range.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("inlineCompletionModel", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("getSecondaryEdits - basic", async function() {
    const textModel = createTextModel([
      "function fib(",
      "function fib("
    ].join("\n"));
    const positions = [
      new Position(1, 14),
      new Position(2, 14)
    ];
    const primaryEdit = new SingleTextEdit(new Range(1, 1, 1, 14), "function fib() {");
    const secondaryEdits = getSecondaryEdits(textModel, positions, primaryEdit);
    assert.deepStrictEqual(secondaryEdits, [new SingleTextEdit(
      new Range(2, 14, 2, 14),
      ") {"
    )]);
    textModel.dispose();
  });
  test("getSecondaryEdits - cursor not on same line as primary edit 1", async function() {
    const textModel = createTextModel([
      "function fib(",
      "",
      "function fib(",
      ""
    ].join("\n"));
    const positions = [
      new Position(2, 1),
      new Position(4, 1)
    ];
    const primaryEdit = new SingleTextEdit(new Range(1, 1, 2, 1), [
      "function fib() {",
      "	return 0;",
      "}"
    ].join("\n"));
    const secondaryEdits = getSecondaryEdits(textModel, positions, primaryEdit);
    assert.deepStrictEqual(secondaryEdits, [new SingleTextEdit(
      new Range(4, 1, 4, 1),
      [
        "	return 0;",
        "}"
      ].join("\n")
    )]);
    textModel.dispose();
  });
  test("getSecondaryEdits - cursor not on same line as primary edit 2", async function() {
    const textModel = createTextModel([
      "class A {",
      "",
      "class B {",
      "",
      "function f() {}"
    ].join("\n"));
    const positions = [
      new Position(2, 1),
      new Position(4, 1)
    ];
    const primaryEdit = new SingleTextEdit(new Range(1, 1, 2, 1), [
      "class A {",
      "	public x: number = 0;",
      "   public y: number = 0;",
      "}"
    ].join("\n"));
    const secondaryEdits = getSecondaryEdits(textModel, positions, primaryEdit);
    assert.deepStrictEqual(secondaryEdits, [new SingleTextEdit(
      new Range(4, 1, 4, 1),
      [
        "	public x: number = 0;",
        "   public y: number = 0;",
        "}"
      ].join("\n")
    )]);
    textModel.dispose();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy90ZXN0L2Jyb3dzZXIvaW5saW5lQ29tcGxldGlvbnNNb2RlbC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgZ2V0U2Vjb25kYXJ5RWRpdHMgfSBmcm9tICcuLi8uLi9icm93c2VyL21vZGVsL2lubGluZUNvbXBsZXRpb25zTW9kZWwuanMnO1xuaW1wb3J0IHsgU2luZ2xlVGV4dEVkaXQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS90ZXh0RWRpdC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi90ZXN0VGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbnN1aXRlKCdpbmxpbmVDb21wbGV0aW9uTW9kZWwnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnZ2V0U2Vjb25kYXJ5RWRpdHMgLSBiYXNpYycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHRleHRNb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnZnVuY3Rpb24gZmliKCcsXG5cdFx0XHQnZnVuY3Rpb24gZmliKCdcblx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHRjb25zdCBwb3NpdGlvbnMgPSBbXG5cdFx0XHRuZXcgUG9zaXRpb24oMSwgMTQpLFxuXHRcdFx0bmV3IFBvc2l0aW9uKDIsIDE0KVxuXHRcdF07XG5cdFx0Y29uc3QgcHJpbWFyeUVkaXQgPSBuZXcgU2luZ2xlVGV4dEVkaXQobmV3IFJhbmdlKDEsIDEsIDEsIDE0KSwgJ2Z1bmN0aW9uIGZpYigpIHsnKTtcblx0XHRjb25zdCBzZWNvbmRhcnlFZGl0cyA9IGdldFNlY29uZGFyeUVkaXRzKHRleHRNb2RlbCwgcG9zaXRpb25zLCBwcmltYXJ5RWRpdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZWNvbmRhcnlFZGl0cywgW25ldyBTaW5nbGVUZXh0RWRpdChcblx0XHRcdG5ldyBSYW5nZSgyLCAxNCwgMiwgMTQpLFxuXHRcdFx0Jykgeydcblx0XHQpXSk7XG5cdFx0dGV4dE1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0U2Vjb25kYXJ5RWRpdHMgLSBjdXJzb3Igbm90IG9uIHNhbWUgbGluZSBhcyBwcmltYXJ5IGVkaXQgMScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHRleHRNb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnZnVuY3Rpb24gZmliKCcsXG5cdFx0XHQnJyxcblx0XHRcdCdmdW5jdGlvbiBmaWIoJyxcblx0XHRcdCcnXG5cdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0Y29uc3QgcG9zaXRpb25zID0gW1xuXHRcdFx0bmV3IFBvc2l0aW9uKDIsIDEpLFxuXHRcdFx0bmV3IFBvc2l0aW9uKDQsIDEpXG5cdFx0XTtcblx0XHRjb25zdCBwcmltYXJ5RWRpdCA9IG5ldyBTaW5nbGVUZXh0RWRpdChuZXcgUmFuZ2UoMSwgMSwgMiwgMSksIFtcblx0XHRcdCdmdW5jdGlvbiBmaWIoKSB7Jyxcblx0XHRcdCdcdHJldHVybiAwOycsXG5cdFx0XHQnfSdcblx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHRjb25zdCBzZWNvbmRhcnlFZGl0cyA9IGdldFNlY29uZGFyeUVkaXRzKHRleHRNb2RlbCwgcG9zaXRpb25zLCBwcmltYXJ5RWRpdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZWNvbmRhcnlFZGl0cywgW25ldyBTaW5nbGVUZXh0RWRpdChcblx0XHRcdG5ldyBSYW5nZSg0LCAxLCA0LCAxKSwgW1xuXHRcdFx0XHQnXHRyZXR1cm4gMDsnLFxuXHRcdFx0XHQnfSdcblx0XHRcdF0uam9pbignXFxuJylcblx0XHQpXSk7XG5cdFx0dGV4dE1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0U2Vjb25kYXJ5RWRpdHMgLSBjdXJzb3Igbm90IG9uIHNhbWUgbGluZSBhcyBwcmltYXJ5IGVkaXQgMicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHRleHRNb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnY2xhc3MgQSB7Jyxcblx0XHRcdCcnLFxuXHRcdFx0J2NsYXNzIEIgeycsXG5cdFx0XHQnJyxcblx0XHRcdCdmdW5jdGlvbiBmKCkge30nXG5cdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0Y29uc3QgcG9zaXRpb25zID0gW1xuXHRcdFx0bmV3IFBvc2l0aW9uKDIsIDEpLFxuXHRcdFx0bmV3IFBvc2l0aW9uKDQsIDEpXG5cdFx0XTtcblx0XHRjb25zdCBwcmltYXJ5RWRpdCA9IG5ldyBTaW5nbGVUZXh0RWRpdChuZXcgUmFuZ2UoMSwgMSwgMiwgMSksIFtcblx0XHRcdCdjbGFzcyBBIHsnLFxuXHRcdFx0J1x0cHVibGljIHg6IG51bWJlciA9IDA7Jyxcblx0XHRcdCcgICBwdWJsaWMgeTogbnVtYmVyID0gMDsnLFxuXHRcdFx0J30nXG5cdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0Y29uc3Qgc2Vjb25kYXJ5RWRpdHMgPSBnZXRTZWNvbmRhcnlFZGl0cyh0ZXh0TW9kZWwsIHBvc2l0aW9ucywgcHJpbWFyeUVkaXQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2Vjb25kYXJ5RWRpdHMsIFtuZXcgU2luZ2xlVGV4dEVkaXQoXG5cdFx0XHRuZXcgUmFuZ2UoNCwgMSwgNCwgMSksIFtcblx0XHRcdFx0J1x0cHVibGljIHg6IG51bWJlciA9IDA7Jyxcblx0XHRcdFx0JyAgIHB1YmxpYyB5OiBudW1iZXIgPSAwOycsXG5cdFx0XHRcdCd9J1xuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdCldKTtcblx0XHR0ZXh0TW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBSUEsT0FBTyxZQUFZO0FBQ25CLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsYUFBYTtBQUN0QixTQUFTLCtDQUErQztBQUV4RCxNQUFNLHlCQUF5QixNQUFNO0FBRXBDLDBDQUF3QztBQUV4QyxPQUFLLDZCQUE2QixpQkFBa0I7QUFFbkQsVUFBTSxZQUFZLGdCQUFnQjtBQUFBLE1BQ2pDO0FBQUEsTUFDQTtBQUFBLElBQ0QsRUFBRSxLQUFLLElBQUksQ0FBQztBQUNaLFVBQU0sWUFBWTtBQUFBLE1BQ2pCLElBQUksU0FBUyxHQUFHLEVBQUU7QUFBQSxNQUNsQixJQUFJLFNBQVMsR0FBRyxFQUFFO0FBQUEsSUFDbkI7QUFDQSxVQUFNLGNBQWMsSUFBSSxlQUFlLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsa0JBQWtCO0FBQ2pGLFVBQU0saUJBQWlCLGtCQUFrQixXQUFXLFdBQVcsV0FBVztBQUMxRSxXQUFPLGdCQUFnQixnQkFBZ0IsQ0FBQyxJQUFJO0FBQUEsTUFDM0MsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUN0QjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQ0YsY0FBVSxRQUFRO0FBQUEsRUFDbkIsQ0FBQztBQUVELE9BQUssaUVBQWlFLGlCQUFrQjtBQUV2RixVQUFNLFlBQVksZ0JBQWdCO0FBQUEsTUFDakM7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEVBQUUsS0FBSyxJQUFJLENBQUM7QUFDWixVQUFNLFlBQVk7QUFBQSxNQUNqQixJQUFJLFNBQVMsR0FBRyxDQUFDO0FBQUEsTUFDakIsSUFBSSxTQUFTLEdBQUcsQ0FBQztBQUFBLElBQ2xCO0FBQ0EsVUFBTSxjQUFjLElBQUksZUFBZSxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHO0FBQUEsTUFDN0Q7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsRUFBRSxLQUFLLElBQUksQ0FBQztBQUNaLFVBQU0saUJBQWlCLGtCQUFrQixXQUFXLFdBQVcsV0FBVztBQUMxRSxXQUFPLGdCQUFnQixnQkFBZ0IsQ0FBQyxJQUFJO0FBQUEsTUFDM0MsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUFHO0FBQUEsUUFDdEI7QUFBQSxRQUNBO0FBQUEsTUFDRCxFQUFFLEtBQUssSUFBSTtBQUFBLElBQ1osQ0FBQyxDQUFDO0FBQ0YsY0FBVSxRQUFRO0FBQUEsRUFDbkIsQ0FBQztBQUVELE9BQUssaUVBQWlFLGlCQUFrQjtBQUV2RixVQUFNLFlBQVksZ0JBQWdCO0FBQUEsTUFDakM7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxFQUFFLEtBQUssSUFBSSxDQUFDO0FBQ1osVUFBTSxZQUFZO0FBQUEsTUFDakIsSUFBSSxTQUFTLEdBQUcsQ0FBQztBQUFBLE1BQ2pCLElBQUksU0FBUyxHQUFHLENBQUM7QUFBQSxJQUNsQjtBQUNBLFVBQU0sY0FBYyxJQUFJLGVBQWUsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRztBQUFBLE1BQzdEO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxFQUFFLEtBQUssSUFBSSxDQUFDO0FBQ1osVUFBTSxpQkFBaUIsa0JBQWtCLFdBQVcsV0FBVyxXQUFXO0FBQzFFLFdBQU8sZ0JBQWdCLGdCQUFnQixDQUFDLElBQUk7QUFBQSxNQUMzQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQUc7QUFBQSxRQUN0QjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRCxFQUFFLEtBQUssSUFBSTtBQUFBLElBQ1osQ0FBQyxDQUFDO0FBQ0YsY0FBVSxRQUFRO0FBQUEsRUFDbkIsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
