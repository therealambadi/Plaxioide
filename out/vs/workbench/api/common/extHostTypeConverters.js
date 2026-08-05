import { asArray, coalesce, isNonEmptyArray } from "../../../base/common/arrays.js";
import { VSBuffer, encodeBase64 } from "../../../base/common/buffer.js";
import { UriList } from "../../../base/common/dataTransfer.js";
import { createSingleCallFunction } from "../../../base/common/functional.js";
import * as htmlContent from "../../../base/common/htmlContent.js";
import { ResourceMap, ResourceSet } from "../../../base/common/map.js";
import * as marked from "../../../base/common/marked/marked.js";
import { parse, revive } from "../../../base/common/marshalling.js";
import { MarshalledId } from "../../../base/common/marshallingIds.js";
import { Mimes } from "../../../base/common/mime.js";
import { cloneAndChange } from "../../../base/common/objects.js";
import { isWindows } from "../../../base/common/platform.js";
import { WellDefinedPrefixTree } from "../../../base/common/prefixTree.js";
import { basename } from "../../../base/common/resources.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { isDefined, isEmptyObject, isNumber, isString, isUndefinedOrNull } from "../../../base/common/types.js";
import { URI, isUriComponents } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { RenderLineNumbersType } from "../../../editor/common/config/editorOptions.js";
import * as editorRange from "../../../editor/common/core/range.js";
import * as encodedTokenAttributes from "../../../editor/common/encodedTokenAttributes.js";
import * as languages from "../../../editor/common/languages.js";
import { EndOfLineSequence, TrackedRangeStickiness } from "../../../editor/common/model.js";
import { MarkerSeverity, MarkerTag } from "../../../platform/markers/common/markers.js";
import { ProgressLocation as MainProgressLocation } from "../../../platform/progress/common/progress.js";
import { DEFAULT_EDITOR_ASSOCIATION, SaveReason } from "../../common/editor.js";
import * as chatProvider from "../../contrib/chat/common/languageModels.js";
import { DebugTreeItemCollapsibleState } from "../../contrib/debug/common/debug.js";
import * as notebooks from "../../contrib/notebook/common/notebookCommon.js";
import { CellEditType } from "../../contrib/notebook/common/notebookCommon.js";
import { TestId } from "../../contrib/testing/common/testId.js";
import { DetailType, TestMessageType, TestRunProfileBitset, denamespaceTestTag, namespaceTestTag } from "../../contrib/testing/common/testTypes.js";
import { ACTIVE_GROUP, SIDE_GROUP } from "../../services/editor/common/editorService.js";
import { checkProposedApiEnabled } from "../../services/extensions/common/extensions.js";
import { getPrivateApiFor } from "./extHostTestingPrivateApi.js";
import * as types from "./extHostTypes.js";
import { LanguageModelTextPart } from "./extHostTypes.js";
import { ChatAgentLocation } from "../../contrib/chat/common/constants.js";
var Selection;
((Selection2) => {
  function to(selection) {
    const { selectionStartLineNumber, selectionStartColumn, positionLineNumber, positionColumn } = selection;
    const start = new types.Position(selectionStartLineNumber - 1, selectionStartColumn - 1);
    const end = new types.Position(positionLineNumber - 1, positionColumn - 1);
    return new types.Selection(start, end);
  }
  Selection2.to = to;
  function from(selection) {
    const { anchor, active } = selection;
    return {
      selectionStartLineNumber: anchor.line + 1,
      selectionStartColumn: anchor.character + 1,
      positionLineNumber: active.line + 1,
      positionColumn: active.character + 1
    };
  }
  Selection2.from = from;
})(Selection || (Selection = {}));
var Range;
((Range2) => {
  function from(range) {
    if (!range) {
      return void 0;
    }
    const { start, end } = range;
    return {
      startLineNumber: start.line + 1,
      startColumn: start.character + 1,
      endLineNumber: end.line + 1,
      endColumn: end.character + 1
    };
  }
  Range2.from = from;
  function to(range) {
    if (!range) {
      return void 0;
    }
    const { startLineNumber, startColumn, endLineNumber, endColumn } = range;
    return new types.Range(startLineNumber - 1, startColumn - 1, endLineNumber - 1, endColumn - 1);
  }
  Range2.to = to;
})(Range || (Range = {}));
var Location;
((Location2) => {
  function from(location2) {
    return {
      uri: location2.uri,
      range: Range.from(location2.range)
    };
  }
  Location2.from = from;
  function to(location2) {
    return new types.Location(URI.revive(location2.uri), Range.to(location2.range));
  }
  Location2.to = to;
})(Location || (Location = {}));
var TokenType;
((TokenType2) => {
  function to(type) {
    switch (type) {
      case encodedTokenAttributes.StandardTokenType.Comment:
        return types.StandardTokenType.Comment;
      case encodedTokenAttributes.StandardTokenType.Other:
        return types.StandardTokenType.Other;
      case encodedTokenAttributes.StandardTokenType.RegEx:
        return types.StandardTokenType.RegEx;
      case encodedTokenAttributes.StandardTokenType.String:
        return types.StandardTokenType.String;
    }
  }
  TokenType2.to = to;
})(TokenType || (TokenType = {}));
var Position;
((Position2) => {
  function to(position) {
    return new types.Position(position.lineNumber - 1, position.column - 1);
  }
  Position2.to = to;
  function from(position) {
    return { lineNumber: position.line + 1, column: position.character + 1 };
  }
  Position2.from = from;
})(Position || (Position = {}));
var DocumentSelector;
((DocumentSelector2) => {
  function from(value, uriTransformer, extension) {
    return coalesce(asArray(value).map((sel) => _doTransformDocumentSelector(sel, uriTransformer, extension)));
  }
  DocumentSelector2.from = from;
  function _doTransformDocumentSelector(selector, uriTransformer, extension) {
    if (typeof selector === "string") {
      return {
        $serialized: true,
        language: selector,
        isBuiltin: extension?.isBuiltin
      };
    }
    if (selector) {
      return {
        $serialized: true,
        language: selector.language,
        scheme: _transformScheme(selector.scheme, uriTransformer),
        pattern: GlobPattern.from(selector.pattern) ?? void 0,
        exclusive: selector.exclusive,
        notebookType: selector.notebookType,
        isBuiltin: extension?.isBuiltin
      };
    }
    return void 0;
  }
  function _transformScheme(scheme, uriTransformer) {
    if (uriTransformer && typeof scheme === "string") {
      return uriTransformer.transformOutgoingScheme(scheme);
    }
    return scheme;
  }
})(DocumentSelector || (DocumentSelector = {}));
var DiagnosticTag;
((DiagnosticTag2) => {
  function from(value) {
    switch (value) {
      case types.DiagnosticTag.Unnecessary:
        return MarkerTag.Unnecessary;
      case types.DiagnosticTag.Deprecated:
        return MarkerTag.Deprecated;
    }
    return void 0;
  }
  DiagnosticTag2.from = from;
  function to(value) {
    switch (value) {
      case MarkerTag.Unnecessary:
        return types.DiagnosticTag.Unnecessary;
      case MarkerTag.Deprecated:
        return types.DiagnosticTag.Deprecated;
      default:
        return void 0;
    }
  }
  DiagnosticTag2.to = to;
})(DiagnosticTag || (DiagnosticTag = {}));
var Diagnostic;
((Diagnostic2) => {
  function from(value) {
    let code;
    if (value.code) {
      if (isString(value.code) || isNumber(value.code)) {
        code = String(value.code);
      } else {
        code = {
          value: String(value.code.value),
          target: value.code.target
        };
      }
    }
    return {
      ...Range.from(value.range),
      message: value.message,
      source: value.source,
      code,
      severity: DiagnosticSeverity.from(value.severity),
      relatedInformation: value.relatedInformation && value.relatedInformation.map(DiagnosticRelatedInformation.from),
      tags: Array.isArray(value.tags) ? coalesce(value.tags.map(DiagnosticTag.from)) : void 0
    };
  }
  Diagnostic2.from = from;
  function to(value) {
    const res = new types.Diagnostic(Range.to(value), value.message, DiagnosticSeverity.to(value.severity));
    res.source = value.source;
    res.code = isString(value.code) ? value.code : value.code?.value;
    res.relatedInformation = value.relatedInformation && value.relatedInformation.map(DiagnosticRelatedInformation.to);
    res.tags = value.tags && coalesce(value.tags.map(DiagnosticTag.to));
    return res;
  }
  Diagnostic2.to = to;
})(Diagnostic || (Diagnostic = {}));
var DiagnosticRelatedInformation;
((DiagnosticRelatedInformation2) => {
  function from(value) {
    return {
      ...Range.from(value.location.range),
      message: value.message,
      resource: value.location.uri
    };
  }
  DiagnosticRelatedInformation2.from = from;
  function to(value) {
    return new types.DiagnosticRelatedInformation(new types.Location(value.resource, Range.to(value)), value.message);
  }
  DiagnosticRelatedInformation2.to = to;
})(DiagnosticRelatedInformation || (DiagnosticRelatedInformation = {}));
var DiagnosticSeverity;
((DiagnosticSeverity2) => {
  function from(value) {
    switch (value) {
      case types.DiagnosticSeverity.Error:
        return MarkerSeverity.Error;
      case types.DiagnosticSeverity.Warning:
        return MarkerSeverity.Warning;
      case types.DiagnosticSeverity.Information:
        return MarkerSeverity.Info;
      case types.DiagnosticSeverity.Hint:
        return MarkerSeverity.Hint;
    }
    return MarkerSeverity.Error;
  }
  DiagnosticSeverity2.from = from;
  function to(value) {
    switch (value) {
      case MarkerSeverity.Info:
        return types.DiagnosticSeverity.Information;
      case MarkerSeverity.Warning:
        return types.DiagnosticSeverity.Warning;
      case MarkerSeverity.Error:
        return types.DiagnosticSeverity.Error;
      case MarkerSeverity.Hint:
        return types.DiagnosticSeverity.Hint;
      default:
        return types.DiagnosticSeverity.Error;
    }
  }
  DiagnosticSeverity2.to = to;
})(DiagnosticSeverity || (DiagnosticSeverity = {}));
var ViewColumn;
((ViewColumn2) => {
  function from(column) {
    if (typeof column === "number" && column >= types.ViewColumn.One) {
      return column - 1;
    }
    if (column === types.ViewColumn.Beside) {
      return SIDE_GROUP;
    }
    return ACTIVE_GROUP;
  }
  ViewColumn2.from = from;
  function to(position) {
    if (typeof position === "number" && position >= 0) {
      return position + 1;
    }
    throw new Error(`invalid 'EditorGroupColumn'`);
  }
  ViewColumn2.to = to;
})(ViewColumn || (ViewColumn = {}));
function isDecorationOptions(something) {
  return typeof something.range !== "undefined";
}
function isDecorationOptionsArr(something) {
  if (something.length === 0) {
    return true;
  }
  return isDecorationOptions(something[0]) ? true : false;
}
var MarkdownString;
((MarkdownString2) => {
  function fromMany(markup) {
    return markup.map(MarkdownString2.from);
  }
  MarkdownString2.fromMany = fromMany;
  function isCodeblock(thing) {
    return thing && typeof thing === "object" && typeof thing.language === "string" && typeof thing.value === "string";
  }
  function from(markup) {
    let res;
    if (isCodeblock(markup)) {
      const { language, value } = markup;
      res = { value: "```" + language + "\n" + value + "\n```\n" };
    } else if (types.MarkdownString.isMarkdownString(markup)) {
      res = { value: markup.value, isTrusted: markup.isTrusted, supportThemeIcons: markup.supportThemeIcons, supportHtml: markup.supportHtml, baseUri: markup.baseUri };
    } else if (typeof markup === "string") {
      res = { value: markup };
    } else {
      res = { value: "" };
    }
    const resUris = /* @__PURE__ */ Object.create(null);
    res.uris = resUris;
    const collectUri = ({ href }) => {
      try {
        let uri = URI.parse(href, true);
        uri = uri.with({ query: _uriMassage(uri.query, resUris) });
        resUris[href] = uri;
      } catch (e) {
      }
      return "";
    };
    marked.marked.walkTokens(marked.marked.lexer(res.value), (token) => {
      if (token.type === "link") {
        collectUri({ href: token.href });
      } else if (token.type === "image") {
        if (typeof token.href === "string") {
          collectUri(htmlContent.parseHrefAndDimensions(token.href));
        }
      }
    });
    return res;
  }
  MarkdownString2.from = from;
  function _uriMassage(part, bucket) {
    if (!part) {
      return part;
    }
    let data;
    try {
      data = parse(part);
    } catch (e) {
    }
    if (!data) {
      return part;
    }
    let changed = false;
    data = cloneAndChange(data, (value) => {
      if (URI.isUri(value)) {
        const key = `__uri_${Math.random().toString(16).slice(2, 8)}`;
        bucket[key] = value;
        changed = true;
        return key;
      } else {
        return void 0;
      }
    });
    if (!changed) {
      return part;
    }
    return JSON.stringify(data);
  }
  function to(value) {
    const result = new types.MarkdownString(value.value, value.supportThemeIcons);
    result.isTrusted = value.isTrusted;
    result.supportHtml = value.supportHtml;
    result.baseUri = value.baseUri ? URI.from(value.baseUri) : void 0;
    return result;
  }
  MarkdownString2.to = to;
  function fromStrict(value) {
    if (!value) {
      return void 0;
    }
    return typeof value === "string" ? value : MarkdownString2.from(value);
  }
  MarkdownString2.fromStrict = fromStrict;
})(MarkdownString || (MarkdownString = {}));
function fromRangeOrRangeWithMessage(ranges) {
  if (isDecorationOptionsArr(ranges)) {
    return ranges.map((r) => {
      return {
        range: Range.from(r.range),
        hoverMessage: Array.isArray(r.hoverMessage) ? MarkdownString.fromMany(r.hoverMessage) : r.hoverMessage ? MarkdownString.from(r.hoverMessage) : void 0,
        renderOptions: (
          /* URI vs Uri */
          r.renderOptions
        )
      };
    });
  } else {
    return ranges.map((r) => {
      return {
        range: Range.from(r)
      };
    });
  }
}
function pathOrURIToURI(value) {
  if (typeof value === "undefined") {
    return value;
  }
  if (typeof value === "string") {
    return URI.file(value);
  } else {
    return value;
  }
}
var ThemableDecorationAttachmentRenderOptions;
((ThemableDecorationAttachmentRenderOptions2) => {
  function from(options) {
    if (typeof options === "undefined") {
      return options;
    }
    return {
      contentText: options.contentText,
      contentIconPath: options.contentIconPath ? pathOrURIToURI(options.contentIconPath) : void 0,
      border: options.border,
      borderColor: options.borderColor,
      fontStyle: options.fontStyle,
      fontWeight: options.fontWeight,
      textDecoration: options.textDecoration,
      color: options.color,
      backgroundColor: options.backgroundColor,
      margin: options.margin,
      width: options.width,
      height: options.height
    };
  }
  ThemableDecorationAttachmentRenderOptions2.from = from;
})(ThemableDecorationAttachmentRenderOptions || (ThemableDecorationAttachmentRenderOptions = {}));
var ThemableDecorationRenderOptions;
((ThemableDecorationRenderOptions2) => {
  function from(options) {
    if (typeof options === "undefined") {
      return options;
    }
    return {
      backgroundColor: options.backgroundColor,
      outline: options.outline,
      outlineColor: options.outlineColor,
      outlineStyle: options.outlineStyle,
      outlineWidth: options.outlineWidth,
      border: options.border,
      borderColor: options.borderColor,
      borderRadius: options.borderRadius,
      borderSpacing: options.borderSpacing,
      borderStyle: options.borderStyle,
      borderWidth: options.borderWidth,
      fontStyle: options.fontStyle,
      fontWeight: options.fontWeight,
      textDecoration: options.textDecoration,
      cursor: options.cursor,
      color: options.color,
      opacity: options.opacity,
      letterSpacing: options.letterSpacing,
      gutterIconPath: options.gutterIconPath ? pathOrURIToURI(options.gutterIconPath) : void 0,
      gutterIconSize: options.gutterIconSize,
      overviewRulerColor: options.overviewRulerColor,
      before: options.before ? ThemableDecorationAttachmentRenderOptions.from(options.before) : void 0,
      after: options.after ? ThemableDecorationAttachmentRenderOptions.from(options.after) : void 0
    };
  }
  ThemableDecorationRenderOptions2.from = from;
})(ThemableDecorationRenderOptions || (ThemableDecorationRenderOptions = {}));
var DecorationRangeBehavior;
((DecorationRangeBehavior2) => {
  function from(value) {
    if (typeof value === "undefined") {
      return value;
    }
    switch (value) {
      case types.DecorationRangeBehavior.OpenOpen:
        return TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges;
      case types.DecorationRangeBehavior.ClosedClosed:
        return TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges;
      case types.DecorationRangeBehavior.OpenClosed:
        return TrackedRangeStickiness.GrowsOnlyWhenTypingBefore;
      case types.DecorationRangeBehavior.ClosedOpen:
        return TrackedRangeStickiness.GrowsOnlyWhenTypingAfter;
    }
  }
  DecorationRangeBehavior2.from = from;
})(DecorationRangeBehavior || (DecorationRangeBehavior = {}));
var DecorationRenderOptions;
((DecorationRenderOptions2) => {
  function from(options) {
    return {
      isWholeLine: options.isWholeLine,
      rangeBehavior: options.rangeBehavior ? DecorationRangeBehavior.from(options.rangeBehavior) : void 0,
      overviewRulerLane: options.overviewRulerLane,
      light: options.light ? ThemableDecorationRenderOptions.from(options.light) : void 0,
      dark: options.dark ? ThemableDecorationRenderOptions.from(options.dark) : void 0,
      backgroundColor: options.backgroundColor,
      outline: options.outline,
      outlineColor: options.outlineColor,
      outlineStyle: options.outlineStyle,
      outlineWidth: options.outlineWidth,
      border: options.border,
      borderColor: options.borderColor,
      borderRadius: options.borderRadius,
      borderSpacing: options.borderSpacing,
      borderStyle: options.borderStyle,
      borderWidth: options.borderWidth,
      fontStyle: options.fontStyle,
      fontWeight: options.fontWeight,
      textDecoration: options.textDecoration,
      cursor: options.cursor,
      color: options.color,
      opacity: options.opacity,
      letterSpacing: options.letterSpacing,
      gutterIconPath: options.gutterIconPath ? pathOrURIToURI(options.gutterIconPath) : void 0,
      gutterIconSize: options.gutterIconSize,
      overviewRulerColor: options.overviewRulerColor,
      before: options.before ? ThemableDecorationAttachmentRenderOptions.from(options.before) : void 0,
      after: options.after ? ThemableDecorationAttachmentRenderOptions.from(options.after) : void 0
    };
  }
  DecorationRenderOptions2.from = from;
})(DecorationRenderOptions || (DecorationRenderOptions = {}));
var TextEdit;
((TextEdit2) => {
  function from(edit) {
    return {
      text: edit.newText,
      eol: edit.newEol && EndOfLine.from(edit.newEol),
      range: Range.from(edit.range)
    };
  }
  TextEdit2.from = from;
  function to(edit) {
    const result = new types.TextEdit(Range.to(edit.range), edit.text);
    result.newEol = typeof edit.eol === "undefined" ? void 0 : EndOfLine.to(edit.eol);
    return result;
  }
  TextEdit2.to = to;
})(TextEdit || (TextEdit = {}));
var WorkspaceEdit;
((WorkspaceEdit2) => {
  function from(value, versionInfo) {
    const result = {
      edits: []
    };
    if (value instanceof types.WorkspaceEdit) {
      const toCreate = new ResourceSet();
      for (const entry of value._allEntries()) {
        if (entry._type === types.FileEditType.File && URI.isUri(entry.to) && entry.from === void 0) {
          toCreate.add(entry.to);
        }
      }
      for (const entry of value._allEntries()) {
        if (entry._type === types.FileEditType.File) {
          let contents;
          if (entry.options?.contents) {
            if (ArrayBuffer.isView(entry.options.contents)) {
              contents = { type: "base64", value: encodeBase64(VSBuffer.wrap(entry.options.contents)) };
            } else {
              contents = { type: "dataTransferItem", id: entry.options.contents._itemId };
            }
          }
          result.edits.push({
            oldResource: entry.from,
            newResource: entry.to,
            options: { ...entry.options, contents },
            metadata: entry.metadata
          });
        } else if (entry._type === types.FileEditType.Text) {
          result.edits.push({
            resource: entry.uri,
            textEdit: TextEdit.from(entry.edit),
            versionId: !toCreate.has(entry.uri) ? versionInfo?.getTextDocumentVersion(entry.uri) : void 0,
            metadata: entry.metadata
          });
        } else if (entry._type === types.FileEditType.Snippet) {
          result.edits.push({
            resource: entry.uri,
            textEdit: {
              range: Range.from(entry.range),
              text: entry.edit.value,
              insertAsSnippet: true,
              keepWhitespace: entry.keepWhitespace
            },
            versionId: !toCreate.has(entry.uri) ? versionInfo?.getTextDocumentVersion(entry.uri) : void 0,
            metadata: entry.metadata
          });
        } else if (entry._type === types.FileEditType.Cell) {
          result.edits.push({
            metadata: entry.metadata,
            resource: entry.uri,
            cellEdit: entry.edit,
            notebookVersionId: versionInfo?.getNotebookDocumentVersion(entry.uri)
          });
        } else if (entry._type === types.FileEditType.CellReplace) {
          result.edits.push({
            metadata: entry.metadata,
            resource: entry.uri,
            notebookVersionId: versionInfo?.getNotebookDocumentVersion(entry.uri),
            cellEdit: {
              editType: notebooks.CellEditType.Replace,
              index: entry.index,
              count: entry.count,
              cells: entry.cells.map(NotebookCellData.from)
            }
          });
        }
      }
    }
    return result;
  }
  WorkspaceEdit2.from = from;
  function to(value) {
    const result = new types.WorkspaceEdit();
    const edits = new ResourceMap();
    for (const edit of value.edits) {
      if (edit.textEdit) {
        const item = edit;
        const uri = URI.revive(item.resource);
        const range = Range.to(item.textEdit.range);
        const text = item.textEdit.text;
        const isSnippet = item.textEdit.insertAsSnippet;
        let editOrSnippetTest;
        if (isSnippet) {
          editOrSnippetTest = types.SnippetTextEdit.replace(range, new types.SnippetString(text));
        } else {
          editOrSnippetTest = types.TextEdit.replace(range, text);
        }
        const array = edits.get(uri);
        if (!array) {
          edits.set(uri, [editOrSnippetTest]);
        } else {
          array.push(editOrSnippetTest);
        }
      } else {
        result.renameFile(
          URI.revive(edit.oldResource),
          URI.revive(edit.newResource),
          edit.options
        );
      }
    }
    for (const [uri, array] of edits) {
      result.set(uri, array);
    }
    return result;
  }
  WorkspaceEdit2.to = to;
})(WorkspaceEdit || (WorkspaceEdit = {}));
var SymbolKind;
((SymbolKind2) => {
  const _fromMapping = /* @__PURE__ */ Object.create(null);
  _fromMapping[types.SymbolKind.File] = languages.SymbolKind.File;
  _fromMapping[types.SymbolKind.Module] = languages.SymbolKind.Module;
  _fromMapping[types.SymbolKind.Namespace] = languages.SymbolKind.Namespace;
  _fromMapping[types.SymbolKind.Package] = languages.SymbolKind.Package;
  _fromMapping[types.SymbolKind.Class] = languages.SymbolKind.Class;
  _fromMapping[types.SymbolKind.Method] = languages.SymbolKind.Method;
  _fromMapping[types.SymbolKind.Property] = languages.SymbolKind.Property;
  _fromMapping[types.SymbolKind.Field] = languages.SymbolKind.Field;
  _fromMapping[types.SymbolKind.Constructor] = languages.SymbolKind.Constructor;
  _fromMapping[types.SymbolKind.Enum] = languages.SymbolKind.Enum;
  _fromMapping[types.SymbolKind.Interface] = languages.SymbolKind.Interface;
  _fromMapping[types.SymbolKind.Function] = languages.SymbolKind.Function;
  _fromMapping[types.SymbolKind.Variable] = languages.SymbolKind.Variable;
  _fromMapping[types.SymbolKind.Constant] = languages.SymbolKind.Constant;
  _fromMapping[types.SymbolKind.String] = languages.SymbolKind.String;
  _fromMapping[types.SymbolKind.Number] = languages.SymbolKind.Number;
  _fromMapping[types.SymbolKind.Boolean] = languages.SymbolKind.Boolean;
  _fromMapping[types.SymbolKind.Array] = languages.SymbolKind.Array;
  _fromMapping[types.SymbolKind.Object] = languages.SymbolKind.Object;
  _fromMapping[types.SymbolKind.Key] = languages.SymbolKind.Key;
  _fromMapping[types.SymbolKind.Null] = languages.SymbolKind.Null;
  _fromMapping[types.SymbolKind.EnumMember] = languages.SymbolKind.EnumMember;
  _fromMapping[types.SymbolKind.Struct] = languages.SymbolKind.Struct;
  _fromMapping[types.SymbolKind.Event] = languages.SymbolKind.Event;
  _fromMapping[types.SymbolKind.Operator] = languages.SymbolKind.Operator;
  _fromMapping[types.SymbolKind.TypeParameter] = languages.SymbolKind.TypeParameter;
  function from(kind) {
    return typeof _fromMapping[kind] === "number" ? _fromMapping[kind] : languages.SymbolKind.Property;
  }
  SymbolKind2.from = from;
  function to(kind) {
    for (const k in _fromMapping) {
      if (_fromMapping[k] === kind) {
        return Number(k);
      }
    }
    return types.SymbolKind.Property;
  }
  SymbolKind2.to = to;
})(SymbolKind || (SymbolKind = {}));
var SymbolTag;
((SymbolTag2) => {
  function from(kind) {
    switch (kind) {
      case types.SymbolTag.Deprecated:
        return languages.SymbolTag.Deprecated;
    }
  }
  SymbolTag2.from = from;
  function to(kind) {
    switch (kind) {
      case languages.SymbolTag.Deprecated:
        return types.SymbolTag.Deprecated;
    }
  }
  SymbolTag2.to = to;
})(SymbolTag || (SymbolTag = {}));
var WorkspaceSymbol;
((WorkspaceSymbol2) => {
  function from(info) {
    return {
      name: info.name,
      kind: SymbolKind.from(info.kind),
      tags: info.tags && info.tags.map(SymbolTag.from),
      containerName: info.containerName,
      location: location.from(info.location)
    };
  }
  WorkspaceSymbol2.from = from;
  function to(info) {
    const result = new types.SymbolInformation(
      info.name,
      SymbolKind.to(info.kind),
      info.containerName,
      location.to(info.location)
    );
    result.tags = info.tags && info.tags.map(SymbolTag.to);
    return result;
  }
  WorkspaceSymbol2.to = to;
})(WorkspaceSymbol || (WorkspaceSymbol = {}));
var DocumentSymbol;
((DocumentSymbol2) => {
  function from(info) {
    const result = {
      name: info.name || "!!MISSING: name!!",
      detail: info.detail,
      range: Range.from(info.range),
      selectionRange: Range.from(info.selectionRange),
      kind: SymbolKind.from(info.kind),
      tags: info.tags?.map(SymbolTag.from) ?? []
    };
    if (info.children) {
      result.children = info.children.map(from);
    }
    return result;
  }
  DocumentSymbol2.from = from;
  function to(info) {
    const result = new types.DocumentSymbol(
      info.name,
      info.detail,
      SymbolKind.to(info.kind),
      Range.to(info.range),
      Range.to(info.selectionRange)
    );
    if (isNonEmptyArray(info.tags)) {
      result.tags = info.tags.map(SymbolTag.to);
    }
    if (info.children) {
      result.children = info.children.map(to);
    }
    return result;
  }
  DocumentSymbol2.to = to;
})(DocumentSymbol || (DocumentSymbol = {}));
var CallHierarchyItem;
((CallHierarchyItem2) => {
  function to(item) {
    const result = new types.CallHierarchyItem(
      SymbolKind.to(item.kind),
      item.name,
      item.detail || "",
      URI.revive(item.uri),
      Range.to(item.range),
      Range.to(item.selectionRange)
    );
    result._sessionId = item._sessionId;
    result._itemId = item._itemId;
    return result;
  }
  CallHierarchyItem2.to = to;
  function from(item, sessionId, itemId) {
    sessionId = sessionId ?? item._sessionId;
    itemId = itemId ?? item._itemId;
    if (sessionId === void 0 || itemId === void 0) {
      throw new Error("invalid item");
    }
    return {
      _sessionId: sessionId,
      _itemId: itemId,
      name: item.name,
      detail: item.detail,
      kind: SymbolKind.from(item.kind),
      uri: item.uri,
      range: Range.from(item.range),
      selectionRange: Range.from(item.selectionRange),
      tags: item.tags?.map(SymbolTag.from)
    };
  }
  CallHierarchyItem2.from = from;
})(CallHierarchyItem || (CallHierarchyItem = {}));
var CallHierarchyIncomingCall;
((CallHierarchyIncomingCall2) => {
  function to(item) {
    return new types.CallHierarchyIncomingCall(
      CallHierarchyItem.to(item.from),
      item.fromRanges.map((r) => Range.to(r))
    );
  }
  CallHierarchyIncomingCall2.to = to;
})(CallHierarchyIncomingCall || (CallHierarchyIncomingCall = {}));
var CallHierarchyOutgoingCall;
((CallHierarchyOutgoingCall2) => {
  function to(item) {
    return new types.CallHierarchyOutgoingCall(
      CallHierarchyItem.to(item.to),
      item.fromRanges.map((r) => Range.to(r))
    );
  }
  CallHierarchyOutgoingCall2.to = to;
})(CallHierarchyOutgoingCall || (CallHierarchyOutgoingCall = {}));
var location;
((location2) => {
  function from(value) {
    return {
      range: value.range && Range.from(value.range),
      uri: value.uri
    };
  }
  location2.from = from;
  function to(value) {
    return new types.Location(URI.revive(value.uri), Range.to(value.range));
  }
  location2.to = to;
})(location || (location = {}));
var DefinitionLink;
((DefinitionLink2) => {
  function from(value) {
    const definitionLink = value;
    const location2 = value;
    return {
      originSelectionRange: definitionLink.originSelectionRange ? Range.from(definitionLink.originSelectionRange) : void 0,
      uri: definitionLink.targetUri ? definitionLink.targetUri : location2.uri,
      range: Range.from(definitionLink.targetRange ? definitionLink.targetRange : location2.range),
      targetSelectionRange: definitionLink.targetSelectionRange ? Range.from(definitionLink.targetSelectionRange) : void 0
    };
  }
  DefinitionLink2.from = from;
  function to(value) {
    return {
      targetUri: URI.revive(value.uri),
      targetRange: Range.to(value.range),
      targetSelectionRange: value.targetSelectionRange ? Range.to(value.targetSelectionRange) : void 0,
      originSelectionRange: value.originSelectionRange ? Range.to(value.originSelectionRange) : void 0
    };
  }
  DefinitionLink2.to = to;
})(DefinitionLink || (DefinitionLink = {}));
var Hover;
((Hover2) => {
  function from(hover) {
    const convertedHover = {
      range: Range.from(hover.range),
      contents: MarkdownString.fromMany(hover.contents),
      canIncreaseVerbosity: hover.canIncreaseVerbosity,
      canDecreaseVerbosity: hover.canDecreaseVerbosity
    };
    return convertedHover;
  }
  Hover2.from = from;
  function to(info) {
    const contents = info.contents.map(MarkdownString.to);
    const range = Range.to(info.range);
    const canIncreaseVerbosity = info.canIncreaseVerbosity;
    const canDecreaseVerbosity = info.canDecreaseVerbosity;
    return new types.VerboseHover(contents, range, canIncreaseVerbosity, canDecreaseVerbosity);
  }
  Hover2.to = to;
})(Hover || (Hover = {}));
var EvaluatableExpression;
((EvaluatableExpression2) => {
  function from(expression) {
    return {
      range: Range.from(expression.range),
      expression: expression.expression
    };
  }
  EvaluatableExpression2.from = from;
  function to(info) {
    return new types.EvaluatableExpression(Range.to(info.range), info.expression);
  }
  EvaluatableExpression2.to = to;
})(EvaluatableExpression || (EvaluatableExpression = {}));
var InlineValue;
((InlineValue2) => {
  function from(inlineValue) {
    if (inlineValue instanceof types.InlineValueText) {
      return {
        type: "text",
        range: Range.from(inlineValue.range),
        text: inlineValue.text
      };
    } else if (inlineValue instanceof types.InlineValueVariableLookup) {
      return {
        type: "variable",
        range: Range.from(inlineValue.range),
        variableName: inlineValue.variableName,
        caseSensitiveLookup: inlineValue.caseSensitiveLookup
      };
    } else if (inlineValue instanceof types.InlineValueEvaluatableExpression) {
      return {
        type: "expression",
        range: Range.from(inlineValue.range),
        expression: inlineValue.expression
      };
    } else {
      throw new Error(`Unknown 'InlineValue' type`);
    }
  }
  InlineValue2.from = from;
  function to(inlineValue) {
    switch (inlineValue.type) {
      case "text":
        return {
          range: Range.to(inlineValue.range),
          text: inlineValue.text
        };
      case "variable":
        return {
          range: Range.to(inlineValue.range),
          variableName: inlineValue.variableName,
          caseSensitiveLookup: inlineValue.caseSensitiveLookup
        };
      case "expression":
        return {
          range: Range.to(inlineValue.range),
          expression: inlineValue.expression
        };
    }
  }
  InlineValue2.to = to;
})(InlineValue || (InlineValue = {}));
var InlineValueContext;
((InlineValueContext2) => {
  function from(inlineValueContext) {
    return {
      frameId: inlineValueContext.frameId,
      stoppedLocation: Range.from(inlineValueContext.stoppedLocation)
    };
  }
  InlineValueContext2.from = from;
  function to(inlineValueContext) {
    return new types.InlineValueContext(inlineValueContext.frameId, Range.to(inlineValueContext.stoppedLocation));
  }
  InlineValueContext2.to = to;
})(InlineValueContext || (InlineValueContext = {}));
var DocumentHighlight;
((DocumentHighlight2) => {
  function from(documentHighlight) {
    return {
      range: Range.from(documentHighlight.range),
      kind: documentHighlight.kind
    };
  }
  DocumentHighlight2.from = from;
  function to(occurrence) {
    return new types.DocumentHighlight(Range.to(occurrence.range), occurrence.kind);
  }
  DocumentHighlight2.to = to;
})(DocumentHighlight || (DocumentHighlight = {}));
var MultiDocumentHighlight;
((MultiDocumentHighlight2) => {
  function from(multiDocumentHighlight) {
    return {
      uri: multiDocumentHighlight.uri,
      highlights: multiDocumentHighlight.highlights.map(DocumentHighlight.from)
    };
  }
  MultiDocumentHighlight2.from = from;
  function to(multiDocumentHighlight) {
    return new types.MultiDocumentHighlight(URI.revive(multiDocumentHighlight.uri), multiDocumentHighlight.highlights.map(DocumentHighlight.to));
  }
  MultiDocumentHighlight2.to = to;
})(MultiDocumentHighlight || (MultiDocumentHighlight = {}));
var CompletionTriggerKind;
((CompletionTriggerKind2) => {
  function to(kind) {
    switch (kind) {
      case languages.CompletionTriggerKind.TriggerCharacter:
        return types.CompletionTriggerKind.TriggerCharacter;
      case languages.CompletionTriggerKind.TriggerForIncompleteCompletions:
        return types.CompletionTriggerKind.TriggerForIncompleteCompletions;
      case languages.CompletionTriggerKind.Invoke:
      default:
        return types.CompletionTriggerKind.Invoke;
    }
  }
  CompletionTriggerKind2.to = to;
})(CompletionTriggerKind || (CompletionTriggerKind = {}));
var CompletionContext;
((CompletionContext2) => {
  function to(context) {
    return {
      triggerKind: CompletionTriggerKind.to(context.triggerKind),
      triggerCharacter: context.triggerCharacter
    };
  }
  CompletionContext2.to = to;
})(CompletionContext || (CompletionContext = {}));
var CompletionItemTag;
((CompletionItemTag2) => {
  function from(kind) {
    switch (kind) {
      case types.CompletionItemTag.Deprecated:
        return languages.CompletionItemTag.Deprecated;
    }
  }
  CompletionItemTag2.from = from;
  function to(kind) {
    switch (kind) {
      case languages.CompletionItemTag.Deprecated:
        return types.CompletionItemTag.Deprecated;
    }
  }
  CompletionItemTag2.to = to;
})(CompletionItemTag || (CompletionItemTag = {}));
var CompletionItemKind;
((CompletionItemKind2) => {
  const _from = /* @__PURE__ */ new Map([
    [types.CompletionItemKind.Method, languages.CompletionItemKind.Method],
    [types.CompletionItemKind.Function, languages.CompletionItemKind.Function],
    [types.CompletionItemKind.Constructor, languages.CompletionItemKind.Constructor],
    [types.CompletionItemKind.Field, languages.CompletionItemKind.Field],
    [types.CompletionItemKind.Variable, languages.CompletionItemKind.Variable],
    [types.CompletionItemKind.Class, languages.CompletionItemKind.Class],
    [types.CompletionItemKind.Interface, languages.CompletionItemKind.Interface],
    [types.CompletionItemKind.Struct, languages.CompletionItemKind.Struct],
    [types.CompletionItemKind.Module, languages.CompletionItemKind.Module],
    [types.CompletionItemKind.Property, languages.CompletionItemKind.Property],
    [types.CompletionItemKind.Unit, languages.CompletionItemKind.Unit],
    [types.CompletionItemKind.Value, languages.CompletionItemKind.Value],
    [types.CompletionItemKind.Constant, languages.CompletionItemKind.Constant],
    [types.CompletionItemKind.Enum, languages.CompletionItemKind.Enum],
    [types.CompletionItemKind.EnumMember, languages.CompletionItemKind.EnumMember],
    [types.CompletionItemKind.Keyword, languages.CompletionItemKind.Keyword],
    [types.CompletionItemKind.Snippet, languages.CompletionItemKind.Snippet],
    [types.CompletionItemKind.Text, languages.CompletionItemKind.Text],
    [types.CompletionItemKind.Color, languages.CompletionItemKind.Color],
    [types.CompletionItemKind.File, languages.CompletionItemKind.File],
    [types.CompletionItemKind.Reference, languages.CompletionItemKind.Reference],
    [types.CompletionItemKind.Folder, languages.CompletionItemKind.Folder],
    [types.CompletionItemKind.Event, languages.CompletionItemKind.Event],
    [types.CompletionItemKind.Operator, languages.CompletionItemKind.Operator],
    [types.CompletionItemKind.TypeParameter, languages.CompletionItemKind.TypeParameter],
    [types.CompletionItemKind.Issue, languages.CompletionItemKind.Issue],
    [types.CompletionItemKind.User, languages.CompletionItemKind.User]
  ]);
  function from(kind) {
    return _from.get(kind) ?? languages.CompletionItemKind.Property;
  }
  CompletionItemKind2.from = from;
  const _to = /* @__PURE__ */ new Map([
    [languages.CompletionItemKind.Method, types.CompletionItemKind.Method],
    [languages.CompletionItemKind.Function, types.CompletionItemKind.Function],
    [languages.CompletionItemKind.Constructor, types.CompletionItemKind.Constructor],
    [languages.CompletionItemKind.Field, types.CompletionItemKind.Field],
    [languages.CompletionItemKind.Variable, types.CompletionItemKind.Variable],
    [languages.CompletionItemKind.Class, types.CompletionItemKind.Class],
    [languages.CompletionItemKind.Interface, types.CompletionItemKind.Interface],
    [languages.CompletionItemKind.Struct, types.CompletionItemKind.Struct],
    [languages.CompletionItemKind.Module, types.CompletionItemKind.Module],
    [languages.CompletionItemKind.Property, types.CompletionItemKind.Property],
    [languages.CompletionItemKind.Unit, types.CompletionItemKind.Unit],
    [languages.CompletionItemKind.Value, types.CompletionItemKind.Value],
    [languages.CompletionItemKind.Constant, types.CompletionItemKind.Constant],
    [languages.CompletionItemKind.Enum, types.CompletionItemKind.Enum],
    [languages.CompletionItemKind.EnumMember, types.CompletionItemKind.EnumMember],
    [languages.CompletionItemKind.Keyword, types.CompletionItemKind.Keyword],
    [languages.CompletionItemKind.Snippet, types.CompletionItemKind.Snippet],
    [languages.CompletionItemKind.Text, types.CompletionItemKind.Text],
    [languages.CompletionItemKind.Color, types.CompletionItemKind.Color],
    [languages.CompletionItemKind.File, types.CompletionItemKind.File],
    [languages.CompletionItemKind.Reference, types.CompletionItemKind.Reference],
    [languages.CompletionItemKind.Folder, types.CompletionItemKind.Folder],
    [languages.CompletionItemKind.Event, types.CompletionItemKind.Event],
    [languages.CompletionItemKind.Operator, types.CompletionItemKind.Operator],
    [languages.CompletionItemKind.TypeParameter, types.CompletionItemKind.TypeParameter],
    [languages.CompletionItemKind.User, types.CompletionItemKind.User],
    [languages.CompletionItemKind.Issue, types.CompletionItemKind.Issue]
  ]);
  function to(kind) {
    return _to.get(kind) ?? types.CompletionItemKind.Property;
  }
  CompletionItemKind2.to = to;
})(CompletionItemKind || (CompletionItemKind = {}));
var CompletionItem;
((CompletionItem2) => {
  function to(suggestion, converter) {
    const result = new types.CompletionItem(suggestion.label);
    result.insertText = suggestion.insertText;
    result.kind = CompletionItemKind.to(suggestion.kind);
    result.tags = suggestion.tags?.map(CompletionItemTag.to);
    result.detail = suggestion.detail;
    result.documentation = htmlContent.isMarkdownString(suggestion.documentation) ? MarkdownString.to(suggestion.documentation) : suggestion.documentation;
    result.sortText = suggestion.sortText;
    result.filterText = suggestion.filterText;
    result.preselect = suggestion.preselect;
    result.commitCharacters = suggestion.commitCharacters;
    if (editorRange.Range.isIRange(suggestion.range)) {
      result.range = Range.to(suggestion.range);
    } else if (typeof suggestion.range === "object") {
      result.range = { inserting: Range.to(suggestion.range.insert), replacing: Range.to(suggestion.range.replace) };
    }
    result.keepWhitespace = typeof suggestion.insertTextRules === "undefined" ? false : Boolean(suggestion.insertTextRules & languages.CompletionItemInsertTextRule.KeepWhitespace);
    if (typeof suggestion.insertTextRules !== "undefined" && suggestion.insertTextRules & languages.CompletionItemInsertTextRule.InsertAsSnippet) {
      result.insertText = new types.SnippetString(suggestion.insertText);
    } else {
      result.insertText = suggestion.insertText;
      result.textEdit = result.range instanceof types.Range ? new types.TextEdit(result.range, result.insertText) : void 0;
    }
    if (suggestion.additionalTextEdits && suggestion.additionalTextEdits.length > 0) {
      result.additionalTextEdits = suggestion.additionalTextEdits.map((e) => TextEdit.to(e));
    }
    result.command = converter && suggestion.command ? converter.fromInternal(suggestion.command) : void 0;
    return result;
  }
  CompletionItem2.to = to;
})(CompletionItem || (CompletionItem = {}));
var ParameterInformation;
((ParameterInformation2) => {
  function from(info) {
    if (typeof info.label !== "string" && !Array.isArray(info.label)) {
      throw new TypeError("Invalid label");
    }
    return {
      label: info.label,
      documentation: MarkdownString.fromStrict(info.documentation)
    };
  }
  ParameterInformation2.from = from;
  function to(info) {
    return {
      label: info.label,
      documentation: htmlContent.isMarkdownString(info.documentation) ? MarkdownString.to(info.documentation) : info.documentation
    };
  }
  ParameterInformation2.to = to;
})(ParameterInformation || (ParameterInformation = {}));
var SignatureInformation;
((SignatureInformation2) => {
  function from(info) {
    return {
      label: info.label,
      documentation: MarkdownString.fromStrict(info.documentation),
      parameters: Array.isArray(info.parameters) ? info.parameters.map(ParameterInformation.from) : [],
      activeParameter: info.activeParameter
    };
  }
  SignatureInformation2.from = from;
  function to(info) {
    return {
      label: info.label,
      documentation: htmlContent.isMarkdownString(info.documentation) ? MarkdownString.to(info.documentation) : info.documentation,
      parameters: Array.isArray(info.parameters) ? info.parameters.map(ParameterInformation.to) : [],
      activeParameter: info.activeParameter
    };
  }
  SignatureInformation2.to = to;
})(SignatureInformation || (SignatureInformation = {}));
var SignatureHelp;
((SignatureHelp2) => {
  function from(help) {
    return {
      activeSignature: help.activeSignature,
      activeParameter: help.activeParameter,
      signatures: Array.isArray(help.signatures) ? help.signatures.map(SignatureInformation.from) : []
    };
  }
  SignatureHelp2.from = from;
  function to(help) {
    return {
      activeSignature: help.activeSignature,
      activeParameter: help.activeParameter,
      signatures: Array.isArray(help.signatures) ? help.signatures.map(SignatureInformation.to) : []
    };
  }
  SignatureHelp2.to = to;
})(SignatureHelp || (SignatureHelp = {}));
var InlayHint;
((InlayHint2) => {
  function to(converter, hint) {
    const res = new types.InlayHint(
      Position.to(hint.position),
      typeof hint.label === "string" ? hint.label : hint.label.map(InlayHintLabelPart.to.bind(void 0, converter)),
      hint.kind && InlayHintKind.to(hint.kind)
    );
    res.textEdits = hint.textEdits && hint.textEdits.map(TextEdit.to);
    res.tooltip = htmlContent.isMarkdownString(hint.tooltip) ? MarkdownString.to(hint.tooltip) : hint.tooltip;
    res.paddingLeft = hint.paddingLeft;
    res.paddingRight = hint.paddingRight;
    return res;
  }
  InlayHint2.to = to;
})(InlayHint || (InlayHint = {}));
var InlayHintLabelPart;
((InlayHintLabelPart2) => {
  function to(converter, part) {
    const result = new types.InlayHintLabelPart(part.label);
    result.tooltip = htmlContent.isMarkdownString(part.tooltip) ? MarkdownString.to(part.tooltip) : part.tooltip;
    if (languages.Command.is(part.command)) {
      result.command = converter.fromInternal(part.command);
    }
    if (part.location) {
      result.location = location.to(part.location);
    }
    return result;
  }
  InlayHintLabelPart2.to = to;
})(InlayHintLabelPart || (InlayHintLabelPart = {}));
var InlayHintKind;
((InlayHintKind2) => {
  function from(kind) {
    return kind;
  }
  InlayHintKind2.from = from;
  function to(kind) {
    return kind;
  }
  InlayHintKind2.to = to;
})(InlayHintKind || (InlayHintKind = {}));
var DocumentLink;
((DocumentLink2) => {
  function from(link) {
    return {
      range: Range.from(link.range),
      url: link.target,
      tooltip: link.tooltip
    };
  }
  DocumentLink2.from = from;
  function to(link) {
    let target = void 0;
    if (link.url) {
      try {
        target = typeof link.url === "string" ? URI.parse(link.url, true) : URI.revive(link.url);
      } catch (err) {
      }
    }
    const result = new types.DocumentLink(Range.to(link.range), target);
    result.tooltip = link.tooltip;
    return result;
  }
  DocumentLink2.to = to;
})(DocumentLink || (DocumentLink = {}));
var ColorPresentation;
((ColorPresentation2) => {
  function to(colorPresentation) {
    const cp = new types.ColorPresentation(colorPresentation.label);
    if (colorPresentation.textEdit) {
      cp.textEdit = TextEdit.to(colorPresentation.textEdit);
    }
    if (colorPresentation.additionalTextEdits) {
      cp.additionalTextEdits = colorPresentation.additionalTextEdits.map((value) => TextEdit.to(value));
    }
    return cp;
  }
  ColorPresentation2.to = to;
  function from(colorPresentation) {
    return {
      label: colorPresentation.label,
      textEdit: colorPresentation.textEdit ? TextEdit.from(colorPresentation.textEdit) : void 0,
      additionalTextEdits: colorPresentation.additionalTextEdits ? colorPresentation.additionalTextEdits.map((value) => TextEdit.from(value)) : void 0
    };
  }
  ColorPresentation2.from = from;
})(ColorPresentation || (ColorPresentation = {}));
var Color;
((Color2) => {
  function to(c) {
    return new types.Color(c[0], c[1], c[2], c[3]);
  }
  Color2.to = to;
  function from(color) {
    return [color.red, color.green, color.blue, color.alpha];
  }
  Color2.from = from;
})(Color || (Color = {}));
var SelectionRange;
((SelectionRange2) => {
  function from(obj) {
    return { range: Range.from(obj.range) };
  }
  SelectionRange2.from = from;
  function to(obj) {
    return new types.SelectionRange(Range.to(obj.range));
  }
  SelectionRange2.to = to;
})(SelectionRange || (SelectionRange = {}));
var TextDocumentSaveReason;
((TextDocumentSaveReason2) => {
  function to(reason) {
    switch (reason) {
      case SaveReason.AUTO:
        return types.TextDocumentSaveReason.AfterDelay;
      case SaveReason.EXPLICIT:
        return types.TextDocumentSaveReason.Manual;
      case SaveReason.FOCUS_CHANGE:
      case SaveReason.WINDOW_CHANGE:
        return types.TextDocumentSaveReason.FocusOut;
    }
  }
  TextDocumentSaveReason2.to = to;
})(TextDocumentSaveReason || (TextDocumentSaveReason = {}));
var TextEditorLineNumbersStyle;
((TextEditorLineNumbersStyle2) => {
  function from(style) {
    switch (style) {
      case types.TextEditorLineNumbersStyle.Off:
        return RenderLineNumbersType.Off;
      case types.TextEditorLineNumbersStyle.Relative:
        return RenderLineNumbersType.Relative;
      case types.TextEditorLineNumbersStyle.Interval:
        return RenderLineNumbersType.Interval;
      case types.TextEditorLineNumbersStyle.On:
      default:
        return RenderLineNumbersType.On;
    }
  }
  TextEditorLineNumbersStyle2.from = from;
  function to(style) {
    switch (style) {
      case RenderLineNumbersType.Off:
        return types.TextEditorLineNumbersStyle.Off;
      case RenderLineNumbersType.Relative:
        return types.TextEditorLineNumbersStyle.Relative;
      case RenderLineNumbersType.Interval:
        return types.TextEditorLineNumbersStyle.Interval;
      case RenderLineNumbersType.On:
      default:
        return types.TextEditorLineNumbersStyle.On;
    }
  }
  TextEditorLineNumbersStyle2.to = to;
})(TextEditorLineNumbersStyle || (TextEditorLineNumbersStyle = {}));
var EndOfLine;
((EndOfLine2) => {
  function from(eol) {
    if (eol === types.EndOfLine.CRLF) {
      return EndOfLineSequence.CRLF;
    } else if (eol === types.EndOfLine.LF) {
      return EndOfLineSequence.LF;
    }
    return void 0;
  }
  EndOfLine2.from = from;
  function to(eol) {
    if (eol === EndOfLineSequence.CRLF) {
      return types.EndOfLine.CRLF;
    } else if (eol === EndOfLineSequence.LF) {
      return types.EndOfLine.LF;
    }
    return void 0;
  }
  EndOfLine2.to = to;
})(EndOfLine || (EndOfLine = {}));
var ProgressLocation;
((ProgressLocation2) => {
  function from(loc) {
    if (typeof loc === "object") {
      return loc.viewId;
    }
    switch (loc) {
      case types.ProgressLocation.SourceControl:
        return MainProgressLocation.Scm;
      case types.ProgressLocation.Window:
        return MainProgressLocation.Window;
      case types.ProgressLocation.Notification:
        return MainProgressLocation.Notification;
    }
    throw new Error(`Unknown 'ProgressLocation'`);
  }
  ProgressLocation2.from = from;
})(ProgressLocation || (ProgressLocation = {}));
var FoldingRange;
((FoldingRange2) => {
  function from(r) {
    const range = { start: r.start + 1, end: r.end + 1 };
    if (r.kind) {
      range.kind = FoldingRangeKind.from(r.kind);
    }
    return range;
  }
  FoldingRange2.from = from;
  function to(r) {
    const range = { start: r.start - 1, end: r.end - 1 };
    if (r.kind) {
      range.kind = FoldingRangeKind.to(r.kind);
    }
    return range;
  }
  FoldingRange2.to = to;
})(FoldingRange || (FoldingRange = {}));
var FoldingRangeKind;
((FoldingRangeKind2) => {
  function from(kind) {
    if (kind) {
      switch (kind) {
        case types.FoldingRangeKind.Comment:
          return languages.FoldingRangeKind.Comment;
        case types.FoldingRangeKind.Imports:
          return languages.FoldingRangeKind.Imports;
        case types.FoldingRangeKind.Region:
          return languages.FoldingRangeKind.Region;
      }
    }
    return void 0;
  }
  FoldingRangeKind2.from = from;
  function to(kind) {
    if (kind) {
      switch (kind.value) {
        case languages.FoldingRangeKind.Comment.value:
          return types.FoldingRangeKind.Comment;
        case languages.FoldingRangeKind.Imports.value:
          return types.FoldingRangeKind.Imports;
        case languages.FoldingRangeKind.Region.value:
          return types.FoldingRangeKind.Region;
      }
    }
    return void 0;
  }
  FoldingRangeKind2.to = to;
})(FoldingRangeKind || (FoldingRangeKind = {}));
var TextEditorOpenOptions;
((TextEditorOpenOptions2) => {
  function from(options) {
    if (options) {
      return {
        pinned: typeof options.preview === "boolean" ? !options.preview : void 0,
        inactive: options.background,
        preserveFocus: options.preserveFocus,
        selection: typeof options.selection === "object" ? Range.from(options.selection) : void 0,
        override: typeof options.override === "boolean" ? DEFAULT_EDITOR_ASSOCIATION.id : void 0
      };
    }
    return void 0;
  }
  TextEditorOpenOptions2.from = from;
})(TextEditorOpenOptions || (TextEditorOpenOptions = {}));
var GlobPattern;
((GlobPattern2) => {
  function from(pattern) {
    if (pattern instanceof types.RelativePattern) {
      return pattern.toJSON();
    }
    if (typeof pattern === "string") {
      return pattern;
    }
    if (isRelativePatternShape(pattern) || isLegacyRelativePatternShape(pattern)) {
      return new types.RelativePattern(pattern.baseUri ?? pattern.base, pattern.pattern).toJSON();
    }
    return pattern;
  }
  GlobPattern2.from = from;
  function isRelativePatternShape(obj) {
    const rp = obj;
    if (!rp) {
      return false;
    }
    return URI.isUri(rp.baseUri) && typeof rp.pattern === "string";
  }
  function isLegacyRelativePatternShape(obj) {
    const rp = obj;
    if (!rp) {
      return false;
    }
    return typeof rp.base === "string" && typeof rp.pattern === "string";
  }
  function to(pattern) {
    if (typeof pattern === "string") {
      return pattern;
    }
    return new types.RelativePattern(URI.revive(pattern.baseUri), pattern.pattern);
  }
  GlobPattern2.to = to;
})(GlobPattern || (GlobPattern = {}));
var LanguageSelector;
((LanguageSelector2) => {
  function from(selector) {
    if (!selector) {
      return void 0;
    } else if (Array.isArray(selector)) {
      return selector.map(from);
    } else if (typeof selector === "string") {
      return selector;
    } else {
      const filter = selector;
      return {
        language: filter.language,
        scheme: filter.scheme,
        pattern: GlobPattern.from(filter.pattern) ?? void 0,
        exclusive: filter.exclusive,
        notebookType: filter.notebookType
      };
    }
  }
  LanguageSelector2.from = from;
})(LanguageSelector || (LanguageSelector = {}));
var NotebookRange;
((NotebookRange2) => {
  function from(range) {
    return { start: range.start, end: range.end };
  }
  NotebookRange2.from = from;
  function to(range) {
    return new types.NotebookRange(range.start, range.end);
  }
  NotebookRange2.to = to;
})(NotebookRange || (NotebookRange = {}));
var NotebookCellExecutionSummary;
((NotebookCellExecutionSummary2) => {
  function to(data) {
    return {
      timing: typeof data.runStartTime === "number" && typeof data.runEndTime === "number" ? { startTime: data.runStartTime, endTime: data.runEndTime } : void 0,
      executionOrder: data.executionOrder,
      success: data.lastRunSuccess
    };
  }
  NotebookCellExecutionSummary2.to = to;
  function from(data) {
    return {
      lastRunSuccess: data.success,
      runStartTime: data.timing?.startTime,
      runEndTime: data.timing?.endTime,
      executionOrder: data.executionOrder
    };
  }
  NotebookCellExecutionSummary2.from = from;
})(NotebookCellExecutionSummary || (NotebookCellExecutionSummary = {}));
var NotebookCellExecutionState;
((NotebookCellExecutionState2) => {
  function to(state) {
    if (state === notebooks.NotebookCellExecutionState.Unconfirmed) {
      return types.NotebookCellExecutionState.Pending;
    } else if (state === notebooks.NotebookCellExecutionState.Pending) {
      return void 0;
    } else if (state === notebooks.NotebookCellExecutionState.Executing) {
      return types.NotebookCellExecutionState.Executing;
    } else {
      throw new Error(`Unknown state: ${state}`);
    }
  }
  NotebookCellExecutionState2.to = to;
})(NotebookCellExecutionState || (NotebookCellExecutionState = {}));
var NotebookCellKind;
((NotebookCellKind2) => {
  function from(data) {
    switch (data) {
      case types.NotebookCellKind.Markup:
        return notebooks.CellKind.Markup;
      case types.NotebookCellKind.Code:
      default:
        return notebooks.CellKind.Code;
    }
  }
  NotebookCellKind2.from = from;
  function to(data) {
    switch (data) {
      case notebooks.CellKind.Markup:
        return types.NotebookCellKind.Markup;
      case notebooks.CellKind.Code:
      default:
        return types.NotebookCellKind.Code;
    }
  }
  NotebookCellKind2.to = to;
})(NotebookCellKind || (NotebookCellKind = {}));
var NotebookData;
((NotebookData2) => {
  function from(data) {
    const res = {
      metadata: data.metadata ?? /* @__PURE__ */ Object.create(null),
      cells: []
    };
    for (const cell of data.cells) {
      types.NotebookCellData.validate(cell);
      res.cells.push(NotebookCellData.from(cell));
    }
    return res;
  }
  NotebookData2.from = from;
  function to(data) {
    const res = new types.NotebookData(
      data.cells.map(NotebookCellData.to)
    );
    if (!isEmptyObject(data.metadata)) {
      res.metadata = data.metadata;
    }
    return res;
  }
  NotebookData2.to = to;
})(NotebookData || (NotebookData = {}));
var NotebookCellData;
((NotebookCellData2) => {
  function from(data) {
    return {
      cellKind: NotebookCellKind.from(data.kind),
      language: data.languageId,
      mime: data.mime,
      source: data.value,
      metadata: data.metadata,
      internalMetadata: NotebookCellExecutionSummary.from(data.executionSummary ?? {}),
      outputs: data.outputs ? data.outputs.map(NotebookCellOutput.from) : []
    };
  }
  NotebookCellData2.from = from;
  function to(data) {
    return new types.NotebookCellData(
      NotebookCellKind.to(data.cellKind),
      data.source,
      data.language,
      data.mime,
      data.outputs ? data.outputs.map(NotebookCellOutput.to) : void 0,
      data.metadata,
      data.internalMetadata ? NotebookCellExecutionSummary.to(data.internalMetadata) : void 0
    );
  }
  NotebookCellData2.to = to;
})(NotebookCellData || (NotebookCellData = {}));
var NotebookCellOutputItem;
((NotebookCellOutputItem2) => {
  function from(item) {
    return {
      mime: item.mime,
      valueBytes: VSBuffer.wrap(item.data)
    };
  }
  NotebookCellOutputItem2.from = from;
  function to(item) {
    return new types.NotebookCellOutputItem(item.valueBytes.buffer, item.mime);
  }
  NotebookCellOutputItem2.to = to;
})(NotebookCellOutputItem || (NotebookCellOutputItem = {}));
var NotebookCellOutput;
((NotebookCellOutput2) => {
  function from(output) {
    return {
      outputId: output.id,
      items: output.items.map(NotebookCellOutputItem.from),
      metadata: output.metadata
    };
  }
  NotebookCellOutput2.from = from;
  function to(output) {
    const items = output.items.map(NotebookCellOutputItem.to);
    return new types.NotebookCellOutput(items, output.outputId, output.metadata);
  }
  NotebookCellOutput2.to = to;
})(NotebookCellOutput || (NotebookCellOutput = {}));
var NotebookExclusiveDocumentPattern;
((NotebookExclusiveDocumentPattern2) => {
  function from(pattern) {
    if (isExclusivePattern(pattern)) {
      return {
        include: GlobPattern.from(pattern.include) ?? void 0,
        exclude: GlobPattern.from(pattern.exclude) ?? void 0
      };
    }
    return GlobPattern.from(pattern) ?? void 0;
  }
  NotebookExclusiveDocumentPattern2.from = from;
  function to(pattern) {
    if (isExclusivePattern(pattern)) {
      return {
        include: GlobPattern.to(pattern.include),
        exclude: GlobPattern.to(pattern.exclude)
      };
    }
    return GlobPattern.to(pattern);
  }
  NotebookExclusiveDocumentPattern2.to = to;
  function isExclusivePattern(obj) {
    const ep = obj;
    if (!ep) {
      return false;
    }
    return !isUndefinedOrNull(ep.include) && !isUndefinedOrNull(ep.exclude);
  }
})(NotebookExclusiveDocumentPattern || (NotebookExclusiveDocumentPattern = {}));
var NotebookStatusBarItem;
((NotebookStatusBarItem2) => {
  function from(item, commandsConverter, disposables) {
    const command = typeof item.command === "string" ? { title: "", command: item.command } : item.command;
    return {
      alignment: item.alignment === types.NotebookCellStatusBarAlignment.Left ? notebooks.CellStatusbarAlignment.Left : notebooks.CellStatusbarAlignment.Right,
      command: commandsConverter.toInternal(command, disposables),
      // TODO@roblou
      text: item.text,
      tooltip: item.tooltip,
      accessibilityInformation: item.accessibilityInformation,
      priority: item.priority
    };
  }
  NotebookStatusBarItem2.from = from;
})(NotebookStatusBarItem || (NotebookStatusBarItem = {}));
var NotebookKernelSourceAction;
((NotebookKernelSourceAction2) => {
  function from(item, commandsConverter, disposables) {
    const command = typeof item.command === "string" ? { title: "", command: item.command } : item.command;
    return {
      command: commandsConverter.toInternal(command, disposables),
      label: item.label,
      description: item.description,
      detail: item.detail,
      documentation: item.documentation
    };
  }
  NotebookKernelSourceAction2.from = from;
})(NotebookKernelSourceAction || (NotebookKernelSourceAction = {}));
var NotebookDocumentContentOptions;
((NotebookDocumentContentOptions2) => {
  function from(options) {
    return {
      transientOutputs: options?.transientOutputs ?? false,
      transientCellMetadata: options?.transientCellMetadata ?? {},
      transientDocumentMetadata: options?.transientDocumentMetadata ?? {},
      cellContentMetadata: options?.cellContentMetadata ?? {}
    };
  }
  NotebookDocumentContentOptions2.from = from;
})(NotebookDocumentContentOptions || (NotebookDocumentContentOptions = {}));
var NotebookRendererScript;
((NotebookRendererScript2) => {
  function from(preload) {
    return {
      uri: preload.uri,
      provides: preload.provides
    };
  }
  NotebookRendererScript2.from = from;
  function to(preload) {
    return new types.NotebookRendererScript(URI.revive(preload.uri), preload.provides);
  }
  NotebookRendererScript2.to = to;
})(NotebookRendererScript || (NotebookRendererScript = {}));
var TestMessage;
((TestMessage2) => {
  function from(message) {
    return {
      message: MarkdownString.fromStrict(message.message) || "",
      type: TestMessageType.Error,
      expected: message.expectedOutput,
      actual: message.actualOutput,
      contextValue: message.contextValue,
      location: message.location && { range: Range.from(message.location.range), uri: message.location.uri },
      stackTrace: message.stackTrace?.map((s) => ({
        label: s.label,
        position: s.position && Position.from(s.position),
        uri: s.uri && URI.revive(s.uri).toJSON()
      }))
    };
  }
  TestMessage2.from = from;
  function to(item) {
    const message = new types.TestMessage(typeof item.message === "string" ? item.message : MarkdownString.to(item.message));
    message.actualOutput = item.actual;
    message.expectedOutput = item.expected;
    message.contextValue = item.contextValue;
    message.location = item.location ? location.to(item.location) : void 0;
    return message;
  }
  TestMessage2.to = to;
})(TestMessage || (TestMessage = {}));
var TestTag;
((TestTag2) => {
  TestTag2.namespace = namespaceTestTag;
  TestTag2.denamespace = denamespaceTestTag;
})(TestTag || (TestTag = {}));
var TestRunProfile;
((TestRunProfile2) => {
  function from(item) {
    return {
      controllerId: item.controllerId,
      profileId: item.profileId,
      group: TestRunProfileKind.from(item.kind)
    };
  }
  TestRunProfile2.from = from;
})(TestRunProfile || (TestRunProfile = {}));
var TestRunProfileKind;
((TestRunProfileKind2) => {
  const profileGroupToBitset = {
    [types.TestRunProfileKind.Coverage]: TestRunProfileBitset.Coverage,
    [types.TestRunProfileKind.Debug]: TestRunProfileBitset.Debug,
    [types.TestRunProfileKind.Run]: TestRunProfileBitset.Run
  };
  function from(kind) {
    return profileGroupToBitset.hasOwnProperty(kind) ? profileGroupToBitset[kind] : TestRunProfileBitset.Run;
  }
  TestRunProfileKind2.from = from;
})(TestRunProfileKind || (TestRunProfileKind = {}));
var TestItem;
((TestItem2) => {
  function from(item) {
    const ctrlId = getPrivateApiFor(item).controllerId;
    return {
      extId: TestId.fromExtHostTestItem(item, ctrlId).toString(),
      label: item.label,
      uri: URI.revive(item.uri),
      busy: item.busy,
      tags: item.tags.map((t) => TestTag.namespace(ctrlId, t.id)),
      range: editorRange.Range.lift(Range.from(item.range)),
      description: item.description || null,
      sortText: item.sortText || null,
      error: item.error ? MarkdownString.fromStrict(item.error) || null : null
    };
  }
  TestItem2.from = from;
  function toPlain(item) {
    return {
      parent: void 0,
      error: void 0,
      id: TestId.fromString(item.extId).localId,
      label: item.label,
      uri: URI.revive(item.uri),
      tags: (item.tags || []).map((t) => {
        const { tagId } = TestTag.denamespace(t);
        return new types.TestTag(tagId);
      }),
      children: {
        add: () => {
        },
        delete: () => {
        },
        forEach: () => {
        },
        *[Symbol.iterator]() {
        },
        get: () => void 0,
        replace: () => {
        },
        size: 0
      },
      range: Range.to(item.range || void 0),
      canResolveChildren: false,
      busy: item.busy,
      description: item.description || void 0,
      sortText: item.sortText || void 0
    };
  }
  TestItem2.toPlain = toPlain;
})(TestItem || (TestItem = {}));
((TestTag2) => {
  function from(tag) {
    return { id: tag.id };
  }
  TestTag2.from = from;
  function to(tag) {
    return new types.TestTag(tag.id);
  }
  TestTag2.to = to;
})(TestTag || (TestTag = {}));
var TestResults;
((TestResults2) => {
  const convertTestResultItem = (node, parent) => {
    const item = node.value;
    if (!item) {
      return void 0;
    }
    const snapshot = {
      ...TestItem.toPlain(item.item),
      parent,
      taskStates: item.tasks.map((t) => ({
        state: t.state,
        duration: t.duration,
        messages: t.messages.filter((m) => m.type === TestMessageType.Error).map(TestMessage.to)
      })),
      children: []
    };
    if (node.children) {
      for (const child of node.children.values()) {
        const c = convertTestResultItem(child, snapshot);
        if (c) {
          snapshot.children.push(c);
        }
      }
    }
    return snapshot;
  };
  function to(serialized) {
    const tree = new WellDefinedPrefixTree();
    for (const item of serialized.items) {
      tree.insert(TestId.fromString(item.item.extId).path, item);
    }
    const queue = [tree.nodes];
    const roots = [];
    while (queue.length) {
      for (const node of queue.pop()) {
        if (node.value) {
          roots.push(node);
        } else if (node.children) {
          queue.push(node.children.values());
        }
      }
    }
    return {
      completedAt: serialized.completedAt,
      results: roots.map((r) => convertTestResultItem(r)).filter(isDefined)
    };
  }
  TestResults2.to = to;
})(TestResults || (TestResults = {}));
var TestCoverage;
((TestCoverage2) => {
  function fromCoverageCount(count) {
    return { covered: count.covered, total: count.total };
  }
  function fromLocation(location2) {
    return "line" in location2 ? Position.from(location2) : Range.from(location2);
  }
  function toLocation(location2) {
    if (!location2) {
      return void 0;
    }
    return "endLineNumber" in location2 ? Range.to(location2) : Position.to(location2);
  }
  function to(serialized) {
    if (serialized.type === DetailType.Statement) {
      const branches = [];
      if (serialized.branches) {
        for (const branch of serialized.branches) {
          branches.push({
            executed: branch.count,
            location: toLocation(branch.location),
            label: branch.label
          });
        }
      }
      return new types.StatementCoverage(
        serialized.count,
        toLocation(serialized.location),
        serialized.branches?.map((b) => new types.BranchCoverage(
          b.count,
          toLocation(b.location),
          b.label
        ))
      );
    } else {
      return new types.DeclarationCoverage(
        serialized.name,
        serialized.count,
        toLocation(serialized.location)
      );
    }
  }
  TestCoverage2.to = to;
  function fromDetails(coverage) {
    if (typeof coverage.executed === "number" && coverage.executed < 0) {
      throw new Error(`Invalid coverage count ${coverage.executed}`);
    }
    if ("branches" in coverage) {
      return {
        count: coverage.executed,
        location: fromLocation(coverage.location),
        type: DetailType.Statement,
        branches: coverage.branches.length ? coverage.branches.map((b) => ({ count: b.executed, location: b.location && fromLocation(b.location), label: b.label })) : void 0
      };
    } else {
      return {
        type: DetailType.Declaration,
        name: coverage.name,
        count: coverage.executed,
        location: fromLocation(coverage.location)
      };
    }
  }
  TestCoverage2.fromDetails = fromDetails;
  function fromFile(controllerId, id, coverage) {
    types.validateTestCoverageCount(coverage.statementCoverage);
    types.validateTestCoverageCount(coverage.branchCoverage);
    types.validateTestCoverageCount(coverage.declarationCoverage);
    return {
      id,
      uri: coverage.uri,
      statement: fromCoverageCount(coverage.statementCoverage),
      branch: coverage.branchCoverage && fromCoverageCount(coverage.branchCoverage),
      declaration: coverage.declarationCoverage && fromCoverageCount(coverage.declarationCoverage),
      testIds: coverage instanceof types.FileCoverage && coverage.includesTests.length ? coverage.includesTests.map((t) => TestId.fromExtHostTestItem(t, controllerId).toString()) : void 0
    };
  }
  TestCoverage2.fromFile = fromFile;
})(TestCoverage || (TestCoverage = {}));
var CodeActionTriggerKind;
((CodeActionTriggerKind2) => {
  function to(value) {
    switch (value) {
      case languages.CodeActionTriggerType.Invoke:
        return types.CodeActionTriggerKind.Invoke;
      case languages.CodeActionTriggerType.Auto:
        return types.CodeActionTriggerKind.Automatic;
    }
  }
  CodeActionTriggerKind2.to = to;
})(CodeActionTriggerKind || (CodeActionTriggerKind = {}));
var TypeHierarchyItem;
((TypeHierarchyItem2) => {
  function to(item) {
    const result = new types.TypeHierarchyItem(
      SymbolKind.to(item.kind),
      item.name,
      item.detail || "",
      URI.revive(item.uri),
      Range.to(item.range),
      Range.to(item.selectionRange)
    );
    result._sessionId = item._sessionId;
    result._itemId = item._itemId;
    return result;
  }
  TypeHierarchyItem2.to = to;
  function from(item, sessionId, itemId) {
    sessionId = sessionId ?? item._sessionId;
    itemId = itemId ?? item._itemId;
    if (sessionId === void 0 || itemId === void 0) {
      throw new Error("invalid item");
    }
    return {
      _sessionId: sessionId,
      _itemId: itemId,
      kind: SymbolKind.from(item.kind),
      name: item.name,
      detail: item.detail ?? "",
      uri: item.uri,
      range: Range.from(item.range),
      selectionRange: Range.from(item.selectionRange),
      tags: item.tags?.map(SymbolTag.from)
    };
  }
  TypeHierarchyItem2.from = from;
})(TypeHierarchyItem || (TypeHierarchyItem = {}));
var ViewBadge;
((ViewBadge2) => {
  function from(badge) {
    if (!badge) {
      return void 0;
    }
    return {
      value: badge.value,
      tooltip: badge.tooltip
    };
  }
  ViewBadge2.from = from;
})(ViewBadge || (ViewBadge = {}));
var DataTransferItem;
((DataTransferItem2) => {
  function to(mime, item, resolveFileData) {
    const file = item.fileData;
    if (file) {
      return new types.InternalFileDataTransferItem(
        new types.DataTransferFile(file.name, URI.revive(file.uri), file.id, createSingleCallFunction(() => resolveFileData(file.id)))
      );
    }
    if (mime === Mimes.uriList && item.uriListData) {
      return new types.InternalDataTransferItem(reviveUriList(item.uriListData));
    }
    return new types.InternalDataTransferItem(item.asString);
  }
  DataTransferItem2.to = to;
  async function from(mime, item, id = generateUuid()) {
    const stringValue = await item.asString();
    if (mime === Mimes.uriList) {
      return {
        id,
        asString: stringValue,
        fileData: void 0,
        uriListData: serializeUriList(stringValue)
      };
    }
    const fileValue = item.asFile();
    return {
      id,
      asString: stringValue,
      fileData: fileValue ? {
        name: fileValue.name,
        uri: fileValue.uri,
        id: fileValue._itemId ?? fileValue.id
      } : void 0
    };
  }
  DataTransferItem2.from = from;
  function serializeUriList(stringValue) {
    return UriList.split(stringValue).map((part) => {
      if (part.startsWith("#")) {
        return part;
      }
      try {
        return URI.parse(part);
      } catch {
      }
      return part;
    });
  }
  function reviveUriList(parts) {
    return UriList.create(parts.map((part) => {
      return typeof part === "string" ? part : URI.revive(part);
    }));
  }
})(DataTransferItem || (DataTransferItem = {}));
var DataTransfer;
((DataTransfer2) => {
  function toDataTransfer(value, resolveFileData) {
    const init = value.items.map(([type, item]) => {
      return [type, DataTransferItem.to(type, item, resolveFileData)];
    });
    return new types.DataTransfer(init);
  }
  DataTransfer2.toDataTransfer = toDataTransfer;
  async function from(dataTransfer) {
    const items = await Promise.all(Array.from(dataTransfer, async ([mime, value]) => {
      return [mime, await DataTransferItem.from(mime, value)];
    }));
    return { items };
  }
  DataTransfer2.from = from;
  async function fromList(dataTransfer) {
    const items = await Promise.all(Array.from(dataTransfer, async ([mime, value]) => {
      return [mime, await DataTransferItem.from(mime, value, value.id)];
    }));
    return { items };
  }
  DataTransfer2.fromList = fromList;
})(DataTransfer || (DataTransfer = {}));
var ChatFollowup;
((ChatFollowup2) => {
  function from(followup, request) {
    return {
      kind: "reply",
      agentId: followup.participant ?? request?.agentId ?? "",
      subCommand: followup.command ?? request?.command,
      message: followup.prompt,
      title: followup.label
    };
  }
  ChatFollowup2.from = from;
  function to(followup) {
    return {
      prompt: followup.message,
      label: followup.title,
      participant: followup.agentId,
      command: followup.subCommand
    };
  }
  ChatFollowup2.to = to;
})(ChatFollowup || (ChatFollowup = {}));
var LanguageModelChatMessageRole;
((LanguageModelChatMessageRole2) => {
  function to(role) {
    switch (role) {
      case chatProvider.ChatMessageRole.System:
        return types.LanguageModelChatMessageRole.System;
      case chatProvider.ChatMessageRole.User:
        return types.LanguageModelChatMessageRole.User;
      case chatProvider.ChatMessageRole.Assistant:
        return types.LanguageModelChatMessageRole.Assistant;
    }
  }
  LanguageModelChatMessageRole2.to = to;
  function from(role) {
    switch (role) {
      case types.LanguageModelChatMessageRole.System:
        return chatProvider.ChatMessageRole.System;
      case types.LanguageModelChatMessageRole.User:
        return chatProvider.ChatMessageRole.User;
      case types.LanguageModelChatMessageRole.Assistant:
        return chatProvider.ChatMessageRole.Assistant;
    }
    return chatProvider.ChatMessageRole.User;
  }
  LanguageModelChatMessageRole2.from = from;
})(LanguageModelChatMessageRole || (LanguageModelChatMessageRole = {}));
var LanguageModelChatMessage;
((LanguageModelChatMessage3) => {
  function to(message) {
    const content = message.content.map((c) => {
      if (c.type === "text") {
        return new LanguageModelTextPart(c.value);
      } else if (c.type === "tool_result") {
        const content2 = c.value.map((part) => {
          if (part.type === "text") {
            return new types.LanguageModelTextPart(part.value);
          } else {
            return new types.LanguageModelPromptTsxPart(part.value);
          }
        });
        return new types.LanguageModelToolResultPart(c.toolCallId, content2, c.isError);
      } else if (c.type === "image_url") {
        return void 0;
      } else {
        return new types.LanguageModelToolCallPart(c.toolCallId, c.name, c.parameters);
      }
    }).filter((c) => c !== void 0);
    const role = LanguageModelChatMessageRole.to(message.role);
    const result = new types.LanguageModelChatMessage(role, content, message.name);
    return result;
  }
  LanguageModelChatMessage3.to = to;
  function from(message) {
    const role = LanguageModelChatMessageRole.from(message.role);
    const name = message.name;
    let messageContent = message.content;
    if (typeof messageContent === "string") {
      messageContent = [new types.LanguageModelTextPart(messageContent)];
    }
    const content = messageContent.map((c) => {
      if (c instanceof types.LanguageModelToolResultPart) {
        return {
          type: "tool_result",
          toolCallId: c.callId,
          value: coalesce(c.content.map((part) => {
            if (part instanceof types.LanguageModelTextPart) {
              return {
                type: "text",
                value: part.value
              };
            } else if (part instanceof types.LanguageModelPromptTsxPart) {
              return {
                type: "prompt_tsx",
                value: part.value
              };
            } else {
              return void 0;
            }
          })),
          isError: c.isError
        };
      } else if (c instanceof types.LanguageModelToolCallPart) {
        return {
          type: "tool_use",
          toolCallId: c.callId,
          name: c.name,
          parameters: c.input
        };
      } else if (c instanceof types.LanguageModelTextPart) {
        return {
          type: "text",
          value: c.value
        };
      } else {
        if (typeof c !== "string") {
          throw new Error("Unexpected chat message content type");
        }
        return {
          type: "text",
          value: c
        };
      }
    });
    return {
      role,
      name,
      content
    };
  }
  LanguageModelChatMessage3.from = from;
})(LanguageModelChatMessage || (LanguageModelChatMessage = {}));
var LanguageModelChatMessage2;
((LanguageModelChatMessage22) => {
  function to(message) {
    const content = message.content.map((c) => {
      if (c.type === "text") {
        return new LanguageModelTextPart(c.value);
      } else if (c.type === "tool_result") {
        const content2 = c.value.map((part) => {
          if (part.type === "text") {
            return new types.LanguageModelTextPart(part.value);
          } else {
            return new types.LanguageModelPromptTsxPart(part.value);
          }
        });
        return new types.LanguageModelToolResultPart(c.toolCallId, content2, c.isError);
      } else if (c.type === "image_url") {
        const value = {
          mimeType: c.value.mimeType,
          data: c.value.data.buffer
        };
        return new types.LanguageModelDataPart(value);
      } else {
        return new types.LanguageModelToolCallPart(c.toolCallId, c.name, c.parameters);
      }
    });
    const role = LanguageModelChatMessageRole.to(message.role);
    const result = new types.LanguageModelChatMessage2(role, content, message.name);
    return result;
  }
  LanguageModelChatMessage22.to = to;
  function from(message) {
    const role = LanguageModelChatMessageRole.from(message.role);
    const name = message.name;
    let messageContent = message.content;
    if (typeof messageContent === "string") {
      messageContent = [new types.LanguageModelTextPart(messageContent)];
    }
    const content = messageContent.map((c) => {
      if (c instanceof types.LanguageModelToolResultPart) {
        return {
          type: "tool_result",
          toolCallId: c.callId,
          value: coalesce(c.content.map((part) => {
            if (part instanceof types.LanguageModelTextPart) {
              return {
                type: "text",
                value: part.value
              };
            } else if (part instanceof types.LanguageModelPromptTsxPart) {
              return {
                type: "prompt_tsx",
                value: part.value
              };
            } else {
              return void 0;
            }
          })),
          isError: c.isError
        };
      } else if (c instanceof types.LanguageModelDataPart) {
        const value = {
          mimeType: c.value.mimeType,
          data: VSBuffer.wrap(c.value.data)
        };
        return {
          type: "image_url",
          value
        };
      } else if (c instanceof types.LanguageModelToolCallPart) {
        return {
          type: "tool_use",
          toolCallId: c.callId,
          name: c.name,
          parameters: c.input
        };
      } else if (c instanceof types.LanguageModelTextPart) {
        return {
          type: "text",
          value: c.value
        };
      } else {
        if (typeof c !== "string") {
          throw new Error("Unexpected chat message content type");
        }
        return {
          type: "text",
          value: c
        };
      }
    });
    return {
      role,
      name,
      content
    };
  }
  LanguageModelChatMessage22.from = from;
})(LanguageModelChatMessage2 || (LanguageModelChatMessage2 = {}));
var ChatResponseMarkdownPart;
((ChatResponseMarkdownPart2) => {
  function from(part) {
    return {
      kind: "markdownContent",
      content: MarkdownString.from(part.value)
    };
  }
  ChatResponseMarkdownPart2.from = from;
  function to(part) {
    return new types.ChatResponseMarkdownPart(MarkdownString.to(part.content));
  }
  ChatResponseMarkdownPart2.to = to;
})(ChatResponseMarkdownPart || (ChatResponseMarkdownPart = {}));
var ChatResponseCodeblockUriPart;
((ChatResponseCodeblockUriPart2) => {
  function from(part) {
    return {
      kind: "codeblockUri",
      uri: part.value,
      isEdit: part.isEdit
    };
  }
  ChatResponseCodeblockUriPart2.from = from;
  function to(part) {
    return new types.ChatResponseCodeblockUriPart(URI.revive(part.uri), part.isEdit);
  }
  ChatResponseCodeblockUriPart2.to = to;
})(ChatResponseCodeblockUriPart || (ChatResponseCodeblockUriPart = {}));
var ChatResponseMarkdownWithVulnerabilitiesPart;
((ChatResponseMarkdownWithVulnerabilitiesPart2) => {
  function from(part) {
    return {
      kind: "markdownVuln",
      content: MarkdownString.from(part.value),
      vulnerabilities: part.vulnerabilities
    };
  }
  ChatResponseMarkdownWithVulnerabilitiesPart2.from = from;
  function to(part) {
    return new types.ChatResponseMarkdownWithVulnerabilitiesPart(MarkdownString.to(part.content), part.vulnerabilities);
  }
  ChatResponseMarkdownWithVulnerabilitiesPart2.to = to;
})(ChatResponseMarkdownWithVulnerabilitiesPart || (ChatResponseMarkdownWithVulnerabilitiesPart = {}));
var ChatResponseConfirmationPart;
((ChatResponseConfirmationPart2) => {
  function from(part) {
    return {
      kind: "confirmation",
      title: part.title,
      message: part.message,
      data: part.data,
      buttons: part.buttons
    };
  }
  ChatResponseConfirmationPart2.from = from;
})(ChatResponseConfirmationPart || (ChatResponseConfirmationPart = {}));
var ChatResponseFilesPart;
((ChatResponseFilesPart2) => {
  function from(part) {
    const { value, baseUri } = part;
    function convert(items, baseUri2) {
      return items.map((item) => {
        const myUri = URI.joinPath(baseUri2, item.name);
        return {
          label: item.name,
          uri: myUri,
          children: item.children && convert(item.children, myUri)
        };
      });
    }
    return {
      kind: "treeData",
      treeData: {
        label: basename(baseUri),
        uri: baseUri,
        children: convert(value, baseUri)
      }
    };
  }
  ChatResponseFilesPart2.from = from;
  function to(part) {
    const treeData = revive(part.treeData);
    function convert(items2) {
      return items2.map((item) => {
        return {
          name: item.label,
          children: item.children && convert(item.children)
        };
      });
    }
    const baseUri = treeData.uri;
    const items = treeData.children ? convert(treeData.children) : [];
    return new types.ChatResponseFileTreePart(items, baseUri);
  }
  ChatResponseFilesPart2.to = to;
})(ChatResponseFilesPart || (ChatResponseFilesPart = {}));
var ChatResponseAnchorPart;
((ChatResponseAnchorPart2) => {
  function from(part) {
    const isUri = (thing) => URI.isUri(thing);
    const isSymbolInformation = (thing) => "name" in thing;
    return {
      kind: "inlineReference",
      name: part.title,
      inlineReference: isUri(part.value) ? part.value : isSymbolInformation(part.value) ? WorkspaceSymbol.from(part.value) : Location.from(part.value)
    };
  }
  ChatResponseAnchorPart2.from = from;
  function to(part) {
    const value = revive(part);
    return new types.ChatResponseAnchorPart(
      URI.isUri(value.inlineReference) ? value.inlineReference : "location" in value.inlineReference ? WorkspaceSymbol.to(value.inlineReference) : Location.to(value.inlineReference),
      part.name
    );
  }
  ChatResponseAnchorPart2.to = to;
})(ChatResponseAnchorPart || (ChatResponseAnchorPart = {}));
var ChatResponseProgressPart;
((ChatResponseProgressPart2) => {
  function from(part) {
    return {
      kind: "progressMessage",
      content: MarkdownString.from(part.value)
    };
  }
  ChatResponseProgressPart2.from = from;
  function to(part) {
    return new types.ChatResponseProgressPart(part.content.value);
  }
  ChatResponseProgressPart2.to = to;
})(ChatResponseProgressPart || (ChatResponseProgressPart = {}));
var ChatResponseWarningPart;
((ChatResponseWarningPart2) => {
  function from(part) {
    return {
      kind: "warning",
      content: MarkdownString.from(part.value)
    };
  }
  ChatResponseWarningPart2.from = from;
  function to(part) {
    return new types.ChatResponseWarningPart(part.content.value);
  }
  ChatResponseWarningPart2.to = to;
})(ChatResponseWarningPart || (ChatResponseWarningPart = {}));
var ChatResponseMovePart;
((ChatResponseMovePart2) => {
  function from(part) {
    return {
      kind: "move",
      uri: part.uri,
      range: Range.from(part.range)
    };
  }
  ChatResponseMovePart2.from = from;
  function to(part) {
    return new types.ChatResponseMovePart(URI.revive(part.uri), Range.to(part.range));
  }
  ChatResponseMovePart2.to = to;
})(ChatResponseMovePart || (ChatResponseMovePart = {}));
var ChatTask;
((ChatTask2) => {
  function from(part) {
    return {
      kind: "progressTask",
      content: MarkdownString.from(part.value)
    };
  }
  ChatTask2.from = from;
})(ChatTask || (ChatTask = {}));
var ChatTaskResult;
((ChatTaskResult2) => {
  function from(part) {
    return {
      kind: "progressTaskResult",
      content: typeof part === "string" ? MarkdownString.from(part) : void 0
    };
  }
  ChatTaskResult2.from = from;
})(ChatTaskResult || (ChatTaskResult = {}));
var ChatResponseCommandButtonPart;
((ChatResponseCommandButtonPart2) => {
  function from(part, commandsConverter, commandDisposables) {
    const command = commandsConverter.toInternal(part.value, commandDisposables) ?? { command: part.value.command, title: part.value.title };
    return {
      kind: "command",
      command
    };
  }
  ChatResponseCommandButtonPart2.from = from;
  function to(part, commandsConverter) {
    return new types.ChatResponseCommandButtonPart(commandsConverter.fromInternal(part.command) ?? { command: part.command.id, title: part.command.title });
  }
  ChatResponseCommandButtonPart2.to = to;
})(ChatResponseCommandButtonPart || (ChatResponseCommandButtonPart = {}));
var ChatResponseTextEditPart;
((ChatResponseTextEditPart2) => {
  function from(part) {
    return {
      kind: "textEdit",
      uri: part.uri,
      edits: part.edits.map((e) => TextEdit.from(e)),
      done: part.isDone
    };
  }
  ChatResponseTextEditPart2.from = from;
  function to(part) {
    const result = new types.ChatResponseTextEditPart(URI.revive(part.uri), part.edits.map((e) => TextEdit.to(e)));
    result.isDone = part.done;
    return result;
  }
  ChatResponseTextEditPart2.to = to;
})(ChatResponseTextEditPart || (ChatResponseTextEditPart = {}));
var NotebookEdit;
((NotebookEdit2) => {
  function from(edit) {
    if (edit.newCellMetadata) {
      return {
        editType: CellEditType.Metadata,
        index: edit.range.start,
        metadata: edit.newCellMetadata
      };
    } else if (edit.newNotebookMetadata) {
      return {
        editType: CellEditType.DocumentMetadata,
        metadata: edit.newNotebookMetadata
      };
    } else {
      return {
        editType: CellEditType.Replace,
        index: edit.range.start,
        count: edit.range.end - edit.range.start,
        cells: edit.newCells.map(NotebookCellData.from)
      };
    }
  }
  NotebookEdit2.from = from;
})(NotebookEdit || (NotebookEdit = {}));
var ChatResponseNotebookEditPart;
((ChatResponseNotebookEditPart2) => {
  function from(part) {
    return {
      kind: "notebookEdit",
      uri: part.uri,
      edits: part.edits.map(NotebookEdit.from),
      done: part.isDone
    };
  }
  ChatResponseNotebookEditPart2.from = from;
})(ChatResponseNotebookEditPart || (ChatResponseNotebookEditPart = {}));
var ChatResponseReferencePart;
((ChatResponseReferencePart2) => {
  function from(part) {
    const iconPath = ThemeIcon.isThemeIcon(part.iconPath) ? part.iconPath : URI.isUri(part.iconPath) ? { light: URI.revive(part.iconPath) } : part.iconPath && "light" in part.iconPath && "dark" in part.iconPath && URI.isUri(part.iconPath.light) && URI.isUri(part.iconPath.dark) ? { light: URI.revive(part.iconPath.light), dark: URI.revive(part.iconPath.dark) } : void 0;
    if (typeof part.value === "object" && "variableName" in part.value) {
      return {
        kind: "reference",
        reference: {
          variableName: part.value.variableName,
          value: URI.isUri(part.value.value) || !part.value.value ? part.value.value : Location.from(part.value.value)
        },
        iconPath,
        options: part.options
      };
    }
    return {
      kind: "reference",
      reference: URI.isUri(part.value) || typeof part.value === "string" ? part.value : Location.from(part.value),
      iconPath,
      options: part.options
    };
  }
  ChatResponseReferencePart2.from = from;
  function to(part) {
    const value = revive(part);
    const mapValue = (value2) => URI.isUri(value2) ? value2 : Location.to(value2);
    return new types.ChatResponseReferencePart(
      typeof value.reference === "string" ? value.reference : "variableName" in value.reference ? {
        variableName: value.reference.variableName,
        value: value.reference.value && mapValue(value.reference.value)
      } : mapValue(value.reference)
    );
  }
  ChatResponseReferencePart2.to = to;
})(ChatResponseReferencePart || (ChatResponseReferencePart = {}));
var ChatResponseCodeCitationPart;
((ChatResponseCodeCitationPart2) => {
  function from(part) {
    return {
      kind: "codeCitation",
      value: part.value,
      license: part.license,
      snippet: part.snippet
    };
  }
  ChatResponseCodeCitationPart2.from = from;
})(ChatResponseCodeCitationPart || (ChatResponseCodeCitationPart = {}));
var ChatResponsePart;
((ChatResponsePart2) => {
  function from(part, commandsConverter, commandDisposables) {
    if (part instanceof types.ChatResponseMarkdownPart) {
      return ChatResponseMarkdownPart.from(part);
    } else if (part instanceof types.ChatResponseAnchorPart) {
      return ChatResponseAnchorPart.from(part);
    } else if (part instanceof types.ChatResponseReferencePart) {
      return ChatResponseReferencePart.from(part);
    } else if (part instanceof types.ChatResponseProgressPart) {
      return ChatResponseProgressPart.from(part);
    } else if (part instanceof types.ChatResponseFileTreePart) {
      return ChatResponseFilesPart.from(part);
    } else if (part instanceof types.ChatResponseCommandButtonPart) {
      return ChatResponseCommandButtonPart.from(part, commandsConverter, commandDisposables);
    } else if (part instanceof types.ChatResponseTextEditPart) {
      return ChatResponseTextEditPart.from(part);
    } else if (part instanceof types.ChatResponseNotebookEditPart) {
      return ChatResponseNotebookEditPart.from(part);
    } else if (part instanceof types.ChatResponseMarkdownWithVulnerabilitiesPart) {
      return ChatResponseMarkdownWithVulnerabilitiesPart.from(part);
    } else if (part instanceof types.ChatResponseCodeblockUriPart) {
      return ChatResponseCodeblockUriPart.from(part);
    } else if (part instanceof types.ChatResponseWarningPart) {
      return ChatResponseWarningPart.from(part);
    } else if (part instanceof types.ChatResponseConfirmationPart) {
      return ChatResponseConfirmationPart.from(part);
    } else if (part instanceof types.ChatResponseCodeCitationPart) {
      return ChatResponseCodeCitationPart.from(part);
    } else if (part instanceof types.ChatResponseMovePart) {
      return ChatResponseMovePart.from(part);
    }
    return {
      kind: "markdownContent",
      content: MarkdownString.from("")
    };
  }
  ChatResponsePart2.from = from;
  function to(part, commandsConverter) {
    switch (part.kind) {
      case "reference":
        return ChatResponseReferencePart.to(part);
      case "markdownContent":
      case "inlineReference":
      case "progressMessage":
      case "treeData":
      case "command":
        return toContent(part, commandsConverter);
    }
    return void 0;
  }
  ChatResponsePart2.to = to;
  function toContent(part, commandsConverter) {
    switch (part.kind) {
      case "markdownContent":
        return ChatResponseMarkdownPart.to(part);
      case "inlineReference":
        return ChatResponseAnchorPart.to(part);
      case "progressMessage":
        return void 0;
      case "treeData":
        return ChatResponseFilesPart.to(part);
      case "command":
        return ChatResponseCommandButtonPart.to(part, commandsConverter);
    }
    return void 0;
  }
  ChatResponsePart2.toContent = toContent;
})(ChatResponsePart || (ChatResponsePart = {}));
var ChatAgentRequest;
((ChatAgentRequest2) => {
  function to(request, location2, model, diagnostics, tools) {
    const toolReferences = request.variables.variables.filter((v) => v.isTool);
    const variableReferences = request.variables.variables.filter((v) => !v.isTool);
    const requestWithoutId = {
      prompt: request.message,
      command: request.command,
      attempt: request.attempt ?? 0,
      enableCommandDetection: request.enableCommandDetection ?? true,
      isParticipantDetected: request.isParticipantDetected ?? false,
      references: variableReferences.map((v) => ChatPromptReference.to(v, diagnostics)),
      toolReferences: toolReferences.map(ChatLanguageModelToolReference.to),
      location: ChatLocation.to(request.location),
      acceptedConfirmationData: request.acceptedConfirmationData,
      rejectedConfirmationData: request.rejectedConfirmationData,
      location2,
      toolInvocationToken: Object.freeze({ sessionId: request.sessionId }),
      tools,
      model
    };
    if (request.requestId) {
      return {
        ...requestWithoutId,
        id: request.requestId
      };
    }
    return requestWithoutId;
  }
  ChatAgentRequest2.to = to;
})(ChatAgentRequest || (ChatAgentRequest = {}));
var ChatRequestDraft;
((ChatRequestDraft2) => {
  function to(request) {
    return {
      prompt: request.prompt,
      files: request.files.map((uri) => URI.revive(uri))
    };
  }
  ChatRequestDraft2.to = to;
})(ChatRequestDraft || (ChatRequestDraft = {}));
var ChatLocation;
((ChatLocation2) => {
  function to(loc) {
    switch (loc) {
      case ChatAgentLocation.Notebook:
        return types.ChatLocation.Notebook;
      case ChatAgentLocation.Terminal:
        return types.ChatLocation.Terminal;
      case ChatAgentLocation.Panel:
        return types.ChatLocation.Panel;
      case ChatAgentLocation.Editor:
        return types.ChatLocation.Editor;
      case ChatAgentLocation.EditingSession:
        return types.ChatLocation.EditingSession;
    }
  }
  ChatLocation2.to = to;
  function from(loc) {
    switch (loc) {
      case types.ChatLocation.Notebook:
        return ChatAgentLocation.Notebook;
      case types.ChatLocation.Terminal:
        return ChatAgentLocation.Terminal;
      case types.ChatLocation.Panel:
        return ChatAgentLocation.Panel;
      case types.ChatLocation.Editor:
        return ChatAgentLocation.Editor;
      case types.ChatLocation.EditingSession:
        return ChatAgentLocation.EditingSession;
    }
  }
  ChatLocation2.from = from;
})(ChatLocation || (ChatLocation = {}));
var ChatPromptReference;
((ChatPromptReference2) => {
  function to(variable, diagnostics) {
    let value = variable.value;
    if (!value) {
      throw new Error("Invalid value reference");
    }
    if (isUriComponents(value)) {
      value = URI.revive(value);
    } else if (value && typeof value === "object" && "uri" in value && "range" in value && isUriComponents(value.uri)) {
      value = Location.to(revive(value));
    } else if (variable.isImage) {
      const ref = variable.references?.[0]?.reference;
      value = new types.ChatReferenceBinaryData(
        variable.mimeType ?? "image/png",
        () => Promise.resolve(new Uint8Array(Object.values(variable.value))),
        ref && URI.isUri(ref) ? ref : void 0
      );
    } else if (variable.kind === "diagnostic") {
      const filterSeverity = variable.filterSeverity && DiagnosticSeverity.to(variable.filterSeverity);
      const filterUri = variable.filterUri && URI.revive(variable.filterUri).toString();
      value = new types.ChatReferenceDiagnostic(diagnostics.map(([uri, d]) => {
        if (variable.filterUri && uri.toString() !== filterUri) {
          return [uri, []];
        }
        return [uri, d.filter((d2) => {
          if (filterSeverity && d2.severity > filterSeverity) {
            return false;
          }
          if (variable.filterRange && !editorRange.Range.areIntersectingOrTouching(variable.filterRange, Range.from(d2.range))) {
            return false;
          }
          return true;
        })];
      }).filter(([, d]) => d.length > 0));
    }
    return {
      id: variable.id,
      name: variable.name,
      range: variable.range && [variable.range.start, variable.range.endExclusive],
      value,
      modelDescription: variable.modelDescription
    };
  }
  ChatPromptReference2.to = to;
})(ChatPromptReference || (ChatPromptReference = {}));
var ChatLanguageModelToolReference;
((ChatLanguageModelToolReference2) => {
  function to(variable) {
    const value = variable.value;
    if (value) {
      throw new Error("Invalid tool reference");
    }
    return {
      name: variable.id,
      range: variable.range && [variable.range.start, variable.range.endExclusive]
    };
  }
  ChatLanguageModelToolReference2.to = to;
})(ChatLanguageModelToolReference || (ChatLanguageModelToolReference = {}));
var ChatAgentCompletionItem;
((ChatAgentCompletionItem2) => {
  function from(item, commandsConverter, disposables) {
    return {
      id: item.id,
      label: item.label,
      fullName: item.fullName,
      icon: item.icon?.id,
      value: item.values[0].value,
      insertText: item.insertText,
      detail: item.detail,
      documentation: item.documentation,
      command: commandsConverter.toInternal(item.command, disposables)
    };
  }
  ChatAgentCompletionItem2.from = from;
})(ChatAgentCompletionItem || (ChatAgentCompletionItem = {}));
var ChatAgentResult;
((ChatAgentResult2) => {
  function to(result) {
    return {
      errorDetails: result.errorDetails,
      metadata: reviveMetadata(result.metadata),
      nextQuestion: result.nextQuestion
    };
  }
  ChatAgentResult2.to = to;
  function from(result) {
    return {
      errorDetails: result.errorDetails,
      metadata: result.metadata,
      nextQuestion: result.nextQuestion
    };
  }
  ChatAgentResult2.from = from;
  function reviveMetadata(metadata) {
    return cloneAndChange(metadata, (value) => {
      if (value.$mid === MarshalledId.LanguageModelToolResult) {
        return new types.LanguageModelToolResult(cloneAndChange(value.content, reviveMetadata));
      } else if (value.$mid === MarshalledId.LanguageModelTextPart) {
        return new types.LanguageModelTextPart(value.value);
      } else if (value.$mid === MarshalledId.LanguageModelPromptTsxPart) {
        return new types.LanguageModelPromptTsxPart(value.value);
      }
      return void 0;
    });
  }
})(ChatAgentResult || (ChatAgentResult = {}));
var ChatAgentUserActionEvent;
((ChatAgentUserActionEvent2) => {
  function to(result, event, commandsConverter) {
    if (event.action.kind === "vote") {
      return;
    }
    const ehResult = ChatAgentResult.to(result);
    if (event.action.kind === "command") {
      const command = event.action.commandButton.command;
      const commandButton = {
        command: commandsConverter.fromInternal(command) ?? { command: command.id, title: command.title }
      };
      const commandAction = { kind: "command", commandButton };
      return { action: commandAction, result: ehResult };
    } else if (event.action.kind === "followUp") {
      const followupAction = { kind: "followUp", followup: ChatFollowup.to(event.action.followup) };
      return { action: followupAction, result: ehResult };
    } else if (event.action.kind === "inlineChat") {
      return { action: { kind: "editor", accepted: event.action.action === "accepted" }, result: ehResult };
    } else if (event.action.kind === "chatEditingSessionAction") {
      const outcomes = /* @__PURE__ */ new Map([
        ["accepted", types.ChatEditingSessionActionOutcome.Accepted],
        ["rejected", types.ChatEditingSessionActionOutcome.Rejected],
        ["saved", types.ChatEditingSessionActionOutcome.Saved]
      ]);
      return {
        action: {
          kind: "chatEditingSessionAction",
          outcome: outcomes.get(event.action.outcome) ?? types.ChatEditingSessionActionOutcome.Rejected,
          uri: URI.revive(event.action.uri),
          hasRemainingEdits: event.action.hasRemainingEdits
        },
        result: ehResult
      };
    } else {
      return { action: event.action, result: ehResult };
    }
  }
  ChatAgentUserActionEvent2.to = to;
})(ChatAgentUserActionEvent || (ChatAgentUserActionEvent = {}));
var TerminalQuickFix;
((TerminalQuickFix2) => {
  function from(quickFix, converter, disposables) {
    if ("terminalCommand" in quickFix) {
      return { terminalCommand: quickFix.terminalCommand, shouldExecute: quickFix.shouldExecute };
    }
    if ("uri" in quickFix) {
      return { uri: quickFix.uri };
    }
    return converter.toInternal(quickFix, disposables);
  }
  TerminalQuickFix2.from = from;
})(TerminalQuickFix || (TerminalQuickFix = {}));
var TerminalCompletionItemDto;
((TerminalCompletionItemDto2) => {
  function from(item) {
    return {
      ...item,
      documentation: MarkdownString.fromStrict(item.documentation)
    };
  }
  TerminalCompletionItemDto2.from = from;
})(TerminalCompletionItemDto || (TerminalCompletionItemDto = {}));
var TerminalCompletionList;
((TerminalCompletionList2) => {
  function from(completions) {
    if (Array.isArray(completions)) {
      return {
        items: completions.map((i) => TerminalCompletionItemDto.from(i))
      };
    }
    return {
      items: completions.items.map((i) => TerminalCompletionItemDto.from(i)),
      resourceRequestConfig: completions.resourceRequestConfig ? TerminalResourceRequestConfig.from(completions.resourceRequestConfig) : void 0
    };
  }
  TerminalCompletionList2.from = from;
})(TerminalCompletionList || (TerminalCompletionList = {}));
var TerminalResourceRequestConfig;
((TerminalResourceRequestConfig2) => {
  function from(resourceRequestConfig) {
    return {
      ...resourceRequestConfig,
      pathSeparator: isWindows ? "\\" : "/",
      cwd: resourceRequestConfig.cwd ? URI.revive(resourceRequestConfig.cwd) : void 0
    };
  }
  TerminalResourceRequestConfig2.from = from;
})(TerminalResourceRequestConfig || (TerminalResourceRequestConfig = {}));
var PartialAcceptInfo;
((PartialAcceptInfo2) => {
  function to(info) {
    return {
      kind: PartialAcceptTriggerKind.to(info.kind),
      acceptedLength: info.acceptedLength
    };
  }
  PartialAcceptInfo2.to = to;
})(PartialAcceptInfo || (PartialAcceptInfo = {}));
var PartialAcceptTriggerKind;
((PartialAcceptTriggerKind2) => {
  function to(kind) {
    switch (kind) {
      case languages.PartialAcceptTriggerKind.Word:
        return types.PartialAcceptTriggerKind.Word;
      case languages.PartialAcceptTriggerKind.Line:
        return types.PartialAcceptTriggerKind.Line;
      case languages.PartialAcceptTriggerKind.Suggest:
        return types.PartialAcceptTriggerKind.Suggest;
      default:
        return types.PartialAcceptTriggerKind.Unknown;
    }
  }
  PartialAcceptTriggerKind2.to = to;
})(PartialAcceptTriggerKind || (PartialAcceptTriggerKind = {}));
var DebugTreeItem;
((DebugTreeItem2) => {
  function from(item, id) {
    return {
      id,
      label: item.label,
      description: item.description,
      canEdit: item.canEdit,
      collapsibleState: item.collapsibleState || DebugTreeItemCollapsibleState.None,
      contextValue: item.contextValue
    };
  }
  DebugTreeItem2.from = from;
})(DebugTreeItem || (DebugTreeItem = {}));
var LanguageModelToolDescription;
((LanguageModelToolDescription2) => {
  function to(item) {
    return {
      // Note- the reason this is a unique 'name' is just to avoid confusion with the toolCallId
      name: item.id,
      description: item.modelDescription,
      inputSchema: item.inputSchema,
      tags: item.tags ?? []
    };
  }
  LanguageModelToolDescription2.to = to;
})(LanguageModelToolDescription || (LanguageModelToolDescription = {}));
var LanguageModelToolResult;
((LanguageModelToolResult2) => {
  function to(result) {
    return new types.LanguageModelToolResult(result.content.map((item) => {
      if (item.kind === "text") {
        return new types.LanguageModelTextPart(item.value);
      } else {
        return new types.LanguageModelPromptTsxPart(item.value);
      }
    }));
  }
  LanguageModelToolResult2.to = to;
  function from(result, extension) {
    if (result.toolResultMessage) {
      checkProposedApiEnabled(extension, "chatParticipantPrivate");
    }
    return {
      content: result.content.map((item) => {
        if (item instanceof types.LanguageModelTextPart) {
          return {
            kind: "text",
            value: item.value
          };
        } else if (item instanceof types.LanguageModelPromptTsxPart) {
          return {
            kind: "promptTsx",
            value: item.value
          };
        } else {
          throw new Error("Unknown LanguageModelToolResult part type");
        }
      }),
      toolResultMessage: MarkdownString.fromStrict(result.toolResultMessage),
      toolResultDetails: result.toolResultDetails?.map((detail) => URI.isUri(detail) ? detail : Location.from(detail))
    };
  }
  LanguageModelToolResult2.from = from;
})(LanguageModelToolResult || (LanguageModelToolResult = {}));
var IconPath;
((IconPath2) => {
  function fromThemeIcon(iconPath) {
    return iconPath;
  }
  IconPath2.fromThemeIcon = fromThemeIcon;
})(IconPath || (IconPath = {}));
export {
  CallHierarchyIncomingCall,
  CallHierarchyItem,
  CallHierarchyOutgoingCall,
  ChatAgentCompletionItem,
  ChatAgentRequest,
  ChatAgentResult,
  ChatAgentUserActionEvent,
  ChatFollowup,
  ChatLanguageModelToolReference,
  ChatLocation,
  ChatPromptReference,
  ChatRequestDraft,
  ChatResponseAnchorPart,
  ChatResponseCodeCitationPart,
  ChatResponseCodeblockUriPart,
  ChatResponseCommandButtonPart,
  ChatResponseConfirmationPart,
  ChatResponseFilesPart,
  ChatResponseMarkdownPart,
  ChatResponseMarkdownWithVulnerabilitiesPart,
  ChatResponseMovePart,
  ChatResponseNotebookEditPart,
  ChatResponsePart,
  ChatResponseProgressPart,
  ChatResponseReferencePart,
  ChatResponseTextEditPart,
  ChatResponseWarningPart,
  ChatTask,
  ChatTaskResult,
  CodeActionTriggerKind,
  Color,
  ColorPresentation,
  CompletionContext,
  CompletionItem,
  CompletionItemKind,
  CompletionItemTag,
  CompletionTriggerKind,
  DataTransfer,
  DataTransferItem,
  DebugTreeItem,
  DecorationRangeBehavior,
  DecorationRenderOptions,
  DefinitionLink,
  Diagnostic,
  DiagnosticRelatedInformation,
  DiagnosticSeverity,
  DiagnosticTag,
  DocumentHighlight,
  DocumentLink,
  DocumentSelector,
  DocumentSymbol,
  EndOfLine,
  EvaluatableExpression,
  FoldingRange,
  FoldingRangeKind,
  GlobPattern,
  Hover,
  IconPath,
  InlayHint,
  InlayHintKind,
  InlayHintLabelPart,
  InlineValue,
  InlineValueContext,
  LanguageModelChatMessage,
  LanguageModelChatMessage2,
  LanguageModelChatMessageRole,
  LanguageModelToolDescription,
  LanguageModelToolResult,
  LanguageSelector,
  Location,
  MarkdownString,
  MultiDocumentHighlight,
  NotebookCellData,
  NotebookCellExecutionState,
  NotebookCellExecutionSummary,
  NotebookCellKind,
  NotebookCellOutput,
  NotebookCellOutputItem,
  NotebookData,
  NotebookDocumentContentOptions,
  NotebookEdit,
  NotebookExclusiveDocumentPattern,
  NotebookKernelSourceAction,
  NotebookRange,
  NotebookRendererScript,
  NotebookStatusBarItem,
  ParameterInformation,
  PartialAcceptInfo,
  PartialAcceptTriggerKind,
  Position,
  ProgressLocation,
  Range,
  Selection,
  SelectionRange,
  SignatureHelp,
  SignatureInformation,
  SymbolKind,
  SymbolTag,
  TerminalCompletionItemDto,
  TerminalCompletionList,
  TerminalQuickFix,
  TerminalResourceRequestConfig,
  TestCoverage,
  TestItem,
  TestMessage,
  TestResults,
  TestRunProfile,
  TestRunProfileKind,
  TestTag,
  TextDocumentSaveReason,
  TextEdit,
  TextEditorLineNumbersStyle,
  TextEditorOpenOptions,
  ThemableDecorationAttachmentRenderOptions,
  ThemableDecorationRenderOptions,
  TokenType,
  TypeHierarchyItem,
  ViewBadge,
  ViewColumn,
  WorkspaceEdit,
  WorkspaceSymbol,
  fromRangeOrRangeWithMessage,
  isDecorationOptionsArr,
  location,
  pathOrURIToURI
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0VHlwZUNvbnZlcnRlcnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgdHlwZSAqIGFzIHZzY29kZSBmcm9tICd2c2NvZGUnO1xuaW1wb3J0IHsgYXNBcnJheSwgY29hbGVzY2UsIGlzTm9uRW1wdHlBcnJheSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciwgZW5jb2RlQmFzZTY0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IElEYXRhVHJhbnNmZXJGaWxlLCBJRGF0YVRyYW5zZmVySXRlbSwgVXJpTGlzdCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RhdGFUcmFuc2Zlci5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTaW5nbGVDYWxsRnVuY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9mdW5jdGlvbmFsLmpzJztcbmltcG9ydCAqIGFzIGh0bWxDb250ZW50IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCwgUmVzb3VyY2VTZXQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0ICogYXMgbWFya2VkIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcmtlZC9tYXJrZWQuanMnO1xuaW1wb3J0IHsgcGFyc2UsIHJldml2ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcnNoYWxsaW5nLmpzJztcbmltcG9ydCB7IE1hcnNoYWxsZWRJZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcnNoYWxsaW5nSWRzLmpzJztcbmltcG9ydCB7IE1pbWVzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbWltZS5qcyc7XG5pbXBvcnQgeyBjbG9uZUFuZENoYW5nZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVByZWZpeFRyZWVOb2RlLCBXZWxsRGVmaW5lZFByZWZpeFRyZWUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wcmVmaXhUcmVlLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBpc0RlZmluZWQsIGlzRW1wdHlPYmplY3QsIGlzTnVtYmVyLCBpc1N0cmluZywgaXNVbmRlZmluZWRPck51bGwgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMsIGlzVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJVVJJVHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmlJcGMuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBSZW5kZXJMaW5lTnVtYmVyc1R5cGUgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IElQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgKiBhcyBlZGl0b3JSYW5nZSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSVNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRlbnREZWNvcmF0aW9uUmVuZGVyT3B0aW9ucywgSURlY29yYXRpb25PcHRpb25zLCBJRGVjb3JhdGlvblJlbmRlck9wdGlvbnMsIElUaGVtZURlY29yYXRpb25SZW5kZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0ICogYXMgZW5jb2RlZFRva2VuQXR0cmlidXRlcyBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VuY29kZWRUb2tlbkF0dHJpYnV0ZXMuanMnO1xuaW1wb3J0ICogYXMgbGFuZ3VhZ2VTZWxlY3RvciBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlU2VsZWN0b3IuanMnO1xuaW1wb3J0ICogYXMgbGFuZ3VhZ2VzIGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IEVuZE9mTGluZVNlcXVlbmNlLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJVGV4dEVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElNYXJrZXJEYXRhLCBJUmVsYXRlZEluZm9ybWF0aW9uLCBNYXJrZXJTZXZlcml0eSwgTWFya2VyVGFnIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBQcm9ncmVzc0xvY2F0aW9uIGFzIE1haW5Qcm9ncmVzc0xvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IERFRkFVTFRfRURJVE9SX0FTU09DSUFUSU9OLCBTYXZlUmVhc29uIH0gZnJvbSAnLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJVmlld0JhZGdlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElDaGF0QWdlbnRSZXF1ZXN0LCBJQ2hhdEFnZW50UmVzdWx0IH0gZnJvbSAnLi4vLi4vY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0QWdlbnRzLmpzJztcbmltcG9ydCB7IElDaGF0UmVxdWVzdERyYWZ0IH0gZnJvbSAnLi4vLi4vY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSB9IGZyb20gJy4uLy4uL2NvbnRyaWIvY2hhdC9jb21tb24vY2hhdE1vZGVsLmpzJztcbmltcG9ydCB7IElDaGF0QWdlbnRNYXJrZG93bkNvbnRlbnRXaXRoVnVsbmVyYWJpbGl0eSwgSUNoYXRDb2RlQ2l0YXRpb24sIElDaGF0Q29tbWFuZEJ1dHRvbiwgSUNoYXRDb25maXJtYXRpb24sIElDaGF0Q29udGVudElubGluZVJlZmVyZW5jZSwgSUNoYXRDb250ZW50UmVmZXJlbmNlLCBJQ2hhdEZvbGxvd3VwLCBJQ2hhdE1hcmtkb3duQ29udGVudCwgSUNoYXRNb3ZlTWVzc2FnZSwgSUNoYXRQcm9ncmVzc01lc3NhZ2UsIElDaGF0UmVzcG9uc2VDb2RlYmxvY2tVcmlQYXJ0LCBJQ2hhdFRhc2tEdG8sIElDaGF0VGFza1Jlc3VsdCwgSUNoYXRUZXh0RWRpdCwgSUNoYXRUcmVlRGF0YSwgSUNoYXRVc2VyQWN0aW9uRXZlbnQsIElDaGF0V2FybmluZ01lc3NhZ2UgfSBmcm9tICcuLi8uLi9jb250cmliL2NoYXQvY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUb29sRGF0YSwgSVRvb2xSZXN1bHQgfSBmcm9tICcuLi8uLi9jb250cmliL2NoYXQvY29tbW9uL2xhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UuanMnO1xuaW1wb3J0ICogYXMgY2hhdFByb3ZpZGVyIGZyb20gJy4uLy4uL2NvbnRyaWIvY2hhdC9jb21tb24vbGFuZ3VhZ2VNb2RlbHMuanMnO1xuaW1wb3J0IHsgSUNoYXRSZXNwb25zZVByb21wdFRzeFBhcnQsIElDaGF0UmVzcG9uc2VUZXh0UGFydCB9IGZyb20gJy4uLy4uL2NvbnRyaWIvY2hhdC9jb21tb24vbGFuZ3VhZ2VNb2RlbHMuanMnO1xuaW1wb3J0IHsgRGVidWdUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUsIElEZWJ1Z1Zpc3VhbGl6YXRpb25UcmVlSXRlbSB9IGZyb20gJy4uLy4uL2NvbnRyaWIvZGVidWcvY29tbW9uL2RlYnVnLmpzJztcbmltcG9ydCAqIGFzIG5vdGVib29rcyBmcm9tICcuLi8uLi9jb250cmliL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBDZWxsRWRpdFR5cGUgfSBmcm9tICcuLi8uLi9jb250cmliL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBJQ2VsbFJhbmdlIH0gZnJvbSAnLi4vLi4vY29udHJpYi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tSYW5nZS5qcyc7XG5pbXBvcnQgKiBhcyBzZWFyY2ggZnJvbSAnLi4vLi4vY29udHJpYi9zZWFyY2gvY29tbW9uL3NlYXJjaC5qcyc7XG5pbXBvcnQgeyBUZXN0SWQgfSBmcm9tICcuLi8uLi9jb250cmliL3Rlc3RpbmcvY29tbW9uL3Rlc3RJZC5qcyc7XG5pbXBvcnQgeyBDb3ZlcmFnZURldGFpbHMsIERldGFpbFR5cGUsIElDb3ZlcmFnZUNvdW50LCBJRmlsZUNvdmVyYWdlLCBJU2VyaWFsaXplZFRlc3RSZXN1bHRzLCBJVGVzdEVycm9yTWVzc2FnZSwgSVRlc3RJdGVtLCBJVGVzdFJ1blByb2ZpbGVSZWZlcmVuY2UsIElUZXN0VGFnLCBUZXN0TWVzc2FnZVR5cGUsIFRlc3RSZXN1bHRJdGVtLCBUZXN0UnVuUHJvZmlsZUJpdHNldCwgZGVuYW1lc3BhY2VUZXN0VGFnLCBuYW1lc3BhY2VUZXN0VGFnIH0gZnJvbSAnLi4vLi4vY29udHJpYi90ZXN0aW5nL2NvbW1vbi90ZXN0VHlwZXMuanMnO1xuaW1wb3J0IHsgRWRpdG9yR3JvdXBDb2x1bW4gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3VwQ29sdW1uLmpzJztcbmltcG9ydCB7IEFDVElWRV9HUk9VUCwgU0lERV9HUk9VUCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRHRvIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vcHJveHlJZGVudGlmaWVyLmpzJztcbmltcG9ydCAqIGFzIGV4dEhvc3RQcm90b2NvbCBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNDb252ZXJ0ZXIgfSBmcm9tICcuL2V4dEhvc3RDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBnZXRQcml2YXRlQXBpRm9yIH0gZnJvbSAnLi9leHRIb3N0VGVzdGluZ1ByaXZhdGVBcGkuanMnO1xuaW1wb3J0ICogYXMgdHlwZXMgZnJvbSAnLi9leHRIb3N0VHlwZXMuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VNb2RlbFByb21wdFRzeFBhcnQsIExhbmd1YWdlTW9kZWxUZXh0UGFydCB9IGZyb20gJy4vZXh0SG9zdFR5cGVzLmpzJztcbmltcG9ydCB7IENoYXRBZ2VudExvY2F0aW9uIH0gZnJvbSAnLi4vLi4vY29udHJpYi9jaGF0L2NvbW1vbi9jb25zdGFudHMuanMnO1xuXG5leHBvcnQgbmFtZXNwYWNlIENvbW1hbmQge1xuXG5cdGV4cG9ydCBpbnRlcmZhY2UgSUNvbW1hbmRzQ29udmVydGVyIHtcblx0XHRmcm9tSW50ZXJuYWwoY29tbWFuZDogZXh0SG9zdFByb3RvY29sLklDb21tYW5kRHRvKTogdnNjb2RlLkNvbW1hbmQgfCB1bmRlZmluZWQ7XG5cdFx0dG9JbnRlcm5hbChjb21tYW5kOiB2c2NvZGUuQ29tbWFuZCB8IHVuZGVmaW5lZCwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IGV4dEhvc3RQcm90b2NvbC5JQ29tbWFuZER0byB8IHVuZGVmaW5lZDtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBvc2l0aW9uTGlrZSB7XG5cdGxpbmU6IG51bWJlcjtcblx0Y2hhcmFjdGVyOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmFuZ2VMaWtlIHtcblx0c3RhcnQ6IFBvc2l0aW9uTGlrZTtcblx0ZW5kOiBQb3NpdGlvbkxpa2U7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VsZWN0aW9uTGlrZSBleHRlbmRzIFJhbmdlTGlrZSB7XG5cdGFuY2hvcjogUG9zaXRpb25MaWtlO1xuXHRhY3RpdmU6IFBvc2l0aW9uTGlrZTtcbn1cbmV4cG9ydCBuYW1lc3BhY2UgU2VsZWN0aW9uIHtcblxuXHRleHBvcnQgZnVuY3Rpb24gdG8oc2VsZWN0aW9uOiBJU2VsZWN0aW9uKTogdHlwZXMuU2VsZWN0aW9uIHtcblx0XHRjb25zdCB7IHNlbGVjdGlvblN0YXJ0TGluZU51bWJlciwgc2VsZWN0aW9uU3RhcnRDb2x1bW4sIHBvc2l0aW9uTGluZU51bWJlciwgcG9zaXRpb25Db2x1bW4gfSA9IHNlbGVjdGlvbjtcblx0XHRjb25zdCBzdGFydCA9IG5ldyB0eXBlcy5Qb3NpdGlvbihzZWxlY3Rpb25TdGFydExpbmVOdW1iZXIgLSAxLCBzZWxlY3Rpb25TdGFydENvbHVtbiAtIDEpO1xuXHRcdGNvbnN0IGVuZCA9IG5ldyB0eXBlcy5Qb3NpdGlvbihwb3NpdGlvbkxpbmVOdW1iZXIgLSAxLCBwb3NpdGlvbkNvbHVtbiAtIDEpO1xuXHRcdHJldHVybiBuZXcgdHlwZXMuU2VsZWN0aW9uKHN0YXJ0LCBlbmQpO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oc2VsZWN0aW9uOiBTZWxlY3Rpb25MaWtlKTogSVNlbGVjdGlvbiB7XG5cdFx0Y29uc3QgeyBhbmNob3IsIGFjdGl2ZSB9ID0gc2VsZWN0aW9uO1xuXHRcdHJldHVybiB7XG5cdFx0XHRzZWxlY3Rpb25TdGFydExpbmVOdW1iZXI6IGFuY2hvci5saW5lICsgMSxcblx0XHRcdHNlbGVjdGlvblN0YXJ0Q29sdW1uOiBhbmNob3IuY2hhcmFjdGVyICsgMSxcblx0XHRcdHBvc2l0aW9uTGluZU51bWJlcjogYWN0aXZlLmxpbmUgKyAxLFxuXHRcdFx0cG9zaXRpb25Db2x1bW46IGFjdGl2ZS5jaGFyYWN0ZXIgKyAxXG5cdFx0fTtcblx0fVxufVxuZXhwb3J0IG5hbWVzcGFjZSBSYW5nZSB7XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocmFuZ2U6IHVuZGVmaW5lZCk6IHVuZGVmaW5lZDtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocmFuZ2U6IFJhbmdlTGlrZSk6IGVkaXRvclJhbmdlLklSYW5nZTtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocmFuZ2U6IFJhbmdlTGlrZSB8IHVuZGVmaW5lZCk6IGVkaXRvclJhbmdlLklSYW5nZSB8IHVuZGVmaW5lZDtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocmFuZ2U6IFJhbmdlTGlrZSB8IHVuZGVmaW5lZCk6IGVkaXRvclJhbmdlLklSYW5nZSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCFyYW5nZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgeyBzdGFydCwgZW5kIH0gPSByYW5nZTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBzdGFydC5saW5lICsgMSxcblx0XHRcdHN0YXJ0Q29sdW1uOiBzdGFydC5jaGFyYWN0ZXIgKyAxLFxuXHRcdFx0ZW5kTGluZU51bWJlcjogZW5kLmxpbmUgKyAxLFxuXHRcdFx0ZW5kQ29sdW1uOiBlbmQuY2hhcmFjdGVyICsgMVxuXHRcdH07XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdG8ocmFuZ2U6IHVuZGVmaW5lZCk6IHR5cGVzLlJhbmdlO1xuXHRleHBvcnQgZnVuY3Rpb24gdG8ocmFuZ2U6IGVkaXRvclJhbmdlLklSYW5nZSk6IHR5cGVzLlJhbmdlO1xuXHRleHBvcnQgZnVuY3Rpb24gdG8ocmFuZ2U6IGVkaXRvclJhbmdlLklSYW5nZSB8IHVuZGVmaW5lZCk6IHR5cGVzLlJhbmdlIHwgdW5kZWZpbmVkO1xuXHRleHBvcnQgZnVuY3Rpb24gdG8ocmFuZ2U6IGVkaXRvclJhbmdlLklSYW5nZSB8IHVuZGVmaW5lZCk6IHR5cGVzLlJhbmdlIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCB7IHN0YXJ0TGluZU51bWJlciwgc3RhcnRDb2x1bW4sIGVuZExpbmVOdW1iZXIsIGVuZENvbHVtbiB9ID0gcmFuZ2U7XG5cdFx0cmV0dXJuIG5ldyB0eXBlcy5SYW5nZShzdGFydExpbmVOdW1iZXIgLSAxLCBzdGFydENvbHVtbiAtIDEsIGVuZExpbmVOdW1iZXIgLSAxLCBlbmRDb2x1bW4gLSAxKTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIExvY2F0aW9uIHtcblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShsb2NhdGlvbjogdnNjb2RlLkxvY2F0aW9uKTogRHRvPGxhbmd1YWdlcy5Mb2NhdGlvbj4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHR1cmk6IGxvY2F0aW9uLnVyaSxcblx0XHRcdHJhbmdlOiBSYW5nZS5mcm9tKGxvY2F0aW9uLnJhbmdlKVxuXHRcdH07XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdG8obG9jYXRpb246IER0bzxsYW5ndWFnZXMuTG9jYXRpb24+KTogdnNjb2RlLkxvY2F0aW9uIHtcblx0XHRyZXR1cm4gbmV3IHR5cGVzLkxvY2F0aW9uKFVSSS5yZXZpdmUobG9jYXRpb24udXJpKSwgUmFuZ2UudG8obG9jYXRpb24ucmFuZ2UpKTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIFRva2VuVHlwZSB7XG5cdGV4cG9ydCBmdW5jdGlvbiB0byh0eXBlOiBlbmNvZGVkVG9rZW5BdHRyaWJ1dGVzLlN0YW5kYXJkVG9rZW5UeXBlKTogdHlwZXMuU3RhbmRhcmRUb2tlblR5cGUge1xuXHRcdHN3aXRjaCAodHlwZSkge1xuXHRcdFx0Y2FzZSBlbmNvZGVkVG9rZW5BdHRyaWJ1dGVzLlN0YW5kYXJkVG9rZW5UeXBlLkNvbW1lbnQ6IHJldHVybiB0eXBlcy5TdGFuZGFyZFRva2VuVHlwZS5Db21tZW50O1xuXHRcdFx0Y2FzZSBlbmNvZGVkVG9rZW5BdHRyaWJ1dGVzLlN0YW5kYXJkVG9rZW5UeXBlLk90aGVyOiByZXR1cm4gdHlwZXMuU3RhbmRhcmRUb2tlblR5cGUuT3RoZXI7XG5cdFx0XHRjYXNlIGVuY29kZWRUb2tlbkF0dHJpYnV0ZXMuU3RhbmRhcmRUb2tlblR5cGUuUmVnRXg6IHJldHVybiB0eXBlcy5TdGFuZGFyZFRva2VuVHlwZS5SZWdFeDtcblx0XHRcdGNhc2UgZW5jb2RlZFRva2VuQXR0cmlidXRlcy5TdGFuZGFyZFRva2VuVHlwZS5TdHJpbmc6IHJldHVybiB0eXBlcy5TdGFuZGFyZFRva2VuVHlwZS5TdHJpbmc7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgUG9zaXRpb24ge1xuXHRleHBvcnQgZnVuY3Rpb24gdG8ocG9zaXRpb246IElQb3NpdGlvbik6IHR5cGVzLlBvc2l0aW9uIHtcblx0XHRyZXR1cm4gbmV3IHR5cGVzLlBvc2l0aW9uKHBvc2l0aW9uLmxpbmVOdW1iZXIgLSAxLCBwb3NpdGlvbi5jb2x1bW4gLSAxKTtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShwb3NpdGlvbjogdHlwZXMuUG9zaXRpb24gfCB2c2NvZGUuUG9zaXRpb24pOiBJUG9zaXRpb24ge1xuXHRcdHJldHVybiB7IGxpbmVOdW1iZXI6IHBvc2l0aW9uLmxpbmUgKyAxLCBjb2x1bW46IHBvc2l0aW9uLmNoYXJhY3RlciArIDEgfTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIERvY3VtZW50U2VsZWN0b3Ige1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgdXJpVHJhbnNmb3JtZXI/OiBJVVJJVHJhbnNmb3JtZXIsIGV4dGVuc2lvbj86IElFeHRlbnNpb25EZXNjcmlwdGlvbik6IGV4dEhvc3RQcm90b2NvbC5JRG9jdW1lbnRGaWx0ZXJEdG9bXSB7XG5cdFx0cmV0dXJuIGNvYWxlc2NlKGFzQXJyYXkodmFsdWUpLm1hcChzZWwgPT4gX2RvVHJhbnNmb3JtRG9jdW1lbnRTZWxlY3RvcihzZWwsIHVyaVRyYW5zZm9ybWVyLCBleHRlbnNpb24pKSk7XG5cdH1cblxuXHRmdW5jdGlvbiBfZG9UcmFuc2Zvcm1Eb2N1bWVudFNlbGVjdG9yKHNlbGVjdG9yOiBzdHJpbmcgfCB2c2NvZGUuRG9jdW1lbnRGaWx0ZXIsIHVyaVRyYW5zZm9ybWVyOiBJVVJJVHJhbnNmb3JtZXIgfCB1bmRlZmluZWQsIGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uIHwgdW5kZWZpbmVkKTogZXh0SG9zdFByb3RvY29sLklEb2N1bWVudEZpbHRlckR0byB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHR5cGVvZiBzZWxlY3RvciA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdCRzZXJpYWxpemVkOiB0cnVlLFxuXHRcdFx0XHRsYW5ndWFnZTogc2VsZWN0b3IsXG5cdFx0XHRcdGlzQnVpbHRpbjogZXh0ZW5zaW9uPy5pc0J1aWx0aW4sXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChzZWxlY3Rvcikge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0JHNlcmlhbGl6ZWQ6IHRydWUsXG5cdFx0XHRcdGxhbmd1YWdlOiBzZWxlY3Rvci5sYW5ndWFnZSxcblx0XHRcdFx0c2NoZW1lOiBfdHJhbnNmb3JtU2NoZW1lKHNlbGVjdG9yLnNjaGVtZSwgdXJpVHJhbnNmb3JtZXIpLFxuXHRcdFx0XHRwYXR0ZXJuOiBHbG9iUGF0dGVybi5mcm9tKHNlbGVjdG9yLnBhdHRlcm4pID8/IHVuZGVmaW5lZCxcblx0XHRcdFx0ZXhjbHVzaXZlOiBzZWxlY3Rvci5leGNsdXNpdmUsXG5cdFx0XHRcdG5vdGVib29rVHlwZTogc2VsZWN0b3Iubm90ZWJvb2tUeXBlLFxuXHRcdFx0XHRpc0J1aWx0aW46IGV4dGVuc2lvbj8uaXNCdWlsdGluXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRmdW5jdGlvbiBfdHJhbnNmb3JtU2NoZW1lKHNjaGVtZTogc3RyaW5nIHwgdW5kZWZpbmVkLCB1cmlUcmFuc2Zvcm1lcjogSVVSSVRyYW5zZm9ybWVyIHwgdW5kZWZpbmVkKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodXJpVHJhbnNmb3JtZXIgJiYgdHlwZW9mIHNjaGVtZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiB1cmlUcmFuc2Zvcm1lci50cmFuc2Zvcm1PdXRnb2luZ1NjaGVtZShzY2hlbWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gc2NoZW1lO1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgRGlhZ25vc3RpY1RhZyB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiB2c2NvZGUuRGlhZ25vc3RpY1RhZyk6IE1hcmtlclRhZyB8IHVuZGVmaW5lZCB7XG5cdFx0c3dpdGNoICh2YWx1ZSkge1xuXHRcdFx0Y2FzZSB0eXBlcy5EaWFnbm9zdGljVGFnLlVubmVjZXNzYXJ5OlxuXHRcdFx0XHRyZXR1cm4gTWFya2VyVGFnLlVubmVjZXNzYXJ5O1xuXHRcdFx0Y2FzZSB0eXBlcy5EaWFnbm9zdGljVGFnLkRlcHJlY2F0ZWQ6XG5cdFx0XHRcdHJldHVybiBNYXJrZXJUYWcuRGVwcmVjYXRlZDtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gdG8odmFsdWU6IE1hcmtlclRhZyk6IHZzY29kZS5EaWFnbm9zdGljVGFnIHwgdW5kZWZpbmVkIHtcblx0XHRzd2l0Y2ggKHZhbHVlKSB7XG5cdFx0XHRjYXNlIE1hcmtlclRhZy5Vbm5lY2Vzc2FyeTpcblx0XHRcdFx0cmV0dXJuIHR5cGVzLkRpYWdub3N0aWNUYWcuVW5uZWNlc3Nhcnk7XG5cdFx0XHRjYXNlIE1hcmtlclRhZy5EZXByZWNhdGVkOlxuXHRcdFx0XHRyZXR1cm4gdHlwZXMuRGlhZ25vc3RpY1RhZy5EZXByZWNhdGVkO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBEaWFnbm9zdGljIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20odmFsdWU6IHZzY29kZS5EaWFnbm9zdGljKTogSU1hcmtlckRhdGEge1xuXHRcdGxldCBjb2RlOiBzdHJpbmcgfCB7IHZhbHVlOiBzdHJpbmc7IHRhcmdldDogVVJJIH0gfCB1bmRlZmluZWQ7XG5cblx0XHRpZiAodmFsdWUuY29kZSkge1xuXHRcdFx0aWYgKGlzU3RyaW5nKHZhbHVlLmNvZGUpIHx8IGlzTnVtYmVyKHZhbHVlLmNvZGUpKSB7XG5cdFx0XHRcdGNvZGUgPSBTdHJpbmcodmFsdWUuY29kZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb2RlID0ge1xuXHRcdFx0XHRcdHZhbHVlOiBTdHJpbmcodmFsdWUuY29kZS52YWx1ZSksXG5cdFx0XHRcdFx0dGFyZ2V0OiB2YWx1ZS5jb2RlLnRhcmdldCxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4uUmFuZ2UuZnJvbSh2YWx1ZS5yYW5nZSksXG5cdFx0XHRtZXNzYWdlOiB2YWx1ZS5tZXNzYWdlLFxuXHRcdFx0c291cmNlOiB2YWx1ZS5zb3VyY2UsXG5cdFx0XHRjb2RlLFxuXHRcdFx0c2V2ZXJpdHk6IERpYWdub3N0aWNTZXZlcml0eS5mcm9tKHZhbHVlLnNldmVyaXR5KSxcblx0XHRcdHJlbGF0ZWRJbmZvcm1hdGlvbjogdmFsdWUucmVsYXRlZEluZm9ybWF0aW9uICYmIHZhbHVlLnJlbGF0ZWRJbmZvcm1hdGlvbi5tYXAoRGlhZ25vc3RpY1JlbGF0ZWRJbmZvcm1hdGlvbi5mcm9tKSxcblx0XHRcdHRhZ3M6IEFycmF5LmlzQXJyYXkodmFsdWUudGFncykgPyBjb2FsZXNjZSh2YWx1ZS50YWdzLm1hcChEaWFnbm9zdGljVGFnLmZyb20pKSA6IHVuZGVmaW5lZCxcblx0XHR9O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHZhbHVlOiBJTWFya2VyRGF0YSk6IHZzY29kZS5EaWFnbm9zdGljIHtcblx0XHRjb25zdCByZXMgPSBuZXcgdHlwZXMuRGlhZ25vc3RpYyhSYW5nZS50byh2YWx1ZSksIHZhbHVlLm1lc3NhZ2UsIERpYWdub3N0aWNTZXZlcml0eS50byh2YWx1ZS5zZXZlcml0eSkpO1xuXHRcdHJlcy5zb3VyY2UgPSB2YWx1ZS5zb3VyY2U7XG5cdFx0cmVzLmNvZGUgPSBpc1N0cmluZyh2YWx1ZS5jb2RlKSA/IHZhbHVlLmNvZGUgOiB2YWx1ZS5jb2RlPy52YWx1ZTtcblx0XHRyZXMucmVsYXRlZEluZm9ybWF0aW9uID0gdmFsdWUucmVsYXRlZEluZm9ybWF0aW9uICYmIHZhbHVlLnJlbGF0ZWRJbmZvcm1hdGlvbi5tYXAoRGlhZ25vc3RpY1JlbGF0ZWRJbmZvcm1hdGlvbi50byk7XG5cdFx0cmVzLnRhZ3MgPSB2YWx1ZS50YWdzICYmIGNvYWxlc2NlKHZhbHVlLnRhZ3MubWFwKERpYWdub3N0aWNUYWcudG8pKTtcblx0XHRyZXR1cm4gcmVzO1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgRGlhZ25vc3RpY1JlbGF0ZWRJbmZvcm1hdGlvbiB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiB2c2NvZGUuRGlhZ25vc3RpY1JlbGF0ZWRJbmZvcm1hdGlvbik6IElSZWxhdGVkSW5mb3JtYXRpb24ge1xuXHRcdHJldHVybiB7XG5cdFx0XHQuLi5SYW5nZS5mcm9tKHZhbHVlLmxvY2F0aW9uLnJhbmdlKSxcblx0XHRcdG1lc3NhZ2U6IHZhbHVlLm1lc3NhZ2UsXG5cdFx0XHRyZXNvdXJjZTogdmFsdWUubG9jYXRpb24udXJpXG5cdFx0fTtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gdG8odmFsdWU6IElSZWxhdGVkSW5mb3JtYXRpb24pOiB0eXBlcy5EaWFnbm9zdGljUmVsYXRlZEluZm9ybWF0aW9uIHtcblx0XHRyZXR1cm4gbmV3IHR5cGVzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24obmV3IHR5cGVzLkxvY2F0aW9uKHZhbHVlLnJlc291cmNlLCBSYW5nZS50byh2YWx1ZSkpLCB2YWx1ZS5tZXNzYWdlKTtcblx0fVxufVxuZXhwb3J0IG5hbWVzcGFjZSBEaWFnbm9zdGljU2V2ZXJpdHkge1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiBudW1iZXIpOiBNYXJrZXJTZXZlcml0eSB7XG5cdFx0c3dpdGNoICh2YWx1ZSkge1xuXHRcdFx0Y2FzZSB0eXBlcy5EaWFnbm9zdGljU2V2ZXJpdHkuRXJyb3I6XG5cdFx0XHRcdHJldHVybiBNYXJrZXJTZXZlcml0eS5FcnJvcjtcblx0XHRcdGNhc2UgdHlwZXMuRGlhZ25vc3RpY1NldmVyaXR5Lldhcm5pbmc6XG5cdFx0XHRcdHJldHVybiBNYXJrZXJTZXZlcml0eS5XYXJuaW5nO1xuXHRcdFx0Y2FzZSB0eXBlcy5EaWFnbm9zdGljU2V2ZXJpdHkuSW5mb3JtYXRpb246XG5cdFx0XHRcdHJldHVybiBNYXJrZXJTZXZlcml0eS5JbmZvO1xuXHRcdFx0Y2FzZSB0eXBlcy5EaWFnbm9zdGljU2V2ZXJpdHkuSGludDpcblx0XHRcdFx0cmV0dXJuIE1hcmtlclNldmVyaXR5LkhpbnQ7XG5cdFx0fVxuXHRcdHJldHVybiBNYXJrZXJTZXZlcml0eS5FcnJvcjtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byh2YWx1ZTogTWFya2VyU2V2ZXJpdHkpOiB0eXBlcy5EaWFnbm9zdGljU2V2ZXJpdHkge1xuXHRcdHN3aXRjaCAodmFsdWUpIHtcblx0XHRcdGNhc2UgTWFya2VyU2V2ZXJpdHkuSW5mbzpcblx0XHRcdFx0cmV0dXJuIHR5cGVzLkRpYWdub3N0aWNTZXZlcml0eS5JbmZvcm1hdGlvbjtcblx0XHRcdGNhc2UgTWFya2VyU2V2ZXJpdHkuV2FybmluZzpcblx0XHRcdFx0cmV0dXJuIHR5cGVzLkRpYWdub3N0aWNTZXZlcml0eS5XYXJuaW5nO1xuXHRcdFx0Y2FzZSBNYXJrZXJTZXZlcml0eS5FcnJvcjpcblx0XHRcdFx0cmV0dXJuIHR5cGVzLkRpYWdub3N0aWNTZXZlcml0eS5FcnJvcjtcblx0XHRcdGNhc2UgTWFya2VyU2V2ZXJpdHkuSGludDpcblx0XHRcdFx0cmV0dXJuIHR5cGVzLkRpYWdub3N0aWNTZXZlcml0eS5IaW50O1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIHR5cGVzLkRpYWdub3N0aWNTZXZlcml0eS5FcnJvcjtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBWaWV3Q29sdW1uIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oY29sdW1uPzogdnNjb2RlLlZpZXdDb2x1bW4pOiBFZGl0b3JHcm91cENvbHVtbiB7XG5cdFx0aWYgKHR5cGVvZiBjb2x1bW4gPT09ICdudW1iZXInICYmIGNvbHVtbiA+PSB0eXBlcy5WaWV3Q29sdW1uLk9uZSkge1xuXHRcdFx0cmV0dXJuIGNvbHVtbiAtIDE7IC8vIGFkanVzdCB6ZXJvIGluZGV4IChWaWV3Q29sdW1uLk9ORSA9PiAwKVxuXHRcdH1cblxuXHRcdGlmIChjb2x1bW4gPT09IHR5cGVzLlZpZXdDb2x1bW4uQmVzaWRlKSB7XG5cdFx0XHRyZXR1cm4gU0lERV9HUk9VUDtcblx0XHR9XG5cblx0XHRyZXR1cm4gQUNUSVZFX0dST1VQOyAvLyBkZWZhdWx0IGlzIGFsd2F5cyB0aGUgYWN0aXZlIGdyb3VwXG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdG8ocG9zaXRpb246IEVkaXRvckdyb3VwQ29sdW1uKTogdnNjb2RlLlZpZXdDb2x1bW4ge1xuXHRcdGlmICh0eXBlb2YgcG9zaXRpb24gPT09ICdudW1iZXInICYmIHBvc2l0aW9uID49IDApIHtcblx0XHRcdHJldHVybiBwb3NpdGlvbiArIDE7IC8vIGFkanVzdCB0byBpbmRleCAoVmlld0NvbHVtbi5PTkUgPT4gMSlcblx0XHR9XG5cblx0XHR0aHJvdyBuZXcgRXJyb3IoYGludmFsaWQgJ0VkaXRvckdyb3VwQ29sdW1uJ2ApO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGlzRGVjb3JhdGlvbk9wdGlvbnMoc29tZXRoaW5nOiBhbnkpOiBzb21ldGhpbmcgaXMgdnNjb2RlLkRlY29yYXRpb25PcHRpb25zIHtcblx0cmV0dXJuICh0eXBlb2Ygc29tZXRoaW5nLnJhbmdlICE9PSAndW5kZWZpbmVkJyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0RlY29yYXRpb25PcHRpb25zQXJyKHNvbWV0aGluZzogdnNjb2RlLlJhbmdlW10gfCB2c2NvZGUuRGVjb3JhdGlvbk9wdGlvbnNbXSk6IHNvbWV0aGluZyBpcyB2c2NvZGUuRGVjb3JhdGlvbk9wdGlvbnNbXSB7XG5cdGlmIChzb21ldGhpbmcubGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0cmV0dXJuIGlzRGVjb3JhdGlvbk9wdGlvbnMoc29tZXRoaW5nWzBdKSA/IHRydWUgOiBmYWxzZTtcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBNYXJrZG93blN0cmluZyB7XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb21NYW55KG1hcmt1cDogKHZzY29kZS5NYXJrZG93blN0cmluZyB8IHZzY29kZS5NYXJrZWRTdHJpbmcpW10pOiBodG1sQ29udGVudC5JTWFya2Rvd25TdHJpbmdbXSB7XG5cdFx0cmV0dXJuIG1hcmt1cC5tYXAoTWFya2Rvd25TdHJpbmcuZnJvbSk7XG5cdH1cblxuXHRpbnRlcmZhY2UgQ29kZWJsb2NrIHtcblx0XHRsYW5ndWFnZTogc3RyaW5nO1xuXHRcdHZhbHVlOiBzdHJpbmc7XG5cdH1cblxuXHRmdW5jdGlvbiBpc0NvZGVibG9jayh0aGluZzogYW55KTogdGhpbmcgaXMgQ29kZWJsb2NrIHtcblx0XHRyZXR1cm4gdGhpbmcgJiYgdHlwZW9mIHRoaW5nID09PSAnb2JqZWN0J1xuXHRcdFx0JiYgdHlwZW9mICg8Q29kZWJsb2NrPnRoaW5nKS5sYW5ndWFnZSA9PT0gJ3N0cmluZydcblx0XHRcdCYmIHR5cGVvZiAoPENvZGVibG9jaz50aGluZykudmFsdWUgPT09ICdzdHJpbmcnO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20obWFya3VwOiB2c2NvZGUuTWFya2Rvd25TdHJpbmcgfCB2c2NvZGUuTWFya2VkU3RyaW5nKTogaHRtbENvbnRlbnQuSU1hcmtkb3duU3RyaW5nIHtcblx0XHRsZXQgcmVzOiBodG1sQ29udGVudC5JTWFya2Rvd25TdHJpbmc7XG5cdFx0aWYgKGlzQ29kZWJsb2NrKG1hcmt1cCkpIHtcblx0XHRcdGNvbnN0IHsgbGFuZ3VhZ2UsIHZhbHVlIH0gPSBtYXJrdXA7XG5cdFx0XHRyZXMgPSB7IHZhbHVlOiAnYGBgJyArIGxhbmd1YWdlICsgJ1xcbicgKyB2YWx1ZSArICdcXG5gYGBcXG4nIH07XG5cdFx0fSBlbHNlIGlmICh0eXBlcy5NYXJrZG93blN0cmluZy5pc01hcmtkb3duU3RyaW5nKG1hcmt1cCkpIHtcblx0XHRcdHJlcyA9IHsgdmFsdWU6IG1hcmt1cC52YWx1ZSwgaXNUcnVzdGVkOiBtYXJrdXAuaXNUcnVzdGVkLCBzdXBwb3J0VGhlbWVJY29uczogbWFya3VwLnN1cHBvcnRUaGVtZUljb25zLCBzdXBwb3J0SHRtbDogbWFya3VwLnN1cHBvcnRIdG1sLCBiYXNlVXJpOiBtYXJrdXAuYmFzZVVyaSB9O1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIG1hcmt1cCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJlcyA9IHsgdmFsdWU6IG1hcmt1cCB9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXMgPSB7IHZhbHVlOiAnJyB9O1xuXHRcdH1cblxuXHRcdC8vIGV4dHJhY3QgdXJpcyBpbnRvIGEgc2VwYXJhdGUgb2JqZWN0XG5cdFx0Y29uc3QgcmVzVXJpczogeyBbaHJlZjogc3RyaW5nXTogVXJpQ29tcG9uZW50cyB9ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRyZXMudXJpcyA9IHJlc1VyaXM7XG5cblx0XHRjb25zdCBjb2xsZWN0VXJpID0gKHsgaHJlZiB9OiB7IGhyZWY6IHN0cmluZyB9KTogc3RyaW5nID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGxldCB1cmkgPSBVUkkucGFyc2UoaHJlZiwgdHJ1ZSk7XG5cdFx0XHRcdHVyaSA9IHVyaS53aXRoKHsgcXVlcnk6IF91cmlNYXNzYWdlKHVyaS5xdWVyeSwgcmVzVXJpcykgfSk7XG5cdFx0XHRcdHJlc1VyaXNbaHJlZl0gPSB1cmk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdC8vIGlnbm9yZVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH07XG5cblx0XHRtYXJrZWQubWFya2VkLndhbGtUb2tlbnMobWFya2VkLm1hcmtlZC5sZXhlcihyZXMudmFsdWUpLCB0b2tlbiA9PiB7XG5cdFx0XHRpZiAodG9rZW4udHlwZSA9PT0gJ2xpbmsnKSB7XG5cdFx0XHRcdGNvbGxlY3RVcmkoeyBocmVmOiB0b2tlbi5ocmVmIH0pO1xuXHRcdFx0fSBlbHNlIGlmICh0b2tlbi50eXBlID09PSAnaW1hZ2UnKSB7XG5cdFx0XHRcdGlmICh0eXBlb2YgdG9rZW4uaHJlZiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRjb2xsZWN0VXJpKGh0bWxDb250ZW50LnBhcnNlSHJlZkFuZERpbWVuc2lvbnModG9rZW4uaHJlZikpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcmVzO1xuXHR9XG5cblx0ZnVuY3Rpb24gX3VyaU1hc3NhZ2UocGFydDogc3RyaW5nLCBidWNrZXQ6IHsgW246IHN0cmluZ106IFVyaUNvbXBvbmVudHMgfSk6IHN0cmluZyB7XG5cdFx0aWYgKCFwYXJ0KSB7XG5cdFx0XHRyZXR1cm4gcGFydDtcblx0XHR9XG5cdFx0bGV0IGRhdGE6IGFueTtcblx0XHR0cnkge1xuXHRcdFx0ZGF0YSA9IHBhcnNlKHBhcnQpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdC8vIGlnbm9yZVxuXHRcdH1cblx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdHJldHVybiBwYXJ0O1xuXHRcdH1cblx0XHRsZXQgY2hhbmdlZCA9IGZhbHNlO1xuXHRcdGRhdGEgPSBjbG9uZUFuZENoYW5nZShkYXRhLCB2YWx1ZSA9PiB7XG5cdFx0XHRpZiAoVVJJLmlzVXJpKHZhbHVlKSkge1xuXHRcdFx0XHRjb25zdCBrZXkgPSBgX191cmlfJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDE2KS5zbGljZSgyLCA4KX1gO1xuXHRcdFx0XHRidWNrZXRba2V5XSA9IHZhbHVlO1xuXHRcdFx0XHRjaGFuZ2VkID0gdHJ1ZTtcblx0XHRcdFx0cmV0dXJuIGtleTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAoIWNoYW5nZWQpIHtcblx0XHRcdHJldHVybiBwYXJ0O1xuXHRcdH1cblxuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeShkYXRhKTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byh2YWx1ZTogaHRtbENvbnRlbnQuSU1hcmtkb3duU3RyaW5nKTogdnNjb2RlLk1hcmtkb3duU3RyaW5nIHtcblx0XHRjb25zdCByZXN1bHQgPSBuZXcgdHlwZXMuTWFya2Rvd25TdHJpbmcodmFsdWUudmFsdWUsIHZhbHVlLnN1cHBvcnRUaGVtZUljb25zKTtcblx0XHRyZXN1bHQuaXNUcnVzdGVkID0gdmFsdWUuaXNUcnVzdGVkO1xuXHRcdHJlc3VsdC5zdXBwb3J0SHRtbCA9IHZhbHVlLnN1cHBvcnRIdG1sO1xuXHRcdHJlc3VsdC5iYXNlVXJpID0gdmFsdWUuYmFzZVVyaSA/IFVSSS5mcm9tKHZhbHVlLmJhc2VVcmkpIDogdW5kZWZpbmVkO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbVN0cmljdCh2YWx1ZTogc3RyaW5nIHwgdnNjb2RlLk1hcmtkb3duU3RyaW5nIHwgdW5kZWZpbmVkIHwgbnVsbCk6IHVuZGVmaW5lZCB8IHN0cmluZyB8IGh0bWxDb250ZW50LklNYXJrZG93blN0cmluZyB7XG5cdFx0aWYgKCF2YWx1ZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyB2YWx1ZSA6IE1hcmtkb3duU3RyaW5nLmZyb20odmFsdWUpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmcm9tUmFuZ2VPclJhbmdlV2l0aE1lc3NhZ2UocmFuZ2VzOiB2c2NvZGUuUmFuZ2VbXSB8IHZzY29kZS5EZWNvcmF0aW9uT3B0aW9uc1tdKTogSURlY29yYXRpb25PcHRpb25zW10ge1xuXHRpZiAoaXNEZWNvcmF0aW9uT3B0aW9uc0FycihyYW5nZXMpKSB7XG5cdFx0cmV0dXJuIHJhbmdlcy5tYXAoKHIpOiBJRGVjb3JhdGlvbk9wdGlvbnMgPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cmFuZ2U6IFJhbmdlLmZyb20oci5yYW5nZSksXG5cdFx0XHRcdGhvdmVyTWVzc2FnZTogQXJyYXkuaXNBcnJheShyLmhvdmVyTWVzc2FnZSlcblx0XHRcdFx0XHQ/IE1hcmtkb3duU3RyaW5nLmZyb21NYW55KHIuaG92ZXJNZXNzYWdlKVxuXHRcdFx0XHRcdDogKHIuaG92ZXJNZXNzYWdlID8gTWFya2Rvd25TdHJpbmcuZnJvbShyLmhvdmVyTWVzc2FnZSkgOiB1bmRlZmluZWQpLFxuXHRcdFx0XHRyZW5kZXJPcHRpb25zOiA8YW55PiAvKiBVUkkgdnMgVXJpICovci5yZW5kZXJPcHRpb25zXG5cdFx0XHR9O1xuXHRcdH0pO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiByYW5nZXMubWFwKChyKTogSURlY29yYXRpb25PcHRpb25zID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJhbmdlOiBSYW5nZS5mcm9tKHIpXG5cdFx0XHR9O1xuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXRoT3JVUklUb1VSSSh2YWx1ZTogc3RyaW5nIHwgVVJJKTogVVJJIHtcblx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRyZXR1cm4gdmFsdWU7XG5cdH1cblx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcblx0XHRyZXR1cm4gVVJJLmZpbGUodmFsdWUpO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiB2YWx1ZTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIFRoZW1hYmxlRGVjb3JhdGlvbkF0dGFjaG1lbnRSZW5kZXJPcHRpb25zIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ob3B0aW9uczogdnNjb2RlLlRoZW1hYmxlRGVjb3JhdGlvbkF0dGFjaG1lbnRSZW5kZXJPcHRpb25zKTogSUNvbnRlbnREZWNvcmF0aW9uUmVuZGVyT3B0aW9ucyB7XG5cdFx0aWYgKHR5cGVvZiBvcHRpb25zID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIG9wdGlvbnM7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRjb250ZW50VGV4dDogb3B0aW9ucy5jb250ZW50VGV4dCxcblx0XHRcdGNvbnRlbnRJY29uUGF0aDogb3B0aW9ucy5jb250ZW50SWNvblBhdGggPyBwYXRoT3JVUklUb1VSSShvcHRpb25zLmNvbnRlbnRJY29uUGF0aCkgOiB1bmRlZmluZWQsXG5cdFx0XHRib3JkZXI6IG9wdGlvbnMuYm9yZGVyLFxuXHRcdFx0Ym9yZGVyQ29sb3I6IDxzdHJpbmcgfCB0eXBlcy5UaGVtZUNvbG9yPm9wdGlvbnMuYm9yZGVyQ29sb3IsXG5cdFx0XHRmb250U3R5bGU6IG9wdGlvbnMuZm9udFN0eWxlLFxuXHRcdFx0Zm9udFdlaWdodDogb3B0aW9ucy5mb250V2VpZ2h0LFxuXHRcdFx0dGV4dERlY29yYXRpb246IG9wdGlvbnMudGV4dERlY29yYXRpb24sXG5cdFx0XHRjb2xvcjogPHN0cmluZyB8IHR5cGVzLlRoZW1lQ29sb3I+b3B0aW9ucy5jb2xvcixcblx0XHRcdGJhY2tncm91bmRDb2xvcjogPHN0cmluZyB8IHR5cGVzLlRoZW1lQ29sb3I+b3B0aW9ucy5iYWNrZ3JvdW5kQ29sb3IsXG5cdFx0XHRtYXJnaW46IG9wdGlvbnMubWFyZ2luLFxuXHRcdFx0d2lkdGg6IG9wdGlvbnMud2lkdGgsXG5cdFx0XHRoZWlnaHQ6IG9wdGlvbnMuaGVpZ2h0LFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBUaGVtYWJsZURlY29yYXRpb25SZW5kZXJPcHRpb25zIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ob3B0aW9uczogdnNjb2RlLlRoZW1hYmxlRGVjb3JhdGlvblJlbmRlck9wdGlvbnMpOiBJVGhlbWVEZWNvcmF0aW9uUmVuZGVyT3B0aW9ucyB7XG5cdFx0aWYgKHR5cGVvZiBvcHRpb25zID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIG9wdGlvbnM7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRiYWNrZ3JvdW5kQ29sb3I6IDxzdHJpbmcgfCB0eXBlcy5UaGVtZUNvbG9yPm9wdGlvbnMuYmFja2dyb3VuZENvbG9yLFxuXHRcdFx0b3V0bGluZTogb3B0aW9ucy5vdXRsaW5lLFxuXHRcdFx0b3V0bGluZUNvbG9yOiA8c3RyaW5nIHwgdHlwZXMuVGhlbWVDb2xvcj5vcHRpb25zLm91dGxpbmVDb2xvcixcblx0XHRcdG91dGxpbmVTdHlsZTogb3B0aW9ucy5vdXRsaW5lU3R5bGUsXG5cdFx0XHRvdXRsaW5lV2lkdGg6IG9wdGlvbnMub3V0bGluZVdpZHRoLFxuXHRcdFx0Ym9yZGVyOiBvcHRpb25zLmJvcmRlcixcblx0XHRcdGJvcmRlckNvbG9yOiA8c3RyaW5nIHwgdHlwZXMuVGhlbWVDb2xvcj5vcHRpb25zLmJvcmRlckNvbG9yLFxuXHRcdFx0Ym9yZGVyUmFkaXVzOiBvcHRpb25zLmJvcmRlclJhZGl1cyxcblx0XHRcdGJvcmRlclNwYWNpbmc6IG9wdGlvbnMuYm9yZGVyU3BhY2luZyxcblx0XHRcdGJvcmRlclN0eWxlOiBvcHRpb25zLmJvcmRlclN0eWxlLFxuXHRcdFx0Ym9yZGVyV2lkdGg6IG9wdGlvbnMuYm9yZGVyV2lkdGgsXG5cdFx0XHRmb250U3R5bGU6IG9wdGlvbnMuZm9udFN0eWxlLFxuXHRcdFx0Zm9udFdlaWdodDogb3B0aW9ucy5mb250V2VpZ2h0LFxuXHRcdFx0dGV4dERlY29yYXRpb246IG9wdGlvbnMudGV4dERlY29yYXRpb24sXG5cdFx0XHRjdXJzb3I6IG9wdGlvbnMuY3Vyc29yLFxuXHRcdFx0Y29sb3I6IDxzdHJpbmcgfCB0eXBlcy5UaGVtZUNvbG9yPm9wdGlvbnMuY29sb3IsXG5cdFx0XHRvcGFjaXR5OiBvcHRpb25zLm9wYWNpdHksXG5cdFx0XHRsZXR0ZXJTcGFjaW5nOiBvcHRpb25zLmxldHRlclNwYWNpbmcsXG5cdFx0XHRndXR0ZXJJY29uUGF0aDogb3B0aW9ucy5ndXR0ZXJJY29uUGF0aCA/IHBhdGhPclVSSVRvVVJJKG9wdGlvbnMuZ3V0dGVySWNvblBhdGgpIDogdW5kZWZpbmVkLFxuXHRcdFx0Z3V0dGVySWNvblNpemU6IG9wdGlvbnMuZ3V0dGVySWNvblNpemUsXG5cdFx0XHRvdmVydmlld1J1bGVyQ29sb3I6IDxzdHJpbmcgfCB0eXBlcy5UaGVtZUNvbG9yPm9wdGlvbnMub3ZlcnZpZXdSdWxlckNvbG9yLFxuXHRcdFx0YmVmb3JlOiBvcHRpb25zLmJlZm9yZSA/IFRoZW1hYmxlRGVjb3JhdGlvbkF0dGFjaG1lbnRSZW5kZXJPcHRpb25zLmZyb20ob3B0aW9ucy5iZWZvcmUpIDogdW5kZWZpbmVkLFxuXHRcdFx0YWZ0ZXI6IG9wdGlvbnMuYWZ0ZXIgPyBUaGVtYWJsZURlY29yYXRpb25BdHRhY2htZW50UmVuZGVyT3B0aW9ucy5mcm9tKG9wdGlvbnMuYWZ0ZXIpIDogdW5kZWZpbmVkLFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBEZWNvcmF0aW9uUmFuZ2VCZWhhdmlvciB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiB0eXBlcy5EZWNvcmF0aW9uUmFuZ2VCZWhhdmlvcik6IFRyYWNrZWRSYW5nZVN0aWNraW5lc3Mge1xuXHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fVxuXHRcdHN3aXRjaCAodmFsdWUpIHtcblx0XHRcdGNhc2UgdHlwZXMuRGVjb3JhdGlvblJhbmdlQmVoYXZpb3IuT3Blbk9wZW46XG5cdFx0XHRcdHJldHVybiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLkFsd2F5c0dyb3dzV2hlblR5cGluZ0F0RWRnZXM7XG5cdFx0XHRjYXNlIHR5cGVzLkRlY29yYXRpb25SYW5nZUJlaGF2aW9yLkNsb3NlZENsb3NlZDpcblx0XHRcdFx0cmV0dXJuIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzO1xuXHRcdFx0Y2FzZSB0eXBlcy5EZWNvcmF0aW9uUmFuZ2VCZWhhdmlvci5PcGVuQ2xvc2VkOlxuXHRcdFx0XHRyZXR1cm4gVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQmVmb3JlO1xuXHRcdFx0Y2FzZSB0eXBlcy5EZWNvcmF0aW9uUmFuZ2VCZWhhdmlvci5DbG9zZWRPcGVuOlxuXHRcdFx0XHRyZXR1cm4gVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5Hcm93c09ubHlXaGVuVHlwaW5nQWZ0ZXI7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgRGVjb3JhdGlvblJlbmRlck9wdGlvbnMge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShvcHRpb25zOiB2c2NvZGUuRGVjb3JhdGlvblJlbmRlck9wdGlvbnMpOiBJRGVjb3JhdGlvblJlbmRlck9wdGlvbnMge1xuXHRcdHJldHVybiB7XG5cdFx0XHRpc1dob2xlTGluZTogb3B0aW9ucy5pc1dob2xlTGluZSxcblx0XHRcdHJhbmdlQmVoYXZpb3I6IG9wdGlvbnMucmFuZ2VCZWhhdmlvciA/IERlY29yYXRpb25SYW5nZUJlaGF2aW9yLmZyb20ob3B0aW9ucy5yYW5nZUJlaGF2aW9yKSA6IHVuZGVmaW5lZCxcblx0XHRcdG92ZXJ2aWV3UnVsZXJMYW5lOiBvcHRpb25zLm92ZXJ2aWV3UnVsZXJMYW5lLFxuXHRcdFx0bGlnaHQ6IG9wdGlvbnMubGlnaHQgPyBUaGVtYWJsZURlY29yYXRpb25SZW5kZXJPcHRpb25zLmZyb20ob3B0aW9ucy5saWdodCkgOiB1bmRlZmluZWQsXG5cdFx0XHRkYXJrOiBvcHRpb25zLmRhcmsgPyBUaGVtYWJsZURlY29yYXRpb25SZW5kZXJPcHRpb25zLmZyb20ob3B0aW9ucy5kYXJrKSA6IHVuZGVmaW5lZCxcblxuXHRcdFx0YmFja2dyb3VuZENvbG9yOiA8c3RyaW5nIHwgdHlwZXMuVGhlbWVDb2xvcj5vcHRpb25zLmJhY2tncm91bmRDb2xvcixcblx0XHRcdG91dGxpbmU6IG9wdGlvbnMub3V0bGluZSxcblx0XHRcdG91dGxpbmVDb2xvcjogPHN0cmluZyB8IHR5cGVzLlRoZW1lQ29sb3I+b3B0aW9ucy5vdXRsaW5lQ29sb3IsXG5cdFx0XHRvdXRsaW5lU3R5bGU6IG9wdGlvbnMub3V0bGluZVN0eWxlLFxuXHRcdFx0b3V0bGluZVdpZHRoOiBvcHRpb25zLm91dGxpbmVXaWR0aCxcblx0XHRcdGJvcmRlcjogb3B0aW9ucy5ib3JkZXIsXG5cdFx0XHRib3JkZXJDb2xvcjogPHN0cmluZyB8IHR5cGVzLlRoZW1lQ29sb3I+b3B0aW9ucy5ib3JkZXJDb2xvcixcblx0XHRcdGJvcmRlclJhZGl1czogb3B0aW9ucy5ib3JkZXJSYWRpdXMsXG5cdFx0XHRib3JkZXJTcGFjaW5nOiBvcHRpb25zLmJvcmRlclNwYWNpbmcsXG5cdFx0XHRib3JkZXJTdHlsZTogb3B0aW9ucy5ib3JkZXJTdHlsZSxcblx0XHRcdGJvcmRlcldpZHRoOiBvcHRpb25zLmJvcmRlcldpZHRoLFxuXHRcdFx0Zm9udFN0eWxlOiBvcHRpb25zLmZvbnRTdHlsZSxcblx0XHRcdGZvbnRXZWlnaHQ6IG9wdGlvbnMuZm9udFdlaWdodCxcblx0XHRcdHRleHREZWNvcmF0aW9uOiBvcHRpb25zLnRleHREZWNvcmF0aW9uLFxuXHRcdFx0Y3Vyc29yOiBvcHRpb25zLmN1cnNvcixcblx0XHRcdGNvbG9yOiA8c3RyaW5nIHwgdHlwZXMuVGhlbWVDb2xvcj5vcHRpb25zLmNvbG9yLFxuXHRcdFx0b3BhY2l0eTogb3B0aW9ucy5vcGFjaXR5LFxuXHRcdFx0bGV0dGVyU3BhY2luZzogb3B0aW9ucy5sZXR0ZXJTcGFjaW5nLFxuXHRcdFx0Z3V0dGVySWNvblBhdGg6IG9wdGlvbnMuZ3V0dGVySWNvblBhdGggPyBwYXRoT3JVUklUb1VSSShvcHRpb25zLmd1dHRlckljb25QYXRoKSA6IHVuZGVmaW5lZCxcblx0XHRcdGd1dHRlckljb25TaXplOiBvcHRpb25zLmd1dHRlckljb25TaXplLFxuXHRcdFx0b3ZlcnZpZXdSdWxlckNvbG9yOiA8c3RyaW5nIHwgdHlwZXMuVGhlbWVDb2xvcj5vcHRpb25zLm92ZXJ2aWV3UnVsZXJDb2xvcixcblx0XHRcdGJlZm9yZTogb3B0aW9ucy5iZWZvcmUgPyBUaGVtYWJsZURlY29yYXRpb25BdHRhY2htZW50UmVuZGVyT3B0aW9ucy5mcm9tKG9wdGlvbnMuYmVmb3JlKSA6IHVuZGVmaW5lZCxcblx0XHRcdGFmdGVyOiBvcHRpb25zLmFmdGVyID8gVGhlbWFibGVEZWNvcmF0aW9uQXR0YWNobWVudFJlbmRlck9wdGlvbnMuZnJvbShvcHRpb25zLmFmdGVyKSA6IHVuZGVmaW5lZCxcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgVGV4dEVkaXQge1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGVkaXQ6IHZzY29kZS5UZXh0RWRpdCk6IGxhbmd1YWdlcy5UZXh0RWRpdCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHRleHQ6IGVkaXQubmV3VGV4dCxcblx0XHRcdGVvbDogZWRpdC5uZXdFb2wgJiYgRW5kT2ZMaW5lLmZyb20oZWRpdC5uZXdFb2wpLFxuXHRcdFx0cmFuZ2U6IFJhbmdlLmZyb20oZWRpdC5yYW5nZSlcblx0XHR9O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKGVkaXQ6IGxhbmd1YWdlcy5UZXh0RWRpdCk6IHR5cGVzLlRleHRFZGl0IHtcblx0XHRjb25zdCByZXN1bHQgPSBuZXcgdHlwZXMuVGV4dEVkaXQoUmFuZ2UudG8oZWRpdC5yYW5nZSksIGVkaXQudGV4dCk7XG5cdFx0cmVzdWx0Lm5ld0VvbCA9ICh0eXBlb2YgZWRpdC5lb2wgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogRW5kT2ZMaW5lLnRvKGVkaXQuZW9sKSkhO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBXb3Jrc3BhY2VFZGl0IHtcblxuXHRleHBvcnQgaW50ZXJmYWNlIElWZXJzaW9uSW5mb3JtYXRpb25Qcm92aWRlciB7XG5cdFx0Z2V0VGV4dERvY3VtZW50VmVyc2lvbih1cmk6IFVSSSk6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0XHRnZXROb3RlYm9va0RvY3VtZW50VmVyc2lvbih1cmk6IFVSSSk6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiB2c2NvZGUuV29ya3NwYWNlRWRpdCwgdmVyc2lvbkluZm8/OiBJVmVyc2lvbkluZm9ybWF0aW9uUHJvdmlkZXIpOiBleHRIb3N0UHJvdG9jb2wuSVdvcmtzcGFjZUVkaXREdG8ge1xuXHRcdGNvbnN0IHJlc3VsdDogZXh0SG9zdFByb3RvY29sLklXb3Jrc3BhY2VFZGl0RHRvID0ge1xuXHRcdFx0ZWRpdHM6IFtdXG5cdFx0fTtcblxuXHRcdGlmICh2YWx1ZSBpbnN0YW5jZW9mIHR5cGVzLldvcmtzcGFjZUVkaXQpIHtcblxuXHRcdFx0Ly8gY29sbGVjdCBhbGwgZmlsZXMgdGhhdCBhcmUgdG8gYmUgY3JlYXRlZCBzbyB0aGF0IHRoZWlyIHZlcnNpb25cblx0XHRcdC8vIGluZm9ybWF0aW9uIChpbiBjYXNlIHRoZXkgZXhpc3QgYXMgdGV4dCBtb2RlbCBhbHJlYWR5KSBjYW4gYmUgaWdub3JlZFxuXHRcdFx0Y29uc3QgdG9DcmVhdGUgPSBuZXcgUmVzb3VyY2VTZXQoKTtcblx0XHRcdGZvciAoY29uc3QgZW50cnkgb2YgdmFsdWUuX2FsbEVudHJpZXMoKSkge1xuXHRcdFx0XHRpZiAoZW50cnkuX3R5cGUgPT09IHR5cGVzLkZpbGVFZGl0VHlwZS5GaWxlICYmIFVSSS5pc1VyaShlbnRyeS50bykgJiYgZW50cnkuZnJvbSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dG9DcmVhdGUuYWRkKGVudHJ5LnRvKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHZhbHVlLl9hbGxFbnRyaWVzKCkpIHtcblxuXHRcdFx0XHRpZiAoZW50cnkuX3R5cGUgPT09IHR5cGVzLkZpbGVFZGl0VHlwZS5GaWxlKSB7XG5cdFx0XHRcdFx0bGV0IGNvbnRlbnRzOiB7IHR5cGU6ICdiYXNlNjQnOyB2YWx1ZTogc3RyaW5nIH0gfCB7IHR5cGU6ICdkYXRhVHJhbnNmZXJJdGVtJzsgaWQ6IHN0cmluZyB9IHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGlmIChlbnRyeS5vcHRpb25zPy5jb250ZW50cykge1xuXHRcdFx0XHRcdFx0aWYgKEFycmF5QnVmZmVyLmlzVmlldyhlbnRyeS5vcHRpb25zLmNvbnRlbnRzKSkge1xuXHRcdFx0XHRcdFx0XHRjb250ZW50cyA9IHsgdHlwZTogJ2Jhc2U2NCcsIHZhbHVlOiBlbmNvZGVCYXNlNjQoVlNCdWZmZXIud3JhcChlbnRyeS5vcHRpb25zLmNvbnRlbnRzKSkgfTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRlbnRzID0geyB0eXBlOiAnZGF0YVRyYW5zZmVySXRlbScsIGlkOiAoZW50cnkub3B0aW9ucy5jb250ZW50cyBhcyB0eXBlcy5EYXRhVHJhbnNmZXJGaWxlKS5faXRlbUlkIH07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gZmlsZSBvcGVyYXRpb25cblx0XHRcdFx0XHRyZXN1bHQuZWRpdHMucHVzaCh7XG5cdFx0XHRcdFx0XHRvbGRSZXNvdXJjZTogZW50cnkuZnJvbSxcblx0XHRcdFx0XHRcdG5ld1Jlc291cmNlOiBlbnRyeS50byxcblx0XHRcdFx0XHRcdG9wdGlvbnM6IHsgLi4uZW50cnkub3B0aW9ucywgY29udGVudHMgfSxcblx0XHRcdFx0XHRcdG1ldGFkYXRhOiBlbnRyeS5tZXRhZGF0YVxuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdH0gZWxzZSBpZiAoZW50cnkuX3R5cGUgPT09IHR5cGVzLkZpbGVFZGl0VHlwZS5UZXh0KSB7XG5cdFx0XHRcdFx0Ly8gdGV4dCBlZGl0c1xuXHRcdFx0XHRcdHJlc3VsdC5lZGl0cy5wdXNoKHtcblx0XHRcdFx0XHRcdHJlc291cmNlOiBlbnRyeS51cmksXG5cdFx0XHRcdFx0XHR0ZXh0RWRpdDogVGV4dEVkaXQuZnJvbShlbnRyeS5lZGl0KSxcblx0XHRcdFx0XHRcdHZlcnNpb25JZDogIXRvQ3JlYXRlLmhhcyhlbnRyeS51cmkpID8gdmVyc2lvbkluZm8/LmdldFRleHREb2N1bWVudFZlcnNpb24oZW50cnkudXJpKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdG1ldGFkYXRhOiBlbnRyeS5tZXRhZGF0YVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGVudHJ5Ll90eXBlID09PSB0eXBlcy5GaWxlRWRpdFR5cGUuU25pcHBldCkge1xuXHRcdFx0XHRcdHJlc3VsdC5lZGl0cy5wdXNoKHtcblx0XHRcdFx0XHRcdHJlc291cmNlOiBlbnRyeS51cmksXG5cdFx0XHRcdFx0XHR0ZXh0RWRpdDoge1xuXHRcdFx0XHRcdFx0XHRyYW5nZTogUmFuZ2UuZnJvbShlbnRyeS5yYW5nZSksXG5cdFx0XHRcdFx0XHRcdHRleHQ6IGVudHJ5LmVkaXQudmFsdWUsXG5cdFx0XHRcdFx0XHRcdGluc2VydEFzU25pcHBldDogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0a2VlcFdoaXRlc3BhY2U6IGVudHJ5LmtlZXBXaGl0ZXNwYWNlXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0dmVyc2lvbklkOiAhdG9DcmVhdGUuaGFzKGVudHJ5LnVyaSkgPyB2ZXJzaW9uSW5mbz8uZ2V0VGV4dERvY3VtZW50VmVyc2lvbihlbnRyeS51cmkpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0bWV0YWRhdGE6IGVudHJ5Lm1ldGFkYXRhXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0fSBlbHNlIGlmIChlbnRyeS5fdHlwZSA9PT0gdHlwZXMuRmlsZUVkaXRUeXBlLkNlbGwpIHtcblx0XHRcdFx0XHQvLyBjZWxsIGVkaXRcblx0XHRcdFx0XHRyZXN1bHQuZWRpdHMucHVzaCh7XG5cdFx0XHRcdFx0XHRtZXRhZGF0YTogZW50cnkubWV0YWRhdGEsXG5cdFx0XHRcdFx0XHRyZXNvdXJjZTogZW50cnkudXJpLFxuXHRcdFx0XHRcdFx0Y2VsbEVkaXQ6IGVudHJ5LmVkaXQsXG5cdFx0XHRcdFx0XHRub3RlYm9va1ZlcnNpb25JZDogdmVyc2lvbkluZm8/LmdldE5vdGVib29rRG9jdW1lbnRWZXJzaW9uKGVudHJ5LnVyaSlcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHR9IGVsc2UgaWYgKGVudHJ5Ll90eXBlID09PSB0eXBlcy5GaWxlRWRpdFR5cGUuQ2VsbFJlcGxhY2UpIHtcblx0XHRcdFx0XHQvLyBjZWxsIHJlcGxhY2Vcblx0XHRcdFx0XHRyZXN1bHQuZWRpdHMucHVzaCh7XG5cdFx0XHRcdFx0XHRtZXRhZGF0YTogZW50cnkubWV0YWRhdGEsXG5cdFx0XHRcdFx0XHRyZXNvdXJjZTogZW50cnkudXJpLFxuXHRcdFx0XHRcdFx0bm90ZWJvb2tWZXJzaW9uSWQ6IHZlcnNpb25JbmZvPy5nZXROb3RlYm9va0RvY3VtZW50VmVyc2lvbihlbnRyeS51cmkpLFxuXHRcdFx0XHRcdFx0Y2VsbEVkaXQ6IHtcblx0XHRcdFx0XHRcdFx0ZWRpdFR5cGU6IG5vdGVib29rcy5DZWxsRWRpdFR5cGUuUmVwbGFjZSxcblx0XHRcdFx0XHRcdFx0aW5kZXg6IGVudHJ5LmluZGV4LFxuXHRcdFx0XHRcdFx0XHRjb3VudDogZW50cnkuY291bnQsXG5cdFx0XHRcdFx0XHRcdGNlbGxzOiBlbnRyeS5jZWxscy5tYXAoTm90ZWJvb2tDZWxsRGF0YS5mcm9tKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdG8odmFsdWU6IGV4dEhvc3RQcm90b2NvbC5JV29ya3NwYWNlRWRpdER0bykge1xuXHRcdGNvbnN0IHJlc3VsdCA9IG5ldyB0eXBlcy5Xb3Jrc3BhY2VFZGl0KCk7XG5cdFx0Y29uc3QgZWRpdHMgPSBuZXcgUmVzb3VyY2VNYXA8KHR5cGVzLlRleHRFZGl0IHwgdHlwZXMuU25pcHBldFRleHRFZGl0KVtdPigpO1xuXHRcdGZvciAoY29uc3QgZWRpdCBvZiB2YWx1ZS5lZGl0cykge1xuXHRcdFx0aWYgKCg8ZXh0SG9zdFByb3RvY29sLklXb3Jrc3BhY2VUZXh0RWRpdER0bz5lZGl0KS50ZXh0RWRpdCkge1xuXG5cdFx0XHRcdGNvbnN0IGl0ZW0gPSA8ZXh0SG9zdFByb3RvY29sLklXb3Jrc3BhY2VUZXh0RWRpdER0bz5lZGl0O1xuXHRcdFx0XHRjb25zdCB1cmkgPSBVUkkucmV2aXZlKGl0ZW0ucmVzb3VyY2UpO1xuXHRcdFx0XHRjb25zdCByYW5nZSA9IFJhbmdlLnRvKGl0ZW0udGV4dEVkaXQucmFuZ2UpO1xuXHRcdFx0XHRjb25zdCB0ZXh0ID0gaXRlbS50ZXh0RWRpdC50ZXh0O1xuXHRcdFx0XHRjb25zdCBpc1NuaXBwZXQgPSBpdGVtLnRleHRFZGl0Lmluc2VydEFzU25pcHBldDtcblxuXHRcdFx0XHRsZXQgZWRpdE9yU25pcHBldFRlc3Q6IHR5cGVzLlRleHRFZGl0IHwgdHlwZXMuU25pcHBldFRleHRFZGl0O1xuXHRcdFx0XHRpZiAoaXNTbmlwcGV0KSB7XG5cdFx0XHRcdFx0ZWRpdE9yU25pcHBldFRlc3QgPSB0eXBlcy5TbmlwcGV0VGV4dEVkaXQucmVwbGFjZShyYW5nZSwgbmV3IHR5cGVzLlNuaXBwZXRTdHJpbmcodGV4dCkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGVkaXRPclNuaXBwZXRUZXN0ID0gdHlwZXMuVGV4dEVkaXQucmVwbGFjZShyYW5nZSwgdGV4dCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBhcnJheSA9IGVkaXRzLmdldCh1cmkpO1xuXHRcdFx0XHRpZiAoIWFycmF5KSB7XG5cdFx0XHRcdFx0ZWRpdHMuc2V0KHVyaSwgW2VkaXRPclNuaXBwZXRUZXN0XSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YXJyYXkucHVzaChlZGl0T3JTbmlwcGV0VGVzdCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0LnJlbmFtZUZpbGUoXG5cdFx0XHRcdFx0VVJJLnJldml2ZSgoPGV4dEhvc3RQcm90b2NvbC5JV29ya3NwYWNlRmlsZUVkaXREdG8+ZWRpdCkub2xkUmVzb3VyY2UhKSxcblx0XHRcdFx0XHRVUkkucmV2aXZlKCg8ZXh0SG9zdFByb3RvY29sLklXb3Jrc3BhY2VGaWxlRWRpdER0bz5lZGl0KS5uZXdSZXNvdXJjZSEpLFxuXHRcdFx0XHRcdCg8ZXh0SG9zdFByb3RvY29sLklXb3Jrc3BhY2VGaWxlRWRpdER0bz5lZGl0KS5vcHRpb25zXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBbdXJpLCBhcnJheV0gb2YgZWRpdHMpIHtcblx0XHRcdHJlc3VsdC5zZXQodXJpLCBhcnJheSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuXG5leHBvcnQgbmFtZXNwYWNlIFN5bWJvbEtpbmQge1xuXG5cdGNvbnN0IF9mcm9tTWFwcGluZzogeyBba2luZDogbnVtYmVyXTogbGFuZ3VhZ2VzLlN5bWJvbEtpbmQgfSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdF9mcm9tTWFwcGluZ1t0eXBlcy5TeW1ib2xLaW5kLkZpbGVdID0gbGFuZ3VhZ2VzLlN5bWJvbEtpbmQuRmlsZTtcblx0X2Zyb21NYXBwaW5nW3R5cGVzLlN5bWJvbEtpbmQuTW9kdWxlXSA9IGxhbmd1YWdlcy5TeW1ib2xLaW5kLk1vZHVsZTtcblx0X2Zyb21NYXBwaW5nW3R5cGVzLlN5bWJvbEtpbmQuTmFtZXNwYWNlXSA9IGxhbmd1YWdlcy5TeW1ib2xLaW5kLk5hbWVzcGFjZTtcblx0X2Zyb21NYXBwaW5nW3R5cGVzLlN5bWJvbEtpbmQuUGFja2FnZV0gPSBsYW5ndWFnZXMuU3ltYm9sS2luZC5QYWNrYWdlO1xuXHRfZnJvbU1hcHBpbmdbdHlwZXMuU3ltYm9sS2luZC5DbGFzc10gPSBsYW5ndWFnZXMuU3ltYm9sS2luZC5DbGFzcztcblx0X2Zyb21NYXBwaW5nW3R5cGVzLlN5bWJvbEtpbmQuTWV0aG9kXSA9IGxhbmd1YWdlcy5TeW1ib2xLaW5kLk1ldGhvZDtcblx0X2Zyb21NYXBwaW5nW3R5cGVzLlN5bWJvbEtpbmQuUHJvcGVydHldID0gbGFuZ3VhZ2VzLlN5bWJvbEtpbmQuUHJvcGVydHk7XG5cdF9mcm9tTWFwcGluZ1t0eXBlcy5TeW1ib2xLaW5kLkZpZWxkXSA9IGxhbmd1YWdlcy5TeW1ib2xLaW5kLkZpZWxkO1xuXHRfZnJvbU1hcHBpbmdbdHlwZXMuU3ltYm9sS2luZC5Db25zdHJ1Y3Rvcl0gPSBsYW5ndWFnZXMuU3ltYm9sS2luZC5Db25zdHJ1Y3Rvcjtcblx0X2Zyb21NYXBwaW5nW3R5cGVzLlN5bWJvbEtpbmQuRW51bV0gPSBsYW5ndWFnZXMuU3ltYm9sS2luZC5FbnVtO1xuXHRfZnJvbU1hcHBpbmdbdHlwZXMuU3ltYm9sS2luZC5JbnRlcmZhY2VdID0gbGFuZ3VhZ2VzLlN5bWJvbEtpbmQuSW50ZXJmYWNlO1xuXHRfZnJvbU1hcHBpbmdbdHlwZXMuU3ltYm9sS2luZC5GdW5jdGlvbl0gPSBsYW5ndWFnZXMuU3ltYm9sS2luZC5GdW5jdGlvbjtcblx0X2Zyb21NYXBwaW5nW3R5cGVzLlN5bWJvbEtpbmQuVmFyaWFibGVdID0gbGFuZ3VhZ2VzLlN5bWJvbEtpbmQuVmFyaWFibGU7XG5cdF9mcm9tTWFwcGluZ1t0eXBlcy5TeW1ib2xLaW5kLkNvbnN0YW50XSA9IGxhbmd1YWdlcy5TeW1ib2xLaW5kLkNvbnN0YW50O1xuXHRfZnJvbU1hcHBpbmdbdHlwZXMuU3ltYm9sS2luZC5TdHJpbmddID0gbGFuZ3VhZ2VzLlN5bWJvbEtpbmQuU3RyaW5nO1xuXHRfZnJvbU1hcHBpbmdbdHlwZXMuU3ltYm9sS2luZC5OdW1iZXJdID0gbGFuZ3VhZ2VzLlN5bWJvbEtpbmQuTnVtYmVyO1xuXHRfZnJvbU1hcHBpbmdbdHlwZXMuU3ltYm9sS2luZC5Cb29sZWFuXSA9IGxhbmd1YWdlcy5TeW1ib2xLaW5kLkJvb2xlYW47XG5cdF9mcm9tTWFwcGluZ1t0eXBlcy5TeW1ib2xLaW5kLkFycmF5XSA9IGxhbmd1YWdlcy5TeW1ib2xLaW5kLkFycmF5O1xuXHRfZnJvbU1hcHBpbmdbdHlwZXMuU3ltYm9sS2luZC5PYmplY3RdID0gbGFuZ3VhZ2VzLlN5bWJvbEtpbmQuT2JqZWN0O1xuXHRfZnJvbU1hcHBpbmdbdHlwZXMuU3ltYm9sS2luZC5LZXldID0gbGFuZ3VhZ2VzLlN5bWJvbEtpbmQuS2V5O1xuXHRfZnJvbU1hcHBpbmdbdHlwZXMuU3ltYm9sS2luZC5OdWxsXSA9IGxhbmd1YWdlcy5TeW1ib2xLaW5kLk51bGw7XG5cdF9mcm9tTWFwcGluZ1t0eXBlcy5TeW1ib2xLaW5kLkVudW1NZW1iZXJdID0gbGFuZ3VhZ2VzLlN5bWJvbEtpbmQuRW51bU1lbWJlcjtcblx0X2Zyb21NYXBwaW5nW3R5cGVzLlN5bWJvbEtpbmQuU3RydWN0XSA9IGxhbmd1YWdlcy5TeW1ib2xLaW5kLlN0cnVjdDtcblx0X2Zyb21NYXBwaW5nW3R5cGVzLlN5bWJvbEtpbmQuRXZlbnRdID0gbGFuZ3VhZ2VzLlN5bWJvbEtpbmQuRXZlbnQ7XG5cdF9mcm9tTWFwcGluZ1t0eXBlcy5TeW1ib2xLaW5kLk9wZXJhdG9yXSA9IGxhbmd1YWdlcy5TeW1ib2xLaW5kLk9wZXJhdG9yO1xuXHRfZnJvbU1hcHBpbmdbdHlwZXMuU3ltYm9sS2luZC5UeXBlUGFyYW1ldGVyXSA9IGxhbmd1YWdlcy5TeW1ib2xLaW5kLlR5cGVQYXJhbWV0ZXI7XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oa2luZDogdnNjb2RlLlN5bWJvbEtpbmQpOiBsYW5ndWFnZXMuU3ltYm9sS2luZCB7XG5cdFx0cmV0dXJuIHR5cGVvZiBfZnJvbU1hcHBpbmdba2luZF0gPT09ICdudW1iZXInID8gX2Zyb21NYXBwaW5nW2tpbmRdIDogbGFuZ3VhZ2VzLlN5bWJvbEtpbmQuUHJvcGVydHk7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdG8oa2luZDogbGFuZ3VhZ2VzLlN5bWJvbEtpbmQpOiB2c2NvZGUuU3ltYm9sS2luZCB7XG5cdFx0Zm9yIChjb25zdCBrIGluIF9mcm9tTWFwcGluZykge1xuXHRcdFx0aWYgKF9mcm9tTWFwcGluZ1trXSA9PT0ga2luZCkge1xuXHRcdFx0XHRyZXR1cm4gTnVtYmVyKGspO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdHlwZXMuU3ltYm9sS2luZC5Qcm9wZXJ0eTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIFN5bWJvbFRhZyB7XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oa2luZDogdHlwZXMuU3ltYm9sVGFnKTogbGFuZ3VhZ2VzLlN5bWJvbFRhZyB7XG5cdFx0c3dpdGNoIChraW5kKSB7XG5cdFx0XHRjYXNlIHR5cGVzLlN5bWJvbFRhZy5EZXByZWNhdGVkOiByZXR1cm4gbGFuZ3VhZ2VzLlN5bWJvbFRhZy5EZXByZWNhdGVkO1xuXHRcdH1cblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byhraW5kOiBsYW5ndWFnZXMuU3ltYm9sVGFnKTogdHlwZXMuU3ltYm9sVGFnIHtcblx0XHRzd2l0Y2ggKGtpbmQpIHtcblx0XHRcdGNhc2UgbGFuZ3VhZ2VzLlN5bWJvbFRhZy5EZXByZWNhdGVkOiByZXR1cm4gdHlwZXMuU3ltYm9sVGFnLkRlcHJlY2F0ZWQ7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgV29ya3NwYWNlU3ltYm9sIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oaW5mbzogdnNjb2RlLlN5bWJvbEluZm9ybWF0aW9uKTogc2VhcmNoLklXb3Jrc3BhY2VTeW1ib2wge1xuXHRcdHJldHVybiB7XG5cdFx0XHRuYW1lOiBpbmZvLm5hbWUsXG5cdFx0XHRraW5kOiBTeW1ib2xLaW5kLmZyb20oaW5mby5raW5kKSxcblx0XHRcdHRhZ3M6IGluZm8udGFncyAmJiBpbmZvLnRhZ3MubWFwKFN5bWJvbFRhZy5mcm9tKSxcblx0XHRcdGNvbnRhaW5lck5hbWU6IGluZm8uY29udGFpbmVyTmFtZSxcblx0XHRcdGxvY2F0aW9uOiBsb2NhdGlvbi5mcm9tKGluZm8ubG9jYXRpb24pXG5cdFx0fTtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gdG8oaW5mbzogc2VhcmNoLklXb3Jrc3BhY2VTeW1ib2wpOiB0eXBlcy5TeW1ib2xJbmZvcm1hdGlvbiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IHR5cGVzLlN5bWJvbEluZm9ybWF0aW9uKFxuXHRcdFx0aW5mby5uYW1lLFxuXHRcdFx0U3ltYm9sS2luZC50byhpbmZvLmtpbmQpLFxuXHRcdFx0aW5mby5jb250YWluZXJOYW1lLFxuXHRcdFx0bG9jYXRpb24udG8oaW5mby5sb2NhdGlvbilcblx0XHQpO1xuXHRcdHJlc3VsdC50YWdzID0gaW5mby50YWdzICYmIGluZm8udGFncy5tYXAoU3ltYm9sVGFnLnRvKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgRG9jdW1lbnRTeW1ib2wge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShpbmZvOiB2c2NvZGUuRG9jdW1lbnRTeW1ib2wpOiBsYW5ndWFnZXMuRG9jdW1lbnRTeW1ib2wge1xuXHRcdGNvbnN0IHJlc3VsdDogbGFuZ3VhZ2VzLkRvY3VtZW50U3ltYm9sID0ge1xuXHRcdFx0bmFtZTogaW5mby5uYW1lIHx8ICchIU1JU1NJTkc6IG5hbWUhIScsXG5cdFx0XHRkZXRhaWw6IGluZm8uZGV0YWlsLFxuXHRcdFx0cmFuZ2U6IFJhbmdlLmZyb20oaW5mby5yYW5nZSksXG5cdFx0XHRzZWxlY3Rpb25SYW5nZTogUmFuZ2UuZnJvbShpbmZvLnNlbGVjdGlvblJhbmdlKSxcblx0XHRcdGtpbmQ6IFN5bWJvbEtpbmQuZnJvbShpbmZvLmtpbmQpLFxuXHRcdFx0dGFnczogaW5mby50YWdzPy5tYXAoU3ltYm9sVGFnLmZyb20pID8/IFtdXG5cdFx0fTtcblx0XHRpZiAoaW5mby5jaGlsZHJlbikge1xuXHRcdFx0cmVzdWx0LmNoaWxkcmVuID0gaW5mby5jaGlsZHJlbi5tYXAoZnJvbSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKGluZm86IGxhbmd1YWdlcy5Eb2N1bWVudFN5bWJvbCk6IHZzY29kZS5Eb2N1bWVudFN5bWJvbCB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IHR5cGVzLkRvY3VtZW50U3ltYm9sKFxuXHRcdFx0aW5mby5uYW1lLFxuXHRcdFx0aW5mby5kZXRhaWwsXG5cdFx0XHRTeW1ib2xLaW5kLnRvKGluZm8ua2luZCksXG5cdFx0XHRSYW5nZS50byhpbmZvLnJhbmdlKSxcblx0XHRcdFJhbmdlLnRvKGluZm8uc2VsZWN0aW9uUmFuZ2UpLFxuXHRcdCk7XG5cdFx0aWYgKGlzTm9uRW1wdHlBcnJheShpbmZvLnRhZ3MpKSB7XG5cdFx0XHRyZXN1bHQudGFncyA9IGluZm8udGFncy5tYXAoU3ltYm9sVGFnLnRvKTtcblx0XHR9XG5cdFx0aWYgKGluZm8uY2hpbGRyZW4pIHtcblx0XHRcdHJlc3VsdC5jaGlsZHJlbiA9IGluZm8uY2hpbGRyZW4ubWFwKHRvKSBhcyBhbnk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDYWxsSGllcmFyY2h5SXRlbSB7XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKGl0ZW06IGV4dEhvc3RQcm90b2NvbC5JQ2FsbEhpZXJhcmNoeUl0ZW1EdG8pOiB0eXBlcy5DYWxsSGllcmFyY2h5SXRlbSB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IHR5cGVzLkNhbGxIaWVyYXJjaHlJdGVtKFxuXHRcdFx0U3ltYm9sS2luZC50byhpdGVtLmtpbmQpLFxuXHRcdFx0aXRlbS5uYW1lLFxuXHRcdFx0aXRlbS5kZXRhaWwgfHwgJycsXG5cdFx0XHRVUkkucmV2aXZlKGl0ZW0udXJpKSxcblx0XHRcdFJhbmdlLnRvKGl0ZW0ucmFuZ2UpLFxuXHRcdFx0UmFuZ2UudG8oaXRlbS5zZWxlY3Rpb25SYW5nZSlcblx0XHQpO1xuXG5cdFx0cmVzdWx0Ll9zZXNzaW9uSWQgPSBpdGVtLl9zZXNzaW9uSWQ7XG5cdFx0cmVzdWx0Ll9pdGVtSWQgPSBpdGVtLl9pdGVtSWQ7XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oaXRlbTogdnNjb2RlLkNhbGxIaWVyYXJjaHlJdGVtLCBzZXNzaW9uSWQ/OiBzdHJpbmcsIGl0ZW1JZD86IHN0cmluZyk6IGV4dEhvc3RQcm90b2NvbC5JQ2FsbEhpZXJhcmNoeUl0ZW1EdG8ge1xuXG5cdFx0c2Vzc2lvbklkID0gc2Vzc2lvbklkID8/ICg8dHlwZXMuQ2FsbEhpZXJhcmNoeUl0ZW0+aXRlbSkuX3Nlc3Npb25JZDtcblx0XHRpdGVtSWQgPSBpdGVtSWQgPz8gKDx0eXBlcy5DYWxsSGllcmFyY2h5SXRlbT5pdGVtKS5faXRlbUlkO1xuXG5cdFx0aWYgKHNlc3Npb25JZCA9PT0gdW5kZWZpbmVkIHx8IGl0ZW1JZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgaXRlbScpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRfc2Vzc2lvbklkOiBzZXNzaW9uSWQsXG5cdFx0XHRfaXRlbUlkOiBpdGVtSWQsXG5cdFx0XHRuYW1lOiBpdGVtLm5hbWUsXG5cdFx0XHRkZXRhaWw6IGl0ZW0uZGV0YWlsLFxuXHRcdFx0a2luZDogU3ltYm9sS2luZC5mcm9tKGl0ZW0ua2luZCksXG5cdFx0XHR1cmk6IGl0ZW0udXJpLFxuXHRcdFx0cmFuZ2U6IFJhbmdlLmZyb20oaXRlbS5yYW5nZSksXG5cdFx0XHRzZWxlY3Rpb25SYW5nZTogUmFuZ2UuZnJvbShpdGVtLnNlbGVjdGlvblJhbmdlKSxcblx0XHRcdHRhZ3M6IGl0ZW0udGFncz8ubWFwKFN5bWJvbFRhZy5mcm9tKVxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDYWxsSGllcmFyY2h5SW5jb21pbmdDYWxsIHtcblxuXHRleHBvcnQgZnVuY3Rpb24gdG8oaXRlbTogZXh0SG9zdFByb3RvY29sLklJbmNvbWluZ0NhbGxEdG8pOiB0eXBlcy5DYWxsSGllcmFyY2h5SW5jb21pbmdDYWxsIHtcblx0XHRyZXR1cm4gbmV3IHR5cGVzLkNhbGxIaWVyYXJjaHlJbmNvbWluZ0NhbGwoXG5cdFx0XHRDYWxsSGllcmFyY2h5SXRlbS50byhpdGVtLmZyb20pLFxuXHRcdFx0aXRlbS5mcm9tUmFuZ2VzLm1hcChyID0+IFJhbmdlLnRvKHIpKVxuXHRcdCk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDYWxsSGllcmFyY2h5T3V0Z29pbmdDYWxsIHtcblxuXHRleHBvcnQgZnVuY3Rpb24gdG8oaXRlbTogZXh0SG9zdFByb3RvY29sLklPdXRnb2luZ0NhbGxEdG8pOiB0eXBlcy5DYWxsSGllcmFyY2h5T3V0Z29pbmdDYWxsIHtcblx0XHRyZXR1cm4gbmV3IHR5cGVzLkNhbGxIaWVyYXJjaHlPdXRnb2luZ0NhbGwoXG5cdFx0XHRDYWxsSGllcmFyY2h5SXRlbS50byhpdGVtLnRvKSxcblx0XHRcdGl0ZW0uZnJvbVJhbmdlcy5tYXAociA9PiBSYW5nZS50byhyKSlcblx0XHQpO1xuXHR9XG59XG5cblxuZXhwb3J0IG5hbWVzcGFjZSBsb2NhdGlvbiB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiB2c2NvZGUuTG9jYXRpb24pOiBsYW5ndWFnZXMuTG9jYXRpb24ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRyYW5nZTogdmFsdWUucmFuZ2UgJiYgUmFuZ2UuZnJvbSh2YWx1ZS5yYW5nZSksXG5cdFx0XHR1cmk6IHZhbHVlLnVyaVxuXHRcdH07XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdG8odmFsdWU6IGV4dEhvc3RQcm90b2NvbC5JTG9jYXRpb25EdG8pOiB0eXBlcy5Mb2NhdGlvbiB7XG5cdFx0cmV0dXJuIG5ldyB0eXBlcy5Mb2NhdGlvbihVUkkucmV2aXZlKHZhbHVlLnVyaSksIFJhbmdlLnRvKHZhbHVlLnJhbmdlKSk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBEZWZpbml0aW9uTGluayB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiB2c2NvZGUuTG9jYXRpb24gfCB2c2NvZGUuRGVmaW5pdGlvbkxpbmspOiBsYW5ndWFnZXMuTG9jYXRpb25MaW5rIHtcblx0XHRjb25zdCBkZWZpbml0aW9uTGluayA9IDx2c2NvZGUuRGVmaW5pdGlvbkxpbms+dmFsdWU7XG5cdFx0Y29uc3QgbG9jYXRpb24gPSA8dnNjb2RlLkxvY2F0aW9uPnZhbHVlO1xuXHRcdHJldHVybiB7XG5cdFx0XHRvcmlnaW5TZWxlY3Rpb25SYW5nZTogZGVmaW5pdGlvbkxpbmsub3JpZ2luU2VsZWN0aW9uUmFuZ2Vcblx0XHRcdFx0PyBSYW5nZS5mcm9tKGRlZmluaXRpb25MaW5rLm9yaWdpblNlbGVjdGlvblJhbmdlKVxuXHRcdFx0XHQ6IHVuZGVmaW5lZCxcblx0XHRcdHVyaTogZGVmaW5pdGlvbkxpbmsudGFyZ2V0VXJpID8gZGVmaW5pdGlvbkxpbmsudGFyZ2V0VXJpIDogbG9jYXRpb24udXJpLFxuXHRcdFx0cmFuZ2U6IFJhbmdlLmZyb20oZGVmaW5pdGlvbkxpbmsudGFyZ2V0UmFuZ2UgPyBkZWZpbml0aW9uTGluay50YXJnZXRSYW5nZSA6IGxvY2F0aW9uLnJhbmdlKSxcblx0XHRcdHRhcmdldFNlbGVjdGlvblJhbmdlOiBkZWZpbml0aW9uTGluay50YXJnZXRTZWxlY3Rpb25SYW5nZVxuXHRcdFx0XHQ/IFJhbmdlLmZyb20oZGVmaW5pdGlvbkxpbmsudGFyZ2V0U2VsZWN0aW9uUmFuZ2UpXG5cdFx0XHRcdDogdW5kZWZpbmVkLFxuXHRcdH07XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHZhbHVlOiBleHRIb3N0UHJvdG9jb2wuSUxvY2F0aW9uTGlua0R0byk6IHZzY29kZS5Mb2NhdGlvbkxpbmsge1xuXHRcdHJldHVybiB7XG5cdFx0XHR0YXJnZXRVcmk6IFVSSS5yZXZpdmUodmFsdWUudXJpKSxcblx0XHRcdHRhcmdldFJhbmdlOiBSYW5nZS50byh2YWx1ZS5yYW5nZSksXG5cdFx0XHR0YXJnZXRTZWxlY3Rpb25SYW5nZTogdmFsdWUudGFyZ2V0U2VsZWN0aW9uUmFuZ2Vcblx0XHRcdFx0PyBSYW5nZS50byh2YWx1ZS50YXJnZXRTZWxlY3Rpb25SYW5nZSlcblx0XHRcdFx0OiB1bmRlZmluZWQsXG5cdFx0XHRvcmlnaW5TZWxlY3Rpb25SYW5nZTogdmFsdWUub3JpZ2luU2VsZWN0aW9uUmFuZ2Vcblx0XHRcdFx0PyBSYW5nZS50byh2YWx1ZS5vcmlnaW5TZWxlY3Rpb25SYW5nZSlcblx0XHRcdFx0OiB1bmRlZmluZWRcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgSG92ZXIge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShob3ZlcjogdnNjb2RlLlZlcmJvc2VIb3Zlcik6IGxhbmd1YWdlcy5Ib3ZlciB7XG5cdFx0Y29uc3QgY29udmVydGVkSG92ZXI6IGxhbmd1YWdlcy5Ib3ZlciA9IHtcblx0XHRcdHJhbmdlOiBSYW5nZS5mcm9tKGhvdmVyLnJhbmdlKSxcblx0XHRcdGNvbnRlbnRzOiBNYXJrZG93blN0cmluZy5mcm9tTWFueShob3Zlci5jb250ZW50cyksXG5cdFx0XHRjYW5JbmNyZWFzZVZlcmJvc2l0eTogaG92ZXIuY2FuSW5jcmVhc2VWZXJib3NpdHksXG5cdFx0XHRjYW5EZWNyZWFzZVZlcmJvc2l0eTogaG92ZXIuY2FuRGVjcmVhc2VWZXJib3NpdHksXG5cdFx0fTtcblx0XHRyZXR1cm4gY29udmVydGVkSG92ZXI7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdG8oaW5mbzogbGFuZ3VhZ2VzLkhvdmVyKTogdHlwZXMuVmVyYm9zZUhvdmVyIHtcblx0XHRjb25zdCBjb250ZW50cyA9IGluZm8uY29udGVudHMubWFwKE1hcmtkb3duU3RyaW5nLnRvKTtcblx0XHRjb25zdCByYW5nZSA9IFJhbmdlLnRvKGluZm8ucmFuZ2UpO1xuXHRcdGNvbnN0IGNhbkluY3JlYXNlVmVyYm9zaXR5ID0gaW5mby5jYW5JbmNyZWFzZVZlcmJvc2l0eTtcblx0XHRjb25zdCBjYW5EZWNyZWFzZVZlcmJvc2l0eSA9IGluZm8uY2FuRGVjcmVhc2VWZXJib3NpdHk7XG5cdFx0cmV0dXJuIG5ldyB0eXBlcy5WZXJib3NlSG92ZXIoY29udGVudHMsIHJhbmdlLCBjYW5JbmNyZWFzZVZlcmJvc2l0eSwgY2FuRGVjcmVhc2VWZXJib3NpdHkpO1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgRXZhbHVhdGFibGVFeHByZXNzaW9uIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oZXhwcmVzc2lvbjogdnNjb2RlLkV2YWx1YXRhYmxlRXhwcmVzc2lvbik6IGxhbmd1YWdlcy5FdmFsdWF0YWJsZUV4cHJlc3Npb24ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRyYW5nZTogUmFuZ2UuZnJvbShleHByZXNzaW9uLnJhbmdlKSxcblx0XHRcdGV4cHJlc3Npb246IGV4cHJlc3Npb24uZXhwcmVzc2lvblxuXHRcdH07XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdG8oaW5mbzogbGFuZ3VhZ2VzLkV2YWx1YXRhYmxlRXhwcmVzc2lvbik6IHR5cGVzLkV2YWx1YXRhYmxlRXhwcmVzc2lvbiB7XG5cdFx0cmV0dXJuIG5ldyB0eXBlcy5FdmFsdWF0YWJsZUV4cHJlc3Npb24oUmFuZ2UudG8oaW5mby5yYW5nZSksIGluZm8uZXhwcmVzc2lvbik7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBJbmxpbmVWYWx1ZSB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGlubGluZVZhbHVlOiB2c2NvZGUuSW5saW5lVmFsdWUpOiBsYW5ndWFnZXMuSW5saW5lVmFsdWUge1xuXHRcdGlmIChpbmxpbmVWYWx1ZSBpbnN0YW5jZW9mIHR5cGVzLklubGluZVZhbHVlVGV4dCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dHlwZTogJ3RleHQnLFxuXHRcdFx0XHRyYW5nZTogUmFuZ2UuZnJvbShpbmxpbmVWYWx1ZS5yYW5nZSksXG5cdFx0XHRcdHRleHQ6IGlubGluZVZhbHVlLnRleHRcblx0XHRcdH0gc2F0aXNmaWVzIGxhbmd1YWdlcy5JbmxpbmVWYWx1ZVRleHQ7XG5cdFx0fSBlbHNlIGlmIChpbmxpbmVWYWx1ZSBpbnN0YW5jZW9mIHR5cGVzLklubGluZVZhbHVlVmFyaWFibGVMb29rdXApIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHR5cGU6ICd2YXJpYWJsZScsXG5cdFx0XHRcdHJhbmdlOiBSYW5nZS5mcm9tKGlubGluZVZhbHVlLnJhbmdlKSxcblx0XHRcdFx0dmFyaWFibGVOYW1lOiBpbmxpbmVWYWx1ZS52YXJpYWJsZU5hbWUsXG5cdFx0XHRcdGNhc2VTZW5zaXRpdmVMb29rdXA6IGlubGluZVZhbHVlLmNhc2VTZW5zaXRpdmVMb29rdXBcblx0XHRcdH0gc2F0aXNmaWVzIGxhbmd1YWdlcy5JbmxpbmVWYWx1ZVZhcmlhYmxlTG9va3VwO1xuXHRcdH0gZWxzZSBpZiAoaW5saW5lVmFsdWUgaW5zdGFuY2VvZiB0eXBlcy5JbmxpbmVWYWx1ZUV2YWx1YXRhYmxlRXhwcmVzc2lvbikge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dHlwZTogJ2V4cHJlc3Npb24nLFxuXHRcdFx0XHRyYW5nZTogUmFuZ2UuZnJvbShpbmxpbmVWYWx1ZS5yYW5nZSksXG5cdFx0XHRcdGV4cHJlc3Npb246IGlubGluZVZhbHVlLmV4cHJlc3Npb25cblx0XHRcdH0gc2F0aXNmaWVzIGxhbmd1YWdlcy5JbmxpbmVWYWx1ZUV4cHJlc3Npb247XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVW5rbm93biAnSW5saW5lVmFsdWUnIHR5cGVgKTtcblx0XHR9XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdG8oaW5saW5lVmFsdWU6IGxhbmd1YWdlcy5JbmxpbmVWYWx1ZSk6IHZzY29kZS5JbmxpbmVWYWx1ZSB7XG5cdFx0c3dpdGNoIChpbmxpbmVWYWx1ZS50eXBlKSB7XG5cdFx0XHRjYXNlICd0ZXh0Jzpcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRyYW5nZTogUmFuZ2UudG8oaW5saW5lVmFsdWUucmFuZ2UpLFxuXHRcdFx0XHRcdHRleHQ6IGlubGluZVZhbHVlLnRleHRcblx0XHRcdFx0fSBzYXRpc2ZpZXMgdnNjb2RlLklubGluZVZhbHVlVGV4dDtcblx0XHRcdGNhc2UgJ3ZhcmlhYmxlJzpcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRyYW5nZTogUmFuZ2UudG8oaW5saW5lVmFsdWUucmFuZ2UpLFxuXHRcdFx0XHRcdHZhcmlhYmxlTmFtZTogaW5saW5lVmFsdWUudmFyaWFibGVOYW1lLFxuXHRcdFx0XHRcdGNhc2VTZW5zaXRpdmVMb29rdXA6IGlubGluZVZhbHVlLmNhc2VTZW5zaXRpdmVMb29rdXBcblx0XHRcdFx0fSBzYXRpc2ZpZXMgdnNjb2RlLklubGluZVZhbHVlVmFyaWFibGVMb29rdXA7XG5cdFx0XHRjYXNlICdleHByZXNzaW9uJzpcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRyYW5nZTogUmFuZ2UudG8oaW5saW5lVmFsdWUucmFuZ2UpLFxuXHRcdFx0XHRcdGV4cHJlc3Npb246IGlubGluZVZhbHVlLmV4cHJlc3Npb25cblx0XHRcdFx0fSBzYXRpc2ZpZXMgdnNjb2RlLklubGluZVZhbHVlRXZhbHVhdGFibGVFeHByZXNzaW9uO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIElubGluZVZhbHVlQ29udGV4dCB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGlubGluZVZhbHVlQ29udGV4dDogdnNjb2RlLklubGluZVZhbHVlQ29udGV4dCk6IGV4dEhvc3RQcm90b2NvbC5JSW5saW5lVmFsdWVDb250ZXh0RHRvIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZnJhbWVJZDogaW5saW5lVmFsdWVDb250ZXh0LmZyYW1lSWQsXG5cdFx0XHRzdG9wcGVkTG9jYXRpb246IFJhbmdlLmZyb20oaW5saW5lVmFsdWVDb250ZXh0LnN0b3BwZWRMb2NhdGlvbilcblx0XHR9O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKGlubGluZVZhbHVlQ29udGV4dDogZXh0SG9zdFByb3RvY29sLklJbmxpbmVWYWx1ZUNvbnRleHREdG8pOiB0eXBlcy5JbmxpbmVWYWx1ZUNvbnRleHQge1xuXHRcdHJldHVybiBuZXcgdHlwZXMuSW5saW5lVmFsdWVDb250ZXh0KGlubGluZVZhbHVlQ29udGV4dC5mcmFtZUlkLCBSYW5nZS50byhpbmxpbmVWYWx1ZUNvbnRleHQuc3RvcHBlZExvY2F0aW9uKSk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBEb2N1bWVudEhpZ2hsaWdodCB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGRvY3VtZW50SGlnaGxpZ2h0OiB2c2NvZGUuRG9jdW1lbnRIaWdobGlnaHQpOiBsYW5ndWFnZXMuRG9jdW1lbnRIaWdobGlnaHQge1xuXHRcdHJldHVybiB7XG5cdFx0XHRyYW5nZTogUmFuZ2UuZnJvbShkb2N1bWVudEhpZ2hsaWdodC5yYW5nZSksXG5cdFx0XHRraW5kOiBkb2N1bWVudEhpZ2hsaWdodC5raW5kXG5cdFx0fTtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gdG8ob2NjdXJyZW5jZTogbGFuZ3VhZ2VzLkRvY3VtZW50SGlnaGxpZ2h0KTogdHlwZXMuRG9jdW1lbnRIaWdobGlnaHQge1xuXHRcdHJldHVybiBuZXcgdHlwZXMuRG9jdW1lbnRIaWdobGlnaHQoUmFuZ2UudG8ob2NjdXJyZW5jZS5yYW5nZSksIG9jY3VycmVuY2Uua2luZCk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBNdWx0aURvY3VtZW50SGlnaGxpZ2h0IHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20obXVsdGlEb2N1bWVudEhpZ2hsaWdodDogdnNjb2RlLk11bHRpRG9jdW1lbnRIaWdobGlnaHQpOiBsYW5ndWFnZXMuTXVsdGlEb2N1bWVudEhpZ2hsaWdodCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHVyaTogbXVsdGlEb2N1bWVudEhpZ2hsaWdodC51cmksXG5cdFx0XHRoaWdobGlnaHRzOiBtdWx0aURvY3VtZW50SGlnaGxpZ2h0LmhpZ2hsaWdodHMubWFwKERvY3VtZW50SGlnaGxpZ2h0LmZyb20pXG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byhtdWx0aURvY3VtZW50SGlnaGxpZ2h0OiBsYW5ndWFnZXMuTXVsdGlEb2N1bWVudEhpZ2hsaWdodCk6IHR5cGVzLk11bHRpRG9jdW1lbnRIaWdobGlnaHQge1xuXHRcdHJldHVybiBuZXcgdHlwZXMuTXVsdGlEb2N1bWVudEhpZ2hsaWdodChVUkkucmV2aXZlKG11bHRpRG9jdW1lbnRIaWdobGlnaHQudXJpKSwgbXVsdGlEb2N1bWVudEhpZ2hsaWdodC5oaWdobGlnaHRzLm1hcChEb2N1bWVudEhpZ2hsaWdodC50bykpO1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgQ29tcGxldGlvblRyaWdnZXJLaW5kIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKGtpbmQ6IGxhbmd1YWdlcy5Db21wbGV0aW9uVHJpZ2dlcktpbmQpIHtcblx0XHRzd2l0Y2ggKGtpbmQpIHtcblx0XHRcdGNhc2UgbGFuZ3VhZ2VzLkNvbXBsZXRpb25UcmlnZ2VyS2luZC5UcmlnZ2VyQ2hhcmFjdGVyOlxuXHRcdFx0XHRyZXR1cm4gdHlwZXMuQ29tcGxldGlvblRyaWdnZXJLaW5kLlRyaWdnZXJDaGFyYWN0ZXI7XG5cdFx0XHRjYXNlIGxhbmd1YWdlcy5Db21wbGV0aW9uVHJpZ2dlcktpbmQuVHJpZ2dlckZvckluY29tcGxldGVDb21wbGV0aW9uczpcblx0XHRcdFx0cmV0dXJuIHR5cGVzLkNvbXBsZXRpb25UcmlnZ2VyS2luZC5UcmlnZ2VyRm9ySW5jb21wbGV0ZUNvbXBsZXRpb25zO1xuXHRcdFx0Y2FzZSBsYW5ndWFnZXMuQ29tcGxldGlvblRyaWdnZXJLaW5kLkludm9rZTpcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiB0eXBlcy5Db21wbGV0aW9uVHJpZ2dlcktpbmQuSW52b2tlO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIENvbXBsZXRpb25Db250ZXh0IHtcblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKGNvbnRleHQ6IGxhbmd1YWdlcy5Db21wbGV0aW9uQ29udGV4dCk6IHR5cGVzLkNvbXBsZXRpb25Db250ZXh0IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dHJpZ2dlcktpbmQ6IENvbXBsZXRpb25UcmlnZ2VyS2luZC50byhjb250ZXh0LnRyaWdnZXJLaW5kKSxcblx0XHRcdHRyaWdnZXJDaGFyYWN0ZXI6IGNvbnRleHQudHJpZ2dlckNoYXJhY3RlclxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDb21wbGV0aW9uSXRlbVRhZyB7XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oa2luZDogdHlwZXMuQ29tcGxldGlvbkl0ZW1UYWcpOiBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1UYWcge1xuXHRcdHN3aXRjaCAoa2luZCkge1xuXHRcdFx0Y2FzZSB0eXBlcy5Db21wbGV0aW9uSXRlbVRhZy5EZXByZWNhdGVkOiByZXR1cm4gbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtVGFnLkRlcHJlY2F0ZWQ7XG5cdFx0fVxuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKGtpbmQ6IGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbVRhZyk6IHR5cGVzLkNvbXBsZXRpb25JdGVtVGFnIHtcblx0XHRzd2l0Y2ggKGtpbmQpIHtcblx0XHRcdGNhc2UgbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtVGFnLkRlcHJlY2F0ZWQ6IHJldHVybiB0eXBlcy5Db21wbGV0aW9uSXRlbVRhZy5EZXByZWNhdGVkO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIENvbXBsZXRpb25JdGVtS2luZCB7XG5cblx0Y29uc3QgX2Zyb20gPSBuZXcgTWFwPHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZCwgbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZD4oW1xuXHRcdFt0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuTWV0aG9kLCBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLk1ldGhvZF0sXG5cdFx0W3R5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5GdW5jdGlvbiwgbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5GdW5jdGlvbl0sXG5cdFx0W3R5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5Db25zdHJ1Y3RvciwgbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5Db25zdHJ1Y3Rvcl0sXG5cdFx0W3R5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5GaWVsZCwgbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5GaWVsZF0sXG5cdFx0W3R5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5WYXJpYWJsZSwgbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5WYXJpYWJsZV0sXG5cdFx0W3R5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5DbGFzcywgbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5DbGFzc10sXG5cdFx0W3R5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5JbnRlcmZhY2UsIGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuSW50ZXJmYWNlXSxcblx0XHRbdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlN0cnVjdCwgbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5TdHJ1Y3RdLFxuXHRcdFt0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuTW9kdWxlLCBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLk1vZHVsZV0sXG5cdFx0W3R5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5Qcm9wZXJ0eSwgbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5Qcm9wZXJ0eV0sXG5cdFx0W3R5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5Vbml0LCBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlVuaXRdLFxuXHRcdFt0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuVmFsdWUsIGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuVmFsdWVdLFxuXHRcdFt0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuQ29uc3RhbnQsIGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuQ29uc3RhbnRdLFxuXHRcdFt0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuRW51bSwgbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5FbnVtXSxcblx0XHRbdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLkVudW1NZW1iZXIsIGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuRW51bU1lbWJlcl0sXG5cdFx0W3R5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5LZXl3b3JkLCBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLktleXdvcmRdLFxuXHRcdFt0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuU25pcHBldCwgbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5TbmlwcGV0XSxcblx0XHRbdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlRleHQsIGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuVGV4dF0sXG5cdFx0W3R5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5Db2xvciwgbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5Db2xvcl0sXG5cdFx0W3R5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5GaWxlLCBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLkZpbGVdLFxuXHRcdFt0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuUmVmZXJlbmNlLCBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlJlZmVyZW5jZV0sXG5cdFx0W3R5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5Gb2xkZXIsIGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuRm9sZGVyXSxcblx0XHRbdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLkV2ZW50LCBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLkV2ZW50XSxcblx0XHRbdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLk9wZXJhdG9yLCBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLk9wZXJhdG9yXSxcblx0XHRbdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlR5cGVQYXJhbWV0ZXIsIGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuVHlwZVBhcmFtZXRlcl0sXG5cdFx0W3R5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5Jc3N1ZSwgbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5Jc3N1ZV0sXG5cdFx0W3R5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5Vc2VyLCBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlVzZXJdLFxuXHRdKTtcblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShraW5kOiB0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQpOiBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kIHtcblx0XHRyZXR1cm4gX2Zyb20uZ2V0KGtpbmQpID8/IGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuUHJvcGVydHk7XG5cdH1cblxuXHRjb25zdCBfdG8gPSBuZXcgTWFwPGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQsIHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZD4oW1xuXHRcdFtsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLk1ldGhvZCwgdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLk1ldGhvZF0sXG5cdFx0W2xhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuRnVuY3Rpb24sIHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5GdW5jdGlvbl0sXG5cdFx0W2xhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuQ29uc3RydWN0b3IsIHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5Db25zdHJ1Y3Rvcl0sXG5cdFx0W2xhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuRmllbGQsIHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5GaWVsZF0sXG5cdFx0W2xhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuVmFyaWFibGUsIHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5WYXJpYWJsZV0sXG5cdFx0W2xhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuQ2xhc3MsIHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5DbGFzc10sXG5cdFx0W2xhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuSW50ZXJmYWNlLCB0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuSW50ZXJmYWNlXSxcblx0XHRbbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5TdHJ1Y3QsIHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5TdHJ1Y3RdLFxuXHRcdFtsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLk1vZHVsZSwgdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLk1vZHVsZV0sXG5cdFx0W2xhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuUHJvcGVydHksIHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5Qcm9wZXJ0eV0sXG5cdFx0W2xhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuVW5pdCwgdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlVuaXRdLFxuXHRcdFtsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlZhbHVlLCB0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuVmFsdWVdLFxuXHRcdFtsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLkNvbnN0YW50LCB0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuQ29uc3RhbnRdLFxuXHRcdFtsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLkVudW0sIHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5FbnVtXSxcblx0XHRbbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5FbnVtTWVtYmVyLCB0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuRW51bU1lbWJlcl0sXG5cdFx0W2xhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuS2V5d29yZCwgdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLktleXdvcmRdLFxuXHRcdFtsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlNuaXBwZXQsIHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5TbmlwcGV0XSxcblx0XHRbbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5UZXh0LCB0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuVGV4dF0sXG5cdFx0W2xhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuQ29sb3IsIHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5Db2xvcl0sXG5cdFx0W2xhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuRmlsZSwgdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLkZpbGVdLFxuXHRcdFtsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlJlZmVyZW5jZSwgdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlJlZmVyZW5jZV0sXG5cdFx0W2xhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuRm9sZGVyLCB0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuRm9sZGVyXSxcblx0XHRbbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5FdmVudCwgdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLkV2ZW50XSxcblx0XHRbbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5PcGVyYXRvciwgdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLk9wZXJhdG9yXSxcblx0XHRbbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5UeXBlUGFyYW1ldGVyLCB0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuVHlwZVBhcmFtZXRlcl0sXG5cdFx0W2xhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuVXNlciwgdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlVzZXJdLFxuXHRcdFtsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLklzc3VlLCB0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuSXNzdWVdLFxuXHRdKTtcblxuXHRleHBvcnQgZnVuY3Rpb24gdG8oa2luZDogbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZCk6IHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZCB7XG5cdFx0cmV0dXJuIF90by5nZXQoa2luZCkgPz8gdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlByb3BlcnR5O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgQ29tcGxldGlvbkl0ZW0ge1xuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byhzdWdnZXN0aW9uOiBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW0sIGNvbnZlcnRlcj86IENvbW1hbmQuSUNvbW1hbmRzQ29udmVydGVyKTogdHlwZXMuQ29tcGxldGlvbkl0ZW0ge1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IHR5cGVzLkNvbXBsZXRpb25JdGVtKHN1Z2dlc3Rpb24ubGFiZWwpO1xuXHRcdHJlc3VsdC5pbnNlcnRUZXh0ID0gc3VnZ2VzdGlvbi5pbnNlcnRUZXh0O1xuXHRcdHJlc3VsdC5raW5kID0gQ29tcGxldGlvbkl0ZW1LaW5kLnRvKHN1Z2dlc3Rpb24ua2luZCk7XG5cdFx0cmVzdWx0LnRhZ3MgPSBzdWdnZXN0aW9uLnRhZ3M/Lm1hcChDb21wbGV0aW9uSXRlbVRhZy50byk7XG5cdFx0cmVzdWx0LmRldGFpbCA9IHN1Z2dlc3Rpb24uZGV0YWlsO1xuXHRcdHJlc3VsdC5kb2N1bWVudGF0aW9uID0gaHRtbENvbnRlbnQuaXNNYXJrZG93blN0cmluZyhzdWdnZXN0aW9uLmRvY3VtZW50YXRpb24pID8gTWFya2Rvd25TdHJpbmcudG8oc3VnZ2VzdGlvbi5kb2N1bWVudGF0aW9uKSA6IHN1Z2dlc3Rpb24uZG9jdW1lbnRhdGlvbjtcblx0XHRyZXN1bHQuc29ydFRleHQgPSBzdWdnZXN0aW9uLnNvcnRUZXh0O1xuXHRcdHJlc3VsdC5maWx0ZXJUZXh0ID0gc3VnZ2VzdGlvbi5maWx0ZXJUZXh0O1xuXHRcdHJlc3VsdC5wcmVzZWxlY3QgPSBzdWdnZXN0aW9uLnByZXNlbGVjdDtcblx0XHRyZXN1bHQuY29tbWl0Q2hhcmFjdGVycyA9IHN1Z2dlc3Rpb24uY29tbWl0Q2hhcmFjdGVycztcblxuXHRcdC8vIHJhbmdlXG5cdFx0aWYgKGVkaXRvclJhbmdlLlJhbmdlLmlzSVJhbmdlKHN1Z2dlc3Rpb24ucmFuZ2UpKSB7XG5cdFx0XHRyZXN1bHQucmFuZ2UgPSBSYW5nZS50byhzdWdnZXN0aW9uLnJhbmdlKTtcblx0XHR9IGVsc2UgaWYgKHR5cGVvZiBzdWdnZXN0aW9uLnJhbmdlID09PSAnb2JqZWN0Jykge1xuXHRcdFx0cmVzdWx0LnJhbmdlID0geyBpbnNlcnRpbmc6IFJhbmdlLnRvKHN1Z2dlc3Rpb24ucmFuZ2UuaW5zZXJ0KSwgcmVwbGFjaW5nOiBSYW5nZS50byhzdWdnZXN0aW9uLnJhbmdlLnJlcGxhY2UpIH07XG5cdFx0fVxuXG5cdFx0cmVzdWx0LmtlZXBXaGl0ZXNwYWNlID0gdHlwZW9mIHN1Z2dlc3Rpb24uaW5zZXJ0VGV4dFJ1bGVzID09PSAndW5kZWZpbmVkJyA/IGZhbHNlIDogQm9vbGVhbihzdWdnZXN0aW9uLmluc2VydFRleHRSdWxlcyAmIGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUluc2VydFRleHRSdWxlLktlZXBXaGl0ZXNwYWNlKTtcblx0XHQvLyAnaW5zZXJ0VGV4dCctbG9naWNcblx0XHRpZiAodHlwZW9mIHN1Z2dlc3Rpb24uaW5zZXJ0VGV4dFJ1bGVzICE9PSAndW5kZWZpbmVkJyAmJiBzdWdnZXN0aW9uLmluc2VydFRleHRSdWxlcyAmIGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUluc2VydFRleHRSdWxlLkluc2VydEFzU25pcHBldCkge1xuXHRcdFx0cmVzdWx0Lmluc2VydFRleHQgPSBuZXcgdHlwZXMuU25pcHBldFN0cmluZyhzdWdnZXN0aW9uLmluc2VydFRleHQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHQuaW5zZXJ0VGV4dCA9IHN1Z2dlc3Rpb24uaW5zZXJ0VGV4dDtcblx0XHRcdHJlc3VsdC50ZXh0RWRpdCA9IHJlc3VsdC5yYW5nZSBpbnN0YW5jZW9mIHR5cGVzLlJhbmdlID8gbmV3IHR5cGVzLlRleHRFZGl0KHJlc3VsdC5yYW5nZSwgcmVzdWx0Lmluc2VydFRleHQpIDogdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAoc3VnZ2VzdGlvbi5hZGRpdGlvbmFsVGV4dEVkaXRzICYmIHN1Z2dlc3Rpb24uYWRkaXRpb25hbFRleHRFZGl0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXN1bHQuYWRkaXRpb25hbFRleHRFZGl0cyA9IHN1Z2dlc3Rpb24uYWRkaXRpb25hbFRleHRFZGl0cy5tYXAoZSA9PiBUZXh0RWRpdC50byhlIGFzIGxhbmd1YWdlcy5UZXh0RWRpdCkpO1xuXHRcdH1cblx0XHRyZXN1bHQuY29tbWFuZCA9IGNvbnZlcnRlciAmJiBzdWdnZXN0aW9uLmNvbW1hbmQgPyBjb252ZXJ0ZXIuZnJvbUludGVybmFsKHN1Z2dlc3Rpb24uY29tbWFuZCkgOiB1bmRlZmluZWQ7XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgUGFyYW1ldGVySW5mb3JtYXRpb24ge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShpbmZvOiB0eXBlcy5QYXJhbWV0ZXJJbmZvcm1hdGlvbik6IGxhbmd1YWdlcy5QYXJhbWV0ZXJJbmZvcm1hdGlvbiB7XG5cdFx0aWYgKHR5cGVvZiBpbmZvLmxhYmVsICE9PSAnc3RyaW5nJyAmJiAhQXJyYXkuaXNBcnJheShpbmZvLmxhYmVsKSkge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBsYWJlbCcpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRsYWJlbDogaW5mby5sYWJlbCxcblx0XHRcdGRvY3VtZW50YXRpb246IE1hcmtkb3duU3RyaW5nLmZyb21TdHJpY3QoaW5mby5kb2N1bWVudGF0aW9uKVxuXHRcdH07XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKGluZm86IGxhbmd1YWdlcy5QYXJhbWV0ZXJJbmZvcm1hdGlvbik6IHR5cGVzLlBhcmFtZXRlckluZm9ybWF0aW9uIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bGFiZWw6IGluZm8ubGFiZWwsXG5cdFx0XHRkb2N1bWVudGF0aW9uOiBodG1sQ29udGVudC5pc01hcmtkb3duU3RyaW5nKGluZm8uZG9jdW1lbnRhdGlvbikgPyBNYXJrZG93blN0cmluZy50byhpbmZvLmRvY3VtZW50YXRpb24pIDogaW5mby5kb2N1bWVudGF0aW9uXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIFNpZ25hdHVyZUluZm9ybWF0aW9uIHtcblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShpbmZvOiB0eXBlcy5TaWduYXR1cmVJbmZvcm1hdGlvbik6IGxhbmd1YWdlcy5TaWduYXR1cmVJbmZvcm1hdGlvbiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGxhYmVsOiBpbmZvLmxhYmVsLFxuXHRcdFx0ZG9jdW1lbnRhdGlvbjogTWFya2Rvd25TdHJpbmcuZnJvbVN0cmljdChpbmZvLmRvY3VtZW50YXRpb24pLFxuXHRcdFx0cGFyYW1ldGVyczogQXJyYXkuaXNBcnJheShpbmZvLnBhcmFtZXRlcnMpID8gaW5mby5wYXJhbWV0ZXJzLm1hcChQYXJhbWV0ZXJJbmZvcm1hdGlvbi5mcm9tKSA6IFtdLFxuXHRcdFx0YWN0aXZlUGFyYW1ldGVyOiBpbmZvLmFjdGl2ZVBhcmFtZXRlcixcblx0XHR9O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKGluZm86IGxhbmd1YWdlcy5TaWduYXR1cmVJbmZvcm1hdGlvbik6IHR5cGVzLlNpZ25hdHVyZUluZm9ybWF0aW9uIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bGFiZWw6IGluZm8ubGFiZWwsXG5cdFx0XHRkb2N1bWVudGF0aW9uOiBodG1sQ29udGVudC5pc01hcmtkb3duU3RyaW5nKGluZm8uZG9jdW1lbnRhdGlvbikgPyBNYXJrZG93blN0cmluZy50byhpbmZvLmRvY3VtZW50YXRpb24pIDogaW5mby5kb2N1bWVudGF0aW9uLFxuXHRcdFx0cGFyYW1ldGVyczogQXJyYXkuaXNBcnJheShpbmZvLnBhcmFtZXRlcnMpID8gaW5mby5wYXJhbWV0ZXJzLm1hcChQYXJhbWV0ZXJJbmZvcm1hdGlvbi50bykgOiBbXSxcblx0XHRcdGFjdGl2ZVBhcmFtZXRlcjogaW5mby5hY3RpdmVQYXJhbWV0ZXIsXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIFNpZ25hdHVyZUhlbHAge1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGhlbHA6IHR5cGVzLlNpZ25hdHVyZUhlbHApOiBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGFjdGl2ZVNpZ25hdHVyZTogaGVscC5hY3RpdmVTaWduYXR1cmUsXG5cdFx0XHRhY3RpdmVQYXJhbWV0ZXI6IGhlbHAuYWN0aXZlUGFyYW1ldGVyLFxuXHRcdFx0c2lnbmF0dXJlczogQXJyYXkuaXNBcnJheShoZWxwLnNpZ25hdHVyZXMpID8gaGVscC5zaWduYXR1cmVzLm1hcChTaWduYXR1cmVJbmZvcm1hdGlvbi5mcm9tKSA6IFtdLFxuXHRcdH07XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdG8oaGVscDogbGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHApOiB0eXBlcy5TaWduYXR1cmVIZWxwIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0YWN0aXZlU2lnbmF0dXJlOiBoZWxwLmFjdGl2ZVNpZ25hdHVyZSxcblx0XHRcdGFjdGl2ZVBhcmFtZXRlcjogaGVscC5hY3RpdmVQYXJhbWV0ZXIsXG5cdFx0XHRzaWduYXR1cmVzOiBBcnJheS5pc0FycmF5KGhlbHAuc2lnbmF0dXJlcykgPyBoZWxwLnNpZ25hdHVyZXMubWFwKFNpZ25hdHVyZUluZm9ybWF0aW9uLnRvKSA6IFtdLFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBJbmxheUhpbnQge1xuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byhjb252ZXJ0ZXI6IENvbW1hbmQuSUNvbW1hbmRzQ29udmVydGVyLCBoaW50OiBsYW5ndWFnZXMuSW5sYXlIaW50KTogdnNjb2RlLklubGF5SGludCB7XG5cdFx0Y29uc3QgcmVzID0gbmV3IHR5cGVzLklubGF5SGludChcblx0XHRcdFBvc2l0aW9uLnRvKGhpbnQucG9zaXRpb24pLFxuXHRcdFx0dHlwZW9mIGhpbnQubGFiZWwgPT09ICdzdHJpbmcnID8gaGludC5sYWJlbCA6IGhpbnQubGFiZWwubWFwKElubGF5SGludExhYmVsUGFydC50by5iaW5kKHVuZGVmaW5lZCwgY29udmVydGVyKSksXG5cdFx0XHRoaW50LmtpbmQgJiYgSW5sYXlIaW50S2luZC50byhoaW50LmtpbmQpXG5cdFx0KTtcblx0XHRyZXMudGV4dEVkaXRzID0gaGludC50ZXh0RWRpdHMgJiYgaGludC50ZXh0RWRpdHMubWFwKFRleHRFZGl0LnRvKTtcblx0XHRyZXMudG9vbHRpcCA9IGh0bWxDb250ZW50LmlzTWFya2Rvd25TdHJpbmcoaGludC50b29sdGlwKSA/IE1hcmtkb3duU3RyaW5nLnRvKGhpbnQudG9vbHRpcCkgOiBoaW50LnRvb2x0aXA7XG5cdFx0cmVzLnBhZGRpbmdMZWZ0ID0gaGludC5wYWRkaW5nTGVmdDtcblx0XHRyZXMucGFkZGluZ1JpZ2h0ID0gaGludC5wYWRkaW5nUmlnaHQ7XG5cdFx0cmV0dXJuIHJlcztcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIElubGF5SGludExhYmVsUGFydCB7XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKGNvbnZlcnRlcjogQ29tbWFuZC5JQ29tbWFuZHNDb252ZXJ0ZXIsIHBhcnQ6IGxhbmd1YWdlcy5JbmxheUhpbnRMYWJlbFBhcnQpOiB0eXBlcy5JbmxheUhpbnRMYWJlbFBhcnQge1xuXHRcdGNvbnN0IHJlc3VsdCA9IG5ldyB0eXBlcy5JbmxheUhpbnRMYWJlbFBhcnQocGFydC5sYWJlbCk7XG5cdFx0cmVzdWx0LnRvb2x0aXAgPSBodG1sQ29udGVudC5pc01hcmtkb3duU3RyaW5nKHBhcnQudG9vbHRpcClcblx0XHRcdD8gTWFya2Rvd25TdHJpbmcudG8ocGFydC50b29sdGlwKVxuXHRcdFx0OiBwYXJ0LnRvb2x0aXA7XG5cdFx0aWYgKGxhbmd1YWdlcy5Db21tYW5kLmlzKHBhcnQuY29tbWFuZCkpIHtcblx0XHRcdHJlc3VsdC5jb21tYW5kID0gY29udmVydGVyLmZyb21JbnRlcm5hbChwYXJ0LmNvbW1hbmQpO1xuXHRcdH1cblx0XHRpZiAocGFydC5sb2NhdGlvbikge1xuXHRcdFx0cmVzdWx0LmxvY2F0aW9uID0gbG9jYXRpb24udG8ocGFydC5sb2NhdGlvbik7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBJbmxheUhpbnRLaW5kIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oa2luZDogdnNjb2RlLklubGF5SGludEtpbmQpOiBsYW5ndWFnZXMuSW5sYXlIaW50S2luZCB7XG5cdFx0cmV0dXJuIGtpbmQ7XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKGtpbmQ6IGxhbmd1YWdlcy5JbmxheUhpbnRLaW5kKTogdnNjb2RlLklubGF5SGludEtpbmQge1xuXHRcdHJldHVybiBraW5kO1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgRG9jdW1lbnRMaW5rIHtcblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShsaW5rOiB2c2NvZGUuRG9jdW1lbnRMaW5rKTogbGFuZ3VhZ2VzLklMaW5rIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmFuZ2U6IFJhbmdlLmZyb20obGluay5yYW5nZSksXG5cdFx0XHR1cmw6IGxpbmsudGFyZ2V0LFxuXHRcdFx0dG9vbHRpcDogbGluay50b29sdGlwXG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byhsaW5rOiBsYW5ndWFnZXMuSUxpbmspOiB2c2NvZGUuRG9jdW1lbnRMaW5rIHtcblx0XHRsZXQgdGFyZ2V0OiBVUkkgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGxpbmsudXJsKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0YXJnZXQgPSB0eXBlb2YgbGluay51cmwgPT09ICdzdHJpbmcnID8gVVJJLnBhcnNlKGxpbmsudXJsLCB0cnVlKSA6IFVSSS5yZXZpdmUobGluay51cmwpO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdC8vIGlnbm9yZVxuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCByZXN1bHQgPSBuZXcgdHlwZXMuRG9jdW1lbnRMaW5rKFJhbmdlLnRvKGxpbmsucmFuZ2UpLCB0YXJnZXQpO1xuXHRcdHJlc3VsdC50b29sdGlwID0gbGluay50b29sdGlwO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDb2xvclByZXNlbnRhdGlvbiB7XG5cdGV4cG9ydCBmdW5jdGlvbiB0byhjb2xvclByZXNlbnRhdGlvbjogbGFuZ3VhZ2VzLklDb2xvclByZXNlbnRhdGlvbik6IHR5cGVzLkNvbG9yUHJlc2VudGF0aW9uIHtcblx0XHRjb25zdCBjcCA9IG5ldyB0eXBlcy5Db2xvclByZXNlbnRhdGlvbihjb2xvclByZXNlbnRhdGlvbi5sYWJlbCk7XG5cdFx0aWYgKGNvbG9yUHJlc2VudGF0aW9uLnRleHRFZGl0KSB7XG5cdFx0XHRjcC50ZXh0RWRpdCA9IFRleHRFZGl0LnRvKGNvbG9yUHJlc2VudGF0aW9uLnRleHRFZGl0KTtcblx0XHR9XG5cdFx0aWYgKGNvbG9yUHJlc2VudGF0aW9uLmFkZGl0aW9uYWxUZXh0RWRpdHMpIHtcblx0XHRcdGNwLmFkZGl0aW9uYWxUZXh0RWRpdHMgPSBjb2xvclByZXNlbnRhdGlvbi5hZGRpdGlvbmFsVGV4dEVkaXRzLm1hcCh2YWx1ZSA9PiBUZXh0RWRpdC50byh2YWx1ZSkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY3A7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShjb2xvclByZXNlbnRhdGlvbjogdnNjb2RlLkNvbG9yUHJlc2VudGF0aW9uKTogbGFuZ3VhZ2VzLklDb2xvclByZXNlbnRhdGlvbiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGxhYmVsOiBjb2xvclByZXNlbnRhdGlvbi5sYWJlbCxcblx0XHRcdHRleHRFZGl0OiBjb2xvclByZXNlbnRhdGlvbi50ZXh0RWRpdCA/IFRleHRFZGl0LmZyb20oY29sb3JQcmVzZW50YXRpb24udGV4dEVkaXQpIDogdW5kZWZpbmVkLFxuXHRcdFx0YWRkaXRpb25hbFRleHRFZGl0czogY29sb3JQcmVzZW50YXRpb24uYWRkaXRpb25hbFRleHRFZGl0cyA/IGNvbG9yUHJlc2VudGF0aW9uLmFkZGl0aW9uYWxUZXh0RWRpdHMubWFwKHZhbHVlID0+IFRleHRFZGl0LmZyb20odmFsdWUpKSA6IHVuZGVmaW5lZFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDb2xvciB7XG5cdGV4cG9ydCBmdW5jdGlvbiB0byhjOiBbbnVtYmVyLCBudW1iZXIsIG51bWJlciwgbnVtYmVyXSk6IHR5cGVzLkNvbG9yIHtcblx0XHRyZXR1cm4gbmV3IHR5cGVzLkNvbG9yKGNbMF0sIGNbMV0sIGNbMl0sIGNbM10pO1xuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGNvbG9yOiB0eXBlcy5Db2xvcik6IFtudW1iZXIsIG51bWJlciwgbnVtYmVyLCBudW1iZXJdIHtcblx0XHRyZXR1cm4gW2NvbG9yLnJlZCwgY29sb3IuZ3JlZW4sIGNvbG9yLmJsdWUsIGNvbG9yLmFscGhhXTtcblx0fVxufVxuXG5cbmV4cG9ydCBuYW1lc3BhY2UgU2VsZWN0aW9uUmFuZ2Uge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShvYmo6IHZzY29kZS5TZWxlY3Rpb25SYW5nZSk6IGxhbmd1YWdlcy5TZWxlY3Rpb25SYW5nZSB7XG5cdFx0cmV0dXJuIHsgcmFuZ2U6IFJhbmdlLmZyb20ob2JqLnJhbmdlKSB9O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKG9iajogbGFuZ3VhZ2VzLlNlbGVjdGlvblJhbmdlKTogdnNjb2RlLlNlbGVjdGlvblJhbmdlIHtcblx0XHRyZXR1cm4gbmV3IHR5cGVzLlNlbGVjdGlvblJhbmdlKFJhbmdlLnRvKG9iai5yYW5nZSkpO1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgVGV4dERvY3VtZW50U2F2ZVJlYXNvbiB7XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHJlYXNvbjogU2F2ZVJlYXNvbik6IHZzY29kZS5UZXh0RG9jdW1lbnRTYXZlUmVhc29uIHtcblx0XHRzd2l0Y2ggKHJlYXNvbikge1xuXHRcdFx0Y2FzZSBTYXZlUmVhc29uLkFVVE86XG5cdFx0XHRcdHJldHVybiB0eXBlcy5UZXh0RG9jdW1lbnRTYXZlUmVhc29uLkFmdGVyRGVsYXk7XG5cdFx0XHRjYXNlIFNhdmVSZWFzb24uRVhQTElDSVQ6XG5cdFx0XHRcdHJldHVybiB0eXBlcy5UZXh0RG9jdW1lbnRTYXZlUmVhc29uLk1hbnVhbDtcblx0XHRcdGNhc2UgU2F2ZVJlYXNvbi5GT0NVU19DSEFOR0U6XG5cdFx0XHRjYXNlIFNhdmVSZWFzb24uV0lORE9XX0NIQU5HRTpcblx0XHRcdFx0cmV0dXJuIHR5cGVzLlRleHREb2N1bWVudFNhdmVSZWFzb24uRm9jdXNPdXQ7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgVGV4dEVkaXRvckxpbmVOdW1iZXJzU3R5bGUge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShzdHlsZTogdnNjb2RlLlRleHRFZGl0b3JMaW5lTnVtYmVyc1N0eWxlKTogUmVuZGVyTGluZU51bWJlcnNUeXBlIHtcblx0XHRzd2l0Y2ggKHN0eWxlKSB7XG5cdFx0XHRjYXNlIHR5cGVzLlRleHRFZGl0b3JMaW5lTnVtYmVyc1N0eWxlLk9mZjpcblx0XHRcdFx0cmV0dXJuIFJlbmRlckxpbmVOdW1iZXJzVHlwZS5PZmY7XG5cdFx0XHRjYXNlIHR5cGVzLlRleHRFZGl0b3JMaW5lTnVtYmVyc1N0eWxlLlJlbGF0aXZlOlxuXHRcdFx0XHRyZXR1cm4gUmVuZGVyTGluZU51bWJlcnNUeXBlLlJlbGF0aXZlO1xuXHRcdFx0Y2FzZSB0eXBlcy5UZXh0RWRpdG9yTGluZU51bWJlcnNTdHlsZS5JbnRlcnZhbDpcblx0XHRcdFx0cmV0dXJuIFJlbmRlckxpbmVOdW1iZXJzVHlwZS5JbnRlcnZhbDtcblx0XHRcdGNhc2UgdHlwZXMuVGV4dEVkaXRvckxpbmVOdW1iZXJzU3R5bGUuT246XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gUmVuZGVyTGluZU51bWJlcnNUeXBlLk9uO1xuXHRcdH1cblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gdG8oc3R5bGU6IFJlbmRlckxpbmVOdW1iZXJzVHlwZSk6IHZzY29kZS5UZXh0RWRpdG9yTGluZU51bWJlcnNTdHlsZSB7XG5cdFx0c3dpdGNoIChzdHlsZSkge1xuXHRcdFx0Y2FzZSBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuT2ZmOlxuXHRcdFx0XHRyZXR1cm4gdHlwZXMuVGV4dEVkaXRvckxpbmVOdW1iZXJzU3R5bGUuT2ZmO1xuXHRcdFx0Y2FzZSBSZW5kZXJMaW5lTnVtYmVyc1R5cGUuUmVsYXRpdmU6XG5cdFx0XHRcdHJldHVybiB0eXBlcy5UZXh0RWRpdG9yTGluZU51bWJlcnNTdHlsZS5SZWxhdGl2ZTtcblx0XHRcdGNhc2UgUmVuZGVyTGluZU51bWJlcnNUeXBlLkludGVydmFsOlxuXHRcdFx0XHRyZXR1cm4gdHlwZXMuVGV4dEVkaXRvckxpbmVOdW1iZXJzU3R5bGUuSW50ZXJ2YWw7XG5cdFx0XHRjYXNlIFJlbmRlckxpbmVOdW1iZXJzVHlwZS5Pbjpcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiB0eXBlcy5UZXh0RWRpdG9yTGluZU51bWJlcnNTdHlsZS5Pbjtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBFbmRPZkxpbmUge1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGVvbDogdnNjb2RlLkVuZE9mTGluZSk6IEVuZE9mTGluZVNlcXVlbmNlIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoZW9sID09PSB0eXBlcy5FbmRPZkxpbmUuQ1JMRikge1xuXHRcdFx0cmV0dXJuIEVuZE9mTGluZVNlcXVlbmNlLkNSTEY7XG5cdFx0fSBlbHNlIGlmIChlb2wgPT09IHR5cGVzLkVuZE9mTGluZS5MRikge1xuXHRcdFx0cmV0dXJuIEVuZE9mTGluZVNlcXVlbmNlLkxGO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKGVvbDogRW5kT2ZMaW5lU2VxdWVuY2UpOiB2c2NvZGUuRW5kT2ZMaW5lIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoZW9sID09PSBFbmRPZkxpbmVTZXF1ZW5jZS5DUkxGKSB7XG5cdFx0XHRyZXR1cm4gdHlwZXMuRW5kT2ZMaW5lLkNSTEY7XG5cdFx0fSBlbHNlIGlmIChlb2wgPT09IEVuZE9mTGluZVNlcXVlbmNlLkxGKSB7XG5cdFx0XHRyZXR1cm4gdHlwZXMuRW5kT2ZMaW5lLkxGO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgUHJvZ3Jlc3NMb2NhdGlvbiB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGxvYzogdnNjb2RlLlByb2dyZXNzTG9jYXRpb24gfCB7IHZpZXdJZDogc3RyaW5nIH0pOiBNYWluUHJvZ3Jlc3NMb2NhdGlvbiB8IHN0cmluZyB7XG5cdFx0aWYgKHR5cGVvZiBsb2MgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRyZXR1cm4gbG9jLnZpZXdJZDtcblx0XHR9XG5cblx0XHRzd2l0Y2ggKGxvYykge1xuXHRcdFx0Y2FzZSB0eXBlcy5Qcm9ncmVzc0xvY2F0aW9uLlNvdXJjZUNvbnRyb2w6IHJldHVybiBNYWluUHJvZ3Jlc3NMb2NhdGlvbi5TY207XG5cdFx0XHRjYXNlIHR5cGVzLlByb2dyZXNzTG9jYXRpb24uV2luZG93OiByZXR1cm4gTWFpblByb2dyZXNzTG9jYXRpb24uV2luZG93O1xuXHRcdFx0Y2FzZSB0eXBlcy5Qcm9ncmVzc0xvY2F0aW9uLk5vdGlmaWNhdGlvbjogcmV0dXJuIE1haW5Qcm9ncmVzc0xvY2F0aW9uLk5vdGlmaWNhdGlvbjtcblx0XHR9XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBVbmtub3duICdQcm9ncmVzc0xvY2F0aW9uJ2ApO1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgRm9sZGluZ1JhbmdlIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocjogdnNjb2RlLkZvbGRpbmdSYW5nZSk6IGxhbmd1YWdlcy5Gb2xkaW5nUmFuZ2Uge1xuXHRcdGNvbnN0IHJhbmdlOiBsYW5ndWFnZXMuRm9sZGluZ1JhbmdlID0geyBzdGFydDogci5zdGFydCArIDEsIGVuZDogci5lbmQgKyAxIH07XG5cdFx0aWYgKHIua2luZCkge1xuXHRcdFx0cmFuZ2Uua2luZCA9IEZvbGRpbmdSYW5nZUtpbmQuZnJvbShyLmtpbmQpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmFuZ2U7XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHI6IGxhbmd1YWdlcy5Gb2xkaW5nUmFuZ2UpOiB2c2NvZGUuRm9sZGluZ1JhbmdlIHtcblx0XHRjb25zdCByYW5nZTogdnNjb2RlLkZvbGRpbmdSYW5nZSA9IHsgc3RhcnQ6IHIuc3RhcnQgLSAxLCBlbmQ6IHIuZW5kIC0gMSB9O1xuXHRcdGlmIChyLmtpbmQpIHtcblx0XHRcdHJhbmdlLmtpbmQgPSBGb2xkaW5nUmFuZ2VLaW5kLnRvKHIua2luZCk7XG5cdFx0fVxuXHRcdHJldHVybiByYW5nZTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIEZvbGRpbmdSYW5nZUtpbmQge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShraW5kOiB2c2NvZGUuRm9sZGluZ1JhbmdlS2luZCB8IHVuZGVmaW5lZCk6IGxhbmd1YWdlcy5Gb2xkaW5nUmFuZ2VLaW5kIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoa2luZCkge1xuXHRcdFx0c3dpdGNoIChraW5kKSB7XG5cdFx0XHRcdGNhc2UgdHlwZXMuRm9sZGluZ1JhbmdlS2luZC5Db21tZW50OlxuXHRcdFx0XHRcdHJldHVybiBsYW5ndWFnZXMuRm9sZGluZ1JhbmdlS2luZC5Db21tZW50O1xuXHRcdFx0XHRjYXNlIHR5cGVzLkZvbGRpbmdSYW5nZUtpbmQuSW1wb3J0czpcblx0XHRcdFx0XHRyZXR1cm4gbGFuZ3VhZ2VzLkZvbGRpbmdSYW5nZUtpbmQuSW1wb3J0cztcblx0XHRcdFx0Y2FzZSB0eXBlcy5Gb2xkaW5nUmFuZ2VLaW5kLlJlZ2lvbjpcblx0XHRcdFx0XHRyZXR1cm4gbGFuZ3VhZ2VzLkZvbGRpbmdSYW5nZUtpbmQuUmVnaW9uO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiB0byhraW5kOiBsYW5ndWFnZXMuRm9sZGluZ1JhbmdlS2luZCB8IHVuZGVmaW5lZCk6IHZzY29kZS5Gb2xkaW5nUmFuZ2VLaW5kIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoa2luZCkge1xuXHRcdFx0c3dpdGNoIChraW5kLnZhbHVlKSB7XG5cdFx0XHRcdGNhc2UgbGFuZ3VhZ2VzLkZvbGRpbmdSYW5nZUtpbmQuQ29tbWVudC52YWx1ZTpcblx0XHRcdFx0XHRyZXR1cm4gdHlwZXMuRm9sZGluZ1JhbmdlS2luZC5Db21tZW50O1xuXHRcdFx0XHRjYXNlIGxhbmd1YWdlcy5Gb2xkaW5nUmFuZ2VLaW5kLkltcG9ydHMudmFsdWU6XG5cdFx0XHRcdFx0cmV0dXJuIHR5cGVzLkZvbGRpbmdSYW5nZUtpbmQuSW1wb3J0cztcblx0XHRcdFx0Y2FzZSBsYW5ndWFnZXMuRm9sZGluZ1JhbmdlS2luZC5SZWdpb24udmFsdWU6XG5cdFx0XHRcdFx0cmV0dXJuIHR5cGVzLkZvbGRpbmdSYW5nZUtpbmQuUmVnaW9uO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGV4dEVkaXRvck9wZW5PcHRpb25zIGV4dGVuZHMgdnNjb2RlLlRleHREb2N1bWVudFNob3dPcHRpb25zIHtcblx0YmFja2dyb3VuZD86IGJvb2xlYW47XG5cdG92ZXJyaWRlPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBUZXh0RWRpdG9yT3Blbk9wdGlvbnMge1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKG9wdGlvbnM/OiBUZXh0RWRpdG9yT3Blbk9wdGlvbnMpOiBJVGV4dEVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQge1xuXHRcdGlmIChvcHRpb25zKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRwaW5uZWQ6IHR5cGVvZiBvcHRpb25zLnByZXZpZXcgPT09ICdib29sZWFuJyA/ICFvcHRpb25zLnByZXZpZXcgOiB1bmRlZmluZWQsXG5cdFx0XHRcdGluYWN0aXZlOiBvcHRpb25zLmJhY2tncm91bmQsXG5cdFx0XHRcdHByZXNlcnZlRm9jdXM6IG9wdGlvbnMucHJlc2VydmVGb2N1cyxcblx0XHRcdFx0c2VsZWN0aW9uOiB0eXBlb2Ygb3B0aW9ucy5zZWxlY3Rpb24gPT09ICdvYmplY3QnID8gUmFuZ2UuZnJvbShvcHRpb25zLnNlbGVjdGlvbikgOiB1bmRlZmluZWQsXG5cdFx0XHRcdG92ZXJyaWRlOiB0eXBlb2Ygb3B0aW9ucy5vdmVycmlkZSA9PT0gJ2Jvb2xlYW4nID8gREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04uaWQgOiB1bmRlZmluZWRcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgR2xvYlBhdHRlcm4ge1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHBhdHRlcm46IHZzY29kZS5HbG9iUGF0dGVybik6IHN0cmluZyB8IGV4dEhvc3RQcm90b2NvbC5JUmVsYXRpdmVQYXR0ZXJuRHRvO1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShwYXR0ZXJuOiB1bmRlZmluZWQpOiB1bmRlZmluZWQ7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHBhdHRlcm46IG51bGwpOiBudWxsO1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShwYXR0ZXJuOiB2c2NvZGUuR2xvYlBhdHRlcm4gfCB1bmRlZmluZWQgfCBudWxsKTogc3RyaW5nIHwgZXh0SG9zdFByb3RvY29sLklSZWxhdGl2ZVBhdHRlcm5EdG8gfCB1bmRlZmluZWQgfCBudWxsO1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShwYXR0ZXJuOiB2c2NvZGUuR2xvYlBhdHRlcm4gfCB1bmRlZmluZWQgfCBudWxsKTogc3RyaW5nIHwgZXh0SG9zdFByb3RvY29sLklSZWxhdGl2ZVBhdHRlcm5EdG8gfCB1bmRlZmluZWQgfCBudWxsIHtcblx0XHRpZiAocGF0dGVybiBpbnN0YW5jZW9mIHR5cGVzLlJlbGF0aXZlUGF0dGVybikge1xuXHRcdFx0cmV0dXJuIHBhdHRlcm4udG9KU09OKCk7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBwYXR0ZXJuID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIHBhdHRlcm47XG5cdFx0fVxuXG5cdFx0Ly8gVGhpcyBpcyBzbGlnaHRseSBib2d1cyBiZWNhdXNlIHdlIGRlY2xhcmUgdGhpcyBtZXRob2QgdG8gYWNjZXB0XG5cdFx0Ly8gYHZzY29kZS5HbG9iUGF0dGVybmAgd2hpY2ggY2FuIGJlIGB2c2NvZGUuUmVsYXRpdmVQYXR0ZXJuYCBjbGFzcyxcblx0XHQvLyBidXQgZ2l2ZW4gd2UgY2Fubm90IGVuZm9yY2UgY2xhc3NlcyBmcm9tIG91ciB2c2NvZGUuZC50cywgd2UgaGF2ZVxuXHRcdC8vIHRvIHByb2JlIGZvciBvYmplY3RzIHRvb1xuXHRcdC8vIFJlZnM6IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNDA3NzFcblx0XHRpZiAoaXNSZWxhdGl2ZVBhdHRlcm5TaGFwZShwYXR0ZXJuKSB8fCBpc0xlZ2FjeVJlbGF0aXZlUGF0dGVyblNoYXBlKHBhdHRlcm4pKSB7XG5cdFx0XHRyZXR1cm4gbmV3IHR5cGVzLlJlbGF0aXZlUGF0dGVybihwYXR0ZXJuLmJhc2VVcmkgPz8gcGF0dGVybi5iYXNlLCBwYXR0ZXJuLnBhdHRlcm4pLnRvSlNPTigpO1xuXHRcdH1cblxuXHRcdHJldHVybiBwYXR0ZXJuOyAvLyBwcmVzZXJ2ZSBgdW5kZWZpbmVkYCBhbmQgYG51bGxgXG5cdH1cblxuXHRmdW5jdGlvbiBpc1JlbGF0aXZlUGF0dGVyblNoYXBlKG9iajogdW5rbm93bik6IG9iaiBpcyB7IGJhc2U6IHN0cmluZzsgYmFzZVVyaTogVVJJOyBwYXR0ZXJuOiBzdHJpbmcgfSB7XG5cdFx0Y29uc3QgcnAgPSBvYmogYXMgeyBiYXNlOiBzdHJpbmc7IGJhc2VVcmk6IFVSSTsgcGF0dGVybjogc3RyaW5nIH0gfCB1bmRlZmluZWQgfCBudWxsO1xuXHRcdGlmICghcnApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gVVJJLmlzVXJpKHJwLmJhc2VVcmkpICYmIHR5cGVvZiBycC5wYXR0ZXJuID09PSAnc3RyaW5nJztcblx0fVxuXG5cdGZ1bmN0aW9uIGlzTGVnYWN5UmVsYXRpdmVQYXR0ZXJuU2hhcGUob2JqOiB1bmtub3duKTogb2JqIGlzIHsgYmFzZTogc3RyaW5nOyBwYXR0ZXJuOiBzdHJpbmcgfSB7XG5cblx0XHQvLyBCZWZvcmUgMS42NC54LCBgUmVsYXRpdmVQYXR0ZXJuYCBkaWQgbm90IGhhdmUgYW55IGBiYXNlVXJpOiBVcmlgXG5cdFx0Ly8gcHJvcGVydHkuIFRvIHByZXNlcnZlIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IHdpdGggb2xkZXIgZXh0ZW5zaW9uc1xuXHRcdC8vIHdlIGFsbG93IHRoaXMgb2xkIGZvcm1hdCB3aGVuIGNyZWF0aW5nIHRoZSBgdnNjb2RlLlJlbGF0aXZlUGF0dGVybmAuXG5cblx0XHRjb25zdCBycCA9IG9iaiBhcyB7IGJhc2U6IHN0cmluZzsgcGF0dGVybjogc3RyaW5nIH0gfCB1bmRlZmluZWQgfCBudWxsO1xuXHRcdGlmICghcnApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHlwZW9mIHJwLmJhc2UgPT09ICdzdHJpbmcnICYmIHR5cGVvZiBycC5wYXR0ZXJuID09PSAnc3RyaW5nJztcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byhwYXR0ZXJuOiBzdHJpbmcgfCBleHRIb3N0UHJvdG9jb2wuSVJlbGF0aXZlUGF0dGVybkR0byk6IHZzY29kZS5HbG9iUGF0dGVybiB7XG5cdFx0aWYgKHR5cGVvZiBwYXR0ZXJuID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIHBhdHRlcm47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyB0eXBlcy5SZWxhdGl2ZVBhdHRlcm4oVVJJLnJldml2ZShwYXR0ZXJuLmJhc2VVcmkpLCBwYXR0ZXJuLnBhdHRlcm4pO1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgTGFuZ3VhZ2VTZWxlY3RvciB7XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oc2VsZWN0b3I6IHVuZGVmaW5lZCk6IHVuZGVmaW5lZDtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yKTogbGFuZ3VhZ2VTZWxlY3Rvci5MYW5ndWFnZVNlbGVjdG9yO1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IgfCB1bmRlZmluZWQpOiBsYW5ndWFnZVNlbGVjdG9yLkxhbmd1YWdlU2VsZWN0b3IgfCB1bmRlZmluZWQ7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciB8IHVuZGVmaW5lZCk6IGxhbmd1YWdlU2VsZWN0b3IuTGFuZ3VhZ2VTZWxlY3RvciB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCFzZWxlY3Rvcikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoc2VsZWN0b3IpKSB7XG5cdFx0XHRyZXR1cm4gPGxhbmd1YWdlU2VsZWN0b3IuTGFuZ3VhZ2VTZWxlY3Rvcj5zZWxlY3Rvci5tYXAoZnJvbSk7XG5cdFx0fSBlbHNlIGlmICh0eXBlb2Ygc2VsZWN0b3IgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gc2VsZWN0b3I7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGZpbHRlciA9IHNlbGVjdG9yIGFzIHZzY29kZS5Eb2N1bWVudEZpbHRlcjsgLy8gVE9ETzogbWljcm9zb2Z0L1R5cGVTY3JpcHQjNDI3Njhcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGxhbmd1YWdlOiBmaWx0ZXIubGFuZ3VhZ2UsXG5cdFx0XHRcdHNjaGVtZTogZmlsdGVyLnNjaGVtZSxcblx0XHRcdFx0cGF0dGVybjogR2xvYlBhdHRlcm4uZnJvbShmaWx0ZXIucGF0dGVybikgPz8gdW5kZWZpbmVkLFxuXHRcdFx0XHRleGNsdXNpdmU6IGZpbHRlci5leGNsdXNpdmUsXG5cdFx0XHRcdG5vdGVib29rVHlwZTogZmlsdGVyLm5vdGVib29rVHlwZVxuXHRcdFx0fTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBOb3RlYm9va1JhbmdlIHtcblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShyYW5nZTogdnNjb2RlLk5vdGVib29rUmFuZ2UpOiBJQ2VsbFJhbmdlIHtcblx0XHRyZXR1cm4geyBzdGFydDogcmFuZ2Uuc3RhcnQsIGVuZDogcmFuZ2UuZW5kIH07XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdG8ocmFuZ2U6IElDZWxsUmFuZ2UpOiB0eXBlcy5Ob3RlYm9va1JhbmdlIHtcblx0XHRyZXR1cm4gbmV3IHR5cGVzLk5vdGVib29rUmFuZ2UocmFuZ2Uuc3RhcnQsIHJhbmdlLmVuZCk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBOb3RlYm9va0NlbGxFeGVjdXRpb25TdW1tYXJ5IHtcblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKGRhdGE6IG5vdGVib29rcy5Ob3RlYm9va0NlbGxJbnRlcm5hbE1ldGFkYXRhKTogdnNjb2RlLk5vdGVib29rQ2VsbEV4ZWN1dGlvblN1bW1hcnkge1xuXHRcdHJldHVybiB7XG5cdFx0XHR0aW1pbmc6IHR5cGVvZiBkYXRhLnJ1blN0YXJ0VGltZSA9PT0gJ251bWJlcicgJiYgdHlwZW9mIGRhdGEucnVuRW5kVGltZSA9PT0gJ251bWJlcicgPyB7IHN0YXJ0VGltZTogZGF0YS5ydW5TdGFydFRpbWUsIGVuZFRpbWU6IGRhdGEucnVuRW5kVGltZSB9IDogdW5kZWZpbmVkLFxuXHRcdFx0ZXhlY3V0aW9uT3JkZXI6IGRhdGEuZXhlY3V0aW9uT3JkZXIsXG5cdFx0XHRzdWNjZXNzOiBkYXRhLmxhc3RSdW5TdWNjZXNzXG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGRhdGE6IHZzY29kZS5Ob3RlYm9va0NlbGxFeGVjdXRpb25TdW1tYXJ5KTogUGFydGlhbDxub3RlYm9va3MuTm90ZWJvb2tDZWxsSW50ZXJuYWxNZXRhZGF0YT4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRsYXN0UnVuU3VjY2VzczogZGF0YS5zdWNjZXNzLFxuXHRcdFx0cnVuU3RhcnRUaW1lOiBkYXRhLnRpbWluZz8uc3RhcnRUaW1lLFxuXHRcdFx0cnVuRW5kVGltZTogZGF0YS50aW1pbmc/LmVuZFRpbWUsXG5cdFx0XHRleGVjdXRpb25PcmRlcjogZGF0YS5leGVjdXRpb25PcmRlclxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBOb3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZSB7XG5cdGV4cG9ydCBmdW5jdGlvbiB0byhzdGF0ZTogbm90ZWJvb2tzLk5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlKTogdnNjb2RlLk5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoc3RhdGUgPT09IG5vdGVib29rcy5Ob3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZS5VbmNvbmZpcm1lZCkge1xuXHRcdFx0cmV0dXJuIHR5cGVzLk5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlLlBlbmRpbmc7XG5cdFx0fSBlbHNlIGlmIChzdGF0ZSA9PT0gbm90ZWJvb2tzLk5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlLlBlbmRpbmcpIHtcblx0XHRcdC8vIFNpbmNlIHRoZSAocHJvcG9zZWQpIGV4dGVuc2lvbiBBUEkgZG9lc24ndCBoYXZlIHRoZSBkaXN0aW5jdGlvbiBiZXR3ZWVuIFVuY29uZmlybWVkIGFuZCBQZW5kaW5nLCB3ZSBkb24ndCB3YW50IHRvIGZpcmUgYW4gdXBkYXRlIGZvciBQZW5kaW5nIHR3aWNlXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH0gZWxzZSBpZiAoc3RhdGUgPT09IG5vdGVib29rcy5Ob3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZS5FeGVjdXRpbmcpIHtcblx0XHRcdHJldHVybiB0eXBlcy5Ob3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZS5FeGVjdXRpbmc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVW5rbm93biBzdGF0ZTogJHtzdGF0ZX1gKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBOb3RlYm9va0NlbGxLaW5kIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oZGF0YTogdnNjb2RlLk5vdGVib29rQ2VsbEtpbmQpOiBub3RlYm9va3MuQ2VsbEtpbmQge1xuXHRcdHN3aXRjaCAoZGF0YSkge1xuXHRcdFx0Y2FzZSB0eXBlcy5Ob3RlYm9va0NlbGxLaW5kLk1hcmt1cDpcblx0XHRcdFx0cmV0dXJuIG5vdGVib29rcy5DZWxsS2luZC5NYXJrdXA7XG5cdFx0XHRjYXNlIHR5cGVzLk5vdGVib29rQ2VsbEtpbmQuQ29kZTpcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBub3RlYm9va3MuQ2VsbEtpbmQuQ29kZTtcblx0XHR9XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdG8oZGF0YTogbm90ZWJvb2tzLkNlbGxLaW5kKTogdnNjb2RlLk5vdGVib29rQ2VsbEtpbmQge1xuXHRcdHN3aXRjaCAoZGF0YSkge1xuXHRcdFx0Y2FzZSBub3RlYm9va3MuQ2VsbEtpbmQuTWFya3VwOlxuXHRcdFx0XHRyZXR1cm4gdHlwZXMuTm90ZWJvb2tDZWxsS2luZC5NYXJrdXA7XG5cdFx0XHRjYXNlIG5vdGVib29rcy5DZWxsS2luZC5Db2RlOlxuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIHR5cGVzLk5vdGVib29rQ2VsbEtpbmQuQ29kZTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBOb3RlYm9va0RhdGEge1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGRhdGE6IHZzY29kZS5Ob3RlYm9va0RhdGEpOiBleHRIb3N0UHJvdG9jb2wuTm90ZWJvb2tEYXRhRHRvIHtcblx0XHRjb25zdCByZXM6IGV4dEhvc3RQcm90b2NvbC5Ob3RlYm9va0RhdGFEdG8gPSB7XG5cdFx0XHRtZXRhZGF0YTogZGF0YS5tZXRhZGF0YSA/PyBPYmplY3QuY3JlYXRlKG51bGwpLFxuXHRcdFx0Y2VsbHM6IFtdLFxuXHRcdH07XG5cdFx0Zm9yIChjb25zdCBjZWxsIG9mIGRhdGEuY2VsbHMpIHtcblx0XHRcdHR5cGVzLk5vdGVib29rQ2VsbERhdGEudmFsaWRhdGUoY2VsbCk7XG5cdFx0XHRyZXMuY2VsbHMucHVzaChOb3RlYm9va0NlbGxEYXRhLmZyb20oY2VsbCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKGRhdGE6IGV4dEhvc3RQcm90b2NvbC5Ob3RlYm9va0RhdGFEdG8pOiB2c2NvZGUuTm90ZWJvb2tEYXRhIHtcblx0XHRjb25zdCByZXMgPSBuZXcgdHlwZXMuTm90ZWJvb2tEYXRhKFxuXHRcdFx0ZGF0YS5jZWxscy5tYXAoTm90ZWJvb2tDZWxsRGF0YS50byksXG5cdFx0KTtcblx0XHRpZiAoIWlzRW1wdHlPYmplY3QoZGF0YS5tZXRhZGF0YSkpIHtcblx0XHRcdHJlcy5tZXRhZGF0YSA9IGRhdGEubWV0YWRhdGE7XG5cdFx0fVxuXHRcdHJldHVybiByZXM7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBOb3RlYm9va0NlbGxEYXRhIHtcblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShkYXRhOiB2c2NvZGUuTm90ZWJvb2tDZWxsRGF0YSk6IGV4dEhvc3RQcm90b2NvbC5Ob3RlYm9va0NlbGxEYXRhRHRvIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Y2VsbEtpbmQ6IE5vdGVib29rQ2VsbEtpbmQuZnJvbShkYXRhLmtpbmQpLFxuXHRcdFx0bGFuZ3VhZ2U6IGRhdGEubGFuZ3VhZ2VJZCxcblx0XHRcdG1pbWU6IGRhdGEubWltZSxcblx0XHRcdHNvdXJjZTogZGF0YS52YWx1ZSxcblx0XHRcdG1ldGFkYXRhOiBkYXRhLm1ldGFkYXRhLFxuXHRcdFx0aW50ZXJuYWxNZXRhZGF0YTogTm90ZWJvb2tDZWxsRXhlY3V0aW9uU3VtbWFyeS5mcm9tKGRhdGEuZXhlY3V0aW9uU3VtbWFyeSA/PyB7fSksXG5cdFx0XHRvdXRwdXRzOiBkYXRhLm91dHB1dHMgPyBkYXRhLm91dHB1dHMubWFwKE5vdGVib29rQ2VsbE91dHB1dC5mcm9tKSA6IFtdXG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byhkYXRhOiBleHRIb3N0UHJvdG9jb2wuTm90ZWJvb2tDZWxsRGF0YUR0byk6IHZzY29kZS5Ob3RlYm9va0NlbGxEYXRhIHtcblx0XHRyZXR1cm4gbmV3IHR5cGVzLk5vdGVib29rQ2VsbERhdGEoXG5cdFx0XHROb3RlYm9va0NlbGxLaW5kLnRvKGRhdGEuY2VsbEtpbmQpLFxuXHRcdFx0ZGF0YS5zb3VyY2UsXG5cdFx0XHRkYXRhLmxhbmd1YWdlLFxuXHRcdFx0ZGF0YS5taW1lLFxuXHRcdFx0ZGF0YS5vdXRwdXRzID8gZGF0YS5vdXRwdXRzLm1hcChOb3RlYm9va0NlbGxPdXRwdXQudG8pIDogdW5kZWZpbmVkLFxuXHRcdFx0ZGF0YS5tZXRhZGF0YSxcblx0XHRcdGRhdGEuaW50ZXJuYWxNZXRhZGF0YSA/IE5vdGVib29rQ2VsbEV4ZWN1dGlvblN1bW1hcnkudG8oZGF0YS5pbnRlcm5hbE1ldGFkYXRhKSA6IHVuZGVmaW5lZFxuXHRcdCk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBOb3RlYm9va0NlbGxPdXRwdXRJdGVtIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oaXRlbTogdHlwZXMuTm90ZWJvb2tDZWxsT3V0cHV0SXRlbSk6IGV4dEhvc3RQcm90b2NvbC5Ob3RlYm9va091dHB1dEl0ZW1EdG8ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRtaW1lOiBpdGVtLm1pbWUsXG5cdFx0XHR2YWx1ZUJ5dGVzOiBWU0J1ZmZlci53cmFwKGl0ZW0uZGF0YSksXG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byhpdGVtOiBleHRIb3N0UHJvdG9jb2wuTm90ZWJvb2tPdXRwdXRJdGVtRHRvKTogdHlwZXMuTm90ZWJvb2tDZWxsT3V0cHV0SXRlbSB7XG5cdFx0cmV0dXJuIG5ldyB0eXBlcy5Ob3RlYm9va0NlbGxPdXRwdXRJdGVtKGl0ZW0udmFsdWVCeXRlcy5idWZmZXIsIGl0ZW0ubWltZSk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBOb3RlYm9va0NlbGxPdXRwdXQge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShvdXRwdXQ6IHZzY29kZS5Ob3RlYm9va0NlbGxPdXRwdXQpOiBleHRIb3N0UHJvdG9jb2wuTm90ZWJvb2tPdXRwdXREdG8ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRvdXRwdXRJZDogb3V0cHV0LmlkLFxuXHRcdFx0aXRlbXM6IG91dHB1dC5pdGVtcy5tYXAoTm90ZWJvb2tDZWxsT3V0cHV0SXRlbS5mcm9tKSxcblx0XHRcdG1ldGFkYXRhOiBvdXRwdXQubWV0YWRhdGFcblx0XHR9O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKG91dHB1dDogZXh0SG9zdFByb3RvY29sLk5vdGVib29rT3V0cHV0RHRvKTogdnNjb2RlLk5vdGVib29rQ2VsbE91dHB1dCB7XG5cdFx0Y29uc3QgaXRlbXMgPSBvdXRwdXQuaXRlbXMubWFwKE5vdGVib29rQ2VsbE91dHB1dEl0ZW0udG8pO1xuXHRcdHJldHVybiBuZXcgdHlwZXMuTm90ZWJvb2tDZWxsT3V0cHV0KGl0ZW1zLCBvdXRwdXQub3V0cHV0SWQsIG91dHB1dC5tZXRhZGF0YSk7XG5cdH1cbn1cblxuXG5leHBvcnQgbmFtZXNwYWNlIE5vdGVib29rRXhjbHVzaXZlRG9jdW1lbnRQYXR0ZXJuIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocGF0dGVybjogeyBpbmNsdWRlOiB2c2NvZGUuR2xvYlBhdHRlcm4gfCB1bmRlZmluZWQ7IGV4Y2x1ZGU6IHZzY29kZS5HbG9iUGF0dGVybiB8IHVuZGVmaW5lZCB9KTogeyBpbmNsdWRlOiBzdHJpbmcgfCBleHRIb3N0UHJvdG9jb2wuSVJlbGF0aXZlUGF0dGVybkR0byB8IHVuZGVmaW5lZDsgZXhjbHVkZTogc3RyaW5nIHwgZXh0SG9zdFByb3RvY29sLklSZWxhdGl2ZVBhdHRlcm5EdG8gfCB1bmRlZmluZWQgfTtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocGF0dGVybjogdnNjb2RlLkdsb2JQYXR0ZXJuKTogc3RyaW5nIHwgZXh0SG9zdFByb3RvY29sLklSZWxhdGl2ZVBhdHRlcm5EdG87XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHBhdHRlcm46IHVuZGVmaW5lZCk6IHVuZGVmaW5lZDtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocGF0dGVybjogeyBpbmNsdWRlOiB2c2NvZGUuR2xvYlBhdHRlcm4gfCB1bmRlZmluZWQgfCBudWxsOyBleGNsdWRlOiB2c2NvZGUuR2xvYlBhdHRlcm4gfCB1bmRlZmluZWQgfSB8IHZzY29kZS5HbG9iUGF0dGVybiB8IHVuZGVmaW5lZCk6IHN0cmluZyB8IGV4dEhvc3RQcm90b2NvbC5JUmVsYXRpdmVQYXR0ZXJuRHRvIHwgeyBpbmNsdWRlOiBzdHJpbmcgfCBleHRIb3N0UHJvdG9jb2wuSVJlbGF0aXZlUGF0dGVybkR0byB8IHVuZGVmaW5lZDsgZXhjbHVkZTogc3RyaW5nIHwgZXh0SG9zdFByb3RvY29sLklSZWxhdGl2ZVBhdHRlcm5EdG8gfCB1bmRlZmluZWQgfSB8IHVuZGVmaW5lZDtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocGF0dGVybjogeyBpbmNsdWRlOiB2c2NvZGUuR2xvYlBhdHRlcm4gfCB1bmRlZmluZWQgfCBudWxsOyBleGNsdWRlOiB2c2NvZGUuR2xvYlBhdHRlcm4gfCB1bmRlZmluZWQgfSB8IHZzY29kZS5HbG9iUGF0dGVybiB8IHVuZGVmaW5lZCk6IHN0cmluZyB8IGV4dEhvc3RQcm90b2NvbC5JUmVsYXRpdmVQYXR0ZXJuRHRvIHwgeyBpbmNsdWRlOiBzdHJpbmcgfCBleHRIb3N0UHJvdG9jb2wuSVJlbGF0aXZlUGF0dGVybkR0byB8IHVuZGVmaW5lZDsgZXhjbHVkZTogc3RyaW5nIHwgZXh0SG9zdFByb3RvY29sLklSZWxhdGl2ZVBhdHRlcm5EdG8gfCB1bmRlZmluZWQgfSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGlzRXhjbHVzaXZlUGF0dGVybihwYXR0ZXJuKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aW5jbHVkZTogR2xvYlBhdHRlcm4uZnJvbShwYXR0ZXJuLmluY2x1ZGUpID8/IHVuZGVmaW5lZCxcblx0XHRcdFx0ZXhjbHVkZTogR2xvYlBhdHRlcm4uZnJvbShwYXR0ZXJuLmV4Y2x1ZGUpID8/IHVuZGVmaW5lZCxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIEdsb2JQYXR0ZXJuLmZyb20ocGF0dGVybikgPz8gdW5kZWZpbmVkO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHBhdHRlcm46IHN0cmluZyB8IGV4dEhvc3RQcm90b2NvbC5JUmVsYXRpdmVQYXR0ZXJuRHRvIHwgeyBpbmNsdWRlOiBzdHJpbmcgfCBleHRIb3N0UHJvdG9jb2wuSVJlbGF0aXZlUGF0dGVybkR0bzsgZXhjbHVkZTogc3RyaW5nIHwgZXh0SG9zdFByb3RvY29sLklSZWxhdGl2ZVBhdHRlcm5EdG8gfSk6IHsgaW5jbHVkZTogdnNjb2RlLkdsb2JQYXR0ZXJuOyBleGNsdWRlOiB2c2NvZGUuR2xvYlBhdHRlcm4gfSB8IHZzY29kZS5HbG9iUGF0dGVybiB7XG5cdFx0aWYgKGlzRXhjbHVzaXZlUGF0dGVybihwYXR0ZXJuKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aW5jbHVkZTogR2xvYlBhdHRlcm4udG8ocGF0dGVybi5pbmNsdWRlKSxcblx0XHRcdFx0ZXhjbHVkZTogR2xvYlBhdHRlcm4udG8ocGF0dGVybi5leGNsdWRlKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4gR2xvYlBhdHRlcm4udG8ocGF0dGVybik7XG5cdH1cblxuXHRmdW5jdGlvbiBpc0V4Y2x1c2l2ZVBhdHRlcm48VD4ob2JqOiBhbnkpOiBvYmogaXMgeyBpbmNsdWRlPzogVDsgZXhjbHVkZT86IFQgfSB7XG5cdFx0Y29uc3QgZXAgPSBvYmogYXMgeyBpbmNsdWRlPzogVDsgZXhjbHVkZT86IFQgfSB8IHVuZGVmaW5lZCB8IG51bGw7XG5cdFx0aWYgKCFlcCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gIWlzVW5kZWZpbmVkT3JOdWxsKGVwLmluY2x1ZGUpICYmICFpc1VuZGVmaW5lZE9yTnVsbChlcC5leGNsdWRlKTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIE5vdGVib29rU3RhdHVzQmFySXRlbSB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGl0ZW06IHZzY29kZS5Ob3RlYm9va0NlbGxTdGF0dXNCYXJJdGVtLCBjb21tYW5kc0NvbnZlcnRlcjogQ29tbWFuZC5JQ29tbWFuZHNDb252ZXJ0ZXIsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiBub3RlYm9va3MuSU5vdGVib29rQ2VsbFN0YXR1c0Jhckl0ZW0ge1xuXHRcdGNvbnN0IGNvbW1hbmQgPSB0eXBlb2YgaXRlbS5jb21tYW5kID09PSAnc3RyaW5nJyA/IHsgdGl0bGU6ICcnLCBjb21tYW5kOiBpdGVtLmNvbW1hbmQgfSA6IGl0ZW0uY29tbWFuZDtcblx0XHRyZXR1cm4ge1xuXHRcdFx0YWxpZ25tZW50OiBpdGVtLmFsaWdubWVudCA9PT0gdHlwZXMuTm90ZWJvb2tDZWxsU3RhdHVzQmFyQWxpZ25tZW50LkxlZnQgPyBub3RlYm9va3MuQ2VsbFN0YXR1c2JhckFsaWdubWVudC5MZWZ0IDogbm90ZWJvb2tzLkNlbGxTdGF0dXNiYXJBbGlnbm1lbnQuUmlnaHQsXG5cdFx0XHRjb21tYW5kOiBjb21tYW5kc0NvbnZlcnRlci50b0ludGVybmFsKGNvbW1hbmQsIGRpc3Bvc2FibGVzKSwgLy8gVE9ET0Byb2Jsb3Vcblx0XHRcdHRleHQ6IGl0ZW0udGV4dCxcblx0XHRcdHRvb2x0aXA6IGl0ZW0udG9vbHRpcCxcblx0XHRcdGFjY2Vzc2liaWxpdHlJbmZvcm1hdGlvbjogaXRlbS5hY2Nlc3NpYmlsaXR5SW5mb3JtYXRpb24sXG5cdFx0XHRwcmlvcml0eTogaXRlbS5wcmlvcml0eVxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBOb3RlYm9va0tlcm5lbFNvdXJjZUFjdGlvbiB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGl0ZW06IHZzY29kZS5Ob3RlYm9va0tlcm5lbFNvdXJjZUFjdGlvbiwgY29tbWFuZHNDb252ZXJ0ZXI6IENvbW1hbmQuSUNvbW1hbmRzQ29udmVydGVyLCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKTogbm90ZWJvb2tzLklOb3RlYm9va0tlcm5lbFNvdXJjZUFjdGlvbiB7XG5cdFx0Y29uc3QgY29tbWFuZCA9IHR5cGVvZiBpdGVtLmNvbW1hbmQgPT09ICdzdHJpbmcnID8geyB0aXRsZTogJycsIGNvbW1hbmQ6IGl0ZW0uY29tbWFuZCB9IDogaXRlbS5jb21tYW5kO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGNvbW1hbmQ6IGNvbW1hbmRzQ29udmVydGVyLnRvSW50ZXJuYWwoY29tbWFuZCwgZGlzcG9zYWJsZXMpLFxuXHRcdFx0bGFiZWw6IGl0ZW0ubGFiZWwsXG5cdFx0XHRkZXNjcmlwdGlvbjogaXRlbS5kZXNjcmlwdGlvbixcblx0XHRcdGRldGFpbDogaXRlbS5kZXRhaWwsXG5cdFx0XHRkb2N1bWVudGF0aW9uOiBpdGVtLmRvY3VtZW50YXRpb25cblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgTm90ZWJvb2tEb2N1bWVudENvbnRlbnRPcHRpb25zIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ob3B0aW9uczogdnNjb2RlLk5vdGVib29rRG9jdW1lbnRDb250ZW50T3B0aW9ucyB8IHVuZGVmaW5lZCk6IG5vdGVib29rcy5UcmFuc2llbnRPcHRpb25zIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dHJhbnNpZW50T3V0cHV0czogb3B0aW9ucz8udHJhbnNpZW50T3V0cHV0cyA/PyBmYWxzZSxcblx0XHRcdHRyYW5zaWVudENlbGxNZXRhZGF0YTogb3B0aW9ucz8udHJhbnNpZW50Q2VsbE1ldGFkYXRhID8/IHt9LFxuXHRcdFx0dHJhbnNpZW50RG9jdW1lbnRNZXRhZGF0YTogb3B0aW9ucz8udHJhbnNpZW50RG9jdW1lbnRNZXRhZGF0YSA/PyB7fSxcblx0XHRcdGNlbGxDb250ZW50TWV0YWRhdGE6IG9wdGlvbnM/LmNlbGxDb250ZW50TWV0YWRhdGEgPz8ge31cblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgTm90ZWJvb2tSZW5kZXJlclNjcmlwdCB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHByZWxvYWQ6IHZzY29kZS5Ob3RlYm9va1JlbmRlcmVyU2NyaXB0KTogeyB1cmk6IFVyaUNvbXBvbmVudHM7IHByb3ZpZGVzOiByZWFkb25seSBzdHJpbmdbXSB9IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dXJpOiBwcmVsb2FkLnVyaSxcblx0XHRcdHByb3ZpZGVzOiBwcmVsb2FkLnByb3ZpZGVzXG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byhwcmVsb2FkOiB7IHVyaTogVXJpQ29tcG9uZW50czsgcHJvdmlkZXM6IHJlYWRvbmx5IHN0cmluZ1tdIH0pOiB2c2NvZGUuTm90ZWJvb2tSZW5kZXJlclNjcmlwdCB7XG5cdFx0cmV0dXJuIG5ldyB0eXBlcy5Ob3RlYm9va1JlbmRlcmVyU2NyaXB0KFVSSS5yZXZpdmUocHJlbG9hZC51cmkpLCBwcmVsb2FkLnByb3ZpZGVzKTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIFRlc3RNZXNzYWdlIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20obWVzc2FnZTogdnNjb2RlLlRlc3RNZXNzYWdlKTogSVRlc3RFcnJvck1lc3NhZ2UuU2VyaWFsaXplZCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG1lc3NhZ2U6IE1hcmtkb3duU3RyaW5nLmZyb21TdHJpY3QobWVzc2FnZS5tZXNzYWdlKSB8fCAnJyxcblx0XHRcdHR5cGU6IFRlc3RNZXNzYWdlVHlwZS5FcnJvcixcblx0XHRcdGV4cGVjdGVkOiBtZXNzYWdlLmV4cGVjdGVkT3V0cHV0LFxuXHRcdFx0YWN0dWFsOiBtZXNzYWdlLmFjdHVhbE91dHB1dCxcblx0XHRcdGNvbnRleHRWYWx1ZTogbWVzc2FnZS5jb250ZXh0VmFsdWUsXG5cdFx0XHRsb2NhdGlvbjogbWVzc2FnZS5sb2NhdGlvbiAmJiAoeyByYW5nZTogUmFuZ2UuZnJvbShtZXNzYWdlLmxvY2F0aW9uLnJhbmdlKSwgdXJpOiBtZXNzYWdlLmxvY2F0aW9uLnVyaSB9KSxcblx0XHRcdHN0YWNrVHJhY2U6IG1lc3NhZ2Uuc3RhY2tUcmFjZT8ubWFwKHMgPT4gKHtcblx0XHRcdFx0bGFiZWw6IHMubGFiZWwsXG5cdFx0XHRcdHBvc2l0aW9uOiBzLnBvc2l0aW9uICYmIFBvc2l0aW9uLmZyb20ocy5wb3NpdGlvbiksXG5cdFx0XHRcdHVyaTogcy51cmkgJiYgVVJJLnJldml2ZShzLnVyaSkudG9KU09OKCksXG5cdFx0XHR9KSksXG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byhpdGVtOiBJVGVzdEVycm9yTWVzc2FnZS5TZXJpYWxpemVkKTogdnNjb2RlLlRlc3RNZXNzYWdlIHtcblx0XHRjb25zdCBtZXNzYWdlID0gbmV3IHR5cGVzLlRlc3RNZXNzYWdlKHR5cGVvZiBpdGVtLm1lc3NhZ2UgPT09ICdzdHJpbmcnID8gaXRlbS5tZXNzYWdlIDogTWFya2Rvd25TdHJpbmcudG8oaXRlbS5tZXNzYWdlKSk7XG5cdFx0bWVzc2FnZS5hY3R1YWxPdXRwdXQgPSBpdGVtLmFjdHVhbDtcblx0XHRtZXNzYWdlLmV4cGVjdGVkT3V0cHV0ID0gaXRlbS5leHBlY3RlZDtcblx0XHRtZXNzYWdlLmNvbnRleHRWYWx1ZSA9IGl0ZW0uY29udGV4dFZhbHVlO1xuXHRcdG1lc3NhZ2UubG9jYXRpb24gPSBpdGVtLmxvY2F0aW9uID8gbG9jYXRpb24udG8oaXRlbS5sb2NhdGlvbikgOiB1bmRlZmluZWQ7XG5cdFx0cmV0dXJuIG1lc3NhZ2U7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBUZXN0VGFnIHtcblx0ZXhwb3J0IGNvbnN0IG5hbWVzcGFjZSA9IG5hbWVzcGFjZVRlc3RUYWc7XG5cblx0ZXhwb3J0IGNvbnN0IGRlbmFtZXNwYWNlID0gZGVuYW1lc3BhY2VUZXN0VGFnO1xufVxuXG5leHBvcnQgbmFtZXNwYWNlIFRlc3RSdW5Qcm9maWxlIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oaXRlbTogdHlwZXMuVGVzdFJ1blByb2ZpbGVCYXNlKTogSVRlc3RSdW5Qcm9maWxlUmVmZXJlbmNlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Y29udHJvbGxlcklkOiBpdGVtLmNvbnRyb2xsZXJJZCxcblx0XHRcdHByb2ZpbGVJZDogaXRlbS5wcm9maWxlSWQsXG5cdFx0XHRncm91cDogVGVzdFJ1blByb2ZpbGVLaW5kLmZyb20oaXRlbS5raW5kKSxcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgVGVzdFJ1blByb2ZpbGVLaW5kIHtcblx0Y29uc3QgcHJvZmlsZUdyb3VwVG9CaXRzZXQ6IHsgW0sgaW4gdnNjb2RlLlRlc3RSdW5Qcm9maWxlS2luZF06IFRlc3RSdW5Qcm9maWxlQml0c2V0IH0gPSB7XG5cdFx0W3R5cGVzLlRlc3RSdW5Qcm9maWxlS2luZC5Db3ZlcmFnZV06IFRlc3RSdW5Qcm9maWxlQml0c2V0LkNvdmVyYWdlLFxuXHRcdFt0eXBlcy5UZXN0UnVuUHJvZmlsZUtpbmQuRGVidWddOiBUZXN0UnVuUHJvZmlsZUJpdHNldC5EZWJ1Zyxcblx0XHRbdHlwZXMuVGVzdFJ1blByb2ZpbGVLaW5kLlJ1bl06IFRlc3RSdW5Qcm9maWxlQml0c2V0LlJ1bixcblx0fTtcblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShraW5kOiB0eXBlcy5UZXN0UnVuUHJvZmlsZUtpbmQpOiBUZXN0UnVuUHJvZmlsZUJpdHNldCB7XG5cdFx0cmV0dXJuIHByb2ZpbGVHcm91cFRvQml0c2V0Lmhhc093blByb3BlcnR5KGtpbmQpID8gcHJvZmlsZUdyb3VwVG9CaXRzZXRba2luZF0gOiBUZXN0UnVuUHJvZmlsZUJpdHNldC5SdW47XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBUZXN0SXRlbSB7XG5cdGV4cG9ydCB0eXBlIFJhdyA9IHZzY29kZS5UZXN0SXRlbTtcblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShpdGVtOiB2c2NvZGUuVGVzdEl0ZW0pOiBJVGVzdEl0ZW0ge1xuXHRcdGNvbnN0IGN0cmxJZCA9IGdldFByaXZhdGVBcGlGb3IoaXRlbSkuY29udHJvbGxlcklkO1xuXHRcdHJldHVybiB7XG5cdFx0XHRleHRJZDogVGVzdElkLmZyb21FeHRIb3N0VGVzdEl0ZW0oaXRlbSwgY3RybElkKS50b1N0cmluZygpLFxuXHRcdFx0bGFiZWw6IGl0ZW0ubGFiZWwsXG5cdFx0XHR1cmk6IFVSSS5yZXZpdmUoaXRlbS51cmkpLFxuXHRcdFx0YnVzeTogaXRlbS5idXN5LFxuXHRcdFx0dGFnczogaXRlbS50YWdzLm1hcCh0ID0+IFRlc3RUYWcubmFtZXNwYWNlKGN0cmxJZCwgdC5pZCkpLFxuXHRcdFx0cmFuZ2U6IGVkaXRvclJhbmdlLlJhbmdlLmxpZnQoUmFuZ2UuZnJvbShpdGVtLnJhbmdlKSksXG5cdFx0XHRkZXNjcmlwdGlvbjogaXRlbS5kZXNjcmlwdGlvbiB8fCBudWxsLFxuXHRcdFx0c29ydFRleHQ6IGl0ZW0uc29ydFRleHQgfHwgbnVsbCxcblx0XHRcdGVycm9yOiBpdGVtLmVycm9yID8gKE1hcmtkb3duU3RyaW5nLmZyb21TdHJpY3QoaXRlbS5lcnJvcikgfHwgbnVsbCkgOiBudWxsLFxuXHRcdH07XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdG9QbGFpbihpdGVtOiBJVGVzdEl0ZW0uU2VyaWFsaXplZCk6IHZzY29kZS5UZXN0SXRlbSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHBhcmVudDogdW5kZWZpbmVkLFxuXHRcdFx0ZXJyb3I6IHVuZGVmaW5lZCxcblx0XHRcdGlkOiBUZXN0SWQuZnJvbVN0cmluZyhpdGVtLmV4dElkKS5sb2NhbElkLFxuXHRcdFx0bGFiZWw6IGl0ZW0ubGFiZWwsXG5cdFx0XHR1cmk6IFVSSS5yZXZpdmUoaXRlbS51cmkpLFxuXHRcdFx0dGFnczogKGl0ZW0udGFncyB8fCBbXSkubWFwKHQgPT4ge1xuXHRcdFx0XHRjb25zdCB7IHRhZ0lkIH0gPSBUZXN0VGFnLmRlbmFtZXNwYWNlKHQpO1xuXHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLlRlc3RUYWcodGFnSWQpO1xuXHRcdFx0fSksXG5cdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRhZGQ6ICgpID0+IHsgfSxcblx0XHRcdFx0ZGVsZXRlOiAoKSA9PiB7IH0sXG5cdFx0XHRcdGZvckVhY2g6ICgpID0+IHsgfSxcblx0XHRcdFx0KltTeW1ib2wuaXRlcmF0b3JdKCkgeyB9LFxuXHRcdFx0XHRnZXQ6ICgpID0+IHVuZGVmaW5lZCxcblx0XHRcdFx0cmVwbGFjZTogKCkgPT4geyB9LFxuXHRcdFx0XHRzaXplOiAwLFxuXHRcdFx0fSxcblx0XHRcdHJhbmdlOiBSYW5nZS50byhpdGVtLnJhbmdlIHx8IHVuZGVmaW5lZCksXG5cdFx0XHRjYW5SZXNvbHZlQ2hpbGRyZW46IGZhbHNlLFxuXHRcdFx0YnVzeTogaXRlbS5idXN5LFxuXHRcdFx0ZGVzY3JpcHRpb246IGl0ZW0uZGVzY3JpcHRpb24gfHwgdW5kZWZpbmVkLFxuXHRcdFx0c29ydFRleHQ6IGl0ZW0uc29ydFRleHQgfHwgdW5kZWZpbmVkLFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBUZXN0VGFnIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20odGFnOiB2c2NvZGUuVGVzdFRhZyk6IElUZXN0VGFnIHtcblx0XHRyZXR1cm4geyBpZDogdGFnLmlkIH07XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdG8odGFnOiBJVGVzdFRhZyk6IHZzY29kZS5UZXN0VGFnIHtcblx0XHRyZXR1cm4gbmV3IHR5cGVzLlRlc3RUYWcodGFnLmlkKTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIFRlc3RSZXN1bHRzIHtcblx0Y29uc3QgY29udmVydFRlc3RSZXN1bHRJdGVtID0gKG5vZGU6IElQcmVmaXhUcmVlTm9kZTxUZXN0UmVzdWx0SXRlbS5TZXJpYWxpemVkPiwgcGFyZW50PzogdnNjb2RlLlRlc3RSZXN1bHRTbmFwc2hvdCk6IHZzY29kZS5UZXN0UmVzdWx0U25hcHNob3QgfCB1bmRlZmluZWQgPT4ge1xuXHRcdGNvbnN0IGl0ZW0gPSBub2RlLnZhbHVlO1xuXHRcdGlmICghaXRlbSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDsgLy8gc2hvdWxkIGJlIHVucmVhY2hhYmxlXG5cdFx0fVxuXG5cdFx0Y29uc3Qgc25hcHNob3Q6IHZzY29kZS5UZXN0UmVzdWx0U25hcHNob3QgPSAoe1xuXHRcdFx0Li4uVGVzdEl0ZW0udG9QbGFpbihpdGVtLml0ZW0pLFxuXHRcdFx0cGFyZW50LFxuXHRcdFx0dGFza1N0YXRlczogaXRlbS50YXNrcy5tYXAodCA9PiAoe1xuXHRcdFx0XHRzdGF0ZTogdC5zdGF0ZSBhcyBudW1iZXIgYXMgdHlwZXMuVGVzdFJlc3VsdFN0YXRlLFxuXHRcdFx0XHRkdXJhdGlvbjogdC5kdXJhdGlvbixcblx0XHRcdFx0bWVzc2FnZXM6IHQubWVzc2FnZXNcblx0XHRcdFx0XHQuZmlsdGVyKChtKTogbSBpcyBJVGVzdEVycm9yTWVzc2FnZS5TZXJpYWxpemVkID0+IG0udHlwZSA9PT0gVGVzdE1lc3NhZ2VUeXBlLkVycm9yKVxuXHRcdFx0XHRcdC5tYXAoVGVzdE1lc3NhZ2UudG8pLFxuXHRcdFx0fSkpLFxuXHRcdFx0Y2hpbGRyZW46IFtdLFxuXHRcdH0pO1xuXG5cdFx0aWYgKG5vZGUuY2hpbGRyZW4pIHtcblx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbi52YWx1ZXMoKSkge1xuXHRcdFx0XHRjb25zdCBjID0gY29udmVydFRlc3RSZXN1bHRJdGVtKGNoaWxkLCBzbmFwc2hvdCk7XG5cdFx0XHRcdGlmIChjKSB7XG5cdFx0XHRcdFx0c25hcHNob3QuY2hpbGRyZW4ucHVzaChjKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBzbmFwc2hvdDtcblx0fTtcblxuXHRleHBvcnQgZnVuY3Rpb24gdG8oc2VyaWFsaXplZDogSVNlcmlhbGl6ZWRUZXN0UmVzdWx0cyk6IHZzY29kZS5UZXN0UnVuUmVzdWx0IHtcblx0XHRjb25zdCB0cmVlID0gbmV3IFdlbGxEZWZpbmVkUHJlZml4VHJlZTxUZXN0UmVzdWx0SXRlbS5TZXJpYWxpemVkPigpO1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBzZXJpYWxpemVkLml0ZW1zKSB7XG5cdFx0XHR0cmVlLmluc2VydChUZXN0SWQuZnJvbVN0cmluZyhpdGVtLml0ZW0uZXh0SWQpLnBhdGgsIGl0ZW0pO1xuXHRcdH1cblxuXHRcdC8vIEdldCB0aGUgZmlyc3Qgbm9kZSB3aXRoIGEgdmFsdWUgaW4gZWFjaCBzdWJ0cmVlIG9mIElEcy5cblx0XHRjb25zdCBxdWV1ZSA9IFt0cmVlLm5vZGVzXTtcblx0XHRjb25zdCByb290czogSVByZWZpeFRyZWVOb2RlPFRlc3RSZXN1bHRJdGVtLlNlcmlhbGl6ZWQ+W10gPSBbXTtcblx0XHR3aGlsZSAocXVldWUubGVuZ3RoKSB7XG5cdFx0XHRmb3IgKGNvbnN0IG5vZGUgb2YgcXVldWUucG9wKCkhKSB7XG5cdFx0XHRcdGlmIChub2RlLnZhbHVlKSB7XG5cdFx0XHRcdFx0cm9vdHMucHVzaChub2RlKTtcblx0XHRcdFx0fSBlbHNlIGlmIChub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0cXVldWUucHVzaChub2RlLmNoaWxkcmVuLnZhbHVlcygpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRjb21wbGV0ZWRBdDogc2VyaWFsaXplZC5jb21wbGV0ZWRBdCxcblx0XHRcdHJlc3VsdHM6IHJvb3RzLm1hcChyID0+IGNvbnZlcnRUZXN0UmVzdWx0SXRlbShyKSkuZmlsdGVyKGlzRGVmaW5lZCksXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIFRlc3RDb3ZlcmFnZSB7XG5cdGZ1bmN0aW9uIGZyb21Db3ZlcmFnZUNvdW50KGNvdW50OiB2c2NvZGUuVGVzdENvdmVyYWdlQ291bnQpOiBJQ292ZXJhZ2VDb3VudCB7XG5cdFx0cmV0dXJuIHsgY292ZXJlZDogY291bnQuY292ZXJlZCwgdG90YWw6IGNvdW50LnRvdGFsIH07XG5cdH1cblxuXHRmdW5jdGlvbiBmcm9tTG9jYXRpb24obG9jYXRpb246IHZzY29kZS5SYW5nZSB8IHZzY29kZS5Qb3NpdGlvbikge1xuXHRcdHJldHVybiAnbGluZScgaW4gbG9jYXRpb24gPyBQb3NpdGlvbi5mcm9tKGxvY2F0aW9uKSA6IFJhbmdlLmZyb20obG9jYXRpb24pO1xuXHR9XG5cblx0ZnVuY3Rpb24gdG9Mb2NhdGlvbihsb2NhdGlvbjogSVBvc2l0aW9uIHwgZWRpdG9yUmFuZ2UuSVJhbmdlKTogdHlwZXMuUG9zaXRpb24gfCB0eXBlcy5SYW5nZTtcblx0ZnVuY3Rpb24gdG9Mb2NhdGlvbihsb2NhdGlvbjogSVBvc2l0aW9uIHwgZWRpdG9yUmFuZ2UuSVJhbmdlIHwgdW5kZWZpbmVkKTogdHlwZXMuUG9zaXRpb24gfCB0eXBlcy5SYW5nZSB8IHVuZGVmaW5lZDtcblx0ZnVuY3Rpb24gdG9Mb2NhdGlvbihsb2NhdGlvbjogSVBvc2l0aW9uIHwgZWRpdG9yUmFuZ2UuSVJhbmdlIHwgdW5kZWZpbmVkKTogdHlwZXMuUG9zaXRpb24gfCB0eXBlcy5SYW5nZSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCFsb2NhdGlvbikgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdFx0cmV0dXJuICdlbmRMaW5lTnVtYmVyJyBpbiBsb2NhdGlvbiA/IFJhbmdlLnRvKGxvY2F0aW9uKSA6IFBvc2l0aW9uLnRvKGxvY2F0aW9uKTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byhzZXJpYWxpemVkOiBDb3ZlcmFnZURldGFpbHMuU2VyaWFsaXplZCk6IHZzY29kZS5GaWxlQ292ZXJhZ2VEZXRhaWwge1xuXHRcdGlmIChzZXJpYWxpemVkLnR5cGUgPT09IERldGFpbFR5cGUuU3RhdGVtZW50KSB7XG5cdFx0XHRjb25zdCBicmFuY2hlczogdnNjb2RlLkJyYW5jaENvdmVyYWdlW10gPSBbXTtcblx0XHRcdGlmIChzZXJpYWxpemVkLmJyYW5jaGVzKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgYnJhbmNoIG9mIHNlcmlhbGl6ZWQuYnJhbmNoZXMpIHtcblx0XHRcdFx0XHRicmFuY2hlcy5wdXNoKHtcblx0XHRcdFx0XHRcdGV4ZWN1dGVkOiBicmFuY2guY291bnQsXG5cdFx0XHRcdFx0XHRsb2NhdGlvbjogdG9Mb2NhdGlvbihicmFuY2gubG9jYXRpb24pLFxuXHRcdFx0XHRcdFx0bGFiZWw6IGJyYW5jaC5sYWJlbFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbmV3IHR5cGVzLlN0YXRlbWVudENvdmVyYWdlKFxuXHRcdFx0XHRzZXJpYWxpemVkLmNvdW50LFxuXHRcdFx0XHR0b0xvY2F0aW9uKHNlcmlhbGl6ZWQubG9jYXRpb24pLFxuXHRcdFx0XHRzZXJpYWxpemVkLmJyYW5jaGVzPy5tYXAoYiA9PiBuZXcgdHlwZXMuQnJhbmNoQ292ZXJhZ2UoXG5cdFx0XHRcdFx0Yi5jb3VudCxcblx0XHRcdFx0XHR0b0xvY2F0aW9uKGIubG9jYXRpb24pISxcblx0XHRcdFx0XHRiLmxhYmVsLFxuXHRcdFx0XHQpKVxuXHRcdFx0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5EZWNsYXJhdGlvbkNvdmVyYWdlKFxuXHRcdFx0XHRzZXJpYWxpemVkLm5hbWUsXG5cdFx0XHRcdHNlcmlhbGl6ZWQuY291bnQsXG5cdFx0XHRcdHRvTG9jYXRpb24oc2VyaWFsaXplZC5sb2NhdGlvbiksXG5cdFx0XHQpO1xuXHRcdH1cblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tRGV0YWlscyhjb3ZlcmFnZTogdnNjb2RlLkZpbGVDb3ZlcmFnZURldGFpbCk6IENvdmVyYWdlRGV0YWlscy5TZXJpYWxpemVkIHtcblx0XHRpZiAodHlwZW9mIGNvdmVyYWdlLmV4ZWN1dGVkID09PSAnbnVtYmVyJyAmJiBjb3ZlcmFnZS5leGVjdXRlZCA8IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBjb3ZlcmFnZSBjb3VudCAke2NvdmVyYWdlLmV4ZWN1dGVkfWApO1xuXHRcdH1cblxuXHRcdGlmICgnYnJhbmNoZXMnIGluIGNvdmVyYWdlKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjb3VudDogY292ZXJhZ2UuZXhlY3V0ZWQsXG5cdFx0XHRcdGxvY2F0aW9uOiBmcm9tTG9jYXRpb24oY292ZXJhZ2UubG9jYXRpb24pLFxuXHRcdFx0XHR0eXBlOiBEZXRhaWxUeXBlLlN0YXRlbWVudCxcblx0XHRcdFx0YnJhbmNoZXM6IGNvdmVyYWdlLmJyYW5jaGVzLmxlbmd0aFxuXHRcdFx0XHRcdD8gY292ZXJhZ2UuYnJhbmNoZXMubWFwKGIgPT4gKHsgY291bnQ6IGIuZXhlY3V0ZWQsIGxvY2F0aW9uOiBiLmxvY2F0aW9uICYmIGZyb21Mb2NhdGlvbihiLmxvY2F0aW9uKSwgbGFiZWw6IGIubGFiZWwgfSkpXG5cdFx0XHRcdFx0OiB1bmRlZmluZWQsXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0eXBlOiBEZXRhaWxUeXBlLkRlY2xhcmF0aW9uLFxuXHRcdFx0XHRuYW1lOiBjb3ZlcmFnZS5uYW1lLFxuXHRcdFx0XHRjb3VudDogY292ZXJhZ2UuZXhlY3V0ZWQsXG5cdFx0XHRcdGxvY2F0aW9uOiBmcm9tTG9jYXRpb24oY292ZXJhZ2UubG9jYXRpb24pLFxuXHRcdFx0fTtcblx0XHR9XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbUZpbGUoY29udHJvbGxlcklkOiBzdHJpbmcsIGlkOiBzdHJpbmcsIGNvdmVyYWdlOiB2c2NvZGUuRmlsZUNvdmVyYWdlKTogSUZpbGVDb3ZlcmFnZS5TZXJpYWxpemVkIHtcblx0XHR0eXBlcy52YWxpZGF0ZVRlc3RDb3ZlcmFnZUNvdW50KGNvdmVyYWdlLnN0YXRlbWVudENvdmVyYWdlKTtcblx0XHR0eXBlcy52YWxpZGF0ZVRlc3RDb3ZlcmFnZUNvdW50KGNvdmVyYWdlLmJyYW5jaENvdmVyYWdlKTtcblx0XHR0eXBlcy52YWxpZGF0ZVRlc3RDb3ZlcmFnZUNvdW50KGNvdmVyYWdlLmRlY2xhcmF0aW9uQ292ZXJhZ2UpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkLFxuXHRcdFx0dXJpOiBjb3ZlcmFnZS51cmksXG5cdFx0XHRzdGF0ZW1lbnQ6IGZyb21Db3ZlcmFnZUNvdW50KGNvdmVyYWdlLnN0YXRlbWVudENvdmVyYWdlKSxcblx0XHRcdGJyYW5jaDogY292ZXJhZ2UuYnJhbmNoQ292ZXJhZ2UgJiYgZnJvbUNvdmVyYWdlQ291bnQoY292ZXJhZ2UuYnJhbmNoQ292ZXJhZ2UpLFxuXHRcdFx0ZGVjbGFyYXRpb246IGNvdmVyYWdlLmRlY2xhcmF0aW9uQ292ZXJhZ2UgJiYgZnJvbUNvdmVyYWdlQ291bnQoY292ZXJhZ2UuZGVjbGFyYXRpb25Db3ZlcmFnZSksXG5cdFx0XHR0ZXN0SWRzOiBjb3ZlcmFnZSBpbnN0YW5jZW9mIHR5cGVzLkZpbGVDb3ZlcmFnZSAmJiBjb3ZlcmFnZS5pbmNsdWRlc1Rlc3RzLmxlbmd0aCA/XG5cdFx0XHRcdGNvdmVyYWdlLmluY2x1ZGVzVGVzdHMubWFwKHQgPT4gVGVzdElkLmZyb21FeHRIb3N0VGVzdEl0ZW0odCwgY29udHJvbGxlcklkKS50b1N0cmluZygpKSA6IHVuZGVmaW5lZCxcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgQ29kZUFjdGlvblRyaWdnZXJLaW5kIHtcblxuXHRleHBvcnQgZnVuY3Rpb24gdG8odmFsdWU6IGxhbmd1YWdlcy5Db2RlQWN0aW9uVHJpZ2dlclR5cGUpOiB0eXBlcy5Db2RlQWN0aW9uVHJpZ2dlcktpbmQge1xuXHRcdHN3aXRjaCAodmFsdWUpIHtcblx0XHRcdGNhc2UgbGFuZ3VhZ2VzLkNvZGVBY3Rpb25UcmlnZ2VyVHlwZS5JbnZva2U6XG5cdFx0XHRcdHJldHVybiB0eXBlcy5Db2RlQWN0aW9uVHJpZ2dlcktpbmQuSW52b2tlO1xuXG5cdFx0XHRjYXNlIGxhbmd1YWdlcy5Db2RlQWN0aW9uVHJpZ2dlclR5cGUuQXV0bzpcblx0XHRcdFx0cmV0dXJuIHR5cGVzLkNvZGVBY3Rpb25UcmlnZ2VyS2luZC5BdXRvbWF0aWM7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgVHlwZUhpZXJhcmNoeUl0ZW0ge1xuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byhpdGVtOiBleHRIb3N0UHJvdG9jb2wuSVR5cGVIaWVyYXJjaHlJdGVtRHRvKTogdHlwZXMuVHlwZUhpZXJhcmNoeUl0ZW0ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IG5ldyB0eXBlcy5UeXBlSGllcmFyY2h5SXRlbShcblx0XHRcdFN5bWJvbEtpbmQudG8oaXRlbS5raW5kKSxcblx0XHRcdGl0ZW0ubmFtZSxcblx0XHRcdGl0ZW0uZGV0YWlsIHx8ICcnLFxuXHRcdFx0VVJJLnJldml2ZShpdGVtLnVyaSksXG5cdFx0XHRSYW5nZS50byhpdGVtLnJhbmdlKSxcblx0XHRcdFJhbmdlLnRvKGl0ZW0uc2VsZWN0aW9uUmFuZ2UpXG5cdFx0KTtcblxuXHRcdHJlc3VsdC5fc2Vzc2lvbklkID0gaXRlbS5fc2Vzc2lvbklkO1xuXHRcdHJlc3VsdC5faXRlbUlkID0gaXRlbS5faXRlbUlkO1xuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGl0ZW06IHZzY29kZS5UeXBlSGllcmFyY2h5SXRlbSwgc2Vzc2lvbklkPzogc3RyaW5nLCBpdGVtSWQ/OiBzdHJpbmcpOiBleHRIb3N0UHJvdG9jb2wuSVR5cGVIaWVyYXJjaHlJdGVtRHRvIHtcblxuXHRcdHNlc3Npb25JZCA9IHNlc3Npb25JZCA/PyAoPHR5cGVzLlR5cGVIaWVyYXJjaHlJdGVtPml0ZW0pLl9zZXNzaW9uSWQ7XG5cdFx0aXRlbUlkID0gaXRlbUlkID8/ICg8dHlwZXMuVHlwZUhpZXJhcmNoeUl0ZW0+aXRlbSkuX2l0ZW1JZDtcblxuXHRcdGlmIChzZXNzaW9uSWQgPT09IHVuZGVmaW5lZCB8fCBpdGVtSWQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIGl0ZW0nKTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0X3Nlc3Npb25JZDogc2Vzc2lvbklkLFxuXHRcdFx0X2l0ZW1JZDogaXRlbUlkLFxuXHRcdFx0a2luZDogU3ltYm9sS2luZC5mcm9tKGl0ZW0ua2luZCksXG5cdFx0XHRuYW1lOiBpdGVtLm5hbWUsXG5cdFx0XHRkZXRhaWw6IGl0ZW0uZGV0YWlsID8/ICcnLFxuXHRcdFx0dXJpOiBpdGVtLnVyaSxcblx0XHRcdHJhbmdlOiBSYW5nZS5mcm9tKGl0ZW0ucmFuZ2UpLFxuXHRcdFx0c2VsZWN0aW9uUmFuZ2U6IFJhbmdlLmZyb20oaXRlbS5zZWxlY3Rpb25SYW5nZSksXG5cdFx0XHR0YWdzOiBpdGVtLnRhZ3M/Lm1hcChTeW1ib2xUYWcuZnJvbSlcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgVmlld0JhZGdlIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oYmFkZ2U6IHZzY29kZS5WaWV3QmFkZ2UgfCB1bmRlZmluZWQpOiBJVmlld0JhZGdlIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIWJhZGdlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHR2YWx1ZTogYmFkZ2UudmFsdWUsXG5cdFx0XHR0b29sdGlwOiBiYWRnZS50b29sdGlwXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIERhdGFUcmFuc2Zlckl0ZW0ge1xuXHRleHBvcnQgZnVuY3Rpb24gdG8obWltZTogc3RyaW5nLCBpdGVtOiBleHRIb3N0UHJvdG9jb2wuRGF0YVRyYW5zZmVySXRlbURUTywgcmVzb2x2ZUZpbGVEYXRhOiAoaWQ6IHN0cmluZykgPT4gUHJvbWlzZTxVaW50OEFycmF5Pik6IHR5cGVzLkRhdGFUcmFuc2Zlckl0ZW0ge1xuXHRcdGNvbnN0IGZpbGUgPSBpdGVtLmZpbGVEYXRhO1xuXHRcdGlmIChmaWxlKSB7XG5cdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkludGVybmFsRmlsZURhdGFUcmFuc2Zlckl0ZW0oXG5cdFx0XHRcdG5ldyB0eXBlcy5EYXRhVHJhbnNmZXJGaWxlKGZpbGUubmFtZSwgVVJJLnJldml2ZShmaWxlLnVyaSksIGZpbGUuaWQsIGNyZWF0ZVNpbmdsZUNhbGxGdW5jdGlvbigoKSA9PiByZXNvbHZlRmlsZURhdGEoZmlsZS5pZCkpKSk7XG5cdFx0fVxuXG5cdFx0aWYgKG1pbWUgPT09IE1pbWVzLnVyaUxpc3QgJiYgaXRlbS51cmlMaXN0RGF0YSkge1xuXHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5JbnRlcm5hbERhdGFUcmFuc2Zlckl0ZW0ocmV2aXZlVXJpTGlzdChpdGVtLnVyaUxpc3REYXRhKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyB0eXBlcy5JbnRlcm5hbERhdGFUcmFuc2Zlckl0ZW0oaXRlbS5hc1N0cmluZyk7XG5cdH1cblxuXHRleHBvcnQgYXN5bmMgZnVuY3Rpb24gZnJvbShtaW1lOiBzdHJpbmcsIGl0ZW06IHZzY29kZS5EYXRhVHJhbnNmZXJJdGVtIHwgSURhdGFUcmFuc2Zlckl0ZW0sIGlkOiBzdHJpbmcgPSBnZW5lcmF0ZVV1aWQoKSk6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLkRhdGFUcmFuc2Zlckl0ZW1EVE8+IHtcblx0XHRjb25zdCBzdHJpbmdWYWx1ZSA9IGF3YWl0IGl0ZW0uYXNTdHJpbmcoKTtcblxuXHRcdGlmIChtaW1lID09PSBNaW1lcy51cmlMaXN0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpZCxcblx0XHRcdFx0YXNTdHJpbmc6IHN0cmluZ1ZhbHVlLFxuXHRcdFx0XHRmaWxlRGF0YTogdW5kZWZpbmVkLFxuXHRcdFx0XHR1cmlMaXN0RGF0YTogc2VyaWFsaXplVXJpTGlzdChzdHJpbmdWYWx1ZSksXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpbGVWYWx1ZSA9IGl0ZW0uYXNGaWxlKCk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkLFxuXHRcdFx0YXNTdHJpbmc6IHN0cmluZ1ZhbHVlLFxuXHRcdFx0ZmlsZURhdGE6IGZpbGVWYWx1ZSA/IHtcblx0XHRcdFx0bmFtZTogZmlsZVZhbHVlLm5hbWUsXG5cdFx0XHRcdHVyaTogZmlsZVZhbHVlLnVyaSxcblx0XHRcdFx0aWQ6IChmaWxlVmFsdWUgYXMgdHlwZXMuRGF0YVRyYW5zZmVyRmlsZSkuX2l0ZW1JZCA/PyAoZmlsZVZhbHVlIGFzIElEYXRhVHJhbnNmZXJGaWxlKS5pZCxcblx0XHRcdH0gOiB1bmRlZmluZWQsXG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIHNlcmlhbGl6ZVVyaUxpc3Qoc3RyaW5nVmFsdWU6IHN0cmluZyk6IFJlYWRvbmx5QXJyYXk8c3RyaW5nIHwgVVJJPiB7XG5cdFx0cmV0dXJuIFVyaUxpc3Quc3BsaXQoc3RyaW5nVmFsdWUpLm1hcChwYXJ0ID0+IHtcblx0XHRcdGlmIChwYXJ0LnN0YXJ0c1dpdGgoJyMnKSkge1xuXHRcdFx0XHRyZXR1cm4gcGFydDtcblx0XHRcdH1cblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmV0dXJuIFVSSS5wYXJzZShwYXJ0KTtcblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHQvLyBub29wXG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBwYXJ0O1xuXHRcdH0pO1xuXHR9XG5cblx0ZnVuY3Rpb24gcmV2aXZlVXJpTGlzdChwYXJ0czogUmVhZG9ubHlBcnJheTxzdHJpbmcgfCBVcmlDb21wb25lbnRzPik6IHN0cmluZyB7XG5cdFx0cmV0dXJuIFVyaUxpc3QuY3JlYXRlKHBhcnRzLm1hcChwYXJ0ID0+IHtcblx0XHRcdHJldHVybiB0eXBlb2YgcGFydCA9PT0gJ3N0cmluZycgPyBwYXJ0IDogVVJJLnJldml2ZShwYXJ0KTtcblx0XHR9KSk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBEYXRhVHJhbnNmZXIge1xuXHRleHBvcnQgZnVuY3Rpb24gdG9EYXRhVHJhbnNmZXIodmFsdWU6IGV4dEhvc3RQcm90b2NvbC5EYXRhVHJhbnNmZXJEVE8sIHJlc29sdmVGaWxlRGF0YTogKGl0ZW1JZDogc3RyaW5nKSA9PiBQcm9taXNlPFVpbnQ4QXJyYXk+KTogdHlwZXMuRGF0YVRyYW5zZmVyIHtcblx0XHRjb25zdCBpbml0ID0gdmFsdWUuaXRlbXMubWFwKChbdHlwZSwgaXRlbV0pID0+IHtcblx0XHRcdHJldHVybiBbdHlwZSwgRGF0YVRyYW5zZmVySXRlbS50byh0eXBlLCBpdGVtLCByZXNvbHZlRmlsZURhdGEpXSBhcyBjb25zdDtcblx0XHR9KTtcblx0XHRyZXR1cm4gbmV3IHR5cGVzLkRhdGFUcmFuc2Zlcihpbml0KTtcblx0fVxuXG5cdGV4cG9ydCBhc3luYyBmdW5jdGlvbiBmcm9tKGRhdGFUcmFuc2ZlcjogdnNjb2RlLkRhdGFUcmFuc2Zlcik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLkRhdGFUcmFuc2ZlckRUTz4ge1xuXHRcdGNvbnN0IGl0ZW1zID0gYXdhaXQgUHJvbWlzZS5hbGwoQXJyYXkuZnJvbShkYXRhVHJhbnNmZXIsIGFzeW5jIChbbWltZSwgdmFsdWVdKSA9PiB7XG5cdFx0XHRyZXR1cm4gW21pbWUsIGF3YWl0IERhdGFUcmFuc2Zlckl0ZW0uZnJvbShtaW1lLCB2YWx1ZSldIGFzIGNvbnN0O1xuXHRcdH0pKTtcblxuXHRcdHJldHVybiB7IGl0ZW1zIH07XG5cdH1cblxuXHRleHBvcnQgYXN5bmMgZnVuY3Rpb24gZnJvbUxpc3QoZGF0YVRyYW5zZmVyOiBJdGVyYWJsZTxyZWFkb25seSBbc3RyaW5nLCBJRGF0YVRyYW5zZmVySXRlbV0+KTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuRGF0YVRyYW5zZmVyRFRPPiB7XG5cdFx0Y29uc3QgaXRlbXMgPSBhd2FpdCBQcm9taXNlLmFsbChBcnJheS5mcm9tKGRhdGFUcmFuc2ZlciwgYXN5bmMgKFttaW1lLCB2YWx1ZV0pID0+IHtcblx0XHRcdHJldHVybiBbbWltZSwgYXdhaXQgRGF0YVRyYW5zZmVySXRlbS5mcm9tKG1pbWUsIHZhbHVlLCB2YWx1ZS5pZCldIGFzIGNvbnN0O1xuXHRcdH0pKTtcblxuXHRcdHJldHVybiB7IGl0ZW1zIH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDaGF0Rm9sbG93dXAge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShmb2xsb3d1cDogdnNjb2RlLkNoYXRGb2xsb3d1cCwgcmVxdWVzdDogSUNoYXRBZ2VudFJlcXVlc3QgfCB1bmRlZmluZWQpOiBJQ2hhdEZvbGxvd3VwIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0a2luZDogJ3JlcGx5Jyxcblx0XHRcdGFnZW50SWQ6IGZvbGxvd3VwLnBhcnRpY2lwYW50ID8/IHJlcXVlc3Q/LmFnZW50SWQgPz8gJycsXG5cdFx0XHRzdWJDb21tYW5kOiBmb2xsb3d1cC5jb21tYW5kID8/IHJlcXVlc3Q/LmNvbW1hbmQsXG5cdFx0XHRtZXNzYWdlOiBmb2xsb3d1cC5wcm9tcHQsXG5cdFx0XHR0aXRsZTogZm9sbG93dXAubGFiZWxcblx0XHR9O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKGZvbGxvd3VwOiBJQ2hhdEZvbGxvd3VwKTogdnNjb2RlLkNoYXRGb2xsb3d1cCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHByb21wdDogZm9sbG93dXAubWVzc2FnZSxcblx0XHRcdGxhYmVsOiBmb2xsb3d1cC50aXRsZSxcblx0XHRcdHBhcnRpY2lwYW50OiBmb2xsb3d1cC5hZ2VudElkLFxuXHRcdFx0Y29tbWFuZDogZm9sbG93dXAuc3ViQ29tbWFuZCxcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlUm9sZSB7XG5cdGV4cG9ydCBmdW5jdGlvbiB0byhyb2xlOiBjaGF0UHJvdmlkZXIuQ2hhdE1lc3NhZ2VSb2xlKTogdnNjb2RlLkxhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZVJvbGUge1xuXHRcdHN3aXRjaCAocm9sZSkge1xuXHRcdFx0Y2FzZSBjaGF0UHJvdmlkZXIuQ2hhdE1lc3NhZ2VSb2xlLlN5c3RlbTogcmV0dXJuIHR5cGVzLkxhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZVJvbGUuU3lzdGVtO1xuXHRcdFx0Y2FzZSBjaGF0UHJvdmlkZXIuQ2hhdE1lc3NhZ2VSb2xlLlVzZXI6IHJldHVybiB0eXBlcy5MYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2VSb2xlLlVzZXI7XG5cdFx0XHRjYXNlIGNoYXRQcm92aWRlci5DaGF0TWVzc2FnZVJvbGUuQXNzaXN0YW50OiByZXR1cm4gdHlwZXMuTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlUm9sZS5Bc3Npc3RhbnQ7XG5cdFx0fVxuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocm9sZTogdnNjb2RlLkxhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZVJvbGUpOiBjaGF0UHJvdmlkZXIuQ2hhdE1lc3NhZ2VSb2xlIHtcblx0XHRzd2l0Y2ggKHJvbGUpIHtcblx0XHRcdGNhc2UgdHlwZXMuTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlUm9sZS5TeXN0ZW06IHJldHVybiBjaGF0UHJvdmlkZXIuQ2hhdE1lc3NhZ2VSb2xlLlN5c3RlbTtcblx0XHRcdGNhc2UgdHlwZXMuTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlUm9sZS5Vc2VyOiByZXR1cm4gY2hhdFByb3ZpZGVyLkNoYXRNZXNzYWdlUm9sZS5Vc2VyO1xuXHRcdFx0Y2FzZSB0eXBlcy5MYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2VSb2xlLkFzc2lzdGFudDogcmV0dXJuIGNoYXRQcm92aWRlci5DaGF0TWVzc2FnZVJvbGUuQXNzaXN0YW50O1xuXHRcdH1cblx0XHRyZXR1cm4gY2hhdFByb3ZpZGVyLkNoYXRNZXNzYWdlUm9sZS5Vc2VyO1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlIHtcblxuXHRleHBvcnQgZnVuY3Rpb24gdG8obWVzc2FnZTogY2hhdFByb3ZpZGVyLklDaGF0TWVzc2FnZSk6IHZzY29kZS5MYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2Uge1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBtZXNzYWdlLmNvbnRlbnQubWFwKGMgPT4ge1xuXHRcdFx0aWYgKGMudHlwZSA9PT0gJ3RleHQnKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0KGMudmFsdWUpO1xuXHRcdFx0fSBlbHNlIGlmIChjLnR5cGUgPT09ICd0b29sX3Jlc3VsdCcpIHtcblx0XHRcdFx0Y29uc3QgY29udGVudDogKExhbmd1YWdlTW9kZWxUZXh0UGFydCB8IExhbmd1YWdlTW9kZWxQcm9tcHRUc3hQYXJ0KVtdID0gYy52YWx1ZS5tYXAocGFydCA9PiB7XG5cdFx0XHRcdFx0aWYgKHBhcnQudHlwZSA9PT0gJ3RleHQnKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkxhbmd1YWdlTW9kZWxUZXh0UGFydChwYXJ0LnZhbHVlKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5MYW5ndWFnZU1vZGVsUHJvbXB0VHN4UGFydChwYXJ0LnZhbHVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkxhbmd1YWdlTW9kZWxUb29sUmVzdWx0UGFydChjLnRvb2xDYWxsSWQsIGNvbnRlbnQsIGMuaXNFcnJvcik7XG5cdFx0XHR9IGVsc2UgaWYgKGMudHlwZSA9PT0gJ2ltYWdlX3VybCcpIHtcblx0XHRcdFx0Ly8gTm8gaW1hZ2Ugc3VwcG9ydCBmb3IgTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlXG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBuZXcgdHlwZXMuTGFuZ3VhZ2VNb2RlbFRvb2xDYWxsUGFydChjLnRvb2xDYWxsSWQsIGMubmFtZSwgYy5wYXJhbWV0ZXJzKTtcblx0XHRcdH1cblx0XHR9KS5maWx0ZXIoYyA9PiBjICE9PSB1bmRlZmluZWQpO1xuXG5cdFx0Y29uc3Qgcm9sZSA9IExhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZVJvbGUudG8obWVzc2FnZS5yb2xlKTtcblx0XHRjb25zdCByZXN1bHQgPSBuZXcgdHlwZXMuTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlKHJvbGUsIGNvbnRlbnQsIG1lc3NhZ2UubmFtZSk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKG1lc3NhZ2U6IHZzY29kZS5MYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2UpOiBjaGF0UHJvdmlkZXIuSUNoYXRNZXNzYWdlIHtcblxuXHRcdGNvbnN0IHJvbGUgPSBMYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2VSb2xlLmZyb20obWVzc2FnZS5yb2xlKTtcblx0XHRjb25zdCBuYW1lID0gbWVzc2FnZS5uYW1lO1xuXG5cdFx0bGV0IG1lc3NhZ2VDb250ZW50ID0gbWVzc2FnZS5jb250ZW50O1xuXHRcdGlmICh0eXBlb2YgbWVzc2FnZUNvbnRlbnQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRtZXNzYWdlQ29udGVudCA9IFtuZXcgdHlwZXMuTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0KG1lc3NhZ2VDb250ZW50KV07XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udGVudCA9IG1lc3NhZ2VDb250ZW50Lm1hcCgoYyk6IGNoYXRQcm92aWRlci5JQ2hhdE1lc3NhZ2VQYXJ0ID0+IHtcblx0XHRcdGlmIChjIGluc3RhbmNlb2YgdHlwZXMuTGFuZ3VhZ2VNb2RlbFRvb2xSZXN1bHRQYXJ0KSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dHlwZTogJ3Rvb2xfcmVzdWx0Jyxcblx0XHRcdFx0XHR0b29sQ2FsbElkOiBjLmNhbGxJZCxcblx0XHRcdFx0XHR2YWx1ZTogY29hbGVzY2UoYy5jb250ZW50Lm1hcChwYXJ0ID0+IHtcblx0XHRcdFx0XHRcdGlmIChwYXJ0IGluc3RhbmNlb2YgdHlwZXMuTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0KSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3RleHQnLFxuXHRcdFx0XHRcdFx0XHRcdHZhbHVlOiBwYXJ0LnZhbHVlXG5cdFx0XHRcdFx0XHRcdH0gc2F0aXNmaWVzIElDaGF0UmVzcG9uc2VUZXh0UGFydDtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAocGFydCBpbnN0YW5jZW9mIHR5cGVzLkxhbmd1YWdlTW9kZWxQcm9tcHRUc3hQYXJ0KSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3Byb21wdF90c3gnLFxuXHRcdFx0XHRcdFx0XHRcdHZhbHVlOiBwYXJ0LnZhbHVlLFxuXHRcdFx0XHRcdFx0XHR9IHNhdGlzZmllcyBJQ2hhdFJlc3BvbnNlUHJvbXB0VHN4UGFydDtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdC8vIFN0cmlwIHVua25vd24gcGFydHNcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSksXG5cdFx0XHRcdFx0aXNFcnJvcjogYy5pc0Vycm9yXG5cdFx0XHRcdH07XG5cdFx0XHR9IGVsc2UgaWYgKGMgaW5zdGFuY2VvZiB0eXBlcy5MYW5ndWFnZU1vZGVsVG9vbENhbGxQYXJ0KSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dHlwZTogJ3Rvb2xfdXNlJyxcblx0XHRcdFx0XHR0b29sQ2FsbElkOiBjLmNhbGxJZCxcblx0XHRcdFx0XHRuYW1lOiBjLm5hbWUsXG5cdFx0XHRcdFx0cGFyYW1ldGVyczogYy5pbnB1dFxuXHRcdFx0XHR9O1xuXHRcdFx0fSBlbHNlIGlmIChjIGluc3RhbmNlb2YgdHlwZXMuTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0KSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dHlwZTogJ3RleHQnLFxuXHRcdFx0XHRcdHZhbHVlOiBjLnZhbHVlXG5cdFx0XHRcdH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAodHlwZW9mIGMgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXQgbWVzc2FnZSBjb250ZW50IHR5cGUnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dHlwZTogJ3RleHQnLFxuXHRcdFx0XHRcdHZhbHVlOiBjXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cm9sZSxcblx0XHRcdG5hbWUsXG5cdFx0XHRjb250ZW50XG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIExhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZTIge1xuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byhtZXNzYWdlOiBjaGF0UHJvdmlkZXIuSUNoYXRNZXNzYWdlKTogdnNjb2RlLkxhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZTIge1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBtZXNzYWdlLmNvbnRlbnQubWFwKGMgPT4ge1xuXHRcdFx0aWYgKGMudHlwZSA9PT0gJ3RleHQnKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0KGMudmFsdWUpO1xuXHRcdFx0fSBlbHNlIGlmIChjLnR5cGUgPT09ICd0b29sX3Jlc3VsdCcpIHtcblx0XHRcdFx0Y29uc3QgY29udGVudDogKExhbmd1YWdlTW9kZWxUZXh0UGFydCB8IExhbmd1YWdlTW9kZWxQcm9tcHRUc3hQYXJ0KVtdID0gYy52YWx1ZS5tYXAocGFydCA9PiB7XG5cdFx0XHRcdFx0aWYgKHBhcnQudHlwZSA9PT0gJ3RleHQnKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkxhbmd1YWdlTW9kZWxUZXh0UGFydChwYXJ0LnZhbHVlKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5MYW5ndWFnZU1vZGVsUHJvbXB0VHN4UGFydChwYXJ0LnZhbHVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkxhbmd1YWdlTW9kZWxUb29sUmVzdWx0UGFydChjLnRvb2xDYWxsSWQsIGNvbnRlbnQsIGMuaXNFcnJvcik7XG5cdFx0XHR9IGVsc2UgaWYgKGMudHlwZSA9PT0gJ2ltYWdlX3VybCcpIHtcblx0XHRcdFx0Y29uc3QgdmFsdWU6IHZzY29kZS5DaGF0SW1hZ2VQYXJ0ID0ge1xuXHRcdFx0XHRcdG1pbWVUeXBlOiBjLnZhbHVlLm1pbWVUeXBlLFxuXHRcdFx0XHRcdGRhdGE6IGMudmFsdWUuZGF0YS5idWZmZXIsXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5MYW5ndWFnZU1vZGVsRGF0YVBhcnQodmFsdWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5MYW5ndWFnZU1vZGVsVG9vbENhbGxQYXJ0KGMudG9vbENhbGxJZCwgYy5uYW1lLCBjLnBhcmFtZXRlcnMpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGNvbnN0IHJvbGUgPSBMYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2VSb2xlLnRvKG1lc3NhZ2Uucm9sZSk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IHR5cGVzLkxhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZTIocm9sZSwgY29udGVudCwgbWVzc2FnZS5uYW1lKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20obWVzc2FnZTogdnNjb2RlLkxhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZTIpOiBjaGF0UHJvdmlkZXIuSUNoYXRNZXNzYWdlIHtcblxuXHRcdGNvbnN0IHJvbGUgPSBMYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2VSb2xlLmZyb20obWVzc2FnZS5yb2xlKTtcblx0XHRjb25zdCBuYW1lID0gbWVzc2FnZS5uYW1lO1xuXG5cdFx0bGV0IG1lc3NhZ2VDb250ZW50ID0gbWVzc2FnZS5jb250ZW50O1xuXHRcdGlmICh0eXBlb2YgbWVzc2FnZUNvbnRlbnQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRtZXNzYWdlQ29udGVudCA9IFtuZXcgdHlwZXMuTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0KG1lc3NhZ2VDb250ZW50KV07XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udGVudCA9IG1lc3NhZ2VDb250ZW50Lm1hcCgoYyk6IGNoYXRQcm92aWRlci5JQ2hhdE1lc3NhZ2VQYXJ0ID0+IHtcblx0XHRcdGlmIChjIGluc3RhbmNlb2YgdHlwZXMuTGFuZ3VhZ2VNb2RlbFRvb2xSZXN1bHRQYXJ0KSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dHlwZTogJ3Rvb2xfcmVzdWx0Jyxcblx0XHRcdFx0XHR0b29sQ2FsbElkOiBjLmNhbGxJZCxcblx0XHRcdFx0XHR2YWx1ZTogY29hbGVzY2UoYy5jb250ZW50Lm1hcChwYXJ0ID0+IHtcblx0XHRcdFx0XHRcdGlmIChwYXJ0IGluc3RhbmNlb2YgdHlwZXMuTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0KSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3RleHQnLFxuXHRcdFx0XHRcdFx0XHRcdHZhbHVlOiBwYXJ0LnZhbHVlXG5cdFx0XHRcdFx0XHRcdH0gc2F0aXNmaWVzIElDaGF0UmVzcG9uc2VUZXh0UGFydDtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAocGFydCBpbnN0YW5jZW9mIHR5cGVzLkxhbmd1YWdlTW9kZWxQcm9tcHRUc3hQYXJ0KSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3Byb21wdF90c3gnLFxuXHRcdFx0XHRcdFx0XHRcdHZhbHVlOiBwYXJ0LnZhbHVlLFxuXHRcdFx0XHRcdFx0XHR9IHNhdGlzZmllcyBJQ2hhdFJlc3BvbnNlUHJvbXB0VHN4UGFydDtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdC8vIFN0cmlwIHVua25vd24gcGFydHNcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSksXG5cdFx0XHRcdFx0aXNFcnJvcjogYy5pc0Vycm9yXG5cdFx0XHRcdH07XG5cdFx0XHR9IGVsc2UgaWYgKGMgaW5zdGFuY2VvZiB0eXBlcy5MYW5ndWFnZU1vZGVsRGF0YVBhcnQpIHtcblx0XHRcdFx0Y29uc3QgdmFsdWU6IGNoYXRQcm92aWRlci5JQ2hhdEltYWdlVVJMUGFydCA9IHtcblx0XHRcdFx0XHRtaW1lVHlwZTogYy52YWx1ZS5taW1lVHlwZSxcblx0XHRcdFx0XHRkYXRhOiBWU0J1ZmZlci53cmFwKGMudmFsdWUuZGF0YSksXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR0eXBlOiAnaW1hZ2VfdXJsJyxcblx0XHRcdFx0XHR2YWx1ZTogdmFsdWVcblx0XHRcdFx0fTtcblx0XHRcdH0gZWxzZSBpZiAoYyBpbnN0YW5jZW9mIHR5cGVzLkxhbmd1YWdlTW9kZWxUb29sQ2FsbFBhcnQpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR0eXBlOiAndG9vbF91c2UnLFxuXHRcdFx0XHRcdHRvb2xDYWxsSWQ6IGMuY2FsbElkLFxuXHRcdFx0XHRcdG5hbWU6IGMubmFtZSxcblx0XHRcdFx0XHRwYXJhbWV0ZXJzOiBjLmlucHV0XG5cdFx0XHRcdH07XG5cdFx0XHR9IGVsc2UgaWYgKGMgaW5zdGFuY2VvZiB0eXBlcy5MYW5ndWFnZU1vZGVsVGV4dFBhcnQpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR0eXBlOiAndGV4dCcsXG5cdFx0XHRcdFx0dmFsdWU6IGMudmFsdWVcblx0XHRcdFx0fTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICh0eXBlb2YgYyAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhdCBtZXNzYWdlIGNvbnRlbnQgdHlwZScpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR0eXBlOiAndGV4dCcsXG5cdFx0XHRcdFx0dmFsdWU6IGNcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRyb2xlLFxuXHRcdFx0bmFtZSxcblx0XHRcdGNvbnRlbnRcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgQ2hhdFJlc3BvbnNlTWFya2Rvd25QYXJ0IHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocGFydDogdnNjb2RlLkNoYXRSZXNwb25zZU1hcmtkb3duUGFydCk6IER0bzxJQ2hhdE1hcmtkb3duQ29udGVudD4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRraW5kOiAnbWFya2Rvd25Db250ZW50Jyxcblx0XHRcdGNvbnRlbnQ6IE1hcmtkb3duU3RyaW5nLmZyb20ocGFydC52YWx1ZSlcblx0XHR9O1xuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiB0byhwYXJ0OiBEdG88SUNoYXRNYXJrZG93bkNvbnRlbnQ+KTogdnNjb2RlLkNoYXRSZXNwb25zZU1hcmtkb3duUGFydCB7XG5cdFx0cmV0dXJuIG5ldyB0eXBlcy5DaGF0UmVzcG9uc2VNYXJrZG93blBhcnQoTWFya2Rvd25TdHJpbmcudG8ocGFydC5jb250ZW50KSk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDaGF0UmVzcG9uc2VDb2RlYmxvY2tVcmlQYXJ0IHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocGFydDogdnNjb2RlLkNoYXRSZXNwb25zZUNvZGVibG9ja1VyaVBhcnQpOiBEdG88SUNoYXRSZXNwb25zZUNvZGVibG9ja1VyaVBhcnQ+IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0a2luZDogJ2NvZGVibG9ja1VyaScsXG5cdFx0XHR1cmk6IHBhcnQudmFsdWUsXG5cdFx0XHRpc0VkaXQ6IHBhcnQuaXNFZGl0LFxuXHRcdH07XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHBhcnQ6IER0bzxJQ2hhdFJlc3BvbnNlQ29kZWJsb2NrVXJpUGFydD4pOiB2c2NvZGUuQ2hhdFJlc3BvbnNlQ29kZWJsb2NrVXJpUGFydCB7XG5cdFx0cmV0dXJuIG5ldyB0eXBlcy5DaGF0UmVzcG9uc2VDb2RlYmxvY2tVcmlQYXJ0KFVSSS5yZXZpdmUocGFydC51cmkpLCBwYXJ0LmlzRWRpdCk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDaGF0UmVzcG9uc2VNYXJrZG93bldpdGhWdWxuZXJhYmlsaXRpZXNQYXJ0IHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocGFydDogdnNjb2RlLkNoYXRSZXNwb25zZU1hcmtkb3duV2l0aFZ1bG5lcmFiaWxpdGllc1BhcnQpOiBEdG88SUNoYXRBZ2VudE1hcmtkb3duQ29udGVudFdpdGhWdWxuZXJhYmlsaXR5PiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGtpbmQ6ICdtYXJrZG93blZ1bG4nLFxuXHRcdFx0Y29udGVudDogTWFya2Rvd25TdHJpbmcuZnJvbShwYXJ0LnZhbHVlKSxcblx0XHRcdHZ1bG5lcmFiaWxpdGllczogcGFydC52dWxuZXJhYmlsaXRpZXMsXG5cdFx0fTtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gdG8ocGFydDogRHRvPElDaGF0QWdlbnRNYXJrZG93bkNvbnRlbnRXaXRoVnVsbmVyYWJpbGl0eT4pOiB2c2NvZGUuQ2hhdFJlc3BvbnNlTWFya2Rvd25XaXRoVnVsbmVyYWJpbGl0aWVzUGFydCB7XG5cdFx0cmV0dXJuIG5ldyB0eXBlcy5DaGF0UmVzcG9uc2VNYXJrZG93bldpdGhWdWxuZXJhYmlsaXRpZXNQYXJ0KE1hcmtkb3duU3RyaW5nLnRvKHBhcnQuY29udGVudCksIHBhcnQudnVsbmVyYWJpbGl0aWVzKTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIENoYXRSZXNwb25zZUNvbmZpcm1hdGlvblBhcnQge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShwYXJ0OiB2c2NvZGUuQ2hhdFJlc3BvbnNlQ29uZmlybWF0aW9uUGFydCk6IER0bzxJQ2hhdENvbmZpcm1hdGlvbj4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRraW5kOiAnY29uZmlybWF0aW9uJyxcblx0XHRcdHRpdGxlOiBwYXJ0LnRpdGxlLFxuXHRcdFx0bWVzc2FnZTogcGFydC5tZXNzYWdlLFxuXHRcdFx0ZGF0YTogcGFydC5kYXRhLFxuXHRcdFx0YnV0dG9uczogcGFydC5idXR0b25zXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIENoYXRSZXNwb25zZUZpbGVzUGFydCB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHBhcnQ6IHZzY29kZS5DaGF0UmVzcG9uc2VGaWxlVHJlZVBhcnQpOiBJQ2hhdFRyZWVEYXRhIHtcblx0XHRjb25zdCB7IHZhbHVlLCBiYXNlVXJpIH0gPSBwYXJ0O1xuXHRcdGZ1bmN0aW9uIGNvbnZlcnQoaXRlbXM6IHZzY29kZS5DaGF0UmVzcG9uc2VGaWxlVHJlZVtdLCBiYXNlVXJpOiBVUkkpOiBleHRIb3N0UHJvdG9jb2wuSUNoYXRSZXNwb25zZVByb2dyZXNzRmlsZVRyZWVEYXRhW10ge1xuXHRcdFx0cmV0dXJuIGl0ZW1zLm1hcChpdGVtID0+IHtcblx0XHRcdFx0Y29uc3QgbXlVcmkgPSBVUkkuam9pblBhdGgoYmFzZVVyaSwgaXRlbS5uYW1lKTtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRsYWJlbDogaXRlbS5uYW1lLFxuXHRcdFx0XHRcdHVyaTogbXlVcmksXG5cdFx0XHRcdFx0Y2hpbGRyZW46IGl0ZW0uY2hpbGRyZW4gJiYgY29udmVydChpdGVtLmNoaWxkcmVuLCBteVVyaSlcblx0XHRcdFx0fTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0a2luZDogJ3RyZWVEYXRhJyxcblx0XHRcdHRyZWVEYXRhOiB7XG5cdFx0XHRcdGxhYmVsOiBiYXNlbmFtZShiYXNlVXJpKSxcblx0XHRcdFx0dXJpOiBiYXNlVXJpLFxuXHRcdFx0XHRjaGlsZHJlbjogY29udmVydCh2YWx1ZSwgYmFzZVVyaSlcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiB0byhwYXJ0OiBEdG88SUNoYXRUcmVlRGF0YT4pOiB2c2NvZGUuQ2hhdFJlc3BvbnNlRmlsZVRyZWVQYXJ0IHtcblx0XHRjb25zdCB0cmVlRGF0YSA9IHJldml2ZTxleHRIb3N0UHJvdG9jb2wuSUNoYXRSZXNwb25zZVByb2dyZXNzRmlsZVRyZWVEYXRhPihwYXJ0LnRyZWVEYXRhKTtcblx0XHRmdW5jdGlvbiBjb252ZXJ0KGl0ZW1zOiBleHRIb3N0UHJvdG9jb2wuSUNoYXRSZXNwb25zZVByb2dyZXNzRmlsZVRyZWVEYXRhW10pOiB2c2NvZGUuQ2hhdFJlc3BvbnNlRmlsZVRyZWVbXSB7XG5cdFx0XHRyZXR1cm4gaXRlbXMubWFwKGl0ZW0gPT4ge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdG5hbWU6IGl0ZW0ubGFiZWwsXG5cdFx0XHRcdFx0Y2hpbGRyZW46IGl0ZW0uY2hpbGRyZW4gJiYgY29udmVydChpdGVtLmNoaWxkcmVuKVxuXHRcdFx0XHR9O1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYmFzZVVyaSA9IHRyZWVEYXRhLnVyaTtcblx0XHRjb25zdCBpdGVtcyA9IHRyZWVEYXRhLmNoaWxkcmVuID8gY29udmVydCh0cmVlRGF0YS5jaGlsZHJlbikgOiBbXTtcblx0XHRyZXR1cm4gbmV3IHR5cGVzLkNoYXRSZXNwb25zZUZpbGVUcmVlUGFydChpdGVtcywgYmFzZVVyaSk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDaGF0UmVzcG9uc2VBbmNob3JQYXJ0IHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocGFydDogdnNjb2RlLkNoYXRSZXNwb25zZUFuY2hvclBhcnQpOiBEdG88SUNoYXRDb250ZW50SW5saW5lUmVmZXJlbmNlPiB7XG5cdFx0Ly8gV29yayBhcm91bmQgdHlwZS1uYXJyb3dpbmcgY29uZnVzaW9uIGJldHdlZW4gdnNjb2RlLlVyaSBhbmQgVVJJXG5cdFx0Y29uc3QgaXNVcmkgPSAodGhpbmc6IHVua25vd24pOiB0aGluZyBpcyB2c2NvZGUuVXJpID0+IFVSSS5pc1VyaSh0aGluZyk7XG5cdFx0Y29uc3QgaXNTeW1ib2xJbmZvcm1hdGlvbiA9ICh0aGluZzogb2JqZWN0KTogdGhpbmcgaXMgdnNjb2RlLlN5bWJvbEluZm9ybWF0aW9uID0+ICduYW1lJyBpbiB0aGluZztcblxuXHRcdHJldHVybiB7XG5cdFx0XHRraW5kOiAnaW5saW5lUmVmZXJlbmNlJyxcblx0XHRcdG5hbWU6IHBhcnQudGl0bGUsXG5cdFx0XHRpbmxpbmVSZWZlcmVuY2U6IGlzVXJpKHBhcnQudmFsdWUpXG5cdFx0XHRcdD8gcGFydC52YWx1ZVxuXHRcdFx0XHQ6IGlzU3ltYm9sSW5mb3JtYXRpb24ocGFydC52YWx1ZSlcblx0XHRcdFx0XHQ/IFdvcmtzcGFjZVN5bWJvbC5mcm9tKHBhcnQudmFsdWUpXG5cdFx0XHRcdFx0OiBMb2NhdGlvbi5mcm9tKHBhcnQudmFsdWUpXG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byhwYXJ0OiBEdG88SUNoYXRDb250ZW50SW5saW5lUmVmZXJlbmNlPik6IHZzY29kZS5DaGF0UmVzcG9uc2VBbmNob3JQYXJ0IHtcblx0XHRjb25zdCB2YWx1ZSA9IHJldml2ZTxJQ2hhdENvbnRlbnRJbmxpbmVSZWZlcmVuY2U+KHBhcnQpO1xuXHRcdHJldHVybiBuZXcgdHlwZXMuQ2hhdFJlc3BvbnNlQW5jaG9yUGFydChcblx0XHRcdFVSSS5pc1VyaSh2YWx1ZS5pbmxpbmVSZWZlcmVuY2UpXG5cdFx0XHRcdD8gdmFsdWUuaW5saW5lUmVmZXJlbmNlXG5cdFx0XHRcdDogJ2xvY2F0aW9uJyBpbiB2YWx1ZS5pbmxpbmVSZWZlcmVuY2Vcblx0XHRcdFx0XHQ/IFdvcmtzcGFjZVN5bWJvbC50byh2YWx1ZS5pbmxpbmVSZWZlcmVuY2UpIGFzIHZzY29kZS5TeW1ib2xJbmZvcm1hdGlvblxuXHRcdFx0XHRcdDogTG9jYXRpb24udG8odmFsdWUuaW5saW5lUmVmZXJlbmNlKSxcblx0XHRcdHBhcnQubmFtZVxuXHRcdCk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDaGF0UmVzcG9uc2VQcm9ncmVzc1BhcnQge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShwYXJ0OiB2c2NvZGUuQ2hhdFJlc3BvbnNlUHJvZ3Jlc3NQYXJ0KTogRHRvPElDaGF0UHJvZ3Jlc3NNZXNzYWdlPiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGtpbmQ6ICdwcm9ncmVzc01lc3NhZ2UnLFxuXHRcdFx0Y29udGVudDogTWFya2Rvd25TdHJpbmcuZnJvbShwYXJ0LnZhbHVlKVxuXHRcdH07XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHBhcnQ6IER0bzxJQ2hhdFByb2dyZXNzTWVzc2FnZT4pOiB2c2NvZGUuQ2hhdFJlc3BvbnNlUHJvZ3Jlc3NQYXJ0IHtcblx0XHRyZXR1cm4gbmV3IHR5cGVzLkNoYXRSZXNwb25zZVByb2dyZXNzUGFydChwYXJ0LmNvbnRlbnQudmFsdWUpO1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgQ2hhdFJlc3BvbnNlV2FybmluZ1BhcnQge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShwYXJ0OiB2c2NvZGUuQ2hhdFJlc3BvbnNlV2FybmluZ1BhcnQpOiBEdG88SUNoYXRXYXJuaW5nTWVzc2FnZT4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRraW5kOiAnd2FybmluZycsXG5cdFx0XHRjb250ZW50OiBNYXJrZG93blN0cmluZy5mcm9tKHBhcnQudmFsdWUpXG5cdFx0fTtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gdG8ocGFydDogRHRvPElDaGF0V2FybmluZ01lc3NhZ2U+KTogdnNjb2RlLkNoYXRSZXNwb25zZVdhcm5pbmdQYXJ0IHtcblx0XHRyZXR1cm4gbmV3IHR5cGVzLkNoYXRSZXNwb25zZVdhcm5pbmdQYXJ0KHBhcnQuY29udGVudC52YWx1ZSk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDaGF0UmVzcG9uc2VNb3ZlUGFydCB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHBhcnQ6IHZzY29kZS5DaGF0UmVzcG9uc2VNb3ZlUGFydCk6IER0bzxJQ2hhdE1vdmVNZXNzYWdlPiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGtpbmQ6ICdtb3ZlJyxcblx0XHRcdHVyaTogcGFydC51cmksXG5cdFx0XHRyYW5nZTogUmFuZ2UuZnJvbShwYXJ0LnJhbmdlKSxcblx0XHR9O1xuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiB0byhwYXJ0OiBEdG88SUNoYXRNb3ZlTWVzc2FnZT4pOiB2c2NvZGUuQ2hhdFJlc3BvbnNlTW92ZVBhcnQge1xuXHRcdHJldHVybiBuZXcgdHlwZXMuQ2hhdFJlc3BvbnNlTW92ZVBhcnQoVVJJLnJldml2ZShwYXJ0LnVyaSksIFJhbmdlLnRvKHBhcnQucmFuZ2UpKTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIENoYXRUYXNrIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocGFydDogdnNjb2RlLkNoYXRSZXNwb25zZVByb2dyZXNzUGFydDIpOiBJQ2hhdFRhc2tEdG8ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRraW5kOiAncHJvZ3Jlc3NUYXNrJyxcblx0XHRcdGNvbnRlbnQ6IE1hcmtkb3duU3RyaW5nLmZyb20ocGFydC52YWx1ZSksXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIENoYXRUYXNrUmVzdWx0IHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocGFydDogc3RyaW5nIHwgdm9pZCk6IER0bzxJQ2hhdFRhc2tSZXN1bHQ+IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0a2luZDogJ3Byb2dyZXNzVGFza1Jlc3VsdCcsXG5cdFx0XHRjb250ZW50OiB0eXBlb2YgcGFydCA9PT0gJ3N0cmluZycgPyBNYXJrZG93blN0cmluZy5mcm9tKHBhcnQpIDogdW5kZWZpbmVkXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIENoYXRSZXNwb25zZUNvbW1hbmRCdXR0b25QYXJ0IHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocGFydDogdnNjb2RlLkNoYXRSZXNwb25zZUNvbW1hbmRCdXR0b25QYXJ0LCBjb21tYW5kc0NvbnZlcnRlcjogQ29tbWFuZHNDb252ZXJ0ZXIsIGNvbW1hbmREaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKTogRHRvPElDaGF0Q29tbWFuZEJ1dHRvbj4ge1xuXHRcdC8vIElmIHRoZSBjb21tYW5kIGlzbid0IGluIHRoZSBjb252ZXJ0ZXIsIHRoZW4gdGhpcyBzZXNzaW9uIG1heSBoYXZlIGJlZW4gcmVzdG9yZWQsIGFuZCB0aGUgY29tbWFuZCBhcmdzIGRvbid0IGV4aXN0IGFueW1vcmVcblx0XHRjb25zdCBjb21tYW5kID0gY29tbWFuZHNDb252ZXJ0ZXIudG9JbnRlcm5hbChwYXJ0LnZhbHVlLCBjb21tYW5kRGlzcG9zYWJsZXMpID8/IHsgY29tbWFuZDogcGFydC52YWx1ZS5jb21tYW5kLCB0aXRsZTogcGFydC52YWx1ZS50aXRsZSB9O1xuXHRcdHJldHVybiB7XG5cdFx0XHRraW5kOiAnY29tbWFuZCcsXG5cdFx0XHRjb21tYW5kXG5cdFx0fTtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gdG8ocGFydDogRHRvPElDaGF0Q29tbWFuZEJ1dHRvbj4sIGNvbW1hbmRzQ29udmVydGVyOiBDb21tYW5kc0NvbnZlcnRlcik6IHZzY29kZS5DaGF0UmVzcG9uc2VDb21tYW5kQnV0dG9uUGFydCB7XG5cdFx0Ly8gSWYgdGhlIGNvbW1hbmQgaXNuJ3QgaW4gdGhlIGNvbnZlcnRlciwgdGhlbiB0aGlzIHNlc3Npb24gbWF5IGhhdmUgYmVlbiByZXN0b3JlZCwgYW5kIHRoZSBjb21tYW5kIGFyZ3MgZG9uJ3QgZXhpc3QgYW55bW9yZVxuXHRcdHJldHVybiBuZXcgdHlwZXMuQ2hhdFJlc3BvbnNlQ29tbWFuZEJ1dHRvblBhcnQoY29tbWFuZHNDb252ZXJ0ZXIuZnJvbUludGVybmFsKHBhcnQuY29tbWFuZCkgPz8geyBjb21tYW5kOiBwYXJ0LmNvbW1hbmQuaWQsIHRpdGxlOiBwYXJ0LmNvbW1hbmQudGl0bGUgfSk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDaGF0UmVzcG9uc2VUZXh0RWRpdFBhcnQge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShwYXJ0OiB2c2NvZGUuQ2hhdFJlc3BvbnNlVGV4dEVkaXRQYXJ0KTogRHRvPElDaGF0VGV4dEVkaXQ+IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0a2luZDogJ3RleHRFZGl0Jyxcblx0XHRcdHVyaTogcGFydC51cmksXG5cdFx0XHRlZGl0czogcGFydC5lZGl0cy5tYXAoZSA9PiBUZXh0RWRpdC5mcm9tKGUpKSxcblx0XHRcdGRvbmU6IHBhcnQuaXNEb25lXG5cdFx0fTtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gdG8ocGFydDogRHRvPElDaGF0VGV4dEVkaXQ+KTogdnNjb2RlLkNoYXRSZXNwb25zZVRleHRFZGl0UGFydCB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IHR5cGVzLkNoYXRSZXNwb25zZVRleHRFZGl0UGFydChVUkkucmV2aXZlKHBhcnQudXJpKSwgcGFydC5lZGl0cy5tYXAoZSA9PiBUZXh0RWRpdC50byhlKSkpO1xuXHRcdHJlc3VsdC5pc0RvbmUgPSBwYXJ0LmRvbmU7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgTm90ZWJvb2tFZGl0IHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20oZWRpdDogdnNjb2RlLk5vdGVib29rRWRpdCk6IGV4dEhvc3RQcm90b2NvbC5JQ2VsbEVkaXRPcGVyYXRpb25EdG8ge1xuXHRcdGlmIChlZGl0Lm5ld0NlbGxNZXRhZGF0YSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5NZXRhZGF0YSxcblx0XHRcdFx0aW5kZXg6IGVkaXQucmFuZ2Uuc3RhcnQsXG5cdFx0XHRcdG1ldGFkYXRhOiBlZGl0Lm5ld0NlbGxNZXRhZGF0YVxuXHRcdFx0fTtcblx0XHR9IGVsc2UgaWYgKGVkaXQubmV3Tm90ZWJvb2tNZXRhZGF0YSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFZGl0VHlwZS5Eb2N1bWVudE1ldGFkYXRhLFxuXHRcdFx0XHRtZXRhZGF0YTogZWRpdC5uZXdOb3RlYm9va01ldGFkYXRhXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsXG5cdFx0XHRcdGluZGV4OiBlZGl0LnJhbmdlLnN0YXJ0LFxuXHRcdFx0XHRjb3VudDogZWRpdC5yYW5nZS5lbmQgLSBlZGl0LnJhbmdlLnN0YXJ0LFxuXHRcdFx0XHRjZWxsczogZWRpdC5uZXdDZWxscy5tYXAoTm90ZWJvb2tDZWxsRGF0YS5mcm9tKVxuXHRcdFx0fTtcblx0XHR9XG5cdH1cbn1cblxuXG5leHBvcnQgbmFtZXNwYWNlIENoYXRSZXNwb25zZU5vdGVib29rRWRpdFBhcnQge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShwYXJ0OiB2c2NvZGUuQ2hhdFJlc3BvbnNlTm90ZWJvb2tFZGl0UGFydCk6IGV4dEhvc3RQcm90b2NvbC5JQ2hhdE5vdGVib29rRWRpdER0byB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGtpbmQ6ICdub3RlYm9va0VkaXQnLFxuXHRcdFx0dXJpOiBwYXJ0LnVyaSxcblx0XHRcdGVkaXRzOiBwYXJ0LmVkaXRzLm1hcChOb3RlYm9va0VkaXQuZnJvbSksXG5cdFx0XHRkb25lOiBwYXJ0LmlzRG9uZVxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDaGF0UmVzcG9uc2VSZWZlcmVuY2VQYXJ0IHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocGFydDogdHlwZXMuQ2hhdFJlc3BvbnNlUmVmZXJlbmNlUGFydCk6IER0bzxJQ2hhdENvbnRlbnRSZWZlcmVuY2U+IHtcblx0XHRjb25zdCBpY29uUGF0aCA9IFRoZW1lSWNvbi5pc1RoZW1lSWNvbihwYXJ0Lmljb25QYXRoKSA/IHBhcnQuaWNvblBhdGhcblx0XHRcdDogVVJJLmlzVXJpKHBhcnQuaWNvblBhdGgpID8geyBsaWdodDogVVJJLnJldml2ZShwYXJ0Lmljb25QYXRoKSB9XG5cdFx0XHRcdDogKHBhcnQuaWNvblBhdGggJiYgJ2xpZ2h0JyBpbiBwYXJ0Lmljb25QYXRoICYmICdkYXJrJyBpbiBwYXJ0Lmljb25QYXRoICYmIFVSSS5pc1VyaShwYXJ0Lmljb25QYXRoLmxpZ2h0KSAmJiBVUkkuaXNVcmkocGFydC5pY29uUGF0aC5kYXJrKSA/IHsgbGlnaHQ6IFVSSS5yZXZpdmUocGFydC5pY29uUGF0aC5saWdodCksIGRhcms6IFVSSS5yZXZpdmUocGFydC5pY29uUGF0aC5kYXJrKSB9XG5cdFx0XHRcdFx0OiB1bmRlZmluZWQpO1xuXG5cdFx0aWYgKHR5cGVvZiBwYXJ0LnZhbHVlID09PSAnb2JqZWN0JyAmJiAndmFyaWFibGVOYW1lJyBpbiBwYXJ0LnZhbHVlKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRraW5kOiAncmVmZXJlbmNlJyxcblx0XHRcdFx0cmVmZXJlbmNlOiB7XG5cdFx0XHRcdFx0dmFyaWFibGVOYW1lOiBwYXJ0LnZhbHVlLnZhcmlhYmxlTmFtZSxcblx0XHRcdFx0XHR2YWx1ZTogVVJJLmlzVXJpKHBhcnQudmFsdWUudmFsdWUpIHx8ICFwYXJ0LnZhbHVlLnZhbHVlID9cblx0XHRcdFx0XHRcdHBhcnQudmFsdWUudmFsdWUgOlxuXHRcdFx0XHRcdFx0TG9jYXRpb24uZnJvbShwYXJ0LnZhbHVlLnZhbHVlIGFzIHZzY29kZS5Mb2NhdGlvbilcblx0XHRcdFx0fSxcblx0XHRcdFx0aWNvblBhdGgsXG5cdFx0XHRcdG9wdGlvbnM6IHBhcnQub3B0aW9uc1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0a2luZDogJ3JlZmVyZW5jZScsXG5cdFx0XHRyZWZlcmVuY2U6IFVSSS5pc1VyaShwYXJ0LnZhbHVlKSB8fCB0eXBlb2YgcGFydC52YWx1ZSA9PT0gJ3N0cmluZycgP1xuXHRcdFx0XHRwYXJ0LnZhbHVlIDpcblx0XHRcdFx0TG9jYXRpb24uZnJvbSg8dnNjb2RlLkxvY2F0aW9uPnBhcnQudmFsdWUpLFxuXHRcdFx0aWNvblBhdGgsXG5cdFx0XHRvcHRpb25zOiBwYXJ0Lm9wdGlvbnNcblx0XHR9O1xuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiB0byhwYXJ0OiBEdG88SUNoYXRDb250ZW50UmVmZXJlbmNlPik6IHZzY29kZS5DaGF0UmVzcG9uc2VSZWZlcmVuY2VQYXJ0IHtcblx0XHRjb25zdCB2YWx1ZSA9IHJldml2ZTxJQ2hhdENvbnRlbnRSZWZlcmVuY2U+KHBhcnQpO1xuXG5cdFx0Y29uc3QgbWFwVmFsdWUgPSAodmFsdWU6IFVSSSB8IGxhbmd1YWdlcy5Mb2NhdGlvbik6IHZzY29kZS5VcmkgfCB2c2NvZGUuTG9jYXRpb24gPT4gVVJJLmlzVXJpKHZhbHVlKSA/XG5cdFx0XHR2YWx1ZSA6XG5cdFx0XHRMb2NhdGlvbi50byh2YWx1ZSk7XG5cblx0XHRyZXR1cm4gbmV3IHR5cGVzLkNoYXRSZXNwb25zZVJlZmVyZW5jZVBhcnQoXG5cdFx0XHR0eXBlb2YgdmFsdWUucmVmZXJlbmNlID09PSAnc3RyaW5nJyA/IHZhbHVlLnJlZmVyZW5jZSA6ICd2YXJpYWJsZU5hbWUnIGluIHZhbHVlLnJlZmVyZW5jZSA/IHtcblx0XHRcdFx0dmFyaWFibGVOYW1lOiB2YWx1ZS5yZWZlcmVuY2UudmFyaWFibGVOYW1lLFxuXHRcdFx0XHR2YWx1ZTogdmFsdWUucmVmZXJlbmNlLnZhbHVlICYmIG1hcFZhbHVlKHZhbHVlLnJlZmVyZW5jZS52YWx1ZSlcblx0XHRcdH0gOlxuXHRcdFx0XHRtYXBWYWx1ZSh2YWx1ZS5yZWZlcmVuY2UpXG5cdFx0KSBhcyB2c2NvZGUuQ2hhdFJlc3BvbnNlUmVmZXJlbmNlUGFydDsgLy8gJ3ZhbHVlJyBpcyBleHRlbmRlZCB3aXRoIHZhcmlhYmxlTmFtZVxuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgQ2hhdFJlc3BvbnNlQ29kZUNpdGF0aW9uUGFydCB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHBhcnQ6IHZzY29kZS5DaGF0UmVzcG9uc2VDb2RlQ2l0YXRpb25QYXJ0KTogRHRvPElDaGF0Q29kZUNpdGF0aW9uPiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGtpbmQ6ICdjb2RlQ2l0YXRpb24nLFxuXHRcdFx0dmFsdWU6IHBhcnQudmFsdWUsXG5cdFx0XHRsaWNlbnNlOiBwYXJ0LmxpY2Vuc2UsXG5cdFx0XHRzbmlwcGV0OiBwYXJ0LnNuaXBwZXRcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgQ2hhdFJlc3BvbnNlUGFydCB7XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ocGFydDogdnNjb2RlLkNoYXRSZXNwb25zZVBhcnQgfCB2c2NvZGUuQ2hhdFJlc3BvbnNlVGV4dEVkaXRQYXJ0IHwgdnNjb2RlLkNoYXRSZXNwb25zZU1hcmtkb3duV2l0aFZ1bG5lcmFiaWxpdGllc1BhcnQgfCB2c2NvZGUuQ2hhdFJlc3BvbnNlV2FybmluZ1BhcnQgfCB2c2NvZGUuQ2hhdFJlc3BvbnNlQ29uZmlybWF0aW9uUGFydCB8IHZzY29kZS5DaGF0UmVzcG9uc2VSZWZlcmVuY2VQYXJ0MiB8IHZzY29kZS5DaGF0UmVzcG9uc2VNb3ZlUGFydCwgY29tbWFuZHNDb252ZXJ0ZXI6IENvbW1hbmRzQ29udmVydGVyLCBjb21tYW5kRGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IGV4dEhvc3RQcm90b2NvbC5JQ2hhdFByb2dyZXNzRHRvIHtcblx0XHRpZiAocGFydCBpbnN0YW5jZW9mIHR5cGVzLkNoYXRSZXNwb25zZU1hcmtkb3duUGFydCkge1xuXHRcdFx0cmV0dXJuIENoYXRSZXNwb25zZU1hcmtkb3duUGFydC5mcm9tKHBhcnQpO1xuXHRcdH0gZWxzZSBpZiAocGFydCBpbnN0YW5jZW9mIHR5cGVzLkNoYXRSZXNwb25zZUFuY2hvclBhcnQpIHtcblx0XHRcdHJldHVybiBDaGF0UmVzcG9uc2VBbmNob3JQYXJ0LmZyb20ocGFydCk7XG5cdFx0fSBlbHNlIGlmIChwYXJ0IGluc3RhbmNlb2YgdHlwZXMuQ2hhdFJlc3BvbnNlUmVmZXJlbmNlUGFydCkge1xuXHRcdFx0cmV0dXJuIENoYXRSZXNwb25zZVJlZmVyZW5jZVBhcnQuZnJvbShwYXJ0KTtcblx0XHR9IGVsc2UgaWYgKHBhcnQgaW5zdGFuY2VvZiB0eXBlcy5DaGF0UmVzcG9uc2VQcm9ncmVzc1BhcnQpIHtcblx0XHRcdHJldHVybiBDaGF0UmVzcG9uc2VQcm9ncmVzc1BhcnQuZnJvbShwYXJ0KTtcblx0XHR9IGVsc2UgaWYgKHBhcnQgaW5zdGFuY2VvZiB0eXBlcy5DaGF0UmVzcG9uc2VGaWxlVHJlZVBhcnQpIHtcblx0XHRcdHJldHVybiBDaGF0UmVzcG9uc2VGaWxlc1BhcnQuZnJvbShwYXJ0KTtcblx0XHR9IGVsc2UgaWYgKHBhcnQgaW5zdGFuY2VvZiB0eXBlcy5DaGF0UmVzcG9uc2VDb21tYW5kQnV0dG9uUGFydCkge1xuXHRcdFx0cmV0dXJuIENoYXRSZXNwb25zZUNvbW1hbmRCdXR0b25QYXJ0LmZyb20ocGFydCwgY29tbWFuZHNDb252ZXJ0ZXIsIGNvbW1hbmREaXNwb3NhYmxlcyk7XG5cdFx0fSBlbHNlIGlmIChwYXJ0IGluc3RhbmNlb2YgdHlwZXMuQ2hhdFJlc3BvbnNlVGV4dEVkaXRQYXJ0KSB7XG5cdFx0XHRyZXR1cm4gQ2hhdFJlc3BvbnNlVGV4dEVkaXRQYXJ0LmZyb20ocGFydCk7XG5cdFx0fSBlbHNlIGlmIChwYXJ0IGluc3RhbmNlb2YgdHlwZXMuQ2hhdFJlc3BvbnNlTm90ZWJvb2tFZGl0UGFydCkge1xuXHRcdFx0cmV0dXJuIENoYXRSZXNwb25zZU5vdGVib29rRWRpdFBhcnQuZnJvbShwYXJ0KTtcblx0XHR9IGVsc2UgaWYgKHBhcnQgaW5zdGFuY2VvZiB0eXBlcy5DaGF0UmVzcG9uc2VNYXJrZG93bldpdGhWdWxuZXJhYmlsaXRpZXNQYXJ0KSB7XG5cdFx0XHRyZXR1cm4gQ2hhdFJlc3BvbnNlTWFya2Rvd25XaXRoVnVsbmVyYWJpbGl0aWVzUGFydC5mcm9tKHBhcnQpO1xuXHRcdH0gZWxzZSBpZiAocGFydCBpbnN0YW5jZW9mIHR5cGVzLkNoYXRSZXNwb25zZUNvZGVibG9ja1VyaVBhcnQpIHtcblx0XHRcdHJldHVybiBDaGF0UmVzcG9uc2VDb2RlYmxvY2tVcmlQYXJ0LmZyb20ocGFydCk7XG5cdFx0fSBlbHNlIGlmIChwYXJ0IGluc3RhbmNlb2YgdHlwZXMuQ2hhdFJlc3BvbnNlV2FybmluZ1BhcnQpIHtcblx0XHRcdHJldHVybiBDaGF0UmVzcG9uc2VXYXJuaW5nUGFydC5mcm9tKHBhcnQpO1xuXHRcdH0gZWxzZSBpZiAocGFydCBpbnN0YW5jZW9mIHR5cGVzLkNoYXRSZXNwb25zZUNvbmZpcm1hdGlvblBhcnQpIHtcblx0XHRcdHJldHVybiBDaGF0UmVzcG9uc2VDb25maXJtYXRpb25QYXJ0LmZyb20ocGFydCk7XG5cdFx0fSBlbHNlIGlmIChwYXJ0IGluc3RhbmNlb2YgdHlwZXMuQ2hhdFJlc3BvbnNlQ29kZUNpdGF0aW9uUGFydCkge1xuXHRcdFx0cmV0dXJuIENoYXRSZXNwb25zZUNvZGVDaXRhdGlvblBhcnQuZnJvbShwYXJ0KTtcblx0XHR9IGVsc2UgaWYgKHBhcnQgaW5zdGFuY2VvZiB0eXBlcy5DaGF0UmVzcG9uc2VNb3ZlUGFydCkge1xuXHRcdFx0cmV0dXJuIENoYXRSZXNwb25zZU1vdmVQYXJ0LmZyb20ocGFydCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGtpbmQ6ICdtYXJrZG93bkNvbnRlbnQnLFxuXHRcdFx0Y29udGVudDogTWFya2Rvd25TdHJpbmcuZnJvbSgnJylcblx0XHR9O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHBhcnQ6IGV4dEhvc3RQcm90b2NvbC5JQ2hhdFByb2dyZXNzRHRvLCBjb21tYW5kc0NvbnZlcnRlcjogQ29tbWFuZHNDb252ZXJ0ZXIpOiB2c2NvZGUuQ2hhdFJlc3BvbnNlUGFydCB8IHVuZGVmaW5lZCB7XG5cdFx0c3dpdGNoIChwYXJ0LmtpbmQpIHtcblx0XHRcdGNhc2UgJ3JlZmVyZW5jZSc6IHJldHVybiBDaGF0UmVzcG9uc2VSZWZlcmVuY2VQYXJ0LnRvKHBhcnQpO1xuXHRcdFx0Y2FzZSAnbWFya2Rvd25Db250ZW50Jzpcblx0XHRcdGNhc2UgJ2lubGluZVJlZmVyZW5jZSc6XG5cdFx0XHRjYXNlICdwcm9ncmVzc01lc3NhZ2UnOlxuXHRcdFx0Y2FzZSAndHJlZURhdGEnOlxuXHRcdFx0Y2FzZSAnY29tbWFuZCc6XG5cdFx0XHRcdHJldHVybiB0b0NvbnRlbnQocGFydCwgY29tbWFuZHNDb252ZXJ0ZXIpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvQ29udGVudChwYXJ0OiBleHRIb3N0UHJvdG9jb2wuSUNoYXRDb250ZW50UHJvZ3Jlc3NEdG8sIGNvbW1hbmRzQ29udmVydGVyOiBDb21tYW5kc0NvbnZlcnRlcik6IHZzY29kZS5DaGF0UmVzcG9uc2VNYXJrZG93blBhcnQgfCB2c2NvZGUuQ2hhdFJlc3BvbnNlRmlsZVRyZWVQYXJ0IHwgdnNjb2RlLkNoYXRSZXNwb25zZUFuY2hvclBhcnQgfCB2c2NvZGUuQ2hhdFJlc3BvbnNlQ29tbWFuZEJ1dHRvblBhcnQgfCB1bmRlZmluZWQge1xuXHRcdHN3aXRjaCAocGFydC5raW5kKSB7XG5cdFx0XHRjYXNlICdtYXJrZG93bkNvbnRlbnQnOiByZXR1cm4gQ2hhdFJlc3BvbnNlTWFya2Rvd25QYXJ0LnRvKHBhcnQpO1xuXHRcdFx0Y2FzZSAnaW5saW5lUmVmZXJlbmNlJzogcmV0dXJuIENoYXRSZXNwb25zZUFuY2hvclBhcnQudG8ocGFydCk7XG5cdFx0XHRjYXNlICdwcm9ncmVzc01lc3NhZ2UnOiByZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0Y2FzZSAndHJlZURhdGEnOiByZXR1cm4gQ2hhdFJlc3BvbnNlRmlsZXNQYXJ0LnRvKHBhcnQpO1xuXHRcdFx0Y2FzZSAnY29tbWFuZCc6IHJldHVybiBDaGF0UmVzcG9uc2VDb21tYW5kQnV0dG9uUGFydC50byhwYXJ0LCBjb21tYW5kc0NvbnZlcnRlcik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIENoYXRBZ2VudFJlcXVlc3Qge1xuXHRleHBvcnQgZnVuY3Rpb24gdG8ocmVxdWVzdDogSUNoYXRBZ2VudFJlcXVlc3QsIGxvY2F0aW9uMjogdnNjb2RlLkNoYXRSZXF1ZXN0RWRpdG9yRGF0YSB8IHZzY29kZS5DaGF0UmVxdWVzdE5vdGVib29rRGF0YSB8IHVuZGVmaW5lZCwgbW9kZWw6IHZzY29kZS5MYW5ndWFnZU1vZGVsQ2hhdCwgZGlhZ25vc3RpY3M6IHJlYWRvbmx5IFt2c2NvZGUuVXJpLCByZWFkb25seSB2c2NvZGUuRGlhZ25vc3RpY1tdXVtdLCB0b29sczogdnNjb2RlLkxhbmd1YWdlTW9kZWxUb29sSW5mb3JtYXRpb25bXSB8IHVuZGVmaW5lZCk6IHZzY29kZS5DaGF0UmVxdWVzdCB7XG5cdFx0Y29uc3QgdG9vbFJlZmVyZW5jZXMgPSByZXF1ZXN0LnZhcmlhYmxlcy52YXJpYWJsZXMuZmlsdGVyKHYgPT4gdi5pc1Rvb2wpO1xuXHRcdGNvbnN0IHZhcmlhYmxlUmVmZXJlbmNlcyA9IHJlcXVlc3QudmFyaWFibGVzLnZhcmlhYmxlcy5maWx0ZXIodiA9PiAhdi5pc1Rvb2wpO1xuXHRcdGNvbnN0IHJlcXVlc3RXaXRob3V0SWQgPSB7XG5cdFx0XHRwcm9tcHQ6IHJlcXVlc3QubWVzc2FnZSxcblx0XHRcdGNvbW1hbmQ6IHJlcXVlc3QuY29tbWFuZCxcblx0XHRcdGF0dGVtcHQ6IHJlcXVlc3QuYXR0ZW1wdCA/PyAwLFxuXHRcdFx0ZW5hYmxlQ29tbWFuZERldGVjdGlvbjogcmVxdWVzdC5lbmFibGVDb21tYW5kRGV0ZWN0aW9uID8/IHRydWUsXG5cdFx0XHRpc1BhcnRpY2lwYW50RGV0ZWN0ZWQ6IHJlcXVlc3QuaXNQYXJ0aWNpcGFudERldGVjdGVkID8/IGZhbHNlLFxuXHRcdFx0cmVmZXJlbmNlczogdmFyaWFibGVSZWZlcmVuY2VzLm1hcCh2ID0+IENoYXRQcm9tcHRSZWZlcmVuY2UudG8odiwgZGlhZ25vc3RpY3MpKSxcblx0XHRcdHRvb2xSZWZlcmVuY2VzOiB0b29sUmVmZXJlbmNlcy5tYXAoQ2hhdExhbmd1YWdlTW9kZWxUb29sUmVmZXJlbmNlLnRvKSxcblx0XHRcdGxvY2F0aW9uOiBDaGF0TG9jYXRpb24udG8ocmVxdWVzdC5sb2NhdGlvbiksXG5cdFx0XHRhY2NlcHRlZENvbmZpcm1hdGlvbkRhdGE6IHJlcXVlc3QuYWNjZXB0ZWRDb25maXJtYXRpb25EYXRhLFxuXHRcdFx0cmVqZWN0ZWRDb25maXJtYXRpb25EYXRhOiByZXF1ZXN0LnJlamVjdGVkQ29uZmlybWF0aW9uRGF0YSxcblx0XHRcdGxvY2F0aW9uMixcblx0XHRcdHRvb2xJbnZvY2F0aW9uVG9rZW46IE9iamVjdC5mcmVlemUoeyBzZXNzaW9uSWQ6IHJlcXVlc3Quc2Vzc2lvbklkIH0pIGFzIG5ldmVyLFxuXHRcdFx0dG9vbHMsXG5cdFx0XHRtb2RlbFxuXHRcdH07XG5cdFx0aWYgKHJlcXVlc3QucmVxdWVzdElkKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHQuLi5yZXF1ZXN0V2l0aG91dElkLFxuXHRcdFx0XHRpZDogcmVxdWVzdC5yZXF1ZXN0SWRcblx0XHRcdH07XG5cdFx0fVxuXHRcdC8vIFRoaXMgY2FzdCBpcyBkb25lIHRvIGFsbG93IHNlbmRpbmcgdGhlIHN0YWJsIHZlcnNpb24gb2YgQ2hhdFJlcXVlc3Qgd2hpY2ggZG9lcyBub3QgaGF2ZSBhbiBpZCBwcm9wZXJ0eVxuXHRcdHJldHVybiByZXF1ZXN0V2l0aG91dElkIGFzIHVua25vd24gYXMgdnNjb2RlLkNoYXRSZXF1ZXN0O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgQ2hhdFJlcXVlc3REcmFmdCB7XG5cdGV4cG9ydCBmdW5jdGlvbiB0byhyZXF1ZXN0OiBJQ2hhdFJlcXVlc3REcmFmdCk6IHZzY29kZS5DaGF0UmVxdWVzdERyYWZ0IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cHJvbXB0OiByZXF1ZXN0LnByb21wdCxcblx0XHRcdGZpbGVzOiByZXF1ZXN0LmZpbGVzLm1hcCgodXJpKSA9PiBVUkkucmV2aXZlKHVyaSkpXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIENoYXRMb2NhdGlvbiB7XG5cdGV4cG9ydCBmdW5jdGlvbiB0byhsb2M6IENoYXRBZ2VudExvY2F0aW9uKTogdHlwZXMuQ2hhdExvY2F0aW9uIHtcblx0XHRzd2l0Y2ggKGxvYykge1xuXHRcdFx0Y2FzZSBDaGF0QWdlbnRMb2NhdGlvbi5Ob3RlYm9vazogcmV0dXJuIHR5cGVzLkNoYXRMb2NhdGlvbi5Ob3RlYm9vaztcblx0XHRcdGNhc2UgQ2hhdEFnZW50TG9jYXRpb24uVGVybWluYWw6IHJldHVybiB0eXBlcy5DaGF0TG9jYXRpb24uVGVybWluYWw7XG5cdFx0XHRjYXNlIENoYXRBZ2VudExvY2F0aW9uLlBhbmVsOiByZXR1cm4gdHlwZXMuQ2hhdExvY2F0aW9uLlBhbmVsO1xuXHRcdFx0Y2FzZSBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0b3I6IHJldHVybiB0eXBlcy5DaGF0TG9jYXRpb24uRWRpdG9yO1xuXHRcdFx0Y2FzZSBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbjogcmV0dXJuIHR5cGVzLkNoYXRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbjtcblx0XHR9XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShsb2M6IHR5cGVzLkNoYXRMb2NhdGlvbik6IENoYXRBZ2VudExvY2F0aW9uIHtcblx0XHRzd2l0Y2ggKGxvYykge1xuXHRcdFx0Y2FzZSB0eXBlcy5DaGF0TG9jYXRpb24uTm90ZWJvb2s6IHJldHVybiBDaGF0QWdlbnRMb2NhdGlvbi5Ob3RlYm9vaztcblx0XHRcdGNhc2UgdHlwZXMuQ2hhdExvY2F0aW9uLlRlcm1pbmFsOiByZXR1cm4gQ2hhdEFnZW50TG9jYXRpb24uVGVybWluYWw7XG5cdFx0XHRjYXNlIHR5cGVzLkNoYXRMb2NhdGlvbi5QYW5lbDogcmV0dXJuIENoYXRBZ2VudExvY2F0aW9uLlBhbmVsO1xuXHRcdFx0Y2FzZSB0eXBlcy5DaGF0TG9jYXRpb24uRWRpdG9yOiByZXR1cm4gQ2hhdEFnZW50TG9jYXRpb24uRWRpdG9yO1xuXHRcdFx0Y2FzZSB0eXBlcy5DaGF0TG9jYXRpb24uRWRpdGluZ1Nlc3Npb246IHJldHVybiBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbjtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDaGF0UHJvbXB0UmVmZXJlbmNlIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHZhcmlhYmxlOiBJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5LCBkaWFnbm9zdGljczogcmVhZG9ubHkgW3ZzY29kZS5VcmksIHJlYWRvbmx5IHZzY29kZS5EaWFnbm9zdGljW11dW10pOiB2c2NvZGUuQ2hhdFByb21wdFJlZmVyZW5jZSB7XG5cdFx0bGV0IHZhbHVlOiB2c2NvZGUuQ2hhdFByb21wdFJlZmVyZW5jZVsndmFsdWUnXSA9IHZhcmlhYmxlLnZhbHVlO1xuXHRcdGlmICghdmFsdWUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCB2YWx1ZSByZWZlcmVuY2UnKTtcblx0XHR9XG5cblx0XHRpZiAoaXNVcmlDb21wb25lbnRzKHZhbHVlKSkge1xuXHRcdFx0dmFsdWUgPSBVUkkucmV2aXZlKHZhbHVlKTtcblx0XHR9IGVsc2UgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgJ3VyaScgaW4gdmFsdWUgJiYgJ3JhbmdlJyBpbiB2YWx1ZSAmJiBpc1VyaUNvbXBvbmVudHModmFsdWUudXJpKSkge1xuXHRcdFx0dmFsdWUgPSBMb2NhdGlvbi50byhyZXZpdmUodmFsdWUpKTtcblx0XHR9IGVsc2UgaWYgKHZhcmlhYmxlLmlzSW1hZ2UpIHtcblx0XHRcdGNvbnN0IHJlZiA9IHZhcmlhYmxlLnJlZmVyZW5jZXM/LlswXT8ucmVmZXJlbmNlO1xuXHRcdFx0dmFsdWUgPSBuZXcgdHlwZXMuQ2hhdFJlZmVyZW5jZUJpbmFyeURhdGEoXG5cdFx0XHRcdHZhcmlhYmxlLm1pbWVUeXBlID8/ICdpbWFnZS9wbmcnLFxuXHRcdFx0XHQoKSA9PiBQcm9taXNlLnJlc29sdmUobmV3IFVpbnQ4QXJyYXkoT2JqZWN0LnZhbHVlcyh2YXJpYWJsZS52YWx1ZSBhcyBudW1iZXJbXSkpKSxcblx0XHRcdFx0cmVmICYmIFVSSS5pc1VyaShyZWYpID8gcmVmIDogdW5kZWZpbmVkXG5cdFx0XHQpO1xuXHRcdH0gZWxzZSBpZiAodmFyaWFibGUua2luZCA9PT0gJ2RpYWdub3N0aWMnKSB7XG5cdFx0XHRjb25zdCBmaWx0ZXJTZXZlcml0eSA9IHZhcmlhYmxlLmZpbHRlclNldmVyaXR5ICYmIERpYWdub3N0aWNTZXZlcml0eS50byh2YXJpYWJsZS5maWx0ZXJTZXZlcml0eSk7XG5cdFx0XHRjb25zdCBmaWx0ZXJVcmkgPSB2YXJpYWJsZS5maWx0ZXJVcmkgJiYgVVJJLnJldml2ZSh2YXJpYWJsZS5maWx0ZXJVcmkpLnRvU3RyaW5nKCk7XG5cdFx0XHR2YWx1ZSA9IG5ldyB0eXBlcy5DaGF0UmVmZXJlbmNlRGlhZ25vc3RpYyhkaWFnbm9zdGljcy5tYXAoKFt1cmksIGRdKTogW3ZzY29kZS5VcmksIHZzY29kZS5EaWFnbm9zdGljW11dID0+IHtcblx0XHRcdFx0aWYgKHZhcmlhYmxlLmZpbHRlclVyaSAmJiB1cmkudG9TdHJpbmcoKSAhPT0gZmlsdGVyVXJpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFt1cmksIFtdXTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBbdXJpLCBkLmZpbHRlcihkID0+IHtcblx0XHRcdFx0XHRpZiAoZmlsdGVyU2V2ZXJpdHkgJiYgZC5zZXZlcml0eSA+IGZpbHRlclNldmVyaXR5KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICh2YXJpYWJsZS5maWx0ZXJSYW5nZSAmJiAhZWRpdG9yUmFuZ2UuUmFuZ2UuYXJlSW50ZXJzZWN0aW5nT3JUb3VjaGluZyh2YXJpYWJsZS5maWx0ZXJSYW5nZSwgUmFuZ2UuZnJvbShkLnJhbmdlKSkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSldO1xuXHRcdFx0fSkuZmlsdGVyKChbLCBkXSkgPT4gZC5sZW5ndGggPiAwKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkOiB2YXJpYWJsZS5pZCxcblx0XHRcdG5hbWU6IHZhcmlhYmxlLm5hbWUsXG5cdFx0XHRyYW5nZTogdmFyaWFibGUucmFuZ2UgJiYgW3ZhcmlhYmxlLnJhbmdlLnN0YXJ0LCB2YXJpYWJsZS5yYW5nZS5lbmRFeGNsdXNpdmVdLFxuXHRcdFx0dmFsdWUsXG5cdFx0XHRtb2RlbERlc2NyaXB0aW9uOiB2YXJpYWJsZS5tb2RlbERlc2NyaXB0aW9uLFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDaGF0TGFuZ3VhZ2VNb2RlbFRvb2xSZWZlcmVuY2Uge1xuXHRleHBvcnQgZnVuY3Rpb24gdG8odmFyaWFibGU6IElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnkpOiB2c2NvZGUuQ2hhdExhbmd1YWdlTW9kZWxUb29sUmVmZXJlbmNlIHtcblx0XHRjb25zdCB2YWx1ZSA9IHZhcmlhYmxlLnZhbHVlO1xuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHRvb2wgcmVmZXJlbmNlJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6IHZhcmlhYmxlLmlkLFxuXHRcdFx0cmFuZ2U6IHZhcmlhYmxlLnJhbmdlICYmIFt2YXJpYWJsZS5yYW5nZS5zdGFydCwgdmFyaWFibGUucmFuZ2UuZW5kRXhjbHVzaXZlXSxcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgQ2hhdEFnZW50Q29tcGxldGlvbkl0ZW0ge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShpdGVtOiB2c2NvZGUuQ2hhdENvbXBsZXRpb25JdGVtLCBjb21tYW5kc0NvbnZlcnRlcjogQ29tbWFuZHNDb252ZXJ0ZXIsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiBleHRIb3N0UHJvdG9jb2wuSUNoYXRBZ2VudENvbXBsZXRpb25JdGVtIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aWQ6IGl0ZW0uaWQsXG5cdFx0XHRsYWJlbDogaXRlbS5sYWJlbCxcblx0XHRcdGZ1bGxOYW1lOiBpdGVtLmZ1bGxOYW1lLFxuXHRcdFx0aWNvbjogaXRlbS5pY29uPy5pZCxcblx0XHRcdHZhbHVlOiBpdGVtLnZhbHVlc1swXS52YWx1ZSxcblx0XHRcdGluc2VydFRleHQ6IGl0ZW0uaW5zZXJ0VGV4dCxcblx0XHRcdGRldGFpbDogaXRlbS5kZXRhaWwsXG5cdFx0XHRkb2N1bWVudGF0aW9uOiBpdGVtLmRvY3VtZW50YXRpb24sXG5cdFx0XHRjb21tYW5kOiBjb21tYW5kc0NvbnZlcnRlci50b0ludGVybmFsKGl0ZW0uY29tbWFuZCwgZGlzcG9zYWJsZXMpLFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDaGF0QWdlbnRSZXN1bHQge1xuXHRleHBvcnQgZnVuY3Rpb24gdG8ocmVzdWx0OiBJQ2hhdEFnZW50UmVzdWx0KTogdnNjb2RlLkNoYXRSZXN1bHQge1xuXHRcdHJldHVybiB7XG5cdFx0XHRlcnJvckRldGFpbHM6IHJlc3VsdC5lcnJvckRldGFpbHMsXG5cdFx0XHRtZXRhZGF0YTogcmV2aXZlTWV0YWRhdGEocmVzdWx0Lm1ldGFkYXRhKSxcblx0XHRcdG5leHRRdWVzdGlvbjogcmVzdWx0Lm5leHRRdWVzdGlvbixcblx0XHR9O1xuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHJlc3VsdDogdnNjb2RlLkNoYXRSZXN1bHQpOiBEdG88SUNoYXRBZ2VudFJlc3VsdD4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRlcnJvckRldGFpbHM6IHJlc3VsdC5lcnJvckRldGFpbHMsXG5cdFx0XHRtZXRhZGF0YTogcmVzdWx0Lm1ldGFkYXRhLFxuXHRcdFx0bmV4dFF1ZXN0aW9uOiByZXN1bHQubmV4dFF1ZXN0aW9uLFxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiByZXZpdmVNZXRhZGF0YShtZXRhZGF0YTogSUNoYXRBZ2VudFJlc3VsdFsnbWV0YWRhdGEnXSkge1xuXHRcdHJldHVybiBjbG9uZUFuZENoYW5nZShtZXRhZGF0YSwgdmFsdWUgPT4ge1xuXHRcdFx0aWYgKHZhbHVlLiRtaWQgPT09IE1hcnNoYWxsZWRJZC5MYW5ndWFnZU1vZGVsVG9vbFJlc3VsdCkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkxhbmd1YWdlTW9kZWxUb29sUmVzdWx0KGNsb25lQW5kQ2hhbmdlKHZhbHVlLmNvbnRlbnQsIHJldml2ZU1ldGFkYXRhKSk7XG5cdFx0XHR9IGVsc2UgaWYgKHZhbHVlLiRtaWQgPT09IE1hcnNoYWxsZWRJZC5MYW5ndWFnZU1vZGVsVGV4dFBhcnQpIHtcblx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5MYW5ndWFnZU1vZGVsVGV4dFBhcnQodmFsdWUudmFsdWUpO1xuXHRcdFx0fSBlbHNlIGlmICh2YWx1ZS4kbWlkID09PSBNYXJzaGFsbGVkSWQuTGFuZ3VhZ2VNb2RlbFByb21wdFRzeFBhcnQpIHtcblx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5MYW5ndWFnZU1vZGVsUHJvbXB0VHN4UGFydCh2YWx1ZS52YWx1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDaGF0QWdlbnRVc2VyQWN0aW9uRXZlbnQge1xuXHRleHBvcnQgZnVuY3Rpb24gdG8ocmVzdWx0OiBJQ2hhdEFnZW50UmVzdWx0LCBldmVudDogSUNoYXRVc2VyQWN0aW9uRXZlbnQsIGNvbW1hbmRzQ29udmVydGVyOiBDb21tYW5kc0NvbnZlcnRlcik6IHZzY29kZS5DaGF0VXNlckFjdGlvbkV2ZW50IHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoZXZlbnQuYWN0aW9uLmtpbmQgPT09ICd2b3RlJykge1xuXHRcdFx0Ly8gSXMgdGhlIFwiZmVlZGJhY2tcIiB0eXBlXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWhSZXN1bHQgPSBDaGF0QWdlbnRSZXN1bHQudG8ocmVzdWx0KTtcblx0XHRpZiAoZXZlbnQuYWN0aW9uLmtpbmQgPT09ICdjb21tYW5kJykge1xuXHRcdFx0Y29uc3QgY29tbWFuZCA9IGV2ZW50LmFjdGlvbi5jb21tYW5kQnV0dG9uLmNvbW1hbmQ7XG5cdFx0XHRjb25zdCBjb21tYW5kQnV0dG9uID0ge1xuXHRcdFx0XHRjb21tYW5kOiBjb21tYW5kc0NvbnZlcnRlci5mcm9tSW50ZXJuYWwoY29tbWFuZCkgPz8geyBjb21tYW5kOiBjb21tYW5kLmlkLCB0aXRsZTogY29tbWFuZC50aXRsZSB9LFxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGNvbW1hbmRBY3Rpb246IHZzY29kZS5DaGF0Q29tbWFuZEFjdGlvbiA9IHsga2luZDogJ2NvbW1hbmQnLCBjb21tYW5kQnV0dG9uIH07XG5cdFx0XHRyZXR1cm4geyBhY3Rpb246IGNvbW1hbmRBY3Rpb24sIHJlc3VsdDogZWhSZXN1bHQgfTtcblx0XHR9IGVsc2UgaWYgKGV2ZW50LmFjdGlvbi5raW5kID09PSAnZm9sbG93VXAnKSB7XG5cdFx0XHRjb25zdCBmb2xsb3d1cEFjdGlvbjogdnNjb2RlLkNoYXRGb2xsb3d1cEFjdGlvbiA9IHsga2luZDogJ2ZvbGxvd1VwJywgZm9sbG93dXA6IENoYXRGb2xsb3d1cC50byhldmVudC5hY3Rpb24uZm9sbG93dXApIH07XG5cdFx0XHRyZXR1cm4geyBhY3Rpb246IGZvbGxvd3VwQWN0aW9uLCByZXN1bHQ6IGVoUmVzdWx0IH07XG5cdFx0fSBlbHNlIGlmIChldmVudC5hY3Rpb24ua2luZCA9PT0gJ2lubGluZUNoYXQnKSB7XG5cdFx0XHRyZXR1cm4geyBhY3Rpb246IHsga2luZDogJ2VkaXRvcicsIGFjY2VwdGVkOiBldmVudC5hY3Rpb24uYWN0aW9uID09PSAnYWNjZXB0ZWQnIH0sIHJlc3VsdDogZWhSZXN1bHQgfTtcblx0XHR9IGVsc2UgaWYgKGV2ZW50LmFjdGlvbi5raW5kID09PSAnY2hhdEVkaXRpbmdTZXNzaW9uQWN0aW9uJykge1xuXG5cdFx0XHRjb25zdCBvdXRjb21lcyA9IG5ldyBNYXAoW1xuXHRcdFx0XHRbJ2FjY2VwdGVkJywgdHlwZXMuQ2hhdEVkaXRpbmdTZXNzaW9uQWN0aW9uT3V0Y29tZS5BY2NlcHRlZF0sXG5cdFx0XHRcdFsncmVqZWN0ZWQnLCB0eXBlcy5DaGF0RWRpdGluZ1Nlc3Npb25BY3Rpb25PdXRjb21lLlJlamVjdGVkXSxcblx0XHRcdFx0WydzYXZlZCcsIHR5cGVzLkNoYXRFZGl0aW5nU2Vzc2lvbkFjdGlvbk91dGNvbWUuU2F2ZWRdLFxuXHRcdFx0XSk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGFjdGlvbjoge1xuXHRcdFx0XHRcdGtpbmQ6ICdjaGF0RWRpdGluZ1Nlc3Npb25BY3Rpb24nLFxuXHRcdFx0XHRcdG91dGNvbWU6IG91dGNvbWVzLmdldChldmVudC5hY3Rpb24ub3V0Y29tZSkgPz8gdHlwZXMuQ2hhdEVkaXRpbmdTZXNzaW9uQWN0aW9uT3V0Y29tZS5SZWplY3RlZCxcblx0XHRcdFx0XHR1cmk6IFVSSS5yZXZpdmUoZXZlbnQuYWN0aW9uLnVyaSksXG5cdFx0XHRcdFx0aGFzUmVtYWluaW5nRWRpdHM6IGV2ZW50LmFjdGlvbi5oYXNSZW1haW5pbmdFZGl0c1xuXHRcdFx0XHR9LCByZXN1bHQ6IGVoUmVzdWx0XG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4geyBhY3Rpb246IGV2ZW50LmFjdGlvbiwgcmVzdWx0OiBlaFJlc3VsdCB9O1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIFRlcm1pbmFsUXVpY2tGaXgge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShxdWlja0ZpeDogdnNjb2RlLlRlcm1pbmFsUXVpY2tGaXhUZXJtaW5hbENvbW1hbmQgfCB2c2NvZGUuVGVybWluYWxRdWlja0ZpeE9wZW5lciB8IHZzY29kZS5Db21tYW5kLCBjb252ZXJ0ZXI6IENvbW1hbmQuSUNvbW1hbmRzQ29udmVydGVyLCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKTogZXh0SG9zdFByb3RvY29sLklUZXJtaW5hbFF1aWNrRml4VGVybWluYWxDb21tYW5kRHRvIHwgZXh0SG9zdFByb3RvY29sLklUZXJtaW5hbFF1aWNrRml4T3BlbmVyRHRvIHwgZXh0SG9zdFByb3RvY29sLklDb21tYW5kRHRvIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoJ3Rlcm1pbmFsQ29tbWFuZCcgaW4gcXVpY2tGaXgpIHtcblx0XHRcdHJldHVybiB7IHRlcm1pbmFsQ29tbWFuZDogcXVpY2tGaXgudGVybWluYWxDb21tYW5kLCBzaG91bGRFeGVjdXRlOiBxdWlja0ZpeC5zaG91bGRFeGVjdXRlIH07XG5cdFx0fVxuXHRcdGlmICgndXJpJyBpbiBxdWlja0ZpeCkge1xuXHRcdFx0cmV0dXJuIHsgdXJpOiBxdWlja0ZpeC51cmkgfTtcblx0XHR9XG5cdFx0cmV0dXJuIGNvbnZlcnRlci50b0ludGVybmFsKHF1aWNrRml4LCBkaXNwb3NhYmxlcyk7XG5cdH1cbn1cbmV4cG9ydCBuYW1lc3BhY2UgVGVybWluYWxDb21wbGV0aW9uSXRlbUR0byB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGl0ZW06IHZzY29kZS5UZXJtaW5hbENvbXBsZXRpb25JdGVtKTogZXh0SG9zdFByb3RvY29sLklUZXJtaW5hbENvbXBsZXRpb25JdGVtRHRvIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4uaXRlbSxcblx0XHRcdGRvY3VtZW50YXRpb246IE1hcmtkb3duU3RyaW5nLmZyb21TdHJpY3QoaXRlbS5kb2N1bWVudGF0aW9uKSxcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgVGVybWluYWxDb21wbGV0aW9uTGlzdCB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGNvbXBsZXRpb25zOiB2c2NvZGUuVGVybWluYWxDb21wbGV0aW9uTGlzdCB8IHZzY29kZS5UZXJtaW5hbENvbXBsZXRpb25JdGVtW10pOiBleHRIb3N0UHJvdG9jb2wuVGVybWluYWxDb21wbGV0aW9uTGlzdER0byB7XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoY29tcGxldGlvbnMpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpdGVtczogY29tcGxldGlvbnMubWFwKGkgPT4gVGVybWluYWxDb21wbGV0aW9uSXRlbUR0by5mcm9tKGkpKSxcblx0XHRcdH07XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRpdGVtczogY29tcGxldGlvbnMuaXRlbXMubWFwKGkgPT4gVGVybWluYWxDb21wbGV0aW9uSXRlbUR0by5mcm9tKGkpKSxcblx0XHRcdHJlc291cmNlUmVxdWVzdENvbmZpZzogY29tcGxldGlvbnMucmVzb3VyY2VSZXF1ZXN0Q29uZmlnID8gVGVybWluYWxSZXNvdXJjZVJlcXVlc3RDb25maWcuZnJvbShjb21wbGV0aW9ucy5yZXNvdXJjZVJlcXVlc3RDb25maWcpIDogdW5kZWZpbmVkLFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBUZXJtaW5hbFJlc291cmNlUmVxdWVzdENvbmZpZyB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHJlc291cmNlUmVxdWVzdENvbmZpZzogdnNjb2RlLlRlcm1pbmFsUmVzb3VyY2VSZXF1ZXN0Q29uZmlnKTogZXh0SG9zdFByb3RvY29sLlRlcm1pbmFsUmVzb3VyY2VSZXF1ZXN0Q29uZmlnRHRvIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4ucmVzb3VyY2VSZXF1ZXN0Q29uZmlnLFxuXHRcdFx0cGF0aFNlcGFyYXRvcjogaXNXaW5kb3dzID8gJ1xcXFwnIDogJy8nLFxuXHRcdFx0Y3dkOiByZXNvdXJjZVJlcXVlc3RDb25maWcuY3dkID8gVVJJLnJldml2ZShyZXNvdXJjZVJlcXVlc3RDb25maWcuY3dkKSA6IHVuZGVmaW5lZCxcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgUGFydGlhbEFjY2VwdEluZm8ge1xuXHRleHBvcnQgZnVuY3Rpb24gdG8oaW5mbzogbGFuZ3VhZ2VzLlBhcnRpYWxBY2NlcHRJbmZvKTogdHlwZXMuUGFydGlhbEFjY2VwdEluZm8ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRraW5kOiBQYXJ0aWFsQWNjZXB0VHJpZ2dlcktpbmQudG8oaW5mby5raW5kKSxcblx0XHRcdGFjY2VwdGVkTGVuZ3RoOiBpbmZvLmFjY2VwdGVkTGVuZ3RoLFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBQYXJ0aWFsQWNjZXB0VHJpZ2dlcktpbmQge1xuXHRleHBvcnQgZnVuY3Rpb24gdG8oa2luZDogbGFuZ3VhZ2VzLlBhcnRpYWxBY2NlcHRUcmlnZ2VyS2luZCk6IHR5cGVzLlBhcnRpYWxBY2NlcHRUcmlnZ2VyS2luZCB7XG5cdFx0c3dpdGNoIChraW5kKSB7XG5cdFx0XHRjYXNlIGxhbmd1YWdlcy5QYXJ0aWFsQWNjZXB0VHJpZ2dlcktpbmQuV29yZDpcblx0XHRcdFx0cmV0dXJuIHR5cGVzLlBhcnRpYWxBY2NlcHRUcmlnZ2VyS2luZC5Xb3JkO1xuXHRcdFx0Y2FzZSBsYW5ndWFnZXMuUGFydGlhbEFjY2VwdFRyaWdnZXJLaW5kLkxpbmU6XG5cdFx0XHRcdHJldHVybiB0eXBlcy5QYXJ0aWFsQWNjZXB0VHJpZ2dlcktpbmQuTGluZTtcblx0XHRcdGNhc2UgbGFuZ3VhZ2VzLlBhcnRpYWxBY2NlcHRUcmlnZ2VyS2luZC5TdWdnZXN0OlxuXHRcdFx0XHRyZXR1cm4gdHlwZXMuUGFydGlhbEFjY2VwdFRyaWdnZXJLaW5kLlN1Z2dlc3Q7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gdHlwZXMuUGFydGlhbEFjY2VwdFRyaWdnZXJLaW5kLlVua25vd247XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgRGVidWdUcmVlSXRlbSB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGl0ZW06IHZzY29kZS5EZWJ1Z1RyZWVJdGVtLCBpZDogbnVtYmVyKTogSURlYnVnVmlzdWFsaXphdGlvblRyZWVJdGVtIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aWQsXG5cdFx0XHRsYWJlbDogaXRlbS5sYWJlbCxcblx0XHRcdGRlc2NyaXB0aW9uOiBpdGVtLmRlc2NyaXB0aW9uLFxuXHRcdFx0Y2FuRWRpdDogaXRlbS5jYW5FZGl0LFxuXHRcdFx0Y29sbGFwc2libGVTdGF0ZTogKGl0ZW0uY29sbGFwc2libGVTdGF0ZSB8fCBEZWJ1Z1RyZWVJdGVtQ29sbGFwc2libGVTdGF0ZS5Ob25lKSBhcyBEZWJ1Z1RyZWVJdGVtQ29sbGFwc2libGVTdGF0ZSxcblx0XHRcdGNvbnRleHRWYWx1ZTogaXRlbS5jb250ZXh0VmFsdWUsXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIExhbmd1YWdlTW9kZWxUb29sRGVzY3JpcHRpb24ge1xuXHRleHBvcnQgZnVuY3Rpb24gdG8oaXRlbTogSVRvb2xEYXRhKTogdnNjb2RlLkxhbmd1YWdlTW9kZWxUb29sSW5mb3JtYXRpb24ge1xuXHRcdHJldHVybiB7XG5cdFx0XHQvLyBOb3RlLSB0aGUgcmVhc29uIHRoaXMgaXMgYSB1bmlxdWUgJ25hbWUnIGlzIGp1c3QgdG8gYXZvaWQgY29uZnVzaW9uIHdpdGggdGhlIHRvb2xDYWxsSWRcblx0XHRcdG5hbWU6IGl0ZW0uaWQsXG5cdFx0XHRkZXNjcmlwdGlvbjogaXRlbS5tb2RlbERlc2NyaXB0aW9uLFxuXHRcdFx0aW5wdXRTY2hlbWE6IGl0ZW0uaW5wdXRTY2hlbWEsXG5cdFx0XHR0YWdzOiBpdGVtLnRhZ3MgPz8gW10sXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIExhbmd1YWdlTW9kZWxUb29sUmVzdWx0IHtcblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHJlc3VsdDogSVRvb2xSZXN1bHQpOiB2c2NvZGUuTGFuZ3VhZ2VNb2RlbFRvb2xSZXN1bHQge1xuXHRcdHJldHVybiBuZXcgdHlwZXMuTGFuZ3VhZ2VNb2RlbFRvb2xSZXN1bHQocmVzdWx0LmNvbnRlbnQubWFwKGl0ZW0gPT4ge1xuXHRcdFx0aWYgKGl0ZW0ua2luZCA9PT0gJ3RleHQnKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgdHlwZXMuTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0KGl0ZW0udmFsdWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5MYW5ndWFnZU1vZGVsUHJvbXB0VHN4UGFydChpdGVtLnZhbHVlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShyZXN1bHQ6IHZzY29kZS5FeHRlbmRlZExhbmd1YWdlTW9kZWxUb29sUmVzdWx0LCBleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbik6IER0bzxJVG9vbFJlc3VsdD4ge1xuXHRcdGlmIChyZXN1bHQudG9vbFJlc3VsdE1lc3NhZ2UpIHtcblx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ2NoYXRQYXJ0aWNpcGFudFByaXZhdGUnKTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Y29udGVudDogcmVzdWx0LmNvbnRlbnQubWFwKGl0ZW0gPT4ge1xuXHRcdFx0XHRpZiAoaXRlbSBpbnN0YW5jZW9mIHR5cGVzLkxhbmd1YWdlTW9kZWxUZXh0UGFydCkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRraW5kOiAndGV4dCcsXG5cdFx0XHRcdFx0XHR2YWx1ZTogaXRlbS52YWx1ZVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0gZWxzZSBpZiAoaXRlbSBpbnN0YW5jZW9mIHR5cGVzLkxhbmd1YWdlTW9kZWxQcm9tcHRUc3hQYXJ0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGtpbmQ6ICdwcm9tcHRUc3gnLFxuXHRcdFx0XHRcdFx0dmFsdWU6IGl0ZW0udmFsdWUsXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gTGFuZ3VhZ2VNb2RlbFRvb2xSZXN1bHQgcGFydCB0eXBlJyk7XG5cdFx0XHRcdH1cblx0XHRcdH0pLFxuXHRcdFx0dG9vbFJlc3VsdE1lc3NhZ2U6IE1hcmtkb3duU3RyaW5nLmZyb21TdHJpY3QocmVzdWx0LnRvb2xSZXN1bHRNZXNzYWdlKSxcblx0XHRcdHRvb2xSZXN1bHREZXRhaWxzOiByZXN1bHQudG9vbFJlc3VsdERldGFpbHM/Lm1hcChkZXRhaWwgPT4gVVJJLmlzVXJpKGRldGFpbCkgPyBkZXRhaWwgOiBMb2NhdGlvbi5mcm9tKGRldGFpbCBhcyB2c2NvZGUuTG9jYXRpb24pKSxcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgSWNvblBhdGgge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbVRoZW1lSWNvbihpY29uUGF0aDogdnNjb2RlLlRoZW1lSWNvbik6IGxhbmd1YWdlcy5JY29uUGF0aCB7XG5cdFx0cmV0dXJuIGljb25QYXRoO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLFNBQVMsVUFBVSx1QkFBdUI7QUFDbkQsU0FBUyxVQUFVLG9CQUFvQjtBQUN2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QUEsRUFDRDtBQXhCTyxFQUFBQSx5QkFBUztBQUFBLEdBWEE7QUFzQ1YsSUFBVTtBQUFBLENBQVYsQ0FBVUMsY0FBVjtBQUNDLFdBQVMsY0FBYyxVQUFnRDtBQUM3RSxXQUFPO0FBQUEsRUFDUjtBQUZPLEVBQUFBLFVBQVM7QUFBQSxHQURBOyIsCiAgIm5hbWVzIjogWyJTZWxlY3Rpb24iLCAiUmFuZ2UiLCAiTG9jYXRpb24iLCAibG9jYXRpb24iLCAiVG9rZW5UeXBlIiwgIlBvc2l0aW9uIiwgIkRvY3VtZW50U2VsZWN0b3IiLCAiRGlhZ25vc3RpY1RhZyIsICJEaWFnbm9zdGljIiwgIkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24iLCAiRGlhZ25vc3RpY1NldmVyaXR5IiwgIlZpZXdDb2x1bW4iLCAiTWFya2Rvd25TdHJpbmciLCAiVGhlbWFibGVEZWNvcmF0aW9uQXR0YWNobWVudFJlbmRlck9wdGlvbnMiLCAiVGhlbWFibGVEZWNvcmF0aW9uUmVuZGVyT3B0aW9ucyIsICJEZWNvcmF0aW9uUmFuZ2VCZWhhdmlvciIsICJEZWNvcmF0aW9uUmVuZGVyT3B0aW9ucyIsICJUZXh0RWRpdCIsICJXb3Jrc3BhY2VFZGl0IiwgIlN5bWJvbEtpbmQiLCAiU3ltYm9sVGFnIiwgIldvcmtzcGFjZVN5bWJvbCIsICJEb2N1bWVudFN5bWJvbCIsICJDYWxsSGllcmFyY2h5SXRlbSIsICJDYWxsSGllcmFyY2h5SW5jb21pbmdDYWxsIiwgIkNhbGxIaWVyYXJjaHlPdXRnb2luZ0NhbGwiLCAiRGVmaW5pdGlvbkxpbmsiLCAiSG92ZXIiLCAiRXZhbHVhdGFibGVFeHByZXNzaW9uIiwgIklubGluZVZhbHVlIiwgIklubGluZVZhbHVlQ29udGV4dCIsICJEb2N1bWVudEhpZ2hsaWdodCIsICJNdWx0aURvY3VtZW50SGlnaGxpZ2h0IiwgIkNvbXBsZXRpb25UcmlnZ2VyS2luZCIsICJDb21wbGV0aW9uQ29udGV4dCIsICJDb21wbGV0aW9uSXRlbVRhZyIsICJDb21wbGV0aW9uSXRlbUtpbmQiLCAiQ29tcGxldGlvbkl0ZW0iLCAiUGFyYW1ldGVySW5mb3JtYXRpb24iLCAiU2lnbmF0dXJlSW5mb3JtYXRpb24iLCAiU2lnbmF0dXJlSGVscCIsICJJbmxheUhpbnQiLCAiSW5sYXlIaW50TGFiZWxQYXJ0IiwgIklubGF5SGludEtpbmQiLCAiRG9jdW1lbnRMaW5rIiwgIkNvbG9yUHJlc2VudGF0aW9uIiwgIkNvbG9yIiwgIlNlbGVjdGlvblJhbmdlIiwgIlRleHREb2N1bWVudFNhdmVSZWFzb24iLCAiVGV4dEVkaXRvckxpbmVOdW1iZXJzU3R5bGUiLCAiRW5kT2ZMaW5lIiwgIlByb2dyZXNzTG9jYXRpb24iLCAiRm9sZGluZ1JhbmdlIiwgIkZvbGRpbmdSYW5nZUtpbmQiLCAiVGV4dEVkaXRvck9wZW5PcHRpb25zIiwgIkdsb2JQYXR0ZXJuIiwgIkxhbmd1YWdlU2VsZWN0b3IiLCAiTm90ZWJvb2tSYW5nZSIsICJOb3RlYm9va0NlbGxFeGVjdXRpb25TdW1tYXJ5IiwgIk5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlIiwgIk5vdGVib29rQ2VsbEtpbmQiLCAiTm90ZWJvb2tEYXRhIiwgIk5vdGVib29rQ2VsbERhdGEiLCAiTm90ZWJvb2tDZWxsT3V0cHV0SXRlbSIsICJOb3RlYm9va0NlbGxPdXRwdXQiLCAiTm90ZWJvb2tFeGNsdXNpdmVEb2N1bWVudFBhdHRlcm4iLCAiTm90ZWJvb2tTdGF0dXNCYXJJdGVtIiwgIk5vdGVib29rS2VybmVsU291cmNlQWN0aW9uIiwgIk5vdGVib29rRG9jdW1lbnRDb250ZW50T3B0aW9ucyIsICJOb3RlYm9va1JlbmRlcmVyU2NyaXB0IiwgIlRlc3RNZXNzYWdlIiwgIlRlc3RUYWciLCAiVGVzdFJ1blByb2ZpbGUiLCAiVGVzdFJ1blByb2ZpbGVLaW5kIiwgIlRlc3RJdGVtIiwgIlRlc3RSZXN1bHRzIiwgIlRlc3RDb3ZlcmFnZSIsICJDb2RlQWN0aW9uVHJpZ2dlcktpbmQiLCAiVHlwZUhpZXJhcmNoeUl0ZW0iLCAiVmlld0JhZGdlIiwgIkRhdGFUcmFuc2Zlckl0ZW0iLCAiRGF0YVRyYW5zZmVyIiwgIkNoYXRGb2xsb3d1cCIsICJMYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2VSb2xlIiwgIkxhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZSIsICJjb250ZW50IiwgIkxhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZTIiLCAiQ2hhdFJlc3BvbnNlTWFya2Rvd25QYXJ0IiwgIkNoYXRSZXNwb25zZUNvZGVibG9ja1VyaVBhcnQiLCAiQ2hhdFJlc3BvbnNlTWFya2Rvd25XaXRoVnVsbmVyYWJpbGl0aWVzUGFydCIsICJDaGF0UmVzcG9uc2VDb25maXJtYXRpb25QYXJ0IiwgIkNoYXRSZXNwb25zZUZpbGVzUGFydCIsICJiYXNlVXJpIiwgIml0ZW1zIiwgIkNoYXRSZXNwb25zZUFuY2hvclBhcnQiLCAiQ2hhdFJlc3BvbnNlUHJvZ3Jlc3NQYXJ0IiwgIkNoYXRSZXNwb25zZVdhcm5pbmdQYXJ0IiwgIkNoYXRSZXNwb25zZU1vdmVQYXJ0IiwgIkNoYXRUYXNrIiwgIkNoYXRUYXNrUmVzdWx0IiwgIkNoYXRSZXNwb25zZUNvbW1hbmRCdXR0b25QYXJ0IiwgIkNoYXRSZXNwb25zZVRleHRFZGl0UGFydCIsICJOb3RlYm9va0VkaXQiLCAiQ2hhdFJlc3BvbnNlTm90ZWJvb2tFZGl0UGFydCIsICJDaGF0UmVzcG9uc2VSZWZlcmVuY2VQYXJ0IiwgInZhbHVlIiwgIkNoYXRSZXNwb25zZUNvZGVDaXRhdGlvblBhcnQiLCAiQ2hhdFJlc3BvbnNlUGFydCIsICJDaGF0QWdlbnRSZXF1ZXN0IiwgIkNoYXRSZXF1ZXN0RHJhZnQiLCAiQ2hhdExvY2F0aW9uIiwgIkNoYXRQcm9tcHRSZWZlcmVuY2UiLCAiZCIsICJDaGF0TGFuZ3VhZ2VNb2RlbFRvb2xSZWZlcmVuY2UiLCAiQ2hhdEFnZW50Q29tcGxldGlvbkl0ZW0iLCAiQ2hhdEFnZW50UmVzdWx0IiwgIkNoYXRBZ2VudFVzZXJBY3Rpb25FdmVudCIsICJUZXJtaW5hbFF1aWNrRml4IiwgIlRlcm1pbmFsQ29tcGxldGlvbkl0ZW1EdG8iLCAiVGVybWluYWxDb21wbGV0aW9uTGlzdCIsICJUZXJtaW5hbFJlc291cmNlUmVxdWVzdENvbmZpZyIsICJQYXJ0aWFsQWNjZXB0SW5mbyIsICJQYXJ0aWFsQWNjZXB0VHJpZ2dlcktpbmQiLCAiRGVidWdUcmVlSXRlbSIsICJMYW5ndWFnZU1vZGVsVG9vbERlc2NyaXB0aW9uIiwgIkxhbmd1YWdlTW9kZWxUb29sUmVzdWx0IiwgIkljb25QYXRoIl0KfQo=
