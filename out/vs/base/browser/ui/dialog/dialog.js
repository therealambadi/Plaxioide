import "./dialog.css";
import { localize } from "../../../../nls.js";
import { $, addDisposableListener, clearNode, EventHelper, EventType, getWindow, hide, isActiveElement, isAncestor, show } from "../../dom.js";
import { StandardKeyboardEvent } from "../../keyboardEvent.js";
import { ActionBar } from "../actionbar/actionbar.js";
import { ButtonBar, ButtonWithDescription, ButtonWithDropdown } from "../button/button.js";
import { Checkbox } from "../toggle/toggle.js";
import { InputBox } from "../inputbox/inputBox.js";
import { Action, toAction } from "../../../common/actions.js";
import { Codicon } from "../../../common/codicons.js";
import { ThemeIcon } from "../../../common/themables.js";
import { KeyCode, KeyMod } from "../../../common/keyCodes.js";
import { mnemonicButtonLabel } from "../../../common/labels.js";
import { Disposable, toDisposable } from "../../../common/lifecycle.js";
import { isLinux, isMacintosh, isWindows } from "../../../common/platform.js";
import { isActionProvider } from "../dropdown/dropdown.js";
class Dialog extends Disposable {
  constructor(container, message, buttons, options) {
    super();
    this.container = container;
    this.message = message;
    this.options = options;
    this.modalElement = this.container.appendChild($(`.monaco-dialog-modal-block.dimmed`));
    this.shadowElement = this.modalElement.appendChild($(".dialog-shadow"));
    this.element = this.shadowElement.appendChild($(".monaco-dialog-box"));
    this.element.setAttribute("role", "dialog");
    this.element.tabIndex = -1;
    hide(this.element);
    this.buttonStyles = options.buttonStyles;
    if (Array.isArray(buttons) && buttons.length > 0) {
      this.buttons = buttons;
    } else if (!this.options.disableDefaultAction) {
      this.buttons = [localize("ok", "OK")];
    } else {
      this.buttons = [];
    }
    const buttonsRowElement = this.element.appendChild($(".dialog-buttons-row"));
    this.buttonsContainer = buttonsRowElement.appendChild($(".dialog-buttons"));
    const messageRowElement = this.element.appendChild($(".dialog-message-row"));
    this.iconElement = messageRowElement.appendChild($("#monaco-dialog-icon.dialog-icon"));
    this.iconElement.setAttribute("aria-label", this.getIconAriaLabel());
    this.messageContainer = messageRowElement.appendChild($(".dialog-message-container"));
    if (this.options.detail || this.options.renderBody) {
      const messageElement = this.messageContainer.appendChild($(".dialog-message"));
      const messageTextElement = messageElement.appendChild($("#monaco-dialog-message-text.dialog-message-text"));
      messageTextElement.innerText = this.message;
    }
    this.messageDetailElement = this.messageContainer.appendChild($("#monaco-dialog-message-detail.dialog-message-detail"));
    if (this.options.detail || !this.options.renderBody) {
      this.messageDetailElement.innerText = this.options.detail ? this.options.detail : message;
    } else {
      this.messageDetailElement.style.display = "none";
    }
    if (this.options.renderBody) {
      const customBody = this.messageContainer.appendChild($("#monaco-dialog-message-body.dialog-message-body"));
      this.options.renderBody(customBody);
      for (const el of this.messageContainer.querySelectorAll("a")) {
        el.tabIndex = 0;
      }
    }
    if (this.options.inputs) {
      this.inputs = this.options.inputs.map((input) => {
        const inputRowElement = this.messageContainer.appendChild($(".dialog-message-input"));
        const inputBox = this._register(new InputBox(inputRowElement, void 0, {
          placeholder: input.placeholder,
          type: input.type ?? "text",
          inputBoxStyles: options.inputBoxStyles
        }));
        if (input.value) {
          inputBox.value = input.value;
        }
        return inputBox;
      });
    } else {
      this.inputs = [];
    }
    if (this.options.checkboxLabel) {
      const checkboxRowElement = this.messageContainer.appendChild($(".dialog-checkbox-row"));
      const checkbox = this.checkbox = this._register(
        new Checkbox(this.options.checkboxLabel, !!this.options.checkboxChecked, options.checkboxStyles)
      );
      checkboxRowElement.appendChild(checkbox.domNode);
      const checkboxMessageElement = checkboxRowElement.appendChild($(".dialog-checkbox-message"));
      checkboxMessageElement.innerText = this.options.checkboxLabel;
      this._register(addDisposableListener(checkboxMessageElement, EventType.CLICK, () => checkbox.checked = !checkbox.checked));
    }
    const toolbarRowElement = this.element.appendChild($(".dialog-toolbar-row"));
    this.toolbarContainer = toolbarRowElement.appendChild($(".dialog-toolbar"));
    this.applyStyles();
  }
  getIconAriaLabel() {
    let typeLabel = localize("dialogInfoMessage", "Info");
    switch (this.options.type) {
      case "error":
        typeLabel = localize("dialogErrorMessage", "Error");
        break;
      case "warning":
        typeLabel = localize("dialogWarningMessage", "Warning");
        break;
      case "pending":
        typeLabel = localize("dialogPendingMessage", "In Progress");
        break;
      case "none":
      case "info":
      case "question":
      default:
        break;
    }
    return typeLabel;
  }
  updateMessage(message) {
    this.messageDetailElement.innerText = message;
  }
  async show() {
    this.focusToReturn = this.container.ownerDocument.activeElement;
    return new Promise((resolve) => {
      clearNode(this.buttonsContainer);
      const close = () => {
        resolve({
          button: this.options.cancelId || 0,
          checkboxChecked: this.checkbox ? this.checkbox.checked : void 0
        });
        return;
      };
      this._register(toDisposable(close));
      const buttonBar = this.buttonBar = this._register(new ButtonBar(this.buttonsContainer));
      const buttonMap = this.rearrangeButtons(this.buttons, this.options.cancelId);
      const onButtonClick = (index) => {
        resolve({
          button: buttonMap[index].index,
          checkboxChecked: this.checkbox ? this.checkbox.checked : void 0,
          values: this.inputs.length > 0 ? this.inputs.map((input) => input.value) : void 0
        });
      };
      buttonMap.forEach((_, index) => {
        const primary = buttonMap[index].index === 0;
        let button;
        if (primary && this.options?.primaryButtonDropdown) {
          const actions = isActionProvider(this.options.primaryButtonDropdown.actions) ? this.options.primaryButtonDropdown.actions.getActions() : this.options.primaryButtonDropdown.actions;
          button = this._register(buttonBar.addButtonWithDropdown({
            ...this.options.primaryButtonDropdown,
            ...this.buttonStyles,
            dropdownLayer: 2600,
            // ensure the dropdown is above the dialog
            actions: actions.map((action) => toAction({
              ...action,
              run: async () => {
                await action.run();
                onButtonClick(index);
              }
            }))
          }));
        } else if (this.options.buttonDetails) {
          button = this._register(buttonBar.addButtonWithDescription({ secondary: !primary, ...this.buttonStyles }));
        } else {
          button = this._register(buttonBar.addButton({ secondary: !primary, ...this.buttonStyles }));
        }
        button.label = mnemonicButtonLabel(buttonMap[index].label, true);
        if (button instanceof ButtonWithDescription) {
          button.description = this.options.buttonDetails[buttonMap[index].index];
        }
        this._register(button.onDidClick((e) => {
          if (e) {
            EventHelper.stop(e);
          }
          onButtonClick(index);
        }));
      });
      const window = getWindow(this.container);
      this._register(addDisposableListener(window, "keydown", (e) => {
        const evt = new StandardKeyboardEvent(e);
        if (evt.equals(KeyMod.Alt)) {
          evt.preventDefault();
        }
        if (evt.equals(KeyCode.Enter)) {
          if (this.inputs.some((input) => input.hasFocus())) {
            EventHelper.stop(e);
            resolve({
              button: buttonMap.find((button) => button.index !== this.options.cancelId)?.index ?? 0,
              checkboxChecked: this.checkbox ? this.checkbox.checked : void 0,
              values: this.inputs.length > 0 ? this.inputs.map((input) => input.value) : void 0
            });
          }
          return;
        }
        if (isMacintosh && evt.equals(KeyMod.CtrlCmd | KeyCode.KeyD)) {
          EventHelper.stop(e);
          const noButton = buttonMap.find((button) => button.index === 1 && button.index !== this.options.cancelId);
          if (noButton) {
            resolve({
              button: noButton.index,
              checkboxChecked: this.checkbox ? this.checkbox.checked : void 0,
              values: this.inputs.length > 0 ? this.inputs.map((input) => input.value) : void 0
            });
          }
          return;
        }
        if (evt.equals(KeyCode.Space)) {
          return;
        }
        let eventHandled = false;
        if (evt.equals(KeyCode.Tab) || evt.equals(KeyCode.RightArrow) || evt.equals(KeyMod.Shift | KeyCode.Tab) || evt.equals(KeyCode.LeftArrow)) {
          const focusableElements = [];
          let focusedIndex = -1;
          if (this.messageContainer) {
            const links = this.messageContainer.querySelectorAll("a");
            for (const link of links) {
              focusableElements.push(link);
              if (isActiveElement(link)) {
                focusedIndex = focusableElements.length - 1;
              }
            }
          }
          for (const input of this.inputs) {
            focusableElements.push(input);
            if (input.hasFocus()) {
              focusedIndex = focusableElements.length - 1;
            }
          }
          if (this.checkbox) {
            focusableElements.push(this.checkbox);
            if (this.checkbox.hasFocus()) {
              focusedIndex = focusableElements.length - 1;
            }
          }
          if (this.buttonBar) {
            for (const button of this.buttonBar.buttons) {
              if (button instanceof ButtonWithDropdown) {
                focusableElements.push(button.primaryButton);
                if (button.primaryButton.hasFocus()) {
                  focusedIndex = focusableElements.length - 1;
                }
                focusableElements.push(button.dropdownButton);
                if (button.dropdownButton.hasFocus()) {
                  focusedIndex = focusableElements.length - 1;
                }
              } else {
                focusableElements.push(button);
                if (button.hasFocus()) {
                  focusedIndex = focusableElements.length - 1;
                }
              }
            }
          }
          if (evt.equals(KeyCode.Tab) || evt.equals(KeyCode.RightArrow)) {
            const newFocusedIndex = (focusedIndex + 1) % focusableElements.length;
            focusableElements[newFocusedIndex].focus();
          } else {
            if (focusedIndex === -1) {
              focusedIndex = focusableElements.length;
            }
            let newFocusedIndex = focusedIndex - 1;
            if (newFocusedIndex === -1) {
              newFocusedIndex = focusableElements.length - 1;
            }
            focusableElements[newFocusedIndex].focus();
          }
          eventHandled = true;
        }
        if (eventHandled) {
          EventHelper.stop(e, true);
        } else if (this.options.keyEventProcessor) {
          this.options.keyEventProcessor(evt);
        }
      }, true));
      this._register(addDisposableListener(window, "keyup", (e) => {
        EventHelper.stop(e, true);
        const evt = new StandardKeyboardEvent(e);
        if (!this.options.disableCloseAction && evt.equals(KeyCode.Escape)) {
          close();
        }
      }, true));
      this._register(addDisposableListener(this.element, "focusout", (e) => {
        if (!!e.relatedTarget && !!this.element) {
          if (!isAncestor(e.relatedTarget, this.element)) {
            this.focusToReturn = e.relatedTarget;
            if (e.target) {
              e.target.focus();
              EventHelper.stop(e, true);
            }
          }
        }
      }, false));
      const spinModifierClassName = "codicon-modifier-spin";
      this.iconElement.classList.remove(...ThemeIcon.asClassNameArray(Codicon.dialogError), ...ThemeIcon.asClassNameArray(Codicon.dialogWarning), ...ThemeIcon.asClassNameArray(Codicon.dialogInfo), ...ThemeIcon.asClassNameArray(Codicon.loading), spinModifierClassName);
      if (this.options.icon) {
        this.iconElement.classList.add(...ThemeIcon.asClassNameArray(this.options.icon));
      } else {
        switch (this.options.type) {
          case "error":
            this.iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.dialogError));
            break;
          case "warning":
            this.iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.dialogWarning));
            break;
          case "pending":
            this.iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.loading), spinModifierClassName);
            break;
          case "none":
            this.iconElement.classList.add("no-codicon");
            break;
          case "info":
          case "question":
          default:
            this.iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.dialogInfo));
            break;
        }
      }
      if (!this.options.disableCloseAction) {
        const actionBar = this._register(new ActionBar(this.toolbarContainer, {}));
        const action = this._register(new Action("dialog.close", localize("dialogClose", "Close Dialog"), ThemeIcon.asClassName(Codicon.dialogClose), true, async () => {
          resolve({
            button: this.options.cancelId || 0,
            checkboxChecked: this.checkbox ? this.checkbox.checked : void 0
          });
        }));
        actionBar.push(action, { icon: true, label: false });
      }
      this.applyStyles();
      this.element.setAttribute("aria-modal", "true");
      this.element.setAttribute("aria-labelledby", "monaco-dialog-icon monaco-dialog-message-text");
      this.element.setAttribute("aria-describedby", "monaco-dialog-icon monaco-dialog-message-text monaco-dialog-message-detail monaco-dialog-message-body");
      show(this.element);
      if (this.inputs.length > 0) {
        this.inputs[0].focus();
        this.inputs[0].select();
      } else {
        buttonMap.forEach((value, index) => {
          if (value.index === 0) {
            buttonBar.buttons[index].focus();
          }
        });
      }
    });
  }
  applyStyles() {
    const style = this.options.dialogStyles;
    const fgColor = style.dialogForeground;
    const bgColor = style.dialogBackground;
    const shadowColor = style.dialogShadow ? `0 0px 8px ${style.dialogShadow}` : "";
    const border = style.dialogBorder ? `1px solid ${style.dialogBorder}` : "";
    const linkFgColor = style.textLinkForeground;
    this.shadowElement.style.boxShadow = shadowColor;
    this.element.style.color = fgColor ?? "";
    this.element.style.backgroundColor = bgColor ?? "";
    this.element.style.border = border;
    if (linkFgColor) {
      for (const el of this.messageContainer.getElementsByTagName("a")) {
        el.style.color = linkFgColor;
      }
    }
    let color;
    switch (this.options.type) {
      case "none":
        break;
      case "error":
        color = style.errorIconForeground;
        break;
      case "warning":
        color = style.warningIconForeground;
        break;
      default:
        color = style.infoIconForeground;
        break;
    }
    if (color) {
      this.iconElement.style.color = color;
    }
  }
  dispose() {
    super.dispose();
    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = void 0;
    }
    if (this.focusToReturn && isAncestor(this.focusToReturn, this.container.ownerDocument.body)) {
      this.focusToReturn.focus();
      this.focusToReturn = void 0;
    }
  }
  rearrangeButtons(buttons, cancelId) {
    const buttonMap = buttons.map((label, index) => ({ label, index }));
    if (buttons.length < 2) {
      return buttonMap;
    }
    if (isMacintosh || isLinux) {
      if (typeof cancelId === "number" && buttonMap[cancelId]) {
        const cancelButton = buttonMap.splice(cancelId, 1)[0];
        buttonMap.splice(1, 0, cancelButton);
      }
      buttonMap.reverse();
    } else if (isWindows) {
      if (typeof cancelId === "number" && buttonMap[cancelId]) {
        const cancelButton = buttonMap.splice(cancelId, 1)[0];
        buttonMap.push(cancelButton);
      }
    }
    return buttonMap;
  }
}
export {
  Dialog
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvZGlhbG9nL2RpYWxvZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9kaWFsb2cuY3NzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7ICQsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgY2xlYXJOb2RlLCBFdmVudEhlbHBlciwgRXZlbnRUeXBlLCBnZXRXaW5kb3csIGhpZGUsIGlzQWN0aXZlRWxlbWVudCwgaXNBbmNlc3Rvciwgc2hvdyB9IGZyb20gJy4uLy4uL2RvbS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciB9IGZyb20gJy4uL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgQnV0dG9uQmFyLCBCdXR0b25XaXRoRGVzY3JpcHRpb24sIEJ1dHRvbldpdGhEcm9wZG93biwgSUJ1dHRvbiwgSUJ1dHRvblN0eWxlcywgSUJ1dHRvbldpdGhEcm9wZG93bk9wdGlvbnMgfSBmcm9tICcuLi9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IElDaGVja2JveFN0eWxlcywgQ2hlY2tib3ggfSBmcm9tICcuLi90b2dnbGUvdG9nZ2xlLmpzJztcbmltcG9ydCB7IElJbnB1dEJveFN0eWxlcywgSW5wdXRCb3ggfSBmcm9tICcuLi9pbnB1dGJveC9pbnB1dEJveC5qcyc7XG5pbXBvcnQgeyBBY3Rpb24sIHRvQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBtbmVtb25pY0J1dHRvbkxhYmVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhYmVscy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGlzTGludXgsIGlzTWFjaW50b3NoLCBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgaXNBY3Rpb25Qcm92aWRlciB9IGZyb20gJy4uL2Ryb3Bkb3duL2Ryb3Bkb3duLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJRGlhbG9nSW5wdXRPcHRpb25zIHtcblx0cmVhZG9ubHkgcGxhY2Vob2xkZXI/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IHR5cGU/OiAndGV4dCcgfCAncGFzc3dvcmQnO1xuXHRyZWFkb25seSB2YWx1ZT86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRGlhbG9nT3B0aW9ucyB7XG5cdHJlYWRvbmx5IGNhbmNlbElkPzogbnVtYmVyO1xuXHRyZWFkb25seSBkZXRhaWw/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGNoZWNrYm94TGFiZWw/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGNoZWNrYm94Q2hlY2tlZD86IGJvb2xlYW47XG5cdHJlYWRvbmx5IHR5cGU/OiAnbm9uZScgfCAnaW5mbycgfCAnZXJyb3InIHwgJ3F1ZXN0aW9uJyB8ICd3YXJuaW5nJyB8ICdwZW5kaW5nJztcblx0cmVhZG9ubHkgaW5wdXRzPzogSURpYWxvZ0lucHV0T3B0aW9uc1tdO1xuXHRyZWFkb25seSBrZXlFdmVudFByb2Nlc3Nvcj86IChldmVudDogU3RhbmRhcmRLZXlib2FyZEV2ZW50KSA9PiB2b2lkO1xuXHRyZWFkb25seSByZW5kZXJCb2R5PzogKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpID0+IHZvaWQ7XG5cdHJlYWRvbmx5IGljb24/OiBUaGVtZUljb247XG5cdHJlYWRvbmx5IGJ1dHRvbkRldGFpbHM/OiBzdHJpbmdbXTtcblx0cmVhZG9ubHkgcHJpbWFyeUJ1dHRvbkRyb3Bkb3duPzogSUJ1dHRvbldpdGhEcm9wZG93bk9wdGlvbnM7XG5cdHJlYWRvbmx5IGRpc2FibGVDbG9zZUFjdGlvbj86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGRpc2FibGVEZWZhdWx0QWN0aW9uPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgYnV0dG9uU3R5bGVzOiBJQnV0dG9uU3R5bGVzO1xuXHRyZWFkb25seSBjaGVja2JveFN0eWxlczogSUNoZWNrYm94U3R5bGVzO1xuXHRyZWFkb25seSBpbnB1dEJveFN0eWxlczogSUlucHV0Qm94U3R5bGVzO1xuXHRyZWFkb25seSBkaWFsb2dTdHlsZXM6IElEaWFsb2dTdHlsZXM7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSURpYWxvZ1Jlc3VsdCB7XG5cdHJlYWRvbmx5IGJ1dHRvbjogbnVtYmVyO1xuXHRyZWFkb25seSBjaGVja2JveENoZWNrZWQ/OiBib29sZWFuO1xuXHRyZWFkb25seSB2YWx1ZXM/OiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRGlhbG9nU3R5bGVzIHtcblx0cmVhZG9ubHkgZGlhbG9nRm9yZWdyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBkaWFsb2dCYWNrZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGRpYWxvZ1NoYWRvdzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBkaWFsb2dCb3JkZXI6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgZXJyb3JJY29uRm9yZWdyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSB3YXJuaW5nSWNvbkZvcmVncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgaW5mb0ljb25Gb3JlZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IHRleHRMaW5rRm9yZWdyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5pbnRlcmZhY2UgQnV0dG9uTWFwRW50cnkge1xuXHRyZWFkb25seSBsYWJlbDogc3RyaW5nO1xuXHRyZWFkb25seSBpbmRleDogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgRGlhbG9nIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBlbGVtZW50OiBIVE1MRWxlbWVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHNoYWRvd0VsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIG1vZGFsRWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgYnV0dG9uc0NvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgbWVzc2FnZURldGFpbEVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IG1lc3NhZ2VDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IGljb25FbGVtZW50OiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBjaGVja2JveDogQ2hlY2tib3ggfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgdG9vbGJhckNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgYnV0dG9uQmFyOiBCdXR0b25CYXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZm9jdXNUb1JldHVybjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgaW5wdXRzOiBJbnB1dEJveFtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IGJ1dHRvbnM6IHN0cmluZ1tdO1xuXHRwcml2YXRlIHJlYWRvbmx5IGJ1dHRvblN0eWxlczogSUJ1dHRvblN0eWxlcztcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHByaXZhdGUgbWVzc2FnZTogc3RyaW5nLCBidXR0b25zOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCwgcHJpdmF0ZSByZWFkb25seSBvcHRpb25zOiBJRGlhbG9nT3B0aW9ucykge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLm1vZGFsRWxlbWVudCA9IHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKCQoYC5tb25hY28tZGlhbG9nLW1vZGFsLWJsb2NrLmRpbW1lZGApKTtcblx0XHR0aGlzLnNoYWRvd0VsZW1lbnQgPSB0aGlzLm1vZGFsRWxlbWVudC5hcHBlbmRDaGlsZCgkKCcuZGlhbG9nLXNoYWRvdycpKTtcblx0XHR0aGlzLmVsZW1lbnQgPSB0aGlzLnNoYWRvd0VsZW1lbnQuYXBwZW5kQ2hpbGQoJCgnLm1vbmFjby1kaWFsb2ctYm94JykpO1xuXHRcdHRoaXMuZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnZGlhbG9nJyk7XG5cdFx0dGhpcy5lbGVtZW50LnRhYkluZGV4ID0gLTE7XG5cdFx0aGlkZSh0aGlzLmVsZW1lbnQpO1xuXG5cdFx0dGhpcy5idXR0b25TdHlsZXMgPSBvcHRpb25zLmJ1dHRvblN0eWxlcztcblxuXHRcdGlmIChBcnJheS5pc0FycmF5KGJ1dHRvbnMpICYmIGJ1dHRvbnMubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5idXR0b25zID0gYnV0dG9ucztcblx0XHR9IGVsc2UgaWYgKCF0aGlzLm9wdGlvbnMuZGlzYWJsZURlZmF1bHRBY3Rpb24pIHtcblx0XHRcdHRoaXMuYnV0dG9ucyA9IFtsb2NhbGl6ZSgnb2snLCBcIk9LXCIpXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5idXR0b25zID0gW107XG5cdFx0fVxuXHRcdGNvbnN0IGJ1dHRvbnNSb3dFbGVtZW50ID0gdGhpcy5lbGVtZW50LmFwcGVuZENoaWxkKCQoJy5kaWFsb2ctYnV0dG9ucy1yb3cnKSk7XG5cdFx0dGhpcy5idXR0b25zQ29udGFpbmVyID0gYnV0dG9uc1Jvd0VsZW1lbnQuYXBwZW5kQ2hpbGQoJCgnLmRpYWxvZy1idXR0b25zJykpO1xuXG5cdFx0Y29uc3QgbWVzc2FnZVJvd0VsZW1lbnQgPSB0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQoJCgnLmRpYWxvZy1tZXNzYWdlLXJvdycpKTtcblx0XHR0aGlzLmljb25FbGVtZW50ID0gbWVzc2FnZVJvd0VsZW1lbnQuYXBwZW5kQ2hpbGQoJCgnI21vbmFjby1kaWFsb2ctaWNvbi5kaWFsb2ctaWNvbicpKTtcblx0XHR0aGlzLmljb25FbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHRoaXMuZ2V0SWNvbkFyaWFMYWJlbCgpKTtcblx0XHR0aGlzLm1lc3NhZ2VDb250YWluZXIgPSBtZXNzYWdlUm93RWxlbWVudC5hcHBlbmRDaGlsZCgkKCcuZGlhbG9nLW1lc3NhZ2UtY29udGFpbmVyJykpO1xuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5kZXRhaWwgfHwgdGhpcy5vcHRpb25zLnJlbmRlckJvZHkpIHtcblx0XHRcdGNvbnN0IG1lc3NhZ2VFbGVtZW50ID0gdGhpcy5tZXNzYWdlQ29udGFpbmVyLmFwcGVuZENoaWxkKCQoJy5kaWFsb2ctbWVzc2FnZScpKTtcblx0XHRcdGNvbnN0IG1lc3NhZ2VUZXh0RWxlbWVudCA9IG1lc3NhZ2VFbGVtZW50LmFwcGVuZENoaWxkKCQoJyNtb25hY28tZGlhbG9nLW1lc3NhZ2UtdGV4dC5kaWFsb2ctbWVzc2FnZS10ZXh0JykpO1xuXHRcdFx0bWVzc2FnZVRleHRFbGVtZW50LmlubmVyVGV4dCA9IHRoaXMubWVzc2FnZTtcblx0XHR9XG5cblx0XHR0aGlzLm1lc3NhZ2VEZXRhaWxFbGVtZW50ID0gdGhpcy5tZXNzYWdlQ29udGFpbmVyLmFwcGVuZENoaWxkKCQoJyNtb25hY28tZGlhbG9nLW1lc3NhZ2UtZGV0YWlsLmRpYWxvZy1tZXNzYWdlLWRldGFpbCcpKTtcblx0XHRpZiAodGhpcy5vcHRpb25zLmRldGFpbCB8fCAhdGhpcy5vcHRpb25zLnJlbmRlckJvZHkpIHtcblx0XHRcdHRoaXMubWVzc2FnZURldGFpbEVsZW1lbnQuaW5uZXJUZXh0ID0gdGhpcy5vcHRpb25zLmRldGFpbCA/IHRoaXMub3B0aW9ucy5kZXRhaWwgOiBtZXNzYWdlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm1lc3NhZ2VEZXRhaWxFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5yZW5kZXJCb2R5KSB7XG5cdFx0XHRjb25zdCBjdXN0b21Cb2R5ID0gdGhpcy5tZXNzYWdlQ29udGFpbmVyLmFwcGVuZENoaWxkKCQoJyNtb25hY28tZGlhbG9nLW1lc3NhZ2UtYm9keS5kaWFsb2ctbWVzc2FnZS1ib2R5JykpO1xuXHRcdFx0dGhpcy5vcHRpb25zLnJlbmRlckJvZHkoY3VzdG9tQm9keSk7XG5cblx0XHRcdGZvciAoY29uc3QgZWwgb2YgdGhpcy5tZXNzYWdlQ29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJ2EnKSkge1xuXHRcdFx0XHRlbC50YWJJbmRleCA9IDA7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5pbnB1dHMpIHtcblx0XHRcdHRoaXMuaW5wdXRzID0gdGhpcy5vcHRpb25zLmlucHV0cy5tYXAoaW5wdXQgPT4ge1xuXHRcdFx0XHRjb25zdCBpbnB1dFJvd0VsZW1lbnQgPSB0aGlzLm1lc3NhZ2VDb250YWluZXIuYXBwZW5kQ2hpbGQoJCgnLmRpYWxvZy1tZXNzYWdlLWlucHV0JykpO1xuXG5cdFx0XHRcdGNvbnN0IGlucHV0Qm94ID0gdGhpcy5fcmVnaXN0ZXIobmV3IElucHV0Qm94KGlucHV0Um93RWxlbWVudCwgdW5kZWZpbmVkLCB7XG5cdFx0XHRcdFx0cGxhY2Vob2xkZXI6IGlucHV0LnBsYWNlaG9sZGVyLFxuXHRcdFx0XHRcdHR5cGU6IGlucHV0LnR5cGUgPz8gJ3RleHQnLFxuXHRcdFx0XHRcdGlucHV0Qm94U3R5bGVzOiBvcHRpb25zLmlucHV0Qm94U3R5bGVzXG5cdFx0XHRcdH0pKTtcblxuXHRcdFx0XHRpZiAoaW5wdXQudmFsdWUpIHtcblx0XHRcdFx0XHRpbnB1dEJveC52YWx1ZSA9IGlucHV0LnZhbHVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGlucHV0Qm94O1xuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuaW5wdXRzID0gW107XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5jaGVja2JveExhYmVsKSB7XG5cdFx0XHRjb25zdCBjaGVja2JveFJvd0VsZW1lbnQgPSB0aGlzLm1lc3NhZ2VDb250YWluZXIuYXBwZW5kQ2hpbGQoJCgnLmRpYWxvZy1jaGVja2JveC1yb3cnKSk7XG5cblx0XHRcdGNvbnN0IGNoZWNrYm94ID0gdGhpcy5jaGVja2JveCA9IHRoaXMuX3JlZ2lzdGVyKFxuXHRcdFx0XHRuZXcgQ2hlY2tib3godGhpcy5vcHRpb25zLmNoZWNrYm94TGFiZWwsICEhdGhpcy5vcHRpb25zLmNoZWNrYm94Q2hlY2tlZCwgb3B0aW9ucy5jaGVja2JveFN0eWxlcylcblx0XHRcdCk7XG5cblx0XHRcdGNoZWNrYm94Um93RWxlbWVudC5hcHBlbmRDaGlsZChjaGVja2JveC5kb21Ob2RlKTtcblxuXHRcdFx0Y29uc3QgY2hlY2tib3hNZXNzYWdlRWxlbWVudCA9IGNoZWNrYm94Um93RWxlbWVudC5hcHBlbmRDaGlsZCgkKCcuZGlhbG9nLWNoZWNrYm94LW1lc3NhZ2UnKSk7XG5cdFx0XHRjaGVja2JveE1lc3NhZ2VFbGVtZW50LmlubmVyVGV4dCA9IHRoaXMub3B0aW9ucy5jaGVja2JveExhYmVsO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGNoZWNrYm94TWVzc2FnZUVsZW1lbnQsIEV2ZW50VHlwZS5DTElDSywgKCkgPT4gY2hlY2tib3guY2hlY2tlZCA9ICFjaGVja2JveC5jaGVja2VkKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9vbGJhclJvd0VsZW1lbnQgPSB0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQoJCgnLmRpYWxvZy10b29sYmFyLXJvdycpKTtcblx0XHR0aGlzLnRvb2xiYXJDb250YWluZXIgPSB0b29sYmFyUm93RWxlbWVudC5hcHBlbmRDaGlsZCgkKCcuZGlhbG9nLXRvb2xiYXInKSk7XG5cblx0XHR0aGlzLmFwcGx5U3R5bGVzKCk7XG5cdH1cblxuXHRwcml2YXRlIGdldEljb25BcmlhTGFiZWwoKTogc3RyaW5nIHtcblx0XHRsZXQgdHlwZUxhYmVsID0gbG9jYWxpemUoJ2RpYWxvZ0luZm9NZXNzYWdlJywgJ0luZm8nKTtcblx0XHRzd2l0Y2ggKHRoaXMub3B0aW9ucy50eXBlKSB7XG5cdFx0XHRjYXNlICdlcnJvcic6XG5cdFx0XHRcdHR5cGVMYWJlbCA9IGxvY2FsaXplKCdkaWFsb2dFcnJvck1lc3NhZ2UnLCAnRXJyb3InKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICd3YXJuaW5nJzpcblx0XHRcdFx0dHlwZUxhYmVsID0gbG9jYWxpemUoJ2RpYWxvZ1dhcm5pbmdNZXNzYWdlJywgJ1dhcm5pbmcnKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdwZW5kaW5nJzpcblx0XHRcdFx0dHlwZUxhYmVsID0gbG9jYWxpemUoJ2RpYWxvZ1BlbmRpbmdNZXNzYWdlJywgJ0luIFByb2dyZXNzJyk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnbm9uZSc6XG5cdFx0XHRjYXNlICdpbmZvJzpcblx0XHRcdGNhc2UgJ3F1ZXN0aW9uJzpcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdHJldHVybiB0eXBlTGFiZWw7XG5cdH1cblxuXHR1cGRhdGVNZXNzYWdlKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMubWVzc2FnZURldGFpbEVsZW1lbnQuaW5uZXJUZXh0ID0gbWVzc2FnZTtcblx0fVxuXG5cdGFzeW5jIHNob3coKTogUHJvbWlzZTxJRGlhbG9nUmVzdWx0PiB7XG5cdFx0dGhpcy5mb2N1c1RvUmV0dXJuID0gdGhpcy5jb250YWluZXIub3duZXJEb2N1bWVudC5hY3RpdmVFbGVtZW50IGFzIEhUTUxFbGVtZW50O1xuXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPElEaWFsb2dSZXN1bHQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0Y2xlYXJOb2RlKHRoaXMuYnV0dG9uc0NvbnRhaW5lcik7XG5cblx0XHRcdGNvbnN0IGNsb3NlID0gKCkgPT4ge1xuXHRcdFx0XHRyZXNvbHZlKHtcblx0XHRcdFx0XHRidXR0b246IHRoaXMub3B0aW9ucy5jYW5jZWxJZCB8fCAwLFxuXHRcdFx0XHRcdGNoZWNrYm94Q2hlY2tlZDogdGhpcy5jaGVja2JveCA/IHRoaXMuY2hlY2tib3guY2hlY2tlZCA6IHVuZGVmaW5lZFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZShjbG9zZSkpO1xuXG5cdFx0XHRjb25zdCBidXR0b25CYXIgPSB0aGlzLmJ1dHRvbkJhciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBCdXR0b25CYXIodGhpcy5idXR0b25zQ29udGFpbmVyKSk7XG5cdFx0XHRjb25zdCBidXR0b25NYXAgPSB0aGlzLnJlYXJyYW5nZUJ1dHRvbnModGhpcy5idXR0b25zLCB0aGlzLm9wdGlvbnMuY2FuY2VsSWQpO1xuXG5cdFx0XHRjb25zdCBvbkJ1dHRvbkNsaWNrID0gKGluZGV4OiBudW1iZXIpID0+IHtcblx0XHRcdFx0cmVzb2x2ZSh7XG5cdFx0XHRcdFx0YnV0dG9uOiBidXR0b25NYXBbaW5kZXhdLmluZGV4LFxuXHRcdFx0XHRcdGNoZWNrYm94Q2hlY2tlZDogdGhpcy5jaGVja2JveCA/IHRoaXMuY2hlY2tib3guY2hlY2tlZCA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHR2YWx1ZXM6IHRoaXMuaW5wdXRzLmxlbmd0aCA+IDAgPyB0aGlzLmlucHV0cy5tYXAoaW5wdXQgPT4gaW5wdXQudmFsdWUpIDogdW5kZWZpbmVkXG5cdFx0XHRcdH0pO1xuXHRcdFx0fTtcblxuXHRcdFx0Ly8gSGFuZGxlIGJ1dHRvbiBjbGlja3Ncblx0XHRcdGJ1dHRvbk1hcC5mb3JFYWNoKChfLCBpbmRleCkgPT4ge1xuXHRcdFx0XHRjb25zdCBwcmltYXJ5ID0gYnV0dG9uTWFwW2luZGV4XS5pbmRleCA9PT0gMDtcblxuXHRcdFx0XHRsZXQgYnV0dG9uOiBJQnV0dG9uO1xuXHRcdFx0XHRpZiAocHJpbWFyeSAmJiB0aGlzLm9wdGlvbnM/LnByaW1hcnlCdXR0b25Ecm9wZG93bikge1xuXHRcdFx0XHRcdGNvbnN0IGFjdGlvbnMgPSBpc0FjdGlvblByb3ZpZGVyKHRoaXMub3B0aW9ucy5wcmltYXJ5QnV0dG9uRHJvcGRvd24uYWN0aW9ucykgPyB0aGlzLm9wdGlvbnMucHJpbWFyeUJ1dHRvbkRyb3Bkb3duLmFjdGlvbnMuZ2V0QWN0aW9ucygpIDogdGhpcy5vcHRpb25zLnByaW1hcnlCdXR0b25Ecm9wZG93bi5hY3Rpb25zO1xuXHRcdFx0XHRcdGJ1dHRvbiA9IHRoaXMuX3JlZ2lzdGVyKGJ1dHRvbkJhci5hZGRCdXR0b25XaXRoRHJvcGRvd24oe1xuXHRcdFx0XHRcdFx0Li4udGhpcy5vcHRpb25zLnByaW1hcnlCdXR0b25Ecm9wZG93bixcblx0XHRcdFx0XHRcdC4uLnRoaXMuYnV0dG9uU3R5bGVzLFxuXHRcdFx0XHRcdFx0ZHJvcGRvd25MYXllcjogMjYwMCwgLy8gZW5zdXJlIHRoZSBkcm9wZG93biBpcyBhYm92ZSB0aGUgZGlhbG9nXG5cdFx0XHRcdFx0XHRhY3Rpb25zOiBhY3Rpb25zLm1hcChhY3Rpb24gPT4gdG9BY3Rpb24oe1xuXHRcdFx0XHRcdFx0XHQuLi5hY3Rpb24sXG5cdFx0XHRcdFx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGF3YWl0IGFjdGlvbi5ydW4oKTtcblxuXHRcdFx0XHRcdFx0XHRcdG9uQnV0dG9uQ2xpY2soaW5kZXgpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KSlcblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAodGhpcy5vcHRpb25zLmJ1dHRvbkRldGFpbHMpIHtcblx0XHRcdFx0XHRidXR0b24gPSB0aGlzLl9yZWdpc3RlcihidXR0b25CYXIuYWRkQnV0dG9uV2l0aERlc2NyaXB0aW9uKHsgc2Vjb25kYXJ5OiAhcHJpbWFyeSwgLi4udGhpcy5idXR0b25TdHlsZXMgfSkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGJ1dHRvbiA9IHRoaXMuX3JlZ2lzdGVyKGJ1dHRvbkJhci5hZGRCdXR0b24oeyBzZWNvbmRhcnk6ICFwcmltYXJ5LCAuLi50aGlzLmJ1dHRvblN0eWxlcyB9KSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRidXR0b24ubGFiZWwgPSBtbmVtb25pY0J1dHRvbkxhYmVsKGJ1dHRvbk1hcFtpbmRleF0ubGFiZWwsIHRydWUpO1xuXHRcdFx0XHRpZiAoYnV0dG9uIGluc3RhbmNlb2YgQnV0dG9uV2l0aERlc2NyaXB0aW9uKSB7XG5cdFx0XHRcdFx0YnV0dG9uLmRlc2NyaXB0aW9uID0gdGhpcy5vcHRpb25zLmJ1dHRvbkRldGFpbHMhW2J1dHRvbk1hcFtpbmRleF0uaW5kZXhdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKGJ1dHRvbi5vbkRpZENsaWNrKGUgPT4ge1xuXHRcdFx0XHRcdGlmIChlKSB7XG5cdFx0XHRcdFx0XHRFdmVudEhlbHBlci5zdG9wKGUpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdG9uQnV0dG9uQ2xpY2soaW5kZXgpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gSGFuZGxlIGtleWJvYXJkIGV2ZW50cyBnbG9iYWxseTogVGFiLCBBcnJvdy1MZWZ0L1JpZ2h0XG5cdFx0XHRjb25zdCB3aW5kb3cgPSBnZXRXaW5kb3codGhpcy5jb250YWluZXIpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHdpbmRvdywgJ2tleWRvd24nLCBlID0+IHtcblx0XHRcdFx0Y29uc3QgZXZ0ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblxuXHRcdFx0XHRpZiAoZXZ0LmVxdWFscyhLZXlNb2QuQWx0KSkge1xuXHRcdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGV2dC5lcXVhbHMoS2V5Q29kZS5FbnRlcikpIHtcblxuXHRcdFx0XHRcdC8vIEVudGVyIGluIGlucHV0IGZpZWxkIHNob3VsZCBPSyB0aGUgZGlhbG9nXG5cdFx0XHRcdFx0aWYgKHRoaXMuaW5wdXRzLnNvbWUoaW5wdXQgPT4gaW5wdXQuaGFzRm9jdXMoKSkpIHtcblx0XHRcdFx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZSk7XG5cblx0XHRcdFx0XHRcdHJlc29sdmUoe1xuXHRcdFx0XHRcdFx0XHRidXR0b246IGJ1dHRvbk1hcC5maW5kKGJ1dHRvbiA9PiBidXR0b24uaW5kZXggIT09IHRoaXMub3B0aW9ucy5jYW5jZWxJZCk/LmluZGV4ID8/IDAsXG5cdFx0XHRcdFx0XHRcdGNoZWNrYm94Q2hlY2tlZDogdGhpcy5jaGVja2JveCA/IHRoaXMuY2hlY2tib3guY2hlY2tlZCA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0dmFsdWVzOiB0aGlzLmlucHV0cy5sZW5ndGggPiAwID8gdGhpcy5pbnB1dHMubWFwKGlucHV0ID0+IGlucHV0LnZhbHVlKSA6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuOyAvLyBsZWF2ZSBkZWZhdWx0IGhhbmRsaW5nXG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBDbWQrRCAodHJpZ2dlciB0aGUgXCJub1wiL1wiZG8gbm90IHNhdmVcIi1idXR0b24pIChtYWNPUyBvbmx5KVxuXHRcdFx0XHRpZiAoaXNNYWNpbnRvc2ggJiYgZXZ0LmVxdWFscyhLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5RCkpIHtcblx0XHRcdFx0XHRFdmVudEhlbHBlci5zdG9wKGUpO1xuXG5cdFx0XHRcdFx0Y29uc3Qgbm9CdXR0b24gPSBidXR0b25NYXAuZmluZChidXR0b24gPT4gYnV0dG9uLmluZGV4ID09PSAxICYmIGJ1dHRvbi5pbmRleCAhPT0gdGhpcy5vcHRpb25zLmNhbmNlbElkKTtcblx0XHRcdFx0XHRpZiAobm9CdXR0b24pIHtcblx0XHRcdFx0XHRcdHJlc29sdmUoe1xuXHRcdFx0XHRcdFx0XHRidXR0b246IG5vQnV0dG9uLmluZGV4LFxuXHRcdFx0XHRcdFx0XHRjaGVja2JveENoZWNrZWQ6IHRoaXMuY2hlY2tib3ggPyB0aGlzLmNoZWNrYm94LmNoZWNrZWQgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdHZhbHVlczogdGhpcy5pbnB1dHMubGVuZ3RoID4gMCA/IHRoaXMuaW5wdXRzLm1hcChpbnB1dCA9PiBpbnB1dC52YWx1ZSkgOiB1bmRlZmluZWRcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybjsgLy8gbGVhdmUgZGVmYXVsdCBoYW5kbGluZ1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGV2dC5lcXVhbHMoS2V5Q29kZS5TcGFjZSkpIHtcblx0XHRcdFx0XHRyZXR1cm47IC8vIGxlYXZlIGRlZmF1bHQgaGFuZGxpbmdcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxldCBldmVudEhhbmRsZWQgPSBmYWxzZTtcblxuXHRcdFx0XHQvLyBGb2N1czogTmV4dCAvIFByZXZpb3VzXG5cdFx0XHRcdGlmIChldnQuZXF1YWxzKEtleUNvZGUuVGFiKSB8fCBldnQuZXF1YWxzKEtleUNvZGUuUmlnaHRBcnJvdykgfHwgZXZ0LmVxdWFscyhLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlRhYikgfHwgZXZ0LmVxdWFscyhLZXlDb2RlLkxlZnRBcnJvdykpIHtcblxuXHRcdFx0XHRcdC8vIEJ1aWxkIGEgbGlzdCBvZiBmb2N1c2FibGUgZWxlbWVudHMgaW4gdGhlaXIgdmlzdWFsIG9yZGVyXG5cdFx0XHRcdFx0Y29uc3QgZm9jdXNhYmxlRWxlbWVudHM6IHsgZm9jdXM6ICgpID0+IHZvaWQgfVtdID0gW107XG5cdFx0XHRcdFx0bGV0IGZvY3VzZWRJbmRleCA9IC0xO1xuXG5cdFx0XHRcdFx0aWYgKHRoaXMubWVzc2FnZUNvbnRhaW5lcikge1xuXHRcdFx0XHRcdFx0Y29uc3QgbGlua3MgPSB0aGlzLm1lc3NhZ2VDb250YWluZXIucXVlcnlTZWxlY3RvckFsbCgnYScpO1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBsaW5rIG9mIGxpbmtzKSB7XG5cdFx0XHRcdFx0XHRcdGZvY3VzYWJsZUVsZW1lbnRzLnB1c2gobGluayk7XG5cdFx0XHRcdFx0XHRcdGlmIChpc0FjdGl2ZUVsZW1lbnQobGluaykpIHtcblx0XHRcdFx0XHRcdFx0XHRmb2N1c2VkSW5kZXggPSBmb2N1c2FibGVFbGVtZW50cy5sZW5ndGggLSAxO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Zm9yIChjb25zdCBpbnB1dCBvZiB0aGlzLmlucHV0cykge1xuXHRcdFx0XHRcdFx0Zm9jdXNhYmxlRWxlbWVudHMucHVzaChpbnB1dCk7XG5cdFx0XHRcdFx0XHRpZiAoaW5wdXQuaGFzRm9jdXMoKSkge1xuXHRcdFx0XHRcdFx0XHRmb2N1c2VkSW5kZXggPSBmb2N1c2FibGVFbGVtZW50cy5sZW5ndGggLSAxO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICh0aGlzLmNoZWNrYm94KSB7XG5cdFx0XHRcdFx0XHRmb2N1c2FibGVFbGVtZW50cy5wdXNoKHRoaXMuY2hlY2tib3gpO1xuXHRcdFx0XHRcdFx0aWYgKHRoaXMuY2hlY2tib3guaGFzRm9jdXMoKSkge1xuXHRcdFx0XHRcdFx0XHRmb2N1c2VkSW5kZXggPSBmb2N1c2FibGVFbGVtZW50cy5sZW5ndGggLSAxO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICh0aGlzLmJ1dHRvbkJhcikge1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBidXR0b24gb2YgdGhpcy5idXR0b25CYXIuYnV0dG9ucykge1xuXHRcdFx0XHRcdFx0XHRpZiAoYnV0dG9uIGluc3RhbmNlb2YgQnV0dG9uV2l0aERyb3Bkb3duKSB7XG5cdFx0XHRcdFx0XHRcdFx0Zm9jdXNhYmxlRWxlbWVudHMucHVzaChidXR0b24ucHJpbWFyeUJ1dHRvbik7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGJ1dHRvbi5wcmltYXJ5QnV0dG9uLmhhc0ZvY3VzKCkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGZvY3VzZWRJbmRleCA9IGZvY3VzYWJsZUVsZW1lbnRzLmxlbmd0aCAtIDE7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGZvY3VzYWJsZUVsZW1lbnRzLnB1c2goYnV0dG9uLmRyb3Bkb3duQnV0dG9uKTtcblx0XHRcdFx0XHRcdFx0XHRpZiAoYnV0dG9uLmRyb3Bkb3duQnV0dG9uLmhhc0ZvY3VzKCkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGZvY3VzZWRJbmRleCA9IGZvY3VzYWJsZUVsZW1lbnRzLmxlbmd0aCAtIDE7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdGZvY3VzYWJsZUVsZW1lbnRzLnB1c2goYnV0dG9uKTtcblx0XHRcdFx0XHRcdFx0XHRpZiAoYnV0dG9uLmhhc0ZvY3VzKCkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGZvY3VzZWRJbmRleCA9IGZvY3VzYWJsZUVsZW1lbnRzLmxlbmd0aCAtIDE7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gRm9jdXMgbmV4dCBlbGVtZW50ICh3aXRoIHdyYXBwaW5nKVxuXHRcdFx0XHRcdGlmIChldnQuZXF1YWxzKEtleUNvZGUuVGFiKSB8fCBldnQuZXF1YWxzKEtleUNvZGUuUmlnaHRBcnJvdykpIHtcblx0XHRcdFx0XHRcdGNvbnN0IG5ld0ZvY3VzZWRJbmRleCA9IChmb2N1c2VkSW5kZXggKyAxKSAlIGZvY3VzYWJsZUVsZW1lbnRzLmxlbmd0aDtcblx0XHRcdFx0XHRcdGZvY3VzYWJsZUVsZW1lbnRzW25ld0ZvY3VzZWRJbmRleF0uZm9jdXMoKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBGb2N1cyBwcmV2aW91cyBlbGVtZW50ICh3aXRoIHdyYXBwaW5nKVxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0aWYgKGZvY3VzZWRJbmRleCA9PT0gLTEpIHtcblx0XHRcdFx0XHRcdFx0Zm9jdXNlZEluZGV4ID0gZm9jdXNhYmxlRWxlbWVudHMubGVuZ3RoOyAvLyBkZWZhdWx0IHRvIGZvY3VzIGxhc3QgZWxlbWVudCBpZiBub25lIGhhdmUgZm9jdXNcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0bGV0IG5ld0ZvY3VzZWRJbmRleCA9IGZvY3VzZWRJbmRleCAtIDE7XG5cdFx0XHRcdFx0XHRpZiAobmV3Rm9jdXNlZEluZGV4ID09PSAtMSkge1xuXHRcdFx0XHRcdFx0XHRuZXdGb2N1c2VkSW5kZXggPSBmb2N1c2FibGVFbGVtZW50cy5sZW5ndGggLSAxO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRmb2N1c2FibGVFbGVtZW50c1tuZXdGb2N1c2VkSW5kZXhdLmZvY3VzKCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0ZXZlbnRIYW5kbGVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChldmVudEhhbmRsZWQpIHtcblx0XHRcdFx0XHRFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5rZXlFdmVudFByb2Nlc3Nvcikge1xuXHRcdFx0XHRcdHRoaXMub3B0aW9ucy5rZXlFdmVudFByb2Nlc3NvcihldnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB0cnVlKSk7XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih3aW5kb3csICdrZXl1cCcsIGUgPT4ge1xuXHRcdFx0XHRFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpO1xuXHRcdFx0XHRjb25zdCBldnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXG5cdFx0XHRcdGlmICghdGhpcy5vcHRpb25zLmRpc2FibGVDbG9zZUFjdGlvbiAmJiBldnQuZXF1YWxzKEtleUNvZGUuRXNjYXBlKSkge1xuXHRcdFx0XHRcdGNsb3NlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHRydWUpKTtcblxuXHRcdFx0Ly8gRGV0ZWN0IGZvY3VzIG91dFxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuZWxlbWVudCwgJ2ZvY3Vzb3V0JywgZSA9PiB7XG5cdFx0XHRcdGlmICghIWUucmVsYXRlZFRhcmdldCAmJiAhIXRoaXMuZWxlbWVudCkge1xuXHRcdFx0XHRcdGlmICghaXNBbmNlc3RvcihlLnJlbGF0ZWRUYXJnZXQgYXMgSFRNTEVsZW1lbnQsIHRoaXMuZWxlbWVudCkpIHtcblx0XHRcdFx0XHRcdHRoaXMuZm9jdXNUb1JldHVybiA9IGUucmVsYXRlZFRhcmdldCBhcyBIVE1MRWxlbWVudDtcblxuXHRcdFx0XHRcdFx0aWYgKGUudGFyZ2V0KSB7XG5cdFx0XHRcdFx0XHRcdChlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkuZm9jdXMoKTtcblx0XHRcdFx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sIGZhbHNlKSk7XG5cblx0XHRcdGNvbnN0IHNwaW5Nb2RpZmllckNsYXNzTmFtZSA9ICdjb2RpY29uLW1vZGlmaWVyLXNwaW4nO1xuXG5cdFx0XHR0aGlzLmljb25FbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoQ29kaWNvbi5kaWFsb2dFcnJvciksIC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KENvZGljb24uZGlhbG9nV2FybmluZyksIC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KENvZGljb24uZGlhbG9nSW5mbyksIC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KENvZGljb24ubG9hZGluZyksIHNwaW5Nb2RpZmllckNsYXNzTmFtZSk7XG5cblx0XHRcdGlmICh0aGlzLm9wdGlvbnMuaWNvbikge1xuXHRcdFx0XHR0aGlzLmljb25FbGVtZW50LmNsYXNzTGlzdC5hZGQoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkodGhpcy5vcHRpb25zLmljb24pKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHN3aXRjaCAodGhpcy5vcHRpb25zLnR5cGUpIHtcblx0XHRcdFx0XHRjYXNlICdlcnJvcic6XG5cdFx0XHRcdFx0XHR0aGlzLmljb25FbGVtZW50LmNsYXNzTGlzdC5hZGQoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoQ29kaWNvbi5kaWFsb2dFcnJvcikpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnd2FybmluZyc6XG5cdFx0XHRcdFx0XHR0aGlzLmljb25FbGVtZW50LmNsYXNzTGlzdC5hZGQoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoQ29kaWNvbi5kaWFsb2dXYXJuaW5nKSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICdwZW5kaW5nJzpcblx0XHRcdFx0XHRcdHRoaXMuaWNvbkVsZW1lbnQuY2xhc3NMaXN0LmFkZCguLi5UaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShDb2RpY29uLmxvYWRpbmcpLCBzcGluTW9kaWZpZXJDbGFzc05hbWUpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnbm9uZSc6XG5cdFx0XHRcdFx0XHR0aGlzLmljb25FbGVtZW50LmNsYXNzTGlzdC5hZGQoJ25vLWNvZGljb24nKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgJ2luZm8nOlxuXHRcdFx0XHRcdGNhc2UgJ3F1ZXN0aW9uJzpcblx0XHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdFx0dGhpcy5pY29uRWxlbWVudC5jbGFzc0xpc3QuYWRkKC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KENvZGljb24uZGlhbG9nSW5mbykpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXG5cdFx0XHRpZiAoIXRoaXMub3B0aW9ucy5kaXNhYmxlQ2xvc2VBY3Rpb24pIHtcblx0XHRcdFx0Y29uc3QgYWN0aW9uQmFyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEFjdGlvbkJhcih0aGlzLnRvb2xiYXJDb250YWluZXIsIHt9KSk7XG5cblx0XHRcdFx0Y29uc3QgYWN0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEFjdGlvbignZGlhbG9nLmNsb3NlJywgbG9jYWxpemUoJ2RpYWxvZ0Nsb3NlJywgXCJDbG9zZSBEaWFsb2dcIiksIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLmRpYWxvZ0Nsb3NlKSwgdHJ1ZSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHJlc29sdmUoe1xuXHRcdFx0XHRcdFx0YnV0dG9uOiB0aGlzLm9wdGlvbnMuY2FuY2VsSWQgfHwgMCxcblx0XHRcdFx0XHRcdGNoZWNrYm94Q2hlY2tlZDogdGhpcy5jaGVja2JveCA/IHRoaXMuY2hlY2tib3guY2hlY2tlZCA6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KSk7XG5cblx0XHRcdFx0YWN0aW9uQmFyLnB1c2goYWN0aW9uLCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSB9KTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5hcHBseVN0eWxlcygpO1xuXG5cdFx0XHR0aGlzLmVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLW1vZGFsJywgJ3RydWUnKTtcblx0XHRcdHRoaXMuZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWxsZWRieScsICdtb25hY28tZGlhbG9nLWljb24gbW9uYWNvLWRpYWxvZy1tZXNzYWdlLXRleHQnKTtcblx0XHRcdHRoaXMuZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZGVzY3JpYmVkYnknLCAnbW9uYWNvLWRpYWxvZy1pY29uIG1vbmFjby1kaWFsb2ctbWVzc2FnZS10ZXh0IG1vbmFjby1kaWFsb2ctbWVzc2FnZS1kZXRhaWwgbW9uYWNvLWRpYWxvZy1tZXNzYWdlLWJvZHknKTtcblx0XHRcdHNob3codGhpcy5lbGVtZW50KTtcblxuXHRcdFx0Ly8gRm9jdXMgZmlyc3QgZWxlbWVudCAoaW5wdXQgb3IgYnV0dG9uKVxuXHRcdFx0aWYgKHRoaXMuaW5wdXRzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0dGhpcy5pbnB1dHNbMF0uZm9jdXMoKTtcblx0XHRcdFx0dGhpcy5pbnB1dHNbMF0uc2VsZWN0KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRidXR0b25NYXAuZm9yRWFjaCgodmFsdWUsIGluZGV4KSA9PiB7XG5cdFx0XHRcdFx0aWYgKHZhbHVlLmluZGV4ID09PSAwKSB7XG5cdFx0XHRcdFx0XHRidXR0b25CYXIuYnV0dG9uc1tpbmRleF0uZm9jdXMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhcHBseVN0eWxlcygpIHtcblx0XHRjb25zdCBzdHlsZSA9IHRoaXMub3B0aW9ucy5kaWFsb2dTdHlsZXM7XG5cblx0XHRjb25zdCBmZ0NvbG9yID0gc3R5bGUuZGlhbG9nRm9yZWdyb3VuZDtcblx0XHRjb25zdCBiZ0NvbG9yID0gc3R5bGUuZGlhbG9nQmFja2dyb3VuZDtcblx0XHRjb25zdCBzaGFkb3dDb2xvciA9IHN0eWxlLmRpYWxvZ1NoYWRvdyA/IGAwIDBweCA4cHggJHtzdHlsZS5kaWFsb2dTaGFkb3d9YCA6ICcnO1xuXHRcdGNvbnN0IGJvcmRlciA9IHN0eWxlLmRpYWxvZ0JvcmRlciA/IGAxcHggc29saWQgJHtzdHlsZS5kaWFsb2dCb3JkZXJ9YCA6ICcnO1xuXHRcdGNvbnN0IGxpbmtGZ0NvbG9yID0gc3R5bGUudGV4dExpbmtGb3JlZ3JvdW5kO1xuXG5cdFx0dGhpcy5zaGFkb3dFbGVtZW50LnN0eWxlLmJveFNoYWRvdyA9IHNoYWRvd0NvbG9yO1xuXG5cdFx0dGhpcy5lbGVtZW50LnN0eWxlLmNvbG9yID0gZmdDb2xvciA/PyAnJztcblx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYmdDb2xvciA/PyAnJztcblx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuYm9yZGVyID0gYm9yZGVyO1xuXG5cdFx0Ly8gVE9ETyBmaXhcblx0XHQvLyBpZiAoZmdDb2xvciAmJiBiZ0NvbG9yKSB7XG5cdFx0Ly8gXHRjb25zdCBtZXNzYWdlRGV0YWlsQ29sb3IgPSBmZ0NvbG9yLnRyYW5zcGFyZW50KC45KTtcblx0XHQvLyBcdHRoaXMubWVzc2FnZURldGFpbEVsZW1lbnQuc3R5bGUubWl4QmxlbmRNb2RlID0gbWVzc2FnZURldGFpbENvbG9yLm1ha2VPcGFxdWUoYmdDb2xvcikudG9TdHJpbmcoKTtcblx0XHQvLyB9XG5cblx0XHRpZiAobGlua0ZnQ29sb3IpIHtcblx0XHRcdGZvciAoY29uc3QgZWwgb2YgdGhpcy5tZXNzYWdlQ29udGFpbmVyLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdhJykpIHtcblx0XHRcdFx0ZWwuc3R5bGUuY29sb3IgPSBsaW5rRmdDb2xvcjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgY29sb3I7XG5cdFx0c3dpdGNoICh0aGlzLm9wdGlvbnMudHlwZSkge1xuXHRcdFx0Y2FzZSAnbm9uZSc6XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnZXJyb3InOlxuXHRcdFx0XHRjb2xvciA9IHN0eWxlLmVycm9ySWNvbkZvcmVncm91bmQ7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnd2FybmluZyc6XG5cdFx0XHRcdGNvbG9yID0gc3R5bGUud2FybmluZ0ljb25Gb3JlZ3JvdW5kO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGNvbG9yID0gc3R5bGUuaW5mb0ljb25Gb3JlZ3JvdW5kO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdFx0aWYgKGNvbG9yKSB7XG5cdFx0XHR0aGlzLmljb25FbGVtZW50LnN0eWxlLmNvbG9yID0gY29sb3I7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cblx0XHRpZiAodGhpcy5tb2RhbEVsZW1lbnQpIHtcblx0XHRcdHRoaXMubW9kYWxFbGVtZW50LnJlbW92ZSgpO1xuXHRcdFx0dGhpcy5tb2RhbEVsZW1lbnQgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZm9jdXNUb1JldHVybiAmJiBpc0FuY2VzdG9yKHRoaXMuZm9jdXNUb1JldHVybiwgdGhpcy5jb250YWluZXIub3duZXJEb2N1bWVudC5ib2R5KSkge1xuXHRcdFx0dGhpcy5mb2N1c1RvUmV0dXJuLmZvY3VzKCk7XG5cdFx0XHR0aGlzLmZvY3VzVG9SZXR1cm4gPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWFycmFuZ2VCdXR0b25zKGJ1dHRvbnM6IEFycmF5PHN0cmluZz4sIGNhbmNlbElkOiBudW1iZXIgfCB1bmRlZmluZWQpOiBCdXR0b25NYXBFbnRyeVtdIHtcblxuXHRcdC8vIE1hcHMgZWFjaCBidXR0b24gdG8gaXRzIGN1cnJlbnQgbGFiZWwgYW5kIG9sZCBpbmRleFxuXHRcdC8vIHNvIHRoYXQgd2hlbiB3ZSBtb3ZlIHRoZW0gYXJvdW5kIGl0J3Mgbm90IGEgcHJvYmxlbVxuXHRcdGNvbnN0IGJ1dHRvbk1hcDogQnV0dG9uTWFwRW50cnlbXSA9IGJ1dHRvbnMubWFwKChsYWJlbCwgaW5kZXgpID0+ICh7IGxhYmVsLCBpbmRleCB9KSk7XG5cblx0XHRpZiAoYnV0dG9ucy5sZW5ndGggPCAyKSB7XG5cdFx0XHRyZXR1cm4gYnV0dG9uTWFwOyAvLyBvbmx5IG5lZWQgdG8gcmVhcnJhbmdlIGlmIHRoZXJlIGFyZSAyKyBidXR0b25zXG5cdFx0fVxuXG5cdFx0aWYgKGlzTWFjaW50b3NoIHx8IGlzTGludXgpIHtcblxuXHRcdFx0Ly8gTGludXg6IHRoZSBHTk9NRSBISUcgKGh0dHBzOi8vZGV2ZWxvcGVyLmdub21lLm9yZy9oaWcvcGF0dGVybnMvZmVlZGJhY2svZGlhbG9ncy5odG1sP2hpZ2hsaWdodD1kaWFsb2cpXG5cdFx0XHQvLyByZWNvbW1lbmQgdGhlIGZvbGxvd2luZzpcblx0XHRcdC8vIFwiQWx3YXlzIGVuc3VyZSB0aGF0IHRoZSBjYW5jZWwgYnV0dG9uIGFwcGVhcnMgZmlyc3QsIGJlZm9yZSB0aGUgYWZmaXJtYXRpdmUgYnV0dG9uLiBJbiBsZWZ0LXRvLXJpZ2h0XG5cdFx0XHQvLyAgbG9jYWxlcywgdGhpcyBpcyBvbiB0aGUgbGVmdC4gVGhpcyBidXR0b24gb3JkZXIgZW5zdXJlcyB0aGF0IHVzZXJzIGJlY29tZSBhd2FyZSBvZiwgYW5kIGFyZSByZW1pbmRlZFxuXHRcdFx0Ly8gIG9mLCB0aGUgYWJpbGl0eSB0byBjYW5jZWwgcHJpb3IgdG8gZW5jb3VudGVyaW5nIHRoZSBhZmZpcm1hdGl2ZSBidXR0b24uXCJcblxuXHRcdFx0Ly8gbWFjT1M6IHRoZSBISUcgKGh0dHBzOi8vZGV2ZWxvcGVyLmFwcGxlLmNvbS9kZXNpZ24vaHVtYW4taW50ZXJmYWNlLWd1aWRlbGluZXMvY29tcG9uZW50cy9wcmVzZW50YXRpb24vYWxlcnRzKVxuXHRcdFx0Ly8gcmVjb21tZW5kIHRoZSBmb2xsb3dpbmc6XG5cdFx0XHQvLyBcIlBsYWNlIGJ1dHRvbnMgd2hlcmUgcGVvcGxlIGV4cGVjdC4gSW4gZ2VuZXJhbCwgcGxhY2UgdGhlIGJ1dHRvbiBwZW9wbGUgYXJlIG1vc3QgbGlrZWx5IHRvIGNob29zZSBvbiB0aGUgdHJhaWxpbmcgc2lkZSBpbiBhXG5cdFx0XHQvLyAgcm93IG9mIGJ1dHRvbnMgb3IgYXQgdGhlIHRvcCBpbiBhIHN0YWNrIG9mIGJ1dHRvbnMuIEFsd2F5cyBwbGFjZSB0aGUgZGVmYXVsdCBidXR0b24gb24gdGhlIHRyYWlsaW5nIHNpZGUgb2YgYSByb3cgb3IgYXQgdGhlXG5cdFx0XHQvLyAgdG9wIG9mIGEgc3RhY2suIENhbmNlbCBidXR0b25zIGFyZSB0eXBpY2FsbHkgb24gdGhlIGxlYWRpbmcgc2lkZSBvZiBhIHJvdyBvciBhdCB0aGUgYm90dG9tIG9mIGEgc3RhY2suXCJcblxuXHRcdFx0aWYgKHR5cGVvZiBjYW5jZWxJZCA9PT0gJ251bWJlcicgJiYgYnV0dG9uTWFwW2NhbmNlbElkXSkge1xuXHRcdFx0XHRjb25zdCBjYW5jZWxCdXR0b24gPSBidXR0b25NYXAuc3BsaWNlKGNhbmNlbElkLCAxKVswXTtcblx0XHRcdFx0YnV0dG9uTWFwLnNwbGljZSgxLCAwLCBjYW5jZWxCdXR0b24pO1xuXHRcdFx0fVxuXG5cdFx0XHRidXR0b25NYXAucmV2ZXJzZSgpO1xuXHRcdH0gZWxzZSBpZiAoaXNXaW5kb3dzKSB7XG5cblx0XHRcdC8vIFdpbmRvd3M6IHRoZSBISUcgKGh0dHBzOi8vbGVhcm4ubWljcm9zb2Z0LmNvbS9lbi11cy93aW5kb3dzL3dpbjMyL3V4Z3VpZGUvd2luLWRpYWxvZy1ib3gpXG5cdFx0XHQvLyByZWNvbW1lbmQgdGhlIGZvbGxvd2luZzpcblx0XHRcdC8vIFwiT25lIG9mIHRoZSBmb2xsb3dpbmcgc2V0cyBvZiBjb25jaXNlIGNvbW1hbmRzOiBZZXMvTm8sIFllcy9Oby9DYW5jZWwsIFtEbyBpdF0vQ2FuY2VsLFxuXHRcdFx0Ly8gIFtEbyBpdF0vW0Rvbid0IGRvIGl0XSwgW0RvIGl0XS9bRG9uJ3QgZG8gaXRdL0NhbmNlbC5cIlxuXG5cdFx0XHRpZiAodHlwZW9mIGNhbmNlbElkID09PSAnbnVtYmVyJyAmJiBidXR0b25NYXBbY2FuY2VsSWRdKSB7XG5cdFx0XHRcdGNvbnN0IGNhbmNlbEJ1dHRvbiA9IGJ1dHRvbk1hcC5zcGxpY2UoY2FuY2VsSWQsIDEpWzBdO1xuXHRcdFx0XHRidXR0b25NYXAucHVzaChjYW5jZWxCdXR0b24pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBidXR0b25NYXA7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU87QUFDUCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLEdBQUcsdUJBQXVCLFdBQVcsYUFBYSxXQUFXLFdBQVcsTUFBTSxpQkFBaUIsWUFBWSxZQUFZO0FBQ2hJLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsV0FBVyx1QkFBdUIsMEJBQThFO0FBQ3pILFNBQTBCLGdCQUFnQjtBQUMxQyxTQUEwQixnQkFBZ0I7QUFDMUMsU0FBUyxRQUFRLGdCQUFnQjtBQUNqQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxTQUFTLGNBQWM7QUFDaEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxZQUFZLG9CQUFvQjtBQUN6QyxTQUFTLFNBQVMsYUFBYSxpQkFBaUI7QUFDaEQsU0FBUyx3QkFBd0I7QUFrRDFCLE1B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
