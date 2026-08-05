import assert from "assert";
import { fillInIncompleteTokens, renderMarkdown, renderMarkdownAsPlaintext } from "../../browser/markdownRenderer.js";
import { MarkdownString } from "../../common/htmlContent.js";
import * as marked from "../../common/marked/marked.js";
import { parse } from "../../common/marshalling.js";
import { isWeb } from "../../common/platform.js";
import { URI } from "../../common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../common/utils.js";
function strToNode(str) {
  return new DOMParser().parseFromString(str, "text/html").body.firstChild;
}
function assertNodeEquals(actualNode, expectedHtml) {
  const expectedNode = strToNode(expectedHtml);
  assert.ok(
    actualNode.isEqualNode(expectedNode),
    `Expected: ${expectedNode.outerHTML}
Actual: ${actualNode.outerHTML}`
  );
}
suite("MarkdownRenderer", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  suite("Sanitization", () => {
    test("Should not render images with unknown schemes", () => {
      const markdown = { value: `![image](no-such://example.com/cat.gif)` };
      const result = store.add(renderMarkdown(markdown)).element;
      assert.strictEqual(result.innerHTML, '<p><img alt="image"></p>');
    });
  });
  suite("Images", () => {
    test("image rendering conforms to default", () => {
      const markdown = { value: `![image](http://example.com/cat.gif 'caption')` };
      const result = store.add(renderMarkdown(markdown)).element;
      assertNodeEquals(result, '<div><p><img title="caption" alt="image" src="http://example.com/cat.gif"></p></div>');
    });
    test("image rendering conforms to default without title", () => {
      const markdown = { value: `![image](http://example.com/cat.gif)` };
      const result = store.add(renderMarkdown(markdown)).element;
      assertNodeEquals(result, '<div><p><img alt="image" src="http://example.com/cat.gif"></p></div>');
    });
    test("image width from title params", () => {
      const result = store.add(renderMarkdown({ value: `![image](http://example.com/cat.gif|width=100px 'caption')` })).element;
      assertNodeEquals(result, `<div><p><img width="100" title="caption" alt="image" src="http://example.com/cat.gif"></p></div>`);
    });
    test("image height from title params", () => {
      const result = store.add(renderMarkdown({ value: `![image](http://example.com/cat.gif|height=100 'caption')` })).element;
      assertNodeEquals(result, `<div><p><img height="100" title="caption" alt="image" src="http://example.com/cat.gif"></p></div>`);
    });
    test("image width and height from title params", () => {
      const result = store.add(renderMarkdown({ value: `![image](http://example.com/cat.gif|height=200,width=100 'caption')` })).element;
      assertNodeEquals(result, `<div><p><img height="200" width="100" title="caption" alt="image" src="http://example.com/cat.gif"></p></div>`);
    });
    test("image with file uri should render as same origin uri", () => {
      if (isWeb) {
        return;
      }
      const result = store.add(renderMarkdown({ value: `![image](file:///images/cat.gif)` })).element;
      assertNodeEquals(result, '<div><p><img src="vscode-file://vscode-app/images/cat.gif" alt="image"></p></div>');
    });
  });
  suite("Code block renderer", () => {
    const simpleCodeBlockRenderer = (lang, code) => {
      const element = document.createElement("code");
      element.textContent = code;
      return Promise.resolve(element);
    };
    test("asyncRenderCallback should be invoked for code blocks", () => {
      const markdown = { value: "```js\n1 + 1;\n```" };
      return new Promise((resolve) => {
        store.add(renderMarkdown(markdown, {
          asyncRenderCallback: resolve,
          codeBlockRenderer: simpleCodeBlockRenderer
        }));
      });
    });
    test("asyncRenderCallback should not be invoked if result is immediately disposed", () => {
      const markdown = { value: "```js\n1 + 1;\n```" };
      return new Promise((resolve, reject) => {
        const result = renderMarkdown(markdown, {
          asyncRenderCallback: reject,
          codeBlockRenderer: simpleCodeBlockRenderer
        });
        result.dispose();
        setTimeout(resolve, 10);
      });
    });
    test("asyncRenderCallback should not be invoked if dispose is called before code block is rendered", () => {
      const markdown = { value: "```js\n1 + 1;\n```" };
      return new Promise((resolve, reject) => {
        let resolveCodeBlockRendering;
        const result = renderMarkdown(markdown, {
          asyncRenderCallback: reject,
          codeBlockRenderer: () => {
            return new Promise((resolve2) => {
              resolveCodeBlockRendering = resolve2;
            });
          }
        });
        setTimeout(() => {
          result.dispose();
          resolveCodeBlockRendering(document.createElement("code"));
          setTimeout(resolve, 10);
        }, 10);
      });
    });
    test("Code blocks should use leading language id (#157793)", async () => {
      const markdown = { value: "```js some other stuff\n1 + 1;\n```" };
      const lang = await new Promise((resolve) => {
        store.add(renderMarkdown(markdown, {
          codeBlockRenderer: async (lang2, value) => {
            resolve(lang2);
            return simpleCodeBlockRenderer(lang2, value);
          }
        }));
      });
      assert.strictEqual(lang, "js");
    });
  });
  suite("ThemeIcons Support On", () => {
    test("render appendText", () => {
      const mds = new MarkdownString(void 0, { supportThemeIcons: true });
      mds.appendText("$(zap) $(not a theme icon) $(add)");
      const result = store.add(renderMarkdown(mds)).element;
      assert.strictEqual(result.innerHTML, `<p>$(zap)&nbsp;$(not&nbsp;a&nbsp;theme&nbsp;icon)&nbsp;$(add)</p>`);
    });
    test("render appendMarkdown", () => {
      const mds = new MarkdownString(void 0, { supportThemeIcons: true });
      mds.appendMarkdown("$(zap) $(not a theme icon) $(add)");
      const result = store.add(renderMarkdown(mds)).element;
      assert.strictEqual(result.innerHTML, `<p><span class="codicon codicon-zap"></span> $(not a theme icon) <span class="codicon codicon-add"></span></p>`);
    });
    test("render appendMarkdown with escaped icon", () => {
      const mds = new MarkdownString(void 0, { supportThemeIcons: true });
      mds.appendMarkdown("\\$(zap) $(not a theme icon) $(add)");
      const result = store.add(renderMarkdown(mds)).element;
      assert.strictEqual(result.innerHTML, `<p>$(zap) $(not a theme icon) <span class="codicon codicon-add"></span></p>`);
    });
    test("render icon in link", () => {
      const mds = new MarkdownString(void 0, { supportThemeIcons: true });
      mds.appendMarkdown(`[$(zap)-link](#link)`);
      const result = store.add(renderMarkdown(mds)).element;
      assert.strictEqual(result.innerHTML, `<p><a data-href="#link" href="" title="#link" draggable="false"><span class="codicon codicon-zap"></span>-link</a></p>`);
    });
    test("render icon in table", () => {
      const mds = new MarkdownString(void 0, { supportThemeIcons: true });
      mds.appendMarkdown(`
| text   | text                 |
|--------|----------------------|
| $(zap) | [$(zap)-link](#link) |`);
      const result = store.add(renderMarkdown(mds)).element;
      assert.strictEqual(result.innerHTML, `<table>
<thead>
<tr>
<th>text</th>
<th>text</th>
</tr>
</thead>
<tbody><tr>
<td><span class="codicon codicon-zap"></span></td>
<td><a data-href="#link" href="" title="#link" draggable="false"><span class="codicon codicon-zap"></span>-link</a></td>
</tr>
</tbody></table>
`);
    });
    test("render icon in <a> without href (#152170)", () => {
      const mds = new MarkdownString(void 0, { supportThemeIcons: true, supportHtml: true });
      mds.appendMarkdown(`<a>$(sync)</a>`);
      const result = store.add(renderMarkdown(mds)).element;
      assert.strictEqual(result.innerHTML, `<p><span class="codicon codicon-sync"></span></p>`);
    });
  });
  suite("ThemeIcons Support Off", () => {
    test("render appendText", () => {
      const mds = new MarkdownString(void 0, { supportThemeIcons: false });
      mds.appendText("$(zap) $(not a theme icon) $(add)");
      const result = store.add(renderMarkdown(mds)).element;
      assert.strictEqual(result.innerHTML, `<p>$(zap)&nbsp;$(not&nbsp;a&nbsp;theme&nbsp;icon)&nbsp;$(add)</p>`);
    });
    test("render appendMarkdown with escaped icon", () => {
      const mds = new MarkdownString(void 0, { supportThemeIcons: false });
      mds.appendMarkdown("\\$(zap) $(not a theme icon) $(add)");
      const result = store.add(renderMarkdown(mds)).element;
      assert.strictEqual(result.innerHTML, `<p>$(zap) $(not a theme icon) $(add)</p>`);
    });
  });
  test("npm Hover Run Script not working #90855", function() {
    const md = JSON.parse('{"value":"[Run Script](command:npm.runScriptFromHover?%7B%22documentUri%22%3A%7B%22%24mid%22%3A1%2C%22fsPath%22%3A%22c%3A%5C%5CUsers%5C%5Cjrieken%5C%5CCode%5C%5C_sample%5C%5Cfoo%5C%5Cpackage.json%22%2C%22_sep%22%3A1%2C%22external%22%3A%22file%3A%2F%2F%2Fc%253A%2FUsers%2Fjrieken%2FCode%2F_sample%2Ffoo%2Fpackage.json%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Fjrieken%2FCode%2F_sample%2Ffoo%2Fpackage.json%22%2C%22scheme%22%3A%22file%22%7D%2C%22script%22%3A%22echo%22%7D \\"Run the script as a task\\")","supportThemeIcons":false,"isTrusted":true,"uris":{"__uri_e49443":{"$mid":1,"fsPath":"c:\\\\Users\\\\jrieken\\\\Code\\\\_sample\\\\foo\\\\package.json","_sep":1,"external":"file:///c%3A/Users/jrieken/Code/_sample/foo/package.json","path":"/c:/Users/jrieken/Code/_sample/foo/package.json","scheme":"file"},"command:npm.runScriptFromHover?%7B%22documentUri%22%3A%7B%22%24mid%22%3A1%2C%22fsPath%22%3A%22c%3A%5C%5CUsers%5C%5Cjrieken%5C%5CCode%5C%5C_sample%5C%5Cfoo%5C%5Cpackage.json%22%2C%22_sep%22%3A1%2C%22external%22%3A%22file%3A%2F%2F%2Fc%253A%2FUsers%2Fjrieken%2FCode%2F_sample%2Ffoo%2Fpackage.json%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Fjrieken%2FCode%2F_sample%2Ffoo%2Fpackage.json%22%2C%22scheme%22%3A%22file%22%7D%2C%22script%22%3A%22echo%22%7D":{"$mid":1,"path":"npm.runScriptFromHover","scheme":"command","query":"{\\"documentUri\\":\\"__uri_e49443\\",\\"script\\":\\"echo\\"}"}}}');
    const element = store.add(renderMarkdown(md)).element;
    const anchor = element.querySelector("a");
    assert.ok(anchor);
    assert.ok(anchor.dataset["href"]);
    const uri = URI.parse(anchor.dataset["href"]);
    const data = parse(decodeURIComponent(uri.query));
    assert.ok(data);
    assert.strictEqual(data.script, "echo");
    assert.ok(data.documentUri.toString().startsWith("file:///c%3A/"));
  });
  test("Should not render command links by default", () => {
    const md = new MarkdownString(`[command1](command:doFoo) <a href="command:doFoo">command2</a>`, {
      supportHtml: true
    });
    const result = store.add(renderMarkdown(md)).element;
    assert.strictEqual(result.innerHTML, `<p>command1 command2</p>`);
  });
  test("Should render command links in trusted strings", () => {
    const md = new MarkdownString(`[command1](command:doFoo) <a href="command:doFoo">command2</a>`, {
      isTrusted: true,
      supportHtml: true
    });
    const result = store.add(renderMarkdown(md)).element;
    assert.strictEqual(result.innerHTML, `<p><a data-href="command:doFoo" href="" title="command:doFoo" draggable="false">command1</a> <a data-href="command:doFoo" href="">command2</a></p>`);
  });
  suite("PlaintextMarkdownRender", () => {
    test("test code, blockquote, heading, list, listitem, paragraph, table, tablerow, tablecell, strong, em, br, del, text are rendered plaintext", () => {
      const markdown = { value: "`code`\n>quote\n# heading\n- list\n\ntable | table2\n--- | --- \none | two\n\n\nbo**ld**\n_italic_\n~~del~~\nsome text" };
      const expected = "code\nquote\nheading\nlist\n\ntable table2\none two\nbold\nitalic\ndel\nsome text";
      const result = renderMarkdownAsPlaintext(markdown);
      assert.strictEqual(result, expected);
    });
    test("test html, hr, image, link are rendered plaintext", () => {
      const markdown = { value: "<div>html</div>\n\n---\n![image](imageLink)\n[text](textLink)" };
      const expected = "text";
      const result = renderMarkdownAsPlaintext(markdown);
      assert.strictEqual(result, expected);
    });
    test(`Should not remove html inside of code blocks`, () => {
      const markdown = {
        value: [
          "```html",
          "<form>html</form>",
          "```"
        ].join("\n")
      };
      const expected = [
        "```",
        "<form>html</form>",
        "```"
      ].join("\n");
      const result = renderMarkdownAsPlaintext(markdown, true);
      assert.strictEqual(result, expected);
    });
  });
  suite("supportHtml", () => {
    test("supportHtml is disabled by default", () => {
      const mds = new MarkdownString(void 0, {});
      mds.appendMarkdown("a<b>b</b>c");
      const result = store.add(renderMarkdown(mds)).element;
      assert.strictEqual(result.innerHTML, `<p>abc</p>`);
    });
    test("Renders html when supportHtml=true", () => {
      const mds = new MarkdownString(void 0, { supportHtml: true });
      mds.appendMarkdown("a<b>b</b>c");
      const result = store.add(renderMarkdown(mds)).element;
      assert.strictEqual(result.innerHTML, `<p>a<b>b</b>c</p>`);
    });
    test("Should not include scripts even when supportHtml=true", () => {
      const mds = new MarkdownString(void 0, { supportHtml: true });
      mds.appendMarkdown('a<b onclick="alert(1)">b</b><script>alert(2)<\/script>c');
      const result = store.add(renderMarkdown(mds)).element;
      assert.strictEqual(result.innerHTML, `<p>a<b>b</b>c</p>`);
    });
    test("Should not render html appended as text", () => {
      const mds = new MarkdownString(void 0, { supportHtml: true });
      mds.appendText("a<b>b</b>c");
      const result = store.add(renderMarkdown(mds)).element;
      assert.strictEqual(result.innerHTML, `<p>a&lt;b&gt;b&lt;/b&gt;c</p>`);
    });
    test("Should render html images", () => {
      if (isWeb) {
        return;
      }
      const mds = new MarkdownString(void 0, { supportHtml: true });
      mds.appendMarkdown(`<img src="http://example.com/cat.gif">`);
      const result = store.add(renderMarkdown(mds)).element;
      assert.strictEqual(result.innerHTML, `<img src="http://example.com/cat.gif">`);
    });
    test("Should render html images with file uri as same origin uri", () => {
      if (isWeb) {
        return;
      }
      const mds = new MarkdownString(void 0, { supportHtml: true });
      mds.appendMarkdown(`<img src="file:///images/cat.gif">`);
      const result = store.add(renderMarkdown(mds)).element;
      assert.strictEqual(result.innerHTML, `<img src="vscode-file://vscode-app/images/cat.gif">`);
    });
  });
  suite("fillInIncompleteTokens", () => {
    function ignoreRaw(...tokenLists) {
      tokenLists.forEach((tokens) => {
        tokens.forEach((t) => t.raw = "");
      });
    }
    const completeTable = "| a | b |\n| --- | --- |";
    suite("table", () => {
      test("complete table", () => {
        const tokens = marked.marked.lexer(completeTable);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.equal(newTokens, tokens);
      });
      test("full header only", () => {
        const incompleteTable = "| a | b |";
        const tokens = marked.marked.lexer(incompleteTable);
        const completeTableTokens = marked.marked.lexer(completeTable);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, completeTableTokens);
      });
      test("full header only with trailing space", () => {
        const incompleteTable = "| a | b | ";
        const tokens = marked.marked.lexer(incompleteTable);
        const completeTableTokens = marked.marked.lexer(completeTable);
        const newTokens = fillInIncompleteTokens(tokens);
        if (newTokens) {
          ignoreRaw(newTokens, completeTableTokens);
        }
        assert.deepStrictEqual(newTokens, completeTableTokens);
      });
      test("incomplete header", () => {
        const incompleteTable = "| a | b";
        const tokens = marked.marked.lexer(incompleteTable);
        const completeTableTokens = marked.marked.lexer(completeTable);
        const newTokens = fillInIncompleteTokens(tokens);
        if (newTokens) {
          ignoreRaw(newTokens, completeTableTokens);
        }
        assert.deepStrictEqual(newTokens, completeTableTokens);
      });
      test("incomplete header one column", () => {
        const incompleteTable = "| a ";
        const tokens = marked.marked.lexer(incompleteTable);
        const completeTableTokens = marked.marked.lexer(incompleteTable + "|\n| --- |");
        const newTokens = fillInIncompleteTokens(tokens);
        if (newTokens) {
          ignoreRaw(newTokens, completeTableTokens);
        }
        assert.deepStrictEqual(newTokens, completeTableTokens);
      });
      test("full header with extras", () => {
        const incompleteTable = "| a **bold** | b _italics_ |";
        const tokens = marked.marked.lexer(incompleteTable);
        const completeTableTokens = marked.marked.lexer(incompleteTable + "\n| --- | --- |");
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, completeTableTokens);
      });
      test("full header with leading text", () => {
        const incompleteTable = "here is a table\n| a | b |";
        const tokens = marked.marked.lexer(incompleteTable);
        const completeTableTokens = marked.marked.lexer(incompleteTable + "\n| --- | --- |");
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, completeTableTokens);
      });
      test("full header with leading other stuff", () => {
        const incompleteTable = "```js\nconst xyz = 123;\n```\n| a | b |";
        const tokens = marked.marked.lexer(incompleteTable);
        const completeTableTokens = marked.marked.lexer(incompleteTable + "\n| --- | --- |");
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, completeTableTokens);
      });
      test("full header with incomplete separator", () => {
        const incompleteTable = "| a | b |\n| ---";
        const tokens = marked.marked.lexer(incompleteTable);
        const completeTableTokens = marked.marked.lexer(completeTable);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, completeTableTokens);
      });
      test("full header with incomplete separator 2", () => {
        const incompleteTable = "| a | b |\n| --- |";
        const tokens = marked.marked.lexer(incompleteTable);
        const completeTableTokens = marked.marked.lexer(completeTable);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, completeTableTokens);
      });
      test("full header with incomplete separator 3", () => {
        const incompleteTable = "| a | b |\n|";
        const tokens = marked.marked.lexer(incompleteTable);
        const completeTableTokens = marked.marked.lexer(completeTable);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, completeTableTokens);
      });
      test("not a table", () => {
        const incompleteTable = "| a | b |\nsome text";
        const tokens = marked.marked.lexer(incompleteTable);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, tokens);
      });
      test("not a table 2", () => {
        const incompleteTable = "| a | b |\n| --- |\nsome text";
        const tokens = marked.marked.lexer(incompleteTable);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, tokens);
      });
    });
    function simpleMarkdownTestSuite(name, delimiter) {
      test(`incomplete ${name}`, () => {
        const incomplete = `${delimiter}code`;
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + delimiter);
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test(`complete ${name}`, () => {
        const text = `leading text ${delimiter}code${delimiter} trailing text`;
        const tokens = marked.marked.lexer(text);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, tokens);
      });
      test(`${name} with leading text`, () => {
        const incomplete = `some text and ${delimiter}some code`;
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + delimiter);
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test(`single loose "${delimiter}"`, () => {
        const text = `some text and ${delimiter}by itself
more text here`;
        const tokens = marked.marked.lexer(text);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, tokens);
      });
      test(`incomplete ${name} after newline`, () => {
        const text = `some text
more text here and ${delimiter}text`;
        const tokens = marked.marked.lexer(text);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(text + delimiter);
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test(`incomplete after complete ${name}`, () => {
        const text = `leading text ${delimiter}code${delimiter} trailing text and ${delimiter}another`;
        const tokens = marked.marked.lexer(text);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(text + delimiter);
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test(`incomplete ${name} in list`, () => {
        const text = `- list item one
- list item two and ${delimiter}text`;
        const tokens = marked.marked.lexer(text);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(text + delimiter);
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test(`incomplete ${name} in asterisk list`, () => {
        const text = `* list item one
* list item two and ${delimiter}text`;
        const tokens = marked.marked.lexer(text);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(text + delimiter);
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test(`incomplete ${name} in numbered list`, () => {
        const text = `1. list item one
2. list item two and ${delimiter}text`;
        const tokens = marked.marked.lexer(text);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(text + delimiter);
        assert.deepStrictEqual(newTokens, completeTokens);
      });
    }
    suite("list", () => {
      test("list with complete codeblock", () => {
        const list = `-
	\`\`\`js
	let x = 1;
	\`\`\`
- list item two
`;
        const tokens = marked.marked.lexer(list);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, tokens);
      });
      test.skip("list with incomplete codeblock", () => {
        const incomplete = `- list item one

	\`\`\`js
	let x = 1;`;
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + "\n	```");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("list with subitems", () => {
        const list = `- hello
	- sub item
- text
	newline for some reason
`;
        const tokens = marked.marked.lexer(list);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, tokens);
      });
      test("ordered list with subitems", () => {
        const list = `1. hello
	- sub item
2. text
	newline for some reason
`;
        const tokens = marked.marked.lexer(list);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, tokens);
      });
      test("list with stuff", () => {
        const list = `- list item one \`codespan\` **bold** [link](http://microsoft.com) more text`;
        const tokens = marked.marked.lexer(list);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, tokens);
      });
      test("list with incomplete link text", () => {
        const incomplete = `- list item one
- item two [link`;
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + "](https://microsoft.com)");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("list with incomplete link target", () => {
        const incomplete = `- list item one
- item two [link](`;
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + ")");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("ordered list with incomplete link target", () => {
        const incomplete = `1. list item one
2. item two [link](`;
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + ")");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("ordered list with extra whitespace", () => {
        const incomplete = `1. list item one
2. item two [link](`;
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + ")");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("list with extra whitespace", () => {
        const incomplete = `- list item one
- item two [link](`;
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + ")");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("list with incomplete link with other stuff", () => {
        const incomplete = `- list item one
- item two [\`link`;
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + "`](https://microsoft.com)");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("ordered list with incomplete link with other stuff", () => {
        const incomplete = `1. list item one
1. item two [\`link`;
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + "`](https://microsoft.com)");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("list with incomplete subitem", () => {
        const incomplete = `1. list item one
	- `;
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + "&nbsp;");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("list with incomplete nested subitem", () => {
        const incomplete = `1. list item one
	- item 2
		- `;
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + "&nbsp;");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
    });
    suite("codespan", () => {
      simpleMarkdownTestSuite("codespan", "`");
      test(`backtick between letters`, () => {
        const text = "a`b";
        const tokens = marked.marked.lexer(text);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeCodespanTokens = marked.marked.lexer(text + "`");
        assert.deepStrictEqual(newTokens, completeCodespanTokens);
      });
      test(`nested pattern`, () => {
        const text = "sldkfjsd `abc __def__ ghi";
        const tokens = marked.marked.lexer(text);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(text + "`");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
    });
    suite("star", () => {
      simpleMarkdownTestSuite("star", "*");
      test(`star between letters`, () => {
        const text = "sldkfjsd a*b";
        const tokens = marked.marked.lexer(text);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(text + "*");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test(`nested pattern`, () => {
        const text = "sldkfjsd *abc __def__ ghi";
        const tokens = marked.marked.lexer(text);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(text + "*");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
    });
    suite("double star", () => {
      simpleMarkdownTestSuite("double star", "**");
      test(`double star between letters`, () => {
        const text = "a**b";
        const tokens = marked.marked.lexer(text);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(text + "**");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
    });
    suite("underscore", () => {
      simpleMarkdownTestSuite("underscore", "_");
      test(`underscore between letters`, () => {
        const text = `this_not_italics`;
        const tokens = marked.marked.lexer(text);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, tokens);
      });
    });
    suite("double underscore", () => {
      simpleMarkdownTestSuite("double underscore", "__");
      test(`double underscore between letters`, () => {
        const text = `this__not__bold`;
        const tokens = marked.marked.lexer(text);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, tokens);
      });
    });
    suite("link", () => {
      test("incomplete link text", () => {
        const incomplete = "abc [text";
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + "](https://microsoft.com)");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("incomplete link target", () => {
        const incomplete = "foo [text](http://microsoft";
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + ")");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("incomplete link target 2", () => {
        const incomplete = "foo [text](http://microsoft.com";
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + ")");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("incomplete link target with extra stuff", () => {
        const incomplete = "[before `text` after](http://microsoft.com";
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + ")");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("incomplete link target with extra stuff and incomplete arg", () => {
        const incomplete = '[before `text` after](http://microsoft.com "more text ';
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + '")');
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("incomplete link target with incomplete arg", () => {
        const incomplete = 'foo [text](http://microsoft.com "more text here ';
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + '")');
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("incomplete link target with incomplete arg 2", () => {
        const incomplete = '[text](command:vscode.openRelativePath "arg';
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + '")');
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("incomplete link target with complete arg", () => {
        const incomplete = 'foo [text](http://microsoft.com "more text here"';
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + ")");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("link text with incomplete codespan", () => {
        const incomplete = `text [\`codespan`;
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + "`](https://microsoft.com)");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("link text with incomplete stuff", () => {
        const incomplete = `text [more text \`codespan\` text **bold`;
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + "**](https://microsoft.com)");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("Looks like incomplete link target but isn't", () => {
        const complete = "**bold** `codespan` text](";
        const tokens = marked.marked.lexer(complete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(complete);
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test.skip("incomplete link in list", () => {
        const incomplete = "- [text";
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        const completeTokens = marked.marked.lexer(incomplete + "](https://microsoft.com)");
        assert.deepStrictEqual(newTokens, completeTokens);
      });
      test("square brace between letters", () => {
        const incomplete = "a[b";
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, tokens);
      });
      test("square brace on previous line", () => {
        const incomplete = "text[\nmore text";
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, tokens);
      });
      test("complete link", () => {
        const incomplete = "text [link](http://microsoft.com)";
        const tokens = marked.marked.lexer(incomplete);
        const newTokens = fillInIncompleteTokens(tokens);
        assert.deepStrictEqual(newTokens, tokens);
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvYnJvd3Nlci9tYXJrZG93blJlbmRlcmVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zLCByZW5kZXJNYXJrZG93biwgcmVuZGVyTWFya2Rvd25Bc1BsYWludGV4dCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcsIE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCAqIGFzIG1hcmtlZCBmcm9tICcuLi8uLi9jb21tb24vbWFya2VkL21hcmtlZC5qcyc7XG5pbXBvcnQgeyBwYXJzZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBpc1dlYiB9IGZyb20gJy4uLy4uL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uL2NvbW1vbi91dGlscy5qcyc7XG5cbmZ1bmN0aW9uIHN0clRvTm9kZShzdHI6IHN0cmluZyk6IEhUTUxFbGVtZW50IHtcblx0cmV0dXJuIG5ldyBET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcoc3RyLCAndGV4dC9odG1sJykuYm9keS5maXJzdENoaWxkIGFzIEhUTUxFbGVtZW50O1xufVxuXG5mdW5jdGlvbiBhc3NlcnROb2RlRXF1YWxzKGFjdHVhbE5vZGU6IEhUTUxFbGVtZW50LCBleHBlY3RlZEh0bWw6IHN0cmluZykge1xuXHRjb25zdCBleHBlY3RlZE5vZGUgPSBzdHJUb05vZGUoZXhwZWN0ZWRIdG1sKTtcblx0YXNzZXJ0Lm9rKFxuXHRcdGFjdHVhbE5vZGUuaXNFcXVhbE5vZGUoZXhwZWN0ZWROb2RlKSxcblx0XHRgRXhwZWN0ZWQ6ICR7ZXhwZWN0ZWROb2RlLm91dGVySFRNTH1cXG5BY3R1YWw6ICR7YWN0dWFsTm9kZS5vdXRlckhUTUx9YCk7XG59XG5cbnN1aXRlKCdNYXJrZG93blJlbmRlcmVyJywgKCkgPT4ge1xuXG5cdGNvbnN0IHN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c3VpdGUoJ1Nhbml0aXphdGlvbicsICgpID0+IHtcblx0XHR0ZXN0KCdTaG91bGQgbm90IHJlbmRlciBpbWFnZXMgd2l0aCB1bmtub3duIHNjaGVtZXMnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBtYXJrZG93biA9IHsgdmFsdWU6IGAhW2ltYWdlXShuby1zdWNoOi8vZXhhbXBsZS5jb20vY2F0LmdpZilgIH07XG5cdFx0XHRjb25zdCByZXN1bHQ6IEhUTUxFbGVtZW50ID0gc3RvcmUuYWRkKHJlbmRlck1hcmtkb3duKG1hcmtkb3duKSkuZWxlbWVudDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuaW5uZXJIVE1MLCAnPHA+PGltZyBhbHQ9XCJpbWFnZVwiPjwvcD4nKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ0ltYWdlcycsICgpID0+IHtcblx0XHR0ZXN0KCdpbWFnZSByZW5kZXJpbmcgY29uZm9ybXMgdG8gZGVmYXVsdCcsICgpID0+IHtcblx0XHRcdGNvbnN0IG1hcmtkb3duID0geyB2YWx1ZTogYCFbaW1hZ2VdKGh0dHA6Ly9leGFtcGxlLmNvbS9jYXQuZ2lmICdjYXB0aW9uJylgIH07XG5cdFx0XHRjb25zdCByZXN1bHQ6IEhUTUxFbGVtZW50ID0gc3RvcmUuYWRkKHJlbmRlck1hcmtkb3duKG1hcmtkb3duKSkuZWxlbWVudDtcblx0XHRcdGFzc2VydE5vZGVFcXVhbHMocmVzdWx0LCAnPGRpdj48cD48aW1nIHRpdGxlPVwiY2FwdGlvblwiIGFsdD1cImltYWdlXCIgc3JjPVwiaHR0cDovL2V4YW1wbGUuY29tL2NhdC5naWZcIj48L3A+PC9kaXY+Jyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpbWFnZSByZW5kZXJpbmcgY29uZm9ybXMgdG8gZGVmYXVsdCB3aXRob3V0IHRpdGxlJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbWFya2Rvd24gPSB7IHZhbHVlOiBgIVtpbWFnZV0oaHR0cDovL2V4YW1wbGUuY29tL2NhdC5naWYpYCB9O1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBIVE1MRWxlbWVudCA9IHN0b3JlLmFkZChyZW5kZXJNYXJrZG93bihtYXJrZG93bikpLmVsZW1lbnQ7XG5cdFx0XHRhc3NlcnROb2RlRXF1YWxzKHJlc3VsdCwgJzxkaXY+PHA+PGltZyBhbHQ9XCJpbWFnZVwiIHNyYz1cImh0dHA6Ly9leGFtcGxlLmNvbS9jYXQuZ2lmXCI+PC9wPjwvZGl2PicpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnaW1hZ2Ugd2lkdGggZnJvbSB0aXRsZSBwYXJhbXMnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCByZXN1bHQ6IEhUTUxFbGVtZW50ID0gc3RvcmUuYWRkKHJlbmRlck1hcmtkb3duKHsgdmFsdWU6IGAhW2ltYWdlXShodHRwOi8vZXhhbXBsZS5jb20vY2F0LmdpZnx3aWR0aD0xMDBweCAnY2FwdGlvbicpYCB9KSkuZWxlbWVudDtcblx0XHRcdGFzc2VydE5vZGVFcXVhbHMocmVzdWx0LCBgPGRpdj48cD48aW1nIHdpZHRoPVwiMTAwXCIgdGl0bGU9XCJjYXB0aW9uXCIgYWx0PVwiaW1hZ2VcIiBzcmM9XCJodHRwOi8vZXhhbXBsZS5jb20vY2F0LmdpZlwiPjwvcD48L2Rpdj5gKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2ltYWdlIGhlaWdodCBmcm9tIHRpdGxlIHBhcmFtcycsICgpID0+IHtcblx0XHRcdGNvbnN0IHJlc3VsdDogSFRNTEVsZW1lbnQgPSBzdG9yZS5hZGQocmVuZGVyTWFya2Rvd24oeyB2YWx1ZTogYCFbaW1hZ2VdKGh0dHA6Ly9leGFtcGxlLmNvbS9jYXQuZ2lmfGhlaWdodD0xMDAgJ2NhcHRpb24nKWAgfSkpLmVsZW1lbnQ7XG5cdFx0XHRhc3NlcnROb2RlRXF1YWxzKHJlc3VsdCwgYDxkaXY+PHA+PGltZyBoZWlnaHQ9XCIxMDBcIiB0aXRsZT1cImNhcHRpb25cIiBhbHQ9XCJpbWFnZVwiIHNyYz1cImh0dHA6Ly9leGFtcGxlLmNvbS9jYXQuZ2lmXCI+PC9wPjwvZGl2PmApO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnaW1hZ2Ugd2lkdGggYW5kIGhlaWdodCBmcm9tIHRpdGxlIHBhcmFtcycsICgpID0+IHtcblx0XHRcdGNvbnN0IHJlc3VsdDogSFRNTEVsZW1lbnQgPSBzdG9yZS5hZGQocmVuZGVyTWFya2Rvd24oeyB2YWx1ZTogYCFbaW1hZ2VdKGh0dHA6Ly9leGFtcGxlLmNvbS9jYXQuZ2lmfGhlaWdodD0yMDAsd2lkdGg9MTAwICdjYXB0aW9uJylgIH0pKS5lbGVtZW50O1xuXHRcdFx0YXNzZXJ0Tm9kZUVxdWFscyhyZXN1bHQsIGA8ZGl2PjxwPjxpbWcgaGVpZ2h0PVwiMjAwXCIgd2lkdGg9XCIxMDBcIiB0aXRsZT1cImNhcHRpb25cIiBhbHQ9XCJpbWFnZVwiIHNyYz1cImh0dHA6Ly9leGFtcGxlLmNvbS9jYXQuZ2lmXCI+PC9wPjwvZGl2PmApO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnaW1hZ2Ugd2l0aCBmaWxlIHVyaSBzaG91bGQgcmVuZGVyIGFzIHNhbWUgb3JpZ2luIHVyaScsICgpID0+IHtcblx0XHRcdGlmIChpc1dlYikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZXN1bHQ6IEhUTUxFbGVtZW50ID0gc3RvcmUuYWRkKHJlbmRlck1hcmtkb3duKHsgdmFsdWU6IGAhW2ltYWdlXShmaWxlOi8vL2ltYWdlcy9jYXQuZ2lmKWAgfSkpLmVsZW1lbnQ7XG5cdFx0XHRhc3NlcnROb2RlRXF1YWxzKHJlc3VsdCwgJzxkaXY+PHA+PGltZyBzcmM9XCJ2c2NvZGUtZmlsZTovL3ZzY29kZS1hcHAvaW1hZ2VzL2NhdC5naWZcIiBhbHQ9XCJpbWFnZVwiPjwvcD48L2Rpdj4nKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ0NvZGUgYmxvY2sgcmVuZGVyZXInLCAoKSA9PiB7XG5cdFx0Y29uc3Qgc2ltcGxlQ29kZUJsb2NrUmVuZGVyZXIgPSAobGFuZzogc3RyaW5nLCBjb2RlOiBzdHJpbmcpOiBQcm9taXNlPEhUTUxFbGVtZW50PiA9PiB7XG5cdFx0XHRjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY29kZScpO1xuXHRcdFx0ZWxlbWVudC50ZXh0Q29udGVudCA9IGNvZGU7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGVsZW1lbnQpO1xuXHRcdH07XG5cblx0XHR0ZXN0KCdhc3luY1JlbmRlckNhbGxiYWNrIHNob3VsZCBiZSBpbnZva2VkIGZvciBjb2RlIGJsb2NrcycsICgpID0+IHtcblx0XHRcdGNvbnN0IG1hcmtkb3duID0geyB2YWx1ZTogJ2BgYGpzXFxuMSArIDE7XFxuYGBgJyB9O1xuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0XHRzdG9yZS5hZGQocmVuZGVyTWFya2Rvd24obWFya2Rvd24sIHtcblx0XHRcdFx0XHRhc3luY1JlbmRlckNhbGxiYWNrOiByZXNvbHZlLFxuXHRcdFx0XHRcdGNvZGVCbG9ja1JlbmRlcmVyOiBzaW1wbGVDb2RlQmxvY2tSZW5kZXJlclxuXHRcdFx0XHR9KSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2FzeW5jUmVuZGVyQ2FsbGJhY2sgc2hvdWxkIG5vdCBiZSBpbnZva2VkIGlmIHJlc3VsdCBpcyBpbW1lZGlhdGVseSBkaXNwb3NlZCcsICgpID0+IHtcblx0XHRcdGNvbnN0IG1hcmtkb3duID0geyB2YWx1ZTogJ2BgYGpzXFxuMSArIDE7XFxuYGBgJyB9O1xuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gcmVuZGVyTWFya2Rvd24obWFya2Rvd24sIHtcblx0XHRcdFx0XHRhc3luY1JlbmRlckNhbGxiYWNrOiByZWplY3QsXG5cdFx0XHRcdFx0Y29kZUJsb2NrUmVuZGVyZXI6IHNpbXBsZUNvZGVCbG9ja1JlbmRlcmVyXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXN1bHQuZGlzcG9zZSgpO1xuXHRcdFx0XHRzZXRUaW1lb3V0KHJlc29sdmUsIDEwKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnYXN5bmNSZW5kZXJDYWxsYmFjayBzaG91bGQgbm90IGJlIGludm9rZWQgaWYgZGlzcG9zZSBpcyBjYWxsZWQgYmVmb3JlIGNvZGUgYmxvY2sgaXMgcmVuZGVyZWQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBtYXJrZG93biA9IHsgdmFsdWU6ICdgYGBqc1xcbjEgKyAxO1xcbmBgYCcgfTtcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdGxldCByZXNvbHZlQ29kZUJsb2NrUmVuZGVyaW5nOiAoeDogSFRNTEVsZW1lbnQpID0+IHZvaWQ7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IHJlbmRlck1hcmtkb3duKG1hcmtkb3duLCB7XG5cdFx0XHRcdFx0YXN5bmNSZW5kZXJDYWxsYmFjazogcmVqZWN0LFxuXHRcdFx0XHRcdGNvZGVCbG9ja1JlbmRlcmVyOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdFx0XHRcdHJlc29sdmVDb2RlQmxvY2tSZW5kZXJpbmcgPSByZXNvbHZlO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0cmVzdWx0LmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRyZXNvbHZlQ29kZUJsb2NrUmVuZGVyaW5nKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NvZGUnKSk7XG5cdFx0XHRcdFx0c2V0VGltZW91dChyZXNvbHZlLCAxMCk7XG5cdFx0XHRcdH0sIDEwKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnQ29kZSBibG9ja3Mgc2hvdWxkIHVzZSBsZWFkaW5nIGxhbmd1YWdlIGlkICgjMTU3NzkzKScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IG1hcmtkb3duID0geyB2YWx1ZTogJ2BgYGpzIHNvbWUgb3RoZXIgc3R1ZmZcXG4xICsgMTtcXG5gYGAnIH07XG5cdFx0XHRjb25zdCBsYW5nID0gYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPihyZXNvbHZlID0+IHtcblx0XHRcdFx0c3RvcmUuYWRkKHJlbmRlck1hcmtkb3duKG1hcmtkb3duLCB7XG5cdFx0XHRcdFx0Y29kZUJsb2NrUmVuZGVyZXI6IGFzeW5jIChsYW5nLCB2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0cmVzb2x2ZShsYW5nKTtcblx0XHRcdFx0XHRcdHJldHVybiBzaW1wbGVDb2RlQmxvY2tSZW5kZXJlcihsYW5nLCB2YWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHR9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYW5nLCAnanMnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ1RoZW1lSWNvbnMgU3VwcG9ydCBPbicsICgpID0+IHtcblxuXHRcdHRlc3QoJ3JlbmRlciBhcHBlbmRUZXh0JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbWRzID0gbmV3IE1hcmtkb3duU3RyaW5nKHVuZGVmaW5lZCwgeyBzdXBwb3J0VGhlbWVJY29uczogdHJ1ZSB9KTtcblx0XHRcdG1kcy5hcHBlbmRUZXh0KCckKHphcCkgJChub3QgYSB0aGVtZSBpY29uKSAkKGFkZCknKTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0OiBIVE1MRWxlbWVudCA9IHN0b3JlLmFkZChyZW5kZXJNYXJrZG93bihtZHMpKS5lbGVtZW50O1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pbm5lckhUTUwsIGA8cD4kKHphcCkmbmJzcDskKG5vdCZuYnNwO2EmbmJzcDt0aGVtZSZuYnNwO2ljb24pJm5ic3A7JChhZGQpPC9wPmApO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVuZGVyIGFwcGVuZE1hcmtkb3duJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbWRzID0gbmV3IE1hcmtkb3duU3RyaW5nKHVuZGVmaW5lZCwgeyBzdXBwb3J0VGhlbWVJY29uczogdHJ1ZSB9KTtcblx0XHRcdG1kcy5hcHBlbmRNYXJrZG93bignJCh6YXApICQobm90IGEgdGhlbWUgaWNvbikgJChhZGQpJyk7XG5cblx0XHRcdGNvbnN0IHJlc3VsdDogSFRNTEVsZW1lbnQgPSBzdG9yZS5hZGQocmVuZGVyTWFya2Rvd24obWRzKSkuZWxlbWVudDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuaW5uZXJIVE1MLCBgPHA+PHNwYW4gY2xhc3M9XCJjb2RpY29uIGNvZGljb24temFwXCI+PC9zcGFuPiAkKG5vdCBhIHRoZW1lIGljb24pIDxzcGFuIGNsYXNzPVwiY29kaWNvbiBjb2RpY29uLWFkZFwiPjwvc3Bhbj48L3A+YCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdyZW5kZXIgYXBwZW5kTWFya2Rvd24gd2l0aCBlc2NhcGVkIGljb24nLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBtZHMgPSBuZXcgTWFya2Rvd25TdHJpbmcodW5kZWZpbmVkLCB7IHN1cHBvcnRUaGVtZUljb25zOiB0cnVlIH0pO1xuXHRcdFx0bWRzLmFwcGVuZE1hcmtkb3duKCdcXFxcJCh6YXApICQobm90IGEgdGhlbWUgaWNvbikgJChhZGQpJyk7XG5cblx0XHRcdGNvbnN0IHJlc3VsdDogSFRNTEVsZW1lbnQgPSBzdG9yZS5hZGQocmVuZGVyTWFya2Rvd24obWRzKSkuZWxlbWVudDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuaW5uZXJIVE1MLCBgPHA+JCh6YXApICQobm90IGEgdGhlbWUgaWNvbikgPHNwYW4gY2xhc3M9XCJjb2RpY29uIGNvZGljb24tYWRkXCI+PC9zcGFuPjwvcD5gKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3JlbmRlciBpY29uIGluIGxpbmsnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBtZHMgPSBuZXcgTWFya2Rvd25TdHJpbmcodW5kZWZpbmVkLCB7IHN1cHBvcnRUaGVtZUljb25zOiB0cnVlIH0pO1xuXHRcdFx0bWRzLmFwcGVuZE1hcmtkb3duKGBbJCh6YXApLWxpbmtdKCNsaW5rKWApO1xuXG5cdFx0XHRjb25zdCByZXN1bHQ6IEhUTUxFbGVtZW50ID0gc3RvcmUuYWRkKHJlbmRlck1hcmtkb3duKG1kcykpLmVsZW1lbnQ7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmlubmVySFRNTCwgYDxwPjxhIGRhdGEtaHJlZj1cIiNsaW5rXCIgaHJlZj1cIlwiIHRpdGxlPVwiI2xpbmtcIiBkcmFnZ2FibGU9XCJmYWxzZVwiPjxzcGFuIGNsYXNzPVwiY29kaWNvbiBjb2RpY29uLXphcFwiPjwvc3Bhbj4tbGluazwvYT48L3A+YCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdyZW5kZXIgaWNvbiBpbiB0YWJsZScsICgpID0+IHtcblx0XHRcdGNvbnN0IG1kcyA9IG5ldyBNYXJrZG93blN0cmluZyh1bmRlZmluZWQsIHsgc3VwcG9ydFRoZW1lSWNvbnM6IHRydWUgfSk7XG5cdFx0XHRtZHMuYXBwZW5kTWFya2Rvd24oYFxufCB0ZXh0ICAgfCB0ZXh0ICAgICAgICAgICAgICAgICB8XG58LS0tLS0tLS18LS0tLS0tLS0tLS0tLS0tLS0tLS0tLXxcbnwgJCh6YXApIHwgWyQoemFwKS1saW5rXSgjbGluaykgfGApO1xuXG5cdFx0XHRjb25zdCByZXN1bHQ6IEhUTUxFbGVtZW50ID0gc3RvcmUuYWRkKHJlbmRlck1hcmtkb3duKG1kcykpLmVsZW1lbnQ7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmlubmVySFRNTCwgYDx0YWJsZT5cbjx0aGVhZD5cbjx0cj5cbjx0aD50ZXh0PC90aD5cbjx0aD50ZXh0PC90aD5cbjwvdHI+XG48L3RoZWFkPlxuPHRib2R5Pjx0cj5cbjx0ZD48c3BhbiBjbGFzcz1cImNvZGljb24gY29kaWNvbi16YXBcIj48L3NwYW4+PC90ZD5cbjx0ZD48YSBkYXRhLWhyZWY9XCIjbGlua1wiIGhyZWY9XCJcIiB0aXRsZT1cIiNsaW5rXCIgZHJhZ2dhYmxlPVwiZmFsc2VcIj48c3BhbiBjbGFzcz1cImNvZGljb24gY29kaWNvbi16YXBcIj48L3NwYW4+LWxpbms8L2E+PC90ZD5cbjwvdHI+XG48L3Rib2R5PjwvdGFibGU+XG5gKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3JlbmRlciBpY29uIGluIDxhPiB3aXRob3V0IGhyZWYgKCMxNTIxNzApJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbWRzID0gbmV3IE1hcmtkb3duU3RyaW5nKHVuZGVmaW5lZCwgeyBzdXBwb3J0VGhlbWVJY29uczogdHJ1ZSwgc3VwcG9ydEh0bWw6IHRydWUgfSk7XG5cdFx0XHRtZHMuYXBwZW5kTWFya2Rvd24oYDxhPiQoc3luYyk8L2E+YCk7XG5cblx0XHRcdGNvbnN0IHJlc3VsdDogSFRNTEVsZW1lbnQgPSBzdG9yZS5hZGQocmVuZGVyTWFya2Rvd24obWRzKSkuZWxlbWVudDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuaW5uZXJIVE1MLCBgPHA+PHNwYW4gY2xhc3M9XCJjb2RpY29uIGNvZGljb24tc3luY1wiPjwvc3Bhbj48L3A+YCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdUaGVtZUljb25zIFN1cHBvcnQgT2ZmJywgKCkgPT4ge1xuXG5cdFx0dGVzdCgncmVuZGVyIGFwcGVuZFRleHQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBtZHMgPSBuZXcgTWFya2Rvd25TdHJpbmcodW5kZWZpbmVkLCB7IHN1cHBvcnRUaGVtZUljb25zOiBmYWxzZSB9KTtcblx0XHRcdG1kcy5hcHBlbmRUZXh0KCckKHphcCkgJChub3QgYSB0aGVtZSBpY29uKSAkKGFkZCknKTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0OiBIVE1MRWxlbWVudCA9IHN0b3JlLmFkZChyZW5kZXJNYXJrZG93bihtZHMpKS5lbGVtZW50O1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pbm5lckhUTUwsIGA8cD4kKHphcCkmbmJzcDskKG5vdCZuYnNwO2EmbmJzcDt0aGVtZSZuYnNwO2ljb24pJm5ic3A7JChhZGQpPC9wPmApO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVuZGVyIGFwcGVuZE1hcmtkb3duIHdpdGggZXNjYXBlZCBpY29uJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbWRzID0gbmV3IE1hcmtkb3duU3RyaW5nKHVuZGVmaW5lZCwgeyBzdXBwb3J0VGhlbWVJY29uczogZmFsc2UgfSk7XG5cdFx0XHRtZHMuYXBwZW5kTWFya2Rvd24oJ1xcXFwkKHphcCkgJChub3QgYSB0aGVtZSBpY29uKSAkKGFkZCknKTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0OiBIVE1MRWxlbWVudCA9IHN0b3JlLmFkZChyZW5kZXJNYXJrZG93bihtZHMpKS5lbGVtZW50O1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pbm5lckhUTUwsIGA8cD4kKHphcCkgJChub3QgYSB0aGVtZSBpY29uKSAkKGFkZCk8L3A+YCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ25wbSBIb3ZlciBSdW4gU2NyaXB0IG5vdCB3b3JraW5nICM5MDg1NScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IG1kOiBJTWFya2Rvd25TdHJpbmcgPSBKU09OLnBhcnNlKCd7XCJ2YWx1ZVwiOlwiW1J1biBTY3JpcHRdKGNvbW1hbmQ6bnBtLnJ1blNjcmlwdEZyb21Ib3Zlcj8lN0IlMjJkb2N1bWVudFVyaSUyMiUzQSU3QiUyMiUyNG1pZCUyMiUzQTElMkMlMjJmc1BhdGglMjIlM0ElMjJjJTNBJTVDJTVDVXNlcnMlNUMlNUNqcmlla2VuJTVDJTVDQ29kZSU1QyU1Q19zYW1wbGUlNUMlNUNmb28lNUMlNUNwYWNrYWdlLmpzb24lMjIlMkMlMjJfc2VwJTIyJTNBMSUyQyUyMmV4dGVybmFsJTIyJTNBJTIyZmlsZSUzQSUyRiUyRiUyRmMlMjUzQSUyRlVzZXJzJTJGanJpZWtlbiUyRkNvZGUlMkZfc2FtcGxlJTJGZm9vJTJGcGFja2FnZS5qc29uJTIyJTJDJTIycGF0aCUyMiUzQSUyMiUyRmMlM0ElMkZVc2VycyUyRmpyaWVrZW4lMkZDb2RlJTJGX3NhbXBsZSUyRmZvbyUyRnBhY2thZ2UuanNvbiUyMiUyQyUyMnNjaGVtZSUyMiUzQSUyMmZpbGUlMjIlN0QlMkMlMjJzY3JpcHQlMjIlM0ElMjJlY2hvJTIyJTdEIFxcXFxcIlJ1biB0aGUgc2NyaXB0IGFzIGEgdGFza1xcXFxcIilcIixcInN1cHBvcnRUaGVtZUljb25zXCI6ZmFsc2UsXCJpc1RydXN0ZWRcIjp0cnVlLFwidXJpc1wiOntcIl9fdXJpX2U0OTQ0M1wiOntcIiRtaWRcIjoxLFwiZnNQYXRoXCI6XCJjOlxcXFxcXFxcVXNlcnNcXFxcXFxcXGpyaWVrZW5cXFxcXFxcXENvZGVcXFxcXFxcXF9zYW1wbGVcXFxcXFxcXGZvb1xcXFxcXFxccGFja2FnZS5qc29uXCIsXCJfc2VwXCI6MSxcImV4dGVybmFsXCI6XCJmaWxlOi8vL2MlM0EvVXNlcnMvanJpZWtlbi9Db2RlL19zYW1wbGUvZm9vL3BhY2thZ2UuanNvblwiLFwicGF0aFwiOlwiL2M6L1VzZXJzL2pyaWVrZW4vQ29kZS9fc2FtcGxlL2Zvby9wYWNrYWdlLmpzb25cIixcInNjaGVtZVwiOlwiZmlsZVwifSxcImNvbW1hbmQ6bnBtLnJ1blNjcmlwdEZyb21Ib3Zlcj8lN0IlMjJkb2N1bWVudFVyaSUyMiUzQSU3QiUyMiUyNG1pZCUyMiUzQTElMkMlMjJmc1BhdGglMjIlM0ElMjJjJTNBJTVDJTVDVXNlcnMlNUMlNUNqcmlla2VuJTVDJTVDQ29kZSU1QyU1Q19zYW1wbGUlNUMlNUNmb28lNUMlNUNwYWNrYWdlLmpzb24lMjIlMkMlMjJfc2VwJTIyJTNBMSUyQyUyMmV4dGVybmFsJTIyJTNBJTIyZmlsZSUzQSUyRiUyRiUyRmMlMjUzQSUyRlVzZXJzJTJGanJpZWtlbiUyRkNvZGUlMkZfc2FtcGxlJTJGZm9vJTJGcGFja2FnZS5qc29uJTIyJTJDJTIycGF0aCUyMiUzQSUyMiUyRmMlM0ElMkZVc2VycyUyRmpyaWVrZW4lMkZDb2RlJTJGX3NhbXBsZSUyRmZvbyUyRnBhY2thZ2UuanNvbiUyMiUyQyUyMnNjaGVtZSUyMiUzQSUyMmZpbGUlMjIlN0QlMkMlMjJzY3JpcHQlMjIlM0ElMjJlY2hvJTIyJTdEXCI6e1wiJG1pZFwiOjEsXCJwYXRoXCI6XCJucG0ucnVuU2NyaXB0RnJvbUhvdmVyXCIsXCJzY2hlbWVcIjpcImNvbW1hbmRcIixcInF1ZXJ5XCI6XCJ7XFxcXFwiZG9jdW1lbnRVcmlcXFxcXCI6XFxcXFwiX191cmlfZTQ5NDQzXFxcXFwiLFxcXFxcInNjcmlwdFxcXFxcIjpcXFxcXCJlY2hvXFxcXFwifVwifX19Jyk7XG5cdFx0Y29uc3QgZWxlbWVudCA9IHN0b3JlLmFkZChyZW5kZXJNYXJrZG93bihtZCkpLmVsZW1lbnQ7XG5cblx0XHRjb25zdCBhbmNob3IgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJ2EnKSE7XG5cdFx0YXNzZXJ0Lm9rKGFuY2hvcik7XG5cdFx0YXNzZXJ0Lm9rKGFuY2hvci5kYXRhc2V0WydocmVmJ10pO1xuXG5cdFx0Y29uc3QgdXJpID0gVVJJLnBhcnNlKGFuY2hvci5kYXRhc2V0WydocmVmJ10hKTtcblxuXHRcdGNvbnN0IGRhdGEgPSA8eyBzY3JpcHQ6IHN0cmluZzsgZG9jdW1lbnRVcmk6IFVSSSB9PnBhcnNlKGRlY29kZVVSSUNvbXBvbmVudCh1cmkucXVlcnkpKTtcblx0XHRhc3NlcnQub2soZGF0YSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRhdGEuc2NyaXB0LCAnZWNobycpO1xuXHRcdGFzc2VydC5vayhkYXRhLmRvY3VtZW50VXJpLnRvU3RyaW5nKCkuc3RhcnRzV2l0aCgnZmlsZTovLy9jJTNBLycpKTtcblx0fSk7XG5cblx0dGVzdCgnU2hvdWxkIG5vdCByZW5kZXIgY29tbWFuZCBsaW5rcyBieSBkZWZhdWx0JywgKCkgPT4ge1xuXHRcdGNvbnN0IG1kID0gbmV3IE1hcmtkb3duU3RyaW5nKGBbY29tbWFuZDFdKGNvbW1hbmQ6ZG9Gb28pIDxhIGhyZWY9XCJjb21tYW5kOmRvRm9vXCI+Y29tbWFuZDI8L2E+YCwge1xuXHRcdFx0c3VwcG9ydEh0bWw6IHRydWVcblx0XHR9KTtcblxuXHRcdGNvbnN0IHJlc3VsdDogSFRNTEVsZW1lbnQgPSBzdG9yZS5hZGQocmVuZGVyTWFya2Rvd24obWQpKS5lbGVtZW50O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuaW5uZXJIVE1MLCBgPHA+Y29tbWFuZDEgY29tbWFuZDI8L3A+YCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Nob3VsZCByZW5kZXIgY29tbWFuZCBsaW5rcyBpbiB0cnVzdGVkIHN0cmluZ3MnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbWQgPSBuZXcgTWFya2Rvd25TdHJpbmcoYFtjb21tYW5kMV0oY29tbWFuZDpkb0ZvbykgPGEgaHJlZj1cImNvbW1hbmQ6ZG9Gb29cIj5jb21tYW5kMjwvYT5gLCB7XG5cdFx0XHRpc1RydXN0ZWQ6IHRydWUsXG5cdFx0XHRzdXBwb3J0SHRtbDogdHJ1ZSxcblx0XHR9KTtcblxuXHRcdGNvbnN0IHJlc3VsdDogSFRNTEVsZW1lbnQgPSBzdG9yZS5hZGQocmVuZGVyTWFya2Rvd24obWQpKS5lbGVtZW50O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuaW5uZXJIVE1MLCBgPHA+PGEgZGF0YS1ocmVmPVwiY29tbWFuZDpkb0Zvb1wiIGhyZWY9XCJcIiB0aXRsZT1cImNvbW1hbmQ6ZG9Gb29cIiBkcmFnZ2FibGU9XCJmYWxzZVwiPmNvbW1hbmQxPC9hPiA8YSBkYXRhLWhyZWY9XCJjb21tYW5kOmRvRm9vXCIgaHJlZj1cIlwiPmNvbW1hbmQyPC9hPjwvcD5gKTtcblx0fSk7XG5cblx0c3VpdGUoJ1BsYWludGV4dE1hcmtkb3duUmVuZGVyJywgKCkgPT4ge1xuXG5cdFx0dGVzdCgndGVzdCBjb2RlLCBibG9ja3F1b3RlLCBoZWFkaW5nLCBsaXN0LCBsaXN0aXRlbSwgcGFyYWdyYXBoLCB0YWJsZSwgdGFibGVyb3csIHRhYmxlY2VsbCwgc3Ryb25nLCBlbSwgYnIsIGRlbCwgdGV4dCBhcmUgcmVuZGVyZWQgcGxhaW50ZXh0JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbWFya2Rvd24gPSB7IHZhbHVlOiAnYGNvZGVgXFxuPnF1b3RlXFxuIyBoZWFkaW5nXFxuLSBsaXN0XFxuXFxudGFibGUgfCB0YWJsZTJcXG4tLS0gfCAtLS0gXFxub25lIHwgdHdvXFxuXFxuXFxuYm8qKmxkKipcXG5faXRhbGljX1xcbn5+ZGVsfn5cXG5zb21lIHRleHQnIH07XG5cdFx0XHRjb25zdCBleHBlY3RlZCA9ICdjb2RlXFxucXVvdGVcXG5oZWFkaW5nXFxubGlzdFxcblxcbnRhYmxlIHRhYmxlMlxcbm9uZSB0d29cXG5ib2xkXFxuaXRhbGljXFxuZGVsXFxuc29tZSB0ZXh0Jztcblx0XHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nID0gcmVuZGVyTWFya2Rvd25Bc1BsYWludGV4dChtYXJrZG93bik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCBleHBlY3RlZCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd0ZXN0IGh0bWwsIGhyLCBpbWFnZSwgbGluayBhcmUgcmVuZGVyZWQgcGxhaW50ZXh0JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbWFya2Rvd24gPSB7IHZhbHVlOiAnPGRpdj5odG1sPC9kaXY+XFxuXFxuLS0tXFxuIVtpbWFnZV0oaW1hZ2VMaW5rKVxcblt0ZXh0XSh0ZXh0TGluayknIH07XG5cdFx0XHRjb25zdCBleHBlY3RlZCA9ICd0ZXh0Jztcblx0XHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nID0gcmVuZGVyTWFya2Rvd25Bc1BsYWludGV4dChtYXJrZG93bik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCBleHBlY3RlZCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KGBTaG91bGQgbm90IHJlbW92ZSBodG1sIGluc2lkZSBvZiBjb2RlIGJsb2Nrc2AsICgpID0+IHtcblx0XHRcdGNvbnN0IG1hcmtkb3duID0ge1xuXHRcdFx0XHR2YWx1ZTogW1xuXHRcdFx0XHRcdCdgYGBodG1sJyxcblx0XHRcdFx0XHQnPGZvcm0+aHRtbDwvZm9ybT4nLFxuXHRcdFx0XHRcdCdgYGAnLFxuXHRcdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRcdCdgYGAnLFxuXHRcdFx0XHQnPGZvcm0+aHRtbDwvZm9ybT4nLFxuXHRcdFx0XHQnYGBgJyxcblx0XHRcdF0uam9pbignXFxuJyk7XG5cdFx0XHRjb25zdCByZXN1bHQ6IHN0cmluZyA9IHJlbmRlck1hcmtkb3duQXNQbGFpbnRleHQobWFya2Rvd24sIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgZXhwZWN0ZWQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnc3VwcG9ydEh0bWwnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc3VwcG9ydEh0bWwgaXMgZGlzYWJsZWQgYnkgZGVmYXVsdCcsICgpID0+IHtcblx0XHRcdGNvbnN0IG1kcyA9IG5ldyBNYXJrZG93blN0cmluZyh1bmRlZmluZWQsIHt9KTtcblx0XHRcdG1kcy5hcHBlbmRNYXJrZG93bignYTxiPmI8L2I+YycpO1xuXG5cdFx0XHRjb25zdCByZXN1bHQgPSBzdG9yZS5hZGQocmVuZGVyTWFya2Rvd24obWRzKSkuZWxlbWVudDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuaW5uZXJIVE1MLCBgPHA+YWJjPC9wPmApO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnUmVuZGVycyBodG1sIHdoZW4gc3VwcG9ydEh0bWw9dHJ1ZScsICgpID0+IHtcblx0XHRcdGNvbnN0IG1kcyA9IG5ldyBNYXJrZG93blN0cmluZyh1bmRlZmluZWQsIHsgc3VwcG9ydEh0bWw6IHRydWUgfSk7XG5cdFx0XHRtZHMuYXBwZW5kTWFya2Rvd24oJ2E8Yj5iPC9iPmMnKTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gc3RvcmUuYWRkKHJlbmRlck1hcmtkb3duKG1kcykpLmVsZW1lbnQ7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmlubmVySFRNTCwgYDxwPmE8Yj5iPC9iPmM8L3A+YCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdTaG91bGQgbm90IGluY2x1ZGUgc2NyaXB0cyBldmVuIHdoZW4gc3VwcG9ydEh0bWw9dHJ1ZScsICgpID0+IHtcblx0XHRcdGNvbnN0IG1kcyA9IG5ldyBNYXJrZG93blN0cmluZyh1bmRlZmluZWQsIHsgc3VwcG9ydEh0bWw6IHRydWUgfSk7XG5cdFx0XHRtZHMuYXBwZW5kTWFya2Rvd24oJ2E8YiBvbmNsaWNrPVwiYWxlcnQoMSlcIj5iPC9iPjxzY3JpcHQ+YWxlcnQoMik8L3NjcmlwdD5jJyk7XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IHN0b3JlLmFkZChyZW5kZXJNYXJrZG93bihtZHMpKS5lbGVtZW50O1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pbm5lckhUTUwsIGA8cD5hPGI+YjwvYj5jPC9wPmApO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnU2hvdWxkIG5vdCByZW5kZXIgaHRtbCBhcHBlbmRlZCBhcyB0ZXh0JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbWRzID0gbmV3IE1hcmtkb3duU3RyaW5nKHVuZGVmaW5lZCwgeyBzdXBwb3J0SHRtbDogdHJ1ZSB9KTtcblx0XHRcdG1kcy5hcHBlbmRUZXh0KCdhPGI+YjwvYj5jJyk7XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IHN0b3JlLmFkZChyZW5kZXJNYXJrZG93bihtZHMpKS5lbGVtZW50O1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5pbm5lckhUTUwsIGA8cD5hJmx0O2ImZ3Q7YiZsdDsvYiZndDtjPC9wPmApO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnU2hvdWxkIHJlbmRlciBodG1sIGltYWdlcycsICgpID0+IHtcblx0XHRcdGlmIChpc1dlYikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1kcyA9IG5ldyBNYXJrZG93blN0cmluZyh1bmRlZmluZWQsIHsgc3VwcG9ydEh0bWw6IHRydWUgfSk7XG5cdFx0XHRtZHMuYXBwZW5kTWFya2Rvd24oYDxpbWcgc3JjPVwiaHR0cDovL2V4YW1wbGUuY29tL2NhdC5naWZcIj5gKTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gc3RvcmUuYWRkKHJlbmRlck1hcmtkb3duKG1kcykpLmVsZW1lbnQ7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmlubmVySFRNTCwgYDxpbWcgc3JjPVwiaHR0cDovL2V4YW1wbGUuY29tL2NhdC5naWZcIj5gKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ1Nob3VsZCByZW5kZXIgaHRtbCBpbWFnZXMgd2l0aCBmaWxlIHVyaSBhcyBzYW1lIG9yaWdpbiB1cmknLCAoKSA9PiB7XG5cdFx0XHRpZiAoaXNXZWIpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtZHMgPSBuZXcgTWFya2Rvd25TdHJpbmcodW5kZWZpbmVkLCB7IHN1cHBvcnRIdG1sOiB0cnVlIH0pO1xuXHRcdFx0bWRzLmFwcGVuZE1hcmtkb3duKGA8aW1nIHNyYz1cImZpbGU6Ly8vaW1hZ2VzL2NhdC5naWZcIj5gKTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gc3RvcmUuYWRkKHJlbmRlck1hcmtkb3duKG1kcykpLmVsZW1lbnQ7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmlubmVySFRNTCwgYDxpbWcgc3JjPVwidnNjb2RlLWZpbGU6Ly92c2NvZGUtYXBwL2ltYWdlcy9jYXQuZ2lmXCI+YCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdmaWxsSW5JbmNvbXBsZXRlVG9rZW5zJywgKCkgPT4ge1xuXHRcdGZ1bmN0aW9uIGlnbm9yZVJhdyguLi50b2tlbkxpc3RzOiBtYXJrZWQuVG9rZW5bXVtdKTogdm9pZCB7XG5cdFx0XHR0b2tlbkxpc3RzLmZvckVhY2godG9rZW5zID0+IHtcblx0XHRcdFx0dG9rZW5zLmZvckVhY2godCA9PiB0LnJhdyA9ICcnKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbXBsZXRlVGFibGUgPSAnfCBhIHwgYiB8XFxufCAtLS0gfCAtLS0gfCc7XG5cblx0XHRzdWl0ZSgndGFibGUnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdjb21wbGV0ZSB0YWJsZScsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihjb21wbGV0ZVRhYmxlKTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXHRcdFx0XHRhc3NlcnQuZXF1YWwobmV3VG9rZW5zLCB0b2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2Z1bGwgaGVhZGVyIG9ubHknLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGluY29tcGxldGVUYWJsZSA9ICd8IGEgfCBiIHwnO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGVUYWJsZSk7XG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVGFibGVUb2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGNvbXBsZXRlVGFibGUpO1xuXG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVGFibGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2Z1bGwgaGVhZGVyIG9ubHkgd2l0aCB0cmFpbGluZyBzcGFjZScsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZVRhYmxlID0gJ3wgYSB8IGIgfCAnO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGVUYWJsZSk7XG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVGFibGVUb2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGNvbXBsZXRlVGFibGUpO1xuXG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblx0XHRcdFx0aWYgKG5ld1Rva2Vucykge1xuXHRcdFx0XHRcdGlnbm9yZVJhdyhuZXdUb2tlbnMsIGNvbXBsZXRlVGFibGVUb2tlbnMpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCBjb21wbGV0ZVRhYmxlVG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdpbmNvbXBsZXRlIGhlYWRlcicsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZVRhYmxlID0gJ3wgYSB8IGInO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGVUYWJsZSk7XG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVGFibGVUb2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGNvbXBsZXRlVGFibGUpO1xuXG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblxuXHRcdFx0XHRpZiAobmV3VG9rZW5zKSB7XG5cdFx0XHRcdFx0aWdub3JlUmF3KG5ld1Rva2VucywgY29tcGxldGVUYWJsZVRva2Vucyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVGFibGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2luY29tcGxldGUgaGVhZGVyIG9uZSBjb2x1bW4nLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGluY29tcGxldGVUYWJsZSA9ICd8IGEgJztcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlVGFibGUpO1xuXHRcdFx0XHRjb25zdCBjb21wbGV0ZVRhYmxlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlVGFibGUgKyAnfFxcbnwgLS0tIHwnKTtcblxuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0aWYgKG5ld1Rva2Vucykge1xuXHRcdFx0XHRcdGlnbm9yZVJhdyhuZXdUb2tlbnMsIGNvbXBsZXRlVGFibGVUb2tlbnMpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCBjb21wbGV0ZVRhYmxlVG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdmdWxsIGhlYWRlciB3aXRoIGV4dHJhcycsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZVRhYmxlID0gJ3wgYSAqKmJvbGQqKiB8IGIgX2l0YWxpY3NfIHwnO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGVUYWJsZSk7XG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVGFibGVUb2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGVUYWJsZSArICdcXG58IC0tLSB8IC0tLSB8Jyk7XG5cblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgY29tcGxldGVUYWJsZVRva2Vucyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnZnVsbCBoZWFkZXIgd2l0aCBsZWFkaW5nIHRleHQnLCAoKSA9PiB7XG5cdFx0XHRcdC8vIFBhcnNpbmcgdGhpcyBnaXZlcyBvbmUgdG9rZW4gYW5kIG9uZSAndGV4dCcgc3VidG9rZW5cblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZVRhYmxlID0gJ2hlcmUgaXMgYSB0YWJsZVxcbnwgYSB8IGIgfCc7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIoaW5jb21wbGV0ZVRhYmxlKTtcblx0XHRcdFx0Y29uc3QgY29tcGxldGVUYWJsZVRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIoaW5jb21wbGV0ZVRhYmxlICsgJ1xcbnwgLS0tIHwgLS0tIHwnKTtcblxuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCBjb21wbGV0ZVRhYmxlVG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdmdWxsIGhlYWRlciB3aXRoIGxlYWRpbmcgb3RoZXIgc3R1ZmYnLCAoKSA9PiB7XG5cdFx0XHRcdC8vIFBhcnNpbmcgdGhpcyBnaXZlcyBvbmUgdG9rZW4gYW5kIG9uZSAndGV4dCcgc3VidG9rZW5cblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZVRhYmxlID0gJ2BgYGpzXFxuY29uc3QgeHl6ID0gMTIzO1xcbmBgYFxcbnwgYSB8IGIgfCc7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIoaW5jb21wbGV0ZVRhYmxlKTtcblx0XHRcdFx0Y29uc3QgY29tcGxldGVUYWJsZVRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIoaW5jb21wbGV0ZVRhYmxlICsgJ1xcbnwgLS0tIHwgLS0tIHwnKTtcblxuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCBjb21wbGV0ZVRhYmxlVG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdmdWxsIGhlYWRlciB3aXRoIGluY29tcGxldGUgc2VwYXJhdG9yJywgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmNvbXBsZXRlVGFibGUgPSAnfCBhIHwgYiB8XFxufCAtLS0nO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGVUYWJsZSk7XG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVGFibGVUb2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGNvbXBsZXRlVGFibGUpO1xuXG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVGFibGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2Z1bGwgaGVhZGVyIHdpdGggaW5jb21wbGV0ZSBzZXBhcmF0b3IgMicsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZVRhYmxlID0gJ3wgYSB8IGIgfFxcbnwgLS0tIHwnO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGVUYWJsZSk7XG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVGFibGVUb2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGNvbXBsZXRlVGFibGUpO1xuXG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVGFibGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2Z1bGwgaGVhZGVyIHdpdGggaW5jb21wbGV0ZSBzZXBhcmF0b3IgMycsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZVRhYmxlID0gJ3wgYSB8IGIgfFxcbnwnO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGVUYWJsZSk7XG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVGFibGVUb2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGNvbXBsZXRlVGFibGUpO1xuXG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVGFibGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ25vdCBhIHRhYmxlJywgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmNvbXBsZXRlVGFibGUgPSAnfCBhIHwgYiB8XFxuc29tZSB0ZXh0Jztcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlVGFibGUpO1xuXG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIHRva2Vucyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnbm90IGEgdGFibGUgMicsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZVRhYmxlID0gJ3wgYSB8IGIgfFxcbnwgLS0tIHxcXG5zb21lIHRleHQnO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGVUYWJsZSk7XG5cblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgdG9rZW5zKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0ZnVuY3Rpb24gc2ltcGxlTWFya2Rvd25UZXN0U3VpdGUobmFtZTogc3RyaW5nLCBkZWxpbWl0ZXI6IHN0cmluZyk6IHZvaWQge1xuXHRcdFx0dGVzdChgaW5jb21wbGV0ZSAke25hbWV9YCwgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmNvbXBsZXRlID0gYCR7ZGVsaW1pdGVyfWNvZGVgO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGUpO1xuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0Y29uc3QgY29tcGxldGVUb2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGUgKyBkZWxpbWl0ZXIpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgY29tcGxldGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoYGNvbXBsZXRlICR7bmFtZX1gLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRleHQgPSBgbGVhZGluZyB0ZXh0ICR7ZGVsaW1pdGVyfWNvZGUke2RlbGltaXRlcn0gdHJhaWxpbmcgdGV4dGA7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIodGV4dCk7XG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgdG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KGAke25hbWV9IHdpdGggbGVhZGluZyB0ZXh0YCwgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmNvbXBsZXRlID0gYHNvbWUgdGV4dCBhbmQgJHtkZWxpbWl0ZXJ9c29tZSBjb2RlYDtcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlKTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlICsgZGVsaW1pdGVyKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KGBzaW5nbGUgbG9vc2UgXCIke2RlbGltaXRlcn1cImAsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgdGV4dCA9IGBzb21lIHRleHQgYW5kICR7ZGVsaW1pdGVyfWJ5IGl0c2VsZlxcbm1vcmUgdGV4dCBoZXJlYDtcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcih0ZXh0KTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCB0b2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoYGluY29tcGxldGUgJHtuYW1lfSBhZnRlciBuZXdsaW5lYCwgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0ID0gYHNvbWUgdGV4dFxcbm1vcmUgdGV4dCBoZXJlIGFuZCAke2RlbGltaXRlcn10ZXh0YDtcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcih0ZXh0KTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcih0ZXh0ICsgZGVsaW1pdGVyKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KGBpbmNvbXBsZXRlIGFmdGVyIGNvbXBsZXRlICR7bmFtZX1gLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRleHQgPSBgbGVhZGluZyB0ZXh0ICR7ZGVsaW1pdGVyfWNvZGUke2RlbGltaXRlcn0gdHJhaWxpbmcgdGV4dCBhbmQgJHtkZWxpbWl0ZXJ9YW5vdGhlcmA7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIodGV4dCk7XG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblxuXHRcdFx0XHRjb25zdCBjb21wbGV0ZVRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIodGV4dCArIGRlbGltaXRlcik7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCBjb21wbGV0ZVRva2Vucyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdChgaW5jb21wbGV0ZSAke25hbWV9IGluIGxpc3RgLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRleHQgPSBgLSBsaXN0IGl0ZW0gb25lXFxuLSBsaXN0IGl0ZW0gdHdvIGFuZCAke2RlbGltaXRlcn10ZXh0YDtcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcih0ZXh0KTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcih0ZXh0ICsgZGVsaW1pdGVyKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KGBpbmNvbXBsZXRlICR7bmFtZX0gaW4gYXN0ZXJpc2sgbGlzdGAsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgdGV4dCA9IGAqIGxpc3QgaXRlbSBvbmVcXG4qIGxpc3QgaXRlbSB0d28gYW5kICR7ZGVsaW1pdGVyfXRleHRgO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKHRleHQpO1xuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0Y29uc3QgY29tcGxldGVUb2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKHRleHQgKyBkZWxpbWl0ZXIpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgY29tcGxldGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoYGluY29tcGxldGUgJHtuYW1lfSBpbiBudW1iZXJlZCBsaXN0YCwgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0ID0gYDEuIGxpc3QgaXRlbSBvbmVcXG4yLiBsaXN0IGl0ZW0gdHdvIGFuZCAke2RlbGltaXRlcn10ZXh0YDtcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcih0ZXh0KTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcih0ZXh0ICsgZGVsaW1pdGVyKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVG9rZW5zKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHN1aXRlKCdsaXN0JywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnbGlzdCB3aXRoIGNvbXBsZXRlIGNvZGVibG9jaycsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgbGlzdCA9IGAtXG5cdFxcYFxcYFxcYGpzXG5cdGxldCB4ID0gMTtcblx0XFxgXFxgXFxgXG4tIGxpc3QgaXRlbSB0d29cbmA7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIobGlzdCk7XG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgdG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0LnNraXAoJ2xpc3Qgd2l0aCBpbmNvbXBsZXRlIGNvZGVibG9jaycsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZSA9IGAtIGxpc3QgaXRlbSBvbmVcblxuXHRcXGBcXGBcXGBqc1xuXHRsZXQgeCA9IDE7YDtcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlKTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlICsgJ1xcblx0YGBgJyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCBjb21wbGV0ZVRva2Vucyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnbGlzdCB3aXRoIHN1Yml0ZW1zJywgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBsaXN0ID0gYC0gaGVsbG9cblx0LSBzdWIgaXRlbVxuLSB0ZXh0XG5cdG5ld2xpbmUgZm9yIHNvbWUgcmVhc29uXG5gO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGxpc3QpO1xuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIHRva2Vucyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnb3JkZXJlZCBsaXN0IHdpdGggc3ViaXRlbXMnLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGxpc3QgPSBgMS4gaGVsbG9cblx0LSBzdWIgaXRlbVxuMi4gdGV4dFxuXHRuZXdsaW5lIGZvciBzb21lIHJlYXNvblxuYDtcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihsaXN0KTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCB0b2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2xpc3Qgd2l0aCBzdHVmZicsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgbGlzdCA9IGAtIGxpc3QgaXRlbSBvbmUgXFxgY29kZXNwYW5cXGAgKipib2xkKiogW2xpbmtdKGh0dHA6Ly9taWNyb3NvZnQuY29tKSBtb3JlIHRleHRgO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGxpc3QpO1xuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIHRva2Vucyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnbGlzdCB3aXRoIGluY29tcGxldGUgbGluayB0ZXh0JywgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmNvbXBsZXRlID0gYC0gbGlzdCBpdGVtIG9uZVxuLSBpdGVtIHR3byBbbGlua2A7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIoaW5jb21wbGV0ZSk7XG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblxuXHRcdFx0XHRjb25zdCBjb21wbGV0ZVRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIoaW5jb21wbGV0ZSArICddKGh0dHBzOi8vbWljcm9zb2Z0LmNvbSknKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdsaXN0IHdpdGggaW5jb21wbGV0ZSBsaW5rIHRhcmdldCcsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZSA9IGAtIGxpc3QgaXRlbSBvbmVcbi0gaXRlbSB0d28gW2xpbmtdKGA7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIoaW5jb21wbGV0ZSk7XG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblxuXHRcdFx0XHRjb25zdCBjb21wbGV0ZVRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIoaW5jb21wbGV0ZSArICcpJyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCBjb21wbGV0ZVRva2Vucyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnb3JkZXJlZCBsaXN0IHdpdGggaW5jb21wbGV0ZSBsaW5rIHRhcmdldCcsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZSA9IGAxLiBsaXN0IGl0ZW0gb25lXG4yLiBpdGVtIHR3byBbbGlua10oYDtcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlKTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlICsgJyknKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdvcmRlcmVkIGxpc3Qgd2l0aCBleHRyYSB3aGl0ZXNwYWNlJywgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmNvbXBsZXRlID0gYDEuIGxpc3QgaXRlbSBvbmVcbjIuIGl0ZW0gdHdvIFtsaW5rXShgO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGUpO1xuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0Y29uc3QgY29tcGxldGVUb2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGUgKyAnKScpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgY29tcGxldGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2xpc3Qgd2l0aCBleHRyYSB3aGl0ZXNwYWNlJywgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmNvbXBsZXRlID0gYC0gbGlzdCBpdGVtIG9uZVxuLSBpdGVtIHR3byBbbGlua10oYDtcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlKTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlICsgJyknKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdsaXN0IHdpdGggaW5jb21wbGV0ZSBsaW5rIHdpdGggb3RoZXIgc3R1ZmYnLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGluY29tcGxldGUgPSBgLSBsaXN0IGl0ZW0gb25lXG4tIGl0ZW0gdHdvIFtcXGBsaW5rYDtcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlKTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlICsgJ1xcYF0oaHR0cHM6Ly9taWNyb3NvZnQuY29tKScpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgY29tcGxldGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ29yZGVyZWQgbGlzdCB3aXRoIGluY29tcGxldGUgbGluayB3aXRoIG90aGVyIHN0dWZmJywgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmNvbXBsZXRlID0gYDEuIGxpc3QgaXRlbSBvbmVcbjEuIGl0ZW0gdHdvIFtcXGBsaW5rYDtcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlKTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlICsgJ1xcYF0oaHR0cHM6Ly9taWNyb3NvZnQuY29tKScpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgY29tcGxldGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2xpc3Qgd2l0aCBpbmNvbXBsZXRlIHN1Yml0ZW0nLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGluY29tcGxldGUgPSBgMS4gbGlzdCBpdGVtIG9uZVxuXHQtIGA7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIoaW5jb21wbGV0ZSk7XG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblxuXHRcdFx0XHRjb25zdCBjb21wbGV0ZVRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIoaW5jb21wbGV0ZSArICcmbmJzcDsnKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdsaXN0IHdpdGggaW5jb21wbGV0ZSBuZXN0ZWQgc3ViaXRlbScsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZSA9IGAxLiBsaXN0IGl0ZW0gb25lXG5cdC0gaXRlbSAyXG5cdFx0LSBgO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGUpO1xuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0Y29uc3QgY29tcGxldGVUb2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGUgKyAnJm5ic3A7Jyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCBjb21wbGV0ZVRva2Vucyk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHN1aXRlKCdjb2Rlc3BhbicsICgpID0+IHtcblx0XHRcdHNpbXBsZU1hcmtkb3duVGVzdFN1aXRlKCdjb2Rlc3BhbicsICdgJyk7XG5cblx0XHRcdHRlc3QoYGJhY2t0aWNrIGJldHdlZW4gbGV0dGVyc2AsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgdGV4dCA9ICdhYGInO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKHRleHQpO1xuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0Y29uc3QgY29tcGxldGVDb2Rlc3BhblRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIodGV4dCArICdgJyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCBjb21wbGV0ZUNvZGVzcGFuVG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KGBuZXN0ZWQgcGF0dGVybmAsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgdGV4dCA9ICdzbGRrZmpzZCBgYWJjIF9fZGVmX18gZ2hpJztcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcih0ZXh0KTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcih0ZXh0ICsgJ2AnKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVG9rZW5zKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0c3VpdGUoJ3N0YXInLCAoKSA9PiB7XG5cdFx0XHRzaW1wbGVNYXJrZG93blRlc3RTdWl0ZSgnc3RhcicsICcqJyk7XG5cblx0XHRcdHRlc3QoYHN0YXIgYmV0d2VlbiBsZXR0ZXJzYCwgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXh0ID0gJ3NsZGtmanNkIGEqYic7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIodGV4dCk7XG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblxuXHRcdFx0XHRjb25zdCBjb21wbGV0ZVRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIodGV4dCArICcqJyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCBjb21wbGV0ZVRva2Vucyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdChgbmVzdGVkIHBhdHRlcm5gLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRleHQgPSAnc2xka2Zqc2QgKmFiYyBfX2RlZl9fIGdoaSc7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIodGV4dCk7XG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblxuXHRcdFx0XHRjb25zdCBjb21wbGV0ZVRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIodGV4dCArICcqJyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCBjb21wbGV0ZVRva2Vucyk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHN1aXRlKCdkb3VibGUgc3RhcicsICgpID0+IHtcblx0XHRcdHNpbXBsZU1hcmtkb3duVGVzdFN1aXRlKCdkb3VibGUgc3RhcicsICcqKicpO1xuXG5cdFx0XHR0ZXN0KGBkb3VibGUgc3RhciBiZXR3ZWVuIGxldHRlcnNgLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRleHQgPSAnYSoqYic7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIodGV4dCk7XG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblxuXHRcdFx0XHRjb25zdCBjb21wbGV0ZVRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIodGV4dCArICcqKicpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgY29tcGxldGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRzdWl0ZSgndW5kZXJzY29yZScsICgpID0+IHtcblx0XHRcdHNpbXBsZU1hcmtkb3duVGVzdFN1aXRlKCd1bmRlcnNjb3JlJywgJ18nKTtcblxuXHRcdFx0dGVzdChgdW5kZXJzY29yZSBiZXR3ZWVuIGxldHRlcnNgLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRleHQgPSBgdGhpc19ub3RfaXRhbGljc2A7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIodGV4dCk7XG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblxuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgdG9rZW5zKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0c3VpdGUoJ2RvdWJsZSB1bmRlcnNjb3JlJywgKCkgPT4ge1xuXHRcdFx0c2ltcGxlTWFya2Rvd25UZXN0U3VpdGUoJ2RvdWJsZSB1bmRlcnNjb3JlJywgJ19fJyk7XG5cblx0XHRcdHRlc3QoYGRvdWJsZSB1bmRlcnNjb3JlIGJldHdlZW4gbGV0dGVyc2AsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgdGV4dCA9IGB0aGlzX19ub3RfX2JvbGRgO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKHRleHQpO1xuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIHRva2Vucyk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHN1aXRlKCdsaW5rJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnaW5jb21wbGV0ZSBsaW5rIHRleHQnLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGluY29tcGxldGUgPSAnYWJjIFt0ZXh0Jztcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlKTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlICsgJ10oaHR0cHM6Ly9taWNyb3NvZnQuY29tKScpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgY29tcGxldGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2luY29tcGxldGUgbGluayB0YXJnZXQnLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGluY29tcGxldGUgPSAnZm9vIFt0ZXh0XShodHRwOi8vbWljcm9zb2Z0Jztcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlKTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlICsgJyknKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0KCdpbmNvbXBsZXRlIGxpbmsgdGFyZ2V0IDInLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGluY29tcGxldGUgPSAnZm9vIFt0ZXh0XShodHRwOi8vbWljcm9zb2Z0LmNvbSc7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIoaW5jb21wbGV0ZSk7XG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblxuXHRcdFx0XHRjb25zdCBjb21wbGV0ZVRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIoaW5jb21wbGV0ZSArICcpJyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCBjb21wbGV0ZVRva2Vucyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnaW5jb21wbGV0ZSBsaW5rIHRhcmdldCB3aXRoIGV4dHJhIHN0dWZmJywgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmNvbXBsZXRlID0gJ1tiZWZvcmUgYHRleHRgIGFmdGVyXShodHRwOi8vbWljcm9zb2Z0LmNvbSc7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIoaW5jb21wbGV0ZSk7XG5cdFx0XHRcdGNvbnN0IG5ld1Rva2VucyA9IGZpbGxJbkluY29tcGxldGVUb2tlbnModG9rZW5zKTtcblxuXHRcdFx0XHRjb25zdCBjb21wbGV0ZVRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIoaW5jb21wbGV0ZSArICcpJyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCBjb21wbGV0ZVRva2Vucyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnaW5jb21wbGV0ZSBsaW5rIHRhcmdldCB3aXRoIGV4dHJhIHN0dWZmIGFuZCBpbmNvbXBsZXRlIGFyZycsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZSA9ICdbYmVmb3JlIGB0ZXh0YCBhZnRlcl0oaHR0cDovL21pY3Jvc29mdC5jb20gXCJtb3JlIHRleHQgJztcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlKTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlICsgJ1wiKScpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgY29tcGxldGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2luY29tcGxldGUgbGluayB0YXJnZXQgd2l0aCBpbmNvbXBsZXRlIGFyZycsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZSA9ICdmb28gW3RleHRdKGh0dHA6Ly9taWNyb3NvZnQuY29tIFwibW9yZSB0ZXh0IGhlcmUgJztcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlKTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlICsgJ1wiKScpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgY29tcGxldGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2luY29tcGxldGUgbGluayB0YXJnZXQgd2l0aCBpbmNvbXBsZXRlIGFyZyAyJywgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmNvbXBsZXRlID0gJ1t0ZXh0XShjb21tYW5kOnZzY29kZS5vcGVuUmVsYXRpdmVQYXRoIFwiYXJnJztcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlKTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlICsgJ1wiKScpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgY29tcGxldGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2luY29tcGxldGUgbGluayB0YXJnZXQgd2l0aCBjb21wbGV0ZSBhcmcnLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGluY29tcGxldGUgPSAnZm9vIFt0ZXh0XShodHRwOi8vbWljcm9zb2Z0LmNvbSBcIm1vcmUgdGV4dCBoZXJlXCInO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGUpO1xuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0Y29uc3QgY29tcGxldGVUb2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGUgKyAnKScpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgY29tcGxldGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2xpbmsgdGV4dCB3aXRoIGluY29tcGxldGUgY29kZXNwYW4nLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGluY29tcGxldGUgPSBgdGV4dCBbXFxgY29kZXNwYW5gO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGUpO1xuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0Y29uc3QgY29tcGxldGVUb2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGUgKyAnYF0oaHR0cHM6Ly9taWNyb3NvZnQuY29tKScpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ld1Rva2VucywgY29tcGxldGVUb2tlbnMpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ2xpbmsgdGV4dCB3aXRoIGluY29tcGxldGUgc3R1ZmYnLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGluY29tcGxldGUgPSBgdGV4dCBbbW9yZSB0ZXh0IFxcYGNvZGVzcGFuXFxgIHRleHQgKipib2xkYDtcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlKTtcblx0XHRcdFx0Y29uc3QgbmV3VG9rZW5zID0gZmlsbEluSW5jb21wbGV0ZVRva2Vucyh0b2tlbnMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRlVG9rZW5zID0gbWFya2VkLm1hcmtlZC5sZXhlcihpbmNvbXBsZXRlICsgJyoqXShodHRwczovL21pY3Jvc29mdC5jb20pJyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCBjb21wbGV0ZVRva2Vucyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnTG9va3MgbGlrZSBpbmNvbXBsZXRlIGxpbmsgdGFyZ2V0IGJ1dCBpc25cXCd0JywgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBjb21wbGV0ZSA9ICcqKmJvbGQqKiBgY29kZXNwYW5gIHRleHRdKCc7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG1hcmtlZC5tYXJrZWQubGV4ZXIoY29tcGxldGUpO1xuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0Y29uc3QgY29tcGxldGVUb2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGNvbXBsZXRlKTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIGNvbXBsZXRlVG9rZW5zKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXN0LnNraXAoJ2luY29tcGxldGUgbGluayBpbiBsaXN0JywgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmNvbXBsZXRlID0gJy0gW3RleHQnO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGUpO1xuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0Y29uc3QgY29tcGxldGVUb2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGUgKyAnXShodHRwczovL21pY3Jvc29mdC5jb20pJyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3VG9rZW5zLCBjb21wbGV0ZVRva2Vucyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnc3F1YXJlIGJyYWNlIGJldHdlZW4gbGV0dGVycycsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZSA9ICdhW2InO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGUpO1xuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIHRva2Vucyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnc3F1YXJlIGJyYWNlIG9uIHByZXZpb3VzIGxpbmUnLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGluY29tcGxldGUgPSAndGV4dFtcXG5tb3JlIHRleHQnO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGUpO1xuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIHRva2Vucyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnY29tcGxldGUgbGluaycsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5jb21wbGV0ZSA9ICd0ZXh0IFtsaW5rXShodHRwOi8vbWljcm9zb2Z0LmNvbSknO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBtYXJrZWQubWFya2VkLmxleGVyKGluY29tcGxldGUpO1xuXHRcdFx0XHRjb25zdCBuZXdUb2tlbnMgPSBmaWxsSW5JbmNvbXBsZXRlVG9rZW5zKHRva2Vucyk7XG5cblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXdUb2tlbnMsIHRva2Vucyk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLHdCQUF3QixnQkFBZ0IsaUNBQWlDO0FBQ2xGLFNBQTBCLHNCQUFzQjtBQUNoRCxZQUFZLFlBQVk7QUFDeEIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsYUFBYTtBQUN0QixTQUFTLFdBQVc7QUFDcEIsU0FBUywrQ0FBK0M7QUFFeEQsU0FBUyxVQUFVLEtBQTBCO0FBQzVDLFNBQU8sSUFBSSxVQUFVLEVBQUUsZ0JBQWdCLEtBQUssV0FBVyxFQUFFLEtBQUs7QUFDL0Q7QUFFQSxTQUFTLGlCQUFpQixZQUF5QixjQUFzQjtBQUN4RSxRQUFNLGVBQWUsVUFBVSxZQUFZO0FBQzNDLFNBQU87QUFBQSxJQUNOLFdBQVcsWUFBWSxZQUFZO0FBQUEsSUFDbkMsYUFBYSxhQUFhLFNBQVM7QUFBQSxVQUFhLFdBQVcsU0FBUztBQUFBLEVBQUU7QUFDeEU7QUFFQSxNQUFNLG9CQUFvQixNQUFNO0FBRS9CLFFBQU0sUUFBUSx3Q0FBd0M7QUFFdEQsUUFBTSxnQkFBZ0IsTUFBTTtBQUMzQixTQUFLLGlEQUFpRCxNQUFNO0FBQzNELFlBQU0sV0FBVyxFQUFFLE9BQU8sMENBQTBDO0FBQ3BFLFlBQU0sU0FBc0IsTUFBTSxJQUFJLGVBQWUsUUFBUSxDQUFDLEVBQUU7QUFDaEUsYUFBTyxZQUFZLE9BQU8sV0FBVywwQkFBMEI7QUFBQSxJ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
