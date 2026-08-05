import { localize } from "../../../../nls.js";
import * as Objects from "../../../../base/common/objects.js";
import * as Strings from "../../../../base/common/strings.js";
import * as Assert from "../../../../base/common/assert.js";
import { join, normalize } from "../../../../base/common/path.js";
import * as Types from "../../../../base/common/types.js";
import * as UUID from "../../../../base/common/uuid.js";
import * as Platform from "../../../../base/common/platform.js";
import Severity from "../../../../base/common/severity.js";
import { URI } from "../../../../base/common/uri.js";
import { ValidationStatus, ValidationState, Parser } from "../../../../base/common/parsers.js";
import { asArray } from "../../../../base/common/arrays.js";
import { Schemas as NetworkSchemas } from "../../../../base/common/network.js";
import { MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
import { Emitter } from "../../../../base/common/event.js";
import { FileType } from "../../../../platform/files/common/files.js";
var FileLocationKind = /* @__PURE__ */ ((FileLocationKind2) => {
  FileLocationKind2[FileLocationKind2["Default"] = 0] = "Default";
  FileLocationKind2[FileLocationKind2["Relative"] = 1] = "Relative";
  FileLocationKind2[FileLocationKind2["Absolute"] = 2] = "Absolute";
  FileLocationKind2[FileLocationKind2["AutoDetect"] = 3] = "AutoDetect";
  FileLocationKind2[FileLocationKind2["Search"] = 4] = "Search";
  return FileLocationKind2;
})(FileLocationKind || {});
((FileLocationKind2) => {
  function fromString(value) {
    value = value.toLowerCase();
    if (value === "absolute") {
      return 2 /* Absolute */;
    } else if (value === "relative") {
      return 1 /* Relative */;
    } else if (value === "autodetect") {
      return 3 /* AutoDetect */;
    } else if (value === "search") {
      return 4 /* Search */;
    } else {
      return void 0;
    }
  }
  FileLocationKind2.fromString = fromString;
})(FileLocationKind || (FileLocationKind = {}));
var ProblemLocationKind = /* @__PURE__ */ ((ProblemLocationKind2) => {
  ProblemLocationKind2[ProblemLocationKind2["File"] = 0] = "File";
  ProblemLocationKind2[ProblemLocationKind2["Location"] = 1] = "Location";
  return ProblemLocationKind2;
})(ProblemLocationKind || {});
((ProblemLocationKind2) => {
  function fromString(value) {
    value = value.toLowerCase();
    if (value === "file") {
      return 0 /* File */;
    } else if (value === "location") {
      return 1 /* Location */;
    } else {
      return void 0;
    }
  }
  ProblemLocationKind2.fromString = fromString;
})(ProblemLocationKind || (ProblemLocationKind = {}));
var ApplyToKind = /* @__PURE__ */ ((ApplyToKind2) => {
  ApplyToKind2[ApplyToKind2["allDocuments"] = 0] = "allDocuments";
  ApplyToKind2[ApplyToKind2["openDocuments"] = 1] = "openDocuments";
  ApplyToKind2[ApplyToKind2["closedDocuments"] = 2] = "closedDocuments";
  return ApplyToKind2;
})(ApplyToKind || {});
((ApplyToKind2) => {
  function fromString(value) {
    value = value.toLowerCase();
    if (value === "alldocuments") {
      return 0 /* allDocuments */;
    } else if (value === "opendocuments") {
      return 1 /* openDocuments */;
    } else if (value === "closeddocuments") {
      return 2 /* closedDocuments */;
    } else {
      return void 0;
    }
  }
  ApplyToKind2.fromString = fromString;
})(ApplyToKind || (ApplyToKind = {}));
function isNamedProblemMatcher(value) {
  return value && Types.isString(value.name) ? true : false;
}
async function getResource(filename, matcher, fileService) {
  const kind = matcher.fileLocation;
  let fullPath;
  if (kind === 2 /* Absolute */) {
    fullPath = filename;
  } else if (kind === 1 /* Relative */ && matcher.filePrefix && Types.isString(matcher.filePrefix)) {
    fullPath = join(matcher.filePrefix, filename);
  } else if (kind === 3 /* AutoDetect */) {
    const matcherClone = Objects.deepClone(matcher);
    matcherClone.fileLocation = 1 /* Relative */;
    if (fileService) {
      const relative = await getResource(filename, matcherClone);
      let stat = void 0;
      try {
        stat = await fileService.stat(relative);
      } catch (ex) {
      }
      if (stat) {
        return relative;
      }
    }
    matcherClone.fileLocation = 2 /* Absolute */;
    return getResource(filename, matcherClone);
  } else if (kind === 4 /* Search */ && fileService) {
    const fsProvider = fileService.getProvider(NetworkSchemas.file);
    if (fsProvider) {
      const uri = await searchForFileLocation(filename, fsProvider, matcher.filePrefix);
      fullPath = uri?.path;
    }
    if (!fullPath) {
      const absoluteMatcher = Objects.deepClone(matcher);
      absoluteMatcher.fileLocation = 2 /* Absolute */;
      return getResource(filename, absoluteMatcher);
    }
  }
  if (fullPath === void 0) {
    throw new Error("FileLocationKind is not actionable. Does the matcher have a filePrefix? This should never happen.");
  }
  fullPath = normalize(fullPath);
  fullPath = fullPath.replace(/\\/g, "/");
  if (fullPath[0] !== "/") {
    fullPath = "/" + fullPath;
  }
  if (matcher.uriProvider !== void 0) {
    return matcher.uriProvider(fullPath);
  } else {
    return URI.file(fullPath);
  }
}
async function searchForFileLocation(filename, fsProvider, args) {
  const exclusions = new Set(asArray(args.exclude || []).map((x) => URI.file(x).path));
  async function search(dir) {
    if (exclusions.has(dir.path)) {
      return void 0;
    }
    const entries = await fsProvider.readdir(dir);
    const subdirs = [];
    for (const [name, fileType] of entries) {
      if (fileType === FileType.Directory) {
        subdirs.push(URI.joinPath(dir, name));
        continue;
      }
      if (fileType === FileType.File) {
        const fullUri = URI.joinPath(dir, name);
        if (fullUri.path.endsWith(filename)) {
          return fullUri;
        }
      }
    }
    for (const subdir of subdirs) {
      const result = await search(subdir);
      if (result) {
        return result;
      }
    }
    return void 0;
  }
  for (const dir of asArray(args.include || [])) {
    const hit = await search(URI.file(dir));
    if (hit) {
      return hit;
    }
  }
  return void 0;
}
function createLineMatcher(matcher, fileService) {
  const pattern = matcher.pattern;
  if (Array.isArray(pattern)) {
    return new MultiLineMatcher(matcher, fileService);
  } else {
    return new SingleLineMatcher(matcher, fileService);
  }
}
const endOfLine = Platform.OS === Platform.OperatingSystem.Windows ? "\r\n" : "\n";
class AbstractLineMatcher {
  constructor(matcher, fileService) {
    this.matcher = matcher;
    this.fileService = fileService;
  }
  handle(lines, start = 0) {
    return { match: null, continue: false };
  }
  next(line) {
    return null;
  }
  fillProblemData(data, pattern, matches) {
    if (data) {
      this.fillProperty(data, "file", pattern, matches, true);
      this.appendProperty(data, "message", pattern, matches, true);
      this.fillProperty(data, "code", pattern, matches, true);
      this.fillProperty(data, "severity", pattern, matches, true);
      this.fillProperty(data, "location", pattern, matches, true);
      this.fillProperty(data, "line", pattern, matches);
      this.fillProperty(data, "character", pattern, matches);
      this.fillProperty(data, "endLine", pattern, matches);
      this.fillProperty(data, "endCharacter", pattern, matches);
      return true;
    } else {
      return false;
    }
  }
  appendProperty(data, property, pattern, matches, trim = false) {
    const patternProperty = pattern[property];
    if (Types.isUndefined(data[property])) {
      this.fillProperty(data, property, pattern, matches, trim);
    } else if (!Types.isUndefined(patternProperty) && patternProperty < matches.length) {
      let value = matches[patternProperty];
      if (trim) {
        value = Strings.trim(value);
      }
      data[property] += endOfLine + value;
    }
  }
  fillProperty(data, property, pattern, matches, trim = false) {
    const patternAtProperty = pattern[property];
    if (Types.isUndefined(data[property]) && !Types.isUndefined(patternAtProperty) && patternAtProperty < matches.length) {
      let value = matches[patternAtProperty];
      if (value !== void 0) {
        if (trim) {
          value = Strings.trim(value);
        }
        data[property] = value;
      }
    }
  }
  getMarkerMatch(data) {
    try {
      const location = this.getLocation(data);
      if (data.file && location && data.message) {
        const marker = {
          severity: this.getSeverity(data),
          startLineNumber: location.startLineNumber,
          startColumn: location.startCharacter,
          endLineNumber: location.endLineNumber,
          endColumn: location.endCharacter,
          message: data.message
        };
        if (data.code !== void 0) {
          marker.code = data.code;
        }
        if (this.matcher.source !== void 0) {
          marker.source = this.matcher.source;
        }
        return {
          description: this.matcher,
          resource: this.getResource(data.file),
          marker
        };
      }
    } catch (err) {
      console.error(`Failed to convert problem data into match: ${JSON.stringify(data)}`);
    }
    return void 0;
  }
  getResource(filename) {
    return getResource(filename, this.matcher, this.fileService);
  }
  getLocation(data) {
    if (data.kind === 0 /* File */) {
      return this.createLocation(0, 0, 0, 0);
    }
    if (data.location) {
      return this.parseLocationInfo(data.location);
    }
    if (!data.line) {
      return null;
    }
    const startLine = parseInt(data.line);
    const startColumn = data.character ? parseInt(data.character) : void 0;
    const endLine = data.endLine ? parseInt(data.endLine) : void 0;
    const endColumn = data.endCharacter ? parseInt(data.endCharacter) : void 0;
    return this.createLocation(startLine, startColumn, endLine, endColumn);
  }
  parseLocationInfo(value) {
    if (!value || !value.match(/(\d+|\d+,\d+|\d+,\d+,\d+,\d+)/)) {
      return null;
    }
    const parts = value.split(",");
    const startLine = parseInt(parts[0]);
    const startColumn = parts.length > 1 ? parseInt(parts[1]) : void 0;
    if (parts.length > 3) {
      return this.createLocation(startLine, startColumn, parseInt(parts[2]), parseInt(parts[3]));
    } else {
      return this.createLocation(startLine, startColumn, void 0, void 0);
    }
  }
  createLocation(startLine, startColumn, endLine, endColumn) {
    if (startColumn !== void 0 && endColumn !== void 0) {
      return { startLineNumber: startLine, startCharacter: startColumn, endLineNumber: endLine || startLine, endCharacter: endColumn };
    }
    if (startColumn !== void 0) {
      return { startLineNumber: startLine, startCharacter: startColumn, endLineNumber: startLine, endCharacter: startColumn };
    }
    return { startLineNumber: startLine, startCharacter: 1, endLineNumber: startLine, endCharacter: 2 ** 31 - 1 };
  }
  getSeverity(data) {
    let result = null;
    if (data.severity) {
      const value = data.severity;
      if (value) {
        result = Severity.fromValue(value);
        if (result === Severity.Ignore) {
          if (value === "E") {
            result = Severity.Error;
          } else if (value === "W") {
            result = Severity.Warning;
          } else if (value === "I") {
            result = Severity.Info;
          } else if (Strings.equalsIgnoreCase(value, "hint")) {
            result = Severity.Info;
          } else if (Strings.equalsIgnoreCase(value, "note")) {
            result = Severity.Info;
          }
        }
      }
    }
    if (result === null || result === Severity.Ignore) {
      result = this.matcher.severity || Severity.Error;
    }
    return MarkerSeverity.fromSeverity(result);
  }
}
class SingleLineMatcher extends AbstractLineMatcher {
  constructor(matcher, fileService) {
    super(matcher, fileService);
    this.pattern = matcher.pattern;
  }
  get matchLength() {
    return 1;
  }
  handle(lines, start = 0) {
    Assert.ok(lines.length - start === 1);
    const data = /* @__PURE__ */ Object.create(null);
    if (this.pattern.kind !== void 0) {
      data.kind = this.pattern.kind;
    }
    const matches = this.pattern.regexp.exec(lines[start]);
    if (matches) {
      this.fillProblemData(data, this.pattern, matches);
      const match = this.getMarkerMatch(data);
      if (match) {
        return { match, continue: false };
      }
    }
    return { match: null, continue: false };
  }
  next(line) {
    return null;
  }
}
class MultiLineMatcher extends AbstractLineMatcher {
  constructor(matcher, fileService) {
    super(matcher, fileService);
    this.patterns = matcher.pattern;
  }
  get matchLength() {
    return this.patterns.length;
  }
  handle(lines, start = 0) {
    Assert.ok(lines.length - start === this.patterns.length);
    this.data = /* @__PURE__ */ Object.create(null);
    let data = this.data;
    data.kind = this.patterns[0].kind;
    for (let i = 0; i < this.patterns.length; i++) {
      const pattern = this.patterns[i];
      const matches = pattern.regexp.exec(lines[i + start]);
      if (!matches) {
        return { match: null, continue: false };
      } else {
        if (pattern.loop && i === this.patterns.length - 1) {
          data = Objects.deepClone(data);
        }
        this.fillProblemData(data, pattern, matches);
      }
    }
    const loop = !!this.patterns[this.patterns.length - 1].loop;
    if (!loop) {
      this.data = void 0;
    }
    const markerMatch = data ? this.getMarkerMatch(data) : null;
    return { match: markerMatch ? markerMatch : null, continue: loop };
  }
  next(line) {
    const pattern = this.patterns[this.patterns.length - 1];
    Assert.ok(pattern.loop === true && this.data !== null);
    const matches = pattern.regexp.exec(line);
    if (!matches) {
      this.data = void 0;
      return null;
    }
    const data = Objects.deepClone(this.data);
    let problemMatch;
    if (this.fillProblemData(data, pattern, matches)) {
      problemMatch = this.getMarkerMatch(data);
    }
    return problemMatch ? problemMatch : null;
  }
}
var Config;
((Config2) => {
  let CheckedProblemPattern;
  ((CheckedProblemPattern2) => {
    function is(value) {
      const candidate = value;
      return candidate && Types.isString(candidate.regexp);
    }
    CheckedProblemPattern2.is = is;
  })(CheckedProblemPattern = Config2.CheckedProblemPattern || (Config2.CheckedProblemPattern = {}));
  let NamedProblemPattern;
  ((NamedProblemPattern2) => {
    function is(value) {
      const candidate = value;
      return candidate && Types.isString(candidate.name);
    }
    NamedProblemPattern2.is = is;
  })(NamedProblemPattern = Config2.NamedProblemPattern || (Config2.NamedProblemPattern = {}));
  let NamedCheckedProblemPattern;
  ((NamedCheckedProblemPattern2) => {
    function is(value) {
      const candidate = value;
      return candidate && NamedProblemPattern.is(candidate) && Types.isString(candidate.regexp);
    }
    NamedCheckedProblemPattern2.is = is;
  })(NamedCheckedProblemPattern = Config2.NamedCheckedProblemPattern || (Config2.NamedCheckedProblemPattern = {}));
  let MultiLineProblemPattern;
  ((MultiLineProblemPattern2) => {
    function is(value) {
      return value && Array.isArray(value);
    }
    MultiLineProblemPattern2.is = is;
  })(MultiLineProblemPattern = Config2.MultiLineProblemPattern || (Config2.MultiLineProblemPattern = {}));
  let MultiLineCheckedProblemPattern;
  ((MultiLineCheckedProblemPattern2) => {
    function is(value) {
      if (!MultiLineProblemPattern.is(value)) {
        return false;
      }
      for (const element of value) {
        if (!Config2.CheckedProblemPattern.is(element)) {
          return false;
        }
      }
      return true;
    }
    MultiLineCheckedProblemPattern2.is = is;
  })(MultiLineCheckedProblemPattern = Config2.MultiLineCheckedProblemPattern || (Config2.MultiLineCheckedProblemPattern = {}));
  let NamedMultiLineCheckedProblemPattern;
  ((NamedMultiLineCheckedProblemPattern2) => {
    function is(value) {
      const candidate = value;
      return candidate && Types.isString(candidate.name) && Array.isArray(candidate.patterns) && MultiLineCheckedProblemPattern.is(candidate.patterns);
    }
    NamedMultiLineCheckedProblemPattern2.is = is;
  })(NamedMultiLineCheckedProblemPattern = Config2.NamedMultiLineCheckedProblemPattern || (Config2.NamedMultiLineCheckedProblemPattern = {}));
  function isNamedProblemMatcher2(value) {
    return Types.isString(value.name);
  }
  Config2.isNamedProblemMatcher = isNamedProblemMatcher2;
})(Config || (Config = {}));
class ProblemPatternParser extends Parser {
  constructor(logger) {
    super(logger);
  }
  parse(value) {
    if (Config.NamedMultiLineCheckedProblemPattern.is(value)) {
      return this.createNamedMultiLineProblemPattern(value);
    } else if (Config.MultiLineCheckedProblemPattern.is(value)) {
      return this.createMultiLineProblemPattern(value);
    } else if (Config.NamedCheckedProblemPattern.is(value)) {
      const result = this.createSingleProblemPattern(value);
      result.name = value.name;
      return result;
    } else if (Config.CheckedProblemPattern.is(value)) {
      return this.createSingleProblemPattern(value);
    } else {
      this.error(localize("ProblemPatternParser.problemPattern.missingRegExp", "The problem pattern is missing a regular expression."));
      return null;
    }
  }
  createSingleProblemPattern(value) {
    const result = this.doCreateSingleProblemPattern(value, true);
    if (result === void 0) {
      return null;
    } else if (result.kind === void 0) {
      result.kind = 1 /* Location */;
    }
    return this.validateProblemPattern([result]) ? result : null;
  }
  createNamedMultiLineProblemPattern(value) {
    const validPatterns = this.createMultiLineProblemPattern(value.patterns);
    if (!validPatterns) {
      return null;
    }
    const result = {
      name: value.name,
      label: value.label ? value.label : value.name,
      patterns: validPatterns
    };
    return result;
  }
  createMultiLineProblemPattern(values) {
    const result = [];
    for (let i = 0; i < values.length; i++) {
      const pattern = this.doCreateSingleProblemPattern(values[i], false);
      if (pattern === void 0) {
        return null;
      }
      if (i < values.length - 1) {
        if (!Types.isUndefined(pattern.loop) && pattern.loop) {
          pattern.loop = false;
          this.error(localize("ProblemPatternParser.loopProperty.notLast", "The loop property is only supported on the last line matcher."));
        }
      }
      result.push(pattern);
    }
    if (result[0].kind === void 0) {
      result[0].kind = 1 /* Location */;
    }
    return this.validateProblemPattern(result) ? result : null;
  }
  doCreateSingleProblemPattern(value, setDefaults) {
    const regexp = this.createRegularExpression(value.regexp);
    if (regexp === void 0) {
      return void 0;
    }
    let result = { regexp };
    if (value.kind) {
      result.kind = ProblemLocationKind.fromString(value.kind);
    }
    function copyProperty(result2, source, resultKey, sourceKey) {
      const value2 = source[sourceKey];
      if (typeof value2 === "number") {
        result2[resultKey] = value2;
      }
    }
    copyProperty(result, value, "file", "file");
    copyProperty(result, value, "location", "location");
    copyProperty(result, value, "line", "line");
    copyProperty(result, value, "character", "column");
    copyProperty(result, value, "endLine", "endLine");
    copyProperty(result, value, "endCharacter", "endColumn");
    copyProperty(result, value, "severity", "severity");
    copyProperty(result, value, "code", "code");
    copyProperty(result, value, "message", "message");
    if (value.loop === true || value.loop === false) {
      result.loop = value.loop;
    }
    if (setDefaults) {
      if (result.location || result.kind === 0 /* File */) {
        const defaultValue = {
          file: 1,
          message: 0
        };
        result = Objects.mixin(result, defaultValue, false);
      } else {
        const defaultValue = {
          file: 1,
          line: 2,
          character: 3,
          message: 0
        };
        result = Objects.mixin(result, defaultValue, false);
      }
    }
    return result;
  }
  validateProblemPattern(values) {
    let file = false, message = false, location = false, line = false;
    const locationKind = values[0].kind === void 0 ? 1 /* Location */ : values[0].kind;
    values.forEach((pattern, i) => {
      if (i !== 0 && pattern.kind) {
        this.error(localize("ProblemPatternParser.problemPattern.kindProperty.notFirst", "The problem pattern is invalid. The kind property must be provided only in the first element"));
      }
      file = file || !Types.isUndefined(pattern.file);
      message = message || !Types.isUndefined(pattern.message);
      location = location || !Types.isUndefined(pattern.location);
      line = line || !Types.isUndefined(pattern.line);
    });
    if (!(file && message)) {
      this.error(localize("ProblemPatternParser.problemPattern.missingProperty", "The problem pattern is invalid. It must have at least have a file and a message."));
      return false;
    }
    if (locationKind === 1 /* Location */ && !(location || line)) {
      this.error(localize("ProblemPatternParser.problemPattern.missingLocation", 'The problem pattern is invalid. It must either have kind: "file" or have a line or location match group.'));
      return false;
    }
    return true;
  }
  createRegularExpression(value) {
    let result;
    try {
      result = new RegExp(value);
    } catch (err) {
      this.error(localize("ProblemPatternParser.invalidRegexp", "Error: The string {0} is not a valid regular expression.\n", value));
    }
    return result;
  }
}
class ExtensionRegistryReporter {
  constructor(_collector, _validationStatus = new ValidationStatus()) {
    this._collector = _collector;
    this._validationStatus = _validationStatus;
  }
  info(message) {
    this._validationStatus.state = ValidationState.Info;
    this._collector.info(message);
  }
  warn(message) {
    this._validationStatus.state = ValidationState.Warning;
    this._collector.warn(message);
  }
  error(message) {
    this._validationStatus.state = ValidationState.Error;
    this._collector.error(message);
  }
  fatal(message) {
    this._validationStatus.state = ValidationState.Fatal;
    this._collector.error(message);
  }
  get status() {
    return this._validationStatus;
  }
}
var Schemas;
((Schemas2) => {
  Schemas2.ProblemPattern = {
    default: {
      regexp: "^([^\\\\s].*)\\\\((\\\\d+,\\\\d+)\\\\):\\\\s*(.*)$",
      file: 1,
      location: 2,
      message: 3
    },
    type: "object",
    additionalProperties: false,
    properties: {
      regexp: {
        type: "string",
        description: localize("ProblemPatternSchema.regexp", "The regular expression to find an error, warning or info in the output.")
      },
      kind: {
        type: "string",
        description: localize("ProblemPatternSchema.kind", "whether the pattern matches a location (file and line) or only a file.")
      },
      file: {
        type: "integer",
        description: localize("ProblemPatternSchema.file", "The match group index of the filename. If omitted 1 is used.")
      },
      location: {
        type: "integer",
        description: localize("ProblemPatternSchema.location", "The match group index of the problem's location. Valid location patterns are: (line), (line,column) and (startLine,startColumn,endLine,endColumn). If omitted (line,column) is assumed.")
      },
      line: {
        type: "integer",
        description: localize("ProblemPatternSchema.line", "The match group index of the problem's line. Defaults to 2")
      },
      column: {
        type: "integer",
        description: localize("ProblemPatternSchema.column", "The match group index of the problem's line character. Defaults to 3")
      },
      endLine: {
        type: "integer",
        description: localize("ProblemPatternSchema.endLine", "The match group index of the problem's end line. Defaults to undefined")
      },
      endColumn: {
        type: "integer",
        description: localize("ProblemPatternSchema.endColumn", "The match group index of the problem's end line character. Defaults to undefined")
      },
      severity: {
        type: "integer",
        description: localize("ProblemPatternSchema.severity", "The match group index of the problem's severity. Defaults to undefined")
      },
      code: {
        type: "integer",
        description: localize("ProblemPatternSchema.code", "The match group index of the problem's code. Defaults to undefined")
      },
      message: {
        type: "integer",
        description: localize("ProblemPatternSchema.message", "The match group index of the message. If omitted it defaults to 4 if location is specified. Otherwise it defaults to 5.")
      },
      loop: {
        type: "boolean",
        description: localize("ProblemPatternSchema.loop", "In a multi line matcher loop indicated whether this pattern is executed in a loop as long as it matches. Can only specified on a last pattern in a multi line pattern.")
      }
    }
  };
  Schemas2.NamedProblemPattern = Objects.deepClone(Schemas2.ProblemPattern);
  Schemas2.NamedProblemPattern.properties = Objects.deepClone(Schemas2.NamedProblemPattern.properties) || {};
  Schemas2.NamedProblemPattern.properties["name"] = {
    type: "string",
    description: localize("NamedProblemPatternSchema.name", "The name of the problem pattern.")
  };
  Schemas2.MultiLineProblemPattern = {
    type: "array",
    items: Schemas2.ProblemPattern
  };
  Schemas2.NamedMultiLineProblemPattern = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: {
        type: "string",
        description: localize("NamedMultiLineProblemPatternSchema.name", "The name of the problem multi line problem pattern.")
      },
      patterns: {
        type: "array",
        description: localize("NamedMultiLineProblemPatternSchema.patterns", "The actual patterns."),
        items: Schemas2.ProblemPattern
      }
    }
  };
  Schemas2.WatchingPattern = {
    type: "object",
    additionalProperties: false,
    properties: {
      regexp: {
        type: "string",
        description: localize("WatchingPatternSchema.regexp", "The regular expression to detect the begin or end of a background task.")
      },
      file: {
        type: "integer",
        description: localize("WatchingPatternSchema.file", "The match group index of the filename. Can be omitted.")
      }
    }
  };
  Schemas2.PatternType = {
    anyOf: [
      {
        type: "string",
        description: localize("PatternTypeSchema.name", "The name of a contributed or predefined pattern")
      },
      Schemas2.ProblemPattern,
      Schemas2.MultiLineProblemPattern
    ],
    description: localize("PatternTypeSchema.description", "A problem pattern or the name of a contributed or predefined problem pattern. Can be omitted if base is specified.")
  };
  Schemas2.ProblemMatcher = {
    type: "object",
    additionalProperties: false,
    properties: {
      base: {
        type: "string",
        description: localize("ProblemMatcherSchema.base", "The name of a base problem matcher to use.")
      },
      owner: {
        type: "string",
        description: localize("ProblemMatcherSchema.owner", "The owner of the problem inside Code. Can be omitted if base is specified. Defaults to 'external' if omitted and base is not specified.")
      },
      source: {
        type: "string",
        description: localize("ProblemMatcherSchema.source", "A human-readable string describing the source of this diagnostic, e.g. 'typescript' or 'super lint'.")
      },
      severity: {
        type: "string",
        enum: ["error", "warning", "info"],
        description: localize("ProblemMatcherSchema.severity", "The default severity for captures problems. Is used if the pattern doesn't define a match group for severity.")
      },
      applyTo: {
        type: "string",
        enum: ["allDocuments", "openDocuments", "closedDocuments"],
        description: localize("ProblemMatcherSchema.applyTo", "Controls if a problem reported on a text document is applied only to open, closed or all documents.")
      },
      pattern: Schemas2.PatternType,
      fileLocation: {
        oneOf: [
          {
            type: "string",
            enum: ["absolute", "relative", "autoDetect", "search"]
          },
          {
            type: "array",
            prefixItems: [
              {
                type: "string",
                enum: ["absolute", "relative", "autoDetect", "search"]
              }
            ],
            minItems: 1,
            maxItems: 1,
            additionalItems: false
          },
          {
            type: "array",
            prefixItems: [
              { type: "string", enum: ["relative", "autoDetect"] },
              { type: "string" }
            ],
            minItems: 2,
            maxItems: 2,
            additionalItems: false,
            examples: [
              ["relative", "${workspaceFolder}"],
              ["autoDetect", "${workspaceFolder}"]
            ]
          },
          {
            type: "array",
            prefixItems: [
              { type: "string", enum: ["search"] },
              {
                type: "object",
                properties: {
                  "include": {
                    oneOf: [
                      { type: "string" },
                      { type: "array", items: { type: "string" } }
                    ]
                  },
                  "exclude": {
                    oneOf: [
                      { type: "string" },
                      { type: "array", items: { type: "string" } }
                    ]
                  }
                },
                required: ["include"]
              }
            ],
            minItems: 2,
            maxItems: 2,
            additionalItems: false,
            examples: [
              ["search", { "include": ["${workspaceFolder}"] }],
              ["search", { "include": ["${workspaceFolder}"], "exclude": [] }]
            ]
          }
        ],
        description: localize("ProblemMatcherSchema.fileLocation", "Defines how file names reported in a problem pattern should be interpreted. A relative fileLocation may be an array, where the second element of the array is the path of the relative file location. The search fileLocation mode, performs a deep (and, possibly, heavy) file system search within the directories specified by the include/exclude properties of the second element (or the current workspace directory if not specified).")
      },
      background: {
        type: "object",
        additionalProperties: false,
        description: localize("ProblemMatcherSchema.background", "Patterns to track the begin and end of a matcher active on a background task."),
        properties: {
          activeOnStart: {
            type: "boolean",
            description: localize("ProblemMatcherSchema.background.activeOnStart", "If set to true the background monitor starts in active mode. This is the same as outputting a line that matches beginsPattern when the task starts.")
          },
          beginsPattern: {
            oneOf: [
              {
                type: "string"
              },
              Schemas2.WatchingPattern
            ],
            description: localize("ProblemMatcherSchema.background.beginsPattern", "If matched in the output the start of a background task is signaled.")
          },
          endsPattern: {
            oneOf: [
              {
                type: "string"
              },
              Schemas2.WatchingPattern
            ],
            description: localize("ProblemMatcherSchema.background.endsPattern", "If matched in the output the end of a background task is signaled.")
          }
        }
      },
      watching: {
        type: "object",
        additionalProperties: false,
        deprecationMessage: localize("ProblemMatcherSchema.watching.deprecated", "The watching property is deprecated. Use background instead."),
        description: localize("ProblemMatcherSchema.watching", "Patterns to track the begin and end of a watching matcher."),
        properties: {
          activeOnStart: {
            type: "boolean",
            description: localize("ProblemMatcherSchema.watching.activeOnStart", "If set to true the watcher starts in active mode. This is the same as outputting a line that matches beginsPattern when the task starts.")
          },
          beginsPattern: {
            oneOf: [
              {
                type: "string"
              },
              Schemas2.WatchingPattern
            ],
            description: localize("ProblemMatcherSchema.watching.beginsPattern", "If matched in the output the start of a watching task is signaled.")
          },
          endsPattern: {
            oneOf: [
              {
                type: "string"
              },
              Schemas2.WatchingPattern
            ],
            description: localize("ProblemMatcherSchema.watching.endsPattern", "If matched in the output the end of a watching task is signaled.")
          }
        }
      }
    }
  };
  Schemas2.LegacyProblemMatcher = Objects.deepClone(Schemas2.ProblemMatcher);
  Schemas2.LegacyProblemMatcher.properties = Objects.deepClone(Schemas2.LegacyProblemMatcher.properties) || {};
  Schemas2.LegacyProblemMatcher.properties["watchedTaskBeginsRegExp"] = {
    type: "string",
    deprecationMessage: localize("LegacyProblemMatcherSchema.watchedBegin.deprecated", "This property is deprecated. Use the watching property instead."),
    description: localize("LegacyProblemMatcherSchema.watchedBegin", "A regular expression signaling that a watched tasks begins executing triggered through file watching.")
  };
  Schemas2.LegacyProblemMatcher.properties["watchedTaskEndsRegExp"] = {
    type: "string",
    deprecationMessage: localize("LegacyProblemMatcherSchema.watchedEnd.deprecated", "This property is deprecated. Use the watching property instead."),
    description: localize("LegacyProblemMatcherSchema.watchedEnd", "A regular expression signaling that a watched tasks ends executing.")
  };
  Schemas2.NamedProblemMatcher = Objects.deepClone(Schemas2.ProblemMatcher);
  Schemas2.NamedProblemMatcher.properties = Objects.deepClone(Schemas2.NamedProblemMatcher.properties) || {};
  Schemas2.NamedProblemMatcher.properties.name = {
    type: "string",
    description: localize("NamedProblemMatcherSchema.name", "The name of the problem matcher used to refer to it.")
  };
  Schemas2.NamedProblemMatcher.properties.label = {
    type: "string",
    description: localize("NamedProblemMatcherSchema.label", "A human readable label of the problem matcher.")
  };
})(Schemas || (Schemas = {}));
const problemPatternExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "problemPatterns",
  jsonSchema: {
    description: localize("ProblemPatternExtPoint", "Contributes problem patterns"),
    type: "array",
    items: {
      anyOf: [
        Schemas.NamedProblemPattern,
        Schemas.NamedMultiLineProblemPattern
      ]
    }
  }
});
class ProblemPatternRegistryImpl {
  constructor() {
    this.patterns = /* @__PURE__ */ Object.create(null);
    this.fillDefaults();
    this.readyPromise = new Promise((resolve, reject) => {
      problemPatternExtPoint.setHandler((extensions, delta) => {
        try {
          delta.removed.forEach((extension) => {
            const problemPatterns = extension.value;
            for (const pattern of problemPatterns) {
              if (this.patterns[pattern.name]) {
                delete this.patterns[pattern.name];
              }
            }
          });
          delta.added.forEach((extension) => {
            const problemPatterns = extension.value;
            const parser = new ProblemPatternParser(new ExtensionRegistryReporter(extension.collector));
            for (const pattern of problemPatterns) {
              if (Config.NamedMultiLineCheckedProblemPattern.is(pattern)) {
                const result = parser.parse(pattern);
                if (parser.problemReporter.status.state < ValidationState.Error) {
                  this.add(result.name, result.patterns);
                } else {
                  extension.collector.error(localize("ProblemPatternRegistry.error", "Invalid problem pattern. The pattern will be ignored."));
                  extension.collector.error(JSON.stringify(pattern, void 0, 4));
                }
              } else if (Config.NamedProblemPattern.is(pattern)) {
                const result = parser.parse(pattern);
                if (parser.problemReporter.status.state < ValidationState.Error) {
                  this.add(pattern.name, result);
                } else {
                  extension.collector.error(localize("ProblemPatternRegistry.error", "Invalid problem pattern. The pattern will be ignored."));
                  extension.collector.error(JSON.stringify(pattern, void 0, 4));
                }
              }
              parser.reset();
            }
          });
        } catch (error) {
        }
        resolve(void 0);
      });
    });
  }
  onReady() {
    return this.readyPromise;
  }
  add(key, value) {
    this.patterns[key] = value;
  }
  get(key) {
    return this.patterns[key];
  }
  fillDefaults() {
    this.add("msCompile", {
      regexp: /^(?:\s*\d+>)?(\S.*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\)\s*:\s+((?:fatal +)?error|warning|info)\s+(\w+\d+)\s*:\s*(.*)$/,
      kind: 1 /* Location */,
      file: 1,
      location: 2,
      severity: 3,
      code: 4,
      message: 5
    });
    this.add("gulp-tsc", {
      regexp: /^([^\s].*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(\d+)\s+(.*)$/,
      kind: 1 /* Location */,
      file: 1,
      location: 2,
      code: 3,
      message: 4
    });
    this.add("cpp", {
      regexp: /^(\S.*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(error|warning|info)\s+(C\d+)\s*:\s*(.*)$/,
      kind: 1 /* Location */,
      file: 1,
      location: 2,
      severity: 3,
      code: 4,
      message: 5
    });
    this.add("csc", {
      regexp: /^(\S.*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(error|warning|info)\s+(CS\d+)\s*:\s*(.*)$/,
      kind: 1 /* Location */,
      file: 1,
      location: 2,
      severity: 3,
      code: 4,
      message: 5
    });
    this.add("vb", {
      regexp: /^(\S.*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(error|warning|info)\s+(BC\d+)\s*:\s*(.*)$/,
      kind: 1 /* Location */,
      file: 1,
      location: 2,
      severity: 3,
      code: 4,
      message: 5
    });
    this.add("lessCompile", {
      regexp: /^\s*(.*) in file (.*) line no. (\d+)$/,
      kind: 1 /* Location */,
      message: 1,
      file: 2,
      line: 3
    });
    this.add("jshint", {
      regexp: /^(.*):\s+line\s+(\d+),\s+col\s+(\d+),\s(.+?)(?:\s+\((\w)(\d+)\))?$/,
      kind: 1 /* Location */,
      file: 1,
      line: 2,
      character: 3,
      message: 4,
      severity: 5,
      code: 6
    });
    this.add("jshint-stylish", [
      {
        regexp: /^(.+)$/,
        kind: 1 /* Location */,
        file: 1
      },
      {
        regexp: /^\s+line\s+(\d+)\s+col\s+(\d+)\s+(.+?)(?:\s+\((\w)(\d+)\))?$/,
        line: 1,
        character: 2,
        message: 3,
        severity: 4,
        code: 5,
        loop: true
      }
    ]);
    this.add("eslint-compact", {
      regexp: /^(.+):\sline\s(\d+),\scol\s(\d+),\s(Error|Warning|Info)\s-\s(.+)\s\((.+)\)$/,
      file: 1,
      kind: 1 /* Location */,
      line: 2,
      character: 3,
      severity: 4,
      message: 5,
      code: 6
    });
    this.add("eslint-stylish", [
      {
        regexp: /^((?:[a-zA-Z]:)*[./\\]+.*?)$/,
        kind: 1 /* Location */,
        file: 1
      },
      {
        regexp: /^\s+(\d+):(\d+)\s+(error|warning|info)\s+(.+?)(?:\s\s+(.*))?$/,
        line: 1,
        character: 2,
        severity: 3,
        message: 4,
        code: 5,
        loop: true
      }
    ]);
    this.add("go", {
      regexp: /^([^:]*: )?((.:)?[^:]*):(\d+)(:(\d+))?: (.*)$/,
      kind: 1 /* Location */,
      file: 2,
      line: 4,
      character: 6,
      message: 7
    });
  }
}
const ProblemPatternRegistry = new ProblemPatternRegistryImpl();
class ProblemMatcherParser extends Parser {
  constructor(logger) {
    super(logger);
  }
  parse(json) {
    const result = this.createProblemMatcher(json);
    if (!this.checkProblemMatcherValid(json, result)) {
      return void 0;
    }
    this.addWatchingMatcher(json, result);
    return result;
  }
  checkProblemMatcherValid(externalProblemMatcher, problemMatcher) {
    if (!problemMatcher) {
      this.error(localize("ProblemMatcherParser.noProblemMatcher", "Error: the description can't be converted into a problem matcher:\n{0}\n", JSON.stringify(externalProblemMatcher, null, 4)));
      return false;
    }
    if (!problemMatcher.pattern) {
      this.error(localize("ProblemMatcherParser.noProblemPattern", "Error: the description doesn't define a valid problem pattern:\n{0}\n", JSON.stringify(externalProblemMatcher, null, 4)));
      return false;
    }
    if (!problemMatcher.owner) {
      this.error(localize("ProblemMatcherParser.noOwner", "Error: the description doesn't define an owner:\n{0}\n", JSON.stringify(externalProblemMatcher, null, 4)));
      return false;
    }
    if (Types.isUndefined(problemMatcher.fileLocation)) {
      this.error(localize("ProblemMatcherParser.noFileLocation", "Error: the description doesn't define a file location:\n{0}\n", JSON.stringify(externalProblemMatcher, null, 4)));
      return false;
    }
    return true;
  }
  createProblemMatcher(description) {
    let result = null;
    const owner = Types.isString(description.owner) ? description.owner : UUID.generateUuid();
    const source = Types.isString(description.source) ? description.source : void 0;
    let applyTo = Types.isString(description.applyTo) ? ApplyToKind.fromString(description.applyTo) : 0 /* allDocuments */;
    if (!applyTo) {
      applyTo = 0 /* allDocuments */;
    }
    let fileLocation = void 0;
    let filePrefix = void 0;
    let kind;
    if (Types.isUndefined(description.fileLocation)) {
      fileLocation = 1 /* Relative */;
      filePrefix = "${workspaceFolder}";
    } else if (Types.isString(description.fileLocation)) {
      kind = FileLocationKind.fromString(description.fileLocation);
      if (kind) {
        fileLocation = kind;
        if (kind === 1 /* Relative */ || kind === 3 /* AutoDetect */) {
          filePrefix = "${workspaceFolder}";
        } else if (kind === 4 /* Search */) {
          filePrefix = { include: ["${workspaceFolder}"] };
        }
      }
    } else if (Types.isStringArray(description.fileLocation)) {
      const values = description.fileLocation;
      if (values.length > 0) {
        kind = FileLocationKind.fromString(values[0]);
        if (values.length === 1 && kind === 2 /* Absolute */) {
          fileLocation = kind;
        } else if (values.length === 2 && (kind === 1 /* Relative */ || kind === 3 /* AutoDetect */) && values[1]) {
          fileLocation = kind;
          filePrefix = values[1];
        }
      }
    } else if (Array.isArray(description.fileLocation)) {
      const kind2 = FileLocationKind.fromString(description.fileLocation[0]);
      if (kind2 === 4 /* Search */) {
        fileLocation = 4 /* Search */;
        filePrefix = description.fileLocation[1] ?? { include: ["${workspaceFolder}"] };
      }
    }
    const pattern = description.pattern ? this.createProblemPattern(description.pattern) : void 0;
    let severity = description.severity ? Severity.fromValue(description.severity) : void 0;
    if (severity === Severity.Ignore) {
      this.info(localize("ProblemMatcherParser.unknownSeverity", "Info: unknown severity {0}. Valid values are error, warning and info.\n", description.severity));
      severity = Severity.Error;
    }
    if (Types.isString(description.base)) {
      const variableName = description.base;
      if (variableName.length > 1 && variableName[0] === "$") {
        const base = ProblemMatcherRegistry.get(variableName.substring(1));
        if (base) {
          result = Objects.deepClone(base);
          if (description.owner !== void 0 && owner !== void 0) {
            result.owner = owner;
          }
          if (description.source !== void 0 && source !== void 0) {
            result.source = source;
          }
          if (description.fileLocation !== void 0 && fileLocation !== void 0) {
            result.fileLocation = fileLocation;
            result.filePrefix = filePrefix;
          }
          if (description.pattern !== void 0 && pattern !== void 0 && pattern !== null) {
            result.pattern = pattern;
          }
          if (description.severity !== void 0 && severity !== void 0) {
            result.severity = severity;
          }
          if (description.applyTo !== void 0 && applyTo !== void 0) {
            result.applyTo = applyTo;
          }
        }
      }
    } else if (fileLocation && pattern) {
      result = {
        owner,
        applyTo,
        fileLocation,
        pattern
      };
      if (source) {
        result.source = source;
      }
      if (filePrefix) {
        result.filePrefix = filePrefix;
      }
      if (severity) {
        result.severity = severity;
      }
    }
    if (Config.isNamedProblemMatcher(description)) {
      result.name = description.name;
      result.label = Types.isString(description.label) ? description.label : description.name;
    }
    return result;
  }
  createProblemPattern(value) {
    if (Types.isString(value)) {
      const variableName = value;
      if (variableName.length > 1 && variableName[0] === "$") {
        const result = ProblemPatternRegistry.get(variableName.substring(1));
        if (!result) {
          this.error(localize("ProblemMatcherParser.noDefinedPatter", "Error: the pattern with the identifier {0} doesn't exist.", variableName));
        }
        return result;
      } else {
        if (variableName.length === 0) {
          this.error(localize("ProblemMatcherParser.noIdentifier", "Error: the pattern property refers to an empty identifier."));
        } else {
          this.error(localize("ProblemMatcherParser.noValidIdentifier", "Error: the pattern property {0} is not a valid pattern variable name.", variableName));
        }
      }
    } else if (value) {
      const problemPatternParser = new ProblemPatternParser(this.problemReporter);
      if (Array.isArray(value)) {
        return problemPatternParser.parse(value);
      } else {
        return problemPatternParser.parse(value);
      }
    }
    return null;
  }
  addWatchingMatcher(external, internal) {
    const oldBegins = this.createRegularExpression(external.watchedTaskBeginsRegExp);
    const oldEnds = this.createRegularExpression(external.watchedTaskEndsRegExp);
    if (oldBegins && oldEnds) {
      internal.watching = {
        activeOnStart: false,
        beginsPattern: { regexp: oldBegins },
        endsPattern: { regexp: oldEnds }
      };
      return;
    }
    const backgroundMonitor = external.background || external.watching;
    if (Types.isUndefinedOrNull(backgroundMonitor)) {
      return;
    }
    const begins = this.createWatchingPattern(backgroundMonitor.beginsPattern);
    const ends = this.createWatchingPattern(backgroundMonitor.endsPattern);
    if (begins && ends) {
      internal.watching = {
        activeOnStart: Types.isBoolean(backgroundMonitor.activeOnStart) ? backgroundMonitor.activeOnStart : false,
        beginsPattern: begins,
        endsPattern: ends
      };
      return;
    }
    if (begins || ends) {
      this.error(localize("ProblemMatcherParser.problemPattern.watchingMatcher", "A problem matcher must define both a begin pattern and an end pattern for watching."));
    }
  }
  createWatchingPattern(external) {
    if (Types.isUndefinedOrNull(external)) {
      return null;
    }
    let regexp;
    let file;
    if (Types.isString(external)) {
      regexp = this.createRegularExpression(external);
    } else {
      regexp = this.createRegularExpression(external.regexp);
      if (Types.isNumber(external.file)) {
        file = external.file;
      }
    }
    if (!regexp) {
      return null;
    }
    return file ? { regexp, file } : { regexp, file: 1 };
  }
  createRegularExpression(value) {
    let result = null;
    if (!value) {
      return result;
    }
    try {
      result = new RegExp(value);
    } catch (err) {
      this.error(localize("ProblemMatcherParser.invalidRegexp", "Error: The string {0} is not a valid regular expression.\n", value));
    }
    return result;
  }
}
const problemMatchersExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "problemMatchers",
  deps: [problemPatternExtPoint],
  jsonSchema: {
    description: localize("ProblemMatcherExtPoint", "Contributes problem matchers"),
    type: "array",
    items: Schemas.NamedProblemMatcher
  }
});
class ProblemMatcherRegistryImpl {
  constructor() {
    this._onMatchersChanged = new Emitter();
    this.onMatcherChanged = this._onMatchersChanged.event;
    this.matchers = /* @__PURE__ */ Object.create(null);
    this.fillDefaults();
    this.readyPromise = new Promise((resolve, reject) => {
      problemMatchersExtPoint.setHandler((extensions, delta) => {
        try {
          delta.removed.forEach((extension) => {
            const problemMatchers = extension.value;
            for (const matcher2 of problemMatchers) {
              if (this.matchers[matcher2.name]) {
                delete this.matchers[matcher2.name];
              }
            }
          });
          delta.added.forEach((extension) => {
            const problemMatchers = extension.value;
            const parser = new ProblemMatcherParser(new ExtensionRegistryReporter(extension.collector));
            for (const matcher2 of problemMatchers) {
              const result = parser.parse(matcher2);
              if (result && isNamedProblemMatcher(result)) {
                this.add(result);
              }
            }
          });
          if (delta.removed.length > 0 || delta.added.length > 0) {
            this._onMatchersChanged.fire();
          }
        } catch (error) {
        }
        const matcher = this.get("tsc-watch");
        if (matcher) {
          matcher.tscWatch = true;
        }
        resolve(void 0);
      });
    });
  }
  onReady() {
    ProblemPatternRegistry.onReady();
    return this.readyPromise;
  }
  add(matcher) {
    this.matchers[matcher.name] = matcher;
  }
  get(name) {
    return this.matchers[name];
  }
  keys() {
    return Object.keys(this.matchers);
  }
  fillDefaults() {
    this.add({
      name: "msCompile",
      label: localize("msCompile", "Microsoft compiler problems"),
      owner: "msCompile",
      source: "cpp",
      applyTo: 0 /* allDocuments */,
      fileLocation: 2 /* Absolute */,
      pattern: ProblemPatternRegistry.get("msCompile")
    });
    this.add({
      name: "lessCompile",
      label: localize("lessCompile", "Less problems"),
      deprecated: true,
      owner: "lessCompile",
      source: "less",
      applyTo: 0 /* allDocuments */,
      fileLocation: 2 /* Absolute */,
      pattern: ProblemPatternRegistry.get("lessCompile"),
      severity: Severity.Error
    });
    this.add({
      name: "gulp-tsc",
      label: localize("gulp-tsc", "Gulp TSC Problems"),
      owner: "typescript",
      source: "ts",
      applyTo: 2 /* closedDocuments */,
      fileLocation: 1 /* Relative */,
      filePrefix: "${workspaceFolder}",
      pattern: ProblemPatternRegistry.get("gulp-tsc")
    });
    this.add({
      name: "jshint",
      label: localize("jshint", "JSHint problems"),
      owner: "jshint",
      source: "jshint",
      applyTo: 0 /* allDocuments */,
      fileLocation: 2 /* Absolute */,
      pattern: ProblemPatternRegistry.get("jshint")
    });
    this.add({
      name: "jshint-stylish",
      label: localize("jshint-stylish", "JSHint stylish problems"),
      owner: "jshint",
      source: "jshint",
      applyTo: 0 /* allDocuments */,
      fileLocation: 2 /* Absolute */,
      pattern: ProblemPatternRegistry.get("jshint-stylish")
    });
    this.add({
      name: "eslint-compact",
      label: localize("eslint-compact", "ESLint compact problems"),
      owner: "eslint",
      source: "eslint",
      applyTo: 0 /* allDocuments */,
      fileLocation: 2 /* Absolute */,
      filePrefix: "${workspaceFolder}",
      pattern: ProblemPatternRegistry.get("eslint-compact")
    });
    this.add({
      name: "eslint-stylish",
      label: localize("eslint-stylish", "ESLint stylish problems"),
      owner: "eslint",
      source: "eslint",
      applyTo: 0 /* allDocuments */,
      fileLocation: 2 /* Absolute */,
      pattern: ProblemPatternRegistry.get("eslint-stylish")
    });
    this.add({
      name: "go",
      label: localize("go", "Go problems"),
      owner: "go",
      source: "go",
      applyTo: 0 /* allDocuments */,
      fileLocation: 1 /* Relative */,
      filePrefix: "${workspaceFolder}",
      pattern: ProblemPatternRegistry.get("go")
    });
  }
}
const ProblemMatcherRegistry = new ProblemMatcherRegistryImpl();
export {
  ApplyToKind,
  Config,
  ExtensionRegistryReporter,
  FileLocationKind,
  ProblemLocationKind,
  ProblemMatcherParser,
  ProblemMatcherRegistry,
  ProblemPatternParser,
  ProblemPatternRegistry,
  Schemas,
  createLineMatcher,
  getResource,
  isNamedProblemMatcher
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9jb21tb24vcHJvYmxlbU1hdGNoZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5cbmltcG9ydCAqIGFzIE9iamVjdHMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgKiBhcyBTdHJpbmdzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0ICogYXMgQXNzZXJ0IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Fzc2VydC5qcyc7XG5pbXBvcnQgeyBqb2luLCBub3JtYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCAqIGFzIFVVSUQgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgKiBhcyBQbGF0Zm9ybSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElKU09OU2NoZW1hIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vanNvblNjaGVtYS5qcyc7XG5pbXBvcnQgeyBWYWxpZGF0aW9uU3RhdHVzLCBWYWxpZGF0aW9uU3RhdGUsIElQcm9ibGVtUmVwb3J0ZXIsIFBhcnNlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhcnNlcnMuanMnO1xuaW1wb3J0IHsgSVN0cmluZ0RpY3Rpb25hcnkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBhc0FycmF5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgYXMgTmV0d29ya1NjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcblxuaW1wb3J0IHsgSU1hcmtlckRhdGEsIE1hcmtlclNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zUmVnaXN0cnksIEV4dGVuc2lvbk1lc3NhZ2VDb2xsZWN0b3IgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBGaWxlVHlwZSwgSUZpbGVTZXJ2aWNlLCBJRmlsZVN0YXRXaXRoUGFydGlhbE1ldGFkYXRhLCBJRmlsZVN5c3RlbVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcblxuZXhwb3J0IGVudW0gRmlsZUxvY2F0aW9uS2luZCB7XG5cdERlZmF1bHQsXG5cdFJlbGF0aXZlLFxuXHRBYnNvbHV0ZSxcblx0QXV0b0RldGVjdCxcblx0U2VhcmNoXG59XG5cbmV4cG9ydCBtb2R1bGUgRmlsZUxvY2F0aW9uS2luZCB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tU3RyaW5nKHZhbHVlOiBzdHJpbmcpOiBGaWxlTG9jYXRpb25LaW5kIHwgdW5kZWZpbmVkIHtcblx0XHR2YWx1ZSA9IHZhbHVlLnRvTG93ZXJDYXNlKCk7XG5cdFx0aWYgKHZhbHVlID09PSAnYWJzb2x1dGUnKSB7XG5cdFx0XHRyZXR1cm4gRmlsZUxvY2F0aW9uS2luZC5BYnNvbHV0ZTtcblx0XHR9IGVsc2UgaWYgKHZhbHVlID09PSAncmVsYXRpdmUnKSB7XG5cdFx0XHRyZXR1cm4gRmlsZUxvY2F0aW9uS2luZC5SZWxhdGl2ZTtcblx0XHR9IGVsc2UgaWYgKHZhbHVlID09PSAnYXV0b2RldGVjdCcpIHtcblx0XHRcdHJldHVybiBGaWxlTG9jYXRpb25LaW5kLkF1dG9EZXRlY3Q7XG5cdFx0fSBlbHNlIGlmICh2YWx1ZSA9PT0gJ3NlYXJjaCcpIHtcblx0XHRcdHJldHVybiBGaWxlTG9jYXRpb25LaW5kLlNlYXJjaDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGVudW0gUHJvYmxlbUxvY2F0aW9uS2luZCB7XG5cdEZpbGUsXG5cdExvY2F0aW9uXG59XG5cbmV4cG9ydCBtb2R1bGUgUHJvYmxlbUxvY2F0aW9uS2luZCB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tU3RyaW5nKHZhbHVlOiBzdHJpbmcpOiBQcm9ibGVtTG9jYXRpb25LaW5kIHwgdW5kZWZpbmVkIHtcblx0XHR2YWx1ZSA9IHZhbHVlLnRvTG93ZXJDYXNlKCk7XG5cdFx0aWYgKHZhbHVlID09PSAnZmlsZScpIHtcblx0XHRcdHJldHVybiBQcm9ibGVtTG9jYXRpb25LaW5kLkZpbGU7XG5cdFx0fSBlbHNlIGlmICh2YWx1ZSA9PT0gJ2xvY2F0aW9uJykge1xuXHRcdFx0cmV0dXJuIFByb2JsZW1Mb2NhdGlvbktpbmQuTG9jYXRpb247XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVByb2JsZW1QYXR0ZXJuIHtcblx0cmVnZXhwOiBSZWdFeHA7XG5cblx0a2luZD86IFByb2JsZW1Mb2NhdGlvbktpbmQ7XG5cblx0ZmlsZT86IG51bWJlcjtcblxuXHRtZXNzYWdlPzogbnVtYmVyO1xuXG5cdGxvY2F0aW9uPzogbnVtYmVyO1xuXG5cdGxpbmU/OiBudW1iZXI7XG5cblx0Y2hhcmFjdGVyPzogbnVtYmVyO1xuXG5cdGVuZExpbmU/OiBudW1iZXI7XG5cblx0ZW5kQ2hhcmFjdGVyPzogbnVtYmVyO1xuXG5cdGNvZGU/OiBudW1iZXI7XG5cblx0c2V2ZXJpdHk/OiBudW1iZXI7XG5cblx0bG9vcD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5hbWVkUHJvYmxlbVBhdHRlcm4gZXh0ZW5kcyBJUHJvYmxlbVBhdHRlcm4ge1xuXHRuYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIE11bHRpTGluZVByb2JsZW1QYXR0ZXJuID0gSVByb2JsZW1QYXR0ZXJuW107XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdhdGNoaW5nUGF0dGVybiB7XG5cdHJlZ2V4cDogUmVnRXhwO1xuXHRmaWxlPzogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElXYXRjaGluZ01hdGNoZXIge1xuXHRhY3RpdmVPblN0YXJ0OiBib29sZWFuO1xuXHRiZWdpbnNQYXR0ZXJuOiBJV2F0Y2hpbmdQYXR0ZXJuO1xuXHRlbmRzUGF0dGVybjogSVdhdGNoaW5nUGF0dGVybjtcbn1cblxuZXhwb3J0IGVudW0gQXBwbHlUb0tpbmQge1xuXHRhbGxEb2N1bWVudHMsXG5cdG9wZW5Eb2N1bWVudHMsXG5cdGNsb3NlZERvY3VtZW50c1xufVxuXG5leHBvcnQgbW9kdWxlIEFwcGx5VG9LaW5kIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb21TdHJpbmcodmFsdWU6IHN0cmluZyk6IEFwcGx5VG9LaW5kIHwgdW5kZWZpbmVkIHtcblx0XHR2YWx1ZSA9IHZhbHVlLnRvTG93ZXJDYXNlKCk7XG5cdFx0aWYgKHZhbHVlID09PSAnYWxsZG9jdW1lbnRzJykge1xuXHRcdFx0cmV0dXJuIEFwcGx5VG9LaW5kLmFsbERvY3VtZW50cztcblx0XHR9IGVsc2UgaWYgKHZhbHVlID09PSAnb3BlbmRvY3VtZW50cycpIHtcblx0XHRcdHJldHVybiBBcHBseVRvS2luZC5vcGVuRG9jdW1lbnRzO1xuXHRcdH0gZWxzZSBpZiAodmFsdWUgPT09ICdjbG9zZWRkb2N1bWVudHMnKSB7XG5cdFx0XHRyZXR1cm4gQXBwbHlUb0tpbmQuY2xvc2VkRG9jdW1lbnRzO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFByb2JsZW1NYXRjaGVyIHtcblx0b3duZXI6IHN0cmluZztcblx0c291cmNlPzogc3RyaW5nO1xuXHRhcHBseVRvOiBBcHBseVRvS2luZDtcblx0ZmlsZUxvY2F0aW9uOiBGaWxlTG9jYXRpb25LaW5kO1xuXHRmaWxlUHJlZml4Pzogc3RyaW5nIHwgQ29uZmlnLlNlYXJjaEZpbGVMb2NhdGlvbkFyZ3M7XG5cdHBhdHRlcm46IElQcm9ibGVtUGF0dGVybiB8IElQcm9ibGVtUGF0dGVybltdO1xuXHRzZXZlcml0eT86IFNldmVyaXR5O1xuXHR3YXRjaGluZz86IElXYXRjaGluZ01hdGNoZXI7XG5cdHVyaVByb3ZpZGVyPzogKHBhdGg6IHN0cmluZykgPT4gVVJJO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOYW1lZFByb2JsZW1NYXRjaGVyIGV4dGVuZHMgUHJvYmxlbU1hdGNoZXIge1xuXHRuYW1lOiBzdHJpbmc7XG5cdGxhYmVsOiBzdHJpbmc7XG5cdGRlcHJlY2F0ZWQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOYW1lZE11bHRpTGluZVByb2JsZW1QYXR0ZXJuIHtcblx0bmFtZTogc3RyaW5nO1xuXHRsYWJlbDogc3RyaW5nO1xuXHRwYXR0ZXJuczogTXVsdGlMaW5lUHJvYmxlbVBhdHRlcm47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc05hbWVkUHJvYmxlbU1hdGNoZXIodmFsdWU6IFByb2JsZW1NYXRjaGVyIHwgdW5kZWZpbmVkKTogdmFsdWUgaXMgSU5hbWVkUHJvYmxlbU1hdGNoZXIge1xuXHRyZXR1cm4gdmFsdWUgJiYgVHlwZXMuaXNTdHJpbmcoKDxJTmFtZWRQcm9ibGVtTWF0Y2hlcj52YWx1ZSkubmFtZSkgPyB0cnVlIDogZmFsc2U7XG59XG5cbmludGVyZmFjZSBJTG9jYXRpb24ge1xuXHRzdGFydExpbmVOdW1iZXI6IG51bWJlcjtcblx0c3RhcnRDaGFyYWN0ZXI6IG51bWJlcjtcblx0ZW5kTGluZU51bWJlcjogbnVtYmVyO1xuXHRlbmRDaGFyYWN0ZXI6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIElQcm9ibGVtRGF0YSB7XG5cdGtpbmQ/OiBQcm9ibGVtTG9jYXRpb25LaW5kO1xuXHRmaWxlPzogc3RyaW5nO1xuXHRsb2NhdGlvbj86IHN0cmluZztcblx0bGluZT86IHN0cmluZztcblx0Y2hhcmFjdGVyPzogc3RyaW5nO1xuXHRlbmRMaW5lPzogc3RyaW5nO1xuXHRlbmRDaGFyYWN0ZXI/OiBzdHJpbmc7XG5cdG1lc3NhZ2U/OiBzdHJpbmc7XG5cdHNldmVyaXR5Pzogc3RyaW5nO1xuXHRjb2RlPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElQcm9ibGVtTWF0Y2gge1xuXHRyZXNvdXJjZTogUHJvbWlzZTxVUkk+O1xuXHRtYXJrZXI6IElNYXJrZXJEYXRhO1xuXHRkZXNjcmlwdGlvbjogUHJvYmxlbU1hdGNoZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUhhbmRsZVJlc3VsdCB7XG5cdG1hdGNoOiBJUHJvYmxlbU1hdGNoIHwgbnVsbDtcblx0Y29udGludWU6IGJvb2xlYW47XG59XG5cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFJlc291cmNlKGZpbGVuYW1lOiBzdHJpbmcsIG1hdGNoZXI6IFByb2JsZW1NYXRjaGVyLCBmaWxlU2VydmljZT86IElGaWxlU2VydmljZSk6IFByb21pc2U8VVJJPiB7XG5cdGNvbnN0IGtpbmQgPSBtYXRjaGVyLmZpbGVMb2NhdGlvbjtcblx0bGV0IGZ1bGxQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGlmIChraW5kID09PSBGaWxlTG9jYXRpb25LaW5kLkFic29sdXRlKSB7XG5cdFx0ZnVsbFBhdGggPSBmaWxlbmFtZTtcblx0fSBlbHNlIGlmICgoa2luZCA9PT0gRmlsZUxvY2F0aW9uS2luZC5SZWxhdGl2ZSkgJiYgbWF0Y2hlci5maWxlUHJlZml4ICYmIFR5cGVzLmlzU3RyaW5nKG1hdGNoZXIuZmlsZVByZWZpeCkpIHtcblx0XHRmdWxsUGF0aCA9IGpvaW4obWF0Y2hlci5maWxlUHJlZml4LCBmaWxlbmFtZSk7XG5cdH0gZWxzZSBpZiAoa2luZCA9PT0gRmlsZUxvY2F0aW9uS2luZC5BdXRvRGV0ZWN0KSB7XG5cdFx0Y29uc3QgbWF0Y2hlckNsb25lID0gT2JqZWN0cy5kZWVwQ2xvbmUobWF0Y2hlcik7XG5cdFx0bWF0Y2hlckNsb25lLmZpbGVMb2NhdGlvbiA9IEZpbGVMb2NhdGlvbktpbmQuUmVsYXRpdmU7XG5cdFx0aWYgKGZpbGVTZXJ2aWNlKSB7XG5cdFx0XHRjb25zdCByZWxhdGl2ZSA9IGF3YWl0IGdldFJlc291cmNlKGZpbGVuYW1lLCBtYXRjaGVyQ2xvbmUpO1xuXHRcdFx0bGV0IHN0YXQ6IElGaWxlU3RhdFdpdGhQYXJ0aWFsTWV0YWRhdGEgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzdGF0ID0gYXdhaXQgZmlsZVNlcnZpY2Uuc3RhdChyZWxhdGl2ZSk7XG5cdFx0XHR9IGNhdGNoIChleCkge1xuXHRcdFx0XHQvLyBEbyBub3RoaW5nLCB3ZSBqdXN0IG5lZWQgdG8gY2F0Y2ggZmlsZSByZXNvbHV0aW9uIGVycm9ycy5cblx0XHRcdH1cblx0XHRcdGlmIChzdGF0KSB7XG5cdFx0XHRcdHJldHVybiByZWxhdGl2ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRtYXRjaGVyQ2xvbmUuZmlsZUxvY2F0aW9uID0gRmlsZUxvY2F0aW9uS2luZC5BYnNvbHV0ZTtcblx0XHRyZXR1cm4gZ2V0UmVzb3VyY2UoZmlsZW5hbWUsIG1hdGNoZXJDbG9uZSk7XG5cdH0gZWxzZSBpZiAoa2luZCA9PT0gRmlsZUxvY2F0aW9uS2luZC5TZWFyY2ggJiYgZmlsZVNlcnZpY2UpIHtcblx0XHRjb25zdCBmc1Byb3ZpZGVyID0gZmlsZVNlcnZpY2UuZ2V0UHJvdmlkZXIoTmV0d29ya1NjaGVtYXMuZmlsZSk7XG5cdFx0aWYgKGZzUHJvdmlkZXIpIHtcblx0XHRcdGNvbnN0IHVyaSA9IGF3YWl0IHNlYXJjaEZvckZpbGVMb2NhdGlvbihmaWxlbmFtZSwgZnNQcm92aWRlciwgbWF0Y2hlci5maWxlUHJlZml4IGFzIENvbmZpZy5TZWFyY2hGaWxlTG9jYXRpb25BcmdzKTtcblx0XHRcdGZ1bGxQYXRoID0gdXJpPy5wYXRoO1xuXHRcdH1cblxuXHRcdGlmICghZnVsbFBhdGgpIHtcblx0XHRcdGNvbnN0IGFic29sdXRlTWF0Y2hlciA9IE9iamVjdHMuZGVlcENsb25lKG1hdGNoZXIpO1xuXHRcdFx0YWJzb2x1dGVNYXRjaGVyLmZpbGVMb2NhdGlvbiA9IEZpbGVMb2NhdGlvbktpbmQuQWJzb2x1dGU7XG5cdFx0XHRyZXR1cm4gZ2V0UmVzb3VyY2UoZmlsZW5hbWUsIGFic29sdXRlTWF0Y2hlcik7XG5cdFx0fVxuXHR9XG5cdGlmIChmdWxsUGF0aCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdGaWxlTG9jYXRpb25LaW5kIGlzIG5vdCBhY3Rpb25hYmxlLiBEb2VzIHRoZSBtYXRjaGVyIGhhdmUgYSBmaWxlUHJlZml4PyBUaGlzIHNob3VsZCBuZXZlciBoYXBwZW4uJyk7XG5cdH1cblx0ZnVsbFBhdGggPSBub3JtYWxpemUoZnVsbFBhdGgpO1xuXHRmdWxsUGF0aCA9IGZ1bGxQYXRoLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcblx0aWYgKGZ1bGxQYXRoWzBdICE9PSAnLycpIHtcblx0XHRmdWxsUGF0aCA9ICcvJyArIGZ1bGxQYXRoO1xuXHR9XG5cdGlmIChtYXRjaGVyLnVyaVByb3ZpZGVyICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gbWF0Y2hlci51cmlQcm92aWRlcihmdWxsUGF0aCk7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIFVSSS5maWxlKGZ1bGxQYXRoKTtcblx0fVxufVxuXG5hc3luYyBmdW5jdGlvbiBzZWFyY2hGb3JGaWxlTG9jYXRpb24oZmlsZW5hbWU6IHN0cmluZywgZnNQcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlciwgYXJnczogQ29uZmlnLlNlYXJjaEZpbGVMb2NhdGlvbkFyZ3MpOiBQcm9taXNlPFVSSSB8IHVuZGVmaW5lZD4ge1xuXHRjb25zdCBleGNsdXNpb25zID0gbmV3IFNldChhc0FycmF5KGFyZ3MuZXhjbHVkZSB8fCBbXSkubWFwKHggPT4gVVJJLmZpbGUoeCkucGF0aCkpO1xuXHRhc3luYyBmdW5jdGlvbiBzZWFyY2goZGlyOiBVUkkpOiBQcm9taXNlPFVSSSB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmIChleGNsdXNpb25zLmhhcyhkaXIucGF0aCkpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZW50cmllcyA9IGF3YWl0IGZzUHJvdmlkZXIucmVhZGRpcihkaXIpO1xuXHRcdGNvbnN0IHN1YmRpcnM6IFVSSVtdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IFtuYW1lLCBmaWxlVHlwZV0gb2YgZW50cmllcykge1xuXHRcdFx0aWYgKGZpbGVUeXBlID09PSBGaWxlVHlwZS5EaXJlY3RvcnkpIHtcblx0XHRcdFx0c3ViZGlycy5wdXNoKFVSSS5qb2luUGF0aChkaXIsIG5hbWUpKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChmaWxlVHlwZSA9PT0gRmlsZVR5cGUuRmlsZSkge1xuXHRcdFx0XHQvKipcblx0XHRcdFx0ICogTm90ZSB0aGF0IHNvbWV0aW1lcyB0aGUgZ2l2ZW4gYGZpbGVuYW1lYCBjb3VsZCBiZSBhIHJlbGF0aXZlXG5cdFx0XHRcdCAqIHBhdGggKG5vdCBqdXN0IHRoZSBcIm5hbWUuZXh0XCIgcGFydCkuIEZvciBleGFtcGxlLCB0aGVcblx0XHRcdFx0ICogYGZpbGVuYW1lYCBjYW4gYmUgXCIvc3ViZGlyL25hbWUuZXh0XCIuIFNvLCBqdXN0IGNvbXBhcmluZ1xuXHRcdFx0XHQgKiBgbmFtZWAgYXMgYGZpbGVuYW1lYCBpcyBub3Qgc3VmZmljaWVudC4gVGhlIHdvcmthcm91bmQgaGVyZVxuXHRcdFx0XHQgKiBpcyB0byBmb3JtIHRoZSBVUkkgd2l0aCBgZGlyYCBhbmQgYG5hbWVgIGFuZCBjaGVjayBpZiBpdCBlbmRzXG5cdFx0XHRcdCAqIHdpdGggdGhlIGdpdmVuIGBmaWxlbmFtZWAuXG5cdFx0XHRcdCAqL1xuXHRcdFx0XHRjb25zdCBmdWxsVXJpID0gVVJJLmpvaW5QYXRoKGRpciwgbmFtZSk7XG5cdFx0XHRcdGlmIChmdWxsVXJpLnBhdGguZW5kc1dpdGgoZmlsZW5hbWUpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZ1bGxVcmk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IHN1YmRpciBvZiBzdWJkaXJzKSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBzZWFyY2goc3ViZGlyKTtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGZvciAoY29uc3QgZGlyIG9mIGFzQXJyYXkoYXJncy5pbmNsdWRlIHx8IFtdKSkge1xuXHRcdGNvbnN0IGhpdCA9IGF3YWl0IHNlYXJjaChVUkkuZmlsZShkaXIpKTtcblx0XHRpZiAoaGl0KSB7XG5cdFx0XHRyZXR1cm4gaGl0O1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElMaW5lTWF0Y2hlciB7XG5cdG1hdGNoTGVuZ3RoOiBudW1iZXI7XG5cdG5leHQobGluZTogc3RyaW5nKTogSVByb2JsZW1NYXRjaCB8IG51bGw7XG5cdGhhbmRsZShsaW5lczogc3RyaW5nW10sIHN0YXJ0PzogbnVtYmVyKTogSUhhbmRsZVJlc3VsdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxpbmVNYXRjaGVyKG1hdGNoZXI6IFByb2JsZW1NYXRjaGVyLCBmaWxlU2VydmljZT86IElGaWxlU2VydmljZSk6IElMaW5lTWF0Y2hlciB7XG5cdGNvbnN0IHBhdHRlcm4gPSBtYXRjaGVyLnBhdHRlcm47XG5cdGlmIChBcnJheS5pc0FycmF5KHBhdHRlcm4pKSB7XG5cdFx0cmV0dXJuIG5ldyBNdWx0aUxpbmVNYXRjaGVyKG1hdGNoZXIsIGZpbGVTZXJ2aWNlKTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gbmV3IFNpbmdsZUxpbmVNYXRjaGVyKG1hdGNoZXIsIGZpbGVTZXJ2aWNlKTtcblx0fVxufVxuXG5jb25zdCBlbmRPZkxpbmU6IHN0cmluZyA9IFBsYXRmb3JtLk9TID09PSBQbGF0Zm9ybS5PcGVyYXRpbmdTeXN0ZW0uV2luZG93cyA/ICdcXHJcXG4nIDogJ1xcbic7XG5cbmFic3RyYWN0IGNsYXNzIEFic3RyYWN0TGluZU1hdGNoZXIgaW1wbGVtZW50cyBJTGluZU1hdGNoZXIge1xuXHRwcml2YXRlIG1hdGNoZXI6IFByb2JsZW1NYXRjaGVyO1xuXHRwcml2YXRlIGZpbGVTZXJ2aWNlPzogSUZpbGVTZXJ2aWNlO1xuXG5cdGNvbnN0cnVjdG9yKG1hdGNoZXI6IFByb2JsZW1NYXRjaGVyLCBmaWxlU2VydmljZT86IElGaWxlU2VydmljZSkge1xuXHRcdHRoaXMubWF0Y2hlciA9IG1hdGNoZXI7XG5cdFx0dGhpcy5maWxlU2VydmljZSA9IGZpbGVTZXJ2aWNlO1xuXHR9XG5cblx0cHVibGljIGhhbmRsZShsaW5lczogc3RyaW5nW10sIHN0YXJ0OiBudW1iZXIgPSAwKTogSUhhbmRsZVJlc3VsdCB7XG5cdFx0cmV0dXJuIHsgbWF0Y2g6IG51bGwsIGNvbnRpbnVlOiBmYWxzZSB9O1xuXHR9XG5cblx0cHVibGljIG5leHQobGluZTogc3RyaW5nKTogSVByb2JsZW1NYXRjaCB8IG51bGwge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHVibGljIGFic3RyYWN0IGdldCBtYXRjaExlbmd0aCgpOiBudW1iZXI7XG5cblx0cHJvdGVjdGVkIGZpbGxQcm9ibGVtRGF0YShkYXRhOiBJUHJvYmxlbURhdGEgfCB1bmRlZmluZWQsIHBhdHRlcm46IElQcm9ibGVtUGF0dGVybiwgbWF0Y2hlczogUmVnRXhwRXhlY0FycmF5KTogZGF0YSBpcyBJUHJvYmxlbURhdGEge1xuXHRcdGlmIChkYXRhKSB7XG5cdFx0XHR0aGlzLmZpbGxQcm9wZXJ0eShkYXRhLCAnZmlsZScsIHBhdHRlcm4sIG1hdGNoZXMsIHRydWUpO1xuXHRcdFx0dGhpcy5hcHBlbmRQcm9wZXJ0eShkYXRhLCAnbWVzc2FnZScsIHBhdHRlcm4sIG1hdGNoZXMsIHRydWUpO1xuXHRcdFx0dGhpcy5maWxsUHJvcGVydHkoZGF0YSwgJ2NvZGUnLCBwYXR0ZXJuLCBtYXRjaGVzLCB0cnVlKTtcblx0XHRcdHRoaXMuZmlsbFByb3BlcnR5KGRhdGEsICdzZXZlcml0eScsIHBhdHRlcm4sIG1hdGNoZXMsIHRydWUpO1xuXHRcdFx0dGhpcy5maWxsUHJvcGVydHkoZGF0YSwgJ2xvY2F0aW9uJywgcGF0dGVybiwgbWF0Y2hlcywgdHJ1ZSk7XG5cdFx0XHR0aGlzLmZpbGxQcm9wZXJ0eShkYXRhLCAnbGluZScsIHBhdHRlcm4sIG1hdGNoZXMpO1xuXHRcdFx0dGhpcy5maWxsUHJvcGVydHkoZGF0YSwgJ2NoYXJhY3RlcicsIHBhdHRlcm4sIG1hdGNoZXMpO1xuXHRcdFx0dGhpcy5maWxsUHJvcGVydHkoZGF0YSwgJ2VuZExpbmUnLCBwYXR0ZXJuLCBtYXRjaGVzKTtcblx0XHRcdHRoaXMuZmlsbFByb3BlcnR5KGRhdGEsICdlbmRDaGFyYWN0ZXInLCBwYXR0ZXJuLCBtYXRjaGVzKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhcHBlbmRQcm9wZXJ0eShkYXRhOiBJUHJvYmxlbURhdGEsIHByb3BlcnR5OiBrZXlvZiBJUHJvYmxlbURhdGEsIHBhdHRlcm46IElQcm9ibGVtUGF0dGVybiwgbWF0Y2hlczogUmVnRXhwRXhlY0FycmF5LCB0cmltOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRjb25zdCBwYXR0ZXJuUHJvcGVydHkgPSBwYXR0ZXJuW3Byb3BlcnR5XTtcblx0XHRpZiAoVHlwZXMuaXNVbmRlZmluZWQoZGF0YVtwcm9wZXJ0eV0pKSB7XG5cdFx0XHR0aGlzLmZpbGxQcm9wZXJ0eShkYXRhLCBwcm9wZXJ0eSwgcGF0dGVybiwgbWF0Y2hlcywgdHJpbSk7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKCFUeXBlcy5pc1VuZGVmaW5lZChwYXR0ZXJuUHJvcGVydHkpICYmIHBhdHRlcm5Qcm9wZXJ0eSA8IG1hdGNoZXMubGVuZ3RoKSB7XG5cdFx0XHRsZXQgdmFsdWUgPSBtYXRjaGVzW3BhdHRlcm5Qcm9wZXJ0eV07XG5cdFx0XHRpZiAodHJpbSkge1xuXHRcdFx0XHR2YWx1ZSA9IFN0cmluZ3MudHJpbSh2YWx1ZSkhO1xuXHRcdFx0fVxuXHRcdFx0KGRhdGEgYXMgYW55KVtwcm9wZXJ0eV0gKz0gZW5kT2ZMaW5lICsgdmFsdWU7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBmaWxsUHJvcGVydHkoZGF0YTogSVByb2JsZW1EYXRhLCBwcm9wZXJ0eToga2V5b2YgSVByb2JsZW1EYXRhLCBwYXR0ZXJuOiBJUHJvYmxlbVBhdHRlcm4sIG1hdGNoZXM6IFJlZ0V4cEV4ZWNBcnJheSwgdHJpbTogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XG5cdFx0Y29uc3QgcGF0dGVybkF0UHJvcGVydHkgPSBwYXR0ZXJuW3Byb3BlcnR5XTtcblx0XHRpZiAoVHlwZXMuaXNVbmRlZmluZWQoZGF0YVtwcm9wZXJ0eV0pICYmICFUeXBlcy5pc1VuZGVmaW5lZChwYXR0ZXJuQXRQcm9wZXJ0eSkgJiYgcGF0dGVybkF0UHJvcGVydHkgPCBtYXRjaGVzLmxlbmd0aCkge1xuXHRcdFx0bGV0IHZhbHVlID0gbWF0Y2hlc1twYXR0ZXJuQXRQcm9wZXJ0eV07XG5cdFx0XHRpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRpZiAodHJpbSkge1xuXHRcdFx0XHRcdHZhbHVlID0gU3RyaW5ncy50cmltKHZhbHVlKSE7XG5cdFx0XHRcdH1cblx0XHRcdFx0KGRhdGEgYXMgYW55KVtwcm9wZXJ0eV0gPSB2YWx1ZTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0TWFya2VyTWF0Y2goZGF0YTogSVByb2JsZW1EYXRhKTogSVByb2JsZW1NYXRjaCB8IHVuZGVmaW5lZCB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGxvY2F0aW9uID0gdGhpcy5nZXRMb2NhdGlvbihkYXRhKTtcblx0XHRcdGlmIChkYXRhLmZpbGUgJiYgbG9jYXRpb24gJiYgZGF0YS5tZXNzYWdlKSB7XG5cdFx0XHRcdGNvbnN0IG1hcmtlcjogSU1hcmtlckRhdGEgPSB7XG5cdFx0XHRcdFx0c2V2ZXJpdHk6IHRoaXMuZ2V0U2V2ZXJpdHkoZGF0YSksXG5cdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBsb2NhdGlvbi5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0c3RhcnRDb2x1bW46IGxvY2F0aW9uLnN0YXJ0Q2hhcmFjdGVyLFxuXHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IGxvY2F0aW9uLmVuZExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0ZW5kQ29sdW1uOiBsb2NhdGlvbi5lbmRDaGFyYWN0ZXIsXG5cdFx0XHRcdFx0bWVzc2FnZTogZGF0YS5tZXNzYWdlXG5cdFx0XHRcdH07XG5cdFx0XHRcdGlmIChkYXRhLmNvZGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdG1hcmtlci5jb2RlID0gZGF0YS5jb2RlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0aGlzLm1hdGNoZXIuc291cmNlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRtYXJrZXIuc291cmNlID0gdGhpcy5tYXRjaGVyLnNvdXJjZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiB0aGlzLm1hdGNoZXIsXG5cdFx0XHRcdFx0cmVzb3VyY2U6IHRoaXMuZ2V0UmVzb3VyY2UoZGF0YS5maWxlKSxcblx0XHRcdFx0XHRtYXJrZXI6IG1hcmtlclxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0Y29uc29sZS5lcnJvcihgRmFpbGVkIHRvIGNvbnZlcnQgcHJvYmxlbSBkYXRhIGludG8gbWF0Y2g6ICR7SlNPTi5zdHJpbmdpZnkoZGF0YSl9YCk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0UmVzb3VyY2UoZmlsZW5hbWU6IHN0cmluZyk6IFByb21pc2U8VVJJPiB7XG5cdFx0cmV0dXJuIGdldFJlc291cmNlKGZpbGVuYW1lLCB0aGlzLm1hdGNoZXIsIHRoaXMuZmlsZVNlcnZpY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRMb2NhdGlvbihkYXRhOiBJUHJvYmxlbURhdGEpOiBJTG9jYXRpb24gfCBudWxsIHtcblx0XHRpZiAoZGF0YS5raW5kID09PSBQcm9ibGVtTG9jYXRpb25LaW5kLkZpbGUpIHtcblx0XHRcdHJldHVybiB0aGlzLmNyZWF0ZUxvY2F0aW9uKDAsIDAsIDAsIDApO1xuXHRcdH1cblx0XHRpZiAoZGF0YS5sb2NhdGlvbikge1xuXHRcdFx0cmV0dXJuIHRoaXMucGFyc2VMb2NhdGlvbkluZm8oZGF0YS5sb2NhdGlvbik7XG5cdFx0fVxuXHRcdGlmICghZGF0YS5saW5lKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0Y29uc3Qgc3RhcnRMaW5lID0gcGFyc2VJbnQoZGF0YS5saW5lKTtcblx0XHRjb25zdCBzdGFydENvbHVtbiA9IGRhdGEuY2hhcmFjdGVyID8gcGFyc2VJbnQoZGF0YS5jaGFyYWN0ZXIpIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGVuZExpbmUgPSBkYXRhLmVuZExpbmUgPyBwYXJzZUludChkYXRhLmVuZExpbmUpIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGVuZENvbHVtbiA9IGRhdGEuZW5kQ2hhcmFjdGVyID8gcGFyc2VJbnQoZGF0YS5lbmRDaGFyYWN0ZXIpIDogdW5kZWZpbmVkO1xuXHRcdHJldHVybiB0aGlzLmNyZWF0ZUxvY2F0aW9uKHN0YXJ0TGluZSwgc3RhcnRDb2x1bW4sIGVuZExpbmUsIGVuZENvbHVtbik7XG5cdH1cblxuXHRwcml2YXRlIHBhcnNlTG9jYXRpb25JbmZvKHZhbHVlOiBzdHJpbmcpOiBJTG9jYXRpb24gfCBudWxsIHtcblx0XHRpZiAoIXZhbHVlIHx8ICF2YWx1ZS5tYXRjaCgvKFxcZCt8XFxkKyxcXGQrfFxcZCssXFxkKyxcXGQrLFxcZCspLykpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCBwYXJ0cyA9IHZhbHVlLnNwbGl0KCcsJyk7XG5cdFx0Y29uc3Qgc3RhcnRMaW5lID0gcGFyc2VJbnQocGFydHNbMF0pO1xuXHRcdGNvbnN0IHN0YXJ0Q29sdW1uID0gcGFydHMubGVuZ3RoID4gMSA/IHBhcnNlSW50KHBhcnRzWzFdKSA6IHVuZGVmaW5lZDtcblx0XHRpZiAocGFydHMubGVuZ3RoID4gMykge1xuXHRcdFx0cmV0dXJuIHRoaXMuY3JlYXRlTG9jYXRpb24oc3RhcnRMaW5lLCBzdGFydENvbHVtbiwgcGFyc2VJbnQocGFydHNbMl0pLCBwYXJzZUludChwYXJ0c1szXSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jcmVhdGVMb2NhdGlvbihzdGFydExpbmUsIHN0YXJ0Q29sdW1uLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVMb2NhdGlvbihzdGFydExpbmU6IG51bWJlciwgc3RhcnRDb2x1bW46IG51bWJlciB8IHVuZGVmaW5lZCwgZW5kTGluZTogbnVtYmVyIHwgdW5kZWZpbmVkLCBlbmRDb2x1bW46IG51bWJlciB8IHVuZGVmaW5lZCk6IElMb2NhdGlvbiB7XG5cdFx0aWYgKHN0YXJ0Q29sdW1uICE9PSB1bmRlZmluZWQgJiYgZW5kQ29sdW1uICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiB7IHN0YXJ0TGluZU51bWJlcjogc3RhcnRMaW5lLCBzdGFydENoYXJhY3Rlcjogc3RhcnRDb2x1bW4sIGVuZExpbmVOdW1iZXI6IGVuZExpbmUgfHwgc3RhcnRMaW5lLCBlbmRDaGFyYWN0ZXI6IGVuZENvbHVtbiB9O1xuXHRcdH1cblx0XHRpZiAoc3RhcnRDb2x1bW4gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIHsgc3RhcnRMaW5lTnVtYmVyOiBzdGFydExpbmUsIHN0YXJ0Q2hhcmFjdGVyOiBzdGFydENvbHVtbiwgZW5kTGluZU51bWJlcjogc3RhcnRMaW5lLCBlbmRDaGFyYWN0ZXI6IHN0YXJ0Q29sdW1uIH07XG5cdFx0fVxuXHRcdHJldHVybiB7IHN0YXJ0TGluZU51bWJlcjogc3RhcnRMaW5lLCBzdGFydENoYXJhY3RlcjogMSwgZW5kTGluZU51bWJlcjogc3RhcnRMaW5lLCBlbmRDaGFyYWN0ZXI6IDIgKiogMzEgLSAxIH07IC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvODAyODgjaXNzdWVjb21tZW50LTY1MDYzNjQ0MiBmb3IgZGlzY3Vzc2lvblxuXHR9XG5cblx0cHJpdmF0ZSBnZXRTZXZlcml0eShkYXRhOiBJUHJvYmxlbURhdGEpOiBNYXJrZXJTZXZlcml0eSB7XG5cdFx0bGV0IHJlc3VsdDogU2V2ZXJpdHkgfCBudWxsID0gbnVsbDtcblx0XHRpZiAoZGF0YS5zZXZlcml0eSkge1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBkYXRhLnNldmVyaXR5O1xuXHRcdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRcdHJlc3VsdCA9IFNldmVyaXR5LmZyb21WYWx1ZSh2YWx1ZSk7XG5cdFx0XHRcdGlmIChyZXN1bHQgPT09IFNldmVyaXR5Lklnbm9yZSkge1xuXHRcdFx0XHRcdGlmICh2YWx1ZSA9PT0gJ0UnKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQgPSBTZXZlcml0eS5FcnJvcjtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHZhbHVlID09PSAnVycpIHtcblx0XHRcdFx0XHRcdHJlc3VsdCA9IFNldmVyaXR5Lldhcm5pbmc7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICh2YWx1ZSA9PT0gJ0knKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQgPSBTZXZlcml0eS5JbmZvO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoU3RyaW5ncy5lcXVhbHNJZ25vcmVDYXNlKHZhbHVlLCAnaGludCcpKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQgPSBTZXZlcml0eS5JbmZvO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoU3RyaW5ncy5lcXVhbHNJZ25vcmVDYXNlKHZhbHVlLCAnbm90ZScpKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQgPSBTZXZlcml0eS5JbmZvO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAocmVzdWx0ID09PSBudWxsIHx8IHJlc3VsdCA9PT0gU2V2ZXJpdHkuSWdub3JlKSB7XG5cdFx0XHRyZXN1bHQgPSB0aGlzLm1hdGNoZXIuc2V2ZXJpdHkgfHwgU2V2ZXJpdHkuRXJyb3I7XG5cdFx0fVxuXHRcdHJldHVybiBNYXJrZXJTZXZlcml0eS5mcm9tU2V2ZXJpdHkocmVzdWx0KTtcblx0fVxufVxuXG5jbGFzcyBTaW5nbGVMaW5lTWF0Y2hlciBleHRlbmRzIEFic3RyYWN0TGluZU1hdGNoZXIge1xuXG5cdHByaXZhdGUgcGF0dGVybjogSVByb2JsZW1QYXR0ZXJuO1xuXG5cdGNvbnN0cnVjdG9yKG1hdGNoZXI6IFByb2JsZW1NYXRjaGVyLCBmaWxlU2VydmljZT86IElGaWxlU2VydmljZSkge1xuXHRcdHN1cGVyKG1hdGNoZXIsIGZpbGVTZXJ2aWNlKTtcblx0XHR0aGlzLnBhdHRlcm4gPSA8SVByb2JsZW1QYXR0ZXJuPm1hdGNoZXIucGF0dGVybjtcblx0fVxuXG5cdHB1YmxpYyBnZXQgbWF0Y2hMZW5ndGgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gMTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBoYW5kbGUobGluZXM6IHN0cmluZ1tdLCBzdGFydDogbnVtYmVyID0gMCk6IElIYW5kbGVSZXN1bHQge1xuXHRcdEFzc2VydC5vayhsaW5lcy5sZW5ndGggLSBzdGFydCA9PT0gMSk7XG5cdFx0Y29uc3QgZGF0YTogSVByb2JsZW1EYXRhID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRpZiAodGhpcy5wYXR0ZXJuLmtpbmQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0ZGF0YS5raW5kID0gdGhpcy5wYXR0ZXJuLmtpbmQ7XG5cdFx0fVxuXHRcdGNvbnN0IG1hdGNoZXMgPSB0aGlzLnBhdHRlcm4ucmVnZXhwLmV4ZWMobGluZXNbc3RhcnRdKTtcblx0XHRpZiAobWF0Y2hlcykge1xuXHRcdFx0dGhpcy5maWxsUHJvYmxlbURhdGEoZGF0YSwgdGhpcy5wYXR0ZXJuLCBtYXRjaGVzKTtcblx0XHRcdGNvbnN0IG1hdGNoID0gdGhpcy5nZXRNYXJrZXJNYXRjaChkYXRhKTtcblx0XHRcdGlmIChtYXRjaCkge1xuXHRcdFx0XHRyZXR1cm4geyBtYXRjaDogbWF0Y2gsIGNvbnRpbnVlOiBmYWxzZSB9O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4geyBtYXRjaDogbnVsbCwgY29udGludWU6IGZhbHNlIH07XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgbmV4dChsaW5lOiBzdHJpbmcpOiBJUHJvYmxlbU1hdGNoIHwgbnVsbCB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cbn1cblxuY2xhc3MgTXVsdGlMaW5lTWF0Y2hlciBleHRlbmRzIEFic3RyYWN0TGluZU1hdGNoZXIge1xuXG5cdHByaXZhdGUgcGF0dGVybnM6IElQcm9ibGVtUGF0dGVybltdO1xuXHRwcml2YXRlIGRhdGE6IElQcm9ibGVtRGF0YSB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3RvcihtYXRjaGVyOiBQcm9ibGVtTWF0Y2hlciwgZmlsZVNlcnZpY2U/OiBJRmlsZVNlcnZpY2UpIHtcblx0XHRzdXBlcihtYXRjaGVyLCBmaWxlU2VydmljZSk7XG5cdFx0dGhpcy5wYXR0ZXJucyA9IDxJUHJvYmxlbVBhdHRlcm5bXT5tYXRjaGVyLnBhdHRlcm47XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG1hdGNoTGVuZ3RoKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMucGF0dGVybnMubGVuZ3RoO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGhhbmRsZShsaW5lczogc3RyaW5nW10sIHN0YXJ0OiBudW1iZXIgPSAwKTogSUhhbmRsZVJlc3VsdCB7XG5cdFx0QXNzZXJ0Lm9rKGxpbmVzLmxlbmd0aCAtIHN0YXJ0ID09PSB0aGlzLnBhdHRlcm5zLmxlbmd0aCk7XG5cdFx0dGhpcy5kYXRhID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRsZXQgZGF0YSA9IHRoaXMuZGF0YSE7XG5cdFx0ZGF0YS5raW5kID0gdGhpcy5wYXR0ZXJuc1swXS5raW5kO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wYXR0ZXJucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgcGF0dGVybiA9IHRoaXMucGF0dGVybnNbaV07XG5cdFx0XHRjb25zdCBtYXRjaGVzID0gcGF0dGVybi5yZWdleHAuZXhlYyhsaW5lc1tpICsgc3RhcnRdKTtcblx0XHRcdGlmICghbWF0Y2hlcykge1xuXHRcdFx0XHRyZXR1cm4geyBtYXRjaDogbnVsbCwgY29udGludWU6IGZhbHNlIH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBPbmx5IHRoZSBsYXN0IHBhdHRlcm4gY2FuIGxvb3Bcblx0XHRcdFx0aWYgKHBhdHRlcm4ubG9vcCAmJiBpID09PSB0aGlzLnBhdHRlcm5zLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0XHRkYXRhID0gT2JqZWN0cy5kZWVwQ2xvbmUoZGF0YSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5maWxsUHJvYmxlbURhdGEoZGF0YSwgcGF0dGVybiwgbWF0Y2hlcyk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IGxvb3AgPSAhIXRoaXMucGF0dGVybnNbdGhpcy5wYXR0ZXJucy5sZW5ndGggLSAxXS5sb29wO1xuXHRcdGlmICghbG9vcCkge1xuXHRcdFx0dGhpcy5kYXRhID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBtYXJrZXJNYXRjaCA9IGRhdGEgPyB0aGlzLmdldE1hcmtlck1hdGNoKGRhdGEpIDogbnVsbDtcblx0XHRyZXR1cm4geyBtYXRjaDogbWFya2VyTWF0Y2ggPyBtYXJrZXJNYXRjaCA6IG51bGwsIGNvbnRpbnVlOiBsb29wIH07XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgbmV4dChsaW5lOiBzdHJpbmcpOiBJUHJvYmxlbU1hdGNoIHwgbnVsbCB7XG5cdFx0Y29uc3QgcGF0dGVybiA9IHRoaXMucGF0dGVybnNbdGhpcy5wYXR0ZXJucy5sZW5ndGggLSAxXTtcblx0XHRBc3NlcnQub2socGF0dGVybi5sb29wID09PSB0cnVlICYmIHRoaXMuZGF0YSAhPT0gbnVsbCk7XG5cdFx0Y29uc3QgbWF0Y2hlcyA9IHBhdHRlcm4ucmVnZXhwLmV4ZWMobGluZSk7XG5cdFx0aWYgKCFtYXRjaGVzKSB7XG5cdFx0XHR0aGlzLmRhdGEgPSB1bmRlZmluZWQ7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0Y29uc3QgZGF0YSA9IE9iamVjdHMuZGVlcENsb25lKHRoaXMuZGF0YSk7XG5cdFx0bGV0IHByb2JsZW1NYXRjaDogSVByb2JsZW1NYXRjaCB8IHVuZGVmaW5lZDtcblx0XHRpZiAodGhpcy5maWxsUHJvYmxlbURhdGEoZGF0YSwgcGF0dGVybiwgbWF0Y2hlcykpIHtcblx0XHRcdHByb2JsZW1NYXRjaCA9IHRoaXMuZ2V0TWFya2VyTWF0Y2goZGF0YSk7XG5cdFx0fVxuXHRcdHJldHVybiBwcm9ibGVtTWF0Y2ggPyBwcm9ibGVtTWF0Y2ggOiBudWxsO1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgQ29uZmlnIHtcblxuXHRleHBvcnQgaW50ZXJmYWNlIElQcm9ibGVtUGF0dGVybiB7XG5cblx0XHQvKipcblx0XHQqIFRoZSByZWd1bGFyIGV4cHJlc3Npb24gdG8gZmluZCBhIHByb2JsZW0gaW4gdGhlIGNvbnNvbGUgb3V0cHV0IG9mIGFuXG5cdFx0KiBleGVjdXRlZCB0YXNrLlxuXHRcdCovXG5cdFx0cmVnZXhwPzogc3RyaW5nO1xuXG5cdFx0LyoqXG5cdFx0KiBXaGV0aGVyIHRoZSBwYXR0ZXJuIG1hdGNoZXMgYSB3aG9sZSBmaWxlLCBvciBhIGxvY2F0aW9uIChmaWxlL2xpbmUpXG5cdFx0KlxuXHRcdCogVGhlIGRlZmF1bHQgaXMgdG8gbWF0Y2ggZm9yIGEgbG9jYXRpb24uIE9ubHkgdmFsaWQgb24gdGhlXG5cdFx0KiBmaXJzdCBwcm9ibGVtIHBhdHRlcm4gaW4gYSBtdWx0aSBsaW5lIHByb2JsZW0gbWF0Y2hlci5cblx0XHQqL1xuXHRcdGtpbmQ/OiBzdHJpbmc7XG5cblx0XHQvKipcblx0XHQqIFRoZSBtYXRjaCBncm91cCBpbmRleCBvZiB0aGUgZmlsZW5hbWUuXG5cdFx0KiBJZiBvbWl0dGVkIDEgaXMgdXNlZC5cblx0XHQqL1xuXHRcdGZpbGU/OiBudW1iZXI7XG5cblx0XHQvKipcblx0XHQqIFRoZSBtYXRjaCBncm91cCBpbmRleCBvZiB0aGUgcHJvYmxlbSdzIGxvY2F0aW9uLiBWYWxpZCBsb2NhdGlvblxuXHRcdCogcGF0dGVybnMgYXJlOiAobGluZSksIChsaW5lLGNvbHVtbikgYW5kIChzdGFydExpbmUsc3RhcnRDb2x1bW4sZW5kTGluZSxlbmRDb2x1bW4pLlxuXHRcdCogSWYgb21pdHRlZCB0aGUgbGluZSBhbmQgY29sdW1uIHByb3BlcnRpZXMgYXJlIHVzZWQuXG5cdFx0Ki9cblx0XHRsb2NhdGlvbj86IG51bWJlcjtcblxuXHRcdC8qKlxuXHRcdCogVGhlIG1hdGNoIGdyb3VwIGluZGV4IG9mIHRoZSBwcm9ibGVtJ3MgbGluZSBpbiB0aGUgc291cmNlIGZpbGUuXG5cdFx0KlxuXHRcdCogRGVmYXVsdHMgdG8gMi5cblx0XHQqL1xuXHRcdGxpbmU/OiBudW1iZXI7XG5cblx0XHQvKipcblx0XHQqIFRoZSBtYXRjaCBncm91cCBpbmRleCBvZiB0aGUgcHJvYmxlbSdzIGNvbHVtbiBpbiB0aGUgc291cmNlIGZpbGUuXG5cdFx0KlxuXHRcdCogRGVmYXVsdHMgdG8gMy5cblx0XHQqL1xuXHRcdGNvbHVtbj86IG51bWJlcjtcblxuXHRcdC8qKlxuXHRcdCogVGhlIG1hdGNoIGdyb3VwIGluZGV4IG9mIHRoZSBwcm9ibGVtJ3MgZW5kIGxpbmUgaW4gdGhlIHNvdXJjZSBmaWxlLlxuXHRcdCpcblx0XHQqIERlZmF1bHRzIHRvIHVuZGVmaW5lZC4gTm8gZW5kIGxpbmUgaXMgY2FwdHVyZWQuXG5cdFx0Ki9cblx0XHRlbmRMaW5lPzogbnVtYmVyO1xuXG5cdFx0LyoqXG5cdFx0KiBUaGUgbWF0Y2ggZ3JvdXAgaW5kZXggb2YgdGhlIHByb2JsZW0ncyBlbmQgY29sdW1uIGluIHRoZSBzb3VyY2UgZmlsZS5cblx0XHQqXG5cdFx0KiBEZWZhdWx0cyB0byB1bmRlZmluZWQuIE5vIGVuZCBjb2x1bW4gaXMgY2FwdHVyZWQuXG5cdFx0Ki9cblx0XHRlbmRDb2x1bW4/OiBudW1iZXI7XG5cblx0XHQvKipcblx0XHQqIFRoZSBtYXRjaCBncm91cCBpbmRleCBvZiB0aGUgcHJvYmxlbSdzIHNldmVyaXR5LlxuXHRcdCpcblx0XHQqIERlZmF1bHRzIHRvIHVuZGVmaW5lZC4gSW4gdGhpcyBjYXNlIHRoZSBwcm9ibGVtIG1hdGNoZXIncyBzZXZlcml0eVxuXHRcdCogaXMgdXNlZC5cblx0XHQqL1xuXHRcdHNldmVyaXR5PzogbnVtYmVyO1xuXG5cdFx0LyoqXG5cdFx0KiBUaGUgbWF0Y2ggZ3JvdXAgaW5kZXggb2YgdGhlIHByb2JsZW0ncyBjb2RlLlxuXHRcdCpcblx0XHQqIERlZmF1bHRzIHRvIHVuZGVmaW5lZC4gTm8gY29kZSBpcyBjYXB0dXJlZC5cblx0XHQqL1xuXHRcdGNvZGU/OiBudW1iZXI7XG5cblx0XHQvKipcblx0XHQqIFRoZSBtYXRjaCBncm91cCBpbmRleCBvZiB0aGUgbWVzc2FnZS4gSWYgb21pdHRlZCBpdCBkZWZhdWx0c1xuXHRcdCogdG8gNCBpZiBsb2NhdGlvbiBpcyBzcGVjaWZpZWQuIE90aGVyd2lzZSBpdCBkZWZhdWx0cyB0byA1LlxuXHRcdCovXG5cdFx0bWVzc2FnZT86IG51bWJlcjtcblxuXHRcdC8qKlxuXHRcdCogU3BlY2lmaWVzIGlmIHRoZSBsYXN0IHBhdHRlcm4gaW4gYSBtdWx0aSBsaW5lIHByb2JsZW0gbWF0Y2hlciBzaG91bGRcblx0XHQqIGxvb3AgYXMgbG9uZyBhcyBpdCBkb2VzIG1hdGNoIGEgbGluZSBjb25zZXF1ZW50bHkuIE9ubHkgdmFsaWQgb24gdGhlXG5cdFx0KiBsYXN0IHByb2JsZW0gcGF0dGVybiBpbiBhIG11bHRpIGxpbmUgcHJvYmxlbSBtYXRjaGVyLlxuXHRcdCovXG5cdFx0bG9vcD86IGJvb2xlYW47XG5cdH1cblxuXHRleHBvcnQgaW50ZXJmYWNlIElDaGVja2VkUHJvYmxlbVBhdHRlcm4gZXh0ZW5kcyBJUHJvYmxlbVBhdHRlcm4ge1xuXHRcdC8qKlxuXHRcdCogVGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiB0byBmaW5kIGEgcHJvYmxlbSBpbiB0aGUgY29uc29sZSBvdXRwdXQgb2YgYW5cblx0XHQqIGV4ZWN1dGVkIHRhc2suXG5cdFx0Ki9cblx0XHRyZWdleHA6IHN0cmluZztcblx0fVxuXG5cdGV4cG9ydCBuYW1lc3BhY2UgQ2hlY2tlZFByb2JsZW1QYXR0ZXJuIHtcblx0XHRleHBvcnQgZnVuY3Rpb24gaXModmFsdWU6IGFueSk6IHZhbHVlIGlzIElDaGVja2VkUHJvYmxlbVBhdHRlcm4ge1xuXHRcdFx0Y29uc3QgY2FuZGlkYXRlOiBJUHJvYmxlbVBhdHRlcm4gPSB2YWx1ZSBhcyBJUHJvYmxlbVBhdHRlcm47XG5cdFx0XHRyZXR1cm4gY2FuZGlkYXRlICYmIFR5cGVzLmlzU3RyaW5nKGNhbmRpZGF0ZS5yZWdleHApO1xuXHRcdH1cblx0fVxuXG5cdGV4cG9ydCBpbnRlcmZhY2UgSU5hbWVkUHJvYmxlbVBhdHRlcm4gZXh0ZW5kcyBJUHJvYmxlbVBhdHRlcm4ge1xuXHRcdC8qKlxuXHRcdCAqIFRoZSBuYW1lIG9mIHRoZSBwcm9ibGVtIHBhdHRlcm4uXG5cdFx0ICovXG5cdFx0bmFtZTogc3RyaW5nO1xuXG5cdFx0LyoqXG5cdFx0ICogQSBodW1hbiByZWFkYWJsZSBsYWJlbFxuXHRcdCAqL1xuXHRcdGxhYmVsPzogc3RyaW5nO1xuXHR9XG5cblx0ZXhwb3J0IG5hbWVzcGFjZSBOYW1lZFByb2JsZW1QYXR0ZXJuIHtcblx0XHRleHBvcnQgZnVuY3Rpb24gaXModmFsdWU6IGFueSk6IHZhbHVlIGlzIElOYW1lZFByb2JsZW1QYXR0ZXJuIHtcblx0XHRcdGNvbnN0IGNhbmRpZGF0ZTogSU5hbWVkUHJvYmxlbVBhdHRlcm4gPSB2YWx1ZSBhcyBJTmFtZWRQcm9ibGVtUGF0dGVybjtcblx0XHRcdHJldHVybiBjYW5kaWRhdGUgJiYgVHlwZXMuaXNTdHJpbmcoY2FuZGlkYXRlLm5hbWUpO1xuXHRcdH1cblx0fVxuXG5cdGV4cG9ydCBpbnRlcmZhY2UgSU5hbWVkQ2hlY2tlZFByb2JsZW1QYXR0ZXJuIGV4dGVuZHMgSU5hbWVkUHJvYmxlbVBhdHRlcm4ge1xuXHRcdC8qKlxuXHRcdCogVGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiB0byBmaW5kIGEgcHJvYmxlbSBpbiB0aGUgY29uc29sZSBvdXRwdXQgb2YgYW5cblx0XHQqIGV4ZWN1dGVkIHRhc2suXG5cdFx0Ki9cblx0XHRyZWdleHA6IHN0cmluZztcblx0fVxuXG5cdGV4cG9ydCBuYW1lc3BhY2UgTmFtZWRDaGVja2VkUHJvYmxlbVBhdHRlcm4ge1xuXHRcdGV4cG9ydCBmdW5jdGlvbiBpcyh2YWx1ZTogYW55KTogdmFsdWUgaXMgSU5hbWVkQ2hlY2tlZFByb2JsZW1QYXR0ZXJuIHtcblx0XHRcdGNvbnN0IGNhbmRpZGF0ZTogSU5hbWVkUHJvYmxlbVBhdHRlcm4gPSB2YWx1ZSBhcyBJTmFtZWRQcm9ibGVtUGF0dGVybjtcblx0XHRcdHJldHVybiBjYW5kaWRhdGUgJiYgTmFtZWRQcm9ibGVtUGF0dGVybi5pcyhjYW5kaWRhdGUpICYmIFR5cGVzLmlzU3RyaW5nKGNhbmRpZGF0ZS5yZWdleHApO1xuXHRcdH1cblx0fVxuXG5cdGV4cG9ydCB0eXBlIE11bHRpTGluZVByb2JsZW1QYXR0ZXJuID0gSVByb2JsZW1QYXR0ZXJuW107XG5cblx0ZXhwb3J0IG5hbWVzcGFjZSBNdWx0aUxpbmVQcm9ibGVtUGF0dGVybiB7XG5cdFx0ZXhwb3J0IGZ1bmN0aW9uIGlzKHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBNdWx0aUxpbmVQcm9ibGVtUGF0dGVybiB7XG5cdFx0XHRyZXR1cm4gdmFsdWUgJiYgQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG5cdFx0fVxuXHR9XG5cblx0ZXhwb3J0IHR5cGUgTXVsdGlMaW5lQ2hlY2tlZFByb2JsZW1QYXR0ZXJuID0gSUNoZWNrZWRQcm9ibGVtUGF0dGVybltdO1xuXG5cdGV4cG9ydCBuYW1lc3BhY2UgTXVsdGlMaW5lQ2hlY2tlZFByb2JsZW1QYXR0ZXJuIHtcblx0XHRleHBvcnQgZnVuY3Rpb24gaXModmFsdWU6IGFueSk6IHZhbHVlIGlzIE11bHRpTGluZUNoZWNrZWRQcm9ibGVtUGF0dGVybiB7XG5cdFx0XHRpZiAoIU11bHRpTGluZVByb2JsZW1QYXR0ZXJuLmlzKHZhbHVlKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IGVsZW1lbnQgb2YgdmFsdWUpIHtcblx0XHRcdFx0aWYgKCFDb25maWcuQ2hlY2tlZFByb2JsZW1QYXR0ZXJuLmlzKGVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRleHBvcnQgaW50ZXJmYWNlIElOYW1lZE11bHRpTGluZUNoZWNrZWRQcm9ibGVtUGF0dGVybiB7XG5cdFx0LyoqXG5cdFx0ICogVGhlIG5hbWUgb2YgdGhlIHByb2JsZW0gcGF0dGVybi5cblx0XHQgKi9cblx0XHRuYW1lOiBzdHJpbmc7XG5cblx0XHQvKipcblx0XHQgKiBBIGh1bWFuIHJlYWRhYmxlIGxhYmVsXG5cdFx0ICovXG5cdFx0bGFiZWw/OiBzdHJpbmc7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgYWN0dWFsIHBhdHRlcm5zXG5cdFx0ICovXG5cdFx0cGF0dGVybnM6IE11bHRpTGluZUNoZWNrZWRQcm9ibGVtUGF0dGVybjtcblx0fVxuXG5cdGV4cG9ydCBuYW1lc3BhY2UgTmFtZWRNdWx0aUxpbmVDaGVja2VkUHJvYmxlbVBhdHRlcm4ge1xuXHRcdGV4cG9ydCBmdW5jdGlvbiBpcyh2YWx1ZTogYW55KTogdmFsdWUgaXMgSU5hbWVkTXVsdGlMaW5lQ2hlY2tlZFByb2JsZW1QYXR0ZXJuIHtcblx0XHRcdGNvbnN0IGNhbmRpZGF0ZSA9IHZhbHVlIGFzIElOYW1lZE11bHRpTGluZUNoZWNrZWRQcm9ibGVtUGF0dGVybjtcblx0XHRcdHJldHVybiBjYW5kaWRhdGUgJiYgVHlwZXMuaXNTdHJpbmcoY2FuZGlkYXRlLm5hbWUpICYmIEFycmF5LmlzQXJyYXkoY2FuZGlkYXRlLnBhdHRlcm5zKSAmJiBNdWx0aUxpbmVDaGVja2VkUHJvYmxlbVBhdHRlcm4uaXMoY2FuZGlkYXRlLnBhdHRlcm5zKTtcblx0XHR9XG5cdH1cblxuXHRleHBvcnQgdHlwZSBOYW1lZFByb2JsZW1QYXR0ZXJucyA9IChDb25maWcuSU5hbWVkUHJvYmxlbVBhdHRlcm4gfCBDb25maWcuSU5hbWVkTXVsdGlMaW5lQ2hlY2tlZFByb2JsZW1QYXR0ZXJuKVtdO1xuXG5cdC8qKlxuXHQqIEEgd2F0Y2hpbmcgcGF0dGVyblxuXHQqL1xuXHRleHBvcnQgaW50ZXJmYWNlIElXYXRjaGluZ1BhdHRlcm4ge1xuXHRcdC8qKlxuXHRcdCogVGhlIGFjdHVhbCByZWd1bGFyIGV4cHJlc3Npb25cblx0XHQqL1xuXHRcdHJlZ2V4cD86IHN0cmluZztcblxuXHRcdC8qKlxuXHRcdCogVGhlIG1hdGNoIGdyb3VwIGluZGV4IG9mIHRoZSBmaWxlbmFtZS4gSWYgcHJvdmlkZWQgdGhlIGV4cHJlc3Npb25cblx0XHQqIGlzIG1hdGNoZWQgZm9yIHRoYXQgZmlsZSBvbmx5LlxuXHRcdCovXG5cdFx0ZmlsZT86IG51bWJlcjtcblx0fVxuXG5cdC8qKlxuXHQqIEEgZGVzY3JpcHRpb24gdG8gdHJhY2sgdGhlIHN0YXJ0IGFuZCBlbmQgb2YgYSB3YXRjaGluZyB0YXNrLlxuXHQqL1xuXHRleHBvcnQgaW50ZXJmYWNlIElCYWNrZ3JvdW5kTW9uaXRvciB7XG5cblx0XHQvKipcblx0XHQqIElmIHNldCB0byB0cnVlIHRoZSB3YXRjaGVyIHN0YXJ0cyBpbiBhY3RpdmUgbW9kZS4gVGhpcyBpcyB0aGVcblx0XHQqIHNhbWUgYXMgb3V0cHV0dGluZyBhIGxpbmUgdGhhdCBtYXRjaGVzIGJlZ2luc1BhdHRlcm4gd2hlbiB0aGVcblx0XHQqIHRhc2sgc3RhcnRzLlxuXHRcdCovXG5cdFx0YWN0aXZlT25TdGFydD86IGJvb2xlYW47XG5cblx0XHQvKipcblx0XHQqIElmIG1hdGNoZWQgaW4gdGhlIG91dHB1dCB0aGUgc3RhcnQgb2YgYSB3YXRjaGluZyB0YXNrIGlzIHNpZ25hbGVkLlxuXHRcdCovXG5cdFx0YmVnaW5zUGF0dGVybj86IHN0cmluZyB8IElXYXRjaGluZ1BhdHRlcm47XG5cblx0XHQvKipcblx0XHQqIElmIG1hdGNoZWQgaW4gdGhlIG91dHB1dCB0aGUgZW5kIG9mIGEgd2F0Y2hpbmcgdGFzayBpcyBzaWduYWxlZC5cblx0XHQqL1xuXHRcdGVuZHNQYXR0ZXJuPzogc3RyaW5nIHwgSVdhdGNoaW5nUGF0dGVybjtcblx0fVxuXG5cdC8qKlxuXHQqIEEgZGVzY3JpcHRpb24gb2YgYSBwcm9ibGVtIG1hdGNoZXIgdGhhdCBkZXRlY3RzIHByb2JsZW1zXG5cdCogaW4gYnVpbGQgb3V0cHV0LlxuXHQqL1xuXHRleHBvcnQgaW50ZXJmYWNlIFByb2JsZW1NYXRjaGVyIHtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBuYW1lIG9mIGEgYmFzZSBwcm9ibGVtIG1hdGNoZXIgdG8gdXNlLiBJZiBzcGVjaWZpZWQgdGhlXG5cdFx0ICogYmFzZSBwcm9ibGVtIG1hdGNoZXIgd2lsbCBiZSB1c2VkIGFzIGEgdGVtcGxhdGUgYW5kIHByb3BlcnRpZXNcblx0XHQgKiBzcGVjaWZpZWQgaGVyZSB3aWxsIHJlcGxhY2UgcHJvcGVydGllcyBvZiB0aGUgYmFzZSBwcm9ibGVtXG5cdFx0ICogbWF0Y2hlclxuXHRcdCAqL1xuXHRcdGJhc2U/OiBzdHJpbmc7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgb3duZXIgb2YgdGhlIHByb2R1Y2VkIFZTQ29kZSBwcm9ibGVtLiBUaGlzIGlzIHR5cGljYWxseVxuXHRcdCAqIHRoZSBpZGVudGlmaWVyIG9mIGEgVlNDb2RlIGxhbmd1YWdlIHNlcnZpY2UgaWYgdGhlIHByb2JsZW1zIGFyZVxuXHRcdCAqIHRvIGJlIG1lcmdlZCB3aXRoIHRoZSBvbmUgcHJvZHVjZWQgYnkgdGhlIGxhbmd1YWdlIHNlcnZpY2Vcblx0XHQgKiBvciBhIGdlbmVyYXRlZCBpbnRlcm5hbCBpZC4gRGVmYXVsdHMgdG8gdGhlIGdlbmVyYXRlZCBpbnRlcm5hbCBpZC5cblx0XHQgKi9cblx0XHRvd25lcj86IHN0cmluZztcblxuXHRcdC8qKlxuXHRcdCAqIEEgaHVtYW4tcmVhZGFibGUgc3RyaW5nIGRlc2NyaWJpbmcgdGhlIHNvdXJjZSBvZiB0aGlzIHByb2JsZW0uXG5cdFx0ICogRS5nLiAndHlwZXNjcmlwdCcgb3IgJ3N1cGVyIGxpbnQnLlxuXHRcdCAqL1xuXHRcdHNvdXJjZT86IHN0cmluZztcblxuXHRcdC8qKlxuXHRcdCogU3BlY2lmaWVzIHRvIHdoaWNoIGtpbmQgb2YgZG9jdW1lbnRzIHRoZSBwcm9ibGVtcyBmb3VuZCBieSB0aGlzXG5cdFx0KiBtYXRjaGVyIGFyZSBhcHBsaWVkLiBWYWxpZCB2YWx1ZXMgYXJlOlxuXHRcdCpcblx0XHQqICAgXCJhbGxEb2N1bWVudHNcIjogcHJvYmxlbXMgZm91bmQgaW4gYWxsIGRvY3VtZW50cyBhcmUgYXBwbGllZC5cblx0XHQqICAgXCJvcGVuRG9jdW1lbnRzXCI6IHByb2JsZW1zIGZvdW5kIGluIGRvY3VtZW50cyB0aGF0IGFyZSBvcGVuXG5cdFx0KiAgIGFyZSBhcHBsaWVkLlxuXHRcdCogICBcImNsb3NlZERvY3VtZW50c1wiOiBwcm9ibGVtcyBmb3VuZCBpbiBjbG9zZWQgZG9jdW1lbnRzIGFyZVxuXHRcdCogICBhcHBsaWVkLlxuXHRcdCovXG5cdFx0YXBwbHlUbz86IHN0cmluZztcblxuXHRcdC8qKlxuXHRcdCogVGhlIHNldmVyaXR5IG9mIHRoZSBWU0NvZGUgcHJvYmxlbSBwcm9kdWNlZCBieSB0aGlzIHByb2JsZW0gbWF0Y2hlci5cblx0XHQqXG5cdFx0KiBWYWxpZCB2YWx1ZXMgYXJlOlxuXHRcdCogICBcImVycm9yXCI6IHRvIHByb2R1Y2UgZXJyb3JzLlxuXHRcdCogICBcIndhcm5pbmdcIjogdG8gcHJvZHVjZSB3YXJuaW5ncy5cblx0XHQqICAgXCJpbmZvXCI6IHRvIHByb2R1Y2UgaW5mb3MuXG5cdFx0KlxuXHRcdCogVGhlIHZhbHVlIGlzIHVzZWQgaWYgYSBwYXR0ZXJuIGRvZXNuJ3Qgc3BlY2lmeSBhIHNldmVyaXR5IG1hdGNoIGdyb3VwLlxuXHRcdCogRGVmYXVsdHMgdG8gXCJlcnJvclwiIGlmIG9taXR0ZWQuXG5cdFx0Ki9cblx0XHRzZXZlcml0eT86IHN0cmluZztcblxuXHRcdC8qKlxuXHRcdCogRGVmaW5lcyBob3cgZmlsZW5hbWUgcmVwb3J0ZWQgaW4gYSBwcm9ibGVtIHBhdHRlcm5cblx0XHQqIHNob3VsZCBiZSByZWFkLiBWYWxpZCB2YWx1ZXMgYXJlOlxuXHRcdCogIC0gXCJhYnNvbHV0ZVwiOiB0aGUgZmlsZW5hbWUgaXMgYWx3YXlzIHRyZWF0ZWQgYWJzb2x1dGUuXG5cdFx0KiAgLSBcInJlbGF0aXZlXCI6IHRoZSBmaWxlbmFtZSBpcyBhbHdheXMgdHJlYXRlZCByZWxhdGl2ZSB0b1xuXHRcdCogICAgdGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnkuIFRoaXMgaXMgdGhlIGRlZmF1bHQuXG5cdFx0KiAgLSBbXCJyZWxhdGl2ZVwiLCBcInBhdGggdmFsdWVcIl06IHRoZSBmaWxlbmFtZSBpcyBhbHdheXNcblx0XHQqICAgIHRyZWF0ZWQgcmVsYXRpdmUgdG8gdGhlIGdpdmVuIHBhdGggdmFsdWUuXG5cdFx0KiAgLSBcImF1dG9kZXRlY3RcIjogdGhlIGZpbGVuYW1lIGlzIHRyZWF0ZWQgcmVsYXRpdmUgdG9cblx0XHQqICAgIHRoZSBjdXJyZW50IHdvcmtzcGFjZSBkaXJlY3RvcnksIGFuZCBpZiB0aGUgZmlsZVxuXHRcdCogICAgZG9lcyBub3QgZXhpc3QsIGl0IGlzIHRyZWF0ZWQgYXMgYWJzb2x1dGUuXG5cdFx0KiAgLSBbXCJhdXRvZGV0ZWN0XCIsIFwicGF0aCB2YWx1ZVwiXTogdGhlIGZpbGVuYW1lIGlzIHRyZWF0ZWRcblx0XHQqICAgIHJlbGF0aXZlIHRvIHRoZSBnaXZlbiBwYXRoIHZhbHVlLCBhbmQgaWYgaXQgZG9lcyBub3Rcblx0XHQqICAgIGV4aXN0LCBpdCBpcyB0cmVhdGVkIGFzIGFic29sdXRlLlxuXHRcdCogIC0gW1wic2VhcmNoXCIsIHsgaW5jbHVkZT86IFwiXCIgfCBbXTsgZXhjbHVkZT86IFwiXCIgfCBbXSB9XTogVGhlIGZpbGVuYW1lXG5cdFx0KiAgICBuZWVkcyB0byBiZSBzZWFyY2hlZCB1bmRlciB0aGUgZGlyZWN0b3JpZXMgbmFtZWQgYnkgdGhlIFwiaW5jbHVkZVwiXG5cdFx0KiAgICBwcm9wZXJ0eSBhbmQgdGhlaXIgbmVzdGVkIHN1YmRpcmVjdG9yaWVzLiBXaXRoIFwiZXhjbHVkZVwiIHByb3BlcnR5XG5cdFx0KiAgICBwcmVzZW50LCB0aGUgZGlyZWN0b3JpZXMgc2hvdWxkIGJlIHJlbW92ZWQgZnJvbSB0aGUgc2VhcmNoLiBXaGVuXG5cdFx0KiAgICBgaW5jbHVkZWAgaXMgbm90IHVucHJvdmlkZWQsIHRoZSBjdXJyZW50IHdvcmtzcGFjZSBkaXJlY3Rvcnkgc2hvdWxkXG5cdFx0KiAgICBiZSB1c2VkIGFzIHRoZSBkZWZhdWx0LlxuXHRcdCovXG5cdFx0ZmlsZUxvY2F0aW9uPzogc3RyaW5nIHwgc3RyaW5nW10gfCBbJ3NlYXJjaCcsIFNlYXJjaEZpbGVMb2NhdGlvbkFyZ3NdO1xuXG5cdFx0LyoqXG5cdFx0KiBUaGUgbmFtZSBvZiBhIHByZWRlZmluZWQgcHJvYmxlbSBwYXR0ZXJuLCB0aGUgaW5saW5lIGRlZmluaXRpb25cblx0XHQqIG9mIGEgcHJvYmxlbSBwYXR0ZXJuIG9yIGFuIGFycmF5IG9mIHByb2JsZW0gcGF0dGVybnMgdG8gbWF0Y2hcblx0XHQqIHByb2JsZW1zIHNwcmVhZCBvdmVyIG11bHRpcGxlIGxpbmVzLlxuXHRcdCovXG5cdFx0cGF0dGVybj86IHN0cmluZyB8IElQcm9ibGVtUGF0dGVybiB8IElQcm9ibGVtUGF0dGVybltdO1xuXG5cdFx0LyoqXG5cdFx0KiBBIHJlZ3VsYXIgZXhwcmVzc2lvbiBzaWduYWxpbmcgdGhhdCBhIHdhdGNoZWQgdGFza3MgYmVnaW5zIGV4ZWN1dGluZ1xuXHRcdCogdHJpZ2dlcmVkIHRocm91Z2ggZmlsZSB3YXRjaGluZy5cblx0XHQqL1xuXHRcdHdhdGNoZWRUYXNrQmVnaW5zUmVnRXhwPzogc3RyaW5nO1xuXG5cdFx0LyoqXG5cdFx0KiBBIHJlZ3VsYXIgZXhwcmVzc2lvbiBzaWduYWxpbmcgdGhhdCBhIHdhdGNoZWQgdGFza3MgZW5kcyBleGVjdXRpbmcuXG5cdFx0Ki9cblx0XHR3YXRjaGVkVGFza0VuZHNSZWdFeHA/OiBzdHJpbmc7XG5cblx0XHQvKipcblx0XHQgKiBAZGVwcmVjYXRlZCBVc2UgYmFja2dyb3VuZCBpbnN0ZWFkLlxuXHRcdCAqL1xuXHRcdHdhdGNoaW5nPzogSUJhY2tncm91bmRNb25pdG9yO1xuXHRcdGJhY2tncm91bmQ/OiBJQmFja2dyb3VuZE1vbml0b3I7XG5cdH1cblxuXHRleHBvcnQgdHlwZSBTZWFyY2hGaWxlTG9jYXRpb25BcmdzID0ge1xuXHRcdGluY2x1ZGU/OiBzdHJpbmcgfCBzdHJpbmdbXTtcblx0XHRleGNsdWRlPzogc3RyaW5nIHwgc3RyaW5nW107XG5cdH07XG5cblx0ZXhwb3J0IHR5cGUgUHJvYmxlbU1hdGNoZXJUeXBlID0gc3RyaW5nIHwgUHJvYmxlbU1hdGNoZXIgfCBBcnJheTxzdHJpbmcgfCBQcm9ibGVtTWF0Y2hlcj47XG5cblx0ZXhwb3J0IGludGVyZmFjZSBJTmFtZWRQcm9ibGVtTWF0Y2hlciBleHRlbmRzIFByb2JsZW1NYXRjaGVyIHtcblx0XHQvKipcblx0XHQqIFRoaXMgbmFtZSBjYW4gYmUgdXNlZCB0byByZWZlciB0byB0aGVcblx0XHQqIHByb2JsZW0gbWF0Y2hlciBmcm9tIHdpdGhpbiBhIHRhc2suXG5cdFx0Ki9cblx0XHRuYW1lOiBzdHJpbmc7XG5cblx0XHQvKipcblx0XHQgKiBBIGh1bWFuIHJlYWRhYmxlIGxhYmVsLlxuXHRcdCAqL1xuXHRcdGxhYmVsPzogc3RyaW5nO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGlzTmFtZWRQcm9ibGVtTWF0Y2hlcih2YWx1ZTogUHJvYmxlbU1hdGNoZXIpOiB2YWx1ZSBpcyBJTmFtZWRQcm9ibGVtTWF0Y2hlciB7XG5cdFx0cmV0dXJuIFR5cGVzLmlzU3RyaW5nKCg8SU5hbWVkUHJvYmxlbU1hdGNoZXI+dmFsdWUpLm5hbWUpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBQcm9ibGVtUGF0dGVyblBhcnNlciBleHRlbmRzIFBhcnNlciB7XG5cblx0Y29uc3RydWN0b3IobG9nZ2VyOiBJUHJvYmxlbVJlcG9ydGVyKSB7XG5cdFx0c3VwZXIobG9nZ2VyKTtcblx0fVxuXG5cdHB1YmxpYyBwYXJzZSh2YWx1ZTogQ29uZmlnLklQcm9ibGVtUGF0dGVybik6IElQcm9ibGVtUGF0dGVybjtcblx0cHVibGljIHBhcnNlKHZhbHVlOiBDb25maWcuTXVsdGlMaW5lUHJvYmxlbVBhdHRlcm4pOiBNdWx0aUxpbmVQcm9ibGVtUGF0dGVybjtcblx0cHVibGljIHBhcnNlKHZhbHVlOiBDb25maWcuSU5hbWVkUHJvYmxlbVBhdHRlcm4pOiBJTmFtZWRQcm9ibGVtUGF0dGVybjtcblx0cHVibGljIHBhcnNlKHZhbHVlOiBDb25maWcuSU5hbWVkTXVsdGlMaW5lQ2hlY2tlZFByb2JsZW1QYXR0ZXJuKTogSU5hbWVkTXVsdGlMaW5lUHJvYmxlbVBhdHRlcm47XG5cdHB1YmxpYyBwYXJzZSh2YWx1ZTogQ29uZmlnLklQcm9ibGVtUGF0dGVybiB8IENvbmZpZy5NdWx0aUxpbmVQcm9ibGVtUGF0dGVybiB8IENvbmZpZy5JTmFtZWRQcm9ibGVtUGF0dGVybiB8IENvbmZpZy5JTmFtZWRNdWx0aUxpbmVDaGVja2VkUHJvYmxlbVBhdHRlcm4pOiBhbnkge1xuXHRcdGlmIChDb25maWcuTmFtZWRNdWx0aUxpbmVDaGVja2VkUHJvYmxlbVBhdHRlcm4uaXModmFsdWUpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jcmVhdGVOYW1lZE11bHRpTGluZVByb2JsZW1QYXR0ZXJuKHZhbHVlKTtcblx0XHR9IGVsc2UgaWYgKENvbmZpZy5NdWx0aUxpbmVDaGVja2VkUHJvYmxlbVBhdHRlcm4uaXModmFsdWUpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jcmVhdGVNdWx0aUxpbmVQcm9ibGVtUGF0dGVybih2YWx1ZSk7XG5cdFx0fSBlbHNlIGlmIChDb25maWcuTmFtZWRDaGVja2VkUHJvYmxlbVBhdHRlcm4uaXModmFsdWUpKSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSB0aGlzLmNyZWF0ZVNpbmdsZVByb2JsZW1QYXR0ZXJuKHZhbHVlKSBhcyBJTmFtZWRQcm9ibGVtUGF0dGVybjtcblx0XHRcdHJlc3VsdC5uYW1lID0gdmFsdWUubmFtZTtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSBlbHNlIGlmIChDb25maWcuQ2hlY2tlZFByb2JsZW1QYXR0ZXJuLmlzKHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuY3JlYXRlU2luZ2xlUHJvYmxlbVBhdHRlcm4odmFsdWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmVycm9yKGxvY2FsaXplKCdQcm9ibGVtUGF0dGVyblBhcnNlci5wcm9ibGVtUGF0dGVybi5taXNzaW5nUmVnRXhwJywgJ1RoZSBwcm9ibGVtIHBhdHRlcm4gaXMgbWlzc2luZyBhIHJlZ3VsYXIgZXhwcmVzc2lvbi4nKSk7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVNpbmdsZVByb2JsZW1QYXR0ZXJuKHZhbHVlOiBDb25maWcuSUNoZWNrZWRQcm9ibGVtUGF0dGVybik6IElQcm9ibGVtUGF0dGVybiB8IG51bGwge1xuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuZG9DcmVhdGVTaW5nbGVQcm9ibGVtUGF0dGVybih2YWx1ZSwgdHJ1ZSk7XG5cdFx0aWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9IGVsc2UgaWYgKHJlc3VsdC5raW5kID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJlc3VsdC5raW5kID0gUHJvYmxlbUxvY2F0aW9uS2luZC5Mb2NhdGlvbjtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMudmFsaWRhdGVQcm9ibGVtUGF0dGVybihbcmVzdWx0XSkgPyByZXN1bHQgOiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVOYW1lZE11bHRpTGluZVByb2JsZW1QYXR0ZXJuKHZhbHVlOiBDb25maWcuSU5hbWVkTXVsdGlMaW5lQ2hlY2tlZFByb2JsZW1QYXR0ZXJuKTogSU5hbWVkTXVsdGlMaW5lUHJvYmxlbVBhdHRlcm4gfCBudWxsIHtcblx0XHRjb25zdCB2YWxpZFBhdHRlcm5zID0gdGhpcy5jcmVhdGVNdWx0aUxpbmVQcm9ibGVtUGF0dGVybih2YWx1ZS5wYXR0ZXJucyk7XG5cdFx0aWYgKCF2YWxpZFBhdHRlcm5zKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0ID0ge1xuXHRcdFx0bmFtZTogdmFsdWUubmFtZSxcblx0XHRcdGxhYmVsOiB2YWx1ZS5sYWJlbCA/IHZhbHVlLmxhYmVsIDogdmFsdWUubmFtZSxcblx0XHRcdHBhdHRlcm5zOiB2YWxpZFBhdHRlcm5zXG5cdFx0fTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVNdWx0aUxpbmVQcm9ibGVtUGF0dGVybih2YWx1ZXM6IENvbmZpZy5NdWx0aUxpbmVDaGVja2VkUHJvYmxlbVBhdHRlcm4pOiBNdWx0aUxpbmVQcm9ibGVtUGF0dGVybiB8IG51bGwge1xuXHRcdGNvbnN0IHJlc3VsdDogTXVsdGlMaW5lUHJvYmxlbVBhdHRlcm4gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgcGF0dGVybiA9IHRoaXMuZG9DcmVhdGVTaW5nbGVQcm9ibGVtUGF0dGVybih2YWx1ZXNbaV0sIGZhbHNlKTtcblx0XHRcdGlmIChwYXR0ZXJuID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZiAoaSA8IHZhbHVlcy5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdGlmICghVHlwZXMuaXNVbmRlZmluZWQocGF0dGVybi5sb29wKSAmJiBwYXR0ZXJuLmxvb3ApIHtcblx0XHRcdFx0XHRwYXR0ZXJuLmxvb3AgPSBmYWxzZTtcblx0XHRcdFx0XHR0aGlzLmVycm9yKGxvY2FsaXplKCdQcm9ibGVtUGF0dGVyblBhcnNlci5sb29wUHJvcGVydHkubm90TGFzdCcsICdUaGUgbG9vcCBwcm9wZXJ0eSBpcyBvbmx5IHN1cHBvcnRlZCBvbiB0aGUgbGFzdCBsaW5lIG1hdGNoZXIuJykpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXN1bHQucHVzaChwYXR0ZXJuKTtcblx0XHR9XG5cdFx0aWYgKHJlc3VsdFswXS5raW5kID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJlc3VsdFswXS5raW5kID0gUHJvYmxlbUxvY2F0aW9uS2luZC5Mb2NhdGlvbjtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMudmFsaWRhdGVQcm9ibGVtUGF0dGVybihyZXN1bHQpID8gcmVzdWx0IDogbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgZG9DcmVhdGVTaW5nbGVQcm9ibGVtUGF0dGVybih2YWx1ZTogQ29uZmlnLklDaGVja2VkUHJvYmxlbVBhdHRlcm4sIHNldERlZmF1bHRzOiBib29sZWFuKTogSVByb2JsZW1QYXR0ZXJuIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZWdleHAgPSB0aGlzLmNyZWF0ZVJlZ3VsYXJFeHByZXNzaW9uKHZhbHVlLnJlZ2V4cCk7XG5cdFx0aWYgKHJlZ2V4cCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRsZXQgcmVzdWx0OiBJUHJvYmxlbVBhdHRlcm4gPSB7IHJlZ2V4cCB9O1xuXHRcdGlmICh2YWx1ZS5raW5kKSB7XG5cdFx0XHRyZXN1bHQua2luZCA9IFByb2JsZW1Mb2NhdGlvbktpbmQuZnJvbVN0cmluZyh2YWx1ZS5raW5kKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBjb3B5UHJvcGVydHkocmVzdWx0OiBJUHJvYmxlbVBhdHRlcm4sIHNvdXJjZTogQ29uZmlnLklQcm9ibGVtUGF0dGVybiwgcmVzdWx0S2V5OiBrZXlvZiBJUHJvYmxlbVBhdHRlcm4sIHNvdXJjZUtleToga2V5b2YgQ29uZmlnLklQcm9ibGVtUGF0dGVybikge1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBzb3VyY2Vbc291cmNlS2V5XTtcblx0XHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdChyZXN1bHQgYXMgYW55KVtyZXN1bHRLZXldID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvcHlQcm9wZXJ0eShyZXN1bHQsIHZhbHVlLCAnZmlsZScsICdmaWxlJyk7XG5cdFx0Y29weVByb3BlcnR5KHJlc3VsdCwgdmFsdWUsICdsb2NhdGlvbicsICdsb2NhdGlvbicpO1xuXHRcdGNvcHlQcm9wZXJ0eShyZXN1bHQsIHZhbHVlLCAnbGluZScsICdsaW5lJyk7XG5cdFx0Y29weVByb3BlcnR5KHJlc3VsdCwgdmFsdWUsICdjaGFyYWN0ZXInLCAnY29sdW1uJyk7XG5cdFx0Y29weVByb3BlcnR5KHJlc3VsdCwgdmFsdWUsICdlbmRMaW5lJywgJ2VuZExpbmUnKTtcblx0XHRjb3B5UHJvcGVydHkocmVzdWx0LCB2YWx1ZSwgJ2VuZENoYXJhY3RlcicsICdlbmRDb2x1bW4nKTtcblx0XHRjb3B5UHJvcGVydHkocmVzdWx0LCB2YWx1ZSwgJ3NldmVyaXR5JywgJ3NldmVyaXR5Jyk7XG5cdFx0Y29weVByb3BlcnR5KHJlc3VsdCwgdmFsdWUsICdjb2RlJywgJ2NvZGUnKTtcblx0XHRjb3B5UHJvcGVydHkocmVzdWx0LCB2YWx1ZSwgJ21lc3NhZ2UnLCAnbWVzc2FnZScpO1xuXHRcdGlmICh2YWx1ZS5sb29wID09PSB0cnVlIHx8IHZhbHVlLmxvb3AgPT09IGZhbHNlKSB7XG5cdFx0XHRyZXN1bHQubG9vcCA9IHZhbHVlLmxvb3A7XG5cdFx0fVxuXHRcdGlmIChzZXREZWZhdWx0cykge1xuXHRcdFx0aWYgKHJlc3VsdC5sb2NhdGlvbiB8fCByZXN1bHQua2luZCA9PT0gUHJvYmxlbUxvY2F0aW9uS2luZC5GaWxlKSB7XG5cdFx0XHRcdGNvbnN0IGRlZmF1bHRWYWx1ZTogUGFydGlhbDxJUHJvYmxlbVBhdHRlcm4+ID0ge1xuXHRcdFx0XHRcdGZpbGU6IDEsXG5cdFx0XHRcdFx0bWVzc2FnZTogMFxuXHRcdFx0XHR9O1xuXHRcdFx0XHRyZXN1bHQgPSBPYmplY3RzLm1peGluKHJlc3VsdCwgZGVmYXVsdFZhbHVlLCBmYWxzZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBkZWZhdWx0VmFsdWU6IFBhcnRpYWw8SVByb2JsZW1QYXR0ZXJuPiA9IHtcblx0XHRcdFx0XHRmaWxlOiAxLFxuXHRcdFx0XHRcdGxpbmU6IDIsXG5cdFx0XHRcdFx0Y2hhcmFjdGVyOiAzLFxuXHRcdFx0XHRcdG1lc3NhZ2U6IDBcblx0XHRcdFx0fTtcblx0XHRcdFx0cmVzdWx0ID0gT2JqZWN0cy5taXhpbihyZXN1bHQsIGRlZmF1bHRWYWx1ZSwgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSB2YWxpZGF0ZVByb2JsZW1QYXR0ZXJuKHZhbHVlczogSVByb2JsZW1QYXR0ZXJuW10pOiBib29sZWFuIHtcblx0XHRsZXQgZmlsZTogYm9vbGVhbiA9IGZhbHNlLCBtZXNzYWdlOiBib29sZWFuID0gZmFsc2UsIGxvY2F0aW9uOiBib29sZWFuID0gZmFsc2UsIGxpbmU6IGJvb2xlYW4gPSBmYWxzZTtcblx0XHRjb25zdCBsb2NhdGlvbktpbmQgPSAodmFsdWVzWzBdLmtpbmQgPT09IHVuZGVmaW5lZCkgPyBQcm9ibGVtTG9jYXRpb25LaW5kLkxvY2F0aW9uIDogdmFsdWVzWzBdLmtpbmQ7XG5cblx0XHR2YWx1ZXMuZm9yRWFjaCgocGF0dGVybiwgaSkgPT4ge1xuXHRcdFx0aWYgKGkgIT09IDAgJiYgcGF0dGVybi5raW5kKSB7XG5cdFx0XHRcdHRoaXMuZXJyb3IobG9jYWxpemUoJ1Byb2JsZW1QYXR0ZXJuUGFyc2VyLnByb2JsZW1QYXR0ZXJuLmtpbmRQcm9wZXJ0eS5ub3RGaXJzdCcsICdUaGUgcHJvYmxlbSBwYXR0ZXJuIGlzIGludmFsaWQuIFRoZSBraW5kIHByb3BlcnR5IG11c3QgYmUgcHJvdmlkZWQgb25seSBpbiB0aGUgZmlyc3QgZWxlbWVudCcpKTtcblx0XHRcdH1cblx0XHRcdGZpbGUgPSBmaWxlIHx8ICFUeXBlcy5pc1VuZGVmaW5lZChwYXR0ZXJuLmZpbGUpO1xuXHRcdFx0bWVzc2FnZSA9IG1lc3NhZ2UgfHwgIVR5cGVzLmlzVW5kZWZpbmVkKHBhdHRlcm4ubWVzc2FnZSk7XG5cdFx0XHRsb2NhdGlvbiA9IGxvY2F0aW9uIHx8ICFUeXBlcy5pc1VuZGVmaW5lZChwYXR0ZXJuLmxvY2F0aW9uKTtcblx0XHRcdGxpbmUgPSBsaW5lIHx8ICFUeXBlcy5pc1VuZGVmaW5lZChwYXR0ZXJuLmxpbmUpO1xuXHRcdH0pO1xuXHRcdGlmICghKGZpbGUgJiYgbWVzc2FnZSkpIHtcblx0XHRcdHRoaXMuZXJyb3IobG9jYWxpemUoJ1Byb2JsZW1QYXR0ZXJuUGFyc2VyLnByb2JsZW1QYXR0ZXJuLm1pc3NpbmdQcm9wZXJ0eScsICdUaGUgcHJvYmxlbSBwYXR0ZXJuIGlzIGludmFsaWQuIEl0IG11c3QgaGF2ZSBhdCBsZWFzdCBoYXZlIGEgZmlsZSBhbmQgYSBtZXNzYWdlLicpKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKGxvY2F0aW9uS2luZCA9PT0gUHJvYmxlbUxvY2F0aW9uS2luZC5Mb2NhdGlvbiAmJiAhKGxvY2F0aW9uIHx8IGxpbmUpKSB7XG5cdFx0XHR0aGlzLmVycm9yKGxvY2FsaXplKCdQcm9ibGVtUGF0dGVyblBhcnNlci5wcm9ibGVtUGF0dGVybi5taXNzaW5nTG9jYXRpb24nLCAnVGhlIHByb2JsZW0gcGF0dGVybiBpcyBpbnZhbGlkLiBJdCBtdXN0IGVpdGhlciBoYXZlIGtpbmQ6IFwiZmlsZVwiIG9yIGhhdmUgYSBsaW5lIG9yIGxvY2F0aW9uIG1hdGNoIGdyb3VwLicpKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVJlZ3VsYXJFeHByZXNzaW9uKHZhbHVlOiBzdHJpbmcpOiBSZWdFeHAgfCB1bmRlZmluZWQge1xuXHRcdGxldCByZXN1bHQ6IFJlZ0V4cCB8IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0cmVzdWx0ID0gbmV3IFJlZ0V4cCh2YWx1ZSk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHR0aGlzLmVycm9yKGxvY2FsaXplKCdQcm9ibGVtUGF0dGVyblBhcnNlci5pbnZhbGlkUmVnZXhwJywgJ0Vycm9yOiBUaGUgc3RyaW5nIHswfSBpcyBub3QgYSB2YWxpZCByZWd1bGFyIGV4cHJlc3Npb24uXFxuJywgdmFsdWUpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uUmVnaXN0cnlSZXBvcnRlciBpbXBsZW1lbnRzIElQcm9ibGVtUmVwb3J0ZXIge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIF9jb2xsZWN0b3I6IEV4dGVuc2lvbk1lc3NhZ2VDb2xsZWN0b3IsIHByaXZhdGUgX3ZhbGlkYXRpb25TdGF0dXM6IFZhbGlkYXRpb25TdGF0dXMgPSBuZXcgVmFsaWRhdGlvblN0YXR1cygpKSB7XG5cdH1cblxuXHRwdWJsaWMgaW5mbyhtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl92YWxpZGF0aW9uU3RhdHVzLnN0YXRlID0gVmFsaWRhdGlvblN0YXRlLkluZm87XG5cdFx0dGhpcy5fY29sbGVjdG9yLmluZm8obWVzc2FnZSk7XG5cdH1cblxuXHRwdWJsaWMgd2FybihtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl92YWxpZGF0aW9uU3RhdHVzLnN0YXRlID0gVmFsaWRhdGlvblN0YXRlLldhcm5pbmc7XG5cdFx0dGhpcy5fY29sbGVjdG9yLndhcm4obWVzc2FnZSk7XG5cdH1cblxuXHRwdWJsaWMgZXJyb3IobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fdmFsaWRhdGlvblN0YXR1cy5zdGF0ZSA9IFZhbGlkYXRpb25TdGF0ZS5FcnJvcjtcblx0XHR0aGlzLl9jb2xsZWN0b3IuZXJyb3IobWVzc2FnZSk7XG5cdH1cblxuXHRwdWJsaWMgZmF0YWwobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fdmFsaWRhdGlvblN0YXR1cy5zdGF0ZSA9IFZhbGlkYXRpb25TdGF0ZS5GYXRhbDtcblx0XHR0aGlzLl9jb2xsZWN0b3IuZXJyb3IobWVzc2FnZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHN0YXR1cygpOiBWYWxpZGF0aW9uU3RhdHVzIHtcblx0XHRyZXR1cm4gdGhpcy5fdmFsaWRhdGlvblN0YXR1cztcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIFNjaGVtYXMge1xuXG5cdGV4cG9ydCBjb25zdCBQcm9ibGVtUGF0dGVybjogSUpTT05TY2hlbWEgPSB7XG5cdFx0ZGVmYXVsdDoge1xuXHRcdFx0cmVnZXhwOiAnXihbXlxcXFxcXFxcc10uKilcXFxcXFxcXCgoXFxcXFxcXFxkKyxcXFxcXFxcXGQrKVxcXFxcXFxcKTpcXFxcXFxcXHMqKC4qKSQnLFxuXHRcdFx0ZmlsZTogMSxcblx0XHRcdGxvY2F0aW9uOiAyLFxuXHRcdFx0bWVzc2FnZTogM1xuXHRcdH0sXG5cdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuXHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdHJlZ2V4cDoge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdQcm9ibGVtUGF0dGVyblNjaGVtYS5yZWdleHAnLCAnVGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiB0byBmaW5kIGFuIGVycm9yLCB3YXJuaW5nIG9yIGluZm8gaW4gdGhlIG91dHB1dC4nKVxuXHRcdFx0fSxcblx0XHRcdGtpbmQ6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnUHJvYmxlbVBhdHRlcm5TY2hlbWEua2luZCcsICd3aGV0aGVyIHRoZSBwYXR0ZXJuIG1hdGNoZXMgYSBsb2NhdGlvbiAoZmlsZSBhbmQgbGluZSkgb3Igb25seSBhIGZpbGUuJylcblx0XHRcdH0sXG5cdFx0XHRmaWxlOiB7XG5cdFx0XHRcdHR5cGU6ICdpbnRlZ2VyJyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdQcm9ibGVtUGF0dGVyblNjaGVtYS5maWxlJywgJ1RoZSBtYXRjaCBncm91cCBpbmRleCBvZiB0aGUgZmlsZW5hbWUuIElmIG9taXR0ZWQgMSBpcyB1c2VkLicpXG5cdFx0XHR9LFxuXHRcdFx0bG9jYXRpb246IHtcblx0XHRcdFx0dHlwZTogJ2ludGVnZXInLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ1Byb2JsZW1QYXR0ZXJuU2NoZW1hLmxvY2F0aW9uJywgJ1RoZSBtYXRjaCBncm91cCBpbmRleCBvZiB0aGUgcHJvYmxlbVxcJ3MgbG9jYXRpb24uIFZhbGlkIGxvY2F0aW9uIHBhdHRlcm5zIGFyZTogKGxpbmUpLCAobGluZSxjb2x1bW4pIGFuZCAoc3RhcnRMaW5lLHN0YXJ0Q29sdW1uLGVuZExpbmUsZW5kQ29sdW1uKS4gSWYgb21pdHRlZCAobGluZSxjb2x1bW4pIGlzIGFzc3VtZWQuJylcblx0XHRcdH0sXG5cdFx0XHRsaW5lOiB7XG5cdFx0XHRcdHR5cGU6ICdpbnRlZ2VyJyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdQcm9ibGVtUGF0dGVyblNjaGVtYS5saW5lJywgJ1RoZSBtYXRjaCBncm91cCBpbmRleCBvZiB0aGUgcHJvYmxlbVxcJ3MgbGluZS4gRGVmYXVsdHMgdG8gMicpXG5cdFx0XHR9LFxuXHRcdFx0Y29sdW1uOiB7XG5cdFx0XHRcdHR5cGU6ICdpbnRlZ2VyJyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdQcm9ibGVtUGF0dGVyblNjaGVtYS5jb2x1bW4nLCAnVGhlIG1hdGNoIGdyb3VwIGluZGV4IG9mIHRoZSBwcm9ibGVtXFwncyBsaW5lIGNoYXJhY3Rlci4gRGVmYXVsdHMgdG8gMycpXG5cdFx0XHR9LFxuXHRcdFx0ZW5kTGluZToge1xuXHRcdFx0XHR0eXBlOiAnaW50ZWdlcicsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnUHJvYmxlbVBhdHRlcm5TY2hlbWEuZW5kTGluZScsICdUaGUgbWF0Y2ggZ3JvdXAgaW5kZXggb2YgdGhlIHByb2JsZW1cXCdzIGVuZCBsaW5lLiBEZWZhdWx0cyB0byB1bmRlZmluZWQnKVxuXHRcdFx0fSxcblx0XHRcdGVuZENvbHVtbjoge1xuXHRcdFx0XHR0eXBlOiAnaW50ZWdlcicsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnUHJvYmxlbVBhdHRlcm5TY2hlbWEuZW5kQ29sdW1uJywgJ1RoZSBtYXRjaCBncm91cCBpbmRleCBvZiB0aGUgcHJvYmxlbVxcJ3MgZW5kIGxpbmUgY2hhcmFjdGVyLiBEZWZhdWx0cyB0byB1bmRlZmluZWQnKVxuXHRcdFx0fSxcblx0XHRcdHNldmVyaXR5OiB7XG5cdFx0XHRcdHR5cGU6ICdpbnRlZ2VyJyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdQcm9ibGVtUGF0dGVyblNjaGVtYS5zZXZlcml0eScsICdUaGUgbWF0Y2ggZ3JvdXAgaW5kZXggb2YgdGhlIHByb2JsZW1cXCdzIHNldmVyaXR5LiBEZWZhdWx0cyB0byB1bmRlZmluZWQnKVxuXHRcdFx0fSxcblx0XHRcdGNvZGU6IHtcblx0XHRcdFx0dHlwZTogJ2ludGVnZXInLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ1Byb2JsZW1QYXR0ZXJuU2NoZW1hLmNvZGUnLCAnVGhlIG1hdGNoIGdyb3VwIGluZGV4IG9mIHRoZSBwcm9ibGVtXFwncyBjb2RlLiBEZWZhdWx0cyB0byB1bmRlZmluZWQnKVxuXHRcdFx0fSxcblx0XHRcdG1lc3NhZ2U6IHtcblx0XHRcdFx0dHlwZTogJ2ludGVnZXInLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ1Byb2JsZW1QYXR0ZXJuU2NoZW1hLm1lc3NhZ2UnLCAnVGhlIG1hdGNoIGdyb3VwIGluZGV4IG9mIHRoZSBtZXNzYWdlLiBJZiBvbWl0dGVkIGl0IGRlZmF1bHRzIHRvIDQgaWYgbG9jYXRpb24gaXMgc3BlY2lmaWVkLiBPdGhlcndpc2UgaXQgZGVmYXVsdHMgdG8gNS4nKVxuXHRcdFx0fSxcblx0XHRcdGxvb3A6IHtcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ1Byb2JsZW1QYXR0ZXJuU2NoZW1hLmxvb3AnLCAnSW4gYSBtdWx0aSBsaW5lIG1hdGNoZXIgbG9vcCBpbmRpY2F0ZWQgd2hldGhlciB0aGlzIHBhdHRlcm4gaXMgZXhlY3V0ZWQgaW4gYSBsb29wIGFzIGxvbmcgYXMgaXQgbWF0Y2hlcy4gQ2FuIG9ubHkgc3BlY2lmaWVkIG9uIGEgbGFzdCBwYXR0ZXJuIGluIGEgbXVsdGkgbGluZSBwYXR0ZXJuLicpXG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXG5cdGV4cG9ydCBjb25zdCBOYW1lZFByb2JsZW1QYXR0ZXJuOiBJSlNPTlNjaGVtYSA9IE9iamVjdHMuZGVlcENsb25lKFByb2JsZW1QYXR0ZXJuKTtcblx0TmFtZWRQcm9ibGVtUGF0dGVybi5wcm9wZXJ0aWVzID0gT2JqZWN0cy5kZWVwQ2xvbmUoTmFtZWRQcm9ibGVtUGF0dGVybi5wcm9wZXJ0aWVzKSB8fCB7fTtcblx0TmFtZWRQcm9ibGVtUGF0dGVybi5wcm9wZXJ0aWVzWyduYW1lJ10gPSB7XG5cdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdOYW1lZFByb2JsZW1QYXR0ZXJuU2NoZW1hLm5hbWUnLCAnVGhlIG5hbWUgb2YgdGhlIHByb2JsZW0gcGF0dGVybi4nKVxuXHR9O1xuXG5cdGV4cG9ydCBjb25zdCBNdWx0aUxpbmVQcm9ibGVtUGF0dGVybjogSUpTT05TY2hlbWEgPSB7XG5cdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRpdGVtczogUHJvYmxlbVBhdHRlcm5cblx0fTtcblxuXHRleHBvcnQgY29uc3QgTmFtZWRNdWx0aUxpbmVQcm9ibGVtUGF0dGVybjogSUpTT05TY2hlbWEgPSB7XG5cdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuXHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdG5hbWU6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnTmFtZWRNdWx0aUxpbmVQcm9ibGVtUGF0dGVyblNjaGVtYS5uYW1lJywgJ1RoZSBuYW1lIG9mIHRoZSBwcm9ibGVtIG11bHRpIGxpbmUgcHJvYmxlbSBwYXR0ZXJuLicpXG5cdFx0XHR9LFxuXHRcdFx0cGF0dGVybnM6IHtcblx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdOYW1lZE11bHRpTGluZVByb2JsZW1QYXR0ZXJuU2NoZW1hLnBhdHRlcm5zJywgJ1RoZSBhY3R1YWwgcGF0dGVybnMuJyksXG5cdFx0XHRcdGl0ZW1zOiBQcm9ibGVtUGF0dGVyblxuXHRcdFx0fVxuXHRcdH1cblx0fTtcblxuXHRleHBvcnQgY29uc3QgV2F0Y2hpbmdQYXR0ZXJuOiBJSlNPTlNjaGVtYSA9IHtcblx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0cmVnZXhwOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ1dhdGNoaW5nUGF0dGVyblNjaGVtYS5yZWdleHAnLCAnVGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiB0byBkZXRlY3QgdGhlIGJlZ2luIG9yIGVuZCBvZiBhIGJhY2tncm91bmQgdGFzay4nKVxuXHRcdFx0fSxcblx0XHRcdGZpbGU6IHtcblx0XHRcdFx0dHlwZTogJ2ludGVnZXInLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ1dhdGNoaW5nUGF0dGVyblNjaGVtYS5maWxlJywgJ1RoZSBtYXRjaCBncm91cCBpbmRleCBvZiB0aGUgZmlsZW5hbWUuIENhbiBiZSBvbWl0dGVkLicpXG5cdFx0XHR9LFxuXHRcdH1cblx0fTtcblxuXHRleHBvcnQgY29uc3QgUGF0dGVyblR5cGU6IElKU09OU2NoZW1hID0ge1xuXHRcdGFueU9mOiBbXG5cdFx0XHR7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ1BhdHRlcm5UeXBlU2NoZW1hLm5hbWUnLCAnVGhlIG5hbWUgb2YgYSBjb250cmlidXRlZCBvciBwcmVkZWZpbmVkIHBhdHRlcm4nKVxuXHRcdFx0fSxcblx0XHRcdFNjaGVtYXMuUHJvYmxlbVBhdHRlcm4sXG5cdFx0XHRTY2hlbWFzLk11bHRpTGluZVByb2JsZW1QYXR0ZXJuXG5cdFx0XSxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ1BhdHRlcm5UeXBlU2NoZW1hLmRlc2NyaXB0aW9uJywgJ0EgcHJvYmxlbSBwYXR0ZXJuIG9yIHRoZSBuYW1lIG9mIGEgY29udHJpYnV0ZWQgb3IgcHJlZGVmaW5lZCBwcm9ibGVtIHBhdHRlcm4uIENhbiBiZSBvbWl0dGVkIGlmIGJhc2UgaXMgc3BlY2lmaWVkLicpXG5cdH07XG5cblx0ZXhwb3J0IGNvbnN0IFByb2JsZW1NYXRjaGVyOiBJSlNPTlNjaGVtYSA9IHtcblx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0YmFzZToge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdQcm9ibGVtTWF0Y2hlclNjaGVtYS5iYXNlJywgJ1RoZSBuYW1lIG9mIGEgYmFzZSBwcm9ibGVtIG1hdGNoZXIgdG8gdXNlLicpXG5cdFx0XHR9LFxuXHRcdFx0b3duZXI6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnUHJvYmxlbU1hdGNoZXJTY2hlbWEub3duZXInLCAnVGhlIG93bmVyIG9mIHRoZSBwcm9ibGVtIGluc2lkZSBDb2RlLiBDYW4gYmUgb21pdHRlZCBpZiBiYXNlIGlzIHNwZWNpZmllZC4gRGVmYXVsdHMgdG8gXFwnZXh0ZXJuYWxcXCcgaWYgb21pdHRlZCBhbmQgYmFzZSBpcyBub3Qgc3BlY2lmaWVkLicpXG5cdFx0XHR9LFxuXHRcdFx0c291cmNlOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ1Byb2JsZW1NYXRjaGVyU2NoZW1hLnNvdXJjZScsICdBIGh1bWFuLXJlYWRhYmxlIHN0cmluZyBkZXNjcmliaW5nIHRoZSBzb3VyY2Ugb2YgdGhpcyBkaWFnbm9zdGljLCBlLmcuIFxcJ3R5cGVzY3JpcHRcXCcgb3IgXFwnc3VwZXIgbGludFxcJy4nKVxuXHRcdFx0fSxcblx0XHRcdHNldmVyaXR5OiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRlbnVtOiBbJ2Vycm9yJywgJ3dhcm5pbmcnLCAnaW5mbyddLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ1Byb2JsZW1NYXRjaGVyU2NoZW1hLnNldmVyaXR5JywgJ1RoZSBkZWZhdWx0IHNldmVyaXR5IGZvciBjYXB0dXJlcyBwcm9ibGVtcy4gSXMgdXNlZCBpZiB0aGUgcGF0dGVybiBkb2VzblxcJ3QgZGVmaW5lIGEgbWF0Y2ggZ3JvdXAgZm9yIHNldmVyaXR5LicpXG5cdFx0XHR9LFxuXHRcdFx0YXBwbHlUbzoge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0ZW51bTogWydhbGxEb2N1bWVudHMnLCAnb3BlbkRvY3VtZW50cycsICdjbG9zZWREb2N1bWVudHMnXSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdQcm9ibGVtTWF0Y2hlclNjaGVtYS5hcHBseVRvJywgJ0NvbnRyb2xzIGlmIGEgcHJvYmxlbSByZXBvcnRlZCBvbiBhIHRleHQgZG9jdW1lbnQgaXMgYXBwbGllZCBvbmx5IHRvIG9wZW4sIGNsb3NlZCBvciBhbGwgZG9jdW1lbnRzLicpXG5cdFx0XHR9LFxuXHRcdFx0cGF0dGVybjogUGF0dGVyblR5cGUsXG5cdFx0XHRmaWxlTG9jYXRpb246IHtcblx0XHRcdFx0b25lT2Y6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdGVudW06IFsnYWJzb2x1dGUnLCAncmVsYXRpdmUnLCAnYXV0b0RldGVjdCcsICdzZWFyY2gnXVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRcdHByZWZpeEl0ZW1zOiBbXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRlbnVtOiBbJ2Fic29sdXRlJywgJ3JlbGF0aXZlJywgJ2F1dG9EZXRlY3QnLCAnc2VhcmNoJ11cblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRtaW5JdGVtczogMSxcblx0XHRcdFx0XHRcdG1heEl0ZW1zOiAxLFxuXHRcdFx0XHRcdFx0YWRkaXRpb25hbEl0ZW1zOiBmYWxzZVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRcdHByZWZpeEl0ZW1zOiBbXG5cdFx0XHRcdFx0XHRcdHsgdHlwZTogJ3N0cmluZycsIGVudW06IFsncmVsYXRpdmUnLCAnYXV0b0RldGVjdCddIH0sXG5cdFx0XHRcdFx0XHRcdHsgdHlwZTogJ3N0cmluZycgfSxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRtaW5JdGVtczogMixcblx0XHRcdFx0XHRcdG1heEl0ZW1zOiAyLFxuXHRcdFx0XHRcdFx0YWRkaXRpb25hbEl0ZW1zOiBmYWxzZSxcblx0XHRcdFx0XHRcdGV4YW1wbGVzOiBbXG5cdFx0XHRcdFx0XHRcdFsncmVsYXRpdmUnLCAnJHt3b3Jrc3BhY2VGb2xkZXJ9J10sXG5cdFx0XHRcdFx0XHRcdFsnYXV0b0RldGVjdCcsICcke3dvcmtzcGFjZUZvbGRlcn0nXSxcblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0XHRwcmVmaXhJdGVtczogW1xuXHRcdFx0XHRcdFx0XHR7IHR5cGU6ICdzdHJpbmcnLCBlbnVtOiBbJ3NlYXJjaCddIH0sXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHQnaW5jbHVkZSc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0b25lT2Y6IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0eyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9IH1cblx0XHRcdFx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdCdleGNsdWRlJzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRvbmVPZjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHsgdHlwZTogJ3N0cmluZycgfSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0gfVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0cmVxdWlyZWQ6IFsnaW5jbHVkZSddXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRtaW5JdGVtczogMixcblx0XHRcdFx0XHRcdG1heEl0ZW1zOiAyLFxuXHRcdFx0XHRcdFx0YWRkaXRpb25hbEl0ZW1zOiBmYWxzZSxcblx0XHRcdFx0XHRcdGV4YW1wbGVzOiBbXG5cdFx0XHRcdFx0XHRcdFsnc2VhcmNoJywgeyAnaW5jbHVkZSc6IFsnJHt3b3Jrc3BhY2VGb2xkZXJ9J10gfV0sXG5cdFx0XHRcdFx0XHRcdFsnc2VhcmNoJywgeyAnaW5jbHVkZSc6IFsnJHt3b3Jrc3BhY2VGb2xkZXJ9J10sICdleGNsdWRlJzogW10gfV1cblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ1Byb2JsZW1NYXRjaGVyU2NoZW1hLmZpbGVMb2NhdGlvbicsICdEZWZpbmVzIGhvdyBmaWxlIG5hbWVzIHJlcG9ydGVkIGluIGEgcHJvYmxlbSBwYXR0ZXJuIHNob3VsZCBiZSBpbnRlcnByZXRlZC4gQSByZWxhdGl2ZSBmaWxlTG9jYXRpb24gbWF5IGJlIGFuIGFycmF5LCB3aGVyZSB0aGUgc2Vjb25kIGVsZW1lbnQgb2YgdGhlIGFycmF5IGlzIHRoZSBwYXRoIG9mIHRoZSByZWxhdGl2ZSBmaWxlIGxvY2F0aW9uLiBUaGUgc2VhcmNoIGZpbGVMb2NhdGlvbiBtb2RlLCBwZXJmb3JtcyBhIGRlZXAgKGFuZCwgcG9zc2libHksIGhlYXZ5KSBmaWxlIHN5c3RlbSBzZWFyY2ggd2l0aGluIHRoZSBkaXJlY3RvcmllcyBzcGVjaWZpZWQgYnkgdGhlIGluY2x1ZGUvZXhjbHVkZSBwcm9wZXJ0aWVzIG9mIHRoZSBzZWNvbmQgZWxlbWVudCAob3IgdGhlIGN1cnJlbnQgd29ya3NwYWNlIGRpcmVjdG9yeSBpZiBub3Qgc3BlY2lmaWVkKS4nKVxuXHRcdFx0fSxcblx0XHRcdGJhY2tncm91bmQ6IHtcblx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdQcm9ibGVtTWF0Y2hlclNjaGVtYS5iYWNrZ3JvdW5kJywgJ1BhdHRlcm5zIHRvIHRyYWNrIHRoZSBiZWdpbiBhbmQgZW5kIG9mIGEgbWF0Y2hlciBhY3RpdmUgb24gYSBiYWNrZ3JvdW5kIHRhc2suJyksXG5cdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRhY3RpdmVPblN0YXJ0OiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ1Byb2JsZW1NYXRjaGVyU2NoZW1hLmJhY2tncm91bmQuYWN0aXZlT25TdGFydCcsICdJZiBzZXQgdG8gdHJ1ZSB0aGUgYmFja2dyb3VuZCBtb25pdG9yIHN0YXJ0cyBpbiBhY3RpdmUgbW9kZS4gVGhpcyBpcyB0aGUgc2FtZSBhcyBvdXRwdXR0aW5nIGEgbGluZSB0aGF0IG1hdGNoZXMgYmVnaW5zUGF0dGVybiB3aGVuIHRoZSB0YXNrIHN0YXJ0cy4nKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0YmVnaW5zUGF0dGVybjoge1xuXHRcdFx0XHRcdFx0b25lT2Y6IFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFNjaGVtYXMuV2F0Y2hpbmdQYXR0ZXJuXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdQcm9ibGVtTWF0Y2hlclNjaGVtYS5iYWNrZ3JvdW5kLmJlZ2luc1BhdHRlcm4nLCAnSWYgbWF0Y2hlZCBpbiB0aGUgb3V0cHV0IHRoZSBzdGFydCBvZiBhIGJhY2tncm91bmQgdGFzayBpcyBzaWduYWxlZC4nKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0ZW5kc1BhdHRlcm46IHtcblx0XHRcdFx0XHRcdG9uZU9mOiBbXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRTY2hlbWFzLldhdGNoaW5nUGF0dGVyblxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnUHJvYmxlbU1hdGNoZXJTY2hlbWEuYmFja2dyb3VuZC5lbmRzUGF0dGVybicsICdJZiBtYXRjaGVkIGluIHRoZSBvdXRwdXQgdGhlIGVuZCBvZiBhIGJhY2tncm91bmQgdGFzayBpcyBzaWduYWxlZC4nKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHdhdGNoaW5nOiB7XG5cdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHRcdGRlcHJlY2F0aW9uTWVzc2FnZTogbG9jYWxpemUoJ1Byb2JsZW1NYXRjaGVyU2NoZW1hLndhdGNoaW5nLmRlcHJlY2F0ZWQnLCAnVGhlIHdhdGNoaW5nIHByb3BlcnR5IGlzIGRlcHJlY2F0ZWQuIFVzZSBiYWNrZ3JvdW5kIGluc3RlYWQuJyksXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnUHJvYmxlbU1hdGNoZXJTY2hlbWEud2F0Y2hpbmcnLCAnUGF0dGVybnMgdG8gdHJhY2sgdGhlIGJlZ2luIGFuZCBlbmQgb2YgYSB3YXRjaGluZyBtYXRjaGVyLicpLFxuXHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0YWN0aXZlT25TdGFydDoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdQcm9ibGVtTWF0Y2hlclNjaGVtYS53YXRjaGluZy5hY3RpdmVPblN0YXJ0JywgJ0lmIHNldCB0byB0cnVlIHRoZSB3YXRjaGVyIHN0YXJ0cyBpbiBhY3RpdmUgbW9kZS4gVGhpcyBpcyB0aGUgc2FtZSBhcyBvdXRwdXR0aW5nIGEgbGluZSB0aGF0IG1hdGNoZXMgYmVnaW5zUGF0dGVybiB3aGVuIHRoZSB0YXNrIHN0YXJ0cy4nKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0YmVnaW5zUGF0dGVybjoge1xuXHRcdFx0XHRcdFx0b25lT2Y6IFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFNjaGVtYXMuV2F0Y2hpbmdQYXR0ZXJuXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdQcm9ibGVtTWF0Y2hlclNjaGVtYS53YXRjaGluZy5iZWdpbnNQYXR0ZXJuJywgJ0lmIG1hdGNoZWQgaW4gdGhlIG91dHB1dCB0aGUgc3RhcnQgb2YgYSB3YXRjaGluZyB0YXNrIGlzIHNpZ25hbGVkLicpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRlbmRzUGF0dGVybjoge1xuXHRcdFx0XHRcdFx0b25lT2Y6IFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFNjaGVtYXMuV2F0Y2hpbmdQYXR0ZXJuXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdQcm9ibGVtTWF0Y2hlclNjaGVtYS53YXRjaGluZy5lbmRzUGF0dGVybicsICdJZiBtYXRjaGVkIGluIHRoZSBvdXRwdXQgdGhlIGVuZCBvZiBhIHdhdGNoaW5nIHRhc2sgaXMgc2lnbmFsZWQuJylcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH07XG5cblx0ZXhwb3J0IGNvbnN0IExlZ2FjeVByb2JsZW1NYXRjaGVyOiBJSlNPTlNjaGVtYSA9IE9iamVjdHMuZGVlcENsb25lKFByb2JsZW1NYXRjaGVyKTtcblx0TGVnYWN5UHJvYmxlbU1hdGNoZXIucHJvcGVydGllcyA9IE9iamVjdHMuZGVlcENsb25lKExlZ2FjeVByb2JsZW1NYXRjaGVyLnByb3BlcnRpZXMpIHx8IHt9O1xuXHRMZWdhY3lQcm9ibGVtTWF0Y2hlci5wcm9wZXJ0aWVzWyd3YXRjaGVkVGFza0JlZ2luc1JlZ0V4cCddID0ge1xuXHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdGRlcHJlY2F0aW9uTWVzc2FnZTogbG9jYWxpemUoJ0xlZ2FjeVByb2JsZW1NYXRjaGVyU2NoZW1hLndhdGNoZWRCZWdpbi5kZXByZWNhdGVkJywgJ1RoaXMgcHJvcGVydHkgaXMgZGVwcmVjYXRlZC4gVXNlIHRoZSB3YXRjaGluZyBwcm9wZXJ0eSBpbnN0ZWFkLicpLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnTGVnYWN5UHJvYmxlbU1hdGNoZXJTY2hlbWEud2F0Y2hlZEJlZ2luJywgJ0EgcmVndWxhciBleHByZXNzaW9uIHNpZ25hbGluZyB0aGF0IGEgd2F0Y2hlZCB0YXNrcyBiZWdpbnMgZXhlY3V0aW5nIHRyaWdnZXJlZCB0aHJvdWdoIGZpbGUgd2F0Y2hpbmcuJylcblx0fTtcblx0TGVnYWN5UHJvYmxlbU1hdGNoZXIucHJvcGVydGllc1snd2F0Y2hlZFRhc2tFbmRzUmVnRXhwJ10gPSB7XG5cdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0ZGVwcmVjYXRpb25NZXNzYWdlOiBsb2NhbGl6ZSgnTGVnYWN5UHJvYmxlbU1hdGNoZXJTY2hlbWEud2F0Y2hlZEVuZC5kZXByZWNhdGVkJywgJ1RoaXMgcHJvcGVydHkgaXMgZGVwcmVjYXRlZC4gVXNlIHRoZSB3YXRjaGluZyBwcm9wZXJ0eSBpbnN0ZWFkLicpLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnTGVnYWN5UHJvYmxlbU1hdGNoZXJTY2hlbWEud2F0Y2hlZEVuZCcsICdBIHJlZ3VsYXIgZXhwcmVzc2lvbiBzaWduYWxpbmcgdGhhdCBhIHdhdGNoZWQgdGFza3MgZW5kcyBleGVjdXRpbmcuJylcblx0fTtcblxuXHRleHBvcnQgY29uc3QgTmFtZWRQcm9ibGVtTWF0Y2hlcjogSUpTT05TY2hlbWEgPSBPYmplY3RzLmRlZXBDbG9uZShQcm9ibGVtTWF0Y2hlcik7XG5cdE5hbWVkUHJvYmxlbU1hdGNoZXIucHJvcGVydGllcyA9IE9iamVjdHMuZGVlcENsb25lKE5hbWVkUHJvYmxlbU1hdGNoZXIucHJvcGVydGllcykgfHwge307XG5cdE5hbWVkUHJvYmxlbU1hdGNoZXIucHJvcGVydGllcy5uYW1lID0ge1xuXHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnTmFtZWRQcm9ibGVtTWF0Y2hlclNjaGVtYS5uYW1lJywgJ1RoZSBuYW1lIG9mIHRoZSBwcm9ibGVtIG1hdGNoZXIgdXNlZCB0byByZWZlciB0byBpdC4nKVxuXHR9O1xuXHROYW1lZFByb2JsZW1NYXRjaGVyLnByb3BlcnRpZXMubGFiZWwgPSB7XG5cdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdOYW1lZFByb2JsZW1NYXRjaGVyU2NoZW1hLmxhYmVsJywgJ0EgaHVtYW4gcmVhZGFibGUgbGFiZWwgb2YgdGhlIHByb2JsZW0gbWF0Y2hlci4nKVxuXHR9O1xufVxuXG5jb25zdCBwcm9ibGVtUGF0dGVybkV4dFBvaW50ID0gRXh0ZW5zaW9uc1JlZ2lzdHJ5LnJlZ2lzdGVyRXh0ZW5zaW9uUG9pbnQ8Q29uZmlnLk5hbWVkUHJvYmxlbVBhdHRlcm5zPih7XG5cdGV4dGVuc2lvblBvaW50OiAncHJvYmxlbVBhdHRlcm5zJyxcblx0anNvblNjaGVtYToge1xuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnUHJvYmxlbVBhdHRlcm5FeHRQb2ludCcsICdDb250cmlidXRlcyBwcm9ibGVtIHBhdHRlcm5zJyksXG5cdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRpdGVtczoge1xuXHRcdFx0YW55T2Y6IFtcblx0XHRcdFx0U2NoZW1hcy5OYW1lZFByb2JsZW1QYXR0ZXJuLFxuXHRcdFx0XHRTY2hlbWFzLk5hbWVkTXVsdGlMaW5lUHJvYmxlbVBhdHRlcm5cblx0XHRcdF1cblx0XHR9XG5cdH1cbn0pO1xuXG5leHBvcnQgaW50ZXJmYWNlIElQcm9ibGVtUGF0dGVyblJlZ2lzdHJ5IHtcblx0b25SZWFkeSgpOiBQcm9taXNlPHZvaWQ+O1xuXG5cdGdldChrZXk6IHN0cmluZyk6IElQcm9ibGVtUGF0dGVybiB8IE11bHRpTGluZVByb2JsZW1QYXR0ZXJuO1xufVxuXG5jbGFzcyBQcm9ibGVtUGF0dGVyblJlZ2lzdHJ5SW1wbCBpbXBsZW1lbnRzIElQcm9ibGVtUGF0dGVyblJlZ2lzdHJ5IHtcblxuXHRwcml2YXRlIHBhdHRlcm5zOiBJU3RyaW5nRGljdGlvbmFyeTxJUHJvYmxlbVBhdHRlcm4gfCBJUHJvYmxlbVBhdHRlcm5bXT47XG5cdHByaXZhdGUgcmVhZHlQcm9taXNlOiBQcm9taXNlPHZvaWQ+O1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMucGF0dGVybnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdHRoaXMuZmlsbERlZmF1bHRzKCk7XG5cdFx0dGhpcy5yZWFkeVByb21pc2UgPSBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRwcm9ibGVtUGF0dGVybkV4dFBvaW50LnNldEhhbmRsZXIoKGV4dGVuc2lvbnMsIGRlbHRhKSA9PiB7XG5cdFx0XHRcdC8vIFdlIGdldCBhbGwgc3RhdGljYWxseSBrbm93IGV4dGVuc2lvbiBkdXJpbmcgc3RhcnR1cCBpbiBvbmUgYmF0Y2hcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRkZWx0YS5yZW1vdmVkLmZvckVhY2goZXh0ZW5zaW9uID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IHByb2JsZW1QYXR0ZXJucyA9IGV4dGVuc2lvbi52YWx1ZSBhcyBDb25maWcuTmFtZWRQcm9ibGVtUGF0dGVybnM7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHBhdHRlcm4gb2YgcHJvYmxlbVBhdHRlcm5zKSB7XG5cdFx0XHRcdFx0XHRcdGlmICh0aGlzLnBhdHRlcm5zW3BhdHRlcm4ubmFtZV0pIHtcblx0XHRcdFx0XHRcdFx0XHRkZWxldGUgdGhpcy5wYXR0ZXJuc1twYXR0ZXJuLm5hbWVdO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0ZGVsdGEuYWRkZWQuZm9yRWFjaChleHRlbnNpb24gPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgcHJvYmxlbVBhdHRlcm5zID0gZXh0ZW5zaW9uLnZhbHVlIGFzIENvbmZpZy5OYW1lZFByb2JsZW1QYXR0ZXJucztcblx0XHRcdFx0XHRcdGNvbnN0IHBhcnNlciA9IG5ldyBQcm9ibGVtUGF0dGVyblBhcnNlcihuZXcgRXh0ZW5zaW9uUmVnaXN0cnlSZXBvcnRlcihleHRlbnNpb24uY29sbGVjdG9yKSk7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHBhdHRlcm4gb2YgcHJvYmxlbVBhdHRlcm5zKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChDb25maWcuTmFtZWRNdWx0aUxpbmVDaGVja2VkUHJvYmxlbVBhdHRlcm4uaXMocGF0dGVybikpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSBwYXJzZXIucGFyc2UocGF0dGVybik7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHBhcnNlci5wcm9ibGVtUmVwb3J0ZXIuc3RhdHVzLnN0YXRlIDwgVmFsaWRhdGlvblN0YXRlLkVycm9yKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLmFkZChyZXN1bHQubmFtZSwgcmVzdWx0LnBhdHRlcm5zKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZXh0ZW5zaW9uLmNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgnUHJvYmxlbVBhdHRlcm5SZWdpc3RyeS5lcnJvcicsICdJbnZhbGlkIHByb2JsZW0gcGF0dGVybi4gVGhlIHBhdHRlcm4gd2lsbCBiZSBpZ25vcmVkLicpKTtcblx0XHRcdFx0XHRcdFx0XHRcdGV4dGVuc2lvbi5jb2xsZWN0b3IuZXJyb3IoSlNPTi5zdHJpbmdpZnkocGF0dGVybiwgdW5kZWZpbmVkLCA0KSk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGVsc2UgaWYgKENvbmZpZy5OYW1lZFByb2JsZW1QYXR0ZXJuLmlzKHBhdHRlcm4pKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gcGFyc2VyLnBhcnNlKHBhdHRlcm4pO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChwYXJzZXIucHJvYmxlbVJlcG9ydGVyLnN0YXR1cy5zdGF0ZSA8IFZhbGlkYXRpb25TdGF0ZS5FcnJvcikge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5hZGQocGF0dGVybi5uYW1lLCByZXN1bHQpO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRleHRlbnNpb24uY29sbGVjdG9yLmVycm9yKGxvY2FsaXplKCdQcm9ibGVtUGF0dGVyblJlZ2lzdHJ5LmVycm9yJywgJ0ludmFsaWQgcHJvYmxlbSBwYXR0ZXJuLiBUaGUgcGF0dGVybiB3aWxsIGJlIGlnbm9yZWQuJykpO1xuXHRcdFx0XHRcdFx0XHRcdFx0ZXh0ZW5zaW9uLmNvbGxlY3Rvci5lcnJvcihKU09OLnN0cmluZ2lmeShwYXR0ZXJuLCB1bmRlZmluZWQsIDQpKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cGFyc2VyLnJlc2V0KCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0Ly8gRG8gbm90aGluZ1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIG9uUmVhZHkoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMucmVhZHlQcm9taXNlO1xuXHR9XG5cblx0cHVibGljIGFkZChrZXk6IHN0cmluZywgdmFsdWU6IElQcm9ibGVtUGF0dGVybiB8IElQcm9ibGVtUGF0dGVybltdKTogdm9pZCB7XG5cdFx0dGhpcy5wYXR0ZXJuc1trZXldID0gdmFsdWU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0KGtleTogc3RyaW5nKTogSVByb2JsZW1QYXR0ZXJuIHwgSVByb2JsZW1QYXR0ZXJuW10ge1xuXHRcdHJldHVybiB0aGlzLnBhdHRlcm5zW2tleV07XG5cdH1cblxuXHRwcml2YXRlIGZpbGxEZWZhdWx0cygpOiB2b2lkIHtcblx0XHR0aGlzLmFkZCgnbXNDb21waWxlJywge1xuXHRcdFx0cmVnZXhwOiAvXig/OlxccypcXGQrPik/KFxcUy4qKVxcKChcXGQrfFxcZCssXFxkK3xcXGQrLFxcZCssXFxkKyxcXGQrKVxcKVxccyo6XFxzKygoPzpmYXRhbCArKT9lcnJvcnx3YXJuaW5nfGluZm8pXFxzKyhcXHcrXFxkKylcXHMqOlxccyooLiopJC8sXG5cdFx0XHRraW5kOiBQcm9ibGVtTG9jYXRpb25LaW5kLkxvY2F0aW9uLFxuXHRcdFx0ZmlsZTogMSxcblx0XHRcdGxvY2F0aW9uOiAyLFxuXHRcdFx0c2V2ZXJpdHk6IDMsXG5cdFx0XHRjb2RlOiA0LFxuXHRcdFx0bWVzc2FnZTogNVxuXHRcdH0pO1xuXHRcdHRoaXMuYWRkKCdndWxwLXRzYycsIHtcblx0XHRcdHJlZ2V4cDogL14oW15cXHNdLiopXFwoKFxcZCt8XFxkKyxcXGQrfFxcZCssXFxkKyxcXGQrLFxcZCspXFwpOlxccysoXFxkKylcXHMrKC4qKSQvLFxuXHRcdFx0a2luZDogUHJvYmxlbUxvY2F0aW9uS2luZC5Mb2NhdGlvbixcblx0XHRcdGZpbGU6IDEsXG5cdFx0XHRsb2NhdGlvbjogMixcblx0XHRcdGNvZGU6IDMsXG5cdFx0XHRtZXNzYWdlOiA0XG5cdFx0fSk7XG5cdFx0dGhpcy5hZGQoJ2NwcCcsIHtcblx0XHRcdHJlZ2V4cDogL14oXFxTLiopXFwoKFxcZCt8XFxkKyxcXGQrfFxcZCssXFxkKyxcXGQrLFxcZCspXFwpOlxccysoZXJyb3J8d2FybmluZ3xpbmZvKVxccysoQ1xcZCspXFxzKjpcXHMqKC4qKSQvLFxuXHRcdFx0a2luZDogUHJvYmxlbUxvY2F0aW9uS2luZC5Mb2NhdGlvbixcblx0XHRcdGZpbGU6IDEsXG5cdFx0XHRsb2NhdGlvbjogMixcblx0XHRcdHNldmVyaXR5OiAzLFxuXHRcdFx0Y29kZTogNCxcblx0XHRcdG1lc3NhZ2U6IDVcblx0XHR9KTtcblx0XHR0aGlzLmFkZCgnY3NjJywge1xuXHRcdFx0cmVnZXhwOiAvXihcXFMuKilcXCgoXFxkK3xcXGQrLFxcZCt8XFxkKyxcXGQrLFxcZCssXFxkKylcXCk6XFxzKyhlcnJvcnx3YXJuaW5nfGluZm8pXFxzKyhDU1xcZCspXFxzKjpcXHMqKC4qKSQvLFxuXHRcdFx0a2luZDogUHJvYmxlbUxvY2F0aW9uS2luZC5Mb2NhdGlvbixcblx0XHRcdGZpbGU6IDEsXG5cdFx0XHRsb2NhdGlvbjogMixcblx0XHRcdHNldmVyaXR5OiAzLFxuXHRcdFx0Y29kZTogNCxcblx0XHRcdG1lc3NhZ2U6IDVcblx0XHR9KTtcblx0XHR0aGlzLmFkZCgndmInLCB7XG5cdFx0XHRyZWdleHA6IC9eKFxcUy4qKVxcKChcXGQrfFxcZCssXFxkK3xcXGQrLFxcZCssXFxkKyxcXGQrKVxcKTpcXHMrKGVycm9yfHdhcm5pbmd8aW5mbylcXHMrKEJDXFxkKylcXHMqOlxccyooLiopJC8sXG5cdFx0XHRraW5kOiBQcm9ibGVtTG9jYXRpb25LaW5kLkxvY2F0aW9uLFxuXHRcdFx0ZmlsZTogMSxcblx0XHRcdGxvY2F0aW9uOiAyLFxuXHRcdFx0c2V2ZXJpdHk6IDMsXG5cdFx0XHRjb2RlOiA0LFxuXHRcdFx0bWVzc2FnZTogNVxuXHRcdH0pO1xuXHRcdHRoaXMuYWRkKCdsZXNzQ29tcGlsZScsIHtcblx0XHRcdHJlZ2V4cDogL15cXHMqKC4qKSBpbiBmaWxlICguKikgbGluZSBuby4gKFxcZCspJC8sXG5cdFx0XHRraW5kOiBQcm9ibGVtTG9jYXRpb25LaW5kLkxvY2F0aW9uLFxuXHRcdFx0bWVzc2FnZTogMSxcblx0XHRcdGZpbGU6IDIsXG5cdFx0XHRsaW5lOiAzXG5cdFx0fSk7XG5cdFx0dGhpcy5hZGQoJ2pzaGludCcsIHtcblx0XHRcdHJlZ2V4cDogL14oLiopOlxccytsaW5lXFxzKyhcXGQrKSxcXHMrY29sXFxzKyhcXGQrKSxcXHMoLis/KSg/OlxccytcXCgoXFx3KShcXGQrKVxcKSk/JC8sXG5cdFx0XHRraW5kOiBQcm9ibGVtTG9jYXRpb25LaW5kLkxvY2F0aW9uLFxuXHRcdFx0ZmlsZTogMSxcblx0XHRcdGxpbmU6IDIsXG5cdFx0XHRjaGFyYWN0ZXI6IDMsXG5cdFx0XHRtZXNzYWdlOiA0LFxuXHRcdFx0c2V2ZXJpdHk6IDUsXG5cdFx0XHRjb2RlOiA2XG5cdFx0fSk7XG5cdFx0dGhpcy5hZGQoJ2pzaGludC1zdHlsaXNoJywgW1xuXHRcdFx0e1xuXHRcdFx0XHRyZWdleHA6IC9eKC4rKSQvLFxuXHRcdFx0XHRraW5kOiBQcm9ibGVtTG9jYXRpb25LaW5kLkxvY2F0aW9uLFxuXHRcdFx0XHRmaWxlOiAxXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRyZWdleHA6IC9eXFxzK2xpbmVcXHMrKFxcZCspXFxzK2NvbFxccysoXFxkKylcXHMrKC4rPykoPzpcXHMrXFwoKFxcdykoXFxkKylcXCkpPyQvLFxuXHRcdFx0XHRsaW5lOiAxLFxuXHRcdFx0XHRjaGFyYWN0ZXI6IDIsXG5cdFx0XHRcdG1lc3NhZ2U6IDMsXG5cdFx0XHRcdHNldmVyaXR5OiA0LFxuXHRcdFx0XHRjb2RlOiA1LFxuXHRcdFx0XHRsb29wOiB0cnVlXG5cdFx0XHR9XG5cdFx0XSk7XG5cdFx0dGhpcy5hZGQoJ2VzbGludC1jb21wYWN0Jywge1xuXHRcdFx0cmVnZXhwOiAvXiguKyk6XFxzbGluZVxccyhcXGQrKSxcXHNjb2xcXHMoXFxkKyksXFxzKEVycm9yfFdhcm5pbmd8SW5mbylcXHMtXFxzKC4rKVxcc1xcKCguKylcXCkkLyxcblx0XHRcdGZpbGU6IDEsXG5cdFx0XHRraW5kOiBQcm9ibGVtTG9jYXRpb25LaW5kLkxvY2F0aW9uLFxuXHRcdFx0bGluZTogMixcblx0XHRcdGNoYXJhY3RlcjogMyxcblx0XHRcdHNldmVyaXR5OiA0LFxuXHRcdFx0bWVzc2FnZTogNSxcblx0XHRcdGNvZGU6IDZcblx0XHR9KTtcblx0XHR0aGlzLmFkZCgnZXNsaW50LXN0eWxpc2gnLCBbXG5cdFx0XHR7XG5cdFx0XHRcdHJlZ2V4cDogL14oKD86W2EtekEtWl06KSpbLi9cXFxcXSsuKj8pJC8sXG5cdFx0XHRcdGtpbmQ6IFByb2JsZW1Mb2NhdGlvbktpbmQuTG9jYXRpb24sXG5cdFx0XHRcdGZpbGU6IDFcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdHJlZ2V4cDogL15cXHMrKFxcZCspOihcXGQrKVxccysoZXJyb3J8d2FybmluZ3xpbmZvKVxccysoLis/KSg/Olxcc1xccysoLiopKT8kLyxcblx0XHRcdFx0bGluZTogMSxcblx0XHRcdFx0Y2hhcmFjdGVyOiAyLFxuXHRcdFx0XHRzZXZlcml0eTogMyxcblx0XHRcdFx0bWVzc2FnZTogNCxcblx0XHRcdFx0Y29kZTogNSxcblx0XHRcdFx0bG9vcDogdHJ1ZVxuXHRcdFx0fVxuXHRcdF0pO1xuXHRcdHRoaXMuYWRkKCdnbycsIHtcblx0XHRcdHJlZ2V4cDogL14oW146XSo6ICk/KCguOik/W146XSopOihcXGQrKSg6KFxcZCspKT86ICguKikkLyxcblx0XHRcdGtpbmQ6IFByb2JsZW1Mb2NhdGlvbktpbmQuTG9jYXRpb24sXG5cdFx0XHRmaWxlOiAyLFxuXHRcdFx0bGluZTogNCxcblx0XHRcdGNoYXJhY3RlcjogNixcblx0XHRcdG1lc3NhZ2U6IDdcblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgUHJvYmxlbVBhdHRlcm5SZWdpc3RyeTogSVByb2JsZW1QYXR0ZXJuUmVnaXN0cnkgPSBuZXcgUHJvYmxlbVBhdHRlcm5SZWdpc3RyeUltcGwoKTtcblxuZXhwb3J0IGNsYXNzIFByb2JsZW1NYXRjaGVyUGFyc2VyIGV4dGVuZHMgUGFyc2VyIHtcblxuXHRjb25zdHJ1Y3Rvcihsb2dnZXI6IElQcm9ibGVtUmVwb3J0ZXIpIHtcblx0XHRzdXBlcihsb2dnZXIpO1xuXHR9XG5cblx0cHVibGljIHBhcnNlKGpzb246IENvbmZpZy5Qcm9ibGVtTWF0Y2hlcik6IFByb2JsZW1NYXRjaGVyIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLmNyZWF0ZVByb2JsZW1NYXRjaGVyKGpzb24pO1xuXHRcdGlmICghdGhpcy5jaGVja1Byb2JsZW1NYXRjaGVyVmFsaWQoanNvbiwgcmVzdWx0KSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0dGhpcy5hZGRXYXRjaGluZ01hdGNoZXIoanNvbiwgcmVzdWx0KTtcblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGNoZWNrUHJvYmxlbU1hdGNoZXJWYWxpZChleHRlcm5hbFByb2JsZW1NYXRjaGVyOiBDb25maWcuUHJvYmxlbU1hdGNoZXIsIHByb2JsZW1NYXRjaGVyOiBQcm9ibGVtTWF0Y2hlciB8IG51bGwpOiBwcm9ibGVtTWF0Y2hlciBpcyBQcm9ibGVtTWF0Y2hlciB7XG5cdFx0aWYgKCFwcm9ibGVtTWF0Y2hlcikge1xuXHRcdFx0dGhpcy5lcnJvcihsb2NhbGl6ZSgnUHJvYmxlbU1hdGNoZXJQYXJzZXIubm9Qcm9ibGVtTWF0Y2hlcicsICdFcnJvcjogdGhlIGRlc2NyaXB0aW9uIGNhblxcJ3QgYmUgY29udmVydGVkIGludG8gYSBwcm9ibGVtIG1hdGNoZXI6XFxuezB9XFxuJywgSlNPTi5zdHJpbmdpZnkoZXh0ZXJuYWxQcm9ibGVtTWF0Y2hlciwgbnVsbCwgNCkpKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCFwcm9ibGVtTWF0Y2hlci5wYXR0ZXJuKSB7XG5cdFx0XHR0aGlzLmVycm9yKGxvY2FsaXplKCdQcm9ibGVtTWF0Y2hlclBhcnNlci5ub1Byb2JsZW1QYXR0ZXJuJywgJ0Vycm9yOiB0aGUgZGVzY3JpcHRpb24gZG9lc25cXCd0IGRlZmluZSBhIHZhbGlkIHByb2JsZW0gcGF0dGVybjpcXG57MH1cXG4nLCBKU09OLnN0cmluZ2lmeShleHRlcm5hbFByb2JsZW1NYXRjaGVyLCBudWxsLCA0KSkpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoIXByb2JsZW1NYXRjaGVyLm93bmVyKSB7XG5cdFx0XHR0aGlzLmVycm9yKGxvY2FsaXplKCdQcm9ibGVtTWF0Y2hlclBhcnNlci5ub093bmVyJywgJ0Vycm9yOiB0aGUgZGVzY3JpcHRpb24gZG9lc25cXCd0IGRlZmluZSBhbiBvd25lcjpcXG57MH1cXG4nLCBKU09OLnN0cmluZ2lmeShleHRlcm5hbFByb2JsZW1NYXRjaGVyLCBudWxsLCA0KSkpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoVHlwZXMuaXNVbmRlZmluZWQocHJvYmxlbU1hdGNoZXIuZmlsZUxvY2F0aW9uKSkge1xuXHRcdFx0dGhpcy5lcnJvcihsb2NhbGl6ZSgnUHJvYmxlbU1hdGNoZXJQYXJzZXIubm9GaWxlTG9jYXRpb24nLCAnRXJyb3I6IHRoZSBkZXNjcmlwdGlvbiBkb2VzblxcJ3QgZGVmaW5lIGEgZmlsZSBsb2NhdGlvbjpcXG57MH1cXG4nLCBKU09OLnN0cmluZ2lmeShleHRlcm5hbFByb2JsZW1NYXRjaGVyLCBudWxsLCA0KSkpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlUHJvYmxlbU1hdGNoZXIoZGVzY3JpcHRpb246IENvbmZpZy5Qcm9ibGVtTWF0Y2hlcik6IFByb2JsZW1NYXRjaGVyIHwgbnVsbCB7XG5cdFx0bGV0IHJlc3VsdDogUHJvYmxlbU1hdGNoZXIgfCBudWxsID0gbnVsbDtcblxuXHRcdGNvbnN0IG93bmVyID0gVHlwZXMuaXNTdHJpbmcoZGVzY3JpcHRpb24ub3duZXIpID8gZGVzY3JpcHRpb24ub3duZXIgOiBVVUlELmdlbmVyYXRlVXVpZCgpO1xuXHRcdGNvbnN0IHNvdXJjZSA9IFR5cGVzLmlzU3RyaW5nKGRlc2NyaXB0aW9uLnNvdXJjZSkgPyBkZXNjcmlwdGlvbi5zb3VyY2UgOiB1bmRlZmluZWQ7XG5cdFx0bGV0IGFwcGx5VG8gPSBUeXBlcy5pc1N0cmluZyhkZXNjcmlwdGlvbi5hcHBseVRvKSA/IEFwcGx5VG9LaW5kLmZyb21TdHJpbmcoZGVzY3JpcHRpb24uYXBwbHlUbykgOiBBcHBseVRvS2luZC5hbGxEb2N1bWVudHM7XG5cdFx0aWYgKCFhcHBseVRvKSB7XG5cdFx0XHRhcHBseVRvID0gQXBwbHlUb0tpbmQuYWxsRG9jdW1lbnRzO1xuXHRcdH1cblx0XHRsZXQgZmlsZUxvY2F0aW9uOiBGaWxlTG9jYXRpb25LaW5kIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGxldCBmaWxlUHJlZml4OiBzdHJpbmcgfCBDb25maWcuU2VhcmNoRmlsZUxvY2F0aW9uQXJncyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdGxldCBraW5kOiBGaWxlTG9jYXRpb25LaW5kIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChUeXBlcy5pc1VuZGVmaW5lZChkZXNjcmlwdGlvbi5maWxlTG9jYXRpb24pKSB7XG5cdFx0XHRmaWxlTG9jYXRpb24gPSBGaWxlTG9jYXRpb25LaW5kLlJlbGF0aXZlO1xuXHRcdFx0ZmlsZVByZWZpeCA9ICcke3dvcmtzcGFjZUZvbGRlcn0nO1xuXHRcdH0gZWxzZSBpZiAoVHlwZXMuaXNTdHJpbmcoZGVzY3JpcHRpb24uZmlsZUxvY2F0aW9uKSkge1xuXHRcdFx0a2luZCA9IEZpbGVMb2NhdGlvbktpbmQuZnJvbVN0cmluZyg8c3RyaW5nPmRlc2NyaXB0aW9uLmZpbGVMb2NhdGlvbik7XG5cdFx0XHRpZiAoa2luZCkge1xuXHRcdFx0XHRmaWxlTG9jYXRpb24gPSBraW5kO1xuXHRcdFx0XHRpZiAoKGtpbmQgPT09IEZpbGVMb2NhdGlvbktpbmQuUmVsYXRpdmUpIHx8IChraW5kID09PSBGaWxlTG9jYXRpb25LaW5kLkF1dG9EZXRlY3QpKSB7XG5cdFx0XHRcdFx0ZmlsZVByZWZpeCA9ICcke3dvcmtzcGFjZUZvbGRlcn0nO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGtpbmQgPT09IEZpbGVMb2NhdGlvbktpbmQuU2VhcmNoKSB7XG5cdFx0XHRcdFx0ZmlsZVByZWZpeCA9IHsgaW5jbHVkZTogWycke3dvcmtzcGFjZUZvbGRlcn0nXSB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChUeXBlcy5pc1N0cmluZ0FycmF5KGRlc2NyaXB0aW9uLmZpbGVMb2NhdGlvbikpIHtcblx0XHRcdGNvbnN0IHZhbHVlcyA9IDxzdHJpbmdbXT5kZXNjcmlwdGlvbi5maWxlTG9jYXRpb247XG5cdFx0XHRpZiAodmFsdWVzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0a2luZCA9IEZpbGVMb2NhdGlvbktpbmQuZnJvbVN0cmluZyh2YWx1ZXNbMF0pO1xuXHRcdFx0XHRpZiAodmFsdWVzLmxlbmd0aCA9PT0gMSAmJiBraW5kID09PSBGaWxlTG9jYXRpb25LaW5kLkFic29sdXRlKSB7XG5cdFx0XHRcdFx0ZmlsZUxvY2F0aW9uID0ga2luZDtcblx0XHRcdFx0fSBlbHNlIGlmICh2YWx1ZXMubGVuZ3RoID09PSAyICYmIChraW5kID09PSBGaWxlTG9jYXRpb25LaW5kLlJlbGF0aXZlIHx8IGtpbmQgPT09IEZpbGVMb2NhdGlvbktpbmQuQXV0b0RldGVjdCkgJiYgdmFsdWVzWzFdKSB7XG5cdFx0XHRcdFx0ZmlsZUxvY2F0aW9uID0ga2luZDtcblx0XHRcdFx0XHRmaWxlUHJlZml4ID0gdmFsdWVzWzFdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGRlc2NyaXB0aW9uLmZpbGVMb2NhdGlvbikpIHtcblx0XHRcdGNvbnN0IGtpbmQgPSBGaWxlTG9jYXRpb25LaW5kLmZyb21TdHJpbmcoZGVzY3JpcHRpb24uZmlsZUxvY2F0aW9uWzBdKTtcblx0XHRcdGlmIChraW5kID09PSBGaWxlTG9jYXRpb25LaW5kLlNlYXJjaCkge1xuXHRcdFx0XHRmaWxlTG9jYXRpb24gPSBGaWxlTG9jYXRpb25LaW5kLlNlYXJjaDtcblx0XHRcdFx0ZmlsZVByZWZpeCA9IGRlc2NyaXB0aW9uLmZpbGVMb2NhdGlvblsxXSA/PyB7IGluY2x1ZGU6IFsnJHt3b3Jrc3BhY2VGb2xkZXJ9J10gfTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBwYXR0ZXJuID0gZGVzY3JpcHRpb24ucGF0dGVybiA/IHRoaXMuY3JlYXRlUHJvYmxlbVBhdHRlcm4oZGVzY3JpcHRpb24ucGF0dGVybikgOiB1bmRlZmluZWQ7XG5cblx0XHRsZXQgc2V2ZXJpdHkgPSBkZXNjcmlwdGlvbi5zZXZlcml0eSA/IFNldmVyaXR5LmZyb21WYWx1ZShkZXNjcmlwdGlvbi5zZXZlcml0eSkgOiB1bmRlZmluZWQ7XG5cdFx0aWYgKHNldmVyaXR5ID09PSBTZXZlcml0eS5JZ25vcmUpIHtcblx0XHRcdHRoaXMuaW5mbyhsb2NhbGl6ZSgnUHJvYmxlbU1hdGNoZXJQYXJzZXIudW5rbm93blNldmVyaXR5JywgJ0luZm86IHVua25vd24gc2V2ZXJpdHkgezB9LiBWYWxpZCB2YWx1ZXMgYXJlIGVycm9yLCB3YXJuaW5nIGFuZCBpbmZvLlxcbicsIGRlc2NyaXB0aW9uLnNldmVyaXR5KSk7XG5cdFx0XHRzZXZlcml0eSA9IFNldmVyaXR5LkVycm9yO1xuXHRcdH1cblxuXHRcdGlmIChUeXBlcy5pc1N0cmluZyhkZXNjcmlwdGlvbi5iYXNlKSkge1xuXHRcdFx0Y29uc3QgdmFyaWFibGVOYW1lID0gPHN0cmluZz5kZXNjcmlwdGlvbi5iYXNlO1xuXHRcdFx0aWYgKHZhcmlhYmxlTmFtZS5sZW5ndGggPiAxICYmIHZhcmlhYmxlTmFtZVswXSA9PT0gJyQnKSB7XG5cdFx0XHRcdGNvbnN0IGJhc2UgPSBQcm9ibGVtTWF0Y2hlclJlZ2lzdHJ5LmdldCh2YXJpYWJsZU5hbWUuc3Vic3RyaW5nKDEpKTtcblx0XHRcdFx0aWYgKGJhc2UpIHtcblx0XHRcdFx0XHRyZXN1bHQgPSBPYmplY3RzLmRlZXBDbG9uZShiYXNlKTtcblx0XHRcdFx0XHRpZiAoZGVzY3JpcHRpb24ub3duZXIgIT09IHVuZGVmaW5lZCAmJiBvd25lciAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQub3duZXIgPSBvd25lcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGRlc2NyaXB0aW9uLnNvdXJjZSAhPT0gdW5kZWZpbmVkICYmIHNvdXJjZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQuc291cmNlID0gc291cmNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoZGVzY3JpcHRpb24uZmlsZUxvY2F0aW9uICE9PSB1bmRlZmluZWQgJiYgZmlsZUxvY2F0aW9uICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdHJlc3VsdC5maWxlTG9jYXRpb24gPSBmaWxlTG9jYXRpb247XG5cdFx0XHRcdFx0XHRyZXN1bHQuZmlsZVByZWZpeCA9IGZpbGVQcmVmaXg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChkZXNjcmlwdGlvbi5wYXR0ZXJuICE9PSB1bmRlZmluZWQgJiYgcGF0dGVybiAhPT0gdW5kZWZpbmVkICYmIHBhdHRlcm4gIT09IG51bGwpIHtcblx0XHRcdFx0XHRcdHJlc3VsdC5wYXR0ZXJuID0gcGF0dGVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGRlc2NyaXB0aW9uLnNldmVyaXR5ICE9PSB1bmRlZmluZWQgJiYgc2V2ZXJpdHkgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0cmVzdWx0LnNldmVyaXR5ID0gc2V2ZXJpdHk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChkZXNjcmlwdGlvbi5hcHBseVRvICE9PSB1bmRlZmluZWQgJiYgYXBwbHlUbyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQuYXBwbHlUbyA9IGFwcGx5VG87XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChmaWxlTG9jYXRpb24gJiYgcGF0dGVybikge1xuXHRcdFx0cmVzdWx0ID0ge1xuXHRcdFx0XHRvd25lcjogb3duZXIsXG5cdFx0XHRcdGFwcGx5VG86IGFwcGx5VG8sXG5cdFx0XHRcdGZpbGVMb2NhdGlvbjogZmlsZUxvY2F0aW9uLFxuXHRcdFx0XHRwYXR0ZXJuOiBwYXR0ZXJuLFxuXHRcdFx0fTtcblx0XHRcdGlmIChzb3VyY2UpIHtcblx0XHRcdFx0cmVzdWx0LnNvdXJjZSA9IHNvdXJjZTtcblx0XHRcdH1cblx0XHRcdGlmIChmaWxlUHJlZml4KSB7XG5cdFx0XHRcdHJlc3VsdC5maWxlUHJlZml4ID0gZmlsZVByZWZpeDtcblx0XHRcdH1cblx0XHRcdGlmIChzZXZlcml0eSkge1xuXHRcdFx0XHRyZXN1bHQuc2V2ZXJpdHkgPSBzZXZlcml0eTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKENvbmZpZy5pc05hbWVkUHJvYmxlbU1hdGNoZXIoZGVzY3JpcHRpb24pKSB7XG5cdFx0XHQocmVzdWx0IGFzIElOYW1lZFByb2JsZW1NYXRjaGVyKS5uYW1lID0gZGVzY3JpcHRpb24ubmFtZTtcblx0XHRcdChyZXN1bHQgYXMgSU5hbWVkUHJvYmxlbU1hdGNoZXIpLmxhYmVsID0gVHlwZXMuaXNTdHJpbmcoZGVzY3JpcHRpb24ubGFiZWwpID8gZGVzY3JpcHRpb24ubGFiZWwgOiBkZXNjcmlwdGlvbi5uYW1lO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVQcm9ibGVtUGF0dGVybih2YWx1ZTogc3RyaW5nIHwgQ29uZmlnLklQcm9ibGVtUGF0dGVybiB8IENvbmZpZy5NdWx0aUxpbmVQcm9ibGVtUGF0dGVybik6IElQcm9ibGVtUGF0dGVybiB8IElQcm9ibGVtUGF0dGVybltdIHwgbnVsbCB7XG5cdFx0aWYgKFR5cGVzLmlzU3RyaW5nKHZhbHVlKSkge1xuXHRcdFx0Y29uc3QgdmFyaWFibGVOYW1lOiBzdHJpbmcgPSA8c3RyaW5nPnZhbHVlO1xuXHRcdFx0aWYgKHZhcmlhYmxlTmFtZS5sZW5ndGggPiAxICYmIHZhcmlhYmxlTmFtZVswXSA9PT0gJyQnKSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IFByb2JsZW1QYXR0ZXJuUmVnaXN0cnkuZ2V0KHZhcmlhYmxlTmFtZS5zdWJzdHJpbmcoMSkpO1xuXHRcdFx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0XHRcdHRoaXMuZXJyb3IobG9jYWxpemUoJ1Byb2JsZW1NYXRjaGVyUGFyc2VyLm5vRGVmaW5lZFBhdHRlcicsICdFcnJvcjogdGhlIHBhdHRlcm4gd2l0aCB0aGUgaWRlbnRpZmllciB7MH0gZG9lc25cXCd0IGV4aXN0LicsIHZhcmlhYmxlTmFtZSkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAodmFyaWFibGVOYW1lLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdHRoaXMuZXJyb3IobG9jYWxpemUoJ1Byb2JsZW1NYXRjaGVyUGFyc2VyLm5vSWRlbnRpZmllcicsICdFcnJvcjogdGhlIHBhdHRlcm4gcHJvcGVydHkgcmVmZXJzIHRvIGFuIGVtcHR5IGlkZW50aWZpZXIuJykpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuZXJyb3IobG9jYWxpemUoJ1Byb2JsZW1NYXRjaGVyUGFyc2VyLm5vVmFsaWRJZGVudGlmaWVyJywgJ0Vycm9yOiB0aGUgcGF0dGVybiBwcm9wZXJ0eSB7MH0gaXMgbm90IGEgdmFsaWQgcGF0dGVybiB2YXJpYWJsZSBuYW1lLicsIHZhcmlhYmxlTmFtZSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh2YWx1ZSkge1xuXHRcdFx0Y29uc3QgcHJvYmxlbVBhdHRlcm5QYXJzZXIgPSBuZXcgUHJvYmxlbVBhdHRlcm5QYXJzZXIodGhpcy5wcm9ibGVtUmVwb3J0ZXIpO1xuXHRcdFx0aWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG5cdFx0XHRcdHJldHVybiBwcm9ibGVtUGF0dGVyblBhcnNlci5wYXJzZSh2YWx1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gcHJvYmxlbVBhdHRlcm5QYXJzZXIucGFyc2UodmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgYWRkV2F0Y2hpbmdNYXRjaGVyKGV4dGVybmFsOiBDb25maWcuUHJvYmxlbU1hdGNoZXIsIGludGVybmFsOiBQcm9ibGVtTWF0Y2hlcik6IHZvaWQge1xuXHRcdGNvbnN0IG9sZEJlZ2lucyA9IHRoaXMuY3JlYXRlUmVndWxhckV4cHJlc3Npb24oZXh0ZXJuYWwud2F0Y2hlZFRhc2tCZWdpbnNSZWdFeHApO1xuXHRcdGNvbnN0IG9sZEVuZHMgPSB0aGlzLmNyZWF0ZVJlZ3VsYXJFeHByZXNzaW9uKGV4dGVybmFsLndhdGNoZWRUYXNrRW5kc1JlZ0V4cCk7XG5cdFx0aWYgKG9sZEJlZ2lucyAmJiBvbGRFbmRzKSB7XG5cdFx0XHRpbnRlcm5hbC53YXRjaGluZyA9IHtcblx0XHRcdFx0YWN0aXZlT25TdGFydDogZmFsc2UsXG5cdFx0XHRcdGJlZ2luc1BhdHRlcm46IHsgcmVnZXhwOiBvbGRCZWdpbnMgfSxcblx0XHRcdFx0ZW5kc1BhdHRlcm46IHsgcmVnZXhwOiBvbGRFbmRzIH1cblx0XHRcdH07XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGJhY2tncm91bmRNb25pdG9yID0gZXh0ZXJuYWwuYmFja2dyb3VuZCB8fCBleHRlcm5hbC53YXRjaGluZztcblx0XHRpZiAoVHlwZXMuaXNVbmRlZmluZWRPck51bGwoYmFja2dyb3VuZE1vbml0b3IpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGJlZ2luczogSVdhdGNoaW5nUGF0dGVybiB8IG51bGwgPSB0aGlzLmNyZWF0ZVdhdGNoaW5nUGF0dGVybihiYWNrZ3JvdW5kTW9uaXRvci5iZWdpbnNQYXR0ZXJuKTtcblx0XHRjb25zdCBlbmRzOiBJV2F0Y2hpbmdQYXR0ZXJuIHwgbnVsbCA9IHRoaXMuY3JlYXRlV2F0Y2hpbmdQYXR0ZXJuKGJhY2tncm91bmRNb25pdG9yLmVuZHNQYXR0ZXJuKTtcblx0XHRpZiAoYmVnaW5zICYmIGVuZHMpIHtcblx0XHRcdGludGVybmFsLndhdGNoaW5nID0ge1xuXHRcdFx0XHRhY3RpdmVPblN0YXJ0OiBUeXBlcy5pc0Jvb2xlYW4oYmFja2dyb3VuZE1vbml0b3IuYWN0aXZlT25TdGFydCkgPyBiYWNrZ3JvdW5kTW9uaXRvci5hY3RpdmVPblN0YXJ0IDogZmFsc2UsXG5cdFx0XHRcdGJlZ2luc1BhdHRlcm46IGJlZ2lucyxcblx0XHRcdFx0ZW5kc1BhdHRlcm46IGVuZHNcblx0XHRcdH07XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChiZWdpbnMgfHwgZW5kcykge1xuXHRcdFx0dGhpcy5lcnJvcihsb2NhbGl6ZSgnUHJvYmxlbU1hdGNoZXJQYXJzZXIucHJvYmxlbVBhdHRlcm4ud2F0Y2hpbmdNYXRjaGVyJywgJ0EgcHJvYmxlbSBtYXRjaGVyIG11c3QgZGVmaW5lIGJvdGggYSBiZWdpbiBwYXR0ZXJuIGFuZCBhbiBlbmQgcGF0dGVybiBmb3Igd2F0Y2hpbmcuJykpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlV2F0Y2hpbmdQYXR0ZXJuKGV4dGVybmFsOiBzdHJpbmcgfCBDb25maWcuSVdhdGNoaW5nUGF0dGVybiB8IHVuZGVmaW5lZCk6IElXYXRjaGluZ1BhdHRlcm4gfCBudWxsIHtcblx0XHRpZiAoVHlwZXMuaXNVbmRlZmluZWRPck51bGwoZXh0ZXJuYWwpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0bGV0IHJlZ2V4cDogUmVnRXhwIHwgbnVsbDtcblx0XHRsZXQgZmlsZTogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChUeXBlcy5pc1N0cmluZyhleHRlcm5hbCkpIHtcblx0XHRcdHJlZ2V4cCA9IHRoaXMuY3JlYXRlUmVndWxhckV4cHJlc3Npb24oZXh0ZXJuYWwpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZWdleHAgPSB0aGlzLmNyZWF0ZVJlZ3VsYXJFeHByZXNzaW9uKGV4dGVybmFsLnJlZ2V4cCk7XG5cdFx0XHRpZiAoVHlwZXMuaXNOdW1iZXIoZXh0ZXJuYWwuZmlsZSkpIHtcblx0XHRcdFx0ZmlsZSA9IGV4dGVybmFsLmZpbGU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICghcmVnZXhwKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIGZpbGUgPyB7IHJlZ2V4cCwgZmlsZSB9IDogeyByZWdleHAsIGZpbGU6IDEgfTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlUmVndWxhckV4cHJlc3Npb24odmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IFJlZ0V4cCB8IG51bGwge1xuXHRcdGxldCByZXN1bHQ6IFJlZ0V4cCB8IG51bGwgPSBudWxsO1xuXHRcdGlmICghdmFsdWUpIHtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHRyZXN1bHQgPSBuZXcgUmVnRXhwKHZhbHVlKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHRoaXMuZXJyb3IobG9jYWxpemUoJ1Byb2JsZW1NYXRjaGVyUGFyc2VyLmludmFsaWRSZWdleHAnLCAnRXJyb3I6IFRoZSBzdHJpbmcgezB9IGlzIG5vdCBhIHZhbGlkIHJlZ3VsYXIgZXhwcmVzc2lvbi5cXG4nLCB2YWx1ZSkpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG5cbmNvbnN0IHByb2JsZW1NYXRjaGVyc0V4dFBvaW50ID0gRXh0ZW5zaW9uc1JlZ2lzdHJ5LnJlZ2lzdGVyRXh0ZW5zaW9uUG9pbnQ8Q29uZmlnLklOYW1lZFByb2JsZW1NYXRjaGVyW10+KHtcblx0ZXh0ZW5zaW9uUG9pbnQ6ICdwcm9ibGVtTWF0Y2hlcnMnLFxuXHRkZXBzOiBbcHJvYmxlbVBhdHRlcm5FeHRQb2ludF0sXG5cdGpzb25TY2hlbWE6IHtcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ1Byb2JsZW1NYXRjaGVyRXh0UG9pbnQnLCAnQ29udHJpYnV0ZXMgcHJvYmxlbSBtYXRjaGVycycpLFxuXHRcdHR5cGU6ICdhcnJheScsXG5cdFx0aXRlbXM6IFNjaGVtYXMuTmFtZWRQcm9ibGVtTWF0Y2hlclxuXHR9XG59KTtcblxuZXhwb3J0IGludGVyZmFjZSBJUHJvYmxlbU1hdGNoZXJSZWdpc3RyeSB7XG5cdG9uUmVhZHkoKTogUHJvbWlzZTx2b2lkPjtcblx0Z2V0KG5hbWU6IHN0cmluZyk6IElOYW1lZFByb2JsZW1NYXRjaGVyO1xuXHRrZXlzKCk6IHN0cmluZ1tdO1xuXHRyZWFkb25seSBvbk1hdGNoZXJDaGFuZ2VkOiBFdmVudDx2b2lkPjtcbn1cblxuY2xhc3MgUHJvYmxlbU1hdGNoZXJSZWdpc3RyeUltcGwgaW1wbGVtZW50cyBJUHJvYmxlbU1hdGNoZXJSZWdpc3RyeSB7XG5cblx0cHJpdmF0ZSBtYXRjaGVyczogSVN0cmluZ0RpY3Rpb25hcnk8SU5hbWVkUHJvYmxlbU1hdGNoZXI+O1xuXHRwcml2YXRlIHJlYWR5UHJvbWlzZTogUHJvbWlzZTx2b2lkPjtcblx0cHJpdmF0ZSByZWFkb25seSBfb25NYXRjaGVyc0NoYW5nZWQ6IEVtaXR0ZXI8dm9pZD4gPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25NYXRjaGVyQ2hhbmdlZDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbk1hdGNoZXJzQ2hhbmdlZC5ldmVudDtcblxuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMubWF0Y2hlcnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdHRoaXMuZmlsbERlZmF1bHRzKCk7XG5cdFx0dGhpcy5yZWFkeVByb21pc2UgPSBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRwcm9ibGVtTWF0Y2hlcnNFeHRQb2ludC5zZXRIYW5kbGVyKChleHRlbnNpb25zLCBkZWx0YSkgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGRlbHRhLnJlbW92ZWQuZm9yRWFjaChleHRlbnNpb24gPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgcHJvYmxlbU1hdGNoZXJzID0gZXh0ZW5zaW9uLnZhbHVlO1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBtYXRjaGVyIG9mIHByb2JsZW1NYXRjaGVycykge1xuXHRcdFx0XHRcdFx0XHRpZiAodGhpcy5tYXRjaGVyc1ttYXRjaGVyLm5hbWVdKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZGVsZXRlIHRoaXMubWF0Y2hlcnNbbWF0Y2hlci5uYW1lXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGRlbHRhLmFkZGVkLmZvckVhY2goZXh0ZW5zaW9uID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IHByb2JsZW1NYXRjaGVycyA9IGV4dGVuc2lvbi52YWx1ZTtcblx0XHRcdFx0XHRcdGNvbnN0IHBhcnNlciA9IG5ldyBQcm9ibGVtTWF0Y2hlclBhcnNlcihuZXcgRXh0ZW5zaW9uUmVnaXN0cnlSZXBvcnRlcihleHRlbnNpb24uY29sbGVjdG9yKSk7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IG1hdGNoZXIgb2YgcHJvYmxlbU1hdGNoZXJzKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IHBhcnNlci5wYXJzZShtYXRjaGVyKTtcblx0XHRcdFx0XHRcdFx0aWYgKHJlc3VsdCAmJiBpc05hbWVkUHJvYmxlbU1hdGNoZXIocmVzdWx0KSkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMuYWRkKHJlc3VsdCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRpZiAoKGRlbHRhLnJlbW92ZWQubGVuZ3RoID4gMCkgfHwgKGRlbHRhLmFkZGVkLmxlbmd0aCA+IDApKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9vbk1hdGNoZXJzQ2hhbmdlZC5maXJlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IG1hdGNoZXIgPSB0aGlzLmdldCgndHNjLXdhdGNoJyk7XG5cdFx0XHRcdGlmIChtYXRjaGVyKSB7XG5cdFx0XHRcdFx0KDxhbnk+bWF0Y2hlcikudHNjV2F0Y2ggPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIG9uUmVhZHkoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0UHJvYmxlbVBhdHRlcm5SZWdpc3RyeS5vblJlYWR5KCk7XG5cdFx0cmV0dXJuIHRoaXMucmVhZHlQcm9taXNlO1xuXHR9XG5cblx0cHVibGljIGFkZChtYXRjaGVyOiBJTmFtZWRQcm9ibGVtTWF0Y2hlcik6IHZvaWQge1xuXHRcdHRoaXMubWF0Y2hlcnNbbWF0Y2hlci5uYW1lXSA9IG1hdGNoZXI7XG5cdH1cblxuXHRwdWJsaWMgZ2V0KG5hbWU6IHN0cmluZyk6IElOYW1lZFByb2JsZW1NYXRjaGVyIHtcblx0XHRyZXR1cm4gdGhpcy5tYXRjaGVyc1tuYW1lXTtcblx0fVxuXG5cdHB1YmxpYyBrZXlzKCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gT2JqZWN0LmtleXModGhpcy5tYXRjaGVycyk7XG5cdH1cblxuXHRwcml2YXRlIGZpbGxEZWZhdWx0cygpOiB2b2lkIHtcblx0XHR0aGlzLmFkZCh7XG5cdFx0XHRuYW1lOiAnbXNDb21waWxlJyxcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnbXNDb21waWxlJywgJ01pY3Jvc29mdCBjb21waWxlciBwcm9ibGVtcycpLFxuXHRcdFx0b3duZXI6ICdtc0NvbXBpbGUnLFxuXHRcdFx0c291cmNlOiAnY3BwJyxcblx0XHRcdGFwcGx5VG86IEFwcGx5VG9LaW5kLmFsbERvY3VtZW50cyxcblx0XHRcdGZpbGVMb2NhdGlvbjogRmlsZUxvY2F0aW9uS2luZC5BYnNvbHV0ZSxcblx0XHRcdHBhdHRlcm46IFByb2JsZW1QYXR0ZXJuUmVnaXN0cnkuZ2V0KCdtc0NvbXBpbGUnKVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5hZGQoe1xuXHRcdFx0bmFtZTogJ2xlc3NDb21waWxlJyxcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnbGVzc0NvbXBpbGUnLCAnTGVzcyBwcm9ibGVtcycpLFxuXHRcdFx0ZGVwcmVjYXRlZDogdHJ1ZSxcblx0XHRcdG93bmVyOiAnbGVzc0NvbXBpbGUnLFxuXHRcdFx0c291cmNlOiAnbGVzcycsXG5cdFx0XHRhcHBseVRvOiBBcHBseVRvS2luZC5hbGxEb2N1bWVudHMsXG5cdFx0XHRmaWxlTG9jYXRpb246IEZpbGVMb2NhdGlvbktpbmQuQWJzb2x1dGUsXG5cdFx0XHRwYXR0ZXJuOiBQcm9ibGVtUGF0dGVyblJlZ2lzdHJ5LmdldCgnbGVzc0NvbXBpbGUnKSxcblx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5FcnJvclxuXHRcdH0pO1xuXG5cdFx0dGhpcy5hZGQoe1xuXHRcdFx0bmFtZTogJ2d1bHAtdHNjJyxcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZ3VscC10c2MnLCAnR3VscCBUU0MgUHJvYmxlbXMnKSxcblx0XHRcdG93bmVyOiAndHlwZXNjcmlwdCcsXG5cdFx0XHRzb3VyY2U6ICd0cycsXG5cdFx0XHRhcHBseVRvOiBBcHBseVRvS2luZC5jbG9zZWREb2N1bWVudHMsXG5cdFx0XHRmaWxlTG9jYXRpb246IEZpbGVMb2NhdGlvbktpbmQuUmVsYXRpdmUsXG5cdFx0XHRmaWxlUHJlZml4OiAnJHt3b3Jrc3BhY2VGb2xkZXJ9Jyxcblx0XHRcdHBhdHRlcm46IFByb2JsZW1QYXR0ZXJuUmVnaXN0cnkuZ2V0KCdndWxwLXRzYycpXG5cdFx0fSk7XG5cblx0XHR0aGlzLmFkZCh7XG5cdFx0XHRuYW1lOiAnanNoaW50Jyxcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnanNoaW50JywgJ0pTSGludCBwcm9ibGVtcycpLFxuXHRcdFx0b3duZXI6ICdqc2hpbnQnLFxuXHRcdFx0c291cmNlOiAnanNoaW50Jyxcblx0XHRcdGFwcGx5VG86IEFwcGx5VG9LaW5kLmFsbERvY3VtZW50cyxcblx0XHRcdGZpbGVMb2NhdGlvbjogRmlsZUxvY2F0aW9uS2luZC5BYnNvbHV0ZSxcblx0XHRcdHBhdHRlcm46IFByb2JsZW1QYXR0ZXJuUmVnaXN0cnkuZ2V0KCdqc2hpbnQnKVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5hZGQoe1xuXHRcdFx0bmFtZTogJ2pzaGludC1zdHlsaXNoJyxcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnanNoaW50LXN0eWxpc2gnLCAnSlNIaW50IHN0eWxpc2ggcHJvYmxlbXMnKSxcblx0XHRcdG93bmVyOiAnanNoaW50Jyxcblx0XHRcdHNvdXJjZTogJ2pzaGludCcsXG5cdFx0XHRhcHBseVRvOiBBcHBseVRvS2luZC5hbGxEb2N1bWVudHMsXG5cdFx0XHRmaWxlTG9jYXRpb246IEZpbGVMb2NhdGlvbktpbmQuQWJzb2x1dGUsXG5cdFx0XHRwYXR0ZXJuOiBQcm9ibGVtUGF0dGVyblJlZ2lzdHJ5LmdldCgnanNoaW50LXN0eWxpc2gnKVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5hZGQoe1xuXHRcdFx0bmFtZTogJ2VzbGludC1jb21wYWN0Jyxcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZXNsaW50LWNvbXBhY3QnLCAnRVNMaW50IGNvbXBhY3QgcHJvYmxlbXMnKSxcblx0XHRcdG93bmVyOiAnZXNsaW50Jyxcblx0XHRcdHNvdXJjZTogJ2VzbGludCcsXG5cdFx0XHRhcHBseVRvOiBBcHBseVRvS2luZC5hbGxEb2N1bWVudHMsXG5cdFx0XHRmaWxlTG9jYXRpb246IEZpbGVMb2NhdGlvbktpbmQuQWJzb2x1dGUsXG5cdFx0XHRmaWxlUHJlZml4OiAnJHt3b3Jrc3BhY2VGb2xkZXJ9Jyxcblx0XHRcdHBhdHRlcm46IFByb2JsZW1QYXR0ZXJuUmVnaXN0cnkuZ2V0KCdlc2xpbnQtY29tcGFjdCcpXG5cdFx0fSk7XG5cblx0XHR0aGlzLmFkZCh7XG5cdFx0XHRuYW1lOiAnZXNsaW50LXN0eWxpc2gnLFxuXHRcdFx0bGFiZWw6IGxvY2FsaXplKCdlc2xpbnQtc3R5bGlzaCcsICdFU0xpbnQgc3R5bGlzaCBwcm9ibGVtcycpLFxuXHRcdFx0b3duZXI6ICdlc2xpbnQnLFxuXHRcdFx0c291cmNlOiAnZXNsaW50Jyxcblx0XHRcdGFwcGx5VG86IEFwcGx5VG9LaW5kLmFsbERvY3VtZW50cyxcblx0XHRcdGZpbGVMb2NhdGlvbjogRmlsZUxvY2F0aW9uS2luZC5BYnNvbHV0ZSxcblx0XHRcdHBhdHRlcm46IFByb2JsZW1QYXR0ZXJuUmVnaXN0cnkuZ2V0KCdlc2xpbnQtc3R5bGlzaCcpXG5cdFx0fSk7XG5cblx0XHR0aGlzLmFkZCh7XG5cdFx0XHRuYW1lOiAnZ28nLFxuXHRcdFx0bGFiZWw6IGxvY2FsaXplKCdnbycsICdHbyBwcm9ibGVtcycpLFxuXHRcdFx0b3duZXI6ICdnbycsXG5cdFx0XHRzb3VyY2U6ICdnbycsXG5cdFx0XHRhcHBseVRvOiBBcHBseVRvS2luZC5hbGxEb2N1bWVudHMsXG5cdFx0XHRmaWxlTG9jYXRpb246IEZpbGVMb2NhdGlvbktpbmQuUmVsYXRpdmUsXG5cdFx0XHRmaWxlUHJlZml4OiAnJHt3b3Jrc3BhY2VGb2xkZXJ9Jyxcblx0XHRcdHBhdHRlcm46IFByb2JsZW1QYXR0ZXJuUmVnaXN0cnkuZ2V0KCdnbycpXG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IFByb2JsZW1NYXRjaGVyUmVnaXN0cnk6IElQcm9ibGVtTWF0Y2hlclJlZ2lzdHJ5ID0gbmV3IFByb2JsZW1NYXRjaGVyUmVnaXN0cnlJbXBsKCk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFL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QUEsTUFDUCxRQUFRO0FBQUEsTUFDUixTQUFTO0FBQUEsTUFDVCxjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixTQUFTLHVCQUF1QixJQUFJLElBQUk7QUFBQSxJQUN6QyxDQUFDO0FBQUEsRUFDRjtBQUNEO0FBRU8sTUFBTSx5QkFBa0QsSUFBSSwyQkFBMkI7IiwKICAibmFtZXMiOiBbIkZpbGVMb2NhdGlvbktpbmQiLCAiUHJvYmxlbUxvY2F0aW9uS2luZCIsICJBcHBseVRvS2luZCIsICJDb25maWciLCAiQ2hlY2tlZFByb2JsZW1QYXR0ZXJuIiwgIk5hbWVkUHJvYmxlbVBhdHRlcm4iLCAiTmFtZWRDaGVja2VkUHJvYmxlbVBhdHRlcm4iLCAiTXVsdGlMaW5lUHJvYmxlbVBhdHRlcm4iLCAiTXVsdGlMaW5lQ2hlY2tlZFByb2JsZW1QYXR0ZXJuIiwgIk5hbWVkTXVsdGlMaW5lQ2hlY2tlZFByb2JsZW1QYXR0ZXJuIiwgImlzTmFtZWRQcm9ibGVtTWF0Y2hlciIsICJyZXN1bHQiLCAidmFsdWUiLCAiU2NoZW1hcyIsICJraW5kIiwgIm1hdGNoZXIiXQp9Cg==
