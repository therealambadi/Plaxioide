import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { IAccessibleViewService, AccessibleViewProviderId, AccessibleViewType, AccessibleContentProvider } from "../../../../platform/accessibility/browser/accessibleView.js";
import { IAccessibilitySignalService, AccessibilitySignal } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IListService, WorkbenchList } from "../../../../platform/list/browser/listService.js";
import { getNotificationFromContext } from "./notificationsCommands.js";
import { NotificationFocusedContext } from "../../../common/contextkeys.js";
class NotificationAccessibleView {
  constructor() {
    this.priority = 90;
    this.name = "notifications";
    this.when = NotificationFocusedContext;
    this.type = AccessibleViewType.View;
  }
  getProvider(accessor) {
    const accessibleViewService = accessor.get(IAccessibleViewService);
    const listService = accessor.get(IListService);
    const commandService = accessor.get(ICommandService);
    const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
    function getProvider() {
      const notification = getNotificationFromContext(listService);
      if (!notification) {
        return;
      }
      commandService.executeCommand("notifications.showList");
      let notificationIndex;
      const list = listService.lastFocusedList;
      if (list instanceof WorkbenchList) {
        notificationIndex = list.indexOf(notification);
      }
      if (notificationIndex === void 0) {
        return;
      }
      function focusList() {
        commandService.executeCommand("notifications.showList");
        if (list && notificationIndex !== void 0) {
          list.domFocus();
          try {
            list.setFocus([notificationIndex]);
          } catch {
          }
        }
      }
      function getContentForNotification() {
        const notification2 = getNotificationFromContext(listService);
        const message = notification2?.message.original.toString();
        if (!notification2) {
          return;
        }
        return notification2.source ? localize("notification.accessibleViewSrc", "{0} Source: {1}", message, notification2.source) : localize("notification.accessibleView", "{0}", message);
      }
      const content = getContentForNotification();
      if (!content) {
        return;
      }
      notification.onDidClose(() => accessibleViewService.next());
      return new AccessibleContentProvider(
        AccessibleViewProviderId.Notification,
        { type: AccessibleViewType.View },
        () => content,
        () => focusList(),
        "accessibility.verbosity.notification",
        void 0,
        getActionsFromNotification(notification, accessibilitySignalService),
        () => {
          if (!list) {
            return;
          }
          focusList();
          list.focusNext();
          return getContentForNotification();
        },
        () => {
          if (!list) {
            return;
          }
          focusList();
          list.focusPrevious();
          return getContentForNotification();
        }
      );
    }
    return getProvider();
  }
}
function getActionsFromNotification(notification, accessibilitySignalService) {
  let actions = void 0;
  if (notification.actions) {
    actions = [];
    if (notification.actions.primary) {
      actions.push(...notification.actions.primary);
    }
    if (notification.actions.secondary) {
      actions.push(...notification.actions.secondary);
    }
  }
  if (actions) {
    for (const action of actions) {
      action.class = ThemeIcon.asClassName(Codicon.bell);
      const initialAction = action.run;
      action.run = () => {
        initialAction();
        notification.close();
      };
    }
  }
  const manageExtension = actions?.find((a) => a.label.includes("Manage Extension"));
  if (manageExtension) {
    manageExtension.class = ThemeIcon.asClassName(Codicon.gear);
  }
  if (actions) {
    actions.push({
      id: "clearNotification",
      label: localize("clearNotification", "Clear Notification"),
      tooltip: localize("clearNotification", "Clear Notification"),
      run: () => {
        notification.close();
        accessibilitySignalService.playSignal(AccessibilitySignal.clear);
      },
      enabled: true,
      class: ThemeIcon.asClassName(Codicon.clearAll)
    });
  }
  return actions;
}
export {
  NotificationAccessibleView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9ub3RpZmljYXRpb25zL25vdGlmaWNhdGlvbkFjY2Vzc2libGVWaWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJsZVZpZXdTZXJ2aWNlLCBBY2Nlc3NpYmxlVmlld1Byb3ZpZGVySWQsIEFjY2Vzc2libGVWaWV3VHlwZSwgQWNjZXNzaWJsZUNvbnRlbnRQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmxlVmlldy5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJsZVZpZXdJbXBsZW1lbnRhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmxlVmlld1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSwgQWNjZXNzaWJpbGl0eVNpZ25hbCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHlTaWduYWwvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxpc3RTZXJ2aWNlLCBXb3JrYmVuY2hMaXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGdldE5vdGlmaWNhdGlvbkZyb21Db250ZXh0IH0gZnJvbSAnLi9ub3RpZmljYXRpb25zQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgTm90aWZpY2F0aW9uRm9jdXNlZENvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGlmaWNhdGlvbnMuanMnO1xuXG5leHBvcnQgY2xhc3MgTm90aWZpY2F0aW9uQWNjZXNzaWJsZVZpZXcgaW1wbGVtZW50cyBJQWNjZXNzaWJsZVZpZXdJbXBsZW1lbnRhdGlvbiB7XG5cdHJlYWRvbmx5IHByaW9yaXR5ID0gOTA7XG5cdHJlYWRvbmx5IG5hbWUgPSAnbm90aWZpY2F0aW9ucyc7XG5cdHJlYWRvbmx5IHdoZW4gPSBOb3RpZmljYXRpb25Gb2N1c2VkQ29udGV4dDtcblx0cmVhZG9ubHkgdHlwZSA9IEFjY2Vzc2libGVWaWV3VHlwZS5WaWV3O1xuXHRnZXRQcm92aWRlcihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGNvbnN0IGFjY2Vzc2libGVWaWV3U2VydmljZSA9IGFjY2Vzc29yLmdldChJQWNjZXNzaWJsZVZpZXdTZXJ2aWNlKTtcblx0XHRjb25zdCBsaXN0U2VydmljZSA9IGFjY2Vzc29yLmdldChJTGlzdFNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0Y29uc3QgYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlKTtcblxuXHRcdGZ1bmN0aW9uIGdldFByb3ZpZGVyKCkge1xuXHRcdFx0Y29uc3Qgbm90aWZpY2F0aW9uID0gZ2V0Tm90aWZpY2F0aW9uRnJvbUNvbnRleHQobGlzdFNlcnZpY2UpO1xuXHRcdFx0aWYgKCFub3RpZmljYXRpb24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ25vdGlmaWNhdGlvbnMuc2hvd0xpc3QnKTtcblx0XHRcdGxldCBub3RpZmljYXRpb25JbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgbGlzdCA9IGxpc3RTZXJ2aWNlLmxhc3RGb2N1c2VkTGlzdDtcblx0XHRcdGlmIChsaXN0IGluc3RhbmNlb2YgV29ya2JlbmNoTGlzdCkge1xuXHRcdFx0XHRub3RpZmljYXRpb25JbmRleCA9IGxpc3QuaW5kZXhPZihub3RpZmljYXRpb24pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG5vdGlmaWNhdGlvbkluZGV4ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiBmb2N1c0xpc3QoKTogdm9pZCB7XG5cdFx0XHRcdGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCdub3RpZmljYXRpb25zLnNob3dMaXN0Jyk7XG5cdFx0XHRcdGlmIChsaXN0ICYmIG5vdGlmaWNhdGlvbkluZGV4ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRsaXN0LmRvbUZvY3VzKCk7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGxpc3Quc2V0Rm9jdXMoW25vdGlmaWNhdGlvbkluZGV4XSk7XG5cdFx0XHRcdFx0fSBjYXRjaCB7IH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiBnZXRDb250ZW50Rm9yTm90aWZpY2F0aW9uKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0XHRcdGNvbnN0IG5vdGlmaWNhdGlvbiA9IGdldE5vdGlmaWNhdGlvbkZyb21Db250ZXh0KGxpc3RTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgbWVzc2FnZSA9IG5vdGlmaWNhdGlvbj8ubWVzc2FnZS5vcmlnaW5hbC50b1N0cmluZygpO1xuXHRcdFx0XHRpZiAoIW5vdGlmaWNhdGlvbikge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbm90aWZpY2F0aW9uLnNvdXJjZSA/IGxvY2FsaXplKCdub3RpZmljYXRpb24uYWNjZXNzaWJsZVZpZXdTcmMnLCAnezB9IFNvdXJjZTogezF9JywgbWVzc2FnZSwgbm90aWZpY2F0aW9uLnNvdXJjZSkgOiBsb2NhbGl6ZSgnbm90aWZpY2F0aW9uLmFjY2Vzc2libGVWaWV3JywgJ3swfScsIG1lc3NhZ2UpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY29udGVudCA9IGdldENvbnRlbnRGb3JOb3RpZmljYXRpb24oKTtcblx0XHRcdGlmICghY29udGVudCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRub3RpZmljYXRpb24ub25EaWRDbG9zZSgoKSA9PiBhY2Nlc3NpYmxlVmlld1NlcnZpY2UubmV4dCgpKTtcblx0XHRcdHJldHVybiBuZXcgQWNjZXNzaWJsZUNvbnRlbnRQcm92aWRlcihcblx0XHRcdFx0QWNjZXNzaWJsZVZpZXdQcm92aWRlcklkLk5vdGlmaWNhdGlvbixcblx0XHRcdFx0eyB0eXBlOiBBY2Nlc3NpYmxlVmlld1R5cGUuVmlldyB9LFxuXHRcdFx0XHQoKSA9PiBjb250ZW50LFxuXHRcdFx0XHQoKSA9PiBmb2N1c0xpc3QoKSxcblx0XHRcdFx0J2FjY2Vzc2liaWxpdHkudmVyYm9zaXR5Lm5vdGlmaWNhdGlvbicsXG5cdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0Z2V0QWN0aW9uc0Zyb21Ob3RpZmljYXRpb24obm90aWZpY2F0aW9uLCBhY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSksXG5cdFx0XHRcdCgpID0+IHtcblx0XHRcdFx0XHRpZiAoIWxpc3QpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Zm9jdXNMaXN0KCk7XG5cdFx0XHRcdFx0bGlzdC5mb2N1c05leHQoKTtcblx0XHRcdFx0XHRyZXR1cm4gZ2V0Q29udGVudEZvck5vdGlmaWNhdGlvbigpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHQoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKCFsaXN0KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGZvY3VzTGlzdCgpO1xuXHRcdFx0XHRcdGxpc3QuZm9jdXNQcmV2aW91cygpO1xuXHRcdFx0XHRcdHJldHVybiBnZXRDb250ZW50Rm9yTm90aWZpY2F0aW9uKCk7XG5cdFx0XHRcdH0sXG5cdFx0XHQpO1xuXHRcdH1cblx0XHRyZXR1cm4gZ2V0UHJvdmlkZXIoKTtcblx0fVxufVxuXG5cbmZ1bmN0aW9uIGdldEFjdGlvbnNGcm9tTm90aWZpY2F0aW9uKG5vdGlmaWNhdGlvbjogSU5vdGlmaWNhdGlvblZpZXdJdGVtLCBhY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZTogSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlKTogSUFjdGlvbltdIHwgdW5kZWZpbmVkIHtcblx0bGV0IGFjdGlvbnMgPSB1bmRlZmluZWQ7XG5cdGlmIChub3RpZmljYXRpb24uYWN0aW9ucykge1xuXHRcdGFjdGlvbnMgPSBbXTtcblx0XHRpZiAobm90aWZpY2F0aW9uLmFjdGlvbnMucHJpbWFyeSkge1xuXHRcdFx0YWN0aW9ucy5wdXNoKC4uLm5vdGlmaWNhdGlvbi5hY3Rpb25zLnByaW1hcnkpO1xuXHRcdH1cblx0XHRpZiAobm90aWZpY2F0aW9uLmFjdGlvbnMuc2Vjb25kYXJ5KSB7XG5cdFx0XHRhY3Rpb25zLnB1c2goLi4ubm90aWZpY2F0aW9uLmFjdGlvbnMuc2Vjb25kYXJ5KTtcblx0XHR9XG5cdH1cblx0aWYgKGFjdGlvbnMpIHtcblx0XHRmb3IgKGNvbnN0IGFjdGlvbiBvZiBhY3Rpb25zKSB7XG5cdFx0XHRhY3Rpb24uY2xhc3MgPSBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5iZWxsKTtcblx0XHRcdGNvbnN0IGluaXRpYWxBY3Rpb24gPSBhY3Rpb24ucnVuO1xuXHRcdFx0YWN0aW9uLnJ1biA9ICgpID0+IHtcblx0XHRcdFx0aW5pdGlhbEFjdGlvbigpO1xuXHRcdFx0XHRub3RpZmljYXRpb24uY2xvc2UoKTtcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cdGNvbnN0IG1hbmFnZUV4dGVuc2lvbiA9IGFjdGlvbnM/LmZpbmQoYSA9PiBhLmxhYmVsLmluY2x1ZGVzKCdNYW5hZ2UgRXh0ZW5zaW9uJykpO1xuXHRpZiAobWFuYWdlRXh0ZW5zaW9uKSB7XG5cdFx0bWFuYWdlRXh0ZW5zaW9uLmNsYXNzID0gVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uZ2Vhcik7XG5cdH1cblx0aWYgKGFjdGlvbnMpIHtcblx0XHRhY3Rpb25zLnB1c2goe1xuXHRcdFx0aWQ6ICdjbGVhck5vdGlmaWNhdGlvbicsIGxhYmVsOiBsb2NhbGl6ZSgnY2xlYXJOb3RpZmljYXRpb24nLCBcIkNsZWFyIE5vdGlmaWNhdGlvblwiKSwgdG9vbHRpcDogbG9jYWxpemUoJ2NsZWFyTm90aWZpY2F0aW9uJywgXCJDbGVhciBOb3RpZmljYXRpb25cIiksIHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRub3RpZmljYXRpb24uY2xvc2UoKTtcblx0XHRcdFx0YWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLmNsZWFyKTtcblx0XHRcdH0sIGVuYWJsZWQ6IHRydWUsIGNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5jbGVhckFsbClcblx0XHR9KTtcblx0fVxuXHRyZXR1cm4gYWN0aW9ucztcbn1cblxuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsd0JBQXdCLDBCQUEwQixvQkFBb0IsaUNBQWlDO0FBRWhILFNBQVMsNkJBQTZCLDJCQUEyQjtBQUNqRSxTQUFTLHVCQUF1QjtBQUVoQyxTQUFTLGNBQWMscUJBQXFCO0FBQzVDLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsa0NBQWtDO0FBR3BDLE1BQU0sMkJBQW9FO0FBQUEsRUFBMUU7QUFDTixTQUFTLFdBQVc7QUFDcEIsU0FBUyxPQUFPO0FBQ2hCLFNBQVMsT0FBTztBQUNoQixTQUFTLE9BQU8sbUJBQW1CO0FBQUE7QUFBQSxFQUNuQyxZQUFZLFVBQTRCO0FBQ3ZDLFVBQU0sd0JBQXdCLFNBQVMsSUFBSSxzQkFBc0I7QUFDakUsVUFBTSxjQUFjLFNBQVMsSUFBSSxZQUFZO0FBQzdDLFVBQU0saUJBQWlCLFNBQVMsSUFBSSxlQUFlO0FBQ25ELFVBQU0sNkJBQTZCLFNBQVMsSUFBSSwyQkFBMkI7QUFFM0UsYUFBUyxjQUFjO0FBQ3RCLFlBQU0sZUFBZSwyQkFBMkIsV0FBVztB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
