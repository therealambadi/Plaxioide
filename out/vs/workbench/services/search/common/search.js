import { mapArrayOrNot } from "../../../../base/common/arrays.js";
import * as glob from "../../../../base/common/glob.js";
import * as objects from "../../../../base/common/objects.js";
import * as extpath from "../../../../base/common/extpath.js";
import { fuzzyContains, getNLines } from "../../../../base/common/strings.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import * as paths from "../../../../base/common/path.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { TextSearchCompleteMessageType } from "./searchExtTypes.js";
import { isThenable } from "../../../../base/common/async.js";
const VIEWLET_ID = "workbench.view.search";
const PANEL_ID = "workbench.panel.search";
const VIEW_ID = "workbench.view.search";
const SEARCH_RESULT_LANGUAGE_ID = "search-result";
const SEARCH_EXCLUDE_CONFIG = "search.exclude";
const DEFAULT_MAX_SEARCH_RESULTS = 2e4;
const SEARCH_ELIDED_PREFIX = "\u27EA ";
const SEARCH_ELIDED_SUFFIX = " characters skipped \u27EB";
const SEARCH_ELIDED_MIN_LEN = (SEARCH_ELIDED_PREFIX.length + SEARCH_ELIDED_SUFFIX.length + 5) * 2;
const ISearchService = createDecorator("searchService");
var SearchProviderType = /* @__PURE__ */ ((SearchProviderType2) => {
  SearchProviderType2[SearchProviderType2["file"] = 0] = "file";
  SearchProviderType2[SearchProviderType2["text"] = 1] = "text";
  SearchProviderType2[SearchProviderType2["aiText"] = 2] = "aiText";
  return SearchProviderType2;
})(SearchProviderType || {});
var QueryType = /* @__PURE__ */ ((QueryType2) => {
  QueryType2[QueryType2["File"] = 1] = "File";
  QueryType2[QueryType2["Text"] = 2] = "Text";
  QueryType2[QueryType2["aiText"] = 3] = "aiText";
  return QueryType2;
})(QueryType || {});
function resultIsMatch(result) {
  return !!result.rangeLocations && !!result.previewText;
}
function isFileMatch(p) {
  return !!p.resource;
}
function isProgressMessage(p) {
  return !!p.message;
}
var SearchCompletionExitCode = /* @__PURE__ */ ((SearchCompletionExitCode2) => {
  SearchCompletionExitCode2[SearchCompletionExitCode2["Normal"] = 0] = "Normal";
  SearchCompletionExitCode2[SearchCompletionExitCode2["NewSearchStarted"] = 1] = "NewSearchStarted";
  return SearchCompletionExitCode2;
})(SearchCompletionExitCode || {});
class FileMatch {
  constructor(resource) {
    this.resource = resource;
    this.results = [];
  }
}
class TextSearchMatch {
  constructor(text, ranges, previewOptions, webviewIndex) {
    this.rangeLocations = [];
    this.webviewIndex = webviewIndex;
    const rangesArr = Array.isArray(ranges) ? ranges : [ranges];
    if (previewOptions && previewOptions.matchLines === 1 && isSingleLineRangeList(rangesArr)) {
      text = getNLines(text, previewOptions.matchLines);
      let result = "";
      let shift = 0;
      let lastEnd = 0;
      const leadingChars = Math.floor(previewOptions.charsPerLine / 5);
      for (const range of rangesArr) {
        const previewStart = Math.max(range.startColumn - leadingChars, 0);
        const previewEnd = range.startColumn + previewOptions.charsPerLine;
        if (previewStart > lastEnd + leadingChars + SEARCH_ELIDED_MIN_LEN) {
          const elision = SEARCH_ELIDED_PREFIX + (previewStart - lastEnd) + SEARCH_ELIDED_SUFFIX;
          result += elision + text.slice(previewStart, previewEnd);
          shift += previewStart - (lastEnd + elision.length);
        } else {
          result += text.slice(lastEnd, previewEnd);
        }
        lastEnd = previewEnd;
        this.rangeLocations.push({
          source: range,
          preview: new OneLineRange(0, range.startColumn - shift, range.endColumn - shift)
        });
      }
      this.previewText = result;
    } else {
      const firstMatchLine = Array.isArray(ranges) ? ranges[0].startLineNumber : ranges.startLineNumber;
      const rangeLocs = mapArrayOrNot(ranges, (r) => ({
        preview: new SearchRange(r.startLineNumber - firstMatchLine, r.startColumn, r.endLineNumber - firstMatchLine, r.endColumn),
        source: r
      }));
      this.rangeLocations = Array.isArray(rangeLocs) ? rangeLocs : [rangeLocs];
      this.previewText = text;
    }
  }
}
function isSingleLineRangeList(ranges) {
  const line = ranges[0].startLineNumber;
  for (const r of ranges) {
    if (r.startLineNumber !== line || r.endLineNumber !== line) {
      return false;
    }
  }
  return true;
}
class SearchRange {
  constructor(startLineNumber, startColumn, endLineNumber, endColumn) {
    this.startLineNumber = startLineNumber;
    this.startColumn = startColumn;
    this.endLineNumber = endLineNumber;
    this.endColumn = endColumn;
  }
}
class OneLineRange extends SearchRange {
  constructor(lineNumber, startColumn, endColumn) {
    super(lineNumber, startColumn, lineNumber, endColumn);
  }
}
var ViewMode = /* @__PURE__ */ ((ViewMode2) => {
  ViewMode2["List"] = "list";
  ViewMode2["Tree"] = "tree";
  return ViewMode2;
})(ViewMode || {});
var SearchSortOrder = /* @__PURE__ */ ((SearchSortOrder2) => {
  SearchSortOrder2["Default"] = "default";
  SearchSortOrder2["FileNames"] = "fileNames";
  SearchSortOrder2["Type"] = "type";
  SearchSortOrder2["Modified"] = "modified";
  SearchSortOrder2["CountDescending"] = "countDescending";
  SearchSortOrder2["CountAscending"] = "countAscending";
  return SearchSortOrder2;
})(SearchSortOrder || {});
function getExcludes(configuration, includeSearchExcludes = true) {
  const fileExcludes = configuration && configuration.files && configuration.files.exclude;
  const searchExcludes = includeSearchExcludes && configuration && configuration.search && configuration.search.exclude;
  if (!fileExcludes && !searchExcludes) {
    return void 0;
  }
  if (!fileExcludes || !searchExcludes) {
    return fileExcludes || searchExcludes || void 0;
  }
  let allExcludes = /* @__PURE__ */ Object.create(null);
  allExcludes = objects.mixin(allExcludes, objects.deepClone(fileExcludes));
  allExcludes = objects.mixin(allExcludes, objects.deepClone(searchExcludes), true);
  return allExcludes;
}
function pathIncludedInQuery(queryProps, fsPath) {
  if (queryProps.excludePattern && glob.match(queryProps.excludePattern, fsPath)) {
    return false;
  }
  if (queryProps.includePattern || queryProps.usingSearchPaths) {
    if (queryProps.includePattern && glob.match(queryProps.includePattern, fsPath)) {
      return true;
    }
    if (queryProps.usingSearchPaths) {
      return !!queryProps.folderQueries && queryProps.folderQueries.some((fq) => {
        const searchPath = fq.folder.fsPath;
        if (extpath.isEqualOrParent(fsPath, searchPath)) {
          const relPath = paths.relative(searchPath, fsPath);
          return !fq.includePattern || !!glob.match(fq.includePattern, relPath);
        } else {
          return false;
        }
      });
    }
    return false;
  }
  return true;
}
var SearchErrorCode = /* @__PURE__ */ ((SearchErrorCode2) => {
  SearchErrorCode2[SearchErrorCode2["unknownEncoding"] = 1] = "unknownEncoding";
  SearchErrorCode2[SearchErrorCode2["regexParseError"] = 2] = "regexParseError";
  SearchErrorCode2[SearchErrorCode2["globParseError"] = 3] = "globParseError";
  SearchErrorCode2[SearchErrorCode2["invalidLiteral"] = 4] = "invalidLiteral";
  SearchErrorCode2[SearchErrorCode2["rgProcessError"] = 5] = "rgProcessError";
  SearchErrorCode2[SearchErrorCode2["other"] = 6] = "other";
  SearchErrorCode2[SearchErrorCode2["canceled"] = 7] = "canceled";
  return SearchErrorCode2;
})(SearchErrorCode || {});
class SearchError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}
function deserializeSearchError(error) {
  const errorMsg = error.message;
  if (isCancellationError(error)) {
    return new SearchError(errorMsg, 7 /* canceled */);
  }
  try {
    const details = JSON.parse(errorMsg);
    return new SearchError(details.message, details.code);
  } catch (e) {
    return new SearchError(errorMsg, 6 /* other */);
  }
}
function serializeSearchError(searchError) {
  const details = { message: searchError.message, code: searchError.code };
  return new Error(JSON.stringify(details));
}
function isSerializedSearchComplete(arg) {
  if (arg.type === "error") {
    return true;
  } else if (arg.type === "success") {
    return true;
  } else {
    return false;
  }
}
function isSerializedSearchSuccess(arg) {
  return arg.type === "success";
}
function isSerializedFileMatch(arg) {
  return !!arg.path;
}
function isFilePatternMatch(candidate, filePatternToUse, fuzzy = true) {
  const pathToMatch = candidate.searchPath ? candidate.searchPath : candidate.relativePath;
  return fuzzy ? fuzzyContains(pathToMatch, filePatternToUse) : glob.match(filePatternToUse, pathToMatch);
}
class SerializableFileMatch {
  constructor(path) {
    this.path = path;
    this.results = [];
  }
  addMatch(match) {
    this.results.push(match);
  }
  serialize() {
    return {
      path: this.path,
      results: this.results,
      numMatches: this.results.length
    };
  }
}
function resolvePatternsForProvider(globalPattern, folderPattern) {
  const merged = {
    ...globalPattern || {},
    ...folderPattern || {}
  };
  return Object.keys(merged).filter((key) => {
    const value = merged[key];
    return typeof value === "boolean" && value;
  });
}
class QueryGlobTester {
  constructor(config, folderQuery) {
    this._parsedIncludeExpression = null;
    this._excludeExpression = folderQuery.excludePattern?.map((excludePattern) => {
      return {
        ...config.excludePattern || {},
        ...excludePattern.pattern || {}
      };
    }) ?? [];
    if (this._excludeExpression.length === 0) {
      this._excludeExpression = [config.excludePattern || {}];
    }
    this._parsedExcludeExpression = this._excludeExpression.map((e) => glob.parse(e));
    let includeExpression = config.includePattern;
    if (folderQuery.includePattern) {
      if (includeExpression) {
        includeExpression = {
          ...includeExpression,
          ...folderQuery.includePattern
        };
      } else {
        includeExpression = folderQuery.includePattern;
      }
    }
    if (includeExpression) {
      this._parsedIncludeExpression = glob.parse(includeExpression);
    }
  }
  _evalParsedExcludeExpression(testPath, basename, hasSibling) {
    let result = null;
    for (const folderExclude of this._parsedExcludeExpression) {
      const evaluation = folderExclude(testPath, basename, hasSibling);
      if (typeof evaluation === "string") {
        result = evaluation;
        break;
      }
    }
    return result;
  }
  matchesExcludesSync(testPath, basename, hasSibling) {
    if (this._parsedExcludeExpression && this._evalParsedExcludeExpression(testPath, basename, hasSibling)) {
      return true;
    }
    return false;
  }
  /**
   * Guaranteed sync - siblingsFn should not return a promise.
   */
  includedInQuerySync(testPath, basename, hasSibling) {
    if (this._parsedExcludeExpression && this._evalParsedExcludeExpression(testPath, basename, hasSibling)) {
      return false;
    }
    if (this._parsedIncludeExpression && !this._parsedIncludeExpression(testPath, basename, hasSibling)) {
      return false;
    }
    return true;
  }
  /**
   * Evaluating the exclude expression is only async if it includes sibling clauses. As an optimization, avoid doing anything with Promises
   * unless the expression is async.
   */
  includedInQuery(testPath, basename, hasSibling) {
    const isIncluded = () => {
      return this._parsedIncludeExpression ? !!this._parsedIncludeExpression(testPath, basename, hasSibling) : true;
    };
    return Promise.all(this._parsedExcludeExpression.map((e) => {
      const excluded = e(testPath, basename, hasSibling);
      if (isThenable(excluded)) {
        return excluded.then((excluded2) => {
          if (excluded2) {
            return false;
          }
          return isIncluded();
        });
      }
      return isIncluded();
    })).then((e) => e.some((e2) => !!e2));
  }
  hasSiblingExcludeClauses() {
    return this._excludeExpression.reduce((prev, curr) => hasSiblingClauses(curr) || prev, false);
  }
}
function hasSiblingClauses(pattern) {
  for (const key in pattern) {
    if (typeof pattern[key] !== "boolean") {
      return true;
    }
  }
  return false;
}
function hasSiblingPromiseFn(siblingsFn) {
  if (!siblingsFn) {
    return void 0;
  }
  let siblings;
  return (name) => {
    if (!siblings) {
      siblings = (siblingsFn() || Promise.resolve([])).then((list) => list ? listToMap(list) : {});
    }
    return siblings.then((map) => !!map[name]);
  };
}
function hasSiblingFn(siblingsFn) {
  if (!siblingsFn) {
    return void 0;
  }
  let siblings;
  return (name) => {
    if (!siblings) {
      const list = siblingsFn();
      siblings = list ? listToMap(list) : {};
    }
    return !!siblings[name];
  };
}
function listToMap(list) {
  const map = {};
  for (const key of list) {
    map[key] = true;
  }
  return map;
}
function excludeToGlobPattern(excludesForFolder) {
  return excludesForFolder.flatMap((exclude) => exclude.patterns.map((pattern) => {
    return exclude.baseUri ? {
      baseUri: exclude.baseUri,
      pattern
    } : pattern;
  }));
}
const DEFAULT_TEXT_SEARCH_PREVIEW_OPTIONS = {
  matchLines: 100,
  charsPerLine: 1e4
};
export {
  DEFAULT_MAX_SEARCH_RESULTS,
  DEFAULT_TEXT_SEARCH_PREVIEW_OPTIONS,
  FileMatch,
  ISearchService,
  OneLineRange,
  PANEL_ID,
  QueryGlobTester,
  QueryType,
  SEARCH_EXCLUDE_CONFIG,
  SEARCH_RESULT_LANGUAGE_ID,
  SearchCompletionExitCode,
  SearchError,
  SearchErrorCode,
  SearchProviderType,
  SearchRange,
  SearchSortOrder,
  SerializableFileMatch,
  TextSearchCompleteMessageType,
  TextSearchMatch,
  VIEWLET_ID,
  VIEW_ID,
  ViewMode,
  deserializeSearchError,
  excludeToGlobPattern,
  getExcludes,
  hasSiblingFn,
  hasSiblingPromiseFn,
  isFileMatch,
  isFilePatternMatch,
  isProgressMessage,
  isSerializedFileMatch,
  isSerializedSearchComplete,
  isSerializedSearchSuccess,
  pathIncludedInQuery,
  resolvePatternsForProvider,
  resultIsMatch,
  serializeSearchError
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2gudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBtYXBBcnJheU9yTm90IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZ2xvYi5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgKiBhcyBvYmplY3RzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0ICogYXMgZXh0cGF0aCBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9leHRwYXRoLmpzJztcbmltcG9ydCB7IGZ1enp5Q29udGFpbnMsIGdldE5MaW5lcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElGaWxlc0NvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5RGF0YSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0ICogYXMgcGF0aHMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEdsb2JQYXR0ZXJuLCBUZXh0U2VhcmNoQ29tcGxldGVNZXNzYWdlVHlwZSB9IGZyb20gJy4vc2VhcmNoRXh0VHlwZXMuanMnO1xuaW1wb3J0IHsgaXNUaGVuYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IFJlc291cmNlU2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcblxuZXhwb3J0IHsgVGV4dFNlYXJjaENvbXBsZXRlTWVzc2FnZVR5cGUgfTtcblxuZXhwb3J0IGNvbnN0IFZJRVdMRVRfSUQgPSAnd29ya2JlbmNoLnZpZXcuc2VhcmNoJztcbmV4cG9ydCBjb25zdCBQQU5FTF9JRCA9ICd3b3JrYmVuY2gucGFuZWwuc2VhcmNoJztcbmV4cG9ydCBjb25zdCBWSUVXX0lEID0gJ3dvcmtiZW5jaC52aWV3LnNlYXJjaCc7XG5leHBvcnQgY29uc3QgU0VBUkNIX1JFU1VMVF9MQU5HVUFHRV9JRCA9ICdzZWFyY2gtcmVzdWx0JztcblxuZXhwb3J0IGNvbnN0IFNFQVJDSF9FWENMVURFX0NPTkZJRyA9ICdzZWFyY2guZXhjbHVkZSc7XG5leHBvcnQgY29uc3QgREVGQVVMVF9NQVhfU0VBUkNIX1JFU1VMVFMgPSAyMDAwMDtcblxuLy8gV2FybmluZzogdGhpcyBwYXR0ZXJuIGlzIHVzZWQgaW4gdGhlIHNlYXJjaCBlZGl0b3IgdG8gZGV0ZWN0IG9mZnNldHMuIElmIHlvdVxuLy8gY2hhbmdlIHRoaXMsIGFsc28gY2hhbmdlIHRoZSBzZWFyY2gtcmVzdWx0IGJ1aWx0LWluIGV4dGVuc2lvblxuY29uc3QgU0VBUkNIX0VMSURFRF9QUkVGSVggPSAnXHUyN0VBICc7XG5jb25zdCBTRUFSQ0hfRUxJREVEX1NVRkZJWCA9ICcgY2hhcmFjdGVycyBza2lwcGVkIFx1MjdFQic7XG5jb25zdCBTRUFSQ0hfRUxJREVEX01JTl9MRU4gPSAoU0VBUkNIX0VMSURFRF9QUkVGSVgubGVuZ3RoICsgU0VBUkNIX0VMSURFRF9TVUZGSVgubGVuZ3RoICsgNSkgKiAyO1xuXG5leHBvcnQgY29uc3QgSVNlYXJjaFNlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SVNlYXJjaFNlcnZpY2U+KCdzZWFyY2hTZXJ2aWNlJyk7XG5cbi8qKlxuICogQSBzZXJ2aWNlIHRoYXQgZW5hYmxlcyB0byBzZWFyY2ggZm9yIGZpbGVzIG9yIHdpdGggaW4gZmlsZXMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSVNlYXJjaFNlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHRleHRTZWFyY2gocXVlcnk6IElUZXh0UXVlcnksIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4sIG9uUHJvZ3Jlc3M/OiAocmVzdWx0OiBJU2VhcmNoUHJvZ3Jlc3NJdGVtKSA9PiB2b2lkKTogUHJvbWlzZTxJU2VhcmNoQ29tcGxldGU+O1xuXHRhaVRleHRTZWFyY2gocXVlcnk6IElBSVRleHRRdWVyeSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbiwgb25Qcm9ncmVzcz86IChyZXN1bHQ6IElTZWFyY2hQcm9ncmVzc0l0ZW0pID0+IHZvaWQpOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT47XG5cdGdldEFJTmFtZSgpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD47XG5cdHRleHRTZWFyY2hTcGxpdFN5bmNBc3luYyhxdWVyeTogSVRleHRRdWVyeSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbiB8IHVuZGVmaW5lZCwgb25Qcm9ncmVzcz86ICgocmVzdWx0OiBJU2VhcmNoUHJvZ3Jlc3NJdGVtKSA9PiB2b2lkKSB8IHVuZGVmaW5lZCwgbm90ZWJvb2tGaWxlc1RvSWdub3JlPzogUmVzb3VyY2VTZXQsIGFzeW5jTm90ZWJvb2tGaWxlc1RvSWdub3JlPzogUHJvbWlzZTxSZXNvdXJjZVNldD4pOiB7IHN5bmNSZXN1bHRzOiBJU2VhcmNoQ29tcGxldGU7IGFzeW5jUmVzdWx0czogUHJvbWlzZTxJU2VhcmNoQ29tcGxldGU+IH07XG5cdGZpbGVTZWFyY2gocXVlcnk6IElGaWxlUXVlcnksIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT47XG5cdHNjaGVtZUhhc0ZpbGVTZWFyY2hQcm92aWRlcihzY2hlbWU6IHN0cmluZyk6IGJvb2xlYW47XG5cdGNsZWFyQ2FjaGUoY2FjaGVLZXk6IHN0cmluZyk6IFByb21pc2U8dm9pZD47XG5cdHJlZ2lzdGVyU2VhcmNoUmVzdWx0UHJvdmlkZXIoc2NoZW1lOiBzdHJpbmcsIHR5cGU6IFNlYXJjaFByb3ZpZGVyVHlwZSwgcHJvdmlkZXI6IElTZWFyY2hSZXN1bHRQcm92aWRlcik6IElEaXNwb3NhYmxlO1xufVxuXG4vKipcbiAqIFRPRE9Acm9ibG91IC0gc3BsaXQgdGV4dCBmcm9tIGZpbGUgc2VhcmNoIGVudGlyZWx5LCBvciBzaGFyZSBjb2RlIGluIGEgbW9yZSBuYXR1cmFsIHdheS5cbiAqL1xuZXhwb3J0IGNvbnN0IGVudW0gU2VhcmNoUHJvdmlkZXJUeXBlIHtcblx0ZmlsZSxcblx0dGV4dCxcblx0YWlUZXh0XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNlYXJjaFJlc3VsdFByb3ZpZGVyIHtcblx0Z2V0QUlOYW1lKCk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPjtcblx0dGV4dFNlYXJjaChxdWVyeTogSVRleHRRdWVyeSwgb25Qcm9ncmVzcz86IChwOiBJU2VhcmNoUHJvZ3Jlc3NJdGVtKSA9PiB2b2lkLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJU2VhcmNoQ29tcGxldGU+O1xuXHRmaWxlU2VhcmNoKHF1ZXJ5OiBJRmlsZVF1ZXJ5LCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJU2VhcmNoQ29tcGxldGU+O1xuXHRjbGVhckNhY2hlKGNhY2hlS2V5OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+O1xufVxuXG5cbmV4cG9ydCBpbnRlcmZhY2UgRXhjbHVkZUdsb2JQYXR0ZXJuPFUgZXh0ZW5kcyBVcmlDb21wb25lbnRzID0gVVJJPiB7XG5cdGZvbGRlcj86IFU7XG5cdHBhdHRlcm46IGdsb2IuSUV4cHJlc3Npb247XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZvbGRlclF1ZXJ5PFUgZXh0ZW5kcyBVcmlDb21wb25lbnRzID0gVVJJPiB7XG5cdGZvbGRlcjogVTtcblx0Zm9sZGVyTmFtZT86IHN0cmluZztcblx0ZXhjbHVkZVBhdHRlcm4/OiBFeGNsdWRlR2xvYlBhdHRlcm48VT5bXTtcblx0aW5jbHVkZVBhdHRlcm4/OiBnbG9iLklFeHByZXNzaW9uO1xuXHRmaWxlRW5jb2Rpbmc/OiBzdHJpbmc7XG5cdGRpc3JlZ2FyZElnbm9yZUZpbGVzPzogYm9vbGVhbjtcblx0ZGlzcmVnYXJkR2xvYmFsSWdub3JlRmlsZXM/OiBib29sZWFuO1xuXHRkaXNyZWdhcmRQYXJlbnRJZ25vcmVGaWxlcz86IGJvb2xlYW47XG5cdGlnbm9yZVN5bWxpbmtzPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29tbW9uUXVlcnlQcm9wczxVIGV4dGVuZHMgVXJpQ29tcG9uZW50cz4ge1xuXHQvKiogRm9yIHRlbGVtZXRyeSAtIGluZGljYXRlcyB3aGF0IGlzIHRyaWdnZXJpbmcgdGhlIHNvdXJjZSAqL1xuXHRfcmVhc29uPzogc3RyaW5nO1xuXG5cdGZvbGRlclF1ZXJpZXM6IElGb2xkZXJRdWVyeTxVPltdO1xuXHQvLyBUaGUgaW5jbHVkZSBwYXR0ZXJuIGZvciBmaWxlcyB0aGF0IGdldHMgcGFzc2VkIGludG8gcmlwZ3JlcC5cblx0Ly8gTm90ZSB0aGF0IHRoaXMgd2lsbCBvdmVycmlkZSBhbnkgaWdub3JlIGZpbGVzIGlmIGFwcGxpY2FibGUuXG5cdGluY2x1ZGVQYXR0ZXJuPzogZ2xvYi5JRXhwcmVzc2lvbjtcblx0ZXhjbHVkZVBhdHRlcm4/OiBnbG9iLklFeHByZXNzaW9uO1xuXHRleHRyYUZpbGVSZXNvdXJjZXM/OiBVW107XG5cblx0b25seU9wZW5FZGl0b3JzPzogYm9vbGVhbjtcblxuXHRtYXhSZXN1bHRzPzogbnVtYmVyO1xuXHR1c2luZ1NlYXJjaFBhdGhzPzogYm9vbGVhbjtcblx0b25seUZpbGVTY2hlbWU/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlUXVlcnlQcm9wczxVIGV4dGVuZHMgVXJpQ29tcG9uZW50cz4gZXh0ZW5kcyBJQ29tbW9uUXVlcnlQcm9wczxVPiB7XG5cdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlO1xuXHRmaWxlUGF0dGVybj86IHN0cmluZztcblxuXHQvLyB3aGVuIHdhbGtpbmcgdGhyb3VnaCB0aGUgdHJlZSB0byBmaW5kIHRoZSByZXN1bHQsIGRvbid0IHVzZSB0aGUgZmlsZVBhdHRlcm4gdG8gZnV6enkgbWF0Y2guXG5cdC8vIEluc3RlYWQsIHNob3VsZCB1c2UgZ2xvYiBtYXRjaGluZy5cblx0c2hvdWxkR2xvYk1hdGNoRmlsZVBhdHRlcm4/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBJZiB0cnVlIG5vIHJlc3VsdHMgd2lsbCBiZSByZXR1cm5lZC4gSW5zdGVhZCBgbGltaXRIaXRgIHdpbGwgaW5kaWNhdGUgaWYgYXQgbGVhc3Qgb25lIHJlc3VsdCBleGlzdHMgb3Igbm90LlxuXHQgKiBDdXJyZW50bHkgZG9lcyBub3Qgd29yayB3aXRoIHF1ZXJpZXMgaW5jbHVkaW5nIGEgJ3NpYmxpbmdzIGNsYXVzZScuXG5cdCAqL1xuXHRleGlzdHM/OiBib29sZWFuO1xuXHRzb3J0QnlTY29yZT86IGJvb2xlYW47XG5cdGNhY2hlS2V5Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUZXh0UXVlcnlQcm9wczxVIGV4dGVuZHMgVXJpQ29tcG9uZW50cz4gZXh0ZW5kcyBJQ29tbW9uUXVlcnlQcm9wczxVPiB7XG5cdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0O1xuXHRjb250ZW50UGF0dGVybjogSVBhdHRlcm5JbmZvO1xuXG5cdHByZXZpZXdPcHRpb25zPzogSVRleHRTZWFyY2hQcmV2aWV3T3B0aW9ucztcblx0bWF4RmlsZVNpemU/OiBudW1iZXI7XG5cdHVzZVBDUkUyPzogYm9vbGVhbjtcblx0c3Vycm91bmRpbmdDb250ZXh0PzogbnVtYmVyO1xuXG5cdHVzZXJEaXNhYmxlZEV4Y2x1ZGVzQW5kSWdub3JlRmlsZXM/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElBSVRleHRRdWVyeVByb3BzPFUgZXh0ZW5kcyBVcmlDb21wb25lbnRzPiBleHRlbmRzIElDb21tb25RdWVyeVByb3BzPFU+IHtcblx0dHlwZTogUXVlcnlUeXBlLmFpVGV4dDtcblx0Y29udGVudFBhdHRlcm46IHN0cmluZztcblxuXHRwcmV2aWV3T3B0aW9ucz86IElUZXh0U2VhcmNoUHJldmlld09wdGlvbnM7XG5cdG1heEZpbGVTaXplPzogbnVtYmVyO1xuXHRzdXJyb3VuZGluZ0NvbnRleHQ/OiBudW1iZXI7XG5cblx0dXNlckRpc2FibGVkRXhjbHVkZXNBbmRJZ25vcmVGaWxlcz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCB0eXBlIElGaWxlUXVlcnkgPSBJRmlsZVF1ZXJ5UHJvcHM8VVJJPjtcbmV4cG9ydCB0eXBlIElSYXdGaWxlUXVlcnkgPSBJRmlsZVF1ZXJ5UHJvcHM8VXJpQ29tcG9uZW50cz47XG5leHBvcnQgdHlwZSBJVGV4dFF1ZXJ5ID0gSVRleHRRdWVyeVByb3BzPFVSST47XG5leHBvcnQgdHlwZSBJUmF3VGV4dFF1ZXJ5ID0gSVRleHRRdWVyeVByb3BzPFVyaUNvbXBvbmVudHM+O1xuZXhwb3J0IHR5cGUgSUFJVGV4dFF1ZXJ5ID0gSUFJVGV4dFF1ZXJ5UHJvcHM8VVJJPjtcbmV4cG9ydCB0eXBlIElSYXdBSVRleHRRdWVyeSA9IElBSVRleHRRdWVyeVByb3BzPFVyaUNvbXBvbmVudHM+O1xuXG5leHBvcnQgdHlwZSBJUmF3UXVlcnkgPSBJUmF3VGV4dFF1ZXJ5IHwgSVJhd0ZpbGVRdWVyeSB8IElSYXdBSVRleHRRdWVyeTtcbmV4cG9ydCB0eXBlIElTZWFyY2hRdWVyeSA9IElUZXh0UXVlcnkgfCBJRmlsZVF1ZXJ5IHwgSUFJVGV4dFF1ZXJ5O1xuZXhwb3J0IHR5cGUgSVRleHRTZWFyY2hRdWVyeSA9IElUZXh0UXVlcnkgfCBJQUlUZXh0UXVlcnk7XG5cbmV4cG9ydCBjb25zdCBlbnVtIFF1ZXJ5VHlwZSB7XG5cdEZpbGUgPSAxLFxuXHRUZXh0ID0gMixcblx0YWlUZXh0ID0gM1xufVxuXG4vKiBfX0dEUFJfX0ZSQUdNRU5UX19cblx0XCJJUGF0dGVybkluZm9cIiA6IHtcblx0XHRcImlzUmVnRXhwXCI6IHsgXCJjbGFzc2lmaWNhdGlvblwiOiBcIlN5c3RlbU1ldGFEYXRhXCIsIFwicHVycG9zZVwiOiBcIkZlYXR1cmVJbnNpZ2h0XCIsIFwiaXNNZWFzdXJlbWVudFwiOiB0cnVlIH0sXG5cdFx0XCJpc1dvcmRNYXRjaFwiOiB7IFwiY2xhc3NpZmljYXRpb25cIjogXCJTeXN0ZW1NZXRhRGF0YVwiLCBcInB1cnBvc2VcIjogXCJGZWF0dXJlSW5zaWdodFwiLCBcImlzTWVhc3VyZW1lbnRcIjogdHJ1ZSB9LFxuXHRcdFwid29yZFNlcGFyYXRvcnNcIjogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiU3lzdGVtTWV0YURhdGFcIiwgXCJwdXJwb3NlXCI6IFwiRmVhdHVyZUluc2lnaHRcIiB9LFxuXHRcdFwiaXNNdWx0aWxpbmVcIjogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiU3lzdGVtTWV0YURhdGFcIiwgXCJwdXJwb3NlXCI6IFwiRmVhdHVyZUluc2lnaHRcIiwgXCJpc01lYXN1cmVtZW50XCI6IHRydWUgfSxcblx0XHRcImlzQ2FzZVNlbnNpdGl2ZVwiOiB7IFwiY2xhc3NpZmljYXRpb25cIjogXCJTeXN0ZW1NZXRhRGF0YVwiLCBcInB1cnBvc2VcIjogXCJGZWF0dXJlSW5zaWdodFwiLCBcImlzTWVhc3VyZW1lbnRcIjogdHJ1ZSB9LFxuXHRcdFwiaXNTbWFydENhc2VcIjogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiU3lzdGVtTWV0YURhdGFcIiwgXCJwdXJwb3NlXCI6IFwiRmVhdHVyZUluc2lnaHRcIiwgXCJpc01lYXN1cmVtZW50XCI6IHRydWUgfVxuXHR9XG4qL1xuZXhwb3J0IGludGVyZmFjZSBJUGF0dGVybkluZm8ge1xuXHRwYXR0ZXJuOiBzdHJpbmc7XG5cdGlzUmVnRXhwPzogYm9vbGVhbjtcblx0aXNXb3JkTWF0Y2g/OiBib29sZWFuO1xuXHR3b3JkU2VwYXJhdG9ycz86IHN0cmluZztcblx0aXNNdWx0aWxpbmU/OiBib29sZWFuO1xuXHRpc1VuaWNvZGU/OiBib29sZWFuO1xuXHRpc0Nhc2VTZW5zaXRpdmU/OiBib29sZWFuO1xuXHRub3RlYm9va0luZm8/OiBJTm90ZWJvb2tQYXR0ZXJuSW5mbztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTm90ZWJvb2tQYXR0ZXJuSW5mbyB7XG5cdGlzSW5Ob3RlYm9va01hcmtkb3duSW5wdXQ/OiBib29sZWFuO1xuXHRpc0luTm90ZWJvb2tNYXJrZG93blByZXZpZXc/OiBib29sZWFuO1xuXHRpc0luTm90ZWJvb2tDZWxsSW5wdXQ/OiBib29sZWFuO1xuXHRpc0luTm90ZWJvb2tDZWxsT3V0cHV0PzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRXh0ZW5kZWRFeHRlbnNpb25TZWFyY2hPcHRpb25zIHtcblx0dXNlUENSRTI/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlTWF0Y2g8VSBleHRlbmRzIFVyaUNvbXBvbmVudHMgPSBVUkk+IHtcblx0cmVzb3VyY2U6IFU7XG5cdHJlc3VsdHM/OiBJVGV4dFNlYXJjaFJlc3VsdDxVPltdO1xufVxuXG5leHBvcnQgdHlwZSBJUmF3RmlsZU1hdGNoMiA9IElGaWxlTWF0Y2g8VXJpQ29tcG9uZW50cz47XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRleHRTZWFyY2hQcmV2aWV3T3B0aW9ucyB7XG5cdG1hdGNoTGluZXM6IG51bWJlcjtcblx0Y2hhcnNQZXJMaW5lOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNlYXJjaFJhbmdlIHtcblx0cmVhZG9ubHkgc3RhcnRMaW5lTnVtYmVyOiBudW1iZXI7XG5cdHJlYWRvbmx5IHN0YXJ0Q29sdW1uOiBudW1iZXI7XG5cdHJlYWRvbmx5IGVuZExpbmVOdW1iZXI6IG51bWJlcjtcblx0cmVhZG9ubHkgZW5kQ29sdW1uOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRleHRTZWFyY2hNYXRjaDxVIGV4dGVuZHMgVXJpQ29tcG9uZW50cyA9IFVSST4ge1xuXHR1cmk/OiBVO1xuXHRyYW5nZUxvY2F0aW9uczogU2VhcmNoUmFuZ2VTZXRQYWlyaW5nW107XG5cdHByZXZpZXdUZXh0OiBzdHJpbmc7XG5cdHdlYnZpZXdJbmRleD86IG51bWJlcjtcblx0Y2VsbEZyYWdtZW50Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUZXh0U2VhcmNoQ29udGV4dDxVIGV4dGVuZHMgVXJpQ29tcG9uZW50cyA9IFVSST4ge1xuXHR1cmk/OiBVO1xuXHR0ZXh0OiBzdHJpbmc7XG5cdGxpbmVOdW1iZXI6IG51bWJlcjtcbn1cblxuZXhwb3J0IHR5cGUgSVRleHRTZWFyY2hSZXN1bHQ8VSBleHRlbmRzIFVyaUNvbXBvbmVudHMgPSBVUkk+ID0gSVRleHRTZWFyY2hNYXRjaDxVPiB8IElUZXh0U2VhcmNoQ29udGV4dDxVPjtcblxuZXhwb3J0IGZ1bmN0aW9uIHJlc3VsdElzTWF0Y2gocmVzdWx0OiBJVGV4dFNlYXJjaFJlc3VsdCk6IHJlc3VsdCBpcyBJVGV4dFNlYXJjaE1hdGNoIHtcblx0cmV0dXJuICEhKDxJVGV4dFNlYXJjaE1hdGNoPnJlc3VsdCkucmFuZ2VMb2NhdGlvbnMgJiYgISEoPElUZXh0U2VhcmNoTWF0Y2g+cmVzdWx0KS5wcmV2aWV3VGV4dDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUHJvZ3Jlc3NNZXNzYWdlIHtcblx0bWVzc2FnZTogc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBJU2VhcmNoUHJvZ3Jlc3NJdGVtID0gSUZpbGVNYXRjaCB8IElQcm9ncmVzc01lc3NhZ2U7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0ZpbGVNYXRjaChwOiBJU2VhcmNoUHJvZ3Jlc3NJdGVtKTogcCBpcyBJRmlsZU1hdGNoIHtcblx0cmV0dXJuICEhKDxJRmlsZU1hdGNoPnApLnJlc291cmNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNQcm9ncmVzc01lc3NhZ2UocDogSVNlYXJjaFByb2dyZXNzSXRlbSB8IElTZXJpYWxpemVkU2VhcmNoUHJvZ3Jlc3NJdGVtKTogcCBpcyBJUHJvZ3Jlc3NNZXNzYWdlIHtcblx0cmV0dXJuICEhKHAgYXMgSVByb2dyZXNzTWVzc2FnZSkubWVzc2FnZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGV4dFNlYXJjaENvbXBsZXRlTWVzc2FnZSB7XG5cdHRleHQ6IHN0cmluZztcblx0dHlwZTogVGV4dFNlYXJjaENvbXBsZXRlTWVzc2FnZVR5cGU7XG5cdHRydXN0ZWQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTZWFyY2hDb21wbGV0ZVN0YXRzIHtcblx0bGltaXRIaXQ/OiBib29sZWFuO1xuXHRtZXNzYWdlczogSVRleHRTZWFyY2hDb21wbGV0ZU1lc3NhZ2VbXTtcblx0c3RhdHM/OiBJRmlsZVNlYXJjaFN0YXRzIHwgSVRleHRTZWFyY2hTdGF0cztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU2VhcmNoQ29tcGxldGUgZXh0ZW5kcyBJU2VhcmNoQ29tcGxldGVTdGF0cyB7XG5cdHJlc3VsdHM6IElGaWxlTWF0Y2hbXTtcblx0ZXhpdD86IFNlYXJjaENvbXBsZXRpb25FeGl0Q29kZTtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gU2VhcmNoQ29tcGxldGlvbkV4aXRDb2RlIHtcblx0Tm9ybWFsLFxuXHROZXdTZWFyY2hTdGFydGVkXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRleHRTZWFyY2hTdGF0cyB7XG5cdHR5cGU6ICd0ZXh0U2VhcmNoUHJvdmlkZXInIHwgJ3NlYXJjaFByb2Nlc3MnIHwgJ2FpVGV4dFNlYXJjaFByb3ZpZGVyJztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZVNlYXJjaFN0YXRzIHtcblx0ZnJvbUNhY2hlOiBib29sZWFuO1xuXHRkZXRhaWxTdGF0czogSVNlYXJjaEVuZ2luZVN0YXRzIHwgSUNhY2hlZFNlYXJjaFN0YXRzIHwgSUZpbGVTZWFyY2hQcm92aWRlclN0YXRzO1xuXG5cdHJlc3VsdENvdW50OiBudW1iZXI7XG5cdHR5cGU6ICdmaWxlU2VhcmNoUHJvdmlkZXInIHwgJ3NlYXJjaFByb2Nlc3MnO1xuXHRzb3J0aW5nVGltZT86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2FjaGVkU2VhcmNoU3RhdHMge1xuXHRjYWNoZVdhc1Jlc29sdmVkOiBib29sZWFuO1xuXHRjYWNoZUxvb2t1cFRpbWU6IG51bWJlcjtcblx0Y2FjaGVGaWx0ZXJUaW1lOiBudW1iZXI7XG5cdGNhY2hlRW50cnlDb3VudDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTZWFyY2hFbmdpbmVTdGF0cyB7XG5cdGZpbGVXYWxrVGltZTogbnVtYmVyO1xuXHRkaXJlY3Rvcmllc1dhbGtlZDogbnVtYmVyO1xuXHRmaWxlc1dhbGtlZDogbnVtYmVyO1xuXHRjbWRUaW1lOiBudW1iZXI7XG5cdGNtZFJlc3VsdENvdW50PzogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlU2VhcmNoUHJvdmlkZXJTdGF0cyB7XG5cdHByb3ZpZGVyVGltZTogbnVtYmVyO1xuXHRwb3N0UHJvY2Vzc1RpbWU6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVNYXRjaCBpbXBsZW1lbnRzIElGaWxlTWF0Y2gge1xuXHRyZXN1bHRzOiBJVGV4dFNlYXJjaFJlc3VsdFtdID0gW107XG5cdGNvbnN0cnVjdG9yKHB1YmxpYyByZXNvdXJjZTogVVJJKSB7XG5cdFx0Ly8gZW1wdHlcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNlYXJjaFJhbmdlU2V0UGFpcmluZyB7XG5cdHNvdXJjZTogSVNlYXJjaFJhbmdlO1xuXHRwcmV2aWV3OiBJU2VhcmNoUmFuZ2U7XG59XG5cbmV4cG9ydCBjbGFzcyBUZXh0U2VhcmNoTWF0Y2ggaW1wbGVtZW50cyBJVGV4dFNlYXJjaE1hdGNoIHtcblx0cmFuZ2VMb2NhdGlvbnM6IFNlYXJjaFJhbmdlU2V0UGFpcmluZ1tdID0gW107XG5cdHByZXZpZXdUZXh0OiBzdHJpbmc7XG5cdHdlYnZpZXdJbmRleD86IG51bWJlcjtcblxuXHRjb25zdHJ1Y3Rvcih0ZXh0OiBzdHJpbmcsIHJhbmdlczogSVNlYXJjaFJhbmdlIHwgSVNlYXJjaFJhbmdlW10sIHByZXZpZXdPcHRpb25zPzogSVRleHRTZWFyY2hQcmV2aWV3T3B0aW9ucywgd2Vidmlld0luZGV4PzogbnVtYmVyKSB7XG5cdFx0dGhpcy53ZWJ2aWV3SW5kZXggPSB3ZWJ2aWV3SW5kZXg7XG5cblx0XHQvLyBUcmltIHByZXZpZXcgaWYgdGhpcyBpcyBvbmUgbWF0Y2ggYW5kIGEgc2luZ2xlLWxpbmUgbWF0Y2ggd2l0aCBhIHByZXZpZXcgcmVxdWVzdGVkLlxuXHRcdC8vIE90aGVyd2lzZSBzZW5kIHRoZSBmdWxsIHRleHQsIGxpa2UgZm9yIHJlcGxhY2Ugb3IgZm9yIHNob3dpbmcgbXVsdGlwbGUgcHJldmlld3MuXG5cdFx0Ly8gVE9ETyB0aGlzIGlzIGZpc2h5LlxuXHRcdGNvbnN0IHJhbmdlc0FyciA9IEFycmF5LmlzQXJyYXkocmFuZ2VzKSA/IHJhbmdlcyA6IFtyYW5nZXNdO1xuXG5cdFx0aWYgKHByZXZpZXdPcHRpb25zICYmIHByZXZpZXdPcHRpb25zLm1hdGNoTGluZXMgPT09IDEgJiYgaXNTaW5nbGVMaW5lUmFuZ2VMaXN0KHJhbmdlc0FycikpIHtcblx0XHRcdC8vIDEgbGluZSBwcmV2aWV3IHJlcXVlc3RlZFxuXHRcdFx0dGV4dCA9IGdldE5MaW5lcyh0ZXh0LCBwcmV2aWV3T3B0aW9ucy5tYXRjaExpbmVzKTtcblxuXHRcdFx0bGV0IHJlc3VsdCA9ICcnO1xuXHRcdFx0bGV0IHNoaWZ0ID0gMDtcblx0XHRcdGxldCBsYXN0RW5kID0gMDtcblx0XHRcdGNvbnN0IGxlYWRpbmdDaGFycyA9IE1hdGguZmxvb3IocHJldmlld09wdGlvbnMuY2hhcnNQZXJMaW5lIC8gNSk7XG5cdFx0XHRmb3IgKGNvbnN0IHJhbmdlIG9mIHJhbmdlc0Fycikge1xuXHRcdFx0XHRjb25zdCBwcmV2aWV3U3RhcnQgPSBNYXRoLm1heChyYW5nZS5zdGFydENvbHVtbiAtIGxlYWRpbmdDaGFycywgMCk7XG5cdFx0XHRcdGNvbnN0IHByZXZpZXdFbmQgPSByYW5nZS5zdGFydENvbHVtbiArIHByZXZpZXdPcHRpb25zLmNoYXJzUGVyTGluZTtcblx0XHRcdFx0aWYgKHByZXZpZXdTdGFydCA+IGxhc3RFbmQgKyBsZWFkaW5nQ2hhcnMgKyBTRUFSQ0hfRUxJREVEX01JTl9MRU4pIHtcblx0XHRcdFx0XHRjb25zdCBlbGlzaW9uID0gU0VBUkNIX0VMSURFRF9QUkVGSVggKyAocHJldmlld1N0YXJ0IC0gbGFzdEVuZCkgKyBTRUFSQ0hfRUxJREVEX1NVRkZJWDtcblx0XHRcdFx0XHRyZXN1bHQgKz0gZWxpc2lvbiArIHRleHQuc2xpY2UocHJldmlld1N0YXJ0LCBwcmV2aWV3RW5kKTtcblx0XHRcdFx0XHRzaGlmdCArPSBwcmV2aWV3U3RhcnQgLSAobGFzdEVuZCArIGVsaXNpb24ubGVuZ3RoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXN1bHQgKz0gdGV4dC5zbGljZShsYXN0RW5kLCBwcmV2aWV3RW5kKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxhc3RFbmQgPSBwcmV2aWV3RW5kO1xuXHRcdFx0XHR0aGlzLnJhbmdlTG9jYXRpb25zLnB1c2goe1xuXHRcdFx0XHRcdHNvdXJjZTogcmFuZ2UsXG5cdFx0XHRcdFx0cHJldmlldzogbmV3IE9uZUxpbmVSYW5nZSgwLCByYW5nZS5zdGFydENvbHVtbiAtIHNoaWZ0LCByYW5nZS5lbmRDb2x1bW4gLSBzaGlmdClcblx0XHRcdFx0fSk7XG5cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5wcmV2aWV3VGV4dCA9IHJlc3VsdDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZmlyc3RNYXRjaExpbmUgPSBBcnJheS5pc0FycmF5KHJhbmdlcykgPyByYW5nZXNbMF0uc3RhcnRMaW5lTnVtYmVyIDogcmFuZ2VzLnN0YXJ0TGluZU51bWJlcjtcblxuXHRcdFx0Y29uc3QgcmFuZ2VMb2NzID0gbWFwQXJyYXlPck5vdChyYW5nZXMsIHIgPT4gKHtcblx0XHRcdFx0cHJldmlldzogbmV3IFNlYXJjaFJhbmdlKHIuc3RhcnRMaW5lTnVtYmVyIC0gZmlyc3RNYXRjaExpbmUsIHIuc3RhcnRDb2x1bW4sIHIuZW5kTGluZU51bWJlciAtIGZpcnN0TWF0Y2hMaW5lLCByLmVuZENvbHVtbiksXG5cdFx0XHRcdHNvdXJjZTogclxuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLnJhbmdlTG9jYXRpb25zID0gQXJyYXkuaXNBcnJheShyYW5nZUxvY3MpID8gcmFuZ2VMb2NzIDogW3JhbmdlTG9jc107XG5cdFx0XHR0aGlzLnByZXZpZXdUZXh0ID0gdGV4dDtcblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gaXNTaW5nbGVMaW5lUmFuZ2VMaXN0KHJhbmdlczogSVNlYXJjaFJhbmdlW10pOiBib29sZWFuIHtcblx0Y29uc3QgbGluZSA9IHJhbmdlc1swXS5zdGFydExpbmVOdW1iZXI7XG5cdGZvciAoY29uc3QgciBvZiByYW5nZXMpIHtcblx0XHRpZiAoci5zdGFydExpbmVOdW1iZXIgIT09IGxpbmUgfHwgci5lbmRMaW5lTnVtYmVyICE9PSBsaW5lKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBjbGFzcyBTZWFyY2hSYW5nZSBpbXBsZW1lbnRzIElTZWFyY2hSYW5nZSB7XG5cdHN0YXJ0TGluZU51bWJlcjogbnVtYmVyO1xuXHRzdGFydENvbHVtbjogbnVtYmVyO1xuXHRlbmRMaW5lTnVtYmVyOiBudW1iZXI7XG5cdGVuZENvbHVtbjogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBzdGFydENvbHVtbjogbnVtYmVyLCBlbmRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZENvbHVtbjogbnVtYmVyKSB7XG5cdFx0dGhpcy5zdGFydExpbmVOdW1iZXIgPSBzdGFydExpbmVOdW1iZXI7XG5cdFx0dGhpcy5zdGFydENvbHVtbiA9IHN0YXJ0Q29sdW1uO1xuXHRcdHRoaXMuZW5kTGluZU51bWJlciA9IGVuZExpbmVOdW1iZXI7XG5cdFx0dGhpcy5lbmRDb2x1bW4gPSBlbmRDb2x1bW47XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE9uZUxpbmVSYW5nZSBleHRlbmRzIFNlYXJjaFJhbmdlIHtcblx0Y29uc3RydWN0b3IobGluZU51bWJlcjogbnVtYmVyLCBzdGFydENvbHVtbjogbnVtYmVyLCBlbmRDb2x1bW46IG51bWJlcikge1xuXHRcdHN1cGVyKGxpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCBsaW5lTnVtYmVyLCBlbmRDb2x1bW4pO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIFZpZXdNb2RlIHtcblx0TGlzdCA9ICdsaXN0Jyxcblx0VHJlZSA9ICd0cmVlJ1xufVxuXG5leHBvcnQgY29uc3QgZW51bSBTZWFyY2hTb3J0T3JkZXIge1xuXHREZWZhdWx0ID0gJ2RlZmF1bHQnLFxuXHRGaWxlTmFtZXMgPSAnZmlsZU5hbWVzJyxcblx0VHlwZSA9ICd0eXBlJyxcblx0TW9kaWZpZWQgPSAnbW9kaWZpZWQnLFxuXHRDb3VudERlc2NlbmRpbmcgPSAnY291bnREZXNjZW5kaW5nJyxcblx0Q291bnRBc2NlbmRpbmcgPSAnY291bnRBc2NlbmRpbmcnXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNlYXJjaENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzIHtcblx0ZXhjbHVkZTogZ2xvYi5JRXhwcmVzc2lvbjtcblx0dXNlUmlwZ3JlcDogYm9vbGVhbjtcblx0LyoqXG5cdCAqIFVzZSBpZ25vcmUgZmlsZSBmb3IgZmlsZSBzZWFyY2guXG5cdCAqL1xuXHR1c2VJZ25vcmVGaWxlczogYm9vbGVhbjtcblx0dXNlR2xvYmFsSWdub3JlRmlsZXM6IGJvb2xlYW47XG5cdHVzZVBhcmVudElnbm9yZUZpbGVzOiBib29sZWFuO1xuXHRmb2xsb3dTeW1saW5rczogYm9vbGVhbjtcblx0c21hcnRDYXNlOiBib29sZWFuO1xuXHRnbG9iYWxGaW5kQ2xpcGJvYXJkOiBib29sZWFuO1xuXHRsb2NhdGlvbjogJ3NpZGViYXInIHwgJ3BhbmVsJztcblx0dXNlUmVwbGFjZVByZXZpZXc6IGJvb2xlYW47XG5cdHNob3dMaW5lTnVtYmVyczogYm9vbGVhbjtcblx0dXNlUENSRTI6IGJvb2xlYW47XG5cdGFjdGlvbnNQb3NpdGlvbjogJ2F1dG8nIHwgJ3JpZ2h0Jztcblx0bWFpbnRhaW5GaWxlU2VhcmNoQ2FjaGU6IGJvb2xlYW47XG5cdG1heFJlc3VsdHM6IG51bWJlciB8IG51bGw7XG5cdGNvbGxhcHNlUmVzdWx0czogJ2F1dG8nIHwgJ2Fsd2F5c0NvbGxhcHNlJyB8ICdhbHdheXNFeHBhbmQnO1xuXHRzZWFyY2hPblR5cGU6IGJvb2xlYW47XG5cdHNlZWRPbkZvY3VzOiBib29sZWFuO1xuXHRzZWVkV2l0aE5lYXJlc3RXb3JkOiBib29sZWFuO1xuXHRzZWFyY2hPblR5cGVEZWJvdW5jZVBlcmlvZDogbnVtYmVyO1xuXHRtb2RlOiAndmlldycgfCAncmV1c2VFZGl0b3InIHwgJ25ld0VkaXRvcic7XG5cdHNlYXJjaEVkaXRvcjoge1xuXHRcdGRvdWJsZUNsaWNrQmVoYXZpb3VyOiAnc2VsZWN0V29yZCcgfCAnZ29Ub0xvY2F0aW9uJyB8ICdvcGVuTG9jYXRpb25Ub1NpZGUnO1xuXHRcdHNpbmdsZUNsaWNrQmVoYXZpb3VyOiAnZGVmYXVsdCcgfCAncGVla0RlZmluaXRpb24nO1xuXHRcdHJldXNlUHJpb3JTZWFyY2hDb25maWd1cmF0aW9uOiBib29sZWFuO1xuXHRcdGRlZmF1bHROdW1iZXJPZkNvbnRleHRMaW5lczogbnVtYmVyIHwgbnVsbDtcblx0XHRmb2N1c1Jlc3VsdHNPblNlYXJjaDogYm9vbGVhbjtcblx0XHRleHBlcmltZW50YWw6IHt9O1xuXHR9O1xuXHRzb3J0T3JkZXI6IFNlYXJjaFNvcnRPcmRlcjtcblx0ZGVjb3JhdGlvbnM6IHtcblx0XHRjb2xvcnM6IGJvb2xlYW47XG5cdFx0YmFkZ2VzOiBib29sZWFuO1xuXHR9O1xuXHRxdWlja0FjY2Vzczoge1xuXHRcdHByZXNlcnZlSW5wdXQ6IGJvb2xlYW47XG5cdH07XG5cdGRlZmF1bHRWaWV3TW9kZTogVmlld01vZGU7XG5cdGV4cGVyaW1lbnRhbDoge1xuXHRcdGNsb3NlZE5vdGVib29rUmljaENvbnRlbnRSZXN1bHRzOiBib29sZWFuO1xuXHR9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTZWFyY2hDb25maWd1cmF0aW9uIGV4dGVuZHMgSUZpbGVzQ29uZmlndXJhdGlvbiB7XG5cdHNlYXJjaDogSVNlYXJjaENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzO1xuXHRlZGl0b3I6IHtcblx0XHR3b3JkU2VwYXJhdG9yczogc3RyaW5nO1xuXHR9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RXhjbHVkZXMoY29uZmlndXJhdGlvbjogSVNlYXJjaENvbmZpZ3VyYXRpb24sIGluY2x1ZGVTZWFyY2hFeGNsdWRlcyA9IHRydWUpOiBnbG9iLklFeHByZXNzaW9uIHwgdW5kZWZpbmVkIHtcblx0Y29uc3QgZmlsZUV4Y2x1ZGVzID0gY29uZmlndXJhdGlvbiAmJiBjb25maWd1cmF0aW9uLmZpbGVzICYmIGNvbmZpZ3VyYXRpb24uZmlsZXMuZXhjbHVkZTtcblx0Y29uc3Qgc2VhcmNoRXhjbHVkZXMgPSBpbmNsdWRlU2VhcmNoRXhjbHVkZXMgJiYgY29uZmlndXJhdGlvbiAmJiBjb25maWd1cmF0aW9uLnNlYXJjaCAmJiBjb25maWd1cmF0aW9uLnNlYXJjaC5leGNsdWRlO1xuXG5cdGlmICghZmlsZUV4Y2x1ZGVzICYmICFzZWFyY2hFeGNsdWRlcykge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRpZiAoIWZpbGVFeGNsdWRlcyB8fCAhc2VhcmNoRXhjbHVkZXMpIHtcblx0XHRyZXR1cm4gZmlsZUV4Y2x1ZGVzIHx8IHNlYXJjaEV4Y2x1ZGVzIHx8IHVuZGVmaW5lZDtcblx0fVxuXG5cdGxldCBhbGxFeGNsdWRlczogZ2xvYi5JRXhwcmVzc2lvbiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdC8vIGNsb25lIHRoZSBjb25maWcgYXMgaXQgY291bGQgYmUgZnJvemVuXG5cdGFsbEV4Y2x1ZGVzID0gb2JqZWN0cy5taXhpbihhbGxFeGNsdWRlcywgb2JqZWN0cy5kZWVwQ2xvbmUoZmlsZUV4Y2x1ZGVzKSk7XG5cdGFsbEV4Y2x1ZGVzID0gb2JqZWN0cy5taXhpbihhbGxFeGNsdWRlcywgb2JqZWN0cy5kZWVwQ2xvbmUoc2VhcmNoRXhjbHVkZXMpLCB0cnVlKTtcblxuXHRyZXR1cm4gYWxsRXhjbHVkZXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXRoSW5jbHVkZWRJblF1ZXJ5KHF1ZXJ5UHJvcHM6IElDb21tb25RdWVyeVByb3BzPFVSST4sIGZzUGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdGlmIChxdWVyeVByb3BzLmV4Y2x1ZGVQYXR0ZXJuICYmIGdsb2IubWF0Y2gocXVlcnlQcm9wcy5leGNsdWRlUGF0dGVybiwgZnNQYXRoKSkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGlmIChxdWVyeVByb3BzLmluY2x1ZGVQYXR0ZXJuIHx8IHF1ZXJ5UHJvcHMudXNpbmdTZWFyY2hQYXRocykge1xuXHRcdGlmIChxdWVyeVByb3BzLmluY2x1ZGVQYXR0ZXJuICYmIGdsb2IubWF0Y2gocXVlcnlQcm9wcy5pbmNsdWRlUGF0dGVybiwgZnNQYXRoKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgc2VhcmNoUGF0aHMgYXJlIGJlaW5nIHVzZWQsIHRoZSBleHRyYSBmaWxlIG11c3QgYmUgaW4gYSBzdWJmb2xkZXIgYW5kIG1hdGNoIHRoZSBwYXR0ZXJuLCBpZiBwcmVzZW50XG5cdFx0aWYgKHF1ZXJ5UHJvcHMudXNpbmdTZWFyY2hQYXRocykge1xuXHRcdFx0cmV0dXJuICEhcXVlcnlQcm9wcy5mb2xkZXJRdWVyaWVzICYmIHF1ZXJ5UHJvcHMuZm9sZGVyUXVlcmllcy5zb21lKGZxID0+IHtcblx0XHRcdFx0Y29uc3Qgc2VhcmNoUGF0aCA9IGZxLmZvbGRlci5mc1BhdGg7XG5cdFx0XHRcdGlmIChleHRwYXRoLmlzRXF1YWxPclBhcmVudChmc1BhdGgsIHNlYXJjaFBhdGgpKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVsUGF0aCA9IHBhdGhzLnJlbGF0aXZlKHNlYXJjaFBhdGgsIGZzUGF0aCk7XG5cdFx0XHRcdFx0cmV0dXJuICFmcS5pbmNsdWRlUGF0dGVybiB8fCAhIWdsb2IubWF0Y2goZnEuaW5jbHVkZVBhdHRlcm4sIHJlbFBhdGgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBlbnVtIFNlYXJjaEVycm9yQ29kZSB7XG5cdHVua25vd25FbmNvZGluZyA9IDEsXG5cdHJlZ2V4UGFyc2VFcnJvcixcblx0Z2xvYlBhcnNlRXJyb3IsXG5cdGludmFsaWRMaXRlcmFsLFxuXHRyZ1Byb2Nlc3NFcnJvcixcblx0b3RoZXIsXG5cdGNhbmNlbGVkXG59XG5cbmV4cG9ydCBjbGFzcyBTZWFyY2hFcnJvciBleHRlbmRzIEVycm9yIHtcblx0Y29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCByZWFkb25seSBjb2RlPzogU2VhcmNoRXJyb3JDb2RlKSB7XG5cdFx0c3VwZXIobWVzc2FnZSk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlc2VyaWFsaXplU2VhcmNoRXJyb3IoZXJyb3I6IEVycm9yKTogU2VhcmNoRXJyb3Ige1xuXHRjb25zdCBlcnJvck1zZyA9IGVycm9yLm1lc3NhZ2U7XG5cblx0aWYgKGlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyb3IpKSB7XG5cdFx0cmV0dXJuIG5ldyBTZWFyY2hFcnJvcihlcnJvck1zZywgU2VhcmNoRXJyb3JDb2RlLmNhbmNlbGVkKTtcblx0fVxuXG5cdHRyeSB7XG5cdFx0Y29uc3QgZGV0YWlscyA9IEpTT04ucGFyc2UoZXJyb3JNc2cpO1xuXHRcdHJldHVybiBuZXcgU2VhcmNoRXJyb3IoZGV0YWlscy5tZXNzYWdlLCBkZXRhaWxzLmNvZGUpO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0cmV0dXJuIG5ldyBTZWFyY2hFcnJvcihlcnJvck1zZywgU2VhcmNoRXJyb3JDb2RlLm90aGVyKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplU2VhcmNoRXJyb3Ioc2VhcmNoRXJyb3I6IFNlYXJjaEVycm9yKTogRXJyb3Ige1xuXHRjb25zdCBkZXRhaWxzID0geyBtZXNzYWdlOiBzZWFyY2hFcnJvci5tZXNzYWdlLCBjb2RlOiBzZWFyY2hFcnJvci5jb2RlIH07XG5cdHJldHVybiBuZXcgRXJyb3IoSlNPTi5zdHJpbmdpZnkoZGV0YWlscykpO1xufVxuZXhwb3J0IGludGVyZmFjZSBJVGVsZW1ldHJ5RXZlbnQge1xuXHRldmVudE5hbWU6IHN0cmluZztcblx0ZGF0YTogSVRlbGVtZXRyeURhdGE7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJhd1NlYXJjaFNlcnZpY2Uge1xuXHRmaWxlU2VhcmNoKHNlYXJjaDogSVJhd0ZpbGVRdWVyeSk6IEV2ZW50PElTZXJpYWxpemVkU2VhcmNoUHJvZ3Jlc3NJdGVtIHwgSVNlcmlhbGl6ZWRTZWFyY2hDb21wbGV0ZT47XG5cdHRleHRTZWFyY2goc2VhcmNoOiBJUmF3VGV4dFF1ZXJ5KTogRXZlbnQ8SVNlcmlhbGl6ZWRTZWFyY2hQcm9ncmVzc0l0ZW0gfCBJU2VyaWFsaXplZFNlYXJjaENvbXBsZXRlPjtcblx0Y2xlYXJDYWNoZShjYWNoZUtleTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUmF3RmlsZU1hdGNoIHtcblx0YmFzZT86IHN0cmluZztcblx0LyoqXG5cdCAqIFRoZSBwYXRoIG9mIHRoZSBmaWxlIHJlbGF0aXZlIHRvIHRoZSBjb250YWluaW5nIGBiYXNlYCBmb2xkZXIuXG5cdCAqIFRoaXMgcGF0aCBpcyBleGFjdGx5IGFzIGl0IGFwcGVhcnMgb24gdGhlIGZpbGVzeXN0ZW0uXG5cdCAqL1xuXHRyZWxhdGl2ZVBhdGg6IHN0cmluZztcblx0LyoqXG5cdCAqIFRoaXMgcGF0aCBpcyB0cmFuc2Zvcm1lZCBmb3Igc2VhcmNoIHB1cnBvc2VzLiBGb3IgZXhhbXBsZSwgdGhpcyBjb3VsZCBiZVxuXHQgKiB0aGUgYHJlbGF0aXZlUGF0aGAgd2l0aCB0aGUgd29ya3NwYWNlIGZvbGRlciBuYW1lIHByZXBlbmRlZC4gVGhpcyB3YXkgdGhlXG5cdCAqIHNlYXJjaCBhbGdvcml0aG0gd291bGQgYWxzbyBtYXRjaCBhZ2FpbnN0IHRoZSBuYW1lIG9mIHRoZSBjb250YWluaW5nIGZvbGRlci5cblx0ICpcblx0ICogSWYgbm90IGdpdmVuLCB0aGUgc2VhcmNoIGFsZ29yaXRobSBzaG91bGQgdXNlIGByZWxhdGl2ZVBhdGhgLlxuXHQgKi9cblx0c2VhcmNoUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTZWFyY2hFbmdpbmU8VD4ge1xuXHRzZWFyY2g6IChvblJlc3VsdDogKG1hdGNoZXM6IFQpID0+IHZvaWQsIG9uUHJvZ3Jlc3M6IChwcm9ncmVzczogSVByb2dyZXNzTWVzc2FnZSkgPT4gdm9pZCwgZG9uZTogKGVycm9yOiBFcnJvciB8IG51bGwsIGNvbXBsZXRlOiBJU2VhcmNoRW5naW5lU3VjY2VzcykgPT4gdm9pZCkgPT4gdm9pZDtcblx0Y2FuY2VsOiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTZXJpYWxpemVkU2VhcmNoU3VjY2VzcyB7XG5cdHR5cGU6ICdzdWNjZXNzJztcblx0bGltaXRIaXQ6IGJvb2xlYW47XG5cdG1lc3NhZ2VzOiBJVGV4dFNlYXJjaENvbXBsZXRlTWVzc2FnZVtdO1xuXHRzdGF0cz86IElGaWxlU2VhcmNoU3RhdHMgfCBJVGV4dFNlYXJjaFN0YXRzO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTZWFyY2hFbmdpbmVTdWNjZXNzIHtcblx0bGltaXRIaXQ6IGJvb2xlYW47XG5cdG1lc3NhZ2VzOiBJVGV4dFNlYXJjaENvbXBsZXRlTWVzc2FnZVtdO1xuXHRzdGF0czogSVNlYXJjaEVuZ2luZVN0YXRzO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTZXJpYWxpemVkU2VhcmNoRXJyb3Ige1xuXHR0eXBlOiAnZXJyb3InO1xuXHRlcnJvcjoge1xuXHRcdG1lc3NhZ2U6IHN0cmluZztcblx0XHRzdGFjazogc3RyaW5nO1xuXHR9O1xufVxuXG5leHBvcnQgdHlwZSBJU2VyaWFsaXplZFNlYXJjaENvbXBsZXRlID0gSVNlcmlhbGl6ZWRTZWFyY2hTdWNjZXNzIHwgSVNlcmlhbGl6ZWRTZWFyY2hFcnJvcjtcblxuZXhwb3J0IGZ1bmN0aW9uIGlzU2VyaWFsaXplZFNlYXJjaENvbXBsZXRlKGFyZzogSVNlcmlhbGl6ZWRTZWFyY2hQcm9ncmVzc0l0ZW0gfCBJU2VyaWFsaXplZFNlYXJjaENvbXBsZXRlKTogYXJnIGlzIElTZXJpYWxpemVkU2VhcmNoQ29tcGxldGUge1xuXHRpZiAoKGFyZyBhcyBhbnkpLnR5cGUgPT09ICdlcnJvcicpIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fSBlbHNlIGlmICgoYXJnIGFzIGFueSkudHlwZSA9PT0gJ3N1Y2Nlc3MnKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1NlcmlhbGl6ZWRTZWFyY2hTdWNjZXNzKGFyZzogSVNlcmlhbGl6ZWRTZWFyY2hDb21wbGV0ZSk6IGFyZyBpcyBJU2VyaWFsaXplZFNlYXJjaFN1Y2Nlc3Mge1xuXHRyZXR1cm4gYXJnLnR5cGUgPT09ICdzdWNjZXNzJztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzU2VyaWFsaXplZEZpbGVNYXRjaChhcmc6IElTZXJpYWxpemVkU2VhcmNoUHJvZ3Jlc3NJdGVtKTogYXJnIGlzIElTZXJpYWxpemVkRmlsZU1hdGNoIHtcblx0cmV0dXJuICEhKDxJU2VyaWFsaXplZEZpbGVNYXRjaD5hcmcpLnBhdGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0ZpbGVQYXR0ZXJuTWF0Y2goY2FuZGlkYXRlOiBJUmF3RmlsZU1hdGNoLCBmaWxlUGF0dGVyblRvVXNlOiBzdHJpbmcsIGZ1enp5ID0gdHJ1ZSk6IGJvb2xlYW4ge1xuXHRjb25zdCBwYXRoVG9NYXRjaCA9IGNhbmRpZGF0ZS5zZWFyY2hQYXRoID8gY2FuZGlkYXRlLnNlYXJjaFBhdGggOiBjYW5kaWRhdGUucmVsYXRpdmVQYXRoO1xuXHRyZXR1cm4gZnV6enkgP1xuXHRcdGZ1enp5Q29udGFpbnMocGF0aFRvTWF0Y2gsIGZpbGVQYXR0ZXJuVG9Vc2UpIDpcblx0XHRnbG9iLm1hdGNoKGZpbGVQYXR0ZXJuVG9Vc2UsIHBhdGhUb01hdGNoKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU2VyaWFsaXplZEZpbGVNYXRjaCB7XG5cdHBhdGg6IHN0cmluZztcblx0cmVzdWx0cz86IElUZXh0U2VhcmNoUmVzdWx0W107XG5cdG51bU1hdGNoZXM/OiBudW1iZXI7XG59XG5cbi8vIFR5cGUgb2YgdGhlIHBvc3NpYmxlIHZhbHVlcyBmb3IgcHJvZ3Jlc3MgY2FsbHMgZnJvbSB0aGUgZW5naW5lXG5leHBvcnQgdHlwZSBJU2VyaWFsaXplZFNlYXJjaFByb2dyZXNzSXRlbSA9IElTZXJpYWxpemVkRmlsZU1hdGNoIHwgSVNlcmlhbGl6ZWRGaWxlTWF0Y2hbXSB8IElQcm9ncmVzc01lc3NhZ2U7XG5leHBvcnQgdHlwZSBJRmlsZVNlYXJjaFByb2dyZXNzSXRlbSA9IElSYXdGaWxlTWF0Y2ggfCBJUmF3RmlsZU1hdGNoW10gfCBJUHJvZ3Jlc3NNZXNzYWdlO1xuXG5cbmV4cG9ydCBjbGFzcyBTZXJpYWxpemFibGVGaWxlTWF0Y2ggaW1wbGVtZW50cyBJU2VyaWFsaXplZEZpbGVNYXRjaCB7XG5cdHBhdGg6IHN0cmluZztcblx0cmVzdWx0czogSVRleHRTZWFyY2hNYXRjaFtdO1xuXG5cdGNvbnN0cnVjdG9yKHBhdGg6IHN0cmluZykge1xuXHRcdHRoaXMucGF0aCA9IHBhdGg7XG5cdFx0dGhpcy5yZXN1bHRzID0gW107XG5cdH1cblxuXHRhZGRNYXRjaChtYXRjaDogSVRleHRTZWFyY2hNYXRjaCk6IHZvaWQge1xuXHRcdHRoaXMucmVzdWx0cy5wdXNoKG1hdGNoKTtcblx0fVxuXG5cdHNlcmlhbGl6ZSgpOiBJU2VyaWFsaXplZEZpbGVNYXRjaCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHBhdGg6IHRoaXMucGF0aCxcblx0XHRcdHJlc3VsdHM6IHRoaXMucmVzdWx0cyxcblx0XHRcdG51bU1hdGNoZXM6IHRoaXMucmVzdWx0cy5sZW5ndGhcblx0XHR9O1xuXHR9XG59XG5cbi8qKlxuICogIENvbXB1dGVzIHRoZSBwYXR0ZXJucyB0aGF0IHRoZSBwcm92aWRlciBoYW5kbGVzLiBEaXNjYXJkcyBzaWJsaW5nIGNsYXVzZXMgYW5kICdmYWxzZScgcGF0dGVybnNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVQYXR0ZXJuc0ZvclByb3ZpZGVyKGdsb2JhbFBhdHRlcm46IGdsb2IuSUV4cHJlc3Npb24gfCB1bmRlZmluZWQsIGZvbGRlclBhdHRlcm46IGdsb2IuSUV4cHJlc3Npb24gfCB1bmRlZmluZWQpOiBzdHJpbmdbXSB7XG5cdGNvbnN0IG1lcmdlZCA9IHtcblx0XHQuLi4oZ2xvYmFsUGF0dGVybiB8fCB7fSksXG5cdFx0Li4uKGZvbGRlclBhdHRlcm4gfHwge30pXG5cdH07XG5cblx0cmV0dXJuIE9iamVjdC5rZXlzKG1lcmdlZClcblx0XHQuZmlsdGVyKGtleSA9PiB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IG1lcmdlZFtrZXldO1xuXHRcdFx0cmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nICYmIHZhbHVlO1xuXHRcdH0pO1xufVxuXG5leHBvcnQgY2xhc3MgUXVlcnlHbG9iVGVzdGVyIHtcblxuXHRwcml2YXRlIF9leGNsdWRlRXhwcmVzc2lvbjogZ2xvYi5JRXhwcmVzc2lvbltdOyAvLyBUT0RPOiBldmFsdWF0ZSBnbG9icyBiYXNlZCBvbiBiYXNlVVJJIG9mIHBhdHRlcm5cblx0cHJpdmF0ZSBfcGFyc2VkRXhjbHVkZUV4cHJlc3Npb246IGdsb2IuUGFyc2VkRXhwcmVzc2lvbltdO1xuXG5cdHByaXZhdGUgX3BhcnNlZEluY2x1ZGVFeHByZXNzaW9uOiBnbG9iLlBhcnNlZEV4cHJlc3Npb24gfCBudWxsID0gbnVsbDtcblxuXHRjb25zdHJ1Y3Rvcihjb25maWc6IElTZWFyY2hRdWVyeSwgZm9sZGVyUXVlcnk6IElGb2xkZXJRdWVyeSkge1xuXHRcdC8vIHRvZG86IHRyeSB0byBpbmNvcnBvcmF0ZSBmb2xkZXJRdWVyeS5leGNsdWRlUGF0dGVybi5mb2xkZXIgaWYgYXZhaWxhYmxlXG5cdFx0dGhpcy5fZXhjbHVkZUV4cHJlc3Npb24gPSBmb2xkZXJRdWVyeS5leGNsdWRlUGF0dGVybj8ubWFwKGV4Y2x1ZGVQYXR0ZXJuID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdC4uLihjb25maWcuZXhjbHVkZVBhdHRlcm4gfHwge30pLFxuXHRcdFx0XHQuLi4oZXhjbHVkZVBhdHRlcm4ucGF0dGVybiB8fCB7fSlcblx0XHRcdH0gc2F0aXNmaWVzIGdsb2IuSUV4cHJlc3Npb247XG5cdFx0fSkgPz8gW107XG5cblx0XHRpZiAodGhpcy5fZXhjbHVkZUV4cHJlc3Npb24ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHQvLyBldmVuIGlmIHRoZXJlIGFyZSBubyBmb2xkZXJRdWVyaWVzLCB3ZSB3YW50IHRvIG9ic2VydmUgIHRoZSBnbG9iYWwgZXhjbHVkZXNcblx0XHRcdHRoaXMuX2V4Y2x1ZGVFeHByZXNzaW9uID0gW2NvbmZpZy5leGNsdWRlUGF0dGVybiB8fCB7fV07XG5cdFx0fVxuXG5cdFx0dGhpcy5fcGFyc2VkRXhjbHVkZUV4cHJlc3Npb24gPSB0aGlzLl9leGNsdWRlRXhwcmVzc2lvbi5tYXAoZSA9PiBnbG9iLnBhcnNlKGUpKTtcblxuXHRcdC8vIEVtcHR5IGluY2x1ZGVFeHByZXNzaW9uIG1lYW5zIGluY2x1ZGUgbm90aGluZywgc28gbm8ge30gc2hvcnRjdXRzXG5cdFx0bGV0IGluY2x1ZGVFeHByZXNzaW9uOiBnbG9iLklFeHByZXNzaW9uIHwgdW5kZWZpbmVkID0gY29uZmlnLmluY2x1ZGVQYXR0ZXJuO1xuXHRcdGlmIChmb2xkZXJRdWVyeS5pbmNsdWRlUGF0dGVybikge1xuXHRcdFx0aWYgKGluY2x1ZGVFeHByZXNzaW9uKSB7XG5cdFx0XHRcdGluY2x1ZGVFeHByZXNzaW9uID0ge1xuXHRcdFx0XHRcdC4uLmluY2x1ZGVFeHByZXNzaW9uLFxuXHRcdFx0XHRcdC4uLmZvbGRlclF1ZXJ5LmluY2x1ZGVQYXR0ZXJuXG5cdFx0XHRcdH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpbmNsdWRlRXhwcmVzc2lvbiA9IGZvbGRlclF1ZXJ5LmluY2x1ZGVQYXR0ZXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChpbmNsdWRlRXhwcmVzc2lvbikge1xuXHRcdFx0dGhpcy5fcGFyc2VkSW5jbHVkZUV4cHJlc3Npb24gPSBnbG9iLnBhcnNlKGluY2x1ZGVFeHByZXNzaW9uKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9ldmFsUGFyc2VkRXhjbHVkZUV4cHJlc3Npb24odGVzdFBhdGg6IHN0cmluZywgYmFzZW5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCwgaGFzU2libGluZz86IChuYW1lOiBzdHJpbmcpID0+IGJvb2xlYW4pOiBzdHJpbmcgfCBudWxsIHtcblx0XHQvLyB0b2RvOiBsZXNzIGhhY2t5IHdheSBvZiBldmFsdWF0aW5nIHN5bmMgdnMgYXN5bmMgc2libGluZyBjbGF1c2VzXG5cdFx0bGV0IHJlc3VsdDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cblx0XHRmb3IgKGNvbnN0IGZvbGRlckV4Y2x1ZGUgb2YgdGhpcy5fcGFyc2VkRXhjbHVkZUV4cHJlc3Npb24pIHtcblxuXHRcdFx0Ly8gZmluZCBmaXJzdCBub24tbnVsbCByZXN1bHRcblx0XHRcdGNvbnN0IGV2YWx1YXRpb24gPSBmb2xkZXJFeGNsdWRlKHRlc3RQYXRoLCBiYXNlbmFtZSwgaGFzU2libGluZyk7XG5cblx0XHRcdGlmICh0eXBlb2YgZXZhbHVhdGlvbiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0cmVzdWx0ID0gZXZhbHVhdGlvbjtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXG5cdG1hdGNoZXNFeGNsdWRlc1N5bmModGVzdFBhdGg6IHN0cmluZywgYmFzZW5hbWU/OiBzdHJpbmcsIGhhc1NpYmxpbmc/OiAobmFtZTogc3RyaW5nKSA9PiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX3BhcnNlZEV4Y2x1ZGVFeHByZXNzaW9uICYmIHRoaXMuX2V2YWxQYXJzZWRFeGNsdWRlRXhwcmVzc2lvbih0ZXN0UGF0aCwgYmFzZW5hbWUsIGhhc1NpYmxpbmcpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHQvKipcblx0ICogR3VhcmFudGVlZCBzeW5jIC0gc2libGluZ3NGbiBzaG91bGQgbm90IHJldHVybiBhIHByb21pc2UuXG5cdCAqL1xuXHRpbmNsdWRlZEluUXVlcnlTeW5jKHRlc3RQYXRoOiBzdHJpbmcsIGJhc2VuYW1lPzogc3RyaW5nLCBoYXNTaWJsaW5nPzogKG5hbWU6IHN0cmluZykgPT4gYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLl9wYXJzZWRFeGNsdWRlRXhwcmVzc2lvbiAmJiB0aGlzLl9ldmFsUGFyc2VkRXhjbHVkZUV4cHJlc3Npb24odGVzdFBhdGgsIGJhc2VuYW1lLCBoYXNTaWJsaW5nKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9wYXJzZWRJbmNsdWRlRXhwcmVzc2lvbiAmJiAhdGhpcy5fcGFyc2VkSW5jbHVkZUV4cHJlc3Npb24odGVzdFBhdGgsIGJhc2VuYW1lLCBoYXNTaWJsaW5nKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIEV2YWx1YXRpbmcgdGhlIGV4Y2x1ZGUgZXhwcmVzc2lvbiBpcyBvbmx5IGFzeW5jIGlmIGl0IGluY2x1ZGVzIHNpYmxpbmcgY2xhdXNlcy4gQXMgYW4gb3B0aW1pemF0aW9uLCBhdm9pZCBkb2luZyBhbnl0aGluZyB3aXRoIFByb21pc2VzXG5cdCAqIHVubGVzcyB0aGUgZXhwcmVzc2lvbiBpcyBhc3luYy5cblx0ICovXG5cdGluY2x1ZGVkSW5RdWVyeSh0ZXN0UGF0aDogc3RyaW5nLCBiYXNlbmFtZT86IHN0cmluZywgaGFzU2libGluZz86IChuYW1lOiBzdHJpbmcpID0+IGJvb2xlYW4gfCBQcm9taXNlPGJvb2xlYW4+KTogUHJvbWlzZTxib29sZWFuPiB8IGJvb2xlYW4ge1xuXG5cdFx0Y29uc3QgaXNJbmNsdWRlZCA9ICgpID0+IHtcblx0XHRcdHJldHVybiB0aGlzLl9wYXJzZWRJbmNsdWRlRXhwcmVzc2lvbiA/XG5cdFx0XHRcdCEhKHRoaXMuX3BhcnNlZEluY2x1ZGVFeHByZXNzaW9uKHRlc3RQYXRoLCBiYXNlbmFtZSwgaGFzU2libGluZykpIDpcblx0XHRcdFx0dHJ1ZTtcblx0XHR9O1xuXG5cdFx0cmV0dXJuIFByb21pc2UuYWxsKHRoaXMuX3BhcnNlZEV4Y2x1ZGVFeHByZXNzaW9uLm1hcChlID0+IHtcblx0XHRcdGNvbnN0IGV4Y2x1ZGVkID0gZSh0ZXN0UGF0aCwgYmFzZW5hbWUsIGhhc1NpYmxpbmcpO1xuXHRcdFx0aWYgKGlzVGhlbmFibGUoZXhjbHVkZWQpKSB7XG5cdFx0XHRcdHJldHVybiBleGNsdWRlZC50aGVuKGV4Y2x1ZGVkID0+IHtcblx0XHRcdFx0XHRpZiAoZXhjbHVkZWQpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gaXNJbmNsdWRlZCgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGlzSW5jbHVkZWQoKTtcblxuXHRcdH0pKS50aGVuKGUgPT4gZS5zb21lKGUgPT4gISFlKSk7XG5cblxuXHR9XG5cblx0aGFzU2libGluZ0V4Y2x1ZGVDbGF1c2VzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9leGNsdWRlRXhwcmVzc2lvbi5yZWR1Y2UoKHByZXYsIGN1cnIpID0+IGhhc1NpYmxpbmdDbGF1c2VzKGN1cnIpIHx8IHByZXYsIGZhbHNlKTtcblx0fVxufVxuXG5mdW5jdGlvbiBoYXNTaWJsaW5nQ2xhdXNlcyhwYXR0ZXJuOiBnbG9iLklFeHByZXNzaW9uKTogYm9vbGVhbiB7XG5cdGZvciAoY29uc3Qga2V5IGluIHBhdHRlcm4pIHtcblx0XHRpZiAodHlwZW9mIHBhdHRlcm5ba2V5XSAhPT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoYXNTaWJsaW5nUHJvbWlzZUZuKHNpYmxpbmdzRm4/OiAoKSA9PiBQcm9taXNlPHN0cmluZ1tdPikge1xuXHRpZiAoIXNpYmxpbmdzRm4pIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0bGV0IHNpYmxpbmdzOiBQcm9taXNlPFJlY29yZDxzdHJpbmcsIHRydWU+Pjtcblx0cmV0dXJuIChuYW1lOiBzdHJpbmcpID0+IHtcblx0XHRpZiAoIXNpYmxpbmdzKSB7XG5cdFx0XHRzaWJsaW5ncyA9IChzaWJsaW5nc0ZuKCkgfHwgUHJvbWlzZS5yZXNvbHZlKFtdKSlcblx0XHRcdFx0LnRoZW4obGlzdCA9PiBsaXN0ID8gbGlzdFRvTWFwKGxpc3QpIDoge30pO1xuXHRcdH1cblx0XHRyZXR1cm4gc2libGluZ3MudGhlbihtYXAgPT4gISFtYXBbbmFtZV0pO1xuXHR9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaGFzU2libGluZ0ZuKHNpYmxpbmdzRm4/OiAoKSA9PiBzdHJpbmdbXSkge1xuXHRpZiAoIXNpYmxpbmdzRm4pIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0bGV0IHNpYmxpbmdzOiBSZWNvcmQ8c3RyaW5nLCB0cnVlPjtcblx0cmV0dXJuIChuYW1lOiBzdHJpbmcpID0+IHtcblx0XHRpZiAoIXNpYmxpbmdzKSB7XG5cdFx0XHRjb25zdCBsaXN0ID0gc2libGluZ3NGbigpO1xuXHRcdFx0c2libGluZ3MgPSBsaXN0ID8gbGlzdFRvTWFwKGxpc3QpIDoge307XG5cdFx0fVxuXHRcdHJldHVybiAhIXNpYmxpbmdzW25hbWVdO1xuXHR9O1xufVxuXG5mdW5jdGlvbiBsaXN0VG9NYXAobGlzdDogc3RyaW5nW10pIHtcblx0Y29uc3QgbWFwOiBSZWNvcmQ8c3RyaW5nLCB0cnVlPiA9IHt9O1xuXHRmb3IgKGNvbnN0IGtleSBvZiBsaXN0KSB7XG5cdFx0bWFwW2tleV0gPSB0cnVlO1xuXHR9XG5cdHJldHVybiBtYXA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleGNsdWRlVG9HbG9iUGF0dGVybihleGNsdWRlc0ZvckZvbGRlcjogeyBiYXNlVXJpPzogVVJJIHwgdW5kZWZpbmVkOyBwYXR0ZXJuczogc3RyaW5nW10gfVtdKTogR2xvYlBhdHRlcm5bXSB7XG5cdHJldHVybiBleGNsdWRlc0ZvckZvbGRlci5mbGF0TWFwKGV4Y2x1ZGUgPT4gZXhjbHVkZS5wYXR0ZXJucy5tYXAocGF0dGVybiA9PiB7XG5cdFx0cmV0dXJuIGV4Y2x1ZGUuYmFzZVVyaSA/XG5cdFx0XHR7XG5cdFx0XHRcdGJhc2VVcmk6IGV4Y2x1ZGUuYmFzZVVyaSxcblx0XHRcdFx0cGF0dGVybjogcGF0dGVyblxuXHRcdFx0fSA6IHBhdHRlcm47XG5cdH0pKTtcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfVEVYVF9TRUFSQ0hfUFJFVklFV19PUFRJT05TID0ge1xuXHRtYXRjaExpbmVzOiAxMDAsXG5cdGNoYXJzUGVyTGluZTogMTAwMDBcbn07XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHFCQUFxQjtBQUU5QixZQUFZLFVBQVU7QUFFdEIsWUFBWSxhQUFhO0FBQ3pCLFlBQVksYUFBYTtBQUN6QixTQUFTLGVBQWUsaUJBQWlCO0FBR3pDLFNBQVMsdUJBQXVCO0FBR2hDLFlBQVksV0FBVztBQUN2QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFzQixxQ0FBcUM7QUFD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QUFBLEVBQ3hDO0FBQ0Q7QUFFTyxTQUFTLGFBQWEsWUFBNkI7QUFDekQsTUFBSSxDQUFDLFlBQVk7QUFDaEIsV0FBTztBQUFBLEVBQ1I7QUFFQSxNQUFJO0FBQ0osU0FBTyxDQUFDLFNBQWlCO0FBQ3hCLFFBQUksQ0FBQyxVQUFVO0FBQ2QsWUFBTSxPQUFPLFdBQVc7QUFDeEIsaUJBQVcsT0FBTyxVQUFVLElBQUksSUFBSSxDQUFDO0FBQUEsSUFDdEM7QUFDQSxXQUFPLENBQUMsQ0FBQyxTQUFTLElBQUk7QUFBQSxFQUN2QjtBQUNEO0FBRUEsU0FBUyxVQUFVLE1BQWdCO0FBQ2xDLFFBQU0sTUFBNEIsQ0FBQztBQUNuQyxhQUFXLE9BQU8sTUFBTTtBQUN2QixRQUFJLEdBQUcsSUFBSTtBQUFBLEVBQ1o7QUFDQSxTQUFPO0FBQ1I7QUFFTyxTQUFTLHFCQUFxQixtQkFBdUY7QUFDM0gsU0FBTyxrQkFBa0IsUUFBUSxhQUFXLFFBQVEsU0FBUyxJQUFJLGFBQVc7QUFDM0UsV0FBTyxRQUFRLFVBQ2Q7QUFBQSxNQUNDLFNBQVMsUUFBUTtBQUFBLE1BQ2pCO0FBQUEsSUFDRCxJQUFJO0FBQUEsRUFDTixDQUFDLENBQUM7QUFDSDtBQUVPLE1BQU0sc0NBQXNDO0FBQUEsRUFDbEQsWUFBWTtBQUFBLEVBQ1osY0FBYztBQUNmOyIsCiAgIm5hbWVzIjogWyJTZWFyY2hQcm92aWRlclR5cGUiLCAiUXVlcnlUeXBlIiwgIlNlYXJjaENvbXBsZXRpb25FeGl0Q29kZSIsICJWaWV3TW9kZSIsICJTZWFyY2hTb3J0T3JkZXIiLCAiU2VhcmNoRXJyb3JDb2RlIiwgImV4Y2x1ZGVkIiwgImUiXQp9Cg==
