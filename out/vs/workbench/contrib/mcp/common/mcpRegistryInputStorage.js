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
import { Sequencer } from "../../../../base/common/async.js";
import { decodeBase64, encodeBase64, VSBuffer } from "../../../../base/common/buffer.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isEmptyObject } from "../../../../base/common/types.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ISecretStorageService } from "../../../../platform/secrets/common/secrets.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
const MCP_ENCRYPTION_KEY_NAME = "mcpEncryptionKey";
const MCP_ENCRYPTION_KEY_ALGORITHM = "AES-GCM";
const MCP_ENCRYPTION_KEY_LEN = 256;
const MCP_ENCRYPTION_IV_LENGTH = 12;
const MCP_DATA_STORED_VERSION = 1;
const MCP_DATA_STORED_KEY = "mcpInputs";
let McpRegistryInputStorage = class extends Disposable {
  constructor(_scope, _target, _storageService, _secretStorageService, _logService) {
    super();
    this._scope = _scope;
    this._storageService = _storageService;
    this._secretStorageService = _secretStorageService;
    this._logService = _logService;
    this._secretsSealerSequencer = new Sequencer();
    this._getEncryptionKey = new Lazy(() => {
      return McpRegistryInputStorage.secretSequencer.queue(async () => {
        const existing = await this._secretStorageService.get(MCP_ENCRYPTION_KEY_NAME);
        if (existing) {
          try {
            const parsed = JSON.parse(existing);
            return await crypto.subtle.importKey("jwk", parsed, MCP_ENCRYPTION_KEY_ALGORITHM, false, ["encrypt", "decrypt"]);
          } catch {
          }
        }
        const key = await crypto.subtle.generateKey(
          { name: MCP_ENCRYPTION_KEY_ALGORITHM, length: MCP_ENCRYPTION_KEY_LEN },
          true,
          ["encrypt", "decrypt"]
        );
        const exported = await crypto.subtle.exportKey("jwk", key);
        await this._secretStorageService.set(MCP_ENCRYPTION_KEY_NAME, JSON.stringify(exported));
        return key;
      });
    });
    this._didChange = false;
    this._record = new Lazy(() => {
      const stored = this._storageService.getObject(MCP_DATA_STORED_KEY, this._scope);
      return stored?.version === MCP_DATA_STORED_VERSION ? { ...stored } : { version: MCP_DATA_STORED_VERSION, values: {} };
    });
    this._register(_storageService.onWillSaveState(() => {
      if (this._didChange) {
        this._storageService.store(MCP_DATA_STORED_KEY, {
          version: MCP_DATA_STORED_VERSION,
          values: this._record.value.values,
          secrets: this._record.value.secrets
        }, this._scope, _target);
        this._didChange = false;
      }
    }));
  }
  /** Deletes all collection data from storage. */
  clearAll() {
    this._record.value.values = {};
    this._record.value.secrets = void 0;
    this._record.value.unsealedSecrets = void 0;
    this._didChange = true;
  }
  /** Delete a single collection data from the storage. */
  async clear(inputKey) {
    const secrets = await this._unsealSecrets();
    delete this._record.value.values[inputKey];
    this._didChange = true;
    if (secrets.hasOwnProperty(inputKey)) {
      delete secrets[inputKey];
      await this._sealSecrets();
    }
  }
  /** Gets a mapping of saved input data. */
  async getMap() {
    const secrets = await this._unsealSecrets();
    return { ...this._record.value.values, ...secrets };
  }
  /** Updates the input data mapping. */
  async setPlainText(values) {
    Object.assign(this._record.value.values, values);
    this._didChange = true;
  }
  /** Updates the input secrets mapping. */
  async setSecrets(values) {
    const unsealed = await this._unsealSecrets();
    Object.assign(unsealed, values);
    await this._sealSecrets();
  }
  async _sealSecrets() {
    const key = await this._getEncryptionKey.value;
    return this._secretsSealerSequencer.queue(async () => {
      if (!this._record.value.unsealedSecrets || isEmptyObject(this._record.value.unsealedSecrets)) {
        this._record.value.secrets = void 0;
        return;
      }
      const toSeal = JSON.stringify(this._record.value.unsealedSecrets);
      const iv = crypto.getRandomValues(new Uint8Array(MCP_ENCRYPTION_IV_LENGTH));
      const encrypted = await crypto.subtle.encrypt(
        { name: MCP_ENCRYPTION_KEY_ALGORITHM, iv: iv.buffer },
        key,
        new TextEncoder().encode(toSeal).buffer
      );
      const enc = encodeBase64(VSBuffer.wrap(new Uint8Array(encrypted)));
      this._record.value.secrets = { iv: encodeBase64(VSBuffer.wrap(iv)), value: enc };
      this._didChange = true;
    });
  }
  async _unsealSecrets() {
    if (!this._record.value.secrets) {
      return this._record.value.unsealedSecrets ??= {};
    }
    if (this._record.value.unsealedSecrets) {
      return this._record.value.unsealedSecrets;
    }
    try {
      const key = await this._getEncryptionKey.value;
      const iv = decodeBase64(this._record.value.secrets.iv);
      const encrypted = decodeBase64(this._record.value.secrets.value);
      const decrypted = await crypto.subtle.decrypt(
        { name: MCP_ENCRYPTION_KEY_ALGORITHM, iv: iv.buffer },
        key,
        encrypted.buffer
      );
      const unsealedSecrets = JSON.parse(new TextDecoder().decode(decrypted));
      this._record.value.unsealedSecrets = unsealedSecrets;
      return unsealedSecrets;
    } catch (e) {
      this._logService.warn("Error unsealing MCP secrets", e);
      this._record.value.secrets = void 0;
    }
    return {};
  }
};
McpRegistryInputStorage.secretSequencer = new Sequencer();
McpRegistryInputStorage = __decorateClass([
  __decorateParam(2, IStorageService),
  __decorateParam(3, ISecretStorageService),
  __decorateParam(4, ILogService)
], McpRegistryInputStorage);
export {
  McpRegistryInputStorage
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL21jcFJlZ2lzdHJ5SW5wdXRTdG9yYWdlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgU2VxdWVuY2VyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgZGVjb2RlQmFzZTY0LCBlbmNvZGVCYXNlNjQsIFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IExhenkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9sYXp5LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNFbXB0eU9iamVjdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVNlY3JldFN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc2VjcmV0cy9jb21tb24vc2VjcmV0cy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVJlc29sdmVkVmFsdWUgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9jb25maWd1cmF0aW9uUmVzb2x2ZXIvY29tbW9uL2NvbmZpZ3VyYXRpb25SZXNvbHZlckV4cHJlc3Npb24uanMnO1xuXG5jb25zdCBNQ1BfRU5DUllQVElPTl9LRVlfTkFNRSA9ICdtY3BFbmNyeXB0aW9uS2V5JztcbmNvbnN0IE1DUF9FTkNSWVBUSU9OX0tFWV9BTEdPUklUSE0gPSAnQUVTLUdDTSc7XG5jb25zdCBNQ1BfRU5DUllQVElPTl9LRVlfTEVOID0gMjU2O1xuY29uc3QgTUNQX0VOQ1JZUFRJT05fSVZfTEVOR1RIID0gMTI7IC8vIDk2IGJpdHNcbmNvbnN0IE1DUF9EQVRBX1NUT1JFRF9WRVJTSU9OID0gMTtcbmNvbnN0IE1DUF9EQVRBX1NUT1JFRF9LRVkgPSAnbWNwSW5wdXRzJztcblxuaW50ZXJmYWNlIElTdG9yZWREYXRhIHtcblx0dmVyc2lvbjogbnVtYmVyO1xuXHR2YWx1ZXM6IFJlY29yZDxzdHJpbmcsIElSZXNvbHZlZFZhbHVlPjtcblx0c2VjcmV0cz86IHsgdmFsdWU6IHN0cmluZzsgaXY6IHN0cmluZyB9OyAvLyBiYXNlNjQsIGVuY3J5cHRlZFxufVxuXG5pbnRlcmZhY2UgSUh5ZHJhdGVkRGF0YSBleHRlbmRzIElTdG9yZWREYXRhIHtcblx0dW5zZWFsZWRTZWNyZXRzPzogUmVjb3JkPHN0cmluZywgSVJlc29sdmVkVmFsdWU+O1xufVxuXG5leHBvcnQgY2xhc3MgTWNwUmVnaXN0cnlJbnB1dFN0b3JhZ2UgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBzdGF0aWMgc2VjcmV0U2VxdWVuY2VyID0gbmV3IFNlcXVlbmNlcigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zZWNyZXRzU2VhbGVyU2VxdWVuY2VyID0gbmV3IFNlcXVlbmNlcigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2dldEVuY3J5cHRpb25LZXkgPSBuZXcgTGF6eSgoKSA9PiB7XG5cdFx0cmV0dXJuIE1jcFJlZ2lzdHJ5SW5wdXRTdG9yYWdlLnNlY3JldFNlcXVlbmNlci5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBleGlzdGluZyA9IGF3YWl0IHRoaXMuX3NlY3JldFN0b3JhZ2VTZXJ2aWNlLmdldChNQ1BfRU5DUllQVElPTl9LRVlfTkFNRSk7XG5cdFx0XHRpZiAoZXhpc3RpbmcpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCBwYXJzZWQ6IEpzb25XZWJLZXkgPSBKU09OLnBhcnNlKGV4aXN0aW5nKTtcblx0XHRcdFx0XHRyZXR1cm4gYXdhaXQgY3J5cHRvLnN1YnRsZS5pbXBvcnRLZXkoJ2p3aycsIHBhcnNlZCwgTUNQX0VOQ1JZUFRJT05fS0VZX0FMR09SSVRITSwgZmFsc2UsIFsnZW5jcnlwdCcsICdkZWNyeXB0J10pO1xuXHRcdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0XHQvLyBmYWxsIHRocm91Z2hcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBrZXkgPSBhd2FpdCBjcnlwdG8uc3VidGxlLmdlbmVyYXRlS2V5KFxuXHRcdFx0XHR7IG5hbWU6IE1DUF9FTkNSWVBUSU9OX0tFWV9BTEdPUklUSE0sIGxlbmd0aDogTUNQX0VOQ1JZUFRJT05fS0VZX0xFTiB9LFxuXHRcdFx0XHR0cnVlLFxuXHRcdFx0XHRbJ2VuY3J5cHQnLCAnZGVjcnlwdCddLFxuXHRcdFx0KTtcblxuXHRcdFx0Y29uc3QgZXhwb3J0ZWQgPSBhd2FpdCBjcnlwdG8uc3VidGxlLmV4cG9ydEtleSgnandrJywga2V5KTtcblx0XHRcdGF3YWl0IHRoaXMuX3NlY3JldFN0b3JhZ2VTZXJ2aWNlLnNldChNQ1BfRU5DUllQVElPTl9LRVlfTkFNRSwgSlNPTi5zdHJpbmdpZnkoZXhwb3J0ZWQpKTtcblx0XHRcdHJldHVybiBrZXk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHByaXZhdGUgX2RpZENoYW5nZSA9IGZhbHNlO1xuXG5cdHByaXZhdGUgX3JlY29yZCA9IG5ldyBMYXp5PElIeWRyYXRlZERhdGE+KCgpID0+IHtcblx0XHRjb25zdCBzdG9yZWQgPSB0aGlzLl9zdG9yYWdlU2VydmljZS5nZXRPYmplY3Q8SVN0b3JlZERhdGE+KE1DUF9EQVRBX1NUT1JFRF9LRVksIHRoaXMuX3Njb3BlKTtcblx0XHRyZXR1cm4gc3RvcmVkPy52ZXJzaW9uID09PSBNQ1BfREFUQV9TVE9SRURfVkVSU0lPTiA/IHsgLi4uc3RvcmVkIH0gOiB7IHZlcnNpb246IE1DUF9EQVRBX1NUT1JFRF9WRVJTSU9OLCB2YWx1ZXM6IHt9IH07XG5cdH0pO1xuXG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc2NvcGU6IFN0b3JhZ2VTY29wZSxcblx0XHRfdGFyZ2V0OiBTdG9yYWdlVGFyZ2V0LFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVNlY3JldFN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3NlY3JldFN0b3JhZ2VTZXJ2aWNlOiBJU2VjcmV0U3RvcmFnZVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoX3N0b3JhZ2VTZXJ2aWNlLm9uV2lsbFNhdmVTdGF0ZSgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fZGlkQ2hhbmdlKSB7XG5cdFx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKE1DUF9EQVRBX1NUT1JFRF9LRVksIHtcblx0XHRcdFx0XHR2ZXJzaW9uOiBNQ1BfREFUQV9TVE9SRURfVkVSU0lPTixcblx0XHRcdFx0XHR2YWx1ZXM6IHRoaXMuX3JlY29yZC52YWx1ZS52YWx1ZXMsXG5cdFx0XHRcdFx0c2VjcmV0czogdGhpcy5fcmVjb3JkLnZhbHVlLnNlY3JldHMsXG5cdFx0XHRcdH0gc2F0aXNmaWVzIElTdG9yZWREYXRhLCB0aGlzLl9zY29wZSwgX3RhcmdldCk7XG5cdFx0XHRcdHRoaXMuX2RpZENoYW5nZSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdC8qKiBEZWxldGVzIGFsbCBjb2xsZWN0aW9uIGRhdGEgZnJvbSBzdG9yYWdlLiAqL1xuXHRwdWJsaWMgY2xlYXJBbGwoKSB7XG5cdFx0dGhpcy5fcmVjb3JkLnZhbHVlLnZhbHVlcyA9IHt9O1xuXHRcdHRoaXMuX3JlY29yZC52YWx1ZS5zZWNyZXRzID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3JlY29yZC52YWx1ZS51bnNlYWxlZFNlY3JldHMgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fZGlkQ2hhbmdlID0gdHJ1ZTtcblx0fVxuXG5cdC8qKiBEZWxldGUgYSBzaW5nbGUgY29sbGVjdGlvbiBkYXRhIGZyb20gdGhlIHN0b3JhZ2UuICovXG5cdHB1YmxpYyBhc3luYyBjbGVhcihpbnB1dEtleTogc3RyaW5nKSB7XG5cdFx0Y29uc3Qgc2VjcmV0cyA9IGF3YWl0IHRoaXMuX3Vuc2VhbFNlY3JldHMoKTtcblx0XHRkZWxldGUgdGhpcy5fcmVjb3JkLnZhbHVlLnZhbHVlc1tpbnB1dEtleV07XG5cdFx0dGhpcy5fZGlkQ2hhbmdlID0gdHJ1ZTtcblxuXHRcdGlmIChzZWNyZXRzLmhhc093blByb3BlcnR5KGlucHV0S2V5KSkge1xuXHRcdFx0ZGVsZXRlIHNlY3JldHNbaW5wdXRLZXldO1xuXHRcdFx0YXdhaXQgdGhpcy5fc2VhbFNlY3JldHMoKTtcblx0XHR9XG5cdH1cblxuXHQvKiogR2V0cyBhIG1hcHBpbmcgb2Ygc2F2ZWQgaW5wdXQgZGF0YS4gKi9cblx0cHVibGljIGFzeW5jIGdldE1hcCgpIHtcblx0XHRjb25zdCBzZWNyZXRzID0gYXdhaXQgdGhpcy5fdW5zZWFsU2VjcmV0cygpO1xuXHRcdHJldHVybiB7IC4uLnRoaXMuX3JlY29yZC52YWx1ZS52YWx1ZXMsIC4uLnNlY3JldHMgfTtcblx0fVxuXG5cdC8qKiBVcGRhdGVzIHRoZSBpbnB1dCBkYXRhIG1hcHBpbmcuICovXG5cdHB1YmxpYyBhc3luYyBzZXRQbGFpblRleHQodmFsdWVzOiBSZWNvcmQ8c3RyaW5nLCBJUmVzb2x2ZWRWYWx1ZT4pIHtcblx0XHRPYmplY3QuYXNzaWduKHRoaXMuX3JlY29yZC52YWx1ZS52YWx1ZXMsIHZhbHVlcyk7XG5cdFx0dGhpcy5fZGlkQ2hhbmdlID0gdHJ1ZTtcblx0fVxuXG5cdC8qKiBVcGRhdGVzIHRoZSBpbnB1dCBzZWNyZXRzIG1hcHBpbmcuICovXG5cdHB1YmxpYyBhc3luYyBzZXRTZWNyZXRzKHZhbHVlczogUmVjb3JkPHN0cmluZywgSVJlc29sdmVkVmFsdWU+KSB7XG5cdFx0Y29uc3QgdW5zZWFsZWQgPSBhd2FpdCB0aGlzLl91bnNlYWxTZWNyZXRzKCk7XG5cdFx0T2JqZWN0LmFzc2lnbih1bnNlYWxlZCwgdmFsdWVzKTtcblx0XHRhd2FpdCB0aGlzLl9zZWFsU2VjcmV0cygpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfc2VhbFNlY3JldHMoKSB7XG5cdFx0Y29uc3Qga2V5ID0gYXdhaXQgdGhpcy5fZ2V0RW5jcnlwdGlvbktleS52YWx1ZTtcblx0XHRyZXR1cm4gdGhpcy5fc2VjcmV0c1NlYWxlclNlcXVlbmNlci5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX3JlY29yZC52YWx1ZS51bnNlYWxlZFNlY3JldHMgfHwgaXNFbXB0eU9iamVjdCh0aGlzLl9yZWNvcmQudmFsdWUudW5zZWFsZWRTZWNyZXRzKSkge1xuXHRcdFx0XHR0aGlzLl9yZWNvcmQudmFsdWUuc2VjcmV0cyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0b1NlYWwgPSBKU09OLnN0cmluZ2lmeSh0aGlzLl9yZWNvcmQudmFsdWUudW5zZWFsZWRTZWNyZXRzKTtcblx0XHRcdGNvbnN0IGl2ID0gY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhuZXcgVWludDhBcnJheShNQ1BfRU5DUllQVElPTl9JVl9MRU5HVEgpKTtcblx0XHRcdGNvbnN0IGVuY3J5cHRlZCA9IGF3YWl0IGNyeXB0by5zdWJ0bGUuZW5jcnlwdChcblx0XHRcdFx0eyBuYW1lOiBNQ1BfRU5DUllQVElPTl9LRVlfQUxHT1JJVEhNLCBpdjogaXYuYnVmZmVyIH0sXG5cdFx0XHRcdGtleSxcblx0XHRcdFx0bmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKHRvU2VhbCkuYnVmZmVyLFxuXHRcdFx0KTtcblxuXHRcdFx0Y29uc3QgZW5jID0gZW5jb2RlQmFzZTY0KFZTQnVmZmVyLndyYXAobmV3IFVpbnQ4QXJyYXkoZW5jcnlwdGVkKSkpO1xuXHRcdFx0dGhpcy5fcmVjb3JkLnZhbHVlLnNlY3JldHMgPSB7IGl2OiBlbmNvZGVCYXNlNjQoVlNCdWZmZXIud3JhcChpdikpLCB2YWx1ZTogZW5jIH07XG5cdFx0XHR0aGlzLl9kaWRDaGFuZ2UgPSB0cnVlO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfdW5zZWFsU2VjcmV0cygpOiBQcm9taXNlPFJlY29yZDxzdHJpbmcsIElSZXNvbHZlZFZhbHVlPj4ge1xuXHRcdGlmICghdGhpcy5fcmVjb3JkLnZhbHVlLnNlY3JldHMpIHtcblx0XHRcdHJldHVybiB0aGlzLl9yZWNvcmQudmFsdWUudW5zZWFsZWRTZWNyZXRzID8/PSB7fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fcmVjb3JkLnZhbHVlLnVuc2VhbGVkU2VjcmV0cykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3JlY29yZC52YWx1ZS51bnNlYWxlZFNlY3JldHM7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGtleSA9IGF3YWl0IHRoaXMuX2dldEVuY3J5cHRpb25LZXkudmFsdWU7XG5cdFx0XHRjb25zdCBpdiA9IGRlY29kZUJhc2U2NCh0aGlzLl9yZWNvcmQudmFsdWUuc2VjcmV0cy5pdik7XG5cdFx0XHRjb25zdCBlbmNyeXB0ZWQgPSBkZWNvZGVCYXNlNjQodGhpcy5fcmVjb3JkLnZhbHVlLnNlY3JldHMudmFsdWUpO1xuXG5cdFx0XHRjb25zdCBkZWNyeXB0ZWQgPSBhd2FpdCBjcnlwdG8uc3VidGxlLmRlY3J5cHQoXG5cdFx0XHRcdHsgbmFtZTogTUNQX0VOQ1JZUFRJT05fS0VZX0FMR09SSVRITSwgaXY6IGl2LmJ1ZmZlciB9LFxuXHRcdFx0XHRrZXksXG5cdFx0XHRcdGVuY3J5cHRlZC5idWZmZXIsXG5cdFx0XHQpO1xuXG5cdFx0XHRjb25zdCB1bnNlYWxlZFNlY3JldHMgPSBKU09OLnBhcnNlKG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShkZWNyeXB0ZWQpKTtcblx0XHRcdHRoaXMuX3JlY29yZC52YWx1ZS51bnNlYWxlZFNlY3JldHMgPSB1bnNlYWxlZFNlY3JldHM7XG5cdFx0XHRyZXR1cm4gdW5zZWFsZWRTZWNyZXRzO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybignRXJyb3IgdW5zZWFsaW5nIE1DUCBzZWNyZXRzJywgZSk7XG5cdFx0XHR0aGlzLl9yZWNvcmQudmFsdWUuc2VjcmV0cyA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge307XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxjQUFjLGNBQWMsZ0JBQWdCO0FBQ3JELFNBQVMsWUFBWTtBQUNyQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLG1CQUFtQjtBQUM1QixTQUFT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
