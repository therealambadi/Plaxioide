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
import { CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { onUnexpectedExternalError } from "../../../../../../base/common/errors.js";
import { Event } from "../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../../base/common/map.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import { format } from "../../../../../../base/common/strings.js";
import { Position } from "../../../../../../editor/common/core/position.js";
import { Range } from "../../../../../../editor/common/core/range.js";
import { StandardTokenType } from "../../../../../../editor/common/encodedTokenAttributes.js";
import { ILanguageFeaturesService } from "../../../../../../editor/common/services/languageFeatures.js";
import { localize } from "../../../../../../nls.js";
import { registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { createInlineValueDecoration } from "../../../../debug/browser/debugEditorContribution.js";
import { IDebugService, State } from "../../../../debug/common/debug.js";
import { NotebookSetting } from "../../../common/notebookCommon.js";
import { INotebookExecutionStateService, NotebookExecutionType } from "../../../common/notebookExecutionStateService.js";
import { INotebookKernelService } from "../../../common/notebookKernelService.js";
import { NotebookAction } from "../../controller/coreActions.js";
import { registerNotebookContribution } from "../../notebookEditorExtensions.js";
class InlineSegment {
  constructor(column, text) {
    this.column = column;
    this.text = text;
  }
}
let NotebookInlineVariablesController = class extends Disposable {
  // Skip extremely large cells
  constructor(notebookEditor, notebookKernelService, notebookExecutionStateService, languageFeaturesService, configurationService, debugService) {
    super();
    this.notebookEditor = notebookEditor;
    this.notebookKernelService = notebookKernelService;
    this.notebookExecutionStateService = notebookExecutionStateService;
    this.languageFeaturesService = languageFeaturesService;
    this.configurationService = configurationService;
    this.debugService = debugService;
    this.cellDecorationIds = /* @__PURE__ */ new Map();
    this.cellContentListeners = new ResourceMap();
    this.currentCancellationTokenSources = new ResourceMap();
    this._register(this.notebookExecutionStateService.onDidChangeExecution(async (e) => {
      const inlineValuesSetting = this.configurationService.getValue(NotebookSetting.notebookInlineValues);
      if (inlineValuesSetting === "off") {
        return;
      }
      if (e.type === NotebookExecutionType.cell) {
        await this.updateInlineVariables(e);
      }
    }));
    this._register(Event.runAndSubscribe(this.configurationService.onDidChangeConfiguration, (e) => {
      if (!e || e.affectsConfiguration(NotebookSetting.notebookInlineValues)) {
        if (this.configurationService.getValue(NotebookSetting.notebookInlineValues) === "off") {
          this.clearNotebookInlineDecorations();
        }
      }
    }));
  }
  async updateInlineVariables(event) {
    if (event.changed) {
      return;
    }
    const cell = this.notebookEditor.getCellByHandle(event.cellHandle);
    if (!cell) {
      return;
    }
    const existingSource = this.currentCancellationTokenSources.get(cell.uri);
    if (existingSource) {
      existingSource.cancel();
    }
    this.currentCancellationTokenSources.set(cell.uri, new CancellationTokenSource());
    const token = this.currentCancellationTokenSources.get(cell.uri).token;
    if (this.debugService.state !== State.Inactive) {
      this._clearNotebookInlineDecorations();
      return;
    }
    if (!this.notebookEditor.textModel?.uri || !isEqual(this.notebookEditor.textModel.uri, event.notebook)) {
      return;
    }
    const model = await cell.resolveTextModel();
    if (!model) {
      return;
    }
    const inlineValuesSetting = this.configurationService.getValue(NotebookSetting.notebookInlineValues);
    const hasInlineValueProvider = this.languageFeaturesService.inlineValuesProvider.has(model);
    if (inlineValuesSetting === "off" || inlineValuesSetting === "auto" && !hasInlineValueProvider) {
      return;
    }
    this.clearCellInlineDecorations(cell);
    const inlineDecorations = [];
    if (hasInlineValueProvider) {
      const lastLine = model.getLineCount();
      const lastColumn = model.getLineMaxColumn(lastLine);
      const ctx = {
        frameId: 0,
        // ignored, we won't have a stack from since not in a debug session
        stoppedLocation: new Range(lastLine, lastColumn, lastLine, lastColumn)
        // executing cell by cell, so "stopped" location would just be the end of document
      };
      const providers = this.languageFeaturesService.inlineValuesProvider.ordered(model).reverse();
      const lineDecorations = /* @__PURE__ */ new Map();
      const fullCellRange = new Range(1, 1, lastLine, lastColumn);
      const promises = providers.flatMap((provider) => Promise.resolve(provider.provideInlineValues(model, fullCellRange, ctx, token)).then(async (result) => {
        if (!result) {
          return;
        }
        const notebook = this.notebookEditor.textModel;
        if (!notebook) {
          return;
        }
        const kernel = this.notebookKernelService.getMatchingKernel(notebook);
        const kernelVars = [];
        if (result.some((iv) => iv.type === "variable")) {
          if (!this.notebookEditor.hasModel()) {
            return;
          }
          const variables = kernel.selected?.provideVariables(event.notebook, void 0, "named", 0, token);
          if (variables) {
            for await (const v of variables) {
              kernelVars.push(v);
            }
          }
        }
        for (const iv of result) {
          let text = void 0;
          switch (iv.type) {
            case "text":
              text = iv.text;
              break;
            case "variable": {
              const name = iv.variableName;
              if (!name) {
                continue;
              }
              const value = kernelVars.find((v) => v.name === name)?.value;
              if (!value) {
                continue;
              }
              text = format("{0} = {1}", name, value);
              break;
            }
            case "expression": {
              continue;
            }
          }
          if (text) {
            const line = iv.range.startLineNumber;
            let lineSegments = lineDecorations.get(line);
            if (!lineSegments) {
              lineSegments = [];
              lineDecorations.set(line, lineSegments);
            }
            if (!lineSegments.some((iv2) => iv2.text === text)) {
              lineSegments.push(new InlineSegment(iv.range.startColumn, text));
            }
          }
        }
      }, (err) => {
        onUnexpectedExternalError(err);
      }));
      await Promise.all(promises);
      lineDecorations.forEach((segments, line) => {
        if (segments.length > 0) {
          segments.sort((a, b) => a.column - b.column);
          const text = segments.map((s) => s.text).join(", ");
          const editorWidth = cell.layoutInfo.editorWidth;
          const fontInfo = cell.layoutInfo.fontInfo;
          if (fontInfo && cell.textModel) {
            const base = Math.floor((editorWidth - 50) / fontInfo.typicalHalfwidthCharacterWidth);
            const lineLength = cell.textModel.getLineLength(line);
            const available = Math.max(0, base - lineLength);
            inlineDecorations.push(...createInlineValueDecoration(line, text, "nb", void 0, available));
          } else {
            inlineDecorations.push(...createInlineValueDecoration(line, text, "nb"));
          }
        }
      });
    } else if (inlineValuesSetting === "on") {
      if (!this.notebookEditor.hasModel()) {
        return;
      }
      const kernel = this.notebookKernelService.getMatchingKernel(this.notebookEditor.textModel);
      const variables = kernel?.selected?.provideVariables(event.notebook, void 0, "named", 0, token);
      if (!variables) {
        return;
      }
      const vars = [];
      for await (const v of variables) {
        vars.push(v);
      }
      const varNames = vars.map((v) => v.name);
      const document = cell.textModel;
      if (!document) {
        return;
      }
      if (document.getLineCount() > NotebookInlineVariablesController.MAX_CELL_LINES) {
        return;
      }
      const inlineDecorations2 = [];
      const processedVars = /* @__PURE__ */ new Set();
      const functionRanges = this.getFunctionRanges(document);
      const commentedRanges = this.getCommentedRanges(document);
      const ignoredRanges = [...functionRanges, ...commentedRanges];
      const lineDecorations = /* @__PURE__ */ new Map();
      for (const varName of varNames) {
        if (processedVars.has(varName)) {
          continue;
        }
        const regex = new RegExp(`\\b${varName}\\b(?!\\w)`, "g");
        let lastMatchOutsideIgnored = null;
        let foundMatch = false;
        const lines = document.getValue().split("\n");
        for (let lineNumber = lines.length - 1; lineNumber >= 0; lineNumber--) {
          const line = lines[lineNumber];
          let match;
          while ((match = regex.exec(line)) !== null) {
            const startIndex = match.index;
            const pos = new Position(lineNumber + 1, startIndex + 1);
            if (!this.isPositionInRanges(pos, ignoredRanges)) {
              lastMatchOutsideIgnored = {
                line: lineNumber + 1,
                column: startIndex + 1
              };
              foundMatch = true;
              break;
            }
          }
          if (foundMatch) {
            break;
          }
        }
        if (lastMatchOutsideIgnored) {
          const inlineVal = varName + " = " + vars.find((v) => v.name === varName)?.value;
          let lineSegments = lineDecorations.get(lastMatchOutsideIgnored.line);
          if (!lineSegments) {
            lineSegments = [];
            lineDecorations.set(lastMatchOutsideIgnored.line, lineSegments);
          }
          if (!lineSegments.some((iv) => iv.text === inlineVal)) {
            lineSegments.push(new InlineSegment(lastMatchOutsideIgnored.column, inlineVal));
          }
        }
        processedVars.add(varName);
      }
      lineDecorations.forEach((segments, line) => {
        if (segments.length > 0) {
          segments.sort((a, b) => a.column - b.column);
          const text = segments.map((s) => s.text).join(", ");
          const editorWidth = cell.layoutInfo.editorWidth;
          const fontInfo = cell.layoutInfo.fontInfo;
          if (fontInfo && cell.textModel) {
            const base = Math.floor((editorWidth - 50) / fontInfo.typicalHalfwidthCharacterWidth);
            const lineLength = cell.textModel.getLineLength(line);
            const available = Math.max(0, base - lineLength);
            inlineDecorations2.push(...createInlineValueDecoration(line, text, "nb", void 0, available));
          } else {
            inlineDecorations2.push(...createInlineValueDecoration(line, text, "nb"));
          }
        }
      });
      if (inlineDecorations2.length > 0) {
        this.updateCellInlineDecorations(cell, inlineDecorations2);
        this.initCellContentListener(cell);
      }
    }
  }
  getFunctionRanges(document) {
    return document.getLanguageId() === "python" ? this.getPythonFunctionRanges(document.getValue()) : this.getBracedFunctionRanges(document.getValue());
  }
  getPythonFunctionRanges(code) {
    const functionRanges = [];
    const lines = code.split("\n");
    let functionStartLine = -1;
    let inFunction = false;
    let pythonIndentLevel = -1;
    const pythonFunctionDeclRegex = /^(\s*)(async\s+)?(?:def\s+\w+|class\s+\w+)\s*\([^)]*\)\s*:/;
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];
      const pythonMatch = line.match(pythonFunctionDeclRegex);
      if (pythonMatch) {
        if (inFunction) {
          const currentIndent = pythonMatch[1].length;
          if (currentIndent <= pythonIndentLevel) {
            functionRanges.push(new Range(functionStartLine + 1, 1, lineNumber, line.length + 1));
            inFunction = false;
          }
        }
        if (!inFunction) {
          inFunction = true;
          functionStartLine = lineNumber;
          pythonIndentLevel = pythonMatch[1].length;
        }
        continue;
      }
      if (inFunction) {
        if (line.trim() === "") {
          continue;
        }
        const currentIndent = line.match(/^\s*/)?.[0].length ?? 0;
        if (currentIndent <= pythonIndentLevel) {
          functionRanges.push(new Range(functionStartLine + 1, 1, lineNumber, line.length + 1));
          inFunction = false;
          pythonIndentLevel = -1;
        }
      }
    }
    if (inFunction) {
      functionRanges.push(new Range(functionStartLine + 1, 1, lines.length, lines[lines.length - 1].length + 1));
    }
    return functionRanges;
  }
  getBracedFunctionRanges(code) {
    const functionRanges = [];
    const lines = code.split("\n");
    let braceDepth = 0;
    let functionStartLine = -1;
    let inFunction = false;
    const functionDeclRegex = /\b(?:function\s+\w+|(?:async\s+)?(?:\w+\s*=\s*)?\([^)]*\)\s*=>|class\s+\w+|(?:public|private|protected|static)?\s*\w+\s*\([^)]*\)\s*{)/;
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];
      for (const char of line) {
        if (char === "{") {
          if (!inFunction && functionDeclRegex.test(line)) {
            inFunction = true;
            functionStartLine = lineNumber;
          }
          braceDepth++;
        } else if (char === "}") {
          braceDepth--;
          if (braceDepth === 0 && inFunction) {
            functionRanges.push(new Range(functionStartLine + 1, 1, lineNumber + 1, line.length + 1));
            inFunction = false;
          }
        }
      }
    }
    return functionRanges;
  }
  getCommentedRanges(document) {
    return this._getCommentedRanges(document);
  }
  _getCommentedRanges(document) {
    try {
      return this.getCommentedRangesByAccurateTokenization(document);
    } catch (e) {
      return this.getCommentedRangesByManualParsing(document);
    }
  }
  getCommentedRangesByAccurateTokenization(document) {
    const commentRanges = [];
    const lineCount = document.getLineCount();
    if (lineCount > NotebookInlineVariablesController.MAX_CELL_LINES) {
      return commentRanges;
    }
    for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
      if (!document.tokenization.hasAccurateTokensForLine(lineNumber)) {
        document.tokenization.forceTokenization(lineNumber);
      }
      const lineTokens = document.tokenization.getLineTokens(lineNumber);
      if (lineTokens.getCount() === 0) {
        continue;
      }
      let startCharacter;
      for (let tokenIndex = 0; tokenIndex < lineTokens.getCount(); tokenIndex++) {
        const tokenType = lineTokens.getStandardTokenType(tokenIndex);
        if (tokenType === StandardTokenType.Comment || tokenType === StandardTokenType.String || tokenType === StandardTokenType.RegEx) {
          if (startCharacter === void 0) {
            startCharacter = lineTokens.getStartOffset(tokenIndex);
          }
          const endCharacter = lineTokens.getEndOffset(tokenIndex);
          const isLastToken = tokenIndex === lineTokens.getCount() - 1;
          const nextTokenDifferent = !isLastToken && lineTokens.getStandardTokenType(tokenIndex + 1) !== tokenType;
          if (isLastToken || nextTokenDifferent) {
            commentRanges.push(new Range(lineNumber, startCharacter + 1, lineNumber, endCharacter + 1));
            startCharacter = void 0;
          }
        } else {
          startCharacter = void 0;
        }
      }
    }
    return commentRanges;
  }
  getCommentedRangesByManualParsing(document) {
    const commentRanges = [];
    const lines = document.getValue().split("\n");
    const languageId = document.getLanguageId();
    const lineCommentToken = languageId === "python" ? "#" : languageId === "javascript" || languageId === "typescript" ? "//" : null;
    const blockComments = languageId === "javascript" || languageId === "typescript" ? { start: "/*", end: "*/" } : null;
    let inBlockComment = false;
    let blockCommentStartLine = -1;
    let blockCommentStartCol = -1;
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];
      const trimmedLine = line.trim();
      if (trimmedLine.length === 0) {
        continue;
      }
      if (blockComments) {
        if (!inBlockComment) {
          const startIndex = line.indexOf(blockComments.start);
          if (startIndex !== -1) {
            inBlockComment = true;
            blockCommentStartLine = lineNumber;
            blockCommentStartCol = startIndex;
          }
        }
        if (inBlockComment) {
          const endIndex = line.indexOf(blockComments.end);
          if (endIndex !== -1) {
            commentRanges.push(new Range(
              blockCommentStartLine + 1,
              blockCommentStartCol + 1,
              lineNumber + 1,
              endIndex + blockComments.end.length + 1
            ));
            inBlockComment = false;
          }
          continue;
        }
      }
      if (!inBlockComment && lineCommentToken && line.trimLeft().startsWith(lineCommentToken)) {
        const startCol = line.indexOf(lineCommentToken);
        commentRanges.push(new Range(
          lineNumber + 1,
          startCol + 1,
          lineNumber + 1,
          line.length + 1
        ));
      }
    }
    if (inBlockComment) {
      commentRanges.push(new Range(
        blockCommentStartLine + 1,
        blockCommentStartCol + 1,
        lines.length,
        lines[lines.length - 1].length + 1
      ));
    }
    return commentRanges;
  }
  isPositionInRanges(position, ranges) {
    return ranges.some((range) => range.containsPosition(position));
  }
  updateCellInlineDecorations(cell, decorations) {
    const oldDecorations = this.cellDecorationIds.get(cell) ?? [];
    this.cellDecorationIds.set(cell, cell.deltaModelDecorations(
      oldDecorations,
      decorations
    ));
  }
  initCellContentListener(cell) {
    const cellModel = cell.textModel;
    if (!cellModel) {
      return;
    }
    this.cellContentListeners.set(cell.uri, cellModel.onDidChangeContent(() => {
      this.clearCellInlineDecorations(cell);
    }));
  }
  clearCellInlineDecorations(cell) {
    const cellDecorations = this.cellDecorationIds.get(cell) ?? [];
    if (cellDecorations) {
      cell.deltaModelDecorations(cellDecorations, []);
      this.cellDecorationIds.delete(cell);
    }
    const listener = this.cellContentListeners.get(cell.uri);
    if (listener) {
      listener.dispose();
      this.cellContentListeners.delete(cell.uri);
    }
  }
  _clearNotebookInlineDecorations() {
    this.cellDecorationIds.forEach((_, cell) => {
      this.clearCellInlineDecorations(cell);
    });
  }
  clearNotebookInlineDecorations() {
    this._clearNotebookInlineDecorations();
  }
  dispose() {
    super.dispose();
    this._clearNotebookInlineDecorations();
    this.currentCancellationTokenSources.forEach((source) => source.cancel());
    this.currentCancellationTokenSources.clear();
    this.cellContentListeners.forEach((listener) => listener.dispose());
    this.cellContentListeners.clear();
  }
};
NotebookInlineVariablesController.id = "notebook.inlineVariablesController";
NotebookInlineVariablesController.MAX_CELL_LINES = 5e3;
NotebookInlineVariablesController = __decorateClass([
  __decorateParam(1, INotebookKernelService),
  __decorateParam(2, INotebookExecutionStateService),
  __decorateParam(3, ILanguageFeaturesService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IDebugService)
], NotebookInlineVariablesController);
registerNotebookContribution(NotebookInlineVariablesController.id, NotebookInlineVariablesController);
registerAction2(class ClearNotebookInlineValues extends NotebookAction {
  constructor() {
    super({
      id: "notebook.clearAllInlineValues",
      title: localize("clearAllInlineValues", "Clear All Inline Values")
    });
  }
  runWithContext(accessor, context) {
    const editor = context.notebookEditor;
    const controller = editor.getContribution(NotebookInlineVariablesController.id);
    controller.clearNotebookInlineDecorations();
    return Promise.resolve();
  }
});
export {
  NotebookInlineVariablesController
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIvbm90ZWJvb2tWYXJpYWJsZXMvbm90ZWJvb2tJbmxpbmVWYXJpYWJsZXMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFeHRlcm5hbEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBmb3JtYXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkVG9rZW5UeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lbmNvZGVkVG9rZW5BdHRyaWJ1dGVzLmpzJztcbmltcG9ydCB7IElubGluZVZhbHVlQ29udGV4dCwgSW5saW5lVmFsdWVUZXh0LCBJbmxpbmVWYWx1ZVZhcmlhYmxlTG9va3VwIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSU1vZGVsRGVsdGFEZWNvcmF0aW9uLCBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IGNyZWF0ZUlubGluZVZhbHVlRGVjb3JhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2RlYnVnL2Jyb3dzZXIvZGVidWdFZGl0b3JDb250cmlidXRpb24uanMnO1xuaW1wb3J0IHsgSURlYnVnU2VydmljZSwgU3RhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9kZWJ1Zy9jb21tb24vZGVidWcuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tTZXR0aW5nIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IElDZWxsRXhlY3V0aW9uU3RhdGVDaGFuZ2VkRXZlbnQsIElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSwgTm90ZWJvb2tFeGVjdXRpb25UeXBlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0tlcm5lbFNlcnZpY2UsIFZhcmlhYmxlc1Jlc3VsdCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ub3RlYm9va0tlcm5lbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rQWN0aW9uQ29udGV4dCwgTm90ZWJvb2tBY3Rpb24gfSBmcm9tICcuLi8uLi9jb250cm9sbGVyL2NvcmVBY3Rpb25zLmpzJztcbmltcG9ydCB7IElDZWxsVmlld01vZGVsLCBJTm90ZWJvb2tFZGl0b3IsIElOb3RlYm9va0VkaXRvckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyByZWdpc3Rlck5vdGVib29rQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2tFZGl0b3JFeHRlbnNpb25zLmpzJztcblxuY2xhc3MgSW5saW5lU2VnbWVudCB7XG5cdGNvbnN0cnVjdG9yKHB1YmxpYyBjb2x1bW46IG51bWJlciwgcHVibGljIHRleHQ6IHN0cmluZykge1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va0lubGluZVZhcmlhYmxlc0NvbnRyb2xsZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSU5vdGVib29rRWRpdG9yQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgaWQ6IHN0cmluZyA9ICdub3RlYm9vay5pbmxpbmVWYXJpYWJsZXNDb250cm9sbGVyJztcblxuXHRwcml2YXRlIGNlbGxEZWNvcmF0aW9uSWRzID0gbmV3IE1hcDxJQ2VsbFZpZXdNb2RlbCwgc3RyaW5nW10+KCk7XG5cdHByaXZhdGUgY2VsbENvbnRlbnRMaXN0ZW5lcnMgPSBuZXcgUmVzb3VyY2VNYXA8SURpc3Bvc2FibGU+KCk7XG5cblx0cHJpdmF0ZSBjdXJyZW50Q2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2VzID0gbmV3IFJlc291cmNlTWFwPENhbmNlbGxhdGlvblRva2VuU291cmNlPigpO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IE1BWF9DRUxMX0xJTkVTID0gNTAwMDsgLy8gU2tpcCBleHRyZW1lbHkgbGFyZ2UgY2VsbHNcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rRWRpdG9yOiBJTm90ZWJvb2tFZGl0b3IsXG5cdFx0QElOb3RlYm9va0tlcm5lbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RlYm9va0tlcm5lbFNlcnZpY2U6IElOb3RlYm9va0tlcm5lbFNlcnZpY2UsXG5cdFx0QElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlOiBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElEZWJ1Z1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLm9uRGlkQ2hhbmdlRXhlY3V0aW9uKGFzeW5jIGUgPT4ge1xuXHRcdFx0Y29uc3QgaW5saW5lVmFsdWVzU2V0dGluZyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J29uJyB8ICdhdXRvJyB8ICdvZmYnPihOb3RlYm9va1NldHRpbmcubm90ZWJvb2tJbmxpbmVWYWx1ZXMpO1xuXHRcdFx0aWYgKGlubGluZVZhbHVlc1NldHRpbmcgPT09ICdvZmYnKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGUudHlwZSA9PT0gTm90ZWJvb2tFeGVjdXRpb25UeXBlLmNlbGwpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy51cGRhdGVJbmxpbmVWYXJpYWJsZXMoZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQucnVuQW5kU3Vic2NyaWJlKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLCBlID0+IHtcblx0XHRcdGlmICghZSB8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKE5vdGVib29rU2V0dGluZy5ub3RlYm9va0lubGluZVZhbHVlcykpIHtcblx0XHRcdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J29uJyB8ICdhdXRvJyB8ICdvZmYnPihOb3RlYm9va1NldHRpbmcubm90ZWJvb2tJbmxpbmVWYWx1ZXMpID09PSAnb2ZmJykge1xuXHRcdFx0XHRcdHRoaXMuY2xlYXJOb3RlYm9va0lubGluZURlY29yYXRpb25zKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZUlubGluZVZhcmlhYmxlcyhldmVudDogSUNlbGxFeGVjdXRpb25TdGF0ZUNoYW5nZWRFdmVudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChldmVudC5jaGFuZ2VkKSB7IC8vIHVuZGVmaW5lZCAtPiBleGVjdXRpb24gd2FzIGNvbXBsZXRlZCwgc28gcmV0dXJuIG9uIGFsbCBlbHNlLiBubyBjb2RlIHNob3VsZCBleGVjdXRlIHVudGlsIHdlIGtub3cgaXQncyBhbiBleGVjdXRpb24gY29tcGxldGlvblxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNlbGwgPSB0aGlzLm5vdGVib29rRWRpdG9yLmdldENlbGxCeUhhbmRsZShldmVudC5jZWxsSGFuZGxlKTtcblx0XHRpZiAoIWNlbGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBDYW5jZWwgYW55IG9uZ29pbmcgcmVxdWVzdCBpbiB0aGlzIGNlbGxcblx0XHRjb25zdCBleGlzdGluZ1NvdXJjZSA9IHRoaXMuY3VycmVudENhbmNlbGxhdGlvblRva2VuU291cmNlcy5nZXQoY2VsbC51cmkpO1xuXHRcdGlmIChleGlzdGluZ1NvdXJjZSkge1xuXHRcdFx0ZXhpc3RpbmdTb3VyY2UuY2FuY2VsKCk7XG5cdFx0fVxuXG5cdFx0Ly8gQ3JlYXRlIGEgbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlIGZvciB0aGUgbmV3IHJlcXVlc3QgcGVyIGNlbGxcblx0XHR0aGlzLmN1cnJlbnRDYW5jZWxsYXRpb25Ub2tlblNvdXJjZXMuc2V0KGNlbGwudXJpLCBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKSk7XG5cdFx0Y29uc3QgdG9rZW4gPSB0aGlzLmN1cnJlbnRDYW5jZWxsYXRpb25Ub2tlblNvdXJjZXMuZ2V0KGNlbGwudXJpKSEudG9rZW47XG5cblx0XHRpZiAodGhpcy5kZWJ1Z1NlcnZpY2Uuc3RhdGUgIT09IFN0YXRlLkluYWN0aXZlKSB7XG5cdFx0XHR0aGlzLl9jbGVhck5vdGVib29rSW5saW5lRGVjb3JhdGlvbnMoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsPy51cmkgfHwgIWlzRXF1YWwodGhpcy5ub3RlYm9va0VkaXRvci50ZXh0TW9kZWwudXJpLCBldmVudC5ub3RlYm9vaykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbCA9IGF3YWl0IGNlbGwucmVzb2x2ZVRleHRNb2RlbCgpO1xuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBpbmxpbmVWYWx1ZXNTZXR0aW5nID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTwnb24nIHwgJ2F1dG8nIHwgJ29mZic+KE5vdGVib29rU2V0dGluZy5ub3RlYm9va0lubGluZVZhbHVlcyk7XG5cdFx0Y29uc3QgaGFzSW5saW5lVmFsdWVQcm92aWRlciA9IHRoaXMubGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuaW5saW5lVmFsdWVzUHJvdmlkZXIuaGFzKG1vZGVsKTtcblxuXHRcdC8vIFNraXAgaWYgc2V0dGluZyBpcyBvZmYgb3IgaWYgYXV0byBhbmQgbm8gcHJvdmlkZXIgaXMgcmVnaXN0ZXJlZFxuXHRcdGlmIChpbmxpbmVWYWx1ZXNTZXR0aW5nID09PSAnb2ZmJyB8fCAoaW5saW5lVmFsdWVzU2V0dGluZyA9PT0gJ2F1dG8nICYmICFoYXNJbmxpbmVWYWx1ZVByb3ZpZGVyKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuY2xlYXJDZWxsSW5saW5lRGVjb3JhdGlvbnMoY2VsbCk7XG5cblx0XHRjb25zdCBpbmxpbmVEZWNvcmF0aW9uczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10gPSBbXTtcblxuXHRcdGlmIChoYXNJbmxpbmVWYWx1ZVByb3ZpZGVyKSB7XG5cdFx0XHQvLyB1c2UgZXh0ZW5zaW9uIGJhc2VkIHByb3ZpZGVyLCBib3Jyb3dlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2Jsb2IvbWFpbi9zcmMvdnMvd29ya2JlbmNoL2NvbnRyaWIvZGVidWcvYnJvd3Nlci9kZWJ1Z0VkaXRvckNvbnRyaWJ1dGlvbi50cyNMNjc5XG5cdFx0XHRjb25zdCBsYXN0TGluZSA9IG1vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdFx0Y29uc3QgbGFzdENvbHVtbiA9IG1vZGVsLmdldExpbmVNYXhDb2x1bW4obGFzdExpbmUpO1xuXHRcdFx0Y29uc3QgY3R4OiBJbmxpbmVWYWx1ZUNvbnRleHQgPSB7XG5cdFx0XHRcdGZyYW1lSWQ6IDAsIC8vIGlnbm9yZWQsIHdlIHdvbid0IGhhdmUgYSBzdGFjayBmcm9tIHNpbmNlIG5vdCBpbiBhIGRlYnVnIHNlc3Npb25cblx0XHRcdFx0c3RvcHBlZExvY2F0aW9uOiBuZXcgUmFuZ2UobGFzdExpbmUsIGxhc3RDb2x1bW4sIGxhc3RMaW5lLCBsYXN0Q29sdW1uKSAvLyBleGVjdXRpbmcgY2VsbCBieSBjZWxsLCBzbyBcInN0b3BwZWRcIiBsb2NhdGlvbiB3b3VsZCBqdXN0IGJlIHRoZSBlbmQgb2YgZG9jdW1lbnRcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHByb3ZpZGVycyA9IHRoaXMubGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuaW5saW5lVmFsdWVzUHJvdmlkZXIub3JkZXJlZChtb2RlbCkucmV2ZXJzZSgpO1xuXHRcdFx0Y29uc3QgbGluZURlY29yYXRpb25zID0gbmV3IE1hcDxudW1iZXIsIElubGluZVNlZ21lbnRbXT4oKTtcblxuXHRcdFx0Y29uc3QgZnVsbENlbGxSYW5nZSA9IG5ldyBSYW5nZSgxLCAxLCBsYXN0TGluZSwgbGFzdENvbHVtbik7XG5cblx0XHRcdGNvbnN0IHByb21pc2VzID0gcHJvdmlkZXJzLmZsYXRNYXAocHJvdmlkZXIgPT4gUHJvbWlzZS5yZXNvbHZlKHByb3ZpZGVyLnByb3ZpZGVJbmxpbmVWYWx1ZXMobW9kZWwsIGZ1bGxDZWxsUmFuZ2UsIGN0eCwgdG9rZW4pKS50aGVuKGFzeW5jIChyZXN1bHQpID0+IHtcblx0XHRcdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBub3RlYm9vayA9IHRoaXMubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsO1xuXHRcdFx0XHRpZiAoIW5vdGVib29rKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qga2VybmVsID0gdGhpcy5ub3RlYm9va0tlcm5lbFNlcnZpY2UuZ2V0TWF0Y2hpbmdLZXJuZWwobm90ZWJvb2spO1xuXHRcdFx0XHRjb25zdCBrZXJuZWxWYXJzOiBWYXJpYWJsZXNSZXN1bHRbXSA9IFtdO1xuXHRcdFx0XHRpZiAocmVzdWx0LnNvbWUoaXYgPT4gaXYudHlwZSA9PT0gJ3ZhcmlhYmxlJykpIHsgLy8gaWYgYW55b25lIHdpbGwgbmVlZCBhIGxvb2t1cCwgZ2V0IHZhcnMgbm93IHRvIGF2b2lkIG5lZWRpbmcgdG8gZG8gaXQgbXVsdGlwbGUgdGltZXNcblx0XHRcdFx0XHRpZiAoIXRoaXMubm90ZWJvb2tFZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuOyAvLyBzaG91bGQgbm90IGhhcHBlbiwgYSBjZWxsIHdpbGwgYmUgZXhlY3V0ZWRcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgdmFyaWFibGVzID0ga2VybmVsLnNlbGVjdGVkPy5wcm92aWRlVmFyaWFibGVzKGV2ZW50Lm5vdGVib29rLCB1bmRlZmluZWQsICduYW1lZCcsIDAsIHRva2VuKTtcblx0XHRcdFx0XHRpZiAodmFyaWFibGVzKSB7XG5cdFx0XHRcdFx0XHRmb3IgYXdhaXQgKGNvbnN0IHYgb2YgdmFyaWFibGVzKSB7XG5cdFx0XHRcdFx0XHRcdGtlcm5lbFZhcnMucHVzaCh2KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGNvbnN0IGl2IG9mIHJlc3VsdCkge1xuXHRcdFx0XHRcdGxldCB0ZXh0OiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0c3dpdGNoIChpdi50eXBlKSB7XG5cdFx0XHRcdFx0XHRjYXNlICd0ZXh0Jzpcblx0XHRcdFx0XHRcdFx0dGV4dCA9IChpdiBhcyBJbmxpbmVWYWx1ZVRleHQpLnRleHQ7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0Y2FzZSAndmFyaWFibGUnOiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IG5hbWUgPSAoaXYgYXMgSW5saW5lVmFsdWVWYXJpYWJsZUxvb2t1cCkudmFyaWFibGVOYW1lO1xuXHRcdFx0XHRcdFx0XHRpZiAoIW5hbWUpIHtcblx0XHRcdFx0XHRcdFx0XHRjb250aW51ZTsgLy8gc2tpcCB0byBuZXh0IHZhciwgbm8gdmFsaWQgbmFtZSB0byBsb29rdXAgd2l0aFxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHZhbHVlID0ga2VybmVsVmFycy5maW5kKHYgPT4gdi5uYW1lID09PSBuYW1lKT8udmFsdWU7XG5cdFx0XHRcdFx0XHRcdGlmICghdmFsdWUpIHtcblx0XHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR0ZXh0ID0gZm9ybWF0KCd7MH0gPSB7MX0nLCBuYW1lLCB2YWx1ZSk7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FzZSAnZXhwcmVzc2lvbic6IHtcblx0XHRcdFx0XHRcdFx0Y29udGludWU7IC8vIG5vIGFjdGl2ZSBkZWJ1ZyBzZXNzaW9uLCBzbyBldmFsdWF0ZSB3b3VsZCBicmVha1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICh0ZXh0KSB7XG5cdFx0XHRcdFx0XHRjb25zdCBsaW5lID0gaXYucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0XHRcdFx0bGV0IGxpbmVTZWdtZW50cyA9IGxpbmVEZWNvcmF0aW9ucy5nZXQobGluZSk7XG5cdFx0XHRcdFx0XHRpZiAoIWxpbmVTZWdtZW50cykge1xuXHRcdFx0XHRcdFx0XHRsaW5lU2VnbWVudHMgPSBbXTtcblx0XHRcdFx0XHRcdFx0bGluZURlY29yYXRpb25zLnNldChsaW5lLCBsaW5lU2VnbWVudHMpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCFsaW5lU2VnbWVudHMuc29tZShpdiA9PiBpdi50ZXh0ID09PSB0ZXh0KSkgeyAvLyBkZS1kdXBlXG5cdFx0XHRcdFx0XHRcdGxpbmVTZWdtZW50cy5wdXNoKG5ldyBJbmxpbmVTZWdtZW50KGl2LnJhbmdlLnN0YXJ0Q29sdW1uLCB0ZXh0KSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LCBlcnIgPT4ge1xuXHRcdFx0XHRvblVuZXhwZWN0ZWRFeHRlcm5hbEVycm9yKGVycik7XG5cdFx0XHR9KSk7XG5cblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcblxuXHRcdFx0Ly8gc29ydCBsaW5lIHNlZ21lbnRzIGFuZCBjb25jYXRlbmF0ZSB0aGVtIGludG8gYSBkZWNvcmF0aW9uXG5cdFx0XHRsaW5lRGVjb3JhdGlvbnMuZm9yRWFjaCgoc2VnbWVudHMsIGxpbmUpID0+IHtcblx0XHRcdFx0aWYgKHNlZ21lbnRzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRzZWdtZW50cy5zb3J0KChhLCBiKSA9PiBhLmNvbHVtbiAtIGIuY29sdW1uKTtcblx0XHRcdFx0XHRjb25zdCB0ZXh0ID0gc2VnbWVudHMubWFwKHMgPT4gcy50ZXh0KS5qb2luKCcsICcpO1xuXHRcdFx0XHRcdGNvbnN0IGVkaXRvcldpZHRoID0gY2VsbC5sYXlvdXRJbmZvLmVkaXRvcldpZHRoO1xuXHRcdFx0XHRcdGNvbnN0IGZvbnRJbmZvID0gY2VsbC5sYXlvdXRJbmZvLmZvbnRJbmZvO1xuXHRcdFx0XHRcdGlmIChmb250SW5mbyAmJiBjZWxsLnRleHRNb2RlbCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgYmFzZSA9IE1hdGguZmxvb3IoKGVkaXRvcldpZHRoIC0gNTApIC8gZm9udEluZm8udHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoKTtcblx0XHRcdFx0XHRcdGNvbnN0IGxpbmVMZW5ndGggPSBjZWxsLnRleHRNb2RlbC5nZXRMaW5lTGVuZ3RoKGxpbmUpO1xuXHRcdFx0XHRcdFx0Y29uc3QgYXZhaWxhYmxlID0gTWF0aC5tYXgoMCwgYmFzZSAtIGxpbmVMZW5ndGgpO1xuXHRcdFx0XHRcdFx0aW5saW5lRGVjb3JhdGlvbnMucHVzaCguLi5jcmVhdGVJbmxpbmVWYWx1ZURlY29yYXRpb24obGluZSwgdGV4dCwgJ25iJywgdW5kZWZpbmVkLCBhdmFpbGFibGUpKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aW5saW5lRGVjb3JhdGlvbnMucHVzaCguLi5jcmVhdGVJbmxpbmVWYWx1ZURlY29yYXRpb24obGluZSwgdGV4dCwgJ25iJykpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHR9IGVsc2UgaWYgKGlubGluZVZhbHVlc1NldHRpbmcgPT09ICdvbicpIHsgLy8gZmFsbGJhY2sgYXBwcm9hY2ggb25seSB3aGVuIHNldHRpbmcgaXMgJ29uJ1xuXHRcdFx0aWYgKCF0aGlzLm5vdGVib29rRWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0cmV0dXJuOyAvLyBzaG91bGQgbm90IGhhcHBlbiwgYSBjZWxsIHdpbGwgYmUgZXhlY3V0ZWRcblx0XHRcdH1cblx0XHRcdGNvbnN0IGtlcm5lbCA9IHRoaXMubm90ZWJvb2tLZXJuZWxTZXJ2aWNlLmdldE1hdGNoaW5nS2VybmVsKHRoaXMubm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsKTtcblx0XHRcdGNvbnN0IHZhcmlhYmxlcyA9IGtlcm5lbD8uc2VsZWN0ZWQ/LnByb3ZpZGVWYXJpYWJsZXMoZXZlbnQubm90ZWJvb2ssIHVuZGVmaW5lZCwgJ25hbWVkJywgMCwgdG9rZW4pO1xuXHRcdFx0aWYgKCF2YXJpYWJsZXMpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB2YXJzOiBWYXJpYWJsZXNSZXN1bHRbXSA9IFtdO1xuXHRcdFx0Zm9yIGF3YWl0IChjb25zdCB2IG9mIHZhcmlhYmxlcykge1xuXHRcdFx0XHR2YXJzLnB1c2godik7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB2YXJOYW1lczogc3RyaW5nW10gPSB2YXJzLm1hcCh2ID0+IHYubmFtZSk7XG5cblx0XHRcdGNvbnN0IGRvY3VtZW50ID0gY2VsbC50ZXh0TW9kZWw7XG5cdFx0XHRpZiAoIWRvY3VtZW50KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2tpcCBwcm9jZXNzaW5nIGZvciBleHRyZW1lbHkgbGFyZ2UgY2VsbHNcblx0XHRcdGlmIChkb2N1bWVudC5nZXRMaW5lQ291bnQoKSA+IE5vdGVib29rSW5saW5lVmFyaWFibGVzQ29udHJvbGxlci5NQVhfQ0VMTF9MSU5FUykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGlubGluZURlY29yYXRpb25zOiBJTW9kZWxEZWx0YURlY29yYXRpb25bXSA9IFtdO1xuXHRcdFx0Y29uc3QgcHJvY2Vzc2VkVmFycyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5cdFx0XHQvLyBHZXQgYm90aCBmdW5jdGlvbiByYW5nZXMgYW5kIGNvbW1lbnQgcmFuZ2VzXG5cdFx0XHRjb25zdCBmdW5jdGlvblJhbmdlcyA9IHRoaXMuZ2V0RnVuY3Rpb25SYW5nZXMoZG9jdW1lbnQpO1xuXHRcdFx0Y29uc3QgY29tbWVudGVkUmFuZ2VzID0gdGhpcy5nZXRDb21tZW50ZWRSYW5nZXMoZG9jdW1lbnQpO1xuXHRcdFx0Y29uc3QgaWdub3JlZFJhbmdlcyA9IFsuLi5mdW5jdGlvblJhbmdlcywgLi4uY29tbWVudGVkUmFuZ2VzXTtcblx0XHRcdGNvbnN0IGxpbmVEZWNvcmF0aW9ucyA9IG5ldyBNYXA8bnVtYmVyLCBJbmxpbmVTZWdtZW50W10+KCk7XG5cblx0XHRcdC8vIEZvciBlYWNoIHZhcmlhYmxlIG5hbWUgZm91bmQgaW4gdGhlIGtlcm5lbCByZXN1bHRzXG5cdFx0XHRmb3IgKGNvbnN0IHZhck5hbWUgb2YgdmFyTmFtZXMpIHtcblx0XHRcdFx0aWYgKHByb2Nlc3NlZFZhcnMuaGFzKHZhck5hbWUpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBMb29rIGZvciB2YXJpYWJsZSB1c2FnZSBnbG9iYWxseSAtIHVzaW5nIHdvcmQgYm91bmRhcmllcyB0byBlbnN1cmUgZXhhY3QgbWF0Y2hlc1xuXHRcdFx0XHRjb25zdCByZWdleCA9IG5ldyBSZWdFeHAoYFxcXFxiJHt2YXJOYW1lfVxcXFxiKD8hXFxcXHcpYCwgJ2cnKTtcblx0XHRcdFx0bGV0IGxhc3RNYXRjaE91dHNpZGVJZ25vcmVkOiB7IGxpbmU6IG51bWJlcjsgY29sdW1uOiBudW1iZXIgfSB8IG51bGwgPSBudWxsO1xuXHRcdFx0XHRsZXQgZm91bmRNYXRjaCA9IGZhbHNlO1xuXG5cdFx0XHRcdC8vIFNjYW4gbGluZXMgaW4gcmV2ZXJzZSB0byBmaW5kIGxhc3Qgb2NjdXJyZW5jZSBmaXJzdFxuXHRcdFx0XHRjb25zdCBsaW5lcyA9IGRvY3VtZW50LmdldFZhbHVlKCkuc3BsaXQoJ1xcbicpO1xuXHRcdFx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gbGluZXMubGVuZ3RoIC0gMTsgbGluZU51bWJlciA+PSAwOyBsaW5lTnVtYmVyLS0pIHtcblx0XHRcdFx0XHRjb25zdCBsaW5lID0gbGluZXNbbGluZU51bWJlcl07XG5cdFx0XHRcdFx0bGV0IG1hdGNoOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuXG5cdFx0XHRcdFx0d2hpbGUgKChtYXRjaCA9IHJlZ2V4LmV4ZWMobGluZSkpICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBzdGFydEluZGV4ID0gbWF0Y2guaW5kZXg7XG5cdFx0XHRcdFx0XHRjb25zdCBwb3MgPSBuZXcgUG9zaXRpb24obGluZU51bWJlciArIDEsIHN0YXJ0SW5kZXggKyAxKTtcblxuXHRcdFx0XHRcdFx0Ly8gQ2hlY2sgaWYgdGhpcyBwb3NpdGlvbiBpcyBpbiBhbnkgaWdub3JlZCByYW5nZSAoZnVuY3Rpb24gb3IgY29tbWVudClcblx0XHRcdFx0XHRcdGlmICghdGhpcy5pc1Bvc2l0aW9uSW5SYW5nZXMocG9zLCBpZ25vcmVkUmFuZ2VzKSkge1xuXHRcdFx0XHRcdFx0XHRsYXN0TWF0Y2hPdXRzaWRlSWdub3JlZCA9IHtcblx0XHRcdFx0XHRcdFx0XHRsaW5lOiBsaW5lTnVtYmVyICsgMSxcblx0XHRcdFx0XHRcdFx0XHRjb2x1bW46IHN0YXJ0SW5kZXggKyAxXG5cdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdGZvdW5kTWF0Y2ggPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRicmVhazsgLy8gVGFrZSBmaXJzdCBtYXRjaCBpbiByZXZlcnNlIG9yZGVyICh3aGljaCBpcyBsYXN0IGNocm9ub2xvZ2ljYWxseSlcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoZm91bmRNYXRjaCkge1xuXHRcdFx0XHRcdFx0YnJlYWs7IC8vIFdlIGZvdW5kIG91ciBsYXN0IHZhbGlkIG9jY3VycmVuY2UsIG5vIG5lZWQgdG8gY2hlY2sgZWFybGllciBsaW5lc1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChsYXN0TWF0Y2hPdXRzaWRlSWdub3JlZCkge1xuXHRcdFx0XHRcdGNvbnN0IGlubGluZVZhbCA9IHZhck5hbWUgKyAnID0gJyArIHZhcnMuZmluZCh2ID0+IHYubmFtZSA9PT0gdmFyTmFtZSk/LnZhbHVlO1xuXG5cdFx0XHRcdFx0bGV0IGxpbmVTZWdtZW50cyA9IGxpbmVEZWNvcmF0aW9ucy5nZXQobGFzdE1hdGNoT3V0c2lkZUlnbm9yZWQubGluZSk7XG5cdFx0XHRcdFx0aWYgKCFsaW5lU2VnbWVudHMpIHtcblx0XHRcdFx0XHRcdGxpbmVTZWdtZW50cyA9IFtdO1xuXHRcdFx0XHRcdFx0bGluZURlY29yYXRpb25zLnNldChsYXN0TWF0Y2hPdXRzaWRlSWdub3JlZC5saW5lLCBsaW5lU2VnbWVudHMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIWxpbmVTZWdtZW50cy5zb21lKGl2ID0+IGl2LnRleHQgPT09IGlubGluZVZhbCkpIHsgLy8gZGUtZHVwZVxuXHRcdFx0XHRcdFx0bGluZVNlZ21lbnRzLnB1c2gobmV3IElubGluZVNlZ21lbnQobGFzdE1hdGNoT3V0c2lkZUlnbm9yZWQuY29sdW1uLCBpbmxpbmVWYWwpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRwcm9jZXNzZWRWYXJzLmFkZCh2YXJOYW1lKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gc29ydCBsaW5lIHNlZ21lbnRzIGFuZCBjb25jYXRlbmF0ZSB0aGVtIGludG8gYSBkZWNvcmF0aW9uXG5cdFx0XHRsaW5lRGVjb3JhdGlvbnMuZm9yRWFjaCgoc2VnbWVudHMsIGxpbmUpID0+IHtcblx0XHRcdFx0aWYgKHNlZ21lbnRzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRzZWdtZW50cy5zb3J0KChhLCBiKSA9PiBhLmNvbHVtbiAtIGIuY29sdW1uKTtcblx0XHRcdFx0XHRjb25zdCB0ZXh0ID0gc2VnbWVudHMubWFwKHMgPT4gcy50ZXh0KS5qb2luKCcsICcpO1xuXHRcdFx0XHRcdGNvbnN0IGVkaXRvcldpZHRoID0gY2VsbC5sYXlvdXRJbmZvLmVkaXRvcldpZHRoO1xuXHRcdFx0XHRcdGNvbnN0IGZvbnRJbmZvID0gY2VsbC5sYXlvdXRJbmZvLmZvbnRJbmZvO1xuXHRcdFx0XHRcdGlmIChmb250SW5mbyAmJiBjZWxsLnRleHRNb2RlbCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgYmFzZSA9IE1hdGguZmxvb3IoKGVkaXRvcldpZHRoIC0gNTApIC8gZm9udEluZm8udHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoKTtcblx0XHRcdFx0XHRcdGNvbnN0IGxpbmVMZW5ndGggPSBjZWxsLnRleHRNb2RlbC5nZXRMaW5lTGVuZ3RoKGxpbmUpO1xuXHRcdFx0XHRcdFx0Y29uc3QgYXZhaWxhYmxlID0gTWF0aC5tYXgoMCwgYmFzZSAtIGxpbmVMZW5ndGgpO1xuXHRcdFx0XHRcdFx0aW5saW5lRGVjb3JhdGlvbnMucHVzaCguLi5jcmVhdGVJbmxpbmVWYWx1ZURlY29yYXRpb24obGluZSwgdGV4dCwgJ25iJywgdW5kZWZpbmVkLCBhdmFpbGFibGUpKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aW5saW5lRGVjb3JhdGlvbnMucHVzaCguLi5jcmVhdGVJbmxpbmVWYWx1ZURlY29yYXRpb24obGluZSwgdGV4dCwgJ25iJykpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGlmIChpbmxpbmVEZWNvcmF0aW9ucy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlQ2VsbElubGluZURlY29yYXRpb25zKGNlbGwsIGlubGluZURlY29yYXRpb25zKTtcblx0XHRcdFx0dGhpcy5pbml0Q2VsbENvbnRlbnRMaXN0ZW5lcihjZWxsKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldEZ1bmN0aW9uUmFuZ2VzKGRvY3VtZW50OiBJVGV4dE1vZGVsKTogUmFuZ2VbXSB7XG5cdFx0cmV0dXJuIGRvY3VtZW50LmdldExhbmd1YWdlSWQoKSA9PT0gJ3B5dGhvbidcblx0XHRcdD8gdGhpcy5nZXRQeXRob25GdW5jdGlvblJhbmdlcyhkb2N1bWVudC5nZXRWYWx1ZSgpKVxuXHRcdFx0OiB0aGlzLmdldEJyYWNlZEZ1bmN0aW9uUmFuZ2VzKGRvY3VtZW50LmdldFZhbHVlKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRQeXRob25GdW5jdGlvblJhbmdlcyhjb2RlOiBzdHJpbmcpOiBSYW5nZVtdIHtcblx0XHRjb25zdCBmdW5jdGlvblJhbmdlczogUmFuZ2VbXSA9IFtdO1xuXHRcdGNvbnN0IGxpbmVzID0gY29kZS5zcGxpdCgnXFxuJyk7XG5cdFx0bGV0IGZ1bmN0aW9uU3RhcnRMaW5lID0gLTE7XG5cdFx0bGV0IGluRnVuY3Rpb24gPSBmYWxzZTtcblx0XHRsZXQgcHl0aG9uSW5kZW50TGV2ZWwgPSAtMTtcblx0XHRjb25zdCBweXRob25GdW5jdGlvbkRlY2xSZWdleCA9IC9eKFxccyopKGFzeW5jXFxzKyk/KD86ZGVmXFxzK1xcdyt8Y2xhc3NcXHMrXFx3KylcXHMqXFwoW14pXSpcXClcXHMqOi87XG5cblx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gMDsgbGluZU51bWJlciA8IGxpbmVzLmxlbmd0aDsgbGluZU51bWJlcisrKSB7XG5cdFx0XHRjb25zdCBsaW5lID0gbGluZXNbbGluZU51bWJlcl07XG5cblx0XHRcdC8vIENoZWNrIGZvciBQeXRob24gZnVuY3Rpb24vY2xhc3MgZGVjbGFyYXRpb25zXG5cdFx0XHRjb25zdCBweXRob25NYXRjaCA9IGxpbmUubWF0Y2gocHl0aG9uRnVuY3Rpb25EZWNsUmVnZXgpO1xuXHRcdFx0aWYgKHB5dGhvbk1hdGNoKSB7XG5cdFx0XHRcdGlmIChpbkZ1bmN0aW9uKSB7XG5cdFx0XHRcdFx0Ly8gSWYgd2UncmUgYWxyZWFkeSBpbiBhIGZ1bmN0aW9uIGFuZCBmaW5kIGFub3RoZXIgYXQgdGhlIHNhbWUgb3IgbG93ZXIgaW5kZW50LCBjbG9zZSB0aGUgY3VycmVudCBvbmVcblx0XHRcdFx0XHRjb25zdCBjdXJyZW50SW5kZW50ID0gcHl0aG9uTWF0Y2hbMV0ubGVuZ3RoO1xuXHRcdFx0XHRcdGlmIChjdXJyZW50SW5kZW50IDw9IHB5dGhvbkluZGVudExldmVsKSB7XG5cdFx0XHRcdFx0XHRmdW5jdGlvblJhbmdlcy5wdXNoKG5ldyBSYW5nZShmdW5jdGlvblN0YXJ0TGluZSArIDEsIDEsIGxpbmVOdW1iZXIsIGxpbmUubGVuZ3RoICsgMSkpO1xuXHRcdFx0XHRcdFx0aW5GdW5jdGlvbiA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghaW5GdW5jdGlvbikge1xuXHRcdFx0XHRcdGluRnVuY3Rpb24gPSB0cnVlO1xuXHRcdFx0XHRcdGZ1bmN0aW9uU3RhcnRMaW5lID0gbGluZU51bWJlcjtcblx0XHRcdFx0XHRweXRob25JbmRlbnRMZXZlbCA9IHB5dGhvbk1hdGNoWzFdLmxlbmd0aDtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ2hlY2sgaW5kZW50YXRpb24gZm9yIFB5dGhvbiBmdW5jdGlvbnNcblx0XHRcdGlmIChpbkZ1bmN0aW9uKSB7XG5cdFx0XHRcdC8vIFNraXAgZW1wdHkgbGluZXNcblx0XHRcdFx0aWYgKGxpbmUudHJpbSgpID09PSAnJykge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gR2V0IHRoZSBpbmRlbnRhdGlvbiBvZiB0aGUgY3VycmVudCBsaW5lXG5cdFx0XHRcdGNvbnN0IGN1cnJlbnRJbmRlbnQgPSBsaW5lLm1hdGNoKC9eXFxzKi8pPy5bMF0ubGVuZ3RoID8/IDA7XG5cblx0XHRcdFx0Ly8gSWYgd2UgaGl0IGEgbGluZSB3aXRoIHNhbWUgb3IgbG93ZXIgaW5kZW50YXRpb24gdGhhbiB3aGVyZSB0aGUgZnVuY3Rpb24gc3RhcnRlZCxcblx0XHRcdFx0Ly8gd2UndmUgZXhpdGVkIHRoZSBmdW5jdGlvblxuXHRcdFx0XHRpZiAoY3VycmVudEluZGVudCA8PSBweXRob25JbmRlbnRMZXZlbCkge1xuXHRcdFx0XHRcdGZ1bmN0aW9uUmFuZ2VzLnB1c2gobmV3IFJhbmdlKGZ1bmN0aW9uU3RhcnRMaW5lICsgMSwgMSwgbGluZU51bWJlciwgbGluZS5sZW5ndGggKyAxKSk7XG5cdFx0XHRcdFx0aW5GdW5jdGlvbiA9IGZhbHNlO1xuXHRcdFx0XHRcdHB5dGhvbkluZGVudExldmVsID0gLTE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBIYW5kbGUgY2FzZSB3aGVyZSBQeXRob24gZnVuY3Rpb24gaXMgYXQgdGhlIGVuZCBvZiB0aGUgZG9jdW1lbnRcblx0XHRpZiAoaW5GdW5jdGlvbikge1xuXHRcdFx0ZnVuY3Rpb25SYW5nZXMucHVzaChuZXcgUmFuZ2UoZnVuY3Rpb25TdGFydExpbmUgKyAxLCAxLCBsaW5lcy5sZW5ndGgsIGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdLmxlbmd0aCArIDEpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZnVuY3Rpb25SYW5nZXM7XG5cdH1cblxuXHRwcml2YXRlIGdldEJyYWNlZEZ1bmN0aW9uUmFuZ2VzKGNvZGU6IHN0cmluZyk6IFJhbmdlW10ge1xuXHRcdGNvbnN0IGZ1bmN0aW9uUmFuZ2VzOiBSYW5nZVtdID0gW107XG5cdFx0Y29uc3QgbGluZXMgPSBjb2RlLnNwbGl0KCdcXG4nKTtcblx0XHRsZXQgYnJhY2VEZXB0aCA9IDA7XG5cdFx0bGV0IGZ1bmN0aW9uU3RhcnRMaW5lID0gLTE7XG5cdFx0bGV0IGluRnVuY3Rpb24gPSBmYWxzZTtcblx0XHRjb25zdCBmdW5jdGlvbkRlY2xSZWdleCA9IC9cXGIoPzpmdW5jdGlvblxccytcXHcrfCg/OmFzeW5jXFxzKyk/KD86XFx3K1xccyo9XFxzKik/XFwoW14pXSpcXClcXHMqPT58Y2xhc3NcXHMrXFx3K3woPzpwdWJsaWN8cHJpdmF0ZXxwcm90ZWN0ZWR8c3RhdGljKT9cXHMqXFx3K1xccypcXChbXildKlxcKVxccyp7KS87XG5cblx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gMDsgbGluZU51bWJlciA8IGxpbmVzLmxlbmd0aDsgbGluZU51bWJlcisrKSB7XG5cdFx0XHRjb25zdCBsaW5lID0gbGluZXNbbGluZU51bWJlcl07XG5cdFx0XHRmb3IgKGNvbnN0IGNoYXIgb2YgbGluZSkge1xuXHRcdFx0XHRpZiAoY2hhciA9PT0gJ3snKSB7XG5cdFx0XHRcdFx0aWYgKCFpbkZ1bmN0aW9uICYmIGZ1bmN0aW9uRGVjbFJlZ2V4LnRlc3QobGluZSkpIHtcblx0XHRcdFx0XHRcdGluRnVuY3Rpb24gPSB0cnVlO1xuXHRcdFx0XHRcdFx0ZnVuY3Rpb25TdGFydExpbmUgPSBsaW5lTnVtYmVyO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmFjZURlcHRoKys7XG5cdFx0XHRcdH0gZWxzZSBpZiAoY2hhciA9PT0gJ30nKSB7XG5cdFx0XHRcdFx0YnJhY2VEZXB0aC0tO1xuXHRcdFx0XHRcdGlmIChicmFjZURlcHRoID09PSAwICYmIGluRnVuY3Rpb24pIHtcblx0XHRcdFx0XHRcdGZ1bmN0aW9uUmFuZ2VzLnB1c2gobmV3IFJhbmdlKGZ1bmN0aW9uU3RhcnRMaW5lICsgMSwgMSwgbGluZU51bWJlciArIDEsIGxpbmUubGVuZ3RoICsgMSkpO1xuXHRcdFx0XHRcdFx0aW5GdW5jdGlvbiA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmdW5jdGlvblJhbmdlcztcblx0fVxuXG5cdHByaXZhdGUgZ2V0Q29tbWVudGVkUmFuZ2VzKGRvY3VtZW50OiBJVGV4dE1vZGVsKTogUmFuZ2VbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2dldENvbW1lbnRlZFJhbmdlcyhkb2N1bWVudCk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRDb21tZW50ZWRSYW5nZXMoZG9jdW1lbnQ6IElUZXh0TW9kZWwpOiBSYW5nZVtdIHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0Q29tbWVudGVkUmFuZ2VzQnlBY2N1cmF0ZVRva2VuaXphdGlvbihkb2N1bWVudCk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Ly8gRmFsbCBiYWNrIHRvIG1hbnVhbCBwYXJzaW5nIGlmIHRva2VuaXphdGlvbiBmYWlsc1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0Q29tbWVudGVkUmFuZ2VzQnlNYW51YWxQYXJzaW5nKGRvY3VtZW50KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldENvbW1lbnRlZFJhbmdlc0J5QWNjdXJhdGVUb2tlbml6YXRpb24oZG9jdW1lbnQ6IElUZXh0TW9kZWwpOiBSYW5nZVtdIHtcblx0XHRjb25zdCBjb21tZW50UmFuZ2VzOiBSYW5nZVtdID0gW107XG5cdFx0Y29uc3QgbGluZUNvdW50ID0gZG9jdW1lbnQuZ2V0TGluZUNvdW50KCk7XG5cblx0XHQvLyBTa2lwIHByb2Nlc3NpbmcgZm9yIGV4dHJlbWVseSBsYXJnZSBkb2N1bWVudHNcblx0XHRpZiAobGluZUNvdW50ID4gTm90ZWJvb2tJbmxpbmVWYXJpYWJsZXNDb250cm9sbGVyLk1BWF9DRUxMX0xJTkVTKSB7XG5cdFx0XHRyZXR1cm4gY29tbWVudFJhbmdlcztcblx0XHR9XG5cblx0XHQvLyBQcm9jZXNzIGVhY2ggbGluZSAtIGZvcmNlIHRva2VuaXphdGlvbiBpZiBuZWVkZWQgYW5kIHByb2Nlc3MgdG9rZW5zIGluIGEgc2luZ2xlIHBhc3Ncblx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gMTsgbGluZU51bWJlciA8PSBsaW5lQ291bnQ7IGxpbmVOdW1iZXIrKykge1xuXHRcdFx0Ly8gRm9yY2UgdG9rZW5pemF0aW9uIGlmIG5lZWRlZFxuXHRcdFx0aWYgKCFkb2N1bWVudC50b2tlbml6YXRpb24uaGFzQWNjdXJhdGVUb2tlbnNGb3JMaW5lKGxpbmVOdW1iZXIpKSB7XG5cdFx0XHRcdGRvY3VtZW50LnRva2VuaXphdGlvbi5mb3JjZVRva2VuaXphdGlvbihsaW5lTnVtYmVyKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbGluZVRva2VucyA9IGRvY3VtZW50LnRva2VuaXphdGlvbi5nZXRMaW5lVG9rZW5zKGxpbmVOdW1iZXIpO1xuXG5cdFx0XHQvLyBTa2lwIGxpbmVzIHdpdGggbm8gdG9rZW5zXG5cdFx0XHRpZiAobGluZVRva2Vucy5nZXRDb3VudCgpID09PSAwKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgc3RhcnRDaGFyYWN0ZXI6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRcdFx0Ly8gQ2hlY2sgZWFjaCB0b2tlbiBpbiB0aGUgbGluZVxuXHRcdFx0Zm9yIChsZXQgdG9rZW5JbmRleCA9IDA7IHRva2VuSW5kZXggPCBsaW5lVG9rZW5zLmdldENvdW50KCk7IHRva2VuSW5kZXgrKykge1xuXHRcdFx0XHRjb25zdCB0b2tlblR5cGUgPSBsaW5lVG9rZW5zLmdldFN0YW5kYXJkVG9rZW5UeXBlKHRva2VuSW5kZXgpO1xuXG5cdFx0XHRcdGlmICh0b2tlblR5cGUgPT09IFN0YW5kYXJkVG9rZW5UeXBlLkNvbW1lbnQgfHwgdG9rZW5UeXBlID09PSBTdGFuZGFyZFRva2VuVHlwZS5TdHJpbmcgfHwgdG9rZW5UeXBlID09PSBTdGFuZGFyZFRva2VuVHlwZS5SZWdFeCkge1xuXHRcdFx0XHRcdGlmIChzdGFydENoYXJhY3RlciA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHQvLyBTdGFydCBvZiBhIGNvbW1lbnQgb3Igc3RyaW5nXG5cdFx0XHRcdFx0XHRzdGFydENoYXJhY3RlciA9IGxpbmVUb2tlbnMuZ2V0U3RhcnRPZmZzZXQodG9rZW5JbmRleCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgZW5kQ2hhcmFjdGVyID0gbGluZVRva2Vucy5nZXRFbmRPZmZzZXQodG9rZW5JbmRleCk7XG5cblx0XHRcdFx0XHQvLyBDaGVjayBpZiB0aGlzIGlzIHRoZSBlbmQgb2YgdGhlIGNvbW1lbnQvc3RyaW5nIHNlY3Rpb24gKGVpdGhlciBlbmQgb2YgbGluZSBvciBkaWZmZXJlbnQgdG9rZW4gdHlwZSBmb2xsb3dzKVxuXHRcdFx0XHRcdGNvbnN0IGlzTGFzdFRva2VuID0gdG9rZW5JbmRleCA9PT0gbGluZVRva2Vucy5nZXRDb3VudCgpIC0gMTtcblx0XHRcdFx0XHRjb25zdCBuZXh0VG9rZW5EaWZmZXJlbnQgPSAhaXNMYXN0VG9rZW4gJiZcblx0XHRcdFx0XHRcdGxpbmVUb2tlbnMuZ2V0U3RhbmRhcmRUb2tlblR5cGUodG9rZW5JbmRleCArIDEpICE9PSB0b2tlblR5cGU7XG5cblx0XHRcdFx0XHRpZiAoaXNMYXN0VG9rZW4gfHwgbmV4dFRva2VuRGlmZmVyZW50KSB7XG5cdFx0XHRcdFx0XHQvLyBFbmQgb2YgY29tbWVudC9zdHJpbmcgc2VjdGlvblxuXHRcdFx0XHRcdFx0Y29tbWVudFJhbmdlcy5wdXNoKG5ldyBSYW5nZShsaW5lTnVtYmVyLCBzdGFydENoYXJhY3RlciArIDEsIGxpbmVOdW1iZXIsIGVuZENoYXJhY3RlciArIDEpKTtcblx0XHRcdFx0XHRcdHN0YXJ0Q2hhcmFjdGVyID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBSZXNldCB3aGVuIHdlIGhpdCBhIG5vbi1jb21tZW50LCBub24tc3RyaW5nIHRva2VuXG5cdFx0XHRcdFx0c3RhcnRDaGFyYWN0ZXIgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gY29tbWVudFJhbmdlcztcblx0fVxuXG5cdHByaXZhdGUgZ2V0Q29tbWVudGVkUmFuZ2VzQnlNYW51YWxQYXJzaW5nKGRvY3VtZW50OiBJVGV4dE1vZGVsKTogUmFuZ2VbXSB7XG5cdFx0Y29uc3QgY29tbWVudFJhbmdlczogUmFuZ2VbXSA9IFtdO1xuXHRcdGNvbnN0IGxpbmVzID0gZG9jdW1lbnQuZ2V0VmFsdWUoKS5zcGxpdCgnXFxuJyk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9IGRvY3VtZW50LmdldExhbmd1YWdlSWQoKTtcblxuXHRcdC8vIERpZmZlcmVudCBjb21tZW50IHBhdHRlcm5zIGJ5IGxhbmd1YWdlXG5cdFx0Y29uc3QgbGluZUNvbW1lbnRUb2tlbiA9XG5cdFx0XHRsYW5ndWFnZUlkID09PSAncHl0aG9uJyA/ICcjJyA6XG5cdFx0XHRcdGxhbmd1YWdlSWQgPT09ICdqYXZhc2NyaXB0JyB8fCBsYW5ndWFnZUlkID09PSAndHlwZXNjcmlwdCcgPyAnLy8nIDpcblx0XHRcdFx0XHRudWxsO1xuXG5cdFx0Y29uc3QgYmxvY2tDb21tZW50cyA9XG5cdFx0XHQobGFuZ3VhZ2VJZCA9PT0gJ2phdmFzY3JpcHQnIHx8IGxhbmd1YWdlSWQgPT09ICd0eXBlc2NyaXB0JykgPyB7IHN0YXJ0OiAnLyonLCBlbmQ6ICcqLycgfSA6XG5cdFx0XHRcdG51bGw7XG5cblx0XHRsZXQgaW5CbG9ja0NvbW1lbnQgPSBmYWxzZTtcblx0XHRsZXQgYmxvY2tDb21tZW50U3RhcnRMaW5lID0gLTE7XG5cdFx0bGV0IGJsb2NrQ29tbWVudFN0YXJ0Q29sID0gLTE7XG5cblx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gMDsgbGluZU51bWJlciA8IGxpbmVzLmxlbmd0aDsgbGluZU51bWJlcisrKSB7XG5cdFx0XHRjb25zdCBsaW5lID0gbGluZXNbbGluZU51bWJlcl07XG5cdFx0XHRjb25zdCB0cmltbWVkTGluZSA9IGxpbmUudHJpbSgpO1xuXG5cdFx0XHQvLyBTa2lwIGVtcHR5IGxpbmVzXG5cdFx0XHRpZiAodHJpbW1lZExpbmUubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYmxvY2tDb21tZW50cykge1xuXHRcdFx0XHRpZiAoIWluQmxvY2tDb21tZW50KSB7XG5cdFx0XHRcdFx0Y29uc3Qgc3RhcnRJbmRleCA9IGxpbmUuaW5kZXhPZihibG9ja0NvbW1lbnRzLnN0YXJ0KTtcblx0XHRcdFx0XHRpZiAoc3RhcnRJbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0XHRcdGluQmxvY2tDb21tZW50ID0gdHJ1ZTtcblx0XHRcdFx0XHRcdGJsb2NrQ29tbWVudFN0YXJ0TGluZSA9IGxpbmVOdW1iZXI7XG5cdFx0XHRcdFx0XHRibG9ja0NvbW1lbnRTdGFydENvbCA9IHN0YXJ0SW5kZXg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGluQmxvY2tDb21tZW50KSB7XG5cdFx0XHRcdFx0Y29uc3QgZW5kSW5kZXggPSBsaW5lLmluZGV4T2YoYmxvY2tDb21tZW50cy5lbmQpO1xuXHRcdFx0XHRcdGlmIChlbmRJbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0XHRcdGNvbW1lbnRSYW5nZXMucHVzaChuZXcgUmFuZ2UoXG5cdFx0XHRcdFx0XHRcdGJsb2NrQ29tbWVudFN0YXJ0TGluZSArIDEsXG5cdFx0XHRcdFx0XHRcdGJsb2NrQ29tbWVudFN0YXJ0Q29sICsgMSxcblx0XHRcdFx0XHRcdFx0bGluZU51bWJlciArIDEsXG5cdFx0XHRcdFx0XHRcdGVuZEluZGV4ICsgYmxvY2tDb21tZW50cy5lbmQubGVuZ3RoICsgMVxuXHRcdFx0XHRcdFx0KSk7XG5cdFx0XHRcdFx0XHRpbkJsb2NrQ29tbWVudCA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWluQmxvY2tDb21tZW50ICYmIGxpbmVDb21tZW50VG9rZW4gJiYgbGluZS50cmltTGVmdCgpLnN0YXJ0c1dpdGgobGluZUNvbW1lbnRUb2tlbikpIHtcblx0XHRcdFx0Y29uc3Qgc3RhcnRDb2wgPSBsaW5lLmluZGV4T2YobGluZUNvbW1lbnRUb2tlbik7XG5cdFx0XHRcdGNvbW1lbnRSYW5nZXMucHVzaChuZXcgUmFuZ2UoXG5cdFx0XHRcdFx0bGluZU51bWJlciArIDEsXG5cdFx0XHRcdFx0c3RhcnRDb2wgKyAxLFxuXHRcdFx0XHRcdGxpbmVOdW1iZXIgKyAxLFxuXHRcdFx0XHRcdGxpbmUubGVuZ3RoICsgMVxuXHRcdFx0XHQpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBIYW5kbGUgYmxvY2sgY29tbWVudCBhdCBlbmQgb2YgZmlsZVxuXHRcdGlmIChpbkJsb2NrQ29tbWVudCkge1xuXHRcdFx0Y29tbWVudFJhbmdlcy5wdXNoKG5ldyBSYW5nZShcblx0XHRcdFx0YmxvY2tDb21tZW50U3RhcnRMaW5lICsgMSxcblx0XHRcdFx0YmxvY2tDb21tZW50U3RhcnRDb2wgKyAxLFxuXHRcdFx0XHRsaW5lcy5sZW5ndGgsXG5cdFx0XHRcdGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdLmxlbmd0aCArIDFcblx0XHRcdCkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBjb21tZW50UmFuZ2VzO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1Bvc2l0aW9uSW5SYW5nZXMocG9zaXRpb246IFBvc2l0aW9uLCByYW5nZXM6IFJhbmdlW10pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gcmFuZ2VzLnNvbWUocmFuZ2UgPT4gcmFuZ2UuY29udGFpbnNQb3NpdGlvbihwb3NpdGlvbikpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVDZWxsSW5saW5lRGVjb3JhdGlvbnMoY2VsbDogSUNlbGxWaWV3TW9kZWwsIGRlY29yYXRpb25zOiBJTW9kZWxEZWx0YURlY29yYXRpb25bXSkge1xuXHRcdGNvbnN0IG9sZERlY29yYXRpb25zID0gdGhpcy5jZWxsRGVjb3JhdGlvbklkcy5nZXQoY2VsbCkgPz8gW107XG5cdFx0dGhpcy5jZWxsRGVjb3JhdGlvbklkcy5zZXQoY2VsbCwgY2VsbC5kZWx0YU1vZGVsRGVjb3JhdGlvbnMoXG5cdFx0XHRvbGREZWNvcmF0aW9ucyxcblx0XHRcdGRlY29yYXRpb25zXG5cdFx0KSk7XG5cdH1cblxuXHRwcml2YXRlIGluaXRDZWxsQ29udGVudExpc3RlbmVyKGNlbGw6IElDZWxsVmlld01vZGVsKSB7XG5cdFx0Y29uc3QgY2VsbE1vZGVsID0gY2VsbC50ZXh0TW9kZWw7XG5cdFx0aWYgKCFjZWxsTW9kZWwpIHtcblx0XHRcdHJldHVybjsgLy8gc2hvdWxkIG5vdCBoYXBwZW5cblx0XHR9XG5cblx0XHQvLyBDbGVhciBkZWNvcmF0aW9ucyBvbiBjb250ZW50IGNoYW5nZVxuXHRcdHRoaXMuY2VsbENvbnRlbnRMaXN0ZW5lcnMuc2V0KGNlbGwudXJpLCBjZWxsTW9kZWwub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IHtcblx0XHRcdHRoaXMuY2xlYXJDZWxsSW5saW5lRGVjb3JhdGlvbnMoY2VsbCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckNlbGxJbmxpbmVEZWNvcmF0aW9ucyhjZWxsOiBJQ2VsbFZpZXdNb2RlbCkge1xuXHRcdGNvbnN0IGNlbGxEZWNvcmF0aW9ucyA9IHRoaXMuY2VsbERlY29yYXRpb25JZHMuZ2V0KGNlbGwpID8/IFtdO1xuXHRcdGlmIChjZWxsRGVjb3JhdGlvbnMpIHtcblx0XHRcdGNlbGwuZGVsdGFNb2RlbERlY29yYXRpb25zKGNlbGxEZWNvcmF0aW9ucywgW10pO1xuXHRcdFx0dGhpcy5jZWxsRGVjb3JhdGlvbklkcy5kZWxldGUoY2VsbCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGlzdGVuZXIgPSB0aGlzLmNlbGxDb250ZW50TGlzdGVuZXJzLmdldChjZWxsLnVyaSk7XG5cdFx0aWYgKGxpc3RlbmVyKSB7XG5cdFx0XHRsaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLmNlbGxDb250ZW50TGlzdGVuZXJzLmRlbGV0ZShjZWxsLnVyaSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfY2xlYXJOb3RlYm9va0lubGluZURlY29yYXRpb25zKCkge1xuXHRcdHRoaXMuY2VsbERlY29yYXRpb25JZHMuZm9yRWFjaCgoXywgY2VsbCkgPT4ge1xuXHRcdFx0dGhpcy5jbGVhckNlbGxJbmxpbmVEZWNvcmF0aW9ucyhjZWxsKTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBjbGVhck5vdGVib29rSW5saW5lRGVjb3JhdGlvbnMoKSB7XG5cdFx0dGhpcy5fY2xlYXJOb3RlYm9va0lubGluZURlY29yYXRpb25zKCk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9jbGVhck5vdGVib29rSW5saW5lRGVjb3JhdGlvbnMoKTtcblx0XHR0aGlzLmN1cnJlbnRDYW5jZWxsYXRpb25Ub2tlblNvdXJjZXMuZm9yRWFjaChzb3VyY2UgPT4gc291cmNlLmNhbmNlbCgpKTtcblx0XHR0aGlzLmN1cnJlbnRDYW5jZWxsYXRpb25Ub2tlblNvdXJjZXMuY2xlYXIoKTtcblx0XHR0aGlzLmNlbGxDb250ZW50TGlzdGVuZXJzLmZvckVhY2gobGlzdGVuZXIgPT4gbGlzdGVuZXIuZGlzcG9zZSgpKTtcblx0XHR0aGlzLmNlbGxDb250ZW50TGlzdGVuZXJzLmNsZWFyKCk7XG5cdH1cbn1cblxucmVnaXN0ZXJOb3RlYm9va0NvbnRyaWJ1dGlvbihOb3RlYm9va0lubGluZVZhcmlhYmxlc0NvbnRyb2xsZXIuaWQsIE5vdGVib29rSW5saW5lVmFyaWFibGVzQ29udHJvbGxlcik7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBDbGVhck5vdGVib29rSW5saW5lVmFsdWVzIGV4dGVuZHMgTm90ZWJvb2tBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ25vdGVib29rLmNsZWFyQWxsSW5saW5lVmFsdWVzJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnY2xlYXJBbGxJbmxpbmVWYWx1ZXMnLCAnQ2xlYXIgQWxsIElubGluZSBWYWx1ZXMnKSxcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJTm90ZWJvb2tBY3Rpb25Db250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yID0gY29udGV4dC5ub3RlYm9va0VkaXRvcjtcblx0XHRjb25zdCBjb250cm9sbGVyID0gZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxOb3RlYm9va0lubGluZVZhcmlhYmxlc0NvbnRyb2xsZXI+KE5vdGVib29rSW5saW5lVmFyaWFibGVzQ29udHJvbGxlci5pZCk7XG5cdFx0Y29udHJvbGxlci5jbGVhck5vdGVib29rSW5saW5lRGVjb3JhdGlvbnMoKTtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsYUFBYTtBQUN0QixTQUFTLGtCQUErQjtBQUN4QyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsYUFBYTtBQUN0QixTQUFTLHlCQUF5QjtBQUdsQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDZCQUE2QjtBQUV0QyxTQUFTLG1DQUFtQztBQUM1QyxTQUFTLGVBQWUsYUFBYTtBQUNyQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUEwQyxnQ0FBZ0MsNkJBQTZCO0FBQ3ZHLFNBQVMsOEJBQStDO0FBQ3hELFNBQWlDLHNCQUFzQjtBQUV2RCxTQUFTLG9DQUFvQztBQUU3QyxNQUFNLGNBQWM7QUFBQSxFQUNuQixZQUFtQixRQUF1QixNQUFjO0FBQXJDO0FBQXVCO0FBQUEsRUFDMUM7QUFDRDtBQUVPLElBQU0sb0NBQU4sY0FBZ0QsV0FBa0Q7QUFBQTtBQUFBLEVBV3hHLFlBQ2tCLGdCQUN3Qix1QkFDUSwrQkFDTix5QkFDSCxzQkFDUixjQUMvQjtBQUNELFVBQU07QUFQVztBQUN3QjtBQUNRO0FBQ047QUFDSDtBQUNSO0FBYmpDLFNBQVEsb0JBQW9CLG9CQUFJLElBQThCO0FBQzlELFNBQVEsdUJBQXVCLElBQUksWUFBeUI7QUFFNUQsU0FBUSxrQ0FBa0MsSUFBSSxZQUFxQztBQWNsRixTQUFLLFVBQVUsS0FBSyw4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
