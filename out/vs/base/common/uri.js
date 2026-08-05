import { CharCode } from "./charCode.js";
import { MarshalledId } from "./marshallingIds.js";
import * as paths from "./path.js";
import { isWindows } from "./platform.js";
const _schemePattern = /^\w[\w\d+.-]*$/;
const _singleSlashStart = /^\//;
const _doubleSlashStart = /^\/\//;
function _validateUri(ret, _strict) {
  if (!ret.scheme && _strict) {
    throw new Error(`[UriError]: Scheme is missing: {scheme: "", authority: "${ret.authority}", path: "${ret.path}", query: "${ret.query}", fragment: "${ret.fragment}"}`);
  }
  if (ret.scheme && !_schemePattern.test(ret.scheme)) {
    throw new Error("[UriError]: Scheme contains illegal characters.");
  }
  if (ret.path) {
    if (ret.authority) {
      if (!_singleSlashStart.test(ret.path)) {
        throw new Error('[UriError]: If a URI contains an authority component, then the path component must either be empty or begin with a slash ("/") character');
      }
    } else {
      if (_doubleSlashStart.test(ret.path)) {
        throw new Error('[UriError]: If a URI does not contain an authority component, then the path cannot begin with two slash characters ("//")');
      }
    }
  }
}
function _schemeFix(scheme, _strict) {
  if (!scheme && !_strict) {
    return "file";
  }
  return scheme;
}
function _referenceResolution(scheme, path) {
  switch (scheme) {
    case "https":
    case "http":
    case "file":
      if (!path) {
        path = _slash;
      } else if (path[0] !== _slash) {
        path = _slash + path;
      }
      break;
  }
  return path;
}
const _empty = "";
const _slash = "/";
const _regexp = /^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;
class URI {
  static isUri(thing) {
    if (thing instanceof URI) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return typeof thing.authority === "string" && typeof thing.fragment === "string" && typeof thing.path === "string" && typeof thing.query === "string" && typeof thing.scheme === "string" && typeof thing.fsPath === "string" && typeof thing.with === "function" && typeof thing.toString === "function";
  }
  /**
   * @internal
   */
  constructor(schemeOrData, authority, path, query, fragment, _strict = false) {
    if (typeof schemeOrData === "object") {
      this.scheme = schemeOrData.scheme || _empty;
      this.authority = schemeOrData.authority || _empty;
      this.path = schemeOrData.path || _empty;
      this.query = schemeOrData.query || _empty;
      this.fragment = schemeOrData.fragment || _empty;
    } else {
      this.scheme = _schemeFix(schemeOrData, _strict);
      this.authority = authority || _empty;
      this.path = _referenceResolution(this.scheme, path || _empty);
      this.query = query || _empty;
      this.fragment = fragment || _empty;
      _validateUri(this, _strict);
    }
  }
  // ---- filesystem path -----------------------
  /**
   * Returns a string representing the corresponding file system path of this URI.
   * Will handle UNC paths, normalizes windows drive letters to lower-case, and uses the
   * platform specific path separator.
   *
   * * Will *not* validate the path for invalid characters and semantics.
   * * Will *not* look at the scheme of this URI.
   * * The result shall *not* be used for display purposes but for accessing a file on disk.
   *
   *
   * The *difference* to `URI#path` is the use of the platform specific separator and the handling
   * of UNC paths. See the below sample of a file-uri with an authority (UNC path).
   *
   * ```ts
  	const u = URI.parse('file://server/c$/folder/file.txt')
  	u.authority === 'server'
  	u.path === '/shares/c$/file.txt'
  	u.fsPath === '\\server\c$\folder\file.txt'
  ```
   *
   * Using `URI#path` to read a file (using fs-apis) would not be enough because parts of the path,
   * namely the server name, would be missing. Therefore `URI#fsPath` exists - it's sugar to ease working
   * with URIs that represent files on disk (`file` scheme).
   */
  get fsPath() {
    return uriToFsPath(this, false);
  }
  // ---- modify to new -------------------------
  with(change) {
    if (!change) {
      return this;
    }
    let { scheme, authority, path, query, fragment } = change;
    if (scheme === void 0) {
      scheme = this.scheme;
    } else if (scheme === null) {
      scheme = _empty;
    }
    if (authority === void 0) {
      authority = this.authority;
    } else if (authority === null) {
      authority = _empty;
    }
    if (path === void 0) {
      path = this.path;
    } else if (path === null) {
      path = _empty;
    }
    if (query === void 0) {
      query = this.query;
    } else if (query === null) {
      query = _empty;
    }
    if (fragment === void 0) {
      fragment = this.fragment;
    } else if (fragment === null) {
      fragment = _empty;
    }
    if (scheme === this.scheme && authority === this.authority && path === this.path && query === this.query && fragment === this.fragment) {
      return this;
    }
    return new Uri(scheme, authority, path, query, fragment);
  }
  // ---- parse & validate ------------------------
  /**
   * Creates a new URI from a string, e.g. `http://www.example.com/some/path`,
   * `file:///usr/home`, or `scheme:with/path`.
   *
   * @param value A string which represents an URI (see `URI#toString`).
   */
  static parse(value, _strict = false) {
    const match = _regexp.exec(value);
    if (!match) {
      return new Uri(_empty, _empty, _empty, _empty, _empty);
    }
    return new Uri(
      match[2] || _empty,
      percentDecode(match[4] || _empty),
      percentDecode(match[5] || _empty),
      percentDecode(match[7] || _empty),
      percentDecode(match[9] || _empty),
      _strict
    );
  }
  /**
   * Creates a new URI from a file system path, e.g. `c:\my\files`,
   * `/usr/home`, or `\\server\share\some\path`.
   *
   * The *difference* between `URI#parse` and `URI#file` is that the latter treats the argument
   * as path, not as stringified-uri. E.g. `URI.file(path)` is **not the same as**
   * `URI.parse('file://' + path)` because the path might contain characters that are
   * interpreted (# and ?). See the following sample:
   * ```ts
  const good = URI.file('/coding/c#/project1');
  good.scheme === 'file';
  good.path === '/coding/c#/project1';
  good.fragment === '';
  const bad = URI.parse('file://' + '/coding/c#/project1');
  bad.scheme === 'file';
  bad.path === '/coding/c'; // path is now broken
  bad.fragment === '/project1';
  ```
   *
   * @param path A file system path (see `URI#fsPath`)
   */
  static file(path) {
    let authority = _empty;
    if (isWindows) {
      path = path.replace(/\\/g, _slash);
    }
    if (path[0] === _slash && path[1] === _slash) {
      const idx = path.indexOf(_slash, 2);
      if (idx === -1) {
        authority = path.substring(2);
        path = _slash;
      } else {
        authority = path.substring(2, idx);
        path = path.substring(idx) || _slash;
      }
    }
    return new Uri("file", authority, path, _empty, _empty);
  }
  /**
   * Creates new URI from uri components.
   *
   * Unless `strict` is `true` the scheme is defaults to be `file`. This function performs
   * validation and should be used for untrusted uri components retrieved from storage,
   * user input, command arguments etc
   */
  static from(components, strict) {
    const result = new Uri(
      components.scheme,
      components.authority,
      components.path,
      components.query,
      components.fragment,
      strict
    );
    return result;
  }
  /**
   * Join a URI path with path fragments and normalizes the resulting path.
   *
   * @param uri The input URI.
   * @param pathFragment The path fragment to add to the URI path.
   * @returns The resulting URI.
   */
  static joinPath(uri, ...pathFragment) {
    if (!uri.path) {
      throw new Error(`[UriError]: cannot call joinPath on URI without path`);
    }
    let newPath;
    if (isWindows && uri.scheme === "file") {
      newPath = URI.file(paths.win32.join(uriToFsPath(uri, true), ...pathFragment)).path;
    } else {
      newPath = paths.posix.join(uri.path, ...pathFragment);
    }
    return uri.with({ path: newPath });
  }
  // ---- printing/externalize ---------------------------
  /**
   * Creates a string representation for this URI. It's guaranteed that calling
   * `URI.parse` with the result of this function creates an URI which is equal
   * to this URI.
   *
   * * The result shall *not* be used for display purposes but for externalization or transport.
   * * The result will be encoded using the percentage encoding and encoding happens mostly
   * ignore the scheme-specific encoding rules.
   *
   * @param skipEncoding Do not encode the result, default is `false`
   */
  toString(skipEncoding = false) {
    return _asFormatted(this, skipEncoding);
  }
  toJSON() {
    return this;
  }
  static revive(data) {
    if (!data) {
      return data;
    } else if (data instanceof URI) {
      return data;
    } else {
      const result = new Uri(data);
      result._formatted = data.external ?? null;
      result._fsPath = data._sep === _pathSepMarker ? data.fsPath ?? null : null;
      return result;
    }
  }
  [Symbol.for("debug.description")]() {
    return `URI(${this.toString()})`;
  }
}
function isUriComponents(thing) {
  if (!thing || typeof thing !== "object") {
    return false;
  }
  return typeof thing.scheme === "string" && (typeof thing.authority === "string" || typeof thing.authority === "undefined") && (typeof thing.path === "string" || typeof thing.path === "undefined") && (typeof thing.query === "string" || typeof thing.query === "undefined") && (typeof thing.fragment === "string" || typeof thing.fragment === "undefined");
}
const _pathSepMarker = isWindows ? 1 : void 0;
class Uri extends URI {
  constructor() {
    super(...arguments);
    this._formatted = null;
    this._fsPath = null;
  }
  get fsPath() {
    if (!this._fsPath) {
      this._fsPath = uriToFsPath(this, false);
    }
    return this._fsPath;
  }
  toString(skipEncoding = false) {
    if (!skipEncoding) {
      if (!this._formatted) {
        this._formatted = _asFormatted(this, false);
      }
      return this._formatted;
    } else {
      return _asFormatted(this, true);
    }
  }
  toJSON() {
    const res = {
      $mid: MarshalledId.Uri
    };
    if (this._fsPath) {
      res.fsPath = this._fsPath;
      res._sep = _pathSepMarker;
    }
    if (this._formatted) {
      res.external = this._formatted;
    }
    if (this.path) {
      res.path = this.path;
    }
    if (this.scheme) {
      res.scheme = this.scheme;
    }
    if (this.authority) {
      res.authority = this.authority;
    }
    if (this.query) {
      res.query = this.query;
    }
    if (this.fragment) {
      res.fragment = this.fragment;
    }
    return res;
  }
}
const encodeTable = {
  [CharCode.Colon]: "%3A",
  // gen-delims
  [CharCode.Slash]: "%2F",
  [CharCode.QuestionMark]: "%3F",
  [CharCode.Hash]: "%23",
  [CharCode.OpenSquareBracket]: "%5B",
  [CharCode.CloseSquareBracket]: "%5D",
  [CharCode.AtSign]: "%40",
  [CharCode.ExclamationMark]: "%21",
  // sub-delims
  [CharCode.DollarSign]: "%24",
  [CharCode.Ampersand]: "%26",
  [CharCode.SingleQuote]: "%27",
  [CharCode.OpenParen]: "%28",
  [CharCode.CloseParen]: "%29",
  [CharCode.Asterisk]: "%2A",
  [CharCode.Plus]: "%2B",
  [CharCode.Comma]: "%2C",
  [CharCode.Semicolon]: "%3B",
  [CharCode.Equals]: "%3D",
  [CharCode.Space]: "%20"
};
function encodeURIComponentFast(uriComponent, isPath, isAuthority) {
  let res = void 0;
  let nativeEncodePos = -1;
  for (let pos = 0; pos < uriComponent.length; pos++) {
    const code = uriComponent.charCodeAt(pos);
    if (code >= CharCode.a && code <= CharCode.z || code >= CharCode.A && code <= CharCode.Z || code >= CharCode.Digit0 && code <= CharCode.Digit9 || code === CharCode.Dash || code === CharCode.Period || code === CharCode.Underline || code === CharCode.Tilde || isPath && code === CharCode.Slash || isAuthority && code === CharCode.OpenSquareBracket || isAuthority && code === CharCode.CloseSquareBracket || isAuthority && code === CharCode.Colon) {
      if (nativeEncodePos !== -1) {
        res += encodeURIComponent(uriComponent.substring(nativeEncodePos, pos));
        nativeEncodePos = -1;
      }
      if (res !== void 0) {
        res += uriComponent.charAt(pos);
      }
    } else {
      if (res === void 0) {
        res = uriComponent.substr(0, pos);
      }
      const escaped = encodeTable[code];
      if (escaped !== void 0) {
        if (nativeEncodePos !== -1) {
          res += encodeURIComponent(uriComponent.substring(nativeEncodePos, pos));
          nativeEncodePos = -1;
        }
        res += escaped;
      } else if (nativeEncodePos === -1) {
        nativeEncodePos = pos;
      }
    }
  }
  if (nativeEncodePos !== -1) {
    res += encodeURIComponent(uriComponent.substring(nativeEncodePos));
  }
  return res !== void 0 ? res : uriComponent;
}
function encodeURIComponentMinimal(path) {
  let res = void 0;
  for (let pos = 0; pos < path.length; pos++) {
    const code = path.charCodeAt(pos);
    if (code === CharCode.Hash || code === CharCode.QuestionMark) {
      if (res === void 0) {
        res = path.substr(0, pos);
      }
      res += encodeTable[code];
    } else {
      if (res !== void 0) {
        res += path[pos];
      }
    }
  }
  return res !== void 0 ? res : path;
}
function uriToFsPath(uri, keepDriveLetterCasing) {
  let value;
  if (uri.authority && uri.path.length > 1 && uri.scheme === "file") {
    value = `//${uri.authority}${uri.path}`;
  } else if (uri.path.charCodeAt(0) === CharCode.Slash && (uri.path.charCodeAt(1) >= CharCode.A && uri.path.charCodeAt(1) <= CharCode.Z || uri.path.charCodeAt(1) >= CharCode.a && uri.path.charCodeAt(1) <= CharCode.z) && uri.path.charCodeAt(2) === CharCode.Colon) {
    if (!keepDriveLetterCasing) {
      value = uri.path[1].toLowerCase() + uri.path.substr(2);
    } else {
      value = uri.path.substr(1);
    }
  } else {
    value = uri.path;
  }
  if (isWindows) {
    value = value.replace(/\//g, "\\");
  }
  return value;
}
function _asFormatted(uri, skipEncoding) {
  const encoder = !skipEncoding ? encodeURIComponentFast : encodeURIComponentMinimal;
  let res = "";
  let { scheme, authority, path, query, fragment } = uri;
  if (scheme) {
    res += scheme;
    res += ":";
  }
  if (authority || scheme === "file") {
    res += _slash;
    res += _slash;
  }
  if (authority) {
    let idx = authority.indexOf("@");
    if (idx !== -1) {
      const userinfo = authority.substr(0, idx);
      authority = authority.substr(idx + 1);
      idx = userinfo.lastIndexOf(":");
      if (idx === -1) {
        res += encoder(userinfo, false, false);
      } else {
        res += encoder(userinfo.substr(0, idx), false, false);
        res += ":";
        res += encoder(userinfo.substr(idx + 1), false, true);
      }
      res += "@";
    }
    authority = authority.toLowerCase();
    idx = authority.lastIndexOf(":");
    if (idx === -1) {
      res += encoder(authority, false, true);
    } else {
      res += encoder(authority.substr(0, idx), false, true);
      res += authority.substr(idx);
    }
  }
  if (path) {
    if (path.length >= 3 && path.charCodeAt(0) === CharCode.Slash && path.charCodeAt(2) === CharCode.Colon) {
      const code = path.charCodeAt(1);
      if (code >= CharCode.A && code <= CharCode.Z) {
        path = `/${String.fromCharCode(code + 32)}:${path.substr(3)}`;
      }
    } else if (path.length >= 2 && path.charCodeAt(1) === CharCode.Colon) {
      const code = path.charCodeAt(0);
      if (code >= CharCode.A && code <= CharCode.Z) {
        path = `${String.fromCharCode(code + 32)}:${path.substr(2)}`;
      }
    }
    res += encoder(path, true, false);
  }
  if (query) {
    res += "?";
    res += encoder(query, false, false);
  }
  if (fragment) {
    res += "#";
    res += !skipEncoding ? encodeURIComponentFast(fragment, false, false) : fragment;
  }
  return res;
}
function decodeURIComponentGraceful(str) {
  try {
    return decodeURIComponent(str);
  } catch {
    if (str.length > 3) {
      return str.substr(0, 3) + decodeURIComponentGraceful(str.substr(3));
    } else {
      return str;
    }
  }
}
const _rEncodedAsHex = /(%[0-9A-Za-z][0-9A-Za-z])+/g;
function percentDecode(str) {
  if (!str.match(_rEncodedAsHex)) {
    return str;
  }
  return str.replace(_rEncodedAsHex, (match) => decodeURIComponentGraceful(match));
}
export {
  URI,
  isUriComponents,
  uriToFsPath
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi91cmkudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDaGFyQ29kZSB9IGZyb20gJy4vY2hhckNvZGUuanMnO1xuaW1wb3J0IHsgTWFyc2hhbGxlZElkIH0gZnJvbSAnLi9tYXJzaGFsbGluZ0lkcy5qcyc7XG5pbXBvcnQgKiBhcyBwYXRocyBmcm9tICcuL3BhdGguanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi9wbGF0Zm9ybS5qcyc7XG5cbmNvbnN0IF9zY2hlbWVQYXR0ZXJuID0gL15cXHdbXFx3XFxkKy4tXSokLztcbmNvbnN0IF9zaW5nbGVTbGFzaFN0YXJ0ID0gL15cXC8vO1xuY29uc3QgX2RvdWJsZVNsYXNoU3RhcnQgPSAvXlxcL1xcLy87XG5cbmZ1bmN0aW9uIF92YWxpZGF0ZVVyaShyZXQ6IFVSSSwgX3N0cmljdD86IGJvb2xlYW4pOiB2b2lkIHtcblxuXHQvLyBzY2hlbWUsIG11c3QgYmUgc2V0XG5cdGlmICghcmV0LnNjaGVtZSAmJiBfc3RyaWN0KSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBbVXJpRXJyb3JdOiBTY2hlbWUgaXMgbWlzc2luZzoge3NjaGVtZTogXCJcIiwgYXV0aG9yaXR5OiBcIiR7cmV0LmF1dGhvcml0eX1cIiwgcGF0aDogXCIke3JldC5wYXRofVwiLCBxdWVyeTogXCIke3JldC5xdWVyeX1cIiwgZnJhZ21lbnQ6IFwiJHtyZXQuZnJhZ21lbnR9XCJ9YCk7XG5cdH1cblxuXHQvLyBzY2hlbWUsIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzOTg2I3NlY3Rpb24tMy4xXG5cdC8vIEFMUEhBICooIEFMUEhBIC8gRElHSVQgLyBcIitcIiAvIFwiLVwiIC8gXCIuXCIgKVxuXHRpZiAocmV0LnNjaGVtZSAmJiAhX3NjaGVtZVBhdHRlcm4udGVzdChyZXQuc2NoZW1lKSkge1xuXHRcdHRocm93IG5ldyBFcnJvcignW1VyaUVycm9yXTogU2NoZW1lIGNvbnRhaW5zIGlsbGVnYWwgY2hhcmFjdGVycy4nKTtcblx0fVxuXG5cdC8vIHBhdGgsIGh0dHA6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM5ODYjc2VjdGlvbi0zLjNcblx0Ly8gSWYgYSBVUkkgY29udGFpbnMgYW4gYXV0aG9yaXR5IGNvbXBvbmVudCwgdGhlbiB0aGUgcGF0aCBjb21wb25lbnRcblx0Ly8gbXVzdCBlaXRoZXIgYmUgZW1wdHkgb3IgYmVnaW4gd2l0aCBhIHNsYXNoIChcIi9cIikgY2hhcmFjdGVyLiAgSWYgYSBVUklcblx0Ly8gZG9lcyBub3QgY29udGFpbiBhbiBhdXRob3JpdHkgY29tcG9uZW50LCB0aGVuIHRoZSBwYXRoIGNhbm5vdCBiZWdpblxuXHQvLyB3aXRoIHR3byBzbGFzaCBjaGFyYWN0ZXJzIChcIi8vXCIpLlxuXHRpZiAocmV0LnBhdGgpIHtcblx0XHRpZiAocmV0LmF1dGhvcml0eSkge1xuXHRcdFx0aWYgKCFfc2luZ2xlU2xhc2hTdGFydC50ZXN0KHJldC5wYXRoKSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1tVcmlFcnJvcl06IElmIGEgVVJJIGNvbnRhaW5zIGFuIGF1dGhvcml0eSBjb21wb25lbnQsIHRoZW4gdGhlIHBhdGggY29tcG9uZW50IG11c3QgZWl0aGVyIGJlIGVtcHR5IG9yIGJlZ2luIHdpdGggYSBzbGFzaCAoXCIvXCIpIGNoYXJhY3RlcicpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoX2RvdWJsZVNsYXNoU3RhcnQudGVzdChyZXQucGF0aCkpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdbVXJpRXJyb3JdOiBJZiBhIFVSSSBkb2VzIG5vdCBjb250YWluIGFuIGF1dGhvcml0eSBjb21wb25lbnQsIHRoZW4gdGhlIHBhdGggY2Fubm90IGJlZ2luIHdpdGggdHdvIHNsYXNoIGNoYXJhY3RlcnMgKFwiLy9cIiknKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuLy8gZm9yIGEgd2hpbGUgd2UgYWxsb3dlZCB1cmlzICp3aXRob3V0KiBzY2hlbWVzIGFuZCB0aGlzIGlzIHRoZSBtaWdyYXRpb25cbi8vIGZvciB0aGVtLCBlLmcuIGFuIHVyaSB3aXRob3V0IHNjaGVtZSBhbmQgd2l0aG91dCBzdHJpY3QtbW9kZSB3YXJucyBhbmQgZmFsbHNcbi8vIGJhY2sgdG8gdGhlIGZpbGUtc2NoZW1lLiB0aGF0IHNob3VsZCBjYXVzZSB0aGUgbGVhc3QgY2FybmFnZSBhbmQgc3RpbGwgYmUgYVxuLy8gY2xlYXIgd2FybmluZ1xuZnVuY3Rpb24gX3NjaGVtZUZpeChzY2hlbWU6IHN0cmluZywgX3N0cmljdDogYm9vbGVhbik6IHN0cmluZyB7XG5cdGlmICghc2NoZW1lICYmICFfc3RyaWN0KSB7XG5cdFx0cmV0dXJuICdmaWxlJztcblx0fVxuXHRyZXR1cm4gc2NoZW1lO1xufVxuXG4vLyBpbXBsZW1lbnRzIGEgYml0IG9mIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzOTg2I3NlY3Rpb24tNVxuZnVuY3Rpb24gX3JlZmVyZW5jZVJlc29sdXRpb24oc2NoZW1lOiBzdHJpbmcsIHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG5cblx0Ly8gdGhlIHNsYXNoLWNoYXJhY3RlciBpcyBvdXIgJ2RlZmF1bHQgYmFzZScgYXMgd2UgZG9uJ3Rcblx0Ly8gc3VwcG9ydCBjb25zdHJ1Y3RpbmcgVVJJcyByZWxhdGl2ZSB0byBvdGhlciBVUklzLiBUaGlzXG5cdC8vIGFsc28gbWVhbnMgdGhhdCB3ZSBhbHRlciBhbmQgcG90ZW50aWFsbHkgYnJlYWsgcGF0aHMuXG5cdC8vIHNlZSBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzk4NiNzZWN0aW9uLTUuMS40XG5cdHN3aXRjaCAoc2NoZW1lKSB7XG5cdFx0Y2FzZSAnaHR0cHMnOlxuXHRcdGNhc2UgJ2h0dHAnOlxuXHRcdGNhc2UgJ2ZpbGUnOlxuXHRcdFx0aWYgKCFwYXRoKSB7XG5cdFx0XHRcdHBhdGggPSBfc2xhc2g7XG5cdFx0XHR9IGVsc2UgaWYgKHBhdGhbMF0gIT09IF9zbGFzaCkge1xuXHRcdFx0XHRwYXRoID0gX3NsYXNoICsgcGF0aDtcblx0XHRcdH1cblx0XHRcdGJyZWFrO1xuXHR9XG5cdHJldHVybiBwYXRoO1xufVxuXG5jb25zdCBfZW1wdHkgPSAnJztcbmNvbnN0IF9zbGFzaCA9ICcvJztcbmNvbnN0IF9yZWdleHAgPSAvXigoW146Lz8jXSs/KTopPyhcXC9cXC8oW14vPyNdKikpPyhbXj8jXSopKFxcPyhbXiNdKikpPygjKC4qKSk/LztcblxuLyoqXG4gKiBVbmlmb3JtIFJlc291cmNlIElkZW50aWZpZXIgKFVSSSkgaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzk4Ni5cbiAqIFRoaXMgY2xhc3MgaXMgYSBzaW1wbGUgcGFyc2VyIHdoaWNoIGNyZWF0ZXMgdGhlIGJhc2ljIGNvbXBvbmVudCBwYXJ0c1xuICogKGh0dHA6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM5ODYjc2VjdGlvbi0zKSB3aXRoIG1pbmltYWwgdmFsaWRhdGlvblxuICogYW5kIGVuY29kaW5nLlxuICpcbiAqIGBgYHR4dFxuICogICAgICAgZm9vOi8vZXhhbXBsZS5jb206ODA0Mi9vdmVyL3RoZXJlP25hbWU9ZmVycmV0I25vc2VcbiAqICAgICAgIFxcXy8gICBcXF9fX19fX19fX19fX19fL1xcX19fX19fX19fLyBcXF9fX19fX19fXy8gXFxfXy9cbiAqICAgICAgICB8ICAgICAgICAgICB8ICAgICAgICAgICAgfCAgICAgICAgICAgIHwgICAgICAgIHxcbiAqICAgICBzY2hlbWUgICAgIGF1dGhvcml0eSAgICAgICBwYXRoICAgICAgICBxdWVyeSAgIGZyYWdtZW50XG4gKiAgICAgICAgfCAgIF9fX19fX19fX19fX19fX19fX19fX3xfX1xuICogICAgICAgLyBcXCAvICAgICAgICAgICAgICAgICAgICAgICAgXFxcbiAqICAgICAgIHVybjpleGFtcGxlOmFuaW1hbDpmZXJyZXQ6bm9zZVxuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBVUkkgaW1wbGVtZW50cyBVcmlDb21wb25lbnRzIHtcblxuXHRzdGF0aWMgaXNVcmkodGhpbmc6IGFueSk6IHRoaW5nIGlzIFVSSSB7XG5cdFx0aWYgKHRoaW5nIGluc3RhbmNlb2YgVVJJKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKCF0aGluZykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdHlwZW9mICg8VVJJPnRoaW5nKS5hdXRob3JpdHkgPT09ICdzdHJpbmcnXG5cdFx0XHQmJiB0eXBlb2YgKDxVUkk+dGhpbmcpLmZyYWdtZW50ID09PSAnc3RyaW5nJ1xuXHRcdFx0JiYgdHlwZW9mICg8VVJJPnRoaW5nKS5wYXRoID09PSAnc3RyaW5nJ1xuXHRcdFx0JiYgdHlwZW9mICg8VVJJPnRoaW5nKS5xdWVyeSA9PT0gJ3N0cmluZydcblx0XHRcdCYmIHR5cGVvZiAoPFVSST50aGluZykuc2NoZW1lID09PSAnc3RyaW5nJ1xuXHRcdFx0JiYgdHlwZW9mICg8VVJJPnRoaW5nKS5mc1BhdGggPT09ICdzdHJpbmcnXG5cdFx0XHQmJiB0eXBlb2YgKDxVUkk+dGhpbmcpLndpdGggPT09ICdmdW5jdGlvbidcblx0XHRcdCYmIHR5cGVvZiAoPFVSST50aGluZykudG9TdHJpbmcgPT09ICdmdW5jdGlvbic7XG5cdH1cblxuXHQvKipcblx0ICogc2NoZW1lIGlzIHRoZSAnaHR0cCcgcGFydCBvZiAnaHR0cDovL3d3dy5leGFtcGxlLmNvbS9zb21lL3BhdGg/cXVlcnkjZnJhZ21lbnQnLlxuXHQgKiBUaGUgcGFydCBiZWZvcmUgdGhlIGZpcnN0IGNvbG9uLlxuXHQgKi9cblx0cmVhZG9ubHkgc2NoZW1lOiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIGF1dGhvcml0eSBpcyB0aGUgJ3d3dy5leGFtcGxlLmNvbScgcGFydCBvZiAnaHR0cDovL3d3dy5leGFtcGxlLmNvbS9zb21lL3BhdGg/cXVlcnkjZnJhZ21lbnQnLlxuXHQgKiBUaGUgcGFydCBiZXR3ZWVuIHRoZSBmaXJzdCBkb3VibGUgc2xhc2hlcyBhbmQgdGhlIG5leHQgc2xhc2guXG5cdCAqL1xuXHRyZWFkb25seSBhdXRob3JpdHk6IHN0cmluZztcblxuXHQvKipcblx0ICogcGF0aCBpcyB0aGUgJy9zb21lL3BhdGgnIHBhcnQgb2YgJ2h0dHA6Ly93d3cuZXhhbXBsZS5jb20vc29tZS9wYXRoP3F1ZXJ5I2ZyYWdtZW50Jy5cblx0ICovXG5cdHJlYWRvbmx5IHBhdGg6IHN0cmluZztcblxuXHQvKipcblx0ICogcXVlcnkgaXMgdGhlICdxdWVyeScgcGFydCBvZiAnaHR0cDovL3d3dy5leGFtcGxlLmNvbS9zb21lL3BhdGg/cXVlcnkjZnJhZ21lbnQnLlxuXHQgKi9cblx0cmVhZG9ubHkgcXVlcnk6IHN0cmluZztcblxuXHQvKipcblx0ICogZnJhZ21lbnQgaXMgdGhlICdmcmFnbWVudCcgcGFydCBvZiAnaHR0cDovL3d3dy5leGFtcGxlLmNvbS9zb21lL3BhdGg/cXVlcnkjZnJhZ21lbnQnLlxuXHQgKi9cblx0cmVhZG9ubHkgZnJhZ21lbnQ6IHN0cmluZztcblxuXHQvKipcblx0ICogQGludGVybmFsXG5cdCAqL1xuXHRwcm90ZWN0ZWQgY29uc3RydWN0b3Ioc2NoZW1lOiBzdHJpbmcsIGF1dGhvcml0eT86IHN0cmluZywgcGF0aD86IHN0cmluZywgcXVlcnk/OiBzdHJpbmcsIGZyYWdtZW50Pzogc3RyaW5nLCBfc3RyaWN0PzogYm9vbGVhbik7XG5cblx0LyoqXG5cdCAqIEBpbnRlcm5hbFxuXHQgKi9cblx0cHJvdGVjdGVkIGNvbnN0cnVjdG9yKGNvbXBvbmVudHM6IFVyaUNvbXBvbmVudHMpO1xuXG5cdC8qKlxuXHQgKiBAaW50ZXJuYWxcblx0ICovXG5cdHByb3RlY3RlZCBjb25zdHJ1Y3RvcihzY2hlbWVPckRhdGE6IHN0cmluZyB8IFVyaUNvbXBvbmVudHMsIGF1dGhvcml0eT86IHN0cmluZywgcGF0aD86IHN0cmluZywgcXVlcnk/OiBzdHJpbmcsIGZyYWdtZW50Pzogc3RyaW5nLCBfc3RyaWN0OiBib29sZWFuID0gZmFsc2UpIHtcblxuXHRcdGlmICh0eXBlb2Ygc2NoZW1lT3JEYXRhID09PSAnb2JqZWN0Jykge1xuXHRcdFx0dGhpcy5zY2hlbWUgPSBzY2hlbWVPckRhdGEuc2NoZW1lIHx8IF9lbXB0eTtcblx0XHRcdHRoaXMuYXV0aG9yaXR5ID0gc2NoZW1lT3JEYXRhLmF1dGhvcml0eSB8fCBfZW1wdHk7XG5cdFx0XHR0aGlzLnBhdGggPSBzY2hlbWVPckRhdGEucGF0aCB8fCBfZW1wdHk7XG5cdFx0XHR0aGlzLnF1ZXJ5ID0gc2NoZW1lT3JEYXRhLnF1ZXJ5IHx8IF9lbXB0eTtcblx0XHRcdHRoaXMuZnJhZ21lbnQgPSBzY2hlbWVPckRhdGEuZnJhZ21lbnQgfHwgX2VtcHR5O1xuXHRcdFx0Ly8gbm8gdmFsaWRhdGlvbiBiZWNhdXNlIGl0J3MgdGhpcyBVUklcblx0XHRcdC8vIHRoYXQgY3JlYXRlcyB1cmkgY29tcG9uZW50cy5cblx0XHRcdC8vIF92YWxpZGF0ZVVyaSh0aGlzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zY2hlbWUgPSBfc2NoZW1lRml4KHNjaGVtZU9yRGF0YSwgX3N0cmljdCk7XG5cdFx0XHR0aGlzLmF1dGhvcml0eSA9IGF1dGhvcml0eSB8fCBfZW1wdHk7XG5cdFx0XHR0aGlzLnBhdGggPSBfcmVmZXJlbmNlUmVzb2x1dGlvbih0aGlzLnNjaGVtZSwgcGF0aCB8fCBfZW1wdHkpO1xuXHRcdFx0dGhpcy5xdWVyeSA9IHF1ZXJ5IHx8IF9lbXB0eTtcblx0XHRcdHRoaXMuZnJhZ21lbnQgPSBmcmFnbWVudCB8fCBfZW1wdHk7XG5cblx0XHRcdF92YWxpZGF0ZVVyaSh0aGlzLCBfc3RyaWN0KTtcblx0XHR9XG5cdH1cblxuXHQvLyAtLS0tIGZpbGVzeXN0ZW0gcGF0aCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgY29ycmVzcG9uZGluZyBmaWxlIHN5c3RlbSBwYXRoIG9mIHRoaXMgVVJJLlxuXHQgKiBXaWxsIGhhbmRsZSBVTkMgcGF0aHMsIG5vcm1hbGl6ZXMgd2luZG93cyBkcml2ZSBsZXR0ZXJzIHRvIGxvd2VyLWNhc2UsIGFuZCB1c2VzIHRoZVxuXHQgKiBwbGF0Zm9ybSBzcGVjaWZpYyBwYXRoIHNlcGFyYXRvci5cblx0ICpcblx0ICogKiBXaWxsICpub3QqIHZhbGlkYXRlIHRoZSBwYXRoIGZvciBpbnZhbGlkIGNoYXJhY3RlcnMgYW5kIHNlbWFudGljcy5cblx0ICogKiBXaWxsICpub3QqIGxvb2sgYXQgdGhlIHNjaGVtZSBvZiB0aGlzIFVSSS5cblx0ICogKiBUaGUgcmVzdWx0IHNoYWxsICpub3QqIGJlIHVzZWQgZm9yIGRpc3BsYXkgcHVycG9zZXMgYnV0IGZvciBhY2Nlc3NpbmcgYSBmaWxlIG9uIGRpc2suXG5cdCAqXG5cdCAqXG5cdCAqIFRoZSAqZGlmZmVyZW5jZSogdG8gYFVSSSNwYXRoYCBpcyB0aGUgdXNlIG9mIHRoZSBwbGF0Zm9ybSBzcGVjaWZpYyBzZXBhcmF0b3IgYW5kIHRoZSBoYW5kbGluZ1xuXHQgKiBvZiBVTkMgcGF0aHMuIFNlZSB0aGUgYmVsb3cgc2FtcGxlIG9mIGEgZmlsZS11cmkgd2l0aCBhbiBhdXRob3JpdHkgKFVOQyBwYXRoKS5cblx0ICpcblx0ICogYGBgdHNcblx0XHRjb25zdCB1ID0gVVJJLnBhcnNlKCdmaWxlOi8vc2VydmVyL2MkL2ZvbGRlci9maWxlLnR4dCcpXG5cdFx0dS5hdXRob3JpdHkgPT09ICdzZXJ2ZXInXG5cdFx0dS5wYXRoID09PSAnL3NoYXJlcy9jJC9maWxlLnR4dCdcblx0XHR1LmZzUGF0aCA9PT0gJ1xcXFxzZXJ2ZXJcXGMkXFxmb2xkZXJcXGZpbGUudHh0J1xuXHRgYGBcblx0ICpcblx0ICogVXNpbmcgYFVSSSNwYXRoYCB0byByZWFkIGEgZmlsZSAodXNpbmcgZnMtYXBpcykgd291bGQgbm90IGJlIGVub3VnaCBiZWNhdXNlIHBhcnRzIG9mIHRoZSBwYXRoLFxuXHQgKiBuYW1lbHkgdGhlIHNlcnZlciBuYW1lLCB3b3VsZCBiZSBtaXNzaW5nLiBUaGVyZWZvcmUgYFVSSSNmc1BhdGhgIGV4aXN0cyAtIGl0J3Mgc3VnYXIgdG8gZWFzZSB3b3JraW5nXG5cdCAqIHdpdGggVVJJcyB0aGF0IHJlcHJlc2VudCBmaWxlcyBvbiBkaXNrIChgZmlsZWAgc2NoZW1lKS5cblx0ICovXG5cdGdldCBmc1BhdGgoKTogc3RyaW5nIHtcblx0XHQvLyBpZiAodGhpcy5zY2hlbWUgIT09ICdmaWxlJykge1xuXHRcdC8vIFx0Y29uc29sZS53YXJuKGBbVXJpRXJyb3JdIGNhbGxpbmcgZnNQYXRoIHdpdGggc2NoZW1lICR7dGhpcy5zY2hlbWV9YCk7XG5cdFx0Ly8gfVxuXHRcdHJldHVybiB1cmlUb0ZzUGF0aCh0aGlzLCBmYWxzZSk7XG5cdH1cblxuXHQvLyAtLS0tIG1vZGlmeSB0byBuZXcgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdHdpdGgoY2hhbmdlOiB7IHNjaGVtZT86IHN0cmluZzsgYXV0aG9yaXR5Pzogc3RyaW5nIHwgbnVsbDsgcGF0aD86IHN0cmluZyB8IG51bGw7IHF1ZXJ5Pzogc3RyaW5nIHwgbnVsbDsgZnJhZ21lbnQ/OiBzdHJpbmcgfCBudWxsIH0pOiBVUkkge1xuXG5cdFx0aWYgKCFjaGFuZ2UpIHtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblxuXHRcdGxldCB7IHNjaGVtZSwgYXV0aG9yaXR5LCBwYXRoLCBxdWVyeSwgZnJhZ21lbnQgfSA9IGNoYW5nZTtcblx0XHRpZiAoc2NoZW1lID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHNjaGVtZSA9IHRoaXMuc2NoZW1lO1xuXHRcdH0gZWxzZSBpZiAoc2NoZW1lID09PSBudWxsKSB7XG5cdFx0XHRzY2hlbWUgPSBfZW1wdHk7XG5cdFx0fVxuXHRcdGlmIChhdXRob3JpdHkgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0YXV0aG9yaXR5ID0gdGhpcy5hdXRob3JpdHk7XG5cdFx0fSBlbHNlIGlmIChhdXRob3JpdHkgPT09IG51bGwpIHtcblx0XHRcdGF1dGhvcml0eSA9IF9lbXB0eTtcblx0XHR9XG5cdFx0aWYgKHBhdGggPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cGF0aCA9IHRoaXMucGF0aDtcblx0XHR9IGVsc2UgaWYgKHBhdGggPT09IG51bGwpIHtcblx0XHRcdHBhdGggPSBfZW1wdHk7XG5cdFx0fVxuXHRcdGlmIChxdWVyeSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRxdWVyeSA9IHRoaXMucXVlcnk7XG5cdFx0fSBlbHNlIGlmIChxdWVyeSA9PT0gbnVsbCkge1xuXHRcdFx0cXVlcnkgPSBfZW1wdHk7XG5cdFx0fVxuXHRcdGlmIChmcmFnbWVudCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRmcmFnbWVudCA9IHRoaXMuZnJhZ21lbnQ7XG5cdFx0fSBlbHNlIGlmIChmcmFnbWVudCA9PT0gbnVsbCkge1xuXHRcdFx0ZnJhZ21lbnQgPSBfZW1wdHk7XG5cdFx0fVxuXG5cdFx0aWYgKHNjaGVtZSA9PT0gdGhpcy5zY2hlbWVcblx0XHRcdCYmIGF1dGhvcml0eSA9PT0gdGhpcy5hdXRob3JpdHlcblx0XHRcdCYmIHBhdGggPT09IHRoaXMucGF0aFxuXHRcdFx0JiYgcXVlcnkgPT09IHRoaXMucXVlcnlcblx0XHRcdCYmIGZyYWdtZW50ID09PSB0aGlzLmZyYWdtZW50KSB7XG5cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgVXJpKHNjaGVtZSwgYXV0aG9yaXR5LCBwYXRoLCBxdWVyeSwgZnJhZ21lbnQpO1xuXHR9XG5cblx0Ly8gLS0tLSBwYXJzZSAmIHZhbGlkYXRlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IFVSSSBmcm9tIGEgc3RyaW5nLCBlLmcuIGBodHRwOi8vd3d3LmV4YW1wbGUuY29tL3NvbWUvcGF0aGAsXG5cdCAqIGBmaWxlOi8vL3Vzci9ob21lYCwgb3IgYHNjaGVtZTp3aXRoL3BhdGhgLlxuXHQgKlxuXHQgKiBAcGFyYW0gdmFsdWUgQSBzdHJpbmcgd2hpY2ggcmVwcmVzZW50cyBhbiBVUkkgKHNlZSBgVVJJI3RvU3RyaW5nYCkuXG5cdCAqL1xuXHRzdGF0aWMgcGFyc2UodmFsdWU6IHN0cmluZywgX3N0cmljdDogYm9vbGVhbiA9IGZhbHNlKTogVVJJIHtcblx0XHRjb25zdCBtYXRjaCA9IF9yZWdleHAuZXhlYyh2YWx1ZSk7XG5cdFx0aWYgKCFtYXRjaCkge1xuXHRcdFx0cmV0dXJuIG5ldyBVcmkoX2VtcHR5LCBfZW1wdHksIF9lbXB0eSwgX2VtcHR5LCBfZW1wdHkpO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IFVyaShcblx0XHRcdG1hdGNoWzJdIHx8IF9lbXB0eSxcblx0XHRcdHBlcmNlbnREZWNvZGUobWF0Y2hbNF0gfHwgX2VtcHR5KSxcblx0XHRcdHBlcmNlbnREZWNvZGUobWF0Y2hbNV0gfHwgX2VtcHR5KSxcblx0XHRcdHBlcmNlbnREZWNvZGUobWF0Y2hbN10gfHwgX2VtcHR5KSxcblx0XHRcdHBlcmNlbnREZWNvZGUobWF0Y2hbOV0gfHwgX2VtcHR5KSxcblx0XHRcdF9zdHJpY3Rcblx0XHQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBuZXcgVVJJIGZyb20gYSBmaWxlIHN5c3RlbSBwYXRoLCBlLmcuIGBjOlxcbXlcXGZpbGVzYCxcblx0ICogYC91c3IvaG9tZWAsIG9yIGBcXFxcc2VydmVyXFxzaGFyZVxcc29tZVxccGF0aGAuXG5cdCAqXG5cdCAqIFRoZSAqZGlmZmVyZW5jZSogYmV0d2VlbiBgVVJJI3BhcnNlYCBhbmQgYFVSSSNmaWxlYCBpcyB0aGF0IHRoZSBsYXR0ZXIgdHJlYXRzIHRoZSBhcmd1bWVudFxuXHQgKiBhcyBwYXRoLCBub3QgYXMgc3RyaW5naWZpZWQtdXJpLiBFLmcuIGBVUkkuZmlsZShwYXRoKWAgaXMgKipub3QgdGhlIHNhbWUgYXMqKlxuXHQgKiBgVVJJLnBhcnNlKCdmaWxlOi8vJyArIHBhdGgpYCBiZWNhdXNlIHRoZSBwYXRoIG1pZ2h0IGNvbnRhaW4gY2hhcmFjdGVycyB0aGF0IGFyZVxuXHQgKiBpbnRlcnByZXRlZCAoIyBhbmQgPykuIFNlZSB0aGUgZm9sbG93aW5nIHNhbXBsZTpcblx0ICogYGBgdHNcblx0Y29uc3QgZ29vZCA9IFVSSS5maWxlKCcvY29kaW5nL2MjL3Byb2plY3QxJyk7XG5cdGdvb2Quc2NoZW1lID09PSAnZmlsZSc7XG5cdGdvb2QucGF0aCA9PT0gJy9jb2RpbmcvYyMvcHJvamVjdDEnO1xuXHRnb29kLmZyYWdtZW50ID09PSAnJztcblx0Y29uc3QgYmFkID0gVVJJLnBhcnNlKCdmaWxlOi8vJyArICcvY29kaW5nL2MjL3Byb2plY3QxJyk7XG5cdGJhZC5zY2hlbWUgPT09ICdmaWxlJztcblx0YmFkLnBhdGggPT09ICcvY29kaW5nL2MnOyAvLyBwYXRoIGlzIG5vdyBicm9rZW5cblx0YmFkLmZyYWdtZW50ID09PSAnL3Byb2plY3QxJztcblx0YGBgXG5cdCAqXG5cdCAqIEBwYXJhbSBwYXRoIEEgZmlsZSBzeXN0ZW0gcGF0aCAoc2VlIGBVUkkjZnNQYXRoYClcblx0ICovXG5cdHN0YXRpYyBmaWxlKHBhdGg6IHN0cmluZyk6IFVSSSB7XG5cblx0XHRsZXQgYXV0aG9yaXR5ID0gX2VtcHR5O1xuXG5cdFx0Ly8gbm9ybWFsaXplIHRvIGZ3ZC1zbGFzaGVzIG9uIHdpbmRvd3MsXG5cdFx0Ly8gb24gb3RoZXIgc3lzdGVtcyBid2Qtc2xhc2hlcyBhcmUgdmFsaWRcblx0XHQvLyBmaWxlbmFtZSBjaGFyYWN0ZXIsIGVnIC9mXFxvby9iYVxcci50eHRcblx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHRwYXRoID0gcGF0aC5yZXBsYWNlKC9cXFxcL2csIF9zbGFzaCk7XG5cdFx0fVxuXG5cdFx0Ly8gY2hlY2sgZm9yIGF1dGhvcml0eSBhcyB1c2VkIGluIFVOQyBzaGFyZXNcblx0XHQvLyBvciB1c2UgdGhlIHBhdGggYXMgZ2l2ZW5cblx0XHRpZiAocGF0aFswXSA9PT0gX3NsYXNoICYmIHBhdGhbMV0gPT09IF9zbGFzaCkge1xuXHRcdFx0Y29uc3QgaWR4ID0gcGF0aC5pbmRleE9mKF9zbGFzaCwgMik7XG5cdFx0XHRpZiAoaWR4ID09PSAtMSkge1xuXHRcdFx0XHRhdXRob3JpdHkgPSBwYXRoLnN1YnN0cmluZygyKTtcblx0XHRcdFx0cGF0aCA9IF9zbGFzaDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF1dGhvcml0eSA9IHBhdGguc3Vic3RyaW5nKDIsIGlkeCk7XG5cdFx0XHRcdHBhdGggPSBwYXRoLnN1YnN0cmluZyhpZHgpIHx8IF9zbGFzaDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IFVyaSgnZmlsZScsIGF1dGhvcml0eSwgcGF0aCwgX2VtcHR5LCBfZW1wdHkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgbmV3IFVSSSBmcm9tIHVyaSBjb21wb25lbnRzLlxuXHQgKlxuXHQgKiBVbmxlc3MgYHN0cmljdGAgaXMgYHRydWVgIHRoZSBzY2hlbWUgaXMgZGVmYXVsdHMgdG8gYmUgYGZpbGVgLiBUaGlzIGZ1bmN0aW9uIHBlcmZvcm1zXG5cdCAqIHZhbGlkYXRpb24gYW5kIHNob3VsZCBiZSB1c2VkIGZvciB1bnRydXN0ZWQgdXJpIGNvbXBvbmVudHMgcmV0cmlldmVkIGZyb20gc3RvcmFnZSxcblx0ICogdXNlciBpbnB1dCwgY29tbWFuZCBhcmd1bWVudHMgZXRjXG5cdCAqL1xuXHRzdGF0aWMgZnJvbShjb21wb25lbnRzOiBVcmlDb21wb25lbnRzLCBzdHJpY3Q/OiBib29sZWFuKTogVVJJIHtcblx0XHRjb25zdCByZXN1bHQgPSBuZXcgVXJpKFxuXHRcdFx0Y29tcG9uZW50cy5zY2hlbWUsXG5cdFx0XHRjb21wb25lbnRzLmF1dGhvcml0eSxcblx0XHRcdGNvbXBvbmVudHMucGF0aCxcblx0XHRcdGNvbXBvbmVudHMucXVlcnksXG5cdFx0XHRjb21wb25lbnRzLmZyYWdtZW50LFxuXHRcdFx0c3RyaWN0XG5cdFx0KTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0LyoqXG5cdCAqIEpvaW4gYSBVUkkgcGF0aCB3aXRoIHBhdGggZnJhZ21lbnRzIGFuZCBub3JtYWxpemVzIHRoZSByZXN1bHRpbmcgcGF0aC5cblx0ICpcblx0ICogQHBhcmFtIHVyaSBUaGUgaW5wdXQgVVJJLlxuXHQgKiBAcGFyYW0gcGF0aEZyYWdtZW50IFRoZSBwYXRoIGZyYWdtZW50IHRvIGFkZCB0byB0aGUgVVJJIHBhdGguXG5cdCAqIEByZXR1cm5zIFRoZSByZXN1bHRpbmcgVVJJLlxuXHQgKi9cblx0c3RhdGljIGpvaW5QYXRoKHVyaTogVVJJLCAuLi5wYXRoRnJhZ21lbnQ6IHN0cmluZ1tdKTogVVJJIHtcblx0XHRpZiAoIXVyaS5wYXRoKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFtVcmlFcnJvcl06IGNhbm5vdCBjYWxsIGpvaW5QYXRoIG9uIFVSSSB3aXRob3V0IHBhdGhgKTtcblx0XHR9XG5cdFx0bGV0IG5ld1BhdGg6IHN0cmluZztcblx0XHRpZiAoaXNXaW5kb3dzICYmIHVyaS5zY2hlbWUgPT09ICdmaWxlJykge1xuXHRcdFx0bmV3UGF0aCA9IFVSSS5maWxlKHBhdGhzLndpbjMyLmpvaW4odXJpVG9Gc1BhdGgodXJpLCB0cnVlKSwgLi4ucGF0aEZyYWdtZW50KSkucGF0aDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bmV3UGF0aCA9IHBhdGhzLnBvc2l4LmpvaW4odXJpLnBhdGgsIC4uLnBhdGhGcmFnbWVudCk7XG5cdFx0fVxuXHRcdHJldHVybiB1cmkud2l0aCh7IHBhdGg6IG5ld1BhdGggfSk7XG5cdH1cblxuXHQvLyAtLS0tIHByaW50aW5nL2V4dGVybmFsaXplIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIGZvciB0aGlzIFVSSS4gSXQncyBndWFyYW50ZWVkIHRoYXQgY2FsbGluZ1xuXHQgKiBgVVJJLnBhcnNlYCB3aXRoIHRoZSByZXN1bHQgb2YgdGhpcyBmdW5jdGlvbiBjcmVhdGVzIGFuIFVSSSB3aGljaCBpcyBlcXVhbFxuXHQgKiB0byB0aGlzIFVSSS5cblx0ICpcblx0ICogKiBUaGUgcmVzdWx0IHNoYWxsICpub3QqIGJlIHVzZWQgZm9yIGRpc3BsYXkgcHVycG9zZXMgYnV0IGZvciBleHRlcm5hbGl6YXRpb24gb3IgdHJhbnNwb3J0LlxuXHQgKiAqIFRoZSByZXN1bHQgd2lsbCBiZSBlbmNvZGVkIHVzaW5nIHRoZSBwZXJjZW50YWdlIGVuY29kaW5nIGFuZCBlbmNvZGluZyBoYXBwZW5zIG1vc3RseVxuXHQgKiBpZ25vcmUgdGhlIHNjaGVtZS1zcGVjaWZpYyBlbmNvZGluZyBydWxlcy5cblx0ICpcblx0ICogQHBhcmFtIHNraXBFbmNvZGluZyBEbyBub3QgZW5jb2RlIHRoZSByZXN1bHQsIGRlZmF1bHQgaXMgYGZhbHNlYFxuXHQgKi9cblx0dG9TdHJpbmcoc2tpcEVuY29kaW5nOiBib29sZWFuID0gZmFsc2UpOiBzdHJpbmcge1xuXHRcdHJldHVybiBfYXNGb3JtYXR0ZWQodGhpcywgc2tpcEVuY29kaW5nKTtcblx0fVxuXG5cdHRvSlNPTigpOiBVcmlDb21wb25lbnRzIHtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdC8qKlxuXHQgKiBBIGhlbHBlciBmdW5jdGlvbiB0byByZXZpdmUgVVJJcy5cblx0ICpcblx0ICogKipOb3RlKiogdGhhdCB0aGlzIGZ1bmN0aW9uIHNob3VsZCBvbmx5IGJlIHVzZWQgd2hlbiByZWNlaXZpbmcgVVJJI3RvSlNPTiBnZW5lcmF0ZWQgZGF0YVxuXHQgKiBhbmQgdGhhdCBpdCBkb2Vzbid0IGRvIGFueSB2YWxpZGF0aW9uLiBVc2Uge0BsaW5rIFVSSS5mcm9tfSB3aGVuIHJlY2VpdmVkIFwidW50cnVzdGVkXCJcblx0ICogdXJpIGNvbXBvbmVudHMgc3VjaCBhcyBjb21tYW5kIGFyZ3VtZW50cyBvciBkYXRhIGZyb20gc3RvcmFnZS5cblx0ICpcblx0ICogQHBhcmFtIGRhdGEgVGhlIFVSSSBjb21wb25lbnRzIG9yIFVSSSB0byByZXZpdmUuXG5cdCAqIEByZXR1cm5zIFRoZSByZXZpdmVkIFVSSSBvciB1bmRlZmluZWQgb3IgbnVsbC5cblx0ICovXG5cdHN0YXRpYyByZXZpdmUoZGF0YTogVXJpQ29tcG9uZW50cyB8IFVSSSk6IFVSSTtcblx0c3RhdGljIHJldml2ZShkYXRhOiBVcmlDb21wb25lbnRzIHwgVVJJIHwgdW5kZWZpbmVkKTogVVJJIHwgdW5kZWZpbmVkO1xuXHRzdGF0aWMgcmV2aXZlKGRhdGE6IFVyaUNvbXBvbmVudHMgfCBVUkkgfCBudWxsKTogVVJJIHwgbnVsbDtcblx0c3RhdGljIHJldml2ZShkYXRhOiBVcmlDb21wb25lbnRzIHwgVVJJIHwgdW5kZWZpbmVkIHwgbnVsbCk6IFVSSSB8IHVuZGVmaW5lZCB8IG51bGw7XG5cdHN0YXRpYyByZXZpdmUoZGF0YTogVXJpQ29tcG9uZW50cyB8IFVSSSB8IHVuZGVmaW5lZCB8IG51bGwpOiBVUkkgfCB1bmRlZmluZWQgfCBudWxsIHtcblx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdHJldHVybiBkYXRhO1xuXHRcdH0gZWxzZSBpZiAoZGF0YSBpbnN0YW5jZW9mIFVSSSkge1xuXHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IG5ldyBVcmkoZGF0YSk7XG5cdFx0XHRyZXN1bHQuX2Zvcm1hdHRlZCA9ICg8VXJpU3RhdGU+ZGF0YSkuZXh0ZXJuYWwgPz8gbnVsbDtcblx0XHRcdHJlc3VsdC5fZnNQYXRoID0gKDxVcmlTdGF0ZT5kYXRhKS5fc2VwID09PSBfcGF0aFNlcE1hcmtlciA/ICg8VXJpU3RhdGU+ZGF0YSkuZnNQYXRoID8/IG51bGwgOiBudWxsO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdH1cblxuXHRbU3ltYm9sLmZvcignZGVidWcuZGVzY3JpcHRpb24nKV0oKSB7XG5cdFx0cmV0dXJuIGBVUkkoJHt0aGlzLnRvU3RyaW5nKCl9KWA7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBVcmlDb21wb25lbnRzIHtcblx0c2NoZW1lOiBzdHJpbmc7XG5cdGF1dGhvcml0eT86IHN0cmluZztcblx0cGF0aD86IHN0cmluZztcblx0cXVlcnk/OiBzdHJpbmc7XG5cdGZyYWdtZW50Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNVcmlDb21wb25lbnRzKHRoaW5nOiBhbnkpOiB0aGluZyBpcyBVcmlDb21wb25lbnRzIHtcblx0aWYgKCF0aGluZyB8fCB0eXBlb2YgdGhpbmcgIT09ICdvYmplY3QnKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHJldHVybiB0eXBlb2YgKDxVcmlDb21wb25lbnRzPnRoaW5nKS5zY2hlbWUgPT09ICdzdHJpbmcnXG5cdFx0JiYgKHR5cGVvZiAoPFVyaUNvbXBvbmVudHM+dGhpbmcpLmF1dGhvcml0eSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mICg8VXJpQ29tcG9uZW50cz50aGluZykuYXV0aG9yaXR5ID09PSAndW5kZWZpbmVkJylcblx0XHQmJiAodHlwZW9mICg8VXJpQ29tcG9uZW50cz50aGluZykucGF0aCA9PT0gJ3N0cmluZycgfHwgdHlwZW9mICg8VXJpQ29tcG9uZW50cz50aGluZykucGF0aCA9PT0gJ3VuZGVmaW5lZCcpXG5cdFx0JiYgKHR5cGVvZiAoPFVyaUNvbXBvbmVudHM+dGhpbmcpLnF1ZXJ5ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgKDxVcmlDb21wb25lbnRzPnRoaW5nKS5xdWVyeSA9PT0gJ3VuZGVmaW5lZCcpXG5cdFx0JiYgKHR5cGVvZiAoPFVyaUNvbXBvbmVudHM+dGhpbmcpLmZyYWdtZW50ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgKDxVcmlDb21wb25lbnRzPnRoaW5nKS5mcmFnbWVudCA9PT0gJ3VuZGVmaW5lZCcpO1xufVxuXG5pbnRlcmZhY2UgVXJpU3RhdGUgZXh0ZW5kcyBVcmlDb21wb25lbnRzIHtcblx0JG1pZDogTWFyc2hhbGxlZElkLlVyaTtcblx0ZXh0ZXJuYWw/OiBzdHJpbmc7XG5cdGZzUGF0aD86IHN0cmluZztcblx0X3NlcD86IDE7XG59XG5cbmNvbnN0IF9wYXRoU2VwTWFya2VyID0gaXNXaW5kb3dzID8gMSA6IHVuZGVmaW5lZDtcblxuLy8gVGhpcyBjbGFzcyBleGlzdHMgc28gdGhhdCBVUkkgaXMgY29tcGF0aWJsZSB3aXRoIHZzY29kZS5VcmkgKEFQSSkuXG5jbGFzcyBVcmkgZXh0ZW5kcyBVUkkge1xuXG5cdF9mb3JtYXR0ZWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRfZnNQYXRoOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuXHRvdmVycmlkZSBnZXQgZnNQYXRoKCk6IHN0cmluZyB7XG5cdFx0aWYgKCF0aGlzLl9mc1BhdGgpIHtcblx0XHRcdHRoaXMuX2ZzUGF0aCA9IHVyaVRvRnNQYXRoKHRoaXMsIGZhbHNlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2ZzUGF0aDtcblx0fVxuXG5cdG92ZXJyaWRlIHRvU3RyaW5nKHNraXBFbmNvZGluZzogYm9vbGVhbiA9IGZhbHNlKTogc3RyaW5nIHtcblx0XHRpZiAoIXNraXBFbmNvZGluZykge1xuXHRcdFx0aWYgKCF0aGlzLl9mb3JtYXR0ZWQpIHtcblx0XHRcdFx0dGhpcy5fZm9ybWF0dGVkID0gX2FzRm9ybWF0dGVkKHRoaXMsIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzLl9mb3JtYXR0ZWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIHdlIGRvbid0IGNhY2hlIHRoYXRcblx0XHRcdHJldHVybiBfYXNGb3JtYXR0ZWQodGhpcywgdHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgdG9KU09OKCk6IFVyaUNvbXBvbmVudHMge1xuXHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBsb2NhbC9jb2RlLW5vLWRhbmdlcm91cy10eXBlLWFzc2VydGlvbnNcblx0XHRjb25zdCByZXMgPSA8VXJpU3RhdGU+e1xuXHRcdFx0JG1pZDogTWFyc2hhbGxlZElkLlVyaVxuXHRcdH07XG5cdFx0Ly8gY2FjaGVkIHN0YXRlXG5cdFx0aWYgKHRoaXMuX2ZzUGF0aCkge1xuXHRcdFx0cmVzLmZzUGF0aCA9IHRoaXMuX2ZzUGF0aDtcblx0XHRcdHJlcy5fc2VwID0gX3BhdGhTZXBNYXJrZXI7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9mb3JtYXR0ZWQpIHtcblx0XHRcdHJlcy5leHRlcm5hbCA9IHRoaXMuX2Zvcm1hdHRlZDtcblx0XHR9XG5cdFx0Ly8tLS0gdXJpIGNvbXBvbmVudHNcblx0XHRpZiAodGhpcy5wYXRoKSB7XG5cdFx0XHRyZXMucGF0aCA9IHRoaXMucGF0aDtcblx0XHR9XG5cdFx0Ly8gVE9ET1xuXHRcdC8vIHRoaXMgaXNuJ3QgY29ycmVjdCBhbmQgY2FuIHZpb2xhdGUgdGhlIFVyaUNvbXBvbmVudHMgY29udHJhY3QgYnV0XG5cdFx0Ly8gdGhpcyBpcyBwYXJ0IG9mIHRoZSB2c2NvZGUuVXJpIEFQSSBhbmQgd2Ugc2hvdWxkbid0IGNoYW5nZSBob3cgdGhhdFxuXHRcdC8vIHdvcmtzIGFueW1vcmVcblx0XHRpZiAodGhpcy5zY2hlbWUpIHtcblx0XHRcdHJlcy5zY2hlbWUgPSB0aGlzLnNjaGVtZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuYXV0aG9yaXR5KSB7XG5cdFx0XHRyZXMuYXV0aG9yaXR5ID0gdGhpcy5hdXRob3JpdHk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLnF1ZXJ5KSB7XG5cdFx0XHRyZXMucXVlcnkgPSB0aGlzLnF1ZXJ5O1xuXHRcdH1cblx0XHRpZiAodGhpcy5mcmFnbWVudCkge1xuXHRcdFx0cmVzLmZyYWdtZW50ID0gdGhpcy5mcmFnbWVudDtcblx0XHR9XG5cdFx0cmV0dXJuIHJlcztcblx0fVxufVxuXG4vLyByZXNlcnZlZCBjaGFyYWN0ZXJzOiBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzk4NiNzZWN0aW9uLTIuMlxuY29uc3QgZW5jb2RlVGFibGU6IHsgW2NoOiBudW1iZXJdOiBzdHJpbmcgfSA9IHtcblx0W0NoYXJDb2RlLkNvbG9uXTogJyUzQScsIC8vIGdlbi1kZWxpbXNcblx0W0NoYXJDb2RlLlNsYXNoXTogJyUyRicsXG5cdFtDaGFyQ29kZS5RdWVzdGlvbk1hcmtdOiAnJTNGJyxcblx0W0NoYXJDb2RlLkhhc2hdOiAnJTIzJyxcblx0W0NoYXJDb2RlLk9wZW5TcXVhcmVCcmFja2V0XTogJyU1QicsXG5cdFtDaGFyQ29kZS5DbG9zZVNxdWFyZUJyYWNrZXRdOiAnJTVEJyxcblx0W0NoYXJDb2RlLkF0U2lnbl06ICclNDAnLFxuXG5cdFtDaGFyQ29kZS5FeGNsYW1hdGlvbk1hcmtdOiAnJTIxJywgLy8gc3ViLWRlbGltc1xuXHRbQ2hhckNvZGUuRG9sbGFyU2lnbl06ICclMjQnLFxuXHRbQ2hhckNvZGUuQW1wZXJzYW5kXTogJyUyNicsXG5cdFtDaGFyQ29kZS5TaW5nbGVRdW90ZV06ICclMjcnLFxuXHRbQ2hhckNvZGUuT3BlblBhcmVuXTogJyUyOCcsXG5cdFtDaGFyQ29kZS5DbG9zZVBhcmVuXTogJyUyOScsXG5cdFtDaGFyQ29kZS5Bc3Rlcmlza106ICclMkEnLFxuXHRbQ2hhckNvZGUuUGx1c106ICclMkInLFxuXHRbQ2hhckNvZGUuQ29tbWFdOiAnJTJDJyxcblx0W0NoYXJDb2RlLlNlbWljb2xvbl06ICclM0InLFxuXHRbQ2hhckNvZGUuRXF1YWxzXTogJyUzRCcsXG5cblx0W0NoYXJDb2RlLlNwYWNlXTogJyUyMCcsXG59O1xuXG5mdW5jdGlvbiBlbmNvZGVVUklDb21wb25lbnRGYXN0KHVyaUNvbXBvbmVudDogc3RyaW5nLCBpc1BhdGg6IGJvb2xlYW4sIGlzQXV0aG9yaXR5OiBib29sZWFuKTogc3RyaW5nIHtcblx0bGV0IHJlczogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRsZXQgbmF0aXZlRW5jb2RlUG9zID0gLTE7XG5cblx0Zm9yIChsZXQgcG9zID0gMDsgcG9zIDwgdXJpQ29tcG9uZW50Lmxlbmd0aDsgcG9zKyspIHtcblx0XHRjb25zdCBjb2RlID0gdXJpQ29tcG9uZW50LmNoYXJDb2RlQXQocG9zKTtcblxuXHRcdC8vIHVucmVzZXJ2ZWQgY2hhcmFjdGVyczogaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM5ODYjc2VjdGlvbi0yLjNcblx0XHRpZiAoXG5cdFx0XHQoY29kZSA+PSBDaGFyQ29kZS5hICYmIGNvZGUgPD0gQ2hhckNvZGUueilcblx0XHRcdHx8IChjb2RlID49IENoYXJDb2RlLkEgJiYgY29kZSA8PSBDaGFyQ29kZS5aKVxuXHRcdFx0fHwgKGNvZGUgPj0gQ2hhckNvZGUuRGlnaXQwICYmIGNvZGUgPD0gQ2hhckNvZGUuRGlnaXQ5KVxuXHRcdFx0fHwgY29kZSA9PT0gQ2hhckNvZGUuRGFzaFxuXHRcdFx0fHwgY29kZSA9PT0gQ2hhckNvZGUuUGVyaW9kXG5cdFx0XHR8fCBjb2RlID09PSBDaGFyQ29kZS5VbmRlcmxpbmVcblx0XHRcdHx8IGNvZGUgPT09IENoYXJDb2RlLlRpbGRlXG5cdFx0XHR8fCAoaXNQYXRoICYmIGNvZGUgPT09IENoYXJDb2RlLlNsYXNoKVxuXHRcdFx0fHwgKGlzQXV0aG9yaXR5ICYmIGNvZGUgPT09IENoYXJDb2RlLk9wZW5TcXVhcmVCcmFja2V0KVxuXHRcdFx0fHwgKGlzQXV0aG9yaXR5ICYmIGNvZGUgPT09IENoYXJDb2RlLkNsb3NlU3F1YXJlQnJhY2tldClcblx0XHRcdHx8IChpc0F1dGhvcml0eSAmJiBjb2RlID09PSBDaGFyQ29kZS5Db2xvbilcblx0XHQpIHtcblx0XHRcdC8vIGNoZWNrIGlmIHdlIGFyZSBkZWxheWluZyBuYXRpdmUgZW5jb2RlXG5cdFx0XHRpZiAobmF0aXZlRW5jb2RlUG9zICE9PSAtMSkge1xuXHRcdFx0XHRyZXMgKz0gZW5jb2RlVVJJQ29tcG9uZW50KHVyaUNvbXBvbmVudC5zdWJzdHJpbmcobmF0aXZlRW5jb2RlUG9zLCBwb3MpKTtcblx0XHRcdFx0bmF0aXZlRW5jb2RlUG9zID0gLTE7XG5cdFx0XHR9XG5cdFx0XHQvLyBjaGVjayBpZiB3ZSB3cml0ZSBpbnRvIGEgbmV3IHN0cmluZyAoYnkgZGVmYXVsdCB3ZSB0cnkgdG8gcmV0dXJuIHRoZSBwYXJhbSlcblx0XHRcdGlmIChyZXMgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRyZXMgKz0gdXJpQ29tcG9uZW50LmNoYXJBdChwb3MpO1xuXHRcdFx0fVxuXG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGVuY29kaW5nIG5lZWRlZCwgd2UgbmVlZCB0byBhbGxvY2F0ZSBhIG5ldyBzdHJpbmdcblx0XHRcdGlmIChyZXMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRyZXMgPSB1cmlDb21wb25lbnQuc3Vic3RyKDAsIHBvcyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIGNoZWNrIHdpdGggZGVmYXVsdCB0YWJsZSBmaXJzdFxuXHRcdFx0Y29uc3QgZXNjYXBlZCA9IGVuY29kZVRhYmxlW2NvZGVdO1xuXHRcdFx0aWYgKGVzY2FwZWQgIT09IHVuZGVmaW5lZCkge1xuXG5cdFx0XHRcdC8vIGNoZWNrIGlmIHdlIGFyZSBkZWxheWluZyBuYXRpdmUgZW5jb2RlXG5cdFx0XHRcdGlmIChuYXRpdmVFbmNvZGVQb3MgIT09IC0xKSB7XG5cdFx0XHRcdFx0cmVzICs9IGVuY29kZVVSSUNvbXBvbmVudCh1cmlDb21wb25lbnQuc3Vic3RyaW5nKG5hdGl2ZUVuY29kZVBvcywgcG9zKSk7XG5cdFx0XHRcdFx0bmF0aXZlRW5jb2RlUG9zID0gLTE7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBhcHBlbmQgZXNjYXBlZCB2YXJpYW50IHRvIHJlc3VsdFxuXHRcdFx0XHRyZXMgKz0gZXNjYXBlZDtcblxuXHRcdFx0fSBlbHNlIGlmIChuYXRpdmVFbmNvZGVQb3MgPT09IC0xKSB7XG5cdFx0XHRcdC8vIHVzZSBuYXRpdmUgZW5jb2RlIG9ubHkgd2hlbiBuZWVkZWRcblx0XHRcdFx0bmF0aXZlRW5jb2RlUG9zID0gcG9zO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlmIChuYXRpdmVFbmNvZGVQb3MgIT09IC0xKSB7XG5cdFx0cmVzICs9IGVuY29kZVVSSUNvbXBvbmVudCh1cmlDb21wb25lbnQuc3Vic3RyaW5nKG5hdGl2ZUVuY29kZVBvcykpO1xuXHR9XG5cblx0cmV0dXJuIHJlcyAhPT0gdW5kZWZpbmVkID8gcmVzIDogdXJpQ29tcG9uZW50O1xufVxuXG5mdW5jdGlvbiBlbmNvZGVVUklDb21wb25lbnRNaW5pbWFsKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG5cdGxldCByZXM6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0Zm9yIChsZXQgcG9zID0gMDsgcG9zIDwgcGF0aC5sZW5ndGg7IHBvcysrKSB7XG5cdFx0Y29uc3QgY29kZSA9IHBhdGguY2hhckNvZGVBdChwb3MpO1xuXHRcdGlmIChjb2RlID09PSBDaGFyQ29kZS5IYXNoIHx8IGNvZGUgPT09IENoYXJDb2RlLlF1ZXN0aW9uTWFyaykge1xuXHRcdFx0aWYgKHJlcyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJlcyA9IHBhdGguc3Vic3RyKDAsIHBvcyk7XG5cdFx0XHR9XG5cdFx0XHRyZXMgKz0gZW5jb2RlVGFibGVbY29kZV07XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChyZXMgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRyZXMgKz0gcGF0aFtwb3NdO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRyZXR1cm4gcmVzICE9PSB1bmRlZmluZWQgPyByZXMgOiBwYXRoO1xufVxuXG4vKipcbiAqIENvbXB1dGUgYGZzUGF0aGAgZm9yIHRoZSBnaXZlbiB1cmlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVyaVRvRnNQYXRoKHVyaTogVVJJLCBrZWVwRHJpdmVMZXR0ZXJDYXNpbmc6IGJvb2xlYW4pOiBzdHJpbmcge1xuXG5cdGxldCB2YWx1ZTogc3RyaW5nO1xuXHRpZiAodXJpLmF1dGhvcml0eSAmJiB1cmkucGF0aC5sZW5ndGggPiAxICYmIHVyaS5zY2hlbWUgPT09ICdmaWxlJykge1xuXHRcdC8vIHVuYyBwYXRoOiBmaWxlOi8vc2hhcmVzL2MkL2Zhci9ib29cblx0XHR2YWx1ZSA9IGAvLyR7dXJpLmF1dGhvcml0eX0ke3VyaS5wYXRofWA7XG5cdH0gZWxzZSBpZiAoXG5cdFx0dXJpLnBhdGguY2hhckNvZGVBdCgwKSA9PT0gQ2hhckNvZGUuU2xhc2hcblx0XHQmJiAodXJpLnBhdGguY2hhckNvZGVBdCgxKSA+PSBDaGFyQ29kZS5BICYmIHVyaS5wYXRoLmNoYXJDb2RlQXQoMSkgPD0gQ2hhckNvZGUuWiB8fCB1cmkucGF0aC5jaGFyQ29kZUF0KDEpID49IENoYXJDb2RlLmEgJiYgdXJpLnBhdGguY2hhckNvZGVBdCgxKSA8PSBDaGFyQ29kZS56KVxuXHRcdCYmIHVyaS5wYXRoLmNoYXJDb2RlQXQoMikgPT09IENoYXJDb2RlLkNvbG9uXG5cdCkge1xuXHRcdGlmICgha2VlcERyaXZlTGV0dGVyQ2FzaW5nKSB7XG5cdFx0XHQvLyB3aW5kb3dzIGRyaXZlIGxldHRlcjogZmlsZTovLy9jOi9mYXIvYm9vXG5cdFx0XHR2YWx1ZSA9IHVyaS5wYXRoWzFdLnRvTG93ZXJDYXNlKCkgKyB1cmkucGF0aC5zdWJzdHIoMik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhbHVlID0gdXJpLnBhdGguc3Vic3RyKDEpO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHQvLyBvdGhlciBwYXRoXG5cdFx0dmFsdWUgPSB1cmkucGF0aDtcblx0fVxuXHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0dmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC9cXC8vZywgJ1xcXFwnKTtcblx0fVxuXHRyZXR1cm4gdmFsdWU7XG59XG5cbi8qKlxuICogQ3JlYXRlIHRoZSBleHRlcm5hbCB2ZXJzaW9uIG9mIGEgdXJpXG4gKi9cbmZ1bmN0aW9uIF9hc0Zvcm1hdHRlZCh1cmk6IFVSSSwgc2tpcEVuY29kaW5nOiBib29sZWFuKTogc3RyaW5nIHtcblxuXHRjb25zdCBlbmNvZGVyID0gIXNraXBFbmNvZGluZ1xuXHRcdD8gZW5jb2RlVVJJQ29tcG9uZW50RmFzdFxuXHRcdDogZW5jb2RlVVJJQ29tcG9uZW50TWluaW1hbDtcblxuXHRsZXQgcmVzID0gJyc7XG5cdGxldCB7IHNjaGVtZSwgYXV0aG9yaXR5LCBwYXRoLCBxdWVyeSwgZnJhZ21lbnQgfSA9IHVyaTtcblx0aWYgKHNjaGVtZSkge1xuXHRcdHJlcyArPSBzY2hlbWU7XG5cdFx0cmVzICs9ICc6Jztcblx0fVxuXHRpZiAoYXV0aG9yaXR5IHx8IHNjaGVtZSA9PT0gJ2ZpbGUnKSB7XG5cdFx0cmVzICs9IF9zbGFzaDtcblx0XHRyZXMgKz0gX3NsYXNoO1xuXHR9XG5cdGlmIChhdXRob3JpdHkpIHtcblx0XHRsZXQgaWR4ID0gYXV0aG9yaXR5LmluZGV4T2YoJ0AnKTtcblx0XHRpZiAoaWR4ICE9PSAtMSkge1xuXHRcdFx0Ly8gPHVzZXI+QDxhdXRoPlxuXHRcdFx0Y29uc3QgdXNlcmluZm8gPSBhdXRob3JpdHkuc3Vic3RyKDAsIGlkeCk7XG5cdFx0XHRhdXRob3JpdHkgPSBhdXRob3JpdHkuc3Vic3RyKGlkeCArIDEpO1xuXHRcdFx0aWR4ID0gdXNlcmluZm8ubGFzdEluZGV4T2YoJzonKTtcblx0XHRcdGlmIChpZHggPT09IC0xKSB7XG5cdFx0XHRcdHJlcyArPSBlbmNvZGVyKHVzZXJpbmZvLCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gPHVzZXI+OjxwYXNzPkA8YXV0aD5cblx0XHRcdFx0cmVzICs9IGVuY29kZXIodXNlcmluZm8uc3Vic3RyKDAsIGlkeCksIGZhbHNlLCBmYWxzZSk7XG5cdFx0XHRcdHJlcyArPSAnOic7XG5cdFx0XHRcdHJlcyArPSBlbmNvZGVyKHVzZXJpbmZvLnN1YnN0cihpZHggKyAxKSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0fVxuXHRcdFx0cmVzICs9ICdAJztcblx0XHR9XG5cdFx0YXV0aG9yaXR5ID0gYXV0aG9yaXR5LnRvTG93ZXJDYXNlKCk7XG5cdFx0aWR4ID0gYXV0aG9yaXR5Lmxhc3RJbmRleE9mKCc6Jyk7XG5cdFx0aWYgKGlkeCA9PT0gLTEpIHtcblx0XHRcdHJlcyArPSBlbmNvZGVyKGF1dGhvcml0eSwgZmFsc2UsIHRydWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyA8YXV0aD46PHBvcnQ+XG5cdFx0XHRyZXMgKz0gZW5jb2RlcihhdXRob3JpdHkuc3Vic3RyKDAsIGlkeCksIGZhbHNlLCB0cnVlKTtcblx0XHRcdHJlcyArPSBhdXRob3JpdHkuc3Vic3RyKGlkeCk7XG5cdFx0fVxuXHR9XG5cdGlmIChwYXRoKSB7XG5cdFx0Ly8gbG93ZXItY2FzZSB3aW5kb3dzIGRyaXZlIGxldHRlcnMgaW4gL0M6L2ZmZiBvciBDOi9mZmZcblx0XHRpZiAocGF0aC5sZW5ndGggPj0gMyAmJiBwYXRoLmNoYXJDb2RlQXQoMCkgPT09IENoYXJDb2RlLlNsYXNoICYmIHBhdGguY2hhckNvZGVBdCgyKSA9PT0gQ2hhckNvZGUuQ29sb24pIHtcblx0XHRcdGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoMSk7XG5cdFx0XHRpZiAoY29kZSA+PSBDaGFyQ29kZS5BICYmIGNvZGUgPD0gQ2hhckNvZGUuWikge1xuXHRcdFx0XHRwYXRoID0gYC8ke1N0cmluZy5mcm9tQ2hhckNvZGUoY29kZSArIDMyKX06JHtwYXRoLnN1YnN0cigzKX1gOyAvLyBcIi9jOlwiLmxlbmd0aCA9PT0gM1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAocGF0aC5sZW5ndGggPj0gMiAmJiBwYXRoLmNoYXJDb2RlQXQoMSkgPT09IENoYXJDb2RlLkNvbG9uKSB7XG5cdFx0XHRjb25zdCBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KDApO1xuXHRcdFx0aWYgKGNvZGUgPj0gQ2hhckNvZGUuQSAmJiBjb2RlIDw9IENoYXJDb2RlLlopIHtcblx0XHRcdFx0cGF0aCA9IGAke1N0cmluZy5mcm9tQ2hhckNvZGUoY29kZSArIDMyKX06JHtwYXRoLnN1YnN0cigyKX1gOyAvLyBcIi9jOlwiLmxlbmd0aCA9PT0gM1xuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBlbmNvZGUgdGhlIHJlc3Qgb2YgdGhlIHBhdGhcblx0XHRyZXMgKz0gZW5jb2RlcihwYXRoLCB0cnVlLCBmYWxzZSk7XG5cdH1cblx0aWYgKHF1ZXJ5KSB7XG5cdFx0cmVzICs9ICc/Jztcblx0XHRyZXMgKz0gZW5jb2RlcihxdWVyeSwgZmFsc2UsIGZhbHNlKTtcblx0fVxuXHRpZiAoZnJhZ21lbnQpIHtcblx0XHRyZXMgKz0gJyMnO1xuXHRcdHJlcyArPSAhc2tpcEVuY29kaW5nID8gZW5jb2RlVVJJQ29tcG9uZW50RmFzdChmcmFnbWVudCwgZmFsc2UsIGZhbHNlKSA6IGZyYWdtZW50O1xuXHR9XG5cdHJldHVybiByZXM7XG59XG5cbi8vIC0tLSBkZWNvZGVcblxuZnVuY3Rpb24gZGVjb2RlVVJJQ29tcG9uZW50R3JhY2VmdWwoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuXHR0cnkge1xuXHRcdHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoc3RyKTtcblx0fSBjYXRjaCB7XG5cdFx0aWYgKHN0ci5sZW5ndGggPiAzKSB7XG5cdFx0XHRyZXR1cm4gc3RyLnN1YnN0cigwLCAzKSArIGRlY29kZVVSSUNvbXBvbmVudEdyYWNlZnVsKHN0ci5zdWJzdHIoMykpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gc3RyO1xuXHRcdH1cblx0fVxufVxuXG5jb25zdCBfckVuY29kZWRBc0hleCA9IC8oJVswLTlBLVphLXpdWzAtOUEtWmEtel0pKy9nO1xuXG5mdW5jdGlvbiBwZXJjZW50RGVjb2RlKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcblx0aWYgKCFzdHIubWF0Y2goX3JFbmNvZGVkQXNIZXgpKSB7XG5cdFx0cmV0dXJuIHN0cjtcblx0fVxuXHRyZXR1cm4gc3RyLnJlcGxhY2UoX3JFbmNvZGVkQXNIZXgsIChtYXRjaCkgPT4gZGVjb2RlVVJJQ29tcG9uZW50R3JhY2VmdWwobWF0Y2gpKTtcbn1cblxuLyoqXG4gKiBNYXBwZWQtdHlwZSB0aGF0IHJlcGxhY2VzIGFsbCBvY2N1cnJlbmNlcyBvZiBVUkkgd2l0aCBVcmlDb21wb25lbnRzXG4gKi9cbmV4cG9ydCB0eXBlIFVyaUR0bzxUPiA9IHsgW0sgaW4ga2V5b2YgVF06IFRbS10gZXh0ZW5kcyBVUklcblx0PyBVcmlDb21wb25lbnRzXG5cdDogVXJpRHRvPFRbS10+IH07XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLG9CQUFvQjtBQUM3QixZQUFZLFdBQVc7QUFDdkIsU0FBUyxpQkFBaUI7QUFFMUIsTUFBTSxpQkFBaUI7QUFDdkIsTUFBTSxvQkFBb0I7QUFDMUIsTUFBTSxvQkFBb0I7QUFFMUIsU0FBUyxhQUFhLEtBQVUsU0FBeUI7QUFHeEQsTUFBSSxDQUFDLElBQUksVUFBVSxTQUFTO0FBQzNCLFVBQU0sSUFBSSxNQUFNLDJEQUEyRCxJQUFJLFNBQVMsYUFBYSxJQUFJLElBQUksY0FBYyxJQUFJLEtBQUssaUJBQWlCLElBQUksUUFBUSxJQUFJO0FBQUEsRUFDdEs7QUFJQSxNQUFJLElBQUksVUFBVSxDQUFDLGVBQWUsS0FBSyxJQUFJLE1BQU0sR0FBRztBQUNuRCxVQUFNLElBQUksTUFBTSxpREFBaUQ7QUFBQSxFQUNsRTtBQU9BLE1BQUksSUFBSSxNQUFNO0FBQ2IsUUFBSSxJQUFJLFdBQVc7QUFDbEIsVUFBSSxDQUFDLGtCQUFrQixLQUFLLElBQUksSUFBSSxHQUFHO0FBQ3RDLGNBQU0sSUFBSSxN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
