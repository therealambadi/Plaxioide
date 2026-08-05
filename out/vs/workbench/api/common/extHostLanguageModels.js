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
import { AsyncIterableObject, AsyncIterableSource } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { CancellationError, transformErrorForSerialization, transformErrorFromSerialization } from "../../../base/common/errors.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Iterable } from "../../../base/common/iterator.js";
import { toDisposable } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { ExtensionIdentifier, ExtensionIdentifierMap, ExtensionIdentifierSet } from "../../../platform/extensions/common/extensions.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { Progress } from "../../../platform/progress/common/progress.js";
import { INTERNAL_AUTH_PROVIDER_PREFIX } from "../../services/authentication/common/authentication.js";
import { checkProposedApiEnabled } from "../../services/extensions/common/extensions.js";
import { MainContext } from "./extHost.protocol.js";
import { IExtHostAuthentication } from "./extHostAuthentication.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import * as typeConvert from "./extHostTypeConverters.js";
import * as extHostTypes from "./extHostTypes.js";
import { SerializableObjectWithBuffers } from "../../services/extensions/common/proxyIdentifier.js";
const IExtHostLanguageModels = createDecorator("IExtHostLanguageModels");
class LanguageModelResponseStream {
  constructor(option, stream) {
    this.option = option;
    this.stream = new AsyncIterableSource();
    this.stream = stream ?? new AsyncIterableSource();
  }
}
class LanguageModelResponse {
  constructor() {
    this._responseStreams = /* @__PURE__ */ new Map();
    this._defaultStream = new AsyncIterableSource();
    this._isDone = false;
    const that = this;
    this.apiObject = {
      // result: promise,
      get stream() {
        return that._defaultStream.asyncIterable;
      },
      get text() {
        return AsyncIterableObject.map(that._defaultStream.asyncIterable, (part) => {
          if (part instanceof extHostTypes.LanguageModelTextPart) {
            return part.value;
          } else {
            return void 0;
          }
        }).coalesce();
      }
    };
  }
  *_streams() {
    if (this._responseStreams.size > 0) {
      for (const [, value] of this._responseStreams) {
        yield value.stream;
      }
    } else {
      yield this._defaultStream;
    }
  }
  handleFragment(fragment) {
    if (this._isDone) {
      return;
    }
    let res = this._responseStreams.get(fragment.index);
    if (!res) {
      if (this._responseStreams.size === 0) {
        res = new LanguageModelResponseStream(fragment.index, this._defaultStream);
      } else {
        res = new LanguageModelResponseStream(fragment.index);
      }
      this._responseStreams.set(fragment.index, res);
    }
    let out;
    if (fragment.part.type === "text") {
      out = new extHostTypes.LanguageModelTextPart(fragment.part.value);
    } else {
      out = new extHostTypes.LanguageModelToolCallPart(fragment.part.toolCallId, fragment.part.name, fragment.part.parameters);
    }
    res.stream.emitOne(out);
  }
  reject(err) {
    this._isDone = true;
    for (const stream of this._streams()) {
      stream.reject(err);
    }
  }
  resolve() {
    this._isDone = true;
    for (const stream of this._streams()) {
      stream.resolve();
    }
  }
}
let ExtHostLanguageModels = class {
  constructor(extHostRpc, _logService, _extHostAuthentication) {
    this._logService = _logService;
    this._extHostAuthentication = _extHostAuthentication;
    this._onDidChangeModelAccess = new Emitter();
    this._onDidChangeProviders = new Emitter();
    this.onDidChangeProviders = this._onDidChangeProviders.event;
    this._languageModels = /* @__PURE__ */ new Map();
    this._allLanguageModelData = /* @__PURE__ */ new Map();
    // these are ALL models, not just the one in this EH
    this._modelAccessList = new ExtensionIdentifierMap();
    this._pendingRequest = /* @__PURE__ */ new Map();
    this._ignoredFileProviders = /* @__PURE__ */ new Map();
    this._languageAccessInformationExtensions = /* @__PURE__ */ new Set();
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadLanguageModels);
  }
  dispose() {
    this._onDidChangeModelAccess.dispose();
    this._onDidChangeProviders.dispose();
  }
  registerLanguageModel(extension, identifier, provider, metadata) {
    const handle = ExtHostLanguageModels._idPool++;
    this._languageModels.set(handle, { extension: extension.identifier, provider, languageModelId: identifier });
    let auth;
    if (metadata.auth) {
      auth = {
        providerLabel: extension.displayName || extension.name,
        accountLabel: typeof metadata.auth === "object" ? metadata.auth.label : void 0
      };
    }
    this._proxy.$registerLanguageModelProvider(handle, `${ExtensionIdentifier.toKey(extension.identifier)}/${identifier}`, {
      extension: extension.identifier,
      id: identifier,
      vendor: metadata.vendor ?? ExtensionIdentifier.toKey(extension.identifier),
      name: metadata.name ?? "",
      family: metadata.family ?? "",
      version: metadata.version,
      maxInputTokens: metadata.maxInputTokens,
      maxOutputTokens: metadata.maxOutputTokens,
      auth,
      targetExtensions: metadata.extensions,
      isDefault: metadata.isDefault,
      isUserSelectable: metadata.isUserSelectable,
      capabilities: metadata.capabilities
    });
    const responseReceivedListener = provider.onDidReceiveLanguageModelResponse2?.(({ extensionId, participant, tokenCount }) => {
      this._proxy.$whenLanguageModelChatRequestMade(identifier, new ExtensionIdentifier(extensionId), participant, tokenCount);
    });
    return toDisposable(() => {
      this._languageModels.delete(handle);
      this._proxy.$unregisterProvider(handle);
      responseReceivedListener?.dispose();
    });
  }
  async $startChatRequest(handle, requestId, from, messages, options, token) {
    const data = this._languageModels.get(handle);
    if (!data) {
      throw new Error("Provider not found");
    }
    const progress = new Progress(async (fragment) => {
      if (token.isCancellationRequested) {
        this._logService.warn(`[CHAT](${data.extension.value}) CANNOT send progress because the REQUEST IS CANCELLED`);
        return;
      }
      let part;
      if (fragment.part instanceof extHostTypes.LanguageModelToolCallPart) {
        part = { type: "tool_use", name: fragment.part.name, parameters: fragment.part.input, toolCallId: fragment.part.callId };
      } else if (fragment.part instanceof extHostTypes.LanguageModelTextPart) {
        part = { type: "text", value: fragment.part.value };
      }
      if (!part) {
        this._logService.warn(`[CHAT](${data.extension.value}) UNKNOWN part ${JSON.stringify(fragment)}`);
        return;
      }
      this._proxy.$reportResponsePart(requestId, { index: fragment.index, part });
    });
    let value;
    try {
      if (data.provider.provideLanguageModelResponse2) {
        value = data.provider.provideLanguageModelResponse2(
          messages.value.map(typeConvert.LanguageModelChatMessage2.to),
          options,
          ExtensionIdentifier.toKey(from),
          progress,
          token
        );
      } else {
        value = data.provider.provideLanguageModelResponse(
          messages.value.map(typeConvert.LanguageModelChatMessage2.to),
          options,
          ExtensionIdentifier.toKey(from),
          progress,
          token
        );
      }
    } catch (err) {
      throw err;
    }
    Promise.resolve(value).then(() => {
      this._proxy.$reportResponseDone(requestId, void 0);
    }, (err) => {
      this._proxy.$reportResponseDone(requestId, transformErrorForSerialization(err));
    });
  }
  //#region --- token counting
  $provideTokenLength(handle, value, token) {
    const data = this._languageModels.get(handle);
    if (!data) {
      return Promise.resolve(0);
    }
    return Promise.resolve(data.provider.provideTokenCount(value, token));
  }
  //#region --- making request
  $acceptChatModelMetadata(data) {
    if (data.added) {
      for (const { identifier, metadata } of data.added) {
        this._allLanguageModelData.set(identifier, { metadata, apiObjects: new ExtensionIdentifierMap() });
      }
    }
    if (data.removed) {
      for (const id of data.removed) {
        this._allLanguageModelData.delete(id);
        for (const [key, value] of this._pendingRequest) {
          if (value.languageModelId === id) {
            value.res.reject(new CancellationError());
            this._pendingRequest.delete(key);
          }
        }
      }
    }
    data.added?.forEach((added) => this._fakeAuthPopulate(added.metadata));
    this._onDidChangeProviders.fire(void 0);
  }
  async getDefaultLanguageModel(extension) {
    const defaultModelId = Iterable.find(this._allLanguageModelData.entries(), ([, value]) => !!value.metadata.isDefault)?.[0];
    if (!defaultModelId) {
      return;
    }
    return this.getLanguageModelByIdentifier(extension, defaultModelId);
  }
  async getLanguageModelByIdentifier(extension, identifier) {
    const data = this._allLanguageModelData.get(identifier);
    if (!data) {
      return;
    }
    if (this._isUsingAuth(extension.identifier, data.metadata)) {
      await this._fakeAuthPopulate(data.metadata);
    }
    let apiObject = data.apiObjects.get(extension.identifier);
    if (!apiObject) {
      const that = this;
      apiObject = {
        id: data.metadata.id,
        vendor: data.metadata.vendor,
        family: data.metadata.family,
        version: data.metadata.version,
        name: data.metadata.name,
        capabilities: {
          supportsImageToText: data.metadata.capabilities?.vision ?? false,
          supportsToolCalling: data.metadata.capabilities?.toolCalling ?? false
        },
        maxInputTokens: data.metadata.maxInputTokens,
        countTokens(text, token) {
          if (!that._allLanguageModelData.has(identifier)) {
            throw extHostTypes.LanguageModelError.NotFound(identifier);
          }
          return that._computeTokenLength(identifier, text, token ?? CancellationToken.None);
        },
        sendRequest(messages, options, token) {
          if (!that._allLanguageModelData.has(identifier)) {
            throw extHostTypes.LanguageModelError.NotFound(identifier);
          }
          return that._sendChatRequest(extension, identifier, messages, options ?? {}, token ?? CancellationToken.None);
        }
      };
      Object.freeze(apiObject);
      data.apiObjects.set(extension.identifier, apiObject);
    }
    return apiObject;
  }
  async selectLanguageModels(extension, selector) {
    const models = await this._proxy.$selectChatModels({ ...selector, extension: extension.identifier });
    const result = [];
    for (const identifier of models) {
      const model = await this.getLanguageModelByIdentifier(extension, identifier);
      if (model) {
        result.push(model);
      }
    }
    return result;
  }
  async _sendChatRequest(extension, languageModelId, messages, options, token) {
    const internalMessages = this._convertMessages(extension, messages);
    const from = extension.identifier;
    const metadata = this._allLanguageModelData.get(languageModelId)?.metadata;
    if (!metadata || !this._allLanguageModelData.has(languageModelId)) {
      throw extHostTypes.LanguageModelError.NotFound(`Language model '${languageModelId}' is unknown.`);
    }
    if (this._isUsingAuth(from, metadata)) {
      const success = await this._getAuthAccess(extension, { identifier: metadata.extension, displayName: metadata.auth.providerLabel }, options.justification, false);
      if (!success || !this._modelAccessList.get(from)?.has(metadata.extension)) {
        throw extHostTypes.LanguageModelError.NoPermissions(`Language model '${languageModelId}' cannot be used by '${from.value}'.`);
      }
    }
    const requestId = Math.random() * 1e6 | 0;
    const res = new LanguageModelResponse();
    this._pendingRequest.set(requestId, { languageModelId, res });
    try {
      await this._proxy.$tryStartChatRequest(from, languageModelId, requestId, new SerializableObjectWithBuffers(internalMessages), options, token);
    } catch (error) {
      this._pendingRequest.delete(requestId);
      throw extHostTypes.LanguageModelError.tryDeserialize(error) ?? error;
    }
    return res.apiObject;
  }
  _convertMessages(extension, messages) {
    const internalMessages = [];
    for (const message of messages) {
      if (message.role === extHostTypes.LanguageModelChatMessageRole.System) {
        checkProposedApiEnabled(extension, "languageModelSystem");
      }
      internalMessages.push(typeConvert.LanguageModelChatMessage2.from(message));
    }
    return internalMessages;
  }
  async $acceptResponsePart(requestId, chunk) {
    const data = this._pendingRequest.get(requestId);
    if (data) {
      data.res.handleFragment(chunk);
    }
  }
  async $acceptResponseDone(requestId, error) {
    const data = this._pendingRequest.get(requestId);
    if (!data) {
      return;
    }
    this._pendingRequest.delete(requestId);
    if (error) {
      data.res.reject(extHostTypes.LanguageModelError.tryDeserialize(error) ?? transformErrorFromSerialization(error));
    } else {
      data.res.resolve();
    }
  }
  // BIG HACK: Using AuthenticationProviders to check access to Language Models
  async _getAuthAccess(from, to, justification, silent) {
    const providerId = INTERNAL_AUTH_PROVIDER_PREFIX + to.identifier.value;
    const session = await this._extHostAuthentication.getSession(from, providerId, [], { silent: true });
    if (session) {
      this.$updateModelAccesslist([{ from: from.identifier, to: to.identifier, enabled: true }]);
      return true;
    }
    if (silent) {
      return false;
    }
    try {
      const detail = justification ? localize("chatAccessWithJustification", "Justification: {1}", to.displayName, justification) : void 0;
      await this._extHostAuthentication.getSession(from, providerId, [], { forceNewSession: { detail } });
      this.$updateModelAccesslist([{ from: from.identifier, to: to.identifier, enabled: true }]);
      return true;
    } catch (err) {
      return false;
    }
  }
  _isUsingAuth(from, toMetadata) {
    return !!toMetadata.auth && !ExtensionIdentifier.equals(toMetadata.extension, from);
  }
  async _fakeAuthPopulate(metadata) {
    if (!metadata.auth) {
      return;
    }
    for (const from of this._languageAccessInformationExtensions) {
      try {
        await this._getAuthAccess(from, { identifier: metadata.extension, displayName: "" }, void 0, true);
      } catch (err) {
        this._logService.error("Fake Auth request failed");
        this._logService.error(err);
      }
    }
  }
  async _computeTokenLength(languageModelId, value, token) {
    const data = this._allLanguageModelData.get(languageModelId);
    if (!data) {
      throw extHostTypes.LanguageModelError.NotFound(`Language model '${languageModelId}' is unknown.`);
    }
    const local = Iterable.find(this._languageModels.values(), (candidate) => candidate.languageModelId === languageModelId);
    if (local) {
      return local.provider.provideTokenCount(value, token);
    }
    return this._proxy.$countTokens(languageModelId, typeof value === "string" ? value : typeConvert.LanguageModelChatMessage2.from(value), token);
  }
  $updateModelAccesslist(data) {
    const updated = new Array();
    for (const { from, to, enabled } of data) {
      const set = this._modelAccessList.get(from) ?? new ExtensionIdentifierSet();
      const oldValue = set.has(to);
      if (oldValue !== enabled) {
        if (enabled) {
          set.add(to);
        } else {
          set.delete(to);
        }
        this._modelAccessList.set(from, set);
        const newItem = { from, to };
        updated.push(newItem);
        this._onDidChangeModelAccess.fire(newItem);
      }
    }
  }
  createLanguageModelAccessInformation(from) {
    this._languageAccessInformationExtensions.add(from);
    const that = this;
    const _onDidChangeAccess = Event.signal(Event.filter(this._onDidChangeModelAccess.event, (e) => ExtensionIdentifier.equals(e.from, from.identifier)));
    const _onDidAddRemove = Event.signal(this._onDidChangeProviders.event);
    return {
      get onDidChange() {
        return Event.any(_onDidChangeAccess, _onDidAddRemove);
      },
      canSendRequest(chat) {
        let metadata;
        out: for (const [_, value] of that._allLanguageModelData) {
          for (const candidate of value.apiObjects.values()) {
            if (candidate === chat) {
              metadata = value.metadata;
              break out;
            }
          }
        }
        if (!metadata) {
          return void 0;
        }
        if (!that._isUsingAuth(from.identifier, metadata)) {
          return true;
        }
        const list = that._modelAccessList.get(from.identifier);
        if (!list) {
          return void 0;
        }
        return list.has(metadata.extension);
      }
    };
  }
  fileIsIgnored(extension, uri, token) {
    checkProposedApiEnabled(extension, "chatParticipantAdditions");
    return this._proxy.$fileIsIgnored(uri, token);
  }
  async $isFileIgnored(handle, uri, token) {
    const provider = this._ignoredFileProviders.get(handle);
    if (!provider) {
      throw new Error("Unknown LanguageModelIgnoredFileProvider");
    }
    return await provider.provideFileIgnored(URI.revive(uri), token) ?? false;
  }
  registerIgnoredFileProvider(extension, provider) {
    checkProposedApiEnabled(extension, "chatParticipantPrivate");
    const handle = ExtHostLanguageModels._idPool++;
    this._proxy.$registerFileIgnoreProvider(handle);
    this._ignoredFileProviders.set(handle, provider);
    return toDisposable(() => {
      this._proxy.$unregisterFileIgnoreProvider(handle);
      this._ignoredFileProviders.delete(handle);
    });
  }
};
ExtHostLanguageModels._idPool = 1;
ExtHostLanguageModels = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IExtHostAuthentication)
], ExtHostLanguageModels);
export {
  ExtHostLanguageModels,
  IExtHostLanguageModels
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0TGFuZ3VhZ2VNb2RlbHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgdHlwZSAqIGFzIHZzY29kZSBmcm9tICd2c2NvZGUnO1xuaW1wb3J0IHsgQXN5bmNJdGVyYWJsZU9iamVjdCwgQXN5bmNJdGVyYWJsZVNvdXJjZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvbkVycm9yLCBTZXJpYWxpemVkRXJyb3IsIHRyYW5zZm9ybUVycm9yRm9yU2VyaWFsaXphdGlvbiwgdHJhbnNmb3JtRXJyb3JGcm9tU2VyaWFsaXphdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciwgRXh0ZW5zaW9uSWRlbnRpZmllck1hcCwgRXh0ZW5zaW9uSWRlbnRpZmllclNldCwgSUV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgUHJvZ3Jlc3MgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSUNoYXRNZXNzYWdlLCBJQ2hhdFJlc3BvbnNlRnJhZ21lbnQsIElDaGF0UmVzcG9uc2VQYXJ0LCBJTGFuZ3VhZ2VNb2RlbENoYXRNZXRhZGF0YSB9IGZyb20gJy4uLy4uL2NvbnRyaWIvY2hhdC9jb21tb24vbGFuZ3VhZ2VNb2RlbHMuanMnO1xuaW1wb3J0IHsgSU5URVJOQUxfQVVUSF9QUk9WSURFUl9QUkVGSVggfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9hdXRoZW50aWNhdGlvbi9jb21tb24vYXV0aGVudGljYXRpb24uanMnO1xuaW1wb3J0IHsgY2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEV4dEhvc3RMYW5ndWFnZU1vZGVsc1NoYXBlLCBNYWluQ29udGV4dCwgTWFpblRocmVhZExhbmd1YWdlTW9kZWxzU2hhcGUgfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RBdXRoZW50aWNhdGlvbiB9IGZyb20gJy4vZXh0SG9zdEF1dGhlbnRpY2F0aW9uLmpzJztcbmltcG9ydCB7IElFeHRIb3N0UnBjU2VydmljZSB9IGZyb20gJy4vZXh0SG9zdFJwY1NlcnZpY2UuanMnO1xuaW1wb3J0ICogYXMgdHlwZUNvbnZlcnQgZnJvbSAnLi9leHRIb3N0VHlwZUNvbnZlcnRlcnMuanMnO1xuaW1wb3J0ICogYXMgZXh0SG9zdFR5cGVzIGZyb20gJy4vZXh0SG9zdFR5cGVzLmpzJztcbmltcG9ydCB7IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vcHJveHlJZGVudGlmaWVyLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJRXh0SG9zdExhbmd1YWdlTW9kZWxzIGV4dGVuZHMgRXh0SG9zdExhbmd1YWdlTW9kZWxzIHsgfVxuXG5leHBvcnQgY29uc3QgSUV4dEhvc3RMYW5ndWFnZU1vZGVscyA9IGNyZWF0ZURlY29yYXRvcjxJRXh0SG9zdExhbmd1YWdlTW9kZWxzPignSUV4dEhvc3RMYW5ndWFnZU1vZGVscycpO1xuXG50eXBlIExhbmd1YWdlTW9kZWxEYXRhID0ge1xuXHRyZWFkb25seSBsYW5ndWFnZU1vZGVsSWQ6IHN0cmluZztcblx0cmVhZG9ubHkgZXh0ZW5zaW9uOiBFeHRlbnNpb25JZGVudGlmaWVyO1xuXHRyZWFkb25seSBwcm92aWRlcjogdnNjb2RlLkNoYXRSZXNwb25zZVByb3ZpZGVyO1xufTtcblxuY2xhc3MgTGFuZ3VhZ2VNb2RlbFJlc3BvbnNlU3RyZWFtIHtcblxuXHRyZWFkb25seSBzdHJlYW0gPSBuZXcgQXN5bmNJdGVyYWJsZVNvdXJjZTx2c2NvZGUuTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0IHwgdnNjb2RlLkxhbmd1YWdlTW9kZWxUb29sQ2FsbFBhcnQ+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgb3B0aW9uOiBudW1iZXIsXG5cdFx0c3RyZWFtPzogQXN5bmNJdGVyYWJsZVNvdXJjZTx2c2NvZGUuTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0IHwgdnNjb2RlLkxhbmd1YWdlTW9kZWxUb29sQ2FsbFBhcnQ+XG5cdCkge1xuXHRcdHRoaXMuc3RyZWFtID0gc3RyZWFtID8/IG5ldyBBc3luY0l0ZXJhYmxlU291cmNlPHZzY29kZS5MYW5ndWFnZU1vZGVsVGV4dFBhcnQgfCB2c2NvZGUuTGFuZ3VhZ2VNb2RlbFRvb2xDYWxsUGFydD4oKTtcblx0fVxufVxuXG5jbGFzcyBMYW5ndWFnZU1vZGVsUmVzcG9uc2Uge1xuXG5cdHJlYWRvbmx5IGFwaU9iamVjdDogdnNjb2RlLkxhbmd1YWdlTW9kZWxDaGF0UmVzcG9uc2U7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcmVzcG9uc2VTdHJlYW1zID0gbmV3IE1hcDxudW1iZXIsIExhbmd1YWdlTW9kZWxSZXNwb25zZVN0cmVhbT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZGVmYXVsdFN0cmVhbSA9IG5ldyBBc3luY0l0ZXJhYmxlU291cmNlPHZzY29kZS5MYW5ndWFnZU1vZGVsVGV4dFBhcnQgfCB2c2NvZGUuTGFuZ3VhZ2VNb2RlbFRvb2xDYWxsUGFydD4oKTtcblx0cHJpdmF0ZSBfaXNEb25lOiBib29sZWFuID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHR0aGlzLmFwaU9iamVjdCA9IHtcblx0XHRcdC8vIHJlc3VsdDogcHJvbWlzZSxcblx0XHRcdGdldCBzdHJlYW0oKSB7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll9kZWZhdWx0U3RyZWFtLmFzeW5jSXRlcmFibGU7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHRleHQoKSB7XG5cdFx0XHRcdHJldHVybiBBc3luY0l0ZXJhYmxlT2JqZWN0Lm1hcCh0aGF0Ll9kZWZhdWx0U3RyZWFtLmFzeW5jSXRlcmFibGUsIHBhcnQgPT4ge1xuXHRcdFx0XHRcdGlmIChwYXJ0IGluc3RhbmNlb2YgZXh0SG9zdFR5cGVzLkxhbmd1YWdlTW9kZWxUZXh0UGFydCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHBhcnQudmFsdWU7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KS5jb2FsZXNjZSgpO1xuXHRcdFx0fSxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSAqIF9zdHJlYW1zKCkge1xuXHRcdGlmICh0aGlzLl9yZXNwb25zZVN0cmVhbXMuc2l6ZSA+IDApIHtcblx0XHRcdGZvciAoY29uc3QgWywgdmFsdWVdIG9mIHRoaXMuX3Jlc3BvbnNlU3RyZWFtcykge1xuXHRcdFx0XHR5aWVsZCB2YWx1ZS5zdHJlYW07XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHlpZWxkIHRoaXMuX2RlZmF1bHRTdHJlYW07XG5cdFx0fVxuXHR9XG5cblx0aGFuZGxlRnJhZ21lbnQoZnJhZ21lbnQ6IElDaGF0UmVzcG9uc2VGcmFnbWVudCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pc0RvbmUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bGV0IHJlcyA9IHRoaXMuX3Jlc3BvbnNlU3RyZWFtcy5nZXQoZnJhZ21lbnQuaW5kZXgpO1xuXHRcdGlmICghcmVzKSB7XG5cdFx0XHRpZiAodGhpcy5fcmVzcG9uc2VTdHJlYW1zLnNpemUgPT09IDApIHtcblx0XHRcdFx0Ly8gdGhlIGZpcnN0IHJlc3BvbnNlIGNsYWltcyB0aGUgZGVmYXVsdCByZXNwb25zZVxuXHRcdFx0XHRyZXMgPSBuZXcgTGFuZ3VhZ2VNb2RlbFJlc3BvbnNlU3RyZWFtKGZyYWdtZW50LmluZGV4LCB0aGlzLl9kZWZhdWx0U3RyZWFtKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlcyA9IG5ldyBMYW5ndWFnZU1vZGVsUmVzcG9uc2VTdHJlYW0oZnJhZ21lbnQuaW5kZXgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fcmVzcG9uc2VTdHJlYW1zLnNldChmcmFnbWVudC5pbmRleCwgcmVzKTtcblx0XHR9XG5cblx0XHRsZXQgb3V0OiB2c2NvZGUuTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0IHwgdnNjb2RlLkxhbmd1YWdlTW9kZWxUb29sQ2FsbFBhcnQ7XG5cdFx0aWYgKGZyYWdtZW50LnBhcnQudHlwZSA9PT0gJ3RleHQnKSB7XG5cdFx0XHRvdXQgPSBuZXcgZXh0SG9zdFR5cGVzLkxhbmd1YWdlTW9kZWxUZXh0UGFydChmcmFnbWVudC5wYXJ0LnZhbHVlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0b3V0ID0gbmV3IGV4dEhvc3RUeXBlcy5MYW5ndWFnZU1vZGVsVG9vbENhbGxQYXJ0KGZyYWdtZW50LnBhcnQudG9vbENhbGxJZCwgZnJhZ21lbnQucGFydC5uYW1lLCBmcmFnbWVudC5wYXJ0LnBhcmFtZXRlcnMpO1xuXHRcdH1cblx0XHRyZXMuc3RyZWFtLmVtaXRPbmUob3V0KTtcblx0fVxuXG5cblx0cmVqZWN0KGVycjogRXJyb3IpOiB2b2lkIHtcblx0XHR0aGlzLl9pc0RvbmUgPSB0cnVlO1xuXHRcdGZvciAoY29uc3Qgc3RyZWFtIG9mIHRoaXMuX3N0cmVhbXMoKSkge1xuXHRcdFx0c3RyZWFtLnJlamVjdChlcnIpO1xuXHRcdH1cblx0fVxuXG5cdHJlc29sdmUoKTogdm9pZCB7XG5cdFx0dGhpcy5faXNEb25lID0gdHJ1ZTtcblx0XHRmb3IgKGNvbnN0IHN0cmVhbSBvZiB0aGlzLl9zdHJlYW1zKCkpIHtcblx0XHRcdHN0cmVhbS5yZXNvbHZlKCk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRIb3N0TGFuZ3VhZ2VNb2RlbHMgaW1wbGVtZW50cyBFeHRIb3N0TGFuZ3VhZ2VNb2RlbHNTaGFwZSB7XG5cblx0ZGVjbGFyZSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2lkUG9vbCA9IDE7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IE1haW5UaHJlYWRMYW5ndWFnZU1vZGVsc1NoYXBlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZU1vZGVsQWNjZXNzID0gbmV3IEVtaXR0ZXI8eyBmcm9tOiBFeHRlbnNpb25JZGVudGlmaWVyOyB0bzogRXh0ZW5zaW9uSWRlbnRpZmllciB9PigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVByb3ZpZGVycyA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUHJvdmlkZXJzID0gdGhpcy5fb25EaWRDaGFuZ2VQcm92aWRlcnMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VNb2RlbHMgPSBuZXcgTWFwPG51bWJlciwgTGFuZ3VhZ2VNb2RlbERhdGE+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2FsbExhbmd1YWdlTW9kZWxEYXRhID0gbmV3IE1hcDxzdHJpbmcsIHsgbWV0YWRhdGE6IElMYW5ndWFnZU1vZGVsQ2hhdE1ldGFkYXRhOyBhcGlPYmplY3RzOiBFeHRlbnNpb25JZGVudGlmaWVyTWFwPHZzY29kZS5MYW5ndWFnZU1vZGVsQ2hhdD4gfT4oKTsgLy8gdGhlc2UgYXJlIEFMTCBtb2RlbHMsIG5vdCBqdXN0IHRoZSBvbmUgaW4gdGhpcyBFSFxuXHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbEFjY2Vzc0xpc3QgPSBuZXcgRXh0ZW5zaW9uSWRlbnRpZmllck1hcDxFeHRlbnNpb25JZGVudGlmaWVyU2V0PigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wZW5kaW5nUmVxdWVzdCA9IG5ldyBNYXA8bnVtYmVyLCB7IGxhbmd1YWdlTW9kZWxJZDogc3RyaW5nOyByZXM6IExhbmd1YWdlTW9kZWxSZXNwb25zZSB9PigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pZ25vcmVkRmlsZVByb3ZpZGVycyA9IG5ldyBNYXA8bnVtYmVyLCB2c2NvZGUuTGFuZ3VhZ2VNb2RlbElnbm9yZWRGaWxlUHJvdmlkZXI+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRIb3N0UnBjU2VydmljZSBleHRIb3N0UnBjOiBJRXh0SG9zdFJwY1NlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRXh0SG9zdEF1dGhlbnRpY2F0aW9uIHByaXZhdGUgcmVhZG9ubHkgX2V4dEhvc3RBdXRoZW50aWNhdGlvbjogSUV4dEhvc3RBdXRoZW50aWNhdGlvbixcblx0KSB7XG5cdFx0dGhpcy5fcHJveHkgPSBleHRIb3N0UnBjLmdldFByb3h5KE1haW5Db250ZXh0Lk1haW5UaHJlYWRMYW5ndWFnZU1vZGVscyk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlTW9kZWxBY2Nlc3MuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlUHJvdmlkZXJzLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHJlZ2lzdGVyTGFuZ3VhZ2VNb2RlbChleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgaWRlbnRpZmllcjogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLkNoYXRSZXNwb25zZVByb3ZpZGVyLCBtZXRhZGF0YTogdnNjb2RlLkNoYXRSZXNwb25zZVByb3ZpZGVyTWV0YWRhdGEpOiBJRGlzcG9zYWJsZSB7XG5cblx0XHRjb25zdCBoYW5kbGUgPSBFeHRIb3N0TGFuZ3VhZ2VNb2RlbHMuX2lkUG9vbCsrO1xuXHRcdHRoaXMuX2xhbmd1YWdlTW9kZWxzLnNldChoYW5kbGUsIHsgZXh0ZW5zaW9uOiBleHRlbnNpb24uaWRlbnRpZmllciwgcHJvdmlkZXIsIGxhbmd1YWdlTW9kZWxJZDogaWRlbnRpZmllciB9KTtcblx0XHRsZXQgYXV0aDtcblx0XHRpZiAobWV0YWRhdGEuYXV0aCkge1xuXHRcdFx0YXV0aCA9IHtcblx0XHRcdFx0cHJvdmlkZXJMYWJlbDogZXh0ZW5zaW9uLmRpc3BsYXlOYW1lIHx8IGV4dGVuc2lvbi5uYW1lLFxuXHRcdFx0XHRhY2NvdW50TGFiZWw6IHR5cGVvZiBtZXRhZGF0YS5hdXRoID09PSAnb2JqZWN0JyA/IG1ldGFkYXRhLmF1dGgubGFiZWwgOiB1bmRlZmluZWRcblx0XHRcdH07XG5cdFx0fVxuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3Rlckxhbmd1YWdlTW9kZWxQcm92aWRlcihoYW5kbGUsIGAke0V4dGVuc2lvbklkZW50aWZpZXIudG9LZXkoZXh0ZW5zaW9uLmlkZW50aWZpZXIpfS8ke2lkZW50aWZpZXJ9YCwge1xuXHRcdFx0ZXh0ZW5zaW9uOiBleHRlbnNpb24uaWRlbnRpZmllcixcblx0XHRcdGlkOiBpZGVudGlmaWVyLFxuXHRcdFx0dmVuZG9yOiBtZXRhZGF0YS52ZW5kb3IgPz8gRXh0ZW5zaW9uSWRlbnRpZmllci50b0tleShleHRlbnNpb24uaWRlbnRpZmllciksXG5cdFx0XHRuYW1lOiBtZXRhZGF0YS5uYW1lID8/ICcnLFxuXHRcdFx0ZmFtaWx5OiBtZXRhZGF0YS5mYW1pbHkgPz8gJycsXG5cdFx0XHR2ZXJzaW9uOiBtZXRhZGF0YS52ZXJzaW9uLFxuXHRcdFx0bWF4SW5wdXRUb2tlbnM6IG1ldGFkYXRhLm1heElucHV0VG9rZW5zLFxuXHRcdFx0bWF4T3V0cHV0VG9rZW5zOiBtZXRhZGF0YS5tYXhPdXRwdXRUb2tlbnMsXG5cdFx0XHRhdXRoLFxuXHRcdFx0dGFyZ2V0RXh0ZW5zaW9uczogbWV0YWRhdGEuZXh0ZW5zaW9ucyxcblx0XHRcdGlzRGVmYXVsdDogbWV0YWRhdGEuaXNEZWZhdWx0LFxuXHRcdFx0aXNVc2VyU2VsZWN0YWJsZTogbWV0YWRhdGEuaXNVc2VyU2VsZWN0YWJsZSxcblx0XHRcdGNhcGFiaWxpdGllczogbWV0YWRhdGEuY2FwYWJpbGl0aWVzLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcmVzcG9uc2VSZWNlaXZlZExpc3RlbmVyID0gcHJvdmlkZXIub25EaWRSZWNlaXZlTGFuZ3VhZ2VNb2RlbFJlc3BvbnNlMj8uKCh7IGV4dGVuc2lvbklkLCBwYXJ0aWNpcGFudCwgdG9rZW5Db3VudCB9KSA9PiB7XG5cdFx0XHR0aGlzLl9wcm94eS4kd2hlbkxhbmd1YWdlTW9kZWxDaGF0UmVxdWVzdE1hZGUoaWRlbnRpZmllciwgbmV3IEV4dGVuc2lvbklkZW50aWZpZXIoZXh0ZW5zaW9uSWQpLCBwYXJ0aWNpcGFudCwgdG9rZW5Db3VudCk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuX2xhbmd1YWdlTW9kZWxzLmRlbGV0ZShoYW5kbGUpO1xuXHRcdFx0dGhpcy5fcHJveHkuJHVucmVnaXN0ZXJQcm92aWRlcihoYW5kbGUpO1xuXHRcdFx0cmVzcG9uc2VSZWNlaXZlZExpc3RlbmVyPy5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyAkc3RhcnRDaGF0UmVxdWVzdChoYW5kbGU6IG51bWJlciwgcmVxdWVzdElkOiBudW1iZXIsIGZyb206IEV4dGVuc2lvbklkZW50aWZpZXIsIG1lc3NhZ2VzOiBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVyczxJQ2hhdE1lc3NhZ2VbXT4sIG9wdGlvbnM6IHZzY29kZS5MYW5ndWFnZU1vZGVsQ2hhdFJlcXVlc3RPcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBkYXRhID0gdGhpcy5fbGFuZ3VhZ2VNb2RlbHMuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Byb3ZpZGVyIG5vdCBmb3VuZCcpO1xuXHRcdH1cblx0XHRjb25zdCBwcm9ncmVzcyA9IG5ldyBQcm9ncmVzczx2c2NvZGUuQ2hhdFJlc3BvbnNlRnJhZ21lbnQyPihhc3luYyBmcmFnbWVudCA9PiB7XG5cdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS53YXJuKGBbQ0hBVF0oJHtkYXRhLmV4dGVuc2lvbi52YWx1ZX0pIENBTk5PVCBzZW5kIHByb2dyZXNzIGJlY2F1c2UgdGhlIFJFUVVFU1QgSVMgQ0FOQ0VMTEVEYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bGV0IHBhcnQ6IElDaGF0UmVzcG9uc2VQYXJ0IHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKGZyYWdtZW50LnBhcnQgaW5zdGFuY2VvZiBleHRIb3N0VHlwZXMuTGFuZ3VhZ2VNb2RlbFRvb2xDYWxsUGFydCkge1xuXHRcdFx0XHRwYXJ0ID0geyB0eXBlOiAndG9vbF91c2UnLCBuYW1lOiBmcmFnbWVudC5wYXJ0Lm5hbWUsIHBhcmFtZXRlcnM6IGZyYWdtZW50LnBhcnQuaW5wdXQsIHRvb2xDYWxsSWQ6IGZyYWdtZW50LnBhcnQuY2FsbElkIH07XG5cdFx0XHR9IGVsc2UgaWYgKGZyYWdtZW50LnBhcnQgaW5zdGFuY2VvZiBleHRIb3N0VHlwZXMuTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0KSB7XG5cdFx0XHRcdHBhcnQgPSB7IHR5cGU6ICd0ZXh0JywgdmFsdWU6IGZyYWdtZW50LnBhcnQudmFsdWUgfTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFwYXJ0KSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybihgW0NIQVRdKCR7ZGF0YS5leHRlbnNpb24udmFsdWV9KSBVTktOT1dOIHBhcnQgJHtKU09OLnN0cmluZ2lmeShmcmFnbWVudCl9YCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fcHJveHkuJHJlcG9ydFJlc3BvbnNlUGFydChyZXF1ZXN0SWQsIHsgaW5kZXg6IGZyYWdtZW50LmluZGV4LCBwYXJ0IH0pO1xuXHRcdH0pO1xuXG5cdFx0bGV0IHZhbHVlOiBhbnk7XG5cblx0XHR0cnkge1xuXHRcdFx0aWYgKGRhdGEucHJvdmlkZXIucHJvdmlkZUxhbmd1YWdlTW9kZWxSZXNwb25zZTIpIHtcblx0XHRcdFx0dmFsdWUgPSBkYXRhLnByb3ZpZGVyLnByb3ZpZGVMYW5ndWFnZU1vZGVsUmVzcG9uc2UyKFxuXHRcdFx0XHRcdG1lc3NhZ2VzLnZhbHVlLm1hcCh0eXBlQ29udmVydC5MYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2UyLnRvKSxcblx0XHRcdFx0XHRvcHRpb25zLFxuXHRcdFx0XHRcdEV4dGVuc2lvbklkZW50aWZpZXIudG9LZXkoZnJvbSksXG5cdFx0XHRcdFx0cHJvZ3Jlc3MsXG5cdFx0XHRcdFx0dG9rZW5cblx0XHRcdFx0KTtcblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dmFsdWUgPSBkYXRhLnByb3ZpZGVyLnByb3ZpZGVMYW5ndWFnZU1vZGVsUmVzcG9uc2UoXG5cdFx0XHRcdFx0bWVzc2FnZXMudmFsdWUubWFwKHR5cGVDb252ZXJ0Lkxhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZTIudG8pLFxuXHRcdFx0XHRcdG9wdGlvbnMsXG5cdFx0XHRcdFx0RXh0ZW5zaW9uSWRlbnRpZmllci50b0tleShmcm9tKSxcblx0XHRcdFx0XHRwcm9ncmVzcyxcblx0XHRcdFx0XHR0b2tlblxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHQvLyBzeW5jaHJvbm91c2x5IGZhaWxlZFxuXHRcdFx0dGhyb3cgZXJyO1xuXHRcdH1cblxuXHRcdFByb21pc2UucmVzb2x2ZSh2YWx1ZSkudGhlbigoKSA9PiB7XG5cdFx0XHR0aGlzLl9wcm94eS4kcmVwb3J0UmVzcG9uc2VEb25lKHJlcXVlc3RJZCwgdW5kZWZpbmVkKTtcblx0XHR9LCBlcnIgPT4ge1xuXHRcdFx0dGhpcy5fcHJveHkuJHJlcG9ydFJlc3BvbnNlRG9uZShyZXF1ZXN0SWQsIHRyYW5zZm9ybUVycm9yRm9yU2VyaWFsaXphdGlvbihlcnIpKTtcblx0XHR9KTtcblx0fVxuXG5cdC8vI3JlZ2lvbiAtLS0gdG9rZW4gY291bnRpbmdcblxuXHQkcHJvdmlkZVRva2VuTGVuZ3RoKGhhbmRsZTogbnVtYmVyLCB2YWx1ZTogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPG51bWJlcj4ge1xuXHRcdGNvbnN0IGRhdGEgPSB0aGlzLl9sYW5ndWFnZU1vZGVscy5nZXQoaGFuZGxlKTtcblx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoMCk7XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoZGF0YS5wcm92aWRlci5wcm92aWRlVG9rZW5Db3VudCh2YWx1ZSwgdG9rZW4pKTtcblx0fVxuXG5cblx0Ly8jcmVnaW9uIC0tLSBtYWtpbmcgcmVxdWVzdFxuXG5cdCRhY2NlcHRDaGF0TW9kZWxNZXRhZGF0YShkYXRhOiB7IGFkZGVkPzogeyBpZGVudGlmaWVyOiBzdHJpbmc7IG1ldGFkYXRhOiBJTGFuZ3VhZ2VNb2RlbENoYXRNZXRhZGF0YSB9W10gfCB1bmRlZmluZWQ7IHJlbW92ZWQ/OiBzdHJpbmdbXSB8IHVuZGVmaW5lZCB9KTogdm9pZCB7XG5cdFx0aWYgKGRhdGEuYWRkZWQpIHtcblx0XHRcdGZvciAoY29uc3QgeyBpZGVudGlmaWVyLCBtZXRhZGF0YSB9IG9mIGRhdGEuYWRkZWQpIHtcblx0XHRcdFx0dGhpcy5fYWxsTGFuZ3VhZ2VNb2RlbERhdGEuc2V0KGlkZW50aWZpZXIsIHsgbWV0YWRhdGEsIGFwaU9iamVjdHM6IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyTWFwKCkgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChkYXRhLnJlbW92ZWQpIHtcblx0XHRcdGZvciAoY29uc3QgaWQgb2YgZGF0YS5yZW1vdmVkKSB7XG5cdFx0XHRcdC8vIGNsZWFuIHVwXG5cdFx0XHRcdHRoaXMuX2FsbExhbmd1YWdlTW9kZWxEYXRhLmRlbGV0ZShpZCk7XG5cblx0XHRcdFx0Ly8gY2FuY2VsIHBlbmRpbmcgcmVxdWVzdHMgZm9yIHRoaXMgbW9kZWxcblx0XHRcdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgdGhpcy5fcGVuZGluZ1JlcXVlc3QpIHtcblx0XHRcdFx0XHRpZiAodmFsdWUubGFuZ3VhZ2VNb2RlbElkID09PSBpZCkge1xuXHRcdFx0XHRcdFx0dmFsdWUucmVzLnJlamVjdChuZXcgQ2FuY2VsbGF0aW9uRXJyb3IoKSk7XG5cdFx0XHRcdFx0XHR0aGlzLl9wZW5kaW5nUmVxdWVzdC5kZWxldGUoa2V5KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBUT0RPQGpyaWVrZW5AVHlsZXJMZW9uaGFyZHQgLSB0aGlzIGlzIGEgdGVtcG9yYXJ5IGhhY2sgdG8gcG9wdWxhdGUgdGhlIGF1dGggcHJvdmlkZXJzXG5cdFx0ZGF0YS5hZGRlZD8uZm9yRWFjaChhZGRlZCA9PiB0aGlzLl9mYWtlQXV0aFBvcHVsYXRlKGFkZGVkLm1ldGFkYXRhKSk7XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZVByb3ZpZGVycy5maXJlKHVuZGVmaW5lZCk7XG5cdH1cblxuXHRhc3luYyBnZXREZWZhdWx0TGFuZ3VhZ2VNb2RlbChleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbik6IFByb21pc2U8dnNjb2RlLkxhbmd1YWdlTW9kZWxDaGF0IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZGVmYXVsdE1vZGVsSWQgPSBJdGVyYWJsZS5maW5kKHRoaXMuX2FsbExhbmd1YWdlTW9kZWxEYXRhLmVudHJpZXMoKSwgKFssIHZhbHVlXSkgPT4gISF2YWx1ZS5tZXRhZGF0YS5pc0RlZmF1bHQpPy5bMF07XG5cdFx0aWYgKCFkZWZhdWx0TW9kZWxJZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmdldExhbmd1YWdlTW9kZWxCeUlkZW50aWZpZXIoZXh0ZW5zaW9uLCBkZWZhdWx0TW9kZWxJZCk7XG5cdH1cblxuXHRhc3luYyBnZXRMYW5ndWFnZU1vZGVsQnlJZGVudGlmaWVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBpZGVudGlmaWVyOiBzdHJpbmcpOiBQcm9taXNlPHZzY29kZS5MYW5ndWFnZU1vZGVsQ2hhdCB8IHVuZGVmaW5lZD4ge1xuXG5cdFx0Y29uc3QgZGF0YSA9IHRoaXMuX2FsbExhbmd1YWdlTW9kZWxEYXRhLmdldChpZGVudGlmaWVyKTtcblx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdC8vIG1vZGVsIGdvbmU/IGlzIHRoaXMgYW4gZXJyb3Igb24gdXM/XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gbWFrZSBzdXJlIGF1dGggaW5mb3JtYXRpb24gaXMgY29ycmVjdFxuXHRcdGlmICh0aGlzLl9pc1VzaW5nQXV0aChleHRlbnNpb24uaWRlbnRpZmllciwgZGF0YS5tZXRhZGF0YSkpIHtcblx0XHRcdGF3YWl0IHRoaXMuX2Zha2VBdXRoUG9wdWxhdGUoZGF0YS5tZXRhZGF0YSk7XG5cdFx0fVxuXG5cdFx0bGV0IGFwaU9iamVjdCA9IGRhdGEuYXBpT2JqZWN0cy5nZXQoZXh0ZW5zaW9uLmlkZW50aWZpZXIpO1xuXHRcdGlmICghYXBpT2JqZWN0KSB7XG5cdFx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRcdGFwaU9iamVjdCA9IHtcblx0XHRcdFx0aWQ6IGRhdGEubWV0YWRhdGEuaWQsXG5cdFx0XHRcdHZlbmRvcjogZGF0YS5tZXRhZGF0YS52ZW5kb3IsXG5cdFx0XHRcdGZhbWlseTogZGF0YS5tZXRhZGF0YS5mYW1pbHksXG5cdFx0XHRcdHZlcnNpb246IGRhdGEubWV0YWRhdGEudmVyc2lvbixcblx0XHRcdFx0bmFtZTogZGF0YS5tZXRhZGF0YS5uYW1lLFxuXHRcdFx0XHRjYXBhYmlsaXRpZXM6IHtcblx0XHRcdFx0XHRzdXBwb3J0c0ltYWdlVG9UZXh0OiBkYXRhLm1ldGFkYXRhLmNhcGFiaWxpdGllcz8udmlzaW9uID8/IGZhbHNlLFxuXHRcdFx0XHRcdHN1cHBvcnRzVG9vbENhbGxpbmc6IGRhdGEubWV0YWRhdGEuY2FwYWJpbGl0aWVzPy50b29sQ2FsbGluZyA/PyBmYWxzZSxcblx0XHRcdFx0fSxcblx0XHRcdFx0bWF4SW5wdXRUb2tlbnM6IGRhdGEubWV0YWRhdGEubWF4SW5wdXRUb2tlbnMsXG5cdFx0XHRcdGNvdW50VG9rZW5zKHRleHQsIHRva2VuKSB7XG5cdFx0XHRcdFx0aWYgKCF0aGF0Ll9hbGxMYW5ndWFnZU1vZGVsRGF0YS5oYXMoaWRlbnRpZmllcikpIHtcblx0XHRcdFx0XHRcdHRocm93IGV4dEhvc3RUeXBlcy5MYW5ndWFnZU1vZGVsRXJyb3IuTm90Rm91bmQoaWRlbnRpZmllcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0aGF0Ll9jb21wdXRlVG9rZW5MZW5ndGgoaWRlbnRpZmllciwgdGV4dCwgdG9rZW4gPz8gQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHNlbmRSZXF1ZXN0KG1lc3NhZ2VzLCBvcHRpb25zLCB0b2tlbikge1xuXHRcdFx0XHRcdGlmICghdGhhdC5fYWxsTGFuZ3VhZ2VNb2RlbERhdGEuaGFzKGlkZW50aWZpZXIpKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBleHRIb3N0VHlwZXMuTGFuZ3VhZ2VNb2RlbEVycm9yLk5vdEZvdW5kKGlkZW50aWZpZXIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdGhhdC5fc2VuZENoYXRSZXF1ZXN0KGV4dGVuc2lvbiwgaWRlbnRpZmllciwgbWVzc2FnZXMsIG9wdGlvbnMgPz8ge30sIHRva2VuID8/IENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHRPYmplY3QuZnJlZXplKGFwaU9iamVjdCk7XG5cdFx0XHRkYXRhLmFwaU9iamVjdHMuc2V0KGV4dGVuc2lvbi5pZGVudGlmaWVyLCBhcGlPYmplY3QpO1xuXHRcdH1cblxuXHRcdHJldHVybiBhcGlPYmplY3Q7XG5cdH1cblxuXHRhc3luYyBzZWxlY3RMYW5ndWFnZU1vZGVscyhleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgc2VsZWN0b3I6IHZzY29kZS5MYW5ndWFnZU1vZGVsQ2hhdFNlbGVjdG9yKSB7XG5cblx0XHQvLyB0aGlzIHRyaWdnZXJzIGV4dGVuc2lvbiBhY3RpdmF0aW9uXG5cdFx0Y29uc3QgbW9kZWxzID0gYXdhaXQgdGhpcy5fcHJveHkuJHNlbGVjdENoYXRNb2RlbHMoeyAuLi5zZWxlY3RvciwgZXh0ZW5zaW9uOiBleHRlbnNpb24uaWRlbnRpZmllciB9KTtcblxuXHRcdGNvbnN0IHJlc3VsdDogdnNjb2RlLkxhbmd1YWdlTW9kZWxDaGF0W10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgaWRlbnRpZmllciBvZiBtb2RlbHMpIHtcblx0XHRcdGNvbnN0IG1vZGVsID0gYXdhaXQgdGhpcy5nZXRMYW5ndWFnZU1vZGVsQnlJZGVudGlmaWVyKGV4dGVuc2lvbiwgaWRlbnRpZmllcik7XG5cdFx0XHRpZiAobW9kZWwpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2gobW9kZWwpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9zZW5kQ2hhdFJlcXVlc3QoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGxhbmd1YWdlTW9kZWxJZDogc3RyaW5nLCBtZXNzYWdlczogdnNjb2RlLkxhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZTJbXSwgb3B0aW9uczogdnNjb2RlLkxhbmd1YWdlTW9kZWxDaGF0UmVxdWVzdE9wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikge1xuXG5cdFx0Y29uc3QgaW50ZXJuYWxNZXNzYWdlczogSUNoYXRNZXNzYWdlW10gPSB0aGlzLl9jb252ZXJ0TWVzc2FnZXMoZXh0ZW5zaW9uLCBtZXNzYWdlcyk7XG5cblx0XHRjb25zdCBmcm9tID0gZXh0ZW5zaW9uLmlkZW50aWZpZXI7XG5cdFx0Y29uc3QgbWV0YWRhdGEgPSB0aGlzLl9hbGxMYW5ndWFnZU1vZGVsRGF0YS5nZXQobGFuZ3VhZ2VNb2RlbElkKT8ubWV0YWRhdGE7XG5cblx0XHRpZiAoIW1ldGFkYXRhIHx8ICF0aGlzLl9hbGxMYW5ndWFnZU1vZGVsRGF0YS5oYXMobGFuZ3VhZ2VNb2RlbElkKSkge1xuXHRcdFx0dGhyb3cgZXh0SG9zdFR5cGVzLkxhbmd1YWdlTW9kZWxFcnJvci5Ob3RGb3VuZChgTGFuZ3VhZ2UgbW9kZWwgJyR7bGFuZ3VhZ2VNb2RlbElkfScgaXMgdW5rbm93bi5gKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5faXNVc2luZ0F1dGgoZnJvbSwgbWV0YWRhdGEpKSB7XG5cdFx0XHRjb25zdCBzdWNjZXNzID0gYXdhaXQgdGhpcy5fZ2V0QXV0aEFjY2VzcyhleHRlbnNpb24sIHsgaWRlbnRpZmllcjogbWV0YWRhdGEuZXh0ZW5zaW9uLCBkaXNwbGF5TmFtZTogbWV0YWRhdGEuYXV0aC5wcm92aWRlckxhYmVsIH0sIG9wdGlvbnMuanVzdGlmaWNhdGlvbiwgZmFsc2UpO1xuXG5cdFx0XHRpZiAoIXN1Y2Nlc3MgfHwgIXRoaXMuX21vZGVsQWNjZXNzTGlzdC5nZXQoZnJvbSk/LmhhcyhtZXRhZGF0YS5leHRlbnNpb24pKSB7XG5cdFx0XHRcdHRocm93IGV4dEhvc3RUeXBlcy5MYW5ndWFnZU1vZGVsRXJyb3IuTm9QZXJtaXNzaW9ucyhgTGFuZ3VhZ2UgbW9kZWwgJyR7bGFuZ3VhZ2VNb2RlbElkfScgY2Fubm90IGJlIHVzZWQgYnkgJyR7ZnJvbS52YWx1ZX0nLmApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHJlcXVlc3RJZCA9IChNYXRoLnJhbmRvbSgpICogMWU2KSB8IDA7XG5cdFx0Y29uc3QgcmVzID0gbmV3IExhbmd1YWdlTW9kZWxSZXNwb25zZSgpO1xuXHRcdHRoaXMuX3BlbmRpbmdSZXF1ZXN0LnNldChyZXF1ZXN0SWQsIHsgbGFuZ3VhZ2VNb2RlbElkLCByZXMgfSk7XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5fcHJveHkuJHRyeVN0YXJ0Q2hhdFJlcXVlc3QoZnJvbSwgbGFuZ3VhZ2VNb2RlbElkLCByZXF1ZXN0SWQsIG5ldyBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVycyhpbnRlcm5hbE1lc3NhZ2VzKSwgb3B0aW9ucywgdG9rZW4pO1xuXG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8vIGVycm9yJ2luZyBoZXJlIG1lYW5zIHRoYXQgdGhlIHJlcXVlc3QgY291bGQgTk9UIGJlIHN0YXJ0ZWQvbWFkZSwgZS5nLiB3cm9uZyBtb2RlbCwgbm8gYWNjZXNzLCBldGMsIGJ1dFxuXHRcdFx0Ly8gbGF0ZXIgdGhlIHJlc3BvbnNlIGNhbiBmYWlsIGFzIHdlbGwuIFRob3NlIGZhaWx1cmVzIGFyZSBjb21tdW5pY2F0ZWQgdmlhIHRoZSBzdHJlYW0tb2JqZWN0XG5cdFx0XHR0aGlzLl9wZW5kaW5nUmVxdWVzdC5kZWxldGUocmVxdWVzdElkKTtcblx0XHRcdHRocm93IGV4dEhvc3RUeXBlcy5MYW5ndWFnZU1vZGVsRXJyb3IudHJ5RGVzZXJpYWxpemUoZXJyb3IpID8/IGVycm9yO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXMuYXBpT2JqZWN0O1xuXHR9XG5cblx0cHJpdmF0ZSBfY29udmVydE1lc3NhZ2VzKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBtZXNzYWdlczogdnNjb2RlLkxhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZTJbXSkge1xuXHRcdGNvbnN0IGludGVybmFsTWVzc2FnZXM6IElDaGF0TWVzc2FnZVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBtZXNzYWdlIG9mIG1lc3NhZ2VzKSB7XG5cdFx0XHRpZiAobWVzc2FnZS5yb2xlIGFzIG51bWJlciA9PT0gZXh0SG9zdFR5cGVzLkxhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZVJvbGUuU3lzdGVtKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ2xhbmd1YWdlTW9kZWxTeXN0ZW0nKTtcblx0XHRcdH1cblx0XHRcdGludGVybmFsTWVzc2FnZXMucHVzaCh0eXBlQ29udmVydC5MYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2UyLmZyb20obWVzc2FnZSkpO1xuXHRcdH1cblx0XHRyZXR1cm4gaW50ZXJuYWxNZXNzYWdlcztcblx0fVxuXG5cdGFzeW5jICRhY2NlcHRSZXNwb25zZVBhcnQocmVxdWVzdElkOiBudW1iZXIsIGNodW5rOiBJQ2hhdFJlc3BvbnNlRnJhZ21lbnQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBkYXRhID0gdGhpcy5fcGVuZGluZ1JlcXVlc3QuZ2V0KHJlcXVlc3RJZCk7XG5cdFx0aWYgKGRhdGEpIHtcblx0XHRcdGRhdGEucmVzLmhhbmRsZUZyYWdtZW50KGNodW5rKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyAkYWNjZXB0UmVzcG9uc2VEb25lKHJlcXVlc3RJZDogbnVtYmVyLCBlcnJvcjogU2VyaWFsaXplZEVycm9yIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGF0YSA9IHRoaXMuX3BlbmRpbmdSZXF1ZXN0LmdldChyZXF1ZXN0SWQpO1xuXHRcdGlmICghZGF0YSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9wZW5kaW5nUmVxdWVzdC5kZWxldGUocmVxdWVzdElkKTtcblx0XHRpZiAoZXJyb3IpIHtcblx0XHRcdC8vIHdlIGVycm9yIHRoZSBzdHJlYW0gYmVjYXVzZSB0aGF0J3MgdGhlIG9ubHkgd2F5IHRvIHNpZ25hbFxuXHRcdFx0Ly8gdGhhdCB0aGUgcmVxdWVzdCBoYXMgZmFpbGVkXG5cdFx0XHRkYXRhLnJlcy5yZWplY3QoZXh0SG9zdFR5cGVzLkxhbmd1YWdlTW9kZWxFcnJvci50cnlEZXNlcmlhbGl6ZShlcnJvcikgPz8gdHJhbnNmb3JtRXJyb3JGcm9tU2VyaWFsaXphdGlvbihlcnJvcikpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkYXRhLnJlcy5yZXNvbHZlKCk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gQklHIEhBQ0s6IFVzaW5nIEF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzIHRvIGNoZWNrIGFjY2VzcyB0byBMYW5ndWFnZSBNb2RlbHNcblx0cHJpdmF0ZSBhc3luYyBfZ2V0QXV0aEFjY2Vzcyhmcm9tOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHRvOiB7IGlkZW50aWZpZXI6IEV4dGVuc2lvbklkZW50aWZpZXI7IGRpc3BsYXlOYW1lOiBzdHJpbmcgfSwganVzdGlmaWNhdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkLCBzaWxlbnQ6IGJvb2xlYW4gfCB1bmRlZmluZWQpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHQvLyBUaGlzIG5lZWRzIHRvIGJlIGRvbmUgaW4gYm90aCBNYWluVGhyZWFkICYgRXh0SG9zdCBDaGF0UHJvdmlkZXJcblx0XHRjb25zdCBwcm92aWRlcklkID0gSU5URVJOQUxfQVVUSF9QUk9WSURFUl9QUkVGSVggKyB0by5pZGVudGlmaWVyLnZhbHVlO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBhd2FpdCB0aGlzLl9leHRIb3N0QXV0aGVudGljYXRpb24uZ2V0U2Vzc2lvbihmcm9tLCBwcm92aWRlcklkLCBbXSwgeyBzaWxlbnQ6IHRydWUgfSk7XG5cblx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0dGhpcy4kdXBkYXRlTW9kZWxBY2Nlc3NsaXN0KFt7IGZyb206IGZyb20uaWRlbnRpZmllciwgdG86IHRvLmlkZW50aWZpZXIsIGVuYWJsZWQ6IHRydWUgfV0pO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKHNpbGVudCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBkZXRhaWwgPSBqdXN0aWZpY2F0aW9uXG5cdFx0XHRcdD8gbG9jYWxpemUoJ2NoYXRBY2Nlc3NXaXRoSnVzdGlmaWNhdGlvbicsIFwiSnVzdGlmaWNhdGlvbjogezF9XCIsIHRvLmRpc3BsYXlOYW1lLCBqdXN0aWZpY2F0aW9uKVxuXHRcdFx0XHQ6IHVuZGVmaW5lZDtcblx0XHRcdGF3YWl0IHRoaXMuX2V4dEhvc3RBdXRoZW50aWNhdGlvbi5nZXRTZXNzaW9uKGZyb20sIHByb3ZpZGVySWQsIFtdLCB7IGZvcmNlTmV3U2Vzc2lvbjogeyBkZXRhaWwgfSB9KTtcblx0XHRcdHRoaXMuJHVwZGF0ZU1vZGVsQWNjZXNzbGlzdChbeyBmcm9tOiBmcm9tLmlkZW50aWZpZXIsIHRvOiB0by5pZGVudGlmaWVyLCBlbmFibGVkOiB0cnVlIH1dKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHQvLyBpZ25vcmVcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9pc1VzaW5nQXV0aChmcm9tOiBFeHRlbnNpb25JZGVudGlmaWVyLCB0b01ldGFkYXRhOiBJTGFuZ3VhZ2VNb2RlbENoYXRNZXRhZGF0YSk6IHRvTWV0YWRhdGEgaXMgSUxhbmd1YWdlTW9kZWxDaGF0TWV0YWRhdGEgJiB7IGF1dGg6IE5vbk51bGxhYmxlPElMYW5ndWFnZU1vZGVsQ2hhdE1ldGFkYXRhWydhdXRoJ10+IH0ge1xuXHRcdC8vIElmIHRoZSAndG8nIGV4dGVuc2lvbiB1c2VzIGFuIGF1dGggY2hlY2tcblx0XHRyZXR1cm4gISF0b01ldGFkYXRhLmF1dGhcblx0XHRcdC8vIEFuZCB3ZSdyZSBhc2tpbmcgZnJvbSBhIGRpZmZlcmVudCBleHRlbnNpb25cblx0XHRcdCYmICFFeHRlbnNpb25JZGVudGlmaWVyLmVxdWFscyh0b01ldGFkYXRhLmV4dGVuc2lvbiwgZnJvbSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9mYWtlQXV0aFBvcHVsYXRlKG1ldGFkYXRhOiBJTGFuZ3VhZ2VNb2RlbENoYXRNZXRhZGF0YSk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0aWYgKCFtZXRhZGF0YS5hdXRoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBmcm9tIG9mIHRoaXMuX2xhbmd1YWdlQWNjZXNzSW5mb3JtYXRpb25FeHRlbnNpb25zKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9nZXRBdXRoQWNjZXNzKGZyb20sIHsgaWRlbnRpZmllcjogbWV0YWRhdGEuZXh0ZW5zaW9uLCBkaXNwbGF5TmFtZTogJycgfSwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKCdGYWtlIEF1dGggcmVxdWVzdCBmYWlsZWQnKTtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihlcnIpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2NvbXB1dGVUb2tlbkxlbmd0aChsYW5ndWFnZU1vZGVsSWQ6IHN0cmluZywgdmFsdWU6IHN0cmluZyB8IHZzY29kZS5MYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2UyLCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxudW1iZXI+IHtcblxuXHRcdGNvbnN0IGRhdGEgPSB0aGlzLl9hbGxMYW5ndWFnZU1vZGVsRGF0YS5nZXQobGFuZ3VhZ2VNb2RlbElkKTtcblx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdHRocm93IGV4dEhvc3RUeXBlcy5MYW5ndWFnZU1vZGVsRXJyb3IuTm90Rm91bmQoYExhbmd1YWdlIG1vZGVsICcke2xhbmd1YWdlTW9kZWxJZH0nIGlzIHVua25vd24uYCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbG9jYWwgPSBJdGVyYWJsZS5maW5kKHRoaXMuX2xhbmd1YWdlTW9kZWxzLnZhbHVlcygpLCBjYW5kaWRhdGUgPT4gY2FuZGlkYXRlLmxhbmd1YWdlTW9kZWxJZCA9PT0gbGFuZ3VhZ2VNb2RlbElkKTtcblx0XHRpZiAobG9jYWwpIHtcblx0XHRcdC8vIHN0YXkgaW5zaWRlIHRoZSBFSFxuXHRcdFx0cmV0dXJuIGxvY2FsLnByb3ZpZGVyLnByb3ZpZGVUb2tlbkNvdW50KHZhbHVlLCB0b2tlbik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LiRjb3VudFRva2VucyhsYW5ndWFnZU1vZGVsSWQsICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnID8gdmFsdWUgOiB0eXBlQ29udmVydC5MYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2UyLmZyb20odmFsdWUpKSwgdG9rZW4pO1xuXHR9XG5cblx0JHVwZGF0ZU1vZGVsQWNjZXNzbGlzdChkYXRhOiB7IGZyb206IEV4dGVuc2lvbklkZW50aWZpZXI7IHRvOiBFeHRlbnNpb25JZGVudGlmaWVyOyBlbmFibGVkOiBib29sZWFuIH1bXSk6IHZvaWQge1xuXHRcdGNvbnN0IHVwZGF0ZWQgPSBuZXcgQXJyYXk8eyBmcm9tOiBFeHRlbnNpb25JZGVudGlmaWVyOyB0bzogRXh0ZW5zaW9uSWRlbnRpZmllciB9PigpO1xuXHRcdGZvciAoY29uc3QgeyBmcm9tLCB0bywgZW5hYmxlZCB9IG9mIGRhdGEpIHtcblx0XHRcdGNvbnN0IHNldCA9IHRoaXMuX21vZGVsQWNjZXNzTGlzdC5nZXQoZnJvbSkgPz8gbmV3IEV4dGVuc2lvbklkZW50aWZpZXJTZXQoKTtcblx0XHRcdGNvbnN0IG9sZFZhbHVlID0gc2V0Lmhhcyh0byk7XG5cdFx0XHRpZiAob2xkVmFsdWUgIT09IGVuYWJsZWQpIHtcblx0XHRcdFx0aWYgKGVuYWJsZWQpIHtcblx0XHRcdFx0XHRzZXQuYWRkKHRvKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzZXQuZGVsZXRlKHRvKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9tb2RlbEFjY2Vzc0xpc3Quc2V0KGZyb20sIHNldCk7XG5cdFx0XHRcdGNvbnN0IG5ld0l0ZW0gPSB7IGZyb20sIHRvIH07XG5cdFx0XHRcdHVwZGF0ZWQucHVzaChuZXdJdGVtKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VNb2RlbEFjY2Vzcy5maXJlKG5ld0l0ZW0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlQWNjZXNzSW5mb3JtYXRpb25FeHRlbnNpb25zID0gbmV3IFNldDxSZWFkb25seTxJRXh0ZW5zaW9uRGVzY3JpcHRpb24+PigpO1xuXG5cdGNyZWF0ZUxhbmd1YWdlTW9kZWxBY2Nlc3NJbmZvcm1hdGlvbihmcm9tOiBSZWFkb25seTxJRXh0ZW5zaW9uRGVzY3JpcHRpb24+KTogdnNjb2RlLkxhbmd1YWdlTW9kZWxBY2Nlc3NJbmZvcm1hdGlvbiB7XG5cblx0XHR0aGlzLl9sYW5ndWFnZUFjY2Vzc0luZm9ybWF0aW9uRXh0ZW5zaW9ucy5hZGQoZnJvbSk7XG5cblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRjb25zdCBfb25EaWRDaGFuZ2VBY2Nlc3MgPSBFdmVudC5zaWduYWwoRXZlbnQuZmlsdGVyKHRoaXMuX29uRGlkQ2hhbmdlTW9kZWxBY2Nlc3MuZXZlbnQsIGUgPT4gRXh0ZW5zaW9uSWRlbnRpZmllci5lcXVhbHMoZS5mcm9tLCBmcm9tLmlkZW50aWZpZXIpKSk7XG5cdFx0Y29uc3QgX29uRGlkQWRkUmVtb3ZlID0gRXZlbnQuc2lnbmFsKHRoaXMuX29uRGlkQ2hhbmdlUHJvdmlkZXJzLmV2ZW50KTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRnZXQgb25EaWRDaGFuZ2UoKSB7XG5cdFx0XHRcdHJldHVybiBFdmVudC5hbnkoX29uRGlkQ2hhbmdlQWNjZXNzLCBfb25EaWRBZGRSZW1vdmUpO1xuXHRcdFx0fSxcblx0XHRcdGNhblNlbmRSZXF1ZXN0KGNoYXQ6IHZzY29kZS5MYW5ndWFnZU1vZGVsQ2hhdCk6IGJvb2xlYW4gfCB1bmRlZmluZWQge1xuXG5cdFx0XHRcdGxldCBtZXRhZGF0YTogSUxhbmd1YWdlTW9kZWxDaGF0TWV0YWRhdGEgfCB1bmRlZmluZWQ7XG5cblx0XHRcdFx0b3V0OiBmb3IgKGNvbnN0IFtfLCB2YWx1ZV0gb2YgdGhhdC5fYWxsTGFuZ3VhZ2VNb2RlbERhdGEpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGNhbmRpZGF0ZSBvZiB2YWx1ZS5hcGlPYmplY3RzLnZhbHVlcygpKSB7XG5cdFx0XHRcdFx0XHRpZiAoY2FuZGlkYXRlID09PSBjaGF0KSB7XG5cdFx0XHRcdFx0XHRcdG1ldGFkYXRhID0gdmFsdWUubWV0YWRhdGE7XG5cdFx0XHRcdFx0XHRcdGJyZWFrIG91dDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFtZXRhZGF0YSkge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCF0aGF0Ll9pc1VzaW5nQXV0aChmcm9tLmlkZW50aWZpZXIsIG1ldGFkYXRhKSkge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgbGlzdCA9IHRoYXQuX21vZGVsQWNjZXNzTGlzdC5nZXQoZnJvbS5pZGVudGlmaWVyKTtcblx0XHRcdFx0aWYgKCFsaXN0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbGlzdC5oYXMobWV0YWRhdGEuZXh0ZW5zaW9uKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0ZmlsZUlzSWdub3JlZChleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgdXJpOiB2c2NvZGUuVXJpLCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnY2hhdFBhcnRpY2lwYW50QWRkaXRpb25zJyk7XG5cblx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJGZpbGVJc0lnbm9yZWQodXJpLCB0b2tlbik7XG5cdH1cblxuXHRhc3luYyAkaXNGaWxlSWdub3JlZChoYW5kbGU6IG51bWJlciwgdXJpOiBVcmlDb21wb25lbnRzLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuX2lnbm9yZWRGaWxlUHJvdmlkZXJzLmdldChoYW5kbGUpO1xuXHRcdGlmICghcHJvdmlkZXIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignVW5rbm93biBMYW5ndWFnZU1vZGVsSWdub3JlZEZpbGVQcm92aWRlcicpO1xuXHRcdH1cblxuXHRcdHJldHVybiAoYXdhaXQgcHJvdmlkZXIucHJvdmlkZUZpbGVJZ25vcmVkKFVSSS5yZXZpdmUodXJpKSwgdG9rZW4pKSA/PyBmYWxzZTtcblx0fVxuXG5cdHJlZ2lzdGVySWdub3JlZEZpbGVQcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgcHJvdmlkZXI6IHZzY29kZS5MYW5ndWFnZU1vZGVsSWdub3JlZEZpbGVQcm92aWRlcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdjaGF0UGFydGljaXBhbnRQcml2YXRlJyk7XG5cblx0XHRjb25zdCBoYW5kbGUgPSBFeHRIb3N0TGFuZ3VhZ2VNb2RlbHMuX2lkUG9vbCsrO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlckZpbGVJZ25vcmVQcm92aWRlcihoYW5kbGUpO1xuXHRcdHRoaXMuX2lnbm9yZWRGaWxlUHJvdmlkZXJzLnNldChoYW5kbGUsIHByb3ZpZGVyKTtcblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuX3Byb3h5LiR1bnJlZ2lzdGVyRmlsZUlnbm9yZVByb3ZpZGVyKGhhbmRsZSk7XG5cdFx0XHR0aGlzLl9pZ25vcmVkRmlsZVByb3ZpZGVycy5kZWxldGUoaGFuZGxlKTtcblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFTLHFCQUFxQiwyQkFBMkI7QUFDekQsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxtQkFBb0MsZ0NBQWdD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
