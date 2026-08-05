import * as nls from "../../../../nls.js";
import { Range } from "../../../../editor/common/core/range.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { ITextMateTokenizationService } from "../../../services/textMate/browser/textMateTokenizationFeature.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { Constants } from "../../../../base/common/uint.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { INativeWorkbenchEnvironmentService } from "../../../services/environment/electron-sandbox/environmentService.js";
import { ILoggerService } from "../../../../platform/log/common/log.js";
import { joinPath } from "../../../../base/common/resources.js";
import { IFileService } from "../../../../platform/files/common/files.js";
const _StartDebugTextMate = class _StartDebugTextMate extends Action2 {
  constructor() {
    super({
      id: "editor.action.startDebugTextMate",
      title: nls.localize2("startDebugTextMate", "Start TextMate Syntax Grammar Logging"),
      category: Categories.Developer,
      f1: true
    });
  }
  _getOrCreateModel(modelService) {
    const model = modelService.getModel(_StartDebugTextMate.resource);
    if (model) {
      return model;
    }
    return modelService.createModel("", null, _StartDebugTextMate.resource);
  }
  _append(model, str) {
    const lineCount = model.getLineCount();
    model.applyEdits([{
      range: new Range(lineCount, Constants.MAX_SAFE_SMALL_INTEGER, lineCount, Constants.MAX_SAFE_SMALL_INTEGER),
      text: str
    }]);
  }
  async run(accessor) {
    const textMateService = accessor.get(ITextMateTokenizationService);
    const modelService = accessor.get(IModelService);
    const editorService = accessor.get(IEditorService);
    const codeEditorService = accessor.get(ICodeEditorService);
    const hostService = accessor.get(IHostService);
    const environmentService = accessor.get(INativeWorkbenchEnvironmentService);
    const loggerService = accessor.get(ILoggerService);
    const fileService = accessor.get(IFileService);
    const pathInTemp = joinPath(environmentService.tmpDir, `vcode-tm-log-${generateUuid()}.txt`);
    await fileService.createFile(pathInTemp);
    const logger = loggerService.createLogger(pathInTemp, { name: "debug textmate" });
    const model = this._getOrCreateModel(modelService);
    const append = (str) => {
      this._append(model, str + "\n");
      scrollEditor();
      logger.info(str);
      logger.flush();
    };
    await hostService.openWindow([{ fileUri: pathInTemp }], { forceNewWindow: true });
    const textEditorPane = await editorService.openEditor({
      resource: model.uri,
      options: { pinned: true }
    });
    if (!textEditorPane) {
      return;
    }
    const scrollEditor = () => {
      const editors = codeEditorService.listCodeEditors();
      for (const editor of editors) {
        if (editor.hasModel()) {
          if (editor.getModel().uri.toString() === _StartDebugTextMate.resource.toString()) {
            editor.revealLine(editor.getModel().getLineCount());
          }
        }
      }
    };
    append(`// Open the file you want to test to the side and watch here`);
    append(`// Output mirrored at ${pathInTemp}`);
    textMateService.startDebugMode(
      (str) => {
        this._append(model, str + "\n");
        scrollEditor();
        logger.info(str);
        logger.flush();
      },
      () => {
      }
    );
  }
};
_StartDebugTextMate.resource = URI.parse(`inmemory:///tm-log.txt`);
let StartDebugTextMate = _StartDebugTextMate;
registerAction2(StartDebugTextMate);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2VsZWN0cm9uLXNhbmRib3gvc3RhcnREZWJ1Z1RleHRNYXRlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IENhdGVnb3JpZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbkNvbW1vbkNhdGVnb3JpZXMuanMnO1xuaW1wb3J0IHsgSVRleHRNYXRlVG9rZW5pemF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3RleHRNYXRlL2Jyb3dzZXIvdGV4dE1hdGVUb2tlbml6YXRpb25GZWF0dXJlLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IENvbnN0YW50cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VpbnQuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2VsZWN0cm9uLXNhbmRib3gvZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dnZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgam9pblBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcblxuY2xhc3MgU3RhcnREZWJ1Z1RleHRNYXRlIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVzb3VyY2UgPSBVUkkucGFyc2UoYGlubWVtb3J5Oi8vL3RtLWxvZy50eHRgKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uc3RhcnREZWJ1Z1RleHRNYXRlJyxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdzdGFydERlYnVnVGV4dE1hdGUnLCBcIlN0YXJ0IFRleHRNYXRlIFN5bnRheCBHcmFtbWFyIExvZ2dpbmdcIiksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0T3JDcmVhdGVNb2RlbChtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UpOiBJVGV4dE1vZGVsIHtcblx0XHRjb25zdCBtb2RlbCA9IG1vZGVsU2VydmljZS5nZXRNb2RlbChTdGFydERlYnVnVGV4dE1hdGUucmVzb3VyY2UpO1xuXHRcdGlmIChtb2RlbCkge1xuXHRcdFx0cmV0dXJuIG1vZGVsO1xuXHRcdH1cblx0XHRyZXR1cm4gbW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKCcnLCBudWxsLCBTdGFydERlYnVnVGV4dE1hdGUucmVzb3VyY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBfYXBwZW5kKG1vZGVsOiBJVGV4dE1vZGVsLCBzdHI6IHN0cmluZykge1xuXHRcdGNvbnN0IGxpbmVDb3VudCA9IG1vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdG1vZGVsLmFwcGx5RWRpdHMoW3tcblx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UobGluZUNvdW50LCBDb25zdGFudHMuTUFYX1NBRkVfU01BTExfSU5URUdFUiwgbGluZUNvdW50LCBDb25zdGFudHMuTUFYX1NBRkVfU01BTExfSU5URUdFUiksXG5cdFx0XHR0ZXh0OiBzdHJcblx0XHR9XSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCB0ZXh0TWF0ZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRleHRNYXRlVG9rZW5pemF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgbW9kZWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElNb2RlbFNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvZGVFZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb2RlRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgaG9zdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUhvc3RTZXJ2aWNlKTtcblx0XHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5hdGl2ZVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSk7XG5cdFx0Y29uc3QgbG9nZ2VyU2VydmljZSA9IGFjY2Vzc29yLmdldChJTG9nZ2VyU2VydmljZSk7XG5cdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUZpbGVTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHBhdGhJblRlbXAgPSBqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudG1wRGlyLCBgdmNvZGUtdG0tbG9nLSR7Z2VuZXJhdGVVdWlkKCl9LnR4dGApO1xuXHRcdGF3YWl0IGZpbGVTZXJ2aWNlLmNyZWF0ZUZpbGUocGF0aEluVGVtcCk7XG5cdFx0Y29uc3QgbG9nZ2VyID0gbG9nZ2VyU2VydmljZS5jcmVhdGVMb2dnZXIocGF0aEluVGVtcCwgeyBuYW1lOiAnZGVidWcgdGV4dG1hdGUnIH0pO1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZ2V0T3JDcmVhdGVNb2RlbChtb2RlbFNlcnZpY2UpO1xuXHRcdGNvbnN0IGFwcGVuZCA9IChzdHI6IHN0cmluZykgPT4ge1xuXHRcdFx0dGhpcy5fYXBwZW5kKG1vZGVsLCBzdHIgKyAnXFxuJyk7XG5cdFx0XHRzY3JvbGxFZGl0b3IoKTtcblx0XHRcdGxvZ2dlci5pbmZvKHN0cik7XG5cdFx0XHRsb2dnZXIuZmx1c2goKTtcblx0XHR9O1xuXHRcdGF3YWl0IGhvc3RTZXJ2aWNlLm9wZW5XaW5kb3coW3sgZmlsZVVyaTogcGF0aEluVGVtcCB9XSwgeyBmb3JjZU5ld1dpbmRvdzogdHJ1ZSB9KTtcblx0XHRjb25zdCB0ZXh0RWRpdG9yUGFuZSA9IGF3YWl0IGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRyZXNvdXJjZTogbW9kZWwudXJpLFxuXHRcdFx0b3B0aW9uczogeyBwaW5uZWQ6IHRydWUgfVxuXHRcdH0pO1xuXHRcdGlmICghdGV4dEVkaXRvclBhbmUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgc2Nyb2xsRWRpdG9yID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgZWRpdG9ycyA9IGNvZGVFZGl0b3JTZXJ2aWNlLmxpc3RDb2RlRWRpdG9ycygpO1xuXHRcdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgZWRpdG9ycykge1xuXHRcdFx0XHRpZiAoZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0XHRpZiAoZWRpdG9yLmdldE1vZGVsKCkudXJpLnRvU3RyaW5nKCkgPT09IFN0YXJ0RGVidWdUZXh0TWF0ZS5yZXNvdXJjZS50b1N0cmluZygpKSB7XG5cdFx0XHRcdFx0XHRlZGl0b3IucmV2ZWFsTGluZShlZGl0b3IuZ2V0TW9kZWwoKS5nZXRMaW5lQ291bnQoKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGFwcGVuZChgLy8gT3BlbiB0aGUgZmlsZSB5b3Ugd2FudCB0byB0ZXN0IHRvIHRoZSBzaWRlIGFuZCB3YXRjaCBoZXJlYCk7XG5cdFx0YXBwZW5kKGAvLyBPdXRwdXQgbWlycm9yZWQgYXQgJHtwYXRoSW5UZW1wfWApO1xuXG5cdFx0dGV4dE1hdGVTZXJ2aWNlLnN0YXJ0RGVidWdNb2RlKFxuXHRcdFx0KHN0cikgPT4ge1xuXHRcdFx0XHR0aGlzLl9hcHBlbmQobW9kZWwsIHN0ciArICdcXG4nKTtcblx0XHRcdFx0c2Nyb2xsRWRpdG9yKCk7XG5cdFx0XHRcdGxvZ2dlci5pbmZvKHN0cik7XG5cdFx0XHRcdGxvZ2dlci5mbHVzaCgpO1xuXHRcdFx0fSxcblx0XHRcdCgpID0+IHtcblxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cbn1cblxucmVnaXN0ZXJBY3Rpb24yKFN0YXJ0RGVidWdUZXh0TWF0ZSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsU0FBUyx1QkFBdUI7QUFDekMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsMEJBQTBCO0FBRW5DLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsMENBQTBDO0FBQ25ELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsb0JBQW9CO0FBRzdCLE1BQU0sc0JBQU4sTUFBTSw0QkFBMkIsUUFBUTtBQUFBLEVBSXhDLGNBQWM7QUFDYixVQUFNO0FBQUEsTUFDTCxJQUFJO0FBQUEsTUFDSixPQUFPLElBQUksVUFBVSxzQkFBc0IsdUNBQXVDO0FBQUEsTUFDbEYsVUFBVSxXQUFXO0FBQUEsTUFDckIsSUFBSTtBQUFBLElBQ0wsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVRLGtCQUFrQixjQUF5QztBQUNsRSxVQUFNLFFBQVEsYUFB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
