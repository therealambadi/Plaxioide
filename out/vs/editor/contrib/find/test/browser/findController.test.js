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
import { Delayer } from "../../../../../base/common/async.js";
import * as platform from "../../../../../base/common/platform.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { EditOperation } from "../../../../common/core/editOperation.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { Selection } from "../../../../common/core/selection.js";
import { CommonFindController, FindStartFocusAction, NextMatchFindAction, NextSelectionMatchFindAction, StartFindAction, StartFindReplaceAction, StartFindWithSelectionAction } from "../../browser/findController.js";
import { CONTEXT_FIND_INPUT_FOCUSED } from "../../browser/findModel.js";
import { withAsyncTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IStorageService, InMemoryStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
let TestFindController = class extends CommonFindController {
  constructor(editor, contextKeyService, storageService, clipboardService, notificationService, hoverService) {
    super(editor, contextKeyService, storageService, clipboardService, notificationService, hoverService);
    this.delayUpdateHistory = false;
    this._findInputFocused = CONTEXT_FIND_INPUT_FOCUSED.bindTo(contextKeyService);
    this._updateHistoryDelayer = new Delayer(50);
    this.hasFocus = false;
  }
  async _start(opts) {
    await super._start(opts);
    if (opts.shouldFocus !== FindStartFocusAction.NoFocusChange) {
      this.hasFocus = true;
    }
    const inputFocused = opts.shouldFocus === FindStartFocusAction.FocusFindInput;
    this._findInputFocused.set(inputFocused);
  }
};
TestFindController = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IClipboardService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IHoverService)
], TestFindController);
function fromSelection(slc) {
  return [slc.startLineNumber, slc.startColumn, slc.endLineNumber, slc.endColumn];
}
function executeAction(instantiationService, editor, action, args) {
  return instantiationService.invokeFunction((accessor) => {
    return Promise.resolve(action.runEditorCommand(accessor, editor, args));
  });
}
suite("FindController", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let clipboardState = "";
  const serviceCollection = new ServiceCollection();
  serviceCollection.set(IStorageService, new InMemoryStorageService());
  if (platform.isMacintosh) {
    serviceCollection.set(IClipboardService, {
      readFindText: () => clipboardState,
      writeFindText: (value) => {
        clipboardState = value;
      }
    });
  }
  test('issue #1857: F3, Find Next, acts like "Find Under Cursor"', async () => {
    await withAsyncTestCodeEditor([
      "ABC",
      "ABC",
      "XYZ",
      "ABC"
    ], { serviceCollection }, async (editor, _, instantiationService) => {
      clipboardState = "";
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      const findState = findController.getState();
      const nextMatchFindAction = new NextMatchFindAction();
      await executeAction(instantiationService, editor, StartFindAction);
      findState.change({ searchString: "A" }, true);
      findState.change({ searchString: "AB" }, true);
      findState.change({ searchString: "ABC" }, true);
      assert.deepStrictEqual(fromSelection(editor.getSelection()), [1, 1, 1, 4]);
      findController.closeFindWidget();
      findController.hasFocus = false;
      assert.deepStrictEqual(fromSelection(editor.getSelection()), [1, 1, 1, 4]);
      editor.pushUndoStop();
      editor.executeEdits("test", [EditOperation.delete(new Range(1, 1, 1, 4))]);
      editor.executeEdits("test", [EditOperation.insert(new Position(1, 1), "XYZ")]);
      editor.pushUndoStop();
      assert.strictEqual(editor.getModel().getLineContent(1), "XYZ");
      assert.deepStrictEqual(fromSelection(editor.getSelection()), [1, 4, 1, 4]);
      await nextMatchFindAction.run(null, editor);
      assert.strictEqual(findState.searchString, "ABC");
      assert.strictEqual(findController.hasFocus, false);
      findController.dispose();
    });
  });
  test("issue #3090: F3 does not loop with two matches on a single line", async () => {
    await withAsyncTestCodeEditor([
      "import nls = require('vs/nls');"
    ], { serviceCollection }, async (editor) => {
      clipboardState = "";
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      const nextMatchFindAction = new NextMatchFindAction();
      editor.setPosition({
        lineNumber: 1,
        column: 9
      });
      await nextMatchFindAction.run(null, editor);
      assert.deepStrictEqual(fromSelection(editor.getSelection()), [1, 26, 1, 29]);
      await nextMatchFindAction.run(null, editor);
      assert.deepStrictEqual(fromSelection(editor.getSelection()), [1, 8, 1, 11]);
      findController.dispose();
    });
  });
  test("issue #6149: Auto-escape highlighted text for search and replace regex mode", async () => {
    await withAsyncTestCodeEditor([
      "var x = (3 * 5)",
      "var y = (3 * 5)",
      "var z = (3  * 5)"
    ], { serviceCollection }, async (editor, _, instantiationService) => {
      clipboardState = "";
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      const nextMatchFindAction = new NextMatchFindAction();
      editor.setSelection(new Selection(1, 9, 1, 13));
      findController.toggleRegex();
      await executeAction(instantiationService, editor, StartFindAction);
      await nextMatchFindAction.run(null, editor);
      assert.deepStrictEqual(fromSelection(editor.getSelection()), [2, 9, 2, 13]);
      await nextMatchFindAction.run(null, editor);
      assert.deepStrictEqual(fromSelection(editor.getSelection()), [1, 9, 1, 13]);
      findController.dispose();
    });
  });
  test("issue #41027: Don't replace find input value on replace action if find input is active", async () => {
    await withAsyncTestCodeEditor([
      "test"
    ], { serviceCollection }, async (editor, _, instantiationService) => {
      const testRegexString = "tes.";
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      const nextMatchFindAction = new NextMatchFindAction();
      findController.toggleRegex();
      findController.setSearchString(testRegexString);
      await findController.start({
        forceRevealReplace: false,
        seedSearchStringFromSelection: "none",
        seedSearchStringFromNonEmptySelection: false,
        seedSearchStringFromGlobalClipboard: false,
        shouldFocus: FindStartFocusAction.FocusFindInput,
        shouldAnimate: false,
        updateSearchScope: false,
        loop: true
      });
      await nextMatchFindAction.run(null, editor);
      await executeAction(instantiationService, editor, StartFindReplaceAction);
      assert.strictEqual(findController.getState().searchString, testRegexString);
      findController.dispose();
    });
  });
  test("issue #9043: Clear search scope when find widget is hidden", async () => {
    await withAsyncTestCodeEditor([
      "var x = (3 * 5)",
      "var y = (3 * 5)",
      "var z = (3 * 5)"
    ], { serviceCollection }, async (editor) => {
      clipboardState = "";
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      await findController.start({
        forceRevealReplace: false,
        seedSearchStringFromSelection: "none",
        seedSearchStringFromNonEmptySelection: false,
        seedSearchStringFromGlobalClipboard: false,
        shouldFocus: FindStartFocusAction.NoFocusChange,
        shouldAnimate: false,
        updateSearchScope: false,
        loop: true
      });
      assert.strictEqual(findController.getState().searchScope, null);
      findController.getState().change({
        searchScope: [new Range(1, 1, 1, 5)]
      }, false);
      assert.deepStrictEqual(findController.getState().searchScope, [new Range(1, 1, 1, 5)]);
      findController.closeFindWidget();
      assert.strictEqual(findController.getState().searchScope, null);
    });
  });
  test("issue #18111: Regex replace with single space replaces with no space", async () => {
    await withAsyncTestCodeEditor([
      "HRESULT OnAmbientPropertyChange(DISPID   dispid);"
    ], { serviceCollection }, async (editor, _, instantiationService) => {
      clipboardState = "";
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      await executeAction(instantiationService, editor, StartFindAction);
      findController.getState().change({ searchString: "\\b\\s{3}\\b", replaceString: " ", isRegex: true }, false);
      findController.moveToNextMatch();
      assert.deepStrictEqual(editor.getSelections().map(fromSelection), [
        [1, 39, 1, 42]
      ]);
      findController.replace();
      assert.deepStrictEqual(editor.getValue(), "HRESULT OnAmbientPropertyChange(DISPID dispid);");
      findController.dispose();
    });
  });
  test("issue #24714: Regular expression with ^ in search & replace", async () => {
    await withAsyncTestCodeEditor([
      "",
      "line2",
      "line3"
    ], { serviceCollection }, async (editor, _, instantiationService) => {
      clipboardState = "";
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      await executeAction(instantiationService, editor, StartFindAction);
      findController.getState().change({ searchString: "^", replaceString: "x", isRegex: true }, false);
      findController.moveToNextMatch();
      assert.deepStrictEqual(editor.getSelections().map(fromSelection), [
        [2, 1, 2, 1]
      ]);
      findController.replace();
      assert.deepStrictEqual(editor.getValue(), "\nxline2\nline3");
      findController.dispose();
    });
  });
  test("issue #38232: Find Next Selection, regex enabled", async () => {
    await withAsyncTestCodeEditor([
      "([funny]",
      "",
      "([funny]"
    ], { serviceCollection }, async (editor) => {
      clipboardState = "";
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      const nextSelectionMatchFindAction = new NextSelectionMatchFindAction();
      findController.getState().change({ isRegex: true }, false);
      editor.setSelection(new Selection(1, 1, 1, 9));
      await nextSelectionMatchFindAction.run(null, editor);
      assert.deepStrictEqual(editor.getSelections().map(fromSelection), [
        [3, 1, 3, 9]
      ]);
      findController.dispose();
    });
  });
  test("issue #38232: Find Next Selection, regex enabled, find widget open", async () => {
    await withAsyncTestCodeEditor([
      "([funny]",
      "",
      "([funny]"
    ], { serviceCollection }, async (editor, _, instantiationService) => {
      clipboardState = "";
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      const nextSelectionMatchFindAction = new NextSelectionMatchFindAction();
      await executeAction(instantiationService, editor, StartFindAction);
      findController.getState().change({ isRegex: true }, false);
      editor.setSelection(new Selection(1, 1, 1, 9));
      await nextSelectionMatchFindAction.run(null, editor);
      assert.deepStrictEqual(editor.getSelections().map(fromSelection), [
        [3, 1, 3, 9]
      ]);
      findController.dispose();
    });
  });
  test("issue #47400, CMD+E supports feeding multiple line of text into the find widget", async () => {
    await withAsyncTestCodeEditor([
      "ABC",
      "ABC",
      "XYZ",
      "ABC",
      "ABC"
    ], { serviceCollection }, async (editor, _, instantiationService) => {
      clipboardState = "";
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      editor.setSelection(new Selection(1, 1, 1, 1));
      await executeAction(instantiationService, editor, StartFindAction);
      editor.setSelection(new Selection(1, 1, 2, 4));
      const startFindWithSelectionAction = new StartFindWithSelectionAction();
      await startFindWithSelectionAction.run(null, editor);
      const findState = findController.getState();
      assert.deepStrictEqual(findState.searchString.split(/\r\n|\r|\n/g), ["ABC", "ABC"]);
      editor.setSelection(new Selection(3, 1, 3, 1));
      await startFindWithSelectionAction.run(null, editor);
      findController.dispose();
    });
  });
  test("issue #109756, CMD+E with empty cursor should always work", async () => {
    await withAsyncTestCodeEditor([
      "ABC",
      "ABC",
      "XYZ",
      "ABC",
      "ABC"
    ], { serviceCollection }, async (editor) => {
      clipboardState = "";
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      editor.setSelection(new Selection(1, 2, 1, 2));
      const startFindWithSelectionAction = new StartFindWithSelectionAction();
      startFindWithSelectionAction.run(null, editor);
      const findState = findController.getState();
      assert.deepStrictEqual(findState.searchString, "ABC");
      findController.dispose();
    });
  });
});
suite("FindController query options persistence", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const serviceCollection = new ServiceCollection();
  const storageService = new InMemoryStorageService();
  storageService.store("editor.isRegex", false, StorageScope.WORKSPACE, StorageTarget.USER);
  storageService.store("editor.matchCase", false, StorageScope.WORKSPACE, StorageTarget.USER);
  storageService.store("editor.wholeWord", false, StorageScope.WORKSPACE, StorageTarget.USER);
  serviceCollection.set(IStorageService, storageService);
  test("matchCase", async () => {
    await withAsyncTestCodeEditor([
      "abc",
      "ABC",
      "XYZ",
      "ABC"
    ], { serviceCollection }, async (editor, _, instantiationService) => {
      storageService.store("editor.matchCase", true, StorageScope.WORKSPACE, StorageTarget.USER);
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      const findState = findController.getState();
      await executeAction(instantiationService, editor, StartFindAction);
      findState.change({ searchString: "ABC" }, true);
      assert.deepStrictEqual(fromSelection(editor.getSelection()), [2, 1, 2, 4]);
      findController.dispose();
    });
  });
  storageService.store("editor.matchCase", false, StorageScope.WORKSPACE, StorageTarget.USER);
  storageService.store("editor.wholeWord", true, StorageScope.WORKSPACE, StorageTarget.USER);
  test("wholeWord", async () => {
    await withAsyncTestCodeEditor([
      "ABC",
      "AB",
      "XYZ",
      "ABC"
    ], { serviceCollection }, async (editor, _, instantiationService) => {
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      const findState = findController.getState();
      await executeAction(instantiationService, editor, StartFindAction);
      findState.change({ searchString: "AB" }, true);
      assert.deepStrictEqual(fromSelection(editor.getSelection()), [2, 1, 2, 3]);
      findController.dispose();
    });
  });
  test("toggling options is saved", async () => {
    await withAsyncTestCodeEditor([
      "ABC",
      "AB",
      "XYZ",
      "ABC"
    ], { serviceCollection }, async (editor) => {
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      findController.toggleRegex();
      assert.strictEqual(storageService.getBoolean("editor.isRegex", StorageScope.WORKSPACE), true);
      findController.dispose();
    });
  });
  test("issue #27083: Update search scope once find widget becomes visible", async () => {
    await withAsyncTestCodeEditor([
      "var x = (3 * 5)",
      "var y = (3 * 5)",
      "var z = (3 * 5)"
    ], { serviceCollection, find: { autoFindInSelection: "always", globalFindClipboard: false } }, async (editor) => {
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      const findConfig = {
        forceRevealReplace: false,
        seedSearchStringFromSelection: "none",
        seedSearchStringFromNonEmptySelection: false,
        seedSearchStringFromGlobalClipboard: false,
        shouldFocus: FindStartFocusAction.NoFocusChange,
        shouldAnimate: false,
        updateSearchScope: true,
        loop: true
      };
      editor.setSelection(new Range(1, 1, 2, 1));
      findController.start(findConfig);
      assert.deepStrictEqual(findController.getState().searchScope, [new Selection(1, 1, 2, 1)]);
      findController.closeFindWidget();
      editor.setSelections([new Selection(1, 1, 2, 1), new Selection(2, 1, 2, 5)]);
      findController.start(findConfig);
      assert.deepStrictEqual(findController.getState().searchScope, [new Selection(1, 1, 2, 1), new Selection(2, 1, 2, 5)]);
    });
  });
  test("issue #58604: Do not update searchScope if it is empty", async () => {
    await withAsyncTestCodeEditor([
      "var x = (3 * 5)",
      "var y = (3 * 5)",
      "var z = (3 * 5)"
    ], { serviceCollection, find: { autoFindInSelection: "always", globalFindClipboard: false } }, async (editor) => {
      editor.setSelection(new Range(1, 2, 1, 2));
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      await findController.start({
        forceRevealReplace: false,
        seedSearchStringFromSelection: "none",
        seedSearchStringFromNonEmptySelection: false,
        seedSearchStringFromGlobalClipboard: false,
        shouldFocus: FindStartFocusAction.NoFocusChange,
        shouldAnimate: false,
        updateSearchScope: true,
        loop: true
      });
      assert.deepStrictEqual(findController.getState().searchScope, null);
    });
  });
  test("issue #58604: Update searchScope if it is not empty", async () => {
    await withAsyncTestCodeEditor([
      "var x = (3 * 5)",
      "var y = (3 * 5)",
      "var z = (3 * 5)"
    ], { serviceCollection, find: { autoFindInSelection: "always", globalFindClipboard: false } }, async (editor) => {
      editor.setSelection(new Range(1, 2, 1, 3));
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      await findController.start({
        forceRevealReplace: false,
        seedSearchStringFromSelection: "none",
        seedSearchStringFromNonEmptySelection: false,
        seedSearchStringFromGlobalClipboard: false,
        shouldFocus: FindStartFocusAction.NoFocusChange,
        shouldAnimate: false,
        updateSearchScope: true,
        loop: true
      });
      assert.deepStrictEqual(findController.getState().searchScope, [new Selection(1, 2, 1, 3)]);
    });
  });
  test("issue #27083: Find in selection when multiple lines are selected", async () => {
    await withAsyncTestCodeEditor([
      "var x = (3 * 5)",
      "var y = (3 * 5)",
      "var z = (3 * 5)"
    ], { serviceCollection, find: { autoFindInSelection: "multiline", globalFindClipboard: false } }, async (editor) => {
      editor.setSelection(new Range(1, 6, 2, 1));
      const findController = editor.registerAndInstantiateContribution(TestFindController.ID, TestFindController);
      await findController.start({
        forceRevealReplace: false,
        seedSearchStringFromSelection: "none",
        seedSearchStringFromNonEmptySelection: false,
        seedSearchStringFromGlobalClipboard: false,
        shouldFocus: FindStartFocusAction.NoFocusChange,
        shouldAnimate: false,
        updateSearchScope: true,
        loop: true
      });
      assert.deepStrictEqual(findController.getState().searchScope, [new Selection(1, 6, 2, 1)]);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9maW5kL3Rlc3QvYnJvd3Nlci9maW5kQ29udHJvbGxlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRGVsYXllciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9lZGl0T3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgQ29tbW9uRmluZENvbnRyb2xsZXIsIEZpbmRTdGFydEZvY3VzQWN0aW9uLCBJRmluZFN0YXJ0T3B0aW9ucywgTmV4dE1hdGNoRmluZEFjdGlvbiwgTmV4dFNlbGVjdGlvbk1hdGNoRmluZEFjdGlvbiwgU3RhcnRGaW5kQWN0aW9uLCBTdGFydEZpbmRSZXBsYWNlQWN0aW9uLCBTdGFydEZpbmRXaXRoU2VsZWN0aW9uQWN0aW9uIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9maW5kQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBDT05URVhUX0ZJTkRfSU5QVVRfRk9DVVNFRCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvZmluZE1vZGVsLmpzJztcbmltcG9ydCB7IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3Rlc3RDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgU2VydmljZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgSW5NZW1vcnlTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5cbmNsYXNzIFRlc3RGaW5kQ29udHJvbGxlciBleHRlbmRzIENvbW1vbkZpbmRDb250cm9sbGVyIHtcblxuXHRwdWJsaWMgaGFzRm9jdXM6IGJvb2xlYW47XG5cdHB1YmxpYyBkZWxheVVwZGF0ZUhpc3Rvcnk6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRwcml2YXRlIF9maW5kSW5wdXRGb2N1c2VkOiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElDbGlwYm9hcmRTZXJ2aWNlIGNsaXBib2FyZFNlcnZpY2U6IElDbGlwYm9hcmRTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoZWRpdG9yLCBjb250ZXh0S2V5U2VydmljZSwgc3RvcmFnZVNlcnZpY2UsIGNsaXBib2FyZFNlcnZpY2UsIG5vdGlmaWNhdGlvblNlcnZpY2UsIGhvdmVyU2VydmljZSk7XG5cdFx0dGhpcy5fZmluZElucHV0Rm9jdXNlZCA9IENPTlRFWFRfRklORF9JTlBVVF9GT0NVU0VELmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fdXBkYXRlSGlzdG9yeURlbGF5ZXIgPSBuZXcgRGVsYXllcjx2b2lkPig1MCk7XG5cdFx0dGhpcy5oYXNGb2N1cyA9IGZhbHNlO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFzeW5jIF9zdGFydChvcHRzOiBJRmluZFN0YXJ0T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHN1cGVyLl9zdGFydChvcHRzKTtcblxuXHRcdGlmIChvcHRzLnNob3VsZEZvY3VzICE9PSBGaW5kU3RhcnRGb2N1c0FjdGlvbi5Ob0ZvY3VzQ2hhbmdlKSB7XG5cdFx0XHR0aGlzLmhhc0ZvY3VzID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBpbnB1dEZvY3VzZWQgPSBvcHRzLnNob3VsZEZvY3VzID09PSBGaW5kU3RhcnRGb2N1c0FjdGlvbi5Gb2N1c0ZpbmRJbnB1dDtcblx0XHR0aGlzLl9maW5kSW5wdXRGb2N1c2VkLnNldChpbnB1dEZvY3VzZWQpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGZyb21TZWxlY3Rpb24oc2xjOiBTZWxlY3Rpb24pOiBudW1iZXJbXSB7XG5cdHJldHVybiBbc2xjLnN0YXJ0TGluZU51bWJlciwgc2xjLnN0YXJ0Q29sdW1uLCBzbGMuZW5kTGluZU51bWJlciwgc2xjLmVuZENvbHVtbl07XG59XG5cbmZ1bmN0aW9uIGV4ZWN1dGVBY3Rpb24oaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYWN0aW9uOiBFZGl0b3JBY3Rpb24sIGFyZ3M/OiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcblx0cmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKChhY2Nlc3NvcikgPT4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoYWN0aW9uLnJ1bkVkaXRvckNvbW1hbmQoYWNjZXNzb3IsIGVkaXRvciwgYXJncykpO1xuXHR9KTtcbn1cblxuc3VpdGUoJ0ZpbmRDb250cm9sbGVyJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGxldCBjbGlwYm9hcmRTdGF0ZSA9ICcnO1xuXHRjb25zdCBzZXJ2aWNlQ29sbGVjdGlvbiA9IG5ldyBTZXJ2aWNlQ29sbGVjdGlvbigpO1xuXHRzZXJ2aWNlQ29sbGVjdGlvbi5zZXQoSVN0b3JhZ2VTZXJ2aWNlLCBuZXcgSW5NZW1vcnlTdG9yYWdlU2VydmljZSgpKTtcblxuXHRpZiAocGxhdGZvcm0uaXNNYWNpbnRvc2gpIHtcblx0XHRzZXJ2aWNlQ29sbGVjdGlvbi5zZXQoSUNsaXBib2FyZFNlcnZpY2UsIDxhbnk+e1xuXHRcdFx0cmVhZEZpbmRUZXh0OiAoKSA9PiBjbGlwYm9hcmRTdGF0ZSxcblx0XHRcdHdyaXRlRmluZFRleHQ6ICh2YWx1ZTogYW55KSA9PiB7IGNsaXBib2FyZFN0YXRlID0gdmFsdWU7IH1cblx0XHR9KTtcblx0fVxuXG5cdC8qIHRlc3QoJ3N0b3JlcyB0byB0aGUgZ2xvYmFsIGNsaXBib2FyZCBidWZmZXIgb24gc3RhcnQgZmluZCBhY3Rpb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd2l0aEFzeW5jVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0J0FCQycsXG5cdFx0XHQnQUJDJyxcblx0XHRcdCdYWVonLFxuXHRcdFx0J0FCQydcblx0XHRdLCB7IHNlcnZpY2VDb2xsZWN0aW9uOiBzZXJ2aWNlQ29sbGVjdGlvbiB9LCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdFx0XHRjbGlwYm9hcmRTdGF0ZSA9ICcnO1xuXHRcdFx0aWYgKCFwbGF0Zm9ybS5pc01hY2ludG9zaCkge1xuXHRcdFx0XHRhc3NlcnQub2sodHJ1ZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGxldCBmaW5kQ29udHJvbGxlciA9IGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKFRlc3RGaW5kQ29udHJvbGxlci5JRCwgVGVzdEZpbmRDb250cm9sbGVyKTtcblx0XHRcdGxldCBzdGFydEZpbmRBY3Rpb24gPSBuZXcgU3RhcnRGaW5kQWN0aW9uKCk7XG5cdFx0XHQvLyBJIHNlbGVjdCBBQkMgb24gdGhlIGZpcnN0IGxpbmVcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAxLCA0KSk7XG5cdFx0XHQvLyBJIGhpdCBDdHJsK0YgdG8gc2hvdyB0aGUgRmluZCBkaWFsb2dcblx0XHRcdHN0YXJ0RmluZEFjdGlvbi5ydW4obnVsbCwgZWRpdG9yKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaW5kQ29udHJvbGxlci5nZXRHbG9iYWxCdWZmZXJUZXJtKCksIGZpbmRDb250cm9sbGVyLmdldFN0YXRlKCkuc2VhcmNoU3RyaW5nKTtcblx0XHRcdGZpbmRDb250cm9sbGVyLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgncmVhZHMgZnJvbSB0aGUgZ2xvYmFsIGNsaXBib2FyZCBidWZmZXIgb24gbmV4dCBmaW5kIGFjdGlvbiBpZiBidWZmZXIgZXhpc3RzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCdBQkMnLFxuXHRcdFx0J0FCQycsXG5cdFx0XHQnWFlaJyxcblx0XHRcdCdBQkMnXG5cdFx0XSwgeyBzZXJ2aWNlQ29sbGVjdGlvbjogc2VydmljZUNvbGxlY3Rpb24gfSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdFx0Y2xpcGJvYXJkU3RhdGUgPSAnQUJDJztcblxuXHRcdFx0aWYgKCFwbGF0Zm9ybS5pc01hY2ludG9zaCkge1xuXHRcdFx0XHRhc3NlcnQub2sodHJ1ZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bGV0IGZpbmRDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oVGVzdEZpbmRDb250cm9sbGVyLklELCBUZXN0RmluZENvbnRyb2xsZXIpO1xuXHRcdFx0bGV0IGZpbmRTdGF0ZSA9IGZpbmRDb250cm9sbGVyLmdldFN0YXRlKCk7XG5cdFx0XHRsZXQgbmV4dE1hdGNoRmluZEFjdGlvbiA9IG5ldyBOZXh0TWF0Y2hGaW5kQWN0aW9uKCk7XG5cblx0XHRcdG5leHRNYXRjaEZpbmRBY3Rpb24ucnVuKG51bGwsIGVkaXRvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLnNlYXJjaFN0cmluZywgJ0FCQycpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZyb21TZWxlY3Rpb24oZWRpdG9yLmdldFNlbGVjdGlvbigpISksIFsxLCAxLCAxLCA0XSk7XG5cblx0XHRcdGZpbmRDb250cm9sbGVyLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnd3JpdGVzIHRvIHRoZSBnbG9iYWwgY2xpcGJvYXJkIGJ1ZmZlciB3aGVuIHRleHQgY2hhbmdlcycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnQUJDJyxcblx0XHRcdCdBQkMnLFxuXHRcdFx0J1hZWicsXG5cdFx0XHQnQUJDJ1xuXHRcdF0sIHsgc2VydmljZUNvbGxlY3Rpb246IHNlcnZpY2VDb2xsZWN0aW9uIH0sIGFzeW5jIChlZGl0b3IpID0+IHtcblx0XHRcdGNsaXBib2FyZFN0YXRlID0gJyc7XG5cdFx0XHRpZiAoIXBsYXRmb3JtLmlzTWFjaW50b3NoKSB7XG5cdFx0XHRcdGFzc2VydC5vayh0cnVlKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgZmluZENvbnRyb2xsZXIgPSBlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihUZXN0RmluZENvbnRyb2xsZXIuSUQsIFRlc3RGaW5kQ29udHJvbGxlcik7XG5cdFx0XHRsZXQgZmluZFN0YXRlID0gZmluZENvbnRyb2xsZXIuZ2V0U3RhdGUoKTtcblxuXHRcdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ0FCQycgfSwgdHJ1ZSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmluZENvbnRyb2xsZXIuZ2V0R2xvYmFsQnVmZmVyVGVybSgpLCAnQUJDJyk7XG5cblx0XHRcdGZpbmRDb250cm9sbGVyLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7ICovXG5cblx0dGVzdCgnaXNzdWUgIzE4NTc6IEYzLCBGaW5kIE5leHQsIGFjdHMgbGlrZSBcIkZpbmQgVW5kZXIgQ3Vyc29yXCInLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd2l0aEFzeW5jVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0J0FCQycsXG5cdFx0XHQnQUJDJyxcblx0XHRcdCdYWVonLFxuXHRcdFx0J0FCQydcblx0XHRdLCB7IHNlcnZpY2VDb2xsZWN0aW9uOiBzZXJ2aWNlQ29sbGVjdGlvbiB9LCBhc3luYyAoZWRpdG9yLCBfLCBpbnN0YW50aWF0aW9uU2VydmljZSkgPT4ge1xuXHRcdFx0Y2xpcGJvYXJkU3RhdGUgPSAnJztcblx0XHRcdC8vIFRoZSBjdXJzb3IgaXMgYXQgdGhlIHZlcnkgdG9wLCBvZiB0aGUgZmlsZSwgYXQgdGhlIGZpcnN0IEFCQ1xuXHRcdFx0Y29uc3QgZmluZENvbnRyb2xsZXIgPSBlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihUZXN0RmluZENvbnRyb2xsZXIuSUQsIFRlc3RGaW5kQ29udHJvbGxlcik7XG5cdFx0XHRjb25zdCBmaW5kU3RhdGUgPSBmaW5kQ29udHJvbGxlci5nZXRTdGF0ZSgpO1xuXHRcdFx0Y29uc3QgbmV4dE1hdGNoRmluZEFjdGlvbiA9IG5ldyBOZXh0TWF0Y2hGaW5kQWN0aW9uKCk7XG5cblx0XHRcdC8vIEkgaGl0IEN0cmwrRiB0byBzaG93IHRoZSBGaW5kIGRpYWxvZ1xuXHRcdFx0YXdhaXQgZXhlY3V0ZUFjdGlvbihpbnN0YW50aWF0aW9uU2VydmljZSwgZWRpdG9yLCBTdGFydEZpbmRBY3Rpb24pO1xuXG5cdFx0XHQvLyBJIHR5cGUgQUJDLlxuXHRcdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ0EnIH0sIHRydWUpO1xuXHRcdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ0FCJyB9LCB0cnVlKTtcblx0XHRcdGZpbmRTdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICdBQkMnIH0sIHRydWUpO1xuXG5cdFx0XHQvLyBUaGUgZmlyc3QgQUJDIGlzIGhpZ2hsaWdodGVkLlxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmcm9tU2VsZWN0aW9uKGVkaXRvci5nZXRTZWxlY3Rpb24oKSEpLCBbMSwgMSwgMSwgNF0pO1xuXG5cdFx0XHQvLyBJIGhpdCBFc2MgdG8gZXhpdCB0aGUgRmluZCBkaWFsb2cuXG5cdFx0XHRmaW5kQ29udHJvbGxlci5jbG9zZUZpbmRXaWRnZXQoKTtcblx0XHRcdGZpbmRDb250cm9sbGVyLmhhc0ZvY3VzID0gZmFsc2U7XG5cblx0XHRcdC8vIFRoZSBjdXJzb3IgaXMgbm93IGF0IGVuZCBvZiB0aGUgZmlyc3QgbGluZSwgd2l0aCBBQkMgb24gdGhhdCBsaW5lIGhpZ2hsaWdodGVkLlxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmcm9tU2VsZWN0aW9uKGVkaXRvci5nZXRTZWxlY3Rpb24oKSEpLCBbMSwgMSwgMSwgNF0pO1xuXG5cdFx0XHQvLyBJIGhpdCBkZWxldGUgdG8gcmVtb3ZlIGl0IGFuZCBjaGFuZ2UgdGhlIHRleHQgdG8gWFlaLlxuXHRcdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdFx0ZWRpdG9yLmV4ZWN1dGVFZGl0cygndGVzdCcsIFtFZGl0T3BlcmF0aW9uLmRlbGV0ZShuZXcgUmFuZ2UoMSwgMSwgMSwgNCkpXSk7XG5cdFx0XHRlZGl0b3IuZXhlY3V0ZUVkaXRzKCd0ZXN0JywgW0VkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbigxLCAxKSwgJ1hZWicpXSk7XG5cdFx0XHRlZGl0b3IucHVzaFVuZG9TdG9wKCk7XG5cblx0XHRcdC8vIEF0IHRoaXMgcG9pbnQgdGhlIHRleHQgZWRpdG9yIGxvb2tzIGxpa2UgdGhpczpcblx0XHRcdC8vICAgWFlaXG5cdFx0XHQvLyAgIEFCQ1xuXHRcdFx0Ly8gICBYWVpcblx0XHRcdC8vICAgQUJDXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb250ZW50KDEpLCAnWFlaJyk7XG5cblx0XHRcdC8vIFRoZSBjdXJzb3IgaXMgYXQgZW5kIG9mIHRoZSBmaXJzdCBsaW5lLlxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmcm9tU2VsZWN0aW9uKGVkaXRvci5nZXRTZWxlY3Rpb24oKSEpLCBbMSwgNCwgMSwgNF0pO1xuXG5cdFx0XHQvLyBJIGhpdCBGMyB0byBcIkZpbmQgTmV4dFwiIHRvIGZpbmQgdGhlIG5leHQgb2NjdXJyZW5jZSBvZiBBQkMsIGJ1dCBpbnN0ZWFkIGl0IHNlYXJjaGVzIGZvciBYWVouXG5cdFx0XHRhd2FpdCBuZXh0TWF0Y2hGaW5kQWN0aW9uLnJ1bihudWxsLCBlZGl0b3IpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZFN0YXRlLnNlYXJjaFN0cmluZywgJ0FCQycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRDb250cm9sbGVyLmhhc0ZvY3VzLCBmYWxzZSk7XG5cblx0XHRcdGZpbmRDb250cm9sbGVyLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzMwOTA6IEYzIGRvZXMgbm90IGxvb3Agd2l0aCB0d28gbWF0Y2hlcyBvbiBhIHNpbmdsZSBsaW5lJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCdpbXBvcnQgbmxzID0gcmVxdWlyZShcXCd2cy9ubHNcXCcpOydcblx0XHRdLCB7IHNlcnZpY2VDb2xsZWN0aW9uOiBzZXJ2aWNlQ29sbGVjdGlvbiB9LCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdFx0XHRjbGlwYm9hcmRTdGF0ZSA9ICcnO1xuXHRcdFx0Y29uc3QgZmluZENvbnRyb2xsZXIgPSBlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihUZXN0RmluZENvbnRyb2xsZXIuSUQsIFRlc3RGaW5kQ29udHJvbGxlcik7XG5cdFx0XHRjb25zdCBuZXh0TWF0Y2hGaW5kQWN0aW9uID0gbmV3IE5leHRNYXRjaEZpbmRBY3Rpb24oKTtcblxuXHRcdFx0ZWRpdG9yLnNldFBvc2l0aW9uKHtcblx0XHRcdFx0bGluZU51bWJlcjogMSxcblx0XHRcdFx0Y29sdW1uOiA5XG5cdFx0XHR9KTtcblxuXHRcdFx0YXdhaXQgbmV4dE1hdGNoRmluZEFjdGlvbi5ydW4obnVsbCwgZWRpdG9yKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZnJvbVNlbGVjdGlvbihlZGl0b3IuZ2V0U2VsZWN0aW9uKCkhKSwgWzEsIDI2LCAxLCAyOV0pO1xuXG5cdFx0XHRhd2FpdCBuZXh0TWF0Y2hGaW5kQWN0aW9uLnJ1bihudWxsLCBlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmcm9tU2VsZWN0aW9uKGVkaXRvci5nZXRTZWxlY3Rpb24oKSEpLCBbMSwgOCwgMSwgMTFdKTtcblxuXHRcdFx0ZmluZENvbnRyb2xsZXIuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNjE0OTogQXV0by1lc2NhcGUgaGlnaGxpZ2h0ZWQgdGV4dCBmb3Igc2VhcmNoIGFuZCByZXBsYWNlIHJlZ2V4IG1vZGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd2l0aEFzeW5jVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0J3ZhciB4ID0gKDMgKiA1KScsXG5cdFx0XHQndmFyIHkgPSAoMyAqIDUpJyxcblx0XHRcdCd2YXIgeiA9ICgzICAqIDUpJyxcblx0XHRdLCB7IHNlcnZpY2VDb2xsZWN0aW9uOiBzZXJ2aWNlQ29sbGVjdGlvbiB9LCBhc3luYyAoZWRpdG9yLCBfLCBpbnN0YW50aWF0aW9uU2VydmljZSkgPT4ge1xuXHRcdFx0Y2xpcGJvYXJkU3RhdGUgPSAnJztcblx0XHRcdGNvbnN0IGZpbmRDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oVGVzdEZpbmRDb250cm9sbGVyLklELCBUZXN0RmluZENvbnRyb2xsZXIpO1xuXHRcdFx0Y29uc3QgbmV4dE1hdGNoRmluZEFjdGlvbiA9IG5ldyBOZXh0TWF0Y2hGaW5kQWN0aW9uKCk7XG5cblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCA5LCAxLCAxMykpO1xuXG5cdFx0XHRmaW5kQ29udHJvbGxlci50b2dnbGVSZWdleCgpO1xuXHRcdFx0YXdhaXQgZXhlY3V0ZUFjdGlvbihpbnN0YW50aWF0aW9uU2VydmljZSwgZWRpdG9yLCBTdGFydEZpbmRBY3Rpb24pO1xuXG5cdFx0XHRhd2FpdCBuZXh0TWF0Y2hGaW5kQWN0aW9uLnJ1bihudWxsLCBlZGl0b3IpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmcm9tU2VsZWN0aW9uKGVkaXRvci5nZXRTZWxlY3Rpb24oKSEpLCBbMiwgOSwgMiwgMTNdKTtcblxuXHRcdFx0YXdhaXQgbmV4dE1hdGNoRmluZEFjdGlvbi5ydW4obnVsbCwgZWRpdG9yKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZnJvbVNlbGVjdGlvbihlZGl0b3IuZ2V0U2VsZWN0aW9uKCkhKSwgWzEsIDksIDEsIDEzXSk7XG5cblx0XHRcdGZpbmRDb250cm9sbGVyLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzQxMDI3OiBEb25cXCd0IHJlcGxhY2UgZmluZCBpbnB1dCB2YWx1ZSBvbiByZXBsYWNlIGFjdGlvbiBpZiBmaW5kIGlucHV0IGlzIGFjdGl2ZScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQndGVzdCcsXG5cdFx0XSwgeyBzZXJ2aWNlQ29sbGVjdGlvbjogc2VydmljZUNvbGxlY3Rpb24gfSwgYXN5bmMgKGVkaXRvciwgXywgaW5zdGFudGlhdGlvblNlcnZpY2UpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RSZWdleFN0cmluZyA9ICd0ZXMuJztcblx0XHRcdGNvbnN0IGZpbmRDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oVGVzdEZpbmRDb250cm9sbGVyLklELCBUZXN0RmluZENvbnRyb2xsZXIpO1xuXHRcdFx0Y29uc3QgbmV4dE1hdGNoRmluZEFjdGlvbiA9IG5ldyBOZXh0TWF0Y2hGaW5kQWN0aW9uKCk7XG5cblx0XHRcdGZpbmRDb250cm9sbGVyLnRvZ2dsZVJlZ2V4KCk7XG5cdFx0XHRmaW5kQ29udHJvbGxlci5zZXRTZWFyY2hTdHJpbmcodGVzdFJlZ2V4U3RyaW5nKTtcblx0XHRcdGF3YWl0IGZpbmRDb250cm9sbGVyLnN0YXJ0KHtcblx0XHRcdFx0Zm9yY2VSZXZlYWxSZXBsYWNlOiBmYWxzZSxcblx0XHRcdFx0c2VlZFNlYXJjaFN0cmluZ0Zyb21TZWxlY3Rpb246ICdub25lJyxcblx0XHRcdFx0c2VlZFNlYXJjaFN0cmluZ0Zyb21Ob25FbXB0eVNlbGVjdGlvbjogZmFsc2UsXG5cdFx0XHRcdHNlZWRTZWFyY2hTdHJpbmdGcm9tR2xvYmFsQ2xpcGJvYXJkOiBmYWxzZSxcblx0XHRcdFx0c2hvdWxkRm9jdXM6IEZpbmRTdGFydEZvY3VzQWN0aW9uLkZvY3VzRmluZElucHV0LFxuXHRcdFx0XHRzaG91bGRBbmltYXRlOiBmYWxzZSxcblx0XHRcdFx0dXBkYXRlU2VhcmNoU2NvcGU6IGZhbHNlLFxuXHRcdFx0XHRsb29wOiB0cnVlXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IG5leHRNYXRjaEZpbmRBY3Rpb24ucnVuKG51bGwsIGVkaXRvcik7XG5cdFx0XHRhd2FpdCBleGVjdXRlQWN0aW9uKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBlZGl0b3IsIFN0YXJ0RmluZFJlcGxhY2VBY3Rpb24pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmluZENvbnRyb2xsZXIuZ2V0U3RhdGUoKS5zZWFyY2hTdHJpbmcsIHRlc3RSZWdleFN0cmluZyk7XG5cblx0XHRcdGZpbmRDb250cm9sbGVyLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzkwNDM6IENsZWFyIHNlYXJjaCBzY29wZSB3aGVuIGZpbmQgd2lkZ2V0IGlzIGhpZGRlbicsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQndmFyIHggPSAoMyAqIDUpJyxcblx0XHRcdCd2YXIgeSA9ICgzICogNSknLFxuXHRcdFx0J3ZhciB6ID0gKDMgKiA1KScsXG5cdFx0XSwgeyBzZXJ2aWNlQ29sbGVjdGlvbjogc2VydmljZUNvbGxlY3Rpb24gfSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdFx0Y2xpcGJvYXJkU3RhdGUgPSAnJztcblx0XHRcdGNvbnN0IGZpbmRDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oVGVzdEZpbmRDb250cm9sbGVyLklELCBUZXN0RmluZENvbnRyb2xsZXIpO1xuXHRcdFx0YXdhaXQgZmluZENvbnRyb2xsZXIuc3RhcnQoe1xuXHRcdFx0XHRmb3JjZVJldmVhbFJlcGxhY2U6IGZhbHNlLFxuXHRcdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbjogJ25vbmUnLFxuXHRcdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbU5vbkVtcHR5U2VsZWN0aW9uOiBmYWxzZSxcblx0XHRcdFx0c2VlZFNlYXJjaFN0cmluZ0Zyb21HbG9iYWxDbGlwYm9hcmQ6IGZhbHNlLFxuXHRcdFx0XHRzaG91bGRGb2N1czogRmluZFN0YXJ0Rm9jdXNBY3Rpb24uTm9Gb2N1c0NoYW5nZSxcblx0XHRcdFx0c2hvdWxkQW5pbWF0ZTogZmFsc2UsXG5cdFx0XHRcdHVwZGF0ZVNlYXJjaFNjb3BlOiBmYWxzZSxcblx0XHRcdFx0bG9vcDogdHJ1ZVxuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaW5kQ29udHJvbGxlci5nZXRTdGF0ZSgpLnNlYXJjaFNjb3BlLCBudWxsKTtcblxuXHRcdFx0ZmluZENvbnRyb2xsZXIuZ2V0U3RhdGUoKS5jaGFuZ2Uoe1xuXHRcdFx0XHRzZWFyY2hTY29wZTogW25ldyBSYW5nZSgxLCAxLCAxLCA1KV1cblx0XHRcdH0sIGZhbHNlKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaW5kQ29udHJvbGxlci5nZXRTdGF0ZSgpLnNlYXJjaFNjb3BlLCBbbmV3IFJhbmdlKDEsIDEsIDEsIDUpXSk7XG5cblx0XHRcdGZpbmRDb250cm9sbGVyLmNsb3NlRmluZFdpZGdldCgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbmRDb250cm9sbGVyLmdldFN0YXRlKCkuc2VhcmNoU2NvcGUsIG51bGwpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTgxMTE6IFJlZ2V4IHJlcGxhY2Ugd2l0aCBzaW5nbGUgc3BhY2UgcmVwbGFjZXMgd2l0aCBubyBzcGFjZScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnSFJFU1VMVCBPbkFtYmllbnRQcm9wZXJ0eUNoYW5nZShESVNQSUQgICBkaXNwaWQpOydcblx0XHRdLCB7IHNlcnZpY2VDb2xsZWN0aW9uOiBzZXJ2aWNlQ29sbGVjdGlvbiB9LCBhc3luYyAoZWRpdG9yLCBfLCBpbnN0YW50aWF0aW9uU2VydmljZSkgPT4ge1xuXHRcdFx0Y2xpcGJvYXJkU3RhdGUgPSAnJztcblx0XHRcdGNvbnN0IGZpbmRDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oVGVzdEZpbmRDb250cm9sbGVyLklELCBUZXN0RmluZENvbnRyb2xsZXIpO1xuXG5cdFx0XHRhd2FpdCBleGVjdXRlQWN0aW9uKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBlZGl0b3IsIFN0YXJ0RmluZEFjdGlvbik7XG5cblx0XHRcdGZpbmRDb250cm9sbGVyLmdldFN0YXRlKCkuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnXFxcXGJcXFxcc3szfVxcXFxiJywgcmVwbGFjZVN0cmluZzogJyAnLCBpc1JlZ2V4OiB0cnVlIH0sIGZhbHNlKTtcblx0XHRcdGZpbmRDb250cm9sbGVyLm1vdmVUb05leHRNYXRjaCgpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhLm1hcChmcm9tU2VsZWN0aW9uKSwgW1xuXHRcdFx0XHRbMSwgMzksIDEsIDQyXVxuXHRcdFx0XSk7XG5cblx0XHRcdGZpbmRDb250cm9sbGVyLnJlcGxhY2UoKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0VmFsdWUoKSwgJ0hSRVNVTFQgT25BbWJpZW50UHJvcGVydHlDaGFuZ2UoRElTUElEIGRpc3BpZCk7Jyk7XG5cblx0XHRcdGZpbmRDb250cm9sbGVyLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzI0NzE0OiBSZWd1bGFyIGV4cHJlc3Npb24gd2l0aCBeIGluIHNlYXJjaCAmIHJlcGxhY2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd2l0aEFzeW5jVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0JycsXG5cdFx0XHQnbGluZTInLFxuXHRcdFx0J2xpbmUzJ1xuXHRcdF0sIHsgc2VydmljZUNvbGxlY3Rpb246IHNlcnZpY2VDb2xsZWN0aW9uIH0sIGFzeW5jIChlZGl0b3IsIF8sIGluc3RhbnRpYXRpb25TZXJ2aWNlKSA9PiB7XG5cdFx0XHRjbGlwYm9hcmRTdGF0ZSA9ICcnO1xuXHRcdFx0Y29uc3QgZmluZENvbnRyb2xsZXIgPSBlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihUZXN0RmluZENvbnRyb2xsZXIuSUQsIFRlc3RGaW5kQ29udHJvbGxlcik7XG5cblx0XHRcdGF3YWl0IGV4ZWN1dGVBY3Rpb24oaW5zdGFudGlhdGlvblNlcnZpY2UsIGVkaXRvciwgU3RhcnRGaW5kQWN0aW9uKTtcblxuXHRcdFx0ZmluZENvbnRyb2xsZXIuZ2V0U3RhdGUoKS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6ICdeJywgcmVwbGFjZVN0cmluZzogJ3gnLCBpc1JlZ2V4OiB0cnVlIH0sIGZhbHNlKTtcblx0XHRcdGZpbmRDb250cm9sbGVyLm1vdmVUb05leHRNYXRjaCgpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhLm1hcChmcm9tU2VsZWN0aW9uKSwgW1xuXHRcdFx0XHRbMiwgMSwgMiwgMV1cblx0XHRcdF0pO1xuXG5cdFx0XHRmaW5kQ29udHJvbGxlci5yZXBsYWNlKCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFZhbHVlKCksICdcXG54bGluZTJcXG5saW5lMycpO1xuXG5cdFx0XHRmaW5kQ29udHJvbGxlci5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMzODIzMjogRmluZCBOZXh0IFNlbGVjdGlvbiwgcmVnZXggZW5hYmxlZCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnKFtmdW5ueV0nLFxuXHRcdFx0JycsXG5cdFx0XHQnKFtmdW5ueV0nXG5cdFx0XSwgeyBzZXJ2aWNlQ29sbGVjdGlvbjogc2VydmljZUNvbGxlY3Rpb24gfSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdFx0Y2xpcGJvYXJkU3RhdGUgPSAnJztcblx0XHRcdGNvbnN0IGZpbmRDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oVGVzdEZpbmRDb250cm9sbGVyLklELCBUZXN0RmluZENvbnRyb2xsZXIpO1xuXHRcdFx0Y29uc3QgbmV4dFNlbGVjdGlvbk1hdGNoRmluZEFjdGlvbiA9IG5ldyBOZXh0U2VsZWN0aW9uTWF0Y2hGaW5kQWN0aW9uKCk7XG5cblx0XHRcdC8vIHRvZ2dsZSByZWdleFxuXHRcdFx0ZmluZENvbnRyb2xsZXIuZ2V0U3RhdGUoKS5jaGFuZ2UoeyBpc1JlZ2V4OiB0cnVlIH0sIGZhbHNlKTtcblxuXHRcdFx0Ly8gY2hhbmdlIHNlbGVjdGlvblxuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDkpKTtcblxuXHRcdFx0Ly8gY21kK2YzXG5cdFx0XHRhd2FpdCBuZXh0U2VsZWN0aW9uTWF0Y2hGaW5kQWN0aW9uLnJ1bihudWxsLCBlZGl0b3IpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhLm1hcChmcm9tU2VsZWN0aW9uKSwgW1xuXHRcdFx0XHRbMywgMSwgMywgOV1cblx0XHRcdF0pO1xuXG5cdFx0XHRmaW5kQ29udHJvbGxlci5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMzODIzMjogRmluZCBOZXh0IFNlbGVjdGlvbiwgcmVnZXggZW5hYmxlZCwgZmluZCB3aWRnZXQgb3BlbicsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnKFtmdW5ueV0nLFxuXHRcdFx0JycsXG5cdFx0XHQnKFtmdW5ueV0nXG5cdFx0XSwgeyBzZXJ2aWNlQ29sbGVjdGlvbjogc2VydmljZUNvbGxlY3Rpb24gfSwgYXN5bmMgKGVkaXRvciwgXywgaW5zdGFudGlhdGlvblNlcnZpY2UpID0+IHtcblx0XHRcdGNsaXBib2FyZFN0YXRlID0gJyc7XG5cdFx0XHRjb25zdCBmaW5kQ29udHJvbGxlciA9IGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKFRlc3RGaW5kQ29udHJvbGxlci5JRCwgVGVzdEZpbmRDb250cm9sbGVyKTtcblx0XHRcdGNvbnN0IG5leHRTZWxlY3Rpb25NYXRjaEZpbmRBY3Rpb24gPSBuZXcgTmV4dFNlbGVjdGlvbk1hdGNoRmluZEFjdGlvbigpO1xuXG5cdFx0XHQvLyBjbWQrZiAtIG9wZW4gZmluZCB3aWRnZXRcblx0XHRcdGF3YWl0IGV4ZWN1dGVBY3Rpb24oaW5zdGFudGlhdGlvblNlcnZpY2UsIGVkaXRvciwgU3RhcnRGaW5kQWN0aW9uKTtcblxuXHRcdFx0Ly8gdG9nZ2xlIHJlZ2V4XG5cdFx0XHRmaW5kQ29udHJvbGxlci5nZXRTdGF0ZSgpLmNoYW5nZSh7IGlzUmVnZXg6IHRydWUgfSwgZmFsc2UpO1xuXG5cdFx0XHQvLyBjaGFuZ2Ugc2VsZWN0aW9uXG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgOSkpO1xuXG5cdFx0XHQvLyBjbWQrZjNcblx0XHRcdGF3YWl0IG5leHRTZWxlY3Rpb25NYXRjaEZpbmRBY3Rpb24ucnVuKG51bGwsIGVkaXRvcik7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbnMoKSEubWFwKGZyb21TZWxlY3Rpb24pLCBbXG5cdFx0XHRcdFszLCAxLCAzLCA5XVxuXHRcdFx0XSk7XG5cblx0XHRcdGZpbmRDb250cm9sbGVyLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzQ3NDAwLCBDTUQrRSBzdXBwb3J0cyBmZWVkaW5nIG11bHRpcGxlIGxpbmUgb2YgdGV4dCBpbnRvIHRoZSBmaW5kIHdpZGdldCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnQUJDJyxcblx0XHRcdCdBQkMnLFxuXHRcdFx0J1hZWicsXG5cdFx0XHQnQUJDJyxcblx0XHRcdCdBQkMnXG5cdFx0XSwgeyBzZXJ2aWNlQ29sbGVjdGlvbjogc2VydmljZUNvbGxlY3Rpb24gfSwgYXN5bmMgKGVkaXRvciwgXywgaW5zdGFudGlhdGlvblNlcnZpY2UpID0+IHtcblx0XHRcdGNsaXBib2FyZFN0YXRlID0gJyc7XG5cdFx0XHRjb25zdCBmaW5kQ29udHJvbGxlciA9IGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKFRlc3RGaW5kQ29udHJvbGxlci5JRCwgVGVzdEZpbmRDb250cm9sbGVyKTtcblxuXHRcdFx0Ly8gY2hhbmdlIHNlbGVjdGlvblxuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpKTtcblxuXHRcdFx0Ly8gY21kK2YgLSBvcGVuIGZpbmQgd2lkZ2V0XG5cdFx0XHRhd2FpdCBleGVjdXRlQWN0aW9uKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBlZGl0b3IsIFN0YXJ0RmluZEFjdGlvbik7XG5cblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxLCAyLCA0KSk7XG5cdFx0XHRjb25zdCBzdGFydEZpbmRXaXRoU2VsZWN0aW9uQWN0aW9uID0gbmV3IFN0YXJ0RmluZFdpdGhTZWxlY3Rpb25BY3Rpb24oKTtcblx0XHRcdGF3YWl0IHN0YXJ0RmluZFdpdGhTZWxlY3Rpb25BY3Rpb24ucnVuKG51bGwsIGVkaXRvcik7XG5cdFx0XHRjb25zdCBmaW5kU3RhdGUgPSBmaW5kQ29udHJvbGxlci5nZXRTdGF0ZSgpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpbmRTdGF0ZS5zZWFyY2hTdHJpbmcuc3BsaXQoL1xcclxcbnxcXHJ8XFxuL2cpLCBbJ0FCQycsICdBQkMnXSk7XG5cblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigzLCAxLCAzLCAxKSk7XG5cdFx0XHRhd2FpdCBzdGFydEZpbmRXaXRoU2VsZWN0aW9uQWN0aW9uLnJ1bihudWxsLCBlZGl0b3IpO1xuXG5cdFx0XHRmaW5kQ29udHJvbGxlci5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMDk3NTYsIENNRCtFIHdpdGggZW1wdHkgY3Vyc29yIHNob3VsZCBhbHdheXMgd29yaycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQnQUJDJyxcblx0XHRcdCdBQkMnLFxuXHRcdFx0J1hZWicsXG5cdFx0XHQnQUJDJyxcblx0XHRcdCdBQkMnXG5cdFx0XSwgeyBzZXJ2aWNlQ29sbGVjdGlvbjogc2VydmljZUNvbGxlY3Rpb24gfSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdFx0Y2xpcGJvYXJkU3RhdGUgPSAnJztcblx0XHRcdGNvbnN0IGZpbmRDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oVGVzdEZpbmRDb250cm9sbGVyLklELCBUZXN0RmluZENvbnRyb2xsZXIpO1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDIpKTtcblxuXHRcdFx0Y29uc3Qgc3RhcnRGaW5kV2l0aFNlbGVjdGlvbkFjdGlvbiA9IG5ldyBTdGFydEZpbmRXaXRoU2VsZWN0aW9uQWN0aW9uKCk7XG5cdFx0XHRzdGFydEZpbmRXaXRoU2VsZWN0aW9uQWN0aW9uLnJ1bihudWxsLCBlZGl0b3IpO1xuXG5cdFx0XHRjb25zdCBmaW5kU3RhdGUgPSBmaW5kQ29udHJvbGxlci5nZXRTdGF0ZSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaW5kU3RhdGUuc2VhcmNoU3RyaW5nLCAnQUJDJyk7XG5cdFx0XHRmaW5kQ29udHJvbGxlci5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdGaW5kQ29udHJvbGxlciBxdWVyeSBvcHRpb25zIHBlcnNpc3RlbmNlJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGNvbnN0IHNlcnZpY2VDb2xsZWN0aW9uID0gbmV3IFNlcnZpY2VDb2xsZWN0aW9uKCk7XG5cdGNvbnN0IHN0b3JhZ2VTZXJ2aWNlID0gbmV3IEluTWVtb3J5U3RvcmFnZVNlcnZpY2UoKTtcblx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ2VkaXRvci5pc1JlZ2V4JywgZmFsc2UsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdHN0b3JhZ2VTZXJ2aWNlLnN0b3JlKCdlZGl0b3IubWF0Y2hDYXNlJywgZmFsc2UsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdHN0b3JhZ2VTZXJ2aWNlLnN0b3JlKCdlZGl0b3Iud2hvbGVXb3JkJywgZmFsc2UsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdHNlcnZpY2VDb2xsZWN0aW9uLnNldChJU3RvcmFnZVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlKTtcblxuXHR0ZXN0KCdtYXRjaENhc2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd2l0aEFzeW5jVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0J2FiYycsXG5cdFx0XHQnQUJDJyxcblx0XHRcdCdYWVonLFxuXHRcdFx0J0FCQydcblx0XHRdLCB7IHNlcnZpY2VDb2xsZWN0aW9uOiBzZXJ2aWNlQ29sbGVjdGlvbiB9LCBhc3luYyAoZWRpdG9yLCBfLCBpbnN0YW50aWF0aW9uU2VydmljZSkgPT4ge1xuXHRcdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ2VkaXRvci5tYXRjaENhc2UnLCB0cnVlLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHRcdFx0Ly8gVGhlIGN1cnNvciBpcyBhdCB0aGUgdmVyeSB0b3AsIG9mIHRoZSBmaWxlLCBhdCB0aGUgZmlyc3QgQUJDXG5cdFx0XHRjb25zdCBmaW5kQ29udHJvbGxlciA9IGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKFRlc3RGaW5kQ29udHJvbGxlci5JRCwgVGVzdEZpbmRDb250cm9sbGVyKTtcblx0XHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGZpbmRDb250cm9sbGVyLmdldFN0YXRlKCk7XG5cblx0XHRcdC8vIEkgaGl0IEN0cmwrRiB0byBzaG93IHRoZSBGaW5kIGRpYWxvZ1xuXHRcdFx0YXdhaXQgZXhlY3V0ZUFjdGlvbihpbnN0YW50aWF0aW9uU2VydmljZSwgZWRpdG9yLCBTdGFydEZpbmRBY3Rpb24pO1xuXG5cdFx0XHQvLyBJIHR5cGUgQUJDLlxuXHRcdFx0ZmluZFN0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogJ0FCQycgfSwgdHJ1ZSk7XG5cdFx0XHQvLyBUaGUgc2Vjb25kIEFCQyBpcyBoaWdobGlnaHRlZCBhcyBtYXRjaENhc2UgaXMgdHJ1ZS5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZnJvbVNlbGVjdGlvbihlZGl0b3IuZ2V0U2VsZWN0aW9uKCkhKSwgWzIsIDEsIDIsIDRdKTtcblxuXHRcdFx0ZmluZENvbnRyb2xsZXIuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdG9yYWdlU2VydmljZS5zdG9yZSgnZWRpdG9yLm1hdGNoQ2FzZScsIGZhbHNlLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHRzdG9yYWdlU2VydmljZS5zdG9yZSgnZWRpdG9yLndob2xlV29yZCcsIHRydWUsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cblx0dGVzdCgnd2hvbGVXb3JkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCdBQkMnLFxuXHRcdFx0J0FCJyxcblx0XHRcdCdYWVonLFxuXHRcdFx0J0FCQydcblx0XHRdLCB7IHNlcnZpY2VDb2xsZWN0aW9uOiBzZXJ2aWNlQ29sbGVjdGlvbiB9LCBhc3luYyAoZWRpdG9yLCBfLCBpbnN0YW50aWF0aW9uU2VydmljZSkgPT4ge1xuXHRcdFx0Ly8gVGhlIGN1cnNvciBpcyBhdCB0aGUgdmVyeSB0b3AsIG9mIHRoZSBmaWxlLCBhdCB0aGUgZmlyc3QgQUJDXG5cdFx0XHRjb25zdCBmaW5kQ29udHJvbGxlciA9IGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKFRlc3RGaW5kQ29udHJvbGxlci5JRCwgVGVzdEZpbmRDb250cm9sbGVyKTtcblx0XHRcdGNvbnN0IGZpbmRTdGF0ZSA9IGZpbmRDb250cm9sbGVyLmdldFN0YXRlKCk7XG5cblx0XHRcdC8vIEkgaGl0IEN0cmwrRiB0byBzaG93IHRoZSBGaW5kIGRpYWxvZ1xuXHRcdFx0YXdhaXQgZXhlY3V0ZUFjdGlvbihpbnN0YW50aWF0aW9uU2VydmljZSwgZWRpdG9yLCBTdGFydEZpbmRBY3Rpb24pO1xuXG5cdFx0XHQvLyBJIHR5cGUgQUIuXG5cdFx0XHRmaW5kU3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiAnQUInIH0sIHRydWUpO1xuXHRcdFx0Ly8gVGhlIHNlY29uZCBBQiBpcyBoaWdobGlnaHRlZCBhcyB3aG9sZVdvcmQgaXMgdHJ1ZS5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZnJvbVNlbGVjdGlvbihlZGl0b3IuZ2V0U2VsZWN0aW9uKCkhKSwgWzIsIDEsIDIsIDNdKTtcblxuXHRcdFx0ZmluZENvbnRyb2xsZXIuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCd0b2dnbGluZyBvcHRpb25zIGlzIHNhdmVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCdBQkMnLFxuXHRcdFx0J0FCJyxcblx0XHRcdCdYWVonLFxuXHRcdFx0J0FCQydcblx0XHRdLCB7IHNlcnZpY2VDb2xsZWN0aW9uOiBzZXJ2aWNlQ29sbGVjdGlvbiB9LCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdFx0XHQvLyBUaGUgY3Vyc29yIGlzIGF0IHRoZSB2ZXJ5IHRvcCwgb2YgdGhlIGZpbGUsIGF0IHRoZSBmaXJzdCBBQkNcblx0XHRcdGNvbnN0IGZpbmRDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oVGVzdEZpbmRDb250cm9sbGVyLklELCBUZXN0RmluZENvbnRyb2xsZXIpO1xuXHRcdFx0ZmluZENvbnRyb2xsZXIudG9nZ2xlUmVnZXgoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdG9yYWdlU2VydmljZS5nZXRCb29sZWFuKCdlZGl0b3IuaXNSZWdleCcsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpLCB0cnVlKTtcblxuXHRcdFx0ZmluZENvbnRyb2xsZXIuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMjcwODM6IFVwZGF0ZSBzZWFyY2ggc2NvcGUgb25jZSBmaW5kIHdpZGdldCBiZWNvbWVzIHZpc2libGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd2l0aEFzeW5jVGVzdENvZGVFZGl0b3IoW1xuXHRcdFx0J3ZhciB4ID0gKDMgKiA1KScsXG5cdFx0XHQndmFyIHkgPSAoMyAqIDUpJyxcblx0XHRcdCd2YXIgeiA9ICgzICogNSknLFxuXHRcdF0sIHsgc2VydmljZUNvbGxlY3Rpb246IHNlcnZpY2VDb2xsZWN0aW9uLCBmaW5kOiB7IGF1dG9GaW5kSW5TZWxlY3Rpb246ICdhbHdheXMnLCBnbG9iYWxGaW5kQ2xpcGJvYXJkOiBmYWxzZSB9IH0sIGFzeW5jIChlZGl0b3IpID0+IHtcblx0XHRcdC8vIGNsaXBib2FyZFN0YXRlID0gJyc7XG5cdFx0XHRjb25zdCBmaW5kQ29udHJvbGxlciA9IGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKFRlc3RGaW5kQ29udHJvbGxlci5JRCwgVGVzdEZpbmRDb250cm9sbGVyKTtcblx0XHRcdGNvbnN0IGZpbmRDb25maWc6IElGaW5kU3RhcnRPcHRpb25zID0ge1xuXHRcdFx0XHRmb3JjZVJldmVhbFJlcGxhY2U6IGZhbHNlLFxuXHRcdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbjogJ25vbmUnLFxuXHRcdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbU5vbkVtcHR5U2VsZWN0aW9uOiBmYWxzZSxcblx0XHRcdFx0c2VlZFNlYXJjaFN0cmluZ0Zyb21HbG9iYWxDbGlwYm9hcmQ6IGZhbHNlLFxuXHRcdFx0XHRzaG91bGRGb2N1czogRmluZFN0YXJ0Rm9jdXNBY3Rpb24uTm9Gb2N1c0NoYW5nZSxcblx0XHRcdFx0c2hvdWxkQW5pbWF0ZTogZmFsc2UsXG5cdFx0XHRcdHVwZGF0ZVNlYXJjaFNjb3BlOiB0cnVlLFxuXHRcdFx0XHRsb29wOiB0cnVlXG5cdFx0XHR9O1xuXG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBSYW5nZSgxLCAxLCAyLCAxKSk7XG5cdFx0XHRmaW5kQ29udHJvbGxlci5zdGFydChmaW5kQ29uZmlnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmluZENvbnRyb2xsZXIuZ2V0U3RhdGUoKS5zZWFyY2hTY29wZSwgW25ldyBTZWxlY3Rpb24oMSwgMSwgMiwgMSldKTtcblxuXHRcdFx0ZmluZENvbnRyb2xsZXIuY2xvc2VGaW5kV2lkZ2V0KCk7XG5cblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb25zKFtuZXcgU2VsZWN0aW9uKDEsIDEsIDIsIDEpLCBuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDUpXSk7XG5cdFx0XHRmaW5kQ29udHJvbGxlci5zdGFydChmaW5kQ29uZmlnKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmluZENvbnRyb2xsZXIuZ2V0U3RhdGUoKS5zZWFyY2hTY29wZSwgW25ldyBTZWxlY3Rpb24oMSwgMSwgMiwgMSksIG5ldyBTZWxlY3Rpb24oMiwgMSwgMiwgNSldKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzU4NjA0OiBEbyBub3QgdXBkYXRlIHNlYXJjaFNjb3BlIGlmIGl0IGlzIGVtcHR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHdpdGhBc3luY1Rlc3RDb2RlRWRpdG9yKFtcblx0XHRcdCd2YXIgeCA9ICgzICogNSknLFxuXHRcdFx0J3ZhciB5ID0gKDMgKiA1KScsXG5cdFx0XHQndmFyIHogPSAoMyAqIDUpJyxcblx0XHRdLCB7IHNlcnZpY2VDb2xsZWN0aW9uOiBzZXJ2aWNlQ29sbGVjdGlvbiwgZmluZDogeyBhdXRvRmluZEluU2VsZWN0aW9uOiAnYWx3YXlzJywgZ2xvYmFsRmluZENsaXBib2FyZDogZmFsc2UgfSB9LCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdFx0XHQvLyBjbGlwYm9hcmRTdGF0ZSA9ICcnO1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgUmFuZ2UoMSwgMiwgMSwgMikpO1xuXHRcdFx0Y29uc3QgZmluZENvbnRyb2xsZXIgPSBlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihUZXN0RmluZENvbnRyb2xsZXIuSUQsIFRlc3RGaW5kQ29udHJvbGxlcik7XG5cblx0XHRcdGF3YWl0IGZpbmRDb250cm9sbGVyLnN0YXJ0KHtcblx0XHRcdFx0Zm9yY2VSZXZlYWxSZXBsYWNlOiBmYWxzZSxcblx0XHRcdFx0c2VlZFNlYXJjaFN0cmluZ0Zyb21TZWxlY3Rpb246ICdub25lJyxcblx0XHRcdFx0c2VlZFNlYXJjaFN0cmluZ0Zyb21Ob25FbXB0eVNlbGVjdGlvbjogZmFsc2UsXG5cdFx0XHRcdHNlZWRTZWFyY2hTdHJpbmdGcm9tR2xvYmFsQ2xpcGJvYXJkOiBmYWxzZSxcblx0XHRcdFx0c2hvdWxkRm9jdXM6IEZpbmRTdGFydEZvY3VzQWN0aW9uLk5vRm9jdXNDaGFuZ2UsXG5cdFx0XHRcdHNob3VsZEFuaW1hdGU6IGZhbHNlLFxuXHRcdFx0XHR1cGRhdGVTZWFyY2hTY29wZTogdHJ1ZSxcblx0XHRcdFx0bG9vcDogdHJ1ZVxuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmluZENvbnRyb2xsZXIuZ2V0U3RhdGUoKS5zZWFyY2hTY29wZSwgbnVsbCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM1ODYwNDogVXBkYXRlIHNlYXJjaFNjb3BlIGlmIGl0IGlzIG5vdCBlbXB0eScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQndmFyIHggPSAoMyAqIDUpJyxcblx0XHRcdCd2YXIgeSA9ICgzICogNSknLFxuXHRcdFx0J3ZhciB6ID0gKDMgKiA1KScsXG5cdFx0XSwgeyBzZXJ2aWNlQ29sbGVjdGlvbjogc2VydmljZUNvbGxlY3Rpb24sIGZpbmQ6IHsgYXV0b0ZpbmRJblNlbGVjdGlvbjogJ2Fsd2F5cycsIGdsb2JhbEZpbmRDbGlwYm9hcmQ6IGZhbHNlIH0gfSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdFx0Ly8gY2xpcGJvYXJkU3RhdGUgPSAnJztcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFJhbmdlKDEsIDIsIDEsIDMpKTtcblx0XHRcdGNvbnN0IGZpbmRDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oVGVzdEZpbmRDb250cm9sbGVyLklELCBUZXN0RmluZENvbnRyb2xsZXIpO1xuXG5cdFx0XHRhd2FpdCBmaW5kQ29udHJvbGxlci5zdGFydCh7XG5cdFx0XHRcdGZvcmNlUmV2ZWFsUmVwbGFjZTogZmFsc2UsXG5cdFx0XHRcdHNlZWRTZWFyY2hTdHJpbmdGcm9tU2VsZWN0aW9uOiAnbm9uZScsXG5cdFx0XHRcdHNlZWRTZWFyY2hTdHJpbmdGcm9tTm9uRW1wdHlTZWxlY3Rpb246IGZhbHNlLFxuXHRcdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbUdsb2JhbENsaXBib2FyZDogZmFsc2UsXG5cdFx0XHRcdHNob3VsZEZvY3VzOiBGaW5kU3RhcnRGb2N1c0FjdGlvbi5Ob0ZvY3VzQ2hhbmdlLFxuXHRcdFx0XHRzaG91bGRBbmltYXRlOiBmYWxzZSxcblx0XHRcdFx0dXBkYXRlU2VhcmNoU2NvcGU6IHRydWUsXG5cdFx0XHRcdGxvb3A6IHRydWVcblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpbmRDb250cm9sbGVyLmdldFN0YXRlKCkuc2VhcmNoU2NvcGUsIFtuZXcgU2VsZWN0aW9uKDEsIDIsIDEsIDMpXSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cblx0dGVzdCgnaXNzdWUgIzI3MDgzOiBGaW5kIGluIHNlbGVjdGlvbiB3aGVuIG11bHRpcGxlIGxpbmVzIGFyZSBzZWxlY3RlZCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3aXRoQXN5bmNUZXN0Q29kZUVkaXRvcihbXG5cdFx0XHQndmFyIHggPSAoMyAqIDUpJyxcblx0XHRcdCd2YXIgeSA9ICgzICogNSknLFxuXHRcdFx0J3ZhciB6ID0gKDMgKiA1KScsXG5cdFx0XSwgeyBzZXJ2aWNlQ29sbGVjdGlvbjogc2VydmljZUNvbGxlY3Rpb24sIGZpbmQ6IHsgYXV0b0ZpbmRJblNlbGVjdGlvbjogJ211bHRpbGluZScsIGdsb2JhbEZpbmRDbGlwYm9hcmQ6IGZhbHNlIH0gfSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdFx0Ly8gY2xpcGJvYXJkU3RhdGUgPSAnJztcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFJhbmdlKDEsIDYsIDIsIDEpKTtcblx0XHRcdGNvbnN0IGZpbmRDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oVGVzdEZpbmRDb250cm9sbGVyLklELCBUZXN0RmluZENvbnRyb2xsZXIpO1xuXG5cdFx0XHRhd2FpdCBmaW5kQ29udHJvbGxlci5zdGFydCh7XG5cdFx0XHRcdGZvcmNlUmV2ZWFsUmVwbGFjZTogZmFsc2UsXG5cdFx0XHRcdHNlZWRTZWFyY2hTdHJpbmdGcm9tU2VsZWN0aW9uOiAnbm9uZScsXG5cdFx0XHRcdHNlZWRTZWFyY2hTdHJpbmdGcm9tTm9uRW1wdHlTZWxlY3Rpb246IGZhbHNlLFxuXHRcdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbUdsb2JhbENsaXBib2FyZDogZmFsc2UsXG5cdFx0XHRcdHNob3VsZEZvY3VzOiBGaW5kU3RhcnRGb2N1c0FjdGlvbi5Ob0ZvY3VzQ2hhbmdlLFxuXHRcdFx0XHRzaG91bGRBbmltYXRlOiBmYWxzZSxcblx0XHRcdFx0dXBkYXRlU2VhcmNoU2NvcGU6IHRydWUsXG5cdFx0XHRcdGxvb3A6IHRydWVcblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpbmRDb250cm9sbGVyLmdldFN0YXRlKCkuc2VhcmNoU2NvcGUsIFtuZXcgU2VsZWN0aW9uKDEsIDYsIDIsIDEpXSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGVBQWU7QUFDeEIsWUFBWSxjQUFjO0FBQzFCLFNBQVMsK0NBQStDO0FBR3hELFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGlCQUFpQjtBQUMxQixTQUFT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
