import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { RenderedContentHover } from "../../browser/contentHoverRendered.js";
import { withTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
suite("Content Hover", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("issue #151235: Gitlens hover shows up in the wrong place", () => {
    const text = "just some text";
    withTestCodeEditor(text, {}, (editor) => {
      const actual = RenderedContentHover.computeHoverPositions(
        editor,
        new Range(5, 5, 5, 5),
        [{ range: new Range(4, 1, 5, 6) }]
      );
      assert.deepStrictEqual(
        actual,
        {
          showAtPosition: new Position(5, 5),
          showAtSecondaryPosition: new Position(5, 5)
        }
      );
    });
  });
  test("issue #95328: Hover placement with word-wrap", () => {
    const text = "just some text";
    const opts = { wordWrap: "wordWrapColumn", wordWrapColumn: 6 };
    withTestCodeEditor(text, opts, (editor) => {
      const actual = RenderedContentHover.computeHoverPositions(
        editor,
        new Range(1, 8, 1, 8),
        [{ range: new Range(1, 1, 1, 15) }]
      );
      assert.deepStrictEqual(
        actual,
        {
          showAtPosition: new Position(1, 8),
          showAtSecondaryPosition: new Position(1, 6)
        }
      );
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9ob3Zlci90ZXN0L2Jyb3dzZXIvY29udGVudEhvdmVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBSZW5kZXJlZENvbnRlbnRIb3ZlciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udGVudEhvdmVyUmVuZGVyZWQuanMnO1xuaW1wb3J0IHsgSUhvdmVyUGFydCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvaG92ZXJUeXBlcy5qcyc7XG5pbXBvcnQgeyBUZXN0Q29kZUVkaXRvckluc3RhbnRpYXRpb25PcHRpb25zLCB3aXRoVGVzdENvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvdGVzdENvZGVFZGl0b3IuanMnO1xuXG5zdWl0ZSgnQ29udGVudCBIb3ZlcicsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTUxMjM1OiBHaXRsZW5zIGhvdmVyIHNob3dzIHVwIGluIHRoZSB3cm9uZyBwbGFjZScsICgpID0+IHtcblx0XHRjb25zdCB0ZXh0ID0gJ2p1c3Qgc29tZSB0ZXh0Jztcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IodGV4dCwge30sIChlZGl0b3IpID0+IHtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IFJlbmRlcmVkQ29udGVudEhvdmVyLmNvbXB1dGVIb3ZlclBvc2l0aW9ucyhcblx0XHRcdFx0ZWRpdG9yLFxuXHRcdFx0XHRuZXcgUmFuZ2UoNSwgNSwgNSwgNSksXG5cdFx0XHRcdFs8SUhvdmVyUGFydD57IHJhbmdlOiBuZXcgUmFuZ2UoNCwgMSwgNSwgNikgfV1cblx0XHRcdCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRhY3R1YWwsXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzaG93QXRQb3NpdGlvbjogbmV3IFBvc2l0aW9uKDUsIDUpLFxuXHRcdFx0XHRcdHNob3dBdFNlY29uZGFyeVBvc2l0aW9uOiBuZXcgUG9zaXRpb24oNSwgNSlcblx0XHRcdFx0fVxuXHRcdFx0KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzk1MzI4OiBIb3ZlciBwbGFjZW1lbnQgd2l0aCB3b3JkLXdyYXAnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdGV4dCA9ICdqdXN0IHNvbWUgdGV4dCc7XG5cdFx0Y29uc3Qgb3B0czogVGVzdENvZGVFZGl0b3JJbnN0YW50aWF0aW9uT3B0aW9ucyA9IHsgd29yZFdyYXA6ICd3b3JkV3JhcENvbHVtbicsIHdvcmRXcmFwQ29sdW1uOiA2IH07XG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKHRleHQsIG9wdHMsIChlZGl0b3IpID0+IHtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IFJlbmRlcmVkQ29udGVudEhvdmVyLmNvbXB1dGVIb3ZlclBvc2l0aW9ucyhcblx0XHRcdFx0ZWRpdG9yLFxuXHRcdFx0XHRuZXcgUmFuZ2UoMSwgOCwgMSwgOCksXG5cdFx0XHRcdFs8SUhvdmVyUGFydD57IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMTUpIH1dXG5cdFx0XHQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0YWN0dWFsLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0c2hvd0F0UG9zaXRpb246IG5ldyBQb3NpdGlvbigxLCA4KSxcblx0XHRcdFx0XHRzaG93QXRTZWNvbmRhcnlQb3NpdGlvbjogbmV3IFBvc2l0aW9uKDEsIDYpXG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsNEJBQTRCO0FBRXJDLFNBQTZDLDBCQUEwQjtBQUV2RSxNQUFNLGlCQUFpQixNQUFNO0FBRTVCLDBDQUF3QztBQUV4QyxPQUFLLDREQUE0RCxNQUFNO0FBQ3RFLFVBQU0sT0FBTztBQUNiLHVCQUFtQixNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVc7QUFDeEMsWUFBTSxTQUFTLHFCQUFxQjtBQUFBLFFBQ25DO0FBQUEsUUFDQSxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ3BCLENBQWEsRUFBRSxPQUFPLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQztBQUFBLE1BQzlDO0FBQ0EsYUFBTztBQUFBLFFBQ047QUFBQSxRQUNBO0FBQUEsVUFDQyxnQkFBZ0IsSUFBSSxTQUFTLEdBQUcsQ0FBQztBQUFBLFVBQ2pDLHlCQUF5QixJQUFJLFNBQVMsR0FBRyxDQUFDO0FBQUEsUUFDM0M7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxnREFBZ0QsTUFBTTtBQUMxRCxVQUFNLE9BQU87QUFDYixVQUFNLE9BQTJDLEVBQUUsVUFBVSxrQkFBa0IsZ0JBQWdCLEVBQUU7QUFDakcsdUJBQW1CLE1BQU0sTUFBTSxDQUFDLFdBQVc7QUFDMUMsWUFBTSxTQUFTLHFCQUFxQjtBQUFBLFFBQ25DO0FBQUEsUUFDQSxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ3BCLENBQWEsRUFBRSxPQUFPLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxFQUFFLEVBQUUsQ0FBQztBQUFBLE1BQy9DO0FBQ0EsYUFBTztBQUFBLFFBQ047QUFBQSxRQUNBO0FBQUEsVUFDQyxnQkFBZ0IsSUFBSSxTQUFTLEdBQUcsQ0FBQztBQUFBLFVBQ2pDLHlCQUF5QixJQUFJLFNBQVMsR0FBRyxDQUFDO0FBQUEsUUFDM0M7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
