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
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { SimpleIconLabel } from "../../../../base/browser/ui/iconLabel/simpleIconLabel.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { isTooltipWithCommands, ShowTooltipCommand, StatusbarEntryKinds } from "../../../services/statusbar/browser/statusbar.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { isThemeColor } from "../../../../editor/common/editorCommon.js";
import { addDisposableListener, EventType, hide, show, append, EventHelper, $ } from "../../../../base/browser/dom.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { renderIcon, renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { spinningLoading, syncing } from "../../../../platform/theme/common/iconRegistry.js";
import { isMarkdownString, markdownStringEqual } from "../../../../base/common/htmlContent.js";
import { Gesture, EventType as TouchEventType } from "../../../../base/browser/touch.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
let StatusbarEntryItem = class extends Disposable {
  constructor(container, entry, hoverDelegate, commandService, hoverService, notificationService, telemetryService, themeService) {
    super();
    this.container = container;
    this.hoverDelegate = hoverDelegate;
    this.commandService = commandService;
    this.hoverService = hoverService;
    this.notificationService = notificationService;
    this.telemetryService = telemetryService;
    this.themeService = themeService;
    this.entry = void 0;
    this.foregroundListener = this._register(new MutableDisposable());
    this.backgroundListener = this._register(new MutableDisposable());
    this.commandMouseListener = this._register(new MutableDisposable());
    this.commandTouchListener = this._register(new MutableDisposable());
    this.commandKeyboardListener = this._register(new MutableDisposable());
    this.hover = void 0;
    this.labelContainer = $("a.statusbar-item-label", {
      role: "button",
      tabIndex: -1
      // allows screen readers to read title, but still prevents tab focus.
    });
    this._register(Gesture.addTarget(this.labelContainer));
    this.label = this._register(new StatusBarCodiconLabel(this.labelContainer));
    this.container.appendChild(this.labelContainer);
    this.beakContainer = $(".status-bar-item-beak-container");
    this.container.appendChild(this.beakContainer);
    this.update(entry);
  }
  get name() {
    return assertIsDefined(this.entry).name;
  }
  get hasCommand() {
    return typeof this.entry?.command !== "undefined";
  }
  update(entry) {
    this.label.showProgress = entry.showProgress ?? false;
    if (!this.entry || entry.text !== this.entry.text) {
      this.label.text = entry.text;
      if (entry.text) {
        show(this.labelContainer);
      } else {
        hide(this.labelContainer);
      }
    }
    if (!this.entry || entry.ariaLabel !== this.entry.ariaLabel) {
      this.container.setAttribute("aria-label", entry.ariaLabel);
      this.labelContainer.setAttribute("aria-label", entry.ariaLabel);
    }
    if (!this.entry || entry.role !== this.entry.role) {
      this.labelContainer.setAttribute("role", entry.role || "button");
    }
    if (!this.entry || !this.isEqualTooltip(this.entry, entry)) {
      let hoverOptions;
      let hoverTooltip;
      if (isTooltipWithCommands(entry.tooltip)) {
        hoverTooltip = entry.tooltip.content;
        hoverOptions = {
          actions: entry.tooltip.commands.map((command) => ({
            commandId: command.id,
            label: command.title,
            run: () => this.executeCommand(command)
          }))
        };
      } else {
        hoverTooltip = entry.tooltip;
      }
      const hoverContents = isMarkdownString(hoverTooltip) ? { markdown: hoverTooltip, markdownNotSupportedFallback: void 0 } : hoverTooltip;
      if (this.hover) {
        this.hover.update(hoverContents, hoverOptions);
      } else {
        this.hover = this._register(this.hoverService.setupManagedHover(this.hoverDelegate, this.container, hoverContents, hoverOptions));
      }
    }
    if (!this.entry || entry.command !== this.entry.command) {
      this.commandMouseListener.clear();
      this.commandTouchListener.clear();
      this.commandKeyboardListener.clear();
      const command = entry.command;
      if (command && (command !== ShowTooltipCommand || this.hover)) {
        this.commandMouseListener.value = addDisposableListener(this.labelContainer, EventType.CLICK, () => this.executeCommand(command));
        this.commandTouchListener.value = addDisposableListener(this.labelContainer, TouchEventType.Tap, () => this.executeCommand(command));
        this.commandKeyboardListener.value = addDisposableListener(this.labelContainer, EventType.KEY_DOWN, (e) => {
          const event = new StandardKeyboardEvent(e);
          if (event.equals(KeyCode.Space) || event.equals(KeyCode.Enter)) {
            EventHelper.stop(e);
            this.executeCommand(command);
          } else if (event.equals(KeyCode.Escape) || event.equals(KeyCode.LeftArrow) || event.equals(KeyCode.RightArrow)) {
            EventHelper.stop(e);
            this.hover?.hide();
          }
        });
        this.labelContainer.classList.remove("disabled");
      } else {
        this.labelContainer.classList.add("disabled");
      }
    }
    if (!this.entry || entry.showBeak !== this.entry.showBeak) {
      if (entry.showBeak) {
        this.container.classList.add("has-beak");
      } else {
        this.container.classList.remove("has-beak");
      }
    }
    const hasBackgroundColor = !!entry.backgroundColor || entry.kind && entry.kind !== "standard";
    if (!this.entry || entry.kind !== this.entry.kind) {
      for (const kind of StatusbarEntryKinds) {
        this.container.classList.remove(`${kind}-kind`);
      }
      if (entry.kind && entry.kind !== "standard") {
        this.container.classList.add(`${entry.kind}-kind`);
      }
      this.container.classList.toggle("has-background-color", hasBackgroundColor);
    }
    if (!this.entry || entry.color !== this.entry.color) {
      this.applyColor(this.labelContainer, entry.color);
    }
    if (!this.entry || entry.backgroundColor !== this.entry.backgroundColor) {
      this.container.classList.toggle("has-background-color", hasBackgroundColor);
      this.applyColor(this.container, entry.backgroundColor, true);
    }
    this.entry = entry;
  }
  isEqualTooltip({ tooltip }, { tooltip: otherTooltip }) {
    if (tooltip === void 0) {
      return otherTooltip === void 0;
    }
    if (isMarkdownString(tooltip)) {
      return isMarkdownString(otherTooltip) && markdownStringEqual(tooltip, otherTooltip);
    }
    return tooltip === otherTooltip;
  }
  async executeCommand(command) {
    if (command === ShowTooltipCommand) {
      this.hover?.show(
        true
        /* focus */
      );
    } else {
      const id = typeof command === "string" ? command : command.id;
      const args = typeof command === "string" ? [] : command.arguments ?? [];
      this.telemetryService.publicLog2("workbenchActionExecuted", { id, from: "status bar" });
      try {
        await this.commandService.executeCommand(id, ...args);
      } catch (error) {
        this.notificationService.error(toErrorMessage(error));
      }
    }
  }
  applyColor(container, color, isBackground) {
    let colorResult = void 0;
    if (isBackground) {
      this.backgroundListener.clear();
    } else {
      this.foregroundListener.clear();
    }
    if (color) {
      if (isThemeColor(color)) {
        colorResult = this.themeService.getColorTheme().getColor(color.id)?.toString();
        const listener = this.themeService.onDidColorThemeChange((theme) => {
          const colorValue = theme.getColor(color.id)?.toString();
          if (isBackground) {
            container.style.backgroundColor = colorValue ?? "";
          } else {
            container.style.color = colorValue ?? "";
          }
        });
        if (isBackground) {
          this.backgroundListener.value = listener;
        } else {
          this.foregroundListener.value = listener;
        }
      } else {
        colorResult = color;
      }
    }
    if (isBackground) {
      container.style.backgroundColor = colorResult ?? "";
    } else {
      container.style.color = colorResult ?? "";
    }
  }
};
StatusbarEntryItem = __decorateClass([
  __decorateParam(3, ICommandService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, IThemeService)
], StatusbarEntryItem);
class StatusBarCodiconLabel extends SimpleIconLabel {
  constructor(container) {
    super(container);
    this.container = container;
    this.progressCodicon = renderIcon(syncing);
    this.currentText = "";
    this.currentShowProgress = false;
  }
  set showProgress(showProgress) {
    if (this.currentShowProgress !== showProgress) {
      this.currentShowProgress = showProgress;
      this.progressCodicon = renderIcon(showProgress === "syncing" ? syncing : spinningLoading);
      this.text = this.currentText;
    }
  }
  set text(text) {
    if (this.currentShowProgress) {
      if (this.container.firstChild !== this.progressCodicon) {
        this.container.appendChild(this.progressCodicon);
      }
      for (const node of Array.from(this.container.childNodes)) {
        if (node !== this.progressCodicon) {
          node.remove();
        }
      }
      let textContent = text ?? "";
      if (textContent) {
        textContent = `\xA0${textContent}`;
      }
      append(this.container, ...renderLabelWithIcons(textContent));
    } else {
      super.text = text;
    }
  }
}
export {
  StatusbarEntryItem
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9zdGF0dXNiYXIvc3RhdHVzYmFySXRlbS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IHRvRXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JNZXNzYWdlLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNpbXBsZUljb25MYWJlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvc2ltcGxlSWNvbkxhYmVsLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElTdGF0dXNiYXJFbnRyeSwgaXNUb29sdGlwV2l0aENvbW1hbmRzLCBTaG93VG9vbHRpcENvbW1hbmQsIFN0YXR1c2JhckVudHJ5S2luZHMsIFRvb2x0aXBDb250ZW50IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvc3RhdHVzYmFyL2Jyb3dzZXIvc3RhdHVzYmFyLmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkRXZlbnQsIFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkQ2xhc3NpZmljYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRoZW1lQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgaXNUaGVtZUNvbG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgYWRkRGlzcG9zYWJsZUxpc3RlbmVyLCBFdmVudFR5cGUsIGhpZGUsIHNob3csIGFwcGVuZCwgRXZlbnRIZWxwZXIsICQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgQ29tbWFuZCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyByZW5kZXJJY29uLCByZW5kZXJMYWJlbFdpdGhJY29ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvaWNvbkxhYmVscy5qcyc7XG5pbXBvcnQgeyBzcGlubmluZ0xvYWRpbmcsIHN5bmNpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGlzTWFya2Rvd25TdHJpbmcsIG1hcmtkb3duU3RyaW5nRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBJSG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlLmpzJztcbmltcG9ydCB7IEdlc3R1cmUsIEV2ZW50VHlwZSBhcyBUb3VjaEV2ZW50VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci90b3VjaC5qcyc7XG5pbXBvcnQgeyBJTWFuYWdlZEhvdmVyLCBJTWFuYWdlZEhvdmVyT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5cbmV4cG9ydCBjbGFzcyBTdGF0dXNiYXJFbnRyeUl0ZW0gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGxhYmVsOiBTdGF0dXNCYXJDb2RpY29uTGFiZWw7XG5cblx0cHJpdmF0ZSBlbnRyeTogSVN0YXR1c2JhckVudHJ5IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZm9yZWdyb3VuZExpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGJhY2tncm91bmRMaXN0ZW5lciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRNb3VzZUxpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRUb3VjaExpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRLZXlib2FyZExpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdHByaXZhdGUgaG92ZXI6IElNYW5hZ2VkSG92ZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0cmVhZG9ubHkgbGFiZWxDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRyZWFkb25seSBiZWFrQ29udGFpbmVyOiBIVE1MRWxlbWVudDtcblxuXHRnZXQgbmFtZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBhc3NlcnRJc0RlZmluZWQodGhpcy5lbnRyeSkubmFtZTtcblx0fVxuXG5cdGdldCBoYXNDb21tYW5kKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0eXBlb2YgdGhpcy5lbnRyeT8uY29tbWFuZCAhPT0gJ3VuZGVmaW5lZCc7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0ZW50cnk6IElTdGF0dXNiYXJFbnRyeSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGhvdmVyRGVsZWdhdGU6IElIb3ZlckRlbGVnYXRlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHQvLyBMYWJlbCBDb250YWluZXJcblx0XHR0aGlzLmxhYmVsQ29udGFpbmVyID0gJCgnYS5zdGF0dXNiYXItaXRlbS1sYWJlbCcsIHtcblx0XHRcdHJvbGU6ICdidXR0b24nLFxuXHRcdFx0dGFiSW5kZXg6IC0xIC8vIGFsbG93cyBzY3JlZW4gcmVhZGVycyB0byByZWFkIHRpdGxlLCBidXQgc3RpbGwgcHJldmVudHMgdGFiIGZvY3VzLlxuXHRcdH0pO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEdlc3R1cmUuYWRkVGFyZ2V0KHRoaXMubGFiZWxDb250YWluZXIpKTsgLy8gZW5hYmxlIHRvdWNoXG5cblx0XHQvLyBMYWJlbCAod2l0aCBzdXBwb3J0IGZvciBwcm9ncmVzcylcblx0XHR0aGlzLmxhYmVsID0gdGhpcy5fcmVnaXN0ZXIobmV3IFN0YXR1c0JhckNvZGljb25MYWJlbCh0aGlzLmxhYmVsQ29udGFpbmVyKSk7XG5cdFx0dGhpcy5jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5sYWJlbENvbnRhaW5lcik7XG5cblx0XHQvLyBCZWFrIENvbnRhaW5lclxuXHRcdHRoaXMuYmVha0NvbnRhaW5lciA9ICQoJy5zdGF0dXMtYmFyLWl0ZW0tYmVhay1jb250YWluZXInKTtcblx0XHR0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLmJlYWtDb250YWluZXIpO1xuXG5cdFx0dGhpcy51cGRhdGUoZW50cnkpO1xuXHR9XG5cblx0dXBkYXRlKGVudHJ5OiBJU3RhdHVzYmFyRW50cnkpOiB2b2lkIHtcblxuXHRcdC8vIFVwZGF0ZTogUHJvZ3Jlc3Ncblx0XHR0aGlzLmxhYmVsLnNob3dQcm9ncmVzcyA9IGVudHJ5LnNob3dQcm9ncmVzcyA/PyBmYWxzZTtcblxuXHRcdC8vIFVwZGF0ZTogVGV4dFxuXHRcdGlmICghdGhpcy5lbnRyeSB8fCBlbnRyeS50ZXh0ICE9PSB0aGlzLmVudHJ5LnRleHQpIHtcblx0XHRcdHRoaXMubGFiZWwudGV4dCA9IGVudHJ5LnRleHQ7XG5cblx0XHRcdGlmIChlbnRyeS50ZXh0KSB7XG5cdFx0XHRcdHNob3codGhpcy5sYWJlbENvbnRhaW5lcik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRoaWRlKHRoaXMubGFiZWxDb250YWluZXIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZTogQVJJQSBsYWJlbFxuXHRcdC8vXG5cdFx0Ly8gU2V0IHRoZSBhcmlhIGxhYmVsIG9uIGJvdGggZWxlbWVudHMgc28gc2NyZWVuIHJlYWRlcnMgd291bGQgcmVhZFxuXHRcdC8vIHRoZSBjb3JyZWN0IHRoaW5nIHdpdGhvdXQgZHVwbGljYXRpb24gIzk2MjEwXG5cblx0XHRpZiAoIXRoaXMuZW50cnkgfHwgZW50cnkuYXJpYUxhYmVsICE9PSB0aGlzLmVudHJ5LmFyaWFMYWJlbCkge1xuXHRcdFx0dGhpcy5jb250YWluZXIuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgZW50cnkuYXJpYUxhYmVsKTtcblx0XHRcdHRoaXMubGFiZWxDb250YWluZXIuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgZW50cnkuYXJpYUxhYmVsKTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuZW50cnkgfHwgZW50cnkucm9sZSAhPT0gdGhpcy5lbnRyeS5yb2xlKSB7XG5cdFx0XHR0aGlzLmxhYmVsQ29udGFpbmVyLnNldEF0dHJpYnV0ZSgncm9sZScsIGVudHJ5LnJvbGUgfHwgJ2J1dHRvbicpO1xuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZTogSG92ZXJcblx0XHRpZiAoIXRoaXMuZW50cnkgfHwgIXRoaXMuaXNFcXVhbFRvb2x0aXAodGhpcy5lbnRyeSwgZW50cnkpKSB7XG5cdFx0XHRsZXQgaG92ZXJPcHRpb25zOiBJTWFuYWdlZEhvdmVyT3B0aW9ucyB8IHVuZGVmaW5lZDtcblx0XHRcdGxldCBob3ZlclRvb2x0aXA6IFRvb2x0aXBDb250ZW50IHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKGlzVG9vbHRpcFdpdGhDb21tYW5kcyhlbnRyeS50b29sdGlwKSkge1xuXHRcdFx0XHRob3ZlclRvb2x0aXAgPSBlbnRyeS50b29sdGlwLmNvbnRlbnQ7XG5cdFx0XHRcdGhvdmVyT3B0aW9ucyA9IHtcblx0XHRcdFx0XHRhY3Rpb25zOiBlbnRyeS50b29sdGlwLmNvbW1hbmRzLm1hcChjb21tYW5kID0+ICh7XG5cdFx0XHRcdFx0XHRjb21tYW5kSWQ6IGNvbW1hbmQuaWQsXG5cdFx0XHRcdFx0XHRsYWJlbDogY29tbWFuZC50aXRsZSxcblx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5leGVjdXRlQ29tbWFuZChjb21tYW5kKVxuXHRcdFx0XHRcdH0pKVxuXHRcdFx0XHR9O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aG92ZXJUb29sdGlwID0gZW50cnkudG9vbHRpcDtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaG92ZXJDb250ZW50cyA9IGlzTWFya2Rvd25TdHJpbmcoaG92ZXJUb29sdGlwKSA/IHsgbWFya2Rvd246IGhvdmVyVG9vbHRpcCwgbWFya2Rvd25Ob3RTdXBwb3J0ZWRGYWxsYmFjazogdW5kZWZpbmVkIH0gOiBob3ZlclRvb2x0aXA7XG5cdFx0XHRpZiAodGhpcy5ob3Zlcikge1xuXHRcdFx0XHR0aGlzLmhvdmVyLnVwZGF0ZShob3ZlckNvbnRlbnRzLCBob3Zlck9wdGlvbnMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5ob3ZlciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKHRoaXMuaG92ZXJEZWxlZ2F0ZSwgdGhpcy5jb250YWluZXIsIGhvdmVyQ29udGVudHMsIGhvdmVyT3B0aW9ucykpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZTogQ29tbWFuZFxuXHRcdGlmICghdGhpcy5lbnRyeSB8fCBlbnRyeS5jb21tYW5kICE9PSB0aGlzLmVudHJ5LmNvbW1hbmQpIHtcblx0XHRcdHRoaXMuY29tbWFuZE1vdXNlTGlzdGVuZXIuY2xlYXIoKTtcblx0XHRcdHRoaXMuY29tbWFuZFRvdWNoTGlzdGVuZXIuY2xlYXIoKTtcblx0XHRcdHRoaXMuY29tbWFuZEtleWJvYXJkTGlzdGVuZXIuY2xlYXIoKTtcblxuXHRcdFx0Y29uc3QgY29tbWFuZCA9IGVudHJ5LmNvbW1hbmQ7XG5cdFx0XHRpZiAoY29tbWFuZCAmJiAoY29tbWFuZCAhPT0gU2hvd1Rvb2x0aXBDb21tYW5kIHx8IHRoaXMuaG92ZXIpIC8qIFwiU2hvdyBIb3ZlclwiIGlzIG9ubHkgdmFsaWQgd2hlbiB3ZSBoYXZlIGEgaG92ZXIgKi8pIHtcblx0XHRcdFx0dGhpcy5jb21tYW5kTW91c2VMaXN0ZW5lci52YWx1ZSA9IGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmxhYmVsQ29udGFpbmVyLCBFdmVudFR5cGUuQ0xJQ0ssICgpID0+IHRoaXMuZXhlY3V0ZUNvbW1hbmQoY29tbWFuZCkpO1xuXHRcdFx0XHR0aGlzLmNvbW1hbmRUb3VjaExpc3RlbmVyLnZhbHVlID0gYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMubGFiZWxDb250YWluZXIsIFRvdWNoRXZlbnRUeXBlLlRhcCwgKCkgPT4gdGhpcy5leGVjdXRlQ29tbWFuZChjb21tYW5kKSk7XG5cdFx0XHRcdHRoaXMuY29tbWFuZEtleWJvYXJkTGlzdGVuZXIudmFsdWUgPSBhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5sYWJlbENvbnRhaW5lciwgRXZlbnRUeXBlLktFWV9ET1dOLCBlID0+IHtcblx0XHRcdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRcdFx0aWYgKGV2ZW50LmVxdWFscyhLZXlDb2RlLlNwYWNlKSB8fCBldmVudC5lcXVhbHMoS2V5Q29kZS5FbnRlcikpIHtcblx0XHRcdFx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZSk7XG5cblx0XHRcdFx0XHRcdHRoaXMuZXhlY3V0ZUNvbW1hbmQoY29tbWFuZCk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5Fc2NhcGUpIHx8IGV2ZW50LmVxdWFscyhLZXlDb2RlLkxlZnRBcnJvdykgfHwgZXZlbnQuZXF1YWxzKEtleUNvZGUuUmlnaHRBcnJvdykpIHtcblx0XHRcdFx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZSk7XG5cblx0XHRcdFx0XHRcdHRoaXMuaG92ZXI/LmhpZGUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRoaXMubGFiZWxDb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgnZGlzYWJsZWQnKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMubGFiZWxDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnZGlzYWJsZWQnKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBVcGRhdGU6IEJlYWtcblx0XHRpZiAoIXRoaXMuZW50cnkgfHwgZW50cnkuc2hvd0JlYWsgIT09IHRoaXMuZW50cnkuc2hvd0JlYWspIHtcblx0XHRcdGlmIChlbnRyeS5zaG93QmVhaykge1xuXHRcdFx0XHR0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdoYXMtYmVhaycpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5jb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgnaGFzLWJlYWsnKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBoYXNCYWNrZ3JvdW5kQ29sb3IgPSAhIWVudHJ5LmJhY2tncm91bmRDb2xvciB8fCAoZW50cnkua2luZCAmJiBlbnRyeS5raW5kICE9PSAnc3RhbmRhcmQnKTtcblxuXHRcdC8vIFVwZGF0ZTogS2luZFxuXHRcdGlmICghdGhpcy5lbnRyeSB8fCBlbnRyeS5raW5kICE9PSB0aGlzLmVudHJ5LmtpbmQpIHtcblx0XHRcdGZvciAoY29uc3Qga2luZCBvZiBTdGF0dXNiYXJFbnRyeUtpbmRzKSB7XG5cdFx0XHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoYCR7a2luZH0ta2luZGApO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZW50cnkua2luZCAmJiBlbnRyeS5raW5kICE9PSAnc3RhbmRhcmQnKSB7XG5cdFx0XHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoYCR7ZW50cnkua2luZH0ta2luZGApO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdoYXMtYmFja2dyb3VuZC1jb2xvcicsIGhhc0JhY2tncm91bmRDb2xvcik7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlOiBGb3JlZ3JvdW5kXG5cdFx0aWYgKCF0aGlzLmVudHJ5IHx8IGVudHJ5LmNvbG9yICE9PSB0aGlzLmVudHJ5LmNvbG9yKSB7XG5cdFx0XHR0aGlzLmFwcGx5Q29sb3IodGhpcy5sYWJlbENvbnRhaW5lciwgZW50cnkuY29sb3IpO1xuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZTogQmFja2dyb3VuZFxuXHRcdGlmICghdGhpcy5lbnRyeSB8fCBlbnRyeS5iYWNrZ3JvdW5kQ29sb3IgIT09IHRoaXMuZW50cnkuYmFja2dyb3VuZENvbG9yKSB7XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdoYXMtYmFja2dyb3VuZC1jb2xvcicsIGhhc0JhY2tncm91bmRDb2xvcik7XG5cdFx0XHR0aGlzLmFwcGx5Q29sb3IodGhpcy5jb250YWluZXIsIGVudHJ5LmJhY2tncm91bmRDb2xvciwgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0Ly8gUmVtZW1iZXIgZm9yIG5leHQgcm91bmRcblx0XHR0aGlzLmVudHJ5ID0gZW50cnk7XG5cdH1cblxuXHRwcml2YXRlIGlzRXF1YWxUb29sdGlwKHsgdG9vbHRpcCB9OiBJU3RhdHVzYmFyRW50cnksIHsgdG9vbHRpcDogb3RoZXJUb29sdGlwIH06IElTdGF0dXNiYXJFbnRyeSkge1xuXHRcdGlmICh0b29sdGlwID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiBvdGhlclRvb2x0aXAgPT09IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAoaXNNYXJrZG93blN0cmluZyh0b29sdGlwKSkge1xuXHRcdFx0cmV0dXJuIGlzTWFya2Rvd25TdHJpbmcob3RoZXJUb29sdGlwKSAmJiBtYXJrZG93blN0cmluZ0VxdWFsKHRvb2x0aXAsIG90aGVyVG9vbHRpcCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRvb2x0aXAgPT09IG90aGVyVG9vbHRpcDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZXhlY3V0ZUNvbW1hbmQoY29tbWFuZDogc3RyaW5nIHwgQ29tbWFuZCk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gQ3VzdG9tIGNvbW1hbmQgZnJvbSB1czogU2hvdyB0b29sdGlwXG5cdFx0aWYgKGNvbW1hbmQgPT09IFNob3dUb29sdGlwQ29tbWFuZCkge1xuXHRcdFx0dGhpcy5ob3Zlcj8uc2hvdyh0cnVlIC8qIGZvY3VzICovKTtcblx0XHR9XG5cblx0XHQvLyBBbnkgb3RoZXIgY29tbWFuZCBpcyBnb2luZyB0aHJvdWdoIGNvbW1hbmQgc2VydmljZVxuXHRcdGVsc2Uge1xuXHRcdFx0Y29uc3QgaWQgPSB0eXBlb2YgY29tbWFuZCA9PT0gJ3N0cmluZycgPyBjb21tYW5kIDogY29tbWFuZC5pZDtcblx0XHRcdGNvbnN0IGFyZ3MgPSB0eXBlb2YgY29tbWFuZCA9PT0gJ3N0cmluZycgPyBbXSA6IGNvbW1hbmQuYXJndW1lbnRzID8/IFtdO1xuXG5cdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uPignd29ya2JlbmNoQWN0aW9uRXhlY3V0ZWQnLCB7IGlkLCBmcm9tOiAnc3RhdHVzIGJhcicgfSk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGlkLCAuLi5hcmdzKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcih0b0Vycm9yTWVzc2FnZShlcnJvcikpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXBwbHlDb2xvcihjb250YWluZXI6IEhUTUxFbGVtZW50LCBjb2xvcjogc3RyaW5nIHwgVGhlbWVDb2xvciB8IHVuZGVmaW5lZCwgaXNCYWNrZ3JvdW5kPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGxldCBjb2xvclJlc3VsdDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0aWYgKGlzQmFja2dyb3VuZCkge1xuXHRcdFx0dGhpcy5iYWNrZ3JvdW5kTGlzdGVuZXIuY2xlYXIoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5mb3JlZ3JvdW5kTGlzdGVuZXIuY2xlYXIoKTtcblx0XHR9XG5cblx0XHRpZiAoY29sb3IpIHtcblx0XHRcdGlmIChpc1RoZW1lQ29sb3IoY29sb3IpKSB7XG5cdFx0XHRcdGNvbG9yUmVzdWx0ID0gdGhpcy50aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpLmdldENvbG9yKGNvbG9yLmlkKT8udG9TdHJpbmcoKTtcblxuXHRcdFx0XHRjb25zdCBsaXN0ZW5lciA9IHRoaXMudGhlbWVTZXJ2aWNlLm9uRGlkQ29sb3JUaGVtZUNoYW5nZSh0aGVtZSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgY29sb3JWYWx1ZSA9IHRoZW1lLmdldENvbG9yKGNvbG9yLmlkKT8udG9TdHJpbmcoKTtcblxuXHRcdFx0XHRcdGlmIChpc0JhY2tncm91bmQpIHtcblx0XHRcdFx0XHRcdGNvbnRhaW5lci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBjb2xvclZhbHVlID8/ICcnO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb250YWluZXIuc3R5bGUuY29sb3IgPSBjb2xvclZhbHVlID8/ICcnO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0aWYgKGlzQmFja2dyb3VuZCkge1xuXHRcdFx0XHRcdHRoaXMuYmFja2dyb3VuZExpc3RlbmVyLnZhbHVlID0gbGlzdGVuZXI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5mb3JlZ3JvdW5kTGlzdGVuZXIudmFsdWUgPSBsaXN0ZW5lcjtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29sb3JSZXN1bHQgPSBjb2xvcjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaXNCYWNrZ3JvdW5kKSB7XG5cdFx0XHRjb250YWluZXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gY29sb3JSZXN1bHQgPz8gJyc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnRhaW5lci5zdHlsZS5jb2xvciA9IGNvbG9yUmVzdWx0ID8/ICcnO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBTdGF0dXNCYXJDb2RpY29uTGFiZWwgZXh0ZW5kcyBTaW1wbGVJY29uTGFiZWwge1xuXG5cdHByaXZhdGUgcHJvZ3Jlc3NDb2RpY29uID0gcmVuZGVySWNvbihzeW5jaW5nKTtcblxuXHRwcml2YXRlIGN1cnJlbnRUZXh0ID0gJyc7XG5cdHByaXZhdGUgY3VycmVudFNob3dQcm9ncmVzczogYm9vbGVhbiB8ICdsb2FkaW5nJyB8ICdzeW5jaW5nJyA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGFpbmVyOiBIVE1MRWxlbWVudFxuXHQpIHtcblx0XHRzdXBlcihjb250YWluZXIpO1xuXHR9XG5cblx0c2V0IHNob3dQcm9ncmVzcyhzaG93UHJvZ3Jlc3M6IGJvb2xlYW4gfCAnbG9hZGluZycgfCAnc3luY2luZycpIHtcblx0XHRpZiAodGhpcy5jdXJyZW50U2hvd1Byb2dyZXNzICE9PSBzaG93UHJvZ3Jlc3MpIHtcblx0XHRcdHRoaXMuY3VycmVudFNob3dQcm9ncmVzcyA9IHNob3dQcm9ncmVzcztcblx0XHRcdHRoaXMucHJvZ3Jlc3NDb2RpY29uID0gcmVuZGVySWNvbihzaG93UHJvZ3Jlc3MgPT09ICdzeW5jaW5nJyA/IHN5bmNpbmcgOiBzcGlubmluZ0xvYWRpbmcpO1xuXHRcdFx0dGhpcy50ZXh0ID0gdGhpcy5jdXJyZW50VGV4dDtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBzZXQgdGV4dCh0ZXh0OiBzdHJpbmcpIHtcblxuXHRcdC8vIFByb2dyZXNzOiBpbnNlcnQgcHJvZ3Jlc3MgY29kaWNvbiBhcyBmaXJzdCBlbGVtZW50IGFzIG5lZWRlZFxuXHRcdC8vIGJ1dCBrZWVwIGl0IHN0YWJsZSBzbyB0aGF0IHRoZSBhbmltYXRpb24gZG9lcyBub3QgcmVzZXRcblx0XHRpZiAodGhpcy5jdXJyZW50U2hvd1Byb2dyZXNzKSB7XG5cblx0XHRcdC8vIEFwcGVuZCBhcyBuZWVkZWRcblx0XHRcdGlmICh0aGlzLmNvbnRhaW5lci5maXJzdENoaWxkICE9PSB0aGlzLnByb2dyZXNzQ29kaWNvbikge1xuXHRcdFx0XHR0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLnByb2dyZXNzQ29kaWNvbik7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFJlbW92ZSBvdGhlcnNcblx0XHRcdGZvciAoY29uc3Qgbm9kZSBvZiBBcnJheS5mcm9tKHRoaXMuY29udGFpbmVyLmNoaWxkTm9kZXMpKSB7XG5cdFx0XHRcdGlmIChub2RlICE9PSB0aGlzLnByb2dyZXNzQ29kaWNvbikge1xuXHRcdFx0XHRcdG5vZGUucmVtb3ZlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgd2UgaGF2ZSB0ZXh0IHRvIHNob3csIGFkZCBhIHNwYWNlIHRvIHNlcGFyYXRlIGZyb20gcHJvZ3Jlc3Ncblx0XHRcdGxldCB0ZXh0Q29udGVudCA9IHRleHQgPz8gJyc7XG5cdFx0XHRpZiAodGV4dENvbnRlbnQpIHtcblx0XHRcdFx0dGV4dENvbnRlbnQgPSBgXFx1MDBBMCR7dGV4dENvbnRlbnR9YDsgLy8gcHJlcGVuZCBub24tYnJlYWtpbmcgc3BhY2Vcblx0XHRcdH1cblxuXHRcdFx0Ly8gQXBwZW5kIG5ldyBlbGVtZW50c1xuXHRcdFx0YXBwZW5kKHRoaXMuY29udGFpbmVyLCAuLi5yZW5kZXJMYWJlbFdpdGhJY29ucyh0ZXh0Q29udGVudCkpO1xuXHRcdH1cblxuXHRcdC8vIE5vIFByb2dyZXNzOiBubyBzcGVjaWFsIGhhbmRsaW5nXG5cdFx0ZWxzZSB7XG5cdFx0XHRzdXBlci50ZXh0ID0gdGV4dDtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxZQUFZLHlCQUF5QjtBQUM5QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUEwQix1QkFBdUIsb0JBQW9CLDJCQUEyQztBQUVoSCxTQUFTLHFCQUFxQjtBQUU5QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHVCQUF1QixXQUFXLE1BQU0sTUFBTSxRQUFRLGFBQWEsU0FBUztBQUNyRixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHVCQUF1QjtBQUVoQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUFZLDRC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QU87QUFDTixzQkFBVSxNQUFNLFFBQVEsY0FBYztBQUFBLFVBQ3ZDO0FBQUEsUUFDRCxDQUFDO0FBRUQsWUFBSSxjQUFjO0FBQ2pCLGVBQUssbUJBQW1CLFFBQVE7QUFBQSxRQUNqQyxPQUFPO0FBQ04sZUFBSyxtQkFBbUIsUUFBUTtBQUFBLFFBQ2pDO0FBQUEsTUFDRCxPQUFPO0FBQ04sc0JBQWM7QUFBQSxNQUNmO0FBQUEsSUFDRDtBQUVBLFFBQUksY0FBYztBQUNqQixnQkFBVSxNQUFNLGtCQUFrQixlQUFlO0FBQUEsSUFDbEQsT0FBTztBQUNOLGdCQUFVLE1BQU0sUUFBUSxlQUFlO0FBQUEsSUFDeEM7QUFBQSxFQUNEO0FBQ0Q7QUEzUGEscUJBQU47QUFBQSxFQThCSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWxDVTtBQTZQYixNQUFNLDhCQUE4QixnQkFBZ0I7QUFBQSxFQU9uRCxZQUNrQixXQUNoQjtBQUNELFVBQU0sU0FBUztBQUZFO0FBTmxCLFNBQVEsa0JBQWtCLFdBQVcsT0FBTztBQUU1QyxTQUFRLGNBQWM7QUFDdEIsU0FBUSxzQkFBdUQ7QUFBQSxFQU0vRDtBQUFBLEVBRUEsSUFBSSxhQUFhLGNBQStDO0FBQy9ELFFBQUksS0FBSyx3QkFBd0IsY0FBYztBQUM5QyxXQUFLLHNCQUFzQjtBQUMzQixXQUFLLGtCQUFrQixXQUFXLGlCQUFpQixZQUFZLFVBQVUsZUFBZTtBQUN4RixXQUFLLE9BQU8sS0FBSztBQUFBLElBQ2xCO0FBQUEsRUFDRDtBQUFBLEVBRUEsSUFBYSxLQUFLLE1BQWM7QUFJL0IsUUFBSSxLQUFLLHFCQUFxQjtBQUc3QixVQUFJLEtBQUssVUFBVSxlQUFlLEtBQUssaUJBQWlCO0FBQ3ZELGFBQUssVUFBVSxZQUFZLEtBQUssZUFBZTtBQUFBLE1BQ2hEO0FBR0EsaUJBQVcsUUFBUSxNQUFNLEtBQUssS0FBSyxVQUFVLFVBQVUsR0FBRztBQUN6RCxZQUFJLFNBQVMsS0FBSyxpQkFBaUI7QUFDbEMsZUFBSyxPQUFPO0FBQUEsUUFDYjtBQUFBLE1BQ0Q7QUFHQSxVQUFJLGNBQWMsUUFBUTtBQUMxQixVQUFJLGFBQWE7QUFDaEIsc0JBQWMsT0FBUyxXQUFXO0FBQUEsTUFDbkM7QUFHQSxhQUFPLEtBQUssV0FBVyxHQUFHLHFCQUFxQixXQUFXLENBQUM7QUFBQSxJQUM1RCxPQUdLO0FBQ0osWUFBTSxPQUFPO0FBQUEsSUFDZDtBQUFBLEVBQ0Q7QUFDRDsiLAogICJuYW1lcyI6IFtdCn0K
