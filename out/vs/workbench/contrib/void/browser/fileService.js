import { localize2 } from "../../../../nls.js";
import { Action2, registerAction2, MenuId } from "../../../../platform/actions/common/actions.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IDirectoryStrService } from "../common/directoryStrService.js";
import { messageOfSelection } from "../common/prompt/prompts.js";
import { IVoidModelService } from "../common/voidModelService.js";
const _FilePromptActionService = class _FilePromptActionService extends Action2 {
  constructor() {
    super({
      id: _FilePromptActionService.VOID_COPY_FILE_PROMPT_ID,
      title: localize2("voidCopyPrompt", "Plaxio: Copy Prompt"),
      menu: [{
        id: MenuId.ExplorerContext,
        group: "8_void",
        order: 1
      }]
    });
  }
  async run(accessor, uri) {
    try {
      const fileService = accessor.get(IFileService);
      const clipboardService = accessor.get(IClipboardService);
      const directoryStrService = accessor.get(IDirectoryStrService);
      const voidModelService = accessor.get(IVoidModelService);
      const stat = await fileService.stat(uri);
      const folderOpts = {
        maxChildren: 1e3,
        maxCharsPerFile: 2e6
      };
      let m = "No contents detected";
      if (stat.isFile) {
        m = await messageOfSelection({
          type: "File",
          uri,
          language: (await voidModelService.getModelSafe(uri)).model?.getLanguageId() || "",
          state: { wasAddedAsCurrentFile: false }
        }, {
          folderOpts,
          directoryStrService,
          fileService
        });
      }
      if (stat.isDirectory) {
        m = await messageOfSelection({
          type: "Folder",
          uri
        }, {
          folderOpts,
          fileService,
          directoryStrService
        });
      }
      await clipboardService.writeText(m);
    } catch (error) {
      const notificationService = accessor.get(INotificationService);
      notificationService.error(error + "");
    }
  }
};
_FilePromptActionService.VOID_COPY_FILE_PROMPT_ID = "void.copyfileprompt";
let FilePromptActionService = _FilePromptActionService;
registerAction2(FilePromptActionService);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvZmlsZVNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgcmVnaXN0ZXJBY3Rpb24yLCBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElEaXJlY3RvcnlTdHJTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2RpcmVjdG9yeVN0clNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbWVzc2FnZU9mU2VsZWN0aW9uIH0gZnJvbSAnLi4vY29tbW9uL3Byb21wdC9wcm9tcHRzLmpzJztcbmltcG9ydCB7IElWb2lkTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3ZvaWRNb2RlbFNlcnZpY2UuanMnO1xuXG5cblxuY2xhc3MgRmlsZVByb21wdEFjdGlvblNlcnZpY2UgZXh0ZW5kcyBBY3Rpb24yIHtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgVk9JRF9DT1BZX0ZJTEVfUFJPTVBUX0lEID0gJ3ZvaWQuY29weWZpbGVwcm9tcHQnXG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEZpbGVQcm9tcHRBY3Rpb25TZXJ2aWNlLlZPSURfQ09QWV9GSUxFX1BST01QVF9JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3ZvaWRDb3B5UHJvbXB0JywgJ1ZvaWQ6IENvcHkgUHJvbXB0JyksXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkV4cGxvcmVyQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICc4X3ZvaWQnLFxuXHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHVyaTogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0XHRjb25zdCBjbGlwYm9hcmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDbGlwYm9hcmRTZXJ2aWNlKVxuXHRcdFx0Y29uc3QgZGlyZWN0b3J5U3RyU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlyZWN0b3J5U3RyU2VydmljZSlcblx0XHRcdGNvbnN0IHZvaWRNb2RlbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZvaWRNb2RlbFNlcnZpY2UpXG5cblx0XHRcdGNvbnN0IHN0YXQgPSBhd2FpdCBmaWxlU2VydmljZS5zdGF0KHVyaSlcblxuXHRcdFx0Y29uc3QgZm9sZGVyT3B0cyA9IHtcblx0XHRcdFx0bWF4Q2hpbGRyZW46IDEwMDAsXG5cdFx0XHRcdG1heENoYXJzUGVyRmlsZTogMl8wMDBfMDAwLFxuXHRcdFx0fSBhcyBjb25zdFxuXG5cdFx0XHRsZXQgbTogc3RyaW5nID0gJ05vIGNvbnRlbnRzIGRldGVjdGVkJ1xuXHRcdFx0aWYgKHN0YXQuaXNGaWxlKSB7XG5cdFx0XHRcdG0gPSBhd2FpdCBtZXNzYWdlT2ZTZWxlY3Rpb24oe1xuXHRcdFx0XHRcdHR5cGU6ICdGaWxlJyxcblx0XHRcdFx0XHR1cmksXG5cdFx0XHRcdFx0bGFuZ3VhZ2U6IChhd2FpdCB2b2lkTW9kZWxTZXJ2aWNlLmdldE1vZGVsU2FmZSh1cmkpKS5tb2RlbD8uZ2V0TGFuZ3VhZ2VJZCgpIHx8ICcnLFxuXHRcdFx0XHRcdHN0YXRlOiB7IHdhc0FkZGVkQXNDdXJyZW50RmlsZTogZmFsc2UsIH0sXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRmb2xkZXJPcHRzLFxuXHRcdFx0XHRcdGRpcmVjdG9yeVN0clNlcnZpY2UsXG5cdFx0XHRcdFx0ZmlsZVNlcnZpY2UsXG5cdFx0XHRcdH0pXG5cdFx0XHR9XG5cblx0XHRcdGlmIChzdGF0LmlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdG0gPSBhd2FpdCBtZXNzYWdlT2ZTZWxlY3Rpb24oe1xuXHRcdFx0XHRcdHR5cGU6ICdGb2xkZXInLFxuXHRcdFx0XHRcdHVyaSxcblx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdGZvbGRlck9wdHMsXG5cdFx0XHRcdFx0ZmlsZVNlcnZpY2UsXG5cdFx0XHRcdFx0ZGlyZWN0b3J5U3RyU2VydmljZSxcblx0XHRcdFx0fSlcblx0XHRcdH1cblxuXHRcdFx0YXdhaXQgY2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQobSlcblxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RpZmljYXRpb25TZXJ2aWNlKVxuXHRcdFx0bm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlcnJvciArICcnKVxuXHRcdH1cblx0fVxuXG59XG5cbnJlZ2lzdGVyQWN0aW9uMihGaWxlUHJvbXB0QWN0aW9uU2VydmljZSlcbiJdLAogICJtYXBwaW5ncyI6ICJBQUFBLFNBQVMsaUJBQWlCO0FBRTFCLFNBQVMsU0FBUyxpQkFBaUIsY0FBYztBQUVqRCxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHlCQUF5QjtBQUlsQyxNQUFNLDJCQUFOLE1BQU0saUNBQWdDLFFBQVE7QUFBQSxFQUc3QyxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSSx5QkFBd0I7QUFBQSxNQUM1QixPQUFPLFVBQVUsa0JBQWtCLG1CQUFtQjtBQUFBLE1BQ3RELE1BQU0sQ0FBQztBQUFBLFFBQ04sSUFBSSxPQUFPO0FBQUEsUUFDWCxPQUFPO0FBQUEsUUFDUCxPQUFPO0FBQUEsTUFDUixDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBTSxJQUFJLFVBQTRCLEtBQXlCO0FBQzlELFFBQUk7QUFDSCxZQUFNLGNBQWMsU0FBUyxJQUFJLFlBQVk7QUFDN0MsWUFBTSxtQkFBbUIsU0FBUyxJQUFJLGlCQUFpQjtBQUN2RCxZQUFNLHNCQUFzQixTQUFTLElBQUksb0JBQW9CO0FBQzdELFlBQU0sbUJBQW1CLFNBQVMsSUFBSSxpQkFBaUI7QUFFdkQsWUFBTSxPQUFPLE1BQU0sWUFBWSxLQUFLLEdBQUc7QUFFdkMsWUFBTSxhQUFhO0FBQUEsUUFDbEIsYUFBYTtBQUFBLFFBQ2IsaUJBQWlCO0FBQUEsTUFDbEI7QUFFQSxVQUFJLElBQVk7QUFDaEIsVUFBSSxLQUFLLFFBQVE7QUFDaEIsWUFBSSxNQUFNLG1CQUFtQjtBQUFBLFVBQzVCLE1BQU07QUFBQSxVQUNOO0FBQUEsVUFDQSxXQUFXLE1BQU0saUJBQWlCLGFBQWEsR0FBRyxHQUFHLE9BQU8sY0FBYyxLQUFLO0FBQUEsVUFDL0UsT0FBTyxFQUFFLHVCQUF1QixNQUFPO0FBQUEsUUFDeEMsR0FBRztBQUFBLFVBQ0Y7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0Y7QUFFQSxVQUFJLEtBQUssYUFBYTtBQUNyQixZQUFJLE1BQU0sbUJBQW1CO0FBQUEsVUFDNUIsTUFBTTtBQUFBLFVBQ047QUFBQSxRQUNELEdBQUc7QUFBQSxVQUNGO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNELENBQUM7QUFBQSxNQUNGO0FBRUEsWUFBTSxpQkFBaUIsVUFBVSxDQUFDO0FBQUEsSUFFbkMsU0FBUyxPQUFPO0FBQ2YsWUFBTSxzQkFBc0IsU0FBUyxJQUFJLG9CQUFvQjtBQUM3RCwwQkFBb0IsTUFBTSxRQUFRLEVBQUU7QUFBQSxJQUNyQztBQUFBLEVBQ0Q7QUFFRDtBQTlETSx5QkFDbUIsMkJBQTJCO0FBRHBELElBQU0sMEJBQU47QUFnRUEsZ0JBQWdCLHVCQUF1QjsiLAogICJuYW1lcyI6IFtdCn0K
