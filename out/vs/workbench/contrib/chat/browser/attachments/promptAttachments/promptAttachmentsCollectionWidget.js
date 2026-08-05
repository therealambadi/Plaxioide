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
import { Emitter } from "../../../../../../base/common/event.js";
import { PromptAttachmentWidget } from "./promptAttachmentWidget.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
let PromptAttachmentsCollectionWidget = class extends Disposable {
  constructor(model, resourceLabels, initService, logService) {
    super();
    this.model = model;
    this.resourceLabels = resourceLabels;
    this.initService = initService;
    this.logService = logService;
    /**
     * List of child instruction attachment widgets.
     */
    this.children = [];
    /**
     * Event that fires when number of attachments change
     *
     * See {@linkcode onAttachmentsCountChange}.
     */
    this._onAttachmentsCountChange = this._register(new Emitter());
    this.render = this.render.bind(this);
    this.model.onAdd((attachment) => {
      const widget = this.initService.createInstance(
        PromptAttachmentWidget,
        attachment,
        this.resourceLabels
      );
      widget.onDispose(this.handleAttachmentDispose.bind(this, widget));
      this.children.push(widget);
      if (this.parentNode) {
        this.parentNode.appendChild(widget.domNode);
      }
      this._onAttachmentsCountChange.fire();
    });
  }
  /**
   * Subscribe to the `onAttachmentsCountChange` event.
   * @param callback Function to invoke when number of attachments change.
   */
  onAttachmentsCountChange(callback) {
    this._register(this._onAttachmentsCountChange.event(callback));
    return this;
  }
  /**
   * Get all `URI`s of all valid references, including all
   * the possible references nested inside the children.
   */
  get references() {
    return this.model.references;
  }
  /**
   * Get the list of all prompt instruction attachment variables, including all
   * nested child references of each attachment explicitly attached by user.
   */
  get chatAttachments() {
    return this.model.chatAttachments;
  }
  /**
   * Check if child widget list is empty (no attachments present).
   */
  get empty() {
    return this.children.length === 0;
  }
  /**
   * Handle child widget disposal.
   * @param widget The child widget that was disposed.
   */
  handleAttachmentDispose(widget) {
    const logPrefix = `[onChildDispose] Widget for instructions attachment '${widget.uri.path}'`;
    let widgetExists = false;
    this.children = this.children.filter((child) => {
      if (child === widget) {
        if (widgetExists) {
          this.logService.warn(
            `${logPrefix} is present in the children references list multiple times.`
          );
        }
        widgetExists = true;
        return false;
      }
      return true;
    });
    if (!widgetExists) {
      this.logService.warn(
        `${logPrefix} was disposed, but was not found in the child references.`
      );
    }
    if (!this.parentNode) {
      this.logService.warn(
        `${logPrefix} no parent node reference found.`
      );
    }
    this.parentNode?.removeChild(widget.domNode);
    this._onAttachmentsCountChange.fire();
    return this;
  }
  /**
   * Render attachments into the provided `parentNode`.
   *
   * Note! this method assumes that the provided `parentNode` is cleared by the caller.
   */
  render(parentNode) {
    this.parentNode = parentNode;
    for (const widget of this.children) {
      this.parentNode.appendChild(widget.domNode);
    }
    return this;
  }
  /**
   * Dispose of the widget, including all the child
   * widget instances.
   */
  dispose() {
    for (const child of this.children) {
      child.dispose();
    }
    super.dispose();
  }
};
PromptAttachmentsCollectionWidget = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ILogService)
], PromptAttachmentsCollectionWidget);
export {
  PromptAttachmentsCollectionWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYXR0YWNobWVudHMvcHJvbXB0QXR0YWNobWVudHMvcHJvbXB0QXR0YWNobWVudHNDb2xsZWN0aW9uV2lkZ2V0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZUxhYmVscyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jyb3dzZXIvbGFiZWxzLmpzJztcbmltcG9ydCB7IFByb21wdEF0dGFjaG1lbnRXaWRnZXQgfSBmcm9tICcuL3Byb21wdEF0dGFjaG1lbnRXaWRnZXQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgQ2hhdFByb21wdEF0dGFjaG1lbnRzQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uL2NoYXRBdHRhY2htZW50TW9kZWwvY2hhdFByb21wdEF0dGFjaG1lbnRzQ29sbGVjdGlvbi5qcyc7XG5cbi8qKlxuICogV2lkZ2V0IGZvciBhIGNvbGxlY3Rpb24gb2YgcHJvbXB0IGluc3RydWN0aW9ucyBhdHRhY2htZW50cy5cbiAqIFNlZSB7QGxpbmtjb2RlIFByb21wdEF0dGFjaG1lbnRXaWRnZXR9LlxuICovXG5leHBvcnQgY2xhc3MgUHJvbXB0QXR0YWNobWVudHNDb2xsZWN0aW9uV2lkZ2V0IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdC8qKlxuXHQgKiBMaXN0IG9mIGNoaWxkIGluc3RydWN0aW9uIGF0dGFjaG1lbnQgd2lkZ2V0cy5cblx0ICovXG5cdHByaXZhdGUgY2hpbGRyZW46IFByb21wdEF0dGFjaG1lbnRXaWRnZXRbXSA9IFtdO1xuXG5cdC8qKlxuXHQgKiBFdmVudCB0aGF0IGZpcmVzIHdoZW4gbnVtYmVyIG9mIGF0dGFjaG1lbnRzIGNoYW5nZVxuXHQgKlxuXHQgKiBTZWUge0BsaW5rY29kZSBvbkF0dGFjaG1lbnRzQ291bnRDaGFuZ2V9LlxuXHQgKi9cblx0cHJpdmF0ZSBfb25BdHRhY2htZW50c0NvdW50Q2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdC8qKlxuXHQgKiBTdWJzY3JpYmUgdG8gdGhlIGBvbkF0dGFjaG1lbnRzQ291bnRDaGFuZ2VgIGV2ZW50LlxuXHQgKiBAcGFyYW0gY2FsbGJhY2sgRnVuY3Rpb24gdG8gaW52b2tlIHdoZW4gbnVtYmVyIG9mIGF0dGFjaG1lbnRzIGNoYW5nZS5cblx0ICovXG5cdHB1YmxpYyBvbkF0dGFjaG1lbnRzQ291bnRDaGFuZ2UoY2FsbGJhY2s6ICgpID0+IHVua25vd24pOiB0aGlzIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9vbkF0dGFjaG1lbnRzQ291bnRDaGFuZ2UuZXZlbnQoY2FsbGJhY2spKTtcblxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBwYXJlbnQgRE9NIG5vZGUgdGhpcyB3aWRnZXQgd2FzIHJlbmRlcmVkIGludG8uXG5cdCAqL1xuXHRwcml2YXRlIHBhcmVudE5vZGU6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBHZXQgYWxsIGBVUklgcyBvZiBhbGwgdmFsaWQgcmVmZXJlbmNlcywgaW5jbHVkaW5nIGFsbFxuXHQgKiB0aGUgcG9zc2libGUgcmVmZXJlbmNlcyBuZXN0ZWQgaW5zaWRlIHRoZSBjaGlsZHJlbi5cblx0ICovXG5cdHB1YmxpYyBnZXQgcmVmZXJlbmNlcygpOiByZWFkb25seSBVUklbXSB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwucmVmZXJlbmNlcztcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgdGhlIGxpc3Qgb2YgYWxsIHByb21wdCBpbnN0cnVjdGlvbiBhdHRhY2htZW50IHZhcmlhYmxlcywgaW5jbHVkaW5nIGFsbFxuXHQgKiBuZXN0ZWQgY2hpbGQgcmVmZXJlbmNlcyBvZiBlYWNoIGF0dGFjaG1lbnQgZXhwbGljaXRseSBhdHRhY2hlZCBieSB1c2VyLlxuXHQgKi9cblx0cHVibGljIGdldCBjaGF0QXR0YWNobWVudHMoKSB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuY2hhdEF0dGFjaG1lbnRzO1xuXHR9XG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIGNoaWxkIHdpZGdldCBsaXN0IGlzIGVtcHR5IChubyBhdHRhY2htZW50cyBwcmVzZW50KS5cblx0ICovXG5cdHB1YmxpYyBnZXQgZW1wdHkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuY2hpbGRyZW4ubGVuZ3RoID09PSAwO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBtb2RlbDogQ2hhdFByb21wdEF0dGFjaG1lbnRzQ29sbGVjdGlvbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IHJlc291cmNlTGFiZWxzOiBSZXNvdXJjZUxhYmVscyxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5pdFNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMucmVuZGVyID0gdGhpcy5yZW5kZXIuYmluZCh0aGlzKTtcblxuXHRcdC8vIHdoZW4gYSBuZXcgYXR0YWNobWVudCBtb2RlbCBpcyBhZGRlZCwgY3JlYXRlIGEgbmV3IGNoaWxkIHdpZGdldCBmb3IgaXRcblx0XHR0aGlzLm1vZGVsLm9uQWRkKChhdHRhY2htZW50KSA9PiB7XG5cdFx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLmluaXRTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRQcm9tcHRBdHRhY2htZW50V2lkZ2V0LFxuXHRcdFx0XHRhdHRhY2htZW50LFxuXHRcdFx0XHR0aGlzLnJlc291cmNlTGFiZWxzLFxuXHRcdFx0KTtcblxuXHRcdFx0Ly8gaGFuZGxlIHRoZSBjaGlsZCB3aWRnZXQgZGlzcG9zYWwgZXZlbnQsIHJlbW92aW5nIGl0IGZyb20gdGhlIGxpc3Rcblx0XHRcdHdpZGdldC5vbkRpc3Bvc2UodGhpcy5oYW5kbGVBdHRhY2htZW50RGlzcG9zZS5iaW5kKHRoaXMsIHdpZGdldCkpO1xuXG5cdFx0XHQvLyByZWdpc3RlciB0aGUgbmV3IGNoaWxkIHdpZGdldFxuXHRcdFx0dGhpcy5jaGlsZHJlbi5wdXNoKHdpZGdldCk7XG5cblx0XHRcdC8vIGlmIHBhcmVudCBub2RlIGlzIHByZXNlbnQgLSBhcHBlbmQgdGhlIHdpZ2V0IHRvIGl0LCBvdGhlcndpc2Ugd2FpdFxuXHRcdFx0Ly8gdW50aWwgdGhlIGByZW5kZXJgIG1ldGhvZCB3aWxsIGJlIGNhbGxlZFxuXHRcdFx0aWYgKHRoaXMucGFyZW50Tm9kZSkge1xuXHRcdFx0XHR0aGlzLnBhcmVudE5vZGUuYXBwZW5kQ2hpbGQod2lkZ2V0LmRvbU5vZGUpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBmaXJlIHRoZSBldmVudCB0byBub3RpZnkgYWJvdXQgdGhlIGNoYW5nZSBpbiB0aGUgbnVtYmVyIG9mIGF0dGFjaG1lbnRzXG5cdFx0XHR0aGlzLl9vbkF0dGFjaG1lbnRzQ291bnRDaGFuZ2UuZmlyZSgpO1xuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEhhbmRsZSBjaGlsZCB3aWRnZXQgZGlzcG9zYWwuXG5cdCAqIEBwYXJhbSB3aWRnZXQgVGhlIGNoaWxkIHdpZGdldCB0aGF0IHdhcyBkaXNwb3NlZC5cblx0ICovXG5cdHB1YmxpYyBoYW5kbGVBdHRhY2htZW50RGlzcG9zZSh3aWRnZXQ6IFByb21wdEF0dGFjaG1lbnRXaWRnZXQpOiB0aGlzIHtcblx0XHQvLyBjb21tb24gcHJlZml4IGZvciBhbGwgbG9nIG1lc3NhZ2VzXG5cdFx0Y29uc3QgbG9nUHJlZml4ID0gYFtvbkNoaWxkRGlzcG9zZV0gV2lkZ2V0IGZvciBpbnN0cnVjdGlvbnMgYXR0YWNobWVudCAnJHt3aWRnZXQudXJpLnBhdGh9J2A7XG5cblx0XHQvLyBmbGFnIHRvIGNoZWNrIGlmIHRoZSB3aWRnZXQgd2FzIGZvdW5kIGluIHRoZSBjaGlsZHJlbiBsaXN0XG5cdFx0bGV0IHdpZGdldEV4aXN0cyA9IGZhbHNlO1xuXG5cdFx0Ly8gZmlsdGVyIG91dCBkaXNwb3NlZCBjaGlsZCB3aWRnZXQgZnJvbSB0aGUgbGlzdFxuXHRcdHRoaXMuY2hpbGRyZW4gPSB0aGlzLmNoaWxkcmVuLmZpbHRlcigoY2hpbGQpID0+IHtcblx0XHRcdGlmIChjaGlsZCA9PT0gd2lkZ2V0KSB7XG5cdFx0XHRcdC8vIGJlY2F1c2Ugd2UgZmlsdGVyIG91dCBhbGwgb2JqZWN0cyBoZXJlIGl0IG1pZ2h0IGJlIG9rIHRvIGhhdmUgbXVsdGlwbGUgb2YgdGhlbSwgYnV0XG5cdFx0XHRcdC8vIGl0IGFsc28gaGlnaGxpZ2h0cyBhIHBvdGVudGlhbCBpc3N1ZSBpbiBvdXIgbG9naWMgc29tZXdoZXJlIGVsc2UsIHNvIHRyYWNlIGEgd2FybmluZyBoZXJlXG5cdFx0XHRcdGlmICh3aWRnZXRFeGlzdHMpIHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2Fybihcblx0XHRcdFx0XHRcdGAke2xvZ1ByZWZpeH0gaXMgcHJlc2VudCBpbiB0aGUgY2hpbGRyZW4gcmVmZXJlbmNlcyBsaXN0IG11bHRpcGxlIHRpbWVzLmAsXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHdpZGdldEV4aXN0cyA9IHRydWU7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSk7XG5cblx0XHQvLyBubyB3aWRnZXQgd2FzIGZvdW5kIGluIHRoZSBjaGlsZHJlbiBsaXN0LCB3aGlsZSBpdCBtaWdodCBiZSBvayBpdCBhbHNvXG5cdFx0Ly8gaGlnaGxpZ2h0cyBhIHBvdGVudGlhbCBpc3N1ZSBpbiBvdXIgbG9naWMsIHNvIHRyYWNlIGEgd2FybmluZyBoZXJlXG5cdFx0aWYgKCF3aWRnZXRFeGlzdHMpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKFxuXHRcdFx0XHRgJHtsb2dQcmVmaXh9IHdhcyBkaXNwb3NlZCwgYnV0IHdhcyBub3QgZm91bmQgaW4gdGhlIGNoaWxkIHJlZmVyZW5jZXMuYCxcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLnBhcmVudE5vZGUpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKFxuXHRcdFx0XHRgJHtsb2dQcmVmaXh9IG5vIHBhcmVudCBub2RlIHJlZmVyZW5jZSBmb3VuZC5gLFxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHQvLyByZW1vdmUgdGhlIGNoaWxkIHdpZGdldCByb290IG5vZGUgZnJvbSB0aGUgRE9NXG5cdFx0dGhpcy5wYXJlbnROb2RlPy5yZW1vdmVDaGlsZCh3aWRnZXQuZG9tTm9kZSk7XG5cblx0XHQvLyBmaXJlIHRoZSBldmVudCB0byBub3RpZnkgYWJvdXQgdGhlIGNoYW5nZSBpbiB0aGUgbnVtYmVyIG9mIGF0dGFjaG1lbnRzXG5cdFx0dGhpcy5fb25BdHRhY2htZW50c0NvdW50Q2hhbmdlLmZpcmUoKTtcblxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciBhdHRhY2htZW50cyBpbnRvIHRoZSBwcm92aWRlZCBgcGFyZW50Tm9kZWAuXG5cdCAqXG5cdCAqIE5vdGUhIHRoaXMgbWV0aG9kIGFzc3VtZXMgdGhhdCB0aGUgcHJvdmlkZWQgYHBhcmVudE5vZGVgIGlzIGNsZWFyZWQgYnkgdGhlIGNhbGxlci5cblx0ICovXG5cdHB1YmxpYyByZW5kZXIoXG5cdFx0cGFyZW50Tm9kZTogSFRNTEVsZW1lbnQsXG5cdCk6IHRoaXMge1xuXHRcdHRoaXMucGFyZW50Tm9kZSA9IHBhcmVudE5vZGU7XG5cblx0XHRmb3IgKGNvbnN0IHdpZGdldCBvZiB0aGlzLmNoaWxkcmVuKSB7XG5cdFx0XHR0aGlzLnBhcmVudE5vZGUuYXBwZW5kQ2hpbGQod2lkZ2V0LmRvbU5vZGUpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0LyoqXG5cdCAqIERpc3Bvc2Ugb2YgdGhlIHdpZGdldCwgaW5jbHVkaW5nIGFsbCB0aGUgY2hpbGRcblx0ICogd2lkZ2V0IGluc3RhbmNlcy5cblx0ICovXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgY2hpbGQgb2YgdGhpcy5jaGlsZHJlbikge1xuXHRcdFx0Y2hpbGQuZGlzcG9zZSgpO1xuXHRc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
