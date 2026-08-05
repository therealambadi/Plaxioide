import { isStandalone } from "../../../base/browser/browser.js";
import { mainWindow } from "../../../base/browser/window.js";
import { VSBuffer, decodeBase64, encodeBase64 } from "../../../base/common/buffer.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { parse } from "../../../base/common/marshalling.js";
import { Schemas } from "../../../base/common/network.js";
import { posix } from "../../../base/common/path.js";
import { isEqual } from "../../../base/common/resources.js";
import { ltrim } from "../../../base/common/strings.js";
import { URI } from "../../../base/common/uri.js";
import product from "../../../platform/product/common/product.js";
import { isFolderToOpen, isWorkspaceToOpen } from "../../../platform/window/common/window.js";
import { create } from "../../../workbench/workbench.web.main.internal.js";
class TransparentCrypto {
  async seal(data) {
    return data;
  }
  async unseal(data) {
    return data;
  }
}
var AESConstants = /* @__PURE__ */ ((AESConstants2) => {
  AESConstants2["ALGORITHM"] = "AES-GCM";
  AESConstants2[AESConstants2["KEY_LENGTH"] = 256] = "KEY_LENGTH";
  AESConstants2[AESConstants2["IV_LENGTH"] = 12] = "IV_LENGTH";
  return AESConstants2;
})(AESConstants || {});
class NetworkError extends Error {
  constructor(inner) {
    super(inner.message);
    this.name = inner.name;
    this.stack = inner.stack;
  }
}
class ServerKeyedAESCrypto {
  constructor(authEndpoint) {
    this.authEndpoint = authEndpoint;
  }
  /**
   * Gets whether the algorithm is supported; requires a secure context
   */
  static supported() {
    return !!crypto.subtle;
  }
  async seal(data) {
    const iv = mainWindow.crypto.getRandomValues(new Uint8Array(12 /* IV_LENGTH */));
    const clientKeyObj = await mainWindow.crypto.subtle.generateKey(
      { name: "AES-GCM" /* ALGORITHM */, length: 256 /* KEY_LENGTH */ },
      true,
      ["encrypt", "decrypt"]
    );
    const clientKey = new Uint8Array(await mainWindow.crypto.subtle.exportKey("raw", clientKeyObj));
    const key = await this.getKey(clientKey);
    const dataUint8Array = new TextEncoder().encode(data);
    const cipherText = await mainWindow.crypto.subtle.encrypt(
      { name: "AES-GCM" /* ALGORITHM */, iv },
      key,
      dataUint8Array
    );
    const result = new Uint8Array([...clientKey, ...iv, ...new Uint8Array(cipherText)]);
    return encodeBase64(VSBuffer.wrap(result));
  }
  async unseal(data) {
    const dataUint8Array = decodeBase64(data);
    if (dataUint8Array.byteLength < 60) {
      throw Error("Invalid length for the value for credentials.crypto");
    }
    const keyLength = 256 /* KEY_LENGTH */ / 8;
    const clientKey = dataUint8Array.slice(0, keyLength);
    const iv = dataUint8Array.slice(keyLength, keyLength + 12 /* IV_LENGTH */);
    const cipherText = dataUint8Array.slice(keyLength + 12 /* IV_LENGTH */);
    const key = await this.getKey(clientKey.buffer);
    const decrypted = await mainWindow.crypto.subtle.decrypt(
      { name: "AES-GCM" /* ALGORITHM */, iv: iv.buffer },
      key,
      cipherText.buffer
    );
    return new TextDecoder().decode(new Uint8Array(decrypted));
  }
  /**
   * Given a clientKey, returns the CryptoKey object that is used to encrypt/decrypt the data.
   * The actual key is (clientKey XOR serverKey)
   */
  async getKey(clientKey) {
    if (!clientKey || clientKey.byteLength !== 256 /* KEY_LENGTH */ / 8) {
      throw Error("Invalid length for clientKey");
    }
    const serverKey = await this.getServerKeyPart();
    const keyData = new Uint8Array(256 /* KEY_LENGTH */ / 8);
    for (let i = 0; i < keyData.byteLength; i++) {
      keyData[i] = clientKey[i] ^ serverKey[i];
    }
    return mainWindow.crypto.subtle.importKey(
      "raw",
      keyData,
      {
        name: "AES-GCM" /* ALGORITHM */,
        length: 256 /* KEY_LENGTH */
      },
      true,
      ["encrypt", "decrypt"]
    );
  }
  async getServerKeyPart() {
    if (this.serverKey) {
      return this.serverKey;
    }
    let attempt = 0;
    let lastError;
    while (attempt <= 3) {
      try {
        const res = await fetch(this.authEndpoint, { credentials: "include", method: "POST" });
        if (!res.ok) {
          throw new Error(res.statusText);
        }
        const serverKey = new Uint8Array(await res.arrayBuffer());
        if (serverKey.byteLength !== 256 /* KEY_LENGTH */ / 8) {
          throw Error(`The key retrieved by the server is not ${256 /* KEY_LENGTH */} bit long.`);
        }
        this.serverKey = serverKey;
        return this.serverKey;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, attempt * attempt * 100));
      }
    }
    if (lastError) {
      throw new NetworkError(lastError);
    }
    throw new Error("Unknown error");
  }
}
class LocalStorageSecretStorageProvider {
  constructor(crypto2) {
    this.crypto = crypto2;
    this.storageKey = "secrets.provider";
    this.type = "persisted";
    this.secretsPromise = this.load();
  }
  async load() {
    const record = this.loadAuthSessionFromElement();
    const encrypted = localStorage.getItem(this.storageKey);
    if (encrypted) {
      try {
        const decrypted = JSON.parse(await this.crypto.unseal(encrypted));
        return { ...record, ...decrypted };
      } catch (err) {
        console.error("Failed to decrypt secrets from localStorage", err);
        if (!(err instanceof NetworkError)) {
          localStorage.removeItem(this.storageKey);
        }
      }
    }
    return record;
  }
  loadAuthSessionFromElement() {
    let authSessionInfo;
    const authSessionElement = mainWindow.document.getElementById("vscode-workbench-auth-session");
    const authSessionElementAttribute = authSessionElement ? authSessionElement.getAttribute("data-settings") : void 0;
    if (authSessionElementAttribute) {
      try {
        authSessionInfo = JSON.parse(authSessionElementAttribute);
      } catch (error) {
      }
    }
    if (!authSessionInfo) {
      return {};
    }
    const record = {};
    record[`${product.urlProtocol}.loginAccount`] = JSON.stringify(authSessionInfo);
    if (authSessionInfo.providerId !== "github") {
      console.error(`Unexpected auth provider: ${authSessionInfo.providerId}. Expected 'github'.`);
      return record;
    }
    const authAccount = JSON.stringify({ extensionId: "vscode.github-authentication", key: "github.auth" });
    record[authAccount] = JSON.stringify(authSessionInfo.scopes.map((scopes) => ({
      id: authSessionInfo.id,
      scopes,
      accessToken: authSessionInfo.accessToken
    })));
    return record;
  }
  async get(key) {
    const secrets = await this.secretsPromise;
    return secrets[key];
  }
  async set(key, value) {
    const secrets = await this.secretsPromise;
    secrets[key] = value;
    this.secretsPromise = Promise.resolve(secrets);
    this.save();
  }
  async delete(key) {
    const secrets = await this.secretsPromise;
    delete secrets[key];
    this.secretsPromise = Promise.resolve(secrets);
    this.save();
  }
  async save() {
    try {
      const encrypted = await this.crypto.seal(JSON.stringify(await this.secretsPromise));
      localStorage.setItem(this.storageKey, encrypted);
    } catch (err) {
      console.error(err);
    }
  }
}
const _LocalStorageURLCallbackProvider = class _LocalStorageURLCallbackProvider extends Disposable {
  constructor(_callbackRoute) {
    super();
    this._callbackRoute = _callbackRoute;
    this._onCallback = this._register(new Emitter());
    this.onCallback = this._onCallback.event;
    this.pendingCallbacks = /* @__PURE__ */ new Set();
    this.lastTimeChecked = Date.now();
    this.checkCallbacksTimeout = void 0;
  }
  create(options = {}) {
    const id = ++_LocalStorageURLCallbackProvider.REQUEST_ID;
    const queryParams = [`vscode-reqid=${id}`];
    for (const key of _LocalStorageURLCallbackProvider.QUERY_KEYS) {
      const value = options[key];
      if (value) {
        queryParams.push(`vscode-${key}=${encodeURIComponent(value)}`);
      }
    }
    if (!(options.authority === "vscode.github-authentication" && options.path === "/dummy")) {
      const key = `vscode-web.url-callbacks[${id}]`;
      localStorage.removeItem(key);
      this.pendingCallbacks.add(id);
      this.startListening();
    }
    return URI.parse(mainWindow.location.href).with({ path: this._callbackRoute, query: queryParams.join("&") });
  }
  startListening() {
    if (this.onDidChangeLocalStorageDisposable) {
      return;
    }
    const fn = () => this.onDidChangeLocalStorage();
    mainWindow.addEventListener("storage", fn);
    this.onDidChangeLocalStorageDisposable = { dispose: () => mainWindow.removeEventListener("storage", fn) };
  }
  stopListening() {
    this.onDidChangeLocalStorageDisposable?.dispose();
    this.onDidChangeLocalStorageDisposable = void 0;
  }
  // this fires every time local storage changes, but we
  // don't want to check more often than once a second
  async onDidChangeLocalStorage() {
    const ellapsed = Date.now() - this.lastTimeChecked;
    if (ellapsed > 1e3) {
      this.checkCallbacks();
    } else if (this.checkCallbacksTimeout === void 0) {
      this.checkCallbacksTimeout = setTimeout(() => {
        this.checkCallbacksTimeout = void 0;
        this.checkCallbacks();
      }, 1e3 - ellapsed);
    }
  }
  checkCallbacks() {
    let pendingCallbacks;
    for (const id of this.pendingCallbacks) {
      const key = `vscode-web.url-callbacks[${id}]`;
      const result = localStorage.getItem(key);
      if (result !== null) {
        try {
          this._onCallback.fire(URI.revive(JSON.parse(result)));
        } catch (error) {
          console.error(error);
        }
        pendingCallbacks = pendingCallbacks ?? new Set(this.pendingCallbacks);
        pendingCallbacks.delete(id);
        localStorage.removeItem(key);
      }
    }
    if (pendingCallbacks) {
      this.pendingCallbacks = pendingCallbacks;
      if (this.pendingCallbacks.size === 0) {
        this.stopListening();
      }
    }
    this.lastTimeChecked = Date.now();
  }
};
_LocalStorageURLCallbackProvider.REQUEST_ID = 0;
_LocalStorageURLCallbackProvider.QUERY_KEYS = [
  "scheme",
  "authority",
  "path",
  "query",
  "fragment"
];
let LocalStorageURLCallbackProvider = _LocalStorageURLCallbackProvider;
const _WorkspaceProvider = class _WorkspaceProvider {
  constructor(workspace, payload, config) {
    this.workspace = workspace;
    this.payload = payload;
    this.config = config;
    this.trusted = true;
  }
  static create(config) {
    let foundWorkspace = false;
    let workspace;
    let payload = /* @__PURE__ */ Object.create(null);
    const query = new URL(document.location.href).searchParams;
    query.forEach((value, key) => {
      switch (key) {
        // Folder
        case _WorkspaceProvider.QUERY_PARAM_FOLDER:
          if (config.remoteAuthority && value.startsWith(posix.sep)) {
            workspace = { folderUri: URI.from({ scheme: Schemas.vscodeRemote, path: value, authority: config.remoteAuthority }) };
          } else {
            workspace = { folderUri: URI.parse(value) };
          }
          foundWorkspace = true;
          break;
        // Workspace
        case _WorkspaceProvider.QUERY_PARAM_WORKSPACE:
          if (config.remoteAuthority && value.startsWith(posix.sep)) {
            workspace = { workspaceUri: URI.from({ scheme: Schemas.vscodeRemote, path: value, authority: config.remoteAuthority }) };
          } else {
            workspace = { workspaceUri: URI.parse(value) };
          }
          foundWorkspace = true;
          break;
        // Empty
        case _WorkspaceProvider.QUERY_PARAM_EMPTY_WINDOW:
          workspace = void 0;
          foundWorkspace = true;
          break;
        // Payload
        case _WorkspaceProvider.QUERY_PARAM_PAYLOAD:
          try {
            payload = parse(value);
          } catch (error) {
            console.error(error);
          }
          break;
      }
    });
    if (!foundWorkspace) {
      if (config.folderUri) {
        workspace = { folderUri: URI.revive(config.folderUri) };
      } else if (config.workspaceUri) {
        workspace = { workspaceUri: URI.revive(config.workspaceUri) };
      }
    }
    return new _WorkspaceProvider(workspace, payload, config);
  }
  async open(workspace, options) {
    if (options?.reuse && !options.payload && this.isSame(this.workspace, workspace)) {
      return true;
    }
    const targetHref = this.createTargetUrl(workspace, options);
    if (targetHref) {
      if (options?.reuse) {
        mainWindow.location.href = targetHref;
        return true;
      } else {
        let result;
        if (isStandalone()) {
          result = mainWindow.open(targetHref, "_blank", "toolbar=no");
        } else {
          result = mainWindow.open(targetHref);
        }
        return !!result;
      }
    }
    return false;
  }
  createTargetUrl(workspace, options) {
    let targetHref = void 0;
    if (!workspace) {
      targetHref = `${document.location.origin}${document.location.pathname}?${_WorkspaceProvider.QUERY_PARAM_EMPTY_WINDOW}=true`;
    } else if (isFolderToOpen(workspace)) {
      const queryParamFolder = this.encodeWorkspacePath(workspace.folderUri);
      targetHref = `${document.location.origin}${document.location.pathname}?${_WorkspaceProvider.QUERY_PARAM_FOLDER}=${queryParamFolder}`;
    } else if (isWorkspaceToOpen(workspace)) {
      const queryParamWorkspace = this.encodeWorkspacePath(workspace.workspaceUri);
      targetHref = `${document.location.origin}${document.location.pathname}?${_WorkspaceProvider.QUERY_PARAM_WORKSPACE}=${queryParamWorkspace}`;
    }
    if (options?.payload) {
      targetHref += `&${_WorkspaceProvider.QUERY_PARAM_PAYLOAD}=${encodeURIComponent(JSON.stringify(options.payload))}`;
    }
    return targetHref;
  }
  encodeWorkspacePath(uri) {
    if (this.config.remoteAuthority && uri.scheme === Schemas.vscodeRemote) {
      return encodeURIComponent(`${posix.sep}${ltrim(uri.path, posix.sep)}`).replaceAll("%2F", "/");
    }
    return encodeURIComponent(uri.toString(true));
  }
  isSame(workspaceA, workspaceB) {
    if (!workspaceA || !workspaceB) {
      return workspaceA === workspaceB;
    }
    if (isFolderToOpen(workspaceA) && isFolderToOpen(workspaceB)) {
      return isEqual(workspaceA.folderUri, workspaceB.folderUri);
    }
    if (isWorkspaceToOpen(workspaceA) && isWorkspaceToOpen(workspaceB)) {
      return isEqual(workspaceA.workspaceUri, workspaceB.workspaceUri);
    }
    return false;
  }
  hasRemote() {
    if (this.workspace) {
      if (isFolderToOpen(this.workspace)) {
        return this.workspace.folderUri.scheme === Schemas.vscodeRemote;
      }
      if (isWorkspaceToOpen(this.workspace)) {
        return this.workspace.workspaceUri.scheme === Schemas.vscodeRemote;
      }
    }
    return true;
  }
};
_WorkspaceProvider.QUERY_PARAM_EMPTY_WINDOW = "ew";
_WorkspaceProvider.QUERY_PARAM_FOLDER = "folder";
_WorkspaceProvider.QUERY_PARAM_WORKSPACE = "workspace";
_WorkspaceProvider.QUERY_PARAM_PAYLOAD = "payload";
let WorkspaceProvider = _WorkspaceProvider;
function readCookie(name) {
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    if (cookie.startsWith(name + "=")) {
      return cookie.substring(name.length + 1);
    }
  }
  return void 0;
}
(function() {
  const configElement = mainWindow.document.getElementById("vscode-workbench-web-configuration");
  const configElementAttribute = configElement ? configElement.getAttribute("data-settings") : void 0;
  if (!configElement || !configElementAttribute) {
    throw new Error("Missing web configuration element");
  }
  const config = JSON.parse(configElementAttribute);
  const secretStorageKeyPath = readCookie("vscode-secret-key-path");
  const secretStorageCrypto = secretStorageKeyPath && ServerKeyedAESCrypto.supported() ? new ServerKeyedAESCrypto(secretStorageKeyPath) : new TransparentCrypto();
  create(mainWindow.document.body, {
    ...config,
    windowIndicator: config.windowIndicator ?? { label: "$(remote)", tooltip: `${product.nameShort} Web` },
    settingsSyncOptions: config.settingsSyncOptions ? { enabled: config.settingsSyncOptions.enabled } : void 0,
    workspaceProvider: WorkspaceProvider.create(config),
    urlCallbackProvider: new LocalStorageURLCallbackProvider(config.callbackRoute),
    secretStorageProvider: config.remoteAuthority && !secretStorageKeyPath ? void 0 : new LocalStorageSecretStorageProvider(secretStorageCrypto)
  });
})();
export {
  LocalStorageSecretStorageProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9jb2RlL2Jyb3dzZXIvd29ya2JlbmNoL3dvcmtiZW5jaC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGlzU3RhbmRhbG9uZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9icm93c2VyLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IFZTQnVmZmVyLCBkZWNvZGVCYXNlNjQsIGVuY29kZUJhc2U2NCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgcGFyc2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBwb3NpeCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBsdHJpbSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCBwcm9kdWN0IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3QuanMnO1xuaW1wb3J0IHsgSVNlY3JldFN0b3JhZ2VQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3NlY3JldHMvY29tbW9uL3NlY3JldHMuanMnO1xuaW1wb3J0IHsgaXNGb2xkZXJUb09wZW4sIGlzV29ya3NwYWNlVG9PcGVuIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vd2luZG93L2NvbW1vbi93aW5kb3cuanMnO1xuaW1wb3J0IHR5cGUgeyBJV29ya2JlbmNoQ29uc3RydWN0aW9uT3B0aW9ucywgSVdvcmtzcGFjZSwgSVdvcmtzcGFjZVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vd29ya2JlbmNoL2Jyb3dzZXIvd2ViLmFwaS5qcyc7XG5pbXBvcnQgeyBBdXRoZW50aWNhdGlvblNlc3Npb25JbmZvIH0gZnJvbSAnLi4vLi4vLi4vd29ya2JlbmNoL3NlcnZpY2VzL2F1dGhlbnRpY2F0aW9uL2Jyb3dzZXIvYXV0aGVudGljYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB0eXBlIHsgSVVSTENhbGxiYWNrUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi93b3JrYmVuY2gvc2VydmljZXMvdXJsL2Jyb3dzZXIvdXJsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGUgfSBmcm9tICcuLi8uLi8uLi93b3JrYmVuY2gvd29ya2JlbmNoLndlYi5tYWluLmludGVybmFsLmpzJztcblxuaW50ZXJmYWNlIElTZWNyZXRTdG9yYWdlQ3J5cHRvIHtcblx0c2VhbChkYXRhOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz47XG5cdHVuc2VhbChkYXRhOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz47XG59XG5cbmNsYXNzIFRyYW5zcGFyZW50Q3J5cHRvIGltcGxlbWVudHMgSVNlY3JldFN0b3JhZ2VDcnlwdG8ge1xuXG5cdGFzeW5jIHNlYWwoZGF0YTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRyZXR1cm4gZGF0YTtcblx0fVxuXG5cdGFzeW5jIHVuc2VhbChkYXRhOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHJldHVybiBkYXRhO1xuXHR9XG59XG5cbmNvbnN0IGVudW0gQUVTQ29uc3RhbnRzIHtcblx0QUxHT1JJVEhNID0gJ0FFUy1HQ00nLFxuXHRLRVlfTEVOR1RIID0gMjU2LFxuXHRJVl9MRU5HVEggPSAxMixcbn1cblxuY2xhc3MgTmV0d29ya0Vycm9yIGV4dGVuZHMgRXJyb3Ige1xuXG5cdGNvbnN0cnVjdG9yKGlubmVyOiBFcnJvcikge1xuXHRcdHN1cGVyKGlubmVyLm1lc3NhZ2UpO1xuXHRcdHRoaXMubmFtZSA9IGlubmVyLm5hbWU7XG5cdFx0dGhpcy5zdGFjayA9IGlubmVyLnN0YWNrO1xuXHR9XG59XG5cbmNsYXNzIFNlcnZlcktleWVkQUVTQ3J5cHRvIGltcGxlbWVudHMgSVNlY3JldFN0b3JhZ2VDcnlwdG8ge1xuXG5cdHByaXZhdGUgc2VydmVyS2V5OiBVaW50OEFycmF5IHwgdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBHZXRzIHdoZXRoZXIgdGhlIGFsZ29yaXRobSBpcyBzdXBwb3J0ZWQ7IHJlcXVpcmVzIGEgc2VjdXJlIGNvbnRleHRcblx0ICovXG5cdHN0YXRpYyBzdXBwb3J0ZWQoKSB7XG5cdFx0cmV0dXJuICEhY3J5cHRvLnN1YnRsZTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgYXV0aEVuZHBvaW50OiBzdHJpbmcpIHsgfVxuXG5cdGFzeW5jIHNlYWwoZGF0YTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHQvLyBHZXQgYSBuZXcga2V5IGFuZCBJViBvbiBldmVyeSBjaGFuZ2UsIHRvIGF2b2lkIHRoZSByaXNrIG9mIHJldXNpbmcgdGhlIHNhbWUga2V5IGFuZCBJViBwYWlyIHdpdGggQUVTLUdDTVxuXHRcdC8vIChzZWUgYWxzbzogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0Flc0djbVBhcmFtcyNwcm9wZXJ0aWVzKVxuXHRcdGNvbnN0IGl2ID0gbWFpbldpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKG5ldyBVaW50OEFycmF5KEFFU0NvbnN0YW50cy5JVl9MRU5HVEgpKTtcblx0XHQvLyBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzIGlzbid0IGEgZ29vZC1lbm91Z2ggUFJORyB0byBnZW5lcmF0ZSBjcnlwdG8ga2V5cywgc28gd2UgbmVlZCB0byB1c2UgY3J5cHRvLnN1YnRsZS5nZW5lcmF0ZUtleSBhbmQgZXhwb3J0IHRoZSBrZXkgaW5zdGVhZFxuXHRcdGNvbnN0IGNsaWVudEtleU9iaiA9IGF3YWl0IG1haW5XaW5kb3cuY3J5cHRvLnN1YnRsZS5nZW5lcmF0ZUtleShcblx0XHRcdHsgbmFtZTogQUVTQ29uc3RhbnRzLkFMR09SSVRITSBhcyBjb25zdCwgbGVuZ3RoOiBBRVNDb25zdGFudHMuS0VZX0xFTkdUSCBhcyBjb25zdCB9LFxuXHRcdFx0dHJ1ZSxcblx0XHRcdFsnZW5jcnlwdCcsICdkZWNyeXB0J11cblx0XHQpO1xuXG5cdFx0Y29uc3QgY2xpZW50S2V5ID0gbmV3IFVpbnQ4QXJyYXkoYXdhaXQgbWFpbldpbmRvdy5jcnlwdG8uc3VidGxlLmV4cG9ydEtleSgncmF3JywgY2xpZW50S2V5T2JqKSk7XG5cdFx0Y29uc3Qga2V5ID0gYXdhaXQgdGhpcy5nZXRLZXkoY2xpZW50S2V5KTtcblx0XHRjb25zdCBkYXRhVWludDhBcnJheSA9IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShkYXRhKTtcblx0XHRjb25zdCBjaXBoZXJUZXh0OiBBcnJheUJ1ZmZlciA9IGF3YWl0IG1haW5XaW5kb3cuY3J5cHRvLnN1YnRsZS5lbmNyeXB0KFxuXHRcdFx0eyBuYW1lOiBBRVNDb25zdGFudHMuQUxHT1JJVEhNIGFzIGNvbnN0LCBpdiB9LFxuXHRcdFx0a2V5LFxuXHRcdFx0ZGF0YVVpbnQ4QXJyYXlcblx0XHQpO1xuXG5cdFx0Ly8gQmFzZTY0IGVuY29kZSB0aGUgcmVzdWx0IGFuZCBzdG9yZSB0aGUgY2lwaGVydGV4dCwgdGhlIGtleSwgYW5kIHRoZSBJViBpbiBsb2NhbFN0b3JhZ2Vcblx0XHQvLyBOb3RlIHRoYXQgdGhlIGNsaWVudEtleSBhbmQgSVYgZG9uJ3QgbmVlZCB0byBiZSBzZWNyZXRcblx0XHRjb25zdCByZXN1bHQgPSBuZXcgVWludDhBcnJheShbLi4uY2xpZW50S2V5LCAuLi5pdiwgLi4ubmV3IFVpbnQ4QXJyYXkoY2lwaGVyVGV4dCldKTtcblx0XHRyZXR1cm4gZW5jb2RlQmFzZTY0KFZTQnVmZmVyLndyYXAocmVzdWx0KSk7XG5cdH1cblxuXHRhc3luYyB1bnNlYWwoZGF0YTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHQvLyBlbmNyeXB0ZWQgc2hvdWxkIGNvbnRhaW4sIGluIG9yZGVyOiB0aGUga2V5ICgzMi1ieXRlKSwgdGhlIElWIGZvciBBRVMtR0NNICgxMi1ieXRlKSBhbmQgdGhlIGNpcGhlcnRleHQgKHdoaWNoIGhhcyB0aGUgR0NNIGF1dGggdGFnIGF0IHRoZSBlbmQpXG5cdFx0Ly8gTWluaW11bSBsZW5ndGggbXVzdCBiZSA0NCAoa2V5K0lWIGxlbmd0aCkgKyAxNiBieXRlcyAoMSBibG9jayBlbmNyeXB0ZWQgd2l0aCBBRVMgLSByZWdhcmRsZXNzIG9mIGtleSBzaXplKVxuXHRcdGNvbnN0IGRhdGFVaW50OEFycmF5ID0gZGVjb2RlQmFzZTY0KGRhdGEpO1xuXG5cdFx0aWYgKGRhdGFVaW50OEFycmF5LmJ5dGVMZW5ndGggPCA2MCkge1xuXHRcdFx0dGhyb3cgRXJyb3IoJ0ludmFsaWQgbGVuZ3RoIGZvciB0aGUgdmFsdWUgZm9yIGNyZWRlbnRpYWxzLmNyeXB0bycpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGtleUxlbmd0aCA9IEFFU0NvbnN0YW50cy5LRVlfTEVOR1RIIC8gODtcblx0XHRjb25zdCBjbGllbnRLZXkgPSBkYXRhVWludDhBcnJheS5zbGljZSgwLCBrZXlMZW5ndGgpO1xuXHRcdGNvbnN0IGl2ID0gZGF0YVVpbnQ4QXJyYXkuc2xpY2Uoa2V5TGVuZ3RoLCBrZXlMZW5ndGggKyBBRVNDb25zdGFudHMuSVZfTEVOR1RIKTtcblx0XHRjb25zdCBjaXBoZXJUZXh0ID0gZGF0YVVpbnQ4QXJyYXkuc2xpY2Uoa2V5TGVuZ3RoICsgQUVTQ29uc3RhbnRzLklWX0xFTkdUSCk7XG5cblx0XHQvLyBEbyB0aGUgZGVjcnlwdGlvbiBhbmQgcGFyc2UgdGhlIHJlc3VsdCBhcyBKU09OXG5cdFx0Y29uc3Qga2V5ID0gYXdhaXQgdGhpcy5nZXRLZXkoY2xpZW50S2V5LmJ1ZmZlcik7XG5cdFx0Y29uc3QgZGVjcnlwdGVkID0gYXdhaXQgbWFpbldpbmRvdy5jcnlwdG8uc3VidGxlLmRlY3J5cHQoXG5cdFx0XHR7IG5hbWU6IEFFU0NvbnN0YW50cy5BTEdPUklUSE0gYXMgY29uc3QsIGl2OiBpdi5idWZmZXIgfSxcblx0XHRcdGtleSxcblx0XHRcdGNpcGhlclRleHQuYnVmZmVyXG5cdFx0KTtcblxuXHRcdHJldHVybiBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUobmV3IFVpbnQ4QXJyYXkoZGVjcnlwdGVkKSk7XG5cdH1cblxuXHQvKipcblx0ICogR2l2ZW4gYSBjbGllbnRLZXksIHJldHVybnMgdGhlIENyeXB0b0tleSBvYmplY3QgdGhhdCBpcyB1c2VkIHRvIGVuY3J5cHQvZGVjcnlwdCB0aGUgZGF0YS5cblx0ICogVGhlIGFjdHVhbCBrZXkgaXMgKGNsaWVudEtleSBYT1Igc2VydmVyS2V5KVxuXHQgKi9cblx0cHJpdmF0ZSBhc3luYyBnZXRLZXkoY2xpZW50S2V5OiBVaW50OEFycmF5KTogUHJvbWlzZTxDcnlwdG9LZXk+IHtcblx0XHRpZiAoIWNsaWVudEtleSB8fCBjbGllbnRLZXkuYnl0ZUxlbmd0aCAhPT0gQUVTQ29uc3RhbnRzLktFWV9MRU5HVEggLyA4KSB7XG5cdFx0XHR0aHJvdyBFcnJvcignSW52YWxpZCBsZW5ndGggZm9yIGNsaWVudEtleScpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlcnZlcktleSA9IGF3YWl0IHRoaXMuZ2V0U2VydmVyS2V5UGFydCgpO1xuXHRcdGNvbnN0IGtleURhdGEgPSBuZXcgVWludDhBcnJheShBRVNDb25zdGFudHMuS0VZX0xFTkdUSCAvIDgpO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBrZXlEYXRhLmJ5dGVMZW5ndGg7IGkrKykge1xuXHRcdFx0a2V5RGF0YVtpXSA9IGNsaWVudEtleVtpXSEgXiBzZXJ2ZXJLZXlbaV0hO1xuXHRcdH1cblxuXHRcdHJldHVybiBtYWluV2luZG93LmNyeXB0by5zdWJ0bGUuaW1wb3J0S2V5KFxuXHRcdFx0J3JhdycsXG5cdFx0XHRrZXlEYXRhLFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBBRVNDb25zdGFudHMuQUxHT1JJVEhNIGFzIGNvbnN0LFxuXHRcdFx0XHRsZW5ndGg6IEFFU0NvbnN0YW50cy5LRVlfTEVOR1RIIGFzIGNvbnN0LFxuXHRcdFx0fSxcblx0XHRcdHRydWUsXG5cdFx0XHRbJ2VuY3J5cHQnLCAnZGVjcnlwdCddXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0U2VydmVyS2V5UGFydCgpOiBQcm9taXNlPFVpbnQ4QXJyYXk+IHtcblx0XHRpZiAodGhpcy5zZXJ2ZXJLZXkpIHtcblx0XHRcdHJldHVybiB0aGlzLnNlcnZlcktleTtcblx0XHR9XG5cblx0XHRsZXQgYXR0ZW1wdCA9IDA7XG5cdFx0bGV0IGxhc3RFcnJvcjogRXJyb3IgfCB1bmRlZmluZWQ7XG5cblx0XHR3aGlsZSAoYXR0ZW1wdCA8PSAzKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh0aGlzLmF1dGhFbmRwb2ludCwgeyBjcmVkZW50aWFsczogJ2luY2x1ZGUnLCBtZXRob2Q6ICdQT1NUJyB9KTtcblx0XHRcdFx0aWYgKCFyZXMub2spIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IocmVzLnN0YXR1c1RleHQpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgc2VydmVyS2V5ID0gbmV3IFVpbnQ4QXJyYXkoYXdhaXQgcmVzLmFycmF5QnVmZmVyKCkpO1xuXHRcdFx0XHRpZiAoc2VydmVyS2V5LmJ5dGVMZW5ndGggIT09IEFFU0NvbnN0YW50cy5LRVlfTEVOR1RIIC8gOCkge1xuXHRcdFx0XHRcdHRocm93IEVycm9yKGBUaGUga2V5IHJldHJpZXZlZCBieSB0aGUgc2VydmVyIGlzIG5vdCAke0FFU0NvbnN0YW50cy5LRVlfTEVOR1RIfSBiaXQgbG9uZy5gKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuc2VydmVyS2V5ID0gc2VydmVyS2V5O1xuXG5cdFx0XHRcdHJldHVybiB0aGlzLnNlcnZlcktleTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0bGFzdEVycm9yID0gZSBpbnN0YW5jZW9mIEVycm9yID8gZSA6IG5ldyBFcnJvcihTdHJpbmcoZSkpO1xuXHRcdFx0XHRhdHRlbXB0Kys7XG5cblx0XHRcdFx0Ly8gZXhwb25lbnRpYWwgYmFja29mZlxuXHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgYXR0ZW1wdCAqIGF0dGVtcHQgKiAxMDApKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAobGFzdEVycm9yKSB7XG5cdFx0XHR0aHJvdyBuZXcgTmV0d29ya0Vycm9yKGxhc3RFcnJvcik7XG5cdFx0fVxuXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVycm9yJyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIExvY2FsU3RvcmFnZVNlY3JldFN0b3JhZ2VQcm92aWRlciBpbXBsZW1lbnRzIElTZWNyZXRTdG9yYWdlUHJvdmlkZXIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZUtleSA9ICdzZWNyZXRzLnByb3ZpZGVyJztcblxuXHRwcml2YXRlIHNlY3JldHNQcm9taXNlOiBQcm9taXNlPFJlY29yZDxzdHJpbmcsIHN0cmluZz4+O1xuXG5cdHR5cGU6ICdpbi1tZW1vcnknIHwgJ3BlcnNpc3RlZCcgfCAndW5rbm93bicgPSAncGVyc2lzdGVkJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNyeXB0bzogSVNlY3JldFN0b3JhZ2VDcnlwdG8sXG5cdCkge1xuXHRcdHRoaXMuc2VjcmV0c1Byb21pc2UgPSB0aGlzLmxvYWQoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgbG9hZCgpOiBQcm9taXNlPFJlY29yZDxzdHJpbmcsIHN0cmluZz4+IHtcblx0XHRjb25zdCByZWNvcmQgPSB0aGlzLmxvYWRBdXRoU2Vzc2lvbkZyb21FbGVtZW50KCk7XG5cblx0XHRjb25zdCBlbmNyeXB0ZWQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSh0aGlzLnN0b3JhZ2VLZXkpO1xuXHRcdGlmIChlbmNyeXB0ZWQpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGRlY3J5cHRlZCA9IEpTT04ucGFyc2UoYXdhaXQgdGhpcy5jcnlwdG8udW5zZWFsKGVuY3J5cHRlZCkpO1xuXG5cdFx0XHRcdHJldHVybiB7IC4uLnJlY29yZCwgLi4uZGVjcnlwdGVkIH07XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0Ly8gVE9ETzogc2VuZCB0ZWxlbWV0cnlcblx0XHRcdFx0Y29uc29sZS5lcnJvcignRmFpbGVkIHRvIGRlY3J5cHQgc2VjcmV0cyBmcm9tIGxvY2FsU3RvcmFnZScsIGVycik7XG5cdFx0XHRcdGlmICghKGVyciBpbnN0YW5jZW9mIE5ldHdvcmtFcnJvcikpIHtcblx0XHRcdFx0XHRsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSh0aGlzLnN0b3JhZ2VLZXkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlY29yZDtcblx0fVxuXG5cdHByaXZhdGUgbG9hZEF1dGhTZXNzaW9uRnJvbUVsZW1lbnQoKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG5cdFx0bGV0IGF1dGhTZXNzaW9uSW5mbzogKEF1dGhlbnRpY2F0aW9uU2Vzc2lvbkluZm8gJiB7IHNjb3Blczogc3RyaW5nW11bXSB9KSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBhdXRoU2Vzc2lvbkVsZW1lbnQgPSBtYWluV2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd2c2NvZGUtd29ya2JlbmNoLWF1dGgtc2Vzc2lvbicpO1xuXHRcdGNvbnN0IGF1dGhTZXNzaW9uRWxlbWVudEF0dHJpYnV0ZSA9IGF1dGhTZXNzaW9uRWxlbWVudCA/IGF1dGhTZXNzaW9uRWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtc2V0dGluZ3MnKSA6IHVuZGVmaW5lZDtcblx0XHRpZiAoYXV0aFNlc3Npb25FbGVtZW50QXR0cmlidXRlKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhdXRoU2Vzc2lvbkluZm8gPSBKU09OLnBhcnNlKGF1dGhTZXNzaW9uRWxlbWVudEF0dHJpYnV0ZSk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikgeyAvKiBJbnZhbGlkIHNlc3Npb24gaXMgcGFzc2VkLiBJZ25vcmUuICovIH1cblx0XHR9XG5cblx0XHRpZiAoIWF1dGhTZXNzaW9uSW5mbykge1xuXHRcdFx0cmV0dXJuIHt9O1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlY29yZDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuXG5cdFx0Ly8gU2V0dGluZ3MgU3luYyBFbnRyeVxuXHRcdHJlY29yZFtgJHtwcm9kdWN0LnVybFByb3RvY29sfS5sb2dpbkFjY291bnRgXSA9IEpTT04uc3RyaW5naWZ5KGF1dGhTZXNzaW9uSW5mbyk7XG5cblx0XHQvLyBBdXRoIGV4dGVuc2lvbiBFbnRyeVxuXHRcdGlmIChhdXRoU2Vzc2lvbkluZm8ucHJvdmlkZXJJZCAhPT0gJ2dpdGh1YicpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoYFVuZXhwZWN0ZWQgYXV0aCBwcm92aWRlcjogJHthdXRoU2Vzc2lvbkluZm8ucHJvdmlkZXJJZH0uIEV4cGVjdGVkICdnaXRodWInLmApO1xuXHRcdFx0cmV0dXJuIHJlY29yZDtcblx0XHR9XG5cblx0XHRjb25zdCBhdXRoQWNjb3VudCA9IEpTT04uc3RyaW5naWZ5KHsgZXh0ZW5zaW9uSWQ6ICd2c2NvZGUuZ2l0aHViLWF1dGhlbnRpY2F0aW9uJywga2V5OiAnZ2l0aHViLmF1dGgnIH0pO1xuXHRcdHJlY29yZFthdXRoQWNjb3VudF0gPSBKU09OLnN0cmluZ2lmeShhdXRoU2Vzc2lvbkluZm8uc2NvcGVzLm1hcChzY29wZXMgPT4gKHtcblx0XHRcdGlkOiBhdXRoU2Vzc2lvbkluZm8uaWQsXG5cdFx0XHRzY29wZXMsXG5cdFx0XHRhY2Nlc3NUb2tlbjogYXV0aFNlc3Npb25JbmZvLmFjY2Vzc1Rva2VuXG5cdFx0fSkpKTtcblxuXHRcdHJldHVybiByZWNvcmQ7XG5cdH1cblxuXHRhc3luYyBnZXQoa2V5OiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHNlY3JldHMgPSBhd2FpdCB0aGlzLnNlY3JldHNQcm9taXNlO1xuXG5cdFx0cmV0dXJuIHNlY3JldHNba2V5XTtcblx0fVxuXG5cdGFzeW5jIHNldChrZXk6IHN0cmluZywgdmFsdWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHNlY3JldHMgPSBhd2FpdCB0aGlzLnNlY3JldHNQcm9taXNlO1xuXHRcdHNlY3JldHNba2V5XSA9IHZhbHVlO1xuXHRcdHRoaXMuc2VjcmV0c1Byb21pc2UgPSBQcm9taXNlLnJlc29sdmUoc2VjcmV0cyk7XG5cdFx0dGhpcy5zYXZlKCk7XG5cdH1cblxuXHRhc3luYyBkZWxldGUoa2V5OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzZWNyZXRzID0gYXdhaXQgdGhpcy5zZWNyZXRzUHJvbWlzZTtcblx0XHRkZWxldGUgc2VjcmV0c1trZXldO1xuXHRcdHRoaXMuc2VjcmV0c1Byb21pc2UgPSBQcm9taXNlLnJlc29sdmUoc2VjcmV0cyk7XG5cdFx0dGhpcy5zYXZlKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNhdmUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGVuY3J5cHRlZCA9IGF3YWl0IHRoaXMuY3J5cHRvLnNlYWwoSlNPTi5zdHJpbmdpZnkoYXdhaXQgdGhpcy5zZWNyZXRzUHJvbWlzZSkpO1xuXHRcdFx0bG9jYWxTdG9yYWdlLnNldEl0ZW0odGhpcy5zdG9yYWdlS2V5LCBlbmNyeXB0ZWQpO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0Y29uc29sZS5lcnJvcihlcnIpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBMb2NhbFN0b3JhZ2VVUkxDYWxsYmFja1Byb3ZpZGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElVUkxDYWxsYmFja1Byb3ZpZGVyIHtcblxuXHRwcml2YXRlIHN0YXRpYyBSRVFVRVNUX0lEID0gMDtcblxuXHRwcml2YXRlIHN0YXRpYyBRVUVSWV9LRVlTOiAoJ3NjaGVtZScgfCAnYXV0aG9yaXR5JyB8ICdwYXRoJyB8ICdxdWVyeScgfCAnZnJhZ21lbnQnKVtdID0gW1xuXHRcdCdzY2hlbWUnLFxuXHRcdCdhdXRob3JpdHknLFxuXHRcdCdwYXRoJyxcblx0XHQncXVlcnknLFxuXHRcdCdmcmFnbWVudCdcblx0XTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkNhbGxiYWNrID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8VVJJPigpKTtcblx0cmVhZG9ubHkgb25DYWxsYmFjayA9IHRoaXMuX29uQ2FsbGJhY2suZXZlbnQ7XG5cblx0cHJpdmF0ZSBwZW5kaW5nQ2FsbGJhY2tzID0gbmV3IFNldDxudW1iZXI+KCk7XG5cdHByaXZhdGUgbGFzdFRpbWVDaGVja2VkID0gRGF0ZS5ub3coKTtcblx0cHJpdmF0ZSBjaGVja0NhbGxiYWNrc1RpbWVvdXQ6IHVua25vd24gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgb25EaWRDaGFuZ2VMb2NhbFN0b3JhZ2VEaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IF9jYWxsYmFja1JvdXRlOiBzdHJpbmcpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0Y3JlYXRlKG9wdGlvbnM6IFBhcnRpYWw8VXJpQ29tcG9uZW50cz4gPSB7fSk6IFVSSSB7XG5cdFx0Y29uc3QgaWQgPSArK0xvY2FsU3RvcmFnZVVSTENhbGxiYWNrUHJvdmlkZXIuUkVRVUVTVF9JRDtcblx0XHRjb25zdCBxdWVyeVBhcmFtczogc3RyaW5nW10gPSBbYHZzY29kZS1yZXFpZD0ke2lkfWBdO1xuXG5cdFx0Zm9yIChjb25zdCBrZXkgb2YgTG9jYWxTdG9yYWdlVVJMQ2FsbGJhY2tQcm92aWRlci5RVUVSWV9LRVlTKSB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IG9wdGlvbnNba2V5XTtcblxuXHRcdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRcdHF1ZXJ5UGFyYW1zLnB1c2goYHZzY29kZS0ke2tleX09JHtlbmNvZGVVUklDb21wb25lbnQodmFsdWUpfWApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFRPRE9Aam9hbyByZW1vdmUgZXZlbnR1YWxseVxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlLWRldi9pc3N1ZXMvNjJcblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9ibG9iLzE1OTQ3OWViNWFlNDUxYTY2YjVkYWMzYzEyZDU2NGYzMmY0NTQ3OTYvZXh0ZW5zaW9ucy9naXRodWItYXV0aGVudGljYXRpb24vc3JjL2dpdGh1YlNlcnZlci50cyNMNTAtTDUwXG5cdFx0aWYgKCEob3B0aW9ucy5hdXRob3JpdHkgPT09ICd2c2NvZGUuZ2l0aHViLWF1dGhlbnRpY2F0aW9uJyAmJiBvcHRpb25zLnBhdGggPT09ICcvZHVtbXknKSkge1xuXHRcdFx0Y29uc3Qga2V5ID0gYHZzY29kZS13ZWIudXJsLWNhbGxiYWNrc1ske2lkfV1gO1xuXHRcdFx0bG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oa2V5KTtcblxuXHRcdFx0dGhpcy5wZW5kaW5nQ2FsbGJhY2tzLmFkZChpZCk7XG5cdFx0XHR0aGlzLnN0YXJ0TGlzdGVuaW5nKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFVSSS5wYXJzZShtYWluV2luZG93LmxvY2F0aW9uLmhyZWYpLndpdGgoeyBwYXRoOiB0aGlzLl9jYWxsYmFja1JvdXRlLCBxdWVyeTogcXVlcnlQYXJhbXMuam9pbignJicpIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGFydExpc3RlbmluZygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5vbkRpZENoYW5nZUxvY2FsU3RvcmFnZURpc3Bvc2FibGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBmbiA9ICgpID0+IHRoaXMub25EaWRDaGFuZ2VMb2NhbFN0b3JhZ2UoKTtcblx0XHRtYWluV2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3N0b3JhZ2UnLCBmbik7XG5cdFx0dGhpcy5vbkRpZENoYW5nZUxvY2FsU3RvcmFnZURpc3Bvc2FibGUgPSB7IGRpc3Bvc2U6ICgpID0+IG1haW5XaW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignc3RvcmFnZScsIGZuKSB9O1xuXHR9XG5cblx0cHJpdmF0ZSBzdG9wTGlzdGVuaW5nKCk6IHZvaWQge1xuXHRcdHRoaXMub25EaWRDaGFuZ2VMb2NhbFN0b3JhZ2VEaXNwb3NhYmxlPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5vbkRpZENoYW5nZUxvY2FsU3RvcmFnZURpc3Bvc2FibGUgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHQvLyB0aGlzIGZpcmVzIGV2ZXJ5IHRpbWUgbG9jYWwgc3RvcmFnZSBjaGFuZ2VzLCBidXQgd2Vcblx0Ly8gZG9uJ3Qgd2FudCB0byBjaGVjayBtb3JlIG9mdGVuIHRoYW4gb25jZSBhIHNlY29uZFxuXHRwcml2YXRlIGFzeW5jIG9uRGlkQ2hhbmdlTG9jYWxTdG9yYWdlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVsbGFwc2VkID0gRGF0ZS5ub3coKSAtIHRoaXMubGFzdFRpbWVDaGVja2VkO1xuXG5cdFx0aWYgKGVsbGFwc2VkID4gMTAwMCkge1xuXHRcdFx0dGhpcy5jaGVja0NhbGxiYWNrcygpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5jaGVja0NhbGxiYWNrc1RpbWVvdXQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5jaGVja0NhbGxiYWNrc1RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0dGhpcy5jaGVja0NhbGxiYWNrc1RpbWVvdXQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuY2hlY2tDYWxsYmFja3MoKTtcblx0XHRcdH0sIDEwMDAgLSBlbGxhcHNlZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjaGVja0NhbGxiYWNrcygpOiB2b2lkIHtcblx0XHRsZXQgcGVuZGluZ0NhbGxiYWNrczogU2V0PG51bWJlcj4gfCB1bmRlZmluZWQ7XG5cblx0XHRmb3IgKGNvbnN0IGlkIG9mIHRoaXMucGVuZGluZ0NhbGxiYWNrcykge1xuXHRcdFx0Y29uc3Qga2V5ID0gYHZzY29kZS13ZWIudXJsLWNhbGxiYWNrc1ske2lkfV1gO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KTtcblxuXHRcdFx0aWYgKHJlc3VsdCAhPT0gbnVsbCkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHRoaXMuX29uQ2FsbGJhY2suZmlyZShVUkkucmV2aXZlKEpTT04ucGFyc2UocmVzdWx0KSkpO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cGVuZGluZ0NhbGxiYWNrcyA9IHBlbmRpbmdDYWxsYmFja3MgPz8gbmV3IFNldCh0aGlzLnBlbmRpbmdDYWxsYmFja3MpO1xuXHRcdFx0XHRwZW5kaW5nQ2FsbGJhY2tzLmRlbGV0ZShpZCk7XG5cdFx0XHRcdGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKGtleSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHBlbmRpbmdDYWxsYmFja3MpIHtcblx0XHRcdHRoaXMucGVuZGluZ0NhbGxiYWNrcyA9IHBlbmRpbmdDYWxsYmFja3M7XG5cblx0XHRcdGlmICh0aGlzLnBlbmRpbmdDYWxsYmFja3Muc2l6ZSA9PT0gMCkge1xuXHRcdFx0XHR0aGlzLnN0b3BMaXN0ZW5pbmcoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLmxhc3RUaW1lQ2hlY2tlZCA9IERhdGUubm93KCk7XG5cdH1cbn1cblxuY2xhc3MgV29ya3NwYWNlUHJvdmlkZXIgaW1wbGVtZW50cyBJV29ya3NwYWNlUHJvdmlkZXIge1xuXG5cdHByaXZhdGUgc3RhdGljIFFVRVJZX1BBUkFNX0VNUFRZX1dJTkRPVyA9ICdldyc7XG5cdHByaXZhdGUgc3RhdGljIFFVRVJZX1BBUkFNX0ZPTERFUiA9ICdmb2xkZXInO1xuXHRwcml2YXRlIHN0YXRpYyBRVUVSWV9QQVJBTV9XT1JLU1BBQ0UgPSAnd29ya3NwYWNlJztcblxuXHRwcml2YXRlIHN0YXRpYyBRVUVSWV9QQVJBTV9QQVlMT0FEID0gJ3BheWxvYWQnO1xuXG5cdHN0YXRpYyBjcmVhdGUoY29uZmlnOiBJV29ya2JlbmNoQ29uc3RydWN0aW9uT3B0aW9ucyAmIHsgZm9sZGVyVXJpPzogVXJpQ29tcG9uZW50czsgd29ya3NwYWNlVXJpPzogVXJpQ29tcG9uZW50cyB9KSB7XG5cdFx0bGV0IGZvdW5kV29ya3NwYWNlID0gZmFsc2U7XG5cdFx0bGV0IHdvcmtzcGFjZTogSVdvcmtzcGFjZTtcblx0XHRsZXQgcGF5bG9hZCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cblx0XHRjb25zdCBxdWVyeSA9IG5ldyBVUkwoZG9jdW1lbnQubG9jYXRpb24uaHJlZikuc2VhcmNoUGFyYW1zO1xuXHRcdHF1ZXJ5LmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcblx0XHRcdHN3aXRjaCAoa2V5KSB7XG5cblx0XHRcdFx0Ly8gRm9sZGVyXG5cdFx0XHRcdGNhc2UgV29ya3NwYWNlUHJvdmlkZXIuUVVFUllfUEFSQU1fRk9MREVSOlxuXHRcdFx0XHRcdGlmIChjb25maWcucmVtb3RlQXV0aG9yaXR5ICYmIHZhbHVlLnN0YXJ0c1dpdGgocG9zaXguc2VwKSkge1xuXHRcdFx0XHRcdFx0Ly8gd2hlbiBjb25uZWN0ZWQgdG8gYSByZW1vdGUgYW5kIGhhdmluZyBhIHZhbHVlXG5cdFx0XHRcdFx0XHQvLyB0aGF0IGlzIGEgcGF0aCAoYmVnaW5zIHdpdGggYSBgL2ApLCBhc3N1bWUgdGhpc1xuXHRcdFx0XHRcdFx0Ly8gaXMgYSB2c2NvZGUtcmVtb3RlIHJlc291cmNlIGFzIHNpbXBsaWZpZWQgVVJMLlxuXHRcdFx0XHRcdFx0d29ya3NwYWNlID0geyBmb2xkZXJVcmk6IFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLnZzY29kZVJlbW90ZSwgcGF0aDogdmFsdWUsIGF1dGhvcml0eTogY29uZmlnLnJlbW90ZUF1dGhvcml0eSB9KSB9O1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR3b3Jrc3BhY2UgPSB7IGZvbGRlclVyaTogVVJJLnBhcnNlKHZhbHVlKSB9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmb3VuZFdvcmtzcGFjZSA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Ly8gV29ya3NwYWNlXG5cdFx0XHRcdGNhc2UgV29ya3NwYWNlUHJvdmlkZXIuUVVFUllfUEFSQU1fV09SS1NQQUNFOlxuXHRcdFx0XHRcdGlmIChjb25maWcucmVtb3RlQXV0aG9yaXR5ICYmIHZhbHVlLnN0YXJ0c1dpdGgocG9zaXguc2VwKSkge1xuXHRcdFx0XHRcdFx0Ly8gd2hlbiBjb25uZWN0ZWQgdG8gYSByZW1vdGUgYW5kIGhhdmluZyBhIHZhbHVlXG5cdFx0XHRcdFx0XHQvLyB0aGF0IGlzIGEgcGF0aCAoYmVnaW5zIHdpdGggYSBgL2ApLCBhc3N1bWUgdGhpc1xuXHRcdFx0XHRcdFx0Ly8gaXMgYSB2c2NvZGUtcmVtb3RlIHJlc291cmNlIGFzIHNpbXBsaWZpZWQgVVJMLlxuXHRcdFx0XHRcdFx0d29ya3NwYWNlID0geyB3b3Jrc3BhY2VVcmk6IFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLnZzY29kZVJlbW90ZSwgcGF0aDogdmFsdWUsIGF1dGhvcml0eTogY29uZmlnLnJlbW90ZUF1dGhvcml0eSB9KSB9O1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR3b3Jrc3BhY2UgPSB7IHdvcmtzcGFjZVVyaTogVVJJLnBhcnNlKHZhbHVlKSB9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmb3VuZFdvcmtzcGFjZSA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Ly8gRW1wdHlcblx0XHRcdFx0Y2FzZSBXb3Jrc3BhY2VQcm92aWRlci5RVUVSWV9QQVJBTV9FTVBUWV9XSU5ET1c6XG5cdFx0XHRcdFx0d29ya3NwYWNlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGZvdW5kV29ya3NwYWNlID0gdHJ1ZTtcblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHQvLyBQYXlsb2FkXG5cdFx0XHRcdGNhc2UgV29ya3NwYWNlUHJvdmlkZXIuUVVFUllfUEFSQU1fUEFZTE9BRDpcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0cGF5bG9hZCA9IHBhcnNlKHZhbHVlKTsgLy8gdXNlIG1hcnNoYWxsaW5nI3BhcnNlKCkgdG8gcmV2aXZlIHBvdGVudGlhbCBVUklzXG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoZXJyb3IpOyAvLyBwb3NzaWJsZSBpbnZhbGlkIEpTT05cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHQvLyBJZiBubyB3b3Jrc3BhY2UgaXMgcHJvdmlkZWQgdGhyb3VnaCB0aGUgVVJMLCBjaGVjayBmb3IgY29uZmlnXG5cdFx0Ly8gYXR0cmlidXRlIGZyb20gc2VydmVyXG5cdFx0aWYgKCFmb3VuZFdvcmtzcGFjZSkge1xuXHRcdFx0aWYgKGNvbmZpZy5mb2xkZXJVcmkpIHtcblx0XHRcdFx0d29ya3NwYWNlID0geyBmb2xkZXJVcmk6IFVSSS5yZXZpdmUoY29uZmlnLmZvbGRlclVyaSkgfTtcblx0XHRcdH0gZWxzZSBpZiAoY29uZmlnLndvcmtzcGFjZVVyaSkge1xuXHRcdFx0XHR3b3Jrc3BhY2UgPSB7IHdvcmtzcGFjZVVyaTogVVJJLnJldml2ZShjb25maWcud29ya3NwYWNlVXJpKSB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgV29ya3NwYWNlUHJvdmlkZXIod29ya3NwYWNlLCBwYXlsb2FkLCBjb25maWcpO1xuXHR9XG5cblx0cmVhZG9ubHkgdHJ1c3RlZCA9IHRydWU7XG5cblx0cHJpdmF0ZSBjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSB3b3Jrc3BhY2U6IElXb3Jrc3BhY2UsXG5cdFx0cmVhZG9ubHkgcGF5bG9hZDogb2JqZWN0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29uZmlnOiBJV29ya2JlbmNoQ29uc3RydWN0aW9uT3B0aW9uc1xuXHQpIHtcblx0fVxuXG5cdGFzeW5jIG9wZW4od29ya3NwYWNlOiBJV29ya3NwYWNlLCBvcHRpb25zPzogeyByZXVzZT86IGJvb2xlYW47IHBheWxvYWQ/OiBvYmplY3QgfSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmIChvcHRpb25zPy5yZXVzZSAmJiAhb3B0aW9ucy5wYXlsb2FkICYmIHRoaXMuaXNTYW1lKHRoaXMud29ya3NwYWNlLCB3b3Jrc3BhY2UpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gcmV0dXJuIGVhcmx5IGlmIHdvcmtzcGFjZSBhbmQgZW52aXJvbm1lbnQgaXMgbm90IGNoYW5naW5nIGFuZCB3ZSBhcmUgcmV1c2luZyB3aW5kb3dcblx0XHR9XG5cblx0XHRjb25zdCB0YXJnZXRIcmVmID0gdGhpcy5jcmVhdGVUYXJnZXRVcmwod29ya3NwYWNlLCBvcHRpb25zKTtcblx0XHRpZiAodGFyZ2V0SHJlZikge1xuXHRcdFx0aWYgKG9wdGlvbnM/LnJldXNlKSB7XG5cdFx0XHRcdG1haW5XaW5kb3cubG9jYXRpb24uaHJlZiA9IHRhcmdldEhyZWY7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGV0IHJlc3VsdDtcblx0XHRcdFx0aWYgKGlzU3RhbmRhbG9uZSgpKSB7XG5cdFx0XHRcdFx0cmVzdWx0ID0gbWFpbldpbmRvdy5vcGVuKHRhcmdldEhyZWYsICdfYmxhbmsnLCAndG9vbGJhcj1ubycpOyAvLyBlbnN1cmVzIHRvIG9wZW4gYW5vdGhlciAnc3RhbmRhbG9uZScgd2luZG93IVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc3VsdCA9IG1haW5XaW5kb3cub3Blbih0YXJnZXRIcmVmKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiAhIXJlc3VsdDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVRhcmdldFVybCh3b3Jrc3BhY2U6IElXb3Jrc3BhY2UsIG9wdGlvbnM/OiB7IHJldXNlPzogYm9vbGVhbjsgcGF5bG9hZD86IG9iamVjdCB9KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblxuXHRcdC8vIEVtcHR5XG5cdFx0bGV0IHRhcmdldEhyZWY6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAoIXdvcmtzcGFjZSkge1xuXHRcdFx0dGFyZ2V0SHJlZiA9IGAke2RvY3VtZW50LmxvY2F0aW9uLm9yaWdpbn0ke2RvY3VtZW50LmxvY2F0aW9uLnBhdGhuYW1lfT8ke1dvcmtzcGFjZVByb3ZpZGVyLlFVRVJZX1BBUkFNX0VNUFRZX1dJTkRPV309dHJ1ZWA7XG5cdFx0fVxuXG5cdFx0Ly8gRm9sZGVyXG5cdFx0ZWxzZSBpZiAoaXNGb2xkZXJUb09wZW4od29ya3NwYWNlKSkge1xuXHRcdFx0Y29uc3QgcXVlcnlQYXJhbUZvbGRlciA9IHRoaXMuZW5jb2RlV29ya3NwYWNlUGF0aCh3b3Jrc3BhY2UuZm9sZGVyVXJpKTtcblx0XHRcdHRhcmdldEhyZWYgPSBgJHtkb2N1bWVudC5sb2NhdGlvbi5vcmlnaW59JHtkb2N1bWVudC5sb2NhdGlvbi5wYXRobmFtZX0/JHtXb3Jrc3BhY2VQcm92aWRlci5RVUVSWV9QQVJBTV9GT0xERVJ9PSR7cXVlcnlQYXJhbUZvbGRlcn1gO1xuXHRcdH1cblxuXHRcdC8vIFdvcmtzcGFjZVxuXHRcdGVsc2UgaWYgKGlzV29ya3NwYWNlVG9PcGVuKHdvcmtzcGFjZSkpIHtcblx0XHRcdGNvbnN0IHF1ZXJ5UGFyYW1Xb3Jrc3BhY2UgPSB0aGlzLmVuY29kZVdvcmtzcGFjZVBhdGgod29ya3NwYWNlLndvcmtzcGFjZVVyaSk7XG5cdFx0XHR0YXJnZXRIcmVmID0gYCR7ZG9jdW1lbnQubG9jYXRpb24ub3JpZ2lufSR7ZG9jdW1lbnQubG9jYXRpb24ucGF0aG5hbWV9PyR7V29ya3NwYWNlUHJvdmlkZXIuUVVFUllfUEFSQU1fV09SS1NQQUNFfT0ke3F1ZXJ5UGFyYW1Xb3Jrc3BhY2V9YDtcblx0XHR9XG5cblx0XHQvLyBBcHBlbmQgcGF5bG9hZCBpZiBhbnlcblx0XHRpZiAob3B0aW9ucz8ucGF5bG9hZCkge1xuXHRcdFx0dGFyZ2V0SHJlZiArPSBgJiR7V29ya3NwYWNlUHJvdmlkZXIuUVVFUllfUEFSQU1fUEFZTE9BRH09JHtlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkob3B0aW9ucy5wYXlsb2FkKSl9YDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGFyZ2V0SHJlZjtcblx0fVxuXG5cdHByaXZhdGUgZW5jb2RlV29ya3NwYWNlUGF0aCh1cmk6IFVSSSk6IHN0cmluZyB7XG5cdFx0aWYgKHRoaXMuY29uZmlnLnJlbW90ZUF1dGhvcml0eSAmJiB1cmkuc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZVJlbW90ZSkge1xuXG5cdFx0XHQvLyB3aGVuIGNvbm5lY3RlZCB0byBhIHJlbW90ZSBhbmQgaGF2aW5nIGEgZm9sZGVyXG5cdFx0XHQvLyBvciB3b3Jrc3BhY2UgZm9yIHRoYXQgcmVtb3RlLCBvbmx5IHVzZSB0aGUgcGF0aFxuXHRcdFx0Ly8gYXMgcXVlcnkgdmFsdWUgdG8gZm9ybSBzaG9ydGVyLCBuaWNlciBVUkxzLlxuXHRcdFx0Ly8gaG93ZXZlciwgd2Ugc3RpbGwgbmVlZCB0byBgZW5jb2RlVVJJQ29tcG9uZW50YFxuXHRcdFx0Ly8gdG8gZW5zdXJlIHRvIHByZXNlcnZlIHNwZWNpYWwgY2hhcmFjdGVycywgc3VjaFxuXHRcdFx0Ly8gYXMgYCtgIGluIHRoZSBwYXRoLlxuXG5cdFx0XHRyZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KGAke3Bvc2l4LnNlcH0ke2x0cmltKHVyaS5wYXRoLCBwb3NpeC5zZXApfWApLnJlcGxhY2VBbGwoJyUyRicsICcvJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudCh1cmkudG9TdHJpbmcodHJ1ZSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1NhbWUod29ya3NwYWNlQTogSVdvcmtzcGFjZSwgd29ya3NwYWNlQjogSVdvcmtzcGFjZSk6IGJvb2xlYW4ge1xuXHRcdGlmICghd29ya3NwYWNlQSB8fCAhd29ya3NwYWNlQikge1xuXHRcdFx0cmV0dXJuIHdvcmtzcGFjZUEgPT09IHdvcmtzcGFjZUI7IC8vIGJvdGggZW1wdHlcblx0XHR9XG5cblx0XHRpZiAoaXNGb2xkZXJUb09wZW4od29ya3NwYWNlQSkgJiYgaXNGb2xkZXJUb09wZW4od29ya3NwYWNlQikpIHtcblx0XHRcdHJldHVybiBpc0VxdWFsKHdvcmtzcGFjZUEuZm9sZGVyVXJpLCB3b3Jrc3BhY2VCLmZvbGRlclVyaSk7IC8vIHNhbWUgd29ya3NwYWNlXG5cdFx0fVxuXG5cdFx0aWYgKGlzV29ya3NwYWNlVG9PcGVuKHdvcmtzcGFjZUEpICYmIGlzV29ya3NwYWNlVG9PcGVuKHdvcmtzcGFjZUIpKSB7XG5cdFx0XHRyZXR1cm4gaXNFcXVhbCh3b3Jrc3BhY2VBLndvcmtzcGFjZVVyaSwgd29ya3NwYWNlQi53b3Jrc3BhY2VVcmkpOyAvLyBzYW1lIHdvcmtzcGFjZVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGhhc1JlbW90ZSgpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy53b3Jrc3BhY2UpIHtcblx0XHRcdGlmIChpc0ZvbGRlclRvT3Blbih0aGlzLndvcmtzcGFjZSkpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMud29ya3NwYWNlLmZvbGRlclVyaS5zY2hlbWUgPT09IFNjaGVtYXMudnNjb2RlUmVtb3RlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaXNXb3Jrc3BhY2VUb09wZW4odGhpcy53b3Jrc3BhY2UpKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLndvcmtzcGFjZS53b3Jrc3BhY2VVcmkuc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZVJlbW90ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufVxuXG5mdW5jdGlvbiByZWFkQ29va2llKG5hbWU6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGNvb2tpZXMgPSBkb2N1bWVudC5jb29raWUuc3BsaXQoJzsgJyk7XG5cdGZvciAoY29uc3QgY29va2llIG9mIGNvb2tpZXMpIHtcblx0XHRpZiAoY29va2llLnN0YXJ0c1dpdGgobmFtZSArICc9JykpIHtcblx0XHRcdHJldHVybiBjb29raWUuc3Vic3RyaW5nKG5hbWUubGVuZ3RoICsgMSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuKGZ1bmN0aW9uICgpIHtcblxuXHQvLyBGaW5kIGNvbmZpZyBieSBjaGVja2luZyBmb3IgRE9NXG5cdGNvbnN0IGNvbmZpZ0VsZW1lbnQgPSBtYWluV2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd2c2NvZGUtd29ya2JlbmNoLXdlYi1jb25maWd1cmF0aW9uJyk7XG5cdGNvbnN0IGNvbmZpZ0VsZW1lbnRBdHRyaWJ1dGUgPSBjb25maWdFbGVtZW50ID8gY29uZmlnRWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtc2V0dGluZ3MnKSA6IHVuZGVmaW5lZDtcblx0aWYgKCFjb25maWdFbGVtZW50IHx8ICFjb25maWdFbGVtZW50QXR0cmlidXRlKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNaXNzaW5nIHdlYiBjb25maWd1cmF0aW9uIGVsZW1lbnQnKTtcblx0fVxuXHRjb25zdCBjb25maWc6IElXb3JrYmVuY2hDb25zdHJ1Y3Rpb25PcHRpb25zICYgeyBmb2xkZXJVcmk/OiBVcmlDb21wb25lbnRzOyB3b3Jrc3BhY2VVcmk/OiBVcmlDb21wb25lbnRzOyBjYWxsYmFja1JvdXRlOiBzdHJpbmcgfSA9IEpTT04ucGFyc2UoY29uZmlnRWxlbWVudEF0dHJpYnV0ZSk7XG5cdGNvbnN0IHNlY3JldFN0b3JhZ2VLZXlQYXRoID0gcmVhZENvb2tpZSgndnNjb2RlLXNlY3JldC1rZXktcGF0aCcpO1xuXHRjb25zdCBzZWNyZXRTdG9yYWdlQ3J5cHRvID0gc2VjcmV0U3RvcmFnZUtleVBhdGggJiYgU2VydmVyS2V5ZWRBRVNDcnlwdG8uc3VwcG9ydGVkKClcblx0XHQ/IG5ldyBTZXJ2ZXJLZXllZEFFU0NyeXB0byhzZWNyZXRTdG9yYWdlS2V5UGF0aCkgOiBuZXcgVHJhbnNwYXJlbnRDcnlwdG8oKTtcblxuXHQvLyBDcmVhdGUgd29ya2JlbmNoXG5cdGNyZWF0ZShtYWluV2luZG93LmRvY3VtZW50LmJvZHksIHtcblx0XHQuLi5jb25maWcsXG5cdFx0d2luZG93SW5kaWNhdG9yOiBjb25maWcud2luZG93SW5kaWNhdG9yID8/IHsgbGFiZWw6ICckKHJlbW90ZSknLCB0b29sdGlwOiBgJHtwcm9kdWN0Lm5hbWVTaG9ydH0gV2ViYCB9LFxuXHRcdHNldHRpbmdzU3luY09wdGlvbnM6IGNvbmZpZy5zZXR0aW5nc1N5bmNPcHRpb25zID8geyBlbmFibGVkOiBjb25maWcuc2V0dGluZ3NTeW5jT3B0aW9ucy5lbmFibGVkLCB9IDogdW5kZWZpbmVkLFxuXHRcdHdvcmtzcGFjZVByb3ZpZGVyOiBXb3Jrc3BhY2VQcm92aWRlci5jcmVhdGUoY29uZmlnKSxcblx0XHR1cmxDYWxsYmFja1Byb3ZpZGVyOiBuZXcgTG9jYWxTdG9yYWdlVVJMQ2FsbGJhY2tQcm92aWRlcihjb25maWcuY2FsbGJhY2tSb3V0ZSksXG5cdFx0c2VjcmV0U3RvcmFnZVByb3ZpZGVyOiBjb25maWcucmVtb3RlQXV0aG9yaXR5ICYmICFzZWNyZXRTdG9yYWdlS2V5UGF0aFxuXHRcdFx0PyB1bmRlZmluZWQgLyogd2l0aCBhIHJlbW90ZSB3aXRob3V0IGVtYmVkZGVyLXByZWZlcnJlZCBzdG9yYWdlLCBzdG9yZSBvbiB0aGUgcmVtb3RlICovXG5cdFx0XHQ6IG5ldyBMb2NhbFN0b3JhZ2VTZWNyZXRTdG9yYWdlUHJvdmlkZXIoc2VjcmV0U3RvcmFnZUNyeXB0byksXG5cdH0pO1xufSkoKTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsVUFBVSxjQUFjLG9CQUFvQjtBQUNyRCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxrQkFBK0I7QUFDeEMsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsYUFBYTtBQUN0QixTQUFT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QVMsR0FBRztBQUNuQyxlQUFPLEtBQUssVUFBVSxVQUFVLFdBQVcsUUFBUTtBQUFBLE1BQ3BEO0FBRUEsVUFBSSxrQkFBa0IsS0FBSyxTQUFTLEdBQUc7QUFDdEMsZUFBTyxLQUFLLFVBQVUsYUFBYSxXQUFXLFFBQVE7QUFBQSxNQUN2RDtBQUFBLElBQ0Q7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBcExNLG1CQUVVLDJCQUEyQjtBQUZyQyxtQkFHVSxxQkFBcUI7QUFIL0IsbUJBSVUsd0JBQXdCO0FBSmxDLG1CQU1VLHNCQUFzQjtBQU50QyxJQUFNLG9CQUFOO0FBc0xBLFNBQVMsV0FBVyxNQUFrQztBQUNyRCxRQUFNLFVBQVUsU0FBUyxPQUFPLE1BQU0sSUFBSTtBQUMxQyxhQUFXLFVBQVUsU0FBUztBQUM3QixRQUFJLE9BQU8sV0FBVyxPQUFPLEdBQUcsR0FBRztBQUNsQyxhQUFPLE9BQU8sVUFBVSxLQUFLLFNBQVMsQ0FBQztBQUFBLElBQ3hDO0FBQUEsRUFDRDtBQUVBLFNBQU87QUFDUjtBQUFBLENBRUMsV0FBWTtBQUdaLFFBQU0sZ0JBQWdCLFdBQVcsU0FBUyxlQUFlLG9DQUFvQztBQUM3RixRQUFNLHlCQUF5QixnQkFBZ0IsY0FBYyxhQUFhLGVBQWUsSUFBSTtBQUM3RixNQUFJLENBQUMsaUJBQWlCLENBQUMsd0JBQXdCO0FBQzlDLFVBQU0sSUFBSSxNQUFNLG1DQUFtQztBQUFBLEVBQ3BEO0FBQ0EsUUFBTSxTQUE2SCxLQUFLLE1BQU0sc0JBQXNCO0FBQ3BLLFFBQU0sdUJBQXVCLFdBQVcsd0JBQXdCO0FBQ2hFLFFBQU0sc0JBQXNCLHdCQUF3QixxQkFBcUIsVUFBVSxJQUNoRixJQUFJLHFCQUFxQixvQkFBb0IsSUFBSSxJQUFJLGtCQUFrQjtBQUcxRSxTQUFPLFdBQVcsU0FBUyxNQUFNO0FBQUEsSUFDaEMsR0FBRztBQUFBLElBQ0gsaUJBQWlCLE9BQU8sbUJBQW1CLEVBQUUsT0FBTyxhQUFhLFNBQVMsR0FBRyxRQUFRLFNBQVMsT0FBTztBQUFBLElBQ3JHLHFCQUFxQixPQUFPLHNCQUFzQixFQUFFLFNBQVMsT0FBTyxvQkFBb0IsUUFBUyxJQUFJO0FBQUEsSUFDckcsbUJBQW1CLGtCQUFrQixPQUFPLE1BQU07QUFBQSxJQUNsRCxxQkFBcUIsSUFBSSxnQ0FBZ0MsT0FBTyxhQUFhO0FBQUEsSUFDN0UsdUJBQXVCLE9BQU8sbUJBQW1CLENBQUMsdUJBQy9DLFNBQ0EsSUFBSSxrQ0FBa0MsbUJBQW1CO0FBQUEsRUFDN0QsQ0FBQztBQUNGLEdBQUc7IiwKICAibmFtZXMiOiBbIkFFU0NvbnN0YW50cyIsICJjcnlwdG8iXQp9Cg==
