import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { InMemoryStorageService } from "../../../../../platform/storage/common/storage.js";
import { TestExplorerFilterState, TestFilterTerm } from "../../common/testExplorerFilterState.js";
suite("TestExplorerFilterState", () => {
  let t;
  let ds;
  teardown(() => {
    ds.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  setup(() => {
    ds = new DisposableStore();
    t = ds.add(new TestExplorerFilterState(ds.add(new InMemoryStorageService())));
  });
  const assertFilteringFor = (expected) => {
    for (const [term, expectation] of Object.entries(expected)) {
      assert.strictEqual(t.isFilteringFor(term), expectation, `expected filtering for ${term} === ${expectation}`);
    }
  };
  const termFiltersOff = {
    [TestFilterTerm.Failed]: false,
    [TestFilterTerm.Executed]: false,
    [TestFilterTerm.CurrentDoc]: false,
    [TestFilterTerm.Hidden]: false
  };
  test("filters simple globs", () => {
    t.setText("hello, !world");
    assert.deepStrictEqual(t.globList, [{ text: "hello", include: true }, { text: "world", include: false }]);
    assert.deepStrictEqual(t.includeTags, /* @__PURE__ */ new Set());
    assert.deepStrictEqual(t.excludeTags, /* @__PURE__ */ new Set());
    assertFilteringFor(termFiltersOff);
  });
  test("filters to patterns", () => {
    t.setText("@doc");
    assert.deepStrictEqual(t.globList, []);
    assert.deepStrictEqual(t.includeTags, /* @__PURE__ */ new Set());
    assert.deepStrictEqual(t.excludeTags, /* @__PURE__ */ new Set());
    assertFilteringFor({
      ...termFiltersOff,
      [TestFilterTerm.CurrentDoc]: true
    });
  });
  test("filters to tags", () => {
    t.setText("@hello:world !@foo:bar");
    assert.deepStrictEqual(t.globList, []);
    assert.deepStrictEqual(t.includeTags, /* @__PURE__ */ new Set(["hello\0world"]));
    assert.deepStrictEqual(t.excludeTags, /* @__PURE__ */ new Set(["foo\0bar"]));
    assertFilteringFor(termFiltersOff);
  });
  test("filters to mixed terms and tags", () => {
    t.setText("@hello:world foo, !bar @doc !@foo:bar");
    assert.deepStrictEqual(t.globList, [{ text: "foo", include: true }, { text: "bar", include: false }]);
    assert.deepStrictEqual(t.includeTags, /* @__PURE__ */ new Set(["hello\0world"]));
    assert.deepStrictEqual(t.excludeTags, /* @__PURE__ */ new Set(["foo\0bar"]));
    assertFilteringFor({
      ...termFiltersOff,
      [TestFilterTerm.CurrentDoc]: true
    });
  });
  test("parses quotes", () => {
    t.setText(`@hello:"world" @foo:'bar' baz`);
    assert.deepStrictEqual(t.globList, [{ text: "baz", include: true }]);
    assert.deepStrictEqual([...t.includeTags], ["hello\0world", "foo\0bar"]);
    assert.deepStrictEqual(t.excludeTags, /* @__PURE__ */ new Set());
  });
  test("parses quotes with escapes", () => {
    t.setText('@hello:"world\\"1" foo');
    assert.deepStrictEqual(t.globList, [{ text: "foo", include: true }]);
    assert.deepStrictEqual([...t.includeTags], ['hello\0world"1']);
    assert.deepStrictEqual(t.excludeTags, /* @__PURE__ */ new Set());
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL3Rlc3QvY29tbW9uL3Rlc3RFeHBsb3JlckZpbHRlclN0YXRlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBJbk1lbW9yeVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBUZXN0RXhwbG9yZXJGaWx0ZXJTdGF0ZSwgVGVzdEZpbHRlclRlcm0gfSBmcm9tICcuLi8uLi9jb21tb24vdGVzdEV4cGxvcmVyRmlsdGVyU3RhdGUuanMnO1xuXG5zdWl0ZSgnVGVzdEV4cGxvcmVyRmlsdGVyU3RhdGUnLCAoKSA9PiB7XG5cdGxldCB0OiBUZXN0RXhwbG9yZXJGaWx0ZXJTdGF0ZTtcblx0bGV0IGRzOiBEaXNwb3NhYmxlU3RvcmU7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHQgPSBkcy5hZGQobmV3IFRlc3RFeHBsb3JlckZpbHRlclN0YXRlKGRzLmFkZChuZXcgSW5NZW1vcnlTdG9yYWdlU2VydmljZSgpKSkpO1xuXHR9KTtcblxuXHRjb25zdCBhc3NlcnRGaWx0ZXJpbmdGb3IgPSAoZXhwZWN0ZWQ6IHsgW1QgaW4gVGVzdEZpbHRlclRlcm1dPzogYm9vbGVhbiB9KSA9PiB7XG5cdFx0Zm9yIChjb25zdCBbdGVybSwgZXhwZWN0YXRpb25dIG9mIE9iamVjdC5lbnRyaWVzKGV4cGVjdGVkKSkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHQuaXNGaWx0ZXJpbmdGb3IodGVybSBhcyBUZXN0RmlsdGVyVGVybSksIGV4cGVjdGF0aW9uLCBgZXhwZWN0ZWQgZmlsdGVyaW5nIGZvciAke3Rlcm19ID09PSAke2V4cGVjdGF0aW9ufWApO1xuXHRcdH1cblx0fTtcblxuXHRjb25zdCB0ZXJtRmlsdGVyc09mZiA9IHtcblx0XHRbVGVzdEZpbHRlclRlcm0uRmFpbGVkXTogZmFsc2UsXG5cdFx0W1Rlc3RGaWx0ZXJUZXJtLkV4ZWN1dGVkXTogZmFsc2UsXG5cdFx0W1Rlc3RGaWx0ZXJUZXJtLkN1cnJlbnREb2NdOiBmYWxzZSxcblx0XHRbVGVzdEZpbHRlclRlcm0uSGlkZGVuXTogZmFsc2UsXG5cdH07XG5cblx0dGVzdCgnZmlsdGVycyBzaW1wbGUgZ2xvYnMnLCAoKSA9PiB7XG5cdFx0dC5zZXRUZXh0KCdoZWxsbywgIXdvcmxkJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0Lmdsb2JMaXN0LCBbeyB0ZXh0OiAnaGVsbG8nLCBpbmNsdWRlOiB0cnVlIH0sIHsgdGV4dDogJ3dvcmxkJywgaW5jbHVkZTogZmFsc2UgfV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5pbmNsdWRlVGFncywgbmV3IFNldCgpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZXhjbHVkZVRhZ3MsIG5ldyBTZXQoKSk7XG5cdFx0YXNzZXJ0RmlsdGVyaW5nRm9yKHRlcm1GaWx0ZXJzT2ZmKTtcblx0fSk7XG5cblx0dGVzdCgnZmlsdGVycyB0byBwYXR0ZXJucycsICgpID0+IHtcblx0XHR0LnNldFRleHQoJ0Bkb2MnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2xvYkxpc3QsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuaW5jbHVkZVRhZ3MsIG5ldyBTZXQoKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmV4Y2x1ZGVUYWdzLCBuZXcgU2V0KCkpO1xuXHRcdGFzc2VydEZpbHRlcmluZ0Zvcih7XG5cdFx0XHQuLi50ZXJtRmlsdGVyc09mZixcblx0XHRcdFtUZXN0RmlsdGVyVGVybS5DdXJyZW50RG9jXTogdHJ1ZSxcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZmlsdGVycyB0byB0YWdzJywgKCkgPT4ge1xuXHRcdHQuc2V0VGV4dCgnQGhlbGxvOndvcmxkICFAZm9vOmJhcicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nbG9iTGlzdCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5pbmNsdWRlVGFncywgbmV3IFNldChbJ2hlbGxvXFwwd29ybGQnXSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5leGNsdWRlVGFncywgbmV3IFNldChbJ2Zvb1xcMGJhciddKSk7XG5cdFx0YXNzZXJ0RmlsdGVyaW5nRm9yKHRlcm1GaWx0ZXJzT2ZmKTtcblx0fSk7XG5cblx0dGVzdCgnZmlsdGVycyB0byBtaXhlZCB0ZXJtcyBhbmQgdGFncycsICgpID0+IHtcblx0XHR0LnNldFRleHQoJ0BoZWxsbzp3b3JsZCBmb28sICFiYXIgQGRvYyAhQGZvbzpiYXInKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2xvYkxpc3QsIFt7IHRleHQ6ICdmb28nLCBpbmNsdWRlOiB0cnVlIH0sIHsgdGV4dDogJ2JhcicsIGluY2x1ZGU6IGZhbHNlIH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuaW5jbHVkZVRhZ3MsIG5ldyBTZXQoWydoZWxsb1xcMHdvcmxkJ10pKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZXhjbHVkZVRhZ3MsIG5ldyBTZXQoWydmb29cXDBiYXInXSkpO1xuXHRcdGFzc2VydEZpbHRlcmluZ0Zvcih7XG5cdFx0XHQuLi50ZXJtRmlsdGVyc09mZixcblx0XHRcdFtUZXN0RmlsdGVyVGVybS5DdXJyZW50RG9jXTogdHJ1ZSxcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgncGFyc2VzIHF1b3RlcycsICgpID0+IHtcblx0XHR0LnNldFRleHQoJ0BoZWxsbzpcIndvcmxkXCIgQGZvbzpcXCdiYXJcXCcgYmF6Jyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0Lmdsb2JMaXN0LCBbeyB0ZXh0OiAnYmF6JywgaW5jbHVkZTogdHJ1ZSB9XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbLi4udC5pbmNsdWRlVGFnc10sIFsnaGVsbG9cXDB3b3JsZCcsICdmb29cXDBiYXInXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmV4Y2x1ZGVUYWdzLCBuZXcgU2V0KCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdwYXJzZXMgcXVvdGVzIHdpdGggZXNjYXBlcycsICgpID0+IHtcblx0XHR0LnNldFRleHQoJ0BoZWxsbzpcIndvcmxkXFxcXFwiMVwiIGZvbycpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nbG9iTGlzdCwgW3sgdGV4dDogJ2ZvbycsIGluY2x1ZGU6IHRydWUgfV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoWy4uLnQuaW5jbHVkZVRhZ3NdLCBbJ2hlbGxvXFwwd29ybGRcIjEnXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmV4Y2x1ZGVUYWdzLCBuZXcgU2V0KCkpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMseUJBQXlCLHNCQUFzQjtBQUV4RCxNQUFNLDJCQUEyQixNQUFNO0FBQ3RDLE1BQUk7QUFDSixNQUFJO0FBRUosV0FBUyxNQUFNO0FBQ2QsT0FBRyxRQUFRO0FBQUEsRUFDWixDQUFDO0FBRUQsMENBQXdDO0FBRXhDLFFBQU0sTUFBTTtBQUNYLFNBQUssSUFBSSxnQkFBZ0I7QUFDekIsUUFBSSxHQUFHLElBQUksSUFBSSx3QkFBd0IsR0FBRyxJQUFJLElBQUksdUJBQXVCLENBQUMsQ0FBQyxDQUFDO0FBQUEsRUFDN0UsQ0FBQztBQUVELFFBQU0scUJBQXFCLENBQUMsYUFBa0Q7QUFDN0UsZUFBVyxDQUFDLE1BQU0sV0FBVyxLQUFLLE9BQU8sUUFBUSxRQUFRLEdBQUc7QUFDM0QsYUFBTyxZQUFZLEVBQUUsZUFBZSxJQUFzQixHQUFHLGFBQWEsMEJBQTBCLElBQUksUUFBUSxXQUFXLEVBQUU7QUFBQSxJQUM5SDtBQUFBLEVBQ0Q7QUFFQSxRQUFNLGlCQUFpQjtBQUFBLElBQ3RCLENBQUMsZUFBZSxNQUFNLEdBQUc7QUFBQSxJQUN6QixDQUFDLGVBQWUsUUFBUSxHQUFHO0FBQUEsSUFDM0IsQ0FBQyxlQUFlLFVBQVUsR0FBRztBQUFBLElBQzdCLENBQUMsZUFBZSxNQUFNLEdBQUc7QUFBQSxFQUMxQjtBQUVBLE9BQUssd0JBQXdCLE1BQU07QUFDbEMsTUFBRSxRQUFRLGVBQWU7QUFDekIsV0FBTyxnQkFBZ0IsRUFBRSxVQUFVLENBQUMsRUFBRSxNQUFNLFNBQVMsU0FBUyxLQUFLLEdBQUcsRUFBRSxNQUFNLFNBQVMsU0FBUyxNQUFNLENBQUMsQ0FBQztBQUN4RyxXQUFPLGdCQUFnQixFQUFFLGFBQWEsb0JBQUksSUFBSSxDQUFDO0FBQy9DLFdBQU8sZ0JBQWdCLEVBQUUsYUFBYSxvQkFBSSxJQUFJLENBQUM7QUFDL0MsdUJBQW1CLGNBQWM7QUFBQSxFQUNsQyxDQUFDO0FBRUQsT0FBSyx1QkFBdUIsTUFBTTtBQUNqQyxNQUFFLFFBQVEsTUFBTTtBQUNoQixXQUFPLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ3JDLFdBQU8sZ0JBQWdCLEVBQUUsYUFBYSxvQkFBSSxJQUFJLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsRUFBRSxhQUFhLG9CQUFJLElBQUksQ0FBQztBQUMvQyx1QkFBbUI7QUFBQSxNQUNsQixHQUFHO0FBQUEsTUFDSCxDQUFDLGVBQWUsVUFBVSxHQUFHO0FBQUEsSUFDOUIsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssbUJBQW1CLE1BQU07QUFDN0IsTUFBRSxRQUFRLHdCQUF3QjtBQUNsQyxXQUFPLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ3JDLFdBQU8sZ0JBQWdCLEVBQUUsYUFBYSxvQkFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDL0QsV0FBTyxnQkFBZ0IsRUFBRSxhQUFhLG9CQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUMzRCx1QkFBbUIsY0FBYztBQUFBLEVBQ2xDLENBQUM7QUFFRCxPQUFLLG1DQUFtQyxNQUFNO0FBQzdDLE1BQUUsUUFBUSx1Q0FBdUM7QUFDakQsV0FBTyxnQkFBZ0IsRUFBRSxVQUFVLENBQUMsRUFBRSxNQUFNLE9BQU8sU0FBUyxLQUFLLEdBQUcsRUFBRSxNQUFNLE9BQU8sU0FBUyxNQUFNLENBQUMsQ0FBQztBQUNwRyxXQUFPLGdCQUFnQixFQUFFLGFBQWEsb0JBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQy9ELFdBQU8sZ0JBQWdCLEVBQUUsYUFBYSxvQkFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDM0QsdUJBQW1CO0FBQUEsTUFDbEIsR0FBRztBQUFBLE1BQ0gsQ0FBQyxlQUFlLFVBQVUsR0FBRztBQUFBLElBQzlCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLGlCQUFpQixNQUFNO0FBQzNCLE1BQUUsUUFBUSwrQkFBaUM7QUFDM0MsV0FBTyxnQkFBZ0IsRUFBRSxVQUFVLENBQUMsRUFBRSxNQUFNLE9BQU8sU0FBUyxLQUFLLENBQUMsQ0FBQztBQUNuRSxXQUFPLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxXQUFXLEdBQUcsQ0FBQyxnQkFBZ0IsVUFBVSxDQUFDO0FBQ3ZFLFdBQU8sZ0JBQWdCLEVBQUUsYUFBYSxvQkFBSSxJQUFJLENBQUM7QUFBQSxFQUNoRCxDQUFDO0FBRUQsT0FBSyw4QkFBOEIsTUFBTTtBQUN4QyxNQUFFLFFBQVEsd0JBQXdCO0FBQ2xDLFdBQU8sZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLEVBQUUsTUFBTSxPQUFPLFNBQVMsS0FBSyxDQUFDLENBQUM7QUFDbkUsV0FBTyxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsV0FBVyxHQUFHLENBQUMsZ0JBQWdCLENBQUM7QUFDN0QsV0FBTyxnQkFBZ0IsRUFBRSxhQUFhLG9CQUFJLElBQUksQ0FBQztBQUFBLEVBQ2hELENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
