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
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { Event } from "../../../../base/common/event.js";
import Severity from "../../../../base/common/severity.js";
import { localize } from "../../../../nls.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { INotificationService, NotificationPriority } from "../../../../platform/notification/common/notification.js";
import { IStatusbarService, StatusbarAlignment } from "../../../services/statusbar/browser/statusbar.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
let AccessibilityStatus = class extends Disposable {
  constructor(configurationService, notificationService, accessibilityService, statusbarService, openerService) {
    super();
    this.configurationService = configurationService;
    this.notificationService = notificationService;
    this.accessibilityService = accessibilityService;
    this.statusbarService = statusbarService;
    this.openerService = openerService;
    this.screenReaderNotification = null;
    this.promptedScreenReader = false;
    this.screenReaderModeElement = this._register(new MutableDisposable());
    this._register(CommandsRegistry.registerCommand({ id: "showEditorScreenReaderNotification", handler: () => this.showScreenReaderNotification() }));
    this.updateScreenReaderModeElement(this.accessibilityService.isScreenReaderOptimized());
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.accessibilityService.onDidChangeScreenReaderOptimized(() => this.onScreenReaderModeChange()));
    this._register(this.configurationService.onDidChangeConfiguration((c) => {
      if (c.affectsConfiguration("editor.accessibilitySupport")) {
        this.onScreenReaderModeChange();
      }
    }));
  }
  showScreenReaderNotification() {
    this.screenReaderNotification = this.notificationService.prompt(
      Severity.Info,
      localize("screenReaderDetectedExplanation.question", "Screen reader usage detected. Do you want to enable {0} to optimize the editor for screen reader usage?", "editor.accessibilitySupport"),
      [
        {
          label: localize("screenReaderDetectedExplanation.answerYes", "Yes"),
          run: () => {
            this.configurationService.updateValue("editor.accessibilitySupport", "on", ConfigurationTarget.USER);
          }
        },
        {
          label: localize("screenReaderDetectedExplanation.answerNo", "No"),
          run: () => {
            this.configurationService.updateValue("editor.accessibilitySupport", "off", ConfigurationTarget.USER);
          }
        },
        {
          label: localize("screenReaderDetectedExplanation.answerLearnMore", "Learn More"),
          run: () => {
            this.openerService.open("https://code.visualstudio.com/docs/editor/accessibility#_screen-readers");
          }
        }
      ],
      {
        sticky: true,
        priority: NotificationPriority.URGENT
      }
    );
    Event.once(this.screenReaderNotification.onDidClose)(() => this.screenReaderNotification = null);
  }
  updateScreenReaderModeElement(visible) {
    if (visible) {
      if (!this.screenReaderModeElement.value) {
        const text = localize("screenReaderDetected", "Screen Reader Optimized");
        this.screenReaderModeElement.value = this.statusbarService.addEntry({
          name: localize("status.editor.screenReaderMode", "Screen Reader Mode"),
          text,
          ariaLabel: text,
          command: "showEditorScreenReaderNotification",
          kind: "prominent",
          showInAllWindows: true
        }, "status.editor.screenReaderMode", StatusbarAlignment.RIGHT, 100.6);
      }
    } else {
      this.screenReaderModeElement.clear();
    }
  }
  onScreenReaderModeChange() {
    const screenReaderDetected = this.accessibilityService.isScreenReaderOptimized();
    if (screenReaderDetected) {
      const screenReaderConfiguration = this.configurationService.getValue("editor.accessibilitySupport");
      if (screenReaderConfiguration === "auto") {
        if (!this.promptedScreenReader) {
          this.promptedScreenReader = true;
          setTimeout(() => this.showScreenReaderNotification(), 100);
        }
      }
    }
    if (this.screenReaderNotification) {
      this.screenReaderNotification.close();
    }
    this.updateScreenReaderModeElement(this.accessibilityService.isScreenReaderOptimized());
  }
};
AccessibilityStatus.ID = "workbench.contrib.accessibilityStatus";
AccessibilityStatus = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, INotificationService),
  __decorateParam(2, IAccessibilityService),
  __decorateParam(3, IStatusbarService),
  __decorateParam(4, IOpenerService)
], AccessibilityStatus);
export {
  AccessibilityStatus
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJpbGl0eVN0YXR1cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IFNldmVyaXR5IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NldmVyaXR5LmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uVGFyZ2V0LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25IYW5kbGUsIElOb3RpZmljYXRpb25TZXJ2aWNlLCBOb3RpZmljYXRpb25Qcmlvcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJU3RhdHVzYmFyRW50cnlBY2Nlc3NvciwgSVN0YXR1c2JhclNlcnZpY2UsIFN0YXR1c2JhckFsaWdubWVudCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3N0YXR1c2Jhci9icm93c2VyL3N0YXR1c2Jhci5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcblxuZXhwb3J0IGNsYXNzIEFjY2Vzc2liaWxpdHlTdGF0dXMgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLmFjY2Vzc2liaWxpdHlTdGF0dXMnO1xuXG5cdHByaXZhdGUgc2NyZWVuUmVhZGVyTm90aWZpY2F0aW9uOiBJTm90aWZpY2F0aW9uSGFuZGxlIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgcHJvbXB0ZWRTY3JlZW5SZWFkZXI6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSByZWFkb25seSBzY3JlZW5SZWFkZXJNb2RlRWxlbWVudCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJU3RhdHVzYmFyRW50cnlBY2Nlc3Nvcj4oKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFjY2Vzc2liaWxpdHlTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNlcnZpY2UsXG5cdFx0QElTdGF0dXNiYXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RhdHVzYmFyU2VydmljZTogSVN0YXR1c2JhclNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7IGlkOiAnc2hvd0VkaXRvclNjcmVlblJlYWRlck5vdGlmaWNhdGlvbicsIGhhbmRsZXI6ICgpID0+IHRoaXMuc2hvd1NjcmVlblJlYWRlck5vdGlmaWNhdGlvbigpIH0pKTtcblxuXHRcdHRoaXMudXBkYXRlU2NyZWVuUmVhZGVyTW9kZUVsZW1lbnQodGhpcy5hY2Nlc3NpYmlsaXR5U2VydmljZS5pc1NjcmVlblJlYWRlck9wdGltaXplZCgpKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5hY2Nlc3NpYmlsaXR5U2VydmljZS5vbkRpZENoYW5nZVNjcmVlblJlYWRlck9wdGltaXplZCgoKSA9PiB0aGlzLm9uU2NyZWVuUmVhZGVyTW9kZUNoYW5nZSgpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihjID0+IHtcblx0XHRcdGlmIChjLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3IuYWNjZXNzaWJpbGl0eVN1cHBvcnQnKSkge1xuXHRcdFx0XHR0aGlzLm9uU2NyZWVuUmVhZGVyTW9kZUNoYW5nZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgc2hvd1NjcmVlblJlYWRlck5vdGlmaWNhdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLnNjcmVlblJlYWRlck5vdGlmaWNhdGlvbiA9IHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoXG5cdFx0XHRTZXZlcml0eS5JbmZvLFxuXHRcdFx0bG9jYWxpemUoJ3NjcmVlblJlYWRlckRldGVjdGVkRXhwbGFuYXRpb24ucXVlc3Rpb24nLCBcIlNjcmVlbiByZWFkZXIgdXNhZ2UgZGV0ZWN0ZWQuIERvIHlvdSB3YW50IHRvIGVuYWJsZSB7MH0gdG8gb3B0aW1pemUgdGhlIGVkaXRvciBmb3Igc2NyZWVuIHJlYWRlciB1c2FnZT9cIiwgJ2VkaXRvci5hY2Nlc3NpYmlsaXR5U3VwcG9ydCcpLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdzY3JlZW5SZWFkZXJEZXRlY3RlZEV4cGxhbmF0aW9uLmFuc3dlclllcycsIFwiWWVzXCIpLFxuXHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKCdlZGl0b3IuYWNjZXNzaWJpbGl0eVN1cHBvcnQnLCAnb24nLCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc2NyZWVuUmVhZGVyRGV0ZWN0ZWRFeHBsYW5hdGlvbi5hbnN3ZXJObycsIFwiTm9cIiksXG5cdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoJ2VkaXRvci5hY2Nlc3NpYmlsaXR5U3VwcG9ydCcsICdvZmYnLCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3NjcmVlblJlYWRlckRldGVjdGVkRXhwbGFuYXRpb24uYW5zd2VyTGVhcm5Nb3JlJywgXCJMZWFybiBNb3JlXCIpLFxuXHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLm9wZW5lclNlcnZpY2Uub3BlbignaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vZG9jcy9lZGl0b3IvYWNjZXNzaWJpbGl0eSNfc2NyZWVuLXJlYWRlcnMnKTtcblx0XHRcdFx0fVxuXHRcdFx0fV0sXG5cdFx0XHR7XG5cdFx0XHRcdHN0aWNreTogdHJ1ZSxcblx0XHRcdFx0cHJpb3JpdHk6IE5vdGlmaWNhdGlvblByaW9yaXR5LlVSR0VOVFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHRFdmVudC5vbmNlKHRoaXMuc2NyZWVuUmVhZGVyTm90aWZpY2F0aW9uLm9uRGlkQ2xvc2UpKCgpID0+IHRoaXMuc2NyZWVuUmVhZGVyTm90aWZpY2F0aW9uID0gbnVsbCk7XG5cdH1cblx0cHJpdmF0ZSB1cGRhdGVTY3JlZW5SZWFkZXJNb2RlRWxlbWVudCh2aXNpYmxlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHZpc2libGUpIHtcblx0XHRcdGlmICghdGhpcy5zY3JlZW5SZWFkZXJNb2RlRWxlbWVudC52YWx1ZSkge1xuXHRcdFx0XHRjb25zdCB0ZXh0ID0gbG9jYWxpemUoJ3NjcmVlblJlYWRlckRldGVjdGVkJywgXCJTY3JlZW4gUmVhZGVyIE9wdGltaXplZFwiKTtcblx0XHRcdFx0dGhpcy5zY3JlZW5SZWFkZXJNb2RlRWxlbWVudC52YWx1ZSA9IHRoaXMuc3RhdHVzYmFyU2VydmljZS5hZGRFbnRyeSh7XG5cdFx0XHRcdFx0bmFtZTogbG9jYWxpemUoJ3N0YXR1cy5lZGl0b3Iuc2NyZWVuUmVhZGVyTW9kZScsIFwiU2NyZWVuIFJlYWRlciBNb2RlXCIpLFxuXHRcdFx0XHRcdHRleHQsXG5cdFx0XHRcdFx0YXJpYUxhYmVsOiB0ZXh0LFxuXHRcdFx0XHRcdGNvbW1hbmQ6ICdzaG93RWRpdG9yU2NyZWVuUmVhZGVyTm90aWZpY2F0aW9uJyxcblx0XHRcdFx0XHRraW5kOiAncHJvbWluZW50Jyxcblx0XHRcdFx0XHRzaG93SW5BbGxXaW5kb3dzOiB0cnVlXG5cdFx0XHRcdH0sICdzdGF0dXMuZWRpdG9yLnNjcmVlblJlYWRlck1vZGUnLCBTdGF0dXNiYXJBbGlnbm1lbnQuUklHSFQsIDEwMC42KTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zY3JlZW5SZWFkZXJNb2RlRWxlbWVudC5jbGVhcigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25TY3JlZW5SZWFkZXJNb2RlQ2hhbmdlKCk6IHZvaWQge1xuXG5cdFx0Ly8gV2Ugb25seSBzdXBwb3J0IHRleHQgYmFzZWQgZWRpdG9yc1xuXHRcdGNvbnN0IHNjcmVlblJlYWRlckRldGVjdGVkID0gdGhpcy5hY2Nlc3NpYmlsaXR5U2VydmljZS5pc1NjcmVlblJlYWRlck9wdGltaXplZCgpO1xuXHRcdGlmIChzY3JlZW5SZWFkZXJEZXRlY3RlZCkge1xuXHRcdFx0Y29uc3Qgc2NyZWVuUmVhZGVyQ29uZmlndXJhdGlvbiA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2VkaXRvci5hY2Nlc3NpYmlsaXR5U3VwcG9ydCcpO1xuXHRcdFx0aWYgKHNjcmVlblJlYWRlckNvbmZpZ3VyYXRpb24gPT09ICdhdXRvJykge1xuXHRcdFx0XHRpZiAoIXRoaXMucHJvbXB0ZWRTY3JlZW5SZWFkZXIpIHtcblx0XHRcdFx0XHR0aGlzLnByb21wdGVkU2NyZWVuUmVhZGVyID0gdHJ1ZTtcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHRoaXMuc2hvd1NjcmVlblJlYWRlck5vdGlmaWNhdGlvbigpLCAxMDApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc2NyZWVuUmVhZGVyTm90aWZpY2F0aW9uKSB7XG5cdFx0XHR0aGlzLnNjcmVlblJlYWRlck5vdGlmaWNhdGlvbi5jbG9zZSgpO1xuXHRcdH1cblx0XHR0aGlzLnVwZGF0ZVNjcmVlblJlYWRlck1vZGVFbGVtZW50KHRoaXMuYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxZQUFZLHlCQUF5QjtBQUM5QyxTQUFTLGFBQWE7QUFDdEIsT0FBTyxjQUFjO0FBQ3JCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMscUJBQXFCLDZCQUE2QjtBQUMzRCxTQUE4QixzQkFBc0IsNEJBQTRCO0FBRWhGLFNBQWtDLG1CQUFtQiwwQkFBMEI7QUFDL0UsU0FBUyxzQkFBc0I7QUFFeEIsSUFBTSxzQkFBTixjQUFrQyxXQUE2QztBQUFBLEVBUXJGLFlBQ3lDLHNCQUNELHFCQUNDLHNCQUNKLGtCQUNILGVBQ2hDO0FBQ0QsVUFBTTtBQU5rQztBQUNEO0FBQ0M7QUFDSjtBQUNIO0FBVGxDLFNBQVEsMkJBQXVEO0FBQy9ELFNBQVEsdUJBQWdDO0FBQ3hDLFNBQWlCLDBCQUEwQixLQUFLLFVBQVUsSUFBSSxrQkFBMkMsQ0FBQztBQVd6RyxTQUFLLFVBQVUsaUJBQWlCLGdCQUFnQixFQUFFLElBQUksc0NBQXNDLFNBQVMsTUFBTSxLQUFLLDZCQUE2QixFQUFFLENBQUMsQ0FBQztBQUVqSixT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
