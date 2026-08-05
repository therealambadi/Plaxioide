var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import assert from "assert";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { ShiftCommand } from "../../../common/commands/shiftCommand.js";
import { EditorAutoIndentStrategy } from "../../../common/config/editorOptions.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { ILanguageService } from "../../../common/languages/language.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { getEditOperation, testCommand } from "../testCommand.js";
import { javascriptOnEnterRules } from "../../common/modes/supports/onEnterRules.js";
import { TestLanguageConfigurationService } from "../../common/modes/testLanguageConfigurationService.js";
import { withEditorModel } from "../../common/testTextModel.js";
function createSingleEditOp(text, positionLineNumber, positionColumn, selectionLineNumber = positionLineNumber, selectionColumn = positionColumn) {
  return {
    range: new Range(selectionLineNumber, selectionColumn, positionLineNumber, positionColumn),
    text,
    forceMoveMarkers: false
  };
}
let DocBlockCommentMode = class extends Disposable {
  constructor(languageService, languageConfigurationService) {
    super();
    this.languageId = DocBlockCommentMode.languageId;
    this._register(languageService.registerLanguage({ id: this.languageId }));
    this._register(languageConfigurationService.register(this.languageId, {
      brackets: [
        ["(", ")"],
        ["{", "}"],
        ["[", "]"]
      ],
      onEnterRules: javascriptOnEnterRules
    }));
  }
};
DocBlockCommentMode.languageId = "commentMode";
DocBlockCommentMode = __decorateClass([
  __decorateParam(0, ILanguageService),
  __decorateParam(1, ILanguageConfigurationService)
], DocBlockCommentMode);
function testShiftCommand(lines, languageId, useTabStops, selection, expectedLines, expectedSelection, prepare) {
  testCommand(lines, languageId, selection, (accessor, sel) => new ShiftCommand(sel, {
    isUnshift: false,
    tabSize: 4,
    indentSize: 4,
    insertSpaces: false,
    useTabStops,
    autoIndent: EditorAutoIndentStrategy.Full
  }, accessor.get(ILanguageConfigurationService)), expectedLines, expectedSelection, void 0, prepare);
}
function testUnshiftCommand(lines, languageId, useTabStops, selection, expectedLines, expectedSelection, prepare) {
  testCommand(lines, languageId, selection, (accessor, sel) => new ShiftCommand(sel, {
    isUnshift: true,
    tabSize: 4,
    indentSize: 4,
    insertSpaces: false,
    useTabStops,
    autoIndent: EditorAutoIndentStrategy.Full
  }, accessor.get(ILanguageConfigurationService)), expectedLines, expectedSelection, void 0, prepare);
}
function prepareDocBlockCommentLanguage(accessor, disposables) {
  const languageConfigurationService = accessor.get(ILanguageConfigurationService);
  const languageService = accessor.get(ILanguageService);
  disposables.add(new DocBlockCommentMode(languageService, languageConfigurationService));
}
suite("Editor Commands - ShiftCommand", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Bug 9503: Shifting without any selection", () => {
    testShiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(1, 1, 1, 1),
      [
        "	My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      new Selection(1, 2, 1, 2)
    );
  });
  test("shift on single line selection 1", () => {
    testShiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(1, 3, 1, 1),
      [
        "	My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      new Selection(1, 4, 1, 1)
    );
  });
  test("shift on single line selection 2", () => {
    testShiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(1, 1, 1, 3),
      [
        "	My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      new Selection(1, 1, 1, 4)
    );
  });
  test("simple shift", () => {
    testShiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(1, 1, 2, 1),
      [
        "	My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      new Selection(1, 1, 2, 1)
    );
  });
  test("shifting on two separate lines", () => {
    testShiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(1, 1, 2, 1),
      [
        "	My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      new Selection(1, 1, 2, 1)
    );
    testShiftCommand(
      [
        "	My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(2, 1, 3, 1),
      [
        "	My First Line",
        "			My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      new Selection(2, 1, 3, 1)
    );
  });
  test("shifting on two lines", () => {
    testShiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(1, 2, 2, 2),
      [
        "	My First Line",
        "			My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      new Selection(1, 3, 2, 2)
    );
  });
  test("shifting on two lines again", () => {
    testShiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(2, 2, 1, 2),
      [
        "	My First Line",
        "			My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      new Selection(2, 2, 1, 3)
    );
  });
  test("shifting at end of file", () => {
    testShiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(4, 1, 5, 2),
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "	123"
      ],
      new Selection(4, 1, 5, 3)
    );
  });
  test("issue #1120 TAB should not indent empty lines in a multi-line selection", () => {
    testShiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(1, 1, 5, 2),
      [
        "	My First Line",
        "			My Second Line",
        "		Third Line",
        "",
        "	123"
      ],
      new Selection(1, 1, 5, 3)
    );
    testShiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(4, 1, 5, 1),
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "	",
        "123"
      ],
      new Selection(4, 1, 5, 1)
    );
  });
  test("unshift on single line selection 1", () => {
    testShiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(2, 3, 2, 1),
      [
        "My First Line",
        "			My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      new Selection(2, 3, 2, 1)
    );
  });
  test("unshift on single line selection 2", () => {
    testShiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(2, 1, 2, 3),
      [
        "My First Line",
        "			My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      new Selection(2, 1, 2, 3)
    );
  });
  test("simple unshift", () => {
    testUnshiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(1, 1, 2, 1),
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      new Selection(1, 1, 2, 1)
    );
  });
  test("unshifting on two lines 1", () => {
    testUnshiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(1, 2, 2, 2),
      [
        "My First Line",
        "	My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      new Selection(1, 2, 2, 2)
    );
  });
  test("unshifting on two lines 2", () => {
    testUnshiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(2, 3, 2, 1),
      [
        "My First Line",
        "	My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      new Selection(2, 2, 2, 1)
    );
  });
  test("unshifting at the end of the file", () => {
    testUnshiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(4, 1, 5, 2),
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      new Selection(4, 1, 5, 2)
    );
  });
  test("unshift many times + shift", () => {
    testUnshiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(1, 1, 5, 4),
      [
        "My First Line",
        "	My Second Line",
        "Third Line",
        "",
        "123"
      ],
      new Selection(1, 1, 5, 4)
    );
    testUnshiftCommand(
      [
        "My First Line",
        "	My Second Line",
        "Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(1, 1, 5, 4),
      [
        "My First Line",
        "My Second Line",
        "Third Line",
        "",
        "123"
      ],
      new Selection(1, 1, 5, 4)
    );
    testShiftCommand(
      [
        "My First Line",
        "My Second Line",
        "Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(1, 1, 5, 4),
      [
        "	My First Line",
        "	My Second Line",
        "	Third Line",
        "",
        "	123"
      ],
      new Selection(1, 1, 5, 5)
    );
  });
  test("Bug 9119: Unshift from first column doesn't work", () => {
    testUnshiftCommand(
      [
        "My First Line",
        "		My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      null,
      true,
      new Selection(2, 1, 2, 1),
      [
        "My First Line",
        "	My Second Line",
        "    Third Line",
        "",
        "123"
      ],
      new Selection(2, 1, 2, 1)
    );
  });
  test("issue #348: indenting around doc block comments", () => {
    testShiftCommand(
      [
        "",
        "/**",
        " * a doc comment",
        " */",
        "function hello() {}"
      ],
      DocBlockCommentMode.languageId,
      true,
      new Selection(1, 1, 5, 20),
      [
        "",
        "	/**",
        "	 * a doc comment",
        "	 */",
        "	function hello() {}"
      ],
      new Selection(1, 1, 5, 21),
      prepareDocBlockCommentLanguage
    );
    testUnshiftCommand(
      [
        "",
        "/**",
        " * a doc comment",
        " */",
        "function hello() {}"
      ],
      DocBlockCommentMode.languageId,
      true,
      new Selection(1, 1, 5, 20),
      [
        "",
        "/**",
        " * a doc comment",
        " */",
        "function hello() {}"
      ],
      new Selection(1, 1, 5, 20),
      prepareDocBlockCommentLanguage
    );
    testUnshiftCommand(
      [
        "	",
        "	/**",
        "	 * a doc comment",
        "	 */",
        "	function hello() {}"
      ],
      DocBlockCommentMode.languageId,
      true,
      new Selection(1, 1, 5, 21),
      [
        "",
        "/**",
        " * a doc comment",
        " */",
        "function hello() {}"
      ],
      new Selection(1, 1, 5, 20),
      prepareDocBlockCommentLanguage
    );
  });
  test("issue #1609: Wrong indentation of block comments", () => {
    testShiftCommand(
      [
        "",
        "/**",
        " * test",
        " *",
        " * @type {number}",
        " */",
        "var foo = 0;"
      ],
      DocBlockCommentMode.languageId,
      true,
      new Selection(1, 1, 7, 13),
      [
        "",
        "	/**",
        "	 * test",
        "	 *",
        "	 * @type {number}",
        "	 */",
        "	var foo = 0;"
      ],
      new Selection(1, 1, 7, 14),
      prepareDocBlockCommentLanguage
    );
  });
  test("issue #1620: a) Line indent doesn't handle leading whitespace properly", () => {
    testCommand(
      [
        "   Written | Numeric",
        "       one | 1",
        "       two | 2",
        "     three | 3",
        "      four | 4",
        "      five | 5",
        "       six | 6",
        "     seven | 7",
        "     eight | 8",
        "      nine | 9",
        "       ten | 10",
        "    eleven | 11",
        ""
      ],
      null,
      new Selection(1, 1, 13, 1),
      (accessor, sel) => new ShiftCommand(sel, {
        isUnshift: false,
        tabSize: 4,
        indentSize: 4,
        insertSpaces: true,
        useTabStops: false,
        autoIndent: EditorAutoIndentStrategy.Full
      }, accessor.get(ILanguageConfigurationService)),
      [
        "       Written | Numeric",
        "           one | 1",
        "           two | 2",
        "         three | 3",
        "          four | 4",
        "          five | 5",
        "           six | 6",
        "         seven | 7",
        "         eight | 8",
        "          nine | 9",
        "           ten | 10",
        "        eleven | 11",
        ""
      ],
      new Selection(1, 1, 13, 1)
    );
  });
  test("issue #1620: b) Line indent doesn't handle leading whitespace properly", () => {
    testCommand(
      [
        "       Written | Numeric",
        "           one | 1",
        "           two | 2",
        "         three | 3",
        "          four | 4",
        "          five | 5",
        "           six | 6",
        "         seven | 7",
        "         eight | 8",
        "          nine | 9",
        "           ten | 10",
        "        eleven | 11",
        ""
      ],
      null,
      new Selection(1, 1, 13, 1),
      (accessor, sel) => new ShiftCommand(sel, {
        isUnshift: true,
        tabSize: 4,
        indentSize: 4,
        insertSpaces: true,
        useTabStops: false,
        autoIndent: EditorAutoIndentStrategy.Full
      }, accessor.get(ILanguageConfigurationService)),
      [
        "   Written | Numeric",
        "       one | 1",
        "       two | 2",
        "     three | 3",
        "      four | 4",
        "      five | 5",
        "       six | 6",
        "     seven | 7",
        "     eight | 8",
        "      nine | 9",
        "       ten | 10",
        "    eleven | 11",
        ""
      ],
      new Selection(1, 1, 13, 1)
    );
  });
  test("issue #1620: c) Line indent doesn't handle leading whitespace properly", () => {
    testCommand(
      [
        "       Written | Numeric",
        "           one | 1",
        "           two | 2",
        "         three | 3",
        "          four | 4",
        "          five | 5",
        "           six | 6",
        "         seven | 7",
        "         eight | 8",
        "          nine | 9",
        "           ten | 10",
        "        eleven | 11",
        ""
      ],
      null,
      new Selection(1, 1, 13, 1),
      (accessor, sel) => new ShiftCommand(sel, {
        isUnshift: true,
        tabSize: 4,
        indentSize: 4,
        insertSpaces: false,
        useTabStops: false,
        autoIndent: EditorAutoIndentStrategy.Full
      }, accessor.get(ILanguageConfigurationService)),
      [
        "   Written | Numeric",
        "       one | 1",
        "       two | 2",
        "     three | 3",
        "      four | 4",
        "      five | 5",
        "       six | 6",
        "     seven | 7",
        "     eight | 8",
        "      nine | 9",
        "       ten | 10",
        "    eleven | 11",
        ""
      ],
      new Selection(1, 1, 13, 1)
    );
  });
  test("issue #1620: d) Line indent doesn't handle leading whitespace properly", () => {
    testCommand(
      [
        "	   Written | Numeric",
        "	       one | 1",
        "	       two | 2",
        "	     three | 3",
        "	      four | 4",
        "	      five | 5",
        "	       six | 6",
        "	     seven | 7",
        "	     eight | 8",
        "	      nine | 9",
        "	       ten | 10",
        "	    eleven | 11",
        ""
      ],
      null,
      new Selection(1, 1, 13, 1),
      (accessor, sel) => new ShiftCommand(sel, {
        isUnshift: true,
        tabSize: 4,
        indentSize: 4,
        insertSpaces: true,
        useTabStops: false,
        autoIndent: EditorAutoIndentStrategy.Full
      }, accessor.get(ILanguageConfigurationService)),
      [
        "   Written | Numeric",
        "       one | 1",
        "       two | 2",
        "     three | 3",
        "      four | 4",
        "      five | 5",
        "       six | 6",
        "     seven | 7",
        "     eight | 8",
        "      nine | 9",
        "       ten | 10",
        "    eleven | 11",
        ""
      ],
      new Selection(1, 1, 13, 1)
    );
  });
  test("issue microsoft/monaco-editor#443: Indentation of a single row deletes selected text in some cases", () => {
    testCommand(
      [
        "Hello world!",
        "another line"
      ],
      null,
      new Selection(1, 1, 1, 13),
      (accessor, sel) => new ShiftCommand(sel, {
        isUnshift: false,
        tabSize: 4,
        indentSize: 4,
        insertSpaces: false,
        useTabStops: true,
        autoIndent: EditorAutoIndentStrategy.Full
      }, accessor.get(ILanguageConfigurationService)),
      [
        "	Hello world!",
        "another line"
      ],
      new Selection(1, 1, 1, 14)
    );
  });
  test("bug #16815:Shift+Tab doesn't go back to tabstop", () => {
    const repeatStr = (str, cnt) => {
      let r = "";
      for (let i = 0; i < cnt; i++) {
        r += str;
      }
      return r;
    };
    const testOutdent = (tabSize, indentSize, insertSpaces, lineText, expectedIndents) => {
      const oneIndent = insertSpaces ? repeatStr(" ", indentSize) : "	";
      const expectedIndent = repeatStr(oneIndent, expectedIndents);
      if (lineText.length > 0) {
        _assertUnshiftCommand(tabSize, indentSize, insertSpaces, [lineText + "aaa"], [createSingleEditOp(expectedIndent, 1, 1, 1, lineText.length + 1)]);
      } else {
        _assertUnshiftCommand(tabSize, indentSize, insertSpaces, [lineText + "aaa"], []);
      }
    };
    const testIndent = (tabSize, indentSize, insertSpaces, lineText, expectedIndents) => {
      const oneIndent = insertSpaces ? repeatStr(" ", indentSize) : "	";
      const expectedIndent = repeatStr(oneIndent, expectedIndents);
      _assertShiftCommand(tabSize, indentSize, insertSpaces, [lineText + "aaa"], [createSingleEditOp(expectedIndent, 1, 1, 1, lineText.length + 1)]);
    };
    const testIndentation = (tabSize, indentSize, lineText, expectedOnOutdent, expectedOnIndent) => {
      testOutdent(tabSize, indentSize, true, lineText, expectedOnOutdent);
      testOutdent(tabSize, indentSize, false, lineText, expectedOnOutdent);
      testIndent(tabSize, indentSize, true, lineText, expectedOnIndent);
      testIndent(tabSize, indentSize, false, lineText, expectedOnIndent);
    };
    testIndentation(4, 4, "", 0, 1);
    testIndentation(4, 4, "	", 0, 2);
    testIndentation(4, 4, " ", 0, 1);
    testIndentation(4, 4, " 	", 0, 2);
    testIndentation(4, 4, "  ", 0, 1);
    testIndentation(4, 4, "  	", 0, 2);
    testIndentation(4, 4, "   ", 0, 1);
    testIndentation(4, 4, "   	", 0, 2);
    testIndentation(4, 4, "    ", 0, 2);
    testIndentation(4, 4, "		", 1, 3);
    testIndentation(4, 4, "	 ", 1, 2);
    testIndentation(4, 4, "	 	", 1, 3);
    testIndentation(4, 4, "	  ", 1, 2);
    testIndentation(4, 4, "	  	", 1, 3);
    testIndentation(4, 4, "	   ", 1, 2);
    testIndentation(4, 4, "	   	", 1, 3);
    testIndentation(4, 4, "	    ", 1, 3);
    testIndentation(4, 4, " 		", 1, 3);
    testIndentation(4, 4, " 	 ", 1, 2);
    testIndentation(4, 4, " 	 	", 1, 3);
    testIndentation(4, 4, " 	  ", 1, 2);
    testIndentation(4, 4, " 	  	", 1, 3);
    testIndentation(4, 4, " 	   ", 1, 2);
    testIndentation(4, 4, " 	   	", 1, 3);
    testIndentation(4, 4, " 	    ", 1, 3);
    testIndentation(4, 4, "  		", 1, 3);
    testIndentation(4, 4, "  	 ", 1, 2);
    testIndentation(4, 4, "  	 	", 1, 3);
    testIndentation(4, 4, "  	  ", 1, 2);
    testIndentation(4, 4, "  	  	", 1, 3);
    testIndentation(4, 4, "  	   ", 1, 2);
    testIndentation(4, 4, "  	   	", 1, 3);
    testIndentation(4, 4, "  	    ", 1, 3);
    testIndentation(4, 4, "   		", 1, 3);
    testIndentation(4, 4, "   	 ", 1, 2);
    testIndentation(4, 4, "   	 	", 1, 3);
    testIndentation(4, 4, "   	  ", 1, 2);
    testIndentation(4, 4, "   	  	", 1, 3);
    testIndentation(4, 4, "   	   ", 1, 2);
    testIndentation(4, 4, "   	   	", 1, 3);
    testIndentation(4, 4, "   	    ", 1, 3);
    testIndentation(4, 4, "    	", 1, 3);
    testIndentation(4, 4, "     ", 1, 2);
    testIndentation(4, 4, "     	", 1, 3);
    testIndentation(4, 4, "      ", 1, 2);
    testIndentation(4, 4, "      	", 1, 3);
    testIndentation(4, 4, "       ", 1, 2);
    testIndentation(4, 4, "       	", 1, 3);
    testIndentation(4, 4, "        ", 1, 3);
    testIndentation(4, 4, "         ", 2, 3);
    function _assertUnshiftCommand(tabSize, indentSize, insertSpaces, text, expected) {
      return withEditorModel(text, (model) => {
        const testLanguageConfigurationService = new TestLanguageConfigurationService();
        const op = new ShiftCommand(new Selection(1, 1, text.length + 1, 1), {
          isUnshift: true,
          tabSize,
          indentSize,
          insertSpaces,
          useTabStops: true,
          autoIndent: EditorAutoIndentStrategy.Full
        }, testLanguageConfigurationService);
        const actual = getEditOperation(model, op);
        assert.deepStrictEqual(actual, expected);
        testLanguageConfigurationService.dispose();
      });
    }
    function _assertShiftCommand(tabSize, indentSize, insertSpaces, text, expected) {
      return withEditorModel(text, (model) => {
        const testLanguageConfigurationService = new TestLanguageConfigurationService();
        const op = new ShiftCommand(new Selection(1, 1, text.length + 1, 1), {
          isUnshift: false,
          tabSize,
          indentSize,
          insertSpaces,
          useTabStops: true,
          autoIndent: EditorAutoIndentStrategy.Full
        }, testLanguageConfigurationService);
        const actual = getEditOperation(model, op);
        assert.deepStrictEqual(actual, expected);
        testLanguageConfigurationService.dispose();
      });
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9icm93c2VyL2NvbW1hbmRzL3NoaWZ0Q29tbWFuZC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgU2hpZnRDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbW1hbmRzL3NoaWZ0Q29tbWFuZC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBdXRvSW5kZW50U3RyYXRlZ3kgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSVNpbmdsZUVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9lZGl0T3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBnZXRFZGl0T3BlcmF0aW9uLCB0ZXN0Q29tbWFuZCB9IGZyb20gJy4uL3Rlc3RDb21tYW5kLmpzJztcbmltcG9ydCB7IGphdmFzY3JpcHRPbkVudGVyUnVsZXMgfSBmcm9tICcuLi8uLi9jb21tb24vbW9kZXMvc3VwcG9ydHMvb25FbnRlclJ1bGVzLmpzJztcbmltcG9ydCB7IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL21vZGVzL3Rlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IHdpdGhFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXN0VGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcblxuLyoqXG4gKiBDcmVhdGUgc2luZ2xlIGVkaXQgb3BlcmF0aW9uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVNpbmdsZUVkaXRPcCh0ZXh0OiBzdHJpbmcsIHBvc2l0aW9uTGluZU51bWJlcjogbnVtYmVyLCBwb3NpdGlvbkNvbHVtbjogbnVtYmVyLCBzZWxlY3Rpb25MaW5lTnVtYmVyOiBudW1iZXIgPSBwb3NpdGlvbkxpbmVOdW1iZXIsIHNlbGVjdGlvbkNvbHVtbjogbnVtYmVyID0gcG9zaXRpb25Db2x1bW4pOiBJU2luZ2xlRWRpdE9wZXJhdGlvbiB7XG5cdHJldHVybiB7XG5cdFx0cmFuZ2U6IG5ldyBSYW5nZShzZWxlY3Rpb25MaW5lTnVtYmVyLCBzZWxlY3Rpb25Db2x1bW4sIHBvc2l0aW9uTGluZU51bWJlciwgcG9zaXRpb25Db2x1bW4pLFxuXHRcdHRleHQ6IHRleHQsXG5cdFx0Zm9yY2VNb3ZlTWFya2VyczogZmFsc2Vcblx0fTtcbn1cblxuY2xhc3MgRG9jQmxvY2tDb21tZW50TW9kZSBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHB1YmxpYyBzdGF0aWMgbGFuZ3VhZ2VJZCA9ICdjb21tZW50TW9kZSc7XG5cdHB1YmxpYyByZWFkb25seSBsYW5ndWFnZUlkID0gRG9jQmxvY2tDb21tZW50TW9kZS5sYW5ndWFnZUlkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiB0aGlzLmxhbmd1YWdlSWQgfSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIodGhpcy5sYW5ndWFnZUlkLCB7XG5cdFx0XHRicmFja2V0czogW1xuXHRcdFx0XHRbJygnLCAnKSddLFxuXHRcdFx0XHRbJ3snLCAnfSddLFxuXHRcdFx0XHRbJ1snLCAnXSddXG5cdFx0XHRdLFxuXG5cdFx0XHRvbkVudGVyUnVsZXM6IGphdmFzY3JpcHRPbkVudGVyUnVsZXNcblx0XHR9KSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gdGVzdFNoaWZ0Q29tbWFuZChsaW5lczogc3RyaW5nW10sIGxhbmd1YWdlSWQ6IHN0cmluZyB8IG51bGwsIHVzZVRhYlN0b3BzOiBib29sZWFuLCBzZWxlY3Rpb246IFNlbGVjdGlvbiwgZXhwZWN0ZWRMaW5lczogc3RyaW5nW10sIGV4cGVjdGVkU2VsZWN0aW9uOiBTZWxlY3Rpb24sIHByZXBhcmU/OiAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpID0+IHZvaWQpOiB2b2lkIHtcblx0dGVzdENvbW1hbmQobGluZXMsIGxhbmd1YWdlSWQsIHNlbGVjdGlvbiwgKGFjY2Vzc29yLCBzZWwpID0+IG5ldyBTaGlmdENvbW1hbmQoc2VsLCB7XG5cdFx0aXNVbnNoaWZ0OiBmYWxzZSxcblx0XHR0YWJTaXplOiA0LFxuXHRcdGluZGVudFNpemU6IDQsXG5cdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZSxcblx0XHR1c2VUYWJTdG9wczogdXNlVGFiU3RvcHMsXG5cdFx0YXV0b0luZGVudDogRWRpdG9yQXV0b0luZGVudFN0cmF0ZWd5LkZ1bGwsXG5cdH0sIGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSkpLCBleHBlY3RlZExpbmVzLCBleHBlY3RlZFNlbGVjdGlvbiwgdW5kZWZpbmVkLCBwcmVwYXJlKTtcbn1cblxuZnVuY3Rpb24gdGVzdFVuc2hpZnRDb21tYW5kKGxpbmVzOiBzdHJpbmdbXSwgbGFuZ3VhZ2VJZDogc3RyaW5nIHwgbnVsbCwgdXNlVGFiU3RvcHM6IGJvb2xlYW4sIHNlbGVjdGlvbjogU2VsZWN0aW9uLCBleHBlY3RlZExpbmVzOiBzdHJpbmdbXSwgZXhwZWN0ZWRTZWxlY3Rpb246IFNlbGVjdGlvbiwgcHJlcGFyZT86IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSkgPT4gdm9pZCk6IHZvaWQge1xuXHR0ZXN0Q29tbWFuZChsaW5lcywgbGFuZ3VhZ2VJZCwgc2VsZWN0aW9uLCAoYWNjZXNzb3IsIHNlbCkgPT4gbmV3IFNoaWZ0Q29tbWFuZChzZWwsIHtcblx0XHRpc1Vuc2hpZnQ6IHRydWUsXG5cdFx0dGFiU2l6ZTogNCxcblx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0dXNlVGFiU3RvcHM6IHVzZVRhYlN0b3BzLFxuXHRcdGF1dG9JbmRlbnQ6IEVkaXRvckF1dG9JbmRlbnRTdHJhdGVneS5GdWxsLFxuXHR9LCBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpKSwgZXhwZWN0ZWRMaW5lcywgZXhwZWN0ZWRTZWxlY3Rpb24sIHVuZGVmaW5lZCwgcHJlcGFyZSk7XG59XG5cbmZ1bmN0aW9uIHByZXBhcmVEb2NCbG9ja0NvbW1lbnRMYW5ndWFnZShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSkge1xuXHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0Y29uc3QgbGFuZ3VhZ2VTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXHRkaXNwb3NhYmxlcy5hZGQobmV3IERvY0Jsb2NrQ29tbWVudE1vZGUobGFuZ3VhZ2VTZXJ2aWNlLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG59XG5cbnN1aXRlKCdFZGl0b3IgQ29tbWFuZHMgLSBTaGlmdENvbW1hbmQnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Ly8gLS0tLS0tLS0tIHNoaWZ0XG5cblx0dGVzdCgnQnVnIDk1MDM6IFNoaWZ0aW5nIHdpdGhvdXQgYW55IHNlbGVjdGlvbicsICgpID0+IHtcblx0XHR0ZXN0U2hpZnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMTIzJ1xuXHRcdFx0XSxcblx0XHRcdG51bGwsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J1xcdE15IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEyMydcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnc2hpZnQgb24gc2luZ2xlIGxpbmUgc2VsZWN0aW9uIDEnLCAoKSA9PiB7XG5cdFx0dGVzdFNoaWZ0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEyMydcblx0XHRcdF0sXG5cdFx0XHRudWxsLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHRNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxMjMnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAxLCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NoaWZ0IG9uIHNpbmdsZSBsaW5lIHNlbGVjdGlvbiAyJywgKCkgPT4ge1xuXHRcdHRlc3RTaGlmdENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxMjMnXG5cdFx0XHRdLFxuXHRcdFx0bnVsbCxcblx0XHRcdHRydWUsXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDMpLFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0TXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMTIzJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNClcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW1wbGUgc2hpZnQnLCAoKSA9PiB7XG5cdFx0dGVzdFNoaWZ0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEyMydcblx0XHRcdF0sXG5cdFx0XHRudWxsLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMiwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHRNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxMjMnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAyLCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NoaWZ0aW5nIG9uIHR3byBzZXBhcmF0ZSBsaW5lcycsICgpID0+IHtcblx0XHR0ZXN0U2hpZnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMTIzJ1xuXHRcdFx0XSxcblx0XHRcdG51bGwsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAyLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J1xcdE15IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEyMydcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDIsIDEpXG5cdFx0KTtcblxuXHRcdHRlc3RTaGlmdENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHRNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxMjMnXG5cdFx0XHRdLFxuXHRcdFx0bnVsbCxcblx0XHRcdHRydWUsXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEsIDMsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0TXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMTIzJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMSwgMywgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaGlmdGluZyBvbiB0d28gbGluZXMnLCAoKSA9PiB7XG5cdFx0dGVzdFNoaWZ0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEyMydcblx0XHRcdF0sXG5cdFx0XHRudWxsLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMiwgMiwgMiksXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHRNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxMjMnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAzLCAyLCAyKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NoaWZ0aW5nIG9uIHR3byBsaW5lcyBhZ2FpbicsICgpID0+IHtcblx0XHR0ZXN0U2hpZnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMTIzJ1xuXHRcdFx0XSxcblx0XHRcdG51bGwsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCAyLCAxLCAyKSxcblx0XHRcdFtcblx0XHRcdFx0J1xcdE15IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEyMydcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDIsIDEsIDMpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnc2hpZnRpbmcgYXQgZW5kIG9mIGZpbGUnLCAoKSA9PiB7XG5cdFx0dGVzdFNoaWZ0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEyMydcblx0XHRcdF0sXG5cdFx0XHRudWxsLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgMSwgNSwgMiksXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdcXHQxMjMnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig0LCAxLCA1LCAzKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMTIwIFRBQiBzaG91bGQgbm90IGluZGVudCBlbXB0eSBsaW5lcyBpbiBhIG11bHRpLWxpbmUgc2VsZWN0aW9uJywgKCkgPT4ge1xuXHRcdHRlc3RTaGlmdENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxMjMnXG5cdFx0XHRdLFxuXHRcdFx0bnVsbCxcblx0XHRcdHRydWUsXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDUsIDIpLFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0TXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdcXHQxMjMnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCA1LCAzKVxuXHRcdCk7XG5cblx0XHR0ZXN0U2hpZnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMTIzJ1xuXHRcdFx0XSxcblx0XHRcdG51bGwsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig0LCAxLCA1LCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnXFx0Jyxcblx0XHRcdFx0JzEyMydcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDEsIDUsIDEpXG5cdFx0KTtcblx0fSk7XG5cblx0Ly8gLS0tLS0tLS0tIHVuc2hpZnRcblxuXHR0ZXN0KCd1bnNoaWZ0IG9uIHNpbmdsZSBsaW5lIHNlbGVjdGlvbiAxJywgKCkgPT4ge1xuXHRcdHRlc3RTaGlmdENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxMjMnXG5cdFx0XHRdLFxuXHRcdFx0bnVsbCxcblx0XHRcdHRydWUsXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDMsIDIsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMTIzJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMywgMiwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCd1bnNoaWZ0IG9uIHNpbmdsZSBsaW5lIHNlbGVjdGlvbiAyJywgKCkgPT4ge1xuXHRcdHRlc3RTaGlmdENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxMjMnXG5cdFx0XHRdLFxuXHRcdFx0bnVsbCxcblx0XHRcdHRydWUsXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDMpLFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMTIzJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMylcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW1wbGUgdW5zaGlmdCcsICgpID0+IHtcblx0XHR0ZXN0VW5zaGlmdENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxMjMnXG5cdFx0XHRdLFxuXHRcdFx0bnVsbCxcblx0XHRcdHRydWUsXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDIsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMTIzJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMiwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCd1bnNoaWZ0aW5nIG9uIHR3byBsaW5lcyAxJywgKCkgPT4ge1xuXHRcdHRlc3RVbnNoaWZ0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEyMydcblx0XHRcdF0sXG5cdFx0XHRudWxsLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMiwgMiwgMiksXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxMjMnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAyLCAyLCAyKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Vuc2hpZnRpbmcgb24gdHdvIGxpbmVzIDInLCAoKSA9PiB7XG5cdFx0dGVzdFVuc2hpZnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMTIzJ1xuXHRcdFx0XSxcblx0XHRcdG51bGwsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCAzLCAyLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEyMydcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDIsIDIsIDEpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndW5zaGlmdGluZyBhdCB0aGUgZW5kIG9mIHRoZSBmaWxlJywgKCkgPT4ge1xuXHRcdHRlc3RVbnNoaWZ0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEyMydcblx0XHRcdF0sXG5cdFx0XHRudWxsLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgMSwgNSwgMiksXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxMjMnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig0LCAxLCA1LCAyKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Vuc2hpZnQgbWFueSB0aW1lcyArIHNoaWZ0JywgKCkgPT4ge1xuXHRcdHRlc3RVbnNoaWZ0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0XFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnICAgIFRoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEyMydcblx0XHRcdF0sXG5cdFx0XHRudWxsLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgNSwgNCksXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0J1RoaXJkIExpbmUnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JzEyMydcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDUsIDQpXG5cdFx0KTtcblxuXHRcdHRlc3RVbnNoaWZ0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMTIzJ1xuXHRcdFx0XSxcblx0XHRcdG51bGwsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCA1LCA0KSxcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnTXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMTIzJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgNSwgNClcblx0XHQpO1xuXG5cdFx0dGVzdFNoaWZ0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J015IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnTXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMTIzJ1xuXHRcdFx0XSxcblx0XHRcdG51bGwsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCA1LCA0KSxcblx0XHRcdFtcblx0XHRcdFx0J1xcdE15IEZpcnN0IExpbmUnLFxuXHRcdFx0XHQnXFx0TXkgU2Vjb25kIExpbmUnLFxuXHRcdFx0XHQnXFx0VGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnXFx0MTIzJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgNSwgNSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdCdWcgOTExOTogVW5zaGlmdCBmcm9tIGZpcnN0IGNvbHVtbiBkb2VzblxcJ3Qgd29yaycsICgpID0+IHtcblx0XHR0ZXN0VW5zaGlmdENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdNeSBGaXJzdCBMaW5lJyxcblx0XHRcdFx0J1xcdFxcdE15IFNlY29uZCBMaW5lJyxcblx0XHRcdFx0JyAgICBUaGlyZCBMaW5lJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcxMjMnXG5cdFx0XHRdLFxuXHRcdFx0bnVsbCxcblx0XHRcdHRydWUsXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnTXkgRmlyc3QgTGluZScsXG5cdFx0XHRcdCdcXHRNeSBTZWNvbmQgTGluZScsXG5cdFx0XHRcdCcgICAgVGhpcmQgTGluZScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnMTIzJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMzQ4OiBpbmRlbnRpbmcgYXJvdW5kIGRvYyBibG9jayBjb21tZW50cycsICgpID0+IHtcblx0XHR0ZXN0U2hpZnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnJyxcblx0XHRcdFx0Jy8qKicsXG5cdFx0XHRcdCcgKiBhIGRvYyBjb21tZW50Jyxcblx0XHRcdFx0JyAqLycsXG5cdFx0XHRcdCdmdW5jdGlvbiBoZWxsbygpIHt9J1xuXHRcdFx0XSxcblx0XHRcdERvY0Jsb2NrQ29tbWVudE1vZGUubGFuZ3VhZ2VJZCxcblx0XHRcdHRydWUsXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDUsIDIwKSxcblx0XHRcdFtcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdcXHQvKionLFxuXHRcdFx0XHQnXFx0ICogYSBkb2MgY29tbWVudCcsXG5cdFx0XHRcdCdcXHQgKi8nLFxuXHRcdFx0XHQnXFx0ZnVuY3Rpb24gaGVsbG8oKSB7fSdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDUsIDIxKSxcblx0XHRcdHByZXBhcmVEb2NCbG9ja0NvbW1lbnRMYW5ndWFnZVxuXHRcdCk7XG5cblx0XHR0ZXN0VW5zaGlmdENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnLyoqJyxcblx0XHRcdFx0JyAqIGEgZG9jIGNvbW1lbnQnLFxuXHRcdFx0XHQnICovJyxcblx0XHRcdFx0J2Z1bmN0aW9uIGhlbGxvKCkge30nXG5cdFx0XHRdLFxuXHRcdFx0RG9jQmxvY2tDb21tZW50TW9kZS5sYW5ndWFnZUlkLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgNSwgMjApLFxuXHRcdFx0W1xuXHRcdFx0XHQnJyxcblx0XHRcdFx0Jy8qKicsXG5cdFx0XHRcdCcgKiBhIGRvYyBjb21tZW50Jyxcblx0XHRcdFx0JyAqLycsXG5cdFx0XHRcdCdmdW5jdGlvbiBoZWxsbygpIHt9J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgNSwgMjApLFxuXHRcdFx0cHJlcGFyZURvY0Jsb2NrQ29tbWVudExhbmd1YWdlXG5cdFx0KTtcblxuXHRcdHRlc3RVbnNoaWZ0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J1xcdCcsXG5cdFx0XHRcdCdcXHQvKionLFxuXHRcdFx0XHQnXFx0ICogYSBkb2MgY29tbWVudCcsXG5cdFx0XHRcdCdcXHQgKi8nLFxuXHRcdFx0XHQnXFx0ZnVuY3Rpb24gaGVsbG8oKSB7fSdcblx0XHRcdF0sXG5cdFx0XHREb2NCbG9ja0NvbW1lbnRNb2RlLmxhbmd1YWdlSWQsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCA1LCAyMSksXG5cdFx0XHRbXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnLyoqJyxcblx0XHRcdFx0JyAqIGEgZG9jIGNvbW1lbnQnLFxuXHRcdFx0XHQnICovJyxcblx0XHRcdFx0J2Z1bmN0aW9uIGhlbGxvKCkge30nXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCA1LCAyMCksXG5cdFx0XHRwcmVwYXJlRG9jQmxvY2tDb21tZW50TGFuZ3VhZ2Vcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTYwOTogV3JvbmcgaW5kZW50YXRpb24gb2YgYmxvY2sgY29tbWVudHMnLCAoKSA9PiB7XG5cdFx0dGVzdFNoaWZ0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcvKionLFxuXHRcdFx0XHQnICogdGVzdCcsXG5cdFx0XHRcdCcgKicsXG5cdFx0XHRcdCcgKiBAdHlwZSB7bnVtYmVyfScsXG5cdFx0XHRcdCcgKi8nLFxuXHRcdFx0XHQndmFyIGZvbyA9IDA7J1xuXHRcdFx0XSxcblx0XHRcdERvY0Jsb2NrQ29tbWVudE1vZGUubGFuZ3VhZ2VJZCxcblx0XHRcdHRydWUsXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDcsIDEzKSxcblx0XHRcdFtcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdcXHQvKionLFxuXHRcdFx0XHQnXFx0ICogdGVzdCcsXG5cdFx0XHRcdCdcXHQgKicsXG5cdFx0XHRcdCdcXHQgKiBAdHlwZSB7bnVtYmVyfScsXG5cdFx0XHRcdCdcXHQgKi8nLFxuXHRcdFx0XHQnXFx0dmFyIGZvbyA9IDA7J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgNywgMTQpLFxuXHRcdFx0cHJlcGFyZURvY0Jsb2NrQ29tbWVudExhbmd1YWdlXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE2MjA6IGEpIExpbmUgaW5kZW50IGRvZXNuXFwndCBoYW5kbGUgbGVhZGluZyB3aGl0ZXNwYWNlIHByb3Blcmx5JywgKCkgPT4ge1xuXHRcdHRlc3RDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnICAgV3JpdHRlbiB8IE51bWVyaWMnLFxuXHRcdFx0XHQnICAgICAgIG9uZSB8IDEnLFxuXHRcdFx0XHQnICAgICAgIHR3byB8IDInLFxuXHRcdFx0XHQnICAgICB0aHJlZSB8IDMnLFxuXHRcdFx0XHQnICAgICAgZm91ciB8IDQnLFxuXHRcdFx0XHQnICAgICAgZml2ZSB8IDUnLFxuXHRcdFx0XHQnICAgICAgIHNpeCB8IDYnLFxuXHRcdFx0XHQnICAgICBzZXZlbiB8IDcnLFxuXHRcdFx0XHQnICAgICBlaWdodCB8IDgnLFxuXHRcdFx0XHQnICAgICAgbmluZSB8IDknLFxuXHRcdFx0XHQnICAgICAgIHRlbiB8IDEwJyxcblx0XHRcdFx0JyAgICBlbGV2ZW4gfCAxMScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XSxcblx0XHRcdG51bGwsXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEzLCAxKSxcblx0XHRcdChhY2Nlc3Nvciwgc2VsKSA9PiBuZXcgU2hpZnRDb21tYW5kKHNlbCwge1xuXHRcdFx0XHRpc1Vuc2hpZnQ6IGZhbHNlLFxuXHRcdFx0XHR0YWJTaXplOiA0LFxuXHRcdFx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdFx0XHRpbnNlcnRTcGFjZXM6IHRydWUsXG5cdFx0XHRcdHVzZVRhYlN0b3BzOiBmYWxzZSxcblx0XHRcdFx0YXV0b0luZGVudDogRWRpdG9yQXV0b0luZGVudFN0cmF0ZWd5LkZ1bGwsXG5cdFx0XHR9LCBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpKSxcblx0XHRcdFtcblx0XHRcdFx0JyAgICAgICBXcml0dGVuIHwgTnVtZXJpYycsXG5cdFx0XHRcdCcgICAgICAgICAgIG9uZSB8IDEnLFxuXHRcdFx0XHQnICAgICAgICAgICB0d28gfCAyJyxcblx0XHRcdFx0JyAgICAgICAgIHRocmVlIHwgMycsXG5cdFx0XHRcdCcgICAgICAgICAgZm91ciB8IDQnLFxuXHRcdFx0XHQnICAgICAgICAgIGZpdmUgfCA1Jyxcblx0XHRcdFx0JyAgICAgICAgICAgc2l4IHwgNicsXG5cdFx0XHRcdCcgICAgICAgICBzZXZlbiB8IDcnLFxuXHRcdFx0XHQnICAgICAgICAgZWlnaHQgfCA4Jyxcblx0XHRcdFx0JyAgICAgICAgICBuaW5lIHwgOScsXG5cdFx0XHRcdCcgICAgICAgICAgIHRlbiB8IDEwJyxcblx0XHRcdFx0JyAgICAgICAgZWxldmVuIHwgMTEnLFxuXHRcdFx0XHQnJyxcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEzLCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxNjIwOiBiKSBMaW5lIGluZGVudCBkb2VzblxcJ3QgaGFuZGxlIGxlYWRpbmcgd2hpdGVzcGFjZSBwcm9wZXJseScsICgpID0+IHtcblx0XHR0ZXN0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0JyAgICAgICBXcml0dGVuIHwgTnVtZXJpYycsXG5cdFx0XHRcdCcgICAgICAgICAgIG9uZSB8IDEnLFxuXHRcdFx0XHQnICAgICAgICAgICB0d28gfCAyJyxcblx0XHRcdFx0JyAgICAgICAgIHRocmVlIHwgMycsXG5cdFx0XHRcdCcgICAgICAgICAgZm91ciB8IDQnLFxuXHRcdFx0XHQnICAgICAgICAgIGZpdmUgfCA1Jyxcblx0XHRcdFx0JyAgICAgICAgICAgc2l4IHwgNicsXG5cdFx0XHRcdCcgICAgICAgICBzZXZlbiB8IDcnLFxuXHRcdFx0XHQnICAgICAgICAgZWlnaHQgfCA4Jyxcblx0XHRcdFx0JyAgICAgICAgICBuaW5lIHwgOScsXG5cdFx0XHRcdCcgICAgICAgICAgIHRlbiB8IDEwJyxcblx0XHRcdFx0JyAgICAgICAgZWxldmVuIHwgMTEnLFxuXHRcdFx0XHQnJyxcblx0XHRcdF0sXG5cdFx0XHRudWxsLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxMywgMSksXG5cdFx0XHQoYWNjZXNzb3IsIHNlbCkgPT4gbmV3IFNoaWZ0Q29tbWFuZChzZWwsIHtcblx0XHRcdFx0aXNVbnNoaWZ0OiB0cnVlLFxuXHRcdFx0XHR0YWJTaXplOiA0LFxuXHRcdFx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdFx0XHRpbnNlcnRTcGFjZXM6IHRydWUsXG5cdFx0XHRcdHVzZVRhYlN0b3BzOiBmYWxzZSxcblx0XHRcdFx0YXV0b0luZGVudDogRWRpdG9yQXV0b0luZGVudFN0cmF0ZWd5LkZ1bGwsXG5cdFx0XHR9LCBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpKSxcblx0XHRcdFtcblx0XHRcdFx0JyAgIFdyaXR0ZW4gfCBOdW1lcmljJyxcblx0XHRcdFx0JyAgICAgICBvbmUgfCAxJyxcblx0XHRcdFx0JyAgICAgICB0d28gfCAyJyxcblx0XHRcdFx0JyAgICAgdGhyZWUgfCAzJyxcblx0XHRcdFx0JyAgICAgIGZvdXIgfCA0Jyxcblx0XHRcdFx0JyAgICAgIGZpdmUgfCA1Jyxcblx0XHRcdFx0JyAgICAgICBzaXggfCA2Jyxcblx0XHRcdFx0JyAgICAgc2V2ZW4gfCA3Jyxcblx0XHRcdFx0JyAgICAgZWlnaHQgfCA4Jyxcblx0XHRcdFx0JyAgICAgIG5pbmUgfCA5Jyxcblx0XHRcdFx0JyAgICAgICB0ZW4gfCAxMCcsXG5cdFx0XHRcdCcgICAgZWxldmVuIHwgMTEnLFxuXHRcdFx0XHQnJyxcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEzLCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxNjIwOiBjKSBMaW5lIGluZGVudCBkb2VzblxcJ3QgaGFuZGxlIGxlYWRpbmcgd2hpdGVzcGFjZSBwcm9wZXJseScsICgpID0+IHtcblx0XHR0ZXN0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0JyAgICAgICBXcml0dGVuIHwgTnVtZXJpYycsXG5cdFx0XHRcdCcgICAgICAgICAgIG9uZSB8IDEnLFxuXHRcdFx0XHQnICAgICAgICAgICB0d28gfCAyJyxcblx0XHRcdFx0JyAgICAgICAgIHRocmVlIHwgMycsXG5cdFx0XHRcdCcgICAgICAgICAgZm91ciB8IDQnLFxuXHRcdFx0XHQnICAgICAgICAgIGZpdmUgfCA1Jyxcblx0XHRcdFx0JyAgICAgICAgICAgc2l4IHwgNicsXG5cdFx0XHRcdCcgICAgICAgICBzZXZlbiB8IDcnLFxuXHRcdFx0XHQnICAgICAgICAgZWlnaHQgfCA4Jyxcblx0XHRcdFx0JyAgICAgICAgICBuaW5lIHwgOScsXG5cdFx0XHRcdCcgICAgICAgICAgIHRlbiB8IDEwJyxcblx0XHRcdFx0JyAgICAgICAgZWxldmVuIHwgMTEnLFxuXHRcdFx0XHQnJyxcblx0XHRcdF0sXG5cdFx0XHRudWxsLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxMywgMSksXG5cdFx0XHQoYWNjZXNzb3IsIHNlbCkgPT4gbmV3IFNoaWZ0Q29tbWFuZChzZWwsIHtcblx0XHRcdFx0aXNVbnNoaWZ0OiB0cnVlLFxuXHRcdFx0XHR0YWJTaXplOiA0LFxuXHRcdFx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlLFxuXHRcdFx0XHR1c2VUYWJTdG9wczogZmFsc2UsXG5cdFx0XHRcdGF1dG9JbmRlbnQ6IEVkaXRvckF1dG9JbmRlbnRTdHJhdGVneS5GdWxsLFxuXHRcdFx0fSwgYWNjZXNzb3IuZ2V0KElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSksXG5cdFx0XHRbXG5cdFx0XHRcdCcgICBXcml0dGVuIHwgTnVtZXJpYycsXG5cdFx0XHRcdCcgICAgICAgb25lIHwgMScsXG5cdFx0XHRcdCcgICAgICAgdHdvIHwgMicsXG5cdFx0XHRcdCcgICAgIHRocmVlIHwgMycsXG5cdFx0XHRcdCcgICAgICBmb3VyIHwgNCcsXG5cdFx0XHRcdCcgICAgICBmaXZlIHwgNScsXG5cdFx0XHRcdCcgICAgICAgc2l4IHwgNicsXG5cdFx0XHRcdCcgICAgIHNldmVuIHwgNycsXG5cdFx0XHRcdCcgICAgIGVpZ2h0IHwgOCcsXG5cdFx0XHRcdCcgICAgICBuaW5lIHwgOScsXG5cdFx0XHRcdCcgICAgICAgdGVuIHwgMTAnLFxuXHRcdFx0XHQnICAgIGVsZXZlbiB8IDExJyxcblx0XHRcdFx0JycsXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxMywgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTYyMDogZCkgTGluZSBpbmRlbnQgZG9lc25cXCd0IGhhbmRsZSBsZWFkaW5nIHdoaXRlc3BhY2UgcHJvcGVybHknLCAoKSA9PiB7XG5cdFx0dGVzdENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHQgICBXcml0dGVuIHwgTnVtZXJpYycsXG5cdFx0XHRcdCdcXHQgICAgICAgb25lIHwgMScsXG5cdFx0XHRcdCdcXHQgICAgICAgdHdvIHwgMicsXG5cdFx0XHRcdCdcXHQgICAgIHRocmVlIHwgMycsXG5cdFx0XHRcdCdcXHQgICAgICBmb3VyIHwgNCcsXG5cdFx0XHRcdCdcXHQgICAgICBmaXZlIHwgNScsXG5cdFx0XHRcdCdcXHQgICAgICAgc2l4IHwgNicsXG5cdFx0XHRcdCdcXHQgICAgIHNldmVuIHwgNycsXG5cdFx0XHRcdCdcXHQgICAgIGVpZ2h0IHwgOCcsXG5cdFx0XHRcdCdcXHQgICAgICBuaW5lIHwgOScsXG5cdFx0XHRcdCdcXHQgICAgICAgdGVuIHwgMTAnLFxuXHRcdFx0XHQnXFx0ICAgIGVsZXZlbiB8IDExJyxcblx0XHRcdFx0JycsXG5cdFx0XHRdLFxuXHRcdFx0bnVsbCxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMTMsIDEpLFxuXHRcdFx0KGFjY2Vzc29yLCBzZWwpID0+IG5ldyBTaGlmdENvbW1hbmQoc2VsLCB7XG5cdFx0XHRcdGlzVW5zaGlmdDogdHJ1ZSxcblx0XHRcdFx0dGFiU2l6ZTogNCxcblx0XHRcdFx0aW5kZW50U2l6ZTogNCxcblx0XHRcdFx0aW5zZXJ0U3BhY2VzOiB0cnVlLFxuXHRcdFx0XHR1c2VUYWJTdG9wczogZmFsc2UsXG5cdFx0XHRcdGF1dG9JbmRlbnQ6IEVkaXRvckF1dG9JbmRlbnRTdHJhdGVneS5GdWxsLFxuXHRcdFx0fSwgYWNjZXNzb3IuZ2V0KElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSksXG5cdFx0XHRbXG5cdFx0XHRcdCcgICBXcml0dGVuIHwgTnVtZXJpYycsXG5cdFx0XHRcdCcgICAgICAgb25lIHwgMScsXG5cdFx0XHRcdCcgICAgICAgdHdvIHwgMicsXG5cdFx0XHRcdCcgICAgIHRocmVlIHwgMycsXG5cdFx0XHRcdCcgICAgICBmb3VyIHwgNCcsXG5cdFx0XHRcdCcgICAgICBmaXZlIHwgNScsXG5cdFx0XHRcdCcgICAgICAgc2l4IHwgNicsXG5cdFx0XHRcdCcgICAgIHNldmVuIHwgNycsXG5cdFx0XHRcdCcgICAgIGVpZ2h0IHwgOCcsXG5cdFx0XHRcdCcgICAgICBuaW5lIHwgOScsXG5cdFx0XHRcdCcgICAgICAgdGVuIHwgMTAnLFxuXHRcdFx0XHQnICAgIGVsZXZlbiB8IDExJyxcblx0XHRcdFx0JycsXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxMywgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSBtaWNyb3NvZnQvbW9uYWNvLWVkaXRvciM0NDM6IEluZGVudGF0aW9uIG9mIGEgc2luZ2xlIHJvdyBkZWxldGVzIHNlbGVjdGVkIHRleHQgaW4gc29tZSBjYXNlcycsICgpID0+IHtcblx0XHR0ZXN0Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J0hlbGxvIHdvcmxkIScsXG5cdFx0XHRcdCdhbm90aGVyIGxpbmUnXG5cdFx0XHRdLFxuXHRcdFx0bnVsbCxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMTMpLFxuXHRcdFx0KGFjY2Vzc29yLCBzZWwpID0+IG5ldyBTaGlmdENvbW1hbmQoc2VsLCB7XG5cdFx0XHRcdGlzVW5zaGlmdDogZmFsc2UsXG5cdFx0XHRcdHRhYlNpemU6IDQsXG5cdFx0XHRcdGluZGVudFNpemU6IDQsXG5cdFx0XHRcdGluc2VydFNwYWNlczogZmFsc2UsXG5cdFx0XHRcdHVzZVRhYlN0b3BzOiB0cnVlLFxuXHRcdFx0XHRhdXRvSW5kZW50OiBFZGl0b3JBdXRvSW5kZW50U3RyYXRlZ3kuRnVsbCxcblx0XHRcdH0sIGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSkpLFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0SGVsbG8gd29ybGQhJyxcblx0XHRcdFx0J2Fub3RoZXIgbGluZSdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDE0KVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2J1ZyAjMTY4MTU6U2hpZnQrVGFiIGRvZXNuXFwndCBnbyBiYWNrIHRvIHRhYnN0b3AnLCAoKSA9PiB7XG5cblx0XHRjb25zdCByZXBlYXRTdHIgPSAoc3RyOiBzdHJpbmcsIGNudDogbnVtYmVyKTogc3RyaW5nID0+IHtcblx0XHRcdGxldCByID0gJyc7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNudDsgaSsrKSB7XG5cdFx0XHRcdHIgKz0gc3RyO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHI7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHRlc3RPdXRkZW50ID0gKHRhYlNpemU6IG51bWJlciwgaW5kZW50U2l6ZTogbnVtYmVyLCBpbnNlcnRTcGFjZXM6IGJvb2xlYW4sIGxpbmVUZXh0OiBzdHJpbmcsIGV4cGVjdGVkSW5kZW50czogbnVtYmVyKSA9PiB7XG5cdFx0XHRjb25zdCBvbmVJbmRlbnQgPSBpbnNlcnRTcGFjZXMgPyByZXBlYXRTdHIoJyAnLCBpbmRlbnRTaXplKSA6ICdcXHQnO1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWRJbmRlbnQgPSByZXBlYXRTdHIob25lSW5kZW50LCBleHBlY3RlZEluZGVudHMpO1xuXHRcdFx0aWYgKGxpbmVUZXh0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0X2Fzc2VydFVuc2hpZnRDb21tYW5kKHRhYlNpemUsIGluZGVudFNpemUsIGluc2VydFNwYWNlcywgW2xpbmVUZXh0ICsgJ2FhYSddLCBbY3JlYXRlU2luZ2xlRWRpdE9wKGV4cGVjdGVkSW5kZW50LCAxLCAxLCAxLCBsaW5lVGV4dC5sZW5ndGggKyAxKV0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0X2Fzc2VydFVuc2hpZnRDb21tYW5kKHRhYlNpemUsIGluZGVudFNpemUsIGluc2VydFNwYWNlcywgW2xpbmVUZXh0ICsgJ2FhYSddLCBbXSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IHRlc3RJbmRlbnQgPSAodGFiU2l6ZTogbnVtYmVyLCBpbmRlbnRTaXplOiBudW1iZXIsIGluc2VydFNwYWNlczogYm9vbGVhbiwgbGluZVRleHQ6IHN0cmluZywgZXhwZWN0ZWRJbmRlbnRzOiBudW1iZXIpID0+IHtcblx0XHRcdGNvbnN0IG9uZUluZGVudCA9IGluc2VydFNwYWNlcyA/IHJlcGVhdFN0cignICcsIGluZGVudFNpemUpIDogJ1xcdCc7XG5cdFx0XHRjb25zdCBleHBlY3RlZEluZGVudCA9IHJlcGVhdFN0cihvbmVJbmRlbnQsIGV4cGVjdGVkSW5kZW50cyk7XG5cdFx0XHRfYXNzZXJ0U2hpZnRDb21tYW5kKHRhYlNpemUsIGluZGVudFNpemUsIGluc2VydFNwYWNlcywgW2xpbmVUZXh0ICsgJ2FhYSddLCBbY3JlYXRlU2luZ2xlRWRpdE9wKGV4cGVjdGVkSW5kZW50LCAxLCAxLCAxLCBsaW5lVGV4dC5sZW5ndGggKyAxKV0pO1xuXHRcdH07XG5cblx0XHRjb25zdCB0ZXN0SW5kZW50YXRpb24gPSAodGFiU2l6ZTogbnVtYmVyLCBpbmRlbnRTaXplOiBudW1iZXIsIGxpbmVUZXh0OiBzdHJpbmcsIGV4cGVjdGVkT25PdXRkZW50OiBudW1iZXIsIGV4cGVjdGVkT25JbmRlbnQ6IG51bWJlcikgPT4ge1xuXHRcdFx0dGVzdE91dGRlbnQodGFiU2l6ZSwgaW5kZW50U2l6ZSwgdHJ1ZSwgbGluZVRleHQsIGV4cGVjdGVkT25PdXRkZW50KTtcblx0XHRcdHRlc3RPdXRkZW50KHRhYlNpemUsIGluZGVudFNpemUsIGZhbHNlLCBsaW5lVGV4dCwgZXhwZWN0ZWRPbk91dGRlbnQpO1xuXG5cdFx0XHR0ZXN0SW5kZW50KHRhYlNpemUsIGluZGVudFNpemUsIHRydWUsIGxpbmVUZXh0LCBleHBlY3RlZE9uSW5kZW50KTtcblx0XHRcdHRlc3RJbmRlbnQodGFiU2l6ZSwgaW5kZW50U2l6ZSwgZmFsc2UsIGxpbmVUZXh0LCBleHBlY3RlZE9uSW5kZW50KTtcblx0XHR9O1xuXG5cdFx0Ly8gaW5zZXJ0U3BhY2VzOiB0cnVlXG5cdFx0Ly8gMCA9PiAwXG5cdFx0dGVzdEluZGVudGF0aW9uKDQsIDQsICcnLCAwLCAxKTtcblxuXHRcdC8vIDEgPT4gMFxuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnXFx0JywgMCwgMik7XG5cdFx0dGVzdEluZGVudGF0aW9uKDQsIDQsICcgJywgMCwgMSk7XG5cdFx0dGVzdEluZGVudGF0aW9uKDQsIDQsICcgXFx0JywgMCwgMik7XG5cdFx0dGVzdEluZGVudGF0aW9uKDQsIDQsICcgICcsIDAsIDEpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnICBcXHQnLCAwLCAyKTtcblx0XHR0ZXN0SW5kZW50YXRpb24oNCwgNCwgJyAgICcsIDAsIDEpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnICAgXFx0JywgMCwgMik7XG5cdFx0dGVzdEluZGVudGF0aW9uKDQsIDQsICcgICAgJywgMCwgMik7XG5cblx0XHQvLyAyID0+IDFcblx0XHR0ZXN0SW5kZW50YXRpb24oNCwgNCwgJ1xcdFxcdCcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnXFx0ICcsIDEsIDIpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnXFx0IFxcdCcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnXFx0ICAnLCAxLCAyKTtcblx0XHR0ZXN0SW5kZW50YXRpb24oNCwgNCwgJ1xcdCAgXFx0JywgMSwgMyk7XG5cdFx0dGVzdEluZGVudGF0aW9uKDQsIDQsICdcXHQgICAnLCAxLCAyKTtcblx0XHR0ZXN0SW5kZW50YXRpb24oNCwgNCwgJ1xcdCAgIFxcdCcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnXFx0ICAgICcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnIFxcdFxcdCcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnIFxcdCAnLCAxLCAyKTtcblx0XHR0ZXN0SW5kZW50YXRpb24oNCwgNCwgJyBcXHQgXFx0JywgMSwgMyk7XG5cdFx0dGVzdEluZGVudGF0aW9uKDQsIDQsICcgXFx0ICAnLCAxLCAyKTtcblx0XHR0ZXN0SW5kZW50YXRpb24oNCwgNCwgJyBcXHQgIFxcdCcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnIFxcdCAgICcsIDEsIDIpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnIFxcdCAgIFxcdCcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnIFxcdCAgICAnLCAxLCAzKTtcblx0XHR0ZXN0SW5kZW50YXRpb24oNCwgNCwgJyAgXFx0XFx0JywgMSwgMyk7XG5cdFx0dGVzdEluZGVudGF0aW9uKDQsIDQsICcgIFxcdCAnLCAxLCAyKTtcblx0XHR0ZXN0SW5kZW50YXRpb24oNCwgNCwgJyAgXFx0IFxcdCcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnICBcXHQgICcsIDEsIDIpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnICBcXHQgIFxcdCcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnICBcXHQgICAnLCAxLCAyKTtcblx0XHR0ZXN0SW5kZW50YXRpb24oNCwgNCwgJyAgXFx0ICAgXFx0JywgMSwgMyk7XG5cdFx0dGVzdEluZGVudGF0aW9uKDQsIDQsICcgIFxcdCAgICAnLCAxLCAzKTtcblx0XHR0ZXN0SW5kZW50YXRpb24oNCwgNCwgJyAgIFxcdFxcdCcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnICAgXFx0ICcsIDEsIDIpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnICAgXFx0IFxcdCcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnICAgXFx0ICAnLCAxLCAyKTtcblx0XHR0ZXN0SW5kZW50YXRpb24oNCwgNCwgJyAgIFxcdCAgXFx0JywgMSwgMyk7XG5cdFx0dGVzdEluZGVudGF0aW9uKDQsIDQsICcgICBcXHQgICAnLCAxLCAyKTtcblx0XHR0ZXN0SW5kZW50YXRpb24oNCwgNCwgJyAgIFxcdCAgIFxcdCcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnICAgXFx0ICAgICcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnICAgIFxcdCcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnICAgICAnLCAxLCAyKTtcblx0XHR0ZXN0SW5kZW50YXRpb24oNCwgNCwgJyAgICAgXFx0JywgMSwgMyk7XG5cdFx0dGVzdEluZGVudGF0aW9uKDQsIDQsICcgICAgICAnLCAxLCAyKTtcblx0XHR0ZXN0SW5kZW50YXRpb24oNCwgNCwgJyAgICAgIFxcdCcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnICAgICAgICcsIDEsIDIpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnICAgICAgIFxcdCcsIDEsIDMpO1xuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnICAgICAgICAnLCAxLCAzKTtcblxuXHRcdC8vIDMgPT4gMlxuXHRcdHRlc3RJbmRlbnRhdGlvbig0LCA0LCAnICAgICAgICAgJywgMiwgMyk7XG5cblx0XHRmdW5jdGlvbiBfYXNzZXJ0VW5zaGlmdENvbW1hbmQodGFiU2l6ZTogbnVtYmVyLCBpbmRlbnRTaXplOiBudW1iZXIsIGluc2VydFNwYWNlczogYm9vbGVhbiwgdGV4dDogc3RyaW5nW10sIGV4cGVjdGVkOiBJU2luZ2xlRWRpdE9wZXJhdGlvbltdKTogdm9pZCB7XG5cdFx0XHRyZXR1cm4gd2l0aEVkaXRvck1vZGVsKHRleHQsIChtb2RlbCkgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdFx0XHRjb25zdCBvcCA9IG5ldyBTaGlmdENvbW1hbmQobmV3IFNlbGVjdGlvbigxLCAxLCB0ZXh0Lmxlbmd0aCArIDEsIDEpLCB7XG5cdFx0XHRcdFx0aXNVbnNoaWZ0OiB0cnVlLFxuXHRcdFx0XHRcdHRhYlNpemU6IHRhYlNpemUsXG5cdFx0XHRcdFx0aW5kZW50U2l6ZTogaW5kZW50U2l6ZSxcblx0XHRcdFx0XHRpbnNlcnRTcGFjZXM6IGluc2VydFNwYWNlcyxcblx0XHRcdFx0XHR1c2VUYWJTdG9wczogdHJ1ZSxcblx0XHRcdFx0XHRhdXRvSW5kZW50OiBFZGl0b3JBdXRvSW5kZW50U3RyYXRlZ3kuRnVsbCxcblx0XHRcdFx0fSwgdGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBhY3R1YWwgPSBnZXRFZGl0T3BlcmF0aW9uKG1vZGVsLCBvcCk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCk7XG5cdFx0XHRcdHRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmRpc3Bvc2UoKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIF9hc3NlcnRTaGlmdENvbW1hbmQodGFiU2l6ZTogbnVtYmVyLCBpbmRlbnRTaXplOiBudW1iZXIsIGluc2VydFNwYWNlczogYm9vbGVhbiwgdGV4dDogc3RyaW5nW10sIGV4cGVjdGVkOiBJU2luZ2xlRWRpdE9wZXJhdGlvbltdKTogdm9pZCB7XG5cdFx0XHRyZXR1cm4gd2l0aEVkaXRvck1vZGVsKHRleHQsIChtb2RlbCkgPT4ge1xuXHRcdFx0XHRjb25zdCB0ZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdFx0XHRjb25zdCBvcCA9IG5ldyBTaGlmdENvbW1hbmQobmV3IFNlbGVjdGlvbigxLCAxLCB0ZXh0Lmxlbmd0aCArIDEsIDEpLCB7XG5cdFx0XHRcdFx0aXNVbnNoaWZ0OiBmYWxzZSxcblx0XHRcdFx0XHR0YWJTaXplOiB0YWJTaXplLFxuXHRcdFx0XHRcdGluZGVudFNpemU6IGluZGVudFNpemUsXG5cdFx0XHRcdFx0aW5zZXJ0U3BhY2VzOiBpbnNlcnRTcGFjZXMsXG5cdFx0XHRcdFx0dXNlVGFiU3RvcHM6IHRydWUsXG5cdFx0XHRcdFx0YXV0b0luZGVudDogRWRpdG9yQXV0b0luZGVudFN0cmF0ZWd5LkZ1bGwsXG5cdFx0XHRcdH0sIHRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgYWN0dWFsID0gZ2V0RWRpdE9wZXJhdGlvbihtb2RlbCwgb3ApO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHRcdFx0XHR0ZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5kaXNwb3NlKCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xuXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsa0JBQW1DO0FBQzVDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZ0NBQWdDO0FBRXpDLFNBQVMsYUFBYTtBQUN0QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLGtCQUFrQixtQkFBbUI7QUFDOUMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyx3Q0FBd0M7QUFDakQsU0FBUyx1QkFBdUI7QUFNaEMsU0FBUyxtQkFBbUIsTUFBYyxvQkFBNEIsZ0JBQXdCLHNCQUE4QixvQkFBb0Isa0JBQTBCLGdCQUFzQztBQUMvTSxTQUFPO0FBQUEsSUFDTixPQUFPLElBQUksTUFBTSxxQkFBcUIsaUJBQWlCLG9CQUFvQixjQUFjO0FBQUEsSUFDekY7QUFBQSxJQUNBLGtCQUFrQjtBQUFBLEVBQ25CO0FBQ0Q7QUFFQSxJQUFNLHNCQUFOLGNBQWtDLFdBQVc7QUFBQSxFQUs1QyxZQUNtQixpQkFDYSw4QkFDOUI7QUFDRCxVQUFNO0FBTlAsU0FBZ0IsYUFBYSxvQkFBb0I7QUFPaEQsU0FBSyxVQUFVLGdCQUFnQixpQkFBaUIsRUFBRSxJQUFJLEtBQUssV0FBVyxDQUFDLENBQUM7QUFDeEUsU0FBSyxVQUFVLDZCQUE2QixTQUFTLEtBQUssWUFBWTtBQUFBLE1BQ3JFLFVBQVU7QUFBQSxRQUNULENBQUMsS0FBSyxH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QUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxxQ0FBcUMsTUFBTTtBQUMvQztBQUFBLE1BQ0M7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN4QjtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxJQUN6QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssOEJBQThCLE1BQU07QUFDeEM7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDeEI7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDekI7QUFFQTtBQUFBLE1BQ0M7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN4QjtBQUFBLFFBQ0M7QUFB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
