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
import { createReadStream, promises } from "fs";
import * as path from "path";
import * as url from "url";
import * as cookie from "cookie";
import * as crypto from "crypto";
import { isEqualOrParent } from "../../base/common/extpath.js";
import { getMediaMime } from "../../base/common/mime.js";
import { isLinux } from "../../base/common/platform.js";
import { ILogService, LogLevel } from "../../platform/log/common/log.js";
import { IServerEnvironmentService } from "./serverEnvironmentService.js";
import { extname, dirname, join, normalize, posix } from "../../base/common/path.js";
import { FileAccess, connectionTokenCookieName, connectionTokenQueryName, Schemas, builtinExtensionsPath } from "../../base/common/network.js";
import { generateUuid } from "../../base/common/uuid.js";
import { IProductService } from "../../platform/product/common/productService.js";
import { ServerConnectionTokenType } from "./serverConnectionToken.js";
import { asTextOrError, IRequestService } from "../../platform/request/common/request.js";
import { CancellationToken } from "../../base/common/cancellation.js";
import { URI } from "../../base/common/uri.js";
import { streamToBuffer } from "../../base/common/buffer.js";
import { isString } from "../../base/common/types.js";
import { CharCode } from "../../base/common/charCode.js";
import { ICSSDevelopmentService } from "../../platform/cssDev/node/cssDevService.js";
const textMimeType = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".svg": "image/svg+xml"
};
async function serveError(req, res, errorCode, errorMessage) {
  res.writeHead(errorCode, { "Content-Type": "text/plain" });
  res.end(errorMessage);
}
var CacheControl = /* @__PURE__ */ ((CacheControl2) => {
  CacheControl2[CacheControl2["NO_CACHING"] = 0] = "NO_CACHING";
  CacheControl2[CacheControl2["ETAG"] = 1] = "ETAG";
  CacheControl2[CacheControl2["NO_EXPIRY"] = 2] = "NO_EXPIRY";
  return CacheControl2;
})(CacheControl || {});
async function serveFile(filePath, cacheControl, logService, req, res, responseHeaders) {
  try {
    const stat = await promises.stat(filePath);
    if (cacheControl === 1 /* ETAG */) {
      const etag = `W/"${[stat.ino, stat.size, stat.mtime.getTime()].join("-")}"`;
      if (req.headers["if-none-match"] === etag) {
        res.writeHead(304);
        return void res.end();
      }
      responseHeaders["Etag"] = etag;
    } else if (cacheControl === 2 /* NO_EXPIRY */) {
      responseHeaders["Cache-Control"] = "public, max-age=31536000";
    } else if (cacheControl === 0 /* NO_CACHING */) {
      responseHeaders["Cache-Control"] = "no-store";
    }
    responseHeaders["Content-Type"] = textMimeType[extname(filePath)] || getMediaMime(filePath) || "text/plain";
    res.writeHead(200, responseHeaders);
    createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code !== "ENOENT") {
      logService.error(error);
      console.error(error.toString());
    } else {
      console.error(`File not found: ${filePath}`);
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    return void res.end("Not found");
  }
}
const APP_ROOT = dirname(FileAccess.asFileUri("").fsPath);
const STATIC_PATH = `/static`;
const CALLBACK_PATH = `/callback`;
const WEB_EXTENSION_PATH = `/web-extension-resource`;
let WebClientServer = class {
  constructor(_connectionToken, _basePath, _productPath, _environmentService, _logService, _requestService, _productService, _cssDevService) {
    this._connectionToken = _connectionToken;
    this._basePath = _basePath;
    this._productPath = _productPath;
    this._environmentService = _environmentService;
    this._logService = _logService;
    this._requestService = _requestService;
    this._productService = _productService;
    this._cssDevService = _cssDevService;
    this._webExtensionResourceUrlTemplate = this._productService.extensionsGallery?.resourceUrlTemplate ? URI.parse(this._productService.extensionsGallery.resourceUrlTemplate) : void 0;
  }
  /**
   * Handle web resources (i.e. only needed by the web client).
   * **NOTE**: This method is only invoked when the server has web bits.
   * **NOTE**: This method is only invoked after the connection token has been validated.
   * @param parsedUrl The URL to handle, including base and product path
   * @param pathname The pathname of the URL, without base and product path
   */
  async handle(req, res, parsedUrl, pathname) {
    try {
      if (pathname.startsWith(STATIC_PATH) && pathname.charCodeAt(STATIC_PATH.length) === CharCode.Slash) {
        return this._handleStatic(req, res, pathname.substring(STATIC_PATH.length));
      }
      if (pathname === "/") {
        return this._handleRoot(req, res, parsedUrl);
      }
      if (pathname === CALLBACK_PATH) {
        return this._handleCallback(res);
      }
      if (pathname.startsWith(WEB_EXTENSION_PATH) && pathname.charCodeAt(WEB_EXTENSION_PATH.length) === CharCode.Slash) {
        return this._handleWebExtensionResource(req, res, pathname.substring(WEB_EXTENSION_PATH.length));
      }
      return serveError(req, res, 404, "Not found.");
    } catch (error) {
      this._logService.error(error);
      console.error(error.toString());
      return serveError(req, res, 500, "Internal Server Error.");
    }
  }
  /**
   * Handle HTTP requests for /static/*
   * @param resourcePath The path after /static/
   */
  async _handleStatic(req, res, resourcePath) {
    const headers = /* @__PURE__ */ Object.create(null);
    const normalizedPathname = decodeURIComponent(resourcePath);
    const filePath = join(APP_ROOT, normalizedPathname);
    if (!isEqualOrParent(filePath, APP_ROOT, !isLinux)) {
      return serveError(req, res, 400, `Bad request.`);
    }
    return serveFile(filePath, this._environmentService.isBuilt ? 2 /* NO_EXPIRY */ : 1 /* ETAG */, this._logService, req, res, headers);
  }
  _getResourceURLTemplateAuthority(uri) {
    const index = uri.authority.indexOf(".");
    return index !== -1 ? uri.authority.substring(index + 1) : void 0;
  }
  /**
   * Handle extension resources
   * @param resourcePath The path after /web-extension-resource/
   */
  async _handleWebExtensionResource(req, res, resourcePath) {
    if (!this._webExtensionResourceUrlTemplate) {
      return serveError(req, res, 500, "No extension gallery service configured.");
    }
    const normalizedPathname = decodeURIComponent(resourcePath);
    const path2 = normalize(normalizedPathname);
    const uri = URI.parse(path2).with({
      scheme: this._webExtensionResourceUrlTemplate.scheme,
      authority: path2.substring(0, path2.indexOf("/")),
      path: path2.substring(path2.indexOf("/") + 1)
    });
    if (this._getResourceURLTemplateAuthority(this._webExtensionResourceUrlTemplate) !== this._getResourceURLTemplateAuthority(uri)) {
      return serveError(req, res, 403, "Request Forbidden");
    }
    const headers = {};
    const setRequestHeader = (header) => {
      const value = req.headers[header];
      if (value && (isString(value) || value[0])) {
        headers[header] = isString(value) ? value : value[0];
      } else if (header !== header.toLowerCase()) {
        setRequestHeader(header.toLowerCase());
      }
    };
    setRequestHeader("X-Client-Name");
    setRequestHeader("X-Client-Version");
    setRequestHeader("X-Machine-Id");
    setRequestHeader("X-Client-Commit");
    const context = await this._requestService.request({
      type: "GET",
      url: uri.toString(true),
      headers
    }, CancellationToken.None);
    const status = context.res.statusCode || 500;
    if (status !== 200) {
      let text = null;
      try {
        text = await asTextOrError(context);
      } catch (error) {
      }
      return serveError(req, res, status, text || `Request failed with status ${status}`);
    }
    const responseHeaders = /* @__PURE__ */ Object.create(null);
    const setResponseHeader = (header) => {
      const value = context.res.headers[header];
      if (value) {
        responseHeaders[header] = value;
      } else if (header !== header.toLowerCase()) {
        setResponseHeader(header.toLowerCase());
      }
    };
    setResponseHeader("Cache-Control");
    setResponseHeader("Content-Type");
    res.writeHead(200, responseHeaders);
    const buffer = await streamToBuffer(context.stream);
    return void res.end(buffer.buffer);
  }
  /**
   * Handle HTTP requests for /
   */
  async _handleRoot(req, res, parsedUrl) {
    const getFirstHeader = (headerName) => {
      const val = req.headers[headerName];
      return Array.isArray(val) ? val[0] : val;
    };
    const basePath = getFirstHeader("x-forwarded-prefix") || this._basePath;
    const queryConnectionToken = parsedUrl.query[connectionTokenQueryName];
    if (typeof queryConnectionToken === "string") {
      const responseHeaders = /* @__PURE__ */ Object.create(null);
      responseHeaders["Set-Cookie"] = cookie.serialize(
        connectionTokenCookieName,
        queryConnectionToken,
        {
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7
          /* 1 week */
        }
      );
      const newQuery = /* @__PURE__ */ Object.create(null);
      for (const key in parsedUrl.query) {
        if (key !== connectionTokenQueryName) {
          newQuery[key] = parsedUrl.query[key];
        }
      }
      const newLocation = url.format({ pathname: basePath, query: newQuery });
      responseHeaders["Location"] = newLocation;
      res.writeHead(302, responseHeaders);
      return void res.end();
    }
    const replacePort = (host, port) => {
      const index = host?.indexOf(":");
      if (index !== -1) {
        host = host?.substring(0, index);
      }
      host += `:${port}`;
      return host;
    };
    const useTestResolver = !this._environmentService.isBuilt && this._environmentService.args["use-test-resolver"];
    let remoteAuthority = useTestResolver ? "test+test" : getFirstHeader("x-original-host") || getFirstHeader("x-forwarded-host") || req.headers.host;
    if (!remoteAuthority) {
      return serveError(req, res, 400, `Bad request.`);
    }
    const forwardedPort = getFirstHeader("x-forwarded-port");
    if (forwardedPort) {
      remoteAuthority = replacePort(remoteAuthority, forwardedPort);
    }
    function asJSON(value) {
      return JSON.stringify(value).replace(/"/g, "&quot;");
    }
    let _wrapWebWorkerExtHostInIframe = void 0;
    if (this._environmentService.args["enable-smoke-test-driver"]) {
      _wrapWebWorkerExtHostInIframe = false;
    }
    if (this._logService.getLevel() === LogLevel.Trace) {
      ["x-original-host", "x-forwarded-host", "x-forwarded-port", "host"].forEach((header) => {
        const value = getFirstHeader(header);
        if (value) {
          this._logService.trace(`[WebClientServer] ${header}: ${value}`);
        }
      });
      this._logService.trace(`[WebClientServer] Request URL: ${req.url}, basePath: ${basePath}, remoteAuthority: ${remoteAuthority}`);
    }
    const staticRoute = posix.join(basePath, this._productPath, STATIC_PATH);
    const callbackRoute = posix.join(basePath, this._productPath, CALLBACK_PATH);
    const webExtensionRoute = posix.join(basePath, this._productPath, WEB_EXTENSION_PATH);
    const resolveWorkspaceURI = (defaultLocation) => defaultLocation && URI.file(path.resolve(defaultLocation)).with({ scheme: Schemas.vscodeRemote, authority: remoteAuthority });
    const filePath = FileAccess.asFileUri(`vs/code/browser/workbench/workbench${this._environmentService.isBuilt ? "" : "-dev"}.html`).fsPath;
    const authSessionInfo = !this._environmentService.isBuilt && this._environmentService.args["github-auth"] ? {
      id: generateUuid(),
      providerId: "github",
      accessToken: this._environmentService.args["github-auth"],
      scopes: [["user:email"], ["repo"]]
    } : void 0;
    const productConfiguration = {
      embedderIdentifier: "server-distro",
      extensionsGallery: this._webExtensionResourceUrlTemplate && this._productService.extensionsGallery ? {
        ...this._productService.extensionsGallery,
        resourceUrlTemplate: this._webExtensionResourceUrlTemplate.with({
          scheme: "http",
          authority: remoteAuthority,
          path: `${webExtensionRoute}/${this._webExtensionResourceUrlTemplate.authority}${this._webExtensionResourceUrlTemplate.path}`
        }).toString(true)
      } : void 0
    };
    if (!this._environmentService.isBuilt) {
      try {
        const productOverrides = JSON.parse((await promises.readFile(join(APP_ROOT, "product.overrides.json"))).toString());
        Object.assign(productConfiguration, productOverrides);
      } catch (err) {
      }
    }
    const workbenchWebConfiguration = {
      remoteAuthority,
      serverBasePath: basePath,
      _wrapWebWorkerExtHostInIframe,
      developmentOptions: { enableSmokeTestDriver: this._environmentService.args["enable-smoke-test-driver"] ? true : void 0, logLevel: this._logService.getLevel() },
      settingsSyncOptions: !this._environmentService.isBuilt && this._environmentService.args["enable-sync"] ? { enabled: true } : void 0,
      enableWorkspaceTrust: !this._environmentService.args["disable-workspace-trust"],
      folderUri: resolveWorkspaceURI(this._environmentService.args["default-folder"]),
      workspaceUri: resolveWorkspaceURI(this._environmentService.args["default-workspace"]),
      productConfiguration,
      callbackRoute
    };
    const cookies = cookie.parse(req.headers.cookie || "");
    const locale = cookies["vscode.nls.locale"] || req.headers["accept-language"]?.split(",")[0]?.toLowerCase() || "en";
    let WORKBENCH_NLS_BASE_URL;
    let WORKBENCH_NLS_URL;
    if (!locale.startsWith("en") && this._productService.nlsCoreBaseUrl) {
      WORKBENCH_NLS_BASE_URL = this._productService.nlsCoreBaseUrl;
      WORKBENCH_NLS_URL = `${WORKBENCH_NLS_BASE_URL}${this._productService.commit}/${this._productService.version}/${locale}/nls.messages.js`;
    } else {
      WORKBENCH_NLS_URL = "";
    }
    const values = {
      WORKBENCH_WEB_CONFIGURATION: asJSON(workbenchWebConfiguration),
      WORKBENCH_AUTH_SESSION: authSessionInfo ? asJSON(authSessionInfo) : "",
      WORKBENCH_WEB_BASE_URL: staticRoute,
      WORKBENCH_NLS_URL,
      WORKBENCH_NLS_FALLBACK_URL: `${staticRoute}/out/nls.messages.js`
    };
    if (this._cssDevService.isEnabled) {
      const cssModules = await this._cssDevService.getCssModules();
      values["WORKBENCH_DEV_CSS_MODULES"] = JSON.stringify(cssModules);
    }
    if (useTestResolver) {
      const bundledExtensions = [];
      for (const extensionPath of ["vscode-test-resolver", "github-authentication"]) {
        const packageJSON = JSON.parse((await promises.readFile(FileAccess.asFileUri(`${builtinExtensionsPath}/${extensionPath}/package.json`).fsPath)).toString());
        bundledExtensions.push({ extensionPath, packageJSON });
      }
      values["WORKBENCH_BUILTIN_EXTENSIONS"] = asJSON(bundledExtensions);
    }
    let data;
    try {
      const workbenchTemplate = (await promises.readFile(filePath)).toString();
      data = workbenchTemplate.replace(/\{\{([^}]+)\}\}/g, (_, key) => values[key] ?? "undefined");
    } catch (e) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return void res.end("Not found");
    }
    const webWorkerExtensionHostIframeScriptSHA = "sha256-2Q+j4hfT09+1+imS46J2YlkCtHWQt0/BE79PXjJ0ZJ8=";
    const cspDirectives = [
      "default-src 'self';",
      "img-src 'self' https: data: blob:;",
      "media-src 'self';",
      `script-src 'self' 'unsafe-eval' ${WORKBENCH_NLS_BASE_URL ?? ""} blob: 'nonce-1nline-m4p' ${this._getScriptCspHashes(data).join(" ")} '${webWorkerExtensionHostIframeScriptSHA}' 'sha256-/r7rqQ+yrxt57sxLuQ6AMYcy/lUpvAIzHjIJt/OeLWU=' ${useTestResolver ? "" : `http://${remoteAuthority}`};`,
      // the sha is the same as in src/vs/workbench/services/extensions/worker/webWorkerExtensionHostIframe.html
      "child-src 'self';",
      `frame-src 'self' https://*.vscode-cdn.net data:;`,
      "worker-src 'self' data: blob:;",
      "style-src 'self' 'unsafe-inline';",
      "connect-src 'self' ws: wss: https:;",
      "font-src 'self' blob:;",
      "manifest-src 'self';"
    ].join(" ");
    const headers = {
      "Content-Type": "text/html",
      "Content-Security-Policy": cspDirectives
    };
    if (this._connectionToken.type !== ServerConnectionTokenType.None) {
      headers["Set-Cookie"] = cookie.serialize(
        connectionTokenCookieName,
        this._connectionToken.value,
        {
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7
          /* 1 week */
        }
      );
    }
    res.writeHead(200, headers);
    return void res.end(data);
  }
  _getScriptCspHashes(content) {
    const regex = /<script>([\s\S]+?)<\/script>/img;
    const result = [];
    let match;
    while (match = regex.exec(content)) {
      const hasher = crypto.createHash("sha256");
      const script = match[1].replace(/\r\n/g, "\n");
      const hash = hasher.update(Buffer.from(script)).digest().toString("base64");
      result.push(`'sha256-${hash}'`);
    }
    return result;
  }
  /**
   * Handle HTTP requests for /callback
   */
  async _handleCallback(res) {
    const filePath = FileAccess.asFileUri("vs/code/browser/workbench/callback.html").fsPath;
    const data = (await promises.readFile(filePath)).toString();
    const cspDirectives = [
      "default-src 'self';",
      "img-src 'self' https: data: blob:;",
      "media-src 'none';",
      `script-src 'self' ${this._getScriptCspHashes(data).join(" ")};`,
      "style-src 'self' 'unsafe-inline';",
      "font-src 'self' blob:;"
    ].join(" ");
    res.writeHead(200, {
      "Content-Type": "text/html",
      "Content-Security-Policy": cspDirectives
    });
    return void res.end(data);
  }
};
WebClientServer = __decorateClass([
  __decorateParam(3, IServerEnvironmentService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IRequestService),
  __decorateParam(6, IProductService),
  __decorateParam(7, ICSSDevelopmentService)
], WebClientServer);
export {
  CacheControl,
  WebClientServer,
  serveError,
  serveFile
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9zZXJ2ZXIvbm9kZS93ZWJDbGllbnRTZXJ2ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBjcmVhdGVSZWFkU3RyZWFtLCBwcm9taXNlcyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xuaW1wb3J0ICogYXMgdXJsIGZyb20gJ3VybCc7XG5pbXBvcnQgKiBhcyBjb29raWUgZnJvbSAnY29va2llJztcbmltcG9ydCAqIGFzIGNyeXB0byBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IHsgaXNFcXVhbE9yUGFyZW50IH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vZXh0cGF0aC5qcyc7XG5pbXBvcnQgeyBnZXRNZWRpYU1pbWUgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9taW1lLmpzJztcbmltcG9ydCB7IGlzTGludXggfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSwgTG9nTGV2ZWwgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJU2VydmVyRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi9zZXJ2ZXJFbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgZGlybmFtZSwgam9pbiwgbm9ybWFsaXplLCBwb3NpeCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgRmlsZUFjY2VzcywgY29ubmVjdGlvblRva2VuQ29va2llTmFtZSwgY29ubmVjdGlvblRva2VuUXVlcnlOYW1lLCBTY2hlbWFzLCBidWlsdGluRXh0ZW5zaW9uc1BhdGggfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2VydmVyQ29ubmVjdGlvblRva2VuLCBTZXJ2ZXJDb25uZWN0aW9uVG9rZW5UeXBlIH0gZnJvbSAnLi9zZXJ2ZXJDb25uZWN0aW9uVG9rZW4uanMnO1xuaW1wb3J0IHsgYXNUZXh0T3JFcnJvciwgSVJlcXVlc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vcmVxdWVzdC9jb21tb24vcmVxdWVzdC5qcyc7XG5pbXBvcnQgeyBJSGVhZGVycyB9IGZyb20gJy4uLy4uL2Jhc2UvcGFydHMvcmVxdWVzdC9jb21tb24vcmVxdWVzdC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgc3RyZWFtVG9CdWZmZXIgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RDb25maWd1cmF0aW9uIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vcHJvZHVjdC5qcyc7XG5pbXBvcnQgeyBpc1N0cmluZyB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IENoYXJDb2RlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vY2hhckNvZGUuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbk1hbmlmZXN0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJQ1NTRGV2ZWxvcG1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vY3NzRGV2L25vZGUvY3NzRGV2U2VydmljZS5qcyc7XG5cbmNvbnN0IHRleHRNaW1lVHlwZTogeyBbZXh0OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQgfSA9IHtcblx0Jy5odG1sJzogJ3RleHQvaHRtbCcsXG5cdCcuanMnOiAndGV4dC9qYXZhc2NyaXB0Jyxcblx0Jy5qc29uJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuXHQnLmNzcyc6ICd0ZXh0L2NzcycsXG5cdCcuc3ZnJzogJ2ltYWdlL3N2Zyt4bWwnLFxufTtcblxuLyoqXG4gKiBSZXR1cm4gYW4gZXJyb3IgdG8gdGhlIGNsaWVudC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNlcnZlRXJyb3IocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlLCBlcnJvckNvZGU6IG51bWJlciwgZXJyb3JNZXNzYWdlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0cmVzLndyaXRlSGVhZChlcnJvckNvZGUsIHsgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L3BsYWluJyB9KTtcblx0cmVzLmVuZChlcnJvck1lc3NhZ2UpO1xufVxuXG5leHBvcnQgY29uc3QgZW51bSBDYWNoZUNvbnRyb2wge1xuXHROT19DQUNISU5HLCBFVEFHLCBOT19FWFBJUllcbn1cblxuLyoqXG4gKiBTZXJ2ZSBhIGZpbGUgYXQgYSBnaXZlbiBwYXRoIG9yIDQwNCBpZiB0aGUgZmlsZSBpcyBtaXNzaW5nLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2VydmVGaWxlKGZpbGVQYXRoOiBzdHJpbmcsIGNhY2hlQ29udHJvbDogQ2FjaGVDb250cm9sLCBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSwgcmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlLCByZXNwb25zZUhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pOiBQcm9taXNlPHZvaWQ+IHtcblx0dHJ5IHtcblx0XHRjb25zdCBzdGF0ID0gYXdhaXQgcHJvbWlzZXMuc3RhdChmaWxlUGF0aCk7IC8vIHRocm93cyBhbiBlcnJvciBpZiBmaWxlIGRvZXNuJ3QgZXhpc3Rcblx0XHRpZiAoY2FjaGVDb250cm9sID09PSBDYWNoZUNvbnRyb2wuRVRBRykge1xuXG5cdFx0XHQvLyBDaGVjayBpZiBmaWxlIG1vZGlmaWVkIHNpbmNlXG5cdFx0XHRjb25zdCBldGFnID0gYFcvXCIke1tzdGF0Lmlubywgc3RhdC5zaXplLCBzdGF0Lm10aW1lLmdldFRpbWUoKV0uam9pbignLScpfVwiYDsgLy8gd2VhayB2YWxpZGF0b3IgKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0hUVFAvSGVhZGVycy9FVGFnKVxuXHRcdFx0aWYgKHJlcS5oZWFkZXJzWydpZi1ub25lLW1hdGNoJ10gPT09IGV0YWcpIHtcblx0XHRcdFx0cmVzLndyaXRlSGVhZCgzMDQpO1xuXHRcdFx0XHRyZXR1cm4gdm9pZCByZXMuZW5kKCk7XG5cdFx0XHR9XG5cblx0XHRcdHJlc3BvbnNlSGVhZGVyc1snRXRhZyddID0gZXRhZztcblx0XHR9IGVsc2UgaWYgKGNhY2hlQ29udHJvbCA9PT0gQ2FjaGVDb250cm9sLk5PX0VYUElSWSkge1xuXHRcdFx0cmVzcG9uc2VIZWFkZXJzWydDYWNoZS1Db250cm9sJ10gPSAncHVibGljLCBtYXgtYWdlPTMxNTM2MDAwJztcblx0XHR9IGVsc2UgaWYgKGNhY2hlQ29udHJvbCA9PT0gQ2FjaGVDb250cm9sLk5PX0NBQ0hJTkcpIHtcblx0XHRcdHJlc3BvbnNlSGVhZGVyc1snQ2FjaGUtQ29udHJvbCddID0gJ25vLXN0b3JlJztcblx0XHR9XG5cblx0XHRyZXNwb25zZUhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddID0gdGV4dE1pbWVUeXBlW2V4dG5hbWUoZmlsZVBhdGgpXSB8fCBnZXRNZWRpYU1pbWUoZmlsZVBhdGgpIHx8ICd0ZXh0L3BsYWluJztcblxuXHRcdHJlcy53cml0ZUhlYWQoMjAwLCByZXNwb25zZUhlYWRlcnMpO1xuXG5cdFx0Ly8gRGF0YVxuXHRcdGNyZWF0ZVJlYWRTdHJlYW0oZmlsZVBhdGgpLnBpcGUocmVzKTtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRpZiAoZXJyb3IuY29kZSAhPT0gJ0VOT0VOVCcpIHtcblx0XHRcdGxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0Y29uc29sZS5lcnJvcihlcnJvci50b1N0cmluZygpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc29sZS5lcnJvcihgRmlsZSBub3QgZm91bmQ6ICR7ZmlsZVBhdGh9YCk7XG5cdFx0fVxuXG5cdFx0cmVzLndyaXRlSGVhZCg0MDQsIHsgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L3BsYWluJyB9KTtcblx0XHRyZXR1cm4gdm9pZCByZXMuZW5kKCdOb3QgZm91bmQnKTtcblx0fVxufVxuXG5jb25zdCBBUFBfUk9PVCA9IGRpcm5hbWUoRmlsZUFjY2Vzcy5hc0ZpbGVVcmkoJycpLmZzUGF0aCk7XG5cbmNvbnN0IFNUQVRJQ19QQVRIID0gYC9zdGF0aWNgO1xuY29uc3QgQ0FMTEJBQ0tfUEFUSCA9IGAvY2FsbGJhY2tgO1xuY29uc3QgV0VCX0VYVEVOU0lPTl9QQVRIID0gYC93ZWItZXh0ZW5zaW9uLXJlc291cmNlYDtcblxuZXhwb3J0IGNsYXNzIFdlYkNsaWVudFNlcnZlciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfd2ViRXh0ZW5zaW9uUmVzb3VyY2VVcmxUZW1wbGF0ZTogVVJJIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2Nvbm5lY3Rpb25Ub2tlbjogU2VydmVyQ29ubmVjdGlvblRva2VuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2Jhc2VQYXRoOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJvZHVjdFBhdGg6IHN0cmluZyxcblx0XHRASVNlcnZlckVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lbnZpcm9ubWVudFNlcnZpY2U6IElTZXJ2ZXJFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJUmVxdWVzdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcmVxdWVzdFNlcnZpY2U6IElSZXF1ZXN0U2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Byb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElDU1NEZXZlbG9wbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY3NzRGV2U2VydmljZTogSUNTU0RldmVsb3BtZW50U2VydmljZVxuXHQpIHtcblx0XHR0aGlzLl93ZWJFeHRlbnNpb25SZXNvdXJjZVVybFRlbXBsYXRlID0gdGhpcy5fcHJvZHVjdFNlcnZpY2UuZXh0ZW5zaW9uc0dhbGxlcnk/LnJlc291cmNlVXJsVGVtcGxhdGUgPyBVUkkucGFyc2UodGhpcy5fcHJvZHVjdFNlcnZpY2UuZXh0ZW5zaW9uc0dhbGxlcnkucmVzb3VyY2VVcmxUZW1wbGF0ZSkgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHQvKipcblx0ICogSGFuZGxlIHdlYiByZXNvdXJjZXMgKGkuZS4gb25seSBuZWVkZWQgYnkgdGhlIHdlYiBjbGllbnQpLlxuXHQgKiAqKk5PVEUqKjogVGhpcyBtZXRob2QgaXMgb25seSBpbnZva2VkIHdoZW4gdGhlIHNlcnZlciBoYXMgd2ViIGJpdHMuXG5cdCAqICoqTk9URSoqOiBUaGlzIG1ldGhvZCBpcyBvbmx5IGludm9rZWQgYWZ0ZXIgdGhlIGNvbm5lY3Rpb24gdG9rZW4gaGFzIGJlZW4gdmFsaWRhdGVkLlxuXHQgKiBAcGFyYW0gcGFyc2VkVXJsIFRoZSBVUkwgdG8gaGFuZGxlLCBpbmNsdWRpbmcgYmFzZSBhbmQgcHJvZHVjdCBwYXRoXG5cdCAqIEBwYXJhbSBwYXRobmFtZSBUaGUgcGF0aG5hbWUgb2YgdGhlIFVSTCwgd2l0aG91dCBiYXNlIGFuZCBwcm9kdWN0IHBhdGhcblx0ICovXG5cdGFzeW5jIGhhbmRsZShyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UsIHBhcnNlZFVybDogdXJsLlVybFdpdGhQYXJzZWRRdWVyeSwgcGF0aG5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRpZiAocGF0aG5hbWUuc3RhcnRzV2l0aChTVEFUSUNfUEFUSCkgJiYgcGF0aG5hbWUuY2hhckNvZGVBdChTVEFUSUNfUEFUSC5sZW5ndGgpID09PSBDaGFyQ29kZS5TbGFzaCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5faGFuZGxlU3RhdGljKHJlcSwgcmVzLCBwYXRobmFtZS5zdWJzdHJpbmcoU1RBVElDX1BBVEgubGVuZ3RoKSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAocGF0aG5hbWUgPT09ICcvJykge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5faGFuZGxlUm9vdChyZXEsIHJlcywgcGFyc2VkVXJsKTtcblx0XHRcdH1cblx0XHRcdGlmIChwYXRobmFtZSA9PT0gQ0FMTEJBQ0tfUEFUSCkge1xuXHRcdFx0XHQvLyBjYWxsYmFjayBzdXBwb3J0XG5cdFx0XHRcdHJldHVybiB0aGlzLl9oYW5kbGVDYWxsYmFjayhyZXMpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHBhdGhuYW1lLnN0YXJ0c1dpdGgoV0VCX0VYVEVOU0lPTl9QQVRIKSAmJiBwYXRobmFtZS5jaGFyQ29kZUF0KFdFQl9FWFRFTlNJT05fUEFUSC5sZW5ndGgpID09PSBDaGFyQ29kZS5TbGFzaCkge1xuXHRcdFx0XHQvLyBleHRlbnNpb24gcmVzb3VyY2Ugc3VwcG9ydFxuXHRcdFx0XHRyZXR1cm4gdGhpcy5faGFuZGxlV2ViRXh0ZW5zaW9uUmVzb3VyY2UocmVxLCByZXMsIHBhdGhuYW1lLnN1YnN0cmluZyhXRUJfRVhURU5TSU9OX1BBVEgubGVuZ3RoKSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBzZXJ2ZUVycm9yKHJlcSwgcmVzLCA0MDQsICdOb3QgZm91bmQuJyk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0Y29uc29sZS5lcnJvcihlcnJvci50b1N0cmluZygpKTtcblxuXHRcdFx0cmV0dXJuIHNlcnZlRXJyb3IocmVxLCByZXMsIDUwMCwgJ0ludGVybmFsIFNlcnZlciBFcnJvci4nKTtcblx0XHR9XG5cdH1cblx0LyoqXG5cdCAqIEhhbmRsZSBIVFRQIHJlcXVlc3RzIGZvciAvc3RhdGljLypcblx0ICogQHBhcmFtIHJlc291cmNlUGF0aCBUaGUgcGF0aCBhZnRlciAvc3RhdGljL1xuXHQgKi9cblx0cHJpdmF0ZSBhc3luYyBfaGFuZGxlU3RhdGljKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSwgcmVzb3VyY2VQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuXHRcdC8vIFN0cmlwIHRoZSB0aGlzLl9zdGF0aWNSb3V0ZSBmcm9tIHRoZSBwYXRoXG5cdFx0Y29uc3Qgbm9ybWFsaXplZFBhdGhuYW1lID0gZGVjb2RlVVJJQ29tcG9uZW50KHJlc291cmNlUGF0aCk7IC8vIHN1cHBvcnQgcGF0aHMgdGhhdCBhcmUgdXJpLWVuY29kZWQgKGUuZy4gc3BhY2VzID0+ICUyMClcblxuXHRcdGNvbnN0IGZpbGVQYXRoID0gam9pbihBUFBfUk9PVCwgbm9ybWFsaXplZFBhdGhuYW1lKTsgLy8gam9pbiBhbHNvIG5vcm1hbGl6ZXMgdGhlIHBhdGhcblx0XHRpZiAoIWlzRXF1YWxPclBhcmVudChmaWxlUGF0aCwgQVBQX1JPT1QsICFpc0xpbnV4KSkge1xuXHRcdFx0cmV0dXJuIHNlcnZlRXJyb3IocmVxLCByZXMsIDQwMCwgYEJhZCByZXF1ZXN0LmApO1xuXHRcdH1cblxuXHRcdHJldHVybiBzZXJ2ZUZpbGUoZmlsZVBhdGgsIHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5pc0J1aWx0ID8gQ2FjaGVDb250cm9sLk5PX0VYUElSWSA6IENhY2hlQ29udHJvbC5FVEFHLCB0aGlzLl9sb2dTZXJ2aWNlLCByZXEsIHJlcywgaGVhZGVycyk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRSZXNvdXJjZVVSTFRlbXBsYXRlQXV0aG9yaXR5KHVyaTogVVJJKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBpbmRleCA9IHVyaS5hdXRob3JpdHkuaW5kZXhPZignLicpO1xuXHRcdHJldHVybiBpbmRleCAhPT0gLTEgPyB1cmkuYXV0aG9yaXR5LnN1YnN0cmluZyhpbmRleCArIDEpIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIEhhbmRsZSBleHRlbnNpb24gcmVzb3VyY2VzXG5cdCAqIEBwYXJhbSByZXNvdXJjZVBhdGggVGhlIHBhdGggYWZ0ZXIgL3dlYi1leHRlbnNpb24tcmVzb3VyY2UvXG5cdCAqL1xuXHRwcml2YXRlIGFzeW5jIF9oYW5kbGVXZWJFeHRlbnNpb25SZXNvdXJjZShyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UsIHJlc291cmNlUGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLl93ZWJFeHRlbnNpb25SZXNvdXJjZVVybFRlbXBsYXRlKSB7XG5cdFx0XHRyZXR1cm4gc2VydmVFcnJvcihyZXEsIHJlcywgNTAwLCAnTm8gZXh0ZW5zaW9uIGdhbGxlcnkgc2VydmljZSBjb25maWd1cmVkLicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5vcm1hbGl6ZWRQYXRobmFtZSA9IGRlY29kZVVSSUNvbXBvbmVudChyZXNvdXJjZVBhdGgpOyAvLyBzdXBwb3J0IHBhdGhzIHRoYXQgYXJlIHVyaS1lbmNvZGVkIChlLmcuIHNwYWNlcyA9PiAlMjApXG5cdFx0Y29uc3QgcGF0aCA9IG5vcm1hbGl6ZShub3JtYWxpemVkUGF0aG5hbWUpO1xuXHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZShwYXRoKS53aXRoKHtcblx0XHRcdHNjaGVtZTogdGhpcy5fd2ViRXh0ZW5zaW9uUmVzb3VyY2VVcmxUZW1wbGF0ZS5zY2hlbWUsXG5cdFx0XHRhdXRob3JpdHk6IHBhdGguc3Vic3RyaW5nKDAsIHBhdGguaW5kZXhPZignLycpKSxcblx0XHRcdHBhdGg6IHBhdGguc3Vic3RyaW5nKHBhdGguaW5kZXhPZignLycpICsgMSlcblx0XHR9KTtcblxuXHRcdGlmICh0aGlzLl9nZXRSZXNvdXJjZVVSTFRlbXBsYXRlQXV0aG9yaXR5KHRoaXMuX3dlYkV4dGVuc2lvblJlc291cmNlVXJsVGVtcGxhdGUpICE9PSB0aGlzLl9nZXRSZXNvdXJjZVVSTFRlbXBsYXRlQXV0aG9yaXR5KHVyaSkpIHtcblx0XHRcdHJldHVybiBzZXJ2ZUVycm9yKHJlcSwgcmVzLCA0MDMsICdSZXF1ZXN0IEZvcmJpZGRlbicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhlYWRlcnM6IElIZWFkZXJzID0ge307XG5cdFx0Y29uc3Qgc2V0UmVxdWVzdEhlYWRlciA9IChoZWFkZXI6IHN0cmluZykgPT4ge1xuXHRcdFx0Y29uc3QgdmFsdWUgPSByZXEuaGVhZGVyc1toZWFkZXJdO1xuXHRcdFx0aWYgKHZhbHVlICYmIChpc1N0cmluZyh2YWx1ZSkgfHwgdmFsdWVbMF0pKSB7XG5cdFx0XHRcdGhlYWRlcnNbaGVhZGVyXSA9IGlzU3RyaW5nKHZhbHVlKSA/IHZhbHVlIDogdmFsdWVbMF07XG5cdFx0XHR9IGVsc2UgaWYgKGhlYWRlciAhPT0gaGVhZGVyLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdFx0c2V0UmVxdWVzdEhlYWRlcihoZWFkZXIudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRzZXRSZXF1ZXN0SGVhZGVyKCdYLUNsaWVudC1OYW1lJyk7XG5cdFx0c2V0UmVxdWVzdEhlYWRlcignWC1DbGllbnQtVmVyc2lvbicpO1xuXHRcdHNldFJlcXVlc3RIZWFkZXIoJ1gtTWFjaGluZS1JZCcpO1xuXHRcdHNldFJlcXVlc3RIZWFkZXIoJ1gtQ2xpZW50LUNvbW1pdCcpO1xuXG5cdFx0Y29uc3QgY29udGV4dCA9IGF3YWl0IHRoaXMuX3JlcXVlc3RTZXJ2aWNlLnJlcXVlc3Qoe1xuXHRcdFx0dHlwZTogJ0dFVCcsXG5cdFx0XHR1cmw6IHVyaS50b1N0cmluZyh0cnVlKSxcblx0XHRcdGhlYWRlcnNcblx0XHR9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblxuXHRcdGNvbnN0IHN0YXR1cyA9IGNvbnRleHQucmVzLnN0YXR1c0NvZGUgfHwgNTAwO1xuXHRcdGlmIChzdGF0dXMgIT09IDIwMCkge1xuXHRcdFx0bGV0IHRleHQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGV4dCA9IGF3YWl0IGFzVGV4dE9yRXJyb3IoY29udGV4dCk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikgey8qIElnbm9yZSAqLyB9XG5cdFx0XHRyZXR1cm4gc2VydmVFcnJvcihyZXEsIHJlcywgc3RhdHVzLCB0ZXh0IHx8IGBSZXF1ZXN0IGZhaWxlZCB3aXRoIHN0YXR1cyAke3N0YXR1c31gKTtcblx0XHR9XG5cblx0XHRjb25zdCByZXNwb25zZUhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IHN0cmluZ1tdPiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0Y29uc3Qgc2V0UmVzcG9uc2VIZWFkZXIgPSAoaGVhZGVyOiBzdHJpbmcpID0+IHtcblx0XHRcdGNvbnN0IHZhbHVlID0gY29udGV4dC5yZXMuaGVhZGVyc1toZWFkZXJdO1xuXHRcdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRcdHJlc3BvbnNlSGVhZGVyc1toZWFkZXJdID0gdmFsdWU7XG5cdFx0XHR9IGVsc2UgaWYgKGhlYWRlciAhPT0gaGVhZGVyLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdFx0c2V0UmVzcG9uc2VIZWFkZXIoaGVhZGVyLnRvTG93ZXJDYXNlKCkpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0c2V0UmVzcG9uc2VIZWFkZXIoJ0NhY2hlLUNvbnRyb2wnKTtcblx0XHRzZXRSZXNwb25zZUhlYWRlcignQ29udGVudC1UeXBlJyk7XG5cdFx0cmVzLndyaXRlSGVhZCgyMDAsIHJlc3BvbnNlSGVhZGVycyk7XG5cdFx0Y29uc3QgYnVmZmVyID0gYXdhaXQgc3RyZWFtVG9CdWZmZXIoY29udGV4dC5zdHJlYW0pO1xuXHRcdHJldHVybiB2b2lkIHJlcy5lbmQoYnVmZmVyLmJ1ZmZlcik7XG5cdH1cblxuXHQvKipcblx0ICogSGFuZGxlIEhUVFAgcmVxdWVzdHMgZm9yIC9cblx0ICovXG5cdHByaXZhdGUgYXN5bmMgX2hhbmRsZVJvb3QocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlLCBwYXJzZWRVcmw6IHVybC5VcmxXaXRoUGFyc2VkUXVlcnkpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdGNvbnN0IGdldEZpcnN0SGVhZGVyID0gKGhlYWRlck5hbWU6IHN0cmluZykgPT4ge1xuXHRcdFx0Y29uc3QgdmFsID0gcmVxLmhlYWRlcnNbaGVhZGVyTmFtZV07XG5cdFx0XHRyZXR1cm4gQXJyYXkuaXNBcnJheSh2YWwpID8gdmFsWzBdIDogdmFsO1xuXHRcdH07XG5cblx0XHQvLyBQcmVmaXggcm91dGVzIHdpdGggYmFzZVBhdGggZm9yIGNsaWVudHNcblx0XHRjb25zdCBiYXNlUGF0aCA9IGdldEZpcnN0SGVhZGVyKCd4LWZvcndhcmRlZC1wcmVmaXgnKSB8fCB0aGlzLl9iYXNlUGF0aDtcblxuXHRcdGNvbnN0IHF1ZXJ5Q29ubmVjdGlvblRva2VuID0gcGFyc2VkVXJsLnF1ZXJ5W2Nvbm5lY3Rpb25Ub2tlblF1ZXJ5TmFtZV07XG5cdFx0aWYgKHR5cGVvZiBxdWVyeUNvbm5lY3Rpb25Ub2tlbiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdC8vIFdlIGdvdCBhIGNvbm5lY3Rpb24gdG9rZW4gYXMgYSBxdWVyeSBwYXJhbWV0ZXIuXG5cdFx0XHQvLyBXZSB3YW50IHRvIGhhdmUgYSBjbGVhbiBVUkwsIHNvIHdlIHN0cmlwIGl0XG5cdFx0XHRjb25zdCByZXNwb25zZUhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdFx0cmVzcG9uc2VIZWFkZXJzWydTZXQtQ29va2llJ10gPSBjb29raWUuc2VyaWFsaXplKFxuXHRcdFx0XHRjb25uZWN0aW9uVG9rZW5Db29raWVOYW1lLFxuXHRcdFx0XHRxdWVyeUNvbm5lY3Rpb25Ub2tlbixcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHNhbWVTaXRlOiAnbGF4Jyxcblx0XHRcdFx0XHRtYXhBZ2U6IDYwICogNjAgKiAyNCAqIDcgLyogMSB3ZWVrICovXG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cblx0XHRcdGNvbnN0IG5ld1F1ZXJ5ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRcdGZvciAoY29uc3Qga2V5IGluIHBhcnNlZFVybC5xdWVyeSkge1xuXHRcdFx0XHRpZiAoa2V5ICE9PSBjb25uZWN0aW9uVG9rZW5RdWVyeU5hbWUpIHtcblx0XHRcdFx0XHRuZXdRdWVyeVtrZXldID0gcGFyc2VkVXJsLnF1ZXJ5W2tleV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNvbnN0IG5ld0xvY2F0aW9uID0gdXJsLmZvcm1hdCh7IHBhdGhuYW1lOiBiYXNlUGF0aCwgcXVlcnk6IG5ld1F1ZXJ5IH0pO1xuXHRcdFx0cmVzcG9uc2VIZWFkZXJzWydMb2NhdGlvbiddID0gbmV3TG9jYXRpb247XG5cblx0XHRcdHJlcy53cml0ZUhlYWQoMzAyLCByZXNwb25zZUhlYWRlcnMpO1xuXHRcdFx0cmV0dXJuIHZvaWQgcmVzLmVuZCgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlcGxhY2VQb3J0ID0gKGhvc3Q6IHN0cmluZywgcG9ydDogc3RyaW5nKSA9PiB7XG5cdFx0XHRjb25zdCBpbmRleCA9IGhvc3Q/LmluZGV4T2YoJzonKTtcblx0XHRcdGlmIChpbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0aG9zdCA9IGhvc3Q/LnN1YnN0cmluZygwLCBpbmRleCk7XG5cdFx0XHR9XG5cdFx0XHRob3N0ICs9IGA6JHtwb3J0fWA7XG5cdFx0XHRyZXR1cm4gaG9zdDtcblx0XHR9O1xuXG5cdFx0Y29uc3QgdXNlVGVzdFJlc29sdmVyID0gKCF0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuaXNCdWlsdCAmJiB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuYXJnc1sndXNlLXRlc3QtcmVzb2x2ZXInXSk7XG5cdFx0bGV0IHJlbW90ZUF1dGhvcml0eSA9IChcblx0XHRcdHVzZVRlc3RSZXNvbHZlclxuXHRcdFx0XHQ/ICd0ZXN0K3Rlc3QnXG5cdFx0XHRcdDogKGdldEZpcnN0SGVhZGVyKCd4LW9yaWdpbmFsLWhvc3QnKSB8fCBnZXRGaXJzdEhlYWRlcigneC1mb3J3YXJkZWQtaG9zdCcpIHx8IHJlcS5oZWFkZXJzLmhvc3QpXG5cdFx0KTtcblx0XHRpZiAoIXJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0cmV0dXJuIHNlcnZlRXJyb3IocmVxLCByZXMsIDQwMCwgYEJhZCByZXF1ZXN0LmApO1xuXHRcdH1cblx0XHRjb25zdCBmb3J3YXJkZWRQb3J0ID0gZ2V0Rmlyc3RIZWFkZXIoJ3gtZm9yd2FyZGVkLXBvcnQnKTtcblx0XHRpZiAoZm9yd2FyZGVkUG9ydCkge1xuXHRcdFx0cmVtb3RlQXV0aG9yaXR5ID0gcmVwbGFjZVBvcnQocmVtb3RlQXV0aG9yaXR5LCBmb3J3YXJkZWRQb3J0KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhc0pTT04odmFsdWU6IHVua25vd24pOiBzdHJpbmcge1xuXHRcdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KHZhbHVlKS5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7Jyk7XG5cdFx0fVxuXG5cdFx0bGV0IF93cmFwV2ViV29ya2VyRXh0SG9zdEluSWZyYW1lOiB1bmRlZmluZWQgfCBmYWxzZSA9IHVuZGVmaW5lZDtcblx0XHRpZiAodGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmFyZ3NbJ2VuYWJsZS1zbW9rZS10ZXN0LWRyaXZlciddKSB7XG5cdFx0XHQvLyBpbnRlZ3JhdGlvbiB0ZXN0cyBydW4gYXQgYSB0aW1lIHdoZW4gdGhlIGJ1aWx0IG91dHB1dCBpcyBub3QgeWV0IHB1Ymxpc2hlZCB0byB0aGUgQ0ROXG5cdFx0XHQvLyBzbyB3ZSBtdXN0IGRpc2FibGUgdGhlIGlmcmFtZSB3cmFwcGluZyBiZWNhdXNlIHRoZSBpZnJhbWUgVVJMIHdpbGwgZ2l2ZSBhIDQwNFxuXHRcdFx0X3dyYXBXZWJXb3JrZXJFeHRIb3N0SW5JZnJhbWUgPSBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fbG9nU2VydmljZS5nZXRMZXZlbCgpID09PSBMb2dMZXZlbC5UcmFjZSkge1xuXHRcdFx0Wyd4LW9yaWdpbmFsLWhvc3QnLCAneC1mb3J3YXJkZWQtaG9zdCcsICd4LWZvcndhcmRlZC1wb3J0JywgJ2hvc3QnXS5mb3JFYWNoKGhlYWRlciA9PiB7XG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gZ2V0Rmlyc3RIZWFkZXIoaGVhZGVyKTtcblx0XHRcdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgW1dlYkNsaWVudFNlcnZlcl0gJHtoZWFkZXJ9OiAke3ZhbHVlfWApO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYFtXZWJDbGllbnRTZXJ2ZXJdIFJlcXVlc3QgVVJMOiAke3JlcS51cmx9LCBiYXNlUGF0aDogJHtiYXNlUGF0aH0sIHJlbW90ZUF1dGhvcml0eTogJHtyZW1vdGVBdXRob3JpdHl9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RhdGljUm91dGUgPSBwb3NpeC5qb2luKGJhc2VQYXRoLCB0aGlzLl9wcm9kdWN0UGF0aCwgU1RBVElDX1BBVEgpO1xuXHRcdGNvbnN0IGNhbGxiYWNrUm91dGUgPSBwb3NpeC5qb2luKGJhc2VQYXRoLCB0aGlzLl9wcm9kdWN0UGF0aCwgQ0FMTEJBQ0tfUEFUSCk7XG5cdFx0Y29uc3Qgd2ViRXh0ZW5zaW9uUm91dGUgPSBwb3NpeC5qb2luKGJhc2VQYXRoLCB0aGlzLl9wcm9kdWN0UGF0aCwgV0VCX0VYVEVOU0lPTl9QQVRIKTtcblxuXHRcdGNvbnN0IHJlc29sdmVXb3Jrc3BhY2VVUkkgPSAoZGVmYXVsdExvY2F0aW9uPzogc3RyaW5nKSA9PiBkZWZhdWx0TG9jYXRpb24gJiYgVVJJLmZpbGUocGF0aC5yZXNvbHZlKGRlZmF1bHRMb2NhdGlvbikpLndpdGgoeyBzY2hlbWU6IFNjaGVtYXMudnNjb2RlUmVtb3RlLCBhdXRob3JpdHk6IHJlbW90ZUF1dGhvcml0eSB9KTtcblxuXHRcdGNvbnN0IGZpbGVQYXRoID0gRmlsZUFjY2Vzcy5hc0ZpbGVVcmkoYHZzL2NvZGUvYnJvd3Nlci93b3JrYmVuY2gvd29ya2JlbmNoJHt0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuaXNCdWlsdCA/ICcnIDogJy1kZXYnfS5odG1sYCkuZnNQYXRoO1xuXHRcdGNvbnN0IGF1dGhTZXNzaW9uSW5mbyA9ICF0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuaXNCdWlsdCAmJiB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuYXJnc1snZ2l0aHViLWF1dGgnXSA/IHtcblx0XHRcdGlkOiBnZW5lcmF0ZVV1aWQoKSxcblx0XHRcdHByb3ZpZGVySWQ6ICdnaXRodWInLFxuXHRcdFx0YWNjZXNzVG9rZW46IHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5hcmdzWydnaXRodWItYXV0aCddLFxuXHRcdFx0c2NvcGVzOiBbWyd1c2VyOmVtYWlsJ10sIFsncmVwbyddXVxuXHRcdH0gOiB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBwcm9kdWN0Q29uZmlndXJhdGlvbiA9IHtcblx0XHRcdGVtYmVkZGVySWRlbnRpZmllcjogJ3NlcnZlci1kaXN0cm8nLFxuXHRcdFx0ZXh0ZW5zaW9uc0dhbGxlcnk6IHRoaXMuX3dlYkV4dGVuc2lvblJlc291cmNlVXJsVGVtcGxhdGUgJiYgdGhpcy5fcHJvZHVjdFNlcnZpY2UuZXh0ZW5zaW9uc0dhbGxlcnkgPyB7XG5cdFx0XHRcdC4uLnRoaXMuX3Byb2R1Y3RTZXJ2aWNlLmV4dGVuc2lvbnNHYWxsZXJ5LFxuXHRcdFx0XHRyZXNvdXJjZVVybFRlbXBsYXRlOiB0aGlzLl93ZWJFeHRlbnNpb25SZXNvdXJjZVVybFRlbXBsYXRlLndpdGgoe1xuXHRcdFx0XHRcdHNjaGVtZTogJ2h0dHAnLFxuXHRcdFx0XHRcdGF1dGhvcml0eTogcmVtb3RlQXV0aG9yaXR5LFxuXHRcdFx0XHRcdHBhdGg6IGAke3dlYkV4dGVuc2lvblJvdXRlfS8ke3RoaXMuX3dlYkV4dGVuc2lvblJlc291cmNlVXJsVGVtcGxhdGUuYXV0aG9yaXR5fSR7dGhpcy5fd2ViRXh0ZW5zaW9uUmVzb3VyY2VVcmxUZW1wbGF0ZS5wYXRofWBcblx0XHRcdFx0fSkudG9TdHJpbmcodHJ1ZSlcblx0XHRcdH0gOiB1bmRlZmluZWRcblx0XHR9IHNhdGlzZmllcyBQYXJ0aWFsPElQcm9kdWN0Q29uZmlndXJhdGlvbj47XG5cblx0XHRpZiAoIXRoaXMuX2Vudmlyb25tZW50U2VydmljZS5pc0J1aWx0KSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBwcm9kdWN0T3ZlcnJpZGVzID0gSlNPTi5wYXJzZSgoYXdhaXQgcHJvbWlzZXMucmVhZEZpbGUoam9pbihBUFBfUk9PVCwgJ3Byb2R1Y3Qub3ZlcnJpZGVzLmpzb24nKSkpLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRPYmplY3QuYXNzaWduKHByb2R1Y3RDb25maWd1cmF0aW9uLCBwcm9kdWN0T3ZlcnJpZGVzKTtcblx0XHRcdH0gY2F0Y2ggKGVycikgey8qIElnbm9yZSBFcnJvciAqLyB9XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd29ya2JlbmNoV2ViQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdHJlbW90ZUF1dGhvcml0eSxcblx0XHRcdHNlcnZlckJhc2VQYXRoOiBiYXNlUGF0aCxcblx0XHRcdF93cmFwV2ViV29ya2VyRXh0SG9zdEluSWZyYW1lLFxuXHRcdFx0ZGV2ZWxvcG1lbnRPcHRpb25zOiB7IGVuYWJsZVNtb2tlVGVzdERyaXZlcjogdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmFyZ3NbJ2VuYWJsZS1zbW9rZS10ZXN0LWRyaXZlciddID8gdHJ1ZSA6IHVuZGVmaW5lZCwgbG9nTGV2ZWw6IHRoaXMuX2xvZ1NlcnZpY2UuZ2V0TGV2ZWwoKSB9LFxuXHRcdFx0c2V0dGluZ3NTeW5jT3B0aW9uczogIXRoaXMuX2Vudmlyb25tZW50U2VydmljZS5pc0J1aWx0ICYmIHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5hcmdzWydlbmFibGUtc3luYyddID8geyBlbmFibGVkOiB0cnVlIH0gOiB1bmRlZmluZWQsXG5cdFx0XHRlbmFibGVXb3Jrc3BhY2VUcnVzdDogIXRoaXMuX2Vudmlyb25tZW50U2VydmljZS5hcmdzWydkaXNhYmxlLXdvcmtzcGFjZS10cnVzdCddLFxuXHRcdFx0Zm9sZGVyVXJpOiByZXNvbHZlV29ya3NwYWNlVVJJKHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5hcmdzWydkZWZhdWx0LWZvbGRlciddKSxcblx0XHRcdHdvcmtzcGFjZVVyaTogcmVzb2x2ZVdvcmtzcGFjZVVSSSh0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuYXJnc1snZGVmYXVsdC13b3Jrc3BhY2UnXSksXG5cdFx0XHRwcm9kdWN0Q29uZmlndXJhdGlvbixcblx0XHRcdGNhbGxiYWNrUm91dGU6IGNhbGxiYWNrUm91dGVcblx0XHR9O1xuXG5cdFx0Y29uc3QgY29va2llcyA9IGNvb2tpZS5wYXJzZShyZXEuaGVhZGVycy5jb29raWUgfHwgJycpO1xuXHRcdGNvbnN0IGxvY2FsZSA9IGNvb2tpZXNbJ3ZzY29kZS5ubHMubG9jYWxlJ10gfHwgcmVxLmhlYWRlcnNbJ2FjY2VwdC1sYW5ndWFnZSddPy5zcGxpdCgnLCcpWzBdPy50b0xvd2VyQ2FzZSgpIHx8ICdlbic7XG5cdFx0bGV0IFdPUktCRU5DSF9OTFNfQkFTRV9VUkw6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRsZXQgV09SS0JFTkNIX05MU19VUkw6IHN0cmluZztcblx0XHRpZiAoIWxvY2FsZS5zdGFydHNXaXRoKCdlbicpICYmIHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLm5sc0NvcmVCYXNlVXJsKSB7XG5cdFx0XHRXT1JLQkVOQ0hfTkxTX0JBU0VfVVJMID0gdGhpcy5fcHJvZHVjdFNlcnZpY2UubmxzQ29yZUJhc2VVcmw7XG5cdFx0XHRXT1JLQkVOQ0hfTkxTX1VSTCA9IGAke1dPUktCRU5DSF9OTFNfQkFTRV9VUkx9JHt0aGlzLl9wcm9kdWN0U2VydmljZS5jb21taXR9LyR7dGhpcy5fcHJvZHVjdFNlcnZpY2UudmVyc2lvbn0vJHtsb2NhbGV9L25scy5tZXNzYWdlcy5qc2A7XG5cdFx0fSBlbHNlIHtcblx0XHRcdFdPUktCRU5DSF9OTFNfVVJMID0gJyc7IC8vIGZhbGxiYWNrIHdpbGwgYXBwbHlcblx0XHR9XG5cblx0XHRjb25zdCB2YWx1ZXM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7XG5cdFx0XHRXT1JLQkVOQ0hfV0VCX0NPTkZJR1VSQVRJT046IGFzSlNPTih3b3JrYmVuY2hXZWJDb25maWd1cmF0aW9uKSxcblx0XHRcdFdPUktCRU5DSF9BVVRIX1NFU1NJT046IGF1dGhTZXNzaW9uSW5mbyA/IGFzSlNPTihhdXRoU2Vzc2lvbkluZm8pIDogJycsXG5cdFx0XHRXT1JLQkVOQ0hfV0VCX0JBU0VfVVJMOiBzdGF0aWNSb3V0ZSxcblx0XHRcdFdPUktCRU5DSF9OTFNfVVJMLFxuXHRcdFx0V09SS0JFTkNIX05MU19GQUxMQkFDS19VUkw6IGAke3N0YXRpY1JvdXRlfS9vdXQvbmxzLm1lc3NhZ2VzLmpzYFxuXHRcdH07XG5cblx0XHQvLyBERVYgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cdFx0Ly8gREVWOiBUaGlzIGlzIGZvciBkZXZlbG9wbWVudCBhbmQgZW5hYmxlcyBsb2FkaW5nIENTUyB2aWEgaW1wb3J0LXN0YXRlbWVudHMgdmlhIGltcG9ydC1tYXBzLlxuXHRcdC8vIERFVjogVGhlIHNlcnZlciBuZWVkcyB0byBzZW5kIGFsb25nIGFsbCBDU1MgbW9kdWxlcyBzbyB0aGF0IHRoZSBjbGllbnQgY2FuIGNvbnN0cnVjdCB0aGVcblx0XHQvLyBERVY6IGltcG9ydC1tYXAuXG5cdFx0Ly8gREVWIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXHRcdGlmICh0aGlzLl9jc3NEZXZTZXJ2aWNlLmlzRW5hYmxlZCkge1xuXHRcdFx0Y29uc3QgY3NzTW9kdWxlcyA9IGF3YWl0IHRoaXMuX2Nzc0RldlNlcnZpY2UuZ2V0Q3NzTW9kdWxlcygpO1xuXHRcdFx0dmFsdWVzWydXT1JLQkVOQ0hfREVWX0NTU19NT0RVTEVTJ10gPSBKU09OLnN0cmluZ2lmeShjc3NNb2R1bGVzKTtcblx0XHR9XG5cblx0XHRpZiAodXNlVGVzdFJlc29sdmVyKSB7XG5cdFx0XHRjb25zdCBidW5kbGVkRXh0ZW5zaW9uczogeyBleHRlbnNpb25QYXRoOiBzdHJpbmc7IHBhY2thZ2VKU09OOiBJRXh0ZW5zaW9uTWFuaWZlc3QgfVtdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvblBhdGggb2YgWyd2c2NvZGUtdGVzdC1yZXNvbHZlcicsICdnaXRodWItYXV0aGVudGljYXRpb24nXSkge1xuXHRcdFx0XHRjb25zdCBwYWNrYWdlSlNPTiA9IEpTT04ucGFyc2UoKGF3YWl0IHByb21pc2VzLnJlYWRGaWxlKEZpbGVBY2Nlc3MuYXNGaWxlVXJpKGAke2J1aWx0aW5FeHRlbnNpb25zUGF0aH0vJHtleHRlbnNpb25QYXRofS9wYWNrYWdlLmpzb25gKS5mc1BhdGgpKS50b1N0cmluZygpKTtcblx0XHRcdFx0YnVuZGxlZEV4dGVuc2lvbnMucHVzaCh7IGV4dGVuc2lvblBhdGgsIHBhY2thZ2VKU09OIH0pO1xuXHRcdFx0fVxuXHRcdFx0dmFsdWVzWydXT1JLQkVOQ0hfQlVJTFRJTl9FWFRFTlNJT05TJ10gPSBhc0pTT04oYnVuZGxlZEV4dGVuc2lvbnMpO1xuXHRcdH1cblxuXHRcdGxldCBkYXRhO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCB3b3JrYmVuY2hUZW1wbGF0ZSA9IChhd2FpdCBwcm9taXNlcy5yZWFkRmlsZShmaWxlUGF0aCkpLnRvU3RyaW5nKCk7XG5cdFx0XHRkYXRhID0gd29ya2JlbmNoVGVtcGxhdGUucmVwbGFjZSgvXFx7XFx7KFtefV0rKVxcfVxcfS9nLCAoXywga2V5KSA9PiB2YWx1ZXNba2V5XSA/PyAndW5kZWZpbmVkJyk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0cmVzLndyaXRlSGVhZCg0MDQsIHsgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L3BsYWluJyB9KTtcblx0XHRcdHJldHVybiB2b2lkIHJlcy5lbmQoJ05vdCBmb3VuZCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdlYldvcmtlckV4dGVuc2lvbkhvc3RJZnJhbWVTY3JpcHRTSEEgPSAnc2hhMjU2LTJRK2o0aGZUMDkrMStpbVM0NkoyWWxrQ3RIV1F0MC9CRTc5UFhqSjBaSjg9JztcblxuXHRcdGNvbnN0IGNzcERpcmVjdGl2ZXMgPSBbXG5cdFx0XHQnZGVmYXVsdC1zcmMgXFwnc2VsZlxcJzsnLFxuXHRcdFx0J2ltZy1zcmMgXFwnc2VsZlxcJyBodHRwczogZGF0YTogYmxvYjo7Jyxcblx0XHRcdCdtZWRpYS1zcmMgXFwnc2VsZlxcJzsnLFxuXHRcdFx0YHNjcmlwdC1zcmMgJ3NlbGYnICd1bnNhZmUtZXZhbCcgJHtXT1JLQkVOQ0hfTkxTX0JBU0VfVVJMID8/ICcnfSBibG9iOiAnbm9uY2UtMW5saW5lLW00cCcgJHt0aGlzLl9nZXRTY3JpcHRDc3BIYXNoZXMoZGF0YSkuam9pbignICcpfSAnJHt3ZWJXb3JrZXJFeHRlbnNpb25Ib3N0SWZyYW1lU2NyaXB0U0hBfScgJ3NoYTI1Ni0vcjdycVEreXJ4dDU3c3hMdVE2QU1ZY3kvbFVwdkFJekhqSUp0L09lTFdVPScgJHt1c2VUZXN0UmVzb2x2ZXIgPyAnJyA6IGBodHRwOi8vJHtyZW1vdGVBdXRob3JpdHl9YH07YCwgIC8vIHRoZSBzaGEgaXMgdGhlIHNhbWUgYXMgaW4gc3JjL3ZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9leHRlbnNpb25zL3dvcmtlci93ZWJXb3JrZXJFeHRlbnNpb25Ib3N0SWZyYW1lLmh0bWxcblx0XHRcdCdjaGlsZC1zcmMgXFwnc2VsZlxcJzsnLFxuXHRcdFx0YGZyYW1lLXNyYyAnc2VsZicgaHR0cHM6Ly8qLnZzY29kZS1jZG4ubmV0IGRhdGE6O2AsXG5cdFx0XHQnd29ya2VyLXNyYyBcXCdzZWxmXFwnIGRhdGE6IGJsb2I6OycsXG5cdFx0XHQnc3R5bGUtc3JjIFxcJ3NlbGZcXCcgXFwndW5zYWZlLWlubGluZVxcJzsnLFxuXHRcdFx0J2Nvbm5lY3Qtc3JjIFxcJ3NlbGZcXCcgd3M6IHdzczogaHR0cHM6OycsXG5cdFx0XHQnZm9udC1zcmMgXFwnc2VsZlxcJyBibG9iOjsnLFxuXHRcdFx0J21hbmlmZXN0LXNyYyBcXCdzZWxmXFwnOydcblx0XHRdLmpvaW4oJyAnKTtcblxuXHRcdGNvbnN0IGhlYWRlcnM6IGh0dHAuT3V0Z29pbmdIdHRwSGVhZGVycyA9IHtcblx0XHRcdCdDb250ZW50LVR5cGUnOiAndGV4dC9odG1sJyxcblx0XHRcdCdDb250ZW50LVNlY3VyaXR5LVBvbGljeSc6IGNzcERpcmVjdGl2ZXNcblx0XHR9O1xuXHRcdGlmICh0aGlzLl9jb25uZWN0aW9uVG9rZW4udHlwZSAhPT0gU2VydmVyQ29ubmVjdGlvblRva2VuVHlwZS5Ob25lKSB7XG5cdFx0XHQvLyBBdCB0aGlzIHBvaW50IHdlIGtub3cgdGhlIGNsaWVudCBoYXMgYSB2YWxpZCBjb29raWVcblx0XHRcdC8vIGFuZCB3ZSB3YW50IHRvIHNldCBpdCBwcm9sb25nIGl0IHRvIGVuc3VyZSB0aGF0IHRoaXNcblx0XHRcdC8vIGNsaWVudCBpcyB2YWxpZCBmb3IgYW5vdGhlciAxIHdlZWsgYXQgbGVhc3Rcblx0XHRcdGhlYWRlcnNbJ1NldC1Db29raWUnXSA9IGNvb2tpZS5zZXJpYWxpemUoXG5cdFx0XHRcdGNvbm5lY3Rpb25Ub2tlbkNvb2tpZU5hbWUsXG5cdFx0XHRcdHRoaXMuX2Nvbm5lY3Rpb25Ub2tlbi52YWx1ZSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHNhbWVTaXRlOiAnbGF4Jyxcblx0XHRcdFx0XHRtYXhBZ2U6IDYwICogNjAgKiAyNCAqIDcgLyogMSB3ZWVrICovXG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0cmVzLndyaXRlSGVhZCgyMDAsIGhlYWRlcnMpO1xuXHRcdHJldHVybiB2b2lkIHJlcy5lbmQoZGF0YSk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRTY3JpcHRDc3BIYXNoZXMoY29udGVudDogc3RyaW5nKTogc3RyaW5nW10ge1xuXHRcdC8vIENvbXB1dGUgdGhlIENTUCBoYXNoZXMgZm9yIGxpbmUgc2NyaXB0cy4gVXNlcyByZWdleFxuXHRcdC8vIHdoaWNoIG1lYW5zIGl0IGlzbid0IDEwMCUgZ29vZC5cblx0XHRjb25zdCByZWdleCA9IC88c2NyaXB0PihbXFxzXFxTXSs/KTxcXC9zY3JpcHQ+L2ltZztcblx0XHRjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG5cdFx0bGV0IG1hdGNoOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuXHRcdHdoaWxlIChtYXRjaCA9IHJlZ2V4LmV4ZWMoY29udGVudCkpIHtcblx0XHRcdGNvbnN0IGhhc2hlciA9IGNyeXB0by5jcmVhdGVIYXNoKCdzaGEyNTYnKTtcblx0XHRcdC8vIFRoaXMgb25seSB3b3JrcyBvbiBXaW5kb3dzIGlmIHdlIHN0cmlwIGBcXHJgIGZyb20gYFxcclxcbmAuXG5cdFx0XHRjb25zdCBzY3JpcHQgPSBtYXRjaFsxXS5yZXBsYWNlKC9cXHJcXG4vZywgJ1xcbicpO1xuXHRcdFx0Y29uc3QgaGFzaCA9IGhhc2hlclxuXHRcdFx0XHQudXBkYXRlKEJ1ZmZlci5mcm9tKHNjcmlwdCkpXG5cdFx0XHRcdC5kaWdlc3QoKS50b1N0cmluZygnYmFzZTY0Jyk7XG5cblx0XHRcdHJlc3VsdC5wdXNoKGAnc2hhMjU2LSR7aGFzaH0nYCk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHQvKipcblx0ICogSGFuZGxlIEhUVFAgcmVxdWVzdHMgZm9yIC9jYWxsYmFja1xuXHQgKi9cblx0cHJpdmF0ZSBhc3luYyBfaGFuZGxlQ2FsbGJhY2socmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZmlsZVBhdGggPSBGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvY29kZS9icm93c2VyL3dvcmtiZW5jaC9jYWxsYmFjay5odG1sJykuZnNQYXRoO1xuXHRcdGNvbnN0IGRhdGEgPSAoYXdhaXQgcHJvbWlzZXMucmVhZEZpbGUoZmlsZVBhdGgpKS50b1N0cmluZygpO1xuXHRcdGNvbnN0IGNzcERpcmVjdGl2ZXMgPSBbXG5cdFx0XHQnZGVmYXVsdC1zcmMgXFwnc2VsZlxcJzsnLFxuXHRcdFx0J2ltZy1zcmMgXFwnc2VsZlxcJyBodHRwczogZGF0YTogYmxvYjo7Jyxcblx0XHRcdCdtZWRpYS1zcmMgXFwnbm9uZVxcJzsnLFxuXHRcdFx0YHNjcmlwdC1zcmMgJ3NlbGYnICR7dGhpcy5fZ2V0U2NyaXB0Q3NwSGFzaGVzKGRhdGEpLmpvaW4oJyAnKX07YCxcblx0XHRcdCdzdHlsZS1zcmMgXFwnc2VsZlxcJyBcXCd1bnNhZmUtaW5saW5lXFwnOycsXG5cdFx0XHQnZm9udC1zcmMgXFwnc2VsZlxcJyBibG9iOjsnXG5cdFx0XS5qb2luKCcgJyk7XG5cblx0XHRyZXMud3JpdGVIZWFkKDIwMCwge1xuXHRcdFx0J0NvbnRlbnQtVHlwZSc6ICd0ZXh0L2h0bWwnLFxuXHRcdFx0J0NvbnRlbnQtU2VjdXJpdHktUG9saWN5JzogY3NwRGlyZWN0aXZlc1xuXHRcdH0pO1xuXHRcdHJldHVybiB2b2lkIHJlcy5lbmQoZGF0YSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxrQkFBa0IsZ0JBQWdCO0FBQzNDLFlBQVksVUFBVTtBQUV0QixZQUFZLFNBQVM7QUFDckIsWUFBWSxZQUFZO0FBQ3hCLFlBQVksWUFBWTtBQUN4QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxhQUFhLGdCQUFnQjtBQUN0QyxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLFNBQVMsU0FBUyxNQUFNLFdBQVcsYUFBYTtBQUN6RCxTQUFTLFlBQVksMkJBQTJCLDBCQUEwQixTQUFTLDZCQUE2QjtBQUNoSCxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFnQyxpQ0FBaUM7QUFDakUsU0FBUyxlQUFlLHVCQUF1QjtBQUUvQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFdBQVc7QUFDcEIsU0FBUyxzQkFBc0I7QUFFL0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyw4QkFBOEI7QUFFdkMsTUFBTSxlQUFzRDtBQUFB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
