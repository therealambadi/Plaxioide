import assert from "assert";
import { CellKind } from "../../common/notebookCommon.js";
import { withTestNotebook } from "./testNotebookEditor.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Event } from "../../../../../base/common/event.js";
suite("CellDecorations", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Add and remove a cell decoration", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}]
      ],
      async (editor, viewModel) => {
        const cell = viewModel.cellAt(0);
        assert.ok(cell);
        let added = false;
        Event.once(cell.onCellDecorationsChanged)((e) => added = !!e.added.find((decoration) => decoration.className === "style1"));
        const decorationIds = cell.deltaCellDecorations([], [{ className: "style1" }]);
        assert.ok(cell.getCellDecorations().find((dec) => dec.className === "style1"));
        let removed = false;
        Event.once(cell.onCellDecorationsChanged)((e) => removed = !!e.removed.find((decoration) => decoration.className === "style1"));
        cell.deltaCellDecorations(decorationIds, []);
        assert.ok(!cell.getCellDecorations().find((dec) => dec.className === "style1"));
        assert.ok(added);
        assert.ok(removed);
      }
    );
  });
  test("Removing one cell decoration should not remove all", async function() {
    await withTestNotebook(
      [
        ["# header a", "markdown", CellKind.Markup, [], {}]
      ],
      async (editor, viewModel) => {
        const cell = viewModel.cellAt(0);
        assert.ok(cell);
        const decorationIds = cell.deltaCellDecorations([], [{ className: "style1", outputClassName: "style1" }]);
        cell.deltaCellDecorations([], [{ className: "style1" }]);
        let styleRemoved = false;
        let outputStyleRemoved = false;
        Event.once(cell.onCellDecorationsChanged)((e) => {
          styleRemoved = !!e.removed.find((decoration) => decoration.className === "style1");
          outputStyleRemoved = !!e.removed.find((decoration) => decoration.outputClassName === "style1");
        });
        cell.deltaCellDecorations(decorationIds, []);
        assert.ok(!cell.getCellDecorations().find((dec) => dec.outputClassName === "style1"));
        assert.ok(cell.getCellDecorations().find((dec) => dec.className === "style1"));
        assert.ok(!styleRemoved);
        assert.ok(outputStyleRemoved);
      }
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvY2VsbERlY29yYXRpb25zLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBDZWxsS2luZCB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyB3aXRoVGVzdE5vdGVib29rIH0gZnJvbSAnLi90ZXN0Tm90ZWJvb2tFZGl0b3IuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcblxuc3VpdGUoJ0NlbGxEZWNvcmF0aW9ucycsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnQWRkIGFuZCByZW1vdmUgYSBjZWxsIGRlY29yYXRpb24nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2l0aFRlc3ROb3RlYm9vayhcblx0XHRcdFtcblx0XHRcdFx0WycjIGhlYWRlciBhJywgJ21hcmtkb3duJywgQ2VsbEtpbmQuTWFya3VwLCBbXSwge31dLFxuXHRcdFx0XSxcblx0XHRcdGFzeW5jIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0XHRjb25zdCBjZWxsID0gdmlld01vZGVsLmNlbGxBdCgwKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGNlbGwpO1xuXG5cdFx0XHRcdGxldCBhZGRlZCA9IGZhbHNlO1xuXHRcdFx0XHRFdmVudC5vbmNlKGNlbGwub25DZWxsRGVjb3JhdGlvbnNDaGFuZ2VkKShlID0+IGFkZGVkID0gISFlLmFkZGVkLmZpbmQoZGVjb3JhdGlvbiA9PiBkZWNvcmF0aW9uLmNsYXNzTmFtZSA9PT0gJ3N0eWxlMScpKTtcblxuXHRcdFx0XHRjb25zdCBkZWNvcmF0aW9uSWRzID0gY2VsbC5kZWx0YUNlbGxEZWNvcmF0aW9ucyhbXSwgW3sgY2xhc3NOYW1lOiAnc3R5bGUxJyB9XSk7XG5cdFx0XHRcdGFzc2VydC5vayhjZWxsLmdldENlbGxEZWNvcmF0aW9ucygpLmZpbmQoZGVjID0+IGRlYy5jbGFzc05hbWUgPT09ICdzdHlsZTEnKSk7XG5cblx0XHRcdFx0bGV0IHJlbW92ZWQgPSBmYWxzZTtcblx0XHRcdFx0RXZlbnQub25jZShjZWxsLm9uQ2VsbERlY29yYXRpb25zQ2hhbmdlZCkoZSA9PiByZW1vdmVkID0gISFlLnJlbW92ZWQuZmluZChkZWNvcmF0aW9uID0+IGRlY29yYXRpb24uY2xhc3NOYW1lID09PSAnc3R5bGUxJykpO1xuXHRcdFx0XHRjZWxsLmRlbHRhQ2VsbERlY29yYXRpb25zKGRlY29yYXRpb25JZHMsIFtdKTtcblxuXHRcdFx0XHRhc3NlcnQub2soIWNlbGwuZ2V0Q2VsbERlY29yYXRpb25zKCkuZmluZChkZWMgPT4gZGVjLmNsYXNzTmFtZSA9PT0gJ3N0eWxlMScpKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGFkZGVkKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKHJlbW92ZWQpO1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1JlbW92aW5nIG9uZSBjZWxsIGRlY29yYXRpb24gc2hvdWxkIG5vdCByZW1vdmUgYWxsJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdpdGhUZXN0Tm90ZWJvb2soXG5cdFx0XHRbXG5cdFx0XHRcdFsnIyBoZWFkZXIgYScsICdtYXJrZG93bicsIENlbGxLaW5kLk1hcmt1cCwgW10sIHt9XSxcblx0XHRcdF0sXG5cdFx0XHRhc3luYyAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdFx0Y29uc3QgY2VsbCA9IHZpZXdNb2RlbC5jZWxsQXQoMCk7XG5cdFx0XHRcdGFzc2VydC5vayhjZWxsKTtcblxuXHRcdFx0XHRjb25zdCBkZWNvcmF0aW9uSWRzID0gY2VsbC5kZWx0YUNlbGxEZWNvcmF0aW9ucyhbXSwgW3sgY2xhc3NOYW1lOiAnc3R5bGUxJywgb3V0cHV0Q2xhc3NOYW1lOiAnc3R5bGUxJyB9XSk7XG5cdFx0XHRcdGNlbGwuZGVsdGFDZWxsRGVjb3JhdGlvbnMoW10sIFt7IGNsYXNzTmFtZTogJ3N0eWxlMScgfV0pO1xuXG5cdFx0XHRcdGxldCBzdHlsZVJlbW92ZWQgPSBmYWxzZTtcblx0XHRcdFx0bGV0IG91dHB1dFN0eWxlUmVtb3ZlZCA9IGZhbHNlO1xuXHRcdFx0XHRFdmVudC5vbmNlKGNlbGwub25DZWxsRGVjb3JhdGlvbnNDaGFuZ2VkKShlID0+IHtcblx0XHRcdFx0XHRzdHlsZVJlbW92ZWQgPSAhIWUucmVtb3ZlZC5maW5kKGRlY29yYXRpb24gPT4gZGVjb3JhdGlvbi5jbGFzc05hbWUgPT09ICdzdHlsZTEnKTtcblx0XHRcdFx0XHRvdXRwdXRTdHlsZVJlbW92ZWQgPSAhIWUucmVtb3ZlZC5maW5kKGRlY29yYXRpb24gPT4gZGVjb3JhdGlvbi5vdXRwdXRDbGFzc05hbWUgPT09ICdzdHlsZTEnKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdC8vIHJlbW92ZSB0aGUgZmlyc3Qgc3R5bGUgYWRkZWQsIHdoaWNoIHNob3VsZCBvbmx5IHJlbW92ZSB0aGUgb3V0cHV0IGNsYXNzXG5cdFx0XHRcdGNlbGwuZGVsdGFDZWxsRGVjb3JhdGlvbnMoZGVjb3JhdGlvbklkcywgW10pO1xuXG5cdFx0XHRcdGFzc2VydC5vayghY2VsbC5nZXRDZWxsRGVjb3JhdGlvbnMoKS5maW5kKGRlYyA9PiBkZWMub3V0cHV0Q2xhc3NOYW1lID09PSAnc3R5bGUxJykpO1xuXHRcdFx0XHRhc3NlcnQub2soY2VsbC5nZXRDZWxsRGVjb3JhdGlvbnMoKS5maW5kKGRlYyA9PiBkZWMuY2xhc3NOYW1lID09PSAnc3R5bGUxJykpO1xuXHRcdFx0XHRhc3NlcnQub2soIXN0eWxlUmVtb3ZlZCk7XG5cdFx0XHRcdGFzc2VydC5vayhvdXRwdXRTdHlsZVJlbW92ZWQpO1xuXHRcdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxhQUFhO0FBRXRCLE1BQU0sbUJBQW1CLE1BQU07QUFDOUIsMENBQXdDO0FBRXhDLE9BQUssb0NBQW9DLGlCQUFrQjtBQUMxRCxVQUFNO0FBQUEsTUFDTDtBQUFBLFFBQ0MsQ0FBQyxjQUFjLFlBQVksU0FBUyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUNuRDtBQUFBLE1BQ0EsT0FBTyxRQUFRLGNBQWM7QUFDNUIsY0FBTSxPQUFPLFVBQVUsT0FBTyxDQUFDO0FBQy9CLGVBQU8sR0FBRyxJQUFJO0FBRWQsWUFBSSxRQUFRO0FBQ1osY0FBTSxLQUFLLEtBQUssd0JBQXdCLEVBQUUsT0FBSyxRQUFRLENBQUMsQ0FBQyxFQUFFLE1BQU0sS0FBSyxnQkFBYyxXQUFXLGNBQWMsUUFBUSxDQUFDO0FBRXRILGNBQU0sZ0JBQWdCLEtBQUsscUJBQXFCLENBQUMsR0FBRyxDQUFDLEVBQUUsV0FBVyxTQUFTLENBQUMsQ0FBQztBQUM3RSxlQUFPLEdBQUcsS0FBSyxtQkFBbUIsRUFBRSxLQUFLLFNBQU8sSUFBSSxjQUFjLFFBQVEsQ0FBQztBQUUzRSxZQUFJLFVBQVU7QUFDZCxjQUFNLEtBQUssS0FBSyx3QkFBd0IsRUFBRSxPQUFLLFVBQVUsQ0FBQyxDQUFDLEVBQUUsUUFBUSxLQUFLLGdCQUFjLFdBQVcsY0FBYyxRQUFRLENBQUM7QUFDMUgsYUFBSyxxQkFBcUIsZUFBZSxDQUFDLENBQUM7QUFFM0MsZUFBTyxHQUFHLENBQUMsS0FBSyxtQkFBbUIsRUFBRSxLQUFLLFNBQU8sSUFBSSxjQUFjLFFBQVEsQ0FBQztBQUM1RSxlQUFPLEdBQUcsS0FBSztBQUNmLGVBQU8sR0FBRyxPQUFPO0FBQUEsTUFDbEI7QUFBQSxJQUFDO0FBQUEsRUFDSCxDQUFDO0FBRUQsT0FBSyxzREFBc0QsaUJBQWtCO0FBQzVFLFVBQU07QUFBQSxNQUNMO0FBQUEsUUFDQyxDQUFDLGNBQWMsWUFBWSxTQUFTLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUFBLE1BQ25EO0FBQUEsTUFDQSxPQUFPLFFBQVEsY0FBYztBQUM1QixjQUFNLE9BQU8sVUFBVSxPQUFPLENBQUM7QUFDL0IsZUFBTyxHQUFHLElBQUk7QUFFZCxjQUFNLGdCQUFnQixLQUFLLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxFQUFFLFdBQVcsVUFBVSxpQkFBaUIsU0FBUyxDQUFDLENBQUM7QUFDeEcsYUFBSyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxXQUFXLFNBQVMsQ0FBQyxDQUFDO0FBRXZELFlBQUksZUFBZTtBQUNuQixZQUFJLHFCQUFxQjtBQUN6QixjQUFNLEtBQUssS0FBSyx3QkFBd0IsRUFBRSxPQUFLO0FBQzlDLHlCQUFlLENBQUMsQ0FBQyxFQUFFLFFBQVEsS0FBSyxnQkFBYyxXQUFXLGNBQWMsUUFBUTtBQUMvRSwrQkFBcUIsQ0FBQyxDQUFDLEVBQUUsUUFBUSxLQUFLLGdCQUFjLFdBQVcsb0JBQW9CLFFBQVE7QUFBQSxRQUM1RixDQUFDO0FBRUQsYUFBSyxxQkFBcUIsZUFBZSxDQUFDLENBQUM7QUFFM0MsZUFBTyxHQUFHLENBQUMsS0FBSyxtQkFBbUIsRUFBRSxLQUFLLFNBQU8sSUFBSSxvQkFBb0IsUUFBUSxDQUFDO0FBQ2xGLGVBQU8sR0FBRyxLQUFLLG1CQUFtQixFQUFFLEtBQUssU0FBTyxJQUFJLGNBQWMsUUFBUSxDQUFDO0FBQzNFLGVBQU8sR0FBRyxDQUFDLFlBQVk7QUFDdkIsZUFBTyxHQUFHLGtCQUFrQjtBQUFBLE1BQzdCO0FBQUEsSUFBQztBQUFBLEVBQ0gsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
