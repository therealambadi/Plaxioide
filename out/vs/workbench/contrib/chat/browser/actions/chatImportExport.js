import { VSBuffer } from "../../../../../base/common/buffer.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IFileDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { CHAT_CATEGORY } from "./chatActions.js";
import { IChatWidgetService } from "../chat.js";
import { ChatEditorInput } from "../chatEditorInput.js";
import { ChatContextKeys } from "../../common/chatContextKeys.js";
import { isExportableSessionData } from "../../common/chatModel.js";
import { IChatService } from "../../common/chatService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
const defaultFileName = "chat.json";
const filters = [{ name: localize("chat.file.label", "Chat Session"), extensions: ["json"] }];
function registerChatExportActions() {
  registerAction2(class ExportChatAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.export",
        category: CHAT_CATEGORY,
        title: localize2("chat.export.label", "Export Chat..."),
        precondition: ChatContextKeys.enabled,
        f1: true
      });
    }
    async run(accessor, ...args) {
      const widgetService = accessor.get(IChatWidgetService);
      const fileDialogService = accessor.get(IFileDialogService);
      const fileService = accessor.get(IFileService);
      const chatService = accessor.get(IChatService);
      const widget = widgetService.lastFocusedWidget;
      if (!widget || !widget.viewModel) {
        return;
      }
      const defaultUri = joinPath(await fileDialogService.defaultFilePath(), defaultFileName);
      const result = await fileDialogService.showSaveDialog({
        defaultUri,
        filters
      });
      if (!result) {
        return;
      }
      const model = chatService.getSession(widget.viewModel.sessionId);
      if (!model) {
        return;
      }
      const content = VSBuffer.fromString(JSON.stringify(model.toExport(), void 0, 2));
      await fileService.writeFile(result, content);
    }
  });
  registerAction2(class ImportChatAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.import",
        title: localize2("chat.import.label", "Import Chat..."),
        category: CHAT_CATEGORY,
        precondition: ChatContextKeys.enabled,
        f1: true
      });
    }
    async run(accessor, ...args) {
      const fileDialogService = accessor.get(IFileDialogService);
      const fileService = accessor.get(IFileService);
      const editorService = accessor.get(IEditorService);
      const defaultUri = joinPath(await fileDialogService.defaultFilePath(), defaultFileName);
      const result = await fileDialogService.showOpenDialog({
        defaultUri,
        canSelectFiles: true,
        filters
      });
      if (!result) {
        return;
      }
      const content = await fileService.readFile(result[0]);
      try {
        const data = JSON.parse(content.value.toString());
        if (!isExportableSessionData(data)) {
          throw new Error("Invalid chat session data");
        }
        const options = { target: { data }, pinned: true };
        await editorService.openEditor({ resource: ChatEditorInput.getNewEditorUri(), options });
      } catch (err) {
        throw err;
      }
    }
  });
}
export {
  registerChatExportActions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0SW1wb3J0RXhwb3J0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgam9pblBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElGaWxlRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IENIQVRfQ0FURUdPUlkgfSBmcm9tICcuL2NoYXRBY3Rpb25zLmpzJztcbmltcG9ydCB7IElDaGF0V2lkZ2V0U2VydmljZSB9IGZyb20gJy4uL2NoYXQuanMnO1xuaW1wb3J0IHsgSUNoYXRFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vY2hhdEVkaXRvci5qcyc7XG5pbXBvcnQgeyBDaGF0RWRpdG9ySW5wdXQgfSBmcm9tICcuLi9jaGF0RWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgQ2hhdENvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBpc0V4cG9ydGFibGVTZXNzaW9uRGF0YSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUNoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcblxuY29uc3QgZGVmYXVsdEZpbGVOYW1lID0gJ2NoYXQuanNvbic7XG5jb25zdCBmaWx0ZXJzID0gW3sgbmFtZTogbG9jYWxpemUoJ2NoYXQuZmlsZS5sYWJlbCcsIFwiQ2hhdCBTZXNzaW9uXCIpLCBleHRlbnNpb25zOiBbJ2pzb24nXSB9XTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyQ2hhdEV4cG9ydEFjdGlvbnMoKSB7XG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBFeHBvcnRDaGF0QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LmV4cG9ydCcsXG5cdFx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjaGF0LmV4cG9ydC5sYWJlbCcsIFwiRXhwb3J0IENoYXQuLi5cIiksXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogQ2hhdENvbnRleHRLZXlzLmVuYWJsZWQsXG5cdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRcdGNvbnN0IHdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGZpbGVEaWFsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElGaWxlRGlhbG9nU2VydmljZSk7XG5cdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgY2hhdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3Qgd2lkZ2V0ID0gd2lkZ2V0U2VydmljZS5sYXN0Rm9jdXNlZFdpZGdldDtcblx0XHRcdGlmICghd2lkZ2V0IHx8ICF3aWRnZXQudmlld01vZGVsKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZGVmYXVsdFVyaSA9IGpvaW5QYXRoKGF3YWl0IGZpbGVEaWFsb2dTZXJ2aWNlLmRlZmF1bHRGaWxlUGF0aCgpLCBkZWZhdWx0RmlsZU5hbWUpO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgZmlsZURpYWxvZ1NlcnZpY2Uuc2hvd1NhdmVEaWFsb2coe1xuXHRcdFx0XHRkZWZhdWx0VXJpLFxuXHRcdFx0XHRmaWx0ZXJzXG5cdFx0XHR9KTtcblx0XHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbW9kZWwgPSBjaGF0U2VydmljZS5nZXRTZXNzaW9uKHdpZGdldC52aWV3TW9kZWwuc2Vzc2lvbklkKTtcblx0XHRcdGlmICghbW9kZWwpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBVc2luZyB0b0pTT04gb24gdGhlIG1vZGVsXG5cdFx0XHRjb25zdCBjb250ZW50ID0gVlNCdWZmZXIuZnJvbVN0cmluZyhKU09OLnN0cmluZ2lmeShtb2RlbC50b0V4cG9ydCgpLCB1bmRlZmluZWQsIDIpKTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZShyZXN1bHQsIGNvbnRlbnQpO1xuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEltcG9ydENoYXRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuaW1wb3J0Jyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignY2hhdC5pbXBvcnQubGFiZWwnLCBcIkltcG9ydCBDaGF0Li4uXCIpLFxuXHRcdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDaGF0Q29udGV4dEtleXMuZW5hYmxlZCxcblx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdFx0Y29uc3QgZmlsZURpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUZpbGVEaWFsb2dTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgZGVmYXVsdFVyaSA9IGpvaW5QYXRoKGF3YWl0IGZpbGVEaWFsb2dTZXJ2aWNlLmRlZmF1bHRGaWxlUGF0aCgpLCBkZWZhdWx0RmlsZU5hbWUpO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgZmlsZURpYWxvZ1NlcnZpY2Uuc2hvd09wZW5EaWFsb2coe1xuXHRcdFx0XHRkZWZhdWx0VXJpLFxuXHRcdFx0XHRjYW5TZWxlY3RGaWxlczogdHJ1ZSxcblx0XHRcdFx0ZmlsdGVyc1xuXHRcdFx0fSk7XG5cdFx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBmaWxlU2VydmljZS5yZWFkRmlsZShyZXN1bHRbMF0pO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgZGF0YSA9IEpTT04ucGFyc2UoY29udGVudC52YWx1ZS50b1N0cmluZygpKTtcblx0XHRcdFx0aWYgKCFpc0V4cG9ydGFibGVTZXNzaW9uRGF0YShkYXRhKSkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjaGF0IHNlc3Npb24gZGF0YScpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgb3B0aW9uczogSUNoYXRFZGl0b3JPcHRpb25zID0geyB0YXJnZXQ6IHsgZGF0YSB9LCBwaW5uZWQ6IHRydWUgfTtcblx0XHRcdFx0YXdhaXQgZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2U6IENoYXRFZGl0b3JJbnB1dC5nZXROZXdFZGl0b3JVcmkoKSwgb3B0aW9ucyB9KTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHR0aHJvdyBlcnI7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0JBQWdCO0FB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
