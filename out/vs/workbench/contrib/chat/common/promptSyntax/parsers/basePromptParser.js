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
import { TopError } from "./topError.js";
import { URI } from "../../../../../../base/common/uri.js";
import { ChatPromptCodec } from "../codecs/chatPromptCodec.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { FileReference } from "../codecs/tokens/fileReference.js";
import { assertDefined } from "../../../../../../base/common/types.js";
import { DeferredPromise } from "../../../../../../base/common/async.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { PromptVariableWithData } from "../codecs/tokens/promptVariable.js";
import { basename, extUri } from "../../../../../../base/common/resources.js";
import { assert, assertNever } from "../../../../../../base/common/assert.js";
import { isPromptFile } from "../../../../../../platform/prompts/common/constants.js";
import { ObservableDisposable } from "../../../../../../base/common/observableDisposable.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { MarkdownLink } from "../../../../../../editor/common/codecs/markdownCodec/tokens/markdownLink.js";
import { NotPromptFile, RecursiveReference, FolderReference, ResolveError } from "../../promptFileReferenceErrors.js";
let BasePromptParser = class extends ObservableDisposable {
  constructor(promptContentsProvider, seenReferences = [], instantiationService, logService) {
    super();
    this.promptContentsProvider = promptContentsProvider;
    this.instantiationService = instantiationService;
    this.logService = logService;
    /**
     * List of file references in the current branch of the file reference tree.
     */
    this._references = [];
    /**
     * The event is fired when lines or their content change.
     */
    this._onUpdate = this._register(new Emitter());
    /**
     * The promise is resolved when at least one parse result (a stream or
     * an error) has been received from the prompt contents provider.
     */
    this.firstParseResult = new FirstParseResult();
    /**
     * Private attribute to track if the {@linkcode start}
     * method has been already called at least once.
     */
    this.started = false;
    this._onUpdate.fire = this._onUpdate.fire.bind(this._onUpdate);
    if (seenReferences.includes(this.uri.path)) {
      seenReferences.push(this.uri.path);
      this._errorCondition = new RecursiveReference(
        this.uri,
        seenReferences
      );
      this._onUpdate.fire();
      this.firstParseResult.complete();
      return this;
    }
    seenReferences.push(this.uri.path);
    this._register(
      this.promptContentsProvider.onContentChanged((streamOrError) => {
        this.onContentsChanged(streamOrError, seenReferences);
        this.firstParseResult.complete();
      })
    );
    this.promptContentsProvider.onDispose(this.dispose.bind(this));
  }
  /**
   * Subscribe to the `onUpdate` event that is fired when prompt tokens are updated.
   * @param callback The callback function to be called on updates.
   */
  onUpdate(callback) {
    this._register(this._onUpdate.event(callback));
    return this;
  }
  /**
   * If file reference resolution fails, this attribute will be set
   * to an error instance that describes the error condition.
   */
  get errorCondition() {
    return this._errorCondition;
  }
  /**
   * Whether file references resolution failed.
   * Set to `undefined` if the `resolve` method hasn't been ever called yet.
   */
  get resolveFailed() {
    if (!this.firstParseResult.gotFirstResult) {
      return void 0;
    }
    return !!this._errorCondition;
  }
  /**
   * Returned promise is resolved when the parser process is settled.
   * The settled state means that the prompt parser stream exists and
   * has ended, or an error condition has been set in case of failure.
   *
   * Furthermore, this function can be called multiple times and will
   * block until the latest prompt contents parsing logic is settled
   * (e.g., for every `onContentChanged` event of the prompt source).
   */
  async settled() {
    assert(
      this.started,
      "Cannot wait on the parser that did not start yet."
    );
    await this.firstParseResult.promise;
    if (this.errorCondition) {
      return this;
    }
    assertDefined(
      this.stream,
      "No stream reference found."
    );
    await this.stream.settled;
    return this;
  }
  /**
   * Same as {@linkcode settled} but also waits for all possible
   * nested child prompt references and their children to be settled.
   */
  async allSettled() {
    await this.settled();
    await Promise.allSettled(
      this.references.map((reference) => {
        return reference.allSettled();
      })
    );
    return this;
  }
  /**
   * Handler the event event that is triggered when prompt contents change.
   *
   * @param streamOrError Either a binary stream of file contents, or an error object
   * 						that was generated during the reference resolve attempt.
   * @param seenReferences List of parent references that we've have already seen
   * 					 	during the process of traversing the references tree. It's
   * 						used to prevent the tree navigation to fall into an infinite
   * 						references recursion.
   */
  onContentsChanged(streamOrError, seenReferences) {
    this.stream?.dispose();
    delete this.stream;
    delete this._errorCondition;
    this.disposeReferences();
    if (streamOrError instanceof ResolveError) {
      this._errorCondition = streamOrError;
      this._onUpdate.fire();
      return;
    }
    this.stream = ChatPromptCodec.decode(streamOrError);
    this.stream.on("error", this.onStreamEnd.bind(this, this.stream));
    this.stream.on("end", this.onStreamEnd.bind(this, this.stream));
    this.stream.on("data", (token) => {
      if (token instanceof PromptVariableWithData) {
        try {
          this.onReference(FileReference.from(token), [...seenReferences]);
        } catch (error) {
        }
      }
      if (token instanceof MarkdownLink && !token.isURL) {
        this.onReference(token, [...seenReferences]);
      }
    });
    if (this.stream.disposed) {
      this.logService.warn(
        `[prompt parser][${basename(this.uri)}] cannot start stream that has been already disposed, aborting`
      );
      return;
    }
    this.stream.start();
  }
  /**
   * Handle a new reference token inside prompt contents.
   */
  onReference(token, seenReferences) {
    const referenceUri = extUri.resolvePath(this.dirname, token.path);
    const contentProvider = this.promptContentsProvider.createNew({ uri: referenceUri });
    const reference = this.instantiationService.createInstance(PromptReference, contentProvider, token, seenReferences);
    reference.onDispose(contentProvider.dispose.bind(contentProvider));
    this._references.push(reference);
    reference.onUpdate(this._onUpdate.fire);
    this._onUpdate.fire();
    reference.start();
    return this;
  }
  /**
   * Handle the `stream` end event.
   *
   * @param stream The stream that has ended.
   * @param error Optional error object if stream ended with an error.
   */
  onStreamEnd(_stream, error) {
    if (error) {
      this.logService.warn(
        `[prompt parser][${basename(this.uri)}] received an error on the chat prompt decoder stream: ${error}`
      );
    }
    this._onUpdate.fire();
    return this;
  }
  /**
   * Dispose all currently held references.
   */
  disposeReferences() {
    for (const reference of [...this._references]) {
      reference.dispose();
    }
    this._references.length = 0;
  }
  /**
   * Start the prompt parser.
   */
  start() {
    if (this.started) {
      return this;
    }
    this.started = true;
    if (this.errorCondition) {
      return this;
    }
    this.promptContentsProvider.start();
    return this;
  }
  /**
   * Associated URI of the prompt.
   */
  get uri() {
    return this.promptContentsProvider.uri;
  }
  /**
   * Get the parent folder of the file reference.
   */
  get dirname() {
    return URI.joinPath(this.uri, "..");
  }
  /**
   * Get a list of immediate child references of the prompt.
   */
  get references() {
    return [...this._references];
  }
  /**
   * Get a list of all references of the prompt, including
   * all possible nested references its children may have.
   */
  get allReferences() {
    const result = [];
    for (const reference of this.references) {
      result.push(reference);
      if (reference.type === "file") {
        result.push(...reference.allReferences);
      }
    }
    return result;
  }
  /**
   * Get list of all valid references.
   */
  get allValidReferences() {
    return this.allReferences.filter((reference) => {
      const { errorCondition } = reference;
      if (!errorCondition) {
        return true;
      }
      if (errorCondition instanceof FolderReference) {
        return false;
      }
      return errorCondition instanceof NotPromptFile;
    });
  }
  /**
   * Get list of all valid child references as URIs.
   */
  get allValidReferencesUris() {
    return this.allValidReferences.map((child) => child.uri);
  }
  /**
   * Get list of errors for the direct links of the current reference.
   */
  get errors() {
    const childErrors = [];
    for (const reference of this.references) {
      const { errorCondition } = reference;
      if (errorCondition && !(errorCondition instanceof NotPromptFile)) {
        childErrors.push(errorCondition);
      }
    }
    return childErrors;
  }
  /**
   * List of all errors that occurred while resolving the current
   * reference including all possible errors of nested children.
   */
  get allErrors() {
    const result = [];
    for (const reference of this.references) {
      const { errorCondition } = reference;
      if (errorCondition && !(errorCondition instanceof NotPromptFile)) {
        result.push({
          originalError: errorCondition,
          parentUri: this.uri
        });
      }
      result.push(...reference.allErrors);
    }
    return result;
  }
  /**
   * The top most error of the current reference or any of its
   * possible child reference errors.
   */
  get topError() {
    if (this.errorCondition) {
      return new TopError({
        errorSubject: "root",
        errorsCount: 1,
        originalError: this.errorCondition
      });
    }
    const childErrors = [...this.errors];
    const nestedErrors = [];
    for (const reference of this.references) {
      nestedErrors.push(...reference.allErrors);
    }
    if (childErrors.length === 0 && nestedErrors.length === 0) {
      return void 0;
    }
    const firstDirectChildError = childErrors[0];
    const firstNestedChildError = nestedErrors[0];
    const hasDirectChildError = firstDirectChildError !== void 0;
    const firstChildError = hasDirectChildError ? {
      originalError: firstDirectChildError,
      parentUri: this.uri
    } : firstNestedChildError;
    const totalErrorsCount = childErrors.length + nestedErrors.length;
    const subject = hasDirectChildError ? "child" : "indirect-child";
    return new TopError({
      errorSubject: subject,
      originalError: firstChildError.originalError,
      parentUri: firstChildError.parentUri,
      errorsCount: totalErrorsCount
    });
  }
  /**
   * Check if the current reference points to a given resource.
   */
  sameUri(otherUri) {
    return this.uri.toString() === otherUri.toString();
  }
  /**
   * Check if the current reference points to a prompt snippet file.
   */
  get isPromptFile() {
    return isPromptFile(this.uri);
  }
  /**
   * Returns a string representation of this object.
   */
  toString() {
    return `prompt:${this.uri.path}`;
  }
  /**
   * @inheritdoc
   */
  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposeReferences();
    this.stream?.dispose();
    this._onUpdate.fire();
    super.dispose();
  }
};
BasePromptParser = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ILogService)
], BasePromptParser);
let PromptReference = class extends ObservableDisposable {
  constructor(promptContentsProvider, token, seenReferences = [], initService) {
    super();
    this.promptContentsProvider = promptContentsProvider;
    this.token = token;
    this.range = this.token.range;
    this.path = this.token.path;
    this.text = this.token.text;
    this.parser = this._register(initService.createInstance(
      BasePromptParser,
      this.promptContentsProvider,
      seenReferences
    ));
  }
  /**
   * Get the range of the `link` part of the reference.
   */
  get linkRange() {
    if (this.token instanceof FileReference) {
      return this.token.dataRange;
    }
    if (this.token instanceof MarkdownLink) {
      return this.token.linkRange;
    }
    return void 0;
  }
  /**
   * Type of the reference, - either a prompt `#file` variable,
   * or a `markdown link` reference (`[caption](/path/to/file.md)`).
   */
  get type() {
    if (this.token instanceof FileReference) {
      return "file";
    }
    if (this.token instanceof MarkdownLink) {
      return "file";
    }
    assertNever(
      this.token,
      `Unknown token type '${this.token}'.`
    );
  }
  /**
   * Subtype of the reference, - either a prompt `#file` variable,
   * or a `markdown link` reference (`[caption](/path/to/file.md)`).
   */
  get subtype() {
    if (this.token instanceof FileReference) {
      return "prompt";
    }
    if (this.token instanceof MarkdownLink) {
      return "markdown";
    }
    assertNever(
      this.token,
      `Unknown token type '${this.token}'.`
    );
  }
  /**
   * Start parsing the reference contents.
   */
  start() {
    this.parser.start();
    return this;
  }
  /**
   * Subscribe to the `onUpdate` event that is fired when prompt tokens are updated.
   * @param callback The callback function to be called on updates.
   */
  onUpdate(callback) {
    this.parser.onUpdate(callback);
    return this;
  }
  get resolveFailed() {
    return this.parser.resolveFailed;
  }
  get errorCondition() {
    return this.parser.errorCondition;
  }
  get topError() {
    return this.parser.topError;
  }
  get uri() {
    return this.parser.uri;
  }
  get isPromptFile() {
    return this.parser.isPromptFile;
  }
  get errors() {
    return this.parser.errors;
  }
  get allErrors() {
    return this.parser.allErrors;
  }
  get references() {
    return this.parser.references;
  }
  get allReferences() {
    return this.parser.allReferences;
  }
  get allValidReferences() {
    return this.parser.allValidReferences;
  }
  async settled() {
    await this.parser.settled();
    return this;
  }
  async allSettled() {
    await this.parser.allSettled();
    return this;
  }
  /**
   * Returns a string representation of this object.
   */
  toString() {
    return `prompt-reference/${this.type}:${this.subtype}/${this.token}`;
  }
};
PromptReference = __decorateClass([
  __decorateParam(3, IInstantiationService)
], PromptReference);
class FirstParseResult extends DeferredPromise {
  constructor() {
    super(...arguments);
    /**
     * Private attribute to track if we have
     * received at least one result.
     */
    this._gotResult = false;
  }
  /**
   * Whether we've received at least one result.
   */
  get gotFirstResult() {
    return this._gotResult;
  }
  /**
   * Get underlying promise reference.
   */
  get promise() {
    return this.p;
  }
  /**
   * Complete the underlying promise.
   */
  complete() {
    this._gotResult = true;
    return super.complete(void 0);
  }
}
export {
  BasePromptParser,
  PromptReference
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvcGFyc2Vycy9iYXNlUHJvbXB0UGFyc2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVG9wRXJyb3IgfSBmcm9tICcuL3RvcEVycm9yLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBDaGF0UHJvbXB0Q29kZWMgfSBmcm9tICcuLi9jb2RlY3MvY2hhdFByb21wdENvZGVjLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBGaWxlUmVmZXJlbmNlIH0gZnJvbSAnLi4vY29kZWNzL3Rva2Vucy9maWxlUmVmZXJlbmNlLmpzJztcbmltcG9ydCB7IENoYXRQcm9tcHREZWNvZGVyIH0gZnJvbSAnLi4vY29kZWNzL2NoYXRQcm9tcHREZWNvZGVyLmpzJztcbmltcG9ydCB7IElSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBhc3NlcnREZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgSVByb21wdENvbnRlbnRzUHJvdmlkZXIgfSBmcm9tICcuLi9jb250ZW50UHJvdmlkZXJzL3R5cGVzLmpzJztcbmltcG9ydCB7IElQcm9tcHRSZWZlcmVuY2UsIElSZXNvbHZlRXJyb3IsIElUb3BFcnJvciB9IGZyb20gJy4vdHlwZXMuanMnO1xuaW1wb3J0IHsgRGVmZXJyZWRQcm9taXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBQcm9tcHRWYXJpYWJsZVdpdGhEYXRhIH0gZnJvbSAnLi4vY29kZWNzL3Rva2Vucy9wcm9tcHRWYXJpYWJsZS5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZXh0VXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGFzc2VydCwgYXNzZXJ0TmV2ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3NlcnQuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBpc1Byb21wdEZpbGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9tcHRzL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlRGlzcG9zYWJsZS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IE1hcmtkb3duTGluayB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29kZWNzL21hcmtkb3duQ29kZWMvdG9rZW5zL21hcmtkb3duTGluay5qcyc7XG5pbXBvcnQgeyBPcGVuRmFpbGVkLCBOb3RQcm9tcHRGaWxlLCBSZWN1cnNpdmVSZWZlcmVuY2UsIEZvbGRlclJlZmVyZW5jZSwgUmVzb2x2ZUVycm9yIH0gZnJvbSAnLi4vLi4vcHJvbXB0RmlsZVJlZmVyZW5jZUVycm9ycy5qcyc7XG5cbi8qKlxuICogRXJyb3IgY29uZGl0aW9ucyB0aGF0IG1heSBoYXBwZW4gZHVyaW5nIHRoZSBmaWxlIHJlZmVyZW5jZSByZXNvbHV0aW9uLlxuICovXG5leHBvcnQgdHlwZSBURXJyb3JDb25kaXRpb24gPSBPcGVuRmFpbGVkIHwgUmVjdXJzaXZlUmVmZXJlbmNlIHwgRm9sZGVyUmVmZXJlbmNlIHwgTm90UHJvbXB0RmlsZTtcblxuLyoqXG4gKiBCYXNlIHByb21wdCBwYXJzZXIgY2xhc3MgdGhhdCBwcm92aWRlcyBhIGNvbW1vbiBpbnRlcmZhY2UgZm9yIGFsbFxuICogcHJvbXB0IHBhcnNlcnMgdGhhdCBhcmUgcmVzcG9uc2libGUgZm9yIHBhcnNpbmcgY2hhdCBwcm9tcHQgc3ludGF4LlxuICovXG5leHBvcnQgY2xhc3MgQmFzZVByb21wdFBhcnNlcjxUQ29udGVudHNQcm92aWRlciBleHRlbmRzIElQcm9tcHRDb250ZW50c1Byb3ZpZGVyPiBleHRlbmRzIE9ic2VydmFibGVEaXNwb3NhYmxlIHtcblx0LyoqXG5cdCAqIExpc3Qgb2YgZmlsZSByZWZlcmVuY2VzIGluIHRoZSBjdXJyZW50IGJyYW5jaCBvZiB0aGUgZmlsZSByZWZlcmVuY2UgdHJlZS5cblx0ICovXG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlZmVyZW5jZXM6IElQcm9tcHRSZWZlcmVuY2VbXSA9IFtdO1xuXG5cdC8qKlxuXHQgKiBUaGUgZXZlbnQgaXMgZmlyZWQgd2hlbiBsaW5lcyBvciB0aGVpciBjb250ZW50IGNoYW5nZS5cblx0ICovXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uVXBkYXRlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cblx0LyoqXG5cdCAqIFN1YnNjcmliZSB0byB0aGUgYG9uVXBkYXRlYCBldmVudCB0aGF0IGlzIGZpcmVkIHdoZW4gcHJvbXB0IHRva2VucyBhcmUgdXBkYXRlZC5cblx0ICogQHBhcmFtIGNhbGxiYWNrIFRoZSBjYWxsYmFjayBmdW5jdGlvbiB0byBiZSBjYWxsZWQgb24gdXBkYXRlcy5cblx0ICovXG5cdHB1YmxpYyBvblVwZGF0ZShjYWxsYmFjazogKCkgPT4gdm9pZCk6IHRoaXMge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX29uVXBkYXRlLmV2ZW50KGNhbGxiYWNrKSk7XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdC8qKlxuXHQgKiBJZiBmYWlsZWQgdG8gcGFyc2UgcHJvbXB0IGNvbnRlbnRzLCB0aGlzIHByb3BlcnR5IGhhc1xuXHQgKiBhbiBlcnJvciBvYmplY3QgdGhhdCBkZXNjcmliZXMgdGhlIGZhaWx1cmUgcmVhc29uLlxuXHQgKi9cblx0cHJpdmF0ZSBfZXJyb3JDb25kaXRpb24/OiBSZXNvbHZlRXJyb3I7XG5cblx0LyoqXG5cdCAqIElmIGZpbGUgcmVmZXJlbmNlIHJlc29sdXRpb24gZmFpbHMsIHRoaXMgYXR0cmlidXRlIHdpbGwgYmUgc2V0XG5cdCAqIHRvIGFuIGVycm9yIGluc3RhbmNlIHRoYXQgZGVzY3JpYmVzIHRoZSBlcnJvciBjb25kaXRpb24uXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IGVycm9yQ29uZGl0aW9uKCk6IFJlc29sdmVFcnJvciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2Vycm9yQ29uZGl0aW9uO1xuXHR9XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgZmlsZSByZWZlcmVuY2VzIHJlc29sdXRpb24gZmFpbGVkLlxuXHQgKiBTZXQgdG8gYHVuZGVmaW5lZGAgaWYgdGhlIGByZXNvbHZlYCBtZXRob2QgaGFzbid0IGJlZW4gZXZlciBjYWxsZWQgeWV0LlxuXHQgKi9cblx0cHVibGljIGdldCByZXNvbHZlRmFpbGVkKCk6IGJvb2xlYW4gfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGhpcy5maXJzdFBhcnNlUmVzdWx0LmdvdEZpcnN0UmVzdWx0KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiAhIXRoaXMuX2Vycm9yQ29uZGl0aW9uO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBwcm9taXNlIGlzIHJlc29sdmVkIHdoZW4gYXQgbGVhc3Qgb25lIHBhcnNlIHJlc3VsdCAoYSBzdHJlYW0gb3Jcblx0ICogYW4gZXJyb3IpIGhhcyBiZWVuIHJlY2VpdmVkIGZyb20gdGhlIHByb21wdCBjb250ZW50cyBwcm92aWRlci5cblx0ICovXG5cdHByaXZhdGUgZmlyc3RQYXJzZVJlc3VsdCA9IG5ldyBGaXJzdFBhcnNlUmVzdWx0KCk7XG5cblx0LyoqXG5cdCAqIFJldHVybmVkIHByb21pc2UgaXMgcmVzb2x2ZWQgd2hlbiB0aGUgcGFyc2VyIHByb2Nlc3MgaXMgc2V0dGxlZC5cblx0ICogVGhlIHNldHRsZWQgc3RhdGUgbWVhbnMgdGhhdCB0aGUgcHJvbXB0IHBhcnNlciBzdHJlYW0gZXhpc3RzIGFuZFxuXHQgKiBoYXMgZW5kZWQsIG9yIGFuIGVycm9yIGNvbmRpdGlvbiBoYXMgYmVlbiBzZXQgaW4gY2FzZSBvZiBmYWlsdXJlLlxuXHQgKlxuXHQgKiBGdXJ0aGVybW9yZSwgdGhpcyBmdW5jdGlvbiBjYW4gYmUgY2FsbGVkIG11bHRpcGxlIHRpbWVzIGFuZCB3aWxsXG5cdCAqIGJsb2NrIHVudGlsIHRoZSBsYXRlc3QgcHJvbXB0IGNvbnRlbnRzIHBhcnNpbmcgbG9naWMgaXMgc2V0dGxlZFxuXHQgKiAoZS5nLiwgZm9yIGV2ZXJ5IGBvbkNvbnRlbnRDaGFuZ2VkYCBldmVudCBvZiB0aGUgcHJvbXB0IHNvdXJjZSkuXG5cdCAqL1xuXHRwdWJsaWMgYXN5bmMgc2V0dGxlZCgpOiBQcm9taXNlPHRoaXM+IHtcblx0XHRhc3NlcnQoXG5cdFx0XHR0aGlzLnN0YXJ0ZWQsXG5cdFx0XHQnQ2Fubm90IHdhaXQgb24gdGhlIHBhcnNlciB0aGF0IGRpZCBub3Qgc3RhcnQgeWV0LicsXG5cdFx0KTtcblxuXHRcdGF3YWl0IHRoaXMuZmlyc3RQYXJzZVJlc3VsdC5wcm9taXNlO1xuXG5cdFx0aWYgKHRoaXMuZXJyb3JDb25kaXRpb24pIHtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblxuXHRcdGFzc2VydERlZmluZWQoXG5cdFx0XHR0aGlzLnN0cmVhbSxcblx0XHRcdCdObyBzdHJlYW0gcmVmZXJlbmNlIGZvdW5kLicsXG5cdFx0KTtcblxuXHRcdGF3YWl0IHRoaXMuc3RyZWFtLnNldHRsZWQ7XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdC8qKlxuXHQgKiBTYW1lIGFzIHtAbGlua2NvZGUgc2V0dGxlZH0gYnV0IGFsc28gd2FpdHMgZm9yIGFsbCBwb3NzaWJsZVxuXHQgKiBuZXN0ZWQgY2hpbGQgcHJvbXB0IHJlZmVyZW5jZXMgYW5kIHRoZWlyIGNoaWxkcmVuIHRvIGJlIHNldHRsZWQuXG5cdCAqL1xuXHRwdWJsaWMgYXN5bmMgYWxsU2V0dGxlZCgpOiBQcm9taXNlPHRoaXM+IHtcblx0XHRhd2FpdCB0aGlzLnNldHRsZWQoKTtcblxuXHRcdGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChcblx0XHRcdHRoaXMucmVmZXJlbmNlcy5tYXAoKHJlZmVyZW5jZSkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gcmVmZXJlbmNlLmFsbFNldHRsZWQoKTtcblx0XHRcdH0pLFxuXHRcdCk7XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcHJvbXB0Q29udGVudHNQcm92aWRlcjogVENvbnRlbnRzUHJvdmlkZXIsXG5cdFx0c2VlblJlZmVyZW5jZXM6IHN0cmluZ1tdID0gW10sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fb25VcGRhdGUuZmlyZSA9IHRoaXMuX29uVXBkYXRlLmZpcmUuYmluZCh0aGlzLl9vblVwZGF0ZSk7XG5cblx0XHQvLyB0byBwcmV2ZW50IGluZmluaXRlIGZpbGUgcmVjdXJzaW9uLCB3ZSBrZWVwIHRyYWNrIG9mIGFsbCByZWZlcmVuY2VzIGluXG5cdFx0Ly8gdGhlIGN1cnJlbnQgYnJhbmNoIG9mIHRoZSBmaWxlIHJlZmVyZW5jZSB0cmVlIGFuZCBjaGVjayBpZiB0aGUgY3VycmVudFxuXHRcdC8vIGZpbGUgcmVmZXJlbmNlIGhhcyBiZWVuIGFscmVhZHkgc2VlbiBiZWZvcmVcblx0XHRpZiAoc2VlblJlZmVyZW5jZXMuaW5jbHVkZXModGhpcy51cmkucGF0aCkpIHtcblx0XHRcdHNlZW5SZWZlcmVuY2VzLnB1c2godGhpcy51cmkucGF0aCk7XG5cblx0XHRcdHRoaXMuX2Vycm9yQ29uZGl0aW9uID0gbmV3IFJlY3Vyc2l2ZVJlZmVyZW5jZShcblx0XHRcdFx0dGhpcy51cmksXG5cdFx0XHRcdHNlZW5SZWZlcmVuY2VzLFxuXHRcdFx0KTtcblx0XHRcdHRoaXMuX29uVXBkYXRlLmZpcmUoKTtcblx0XHRcdHRoaXMuZmlyc3RQYXJzZVJlc3VsdC5jb21wbGV0ZSgpO1xuXG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cblx0XHQvLyB3ZSBkb24ndCBjYXJlIGlmIHJlYWRpbmcgdGhlIGZpbGUgZmFpbHMgYmVsb3csIGhlbmNlIGNhbiBhZGQgdGhlIHBhdGhcblx0XHQvLyBvZiB0aGUgY3VycmVudCByZWZlcmVuY2UgdG8gdGhlIGBzZWVuUmVmZXJlbmNlc2Agc2V0IGltbWVkaWF0ZWx5LCAtXG5cdFx0Ly8gZXZlbiBpZiB0aGUgZmlsZSBkb2Vzbid0IGV4aXN0LCB3ZSB3b3VsZCBuZXZlciBlbmQgdXAgaW4gdGhlIHJlY3Vyc2lvblxuXHRcdHNlZW5SZWZlcmVuY2VzLnB1c2godGhpcy51cmkucGF0aCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihcblx0XHRcdHRoaXMucHJvbXB0Q29udGVudHNQcm92aWRlci5vbkNvbnRlbnRDaGFuZ2VkKChzdHJlYW1PckVycm9yKSA9PiB7XG5cdFx0XHRcdC8vIHByb2Nlc3MgdGhlIHJlY2VpdmVkIG1lc3NhZ2Vcblx0XHRcdFx0dGhpcy5vbkNvbnRlbnRzQ2hhbmdlZChzdHJlYW1PckVycm9yLCBzZWVuUmVmZXJlbmNlcyk7XG5cblx0XHRcdFx0Ly8gaW5kaWNhdGUgdGhhdCB3ZSd2ZSByZWNlaXZlZCBhdCBsZWFzdCBvbmUgYG9uQ29udGVudENoYW5nZWRgIGV2ZW50XG5cdFx0XHRcdHRoaXMuZmlyc3RQYXJzZVJlc3VsdC5jb21wbGV0ZSgpO1xuXHRcdFx0fSksXG5cdFx0KTtcblxuXHRcdC8vIGRpc3Bvc2Ugc2VsZiB3aGVuIGNvbnRlbnRzIHByb3ZpZGVyIGlzIGRpc3Bvc2VkXG5cdFx0dGhpcy5wcm9tcHRDb250ZW50c1Byb3ZpZGVyLm9uRGlzcG9zZSh0aGlzLmRpc3Bvc2UuYmluZCh0aGlzKSk7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIGxhdGVzdCByZWNlaXZlZCBzdHJlYW0gb2YgcHJvbXB0IHRva2VucywgaWYgYW55LlxuXHQgKi9cblx0cHJpdmF0ZSBzdHJlYW06IENoYXRQcm9tcHREZWNvZGVyIHwgdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBIYW5kbGVyIHRoZSBldmVudCBldmVudCB0aGF0IGlzIHRyaWdnZXJlZCB3aGVuIHByb21wdCBjb250ZW50cyBjaGFuZ2UuXG5cdCAqXG5cdCAqIEBwYXJhbSBzdHJlYW1PckVycm9yIEVpdGhlciBhIGJpbmFyeSBzdHJlYW0gb2YgZmlsZSBjb250ZW50cywgb3IgYW4gZXJyb3Igb2JqZWN0XG5cdCAqIFx0XHRcdFx0XHRcdHRoYXQgd2FzIGdlbmVyYXRlZCBkdXJpbmcgdGhlIHJlZmVyZW5jZSByZXNvbHZlIGF0dGVtcHQuXG5cdCAqIEBwYXJhbSBzZWVuUmVmZXJlbmNlcyBMaXN0IG9mIHBhcmVudCByZWZlcmVuY2VzIHRoYXQgd2UndmUgaGF2ZSBhbHJlYWR5IHNlZW5cblx0ICogXHRcdFx0XHRcdCBcdGR1cmluZyB0aGUgcHJvY2VzcyBvZiB0cmF2ZXJzaW5nIHRoZSByZWZlcmVuY2VzIHRyZWUuIEl0J3Ncblx0ICogXHRcdFx0XHRcdFx0dXNlZCB0byBwcmV2ZW50IHRoZSB0cmVlIG5hdmlnYXRpb24gdG8gZmFsbCBpbnRvIGFuIGluZmluaXRlXG5cdCAqIFx0XHRcdFx0XHRcdHJlZmVyZW5jZXMgcmVjdXJzaW9uLlxuXHQgKi9cblx0cHJpdmF0ZSBvbkNvbnRlbnRzQ2hhbmdlZChcblx0XHRzdHJlYW1PckVycm9yOiBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtIHwgUmVzb2x2ZUVycm9yLFxuXHRcdHNlZW5SZWZlcmVuY2VzOiBzdHJpbmdbXSxcblx0KTogdm9pZCB7XG5cdFx0Ly8gZGlzcG9zZSBhbmQgY2xlYW51cCB0aGUgcHJldmlvdXNseSByZWNlaXZlZCBzdHJlYW1cblx0XHQvLyBvYmplY3Qgb3IgYW4gZXJyb3IgY29uZGl0aW9uLCBpZiBhbnkgcmVjZWl2ZWQgeWV0XG5cdFx0dGhpcy5zdHJlYW0/LmRpc3Bvc2UoKTtcblx0XHRkZWxldGUgdGhpcy5zdHJlYW07XG5cdFx0ZGVsZXRlIHRoaXMuX2Vycm9yQ29uZGl0aW9uO1xuXG5cdFx0Ly8gZGlzcG9zZSBhbGwgY3VycmVudGx5IGV4aXN0aW5nIHJlZmVyZW5jZXNcblx0XHR0aGlzLmRpc3Bvc2VSZWZlcmVuY2VzKCk7XG5cblx0XHQvLyBpZiBhbiBlcnJvciByZWNlaXZlZCwgc2V0IHVwIHRoZSBlcnJvciBjb25kaXRpb24gYW5kIHN0b3Bcblx0XHRpZiAoc3RyZWFtT3JFcnJvciBpbnN0YW5jZW9mIFJlc29sdmVFcnJvcikge1xuXHRcdFx0dGhpcy5fZXJyb3JDb25kaXRpb24gPSBzdHJlYW1PckVycm9yO1xuXHRcdFx0dGhpcy5fb25VcGRhdGUuZmlyZSgpO1xuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gZGVjb2RlIHRoZSBieXRlIHN0cmVhbSB0byBhIHN0cmVhbSBvZiBwcm9tcHQgdG9rZW5zXG5cdFx0dGhpcy5zdHJlYW0gPSBDaGF0UHJvbXB0Q29kZWMuZGVjb2RlKHN0cmVhbU9yRXJyb3IpO1xuXG5cdFx0Ly8gb24gZXJyb3Igb3Igc3RyZWFtIGVuZCwgZGlzcG9zZSB0aGUgc3RyZWFtIGFuZCBmaXJlIHRoZSB1cGRhdGUgZXZlbnRcblx0XHR0aGlzLnN0cmVhbS5vbignZXJyb3InLCB0aGlzLm9uU3RyZWFtRW5kLmJpbmQodGhpcywgdGhpcy5zdHJlYW0pKTtcblx0XHR0aGlzLnN0cmVhbS5vbignZW5kJywgdGhpcy5vblN0cmVhbUVuZC5iaW5kKHRoaXMsIHRoaXMuc3RyZWFtKSk7XG5cblx0XHQvLyB3aGVuIHNvbWUgdG9rZW5zIHJlY2VpdmVkLCBwcm9jZXNzIGFuZCBzdG9yZSB0aGUgcmVmZXJlbmNlc1xuXHRcdHRoaXMuc3RyZWFtLm9uKCdkYXRhJywgKHRva2VuKSA9PiB7XG5cdFx0XHRpZiAodG9rZW4gaW5zdGFuY2VvZiBQcm9tcHRWYXJpYWJsZVdpdGhEYXRhKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0dGhpcy5vblJlZmVyZW5jZShGaWxlUmVmZXJlbmNlLmZyb20odG9rZW4pLCBbLi4uc2VlblJlZmVyZW5jZXNdKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHQvLyBuby1vcFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIG5vdGUhIHRoZSBgaXNVUkxgIGlzIGEgc2ltcGxlIGNoZWNrIGFuZCBuZWVkcyB0byBiZSBpbXByb3ZlZCB0byB0cnVseVxuXHRcdFx0Ly8gXHRcdCBoYW5kbGUgb25seSBmaWxlIHJlZmVyZW5jZXMsIGlnbm9yaW5nIGJyb2tlbiBVUkxzIG9yIHJlZmVyZW5jZXNcblx0XHRcdGlmICh0b2tlbiBpbnN0YW5jZW9mIE1hcmtkb3duTGluayAmJiAhdG9rZW4uaXNVUkwpIHtcblx0XHRcdFx0dGhpcy5vblJlZmVyZW5jZSh0b2tlbiwgWy4uLnNlZW5SZWZlcmVuY2VzXSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHQvLyBjYWxsaW5nIGBzdGFydGAgb24gYSBkaXNwb3NlZCBzdHJlYW0gdGhyb3dzLCBzbyB3ZSB3YXJuIGFuZCByZXR1cm4gaW5zdGVhZFxuXHRcdGlmICh0aGlzLnN0cmVhbS5kaXNwb3NlZCkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oXG5cdFx0XHRcdGBbcHJvbXB0IHBhcnNlcl1bJHtiYXNlbmFtZSh0aGlzLnVyaSl9XSBjYW5ub3Qgc3RhcnQgc3RyZWFtIHRoYXQgaGFzIGJlZW4gYWxyZWFkeSBkaXNwb3NlZCwgYWJvcnRpbmdgLFxuXHRcdFx0KTtcblxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIHN0YXJ0IHJlY2VpdmluZyBkYXRhIG9uIHRoZSBzdHJlYW1cblx0XHR0aGlzLnN0cmVhbS5zdGFydCgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEhhbmRsZSBhIG5ldyByZWZlcmVuY2UgdG9rZW4gaW5zaWRlIHByb21wdCBjb250ZW50cy5cblx0ICovXG5cdHByaXZhdGUgb25SZWZlcmVuY2UoXG5cdFx0dG9rZW46IEZpbGVSZWZlcmVuY2UgfCBNYXJrZG93bkxpbmssXG5cdFx0c2VlblJlZmVyZW5jZXM6IHN0cmluZ1tdLFxuXHQpOiB0aGlzIHtcblxuXHRcdGNvbnN0IHJlZmVyZW5jZVVyaSA9IGV4dFVyaS5yZXNvbHZlUGF0aCh0aGlzLmRpcm5hbWUsIHRva2VuLnBhdGgpO1xuXHRcdGNvbnN0IGNvbnRlbnRQcm92aWRlciA9IHRoaXMucHJvbXB0Q29udGVudHNQcm92aWRlci5jcmVhdGVOZXcoeyB1cmk6IHJlZmVyZW5jZVVyaSB9KTtcblxuXHRcdGNvbnN0IHJlZmVyZW5jZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2Vcblx0XHRcdC5jcmVhdGVJbnN0YW5jZShQcm9tcHRSZWZlcmVuY2UsIGNvbnRlbnRQcm92aWRlciwgdG9rZW4sIHNlZW5SZWZlcmVuY2VzKTtcblxuXHRcdC8vIHRoZSBjb250ZW50IHByb3ZpZGVyIGlzIGV4Y2x1c2l2ZWx5IG93bmVkIGJ5IHRoZSByZWZlcmVuY2Vcblx0XHQvLyBoZW5jZSBkaXNwb3NlIGl0IHdoZW4gdGhlIHJlZmVyZW5jZSBpcyBkaXNwb3NlZFxuXHRcdHJlZmVyZW5jZS5vbkRpc3Bvc2UoY29udGVudFByb3ZpZGVyLmRpc3Bvc2UuYmluZChjb250ZW50UHJvdmlkZXIpKTtcblxuXHRcdHRoaXMuX3JlZmVyZW5jZXMucHVzaChyZWZlcmVuY2UpO1xuXG5cdFx0cmVmZXJlbmNlLm9uVXBkYXRlKHRoaXMuX29uVXBkYXRlLmZpcmUpO1xuXHRcdHRoaXMuX29uVXBkYXRlLmZpcmUoKTtcblxuXHRcdHJlZmVyZW5jZS5zdGFydCgpO1xuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHQvKipcblx0ICogSGFuZGxlIHRoZSBgc3RyZWFtYCBlbmQgZXZlbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSBzdHJlYW0gVGhlIHN0cmVhbSB0aGF0IGhhcyBlbmRlZC5cblx0ICogQHBhcmFtIGVycm9yIE9wdGlvbmFsIGVycm9yIG9iamVjdCBpZiBzdHJlYW0gZW5kZWQgd2l0aCBhbiBlcnJvci5cblx0ICovXG5cdHByaXZhdGUgb25TdHJlYW1FbmQoXG5cdFx0X3N0cmVhbTogQ2hhdFByb21wdERlY29kZXIsXG5cdFx0ZXJyb3I/OiBFcnJvcixcblx0KTogdGhpcyB7XG5cdFx0aWYgKGVycm9yKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2Fybihcblx0XHRcdFx0YFtwcm9tcHQgcGFyc2VyXVske2Jhc2VuYW1lKHRoaXMudXJpKX1dIHJlY2VpdmVkIGFuIGVycm9yIG9uIHRoZSBjaGF0IHByb21wdCBkZWNvZGVyIHN0cmVhbTogJHtlcnJvcn1gLFxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHR0aGlzLl9vblVwZGF0ZS5maXJlKCk7XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdC8qKlxuXHQgKiBEaXNwb3NlIGFsbCBjdXJyZW50bHkgaGVsZCByZWZlcmVuY2VzLlxuXHQgKi9cblx0cHJpdmF0ZSBkaXNwb3NlUmVmZXJlbmNlcygpIHtcblx0XHRmb3IgKGNvbnN0IHJlZmVyZW5jZSBvZiBbLi4udGhpcy5fcmVmZXJlbmNlc10pIHtcblx0XHRcdHJlZmVyZW5jZS5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVmZXJlbmNlcy5sZW5ndGggPSAwO1xuXHR9XG5cblx0LyoqXG5cdCAqIFByaXZhdGUgYXR0cmlidXRlIHRvIHRyYWNrIGlmIHRoZSB7QGxpbmtjb2RlIHN0YXJ0fVxuXHQgKiBtZXRob2QgaGFzIGJlZW4gYWxyZWFkeSBjYWxsZWQgYXQgbGVhc3Qgb25jZS5cblx0ICovXG5cdHByaXZhdGUgc3RhcnRlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdC8qKlxuXHQgKiBTdGFydCB0aGUgcHJvbXB0IHBhcnNlci5cblx0ICovXG5cdHB1YmxpYyBzdGFydCgpOiB0aGlzIHtcblx0XHQvLyBpZiBhbHJlYWR5IHN0YXJ0ZWQsIG5vdGhpbmcgdG8gZG9cblx0XHRpZiAodGhpcy5zdGFydGVkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdFx0dGhpcy5zdGFydGVkID0gdHJ1ZTtcblxuXG5cdFx0Ly8gaWYgYWxyZWFkeSBpbiB0aGUgZXJyb3Igc3RhdGUgdGhhdCBjb3VsZCBiZSBzZXRcblx0XHQvLyBpbiB0aGUgY29uc3RydWN0b3IsIHRoZW4gbm90aGluZyB0byBkb1xuXHRcdGlmICh0aGlzLmVycm9yQ29uZGl0aW9uKSB7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cblx0XHR0aGlzLnByb21wdENvbnRlbnRzUHJvdmlkZXIuc3RhcnQoKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdC8qKlxuXHQgKiBBc3NvY2lhdGVkIFVSSSBvZiB0aGUgcHJvbXB0LlxuXHQgKi9cblx0cHVibGljIGdldCB1cmkoKTogVVJJIHtcblx0XHRyZXR1cm4gdGhpcy5wcm9tcHRDb250ZW50c1Byb3ZpZGVyLnVyaTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgdGhlIHBhcmVudCBmb2xkZXIgb2YgdGhlIGZpbGUgcmVmZXJlbmNlLlxuXHQgKi9cblx0cHVibGljIGdldCBkaXJuYW1lKCkge1xuXHRcdHJldHVybiBVUkkuam9pblBhdGgodGhpcy51cmksICcuLicpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldCBhIGxpc3Qgb2YgaW1tZWRpYXRlIGNoaWxkIHJlZmVyZW5jZXMgb2YgdGhlIHByb21wdC5cblx0ICovXG5cdHB1YmxpYyBnZXQgcmVmZXJlbmNlcygpOiByZWFkb25seSBJUHJvbXB0UmVmZXJlbmNlW10ge1xuXHRcdHJldHVybiBbLi4udGhpcy5fcmVmZXJlbmNlc107XG5cdH1cblxuXHQvKipcblx0ICogR2V0IGEgbGlzdCBvZiBhbGwgcmVmZXJlbmNlcyBvZiB0aGUgcHJvbXB0LCBpbmNsdWRpbmdcblx0ICogYWxsIHBvc3NpYmxlIG5lc3RlZCByZWZlcmVuY2VzIGl0cyBjaGlsZHJlbiBtYXkgaGF2ZS5cblx0ICovXG5cdHB1YmxpYyBnZXQgYWxsUmVmZXJlbmNlcygpOiByZWFkb25seSBJUHJvbXB0UmVmZXJlbmNlW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogSVByb21wdFJlZmVyZW5jZVtdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IHJlZmVyZW5jZSBvZiB0aGlzLnJlZmVyZW5jZXMpIHtcblx0XHRcdHJlc3VsdC5wdXNoKHJlZmVyZW5jZSk7XG5cblx0XHRcdGlmIChyZWZlcmVuY2UudHlwZSA9PT0gJ2ZpbGUnKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKC4uLnJlZmVyZW5jZS5hbGxSZWZlcmVuY2VzKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldCBsaXN0IG9mIGFsbCB2YWxpZCByZWZlcmVuY2VzLlxuXHQgKi9cblx0cHVibGljIGdldCBhbGxWYWxpZFJlZmVyZW5jZXMoKTogcmVhZG9ubHkgSVByb21wdFJlZmVyZW5jZVtdIHtcblx0XHRyZXR1cm4gdGhpcy5hbGxSZWZlcmVuY2VzXG5cdFx0XHQvLyBmaWx0ZXIgb3V0IHVucmVzb2x2ZWQgcmVmZXJlbmNlc1xuXHRcdFx0LmZpbHRlcigocmVmZXJlbmNlKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHsgZXJyb3JDb25kaXRpb24gfSA9IHJlZmVyZW5jZTtcblxuXHRcdFx0XHQvLyBpbmNsdWRlIGFsbCByZWZlcmVuY2VzIHdpdGhvdXQgZXJyb3JzXG5cdFx0XHRcdGlmICghZXJyb3JDb25kaXRpb24pIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIGZpbHRlciBvdXQgZm9sZGVyIHJlZmVyZW5jZXMgZnJvbSB0aGUgbGlzdFxuXHRcdFx0XHRpZiAoZXJyb3JDb25kaXRpb24gaW5zdGFuY2VvZiBGb2xkZXJSZWZlcmVuY2UpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBpbmNsdWRlIG5vbi1wcm9tcHQgZmlsZSByZWZlcmVuY2VzXG5cdFx0XHRcdHJldHVybiAoZXJyb3JDb25kaXRpb24gaW5zdGFuY2VvZiBOb3RQcm9tcHRGaWxlKTtcblx0XHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldCBsaXN0IG9mIGFsbCB2YWxpZCBjaGlsZCByZWZlcmVuY2VzIGFzIFVSSXMuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IGFsbFZhbGlkUmVmZXJlbmNlc1VyaXMoKTogcmVhZG9ubHkgVVJJW10ge1xuXHRcdHJldHVybiB0aGlzLmFsbFZhbGlkUmVmZXJlbmNlc1xuXHRcdFx0Lm1hcChjaGlsZCA9PiBjaGlsZC51cmkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldCBsaXN0IG9mIGVycm9ycyBmb3IgdGhlIGRpcmVjdCBsaW5rcyBvZiB0aGUgY3VycmVudCByZWZlcmVuY2UuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IGVycm9ycygpOiByZWFkb25seSBSZXNvbHZlRXJyb3JbXSB7XG5cdFx0Y29uc3QgY2hpbGRFcnJvcnM6IFJlc29sdmVFcnJvcltdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IHJlZmVyZW5jZSBvZiB0aGlzLnJlZmVyZW5jZXMpIHtcblx0XHRcdGNvbnN0IHsgZXJyb3JDb25kaXRpb24gfSA9IHJlZmVyZW5jZTtcblxuXHRcdFx0aWYgKGVycm9yQ29uZGl0aW9uICYmICghKGVycm9yQ29uZGl0aW9uIGluc3RhbmNlb2YgTm90UHJvbXB0RmlsZSkpKSB7XG5cdFx0XHRcdGNoaWxkRXJyb3JzLnB1c2goZXJyb3JDb25kaXRpb24pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBjaGlsZEVycm9ycztcblx0fVxuXG5cdC8qKlxuXHQgKiBMaXN0IG9mIGFsbCBlcnJvcnMgdGhhdCBvY2N1cnJlZCB3aGlsZSByZXNvbHZpbmcgdGhlIGN1cnJlbnRcblx0ICogcmVmZXJlbmNlIGluY2x1ZGluZyBhbGwgcG9zc2libGUgZXJyb3JzIG9mIG5lc3RlZCBjaGlsZHJlbi5cblx0ICovXG5cdHB1YmxpYyBnZXQgYWxsRXJyb3JzKCk6IHJlYWRvbmx5IElSZXNvbHZlRXJyb3JbXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBJUmVzb2x2ZUVycm9yW10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgcmVmZXJlbmNlIG9mIHRoaXMucmVmZXJlbmNlcykge1xuXHRcdFx0Y29uc3QgeyBlcnJvckNvbmRpdGlvbiB9ID0gcmVmZXJlbmNlO1xuXG5cdFx0XHRpZiAoZXJyb3JDb25kaXRpb24gJiYgKCEoZXJyb3JDb25kaXRpb24gaW5zdGFuY2VvZiBOb3RQcm9tcHRGaWxlKSkpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goe1xuXHRcdFx0XHRcdG9yaWdpbmFsRXJyb3I6IGVycm9yQ29uZGl0aW9uLFxuXHRcdFx0XHRcdHBhcmVudFVyaTogdGhpcy51cmksXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyByZWN1cnNpdmVseSBjb2xsZWN0IGFsbCBwb3NzaWJsZSBlcnJvcnMgb2YgaXRzIGNoaWxkcmVuXG5cdFx0XHRyZXN1bHQucHVzaCguLi5yZWZlcmVuY2UuYWxsRXJyb3JzKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSB0b3AgbW9zdCBlcnJvciBvZiB0aGUgY3VycmVudCByZWZlcmVuY2Ugb3IgYW55IG9mIGl0c1xuXHQgKiBwb3NzaWJsZSBjaGlsZCByZWZlcmVuY2UgZXJyb3JzLlxuXHQgKi9cblx0cHVibGljIGdldCB0b3BFcnJvcigpOiBJVG9wRXJyb3IgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLmVycm9yQ29uZGl0aW9uKSB7XG5cdFx0XHRyZXR1cm4gbmV3IFRvcEVycm9yKHtcblx0XHRcdFx0ZXJyb3JTdWJqZWN0OiAncm9vdCcsXG5cdFx0XHRcdGVycm9yc0NvdW50OiAxLFxuXHRcdFx0XHRvcmlnaW5hbEVycm9yOiB0aGlzLmVycm9yQ29uZGl0aW9uLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2hpbGRFcnJvcnM6IFJlc29sdmVFcnJvcltdID0gWy4uLnRoaXMuZXJyb3JzXTtcblx0XHRjb25zdCBuZXN0ZWRFcnJvcnM6IElSZXNvbHZlRXJyb3JbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgcmVmZXJlbmNlIG9mIHRoaXMucmVmZXJlbmNlcykge1xuXHRcdFx0bmVzdGVkRXJyb3JzLnB1c2goLi4ucmVmZXJlbmNlLmFsbEVycm9ycyk7XG5cdFx0fVxuXG5cdFx0aWYgKGNoaWxkRXJyb3JzLmxlbmd0aCA9PT0gMCAmJiBuZXN0ZWRFcnJvcnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpcnN0RGlyZWN0Q2hpbGRFcnJvciA9IGNoaWxkRXJyb3JzWzBdO1xuXHRcdGNvbnN0IGZpcnN0TmVzdGVkQ2hpbGRFcnJvciA9IG5lc3RlZEVycm9yc1swXTtcblx0XHRjb25zdCBoYXNEaXJlY3RDaGlsZEVycm9yID0gKGZpcnN0RGlyZWN0Q2hpbGRFcnJvciAhPT0gdW5kZWZpbmVkKTtcblxuXHRcdGNvbnN0IGZpcnN0Q2hpbGRFcnJvciA9IChoYXNEaXJlY3RDaGlsZEVycm9yKVxuXHRcdFx0PyB7XG5cdFx0XHRcdG9yaWdpbmFsRXJyb3I6IGZpcnN0RGlyZWN0Q2hpbGRFcnJvcixcblx0XHRcdFx0cGFyZW50VXJpOiB0aGlzLnVyaSxcblx0XHRcdH1cblx0XHRcdDogZmlyc3ROZXN0ZWRDaGlsZEVycm9yO1xuXG5cdFx0Y29uc3QgdG90YWxFcnJvcnNDb3VudCA9IGNoaWxkRXJyb3JzLmxlbmd0aCArIG5lc3RlZEVycm9ycy5sZW5ndGg7XG5cblx0XHRjb25zdCBzdWJqZWN0ID0gKGhhc0RpcmVjdENoaWxkRXJyb3IpXG5cdFx0XHQ/ICdjaGlsZCdcblx0XHRcdDogJ2luZGlyZWN0LWNoaWxkJztcblxuXHRcdHJldHVybiBuZXcgVG9wRXJyb3Ioe1xuXHRcdFx0ZXJyb3JTdWJqZWN0OiBzdWJqZWN0LFxuXHRcdFx0b3JpZ2luYWxFcnJvcjogZmlyc3RDaGlsZEVycm9yLm9yaWdpbmFsRXJyb3IsXG5cdFx0XHRwYXJlbnRVcmk6IGZpcnN0Q2hpbGRFcnJvci5wYXJlbnRVcmksXG5cdFx0XHRlcnJvcnNDb3VudDogdG90YWxFcnJvcnNDb3VudCxcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDaGVjayBpZiB0aGUgY3VycmVudCByZWZlcmVuY2UgcG9pbnRzIHRvIGEgZ2l2ZW4gcmVzb3VyY2UuXG5cdCAqL1xuXHRwdWJsaWMgc2FtZVVyaShvdGhlclVyaTogVVJJKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMudXJpLnRvU3RyaW5nKCkgPT09IG90aGVyVXJpLnRvU3RyaW5nKCk7XG5cdH1cblxuXHQvKipcblx0ICogQ2hlY2sgaWYgdGhlIGN1cnJlbnQgcmVmZXJlbmNlIHBvaW50cyB0byBhIHByb21wdCBzbmlwcGV0IGZpbGUuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IGlzUHJvbXB0RmlsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gaXNQcm9tcHRGaWxlKHRoaXMudXJpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgb2JqZWN0LlxuXHQgKi9cblx0cHVibGljIG92ZXJyaWRlIHRvU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGBwcm9tcHQ6JHt0aGlzLnVyaS5wYXRofWA7XG5cdH1cblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdGlmICh0aGlzLmRpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5kaXNwb3NlUmVmZXJlbmNlcygpO1xuXHRcdHRoaXMuc3RyZWFtPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fb25VcGRhdGUuZmlyZSgpO1xuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbi8qKlxuICogUHJvbXB0IHJlZmVyZW5jZSBvYmplY3QgcmVwcmVzZW50cyBhbnkgcmVmZXJlbmNlIGluc2lkZSBwcm9tcHQgdGV4dFxuICogY29udGVudHMuIEZvciBpbnN0YW5jZSB0aGUgZmlsZSB2YXJpYWJsZShgI2ZpbGU6L3BhdGgvdG8vZmlsZS5tZGApIG9yXG4gKiBhIG1hcmtkb3duIGxpbmsoYFsjZmlsZTpmaWxlLm1kXSgvcGF0aC90by9maWxlLm1kKWApLlxuICovXG5leHBvcnQgY2xhc3MgUHJvbXB0UmVmZXJlbmNlIGV4dGVuZHMgT2JzZXJ2YWJsZURpc3Bvc2FibGUgaW1wbGVtZW50cyBJUHJvbXB0UmVmZXJlbmNlIHtcblx0cHVibGljIHJlYWRvbmx5IHJhbmdlID0gdGhpcy50b2tlbi5yYW5nZTtcblx0cHVibGljIHJlYWRvbmx5IHBhdGg6IHN0cmluZyA9IHRoaXMudG9rZW4ucGF0aDtcblx0cHVibGljIHJlYWRvbmx5IHRleHQ6IHN0cmluZyA9IHRoaXMudG9rZW4udGV4dDtcblxuXHQvKipcblx0ICogSW5zdGFuY2Ugb2YgdW5kZXJseWluZyBwcm9tcHQgcGFyc2VyIG9iamVjdC5cblx0ICovXG5cdHByaXZhdGUgcmVhZG9ubHkgcGFyc2VyOiBCYXNlUHJvbXB0UGFyc2VyPElQcm9tcHRDb250ZW50c1Byb3ZpZGVyPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHByb21wdENvbnRlbnRzUHJvdmlkZXI6IElQcm9tcHRDb250ZW50c1Byb3ZpZGVyLFxuXHRcdHB1YmxpYyByZWFkb25seSB0b2tlbjogRmlsZVJlZmVyZW5jZSB8IE1hcmtkb3duTGluayxcblx0XHRzZWVuUmVmZXJlbmNlczogc3RyaW5nW10gPSBbXSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluaXRTZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnBhcnNlciA9IHRoaXMuX3JlZ2lzdGVyKGluaXRTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0QmFzZVByb21wdFBhcnNlcixcblx0XHRcdHRoaXMucHJvbXB0Q29udGVudHNQcm92aWRlcixcblx0XHRcdHNlZW5SZWZlcmVuY2VzLFxuXHRcdCkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldCB0aGUgcmFuZ2Ugb2YgdGhlIGBsaW5rYCBwYXJ0IG9mIHRoZSByZWZlcmVuY2UuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IGxpbmtSYW5nZSgpOiBJUmFuZ2UgfCB1bmRlZmluZWQge1xuXHRcdC8vIGAjZmlsZTpgIHJlZmVyZW5jZXNcblx0XHRpZiAodGhpcy50b2tlbiBpbnN0YW5jZW9mIEZpbGVSZWZlcmVuY2UpIHtcblx0XHRcdHJldHVybiB0aGlzLnRva2VuLmRhdGFSYW5nZTtcblx0XHR9XG5cblx0XHQvLyBgbWFya2Rvd24gbGlua2AgcmVmZXJlbmNlc1xuXHRcdGlmICh0aGlzLnRva2VuIGluc3RhbmNlb2YgTWFya2Rvd25MaW5rKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy50b2tlbi5saW5rUmFuZ2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBUeXBlIG9mIHRoZSByZWZlcmVuY2UsIC0gZWl0aGVyIGEgcHJvbXB0IGAjZmlsZWAgdmFyaWFibGUsXG5cdCAqIG9yIGEgYG1hcmtkb3duIGxpbmtgIHJlZmVyZW5jZSAoYFtjYXB0aW9uXSgvcGF0aC90by9maWxlLm1kKWApLlxuXHQgKi9cblx0cHVibGljIGdldCB0eXBlKCk6ICdmaWxlJyB7XG5cdFx0aWYgKHRoaXMudG9rZW4gaW5zdGFuY2VvZiBGaWxlUmVmZXJlbmNlKSB7XG5cdFx0XHRyZXR1cm4gJ2ZpbGUnO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnRva2VuIGluc3RhbmNlb2YgTWFya2Rvd25MaW5rKSB7XG5cdFx0XHRyZXR1cm4gJ2ZpbGUnO1xuXHRcdH1cblxuXHRcdGFzc2VydE5ldmVyKFxuXHRcdFx0dGhpcy50b2tlbixcblx0XHRcdGBVbmtub3duIHRva2VuIHR5cGUgJyR7dGhpcy50b2tlbn0nLmAsXG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTdWJ0eXBlIG9mIHRoZSByZWZlcmVuY2UsIC0gZWl0aGVyIGEgcHJvbXB0IGAjZmlsZWAgdmFyaWFibGUsXG5cdCAqIG9yIGEgYG1hcmtkb3duIGxpbmtgIHJlZmVyZW5jZSAoYFtjYXB0aW9uXSgvcGF0aC90by9maWxlLm1kKWApLlxuXHQgKi9cblx0cHVibGljIGdldCBzdWJ0eXBlKCk6ICdwcm9tcHQnIHwgJ21hcmtkb3duJyB7XG5cdFx0aWYgKHRoaXMudG9rZW4gaW5zdGFuY2VvZiBGaWxlUmVmZXJlbmNlKSB7XG5cdFx0XHRyZXR1cm4gJ3Byb21wdCc7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudG9rZW4gaW5zdGFuY2VvZiBNYXJrZG93bkxpbmspIHtcblx0XHRcdHJldHVybiAnbWFya2Rvd24nO1xuXHRcdH1cblxuXHRcdGFzc2VydE5ldmVyKFxuXHRcdFx0dGhpcy50b2tlbixcblx0XHRcdGBVbmtub3duIHRva2VuIHR5cGUgJyR7dGhpcy50b2tlbn0nLmAsXG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTdGFydCBwYXJzaW5nIHRoZSByZWZlcmVuY2UgY29udGVudHMuXG5cdCAqL1xuXHRwdWJsaWMgc3RhcnQoKTogdGhpcyB7XG5cdFx0dGhpcy5wYXJzZXIuc3RhcnQoKTtcblxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN1YnNjcmliZSB0byB0aGUgYG9uVXBkYXRlYCBldmVudCB0aGF0IGlzIGZpcmVkIHdoZW4gcHJvbXB0IHRva2VucyBhcmUgdXBkYXRlZC5cblx0ICogQHBhcmFtIGNhbGxiYWNrIFRoZSBjYWxsYmFjayBmdW5jdGlvbiB0byBiZSBjYWxsZWQgb24gdXBkYXRlcy5cblx0ICovXG5cdHB1YmxpYyBvblVwZGF0ZShjYWxsYmFjazogKCkgPT4gdm9pZCk6IHRoaXMge1xuXHRcdHRoaXMucGFyc2VyLm9uVXBkYXRlKGNhbGxiYWNrKTtcblxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0cHVibGljIGdldCByZXNvbHZlRmFpbGVkKCk6IGJvb2xlYW4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnBhcnNlci5yZXNvbHZlRmFpbGVkO1xuXHR9XG5cblx0cHVibGljIGdldCBlcnJvckNvbmRpdGlvbigpOiBSZXNvbHZlRXJyb3IgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnBhcnNlci5lcnJvckNvbmRpdGlvbjtcblx0fVxuXG5cdHB1YmxpYyBnZXQgdG9wRXJyb3IoKTogSVRvcEVycm9yIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5wYXJzZXIudG9wRXJyb3I7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHVyaSgpOiBVUkkge1xuXHRcdHJldHVybiB0aGlzLnBhcnNlci51cmk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGlzUHJvbXB0RmlsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5wYXJzZXIuaXNQcm9tcHRGaWxlO1xuXHR9XG5cblx0cHVibGljIGdldCBlcnJvcnMoKTogcmVhZG9ubHkgUmVzb2x2ZUVycm9yW10ge1xuXHRcdHJldHVybiB0aGlzLnBhcnNlci5lcnJvcnM7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGFsbEVycm9ycygpOiByZWFkb25seSBJUmVzb2x2ZUVycm9yW10ge1xuXHRcdHJldHVybiB0aGlzLnBhcnNlci5hbGxFcnJvcnM7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHJlZmVyZW5jZXMoKTogcmVhZG9ubHkgSVByb21wdFJlZmVyZW5jZVtdIHtcblx0XHRyZXR1cm4gdGhpcy5wYXJzZXIucmVmZXJlbmNlcztcblx0fVxuXG5cdHB1YmxpYyBnZXQgYWxsUmVmZXJlbmNlcygpOiByZWFkb25seSBJUHJvbXB0UmVmZXJlbmNlW10ge1xuXHRcdHJldHVybiB0aGlzLnBhcnNlci5hbGxSZWZlcmVuY2VzO1xuXHR9XG5cblx0cHVibGljIGdldCBhbGxWYWxpZFJlZmVyZW5jZXMoKTogcmVhZG9ubHkgSVByb21wdFJlZmVyZW5jZVtdIHtcblx0XHRyZXR1cm4gdGhpcy5wYXJzZXIuYWxsVmFsaWRSZWZlcmVuY2VzO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHNldHRsZWQoKTogUHJvbWlzZTx0aGlzPiB7XG5cdFx0YXdhaXQgdGhpcy5wYXJzZXIuc2V0dGxlZCgpO1xuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgYWxsU2V0dGxlZCgpOiBQcm9taXNlPHRoaXM+IHtcblx0XHRhd2FpdCB0aGlzLnBhcnNlci5hbGxTZXR0bGVkKCk7XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgb2JqZWN0LlxuXHQgKi9cblx0cHVibGljIG92ZXJyaWRlIHRvU3RyaW5nKCkge1xuXHRcdHJldHVybiBgcHJvbXB0LXJlZmVyZW5jZS8ke3RoaXMudHlwZX06JHt0aGlzLnN1YnR5cGV9LyR7dGhpcy50b2tlbn1gO1xuXHR9XG59XG5cbi8qKlxuICogQSB0aW55IHV0aWxpdHkgb2JqZWN0IHRoYXQgaGVscHMgdXMgdG8gdHJhY2sgZXhpc3RlbmNlXG4gKiBvZiBhdCBsZWFzdCBvbmUgcGFyc2UgcmVzdWx0IGZyb20gdGhlIGNvbnRlbnQgcHJvdmlkZXIuXG4gKi9cbmNsYXNzIEZpcnN0UGFyc2VSZXN1bHQgZXh0ZW5kcyBEZWZlcnJlZFByb21pc2U8dm9pZD4ge1xuXHQvKipcblx0ICogUHJpdmF0ZSBhdHRyaWJ1dGUgdG8gdHJhY2sgaWYgd2UgaGF2ZVxuXHQgKiByZWNlaXZlZCBhdCBsZWFzdCBvbmUgcmVzdWx0LlxuXHQgKi9cblx0cHJpdmF0ZSBfZ290UmVzdWx0ID0gZmFsc2U7XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgd2UndmUgcmVjZWl2ZWQgYXQgbGVhc3Qgb25lIHJlc3VsdC5cblx0ICovXG5cdHB1YmxpYyBnZXQgZ290Rmlyc3RSZXN1bHQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2dvdFJlc3VsdDtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgdW5kZXJseWluZyBwcm9taXNlIHJlZmVyZW5jZS5cblx0ICovXG5cdHB1YmxpYyBnZXQgcHJvbWlzZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5wO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbXBsZXRlIHRoZSB1bmRlcmx5aW5nIHByb21pc2UuXG5cdCAqL1xuXHRwdWJsaWMgb3ZlcnJpZGUgY29tcGxldGUoKSB7XG5cdFx0dGhpcy5fZ290UmVzdWx0ID0gdHJ1ZTtcblx0XHRyZXR1cm4gc3VwZXIuY29tcGxldGUodm9pZCAwKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFdBQVc7QUFDcEIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMscUJBQXFCO0FBRzlCLFNBQVMscUJBQXFCO0FBRzlCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsVUFBVSxjQUFjO0FBQ2pDLFNBQVMsUUFBUSxtQkFBbUI7QUFFcEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBcUIsZUFBZSxvQkFBb0IsaUJBQWlCLG9CQUFvQjtBQVd0RixJQUFNLG1CQUFOLGNBQWtGLHFCQUFxQjtBQUFBLEVBb0c3RyxZQUNrQix3QkFDakIsaUJBQTJCLENBQUMsR0FDYyxzQkFDVixZQUMvQjtBQUNELFVBQU07QUFMVztBQUV5QjtBQUNWO0FBcEdqQztBQUFBO0FBQUE7QUFBQSxTQUFpQixjQUFrQyxDQUFDO0FBS3BEO0FBQUE7QUFBQTtBQUFBLFNBQWlCLFlBQVksS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBMEMvRDtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBQVEsbUJBQW1CLElBQUksaUJBQWlCO0FBdU9oRDtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBQVEsVUFBbUI7QUE5SzFCLFNBQUssVUFBVSxPQUFPLEtBQUssVUFBVSxLQUFLLEtBQUssS0FBSyxTQUFTO0FBSzdELFFBQUksZUFBZSxTQUFTLEtBQUssSUFBSSxJQUFJLEdBQUc7QUFDM0MscUJBQWUsS0FBSyxLQUFLLElBQUksSUFBSTtBQUVqQyxXQUFLLGtCQUFrQixJQUFJ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
