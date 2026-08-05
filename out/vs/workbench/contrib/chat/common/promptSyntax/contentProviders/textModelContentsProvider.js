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
import { VSBuffer } from "../../../../../../base/common/buffer.js";
import { CancellationError } from "../../../../../../base/common/errors.js";
import { FilePromptContentProvider } from "./filePromptContentsProvider.js";
import { PromptContentsProviderBase } from "./promptContentsProviderBase.js";
import { newWriteableStream } from "../../../../../../base/common/stream.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { TextModel } from "../../../../../../editor/common/model/textModel.js";
let TextModelContentsProvider = class extends PromptContentsProviderBase {
  constructor(model, initService) {
    super();
    this.model = model;
    this.initService = initService;
    /**
     * URI component of the prompt associated with this contents provider.
     */
    this.uri = this.model.uri;
    this._register(this.model.onWillDispose(this.dispose.bind(this)));
    this._register(this.model.onDidChangeContent(this.onChangeEmitter.fire));
  }
  /**
   * Creates a stream of binary data from the text model based on the changes
   * listed in the provided event.
   *
   * Note! this method implements a basic logic which does not take into account
   * 		 the `_event` argument for incremental updates. This needs to be improved.
   *
   * @param _event - event that describes the changes in the text model; `'full'` is
   * 				   the special value that means that all contents have changed
   * @param cancellationToken - token that cancels this operation
   */
  async getContentsStream(_event, cancellationToken) {
    const stream = newWriteableStream(null);
    const linesCount = this.model.getLineCount();
    let i = 1;
    const interval = setInterval(() => {
      if (i >= linesCount) {
        clearInterval(interval);
        stream.end();
        stream.destroy();
      }
      if (this.model.isDisposed() || cancellationToken?.isCancellationRequested) {
        clearInterval(interval);
        stream.error(new CancellationError());
        stream.destroy();
        return;
      }
      try {
        stream.write(
          VSBuffer.fromString(this.model.getLineContent(i))
        );
        if (i !== linesCount) {
          stream.write(
            VSBuffer.fromString(this.model.getEOL())
          );
        }
      } catch (error) {
        console.log(this.uri, i, error);
      }
      i++;
    }, 1);
    return stream;
  }
  createNew(promptContentsSource) {
    if (promptContentsSource instanceof TextModel) {
      return this.initService.createInstance(
        TextModelContentsProvider,
        promptContentsSource
      );
    }
    return this.initService.createInstance(
      FilePromptContentProvider,
      promptContentsSource.uri
    );
  }
  /**
   * String representation of this object.
   */
  toString() {
    return `text-model-prompt-contents-provider:${this.uri.path}`;
  }
};
TextModelContentsProvider = __decorateClass([
  __decorateParam(1, IInstantiationService)
], TextModelContentsProvider);
export {
  TextModelContentsProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvY29udGVudFByb3ZpZGVycy90ZXh0TW9kZWxDb250ZW50c1Byb3ZpZGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSVByb21wdENvbnRlbnRzUHJvdmlkZXIgfSBmcm9tICcuL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBGaWxlUHJvbXB0Q29udGVudFByb3ZpZGVyIH0gZnJvbSAnLi9maWxlUHJvbXB0Q29udGVudHNQcm92aWRlci5qcyc7XG5pbXBvcnQgeyBQcm9tcHRDb250ZW50c1Byb3ZpZGVyQmFzZSB9IGZyb20gJy4vcHJvbXB0Q29udGVudHNQcm92aWRlckJhc2UuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgbmV3V3JpdGVhYmxlU3RyZWFtLCBSZWFkYWJsZVN0cmVhbSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmVhbS5qcyc7XG5pbXBvcnQgeyBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi90ZXh0TW9kZWxFdmVudHMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5cbi8qKlxuICogUHJvbXB0IGNvbnRlbnRzIHByb3ZpZGVyIGZvciBhIHtAbGluayBJVGV4dE1vZGVsfSBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFRleHRNb2RlbENvbnRlbnRzUHJvdmlkZXIgZXh0ZW5kcyBQcm9tcHRDb250ZW50c1Byb3ZpZGVyQmFzZTxJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50PiB7XG5cdC8qKlxuXHQgKiBVUkkgY29tcG9uZW50IG9mIHRoZSBwcm9tcHQgYXNzb2NpYXRlZCB3aXRoIHRoaXMgY29udGVudHMgcHJvdmlkZXIuXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgdXJpID0gdGhpcy5tb2RlbC51cmk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBtb2RlbDogSVRleHRNb2RlbCxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5pdFNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubW9kZWwub25XaWxsRGlzcG9zZSh0aGlzLmRpc3Bvc2UuYmluZCh0aGlzKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubW9kZWwub25EaWRDaGFuZ2VDb250ZW50KHRoaXMub25DaGFuZ2VFbWl0dGVyLmZpcmUpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgc3RyZWFtIG9mIGJpbmFyeSBkYXRhIGZyb20gdGhlIHRleHQgbW9kZWwgYmFzZWQgb24gdGhlIGNoYW5nZXNcblx0ICogbGlzdGVkIGluIHRoZSBwcm92aWRlZCBldmVudC5cblx0ICpcblx0ICogTm90ZSEgdGhpcyBtZXRob2QgaW1wbGVtZW50cyBhIGJhc2ljIGxvZ2ljIHdoaWNoIGRvZXMgbm90IHRha2UgaW50byBhY2NvdW50XG5cdCAqIFx0XHQgdGhlIGBfZXZlbnRgIGFyZ3VtZW50IGZvciBpbmNyZW1lbnRhbCB1cGRhdGVzLiBUaGlzIG5lZWRzIHRvIGJlIGltcHJvdmVkLlxuXHQgKlxuXHQgKiBAcGFyYW0gX2V2ZW50IC0gZXZlbnQgdGhhdCBkZXNjcmliZXMgdGhlIGNoYW5nZXMgaW4gdGhlIHRleHQgbW9kZWw7IGAnZnVsbCdgIGlzXG5cdCAqIFx0XHRcdFx0ICAgdGhlIHNwZWNpYWwgdmFsdWUgdGhhdCBtZWFucyB0aGF0IGFsbCBjb250ZW50cyBoYXZlIGNoYW5nZWRcblx0ICogQHBhcmFtIGNhbmNlbGxhdGlvblRva2VuIC0gdG9rZW4gdGhhdCBjYW5jZWxzIHRoaXMgb3BlcmF0aW9uXG5cdCAqL1xuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgZ2V0Q29udGVudHNTdHJlYW0oXG5cdFx0X2V2ZW50OiBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50IHwgJ2Z1bGwnLFxuXHRcdGNhbmNlbGxhdGlvblRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4sXG5cdCk6IFByb21pc2U8UmVhZGFibGVTdHJlYW08VlNCdWZmZXI+PiB7XG5cdFx0Y29uc3Qgc3RyZWFtID0gbmV3V3JpdGVhYmxlU3RyZWFtPFZTQnVmZmVyPihudWxsKTtcblx0XHRjb25zdCBsaW5lc0NvdW50ID0gdGhpcy5tb2RlbC5nZXRMaW5lQ291bnQoKTtcblxuXHRcdC8vIHByb3ZpZGUgdGhlIGNoYW5nZWQgbGluZXMgdG8gdGhlIHN0cmVhbSBpbmNyZW1lbnRhbGx5IGFuZCBhc3luY2hyb25vdXNseVxuXHRcdC8vIHRvIGF2b2lkIGJsb2NraW5nIHRoZSBtYWluIHRocmVhZCBhbmQgc2F2ZSBzeXN0ZW0gcmVzb3VyY2VzIHVzZWRcblx0XHRsZXQgaSA9IDE7XG5cdFx0Y29uc3QgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHQvLyBpZiB3ZSBoYXZlIHdyaXR0ZW4gYWxsIGxpbmVzIG9yIGxpbmVzIGNvdW50IGlzIHplcm8sXG5cdFx0XHQvLyBlbmQgdGhlIHN0cmVhbSBhbmQgc3RvcCB0aGUgaW50ZXJ2YWwgdGltZXJcblx0XHRcdGlmIChpID49IGxpbmVzQ291bnQpIHtcblx0XHRcdFx0Y2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG5cdFx0XHRcdHN0cmVhbS5lbmQoKTtcblx0XHRcdFx0c3RyZWFtLmRlc3Ryb3koKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gaWYgbW9kZWwgd2FzIGRpc3Bvc2VkIG9yIGNhbmNlbGxhdGlvbiB3YXMgcmVxdWVzdGVkLFxuXHRcdFx0Ly8gZW5kIHRoZSBzdHJlYW0gd2l0aCBhbiBlcnJvciBhbmQgc3RvcCB0aGUgaW50ZXJ2YWwgdGltZXJcblx0XHRcdGlmICh0aGlzLm1vZGVsLmlzRGlzcG9zZWQoKSB8fCBjYW5jZWxsYXRpb25Ub2tlbj8uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0Y2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG5cdFx0XHRcdHN0cmVhbS5lcnJvcihuZXcgQ2FuY2VsbGF0aW9uRXJyb3IoKSk7XG5cdFx0XHRcdHN0cmVhbS5kZXN0cm95KCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Ly8gd3JpdGUgdGhlIGN1cnJlbnQgbGluZSB0byB0aGUgc3RyZWFtXG5cdFx0XHRcdHN0cmVhbS53cml0ZShcblx0XHRcdFx0XHRWU0J1ZmZlci5mcm9tU3RyaW5nKHRoaXMubW9kZWwuZ2V0TGluZUNvbnRlbnQoaSkpLFxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdC8vIGZvciBhbGwgbGluZXMgZXhjZXB0IHRoZSBsYXN0IG9uZSwgd3JpdGUgdGhlIEVPTCBjaGFyYWN0ZXJcblx0XHRcdFx0Ly8gdG8gc2VwYXJhdGUgdGhlIGxpbmVzIGluIHRoZSBzdHJlYW1cblx0XHRcdFx0aWYgKGkgIT09IGxpbmVzQ291bnQpIHtcblx0XHRcdFx0XHRzdHJlYW0ud3JpdGUoXG5cdFx0XHRcdFx0XHRWU0J1ZmZlci5mcm9tU3RyaW5nKHRoaXMubW9kZWwuZ2V0RU9MKCkpLFxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKHRoaXMudXJpLCBpLCBlcnJvcik7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHVzZSB0aGUgbmV4dCBsaW5lIGluIHRoZSBuZXh0IGl0ZXJhdGlvblxuXHRcdFx0aSsrO1xuXHRcdH0sIDEpO1xuXG5cdFx0cmV0dXJuIHN0cmVhbTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBjcmVhdGVOZXcoXG5cdFx0cHJvbXB0Q29udGVudHNTb3VyY2U6IFRleHRNb2RlbCB8IHsgdXJpOiBVUkkgfSxcblx0KTogSVByb21wdENvbnRlbnRzUHJvdmlkZXIge1xuXHRcdGlmIChwcm9tcHRDb250ZW50c1NvdXJjZSBpbnN0YW5jZW9mIFRleHRNb2RlbCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuaW5pdFNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRcdFRleHRNb2RlbENvbnRlbnRzUHJvdmlkZXIsXG5cdFx0XHRcdHByb21wdENvbnRlbnRzU291cmNlLFxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5pbml0U2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdEZpbGVQcm9tcHRDb250ZW50UHJvdmlkZXIsXG5cdFx0XHRwcm9tcHRDb250ZW50c1NvdXJjZS51cmksXG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhpcyBvYmplY3QuXG5cdCAqL1xuXHRwdWJsaWMgb3ZlcnJpZGUgdG9TdHJpbmcoKSB7XG5cdFx0cmV0dXJuIGB0ZXh0LW1vZGVsLXByb21wdC1jb250ZW50cy1wcm92aWRlcjoke3RoaXMudXJpLnBhdGh9YDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFPQSxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLGtDQUFrQztBQUUzQyxTQUFTLDBCQUEwQztBQUVuRCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGlCQUFpQjtBQUtuQixJQUFNLDRCQUFOLGNBQXdDLDJCQUFzRDtBQUFBLEVBTXBHLFlBQ2tCLE9BQ3VCLGFBQ3ZDO0FBQ0QsVUFBTTtBQUhXO0FBQ3VCO0FBSnpDO0FBQUE7QUFBQTtBQUFBLFNBQWdCLE1BQU0sS0FBSyxNQUFNO0FBUWhDLFNBQUssVUFBVSxLQUFLLE1BQU0sY0FBYyxLQUFLLFFBQVEsS0FBSyxJQUFJLENBQUMsQ0FBQztBQUNoRSxTQUFLLFVBQVUsS0FBSyxNQUFNLG1CQUFtQixLQUFLLGdCQUFnQixJQUFJLENBQUM7QUFBQSxFQUN4RTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQWFBLE1BQXlCLGtCQUN4QixRQUNBLG1CQUNvQztBQUNwQyxVQUFNLFNBQVMsbUJBQTZCLElBQUk7QUFDaEQsVUFBTSxhQUFhLEtBQUssTUFBTSxhQUFhO0FBSTNDLFFBQUksSUFBSTtBQUNSLFVBQU0sV0FBVyxZQUFZLE1BQU07QUFHbEMsVUFBSSxLQUFLLFlBQVk7QUFDcEIsc0JBQWMsUUFBUTtBQUN0QixlQUFPLElBQUk7QUFDWCxlQUFPLFFBQVE7QUFBQSxNQUNoQjtBQUlBLFVBQUksS0FBSyxNQUFNLFdBQVcsS0FBSyxtQkFBbUIseUJBQXlCO0FBQzFFLHNCQUFjLFFBQVE7QUFDdEIsZUFBTyxNQUFNLElBQUksa0JBQWtCLENBQUM7QUFDcEMsZUFBTyxRQUFRO0FBQ2Y7QUFBQSxNQUNEO0FBRUEsVUFBSTtBQUVILGVBQU87QUFBQSxVQUNOLFNBQVMsV0FBVyxLQUFLLE1BQU0sZUFBZSxDQUFDLENBQUM7QUFBQSxRQUNqRDtBQUlBLFlBQUksTUFBTSxZQUFZO0FBQ3JCLGlCQUFPO0FBQUEsWUFDTixTQUFTLFdBQVcsS0FBSyxNQUFNLE9BQU8sQ0FBQztBQUFBLFVBQ3hDO0FBQUEsUUFDRDtBQUFBLE1BQ0QsU0FBUyxPQUFPO0FBQ2YsZ0JBQVEsSUFBSSxLQUFLLEtBQUssR0FBRyxLQUFLO0FBQUEsTUFDL0I7QUFHQTtBQUFBLElBQ0QsR0FBRyxDQUFDO0FBRUosV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVnQixVQUNmLHNCQUMwQjtBQUMxQixRQUFJLGdDQUFnQyxXQUFXO0FBQzlDLGFBQU8sS0FBSyxZQUFZO0FBQUEsUUFDdkI7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxXQUFPLEtBQUssWUFBWTtBQUFBLE1BQ3ZCO0FBQUEsTUFDQSxxQkFBcUI7QUFBQSxJQUN0QjtBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtnQixXQUFXO0FBQzFCLFdBQU8sdUNBQXVDLEtBQUssSUFBSSxJQUFJO0FBQUEsRUFDNUQ7QUFDRDtBQXJHYSw0QkFBTjtBQUFBLEVBUUo7QUFBQSxHQVJVOyIsCiAgIm5hbWVzIjogW10KfQo=
