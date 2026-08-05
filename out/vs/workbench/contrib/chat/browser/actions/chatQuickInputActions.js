import { Codicon } from "../../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { Selection } from "../../../../../editor/common/core/selection.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { CHAT_CATEGORY } from "./chatActions.js";
import { IQuickChatService } from "../chat.js";
import { ChatContextKeys } from "../../common/chatContextKeys.js";
const ASK_QUICK_QUESTION_ACTION_ID = "workbench.action.quickchat.toggle";
function registerQuickChatActions() {
  registerAction2(QuickChatGlobalAction);
  registerAction2(AskQuickChatAction);
  registerAction2(class OpenInChatViewAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.quickchat.openInChatView",
        title: localize2("chat.openInChatView.label", "Open in Chat View"),
        f1: false,
        category: CHAT_CATEGORY,
        icon: Codicon.commentDiscussion,
        menu: {
          id: MenuId.ChatInputSide,
          group: "navigation",
          order: 10
        }
      });
    }
    run(accessor) {
      const quickChatService = accessor.get(IQuickChatService);
      quickChatService.openInChatView();
    }
  });
  registerAction2(class CloseQuickChatAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.quickchat.close",
        title: localize2("chat.closeQuickChat.label", "Close Quick Chat"),
        f1: false,
        category: CHAT_CATEGORY,
        icon: Codicon.close,
        menu: {
          id: MenuId.ChatInputSide,
          group: "navigation",
          order: 20
        }
      });
    }
    run(accessor) {
      const quickChatService = accessor.get(IQuickChatService);
      quickChatService.close();
    }
  });
}
class QuickChatGlobalAction extends Action2 {
  constructor() {
    super({
      id: ASK_QUICK_QUESTION_ACTION_ID,
      title: localize2("quickChat", "Quick Chat"),
      precondition: ChatContextKeys.enabled,
      icon: Codicon.commentDiscussion,
      f1: false,
      category: CHAT_CATEGORY,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.KeyL
      },
      menu: {
        id: MenuId.ChatTitleBarMenu,
        group: "a_open",
        order: 4
      },
      metadata: {
        description: localize("toggle.desc", "Toggle the quick chat"),
        args: [{
          name: "args",
          schema: {
            anyOf: [
              {
                type: "object",
                required: ["query"],
                properties: {
                  query: {
                    description: localize("toggle.query", "The query to open the quick chat with"),
                    type: "string"
                  },
                  isPartialQuery: {
                    description: localize("toggle.isPartialQuery", "Whether the query is partial; it will wait for more user input"),
                    type: "boolean"
                  }
                }
              },
              {
                type: "string",
                description: localize("toggle.query", "The query to open the quick chat with")
              }
            ]
          }
        }]
      }
    });
  }
  run(accessor, query) {
    const quickChatService = accessor.get(IQuickChatService);
    let options;
    switch (typeof query) {
      case "string":
        options = { query };
        break;
      case "object":
        options = query;
        break;
    }
    if (options?.query) {
      options.selection = new Selection(1, options.query.length + 1, 1, options.query.length + 1);
    }
    quickChatService.toggle(options);
  }
}
class AskQuickChatAction extends Action2 {
  constructor() {
    super({
      id: `workbench.action.openQuickChat`,
      category: CHAT_CATEGORY,
      title: localize2("interactiveSession.open", "Open Quick Chat"),
      precondition: ChatContextKeys.enabled,
      f1: true
    });
  }
  run(accessor, query) {
    const quickChatService = accessor.get(IQuickChatService);
    quickChatService.toggle(query ? {
      query,
      selection: new Selection(1, query.length + 1, 1, query.length + 1)
    } : void 0);
  }
}
export {
  ASK_QUICK_QUESTION_ACTION_ID,
  registerQuickChatActions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0UXVpY2tJbnB1dEFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDSEFUX0NBVEVHT1JZIH0gZnJvbSAnLi9jaGF0QWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tDaGF0T3Blbk9wdGlvbnMsIElRdWlja0NoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vY2hhdC5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdENvbnRleHRLZXlzLmpzJztcblxuZXhwb3J0IGNvbnN0IEFTS19RVUlDS19RVUVTVElPTl9BQ1RJT05fSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5xdWlja2NoYXQudG9nZ2xlJztcbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclF1aWNrQ2hhdEFjdGlvbnMoKSB7XG5cdHJlZ2lzdGVyQWN0aW9uMihRdWlja0NoYXRHbG9iYWxBY3Rpb24pO1xuXHRyZWdpc3RlckFjdGlvbjIoQXNrUXVpY2tDaGF0QWN0aW9uKTtcblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgT3BlbkluQ2hhdFZpZXdBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnF1aWNrY2hhdC5vcGVuSW5DaGF0VmlldycsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2NoYXQub3BlbkluQ2hhdFZpZXcubGFiZWwnLCBcIk9wZW4gaW4gQ2hhdCBWaWV3XCIpLFxuXHRcdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLmNvbW1lbnREaXNjdXNzaW9uLFxuXHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0SW5wdXRTaWRlLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDEwXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdFx0Y29uc3QgcXVpY2tDaGF0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tDaGF0U2VydmljZSk7XG5cdFx0XHRxdWlja0NoYXRTZXJ2aWNlLm9wZW5JbkNoYXRWaWV3KCk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgQ2xvc2VRdWlja0NoYXRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnF1aWNrY2hhdC5jbG9zZScsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2NoYXQuY2xvc2VRdWlja0NoYXQubGFiZWwnLCBcIkNsb3NlIFF1aWNrIENoYXRcIiksXG5cdFx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRcdGljb246IENvZGljb24uY2xvc2UsXG5cdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRJbnB1dFNpZGUsXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRvcmRlcjogMjBcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRjb25zdCBxdWlja0NoYXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0NoYXRTZXJ2aWNlKTtcblx0XHRcdHF1aWNrQ2hhdFNlcnZpY2UuY2xvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG59XG5cbmNsYXNzIFF1aWNrQ2hhdEdsb2JhbEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQVNLX1FVSUNLX1FVRVNUSU9OX0FDVElPTl9JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3F1aWNrQ2hhdCcsICdRdWljayBDaGF0JyksXG5cdFx0XHRwcmVjb25kaXRpb246IENoYXRDb250ZXh0S2V5cy5lbmFibGVkLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5jb21tZW50RGlzY3Vzc2lvbixcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5LZXlMLFxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0VGl0bGVCYXJNZW51LFxuXHRcdFx0XHRncm91cDogJ2Ffb3BlbicsXG5cdFx0XHRcdG9yZGVyOiA0XG5cdFx0XHR9LFxuXHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0b2dnbGUuZGVzYycsICdUb2dnbGUgdGhlIHF1aWNrIGNoYXQnKSxcblx0XHRcdFx0YXJnczogW3tcblx0XHRcdFx0XHRuYW1lOiAnYXJncycsXG5cdFx0XHRcdFx0c2NoZW1hOiB7XG5cdFx0XHRcdFx0XHRhbnlPZjogW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0XHRcdFx0cmVxdWlyZWQ6IFsncXVlcnknXSxcblx0XHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRxdWVyeToge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3RvZ2dsZS5xdWVyeScsIFwiVGhlIHF1ZXJ5IHRvIG9wZW4gdGhlIHF1aWNrIGNoYXQgd2l0aFwiKSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRpc1BhcnRpYWxRdWVyeToge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3RvZ2dsZS5pc1BhcnRpYWxRdWVyeScsIFwiV2hldGhlciB0aGUgcXVlcnkgaXMgcGFydGlhbDsgaXQgd2lsbCB3YWl0IGZvciBtb3JlIHVzZXIgaW5wdXRcIiksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJ1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3RvZ2dsZS5xdWVyeScsIFwiVGhlIHF1ZXJ5IHRvIG9wZW4gdGhlIHF1aWNrIGNoYXQgd2l0aFwiKVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XVxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgcXVlcnk/OiBzdHJpbmcgfCBPbWl0PElRdWlja0NoYXRPcGVuT3B0aW9ucywgJ3NlbGVjdGlvbic+KTogdm9pZCB7XG5cdFx0Y29uc3QgcXVpY2tDaGF0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tDaGF0U2VydmljZSk7XG5cdFx0bGV0IG9wdGlvbnM6IElRdWlja0NoYXRPcGVuT3B0aW9ucyB8IHVuZGVmaW5lZDtcblx0XHRzd2l0Y2ggKHR5cGVvZiBxdWVyeSkge1xuXHRcdFx0Y2FzZSAnc3RyaW5nJzogb3B0aW9ucyA9IHsgcXVlcnkgfTsgYnJlYWs7XG5cdFx0XHRjYXNlICdvYmplY3QnOiBvcHRpb25zID0gcXVlcnk7IGJyZWFrO1xuXHRcdH1cblx0XHRpZiAob3B0aW9ucz8ucXVlcnkpIHtcblx0XHRcdG9wdGlvbnMuc2VsZWN0aW9uID0gbmV3IFNlbGVjdGlvbigxLCBvcHRpb25zLnF1ZXJ5Lmxlbmd0aCArIDEsIDEsIG9wdGlvbnMucXVlcnkubGVuZ3RoICsgMSk7XG5cdFx0fVxuXHRcdHF1aWNrQ2hhdFNlcnZpY2UudG9nZ2xlKG9wdGlvbnMpO1xuXHR9XG59XG5cbmNsYXNzIEFza1F1aWNrQ2hhdEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogYHdvcmtiZW5jaC5hY3Rpb24ub3BlblF1aWNrQ2hhdGAsXG5cdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ludGVyYWN0aXZlU2Vzc2lvbi5vcGVuJywgXCJPcGVuIFF1aWNrIENoYXRcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENoYXRDb250ZXh0S2V5cy5lbmFibGVkLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgcXVlcnk/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBxdWlja0NoYXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0NoYXRTZXJ2aWNlKTtcblx0XHRxdWlja0NoYXRTZXJ2aWNlLnRvZ2dsZShxdWVyeSA/IHtcblx0XHRcdHF1ZXJ5LFxuXHRcdFx0c2VsZWN0aW9uOiBuZXcgU2VsZWN0aW9uKDEsIHF1ZXJ5Lmxlbmd0aCArIDEsIDEsIHF1ZXJ5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
