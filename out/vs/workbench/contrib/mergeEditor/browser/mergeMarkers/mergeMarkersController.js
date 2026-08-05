import { h } from "../../../../../base/browser/dom.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import { LineRange } from "../model/lineRange.js";
import * as nls from "../../../../../nls.js";
const conflictMarkers = {
  start: "<<<<<<<",
  end: ">>>>>>>"
};
class MergeMarkersController extends Disposable {
  constructor(editor, mergeEditorViewModel) {
    super();
    this.editor = editor;
    this.mergeEditorViewModel = mergeEditorViewModel;
    this.viewZoneIds = [];
    this.disposableStore = new DisposableStore();
    this._register(editor.onDidChangeModelContent((e) => {
      this.updateDecorations();
    }));
    this._register(editor.onDidChangeModel((e) => {
      this.updateDecorations();
    }));
    this.updateDecorations();
  }
  updateDecorations() {
    const model = this.editor.getModel();
    const blocks = model ? getBlocks(model, { blockToRemoveStartLinePrefix: conflictMarkers.start, blockToRemoveEndLinePrefix: conflictMarkers.end }) : { blocks: [] };
    this.editor.setHiddenAreas(blocks.blocks.map((b) => b.lineRange.deltaEnd(-1).toRange()), this);
    this.editor.changeViewZones((c) => {
      this.disposableStore.clear();
      for (const id of this.viewZoneIds) {
        c.removeZone(id);
      }
      this.viewZoneIds.length = 0;
      for (const b of blocks.blocks) {
        const startLine = model.getLineContent(b.lineRange.startLineNumber).substring(0, 20);
        const endLine = model.getLineContent(b.lineRange.endLineNumberExclusive - 1).substring(0, 20);
        const conflictingLinesCount = b.lineRange.lineCount - 2;
        const domNode = h("div", [
          h("div.conflict-zone-root", [
            h("pre", [startLine]),
            h("span.dots", ["..."]),
            h("pre", [endLine]),
            h("span.text", [
              conflictingLinesCount === 1 ? nls.localize("conflictingLine", "1 Conflicting Line") : nls.localize("conflictingLines", "{0} Conflicting Lines", conflictingLinesCount)
            ])
          ])
        ]).root;
        this.viewZoneIds.push(c.addZone({
          afterLineNumber: b.lineRange.endLineNumberExclusive - 1,
          domNode,
          heightInLines: 1.5
        }));
        const updateWidth = () => {
          const layoutInfo = this.editor.getLayoutInfo();
          domNode.style.width = `${layoutInfo.contentWidth - layoutInfo.verticalScrollbarWidth}px`;
        };
        this.disposableStore.add(
          this.editor.onDidLayoutChange(() => {
            updateWidth();
          })
        );
        updateWidth();
        this.disposableStore.add(autorun((reader) => {
          const vm = this.mergeEditorViewModel.read(reader);
          if (!vm) {
            return;
          }
          const activeRange = vm.activeModifiedBaseRange.read(reader);
          const classNames = [];
          classNames.push("conflict-zone");
          if (activeRange) {
            const activeRangeInResult = vm.model.getLineRangeInResult(activeRange.baseRange, reader);
            if (activeRangeInResult.intersects(b.lineRange)) {
              classNames.push("focused");
            }
          }
          domNode.className = classNames.join(" ");
        }));
      }
    });
  }
}
function getBlocks(document, configuration) {
  const blocks = [];
  const transformedContent = [];
  let inBlock = false;
  let startLineNumber = -1;
  let curLine = 0;
  for (const line of document.getLinesContent()) {
    curLine++;
    if (!inBlock) {
      if (line.startsWith(configuration.blockToRemoveStartLinePrefix)) {
        inBlock = true;
        startLineNumber = curLine;
      } else {
        transformedContent.push(line);
      }
    } else {
      if (line.startsWith(configuration.blockToRemoveEndLinePrefix)) {
        inBlock = false;
        blocks.push(new Block(new LineRange(startLineNumber, curLine - startLineNumber + 1)));
        transformedContent.push("");
      }
    }
  }
  return {
    blocks,
    transformedContent: transformedContent.join("\n")
  };
}
class Block {
  constructor(lineRange) {
    this.lineRange = lineRange;
  }
}
export {
  MergeMarkersController,
  conflictMarkers
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL21lcmdlTWFya2Vycy9tZXJnZU1hcmtlcnNDb250cm9sbGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgaCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGF1dG9ydW4sIElPYnNlcnZhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgTGluZVJhbmdlIH0gZnJvbSAnLi4vbW9kZWwvbGluZVJhbmdlLmpzJztcbmltcG9ydCB7IE1lcmdlRWRpdG9yVmlld01vZGVsIH0gZnJvbSAnLi4vdmlldy92aWV3TW9kZWwuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5cbmV4cG9ydCBjb25zdCBjb25mbGljdE1hcmtlcnMgPSB7XG5cdHN0YXJ0OiAnPDw8PDw8PCcsXG5cdGVuZDogJz4+Pj4+Pj4nLFxufTtcblxuZXhwb3J0IGNsYXNzIE1lcmdlTWFya2Vyc0NvbnRyb2xsZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSB2aWV3Wm9uZUlkczogc3RyaW5nW10gPSBbXTtcblx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHVibGljIGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHB1YmxpYyByZWFkb25seSBtZXJnZUVkaXRvclZpZXdNb2RlbDogSU9ic2VydmFibGU8TWVyZ2VFZGl0b3JWaWV3TW9kZWwgfCB1bmRlZmluZWQ+LFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KGUgPT4ge1xuXHRcdFx0dGhpcy51cGRhdGVEZWNvcmF0aW9ucygpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsKGUgPT4ge1xuXHRcdFx0dGhpcy51cGRhdGVEZWNvcmF0aW9ucygpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMudXBkYXRlRGVjb3JhdGlvbnMoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRGVjb3JhdGlvbnMoKSB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IGJsb2NrcyA9IG1vZGVsID8gZ2V0QmxvY2tzKG1vZGVsLCB7IGJsb2NrVG9SZW1vdmVTdGFydExpbmVQcmVmaXg6IGNvbmZsaWN0TWFya2Vycy5zdGFydCwgYmxvY2tUb1JlbW92ZUVuZExpbmVQcmVmaXg6IGNvbmZsaWN0TWFya2Vycy5lbmQgfSkgOiB7IGJsb2NrczogW10gfTtcblxuXHRcdHRoaXMuZWRpdG9yLnNldEhpZGRlbkFyZWFzKGJsb2Nrcy5ibG9ja3MubWFwKGIgPT4gYi5saW5lUmFuZ2UuZGVsdGFFbmQoLTEpLnRvUmFuZ2UoKSksIHRoaXMpO1xuXHRcdHRoaXMuZWRpdG9yLmNoYW5nZVZpZXdab25lcyhjID0+IHtcblx0XHRcdHRoaXMuZGlzcG9zYWJsZVN0b3JlLmNsZWFyKCk7XG5cdFx0XHRmb3IgKGNvbnN0IGlkIG9mIHRoaXMudmlld1pvbmVJZHMpIHtcblx0XHRcdFx0Yy5yZW1vdmVab25lKGlkKTtcblx0XHRcdH1cblx0XHRcdHRoaXMudmlld1pvbmVJZHMubGVuZ3RoID0gMDtcblx0XHRcdGZvciAoY29uc3QgYiBvZiBibG9ja3MuYmxvY2tzKSB7XG5cblx0XHRcdFx0Y29uc3Qgc3RhcnRMaW5lID0gbW9kZWwhLmdldExpbmVDb250ZW50KGIubGluZVJhbmdlLnN0YXJ0TGluZU51bWJlcikuc3Vic3RyaW5nKDAsIDIwKTtcblx0XHRcdFx0Y29uc3QgZW5kTGluZSA9IG1vZGVsIS5nZXRMaW5lQ29udGVudChiLmxpbmVSYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlIC0gMSkuc3Vic3RyaW5nKDAsIDIwKTtcblxuXHRcdFx0XHRjb25zdCBjb25mbGljdGluZ0xpbmVzQ291bnQgPSBiLmxpbmVSYW5nZS5saW5lQ291bnQgLSAyO1xuXG5cdFx0XHRcdGNvbnN0IGRvbU5vZGUgPSBoKCdkaXYnLCBbXG5cdFx0XHRcdFx0aCgnZGl2LmNvbmZsaWN0LXpvbmUtcm9vdCcsIFtcblx0XHRcdFx0XHRcdGgoJ3ByZScsIFtzdGFydExpbmVdKSxcblx0XHRcdFx0XHRcdGgoJ3NwYW4uZG90cycsIFsnLi4uJ10pLFxuXHRcdFx0XHRcdFx0aCgncHJlJywgW2VuZExpbmVdKSxcblx0XHRcdFx0XHRcdGgoJ3NwYW4udGV4dCcsIFtcblx0XHRcdFx0XHRcdFx0Y29uZmxpY3RpbmdMaW5lc0NvdW50ID09PSAxXG5cdFx0XHRcdFx0XHRcdFx0PyBubHMubG9jYWxpemUoJ2NvbmZsaWN0aW5nTGluZScsIFwiMSBDb25mbGljdGluZyBMaW5lXCIpXG5cdFx0XHRcdFx0XHRcdFx0OiBubHMubG9jYWxpemUoJ2NvbmZsaWN0aW5nTGluZXMnLCBcInswfSBDb25mbGljdGluZyBMaW5lc1wiLCBjb25mbGljdGluZ0xpbmVzQ291bnQpXG5cdFx0XHRcdFx0XHRdKSxcblx0XHRcdFx0XHRdKSxcblx0XHRcdFx0XSkucm9vdDtcblx0XHRcdFx0dGhpcy52aWV3Wm9uZUlkcy5wdXNoKGMuYWRkWm9uZSh7XG5cdFx0XHRcdFx0YWZ0ZXJMaW5lTnVtYmVyOiBiLmxpbmVSYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlIC0gMSxcblx0XHRcdFx0XHRkb21Ob2RlLFxuXHRcdFx0XHRcdGhlaWdodEluTGluZXM6IDEuNSxcblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdGNvbnN0IHVwZGF0ZVdpZHRoID0gKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGxheW91dEluZm8gPSB0aGlzLmVkaXRvci5nZXRMYXlvdXRJbmZvKCk7XG5cdFx0XHRcdFx0ZG9tTm9kZS5zdHlsZS53aWR0aCA9IGAke2xheW91dEluZm8uY29udGVudFdpZHRoIC0gbGF5b3V0SW5mby52ZXJ0aWNhbFNjcm9sbGJhcldpZHRofXB4YDtcblx0XHRcdFx0fTtcblxuXHRcdFx0XHR0aGlzLmRpc3Bvc2FibGVTdG9yZS5hZGQoXG5cdFx0XHRcdFx0dGhpcy5lZGl0b3Iub25EaWRMYXlvdXRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0XHRcdFx0dXBkYXRlV2lkdGgoKTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHQpO1xuXHRcdFx0XHR1cGRhdGVXaWR0aCgpO1xuXG5cblx0XHRcdFx0dGhpcy5kaXNwb3NhYmxlU3RvcmUuYWRkKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIHVwZGF0ZSBjbGFzc25hbWUgKi9cblx0XHRcdFx0XHRjb25zdCB2bSA9IHRoaXMubWVyZ2VFZGl0b3JWaWV3TW9kZWwucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRcdGlmICghdm0pIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgYWN0aXZlUmFuZ2UgPSB2bS5hY3RpdmVNb2RpZmllZEJhc2VSYW5nZS5yZWFkKHJlYWRlcik7XG5cblx0XHRcdFx0XHRjb25zdCBjbGFzc05hbWVzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0XHRcdGNsYXNzTmFtZXMucHVzaCgnY29uZmxpY3Qtem9uZScpO1xuXG5cdFx0XHRcdFx0aWYgKGFjdGl2ZVJhbmdlKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBhY3RpdmVSYW5nZUluUmVzdWx0ID0gdm0ubW9kZWwuZ2V0TGluZVJhbmdlSW5SZXN1bHQoYWN0aXZlUmFuZ2UuYmFzZVJhbmdlLCByZWFkZXIpO1xuXHRcdFx0XHRcdFx0aWYgKGFjdGl2ZVJhbmdlSW5SZXN1bHQuaW50ZXJzZWN0cyhiLmxpbmVSYW5nZSkpIHtcblx0XHRcdFx0XHRcdFx0Y2xhc3NOYW1lcy5wdXNoKCdmb2N1c2VkJyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0ZG9tTm9kZS5jbGFzc05hbWUgPSBjbGFzc05hbWVzLmpvaW4oJyAnKTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59XG5cblxuZnVuY3Rpb24gZ2V0QmxvY2tzKGRvY3VtZW50OiBJVGV4dE1vZGVsLCBjb25maWd1cmF0aW9uOiBQcm9qZWN0aW9uQ29uZmlndXJhdGlvbik6IHsgYmxvY2tzOiBCbG9ja1tdOyB0cmFuc2Zvcm1lZENvbnRlbnQ6IHN0cmluZyB9IHtcblx0Y29uc3QgYmxvY2tzOiBCbG9ja1tdID0gW107XG5cdGNvbnN0IHRyYW5zZm9ybWVkQ29udGVudDogc3RyaW5nW10gPSBbXTtcblxuXHRsZXQgaW5CbG9jayA9IGZhbHNlO1xuXHRsZXQgc3RhcnRMaW5lTnVtYmVyID0gLTE7XG5cdGxldCBjdXJMaW5lID0gMDtcblxuXHRmb3IgKGNvbnN0IGxpbmUgb2YgZG9jdW1lbnQuZ2V0TGluZXNDb250ZW50KCkpIHtcblx0XHRjdXJMaW5lKys7XG5cdFx0aWYgKCFpbkJsb2NrKSB7XG5cdFx0XHRpZiAobGluZS5zdGFydHNXaXRoKGNvbmZpZ3VyYXRpb24uYmxvY2tUb1JlbW92ZVN0YXJ0TGluZVByZWZpeCkpIHtcblx0XHRcdFx0aW5CbG9jayA9IHRydWU7XG5cdFx0XHRcdHN0YXJ0TGluZU51bWJlciA9IGN1ckxpbmU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0cmFuc2Zvcm1lZENvbnRlbnQucHVzaChsaW5lKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGxpbmUuc3RhcnRzV2l0aChjb25maWd1cmF0aW9uLmJsb2NrVG9SZW1vdmVFbmRMaW5lUHJlZml4KSkge1xuXHRcdFx0XHRpbkJsb2NrID0gZmFsc2U7XG5cdFx0XHRcdGJsb2Nrcy5wdXNoKG5ldyBCbG9jayhuZXcgTGluZVJhbmdlKHN0YXJ0TGluZU51bWJlciwgY3VyTGluZSAtIHN0YXJ0TGluZU51bWJlciArIDEpKSk7XG5cdFx0XHRcdHRyYW5zZm9ybWVkQ29udGVudC5wdXNoKCcnKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGJsb2Nrcyxcblx0XHR0cmFuc2Zvcm1lZENvbnRlbnQ6IHRyYW5zZm9ybWVkQ29udGVudC5qb2luKCdcXG4nKVxuXHR9O1xufVxuXG5jbGFzcyBCbG9jayB7XG5cdGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBsaW5lUmFuZ2U6IExpbmVSYW5nZSkgeyB9XG59XG5cbmludGVyZmFjZSBQcm9qZWN0aW9uQ29uZmlndXJhdGlvbiB7XG5cdGJsb2NrVG9SZW1vdmVTdGFydExpbmVQcmVmaXg6IHN0cmluZztcblx0YmxvY2tUb1JlbW92ZUVuZExpbmVQcmVmaXg6IHN0cmluZztcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsU0FBUztBQUNsQixTQUFTLFlBQVksdUJBQXVCO0FBQzVDLFNBQVMsZUFBNEI7QUFHckMsU0FBUyxpQkFBaUI7QUFFMUIsWUFBWSxTQUFTO0FBRWQsTUFBTSxrQkFBa0I7QUFBQSxFQUM5QixPQUFPO0FBQUEsRUFDUCxLQUFLO0FBQ047QUFFTyxNQUFNLCtCQUErQixXQUFXO0FBQUEsRUFJL0MsWUFDVSxRQUNBLHNCQUNmO0FBQ0QsVUFBTTtBQUhVO0FBQ0E7QUFMakIsU0FBaUIsY0FBd0IsQ0FBQztBQUMxQyxTQUFpQixrQkFBa0IsSUFBSSxnQkFBZ0I7QUFRdEQsU0FBSyxVQUFVLE9BQU8sd0JBQXdCLE9BQUs7QUFDbEQsV0FBSyxrQkFBa0I7QUFBQSxJQUN4QixDQUFDLENBQUM7QUFFRixTQUFLLFVBQVUsT0FBTyxpQkFBaUIsT0FBSztBQUMzQyxXQUFLLGtCQUFrQjtBQUFBLElBQ3hCLENBQUMsQ0FBQztBQUVGLFNBQUssa0JBQWtCO0FBQUEsRUFDeEI7QUFBQSxFQUVRLG9CQUFvQjtBQUMzQixVQUFNLFFBQVEsS0FBSyxPQUFPLFNBQVM7QUFDbkMsVUFBTSxTQUFTLFFBQVEsVUFBVSxPQUFPLEVBQUUsOEJBQThCLGdCQUFnQixPQUFPLDRCQUE0QixnQkFBZ0IsSUFBSSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRTtBQUVqSyxTQUFLLE9BQU8sZUFBZSxPQUFPLE9BQU8sSUFBSSxPQUFLLEVBQUUsVUFBVSxTQUFTLEVBQUUsRUFBRSxRQUFRLENBQUMsR0FBRyxJQUFJO0FBQzNGLFNBQUssT0FBTyxnQkFBZ0IsT0FBSztBQUNoQyxXQUFLLGdCQUFnQixNQUFNO0FBQzNCLGlCQUFXLE1BQU0sS0FBSyxhQUFhO0FBQ2xDLFVBQUUsV0FBVyxFQUFFO0FBQUEsTUFDaEI7QUFDQSxXQUFLLFlBQVksU0FBUztBQUMxQixpQkFBVyxLQUFLLE9BQU8sUUFBUTtBQUU5QixjQUFNLFlBQVksTUFBTyxlQUFlLEVBQUUsVUFBVSxlQUFlLEVBQUUsVUFBVSxHQUFHLEVBQUU7QUFDcEYsY0FBTSxVQUFVLE1BQU8sZUFBZSxFQUFFLFVBQVUseUJBQXlCLENBQUMsRUFBRSxVQUFVLEdBQUcsRUFBRTtBQUU3RixjQUFNLHdCQUF3QixFQUFFLFVBQVUsWUFBWTtBQUV0RCxjQUFNLFVBQVUsRUFBRSxPQUFPO0FBQUEsVUFDeEIsRUFBRSwwQkFBMEI7QUFBQSxZQUMzQixFQUFFLE9BQU8sQ0FBQyxTQUFTLENBQUM7QUFBQSxZQUNwQixFQUFFLGFBQWEsQ0FBQyxLQUFLLENBQUM7QUFBQSxZQUN0QixFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUM7QUFBQSxZQUNsQixFQUFFLGFBQWE7QUFBQSxjQUNkLDBCQUEwQixJQUN2QixJQUFJLFNBQVMsbUJBQW1CLG9CQUFvQixJQUNwRCxJQUFJLFNBQVMsb0JBQW9CLHlCQUF5QixxQkFBcUI7QUFBQSxZQUNuRixDQUFDO0FBQUEsVUFDRixDQUFDO0FBQUEsUUFDRixDQUFDLEVBQUU7QUFDSCxhQUFLLFlBQVksS0FBSyxFQUFFLFFBQVE7QUFBQSxVQUMvQixpQkFBaUIsRUFBRSxVQUFVLHlCQUF5QjtBQUFBLFVBQ3REO0FBQUEsVUFDQSxlQUFlO0FBQUEsUUFDaEIsQ0FBQyxDQUFDO0FBRUYsY0FBTSxjQUFjLE1BQU07QUFDekIsZ0JBQU0sYUFBYSxLQUFLLE9BQU8sY0FBYztBQUM3QyxrQkFBUSxNQUFNLFFBQVEsR0FBRyxXQUFXLGVBQWUsV0FBVyxzQkFBc0I7QUFBQSxRQUNyRjtBQUVBLGFBQUssZ0JBQWdCO0FBQUEsVUFDcEIsS0FBSyxPQUFPLGtCQUFrQixNQUFNO0FBQ25DLHdCQUFZO0FBQUEsVUFDYixDQUFDO0FBQUEsUUFDRjtBQUNBLG9CQUFZO0FBR1osYUFBSyxnQkFBZ0IsSUFBSSxRQUFRLFlBQVU7QUFFMUMsZ0JBQU0sS0FBSyxLQUFLLHFCQUFxQixLQUFLLE1BQU07QUFDaEQsY0FBSSxDQUFDLElBQUk7QUFDUjtBQUFBLFVBQ0Q7QUFDQSxnQkFBTSxjQUFjLEdBQUcsd0JBQXdCLEtBQUssTUFBTTtBQUUxRCxnQkFBTSxhQUF1QixDQUFDO0FBQzlCLHFCQUFXLEtBQUssZUFBZTtBQUUvQixjQUFJLGFBQWE7QUFDaEIsa0JBQU0sc0JBQXNCLEdBQUcsTUFBTSxxQkFBcUIsWUFBWSxXQUFXLE1BQU07QUFDdkYsZ0JBQUksb0JBQW9CLFdBQVcsRUFBRSxTQUFTLEdBQUc7QUFDaEQseUJBQVcsS0FBSyxTQUFTO0FBQUEsWUFDMUI7QUFBQSxVQUNEO0FBRUEsa0JBQVEsWUFBWSxXQUFXLEtBQUssR0FBRztBQUFBLFFBQ3hDLENBQUMsQ0FBQztBQUFBLE1BQ0g7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQ0Q7QUFHQSxTQUFTLFVBQVUsVUFBc0IsZUFBeUY7QUFDakksUUFBTSxTQUFrQixDQUFDO0FBQ3pCLFFBQU0scUJBQStCLENBQUM7QUFFdEMsTUFBSSxVQUFVO0FBQ2QsTUFBSSxrQkFBa0I7QUFDdEIsTUFBSSxVQUFVO0FBRWQsYUFBVyxRQUFRLFNBQVMsZ0JBQWdCLEdBQUc7QUFDOUM7QUFDQSxRQUFJLENBQUMsU0FBUztBQUNiLFVBQUksS0FBSyxXQUFXLGNBQWMsNEJBQTRCLEdBQUc7QUFDaEUsa0JBQVU7QUFDViwwQkFBa0I7QUFBQSxNQUNuQixPQUFPO0FBQ04sMkJBQW1CLEtBQUssSUFBSTtBQUFBLE1BQzdCO0FBQUEsSUFDRCxPQUFPO0FBQ04sVUFBSSxLQUFLLFdBQVcsY0FBYywwQkFBMEIsR0FBRztBQUM5RCxrQkFBVTtBQUNWLGVBQU8sS0FBSyxJQUFJLE1BQU0sSUFBSSxVQUFVLGlCQUFpQixVQUFVLGtCQUFrQixDQUFDLENBQUMsQ0FBQztBQUNwRiwyQkFBbUIsS0FBSyxFQUFFO0FBQUEsTUFDM0I7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLFNBQU87QUFBQSxJQUNOO0FBQUEsSUFDQSxvQkFBb0IsbUJBQW1CLEtBQUssSUFBSTtBQUFBLEVBQ2pEO0FBQ0Q7QUFFQSxNQUFNLE1BQU07QUFBQSxFQUNYLFlBQTRCLFdBQXNCO0FBQXRCO0FBQUEsRUFBd0I7QUFDckQ7IiwKICAibmFtZXMiOiBbXQp9Cg==
