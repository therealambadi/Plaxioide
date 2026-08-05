import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Choice, FormatString, Placeholder, Scanner, SnippetParser, Text, TextmateSnippet, TokenType, Transform, Variable } from "../../browser/snippetParser.js";
suite("SnippetParser", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Scanner", () => {
    const scanner = new Scanner();
    assert.strictEqual(scanner.next().type, TokenType.EOF);
    scanner.text("abc");
    assert.strictEqual(scanner.next().type, TokenType.VariableName);
    assert.strictEqual(scanner.next().type, TokenType.EOF);
    scanner.text("{{abc}}");
    assert.strictEqual(scanner.next().type, TokenType.CurlyOpen);
    assert.strictEqual(scanner.next().type, TokenType.CurlyOpen);
    assert.strictEqual(scanner.next().type, TokenType.VariableName);
    assert.strictEqual(scanner.next().type, TokenType.CurlyClose);
    assert.strictEqual(scanner.next().type, TokenType.CurlyClose);
    assert.strictEqual(scanner.next().type, TokenType.EOF);
    scanner.text("abc() ");
    assert.strictEqual(scanner.next().type, TokenType.VariableName);
    assert.strictEqual(scanner.next().type, TokenType.Format);
    assert.strictEqual(scanner.next().type, TokenType.EOF);
    scanner.text("abc 123");
    assert.strictEqual(scanner.next().type, TokenType.VariableName);
    assert.strictEqual(scanner.next().type, TokenType.Format);
    assert.strictEqual(scanner.next().type, TokenType.Int);
    assert.strictEqual(scanner.next().type, TokenType.EOF);
    scanner.text("$foo");
    assert.strictEqual(scanner.next().type, TokenType.Dollar);
    assert.strictEqual(scanner.next().type, TokenType.VariableName);
    assert.strictEqual(scanner.next().type, TokenType.EOF);
    scanner.text("$foo_bar");
    assert.strictEqual(scanner.next().type, TokenType.Dollar);
    assert.strictEqual(scanner.next().type, TokenType.VariableName);
    assert.strictEqual(scanner.next().type, TokenType.EOF);
    scanner.text("$foo-bar");
    assert.strictEqual(scanner.next().type, TokenType.Dollar);
    assert.strictEqual(scanner.next().type, TokenType.VariableName);
    assert.strictEqual(scanner.next().type, TokenType.Dash);
    assert.strictEqual(scanner.next().type, TokenType.VariableName);
    assert.strictEqual(scanner.next().type, TokenType.EOF);
    scanner.text("${foo}");
    assert.strictEqual(scanner.next().type, TokenType.Dollar);
    assert.strictEqual(scanner.next().type, TokenType.CurlyOpen);
    assert.strictEqual(scanner.next().type, TokenType.VariableName);
    assert.strictEqual(scanner.next().type, TokenType.CurlyClose);
    assert.strictEqual(scanner.next().type, TokenType.EOF);
    scanner.text("${1223:foo}");
    assert.strictEqual(scanner.next().type, TokenType.Dollar);
    assert.strictEqual(scanner.next().type, TokenType.CurlyOpen);
    assert.strictEqual(scanner.next().type, TokenType.Int);
    assert.strictEqual(scanner.next().type, TokenType.Colon);
    assert.strictEqual(scanner.next().type, TokenType.VariableName);
    assert.strictEqual(scanner.next().type, TokenType.CurlyClose);
    assert.strictEqual(scanner.next().type, TokenType.EOF);
    scanner.text("\\${}");
    assert.strictEqual(scanner.next().type, TokenType.Backslash);
    assert.strictEqual(scanner.next().type, TokenType.Dollar);
    assert.strictEqual(scanner.next().type, TokenType.CurlyOpen);
    assert.strictEqual(scanner.next().type, TokenType.CurlyClose);
    scanner.text("${foo/regex/format/option}");
    assert.strictEqual(scanner.next().type, TokenType.Dollar);
    assert.strictEqual(scanner.next().type, TokenType.CurlyOpen);
    assert.strictEqual(scanner.next().type, TokenType.VariableName);
    assert.strictEqual(scanner.next().type, TokenType.Forwardslash);
    assert.strictEqual(scanner.next().type, TokenType.VariableName);
    assert.strictEqual(scanner.next().type, TokenType.Forwardslash);
    assert.strictEqual(scanner.next().type, TokenType.VariableName);
    assert.strictEqual(scanner.next().type, TokenType.Forwardslash);
    assert.strictEqual(scanner.next().type, TokenType.VariableName);
    assert.strictEqual(scanner.next().type, TokenType.CurlyClose);
    assert.strictEqual(scanner.next().type, TokenType.EOF);
  });
  function assertText(value, expected) {
    const actual = SnippetParser.asInsertText(value);
    assert.strictEqual(actual, expected);
  }
  function assertMarker(input, ...ctors) {
    let marker;
    if (input instanceof TextmateSnippet) {
      marker = [...input.children];
    } else if (typeof input === "string") {
      const p = new SnippetParser();
      marker = p.parse(input).children;
    } else {
      marker = [...input];
    }
    while (marker.length > 0) {
      const m = marker.pop();
      const ctor = ctors.pop();
      assert.ok(m instanceof ctor);
    }
    assert.strictEqual(marker.length, ctors.length);
    assert.strictEqual(marker.length, 0);
  }
  function assertTextAndMarker(value, escaped, ...ctors) {
    assertText(value, escaped);
    assertMarker(value, ...ctors);
  }
  function assertEscaped(value, expected) {
    const actual = SnippetParser.escape(value);
    assert.strictEqual(actual, expected);
  }
  test("Parser, escaped", function() {
    assertEscaped("foo$0", "foo\\$0");
    assertEscaped("foo\\$0", "foo\\\\\\$0");
    assertEscaped("f$1oo$0", "f\\$1oo\\$0");
    assertEscaped("${1:foo}$0", "\\${1:foo\\}\\$0");
    assertEscaped("$", "\\$");
  });
  test("Parser, text", () => {
    assertText("$", "$");
    assertText("\\\\$", "\\$");
    assertText("{", "{");
    assertText("\\}", "}");
    assertText("\\abc", "\\abc");
    assertText("foo${f:\\}}bar", "foo}bar");
    assertText("\\{", "\\{");
    assertText("I need \\\\\\$", "I need \\$");
    assertText("\\", "\\");
    assertText("\\{{", "\\{{");
    assertText("{{", "{{");
    assertText("{{dd", "{{dd");
    assertText("}}", "}}");
    assertText("ff}}", "ff}}");
    assertText("farboo", "farboo");
    assertText("far{{}}boo", "far{{}}boo");
    assertText("far{{123}}boo", "far{{123}}boo");
    assertText("far\\{{123}}boo", "far\\{{123}}boo");
    assertText("far{{id:bern}}boo", "far{{id:bern}}boo");
    assertText("far{{id:bern {{basel}}}}boo", "far{{id:bern {{basel}}}}boo");
    assertText("far{{id:bern {{id:basel}}}}boo", "far{{id:bern {{id:basel}}}}boo");
    assertText("far{{id:bern {{id2:basel}}}}boo", "far{{id:bern {{id2:basel}}}}boo");
  });
  test("Parser, TM text", () => {
    assertTextAndMarker("foo${1:bar}}", "foobar}", Text, Placeholder, Text);
    assertTextAndMarker("foo${1:bar}${2:foo}}", "foobarfoo}", Text, Placeholder, Placeholder, Text);
    assertTextAndMarker("foo${1:bar\\}${2:foo}}", "foobar}foo", Text, Placeholder);
    const [, placeholder] = new SnippetParser().parse("foo${1:bar\\}${2:foo}}").children;
    const { children } = placeholder;
    assert.strictEqual(placeholder.index, 1);
    assert.ok(children[0] instanceof Text);
    assert.strictEqual(children[0].toString(), "bar}");
    assert.ok(children[1] instanceof Placeholder);
    assert.strictEqual(children[1].toString(), "foo");
  });
  test("Parser, placeholder", () => {
    assertTextAndMarker("farboo", "farboo", Text);
    assertTextAndMarker("far{{}}boo", "far{{}}boo", Text);
    assertTextAndMarker("far{{123}}boo", "far{{123}}boo", Text);
    assertTextAndMarker("far\\{{123}}boo", "far\\{{123}}boo", Text);
  });
  test("Parser, literal code", () => {
    assertTextAndMarker("far`123`boo", "far`123`boo", Text);
    assertTextAndMarker("far\\`123\\`boo", "far\\`123\\`boo", Text);
  });
  test("Parser, variables/tabstop", () => {
    assertTextAndMarker("$far-boo", "-boo", Variable, Text);
    assertTextAndMarker("\\$far-boo", "$far-boo", Text);
    assertTextAndMarker("far$farboo", "far", Text, Variable);
    assertTextAndMarker("far${farboo}", "far", Text, Variable);
    assertTextAndMarker("$123", "", Placeholder);
    assertTextAndMarker("$farboo", "", Variable);
    assertTextAndMarker("$far12boo", "", Variable);
    assertTextAndMarker("000_${far}_000", "000__000", Text, Variable, Text);
    assertTextAndMarker("FFF_${TM_SELECTED_TEXT}_FFF$0", "FFF__FFF", Text, Variable, Text, Placeholder);
  });
  test("Parser, variables/placeholder with defaults", () => {
    assertTextAndMarker("${name:value}", "value", Variable);
    assertTextAndMarker("${1:value}", "value", Placeholder);
    assertTextAndMarker("${1:bar${2:foo}bar}", "barfoobar", Placeholder);
    assertTextAndMarker("${name:value", "${name:value", Text);
    assertTextAndMarker("${1:bar${2:foobar}", "${1:barfoobar", Text, Placeholder);
  });
  test("Parser, variable transforms", function() {
    assertTextAndMarker("${foo///}", "", Variable);
    assertTextAndMarker("${foo/regex/format/gmi}", "", Variable);
    assertTextAndMarker("${foo/([A-Z][a-z])/format/}", "", Variable);
    assertTextAndMarker("${foo/([A-Z][a-z])/format/GMI}", "${foo/([A-Z][a-z])/format/GMI}", Text);
    assertTextAndMarker("${foo/([A-Z][a-z])/format/funky}", "${foo/([A-Z][a-z])/format/funky}", Text);
    assertTextAndMarker("${foo/([A-Z][a-z]/format/}", "${foo/([A-Z][a-z]/format/}", Text);
    assertTextAndMarker("${foo/m\\/atch/$1/i}", "", Variable);
    assertMarker("${foo/regex/format/options}", Text);
    assertTextAndMarker("${foo///", "${foo///", Text);
    assertTextAndMarker("${foo/regex/format/options", "${foo/regex/format/options", Text);
    assertMarker("${foo/.*/${0:fooo}/i}", Variable);
    assertMarker("${foo/.*/${1}/i}", Variable);
    assertMarker("${foo/.*/$1/i}", Variable);
    assertMarker("${foo/.*/This-$1-encloses/i}", Variable);
    assertMarker("${foo/.*/complex${1:else}/i}", Variable);
    assertMarker("${foo/.*/complex${1:-else}/i}", Variable);
    assertMarker("${foo/.*/complex${1:+if}/i}", Variable);
    assertMarker("${foo/.*/complex${1:?if:else}/i}", Variable);
    assertMarker("${foo/.*/complex${1:/upcase}/i}", Variable);
  });
  test("Parser, placeholder transforms", function() {
    assertTextAndMarker("${1///}", "", Placeholder);
    assertTextAndMarker("${1/regex/format/gmi}", "", Placeholder);
    assertTextAndMarker("${1/([A-Z][a-z])/format/}", "", Placeholder);
    assertTextAndMarker("${1/m\\/atch/$1/i}", "", Placeholder);
    assertMarker("${1/regex/format/options}", Text);
    assertTextAndMarker("${1///", "${1///", Text);
    assertTextAndMarker("${1/regex/format/options", "${1/regex/format/options", Text);
  });
  test("No way to escape forward slash in snippet regex #36715", function() {
    assertMarker("${TM_DIRECTORY/src\\//$1/}", Variable);
  });
  test("No way to escape forward slash in snippet format section #37562", function() {
    assertMarker("${TM_SELECTED_TEXT/a/\\/$1/g}", Variable);
    assertMarker("${TM_SELECTED_TEXT/a/in\\/$1ner/g}", Variable);
    assertMarker("${TM_SELECTED_TEXT/a/end\\//g}", Variable);
  });
  test("Parser, placeholder with choice", () => {
    assertTextAndMarker("${1|one,two,three|}", "one", Placeholder);
    assertTextAndMarker("${1|one|}", "one", Placeholder);
    assertTextAndMarker("${1|one1,two2|}", "one1", Placeholder);
    assertTextAndMarker("${1|one1\\,two2|}", "one1,two2", Placeholder);
    assertTextAndMarker("${1|one1\\|two2|}", "one1|two2", Placeholder);
    assertTextAndMarker("${1|one1\\atwo2|}", "one1\\atwo2", Placeholder);
    assertTextAndMarker("${1|one,two,three,|}", "${1|one,two,three,|}", Text);
    assertTextAndMarker("${1|one,", "${1|one,", Text);
    const snippet = new SnippetParser().parse("${1|one,two,three|}");
    const expected = [
      (m) => m instanceof Placeholder,
      (m) => m instanceof Choice && m.options.length === 3 && m.options.every((x) => x instanceof Text)
    ];
    snippet.walk((marker) => {
      assert.ok(expected.shift()(marker));
      return true;
    });
  });
  test("Snippet choices: unable to escape comma and pipe, #31521", function() {
    assertTextAndMarker("console.log(${1|not\\, not, five, 5, 1   23|});", "console.log(not, not);", Text, Placeholder, Text);
  });
  test("Marker, toTextmateString()", function() {
    function assertTextsnippetString(input, expected) {
      const snippet = new SnippetParser().parse(input);
      const actual = snippet.toTextmateString();
      assert.strictEqual(actual, expected);
    }
    assertTextsnippetString("$1", "$1");
    assertTextsnippetString("\\$1", "\\$1");
    assertTextsnippetString("console.log(${1|not\\, not, five, 5, 1   23|});", "console.log(${1|not\\, not, five, 5, 1   23|});");
    assertTextsnippetString("console.log(${1|not\\, not, \\| five, 5, 1   23|});", "console.log(${1|not\\, not, \\| five, 5, 1   23|});");
    assertTextsnippetString("${1|cho\\,ices,wi\\|th,esc\\\\aping,chall\\\\\\,enges|}", "${1|cho\\,ices,wi\\|th,esc\\\\aping,chall\\\\\\,enges|}");
    assertTextsnippetString("this is text", "this is text");
    assertTextsnippetString("this ${1:is ${2:nested with $var}}", "this ${1:is ${2:nested with ${var}}}");
    assertTextsnippetString("this ${1:is ${2:nested with $var}}}", "this ${1:is ${2:nested with ${var}}}\\}");
  });
  test("Marker, toTextmateString() <-> identity", function() {
    function assertIdent(input) {
      const snippet = new SnippetParser().parse(input);
      const input2 = snippet.toTextmateString();
      const snippet2 = new SnippetParser().parse(input2);
      function checkCheckChildren(marker1, marker2) {
        assert.ok(marker1 instanceof Object.getPrototypeOf(marker2).constructor);
        assert.ok(marker2 instanceof Object.getPrototypeOf(marker1).constructor);
        assert.strictEqual(marker1.children.length, marker2.children.length);
        assert.strictEqual(marker1.toString(), marker2.toString());
        for (let i = 0; i < marker1.children.length; i++) {
          checkCheckChildren(marker1.children[i], marker2.children[i]);
        }
      }
      checkCheckChildren(snippet, snippet2);
    }
    assertIdent("$1");
    assertIdent("\\$1");
    assertIdent("console.log(${1|not\\, not, five, 5, 1   23|});");
    assertIdent("console.log(${1|not\\, not, \\| five, 5, 1   23|});");
    assertIdent("this is text");
    assertIdent("this ${1:is ${2:nested with $var}}");
    assertIdent("this ${1:is ${2:nested with $var}}}");
    assertIdent("this ${1:is ${2:nested with $var}} and repeating $1");
  });
  test("Parser, choise marker", () => {
    const { placeholders } = new SnippetParser().parse("${1|one,two,three|}");
    assert.strictEqual(placeholders.length, 1);
    assert.ok(placeholders[0].choice instanceof Choice);
    assert.ok(placeholders[0].children[0] instanceof Choice);
    assert.strictEqual(placeholders[0].children[0].options.length, 3);
    assertText("${1|one,two,three|}", "one");
    assertText("\\${1|one,two,three|}", "${1|one,two,three|}");
    assertText("${1\\|one,two,three|}", "${1\\|one,two,three|}");
    assertText("${1||}", "${1||}");
  });
  test("Backslash character escape in choice tabstop doesn't work #58494", function() {
    const { placeholders } = new SnippetParser().parse("${1|\\,,},$,\\|,\\\\|}");
    assert.strictEqual(placeholders.length, 1);
    assert.ok(placeholders[0].choice instanceof Choice);
  });
  test("Parser, only textmate", () => {
    const p = new SnippetParser();
    assertMarker(p.parse("far{{}}boo"), Text);
    assertMarker(p.parse("far{{123}}boo"), Text);
    assertMarker(p.parse("far\\{{123}}boo"), Text);
    assertMarker(p.parse("far$0boo"), Text, Placeholder, Text);
    assertMarker(p.parse("far${123}boo"), Text, Placeholder, Text);
    assertMarker(p.parse("far\\${123}boo"), Text);
  });
  test("Parser, real world", () => {
    let marker = new SnippetParser().parse("console.warn(${1: $TM_SELECTED_TEXT })").children;
    assert.strictEqual(marker[0].toString(), "console.warn(");
    assert.ok(marker[1] instanceof Placeholder);
    assert.strictEqual(marker[2].toString(), ")");
    const placeholder = marker[1];
    assert.strictEqual(placeholder.index, 1);
    assert.strictEqual(placeholder.children.length, 3);
    assert.ok(placeholder.children[0] instanceof Text);
    assert.ok(placeholder.children[1] instanceof Variable);
    assert.ok(placeholder.children[2] instanceof Text);
    assert.strictEqual(placeholder.children[0].toString(), " ");
    assert.strictEqual(placeholder.children[1].toString(), "");
    assert.strictEqual(placeholder.children[2].toString(), " ");
    const nestedVariable = placeholder.children[1];
    assert.strictEqual(nestedVariable.name, "TM_SELECTED_TEXT");
    assert.strictEqual(nestedVariable.children.length, 0);
    marker = new SnippetParser().parse("$TM_SELECTED_TEXT").children;
    assert.strictEqual(marker.length, 1);
    assert.ok(marker[0] instanceof Variable);
  });
  test("Parser, transform example", () => {
    const { children } = new SnippetParser().parse("${1:name} : ${2:type}${3/\\s:=(.*)/${1:+ :=}${1}/};\n$0");
    assert.ok(children[0] instanceof Placeholder);
    assert.strictEqual(children[0].children.length, 1);
    assert.strictEqual(children[0].children[0].toString(), "name");
    assert.strictEqual(children[0].transform, void 0);
    assert.ok(children[1] instanceof Text);
    assert.strictEqual(children[1].toString(), " : ");
    assert.ok(children[2] instanceof Placeholder);
    assert.strictEqual(children[2].children.length, 1);
    assert.strictEqual(children[2].children[0].toString(), "type");
    assert.ok(children[3] instanceof Placeholder);
    assert.strictEqual(children[3].children.length, 0);
    assert.notStrictEqual(children[3].transform, void 0);
    const transform = children[3].transform;
    assert.deepStrictEqual(transform.regexp, /\s:=(.*)/);
    assert.strictEqual(transform.children.length, 2);
    assert.ok(transform.children[0] instanceof FormatString);
    assert.strictEqual(transform.children[0].index, 1);
    assert.strictEqual(transform.children[0].ifValue, " :=");
    assert.ok(transform.children[1] instanceof FormatString);
    assert.strictEqual(transform.children[1].index, 1);
    assert.ok(children[4] instanceof Text);
    assert.strictEqual(children[4].toString(), ";\n");
  });
  test("Parser, default placeholder values", () => {
    assertMarker("errorContext: `${1:err}`, error: $1", Text, Placeholder, Text, Placeholder);
    const [, p1, , p2] = new SnippetParser().parse("errorContext: `${1:err}`, error:$1").children;
    assert.strictEqual(p1.index, 1);
    assert.strictEqual(p1.children.length, 1);
    assert.strictEqual(p1.children[0].toString(), "err");
    assert.strictEqual(p2.index, 1);
    assert.strictEqual(p2.children.length, 1);
    assert.strictEqual(p2.children[0].toString(), "err");
  });
  test("Parser, default placeholder values and one transform", () => {
    assertMarker("errorContext: `${1:err}`, error: ${1/err/ok/}", Text, Placeholder, Text, Placeholder);
    const [, p3, , p4] = new SnippetParser().parse("errorContext: `${1:err}`, error:${1/err/ok/}").children;
    assert.strictEqual(p3.index, 1);
    assert.strictEqual(p3.children.length, 1);
    assert.strictEqual(p3.children[0].toString(), "err");
    assert.strictEqual(p3.transform, void 0);
    assert.strictEqual(p4.index, 1);
    assert.strictEqual(p4.children.length, 1);
    assert.strictEqual(p4.children[0].toString(), "err");
    assert.notStrictEqual(p4.transform, void 0);
  });
  test("Repeated snippet placeholder should always inherit, #31040", function() {
    assertText("${1:foo}-abc-$1", "foo-abc-foo");
    assertText("${1:foo}-abc-${1}", "foo-abc-foo");
    assertText("${1:foo}-abc-${1:bar}", "foo-abc-foo");
    assertText("${1}-abc-${1:foo}", "foo-abc-foo");
  });
  test("backspace esapce in TM only, #16212", () => {
    const actual = SnippetParser.asInsertText("Foo \\\\${abc}bar");
    assert.strictEqual(actual, "Foo \\bar");
  });
  test("colon as variable/placeholder value, #16717", () => {
    let actual = SnippetParser.asInsertText("${TM_SELECTED_TEXT:foo:bar}");
    assert.strictEqual(actual, "foo:bar");
    actual = SnippetParser.asInsertText("${1:foo:bar}");
    assert.strictEqual(actual, "foo:bar");
  });
  test("incomplete placeholder", () => {
    assertTextAndMarker("${1:}", "", Placeholder);
  });
  test("marker#len", () => {
    function assertLen(template, ...lengths) {
      const snippet = new SnippetParser().parse(template, true);
      snippet.walk((m) => {
        const expected = lengths.shift();
        assert.strictEqual(m.len(), expected);
        return true;
      });
      assert.strictEqual(lengths.length, 0);
    }
    assertLen("text$0", 4, 0);
    assertLen("$1text$0", 0, 4, 0);
    assertLen("te$1xt$0", 2, 0, 2, 0);
    assertLen("errorContext: `${1:err}`, error: $0", 15, 0, 3, 10, 0);
    assertLen("errorContext: `${1:err}`, error: $1$0", 15, 0, 3, 10, 0, 3, 0);
    assertLen("$TM_SELECTED_TEXT$0", 0, 0);
    assertLen("${TM_SELECTED_TEXT:def}$0", 0, 3, 0);
  });
  test("parser, parent node", function() {
    let snippet = new SnippetParser().parse("This ${1:is ${2:nested}}$0", true);
    assert.strictEqual(snippet.placeholders.length, 3);
    let [first, second] = snippet.placeholders;
    assert.strictEqual(first.index, 1);
    assert.strictEqual(second.index, 2);
    assert.ok(second.parent === first);
    assert.ok(first.parent === snippet);
    snippet = new SnippetParser().parse("${VAR:default${1:value}}$0", true);
    assert.strictEqual(snippet.placeholders.length, 2);
    [first] = snippet.placeholders;
    assert.strictEqual(first.index, 1);
    assert.ok(snippet.children[0] instanceof Variable);
    assert.ok(first.parent === snippet.children[0]);
  });
  test("TextmateSnippet#enclosingPlaceholders", () => {
    const snippet = new SnippetParser().parse("This ${1:is ${2:nested}}$0", true);
    const [first, second] = snippet.placeholders;
    assert.deepStrictEqual(snippet.enclosingPlaceholders(first), []);
    assert.deepStrictEqual(snippet.enclosingPlaceholders(second), [first]);
  });
  test("TextmateSnippet#offset", () => {
    let snippet = new SnippetParser().parse("te$1xt", true);
    assert.strictEqual(snippet.offset(snippet.children[0]), 0);
    assert.strictEqual(snippet.offset(snippet.children[1]), 2);
    assert.strictEqual(snippet.offset(snippet.children[2]), 2);
    snippet = new SnippetParser().parse("${TM_SELECTED_TEXT:def}", true);
    assert.strictEqual(snippet.offset(snippet.children[0]), 0);
    assert.strictEqual(snippet.offset(snippet.children[0].children[0]), 0);
    assert.strictEqual(snippet.offset(new Text("foo")), -1);
  });
  test("TextmateSnippet#placeholder", () => {
    let snippet = new SnippetParser().parse("te$1xt$0", true);
    let placeholders = snippet.placeholders;
    assert.strictEqual(placeholders.length, 2);
    snippet = new SnippetParser().parse("te$1xt$1$0", true);
    placeholders = snippet.placeholders;
    assert.strictEqual(placeholders.length, 3);
    snippet = new SnippetParser().parse("te$1xt$2$0", true);
    placeholders = snippet.placeholders;
    assert.strictEqual(placeholders.length, 3);
    snippet = new SnippetParser().parse("${1:bar${2:foo}bar}$0", true);
    placeholders = snippet.placeholders;
    assert.strictEqual(placeholders.length, 3);
  });
  test("TextmateSnippet#replace 1/2", function() {
    const snippet = new SnippetParser().parse("aaa${1:bbb${2:ccc}}$0", true);
    assert.strictEqual(snippet.placeholders.length, 3);
    const [, second] = snippet.placeholders;
    assert.strictEqual(second.index, 2);
    const enclosing = snippet.enclosingPlaceholders(second);
    assert.strictEqual(enclosing.length, 1);
    assert.strictEqual(enclosing[0].index, 1);
    const nested = new SnippetParser().parse("ddd$1eee$0", true);
    snippet.replace(second, nested.children);
    assert.strictEqual(snippet.toString(), "aaabbbdddeee");
    assert.strictEqual(snippet.placeholders.length, 4);
    assert.strictEqual(snippet.placeholders[0].index, 1);
    assert.strictEqual(snippet.placeholders[1].index, 1);
    assert.strictEqual(snippet.placeholders[2].index, 0);
    assert.strictEqual(snippet.placeholders[3].index, 0);
    const newEnclosing = snippet.enclosingPlaceholders(snippet.placeholders[1]);
    assert.ok(newEnclosing[0] === snippet.placeholders[0]);
    assert.strictEqual(newEnclosing.length, 1);
    assert.strictEqual(newEnclosing[0].index, 1);
  });
  test("TextmateSnippet#replace 2/2", function() {
    const snippet = new SnippetParser().parse("aaa${1:bbb${2:ccc}}$0", true);
    assert.strictEqual(snippet.placeholders.length, 3);
    const [, second] = snippet.placeholders;
    assert.strictEqual(second.index, 2);
    const nested = new SnippetParser().parse("dddeee$0", true);
    snippet.replace(second, nested.children);
    assert.strictEqual(snippet.toString(), "aaabbbdddeee");
    assert.strictEqual(snippet.placeholders.length, 3);
  });
  test("Snippet order for placeholders, #28185", function() {
    const _10 = new Placeholder(10);
    const _2 = new Placeholder(2);
    assert.strictEqual(Placeholder.compareByIndex(_10, _2), 1);
  });
  test("Maximum call stack size exceeded, #28983", function() {
    new SnippetParser().parse("${1:${foo:${1}}}");
  });
  test("Snippet can freeze the editor, #30407", function() {
    const seen = /* @__PURE__ */ new Set();
    seen.clear();
    new SnippetParser().parse("class ${1:${TM_FILENAME/(?:\\A|_)([A-Za-z0-9]+)(?:\\.rb)?/(?2::\\u$1)/g}} < ${2:Application}Controller\n  $3\nend").walk((marker) => {
      assert.ok(!seen.has(marker));
      seen.add(marker);
      return true;
    });
    seen.clear();
    new SnippetParser().parse("${1:${FOO:abc$1def}}").walk((marker) => {
      assert.ok(!seen.has(marker));
      seen.add(marker);
      return true;
    });
  });
  test("Snippets: make parser ignore `${0|choice|}`, #31599", function() {
    assertTextAndMarker("${0|foo,bar|}", "${0|foo,bar|}", Text);
    assertTextAndMarker("${1|foo,bar|}", "foo", Placeholder);
  });
  test("Transform -> FormatString#resolve", function() {
    assert.strictEqual(new FormatString(1, "upcase").resolve("foo"), "FOO");
    assert.strictEqual(new FormatString(1, "downcase").resolve("FOO"), "foo");
    assert.strictEqual(new FormatString(1, "capitalize").resolve("bar"), "Bar");
    assert.strictEqual(new FormatString(1, "capitalize").resolve("bar no repeat"), "Bar no repeat");
    assert.strictEqual(new FormatString(1, "pascalcase").resolve("bar-foo"), "BarFoo");
    assert.strictEqual(new FormatString(1, "pascalcase").resolve("bar-42-foo"), "Bar42Foo");
    assert.strictEqual(new FormatString(1, "pascalcase").resolve("snake_AndPascalCase"), "SnakeAndPascalCase");
    assert.strictEqual(new FormatString(1, "pascalcase").resolve("kebab-AndPascalCase"), "KebabAndPascalCase");
    assert.strictEqual(new FormatString(1, "pascalcase").resolve("_justPascalCase"), "JustPascalCase");
    assert.strictEqual(new FormatString(1, "camelcase").resolve("bar-foo"), "barFoo");
    assert.strictEqual(new FormatString(1, "camelcase").resolve("bar-42-foo"), "bar42Foo");
    assert.strictEqual(new FormatString(1, "camelcase").resolve("snake_AndCamelCase"), "snakeAndCamelCase");
    assert.strictEqual(new FormatString(1, "camelcase").resolve("kebab-AndCamelCase"), "kebabAndCamelCase");
    assert.strictEqual(new FormatString(1, "camelcase").resolve("_JustCamelCase"), "justCamelCase");
    assert.strictEqual(new FormatString(1, "notKnown").resolve("input"), "input");
    assert.strictEqual(new FormatString(1, void 0, "foo", void 0).resolve(void 0), "");
    assert.strictEqual(new FormatString(1, void 0, "foo", void 0).resolve(""), "");
    assert.strictEqual(new FormatString(1, void 0, "foo", void 0).resolve("bar"), "foo");
    assert.strictEqual(new FormatString(1, void 0, void 0, "foo").resolve(void 0), "foo");
    assert.strictEqual(new FormatString(1, void 0, void 0, "foo").resolve(""), "foo");
    assert.strictEqual(new FormatString(1, void 0, void 0, "foo").resolve("bar"), "bar");
    assert.strictEqual(new FormatString(1, void 0, "bar", "foo").resolve(void 0), "foo");
    assert.strictEqual(new FormatString(1, void 0, "bar", "foo").resolve(""), "foo");
    assert.strictEqual(new FormatString(1, void 0, "bar", "foo").resolve("baz"), "bar");
  });
  test("Snippet variable transformation doesn't work if regex is complicated and snippet body contains '$$' #55627", function() {
    const snippet = new SnippetParser().parse('const fileName = "${TM_FILENAME/(.*)\\..+$/$1/}"');
    assert.strictEqual(snippet.toTextmateString(), 'const fileName = "${TM_FILENAME/(.*)\\..+$/${1}/}"');
  });
  test("[BUG] HTML attribute suggestions: Snippet session does not have end-position set, #33147", function() {
    const { placeholders } = new SnippetParser().parse('src="$1"', true);
    const [first, second] = placeholders;
    assert.strictEqual(placeholders.length, 2);
    assert.strictEqual(first.index, 1);
    assert.strictEqual(second.index, 0);
  });
  test("Snippet optional transforms are not applied correctly when reusing the same variable, #37702", function() {
    const transform = new Transform();
    transform.appendChild(new FormatString(1, "upcase"));
    transform.appendChild(new FormatString(2, "upcase"));
    transform.regexp = /^(.)|-(.)/g;
    assert.strictEqual(transform.resolve("my-file-name"), "MyFileName");
    const clone = transform.clone();
    assert.strictEqual(clone.resolve("my-file-name"), "MyFileName");
  });
  test("problem with snippets regex #40570", function() {
    const snippet = new SnippetParser().parse("${TM_DIRECTORY/.*src[\\/](.*)/$1/}");
    assertMarker(snippet, Variable);
  });
  test("Variable transformation doesn't work if undefined variables are used in the same snippet #51769", function() {
    const transform = new Transform();
    transform.appendChild(new Text("bar"));
    transform.regexp = new RegExp("foo", "gi");
    assert.strictEqual(transform.toTextmateString(), "/foo/bar/ig");
  });
  test("Snippet parser freeze #53144", function() {
    const snippet = new SnippetParser().parse("${1/(void$)|(.+)/${1:?-	return nil;}/}");
    assertMarker(snippet, Placeholder);
  });
  test("snippets variable not resolved in JSON proposal #52931", function() {
    assertTextAndMarker("FOO${1:/bin/bash}", "FOO/bin/bash", Text, Placeholder);
  });
  test("Mirroring sequence of nested placeholders not selected properly on backjumping #58736", function() {
    const snippet = new SnippetParser().parse("${3:nest1 ${1:nest2 ${2:nest3}}} $3");
    assert.strictEqual(snippet.children.length, 3);
    assert.ok(snippet.children[0] instanceof Placeholder);
    assert.ok(snippet.children[1] instanceof Text);
    assert.ok(snippet.children[2] instanceof Placeholder);
    function assertParent(marker) {
      marker.children.forEach(assertParent);
      if (!(marker instanceof Placeholder)) {
        return;
      }
      let found = false;
      let m = marker;
      while (m && !found) {
        if (m.parent === snippet) {
          found = true;
        }
        m = m.parent;
      }
      assert.ok(found);
    }
    const [, , clone] = snippet.children;
    assertParent(clone);
  });
  test("Backspace can't be escaped in snippet variable transforms #65412", function() {
    const snippet = new SnippetParser().parse("namespace ${TM_DIRECTORY/[\\/]/\\\\/g};");
    assertMarker(snippet, Text, Variable, Text);
  });
  test("Snippet cannot escape closing bracket inside conditional insertion variable replacement #78883", function() {
    const snippet = new SnippetParser().parse("${TM_DIRECTORY/(.+)/${1:+import { hello \\} from world}/}");
    const variable = snippet.children[0];
    assert.strictEqual(snippet.children.length, 1);
    assert.ok(variable instanceof Variable);
    assert.ok(variable.transform);
    assert.strictEqual(variable.transform.children.length, 1);
    assert.ok(variable.transform.children[0] instanceof FormatString);
    assert.strictEqual(variable.transform.children[0].ifValue, "import { hello } from world");
    assert.strictEqual(variable.transform.children[0].elseValue, void 0);
  });
  test("Snippet escape backslashes inside conditional insertion variable replacement #80394", function() {
    const snippet = new SnippetParser().parse("${CURRENT_YEAR/(.+)/${1:+\\\\}/}");
    const variable = snippet.children[0];
    assert.strictEqual(snippet.children.length, 1);
    assert.ok(variable instanceof Variable);
    assert.ok(variable.transform);
    assert.strictEqual(variable.transform.children.length, 1);
    assert.ok(variable.transform.children[0] instanceof FormatString);
    assert.strictEqual(variable.transform.children[0].ifValue, "\\");
    assert.strictEqual(variable.transform.children[0].elseValue, void 0);
  });
  test("Snippet placeholder empty right after expansion #152553", function() {
    const snippet = new SnippetParser().parse("${1:prog}: ${2:$1.cc} - $2");
    const actual = snippet.toString();
    assert.strictEqual(actual, "prog: prog.cc - prog.cc");
    const snippet2 = new SnippetParser().parse("${1:prog}: ${3:${2:$1.cc}.33} - $2 $3");
    const actual2 = snippet2.toString();
    assert.strictEqual(actual2, "prog: prog.cc.33 - prog.cc prog.cc.33");
    const snippet3 = new SnippetParser().parse("${1:$2.one} <> ${2:$1.two}");
    const actual3 = snippet3.toString();
    assert.strictEqual(actual3, ".two.one.two.one <> .one.two.one.two");
  });
  test("Snippet choices are incorrectly escaped/applied #180132", function() {
    assertTextAndMarker("${1|aaa$aaa|}bbb\\$bbb", "aaa$aaabbb$bbb", Placeholder, Text);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zbmlwcGV0L3Rlc3QvYnJvd3Nlci9zbmlwcGV0UGFyc2VyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBDaG9pY2UsIEZvcm1hdFN0cmluZywgTWFya2VyLCBQbGFjZWhvbGRlciwgU2Nhbm5lciwgU25pcHBldFBhcnNlciwgVGV4dCwgVGV4dG1hdGVTbmlwcGV0LCBUb2tlblR5cGUsIFRyYW5zZm9ybSwgVmFyaWFibGUgfSBmcm9tICcuLi8uLi9icm93c2VyL3NuaXBwZXRQYXJzZXIuanMnO1xuXG5zdWl0ZSgnU25pcHBldFBhcnNlcicsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdTY2FubmVyJywgKCkgPT4ge1xuXG5cdFx0Y29uc3Qgc2Nhbm5lciA9IG5ldyBTY2FubmVyKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5FT0YpO1xuXG5cdFx0c2Nhbm5lci50ZXh0KCdhYmMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLlZhcmlhYmxlTmFtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5FT0YpO1xuXG5cdFx0c2Nhbm5lci50ZXh0KCd7e2FiY319Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5DdXJseU9wZW4pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuQ3VybHlPcGVuKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLlZhcmlhYmxlTmFtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5DdXJseUNsb3NlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLkN1cmx5Q2xvc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuRU9GKTtcblxuXHRcdHNjYW5uZXIudGV4dCgnYWJjKCkgJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5WYXJpYWJsZU5hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuRm9ybWF0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLkVPRik7XG5cblx0XHRzY2FubmVyLnRleHQoJ2FiYyAxMjMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLlZhcmlhYmxlTmFtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5Gb3JtYXQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuSW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLkVPRik7XG5cblx0XHRzY2FubmVyLnRleHQoJyRmb28nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLkRvbGxhcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5WYXJpYWJsZU5hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuRU9GKTtcblxuXHRcdHNjYW5uZXIudGV4dCgnJGZvb19iYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLkRvbGxhcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5WYXJpYWJsZU5hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuRU9GKTtcblxuXHRcdHNjYW5uZXIudGV4dCgnJGZvby1iYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLkRvbGxhcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5WYXJpYWJsZU5hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuRGFzaCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5WYXJpYWJsZU5hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuRU9GKTtcblxuXHRcdHNjYW5uZXIudGV4dCgnJHtmb299Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5Eb2xsYXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuQ3VybHlPcGVuKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLlZhcmlhYmxlTmFtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5DdXJseUNsb3NlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLkVPRik7XG5cblx0XHRzY2FubmVyLnRleHQoJyR7MTIyMzpmb299Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5Eb2xsYXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuQ3VybHlPcGVuKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLkludCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5Db2xvbik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5WYXJpYWJsZU5hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuQ3VybHlDbG9zZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5FT0YpO1xuXG5cdFx0c2Nhbm5lci50ZXh0KCdcXFxcJHt9Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5CYWNrc2xhc2gpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuRG9sbGFyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLkN1cmx5T3Blbik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5DdXJseUNsb3NlKTtcblxuXHRcdHNjYW5uZXIudGV4dCgnJHtmb28vcmVnZXgvZm9ybWF0L29wdGlvbn0nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLkRvbGxhcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5DdXJseU9wZW4pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuVmFyaWFibGVOYW1lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLkZvcndhcmRzbGFzaCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5WYXJpYWJsZU5hbWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuRm9yd2FyZHNsYXNoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLlZhcmlhYmxlTmFtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjYW5uZXIubmV4dCgpLnR5cGUsIFRva2VuVHlwZS5Gb3J3YXJkc2xhc2gpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuVmFyaWFibGVOYW1lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Nhbm5lci5uZXh0KCkudHlwZSwgVG9rZW5UeXBlLkN1cmx5Q2xvc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY2FubmVyLm5leHQoKS50eXBlLCBUb2tlblR5cGUuRU9GKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gYXNzZXJ0VGV4dCh2YWx1ZTogc3RyaW5nLCBleHBlY3RlZDogc3RyaW5nKSB7XG5cdFx0Y29uc3QgYWN0dWFsID0gU25pcHBldFBhcnNlci5hc0luc2VydFRleHQodmFsdWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFzc2VydE1hcmtlcihpbnB1dDogVGV4dG1hdGVTbmlwcGV0IHwgTWFya2VyW10gfCBzdHJpbmcsIC4uLmN0b3JzOiBGdW5jdGlvbltdKSB7XG5cdFx0bGV0IG1hcmtlcjogTWFya2VyW107XG5cdFx0aWYgKGlucHV0IGluc3RhbmNlb2YgVGV4dG1hdGVTbmlwcGV0KSB7XG5cdFx0XHRtYXJrZXIgPSBbLi4uaW5wdXQuY2hpbGRyZW5dO1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0Y29uc3QgcCA9IG5ldyBTbmlwcGV0UGFyc2VyKCk7XG5cdFx0XHRtYXJrZXIgPSBwLnBhcnNlKGlucHV0KS5jaGlsZHJlbjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bWFya2VyID0gWy4uLmlucHV0XTtcblx0XHR9XG5cdFx0d2hpbGUgKG1hcmtlci5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBtID0gbWFya2VyLnBvcCgpO1xuXHRcdFx0Y29uc3QgY3RvciA9IGN0b3JzLnBvcCgpITtcblx0XHRcdGFzc2VydC5vayhtIGluc3RhbmNlb2YgY3Rvcik7XG5cdFx0fVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXJrZXIubGVuZ3RoLCBjdG9ycy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXJrZXIubGVuZ3RoLCAwKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFzc2VydFRleHRBbmRNYXJrZXIodmFsdWU6IHN0cmluZywgZXNjYXBlZDogc3RyaW5nLCAuLi5jdG9yczogRnVuY3Rpb25bXSkge1xuXHRcdGFzc2VydFRleHQodmFsdWUsIGVzY2FwZWQpO1xuXHRcdGFzc2VydE1hcmtlcih2YWx1ZSwgLi4uY3RvcnMpO1xuXHR9XG5cblx0ZnVuY3Rpb24gYXNzZXJ0RXNjYXBlZCh2YWx1ZTogc3RyaW5nLCBleHBlY3RlZDogc3RyaW5nKSB7XG5cdFx0Y29uc3QgYWN0dWFsID0gU25pcHBldFBhcnNlci5lc2NhcGUodmFsdWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0fVxuXG5cdHRlc3QoJ1BhcnNlciwgZXNjYXBlZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRhc3NlcnRFc2NhcGVkKCdmb28kMCcsICdmb29cXFxcJDAnKTtcblx0XHRhc3NlcnRFc2NhcGVkKCdmb29cXFxcJDAnLCAnZm9vXFxcXFxcXFxcXFxcJDAnKTtcblx0XHRhc3NlcnRFc2NhcGVkKCdmJDFvbyQwJywgJ2ZcXFxcJDFvb1xcXFwkMCcpO1xuXHRcdGFzc2VydEVzY2FwZWQoJyR7MTpmb299JDAnLCAnXFxcXCR7MTpmb29cXFxcfVxcXFwkMCcpO1xuXHRcdGFzc2VydEVzY2FwZWQoJyQnLCAnXFxcXCQnKTtcblx0fSk7XG5cblx0dGVzdCgnUGFyc2VyLCB0ZXh0JywgKCkgPT4ge1xuXHRcdGFzc2VydFRleHQoJyQnLCAnJCcpO1xuXHRcdGFzc2VydFRleHQoJ1xcXFxcXFxcJCcsICdcXFxcJCcpO1xuXHRcdGFzc2VydFRleHQoJ3snLCAneycpO1xuXHRcdGFzc2VydFRleHQoJ1xcXFx9JywgJ30nKTtcblx0XHRhc3NlcnRUZXh0KCdcXFxcYWJjJywgJ1xcXFxhYmMnKTtcblx0XHRhc3NlcnRUZXh0KCdmb28ke2Y6XFxcXH19YmFyJywgJ2Zvb31iYXInKTtcblx0XHRhc3NlcnRUZXh0KCdcXFxceycsICdcXFxceycpO1xuXHRcdGFzc2VydFRleHQoJ0kgbmVlZCBcXFxcXFxcXFxcXFwkJywgJ0kgbmVlZCBcXFxcJCcpO1xuXHRcdGFzc2VydFRleHQoJ1xcXFwnLCAnXFxcXCcpO1xuXHRcdGFzc2VydFRleHQoJ1xcXFx7eycsICdcXFxce3snKTtcblx0XHRhc3NlcnRUZXh0KCd7eycsICd7eycpO1xuXHRcdGFzc2VydFRleHQoJ3t7ZGQnLCAne3tkZCcpO1xuXHRcdGFzc2VydFRleHQoJ319JywgJ319Jyk7XG5cdFx0YXNzZXJ0VGV4dCgnZmZ9fScsICdmZn19Jyk7XG5cblx0XHRhc3NlcnRUZXh0KCdmYXJib28nLCAnZmFyYm9vJyk7XG5cdFx0YXNzZXJ0VGV4dCgnZmFye3t9fWJvbycsICdmYXJ7e319Ym9vJyk7XG5cdFx0YXNzZXJ0VGV4dCgnZmFye3sxMjN9fWJvbycsICdmYXJ7ezEyM319Ym9vJyk7XG5cdFx0YXNzZXJ0VGV4dCgnZmFyXFxcXHt7MTIzfX1ib28nLCAnZmFyXFxcXHt7MTIzfX1ib28nKTtcblx0XHRhc3NlcnRUZXh0KCdmYXJ7e2lkOmJlcm59fWJvbycsICdmYXJ7e2lkOmJlcm59fWJvbycpO1xuXHRcdGFzc2VydFRleHQoJ2Zhcnt7aWQ6YmVybiB7e2Jhc2VsfX19fWJvbycsICdmYXJ7e2lkOmJlcm4ge3tiYXNlbH19fX1ib28nKTtcblx0XHRhc3NlcnRUZXh0KCdmYXJ7e2lkOmJlcm4ge3tpZDpiYXNlbH19fX1ib28nLCAnZmFye3tpZDpiZXJuIHt7aWQ6YmFzZWx9fX19Ym9vJyk7XG5cdFx0YXNzZXJ0VGV4dCgnZmFye3tpZDpiZXJuIHt7aWQyOmJhc2VsfX19fWJvbycsICdmYXJ7e2lkOmJlcm4ge3tpZDI6YmFzZWx9fX19Ym9vJyk7XG5cdH0pO1xuXG5cblx0dGVzdCgnUGFyc2VyLCBUTSB0ZXh0JywgKCkgPT4ge1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJ2ZvbyR7MTpiYXJ9fScsICdmb29iYXJ9JywgVGV4dCwgUGxhY2Vob2xkZXIsIFRleHQpO1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJ2ZvbyR7MTpiYXJ9JHsyOmZvb319JywgJ2Zvb2JhcmZvb30nLCBUZXh0LCBQbGFjZWhvbGRlciwgUGxhY2Vob2xkZXIsIFRleHQpO1xuXG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignZm9vJHsxOmJhclxcXFx9JHsyOmZvb319JywgJ2Zvb2Jhcn1mb28nLCBUZXh0LCBQbGFjZWhvbGRlcik7XG5cblx0XHRjb25zdCBbLCBwbGFjZWhvbGRlcl0gPSBuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKCdmb28kezE6YmFyXFxcXH0kezI6Zm9vfX0nKS5jaGlsZHJlbjtcblx0XHRjb25zdCB7IGNoaWxkcmVuIH0gPSAoPFBsYWNlaG9sZGVyPnBsYWNlaG9sZGVyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPFBsYWNlaG9sZGVyPnBsYWNlaG9sZGVyKS5pbmRleCwgMSk7XG5cdFx0YXNzZXJ0Lm9rKGNoaWxkcmVuWzBdIGluc3RhbmNlb2YgVGV4dCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNoaWxkcmVuWzBdLnRvU3RyaW5nKCksICdiYXJ9Jyk7XG5cdFx0YXNzZXJ0Lm9rKGNoaWxkcmVuWzFdIGluc3RhbmNlb2YgUGxhY2Vob2xkZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGlsZHJlblsxXS50b1N0cmluZygpLCAnZm9vJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ1BhcnNlciwgcGxhY2Vob2xkZXInLCAoKSA9PiB7XG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignZmFyYm9vJywgJ2ZhcmJvbycsIFRleHQpO1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJ2Zhcnt7fX1ib28nLCAnZmFye3t9fWJvbycsIFRleHQpO1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJ2Zhcnt7MTIzfX1ib28nLCAnZmFye3sxMjN9fWJvbycsIFRleHQpO1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJ2ZhclxcXFx7ezEyM319Ym9vJywgJ2ZhclxcXFx7ezEyM319Ym9vJywgVGV4dCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1BhcnNlciwgbGl0ZXJhbCBjb2RlJywgKCkgPT4ge1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJ2ZhcmAxMjNgYm9vJywgJ2ZhcmAxMjNgYm9vJywgVGV4dCk7XG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignZmFyXFxcXGAxMjNcXFxcYGJvbycsICdmYXJcXFxcYDEyM1xcXFxgYm9vJywgVGV4dCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1BhcnNlciwgdmFyaWFibGVzL3RhYnN0b3AnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignJGZhci1ib28nLCAnLWJvbycsIFZhcmlhYmxlLCBUZXh0KTtcblx0XHRhc3NlcnRUZXh0QW5kTWFya2VyKCdcXFxcJGZhci1ib28nLCAnJGZhci1ib28nLCBUZXh0KTtcblx0XHRhc3NlcnRUZXh0QW5kTWFya2VyKCdmYXIkZmFyYm9vJywgJ2ZhcicsIFRleHQsIFZhcmlhYmxlKTtcblx0XHRhc3NlcnRUZXh0QW5kTWFya2VyKCdmYXIke2ZhcmJvb30nLCAnZmFyJywgVGV4dCwgVmFyaWFibGUpO1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJyQxMjMnLCAnJywgUGxhY2Vob2xkZXIpO1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJyRmYXJib28nLCAnJywgVmFyaWFibGUpO1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJyRmYXIxMmJvbycsICcnLCBWYXJpYWJsZSk7XG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignMDAwXyR7ZmFyfV8wMDAnLCAnMDAwX18wMDAnLCBUZXh0LCBWYXJpYWJsZSwgVGV4dCk7XG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignRkZGXyR7VE1fU0VMRUNURURfVEVYVH1fRkZGJDAnLCAnRkZGX19GRkYnLCBUZXh0LCBWYXJpYWJsZSwgVGV4dCwgUGxhY2Vob2xkZXIpO1xuXHR9KTtcblxuXHR0ZXN0KCdQYXJzZXIsIHZhcmlhYmxlcy9wbGFjZWhvbGRlciB3aXRoIGRlZmF1bHRzJywgKCkgPT4ge1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJyR7bmFtZTp2YWx1ZX0nLCAndmFsdWUnLCBWYXJpYWJsZSk7XG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignJHsxOnZhbHVlfScsICd2YWx1ZScsIFBsYWNlaG9sZGVyKTtcblx0XHRhc3NlcnRUZXh0QW5kTWFya2VyKCckezE6YmFyJHsyOmZvb31iYXJ9JywgJ2JhcmZvb2JhcicsIFBsYWNlaG9sZGVyKTtcblxuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJyR7bmFtZTp2YWx1ZScsICcke25hbWU6dmFsdWUnLCBUZXh0KTtcblx0XHRhc3NlcnRUZXh0QW5kTWFya2VyKCckezE6YmFyJHsyOmZvb2Jhcn0nLCAnJHsxOmJhcmZvb2JhcicsIFRleHQsIFBsYWNlaG9sZGVyKTtcblx0fSk7XG5cblx0dGVzdCgnUGFyc2VyLCB2YXJpYWJsZSB0cmFuc2Zvcm1zJywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJyR7Zm9vLy8vfScsICcnLCBWYXJpYWJsZSk7XG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignJHtmb28vcmVnZXgvZm9ybWF0L2dtaX0nLCAnJywgVmFyaWFibGUpO1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJyR7Zm9vLyhbQS1aXVthLXpdKS9mb3JtYXQvfScsICcnLCBWYXJpYWJsZSk7XG5cblx0XHQvLyBpbnZhbGlkIHJlZ2V4XG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignJHtmb28vKFtBLVpdW2Etel0pL2Zvcm1hdC9HTUl9JywgJyR7Zm9vLyhbQS1aXVthLXpdKS9mb3JtYXQvR01JfScsIFRleHQpO1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJyR7Zm9vLyhbQS1aXVthLXpdKS9mb3JtYXQvZnVua3l9JywgJyR7Zm9vLyhbQS1aXVthLXpdKS9mb3JtYXQvZnVua3l9JywgVGV4dCk7XG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignJHtmb28vKFtBLVpdW2Etel0vZm9ybWF0L30nLCAnJHtmb28vKFtBLVpdW2Etel0vZm9ybWF0L30nLCBUZXh0KTtcblxuXHRcdC8vIHRyaWNreSByZWdleFxuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJyR7Zm9vL21cXFxcL2F0Y2gvJDEvaX0nLCAnJywgVmFyaWFibGUpO1xuXHRcdGFzc2VydE1hcmtlcignJHtmb28vcmVnZXhcXC9mb3JtYXQvb3B0aW9uc30nLCBUZXh0KTtcblxuXHRcdC8vIGluY29tcGxldGVcblx0XHRhc3NlcnRUZXh0QW5kTWFya2VyKCcke2Zvby8vLycsICcke2Zvby8vLycsIFRleHQpO1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJyR7Zm9vL3JlZ2V4L2Zvcm1hdC9vcHRpb25zJywgJyR7Zm9vL3JlZ2V4L2Zvcm1hdC9vcHRpb25zJywgVGV4dCk7XG5cblx0XHQvLyBmb3JtYXQgc3RyaW5nXG5cdFx0YXNzZXJ0TWFya2VyKCcke2Zvby8uKi8kezA6Zm9vb30vaX0nLCBWYXJpYWJsZSk7XG5cdFx0YXNzZXJ0TWFya2VyKCcke2Zvby8uKi8kezF9L2l9JywgVmFyaWFibGUpO1xuXHRcdGFzc2VydE1hcmtlcignJHtmb28vLiovJDEvaX0nLCBWYXJpYWJsZSk7XG5cdFx0YXNzZXJ0TWFya2VyKCcke2Zvby8uKi9UaGlzLSQxLWVuY2xvc2VzL2l9JywgVmFyaWFibGUpO1xuXHRcdGFzc2VydE1hcmtlcignJHtmb28vLiovY29tcGxleCR7MTplbHNlfS9pfScsIFZhcmlhYmxlKTtcblx0XHRhc3NlcnRNYXJrZXIoJyR7Zm9vLy4qL2NvbXBsZXgkezE6LWVsc2V9L2l9JywgVmFyaWFibGUpO1xuXHRcdGFzc2VydE1hcmtlcignJHtmb28vLiovY29tcGxleCR7MToraWZ9L2l9JywgVmFyaWFibGUpO1xuXHRcdGFzc2VydE1hcmtlcignJHtmb28vLiovY29tcGxleCR7MTo/aWY6ZWxzZX0vaX0nLCBWYXJpYWJsZSk7XG5cdFx0YXNzZXJ0TWFya2VyKCcke2Zvby8uKi9jb21wbGV4JHsxOi91cGNhc2V9L2l9JywgVmFyaWFibGUpO1xuXG5cdH0pO1xuXG5cdHRlc3QoJ1BhcnNlciwgcGxhY2Vob2xkZXIgdHJhbnNmb3JtcycsIGZ1bmN0aW9uICgpIHtcblx0XHRhc3NlcnRUZXh0QW5kTWFya2VyKCckezEvLy99JywgJycsIFBsYWNlaG9sZGVyKTtcblx0XHRhc3NlcnRUZXh0QW5kTWFya2VyKCckezEvcmVnZXgvZm9ybWF0L2dtaX0nLCAnJywgUGxhY2Vob2xkZXIpO1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJyR7MS8oW0EtWl1bYS16XSkvZm9ybWF0L30nLCAnJywgUGxhY2Vob2xkZXIpO1xuXG5cdFx0Ly8gdHJpY2t5IHJlZ2V4XG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignJHsxL21cXFxcL2F0Y2gvJDEvaX0nLCAnJywgUGxhY2Vob2xkZXIpO1xuXHRcdGFzc2VydE1hcmtlcignJHsxL3JlZ2V4XFwvZm9ybWF0L29wdGlvbnN9JywgVGV4dCk7XG5cblx0XHQvLyBpbmNvbXBsZXRlXG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignJHsxLy8vJywgJyR7MS8vLycsIFRleHQpO1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJyR7MS9yZWdleC9mb3JtYXQvb3B0aW9ucycsICckezEvcmVnZXgvZm9ybWF0L29wdGlvbnMnLCBUZXh0KTtcblx0fSk7XG5cblx0dGVzdCgnTm8gd2F5IHRvIGVzY2FwZSBmb3J3YXJkIHNsYXNoIGluIHNuaXBwZXQgcmVnZXggIzM2NzE1JywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydE1hcmtlcignJHtUTV9ESVJFQ1RPUlkvc3JjXFxcXC8vJDEvfScsIFZhcmlhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgnTm8gd2F5IHRvIGVzY2FwZSBmb3J3YXJkIHNsYXNoIGluIHNuaXBwZXQgZm9ybWF0IHNlY3Rpb24gIzM3NTYyJywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydE1hcmtlcignJHtUTV9TRUxFQ1RFRF9URVhUL2EvXFxcXC8kMS9nfScsIFZhcmlhYmxlKTtcblx0XHRhc3NlcnRNYXJrZXIoJyR7VE1fU0VMRUNURURfVEVYVC9hL2luXFxcXC8kMW5lci9nfScsIFZhcmlhYmxlKTtcblx0XHRhc3NlcnRNYXJrZXIoJyR7VE1fU0VMRUNURURfVEVYVC9hL2VuZFxcXFwvL2d9JywgVmFyaWFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdQYXJzZXIsIHBsYWNlaG9sZGVyIHdpdGggY2hvaWNlJywgKCkgPT4ge1xuXG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignJHsxfG9uZSx0d28sdGhyZWV8fScsICdvbmUnLCBQbGFjZWhvbGRlcik7XG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignJHsxfG9uZXx9JywgJ29uZScsIFBsYWNlaG9sZGVyKTtcblx0XHRhc3NlcnRUZXh0QW5kTWFya2VyKCckezF8b25lMSx0d28yfH0nLCAnb25lMScsIFBsYWNlaG9sZGVyKTtcblx0XHRhc3NlcnRUZXh0QW5kTWFya2VyKCckezF8b25lMVxcXFwsdHdvMnx9JywgJ29uZTEsdHdvMicsIFBsYWNlaG9sZGVyKTtcblx0XHRhc3NlcnRUZXh0QW5kTWFya2VyKCckezF8b25lMVxcXFx8dHdvMnx9JywgJ29uZTF8dHdvMicsIFBsYWNlaG9sZGVyKTtcblx0XHRhc3NlcnRUZXh0QW5kTWFya2VyKCckezF8b25lMVxcXFxhdHdvMnx9JywgJ29uZTFcXFxcYXR3bzInLCBQbGFjZWhvbGRlcik7XG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignJHsxfG9uZSx0d28sdGhyZWUsfH0nLCAnJHsxfG9uZSx0d28sdGhyZWUsfH0nLCBUZXh0KTtcblx0XHRhc3NlcnRUZXh0QW5kTWFya2VyKCckezF8b25lLCcsICckezF8b25lLCcsIFRleHQpO1xuXG5cdFx0Y29uc3Qgc25pcHBldCA9IG5ldyBTbmlwcGV0UGFyc2VyKCkucGFyc2UoJyR7MXxvbmUsdHdvLHRocmVlfH0nKTtcblx0XHRjb25zdCBleHBlY3RlZDogKChtOiBNYXJrZXIpID0+IGJvb2xlYW4pW10gPSBbXG5cdFx0XHRtID0+IG0gaW5zdGFuY2VvZiBQbGFjZWhvbGRlcixcblx0XHRcdG0gPT4gbSBpbnN0YW5jZW9mIENob2ljZSAmJiBtLm9wdGlvbnMubGVuZ3RoID09PSAzICYmIG0ub3B0aW9ucy5ldmVyeSh4ID0+IHggaW5zdGFuY2VvZiBUZXh0KSxcblx0XHRdO1xuXHRcdHNuaXBwZXQud2FsayhtYXJrZXIgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKGV4cGVjdGVkLnNoaWZ0KCkhKG1hcmtlcikpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NuaXBwZXQgY2hvaWNlczogdW5hYmxlIHRvIGVzY2FwZSBjb21tYSBhbmQgcGlwZSwgIzMxNTIxJywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJ2NvbnNvbGUubG9nKCR7MXxub3RcXFxcLCBub3QsIGZpdmUsIDUsIDEgICAyM3x9KTsnLCAnY29uc29sZS5sb2cobm90LCBub3QpOycsIFRleHQsIFBsYWNlaG9sZGVyLCBUZXh0KTtcblx0fSk7XG5cblx0dGVzdCgnTWFya2VyLCB0b1RleHRtYXRlU3RyaW5nKCknLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRmdW5jdGlvbiBhc3NlcnRUZXh0c25pcHBldFN0cmluZyhpbnB1dDogc3RyaW5nLCBleHBlY3RlZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0XHRjb25zdCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZShpbnB1dCk7XG5cdFx0XHRjb25zdCBhY3R1YWwgPSBzbmlwcGV0LnRvVGV4dG1hdGVTdHJpbmcoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0XHR9XG5cblx0XHRhc3NlcnRUZXh0c25pcHBldFN0cmluZygnJDEnLCAnJDEnKTtcblx0XHRhc3NlcnRUZXh0c25pcHBldFN0cmluZygnXFxcXCQxJywgJ1xcXFwkMScpO1xuXHRcdGFzc2VydFRleHRzbmlwcGV0U3RyaW5nKCdjb25zb2xlLmxvZygkezF8bm90XFxcXCwgbm90LCBmaXZlLCA1LCAxICAgMjN8fSk7JywgJ2NvbnNvbGUubG9nKCR7MXxub3RcXFxcLCBub3QsIGZpdmUsIDUsIDEgICAyM3x9KTsnKTtcblx0XHRhc3NlcnRUZXh0c25pcHBldFN0cmluZygnY29uc29sZS5sb2coJHsxfG5vdFxcXFwsIG5vdCwgXFxcXHwgZml2ZSwgNSwgMSAgIDIzfH0pOycsICdjb25zb2xlLmxvZygkezF8bm90XFxcXCwgbm90LCBcXFxcfCBmaXZlLCA1LCAxICAgMjN8fSk7Jyk7XG5cdFx0YXNzZXJ0VGV4dHNuaXBwZXRTdHJpbmcoJyR7MXxjaG9cXFxcLGljZXMsd2lcXFxcfHRoLGVzY1xcXFxcXFxcYXBpbmcsY2hhbGxcXFxcXFxcXFxcXFwsZW5nZXN8fScsICckezF8Y2hvXFxcXCxpY2VzLHdpXFxcXHx0aCxlc2NcXFxcXFxcXGFwaW5nLGNoYWxsXFxcXFxcXFxcXFxcLGVuZ2VzfH0nKTtcblx0XHRhc3NlcnRUZXh0c25pcHBldFN0cmluZygndGhpcyBpcyB0ZXh0JywgJ3RoaXMgaXMgdGV4dCcpO1xuXHRcdGFzc2VydFRleHRzbmlwcGV0U3RyaW5nKCd0aGlzICR7MTppcyAkezI6bmVzdGVkIHdpdGggJHZhcn19JywgJ3RoaXMgJHsxOmlzICR7MjpuZXN0ZWQgd2l0aCAke3Zhcn19fScpO1xuXHRcdGFzc2VydFRleHRzbmlwcGV0U3RyaW5nKCd0aGlzICR7MTppcyAkezI6bmVzdGVkIHdpdGggJHZhcn19fScsICd0aGlzICR7MTppcyAkezI6bmVzdGVkIHdpdGggJHt2YXJ9fX1cXFxcfScpO1xuXHR9KTtcblxuXHR0ZXN0KCdNYXJrZXIsIHRvVGV4dG1hdGVTdHJpbmcoKSA8LT4gaWRlbnRpdHknLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRmdW5jdGlvbiBhc3NlcnRJZGVudChpbnB1dDogc3RyaW5nKTogdm9pZCB7XG5cdFx0XHQvLyBmdWxsIGxvb3A6ICgxKSBwYXJzZSBpbnB1dCwgKDIpIGdlbmVyYXRlIHRleHRtYXRlIHN0cmluZywgKDMpIHBhcnNlLCAoNCkgZW5zdXJlIGJvdGggdHJlZXMgYXJlIGVxdWFsXG5cdFx0XHRjb25zdCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZShpbnB1dCk7XG5cdFx0XHRjb25zdCBpbnB1dDIgPSBzbmlwcGV0LnRvVGV4dG1hdGVTdHJpbmcoKTtcblx0XHRcdGNvbnN0IHNuaXBwZXQyID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZShpbnB1dDIpO1xuXG5cdFx0XHRmdW5jdGlvbiBjaGVja0NoZWNrQ2hpbGRyZW4obWFya2VyMTogTWFya2VyLCBtYXJrZXIyOiBNYXJrZXIpIHtcblx0XHRcdFx0YXNzZXJ0Lm9rKG1hcmtlcjEgaW5zdGFuY2VvZiBPYmplY3QuZ2V0UHJvdG90eXBlT2YobWFya2VyMikuY29uc3RydWN0b3IpO1xuXHRcdFx0XHRhc3NlcnQub2sobWFya2VyMiBpbnN0YW5jZW9mIE9iamVjdC5nZXRQcm90b3R5cGVPZihtYXJrZXIxKS5jb25zdHJ1Y3Rvcik7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hcmtlcjEuY2hpbGRyZW4ubGVuZ3RoLCBtYXJrZXIyLmNoaWxkcmVuLmxlbmd0aCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXJrZXIxLnRvU3RyaW5nKCksIG1hcmtlcjIudG9TdHJpbmcoKSk7XG5cblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBtYXJrZXIxLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0Y2hlY2tDaGVja0NoaWxkcmVuKG1hcmtlcjEuY2hpbGRyZW5baV0sIG1hcmtlcjIuY2hpbGRyZW5baV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNoZWNrQ2hlY2tDaGlsZHJlbihzbmlwcGV0LCBzbmlwcGV0Mik7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0SWRlbnQoJyQxJyk7XG5cdFx0YXNzZXJ0SWRlbnQoJ1xcXFwkMScpO1xuXHRcdGFzc2VydElkZW50KCdjb25zb2xlLmxvZygkezF8bm90XFxcXCwgbm90LCBmaXZlLCA1LCAxICAgMjN8fSk7Jyk7XG5cdFx0YXNzZXJ0SWRlbnQoJ2NvbnNvbGUubG9nKCR7MXxub3RcXFxcLCBub3QsIFxcXFx8IGZpdmUsIDUsIDEgICAyM3x9KTsnKTtcblx0XHRhc3NlcnRJZGVudCgndGhpcyBpcyB0ZXh0Jyk7XG5cdFx0YXNzZXJ0SWRlbnQoJ3RoaXMgJHsxOmlzICR7MjpuZXN0ZWQgd2l0aCAkdmFyfX0nKTtcblx0XHRhc3NlcnRJZGVudCgndGhpcyAkezE6aXMgJHsyOm5lc3RlZCB3aXRoICR2YXJ9fX0nKTtcblx0XHRhc3NlcnRJZGVudCgndGhpcyAkezE6aXMgJHsyOm5lc3RlZCB3aXRoICR2YXJ9fSBhbmQgcmVwZWF0aW5nICQxJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ1BhcnNlciwgY2hvaXNlIG1hcmtlcicsICgpID0+IHtcblx0XHRjb25zdCB7IHBsYWNlaG9sZGVycyB9ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnJHsxfG9uZSx0d28sdGhyZWV8fScpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBsYWNlaG9sZGVycy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5vayhwbGFjZWhvbGRlcnNbMF0uY2hvaWNlIGluc3RhbmNlb2YgQ2hvaWNlKTtcblx0XHRhc3NlcnQub2socGxhY2Vob2xkZXJzWzBdLmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgQ2hvaWNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxDaG9pY2U+cGxhY2Vob2xkZXJzWzBdLmNoaWxkcmVuWzBdKS5vcHRpb25zLmxlbmd0aCwgMyk7XG5cblx0XHRhc3NlcnRUZXh0KCckezF8b25lLHR3byx0aHJlZXx9JywgJ29uZScpO1xuXHRcdGFzc2VydFRleHQoJ1xcXFwkezF8b25lLHR3byx0aHJlZXx9JywgJyR7MXxvbmUsdHdvLHRocmVlfH0nKTtcblx0XHRhc3NlcnRUZXh0KCckezFcXFxcfG9uZSx0d28sdGhyZWV8fScsICckezFcXFxcfG9uZSx0d28sdGhyZWV8fScpO1xuXHRcdGFzc2VydFRleHQoJyR7MXx8fScsICckezF8fH0nKTtcblx0fSk7XG5cblx0dGVzdCgnQmFja3NsYXNoIGNoYXJhY3RlciBlc2NhcGUgaW4gY2hvaWNlIHRhYnN0b3AgZG9lc25cXCd0IHdvcmsgIzU4NDk0JywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgeyBwbGFjZWhvbGRlcnMgfSA9IG5ldyBTbmlwcGV0UGFyc2VyKCkucGFyc2UoJyR7MXxcXFxcLCx9LCQsXFxcXHwsXFxcXFxcXFx8fScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwbGFjZWhvbGRlcnMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQub2socGxhY2Vob2xkZXJzWzBdLmNob2ljZSBpbnN0YW5jZW9mIENob2ljZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1BhcnNlciwgb25seSB0ZXh0bWF0ZScsICgpID0+IHtcblx0XHRjb25zdCBwID0gbmV3IFNuaXBwZXRQYXJzZXIoKTtcblx0XHRhc3NlcnRNYXJrZXIocC5wYXJzZSgnZmFye3t9fWJvbycpLCBUZXh0KTtcblx0XHRhc3NlcnRNYXJrZXIocC5wYXJzZSgnZmFye3sxMjN9fWJvbycpLCBUZXh0KTtcblx0XHRhc3NlcnRNYXJrZXIocC5wYXJzZSgnZmFyXFxcXHt7MTIzfX1ib28nKSwgVGV4dCk7XG5cblx0XHRhc3NlcnRNYXJrZXIocC5wYXJzZSgnZmFyJDBib28nKSwgVGV4dCwgUGxhY2Vob2xkZXIsIFRleHQpO1xuXHRcdGFzc2VydE1hcmtlcihwLnBhcnNlKCdmYXIkezEyM31ib28nKSwgVGV4dCwgUGxhY2Vob2xkZXIsIFRleHQpO1xuXHRcdGFzc2VydE1hcmtlcihwLnBhcnNlKCdmYXJcXFxcJHsxMjN9Ym9vJyksIFRleHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdQYXJzZXIsIHJlYWwgd29ybGQnLCAoKSA9PiB7XG5cdFx0bGV0IG1hcmtlciA9IG5ldyBTbmlwcGV0UGFyc2VyKCkucGFyc2UoJ2NvbnNvbGUud2FybigkezE6ICRUTV9TRUxFQ1RFRF9URVhUIH0pJykuY2hpbGRyZW47XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFya2VyWzBdLnRvU3RyaW5nKCksICdjb25zb2xlLndhcm4oJyk7XG5cdFx0YXNzZXJ0Lm9rKG1hcmtlclsxXSBpbnN0YW5jZW9mIFBsYWNlaG9sZGVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFya2VyWzJdLnRvU3RyaW5nKCksICcpJyk7XG5cblx0XHRjb25zdCBwbGFjZWhvbGRlciA9IDxQbGFjZWhvbGRlcj5tYXJrZXJbMV07XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBsYWNlaG9sZGVyLmluZGV4LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGxhY2Vob2xkZXIuY2hpbGRyZW4ubGVuZ3RoLCAzKTtcblx0XHRhc3NlcnQub2socGxhY2Vob2xkZXIuY2hpbGRyZW5bMF0gaW5zdGFuY2VvZiBUZXh0KTtcblx0XHRhc3NlcnQub2socGxhY2Vob2xkZXIuY2hpbGRyZW5bMV0gaW5zdGFuY2VvZiBWYXJpYWJsZSk7XG5cdFx0YXNzZXJ0Lm9rKHBsYWNlaG9sZGVyLmNoaWxkcmVuWzJdIGluc3RhbmNlb2YgVGV4dCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBsYWNlaG9sZGVyLmNoaWxkcmVuWzBdLnRvU3RyaW5nKCksICcgJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBsYWNlaG9sZGVyLmNoaWxkcmVuWzFdLnRvU3RyaW5nKCksICcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGxhY2Vob2xkZXIuY2hpbGRyZW5bMl0udG9TdHJpbmcoKSwgJyAnKTtcblxuXHRcdGNvbnN0IG5lc3RlZFZhcmlhYmxlID0gPFZhcmlhYmxlPnBsYWNlaG9sZGVyLmNoaWxkcmVuWzFdO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXN0ZWRWYXJpYWJsZS5uYW1lLCAnVE1fU0VMRUNURURfVEVYVCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXN0ZWRWYXJpYWJsZS5jaGlsZHJlbi5sZW5ndGgsIDApO1xuXG5cdFx0bWFya2VyID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnJFRNX1NFTEVDVEVEX1RFWFQnKS5jaGlsZHJlbjtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFya2VyLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0Lm9rKG1hcmtlclswXSBpbnN0YW5jZW9mIFZhcmlhYmxlKTtcblx0fSk7XG5cblx0dGVzdCgnUGFyc2VyLCB0cmFuc2Zvcm0gZXhhbXBsZScsICgpID0+IHtcblx0XHRjb25zdCB7IGNoaWxkcmVuIH0gPSBuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKCckezE6bmFtZX0gOiAkezI6dHlwZX0kezMvXFxcXHM6PSguKikvJHsxOisgOj19JHsxfS99O1xcbiQwJyk7XG5cblx0XHQvLyR7MTpuYW1lfVxuXHRcdGFzc2VydC5vayhjaGlsZHJlblswXSBpbnN0YW5jZW9mIFBsYWNlaG9sZGVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hpbGRyZW5bMF0uY2hpbGRyZW4ubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hpbGRyZW5bMF0uY2hpbGRyZW5bMF0udG9TdHJpbmcoKSwgJ25hbWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxQbGFjZWhvbGRlcj5jaGlsZHJlblswXSkudHJhbnNmb3JtLCB1bmRlZmluZWQpO1xuXG5cdFx0Ly8gOlxuXHRcdGFzc2VydC5vayhjaGlsZHJlblsxXSBpbnN0YW5jZW9mIFRleHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGlsZHJlblsxXS50b1N0cmluZygpLCAnIDogJyk7XG5cblx0XHQvLyR7Mjp0eXBlfVxuXHRcdGFzc2VydC5vayhjaGlsZHJlblsyXSBpbnN0YW5jZW9mIFBsYWNlaG9sZGVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hpbGRyZW5bMl0uY2hpbGRyZW4ubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hpbGRyZW5bMl0uY2hpbGRyZW5bMF0udG9TdHJpbmcoKSwgJ3R5cGUnKTtcblxuXHRcdC8vJHszL1xcXFxzOj0oLiopLyR7MTorIDo9fSR7MX0vfVxuXHRcdGFzc2VydC5vayhjaGlsZHJlblszXSBpbnN0YW5jZW9mIFBsYWNlaG9sZGVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hpbGRyZW5bM10uY2hpbGRyZW4ubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoKDxQbGFjZWhvbGRlcj5jaGlsZHJlblszXSkudHJhbnNmb3JtLCB1bmRlZmluZWQpO1xuXHRcdGNvbnN0IHRyYW5zZm9ybSA9ICg8UGxhY2Vob2xkZXI+Y2hpbGRyZW5bM10pLnRyYW5zZm9ybSE7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0cmFuc2Zvcm0ucmVnZXhwLCAvXFxzOj0oLiopLyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYW5zZm9ybS5jaGlsZHJlbi5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5vayh0cmFuc2Zvcm0uY2hpbGRyZW5bMF0gaW5zdGFuY2VvZiBGb3JtYXRTdHJpbmcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPEZvcm1hdFN0cmluZz50cmFuc2Zvcm0uY2hpbGRyZW5bMF0pLmluZGV4LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxGb3JtYXRTdHJpbmc+dHJhbnNmb3JtLmNoaWxkcmVuWzBdKS5pZlZhbHVlLCAnIDo9Jyk7XG5cdFx0YXNzZXJ0Lm9rKHRyYW5zZm9ybS5jaGlsZHJlblsxXSBpbnN0YW5jZW9mIEZvcm1hdFN0cmluZyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCg8Rm9ybWF0U3RyaW5nPnRyYW5zZm9ybS5jaGlsZHJlblsxXSkuaW5kZXgsIDEpO1xuXHRcdGFzc2VydC5vayhjaGlsZHJlbls0XSBpbnN0YW5jZW9mIFRleHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGlsZHJlbls0XS50b1N0cmluZygpLCAnO1xcbicpO1xuXG5cdH0pO1xuXG5cdC8vIFRPRE8gQGpyaWVrZW4gbWFraW5nIHRoaXMgc3RyaWN0RXF1bCBjYXVzZXMgY2lyY3VsYXIganNvbiBjb252ZXJzaW9uIGVycm9yc1xuXHR0ZXN0KCdQYXJzZXIsIGRlZmF1bHQgcGxhY2Vob2xkZXIgdmFsdWVzJywgKCkgPT4ge1xuXG5cdFx0YXNzZXJ0TWFya2VyKCdlcnJvckNvbnRleHQ6IGAkezE6ZXJyfWAsIGVycm9yOiAkMScsIFRleHQsIFBsYWNlaG9sZGVyLCBUZXh0LCBQbGFjZWhvbGRlcik7XG5cblx0XHRjb25zdCBbLCBwMSwgLCBwMl0gPSBuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKCdlcnJvckNvbnRleHQ6IGAkezE6ZXJyfWAsIGVycm9yOiQxJykuY2hpbGRyZW47XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxQbGFjZWhvbGRlcj5wMSkuaW5kZXgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPFBsYWNlaG9sZGVyPnAxKS5jaGlsZHJlbi5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPFRleHQ+KDxQbGFjZWhvbGRlcj5wMSkuY2hpbGRyZW5bMF0pLnRvU3RyaW5nKCksICdlcnInKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPFBsYWNlaG9sZGVyPnAyKS5pbmRleCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCg8UGxhY2Vob2xkZXI+cDIpLmNoaWxkcmVuLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCg8VGV4dD4oPFBsYWNlaG9sZGVyPnAyKS5jaGlsZHJlblswXSkudG9TdHJpbmcoKSwgJ2VycicpO1xuXHR9KTtcblxuXHQvLyBUT0RPIEBqcmlla2VuIG1ha2luZyB0aGlzIHN0cmljdEVxdWwgY2F1c2VzIGNpcmN1bGFyIGpzb24gY29udmVyc2lvbiBlcnJvcnNcblx0dGVzdCgnUGFyc2VyLCBkZWZhdWx0IHBsYWNlaG9sZGVyIHZhbHVlcyBhbmQgb25lIHRyYW5zZm9ybScsICgpID0+IHtcblxuXHRcdGFzc2VydE1hcmtlcignZXJyb3JDb250ZXh0OiBgJHsxOmVycn1gLCBlcnJvcjogJHsxL2Vyci9vay99JywgVGV4dCwgUGxhY2Vob2xkZXIsIFRleHQsIFBsYWNlaG9sZGVyKTtcblxuXHRcdGNvbnN0IFssIHAzLCAsIHA0XSA9IG5ldyBTbmlwcGV0UGFyc2VyKCkucGFyc2UoJ2Vycm9yQ29udGV4dDogYCR7MTplcnJ9YCwgZXJyb3I6JHsxL2Vyci9vay99JykuY2hpbGRyZW47XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxQbGFjZWhvbGRlcj5wMykuaW5kZXgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPFBsYWNlaG9sZGVyPnAzKS5jaGlsZHJlbi5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPFRleHQ+KDxQbGFjZWhvbGRlcj5wMykuY2hpbGRyZW5bMF0pLnRvU3RyaW5nKCksICdlcnInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxQbGFjZWhvbGRlcj5wMykudHJhbnNmb3JtLCB1bmRlZmluZWQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCg8UGxhY2Vob2xkZXI+cDQpLmluZGV4LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxQbGFjZWhvbGRlcj5wNCkuY2hpbGRyZW4ubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxUZXh0Pig8UGxhY2Vob2xkZXI+cDQpLmNoaWxkcmVuWzBdKS50b1N0cmluZygpLCAnZXJyJyk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKCg8UGxhY2Vob2xkZXI+cDQpLnRyYW5zZm9ybSwgdW5kZWZpbmVkKTtcblx0fSk7XG5cblx0dGVzdCgnUmVwZWF0ZWQgc25pcHBldCBwbGFjZWhvbGRlciBzaG91bGQgYWx3YXlzIGluaGVyaXQsICMzMTA0MCcsIGZ1bmN0aW9uICgpIHtcblx0XHRhc3NlcnRUZXh0KCckezE6Zm9vfS1hYmMtJDEnLCAnZm9vLWFiYy1mb28nKTtcblx0XHRhc3NlcnRUZXh0KCckezE6Zm9vfS1hYmMtJHsxfScsICdmb28tYWJjLWZvbycpO1xuXHRcdGFzc2VydFRleHQoJyR7MTpmb299LWFiYy0kezE6YmFyfScsICdmb28tYWJjLWZvbycpO1xuXHRcdGFzc2VydFRleHQoJyR7MX0tYWJjLSR7MTpmb299JywgJ2Zvby1hYmMtZm9vJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JhY2tzcGFjZSBlc2FwY2UgaW4gVE0gb25seSwgIzE2MjEyJywgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbCA9IFNuaXBwZXRQYXJzZXIuYXNJbnNlcnRUZXh0KCdGb28gXFxcXFxcXFwke2FiY31iYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCAnRm9vIFxcXFxiYXInKTtcblx0fSk7XG5cblx0dGVzdCgnY29sb24gYXMgdmFyaWFibGUvcGxhY2Vob2xkZXIgdmFsdWUsICMxNjcxNycsICgpID0+IHtcblx0XHRsZXQgYWN0dWFsID0gU25pcHBldFBhcnNlci5hc0luc2VydFRleHQoJyR7VE1fU0VMRUNURURfVEVYVDpmb286YmFyfScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsICdmb286YmFyJyk7XG5cblx0XHRhY3R1YWwgPSBTbmlwcGV0UGFyc2VyLmFzSW5zZXJ0VGV4dCgnJHsxOmZvbzpiYXJ9Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgJ2ZvbzpiYXInKTtcblx0fSk7XG5cblx0dGVzdCgnaW5jb21wbGV0ZSBwbGFjZWhvbGRlcicsICgpID0+IHtcblx0XHRhc3NlcnRUZXh0QW5kTWFya2VyKCckezE6fScsICcnLCBQbGFjZWhvbGRlcik7XG5cdH0pO1xuXG5cdHRlc3QoJ21hcmtlciNsZW4nLCAoKSA9PiB7XG5cblx0XHRmdW5jdGlvbiBhc3NlcnRMZW4odGVtcGxhdGU6IHN0cmluZywgLi4ubGVuZ3RoczogbnVtYmVyW10pOiB2b2lkIHtcblx0XHRcdGNvbnN0IHNuaXBwZXQgPSBuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKHRlbXBsYXRlLCB0cnVlKTtcblx0XHRcdHNuaXBwZXQud2FsayhtID0+IHtcblx0XHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBsZW5ndGhzLnNoaWZ0KCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtLmxlbigpLCBleHBlY3RlZCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVuZ3Rocy5sZW5ndGgsIDApO1xuXHRcdH1cblxuXHRcdGFzc2VydExlbigndGV4dCQwJywgNCwgMCk7XG5cdFx0YXNzZXJ0TGVuKCckMXRleHQkMCcsIDAsIDQsIDApO1xuXHRcdGFzc2VydExlbigndGUkMXh0JDAnLCAyLCAwLCAyLCAwKTtcblx0XHRhc3NlcnRMZW4oJ2Vycm9yQ29udGV4dDogYCR7MTplcnJ9YCwgZXJyb3I6ICQwJywgMTUsIDAsIDMsIDEwLCAwKTtcblx0XHRhc3NlcnRMZW4oJ2Vycm9yQ29udGV4dDogYCR7MTplcnJ9YCwgZXJyb3I6ICQxJDAnLCAxNSwgMCwgMywgMTAsIDAsIDMsIDApO1xuXHRcdGFzc2VydExlbignJFRNX1NFTEVDVEVEX1RFWFQkMCcsIDAsIDApO1xuXHRcdGFzc2VydExlbignJHtUTV9TRUxFQ1RFRF9URVhUOmRlZn0kMCcsIDAsIDMsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdwYXJzZXIsIHBhcmVudCBub2RlJywgZnVuY3Rpb24gKCkge1xuXHRcdGxldCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnVGhpcyAkezE6aXMgJHsyOm5lc3RlZH19JDAnLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0LnBsYWNlaG9sZGVycy5sZW5ndGgsIDMpO1xuXHRcdGxldCBbZmlyc3QsIHNlY29uZF0gPSBzbmlwcGV0LnBsYWNlaG9sZGVycztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QuaW5kZXgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQuaW5kZXgsIDIpO1xuXHRcdGFzc2VydC5vayhzZWNvbmQucGFyZW50ID09PSBmaXJzdCk7XG5cdFx0YXNzZXJ0Lm9rKGZpcnN0LnBhcmVudCA9PT0gc25pcHBldCk7XG5cblx0XHRzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnJHtWQVI6ZGVmYXVsdCR7MTp2YWx1ZX19JDAnLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldC5wbGFjZWhvbGRlcnMubGVuZ3RoLCAyKTtcblx0XHRbZmlyc3RdID0gc25pcHBldC5wbGFjZWhvbGRlcnM7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LmluZGV4LCAxKTtcblxuXHRcdGFzc2VydC5vayhzbmlwcGV0LmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgVmFyaWFibGUpO1xuXHRcdGFzc2VydC5vayhmaXJzdC5wYXJlbnQgPT09IHNuaXBwZXQuY2hpbGRyZW5bMF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXh0bWF0ZVNuaXBwZXQjZW5jbG9zaW5nUGxhY2Vob2xkZXJzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHNuaXBwZXQgPSBuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKCdUaGlzICR7MTppcyAkezI6bmVzdGVkfX0kMCcsIHRydWUpO1xuXHRcdGNvbnN0IFtmaXJzdCwgc2Vjb25kXSA9IHNuaXBwZXQucGxhY2Vob2xkZXJzO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzbmlwcGV0LmVuY2xvc2luZ1BsYWNlaG9sZGVycyhmaXJzdCksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNuaXBwZXQuZW5jbG9zaW5nUGxhY2Vob2xkZXJzKHNlY29uZCksIFtmaXJzdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXh0bWF0ZVNuaXBwZXQjb2Zmc2V0JywgKCkgPT4ge1xuXHRcdGxldCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgndGUkMXh0JywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNuaXBwZXQub2Zmc2V0KHNuaXBwZXQuY2hpbGRyZW5bMF0pLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldC5vZmZzZXQoc25pcHBldC5jaGlsZHJlblsxXSksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0Lm9mZnNldChzbmlwcGV0LmNoaWxkcmVuWzJdKSwgMik7XG5cblx0XHRzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnJHtUTV9TRUxFQ1RFRF9URVhUOmRlZn0nLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldC5vZmZzZXQoc25pcHBldC5jaGlsZHJlblswXSksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0Lm9mZnNldCgoPFZhcmlhYmxlPnNuaXBwZXQuY2hpbGRyZW5bMF0pLmNoaWxkcmVuWzBdKSwgMCk7XG5cblx0XHQvLyBmb3JnZWluIG1hcmtlclxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0Lm9mZnNldChuZXcgVGV4dCgnZm9vJykpLCAtMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RleHRtYXRlU25pcHBldCNwbGFjZWhvbGRlcicsICgpID0+IHtcblx0XHRsZXQgc25pcHBldCA9IG5ldyBTbmlwcGV0UGFyc2VyKCkucGFyc2UoJ3RlJDF4dCQwJywgdHJ1ZSk7XG5cdFx0bGV0IHBsYWNlaG9sZGVycyA9IHNuaXBwZXQucGxhY2Vob2xkZXJzO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwbGFjZWhvbGRlcnMubGVuZ3RoLCAyKTtcblxuXHRcdHNuaXBwZXQgPSBuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKCd0ZSQxeHQkMSQwJywgdHJ1ZSk7XG5cdFx0cGxhY2Vob2xkZXJzID0gc25pcHBldC5wbGFjZWhvbGRlcnM7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBsYWNlaG9sZGVycy5sZW5ndGgsIDMpO1xuXG5cblx0XHRzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgndGUkMXh0JDIkMCcsIHRydWUpO1xuXHRcdHBsYWNlaG9sZGVycyA9IHNuaXBwZXQucGxhY2Vob2xkZXJzO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwbGFjZWhvbGRlcnMubGVuZ3RoLCAzKTtcblxuXHRcdHNuaXBwZXQgPSBuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKCckezE6YmFyJHsyOmZvb31iYXJ9JDAnLCB0cnVlKTtcblx0XHRwbGFjZWhvbGRlcnMgPSBzbmlwcGV0LnBsYWNlaG9sZGVycztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGxhY2Vob2xkZXJzLmxlbmd0aCwgMyk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RleHRtYXRlU25pcHBldCNyZXBsYWNlIDEvMicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnYWFhJHsxOmJiYiR7MjpjY2N9fSQwJywgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldC5wbGFjZWhvbGRlcnMubGVuZ3RoLCAzKTtcblx0XHRjb25zdCBbLCBzZWNvbmRdID0gc25pcHBldC5wbGFjZWhvbGRlcnM7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlY29uZC5pbmRleCwgMik7XG5cblx0XHRjb25zdCBlbmNsb3NpbmcgPSBzbmlwcGV0LmVuY2xvc2luZ1BsYWNlaG9sZGVycyhzZWNvbmQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbmNsb3NpbmcubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW5jbG9zaW5nWzBdLmluZGV4LCAxKTtcblxuXHRcdGNvbnN0IG5lc3RlZCA9IG5ldyBTbmlwcGV0UGFyc2VyKCkucGFyc2UoJ2RkZCQxZWVlJDAnLCB0cnVlKTtcblx0XHRzbmlwcGV0LnJlcGxhY2Uoc2Vjb25kLCBuZXN0ZWQuY2hpbGRyZW4pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNuaXBwZXQudG9TdHJpbmcoKSwgJ2FhYWJiYmRkZGVlZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0LnBsYWNlaG9sZGVycy5sZW5ndGgsIDQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0LnBsYWNlaG9sZGVyc1swXS5pbmRleCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNuaXBwZXQucGxhY2Vob2xkZXJzWzFdLmluZGV4LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldC5wbGFjZWhvbGRlcnNbMl0uaW5kZXgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0LnBsYWNlaG9sZGVyc1szXS5pbmRleCwgMCk7XG5cblx0XHRjb25zdCBuZXdFbmNsb3NpbmcgPSBzbmlwcGV0LmVuY2xvc2luZ1BsYWNlaG9sZGVycyhzbmlwcGV0LnBsYWNlaG9sZGVyc1sxXSk7XG5cdFx0YXNzZXJ0Lm9rKG5ld0VuY2xvc2luZ1swXSA9PT0gc25pcHBldC5wbGFjZWhvbGRlcnNbMF0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXdFbmNsb3NpbmcubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3RW5jbG9zaW5nWzBdLmluZGV4LCAxKTtcblx0fSk7XG5cblx0dGVzdCgnVGV4dG1hdGVTbmlwcGV0I3JlcGxhY2UgMi8yJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHNuaXBwZXQgPSBuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKCdhYWEkezE6YmJiJHsyOmNjY319JDAnLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0LnBsYWNlaG9sZGVycy5sZW5ndGgsIDMpO1xuXHRcdGNvbnN0IFssIHNlY29uZF0gPSBzbmlwcGV0LnBsYWNlaG9sZGVycztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vjb25kLmluZGV4LCAyKTtcblxuXHRcdGNvbnN0IG5lc3RlZCA9IG5ldyBTbmlwcGV0UGFyc2VyKCkucGFyc2UoJ2RkZGVlZSQwJywgdHJ1ZSk7XG5cdFx0c25pcHBldC5yZXBsYWNlKHNlY29uZCwgbmVzdGVkLmNoaWxkcmVuKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0LnRvU3RyaW5nKCksICdhYWFiYmJkZGRlZWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldC5wbGFjZWhvbGRlcnMubGVuZ3RoLCAzKTtcblx0fSk7XG5cblx0dGVzdCgnU25pcHBldCBvcmRlciBmb3IgcGxhY2Vob2xkZXJzLCAjMjgxODUnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBfMTAgPSBuZXcgUGxhY2Vob2xkZXIoMTApO1xuXHRcdGNvbnN0IF8yID0gbmV3IFBsYWNlaG9sZGVyKDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFBsYWNlaG9sZGVyLmNvbXBhcmVCeUluZGV4KF8xMCwgXzIpLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnTWF4aW11bSBjYWxsIHN0YWNrIHNpemUgZXhjZWVkZWQsICMyODk4MycsIGZ1bmN0aW9uICgpIHtcblx0XHRuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKCckezE6JHtmb286JHsxfX19Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NuaXBwZXQgY2FuIGZyZWV6ZSB0aGUgZWRpdG9yLCAjMzA0MDcnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBzZWVuID0gbmV3IFNldDxNYXJrZXI+KCk7XG5cblx0XHRzZWVuLmNsZWFyKCk7XG5cdFx0bmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnY2xhc3MgJHsxOiR7VE1fRklMRU5BTUUvKD86XFxcXEF8XykoW0EtWmEtejAtOV0rKSg/OlxcXFwucmIpPy8oPzI6OlxcXFx1JDEpL2d9fSA8ICR7MjpBcHBsaWNhdGlvbn1Db250cm9sbGVyXFxuICAkM1xcbmVuZCcpLndhbGsobWFya2VyID0+IHtcblx0XHRcdGFzc2VydC5vayghc2Vlbi5oYXMobWFya2VyKSk7XG5cdFx0XHRzZWVuLmFkZChtYXJrZXIpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSk7XG5cblx0XHRzZWVuLmNsZWFyKCk7XG5cdFx0bmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnJHsxOiR7Rk9POmFiYyQxZGVmfX0nKS53YWxrKG1hcmtlciA9PiB7XG5cdFx0XHRhc3NlcnQub2soIXNlZW4uaGFzKG1hcmtlcikpO1xuXHRcdFx0c2Vlbi5hZGQobWFya2VyKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdTbmlwcGV0czogbWFrZSBwYXJzZXIgaWdub3JlIGAkezB8Y2hvaWNlfH1gLCAjMzE1OTknLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignJHswfGZvbyxiYXJ8fScsICckezB8Zm9vLGJhcnx9JywgVGV4dCk7XG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignJHsxfGZvbyxiYXJ8fScsICdmb28nLCBQbGFjZWhvbGRlcik7XG5cdH0pO1xuXG5cblx0dGVzdCgnVHJhbnNmb3JtIC0+IEZvcm1hdFN0cmluZyNyZXNvbHZlJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Ly8gc2hvcnRoYW5kIGZ1bmN0aW9uc1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXcgRm9ybWF0U3RyaW5nKDEsICd1cGNhc2UnKS5yZXNvbHZlKCdmb28nKSwgJ0ZPTycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXcgRm9ybWF0U3RyaW5nKDEsICdkb3duY2FzZScpLnJlc29sdmUoJ0ZPTycpLCAnZm9vJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ldyBGb3JtYXRTdHJpbmcoMSwgJ2NhcGl0YWxpemUnKS5yZXNvbHZlKCdiYXInKSwgJ0JhcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXcgRm9ybWF0U3RyaW5nKDEsICdjYXBpdGFsaXplJykucmVzb2x2ZSgnYmFyIG5vIHJlcGVhdCcpLCAnQmFyIG5vIHJlcGVhdCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXcgRm9ybWF0U3RyaW5nKDEsICdwYXNjYWxjYXNlJykucmVzb2x2ZSgnYmFyLWZvbycpLCAnQmFyRm9vJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ldyBGb3JtYXRTdHJpbmcoMSwgJ3Bhc2NhbGNhc2UnKS5yZXNvbHZlKCdiYXItNDItZm9vJyksICdCYXI0MkZvbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXcgRm9ybWF0U3RyaW5nKDEsICdwYXNjYWxjYXNlJykucmVzb2x2ZSgnc25ha2VfQW5kUGFzY2FsQ2FzZScpLCAnU25ha2VBbmRQYXNjYWxDYXNlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ldyBGb3JtYXRTdHJpbmcoMSwgJ3Bhc2NhbGNhc2UnKS5yZXNvbHZlKCdrZWJhYi1BbmRQYXNjYWxDYXNlJyksICdLZWJhYkFuZFBhc2NhbENhc2UnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3IEZvcm1hdFN0cmluZygxLCAncGFzY2FsY2FzZScpLnJlc29sdmUoJ19qdXN0UGFzY2FsQ2FzZScpLCAnSnVzdFBhc2NhbENhc2UnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3IEZvcm1hdFN0cmluZygxLCAnY2FtZWxjYXNlJykucmVzb2x2ZSgnYmFyLWZvbycpLCAnYmFyRm9vJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ldyBGb3JtYXRTdHJpbmcoMSwgJ2NhbWVsY2FzZScpLnJlc29sdmUoJ2Jhci00Mi1mb28nKSwgJ2JhcjQyRm9vJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ldyBGb3JtYXRTdHJpbmcoMSwgJ2NhbWVsY2FzZScpLnJlc29sdmUoJ3NuYWtlX0FuZENhbWVsQ2FzZScpLCAnc25ha2VBbmRDYW1lbENhc2UnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3IEZvcm1hdFN0cmluZygxLCAnY2FtZWxjYXNlJykucmVzb2x2ZSgna2ViYWItQW5kQ2FtZWxDYXNlJyksICdrZWJhYkFuZENhbWVsQ2FzZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXcgRm9ybWF0U3RyaW5nKDEsICdjYW1lbGNhc2UnKS5yZXNvbHZlKCdfSnVzdENhbWVsQ2FzZScpLCAnanVzdENhbWVsQ2FzZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXcgRm9ybWF0U3RyaW5nKDEsICdub3RLbm93bicpLnJlc29sdmUoJ2lucHV0JyksICdpbnB1dCcpO1xuXG5cdFx0Ly8gaWZcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3IEZvcm1hdFN0cmluZygxLCB1bmRlZmluZWQsICdmb28nLCB1bmRlZmluZWQpLnJlc29sdmUodW5kZWZpbmVkKSwgJycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXcgRm9ybWF0U3RyaW5nKDEsIHVuZGVmaW5lZCwgJ2ZvbycsIHVuZGVmaW5lZCkucmVzb2x2ZSgnJyksICcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3IEZvcm1hdFN0cmluZygxLCB1bmRlZmluZWQsICdmb28nLCB1bmRlZmluZWQpLnJlc29sdmUoJ2JhcicpLCAnZm9vJyk7XG5cblx0XHQvLyBlbHNlXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ldyBGb3JtYXRTdHJpbmcoMSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsICdmb28nKS5yZXNvbHZlKHVuZGVmaW5lZCksICdmb28nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3IEZvcm1hdFN0cmluZygxLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgJ2ZvbycpLnJlc29sdmUoJycpLCAnZm9vJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ldyBGb3JtYXRTdHJpbmcoMSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsICdmb28nKS5yZXNvbHZlKCdiYXInKSwgJ2JhcicpO1xuXG5cdFx0Ly8gaWYtZWxzZVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXcgRm9ybWF0U3RyaW5nKDEsIHVuZGVmaW5lZCwgJ2JhcicsICdmb28nKS5yZXNvbHZlKHVuZGVmaW5lZCksICdmb28nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3IEZvcm1hdFN0cmluZygxLCB1bmRlZmluZWQsICdiYXInLCAnZm9vJykucmVzb2x2ZSgnJyksICdmb28nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3IEZvcm1hdFN0cmluZygxLCB1bmRlZmluZWQsICdiYXInLCAnZm9vJykucmVzb2x2ZSgnYmF6JyksICdiYXInKTtcblx0fSk7XG5cblx0dGVzdCgnU25pcHBldCB2YXJpYWJsZSB0cmFuc2Zvcm1hdGlvbiBkb2VzblxcJ3Qgd29yayBpZiByZWdleCBpcyBjb21wbGljYXRlZCBhbmQgc25pcHBldCBib2R5IGNvbnRhaW5zIFxcJyQkXFwnICM1NTYyNycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnY29uc3QgZmlsZU5hbWUgPSBcIiR7VE1fRklMRU5BTUUvKC4qKVxcXFwuLiskLyQxL31cIicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0LnRvVGV4dG1hdGVTdHJpbmcoKSwgJ2NvbnN0IGZpbGVOYW1lID0gXCIke1RNX0ZJTEVOQU1FLyguKilcXFxcLi4rJC8kezF9L31cIicpO1xuXHR9KTtcblxuXHR0ZXN0KCdbQlVHXSBIVE1MIGF0dHJpYnV0ZSBzdWdnZXN0aW9uczogU25pcHBldCBzZXNzaW9uIGRvZXMgbm90IGhhdmUgZW5kLXBvc2l0aW9uIHNldCwgIzMzMTQ3JywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgeyBwbGFjZWhvbGRlcnMgfSA9IG5ldyBTbmlwcGV0UGFyc2VyKCkucGFyc2UoJ3NyYz1cIiQxXCInLCB0cnVlKTtcblx0XHRjb25zdCBbZmlyc3QsIHNlY29uZF0gPSBwbGFjZWhvbGRlcnM7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGxhY2Vob2xkZXJzLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LmluZGV4LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vjb25kLmluZGV4LCAwKTtcblxuXHR9KTtcblxuXHR0ZXN0KCdTbmlwcGV0IG9wdGlvbmFsIHRyYW5zZm9ybXMgYXJlIG5vdCBhcHBsaWVkIGNvcnJlY3RseSB3aGVuIHJldXNpbmcgdGhlIHNhbWUgdmFyaWFibGUsICMzNzcwMicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHRyYW5zZm9ybSA9IG5ldyBUcmFuc2Zvcm0oKTtcblx0XHR0cmFuc2Zvcm0uYXBwZW5kQ2hpbGQobmV3IEZvcm1hdFN0cmluZygxLCAndXBjYXNlJykpO1xuXHRcdHRyYW5zZm9ybS5hcHBlbmRDaGlsZChuZXcgRm9ybWF0U3RyaW5nKDIsICd1cGNhc2UnKSk7XG5cdFx0dHJhbnNmb3JtLnJlZ2V4cCA9IC9eKC4pfC0oLikvZztcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFuc2Zvcm0ucmVzb2x2ZSgnbXktZmlsZS1uYW1lJyksICdNeUZpbGVOYW1lJyk7XG5cblx0XHRjb25zdCBjbG9uZSA9IHRyYW5zZm9ybS5jbG9uZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjbG9uZS5yZXNvbHZlKCdteS1maWxlLW5hbWUnKSwgJ015RmlsZU5hbWUnKTtcblx0fSk7XG5cblx0dGVzdCgncHJvYmxlbSB3aXRoIHNuaXBwZXRzIHJlZ2V4ICM0MDU3MCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHNuaXBwZXQgPSBuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKCcke1RNX0RJUkVDVE9SWS8uKnNyY1tcXFxcL10oLiopLyQxL30nKTtcblx0XHRhc3NlcnRNYXJrZXIoc25pcHBldCwgVmFyaWFibGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdWYXJpYWJsZSB0cmFuc2Zvcm1hdGlvbiBkb2VzblxcJ3Qgd29yayBpZiB1bmRlZmluZWQgdmFyaWFibGVzIGFyZSB1c2VkIGluIHRoZSBzYW1lIHNuaXBwZXQgIzUxNzY5JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRyYW5zZm9ybSA9IG5ldyBUcmFuc2Zvcm0oKTtcblx0XHR0cmFuc2Zvcm0uYXBwZW5kQ2hpbGQobmV3IFRleHQoJ2JhcicpKTtcblx0XHR0cmFuc2Zvcm0ucmVnZXhwID0gbmV3IFJlZ0V4cCgnZm9vJywgJ2dpJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYW5zZm9ybS50b1RleHRtYXRlU3RyaW5nKCksICcvZm9vL2Jhci9pZycpO1xuXHR9KTtcblxuXHR0ZXN0KCdTbmlwcGV0IHBhcnNlciBmcmVlemUgIzUzMTQ0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHNuaXBwZXQgPSBuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKCckezEvKHZvaWQkKXwoLispLyR7MTo/LVxcdHJldHVybiBuaWw7fS99Jyk7XG5cdFx0YXNzZXJ0TWFya2VyKHNuaXBwZXQsIFBsYWNlaG9sZGVyKTtcblx0fSk7XG5cblx0dGVzdCgnc25pcHBldHMgdmFyaWFibGUgbm90IHJlc29sdmVkIGluIEpTT04gcHJvcG9zYWwgIzUyOTMxJywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydFRleHRBbmRNYXJrZXIoJ0ZPTyR7MTovYmluL2Jhc2h9JywgJ0ZPTy9iaW4vYmFzaCcsIFRleHQsIFBsYWNlaG9sZGVyKTtcblx0fSk7XG5cblx0dGVzdCgnTWlycm9yaW5nIHNlcXVlbmNlIG9mIG5lc3RlZCBwbGFjZWhvbGRlcnMgbm90IHNlbGVjdGVkIHByb3Blcmx5IG9uIGJhY2tqdW1waW5nICM1ODczNicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnJHszOm5lc3QxICR7MTpuZXN0MiAkezI6bmVzdDN9fX0gJDMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc25pcHBldC5jaGlsZHJlbi5sZW5ndGgsIDMpO1xuXHRcdGFzc2VydC5vayhzbmlwcGV0LmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgUGxhY2Vob2xkZXIpO1xuXHRcdGFzc2VydC5vayhzbmlwcGV0LmNoaWxkcmVuWzFdIGluc3RhbmNlb2YgVGV4dCk7XG5cdFx0YXNzZXJ0Lm9rKHNuaXBwZXQuY2hpbGRyZW5bMl0gaW5zdGFuY2VvZiBQbGFjZWhvbGRlcik7XG5cblx0XHRmdW5jdGlvbiBhc3NlcnRQYXJlbnQobWFya2VyOiBNYXJrZXIpIHtcblx0XHRcdG1hcmtlci5jaGlsZHJlbi5mb3JFYWNoKGFzc2VydFBhcmVudCk7XG5cdFx0XHRpZiAoIShtYXJrZXIgaW5zdGFuY2VvZiBQbGFjZWhvbGRlcikpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bGV0IGZvdW5kID0gZmFsc2U7XG5cdFx0XHRsZXQgbTogTWFya2VyID0gbWFya2VyO1xuXHRcdFx0d2hpbGUgKG0gJiYgIWZvdW5kKSB7XG5cdFx0XHRcdGlmIChtLnBhcmVudCA9PT0gc25pcHBldCkge1xuXHRcdFx0XHRcdGZvdW5kID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRtID0gbS5wYXJlbnQ7XG5cdFx0XHR9XG5cdFx0XHRhc3NlcnQub2soZm91bmQpO1xuXHRcdH1cblx0XHRjb25zdCBbLCAsIGNsb25lXSA9IHNuaXBwZXQuY2hpbGRyZW47XG5cdFx0YXNzZXJ0UGFyZW50KGNsb25lKTtcblx0fSk7XG5cblx0dGVzdCgnQmFja3NwYWNlIGNhblxcJ3QgYmUgZXNjYXBlZCBpbiBzbmlwcGV0IHZhcmlhYmxlIHRyYW5zZm9ybXMgIzY1NDEyJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3Qgc25pcHBldCA9IG5ldyBTbmlwcGV0UGFyc2VyKCkucGFyc2UoJ25hbWVzcGFjZSAke1RNX0RJUkVDVE9SWS9bXFxcXC9dL1xcXFxcXFxcL2d9OycpO1xuXHRcdGFzc2VydE1hcmtlcihzbmlwcGV0LCBUZXh0LCBWYXJpYWJsZSwgVGV4dCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NuaXBwZXQgY2Fubm90IGVzY2FwZSBjbG9zaW5nIGJyYWNrZXQgaW5zaWRlIGNvbmRpdGlvbmFsIGluc2VydGlvbiB2YXJpYWJsZSByZXBsYWNlbWVudCAjNzg4ODMnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnJHtUTV9ESVJFQ1RPUlkvKC4rKS8kezE6K2ltcG9ydCB7IGhlbGxvIFxcXFx9IGZyb20gd29ybGR9L30nKTtcblx0XHRjb25zdCB2YXJpYWJsZSA9IDxWYXJpYWJsZT5zbmlwcGV0LmNoaWxkcmVuWzBdO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0LmNoaWxkcmVuLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0Lm9rKHZhcmlhYmxlIGluc3RhbmNlb2YgVmFyaWFibGUpO1xuXHRcdGFzc2VydC5vayh2YXJpYWJsZS50cmFuc2Zvcm0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YXJpYWJsZS50cmFuc2Zvcm0uY2hpbGRyZW4ubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQub2sodmFyaWFibGUudHJhbnNmb3JtLmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgRm9ybWF0U3RyaW5nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxGb3JtYXRTdHJpbmc+dmFyaWFibGUudHJhbnNmb3JtLmNoaWxkcmVuWzBdKS5pZlZhbHVlLCAnaW1wb3J0IHsgaGVsbG8gfSBmcm9tIHdvcmxkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCg8Rm9ybWF0U3RyaW5nPnZhcmlhYmxlLnRyYW5zZm9ybS5jaGlsZHJlblswXSkuZWxzZVZhbHVlLCB1bmRlZmluZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdTbmlwcGV0IGVzY2FwZSBiYWNrc2xhc2hlcyBpbnNpZGUgY29uZGl0aW9uYWwgaW5zZXJ0aW9uIHZhcmlhYmxlIHJlcGxhY2VtZW50ICM4MDM5NCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHNuaXBwZXQgPSBuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKCcke0NVUlJFTlRfWUVBUi8oLispLyR7MTorXFxcXFxcXFx9L30nKTtcblx0XHRjb25zdCB2YXJpYWJsZSA9IDxWYXJpYWJsZT5zbmlwcGV0LmNoaWxkcmVuWzBdO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmlwcGV0LmNoaWxkcmVuLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0Lm9rKHZhcmlhYmxlIGluc3RhbmNlb2YgVmFyaWFibGUpO1xuXHRcdGFzc2VydC5vayh2YXJpYWJsZS50cmFuc2Zvcm0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YXJpYWJsZS50cmFuc2Zvcm0uY2hpbGRyZW4ubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQub2sodmFyaWFibGUudHJhbnNmb3JtLmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgRm9ybWF0U3RyaW5nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxGb3JtYXRTdHJpbmc+dmFyaWFibGUudHJhbnNmb3JtLmNoaWxkcmVuWzBdKS5pZlZhbHVlLCAnXFxcXCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPEZvcm1hdFN0cmluZz52YXJpYWJsZS50cmFuc2Zvcm0uY2hpbGRyZW5bMF0pLmVsc2VWYWx1ZSwgdW5kZWZpbmVkKTtcblx0fSk7XG5cblx0dGVzdCgnU25pcHBldCBwbGFjZWhvbGRlciBlbXB0eSByaWdodCBhZnRlciBleHBhbnNpb24gIzE1MjU1MycsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHNuaXBwZXQgPSBuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKCckezE6cHJvZ306ICR7MjokMS5jY30gLSAkMicpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHNuaXBwZXQudG9TdHJpbmcoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCAncHJvZzogcHJvZy5jYyAtIHByb2cuY2MnKTtcblxuXHRcdGNvbnN0IHNuaXBwZXQyID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZSgnJHsxOnByb2d9OiAkezM6JHsyOiQxLmNjfS4zM30gLSAkMiAkMycpO1xuXHRcdGNvbnN0IGFjdHVhbDIgPSBzbmlwcGV0Mi50b1N0cmluZygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLCAncHJvZzogcHJvZy5jYy4zMyAtIHByb2cuY2MgcHJvZy5jYy4zMycpO1xuXG5cdFx0Ly8gY3ljbGljIHJlZmVyZW5jZXMgb2YgcGxhY2Vob2xkZXJzXG5cdFx0Y29uc3Qgc25pcHBldDMgPSBuZXcgU25pcHBldFBhcnNlcigpLnBhcnNlKCckezE6JDIub25lfSA8PiAkezI6JDEudHdvfScpO1xuXHRcdGNvbnN0IGFjdHVhbDMgPSBzbmlwcGV0My50b1N0cmluZygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwzLCAnLnR3by5vbmUudHdvLm9uZSA8PiAub25lLnR3by5vbmUudHdvJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NuaXBwZXQgY2hvaWNlcyBhcmUgaW5jb3JyZWN0bHkgZXNjYXBlZC9hcHBsaWVkICMxODAxMzInLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0VGV4dEFuZE1hcmtlcignJHsxfGFhYSRhYWF8fWJiYlxcXFwkYmJiJywgJ2FhYSRhYWFiYmIkYmJiJywgUGxhY2Vob2xkZXIsIFRleHQpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBSUEsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsUUFBUSxjQUFzQixhQUFhLFNBQVMsZUFBZSxNQUFNLGlCQUFpQixXQUFXLFdBQVcsZ0JBQWdCO0FBRXpJLE1BQU0saUJBQWlCLE1BQU07QUFFNUIsMENBQXdDO0FBRXhDLE9BQUssV0FBVyxNQUFNO0FBRXJCLFVBQU0sVUFBVSxJQUFJLFFBQVE7QUFDNUIsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE1BQU0sVUFBVSxHQUFHO0FBRXJELFlBQVEsS0FBSyxLQUFLO0FBQ2xCLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxNQUFNLFVBQVUsWUFBWTtBQUM5RCxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsTUFBTSxVQUFVLEdBQUc7QUFFckQsWUFBUSxLQUFLLFNBQVM7QUFDdEIsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE1BQU0sVUFBVSxTQUFTO0FBQzNELFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxNQUFNLFVBQVUsU0FBUztBQUMzRCxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsTUFBTSxVQUFVLFlBQVk7QUFDOUQsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE1BQU0sVUFBVSxVQUFVO0FBQzVELFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxNQUFNLFVBQVUsVUFBVTtBQUM1RCxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsTUFBTSxVQUFVLEdBQUc7QUFFckQsWUFBUSxLQUFLLFFBQVE7QUFDckIsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE1BQU0sVUFBVSxZQUFZO0FBQzlELFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxNQUFNLFVBQVUsTUFBTTtBQUN4RCxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsTUFBTSxVQUFVLEdBQUc7QUFFckQsWUFBUSxLQUFLLFNBQVM7QUFDdEIsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE1BQU0sVUFBVSxZQUFZO0FBQzlELFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxNQUFNLFVBQVUsTUFBTTtBQUN4RCxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsTUFBTSxVQUFVLEdBQUc7QUFDckQsV0FBTyxZQUFZLFFBQVEsS0FBSyxFQUFFLE1BQU0sVUFBVSxHQUFHO0FBRXJELFlBQVEsS0FBSyxNQUFNO0FBQ25CLFdBQU8sWUFBWSxRQUFRLEtBQUssRUFBRSxNQUFNLFVBQVUsTUFBTTtBQUN4RCxXQUFPLFlBQVksUUFBUSxLQUFLLEVBQUUsTUFBTSxVQUFVLFlBQVk7QUFD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
