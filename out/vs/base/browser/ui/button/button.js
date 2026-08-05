import { addDisposableListener, EventHelper, EventType, isActiveElement, reset, trackFocus, $ } from "../../dom.js";
import dompurify from "../../dompurify/dompurify.js";
import { StandardKeyboardEvent } from "../../keyboardEvent.js";
import { renderMarkdown, renderStringAsPlaintext } from "../../markdownRenderer.js";
import { Gesture, EventType as TouchEventType } from "../../touch.js";
import { createInstantHoverDelegate, getDefaultHoverDelegate } from "../hover/hoverDelegateFactory.js";
import { renderLabelWithIcons } from "../iconLabel/iconLabels.js";
import { Action } from "../../../common/actions.js";
import { Codicon } from "../../../common/codicons.js";
import { Color } from "../../../common/color.js";
import { Emitter } from "../../../common/event.js";
import { isMarkdownString, markdownStringEqual } from "../../../common/htmlContent.js";
import { KeyCode } from "../../../common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../common/lifecycle.js";
import { ThemeIcon } from "../../../common/themables.js";
import "./button.css";
import { localize } from "../../../../nls.js";
import { getBaseLayerHoverDelegate } from "../hover/hoverDelegate2.js";
const unthemedButtonStyles = {
  buttonBackground: "#0E639C",
  buttonHoverBackground: "#006BB3",
  buttonSeparator: Color.white.toString(),
  buttonForeground: Color.white.toString(),
  buttonBorder: void 0,
  buttonSecondaryBackground: void 0,
  buttonSecondaryForeground: void 0,
  buttonSecondaryHoverBackground: void 0
};
class Button extends Disposable {
  constructor(container, options) {
    super();
    this._label = "";
    this._onDidClick = this._register(new Emitter());
    this._onDidEscape = this._register(new Emitter());
    this.options = options;
    this._element = document.createElement("a");
    this._element.classList.add("monaco-button");
    this._element.tabIndex = 0;
    this._element.setAttribute("role", "button");
    this._element.classList.toggle("secondary", !!options.secondary);
    const background = options.secondary ? options.buttonSecondaryBackground : options.buttonBackground;
    const foreground = options.secondary ? options.buttonSecondaryForeground : options.buttonForeground;
    this._element.style.color = foreground || "";
    this._element.style.backgroundColor = background || "";
    if (options.supportShortLabel) {
      this._labelShortElement = document.createElement("div");
      this._labelShortElement.classList.add("monaco-button-label-short");
      this._element.appendChild(this._labelShortElement);
      this._labelElement = document.createElement("div");
      this._labelElement.classList.add("monaco-button-label");
      this._element.appendChild(this._labelElement);
      this._element.classList.add("monaco-text-button-with-short-label");
    }
    if (typeof options.title === "string") {
      this.setTitle(options.title);
    }
    if (typeof options.ariaLabel === "string") {
      this._element.setAttribute("aria-label", options.ariaLabel);
    }
    container.appendChild(this._element);
    this._register(Gesture.addTarget(this._element));
    [EventType.CLICK, TouchEventType.Tap].forEach((eventType) => {
      this._register(addDisposableListener(this._element, eventType, (e) => {
        if (!this.enabled) {
          EventHelper.stop(e);
          return;
        }
        this._onDidClick.fire(e);
      }));
    });
    this._register(addDisposableListener(this._element, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      let eventHandled = false;
      if (this.enabled && (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space))) {
        this._onDidClick.fire(e);
        eventHandled = true;
      } else if (event.equals(KeyCode.Escape)) {
        this._onDidEscape.fire(e);
        this._element.blur();
        eventHandled = true;
      }
      if (eventHandled) {
        EventHelper.stop(event, true);
      }
    }));
    this._register(addDisposableListener(this._element, EventType.MOUSE_OVER, (e) => {
      if (!this._element.classList.contains("disabled")) {
        this.updateBackground(true);
      }
    }));
    this._register(addDisposableListener(this._element, EventType.MOUSE_OUT, (e) => {
      this.updateBackground(false);
    }));
    this.focusTracker = this._register(trackFocus(this._element));
    this._register(this.focusTracker.onDidFocus(() => {
      if (this.enabled) {
        this.updateBackground(true);
      }
    }));
    this._register(this.focusTracker.onDidBlur(() => {
      if (this.enabled) {
        this.updateBackground(false);
      }
    }));
  }
  get onDidClick() {
    return this._onDidClick.event;
  }
  get onDidEscape() {
    return this._onDidEscape.event;
  }
  dispose() {
    super.dispose();
    this._element.remove();
  }
  getContentElements(content) {
    const elements = [];
    for (let segment of renderLabelWithIcons(content)) {
      if (typeof segment === "string") {
        segment = segment.trim();
        if (segment === "") {
          continue;
        }
        const node = document.createElement("span");
        node.textContent = segment;
        elements.push(node);
      } else {
        elements.push(segment);
      }
    }
    return elements;
  }
  updateBackground(hover) {
    let background;
    if (this.options.secondary) {
      background = hover ? this.options.buttonSecondaryHoverBackground : this.options.buttonSecondaryBackground;
    } else {
      background = hover ? this.options.buttonHoverBackground : this.options.buttonBackground;
    }
    if (background) {
      this._element.style.backgroundColor = background;
    }
  }
  get element() {
    return this._element;
  }
  set label(value) {
    if (this._label === value) {
      return;
    }
    if (isMarkdownString(this._label) && isMarkdownString(value) && markdownStringEqual(this._label, value)) {
      return;
    }
    this._element.classList.add("monaco-text-button");
    const labelElement = this.options.supportShortLabel ? this._labelElement : this._element;
    if (isMarkdownString(value)) {
      const rendered = renderMarkdown(value, { inline: true });
      rendered.dispose();
      const root = rendered.element.querySelector("p")?.innerHTML;
      if (root) {
        const sanitized = dompurify.sanitize(root, { ADD_TAGS: ["b", "i", "u", "code", "span"], ALLOWED_ATTR: ["class"], RETURN_TRUSTED_TYPE: true });
        labelElement.innerHTML = sanitized;
      } else {
        reset(labelElement);
      }
    } else {
      if (this.options.supportIcons) {
        reset(labelElement, ...this.getContentElements(value));
      } else {
        labelElement.textContent = value;
      }
    }
    let title = "";
    if (typeof this.options.title === "string") {
      title = this.options.title;
    } else if (this.options.title) {
      title = renderStringAsPlaintext(value);
    }
    this.setTitle(title);
    this._setAriaLabel();
    this._label = value;
  }
  get label() {
    return this._label;
  }
  set labelShort(value) {
    if (!this.options.supportShortLabel || !this._labelShortElement) {
      return;
    }
    if (this.options.supportIcons) {
      reset(this._labelShortElement, ...this.getContentElements(value));
    } else {
      this._labelShortElement.textContent = value;
    }
  }
  _setAriaLabel() {
    if (typeof this.options.ariaLabel === "string") {
      this._element.setAttribute("aria-label", this.options.ariaLabel);
    } else if (typeof this.options.title === "string") {
      this._element.setAttribute("aria-label", this.options.title);
    }
  }
  set icon(icon) {
    this._setAriaLabel();
    const oldIcons = Array.from(this._element.classList).filter((item) => item.startsWith("codicon-"));
    this._element.classList.remove(...oldIcons);
    this._element.classList.add(...ThemeIcon.asClassNameArray(icon));
  }
  set enabled(value) {
    if (value) {
      this._element.classList.remove("disabled");
      this._element.setAttribute("aria-disabled", String(false));
      this._element.tabIndex = 0;
    } else {
      this._element.classList.add("disabled");
      this._element.setAttribute("aria-disabled", String(true));
    }
  }
  get enabled() {
    return !this._element.classList.contains("disabled");
  }
  set checked(value) {
    if (value) {
      this._element.classList.add("checked");
      this._element.setAttribute("aria-checked", "true");
    } else {
      this._element.classList.remove("checked");
      this._element.setAttribute("aria-checked", "false");
    }
  }
  get checked() {
    return this._element.classList.contains("checked");
  }
  setTitle(title) {
    if (!this._hover && title !== "") {
      this._hover = this._register(getBaseLayerHoverDelegate().setupManagedHover(this.options.hoverDelegate ?? getDefaultHoverDelegate("element"), this._element, title));
    } else if (this._hover) {
      this._hover.update(title);
    }
  }
  focus() {
    this._element.focus();
  }
  hasFocus() {
    return isActiveElement(this._element);
  }
}
class ButtonWithDropdown extends Disposable {
  constructor(container, options) {
    super();
    this._onDidClick = this._register(new Emitter());
    this.onDidClick = this._onDidClick.event;
    this.element = document.createElement("div");
    this.element.classList.add("monaco-button-dropdown");
    container.appendChild(this.element);
    if (!options.hoverDelegate) {
      options = { ...options, hoverDelegate: this._register(createInstantHoverDelegate()) };
    }
    this.primaryButton = this._register(new Button(this.element, options));
    this._register(this.primaryButton.onDidClick((e) => this._onDidClick.fire(e)));
    this.action = this._register(new Action("primaryAction", renderStringAsPlaintext(this.primaryButton.label), void 0, true, async () => this._onDidClick.fire(void 0)));
    this.separatorContainer = document.createElement("div");
    this.separatorContainer.classList.add("monaco-button-dropdown-separator");
    this.separator = document.createElement("div");
    this.separatorContainer.appendChild(this.separator);
    this.element.appendChild(this.separatorContainer);
    const border = options.buttonBorder;
    if (border) {
      this.separatorContainer.style.borderTop = "1px solid " + border;
      this.separatorContainer.style.borderBottom = "1px solid " + border;
    }
    const buttonBackground = options.secondary ? options.buttonSecondaryBackground : options.buttonBackground;
    this.separatorContainer.style.backgroundColor = buttonBackground ?? "";
    this.separator.style.backgroundColor = options.buttonSeparator ?? "";
    this.dropdownButton = this._register(new Button(this.element, { ...options, title: localize("button dropdown more actions", "More Actions..."), supportIcons: true }));
    this.dropdownButton.element.setAttribute("aria-haspopup", "true");
    this.dropdownButton.element.setAttribute("aria-expanded", "false");
    this.dropdownButton.element.classList.add("monaco-dropdown-button");
    this.dropdownButton.icon = Codicon.dropDownButton;
    this._register(this.dropdownButton.onDidClick((e) => {
      const actions = Array.isArray(options.actions) ? options.actions : options.actions.getActions();
      options.contextMenuProvider.showContextMenu({
        getAnchor: () => this.dropdownButton.element,
        getActions: () => options.addPrimaryActionToDropdown === false ? [...actions] : [this.action, ...actions],
        actionRunner: options.actionRunner,
        onHide: () => this.dropdownButton.element.setAttribute("aria-expanded", "false"),
        layer: options.dropdownLayer
      });
      this.dropdownButton.element.setAttribute("aria-expanded", "true");
    }));
  }
  dispose() {
    super.dispose();
    this.element.remove();
  }
  set label(value) {
    this.primaryButton.label = value;
    this.action.label = value;
  }
  set icon(icon) {
    this.primaryButton.icon = icon;
  }
  set enabled(enabled) {
    this.primaryButton.enabled = enabled;
    this.dropdownButton.enabled = enabled;
    this.element.classList.toggle("disabled", !enabled);
  }
  get enabled() {
    return this.primaryButton.enabled;
  }
  set checked(value) {
    this.primaryButton.checked = value;
  }
  get checked() {
    return this.primaryButton.checked;
  }
  focus() {
    this.primaryButton.focus();
  }
  hasFocus() {
    return this.primaryButton.hasFocus() || this.dropdownButton.hasFocus();
  }
}
class ButtonWithDescription {
  constructor(container, options) {
    this.options = options;
    this._element = document.createElement("div");
    this._element.classList.add("monaco-description-button");
    this._button = new Button(this._element, options);
    this._descriptionElement = document.createElement("div");
    this._descriptionElement.classList.add("monaco-button-description");
    this._element.appendChild(this._descriptionElement);
    container.appendChild(this._element);
  }
  get onDidClick() {
    return this._button.onDidClick;
  }
  get element() {
    return this._element;
  }
  set label(value) {
    this._button.label = value;
  }
  set icon(icon) {
    this._button.icon = icon;
  }
  get enabled() {
    return this._button.enabled;
  }
  set enabled(enabled) {
    this._button.enabled = enabled;
  }
  set checked(value) {
    this._button.checked = value;
  }
  get checked() {
    return this._button.checked;
  }
  focus() {
    this._button.focus();
  }
  hasFocus() {
    return this._button.hasFocus();
  }
  dispose() {
    this._button.dispose();
  }
  set description(value) {
    if (this.options.supportIcons) {
      reset(this._descriptionElement, ...renderLabelWithIcons(value));
    } else {
      this._descriptionElement.textContent = value;
    }
  }
}
class ButtonBar {
  constructor(container) {
    this.container = container;
    this._buttons = [];
    this._buttonStore = new DisposableStore();
  }
  dispose() {
    this._buttonStore.dispose();
  }
  get buttons() {
    return this._buttons;
  }
  clear() {
    this._buttonStore.clear();
    this._buttons.length = 0;
  }
  addButton(options) {
    const button = this._buttonStore.add(new Button(this.container, options));
    this.pushButton(button);
    return button;
  }
  addButtonWithDescription(options) {
    const button = this._buttonStore.add(new ButtonWithDescription(this.container, options));
    this.pushButton(button);
    return button;
  }
  addButtonWithDropdown(options) {
    const button = this._buttonStore.add(new ButtonWithDropdown(this.container, options));
    this.pushButton(button);
    return button;
  }
  pushButton(button) {
    this._buttons.push(button);
    const index = this._buttons.length - 1;
    this._buttonStore.add(addDisposableListener(button.element, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      let eventHandled = true;
      let buttonIndexToFocus;
      if (event.equals(KeyCode.LeftArrow)) {
        buttonIndexToFocus = index > 0 ? index - 1 : this._buttons.length - 1;
      } else if (event.equals(KeyCode.RightArrow)) {
        buttonIndexToFocus = index === this._buttons.length - 1 ? 0 : index + 1;
      } else {
        eventHandled = false;
      }
      if (eventHandled && typeof buttonIndexToFocus === "number") {
        this._buttons[buttonIndexToFocus].focus();
        EventHelper.stop(e, true);
      }
    }));
  }
}
class ButtonWithIcon extends Button {
  constructor(container, options) {
    super(container, options);
    if (options.supportShortLabel) {
      throw new Error("ButtonWithIcon does not support short labels");
    }
    this._element.classList.add("monaco-icon-button");
    this._iconElement = $("");
    this._mdlabelElement = $(".monaco-button-mdlabel");
    this._element.append(this._iconElement, this._mdlabelElement);
  }
  set label(value) {
    if (this._label === value) {
      return;
    }
    if (isMarkdownString(this._label) && isMarkdownString(value) && markdownStringEqual(this._label, value)) {
      return;
    }
    this._element.classList.add("monaco-text-button");
    if (isMarkdownString(value)) {
      const rendered = renderMarkdown(value, { inline: true });
      rendered.dispose();
      const root = rendered.element.querySelector("p")?.innerHTML;
      if (root) {
        const sanitized = dompurify.sanitize(root, { ADD_TAGS: ["b", "i", "u", "code", "span"], ALLOWED_ATTR: ["class"], RETURN_TRUSTED_TYPE: true });
        this._mdlabelElement.innerHTML = sanitized;
      } else {
        reset(this._mdlabelElement);
      }
    } else {
      if (this.options.supportIcons) {
        reset(this._mdlabelElement, ...this.getContentElements(value));
      } else {
        this._mdlabelElement.textContent = value;
      }
    }
    let title = "";
    if (typeof this.options.title === "string") {
      title = this.options.title;
    } else if (this.options.title) {
      title = renderStringAsPlaintext(value);
    }
    this.setTitle(title);
    this._setAriaLabel();
    this._label = value;
  }
  set icon(icon) {
    this._iconElement.classList.value = "";
    this._iconElement.classList.add(...ThemeIcon.asClassNameArray(icon));
    this._setAriaLabel();
  }
}
export {
  Button,
  ButtonBar,
  ButtonWithDescription,
  ButtonWithDropdown,
  ButtonWithIcon,
  unthemedButtonStyles
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvYnV0dG9uL2J1dHRvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElDb250ZXh0TWVudVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vY29udGV4dG1lbnUuanMnO1xuaW1wb3J0IHsgYWRkRGlzcG9zYWJsZUxpc3RlbmVyLCBFdmVudEhlbHBlciwgRXZlbnRUeXBlLCBJRm9jdXNUcmFja2VyLCBpc0FjdGl2ZUVsZW1lbnQsIHJlc2V0LCB0cmFja0ZvY3VzLCAkIH0gZnJvbSAnLi4vLi4vZG9tLmpzJztcbmltcG9ydCBkb21wdXJpZnkgZnJvbSAnLi4vLi4vZG9tcHVyaWZ5L2RvbXB1cmlmeS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IHJlbmRlck1hcmtkb3duLCByZW5kZXJTdHJpbmdBc1BsYWludGV4dCB9IGZyb20gJy4uLy4uL21hcmtkb3duUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgR2VzdHVyZSwgRXZlbnRUeXBlIGFzIFRvdWNoRXZlbnRUeXBlIH0gZnJvbSAnLi4vLi4vdG91Y2guanMnO1xuaW1wb3J0IHsgY3JlYXRlSW5zdGFudEhvdmVyRGVsZWdhdGUsIGdldERlZmF1bHRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vaG92ZXIvaG92ZXJEZWxlZ2F0ZUZhY3RvcnkuanMnO1xuaW1wb3J0IHsgSUhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi9ob3Zlci9ob3ZlckRlbGVnYXRlLmpzJztcbmltcG9ydCB7IHJlbmRlckxhYmVsV2l0aEljb25zIH0gZnJvbSAnLi4vaWNvbkxhYmVsL2ljb25MYWJlbHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uLCBJQWN0aW9uLCBJQWN0aW9uUnVubmVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBFdmVudCBhcyBCYXNlRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nLCBpc01hcmtkb3duU3RyaW5nLCBtYXJrZG93blN0cmluZ0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgJy4vYnV0dG9uLmNzcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgdHlwZSB7IElNYW5hZ2VkSG92ZXIgfSBmcm9tICcuLi9ob3Zlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBnZXRCYXNlTGF5ZXJIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vaG92ZXIvaG92ZXJEZWxlZ2F0ZTIuanMnO1xuaW1wb3J0IHsgSUFjdGlvblByb3ZpZGVyIH0gZnJvbSAnLi4vZHJvcGRvd24vZHJvcGRvd24uanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElCdXR0b25PcHRpb25zIGV4dGVuZHMgUGFydGlhbDxJQnV0dG9uU3R5bGVzPiB7XG5cdHJlYWRvbmx5IHRpdGxlPzogYm9vbGVhbiB8IHN0cmluZztcblx0LyoqXG5cdCAqIFdpbGwgZmFsbGJhY2sgdG8gYHRpdGxlYCBpZiBub3Qgc2V0LlxuXHQgKi9cblx0cmVhZG9ubHkgYXJpYUxhYmVsPzogc3RyaW5nO1xuXHRyZWFkb25seSBzdXBwb3J0SWNvbnM/OiBib29sZWFuO1xuXHRyZWFkb25seSBzdXBwb3J0U2hvcnRMYWJlbD86IGJvb2xlYW47XG5cdHJlYWRvbmx5IHNlY29uZGFyeT86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGhvdmVyRGVsZWdhdGU/OiBJSG92ZXJEZWxlZ2F0ZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQnV0dG9uU3R5bGVzIHtcblx0cmVhZG9ubHkgYnV0dG9uQmFja2dyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBidXR0b25Ib3ZlckJhY2tncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgYnV0dG9uRm9yZWdyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBidXR0b25TZXBhcmF0b3I6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgYnV0dG9uU2Vjb25kYXJ5QmFja2dyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBidXR0b25TZWNvbmRhcnlIb3ZlckJhY2tncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgYnV0dG9uU2Vjb25kYXJ5Rm9yZWdyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBidXR0b25Cb3JkZXI6IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGNvbnN0IHVudGhlbWVkQnV0dG9uU3R5bGVzOiBJQnV0dG9uU3R5bGVzID0ge1xuXHRidXR0b25CYWNrZ3JvdW5kOiAnIzBFNjM5QycsXG5cdGJ1dHRvbkhvdmVyQmFja2dyb3VuZDogJyMwMDZCQjMnLFxuXHRidXR0b25TZXBhcmF0b3I6IENvbG9yLndoaXRlLnRvU3RyaW5nKCksXG5cdGJ1dHRvbkZvcmVncm91bmQ6IENvbG9yLndoaXRlLnRvU3RyaW5nKCksXG5cdGJ1dHRvbkJvcmRlcjogdW5kZWZpbmVkLFxuXHRidXR0b25TZWNvbmRhcnlCYWNrZ3JvdW5kOiB1bmRlZmluZWQsXG5cdGJ1dHRvblNlY29uZGFyeUZvcmVncm91bmQ6IHVuZGVmaW5lZCxcblx0YnV0dG9uU2Vjb25kYXJ5SG92ZXJCYWNrZ3JvdW5kOiB1bmRlZmluZWRcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUJ1dHRvbiBleHRlbmRzIElEaXNwb3NhYmxlIHtcblx0cmVhZG9ubHkgZWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IG9uRGlkQ2xpY2s6IEJhc2VFdmVudDxFdmVudCB8IHVuZGVmaW5lZD47XG5cblx0c2V0IGxhYmVsKHZhbHVlOiBzdHJpbmcgfCBJTWFya2Rvd25TdHJpbmcpO1xuXHRzZXQgaWNvbih2YWx1ZTogVGhlbWVJY29uKTtcblx0c2V0IGVuYWJsZWQodmFsdWU6IGJvb2xlYW4pO1xuXHRzZXQgY2hlY2tlZCh2YWx1ZTogYm9vbGVhbik7XG5cblx0Zm9jdXMoKTogdm9pZDtcblx0aGFzRm9jdXMoKTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQnV0dG9uV2l0aERlc2NyaXB0aW9uIGV4dGVuZHMgSUJ1dHRvbiB7XG5cdGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBCdXR0b24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUJ1dHRvbiB7XG5cblx0cHJvdGVjdGVkIG9wdGlvbnM6IElCdXR0b25PcHRpb25zO1xuXHRwcm90ZWN0ZWQgX2VsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRwcm90ZWN0ZWQgX2xhYmVsOiBzdHJpbmcgfCBJTWFya2Rvd25TdHJpbmcgPSAnJztcblx0cHJvdGVjdGVkIF9sYWJlbEVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcm90ZWN0ZWQgX2xhYmVsU2hvcnRFbGVtZW50OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfaG92ZXI6IElNYW5hZ2VkSG92ZXIgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfb25EaWRDbGljayA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPEV2ZW50PigpKTtcblx0Z2V0IG9uRGlkQ2xpY2soKTogQmFzZUV2ZW50PEV2ZW50PiB7IHJldHVybiB0aGlzLl9vbkRpZENsaWNrLmV2ZW50OyB9XG5cblx0cHJpdmF0ZSBfb25EaWRFc2NhcGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxFdmVudD4oKSk7XG5cdGdldCBvbkRpZEVzY2FwZSgpOiBCYXNlRXZlbnQ8RXZlbnQ+IHsgcmV0dXJuIHRoaXMuX29uRGlkRXNjYXBlLmV2ZW50OyB9XG5cblx0cHJpdmF0ZSBmb2N1c1RyYWNrZXI6IElGb2N1c1RyYWNrZXI7XG5cblx0Y29uc3RydWN0b3IoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgb3B0aW9uczogSUJ1dHRvbk9wdGlvbnMpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucztcblxuXHRcdHRoaXMuX2VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG5cdFx0dGhpcy5fZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdtb25hY28tYnV0dG9uJyk7XG5cdFx0dGhpcy5fZWxlbWVudC50YWJJbmRleCA9IDA7XG5cdFx0dGhpcy5fZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnYnV0dG9uJyk7XG5cblx0XHR0aGlzLl9lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ3NlY29uZGFyeScsICEhb3B0aW9ucy5zZWNvbmRhcnkpO1xuXHRcdGNvbnN0IGJhY2tncm91bmQgPSBvcHRpb25zLnNlY29uZGFyeSA/IG9wdGlvbnMuYnV0dG9uU2Vjb25kYXJ5QmFja2dyb3VuZCA6IG9wdGlvbnMuYnV0dG9uQmFja2dyb3VuZDtcblx0XHRjb25zdCBmb3JlZ3JvdW5kID0gb3B0aW9ucy5zZWNvbmRhcnkgPyBvcHRpb25zLmJ1dHRvblNlY29uZGFyeUZvcmVncm91bmQgOiBvcHRpb25zLmJ1dHRvbkZvcmVncm91bmQ7XG5cblx0XHR0aGlzLl9lbGVtZW50LnN0eWxlLmNvbG9yID0gZm9yZWdyb3VuZCB8fCAnJztcblx0XHR0aGlzLl9lbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGJhY2tncm91bmQgfHwgJyc7XG5cblx0XHRpZiAob3B0aW9ucy5zdXBwb3J0U2hvcnRMYWJlbCkge1xuXHRcdFx0dGhpcy5fbGFiZWxTaG9ydEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdHRoaXMuX2xhYmVsU2hvcnRFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ21vbmFjby1idXR0b24tbGFiZWwtc2hvcnQnKTtcblx0XHRcdHRoaXMuX2VsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5fbGFiZWxTaG9ydEVsZW1lbnQpO1xuXG5cdFx0XHR0aGlzLl9sYWJlbEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdHRoaXMuX2xhYmVsRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdtb25hY28tYnV0dG9uLWxhYmVsJyk7XG5cdFx0XHR0aGlzLl9lbGVtZW50LmFwcGVuZENoaWxkKHRoaXMuX2xhYmVsRWxlbWVudCk7XG5cblx0XHRcdHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LmFkZCgnbW9uYWNvLXRleHQtYnV0dG9uLXdpdGgtc2hvcnQtbGFiZWwnKTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIG9wdGlvbnMudGl0bGUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLnNldFRpdGxlKG9wdGlvbnMudGl0bGUpO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2Ygb3B0aW9ucy5hcmlhTGFiZWwgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLl9lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIG9wdGlvbnMuYXJpYUxhYmVsKTtcblx0XHR9XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX2VsZW1lbnQpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoR2VzdHVyZS5hZGRUYXJnZXQodGhpcy5fZWxlbWVudCkpO1xuXG5cdFx0W0V2ZW50VHlwZS5DTElDSywgVG91Y2hFdmVudFR5cGUuVGFwXS5mb3JFYWNoKGV2ZW50VHlwZSA9PiB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5fZWxlbWVudCwgZXZlbnRUeXBlLCBlID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLmVuYWJsZWQpIHtcblx0XHRcdFx0XHRFdmVudEhlbHBlci5zdG9wKGUpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuX29uRGlkQ2xpY2suZmlyZShlKTtcblx0XHRcdH0pKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9lbGVtZW50LCBFdmVudFR5cGUuS0VZX0RPV04sIGUgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0bGV0IGV2ZW50SGFuZGxlZCA9IGZhbHNlO1xuXHRcdFx0aWYgKHRoaXMuZW5hYmxlZCAmJiAoZXZlbnQuZXF1YWxzKEtleUNvZGUuRW50ZXIpIHx8IGV2ZW50LmVxdWFscyhLZXlDb2RlLlNwYWNlKSkpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDbGljay5maXJlKGUpO1xuXHRcdFx0XHRldmVudEhhbmRsZWQgPSB0cnVlO1xuXHRcdFx0fSBlbHNlIGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5Fc2NhcGUpKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkRXNjYXBlLmZpcmUoZSk7XG5cdFx0XHRcdHRoaXMuX2VsZW1lbnQuYmx1cigpO1xuXHRcdFx0XHRldmVudEhhbmRsZWQgPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZXZlbnRIYW5kbGVkKSB7XG5cdFx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZXZlbnQsIHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9lbGVtZW50LCBFdmVudFR5cGUuTU9VU0VfT1ZFUiwgZSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCdkaXNhYmxlZCcpKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlQmFja2dyb3VuZCh0cnVlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5fZWxlbWVudCwgRXZlbnRUeXBlLk1PVVNFX09VVCwgZSA9PiB7XG5cdFx0XHR0aGlzLnVwZGF0ZUJhY2tncm91bmQoZmFsc2UpOyAvLyByZXN0b3JlIHN0YW5kYXJkIHN0eWxlc1xuXHRcdH0pKTtcblxuXHRcdC8vIEFsc28gc2V0IGhvdmVyIGJhY2tncm91bmQgd2hlbiBidXR0b24gaXMgZm9jdXNlZCBmb3IgZmVlZGJhY2tcblx0XHR0aGlzLmZvY3VzVHJhY2tlciA9IHRoaXMuX3JlZ2lzdGVyKHRyYWNrRm9jdXModGhpcy5fZWxlbWVudCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZm9jdXNUcmFja2VyLm9uRGlkRm9jdXMoKCkgPT4geyBpZiAodGhpcy5lbmFibGVkKSB7IHRoaXMudXBkYXRlQmFja2dyb3VuZCh0cnVlKTsgfSB9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5mb2N1c1RyYWNrZXIub25EaWRCbHVyKCgpID0+IHsgaWYgKHRoaXMuZW5hYmxlZCkgeyB0aGlzLnVwZGF0ZUJhY2tncm91bmQoZmFsc2UpOyB9IH0pKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9lbGVtZW50LnJlbW92ZSgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldENvbnRlbnRFbGVtZW50cyhjb250ZW50OiBzdHJpbmcpOiBIVE1MRWxlbWVudFtdIHtcblx0XHRjb25zdCBlbGVtZW50czogSFRNTFNwYW5FbGVtZW50W10gPSBbXTtcblx0XHRmb3IgKGxldCBzZWdtZW50IG9mIHJlbmRlckxhYmVsV2l0aEljb25zKGNvbnRlbnQpKSB7XG5cdFx0XHRpZiAodHlwZW9mIChzZWdtZW50KSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0c2VnbWVudCA9IHNlZ21lbnQudHJpbSgpO1xuXG5cdFx0XHRcdC8vIElnbm9yZSBlbXB0eSBzZWdtZW50XG5cdFx0XHRcdGlmIChzZWdtZW50ID09PSAnJykge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gQ29udmVydCBzdHJpbmcgc2VnbWVudHMgdG8gPHNwYW4+IG5vZGVzXG5cdFx0XHRcdGNvbnN0IG5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0XHRcdG5vZGUudGV4dENvbnRlbnQgPSBzZWdtZW50O1xuXHRcdFx0XHRlbGVtZW50cy5wdXNoKG5vZGUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZWxlbWVudHMucHVzaChzZWdtZW50KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZWxlbWVudHM7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUJhY2tncm91bmQoaG92ZXI6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRsZXQgYmFja2dyb3VuZDtcblx0XHRpZiAodGhpcy5vcHRpb25zLnNlY29uZGFyeSkge1xuXHRcdFx0YmFja2dyb3VuZCA9IGhvdmVyID8gdGhpcy5vcHRpb25zLmJ1dHRvblNlY29uZGFyeUhvdmVyQmFja2dyb3VuZCA6IHRoaXMub3B0aW9ucy5idXR0b25TZWNvbmRhcnlCYWNrZ3JvdW5kO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRiYWNrZ3JvdW5kID0gaG92ZXIgPyB0aGlzLm9wdGlvbnMuYnV0dG9uSG92ZXJCYWNrZ3JvdW5kIDogdGhpcy5vcHRpb25zLmJ1dHRvbkJhY2tncm91bmQ7XG5cdFx0fVxuXHRcdGlmIChiYWNrZ3JvdW5kKSB7XG5cdFx0XHR0aGlzLl9lbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGJhY2tncm91bmQ7XG5cdFx0fVxuXHR9XG5cblx0Z2V0IGVsZW1lbnQoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLl9lbGVtZW50O1xuXHR9XG5cblx0c2V0IGxhYmVsKHZhbHVlOiBzdHJpbmcgfCBJTWFya2Rvd25TdHJpbmcpIHtcblx0XHRpZiAodGhpcy5fbGFiZWwgPT09IHZhbHVlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGlzTWFya2Rvd25TdHJpbmcodGhpcy5fbGFiZWwpICYmIGlzTWFya2Rvd25TdHJpbmcodmFsdWUpICYmIG1hcmtkb3duU3RyaW5nRXF1YWwodGhpcy5fbGFiZWwsIHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LmFkZCgnbW9uYWNvLXRleHQtYnV0dG9uJyk7XG5cdFx0Y29uc3QgbGFiZWxFbGVtZW50ID0gdGhpcy5vcHRpb25zLnN1cHBvcnRTaG9ydExhYmVsID8gdGhpcy5fbGFiZWxFbGVtZW50ISA6IHRoaXMuX2VsZW1lbnQ7XG5cblx0XHRpZiAoaXNNYXJrZG93blN0cmluZyh2YWx1ZSkpIHtcblx0XHRcdGNvbnN0IHJlbmRlcmVkID0gcmVuZGVyTWFya2Rvd24odmFsdWUsIHsgaW5saW5lOiB0cnVlIH0pO1xuXHRcdFx0cmVuZGVyZWQuZGlzcG9zZSgpO1xuXG5cdFx0XHQvLyBEb24ndCBpbmNsdWRlIG91dGVyIGA8cD5gXG5cdFx0XHRjb25zdCByb290ID0gcmVuZGVyZWQuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCdwJyk/LmlubmVySFRNTDtcblx0XHRcdGlmIChyb290KSB7XG5cdFx0XHRcdC8vIE9ubHkgYWxsb3cgYSB2ZXJ5IGxpbWl0ZWQgc2V0IG9mIGlubGluZSBodG1sIHRhZ3Ncblx0XHRcdFx0Y29uc3Qgc2FuaXRpemVkID0gZG9tcHVyaWZ5LnNhbml0aXplKHJvb3QsIHsgQUREX1RBR1M6IFsnYicsICdpJywgJ3UnLCAnY29kZScsICdzcGFuJ10sIEFMTE9XRURfQVRUUjogWydjbGFzcyddLCBSRVRVUk5fVFJVU1RFRF9UWVBFOiB0cnVlIH0pO1xuXHRcdFx0XHRsYWJlbEVsZW1lbnQuaW5uZXJIVE1MID0gc2FuaXRpemVkIGFzIHVua25vd24gYXMgc3RyaW5nO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzZXQobGFiZWxFbGVtZW50KTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHRoaXMub3B0aW9ucy5zdXBwb3J0SWNvbnMpIHtcblx0XHRcdFx0cmVzZXQobGFiZWxFbGVtZW50LCAuLi50aGlzLmdldENvbnRlbnRFbGVtZW50cyh2YWx1ZSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGFiZWxFbGVtZW50LnRleHRDb250ZW50ID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IHRpdGxlOiBzdHJpbmcgPSAnJztcblx0XHRpZiAodHlwZW9mIHRoaXMub3B0aW9ucy50aXRsZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRpdGxlID0gdGhpcy5vcHRpb25zLnRpdGxlO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5vcHRpb25zLnRpdGxlKSB7XG5cdFx0XHR0aXRsZSA9IHJlbmRlclN0cmluZ0FzUGxhaW50ZXh0KHZhbHVlKTtcblx0XHR9XG5cblx0XHR0aGlzLnNldFRpdGxlKHRpdGxlKTtcblxuXHRcdHRoaXMuX3NldEFyaWFMYWJlbCgpO1xuXG5cdFx0dGhpcy5fbGFiZWwgPSB2YWx1ZTtcblx0fVxuXG5cdGdldCBsYWJlbCgpOiBzdHJpbmcgfCBJTWFya2Rvd25TdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9sYWJlbDtcblx0fVxuXG5cdHNldCBsYWJlbFNob3J0KHZhbHVlOiBzdHJpbmcpIHtcblx0XHRpZiAoIXRoaXMub3B0aW9ucy5zdXBwb3J0U2hvcnRMYWJlbCB8fCAhdGhpcy5fbGFiZWxTaG9ydEVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5vcHRpb25zLnN1cHBvcnRJY29ucykge1xuXHRcdFx0cmVzZXQodGhpcy5fbGFiZWxTaG9ydEVsZW1lbnQsIC4uLnRoaXMuZ2V0Q29udGVudEVsZW1lbnRzKHZhbHVlKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2xhYmVsU2hvcnRFbGVtZW50LnRleHRDb250ZW50ID0gdmFsdWU7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIF9zZXRBcmlhTGFiZWwoKTogdm9pZCB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLm9wdGlvbnMuYXJpYUxhYmVsID09PSAnc3RyaW5nJykge1xuXHRcdFx0dGhpcy5fZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCB0aGlzLm9wdGlvbnMuYXJpYUxhYmVsKTtcblx0XHR9IGVsc2UgaWYgKHR5cGVvZiB0aGlzLm9wdGlvbnMudGl0bGUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLl9lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHRoaXMub3B0aW9ucy50aXRsZSk7XG5cdFx0fVxuXHR9XG5cblx0c2V0IGljb24oaWNvbjogVGhlbWVJY29uKSB7XG5cdFx0dGhpcy5fc2V0QXJpYUxhYmVsKCk7XG5cblx0XHRjb25zdCBvbGRJY29ucyA9IEFycmF5LmZyb20odGhpcy5fZWxlbWVudC5jbGFzc0xpc3QpLmZpbHRlcihpdGVtID0+IGl0ZW0uc3RhcnRzV2l0aCgnY29kaWNvbi0nKSk7XG5cdFx0dGhpcy5fZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKC4uLm9sZEljb25zKTtcblx0XHR0aGlzLl9lbGVtZW50LmNsYXNzTGlzdC5hZGQoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoaWNvbikpO1xuXHR9XG5cblx0c2V0IGVuYWJsZWQodmFsdWU6IGJvb2xlYW4pIHtcblx0XHRpZiAodmFsdWUpIHtcblx0XHRcdHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnZGlzYWJsZWQnKTtcblx0XHRcdHRoaXMuX2VsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJywgU3RyaW5nKGZhbHNlKSk7XG5cdFx0XHR0aGlzLl9lbGVtZW50LnRhYkluZGV4ID0gMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdkaXNhYmxlZCcpO1xuXHRcdFx0dGhpcy5fZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnLCBTdHJpbmcodHJ1ZSkpO1xuXHRcdH1cblx0fVxuXG5cdGdldCBlbmFibGVkKCkge1xuXHRcdHJldHVybiAhdGhpcy5fZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ2Rpc2FibGVkJyk7XG5cdH1cblxuXHRzZXQgY2hlY2tlZCh2YWx1ZTogYm9vbGVhbikge1xuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0dGhpcy5fZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdjaGVja2VkJyk7XG5cdFx0XHR0aGlzLl9lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1jaGVja2VkJywgJ3RydWUnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdjaGVja2VkJyk7XG5cdFx0XHR0aGlzLl9lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1jaGVja2VkJywgJ2ZhbHNlJyk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0IGNoZWNrZWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCdjaGVja2VkJyk7XG5cdH1cblxuXHRzZXRUaXRsZSh0aXRsZTogc3RyaW5nKSB7XG5cdFx0aWYgKCF0aGlzLl9ob3ZlciAmJiB0aXRsZSAhPT0gJycpIHtcblx0XHRcdHRoaXMuX2hvdmVyID0gdGhpcy5fcmVnaXN0ZXIoZ2V0QmFzZUxheWVySG92ZXJEZWxlZ2F0ZSgpLnNldHVwTWFuYWdlZEhvdmVyKHRoaXMub3B0aW9ucy5ob3ZlckRlbGVnYXRlID8/IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdlbGVtZW50JyksIHRoaXMuX2VsZW1lbnQsIHRpdGxlKSk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9ob3Zlcikge1xuXHRcdFx0dGhpcy5faG92ZXIudXBkYXRlKHRpdGxlKTtcblx0XHR9XG5cdH1cblxuXHRmb2N1cygpOiB2b2lkIHtcblx0XHR0aGlzLl9lbGVtZW50LmZvY3VzKCk7XG5cdH1cblxuXHRoYXNGb2N1cygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gaXNBY3RpdmVFbGVtZW50KHRoaXMuX2VsZW1lbnQpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUJ1dHRvbldpdGhEcm9wZG93bk9wdGlvbnMgZXh0ZW5kcyBJQnV0dG9uT3B0aW9ucyB7XG5cdHJlYWRvbmx5IGNvbnRleHRNZW51UHJvdmlkZXI6IElDb250ZXh0TWVudVByb3ZpZGVyO1xuXHRyZWFkb25seSBhY3Rpb25zOiByZWFkb25seSBJQWN0aW9uW10gfCBJQWN0aW9uUHJvdmlkZXI7XG5cdHJlYWRvbmx5IGFjdGlvblJ1bm5lcj86IElBY3Rpb25SdW5uZXI7XG5cdHJlYWRvbmx5IGFkZFByaW1hcnlBY3Rpb25Ub0Ryb3Bkb3duPzogYm9vbGVhbjtcblx0LyoqXG5cdCAqIGRyb3Bkb3duIG1lbnVzIHdpdGggaGlnaGVyIGxheWVycyBhcmUgcmVuZGVyZWQgaGlnaGVyIGluIHotaW5kZXggb3JkZXJcblx0ICovXG5cdHJlYWRvbmx5IGRyb3Bkb3duTGF5ZXI/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBCdXR0b25XaXRoRHJvcGRvd24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUJ1dHRvbiB7XG5cblx0cmVhZG9ubHkgcHJpbWFyeUJ1dHRvbjogQnV0dG9uO1xuXHRwcml2YXRlIHJlYWRvbmx5IGFjdGlvbjogQWN0aW9uO1xuXHRyZWFkb25seSBkcm9wZG93bkJ1dHRvbjogQnV0dG9uO1xuXHRwcml2YXRlIHJlYWRvbmx5IHNlcGFyYXRvckNvbnRhaW5lcjogSFRNTERpdkVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgc2VwYXJhdG9yOiBIVE1MRGl2RWxlbWVudDtcblxuXHRyZWFkb25seSBlbGVtZW50OiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDbGljayA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPEV2ZW50IHwgdW5kZWZpbmVkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDbGljayA9IHRoaXMuX29uRGlkQ2xpY2suZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgb3B0aW9uczogSUJ1dHRvbldpdGhEcm9wZG93bk9wdGlvbnMpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5lbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ21vbmFjby1idXR0b24tZHJvcGRvd24nKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5lbGVtZW50KTtcblxuXHRcdGlmICghb3B0aW9ucy5ob3ZlckRlbGVnYXRlKSB7XG5cdFx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBob3ZlckRlbGVnYXRlOiB0aGlzLl9yZWdpc3RlcihjcmVhdGVJbnN0YW50SG92ZXJEZWxlZ2F0ZSgpKSB9O1xuXHRcdH1cblxuXHRcdHRoaXMucHJpbWFyeUJ1dHRvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBCdXR0b24odGhpcy5lbGVtZW50LCBvcHRpb25zKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5wcmltYXJ5QnV0dG9uLm9uRGlkQ2xpY2soZSA9PiB0aGlzLl9vbkRpZENsaWNrLmZpcmUoZSkpKTtcblx0XHR0aGlzLmFjdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBBY3Rpb24oJ3ByaW1hcnlBY3Rpb24nLCByZW5kZXJTdHJpbmdBc1BsYWludGV4dCh0aGlzLnByaW1hcnlCdXR0b24ubGFiZWwpLCB1bmRlZmluZWQsIHRydWUsIGFzeW5jICgpID0+IHRoaXMuX29uRGlkQ2xpY2suZmlyZSh1bmRlZmluZWQpKSk7XG5cblx0XHR0aGlzLnNlcGFyYXRvckNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuc2VwYXJhdG9yQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ21vbmFjby1idXR0b24tZHJvcGRvd24tc2VwYXJhdG9yJyk7XG5cblx0XHR0aGlzLnNlcGFyYXRvciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuc2VwYXJhdG9yQ29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuc2VwYXJhdG9yKTtcblx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5zZXBhcmF0b3JDb250YWluZXIpO1xuXG5cdFx0Ly8gU2VwYXJhdG9yIHN0eWxlc1xuXHRcdGNvbnN0IGJvcmRlciA9IG9wdGlvbnMuYnV0dG9uQm9yZGVyO1xuXHRcdGlmIChib3JkZXIpIHtcblx0XHRcdHRoaXMuc2VwYXJhdG9yQ29udGFpbmVyLnN0eWxlLmJvcmRlclRvcCA9ICcxcHggc29saWQgJyArIGJvcmRlcjtcblx0XHRcdHRoaXMuc2VwYXJhdG9yQ29udGFpbmVyLnN0eWxlLmJvcmRlckJvdHRvbSA9ICcxcHggc29saWQgJyArIGJvcmRlcjtcblx0XHR9XG5cblx0XHRjb25zdCBidXR0b25CYWNrZ3JvdW5kID0gb3B0aW9ucy5zZWNvbmRhcnkgPyBvcHRpb25zLmJ1dHRvblNlY29uZGFyeUJhY2tncm91bmQgOiBvcHRpb25zLmJ1dHRvbkJhY2tncm91bmQ7XG5cdFx0dGhpcy5zZXBhcmF0b3JDb250YWluZXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYnV0dG9uQmFja2dyb3VuZCA/PyAnJztcblx0XHR0aGlzLnNlcGFyYXRvci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBvcHRpb25zLmJ1dHRvblNlcGFyYXRvciA/PyAnJztcblxuXHRcdHRoaXMuZHJvcGRvd25CdXR0b24gPSB0aGlzLl9yZWdpc3RlcihuZXcgQnV0dG9uKHRoaXMuZWxlbWVudCwgeyAuLi5vcHRpb25zLCB0aXRsZTogbG9jYWxpemUoXCJidXR0b24gZHJvcGRvd24gbW9yZSBhY3Rpb25zXCIsICdNb3JlIEFjdGlvbnMuLi4nKSwgc3VwcG9ydEljb25zOiB0cnVlIH0pKTtcblx0XHR0aGlzLmRyb3Bkb3duQnV0dG9uLmVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWhhc3BvcHVwJywgJ3RydWUnKTtcblx0XHR0aGlzLmRyb3Bkb3duQnV0dG9uLmVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XG5cdFx0dGhpcy5kcm9wZG93bkJ1dHRvbi5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ21vbmFjby1kcm9wZG93bi1idXR0b24nKTtcblx0XHR0aGlzLmRyb3Bkb3duQnV0dG9uLmljb24gPSBDb2RpY29uLmRyb3BEb3duQnV0dG9uO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZHJvcGRvd25CdXR0b24ub25EaWRDbGljayhlID0+IHtcblx0XHRcdGNvbnN0IGFjdGlvbnMgPSBBcnJheS5pc0FycmF5KG9wdGlvbnMuYWN0aW9ucykgPyBvcHRpb25zLmFjdGlvbnMgOiAob3B0aW9ucy5hY3Rpb25zIGFzIElBY3Rpb25Qcm92aWRlcikuZ2V0QWN0aW9ucygpO1xuXHRcdFx0b3B0aW9ucy5jb250ZXh0TWVudVByb3ZpZGVyLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRcdGdldEFuY2hvcjogKCkgPT4gdGhpcy5kcm9wZG93bkJ1dHRvbi5lbGVtZW50LFxuXHRcdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiBvcHRpb25zLmFkZFByaW1hcnlBY3Rpb25Ub0Ryb3Bkb3duID09PSBmYWxzZSA/IFsuLi5hY3Rpb25zXSA6IFt0aGlzLmFjdGlvbiwgLi4uYWN0aW9uc10sXG5cdFx0XHRcdGFjdGlvblJ1bm5lcjogb3B0aW9ucy5hY3Rpb25SdW5uZXIsXG5cdFx0XHRcdG9uSGlkZTogKCkgPT4gdGhpcy5kcm9wZG93bkJ1dHRvbi5lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpLFxuXHRcdFx0XHRsYXllcjogb3B0aW9ucy5kcm9wZG93bkxheWVyXG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuZHJvcGRvd25CdXR0b24uZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScpO1xuXHRcdH0pKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuZWxlbWVudC5yZW1vdmUoKTtcblx0fVxuXG5cdHNldCBsYWJlbCh2YWx1ZTogc3RyaW5nKSB7XG5cdFx0dGhpcy5wcmltYXJ5QnV0dG9uLmxhYmVsID0gdmFsdWU7XG5cdFx0dGhpcy5hY3Rpb24ubGFiZWwgPSB2YWx1ZTtcblx0fVxuXG5cdHNldCBpY29uKGljb246IFRoZW1lSWNvbikge1xuXHRcdHRoaXMucHJpbWFyeUJ1dHRvbi5pY29uID0gaWNvbjtcblx0fVxuXG5cdHNldCBlbmFibGVkKGVuYWJsZWQ6IGJvb2xlYW4pIHtcblx0XHR0aGlzLnByaW1hcnlCdXR0b24uZW5hYmxlZCA9IGVuYWJsZWQ7XG5cdFx0dGhpcy5kcm9wZG93bkJ1dHRvbi5lbmFibGVkID0gZW5hYmxlZDtcblxuXHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdkaXNhYmxlZCcsICFlbmFibGVkKTtcblx0fVxuXG5cdGdldCBlbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnByaW1hcnlCdXR0b24uZW5hYmxlZDtcblx0fVxuXG5cdHNldCBjaGVja2VkKHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5wcmltYXJ5QnV0dG9uLmNoZWNrZWQgPSB2YWx1ZTtcblx0fVxuXG5cdGdldCBjaGVja2VkKCkge1xuXHRcdHJldHVybiB0aGlzLnByaW1hcnlCdXR0b24uY2hlY2tlZDtcblx0fVxuXG5cdGZvY3VzKCk6IHZvaWQge1xuXHRcdHRoaXMucHJpbWFyeUJ1dHRvbi5mb2N1cygpO1xuXHR9XG5cblx0aGFzRm9jdXMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMucHJpbWFyeUJ1dHRvbi5oYXNGb2N1cygpIHx8IHRoaXMuZHJvcGRvd25CdXR0b24uaGFzRm9jdXMoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQnV0dG9uV2l0aERlc2NyaXB0aW9uIGltcGxlbWVudHMgSUJ1dHRvbldpdGhEZXNjcmlwdGlvbiB7XG5cdHByaXZhdGUgX2J1dHRvbjogQnV0dG9uO1xuXHRwcml2YXRlIF9lbGVtZW50OiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfZGVzY3JpcHRpb25FbGVtZW50OiBIVE1MRWxlbWVudDtcblxuXHRjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50LCBwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM6IElCdXR0b25PcHRpb25zKSB7XG5cdFx0dGhpcy5fZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LmFkZCgnbW9uYWNvLWRlc2NyaXB0aW9uLWJ1dHRvbicpO1xuXHRcdHRoaXMuX2J1dHRvbiA9IG5ldyBCdXR0b24odGhpcy5fZWxlbWVudCwgb3B0aW9ucyk7XG5cblx0XHR0aGlzLl9kZXNjcmlwdGlvbkVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9kZXNjcmlwdGlvbkVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnbW9uYWNvLWJ1dHRvbi1kZXNjcmlwdGlvbicpO1xuXHRcdHRoaXMuX2VsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5fZGVzY3JpcHRpb25FbGVtZW50KTtcblxuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLl9lbGVtZW50KTtcblx0fVxuXG5cdGdldCBvbkRpZENsaWNrKCk6IEJhc2VFdmVudDxFdmVudCB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl9idXR0b24ub25EaWRDbGljaztcblx0fVxuXG5cdGdldCBlbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5fZWxlbWVudDtcblx0fVxuXG5cdHNldCBsYWJlbCh2YWx1ZTogc3RyaW5nKSB7XG5cdFx0dGhpcy5fYnV0dG9uLmxhYmVsID0gdmFsdWU7XG5cdH1cblxuXHRzZXQgaWNvbihpY29uOiBUaGVtZUljb24pIHtcblx0XHR0aGlzLl9idXR0b24uaWNvbiA9IGljb247XG5cdH1cblxuXHRnZXQgZW5hYmxlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fYnV0dG9uLmVuYWJsZWQ7XG5cdH1cblxuXHRzZXQgZW5hYmxlZChlbmFibGVkOiBib29sZWFuKSB7XG5cdFx0dGhpcy5fYnV0dG9uLmVuYWJsZWQgPSBlbmFibGVkO1xuXHR9XG5cblx0c2V0IGNoZWNrZWQodmFsdWU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9idXR0b24uY2hlY2tlZCA9IHZhbHVlO1xuXHR9XG5cblx0Z2V0IGNoZWNrZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2J1dHRvbi5jaGVja2VkO1xuXHR9XG5cblx0Zm9jdXMoKTogdm9pZCB7XG5cdFx0dGhpcy5fYnV0dG9uLmZvY3VzKCk7XG5cdH1cblx0aGFzRm9jdXMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2J1dHRvbi5oYXNGb2N1cygpO1xuXHR9XG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fYnV0dG9uLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHNldCBkZXNjcmlwdGlvbih2YWx1ZTogc3RyaW5nKSB7XG5cdFx0aWYgKHRoaXMub3B0aW9ucy5zdXBwb3J0SWNvbnMpIHtcblx0XHRcdHJlc2V0KHRoaXMuX2Rlc2NyaXB0aW9uRWxlbWVudCwgLi4ucmVuZGVyTGFiZWxXaXRoSWNvbnModmFsdWUpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fZGVzY3JpcHRpb25FbGVtZW50LnRleHRDb250ZW50ID0gdmFsdWU7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBCdXR0b25CYXIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2J1dHRvbnM6IElCdXR0b25bXSA9IFtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9idXR0b25TdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcblxuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9idXR0b25TdG9yZS5kaXNwb3NlKCk7XG5cdH1cblxuXHRnZXQgYnV0dG9ucygpOiBJQnV0dG9uW10ge1xuXHRcdHJldHVybiB0aGlzLl9idXR0b25zO1xuXHR9XG5cblx0Y2xlYXIoKTogdm9pZCB7XG5cdFx0dGhpcy5fYnV0dG9uU3RvcmUuY2xlYXIoKTtcblx0XHR0aGlzLl9idXR0b25zLmxlbmd0aCA9IDA7XG5cdH1cblxuXHRhZGRCdXR0b24ob3B0aW9uczogSUJ1dHRvbk9wdGlvbnMpOiBJQnV0dG9uIHtcblx0XHRjb25zdCBidXR0b24gPSB0aGlzLl9idXR0b25TdG9yZS5hZGQobmV3IEJ1dHRvbih0aGlzLmNvbnRhaW5lciwgb3B0aW9ucykpO1xuXHRcdHRoaXMucHVzaEJ1dHRvbihidXR0b24pO1xuXHRcdHJldHVybiBidXR0b247XG5cdH1cblxuXHRhZGRCdXR0b25XaXRoRGVzY3JpcHRpb24ob3B0aW9uczogSUJ1dHRvbk9wdGlvbnMpOiBJQnV0dG9uV2l0aERlc2NyaXB0aW9uIHtcblx0XHRjb25zdCBidXR0b24gPSB0aGlzLl9idXR0b25TdG9yZS5hZGQobmV3IEJ1dHRvbldpdGhEZXNjcmlwdGlvbih0aGlzLmNvbnRhaW5lciwgb3B0aW9ucykpO1xuXHRcdHRoaXMucHVzaEJ1dHRvbihidXR0b24pO1xuXHRcdHJldHVybiBidXR0b247XG5cdH1cblxuXHRhZGRCdXR0b25XaXRoRHJvcGRvd24ob3B0aW9uczogSUJ1dHRvbldpdGhEcm9wZG93bk9wdGlvbnMpOiBJQnV0dG9uIHtcblx0XHRjb25zdCBidXR0b24gPSB0aGlzLl9idXR0b25TdG9yZS5hZGQobmV3IEJ1dHRvbldpdGhEcm9wZG93bih0aGlzLmNvbnRhaW5lciwgb3B0aW9ucykpO1xuXHRcdHRoaXMucHVzaEJ1dHRvbihidXR0b24pO1xuXHRcdHJldHVybiBidXR0b247XG5cdH1cblxuXHRwcml2YXRlIHB1c2hCdXR0b24oYnV0dG9uOiBJQnV0dG9uKTogdm9pZCB7XG5cdFx0dGhpcy5fYnV0dG9ucy5wdXNoKGJ1dHRvbik7XG5cblx0XHRjb25zdCBpbmRleCA9IHRoaXMuX2J1dHRvbnMubGVuZ3RoIC0gMTtcblx0XHR0aGlzLl9idXR0b25TdG9yZS5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGJ1dHRvbi5lbGVtZW50LCBFdmVudFR5cGUuS0VZX0RPV04sIGUgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0bGV0IGV2ZW50SGFuZGxlZCA9IHRydWU7XG5cblx0XHRcdC8vIE5leHQgLyBQcmV2aW91cyBCdXR0b25cblx0XHRcdGxldCBidXR0b25JbmRleFRvRm9jdXM6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0XHRcdGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5MZWZ0QXJyb3cpKSB7XG5cdFx0XHRcdGJ1dHRvbkluZGV4VG9Gb2N1cyA9IGluZGV4ID4gMCA/IGluZGV4IC0gMSA6IHRoaXMuX2J1dHRvbnMubGVuZ3RoIC0gMTtcblx0XHRcdH0gZWxzZSBpZiAoZXZlbnQuZXF1YWxzKEtleUNvZGUuUmlnaHRBcnJvdykpIHtcblx0XHRcdFx0YnV0dG9uSW5kZXhUb0ZvY3VzID0gaW5kZXggPT09IHRoaXMuX2J1dHRvbnMubGVuZ3RoIC0gMSA/IDAgOiBpbmRleCArIDE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRldmVudEhhbmRsZWQgPSBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGV2ZW50SGFuZGxlZCAmJiB0eXBlb2YgYnV0dG9uSW5kZXhUb0ZvY3VzID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHR0aGlzLl9idXR0b25zW2J1dHRvbkluZGV4VG9Gb2N1c10uZm9jdXMoKTtcblx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblx0XHRcdH1cblxuXHRcdH0pKTtcblx0fVxufVxuXG4vKipcbiAqIFRoaXMgaXMgYSBCdXR0b24gdGhhdCBzdXBwb3J0cyBhbiBpY29uIHRvIHRoZSBsZWZ0LCBhbmQgbWFya2Rvd24gdG8gdGhlIHJpZ2h0LCB3aXRoIHByb3BlciBzZXBhcmF0aW9uIGFuZCB3cmFwcGluZyB0aGUgbWFya2Rvd24gbGFiZWwsIHdoaWNoIEJ1dHRvbiBkb2Vzbid0IGRvLlxuICovXG5leHBvcnQgY2xhc3MgQnV0dG9uV2l0aEljb24gZXh0ZW5kcyBCdXR0b24ge1xuXHRwcml2YXRlIF9pY29uRWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX21kbGFiZWxFbGVtZW50OiBIVE1MRWxlbWVudDtcblxuXHRjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50LCBvcHRpb25zOiBJQnV0dG9uT3B0aW9ucykge1xuXHRcdHN1cGVyKGNvbnRhaW5lciwgb3B0aW9ucyk7XG5cblx0XHRpZiAob3B0aW9ucy5zdXBwb3J0U2hvcnRMYWJlbCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdCdXR0b25XaXRoSWNvbiBkb2VzIG5vdCBzdXBwb3J0IHNob3J0IGxhYmVscycpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LmFkZCgnbW9uYWNvLWljb24tYnV0dG9uJyk7XG5cdFx0dGhpcy5faWNvbkVsZW1lbnQgPSAkKCcnKTtcblx0XHR0aGlzLl9tZGxhYmVsRWxlbWVudCA9ICQoJy5tb25hY28tYnV0dG9uLW1kbGFiZWwnKTtcblx0XHR0aGlzLl9lbGVtZW50LmFwcGVuZCh0aGlzLl9pY29uRWxlbWVudCwgdGhpcy5fbWRsYWJlbEVsZW1lbnQpO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2V0IGxhYmVsKHZhbHVlOiBJTWFya2Rvd25TdHJpbmcgfCBzdHJpbmcpIHtcblx0XHRpZiAodGhpcy5fbGFiZWwgPT09IHZhbHVlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGlzTWFya2Rvd25TdHJpbmcodGhpcy5fbGFiZWwpICYmIGlzTWFya2Rvd25TdHJpbmcodmFsdWUpICYmIG1hcmtkb3duU3RyaW5nRXF1YWwodGhpcy5fbGFiZWwsIHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2VsZW1lbnQuY2xhc3NMaXN0LmFkZCgnbW9uYWNvLXRleHQtYnV0dG9uJyk7XG5cdFx0aWYgKGlzTWFya2Rvd25TdHJpbmcodmFsdWUpKSB7XG5cdFx0XHRjb25zdCByZW5kZXJlZCA9IHJlbmRlck1hcmtkb3duKHZhbHVlLCB7IGlubGluZTogdHJ1ZSB9KTtcblx0XHRcdHJlbmRlcmVkLmRpc3Bvc2UoKTtcblxuXHRcdFx0Y29uc3Qgcm9vdCA9IHJlbmRlcmVkLmVsZW1lbnQucXVlcnlTZWxlY3RvcigncCcpPy5pbm5lckhUTUw7XG5cdFx0XHRpZiAocm9vdCkge1xuXHRcdFx0XHQvLyBPbmx5IGFsbG93IGEgdmVyeSBsaW1pdGVkIHNldCBvZiBpbmxpbmUgaHRtbCB0YWdzXG5cdFx0XHRcdGNvbnN0IHNhbml0aXplZCA9IGRvbXB1cmlmeS5zYW5pdGl6ZShyb290LCB7IEFERF9UQUdTOiBbJ2InLCAnaScsICd1JywgJ2NvZGUnLCAnc3BhbiddLCBBTExPV0VEX0FUVFI6IFsnY2xhc3MnXSwgUkVUVVJOX1RSVVNURURfVFlQRTogdHJ1ZSB9KTtcblx0XHRcdFx0dGhpcy5fbWRsYWJlbEVsZW1lbnQuaW5uZXJIVE1MID0gc2FuaXRpemVkIGFzIHVua25vd24gYXMgc3RyaW5nO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzZXQodGhpcy5fbWRsYWJlbEVsZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodGhpcy5vcHRpb25zLnN1cHBvcnRJY29ucykge1xuXHRcdFx0XHRyZXNldCh0aGlzLl9tZGxhYmVsRWxlbWVudCwgLi4udGhpcy5nZXRDb250ZW50RWxlbWVudHModmFsdWUpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX21kbGFiZWxFbGVtZW50LnRleHRDb250ZW50ID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IHRpdGxlOiBzdHJpbmcgPSAnJztcblx0XHRpZiAodHlwZW9mIHRoaXMub3B0aW9ucy50aXRsZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRpdGxlID0gdGhpcy5vcHRpb25zLnRpdGxlO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5vcHRpb25zLnRpdGxlKSB7XG5cdFx0XHR0aXRsZSA9IHJlbmRlclN0cmluZ0FzUGxhaW50ZXh0KHZhbHVlKTtcblx0XHR9XG5cblx0XHR0aGlzLnNldFRpdGxlKHRpdGxlKTtcblx0XHR0aGlzLl9zZXRBcmlhTGFiZWwoKTtcblx0XHR0aGlzLl9sYWJlbCA9IHZhbHVlO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2V0IGljb24oaWNvbjogVGhlbWVJY29uKSB7XG5cdFx0dGhpcy5faWNvbkVsZW1lbnQuY2xhc3NMaXN0LnZhbHVlID0gJyc7XG5cdFx0dGhpcy5faWNvbkVsZW1lbnQuY2xhc3NMaXN0LmFkZCguLi5UaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShpY29uKSk7XG5cdFx0dGhpcy5fc2V0QXJpYUxhYmVsKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFNBQVMsdUJBQXVCLGFBQWEsV0FBMEIsaUJBQWlCLE9BQU8sWUFBWSxTQUFTO0FBQ3BILE9BQU8sZUFBZTtBQUN0QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdCQUFnQiwrQkFBK0I7QUFDeEQsU0FBUyxTQUFTLGFBQWEsc0JBQXNCO0FBQ3JELFNBQVMsNEJBQTRCLCtCQUErQjtBQUVwRSxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGNBQXNDO0FBQy9DLFNBQVMsZUFBZTtBQUN4QixTQUFTLGFBQWE7QUFDdEIsU0FBNkIsZUFBZTtBQUM1QyxTQUEwQixrQkFBa0IsMkJBQTJCO0FBQ3ZFLFNBQVMsZUFBZTtBQUN4QixTQUFTLFlBQVksdUJBQW9DO0FBQ3pELFNBQVMsaUJBQWlCO0FBQzFCLE9BQU87QUFDUCxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLGlDQUFpQztBQTBCbkMsTUFBTSx1QkFBc0M7QUFBQSxFQUNsRCxrQkFBa0I7QUFBQSxFQUNsQix1QkFBdUI7QUFBQSxFQUN2QixpQkFBaUIsTUFBTSxNQUFNLFNBQVM7QUFBQSxFQUN0QyxrQkFBa0IsTUFBTSxNQUFNLFNBQVM7QUFBQSxFQUN2QyxjQUFjO0FBQUEsRUFDZCwyQkFBMkI7QUFBQSxFQUMzQiwyQkFBMkI7QUFBQSxFQUMzQixnQ0FBZ0M7QUFDakM7QUFtQk8sTUFBTSxlQUFlLFdBQThCO0FBQUEsRUFpQnpELFlBQVksV0FBd0IsU0FBeUI7QUFDNUQsVUFBTTtBQWRQLFNBQVUsU0FBbUM7QUFLN0MsU0FBUSxj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
