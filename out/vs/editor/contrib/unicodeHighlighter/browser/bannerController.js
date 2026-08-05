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
import "./bannerController.css";
import { $, append, clearNode } from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { Action } from "../../../../base/common/actions.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { MarkdownRenderer } from "../../../browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Link } from "../../../../platform/opener/browser/link.js";
import { widgetClose } from "../../../../platform/theme/common/iconRegistry.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
const BANNER_ELEMENT_HEIGHT = 26;
let BannerController = class extends Disposable {
  constructor(_editor, instantiationService) {
    super();
    this._editor = _editor;
    this.instantiationService = instantiationService;
    this.banner = this._register(this.instantiationService.createInstance(Banner));
  }
  hide() {
    this._editor.setBanner(null, 0);
    this.banner.clear();
  }
  show(item) {
    this.banner.show({
      ...item,
      onClose: () => {
        this.hide();
        item.onClose?.();
      }
    });
    this._editor.setBanner(this.banner.element, BANNER_ELEMENT_HEIGHT);
  }
};
BannerController = __decorateClass([
  __decorateParam(1, IInstantiationService)
], BannerController);
let Banner = class extends Disposable {
  constructor(instantiationService) {
    super();
    this.instantiationService = instantiationService;
    this.markdownRenderer = this.instantiationService.createInstance(MarkdownRenderer, {});
    this.element = $("div.editor-banner");
    this.element.tabIndex = 0;
  }
  getAriaLabel(item) {
    if (item.ariaLabel) {
      return item.ariaLabel;
    }
    if (typeof item.message === "string") {
      return item.message;
    }
    return void 0;
  }
  getBannerMessage(message) {
    if (typeof message === "string") {
      const element = $("span");
      element.innerText = message;
      return element;
    }
    return this.markdownRenderer.render(message).element;
  }
  clear() {
    clearNode(this.element);
  }
  show(item) {
    clearNode(this.element);
    const ariaLabel = this.getAriaLabel(item);
    if (ariaLabel) {
      this.element.setAttribute("aria-label", ariaLabel);
    }
    const iconContainer = append(this.element, $("div.icon-container"));
    iconContainer.setAttribute("aria-hidden", "true");
    if (item.icon) {
      iconContainer.appendChild($(`div${ThemeIcon.asCSSSelector(item.icon)}`));
    }
    const messageContainer = append(this.element, $("div.message-container"));
    messageContainer.setAttribute("aria-hidden", "true");
    messageContainer.appendChild(this.getBannerMessage(item.message));
    this.messageActionsContainer = append(this.element, $("div.message-actions-container"));
    if (item.actions) {
      for (const action of item.actions) {
        this._register(this.instantiationService.createInstance(Link, this.messageActionsContainer, { ...action, tabIndex: -1 }, {}));
      }
    }
    const actionBarContainer = append(this.element, $("div.action-container"));
    this.actionBar = this._register(new ActionBar(actionBarContainer));
    this.actionBar.push(this._register(
      new Action(
        "banner.close",
        "Close Banner",
        ThemeIcon.asClassName(widgetClose),
        true,
        () => {
          if (typeof item.onClose === "function") {
            item.onClose();
          }
        }
      )
    ), { icon: true, label: false });
    this.actionBar.setFocusable(false);
  }
};
Banner = __decorateClass([
  __decorateParam(0, IInstantiationService)
], Banner);
export {
  BannerController
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi91bmljb2RlSGlnaGxpZ2h0ZXIvYnJvd3Nlci9iYW5uZXJDb250cm9sbGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCAnLi9iYW5uZXJDb250cm9sbGVyLmNzcyc7XG5pbXBvcnQgeyAkLCBhcHBlbmQsIGNsZWFyTm9kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvd2lkZ2V0L21hcmtkb3duUmVuZGVyZXIvYnJvd3Nlci9tYXJrZG93blJlbmRlcmVyLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxpbmtEZXNjcmlwdG9yLCBMaW5rIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2Jyb3dzZXIvbGluay5qcyc7XG5pbXBvcnQgeyB3aWRnZXRDbG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcblxuY29uc3QgQkFOTkVSX0VMRU1FTlRfSEVJR0hUID0gMjY7XG5cbmV4cG9ydCBjbGFzcyBCYW5uZXJDb250cm9sbGVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgYmFubmVyOiBCYW5uZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuYmFubmVyID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShCYW5uZXIpKTtcblx0fVxuXG5cdHB1YmxpYyBoaWRlKCkge1xuXHRcdHRoaXMuX2VkaXRvci5zZXRCYW5uZXIobnVsbCwgMCk7XG5cdFx0dGhpcy5iYW5uZXIuY2xlYXIoKTtcblx0fVxuXG5cdHB1YmxpYyBzaG93KGl0ZW06IElCYW5uZXJJdGVtKSB7XG5cdFx0dGhpcy5iYW5uZXIuc2hvdyh7XG5cdFx0XHQuLi5pdGVtLFxuXHRcdFx0b25DbG9zZTogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmhpZGUoKTtcblx0XHRcdFx0aXRlbS5vbkNsb3NlPy4oKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLl9lZGl0b3Iuc2V0QmFubmVyKHRoaXMuYmFubmVyLmVsZW1lbnQsIEJBTk5FUl9FTEVNRU5UX0hFSUdIVCk7XG5cdH1cbn1cblxuLy8gVE9ET0BoZWRpZXQ6IEludmVzdGlnYXRlIGlmIHRoaXMgY2FuIGJlIHJldXNlZCBieSB0aGUgd29ya3NwYWNlIGJhbm5lciAoYmFubmVyUGFydC50cykuXG5jbGFzcyBCYW5uZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHVibGljIGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbWFya2Rvd25SZW5kZXJlcjogTWFya2Rvd25SZW5kZXJlcjtcblxuXHRwcml2YXRlIG1lc3NhZ2VBY3Rpb25zQ29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIGFjdGlvbkJhcjogQWN0aW9uQmFyIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5tYXJrZG93blJlbmRlcmVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYXJrZG93blJlbmRlcmVyLCB7fSk7XG5cblx0XHR0aGlzLmVsZW1lbnQgPSAkKCdkaXYuZWRpdG9yLWJhbm5lcicpO1xuXHRcdHRoaXMuZWxlbWVudC50YWJJbmRleCA9IDA7XG5cdH1cblxuXHRwcml2YXRlIGdldEFyaWFMYWJlbChpdGVtOiBJQmFubmVySXRlbSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGl0ZW0uYXJpYUxhYmVsKSB7XG5cdFx0XHRyZXR1cm4gaXRlbS5hcmlhTGFiZWw7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgaXRlbS5tZXNzYWdlID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIGl0ZW0ubWVzc2FnZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRCYW5uZXJNZXNzYWdlKG1lc3NhZ2U6IE1hcmtkb3duU3RyaW5nIHwgc3RyaW5nKTogSFRNTEVsZW1lbnQge1xuXHRcdGlmICh0eXBlb2YgbWVzc2FnZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdGNvbnN0IGVsZW1lbnQgPSAkKCdzcGFuJyk7XG5cdFx0XHRlbGVtZW50LmlubmVyVGV4dCA9IG1lc3NhZ2U7XG5cdFx0XHRyZXR1cm4gZWxlbWVudDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5tYXJrZG93blJlbmRlcmVyLnJlbmRlcihtZXNzYWdlKS5lbGVtZW50O1xuXHR9XG5cblx0cHVibGljIGNsZWFyKCkge1xuXHRcdGNsZWFyTm9kZSh0aGlzLmVsZW1lbnQpO1xuXHR9XG5cblx0cHVibGljIHNob3coaXRlbTogSUJhbm5lckl0ZW0pIHtcblx0XHQvLyBDbGVhciBwcmV2aW91cyBpdGVtXG5cdFx0Y2xlYXJOb2RlKHRoaXMuZWxlbWVudCk7XG5cblx0XHQvLyBCYW5uZXIgYXJpYSBsYWJlbFxuXHRcdGNvbnN0IGFyaWFMYWJlbCA9IHRoaXMuZ2V0QXJpYUxhYmVsKGl0ZW0pO1xuXHRcdGlmIChhcmlhTGFiZWwpIHtcblx0XHRcdHRoaXMuZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBhcmlhTGFiZWwpO1xuXHRcdH1cblxuXHRcdC8vIEljb25cblx0XHRjb25zdCBpY29uQ29udGFpbmVyID0gYXBwZW5kKHRoaXMuZWxlbWVudCwgJCgnZGl2Lmljb24tY29udGFpbmVyJykpO1xuXHRcdGljb25Db250YWluZXIuc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XG5cblx0XHRpZiAoaXRlbS5pY29uKSB7XG5cdFx0XHRpY29uQ29udGFpbmVyLmFwcGVuZENoaWxkKCQoYGRpdiR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoaXRlbS5pY29uKX1gKSk7XG5cdFx0fVxuXG5cdFx0Ly8gTWVzc2FnZVxuXHRcdGNvbnN0IG1lc3NhZ2VDb250YWluZXIgPSBhcHBlbmQodGhpcy5lbGVtZW50LCAkKCdkaXYubWVzc2FnZS1jb250YWluZXInKSk7XG5cdFx0bWVzc2FnZUNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ3RydWUnKTtcblx0XHRtZXNzYWdlQ29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuZ2V0QmFubmVyTWVzc2FnZShpdGVtLm1lc3NhZ2UpKTtcblxuXHRcdC8vIE1lc3NhZ2UgQWN0aW9uc1xuXHRcdHRoaXMubWVzc2FnZUFjdGlvbnNDb250YWluZXIgPSBhcHBlbmQodGhpcy5lbGVtZW50LCAkKCdkaXYubWVzc2FnZS1hY3Rpb25zLWNvbnRhaW5lcicpKTtcblx0XHRpZiAoaXRlbS5hY3Rpb25zKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGFjdGlvbiBvZiBpdGVtLmFjdGlvbnMpIHtcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShMaW5rLCB0aGlzLm1lc3NhZ2VBY3Rpb25zQ29udGFpbmVyLCB7IC4uLmFjdGlvbiwgdGFiSW5kZXg6IC0xIH0sIHt9KSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQWN0aW9uXG5cdFx0Y29uc3QgYWN0aW9uQmFyQ29udGFpbmVyID0gYXBwZW5kKHRoaXMuZWxlbWVudCwgJCgnZGl2LmFjdGlvbi1jb250YWluZXInKSk7XG5cdFx0dGhpcy5hY3Rpb25CYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgQWN0aW9uQmFyKGFjdGlvbkJhckNvbnRhaW5lcikpO1xuXHRcdHRoaXMuYWN0aW9uQmFyLnB1c2godGhpcy5fcmVnaXN0ZXIoXG5cdFx0XHRuZXcgQWN0aW9uKFxuXHRcdFx0XHQnYmFubmVyLmNsb3NlJyxcblx0XHRcdFx0J0Nsb3NlIEJhbm5lcicsXG5cdFx0XHRcdFRoZW1lSWNvbi5hc0NsYXNzTmFtZSh3aWRnZXRDbG9zZSksXG5cdFx0XHRcdHRydWUsXG5cdFx0XHRcdCgpID0+IHtcblx0XHRcdFx0XHRpZiAodHlwZW9mIGl0ZW0ub25DbG9zZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRcdFx0aXRlbS5vbkNsb3NlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHQpXG5cdFx0KSwgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UgfSk7XG5cdFx0dGhpcy5hY3Rpb25CYXIuc2V0Rm9jdXNhYmxlKGZhbHNlKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElCYW5uZXJJdGVtIHtcblx0cmVhZG9ubHkgaWQ6IHN0cmluZztcblx0cmVhZG9ubHkgaWNvbjogVGhlbWVJY29uIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBtZXNzYWdlOiBzdHJpbmcgfCBNYXJrZG93blN0cmluZztcblx0cmVhZG9ubHkgYWN0aW9ucz86IElMaW5rRGVzY3JpcHRvcltdO1xuXHRyZWFkb25seSBhcmlhTGFiZWw/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IG9uQ2xvc2U/OiAoKSA9PiB2b2lkO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFJQSxPQUFPO0FBQ1AsU0FBUyxHQUFHLFFBQVEsaUJBQWlCO0FBQ3JDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsY0FBYztBQUV2QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHdC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
