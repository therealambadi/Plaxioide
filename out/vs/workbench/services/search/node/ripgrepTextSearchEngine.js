import * as cp from "child_process";
import { EventEmitter } from "events";
import { StringDecoder } from "string_decoder";
import { coalesce, mapArrayOrNot } from "../../../../base/common/arrays.js";
import { groupBy } from "../../../../base/common/collections.js";
import { splitGlobAware } from "../../../../base/common/glob.js";
import { createRegExp, escapeRegExpCharacters } from "../../../../base/common/strings.js";
import { URI } from "../../../../base/common/uri.js";
import { DEFAULT_MAX_SEARCH_RESULTS, SearchError, SearchErrorCode, serializeSearchError, TextSearchMatch } from "../common/search.js";
import { Range, TextSearchContext2, TextSearchMatch2 } from "../common/searchExtTypes.js";
import { RegExpParser, RegExpVisitor } from "vscode-regexpp";
import { rgPath } from "@vscode/ripgrep";
import { anchorGlob, rangeToSearchRange, searchRangeToRange } from "./ripgrepSearchUtils.js";
import { newToOldPreviewOptions } from "../common/searchExtConversionTypes.js";
const rgDiskPath = rgPath.replace(/\bnode_modules\.asar\b/, "node_modules.asar.unpacked");
class RipgrepTextSearchEngine {
  constructor(outputChannel, _numThreads) {
    this.outputChannel = outputChannel;
    this._numThreads = _numThreads;
  }
  provideTextSearchResults(query, options, progress, token) {
    return Promise.all(options.folderOptions.map((folderOption) => {
      const extendedOptions = {
        folderOptions: folderOption,
        numThreads: this._numThreads,
        maxResults: options.maxResults,
        previewOptions: options.previewOptions,
        maxFileSize: options.maxFileSize,
        surroundingContext: options.surroundingContext
      };
      return this.provideTextSearchResultsWithRgOptions(query, extendedOptions, progress, token);
    })).then((e) => {
      const complete = {
        // todo: get this to actually check
        limitHit: e.some((complete2) => !!complete2 && complete2.limitHit)
      };
      return complete;
    });
  }
  provideTextSearchResultsWithRgOptions(query, options, progress, token) {
    this.outputChannel.appendLine(`provideTextSearchResults ${query.pattern}, ${JSON.stringify({
      ...options,
      ...{
        folder: options.folderOptions.folder.toString()
      }
    })}`);
    return new Promise((resolve, reject) => {
      token.onCancellationRequested(() => cancel());
      const extendedOptions = {
        ...options,
        numThreads: this._numThreads
      };
      const rgArgs = getRgArgs(query, extendedOptions);
      const cwd = options.folderOptions.folder.fsPath;
      const escapedArgs = rgArgs.map((arg) => arg.match(/^-/) ? arg : `'${arg}'`).join(" ");
      this.outputChannel.appendLine(`${rgDiskPath} ${escapedArgs}
 - cwd: ${cwd}`);
      let rgProc = cp.spawn(rgDiskPath, rgArgs, { cwd });
      rgProc.on("error", (e) => {
        console.error(e);
        this.outputChannel.appendLine("Error: " + (e && e.message));
        reject(serializeSearchError(new SearchError(e && e.message, SearchErrorCode.rgProcessError)));
      });
      let gotResult = false;
      const ripgrepParser = new RipgrepParser(options.maxResults ?? DEFAULT_MAX_SEARCH_RESULTS, options.folderOptions.folder, newToOldPreviewOptions(options.previewOptions));
      ripgrepParser.on("result", (match) => {
        gotResult = true;
        dataWithoutResult = "";
        progress.report(match);
      });
      let isDone = false;
      const cancel = () => {
        isDone = true;
        rgProc?.kill();
        ripgrepParser?.cancel();
      };
      let limitHit = false;
      ripgrepParser.on("hitLimit", () => {
        limitHit = true;
        cancel();
      });
      let dataWithoutResult = "";
      rgProc.stdout.on("data", (data) => {
        ripgrepParser.handleData(data);
        if (!gotResult) {
          dataWithoutResult += data;
        }
      });
      let gotData = false;
      rgProc.stdout.once("data", () => gotData = true);
      let stderr = "";
      rgProc.stderr.on("data", (data) => {
        const message = data.toString();
        this.outputChannel.appendLine(message);
        if (stderr.length + message.length < 1e6) {
          stderr += message;
        }
      });
      rgProc.on("close", () => {
        this.outputChannel.appendLine(gotData ? "Got data from stdout" : "No data from stdout");
        this.outputChannel.appendLine(gotResult ? "Got result from parser" : "No result from parser");
        if (dataWithoutResult) {
          this.outputChannel.appendLine(`Got data without result: ${dataWithoutResult}`);
        }
        this.outputChannel.appendLine("");
        if (isDone) {
          resolve({ limitHit });
        } else {
          ripgrepParser.flush();
          rgProc = null;
          let searchError;
          if (stderr && !gotData && (searchError = rgErrorMsgForDisplay(stderr))) {
            reject(serializeSearchError(new SearchError(searchError.message, searchError.code)));
          } else {
            resolve({ limitHit });
          }
        }
      });
    });
  }
}
function rgErrorMsgForDisplay(msg) {
  const lines = msg.split("\n");
  const firstLine = lines[0].trim();
  if (lines.some((l) => l.startsWith("regex parse error"))) {
    return new SearchError(buildRegexParseError(lines), SearchErrorCode.regexParseError);
  }
  const match = firstLine.match(/grep config error: unknown encoding: (.*)/);
  if (match) {
    return new SearchError(`Unknown encoding: ${match[1]}`, SearchErrorCode.unknownEncoding);
  }
  if (firstLine.startsWith("error parsing glob")) {
    return new SearchError(firstLine.charAt(0).toUpperCase() + firstLine.substr(1), SearchErrorCode.globParseError);
  }
  if (firstLine.startsWith("the literal")) {
    return new SearchError(firstLine.charAt(0).toUpperCase() + firstLine.substr(1), SearchErrorCode.invalidLiteral);
  }
  if (firstLine.startsWith("PCRE2: error compiling pattern")) {
    return new SearchError(firstLine, SearchErrorCode.regexParseError);
  }
  return void 0;
}
function buildRegexParseError(lines) {
  const errorMessage = ["Regex parse error"];
  const pcre2ErrorLine = lines.filter((l) => l.startsWith("PCRE2:"));
  if (pcre2ErrorLine.length >= 1) {
    const pcre2ErrorMessage = pcre2ErrorLine[0].replace("PCRE2:", "");
    if (pcre2ErrorMessage.indexOf(":") !== -1 && pcre2ErrorMessage.split(":").length >= 2) {
      const pcre2ActualErrorMessage = pcre2ErrorMessage.split(":")[1];
      errorMessage.push(":" + pcre2ActualErrorMessage);
    }
  }
  return errorMessage.join("");
}
class RipgrepParser extends EventEmitter {
  constructor(maxResults, root, previewOptions) {
    super();
    this.maxResults = maxResults;
    this.root = root;
    this.previewOptions = previewOptions;
    this.remainder = "";
    this.isDone = false;
    this.hitLimit = false;
    this.numResults = 0;
    this.stringDecoder = new StringDecoder();
  }
  cancel() {
    this.isDone = true;
  }
  flush() {
    this.handleDecodedData(this.stringDecoder.end());
  }
  on(event, listener) {
    super.on(event, listener);
    return this;
  }
  handleData(data) {
    if (this.isDone) {
      return;
    }
    const dataStr = typeof data === "string" ? data : this.stringDecoder.write(data);
    this.handleDecodedData(dataStr);
  }
  handleDecodedData(decodedData) {
    let newlineIdx = decodedData.indexOf("\n");
    const dataStr = this.remainder + decodedData;
    if (newlineIdx >= 0) {
      newlineIdx += this.remainder.length;
    } else {
      this.remainder = dataStr;
      return;
    }
    let prevIdx = 0;
    while (newlineIdx >= 0) {
      this.handleLine(dataStr.substring(prevIdx, newlineIdx).trim());
      prevIdx = newlineIdx + 1;
      newlineIdx = dataStr.indexOf("\n", prevIdx);
    }
    this.remainder = dataStr.substring(prevIdx);
  }
  handleLine(outputLine) {
    if (this.isDone || !outputLine) {
      return;
    }
    let parsedLine;
    try {
      parsedLine = JSON.parse(outputLine);
    } catch (e) {
      throw new Error(`malformed line from rg: ${outputLine}`);
    }
    if (parsedLine.type === "match") {
      const matchPath = bytesOrTextToString(parsedLine.data.path);
      const uri = URI.joinPath(this.root, matchPath);
      const result = this.createTextSearchMatch(parsedLine.data, uri);
      this.onResult(result);
      if (this.hitLimit) {
        this.cancel();
        this.emit("hitLimit");
      }
    } else if (parsedLine.type === "context") {
      const contextPath = bytesOrTextToString(parsedLine.data.path);
      const uri = URI.joinPath(this.root, contextPath);
      const result = this.createTextSearchContexts(parsedLine.data, uri);
      result.forEach((r) => this.onResult(r));
    }
  }
  createTextSearchMatch(data, uri) {
    const lineNumber = data.line_number - 1;
    const fullText = bytesOrTextToString(data.lines);
    const fullTextBytes = Buffer.from(fullText);
    let prevMatchEnd = 0;
    let prevMatchEndCol = 0;
    let prevMatchEndLine = lineNumber;
    if (data.submatches.length === 0) {
      data.submatches.push(
        fullText.length ? { start: 0, end: 1, match: { text: fullText[0] } } : { start: 0, end: 0, match: { text: "" } }
      );
    }
    const ranges = coalesce(data.submatches.map((match, i) => {
      if (this.hitLimit) {
        return null;
      }
      this.numResults++;
      if (this.numResults >= this.maxResults) {
        this.hitLimit = true;
      }
      const matchText = bytesOrTextToString(match.match);
      const inBetweenText = fullTextBytes.slice(prevMatchEnd, match.start).toString();
      const inBetweenStats = getNumLinesAndLastNewlineLength(inBetweenText);
      const startCol = inBetweenStats.numLines > 0 ? inBetweenStats.lastLineLength : inBetweenStats.lastLineLength + prevMatchEndCol;
      const stats = getNumLinesAndLastNewlineLength(matchText);
      const startLineNumber = inBetweenStats.numLines + prevMatchEndLine;
      const endLineNumber = stats.numLines + startLineNumber;
      const endCol = stats.numLines > 0 ? stats.lastLineLength : stats.lastLineLength + startCol;
      prevMatchEnd = match.end;
      prevMatchEndCol = endCol;
      prevMatchEndLine = endLineNumber;
      return new Range(startLineNumber, startCol, endLineNumber, endCol);
    }));
    const searchRange = mapArrayOrNot(ranges, rangeToSearchRange);
    const internalResult = new TextSearchMatch(fullText, searchRange, this.previewOptions);
    return new TextSearchMatch2(
      uri,
      internalResult.rangeLocations.map((e) => ({
        sourceRange: searchRangeToRange(e.source),
        previewRange: searchRangeToRange(e.preview)
      })),
      internalResult.previewText
    );
  }
  createTextSearchContexts(data, uri) {
    const text = bytesOrTextToString(data.lines);
    const startLine = data.line_number;
    return text.replace(/\r?\n$/, "").split("\n").map((line, i) => new TextSearchContext2(uri, line, startLine + i));
  }
  onResult(match) {
    this.emit("result", match);
  }
}
function bytesOrTextToString(obj) {
  return obj.bytes ? Buffer.from(obj.bytes, "base64").toString() : obj.text;
}
function getNumLinesAndLastNewlineLength(text) {
  const re = /\n/g;
  let numLines = 0;
  let lastNewlineIdx = -1;
  let match;
  while (match = re.exec(text)) {
    numLines++;
    lastNewlineIdx = match.index;
  }
  const lastLineLength = lastNewlineIdx >= 0 ? text.length - lastNewlineIdx - 1 : text.length;
  return { numLines, lastLineLength };
}
function getRgArgs(query, options) {
  const args = ["--hidden", "--no-require-git"];
  args.push(query.isCaseSensitive ? "--case-sensitive" : "--ignore-case");
  const { doubleStarIncludes, otherIncludes } = groupBy(
    options.folderOptions.includes,
    (include) => include.startsWith("**") ? "doubleStarIncludes" : "otherIncludes"
  );
  if (otherIncludes && otherIncludes.length) {
    const uniqueOthers = /* @__PURE__ */ new Set();
    otherIncludes.forEach((other) => {
      uniqueOthers.add(other);
    });
    args.push("-g", "!*");
    uniqueOthers.forEach((otherIncude) => {
      spreadGlobComponents(otherIncude).map(anchorGlob).forEach((globArg) => {
        args.push("-g", globArg);
      });
    });
  }
  if (doubleStarIncludes && doubleStarIncludes.length) {
    doubleStarIncludes.forEach((globArg) => {
      args.push("-g", globArg);
    });
  }
  options.folderOptions.excludes.map((e) => typeof e === "string" ? e : e.pattern).map(anchorGlob).forEach((rgGlob) => args.push("-g", `!${rgGlob}`));
  if (options.maxFileSize) {
    args.push("--max-filesize", options.maxFileSize + "");
  }
  if (options.folderOptions.useIgnoreFiles.local) {
    if (!options.folderOptions.useIgnoreFiles.parent) {
      args.push("--no-ignore-parent");
    }
  } else {
    args.push("--no-ignore");
  }
  if (options.folderOptions.followSymlinks) {
    args.push("--follow");
  }
  if (options.folderOptions.encoding && options.folderOptions.encoding !== "utf8") {
    args.push("--encoding", options.folderOptions.encoding);
  }
  if (options.numThreads) {
    args.push("--threads", `${options.numThreads}`);
  }
  if (query.pattern === "--") {
    query.isRegExp = true;
    query.pattern = "\\-\\-";
  }
  if (query.isMultiline && !query.isRegExp) {
    query.pattern = escapeRegExpCharacters(query.pattern);
    query.isRegExp = true;
  }
  if (options.usePCRE2) {
    args.push("--pcre2");
  }
  args.push("--crlf");
  if (query.isRegExp) {
    query.pattern = unicodeEscapesToPCRE2(query.pattern);
    args.push("--engine", "auto");
  }
  let searchPatternAfterDoubleDashes;
  if (query.isWordMatch) {
    const regexp = createRegExp(query.pattern, !!query.isRegExp, { wholeWord: query.isWordMatch });
    const regexpStr = regexp.source.replace(/\\\//g, "/");
    args.push("--regexp", regexpStr);
  } else if (query.isRegExp) {
    let fixedRegexpQuery = fixRegexNewline(query.pattern);
    fixedRegexpQuery = fixNewline(fixedRegexpQuery);
    args.push("--regexp", fixedRegexpQuery);
  } else {
    searchPatternAfterDoubleDashes = query.pattern;
    args.push("--fixed-strings");
  }
  args.push("--no-config");
  if (!options.folderOptions.useIgnoreFiles.global) {
    args.push("--no-ignore-global");
  }
  args.push("--json");
  if (query.isMultiline) {
    args.push("--multiline");
  }
  if (options.surroundingContext) {
    args.push("--before-context", options.surroundingContext + "");
    args.push("--after-context", options.surroundingContext + "");
  }
  args.push("--");
  if (searchPatternAfterDoubleDashes) {
    args.push(searchPatternAfterDoubleDashes);
  }
  args.push(".");
  return args;
}
function spreadGlobComponents(globComponent) {
  const globComponentWithBraceExpansion = performBraceExpansionForRipgrep(globComponent);
  return globComponentWithBraceExpansion.flatMap((globArg) => {
    const components = splitGlobAware(globArg, "/");
    return components.map((_, i) => components.slice(0, i + 1).join("/"));
  });
}
function unicodeEscapesToPCRE2(pattern) {
  const unicodePattern = /((?:[^\\]|^)(?:\\\\)*)\\u([a-z0-9]{4})/gi;
  while (pattern.match(unicodePattern)) {
    pattern = pattern.replace(unicodePattern, `$1\\x{$2}`);
  }
  const unicodePatternWithBraces = /((?:[^\\]|^)(?:\\\\)*)\\u\{([a-z0-9]{4})\}/gi;
  while (pattern.match(unicodePatternWithBraces)) {
    pattern = pattern.replace(unicodePatternWithBraces, `$1\\x{$2}`);
  }
  return pattern;
}
const isLookBehind = (node) => node.type === "Assertion" && node.kind === "lookbehind";
function fixRegexNewline(pattern) {
  let re;
  try {
    re = new RegExpParser().parsePattern(pattern);
  } catch {
    return pattern;
  }
  let output = "";
  let lastEmittedIndex = 0;
  const replace = (start, end, text) => {
    output += pattern.slice(lastEmittedIndex, start) + text;
    lastEmittedIndex = end;
  };
  const context = [];
  const visitor = new RegExpVisitor({
    onCharacterEnter(char) {
      if (char.raw !== "\\n") {
        return;
      }
      const parent = context[0];
      if (!parent) {
        replace(char.start, char.end, "\\r?\\n");
      } else if (context.some(isLookBehind)) {
      } else if (parent.type === "CharacterClass") {
        if (parent.negate) {
          const otherContent = pattern.slice(parent.start + 2, char.start) + pattern.slice(char.end, parent.end - 1);
          if (parent.parent?.type === "Quantifier") {
            replace(parent.start, parent.end, otherContent ? `[^${otherContent}]` : ".");
          } else {
            replace(parent.start, parent.end, "(?!\\r?\\n" + (otherContent ? `|[${otherContent}]` : "") + ")");
          }
        } else {
          const otherContent = pattern.slice(parent.start + 1, char.start) + pattern.slice(char.end, parent.end - 1);
          replace(parent.start, parent.end, otherContent === "" ? "\\r?\\n" : `(?:[${otherContent}]|\\r?\\n)`);
        }
      } else if (parent.type === "Quantifier") {
        replace(char.start, char.end, "(?:\\r?\\n)");
      }
    },
    onQuantifierEnter(node) {
      context.unshift(node);
    },
    onQuantifierLeave() {
      context.shift();
    },
    onCharacterClassRangeEnter(node) {
      context.unshift(node);
    },
    onCharacterClassRangeLeave() {
      context.shift();
    },
    onCharacterClassEnter(node) {
      context.unshift(node);
    },
    onCharacterClassLeave() {
      context.shift();
    },
    onAssertionEnter(node) {
      if (isLookBehind(node)) {
        context.push(node);
      }
    },
    onAssertionLeave(node) {
      if (context[0] === node) {
        context.shift();
      }
    }
  });
  visitor.visit(re);
  output += pattern.slice(lastEmittedIndex);
  return output;
}
function fixNewline(pattern) {
  return pattern.replace(/\n/g, "\\r?\\n");
}
function getEscapeAwareSplitStringForRipgrep(pattern) {
  let inBraces = false;
  let escaped = false;
  let fixedStart = "";
  let strInBraces = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    switch (char) {
      case "\\":
        if (escaped) {
          if (inBraces) {
            strInBraces += "\\" + char;
          } else {
            fixedStart += "\\" + char;
          }
          escaped = false;
        } else {
          escaped = true;
        }
        break;
      case "{":
        if (escaped) {
          if (inBraces) {
            strInBraces += char;
          } else {
            fixedStart += char;
          }
          escaped = false;
        } else {
          if (inBraces) {
            return { strInBraces: fixedStart + "{" + strInBraces + "{" + pattern.substring(i + 1) };
          } else {
            inBraces = true;
          }
        }
        break;
      case "}":
        if (escaped) {
          if (inBraces) {
            strInBraces += char;
          } else {
            fixedStart += char;
          }
          escaped = false;
        } else if (inBraces) {
          return { fixedStart, strInBraces, fixedEnd: pattern.substring(i + 1) };
        } else {
          fixedStart += char;
        }
        break;
      default:
        if (inBraces) {
          strInBraces += (escaped ? "\\" : "") + char;
        } else {
          fixedStart += (escaped ? "\\" : "") + char;
        }
        escaped = false;
        break;
    }
  }
  return { strInBraces: fixedStart + (inBraces ? "{" + strInBraces : "") };
}
function performBraceExpansionForRipgrep(pattern) {
  const { fixedStart, strInBraces, fixedEnd } = getEscapeAwareSplitStringForRipgrep(pattern);
  if (fixedStart === void 0 || fixedEnd === void 0) {
    return [strInBraces];
  }
  let arr = splitGlobAware(strInBraces, ",");
  if (!arr.length) {
    arr = [""];
  }
  const ends = performBraceExpansionForRipgrep(fixedEnd);
  return arr.flatMap((elem) => {
    const start = fixedStart + elem;
    return ends.map((end) => {
      return start + end;
    });
  });
}
export {
  RipgrepParser,
  RipgrepTextSearchEngine,
  fixNewline,
  fixRegexNewline,
  getRgArgs,
  performBraceExpansionForRipgrep,
  unicodeEscapesToPCRE2
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL25vZGUvcmlwZ3JlcFRleHRTZWFyY2hFbmdpbmUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBjcCBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgeyBTdHJpbmdEZWNvZGVyIH0gZnJvbSAnc3RyaW5nX2RlY29kZXInO1xuaW1wb3J0IHsgY29hbGVzY2UsIG1hcEFycmF5T3JOb3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgZ3JvdXBCeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IHNwbGl0R2xvYkF3YXJlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZ2xvYi5qcyc7XG5pbXBvcnQgeyBjcmVhdGVSZWdFeHAsIGVzY2FwZVJlZ0V4cENoYXJhY3RlcnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBQcm9ncmVzcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBERUZBVUxUX01BWF9TRUFSQ0hfUkVTVUxUUywgSUV4dGVuZGVkRXh0ZW5zaW9uU2VhcmNoT3B0aW9ucywgSVRleHRTZWFyY2hQcmV2aWV3T3B0aW9ucywgU2VhcmNoRXJyb3IsIFNlYXJjaEVycm9yQ29kZSwgc2VyaWFsaXplU2VhcmNoRXJyb3IsIFRleHRTZWFyY2hNYXRjaCB9IGZyb20gJy4uL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgUmFuZ2UsIFRleHRTZWFyY2hDb21wbGV0ZTIsIFRleHRTZWFyY2hDb250ZXh0MiwgVGV4dFNlYXJjaE1hdGNoMiwgVGV4dFNlYXJjaFByb3ZpZGVyT3B0aW9ucywgVGV4dFNlYXJjaFF1ZXJ5MiwgVGV4dFNlYXJjaFJlc3VsdDIgfSBmcm9tICcuLi9jb21tb24vc2VhcmNoRXh0VHlwZXMuanMnO1xuaW1wb3J0IHsgQVNUIGFzIFJlQVNULCBSZWdFeHBQYXJzZXIsIFJlZ0V4cFZpc2l0b3IgfSBmcm9tICd2c2NvZGUtcmVnZXhwcCc7XG5pbXBvcnQgeyByZ1BhdGggfSBmcm9tICdAdnNjb2RlL3JpcGdyZXAnO1xuaW1wb3J0IHsgYW5jaG9yR2xvYiwgSU91dHB1dENoYW5uZWwsIE1heWJlLCByYW5nZVRvU2VhcmNoUmFuZ2UsIHNlYXJjaFJhbmdlVG9SYW5nZSB9IGZyb20gJy4vcmlwZ3JlcFNlYXJjaFV0aWxzLmpzJztcbmltcG9ydCB0eXBlIHsgUmlwZ3JlcFRleHRTZWFyY2hPcHRpb25zIH0gZnJvbSAnLi4vY29tbW9uL3NlYXJjaEV4dFR5cGVzSW50ZXJuYWwuanMnO1xuaW1wb3J0IHsgbmV3VG9PbGRQcmV2aWV3T3B0aW9ucyB9IGZyb20gJy4uL2NvbW1vbi9zZWFyY2hFeHRDb252ZXJzaW9uVHlwZXMuanMnO1xuXG4vLyBJZiBAdnNjb2RlL3JpcGdyZXAgaXMgaW4gYW4gLmFzYXIgZmlsZSwgdGhlbiB0aGUgYmluYXJ5IGlzIHVucGFja2VkLlxuY29uc3QgcmdEaXNrUGF0aCA9IHJnUGF0aC5yZXBsYWNlKC9cXGJub2RlX21vZHVsZXNcXC5hc2FyXFxiLywgJ25vZGVfbW9kdWxlcy5hc2FyLnVucGFja2VkJyk7XG5cbmV4cG9ydCBjbGFzcyBSaXBncmVwVGV4dFNlYXJjaEVuZ2luZSB7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBvdXRwdXRDaGFubmVsOiBJT3V0cHV0Q2hhbm5lbCwgcHJpdmF0ZSByZWFkb25seSBfbnVtVGhyZWFkcz86IG51bWJlciB8IHVuZGVmaW5lZCkgeyB9XG5cblx0cHJvdmlkZVRleHRTZWFyY2hSZXN1bHRzKHF1ZXJ5OiBUZXh0U2VhcmNoUXVlcnkyLCBvcHRpb25zOiBUZXh0U2VhcmNoUHJvdmlkZXJPcHRpb25zLCBwcm9ncmVzczogUHJvZ3Jlc3M8VGV4dFNlYXJjaFJlc3VsdDI+LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFRleHRTZWFyY2hDb21wbGV0ZTI+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwob3B0aW9ucy5mb2xkZXJPcHRpb25zLm1hcChmb2xkZXJPcHRpb24gPT4ge1xuXHRcdFx0Y29uc3QgZXh0ZW5kZWRPcHRpb25zOiBSaXBncmVwVGV4dFNlYXJjaE9wdGlvbnMgPSB7XG5cdFx0XHRcdGZvbGRlck9wdGlvbnM6IGZvbGRlck9wdGlvbixcblx0XHRcdFx0bnVtVGhyZWFkczogdGhpcy5fbnVtVGhyZWFkcyxcblx0XHRcdFx0bWF4UmVzdWx0czogb3B0aW9ucy5tYXhSZXN1bHRzLFxuXHRcdFx0XHRwcmV2aWV3T3B0aW9uczogb3B0aW9ucy5wcmV2aWV3T3B0aW9ucyxcblx0XHRcdFx0bWF4RmlsZVNpemU6IG9wdGlvbnMubWF4RmlsZVNpemUsXG5cdFx0XHRcdHN1cnJvdW5kaW5nQ29udGV4dDogb3B0aW9ucy5zdXJyb3VuZGluZ0NvbnRleHRcblx0XHRcdH07XG5cdFx0XHRyZXR1cm4gdGhpcy5wcm92aWRlVGV4dFNlYXJjaFJlc3VsdHNXaXRoUmdPcHRpb25zKHF1ZXJ5LCBleHRlbmRlZE9wdGlvbnMsIHByb2dyZXNzLCB0b2tlbik7XG5cdFx0fSkpLnRoZW4oKGUgPT4ge1xuXHRcdFx0Y29uc3QgY29tcGxldGU6IFRleHRTZWFyY2hDb21wbGV0ZTIgPSB7XG5cdFx0XHRcdC8vIHRvZG86IGdldCB0aGlzIHRvIGFjdHVhbGx5IGNoZWNrXG5cdFx0XHRcdGxpbWl0SGl0OiBlLnNvbWUoY29tcGxldGUgPT4gISFjb21wbGV0ZSAmJiBjb21wbGV0ZS5saW1pdEhpdClcblx0XHRcdH07XG5cdFx0XHRyZXR1cm4gY29tcGxldGU7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdmlkZVRleHRTZWFyY2hSZXN1bHRzV2l0aFJnT3B0aW9ucyhxdWVyeTogVGV4dFNlYXJjaFF1ZXJ5Miwgb3B0aW9uczogUmlwZ3JlcFRleHRTZWFyY2hPcHRpb25zLCBwcm9ncmVzczogUHJvZ3Jlc3M8VGV4dFNlYXJjaFJlc3VsdDI+LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFRleHRTZWFyY2hDb21wbGV0ZTI+IHtcblx0XHR0aGlzLm91dHB1dENoYW5uZWwuYXBwZW5kTGluZShgcHJvdmlkZVRleHRTZWFyY2hSZXN1bHRzICR7cXVlcnkucGF0dGVybn0sICR7SlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdC4uLntcblx0XHRcdFx0Zm9sZGVyOiBvcHRpb25zLmZvbGRlck9wdGlvbnMuZm9sZGVyLnRvU3RyaW5nKClcblx0XHRcdH1cblx0XHR9KX1gKTtcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHR0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiBjYW5jZWwoKSk7XG5cblx0XHRcdGNvbnN0IGV4dGVuZGVkT3B0aW9uczogUmlwZ3JlcFRleHRTZWFyY2hPcHRpb25zID0ge1xuXHRcdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0XHRudW1UaHJlYWRzOiB0aGlzLl9udW1UaHJlYWRzXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgcmdBcmdzID0gZ2V0UmdBcmdzKHF1ZXJ5LCBleHRlbmRlZE9wdGlvbnMpO1xuXG5cdFx0XHRjb25zdCBjd2QgPSBvcHRpb25zLmZvbGRlck9wdGlvbnMuZm9sZGVyLmZzUGF0aDtcblxuXHRcdFx0Y29uc3QgZXNjYXBlZEFyZ3MgPSByZ0FyZ3Ncblx0XHRcdFx0Lm1hcChhcmcgPT4gYXJnLm1hdGNoKC9eLS8pID8gYXJnIDogYCcke2FyZ30nYClcblx0XHRcdFx0LmpvaW4oJyAnKTtcblx0XHRcdHRoaXMub3V0cHV0Q2hhbm5lbC5hcHBlbmRMaW5lKGAke3JnRGlza1BhdGh9ICR7ZXNjYXBlZEFyZ3N9XFxuIC0gY3dkOiAke2N3ZH1gKTtcblxuXHRcdFx0bGV0IHJnUHJvYzogTWF5YmU8Y3AuQ2hpbGRQcm9jZXNzPiA9IGNwLnNwYXduKHJnRGlza1BhdGgsIHJnQXJncywgeyBjd2QgfSk7XG5cdFx0XHRyZ1Byb2Mub24oJ2Vycm9yJywgZSA9PiB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoZSk7XG5cdFx0XHRcdHRoaXMub3V0cHV0Q2hhbm5lbC5hcHBlbmRMaW5lKCdFcnJvcjogJyArIChlICYmIGUubWVzc2FnZSkpO1xuXHRcdFx0XHRyZWplY3Qoc2VyaWFsaXplU2VhcmNoRXJyb3IobmV3IFNlYXJjaEVycm9yKGUgJiYgZS5tZXNzYWdlLCBTZWFyY2hFcnJvckNvZGUucmdQcm9jZXNzRXJyb3IpKSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0bGV0IGdvdFJlc3VsdCA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgcmlwZ3JlcFBhcnNlciA9IG5ldyBSaXBncmVwUGFyc2VyKG9wdGlvbnMubWF4UmVzdWx0cyA/PyBERUZBVUxUX01BWF9TRUFSQ0hfUkVTVUxUUywgb3B0aW9ucy5mb2xkZXJPcHRpb25zLmZvbGRlciwgbmV3VG9PbGRQcmV2aWV3T3B0aW9ucyhvcHRpb25zLnByZXZpZXdPcHRpb25zKSk7XG5cdFx0XHRyaXBncmVwUGFyc2VyLm9uKCdyZXN1bHQnLCAobWF0Y2g6IFRleHRTZWFyY2hSZXN1bHQyKSA9PiB7XG5cdFx0XHRcdGdvdFJlc3VsdCA9IHRydWU7XG5cdFx0XHRcdGRhdGFXaXRob3V0UmVzdWx0ID0gJyc7XG5cdFx0XHRcdHByb2dyZXNzLnJlcG9ydChtYXRjaCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0bGV0IGlzRG9uZSA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgY2FuY2VsID0gKCkgPT4ge1xuXHRcdFx0XHRpc0RvbmUgPSB0cnVlO1xuXG5cdFx0XHRcdHJnUHJvYz8ua2lsbCgpO1xuXG5cdFx0XHRcdHJpcGdyZXBQYXJzZXI/LmNhbmNlbCgpO1xuXHRcdFx0fTtcblxuXHRcdFx0bGV0IGxpbWl0SGl0ID0gZmFsc2U7XG5cdFx0XHRyaXBncmVwUGFyc2VyLm9uKCdoaXRMaW1pdCcsICgpID0+IHtcblx0XHRcdFx0bGltaXRIaXQgPSB0cnVlO1xuXHRcdFx0XHRjYW5jZWwoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRsZXQgZGF0YVdpdGhvdXRSZXN1bHQgPSAnJztcblx0XHRcdHJnUHJvYy5zdGRvdXQhLm9uKCdkYXRhJywgZGF0YSA9PiB7XG5cdFx0XHRcdHJpcGdyZXBQYXJzZXIuaGFuZGxlRGF0YShkYXRhKTtcblx0XHRcdFx0aWYgKCFnb3RSZXN1bHQpIHtcblx0XHRcdFx0XHRkYXRhV2l0aG91dFJlc3VsdCArPSBkYXRhO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0bGV0IGdvdERhdGEgPSBmYWxzZTtcblx0XHRcdHJnUHJvYy5zdGRvdXQhLm9uY2UoJ2RhdGEnLCAoKSA9PiBnb3REYXRhID0gdHJ1ZSk7XG5cblx0XHRcdGxldCBzdGRlcnIgPSAnJztcblx0XHRcdHJnUHJvYy5zdGRlcnIhLm9uKCdkYXRhJywgZGF0YSA9PiB7XG5cdFx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBkYXRhLnRvU3RyaW5nKCk7XG5cdFx0XHRcdHRoaXMub3V0cHV0Q2hhbm5lbC5hcHBlbmRMaW5lKG1lc3NhZ2UpO1xuXG5cdFx0XHRcdGlmIChzdGRlcnIubGVuZ3RoICsgbWVzc2FnZS5sZW5ndGggPCAxZTYpIHtcblx0XHRcdFx0XHRzdGRlcnIgKz0gbWVzc2FnZTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHJnUHJvYy5vbignY2xvc2UnLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMub3V0cHV0Q2hhbm5lbC5hcHBlbmRMaW5lKGdvdERhdGEgPyAnR290IGRhdGEgZnJvbSBzdGRvdXQnIDogJ05vIGRhdGEgZnJvbSBzdGRvdXQnKTtcblx0XHRcdFx0dGhpcy5vdXRwdXRDaGFubmVsLmFwcGVuZExpbmUoZ290UmVzdWx0ID8gJ0dvdCByZXN1bHQgZnJvbSBwYXJzZXInIDogJ05vIHJlc3VsdCBmcm9tIHBhcnNlcicpO1xuXHRcdFx0XHRpZiAoZGF0YVdpdGhvdXRSZXN1bHQpIHtcblx0XHRcdFx0XHR0aGlzLm91dHB1dENoYW5uZWwuYXBwZW5kTGluZShgR290IGRhdGEgd2l0aG91dCByZXN1bHQ6ICR7ZGF0YVdpdGhvdXRSZXN1bHR9YCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLm91dHB1dENoYW5uZWwuYXBwZW5kTGluZSgnJyk7XG5cblx0XHRcdFx0aWYgKGlzRG9uZSkge1xuXHRcdFx0XHRcdHJlc29sdmUoeyBsaW1pdEhpdCB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBUcmlnZ2VyIGxhc3QgcmVzdWx0XG5cdFx0XHRcdFx0cmlwZ3JlcFBhcnNlci5mbHVzaCgpO1xuXHRcdFx0XHRcdHJnUHJvYyA9IG51bGw7XG5cdFx0XHRcdFx0bGV0IHNlYXJjaEVycm9yOiBNYXliZTxTZWFyY2hFcnJvcj47XG5cdFx0XHRcdFx0aWYgKHN0ZGVyciAmJiAhZ290RGF0YSAmJiAoc2VhcmNoRXJyb3IgPSByZ0Vycm9yTXNnRm9yRGlzcGxheShzdGRlcnIpKSkge1xuXHRcdFx0XHRcdFx0cmVqZWN0KHNlcmlhbGl6ZVNlYXJjaEVycm9yKG5ldyBTZWFyY2hFcnJvcihzZWFyY2hFcnJvci5tZXNzYWdlLCBzZWFyY2hFcnJvci5jb2RlKSkpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKHsgbGltaXRIaXQgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxufVxuXG4vKipcbiAqIFJlYWQgdGhlIGZpcnN0IGxpbmUgb2Ygc3RkZXJyIGFuZCByZXR1cm4gYW4gZXJyb3IgZm9yIGRpc3BsYXkgb3IgdW5kZWZpbmVkLCBiYXNlZCBvbiBhIGxpc3Qgb2ZcbiAqIGFsbG93ZWQgcHJvcGVydGllcy5cbiAqIFJpcGdyZXAgcHJvZHVjZXMgc3RkZXJyIG91dHB1dCB3aGljaCBpcyBub3QgZnJvbSBhIGZhdGFsIGVycm9yLCBhbmQgd2Ugb25seSB3YW50IHRoZSBzZWFyY2ggdG8gYmVcbiAqIFwiZmFpbGVkXCIgd2hlbiBhIGZhdGFsIGVycm9yIHdhcyBwcm9kdWNlZC5cbiAqL1xuZnVuY3Rpb24gcmdFcnJvck1zZ0ZvckRpc3BsYXkobXNnOiBzdHJpbmcpOiBNYXliZTxTZWFyY2hFcnJvcj4ge1xuXHRjb25zdCBsaW5lcyA9IG1zZy5zcGxpdCgnXFxuJyk7XG5cdGNvbnN0IGZpcnN0TGluZSA9IGxpbmVzWzBdLnRyaW0oKTtcblxuXHRpZiAobGluZXMuc29tZShsID0+IGwuc3RhcnRzV2l0aCgncmVnZXggcGFyc2UgZXJyb3InKSkpIHtcblx0XHRyZXR1cm4gbmV3IFNlYXJjaEVycm9yKGJ1aWxkUmVnZXhQYXJzZUVycm9yKGxpbmVzKSwgU2VhcmNoRXJyb3JDb2RlLnJlZ2V4UGFyc2VFcnJvcik7XG5cdH1cblxuXHRjb25zdCBtYXRjaCA9IGZpcnN0TGluZS5tYXRjaCgvZ3JlcCBjb25maWcgZXJyb3I6IHVua25vd24gZW5jb2Rpbmc6ICguKikvKTtcblx0aWYgKG1hdGNoKSB7XG5cdFx0cmV0dXJuIG5ldyBTZWFyY2hFcnJvcihgVW5rbm93biBlbmNvZGluZzogJHttYXRjaFsxXX1gLCBTZWFyY2hFcnJvckNvZGUudW5rbm93bkVuY29kaW5nKTtcblx0fVxuXG5cdGlmIChmaXJzdExpbmUuc3RhcnRzV2l0aCgnZXJyb3IgcGFyc2luZyBnbG9iJykpIHtcblx0XHQvLyBVcHBlcmNhc2UgZmlyc3QgbGV0dGVyXG5cdFx0cmV0dXJuIG5ldyBTZWFyY2hFcnJvcihmaXJzdExpbmUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBmaXJzdExpbmUuc3Vic3RyKDEpLCBTZWFyY2hFcnJvckNvZGUuZ2xvYlBhcnNlRXJyb3IpO1xuXHR9XG5cblx0aWYgKGZpcnN0TGluZS5zdGFydHNXaXRoKCd0aGUgbGl0ZXJhbCcpKSB7XG5cdFx0Ly8gVXBwZXJjYXNlIGZpcnN0IGxldHRlclxuXHRcdHJldHVybiBuZXcgU2VhcmNoRXJyb3IoZmlyc3RMaW5lLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgZmlyc3RMaW5lLnN1YnN0cigxKSwgU2VhcmNoRXJyb3JDb2RlLmludmFsaWRMaXRlcmFsKTtcblx0fVxuXG5cdGlmIChmaXJzdExpbmUuc3RhcnRzV2l0aCgnUENSRTI6IGVycm9yIGNvbXBpbGluZyBwYXR0ZXJuJykpIHtcblx0XHRyZXR1cm4gbmV3IFNlYXJjaEVycm9yKGZpcnN0TGluZSwgU2VhcmNoRXJyb3JDb2RlLnJlZ2V4UGFyc2VFcnJvcik7XG5cdH1cblxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBidWlsZFJlZ2V4UGFyc2VFcnJvcihsaW5lczogc3RyaW5nW10pOiBzdHJpbmcge1xuXHRjb25zdCBlcnJvck1lc3NhZ2U6IHN0cmluZ1tdID0gWydSZWdleCBwYXJzZSBlcnJvciddO1xuXHRjb25zdCBwY3JlMkVycm9yTGluZSA9IGxpbmVzLmZpbHRlcihsID0+IChsLnN0YXJ0c1dpdGgoJ1BDUkUyOicpKSk7XG5cdGlmIChwY3JlMkVycm9yTGluZS5sZW5ndGggPj0gMSkge1xuXHRcdGNvbnN0IHBjcmUyRXJyb3JNZXNzYWdlID0gcGNyZTJFcnJvckxpbmVbMF0ucmVwbGFjZSgnUENSRTI6JywgJycpO1xuXHRcdGlmIChwY3JlMkVycm9yTWVzc2FnZS5pbmRleE9mKCc6JykgIT09IC0xICYmIHBjcmUyRXJyb3JNZXNzYWdlLnNwbGl0KCc6JykubGVuZ3RoID49IDIpIHtcblx0XHRcdGNvbnN0IHBjcmUyQWN0dWFsRXJyb3JNZXNzYWdlID0gcGNyZTJFcnJvck1lc3NhZ2Uuc3BsaXQoJzonKVsxXTtcblx0XHRcdGVycm9yTWVzc2FnZS5wdXNoKCc6JyArIHBjcmUyQWN0dWFsRXJyb3JNZXNzYWdlKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gZXJyb3JNZXNzYWdlLmpvaW4oJycpO1xufVxuXG5cbmV4cG9ydCBjbGFzcyBSaXBncmVwUGFyc2VyIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcblx0cHJpdmF0ZSByZW1haW5kZXIgPSAnJztcblx0cHJpdmF0ZSBpc0RvbmUgPSBmYWxzZTtcblx0cHJpdmF0ZSBoaXRMaW1pdCA9IGZhbHNlO1xuXHRwcml2YXRlIHN0cmluZ0RlY29kZXI6IFN0cmluZ0RlY29kZXI7XG5cblx0cHJpdmF0ZSBudW1SZXN1bHRzID0gMDtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIG1heFJlc3VsdHM6IG51bWJlciwgcHJpdmF0ZSByb290OiBVUkksIHByaXZhdGUgcHJldmlld09wdGlvbnM6IElUZXh0U2VhcmNoUHJldmlld09wdGlvbnMpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuc3RyaW5nRGVjb2RlciA9IG5ldyBTdHJpbmdEZWNvZGVyKCk7XG5cdH1cblxuXHRjYW5jZWwoKTogdm9pZCB7XG5cdFx0dGhpcy5pc0RvbmUgPSB0cnVlO1xuXHR9XG5cblx0Zmx1c2goKTogdm9pZCB7XG5cdFx0dGhpcy5oYW5kbGVEZWNvZGVkRGF0YSh0aGlzLnN0cmluZ0RlY29kZXIuZW5kKCkpO1xuXHR9XG5cblxuXHRvdmVycmlkZSBvbihldmVudDogJ3Jlc3VsdCcsIGxpc3RlbmVyOiAocmVzdWx0OiBUZXh0U2VhcmNoUmVzdWx0MikgPT4gdm9pZCk6IHRoaXM7XG5cdG92ZXJyaWRlIG9uKGV2ZW50OiAnaGl0TGltaXQnLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCk6IHRoaXM7XG5cdG92ZXJyaWRlIG9uKGV2ZW50OiBzdHJpbmcsIGxpc3RlbmVyOiAoLi4uYXJnczogYW55W10pID0+IHZvaWQpOiB0aGlzIHtcblx0XHRzdXBlci5vbihldmVudCwgbGlzdGVuZXIpO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0aGFuZGxlRGF0YShkYXRhOiBCdWZmZXIgfCBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5pc0RvbmUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBkYXRhU3RyID0gdHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnID8gZGF0YSA6IHRoaXMuc3RyaW5nRGVjb2Rlci53cml0ZShkYXRhKTtcblx0XHR0aGlzLmhhbmRsZURlY29kZWREYXRhKGRhdGFTdHIpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVEZWNvZGVkRGF0YShkZWNvZGVkRGF0YTogc3RyaW5nKTogdm9pZCB7XG5cdFx0Ly8gY2hlY2sgZm9yIG5ld2xpbmUgYmVmb3JlIGFwcGVuZGluZyB0byByZW1haW5kZXJcblx0XHRsZXQgbmV3bGluZUlkeCA9IGRlY29kZWREYXRhLmluZGV4T2YoJ1xcbicpO1xuXG5cdFx0Ly8gSWYgdGhlIHByZXZpb3VzIGRhdGEgY2h1bmsgZGlkbid0IGVuZCBpbiBhIG5ld2xpbmUsIHByZXBlbmQgaXQgdG8gdGhpcyBjaHVua1xuXHRcdGNvbnN0IGRhdGFTdHIgPSB0aGlzLnJlbWFpbmRlciArIGRlY29kZWREYXRhO1xuXG5cdFx0aWYgKG5ld2xpbmVJZHggPj0gMCkge1xuXHRcdFx0bmV3bGluZUlkeCArPSB0aGlzLnJlbWFpbmRlci5sZW5ndGg7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIFNob3J0Y3V0XG5cdFx0XHR0aGlzLnJlbWFpbmRlciA9IGRhdGFTdHI7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IHByZXZJZHggPSAwO1xuXHRcdHdoaWxlIChuZXdsaW5lSWR4ID49IDApIHtcblx0XHRcdHRoaXMuaGFuZGxlTGluZShkYXRhU3RyLnN1YnN0cmluZyhwcmV2SWR4LCBuZXdsaW5lSWR4KS50cmltKCkpO1xuXHRcdFx0cHJldklkeCA9IG5ld2xpbmVJZHggKyAxO1xuXHRcdFx0bmV3bGluZUlkeCA9IGRhdGFTdHIuaW5kZXhPZignXFxuJywgcHJldklkeCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5yZW1haW5kZXIgPSBkYXRhU3RyLnN1YnN0cmluZyhwcmV2SWR4KTtcblx0fVxuXG5cblx0cHJpdmF0ZSBoYW5kbGVMaW5lKG91dHB1dExpbmU6IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzRG9uZSB8fCAhb3V0cHV0TGluZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBwYXJzZWRMaW5lOiBJUmdNZXNzYWdlO1xuXHRcdHRyeSB7XG5cdFx0XHRwYXJzZWRMaW5lID0gSlNPTi5wYXJzZShvdXRwdXRMaW5lKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYG1hbGZvcm1lZCBsaW5lIGZyb20gcmc6ICR7b3V0cHV0TGluZX1gKTtcblx0XHR9XG5cblx0XHRpZiAocGFyc2VkTGluZS50eXBlID09PSAnbWF0Y2gnKSB7XG5cdFx0XHRjb25zdCBtYXRjaFBhdGggPSBieXRlc09yVGV4dFRvU3RyaW5nKHBhcnNlZExpbmUuZGF0YS5wYXRoKTtcblx0XHRcdGNvbnN0IHVyaSA9IFVSSS5qb2luUGF0aCh0aGlzLnJvb3QsIG1hdGNoUGF0aCk7XG5cdFx0XHRjb25zdCByZXN1bHQgPSB0aGlzLmNyZWF0ZVRleHRTZWFyY2hNYXRjaChwYXJzZWRMaW5lLmRhdGEsIHVyaSk7XG5cdFx0XHR0aGlzLm9uUmVzdWx0KHJlc3VsdCk7XG5cblx0XHRcdGlmICh0aGlzLmhpdExpbWl0KSB7XG5cdFx0XHRcdHRoaXMuY2FuY2VsKCk7XG5cdFx0XHRcdHRoaXMuZW1pdCgnaGl0TGltaXQnKTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKHBhcnNlZExpbmUudHlwZSA9PT0gJ2NvbnRleHQnKSB7XG5cdFx0XHRjb25zdCBjb250ZXh0UGF0aCA9IGJ5dGVzT3JUZXh0VG9TdHJpbmcocGFyc2VkTGluZS5kYXRhLnBhdGgpO1xuXHRcdFx0Y29uc3QgdXJpID0gVVJJLmpvaW5QYXRoKHRoaXMucm9vdCwgY29udGV4dFBhdGgpO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5jcmVhdGVUZXh0U2VhcmNoQ29udGV4dHMocGFyc2VkTGluZS5kYXRhLCB1cmkpO1xuXHRcdFx0cmVzdWx0LmZvckVhY2gociA9PiB0aGlzLm9uUmVzdWx0KHIpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVRleHRTZWFyY2hNYXRjaChkYXRhOiBJUmdNYXRjaCwgdXJpOiBVUkkpOiBUZXh0U2VhcmNoTWF0Y2gyIHtcblx0XHRjb25zdCBsaW5lTnVtYmVyID0gZGF0YS5saW5lX251bWJlciAtIDE7XG5cdFx0Y29uc3QgZnVsbFRleHQgPSBieXRlc09yVGV4dFRvU3RyaW5nKGRhdGEubGluZXMpO1xuXHRcdGNvbnN0IGZ1bGxUZXh0Qnl0ZXMgPSBCdWZmZXIuZnJvbShmdWxsVGV4dCk7XG5cblx0XHRsZXQgcHJldk1hdGNoRW5kID0gMDtcblx0XHRsZXQgcHJldk1hdGNoRW5kQ29sID0gMDtcblx0XHRsZXQgcHJldk1hdGNoRW5kTGluZSA9IGxpbmVOdW1iZXI7XG5cblx0XHQvLyBpdCBsb29rcyBsaWtlIGNlcnRhaW4gcmVnZXhlcyBjYW4gbWF0Y2ggYSBsaW5lLCBidXQgY2F1c2UgcmcgdG8gbm90XG5cdFx0Ly8gZW1pdCBhbnkgc3BlY2lmaWMgc3VibWF0Y2hlcyBmb3IgdGhhdCBsaW5lLlxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMDA1NjkjaXNzdWVjb21tZW50LTczODQ5Njk5MVxuXHRcdGlmIChkYXRhLnN1Ym1hdGNoZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRkYXRhLnN1Ym1hdGNoZXMucHVzaChcblx0XHRcdFx0ZnVsbFRleHQubGVuZ3RoXG5cdFx0XHRcdFx0PyB7IHN0YXJ0OiAwLCBlbmQ6IDEsIG1hdGNoOiB7IHRleHQ6IGZ1bGxUZXh0WzBdIH0gfVxuXHRcdFx0XHRcdDogeyBzdGFydDogMCwgZW5kOiAwLCBtYXRjaDogeyB0ZXh0OiAnJyB9IH1cblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmFuZ2VzID0gY29hbGVzY2UoZGF0YS5zdWJtYXRjaGVzLm1hcCgobWF0Y2gsIGkpID0+IHtcblx0XHRcdGlmICh0aGlzLmhpdExpbWl0KSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLm51bVJlc3VsdHMrKztcblx0XHRcdGlmICh0aGlzLm51bVJlc3VsdHMgPj0gdGhpcy5tYXhSZXN1bHRzKSB7XG5cdFx0XHRcdC8vIEZpbmlzaCB0aGUgbGluZSwgdGhlbiByZXBvcnQgdGhlIHJlc3VsdCBiZWxvd1xuXHRcdFx0XHR0aGlzLmhpdExpbWl0ID0gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbWF0Y2hUZXh0ID0gYnl0ZXNPclRleHRUb1N0cmluZyhtYXRjaC5tYXRjaCk7XG5cblx0XHRcdGNvbnN0IGluQmV0d2VlblRleHQgPSBmdWxsVGV4dEJ5dGVzLnNsaWNlKHByZXZNYXRjaEVuZCwgbWF0Y2guc3RhcnQpLnRvU3RyaW5nKCk7XG5cdFx0XHRjb25zdCBpbkJldHdlZW5TdGF0cyA9IGdldE51bUxpbmVzQW5kTGFzdE5ld2xpbmVMZW5ndGgoaW5CZXR3ZWVuVGV4dCk7XG5cdFx0XHRjb25zdCBzdGFydENvbCA9IGluQmV0d2VlblN0YXRzLm51bUxpbmVzID4gMCA/XG5cdFx0XHRcdGluQmV0d2VlblN0YXRzLmxhc3RMaW5lTGVuZ3RoIDpcblx0XHRcdFx0aW5CZXR3ZWVuU3RhdHMubGFzdExpbmVMZW5ndGggKyBwcmV2TWF0Y2hFbmRDb2w7XG5cblx0XHRcdGNvbnN0IHN0YXRzID0gZ2V0TnVtTGluZXNBbmRMYXN0TmV3bGluZUxlbmd0aChtYXRjaFRleHQpO1xuXHRcdFx0Y29uc3Qgc3RhcnRMaW5lTnVtYmVyID0gaW5CZXR3ZWVuU3RhdHMubnVtTGluZXMgKyBwcmV2TWF0Y2hFbmRMaW5lO1xuXHRcdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IHN0YXRzLm51bUxpbmVzICsgc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0Y29uc3QgZW5kQ29sID0gc3RhdHMubnVtTGluZXMgPiAwID9cblx0XHRcdFx0c3RhdHMubGFzdExpbmVMZW5ndGggOlxuXHRcdFx0XHRzdGF0cy5sYXN0TGluZUxlbmd0aCArIHN0YXJ0Q29sO1xuXG5cdFx0XHRwcmV2TWF0Y2hFbmQgPSBtYXRjaC5lbmQ7XG5cdFx0XHRwcmV2TWF0Y2hFbmRDb2wgPSBlbmRDb2w7XG5cdFx0XHRwcmV2TWF0Y2hFbmRMaW5lID0gZW5kTGluZU51bWJlcjtcblxuXHRcdFx0cmV0dXJuIG5ldyBSYW5nZShzdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sLCBlbmRMaW5lTnVtYmVyLCBlbmRDb2wpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHNlYXJjaFJhbmdlID0gbWFwQXJyYXlPck5vdCg8UmFuZ2VbXT5yYW5nZXMsIHJhbmdlVG9TZWFyY2hSYW5nZSk7XG5cblx0XHRjb25zdCBpbnRlcm5hbFJlc3VsdCA9IG5ldyBUZXh0U2VhcmNoTWF0Y2goZnVsbFRleHQsIHNlYXJjaFJhbmdlLCB0aGlzLnByZXZpZXdPcHRpb25zKTtcblx0XHRyZXR1cm4gbmV3IFRleHRTZWFyY2hNYXRjaDIoXG5cdFx0XHR1cmksXG5cdFx0XHRpbnRlcm5hbFJlc3VsdC5yYW5nZUxvY2F0aW9ucy5tYXAoZSA9PiAoXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzb3VyY2VSYW5nZTogc2VhcmNoUmFuZ2VUb1JhbmdlKGUuc291cmNlKSxcblx0XHRcdFx0XHRwcmV2aWV3UmFuZ2U6IHNlYXJjaFJhbmdlVG9SYW5nZShlLnByZXZpZXcpLFxuXHRcdFx0XHR9XG5cdFx0XHQpKSxcblx0XHRcdGludGVybmFsUmVzdWx0LnByZXZpZXdUZXh0KTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlVGV4dFNlYXJjaENvbnRleHRzKGRhdGE6IElSZ01hdGNoLCB1cmk6IFVSSSk6IFRleHRTZWFyY2hDb250ZXh0MltdIHtcblx0XHRjb25zdCB0ZXh0ID0gYnl0ZXNPclRleHRUb1N0cmluZyhkYXRhLmxpbmVzKTtcblx0XHRjb25zdCBzdGFydExpbmUgPSBkYXRhLmxpbmVfbnVtYmVyO1xuXHRcdHJldHVybiB0ZXh0XG5cdFx0XHQucmVwbGFjZSgvXFxyP1xcbiQvLCAnJylcblx0XHRcdC5zcGxpdCgnXFxuJylcblx0XHRcdC5tYXAoKGxpbmUsIGkpID0+IG5ldyBUZXh0U2VhcmNoQ29udGV4dDIodXJpLCBsaW5lLCBzdGFydExpbmUgKyBpKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uUmVzdWx0KG1hdGNoOiBUZXh0U2VhcmNoUmVzdWx0Mik6IHZvaWQge1xuXHRcdHRoaXMuZW1pdCgncmVzdWx0JywgbWF0Y2gpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGJ5dGVzT3JUZXh0VG9TdHJpbmcob2JqOiBhbnkpOiBzdHJpbmcge1xuXHRyZXR1cm4gb2JqLmJ5dGVzID9cblx0XHRCdWZmZXIuZnJvbShvYmouYnl0ZXMsICdiYXNlNjQnKS50b1N0cmluZygpIDpcblx0XHRvYmoudGV4dDtcbn1cblxuZnVuY3Rpb24gZ2V0TnVtTGluZXNBbmRMYXN0TmV3bGluZUxlbmd0aCh0ZXh0OiBzdHJpbmcpOiB7IG51bUxpbmVzOiBudW1iZXI7IGxhc3RMaW5lTGVuZ3RoOiBudW1iZXIgfSB7XG5cdGNvbnN0IHJlID0gL1xcbi9nO1xuXHRsZXQgbnVtTGluZXMgPSAwO1xuXHRsZXQgbGFzdE5ld2xpbmVJZHggPSAtMTtcblx0bGV0IG1hdGNoOiBSZXR1cm5UeXBlPHR5cGVvZiByZS5leGVjPjtcblx0d2hpbGUgKG1hdGNoID0gcmUuZXhlYyh0ZXh0KSkge1xuXHRcdG51bUxpbmVzKys7XG5cdFx0bGFzdE5ld2xpbmVJZHggPSBtYXRjaC5pbmRleDtcblx0fVxuXG5cdGNvbnN0IGxhc3RMaW5lTGVuZ3RoID0gbGFzdE5ld2xpbmVJZHggPj0gMCA/XG5cdFx0dGV4dC5sZW5ndGggLSBsYXN0TmV3bGluZUlkeCAtIDEgOlxuXHRcdHRleHQubGVuZ3RoO1xuXG5cdHJldHVybiB7IG51bUxpbmVzLCBsYXN0TGluZUxlbmd0aCB9O1xufVxuXG4vLyBleHBvcnRlZCBmb3IgdGVzdGluZ1xuZXhwb3J0IGZ1bmN0aW9uIGdldFJnQXJncyhxdWVyeTogVGV4dFNlYXJjaFF1ZXJ5Miwgb3B0aW9uczogUmlwZ3JlcFRleHRTZWFyY2hPcHRpb25zKTogc3RyaW5nW10ge1xuXHRjb25zdCBhcmdzID0gWyctLWhpZGRlbicsICctLW5vLXJlcXVpcmUtZ2l0J107XG5cdGFyZ3MucHVzaChxdWVyeS5pc0Nhc2VTZW5zaXRpdmUgPyAnLS1jYXNlLXNlbnNpdGl2ZScgOiAnLS1pZ25vcmUtY2FzZScpO1xuXG5cdGNvbnN0IHsgZG91YmxlU3RhckluY2x1ZGVzLCBvdGhlckluY2x1ZGVzIH0gPSBncm91cEJ5KFxuXHRcdG9wdGlvbnMuZm9sZGVyT3B0aW9ucy5pbmNsdWRlcyxcblx0XHQoaW5jbHVkZTogc3RyaW5nKSA9PiBpbmNsdWRlLnN0YXJ0c1dpdGgoJyoqJykgPyAnZG91YmxlU3RhckluY2x1ZGVzJyA6ICdvdGhlckluY2x1ZGVzJyk7XG5cblx0aWYgKG90aGVySW5jbHVkZXMgJiYgb3RoZXJJbmNsdWRlcy5sZW5ndGgpIHtcblx0XHRjb25zdCB1bmlxdWVPdGhlcnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRvdGhlckluY2x1ZGVzLmZvckVhY2gob3RoZXIgPT4geyB1bmlxdWVPdGhlcnMuYWRkKG90aGVyKTsgfSk7XG5cblx0XHRhcmdzLnB1c2goJy1nJywgJyEqJyk7XG5cdFx0dW5pcXVlT3RoZXJzXG5cdFx0XHQuZm9yRWFjaChvdGhlckluY3VkZSA9PiB7XG5cdFx0XHRcdHNwcmVhZEdsb2JDb21wb25lbnRzKG90aGVySW5jdWRlKVxuXHRcdFx0XHRcdC5tYXAoYW5jaG9yR2xvYilcblx0XHRcdFx0XHQuZm9yRWFjaChnbG9iQXJnID0+IHtcblx0XHRcdFx0XHRcdGFyZ3MucHVzaCgnLWcnLCBnbG9iQXJnKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHR9XG5cblx0aWYgKGRvdWJsZVN0YXJJbmNsdWRlcyAmJiBkb3VibGVTdGFySW5jbHVkZXMubGVuZ3RoKSB7XG5cdFx0ZG91YmxlU3RhckluY2x1ZGVzLmZvckVhY2goZ2xvYkFyZyA9PiB7XG5cdFx0XHRhcmdzLnB1c2goJy1nJywgZ2xvYkFyZyk7XG5cdFx0fSk7XG5cdH1cblxuXHRvcHRpb25zLmZvbGRlck9wdGlvbnMuZXhjbHVkZXMubWFwKGUgPT4gdHlwZW9mIChlKSA9PT0gJ3N0cmluZycgPyBlIDogZS5wYXR0ZXJuKVxuXHRcdC5tYXAoYW5jaG9yR2xvYilcblx0XHQuZm9yRWFjaChyZ0dsb2IgPT4gYXJncy5wdXNoKCctZycsIGAhJHtyZ0dsb2J9YCkpO1xuXG5cdGlmIChvcHRpb25zLm1heEZpbGVTaXplKSB7XG5cdFx0YXJncy5wdXNoKCctLW1heC1maWxlc2l6ZScsIG9wdGlvbnMubWF4RmlsZVNpemUgKyAnJyk7XG5cdH1cblxuXHRpZiAob3B0aW9ucy5mb2xkZXJPcHRpb25zLnVzZUlnbm9yZUZpbGVzLmxvY2FsKSB7XG5cdFx0aWYgKCFvcHRpb25zLmZvbGRlck9wdGlvbnMudXNlSWdub3JlRmlsZXMucGFyZW50KSB7XG5cdFx0XHRhcmdzLnB1c2goJy0tbm8taWdub3JlLXBhcmVudCcpO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHQvLyBEb24ndCB1c2UgLmdpdGlnbm9yZSBvciAuaWdub3JlXG5cdFx0YXJncy5wdXNoKCctLW5vLWlnbm9yZScpO1xuXHR9XG5cblx0aWYgKG9wdGlvbnMuZm9sZGVyT3B0aW9ucy5mb2xsb3dTeW1saW5rcykge1xuXHRcdGFyZ3MucHVzaCgnLS1mb2xsb3cnKTtcblx0fVxuXG5cdGlmIChvcHRpb25zLmZvbGRlck9wdGlvbnMuZW5jb2RpbmcgJiYgb3B0aW9ucy5mb2xkZXJPcHRpb25zLmVuY29kaW5nICE9PSAndXRmOCcpIHtcblx0XHRhcmdzLnB1c2goJy0tZW5jb2RpbmcnLCBvcHRpb25zLmZvbGRlck9wdGlvbnMuZW5jb2RpbmcpO1xuXHR9XG5cblx0aWYgKG9wdGlvbnMubnVtVGhyZWFkcykge1xuXHRcdGFyZ3MucHVzaCgnLS10aHJlYWRzJywgYCR7b3B0aW9ucy5udW1UaHJlYWRzfWApO1xuXHR9XG5cblx0Ly8gUmlwZ3JlcCBoYW5kbGVzIC0tIGFzIGEgLS0gYXJnIHNlcGFyYXRvci4gT25seSAtLS5cblx0Ly8gLSBpcyBvaywgLS0tIGlzIG9rLCAtLXNvbWUtZmxhZyBpcyBhbHNvIG9rLiBOZWVkIHRvIHNwZWNpYWwgY2FzZS5cblx0aWYgKHF1ZXJ5LnBhdHRlcm4gPT09ICctLScpIHtcblx0XHRxdWVyeS5pc1JlZ0V4cCA9IHRydWU7XG5cdFx0cXVlcnkucGF0dGVybiA9ICdcXFxcLVxcXFwtJztcblx0fVxuXG5cdGlmIChxdWVyeS5pc011bHRpbGluZSAmJiAhcXVlcnkuaXNSZWdFeHApIHtcblx0XHRxdWVyeS5wYXR0ZXJuID0gZXNjYXBlUmVnRXhwQ2hhcmFjdGVycyhxdWVyeS5wYXR0ZXJuKTtcblx0XHRxdWVyeS5pc1JlZ0V4cCA9IHRydWU7XG5cdH1cblxuXHRpZiAoKDxJRXh0ZW5kZWRFeHRlbnNpb25TZWFyY2hPcHRpb25zPm9wdGlvbnMpLnVzZVBDUkUyKSB7XG5cdFx0YXJncy5wdXNoKCctLXBjcmUyJyk7XG5cdH1cblxuXHQvLyBBbGxvdyAkIHRvIG1hdGNoIC9yL25cblx0YXJncy5wdXNoKCctLWNybGYnKTtcblxuXHRpZiAocXVlcnkuaXNSZWdFeHApIHtcblx0XHRxdWVyeS5wYXR0ZXJuID0gdW5pY29kZUVzY2FwZXNUb1BDUkUyKHF1ZXJ5LnBhdHRlcm4pO1xuXHRcdGFyZ3MucHVzaCgnLS1lbmdpbmUnLCAnYXV0bycpO1xuXHR9XG5cblx0bGV0IHNlYXJjaFBhdHRlcm5BZnRlckRvdWJsZURhc2hlczogTWF5YmU8c3RyaW5nPjtcblx0aWYgKHF1ZXJ5LmlzV29yZE1hdGNoKSB7XG5cdFx0Y29uc3QgcmVnZXhwID0gY3JlYXRlUmVnRXhwKHF1ZXJ5LnBhdHRlcm4sICEhcXVlcnkuaXNSZWdFeHAsIHsgd2hvbGVXb3JkOiBxdWVyeS5pc1dvcmRNYXRjaCB9KTtcblx0XHRjb25zdCByZWdleHBTdHIgPSByZWdleHAuc291cmNlLnJlcGxhY2UoL1xcXFxcXC8vZywgJy8nKTsgLy8gUmVnRXhwLnNvdXJjZSBhcmJpdHJhcmlseSByZXR1cm5zIGVzY2FwZWQgc2xhc2hlcy4gU2VhcmNoIGFuZCBkZXN0cm95LlxuXHRcdGFyZ3MucHVzaCgnLS1yZWdleHAnLCByZWdleHBTdHIpO1xuXHR9IGVsc2UgaWYgKHF1ZXJ5LmlzUmVnRXhwKSB7XG5cdFx0bGV0IGZpeGVkUmVnZXhwUXVlcnkgPSBmaXhSZWdleE5ld2xpbmUocXVlcnkucGF0dGVybik7XG5cdFx0Zml4ZWRSZWdleHBRdWVyeSA9IGZpeE5ld2xpbmUoZml4ZWRSZWdleHBRdWVyeSk7XG5cdFx0YXJncy5wdXNoKCctLXJlZ2V4cCcsIGZpeGVkUmVnZXhwUXVlcnkpO1xuXHR9IGVsc2Uge1xuXHRcdHNlYXJjaFBhdHRlcm5BZnRlckRvdWJsZURhc2hlcyA9IHF1ZXJ5LnBhdHRlcm47XG5cdFx0YXJncy5wdXNoKCctLWZpeGVkLXN0cmluZ3MnKTtcblx0fVxuXG5cdGFyZ3MucHVzaCgnLS1uby1jb25maWcnKTtcblx0aWYgKCFvcHRpb25zLmZvbGRlck9wdGlvbnMudXNlSWdub3JlRmlsZXMuZ2xvYmFsKSB7XG5cdFx0YXJncy5wdXNoKCctLW5vLWlnbm9yZS1nbG9iYWwnKTtcblx0fVxuXG5cdGFyZ3MucHVzaCgnLS1qc29uJyk7XG5cblx0aWYgKHF1ZXJ5LmlzTXVsdGlsaW5lKSB7XG5cdFx0YXJncy5wdXNoKCctLW11bHRpbGluZScpO1xuXHR9XG5cblx0aWYgKG9wdGlvbnMuc3Vycm91bmRpbmdDb250ZXh0KSB7XG5cdFx0YXJncy5wdXNoKCctLWJlZm9yZS1jb250ZXh0Jywgb3B0aW9ucy5zdXJyb3VuZGluZ0NvbnRleHQgKyAnJyk7XG5cdFx0YXJncy5wdXNoKCctLWFmdGVyLWNvbnRleHQnLCBvcHRpb25zLnN1cnJvdW5kaW5nQ29udGV4dCArICcnKTtcblx0fVxuXG5cdC8vIEZvbGRlciB0byBzZWFyY2hcblx0YXJncy5wdXNoKCctLScpO1xuXG5cdGlmIChzZWFyY2hQYXR0ZXJuQWZ0ZXJEb3VibGVEYXNoZXMpIHtcblx0XHQvLyBQdXQgdGhlIHF1ZXJ5IGFmdGVyIC0tLCBpbiBjYXNlIHRoZSBxdWVyeSBzdGFydHMgd2l0aCBhIGRhc2hcblx0XHRhcmdzLnB1c2goc2VhcmNoUGF0dGVybkFmdGVyRG91YmxlRGFzaGVzKTtcblx0fVxuXG5cdGFyZ3MucHVzaCgnLicpO1xuXG5cdHJldHVybiBhcmdzO1xufVxuXG4vKipcbiAqIGBcImZvby8qYmFyL3NvbWV0aGluZ1wiYCAtPiBgW1wiZm9vXCIsIFwiZm9vLypiYXJcIiwgXCJmb28vKmJhci9zb21ldGhpbmdcIiwgXCJmb28vKmJhci9zb21ldGhpbmcvKipcIl1gXG4gKi9cbmZ1bmN0aW9uIHNwcmVhZEdsb2JDb21wb25lbnRzKGdsb2JDb21wb25lbnQ6IHN0cmluZyk6IHN0cmluZ1tdIHtcblx0Y29uc3QgZ2xvYkNvbXBvbmVudFdpdGhCcmFjZUV4cGFuc2lvbiA9IHBlcmZvcm1CcmFjZUV4cGFuc2lvbkZvclJpcGdyZXAoZ2xvYkNvbXBvbmVudCk7XG5cblx0cmV0dXJuIGdsb2JDb21wb25lbnRXaXRoQnJhY2VFeHBhbnNpb24uZmxhdE1hcCgoZ2xvYkFyZykgPT4ge1xuXHRcdGNvbnN0IGNvbXBvbmVudHMgPSBzcGxpdEdsb2JBd2FyZShnbG9iQXJnLCAnLycpO1xuXHRcdHJldHVybiBjb21wb25lbnRzLm1hcCgoXywgaSkgPT4gY29tcG9uZW50cy5zbGljZSgwLCBpICsgMSkuam9pbignLycpKTtcblx0fSk7XG5cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVuaWNvZGVFc2NhcGVzVG9QQ1JFMihwYXR0ZXJuOiBzdHJpbmcpOiBzdHJpbmcge1xuXHQvLyBNYXRjaCBcXHUxMjM0XG5cdGNvbnN0IHVuaWNvZGVQYXR0ZXJuID0gLygoPzpbXlxcXFxdfF4pKD86XFxcXFxcXFwpKilcXFxcdShbYS16MC05XXs0fSkvZ2k7XG5cblx0d2hpbGUgKHBhdHRlcm4ubWF0Y2godW5pY29kZVBhdHRlcm4pKSB7XG5cdFx0cGF0dGVybiA9IHBhdHRlcm4ucmVwbGFjZSh1bmljb2RlUGF0dGVybiwgYCQxXFxcXHh7JDJ9YCk7XG5cdH1cblxuXHQvLyBNYXRjaCBcXHV7MTIzNH1cblx0Ly8gXFx1IHdpdGggNS02IGNoYXJhY3RlcnMgd2lsbCBiZSBsZWZ0IGFsb25lIGJlY2F1c2UgXFx4IG9ubHkgdGFrZXMgNCBjaGFyYWN0ZXJzLlxuXHRjb25zdCB1bmljb2RlUGF0dGVybldpdGhCcmFjZXMgPSAvKCg/OlteXFxcXF18XikoPzpcXFxcXFxcXCkqKVxcXFx1XFx7KFthLXowLTldezR9KVxcfS9naTtcblx0d2hpbGUgKHBhdHRlcm4ubWF0Y2godW5pY29kZVBhdHRlcm5XaXRoQnJhY2VzKSkge1xuXHRcdHBhdHRlcm4gPSBwYXR0ZXJuLnJlcGxhY2UodW5pY29kZVBhdHRlcm5XaXRoQnJhY2VzLCBgJDFcXFxceHskMn1gKTtcblx0fVxuXG5cdHJldHVybiBwYXR0ZXJuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElSZ01lc3NhZ2Uge1xuXHR0eXBlOiAnbWF0Y2gnIHwgJ2NvbnRleHQnIHwgc3RyaW5nO1xuXHRkYXRhOiBJUmdNYXRjaDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUmdNYXRjaCB7XG5cdHBhdGg6IElSZ0J5dGVzT3JUZXh0O1xuXHRsaW5lczogSVJnQnl0ZXNPclRleHQ7XG5cdGxpbmVfbnVtYmVyOiBudW1iZXI7XG5cdGFic29sdXRlX29mZnNldDogbnVtYmVyO1xuXHRzdWJtYXRjaGVzOiBJUmdTdWJtYXRjaFtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElSZ1N1Ym1hdGNoIHtcblx0bWF0Y2g6IElSZ0J5dGVzT3JUZXh0O1xuXHRzdGFydDogbnVtYmVyO1xuXHRlbmQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IHR5cGUgSVJnQnl0ZXNPclRleHQgPSB7IGJ5dGVzOiBzdHJpbmcgfSB8IHsgdGV4dDogc3RyaW5nIH07XG5cbmNvbnN0IGlzTG9va0JlaGluZCA9IChub2RlOiBSZUFTVC5Ob2RlKSA9PiBub2RlLnR5cGUgPT09ICdBc3NlcnRpb24nICYmIG5vZGUua2luZCA9PT0gJ2xvb2tiZWhpbmQnO1xuXG5leHBvcnQgZnVuY3Rpb24gZml4UmVnZXhOZXdsaW5lKHBhdHRlcm46IHN0cmluZyk6IHN0cmluZyB7XG5cdC8vIHdlIHBhcnNlIHRoZSBwYXR0ZXJuIGFuZXcgZWFjaCB0aWVtXG5cdGxldCByZTogUmVBU1QuUGF0dGVybjtcblx0dHJ5IHtcblx0XHRyZSA9IG5ldyBSZWdFeHBQYXJzZXIoKS5wYXJzZVBhdHRlcm4ocGF0dGVybik7XG5cdH0gY2F0Y2gge1xuXHRcdHJldHVybiBwYXR0ZXJuO1xuXHR9XG5cblx0bGV0IG91dHB1dCA9ICcnO1xuXHRsZXQgbGFzdEVtaXR0ZWRJbmRleCA9IDA7XG5cdGNvbnN0IHJlcGxhY2UgPSAoc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIsIHRleHQ6IHN0cmluZykgPT4ge1xuXHRcdG91dHB1dCArPSBwYXR0ZXJuLnNsaWNlKGxhc3RFbWl0dGVkSW5kZXgsIHN0YXJ0KSArIHRleHQ7XG5cdFx0bGFzdEVtaXR0ZWRJbmRleCA9IGVuZDtcblx0fTtcblxuXHRjb25zdCBjb250ZXh0OiBSZUFTVC5Ob2RlW10gPSBbXTtcblx0Y29uc3QgdmlzaXRvciA9IG5ldyBSZWdFeHBWaXNpdG9yKHtcblx0XHRvbkNoYXJhY3RlckVudGVyKGNoYXIpIHtcblx0XHRcdGlmIChjaGFyLnJhdyAhPT0gJ1xcXFxuJykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHBhcmVudCA9IGNvbnRleHRbMF07XG5cdFx0XHRpZiAoIXBhcmVudCkge1xuXHRcdFx0XHQvLyBzaW1wbGUgY2hhciwgXFxuIC0+IFxccj9cXG5cblx0XHRcdFx0cmVwbGFjZShjaGFyLnN0YXJ0LCBjaGFyLmVuZCwgJ1xcXFxyP1xcXFxuJyk7XG5cdFx0XHR9IGVsc2UgaWYgKGNvbnRleHQuc29tZShpc0xvb2tCZWhpbmQpKSB7XG5cdFx0XHRcdC8vIG5vLW9wIGluIGEgbG9va2JlaGluZCwgc2VlICMxMDA1Njlcblx0XHRcdH0gZWxzZSBpZiAocGFyZW50LnR5cGUgPT09ICdDaGFyYWN0ZXJDbGFzcycpIHtcblx0XHRcdFx0aWYgKHBhcmVudC5uZWdhdGUpIHtcblx0XHRcdFx0XHQvLyBuZWdhdGl2ZSBicmFja2V0IGV4cHIsIFteYS16XFxuXSAtPiAoPyFbYS16XXxcXHI/XFxuKVxuXHRcdFx0XHRcdGNvbnN0IG90aGVyQ29udGVudCA9IHBhdHRlcm4uc2xpY2UocGFyZW50LnN0YXJ0ICsgMiwgY2hhci5zdGFydCkgKyBwYXR0ZXJuLnNsaWNlKGNoYXIuZW5kLCBwYXJlbnQuZW5kIC0gMSk7XG5cdFx0XHRcdFx0aWYgKHBhcmVudC5wYXJlbnQ/LnR5cGUgPT09ICdRdWFudGlmaWVyJykge1xuXHRcdFx0XHRcdFx0Ly8gSWYgcXVhbnRpZmllZCwgd2UgY2FuJ3QgdXNlIGEgbmVnYXRpdmUgbG9va2FoZWFkIGluIGEgcXVhbnRpZmllci5cblx0XHRcdFx0XHRcdC8vIEJ1dCBgLmAgYWxyZWFkeSBkb2Vzbid0IG1hdGNoIG5ldyBsaW5lcywgc28gd2UgY2FuIGp1c3QgdXNlIHRoYXRcblx0XHRcdFx0XHRcdC8vICh3aXRoIGFueSBvdGhlciBuZWdhdGlvbnMpIGluc3RlYWQuXG5cdFx0XHRcdFx0XHRyZXBsYWNlKHBhcmVudC5zdGFydCwgcGFyZW50LmVuZCwgb3RoZXJDb250ZW50ID8gYFteJHtvdGhlckNvbnRlbnR9XWAgOiAnLicpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXBsYWNlKHBhcmVudC5zdGFydCwgcGFyZW50LmVuZCwgJyg/IVxcXFxyP1xcXFxuJyArIChvdGhlckNvbnRlbnQgPyBgfFske290aGVyQ29udGVudH1dYCA6ICcnKSArICcpJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIHBvc2l0aXZlIGJyYWNrZXQgZXhwciwgW2Etelxcbl0gLT4gKD86W2Etel18XFxyP1xcbilcblx0XHRcdFx0XHRjb25zdCBvdGhlckNvbnRlbnQgPSBwYXR0ZXJuLnNsaWNlKHBhcmVudC5zdGFydCArIDEsIGNoYXIuc3RhcnQpICsgcGF0dGVybi5zbGljZShjaGFyLmVuZCwgcGFyZW50LmVuZCAtIDEpO1xuXHRcdFx0XHRcdHJlcGxhY2UocGFyZW50LnN0YXJ0LCBwYXJlbnQuZW5kLCBvdGhlckNvbnRlbnQgPT09ICcnID8gJ1xcXFxyP1xcXFxuJyA6IGAoPzpbJHtvdGhlckNvbnRlbnR9XXxcXFxccj9cXFxcbilgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChwYXJlbnQudHlwZSA9PT0gJ1F1YW50aWZpZXInKSB7XG5cdFx0XHRcdHJlcGxhY2UoY2hhci5zdGFydCwgY2hhci5lbmQsICcoPzpcXFxccj9cXFxcbiknKTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdG9uUXVhbnRpZmllckVudGVyKG5vZGUpIHtcblx0XHRcdGNvbnRleHQudW5zaGlmdChub2RlKTtcblx0XHR9LFxuXHRcdG9uUXVhbnRpZmllckxlYXZlKCkge1xuXHRcdFx0Y29udGV4dC5zaGlmdCgpO1xuXHRcdH0sXG5cdFx0b25DaGFyYWN0ZXJDbGFzc1JhbmdlRW50ZXIobm9kZSkge1xuXHRcdFx0Y29udGV4dC51bnNoaWZ0KG5vZGUpO1xuXHRcdH0sXG5cdFx0b25DaGFyYWN0ZXJDbGFzc1JhbmdlTGVhdmUoKSB7XG5cdFx0XHRjb250ZXh0LnNoaWZ0KCk7XG5cdFx0fSxcblx0XHRvbkNoYXJhY3RlckNsYXNzRW50ZXIobm9kZSkge1xuXHRcdFx0Y29udGV4dC51bnNoaWZ0KG5vZGUpO1xuXHRcdH0sXG5cdFx0b25DaGFyYWN0ZXJDbGFzc0xlYXZlKCkge1xuXHRcdFx0Y29udGV4dC5zaGlmdCgpO1xuXHRcdH0sXG5cdFx0b25Bc3NlcnRpb25FbnRlcihub2RlKSB7XG5cdFx0XHRpZiAoaXNMb29rQmVoaW5kKG5vZGUpKSB7XG5cdFx0XHRcdGNvbnRleHQucHVzaChub2RlKTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdG9uQXNzZXJ0aW9uTGVhdmUobm9kZSkge1xuXHRcdFx0aWYgKGNvbnRleHRbMF0gPT09IG5vZGUpIHtcblx0XHRcdFx0Y29udGV4dC5zaGlmdCgpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdH0pO1xuXG5cdHZpc2l0b3IudmlzaXQocmUpO1xuXHRvdXRwdXQgKz0gcGF0dGVybi5zbGljZShsYXN0RW1pdHRlZEluZGV4KTtcblx0cmV0dXJuIG91dHB1dDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpeE5ld2xpbmUocGF0dGVybjogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIHBhdHRlcm4ucmVwbGFjZSgvXFxuL2csICdcXFxccj9cXFxcbicpO1xufVxuXG4vLyBicmFjZSBleHBhbnNpb24gZm9yIHJpcGdyZXBcblxuLyoqXG4gKiBTcGxpdCBzdHJpbmcgZ2l2ZW4gZmlyc3Qgb3Bwb3J0dW5pdHkgZm9yIGJyYWNlIGV4cGFuc2lvbiBpbiB0aGUgc3RyaW5nLlxuICogLSBJZiB0aGUgYnJhY2UgaXMgcHJlcGVuZGVkIGJ5IGEgXFwgY2hhcmFjdGVyLCB0aGVuIGl0IGlzIGVzY2FwZWQuXG4gKiAtIERvZXMgbm90IHByb2Nlc3MgZXNjYXBlcyB0aGF0IGFyZSB3aXRoaW4gdGhlIHN1Yi1nbG9iLlxuICogLSBJZiB0d28gdW5lc2NhcGVkIGB7YCBvY2N1ciBiZWZvcmUgYH1gLCB0aGVuIHJpcGdyZXAgd2lsbCByZXR1cm4gYW4gZXJyb3IgZm9yIGJyYWNlIG5lc3RpbmcsIHNvIGRvbid0IHNwbGl0IG9uIHRob3NlLlxuICovXG5mdW5jdGlvbiBnZXRFc2NhcGVBd2FyZVNwbGl0U3RyaW5nRm9yUmlwZ3JlcChwYXR0ZXJuOiBzdHJpbmcpOiB7IGZpeGVkU3RhcnQ/OiBzdHJpbmc7IHN0ckluQnJhY2VzOiBzdHJpbmc7IGZpeGVkRW5kPzogc3RyaW5nIH0ge1xuXHRsZXQgaW5CcmFjZXMgPSBmYWxzZTtcblx0bGV0IGVzY2FwZWQgPSBmYWxzZTtcblx0bGV0IGZpeGVkU3RhcnQgPSAnJztcblx0bGV0IHN0ckluQnJhY2VzID0gJyc7XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgcGF0dGVybi5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IGNoYXIgPSBwYXR0ZXJuW2ldO1xuXHRcdHN3aXRjaCAoY2hhcikge1xuXHRcdFx0Y2FzZSAnXFxcXCc6XG5cdFx0XHRcdGlmIChlc2NhcGVkKSB7XG5cdFx0XHRcdFx0Ly8gSWYgd2UncmUgYWxyZWFkeSBlc2NhcGVkLCB0aGVuIGp1c3QgbGVhdmUgdGhlIGVzY2FwZWQgc2xhc2ggYW5kIHRoZSBwcmVjZWVkaW5nIHNsYXNoIHRoYXQgZXNjYXBlcyBpdC5cblx0XHRcdFx0XHQvLyBUaGUgdHdvIGVzY2FwZWQgc2xhc2hlcyB3aWxsIHJlc3VsdCBpbiBhIHNpbmdsZSBzbGFzaCBhbmQgd2hhdGV2ZXIgcHJvY2Vzc2VzIHRoZSBnbG9iIGxhdGVyIHdpbGwgcHJvcGVybHkgcHJvY2VzcyB0aGUgZXNjYXBlXG5cdFx0XHRcdFx0aWYgKGluQnJhY2VzKSB7XG5cdFx0XHRcdFx0XHRzdHJJbkJyYWNlcyArPSAnXFxcXCcgKyBjaGFyO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRmaXhlZFN0YXJ0ICs9ICdcXFxcJyArIGNoYXI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVzY2FwZWQgPSBmYWxzZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRlc2NhcGVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ3snOlxuXHRcdFx0XHRpZiAoZXNjYXBlZCkge1xuXHRcdFx0XHRcdC8vIGlmIHdlIGVzY2FwZWQgdGhpcyBvcGVuaW5nIGJyYWNrZXQsIHRoZW4gaXQgaXMgdG8gYmUgdGFrZW4gbGl0ZXJhbGx5LiBSZW1vdmUgdGhlIGBcXGAgYmVjYXVzZSB3ZSd2ZSBhY2tub3dsZWdlZCBpdCBhbmQgYWRkIHRoZSBge2AgdG8gdGhlIGFwcHJvcHJpYXRlIHN0cmluZ1xuXHRcdFx0XHRcdGlmIChpbkJyYWNlcykge1xuXHRcdFx0XHRcdFx0c3RySW5CcmFjZXMgKz0gY2hhcjtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Zml4ZWRTdGFydCArPSBjaGFyO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlc2NhcGVkID0gZmFsc2U7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKGluQnJhY2VzKSB7XG5cdFx0XHRcdFx0XHQvLyByaXBncmVwIHRyZWF0cyB0aGlzIGFzIGF0dGVtcHRpbmcgdG8gZG8gYSBuZXN0ZWQgYWx0ZXJuYXRlIGdyb3VwLCB3aGljaCBpcyBpbnZhbGlkLiBSZXR1cm4gd2l0aCBwYXR0ZXJuIGluY2x1ZGluZyBjaGFuZ2VzIGZyb20gZXNjYXBlZCBicmFjZXMuXG5cdFx0XHRcdFx0XHRyZXR1cm4geyBzdHJJbkJyYWNlczogZml4ZWRTdGFydCArICd7JyArIHN0ckluQnJhY2VzICsgJ3snICsgcGF0dGVybi5zdWJzdHJpbmcoaSArIDEpIH07XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGluQnJhY2VzID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICd9Jzpcblx0XHRcdFx0aWYgKGVzY2FwZWQpIHtcblx0XHRcdFx0XHQvLyBzYW1lIGFzIGB9YCwgYnV0IGZvciBjbG9zaW5nIGJyYWNrZXRcblx0XHRcdFx0XHRpZiAoaW5CcmFjZXMpIHtcblx0XHRcdFx0XHRcdHN0ckluQnJhY2VzICs9IGNoYXI7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGZpeGVkU3RhcnQgKz0gY2hhcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZXNjYXBlZCA9IGZhbHNlO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGluQnJhY2VzKSB7XG5cdFx0XHRcdFx0Ly8gd2UgZm91bmQgYW4gZW5kIGJyYWNrZXQgdG8gYSB2YWxpZCBvcGVuaW5nIGJyYWNrZXQuIFJldHVybiB0aGUgYXBwcm9wcmlhdGUgc3RyaW5ncy5cblx0XHRcdFx0XHRyZXR1cm4geyBmaXhlZFN0YXJ0LCBzdHJJbkJyYWNlcywgZml4ZWRFbmQ6IHBhdHRlcm4uc3Vic3RyaW5nKGkgKyAxKSB9O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIGlmIHdlJ3JlIG5vdCBpbiBicmFjZXMgYW5kIG5vdCBlc2NhcGVkLCB0aGVuIHRoaXMgaXMgYSBsaXRlcmFsIGB9YCBjaGFyYWN0ZXIgYW5kIHdlJ3JlIHN0aWxsIGFkZGluZyB0byBmaXhlZFN0YXJ0LlxuXHRcdFx0XHRcdGZpeGVkU3RhcnQgKz0gY2hhcjtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdC8vIHNpbWlsYXIgdG8gdGhlIGBcXFxcYCBjYXNlLCB3ZSBkaWRuJ3QgZG8gYW55dGhpbmcgd2l0aCB0aGUgZXNjYXBlLCBzbyB3ZSBzaG91bGQgcmUtaW5zZXJ0IGl0IGludG8gdGhlIGFwcHJvcHJpYXRlIHN0cmluZ1xuXHRcdFx0XHQvLyB0byBiZSBjb25zdW1lZCBsYXRlciB3aGVuIGluZGl2aWR1YWwgcGFydHMgb2YgdGhlIGdsb2IgYXJlIHByb2Nlc3NlZFxuXHRcdFx0XHRpZiAoaW5CcmFjZXMpIHtcblx0XHRcdFx0XHRzdHJJbkJyYWNlcyArPSAoZXNjYXBlZCA/ICdcXFxcJyA6ICcnKSArIGNoYXI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Zml4ZWRTdGFydCArPSAoZXNjYXBlZCA/ICdcXFxcJyA6ICcnKSArIGNoYXI7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZXNjYXBlZCA9IGZhbHNlO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdH1cblxuXG5cdC8vIHdlIGFyZSBoYXZlbid0IGhpdCB0aGUgbGFzdCBicmFjZSwgc28gbm8gc3BsaXR0aW5nIHNob3VsZCBvY2N1ci4gUmV0dXJuIHdpdGggcGF0dGVybiBpbmNsdWRpbmcgY2hhbmdlcyBmcm9tIGVzY2FwZWQgYnJhY2VzLlxuXHRyZXR1cm4geyBzdHJJbkJyYWNlczogZml4ZWRTdGFydCArIChpbkJyYWNlcyA/ICgneycgKyBzdHJJbkJyYWNlcykgOiAnJykgfTtcbn1cblxuLyoqXG4gKiBQYXJzZXMgb3V0IGN1cmx5IGJyYWNlcyBhbmQgcmV0dXJucyBlcXVpdmFsZW50IGdsb2JzLiBPbmx5IHN1cHBvcnRzIG9uZSBsZXZlbCBvZiBuZXN0aW5nLlxuICogRXhwb3J0ZWQgZm9yIHRlc3RpbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwZXJmb3JtQnJhY2VFeHBhbnNpb25Gb3JSaXBncmVwKHBhdHRlcm46IHN0cmluZyk6IHN0cmluZ1tdIHtcblx0Y29uc3QgeyBmaXhlZFN0YXJ0LCBzdHJJbkJyYWNlcywgZml4ZWRFbmQgfSA9IGdldEVzY2FwZUF3YXJlU3BsaXRTdHJpbmdGb3JSaXBncmVwKHBhdHRlcm4pO1xuXHRpZiAoZml4ZWRTdGFydCA9PT0gdW5kZWZpbmVkIHx8IGZpeGVkRW5kID09PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gW3N0ckluQnJhY2VzXTtcblx0fVxuXG5cdGxldCBhcnIgPSBzcGxpdEdsb2JBd2FyZShzdHJJbkJyYWNlcywgJywnKTtcblxuXHRpZiAoIWFyci5sZW5ndGgpIHtcblx0XHQvLyBvY2N1cnMgaWYgdGhlIGJyYWNlcyBhcmUgZW1wdHkuXG5cdFx0YXJyID0gWycnXTtcblx0fVxuXG5cdGNvbnN0IGVuZHMgPSBwZXJmb3JtQnJhY2VFeHBhbnNpb25Gb3JSaXBncmVwKGZpeGVkRW5kKTtcblxuXHRyZXR1cm4gYXJyLmZsYXRNYXAoKGVsZW0pID0+IHtcblx0XHRjb25zdCBzdGFydCA9IGZpeGVkU3RhcnQgKyBlbGVtO1xuXHRcdHJldHVybiBlbmRzLm1hcCgoZW5kKSA9PiB7XG5cdFx0XHRyZXR1cm4gc3RhcnQgKyBlbmQ7XG5cdFx0fSk7XG5cdH0pO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxRQUFRO0FBQ3BCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsVUFBVSxxQkFBcUI7QUFFeEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsY0FBYyw4QkFBOEI7QUFDckQsU0FBUyxXQUFXO0FBRXBCLFNBQVMsNEJBQXdGLGFBQWEsaUJBQWlCLHNCQUFzQix1QkFBdUI7QUFDNUssU0FBUyxPQUE0QixvQkFBb0Isd0JBQXdGO0FBQ2pKLFNBQXVCLGNBQWMscUJBQXFCO0FBQzFELFNBQVMsY0FBYztBQUN2QixTQUFTLFlBQW1DLG9CQUFvQiwwQkFBMEI7QUFFMUYsU0FBUyw4QkFBOEI7QUFHdkMsTUFBTSxhQUFhLE9BQU8sUUFBUSwwQkFBMEIsNEJBQTRCO0FBRWpGLE1BQU0sd0JBQXdCO0FBQUEsRUFFcEMsWUFBb0IsZUFBZ0QsYUFBa0M7QUFBbEY7QUFBZ0Q7QUFBQSxFQUFvQztBQUFBLEVBRXhHLHlCQUF5QixPQUF5QixTQUFvQyxVQUF1QyxPQUF3RDtBQUNwTCxXQUFPLFFBQVEsSUFBSSxRQUFRLGNBQWMsSUFBSSxrQkFBZ0I7QUFDNUQsWUFBTSxrQkFBNEM7QUFBQSxRQUNqRCxlQUFlO0FBQUEsUUFDZixZQUFZLEtBQUs7QUFBQSxRQUNqQixZQUFZLFFBQVE7QUFBQSxRQUNwQixnQkFBZ0IsUUFBUTtBQUFBLFFBQ3hCLGFBQWEsUUFBUTtBQUFB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
