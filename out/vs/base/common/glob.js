import { equals } from "./arrays.js";
import { isThenable } from "./async.js";
import { CharCode } from "./charCode.js";
import { isEqualOrParent } from "./extpath.js";
import { LRUCache } from "./map.js";
import { basename, extname, posix, sep } from "./path.js";
import { isLinux } from "./platform.js";
import { escapeRegExpCharacters, ltrim } from "./strings.js";
function getEmptyExpression() {
  return /* @__PURE__ */ Object.create(null);
}
const GLOBSTAR = "**";
const GLOB_SPLIT = "/";
const PATH_REGEX = "[/\\\\]";
const NO_PATH_REGEX = "[^/\\\\]";
const ALL_FORWARD_SLASHES = /\//g;
function starsToRegExp(starCount, isLastPattern) {
  switch (starCount) {
    case 0:
      return "";
    case 1:
      return `${NO_PATH_REGEX}*?`;
    // 1 star matches any number of characters except path separator (/ and \) - non greedy (?)
    default:
      return `(?:${PATH_REGEX}|${NO_PATH_REGEX}+${PATH_REGEX}${isLastPattern ? `|${PATH_REGEX}${NO_PATH_REGEX}+` : ""})*?`;
  }
}
function splitGlobAware(pattern, splitChar) {
  if (!pattern) {
    return [];
  }
  const segments = [];
  let inBraces = false;
  let inBrackets = false;
  let curVal = "";
  for (const char of pattern) {
    switch (char) {
      case splitChar:
        if (!inBraces && !inBrackets) {
          segments.push(curVal);
          curVal = "";
          continue;
        }
        break;
      case "{":
        inBraces = true;
        break;
      case "}":
        inBraces = false;
        break;
      case "[":
        inBrackets = true;
        break;
      case "]":
        inBrackets = false;
        break;
    }
    curVal += char;
  }
  if (curVal) {
    segments.push(curVal);
  }
  return segments;
}
function parseRegExp(pattern) {
  if (!pattern) {
    return "";
  }
  let regEx = "";
  const segments = splitGlobAware(pattern, GLOB_SPLIT);
  if (segments.every((segment) => segment === GLOBSTAR)) {
    regEx = ".*";
  } else {
    let previousSegmentWasGlobStar = false;
    segments.forEach((segment, index) => {
      if (segment === GLOBSTAR) {
        if (previousSegmentWasGlobStar) {
          return;
        }
        regEx += starsToRegExp(2, index === segments.length - 1);
      } else {
        let inBraces = false;
        let braceVal = "";
        let inBrackets = false;
        let bracketVal = "";
        for (const char of segment) {
          if (char !== "}" && inBraces) {
            braceVal += char;
            continue;
          }
          if (inBrackets && (char !== "]" || !bracketVal)) {
            let res;
            if (char === "-") {
              res = char;
            } else if ((char === "^" || char === "!") && !bracketVal) {
              res = "^";
            } else if (char === GLOB_SPLIT) {
              res = "";
            } else {
              res = escapeRegExpCharacters(char);
            }
            bracketVal += res;
            continue;
          }
          switch (char) {
            case "{":
              inBraces = true;
              continue;
            case "[":
              inBrackets = true;
              continue;
            case "}": {
              const choices = splitGlobAware(braceVal, ",");
              const braceRegExp = `(?:${choices.map((choice) => parseRegExp(choice)).join("|")})`;
              regEx += braceRegExp;
              inBraces = false;
              braceVal = "";
              break;
            }
            case "]": {
              regEx += "[" + bracketVal + "]";
              inBrackets = false;
              bracketVal = "";
              break;
            }
            case "?":
              regEx += NO_PATH_REGEX;
              continue;
            case "*":
              regEx += starsToRegExp(1);
              continue;
            default:
              regEx += escapeRegExpCharacters(char);
          }
        }
        if (index < segments.length - 1 && // more segments to come after this
        (segments[index + 1] !== GLOBSTAR || // next segment is not **, or...
        index + 2 < segments.length)) {
          regEx += PATH_REGEX;
        }
      }
      previousSegmentWasGlobStar = segment === GLOBSTAR;
    });
  }
  return regEx;
}
const T1 = /^\*\*\/\*\.[\w\.-]+$/;
const T2 = /^\*\*\/([\w\.-]+)\/?$/;
const T3 = /^{\*\*\/\*?[\w\.-]+\/?(,\*\*\/\*?[\w\.-]+\/?)*}$/;
const T3_2 = /^{\*\*\/\*?[\w\.-]+(\/(\*\*)?)?(,\*\*\/\*?[\w\.-]+(\/(\*\*)?)?)*}$/;
const T4 = /^\*\*((\/[\w\.-]+)+)\/?$/;
const T5 = /^([\w\.-]+(\/[\w\.-]+)*)\/?$/;
const CACHE = new LRUCache(1e4);
const FALSE = function() {
  return false;
};
const NULL = function() {
  return null;
};
function parsePattern(arg1, options) {
  if (!arg1) {
    return NULL;
  }
  let pattern;
  if (typeof arg1 !== "string") {
    pattern = arg1.pattern;
  } else {
    pattern = arg1;
  }
  pattern = pattern.trim();
  const patternKey = `${pattern}_${!!options.trimForExclusions}`;
  let parsedPattern = CACHE.get(patternKey);
  if (parsedPattern) {
    return wrapRelativePattern(parsedPattern, arg1);
  }
  let match2;
  if (T1.test(pattern)) {
    parsedPattern = trivia1(pattern.substr(4), pattern);
  } else if (match2 = T2.exec(trimForExclusions(pattern, options))) {
    parsedPattern = trivia2(match2[1], pattern);
  } else if ((options.trimForExclusions ? T3_2 : T3).test(pattern)) {
    parsedPattern = trivia3(pattern, options);
  } else if (match2 = T4.exec(trimForExclusions(pattern, options))) {
    parsedPattern = trivia4and5(match2[1].substr(1), pattern, true);
  } else if (match2 = T5.exec(trimForExclusions(pattern, options))) {
    parsedPattern = trivia4and5(match2[1], pattern, false);
  } else {
    parsedPattern = toRegExp(pattern);
  }
  CACHE.set(patternKey, parsedPattern);
  return wrapRelativePattern(parsedPattern, arg1);
}
function wrapRelativePattern(parsedPattern, arg2) {
  if (typeof arg2 === "string") {
    return parsedPattern;
  }
  const wrappedPattern = function(path, basename2) {
    if (!isEqualOrParent(path, arg2.base, !isLinux)) {
      return null;
    }
    return parsedPattern(ltrim(path.substr(arg2.base.length), sep), basename2);
  };
  wrappedPattern.allBasenames = parsedPattern.allBasenames;
  wrappedPattern.allPaths = parsedPattern.allPaths;
  wrappedPattern.basenames = parsedPattern.basenames;
  wrappedPattern.patterns = parsedPattern.patterns;
  return wrappedPattern;
}
function trimForExclusions(pattern, options) {
  return options.trimForExclusions && pattern.endsWith("/**") ? pattern.substr(0, pattern.length - 2) : pattern;
}
function trivia1(base, pattern) {
  return function(path, basename2) {
    return typeof path === "string" && path.endsWith(base) ? pattern : null;
  };
}
function trivia2(base, pattern) {
  const slashBase = `/${base}`;
  const backslashBase = `\\${base}`;
  const parsedPattern = function(path, basename2) {
    if (typeof path !== "string") {
      return null;
    }
    if (basename2) {
      return basename2 === base ? pattern : null;
    }
    return path === base || path.endsWith(slashBase) || path.endsWith(backslashBase) ? pattern : null;
  };
  const basenames = [base];
  parsedPattern.basenames = basenames;
  parsedPattern.patterns = [pattern];
  parsedPattern.allBasenames = basenames;
  return parsedPattern;
}
function trivia3(pattern, options) {
  const parsedPatterns = aggregateBasenameMatches(pattern.slice(1, -1).split(",").map((pattern2) => parsePattern(pattern2, options)).filter((pattern2) => pattern2 !== NULL), pattern);
  const patternsLength = parsedPatterns.length;
  if (!patternsLength) {
    return NULL;
  }
  if (patternsLength === 1) {
    return parsedPatterns[0];
  }
  const parsedPattern = function(path, basename2) {
    for (let i = 0, n = parsedPatterns.length; i < n; i++) {
      if (parsedPatterns[i](path, basename2)) {
        return pattern;
      }
    }
    return null;
  };
  const withBasenames = parsedPatterns.find((pattern2) => !!pattern2.allBasenames);
  if (withBasenames) {
    parsedPattern.allBasenames = withBasenames.allBasenames;
  }
  const allPaths = parsedPatterns.reduce((all, current) => current.allPaths ? all.concat(current.allPaths) : all, []);
  if (allPaths.length) {
    parsedPattern.allPaths = allPaths;
  }
  return parsedPattern;
}
function trivia4and5(targetPath, pattern, matchPathEnds) {
  const usingPosixSep = sep === posix.sep;
  const nativePath = usingPosixSep ? targetPath : targetPath.replace(ALL_FORWARD_SLASHES, sep);
  const nativePathEnd = sep + nativePath;
  const targetPathEnd = posix.sep + targetPath;
  let parsedPattern;
  if (matchPathEnds) {
    parsedPattern = function(path, basename2) {
      return typeof path === "string" && (path === nativePath || path.endsWith(nativePathEnd) || !usingPosixSep && (path === targetPath || path.endsWith(targetPathEnd))) ? pattern : null;
    };
  } else {
    parsedPattern = function(path, basename2) {
      return typeof path === "string" && (path === nativePath || !usingPosixSep && path === targetPath) ? pattern : null;
    };
  }
  parsedPattern.allPaths = [(matchPathEnds ? "*/" : "./") + targetPath];
  return parsedPattern;
}
function toRegExp(pattern) {
  try {
    const regExp = new RegExp(`^${parseRegExp(pattern)}$`);
    return function(path) {
      regExp.lastIndex = 0;
      return typeof path === "string" && regExp.test(path) ? pattern : null;
    };
  } catch (error) {
    return NULL;
  }
}
function match(arg1, path, hasSibling) {
  if (!arg1 || typeof path !== "string") {
    return false;
  }
  return parse(arg1)(path, void 0, hasSibling);
}
function parse(arg1, options = {}) {
  if (!arg1) {
    return FALSE;
  }
  if (typeof arg1 === "string" || isRelativePattern(arg1)) {
    const parsedPattern = parsePattern(arg1, options);
    if (parsedPattern === NULL) {
      return FALSE;
    }
    const resultPattern = function(path, basename2) {
      return !!parsedPattern(path, basename2);
    };
    if (parsedPattern.allBasenames) {
      resultPattern.allBasenames = parsedPattern.allBasenames;
    }
    if (parsedPattern.allPaths) {
      resultPattern.allPaths = parsedPattern.allPaths;
    }
    return resultPattern;
  }
  return parsedExpression(arg1, options);
}
function isRelativePattern(obj) {
  const rp = obj;
  if (!rp) {
    return false;
  }
  return typeof rp.base === "string" && typeof rp.pattern === "string";
}
function getBasenameTerms(patternOrExpression) {
  return patternOrExpression.allBasenames || [];
}
function getPathTerms(patternOrExpression) {
  return patternOrExpression.allPaths || [];
}
function parsedExpression(expression, options) {
  const parsedPatterns = aggregateBasenameMatches(Object.getOwnPropertyNames(expression).map((pattern) => parseExpressionPattern(pattern, expression[pattern], options)).filter((pattern) => pattern !== NULL));
  const patternsLength = parsedPatterns.length;
  if (!patternsLength) {
    return NULL;
  }
  if (!parsedPatterns.some((parsedPattern) => !!parsedPattern.requiresSiblings)) {
    if (patternsLength === 1) {
      return parsedPatterns[0];
    }
    const resultExpression2 = function(path, basename2) {
      let resultPromises = void 0;
      for (let i = 0, n = parsedPatterns.length; i < n; i++) {
        const result = parsedPatterns[i](path, basename2);
        if (typeof result === "string") {
          return result;
        }
        if (isThenable(result)) {
          if (!resultPromises) {
            resultPromises = [];
          }
          resultPromises.push(result);
        }
      }
      if (resultPromises) {
        return (async () => {
          for (const resultPromise of resultPromises) {
            const result = await resultPromise;
            if (typeof result === "string") {
              return result;
            }
          }
          return null;
        })();
      }
      return null;
    };
    const withBasenames2 = parsedPatterns.find((pattern) => !!pattern.allBasenames);
    if (withBasenames2) {
      resultExpression2.allBasenames = withBasenames2.allBasenames;
    }
    const allPaths2 = parsedPatterns.reduce((all, current) => current.allPaths ? all.concat(current.allPaths) : all, []);
    if (allPaths2.length) {
      resultExpression2.allPaths = allPaths2;
    }
    return resultExpression2;
  }
  const resultExpression = function(path, base, hasSibling) {
    let name = void 0;
    let resultPromises = void 0;
    for (let i = 0, n = parsedPatterns.length; i < n; i++) {
      const parsedPattern = parsedPatterns[i];
      if (parsedPattern.requiresSiblings && hasSibling) {
        if (!base) {
          base = basename(path);
        }
        if (!name) {
          name = base.substr(0, base.length - extname(path).length);
        }
      }
      const result = parsedPattern(path, base, name, hasSibling);
      if (typeof result === "string") {
        return result;
      }
      if (isThenable(result)) {
        if (!resultPromises) {
          resultPromises = [];
        }
        resultPromises.push(result);
      }
    }
    if (resultPromises) {
      return (async () => {
        for (const resultPromise of resultPromises) {
          const result = await resultPromise;
          if (typeof result === "string") {
            return result;
          }
        }
        return null;
      })();
    }
    return null;
  };
  const withBasenames = parsedPatterns.find((pattern) => !!pattern.allBasenames);
  if (withBasenames) {
    resultExpression.allBasenames = withBasenames.allBasenames;
  }
  const allPaths = parsedPatterns.reduce((all, current) => current.allPaths ? all.concat(current.allPaths) : all, []);
  if (allPaths.length) {
    resultExpression.allPaths = allPaths;
  }
  return resultExpression;
}
function parseExpressionPattern(pattern, value, options) {
  if (value === false) {
    return NULL;
  }
  const parsedPattern = parsePattern(pattern, options);
  if (parsedPattern === NULL) {
    return NULL;
  }
  if (typeof value === "boolean") {
    return parsedPattern;
  }
  if (value) {
    const when = value.when;
    if (typeof when === "string") {
      const result = (path, basename2, name, hasSibling) => {
        if (!hasSibling || !parsedPattern(path, basename2)) {
          return null;
        }
        const clausePattern = when.replace("$(basename)", () => name);
        const matched = hasSibling(clausePattern);
        return isThenable(matched) ? matched.then((match2) => match2 ? pattern : null) : matched ? pattern : null;
      };
      result.requiresSiblings = true;
      return result;
    }
  }
  return parsedPattern;
}
function aggregateBasenameMatches(parsedPatterns, result) {
  const basenamePatterns = parsedPatterns.filter((parsedPattern) => !!parsedPattern.basenames);
  if (basenamePatterns.length < 2) {
    return parsedPatterns;
  }
  const basenames = basenamePatterns.reduce((all, current) => {
    const basenames2 = current.basenames;
    return basenames2 ? all.concat(basenames2) : all;
  }, []);
  let patterns;
  if (result) {
    patterns = [];
    for (let i = 0, n = basenames.length; i < n; i++) {
      patterns.push(result);
    }
  } else {
    patterns = basenamePatterns.reduce((all, current) => {
      const patterns2 = current.patterns;
      return patterns2 ? all.concat(patterns2) : all;
    }, []);
  }
  const aggregate = function(path, basename2) {
    if (typeof path !== "string") {
      return null;
    }
    if (!basename2) {
      let i;
      for (i = path.length; i > 0; i--) {
        const ch = path.charCodeAt(i - 1);
        if (ch === CharCode.Slash || ch === CharCode.Backslash) {
          break;
        }
      }
      basename2 = path.substr(i);
    }
    const index = basenames.indexOf(basename2);
    return index !== -1 ? patterns[index] : null;
  };
  aggregate.basenames = basenames;
  aggregate.patterns = patterns;
  aggregate.allBasenames = basenames;
  const aggregatedPatterns = parsedPatterns.filter((parsedPattern) => !parsedPattern.basenames);
  aggregatedPatterns.push(aggregate);
  return aggregatedPatterns;
}
function patternsEquals(patternsA, patternsB) {
  return equals(patternsA, patternsB, (a, b) => {
    if (typeof a === "string" && typeof b === "string") {
      return a === b;
    }
    if (typeof a !== "string" && typeof b !== "string") {
      return a.base === b.base && a.pattern === b.pattern;
    }
    return false;
  });
}
export {
  GLOBSTAR,
  GLOB_SPLIT,
  getBasenameTerms,
  getEmptyExpression,
  getPathTerms,
  isRelativePattern,
  match,
  parse,
  patternsEquals,
  splitGlobAware
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9nbG9iLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZXF1YWxzIH0gZnJvbSAnLi9hcnJheXMuanMnO1xuaW1wb3J0IHsgaXNUaGVuYWJsZSB9IGZyb20gJy4vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2hhckNvZGUgfSBmcm9tICcuL2NoYXJDb2RlLmpzJztcbmltcG9ydCB7IGlzRXF1YWxPclBhcmVudCB9IGZyb20gJy4vZXh0cGF0aC5qcyc7XG5pbXBvcnQgeyBMUlVDYWNoZSB9IGZyb20gJy4vbWFwLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBleHRuYW1lLCBwb3NpeCwgc2VwIH0gZnJvbSAnLi9wYXRoLmpzJztcbmltcG9ydCB7IGlzTGludXggfSBmcm9tICcuL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGVzY2FwZVJlZ0V4cENoYXJhY3RlcnMsIGx0cmltIH0gZnJvbSAnLi9zdHJpbmdzLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJUmVsYXRpdmVQYXR0ZXJuIHtcblxuXHQvKipcblx0ICogQSBiYXNlIGZpbGUgcGF0aCB0byB3aGljaCB0aGlzIHBhdHRlcm4gd2lsbCBiZSBtYXRjaGVkIGFnYWluc3QgcmVsYXRpdmVseS5cblx0ICovXG5cdHJlYWRvbmx5IGJhc2U6IHN0cmluZztcblxuXHQvKipcblx0ICogQSBmaWxlIGdsb2IgcGF0dGVybiBsaWtlIGAqLnt0cyxqc31gIHRoYXQgd2lsbCBiZSBtYXRjaGVkIG9uIGZpbGUgcGF0aHNcblx0ICogcmVsYXRpdmUgdG8gdGhlIGJhc2UgcGF0aC5cblx0ICpcblx0ICogRXhhbXBsZTogR2l2ZW4gYSBiYXNlIG9mIGAvaG9tZS93b3JrL2ZvbGRlcmAgYW5kIGEgZmlsZSBwYXRoIG9mIGAvaG9tZS93b3JrL2ZvbGRlci9pbmRleC5qc2AsXG5cdCAqIHRoZSBmaWxlIGdsb2IgcGF0dGVybiB3aWxsIG1hdGNoIG9uIGBpbmRleC5qc2AuXG5cdCAqL1xuXHRyZWFkb25seSBwYXR0ZXJuOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUV4cHJlc3Npb24ge1xuXHRbcGF0dGVybjogc3RyaW5nXTogYm9vbGVhbiB8IFNpYmxpbmdDbGF1c2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRFbXB0eUV4cHJlc3Npb24oKTogSUV4cHJlc3Npb24ge1xuXHRyZXR1cm4gT2JqZWN0LmNyZWF0ZShudWxsKTtcbn1cblxuaW50ZXJmYWNlIFNpYmxpbmdDbGF1c2Uge1xuXHR3aGVuOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBHTE9CU1RBUiA9ICcqKic7XG5leHBvcnQgY29uc3QgR0xPQl9TUExJVCA9ICcvJztcblxuY29uc3QgUEFUSF9SRUdFWCA9ICdbL1xcXFxcXFxcXSc7XHRcdC8vIGFueSBzbGFzaCBvciBiYWNrc2xhc2hcbmNvbnN0IE5PX1BBVEhfUkVHRVggPSAnW14vXFxcXFxcXFxdJztcdC8vIGFueSBub24tc2xhc2ggYW5kIG5vbi1iYWNrc2xhc2hcbmNvbnN0IEFMTF9GT1JXQVJEX1NMQVNIRVMgPSAvXFwvL2c7XG5cbmZ1bmN0aW9uIHN0YXJzVG9SZWdFeHAoc3RhckNvdW50OiBudW1iZXIsIGlzTGFzdFBhdHRlcm4/OiBib29sZWFuKTogc3RyaW5nIHtcblx0c3dpdGNoIChzdGFyQ291bnQpIHtcblx0XHRjYXNlIDA6XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0Y2FzZSAxOlxuXHRcdFx0cmV0dXJuIGAke05PX1BBVEhfUkVHRVh9Kj9gOyAvLyAxIHN0YXIgbWF0Y2hlcyBhbnkgbnVtYmVyIG9mIGNoYXJhY3RlcnMgZXhjZXB0IHBhdGggc2VwYXJhdG9yICgvIGFuZCBcXCkgLSBub24gZ3JlZWR5ICg/KVxuXHRcdGRlZmF1bHQ6XG5cdFx0XHQvLyBNYXRjaGVzOiAgKFBhdGggU2VwIE9SIFBhdGggVmFsIGZvbGxvd2VkIGJ5IFBhdGggU2VwKSAwLW1hbnkgdGltZXMgZXhjZXB0IHdoZW4gaXQncyB0aGUgbGFzdCBwYXR0ZXJuXG5cdFx0XHQvLyAgICAgICAgICAgaW4gd2hpY2ggY2FzZSBhbHNvIG1hdGNoZXMgKFBhdGggU2VwIGZvbGxvd2VkIGJ5IFBhdGggVmFsKVxuXHRcdFx0Ly8gR3JvdXAgaXMgbm9uIGNhcHR1cmluZyBiZWNhdXNlIHdlIGRvbid0IG5lZWQgdG8gY2FwdHVyZSBhdCBhbGwgKD86Li4uKVxuXHRcdFx0Ly8gT3ZlcmFsbCB3ZSB1c2Ugbm9uLWdyZWVkeSBtYXRjaGluZyBiZWNhdXNlIGl0IGNvdWxkIGJlIHRoYXQgd2UgbWF0Y2ggdG9vIG11Y2hcblx0XHRcdHJldHVybiBgKD86JHtQQVRIX1JFR0VYfXwke05PX1BBVEhfUkVHRVh9KyR7UEFUSF9SRUdFWH0ke2lzTGFzdFBhdHRlcm4gPyBgfCR7UEFUSF9SRUdFWH0ke05PX1BBVEhfUkVHRVh9K2AgOiAnJ30pKj9gO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzcGxpdEdsb2JBd2FyZShwYXR0ZXJuOiBzdHJpbmcsIHNwbGl0Q2hhcjogc3RyaW5nKTogc3RyaW5nW10ge1xuXHRpZiAoIXBhdHRlcm4pIHtcblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRjb25zdCBzZWdtZW50czogc3RyaW5nW10gPSBbXTtcblxuXHRsZXQgaW5CcmFjZXMgPSBmYWxzZTtcblx0bGV0IGluQnJhY2tldHMgPSBmYWxzZTtcblxuXHRsZXQgY3VyVmFsID0gJyc7XG5cdGZvciAoY29uc3QgY2hhciBvZiBwYXR0ZXJuKSB7XG5cdFx0c3dpdGNoIChjaGFyKSB7XG5cdFx0XHRjYXNlIHNwbGl0Q2hhcjpcblx0XHRcdFx0aWYgKCFpbkJyYWNlcyAmJiAhaW5CcmFja2V0cykge1xuXHRcdFx0XHRcdHNlZ21lbnRzLnB1c2goY3VyVmFsKTtcblx0XHRcdFx0XHRjdXJWYWwgPSAnJztcblxuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAneyc6XG5cdFx0XHRcdGluQnJhY2VzID0gdHJ1ZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICd9Jzpcblx0XHRcdFx0aW5CcmFjZXMgPSBmYWxzZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdbJzpcblx0XHRcdFx0aW5CcmFja2V0cyA9IHRydWU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnXSc6XG5cdFx0XHRcdGluQnJhY2tldHMgPSBmYWxzZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0Y3VyVmFsICs9IGNoYXI7XG5cdH1cblxuXHQvLyBUYWlsXG5cdGlmIChjdXJWYWwpIHtcblx0XHRzZWdtZW50cy5wdXNoKGN1clZhbCk7XG5cdH1cblxuXHRyZXR1cm4gc2VnbWVudHM7XG59XG5cbmZ1bmN0aW9uIHBhcnNlUmVnRXhwKHBhdHRlcm46IHN0cmluZyk6IHN0cmluZyB7XG5cdGlmICghcGF0dGVybikge1xuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdGxldCByZWdFeCA9ICcnO1xuXG5cdC8vIFNwbGl0IHVwIGludG8gc2VnbWVudHMgZm9yIGVhY2ggc2xhc2ggZm91bmRcblx0Y29uc3Qgc2VnbWVudHMgPSBzcGxpdEdsb2JBd2FyZShwYXR0ZXJuLCBHTE9CX1NQTElUKTtcblxuXHQvLyBTcGVjaWFsIGNhc2Ugd2hlcmUgd2Ugb25seSBoYXZlIGdsb2JzdGFyc1xuXHRpZiAoc2VnbWVudHMuZXZlcnkoc2VnbWVudCA9PiBzZWdtZW50ID09PSBHTE9CU1RBUikpIHtcblx0XHRyZWdFeCA9ICcuKic7XG5cdH1cblxuXHQvLyBCdWlsZCByZWdleCBvdmVyIHNlZ21lbnRzXG5cdGVsc2Uge1xuXHRcdGxldCBwcmV2aW91c1NlZ21lbnRXYXNHbG9iU3RhciA9IGZhbHNlO1xuXHRcdHNlZ21lbnRzLmZvckVhY2goKHNlZ21lbnQsIGluZGV4KSA9PiB7XG5cblx0XHRcdC8vIFRyZWF0IGdsb2JzdGFyIHNwZWNpYWxseVxuXHRcdFx0aWYgKHNlZ21lbnQgPT09IEdMT0JTVEFSKSB7XG5cblx0XHRcdFx0Ly8gaWYgd2UgaGF2ZSBtb3JlIHRoYW4gb25lIGdsb2JzdGFyIGFmdGVyIGFub3RoZXIsIGp1c3QgaWdub3JlIGl0XG5cdFx0XHRcdGlmIChwcmV2aW91c1NlZ21lbnRXYXNHbG9iU3Rhcikge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJlZ0V4ICs9IHN0YXJzVG9SZWdFeHAoMiwgaW5kZXggPT09IHNlZ21lbnRzLmxlbmd0aCAtIDEpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBBbnl0aGluZyBlbHNlLCBub3QgZ2xvYnN0YXJcblx0XHRcdGVsc2Uge1xuXG5cdFx0XHRcdC8vIFN0YXRlc1xuXHRcdFx0XHRsZXQgaW5CcmFjZXMgPSBmYWxzZTtcblx0XHRcdFx0bGV0IGJyYWNlVmFsID0gJyc7XG5cblx0XHRcdFx0bGV0IGluQnJhY2tldHMgPSBmYWxzZTtcblx0XHRcdFx0bGV0IGJyYWNrZXRWYWwgPSAnJztcblxuXHRcdFx0XHRmb3IgKGNvbnN0IGNoYXIgb2Ygc2VnbWVudCkge1xuXG5cdFx0XHRcdFx0Ly8gU3VwcG9ydCBicmFjZSBleHBhbnNpb25cblx0XHRcdFx0XHRpZiAoY2hhciAhPT0gJ30nICYmIGluQnJhY2VzKSB7XG5cdFx0XHRcdFx0XHRicmFjZVZhbCArPSBjaGFyO1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gU3VwcG9ydCBicmFja2V0c1xuXHRcdFx0XHRcdGlmIChpbkJyYWNrZXRzICYmIChjaGFyICE9PSAnXScgfHwgIWJyYWNrZXRWYWwpIC8qIF0gaXMgbGl0ZXJhbGx5IG9ubHkgYWxsb3dlZCBhcyBmaXJzdCBjaGFyYWN0ZXIgaW4gYnJhY2tldHMgdG8gbWF0Y2ggaXQgKi8pIHtcblx0XHRcdFx0XHRcdGxldCByZXM6IHN0cmluZztcblxuXHRcdFx0XHRcdFx0Ly8gcmFuZ2Ugb3BlcmF0b3Jcblx0XHRcdFx0XHRcdGlmIChjaGFyID09PSAnLScpIHtcblx0XHRcdFx0XHRcdFx0cmVzID0gY2hhcjtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Ly8gbmVnYXRpb24gb3BlcmF0b3IgKG9ubHkgdmFsaWQgb24gZmlyc3QgaW5kZXggaW4gYnJhY2tldClcblx0XHRcdFx0XHRcdGVsc2UgaWYgKChjaGFyID09PSAnXicgfHwgY2hhciA9PT0gJyEnKSAmJiAhYnJhY2tldFZhbCkge1xuXHRcdFx0XHRcdFx0XHRyZXMgPSAnXic7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIGdsb2Igc3BsaXQgbWF0Y2hpbmcgaXMgbm90IGFsbG93ZWQgd2l0aGluIGNoYXJhY3RlciByYW5nZXNcblx0XHRcdFx0XHRcdC8vIHNlZSBodHRwOi8vbWFuNy5vcmcvbGludXgvbWFuLXBhZ2VzL21hbjcvZ2xvYi43Lmh0bWxcblx0XHRcdFx0XHRcdGVsc2UgaWYgKGNoYXIgPT09IEdMT0JfU1BMSVQpIHtcblx0XHRcdFx0XHRcdFx0cmVzID0gJyc7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIGFueXRoaW5nIGVsc2UgZ2V0cyBlc2NhcGVkXG5cdFx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdFx0cmVzID0gZXNjYXBlUmVnRXhwQ2hhcmFjdGVycyhjaGFyKTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0YnJhY2tldFZhbCArPSByZXM7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRzd2l0Y2ggKGNoYXIpIHtcblx0XHRcdFx0XHRcdGNhc2UgJ3snOlxuXHRcdFx0XHRcdFx0XHRpbkJyYWNlcyA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXG5cdFx0XHRcdFx0XHRjYXNlICdbJzpcblx0XHRcdFx0XHRcdFx0aW5CcmFja2V0cyA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXG5cdFx0XHRcdFx0XHRjYXNlICd9Jzoge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBjaG9pY2VzID0gc3BsaXRHbG9iQXdhcmUoYnJhY2VWYWwsICcsJyk7XG5cblx0XHRcdFx0XHRcdFx0Ly8gQ29udmVydHMge2ZvbyxiYXJ9ID0+IFtmb298YmFyXVxuXHRcdFx0XHRcdFx0XHRjb25zdCBicmFjZVJlZ0V4cCA9IGAoPzoke2Nob2ljZXMubWFwKGNob2ljZSA9PiBwYXJzZVJlZ0V4cChjaG9pY2UpKS5qb2luKCd8Jyl9KWA7XG5cblx0XHRcdFx0XHRcdFx0cmVnRXggKz0gYnJhY2VSZWdFeHA7XG5cblx0XHRcdFx0XHRcdFx0aW5CcmFjZXMgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0YnJhY2VWYWwgPSAnJztcblxuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Y2FzZSAnXSc6IHtcblx0XHRcdFx0XHRcdFx0cmVnRXggKz0gKCdbJyArIGJyYWNrZXRWYWwgKyAnXScpO1xuXG5cdFx0XHRcdFx0XHRcdGluQnJhY2tldHMgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0YnJhY2tldFZhbCA9ICcnO1xuXG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRjYXNlICc/Jzpcblx0XHRcdFx0XHRcdFx0cmVnRXggKz0gTk9fUEFUSF9SRUdFWDsgLy8gMSA/IG1hdGNoZXMgYW55IHNpbmdsZSBjaGFyYWN0ZXIgZXhjZXB0IHBhdGggc2VwYXJhdG9yICgvIGFuZCBcXClcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XG5cblx0XHRcdFx0XHRcdGNhc2UgJyonOlxuXHRcdFx0XHRcdFx0XHRyZWdFeCArPSBzdGFyc1RvUmVnRXhwKDEpO1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblxuXHRcdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdFx0cmVnRXggKz0gZXNjYXBlUmVnRXhwQ2hhcmFjdGVycyhjaGFyKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBUYWlsOiBBZGQgdGhlIHNsYXNoIHdlIGhhZCBzcGxpdCBvbiBpZiB0aGVyZSBpcyBtb3JlIHRvXG5cdFx0XHRcdC8vIGNvbWUgYW5kIHRoZSByZW1haW5pbmcgcGF0dGVybiBpcyBub3QgYSBnbG9ic3RhclxuXHRcdFx0XHQvLyBGb3IgZXhhbXBsZSBpZiBwYXR0ZXJuOiBzb21lLyoqLyouanMgd2Ugd2FudCB0aGUgXCIvXCIgYWZ0ZXJcblx0XHRcdFx0Ly8gc29tZSB0byBiZSBpbmNsdWRlZCBpbiB0aGUgUmVnRXggdG8gcHJldmVudCBhIGZvbGRlciBjYWxsZWRcblx0XHRcdFx0Ly8gXCJzb21ldGhpbmdcIiB0byBtYXRjaCBhcyB3ZWxsLlxuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0aW5kZXggPCBzZWdtZW50cy5sZW5ndGggLSAxICYmXHRcdFx0Ly8gbW9yZSBzZWdtZW50cyB0byBjb21lIGFmdGVyIHRoaXNcblx0XHRcdFx0XHQoXG5cdFx0XHRcdFx0XHRzZWdtZW50c1tpbmRleCArIDFdICE9PSBHTE9CU1RBUiB8fFx0Ly8gbmV4dCBzZWdtZW50IGlzIG5vdCAqKiwgb3IuLi5cblx0XHRcdFx0XHRcdGluZGV4ICsgMiA8IHNlZ21lbnRzLmxlbmd0aFx0XHRcdC8vIC4uLm5leHQgc2VnbWVudCBpcyAqKiBidXQgdGhlcmUgaXMgbW9yZSBzZWdtZW50cyBhZnRlciB0aGF0XG5cdFx0XHRcdFx0KVxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHRyZWdFeCArPSBQQVRIX1JFR0VYO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIHVwZGF0ZSBnbG9ic3RhciBzdGF0ZVxuXHRcdFx0cHJldmlvdXNTZWdtZW50V2FzR2xvYlN0YXIgPSAoc2VnbWVudCA9PT0gR0xPQlNUQVIpO1xuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIHJlZ0V4O1xufVxuXG4vLyByZWdleGVzIHRvIGNoZWNrIGZvciB0cml2aWFsIGdsb2IgcGF0dGVybnMgdGhhdCBqdXN0IGNoZWNrIGZvciBTdHJpbmcjZW5kc1dpdGhcbmNvbnN0IFQxID0gL15cXCpcXCpcXC9cXCpcXC5bXFx3XFwuLV0rJC87IFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gKiovKi5zb21ldGhpbmdcbmNvbnN0IFQyID0gL15cXCpcXCpcXC8oW1xcd1xcLi1dKylcXC8/JC87IFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vICoqL3NvbWV0aGluZ1xuY29uc3QgVDMgPSAvXntcXCpcXCpcXC9cXCo/W1xcd1xcLi1dK1xcLz8oLFxcKlxcKlxcL1xcKj9bXFx3XFwuLV0rXFwvPykqfSQvOyBcdFx0XHRcdFx0XHQvLyB7KiovKi5zb21ldGhpbmcsKiovKi5lbHNlfSBvciB7KiovcGFja2FnZS5qc29uLCoqL3Byb2plY3QuanNvbn1cbmNvbnN0IFQzXzIgPSAvXntcXCpcXCpcXC9cXCo/W1xcd1xcLi1dKyhcXC8oXFwqXFwqKT8pPygsXFwqXFwqXFwvXFwqP1tcXHdcXC4tXSsoXFwvKFxcKlxcKik/KT8pKn0kLzsgXHQvLyBMaWtlIFQzLCB3aXRoIG9wdGlvbmFsIHRyYWlsaW5nIC8qKlxuY29uc3QgVDQgPSAvXlxcKlxcKigoXFwvW1xcd1xcLi1dKykrKVxcLz8kLzsgXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gKiovc29tZXRoaW5nL2Vsc2VcbmNvbnN0IFQ1ID0gL14oW1xcd1xcLi1dKyhcXC9bXFx3XFwuLV0rKSopXFwvPyQvOyBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gc29tZXRoaW5nL2Vsc2VcblxuZXhwb3J0IHR5cGUgUGFyc2VkUGF0dGVybiA9IChwYXRoOiBzdHJpbmcsIGJhc2VuYW1lPzogc3RyaW5nKSA9PiBib29sZWFuO1xuXG4vLyBUaGUgYFBhcnNlZEV4cHJlc3Npb25gIHJldHVybnMgYSBgUHJvbWlzZWBcbi8vIGlmZiBgaGFzU2libGluZ2AgcmV0dXJucyBhIGBQcm9taXNlYC5cbmV4cG9ydCB0eXBlIFBhcnNlZEV4cHJlc3Npb24gPSAocGF0aDogc3RyaW5nLCBiYXNlbmFtZT86IHN0cmluZywgaGFzU2libGluZz86IChuYW1lOiBzdHJpbmcpID0+IGJvb2xlYW4gfCBQcm9taXNlPGJvb2xlYW4+KSA9PiBzdHJpbmcgfCBudWxsIHwgUHJvbWlzZTxzdHJpbmcgfCBudWxsPiAvKiB0aGUgbWF0Y2hpbmcgcGF0dGVybiAqLztcblxuaW50ZXJmYWNlIElHbG9iT3B0aW9ucyB7XG5cblx0LyoqXG5cdCAqIFNpbXBsaWZ5IHBhdHRlcm5zIGZvciB1c2UgYXMgZXhjbHVzaW9uIGZpbHRlcnMgZHVyaW5nXG5cdCAqIHRyZWUgdHJhdmVyc2FsIHRvIHNraXAgZW50aXJlIHN1YnRyZWVzLiBDYW5ub3QgYmUgdXNlZFxuXHQgKiBvdXRzaWRlIG9mIGEgdHJlZSB0cmF2ZXJzYWwuXG5cdCAqL1xuXHR0cmltRm9yRXhjbHVzaW9ucz86IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBQYXJzZWRTdHJpbmdQYXR0ZXJuIHtcblx0KHBhdGg6IHN0cmluZywgYmFzZW5hbWU/OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHwgUHJvbWlzZTxzdHJpbmcgfCBudWxsPiAvKiB0aGUgbWF0Y2hpbmcgcGF0dGVybiAqLztcblx0YmFzZW5hbWVzPzogc3RyaW5nW107XG5cdHBhdHRlcm5zPzogc3RyaW5nW107XG5cdGFsbEJhc2VuYW1lcz86IHN0cmluZ1tdO1xuXHRhbGxQYXRocz86IHN0cmluZ1tdO1xufVxuXG5pbnRlcmZhY2UgUGFyc2VkRXhwcmVzc2lvblBhdHRlcm4ge1xuXHQocGF0aDogc3RyaW5nLCBiYXNlbmFtZT86IHN0cmluZywgbmFtZT86IHN0cmluZywgaGFzU2libGluZz86IChuYW1lOiBzdHJpbmcpID0+IGJvb2xlYW4gfCBQcm9taXNlPGJvb2xlYW4+KTogc3RyaW5nIHwgbnVsbCB8IFByb21pc2U8c3RyaW5nIHwgbnVsbD4gLyogdGhlIG1hdGNoaW5nIHBhdHRlcm4gKi87XG5cdHJlcXVpcmVzU2libGluZ3M/OiBib29sZWFuO1xuXHRhbGxCYXNlbmFtZXM/OiBzdHJpbmdbXTtcblx0YWxsUGF0aHM/OiBzdHJpbmdbXTtcbn1cblxuY29uc3QgQ0FDSEUgPSBuZXcgTFJVQ2FjaGU8c3RyaW5nLCBQYXJzZWRTdHJpbmdQYXR0ZXJuPigxMDAwMCk7IC8vIGJvdW5kZWQgdG8gMTAwMDAgZWxlbWVudHNcblxuY29uc3QgRkFMU0UgPSBmdW5jdGlvbiAoKSB7XG5cdHJldHVybiBmYWxzZTtcbn07XG5cbmNvbnN0IE5VTEwgPSBmdW5jdGlvbiAoKTogc3RyaW5nIHwgbnVsbCB7XG5cdHJldHVybiBudWxsO1xufTtcblxuZnVuY3Rpb24gcGFyc2VQYXR0ZXJuKGFyZzE6IHN0cmluZyB8IElSZWxhdGl2ZVBhdHRlcm4sIG9wdGlvbnM6IElHbG9iT3B0aW9ucyk6IFBhcnNlZFN0cmluZ1BhdHRlcm4ge1xuXHRpZiAoIWFyZzEpIHtcblx0XHRyZXR1cm4gTlVMTDtcblx0fVxuXG5cdC8vIEhhbmRsZSByZWxhdGl2ZSBwYXR0ZXJuc1xuXHRsZXQgcGF0dGVybjogc3RyaW5nO1xuXHRpZiAodHlwZW9mIGFyZzEgIT09ICdzdHJpbmcnKSB7XG5cdFx0cGF0dGVybiA9IGFyZzEucGF0dGVybjtcblx0fSBlbHNlIHtcblx0XHRwYXR0ZXJuID0gYXJnMTtcblx0fVxuXG5cdC8vIFdoaXRlc3BhY2UgdHJpbW1pbmdcblx0cGF0dGVybiA9IHBhdHRlcm4udHJpbSgpO1xuXG5cdC8vIENoZWNrIGNhY2hlXG5cdGNvbnN0IHBhdHRlcm5LZXkgPSBgJHtwYXR0ZXJufV8keyEhb3B0aW9ucy50cmltRm9yRXhjbHVzaW9uc31gO1xuXHRsZXQgcGFyc2VkUGF0dGVybiA9IENBQ0hFLmdldChwYXR0ZXJuS2V5KTtcblx0aWYgKHBhcnNlZFBhdHRlcm4pIHtcblx0XHRyZXR1cm4gd3JhcFJlbGF0aXZlUGF0dGVybihwYXJzZWRQYXR0ZXJuLCBhcmcxKTtcblx0fVxuXG5cdC8vIENoZWNrIGZvciBUcml2aWFsc1xuXHRsZXQgbWF0Y2g6IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG5cdGlmIChUMS50ZXN0KHBhdHRlcm4pKSB7XG5cdFx0cGFyc2VkUGF0dGVybiA9IHRyaXZpYTEocGF0dGVybi5zdWJzdHIoNCksIHBhdHRlcm4pOyBcdFx0XHQvLyBjb21tb24gcGF0dGVybjogKiovKi50eHQganVzdCBuZWVkIGVuZHNXaXRoIGNoZWNrXG5cdH0gZWxzZSBpZiAobWF0Y2ggPSBUMi5leGVjKHRyaW1Gb3JFeGNsdXNpb25zKHBhdHRlcm4sIG9wdGlvbnMpKSkgeyBcdC8vIGNvbW1vbiBwYXR0ZXJuOiAqKi9zb21lLnR4dCBqdXN0IG5lZWQgYmFzZW5hbWUgY2hlY2tcblx0XHRwYXJzZWRQYXR0ZXJuID0gdHJpdmlhMihtYXRjaFsxXSwgcGF0dGVybik7XG5cdH0gZWxzZSBpZiAoKG9wdGlvbnMudHJpbUZvckV4Y2x1c2lvbnMgPyBUM18yIDogVDMpLnRlc3QocGF0dGVybikpIHsgLy8gcmVwZXRpdGlvbiBvZiBjb21tb24gcGF0dGVybnMgKHNlZSBhYm92ZSkgeyoqLyoudHh0LCoqLyoucG5nfVxuXHRcdHBhcnNlZFBhdHRlcm4gPSB0cml2aWEzKHBhdHRlcm4sIG9wdGlvbnMpO1xuXHR9IGVsc2UgaWYgKG1hdGNoID0gVDQuZXhlYyh0cmltRm9yRXhjbHVzaW9ucyhwYXR0ZXJuLCBvcHRpb25zKSkpIHsgXHQvLyBjb21tb24gcGF0dGVybjogKiovc29tZXRoaW5nL2Vsc2UganVzdCBuZWVkIGVuZHNXaXRoIGNoZWNrXG5cdFx0cGFyc2VkUGF0dGVybiA9IHRyaXZpYTRhbmQ1KG1hdGNoWzFdLnN1YnN0cigxKSwgcGF0dGVybiwgdHJ1ZSk7XG5cdH0gZWxzZSBpZiAobWF0Y2ggPSBUNS5leGVjKHRyaW1Gb3JFeGNsdXNpb25zKHBhdHRlcm4sIG9wdGlvbnMpKSkgeyBcdC8vIGNvbW1vbiBwYXR0ZXJuOiBzb21ldGhpbmcvZWxzZSBqdXN0IG5lZWQgZXF1YWxzIGNoZWNrXG5cdFx0cGFyc2VkUGF0dGVybiA9IHRyaXZpYTRhbmQ1KG1hdGNoWzFdLCBwYXR0ZXJuLCBmYWxzZSk7XG5cdH1cblxuXHQvLyBPdGhlcndpc2UgY29udmVydCB0byBwYXR0ZXJuXG5cdGVsc2Uge1xuXHRcdHBhcnNlZFBhdHRlcm4gPSB0b1JlZ0V4cChwYXR0ZXJuKTtcblx0fVxuXG5cdC8vIENhY2hlXG5cdENBQ0hFLnNldChwYXR0ZXJuS2V5LCBwYXJzZWRQYXR0ZXJuKTtcblxuXHRyZXR1cm4gd3JhcFJlbGF0aXZlUGF0dGVybihwYXJzZWRQYXR0ZXJuLCBhcmcxKTtcbn1cblxuZnVuY3Rpb24gd3JhcFJlbGF0aXZlUGF0dGVybihwYXJzZWRQYXR0ZXJuOiBQYXJzZWRTdHJpbmdQYXR0ZXJuLCBhcmcyOiBzdHJpbmcgfCBJUmVsYXRpdmVQYXR0ZXJuKTogUGFyc2VkU3RyaW5nUGF0dGVybiB7XG5cdGlmICh0eXBlb2YgYXJnMiA9PT0gJ3N0cmluZycpIHtcblx0XHRyZXR1cm4gcGFyc2VkUGF0dGVybjtcblx0fVxuXG5cdGNvbnN0IHdyYXBwZWRQYXR0ZXJuOiBQYXJzZWRTdHJpbmdQYXR0ZXJuID0gZnVuY3Rpb24gKHBhdGgsIGJhc2VuYW1lKSB7XG5cdFx0aWYgKCFpc0VxdWFsT3JQYXJlbnQocGF0aCwgYXJnMi5iYXNlLCAhaXNMaW51eCkpIHtcblx0XHRcdC8vIHNraXAgZ2xvYiBtYXRjaGluZyBpZiBgYmFzZWAgaXMgbm90IGEgcGFyZW50IG9mIGBwYXRoYFxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Ly8gR2l2ZW4gd2UgaGF2ZSBjaGVja2VkIGBiYXNlYCBiZWluZyBhIHBhcmVudCBvZiBgcGF0aGAsXG5cdFx0Ly8gd2UgY2FuIG5vdyByZW1vdmUgdGhlIGBiYXNlYCBwb3J0aW9uIG9mIHRoZSBgcGF0aGBcblx0XHQvLyBhbmQgb25seSBtYXRjaCBvbiB0aGUgcmVtYWluaW5nIHBhdGggY29tcG9uZW50c1xuXHRcdC8vIEZvciB0aGF0IHdlIHRyeSB0byBleHRyYWN0IHRoZSBwb3J0aW9uIG9mIHRoZSBgcGF0aGBcblx0XHQvLyB0aGF0IGNvbWVzIGFmdGVyIHRoZSBgYmFzZWAgcG9ydGlvbi4gV2UgaGF2ZSB0byBhY2NvdW50XG5cdFx0Ly8gZm9yIHRoZSBmYWN0IHRoYXQgYGJhc2VgIG1pZ2h0IGVuZCBpbiBhIHBhdGggc2VwYXJhdG9yXG5cdFx0Ly8gKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNjI0OTgpXG5cblx0XHRyZXR1cm4gcGFyc2VkUGF0dGVybihsdHJpbShwYXRoLnN1YnN0cihhcmcyLmJhc2UubGVuZ3RoKSwgc2VwKSwgYmFzZW5hbWUpO1xuXHR9O1xuXG5cdC8vIE1ha2Ugc3VyZSB0byBwcmVzZXJ2ZSBhc3NvY2lhdGVkIG1ldGFkYXRhXG5cdHdyYXBwZWRQYXR0ZXJuLmFsbEJhc2VuYW1lcyA9IHBhcnNlZFBhdHRlcm4uYWxsQmFzZW5hbWVzO1xuXHR3cmFwcGVkUGF0dGVybi5hbGxQYXRocyA9IHBhcnNlZFBhdHRlcm4uYWxsUGF0aHM7XG5cdHdyYXBwZWRQYXR0ZXJuLmJhc2VuYW1lcyA9IHBhcnNlZFBhdHRlcm4uYmFzZW5hbWVzO1xuXHR3cmFwcGVkUGF0dGVybi5wYXR0ZXJucyA9IHBhcnNlZFBhdHRlcm4ucGF0dGVybnM7XG5cblx0cmV0dXJuIHdyYXBwZWRQYXR0ZXJuO1xufVxuXG5mdW5jdGlvbiB0cmltRm9yRXhjbHVzaW9ucyhwYXR0ZXJuOiBzdHJpbmcsIG9wdGlvbnM6IElHbG9iT3B0aW9ucyk6IHN0cmluZyB7XG5cdHJldHVybiBvcHRpb25zLnRyaW1Gb3JFeGNsdXNpb25zICYmIHBhdHRlcm4uZW5kc1dpdGgoJy8qKicpID8gcGF0dGVybi5zdWJzdHIoMCwgcGF0dGVybi5sZW5ndGggLSAyKSA6IHBhdHRlcm47IC8vIGRyb3BwaW5nICoqLCB0YWlsaW5nIC8gaXMgZHJvcHBlZCBsYXRlclxufVxuXG4vLyBjb21tb24gcGF0dGVybjogKiovKi50eHQganVzdCBuZWVkIGVuZHNXaXRoIGNoZWNrXG5mdW5jdGlvbiB0cml2aWExKGJhc2U6IHN0cmluZywgcGF0dGVybjogc3RyaW5nKTogUGFyc2VkU3RyaW5nUGF0dGVybiB7XG5cdHJldHVybiBmdW5jdGlvbiAocGF0aDogc3RyaW5nLCBiYXNlbmFtZT86IHN0cmluZykge1xuXHRcdHJldHVybiB0eXBlb2YgcGF0aCA9PT0gJ3N0cmluZycgJiYgcGF0aC5lbmRzV2l0aChiYXNlKSA/IHBhdHRlcm4gOiBudWxsO1xuXHR9O1xufVxuXG4vLyBjb21tb24gcGF0dGVybjogKiovc29tZS50eHQganVzdCBuZWVkIGJhc2VuYW1lIGNoZWNrXG5mdW5jdGlvbiB0cml2aWEyKGJhc2U6IHN0cmluZywgcGF0dGVybjogc3RyaW5nKTogUGFyc2VkU3RyaW5nUGF0dGVybiB7XG5cdGNvbnN0IHNsYXNoQmFzZSA9IGAvJHtiYXNlfWA7XG5cdGNvbnN0IGJhY2tzbGFzaEJhc2UgPSBgXFxcXCR7YmFzZX1gO1xuXG5cdGNvbnN0IHBhcnNlZFBhdHRlcm46IFBhcnNlZFN0cmluZ1BhdHRlcm4gPSBmdW5jdGlvbiAocGF0aDogc3RyaW5nLCBiYXNlbmFtZT86IHN0cmluZykge1xuXHRcdGlmICh0eXBlb2YgcGF0aCAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGlmIChiYXNlbmFtZSkge1xuXHRcdFx0cmV0dXJuIGJhc2VuYW1lID09PSBiYXNlID8gcGF0dGVybiA6IG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHBhdGggPT09IGJhc2UgfHwgcGF0aC5lbmRzV2l0aChzbGFzaEJhc2UpIHx8IHBhdGguZW5kc1dpdGgoYmFja3NsYXNoQmFzZSkgPyBwYXR0ZXJuIDogbnVsbDtcblx0fTtcblxuXHRjb25zdCBiYXNlbmFtZXMgPSBbYmFzZV07XG5cdHBhcnNlZFBhdHRlcm4uYmFzZW5hbWVzID0gYmFzZW5hbWVzO1xuXHRwYXJzZWRQYXR0ZXJuLnBhdHRlcm5zID0gW3BhdHRlcm5dO1xuXHRwYXJzZWRQYXR0ZXJuLmFsbEJhc2VuYW1lcyA9IGJhc2VuYW1lcztcblxuXHRyZXR1cm4gcGFyc2VkUGF0dGVybjtcbn1cblxuLy8gcmVwZXRpdGlvbiBvZiBjb21tb24gcGF0dGVybnMgKHNlZSBhYm92ZSkgeyoqLyoudHh0LCoqLyoucG5nfVxuZnVuY3Rpb24gdHJpdmlhMyhwYXR0ZXJuOiBzdHJpbmcsIG9wdGlvbnM6IElHbG9iT3B0aW9ucyk6IFBhcnNlZFN0cmluZ1BhdHRlcm4ge1xuXHRjb25zdCBwYXJzZWRQYXR0ZXJucyA9IGFnZ3JlZ2F0ZUJhc2VuYW1lTWF0Y2hlcyhwYXR0ZXJuLnNsaWNlKDEsIC0xKVxuXHRcdC5zcGxpdCgnLCcpXG5cdFx0Lm1hcChwYXR0ZXJuID0+IHBhcnNlUGF0dGVybihwYXR0ZXJuLCBvcHRpb25zKSlcblx0XHQuZmlsdGVyKHBhdHRlcm4gPT4gcGF0dGVybiAhPT0gTlVMTCksIHBhdHRlcm4pO1xuXG5cdGNvbnN0IHBhdHRlcm5zTGVuZ3RoID0gcGFyc2VkUGF0dGVybnMubGVuZ3RoO1xuXHRpZiAoIXBhdHRlcm5zTGVuZ3RoKSB7XG5cdFx0cmV0dXJuIE5VTEw7XG5cdH1cblxuXHRpZiAocGF0dGVybnNMZW5ndGggPT09IDEpIHtcblx0XHRyZXR1cm4gcGFyc2VkUGF0dGVybnNbMF07XG5cdH1cblxuXHRjb25zdCBwYXJzZWRQYXR0ZXJuOiBQYXJzZWRTdHJpbmdQYXR0ZXJuID0gZnVuY3Rpb24gKHBhdGg6IHN0cmluZywgYmFzZW5hbWU/OiBzdHJpbmcpIHtcblx0XHRmb3IgKGxldCBpID0gMCwgbiA9IHBhcnNlZFBhdHRlcm5zLmxlbmd0aDsgaSA8IG47IGkrKykge1xuXHRcdFx0aWYgKHBhcnNlZFBhdHRlcm5zW2ldKHBhdGgsIGJhc2VuYW1lKSkge1xuXHRcdFx0XHRyZXR1cm4gcGF0dGVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fTtcblxuXHRjb25zdCB3aXRoQmFzZW5hbWVzID0gcGFyc2VkUGF0dGVybnMuZmluZChwYXR0ZXJuID0+ICEhcGF0dGVybi5hbGxCYXNlbmFtZXMpO1xuXHRpZiAod2l0aEJhc2VuYW1lcykge1xuXHRcdHBhcnNlZFBhdHRlcm4uYWxsQmFzZW5hbWVzID0gd2l0aEJhc2VuYW1lcy5hbGxCYXNlbmFtZXM7XG5cdH1cblxuXHRjb25zdCBhbGxQYXRocyA9IHBhcnNlZFBhdHRlcm5zLnJlZHVjZSgoYWxsLCBjdXJyZW50KSA9PiBjdXJyZW50LmFsbFBhdGhzID8gYWxsLmNvbmNhdChjdXJyZW50LmFsbFBhdGhzKSA6IGFsbCwgW10gYXMgc3RyaW5nW10pO1xuXHRpZiAoYWxsUGF0aHMubGVuZ3RoKSB7XG5cdFx0cGFyc2VkUGF0dGVybi5hbGxQYXRocyA9IGFsbFBhdGhzO1xuXHR9XG5cblx0cmV0dXJuIHBhcnNlZFBhdHRlcm47XG59XG5cbi8vIGNvbW1vbiBwYXR0ZXJuczogKiovc29tZXRoaW5nL2Vsc2UganVzdCBuZWVkIGVuZHNXaXRoIGNoZWNrLCBzb21ldGhpbmcvZWxzZSBqdXN0IG5lZWRzIGFuZCBlcXVhbHMgY2hlY2tcbmZ1bmN0aW9uIHRyaXZpYTRhbmQ1KHRhcmdldFBhdGg6IHN0cmluZywgcGF0dGVybjogc3RyaW5nLCBtYXRjaFBhdGhFbmRzOiBib29sZWFuKTogUGFyc2VkU3RyaW5nUGF0dGVybiB7XG5cdGNvbnN0IHVzaW5nUG9zaXhTZXAgPSBzZXAgPT09IHBvc2l4LnNlcDtcblx0Y29uc3QgbmF0aXZlUGF0aCA9IHVzaW5nUG9zaXhTZXAgPyB0YXJnZXRQYXRoIDogdGFyZ2V0UGF0aC5yZXBsYWNlKEFMTF9GT1JXQVJEX1NMQVNIRVMsIHNlcCk7XG5cdGNvbnN0IG5hdGl2ZVBhdGhFbmQgPSBzZXAgKyBuYXRpdmVQYXRoO1xuXHRjb25zdCB0YXJnZXRQYXRoRW5kID0gcG9zaXguc2VwICsgdGFyZ2V0UGF0aDtcblxuXHRsZXQgcGFyc2VkUGF0dGVybjogUGFyc2VkU3RyaW5nUGF0dGVybjtcblx0aWYgKG1hdGNoUGF0aEVuZHMpIHtcblx0XHRwYXJzZWRQYXR0ZXJuID0gZnVuY3Rpb24gKHBhdGg6IHN0cmluZywgYmFzZW5hbWU/OiBzdHJpbmcpIHtcblx0XHRcdHJldHVybiB0eXBlb2YgcGF0aCA9PT0gJ3N0cmluZycgJiYgKChwYXRoID09PSBuYXRpdmVQYXRoIHx8IHBhdGguZW5kc1dpdGgobmF0aXZlUGF0aEVuZCkpIHx8ICF1c2luZ1Bvc2l4U2VwICYmIChwYXRoID09PSB0YXJnZXRQYXRoIHx8IHBhdGguZW5kc1dpdGgodGFyZ2V0UGF0aEVuZCkpKSA/IHBhdHRlcm4gOiBudWxsO1xuXHRcdH07XG5cdH0gZWxzZSB7XG5cdFx0cGFyc2VkUGF0dGVybiA9IGZ1bmN0aW9uIChwYXRoOiBzdHJpbmcsIGJhc2VuYW1lPzogc3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gdHlwZW9mIHBhdGggPT09ICdzdHJpbmcnICYmIChwYXRoID09PSBuYXRpdmVQYXRoIHx8ICghdXNpbmdQb3NpeFNlcCAmJiBwYXRoID09PSB0YXJnZXRQYXRoKSkgPyBwYXR0ZXJuIDogbnVsbDtcblx0XHR9O1xuXHR9XG5cblx0cGFyc2VkUGF0dGVybi5hbGxQYXRocyA9IFsobWF0Y2hQYXRoRW5kcyA/ICcqLycgOiAnLi8nKSArIHRhcmdldFBhdGhdO1xuXG5cdHJldHVybiBwYXJzZWRQYXR0ZXJuO1xufVxuXG5mdW5jdGlvbiB0b1JlZ0V4cChwYXR0ZXJuOiBzdHJpbmcpOiBQYXJzZWRTdHJpbmdQYXR0ZXJuIHtcblx0dHJ5IHtcblx0XHRjb25zdCByZWdFeHAgPSBuZXcgUmVnRXhwKGBeJHtwYXJzZVJlZ0V4cChwYXR0ZXJuKX0kYCk7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIChwYXRoOiBzdHJpbmcpIHtcblx0XHRcdHJlZ0V4cC5sYXN0SW5kZXggPSAwOyAvLyByZXNldCBSZWdFeHAgdG8gaXRzIGluaXRpYWwgc3RhdGUgdG8gcmV1c2UgaXQhXG5cblx0XHRcdHJldHVybiB0eXBlb2YgcGF0aCA9PT0gJ3N0cmluZycgJiYgcmVnRXhwLnRlc3QocGF0aCkgPyBwYXR0ZXJuIDogbnVsbDtcblx0XHR9O1xuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdHJldHVybiBOVUxMO1xuXHR9XG59XG5cbi8qKlxuICogU2ltcGxpZmllZCBnbG9iIG1hdGNoaW5nLiBTdXBwb3J0cyBhIHN1YnNldCBvZiBnbG9iIHBhdHRlcm5zOlxuICogKiBgKmAgdG8gbWF0Y2ggemVybyBvciBtb3JlIGNoYXJhY3RlcnMgaW4gYSBwYXRoIHNlZ21lbnRcbiAqICogYD9gIHRvIG1hdGNoIG9uIG9uZSBjaGFyYWN0ZXIgaW4gYSBwYXRoIHNlZ21lbnRcbiAqICogYCoqYCB0byBtYXRjaCBhbnkgbnVtYmVyIG9mIHBhdGggc2VnbWVudHMsIGluY2x1ZGluZyBub25lXG4gKiAqIGB7fWAgdG8gZ3JvdXAgY29uZGl0aW9ucyAoZS5nLiAqLnt0cyxqc30gbWF0Y2hlcyBhbGwgVHlwZVNjcmlwdCBhbmQgSmF2YVNjcmlwdCBmaWxlcylcbiAqICogYFtdYCB0byBkZWNsYXJlIGEgcmFuZ2Ugb2YgY2hhcmFjdGVycyB0byBtYXRjaCBpbiBhIHBhdGggc2VnbWVudCAoZS5nLiwgYGV4YW1wbGUuWzAtOV1gIHRvIG1hdGNoIG9uIGBleGFtcGxlLjBgLCBgZXhhbXBsZS4xYCwgXHUyMDI2KVxuICogKiBgWyEuLi5dYCB0byBuZWdhdGUgYSByYW5nZSBvZiBjaGFyYWN0ZXJzIHRvIG1hdGNoIGluIGEgcGF0aCBzZWdtZW50IChlLmcuLCBgZXhhbXBsZS5bITAtOV1gIHRvIG1hdGNoIG9uIGBleGFtcGxlLmFgLCBgZXhhbXBsZS5iYCwgYnV0IG5vdCBgZXhhbXBsZS4wYClcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoKHBhdHRlcm46IHN0cmluZyB8IElSZWxhdGl2ZVBhdHRlcm4sIHBhdGg6IHN0cmluZyk6IGJvb2xlYW47XG5leHBvcnQgZnVuY3Rpb24gbWF0Y2goZXhwcmVzc2lvbjogSUV4cHJlc3Npb24sIHBhdGg6IHN0cmluZywgaGFzU2libGluZz86IChuYW1lOiBzdHJpbmcpID0+IGJvb2xlYW4pOiBzdHJpbmcgLyogdGhlIG1hdGNoaW5nIHBhdHRlcm4gKi87XG5leHBvcnQgZnVuY3Rpb24gbWF0Y2goYXJnMTogc3RyaW5nIHwgSUV4cHJlc3Npb24gfCBJUmVsYXRpdmVQYXR0ZXJuLCBwYXRoOiBzdHJpbmcsIGhhc1NpYmxpbmc/OiAobmFtZTogc3RyaW5nKSA9PiBib29sZWFuKTogYm9vbGVhbiB8IHN0cmluZyB8IG51bGwgfCBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcblx0aWYgKCFhcmcxIHx8IHR5cGVvZiBwYXRoICE9PSAnc3RyaW5nJykge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHJldHVybiBwYXJzZShhcmcxKShwYXRoLCB1bmRlZmluZWQsIGhhc1NpYmxpbmcpO1xufVxuXG4vKipcbiAqIFNpbXBsaWZpZWQgZ2xvYiBtYXRjaGluZy4gU3VwcG9ydHMgYSBzdWJzZXQgb2YgZ2xvYiBwYXR0ZXJuczpcbiAqICogYCpgIHRvIG1hdGNoIHplcm8gb3IgbW9yZSBjaGFyYWN0ZXJzIGluIGEgcGF0aCBzZWdtZW50XG4gKiAqIGA/YCB0byBtYXRjaCBvbiBvbmUgY2hhcmFjdGVyIGluIGEgcGF0aCBzZWdtZW50XG4gKiAqIGAqKmAgdG8gbWF0Y2ggYW55IG51bWJlciBvZiBwYXRoIHNlZ21lbnRzLCBpbmNsdWRpbmcgbm9uZVxuICogKiBge31gIHRvIGdyb3VwIGNvbmRpdGlvbnMgKGUuZy4gKi57dHMsanN9IG1hdGNoZXMgYWxsIFR5cGVTY3JpcHQgYW5kIEphdmFTY3JpcHQgZmlsZXMpXG4gKiAqIGBbXWAgdG8gZGVjbGFyZSBhIHJhbmdlIG9mIGNoYXJhY3RlcnMgdG8gbWF0Y2ggaW4gYSBwYXRoIHNlZ21lbnQgKGUuZy4sIGBleGFtcGxlLlswLTldYCB0byBtYXRjaCBvbiBgZXhhbXBsZS4wYCwgYGV4YW1wbGUuMWAsIFx1MjAyNilcbiAqICogYFshLi4uXWAgdG8gbmVnYXRlIGEgcmFuZ2Ugb2YgY2hhcmFjdGVycyB0byBtYXRjaCBpbiBhIHBhdGggc2VnbWVudCAoZS5nLiwgYGV4YW1wbGUuWyEwLTldYCB0byBtYXRjaCBvbiBgZXhhbXBsZS5hYCwgYGV4YW1wbGUuYmAsIGJ1dCBub3QgYGV4YW1wbGUuMGApXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZShwYXR0ZXJuOiBzdHJpbmcgfCBJUmVsYXRpdmVQYXR0ZXJuLCBvcHRpb25zPzogSUdsb2JPcHRpb25zKTogUGFyc2VkUGF0dGVybjtcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZShleHByZXNzaW9uOiBJRXhwcmVzc2lvbiwgb3B0aW9ucz86IElHbG9iT3B0aW9ucyk6IFBhcnNlZEV4cHJlc3Npb247XG5leHBvcnQgZnVuY3Rpb24gcGFyc2UoYXJnMTogc3RyaW5nIHwgSUV4cHJlc3Npb24gfCBJUmVsYXRpdmVQYXR0ZXJuLCBvcHRpb25zPzogSUdsb2JPcHRpb25zKTogUGFyc2VkUGF0dGVybiB8IFBhcnNlZEV4cHJlc3Npb247XG5leHBvcnQgZnVuY3Rpb24gcGFyc2UoYXJnMTogc3RyaW5nIHwgSUV4cHJlc3Npb24gfCBJUmVsYXRpdmVQYXR0ZXJuLCBvcHRpb25zOiBJR2xvYk9wdGlvbnMgPSB7fSk6IFBhcnNlZFBhdHRlcm4gfCBQYXJzZWRFeHByZXNzaW9uIHtcblx0aWYgKCFhcmcxKSB7XG5cdFx0cmV0dXJuIEZBTFNFO1xuXHR9XG5cblx0Ly8gR2xvYiB3aXRoIFN0cmluZ1xuXHRpZiAodHlwZW9mIGFyZzEgPT09ICdzdHJpbmcnIHx8IGlzUmVsYXRpdmVQYXR0ZXJuKGFyZzEpKSB7XG5cdFx0Y29uc3QgcGFyc2VkUGF0dGVybiA9IHBhcnNlUGF0dGVybihhcmcxLCBvcHRpb25zKTtcblx0XHRpZiAocGFyc2VkUGF0dGVybiA9PT0gTlVMTCkge1xuXHRcdFx0cmV0dXJuIEZBTFNFO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdFBhdHRlcm46IFBhcnNlZFBhdHRlcm4gJiB7IGFsbEJhc2VuYW1lcz86IHN0cmluZ1tdOyBhbGxQYXRocz86IHN0cmluZ1tdIH0gPSBmdW5jdGlvbiAocGF0aDogc3RyaW5nLCBiYXNlbmFtZT86IHN0cmluZykge1xuXHRcdFx0cmV0dXJuICEhcGFyc2VkUGF0dGVybihwYXRoLCBiYXNlbmFtZSk7XG5cdFx0fTtcblxuXHRcdGlmIChwYXJzZWRQYXR0ZXJuLmFsbEJhc2VuYW1lcykge1xuXHRcdFx0cmVzdWx0UGF0dGVybi5hbGxCYXNlbmFtZXMgPSBwYXJzZWRQYXR0ZXJuLmFsbEJhc2VuYW1lcztcblx0XHR9XG5cblx0XHRpZiAocGFyc2VkUGF0dGVybi5hbGxQYXRocykge1xuXHRcdFx0cmVzdWx0UGF0dGVybi5hbGxQYXRocyA9IHBhcnNlZFBhdHRlcm4uYWxsUGF0aHM7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdFBhdHRlcm47XG5cdH1cblxuXHQvLyBHbG9iIHdpdGggRXhwcmVzc2lvblxuXHRyZXR1cm4gcGFyc2VkRXhwcmVzc2lvbig8SUV4cHJlc3Npb24+YXJnMSwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1JlbGF0aXZlUGF0dGVybihvYmo6IHVua25vd24pOiBvYmogaXMgSVJlbGF0aXZlUGF0dGVybiB7XG5cdGNvbnN0IHJwID0gb2JqIGFzIElSZWxhdGl2ZVBhdHRlcm4gfCB1bmRlZmluZWQgfCBudWxsO1xuXHRpZiAoIXJwKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cmV0dXJuIHR5cGVvZiBycC5iYXNlID09PSAnc3RyaW5nJyAmJiB0eXBlb2YgcnAucGF0dGVybiA9PT0gJ3N0cmluZyc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRCYXNlbmFtZVRlcm1zKHBhdHRlcm5PckV4cHJlc3Npb246IFBhcnNlZFBhdHRlcm4gfCBQYXJzZWRFeHByZXNzaW9uKTogc3RyaW5nW10ge1xuXHRyZXR1cm4gKDxQYXJzZWRTdHJpbmdQYXR0ZXJuPnBhdHRlcm5PckV4cHJlc3Npb24pLmFsbEJhc2VuYW1lcyB8fCBbXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFBhdGhUZXJtcyhwYXR0ZXJuT3JFeHByZXNzaW9uOiBQYXJzZWRQYXR0ZXJuIHwgUGFyc2VkRXhwcmVzc2lvbik6IHN0cmluZ1tdIHtcblx0cmV0dXJuICg8UGFyc2VkU3RyaW5nUGF0dGVybj5wYXR0ZXJuT3JFeHByZXNzaW9uKS5hbGxQYXRocyB8fCBbXTtcbn1cblxuZnVuY3Rpb24gcGFyc2VkRXhwcmVzc2lvbihleHByZXNzaW9uOiBJRXhwcmVzc2lvbiwgb3B0aW9uczogSUdsb2JPcHRpb25zKTogUGFyc2VkRXhwcmVzc2lvbiB7XG5cdGNvbnN0IHBhcnNlZFBhdHRlcm5zID0gYWdncmVnYXRlQmFzZW5hbWVNYXRjaGVzKE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGV4cHJlc3Npb24pXG5cdFx0Lm1hcChwYXR0ZXJuID0+IHBhcnNlRXhwcmVzc2lvblBhdHRlcm4ocGF0dGVybiwgZXhwcmVzc2lvbltwYXR0ZXJuXSwgb3B0aW9ucykpXG5cdFx0LmZpbHRlcihwYXR0ZXJuID0+IHBhdHRlcm4gIT09IE5VTEwpKTtcblxuXHRjb25zdCBwYXR0ZXJuc0xlbmd0aCA9IHBhcnNlZFBhdHRlcm5zLmxlbmd0aDtcblx0aWYgKCFwYXR0ZXJuc0xlbmd0aCkge1xuXHRcdHJldHVybiBOVUxMO1xuXHR9XG5cblx0aWYgKCFwYXJzZWRQYXR0ZXJucy5zb21lKHBhcnNlZFBhdHRlcm4gPT4gISEoPFBhcnNlZEV4cHJlc3Npb25QYXR0ZXJuPnBhcnNlZFBhdHRlcm4pLnJlcXVpcmVzU2libGluZ3MpKSB7XG5cdFx0aWYgKHBhdHRlcm5zTGVuZ3RoID09PSAxKSB7XG5cdFx0XHRyZXR1cm4gcGFyc2VkUGF0dGVybnNbMF0gYXMgUGFyc2VkU3RyaW5nUGF0dGVybjtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHRFeHByZXNzaW9uOiBQYXJzZWRTdHJpbmdQYXR0ZXJuID0gZnVuY3Rpb24gKHBhdGg6IHN0cmluZywgYmFzZW5hbWU/OiBzdHJpbmcpIHtcblx0XHRcdGxldCByZXN1bHRQcm9taXNlczogUHJvbWlzZTxzdHJpbmcgfCBudWxsPltdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbiA9IHBhcnNlZFBhdHRlcm5zLmxlbmd0aDsgaSA8IG47IGkrKykge1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBwYXJzZWRQYXR0ZXJuc1tpXShwYXRoLCBiYXNlbmFtZSk7XG5cdFx0XHRcdGlmICh0eXBlb2YgcmVzdWx0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdHJldHVybiByZXN1bHQ7IC8vIGltbWVkaWF0ZWx5IHJldHVybiBhcyBzb29uIGFzIHRoZSBmaXJzdCBleHByZXNzaW9uIG1hdGNoZXNcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIElmIHRoZSByZXN1bHQgaXMgYSBwcm9taXNlLCB3ZSBoYXZlIHRvIGtlZXAgaXQgZm9yXG5cdFx0XHRcdC8vIGxhdGVyIHByb2Nlc3NpbmcgYW5kIGF3YWl0IHRoZSByZXN1bHQgcHJvcGVybHkuXG5cdFx0XHRcdGlmIChpc1RoZW5hYmxlKHJlc3VsdCkpIHtcblx0XHRcdFx0XHRpZiAoIXJlc3VsdFByb21pc2VzKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHRQcm9taXNlcyA9IFtdO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJlc3VsdFByb21pc2VzLnB1c2gocmVzdWx0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBXaXRoIHJlc3VsdCBwcm9taXNlcywgd2UgaGF2ZSB0byBsb29wIG92ZXIgZWFjaCBhbmRcblx0XHRcdC8vIGF3YWl0IHRoZSByZXN1bHQgYmVmb3JlIHdlIGNhbiByZXR1cm4gYW55IHJlc3VsdC5cblx0XHRcdGlmIChyZXN1bHRQcm9taXNlcykge1xuXHRcdFx0XHRyZXR1cm4gKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHJlc3VsdFByb21pc2Ugb2YgcmVzdWx0UHJvbWlzZXMpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3VsdFByb21pc2U7XG5cdFx0XHRcdFx0XHRpZiAodHlwZW9mIHJlc3VsdCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fSkoKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHdpdGhCYXNlbmFtZXMgPSBwYXJzZWRQYXR0ZXJucy5maW5kKHBhdHRlcm4gPT4gISFwYXR0ZXJuLmFsbEJhc2VuYW1lcyk7XG5cdFx0aWYgKHdpdGhCYXNlbmFtZXMpIHtcblx0XHRcdHJlc3VsdEV4cHJlc3Npb24uYWxsQmFzZW5hbWVzID0gd2l0aEJhc2VuYW1lcy5hbGxCYXNlbmFtZXM7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWxsUGF0aHMgPSBwYXJzZWRQYXR0ZXJucy5yZWR1Y2UoKGFsbCwgY3VycmVudCkgPT4gY3VycmVudC5hbGxQYXRocyA/IGFsbC5jb25jYXQoY3VycmVudC5hbGxQYXRocykgOiBhbGwsIFtdIGFzIHN0cmluZ1tdKTtcblx0XHRpZiAoYWxsUGF0aHMubGVuZ3RoKSB7XG5cdFx0XHRyZXN1bHRFeHByZXNzaW9uLmFsbFBhdGhzID0gYWxsUGF0aHM7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdEV4cHJlc3Npb247XG5cdH1cblxuXHRjb25zdCByZXN1bHRFeHByZXNzaW9uOiBQYXJzZWRTdHJpbmdQYXR0ZXJuID0gZnVuY3Rpb24gKHBhdGg6IHN0cmluZywgYmFzZT86IHN0cmluZywgaGFzU2libGluZz86IChuYW1lOiBzdHJpbmcpID0+IGJvb2xlYW4gfCBQcm9taXNlPGJvb2xlYW4+KSB7XG5cdFx0bGV0IG5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgcmVzdWx0UHJvbWlzZXM6IFByb21pc2U8c3RyaW5nIHwgbnVsbD5bXSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdGZvciAobGV0IGkgPSAwLCBuID0gcGFyc2VkUGF0dGVybnMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG5cblx0XHRcdC8vIFBhdHRlcm4gbWF0Y2hlcyBwYXRoXG5cdFx0XHRjb25zdCBwYXJzZWRQYXR0ZXJuID0gKDxQYXJzZWRFeHByZXNzaW9uUGF0dGVybj5wYXJzZWRQYXR0ZXJuc1tpXSk7XG5cdFx0XHRpZiAocGFyc2VkUGF0dGVybi5yZXF1aXJlc1NpYmxpbmdzICYmIGhhc1NpYmxpbmcpIHtcblx0XHRcdFx0aWYgKCFiYXNlKSB7XG5cdFx0XHRcdFx0YmFzZSA9IGJhc2VuYW1lKHBhdGgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCFuYW1lKSB7XG5cdFx0XHRcdFx0bmFtZSA9IGJhc2Uuc3Vic3RyKDAsIGJhc2UubGVuZ3RoIC0gZXh0bmFtZShwYXRoKS5sZW5ndGgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IHBhcnNlZFBhdHRlcm4ocGF0aCwgYmFzZSwgbmFtZSwgaGFzU2libGluZyk7XG5cdFx0XHRpZiAodHlwZW9mIHJlc3VsdCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDsgLy8gaW1tZWRpYXRlbHkgcmV0dXJuIGFzIHNvb24gYXMgdGhlIGZpcnN0IGV4cHJlc3Npb24gbWF0Y2hlc1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBJZiB0aGUgcmVzdWx0IGlzIGEgcHJvbWlzZSwgd2UgaGF2ZSB0byBrZWVwIGl0IGZvclxuXHRcdFx0Ly8gbGF0ZXIgcHJvY2Vzc2luZyBhbmQgYXdhaXQgdGhlIHJlc3VsdCBwcm9wZXJseS5cblx0XHRcdGlmIChpc1RoZW5hYmxlKHJlc3VsdCkpIHtcblx0XHRcdFx0aWYgKCFyZXN1bHRQcm9taXNlcykge1xuXHRcdFx0XHRcdHJlc3VsdFByb21pc2VzID0gW107XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXN1bHRQcm9taXNlcy5wdXNoKHJlc3VsdCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gV2l0aCByZXN1bHQgcHJvbWlzZXMsIHdlIGhhdmUgdG8gbG9vcCBvdmVyIGVhY2ggYW5kXG5cdFx0Ly8gYXdhaXQgdGhlIHJlc3VsdCBiZWZvcmUgd2UgY2FuIHJldHVybiBhbnkgcmVzdWx0LlxuXHRcdGlmIChyZXN1bHRQcm9taXNlcykge1xuXHRcdFx0cmV0dXJuIChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGZvciAoY29uc3QgcmVzdWx0UHJvbWlzZSBvZiByZXN1bHRQcm9taXNlcykge1xuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3VsdFByb21pc2U7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiByZXN1bHQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fSkoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fTtcblxuXHRjb25zdCB3aXRoQmFzZW5hbWVzID0gcGFyc2VkUGF0dGVybnMuZmluZChwYXR0ZXJuID0+ICEhcGF0dGVybi5hbGxCYXNlbmFtZXMpO1xuXHRpZiAod2l0aEJhc2VuYW1lcykge1xuXHRcdHJlc3VsdEV4cHJlc3Npb24uYWxsQmFzZW5hbWVzID0gd2l0aEJhc2VuYW1lcy5hbGxCYXNlbmFtZXM7XG5cdH1cblxuXHRjb25zdCBhbGxQYXRocyA9IHBhcnNlZFBhdHRlcm5zLnJlZHVjZSgoYWxsLCBjdXJyZW50KSA9PiBjdXJyZW50LmFsbFBhdGhzID8gYWxsLmNvbmNhdChjdXJyZW50LmFsbFBhdGhzKSA6IGFsbCwgW10gYXMgc3RyaW5nW10pO1xuXHRpZiAoYWxsUGF0aHMubGVuZ3RoKSB7XG5cdFx0cmVzdWx0RXhwcmVzc2lvbi5hbGxQYXRocyA9IGFsbFBhdGhzO1xuXHR9XG5cblx0cmV0dXJuIHJlc3VsdEV4cHJlc3Npb247XG59XG5cbmZ1bmN0aW9uIHBhcnNlRXhwcmVzc2lvblBhdHRlcm4ocGF0dGVybjogc3RyaW5nLCB2YWx1ZTogYm9vbGVhbiB8IFNpYmxpbmdDbGF1c2UsIG9wdGlvbnM6IElHbG9iT3B0aW9ucyk6IChQYXJzZWRTdHJpbmdQYXR0ZXJuIHwgUGFyc2VkRXhwcmVzc2lvblBhdHRlcm4pIHtcblx0aWYgKHZhbHVlID09PSBmYWxzZSkge1xuXHRcdHJldHVybiBOVUxMOyAvLyBwYXR0ZXJuIGlzIGRpc2FibGVkXG5cdH1cblxuXHRjb25zdCBwYXJzZWRQYXR0ZXJuID0gcGFyc2VQYXR0ZXJuKHBhdHRlcm4sIG9wdGlvbnMpO1xuXHRpZiAocGFyc2VkUGF0dGVybiA9PT0gTlVMTCkge1xuXHRcdHJldHVybiBOVUxMO1xuXHR9XG5cblx0Ly8gRXhwcmVzc2lvbiBQYXR0ZXJuIGlzIDxib29sZWFuPlxuXHRpZiAodHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicpIHtcblx0XHRyZXR1cm4gcGFyc2VkUGF0dGVybjtcblx0fVxuXG5cdC8vIEV4cHJlc3Npb24gUGF0dGVybiBpcyA8U2libGluZ0NsYXVzZT5cblx0aWYgKHZhbHVlKSB7XG5cdFx0Y29uc3Qgd2hlbiA9IHZhbHVlLndoZW47XG5cdFx0aWYgKHR5cGVvZiB3aGVuID09PSAnc3RyaW5nJykge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBQYXJzZWRFeHByZXNzaW9uUGF0dGVybiA9IChwYXRoOiBzdHJpbmcsIGJhc2VuYW1lPzogc3RyaW5nLCBuYW1lPzogc3RyaW5nLCBoYXNTaWJsaW5nPzogKG5hbWU6IHN0cmluZykgPT4gYm9vbGVhbiB8IFByb21pc2U8Ym9vbGVhbj4pID0+IHtcblx0XHRcdFx0aWYgKCFoYXNTaWJsaW5nIHx8ICFwYXJzZWRQYXR0ZXJuKHBhdGgsIGJhc2VuYW1lKSkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgY2xhdXNlUGF0dGVybiA9IHdoZW4ucmVwbGFjZSgnJChiYXNlbmFtZSknLCAoKSA9PiBuYW1lISk7XG5cdFx0XHRcdGNvbnN0IG1hdGNoZWQgPSBoYXNTaWJsaW5nKGNsYXVzZVBhdHRlcm4pO1xuXHRcdFx0XHRyZXR1cm4gaXNUaGVuYWJsZShtYXRjaGVkKSA/XG5cdFx0XHRcdFx0bWF0Y2hlZC50aGVuKG1hdGNoID0+IG1hdGNoID8gcGF0dGVybiA6IG51bGwpIDpcblx0XHRcdFx0XHRtYXRjaGVkID8gcGF0dGVybiA6IG51bGw7XG5cdFx0XHR9O1xuXG5cdFx0XHRyZXN1bHQucmVxdWlyZXNTaWJsaW5ncyA9IHRydWU7XG5cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHR9XG5cblx0Ly8gRXhwcmVzc2lvbiBpcyBhbnl0aGluZ1xuXHRyZXR1cm4gcGFyc2VkUGF0dGVybjtcbn1cblxuZnVuY3Rpb24gYWdncmVnYXRlQmFzZW5hbWVNYXRjaGVzKHBhcnNlZFBhdHRlcm5zOiBBcnJheTxQYXJzZWRTdHJpbmdQYXR0ZXJuIHwgUGFyc2VkRXhwcmVzc2lvblBhdHRlcm4+LCByZXN1bHQ/OiBzdHJpbmcpOiBBcnJheTxQYXJzZWRTdHJpbmdQYXR0ZXJuIHwgUGFyc2VkRXhwcmVzc2lvblBhdHRlcm4+IHtcblx0Y29uc3QgYmFzZW5hbWVQYXR0ZXJucyA9IHBhcnNlZFBhdHRlcm5zLmZpbHRlcihwYXJzZWRQYXR0ZXJuID0+ICEhKDxQYXJzZWRTdHJpbmdQYXR0ZXJuPnBhcnNlZFBhdHRlcm4pLmJhc2VuYW1lcyk7XG5cdGlmIChiYXNlbmFtZVBhdHRlcm5zLmxlbmd0aCA8IDIpIHtcblx0XHRyZXR1cm4gcGFyc2VkUGF0dGVybnM7XG5cdH1cblxuXHRjb25zdCBiYXNlbmFtZXMgPSBiYXNlbmFtZVBhdHRlcm5zLnJlZHVjZTxzdHJpbmdbXT4oKGFsbCwgY3VycmVudCkgPT4ge1xuXHRcdGNvbnN0IGJhc2VuYW1lcyA9ICg8UGFyc2VkU3RyaW5nUGF0dGVybj5jdXJyZW50KS5iYXNlbmFtZXM7XG5cblx0XHRyZXR1cm4gYmFzZW5hbWVzID8gYWxsLmNvbmNhdChiYXNlbmFtZXMpIDogYWxsO1xuXHR9LCBbXSBhcyBzdHJpbmdbXSk7XG5cblx0bGV0IHBhdHRlcm5zOiBzdHJpbmdbXTtcblx0aWYgKHJlc3VsdCkge1xuXHRcdHBhdHRlcm5zID0gW107XG5cblx0XHRmb3IgKGxldCBpID0gMCwgbiA9IGJhc2VuYW1lcy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcblx0XHRcdHBhdHRlcm5zLnB1c2gocmVzdWx0KTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0cGF0dGVybnMgPSBiYXNlbmFtZVBhdHRlcm5zLnJlZHVjZSgoYWxsLCBjdXJyZW50KSA9PiB7XG5cdFx0XHRjb25zdCBwYXR0ZXJucyA9ICg8UGFyc2VkU3RyaW5nUGF0dGVybj5jdXJyZW50KS5wYXR0ZXJucztcblxuXHRcdFx0cmV0dXJuIHBhdHRlcm5zID8gYWxsLmNvbmNhdChwYXR0ZXJucykgOiBhbGw7XG5cdFx0fSwgW10gYXMgc3RyaW5nW10pO1xuXHR9XG5cblx0Y29uc3QgYWdncmVnYXRlOiBQYXJzZWRTdHJpbmdQYXR0ZXJuID0gZnVuY3Rpb24gKHBhdGg6IHN0cmluZywgYmFzZW5hbWU/OiBzdHJpbmcpIHtcblx0XHRpZiAodHlwZW9mIHBhdGggIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAoIWJhc2VuYW1lKSB7XG5cdFx0XHRsZXQgaTogbnVtYmVyO1xuXHRcdFx0Zm9yIChpID0gcGF0aC5sZW5ndGg7IGkgPiAwOyBpLS0pIHtcblx0XHRcdFx0Y29uc3QgY2ggPSBwYXRoLmNoYXJDb2RlQXQoaSAtIDEpO1xuXHRcdFx0XHRpZiAoY2ggPT09IENoYXJDb2RlLlNsYXNoIHx8IGNoID09PSBDaGFyQ29kZS5CYWNrc2xhc2gpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRiYXNlbmFtZSA9IHBhdGguc3Vic3RyKGkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluZGV4ID0gYmFzZW5hbWVzLmluZGV4T2YoYmFzZW5hbWUpO1xuXHRcdHJldHVybiBpbmRleCAhPT0gLTEgPyBwYXR0ZXJuc1tpbmRleF0gOiBudWxsO1xuXHR9O1xuXG5cdGFnZ3JlZ2F0ZS5iYXNlbmFtZXMgPSBiYXNlbmFtZXM7XG5cdGFnZ3JlZ2F0ZS5wYXR0ZXJucyA9IHBhdHRlcm5zO1xuXHRhZ2dyZWdhdGUuYWxsQmFzZW5hbWVzID0gYmFzZW5hbWVzO1xuXG5cdGNvbnN0IGFnZ3JlZ2F0ZWRQYXR0ZXJucyA9IHBhcnNlZFBhdHRlcm5zLmZpbHRlcihwYXJzZWRQYXR0ZXJuID0+ICEoPFBhcnNlZFN0cmluZ1BhdHRlcm4+cGFyc2VkUGF0dGVybikuYmFzZW5hbWVzKTtcblx0YWdncmVnYXRlZFBhdHRlcm5zLnB1c2goYWdncmVnYXRlKTtcblxuXHRyZXR1cm4gYWdncmVnYXRlZFBhdHRlcm5zO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGF0dGVybnNFcXVhbHMocGF0dGVybnNBOiBBcnJheTxzdHJpbmcgfCBJUmVsYXRpdmVQYXR0ZXJuPiB8IHVuZGVmaW5lZCwgcGF0dGVybnNCOiBBcnJheTxzdHJpbmcgfCBJUmVsYXRpdmVQYXR0ZXJuPiB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gZXF1YWxzKHBhdHRlcm5zQSwgcGF0dGVybnNCLCAoYSwgYikgPT4ge1xuXHRcdGlmICh0eXBlb2YgYSA9PT0gJ3N0cmluZycgJiYgdHlwZW9mIGIgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gYSA9PT0gYjtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIGEgIT09ICdzdHJpbmcnICYmIHR5cGVvZiBiICE9PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIGEuYmFzZSA9PT0gYi5iYXNlICYmIGEucGF0dGVybiA9PT0gYi5wYXR0ZXJu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
