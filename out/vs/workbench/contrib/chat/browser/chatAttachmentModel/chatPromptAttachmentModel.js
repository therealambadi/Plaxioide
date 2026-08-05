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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { FilePromptParser } from "../../common/promptSyntax/parsers/filePromptParser.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
let ChatPromptAttachmentModel = class extends Disposable {
  constructor(uri, initService) {
    super();
    this.initService = initService;
    /**
     * Event that fires when the error condition of the prompt
     * reference changes.
     *
     * See {@linkcode onUpdate}.
     */
    this._onUpdate = this._register(new Emitter());
    /**
     * Event that fires when the object is disposed.
     *
     * See {@linkcode onDispose}.
     */
    this._onDispose = this._register(new Emitter());
    this._onUpdate.fire = this._onUpdate.fire.bind(this._onUpdate);
    this._reference = this._register(this.initService.createInstance(FilePromptParser, uri, [])).onUpdate(this._onUpdate.fire);
  }
  /**
   * Get the prompt instructions reference instance.
   */
  get reference() {
    return this._reference;
  }
  /**
   * Get `URI` for the main reference and `URI`s of all valid child
   * references it may contain, including reference of this model itself.
   */
  get references() {
    const { reference } = this;
    const { errorCondition } = this.reference;
    if (errorCondition) {
      return [];
    }
    return [
      ...reference.allValidReferencesUris,
      reference.uri
    ];
  }
  /**
   * Promise that resolves when the prompt is fully parsed,
   * including all its possible nested child references.
   */
  get allSettled() {
    return this.reference.allSettled();
  }
  /**
   * Get the top-level error of the prompt instructions
   * reference, if any.
   */
  get topError() {
    return this.reference.topError;
  }
  /**
   * Subscribe to the `onUpdate` event.
   * @param callback Function to invoke on update.
   */
  onUpdate(callback) {
    this._register(this._onUpdate.event(callback));
    return this;
  }
  /**
   * Subscribe to the `onDispose` event.
   * @param callback Function to invoke on dispose.
   */
  onDispose(callback) {
    this._register(this._onDispose.event(callback));
    return this;
  }
  /**
   * Start resolving the prompt instructions reference and child references
   * that it may contain.
   */
  resolve() {
    this._reference.start();
    return this;
  }
  dispose() {
    this._onDispose.fire();
    super.dispose();
  }
};
ChatPromptAttachmentModel = __decorateClass([
  __decorateParam(1, IInstantiationService)
], ChatPromptAttachmentModel);
export {
  ChatPromptAttachmentModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEF0dGFjaG1lbnRNb2RlbC9jaGF0UHJvbXB0QXR0YWNobWVudE1vZGVsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEZpbGVQcm9tcHRQYXJzZXIgfSBmcm9tICcuLi8uLi9jb21tb24vcHJvbXB0U3ludGF4L3BhcnNlcnMvZmlsZVByb21wdFBhcnNlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcblxuLyoqXG4gKiBNb2RlbCBmb3IgYSBzaW5nbGUgY2hhdCBwcm9tcHQgaW5zdHJ1Y3Rpb25zIGF0dGFjaG1lbnQuXG4gKi9cbmV4cG9ydCBjbGFzcyBDaGF0UHJvbXB0QXR0YWNobWVudE1vZGVsIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdC8qKlxuXHQgKiBQcml2YXRlIHJlZmVyZW5jZSBvZiB0aGUgdW5kZXJseWluZyBwcm9tcHQgaW5zdHJ1Y3Rpb25zXG5cdCAqIHJlZmVyZW5jZSBpbnN0YW5jZS5cblx0ICovXG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlZmVyZW5jZTogRmlsZVByb21wdFBhcnNlcjtcblx0LyoqXG5cdCAqIEdldCB0aGUgcHJvbXB0IGluc3RydWN0aW9ucyByZWZlcmVuY2UgaW5zdGFuY2UuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IHJlZmVyZW5jZSgpOiBGaWxlUHJvbXB0UGFyc2VyIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVmZXJlbmNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldCBgVVJJYCBmb3IgdGhlIG1haW4gcmVmZXJlbmNlIGFuZCBgVVJJYHMgb2YgYWxsIHZhbGlkIGNoaWxkXG5cdCAqIHJlZmVyZW5jZXMgaXQgbWF5IGNvbnRhaW4sIGluY2x1ZGluZyByZWZlcmVuY2Ugb2YgdGhpcyBtb2RlbCBpdHNlbGYuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IHJlZmVyZW5jZXMoKTogcmVhZG9ubHkgVVJJW10ge1xuXHRcdGNvbnN0IHsgcmVmZXJlbmNlIH0gPSB0aGlzO1xuXHRcdGNvbnN0IHsgZXJyb3JDb25kaXRpb24gfSA9IHRoaXMucmVmZXJlbmNlO1xuXG5cdFx0Ly8gcmV0dXJuIG5vIHJlZmVyZW5jZXMgaWYgdGhlIGF0dGFjaG1lbnQgaXMgZGlzYWJsZWRcblx0XHQvLyBvciBpZiB0aGlzIG9iamVjdCBpdHNlbGYgaGFzIGFuIGVycm9yXG5cdFx0aWYgKGVycm9yQ29uZGl0aW9uKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Ly8gb3RoZXJ3aXNlIHJldHVybiBgVVJJYCBmb3IgdGhlIG1haW4gcmVmZXJlbmNlIGFuZFxuXHRcdC8vIGFsbCB2YWxpZCBjaGlsZCBgVVJJYCByZWZlcmVuY2VzIGl0IG1heSBjb250YWluXG5cdFx0cmV0dXJuIFtcblx0XHRcdC4uLnJlZmVyZW5jZS5hbGxWYWxpZFJlZmVyZW5jZXNVcmlzLFxuXHRcdFx0cmVmZXJlbmNlLnVyaSxcblx0XHRdO1xuXHR9XG5cblx0LyoqXG5cdCAqIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIHRoZSBwcm9tcHQgaXMgZnVsbHkgcGFyc2VkLFxuXHQgKiBpbmNsdWRpbmcgYWxsIGl0cyBwb3NzaWJsZSBuZXN0ZWQgY2hpbGQgcmVmZXJlbmNlcy5cblx0ICovXG5cdHB1YmxpYyBnZXQgYWxsU2V0dGxlZCgpOiBQcm9taXNlPEZpbGVQcm9tcHRQYXJzZXI+IHtcblx0XHRyZXR1cm4gdGhpcy5yZWZlcmVuY2UuYWxsU2V0dGxlZCgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldCB0aGUgdG9wLWxldmVsIGVycm9yIG9mIHRoZSBwcm9tcHQgaW5zdHJ1Y3Rpb25zXG5cdCAqIHJlZmVyZW5jZSwgaWYgYW55LlxuXHQgKi9cblx0cHVibGljIGdldCB0b3BFcnJvcigpIHtcblx0XHRyZXR1cm4gdGhpcy5yZWZlcmVuY2UudG9wRXJyb3I7XG5cdH1cblxuXHQvKipcblx0ICogRXZlbnQgdGhhdCBmaXJlcyB3aGVuIHRoZSBlcnJvciBjb25kaXRpb24gb2YgdGhlIHByb21wdFxuXHQgKiByZWZlcmVuY2UgY2hhbmdlcy5cblx0ICpcblx0ICogU2VlIHtAbGlua2NvZGUgb25VcGRhdGV9LlxuXHQgKi9cblx0cHJvdGVjdGVkIF9vblVwZGF0ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHQvKipcblx0ICogU3Vic2NyaWJlIHRvIHRoZSBgb25VcGRhdGVgIGV2ZW50LlxuXHQgKiBAcGFyYW0gY2FsbGJhY2sgRnVuY3Rpb24gdG8gaW52b2tlIG9uIHVwZGF0ZS5cblx0ICovXG5cdHB1YmxpYyBvblVwZGF0ZShjYWxsYmFjazogKCkgPT4gdW5rbm93bik6IHRoaXMge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX29uVXBkYXRlLmV2ZW50KGNhbGxiYWNrKSk7XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdC8qKlxuXHQgKiBFdmVudCB0aGF0IGZpcmVzIHdoZW4gdGhlIG9iamVjdCBpcyBkaXNwb3NlZC5cblx0ICpcblx0ICogU2VlIHtAbGlua2NvZGUgb25EaXNwb3NlfS5cblx0ICovXG5cdHByb3RlY3RlZCBfb25EaXNwb3NlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdC8qKlxuXHQgKiBTdWJzY3JpYmUgdG8gdGhlIGBvbkRpc3Bvc2VgIGV2ZW50LlxuXHQgKiBAcGFyYW0gY2FsbGJhY2sgRnVuY3Rpb24gdG8gaW52b2tlIG9uIGRpc3Bvc2UuXG5cdCAqL1xuXHRwdWJsaWMgb25EaXNwb3NlKGNhbGxiYWNrOiAoKSA9PiB1bmtub3duKTogdGhpcyB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fb25EaXNwb3NlLmV2ZW50KGNhbGxiYWNrKSk7XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHVyaTogVVJJLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbml0U2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fb25VcGRhdGUuZmlyZSA9IHRoaXMuX29uVXBkYXRlLmZpcmUuYmluZCh0aGlzLl9vblVwZGF0ZSk7XG5cdFx0dGhpcy5fcmVmZXJlbmNlID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbml0U2VydmljZS5jcmVhdGVJbnN0YW5jZShGaWxlUHJvbXB0UGFyc2VyLCB1cmksIFtdKSlcblx0XHRcdC5vblVwZGF0ZSh0aGlzLl9vblVwZGF0ZS5maXJlKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTdGFydCByZXNvbHZpbmcgdGhlIHByb21wdCBpbnN0cnVjdGlvbnMgcmVmZXJlbmNlIGFuZCBjaGlsZCByZWZlcmVuY2VzXG5cdCAqIHRoYXQgaXQgbWF5IGNvbnRhaW4uXG5cdCAqL1xuXHRwdWJsaWMgcmVzb2x2ZSgpOiB0aGlzIHtcblx0XHR0aGlzLl9yZWZlcmVuY2Uuc3RhcnQoKTtcblxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fb25EaXNwb3NlLmZpcmUoKTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyw2QkFBNkI7QUFLL0IsSUFBTSw0QkFBTixjQUF3QyxXQUFXO0FBQUEsRUFvRnpELFlBQ0MsS0FDd0MsYUFDdkM7QUFDRCxVQUFNO0FBRmtDO0FBN0J6QztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQUFVLFlBQVksS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBZ0J4RDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FBVSxhQUFhLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQWlCeEQsU0FBSyxVQUFVLE9BQU8sS0FBSyxVQUFVLEtBQUssS0FBSyxLQUFLLFNBQVM7QUFDN0QsU0FBSyxhQUFhLEtBQUssVUFBVSxLQUFLLFlBQVksZUFBZSxrQkFBa0IsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUN6RixTQUFTLEtBQUssVUFBVSxJQUFJO0FBQUEsRUFDL0I7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQXBGQSxJQUFXLFlBQThCO0FBQ3hDLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTUEsSUFBVyxhQUE2QjtBQUN2QyxVQUFNLEVBQUUsVUFBVSxJQUFJO0FBQ3RCLFVBQU0sRUFBRSxlQUFlLElBQUksS0FBSztBQUloQyxRQUFJLGdCQUFnQjtBQUNuQixhQUFPLENBQUM7QUFBQSxJQUNUO0FBSUEsV0FBTztBQUFBLE1BQ04sR0FBRyxVQUFVO0FBQUEsTUFDYixVQUFVO0FBQUEsSUFDWDtBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTUEsSUFBVyxhQUF3QztBQUNsRCxXQUFPLEtBQUssVUFBVSxXQUFXO0FBQUEsRUFDbEM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTUEsSUFBVyxXQUFXO0FBQ3JCLFdBQU8sS0FBSyxVQUFVO0FBQUEsRUFDdkI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBYU8sU0FBUyxVQUErQjtBQUM5QyxTQUFLLFVBQVUsS0FBSyxVQUFVLE1BQU0sUUFBUSxDQUFDO0FBRTdDLFdBQU87QUFBQSxFQUNSO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVlPLFVBQVUsVUFBK0I7QUFDL0MsU0FBSyxVQUFVLEtBQUssV0FBVyxNQUFNLFFBQVEsQ0FBQztBQUU5QyxXQUFPO0FBQUEsRUFDUjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFpQk8sVUFBZ0I7QUFDdEIsU0FBSyxXQUFXLE1BQU07QUFFdEIsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVnQixVQUFnQjtBQUMvQixTQUFLLFdBQVcsS0FBSztBQUVyQixVQUFNLFFBQVE7QUFBQSxFQUNmO0FBQ0Q7QUE5R2EsNEJBQU47QUFBQSxFQXNGSjtBQUFBLEdBdEZVOyIsCiAgIm5hbWVzIjogW10KfQo=
