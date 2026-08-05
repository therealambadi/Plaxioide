import assert from "assert";
import { IndentAction } from "../../../../common/languages/languageConfiguration.js";
import { OnEnterSupport } from "../../../../common/languages/supports/onEnter.js";
import { javascriptOnEnterRules } from "./onEnterRules.js";
import { EditorAutoIndentStrategy } from "../../../../common/config/editorOptions.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("OnEnter", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("uses brackets", () => {
    const brackets = [
      ["(", ")"],
      ["begin", "end"]
    ];
    const support = new OnEnterSupport({
      brackets
    });
    const testIndentAction = (beforeText, afterText, expected) => {
      const actual = support.onEnter(EditorAutoIndentStrategy.Advanced, "", beforeText, afterText);
      if (expected === IndentAction.None) {
        assert.strictEqual(actual, null);
      } else {
        assert.strictEqual(actual.indentAction, expected);
      }
    };
    testIndentAction("a", "", IndentAction.None);
    testIndentAction("", "b", IndentAction.None);
    testIndentAction("(", "b", IndentAction.Indent);
    testIndentAction("a", ")", IndentAction.None);
    testIndentAction("begin", "ending", IndentAction.Indent);
    testIndentAction("abegin", "end", IndentAction.None);
    testIndentAction("begin", ")", IndentAction.Indent);
    testIndentAction("begin", "end", IndentAction.IndentOutdent);
    testIndentAction("begin ", " end", IndentAction.IndentOutdent);
    testIndentAction(" begin", "end//as", IndentAction.IndentOutdent);
    testIndentAction("(", ")", IndentAction.IndentOutdent);
    testIndentAction("( ", ")", IndentAction.IndentOutdent);
    testIndentAction("a(", ")b", IndentAction.IndentOutdent);
    testIndentAction("(", "", IndentAction.Indent);
    testIndentAction("(", "foo", IndentAction.Indent);
    testIndentAction("begin", "foo", IndentAction.Indent);
    testIndentAction("begin", "", IndentAction.Indent);
  });
  test("Issue #121125: onEnterRules with global modifier", () => {
    const support = new OnEnterSupport({
      onEnterRules: [
        {
          action: {
            appendText: "/// ",
            indentAction: IndentAction.Outdent
          },
          beforeText: /^\s*\/{3}.*$/gm
        }
      ]
    });
    const testIndentAction = (previousLineText, beforeText, afterText, expectedIndentAction, expectedAppendText, removeText = 0) => {
      const actual = support.onEnter(EditorAutoIndentStrategy.Advanced, previousLineText, beforeText, afterText);
      if (expectedIndentAction === null) {
        assert.strictEqual(actual, null, "isNull:" + beforeText);
      } else {
        assert.strictEqual(actual !== null, true, "isNotNull:" + beforeText);
        assert.strictEqual(actual.indentAction, expectedIndentAction, "indentAction:" + beforeText);
        if (expectedAppendText !== null) {
          assert.strictEqual(actual.appendText, expectedAppendText, "appendText:" + beforeText);
        }
        if (removeText !== 0) {
          assert.strictEqual(actual.removeText, removeText, "removeText:" + beforeText);
        }
      }
    };
    testIndentAction("/// line", "/// line", "", IndentAction.Outdent, "/// ");
    testIndentAction("/// line", "/// line", "", IndentAction.Outdent, "/// ");
  });
  test("uses regExpRules", () => {
    const support = new OnEnterSupport({
      onEnterRules: javascriptOnEnterRules
    });
    const testIndentAction = (previousLineText, beforeText, afterText, expectedIndentAction, expectedAppendText, removeText = 0) => {
      const actual = support.onEnter(EditorAutoIndentStrategy.Advanced, previousLineText, beforeText, afterText);
      if (expectedIndentAction === null) {
        assert.strictEqual(actual, null, "isNull:" + beforeText);
      } else {
        assert.strictEqual(actual !== null, true, "isNotNull:" + beforeText);
        assert.strictEqual(actual.indentAction, expectedIndentAction, "indentAction:" + beforeText);
        if (expectedAppendText !== null) {
          assert.strictEqual(actual.appendText, expectedAppendText, "appendText:" + beforeText);
        }
        if (removeText !== 0) {
          assert.strictEqual(actual.removeText, removeText, "removeText:" + beforeText);
        }
      }
    };
    testIndentAction("", "	/**", " */", IndentAction.IndentOutdent, " * ");
    testIndentAction("", "	/**", "", IndentAction.None, " * ");
    testIndentAction("", "	/** * / * / * /", "", IndentAction.None, " * ");
    testIndentAction("", "	/** /*", "", IndentAction.None, " * ");
    testIndentAction("", "/**", "", IndentAction.None, " * ");
    testIndentAction("", "	/**/", "", null, null);
    testIndentAction("", "	/***/", "", null, null);
    testIndentAction("", "	/*******/", "", null, null);
    testIndentAction("", "	/** * * * * */", "", null, null);
    testIndentAction("", "	/** */", "", null, null);
    testIndentAction("", "	/** asdfg */", "", null, null);
    testIndentAction("", "	/* asdfg */", "", null, null);
    testIndentAction("", "	/* asdfg */", "", null, null);
    testIndentAction("", "	/** asdfg */", "", null, null);
    testIndentAction("", "*/", "", null, null);
    testIndentAction("", "	/*", "", null, null);
    testIndentAction("", "	*", "", null, null);
    testIndentAction("	/**", "	 *", "", IndentAction.None, "* ");
    testIndentAction("	 * something", "	 *", "", IndentAction.None, "* ");
    testIndentAction("	 *", "	 *", "", IndentAction.None, "* ");
    testIndentAction("", "	 */", "", IndentAction.None, null, 1);
    testIndentAction("", "	 * */", "", IndentAction.None, null, 1);
    testIndentAction("", "	 * * / * / * / */", "", null, null);
    testIndentAction("	/**", "	 * ", "", IndentAction.None, "* ");
    testIndentAction("	 * something", "	 * ", "", IndentAction.None, "* ");
    testIndentAction("	 *", "	 * ", "", IndentAction.None, "* ");
    testIndentAction("/**", " * ", "", IndentAction.None, "* ");
    testIndentAction(" * something", " * ", "", IndentAction.None, "* ");
    testIndentAction(" *", " * asdfsfagadfg", "", IndentAction.None, "* ");
    testIndentAction("/**", " * asdfsfagadfg * * * ", "", IndentAction.None, "* ");
    testIndentAction(" * something", " * asdfsfagadfg * * * ", "", IndentAction.None, "* ");
    testIndentAction(" *", " * asdfsfagadfg * * * ", "", IndentAction.None, "* ");
    testIndentAction("/**", " * /*", "", IndentAction.None, "* ");
    testIndentAction(" * something", " * /*", "", IndentAction.None, "* ");
    testIndentAction(" *", " * /*", "", IndentAction.None, "* ");
    testIndentAction("/**", " * asdfsfagadfg * / * / * /", "", IndentAction.None, "* ");
    testIndentAction(" * something", " * asdfsfagadfg * / * / * /", "", IndentAction.None, "* ");
    testIndentAction(" *", " * asdfsfagadfg * / * / * /", "", IndentAction.None, "* ");
    testIndentAction("/**", " * asdfsfagadfg * / * / * /*", "", IndentAction.None, "* ");
    testIndentAction(" * something", " * asdfsfagadfg * / * / * /*", "", IndentAction.None, "* ");
    testIndentAction(" *", " * asdfsfagadfg * / * / * /*", "", IndentAction.None, "* ");
    testIndentAction("", " */", "", IndentAction.None, null, 1);
    testIndentAction(" */", " * test() {", "", IndentAction.Indent, null, 0);
    testIndentAction("", "	 */", "", IndentAction.None, null, 1);
    testIndentAction("", "		 */", "", IndentAction.None, null, 1);
    testIndentAction("", "   */", "", IndentAction.None, null, 1);
    testIndentAction("", "     */", "", IndentAction.None, null, 1);
    testIndentAction("", "	     */", "", IndentAction.None, null, 1);
    testIndentAction("", " *--------------------------------------------------------------------------------------------*/", "", IndentAction.None, null, 1);
    testIndentAction("class A {", "    * test() {", "", IndentAction.Indent, null, 0);
    testIndentAction("", "    * test() {", "", IndentAction.Indent, null, 0);
    testIndentAction("    ", "    * test() {", "", IndentAction.Indent, null, 0);
    testIndentAction("class A {", "  * test() {", "", IndentAction.Indent, null, 0);
    testIndentAction("", "  * test() {", "", IndentAction.Indent, null, 0);
    testIndentAction("  ", "  * test() {", "", IndentAction.Indent, null, 0);
  });
  test("issue #141816", () => {
    const support = new OnEnterSupport({
      onEnterRules: javascriptOnEnterRules
    });
    const testIndentAction = (beforeText, afterText, expected) => {
      const actual = support.onEnter(EditorAutoIndentStrategy.Advanced, "", beforeText, afterText);
      if (expected === IndentAction.None) {
        assert.strictEqual(actual, null);
      } else {
        assert.strictEqual(actual.indentAction, expected);
      }
    };
    testIndentAction("const r = /{/;", "", IndentAction.None);
    testIndentAction("const r = /{[0-9]/;", "", IndentAction.None);
    testIndentAction("const r = /[a-zA-Z]{/;", "", IndentAction.None);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZXMvc3VwcG9ydHMvb25FbnRlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IENoYXJhY3RlclBhaXIsIEluZGVudEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IE9uRW50ZXJTdXBwb3J0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9zdXBwb3J0cy9vbkVudGVyLmpzJztcbmltcG9ydCB7IGphdmFzY3JpcHRPbkVudGVyUnVsZXMgfSBmcm9tICcuL29uRW50ZXJSdWxlcy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBdXRvSW5kZW50U3RyYXRlZ3kgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbnN1aXRlKCdPbkVudGVyJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ3VzZXMgYnJhY2tldHMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYnJhY2tldHM6IENoYXJhY3RlclBhaXJbXSA9IFtcblx0XHRcdFsnKCcsICcpJ10sXG5cdFx0XHRbJ2JlZ2luJywgJ2VuZCddXG5cdFx0XTtcblx0XHRjb25zdCBzdXBwb3J0ID0gbmV3IE9uRW50ZXJTdXBwb3J0KHtcblx0XHRcdGJyYWNrZXRzOiBicmFja2V0c1xuXHRcdH0pO1xuXHRcdGNvbnN0IHRlc3RJbmRlbnRBY3Rpb24gPSAoYmVmb3JlVGV4dDogc3RyaW5nLCBhZnRlclRleHQ6IHN0cmluZywgZXhwZWN0ZWQ6IEluZGVudEFjdGlvbikgPT4ge1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gc3VwcG9ydC5vbkVudGVyKEVkaXRvckF1dG9JbmRlbnRTdHJhdGVneS5BZHZhbmNlZCwgJycsIGJlZm9yZVRleHQsIGFmdGVyVGV4dCk7XG5cdFx0XHRpZiAoZXhwZWN0ZWQgPT09IEluZGVudEFjdGlvbi5Ob25lKSB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIG51bGwpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCEuaW5kZW50QWN0aW9uLCBleHBlY3RlZCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJ2EnLCAnJywgSW5kZW50QWN0aW9uLk5vbmUpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJycsICdiJywgSW5kZW50QWN0aW9uLk5vbmUpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJygnLCAnYicsIEluZGVudEFjdGlvbi5JbmRlbnQpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJ2EnLCAnKScsIEluZGVudEFjdGlvbi5Ob25lKTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCdiZWdpbicsICdlbmRpbmcnLCBJbmRlbnRBY3Rpb24uSW5kZW50KTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCdhYmVnaW4nLCAnZW5kJywgSW5kZW50QWN0aW9uLk5vbmUpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJ2JlZ2luJywgJyknLCBJbmRlbnRBY3Rpb24uSW5kZW50KTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCdiZWdpbicsICdlbmQnLCBJbmRlbnRBY3Rpb24uSW5kZW50T3V0ZGVudCk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignYmVnaW4gJywgJyBlbmQnLCBJbmRlbnRBY3Rpb24uSW5kZW50T3V0ZGVudCk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignIGJlZ2luJywgJ2VuZC8vYXMnLCBJbmRlbnRBY3Rpb24uSW5kZW50T3V0ZGVudCk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignKCcsICcpJywgSW5kZW50QWN0aW9uLkluZGVudE91dGRlbnQpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJyggJywgJyknLCBJbmRlbnRBY3Rpb24uSW5kZW50T3V0ZGVudCk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignYSgnLCAnKWInLCBJbmRlbnRBY3Rpb24uSW5kZW50T3V0ZGVudCk7XG5cblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcoJywgJycsIEluZGVudEFjdGlvbi5JbmRlbnQpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJygnLCAnZm9vJywgSW5kZW50QWN0aW9uLkluZGVudCk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignYmVnaW4nLCAnZm9vJywgSW5kZW50QWN0aW9uLkluZGVudCk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignYmVnaW4nLCAnJywgSW5kZW50QWN0aW9uLkluZGVudCk7XG5cdH0pO1xuXG5cblx0dGVzdCgnSXNzdWUgIzEyMTEyNTogb25FbnRlclJ1bGVzIHdpdGggZ2xvYmFsIG1vZGlmaWVyJywgKCkgPT4ge1xuXHRcdGNvbnN0IHN1cHBvcnQgPSBuZXcgT25FbnRlclN1cHBvcnQoe1xuXHRcdFx0b25FbnRlclJ1bGVzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRhY3Rpb246IHtcblx0XHRcdFx0XHRcdGFwcGVuZFRleHQ6ICcvLy8gJyxcblx0XHRcdFx0XHRcdGluZGVudEFjdGlvbjogSW5kZW50QWN0aW9uLk91dGRlbnRcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGJlZm9yZVRleHQ6IC9eXFxzKlxcL3szfS4qJC9nbVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSk7XG5cblx0XHRjb25zdCB0ZXN0SW5kZW50QWN0aW9uID0gKHByZXZpb3VzTGluZVRleHQ6IHN0cmluZywgYmVmb3JlVGV4dDogc3RyaW5nLCBhZnRlclRleHQ6IHN0cmluZywgZXhwZWN0ZWRJbmRlbnRBY3Rpb246IEluZGVudEFjdGlvbiB8IG51bGwsIGV4cGVjdGVkQXBwZW5kVGV4dDogc3RyaW5nIHwgbnVsbCwgcmVtb3ZlVGV4dDogbnVtYmVyID0gMCkgPT4ge1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gc3VwcG9ydC5vbkVudGVyKEVkaXRvckF1dG9JbmRlbnRTdHJhdGVneS5BZHZhbmNlZCwgcHJldmlvdXNMaW5lVGV4dCwgYmVmb3JlVGV4dCwgYWZ0ZXJUZXh0KTtcblx0XHRcdGlmIChleHBlY3RlZEluZGVudEFjdGlvbiA9PT0gbnVsbCkge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBudWxsLCAnaXNOdWxsOicgKyBiZWZvcmVUZXh0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwgIT09IG51bGwsIHRydWUsICdpc05vdE51bGw6JyArIGJlZm9yZVRleHQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsIS5pbmRlbnRBY3Rpb24sIGV4cGVjdGVkSW5kZW50QWN0aW9uLCAnaW5kZW50QWN0aW9uOicgKyBiZWZvcmVUZXh0KTtcblx0XHRcdFx0aWYgKGV4cGVjdGVkQXBwZW5kVGV4dCAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwhLmFwcGVuZFRleHQsIGV4cGVjdGVkQXBwZW5kVGV4dCwgJ2FwcGVuZFRleHQ6JyArIGJlZm9yZVRleHQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChyZW1vdmVUZXh0ICE9PSAwKSB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCEucmVtb3ZlVGV4dCwgcmVtb3ZlVGV4dCwgJ3JlbW92ZVRleHQ6JyArIGJlZm9yZVRleHQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJy8vLyBsaW5lJywgJy8vLyBsaW5lJywgJycsIEluZGVudEFjdGlvbi5PdXRkZW50LCAnLy8vICcpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJy8vLyBsaW5lJywgJy8vLyBsaW5lJywgJycsIEluZGVudEFjdGlvbi5PdXRkZW50LCAnLy8vICcpO1xuXHR9KTtcblxuXHR0ZXN0KCd1c2VzIHJlZ0V4cFJ1bGVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHN1cHBvcnQgPSBuZXcgT25FbnRlclN1cHBvcnQoe1xuXHRcdFx0b25FbnRlclJ1bGVzOiBqYXZhc2NyaXB0T25FbnRlclJ1bGVzXG5cdFx0fSk7XG5cdFx0Y29uc3QgdGVzdEluZGVudEFjdGlvbiA9IChwcmV2aW91c0xpbmVUZXh0OiBzdHJpbmcsIGJlZm9yZVRleHQ6IHN0cmluZywgYWZ0ZXJUZXh0OiBzdHJpbmcsIGV4cGVjdGVkSW5kZW50QWN0aW9uOiBJbmRlbnRBY3Rpb24gfCBudWxsLCBleHBlY3RlZEFwcGVuZFRleHQ6IHN0cmluZyB8IG51bGwsIHJlbW92ZVRleHQ6IG51bWJlciA9IDApID0+IHtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IHN1cHBvcnQub25FbnRlcihFZGl0b3JBdXRvSW5kZW50U3RyYXRlZ3kuQWR2YW5jZWQsIHByZXZpb3VzTGluZVRleHQsIGJlZm9yZVRleHQsIGFmdGVyVGV4dCk7XG5cdFx0XHRpZiAoZXhwZWN0ZWRJbmRlbnRBY3Rpb24gPT09IG51bGwpIHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgbnVsbCwgJ2lzTnVsbDonICsgYmVmb3JlVGV4dCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsICE9PSBudWxsLCB0cnVlLCAnaXNOb3ROdWxsOicgKyBiZWZvcmVUZXh0KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCEuaW5kZW50QWN0aW9uLCBleHBlY3RlZEluZGVudEFjdGlvbiwgJ2luZGVudEFjdGlvbjonICsgYmVmb3JlVGV4dCk7XG5cdFx0XHRcdGlmIChleHBlY3RlZEFwcGVuZFRleHQgIT09IG51bGwpIHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsIS5hcHBlbmRUZXh0LCBleHBlY3RlZEFwcGVuZFRleHQsICdhcHBlbmRUZXh0OicgKyBiZWZvcmVUZXh0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAocmVtb3ZlVGV4dCAhPT0gMCkge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwhLnJlbW92ZVRleHQsIHJlbW92ZVRleHQsICdyZW1vdmVUZXh0OicgKyBiZWZvcmVUZXh0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcnLCAnXFx0LyoqJywgJyAqLycsIEluZGVudEFjdGlvbi5JbmRlbnRPdXRkZW50LCAnICogJyk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignJywgJ1xcdC8qKicsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgJyAqICcpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJycsICdcXHQvKiogKiAvICogLyAqIC8nLCAnJywgSW5kZW50QWN0aW9uLk5vbmUsICcgKiAnKTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcnLCAnXFx0LyoqIC8qJywgJycsIEluZGVudEFjdGlvbi5Ob25lLCAnICogJyk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignJywgJy8qKicsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgJyAqICcpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJycsICdcXHQvKiovJywgJycsIG51bGwsIG51bGwpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJycsICdcXHQvKioqLycsICcnLCBudWxsLCBudWxsKTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcnLCAnXFx0LyoqKioqKiovJywgJycsIG51bGwsIG51bGwpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJycsICdcXHQvKiogKiAqICogKiAqLycsICcnLCBudWxsLCBudWxsKTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcnLCAnXFx0LyoqICovJywgJycsIG51bGwsIG51bGwpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJycsICdcXHQvKiogYXNkZmcgKi8nLCAnJywgbnVsbCwgbnVsbCk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignJywgJ1xcdC8qIGFzZGZnICovJywgJycsIG51bGwsIG51bGwpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJycsICdcXHQvKiBhc2RmZyAqLycsICcnLCBudWxsLCBudWxsKTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcnLCAnXFx0LyoqIGFzZGZnICovJywgJycsIG51bGwsIG51bGwpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJycsICcqLycsICcnLCBudWxsLCBudWxsKTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcnLCAnXFx0LyonLCAnJywgbnVsbCwgbnVsbCk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignJywgJ1xcdConLCAnJywgbnVsbCwgbnVsbCk7XG5cblx0XHR0ZXN0SW5kZW50QWN0aW9uKCdcXHQvKionLCAnXFx0IConLCAnJywgSW5kZW50QWN0aW9uLk5vbmUsICcqICcpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJ1xcdCAqIHNvbWV0aGluZycsICdcXHQgKicsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgJyogJyk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignXFx0IConLCAnXFx0IConLCAnJywgSW5kZW50QWN0aW9uLk5vbmUsICcqICcpO1xuXG5cdFx0dGVzdEluZGVudEFjdGlvbignJywgJ1xcdCAqLycsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgbnVsbCwgMSk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignJywgJ1xcdCAqICovJywgJycsIEluZGVudEFjdGlvbi5Ob25lLCBudWxsLCAxKTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcnLCAnXFx0ICogKiAvICogLyAqIC8gKi8nLCAnJywgbnVsbCwgbnVsbCk7XG5cblx0XHR0ZXN0SW5kZW50QWN0aW9uKCdcXHQvKionLCAnXFx0ICogJywgJycsIEluZGVudEFjdGlvbi5Ob25lLCAnKiAnKTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCdcXHQgKiBzb21ldGhpbmcnLCAnXFx0ICogJywgJycsIEluZGVudEFjdGlvbi5Ob25lLCAnKiAnKTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCdcXHQgKicsICdcXHQgKiAnLCAnJywgSW5kZW50QWN0aW9uLk5vbmUsICcqICcpO1xuXG5cdFx0dGVzdEluZGVudEFjdGlvbignLyoqJywgJyAqICcsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgJyogJyk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignICogc29tZXRoaW5nJywgJyAqICcsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgJyogJyk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignIConLCAnICogYXNkZnNmYWdhZGZnJywgJycsIEluZGVudEFjdGlvbi5Ob25lLCAnKiAnKTtcblxuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJy8qKicsICcgKiBhc2Rmc2ZhZ2FkZmcgKiAqICogJywgJycsIEluZGVudEFjdGlvbi5Ob25lLCAnKiAnKTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcgKiBzb21ldGhpbmcnLCAnICogYXNkZnNmYWdhZGZnICogKiAqICcsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgJyogJyk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignIConLCAnICogYXNkZnNmYWdhZGZnICogKiAqICcsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgJyogJyk7XG5cblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcvKionLCAnICogLyonLCAnJywgSW5kZW50QWN0aW9uLk5vbmUsICcqICcpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJyAqIHNvbWV0aGluZycsICcgKiAvKicsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgJyogJyk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignIConLCAnICogLyonLCAnJywgSW5kZW50QWN0aW9uLk5vbmUsICcqICcpO1xuXG5cdFx0dGVzdEluZGVudEFjdGlvbignLyoqJywgJyAqIGFzZGZzZmFnYWRmZyAqIC8gKiAvICogLycsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgJyogJyk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignICogc29tZXRoaW5nJywgJyAqIGFzZGZzZmFnYWRmZyAqIC8gKiAvICogLycsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgJyogJyk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignIConLCAnICogYXNkZnNmYWdhZGZnICogLyAqIC8gKiAvJywgJycsIEluZGVudEFjdGlvbi5Ob25lLCAnKiAnKTtcblxuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJy8qKicsICcgKiBhc2Rmc2ZhZ2FkZmcgKiAvICogLyAqIC8qJywgJycsIEluZGVudEFjdGlvbi5Ob25lLCAnKiAnKTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcgKiBzb21ldGhpbmcnLCAnICogYXNkZnNmYWdhZGZnICogLyAqIC8gKiAvKicsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgJyogJyk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignIConLCAnICogYXNkZnNmYWdhZGZnICogLyAqIC8gKiAvKicsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgJyogJyk7XG5cblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcnLCAnICovJywgJycsIEluZGVudEFjdGlvbi5Ob25lLCBudWxsLCAxKTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcgKi8nLCAnICogdGVzdCgpIHsnLCAnJywgSW5kZW50QWN0aW9uLkluZGVudCwgbnVsbCwgMCk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignJywgJ1xcdCAqLycsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgbnVsbCwgMSk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignJywgJ1xcdFxcdCAqLycsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgbnVsbCwgMSk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignJywgJyAgICovJywgJycsIEluZGVudEFjdGlvbi5Ob25lLCBudWxsLCAxKTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcnLCAnICAgICAqLycsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSwgbnVsbCwgMSk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignJywgJ1xcdCAgICAgKi8nLCAnJywgSW5kZW50QWN0aW9uLk5vbmUsIG51bGwsIDEpO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJycsICcgKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi8nLCAnJywgSW5kZW50QWN0aW9uLk5vbmUsIG51bGwsIDEpO1xuXG5cdFx0Ly8gaXNzdWUgIzQzNDY5XG5cdFx0dGVzdEluZGVudEFjdGlvbignY2xhc3MgQSB7JywgJyAgICAqIHRlc3QoKSB7JywgJycsIEluZGVudEFjdGlvbi5JbmRlbnQsIG51bGwsIDApO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJycsICcgICAgKiB0ZXN0KCkgeycsICcnLCBJbmRlbnRBY3Rpb24uSW5kZW50LCBudWxsLCAwKTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcgICAgJywgJyAgICAqIHRlc3QoKSB7JywgJycsIEluZGVudEFjdGlvbi5JbmRlbnQsIG51bGwsIDApO1xuXHRcdHRlc3RJbmRlbnRBY3Rpb24oJ2NsYXNzIEEgeycsICcgICogdGVzdCgpIHsnLCAnJywgSW5kZW50QWN0aW9uLkluZGVudCwgbnVsbCwgMCk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignJywgJyAgKiB0ZXN0KCkgeycsICcnLCBJbmRlbnRBY3Rpb24uSW5kZW50LCBudWxsLCAwKTtcblx0XHR0ZXN0SW5kZW50QWN0aW9uKCcgICcsICcgICogdGVzdCgpIHsnLCAnJywgSW5kZW50QWN0aW9uLkluZGVudCwgbnVsbCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxNDE4MTYnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgc3VwcG9ydCA9IG5ldyBPbkVudGVyU3VwcG9ydCh7XG5cdFx0XHRvbkVudGVyUnVsZXM6IGphdmFzY3JpcHRPbkVudGVyUnVsZXNcblx0XHR9KTtcblx0XHRjb25zdCB0ZXN0SW5kZW50QWN0aW9uID0gKGJlZm9yZVRleHQ6IHN0cmluZywgYWZ0ZXJUZXh0OiBzdHJpbmcsIGV4cGVjdGVkOiBJbmRlbnRBY3Rpb24pID0+IHtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IHN1cHBvcnQub25FbnRlcihFZGl0b3JBdXRvSW5kZW50U3RyYXRlZ3kuQWR2YW5jZWQsICcnLCBiZWZvcmVUZXh0LCBhZnRlclRleHQpO1xuXHRcdFx0aWYgKGV4cGVjdGVkID09PSBJbmRlbnRBY3Rpb24uTm9uZSkge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBudWxsKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwhLmluZGVudEFjdGlvbiwgZXhwZWN0ZWQpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0ZXN0SW5kZW50QWN0aW9uKCdjb25zdCByID0gL3svOycsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignY29uc3QgciA9IC97WzAtOV0vOycsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSk7XG5cdFx0dGVzdEluZGVudEFjdGlvbignY29uc3QgciA9IC9bYS16QS1aXXsvOycsICcnLCBJbmRlbnRBY3Rpb24uTm9uZSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxPQUFPLFlBQVk7QUFDbkIsU0FBd0Isb0JBQW9CO0FBQzVDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsK0NBQStDO0FBRXhELE1BQU0sV0FBVyxNQUFNO0FBRXRCLDBDQUF3QztBQUV4QyxPQUFLLGlCQUFpQixNQUFNO0FBQzNCLFVBQU0sV0FBNEI7QUFBQSxNQUNqQyxDQUFDLEtBQUssR0FBRztBQUFBLE1BQ1QsQ0FBQyxTQUFTLEtBQUs7QUFBQSxJQUNoQjtBQUNBLFVBQU0sVUFBVSxJQUFJLGVBQWU7QUFBQSxNQUNsQztBQUFBLElBQ0QsQ0FBQztBQUNELFVBQU0sbUJBQW1CLENBQUMsWUFBb0IsV0FBbUIsYUFBMkI7QUFDM0YsWUFBTSxTQUFTLFFBQVEsUUFBUSx5QkFBeUIsVUFBVSxJQUFJLFlBQVksU0FBUztBQUMzRixVQUFJLGFBQWEsYUFBYSxNQUFNO0FBQ25DLGVBQU8sWUFBWSxRQUFRLElBQUk7QUFBQSxNQUNoQyxPQUFPO0FBQ04sZUFBTyxZQUFZLE9BQVEsY0FBYyxRQUFRO0FBQUEsTUFDbEQ7QUFBQSxJQUNEO0FBRUEscUJBQWlCLEtBQUssSUFBSSxhQUFhLElBQUk7QUFDM0MscUJBQWlCLElBQUksS0FBSyxhQUFhLElBQUk7QUFDM0MscUJBQWlCLEtBQUssS0FBSyxhQUFhLE1BQU07QUFDOUMscUJBQWlCLEtBQUssS0FBSyxhQUFhLElBQUk7QUFDNUMscUJBQWlCLFNBQVMsVUFBVSxhQUFhLE1BQU07QUFDdkQscUJBQWlCLFVBQVUsT0FBTyxhQUFhLElBQUk7QUFDbkQscUJBQWlCLFNBQVMsS0FBSyxhQUFhLE1BQU07QUFDbEQscUJBQWlC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
