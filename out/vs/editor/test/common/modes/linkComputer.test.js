import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { computeLinks } from "../../../common/languages/linkComputer.js";
class SimpleLinkComputerTarget {
  constructor(_lines) {
    this._lines = _lines;
  }
  getLineCount() {
    return this._lines.length;
  }
  getLineContent(lineNumber) {
    return this._lines[lineNumber - 1];
  }
}
function myComputeLinks(lines) {
  const target = new SimpleLinkComputerTarget(lines);
  return computeLinks(target);
}
function assertLink(text, extractedLink) {
  let startColumn = 0, endColumn = 0, chr, i = 0;
  for (i = 0; i < extractedLink.length; i++) {
    chr = extractedLink.charAt(i);
    if (chr !== " " && chr !== "	") {
      startColumn = i + 1;
      break;
    }
  }
  for (i = extractedLink.length - 1; i >= 0; i--) {
    chr = extractedLink.charAt(i);
    if (chr !== " " && chr !== "	") {
      endColumn = i + 2;
      break;
    }
  }
  const r = myComputeLinks([text]);
  assert.deepStrictEqual(r, [{
    range: {
      startLineNumber: 1,
      startColumn,
      endLineNumber: 1,
      endColumn
    },
    url: extractedLink.substring(startColumn - 1, endColumn - 1)
  }]);
}
suite("Editor Modes - Link Computer", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Null model", () => {
    const r = computeLinks(null);
    assert.deepStrictEqual(r, []);
  });
  test("Parsing", () => {
    assertLink(
      'x = "http://foo.bar";',
      "     http://foo.bar  "
    );
    assertLink(
      "x = (http://foo.bar);",
      "     http://foo.bar  "
    );
    assertLink(
      "x = [http://foo.bar];",
      "     http://foo.bar  "
    );
    assertLink(
      "x = 'http://foo.bar';",
      "     http://foo.bar  "
    );
    assertLink(
      "x =  http://foo.bar ;",
      "     http://foo.bar  "
    );
    assertLink(
      "x = <http://foo.bar>;",
      "     http://foo.bar  "
    );
    assertLink(
      "x = {http://foo.bar};",
      "     http://foo.bar  "
    );
    assertLink(
      "(see http://foo.bar)",
      "     http://foo.bar  "
    );
    assertLink(
      "[see http://foo.bar]",
      "     http://foo.bar  "
    );
    assertLink(
      "{see http://foo.bar}",
      "     http://foo.bar  "
    );
    assertLink(
      "<see http://foo.bar>",
      "     http://foo.bar  "
    );
    assertLink(
      "<url>http://mylink.com</url>",
      "     http://mylink.com      "
    );
    assertLink(
      "// Click here to learn more. https://go.microsoft.com/fwlink/?LinkID=513275&clcid=0x409",
      "                             https://go.microsoft.com/fwlink/?LinkID=513275&clcid=0x409"
    );
    assertLink(
      "// Click here to learn more. https://msdn.microsoft.com/en-us/library/windows/desktop/aa365247(v=vs.85).aspx",
      "                             https://msdn.microsoft.com/en-us/library/windows/desktop/aa365247(v=vs.85).aspx"
    );
    assertLink(
      "// https://github.com/projectkudu/kudu/blob/master/Kudu.Core/Scripts/selectNodeVersion.js",
      "   https://github.com/projectkudu/kudu/blob/master/Kudu.Core/Scripts/selectNodeVersion.js"
    );
    assertLink(
      "<!-- !!! Do not remove !!!   WebContentRef(link:https://go.microsoft.com/fwlink/?LinkId=166007, area:Admin, updated:2015, nextUpdate:2016, tags:SqlServer)   !!! Do not remove !!! -->",
      "                                                https://go.microsoft.com/fwlink/?LinkId=166007                                                                                        "
    );
    assertLink(
      "For instructions, see https://go.microsoft.com/fwlink/?LinkId=166007.</value>",
      "                      https://go.microsoft.com/fwlink/?LinkId=166007         "
    );
    assertLink(
      "For instructions, see https://msdn.microsoft.com/en-us/library/windows/desktop/aa365247(v=vs.85).aspx.</value>",
      "                      https://msdn.microsoft.com/en-us/library/windows/desktop/aa365247(v=vs.85).aspx         "
    );
    assertLink(
      'x = "https://en.wikipedia.org/wiki/Z\xFCrich";',
      "     https://en.wikipedia.org/wiki/Z\xFCrich  "
    );
    assertLink(
      "\u8ACB\u53C3\u95B1 http://go.microsoft.com/fwlink/?LinkId=761051\u3002",
      "    http://go.microsoft.com/fwlink/?LinkId=761051 "
    );
    assertLink(
      "\uFF08\u8ACB\u53C3\u95B1 http://go.microsoft.com/fwlink/?LinkId=761051\uFF09",
      "     http://go.microsoft.com/fwlink/?LinkId=761051 "
    );
    assertLink(
      'x = "file:///foo.bar";',
      "     file:///foo.bar  "
    );
    assertLink(
      'x = "file://c:/foo.bar";',
      "     file://c:/foo.bar  "
    );
    assertLink(
      'x = "file://shares/foo.bar";',
      "     file://shares/foo.bar  "
    );
    assertLink(
      'x = "file://sh\xE4res/foo.bar";',
      "     file://sh\xE4res/foo.bar  "
    );
    assertLink(
      "Some text, then http://www.bing.com.",
      "                http://www.bing.com "
    );
    assertLink(
      "let url = `http://***/_api/web/lists/GetByTitle('Teambuildingaanvragen')/items`;",
      "           http://***/_api/web/lists/GetByTitle('Teambuildingaanvragen')/items  "
    );
  });
  test("issue #7855", () => {
    assertLink(
      "7. At this point, ServiceMain has been called.  There is no functionality presently in ServiceMain, but you can consult the [MSDN documentation](https://msdn.microsoft.com/en-us/library/windows/desktop/ms687414(v=vs.85).aspx) to add functionality as desired!",
      "                                                                                                                                                 https://msdn.microsoft.com/en-us/library/windows/desktop/ms687414(v=vs.85).aspx                                  "
    );
  });
  test('issue #62278: "Ctrl + click to follow link" for IPv6 URLs', () => {
    assertLink(
      'let x = "http://[::1]:5000/connect/token"',
      "         http://[::1]:5000/connect/token  "
    );
  });
  test("issue #70254: bold links dont open in markdown file using editor mode with ctrl + click", () => {
    assertLink(
      "2. Navigate to **https://portal.azure.com**",
      "                 https://portal.azure.com  "
    );
  });
  test("issue #86358: URL wrong recognition pattern", () => {
    assertLink(
      "POST|https://portal.azure.com|2019-12-05|",
      "     https://portal.azure.com            "
    );
  });
  test("issue #67022: Space as end of hyperlink isn't always good idea", () => {
    assertLink(
      "aa  https://foo.bar/[this is foo site]  aa",
      "    https://foo.bar/[this is foo site]    "
    );
  });
  test("issue #100353: Link detection stops at \uFF06(double-byte)", () => {
    assertLink(
      "aa  http://tree-mark.chips.jp/\u30EC\u30FC\u30BA\u30F3\uFF06\u30D9\u30EA\u30FC\u30DF\u30C3\u30AF\u30B9  aa",
      "    http://tree-mark.chips.jp/\u30EC\u30FC\u30BA\u30F3\uFF06\u30D9\u30EA\u30FC\u30DF\u30C3\u30AF\u30B9    "
    );
  });
  test("issue #121438: Link detection stops at\u3010...\u3011", () => {
    assertLink(
      "aa  https://zh.wikipedia.org/wiki/\u3010\u6211\u63A8\u7684\u5B69\u5B50\u3011 aa",
      "    https://zh.wikipedia.org/wiki/\u3010\u6211\u63A8\u7684\u5B69\u5B50\u3011   "
    );
  });
  test("issue #121438: Link detection stops at\u300A...\u300B", () => {
    assertLink(
      "aa  https://zh.wikipedia.org/wiki/\u300A\u65B0\u9752\u5E74\u300B\u7F16\u8F91\u90E8\u65E7\u5740 aa",
      "    https://zh.wikipedia.org/wiki/\u300A\u65B0\u9752\u5E74\u300B\u7F16\u8F91\u90E8\u65E7\u5740   "
    );
  });
  test("issue #121438: Link detection stops at \u201C...\u201D", () => {
    assertLink(
      "aa  https://zh.wikipedia.org/wiki/\u201C\u5E38\u51EF\u7533\u201D\u8BEF\u8BD1\u4E8B\u4EF6 aa",
      "    https://zh.wikipedia.org/wiki/\u201C\u5E38\u51EF\u7533\u201D\u8BEF\u8BD1\u4E8B\u4EF6   "
    );
  });
  test("issue #150905: Colon after bare hyperlink is treated as its part", () => {
    assertLink(
      "https://site.web/page.html: blah blah blah",
      "https://site.web/page.html                "
    );
  });
  test("issue #156875: Links include quotes ", () => {
    assertLink(
      `"This file has been converted from https://github.com/jeff-hykin/better-c-syntax/blob/master/autogenerated/c.tmLanguage.json",`,
      `                                   https://github.com/jeff-hykin/better-c-syntax/blob/master/autogenerated/c.tmLanguage.json  `
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZXMvbGlua0NvbXB1dGVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBJTGluayB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSUxpbmtDb21wdXRlclRhcmdldCwgY29tcHV0ZUxpbmtzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9saW5rQ29tcHV0ZXIuanMnO1xuXG5jbGFzcyBTaW1wbGVMaW5rQ29tcHV0ZXJUYXJnZXQgaW1wbGVtZW50cyBJTGlua0NvbXB1dGVyVGFyZ2V0IHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIF9saW5lczogc3RyaW5nW10pIHtcblx0XHQvLyBJbnRlbnRpb25hbCBFbXB0eVxuXHR9XG5cblx0cHVibGljIGdldExpbmVDb3VudCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9saW5lcy5sZW5ndGg7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGluZUNvbnRlbnQobGluZU51bWJlcjogbnVtYmVyKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZXNbbGluZU51bWJlciAtIDFdO1xuXHR9XG59XG5cbmZ1bmN0aW9uIG15Q29tcHV0ZUxpbmtzKGxpbmVzOiBzdHJpbmdbXSk6IElMaW5rW10ge1xuXHRjb25zdCB0YXJnZXQgPSBuZXcgU2ltcGxlTGlua0NvbXB1dGVyVGFyZ2V0KGxpbmVzKTtcblx0cmV0dXJuIGNvbXB1dGVMaW5rcyh0YXJnZXQpO1xufVxuXG5mdW5jdGlvbiBhc3NlcnRMaW5rKHRleHQ6IHN0cmluZywgZXh0cmFjdGVkTGluazogc3RyaW5nKTogdm9pZCB7XG5cdGxldCBzdGFydENvbHVtbiA9IDAsXG5cdFx0ZW5kQ29sdW1uID0gMCxcblx0XHRjaHI6IHN0cmluZyxcblx0XHRpID0gMDtcblxuXHRmb3IgKGkgPSAwOyBpIDwgZXh0cmFjdGVkTGluay5sZW5ndGg7IGkrKykge1xuXHRcdGNociA9IGV4dHJhY3RlZExpbmsuY2hhckF0KGkpO1xuXHRcdGlmIChjaHIgIT09ICcgJyAmJiBjaHIgIT09ICdcXHQnKSB7XG5cdFx0XHRzdGFydENvbHVtbiA9IGkgKyAxO1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9XG5cblx0Zm9yIChpID0gZXh0cmFjdGVkTGluay5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdGNociA9IGV4dHJhY3RlZExpbmsuY2hhckF0KGkpO1xuXHRcdGlmIChjaHIgIT09ICcgJyAmJiBjaHIgIT09ICdcXHQnKSB7XG5cdFx0XHRlbmRDb2x1bW4gPSBpICsgMjtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IHIgPSBteUNvbXB1dGVMaW5rcyhbdGV4dF0pO1xuXHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHIsIFt7XG5cdFx0cmFuZ2U6IHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogMSxcblx0XHRcdHN0YXJ0Q29sdW1uOiBzdGFydENvbHVtbixcblx0XHRcdGVuZExpbmVOdW1iZXI6IDEsXG5cdFx0XHRlbmRDb2x1bW46IGVuZENvbHVtblxuXHRcdH0sXG5cdFx0dXJsOiBleHRyYWN0ZWRMaW5rLnN1YnN0cmluZyhzdGFydENvbHVtbiAtIDEsIGVuZENvbHVtbiAtIDEpXG5cdH1dKTtcbn1cblxuc3VpdGUoJ0VkaXRvciBNb2RlcyAtIExpbmsgQ29tcHV0ZXInLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnTnVsbCBtb2RlbCcsICgpID0+IHtcblx0XHRjb25zdCByID0gY29tcHV0ZUxpbmtzKG51bGwpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwociwgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdQYXJzaW5nJywgKCkgPT4ge1xuXG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCd4ID0gXCJodHRwOi8vZm9vLmJhclwiOycsXG5cdFx0XHQnICAgICBodHRwOi8vZm9vLmJhciAgJ1xuXHRcdCk7XG5cblx0XHRhc3NlcnRMaW5rKFxuXHRcdFx0J3ggPSAoaHR0cDovL2Zvby5iYXIpOycsXG5cdFx0XHQnICAgICBodHRwOi8vZm9vLmJhciAgJ1xuXHRcdCk7XG5cblx0XHRhc3NlcnRMaW5rKFxuXHRcdFx0J3ggPSBbaHR0cDovL2Zvby5iYXJdOycsXG5cdFx0XHQnICAgICBodHRwOi8vZm9vLmJhciAgJ1xuXHRcdCk7XG5cblx0XHRhc3NlcnRMaW5rKFxuXHRcdFx0J3ggPSBcXCdodHRwOi8vZm9vLmJhclxcJzsnLFxuXHRcdFx0JyAgICAgaHR0cDovL2Zvby5iYXIgICdcblx0XHQpO1xuXG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCd4ID0gIGh0dHA6Ly9mb28uYmFyIDsnLFxuXHRcdFx0JyAgICAgaHR0cDovL2Zvby5iYXIgICdcblx0XHQpO1xuXG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCd4ID0gPGh0dHA6Ly9mb28uYmFyPjsnLFxuXHRcdFx0JyAgICAgaHR0cDovL2Zvby5iYXIgICdcblx0XHQpO1xuXG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCd4ID0ge2h0dHA6Ly9mb28uYmFyfTsnLFxuXHRcdFx0JyAgICAgaHR0cDovL2Zvby5iYXIgICdcblx0XHQpO1xuXG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCcoc2VlIGh0dHA6Ly9mb28uYmFyKScsXG5cdFx0XHQnICAgICBodHRwOi8vZm9vLmJhciAgJ1xuXHRcdCk7XG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCdbc2VlIGh0dHA6Ly9mb28uYmFyXScsXG5cdFx0XHQnICAgICBodHRwOi8vZm9vLmJhciAgJ1xuXHRcdCk7XG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCd7c2VlIGh0dHA6Ly9mb28uYmFyfScsXG5cdFx0XHQnICAgICBodHRwOi8vZm9vLmJhciAgJ1xuXHRcdCk7XG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCc8c2VlIGh0dHA6Ly9mb28uYmFyPicsXG5cdFx0XHQnICAgICBodHRwOi8vZm9vLmJhciAgJ1xuXHRcdCk7XG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCc8dXJsPmh0dHA6Ly9teWxpbmsuY29tPC91cmw+Jyxcblx0XHRcdCcgICAgIGh0dHA6Ly9teWxpbmsuY29tICAgICAgJ1xuXHRcdCk7XG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCcvLyBDbGljayBoZXJlIHRvIGxlYXJuIG1vcmUuIGh0dHBzOi8vZ28ubWljcm9zb2Z0LmNvbS9md2xpbmsvP0xpbmtJRD01MTMyNzUmY2xjaWQ9MHg0MDknLFxuXHRcdFx0JyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaHR0cHM6Ly9nby5taWNyb3NvZnQuY29tL2Z3bGluay8/TGlua0lEPTUxMzI3NSZjbGNpZD0weDQwOSdcblx0XHQpO1xuXHRcdGFzc2VydExpbmsoXG5cdFx0XHQnLy8gQ2xpY2sgaGVyZSB0byBsZWFybiBtb3JlLiBodHRwczovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L3dpbmRvd3MvZGVza3RvcC9hYTM2NTI0Nyh2PXZzLjg1KS5hc3B4Jyxcblx0XHRcdCcgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGh0dHBzOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvd2luZG93cy9kZXNrdG9wL2FhMzY1MjQ3KHY9dnMuODUpLmFzcHgnXG5cdFx0KTtcblx0XHRhc3NlcnRMaW5rKFxuXHRcdFx0Jy8vIGh0dHBzOi8vZ2l0aHViLmNvbS9wcm9qZWN0a3VkdS9rdWR1L2Jsb2IvbWFzdGVyL0t1ZHUuQ29yZS9TY3JpcHRzL3NlbGVjdE5vZGVWZXJzaW9uLmpzJyxcblx0XHRcdCcgICBodHRwczovL2dpdGh1Yi5jb20vcHJvamVjdGt1ZHUva3VkdS9ibG9iL21hc3Rlci9LdWR1LkNvcmUvU2NyaXB0cy9zZWxlY3ROb2RlVmVyc2lvbi5qcydcblx0XHQpO1xuXHRcdGFzc2VydExpbmsoXG5cdFx0XHQnPCEtLSAhISEgRG8gbm90IHJlbW92ZSAhISEgICBXZWJDb250ZW50UmVmKGxpbms6aHR0cHM6Ly9nby5taWNyb3NvZnQuY29tL2Z3bGluay8/TGlua0lkPTE2NjAwNywgYXJlYTpBZG1pbiwgdXBkYXRlZDoyMDE1LCBuZXh0VXBkYXRlOjIwMTYsIHRhZ3M6U3FsU2VydmVyKSAgICEhISBEbyBub3QgcmVtb3ZlICEhISAtLT4nLFxuXHRcdFx0JyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGh0dHBzOi8vZ28ubWljcm9zb2Z0LmNvbS9md2xpbmsvP0xpbmtJZD0xNjYwMDcgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1xuXHRcdCk7XG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCdGb3IgaW5zdHJ1Y3Rpb25zLCBzZWUgaHR0cHM6Ly9nby5taWNyb3NvZnQuY29tL2Z3bGluay8/TGlua0lkPTE2NjAwNy48L3ZhbHVlPicsXG5cdFx0XHQnICAgICAgICAgICAgICAgICAgICAgIGh0dHBzOi8vZ28ubWljcm9zb2Z0LmNvbS9md2xpbmsvP0xpbmtJZD0xNjYwMDcgICAgICAgICAnXG5cdFx0KTtcblx0XHRhc3NlcnRMaW5rKFxuXHRcdFx0J0ZvciBpbnN0cnVjdGlvbnMsIHNlZSBodHRwczovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L3dpbmRvd3MvZGVza3RvcC9hYTM2NTI0Nyh2PXZzLjg1KS5hc3B4LjwvdmFsdWU+Jyxcblx0XHRcdCcgICAgICAgICAgICAgICAgICAgICAgaHR0cHM6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS93aW5kb3dzL2Rlc2t0b3AvYWEzNjUyNDcodj12cy44NSkuYXNweCAgICAgICAgICdcblx0XHQpO1xuXHRcdGFzc2VydExpbmsoXG5cdFx0XHQneCA9IFwiaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvWlx1MDBGQ3JpY2hcIjsnLFxuXHRcdFx0JyAgICAgaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvWlx1MDBGQ3JpY2ggICdcblx0XHQpO1xuXHRcdGFzc2VydExpbmsoXG5cdFx0XHQnXHU4QUNCXHU1M0MzXHU5NUIxIGh0dHA6Ly9nby5taWNyb3NvZnQuY29tL2Z3bGluay8/TGlua0lkPTc2MTA1MVx1MzAwMicsXG5cdFx0XHQnICAgIGh0dHA6Ly9nby5taWNyb3NvZnQuY29tL2Z3bGluay8/TGlua0lkPTc2MTA1MSAnXG5cdFx0KTtcblx0XHRhc3NlcnRMaW5rKFxuXHRcdFx0J1x1RkYwOFx1OEFDQlx1NTNDM1x1OTVCMSBodHRwOi8vZ28ubWljcm9zb2Z0LmNvbS9md2xpbmsvP0xpbmtJZD03NjEwNTFcdUZGMDknLFxuXHRcdFx0JyAgICAgaHR0cDovL2dvLm1pY3Jvc29mdC5jb20vZndsaW5rLz9MaW5rSWQ9NzYxMDUxICdcblx0XHQpO1xuXG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCd4ID0gXCJmaWxlOi8vL2Zvby5iYXJcIjsnLFxuXHRcdFx0JyAgICAgZmlsZTovLy9mb28uYmFyICAnXG5cdFx0KTtcblx0XHRhc3NlcnRMaW5rKFxuXHRcdFx0J3ggPSBcImZpbGU6Ly9jOi9mb28uYmFyXCI7Jyxcblx0XHRcdCcgICAgIGZpbGU6Ly9jOi9mb28uYmFyICAnXG5cdFx0KTtcblxuXHRcdGFzc2VydExpbmsoXG5cdFx0XHQneCA9IFwiZmlsZTovL3NoYXJlcy9mb28uYmFyXCI7Jyxcblx0XHRcdCcgICAgIGZpbGU6Ly9zaGFyZXMvZm9vLmJhciAgJ1xuXHRcdCk7XG5cblx0XHRhc3NlcnRMaW5rKFxuXHRcdFx0J3ggPSBcImZpbGU6Ly9zaFx1MDBFNHJlcy9mb28uYmFyXCI7Jyxcblx0XHRcdCcgICAgIGZpbGU6Ly9zaFx1MDBFNHJlcy9mb28uYmFyICAnXG5cdFx0KTtcblx0XHRhc3NlcnRMaW5rKFxuXHRcdFx0J1NvbWUgdGV4dCwgdGhlbiBodHRwOi8vd3d3LmJpbmcuY29tLicsXG5cdFx0XHQnICAgICAgICAgICAgICAgIGh0dHA6Ly93d3cuYmluZy5jb20gJ1xuXHRcdCk7XG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCdsZXQgdXJsID0gYGh0dHA6Ly8qKiovX2FwaS93ZWIvbGlzdHMvR2V0QnlUaXRsZShcXCdUZWFtYnVpbGRpbmdhYW52cmFnZW5cXCcpL2l0ZW1zYDsnLFxuXHRcdFx0JyAgICAgICAgICAgaHR0cDovLyoqKi9fYXBpL3dlYi9saXN0cy9HZXRCeVRpdGxlKFxcJ1RlYW1idWlsZGluZ2FhbnZyYWdlblxcJykvaXRlbXMgICdcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNzg1NScsICgpID0+IHtcblx0XHRhc3NlcnRMaW5rKFxuXHRcdFx0JzcuIEF0IHRoaXMgcG9pbnQsIFNlcnZpY2VNYWluIGhhcyBiZWVuIGNhbGxlZC4gIFRoZXJlIGlzIG5vIGZ1bmN0aW9uYWxpdHkgcHJlc2VudGx5IGluIFNlcnZpY2VNYWluLCBidXQgeW91IGNhbiBjb25zdWx0IHRoZSBbTVNETiBkb2N1bWVudGF0aW9uXShodHRwczovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L3dpbmRvd3MvZGVza3RvcC9tczY4NzQxNCh2PXZzLjg1KS5hc3B4KSB0byBhZGQgZnVuY3Rpb25hbGl0eSBhcyBkZXNpcmVkIScsXG5cdFx0XHQnICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGh0dHBzOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvd2luZG93cy9kZXNrdG9wL21zNjg3NDE0KHY9dnMuODUpLmFzcHggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1xuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM2MjI3ODogXCJDdHJsICsgY2xpY2sgdG8gZm9sbG93IGxpbmtcIiBmb3IgSVB2NiBVUkxzJywgKCkgPT4ge1xuXHRcdGFzc2VydExpbmsoXG5cdFx0XHQnbGV0IHggPSBcImh0dHA6Ly9bOjoxXTo1MDAwL2Nvbm5lY3QvdG9rZW5cIicsXG5cdFx0XHQnICAgICAgICAgaHR0cDovL1s6OjFdOjUwMDAvY29ubmVjdC90b2tlbiAgJ1xuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM3MDI1NDogYm9sZCBsaW5rcyBkb250IG9wZW4gaW4gbWFya2Rvd24gZmlsZSB1c2luZyBlZGl0b3IgbW9kZSB3aXRoIGN0cmwgKyBjbGljaycsICgpID0+IHtcblx0XHRhc3NlcnRMaW5rKFxuXHRcdFx0JzIuIE5hdmlnYXRlIHRvICoqaHR0cHM6Ly9wb3J0YWwuYXp1cmUuY29tKionLFxuXHRcdFx0JyAgICAgICAgICAgICAgICAgaHR0cHM6Ly9wb3J0YWwuYXp1cmUuY29tICAnXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzg2MzU4OiBVUkwgd3JvbmcgcmVjb2duaXRpb24gcGF0dGVybicsICgpID0+IHtcblx0XHRhc3NlcnRMaW5rKFxuXHRcdFx0J1BPU1R8aHR0cHM6Ly9wb3J0YWwuYXp1cmUuY29tfDIwMTktMTItMDV8Jyxcblx0XHRcdCcgICAgIGh0dHBzOi8vcG9ydGFsLmF6dXJlLmNvbSAgICAgICAgICAgICdcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNjcwMjI6IFNwYWNlIGFzIGVuZCBvZiBoeXBlcmxpbmsgaXNuXFwndCBhbHdheXMgZ29vZCBpZGVhJywgKCkgPT4ge1xuXHRcdGFzc2VydExpbmsoXG5cdFx0XHQnYWEgIGh0dHBzOi8vZm9vLmJhci9bdGhpcyBpcyBmb28gc2l0ZV0gIGFhJyxcblx0XHRcdCcgICAgaHR0cHM6Ly9mb28uYmFyL1t0aGlzIGlzIGZvbyBzaXRlXSAgICAnXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzEwMDM1MzogTGluayBkZXRlY3Rpb24gc3RvcHMgYXQgXHVGRjA2KGRvdWJsZS1ieXRlKScsICgpID0+IHtcblx0XHRhc3NlcnRMaW5rKFxuXHRcdFx0J2FhICBodHRwOi8vdHJlZS1tYXJrLmNoaXBzLmpwL1x1MzBFQ1x1MzBGQ1x1MzBCQVx1MzBGM1x1RkYwNlx1MzBEOVx1MzBFQVx1MzBGQ1x1MzBERlx1MzBDM1x1MzBBRlx1MzBCOSAgYWEnLFxuXHRcdFx0JyAgICBodHRwOi8vdHJlZS1tYXJrLmNoaXBzLmpwL1x1MzBFQ1x1MzBGQ1x1MzBCQVx1MzBGM1x1RkYwNlx1MzBEOVx1MzBFQVx1MzBGQ1x1MzBERlx1MzBDM1x1MzBBRlx1MzBCOSAgICAnXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzEyMTQzODogTGluayBkZXRlY3Rpb24gc3RvcHMgYXRcdTMwMTAuLi5cdTMwMTEnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCdhYSAgaHR0cHM6Ly96aC53aWtpcGVkaWEub3JnL3dpa2kvXHUzMDEwXHU2MjExXHU2M0E4XHU3Njg0XHU1QjY5XHU1QjUwXHUzMDExIGFhJyxcblx0XHRcdCcgICAgaHR0cHM6Ly96aC53aWtpcGVkaWEub3JnL3dpa2kvXHUzMDEwXHU2MjExXHU2M0E4XHU3Njg0XHU1QjY5XHU1QjUwXHUzMDExICAgJ1xuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMjE0Mzg6IExpbmsgZGV0ZWN0aW9uIHN0b3BzIGF0XHUzMDBBLi4uXHUzMDBCJywgKCkgPT4ge1xuXHRcdGFzc2VydExpbmsoXG5cdFx0XHQnYWEgIGh0dHBzOi8vemgud2lraXBlZGlhLm9yZy93aWtpL1x1MzAwQVx1NjVCMFx1OTc1Mlx1NUU3NFx1MzAwQlx1N0YxNlx1OEY5MVx1OTBFOFx1NjVFN1x1NTc0MCBhYScsXG5cdFx0XHQnICAgIGh0dHBzOi8vemgud2lraXBlZGlhLm9yZy93aWtpL1x1MzAwQVx1NjVCMFx1OTc1Mlx1NUU3NFx1MzAwQlx1N0YxNlx1OEY5MVx1OTBFOFx1NjVFN1x1NTc0MCAgICdcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTIxNDM4OiBMaW5rIGRldGVjdGlvbiBzdG9wcyBhdCBcdTIwMUMuLi5cdTIwMUQnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCdhYSAgaHR0cHM6Ly96aC53aWtpcGVkaWEub3JnL3dpa2kvXHUyMDFDXHU1RTM4XHU1MUVGXHU3NTMzXHUyMDFEXHU4QkVGXHU4QkQxXHU0RThCXHU0RUY2IGFhJyxcblx0XHRcdCcgICAgaHR0cHM6Ly96aC53aWtpcGVkaWEub3JnL3dpa2kvXHUyMDFDXHU1RTM4XHU1MUVGXHU3NTMzXHUyMDFEXHU4QkVGXHU4QkQxXHU0RThCXHU0RUY2ICAgJ1xuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxNTA5MDU6IENvbG9uIGFmdGVyIGJhcmUgaHlwZXJsaW5rIGlzIHRyZWF0ZWQgYXMgaXRzIHBhcnQnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0TGluayhcblx0XHRcdCdodHRwczovL3NpdGUud2ViL3BhZ2UuaHRtbDogYmxhaCBibGFoIGJsYWgnLFxuXHRcdFx0J2h0dHBzOi8vc2l0ZS53ZWIvcGFnZS5odG1sICAgICAgICAgICAgICAgICdcblx0XHQpO1xuXHR9KTtcblxuXHQvLyBSZW1vdmVkIGJlY2F1c2Ugb2YgIzE1Njg3NVxuXHQvLyB0ZXN0KCdpc3N1ZSAjMTUxNjMxOiBMaW5rIHBhcnNpbmcgc3RvcGVkIHdoZXJlIGNvbW1lbnRzIGluY2x1ZGUgYSBzaW5nbGUgcXVvdGUgJywgKCkgPT4ge1xuXHQvLyBcdGFzc2VydExpbmsoXG5cdC8vIFx0XHRgYWEgaHR0cHM6Ly9yZWdleHBlci5jb20vIyUyRicnJTJGIGFhYCxcblx0Ly8gXHRcdGAgICBodHRwczovL3JlZ2V4cGVyLmNvbS8jJTJGJyclMkYgICBgLFxuXHQvLyBcdCk7XG5cdC8vIH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxNTY4NzU6IExpbmtzIGluY2x1ZGUgcXVvdGVzICcsICgpID0+IHtcblx0XHRhc3NlcnRMaW5rKFxuXHRcdFx0YFwiVGhpcyBmaWxlIGhhcyBiZWVuIGNvbnZlcnRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9qZWZmLWh5a2luL2JldHRlci1jLXN5bnRheC9ibG9iL21hc3Rlci9hdXRvZ2VuZXJhdGVkL2MudG1MYW5ndWFnZS5qc29uXCIsYCxcblx0XHRcdGAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGh0dHBzOi8vZ2l0aHViLmNvbS9qZWZmLWh5a2luL2JldHRlci1jLXN5bnRheC9ibG9iL21hc3Rlci9hdXRvZ2VuZXJhdGVkL2MudG1MYW5ndWFnZS5qc29uICBgLFxuXHRcdCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxPQUFPLFlBQVk7QUFDbkIsU0FBUywrQ0FBK0M7QUFFeEQsU0FBOEIsb0JBQW9CO0FBRWxELE1BQU0seUJBQXdEO0FBQUEsRUFFN0QsWUFBb0IsUUFBa0I7QUFBbEI7QUFBQSxFQUVwQjtBQUFBLEVBRU8sZUFBdUI7QUFDN0IsV0FBTyxLQUFLLE9BQU87QUFBQSxFQUNwQjtBQUFBLEVBRU8sZUFBZSxZQUE0QjtBQUNqRCxXQUFPLEtBQUssT0FBTyxhQUFhLENBQUM7QUFBQSxFQUNsQztBQUNEO0FBRUEsU0FBUyxlQUFlLE9BQTBCO0FBQ2pELFFBQU0sU0FBUyxJQUFJLHlCQUF5QixLQUFLO0FBQ2pELFNBQU8sYUFBYSxNQUFNO0FBQzNCO0FBRUEsU0FBUyxXQUFXLE1BQWMsZUFBNkI7QUFDOUQsTUFBSSxjQUFjLEdBQ2pCLFlBQVksR0FDWixLQUNBLElBQUk7QUFFTCxPQUFLLElBQUksR0FBRyxJQUFJLGNBQWMsUUFBUSxLQUFLO0FBQzFDLFVBQU0sY0FBYyxPQUFPLENBQUM7QUFDNUIsUUFBSSxRQUFRLE9BQU8sUUFBUSxLQUFNO0FBQ2hDLG9CQUFjLElBQUk7QUFDbEI7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLE9BQUssSUFBSSxjQUFjLFNBQVMsR0FBRyxLQUFLLEdBQUcsS0FBSztBQUMvQyxVQUFNLGNBQWMsT0FBTyxDQUFDO0FBQzVCLFFBQUksUUFBUSxPQUFPLFFBQVEsS0FBTTtBQUNoQyxrQkFBWSxJQUFJO0FBQ2hCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFFQSxRQUFNLElBQUksZUFBZSxDQUFDLElBQUksQ0FBQztBQUMvQixTQUFPLGdCQUFnQixHQUFHLENBQUM7QUFBQSxJQUMxQixPQUFPO0FBQUEsTUFDTixpQkFBaUI7QUFBQSxNQUNqQjtBQUFBLE1BQ0EsZUFBZTtBQUFBLE1BQ2Y7QUFBQSxJQUNEO0FBQUEsSUFDQSxLQUFLLGNBQWMsVUFBVSxjQUFjLEdBQUcsWUFBWSxDQUFDO0FBQUEsRUFDNUQsQ0FBQyxDQUFDO0FBQ0g7QUFFQSxNQUFNLGdDQUFnQyxNQUFNO0FBRTNDLDBDQUF3QztBQUV4QyxPQUFLLGNBQWMsTUFBTTtBQUN4QixVQUFNLElBQUksYUFBYSxJQUFJO0FBQzNCLFdBQU8sZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO0FBQUEsRUFDN0IsQ0FBQztBQUVELE9BQUssV0FBVyxNQUFNO0FBRXJCO0FBQUEsTUFDQztBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBRUE7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFFQTtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUVBO0FBQUEsTUFDQztBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBRUE7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFFQTtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUVBO0FBQUEsTUFDQztBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBRUE7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFDQTtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUNBO0FBQUEsTUFDQztBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQ0E7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFDQTtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUNBO0FBQUEsTUFDQztBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQ0E7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFDQTtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUNBO0FBQUEsTUFDQztBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQ0E7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFDQTtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUNBO0FBQUEsTUFDQztBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQ0E7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFDQTtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUVBO0FBQUEsTUFDQztBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQ0E7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFFQTtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUVBO0FBQUEsTUFDQztBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQ0E7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFDQTtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssZUFBZSxNQUFNO0FBQ3pCO0FBQUEsTUFDQztBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyw2REFBNkQsTUFBTTtBQUN2RTtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssMkZBQTJGLE1BQU07QUFDckc7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLCtDQUErQyxNQUFNO0FBQ3pEO0FBQUEsTUFDQztBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxrRUFBbUUsTUFBTTtBQUM3RTtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssOERBQXlELE1BQU07QUFDbkU7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHlEQUErQyxNQUFNO0FBQ3pEO0FBQUEsTUFDQztBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyx5REFBK0MsTUFBTTtBQUN6RDtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssMERBQWdELE1BQU07QUFDMUQ7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLG9FQUFvRSxNQUFNO0FBQzlFO0FBQUEsTUFDQztBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBVUQsT0FBSyx3Q0FBd0MsTUFBTTtBQUNsRDtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
