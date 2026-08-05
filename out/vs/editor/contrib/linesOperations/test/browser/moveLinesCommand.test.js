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
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { EditorAutoIndentStrategy } from "../../../../common/config/editorOptions.js";
import { Selection } from "../../../../common/core/selection.js";
import { ILanguageService } from "../../../../common/languages/language.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { LanguageService } from "../../../../common/services/languageService.js";
import { MoveLinesCommand } from "../../browser/moveLinesCommand.js";
import { testCommand } from "../../../../test/browser/testCommand.js";
import { TestLanguageConfigurationService } from "../../../../test/common/modes/testLanguageConfigurationService.js";
var MoveLinesDirection = /* @__PURE__ */ ((MoveLinesDirection2) => {
  MoveLinesDirection2[MoveLinesDirection2["Up"] = 0] = "Up";
  MoveLinesDirection2[MoveLinesDirection2["Down"] = 1] = "Down";
  return MoveLinesDirection2;
})(MoveLinesDirection || {});
function testMoveLinesDownCommand(lines, selection, expectedLines, expectedSelection, languageConfigurationService) {
  testMoveLinesUpOrDownCommand(1 /* Down */, lines, selection, expectedLines, expectedSelection, languageConfigurationService);
}
function testMoveLinesUpCommand(lines, selection, expectedLines, expectedSelection, languageConfigurationService) {
  testMoveLinesUpOrDownCommand(0 /* Up */, lines, selection, expectedLines, expectedSelection, languageConfigurationService);
}
function testMoveLinesDownWithIndentCommand(languageId, lines, selection, expectedLines, expectedSelection, languageConfigurationService) {
  testMoveLinesUpOrDownWithIndentCommand(1 /* Down */, languageId, lines, selection, expectedLines, expectedSelection, languageConfigurationService);
}
function testMoveLinesUpWithIndentCommand(languageId, lines, selection, expectedLines, expectedSelection, languageConfigurationService) {
  testMoveLinesUpOrDownWithIndentCommand(0 /* Up */, languageId, lines, selection, expectedLines, expectedSelection, languageConfigurationService);
}
function testMoveLinesUpOrDownCommand(direction, lines, selection, expectedLines, expectedSelection, languageConfigurationService) {
  const disposables = new DisposableStore();
  if (!languageConfigurationService) {
    languageConfigurationService = disposables.add(new TestLanguageConfigurationService());
  }
  testCommand(lines, null, selection, (accessor, sel) => new MoveLinesCommand(sel, direction === 0 /* Up */ ? false : true, EditorAutoIndentStrategy.Advanced, languageConfigurationService), expectedLines, expectedSelection);
  disposables.dispose();
}
function testMoveLinesUpOrDownWithIndentCommand(direction, languageId, lines, selection, expectedLines, expectedSelection, languageConfigurationService) {
  const disposables = new DisposableStore();
  if (!languageConfigurationService) {
    languageConfigurationService = disposables.add(new TestLanguageConfigurationService());
  }
  testCommand(lines, languageId, selection, (accessor, sel) => new MoveLinesCommand(sel, direction === 0 /* Up */ ? false : true, EditorAutoIndentStrategy.Full, languageConfigurationService), expectedLines, expectedSelection);
  disposables.dispose();
}
suite("Editor Contrib - Move Lines Command", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("move first up / last down disabled", function() {
    testMoveLinesUpCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 1, 1),
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 1, 1)
    );
    testMoveLinesDownCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(5, 1, 5, 1),
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(5, 1, 5, 1)
    );
  });
  test("move first line down", function() {
    testMoveLinesDownCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 4, 1, 1),
      [
        "second line",
        "first",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 4, 2, 1)
    );
  });
  test("move 2nd line up", function() {
    testMoveLinesUpCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 1, 2, 1),
      [
        "second line",
        "first",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 1, 1)
    );
  });
  test("issue #1322a: move 2nd line up", function() {
    testMoveLinesUpCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 12, 2, 12),
      [
        "second line",
        "first",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 12, 1, 12)
    );
  });
  test("issue #1322b: move last line up", function() {
    testMoveLinesUpCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(5, 6, 5, 6),
      [
        "first",
        "second line",
        "third line",
        "fifth",
        "fourth line"
      ],
      new Selection(4, 6, 4, 6)
    );
  });
  test("issue #1322c: move last line selected up", function() {
    testMoveLinesUpCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(5, 6, 5, 1),
      [
        "first",
        "second line",
        "third line",
        "fifth",
        "fourth line"
      ],
      new Selection(4, 6, 4, 1)
    );
  });
  test("move last line up", function() {
    testMoveLinesUpCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(5, 1, 5, 1),
      [
        "first",
        "second line",
        "third line",
        "fifth",
        "fourth line"
      ],
      new Selection(4, 1, 4, 1)
    );
  });
  test("move 4th line down", function() {
    testMoveLinesDownCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(4, 1, 4, 1),
      [
        "first",
        "second line",
        "third line",
        "fifth",
        "fourth line"
      ],
      new Selection(5, 1, 5, 1)
    );
  });
  test("move multiple lines down", function() {
    testMoveLinesDownCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(4, 4, 2, 2),
      [
        "first",
        "fifth",
        "second line",
        "third line",
        "fourth line"
      ],
      new Selection(5, 4, 3, 2)
    );
  });
  test("invisible selection is ignored", function() {
    testMoveLinesDownCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 1, 1, 1),
      [
        "second line",
        "first",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(3, 1, 2, 1)
    );
  });
});
let IndentRulesMode = class extends Disposable {
  constructor(indentationRules, languageService, languageConfigurationService) {
    super();
    this.languageId = "moveLinesIndentMode";
    this._register(languageService.registerLanguage({ id: this.languageId }));
    this._register(languageConfigurationService.register(this.languageId, {
      indentationRules
    }));
  }
};
IndentRulesMode = __decorateClass([
  __decorateParam(1, ILanguageService),
  __decorateParam(2, ILanguageConfigurationService)
], IndentRulesMode);
suite("Editor contrib - Move Lines Command honors Indentation Rules", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const indentRules = {
    decreaseIndentPattern: /^\s*((?!\S.*\/[*]).*[*]\/\s*)?[})\]]|^\s*(case\b.*|default):\s*(\/\/.*|\/[*].*[*]\/\s*)?$/,
    increaseIndentPattern: /(\{[^}"'`]*|\([^)"']*|\[[^\]"']*|^\s*(\{\}|\(\)|\[\]|(case\b.*|default):))\s*(\/\/.*|\/[*].*[*]\/\s*)?$/,
    indentNextLinePattern: /^\s*(for|while|if|else)\b(?!.*[;{}]\s*(\/\/.*|\/[*].*[*]\/\s*)?$)/,
    unIndentedLinePattern: /^(?!.*([;{}]|\S:)\s*(\/\/.*|\/[*].*[*]\/\s*)?$)(?!.*(\{[^}"']*|\([^)"']*|\[[^\]"']*|^\s*(\{\}|\(\)|\[\]|(case\b.*|default):))\s*(\/\/.*|\/[*].*[*]\/\s*)?$)(?!^\s*((?!\S.*\/[*]).*[*]\/\s*)?[})\]]|^\s*(case\b.*|default):\s*(\/\/.*|\/[*].*[*]\/\s*)?$)(?!^\s*(for|while|if|else)\b(?!.*[;{}]\s*(\/\/.*|\/[*].*[*]\/\s*)?$))/
  };
  test("first line indentation adjust to 0", () => {
    const languageService = new LanguageService();
    const languageConfigurationService = new TestLanguageConfigurationService();
    const mode = new IndentRulesMode(indentRules, languageService, languageConfigurationService);
    testMoveLinesUpWithIndentCommand(
      mode.languageId,
      [
        "class X {",
        "	z = 2",
        "}"
      ],
      new Selection(2, 1, 2, 1),
      [
        "z = 2",
        "class X {",
        "}"
      ],
      new Selection(1, 1, 1, 1),
      languageConfigurationService
    );
    mode.dispose();
    languageService.dispose();
    languageConfigurationService.dispose();
  });
  test("move lines across block", () => {
    const languageService = new LanguageService();
    const languageConfigurationService = new TestLanguageConfigurationService();
    const mode = new IndentRulesMode(indentRules, languageService, languageConfigurationService);
    testMoveLinesDownWithIndentCommand(
      mode.languageId,
      [
        "const value = 2;",
        "const standardLanguageDescriptions = [",
        "    {",
        "        diagnosticSource: 'js',",
        "    }",
        "];"
      ],
      new Selection(1, 1, 1, 1),
      [
        "const standardLanguageDescriptions = [",
        "    const value = 2;",
        "    {",
        "        diagnosticSource: 'js',",
        "    }",
        "];"
      ],
      new Selection(2, 5, 2, 5),
      languageConfigurationService
    );
    mode.dispose();
    languageService.dispose();
    languageConfigurationService.dispose();
  });
  test("move line should still work as before if there is no indentation rules", () => {
    testMoveLinesUpWithIndentCommand(
      null,
      [
        "if (true) {",
        "    var task = new Task(() => {",
        "        var work = 1234;",
        "    });",
        "}"
      ],
      new Selection(3, 1, 3, 1),
      [
        "if (true) {",
        "        var work = 1234;",
        "    var task = new Task(() => {",
        "    });",
        "}"
      ],
      new Selection(2, 1, 2, 1)
    );
  });
});
let EnterRulesMode = class extends Disposable {
  constructor(languageService, languageConfigurationService) {
    super();
    this.languageId = "moveLinesEnterMode";
    this._register(languageService.registerLanguage({ id: this.languageId }));
    this._register(languageConfigurationService.register(this.languageId, {
      indentationRules: {
        decreaseIndentPattern: /^\s*\[$/,
        increaseIndentPattern: /^\s*\]$/
      },
      brackets: [
        ["{", "}"]
      ]
    }));
  }
};
EnterRulesMode = __decorateClass([
  __decorateParam(0, ILanguageService),
  __decorateParam(1, ILanguageConfigurationService)
], EnterRulesMode);
suite("Editor - contrib - Move Lines Command honors onEnter Rules", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("issue #54829. move block across block", () => {
    const languageService = new LanguageService();
    const languageConfigurationService = new TestLanguageConfigurationService();
    const mode = new EnterRulesMode(languageService, languageConfigurationService);
    testMoveLinesDownWithIndentCommand(
      mode.languageId,
      [
        "if (true) {",
        "    if (false) {",
        "        if (1) {",
        "            console.log('b');",
        "        }",
        "        console.log('a');",
        "    }",
        "}"
      ],
      new Selection(3, 9, 5, 10),
      [
        "if (true) {",
        "    if (false) {",
        "        console.log('a');",
        "        if (1) {",
        "            console.log('b');",
        "        }",
        "    }",
        "}"
      ],
      new Selection(4, 9, 6, 10),
      languageConfigurationService
    );
    mode.dispose();
    languageService.dispose();
    languageConfigurationService.dispose();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9saW5lc09wZXJhdGlvbnMvdGVzdC9icm93c2VyL21vdmVMaW5lc0NvbW1hbmQudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBdXRvSW5kZW50U3RyYXRlZ3kgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IEluZGVudGF0aW9uUnVsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE1vdmVMaW5lc0NvbW1hbmQgfSBmcm9tICcuLi8uLi9icm93c2VyL21vdmVMaW5lc0NvbW1hbmQuanMnO1xuaW1wb3J0IHsgdGVzdENvbW1hbmQgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvdGVzdENvbW1hbmQuanMnO1xuaW1wb3J0IHsgVGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi9tb2Rlcy90ZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5cbmNvbnN0IGVudW0gTW92ZUxpbmVzRGlyZWN0aW9uIHtcblx0VXAsXG5cdERvd25cbn1cblxuZnVuY3Rpb24gdGVzdE1vdmVMaW5lc0Rvd25Db21tYW5kKGxpbmVzOiBzdHJpbmdbXSwgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIGV4cGVjdGVkTGluZXM6IHN0cmluZ1tdLCBleHBlY3RlZFNlbGVjdGlvbjogU2VsZWN0aW9uLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlPzogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpOiB2b2lkIHtcblx0dGVzdE1vdmVMaW5lc1VwT3JEb3duQ29tbWFuZChNb3ZlTGluZXNEaXJlY3Rpb24uRG93biwgbGluZXMsIHNlbGVjdGlvbiwgZXhwZWN0ZWRMaW5lcywgZXhwZWN0ZWRTZWxlY3Rpb24sIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xufVxuXG5mdW5jdGlvbiB0ZXN0TW92ZUxpbmVzVXBDb21tYW5kKGxpbmVzOiBzdHJpbmdbXSwgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIGV4cGVjdGVkTGluZXM6IHN0cmluZ1tdLCBleHBlY3RlZFNlbGVjdGlvbjogU2VsZWN0aW9uLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlPzogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpOiB2b2lkIHtcblx0dGVzdE1vdmVMaW5lc1VwT3JEb3duQ29tbWFuZChNb3ZlTGluZXNEaXJlY3Rpb24uVXAsIGxpbmVzLCBzZWxlY3Rpb24sIGV4cGVjdGVkTGluZXMsIGV4cGVjdGVkU2VsZWN0aW9uLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcbn1cblxuZnVuY3Rpb24gdGVzdE1vdmVMaW5lc0Rvd25XaXRoSW5kZW50Q29tbWFuZChsYW5ndWFnZUlkOiBzdHJpbmcsIGxpbmVzOiBzdHJpbmdbXSwgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIGV4cGVjdGVkTGluZXM6IHN0cmluZ1tdLCBleHBlY3RlZFNlbGVjdGlvbjogU2VsZWN0aW9uLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlPzogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpOiB2b2lkIHtcblx0dGVzdE1vdmVMaW5lc1VwT3JEb3duV2l0aEluZGVudENvbW1hbmQoTW92ZUxpbmVzRGlyZWN0aW9uLkRvd24sIGxhbmd1YWdlSWQsIGxpbmVzLCBzZWxlY3Rpb24sIGV4cGVjdGVkTGluZXMsIGV4cGVjdGVkU2VsZWN0aW9uLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcbn1cblxuZnVuY3Rpb24gdGVzdE1vdmVMaW5lc1VwV2l0aEluZGVudENvbW1hbmQobGFuZ3VhZ2VJZDogc3RyaW5nLCBsaW5lczogc3RyaW5nW10sIHNlbGVjdGlvbjogU2VsZWN0aW9uLCBleHBlY3RlZExpbmVzOiBzdHJpbmdbXSwgZXhwZWN0ZWRTZWxlY3Rpb246IFNlbGVjdGlvbiwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZT86IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTogdm9pZCB7XG5cdHRlc3RNb3ZlTGluZXNVcE9yRG93bldpdGhJbmRlbnRDb21tYW5kKE1vdmVMaW5lc0RpcmVjdGlvbi5VcCwgbGFuZ3VhZ2VJZCwgbGluZXMsIHNlbGVjdGlvbiwgZXhwZWN0ZWRMaW5lcywgZXhwZWN0ZWRTZWxlY3Rpb24sIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xufVxuXG5mdW5jdGlvbiB0ZXN0TW92ZUxpbmVzVXBPckRvd25Db21tYW5kKGRpcmVjdGlvbjogTW92ZUxpbmVzRGlyZWN0aW9uLCBsaW5lczogc3RyaW5nW10sIHNlbGVjdGlvbjogU2VsZWN0aW9uLCBleHBlY3RlZExpbmVzOiBzdHJpbmdbXSwgZXhwZWN0ZWRTZWxlY3Rpb246IFNlbGVjdGlvbiwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZT86IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSB7XG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRpZiAoIWxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpIHtcblx0XHRsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpKTtcblx0fVxuXHR0ZXN0Q29tbWFuZChsaW5lcywgbnVsbCwgc2VsZWN0aW9uLCAoYWNjZXNzb3IsIHNlbCkgPT4gbmV3IE1vdmVMaW5lc0NvbW1hbmQoc2VsLCBkaXJlY3Rpb24gPT09IE1vdmVMaW5lc0RpcmVjdGlvbi5VcCA/IGZhbHNlIDogdHJ1ZSwgRWRpdG9yQXV0b0luZGVudFN0cmF0ZWd5LkFkdmFuY2VkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSwgZXhwZWN0ZWRMaW5lcywgZXhwZWN0ZWRTZWxlY3Rpb24pO1xuXHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG59XG5cbmZ1bmN0aW9uIHRlc3RNb3ZlTGluZXNVcE9yRG93bldpdGhJbmRlbnRDb21tYW5kKGRpcmVjdGlvbjogTW92ZUxpbmVzRGlyZWN0aW9uLCBsYW5ndWFnZUlkOiBzdHJpbmcsIGxpbmVzOiBzdHJpbmdbXSwgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIGV4cGVjdGVkTGluZXM6IHN0cmluZ1tdLCBleHBlY3RlZFNlbGVjdGlvbjogU2VsZWN0aW9uLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlPzogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpIHtcblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGlmICghbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSkge1xuXHRcdGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpO1xuXHR9XG5cdHRlc3RDb21tYW5kKGxpbmVzLCBsYW5ndWFnZUlkLCBzZWxlY3Rpb24sIChhY2Nlc3Nvciwgc2VsKSA9PiBuZXcgTW92ZUxpbmVzQ29tbWFuZChzZWwsIGRpcmVjdGlvbiA9PT0gTW92ZUxpbmVzRGlyZWN0aW9uLlVwID8gZmFsc2UgOiB0cnVlLCBFZGl0b3JBdXRvSW5kZW50U3RyYXRlZ3kuRnVsbCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSksIGV4cGVjdGVkTGluZXMsIGV4cGVjdGVkU2VsZWN0aW9uKTtcblx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xufVxuXG5zdWl0ZSgnRWRpdG9yIENvbnRyaWIgLSBNb3ZlIExpbmVzIENvbW1hbmQnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnbW92ZSBmaXJzdCB1cCAvIGxhc3QgZG93biBkaXNhYmxlZCcsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0TW92ZUxpbmVzVXBDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpXG5cdFx0KTtcblxuXHRcdHRlc3RNb3ZlTGluZXNEb3duQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig1LCAxLCA1LCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig1LCAxLCA1LCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgZmlyc3QgbGluZSBkb3duJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RNb3ZlTGluZXNEb3duQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAxLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCA0LCAyLCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgMm5kIGxpbmUgdXAnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdE1vdmVMaW5lc1VwQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMzIyYTogbW92ZSAybmQgbGluZSB1cCcsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0TW92ZUxpbmVzVXBDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEyLCAyLCAxMiksXG5cdFx0XHRbXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMTIsIDEsIDEyKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMzIyYjogbW92ZSBsYXN0IGxpbmUgdXAnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdE1vdmVMaW5lc1VwQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig1LCA2LCA1LCA2KSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig0LCA2LCA0LCA2KVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMzIyYzogbW92ZSBsYXN0IGxpbmUgc2VsZWN0ZWQgdXAnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdE1vdmVMaW5lc1VwQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig1LCA2LCA1LCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig0LCA2LCA0LCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgbGFzdCBsaW5lIHVwJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RNb3ZlTGluZXNVcENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgMSwgNSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgMSwgNCwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIDR0aCBsaW5lIGRvd24nLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdE1vdmVMaW5lc0Rvd25Db21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDEsIDQsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmaWZ0aCcsXG5cdFx0XHRcdCdmb3VydGggbGluZSdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDEsIDUsIDEpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSBtdWx0aXBsZSBsaW5lcyBkb3duJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RNb3ZlTGluZXNEb3duQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig0LCA0LCAyLCAyKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J2ZpZnRoJyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig1LCA0LCAzLCAyKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ludmlzaWJsZSBzZWxlY3Rpb24gaXMgaWdub3JlZCcsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0TW92ZUxpbmVzRG93bkNvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMSwgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMSwgMiwgMSlcblx0XHQpO1xuXHR9KTtcbn0pO1xuXG5jbGFzcyBJbmRlbnRSdWxlc01vZGUgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHVibGljIHJlYWRvbmx5IGxhbmd1YWdlSWQgPSAnbW92ZUxpbmVzSW5kZW50TW9kZSc7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdGluZGVudGF0aW9uUnVsZXM6IEluZGVudGF0aW9uUnVsZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2UoeyBpZDogdGhpcy5sYW5ndWFnZUlkIH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKHRoaXMubGFuZ3VhZ2VJZCwge1xuXHRcdFx0aW5kZW50YXRpb25SdWxlczogaW5kZW50YXRpb25SdWxlc1xuXHRcdH0pKTtcblx0fVxufVxuXG5zdWl0ZSgnRWRpdG9yIGNvbnRyaWIgLSBNb3ZlIExpbmVzIENvbW1hbmQgaG9ub3JzIEluZGVudGF0aW9uIFJ1bGVzJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGNvbnN0IGluZGVudFJ1bGVzID0ge1xuXHRcdGRlY3JlYXNlSW5kZW50UGF0dGVybjogL15cXHMqKCg/IVxcUy4qXFwvWypdKS4qWypdXFwvXFxzKik/W30pXFxdXXxeXFxzKihjYXNlXFxiLip8ZGVmYXVsdCk6XFxzKihcXC9cXC8uKnxcXC9bKl0uKlsqXVxcL1xccyopPyQvLFxuXHRcdGluY3JlYXNlSW5kZW50UGF0dGVybjogLyhcXHtbXn1cIidgXSp8XFwoW14pXCInXSp8XFxbW15cXF1cIiddKnxeXFxzKihcXHtcXH18XFwoXFwpfFxcW1xcXXwoY2FzZVxcYi4qfGRlZmF1bHQpOikpXFxzKihcXC9cXC8uKnxcXC9bKl0uKlsqXVxcL1xccyopPyQvLFxuXHRcdGluZGVudE5leHRMaW5lUGF0dGVybjogL15cXHMqKGZvcnx3aGlsZXxpZnxlbHNlKVxcYig/IS4qWzt7fV1cXHMqKFxcL1xcLy4qfFxcL1sqXS4qWypdXFwvXFxzKik/JCkvLFxuXHRcdHVuSW5kZW50ZWRMaW5lUGF0dGVybjogL14oPyEuKihbO3t9XXxcXFM6KVxccyooXFwvXFwvLip8XFwvWypdLipbKl1cXC9cXHMqKT8kKSg/IS4qKFxce1tefVwiJ10qfFxcKFteKVwiJ10qfFxcW1teXFxdXCInXSp8XlxccyooXFx7XFx9fFxcKFxcKXxcXFtcXF18KGNhc2VcXGIuKnxkZWZhdWx0KTopKVxccyooXFwvXFwvLip8XFwvWypdLipbKl1cXC9cXHMqKT8kKSg/IV5cXHMqKCg/IVxcUy4qXFwvWypdKS4qWypdXFwvXFxzKik/W30pXFxdXXxeXFxzKihjYXNlXFxiLip8ZGVmYXVsdCk6XFxzKihcXC9cXC8uKnxcXC9bKl0uKlsqXVxcL1xccyopPyQpKD8hXlxccyooZm9yfHdoaWxlfGlmfGVsc2UpXFxiKD8hLipbO3t9XVxccyooXFwvXFwvLip8XFwvWypdLipbKl1cXC9cXHMqKT8kKSkvXG5cdH07XG5cblx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzI4NTUyI2lzc3VlY29tbWVudC0zMDc4NjI3OTdcblx0dGVzdCgnZmlyc3QgbGluZSBpbmRlbnRhdGlvbiBhZGp1c3QgdG8gMCcsICgpID0+IHtcblx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBuZXcgTGFuZ3VhZ2VTZXJ2aWNlKCk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdGNvbnN0IG1vZGUgPSBuZXcgSW5kZW50UnVsZXNNb2RlKGluZGVudFJ1bGVzLCBsYW5ndWFnZVNlcnZpY2UsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0dGVzdE1vdmVMaW5lc1VwV2l0aEluZGVudENvbW1hbmQoXG5cdFx0XHRtb2RlLmxhbmd1YWdlSWQsXG5cdFx0XHRbXG5cdFx0XHRcdCdjbGFzcyBYIHsnLFxuXHRcdFx0XHQnXFx0eiA9IDInLFxuXHRcdFx0XHQnfSdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQneiA9IDInLFxuXHRcdFx0XHQnY2xhc3MgWCB7Jyxcblx0XHRcdFx0J30nXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSxcblx0XHRcdGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0XHQpO1xuXG5cdFx0bW9kZS5kaXNwb3NlKCk7XG5cdFx0bGFuZ3VhZ2VTZXJ2aWNlLmRpc3Bvc2UoKTtcblx0XHRsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzI4NTUyI2lzc3VlY29tbWVudC0zMDc4Njc3MTdcblx0dGVzdCgnbW92ZSBsaW5lcyBhY3Jvc3MgYmxvY2snLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VTZXJ2aWNlID0gbmV3IExhbmd1YWdlU2VydmljZSgpO1xuXHRcdGNvbnN0IGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgPSBuZXcgVGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UoKTtcblx0XHRjb25zdCBtb2RlID0gbmV3IEluZGVudFJ1bGVzTW9kZShpbmRlbnRSdWxlcywgbGFuZ3VhZ2VTZXJ2aWNlLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdHRlc3RNb3ZlTGluZXNEb3duV2l0aEluZGVudENvbW1hbmQoXG5cdFx0XHRtb2RlLmxhbmd1YWdlSWQsXG5cdFx0XHRbXG5cdFx0XHRcdCdjb25zdCB2YWx1ZSA9IDI7Jyxcblx0XHRcdFx0J2NvbnN0IHN0YW5kYXJkTGFuZ3VhZ2VEZXNjcmlwdGlvbnMgPSBbJyxcblx0XHRcdFx0JyAgICB7Jyxcblx0XHRcdFx0JyAgICAgICAgZGlhZ25vc3RpY1NvdXJjZTogXFwnanNcXCcsJyxcblx0XHRcdFx0JyAgICB9Jyxcblx0XHRcdFx0J107J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCdjb25zdCBzdGFuZGFyZExhbmd1YWdlRGVzY3JpcHRpb25zID0gWycsXG5cdFx0XHRcdCcgICAgY29uc3QgdmFsdWUgPSAyOycsXG5cdFx0XHRcdCcgICAgeycsXG5cdFx0XHRcdCcgICAgICAgIGRpYWdub3N0aWNTb3VyY2U6IFxcJ2pzXFwnLCcsXG5cdFx0XHRcdCcgICAgfScsXG5cdFx0XHRcdCddOydcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDUsIDIsIDUpLFxuXHRcdFx0bGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZVxuXHRcdCk7XG5cblx0XHRtb2RlLmRpc3Bvc2UoKTtcblx0XHRsYW5ndWFnZVNlcnZpY2UuZGlzcG9zZSgpO1xuXHRcdGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UuZGlzcG9zZSgpO1xuXHR9KTtcblxuXG5cdHRlc3QoJ21vdmUgbGluZSBzaG91bGQgc3RpbGwgd29yayBhcyBiZWZvcmUgaWYgdGhlcmUgaXMgbm8gaW5kZW50YXRpb24gcnVsZXMnLCAoKSA9PiB7XG5cdFx0dGVzdE1vdmVMaW5lc1VwV2l0aEluZGVudENvbW1hbmQoXG5cdFx0XHRudWxsISxcblx0XHRcdFtcblx0XHRcdFx0J2lmICh0cnVlKSB7Jyxcblx0XHRcdFx0JyAgICB2YXIgdGFzayA9IG5ldyBUYXNrKCgpID0+IHsnLFxuXHRcdFx0XHQnICAgICAgICB2YXIgd29yayA9IDEyMzQ7Jyxcblx0XHRcdFx0JyAgICB9KTsnLFxuXHRcdFx0XHQnfSdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDEsIDMsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnaWYgKHRydWUpIHsnLFxuXHRcdFx0XHQnICAgICAgICB2YXIgd29yayA9IDEyMzQ7Jyxcblx0XHRcdFx0JyAgICB2YXIgdGFzayA9IG5ldyBUYXNrKCgpID0+IHsnLFxuXHRcdFx0XHQnICAgIH0pOycsXG5cdFx0XHRcdCd9J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgMSlcblx0XHQpO1xuXHR9KTtcbn0pO1xuXG5jbGFzcyBFbnRlclJ1bGVzTW9kZSBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwdWJsaWMgcmVhZG9ubHkgbGFuZ3VhZ2VJZCA9ICdtb3ZlTGluZXNFbnRlck1vZGUnO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUxhbmd1YWdlU2VydmljZSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2UoeyBpZDogdGhpcy5sYW5ndWFnZUlkIH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKHRoaXMubGFuZ3VhZ2VJZCwge1xuXHRcdFx0aW5kZW50YXRpb25SdWxlczoge1xuXHRcdFx0XHRkZWNyZWFzZUluZGVudFBhdHRlcm46IC9eXFxzKlxcWyQvLFxuXHRcdFx0XHRpbmNyZWFzZUluZGVudFBhdHRlcm46IC9eXFxzKlxcXSQvLFxuXHRcdFx0fSxcblx0XHRcdGJyYWNrZXRzOiBbXG5cdFx0XHRcdFsneycsICd9J11cblx0XHRcdF1cblx0XHR9KSk7XG5cdH1cbn1cblxuc3VpdGUoJ0VkaXRvciAtIGNvbnRyaWIgLSBNb3ZlIExpbmVzIENvbW1hbmQgaG9ub3JzIG9uRW50ZXIgUnVsZXMnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnaXNzdWUgIzU0ODI5LiBtb3ZlIGJsb2NrIGFjcm9zcyBibG9jaycsICgpID0+IHtcblx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBuZXcgTGFuZ3VhZ2VTZXJ2aWNlKCk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdGNvbnN0IG1vZGUgPSBuZXcgRW50ZXJSdWxlc01vZGUobGFuZ3VhZ2VTZXJ2aWNlLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdHRlc3RNb3ZlTGluZXNEb3duV2l0aEluZGVudENvbW1hbmQoXG5cdFx0XHRtb2RlLmxhbmd1YWdlSWQsXG5cblx0XHRcdFtcblx0XHRcdFx0J2lmICh0cnVlKSB7Jyxcblx0XHRcdFx0JyAgICBpZiAoZmFsc2UpIHsnLFxuXHRcdFx0XHQnICAgICAgICBpZiAoMSkgeycsXG5cdFx0XHRcdCcgICAgICAgICAgICBjb25zb2xlLmxvZyhcXCdiXFwnKTsnLFxuXHRcdFx0XHQnICAgICAgICB9Jyxcblx0XHRcdFx0JyAgICAgICAgY29uc29sZS5sb2coXFwnYVxcJyk7Jyxcblx0XHRcdFx0JyAgICB9Jyxcblx0XHRcdFx0J30nXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigzLCA5LCA1LCAxMCksXG5cdFx0XHRbXG5cdFx0XHRcdCdpZiAodHJ1ZSkgeycsXG5cdFx0XHRcdCcgICAgaWYgKGZhbHNlKSB7Jyxcblx0XHRcdFx0JyAgICAgICAgY29uc29sZS5sb2coXFwnYVxcJyk7Jyxcblx0XHRcdFx0JyAgICAgICAgaWYgKDEpIHsnLFxuXHRcdFx0XHQnICAgICAgICAgICAgY29uc29sZS5sb2coXFwnYlxcJyk7Jyxcblx0XHRcdFx0JyAgICAgICAgfScsXG5cdFx0XHRcdCcgICAgfScsXG5cdFx0XHRcdCd9J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgOSwgNiwgMTApLFxuXHRcdFx0bGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZVxuXHRcdCk7XG5cblx0XHRtb2RlLmRpc3Bvc2UoKTtcblx0XHRsYW5ndWFnZVNlcnZpY2UuZGlzcG9zZSgpO1xuXHRcdGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UuZGlzcG9zZSgpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFJQSxTQUFTLFlBQVksdUJBQXVCO0FBQzVDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsd0JBQXdCO0FBRWpDLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsd0NBQXdDO0FBRWpELElBQVcscUJBQVgsa0JBQVdBLHdCQUFYO0FBQ0MsRUFBQUEsd0NBQUE7QUFDQSxFQUFBQSx3Q0FBQTtBQUZVLFNBQUFBO0FBQUEsR0FBQTtBQUtYLFNBQVMseUJBQXlCLE9BQWlCLFdBQXNCLGVBQXlCLG1CQUE4Qiw4QkFBb0U7QUFDbk0sK0JBQTZCLGNBQXlCLE9BQU8sV0FBVyxlQUFlLG1CQUFtQiw0QkFBNEI7QUFDdkk7QUFFQSxTQUFTLHVCQUF1QixPQUFpQixXQUFzQixlQUF5QixtQkFBOEIsOEJBQW9FO0FBQ2pNLCtCQUE2QixZQUF1QixPQUFPLFdBQVcsZUFBZSxtQkFBbUIsNEJBQTRCO0FBQ3JJO0FBRUEsU0FBUyxtQ0FBbUMsWUFBb0IsT0FBaUIsV0FBc0IsZUFBeUIsbUJB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
