import * as process from "./process.js";
const CHAR_UPPERCASE_A = 65;
const CHAR_LOWERCASE_A = 97;
const CHAR_UPPERCASE_Z = 90;
const CHAR_LOWERCASE_Z = 122;
const CHAR_DOT = 46;
const CHAR_FORWARD_SLASH = 47;
const CHAR_BACKWARD_SLASH = 92;
const CHAR_COLON = 58;
const CHAR_QUESTION_MARK = 63;
class ErrorInvalidArgType extends Error {
  constructor(name, expected, actual) {
    let determiner;
    if (typeof expected === "string" && expected.indexOf("not ") === 0) {
      determiner = "must not be";
      expected = expected.replace(/^not /, "");
    } else {
      determiner = "must be";
    }
    const type = name.indexOf(".") !== -1 ? "property" : "argument";
    let msg = `The "${name}" ${type} ${determiner} of type ${expected}`;
    msg += `. Received type ${typeof actual}`;
    super(msg);
    this.code = "ERR_INVALID_ARG_TYPE";
  }
}
function validateObject(pathObject, name) {
  if (pathObject === null || typeof pathObject !== "object") {
    throw new ErrorInvalidArgType(name, "Object", pathObject);
  }
}
function validateString(value, name) {
  if (typeof value !== "string") {
    throw new ErrorInvalidArgType(name, "string", value);
  }
}
const platformIsWin32 = process.platform === "win32";
function isPathSeparator(code) {
  return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
}
function isPosixPathSeparator(code) {
  return code === CHAR_FORWARD_SLASH;
}
function isWindowsDeviceRoot(code) {
  return code >= CHAR_UPPERCASE_A && code <= CHAR_UPPERCASE_Z || code >= CHAR_LOWERCASE_A && code <= CHAR_LOWERCASE_Z;
}
function normalizeString(path, allowAboveRoot, separator, isPathSeparator2) {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let code = 0;
  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length) {
      code = path.charCodeAt(i);
    } else if (isPathSeparator2(code)) {
      break;
    } else {
      code = CHAR_FORWARD_SLASH;
    }
    if (isPathSeparator2(code)) {
      if (lastSlash === i - 1 || dots === 1) {
      } else if (dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== CHAR_DOT || res.charCodeAt(res.length - 2) !== CHAR_DOT) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf(separator);
            if (lastSlashIndex === -1) {
              res = "";
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.lastIndexOf(separator);
            }
            lastSlash = i;
            dots = 0;
            continue;
          } else if (res.length !== 0) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          res += res.length > 0 ? `${separator}..` : "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0) {
          res += `${separator}${path.slice(lastSlash + 1, i)}`;
        } else {
          res = path.slice(lastSlash + 1, i);
        }
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === CHAR_DOT && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}
function formatExt(ext) {
  return ext ? `${ext[0] === "." ? "" : "."}${ext}` : "";
}
function _format(sep2, pathObject) {
  validateObject(pathObject, "pathObject");
  const dir = pathObject.dir || pathObject.root;
  const base = pathObject.base || `${pathObject.name || ""}${formatExt(pathObject.ext)}`;
  if (!dir) {
    return base;
  }
  return dir === pathObject.root ? `${dir}${base}` : `${dir}${sep2}${base}`;
}
const win32 = {
  // path.resolve([from ...], to)
  resolve(...pathSegments) {
    let resolvedDevice = "";
    let resolvedTail = "";
    let resolvedAbsolute = false;
    for (let i = pathSegments.length - 1; i >= -1; i--) {
      let path;
      if (i >= 0) {
        path = pathSegments[i];
        validateString(path, `paths[${i}]`);
        if (path.length === 0) {
          continue;
        }
      } else if (resolvedDevice.length === 0) {
        path = process.cwd();
      } else {
        path = process.env[`=${resolvedDevice}`] || process.cwd();
        if (path === void 0 || path.slice(0, 2).toLowerCase() !== resolvedDevice.toLowerCase() && path.charCodeAt(2) === CHAR_BACKWARD_SLASH) {
          path = `${resolvedDevice}\\`;
        }
      }
      const len = path.length;
      let rootEnd = 0;
      let device = "";
      let isAbsolute2 = false;
      const code = path.charCodeAt(0);
      if (len === 1) {
        if (isPathSeparator(code)) {
          rootEnd = 1;
          isAbsolute2 = true;
        }
      } else if (isPathSeparator(code)) {
        isAbsolute2 = true;
        if (isPathSeparator(path.charCodeAt(1))) {
          let j = 2;
          let last = j;
          while (j < len && !isPathSeparator(path.charCodeAt(j))) {
            j++;
          }
          if (j < len && j !== last) {
            const firstPart = path.slice(last, j);
            last = j;
            while (j < len && isPathSeparator(path.charCodeAt(j))) {
              j++;
            }
            if (j < len && j !== last) {
              last = j;
              while (j < len && !isPathSeparator(path.charCodeAt(j))) {
                j++;
              }
              if (j === len || j !== last) {
                device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                rootEnd = j;
              }
            }
          }
        } else {
          rootEnd = 1;
        }
      } else if (isWindowsDeviceRoot(code) && path.charCodeAt(1) === CHAR_COLON) {
        device = path.slice(0, 2);
        rootEnd = 2;
        if (len > 2 && isPathSeparator(path.charCodeAt(2))) {
          isAbsolute2 = true;
          rootEnd = 3;
        }
      }
      if (device.length > 0) {
        if (resolvedDevice.length > 0) {
          if (device.toLowerCase() !== resolvedDevice.toLowerCase()) {
            continue;
          }
        } else {
          resolvedDevice = device;
        }
      }
      if (resolvedAbsolute) {
        if (resolvedDevice.length > 0) {
          break;
        }
      } else {
        resolvedTail = `${path.slice(rootEnd)}\\${resolvedTail}`;
        resolvedAbsolute = isAbsolute2;
        if (isAbsolute2 && resolvedDevice.length > 0) {
          break;
        }
      }
    }
    resolvedTail = normalizeString(
      resolvedTail,
      !resolvedAbsolute,
      "\\",
      isPathSeparator
    );
    return resolvedAbsolute ? `${resolvedDevice}\\${resolvedTail}` : `${resolvedDevice}${resolvedTail}` || ".";
  },
  normalize(path) {
    validateString(path, "path");
    const len = path.length;
    if (len === 0) {
      return ".";
    }
    let rootEnd = 0;
    let device;
    let isAbsolute2 = false;
    const code = path.charCodeAt(0);
    if (len === 1) {
      return isPosixPathSeparator(code) ? "\\" : path;
    }
    if (isPathSeparator(code)) {
      isAbsolute2 = true;
      if (isPathSeparator(path.charCodeAt(1))) {
        let j = 2;
        let last = j;
        while (j < len && !isPathSeparator(path.charCodeAt(j))) {
          j++;
        }
        if (j < len && j !== last) {
          const firstPart = path.slice(last, j);
          last = j;
          while (j < len && isPathSeparator(path.charCodeAt(j))) {
            j++;
          }
          if (j < len && j !== last) {
            last = j;
            while (j < len && !isPathSeparator(path.charCodeAt(j))) {
              j++;
            }
            if (j === len) {
              return `\\\\${firstPart}\\${path.slice(last)}\\`;
            }
            if (j !== last) {
              device = `\\\\${firstPart}\\${path.slice(last, j)}`;
              rootEnd = j;
            }
          }
        }
      } else {
        rootEnd = 1;
      }
    } else if (isWindowsDeviceRoot(code) && path.charCodeAt(1) === CHAR_COLON) {
      device = path.slice(0, 2);
      rootEnd = 2;
      if (len > 2 && isPathSeparator(path.charCodeAt(2))) {
        isAbsolute2 = true;
        rootEnd = 3;
      }
    }
    let tail = rootEnd < len ? normalizeString(path.slice(rootEnd), !isAbsolute2, "\\", isPathSeparator) : "";
    if (tail.length === 0 && !isAbsolute2) {
      tail = ".";
    }
    if (tail.length > 0 && isPathSeparator(path.charCodeAt(len - 1))) {
      tail += "\\";
    }
    if (!isAbsolute2 && device === void 0 && path.includes(":")) {
      if (tail.length >= 2 && isWindowsDeviceRoot(tail.charCodeAt(0)) && tail.charCodeAt(1) === CHAR_COLON) {
        return `.\\${tail}`;
      }
      let index = path.indexOf(":");
      do {
        if (index === len - 1 || isPathSeparator(path.charCodeAt(index + 1))) {
          return `.\\${tail}`;
        }
      } while ((index = path.indexOf(":", index + 1)) !== -1);
    }
    if (device === void 0) {
      return isAbsolute2 ? `\\${tail}` : tail;
    }
    return isAbsolute2 ? `${device}\\${tail}` : `${device}${tail}`;
  },
  isAbsolute(path) {
    validateString(path, "path");
    const len = path.length;
    if (len === 0) {
      return false;
    }
    const code = path.charCodeAt(0);
    return isPathSeparator(code) || // Possible device root
    len > 2 && isWindowsDeviceRoot(code) && path.charCodeAt(1) === CHAR_COLON && isPathSeparator(path.charCodeAt(2));
  },
  join(...paths) {
    if (paths.length === 0) {
      return ".";
    }
    let joined;
    let firstPart;
    for (let i = 0; i < paths.length; ++i) {
      const arg = paths[i];
      validateString(arg, "path");
      if (arg.length > 0) {
        if (joined === void 0) {
          joined = firstPart = arg;
        } else {
          joined += `\\${arg}`;
        }
      }
    }
    if (joined === void 0) {
      return ".";
    }
    let needsReplace = true;
    let slashCount = 0;
    if (typeof firstPart === "string" && isPathSeparator(firstPart.charCodeAt(0))) {
      ++slashCount;
      const firstLen = firstPart.length;
      if (firstLen > 1 && isPathSeparator(firstPart.charCodeAt(1))) {
        ++slashCount;
        if (firstLen > 2) {
          if (isPathSeparator(firstPart.charCodeAt(2))) {
            ++slashCount;
          } else {
            needsReplace = false;
          }
        }
      }
    }
    if (needsReplace) {
      while (slashCount < joined.length && isPathSeparator(joined.charCodeAt(slashCount))) {
        slashCount++;
      }
      if (slashCount >= 2) {
        joined = `\\${joined.slice(slashCount)}`;
      }
    }
    return win32.normalize(joined);
  },
  // It will solve the relative path from `from` to `to`, for instance:
  //  from = 'C:\\orandea\\test\\aaa'
  //  to = 'C:\\orandea\\impl\\bbb'
  // The output of the function should be: '..\\..\\impl\\bbb'
  relative(from, to) {
    validateString(from, "from");
    validateString(to, "to");
    if (from === to) {
      return "";
    }
    const fromOrig = win32.resolve(from);
    const toOrig = win32.resolve(to);
    if (fromOrig === toOrig) {
      return "";
    }
    from = fromOrig.toLowerCase();
    to = toOrig.toLowerCase();
    if (from === to) {
      return "";
    }
    if (fromOrig.length !== from.length || toOrig.length !== to.length) {
      const fromSplit = fromOrig.split("\\");
      const toSplit = toOrig.split("\\");
      if (fromSplit[fromSplit.length - 1] === "") {
        fromSplit.pop();
      }
      if (toSplit[toSplit.length - 1] === "") {
        toSplit.pop();
      }
      const fromLen2 = fromSplit.length;
      const toLen2 = toSplit.length;
      const length2 = fromLen2 < toLen2 ? fromLen2 : toLen2;
      let i2;
      for (i2 = 0; i2 < length2; i2++) {
        if (fromSplit[i2].toLowerCase() !== toSplit[i2].toLowerCase()) {
          break;
        }
      }
      if (i2 === 0) {
        return toOrig;
      } else if (i2 === length2) {
        if (toLen2 > length2) {
          return toSplit.slice(i2).join("\\");
        }
        if (fromLen2 > length2) {
          return "..\\".repeat(fromLen2 - 1 - i2) + "..";
        }
        return "";
      }
      return "..\\".repeat(fromLen2 - i2) + toSplit.slice(i2).join("\\");
    }
    let fromStart = 0;
    while (fromStart < from.length && from.charCodeAt(fromStart) === CHAR_BACKWARD_SLASH) {
      fromStart++;
    }
    let fromEnd = from.length;
    while (fromEnd - 1 > fromStart && from.charCodeAt(fromEnd - 1) === CHAR_BACKWARD_SLASH) {
      fromEnd--;
    }
    const fromLen = fromEnd - fromStart;
    let toStart = 0;
    while (toStart < to.length && to.charCodeAt(toStart) === CHAR_BACKWARD_SLASH) {
      toStart++;
    }
    let toEnd = to.length;
    while (toEnd - 1 > toStart && to.charCodeAt(toEnd - 1) === CHAR_BACKWARD_SLASH) {
      toEnd--;
    }
    const toLen = toEnd - toStart;
    const length = fromLen < toLen ? fromLen : toLen;
    let lastCommonSep = -1;
    let i = 0;
    for (; i < length; i++) {
      const fromCode = from.charCodeAt(fromStart + i);
      if (fromCode !== to.charCodeAt(toStart + i)) {
        break;
      } else if (fromCode === CHAR_BACKWARD_SLASH) {
        lastCommonSep = i;
      }
    }
    if (i !== length) {
      if (lastCommonSep === -1) {
        return toOrig;
      }
    } else {
      if (toLen > length) {
        if (to.charCodeAt(toStart + i) === CHAR_BACKWARD_SLASH) {
          return toOrig.slice(toStart + i + 1);
        }
        if (i === 2) {
          return toOrig.slice(toStart + i);
        }
      }
      if (fromLen > length) {
        if (from.charCodeAt(fromStart + i) === CHAR_BACKWARD_SLASH) {
          lastCommonSep = i;
        } else if (i === 2) {
          lastCommonSep = 3;
        }
      }
      if (lastCommonSep === -1) {
        lastCommonSep = 0;
      }
    }
    let out = "";
    for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
      if (i === fromEnd || from.charCodeAt(i) === CHAR_BACKWARD_SLASH) {
        out += out.length === 0 ? ".." : "\\..";
      }
    }
    toStart += lastCommonSep;
    if (out.length > 0) {
      return `${out}${toOrig.slice(toStart, toEnd)}`;
    }
    if (toOrig.charCodeAt(toStart) === CHAR_BACKWARD_SLASH) {
      ++toStart;
    }
    return toOrig.slice(toStart, toEnd);
  },
  toNamespacedPath(path) {
    if (typeof path !== "string" || path.length === 0) {
      return path;
    }
    const resolvedPath = win32.resolve(path);
    if (resolvedPath.length <= 2) {
      return path;
    }
    if (resolvedPath.charCodeAt(0) === CHAR_BACKWARD_SLASH) {
      if (resolvedPath.charCodeAt(1) === CHAR_BACKWARD_SLASH) {
        const code = resolvedPath.charCodeAt(2);
        if (code !== CHAR_QUESTION_MARK && code !== CHAR_DOT) {
          return `\\\\?\\UNC\\${resolvedPath.slice(2)}`;
        }
      }
    } else if (isWindowsDeviceRoot(resolvedPath.charCodeAt(0)) && resolvedPath.charCodeAt(1) === CHAR_COLON && resolvedPath.charCodeAt(2) === CHAR_BACKWARD_SLASH) {
      return `\\\\?\\${resolvedPath}`;
    }
    return resolvedPath;
  },
  dirname(path) {
    validateString(path, "path");
    const len = path.length;
    if (len === 0) {
      return ".";
    }
    let rootEnd = -1;
    let offset = 0;
    const code = path.charCodeAt(0);
    if (len === 1) {
      return isPathSeparator(code) ? path : ".";
    }
    if (isPathSeparator(code)) {
      rootEnd = offset = 1;
      if (isPathSeparator(path.charCodeAt(1))) {
        let j = 2;
        let last = j;
        while (j < len && !isPathSeparator(path.charCodeAt(j))) {
          j++;
        }
        if (j < len && j !== last) {
          last = j;
          while (j < len && isPathSeparator(path.charCodeAt(j))) {
            j++;
          }
          if (j < len && j !== last) {
            last = j;
            while (j < len && !isPathSeparator(path.charCodeAt(j))) {
              j++;
            }
            if (j === len) {
              return path;
            }
            if (j !== last) {
              rootEnd = offset = j + 1;
            }
          }
        }
      }
    } else if (isWindowsDeviceRoot(code) && path.charCodeAt(1) === CHAR_COLON) {
      rootEnd = len > 2 && isPathSeparator(path.charCodeAt(2)) ? 3 : 2;
      offset = rootEnd;
    }
    let end = -1;
    let matchedSlash = true;
    for (let i = len - 1; i >= offset; --i) {
      if (isPathSeparator(path.charCodeAt(i))) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
        matchedSlash = false;
      }
    }
    if (end === -1) {
      if (rootEnd === -1) {
        return ".";
      }
      end = rootEnd;
    }
    return path.slice(0, end);
  },
  basename(path, suffix) {
    if (suffix !== void 0) {
      validateString(suffix, "suffix");
    }
    validateString(path, "path");
    let start = 0;
    let end = -1;
    let matchedSlash = true;
    let i;
    if (path.length >= 2 && isWindowsDeviceRoot(path.charCodeAt(0)) && path.charCodeAt(1) === CHAR_COLON) {
      start = 2;
    }
    if (suffix !== void 0 && suffix.length > 0 && suffix.length <= path.length) {
      if (suffix === path) {
        return "";
      }
      let extIdx = suffix.length - 1;
      let firstNonSlashEnd = -1;
      for (i = path.length - 1; i >= start; --i) {
        const code = path.charCodeAt(i);
        if (isPathSeparator(code)) {
          if (!matchedSlash) {
            start = i + 1;
            break;
          }
        } else {
          if (firstNonSlashEnd === -1) {
            matchedSlash = false;
            firstNonSlashEnd = i + 1;
          }
          if (extIdx >= 0) {
            if (code === suffix.charCodeAt(extIdx)) {
              if (--extIdx === -1) {
                end = i;
              }
            } else {
              extIdx = -1;
              end = firstNonSlashEnd;
            }
          }
        }
      }
      if (start === end) {
        end = firstNonSlashEnd;
      } else if (end === -1) {
        end = path.length;
      }
      return path.slice(start, end);
    }
    for (i = path.length - 1; i >= start; --i) {
      if (isPathSeparator(path.charCodeAt(i))) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
        matchedSlash = false;
        end = i + 1;
      }
    }
    if (end === -1) {
      return "";
    }
    return path.slice(start, end);
  },
  extname(path) {
    validateString(path, "path");
    let start = 0;
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let preDotState = 0;
    if (path.length >= 2 && path.charCodeAt(1) === CHAR_COLON && isWindowsDeviceRoot(path.charCodeAt(0))) {
      start = startPart = 2;
    }
    for (let i = path.length - 1; i >= start; --i) {
      const code = path.charCodeAt(i);
      if (isPathSeparator(code)) {
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
      if (end === -1) {
        matchedSlash = false;
        end = i + 1;
      }
      if (code === CHAR_DOT) {
        if (startDot === -1) {
          startDot = i;
        } else if (preDotState !== 1) {
          preDotState = 1;
        }
      } else if (startDot !== -1) {
        preDotState = -1;
      }
    }
    if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
    preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
    preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
      return "";
    }
    return path.slice(startDot, end);
  },
  format: _format.bind(null, "\\"),
  parse(path) {
    validateString(path, "path");
    const ret = { root: "", dir: "", base: "", ext: "", name: "" };
    if (path.length === 0) {
      return ret;
    }
    const len = path.length;
    let rootEnd = 0;
    let code = path.charCodeAt(0);
    if (len === 1) {
      if (isPathSeparator(code)) {
        ret.root = ret.dir = path;
        return ret;
      }
      ret.base = ret.name = path;
      return ret;
    }
    if (isPathSeparator(code)) {
      rootEnd = 1;
      if (isPathSeparator(path.charCodeAt(1))) {
        let j = 2;
        let last = j;
        while (j < len && !isPathSeparator(path.charCodeAt(j))) {
          j++;
        }
        if (j < len && j !== last) {
          last = j;
          while (j < len && isPathSeparator(path.charCodeAt(j))) {
            j++;
          }
          if (j < len && j !== last) {
            last = j;
            while (j < len && !isPathSeparator(path.charCodeAt(j))) {
              j++;
            }
            if (j === len) {
              rootEnd = j;
            } else if (j !== last) {
              rootEnd = j + 1;
            }
          }
        }
      }
    } else if (isWindowsDeviceRoot(code) && path.charCodeAt(1) === CHAR_COLON) {
      if (len <= 2) {
        ret.root = ret.dir = path;
        return ret;
      }
      rootEnd = 2;
      if (isPathSeparator(path.charCodeAt(2))) {
        if (len === 3) {
          ret.root = ret.dir = path;
          return ret;
        }
        rootEnd = 3;
      }
    }
    if (rootEnd > 0) {
      ret.root = path.slice(0, rootEnd);
    }
    let startDot = -1;
    let startPart = rootEnd;
    let end = -1;
    let matchedSlash = true;
    let i = path.length - 1;
    let preDotState = 0;
    for (; i >= rootEnd; --i) {
      code = path.charCodeAt(i);
      if (isPathSeparator(code)) {
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
      if (end === -1) {
        matchedSlash = false;
        end = i + 1;
      }
      if (code === CHAR_DOT) {
        if (startDot === -1) {
          startDot = i;
        } else if (preDotState !== 1) {
          preDotState = 1;
        }
      } else if (startDot !== -1) {
        preDotState = -1;
      }
    }
    if (end !== -1) {
      if (startDot === -1 || // We saw a non-dot character immediately before the dot
      preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
      preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        ret.base = ret.name = path.slice(startPart, end);
      } else {
        ret.name = path.slice(startPart, startDot);
        ret.base = path.slice(startPart, end);
        ret.ext = path.slice(startDot, end);
      }
    }
    if (startPart > 0 && startPart !== rootEnd) {
      ret.dir = path.slice(0, startPart - 1);
    } else {
      ret.dir = ret.root;
    }
    return ret;
  },
  sep: "\\",
  delimiter: ";",
  win32: null,
  posix: null
};
const posixCwd = (() => {
  if (platformIsWin32) {
    const regexp = /\\/g;
    return () => {
      const cwd = process.cwd().replace(regexp, "/");
      return cwd.slice(cwd.indexOf("/"));
    };
  }
  return () => process.cwd();
})();
const posix = {
  // path.resolve([from ...], to)
  resolve(...pathSegments) {
    let resolvedPath = "";
    let resolvedAbsolute = false;
    for (let i = pathSegments.length - 1; i >= 0 && !resolvedAbsolute; i--) {
      const path = pathSegments[i];
      validateString(path, `paths[${i}]`);
      if (path.length === 0) {
        continue;
      }
      resolvedPath = `${path}/${resolvedPath}`;
      resolvedAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
    }
    if (!resolvedAbsolute) {
      const cwd = posixCwd();
      resolvedPath = `${cwd}/${resolvedPath}`;
      resolvedAbsolute = cwd.charCodeAt(0) === CHAR_FORWARD_SLASH;
    }
    resolvedPath = normalizeString(
      resolvedPath,
      !resolvedAbsolute,
      "/",
      isPosixPathSeparator
    );
    if (resolvedAbsolute) {
      return `/${resolvedPath}`;
    }
    return resolvedPath.length > 0 ? resolvedPath : ".";
  },
  normalize(path) {
    validateString(path, "path");
    if (path.length === 0) {
      return ".";
    }
    const isAbsolute2 = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
    const trailingSeparator = path.charCodeAt(path.length - 1) === CHAR_FORWARD_SLASH;
    path = normalizeString(path, !isAbsolute2, "/", isPosixPathSeparator);
    if (path.length === 0) {
      if (isAbsolute2) {
        return "/";
      }
      return trailingSeparator ? "./" : ".";
    }
    if (trailingSeparator) {
      path += "/";
    }
    return isAbsolute2 ? `/${path}` : path;
  },
  isAbsolute(path) {
    validateString(path, "path");
    return path.length > 0 && path.charCodeAt(0) === CHAR_FORWARD_SLASH;
  },
  join(...paths) {
    if (paths.length === 0) {
      return ".";
    }
    const path = [];
    for (let i = 0; i < paths.length; ++i) {
      const arg = paths[i];
      validateString(arg, "path");
      if (arg.length > 0) {
        path.push(arg);
      }
    }
    if (path.length === 0) {
      return ".";
    }
    return posix.normalize(path.join("/"));
  },
  relative(from, to) {
    validateString(from, "from");
    validateString(to, "to");
    if (from === to) {
      return "";
    }
    from = posix.resolve(from);
    to = posix.resolve(to);
    if (from === to) {
      return "";
    }
    const fromStart = 1;
    const fromEnd = from.length;
    const fromLen = fromEnd - fromStart;
    const toStart = 1;
    const toLen = to.length - toStart;
    const length = fromLen < toLen ? fromLen : toLen;
    let lastCommonSep = -1;
    let i = 0;
    for (; i < length; i++) {
      const fromCode = from.charCodeAt(fromStart + i);
      if (fromCode !== to.charCodeAt(toStart + i)) {
        break;
      } else if (fromCode === CHAR_FORWARD_SLASH) {
        lastCommonSep = i;
      }
    }
    if (i === length) {
      if (toLen > length) {
        if (to.charCodeAt(toStart + i) === CHAR_FORWARD_SLASH) {
          return to.slice(toStart + i + 1);
        }
        if (i === 0) {
          return to.slice(toStart + i);
        }
      } else if (fromLen > length) {
        if (from.charCodeAt(fromStart + i) === CHAR_FORWARD_SLASH) {
          lastCommonSep = i;
        } else if (i === 0) {
          lastCommonSep = 0;
        }
      }
    }
    let out = "";
    for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
      if (i === fromEnd || from.charCodeAt(i) === CHAR_FORWARD_SLASH) {
        out += out.length === 0 ? ".." : "/..";
      }
    }
    return `${out}${to.slice(toStart + lastCommonSep)}`;
  },
  toNamespacedPath(path) {
    return path;
  },
  dirname(path) {
    validateString(path, "path");
    if (path.length === 0) {
      return ".";
    }
    const hasRoot = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
    let end = -1;
    let matchedSlash = true;
    for (let i = path.length - 1; i >= 1; --i) {
      if (path.charCodeAt(i) === CHAR_FORWARD_SLASH) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
        matchedSlash = false;
      }
    }
    if (end === -1) {
      return hasRoot ? "/" : ".";
    }
    if (hasRoot && end === 1) {
      return "//";
    }
    return path.slice(0, end);
  },
  basename(path, suffix) {
    if (suffix !== void 0) {
      validateString(suffix, "suffix");
    }
    validateString(path, "path");
    let start = 0;
    let end = -1;
    let matchedSlash = true;
    let i;
    if (suffix !== void 0 && suffix.length > 0 && suffix.length <= path.length) {
      if (suffix === path) {
        return "";
      }
      let extIdx = suffix.length - 1;
      let firstNonSlashEnd = -1;
      for (i = path.length - 1; i >= 0; --i) {
        const code = path.charCodeAt(i);
        if (code === CHAR_FORWARD_SLASH) {
          if (!matchedSlash) {
            start = i + 1;
            break;
          }
        } else {
          if (firstNonSlashEnd === -1) {
            matchedSlash = false;
            firstNonSlashEnd = i + 1;
          }
          if (extIdx >= 0) {
            if (code === suffix.charCodeAt(extIdx)) {
              if (--extIdx === -1) {
                end = i;
              }
            } else {
              extIdx = -1;
              end = firstNonSlashEnd;
            }
          }
        }
      }
      if (start === end) {
        end = firstNonSlashEnd;
      } else if (end === -1) {
        end = path.length;
      }
      return path.slice(start, end);
    }
    for (i = path.length - 1; i >= 0; --i) {
      if (path.charCodeAt(i) === CHAR_FORWARD_SLASH) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
        matchedSlash = false;
        end = i + 1;
      }
    }
    if (end === -1) {
      return "";
    }
    return path.slice(start, end);
  },
  extname(path) {
    validateString(path, "path");
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let preDotState = 0;
    for (let i = path.length - 1; i >= 0; --i) {
      const char = path[i];
      if (char === "/") {
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
      if (end === -1) {
        matchedSlash = false;
        end = i + 1;
      }
      if (char === ".") {
        if (startDot === -1) {
          startDot = i;
        } else if (preDotState !== 1) {
          preDotState = 1;
        }
      } else if (startDot !== -1) {
        preDotState = -1;
      }
    }
    if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
    preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
    preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
      return "";
    }
    return path.slice(startDot, end);
  },
  format: _format.bind(null, "/"),
  parse(path) {
    validateString(path, "path");
    const ret = { root: "", dir: "", base: "", ext: "", name: "" };
    if (path.length === 0) {
      return ret;
    }
    const isAbsolute2 = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
    let start;
    if (isAbsolute2) {
      ret.root = "/";
      start = 1;
    } else {
      start = 0;
    }
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let i = path.length - 1;
    let preDotState = 0;
    for (; i >= start; --i) {
      const code = path.charCodeAt(i);
      if (code === CHAR_FORWARD_SLASH) {
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
      if (end === -1) {
        matchedSlash = false;
        end = i + 1;
      }
      if (code === CHAR_DOT) {
        if (startDot === -1) {
          startDot = i;
        } else if (preDotState !== 1) {
          preDotState = 1;
        }
      } else if (startDot !== -1) {
        preDotState = -1;
      }
    }
    if (end !== -1) {
      const start2 = startPart === 0 && isAbsolute2 ? 1 : startPart;
      if (startDot === -1 || // We saw a non-dot character immediately before the dot
      preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
      preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        ret.base = ret.name = path.slice(start2, end);
      } else {
        ret.name = path.slice(start2, startDot);
        ret.base = path.slice(start2, end);
        ret.ext = path.slice(startDot, end);
      }
    }
    if (startPart > 0) {
      ret.dir = path.slice(0, startPart - 1);
    } else if (isAbsolute2) {
      ret.dir = "/";
    }
    return ret;
  },
  sep: "/",
  delimiter: ":",
  win32: null,
  posix: null
};
posix.win32 = win32.win32 = win32;
posix.posix = win32.posix = posix;
const normalize = platformIsWin32 ? win32.normalize : posix.normalize;
const isAbsolute = platformIsWin32 ? win32.isAbsolute : posix.isAbsolute;
const join = platformIsWin32 ? win32.join : posix.join;
const resolve = platformIsWin32 ? win32.resolve : posix.resolve;
const relative = platformIsWin32 ? win32.relative : posix.relative;
const dirname = platformIsWin32 ? win32.dirname : posix.dirname;
const basename = platformIsWin32 ? win32.basename : posix.basename;
const extname = platformIsWin32 ? win32.extname : posix.extname;
const format = platformIsWin32 ? win32.format : posix.format;
const parse = platformIsWin32 ? win32.parse : posix.parse;
const toNamespacedPath = platformIsWin32 ? win32.toNamespacedPath : posix.toNamespacedPath;
const sep = platformIsWin32 ? win32.sep : posix.sep;
const delimiter = platformIsWin32 ? win32.delimiter : posix.delimiter;
export {
  basename,
  delimiter,
  dirname,
  extname,
  format,
  isAbsolute,
  join,
  normalize,
  parse,
  posix,
  relative,
  resolve,
  sep,
  toNamespacedPath,
  win32
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9wYXRoLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuLy8gTk9URTogVlNDb2RlJ3MgY29weSBvZiBub2RlanMgcGF0aCBsaWJyYXJ5IHRvIGJlIHVzYWJsZSBpbiBjb21tb24gKG5vbi1ub2RlKSBuYW1lc3BhY2Vcbi8vIENvcGllZCBmcm9tOiBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvY29tbWl0cy92MjAuMTguMi9saWIvcGF0aC5qc1xuLy8gRXhjbHVkaW5nOiB0aGUgY2hhbmdlIHRoYXQgYWRkcyBwcmltb3JkaWFsc1xuLy8gKGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9jb21taXQvMTg3YTg2MmQyMjFkZWM0MmZhOWE1YzQyMTRlNzAzNGQ5MDkyNzkyZiBhbmQgb3RoZXJzKVxuLy8gRXhjbHVkaW5nOiB0aGUgY2hhbmdlIHRoYXQgYWRkcyBnbG9iIG1hdGNoaW5nXG4vLyAoaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2NvbW1pdC81N2I4YjhlMThlNWUyMDA3MTE0YzYzYjcxYmYwYmFlZGMwMTkzNmE2KVxuXG4vKipcbiAqIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuICpcbiAqIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4gKiBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4gKiBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbiAqIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbiAqIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbiAqIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuICogZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4gKlxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbiAqIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICpcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1NcbiAqIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0ZcbiAqIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbiAqIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuICogREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4gKiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4gKiBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuICovXG5cbmltcG9ydCAqIGFzIHByb2Nlc3MgZnJvbSAnLi9wcm9jZXNzLmpzJztcblxuY29uc3QgQ0hBUl9VUFBFUkNBU0VfQSA9IDY1Oy8qIEEgKi9cbmNvbnN0IENIQVJfTE9XRVJDQVNFX0EgPSA5NzsgLyogYSAqL1xuY29uc3QgQ0hBUl9VUFBFUkNBU0VfWiA9IDkwOyAvKiBaICovXG5jb25zdCBDSEFSX0xPV0VSQ0FTRV9aID0gMTIyOyAvKiB6ICovXG5jb25zdCBDSEFSX0RPVCA9IDQ2OyAvKiAuICovXG5jb25zdCBDSEFSX0ZPUldBUkRfU0xBU0ggPSA0NzsgLyogLyAqL1xuY29uc3QgQ0hBUl9CQUNLV0FSRF9TTEFTSCA9IDkyOyAvKiBcXCAqL1xuY29uc3QgQ0hBUl9DT0xPTiA9IDU4OyAvKiA6ICovXG5jb25zdCBDSEFSX1FVRVNUSU9OX01BUksgPSA2MzsgLyogPyAqL1xuXG5jbGFzcyBFcnJvckludmFsaWRBcmdUeXBlIGV4dGVuZHMgRXJyb3Ige1xuXHRjb2RlOiAnRVJSX0lOVkFMSURfQVJHX1RZUEUnO1xuXHRjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGV4cGVjdGVkOiBzdHJpbmcsIGFjdHVhbDogdW5rbm93bikge1xuXHRcdC8vIGRldGVybWluZXI6ICdtdXN0IGJlJyBvciAnbXVzdCBub3QgYmUnXG5cdFx0bGV0IGRldGVybWluZXI7XG5cdFx0aWYgKHR5cGVvZiBleHBlY3RlZCA9PT0gJ3N0cmluZycgJiYgZXhwZWN0ZWQuaW5kZXhPZignbm90ICcpID09PSAwKSB7XG5cdFx0XHRkZXRlcm1pbmVyID0gJ211c3Qgbm90IGJlJztcblx0XHRcdGV4cGVjdGVkID0gZXhwZWN0ZWQucmVwbGFjZSgvXm5vdCAvLCAnJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRldGVybWluZXIgPSAnbXVzdCBiZSc7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdHlwZSA9IG5hbWUuaW5kZXhPZignLicpICE9PSAtMSA/ICdwcm9wZXJ0eScgOiAnYXJndW1lbnQnO1xuXHRcdGxldCBtc2cgPSBgVGhlIFwiJHtuYW1lfVwiICR7dHlwZX0gJHtkZXRlcm1pbmVyfSBvZiB0eXBlICR7ZXhwZWN0ZWR9YDtcblxuXHRcdG1zZyArPSBgLiBSZWNlaXZlZCB0eXBlICR7dHlwZW9mIGFjdHVhbH1gO1xuXHRcdHN1cGVyKG1zZyk7XG5cblx0XHR0aGlzLmNvZGUgPSAnRVJSX0lOVkFMSURfQVJHX1RZUEUnO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRlT2JqZWN0KHBhdGhPYmplY3Q6IG9iamVjdCwgbmFtZTogc3RyaW5nKSB7XG5cdGlmIChwYXRoT2JqZWN0ID09PSBudWxsIHx8IHR5cGVvZiBwYXRoT2JqZWN0ICE9PSAnb2JqZWN0Jykge1xuXHRcdHRocm93IG5ldyBFcnJvckludmFsaWRBcmdUeXBlKG5hbWUsICdPYmplY3QnLCBwYXRoT2JqZWN0KTtcblx0fVxufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZVN0cmluZyh2YWx1ZTogc3RyaW5nLCBuYW1lOiBzdHJpbmcpIHtcblx0aWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3JJbnZhbGlkQXJnVHlwZShuYW1lLCAnc3RyaW5nJywgdmFsdWUpO1xuXHR9XG59XG5cbmNvbnN0IHBsYXRmb3JtSXNXaW4zMiA9IChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKTtcblxuZnVuY3Rpb24gaXNQYXRoU2VwYXJhdG9yKGNvZGU6IG51bWJlciB8IHVuZGVmaW5lZCkge1xuXHRyZXR1cm4gY29kZSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIIHx8IGNvZGUgPT09IENIQVJfQkFDS1dBUkRfU0xBU0g7XG59XG5cbmZ1bmN0aW9uIGlzUG9zaXhQYXRoU2VwYXJhdG9yKGNvZGU6IG51bWJlciB8IHVuZGVmaW5lZCkge1xuXHRyZXR1cm4gY29kZSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIO1xufVxuXG5mdW5jdGlvbiBpc1dpbmRvd3NEZXZpY2VSb290KGNvZGU6IG51bWJlcikge1xuXHRyZXR1cm4gKGNvZGUgPj0gQ0hBUl9VUFBFUkNBU0VfQSAmJiBjb2RlIDw9IENIQVJfVVBQRVJDQVNFX1opIHx8XG5cdFx0KGNvZGUgPj0gQ0hBUl9MT1dFUkNBU0VfQSAmJiBjb2RlIDw9IENIQVJfTE9XRVJDQVNFX1opO1xufVxuXG4vLyBSZXNvbHZlcyAuIGFuZCAuLiBlbGVtZW50cyBpbiBhIHBhdGggd2l0aCBkaXJlY3RvcnkgbmFtZXNcbmZ1bmN0aW9uIG5vcm1hbGl6ZVN0cmluZyhwYXRoOiBzdHJpbmcsIGFsbG93QWJvdmVSb290OiBib29sZWFuLCBzZXBhcmF0b3I6IHN0cmluZywgaXNQYXRoU2VwYXJhdG9yOiAoY29kZT86IG51bWJlcikgPT4gYm9vbGVhbikge1xuXHRsZXQgcmVzID0gJyc7XG5cdGxldCBsYXN0U2VnbWVudExlbmd0aCA9IDA7XG5cdGxldCBsYXN0U2xhc2ggPSAtMTtcblx0bGV0IGRvdHMgPSAwO1xuXHRsZXQgY29kZSA9IDA7XG5cdGZvciAobGV0IGkgPSAwOyBpIDw9IHBhdGgubGVuZ3RoOyArK2kpIHtcblx0XHRpZiAoaSA8IHBhdGgubGVuZ3RoKSB7XG5cdFx0XHRjb2RlID0gcGF0aC5jaGFyQ29kZUF0KGkpO1xuXHRcdH1cblx0XHRlbHNlIGlmIChpc1BhdGhTZXBhcmF0b3IoY29kZSkpIHtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGNvZGUgPSBDSEFSX0ZPUldBUkRfU0xBU0g7XG5cdFx0fVxuXG5cdFx0aWYgKGlzUGF0aFNlcGFyYXRvcihjb2RlKSkge1xuXHRcdFx0aWYgKGxhc3RTbGFzaCA9PT0gaSAtIDEgfHwgZG90cyA9PT0gMSkge1xuXHRcdFx0XHQvLyBOT09QXG5cdFx0XHR9IGVsc2UgaWYgKGRvdHMgPT09IDIpIHtcblx0XHRcdFx0aWYgKHJlcy5sZW5ndGggPCAyIHx8IGxhc3RTZWdtZW50TGVuZ3RoICE9PSAyIHx8XG5cdFx0XHRcdFx0cmVzLmNoYXJDb2RlQXQocmVzLmxlbmd0aCAtIDEpICE9PSBDSEFSX0RPVCB8fFxuXHRcdFx0XHRcdHJlcy5jaGFyQ29kZUF0KHJlcy5sZW5ndGggLSAyKSAhPT0gQ0hBUl9ET1QpIHtcblx0XHRcdFx0XHRpZiAocmVzLmxlbmd0aCA+IDIpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGxhc3RTbGFzaEluZGV4ID0gcmVzLmxhc3RJbmRleE9mKHNlcGFyYXRvcik7XG5cdFx0XHRcdFx0XHRpZiAobGFzdFNsYXNoSW5kZXggPT09IC0xKSB7XG5cdFx0XHRcdFx0XHRcdHJlcyA9ICcnO1xuXHRcdFx0XHRcdFx0XHRsYXN0U2VnbWVudExlbmd0aCA9IDA7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRyZXMgPSByZXMuc2xpY2UoMCwgbGFzdFNsYXNoSW5kZXgpO1xuXHRcdFx0XHRcdFx0XHRsYXN0U2VnbWVudExlbmd0aCA9IHJlcy5sZW5ndGggLSAxIC0gcmVzLmxhc3RJbmRleE9mKHNlcGFyYXRvcik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRsYXN0U2xhc2ggPSBpO1xuXHRcdFx0XHRcdFx0ZG90cyA9IDA7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHJlcy5sZW5ndGggIT09IDApIHtcblx0XHRcdFx0XHRcdHJlcyA9ICcnO1xuXHRcdFx0XHRcdFx0bGFzdFNlZ21lbnRMZW5ndGggPSAwO1xuXHRcdFx0XHRcdFx0bGFzdFNsYXNoID0gaTtcblx0XHRcdFx0XHRcdGRvdHMgPSAwO1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChhbGxvd0Fib3ZlUm9vdCkge1xuXHRcdFx0XHRcdHJlcyArPSByZXMubGVuZ3RoID4gMCA/IGAke3NlcGFyYXRvcn0uLmAgOiAnLi4nO1xuXHRcdFx0XHRcdGxhc3RTZWdtZW50TGVuZ3RoID0gMjtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKHJlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0cmVzICs9IGAke3NlcGFyYXRvcn0ke3BhdGguc2xpY2UobGFzdFNsYXNoICsgMSwgaSl9YDtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRyZXMgPSBwYXRoLnNsaWNlKGxhc3RTbGFzaCArIDEsIGkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxhc3RTZWdtZW50TGVuZ3RoID0gaSAtIGxhc3RTbGFzaCAtIDE7XG5cdFx0XHR9XG5cdFx0XHRsYXN0U2xhc2ggPSBpO1xuXHRcdFx0ZG90cyA9IDA7XG5cdFx0fSBlbHNlIGlmIChjb2RlID09PSBDSEFSX0RPVCAmJiBkb3RzICE9PSAtMSkge1xuXHRcdFx0Kytkb3RzO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkb3RzID0gLTE7XG5cdFx0fVxuXHR9XG5cdHJldHVybiByZXM7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdEV4dChleHQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBleHQgPyBgJHtleHRbMF0gPT09ICcuJyA/ICcnIDogJy4nfSR7ZXh0fWAgOiAnJztcbn1cblxuZnVuY3Rpb24gX2Zvcm1hdChzZXA6IHN0cmluZywgcGF0aE9iamVjdDogUGFyc2VkUGF0aCkge1xuXHR2YWxpZGF0ZU9iamVjdChwYXRoT2JqZWN0LCAncGF0aE9iamVjdCcpO1xuXHRjb25zdCBkaXIgPSBwYXRoT2JqZWN0LmRpciB8fCBwYXRoT2JqZWN0LnJvb3Q7XG5cdGNvbnN0IGJhc2UgPSBwYXRoT2JqZWN0LmJhc2UgfHxcblx0XHRgJHtwYXRoT2JqZWN0Lm5hbWUgfHwgJyd9JHtmb3JtYXRFeHQocGF0aE9iamVjdC5leHQpfWA7XG5cdGlmICghZGlyKSB7XG5cdFx0cmV0dXJuIGJhc2U7XG5cdH1cblx0cmV0dXJuIGRpciA9PT0gcGF0aE9iamVjdC5yb290ID8gYCR7ZGlyfSR7YmFzZX1gIDogYCR7ZGlyfSR7c2VwfSR7YmFzZX1gO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlZFBhdGgge1xuXHRyb290OiBzdHJpbmc7XG5cdGRpcjogc3RyaW5nO1xuXHRiYXNlOiBzdHJpbmc7XG5cdGV4dDogc3RyaW5nO1xuXHRuYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVBhdGgge1xuXHRub3JtYWxpemUocGF0aDogc3RyaW5nKTogc3RyaW5nO1xuXHRpc0Fic29sdXRlKHBhdGg6IHN0cmluZyk6IGJvb2xlYW47XG5cdGpvaW4oLi4ucGF0aHM6IHN0cmluZ1tdKTogc3RyaW5nO1xuXHRyZXNvbHZlKC4uLnBhdGhTZWdtZW50czogc3RyaW5nW10pOiBzdHJpbmc7XG5cdHJlbGF0aXZlKGZyb206IHN0cmluZywgdG86IHN0cmluZyk6IHN0cmluZztcblx0ZGlybmFtZShwYXRoOiBzdHJpbmcpOiBzdHJpbmc7XG5cdGJhc2VuYW1lKHBhdGg6IHN0cmluZywgc3VmZml4Pzogc3RyaW5nKTogc3RyaW5nO1xuXHRleHRuYW1lKHBhdGg6IHN0cmluZyk6IHN0cmluZztcblx0Zm9ybWF0KHBhdGhPYmplY3Q6IFBhcnNlZFBhdGgpOiBzdHJpbmc7XG5cdHBhcnNlKHBhdGg6IHN0cmluZyk6IFBhcnNlZFBhdGg7XG5cdHRvTmFtZXNwYWNlZFBhdGgocGF0aDogc3RyaW5nKTogc3RyaW5nO1xuXHRzZXA6ICdcXFxcJyB8ICcvJztcblx0ZGVsaW1pdGVyOiBzdHJpbmc7XG5cdHdpbjMyOiBJUGF0aCB8IG51bGw7XG5cdHBvc2l4OiBJUGF0aCB8IG51bGw7XG59XG5cbmV4cG9ydCBjb25zdCB3aW4zMjogSVBhdGggPSB7XG5cdC8vIHBhdGgucmVzb2x2ZShbZnJvbSAuLi5dLCB0bylcblx0cmVzb2x2ZSguLi5wYXRoU2VnbWVudHM6IHN0cmluZ1tdKTogc3RyaW5nIHtcblx0XHRsZXQgcmVzb2x2ZWREZXZpY2UgPSAnJztcblx0XHRsZXQgcmVzb2x2ZWRUYWlsID0gJyc7XG5cdFx0bGV0IHJlc29sdmVkQWJzb2x1dGUgPSBmYWxzZTtcblxuXHRcdGZvciAobGV0IGkgPSBwYXRoU2VnbWVudHMubGVuZ3RoIC0gMTsgaSA+PSAtMTsgaS0tKSB7XG5cdFx0XHRsZXQgcGF0aDtcblx0XHRcdGlmIChpID49IDApIHtcblx0XHRcdFx0cGF0aCA9IHBhdGhTZWdtZW50c1tpXTtcblx0XHRcdFx0dmFsaWRhdGVTdHJpbmcocGF0aCwgYHBhdGhzWyR7aX1dYCk7XG5cblx0XHRcdFx0Ly8gU2tpcCBlbXB0eSBlbnRyaWVzXG5cdFx0XHRcdGlmIChwYXRoLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHJlc29sdmVkRGV2aWNlLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRwYXRoID0gcHJvY2Vzcy5jd2QoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFdpbmRvd3MgaGFzIHRoZSBjb25jZXB0IG9mIGRyaXZlLXNwZWNpZmljIGN1cnJlbnQgd29ya2luZ1xuXHRcdFx0XHQvLyBkaXJlY3Rvcmllcy4gSWYgd2UndmUgcmVzb2x2ZWQgYSBkcml2ZSBsZXR0ZXIgYnV0IG5vdCB5ZXQgYW5cblx0XHRcdFx0Ly8gYWJzb2x1dGUgcGF0aCwgZ2V0IGN3ZCBmb3IgdGhhdCBkcml2ZSwgb3IgdGhlIHByb2Nlc3MgY3dkIGlmXG5cdFx0XHRcdC8vIHRoZSBkcml2ZSBjd2QgaXMgbm90IGF2YWlsYWJsZS4gV2UncmUgc3VyZSB0aGUgZGV2aWNlIGlzIG5vdFxuXHRcdFx0XHQvLyBhIFVOQyBwYXRoIGF0IHRoaXMgcG9pbnRzLCBiZWNhdXNlIFVOQyBwYXRocyBhcmUgYWx3YXlzIGFic29sdXRlLlxuXHRcdFx0XHRwYXRoID0gcHJvY2Vzcy5lbnZbYD0ke3Jlc29sdmVkRGV2aWNlfWBdIHx8IHByb2Nlc3MuY3dkKCk7XG5cblx0XHRcdFx0Ly8gVmVyaWZ5IHRoYXQgYSBjd2Qgd2FzIGZvdW5kIGFuZCB0aGF0IGl0IGFjdHVhbGx5IHBvaW50c1xuXHRcdFx0XHQvLyB0byBvdXIgZHJpdmUuIElmIG5vdCwgZGVmYXVsdCB0byB0aGUgZHJpdmUncyByb290LlxuXHRcdFx0XHRpZiAocGF0aCA9PT0gdW5kZWZpbmVkIHx8XG5cdFx0XHRcdFx0KHBhdGguc2xpY2UoMCwgMikudG9Mb3dlckNhc2UoKSAhPT0gcmVzb2x2ZWREZXZpY2UudG9Mb3dlckNhc2UoKSAmJlxuXHRcdFx0XHRcdFx0cGF0aC5jaGFyQ29kZUF0KDIpID09PSBDSEFSX0JBQ0tXQVJEX1NMQVNIKSkge1xuXHRcdFx0XHRcdHBhdGggPSBgJHtyZXNvbHZlZERldmljZX1cXFxcYDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBsZW4gPSBwYXRoLmxlbmd0aDtcblx0XHRcdGxldCByb290RW5kID0gMDtcblx0XHRcdGxldCBkZXZpY2UgPSAnJztcblx0XHRcdGxldCBpc0Fic29sdXRlID0gZmFsc2U7XG5cdFx0XHRjb25zdCBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KDApO1xuXG5cdFx0XHQvLyBUcnkgdG8gbWF0Y2ggYSByb290XG5cdFx0XHRpZiAobGVuID09PSAxKSB7XG5cdFx0XHRcdGlmIChpc1BhdGhTZXBhcmF0b3IoY29kZSkpIHtcblx0XHRcdFx0XHQvLyBgcGF0aGAgY29udGFpbnMganVzdCBhIHBhdGggc2VwYXJhdG9yXG5cdFx0XHRcdFx0cm9vdEVuZCA9IDE7XG5cdFx0XHRcdFx0aXNBYnNvbHV0ZSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoaXNQYXRoU2VwYXJhdG9yKGNvZGUpKSB7XG5cdFx0XHRcdC8vIFBvc3NpYmxlIFVOQyByb290XG5cblx0XHRcdFx0Ly8gSWYgd2Ugc3RhcnRlZCB3aXRoIGEgc2VwYXJhdG9yLCB3ZSBrbm93IHdlIGF0IGxlYXN0IGhhdmUgYW5cblx0XHRcdFx0Ly8gYWJzb2x1dGUgcGF0aCBvZiBzb21lIGtpbmQgKFVOQyBvciBvdGhlcndpc2UpXG5cdFx0XHRcdGlzQWJzb2x1dGUgPSB0cnVlO1xuXG5cdFx0XHRcdGlmIChpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KDEpKSkge1xuXHRcdFx0XHRcdC8vIE1hdGNoZWQgZG91YmxlIHBhdGggc2VwYXJhdG9yIGF0IGJlZ2lubmluZ1xuXHRcdFx0XHRcdGxldCBqID0gMjtcblx0XHRcdFx0XHRsZXQgbGFzdCA9IGo7XG5cdFx0XHRcdFx0Ly8gTWF0Y2ggMSBvciBtb3JlIG5vbi1wYXRoIHNlcGFyYXRvcnNcblx0XHRcdFx0XHR3aGlsZSAoaiA8IGxlbiAmJiAhaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdChqKSkpIHtcblx0XHRcdFx0XHRcdGorKztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGogPCBsZW4gJiYgaiAhPT0gbGFzdCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgZmlyc3RQYXJ0ID0gcGF0aC5zbGljZShsYXN0LCBqKTtcblx0XHRcdFx0XHRcdC8vIE1hdGNoZWQhXG5cdFx0XHRcdFx0XHRsYXN0ID0gajtcblx0XHRcdFx0XHRcdC8vIE1hdGNoIDEgb3IgbW9yZSBwYXRoIHNlcGFyYXRvcnNcblx0XHRcdFx0XHRcdHdoaWxlIChqIDwgbGVuICYmIGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaikpKSB7XG5cdFx0XHRcdFx0XHRcdGorKztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChqIDwgbGVuICYmIGogIT09IGxhc3QpIHtcblx0XHRcdFx0XHRcdFx0Ly8gTWF0Y2hlZCFcblx0XHRcdFx0XHRcdFx0bGFzdCA9IGo7XG5cdFx0XHRcdFx0XHRcdC8vIE1hdGNoIDEgb3IgbW9yZSBub24tcGF0aCBzZXBhcmF0b3JzXG5cdFx0XHRcdFx0XHRcdHdoaWxlIChqIDwgbGVuICYmICFpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGopKSkge1xuXHRcdFx0XHRcdFx0XHRcdGorKztcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRpZiAoaiA9PT0gbGVuIHx8IGogIT09IGxhc3QpIHtcblx0XHRcdFx0XHRcdFx0XHQvLyBXZSBtYXRjaGVkIGEgVU5DIHJvb3Rcblx0XHRcdFx0XHRcdFx0XHRkZXZpY2UgPSBgXFxcXFxcXFwke2ZpcnN0UGFydH1cXFxcJHtwYXRoLnNsaWNlKGxhc3QsIGopfWA7XG5cdFx0XHRcdFx0XHRcdFx0cm9vdEVuZCA9IGo7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cm9vdEVuZCA9IDE7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoaXNXaW5kb3dzRGV2aWNlUm9vdChjb2RlKSAmJlxuXHRcdFx0XHRwYXRoLmNoYXJDb2RlQXQoMSkgPT09IENIQVJfQ09MT04pIHtcblx0XHRcdFx0Ly8gUG9zc2libGUgZGV2aWNlIHJvb3Rcblx0XHRcdFx0ZGV2aWNlID0gcGF0aC5zbGljZSgwLCAyKTtcblx0XHRcdFx0cm9vdEVuZCA9IDI7XG5cdFx0XHRcdGlmIChsZW4gPiAyICYmIGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoMikpKSB7XG5cdFx0XHRcdFx0Ly8gVHJlYXQgc2VwYXJhdG9yIGZvbGxvd2luZyBkcml2ZSBuYW1lIGFzIGFuIGFic29sdXRlIHBhdGhcblx0XHRcdFx0XHQvLyBpbmRpY2F0b3Jcblx0XHRcdFx0XHRpc0Fic29sdXRlID0gdHJ1ZTtcblx0XHRcdFx0XHRyb290RW5kID0gMztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZGV2aWNlLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0aWYgKHJlc29sdmVkRGV2aWNlLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRpZiAoZGV2aWNlLnRvTG93ZXJDYXNlKCkgIT09IHJlc29sdmVkRGV2aWNlLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdFx0XHRcdC8vIFRoaXMgcGF0aCBwb2ludHMgdG8gYW5vdGhlciBkZXZpY2Ugc28gaXQgaXMgbm90IGFwcGxpY2FibGVcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXNvbHZlZERldmljZSA9IGRldmljZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVzb2x2ZWRBYnNvbHV0ZSkge1xuXHRcdFx0XHRpZiAocmVzb2x2ZWREZXZpY2UubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXNvbHZlZFRhaWwgPSBgJHtwYXRoLnNsaWNlKHJvb3RFbmQpfVxcXFwke3Jlc29sdmVkVGFpbH1gO1xuXHRcdFx0XHRyZXNvbHZlZEFic29sdXRlID0gaXNBYnNvbHV0ZTtcblx0XHRcdFx0aWYgKGlzQWJzb2x1dGUgJiYgcmVzb2x2ZWREZXZpY2UubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQXQgdGhpcyBwb2ludCB0aGUgcGF0aCBzaG91bGQgYmUgcmVzb2x2ZWQgdG8gYSBmdWxsIGFic29sdXRlIHBhdGgsXG5cdFx0Ly8gYnV0IGhhbmRsZSByZWxhdGl2ZSBwYXRocyB0byBiZSBzYWZlIChtaWdodCBoYXBwZW4gd2hlbiBwcm9jZXNzLmN3ZCgpXG5cdFx0Ly8gZmFpbHMpXG5cblx0XHQvLyBOb3JtYWxpemUgdGhlIHRhaWwgcGF0aFxuXHRcdHJlc29sdmVkVGFpbCA9IG5vcm1hbGl6ZVN0cmluZyhyZXNvbHZlZFRhaWwsICFyZXNvbHZlZEFic29sdXRlLCAnXFxcXCcsXG5cdFx0XHRpc1BhdGhTZXBhcmF0b3IpO1xuXG5cdFx0cmV0dXJuIHJlc29sdmVkQWJzb2x1dGUgP1xuXHRcdFx0YCR7cmVzb2x2ZWREZXZpY2V9XFxcXCR7cmVzb2x2ZWRUYWlsfWAgOlxuXHRcdFx0YCR7cmVzb2x2ZWREZXZpY2V9JHtyZXNvbHZlZFRhaWx9YCB8fCAnLic7XG5cdH0sXG5cblx0bm9ybWFsaXplKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0dmFsaWRhdGVTdHJpbmcocGF0aCwgJ3BhdGgnKTtcblx0XHRjb25zdCBsZW4gPSBwYXRoLmxlbmd0aDtcblx0XHRpZiAobGVuID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gJy4nO1xuXHRcdH1cblx0XHRsZXQgcm9vdEVuZCA9IDA7XG5cdFx0bGV0IGRldmljZTtcblx0XHRsZXQgaXNBYnNvbHV0ZSA9IGZhbHNlO1xuXHRcdGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoMCk7XG5cblx0XHQvLyBUcnkgdG8gbWF0Y2ggYSByb290XG5cdFx0aWYgKGxlbiA9PT0gMSkge1xuXHRcdFx0Ly8gYHBhdGhgIGNvbnRhaW5zIGp1c3QgYSBzaW5nbGUgY2hhciwgZXhpdCBlYXJseSB0byBhdm9pZFxuXHRcdFx0Ly8gdW5uZWNlc3Nhcnkgd29ya1xuXHRcdFx0cmV0dXJuIGlzUG9zaXhQYXRoU2VwYXJhdG9yKGNvZGUpID8gJ1xcXFwnIDogcGF0aDtcblx0XHR9XG5cdFx0aWYgKGlzUGF0aFNlcGFyYXRvcihjb2RlKSkge1xuXHRcdFx0Ly8gUG9zc2libGUgVU5DIHJvb3RcblxuXHRcdFx0Ly8gSWYgd2Ugc3RhcnRlZCB3aXRoIGEgc2VwYXJhdG9yLCB3ZSBrbm93IHdlIGF0IGxlYXN0IGhhdmUgYW4gYWJzb2x1dGVcblx0XHRcdC8vIHBhdGggb2Ygc29tZSBraW5kIChVTkMgb3Igb3RoZXJ3aXNlKVxuXHRcdFx0aXNBYnNvbHV0ZSA9IHRydWU7XG5cblx0XHRcdGlmIChpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KDEpKSkge1xuXHRcdFx0XHQvLyBNYXRjaGVkIGRvdWJsZSBwYXRoIHNlcGFyYXRvciBhdCBiZWdpbm5pbmdcblx0XHRcdFx0bGV0IGogPSAyO1xuXHRcdFx0XHRsZXQgbGFzdCA9IGo7XG5cdFx0XHRcdC8vIE1hdGNoIDEgb3IgbW9yZSBub24tcGF0aCBzZXBhcmF0b3JzXG5cdFx0XHRcdHdoaWxlIChqIDwgbGVuICYmICFpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGopKSkge1xuXHRcdFx0XHRcdGorKztcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoaiA8IGxlbiAmJiBqICE9PSBsYXN0KSB7XG5cdFx0XHRcdFx0Y29uc3QgZmlyc3RQYXJ0ID0gcGF0aC5zbGljZShsYXN0LCBqKTtcblx0XHRcdFx0XHQvLyBNYXRjaGVkIVxuXHRcdFx0XHRcdGxhc3QgPSBqO1xuXHRcdFx0XHRcdC8vIE1hdGNoIDEgb3IgbW9yZSBwYXRoIHNlcGFyYXRvcnNcblx0XHRcdFx0XHR3aGlsZSAoaiA8IGxlbiAmJiBpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGopKSkge1xuXHRcdFx0XHRcdFx0aisrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoaiA8IGxlbiAmJiBqICE9PSBsYXN0KSB7XG5cdFx0XHRcdFx0XHQvLyBNYXRjaGVkIVxuXHRcdFx0XHRcdFx0bGFzdCA9IGo7XG5cdFx0XHRcdFx0XHQvLyBNYXRjaCAxIG9yIG1vcmUgbm9uLXBhdGggc2VwYXJhdG9yc1xuXHRcdFx0XHRcdFx0d2hpbGUgKGogPCBsZW4gJiYgIWlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaikpKSB7XG5cdFx0XHRcdFx0XHRcdGorKztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChqID09PSBsZW4pIHtcblx0XHRcdFx0XHRcdFx0Ly8gV2UgbWF0Y2hlZCBhIFVOQyByb290IG9ubHlcblx0XHRcdFx0XHRcdFx0Ly8gUmV0dXJuIHRoZSBub3JtYWxpemVkIHZlcnNpb24gb2YgdGhlIFVOQyByb290IHNpbmNlIHRoZXJlXG5cdFx0XHRcdFx0XHRcdC8vIGlzIG5vdGhpbmcgbGVmdCB0byBwcm9jZXNzXG5cdFx0XHRcdFx0XHRcdHJldHVybiBgXFxcXFxcXFwke2ZpcnN0UGFydH1cXFxcJHtwYXRoLnNsaWNlKGxhc3QpfVxcXFxgO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGogIT09IGxhc3QpIHtcblx0XHRcdFx0XHRcdFx0Ly8gV2UgbWF0Y2hlZCBhIFVOQyByb290IHdpdGggbGVmdG92ZXJzXG5cdFx0XHRcdFx0XHRcdGRldmljZSA9IGBcXFxcXFxcXCR7Zmlyc3RQYXJ0fVxcXFwke3BhdGguc2xpY2UobGFzdCwgail9YDtcblx0XHRcdFx0XHRcdFx0cm9vdEVuZCA9IGo7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyb290RW5kID0gMTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGlzV2luZG93c0RldmljZVJvb3QoY29kZSkgJiYgcGF0aC5jaGFyQ29kZUF0KDEpID09PSBDSEFSX0NPTE9OKSB7XG5cdFx0XHQvLyBQb3NzaWJsZSBkZXZpY2Ugcm9vdFxuXHRcdFx0ZGV2aWNlID0gcGF0aC5zbGljZSgwLCAyKTtcblx0XHRcdHJvb3RFbmQgPSAyO1xuXHRcdFx0aWYgKGxlbiA+IDIgJiYgaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdCgyKSkpIHtcblx0XHRcdFx0Ly8gVHJlYXQgc2VwYXJhdG9yIGZvbGxvd2luZyBkcml2ZSBuYW1lIGFzIGFuIGFic29sdXRlIHBhdGhcblx0XHRcdFx0Ly8gaW5kaWNhdG9yXG5cdFx0XHRcdGlzQWJzb2x1dGUgPSB0cnVlO1xuXHRcdFx0XHRyb290RW5kID0gMztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgdGFpbCA9IHJvb3RFbmQgPCBsZW4gP1xuXHRcdFx0bm9ybWFsaXplU3RyaW5nKHBhdGguc2xpY2Uocm9vdEVuZCksICFpc0Fic29sdXRlLCAnXFxcXCcsIGlzUGF0aFNlcGFyYXRvcikgOlxuXHRcdFx0Jyc7XG5cdFx0aWYgKHRhaWwubGVuZ3RoID09PSAwICYmICFpc0Fic29sdXRlKSB7XG5cdFx0XHR0YWlsID0gJy4nO1xuXHRcdH1cblx0XHRpZiAodGFpbC5sZW5ndGggPiAwICYmIGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQobGVuIC0gMSkpKSB7XG5cdFx0XHR0YWlsICs9ICdcXFxcJztcblx0XHR9XG5cdFx0aWYgKCFpc0Fic29sdXRlICYmIGRldmljZSA9PT0gdW5kZWZpbmVkICYmIHBhdGguaW5jbHVkZXMoJzonKSkge1xuXHRcdFx0Ly8gSWYgdGhlIG9yaWdpbmFsIHBhdGggd2FzIG5vdCBhYnNvbHV0ZSBhbmQgaWYgd2UgaGF2ZSBub3QgYmVlbiBhYmxlIHRvXG5cdFx0XHQvLyByZXNvbHZlIGl0IHJlbGF0aXZlIHRvIGEgcGFydGljdWxhciBkZXZpY2UsIHdlIG5lZWQgdG8gZW5zdXJlIHRoYXQgdGhlXG5cdFx0XHQvLyBgdGFpbGAgaGFzIG5vdCBiZWNvbWUgc29tZXRoaW5nIHRoYXQgV2luZG93cyBtaWdodCBpbnRlcnByZXQgYXMgYW5cblx0XHRcdC8vIGFic29sdXRlIHBhdGguIFNlZSBDVkUtMjAyNC0zNjEzOS5cblx0XHRcdGlmICh0YWlsLmxlbmd0aCA+PSAyICYmXG5cdFx0XHRcdGlzV2luZG93c0RldmljZVJvb3QodGFpbC5jaGFyQ29kZUF0KDApKSAmJlxuXHRcdFx0XHR0YWlsLmNoYXJDb2RlQXQoMSkgPT09IENIQVJfQ09MT04pIHtcblx0XHRcdFx0cmV0dXJuIGAuXFxcXCR7dGFpbH1gO1xuXHRcdFx0fVxuXHRcdFx0bGV0IGluZGV4ID0gcGF0aC5pbmRleE9mKCc6Jyk7XG5cdFx0XHRkbyB7XG5cdFx0XHRcdGlmIChpbmRleCA9PT0gbGVuIC0gMSB8fCBpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGluZGV4ICsgMSkpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGAuXFxcXCR7dGFpbH1gO1xuXHRcdFx0XHR9XG5cdFx0XHR9IHdoaWxlICgoaW5kZXggPSBwYXRoLmluZGV4T2YoJzonLCBpbmRleCArIDEpKSAhPT0gLTEpO1xuXHRcdH1cblx0XHRpZiAoZGV2aWNlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiBpc0Fic29sdXRlID8gYFxcXFwke3RhaWx9YCA6IHRhaWw7XG5cdFx0fVxuXHRcdHJldHVybiBpc0Fic29sdXRlID8gYCR7ZGV2aWNlfVxcXFwke3RhaWx9YCA6IGAke2RldmljZX0ke3RhaWx9YDtcblx0fSxcblxuXHRpc0Fic29sdXRlKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHZhbGlkYXRlU3RyaW5nKHBhdGgsICdwYXRoJyk7XG5cdFx0Y29uc3QgbGVuID0gcGF0aC5sZW5ndGg7XG5cdFx0aWYgKGxlbiA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoMCk7XG5cdFx0cmV0dXJuIGlzUGF0aFNlcGFyYXRvcihjb2RlKSB8fFxuXHRcdFx0Ly8gUG9zc2libGUgZGV2aWNlIHJvb3Rcblx0XHRcdChsZW4gPiAyICYmXG5cdFx0XHRcdGlzV2luZG93c0RldmljZVJvb3QoY29kZSkgJiZcblx0XHRcdFx0cGF0aC5jaGFyQ29kZUF0KDEpID09PSBDSEFSX0NPTE9OICYmXG5cdFx0XHRcdGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoMikpKTtcblx0fSxcblxuXHRqb2luKC4uLnBhdGhzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG5cdFx0aWYgKHBhdGhzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuICcuJztcblx0XHR9XG5cblx0XHRsZXQgam9pbmVkO1xuXHRcdGxldCBmaXJzdFBhcnQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHBhdGhzLmxlbmd0aDsgKytpKSB7XG5cdFx0XHRjb25zdCBhcmcgPSBwYXRoc1tpXTtcblx0XHRcdHZhbGlkYXRlU3RyaW5nKGFyZywgJ3BhdGgnKTtcblx0XHRcdGlmIChhcmcubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRpZiAoam9pbmVkID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRqb2luZWQgPSBmaXJzdFBhcnQgPSBhcmc7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0am9pbmVkICs9IGBcXFxcJHthcmd9YDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChqb2luZWQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuICcuJztcblx0XHR9XG5cblx0XHQvLyBNYWtlIHN1cmUgdGhhdCB0aGUgam9pbmVkIHBhdGggZG9lc24ndCBzdGFydCB3aXRoIHR3byBzbGFzaGVzLCBiZWNhdXNlXG5cdFx0Ly8gbm9ybWFsaXplKCkgd2lsbCBtaXN0YWtlIGl0IGZvciBhIFVOQyBwYXRoIHRoZW4uXG5cdFx0Ly9cblx0XHQvLyBUaGlzIHN0ZXAgaXMgc2tpcHBlZCB3aGVuIGl0IGlzIHZlcnkgY2xlYXIgdGhhdCB0aGUgdXNlciBhY3R1YWxseVxuXHRcdC8vIGludGVuZGVkIHRvIHBvaW50IGF0IGEgVU5DIHBhdGguIFRoaXMgaXMgYXNzdW1lZCB3aGVuIHRoZSBmaXJzdFxuXHRcdC8vIG5vbi1lbXB0eSBzdHJpbmcgYXJndW1lbnRzIHN0YXJ0cyB3aXRoIGV4YWN0bHkgdHdvIHNsYXNoZXMgZm9sbG93ZWQgYnlcblx0XHQvLyBhdCBsZWFzdCBvbmUgbW9yZSBub24tc2xhc2ggY2hhcmFjdGVyLlxuXHRcdC8vXG5cdFx0Ly8gTm90ZSB0aGF0IGZvciBub3JtYWxpemUoKSB0byB0cmVhdCBhIHBhdGggYXMgYSBVTkMgcGF0aCBpdCBuZWVkcyB0b1xuXHRcdC8vIGhhdmUgYXQgbGVhc3QgMiBjb21wb25lbnRzLCBzbyB3ZSBkb24ndCBmaWx0ZXIgZm9yIHRoYXQgaGVyZS5cblx0XHQvLyBUaGlzIG1lYW5zIHRoYXQgdGhlIHVzZXIgY2FuIHVzZSBqb2luIHRvIGNvbnN0cnVjdCBVTkMgcGF0aHMgZnJvbVxuXHRcdC8vIGEgc2VydmVyIG5hbWUgYW5kIGEgc2hhcmUgbmFtZTsgZm9yIGV4YW1wbGU6XG5cdFx0Ly8gICBwYXRoLmpvaW4oJy8vc2VydmVyJywgJ3NoYXJlJykgLT4gJ1xcXFxcXFxcc2VydmVyXFxcXHNoYXJlXFxcXCcpXG5cdFx0bGV0IG5lZWRzUmVwbGFjZSA9IHRydWU7XG5cdFx0bGV0IHNsYXNoQ291bnQgPSAwO1xuXHRcdGlmICh0eXBlb2YgZmlyc3RQYXJ0ID09PSAnc3RyaW5nJyAmJiBpc1BhdGhTZXBhcmF0b3IoZmlyc3RQYXJ0LmNoYXJDb2RlQXQoMCkpKSB7XG5cdFx0XHQrK3NsYXNoQ291bnQ7XG5cdFx0XHRjb25zdCBmaXJzdExlbiA9IGZpcnN0UGFydC5sZW5ndGg7XG5cdFx0XHRpZiAoZmlyc3RMZW4gPiAxICYmIGlzUGF0aFNlcGFyYXRvcihmaXJzdFBhcnQuY2hhckNvZGVBdCgxKSkpIHtcblx0XHRcdFx0KytzbGFzaENvdW50O1xuXHRcdFx0XHRpZiAoZmlyc3RMZW4gPiAyKSB7XG5cdFx0XHRcdFx0aWYgKGlzUGF0aFNlcGFyYXRvcihmaXJzdFBhcnQuY2hhckNvZGVBdCgyKSkpIHtcblx0XHRcdFx0XHRcdCsrc2xhc2hDb3VudDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gV2UgbWF0Y2hlZCBhIFVOQyBwYXRoIGluIHRoZSBmaXJzdCBwYXJ0XG5cdFx0XHRcdFx0XHRuZWVkc1JlcGxhY2UgPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKG5lZWRzUmVwbGFjZSkge1xuXHRcdFx0Ly8gRmluZCBhbnkgbW9yZSBjb25zZWN1dGl2ZSBzbGFzaGVzIHdlIG5lZWQgdG8gcmVwbGFjZVxuXHRcdFx0d2hpbGUgKHNsYXNoQ291bnQgPCBqb2luZWQubGVuZ3RoICYmXG5cdFx0XHRcdGlzUGF0aFNlcGFyYXRvcihqb2luZWQuY2hhckNvZGVBdChzbGFzaENvdW50KSkpIHtcblx0XHRcdFx0c2xhc2hDb3VudCsrO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBSZXBsYWNlIHRoZSBzbGFzaGVzIGlmIG5lZWRlZFxuXHRcdFx0aWYgKHNsYXNoQ291bnQgPj0gMikge1xuXHRcdFx0XHRqb2luZWQgPSBgXFxcXCR7am9pbmVkLnNsaWNlKHNsYXNoQ291bnQpfWA7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHdpbjMyLm5vcm1hbGl6ZShqb2luZWQpO1xuXHR9LFxuXG5cblx0Ly8gSXQgd2lsbCBzb2x2ZSB0aGUgcmVsYXRpdmUgcGF0aCBmcm9tIGBmcm9tYCB0byBgdG9gLCBmb3IgaW5zdGFuY2U6XG5cdC8vICBmcm9tID0gJ0M6XFxcXG9yYW5kZWFcXFxcdGVzdFxcXFxhYWEnXG5cdC8vICB0byA9ICdDOlxcXFxvcmFuZGVhXFxcXGltcGxcXFxcYmJiJ1xuXHQvLyBUaGUgb3V0cHV0IG9mIHRoZSBmdW5jdGlvbiBzaG91bGQgYmU6ICcuLlxcXFwuLlxcXFxpbXBsXFxcXGJiYidcblx0cmVsYXRpdmUoZnJvbTogc3RyaW5nLCB0bzogc3RyaW5nKTogc3RyaW5nIHtcblx0XHR2YWxpZGF0ZVN0cmluZyhmcm9tLCAnZnJvbScpO1xuXHRcdHZhbGlkYXRlU3RyaW5nKHRvLCAndG8nKTtcblxuXHRcdGlmIChmcm9tID09PSB0bykge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZyb21PcmlnID0gd2luMzIucmVzb2x2ZShmcm9tKTtcblx0XHRjb25zdCB0b09yaWcgPSB3aW4zMi5yZXNvbHZlKHRvKTtcblxuXHRcdGlmIChmcm9tT3JpZyA9PT0gdG9PcmlnKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXG5cdFx0ZnJvbSA9IGZyb21PcmlnLnRvTG93ZXJDYXNlKCk7XG5cdFx0dG8gPSB0b09yaWcudG9Mb3dlckNhc2UoKTtcblxuXHRcdGlmIChmcm9tID09PSB0bykge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblxuXHRcdGlmIChmcm9tT3JpZy5sZW5ndGggIT09IGZyb20ubGVuZ3RoIHx8IHRvT3JpZy5sZW5ndGggIT09IHRvLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgZnJvbVNwbGl0ID0gZnJvbU9yaWcuc3BsaXQoJ1xcXFwnKTtcblx0XHRcdGNvbnN0IHRvU3BsaXQgPSB0b09yaWcuc3BsaXQoJ1xcXFwnKTtcblx0XHRcdGlmIChmcm9tU3BsaXRbZnJvbVNwbGl0Lmxlbmd0aCAtIDFdID09PSAnJykge1xuXHRcdFx0XHRmcm9tU3BsaXQucG9wKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodG9TcGxpdFt0b1NwbGl0Lmxlbmd0aCAtIDFdID09PSAnJykge1xuXHRcdFx0XHR0b1NwbGl0LnBvcCgpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBmcm9tTGVuID0gZnJvbVNwbGl0Lmxlbmd0aDtcblx0XHRcdGNvbnN0IHRvTGVuID0gdG9TcGxpdC5sZW5ndGg7XG5cdFx0XHRjb25zdCBsZW5ndGggPSBmcm9tTGVuIDwgdG9MZW4gPyBmcm9tTGVuIDogdG9MZW47XG5cblx0XHRcdGxldCBpO1xuXHRcdFx0Zm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmIChmcm9tU3BsaXRbaV0udG9Mb3dlckNhc2UoKSAhPT0gdG9TcGxpdFtpXS50b0xvd2VyQ2FzZSgpKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGkgPT09IDApIHtcblx0XHRcdFx0cmV0dXJuIHRvT3JpZztcblx0XHRcdH0gZWxzZSBpZiAoaSA9PT0gbGVuZ3RoKSB7XG5cdFx0XHRcdGlmICh0b0xlbiA+IGxlbmd0aCkge1xuXHRcdFx0XHRcdHJldHVybiB0b1NwbGl0LnNsaWNlKGkpLmpvaW4oJ1xcXFwnKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZnJvbUxlbiA+IGxlbmd0aCkge1xuXHRcdFx0XHRcdHJldHVybiAnLi5cXFxcJy5yZXBlYXQoZnJvbUxlbiAtIDEgLSBpKSArICcuLic7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gJy4uXFxcXCcucmVwZWF0KGZyb21MZW4gLSBpKSArIHRvU3BsaXQuc2xpY2UoaSkuam9pbignXFxcXCcpO1xuXHRcdH1cblxuXHRcdC8vIFRyaW0gYW55IGxlYWRpbmcgYmFja3NsYXNoZXNcblx0XHRsZXQgZnJvbVN0YXJ0ID0gMDtcblx0XHR3aGlsZSAoZnJvbVN0YXJ0IDwgZnJvbS5sZW5ndGggJiZcblx0XHRcdGZyb20uY2hhckNvZGVBdChmcm9tU3RhcnQpID09PSBDSEFSX0JBQ0tXQVJEX1NMQVNIKSB7XG5cdFx0XHRmcm9tU3RhcnQrKztcblx0XHR9XG5cdFx0Ly8gVHJpbSB0cmFpbGluZyBiYWNrc2xhc2hlcyAoYXBwbGljYWJsZSB0byBVTkMgcGF0aHMgb25seSlcblx0XHRsZXQgZnJvbUVuZCA9IGZyb20ubGVuZ3RoO1xuXHRcdHdoaWxlIChmcm9tRW5kIC0gMSA+IGZyb21TdGFydCAmJlxuXHRcdFx0ZnJvbS5jaGFyQ29kZUF0KGZyb21FbmQgLSAxKSA9PT0gQ0hBUl9CQUNLV0FSRF9TTEFTSCkge1xuXHRcdFx0ZnJvbUVuZC0tO1xuXHRcdH1cblx0XHRjb25zdCBmcm9tTGVuID0gZnJvbUVuZCAtIGZyb21TdGFydDtcblxuXHRcdC8vIFRyaW0gYW55IGxlYWRpbmcgYmFja3NsYXNoZXNcblx0XHRsZXQgdG9TdGFydCA9IDA7XG5cdFx0d2hpbGUgKHRvU3RhcnQgPCB0by5sZW5ndGggJiZcblx0XHRcdHRvLmNoYXJDb2RlQXQodG9TdGFydCkgPT09IENIQVJfQkFDS1dBUkRfU0xBU0gpIHtcblx0XHRcdHRvU3RhcnQrKztcblx0XHR9XG5cdFx0Ly8gVHJpbSB0cmFpbGluZyBiYWNrc2xhc2hlcyAoYXBwbGljYWJsZSB0byBVTkMgcGF0aHMgb25seSlcblx0XHRsZXQgdG9FbmQgPSB0by5sZW5ndGg7XG5cdFx0d2hpbGUgKHRvRW5kIC0gMSA+IHRvU3RhcnQgJiZcblx0XHRcdHRvLmNoYXJDb2RlQXQodG9FbmQgLSAxKSA9PT0gQ0hBUl9CQUNLV0FSRF9TTEFTSCkge1xuXHRcdFx0dG9FbmQtLTtcblx0XHR9XG5cdFx0Y29uc3QgdG9MZW4gPSB0b0VuZCAtIHRvU3RhcnQ7XG5cblx0XHQvLyBDb21wYXJlIHBhdGhzIHRvIGZpbmQgdGhlIGxvbmdlc3QgY29tbW9uIHBhdGggZnJvbSByb290XG5cdFx0Y29uc3QgbGVuZ3RoID0gZnJvbUxlbiA8IHRvTGVuID8gZnJvbUxlbiA6IHRvTGVuO1xuXHRcdGxldCBsYXN0Q29tbW9uU2VwID0gLTE7XG5cdFx0bGV0IGkgPSAwO1xuXHRcdGZvciAoOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGZyb21Db2RlID0gZnJvbS5jaGFyQ29kZUF0KGZyb21TdGFydCArIGkpO1xuXHRcdFx0aWYgKGZyb21Db2RlICE9PSB0by5jaGFyQ29kZUF0KHRvU3RhcnQgKyBpKSkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH0gZWxzZSBpZiAoZnJvbUNvZGUgPT09IENIQVJfQkFDS1dBUkRfU0xBU0gpIHtcblx0XHRcdFx0bGFzdENvbW1vblNlcCA9IGk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gV2UgZm91bmQgYSBtaXNtYXRjaCBiZWZvcmUgdGhlIGZpcnN0IGNvbW1vbiBwYXRoIHNlcGFyYXRvciB3YXMgc2Vlbiwgc29cblx0XHQvLyByZXR1cm4gdGhlIG9yaWdpbmFsIGB0b2AuXG5cdFx0aWYgKGkgIT09IGxlbmd0aCkge1xuXHRcdFx0aWYgKGxhc3RDb21tb25TZXAgPT09IC0xKSB7XG5cdFx0XHRcdHJldHVybiB0b09yaWc7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0b0xlbiA+IGxlbmd0aCkge1xuXHRcdFx0XHRpZiAodG8uY2hhckNvZGVBdCh0b1N0YXJ0ICsgaSkgPT09IENIQVJfQkFDS1dBUkRfU0xBU0gpIHtcblx0XHRcdFx0XHQvLyBXZSBnZXQgaGVyZSBpZiBgZnJvbWAgaXMgdGhlIGV4YWN0IGJhc2UgcGF0aCBmb3IgYHRvYC5cblx0XHRcdFx0XHQvLyBGb3IgZXhhbXBsZTogZnJvbT0nQzpcXFxcZm9vXFxcXGJhcic7IHRvPSdDOlxcXFxmb29cXFxcYmFyXFxcXGJheidcblx0XHRcdFx0XHRyZXR1cm4gdG9PcmlnLnNsaWNlKHRvU3RhcnQgKyBpICsgMSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGkgPT09IDIpIHtcblx0XHRcdFx0XHQvLyBXZSBnZXQgaGVyZSBpZiBgZnJvbWAgaXMgdGhlIGRldmljZSByb290LlxuXHRcdFx0XHRcdC8vIEZvciBleGFtcGxlOiBmcm9tPSdDOlxcXFwnOyB0bz0nQzpcXFxcZm9vJ1xuXHRcdFx0XHRcdHJldHVybiB0b09yaWcuc2xpY2UodG9TdGFydCArIGkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoZnJvbUxlbiA+IGxlbmd0aCkge1xuXHRcdFx0XHRpZiAoZnJvbS5jaGFyQ29kZUF0KGZyb21TdGFydCArIGkpID09PSBDSEFSX0JBQ0tXQVJEX1NMQVNIKSB7XG5cdFx0XHRcdFx0Ly8gV2UgZ2V0IGhlcmUgaWYgYHRvYCBpcyB0aGUgZXhhY3QgYmFzZSBwYXRoIGZvciBgZnJvbWAuXG5cdFx0XHRcdFx0Ly8gRm9yIGV4YW1wbGU6IGZyb209J0M6XFxcXGZvb1xcXFxiYXInOyB0bz0nQzpcXFxcZm9vJ1xuXHRcdFx0XHRcdGxhc3RDb21tb25TZXAgPSBpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGkgPT09IDIpIHtcblx0XHRcdFx0XHQvLyBXZSBnZXQgaGVyZSBpZiBgdG9gIGlzIHRoZSBkZXZpY2Ugcm9vdC5cblx0XHRcdFx0XHQvLyBGb3IgZXhhbXBsZTogZnJvbT0nQzpcXFxcZm9vXFxcXGJhcic7IHRvPSdDOlxcXFwnXG5cdFx0XHRcdFx0bGFzdENvbW1vblNlcCA9IDM7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChsYXN0Q29tbW9uU2VwID09PSAtMSkge1xuXHRcdFx0XHRsYXN0Q29tbW9uU2VwID0gMDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgb3V0ID0gJyc7XG5cdFx0Ly8gR2VuZXJhdGUgdGhlIHJlbGF0aXZlIHBhdGggYmFzZWQgb24gdGhlIHBhdGggZGlmZmVyZW5jZSBiZXR3ZWVuIGB0b2AgYW5kXG5cdFx0Ly8gYGZyb21gXG5cdFx0Zm9yIChpID0gZnJvbVN0YXJ0ICsgbGFzdENvbW1vblNlcCArIDE7IGkgPD0gZnJvbUVuZDsgKytpKSB7XG5cdFx0XHRpZiAoaSA9PT0gZnJvbUVuZCB8fCBmcm9tLmNoYXJDb2RlQXQoaSkgPT09IENIQVJfQkFDS1dBUkRfU0xBU0gpIHtcblx0XHRcdFx0b3V0ICs9IG91dC5sZW5ndGggPT09IDAgPyAnLi4nIDogJ1xcXFwuLic7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dG9TdGFydCArPSBsYXN0Q29tbW9uU2VwO1xuXG5cdFx0Ly8gTGFzdGx5LCBhcHBlbmQgdGhlIHJlc3Qgb2YgdGhlIGRlc3RpbmF0aW9uIChgdG9gKSBwYXRoIHRoYXQgY29tZXMgYWZ0ZXJcblx0XHQvLyB0aGUgY29tbW9uIHBhdGggcGFydHNcblx0XHRpZiAob3V0Lmxlbmd0aCA+IDApIHtcblx0XHRcdHJldHVybiBgJHtvdXR9JHt0b09yaWcuc2xpY2UodG9TdGFydCwgdG9FbmQpfWA7XG5cdFx0fVxuXG5cdFx0aWYgKHRvT3JpZy5jaGFyQ29kZUF0KHRvU3RhcnQpID09PSBDSEFSX0JBQ0tXQVJEX1NMQVNIKSB7XG5cdFx0XHQrK3RvU3RhcnQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRvT3JpZy5zbGljZSh0b1N0YXJ0LCB0b0VuZCk7XG5cdH0sXG5cblx0dG9OYW1lc3BhY2VkUGF0aChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdC8vIE5vdGU6IHRoaXMgd2lsbCAqcHJvYmFibHkqIHRocm93IHNvbWV3aGVyZS5cblx0XHRpZiAodHlwZW9mIHBhdGggIT09ICdzdHJpbmcnIHx8IHBhdGgubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gcGF0aDtcblx0XHR9XG5cblx0XHRjb25zdCByZXNvbHZlZFBhdGggPSB3aW4zMi5yZXNvbHZlKHBhdGgpO1xuXG5cdFx0aWYgKHJlc29sdmVkUGF0aC5sZW5ndGggPD0gMikge1xuXHRcdFx0cmV0dXJuIHBhdGg7XG5cdFx0fVxuXG5cdFx0aWYgKHJlc29sdmVkUGF0aC5jaGFyQ29kZUF0KDApID09PSBDSEFSX0JBQ0tXQVJEX1NMQVNIKSB7XG5cdFx0XHQvLyBQb3NzaWJsZSBVTkMgcm9vdFxuXHRcdFx0aWYgKHJlc29sdmVkUGF0aC5jaGFyQ29kZUF0KDEpID09PSBDSEFSX0JBQ0tXQVJEX1NMQVNIKSB7XG5cdFx0XHRcdGNvbnN0IGNvZGUgPSByZXNvbHZlZFBhdGguY2hhckNvZGVBdCgyKTtcblx0XHRcdFx0aWYgKGNvZGUgIT09IENIQVJfUVVFU1RJT05fTUFSSyAmJiBjb2RlICE9PSBDSEFSX0RPVCkge1xuXHRcdFx0XHRcdC8vIE1hdGNoZWQgbm9uLWxvbmcgVU5DIHJvb3QsIGNvbnZlcnQgdGhlIHBhdGggdG8gYSBsb25nIFVOQyBwYXRoXG5cdFx0XHRcdFx0cmV0dXJuIGBcXFxcXFxcXD9cXFxcVU5DXFxcXCR7cmVzb2x2ZWRQYXRoLnNsaWNlKDIpfWA7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGlzV2luZG93c0RldmljZVJvb3QocmVzb2x2ZWRQYXRoLmNoYXJDb2RlQXQoMCkpICYmXG5cdFx0XHRyZXNvbHZlZFBhdGguY2hhckNvZGVBdCgxKSA9PT0gQ0hBUl9DT0xPTiAmJlxuXHRcdFx0cmVzb2x2ZWRQYXRoLmNoYXJDb2RlQXQoMikgPT09IENIQVJfQkFDS1dBUkRfU0xBU0gpIHtcblx0XHRcdC8vIE1hdGNoZWQgZGV2aWNlIHJvb3QsIGNvbnZlcnQgdGhlIHBhdGggdG8gYSBsb25nIFVOQyBwYXRoXG5cdFx0XHRyZXR1cm4gYFxcXFxcXFxcP1xcXFwke3Jlc29sdmVkUGF0aH1gO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXNvbHZlZFBhdGg7XG5cdH0sXG5cblx0ZGlybmFtZShwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHZhbGlkYXRlU3RyaW5nKHBhdGgsICdwYXRoJyk7XG5cdFx0Y29uc3QgbGVuID0gcGF0aC5sZW5ndGg7XG5cdFx0aWYgKGxlbiA9PT0gMCkge1xuXHRcdFx0cmV0dXJuICcuJztcblx0XHR9XG5cdFx0bGV0IHJvb3RFbmQgPSAtMTtcblx0XHRsZXQgb2Zmc2V0ID0gMDtcblx0XHRjb25zdCBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KDApO1xuXG5cdFx0aWYgKGxlbiA9PT0gMSkge1xuXHRcdFx0Ly8gYHBhdGhgIGNvbnRhaW5zIGp1c3QgYSBwYXRoIHNlcGFyYXRvciwgZXhpdCBlYXJseSB0byBhdm9pZFxuXHRcdFx0Ly8gdW5uZWNlc3Nhcnkgd29yayBvciBhIGRvdC5cblx0XHRcdHJldHVybiBpc1BhdGhTZXBhcmF0b3IoY29kZSkgPyBwYXRoIDogJy4nO1xuXHRcdH1cblxuXHRcdC8vIFRyeSB0byBtYXRjaCBhIHJvb3Rcblx0XHRpZiAoaXNQYXRoU2VwYXJhdG9yKGNvZGUpKSB7XG5cdFx0XHQvLyBQb3NzaWJsZSBVTkMgcm9vdFxuXG5cdFx0XHRyb290RW5kID0gb2Zmc2V0ID0gMTtcblxuXHRcdFx0aWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoMSkpKSB7XG5cdFx0XHRcdC8vIE1hdGNoZWQgZG91YmxlIHBhdGggc2VwYXJhdG9yIGF0IGJlZ2lubmluZ1xuXHRcdFx0XHRsZXQgaiA9IDI7XG5cdFx0XHRcdGxldCBsYXN0ID0gajtcblx0XHRcdFx0Ly8gTWF0Y2ggMSBvciBtb3JlIG5vbi1wYXRoIHNlcGFyYXRvcnNcblx0XHRcdFx0d2hpbGUgKGogPCBsZW4gJiYgIWlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaikpKSB7XG5cdFx0XHRcdFx0aisrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChqIDwgbGVuICYmIGogIT09IGxhc3QpIHtcblx0XHRcdFx0XHQvLyBNYXRjaGVkIVxuXHRcdFx0XHRcdGxhc3QgPSBqO1xuXHRcdFx0XHRcdC8vIE1hdGNoIDEgb3IgbW9yZSBwYXRoIHNlcGFyYXRvcnNcblx0XHRcdFx0XHR3aGlsZSAoaiA8IGxlbiAmJiBpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGopKSkge1xuXHRcdFx0XHRcdFx0aisrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoaiA8IGxlbiAmJiBqICE9PSBsYXN0KSB7XG5cdFx0XHRcdFx0XHQvLyBNYXRjaGVkIVxuXHRcdFx0XHRcdFx0bGFzdCA9IGo7XG5cdFx0XHRcdFx0XHQvLyBNYXRjaCAxIG9yIG1vcmUgbm9uLXBhdGggc2VwYXJhdG9yc1xuXHRcdFx0XHRcdFx0d2hpbGUgKGogPCBsZW4gJiYgIWlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaikpKSB7XG5cdFx0XHRcdFx0XHRcdGorKztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChqID09PSBsZW4pIHtcblx0XHRcdFx0XHRcdFx0Ly8gV2UgbWF0Y2hlZCBhIFVOQyByb290IG9ubHlcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHBhdGg7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoaiAhPT0gbGFzdCkge1xuXHRcdFx0XHRcdFx0XHQvLyBXZSBtYXRjaGVkIGEgVU5DIHJvb3Qgd2l0aCBsZWZ0b3ZlcnNcblxuXHRcdFx0XHRcdFx0XHQvLyBPZmZzZXQgYnkgMSB0byBpbmNsdWRlIHRoZSBzZXBhcmF0b3IgYWZ0ZXIgdGhlIFVOQyByb290IHRvXG5cdFx0XHRcdFx0XHRcdC8vIHRyZWF0IGl0IGFzIGEgXCJub3JtYWwgcm9vdFwiIG9uIHRvcCBvZiBhIChVTkMpIHJvb3Rcblx0XHRcdFx0XHRcdFx0cm9vdEVuZCA9IG9mZnNldCA9IGogKyAxO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Ly8gUG9zc2libGUgZGV2aWNlIHJvb3Rcblx0XHR9IGVsc2UgaWYgKGlzV2luZG93c0RldmljZVJvb3QoY29kZSkgJiYgcGF0aC5jaGFyQ29kZUF0KDEpID09PSBDSEFSX0NPTE9OKSB7XG5cdFx0XHRyb290RW5kID0gbGVuID4gMiAmJiBpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KDIpKSA/IDMgOiAyO1xuXHRcdFx0b2Zmc2V0ID0gcm9vdEVuZDtcblx0XHR9XG5cblx0XHRsZXQgZW5kID0gLTE7XG5cdFx0bGV0IG1hdGNoZWRTbGFzaCA9IHRydWU7XG5cdFx0Zm9yIChsZXQgaSA9IGxlbiAtIDE7IGkgPj0gb2Zmc2V0OyAtLWkpIHtcblx0XHRcdGlmIChpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGkpKSkge1xuXHRcdFx0XHRpZiAoIW1hdGNoZWRTbGFzaCkge1xuXHRcdFx0XHRcdGVuZCA9IGk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yXG5cdFx0XHRcdG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChlbmQgPT09IC0xKSB7XG5cdFx0XHRpZiAocm9vdEVuZCA9PT0gLTEpIHtcblx0XHRcdFx0cmV0dXJuICcuJztcblx0XHRcdH1cblxuXHRcdFx0ZW5kID0gcm9vdEVuZDtcblx0XHR9XG5cdFx0cmV0dXJuIHBhdGguc2xpY2UoMCwgZW5kKTtcblx0fSxcblxuXHRiYXNlbmFtZShwYXRoOiBzdHJpbmcsIHN1ZmZpeD86IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0aWYgKHN1ZmZpeCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR2YWxpZGF0ZVN0cmluZyhzdWZmaXgsICdzdWZmaXgnKTtcblx0XHR9XG5cdFx0dmFsaWRhdGVTdHJpbmcocGF0aCwgJ3BhdGgnKTtcblx0XHRsZXQgc3RhcnQgPSAwO1xuXHRcdGxldCBlbmQgPSAtMTtcblx0XHRsZXQgbWF0Y2hlZFNsYXNoID0gdHJ1ZTtcblx0XHRsZXQgaTtcblxuXHRcdC8vIENoZWNrIGZvciBhIGRyaXZlIGxldHRlciBwcmVmaXggc28gYXMgbm90IHRvIG1pc3Rha2UgdGhlIGZvbGxvd2luZ1xuXHRcdC8vIHBhdGggc2VwYXJhdG9yIGFzIGFuIGV4dHJhIHNlcGFyYXRvciBhdCB0aGUgZW5kIG9mIHRoZSBwYXRoIHRoYXQgY2FuIGJlXG5cdFx0Ly8gZGlzcmVnYXJkZWRcblx0XHRpZiAocGF0aC5sZW5ndGggPj0gMiAmJlxuXHRcdFx0aXNXaW5kb3dzRGV2aWNlUm9vdChwYXRoLmNoYXJDb2RlQXQoMCkpICYmXG5cdFx0XHRwYXRoLmNoYXJDb2RlQXQoMSkgPT09IENIQVJfQ09MT04pIHtcblx0XHRcdHN0YXJ0ID0gMjtcblx0XHR9XG5cblx0XHRpZiAoc3VmZml4ICE9PSB1bmRlZmluZWQgJiYgc3VmZml4Lmxlbmd0aCA+IDAgJiYgc3VmZml4Lmxlbmd0aCA8PSBwYXRoLmxlbmd0aCkge1xuXHRcdFx0aWYgKHN1ZmZpeCA9PT0gcGF0aCkge1xuXHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHR9XG5cdFx0XHRsZXQgZXh0SWR4ID0gc3VmZml4Lmxlbmd0aCAtIDE7XG5cdFx0XHRsZXQgZmlyc3ROb25TbGFzaEVuZCA9IC0xO1xuXHRcdFx0Zm9yIChpID0gcGF0aC5sZW5ndGggLSAxOyBpID49IHN0YXJ0OyAtLWkpIHtcblx0XHRcdFx0Y29uc3QgY29kZSA9IHBhdGguY2hhckNvZGVBdChpKTtcblx0XHRcdFx0aWYgKGlzUGF0aFNlcGFyYXRvcihjb2RlKSkge1xuXHRcdFx0XHRcdC8vIElmIHdlIHJlYWNoZWQgYSBwYXRoIHNlcGFyYXRvciB0aGF0IHdhcyBub3QgcGFydCBvZiBhIHNldCBvZiBwYXRoXG5cdFx0XHRcdFx0Ly8gc2VwYXJhdG9ycyBhdCB0aGUgZW5kIG9mIHRoZSBzdHJpbmcsIHN0b3Agbm93XG5cdFx0XHRcdFx0aWYgKCFtYXRjaGVkU2xhc2gpIHtcblx0XHRcdFx0XHRcdHN0YXJ0ID0gaSArIDE7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKGZpcnN0Tm9uU2xhc2hFbmQgPT09IC0xKSB7XG5cdFx0XHRcdFx0XHQvLyBXZSBzYXcgdGhlIGZpcnN0IG5vbi1wYXRoIHNlcGFyYXRvciwgcmVtZW1iZXIgdGhpcyBpbmRleCBpbiBjYXNlXG5cdFx0XHRcdFx0XHQvLyB3ZSBuZWVkIGl0IGlmIHRoZSBleHRlbnNpb24gZW5kcyB1cCBub3QgbWF0Y2hpbmdcblx0XHRcdFx0XHRcdG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0Zmlyc3ROb25TbGFzaEVuZCA9IGkgKyAxO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoZXh0SWR4ID49IDApIHtcblx0XHRcdFx0XHRcdC8vIFRyeSB0byBtYXRjaCB0aGUgZXhwbGljaXQgZXh0ZW5zaW9uXG5cdFx0XHRcdFx0XHRpZiAoY29kZSA9PT0gc3VmZml4LmNoYXJDb2RlQXQoZXh0SWR4KSkge1xuXHRcdFx0XHRcdFx0XHRpZiAoLS1leHRJZHggPT09IC0xKSB7XG5cdFx0XHRcdFx0XHRcdFx0Ly8gV2UgbWF0Y2hlZCB0aGUgZXh0ZW5zaW9uLCBzbyBtYXJrIHRoaXMgYXMgdGhlIGVuZCBvZiBvdXIgcGF0aFxuXHRcdFx0XHRcdFx0XHRcdC8vIGNvbXBvbmVudFxuXHRcdFx0XHRcdFx0XHRcdGVuZCA9IGk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdC8vIEV4dGVuc2lvbiBkb2VzIG5vdCBtYXRjaCwgc28gb3VyIHJlc3VsdCBpcyB0aGUgZW50aXJlIHBhdGhcblx0XHRcdFx0XHRcdFx0Ly8gY29tcG9uZW50XG5cdFx0XHRcdFx0XHRcdGV4dElkeCA9IC0xO1xuXHRcdFx0XHRcdFx0XHRlbmQgPSBmaXJzdE5vblNsYXNoRW5kO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc3RhcnQgPT09IGVuZCkge1xuXHRcdFx0XHRlbmQgPSBmaXJzdE5vblNsYXNoRW5kO1xuXHRcdFx0fSBlbHNlIGlmIChlbmQgPT09IC0xKSB7XG5cdFx0XHRcdGVuZCA9IHBhdGgubGVuZ3RoO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHBhdGguc2xpY2Uoc3RhcnQsIGVuZCk7XG5cdFx0fVxuXHRcdGZvciAoaSA9IHBhdGgubGVuZ3RoIC0gMTsgaSA+PSBzdGFydDsgLS1pKSB7XG5cdFx0XHRpZiAoaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdChpKSkpIHtcblx0XHRcdFx0Ly8gSWYgd2UgcmVhY2hlZCBhIHBhdGggc2VwYXJhdG9yIHRoYXQgd2FzIG5vdCBwYXJ0IG9mIGEgc2V0IG9mIHBhdGhcblx0XHRcdFx0Ly8gc2VwYXJhdG9ycyBhdCB0aGUgZW5kIG9mIHRoZSBzdHJpbmcsIHN0b3Agbm93XG5cdFx0XHRcdGlmICghbWF0Y2hlZFNsYXNoKSB7XG5cdFx0XHRcdFx0c3RhcnQgPSBpICsgMTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChlbmQgPT09IC0xKSB7XG5cdFx0XHRcdC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCBtYXJrIHRoaXMgYXMgdGhlIGVuZCBvZiBvdXJcblx0XHRcdFx0Ly8gcGF0aCBjb21wb25lbnRcblx0XHRcdFx0bWF0Y2hlZFNsYXNoID0gZmFsc2U7XG5cdFx0XHRcdGVuZCA9IGkgKyAxO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChlbmQgPT09IC0xKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXHRcdHJldHVybiBwYXRoLnNsaWNlKHN0YXJ0LCBlbmQpO1xuXHR9LFxuXG5cdGV4dG5hbWUocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHR2YWxpZGF0ZVN0cmluZyhwYXRoLCAncGF0aCcpO1xuXHRcdGxldCBzdGFydCA9IDA7XG5cdFx0bGV0IHN0YXJ0RG90ID0gLTE7XG5cdFx0bGV0IHN0YXJ0UGFydCA9IDA7XG5cdFx0bGV0IGVuZCA9IC0xO1xuXHRcdGxldCBtYXRjaGVkU2xhc2ggPSB0cnVlO1xuXHRcdC8vIFRyYWNrIHRoZSBzdGF0ZSBvZiBjaGFyYWN0ZXJzIChpZiBhbnkpIHdlIHNlZSBiZWZvcmUgb3VyIGZpcnN0IGRvdCBhbmRcblx0XHQvLyBhZnRlciBhbnkgcGF0aCBzZXBhcmF0b3Igd2UgZmluZFxuXHRcdGxldCBwcmVEb3RTdGF0ZSA9IDA7XG5cblx0XHQvLyBDaGVjayBmb3IgYSBkcml2ZSBsZXR0ZXIgcHJlZml4IHNvIGFzIG5vdCB0byBtaXN0YWtlIHRoZSBmb2xsb3dpbmdcblx0XHQvLyBwYXRoIHNlcGFyYXRvciBhcyBhbiBleHRyYSBzZXBhcmF0b3IgYXQgdGhlIGVuZCBvZiB0aGUgcGF0aCB0aGF0IGNhbiBiZVxuXHRcdC8vIGRpc3JlZ2FyZGVkXG5cblx0XHRpZiAocGF0aC5sZW5ndGggPj0gMiAmJlxuXHRcdFx0cGF0aC5jaGFyQ29kZUF0KDEpID09PSBDSEFSX0NPTE9OICYmXG5cdFx0XHRpc1dpbmRvd3NEZXZpY2VSb290KHBhdGguY2hhckNvZGVBdCgwKSkpIHtcblx0XHRcdHN0YXJ0ID0gc3RhcnRQYXJ0ID0gMjtcblx0XHR9XG5cblx0XHRmb3IgKGxldCBpID0gcGF0aC5sZW5ndGggLSAxOyBpID49IHN0YXJ0OyAtLWkpIHtcblx0XHRcdGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoaSk7XG5cdFx0XHRpZiAoaXNQYXRoU2VwYXJhdG9yKGNvZGUpKSB7XG5cdFx0XHRcdC8vIElmIHdlIHJlYWNoZWQgYSBwYXRoIHNlcGFyYXRvciB0aGF0IHdhcyBub3QgcGFydCBvZiBhIHNldCBvZiBwYXRoXG5cdFx0XHRcdC8vIHNlcGFyYXRvcnMgYXQgdGhlIGVuZCBvZiB0aGUgc3RyaW5nLCBzdG9wIG5vd1xuXHRcdFx0XHRpZiAoIW1hdGNoZWRTbGFzaCkge1xuXHRcdFx0XHRcdHN0YXJ0UGFydCA9IGkgKyAxO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGVuZCA9PT0gLTEpIHtcblx0XHRcdFx0Ly8gV2Ugc2F3IHRoZSBmaXJzdCBub24tcGF0aCBzZXBhcmF0b3IsIG1hcmsgdGhpcyBhcyB0aGUgZW5kIG9mIG91clxuXHRcdFx0XHQvLyBleHRlbnNpb25cblx0XHRcdFx0bWF0Y2hlZFNsYXNoID0gZmFsc2U7XG5cdFx0XHRcdGVuZCA9IGkgKyAxO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGNvZGUgPT09IENIQVJfRE9UKSB7XG5cdFx0XHRcdC8vIElmIHRoaXMgaXMgb3VyIGZpcnN0IGRvdCwgbWFyayBpdCBhcyB0aGUgc3RhcnQgb2Ygb3VyIGV4dGVuc2lvblxuXHRcdFx0XHRpZiAoc3RhcnREb3QgPT09IC0xKSB7XG5cdFx0XHRcdFx0c3RhcnREb3QgPSBpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKHByZURvdFN0YXRlICE9PSAxKSB7XG5cdFx0XHRcdFx0cHJlRG90U3RhdGUgPSAxO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHN0YXJ0RG90ICE9PSAtMSkge1xuXHRcdFx0XHQvLyBXZSBzYXcgYSBub24tZG90IGFuZCBub24tcGF0aCBzZXBhcmF0b3IgYmVmb3JlIG91ciBkb3QsIHNvIHdlIHNob3VsZFxuXHRcdFx0XHQvLyBoYXZlIGEgZ29vZCBjaGFuY2UgYXQgaGF2aW5nIGEgbm9uLWVtcHR5IGV4dGVuc2lvblxuXHRcdFx0XHRwcmVEb3RTdGF0ZSA9IC0xO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChzdGFydERvdCA9PT0gLTEgfHxcblx0XHRcdGVuZCA9PT0gLTEgfHxcblx0XHRcdC8vIFdlIHNhdyBhIG5vbi1kb3QgY2hhcmFjdGVyIGltbWVkaWF0ZWx5IGJlZm9yZSB0aGUgZG90XG5cdFx0XHRwcmVEb3RTdGF0ZSA9PT0gMCB8fFxuXHRcdFx0Ly8gVGhlIChyaWdodC1tb3N0KSB0cmltbWVkIHBhdGggY29tcG9uZW50IGlzIGV4YWN0bHkgJy4uJ1xuXHRcdFx0KHByZURvdFN0YXRlID09PSAxICYmXG5cdFx0XHRcdHN0YXJ0RG90ID09PSBlbmQgLSAxICYmXG5cdFx0XHRcdHN0YXJ0RG90ID09PSBzdGFydFBhcnQgKyAxKSkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0XHRyZXR1cm4gcGF0aC5zbGljZShzdGFydERvdCwgZW5kKTtcblx0fSxcblxuXHRmb3JtYXQ6IF9mb3JtYXQuYmluZChudWxsLCAnXFxcXCcpLFxuXG5cdHBhcnNlKHBhdGgpIHtcblx0XHR2YWxpZGF0ZVN0cmluZyhwYXRoLCAncGF0aCcpO1xuXG5cdFx0Y29uc3QgcmV0ID0geyByb290OiAnJywgZGlyOiAnJywgYmFzZTogJycsIGV4dDogJycsIG5hbWU6ICcnIH07XG5cdFx0aWYgKHBhdGgubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gcmV0O1xuXHRcdH1cblxuXHRcdGNvbnN0IGxlbiA9IHBhdGgubGVuZ3RoO1xuXHRcdGxldCByb290RW5kID0gMDtcblx0XHRsZXQgY29kZSA9IHBhdGguY2hhckNvZGVBdCgwKTtcblxuXHRcdGlmIChsZW4gPT09IDEpIHtcblx0XHRcdGlmIChpc1BhdGhTZXBhcmF0b3IoY29kZSkpIHtcblx0XHRcdFx0Ly8gYHBhdGhgIGNvbnRhaW5zIGp1c3QgYSBwYXRoIHNlcGFyYXRvciwgZXhpdCBlYXJseSB0byBhdm9pZFxuXHRcdFx0XHQvLyB1bm5lY2Vzc2FyeSB3b3JrXG5cdFx0XHRcdHJldC5yb290ID0gcmV0LmRpciA9IHBhdGg7XG5cdFx0XHRcdHJldHVybiByZXQ7XG5cdFx0XHR9XG5cdFx0XHRyZXQuYmFzZSA9IHJldC5uYW1lID0gcGF0aDtcblx0XHRcdHJldHVybiByZXQ7XG5cdFx0fVxuXHRcdC8vIFRyeSB0byBtYXRjaCBhIHJvb3Rcblx0XHRpZiAoaXNQYXRoU2VwYXJhdG9yKGNvZGUpKSB7XG5cdFx0XHQvLyBQb3NzaWJsZSBVTkMgcm9vdFxuXG5cdFx0XHRyb290RW5kID0gMTtcblx0XHRcdGlmIChpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KDEpKSkge1xuXHRcdFx0XHQvLyBNYXRjaGVkIGRvdWJsZSBwYXRoIHNlcGFyYXRvciBhdCBiZWdpbm5pbmdcblx0XHRcdFx0bGV0IGogPSAyO1xuXHRcdFx0XHRsZXQgbGFzdCA9IGo7XG5cdFx0XHRcdC8vIE1hdGNoIDEgb3IgbW9yZSBub24tcGF0aCBzZXBhcmF0b3JzXG5cdFx0XHRcdHdoaWxlIChqIDwgbGVuICYmICFpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGopKSkge1xuXHRcdFx0XHRcdGorKztcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoaiA8IGxlbiAmJiBqICE9PSBsYXN0KSB7XG5cdFx0XHRcdFx0Ly8gTWF0Y2hlZCFcblx0XHRcdFx0XHRsYXN0ID0gajtcblx0XHRcdFx0XHQvLyBNYXRjaCAxIG9yIG1vcmUgcGF0aCBzZXBhcmF0b3JzXG5cdFx0XHRcdFx0d2hpbGUgKGogPCBsZW4gJiYgaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdChqKSkpIHtcblx0XHRcdFx0XHRcdGorKztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGogPCBsZW4gJiYgaiAhPT0gbGFzdCkge1xuXHRcdFx0XHRcdFx0Ly8gTWF0Y2hlZCFcblx0XHRcdFx0XHRcdGxhc3QgPSBqO1xuXHRcdFx0XHRcdFx0Ly8gTWF0Y2ggMSBvciBtb3JlIG5vbi1wYXRoIHNlcGFyYXRvcnNcblx0XHRcdFx0XHRcdHdoaWxlIChqIDwgbGVuICYmICFpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGopKSkge1xuXHRcdFx0XHRcdFx0XHRqKys7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoaiA9PT0gbGVuKSB7XG5cdFx0XHRcdFx0XHRcdC8vIFdlIG1hdGNoZWQgYSBVTkMgcm9vdCBvbmx5XG5cdFx0XHRcdFx0XHRcdHJvb3RFbmQgPSBqO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChqICE9PSBsYXN0KSB7XG5cdFx0XHRcdFx0XHRcdC8vIFdlIG1hdGNoZWQgYSBVTkMgcm9vdCB3aXRoIGxlZnRvdmVyc1xuXHRcdFx0XHRcdFx0XHRyb290RW5kID0gaiArIDE7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChpc1dpbmRvd3NEZXZpY2VSb290KGNvZGUpICYmIHBhdGguY2hhckNvZGVBdCgxKSA9PT0gQ0hBUl9DT0xPTikge1xuXHRcdFx0Ly8gUG9zc2libGUgZGV2aWNlIHJvb3Rcblx0XHRcdGlmIChsZW4gPD0gMikge1xuXHRcdFx0XHQvLyBgcGF0aGAgY29udGFpbnMganVzdCBhIGRyaXZlIHJvb3QsIGV4aXQgZWFybHkgdG8gYXZvaWRcblx0XHRcdFx0Ly8gdW5uZWNlc3Nhcnkgd29ya1xuXHRcdFx0XHRyZXQucm9vdCA9IHJldC5kaXIgPSBwYXRoO1xuXHRcdFx0XHRyZXR1cm4gcmV0O1xuXHRcdFx0fVxuXHRcdFx0cm9vdEVuZCA9IDI7XG5cdFx0XHRpZiAoaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdCgyKSkpIHtcblx0XHRcdFx0aWYgKGxlbiA9PT0gMykge1xuXHRcdFx0XHRcdC8vIGBwYXRoYCBjb250YWlucyBqdXN0IGEgZHJpdmUgcm9vdCwgZXhpdCBlYXJseSB0byBhdm9pZFxuXHRcdFx0XHRcdC8vIHVubmVjZXNzYXJ5IHdvcmtcblx0XHRcdFx0XHRyZXQucm9vdCA9IHJldC5kaXIgPSBwYXRoO1xuXHRcdFx0XHRcdHJldHVybiByZXQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0cm9vdEVuZCA9IDM7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChyb290RW5kID4gMCkge1xuXHRcdFx0cmV0LnJvb3QgPSBwYXRoLnNsaWNlKDAsIHJvb3RFbmQpO1xuXHRcdH1cblxuXHRcdGxldCBzdGFydERvdCA9IC0xO1xuXHRcdGxldCBzdGFydFBhcnQgPSByb290RW5kO1xuXHRcdGxldCBlbmQgPSAtMTtcblx0XHRsZXQgbWF0Y2hlZFNsYXNoID0gdHJ1ZTtcblx0XHRsZXQgaSA9IHBhdGgubGVuZ3RoIC0gMTtcblxuXHRcdC8vIFRyYWNrIHRoZSBzdGF0ZSBvZiBjaGFyYWN0ZXJzIChpZiBhbnkpIHdlIHNlZSBiZWZvcmUgb3VyIGZpcnN0IGRvdCBhbmRcblx0XHQvLyBhZnRlciBhbnkgcGF0aCBzZXBhcmF0b3Igd2UgZmluZFxuXHRcdGxldCBwcmVEb3RTdGF0ZSA9IDA7XG5cblx0XHQvLyBHZXQgbm9uLWRpciBpbmZvXG5cdFx0Zm9yICg7IGkgPj0gcm9vdEVuZDsgLS1pKSB7XG5cdFx0XHRjb2RlID0gcGF0aC5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0aWYgKGlzUGF0aFNlcGFyYXRvcihjb2RlKSkge1xuXHRcdFx0XHQvLyBJZiB3ZSByZWFjaGVkIGEgcGF0aCBzZXBhcmF0b3IgdGhhdCB3YXMgbm90IHBhcnQgb2YgYSBzZXQgb2YgcGF0aFxuXHRcdFx0XHQvLyBzZXBhcmF0b3JzIGF0IHRoZSBlbmQgb2YgdGhlIHN0cmluZywgc3RvcCBub3dcblx0XHRcdFx0aWYgKCFtYXRjaGVkU2xhc2gpIHtcblx0XHRcdFx0XHRzdGFydFBhcnQgPSBpICsgMTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGlmIChlbmQgPT09IC0xKSB7XG5cdFx0XHRcdC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCBtYXJrIHRoaXMgYXMgdGhlIGVuZCBvZiBvdXJcblx0XHRcdFx0Ly8gZXh0ZW5zaW9uXG5cdFx0XHRcdG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuXHRcdFx0XHRlbmQgPSBpICsgMTtcblx0XHRcdH1cblx0XHRcdGlmIChjb2RlID09PSBDSEFSX0RPVCkge1xuXHRcdFx0XHQvLyBJZiB0aGlzIGlzIG91ciBmaXJzdCBkb3QsIG1hcmsgaXQgYXMgdGhlIHN0YXJ0IG9mIG91ciBleHRlbnNpb25cblx0XHRcdFx0aWYgKHN0YXJ0RG90ID09PSAtMSkge1xuXHRcdFx0XHRcdHN0YXJ0RG90ID0gaTtcblx0XHRcdFx0fSBlbHNlIGlmIChwcmVEb3RTdGF0ZSAhPT0gMSkge1xuXHRcdFx0XHRcdHByZURvdFN0YXRlID0gMTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChzdGFydERvdCAhPT0gLTEpIHtcblx0XHRcdFx0Ly8gV2Ugc2F3IGEgbm9uLWRvdCBhbmQgbm9uLXBhdGggc2VwYXJhdG9yIGJlZm9yZSBvdXIgZG90LCBzbyB3ZSBzaG91bGRcblx0XHRcdFx0Ly8gaGF2ZSBhIGdvb2QgY2hhbmNlIGF0IGhhdmluZyBhIG5vbi1lbXB0eSBleHRlbnNpb25cblx0XHRcdFx0cHJlRG90U3RhdGUgPSAtMTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZW5kICE9PSAtMSkge1xuXHRcdFx0aWYgKHN0YXJ0RG90ID09PSAtMSB8fFxuXHRcdFx0XHQvLyBXZSBzYXcgYSBub24tZG90IGNoYXJhY3RlciBpbW1lZGlhdGVseSBiZWZvcmUgdGhlIGRvdFxuXHRcdFx0XHRwcmVEb3RTdGF0ZSA9PT0gMCB8fFxuXHRcdFx0XHQvLyBUaGUgKHJpZ2h0LW1vc3QpIHRyaW1tZWQgcGF0aCBjb21wb25lbnQgaXMgZXhhY3RseSAnLi4nXG5cdFx0XHRcdChwcmVEb3RTdGF0ZSA9PT0gMSAmJlxuXHRcdFx0XHRcdHN0YXJ0RG90ID09PSBlbmQgLSAxICYmXG5cdFx0XHRcdFx0c3RhcnREb3QgPT09IHN0YXJ0UGFydCArIDEpKSB7XG5cdFx0XHRcdHJldC5iYXNlID0gcmV0Lm5hbWUgPSBwYXRoLnNsaWNlKHN0YXJ0UGFydCwgZW5kKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldC5uYW1lID0gcGF0aC5zbGljZShzdGFydFBhcnQsIHN0YXJ0RG90KTtcblx0XHRcdFx0cmV0LmJhc2UgPSBwYXRoLnNsaWNlKHN0YXJ0UGFydCwgZW5kKTtcblx0XHRcdFx0cmV0LmV4dCA9IHBhdGguc2xpY2Uoc3RhcnREb3QsIGVuZCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlIGRpcmVjdG9yeSBpcyB0aGUgcm9vdCwgdXNlIHRoZSBlbnRpcmUgcm9vdCBhcyB0aGUgYGRpcmAgaW5jbHVkaW5nXG5cdFx0Ly8gdGhlIHRyYWlsaW5nIHNsYXNoIGlmIGFueSAoYEM6XFxhYmNgIC0+IGBDOlxcYCkuIE90aGVyd2lzZSwgc3RyaXAgb3V0IHRoZVxuXHRcdC8vIHRyYWlsaW5nIHNsYXNoIChgQzpcXGFiY1xcZGVmYCAtPiBgQzpcXGFiY2ApLlxuXHRcdGlmIChzdGFydFBhcnQgPiAwICYmIHN0YXJ0UGFydCAhPT0gcm9vdEVuZCkge1xuXHRcdFx0cmV0LmRpciA9IHBhdGguc2xpY2UoMCwgc3RhcnRQYXJ0IC0gMSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldC5kaXIgPSByZXQucm9vdDtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmV0O1xuXHR9LFxuXG5cdHNlcDogJ1xcXFwnLFxuXHRkZWxpbWl0ZXI6ICc7Jyxcblx0d2luMzI6IG51bGwsXG5cdHBvc2l4OiBudWxsXG59O1xuXG5jb25zdCBwb3NpeEN3ZCA9ICgoKSA9PiB7XG5cdGlmIChwbGF0Zm9ybUlzV2luMzIpIHtcblx0XHQvLyBDb252ZXJ0cyBXaW5kb3dzJyBiYWNrc2xhc2ggcGF0aCBzZXBhcmF0b3JzIHRvIFBPU0lYIGZvcndhcmQgc2xhc2hlc1xuXHRcdC8vIGFuZCB0cnVuY2F0ZXMgYW55IGRyaXZlIGluZGljYXRvclxuXHRcdGNvbnN0IHJlZ2V4cCA9IC9cXFxcL2c7XG5cdFx0cmV0dXJuICgpID0+IHtcblx0XHRcdGNvbnN0IGN3ZCA9IHByb2Nlc3MuY3dkKCkucmVwbGFjZShyZWdleHAsICcvJyk7XG5cdFx0XHRyZXR1cm4gY3dkLnNsaWNlKGN3ZC5pbmRleE9mKCcvJykpO1xuXHRcdH07XG5cdH1cblxuXHQvLyBXZSdyZSBhbHJlYWR5IG9uIFBPU0lYLCBubyBuZWVkIGZvciBhbnkgdHJhbnNmb3JtYXRpb25zXG5cdHJldHVybiAoKSA9PiBwcm9jZXNzLmN3ZCgpO1xufSkoKTtcblxuZXhwb3J0IGNvbnN0IHBvc2l4OiBJUGF0aCA9IHtcblx0Ly8gcGF0aC5yZXNvbHZlKFtmcm9tIC4uLl0sIHRvKVxuXHRyZXNvbHZlKC4uLnBhdGhTZWdtZW50czogc3RyaW5nW10pOiBzdHJpbmcge1xuXHRcdGxldCByZXNvbHZlZFBhdGggPSAnJztcblx0XHRsZXQgcmVzb2x2ZWRBYnNvbHV0ZSA9IGZhbHNlO1xuXG5cdFx0Zm9yIChsZXQgaSA9IHBhdGhTZWdtZW50cy5sZW5ndGggLSAxOyBpID49IDAgJiYgIXJlc29sdmVkQWJzb2x1dGU7IGktLSkge1xuXHRcdFx0Y29uc3QgcGF0aCA9IHBhdGhTZWdtZW50c1tpXTtcblx0XHRcdHZhbGlkYXRlU3RyaW5nKHBhdGgsIGBwYXRoc1ske2l9XWApO1xuXG5cdFx0XHQvLyBTa2lwIGVtcHR5IGVudHJpZXNcblx0XHRcdGlmIChwYXRoLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0cmVzb2x2ZWRQYXRoID0gYCR7cGF0aH0vJHtyZXNvbHZlZFBhdGh9YDtcblx0XHRcdHJlc29sdmVkQWJzb2x1dGUgPSBwYXRoLmNoYXJDb2RlQXQoMCkgPT09IENIQVJfRk9SV0FSRF9TTEFTSDtcblx0XHR9XG5cblx0XHRpZiAoIXJlc29sdmVkQWJzb2x1dGUpIHtcblx0XHRcdGNvbnN0IGN3ZCA9IHBvc2l4Q3dkKCk7XG5cdFx0XHRyZXNvbHZlZFBhdGggPSBgJHtjd2R9LyR7cmVzb2x2ZWRQYXRofWA7XG5cdFx0XHRyZXNvbHZlZEFic29sdXRlID1cblx0XHRcdFx0Y3dkLmNoYXJDb2RlQXQoMCkgPT09IENIQVJfRk9SV0FSRF9TTEFTSDtcblx0XHR9XG5cblx0XHQvLyBBdCB0aGlzIHBvaW50IHRoZSBwYXRoIHNob3VsZCBiZSByZXNvbHZlZCB0byBhIGZ1bGwgYWJzb2x1dGUgcGF0aCwgYnV0XG5cdFx0Ly8gaGFuZGxlIHJlbGF0aXZlIHBhdGhzIHRvIGJlIHNhZmUgKG1pZ2h0IGhhcHBlbiB3aGVuIHByb2Nlc3MuY3dkKCkgZmFpbHMpXG5cblx0XHQvLyBOb3JtYWxpemUgdGhlIHBhdGhcblx0XHRyZXNvbHZlZFBhdGggPSBub3JtYWxpemVTdHJpbmcocmVzb2x2ZWRQYXRoLCAhcmVzb2x2ZWRBYnNvbHV0ZSwgJy8nLFxuXHRcdFx0aXNQb3NpeFBhdGhTZXBhcmF0b3IpO1xuXG5cdFx0aWYgKHJlc29sdmVkQWJzb2x1dGUpIHtcblx0XHRcdHJldHVybiBgLyR7cmVzb2x2ZWRQYXRofWA7XG5cdFx0fVxuXHRcdHJldHVybiByZXNvbHZlZFBhdGgubGVuZ3RoID4gMCA/IHJlc29sdmVkUGF0aCA6ICcuJztcblx0fSxcblxuXHRub3JtYWxpemUocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHR2YWxpZGF0ZVN0cmluZyhwYXRoLCAncGF0aCcpO1xuXG5cdFx0aWYgKHBhdGgubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gJy4nO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlzQWJzb2x1dGUgPSBwYXRoLmNoYXJDb2RlQXQoMCkgPT09IENIQVJfRk9SV0FSRF9TTEFTSDtcblx0XHRjb25zdCB0cmFpbGluZ1NlcGFyYXRvciA9XG5cdFx0XHRwYXRoLmNoYXJDb2RlQXQocGF0aC5sZW5ndGggLSAxKSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIO1xuXG5cdFx0Ly8gTm9ybWFsaXplIHRoZSBwYXRoXG5cdFx0cGF0aCA9IG5vcm1hbGl6ZVN0cmluZyhwYXRoLCAhaXNBYnNvbHV0ZSwgJy8nLCBpc1Bvc2l4UGF0aFNlcGFyYXRvcik7XG5cblx0XHRpZiAocGF0aC5sZW5ndGggPT09IDApIHtcblx0XHRcdGlmIChpc0Fic29sdXRlKSB7XG5cdFx0XHRcdHJldHVybiAnLyc7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJhaWxpbmdTZXBhcmF0b3IgPyAnLi8nIDogJy4nO1xuXHRcdH1cblx0XHRpZiAodHJhaWxpbmdTZXBhcmF0b3IpIHtcblx0XHRcdHBhdGggKz0gJy8nO1xuXHRcdH1cblxuXHRcdHJldHVybiBpc0Fic29sdXRlID8gYC8ke3BhdGh9YCA6IHBhdGg7XG5cdH0sXG5cblx0aXNBYnNvbHV0ZShwYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHR2YWxpZGF0ZVN0cmluZyhwYXRoLCAncGF0aCcpO1xuXHRcdHJldHVybiBwYXRoLmxlbmd0aCA+IDAgJiYgcGF0aC5jaGFyQ29kZUF0KDApID09PSBDSEFSX0ZPUldBUkRfU0xBU0g7XG5cdH0sXG5cblx0am9pbiguLi5wYXRoczogc3RyaW5nW10pOiBzdHJpbmcge1xuXHRcdGlmIChwYXRocy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiAnLic7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGF0aCA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgcGF0aHMubGVuZ3RoOyArK2kpIHtcblx0XHRcdGNvbnN0IGFyZyA9IHBhdGhzW2ldO1xuXHRcdFx0dmFsaWRhdGVTdHJpbmcoYXJnLCAncGF0aCcpO1xuXHRcdFx0aWYgKGFyZy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHBhdGgucHVzaChhcmcpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChwYXRoLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuICcuJztcblx0XHR9XG5cblx0XHRyZXR1cm4gcG9zaXgubm9ybWFsaXplKHBhdGguam9pbignLycpKTtcblx0fSxcblxuXHRyZWxhdGl2ZShmcm9tOiBzdHJpbmcsIHRvOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHZhbGlkYXRlU3RyaW5nKGZyb20sICdmcm9tJyk7XG5cdFx0dmFsaWRhdGVTdHJpbmcodG8sICd0bycpO1xuXG5cdFx0aWYgKGZyb20gPT09IHRvKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXG5cdFx0Ly8gVHJpbSBsZWFkaW5nIGZvcndhcmQgc2xhc2hlcy5cblx0XHRmcm9tID0gcG9zaXgucmVzb2x2ZShmcm9tKTtcblx0XHR0byA9IHBvc2l4LnJlc29sdmUodG8pO1xuXG5cdFx0aWYgKGZyb20gPT09IHRvKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZnJvbVN0YXJ0ID0gMTtcblx0XHRjb25zdCBmcm9tRW5kID0gZnJvbS5sZW5ndGg7XG5cdFx0Y29uc3QgZnJvbUxlbiA9IGZyb21FbmQgLSBmcm9tU3RhcnQ7XG5cdFx0Y29uc3QgdG9TdGFydCA9IDE7XG5cdFx0Y29uc3QgdG9MZW4gPSB0by5sZW5ndGggLSB0b1N0YXJ0O1xuXG5cdFx0Ly8gQ29tcGFyZSBwYXRocyB0byBmaW5kIHRoZSBsb25nZXN0IGNvbW1vbiBwYXRoIGZyb20gcm9vdFxuXHRcdGNvbnN0IGxlbmd0aCA9IChmcm9tTGVuIDwgdG9MZW4gPyBmcm9tTGVuIDogdG9MZW4pO1xuXHRcdGxldCBsYXN0Q29tbW9uU2VwID0gLTE7XG5cdFx0bGV0IGkgPSAwO1xuXHRcdGZvciAoOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGZyb21Db2RlID0gZnJvbS5jaGFyQ29kZUF0KGZyb21TdGFydCArIGkpO1xuXHRcdFx0aWYgKGZyb21Db2RlICE9PSB0by5jaGFyQ29kZUF0KHRvU3RhcnQgKyBpKSkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH0gZWxzZSBpZiAoZnJvbUNvZGUgPT09IENIQVJfRk9SV0FSRF9TTEFTSCkge1xuXHRcdFx0XHRsYXN0Q29tbW9uU2VwID0gaTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGkgPT09IGxlbmd0aCkge1xuXHRcdFx0aWYgKHRvTGVuID4gbGVuZ3RoKSB7XG5cdFx0XHRcdGlmICh0by5jaGFyQ29kZUF0KHRvU3RhcnQgKyBpKSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIKSB7XG5cdFx0XHRcdFx0Ly8gV2UgZ2V0IGhlcmUgaWYgYGZyb21gIGlzIHRoZSBleGFjdCBiYXNlIHBhdGggZm9yIGB0b2AuXG5cdFx0XHRcdFx0Ly8gRm9yIGV4YW1wbGU6IGZyb209Jy9mb28vYmFyJzsgdG89Jy9mb28vYmFyL2Jheidcblx0XHRcdFx0XHRyZXR1cm4gdG8uc2xpY2UodG9TdGFydCArIGkgKyAxKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoaSA9PT0gMCkge1xuXHRcdFx0XHRcdC8vIFdlIGdldCBoZXJlIGlmIGBmcm9tYCBpcyB0aGUgcm9vdFxuXHRcdFx0XHRcdC8vIEZvciBleGFtcGxlOiBmcm9tPScvJzsgdG89Jy9mb28nXG5cdFx0XHRcdFx0cmV0dXJuIHRvLnNsaWNlKHRvU3RhcnQgKyBpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChmcm9tTGVuID4gbGVuZ3RoKSB7XG5cdFx0XHRcdGlmIChmcm9tLmNoYXJDb2RlQXQoZnJvbVN0YXJ0ICsgaSkgPT09IENIQVJfRk9SV0FSRF9TTEFTSCkge1xuXHRcdFx0XHRcdC8vIFdlIGdldCBoZXJlIGlmIGB0b2AgaXMgdGhlIGV4YWN0IGJhc2UgcGF0aCBmb3IgYGZyb21gLlxuXHRcdFx0XHRcdC8vIEZvciBleGFtcGxlOiBmcm9tPScvZm9vL2Jhci9iYXonOyB0bz0nL2Zvby9iYXInXG5cdFx0XHRcdFx0bGFzdENvbW1vblNlcCA9IGk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoaSA9PT0gMCkge1xuXHRcdFx0XHRcdC8vIFdlIGdldCBoZXJlIGlmIGB0b2AgaXMgdGhlIHJvb3QuXG5cdFx0XHRcdFx0Ly8gRm9yIGV4YW1wbGU6IGZyb209Jy9mb28vYmFyJzsgdG89Jy8nXG5cdFx0XHRcdFx0bGFzdENvbW1vblNlcCA9IDA7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgb3V0ID0gJyc7XG5cdFx0Ly8gR2VuZXJhdGUgdGhlIHJlbGF0aXZlIHBhdGggYmFzZWQgb24gdGhlIHBhdGggZGlmZmVyZW5jZSBiZXR3ZWVuIGB0b2Bcblx0XHQvLyBhbmQgYGZyb21gLlxuXHRcdGZvciAoaSA9IGZyb21TdGFydCArIGxhc3RDb21tb25TZXAgKyAxOyBpIDw9IGZyb21FbmQ7ICsraSkge1xuXHRcdFx0aWYgKGkgPT09IGZyb21FbmQgfHwgZnJvbS5jaGFyQ29kZUF0KGkpID09PSBDSEFSX0ZPUldBUkRfU0xBU0gpIHtcblx0XHRcdFx0b3V0ICs9IG91dC5sZW5ndGggPT09IDAgPyAnLi4nIDogJy8uLic7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gTGFzdGx5LCBhcHBlbmQgdGhlIHJlc3Qgb2YgdGhlIGRlc3RpbmF0aW9uIChgdG9gKSBwYXRoIHRoYXQgY29tZXMgYWZ0ZXJcblx0XHQvLyB0aGUgY29tbW9uIHBhdGggcGFydHMuXG5cdFx0cmV0dXJuIGAke291dH0ke3RvLnNsaWNlKHRvU3RhcnQgKyBsYXN0Q29tbW9uU2VwKX1gO1xuXHR9LFxuXG5cdHRvTmFtZXNwYWNlZFBhdGgocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHQvLyBOb24tb3Agb24gcG9zaXggc3lzdGVtc1xuXHRcdHJldHVybiBwYXRoO1xuXHR9LFxuXG5cdGRpcm5hbWUocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHR2YWxpZGF0ZVN0cmluZyhwYXRoLCAncGF0aCcpO1xuXHRcdGlmIChwYXRoLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuICcuJztcblx0XHR9XG5cdFx0Y29uc3QgaGFzUm9vdCA9IHBhdGguY2hhckNvZGVBdCgwKSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIO1xuXHRcdGxldCBlbmQgPSAtMTtcblx0XHRsZXQgbWF0Y2hlZFNsYXNoID0gdHJ1ZTtcblx0XHRmb3IgKGxldCBpID0gcGF0aC5sZW5ndGggLSAxOyBpID49IDE7IC0taSkge1xuXHRcdFx0aWYgKHBhdGguY2hhckNvZGVBdChpKSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIKSB7XG5cdFx0XHRcdGlmICghbWF0Y2hlZFNsYXNoKSB7XG5cdFx0XHRcdFx0ZW5kID0gaTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gV2Ugc2F3IHRoZSBmaXJzdCBub24tcGF0aCBzZXBhcmF0b3Jcblx0XHRcdFx0bWF0Y2hlZFNsYXNoID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGVuZCA9PT0gLTEpIHtcblx0XHRcdHJldHVybiBoYXNSb290ID8gJy8nIDogJy4nO1xuXHRcdH1cblx0XHRpZiAoaGFzUm9vdCAmJiBlbmQgPT09IDEpIHtcblx0XHRcdHJldHVybiAnLy8nO1xuXHRcdH1cblx0XHRyZXR1cm4gcGF0aC5zbGljZSgwLCBlbmQpO1xuXHR9LFxuXG5cdGJhc2VuYW1lKHBhdGg6IHN0cmluZywgc3VmZml4Pzogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRpZiAoc3VmZml4ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHZhbGlkYXRlU3RyaW5nKHN1ZmZpeCwgJ3N1ZmZpeCcpO1xuXHRcdH1cblx0XHR2YWxpZGF0ZVN0cmluZyhwYXRoLCAncGF0aCcpO1xuXG5cdFx0bGV0IHN0YXJ0ID0gMDtcblx0XHRsZXQgZW5kID0gLTE7XG5cdFx0bGV0IG1hdGNoZWRTbGFzaCA9IHRydWU7XG5cdFx0bGV0IGk7XG5cblx0XHRpZiAoc3VmZml4ICE9PSB1bmRlZmluZWQgJiYgc3VmZml4Lmxlbmd0aCA+IDAgJiYgc3VmZml4Lmxlbmd0aCA8PSBwYXRoLmxlbmd0aCkge1xuXHRcdFx0aWYgKHN1ZmZpeCA9PT0gcGF0aCkge1xuXHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHR9XG5cdFx0XHRsZXQgZXh0SWR4ID0gc3VmZml4Lmxlbmd0aCAtIDE7XG5cdFx0XHRsZXQgZmlyc3ROb25TbGFzaEVuZCA9IC0xO1xuXHRcdFx0Zm9yIChpID0gcGF0aC5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuXHRcdFx0XHRjb25zdCBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0XHRpZiAoY29kZSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIKSB7XG5cdFx0XHRcdFx0Ly8gSWYgd2UgcmVhY2hlZCBhIHBhdGggc2VwYXJhdG9yIHRoYXQgd2FzIG5vdCBwYXJ0IG9mIGEgc2V0IG9mIHBhdGhcblx0XHRcdFx0XHQvLyBzZXBhcmF0b3JzIGF0IHRoZSBlbmQgb2YgdGhlIHN0cmluZywgc3RvcCBub3dcblx0XHRcdFx0XHRpZiAoIW1hdGNoZWRTbGFzaCkge1xuXHRcdFx0XHRcdFx0c3RhcnQgPSBpICsgMTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoZmlyc3ROb25TbGFzaEVuZCA9PT0gLTEpIHtcblx0XHRcdFx0XHRcdC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCByZW1lbWJlciB0aGlzIGluZGV4IGluIGNhc2Vcblx0XHRcdFx0XHRcdC8vIHdlIG5lZWQgaXQgaWYgdGhlIGV4dGVuc2lvbiBlbmRzIHVwIG5vdCBtYXRjaGluZ1xuXHRcdFx0XHRcdFx0bWF0Y2hlZFNsYXNoID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRmaXJzdE5vblNsYXNoRW5kID0gaSArIDE7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChleHRJZHggPj0gMCkge1xuXHRcdFx0XHRcdFx0Ly8gVHJ5IHRvIG1hdGNoIHRoZSBleHBsaWNpdCBleHRlbnNpb25cblx0XHRcdFx0XHRcdGlmIChjb2RlID09PSBzdWZmaXguY2hhckNvZGVBdChleHRJZHgpKSB7XG5cdFx0XHRcdFx0XHRcdGlmICgtLWV4dElkeCA9PT0gLTEpIHtcblx0XHRcdFx0XHRcdFx0XHQvLyBXZSBtYXRjaGVkIHRoZSBleHRlbnNpb24sIHNvIG1hcmsgdGhpcyBhcyB0aGUgZW5kIG9mIG91ciBwYXRoXG5cdFx0XHRcdFx0XHRcdFx0Ly8gY29tcG9uZW50XG5cdFx0XHRcdFx0XHRcdFx0ZW5kID0gaTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Ly8gRXh0ZW5zaW9uIGRvZXMgbm90IG1hdGNoLCBzbyBvdXIgcmVzdWx0IGlzIHRoZSBlbnRpcmUgcGF0aFxuXHRcdFx0XHRcdFx0XHQvLyBjb21wb25lbnRcblx0XHRcdFx0XHRcdFx0ZXh0SWR4ID0gLTE7XG5cdFx0XHRcdFx0XHRcdGVuZCA9IGZpcnN0Tm9uU2xhc2hFbmQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzdGFydCA9PT0gZW5kKSB7XG5cdFx0XHRcdGVuZCA9IGZpcnN0Tm9uU2xhc2hFbmQ7XG5cdFx0XHR9IGVsc2UgaWYgKGVuZCA9PT0gLTEpIHtcblx0XHRcdFx0ZW5kID0gcGF0aC5sZW5ndGg7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcGF0aC5zbGljZShzdGFydCwgZW5kKTtcblx0XHR9XG5cdFx0Zm9yIChpID0gcGF0aC5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuXHRcdFx0aWYgKHBhdGguY2hhckNvZGVBdChpKSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIKSB7XG5cdFx0XHRcdC8vIElmIHdlIHJlYWNoZWQgYSBwYXRoIHNlcGFyYXRvciB0aGF0IHdhcyBub3QgcGFydCBvZiBhIHNldCBvZiBwYXRoXG5cdFx0XHRcdC8vIHNlcGFyYXRvcnMgYXQgdGhlIGVuZCBvZiB0aGUgc3RyaW5nLCBzdG9wIG5vd1xuXHRcdFx0XHRpZiAoIW1hdGNoZWRTbGFzaCkge1xuXHRcdFx0XHRcdHN0YXJ0ID0gaSArIDE7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoZW5kID09PSAtMSkge1xuXHRcdFx0XHQvLyBXZSBzYXcgdGhlIGZpcnN0IG5vbi1wYXRoIHNlcGFyYXRvciwgbWFyayB0aGlzIGFzIHRoZSBlbmQgb2Ygb3VyXG5cdFx0XHRcdC8vIHBhdGggY29tcG9uZW50XG5cdFx0XHRcdG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuXHRcdFx0XHRlbmQgPSBpICsgMTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZW5kID09PSAtMSkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0XHRyZXR1cm4gcGF0aC5zbGljZShzdGFydCwgZW5kKTtcblx0fSxcblxuXHRleHRuYW1lKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0dmFsaWRhdGVTdHJpbmcocGF0aCwgJ3BhdGgnKTtcblx0XHRsZXQgc3RhcnREb3QgPSAtMTtcblx0XHRsZXQgc3RhcnRQYXJ0ID0gMDtcblx0XHRsZXQgZW5kID0gLTE7XG5cdFx0bGV0IG1hdGNoZWRTbGFzaCA9IHRydWU7XG5cdFx0Ly8gVHJhY2sgdGhlIHN0YXRlIG9mIGNoYXJhY3RlcnMgKGlmIGFueSkgd2Ugc2VlIGJlZm9yZSBvdXIgZmlyc3QgZG90IGFuZFxuXHRcdC8vIGFmdGVyIGFueSBwYXRoIHNlcGFyYXRvciB3ZSBmaW5kXG5cdFx0bGV0IHByZURvdFN0YXRlID0gMDtcblx0XHRmb3IgKGxldCBpID0gcGF0aC5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuXHRcdFx0Y29uc3QgY2hhciA9IHBhdGhbaV07XG5cdFx0XHRpZiAoY2hhciA9PT0gJy8nKSB7XG5cdFx0XHRcdC8vIElmIHdlIHJlYWNoZWQgYSBwYXRoIHNlcGFyYXRvciB0aGF0IHdhcyBub3QgcGFydCBvZiBhIHNldCBvZiBwYXRoXG5cdFx0XHRcdC8vIHNlcGFyYXRvcnMgYXQgdGhlIGVuZCBvZiB0aGUgc3RyaW5nLCBzdG9wIG5vd1xuXHRcdFx0XHRpZiAoIW1hdGNoZWRTbGFzaCkge1xuXHRcdFx0XHRcdHN0YXJ0UGFydCA9IGkgKyAxO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGVuZCA9PT0gLTEpIHtcblx0XHRcdFx0Ly8gV2Ugc2F3IHRoZSBmaXJzdCBub24tcGF0aCBzZXBhcmF0b3IsIG1hcmsgdGhpcyBhcyB0aGUgZW5kIG9mIG91clxuXHRcdFx0XHQvLyBleHRlbnNpb25cblx0XHRcdFx0bWF0Y2hlZFNsYXNoID0gZmFsc2U7XG5cdFx0XHRcdGVuZCA9IGkgKyAxO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGNoYXIgPT09ICcuJykge1xuXHRcdFx0XHQvLyBJZiB0aGlzIGlzIG91ciBmaXJzdCBkb3QsIG1hcmsgaXQgYXMgdGhlIHN0YXJ0IG9mIG91ciBleHRlbnNpb25cblx0XHRcdFx0aWYgKHN0YXJ0RG90ID09PSAtMSkge1xuXHRcdFx0XHRcdHN0YXJ0RG90ID0gaTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmIChwcmVEb3RTdGF0ZSAhPT0gMSkge1xuXHRcdFx0XHRcdHByZURvdFN0YXRlID0gMTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChzdGFydERvdCAhPT0gLTEpIHtcblx0XHRcdFx0Ly8gV2Ugc2F3IGEgbm9uLWRvdCBhbmQgbm9uLXBhdGggc2VwYXJhdG9yIGJlZm9yZSBvdXIgZG90LCBzbyB3ZSBzaG91bGRcblx0XHRcdFx0Ly8gaGF2ZSBhIGdvb2QgY2hhbmNlIGF0IGhhdmluZyBhIG5vbi1lbXB0eSBleHRlbnNpb25cblx0XHRcdFx0cHJlRG90U3RhdGUgPSAtMTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoc3RhcnREb3QgPT09IC0xIHx8XG5cdFx0XHRlbmQgPT09IC0xIHx8XG5cdFx0XHQvLyBXZSBzYXcgYSBub24tZG90IGNoYXJhY3RlciBpbW1lZGlhdGVseSBiZWZvcmUgdGhlIGRvdFxuXHRcdFx0cHJlRG90U3RhdGUgPT09IDAgfHxcblx0XHRcdC8vIFRoZSAocmlnaHQtbW9zdCkgdHJpbW1lZCBwYXRoIGNvbXBvbmVudCBpcyBleGFjdGx5ICcuLidcblx0XHRcdChwcmVEb3RTdGF0ZSA9PT0gMSAmJlxuXHRcdFx0XHRzdGFydERvdCA9PT0gZW5kIC0gMSAmJlxuXHRcdFx0XHRzdGFydERvdCA9PT0gc3RhcnRQYXJ0ICsgMSkpIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cdFx0cmV0dXJuIHBhdGguc2xpY2Uoc3RhcnREb3QsIGVuZCk7XG5cdH0sXG5cblx0Zm9ybWF0OiBfZm9ybWF0LmJpbmQobnVsbCwgJy8nKSxcblxuXHRwYXJzZShwYXRoOiBzdHJpbmcpOiBQYXJzZWRQYXRoIHtcblx0XHR2YWxpZGF0ZVN0cmluZyhwYXRoLCAncGF0aCcpO1xuXG5cdFx0Y29uc3QgcmV0ID0geyByb290OiAnJywgZGlyOiAnJywgYmFzZTogJycsIGV4dDogJycsIG5hbWU6ICcnIH07XG5cdFx0aWYgKHBhdGgubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gcmV0O1xuXHRcdH1cblx0XHRjb25zdCBpc0Fic29sdXRlID0gcGF0aC5jaGFyQ29kZUF0KDApID09PSBDSEFSX0ZPUldBUkRfU0xBU0g7XG5cdFx0bGV0IHN0YXJ0O1xuXHRcdGlmIChpc0Fic29sdXRlKSB7XG5cdFx0XHRyZXQucm9vdCA9ICcvJztcblx0XHRcdHN0YXJ0ID0gMTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c3RhcnQgPSAwO1xuXHRcdH1cblx0XHRsZXQgc3RhcnREb3QgPSAtMTtcblx0XHRsZXQgc3RhcnRQYXJ0ID0gMDtcblx0XHRsZXQgZW5kID0gLTE7XG5cdFx0bGV0IG1hdGNoZWRTbGFzaCA9IHRydWU7XG5cdFx0bGV0IGkgPSBwYXRoLmxlbmd0aCAtIDE7XG5cblx0XHQvLyBUcmFjayB0aGUgc3RhdGUgb2YgY2hhcmFjdGVycyAoaWYgYW55KSB3ZSBzZWUgYmVmb3JlIG91ciBmaXJzdCBkb3QgYW5kXG5cdFx0Ly8gYWZ0ZXIgYW55IHBhdGggc2VwYXJhdG9yIHdlIGZpbmRcblx0XHRsZXQgcHJlRG90U3RhdGUgPSAwO1xuXG5cdFx0Ly8gR2V0IG5vbi1kaXIgaW5mb1xuXHRcdGZvciAoOyBpID49IHN0YXJ0OyAtLWkpIHtcblx0XHRcdGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoaSk7XG5cdFx0XHRpZiAoY29kZSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIKSB7XG5cdFx0XHRcdC8vIElmIHdlIHJlYWNoZWQgYSBwYXRoIHNlcGFyYXRvciB0aGF0IHdhcyBub3QgcGFydCBvZiBhIHNldCBvZiBwYXRoXG5cdFx0XHRcdC8vIHNlcGFyYXRvcnMgYXQgdGhlIGVuZCBvZiB0aGUgc3RyaW5nLCBzdG9wIG5vd1xuXHRcdFx0XHRpZiAoIW1hdGNoZWRTbGFzaCkge1xuXHRcdFx0XHRcdHN0YXJ0UGFydCA9IGkgKyAxO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGVuZCA9PT0gLTEpIHtcblx0XHRcdFx0Ly8gV2Ugc2F3IHRoZSBmaXJzdCBub24tcGF0aCBzZXBhcmF0b3IsIG1hcmsgdGhpcyBhcyB0aGUgZW5kIG9mIG91clxuXHRcdFx0XHQvLyBleHRlbnNpb25cblx0XHRcdFx0bWF0Y2hlZFNsYXNoID0gZmFsc2U7XG5cdFx0XHRcdGVuZCA9IGkgKyAxO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGNvZGUgPT09IENIQVJfRE9UKSB7XG5cdFx0XHRcdC8vIElmIHRoaXMgaXMgb3VyIGZpcnN0IGRvdCwgbWFyayBpdCBhcyB0aGUgc3RhcnQgb2Ygb3VyIGV4dGVuc2lvblxuXHRcdFx0XHRpZiAoc3RhcnREb3QgPT09IC0xKSB7XG5cdFx0XHRcdFx0c3RhcnREb3QgPSBpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHByZURvdFN0YXRlICE9PSAxKSB7XG5cdFx0XHRcdFx0cHJlRG90U3RhdGUgPSAxO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHN0YXJ0RG90ICE9PSAtMSkge1xuXHRcdFx0XHQvLyBXZSBzYXcgYSBub24tZG90IGFuZCBub24tcGF0aCBzZXBhcmF0b3IgYmVmb3JlIG91ciBkb3QsIHNvIHdlIHNob3VsZFxuXHRcdFx0XHQvLyBoYXZlIGEgZ29vZCBjaGFuY2UgYXQgaGF2aW5nIGEgbm9uLWVtcHR5IGV4dGVuc2lvblxuXHRcdFx0XHRwcmVEb3RTdGF0ZSA9IC0xO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChlbmQgIT09IC0xKSB7XG5cdFx0XHRjb25zdCBzdGFydCA9IHN0YXJ0UGFydCA9PT0gMCAmJiBpc0Fic29sdXRlID8gMSA6IHN0YXJ0UGFydDtcblx0XHRcdGlmIChzdGFydERvdCA9PT0gLTEgfHxcblx0XHRcdFx0Ly8gV2Ugc2F3IGEgbm9uLWRvdCBjaGFyYWN0ZXIgaW1tZWRpYXRlbHkgYmVmb3JlIHRoZSBkb3Rcblx0XHRcdFx0cHJlRG90U3RhdGUgPT09IDAgfHxcblx0XHRcdFx0Ly8gVGhlIChyaWdodC1tb3N0KSB0cmltbWVkIHBhdGggY29tcG9uZW50IGlzIGV4YWN0bHkgJy4uJ1xuXHRcdFx0XHQocHJlRG90U3RhdGUgPT09IDEgJiZcblx0XHRcdFx0XHRzdGFydERvdCA9PT0gZW5kIC0gMSAmJlxuXHRcdFx0XHRcdHN0YXJ0RG90ID09PSBzdGFydFBhcnQgKyAxKSkge1xuXHRcdFx0XHRyZXQuYmFzZSA9IHJldC5uYW1lID0gcGF0aC5zbGljZShzdGFydCwgZW5kKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldC5uYW1lID0gcGF0aC5zbGljZShzdGFydCwgc3RhcnREb3QpO1xuXHRcdFx0XHRyZXQuYmFzZSA9IHBhdGguc2xpY2Uoc3RhcnQsIGVuZCk7XG5cdFx0XHRcdHJldC5leHQgPSBwYXRoLnNsaWNlKHN0YXJ0RG90LCBlbmQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChzdGFydFBhcnQgPiAwKSB7XG5cdFx0XHRyZXQuZGlyID0gcGF0aC5zbGljZSgwLCBzdGFydFBhcnQgLSAxKTtcblx0XHR9IGVsc2UgaWYgKGlzQWJzb2x1dGUpIHtcblx0XHRcdHJldC5kaXIgPSAnLyc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJldDtcblx0fSxcblxuXHRzZXA6ICcvJyxcblx0ZGVsaW1pdGVyOiAnOicsXG5cdHdpbjMyOiBudWxsLFxuXHRwb3NpeDogbnVsbFxufTtcblxucG9zaXgud2luMzIgPSB3aW4zMi53aW4zMiA9IHdpbjMyO1xucG9zaXgucG9zaXggPSB3aW4zMi5wb3NpeCA9IHBvc2l4O1xuXG5leHBvcnQgY29uc3Qgbm9ybWFsaXplID0gKHBsYXRmb3JtSXNXaW4zMiA/IHdpbjMyLm5vcm1hbGl6ZSA6IHBvc2l4Lm5vcm1hbGl6ZSk7XG5leHBvcnQgY29uc3QgaXNBYnNvbHV0ZSA9IChwbGF0Zm9ybUlzV2luMzIgPyB3aW4zMi5pc0Fic29sdXRlIDogcG9zaXguaXNBYnNvbHV0ZSk7XG5leHBvcnQgY29uc3Qgam9pbiA9IChwbGF0Zm9ybUlzV2luMzIgPyB3aW4zMi5qb2luIDogcG9zaXguam9pbik7XG5leHBvcnQgY29uc3QgcmVzb2x2ZSA9IChwbGF0Zm9ybUlzV2luMzIgPyB3aW4zMi5yZXNvbHZlIDogcG9zaXgucmVzb2x2ZSk7XG5leHBvcnQgY29uc3QgcmVsYXRpdmUgPSAocGxhdGZvcm1Jc1dpbjMyID8gd2luMzIucmVsYXRpdmUgOiBwb3NpeC5yZWxhdGl2ZSk7XG5leHBvcnQgY29uc3QgZGlybmFtZSA9IChwbGF0Zm9ybUlzV2luMzIgPyB3aW4zMi5kaXJuYW1lIDogcG9zaXguZGlybmFtZSk7XG5leHBvcnQgY29uc3QgYmFzZW5hbWUgPSAocGxhdGZvcm1Jc1dpbjMyID8gd2luMzIuYmFzZW5hbWUgOiBwb3NpeC5iYXNlbmFtZSk7XG5leHBvcnQgY29uc3QgZXh0bmFtZSA9IChwbGF0Zm9ybUlzV2luMzIgPyB3aW4zMi5leHRuYW1lIDogcG9zaXguZXh0bmFtZSk7XG5leHBvcnQgY29uc3QgZm9ybWF0ID0gKHBsYXRmb3JtSXNXaW4zMiA/IHdpbjMyLmZvcm1hdCA6IHBvc2l4LmZvcm1hdCk7XG5leHBvcnQgY29uc3QgcGFyc2UgPSAocGxhdGZvcm1Jc1dpbjMyID8gd2luMzIucGFyc2UgOiBwb3NpeC5wYXJzZSk7XG5leHBvcnQgY29uc3QgdG9OYW1lc3BhY2VkUGF0aCA9IChwbGF0Zm9ybUlzV2luMzIgPyB3aW4zMi50b05hbWVzcGFjZWRQYXRoIDogcG9zaXgudG9OYW1lc3BhY2VkUGF0aCk7XG5leHBvcnQgY29uc3Qgc2VwID0gKHBsYXRmb3JtSXNXaW4zMiA/IHdpbjMyLnNlcCA6IHBvc2l4LnNlcCk7XG5leHBvcnQgY29uc3QgZGVsaW1pdGVyID0gKHBsYXRmb3JtSXNXaW4zMiA/IHdpbjMyLmRlbGltaXRlciA6IHBvc2l4LmRlbGltaXRlcik7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFtQ0EsWUFBWSxhQUFhO0FBRXpCLE1BQU0sbUJBQW1CO0FBQ3pCLE1BQU0sbUJBQW1CO0FBQ3pCLE1BQU0sbUJBQW1CO0FBQ3pCLE1BQU0sbUJBQW1CO0FB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O0FBQ1I7QUFFQSxNQUFNLFFBQVEsTUFBTSxRQUFRO0FBQzVCLE1BQU0sUUFBUSxNQUFNLFFBQVE7QUFFckIsTUFBTSxZQUFhLGtCQUFrQixNQUFNLFlBQVksTUFBTTtBQUM3RCxNQUFNLGFBQWMsa0JBQWtCLE1BQU0sYUFBYSxNQUFNO0FBQy9ELE1BQU0sT0FBUSxrQkFBa0IsTUFBTSxPQUFPLE1BQU07QUFDbkQsTUFBTSxVQUFXLGtCQUFrQixNQUFNLFVBQVUsTUFBTTtBQUN6RCxNQUFNLFdBQVksa0JBQWtCLE1BQU0sV0FBVyxNQUFNO0FBQzNELE1BQU0sVUFBVyxrQkFBa0IsTUFBTSxVQUFVLE1BQU07QUFDekQsTUFBTSxXQUFZLGtCQUFrQixNQUFNLFdBQVcsTUFBTTtBQUMzRCxNQUFNLFVBQVcsa0JBQWtCLE1BQU0sVUFBVSxNQUFNO0FBQ3pELE1BQU0sU0FBVSxrQkFBa0IsTUFBTSxTQUFTLE1BQU07QUFDdkQsTUFBTSxRQUFTLGtCQUFrQixNQUFNLFFBQVEsTUFBTTtBQUNyRCxNQUFNLG1CQUFvQixrQkFBa0IsTUFBTSxtQkFBbUIsTUFBTTtBQUMzRSxNQUFNLE1BQU8sa0JBQWtCLE1BQU0sTUFBTSxNQUFNO0FBQ2pELE1BQU0sWUFBYSxrQkFBa0IsTUFBTSxZQUFZLE1BQU07IiwKICAibmFtZXMiOiBbImlzUGF0aFNlcGFyYXRvciIsICJzZXAiLCAiaXNBYnNvbHV0ZSIsICJmcm9tTGVuIiwgInRvTGVuIiwgImxlbmd0aCIsICJpIiwgInN0YXJ0Il0KfQo=
