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
import { Disposable, DisposableStore, dispose } from "../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { EditOperation } from "../../../common/core/editOperation.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { MetadataConsts } from "../../../common/encodedTokenAttributes.js";
import { EncodedTokenizationResult, TokenizationRegistry } from "../../../common/languages.js";
import { ILanguageService } from "../../../common/languages/language.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { NullState } from "../../../common/languages/nullTokenize.js";
import { InternalModelContentChangeEvent, ModelRawContentChangedEvent, ModelRawFlush, ModelRawLineChanged, ModelRawLinesDeleted, ModelRawLinesInserted } from "../../../common/textModelEvents.js";
import { createModelServices, createTextModel, instantiateTextModel } from "../testTextModel.js";
const LINE1 = "My First Line";
const LINE2 = "		My Second Line";
const LINE3 = "    Third Line";
const LINE4 = "";
const LINE5 = "1";
suite("Editor Model - Model", () => {
  let thisModel;
  setup(() => {
    const text = LINE1 + "\r\n" + LINE2 + "\n" + LINE3 + "\n" + LINE4 + "\r\n" + LINE5;
    thisModel = createTextModel(text);
  });
  teardown(() => {
    thisModel.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("model getValue", () => {
    assert.strictEqual(thisModel.getValue(), "My First Line\n		My Second Line\n    Third Line\n\n1");
  });
  test("model insert empty text", () => {
    thisModel.applyEdits([EditOperation.insert(new Position(1, 1), "")]);
    assert.strictEqual(thisModel.getLineCount(), 5);
    assert.strictEqual(thisModel.getLineContent(1), "My First Line");
  });
  test("model insert text without newline 1", () => {
    thisModel.applyEdits([EditOperation.insert(new Position(1, 1), "foo ")]);
    assert.strictEqual(thisModel.getLineCount(), 5);
    assert.strictEqual(thisModel.getLineContent(1), "foo My First Line");
  });
  test("model insert text without newline 2", () => {
    thisModel.applyEdits([EditOperation.insert(new Position(1, 3), " foo")]);
    assert.strictEqual(thisModel.getLineCount(), 5);
    assert.strictEqual(thisModel.getLineContent(1), "My foo First Line");
  });
  test("model insert text with one newline", () => {
    thisModel.applyEdits([EditOperation.insert(new Position(1, 3), " new line\nNo longer")]);
    assert.strictEqual(thisModel.getLineCount(), 6);
    assert.strictEqual(thisModel.getLineContent(1), "My new line");
    assert.strictEqual(thisModel.getLineContent(2), "No longer First Line");
  });
  test("model insert text with two newlines", () => {
    thisModel.applyEdits([EditOperation.insert(new Position(1, 3), " new line\nOne more line in the middle\nNo longer")]);
    assert.strictEqual(thisModel.getLineCount(), 7);
    assert.strictEqual(thisModel.getLineContent(1), "My new line");
    assert.strictEqual(thisModel.getLineContent(2), "One more line in the middle");
    assert.strictEqual(thisModel.getLineContent(3), "No longer First Line");
  });
  test("model insert text with many newlines", () => {
    thisModel.applyEdits([EditOperation.insert(new Position(1, 3), "\n\n\n\n")]);
    assert.strictEqual(thisModel.getLineCount(), 9);
    assert.strictEqual(thisModel.getLineContent(1), "My");
    assert.strictEqual(thisModel.getLineContent(2), "");
    assert.strictEqual(thisModel.getLineContent(3), "");
    assert.strictEqual(thisModel.getLineContent(4), "");
    assert.strictEqual(thisModel.getLineContent(5), " First Line");
  });
  test("model insert empty text does not trigger eventing", () => {
    const disposable = thisModel.onDidChangeContentOrInjectedText((e) => {
      assert.ok(false, "was not expecting event");
    });
    thisModel.applyEdits([EditOperation.insert(new Position(1, 1), "")]);
    disposable.dispose();
  });
  test("model insert text without newline eventing", () => {
    let e = null;
    const disposable = thisModel.onDidChangeContentOrInjectedText((_e) => {
      if (e !== null || !(_e instanceof InternalModelContentChangeEvent)) {
        assert.fail("Unexpected assertion error");
      }
      e = _e.rawContentChangedEvent;
    });
    thisModel.applyEdits([EditOperation.insert(new Position(1, 1), "foo ")]);
    assert.deepStrictEqual(e, new ModelRawContentChangedEvent(
      [
        new ModelRawLineChanged(1, "foo My First Line", null)
      ],
      2,
      false,
      false
    ));
    disposable.dispose();
  });
  test("model insert text with one newline eventing", () => {
    let e = null;
    const disposable = thisModel.onDidChangeContentOrInjectedText((_e) => {
      if (e !== null || !(_e instanceof InternalModelContentChangeEvent)) {
        assert.fail("Unexpected assertion error");
      }
      e = _e.rawContentChangedEvent;
    });
    thisModel.applyEdits([EditOperation.insert(new Position(1, 3), " new line\nNo longer")]);
    assert.deepStrictEqual(e, new ModelRawContentChangedEvent(
      [
        new ModelRawLineChanged(1, "My new line", null),
        new ModelRawLinesInserted(2, 2, ["No longer First Line"], [null])
      ],
      2,
      false,
      false
    ));
    disposable.dispose();
  });
  test("model delete empty text", () => {
    thisModel.applyEdits([EditOperation.delete(new Range(1, 1, 1, 1))]);
    assert.strictEqual(thisModel.getLineCount(), 5);
    assert.strictEqual(thisModel.getLineContent(1), "My First Line");
  });
  test("model delete text from one line", () => {
    thisModel.applyEdits([EditOperation.delete(new Range(1, 1, 1, 2))]);
    assert.strictEqual(thisModel.getLineCount(), 5);
    assert.strictEqual(thisModel.getLineContent(1), "y First Line");
  });
  test("model delete text from one line 2", () => {
    thisModel.applyEdits([EditOperation.insert(new Position(1, 1), "a")]);
    assert.strictEqual(thisModel.getLineContent(1), "aMy First Line");
    thisModel.applyEdits([EditOperation.delete(new Range(1, 2, 1, 4))]);
    assert.strictEqual(thisModel.getLineCount(), 5);
    assert.strictEqual(thisModel.getLineContent(1), "a First Line");
  });
  test("model delete all text from a line", () => {
    thisModel.applyEdits([EditOperation.delete(new Range(1, 1, 1, 14))]);
    assert.strictEqual(thisModel.getLineCount(), 5);
    assert.strictEqual(thisModel.getLineContent(1), "");
  });
  test("model delete text from two lines", () => {
    thisModel.applyEdits([EditOperation.delete(new Range(1, 4, 2, 6))]);
    assert.strictEqual(thisModel.getLineCount(), 4);
    assert.strictEqual(thisModel.getLineContent(1), "My Second Line");
  });
  test("model delete text from many lines", () => {
    thisModel.applyEdits([EditOperation.delete(new Range(1, 4, 3, 5))]);
    assert.strictEqual(thisModel.getLineCount(), 3);
    assert.strictEqual(thisModel.getLineContent(1), "My Third Line");
  });
  test("model delete everything", () => {
    thisModel.applyEdits([EditOperation.delete(new Range(1, 1, 5, 2))]);
    assert.strictEqual(thisModel.getLineCount(), 1);
    assert.strictEqual(thisModel.getLineContent(1), "");
  });
  test("model delete empty text does not trigger eventing", () => {
    const disposable = thisModel.onDidChangeContentOrInjectedText((e) => {
      assert.ok(false, "was not expecting event");
    });
    thisModel.applyEdits([EditOperation.delete(new Range(1, 1, 1, 1))]);
    disposable.dispose();
  });
  test("model delete text from one line eventing", () => {
    let e = null;
    const disposable = thisModel.onDidChangeContentOrInjectedText((_e) => {
      if (e !== null || !(_e instanceof InternalModelContentChangeEvent)) {
        assert.fail("Unexpected assertion error");
      }
      e = _e.rawContentChangedEvent;
    });
    thisModel.applyEdits([EditOperation.delete(new Range(1, 1, 1, 2))]);
    assert.deepStrictEqual(e, new ModelRawContentChangedEvent(
      [
        new ModelRawLineChanged(1, "y First Line", null)
      ],
      2,
      false,
      false
    ));
    disposable.dispose();
  });
  test("model delete all text from a line eventing", () => {
    let e = null;
    const disposable = thisModel.onDidChangeContentOrInjectedText((_e) => {
      if (e !== null || !(_e instanceof InternalModelContentChangeEvent)) {
        assert.fail("Unexpected assertion error");
      }
      e = _e.rawContentChangedEvent;
    });
    thisModel.applyEdits([EditOperation.delete(new Range(1, 1, 1, 14))]);
    assert.deepStrictEqual(e, new ModelRawContentChangedEvent(
      [
        new ModelRawLineChanged(1, "", null)
      ],
      2,
      false,
      false
    ));
    disposable.dispose();
  });
  test("model delete text from two lines eventing", () => {
    let e = null;
    const disposable = thisModel.onDidChangeContentOrInjectedText((_e) => {
      if (e !== null || !(_e instanceof InternalModelContentChangeEvent)) {
        assert.fail("Unexpected assertion error");
      }
      e = _e.rawContentChangedEvent;
    });
    thisModel.applyEdits([EditOperation.delete(new Range(1, 4, 2, 6))]);
    assert.deepStrictEqual(e, new ModelRawContentChangedEvent(
      [
        new ModelRawLineChanged(1, "My Second Line", null),
        new ModelRawLinesDeleted(2, 2)
      ],
      2,
      false,
      false
    ));
    disposable.dispose();
  });
  test("model delete text from many lines eventing", () => {
    let e = null;
    const disposable = thisModel.onDidChangeContentOrInjectedText((_e) => {
      if (e !== null || !(_e instanceof InternalModelContentChangeEvent)) {
        assert.fail("Unexpected assertion error");
      }
      e = _e.rawContentChangedEvent;
    });
    thisModel.applyEdits([EditOperation.delete(new Range(1, 4, 3, 5))]);
    assert.deepStrictEqual(e, new ModelRawContentChangedEvent(
      [
        new ModelRawLineChanged(1, "My Third Line", null),
        new ModelRawLinesDeleted(2, 3)
      ],
      2,
      false,
      false
    ));
    disposable.dispose();
  });
  test("getValueInRange", () => {
    assert.strictEqual(thisModel.getValueInRange(new Range(1, 1, 1, 1)), "");
    assert.strictEqual(thisModel.getValueInRange(new Range(1, 1, 1, 2)), "M");
    assert.strictEqual(thisModel.getValueInRange(new Range(1, 2, 1, 3)), "y");
    assert.strictEqual(thisModel.getValueInRange(new Range(1, 1, 1, 14)), "My First Line");
    assert.strictEqual(thisModel.getValueInRange(new Range(1, 1, 2, 1)), "My First Line\n");
    assert.strictEqual(thisModel.getValueInRange(new Range(1, 1, 2, 2)), "My First Line\n	");
    assert.strictEqual(thisModel.getValueInRange(new Range(1, 1, 2, 3)), "My First Line\n		");
    assert.strictEqual(thisModel.getValueInRange(new Range(1, 1, 2, 17)), "My First Line\n		My Second Line");
    assert.strictEqual(thisModel.getValueInRange(new Range(1, 1, 3, 1)), "My First Line\n		My Second Line\n");
    assert.strictEqual(thisModel.getValueInRange(new Range(1, 1, 4, 1)), "My First Line\n		My Second Line\n    Third Line\n");
  });
  test("getValueLengthInRange", () => {
    assert.strictEqual(thisModel.getValueLengthInRange(new Range(1, 1, 1, 1)), "".length);
    assert.strictEqual(thisModel.getValueLengthInRange(new Range(1, 1, 1, 2)), "M".length);
    assert.strictEqual(thisModel.getValueLengthInRange(new Range(1, 2, 1, 3)), "y".length);
    assert.strictEqual(thisModel.getValueLengthInRange(new Range(1, 1, 1, 14)), "My First Line".length);
    assert.strictEqual(thisModel.getValueLengthInRange(new Range(1, 1, 2, 1)), "My First Line\n".length);
    assert.strictEqual(thisModel.getValueLengthInRange(new Range(1, 1, 2, 2)), "My First Line\n	".length);
    assert.strictEqual(thisModel.getValueLengthInRange(new Range(1, 1, 2, 3)), "My First Line\n		".length);
    assert.strictEqual(thisModel.getValueLengthInRange(new Range(1, 1, 2, 17)), "My First Line\n		My Second Line".length);
    assert.strictEqual(thisModel.getValueLengthInRange(new Range(1, 1, 3, 1)), "My First Line\n		My Second Line\n".length);
    assert.strictEqual(thisModel.getValueLengthInRange(new Range(1, 1, 4, 1)), "My First Line\n		My Second Line\n    Third Line\n".length);
  });
  test("setValue eventing", () => {
    let e = null;
    const disposable = thisModel.onDidChangeContentOrInjectedText((_e) => {
      if (e !== null || !(_e instanceof InternalModelContentChangeEvent)) {
        assert.fail("Unexpected assertion error");
      }
      e = _e.rawContentChangedEvent;
    });
    thisModel.setValue("new value");
    assert.deepStrictEqual(e, new ModelRawContentChangedEvent(
      [
        new ModelRawFlush()
      ],
      2,
      false,
      false
    ));
    disposable.dispose();
  });
  test("issue #46342: Maintain edit operation order in applyEdits", () => {
    const res = thisModel.applyEdits([
      { range: new Range(2, 1, 2, 1), text: "a" },
      { range: new Range(1, 1, 1, 1), text: "b" }
    ], true);
    assert.deepStrictEqual(res[0].range, new Range(2, 1, 2, 2));
    assert.deepStrictEqual(res[1].range, new Range(1, 1, 1, 2));
  });
});
suite("Editor Model - Model Line Separators", () => {
  let thisModel;
  setup(() => {
    const text = LINE1 + "\u2028" + LINE2 + "\n" + LINE3 + "\u2028" + LINE4 + "\r\n" + LINE5;
    thisModel = createTextModel(text);
  });
  teardown(() => {
    thisModel.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("model getValue", () => {
    assert.strictEqual(thisModel.getValue(), "My First Line\u2028		My Second Line\n    Third Line\u2028\n1");
  });
  test("model lines", () => {
    assert.strictEqual(thisModel.getLineCount(), 3);
  });
  test("Bug 13333:Model should line break on lonely CR too", () => {
    const model = createTextModel("Hello\rWorld!\r\nAnother line");
    assert.strictEqual(model.getLineCount(), 3);
    assert.strictEqual(model.getValue(), "Hello\r\nWorld!\r\nAnother line");
    model.dispose();
  });
});
suite("Editor Model - Words", () => {
  const OUTER_LANGUAGE_ID = "outerMode";
  const INNER_LANGUAGE_ID = "innerMode";
  let OuterMode = class extends Disposable {
    constructor(languageService, languageConfigurationService) {
      super();
      this.languageId = OUTER_LANGUAGE_ID;
      this._register(languageService.registerLanguage({ id: this.languageId }));
      this._register(languageConfigurationService.register(this.languageId, {}));
      const languageIdCodec = languageService.languageIdCodec;
      this._register(TokenizationRegistry.register(this.languageId, {
        getInitialState: () => NullState,
        tokenize: void 0,
        tokenizeEncoded: (line, hasEOL, state) => {
          const tokensArr = [];
          let prevLanguageId = void 0;
          for (let i = 0; i < line.length; i++) {
            const languageId = line.charAt(i) === "x" ? INNER_LANGUAGE_ID : OUTER_LANGUAGE_ID;
            const encodedLanguageId = languageIdCodec.encodeLanguageId(languageId);
            if (prevLanguageId !== languageId) {
              tokensArr.push(i);
              tokensArr.push(encodedLanguageId << MetadataConsts.LANGUAGEID_OFFSET);
            }
            prevLanguageId = languageId;
          }
          const tokens = new Uint32Array(tokensArr.length);
          for (let i = 0; i < tokens.length; i++) {
            tokens[i] = tokensArr[i];
          }
          return new EncodedTokenizationResult(tokens, state);
        }
      }));
    }
  };
  OuterMode = __decorateClass([
    __decorateParam(0, ILanguageService),
    __decorateParam(1, ILanguageConfigurationService)
  ], OuterMode);
  let InnerMode = class extends Disposable {
    constructor(languageService, languageConfigurationService) {
      super();
      this.languageId = INNER_LANGUAGE_ID;
      this._register(languageService.registerLanguage({ id: this.languageId }));
      this._register(languageConfigurationService.register(this.languageId, {}));
    }
  };
  InnerMode = __decorateClass([
    __decorateParam(0, ILanguageService),
    __decorateParam(1, ILanguageConfigurationService)
  ], InnerMode);
  let disposables = [];
  setup(() => {
    disposables = [];
  });
  teardown(() => {
    dispose(disposables);
    disposables = [];
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Get word at position", () => {
    const text = ["This text has some  words. "];
    const thisModel = createTextModel(text.join("\n"));
    disposables.push(thisModel);
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 1)), { word: "This", startColumn: 1, endColumn: 5 });
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 2)), { word: "This", startColumn: 1, endColumn: 5 });
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 4)), { word: "This", startColumn: 1, endColumn: 5 });
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 5)), { word: "This", startColumn: 1, endColumn: 5 });
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 6)), { word: "text", startColumn: 6, endColumn: 10 });
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 19)), { word: "some", startColumn: 15, endColumn: 19 });
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 20)), null);
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 21)), { word: "words", startColumn: 21, endColumn: 26 });
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 26)), { word: "words", startColumn: 21, endColumn: 26 });
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 27)), null);
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 28)), null);
  });
  test("getWordAtPosition at embedded language boundaries", () => {
    const disposables2 = new DisposableStore();
    const instantiationService = createModelServices(disposables2);
    const outerMode = disposables2.add(instantiationService.createInstance(OuterMode));
    disposables2.add(instantiationService.createInstance(InnerMode));
    const model = disposables2.add(instantiateTextModel(instantiationService, "ab<xx>ab<x>", outerMode.languageId));
    assert.deepStrictEqual(model.getWordAtPosition(new Position(1, 1)), { word: "ab", startColumn: 1, endColumn: 3 });
    assert.deepStrictEqual(model.getWordAtPosition(new Position(1, 2)), { word: "ab", startColumn: 1, endColumn: 3 });
    assert.deepStrictEqual(model.getWordAtPosition(new Position(1, 3)), { word: "ab", startColumn: 1, endColumn: 3 });
    assert.deepStrictEqual(model.getWordAtPosition(new Position(1, 4)), { word: "xx", startColumn: 4, endColumn: 6 });
    assert.deepStrictEqual(model.getWordAtPosition(new Position(1, 5)), { word: "xx", startColumn: 4, endColumn: 6 });
    assert.deepStrictEqual(model.getWordAtPosition(new Position(1, 6)), { word: "xx", startColumn: 4, endColumn: 6 });
    assert.deepStrictEqual(model.getWordAtPosition(new Position(1, 7)), { word: "ab", startColumn: 7, endColumn: 9 });
    disposables2.dispose();
  });
  test("issue #61296: VS code freezes when editing CSS file with emoji", () => {
    const MODE_ID = "testMode";
    const disposables2 = new DisposableStore();
    const instantiationService = createModelServices(disposables2);
    const languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
    const languageService = instantiationService.get(ILanguageService);
    disposables2.add(languageService.registerLanguage({ id: MODE_ID }));
    disposables2.add(languageConfigurationService.register(MODE_ID, {
      wordPattern: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g
    }));
    const thisModel = disposables2.add(instantiateTextModel(instantiationService, ".\u{1F437}-a-b", MODE_ID));
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 1)), { word: ".", startColumn: 1, endColumn: 2 });
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 2)), { word: ".", startColumn: 1, endColumn: 2 });
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 3)), null);
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 4)), { word: "-a-b", startColumn: 4, endColumn: 8 });
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 5)), { word: "-a-b", startColumn: 4, endColumn: 8 });
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 6)), { word: "-a-b", startColumn: 4, endColumn: 8 });
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 7)), { word: "-a-b", startColumn: 4, endColumn: 8 });
    assert.deepStrictEqual(thisModel.getWordAtPosition(new Position(1, 8)), { word: "-a-b", startColumn: 4, endColumn: 8 });
    disposables2.dispose();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZWwvbW9kZWwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9lZGl0T3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBNZXRhZGF0YUNvbnN0cyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lbmNvZGVkVG9rZW5BdHRyaWJ1dGVzLmpzJztcbmltcG9ydCB7IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQsIElTdGF0ZSwgVG9rZW5pemF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBOdWxsU3RhdGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL251bGxUb2tlbml6ZS5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IEludGVybmFsTW9kZWxDb250ZW50Q2hhbmdlRXZlbnQsIE1vZGVsUmF3Q29udGVudENoYW5nZWRFdmVudCwgTW9kZWxSYXdGbHVzaCwgTW9kZWxSYXdMaW5lQ2hhbmdlZCwgTW9kZWxSYXdMaW5lc0RlbGV0ZWQsIE1vZGVsUmF3TGluZXNJbnNlcnRlZCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi90ZXh0TW9kZWxFdmVudHMuanMnO1xuaW1wb3J0IHsgY3JlYXRlTW9kZWxTZXJ2aWNlcywgY3JlYXRlVGV4dE1vZGVsLCBpbnN0YW50aWF0ZVRleHRNb2RlbCB9IGZyb20gJy4uL3Rlc3RUZXh0TW9kZWwuanMnO1xuXG4vLyAtLS0tLS0tLS0gdXRpbHNcblxuY29uc3QgTElORTEgPSAnTXkgRmlyc3QgTGluZSc7XG5jb25zdCBMSU5FMiA9ICdcXHRcXHRNeSBTZWNvbmQgTGluZSc7XG5jb25zdCBMSU5FMyA9ICcgICAgVGhpcmQgTGluZSc7XG5jb25zdCBMSU5FNCA9ICcnO1xuY29uc3QgTElORTUgPSAnMSc7XG5cbnN1aXRlKCdFZGl0b3IgTW9kZWwgLSBNb2RlbCcsICgpID0+IHtcblxuXHRsZXQgdGhpc01vZGVsOiBUZXh0TW9kZWw7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGNvbnN0IHRleHQgPVxuXHRcdFx0TElORTEgKyAnXFxyXFxuJyArXG5cdFx0XHRMSU5FMiArICdcXG4nICtcblx0XHRcdExJTkUzICsgJ1xcbicgK1xuXHRcdFx0TElORTQgKyAnXFxyXFxuJyArXG5cdFx0XHRMSU5FNTtcblx0XHR0aGlzTW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwodGV4dCk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHR0aGlzTW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHQvLyAtLS0tLS0tLS0gaW5zZXJ0IHRleHRcblxuXHR0ZXN0KCdtb2RlbCBnZXRWYWx1ZScsICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpc01vZGVsLmdldFZhbHVlKCksICdNeSBGaXJzdCBMaW5lXFxuXFx0XFx0TXkgU2Vjb25kIExpbmVcXG4gICAgVGhpcmQgTGluZVxcblxcbjEnKTtcblx0fSk7XG5cblx0dGVzdCgnbW9kZWwgaW5zZXJ0IGVtcHR5IHRleHQnLCAoKSA9PiB7XG5cdFx0dGhpc01vZGVsLmFwcGx5RWRpdHMoW0VkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigxLCAxKSwgJycpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRMaW5lQ291bnQoKSwgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ015IEZpcnN0IExpbmUnKTtcblx0fSk7XG5cblx0dGVzdCgnbW9kZWwgaW5zZXJ0IHRleHQgd2l0aG91dCBuZXdsaW5lIDEnLCAoKSA9PiB7XG5cdFx0dGhpc01vZGVsLmFwcGx5RWRpdHMoW0VkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigxLCAxKSwgJ2ZvbyAnKV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0TGluZUNvdW50KCksIDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdmb28gTXkgRmlyc3QgTGluZScpO1xuXHR9KTtcblxuXHR0ZXN0KCdtb2RlbCBpbnNlcnQgdGV4dCB3aXRob3V0IG5ld2xpbmUgMicsICgpID0+IHtcblx0XHR0aGlzTW9kZWwuYXBwbHlFZGl0cyhbRWRpdE9wZXJhdGlvbi5pbnNlcnQobmV3IFBvc2l0aW9uKDEsIDMpLCAnIGZvbycpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRMaW5lQ291bnQoKSwgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ015IGZvbyBGaXJzdCBMaW5lJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vZGVsIGluc2VydCB0ZXh0IHdpdGggb25lIG5ld2xpbmUnLCAoKSA9PiB7XG5cdFx0dGhpc01vZGVsLmFwcGx5RWRpdHMoW0VkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigxLCAzKSwgJyBuZXcgbGluZVxcbk5vIGxvbmdlcicpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRMaW5lQ291bnQoKSwgNik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ015IG5ldyBsaW5lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRMaW5lQ29udGVudCgyKSwgJ05vIGxvbmdlciBGaXJzdCBMaW5lJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vZGVsIGluc2VydCB0ZXh0IHdpdGggdHdvIG5ld2xpbmVzJywgKCkgPT4ge1xuXHRcdHRoaXNNb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMSwgMyksICcgbmV3IGxpbmVcXG5PbmUgbW9yZSBsaW5lIGluIHRoZSBtaWRkbGVcXG5ObyBsb25nZXInKV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0TGluZUNvdW50KCksIDcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdNeSBuZXcgbGluZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICdPbmUgbW9yZSBsaW5lIGluIHRoZSBtaWRkbGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpc01vZGVsLmdldExpbmVDb250ZW50KDMpLCAnTm8gbG9uZ2VyIEZpcnN0IExpbmUnKTtcblx0fSk7XG5cblx0dGVzdCgnbW9kZWwgaW5zZXJ0IHRleHQgd2l0aCBtYW55IG5ld2xpbmVzJywgKCkgPT4ge1xuXHRcdHRoaXNNb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmluc2VydChuZXcgUG9zaXRpb24oMSwgMyksICdcXG5cXG5cXG5cXG4nKV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0TGluZUNvdW50KCksIDkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdNeScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0TGluZUNvbnRlbnQoMiksICcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpc01vZGVsLmdldExpbmVDb250ZW50KDMpLCAnJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRMaW5lQ29udGVudCg0KSwgJycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0TGluZUNvbnRlbnQoNSksICcgRmlyc3QgTGluZScpO1xuXHR9KTtcblxuXG5cdC8vIC0tLS0tLS0tLSBpbnNlcnQgdGV4dCBldmVudGluZ1xuXG5cdHRlc3QoJ21vZGVsIGluc2VydCBlbXB0eSB0ZXh0IGRvZXMgbm90IHRyaWdnZXIgZXZlbnRpbmcnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRoaXNNb2RlbC5vbkRpZENoYW5nZUNvbnRlbnRPckluamVjdGVkVGV4dCgoZSkgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKGZhbHNlLCAnd2FzIG5vdCBleHBlY3RpbmcgZXZlbnQnKTtcblx0XHR9KTtcblx0XHR0aGlzTW9kZWwuYXBwbHlFZGl0cyhbRWRpdE9wZXJhdGlvbi5pbnNlcnQobmV3IFBvc2l0aW9uKDEsIDEpLCAnJyldKTtcblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnbW9kZWwgaW5zZXJ0IHRleHQgd2l0aG91dCBuZXdsaW5lIGV2ZW50aW5nJywgKCkgPT4ge1xuXHRcdGxldCBlOiBNb2RlbFJhd0NvbnRlbnRDaGFuZ2VkRXZlbnQgfCBudWxsID0gbnVsbDtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gdGhpc01vZGVsLm9uRGlkQ2hhbmdlQ29udGVudE9ySW5qZWN0ZWRUZXh0KChfZSkgPT4ge1xuXHRcdFx0aWYgKGUgIT09IG51bGwgfHwgIShfZSBpbnN0YW5jZW9mIEludGVybmFsTW9kZWxDb250ZW50Q2hhbmdlRXZlbnQpKSB7XG5cdFx0XHRcdGFzc2VydC5mYWlsKCdVbmV4cGVjdGVkIGFzc2VydGlvbiBlcnJvcicpO1xuXHRcdFx0fVxuXHRcdFx0ZSA9IF9lLnJhd0NvbnRlbnRDaGFuZ2VkRXZlbnQ7XG5cdFx0fSk7XG5cdFx0dGhpc01vZGVsLmFwcGx5RWRpdHMoW0VkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigxLCAxKSwgJ2ZvbyAnKV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZSwgbmV3IE1vZGVsUmF3Q29udGVudENoYW5nZWRFdmVudChcblx0XHRcdFtcblx0XHRcdFx0bmV3IE1vZGVsUmF3TGluZUNoYW5nZWQoMSwgJ2ZvbyBNeSBGaXJzdCBMaW5lJywgbnVsbClcblx0XHRcdF0sXG5cdFx0XHQyLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZVxuXHRcdCkpO1xuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdtb2RlbCBpbnNlcnQgdGV4dCB3aXRoIG9uZSBuZXdsaW5lIGV2ZW50aW5nJywgKCkgPT4ge1xuXHRcdGxldCBlOiBNb2RlbFJhd0NvbnRlbnRDaGFuZ2VkRXZlbnQgfCBudWxsID0gbnVsbDtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gdGhpc01vZGVsLm9uRGlkQ2hhbmdlQ29udGVudE9ySW5qZWN0ZWRUZXh0KChfZSkgPT4ge1xuXHRcdFx0aWYgKGUgIT09IG51bGwgfHwgIShfZSBpbnN0YW5jZW9mIEludGVybmFsTW9kZWxDb250ZW50Q2hhbmdlRXZlbnQpKSB7XG5cdFx0XHRcdGFzc2VydC5mYWlsKCdVbmV4cGVjdGVkIGFzc2VydGlvbiBlcnJvcicpO1xuXHRcdFx0fVxuXHRcdFx0ZSA9IF9lLnJhd0NvbnRlbnRDaGFuZ2VkRXZlbnQ7XG5cdFx0fSk7XG5cdFx0dGhpc01vZGVsLmFwcGx5RWRpdHMoW0VkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigxLCAzKSwgJyBuZXcgbGluZVxcbk5vIGxvbmdlcicpXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlLCBuZXcgTW9kZWxSYXdDb250ZW50Q2hhbmdlZEV2ZW50KFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgTW9kZWxSYXdMaW5lQ2hhbmdlZCgxLCAnTXkgbmV3IGxpbmUnLCBudWxsKSxcblx0XHRcdFx0bmV3IE1vZGVsUmF3TGluZXNJbnNlcnRlZCgyLCAyLCBbJ05vIGxvbmdlciBGaXJzdCBMaW5lJ10sIFtudWxsXSksXG5cdFx0XHRdLFxuXHRcdFx0Mixcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2Vcblx0XHQpKTtcblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblxuXHQvLyAtLS0tLS0tLS0gZGVsZXRlIHRleHRcblxuXHR0ZXN0KCdtb2RlbCBkZWxldGUgZW1wdHkgdGV4dCcsICgpID0+IHtcblx0XHR0aGlzTW9kZWwuYXBwbHlFZGl0cyhbRWRpdE9wZXJhdGlvbi5kZWxldGUobmV3IFJhbmdlKDEsIDEsIDEsIDEpKV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0TGluZUNvdW50KCksIDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdNeSBGaXJzdCBMaW5lJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vZGVsIGRlbGV0ZSB0ZXh0IGZyb20gb25lIGxpbmUnLCAoKSA9PiB7XG5cdFx0dGhpc01vZGVsLmFwcGx5RWRpdHMoW0VkaXRPcGVyYXRpb24uZGVsZXRlKG5ldyBSYW5nZSgxLCAxLCAxLCAyKSldKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpc01vZGVsLmdldExpbmVDb3VudCgpLCA1KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpc01vZGVsLmdldExpbmVDb250ZW50KDEpLCAneSBGaXJzdCBMaW5lJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vZGVsIGRlbGV0ZSB0ZXh0IGZyb20gb25lIGxpbmUgMicsICgpID0+IHtcblx0XHR0aGlzTW9kZWwuYXBwbHlFZGl0cyhbRWRpdE9wZXJhdGlvbi5pbnNlcnQobmV3IFBvc2l0aW9uKDEsIDEpLCAnYScpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ2FNeSBGaXJzdCBMaW5lJyk7XG5cblx0XHR0aGlzTW9kZWwuYXBwbHlFZGl0cyhbRWRpdE9wZXJhdGlvbi5kZWxldGUobmV3IFJhbmdlKDEsIDIsIDEsIDQpKV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0TGluZUNvdW50KCksIDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICdhIEZpcnN0IExpbmUnKTtcblx0fSk7XG5cblx0dGVzdCgnbW9kZWwgZGVsZXRlIGFsbCB0ZXh0IGZyb20gYSBsaW5lJywgKCkgPT4ge1xuXHRcdHRoaXNNb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmRlbGV0ZShuZXcgUmFuZ2UoMSwgMSwgMSwgMTQpKV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0TGluZUNvdW50KCksIDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0TGluZUNvbnRlbnQoMSksICcnKTtcblx0fSk7XG5cblx0dGVzdCgnbW9kZWwgZGVsZXRlIHRleHQgZnJvbSB0d28gbGluZXMnLCAoKSA9PiB7XG5cdFx0dGhpc01vZGVsLmFwcGx5RWRpdHMoW0VkaXRPcGVyYXRpb24uZGVsZXRlKG5ldyBSYW5nZSgxLCA0LCAyLCA2KSldKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpc01vZGVsLmdldExpbmVDb3VudCgpLCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpc01vZGVsLmdldExpbmVDb250ZW50KDEpLCAnTXkgU2Vjb25kIExpbmUnKTtcblx0fSk7XG5cblx0dGVzdCgnbW9kZWwgZGVsZXRlIHRleHQgZnJvbSBtYW55IGxpbmVzJywgKCkgPT4ge1xuXHRcdHRoaXNNb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmRlbGV0ZShuZXcgUmFuZ2UoMSwgNCwgMywgNSkpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRMaW5lQ291bnQoKSwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRMaW5lQ29udGVudCgxKSwgJ015IFRoaXJkIExpbmUnKTtcblx0fSk7XG5cblx0dGVzdCgnbW9kZWwgZGVsZXRlIGV2ZXJ5dGhpbmcnLCAoKSA9PiB7XG5cdFx0dGhpc01vZGVsLmFwcGx5RWRpdHMoW0VkaXRPcGVyYXRpb24uZGVsZXRlKG5ldyBSYW5nZSgxLCAxLCA1LCAyKSldKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpc01vZGVsLmdldExpbmVDb3VudCgpLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpc01vZGVsLmdldExpbmVDb250ZW50KDEpLCAnJyk7XG5cdH0pO1xuXG5cdC8vIC0tLS0tLS0tLSBkZWxldGUgdGV4dCBldmVudGluZ1xuXG5cdHRlc3QoJ21vZGVsIGRlbGV0ZSBlbXB0eSB0ZXh0IGRvZXMgbm90IHRyaWdnZXIgZXZlbnRpbmcnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRoaXNNb2RlbC5vbkRpZENoYW5nZUNvbnRlbnRPckluamVjdGVkVGV4dCgoZSkgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKGZhbHNlLCAnd2FzIG5vdCBleHBlY3RpbmcgZXZlbnQnKTtcblx0XHR9KTtcblx0XHR0aGlzTW9kZWwuYXBwbHlFZGl0cyhbRWRpdE9wZXJhdGlvbi5kZWxldGUobmV3IFJhbmdlKDEsIDEsIDEsIDEpKV0pO1xuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdtb2RlbCBkZWxldGUgdGV4dCBmcm9tIG9uZSBsaW5lIGV2ZW50aW5nJywgKCkgPT4ge1xuXHRcdGxldCBlOiBNb2RlbFJhd0NvbnRlbnRDaGFuZ2VkRXZlbnQgfCBudWxsID0gbnVsbDtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gdGhpc01vZGVsLm9uRGlkQ2hhbmdlQ29udGVudE9ySW5qZWN0ZWRUZXh0KChfZSkgPT4ge1xuXHRcdFx0aWYgKGUgIT09IG51bGwgfHwgIShfZSBpbnN0YW5jZW9mIEludGVybmFsTW9kZWxDb250ZW50Q2hhbmdlRXZlbnQpKSB7XG5cdFx0XHRcdGFzc2VydC5mYWlsKCdVbmV4cGVjdGVkIGFzc2VydGlvbiBlcnJvcicpO1xuXHRcdFx0fVxuXHRcdFx0ZSA9IF9lLnJhd0NvbnRlbnRDaGFuZ2VkRXZlbnQ7XG5cdFx0fSk7XG5cdFx0dGhpc01vZGVsLmFwcGx5RWRpdHMoW0VkaXRPcGVyYXRpb24uZGVsZXRlKG5ldyBSYW5nZSgxLCAxLCAxLCAyKSldKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGUsIG5ldyBNb2RlbFJhd0NvbnRlbnRDaGFuZ2VkRXZlbnQoXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBNb2RlbFJhd0xpbmVDaGFuZ2VkKDEsICd5IEZpcnN0IExpbmUnLCBudWxsKSxcblx0XHRcdF0sXG5cdFx0XHQyLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZVxuXHRcdCkpO1xuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdtb2RlbCBkZWxldGUgYWxsIHRleHQgZnJvbSBhIGxpbmUgZXZlbnRpbmcnLCAoKSA9PiB7XG5cdFx0bGV0IGU6IE1vZGVsUmF3Q29udGVudENoYW5nZWRFdmVudCB8IG51bGwgPSBudWxsO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0aGlzTW9kZWwub25EaWRDaGFuZ2VDb250ZW50T3JJbmplY3RlZFRleHQoKF9lKSA9PiB7XG5cdFx0XHRpZiAoZSAhPT0gbnVsbCB8fCAhKF9lIGluc3RhbmNlb2YgSW50ZXJuYWxNb2RlbENvbnRlbnRDaGFuZ2VFdmVudCkpIHtcblx0XHRcdFx0YXNzZXJ0LmZhaWwoJ1VuZXhwZWN0ZWQgYXNzZXJ0aW9uIGVycm9yJyk7XG5cdFx0XHR9XG5cdFx0XHRlID0gX2UucmF3Q29udGVudENoYW5nZWRFdmVudDtcblx0XHR9KTtcblx0XHR0aGlzTW9kZWwuYXBwbHlFZGl0cyhbRWRpdE9wZXJhdGlvbi5kZWxldGUobmV3IFJhbmdlKDEsIDEsIDEsIDE0KSldKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGUsIG5ldyBNb2RlbFJhd0NvbnRlbnRDaGFuZ2VkRXZlbnQoXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBNb2RlbFJhd0xpbmVDaGFuZ2VkKDEsICcnLCBudWxsKSxcblx0XHRcdF0sXG5cdFx0XHQyLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZVxuXHRcdCkpO1xuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdtb2RlbCBkZWxldGUgdGV4dCBmcm9tIHR3byBsaW5lcyBldmVudGluZycsICgpID0+IHtcblx0XHRsZXQgZTogTW9kZWxSYXdDb250ZW50Q2hhbmdlZEV2ZW50IHwgbnVsbCA9IG51bGw7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRoaXNNb2RlbC5vbkRpZENoYW5nZUNvbnRlbnRPckluamVjdGVkVGV4dCgoX2UpID0+IHtcblx0XHRcdGlmIChlICE9PSBudWxsIHx8ICEoX2UgaW5zdGFuY2VvZiBJbnRlcm5hbE1vZGVsQ29udGVudENoYW5nZUV2ZW50KSkge1xuXHRcdFx0XHRhc3NlcnQuZmFpbCgnVW5leHBlY3RlZCBhc3NlcnRpb24gZXJyb3InKTtcblx0XHRcdH1cblx0XHRcdGUgPSBfZS5yYXdDb250ZW50Q2hhbmdlZEV2ZW50O1xuXHRcdH0pO1xuXHRcdHRoaXNNb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmRlbGV0ZShuZXcgUmFuZ2UoMSwgNCwgMiwgNikpXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlLCBuZXcgTW9kZWxSYXdDb250ZW50Q2hhbmdlZEV2ZW50KFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgTW9kZWxSYXdMaW5lQ2hhbmdlZCgxLCAnTXkgU2Vjb25kIExpbmUnLCBudWxsKSxcblx0XHRcdFx0bmV3IE1vZGVsUmF3TGluZXNEZWxldGVkKDIsIDIpLFxuXHRcdFx0XSxcblx0XHRcdDIsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlXG5cdFx0KSk7XG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vZGVsIGRlbGV0ZSB0ZXh0IGZyb20gbWFueSBsaW5lcyBldmVudGluZycsICgpID0+IHtcblx0XHRsZXQgZTogTW9kZWxSYXdDb250ZW50Q2hhbmdlZEV2ZW50IHwgbnVsbCA9IG51bGw7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRoaXNNb2RlbC5vbkRpZENoYW5nZUNvbnRlbnRPckluamVjdGVkVGV4dCgoX2UpID0+IHtcblx0XHRcdGlmIChlICE9PSBudWxsIHx8ICEoX2UgaW5zdGFuY2VvZiBJbnRlcm5hbE1vZGVsQ29udGVudENoYW5nZUV2ZW50KSkge1xuXHRcdFx0XHRhc3NlcnQuZmFpbCgnVW5leHBlY3RlZCBhc3NlcnRpb24gZXJyb3InKTtcblx0XHRcdH1cblx0XHRcdGUgPSBfZS5yYXdDb250ZW50Q2hhbmdlZEV2ZW50O1xuXHRcdH0pO1xuXHRcdHRoaXNNb2RlbC5hcHBseUVkaXRzKFtFZGl0T3BlcmF0aW9uLmRlbGV0ZShuZXcgUmFuZ2UoMSwgNCwgMywgNSkpXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlLCBuZXcgTW9kZWxSYXdDb250ZW50Q2hhbmdlZEV2ZW50KFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgTW9kZWxSYXdMaW5lQ2hhbmdlZCgxLCAnTXkgVGhpcmQgTGluZScsIG51bGwpLFxuXHRcdFx0XHRuZXcgTW9kZWxSYXdMaW5lc0RlbGV0ZWQoMiwgMyksXG5cdFx0XHRdLFxuXHRcdFx0Mixcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2Vcblx0XHQpKTtcblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0Ly8gLS0tLS0tLS0tIGdldFZhbHVlSW5SYW5nZVxuXG5cdHRlc3QoJ2dldFZhbHVlSW5SYW5nZScsICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpc01vZGVsLmdldFZhbHVlSW5SYW5nZShuZXcgUmFuZ2UoMSwgMSwgMSwgMSkpLCAnJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRWYWx1ZUluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDEsIDIpKSwgJ00nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpc01vZGVsLmdldFZhbHVlSW5SYW5nZShuZXcgUmFuZ2UoMSwgMiwgMSwgMykpLCAneScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0VmFsdWVJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAxLCAxNCkpLCAnTXkgRmlyc3QgTGluZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0VmFsdWVJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAyLCAxKSksICdNeSBGaXJzdCBMaW5lXFxuJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRWYWx1ZUluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDIsIDIpKSwgJ015IEZpcnN0IExpbmVcXG5cXHQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpc01vZGVsLmdldFZhbHVlSW5SYW5nZShuZXcgUmFuZ2UoMSwgMSwgMiwgMykpLCAnTXkgRmlyc3QgTGluZVxcblxcdFxcdCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0VmFsdWVJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAyLCAxNykpLCAnTXkgRmlyc3QgTGluZVxcblxcdFxcdE15IFNlY29uZCBMaW5lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRWYWx1ZUluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDMsIDEpKSwgJ015IEZpcnN0IExpbmVcXG5cXHRcXHRNeSBTZWNvbmQgTGluZVxcbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0VmFsdWVJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCA0LCAxKSksICdNeSBGaXJzdCBMaW5lXFxuXFx0XFx0TXkgU2Vjb25kIExpbmVcXG4gICAgVGhpcmQgTGluZVxcbicpO1xuXHR9KTtcblxuXHQvLyAtLS0tLS0tLS0gZ2V0VmFsdWVMZW5ndGhJblJhbmdlXG5cblx0dGVzdCgnZ2V0VmFsdWVMZW5ndGhJblJhbmdlJywgKCkgPT4ge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAxLCAxKSksICcnLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDEsIDIpKSwgJ00nLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDIsIDEsIDMpKSwgJ3knLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDEsIDE0KSksICdNeSBGaXJzdCBMaW5lJy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAyLCAxKSksICdNeSBGaXJzdCBMaW5lXFxuJy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAyLCAyKSksICdNeSBGaXJzdCBMaW5lXFxuXFx0Jy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAyLCAzKSksICdNeSBGaXJzdCBMaW5lXFxuXFx0XFx0Jy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAyLCAxNykpLCAnTXkgRmlyc3QgTGluZVxcblxcdFxcdE15IFNlY29uZCBMaW5lJy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0VmFsdWVMZW5ndGhJblJhbmdlKG5ldyBSYW5nZSgxLCAxLCAzLCAxKSksICdNeSBGaXJzdCBMaW5lXFxuXFx0XFx0TXkgU2Vjb25kIExpbmVcXG4nLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRWYWx1ZUxlbmd0aEluUmFuZ2UobmV3IFJhbmdlKDEsIDEsIDQsIDEpKSwgJ015IEZpcnN0IExpbmVcXG5cXHRcXHRNeSBTZWNvbmQgTGluZVxcbiAgICBUaGlyZCBMaW5lXFxuJy5sZW5ndGgpO1xuXHR9KTtcblxuXHQvLyAtLS0tLS0tLS0gc2V0VmFsdWVcblx0dGVzdCgnc2V0VmFsdWUgZXZlbnRpbmcnLCAoKSA9PiB7XG5cdFx0bGV0IGU6IE1vZGVsUmF3Q29udGVudENoYW5nZWRFdmVudCB8IG51bGwgPSBudWxsO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0aGlzTW9kZWwub25EaWRDaGFuZ2VDb250ZW50T3JJbmplY3RlZFRleHQoKF9lKSA9PiB7XG5cdFx0XHRpZiAoZSAhPT0gbnVsbCB8fCAhKF9lIGluc3RhbmNlb2YgSW50ZXJuYWxNb2RlbENvbnRlbnRDaGFuZ2VFdmVudCkpIHtcblx0XHRcdFx0YXNzZXJ0LmZhaWwoJ1VuZXhwZWN0ZWQgYXNzZXJ0aW9uIGVycm9yJyk7XG5cdFx0XHR9XG5cdFx0XHRlID0gX2UucmF3Q29udGVudENoYW5nZWRFdmVudDtcblx0XHR9KTtcblx0XHR0aGlzTW9kZWwuc2V0VmFsdWUoJ25ldyB2YWx1ZScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZSwgbmV3IE1vZGVsUmF3Q29udGVudENoYW5nZWRFdmVudChcblx0XHRcdFtcblx0XHRcdFx0bmV3IE1vZGVsUmF3Rmx1c2goKVxuXHRcdFx0XSxcblx0XHRcdDIsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlXG5cdFx0KSk7XG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM0NjM0MjogTWFpbnRhaW4gZWRpdCBvcGVyYXRpb24gb3JkZXIgaW4gYXBwbHlFZGl0cycsICgpID0+IHtcblx0XHRjb25zdCByZXMgPSB0aGlzTW9kZWwuYXBwbHlFZGl0cyhbXG5cdFx0XHR7IHJhbmdlOiBuZXcgUmFuZ2UoMiwgMSwgMiwgMSksIHRleHQ6ICdhJyB9LFxuXHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEpLCB0ZXh0OiAnYicgfSxcblx0XHRdLCB0cnVlKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzWzBdLnJhbmdlLCBuZXcgUmFuZ2UoMiwgMSwgMiwgMikpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzWzFdLnJhbmdlLCBuZXcgUmFuZ2UoMSwgMSwgMSwgMikpO1xuXHR9KTtcbn0pO1xuXG5cbi8vIC0tLS0tLS0tLSBTcGVjaWFsIFVuaWNvZGUgTElORSBTRVBBUkFUT1IgY2hhcmFjdGVyXG5zdWl0ZSgnRWRpdG9yIE1vZGVsIC0gTW9kZWwgTGluZSBTZXBhcmF0b3JzJywgKCkgPT4ge1xuXG5cdGxldCB0aGlzTW9kZWw6IFRleHRNb2RlbDtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0Y29uc3QgdGV4dCA9XG5cdFx0XHRMSU5FMSArICdcXHUyMDI4JyArXG5cdFx0XHRMSU5FMiArICdcXG4nICtcblx0XHRcdExJTkUzICsgJ1xcdTIwMjgnICtcblx0XHRcdExJTkU0ICsgJ1xcclxcbicgK1xuXHRcdFx0TElORTU7XG5cdFx0dGhpc01vZGVsID0gY3JlYXRlVGV4dE1vZGVsKHRleHQpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0dGhpc01vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnbW9kZWwgZ2V0VmFsdWUnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRWYWx1ZSgpLCAnTXkgRmlyc3QgTGluZVxcdTIwMjhcXHRcXHRNeSBTZWNvbmQgTGluZVxcbiAgICBUaGlyZCBMaW5lXFx1MjAyOFxcbjEnKTtcblx0fSk7XG5cblx0dGVzdCgnbW9kZWwgbGluZXMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRMaW5lQ291bnQoKSwgMyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0J1ZyAxMzMzMzpNb2RlbCBzaG91bGQgbGluZSBicmVhayBvbiBsb25lbHkgQ1IgdG9vJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCdIZWxsb1xccldvcmxkIVxcclxcbkFub3RoZXIgbGluZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRMaW5lQ291bnQoKSwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksICdIZWxsb1xcclxcbldvcmxkIVxcclxcbkFub3RoZXIgbGluZScpO1xuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG59KTtcblxuXG4vLyAtLS0tLS0tLS0gV29yZHNcblxuc3VpdGUoJ0VkaXRvciBNb2RlbCAtIFdvcmRzJywgKCkgPT4ge1xuXG5cdGNvbnN0IE9VVEVSX0xBTkdVQUdFX0lEID0gJ291dGVyTW9kZSc7XG5cdGNvbnN0IElOTkVSX0xBTkdVQUdFX0lEID0gJ2lubmVyTW9kZSc7XG5cblx0Y2xhc3MgT3V0ZXJNb2RlIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0XHRwdWJsaWMgcmVhZG9ubHkgbGFuZ3VhZ2VJZCA9IE9VVEVSX0xBTkdVQUdFX0lEO1xuXG5cdFx0Y29uc3RydWN0b3IoXG5cdFx0XHRASUxhbmd1YWdlU2VydmljZSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0XHRASUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0XHQpIHtcblx0XHRcdHN1cGVyKCk7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiB0aGlzLmxhbmd1YWdlSWQgfSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3Rlcih0aGlzLmxhbmd1YWdlSWQsIHt9KSk7XG5cblx0XHRcdGNvbnN0IGxhbmd1YWdlSWRDb2RlYyA9IGxhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWM7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihUb2tlbml6YXRpb25SZWdpc3RyeS5yZWdpc3Rlcih0aGlzLmxhbmd1YWdlSWQsIHtcblx0XHRcdFx0Z2V0SW5pdGlhbFN0YXRlOiAoKTogSVN0YXRlID0+IE51bGxTdGF0ZSxcblx0XHRcdFx0dG9rZW5pemU6IHVuZGVmaW5lZCEsXG5cdFx0XHRcdHRva2VuaXplRW5jb2RlZDogKGxpbmU6IHN0cmluZywgaGFzRU9MOiBib29sZWFuLCBzdGF0ZTogSVN0YXRlKTogRW5jb2RlZFRva2VuaXphdGlvblJlc3VsdCA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgdG9rZW5zQXJyOiBudW1iZXJbXSA9IFtdO1xuXHRcdFx0XHRcdGxldCBwcmV2TGFuZ3VhZ2VJZDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbGluZS5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9IChsaW5lLmNoYXJBdChpKSA9PT0gJ3gnID8gSU5ORVJfTEFOR1VBR0VfSUQgOiBPVVRFUl9MQU5HVUFHRV9JRCk7XG5cdFx0XHRcdFx0XHRjb25zdCBlbmNvZGVkTGFuZ3VhZ2VJZCA9IGxhbmd1YWdlSWRDb2RlYy5lbmNvZGVMYW5ndWFnZUlkKGxhbmd1YWdlSWQpO1xuXHRcdFx0XHRcdFx0aWYgKHByZXZMYW5ndWFnZUlkICE9PSBsYW5ndWFnZUlkKSB7XG5cdFx0XHRcdFx0XHRcdHRva2Vuc0Fyci5wdXNoKGkpO1xuXHRcdFx0XHRcdFx0XHR0b2tlbnNBcnIucHVzaCgoZW5jb2RlZExhbmd1YWdlSWQgPDwgTWV0YWRhdGFDb25zdHMuTEFOR1VBR0VJRF9PRkZTRVQpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHByZXZMYW5ndWFnZUlkID0gbGFuZ3VhZ2VJZDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCB0b2tlbnMgPSBuZXcgVWludDMyQXJyYXkodG9rZW5zQXJyLmxlbmd0aCk7XG5cdFx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0b2tlbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdHRva2Vuc1tpXSA9IHRva2Vuc0FycltpXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0KHRva2Vucywgc3RhdGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0Y2xhc3MgSW5uZXJNb2RlIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0XHRwdWJsaWMgcmVhZG9ubHkgbGFuZ3VhZ2VJZCA9IElOTkVSX0xBTkdVQUdFX0lEO1xuXG5cdFx0Y29uc3RydWN0b3IoXG5cdFx0XHRASUxhbmd1YWdlU2VydmljZSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0XHRASUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0XHQpIHtcblx0XHRcdHN1cGVyKCk7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiB0aGlzLmxhbmd1YWdlSWQgfSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3Rlcih0aGlzLmxhbmd1YWdlSWQsIHt9KSk7XG5cdFx0fVxuXHR9XG5cblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlW10gPSBbXTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMgPSBbXTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2UoZGlzcG9zYWJsZXMpO1xuXHRcdGRpc3Bvc2FibGVzID0gW107XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ0dldCB3b3JkIGF0IHBvc2l0aW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IHRleHQgPSBbJ1RoaXMgdGV4dCBoYXMgc29tZSAgd29yZHMuICddO1xuXHRcdGNvbnN0IHRoaXNNb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCh0ZXh0LmpvaW4oJ1xcbicpKTtcblx0XHRkaXNwb3NhYmxlcy5wdXNoKHRoaXNNb2RlbCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRXb3JkQXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMSkpLCB7IHdvcmQ6ICdUaGlzJywgc3RhcnRDb2x1bW46IDEsIGVuZENvbHVtbjogNSB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRXb3JkQXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMikpLCB7IHdvcmQ6ICdUaGlzJywgc3RhcnRDb2x1bW46IDEsIGVuZENvbHVtbjogNSB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRXb3JkQXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgNCkpLCB7IHdvcmQ6ICdUaGlzJywgc3RhcnRDb2x1bW46IDEsIGVuZENvbHVtbjogNSB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRXb3JkQXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgNSkpLCB7IHdvcmQ6ICdUaGlzJywgc3RhcnRDb2x1bW46IDEsIGVuZENvbHVtbjogNSB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRXb3JkQXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgNikpLCB7IHdvcmQ6ICd0ZXh0Jywgc3RhcnRDb2x1bW46IDYsIGVuZENvbHVtbjogMTAgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDE5KSksIHsgd29yZDogJ3NvbWUnLCBzdGFydENvbHVtbjogMTUsIGVuZENvbHVtbjogMTkgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDIwKSksIG51bGwpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGhpc01vZGVsLmdldFdvcmRBdFBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCAyMSkpLCB7IHdvcmQ6ICd3b3JkcycsIHN0YXJ0Q29sdW1uOiAyMSwgZW5kQ29sdW1uOiAyNiB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRoaXNNb2RlbC5nZXRXb3JkQXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMjYpKSwgeyB3b3JkOiAnd29yZHMnLCBzdGFydENvbHVtbjogMjEsIGVuZENvbHVtbjogMjYgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDI3KSksIG51bGwpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGhpc01vZGVsLmdldFdvcmRBdFBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCAyOCkpLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0V29yZEF0UG9zaXRpb24gYXQgZW1iZWRkZWQgbGFuZ3VhZ2UgYm91bmRhcmllcycsICgpID0+IHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGNyZWF0ZU1vZGVsU2VydmljZXMoZGlzcG9zYWJsZXMpO1xuXHRcdGNvbnN0IG91dGVyTW9kZSA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShPdXRlck1vZGUpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5uZXJNb2RlKSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgJ2FiPHh4PmFiPHg+Jywgb3V0ZXJNb2RlLmxhbmd1YWdlSWQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDEpKSwgeyB3b3JkOiAnYWInLCBzdGFydENvbHVtbjogMSwgZW5kQ29sdW1uOiAzIH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDIpKSwgeyB3b3JkOiAnYWInLCBzdGFydENvbHVtbjogMSwgZW5kQ29sdW1uOiAzIH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDMpKSwgeyB3b3JkOiAnYWInLCBzdGFydENvbHVtbjogMSwgZW5kQ29sdW1uOiAzIH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDQpKSwgeyB3b3JkOiAneHgnLCBzdGFydENvbHVtbjogNCwgZW5kQ29sdW1uOiA2IH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDUpKSwgeyB3b3JkOiAneHgnLCBzdGFydENvbHVtbjogNCwgZW5kQ29sdW1uOiA2IH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDYpKSwgeyB3b3JkOiAneHgnLCBzdGFydENvbHVtbjogNCwgZW5kQ29sdW1uOiA2IH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDcpKSwgeyB3b3JkOiAnYWInLCBzdGFydENvbHVtbjogNywgZW5kQ29sdW1uOiA5IH0pO1xuXG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNjEyOTY6IFZTIGNvZGUgZnJlZXplcyB3aGVuIGVkaXRpbmcgQ1NTIGZpbGUgd2l0aCBlbW9qaScsICgpID0+IHtcblx0XHRjb25zdCBNT0RFX0lEID0gJ3Rlc3RNb2RlJztcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGNyZWF0ZU1vZGVsU2VydmljZXMoZGlzcG9zYWJsZXMpO1xuXHRcdGNvbnN0IGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiBNT0RFX0lEIH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3RlcihNT0RFX0lELCB7XG5cdFx0XHR3b3JkUGF0dGVybjogLygjPy0/XFxkKlxcLlxcZFxcdyolPyl8KDo6P1tcXHctXSooPz1bXix7O10qWyx7XSkpfCgoW0AjLiFdKT9bXFx3LT9dKyU/fFtAIyEuXSkvZ1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHRoaXNNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgJy5cdUQ4M0RcdURDMzctYS1iJywgTU9ERV9JRCkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDEpKSwgeyB3b3JkOiAnLicsIHN0YXJ0Q29sdW1uOiAxLCBlbmRDb2x1bW46IDIgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDIpKSwgeyB3b3JkOiAnLicsIHN0YXJ0Q29sdW1uOiAxLCBlbmRDb2x1bW46IDIgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDMpKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDQpKSwgeyB3b3JkOiAnLWEtYicsIHN0YXJ0Q29sdW1uOiA0LCBlbmRDb2x1bW46IDggfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDUpKSwgeyB3b3JkOiAnLWEtYicsIHN0YXJ0Q29sdW1uOiA0LCBlbmRDb2x1bW46IDggfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDYpKSwgeyB3b3JkOiAnLWEtYicsIHN0YXJ0Q29sdW1uOiA0LCBlbmRDb2x1bW46IDggfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDcpKSwgeyB3b3JkOiAnLWEtYicsIHN0YXJ0Q29sdW1uOiA0LCBlbmRDb2x1bW46IDggfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0aGlzTW9kZWwuZ2V0V29yZEF0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDgpKSwgeyB3b3JkOiAnLWEtYicsIHN0YXJ0Q29sdW1uOiA0LCBlbmRDb2x1bW46IDggfSk7XG5cblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFlBQVksaUJBQWlCLGVBQWU7QUFDckQsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMkJBQW1DLDRCQUE0QjtBQUN4RSxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLGlCQUFpQjtBQUUxQixTQUFTLGlDQUFpQyw2QkFBNkIsZUFBZSxxQkFBcUIsc0JBQXNCLDZCQUE2QjtBQUM5SixTQUFTLHFCQUFxQixpQkFBaUIsNEJBQTRCO0FBSTNFLE1BQU0sUUFBUTtBQUNkLE1BQU0sUUFBUTtBQUNkLE1BQU0sUUFBUTtBQUNkLE1BQU0sUUFBUTtBQUNkLE1BQU0sUUFBUTtBQUVkLE1BQU0sd0JBQXdCLE1BQU07QUFFbkMsTUFBSTtBQUVKLFFBQU0sTUFBTTtBQUNYLFVBQU0sT0FDTCxRQUFRLFNBQ1IsUUFBUSxPQUNSLFFBQVEsT0FDUixRQUFRLFNBQ1I7QUFDRCxnQkFBWSxnQkFBZ0IsSUFBSTtBQUFBLEVBQ2pDLENBQUM7QUFF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
