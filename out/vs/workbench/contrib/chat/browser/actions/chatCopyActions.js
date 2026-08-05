import { localize2 } from "../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { CHAT_CATEGORY, stringifyItem } from "./chatActions.js";
import { IChatWidgetService } from "../chat.js";
import { ChatContextKeys } from "../../common/chatContextKeys.js";
import { isRequestVM, isResponseVM } from "../../common/chatViewModel.js";
function registerChatCopyActions() {
  registerAction2(class CopyAllAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.copyAll",
        title: localize2("interactive.copyAll.label", "Copy All"),
        f1: false,
        category: CHAT_CATEGORY,
        menu: {
          id: MenuId.ChatContext,
          when: ChatContextKeys.responseIsFiltered.toNegated(),
          group: "copy"
        }
      });
    }
    run(accessor, ...args) {
      const clipboardService = accessor.get(IClipboardService);
      const chatWidgetService = accessor.get(IChatWidgetService);
      const widget = chatWidgetService.lastFocusedWidget;
      if (widget) {
        const viewModel = widget.viewModel;
        const sessionAsText = viewModel?.getItems().filter((item) => isRequestVM(item) || isResponseVM(item) && !item.errorDetails?.responseIsFiltered).map((item) => stringifyItem(item)).join("\n\n");
        if (sessionAsText) {
          clipboardService.writeText(sessionAsText);
        }
      }
    }
  });
  registerAction2(class CopyItemAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.copyItem",
        title: localize2("interactive.copyItem.label", "Copy"),
        f1: false,
        category: CHAT_CATEGORY,
        menu: {
          id: MenuId.ChatContext,
          when: ChatContextKeys.responseIsFiltered.toNegated(),
          group: "copy"
        }
      });
    }
    run(accessor, ...args) {
      const item = args[0];
      if (!isRequestVM(item) && !isResponseVM(item)) {
        return;
      }
      const clipboardService = accessor.get(IClipboardService);
      const text = stringifyItem(item, false);
      clipboardService.writeText(text);
    }
  });
}
export {
  registerChatCopyActions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0Q29weUFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgTWVudUlkLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENIQVRfQ0FURUdPUlksIHN0cmluZ2lmeUl0ZW0gfSBmcm9tICcuL2NoYXRBY3Rpb25zLmpzJztcbmltcG9ydCB7IElDaGF0V2lkZ2V0U2VydmljZSB9IGZyb20gJy4uL2NoYXQuanMnO1xuaW1wb3J0IHsgQ2hhdENvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJQ2hhdFJlcXVlc3RWaWV3TW9kZWwsIElDaGF0UmVzcG9uc2VWaWV3TW9kZWwsIGlzUmVxdWVzdFZNLCBpc1Jlc3BvbnNlVk0gfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFZpZXdNb2RlbC5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckNoYXRDb3B5QWN0aW9ucygpIHtcblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIENvcHlBbGxBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuY29weUFsbCcsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ludGVyYWN0aXZlLmNvcHlBbGwubGFiZWwnLCBcIkNvcHkgQWxsXCIpLFxuXHRcdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0Q29udGV4dCxcblx0XHRcdFx0XHR3aGVuOiBDaGF0Q29udGV4dEtleXMucmVzcG9uc2VJc0ZpbHRlcmVkLnRvTmVnYXRlZCgpLFxuXHRcdFx0XHRcdGdyb3VwOiAnY29weScsXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRcdGNvbnN0IGNsaXBib2FyZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNsaXBib2FyZFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgY2hhdFdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHdpZGdldCA9IGNoYXRXaWRnZXRTZXJ2aWNlLmxhc3RGb2N1c2VkV2lkZ2V0O1xuXHRcdFx0aWYgKHdpZGdldCkge1xuXHRcdFx0XHRjb25zdCB2aWV3TW9kZWwgPSB3aWRnZXQudmlld01vZGVsO1xuXHRcdFx0XHRjb25zdCBzZXNzaW9uQXNUZXh0ID0gdmlld01vZGVsPy5nZXRJdGVtcygpXG5cdFx0XHRcdFx0LmZpbHRlcigoaXRlbSk6IGl0ZW0gaXMgKElDaGF0UmVxdWVzdFZpZXdNb2RlbCB8IElDaGF0UmVzcG9uc2VWaWV3TW9kZWwpID0+IGlzUmVxdWVzdFZNKGl0ZW0pIHx8IChpc1Jlc3BvbnNlVk0oaXRlbSkgJiYgIWl0ZW0uZXJyb3JEZXRhaWxzPy5yZXNwb25zZUlzRmlsdGVyZWQpKVxuXHRcdFx0XHRcdC5tYXAoaXRlbSA9PiBzdHJpbmdpZnlJdGVtKGl0ZW0pKVxuXHRcdFx0XHRcdC5qb2luKCdcXG5cXG4nKTtcblx0XHRcdFx0aWYgKHNlc3Npb25Bc1RleHQpIHtcblx0XHRcdFx0XHRjbGlwYm9hcmRTZXJ2aWNlLndyaXRlVGV4dChzZXNzaW9uQXNUZXh0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIENvcHlJdGVtQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LmNvcHlJdGVtJyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignaW50ZXJhY3RpdmUuY29weUl0ZW0ubGFiZWwnLCBcIkNvcHlcIiksXG5cdFx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRDb250ZXh0LFxuXHRcdFx0XHRcdHdoZW46IENoYXRDb250ZXh0S2V5cy5yZXNwb25zZUlzRmlsdGVyZWQudG9OZWdhdGVkKCksXG5cdFx0XHRcdFx0Z3JvdXA6ICdjb3B5Jyxcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdFx0Y29uc3QgaXRlbSA9IGFyZ3NbMF07XG5cdFx0XHRpZiAoIWlzUmVxdWVzdFZNKGl0ZW0pICYmICFpc1Jlc3BvbnNlVk0oaXRlbSkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjbGlwYm9hcmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDbGlwYm9hcmRTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHRleHQgPSBzdHJpbmdpZnlJdGVtKGl0ZW0sIGZhbHNlKTtcblx0XHRcdGNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KHRleHQpO1xuXHRcdH1cblx0fSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFDakQsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlLHFCQUFxQjtBQUM3QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUF3RCxhQUFhLG9CQUFvQjtBQUVsRixTQUFTLDBCQUEwQjtBQUN6QyxrQkFBZ0IsTUFBTSxzQkFBc0IsUUFBUTtBQUFBLElBQ25ELGNBQWM7QUFDYixZQUFNO0FBQUEsUUFDTCxJQUFJO0FBQUEsUUFDSixPQUFPLFVBQVUsNkJBQTZCLFVBQVU7QUFBQSxRQUN4RCxJQUFJO0FBQUEsUUFDSixVQUFVO0FBQUEsUUFDVixNQUFNO0FBQUEsVUFDTCxJQUFJLE9BQU87QUFBQSxVQUNYLE1BQU0sZ0JBQWdCLG1CQUFtQixVQUFVO0FBQUEsVUFDbkQsT0FBTztBQUFBLFFBQ1I7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGO0FBQUEsSUFFQSxJQUFJLGFBQStCLE1BQWE7QUFDL0MsWUFBTSxtQkFBbUIsU0FBUyxJQUFJLGlCQUFpQjtBQUN2RCxZQUFNLG9CQUFvQixTQUFTLElBQUksa0JBQWtCO0FBQ3pELFlBQU0sU0FBUyxrQkFBa0I7QUFDakMsVUFBSSxRQUFRO0FBQ1gsY0FBTSxZQUFZLE9BQU87QUFDekIsY0FBTSxnQkFBZ0IsV0FBVyxTQUFTLEVBQ3hDLE9BQU8sQ0FBQyxTQUFtRSxZQUFZLElBQUksS0FBTSxhQUFhLElBQUksS0FBSyxDQUFDLEtBQUssY0FBYyxrQkFBbUIsRUFDOUosSUFBSSxVQUFRLGNBQWMsSUFBSSxDQUFDLEVBQy9CLEtBQUssTUFBTTtBQUNiLFlBQUksZUFBZTtBQUNsQiwyQkFBaUIsVUFBVSxhQUFhO0FBQUEsUUFDekM7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELGtCQUFnQixNQUFNLHVCQUF1QixRQUFRO0FBQUEsSUFDcEQsY0FBYztBQUNiLFlBQU07QUFBQSxRQUNMLElBQUk7QUFBQSxRQUNKLE9BQU8sVUFBVSw4QkFBOEIsTUFBTTtBQUFBLFFBQ3JELElBQUk7QUFBQSxRQUNKLFVBQVU7QUFBQSxRQUNWLE1BQU07QUFBQSxVQUNMLElBQUksT0FBTztBQUFBLFVBQ1gsTUFBTSxnQkFBZ0IsbUJBQW1CLFVBQVU7QUFBQSxVQUNuRCxPQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0Y7QUFBQSxJQUVBLElBQUksYUFBK0IsTUFBYTtBQUMvQyxZQUFNLE9BQU8sS0FBSyxDQUFDO0FBQ25CLFVBQUksQ0FBQyxZQUFZLElBQUksS0FBSyxDQUFDLGFBQWEsSUFBSSxHQUFHO0FBQzlDO0FBQUEsTUFDRDtBQUVBLFlBQU0sbUJBQW1CLFNBQVMsSUFBSSxpQkFBaUI7QUFDdkQsWUFBTSxPQUFPLGNBQWMsTUFBTSxLQUFLO0FBQ3RDLHVCQUFpQixVQUFVLElBQUk7QUFBQSxJQUNoQztBQUFBLEVBQ0QsQ0FBQztBQUNGOyIsCiAgIm5hbWVzIjogW10KfQo=
