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
import { VSBuffer } from "../../../../base/common/buffer.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { removeAnsiEscapeCodes } from "../../../../base/common/strings.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../nls.js";
import { ITestResultService } from "./testResultService.js";
import { TestMessageType } from "./testTypes.js";
import { TEST_DATA_SCHEME, TestUriType, parseTestUri } from "./testingUri.js";
let TestingContentProvider = class {
  constructor(textModelResolverService, languageService, modelService, resultService) {
    this.languageService = languageService;
    this.modelService = modelService;
    this.resultService = resultService;
    textModelResolverService.registerTextModelContentProvider(TEST_DATA_SCHEME, this);
  }
  /**
   * @inheritdoc
   */
  async provideTextContent(resource) {
    const existing = this.modelService.getModel(resource);
    if (existing && !existing.isDisposed()) {
      return existing;
    }
    const parsed = parseTestUri(resource);
    if (!parsed) {
      return null;
    }
    const result = this.resultService.getResult(parsed.resultId);
    if (!result) {
      return null;
    }
    if (parsed.type === TestUriType.TaskOutput) {
      const task = result.tasks[parsed.taskIndex];
      const model = this.modelService.createModel("", null, resource, false);
      const append = (text2) => model.applyEdits([{
        range: { startColumn: 1, endColumn: 1, startLineNumber: Infinity, endLineNumber: Infinity },
        text: text2
      }]);
      const init = VSBuffer.concat(task.output.buffers, task.output.length).toString();
      append(removeAnsiEscapeCodes(init));
      let hadContent = init.length > 0;
      const dispose = new DisposableStore();
      dispose.add(task.output.onDidWriteData((d) => {
        hadContent ||= d.byteLength > 0;
        append(removeAnsiEscapeCodes(d.toString()));
      }));
      task.output.endPromise.then(() => {
        if (dispose.isDisposed) {
          return;
        }
        if (!hadContent) {
          append(localize("runNoOutout", "The test run did not record any output."));
          dispose.dispose();
        }
      });
      model.onWillDispose(() => dispose.dispose());
      return model;
    }
    const test = result?.getStateById(parsed.testExtId);
    if (!test) {
      return null;
    }
    let text;
    let language = null;
    switch (parsed.type) {
      case TestUriType.ResultActualOutput: {
        const message = test.tasks[parsed.taskIndex].messages[parsed.messageIndex];
        if (message?.type === TestMessageType.Error) {
          text = message.actual;
        }
        break;
      }
      case TestUriType.TestOutput: {
        text = "";
        const output = result.tasks[parsed.taskIndex].output;
        for (const message of test.tasks[parsed.taskIndex].messages) {
          if (message.type === TestMessageType.Output) {
            text += removeAnsiEscapeCodes(output.getRange(message.offset, message.length).toString());
          }
        }
        break;
      }
      case TestUriType.ResultExpectedOutput: {
        const message = test.tasks[parsed.taskIndex].messages[parsed.messageIndex];
        if (message?.type === TestMessageType.Error) {
          text = message.expected;
        }
        break;
      }
      case TestUriType.ResultMessage: {
        const message = test.tasks[parsed.taskIndex].messages[parsed.messageIndex];
        if (!message) {
          break;
        }
        if (message.type === TestMessageType.Output) {
          const content = result.tasks[parsed.taskIndex].output.getRange(message.offset, message.length);
          text = removeAnsiEscapeCodes(content.toString());
        } else if (typeof message.message === "string") {
          text = removeAnsiEscapeCodes(message.message);
        } else {
          text = message.message.value;
          language = this.languageService.createById("markdown");
        }
      }
    }
    if (text === void 0) {
      return null;
    }
    return this.modelService.createModel(text, language, resource, false);
  }
};
TestingContentProvider = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, ILanguageService),
  __decorateParam(2, IModelService),
  __decorateParam(3, ITestResultService)
], TestingContentProvider);
export {
  TestingContentProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2NvbW1vbi90ZXN0aW5nQ29udGVudFByb3ZpZGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHJlbW92ZUFuc2lFc2NhcGVDb2RlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlbGVjdGlvbiwgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIsIElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElUZXN0UmVzdWx0U2VydmljZSB9IGZyb20gJy4vdGVzdFJlc3VsdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdE1lc3NhZ2VUeXBlIH0gZnJvbSAnLi90ZXN0VHlwZXMuanMnO1xuaW1wb3J0IHsgVEVTVF9EQVRBX1NDSEVNRSwgVGVzdFVyaVR5cGUsIHBhcnNlVGVzdFVyaSB9IGZyb20gJy4vdGVzdGluZ1VyaS5qcyc7XG5cbi8qKlxuICogQSBjb250ZW50IHByb3ZpZGVyIHRoYXQgcmV0dXJucyB2YXJpb3VzIG91dHB1dHMgZm9yIHRlc3RzLiBUaGlzIGlzIHVzZWRcbiAqIGluIHRoZSBpbmxpbmUgcGVlayB2aWV3LlxuICovXG5leHBvcnQgY2xhc3MgVGVzdGluZ0NvbnRlbnRQcm92aWRlciBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24sIElUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASVRlc3RSZXN1bHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcmVzdWx0U2VydmljZTogSVRlc3RSZXN1bHRTZXJ2aWNlLFxuXHQpIHtcblx0XHR0ZXh0TW9kZWxSZXNvbHZlclNlcnZpY2UucmVnaXN0ZXJUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIoVEVTVF9EQVRBX1NDSEVNRSwgdGhpcyk7XG5cdH1cblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyBhc3luYyBwcm92aWRlVGV4dENvbnRlbnQocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SVRleHRNb2RlbCB8IG51bGw+IHtcblx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMubW9kZWxTZXJ2aWNlLmdldE1vZGVsKHJlc291cmNlKTtcblx0XHRpZiAoZXhpc3RpbmcgJiYgIWV4aXN0aW5nLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0cmV0dXJuIGV4aXN0aW5nO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBhcnNlZCA9IHBhcnNlVGVzdFVyaShyZXNvdXJjZSk7XG5cdFx0aWYgKCFwYXJzZWQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMucmVzdWx0U2VydmljZS5nZXRSZXN1bHQocGFyc2VkLnJlc3VsdElkKTtcblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0aWYgKHBhcnNlZC50eXBlID09PSBUZXN0VXJpVHlwZS5UYXNrT3V0cHV0KSB7XG5cdFx0XHRjb25zdCB0YXNrID0gcmVzdWx0LnRhc2tzW3BhcnNlZC50YXNrSW5kZXhdO1xuXHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLm1vZGVsU2VydmljZS5jcmVhdGVNb2RlbCgnJywgbnVsbCwgcmVzb3VyY2UsIGZhbHNlKTtcblx0XHRcdGNvbnN0IGFwcGVuZCA9ICh0ZXh0OiBzdHJpbmcpID0+IG1vZGVsLmFwcGx5RWRpdHMoW3tcblx0XHRcdFx0cmFuZ2U6IHsgc3RhcnRDb2x1bW46IDEsIGVuZENvbHVtbjogMSwgc3RhcnRMaW5lTnVtYmVyOiBJbmZpbml0eSwgZW5kTGluZU51bWJlcjogSW5maW5pdHkgfSxcblx0XHRcdFx0dGV4dCxcblx0XHRcdH1dKTtcblxuXHRcdFx0Y29uc3QgaW5pdCA9IFZTQnVmZmVyLmNvbmNhdCh0YXNrLm91dHB1dC5idWZmZXJzLCB0YXNrLm91dHB1dC5sZW5ndGgpLnRvU3RyaW5nKCk7XG5cdFx0XHRhcHBlbmQocmVtb3ZlQW5zaUVzY2FwZUNvZGVzKGluaXQpKTtcblxuXHRcdFx0bGV0IGhhZENvbnRlbnQgPSBpbml0Lmxlbmd0aCA+IDA7XG5cdFx0XHRjb25zdCBkaXNwb3NlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0ZGlzcG9zZS5hZGQodGFzay5vdXRwdXQub25EaWRXcml0ZURhdGEoZCA9PiB7XG5cdFx0XHRcdGhhZENvbnRlbnQgfHw9IGQuYnl0ZUxlbmd0aCA+IDA7XG5cdFx0XHRcdGFwcGVuZChyZW1vdmVBbnNpRXNjYXBlQ29kZXMoZC50b1N0cmluZygpKSk7XG5cdFx0XHR9KSk7XG5cdFx0XHR0YXNrLm91dHB1dC5lbmRQcm9taXNlLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRpZiAoZGlzcG9zZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghaGFkQ29udGVudCkge1xuXHRcdFx0XHRcdGFwcGVuZChsb2NhbGl6ZSgncnVuTm9PdXRvdXQnLCAnVGhlIHRlc3QgcnVuIGRpZCBub3QgcmVjb3JkIGFueSBvdXRwdXQuJykpO1xuXHRcdFx0XHRcdGRpc3Bvc2UuZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdG1vZGVsLm9uV2lsbERpc3Bvc2UoKCkgPT4gZGlzcG9zZS5kaXNwb3NlKCkpO1xuXG5cdFx0XHRyZXR1cm4gbW9kZWw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGVzdCA9IHJlc3VsdD8uZ2V0U3RhdGVCeUlkKHBhcnNlZC50ZXN0RXh0SWQpO1xuXHRcdGlmICghdGVzdCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0bGV0IHRleHQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRsZXQgbGFuZ3VhZ2U6IElMYW5ndWFnZVNlbGVjdGlvbiB8IG51bGwgPSBudWxsO1xuXHRcdHN3aXRjaCAocGFyc2VkLnR5cGUpIHtcblx0XHRcdGNhc2UgVGVzdFVyaVR5cGUuUmVzdWx0QWN0dWFsT3V0cHV0OiB7XG5cdFx0XHRcdGNvbnN0IG1lc3NhZ2UgPSB0ZXN0LnRhc2tzW3BhcnNlZC50YXNrSW5kZXhdLm1lc3NhZ2VzW3BhcnNlZC5tZXNzYWdlSW5kZXhdO1xuXHRcdFx0XHRpZiAobWVzc2FnZT8udHlwZSA9PT0gVGVzdE1lc3NhZ2VUeXBlLkVycm9yKSB7IHRleHQgPSBtZXNzYWdlLmFjdHVhbDsgfVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgVGVzdFVyaVR5cGUuVGVzdE91dHB1dDoge1xuXHRcdFx0XHR0ZXh0ID0gJyc7XG5cdFx0XHRcdGNvbnN0IG91dHB1dCA9IHJlc3VsdC50YXNrc1twYXJzZWQudGFza0luZGV4XS5vdXRwdXQ7XG5cdFx0XHRcdGZvciAoY29uc3QgbWVzc2FnZSBvZiB0ZXN0LnRhc2tzW3BhcnNlZC50YXNrSW5kZXhdLm1lc3NhZ2VzKSB7XG5cdFx0XHRcdFx0aWYgKG1lc3NhZ2UudHlwZSA9PT0gVGVzdE1lc3NhZ2VUeXBlLk91dHB1dCkge1xuXHRcdFx0XHRcdFx0dGV4dCArPSByZW1vdmVBbnNpRXNjYXBlQ29kZXMob3V0cHV0LmdldFJhbmdlKG1lc3NhZ2Uub2Zmc2V0LCBtZXNzYWdlLmxlbmd0aCkudG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBUZXN0VXJpVHlwZS5SZXN1bHRFeHBlY3RlZE91dHB1dDoge1xuXHRcdFx0XHRjb25zdCBtZXNzYWdlID0gdGVzdC50YXNrc1twYXJzZWQudGFza0luZGV4XS5tZXNzYWdlc1twYXJzZWQubWVzc2FnZUluZGV4XTtcblx0XHRcdFx0aWYgKG1lc3NhZ2U/LnR5cGUgPT09IFRlc3RNZXNzYWdlVHlwZS5FcnJvcikgeyB0ZXh0ID0gbWVzc2FnZS5leHBlY3RlZDsgfVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgVGVzdFVyaVR5cGUuUmVzdWx0TWVzc2FnZToge1xuXHRcdFx0XHRjb25zdCBtZXNzYWdlID0gdGVzdC50YXNrc1twYXJzZWQudGFza0luZGV4XS5tZXNzYWdlc1twYXJzZWQubWVzc2FnZUluZGV4XTtcblx0XHRcdFx0aWYgKCFtZXNzYWdlKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAobWVzc2FnZS50eXBlID09PSBUZXN0TWVzc2FnZVR5cGUuT3V0cHV0KSB7XG5cdFx0XHRcdFx0Y29uc3QgY29udGVudCA9IHJlc3VsdC50YXNrc1twYXJzZWQudGFza0luZGV4XS5vdXRwdXQuZ2V0UmFuZ2UobWVzc2FnZS5vZmZzZXQsIG1lc3NhZ2UubGVuZ3RoKTtcblx0XHRcdFx0XHR0ZXh0ID0gcmVtb3ZlQW5zaUVzY2FwZUNvZGVzKGNvbnRlbnQudG9TdHJpbmcoKSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIG1lc3NhZ2UubWVzc2FnZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHR0ZXh0ID0gcmVtb3ZlQW5zaUVzY2FwZUNvZGVzKG1lc3NhZ2UubWVzc2FnZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGV4dCA9IG1lc3NhZ2UubWVzc2FnZS52YWx1ZTtcblx0XHRcdFx0XHRsYW5ndWFnZSA9IHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5SWQoJ21hcmtkb3duJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGV4dCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwodGV4dCwgbGFuZ3VhZ2UsIHJlc291cmNlLCBmYWxzZSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyw2QkFBNkI7QUFFdEMsU0FBNkIsd0JBQXdCO0FBRXJELFNBQVMscUJBQXFCO0FBQzlCLFNBQW9DLHlCQUF5QjtBQUM3RCxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGtCQUFrQixhQUFhLG9CQUFvQjtBQU1yRCxJQUFNLHlCQUFOLE1BQTBGO0FBQUEsRUFDaEcsWUFDb0IsMEJBQ2dCLGlCQUNILGNBQ0ssZUFDcEM7QUFIa0M7QUFDSDtBQUNLO0FBRXJDLDZCQUF5QixpQ0FBaUMsa0JBQWtCLElBQUk7QUFBQSxFQUNqRjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS0EsTUFBYSxtQkFBbUIsVUFBMkM7QUFDMUUsVUFBTSxXQUFXLEtBQUssYUFBYSxTQUFTLFFBQVE7QUFDcEQsUUFBSSxZQUFZLENBQUMsU0FBUyxXQUFXLEdBQUc7QUFDdkMsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLFNBQVMsYUFBYSxRQUFRO0FBQ3BDLFFBQUksQ0FBQyxRQUFRO0FBQ1osYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLFNBQVMsS0FBSyxjQUFjLFVBQVUsT0FBTyxRQUFRO0FBQzNELFFBQUksQ0FBQyxRQUFRO0FBQ1osYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLE9BQU8sU0FBUyxZQUFZLFlBQVk7QUFDM0MsWUFBTSxPQUFPLE9BQU8sTUFBTSxPQUFPLFNBQVM7QUFDMUMsWUFBTSxRQUFRLEtBQUssYUFBYSxZQUFZLElBQUksTUFBTSxVQUFVLEtBQUs7QUFDckUsWUFBTSxTQUFTLENBQUNBLFVBQWlCLE1BQU0sV0FBVyxDQUFDO0FBQUEsUUFDbEQsT0FBTyxFQUFFLGFBQWEsR0FBRyxXQUFXLEdBQUcsaUJBQWlCLFVBQVUsZUFBZSxTQUFTO0FBQUEsUUFDMUYsTUFBQUE7QUFBQSxNQUNELENBQUMsQ0FBQztBQUVGLFlBQU0sT0FBTyxTQUFTLE9BQU8sS0FBSyxPQUFPLFNBQVMsS0FBSyxPQUFPLE1BQU0sRUFBRSxTQUFTO0FBQy9FLGFBQU8sc0JBQXNCLElBQUksQ0FBQztBQUVsQyxVQUFJLGFBQWEsS0FBSyxTQUFTO0FBQy9CLFlBQU0sVUFBVSxJQUFJLGdCQUFnQjtBQUNwQyxjQUFRLElBQUksS0FBSyxPQUFPLGVBQWUsT0FBSztBQUMzQyx1QkFBZSxFQUFFLGFBQWE7QUFDOUIsZUFBTyxzQkFBc0IsRUFBRSxTQUFTLENBQUMsQ0FBQztBQUFBLE1BQzNDLENBQUMsQ0FBQztBQUNGLFdBQUssT0FBTyxXQUFXLEtBQUssTUFBTTtBQUNqQyxZQUFJLFFBQVEsWUFBWTtBQUN2QjtBQUFBLFFBQ0Q7QUFDQSxZQUFJLENBQUMsWUFBWTtBQUNoQixpQkFBTyxTQUFTLGVBQWUseUNBQXlDLENBQUM7QUFDekUsa0JBQVEsUUFBUTtBQUFBLFFBQ2pCO0FBQUEsTUFDRCxDQUFDO0FBQ0QsWUFBTSxjQUFjLE1BQU0sUUFBUSxRQUFRLENBQUM7QUFFM0MsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLE9BQU8sUUFBUSxhQUFhLE9BQU8sU0FBUztBQUNsRCxRQUFJLENBQUMsTUFBTTtBQUNWLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSTtBQUNKLFFBQUksV0FBc0M7QUFDMUMsWUFBUSxPQUFPLE1BQU07QUFBQSxNQUNwQixLQUFLLFlBQVksb0JBQW9CO0FBQ3BDLGNBQU0sVUFBVSxLQUFLLE1BQU0sT0FBTyxTQUFTLEVBQUUsU0FBUyxPQUFPLFlBQVk7QUFDekUsWUFBSSxTQUFTLFNBQVMsZ0JBQWdCLE9BQU87QUFBRSxpQkFBTyxRQUFRO0FBQUEsUUFBUTtBQUN0RTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLEtBQUssWUFBWSxZQUFZO0FBQzVCLGVBQU87QUFDUCxjQUFNLFNBQVMsT0FBTyxNQUFNLE9BQU8sU0FBUyxFQUFFO0FBQzlDLG1CQUFXLFdBQVcsS0FBSyxNQUFNLE9BQU8sU0FBUyxFQUFFLFVBQVU7QUFDNUQsY0FBSSxRQUFRLFNBQVMsZ0JBQWdCLFFBQVE7QUFDNUMsb0JBQVEsc0JBQXNCLE9BQU8sU0FBUyxRQUFRLFFBQVEsUUFBUSxNQUFNLEVBQUUsU0FBUyxDQUFDO0FBQUEsVUFDekY7QUFBQSxRQUNEO0FBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxLQUFLLFlBQVksc0JBQXNCO0FBQ3RDLGNBQU0sVUFBVSxLQUFLLE1BQU0sT0FBTyxTQUFTLEVBQUUsU0FBUyxPQUFPLFlBQVk7QUFDekUsWUFBSSxTQUFTLFNBQVMsZ0JBQWdCLE9BQU87QUFBRSxpQkFBTyxRQUFRO0FBQUEsUUFBVTtBQUN4RTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLEtBQUssWUFBWSxlQUFlO0FBQy9CLGNBQU0sVUFBVSxLQUFLLE1BQU0sT0FBTyxTQUFTLEVBQUUsU0FBUyxPQUFPLFlBQVk7QUFDekUsWUFBSSxDQUFDLFNBQVM7QUFDYjtBQUFBLFFBQ0Q7QUFFQSxZQUFJLFFBQVEsU0FBUyxnQkFBZ0IsUUFBUTtBQUM1QyxnQkFBTSxVQUFVLE9BQU8sTUFBTSxPQUFPLFNBQVMsRUFBRSxPQUFPLFNBQVMsUUFBUSxRQUFRLFFBQVEsTUFBTTtBQUM3RixpQkFBTyxzQkFBc0IsUUFBUSxTQUFTLENBQUM7QUFBQSxRQUNoRCxXQUFXLE9BQU8sUUFBUSxZQUFZLFVBQVU7QUFDL0MsaUJBQU8sc0JBQXNCLFFBQVEsT0FBTztBQUFBLFFBQzdDLE9BQU87QUFDTixpQkFBTyxRQUFRLFFBQVE7QUFDdkIscUJBQVcsS0FBSyxnQkFBZ0IsV0FBVyxVQUFVO0FBQUEsUUFDdEQ7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFFBQUksU0FBUyxRQUFXO0FBQ3ZCLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTyxLQUFLLGFBQWEsWUFBWSxNQUFNLFVBQVUsVUFBVSxLQUFLO0FBQUEsRUFDckU7QUFDRDtBQWhIYSx5QkFBTjtBQUFBLEVBRUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQUxVOyIsCiAgIm5hbWVzIjogWyJ0ZXh0Il0KfQo=
