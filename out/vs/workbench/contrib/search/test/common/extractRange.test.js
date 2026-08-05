import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { extractRangeFromFilter } from "../../common/search.js";
suite("extractRangeFromFilter", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("basics", async function() {
    assert.ok(!extractRangeFromFilter(""));
    assert.ok(!extractRangeFromFilter("/some/path"));
    assert.ok(!extractRangeFromFilter("/some/path/file.txt"));
    for (const lineSep of [":", "#", "(", ":line "]) {
      for (const colSep of [":", "#", ","]) {
        const base = "/some/path/file.txt";
        let res = extractRangeFromFilter(`${base}${lineSep}20`);
        assert.strictEqual(res?.filter, base);
        assert.strictEqual(res?.range.startLineNumber, 20);
        assert.strictEqual(res?.range.startColumn, 1);
        res = extractRangeFromFilter(`${base}${lineSep}20${colSep}`);
        assert.strictEqual(res?.filter, base);
        assert.strictEqual(res?.range.startLineNumber, 20);
        assert.strictEqual(res?.range.startColumn, 1);
        res = extractRangeFromFilter(`${base}${lineSep}20${colSep}3`);
        assert.strictEqual(res?.filter, base);
        assert.strictEqual(res?.range.startLineNumber, 20);
        assert.strictEqual(res?.range.startColumn, 3);
      }
    }
  });
  test("allow space after path", async function() {
    const res = extractRangeFromFilter("/some/path/file.txt (19,20)");
    assert.strictEqual(res?.filter, "/some/path/file.txt");
    assert.strictEqual(res?.range.startLineNumber, 19);
    assert.strictEqual(res?.range.startColumn, 20);
  });
  suite("unless", function() {
    const testSpecs = [
      // alpha-only symbol after unless
      { filter: "/some/path/file.txt@alphasymbol", unless: ["@"], result: void 0 },
      // unless as first char
      { filter: "@/some/path/file.txt (19,20)", unless: ["@"], result: void 0 },
      // unless as last char
      { filter: "/some/path/file.txt (19,20)@", unless: ["@"], result: void 0 },
      // unless before ,
      {
        filter: "/some/@path/file.txt (19,20)",
        unless: ["@"],
        result: {
          filter: "/some/@path/file.txt",
          range: {
            endColumn: 20,
            endLineNumber: 19,
            startColumn: 20,
            startLineNumber: 19
          }
        }
      },
      // unless before :
      {
        filter: "/some/@path/file.txt:19:20",
        unless: ["@"],
        result: {
          filter: "/some/@path/file.txt",
          range: {
            endColumn: 20,
            endLineNumber: 19,
            startColumn: 20,
            startLineNumber: 19
          }
        }
      },
      // unless before #
      {
        filter: "/some/@path/file.txt#19",
        unless: ["@"],
        result: {
          filter: "/some/@path/file.txt",
          range: {
            endColumn: 1,
            endLineNumber: 19,
            startColumn: 1,
            startLineNumber: 19
          }
        }
      }
    ];
    for (const { filter, unless, result } of testSpecs) {
      test(`${filter} - ${JSON.stringify(unless)}`, () => {
        assert.deepStrictEqual(extractRangeFromFilter(filter, unless), result);
      });
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvdGVzdC9jb21tb24vZXh0cmFjdFJhbmdlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IGV4dHJhY3RSYW5nZUZyb21GaWx0ZXIgfSBmcm9tICcuLi8uLi9jb21tb24vc2VhcmNoLmpzJztcblxuc3VpdGUoJ2V4dHJhY3RSYW5nZUZyb21GaWx0ZXInLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnYmFzaWNzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydC5vayghZXh0cmFjdFJhbmdlRnJvbUZpbHRlcignJykpO1xuXHRcdGFzc2VydC5vayghZXh0cmFjdFJhbmdlRnJvbUZpbHRlcignL3NvbWUvcGF0aCcpKTtcblx0XHRhc3NlcnQub2soIWV4dHJhY3RSYW5nZUZyb21GaWx0ZXIoJy9zb21lL3BhdGgvZmlsZS50eHQnKSk7XG5cblx0XHRmb3IgKGNvbnN0IGxpbmVTZXAgb2YgWyc6JywgJyMnLCAnKCcsICc6bGluZSAnXSkge1xuXHRcdFx0Zm9yIChjb25zdCBjb2xTZXAgb2YgWyc6JywgJyMnLCAnLCddKSB7XG5cdFx0XHRcdGNvbnN0IGJhc2UgPSAnL3NvbWUvcGF0aC9maWxlLnR4dCc7XG5cblx0XHRcdFx0bGV0IHJlcyA9IGV4dHJhY3RSYW5nZUZyb21GaWx0ZXIoYCR7YmFzZX0ke2xpbmVTZXB9MjBgKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcz8uZmlsdGVyLCBiYXNlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcz8ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCAyMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXM/LnJhbmdlLnN0YXJ0Q29sdW1uLCAxKTtcblxuXHRcdFx0XHRyZXMgPSBleHRyYWN0UmFuZ2VGcm9tRmlsdGVyKGAke2Jhc2V9JHtsaW5lU2VwfTIwJHtjb2xTZXB9YCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXM/LmZpbHRlciwgYmFzZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXM/LnJhbmdlLnN0YXJ0TGluZU51bWJlciwgMjApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzPy5yYW5nZS5zdGFydENvbHVtbiwgMSk7XG5cblx0XHRcdFx0cmVzID0gZXh0cmFjdFJhbmdlRnJvbUZpbHRlcihgJHtiYXNlfSR7bGluZVNlcH0yMCR7Y29sU2VwfTNgKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcz8uZmlsdGVyLCBiYXNlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcz8ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCAyMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXM/LnJhbmdlLnN0YXJ0Q29sdW1uLCAzKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2FsbG93IHNwYWNlIGFmdGVyIHBhdGgnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzID0gZXh0cmFjdFJhbmdlRnJvbUZpbHRlcignL3NvbWUvcGF0aC9maWxlLnR4dCAoMTksMjApJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzPy5maWx0ZXIsICcvc29tZS9wYXRoL2ZpbGUudHh0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcz8ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCAxOSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcz8ucmFuZ2Uuc3RhcnRDb2x1bW4sIDIwKTtcblx0fSk7XG5cblx0c3VpdGUoJ3VubGVzcycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0U3BlY3MgPSBbXG5cdFx0XHQvLyBhbHBoYS1vbmx5IHN5bWJvbCBhZnRlciB1bmxlc3Ncblx0XHRcdHsgZmlsdGVyOiAnL3NvbWUvcGF0aC9maWxlLnR4dEBhbHBoYXN5bWJvbCcsIHVubGVzczogWydAJ10sIHJlc3VsdDogdW5kZWZpbmVkIH0sXG5cdFx0XHQvLyB1bmxlc3MgYXMgZmlyc3QgY2hhclxuXHRcdFx0eyBmaWx0ZXI6ICdAL3NvbWUvcGF0aC9maWxlLnR4dCAoMTksMjApJywgdW5sZXNzOiBbJ0AnXSwgcmVzdWx0OiB1bmRlZmluZWQgfSxcblx0XHRcdC8vIHVubGVzcyBhcyBsYXN0IGNoYXJcblx0XHRcdHsgZmlsdGVyOiAnL3NvbWUvcGF0aC9maWxlLnR4dCAoMTksMjApQCcsIHVubGVzczogWydAJ10sIHJlc3VsdDogdW5kZWZpbmVkIH0sXG5cdFx0XHQvLyB1bmxlc3MgYmVmb3JlICxcblx0XHRcdHtcblx0XHRcdFx0ZmlsdGVyOiAnL3NvbWUvQHBhdGgvZmlsZS50eHQgKDE5LDIwKScsIHVubGVzczogWydAJ10sIHJlc3VsdDoge1xuXHRcdFx0XHRcdGZpbHRlcjogJy9zb21lL0BwYXRoL2ZpbGUudHh0Jyxcblx0XHRcdFx0XHRyYW5nZToge1xuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiAyMCxcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IDE5LFxuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IDIwLFxuXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxOVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdC8vIHVubGVzcyBiZWZvcmUgOlxuXHRcdFx0e1xuXHRcdFx0XHRmaWx0ZXI6ICcvc29tZS9AcGF0aC9maWxlLnR4dDoxOToyMCcsIHVubGVzczogWydAJ10sIHJlc3VsdDoge1xuXHRcdFx0XHRcdGZpbHRlcjogJy9zb21lL0BwYXRoL2ZpbGUudHh0Jyxcblx0XHRcdFx0XHRyYW5nZToge1xuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiAyMCxcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IDE5LFxuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IDIwLFxuXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiAxOVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdC8vIHVubGVzcyBiZWZvcmUgI1xuXHRcdFx0e1xuXHRcdFx0XHRmaWx0ZXI6ICcvc29tZS9AcGF0aC9maWxlLnR4dCMxOScsIHVubGVzczogWydAJ10sIHJlc3VsdDoge1xuXHRcdFx0XHRcdGZpbHRlcjogJy9zb21lL0BwYXRoL2ZpbGUudHh0Jyxcblx0XHRcdFx0XHRyYW5nZToge1xuXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiAxLFxuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogMTksXG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMTlcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XTtcblx0XHRmb3IgKGNvbnN0IHsgZmlsdGVyLCB1bmxlc3MsIHJlc3VsdCB9IG9mIHRlc3RTcGVjcykge1xuXHRcdFx0dGVzdChgJHtmaWx0ZXJ9IC0gJHtKU09OLnN0cmluZ2lmeSh1bmxlc3MpfWAsICgpID0+IHtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChleHRyYWN0UmFuZ2VGcm9tRmlsdGVyKGZpbHRlciwgdW5sZXNzKSwgcmVzdWx0KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLCtDQUErQztBQUN4RCxTQUFTLDhCQUE4QjtBQUV2QyxNQUFNLDBCQUEwQixNQUFNO0FBRXJDLDBDQUF3QztBQUV4QyxPQUFLLFVBQVUsaUJBQWtCO0FBQ2hDLFdBQU8sR0FBRyxDQUFDLHVCQUF1QixFQUFFLENBQUM7QUFDckMsV0FBTyxHQUFHLENBQUMsdUJBQXVCLFlBQVksQ0FBQztBQUMvQyxXQUFPLEdBQUcsQ0FBQyx1QkFBdUIscUJBQXFCLENBQUM7QUFFeEQsZUFBVyxXQUFXLENBQUMsS0FBSyxLQUFLLEtBQUssUUFBUSxHQUFHO0FBQ2hELGlCQUFXLFVBQVUsQ0FBQyxLQUFLLEtBQUssR0FBRyxHQUFHO0FBQ3JDLGNBQU0sT0FBTztBQUViLFlBQUksTUFBTSx1QkFBdUIsR0FBRyxJQUFJLEdBQUcsT0FBTyxJQUFJO0FBQ3RELGVBQU8sWUFBWSxLQUFLLFFBQVEsSUFBSTtBQUNwQyxlQUFPLFlBQVksS0FBSyxNQUFNLGlCQUFpQixFQUFFO0FBQ2pELGVBQU8sWUFBWSxLQUFLLE1BQU0sYUFBYSxDQUFDO0FBRTVDLGNBQU0sdUJBQXVCLEdBQUcsSUFBSSxHQUFHLE9BQU8sS0FBSyxNQUFNLEVBQUU7QUFDM0QsZUFBTyxZQUFZLEtBQUssUUFBUSxJQUFJO0FBQ3BDLGVBQU8sWUFBWSxLQUFLLE1BQU0saUJBQWlCLEVBQUU7QUFDakQsZUFBTyxZQUFZLEtBQUssTUFBTSxhQUFhLENBQUM7QUFFNUMsY0FBTSx1QkFBdUIsR0FBRyxJQUFJLEdBQUcsT0FBTyxLQUFLLE1BQU0sR0FBRztBQUM1RCxlQUFPLFlBQVksS0FBSyxRQUFRLElBQUk7QUFDcEMsZUFBTyxZQUFZLEtBQUssTUFBTSxpQkFBaUIsRUFBRTtBQUNqRCxlQUFPLFlBQVksS0FBSyxNQUFNLGFBQWEsQ0FBQztBQUFBLE1BQzdDO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssMEJBQTBCLGlCQUFrQjtBQUNoRCxVQUFNLE1BQU0sdUJBQXVCLDZCQUE2QjtBQUVoRSxXQUFPLFlBQVksS0FBSyxRQUFRLHFCQUFxQjtBQUNyRCxXQUFPLFlBQVksS0FBSyxNQUFNLGlCQUFpQixFQUFFO0FBQ2pELFdBQU8sWUFBWSxLQUFLLE1BQU0sYUFBYSxFQUFFO0FBQUEsRUFDOUMsQ0FBQztBQUVELFFBQU0sVUFBVSxXQUFZO0FBQzNCLFVBQU0sWUFBWTtBQUFBO0FBQUEsTUFFakIsRUFBRSxRQUFRLG1DQUFtQyxRQUFRLENBQUMsR0FBRyxHQUFHLFFBQVEsT0FBVTtBQUFBO0FBQUEsTUFFOUUsRUFBRSxRQUFRLGdDQUFnQyxRQUFRLENBQUMsR0FBRyxHQUFHLFFBQVEsT0FBVTtBQUFBO0FBQUEsTUFFM0UsRUFBRSxRQUFRLGdDQUFnQyxRQUFRLENBQUMsR0FBRyxHQUFHLFFBQVEsT0FBVTtBQUFBO0FBQUEsTUFFM0U7QUFBQSxRQUNDLFFBQVE7QUFBQSxRQUFnQyxRQUFRLENBQUMsR0FBRztBQUFBLFFBQUcsUUFBUTtBQUFBLFVBQzlELFFBQVE7QUFBQSxVQUNSLE9BQU87QUFBQSxZQUNOLFdBQVc7QUFBQSxZQUNYLGVBQWU7QUFBQSxZQUNmLGFBQWE7QUFBQSxZQUNiLGlCQUFpQjtBQUFBLFVBQ2xCO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQTtBQUFBLE1BRUE7QUFBQSxRQUNDLFFBQVE7QUFBQSxRQUE4QixRQUFRLENBQUMsR0FBRztBQUFBLFFBQUcsUUFBUTtBQUFBLFVBQzVELFFBQVE7QUFBQSxVQUNSLE9BQU87QUFBQSxZQUNOLFdBQVc7QUFBQSxZQUNYLGVBQWU7QUFBQSxZQUNmLGFBQWE7QUFBQSxZQUNiLGlCQUFpQjtBQUFBLFVBQ2xCO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQTtBQUFBLE1BRUE7QUFBQSxRQUNDLFFBQVE7QUFBQSxRQUEyQixRQUFRLENBQUMsR0FBRztBQUFBLFFBQUcsUUFBUTtBQUFBLFVBQ3pELFFBQVE7QUFBQSxVQUNSLE9BQU87QUFBQSxZQUNOLFdBQVc7QUFBQSxZQUNYLGVBQWU7QUFBQSxZQUNmLGFBQWE7QUFBQSxZQUNiLGlCQUFpQjtBQUFBLFVBQ2xCO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsZUFBVyxFQUFFLFFBQVEsUUFBUSxPQUFPLEtBQUssV0FBVztBQUNuRCxXQUFLLEdBQUcsTUFBTSxNQUFNLEtBQUssVUFBVSxNQUFNLENBQUMsSUFBSSxNQUFNO0FBQ25ELGVBQU8sZ0JBQWdCLHVCQUF1QixRQUFRLE1BQU0sR0FBRyxNQUFNO0FBQUEsTUFDdEUsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNELENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
