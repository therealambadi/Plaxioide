import { deepStrictEqual } from "assert";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { shrinkWorkspaceFolderCwdPairs } from "../../browser/terminalActions.js";
function makeFakeFolder(name, uri) {
  return {
    name,
    uri,
    index: 0,
    toResource: () => uri
  };
}
function makePair(folder, cwd, isAbsolute) {
  return {
    folder,
    cwd: !cwd ? folder.uri : cwd instanceof URI ? cwd : cwd.uri,
    isAbsolute: !!isAbsolute,
    isOverridden: !!cwd && cwd.toString() !== folder.uri.toString()
  };
}
suite("terminalActions", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const root = URI.file("/some-root");
  const a = makeFakeFolder("a", URI.joinPath(root, "a"));
  const b = makeFakeFolder("b", URI.joinPath(root, "b"));
  const c = makeFakeFolder("c", URI.joinPath(root, "c"));
  const d = makeFakeFolder("d", URI.joinPath(root, "d"));
  suite("shrinkWorkspaceFolderCwdPairs", () => {
    test("should return empty when given array is empty", () => {
      deepStrictEqual(shrinkWorkspaceFolderCwdPairs([]), []);
    });
    test("should return the only single pair when given argument is a single element array", () => {
      const pairs = [makePair(a)];
      deepStrictEqual(shrinkWorkspaceFolderCwdPairs(pairs), pairs);
    });
    test("should return all pairs when no repeated cwds", () => {
      const pairs = [makePair(a), makePair(b), makePair(c)];
      deepStrictEqual(shrinkWorkspaceFolderCwdPairs(pairs), pairs);
    });
    suite("should select the pair that has the same URI when repeated cwds exist", () => {
      test("all repeated", () => {
        const pairA = makePair(a);
        const pairB = makePair(b, a);
        const pairC = makePair(c, a);
        deepStrictEqual(shrinkWorkspaceFolderCwdPairs([pairA, pairB, pairC]), [pairA]);
      });
      test("two repeated + one different", () => {
        const pairA = makePair(a);
        const pairB = makePair(b, a);
        const pairC = makePair(c);
        deepStrictEqual(shrinkWorkspaceFolderCwdPairs([pairA, pairB, pairC]), [pairA, pairC]);
      });
      test("two repeated + two repeated", () => {
        const pairA = makePair(a);
        const pairB = makePair(b, a);
        const pairC = makePair(c);
        const pairD = makePair(d, c);
        deepStrictEqual(shrinkWorkspaceFolderCwdPairs([pairA, pairB, pairC, pairD]), [pairA, pairC]);
      });
      test("two repeated + two repeated (reverse order)", () => {
        const pairB = makePair(b, a);
        const pairA = makePair(a);
        const pairD = makePair(d, c);
        const pairC = makePair(c);
        deepStrictEqual(shrinkWorkspaceFolderCwdPairs([pairA, pairB, pairC, pairD]), [pairA, pairC]);
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2Jyb3dzZXIvdGVybWluYWxBY3Rpb25zLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBkZWVwU3RyaWN0RXF1YWwgfSBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUZvbGRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFdvcmtzcGFjZUZvbGRlckN3ZFBhaXIsIHNocmlua1dvcmtzcGFjZUZvbGRlckN3ZFBhaXJzIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci90ZXJtaW5hbEFjdGlvbnMuanMnO1xuXG5mdW5jdGlvbiBtYWtlRmFrZUZvbGRlcihuYW1lOiBzdHJpbmcsIHVyaTogVVJJKTogSVdvcmtzcGFjZUZvbGRlciB7XG5cdHJldHVybiB7XG5cdFx0bmFtZSxcblx0XHR1cmksXG5cdFx0aW5kZXg6IDAsXG5cdFx0dG9SZXNvdXJjZTogKCkgPT4gdXJpLFxuXHR9O1xufVxuXG5mdW5jdGlvbiBtYWtlUGFpcihmb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIsIGN3ZD86IFVSSSB8IElXb3Jrc3BhY2VGb2xkZXIsIGlzQWJzb2x1dGU/OiBib29sZWFuKTogV29ya3NwYWNlRm9sZGVyQ3dkUGFpciB7XG5cdHJldHVybiB7XG5cdFx0Zm9sZGVyLFxuXHRcdGN3ZDogIWN3ZCA/IGZvbGRlci51cmkgOiAoY3dkIGluc3RhbmNlb2YgVVJJID8gY3dkIDogY3dkLnVyaSksXG5cdFx0aXNBYnNvbHV0ZTogISFpc0Fic29sdXRlLFxuXHRcdGlzT3ZlcnJpZGRlbjogISFjd2QgJiYgY3dkLnRvU3RyaW5nKCkgIT09IGZvbGRlci51cmkudG9TdHJpbmcoKSxcblx0fTtcbn1cblxuc3VpdGUoJ3Rlcm1pbmFsQWN0aW9ucycsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Y29uc3Qgcm9vdDogVVJJID0gVVJJLmZpbGUoJy9zb21lLXJvb3QnKTtcblx0Y29uc3QgYSA9IG1ha2VGYWtlRm9sZGVyKCdhJywgVVJJLmpvaW5QYXRoKHJvb3QsICdhJykpO1xuXHRjb25zdCBiID0gbWFrZUZha2VGb2xkZXIoJ2InLCBVUkkuam9pblBhdGgocm9vdCwgJ2InKSk7XG5cdGNvbnN0IGMgPSBtYWtlRmFrZUZvbGRlcignYycsIFVSSS5qb2luUGF0aChyb290LCAnYycpKTtcblx0Y29uc3QgZCA9IG1ha2VGYWtlRm9sZGVyKCdkJywgVVJJLmpvaW5QYXRoKHJvb3QsICdkJykpO1xuXG5cdHN1aXRlKCdzaHJpbmtXb3Jrc3BhY2VGb2xkZXJDd2RQYWlycycsICgpID0+IHtcblx0XHR0ZXN0KCdzaG91bGQgcmV0dXJuIGVtcHR5IHdoZW4gZ2l2ZW4gYXJyYXkgaXMgZW1wdHknLCAoKSA9PiB7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoc2hyaW5rV29ya3NwYWNlRm9sZGVyQ3dkUGFpcnMoW10pLCBbXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgcmV0dXJuIHRoZSBvbmx5IHNpbmdsZSBwYWlyIHdoZW4gZ2l2ZW4gYXJndW1lbnQgaXMgYSBzaW5nbGUgZWxlbWVudCBhcnJheScsICgpID0+IHtcblx0XHRcdGNvbnN0IHBhaXJzID0gW21ha2VQYWlyKGEpXTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChzaHJpbmtXb3Jrc3BhY2VGb2xkZXJDd2RQYWlycyhwYWlycyksIHBhaXJzKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCByZXR1cm4gYWxsIHBhaXJzIHdoZW4gbm8gcmVwZWF0ZWQgY3dkcycsICgpID0+IHtcblx0XHRcdGNvbnN0IHBhaXJzID0gW21ha2VQYWlyKGEpLCBtYWtlUGFpcihiKSwgbWFrZVBhaXIoYyldO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKHNocmlua1dvcmtzcGFjZUZvbGRlckN3ZFBhaXJzKHBhaXJzKSwgcGFpcnMpO1xuXHRcdH0pO1xuXG5cdFx0c3VpdGUoJ3Nob3VsZCBzZWxlY3QgdGhlIHBhaXIgdGhhdCBoYXMgdGhlIHNhbWUgVVJJIHdoZW4gcmVwZWF0ZWQgY3dkcyBleGlzdCcsICgpID0+IHtcblx0XHRcdHRlc3QoJ2FsbCByZXBlYXRlZCcsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgcGFpckEgPSBtYWtlUGFpcihhKTtcblx0XHRcdFx0Y29uc3QgcGFpckIgPSBtYWtlUGFpcihiLCBhKTsgLy8gQ1dEIHBvaW50cyB0byBBXG5cdFx0XHRcdGNvbnN0IHBhaXJDID0gbWFrZVBhaXIoYywgYSk7IC8vIENXRCBwb2ludHMgdG8gQVxuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoc2hyaW5rV29ya3NwYWNlRm9sZGVyQ3dkUGFpcnMoW3BhaXJBLCBwYWlyQiwgcGFpckNdKSwgW3BhaXJBXSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgndHdvIHJlcGVhdGVkICsgb25lIGRpZmZlcmVudCcsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgcGFpckEgPSBtYWtlUGFpcihhKTtcblx0XHRcdFx0Y29uc3QgcGFpckIgPSBtYWtlUGFpcihiLCBhKTsgLy8gQ1dEIHBvaW50cyB0byBBXG5cdFx0XHRcdGNvbnN0IHBhaXJDID0gbWFrZVBhaXIoYyk7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChzaHJpbmtXb3Jrc3BhY2VGb2xkZXJDd2RQYWlycyhbcGFpckEsIHBhaXJCLCBwYWlyQ10pLCBbcGFpckEsIHBhaXJDXSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgndHdvIHJlcGVhdGVkICsgdHdvIHJlcGVhdGVkJywgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBwYWlyQSA9IG1ha2VQYWlyKGEpO1xuXHRcdFx0XHRjb25zdCBwYWlyQiA9IG1ha2VQYWlyKGIsIGEpOyAvLyBDV0QgcG9pbnRzIHRvIEFcblx0XHRcdFx0Y29uc3QgcGFpckMgPSBtYWtlUGFpcihjKTtcblx0XHRcdFx0Y29uc3QgcGFpckQgPSBtYWtlUGFpcihkLCBjKTtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKHNocmlua1dvcmtzcGFjZUZvbGRlckN3ZFBhaXJzKFtwYWlyQSwgcGFpckIsIHBhaXJDLCBwYWlyRF0pLCBbcGFpckEsIHBhaXJDXSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgndHdvIHJlcGVhdGVkICsgdHdvIHJlcGVhdGVkIChyZXZlcnNlIG9yZGVyKScsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgcGFpckIgPSBtYWtlUGFpcihiLCBhKTsgLy8gQ1dEIHBvaW50cyB0byBBXG5cdFx0XHRcdGNvbnN0IHBhaXJBID0gbWFrZVBhaXIoYSk7XG5cdFx0XHRcdGNvbnN0IHBhaXJEID0gbWFrZVBhaXIoZCwgYyk7XG5cdFx0XHRcdGNvbnN0IHBhaXJDID0gbWFrZVBhaXIoYyk7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChzaHJpbmtXb3Jrc3BhY2VGb2xkZXJDd2RQYWlycyhbcGFpckEsIHBhaXJCLCBwYWlyQywgcGFpckRdKSwgW3BhaXJBLCBwYWlyQ10pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFdBQVc7QUFDcEIsU0FBUywrQ0FBK0M7QUFFeEQsU0FBaUMscUNBQXFDO0FBRXRFLFNBQVMsZUFBZSxNQUFjLEtBQTRCO0FBQ2pFLFNBQU87QUFBQSxJQUNOO0FBQUEsSUFDQTtBQUFBLElBQ0EsT0FBTztBQUFBLElBQ1AsWUFBWSxNQUFNO0FBQUEsRUFDbkI7QUFDRDtBQUVBLFNBQVMsU0FBUyxRQUEwQixLQUE4QixZQUE4QztBQUN2SCxTQUFPO0FBQUEsSUFDTjtBQUFBLElBQ0EsS0FBSyxDQUFDLE1BQU0sT0FBTyxNQUFPLGVBQWUsTUFBTSxNQUFNLElBQUk7QUFBQSxJQUN6RCxZQUFZLENBQUMsQ0FBQztBQUFBLElBQ2QsY0FBYyxDQUFDLENBQUMsT0FBTyxJQUFJLFNBQVMsTUFBTSxPQUFPLElBQUksU0FBUztBQUFBLEVBQy9EO0FBQ0Q7QUFFQSxNQUFNLG1CQUFtQixNQUFNO0FBQzlCLDBDQUF3QztBQUV4QyxRQUFNLE9BQVksSUFBSSxLQUFLLFlBQVk7QUFDdkMsUUFBTSxJQUFJLGVBQWUsS0FBSyxJQUFJLFNBQVMsTUFBTSxHQUFHLENBQUM7QUFDckQsUUFBTSxJQUFJLGVBQWUsS0FBSyxJQUFJLFNBQVMsTUFBTSxHQUFHLENBQUM7QUFDckQsUUFBTSxJQUFJLGVBQWUsS0FBSyxJQUFJLFNBQVMsTUFBTSxHQUFHLENBQUM7QUFDckQsUUFBTSxJQUFJLGVBQWUsS0FBSyxJQUFJLFNBQVMsTUFBTSxHQUFHLENBQUM7QUFFckQsUUFBTSxpQ0FBaUMsTUFBTTtBQUM1QyxTQUFLLGlEQUFpRCxNQUFNO0FBQzNELHNCQUFnQiw4QkFBOEIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQUEsSUFDdEQsQ0FBQztBQUVELFNBQUssb0ZBQW9GLE1BQU07QUFDOUYsWUFBTSxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDMUIsc0JBQWdCLDhCQUE4QixLQUFLLEdBQUcsS0FBSztBQUFBLElBQzVELENBQUM7QUFFRCxTQUFLLGlEQUFpRCxNQUFNO0FBQzNELFlBQU0sUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO0FBQ3BELHNCQUFnQiw4QkFBOEIsS0FBSyxHQUFHLEtBQUs7QUFBQSxJQUM1RCxDQUFDO0FBRUQsVUFBTSx5RUFBeUUsTUFBTTtBQUNwRixXQUFLLGdCQUFnQixNQUFNO0FBQzFCLGNBQU0sUUFBUSxTQUFTLENBQUM7QUFDeEIsY0FBTSxRQUFRLFNBQVMsR0FBRyxDQUFDO0FBQzNCLGNBQU0sUUFBUSxTQUFTLEdBQUcsQ0FBQztBQUMzQix3QkFBZ0IsOEJBQThCLENBQUMsT0FBTyxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDO0FBQUEsTUFDOUUsQ0FBQztBQUVELFdBQUssZ0NBQWdDLE1BQU07QUFDMUMsY0FBTSxRQUFRLFNBQVMsQ0FBQztBQUN4QixjQUFNLFFBQVEsU0FBUyxHQUFHLENBQUM7QUFDM0IsY0FBTSxRQUFRLFNBQVMsQ0FBQztBQUN4Qix3QkFBZ0IsOEJBQThCLENBQUMsT0FBTyxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxLQUFLLENBQUM7QUFBQSxNQUNyRixDQUFDO0FBRUQsV0FBSywrQkFBK0IsTUFBTTtBQUN6QyxjQUFNLFFBQVEsU0FBUyxDQUFDO0FBQ3hCLGNBQU0sUUFBUSxTQUFTLEdBQUcsQ0FBQztBQUMzQixjQUFNLFFBQVEsU0FBUyxDQUFDO0FBQ3hCLGNBQU0sUUFBUSxTQUFTLEdBQUcsQ0FBQztBQUMzQix3QkFBZ0IsOEJBQThCLENBQUMsT0FBTyxPQUFPLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEtBQUssQ0FBQztBQUFBLE1BQzVGLENBQUM7QUFFRCxXQUFLLCtDQUErQyxNQUFNO0FBQ3pELGNBQU0sUUFBUSxTQUFTLEdBQUcsQ0FBQztBQUMzQixjQUFNLFFBQVEsU0FBUyxDQUFDO0FBQ3hCLGNBQU0sUUFBUSxTQUFTLEdBQUcsQ0FBQztBQUMzQixjQUFNLFFBQVEsU0FBUyxDQUFDO0FBQ3hCLHdCQUFnQiw4QkFBOEIsQ0FBQyxPQUFPLE9BQU8sT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQU8sS0FBSyxDQUFDO0FBQUEsTUFDNUYsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
