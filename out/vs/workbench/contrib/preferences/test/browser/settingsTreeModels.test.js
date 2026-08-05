import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { settingKeyToDisplayFormat, parseQuery } from "../../browser/settingsTreeModels.js";
suite("SettingsTree", () => {
  test("settingKeyToDisplayFormat", () => {
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("foo.bar"),
      {
        category: "Foo",
        label: "Bar"
      }
    );
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("foo.bar.etc"),
      {
        category: "Foo \u203A Bar",
        label: "Etc"
      }
    );
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("fooBar.etcSomething"),
      {
        category: "Foo Bar",
        label: "Etc Something"
      }
    );
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("foo"),
      {
        category: "",
        label: "Foo"
      }
    );
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("foo.1leading.number"),
      {
        category: "Foo \u203A 1leading",
        label: "Number"
      }
    );
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("foo.1Leading.number"),
      {
        category: "Foo \u203A 1 Leading",
        label: "Number"
      }
    );
  });
  test("settingKeyToDisplayFormat - with category", () => {
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("foo.bar", "foo"),
      {
        category: "",
        label: "Bar"
      }
    );
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("disableligatures.ligatures", "disableligatures"),
      {
        category: "",
        label: "Ligatures"
      }
    );
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("foo.bar.etc", "foo"),
      {
        category: "Bar",
        label: "Etc"
      }
    );
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("fooBar.etcSomething", "foo"),
      {
        category: "Foo Bar",
        label: "Etc Something"
      }
    );
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("foo.bar.etc", "foo/bar"),
      {
        category: "",
        label: "Etc"
      }
    );
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("foo.bar.etc", "something/foo"),
      {
        category: "Bar",
        label: "Etc"
      }
    );
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("bar.etc", "something.bar"),
      {
        category: "",
        label: "Etc"
      }
    );
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("fooBar.etc", "fooBar"),
      {
        category: "",
        label: "Etc"
      }
    );
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("fooBar.somethingElse.etc", "fooBar"),
      {
        category: "Something Else",
        label: "Etc"
      }
    );
  });
  test("settingKeyToDisplayFormat - known acronym/term", () => {
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("css.someCssSetting"),
      {
        category: "CSS",
        label: "Some CSS Setting"
      }
    );
    assert.deepStrictEqual(
      settingKeyToDisplayFormat("powershell.somePowerShellSetting"),
      {
        category: "PowerShell",
        label: "Some PowerShell Setting"
      }
    );
  });
  test("parseQuery", () => {
    function testParseQuery(input, expected) {
      assert.deepStrictEqual(
        parseQuery(input),
        expected,
        input
      );
    }
    testParseQuery(
      "",
      {
        tags: [],
        extensionFilters: [],
        query: "",
        featureFilters: [],
        idFilters: [],
        languageFilter: void 0
      }
    );
    testParseQuery(
      "@modified",
      {
        tags: ["modified"],
        extensionFilters: [],
        query: "",
        featureFilters: [],
        idFilters: [],
        languageFilter: void 0
      }
    );
    testParseQuery(
      "@tag:foo",
      {
        tags: ["foo"],
        extensionFilters: [],
        query: "",
        featureFilters: [],
        idFilters: [],
        languageFilter: void 0
      }
    );
    testParseQuery(
      "@modified foo",
      {
        tags: ["modified"],
        extensionFilters: [],
        query: "foo",
        featureFilters: [],
        idFilters: [],
        languageFilter: void 0
      }
    );
    testParseQuery(
      "@tag:foo @modified",
      {
        tags: ["foo", "modified"],
        extensionFilters: [],
        query: "",
        featureFilters: [],
        idFilters: [],
        languageFilter: void 0
      }
    );
    testParseQuery(
      "@tag:foo @modified my query",
      {
        tags: ["foo", "modified"],
        extensionFilters: [],
        query: "my query",
        featureFilters: [],
        idFilters: [],
        languageFilter: void 0
      }
    );
    testParseQuery(
      "test @modified query",
      {
        tags: ["modified"],
        extensionFilters: [],
        query: "test  query",
        featureFilters: [],
        idFilters: [],
        languageFilter: void 0
      }
    );
    testParseQuery(
      "test @modified",
      {
        tags: ["modified"],
        extensionFilters: [],
        query: "test",
        featureFilters: [],
        idFilters: [],
        languageFilter: void 0
      }
    );
    testParseQuery(
      "query has @ for some reason",
      {
        tags: [],
        extensionFilters: [],
        query: "query has @ for some reason",
        featureFilters: [],
        idFilters: [],
        languageFilter: void 0
      }
    );
    testParseQuery(
      "@ext:github.vscode-pull-request-github",
      {
        tags: [],
        extensionFilters: ["github.vscode-pull-request-github"],
        query: "",
        featureFilters: [],
        idFilters: [],
        languageFilter: void 0
      }
    );
    testParseQuery(
      "@ext:github.vscode-pull-request-github,vscode.git",
      {
        tags: [],
        extensionFilters: ["github.vscode-pull-request-github", "vscode.git"],
        query: "",
        featureFilters: [],
        idFilters: [],
        languageFilter: void 0
      }
    );
    testParseQuery(
      "@feature:scm",
      {
        tags: [],
        extensionFilters: [],
        featureFilters: ["scm"],
        query: "",
        idFilters: [],
        languageFilter: void 0
      }
    );
    testParseQuery(
      "@feature:scm,terminal",
      {
        tags: [],
        extensionFilters: [],
        featureFilters: ["scm", "terminal"],
        query: "",
        idFilters: [],
        languageFilter: void 0
      }
    );
    testParseQuery(
      "@id:files.autoSave",
      {
        tags: [],
        extensionFilters: [],
        featureFilters: [],
        query: "",
        idFilters: ["files.autoSave"],
        languageFilter: void 0
      }
    );
    testParseQuery(
      "@id:files.autoSave,terminal.integrated.commandsToSkipShell",
      {
        tags: [],
        extensionFilters: [],
        featureFilters: [],
        query: "",
        idFilters: ["files.autoSave", "terminal.integrated.commandsToSkipShell"],
        languageFilter: void 0
      }
    );
    testParseQuery(
      "@lang:cpp",
      {
        tags: [],
        extensionFilters: [],
        featureFilters: [],
        query: "",
        idFilters: [],
        languageFilter: "cpp"
      }
    );
    testParseQuery(
      "@lang:cpp,python",
      {
        tags: [],
        extensionFilters: [],
        featureFilters: [],
        query: "",
        idFilters: [],
        languageFilter: "cpp"
      }
    );
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy90ZXN0L2Jyb3dzZXIvc2V0dGluZ3NUcmVlTW9kZWxzLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IHNldHRpbmdLZXlUb0Rpc3BsYXlGb3JtYXQsIHBhcnNlUXVlcnksIElQYXJzZWRRdWVyeSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc2V0dGluZ3NUcmVlTW9kZWxzLmpzJztcblxuc3VpdGUoJ1NldHRpbmdzVHJlZScsICgpID0+IHtcblx0dGVzdCgnc2V0dGluZ0tleVRvRGlzcGxheUZvcm1hdCcsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0c2V0dGluZ0tleVRvRGlzcGxheUZvcm1hdCgnZm9vLmJhcicpLFxuXHRcdFx0e1xuXHRcdFx0XHRjYXRlZ29yeTogJ0ZvbycsXG5cdFx0XHRcdGxhYmVsOiAnQmFyJ1xuXHRcdFx0fSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0c2V0dGluZ0tleVRvRGlzcGxheUZvcm1hdCgnZm9vLmJhci5ldGMnKSxcblx0XHRcdHtcblx0XHRcdFx0Y2F0ZWdvcnk6ICdGb28gXHUyMDNBIEJhcicsXG5cdFx0XHRcdGxhYmVsOiAnRXRjJ1xuXHRcdFx0fSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0c2V0dGluZ0tleVRvRGlzcGxheUZvcm1hdCgnZm9vQmFyLmV0Y1NvbWV0aGluZycpLFxuXHRcdFx0e1xuXHRcdFx0XHRjYXRlZ29yeTogJ0ZvbyBCYXInLFxuXHRcdFx0XHRsYWJlbDogJ0V0YyBTb21ldGhpbmcnXG5cdFx0XHR9KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRzZXR0aW5nS2V5VG9EaXNwbGF5Rm9ybWF0KCdmb28nKSxcblx0XHRcdHtcblx0XHRcdFx0Y2F0ZWdvcnk6ICcnLFxuXHRcdFx0XHRsYWJlbDogJ0Zvbydcblx0XHRcdH0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdHNldHRpbmdLZXlUb0Rpc3BsYXlGb3JtYXQoJ2Zvby4xbGVhZGluZy5udW1iZXInKSxcblx0XHRcdHtcblx0XHRcdFx0Y2F0ZWdvcnk6ICdGb28gXHUyMDNBIDFsZWFkaW5nJyxcblx0XHRcdFx0bGFiZWw6ICdOdW1iZXInXG5cdFx0XHR9KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRzZXR0aW5nS2V5VG9EaXNwbGF5Rm9ybWF0KCdmb28uMUxlYWRpbmcubnVtYmVyJyksXG5cdFx0XHR7XG5cdFx0XHRcdGNhdGVnb3J5OiAnRm9vIFx1MjAzQSAxIExlYWRpbmcnLFxuXHRcdFx0XHRsYWJlbDogJ051bWJlcidcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzZXR0aW5nS2V5VG9EaXNwbGF5Rm9ybWF0IC0gd2l0aCBjYXRlZ29yeScsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0c2V0dGluZ0tleVRvRGlzcGxheUZvcm1hdCgnZm9vLmJhcicsICdmb28nKSxcblx0XHRcdHtcblx0XHRcdFx0Y2F0ZWdvcnk6ICcnLFxuXHRcdFx0XHRsYWJlbDogJ0Jhcidcblx0XHRcdH0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdHNldHRpbmdLZXlUb0Rpc3BsYXlGb3JtYXQoJ2Rpc2FibGVsaWdhdHVyZXMubGlnYXR1cmVzJywgJ2Rpc2FibGVsaWdhdHVyZXMnKSxcblx0XHRcdHtcblx0XHRcdFx0Y2F0ZWdvcnk6ICcnLFxuXHRcdFx0XHRsYWJlbDogJ0xpZ2F0dXJlcydcblx0XHRcdH0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdHNldHRpbmdLZXlUb0Rpc3BsYXlGb3JtYXQoJ2Zvby5iYXIuZXRjJywgJ2ZvbycpLFxuXHRcdFx0e1xuXHRcdFx0XHRjYXRlZ29yeTogJ0JhcicsXG5cdFx0XHRcdGxhYmVsOiAnRXRjJ1xuXHRcdFx0fSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0c2V0dGluZ0tleVRvRGlzcGxheUZvcm1hdCgnZm9vQmFyLmV0Y1NvbWV0aGluZycsICdmb28nKSxcblx0XHRcdHtcblx0XHRcdFx0Y2F0ZWdvcnk6ICdGb28gQmFyJyxcblx0XHRcdFx0bGFiZWw6ICdFdGMgU29tZXRoaW5nJ1xuXHRcdFx0fSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0c2V0dGluZ0tleVRvRGlzcGxheUZvcm1hdCgnZm9vLmJhci5ldGMnLCAnZm9vL2JhcicpLFxuXHRcdFx0e1xuXHRcdFx0XHRjYXRlZ29yeTogJycsXG5cdFx0XHRcdGxhYmVsOiAnRXRjJ1xuXHRcdFx0fSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0c2V0dGluZ0tleVRvRGlzcGxheUZvcm1hdCgnZm9vLmJhci5ldGMnLCAnc29tZXRoaW5nL2ZvbycpLFxuXHRcdFx0e1xuXHRcdFx0XHRjYXRlZ29yeTogJ0JhcicsXG5cdFx0XHRcdGxhYmVsOiAnRXRjJ1xuXHRcdFx0fSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0c2V0dGluZ0tleVRvRGlzcGxheUZvcm1hdCgnYmFyLmV0YycsICdzb21ldGhpbmcuYmFyJyksXG5cdFx0XHR7XG5cdFx0XHRcdGNhdGVnb3J5OiAnJyxcblx0XHRcdFx0bGFiZWw6ICdFdGMnXG5cdFx0XHR9KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRzZXR0aW5nS2V5VG9EaXNwbGF5Rm9ybWF0KCdmb29CYXIuZXRjJywgJ2Zvb0JhcicpLFxuXHRcdFx0e1xuXHRcdFx0XHRjYXRlZ29yeTogJycsXG5cdFx0XHRcdGxhYmVsOiAnRXRjJ1xuXHRcdFx0fSk7XG5cblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRzZXR0aW5nS2V5VG9EaXNwbGF5Rm9ybWF0KCdmb29CYXIuc29tZXRoaW5nRWxzZS5ldGMnLCAnZm9vQmFyJyksXG5cdFx0XHR7XG5cdFx0XHRcdGNhdGVnb3J5OiAnU29tZXRoaW5nIEVsc2UnLFxuXHRcdFx0XHRsYWJlbDogJ0V0Yydcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzZXR0aW5nS2V5VG9EaXNwbGF5Rm9ybWF0IC0ga25vd24gYWNyb255bS90ZXJtJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRzZXR0aW5nS2V5VG9EaXNwbGF5Rm9ybWF0KCdjc3Muc29tZUNzc1NldHRpbmcnKSxcblx0XHRcdHtcblx0XHRcdFx0Y2F0ZWdvcnk6ICdDU1MnLFxuXHRcdFx0XHRsYWJlbDogJ1NvbWUgQ1NTIFNldHRpbmcnXG5cdFx0XHR9KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRzZXR0aW5nS2V5VG9EaXNwbGF5Rm9ybWF0KCdwb3dlcnNoZWxsLnNvbWVQb3dlclNoZWxsU2V0dGluZycpLFxuXHRcdFx0e1xuXHRcdFx0XHRjYXRlZ29yeTogJ1Bvd2VyU2hlbGwnLFxuXHRcdFx0XHRsYWJlbDogJ1NvbWUgUG93ZXJTaGVsbCBTZXR0aW5nJ1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BhcnNlUXVlcnknLCAoKSA9PiB7XG5cdFx0ZnVuY3Rpb24gdGVzdFBhcnNlUXVlcnkoaW5wdXQ6IHN0cmluZywgZXhwZWN0ZWQ6IElQYXJzZWRRdWVyeSkge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0cGFyc2VRdWVyeShpbnB1dCksXG5cdFx0XHRcdGV4cGVjdGVkLFxuXHRcdFx0XHRpbnB1dFxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHR0ZXN0UGFyc2VRdWVyeShcblx0XHRcdCcnLFxuXHRcdFx0PElQYXJzZWRRdWVyeT57XG5cdFx0XHRcdHRhZ3M6IFtdLFxuXHRcdFx0XHRleHRlbnNpb25GaWx0ZXJzOiBbXSxcblx0XHRcdFx0cXVlcnk6ICcnLFxuXHRcdFx0XHRmZWF0dXJlRmlsdGVyczogW10sXG5cdFx0XHRcdGlkRmlsdGVyczogW10sXG5cdFx0XHRcdGxhbmd1YWdlRmlsdGVyOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXG5cdFx0dGVzdFBhcnNlUXVlcnkoXG5cdFx0XHQnQG1vZGlmaWVkJyxcblx0XHRcdDxJUGFyc2VkUXVlcnk+e1xuXHRcdFx0XHR0YWdzOiBbJ21vZGlmaWVkJ10sXG5cdFx0XHRcdGV4dGVuc2lvbkZpbHRlcnM6IFtdLFxuXHRcdFx0XHRxdWVyeTogJycsXG5cdFx0XHRcdGZlYXR1cmVGaWx0ZXJzOiBbXSxcblx0XHRcdFx0aWRGaWx0ZXJzOiBbXSxcblx0XHRcdFx0bGFuZ3VhZ2VGaWx0ZXI6IHVuZGVmaW5lZFxuXHRcdFx0fSk7XG5cblx0XHR0ZXN0UGFyc2VRdWVyeShcblx0XHRcdCdAdGFnOmZvbycsXG5cdFx0XHQ8SVBhcnNlZFF1ZXJ5Pntcblx0XHRcdFx0dGFnczogWydmb28nXSxcblx0XHRcdFx0ZXh0ZW5zaW9uRmlsdGVyczogW10sXG5cdFx0XHRcdHF1ZXJ5OiAnJyxcblx0XHRcdFx0ZmVhdHVyZUZpbHRlcnM6IFtdLFxuXHRcdFx0XHRpZEZpbHRlcnM6IFtdLFxuXHRcdFx0XHRsYW5ndWFnZUZpbHRlcjogdW5kZWZpbmVkXG5cdFx0XHR9KTtcblxuXHRcdHRlc3RQYXJzZVF1ZXJ5KFxuXHRcdFx0J0Btb2RpZmllZCBmb28nLFxuXHRcdFx0PElQYXJzZWRRdWVyeT57XG5cdFx0XHRcdHRhZ3M6IFsnbW9kaWZpZWQnXSxcblx0XHRcdFx0ZXh0ZW5zaW9uRmlsdGVyczogW10sXG5cdFx0XHRcdHF1ZXJ5OiAnZm9vJyxcblx0XHRcdFx0ZmVhdHVyZUZpbHRlcnM6IFtdLFxuXHRcdFx0XHRpZEZpbHRlcnM6IFtdLFxuXHRcdFx0XHRsYW5ndWFnZUZpbHRlcjogdW5kZWZpbmVkXG5cdFx0XHR9KTtcblxuXHRcdHRlc3RQYXJzZVF1ZXJ5KFxuXHRcdFx0J0B0YWc6Zm9vIEBtb2RpZmllZCcsXG5cdFx0XHQ8SVBhcnNlZFF1ZXJ5Pntcblx0XHRcdFx0dGFnczogWydmb28nLCAnbW9kaWZpZWQnXSxcblx0XHRcdFx0ZXh0ZW5zaW9uRmlsdGVyczogW10sXG5cdFx0XHRcdHF1ZXJ5OiAnJyxcblx0XHRcdFx0ZmVhdHVyZUZpbHRlcnM6IFtdLFxuXHRcdFx0XHRpZEZpbHRlcnM6IFtdLFxuXHRcdFx0XHRsYW5ndWFnZUZpbHRlcjogdW5kZWZpbmVkXG5cdFx0XHR9KTtcblxuXHRcdHRlc3RQYXJzZVF1ZXJ5KFxuXHRcdFx0J0B0YWc6Zm9vIEBtb2RpZmllZCBteSBxdWVyeScsXG5cdFx0XHQ8SVBhcnNlZFF1ZXJ5Pntcblx0XHRcdFx0dGFnczogWydmb28nLCAnbW9kaWZpZWQnXSxcblx0XHRcdFx0ZXh0ZW5zaW9uRmlsdGVyczogW10sXG5cdFx0XHRcdHF1ZXJ5OiAnbXkgcXVlcnknLFxuXHRcdFx0XHRmZWF0dXJlRmlsdGVyczogW10sXG5cdFx0XHRcdGlkRmlsdGVyczogW10sXG5cdFx0XHRcdGxhbmd1YWdlRmlsdGVyOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXG5cdFx0dGVzdFBhcnNlUXVlcnkoXG5cdFx0XHQndGVzdCBAbW9kaWZpZWQgcXVlcnknLFxuXHRcdFx0PElQYXJzZWRRdWVyeT57XG5cdFx0XHRcdHRhZ3M6IFsnbW9kaWZpZWQnXSxcblx0XHRcdFx0ZXh0ZW5zaW9uRmlsdGVyczogW10sXG5cdFx0XHRcdHF1ZXJ5OiAndGVzdCAgcXVlcnknLFxuXHRcdFx0XHRmZWF0dXJlRmlsdGVyczogW10sXG5cdFx0XHRcdGlkRmlsdGVyczogW10sXG5cdFx0XHRcdGxhbmd1YWdlRmlsdGVyOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXG5cdFx0dGVzdFBhcnNlUXVlcnkoXG5cdFx0XHQndGVzdCBAbW9kaWZpZWQnLFxuXHRcdFx0PElQYXJzZWRRdWVyeT57XG5cdFx0XHRcdHRhZ3M6IFsnbW9kaWZpZWQnXSxcblx0XHRcdFx0ZXh0ZW5zaW9uRmlsdGVyczogW10sXG5cdFx0XHRcdHF1ZXJ5OiAndGVzdCcsXG5cdFx0XHRcdGZlYXR1cmVGaWx0ZXJzOiBbXSxcblx0XHRcdFx0aWRGaWx0ZXJzOiBbXSxcblx0XHRcdFx0bGFuZ3VhZ2VGaWx0ZXI6IHVuZGVmaW5lZFxuXHRcdFx0fSk7XG5cblx0XHR0ZXN0UGFyc2VRdWVyeShcblx0XHRcdCdxdWVyeSBoYXMgQCBmb3Igc29tZSByZWFzb24nLFxuXHRcdFx0PElQYXJzZWRRdWVyeT57XG5cdFx0XHRcdHRhZ3M6IFtdLFxuXHRcdFx0XHRleHRlbnNpb25GaWx0ZXJzOiBbXSxcblx0XHRcdFx0cXVlcnk6ICdxdWVyeSBoYXMgQCBmb3Igc29tZSByZWFzb24nLFxuXHRcdFx0XHRmZWF0dXJlRmlsdGVyczogW10sXG5cdFx0XHRcdGlkRmlsdGVyczogW10sXG5cdFx0XHRcdGxhbmd1YWdlRmlsdGVyOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXG5cdFx0dGVzdFBhcnNlUXVlcnkoXG5cdFx0XHQnQGV4dDpnaXRodWIudnNjb2RlLXB1bGwtcmVxdWVzdC1naXRodWInLFxuXHRcdFx0PElQYXJzZWRRdWVyeT57XG5cdFx0XHRcdHRhZ3M6IFtdLFxuXHRcdFx0XHRleHRlbnNpb25GaWx0ZXJzOiBbJ2dpdGh1Yi52c2NvZGUtcHVsbC1yZXF1ZXN0LWdpdGh1YiddLFxuXHRcdFx0XHRxdWVyeTogJycsXG5cdFx0XHRcdGZlYXR1cmVGaWx0ZXJzOiBbXSxcblx0XHRcdFx0aWRGaWx0ZXJzOiBbXSxcblx0XHRcdFx0bGFuZ3VhZ2VGaWx0ZXI6IHVuZGVmaW5lZFxuXHRcdFx0fSk7XG5cblx0XHR0ZXN0UGFyc2VRdWVyeShcblx0XHRcdCdAZXh0OmdpdGh1Yi52c2NvZGUtcHVsbC1yZXF1ZXN0LWdpdGh1Yix2c2NvZGUuZ2l0Jyxcblx0XHRcdDxJUGFyc2VkUXVlcnk+e1xuXHRcdFx0XHR0YWdzOiBbXSxcblx0XHRcdFx0ZXh0ZW5zaW9uRmlsdGVyczogWydnaXRodWIudnNjb2RlLXB1bGwtcmVxdWVzdC1naXRodWInLCAndnNjb2RlLmdpdCddLFxuXHRcdFx0XHRxdWVyeTogJycsXG5cdFx0XHRcdGZlYXR1cmVGaWx0ZXJzOiBbXSxcblx0XHRcdFx0aWRGaWx0ZXJzOiBbXSxcblx0XHRcdFx0bGFuZ3VhZ2VGaWx0ZXI6IHVuZGVmaW5lZFxuXHRcdFx0fSk7XG5cdFx0dGVzdFBhcnNlUXVlcnkoXG5cdFx0XHQnQGZlYXR1cmU6c2NtJyxcblx0XHRcdDxJUGFyc2VkUXVlcnk+e1xuXHRcdFx0XHR0YWdzOiBbXSxcblx0XHRcdFx0ZXh0ZW5zaW9uRmlsdGVyczogW10sXG5cdFx0XHRcdGZlYXR1cmVGaWx0ZXJzOiBbJ3NjbSddLFxuXHRcdFx0XHRxdWVyeTogJycsXG5cdFx0XHRcdGlkRmlsdGVyczogW10sXG5cdFx0XHRcdGxhbmd1YWdlRmlsdGVyOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXG5cdFx0dGVzdFBhcnNlUXVlcnkoXG5cdFx0XHQnQGZlYXR1cmU6c2NtLHRlcm1pbmFsJyxcblx0XHRcdDxJUGFyc2VkUXVlcnk+e1xuXHRcdFx0XHR0YWdzOiBbXSxcblx0XHRcdFx0ZXh0ZW5zaW9uRmlsdGVyczogW10sXG5cdFx0XHRcdGZlYXR1cmVGaWx0ZXJzOiBbJ3NjbScsICd0ZXJtaW5hbCddLFxuXHRcdFx0XHRxdWVyeTogJycsXG5cdFx0XHRcdGlkRmlsdGVyczogW10sXG5cdFx0XHRcdGxhbmd1YWdlRmlsdGVyOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXHRcdHRlc3RQYXJzZVF1ZXJ5KFxuXHRcdFx0J0BpZDpmaWxlcy5hdXRvU2F2ZScsXG5cdFx0XHQ8SVBhcnNlZFF1ZXJ5Pntcblx0XHRcdFx0dGFnczogW10sXG5cdFx0XHRcdGV4dGVuc2lvbkZpbHRlcnM6IFtdLFxuXHRcdFx0XHRmZWF0dXJlRmlsdGVyczogW10sXG5cdFx0XHRcdHF1ZXJ5OiAnJyxcblx0XHRcdFx0aWRGaWx0ZXJzOiBbJ2ZpbGVzLmF1dG9TYXZlJ10sXG5cdFx0XHRcdGxhbmd1YWdlRmlsdGVyOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXG5cdFx0dGVzdFBhcnNlUXVlcnkoXG5cdFx0XHQnQGlkOmZpbGVzLmF1dG9TYXZlLHRlcm1pbmFsLmludGVncmF0ZWQuY29tbWFuZHNUb1NraXBTaGVsbCcsXG5cdFx0XHQ8SVBhcnNlZFF1ZXJ5Pntcblx0XHRcdFx0dGFnczogW10sXG5cdFx0XHRcdGV4dGVuc2lvbkZpbHRlcnM6IFtdLFxuXHRcdFx0XHRmZWF0dXJlRmlsdGVyczogW10sXG5cdFx0XHRcdHF1ZXJ5OiAnJyxcblx0XHRcdFx0aWRGaWx0ZXJzOiBbJ2ZpbGVzLmF1dG9TYXZlJywgJ3Rlcm1pbmFsLmludGVncmF0ZWQuY29tbWFuZHNUb1NraXBTaGVsbCddLFxuXHRcdFx0XHRsYW5ndWFnZUZpbHRlcjogdW5kZWZpbmVkXG5cdFx0XHR9KTtcblxuXHRcdHRlc3RQYXJzZVF1ZXJ5KFxuXHRcdFx0J0BsYW5nOmNwcCcsXG5cdFx0XHQ8SVBhcnNlZFF1ZXJ5Pntcblx0XHRcdFx0dGFnczogW10sXG5cdFx0XHRcdGV4dGVuc2lvbkZpbHRlcnM6IFtdLFxuXHRcdFx0XHRmZWF0dXJlRmlsdGVyczogW10sXG5cdFx0XHRcdHF1ZXJ5OiAnJyxcblx0XHRcdFx0aWRGaWx0ZXJzOiBbXSxcblx0XHRcdFx0bGFuZ3VhZ2VGaWx0ZXI6ICdjcHAnXG5cdFx0XHR9KTtcblxuXHRcdHRlc3RQYXJzZVF1ZXJ5KFxuXHRcdFx0J0BsYW5nOmNwcCxweXRob24nLFxuXHRcdFx0PElQYXJzZWRRdWVyeT57XG5cdFx0XHRcdHRhZ3M6IFtdLFxuXHRcdFx0XHRleHRlbnNpb25GaWx0ZXJzOiBbXSxcblx0XHRcdFx0ZmVhdHVyZUZpbHRlcnM6IFtdLFxuXHRcdFx0XHRxdWVyeTogJycsXG5cdFx0XHRcdGlkRmlsdGVyczogW10sXG5cdFx0XHRcdGxhbmd1YWdlRmlsdGVyOiAnY3BwJ1xuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUywyQkFBMkIsa0JBQWdDO0FBRXBFLE1BQU0sZ0JBQWdCLE1BQU07QUFDM0IsT0FBSyw2QkFBNkIsTUFBTTtBQUN2QyxXQUFPO0FBQUEsTUFDTiwwQkFBMEIsU0FBUztBQUFBLE1BQ25DO0FBQUEsUUFDQyxVQUFVO0FBQUEsUUFDVixPQUFPO0FBQUEsTUFDUjtBQUFBLElBQUM7QUFFRixXQUFPO0FBQUEsTUFDTiwwQkFBMEIsYUFBYTtBQUFBLE1BQ3ZDO0FBQUEsUUFDQyxVQUFVO0FBQUEsUUFDVixPQUFPO0FBQUEsTUFDUjtBQUFBLElBQUM7QUFFRixXQUFPO0FBQUEsTUFDTiwwQkFBMEIscUJBQXFCO0FBQUEsTUFDL0M7QUFBQSxRQUNDLFVBQVU7QUFBQSxRQUNWLE9BQU87QUFBQSxNQUNSO0FBQUEsSUFBQztBQUVGLFdBQU87QUFBQSxNQUNOLDBCQUEwQixL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
