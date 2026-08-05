import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { runWithFakedTimers } from "../../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { CoreEditingCommands } from "../../../../browser/coreCommands.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { USUAL_WORD_SEPARATORS } from "../../../../common/core/wordHelper.js";
import { Handler } from "../../../../common/editorCommon.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { ILanguageFeaturesService } from "../../../../common/services/languageFeatures.js";
import { DeleteAllLeftAction } from "../../../linesOperations/browser/linesOperations.js";
import { LinkedEditingContribution } from "../../browser/linkedEditing.js";
import { DeleteWordLeft } from "../../../wordOperations/browser/wordOperations.js";
import { createCodeEditorServices, instantiateTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { instantiateTextModel } from "../../../../test/common/testTextModel.js";
const mockFile = URI.parse("test:somefile.ttt");
const mockFileSelector = { scheme: "test" };
const timeout = 30;
const languageId = "linkedEditingTestLangage";
suite("linked editing", () => {
  let disposables;
  let instantiationService;
  let languageFeaturesService;
  let languageConfigurationService;
  setup(() => {
    disposables = new DisposableStore();
    instantiationService = createCodeEditorServices(disposables);
    languageFeaturesService = instantiationService.get(ILanguageFeaturesService);
    languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
    disposables.add(languageConfigurationService.register(languageId, {
      wordPattern: /[a-zA-Z]+/
    }));
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  function createMockEditor(text) {
    const model = disposables.add(instantiateTextModel(instantiationService, typeof text === "string" ? text : text.join("\n"), languageId, void 0, mockFile));
    const editor = disposables.add(instantiateTestCodeEditor(instantiationService, model));
    return editor;
  }
  function testCase(name, initialState, operations, expectedEndText) {
    test(name, async () => {
      await runWithFakedTimers({}, async () => {
        disposables.add(languageFeaturesService.linkedEditingRangeProvider.register(mockFileSelector, {
          provideLinkedEditingRanges(model, pos) {
            const wordAtPos = model.getWordAtPosition(pos);
            if (wordAtPos) {
              const matches = model.findMatches(wordAtPos.word, false, false, true, USUAL_WORD_SEPARATORS, false);
              return { ranges: matches.map((m) => m.range), wordPattern: initialState.responseWordPattern };
            }
            return { ranges: [], wordPattern: initialState.responseWordPattern };
          }
        }));
        const editor = createMockEditor(initialState.text);
        editor.updateOptions({ linkedEditing: true });
        const linkedEditingContribution = disposables.add(editor.registerAndInstantiateContribution(
          LinkedEditingContribution.ID,
          LinkedEditingContribution
        ));
        linkedEditingContribution.setDebounceDuration(0);
        const testEditor = {
          setPosition(pos) {
            editor.setPosition(pos);
            return linkedEditingContribution.currentUpdateTriggerPromise;
          },
          setSelection(sel) {
            editor.setSelection(sel);
            return linkedEditingContribution.currentUpdateTriggerPromise;
          },
          trigger(source, handlerId, payload) {
            if (handlerId === Handler.Type || handlerId === Handler.Paste) {
              editor.trigger(source, handlerId, payload);
            } else if (handlerId === "deleteLeft") {
              CoreEditingCommands.DeleteLeft.runEditorCommand(null, editor, payload);
            } else if (handlerId === "deleteWordLeft") {
              instantiationService.invokeFunction((accessor) => new DeleteWordLeft().runEditorCommand(accessor, editor, payload));
            } else if (handlerId === "deleteAllLeft") {
              instantiationService.invokeFunction((accessor) => new DeleteAllLeftAction().runEditorCommand(accessor, editor, payload));
            } else {
              throw new Error(`Unknown handler ${handlerId}!`);
            }
            return linkedEditingContribution.currentSyncTriggerPromise;
          },
          undo() {
            CoreEditingCommands.Undo.runEditorCommand(null, editor, null);
          },
          redo() {
            CoreEditingCommands.Redo.runEditorCommand(null, editor, null);
          }
        };
        await operations(testEditor);
        return new Promise((resolve) => {
          setTimeout(() => {
            if (typeof expectedEndText === "string") {
              assert.strictEqual(editor.getModel().getValue(), expectedEndText);
            } else {
              assert.strictEqual(editor.getModel().getValue(), expectedEndText.join("\n"));
            }
            resolve();
          }, timeout);
        });
      });
    });
  }
  const state = {
    text: "<ooo></ooo>"
  };
  testCase("Simple insert - initial", state, async (editor) => {
    const pos = new Position(1, 2);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<iooo></iooo>");
  testCase("Simple insert - middle", state, async (editor) => {
    const pos = new Position(1, 3);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<oioo></oioo>");
  testCase("Simple insert - end", state, async (editor) => {
    const pos = new Position(1, 5);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<oooi></oooi>");
  testCase("Simple insert end - initial", state, async (editor) => {
    const pos = new Position(1, 8);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<iooo></iooo>");
  testCase("Simple insert end - middle", state, async (editor) => {
    const pos = new Position(1, 9);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<oioo></oioo>");
  testCase("Simple insert end - end", state, async (editor) => {
    const pos = new Position(1, 11);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<oooi></oooi>");
  testCase("Simple insert - out of boundary", state, async (editor) => {
    const pos = new Position(1, 1);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "i<ooo></ooo>");
  testCase("Simple insert - out of boundary 2", state, async (editor) => {
    const pos = new Position(1, 6);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<ooo>i</ooo>");
  testCase("Simple insert - out of boundary 3", state, async (editor) => {
    const pos = new Position(1, 7);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<ooo><i/ooo>");
  testCase("Simple insert - out of boundary 4", state, async (editor) => {
    const pos = new Position(1, 12);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<ooo></ooo>i");
  testCase("Continuous insert", state, async (editor) => {
    const pos = new Position(1, 2);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<iiooo></iiooo>");
  testCase("Insert - move - insert", state, async (editor) => {
    const pos = new Position(1, 2);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
    await editor.setPosition(new Position(1, 4));
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<ioioo></ioioo>");
  testCase("Insert - move - insert outside region", state, async (editor) => {
    const pos = new Position(1, 2);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
    await editor.setPosition(new Position(1, 7));
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<iooo>i</iooo>");
  testCase("Selection insert - simple", state, async (editor) => {
    const pos = new Position(1, 2);
    await editor.setPosition(pos);
    await editor.setSelection(new Range(1, 2, 1, 3));
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<ioo></ioo>");
  testCase("Selection insert - whole", state, async (editor) => {
    const pos = new Position(1, 2);
    await editor.setPosition(pos);
    await editor.setSelection(new Range(1, 2, 1, 5));
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<i></i>");
  testCase("Selection insert - across boundary", state, async (editor) => {
    const pos = new Position(1, 2);
    await editor.setPosition(pos);
    await editor.setSelection(new Range(1, 1, 1, 3));
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "ioo></oo>");
  testCase("Breakout - type space", state, async (editor) => {
    const pos = new Position(1, 5);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: " " });
  }, "<ooo ></ooo>");
  testCase("Breakout - type space then undo", state, async (editor) => {
    const pos = new Position(1, 5);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: " " });
    editor.undo();
  }, "<ooo></ooo>");
  testCase("Breakout - type space in middle", state, async (editor) => {
    const pos = new Position(1, 4);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: " " });
  }, "<oo o></ooo>");
  testCase("Breakout - paste content starting with space", state, async (editor) => {
    const pos = new Position(1, 5);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Paste, { text: ' i="i"' });
  }, '<ooo i="i"></ooo>');
  testCase("Breakout - paste content starting with space then undo", state, async (editor) => {
    const pos = new Position(1, 5);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Paste, { text: ' i="i"' });
    editor.undo();
  }, "<ooo></ooo>");
  testCase("Breakout - paste content starting with space in middle", state, async (editor) => {
    const pos = new Position(1, 4);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Paste, { text: " i" });
  }, "<oo io></ooo>");
  const state3 = {
    ...state,
    responseWordPattern: /[a-yA-Y]+/
  };
  testCase("Breakout with stop pattern - insert", state3, async (editor) => {
    const pos = new Position(1, 2);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<iooo></iooo>");
  testCase("Breakout with stop pattern - insert stop char", state3, async (editor) => {
    const pos = new Position(1, 2);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "z" });
  }, "<zooo></ooo>");
  testCase("Breakout with stop pattern - paste char", state3, async (editor) => {
    const pos = new Position(1, 2);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Paste, { text: "z" });
  }, "<zooo></ooo>");
  testCase("Breakout with stop pattern - paste string", state3, async (editor) => {
    const pos = new Position(1, 2);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Paste, { text: "zo" });
  }, "<zoooo></ooo>");
  testCase("Breakout with stop pattern - insert at end", state3, async (editor) => {
    const pos = new Position(1, 5);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "z" });
  }, "<oooz></ooo>");
  const state4 = {
    ...state,
    responseWordPattern: /[a-eA-E]+/
  };
  testCase("Breakout with stop pattern - insert stop char, respos", state4, async (editor) => {
    const pos = new Position(1, 2);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, "<iooo></ooo>");
  testCase("Delete - left char", state, async (editor) => {
    const pos = new Position(1, 5);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", "deleteLeft", {});
  }, "<oo></oo>");
  testCase("Delete - left char then undo", state, async (editor) => {
    const pos = new Position(1, 5);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", "deleteLeft", {});
    editor.undo();
  }, "<ooo></ooo>");
  testCase("Delete - left word", state, async (editor) => {
    const pos = new Position(1, 5);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", "deleteWordLeft", {});
  }, "<></>");
  testCase("Delete - left word then undo", state, async (editor) => {
    const pos = new Position(1, 5);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", "deleteWordLeft", {});
    editor.undo();
    editor.undo();
  }, "<ooo></ooo>");
  testCase("Delete - left all then undo twice", state, async (editor) => {
    const pos = new Position(1, 5);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", "deleteAllLeft", {});
    editor.undo();
    editor.undo();
  }, "<ooo></ooo>");
  testCase("Delete - selection", state, async (editor) => {
    const pos = new Position(1, 5);
    await editor.setPosition(pos);
    await editor.setSelection(new Range(1, 2, 1, 3));
    await editor.trigger("keyboard", "deleteLeft", {});
  }, "<oo></oo>");
  testCase("Delete - selection across boundary", state, async (editor) => {
    const pos = new Position(1, 3);
    await editor.setPosition(pos);
    await editor.setSelection(new Range(1, 1, 1, 3));
    await editor.trigger("keyboard", "deleteLeft", {});
  }, "oo></oo>");
  testCase("Undo/redo - simple undo", state, async (editor) => {
    const pos = new Position(1, 2);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
    editor.undo();
    editor.undo();
  }, "<ooo></ooo>");
  testCase("Undo/redo - simple undo/redo", state, async (editor) => {
    const pos = new Position(1, 2);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
    editor.undo();
    editor.redo();
  }, "<iooo></iooo>");
  const state2 = {
    text: [
      "<ooo>",
      "</ooo>"
    ]
  };
  testCase("Multiline insert", state2, async (editor) => {
    const pos = new Position(1, 2);
    await editor.setPosition(pos);
    await editor.trigger("keyboard", Handler.Type, { text: "i" });
  }, [
    "<iooo>",
    "</iooo>"
  ]);
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9saW5rZWRFZGl0aW5nL3Rlc3QvYnJvd3Nlci9saW5rZWRFZGl0aW5nLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IHJ1bldpdGhGYWtlZFRpbWVycyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdGltZVRyYXZlbFNjaGVkdWxlci5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IENvcmVFZGl0aW5nQ29tbWFuZHMgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2NvcmVDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFVTVUFMX1dPUkRfU0VQQVJBVE9SUyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3dvcmRIZWxwZXIuanMnO1xuaW1wb3J0IHsgSGFuZGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgRGVsZXRlQWxsTGVmdEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2xpbmVzT3BlcmF0aW9ucy9icm93c2VyL2xpbmVzT3BlcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBMaW5rZWRFZGl0aW5nQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9saW5rZWRFZGl0aW5nLmpzJztcbmltcG9ydCB7IERlbGV0ZVdvcmRMZWZ0IH0gZnJvbSAnLi4vLi4vLi4vd29yZE9wZXJhdGlvbnMvYnJvd3Nlci93b3JkT3BlcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBJVGVzdENvZGVFZGl0b3IsIGNyZWF0ZUNvZGVFZGl0b3JTZXJ2aWNlcywgaW5zdGFudGlhdGVUZXN0Q29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci90ZXN0Q29kZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBpbnN0YW50aWF0ZVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3Rlc3RUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuXG5jb25zdCBtb2NrRmlsZSA9IFVSSS5wYXJzZSgndGVzdDpzb21lZmlsZS50dHQnKTtcbmNvbnN0IG1vY2tGaWxlU2VsZWN0b3IgPSB7IHNjaGVtZTogJ3Rlc3QnIH07XG5jb25zdCB0aW1lb3V0ID0gMzA7XG5cbmludGVyZmFjZSBUZXN0RWRpdG9yIHtcblx0c2V0UG9zaXRpb24ocG9zOiBQb3NpdGlvbik6IFByb21pc2U8YW55Pjtcblx0c2V0U2VsZWN0aW9uKHNlbDogSVJhbmdlKTogUHJvbWlzZTxhbnk+O1xuXHR0cmlnZ2VyKHNvdXJjZTogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCwgaGFuZGxlcklkOiBzdHJpbmcsIHBheWxvYWQ6IGFueSk6IFByb21pc2U8YW55Pjtcblx0dW5kbygpOiB2b2lkO1xuXHRyZWRvKCk6IHZvaWQ7XG59XG5cbmNvbnN0IGxhbmd1YWdlSWQgPSAnbGlua2VkRWRpdGluZ1Rlc3RMYW5nYWdlJztcblxuc3VpdGUoJ2xpbmtlZCBlZGl0aW5nJywgKCkgPT4ge1xuXHRsZXQgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlO1xuXHRsZXQgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gY3JlYXRlQ29kZUVkaXRvclNlcnZpY2VzKGRpc3Bvc2FibGVzKTtcblx0XHRsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRcdGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIobGFuZ3VhZ2VJZCwge1xuXHRcdFx0d29yZFBhdHRlcm46IC9bYS16QS1aXSsvXG5cdFx0fSkpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRmdW5jdGlvbiBjcmVhdGVNb2NrRWRpdG9yKHRleHQ6IHN0cmluZyB8IHN0cmluZ1tdKTogSVRlc3RDb2RlRWRpdG9yIHtcblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgdHlwZW9mIHRleHQgPT09ICdzdHJpbmcnID8gdGV4dCA6IHRleHQuam9pbignXFxuJyksIGxhbmd1YWdlSWQsIHVuZGVmaW5lZCwgbW9ja0ZpbGUpKTtcblx0XHRjb25zdCBlZGl0b3IgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGVUZXN0Q29kZUVkaXRvcihpbnN0YW50aWF0aW9uU2VydmljZSwgbW9kZWwpKTtcblx0XHRyZXR1cm4gZWRpdG9yO1xuXHR9XG5cblx0ZnVuY3Rpb24gdGVzdENhc2UoXG5cdFx0bmFtZTogc3RyaW5nLFxuXHRcdGluaXRpYWxTdGF0ZTogeyB0ZXh0OiBzdHJpbmcgfCBzdHJpbmdbXTsgcmVzcG9uc2VXb3JkUGF0dGVybj86IFJlZ0V4cCB9LFxuXHRcdG9wZXJhdGlvbnM6IChlZGl0b3I6IFRlc3RFZGl0b3IpID0+IFByb21pc2U8dm9pZD4sXG5cdFx0ZXhwZWN0ZWRFbmRUZXh0OiBzdHJpbmcgfCBzdHJpbmdbXVxuXHQpIHtcblx0XHR0ZXN0KG5hbWUsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVycyh7fSwgYXN5bmMgKCkgPT4ge1xuXG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5saW5rZWRFZGl0aW5nUmFuZ2VQcm92aWRlci5yZWdpc3Rlcihtb2NrRmlsZVNlbGVjdG9yLCB7XG5cdFx0XHRcdFx0cHJvdmlkZUxpbmtlZEVkaXRpbmdSYW5nZXMobW9kZWw6IElUZXh0TW9kZWwsIHBvczogSVBvc2l0aW9uKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB3b3JkQXRQb3MgPSBtb2RlbC5nZXRXb3JkQXRQb3NpdGlvbihwb3MpO1xuXHRcdFx0XHRcdFx0aWYgKHdvcmRBdFBvcykge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBtYXRjaGVzID0gbW9kZWwuZmluZE1hdGNoZXMod29yZEF0UG9zLndvcmQsIGZhbHNlLCBmYWxzZSwgdHJ1ZSwgVVNVQUxfV09SRF9TRVBBUkFUT1JTLCBmYWxzZSk7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB7IHJhbmdlczogbWF0Y2hlcy5tYXAobSA9PiBtLnJhbmdlKSwgd29yZFBhdHRlcm46IGluaXRpYWxTdGF0ZS5yZXNwb25zZVdvcmRQYXR0ZXJuIH07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4geyByYW5nZXM6IFtdLCB3b3JkUGF0dGVybjogaW5pdGlhbFN0YXRlLnJlc3BvbnNlV29yZFBhdHRlcm4gfTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblxuXHRcdFx0XHRjb25zdCBlZGl0b3IgPSBjcmVhdGVNb2NrRWRpdG9yKGluaXRpYWxTdGF0ZS50ZXh0KTtcblx0XHRcdFx0ZWRpdG9yLnVwZGF0ZU9wdGlvbnMoeyBsaW5rZWRFZGl0aW5nOiB0cnVlIH0pO1xuXHRcdFx0XHRjb25zdCBsaW5rZWRFZGl0aW5nQ29udHJpYnV0aW9uID0gZGlzcG9zYWJsZXMuYWRkKGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKFxuXHRcdFx0XHRcdExpbmtlZEVkaXRpbmdDb250cmlidXRpb24uSUQsXG5cdFx0XHRcdFx0TGlua2VkRWRpdGluZ0NvbnRyaWJ1dGlvbixcblx0XHRcdFx0KSk7XG5cdFx0XHRcdGxpbmtlZEVkaXRpbmdDb250cmlidXRpb24uc2V0RGVib3VuY2VEdXJhdGlvbigwKTtcblxuXHRcdFx0XHRjb25zdCB0ZXN0RWRpdG9yOiBUZXN0RWRpdG9yID0ge1xuXHRcdFx0XHRcdHNldFBvc2l0aW9uKHBvczogUG9zaXRpb24pIHtcblx0XHRcdFx0XHRcdGVkaXRvci5zZXRQb3NpdGlvbihwb3MpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGxpbmtlZEVkaXRpbmdDb250cmlidXRpb24uY3VycmVudFVwZGF0ZVRyaWdnZXJQcm9taXNlO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0c2V0U2VsZWN0aW9uKHNlbDogSVJhbmdlKSB7XG5cdFx0XHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKHNlbCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbGlua2VkRWRpdGluZ0NvbnRyaWJ1dGlvbi5jdXJyZW50VXBkYXRlVHJpZ2dlclByb21pc2U7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR0cmlnZ2VyKHNvdXJjZTogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCwgaGFuZGxlcklkOiBzdHJpbmcsIHBheWxvYWQ6IGFueSkge1xuXHRcdFx0XHRcdFx0aWYgKGhhbmRsZXJJZCA9PT0gSGFuZGxlci5UeXBlIHx8IGhhbmRsZXJJZCA9PT0gSGFuZGxlci5QYXN0ZSkge1xuXHRcdFx0XHRcdFx0XHRlZGl0b3IudHJpZ2dlcihzb3VyY2UsIGhhbmRsZXJJZCwgcGF5bG9hZCk7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGhhbmRsZXJJZCA9PT0gJ2RlbGV0ZUxlZnQnKSB7XG5cdFx0XHRcdFx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuRGVsZXRlTGVmdC5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgcGF5bG9hZCk7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGhhbmRsZXJJZCA9PT0gJ2RlbGV0ZVdvcmRMZWZ0Jykge1xuXHRcdFx0XHRcdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbigoYWNjZXNzb3IpID0+IChuZXcgRGVsZXRlV29yZExlZnQoKSkucnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvciwgZWRpdG9yLCBwYXlsb2FkKSk7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGhhbmRsZXJJZCA9PT0gJ2RlbGV0ZUFsbExlZnQnKSB7XG5cdFx0XHRcdFx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKChhY2Nlc3NvcikgPT4gKG5ldyBEZWxldGVBbGxMZWZ0QWN0aW9uKCkpLnJ1bkVkaXRvckNvbW1hbmQoYWNjZXNzb3IsIGVkaXRvciwgcGF5bG9hZCkpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGhhbmRsZXIgJHtoYW5kbGVySWR9IWApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIGxpbmtlZEVkaXRpbmdDb250cmlidXRpb24uY3VycmVudFN5bmNUcmlnZ2VyUHJvbWlzZTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHVuZG8oKSB7XG5cdFx0XHRcdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlVuZG8ucnVuRWRpdG9yQ29tbWFuZChudWxsLCBlZGl0b3IsIG51bGwpO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0cmVkbygpIHtcblx0XHRcdFx0XHRcdENvcmVFZGl0aW5nQ29tbWFuZHMuUmVkby5ydW5FZGl0b3JDb21tYW5kKG51bGwsIGVkaXRvciwgbnVsbCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdGF3YWl0IG9wZXJhdGlvbnModGVzdEVkaXRvcik7XG5cblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG5cdFx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAodHlwZW9mIGV4cGVjdGVkRW5kVGV4dCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRWYWx1ZSgpLCBleHBlY3RlZEVuZFRleHQpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5nZXRNb2RlbCgpIS5nZXRWYWx1ZSgpLCBleHBlY3RlZEVuZFRleHQuam9pbignXFxuJykpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHRcdH0sIHRpbWVvdXQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0Y29uc3Qgc3RhdGUgPSB7XG5cdFx0dGV4dDogJzxvb28+PC9vb28+J1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTaW1wbGUgaW5zZXJ0aW9uXG5cdCAqL1xuXHR0ZXN0Q2FzZSgnU2ltcGxlIGluc2VydCAtIGluaXRpYWwnLCBzdGF0ZSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCAyKTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ2knIH0pO1xuXHR9LCAnPGlvb28+PC9pb29vPicpO1xuXG5cdHRlc3RDYXNlKCdTaW1wbGUgaW5zZXJ0IC0gbWlkZGxlJywgc3RhdGUsIGFzeW5jIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBwb3MgPSBuZXcgUG9zaXRpb24oMSwgMyk7XG5cdFx0YXdhaXQgZWRpdG9yLnNldFBvc2l0aW9uKHBvcyk7XG5cdFx0YXdhaXQgZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdpJyB9KTtcblx0fSwgJzxvaW9vPjwvb2lvbz4nKTtcblxuXHR0ZXN0Q2FzZSgnU2ltcGxlIGluc2VydCAtIGVuZCcsIHN0YXRlLCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKDEsIDUpO1xuXHRcdGF3YWl0IGVkaXRvci5zZXRQb3NpdGlvbihwb3MpO1xuXHRcdGF3YWl0IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnaScgfSk7XG5cdH0sICc8b29vaT48L29vb2k+Jyk7XG5cblx0LyoqXG5cdCAqIFNpbXBsZSBpbnNlcnRpb24gLSBlbmRcblx0ICovXG5cdHRlc3RDYXNlKCdTaW1wbGUgaW5zZXJ0IGVuZCAtIGluaXRpYWwnLCBzdGF0ZSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCA4KTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ2knIH0pO1xuXHR9LCAnPGlvb28+PC9pb29vPicpO1xuXG5cdHRlc3RDYXNlKCdTaW1wbGUgaW5zZXJ0IGVuZCAtIG1pZGRsZScsIHN0YXRlLCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKDEsIDkpO1xuXHRcdGF3YWl0IGVkaXRvci5zZXRQb3NpdGlvbihwb3MpO1xuXHRcdGF3YWl0IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnaScgfSk7XG5cdH0sICc8b2lvbz48L29pb28+Jyk7XG5cblx0dGVzdENhc2UoJ1NpbXBsZSBpbnNlcnQgZW5kIC0gZW5kJywgc3RhdGUsIGFzeW5jIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBwb3MgPSBuZXcgUG9zaXRpb24oMSwgMTEpO1xuXHRcdGF3YWl0IGVkaXRvci5zZXRQb3NpdGlvbihwb3MpO1xuXHRcdGF3YWl0IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnaScgfSk7XG5cdH0sICc8b29vaT48L29vb2k+Jyk7XG5cblx0LyoqXG5cdCAqIEJvdW5kYXJ5IGluc2VydGlvblxuXHQgKi9cblx0dGVzdENhc2UoJ1NpbXBsZSBpbnNlcnQgLSBvdXQgb2YgYm91bmRhcnknLCBzdGF0ZSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCAxKTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ2knIH0pO1xuXHR9LCAnaTxvb28+PC9vb28+Jyk7XG5cblx0dGVzdENhc2UoJ1NpbXBsZSBpbnNlcnQgLSBvdXQgb2YgYm91bmRhcnkgMicsIHN0YXRlLCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKDEsIDYpO1xuXHRcdGF3YWl0IGVkaXRvci5zZXRQb3NpdGlvbihwb3MpO1xuXHRcdGF3YWl0IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnaScgfSk7XG5cdH0sICc8b29vPmk8L29vbz4nKTtcblxuXHR0ZXN0Q2FzZSgnU2ltcGxlIGluc2VydCAtIG91dCBvZiBib3VuZGFyeSAzJywgc3RhdGUsIGFzeW5jIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBwb3MgPSBuZXcgUG9zaXRpb24oMSwgNyk7XG5cdFx0YXdhaXQgZWRpdG9yLnNldFBvc2l0aW9uKHBvcyk7XG5cdFx0YXdhaXQgZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdpJyB9KTtcblx0fSwgJzxvb28+PGkvb29vPicpO1xuXG5cdHRlc3RDYXNlKCdTaW1wbGUgaW5zZXJ0IC0gb3V0IG9mIGJvdW5kYXJ5IDQnLCBzdGF0ZSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCAxMik7XG5cdFx0YXdhaXQgZWRpdG9yLnNldFBvc2l0aW9uKHBvcyk7XG5cdFx0YXdhaXQgZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdpJyB9KTtcblx0fSwgJzxvb28+PC9vb28+aScpO1xuXG5cdC8qKlxuXHQgKiBJbnNlcnQgKyBNb3ZlXG5cdCAqL1xuXHR0ZXN0Q2FzZSgnQ29udGludW91cyBpbnNlcnQnLCBzdGF0ZSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCAyKTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ2knIH0pO1xuXHRcdGF3YWl0IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnaScgfSk7XG5cdH0sICc8aWlvb28+PC9paW9vbz4nKTtcblxuXHR0ZXN0Q2FzZSgnSW5zZXJ0IC0gbW92ZSAtIGluc2VydCcsIHN0YXRlLCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKDEsIDIpO1xuXHRcdGF3YWl0IGVkaXRvci5zZXRQb3NpdGlvbihwb3MpO1xuXHRcdGF3YWl0IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnaScgfSk7XG5cdFx0YXdhaXQgZWRpdG9yLnNldFBvc2l0aW9uKG5ldyBQb3NpdGlvbigxLCA0KSk7XG5cdFx0YXdhaXQgZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdpJyB9KTtcblx0fSwgJzxpb2lvbz48L2lvaW9vPicpO1xuXG5cdHRlc3RDYXNlKCdJbnNlcnQgLSBtb3ZlIC0gaW5zZXJ0IG91dHNpZGUgcmVnaW9uJywgc3RhdGUsIGFzeW5jIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBwb3MgPSBuZXcgUG9zaXRpb24oMSwgMik7XG5cdFx0YXdhaXQgZWRpdG9yLnNldFBvc2l0aW9uKHBvcyk7XG5cdFx0YXdhaXQgZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdpJyB9KTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDcpKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ2knIH0pO1xuXHR9LCAnPGlvb28+aTwvaW9vbz4nKTtcblxuXHQvKipcblx0ICogU2VsZWN0aW9uIGluc2VydFxuXHQgKi9cblx0dGVzdENhc2UoJ1NlbGVjdGlvbiBpbnNlcnQgLSBzaW1wbGUnLCBzdGF0ZSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCAyKTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBSYW5nZSgxLCAyLCAxLCAzKSk7XG5cdFx0YXdhaXQgZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICdpJyB9KTtcblx0fSwgJzxpb28+PC9pb28+Jyk7XG5cblx0dGVzdENhc2UoJ1NlbGVjdGlvbiBpbnNlcnQgLSB3aG9sZScsIHN0YXRlLCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKDEsIDIpO1xuXHRcdGF3YWl0IGVkaXRvci5zZXRQb3NpdGlvbihwb3MpO1xuXHRcdGF3YWl0IGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFJhbmdlKDEsIDIsIDEsIDUpKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ2knIH0pO1xuXHR9LCAnPGk+PC9pPicpO1xuXG5cdHRlc3RDYXNlKCdTZWxlY3Rpb24gaW5zZXJ0IC0gYWNyb3NzIGJvdW5kYXJ5Jywgc3RhdGUsIGFzeW5jIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBwb3MgPSBuZXcgUG9zaXRpb24oMSwgMik7XG5cdFx0YXdhaXQgZWRpdG9yLnNldFBvc2l0aW9uKHBvcyk7XG5cdFx0YXdhaXQgZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgUmFuZ2UoMSwgMSwgMSwgMykpO1xuXHRcdGF3YWl0IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnaScgfSk7XG5cdH0sICdpb28+PC9vbz4nKTtcblxuXHQvKipcblx0ICogQHRvZG9cblx0ICogVW5kZWZpbmVkIGJlaGF2aW9yXG5cdCAqL1xuXHQvLyB0ZXN0Q2FzZSgnU2VsZWN0aW9uIGluc2VydCAtIGFjcm9zcyB0d28gYm91bmRhcnknLCBzdGF0ZSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHQvLyBcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCAyKTtcblx0Ly8gXHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0Ly8gXHRhd2FpdCBsaW5rZWRFZGl0aW5nQ29udHJpYnV0aW9uLnVwZGF0ZUxpbmtlZFVJKHBvcyk7XG5cdC8vIFx0YXdhaXQgZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgUmFuZ2UoMSwgNCwgMSwgOSkpO1xuXHQvLyBcdGF3YWl0IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnaScgfSk7XG5cdC8vIH0sICc8b29pb28+Jyk7XG5cblx0LyoqXG5cdCAqIEJyZWFrIG91dCBiZWhhdmlvclxuXHQgKi9cblx0dGVzdENhc2UoJ0JyZWFrb3V0IC0gdHlwZSBzcGFjZScsIHN0YXRlLCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKDEsIDUpO1xuXHRcdGF3YWl0IGVkaXRvci5zZXRQb3NpdGlvbihwb3MpO1xuXHRcdGF3YWl0IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnICcgfSk7XG5cdH0sICc8b29vID48L29vbz4nKTtcblxuXHR0ZXN0Q2FzZSgnQnJlYWtvdXQgLSB0eXBlIHNwYWNlIHRoZW4gdW5kbycsIHN0YXRlLCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKDEsIDUpO1xuXHRcdGF3YWl0IGVkaXRvci5zZXRQb3NpdGlvbihwb3MpO1xuXHRcdGF3YWl0IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuVHlwZSwgeyB0ZXh0OiAnICcgfSk7XG5cdFx0ZWRpdG9yLnVuZG8oKTtcblx0fSwgJzxvb28+PC9vb28+Jyk7XG5cblx0dGVzdENhc2UoJ0JyZWFrb3V0IC0gdHlwZSBzcGFjZSBpbiBtaWRkbGUnLCBzdGF0ZSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCA0KTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJyAnIH0pO1xuXHR9LCAnPG9vIG8+PC9vb28+Jyk7XG5cblx0dGVzdENhc2UoJ0JyZWFrb3V0IC0gcGFzdGUgY29udGVudCBzdGFydGluZyB3aXRoIHNwYWNlJywgc3RhdGUsIGFzeW5jIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBwb3MgPSBuZXcgUG9zaXRpb24oMSwgNSk7XG5cdFx0YXdhaXQgZWRpdG9yLnNldFBvc2l0aW9uKHBvcyk7XG5cdFx0YXdhaXQgZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5QYXN0ZSwgeyB0ZXh0OiAnIGk9XCJpXCInIH0pO1xuXHR9LCAnPG9vbyBpPVwiaVwiPjwvb29vPicpO1xuXG5cdHRlc3RDYXNlKCdCcmVha291dCAtIHBhc3RlIGNvbnRlbnQgc3RhcnRpbmcgd2l0aCBzcGFjZSB0aGVuIHVuZG8nLCBzdGF0ZSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCA1KTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlBhc3RlLCB7IHRleHQ6ICcgaT1cImlcIicgfSk7XG5cdFx0ZWRpdG9yLnVuZG8oKTtcblx0fSwgJzxvb28+PC9vb28+Jyk7XG5cblx0dGVzdENhc2UoJ0JyZWFrb3V0IC0gcGFzdGUgY29udGVudCBzdGFydGluZyB3aXRoIHNwYWNlIGluIG1pZGRsZScsIHN0YXRlLCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKDEsIDQpO1xuXHRcdGF3YWl0IGVkaXRvci5zZXRQb3NpdGlvbihwb3MpO1xuXHRcdGF3YWl0IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuUGFzdGUsIHsgdGV4dDogJyBpJyB9KTtcblx0fSwgJzxvbyBpbz48L29vbz4nKTtcblxuXHQvKipcblx0ICogQnJlYWsgb3V0IHdpdGggY3VzdG9tIHByb3ZpZGVyIHdvcmRQYXR0ZXJuXG5cdCAqL1xuXG5cdGNvbnN0IHN0YXRlMyA9IHtcblx0XHQuLi5zdGF0ZSxcblx0XHRyZXNwb25zZVdvcmRQYXR0ZXJuOiAvW2EteUEtWV0rL1xuXHR9O1xuXG5cdHRlc3RDYXNlKCdCcmVha291dCB3aXRoIHN0b3AgcGF0dGVybiAtIGluc2VydCcsIHN0YXRlMywgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCAyKTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ2knIH0pO1xuXHR9LCAnPGlvb28+PC9pb29vPicpO1xuXG5cdHRlc3RDYXNlKCdCcmVha291dCB3aXRoIHN0b3AgcGF0dGVybiAtIGluc2VydCBzdG9wIGNoYXInLCBzdGF0ZTMsIGFzeW5jIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBwb3MgPSBuZXcgUG9zaXRpb24oMSwgMik7XG5cdFx0YXdhaXQgZWRpdG9yLnNldFBvc2l0aW9uKHBvcyk7XG5cdFx0YXdhaXQgZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICd6JyB9KTtcblx0fSwgJzx6b29vPjwvb29vPicpO1xuXG5cdHRlc3RDYXNlKCdCcmVha291dCB3aXRoIHN0b3AgcGF0dGVybiAtIHBhc3RlIGNoYXInLCBzdGF0ZTMsIGFzeW5jIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBwb3MgPSBuZXcgUG9zaXRpb24oMSwgMik7XG5cdFx0YXdhaXQgZWRpdG9yLnNldFBvc2l0aW9uKHBvcyk7XG5cdFx0YXdhaXQgZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5QYXN0ZSwgeyB0ZXh0OiAneicgfSk7XG5cdH0sICc8em9vbz48L29vbz4nKTtcblxuXHR0ZXN0Q2FzZSgnQnJlYWtvdXQgd2l0aCBzdG9wIHBhdHRlcm4gLSBwYXN0ZSBzdHJpbmcnLCBzdGF0ZTMsIGFzeW5jIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBwb3MgPSBuZXcgUG9zaXRpb24oMSwgMik7XG5cdFx0YXdhaXQgZWRpdG9yLnNldFBvc2l0aW9uKHBvcyk7XG5cdFx0YXdhaXQgZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5QYXN0ZSwgeyB0ZXh0OiAnem8nIH0pO1xuXHR9LCAnPHpvb29vPjwvb29vPicpO1xuXG5cdHRlc3RDYXNlKCdCcmVha291dCB3aXRoIHN0b3AgcGF0dGVybiAtIGluc2VydCBhdCBlbmQnLCBzdGF0ZTMsIGFzeW5jIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBwb3MgPSBuZXcgUG9zaXRpb24oMSwgNSk7XG5cdFx0YXdhaXQgZWRpdG9yLnNldFBvc2l0aW9uKHBvcyk7XG5cdFx0YXdhaXQgZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgSGFuZGxlci5UeXBlLCB7IHRleHQ6ICd6JyB9KTtcblx0fSwgJzxvb296Pjwvb29vPicpO1xuXG5cdGNvbnN0IHN0YXRlNCA9IHtcblx0XHQuLi5zdGF0ZSxcblx0XHRyZXNwb25zZVdvcmRQYXR0ZXJuOiAvW2EtZUEtRV0rL1xuXHR9O1xuXG5cdHRlc3RDYXNlKCdCcmVha291dCB3aXRoIHN0b3AgcGF0dGVybiAtIGluc2VydCBzdG9wIGNoYXIsIHJlc3BvcycsIHN0YXRlNCwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCAyKTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ2knIH0pO1xuXHR9LCAnPGlvb28+PC9vb28+Jyk7XG5cblx0LyoqXG5cdCAqIERlbGV0ZVxuXHQgKi9cblx0dGVzdENhc2UoJ0RlbGV0ZSAtIGxlZnQgY2hhcicsIHN0YXRlLCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKDEsIDUpO1xuXHRcdGF3YWl0IGVkaXRvci5zZXRQb3NpdGlvbihwb3MpO1xuXHRcdGF3YWl0IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsICdkZWxldGVMZWZ0Jywge30pO1xuXHR9LCAnPG9vPjwvb28+Jyk7XG5cblx0dGVzdENhc2UoJ0RlbGV0ZSAtIGxlZnQgY2hhciB0aGVuIHVuZG8nLCBzdGF0ZSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCA1KTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCAnZGVsZXRlTGVmdCcsIHt9KTtcblx0XHRlZGl0b3IudW5kbygpO1xuXHR9LCAnPG9vbz48L29vbz4nKTtcblxuXHR0ZXN0Q2FzZSgnRGVsZXRlIC0gbGVmdCB3b3JkJywgc3RhdGUsIGFzeW5jIChlZGl0b3IpID0+IHtcblx0XHRjb25zdCBwb3MgPSBuZXcgUG9zaXRpb24oMSwgNSk7XG5cdFx0YXdhaXQgZWRpdG9yLnNldFBvc2l0aW9uKHBvcyk7XG5cdFx0YXdhaXQgZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgJ2RlbGV0ZVdvcmRMZWZ0Jywge30pO1xuXHR9LCAnPD48Lz4nKTtcblxuXHR0ZXN0Q2FzZSgnRGVsZXRlIC0gbGVmdCB3b3JkIHRoZW4gdW5kbycsIHN0YXRlLCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKDEsIDUpO1xuXHRcdGF3YWl0IGVkaXRvci5zZXRQb3NpdGlvbihwb3MpO1xuXHRcdGF3YWl0IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsICdkZWxldGVXb3JkTGVmdCcsIHt9KTtcblx0XHRlZGl0b3IudW5kbygpO1xuXHRcdGVkaXRvci51bmRvKCk7XG5cdH0sICc8b29vPjwvb29vPicpO1xuXG5cdC8qKlxuXHQgKiBUb2RvOiBGaXggdGVzdFxuXHQgKi9cblx0Ly8gdGVzdENhc2UoJ0RlbGV0ZSAtIGxlZnQgYWxsJywgc3RhdGUsIGFzeW5jIChlZGl0b3IpID0+IHtcblx0Ly8gXHRjb25zdCBwb3MgPSBuZXcgUG9zaXRpb24oMSwgMyk7XG5cdC8vIFx0YXdhaXQgZWRpdG9yLnNldFBvc2l0aW9uKHBvcyk7XG5cdC8vIFx0YXdhaXQgbGlua2VkRWRpdGluZ0NvbnRyaWJ1dGlvbi51cGRhdGVMaW5rZWRVSShwb3MpO1xuXHQvLyBcdGF3YWl0IGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsICdkZWxldGVBbGxMZWZ0Jywge30pO1xuXHQvLyB9LCAnPjwvPicpO1xuXG5cdC8qKlxuXHQgKiBUb2RvOiBGaXggdGVzdFxuXHQgKi9cblx0Ly8gdGVzdENhc2UoJ0RlbGV0ZSAtIGxlZnQgYWxsIHRoZW4gdW5kbycsIHN0YXRlLCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdC8vIFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKDEsIDUpO1xuXHQvLyBcdGF3YWl0IGVkaXRvci5zZXRQb3NpdGlvbihwb3MpO1xuXHQvLyBcdGF3YWl0IGxpbmtlZEVkaXRpbmdDb250cmlidXRpb24udXBkYXRlTGlua2VkVUkocG9zKTtcblx0Ly8gXHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCAnZGVsZXRlQWxsTGVmdCcsIHt9KTtcblx0Ly8gXHRlZGl0b3IudW5kbygpO1xuXHQvLyB9LCAnPjwvb29vPicpO1xuXG5cdHRlc3RDYXNlKCdEZWxldGUgLSBsZWZ0IGFsbCB0aGVuIHVuZG8gdHdpY2UnLCBzdGF0ZSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCA1KTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCAnZGVsZXRlQWxsTGVmdCcsIHt9KTtcblx0XHRlZGl0b3IudW5kbygpO1xuXHRcdGVkaXRvci51bmRvKCk7XG5cdH0sICc8b29vPjwvb29vPicpO1xuXG5cdHRlc3RDYXNlKCdEZWxldGUgLSBzZWxlY3Rpb24nLCBzdGF0ZSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCA1KTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBSYW5nZSgxLCAyLCAxLCAzKSk7XG5cdFx0YXdhaXQgZWRpdG9yLnRyaWdnZXIoJ2tleWJvYXJkJywgJ2RlbGV0ZUxlZnQnLCB7fSk7XG5cdH0sICc8b28+PC9vbz4nKTtcblxuXHR0ZXN0Q2FzZSgnRGVsZXRlIC0gc2VsZWN0aW9uIGFjcm9zcyBib3VuZGFyeScsIHN0YXRlLCBhc3luYyAoZWRpdG9yKSA9PiB7XG5cdFx0Y29uc3QgcG9zID0gbmV3IFBvc2l0aW9uKDEsIDMpO1xuXHRcdGF3YWl0IGVkaXRvci5zZXRQb3NpdGlvbihwb3MpO1xuXHRcdGF3YWl0IGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFJhbmdlKDEsIDEsIDEsIDMpKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCAnZGVsZXRlTGVmdCcsIHt9KTtcblx0fSwgJ29vPjwvb28+Jyk7XG5cblx0LyoqXG5cdCAqIFVuZG8gLyByZWRvXG5cdCAqL1xuXHR0ZXN0Q2FzZSgnVW5kby9yZWRvIC0gc2ltcGxlIHVuZG8nLCBzdGF0ZSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCAyKTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ2knIH0pO1xuXHRcdGVkaXRvci51bmRvKCk7XG5cdFx0ZWRpdG9yLnVuZG8oKTtcblx0fSwgJzxvb28+PC9vb28+Jyk7XG5cblx0dGVzdENhc2UoJ1VuZG8vcmVkbyAtIHNpbXBsZSB1bmRvL3JlZG8nLCBzdGF0ZSwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCAyKTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ2knIH0pO1xuXHRcdGVkaXRvci51bmRvKCk7XG5cdFx0ZWRpdG9yLnJlZG8oKTtcblx0fSwgJzxpb29vPjwvaW9vbz4nKTtcblxuXHQvKipcblx0ICogTXVsdGkgbGluZVxuXHQgKi9cblx0Y29uc3Qgc3RhdGUyID0ge1xuXHRcdHRleHQ6IFtcblx0XHRcdCc8b29vPicsXG5cdFx0XHQnPC9vb28+J1xuXHRcdF1cblx0fTtcblxuXHR0ZXN0Q2FzZSgnTXVsdGlsaW5lIGluc2VydCcsIHN0YXRlMiwgYXN5bmMgKGVkaXRvcikgPT4ge1xuXHRcdGNvbnN0IHBvcyA9IG5ldyBQb3NpdGlvbigxLCAyKTtcblx0XHRhd2FpdCBlZGl0b3Iuc2V0UG9zaXRpb24ocG9zKTtcblx0XHRhd2FpdCBlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCBIYW5kbGVyLlR5cGUsIHsgdGV4dDogJ2knIH0pO1xuXHR9LCBbXG5cdFx0Jzxpb29vPicsXG5cdFx0JzwvaW9vbz4nXG5cdF0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQW9CLGdCQUFnQjtBQUNwQyxTQUFpQixhQUFhO0FBQzlCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZUFBZTtBQUN4QixTQUFTLHFDQUFxQztBQUU5QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDJCQUEy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
