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
import * as strings from "../../../../base/common/strings.js";
import { ShiftCommand } from "../../../common/commands/shiftCommand.js";
import { EditorAutoIndentStrategy } from "../../../common/config/editorOptions.js";
import { Range } from "../../../common/core/range.js";
import { Selection } from "../../../common/core/selection.js";
import { IndentAction } from "../../../common/languages/languageConfiguration.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { IndentConsts } from "../../../common/languages/supports/indentRules.js";
import * as indentUtils from "../../indentation/common/indentUtils.js";
import { getGoodIndentForLine, getIndentMetadata } from "../../../common/languages/autoIndent.js";
import { getEnterAction } from "../../../common/languages/enterAction.js";
let MoveLinesCommand = class {
  constructor(selection, isMovingDown, autoIndent, _languageConfigurationService) {
    this._languageConfigurationService = _languageConfigurationService;
    this._selection = selection;
    this._isMovingDown = isMovingDown;
    this._autoIndent = autoIndent;
    this._selectionId = null;
    this._moveEndLineSelectionShrink = false;
  }
  getEditOperations(model, builder) {
    const getLanguageId = () => {
      return model.getLanguageId();
    };
    const getLanguageIdAtPosition = (lineNumber, column) => {
      return model.getLanguageIdAtPosition(lineNumber, column);
    };
    const modelLineCount = model.getLineCount();
    if (this._isMovingDown && this._selection.endLineNumber === modelLineCount) {
      this._selectionId = builder.trackSelection(this._selection);
      return;
    }
    if (!this._isMovingDown && this._selection.startLineNumber === 1) {
      this._selectionId = builder.trackSelection(this._selection);
      return;
    }
    this._moveEndPositionDown = false;
    let s = this._selection;
    if (s.startLineNumber < s.endLineNumber && s.endColumn === 1) {
      this._moveEndPositionDown = true;
      s = s.setEndPosition(s.endLineNumber - 1, model.getLineMaxColumn(s.endLineNumber - 1));
    }
    const { tabSize, indentSize, insertSpaces } = model.getOptions();
    const indentConverter = this.buildIndentConverter(tabSize, indentSize, insertSpaces);
    if (s.startLineNumber === s.endLineNumber && model.getLineMaxColumn(s.startLineNumber) === 1) {
      const lineNumber = s.startLineNumber;
      const otherLineNumber = this._isMovingDown ? lineNumber + 1 : lineNumber - 1;
      if (model.getLineMaxColumn(otherLineNumber) === 1) {
        builder.addEditOperation(new Range(1, 1, 1, 1), null);
      } else {
        builder.addEditOperation(new Range(lineNumber, 1, lineNumber, 1), model.getLineContent(otherLineNumber));
        builder.addEditOperation(new Range(otherLineNumber, 1, otherLineNumber, model.getLineMaxColumn(otherLineNumber)), null);
      }
      s = new Selection(otherLineNumber, 1, otherLineNumber, 1);
    } else {
      let movingLineNumber;
      let movingLineText;
      if (this._isMovingDown) {
        movingLineNumber = s.endLineNumber + 1;
        movingLineText = model.getLineContent(movingLineNumber);
        builder.addEditOperation(new Range(movingLineNumber - 1, model.getLineMaxColumn(movingLineNumber - 1), movingLineNumber, model.getLineMaxColumn(movingLineNumber)), null);
        let insertingText = movingLineText;
        if (this.shouldAutoIndent(model, s)) {
          const movingLineMatchResult = this.matchEnterRule(model, indentConverter, tabSize, movingLineNumber, s.startLineNumber - 1);
          if (movingLineMatchResult !== null) {
            const oldIndentation = strings.getLeadingWhitespace(model.getLineContent(movingLineNumber));
            const newSpaceCnt = movingLineMatchResult + indentUtils.getSpaceCnt(oldIndentation, tabSize);
            const newIndentation = indentUtils.generateIndent(newSpaceCnt, tabSize, insertSpaces);
            insertingText = newIndentation + this.trimStart(movingLineText);
          } else {
            const virtualModel = {
              tokenization: {
                getLineTokens: (lineNumber) => {
                  if (lineNumber === s.startLineNumber) {
                    return model.tokenization.getLineTokens(movingLineNumber);
                  } else {
                    return model.tokenization.getLineTokens(lineNumber);
                  }
                },
                getLanguageId,
                getLanguageIdAtPosition
              },
              getLineContent: (lineNumber) => {
                if (lineNumber === s.startLineNumber) {
                  return model.getLineContent(movingLineNumber);
                } else {
                  return model.getLineContent(lineNumber);
                }
              }
            };
            const indentOfMovingLine = getGoodIndentForLine(
              this._autoIndent,
              virtualModel,
              model.getLanguageIdAtPosition(movingLineNumber, 1),
              s.startLineNumber,
              indentConverter,
              this._languageConfigurationService
            );
            if (indentOfMovingLine !== null) {
              const oldIndentation = strings.getLeadingWhitespace(model.getLineContent(movingLineNumber));
              const newSpaceCnt = indentUtils.getSpaceCnt(indentOfMovingLine, tabSize);
              const oldSpaceCnt = indentUtils.getSpaceCnt(oldIndentation, tabSize);
              if (newSpaceCnt !== oldSpaceCnt) {
                const newIndentation = indentUtils.generateIndent(newSpaceCnt, tabSize, insertSpaces);
                insertingText = newIndentation + this.trimStart(movingLineText);
              }
            }
          }
          builder.addEditOperation(new Range(s.startLineNumber, 1, s.startLineNumber, 1), insertingText + "\n");
          const ret = this.matchEnterRuleMovingDown(model, indentConverter, tabSize, s.startLineNumber, movingLineNumber, insertingText);
          if (ret !== null) {
            if (ret !== 0) {
              this.getIndentEditsOfMovingBlock(model, builder, s, tabSize, insertSpaces, ret);
            }
          } else {
            const virtualModel = {
              tokenization: {
                getLineTokens: (lineNumber) => {
                  if (lineNumber === s.startLineNumber) {
                    return model.tokenization.getLineTokens(movingLineNumber);
                  } else if (lineNumber >= s.startLineNumber + 1 && lineNumber <= s.endLineNumber + 1) {
                    return model.tokenization.getLineTokens(lineNumber - 1);
                  } else {
                    return model.tokenization.getLineTokens(lineNumber);
                  }
                },
                getLanguageId,
                getLanguageIdAtPosition
              },
              getLineContent: (lineNumber) => {
                if (lineNumber === s.startLineNumber) {
                  return insertingText;
                } else if (lineNumber >= s.startLineNumber + 1 && lineNumber <= s.endLineNumber + 1) {
                  return model.getLineContent(lineNumber - 1);
                } else {
                  return model.getLineContent(lineNumber);
                }
              }
            };
            const newIndentatOfMovingBlock = getGoodIndentForLine(
              this._autoIndent,
              virtualModel,
              model.getLanguageIdAtPosition(movingLineNumber, 1),
              s.startLineNumber + 1,
              indentConverter,
              this._languageConfigurationService
            );
            if (newIndentatOfMovingBlock !== null) {
              const oldIndentation = strings.getLeadingWhitespace(model.getLineContent(s.startLineNumber));
              const newSpaceCnt = indentUtils.getSpaceCnt(newIndentatOfMovingBlock, tabSize);
              const oldSpaceCnt = indentUtils.getSpaceCnt(oldIndentation, tabSize);
              if (newSpaceCnt !== oldSpaceCnt) {
                const spaceCntOffset = newSpaceCnt - oldSpaceCnt;
                this.getIndentEditsOfMovingBlock(model, builder, s, tabSize, insertSpaces, spaceCntOffset);
              }
            }
          }
        } else {
          builder.addEditOperation(new Range(s.startLineNumber, 1, s.startLineNumber, 1), insertingText + "\n");
        }
      } else {
        movingLineNumber = s.startLineNumber - 1;
        movingLineText = model.getLineContent(movingLineNumber);
        builder.addEditOperation(new Range(movingLineNumber, 1, movingLineNumber + 1, 1), null);
        builder.addEditOperation(new Range(s.endLineNumber, model.getLineMaxColumn(s.endLineNumber), s.endLineNumber, model.getLineMaxColumn(s.endLineNumber)), "\n" + movingLineText);
        if (this.shouldAutoIndent(model, s)) {
          const virtualModel = {
            tokenization: {
              getLineTokens: (lineNumber) => {
                if (lineNumber === movingLineNumber) {
                  return model.tokenization.getLineTokens(s.startLineNumber);
                } else {
                  return model.tokenization.getLineTokens(lineNumber);
                }
              },
              getLanguageId,
              getLanguageIdAtPosition
            },
            getLineContent: (lineNumber) => {
              if (lineNumber === movingLineNumber) {
                return model.getLineContent(s.startLineNumber);
              } else {
                return model.getLineContent(lineNumber);
              }
            }
          };
          const ret = this.matchEnterRule(model, indentConverter, tabSize, s.startLineNumber, s.startLineNumber - 2);
          if (ret !== null) {
            if (ret !== 0) {
              this.getIndentEditsOfMovingBlock(model, builder, s, tabSize, insertSpaces, ret);
            }
          } else {
            const indentOfFirstLine = getGoodIndentForLine(
              this._autoIndent,
              virtualModel,
              model.getLanguageIdAtPosition(s.startLineNumber, 1),
              movingLineNumber,
              indentConverter,
              this._languageConfigurationService
            );
            if (indentOfFirstLine !== null) {
              const oldIndent = strings.getLeadingWhitespace(model.getLineContent(s.startLineNumber));
              const newSpaceCnt = indentUtils.getSpaceCnt(indentOfFirstLine, tabSize);
              const oldSpaceCnt = indentUtils.getSpaceCnt(oldIndent, tabSize);
              if (newSpaceCnt !== oldSpaceCnt) {
                const spaceCntOffset = newSpaceCnt - oldSpaceCnt;
                this.getIndentEditsOfMovingBlock(model, builder, s, tabSize, insertSpaces, spaceCntOffset);
              }
            }
          }
        }
      }
    }
    this._selectionId = builder.trackSelection(s);
  }
  buildIndentConverter(tabSize, indentSize, insertSpaces) {
    return {
      shiftIndent: (indentation) => {
        return ShiftCommand.shiftIndent(indentation, indentation.length + 1, tabSize, indentSize, insertSpaces);
      },
      unshiftIndent: (indentation) => {
        return ShiftCommand.unshiftIndent(indentation, indentation.length + 1, tabSize, indentSize, insertSpaces);
      }
    };
  }
  parseEnterResult(model, indentConverter, tabSize, line, enter) {
    if (enter) {
      let enterPrefix = enter.indentation;
      if (enter.indentAction === IndentAction.None) {
        enterPrefix = enter.indentation + enter.appendText;
      } else if (enter.indentAction === IndentAction.Indent) {
        enterPrefix = enter.indentation + enter.appendText;
      } else if (enter.indentAction === IndentAction.IndentOutdent) {
        enterPrefix = enter.indentation;
      } else if (enter.indentAction === IndentAction.Outdent) {
        enterPrefix = indentConverter.unshiftIndent(enter.indentation) + enter.appendText;
      }
      const movingLineText = model.getLineContent(line);
      if (this.trimStart(movingLineText).indexOf(this.trimStart(enterPrefix)) >= 0) {
        const oldIndentation = strings.getLeadingWhitespace(model.getLineContent(line));
        let newIndentation = strings.getLeadingWhitespace(enterPrefix);
        const indentMetadataOfMovelingLine = getIndentMetadata(model, line, this._languageConfigurationService);
        if (indentMetadataOfMovelingLine !== null && indentMetadataOfMovelingLine & IndentConsts.DECREASE_MASK) {
          newIndentation = indentConverter.unshiftIndent(newIndentation);
        }
        const newSpaceCnt = indentUtils.getSpaceCnt(newIndentation, tabSize);
        const oldSpaceCnt = indentUtils.getSpaceCnt(oldIndentation, tabSize);
        return newSpaceCnt - oldSpaceCnt;
      }
    }
    return null;
  }
  /**
   *
   * @param model
   * @param indentConverter
   * @param tabSize
   * @param line the line moving down
   * @param futureAboveLineNumber the line which will be at the `line` position
   * @param futureAboveLineText
   */
  matchEnterRuleMovingDown(model, indentConverter, tabSize, line, futureAboveLineNumber, futureAboveLineText) {
    if (strings.lastNonWhitespaceIndex(futureAboveLineText) >= 0) {
      const maxColumn = model.getLineMaxColumn(futureAboveLineNumber);
      const enter = getEnterAction(this._autoIndent, model, new Range(futureAboveLineNumber, maxColumn, futureAboveLineNumber, maxColumn), this._languageConfigurationService);
      return this.parseEnterResult(model, indentConverter, tabSize, line, enter);
    } else {
      let validPrecedingLine = line - 1;
      while (validPrecedingLine >= 1) {
        const lineContent = model.getLineContent(validPrecedingLine);
        const nonWhitespaceIdx = strings.lastNonWhitespaceIndex(lineContent);
        if (nonWhitespaceIdx >= 0) {
          break;
        }
        validPrecedingLine--;
      }
      if (validPrecedingLine < 1 || line > model.getLineCount()) {
        return null;
      }
      const maxColumn = model.getLineMaxColumn(validPrecedingLine);
      const enter = getEnterAction(this._autoIndent, model, new Range(validPrecedingLine, maxColumn, validPrecedingLine, maxColumn), this._languageConfigurationService);
      return this.parseEnterResult(model, indentConverter, tabSize, line, enter);
    }
  }
  matchEnterRule(model, indentConverter, tabSize, line, oneLineAbove, previousLineText) {
    let validPrecedingLine = oneLineAbove;
    while (validPrecedingLine >= 1) {
      let lineContent;
      if (validPrecedingLine === oneLineAbove && previousLineText !== void 0) {
        lineContent = previousLineText;
      } else {
        lineContent = model.getLineContent(validPrecedingLine);
      }
      const nonWhitespaceIdx = strings.lastNonWhitespaceIndex(lineContent);
      if (nonWhitespaceIdx >= 0) {
        break;
      }
      validPrecedingLine--;
    }
    if (validPrecedingLine < 1 || line > model.getLineCount()) {
      return null;
    }
    const maxColumn = model.getLineMaxColumn(validPrecedingLine);
    const enter = getEnterAction(this._autoIndent, model, new Range(validPrecedingLine, maxColumn, validPrecedingLine, maxColumn), this._languageConfigurationService);
    return this.parseEnterResult(model, indentConverter, tabSize, line, enter);
  }
  trimStart(str) {
    return str.replace(/^\s+/, "");
  }
  shouldAutoIndent(model, selection) {
    if (this._autoIndent < EditorAutoIndentStrategy.Full) {
      return false;
    }
    if (!model.tokenization.isCheapToTokenize(selection.startLineNumber)) {
      return false;
    }
    const languageAtSelectionStart = model.getLanguageIdAtPosition(selection.startLineNumber, 1);
    const languageAtSelectionEnd = model.getLanguageIdAtPosition(selection.endLineNumber, 1);
    if (languageAtSelectionStart !== languageAtSelectionEnd) {
      return false;
    }
    if (this._languageConfigurationService.getLanguageConfiguration(languageAtSelectionStart).indentRulesSupport === null) {
      return false;
    }
    return true;
  }
  getIndentEditsOfMovingBlock(model, builder, s, tabSize, insertSpaces, offset) {
    for (let i = s.startLineNumber; i <= s.endLineNumber; i++) {
      const lineContent = model.getLineContent(i);
      const originalIndent = strings.getLeadingWhitespace(lineContent);
      const originalSpacesCnt = indentUtils.getSpaceCnt(originalIndent, tabSize);
      const newSpacesCnt = originalSpacesCnt + offset;
      const newIndent = indentUtils.generateIndent(newSpacesCnt, tabSize, insertSpaces);
      if (newIndent !== originalIndent) {
        builder.addEditOperation(new Range(i, 1, i, originalIndent.length + 1), newIndent);
        if (i === s.endLineNumber && s.endColumn <= originalIndent.length + 1 && newIndent === "") {
          this._moveEndLineSelectionShrink = true;
        }
      }
    }
  }
  computeCursorState(model, helper) {
    let result = helper.getTrackedSelection(this._selectionId);
    if (this._moveEndPositionDown) {
      result = result.setEndPosition(result.endLineNumber + 1, 1);
    }
    if (this._moveEndLineSelectionShrink && result.startLineNumber < result.endLineNumber) {
      result = result.setEndPosition(result.endLineNumber, 2);
    }
    return result;
  }
};
MoveLinesCommand = __decorateClass([
  __decorateParam(3, ILanguageConfigurationService)
], MoveLinesCommand);
export {
  MoveLinesCommand
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9saW5lc09wZXJhdGlvbnMvYnJvd3Nlci9tb3ZlTGluZXNDb21tYW5kLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgc3RyaW5ncyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFNoaWZ0Q29tbWFuZCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb21tYW5kcy9zaGlmdENvbW1hbmQuanMnO1xuaW1wb3J0IHsgRWRpdG9yQXV0b0luZGVudFN0cmF0ZWd5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IElDb21tYW5kLCBJQ3Vyc29yU3RhdGVDb21wdXRlckRhdGEsIElFZGl0T3BlcmF0aW9uQnVpbGRlciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBDb21wbGV0ZUVudGVyQWN0aW9uLCBJbmRlbnRBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSW5kZW50Q29uc3RzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9zdXBwb3J0cy9pbmRlbnRSdWxlcy5qcyc7XG5pbXBvcnQgKiBhcyBpbmRlbnRVdGlscyBmcm9tICcuLi8uLi9pbmRlbnRhdGlvbi9jb21tb24vaW5kZW50VXRpbHMuanMnO1xuaW1wb3J0IHsgZ2V0R29vZEluZGVudEZvckxpbmUsIGdldEluZGVudE1ldGFkYXRhLCBJSW5kZW50Q29udmVydGVyLCBJVmlydHVhbE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9hdXRvSW5kZW50LmpzJztcbmltcG9ydCB7IGdldEVudGVyQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9lbnRlckFjdGlvbi5qcyc7XG5cbmV4cG9ydCBjbGFzcyBNb3ZlTGluZXNDb21tYW5kIGltcGxlbWVudHMgSUNvbW1hbmQge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3NlbGVjdGlvbjogU2VsZWN0aW9uO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pc01vdmluZ0Rvd246IGJvb2xlYW47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2F1dG9JbmRlbnQ6IEVkaXRvckF1dG9JbmRlbnRTdHJhdGVneTtcblxuXHRwcml2YXRlIF9zZWxlY3Rpb25JZDogc3RyaW5nIHwgbnVsbDtcblx0cHJpdmF0ZSBfbW92ZUVuZFBvc2l0aW9uRG93bj86IGJvb2xlYW47XG5cdHByaXZhdGUgX21vdmVFbmRMaW5lU2VsZWN0aW9uU2hyaW5rOiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHNlbGVjdGlvbjogU2VsZWN0aW9uLFxuXHRcdGlzTW92aW5nRG93bjogYm9vbGVhbixcblx0XHRhdXRvSW5kZW50OiBFZGl0b3JBdXRvSW5kZW50U3RyYXRlZ3ksXG5cdFx0QElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuX3NlbGVjdGlvbiA9IHNlbGVjdGlvbjtcblx0XHR0aGlzLl9pc01vdmluZ0Rvd24gPSBpc01vdmluZ0Rvd247XG5cdFx0dGhpcy5fYXV0b0luZGVudCA9IGF1dG9JbmRlbnQ7XG5cdFx0dGhpcy5fc2VsZWN0aW9uSWQgPSBudWxsO1xuXHRcdHRoaXMuX21vdmVFbmRMaW5lU2VsZWN0aW9uU2hyaW5rID0gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RWRpdE9wZXJhdGlvbnMobW9kZWw6IElUZXh0TW9kZWwsIGJ1aWxkZXI6IElFZGl0T3BlcmF0aW9uQnVpbGRlcik6IHZvaWQge1xuXG5cdFx0Y29uc3QgZ2V0TGFuZ3VhZ2VJZCA9ICgpID0+IHtcblx0XHRcdHJldHVybiBtb2RlbC5nZXRMYW5ndWFnZUlkKCk7XG5cdFx0fTtcblx0XHRjb25zdCBnZXRMYW5ndWFnZUlkQXRQb3NpdGlvbiA9IChsaW5lTnVtYmVyOiBudW1iZXIsIGNvbHVtbjogbnVtYmVyKSA9PiB7XG5cdFx0XHRyZXR1cm4gbW9kZWwuZ2V0TGFuZ3VhZ2VJZEF0UG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgbW9kZWxMaW5lQ291bnQgPSBtb2RlbC5nZXRMaW5lQ291bnQoKTtcblxuXHRcdGlmICh0aGlzLl9pc01vdmluZ0Rvd24gJiYgdGhpcy5fc2VsZWN0aW9uLmVuZExpbmVOdW1iZXIgPT09IG1vZGVsTGluZUNvdW50KSB7XG5cdFx0XHR0aGlzLl9zZWxlY3Rpb25JZCA9IGJ1aWxkZXIudHJhY2tTZWxlY3Rpb24odGhpcy5fc2VsZWN0aW9uKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLl9pc01vdmluZ0Rvd24gJiYgdGhpcy5fc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciA9PT0gMSkge1xuXHRcdFx0dGhpcy5fc2VsZWN0aW9uSWQgPSBidWlsZGVyLnRyYWNrU2VsZWN0aW9uKHRoaXMuX3NlbGVjdGlvbik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fbW92ZUVuZFBvc2l0aW9uRG93biA9IGZhbHNlO1xuXHRcdGxldCBzID0gdGhpcy5fc2VsZWN0aW9uO1xuXG5cdFx0aWYgKHMuc3RhcnRMaW5lTnVtYmVyIDwgcy5lbmRMaW5lTnVtYmVyICYmIHMuZW5kQ29sdW1uID09PSAxKSB7XG5cdFx0XHR0aGlzLl9tb3ZlRW5kUG9zaXRpb25Eb3duID0gdHJ1ZTtcblx0XHRcdHMgPSBzLnNldEVuZFBvc2l0aW9uKHMuZW5kTGluZU51bWJlciAtIDEsIG1vZGVsLmdldExpbmVNYXhDb2x1bW4ocy5lbmRMaW5lTnVtYmVyIC0gMSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgdGFiU2l6ZSwgaW5kZW50U2l6ZSwgaW5zZXJ0U3BhY2VzIH0gPSBtb2RlbC5nZXRPcHRpb25zKCk7XG5cdFx0Y29uc3QgaW5kZW50Q29udmVydGVyID0gdGhpcy5idWlsZEluZGVudENvbnZlcnRlcih0YWJTaXplLCBpbmRlbnRTaXplLCBpbnNlcnRTcGFjZXMpO1xuXG5cdFx0aWYgKHMuc3RhcnRMaW5lTnVtYmVyID09PSBzLmVuZExpbmVOdW1iZXIgJiYgbW9kZWwuZ2V0TGluZU1heENvbHVtbihzLnN0YXJ0TGluZU51bWJlcikgPT09IDEpIHtcblx0XHRcdC8vIEN1cnJlbnQgbGluZSBpcyBlbXB0eVxuXHRcdFx0Y29uc3QgbGluZU51bWJlciA9IHMuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0Y29uc3Qgb3RoZXJMaW5lTnVtYmVyID0gKHRoaXMuX2lzTW92aW5nRG93biA/IGxpbmVOdW1iZXIgKyAxIDogbGluZU51bWJlciAtIDEpO1xuXG5cdFx0XHRpZiAobW9kZWwuZ2V0TGluZU1heENvbHVtbihvdGhlckxpbmVOdW1iZXIpID09PSAxKSB7XG5cdFx0XHRcdC8vIE90aGVyIGxpbmUgbnVtYmVyIGlzIGVtcHR5IHRvbywgc28gbm8gZWRpdGluZyBpcyBuZWVkZWRcblx0XHRcdFx0Ly8gQWRkIGEgbm8tb3AgdG8gZm9yY2UgcnVubmluZyBieSB0aGUgbW9kZWxcblx0XHRcdFx0YnVpbGRlci5hZGRFZGl0T3BlcmF0aW9uKG5ldyBSYW5nZSgxLCAxLCAxLCAxKSwgbnVsbCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBUeXBlIGNvbnRlbnQgZnJvbSBvdGhlciBsaW5lIG51bWJlciBvbiBsaW5lIG51bWJlclxuXHRcdFx0XHRidWlsZGVyLmFkZEVkaXRPcGVyYXRpb24obmV3IFJhbmdlKGxpbmVOdW1iZXIsIDEsIGxpbmVOdW1iZXIsIDEpLCBtb2RlbC5nZXRMaW5lQ29udGVudChvdGhlckxpbmVOdW1iZXIpKTtcblxuXHRcdFx0XHQvLyBSZW1vdmUgY29udGVudCBmcm9tIG90aGVyIGxpbmUgbnVtYmVyXG5cdFx0XHRcdGJ1aWxkZXIuYWRkRWRpdE9wZXJhdGlvbihuZXcgUmFuZ2Uob3RoZXJMaW5lTnVtYmVyLCAxLCBvdGhlckxpbmVOdW1iZXIsIG1vZGVsLmdldExpbmVNYXhDb2x1bW4ob3RoZXJMaW5lTnVtYmVyKSksIG51bGwpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gVHJhY2sgc2VsZWN0aW9uIGF0IHRoZSBvdGhlciBsaW5lIG51bWJlclxuXHRcdFx0cyA9IG5ldyBTZWxlY3Rpb24ob3RoZXJMaW5lTnVtYmVyLCAxLCBvdGhlckxpbmVOdW1iZXIsIDEpO1xuXG5cdFx0fSBlbHNlIHtcblxuXHRcdFx0bGV0IG1vdmluZ0xpbmVOdW1iZXI6IG51bWJlcjtcblx0XHRcdGxldCBtb3ZpbmdMaW5lVGV4dDogc3RyaW5nO1xuXG5cdFx0XHRpZiAodGhpcy5faXNNb3ZpbmdEb3duKSB7XG5cdFx0XHRcdG1vdmluZ0xpbmVOdW1iZXIgPSBzLmVuZExpbmVOdW1iZXIgKyAxO1xuXHRcdFx0XHRtb3ZpbmdMaW5lVGV4dCA9IG1vZGVsLmdldExpbmVDb250ZW50KG1vdmluZ0xpbmVOdW1iZXIpO1xuXHRcdFx0XHQvLyBEZWxldGUgbGluZSB0aGF0IG5lZWRzIHRvIGJlIG1vdmVkXG5cdFx0XHRcdGJ1aWxkZXIuYWRkRWRpdE9wZXJhdGlvbihuZXcgUmFuZ2UobW92aW5nTGluZU51bWJlciAtIDEsIG1vZGVsLmdldExpbmVNYXhDb2x1bW4obW92aW5nTGluZU51bWJlciAtIDEpLCBtb3ZpbmdMaW5lTnVtYmVyLCBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKG1vdmluZ0xpbmVOdW1iZXIpKSwgbnVsbCk7XG5cblx0XHRcdFx0bGV0IGluc2VydGluZ1RleHQgPSBtb3ZpbmdMaW5lVGV4dDtcblxuXHRcdFx0XHRpZiAodGhpcy5zaG91bGRBdXRvSW5kZW50KG1vZGVsLCBzKSkge1xuXHRcdFx0XHRcdGNvbnN0IG1vdmluZ0xpbmVNYXRjaFJlc3VsdCA9IHRoaXMubWF0Y2hFbnRlclJ1bGUobW9kZWwsIGluZGVudENvbnZlcnRlciwgdGFiU2l6ZSwgbW92aW5nTGluZU51bWJlciwgcy5zdGFydExpbmVOdW1iZXIgLSAxKTtcblx0XHRcdFx0XHQvLyBpZiBzLnN0YXJ0TGluZU51bWJlciAtIDEgbWF0Y2hlcyBvbkVudGVyIHJ1bGUsIHdlIHN0aWxsIGhvbm9yIHRoYXQuXG5cdFx0XHRcdFx0aWYgKG1vdmluZ0xpbmVNYXRjaFJlc3VsdCAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0Y29uc3Qgb2xkSW5kZW50YXRpb24gPSBzdHJpbmdzLmdldExlYWRpbmdXaGl0ZXNwYWNlKG1vZGVsLmdldExpbmVDb250ZW50KG1vdmluZ0xpbmVOdW1iZXIpKTtcblx0XHRcdFx0XHRcdGNvbnN0IG5ld1NwYWNlQ250ID0gbW92aW5nTGluZU1hdGNoUmVzdWx0ICsgaW5kZW50VXRpbHMuZ2V0U3BhY2VDbnQob2xkSW5kZW50YXRpb24sIHRhYlNpemUpO1xuXHRcdFx0XHRcdFx0Y29uc3QgbmV3SW5kZW50YXRpb24gPSBpbmRlbnRVdGlscy5nZW5lcmF0ZUluZGVudChuZXdTcGFjZUNudCwgdGFiU2l6ZSwgaW5zZXJ0U3BhY2VzKTtcblx0XHRcdFx0XHRcdGluc2VydGluZ1RleHQgPSBuZXdJbmRlbnRhdGlvbiArIHRoaXMudHJpbVN0YXJ0KG1vdmluZ0xpbmVUZXh0KTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gbm8gZW50ZXIgcnVsZSBtYXRjaGVzLCBsZXQncyBjaGVjayBpbmRlbnRhdGluIHJ1bGVzIHRoZW4uXG5cdFx0XHRcdFx0XHRjb25zdCB2aXJ0dWFsTW9kZWw6IElWaXJ0dWFsTW9kZWwgPSB7XG5cdFx0XHRcdFx0XHRcdHRva2VuaXphdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRcdGdldExpbmVUb2tlbnM6IChsaW5lTnVtYmVyOiBudW1iZXIpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChsaW5lTnVtYmVyID09PSBzLnN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gbW9kZWwudG9rZW5pemF0aW9uLmdldExpbmVUb2tlbnMobW92aW5nTGluZU51bWJlcik7XG5cdFx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gbW9kZWwudG9rZW5pemF0aW9uLmdldExpbmVUb2tlbnMobGluZU51bWJlcik7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRnZXRMYW5ndWFnZUlkLFxuXHRcdFx0XHRcdFx0XHRcdGdldExhbmd1YWdlSWRBdFBvc2l0aW9uLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRnZXRMaW5lQ29udGVudDogKGxpbmVOdW1iZXI6IG51bWJlcikgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChsaW5lTnVtYmVyID09PSBzLnN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIG1vZGVsLmdldExpbmVDb250ZW50KG1vdmluZ0xpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gbW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZU51bWJlcik7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdGNvbnN0IGluZGVudE9mTW92aW5nTGluZSA9IGdldEdvb2RJbmRlbnRGb3JMaW5lKFxuXHRcdFx0XHRcdFx0XHR0aGlzLl9hdXRvSW5kZW50LFxuXHRcdFx0XHRcdFx0XHR2aXJ0dWFsTW9kZWwsXG5cdFx0XHRcdFx0XHRcdG1vZGVsLmdldExhbmd1YWdlSWRBdFBvc2l0aW9uKG1vdmluZ0xpbmVOdW1iZXIsIDEpLFxuXHRcdFx0XHRcdFx0XHRzLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0XHRcdFx0aW5kZW50Q29udmVydGVyLFxuXHRcdFx0XHRcdFx0XHR0aGlzLl9sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0aWYgKGluZGVudE9mTW92aW5nTGluZSAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBvbGRJbmRlbnRhdGlvbiA9IHN0cmluZ3MuZ2V0TGVhZGluZ1doaXRlc3BhY2UobW9kZWwuZ2V0TGluZUNvbnRlbnQobW92aW5nTGluZU51bWJlcikpO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBuZXdTcGFjZUNudCA9IGluZGVudFV0aWxzLmdldFNwYWNlQ250KGluZGVudE9mTW92aW5nTGluZSwgdGFiU2l6ZSk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IG9sZFNwYWNlQ250ID0gaW5kZW50VXRpbHMuZ2V0U3BhY2VDbnQob2xkSW5kZW50YXRpb24sIHRhYlNpemUpO1xuXHRcdFx0XHRcdFx0XHRpZiAobmV3U3BhY2VDbnQgIT09IG9sZFNwYWNlQ250KSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgbmV3SW5kZW50YXRpb24gPSBpbmRlbnRVdGlscy5nZW5lcmF0ZUluZGVudChuZXdTcGFjZUNudCwgdGFiU2l6ZSwgaW5zZXJ0U3BhY2VzKTtcblx0XHRcdFx0XHRcdFx0XHRpbnNlcnRpbmdUZXh0ID0gbmV3SW5kZW50YXRpb24gKyB0aGlzLnRyaW1TdGFydChtb3ZpbmdMaW5lVGV4dCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBhZGQgZWRpdCBvcGVyYXRpb25zIGZvciBtb3ZpbmcgbGluZSBmaXJzdCB0byBtYWtlIHN1cmUgaXQncyBleGVjdXRlZCBhZnRlciB3ZSBtYWtlIGluZGVudGF0aW9uIGNoYW5nZVxuXHRcdFx0XHRcdC8vIHRvIHMuc3RhcnRMaW5lTnVtYmVyXG5cdFx0XHRcdFx0YnVpbGRlci5hZGRFZGl0T3BlcmF0aW9uKG5ldyBSYW5nZShzLnN0YXJ0TGluZU51bWJlciwgMSwgcy5zdGFydExpbmVOdW1iZXIsIDEpLCBpbnNlcnRpbmdUZXh0ICsgJ1xcbicpO1xuXG5cdFx0XHRcdFx0Y29uc3QgcmV0ID0gdGhpcy5tYXRjaEVudGVyUnVsZU1vdmluZ0Rvd24obW9kZWwsIGluZGVudENvbnZlcnRlciwgdGFiU2l6ZSwgcy5zdGFydExpbmVOdW1iZXIsIG1vdmluZ0xpbmVOdW1iZXIsIGluc2VydGluZ1RleHQpO1xuXG5cdFx0XHRcdFx0Ly8gY2hlY2sgaWYgdGhlIGxpbmUgYmVpbmcgbW92ZWQgYmVmb3JlIG1hdGNoZXMgb25FbnRlciBydWxlcywgaWYgc28gbGV0J3MgYWRqdXN0IHRoZSBpbmRlbnRhdGlvbiBieSBvbkVudGVyIHJ1bGVzLlxuXHRcdFx0XHRcdGlmIChyZXQgIT09IG51bGwpIHtcblx0XHRcdFx0XHRcdGlmIChyZXQgIT09IDApIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5nZXRJbmRlbnRFZGl0c09mTW92aW5nQmxvY2sobW9kZWwsIGJ1aWxkZXIsIHMsIHRhYlNpemUsIGluc2VydFNwYWNlcywgcmV0KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gaXQgZG9lc24ndCBtYXRjaCBvbkVudGVyIHJ1bGVzLCBsZXQncyBjaGVjayBpbmRlbnRhdGlvbiBydWxlcyB0aGVuLlxuXHRcdFx0XHRcdFx0Y29uc3QgdmlydHVhbE1vZGVsOiBJVmlydHVhbE1vZGVsID0ge1xuXHRcdFx0XHRcdFx0XHR0b2tlbml6YXRpb246IHtcblx0XHRcdFx0XHRcdFx0XHRnZXRMaW5lVG9rZW5zOiAobGluZU51bWJlcjogbnVtYmVyKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAobGluZU51bWJlciA9PT0gcy5zdGFydExpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gVE9ET0BhaWRheS1tYXI6IHRoZSB0b2tlbnMgaGVyZSBkb24ndCBjb3JyZXNwb25kIGV4YWN0bHkgdG8gdGhlIGNvcnJlc3BvbmRpbmcgY29udGVudCAoYWZ0ZXIgaW5kZW50YXRpb24gYWRqdXN0bWVudCksIGhhdmUgdG8gZml4IHRoaXMuXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiBtb2RlbC50b2tlbml6YXRpb24uZ2V0TGluZVRva2Vucyhtb3ZpbmdMaW5lTnVtYmVyKTtcblx0XHRcdFx0XHRcdFx0XHRcdH0gZWxzZSBpZiAobGluZU51bWJlciA+PSBzLnN0YXJ0TGluZU51bWJlciArIDEgJiYgbGluZU51bWJlciA8PSBzLmVuZExpbmVOdW1iZXIgKyAxKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiBtb2RlbC50b2tlbml6YXRpb24uZ2V0TGluZVRva2VucyhsaW5lTnVtYmVyIC0gMSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gbW9kZWwudG9rZW5pemF0aW9uLmdldExpbmVUb2tlbnMobGluZU51bWJlcik7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRnZXRMYW5ndWFnZUlkLFxuXHRcdFx0XHRcdFx0XHRcdGdldExhbmd1YWdlSWRBdFBvc2l0aW9uLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRnZXRMaW5lQ29udGVudDogKGxpbmVOdW1iZXI6IG51bWJlcikgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChsaW5lTnVtYmVyID09PSBzLnN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGluc2VydGluZ1RleHQ7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIGlmIChsaW5lTnVtYmVyID49IHMuc3RhcnRMaW5lTnVtYmVyICsgMSAmJiBsaW5lTnVtYmVyIDw9IHMuZW5kTGluZU51bWJlciArIDEpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiBtb2RlbC5nZXRMaW5lQ29udGVudChsaW5lTnVtYmVyIC0gMSk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiBtb2RlbC5nZXRMaW5lQ29udGVudChsaW5lTnVtYmVyKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0XHRjb25zdCBuZXdJbmRlbnRhdE9mTW92aW5nQmxvY2sgPSBnZXRHb29kSW5kZW50Rm9yTGluZShcblx0XHRcdFx0XHRcdFx0dGhpcy5fYXV0b0luZGVudCxcblx0XHRcdFx0XHRcdFx0dmlydHVhbE1vZGVsLFxuXHRcdFx0XHRcdFx0XHRtb2RlbC5nZXRMYW5ndWFnZUlkQXRQb3NpdGlvbihtb3ZpbmdMaW5lTnVtYmVyLCAxKSxcblx0XHRcdFx0XHRcdFx0cy5zdGFydExpbmVOdW1iZXIgKyAxLFxuXHRcdFx0XHRcdFx0XHRpbmRlbnRDb252ZXJ0ZXIsXG5cdFx0XHRcdFx0XHRcdHRoaXMuX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdGlmIChuZXdJbmRlbnRhdE9mTW92aW5nQmxvY2sgIT09IG51bGwpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3Qgb2xkSW5kZW50YXRpb24gPSBzdHJpbmdzLmdldExlYWRpbmdXaGl0ZXNwYWNlKG1vZGVsLmdldExpbmVDb250ZW50KHMuc3RhcnRMaW5lTnVtYmVyKSk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IG5ld1NwYWNlQ250ID0gaW5kZW50VXRpbHMuZ2V0U3BhY2VDbnQobmV3SW5kZW50YXRPZk1vdmluZ0Jsb2NrLCB0YWJTaXplKTtcblx0XHRcdFx0XHRcdFx0Y29uc3Qgb2xkU3BhY2VDbnQgPSBpbmRlbnRVdGlscy5nZXRTcGFjZUNudChvbGRJbmRlbnRhdGlvbiwgdGFiU2l6ZSk7XG5cdFx0XHRcdFx0XHRcdGlmIChuZXdTcGFjZUNudCAhPT0gb2xkU3BhY2VDbnQpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBzcGFjZUNudE9mZnNldCA9IG5ld1NwYWNlQ250IC0gb2xkU3BhY2VDbnQ7XG5cblx0XHRcdFx0XHRcdFx0XHR0aGlzLmdldEluZGVudEVkaXRzT2ZNb3ZpbmdCbG9jayhtb2RlbCwgYnVpbGRlciwgcywgdGFiU2l6ZSwgaW5zZXJ0U3BhY2VzLCBzcGFjZUNudE9mZnNldCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gSW5zZXJ0IGxpbmUgdGhhdCBuZWVkcyB0byBiZSBtb3ZlZCBiZWZvcmVcblx0XHRcdFx0XHRidWlsZGVyLmFkZEVkaXRPcGVyYXRpb24obmV3IFJhbmdlKHMuc3RhcnRMaW5lTnVtYmVyLCAxLCBzLnN0YXJ0TGluZU51bWJlciwgMSksIGluc2VydGluZ1RleHQgKyAnXFxuJyk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1vdmluZ0xpbmVOdW1iZXIgPSBzLnN0YXJ0TGluZU51bWJlciAtIDE7XG5cdFx0XHRcdG1vdmluZ0xpbmVUZXh0ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQobW92aW5nTGluZU51bWJlcik7XG5cblx0XHRcdFx0Ly8gRGVsZXRlIGxpbmUgdGhhdCBuZWVkcyB0byBiZSBtb3ZlZFxuXHRcdFx0XHRidWlsZGVyLmFkZEVkaXRPcGVyYXRpb24obmV3IFJhbmdlKG1vdmluZ0xpbmVOdW1iZXIsIDEsIG1vdmluZ0xpbmVOdW1iZXIgKyAxLCAxKSwgbnVsbCk7XG5cblx0XHRcdFx0Ly8gSW5zZXJ0IGxpbmUgdGhhdCBuZWVkcyB0byBiZSBtb3ZlZCBhZnRlclxuXHRcdFx0XHRidWlsZGVyLmFkZEVkaXRPcGVyYXRpb24obmV3IFJhbmdlKHMuZW5kTGluZU51bWJlciwgbW9kZWwuZ2V0TGluZU1heENvbHVtbihzLmVuZExpbmVOdW1iZXIpLCBzLmVuZExpbmVOdW1iZXIsIG1vZGVsLmdldExpbmVNYXhDb2x1bW4ocy5lbmRMaW5lTnVtYmVyKSksICdcXG4nICsgbW92aW5nTGluZVRleHQpO1xuXG5cdFx0XHRcdGlmICh0aGlzLnNob3VsZEF1dG9JbmRlbnQobW9kZWwsIHMpKSB7XG5cdFx0XHRcdFx0Y29uc3QgdmlydHVhbE1vZGVsOiBJVmlydHVhbE1vZGVsID0ge1xuXHRcdFx0XHRcdFx0dG9rZW5pemF0aW9uOiB7XG5cdFx0XHRcdFx0XHRcdGdldExpbmVUb2tlbnM6IChsaW5lTnVtYmVyOiBudW1iZXIpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRpZiAobGluZU51bWJlciA9PT0gbW92aW5nTGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIG1vZGVsLnRva2VuaXphdGlvbi5nZXRMaW5lVG9rZW5zKHMuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIG1vZGVsLnRva2VuaXphdGlvbi5nZXRMaW5lVG9rZW5zKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0Z2V0TGFuZ3VhZ2VJZCxcblx0XHRcdFx0XHRcdFx0Z2V0TGFuZ3VhZ2VJZEF0UG9zaXRpb24sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0Z2V0TGluZUNvbnRlbnQ6IChsaW5lTnVtYmVyOiBudW1iZXIpID0+IHtcblx0XHRcdFx0XHRcdFx0aWYgKGxpbmVOdW1iZXIgPT09IG1vdmluZ0xpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gbW9kZWwuZ2V0TGluZUNvbnRlbnQocy5zdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBtb2RlbC5nZXRMaW5lQ29udGVudChsaW5lTnVtYmVyKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0Y29uc3QgcmV0ID0gdGhpcy5tYXRjaEVudGVyUnVsZShtb2RlbCwgaW5kZW50Q29udmVydGVyLCB0YWJTaXplLCBzLnN0YXJ0TGluZU51bWJlciwgcy5zdGFydExpbmVOdW1iZXIgLSAyKTtcblx0XHRcdFx0XHQvLyBjaGVjayBpZiBzLnN0YXJ0TGluZU51bWJlciAtIDIgbWF0Y2hlcyBvbkVudGVyIHJ1bGVzLCBpZiBzbyBhZGp1c3QgdGhlIG1vdmluZyBibG9jayBieSBvbkVudGVyIHJ1bGVzLlxuXHRcdFx0XHRcdGlmIChyZXQgIT09IG51bGwpIHtcblx0XHRcdFx0XHRcdGlmIChyZXQgIT09IDApIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5nZXRJbmRlbnRFZGl0c09mTW92aW5nQmxvY2sobW9kZWwsIGJ1aWxkZXIsIHMsIHRhYlNpemUsIGluc2VydFNwYWNlcywgcmV0KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gaXQgZG9lc24ndCBtYXRjaCBhbnkgb25FbnRlciBydWxlLCBsZXQncyBjaGVjayBpbmRlbnRhdGlvbiBydWxlcyB0aGVuLlxuXHRcdFx0XHRcdFx0Y29uc3QgaW5kZW50T2ZGaXJzdExpbmUgPSBnZXRHb29kSW5kZW50Rm9yTGluZShcblx0XHRcdFx0XHRcdFx0dGhpcy5fYXV0b0luZGVudCxcblx0XHRcdFx0XHRcdFx0dmlydHVhbE1vZGVsLFxuXHRcdFx0XHRcdFx0XHRtb2RlbC5nZXRMYW5ndWFnZUlkQXRQb3NpdGlvbihzLnN0YXJ0TGluZU51bWJlciwgMSksXG5cdFx0XHRcdFx0XHRcdG1vdmluZ0xpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRcdGluZGVudENvbnZlcnRlcixcblx0XHRcdFx0XHRcdFx0dGhpcy5fbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRcdGlmIChpbmRlbnRPZkZpcnN0TGluZSAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0XHQvLyBhZGp1c3QgdGhlIGluZGVudGF0aW9uIG9mIHRoZSBtb3ZpbmcgYmxvY2tcblx0XHRcdFx0XHRcdFx0Y29uc3Qgb2xkSW5kZW50ID0gc3RyaW5ncy5nZXRMZWFkaW5nV2hpdGVzcGFjZShtb2RlbC5nZXRMaW5lQ29udGVudChzLnN0YXJ0TGluZU51bWJlcikpO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBuZXdTcGFjZUNudCA9IGluZGVudFV0aWxzLmdldFNwYWNlQ250KGluZGVudE9mRmlyc3RMaW5lLCB0YWJTaXplKTtcblx0XHRcdFx0XHRcdFx0Y29uc3Qgb2xkU3BhY2VDbnQgPSBpbmRlbnRVdGlscy5nZXRTcGFjZUNudChvbGRJbmRlbnQsIHRhYlNpemUpO1xuXHRcdFx0XHRcdFx0XHRpZiAobmV3U3BhY2VDbnQgIT09IG9sZFNwYWNlQ250KSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3Qgc3BhY2VDbnRPZmZzZXQgPSBuZXdTcGFjZUNudCAtIG9sZFNwYWNlQ250O1xuXG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5nZXRJbmRlbnRFZGl0c09mTW92aW5nQmxvY2sobW9kZWwsIGJ1aWxkZXIsIHMsIHRhYlNpemUsIGluc2VydFNwYWNlcywgc3BhY2VDbnRPZmZzZXQpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fc2VsZWN0aW9uSWQgPSBidWlsZGVyLnRyYWNrU2VsZWN0aW9uKHMpO1xuXHR9XG5cblx0cHJpdmF0ZSBidWlsZEluZGVudENvbnZlcnRlcih0YWJTaXplOiBudW1iZXIsIGluZGVudFNpemU6IG51bWJlciwgaW5zZXJ0U3BhY2VzOiBib29sZWFuKTogSUluZGVudENvbnZlcnRlciB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHNoaWZ0SW5kZW50OiAoaW5kZW50YXRpb24pID0+IHtcblx0XHRcdFx0cmV0dXJuIFNoaWZ0Q29tbWFuZC5zaGlmdEluZGVudChpbmRlbnRhdGlvbiwgaW5kZW50YXRpb24ubGVuZ3RoICsgMSwgdGFiU2l6ZSwgaW5kZW50U2l6ZSwgaW5zZXJ0U3BhY2VzKTtcblx0XHRcdH0sXG5cdFx0XHR1bnNoaWZ0SW5kZW50OiAoaW5kZW50YXRpb24pID0+IHtcblx0XHRcdFx0cmV0dXJuIFNoaWZ0Q29tbWFuZC51bnNoaWZ0SW5kZW50KGluZGVudGF0aW9uLCBpbmRlbnRhdGlvbi5sZW5ndGggKyAxLCB0YWJTaXplLCBpbmRlbnRTaXplLCBpbnNlcnRTcGFjZXMpO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHBhcnNlRW50ZXJSZXN1bHQobW9kZWw6IElUZXh0TW9kZWwsIGluZGVudENvbnZlcnRlcjogSUluZGVudENvbnZlcnRlciwgdGFiU2l6ZTogbnVtYmVyLCBsaW5lOiBudW1iZXIsIGVudGVyOiBDb21wbGV0ZUVudGVyQWN0aW9uIHwgbnVsbCkge1xuXHRcdGlmIChlbnRlcikge1xuXHRcdFx0bGV0IGVudGVyUHJlZml4ID0gZW50ZXIuaW5kZW50YXRpb247XG5cblx0XHRcdGlmIChlbnRlci5pbmRlbnRBY3Rpb24gPT09IEluZGVudEFjdGlvbi5Ob25lKSB7XG5cdFx0XHRcdGVudGVyUHJlZml4ID0gZW50ZXIuaW5kZW50YXRpb24gKyBlbnRlci5hcHBlbmRUZXh0O1xuXHRcdFx0fSBlbHNlIGlmIChlbnRlci5pbmRlbnRBY3Rpb24gPT09IEluZGVudEFjdGlvbi5JbmRlbnQpIHtcblx0XHRcdFx0ZW50ZXJQcmVmaXggPSBlbnRlci5pbmRlbnRhdGlvbiArIGVudGVyLmFwcGVuZFRleHQ7XG5cdFx0XHR9IGVsc2UgaWYgKGVudGVyLmluZGVudEFjdGlvbiA9PT0gSW5kZW50QWN0aW9uLkluZGVudE91dGRlbnQpIHtcblx0XHRcdFx0ZW50ZXJQcmVmaXggPSBlbnRlci5pbmRlbnRhdGlvbjtcblx0XHRcdH0gZWxzZSBpZiAoZW50ZXIuaW5kZW50QWN0aW9uID09PSBJbmRlbnRBY3Rpb24uT3V0ZGVudCkge1xuXHRcdFx0XHRlbnRlclByZWZpeCA9IGluZGVudENvbnZlcnRlci51bnNoaWZ0SW5kZW50KGVudGVyLmluZGVudGF0aW9uKSArIGVudGVyLmFwcGVuZFRleHQ7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBtb3ZpbmdMaW5lVGV4dCA9IG1vZGVsLmdldExpbmVDb250ZW50KGxpbmUpO1xuXHRcdFx0aWYgKHRoaXMudHJpbVN0YXJ0KG1vdmluZ0xpbmVUZXh0KS5pbmRleE9mKHRoaXMudHJpbVN0YXJ0KGVudGVyUHJlZml4KSkgPj0gMCkge1xuXHRcdFx0XHRjb25zdCBvbGRJbmRlbnRhdGlvbiA9IHN0cmluZ3MuZ2V0TGVhZGluZ1doaXRlc3BhY2UobW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZSkpO1xuXHRcdFx0XHRsZXQgbmV3SW5kZW50YXRpb24gPSBzdHJpbmdzLmdldExlYWRpbmdXaGl0ZXNwYWNlKGVudGVyUHJlZml4KTtcblx0XHRcdFx0Y29uc3QgaW5kZW50TWV0YWRhdGFPZk1vdmVsaW5nTGluZSA9IGdldEluZGVudE1ldGFkYXRhKG1vZGVsLCBsaW5lLCB0aGlzLl9sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRcdFx0aWYgKGluZGVudE1ldGFkYXRhT2ZNb3ZlbGluZ0xpbmUgIT09IG51bGwgJiYgaW5kZW50TWV0YWRhdGFPZk1vdmVsaW5nTGluZSAmIEluZGVudENvbnN0cy5ERUNSRUFTRV9NQVNLKSB7XG5cdFx0XHRcdFx0bmV3SW5kZW50YXRpb24gPSBpbmRlbnRDb252ZXJ0ZXIudW5zaGlmdEluZGVudChuZXdJbmRlbnRhdGlvbik7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgbmV3U3BhY2VDbnQgPSBpbmRlbnRVdGlscy5nZXRTcGFjZUNudChuZXdJbmRlbnRhdGlvbiwgdGFiU2l6ZSk7XG5cdFx0XHRcdGNvbnN0IG9sZFNwYWNlQ250ID0gaW5kZW50VXRpbHMuZ2V0U3BhY2VDbnQob2xkSW5kZW50YXRpb24sIHRhYlNpemUpO1xuXHRcdFx0XHRyZXR1cm4gbmV3U3BhY2VDbnQgLSBvbGRTcGFjZUNudDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0gbW9kZWxcblx0ICogQHBhcmFtIGluZGVudENvbnZlcnRlclxuXHQgKiBAcGFyYW0gdGFiU2l6ZVxuXHQgKiBAcGFyYW0gbGluZSB0aGUgbGluZSBtb3ZpbmcgZG93blxuXHQgKiBAcGFyYW0gZnV0dXJlQWJvdmVMaW5lTnVtYmVyIHRoZSBsaW5lIHdoaWNoIHdpbGwgYmUgYXQgdGhlIGBsaW5lYCBwb3NpdGlvblxuXHQgKiBAcGFyYW0gZnV0dXJlQWJvdmVMaW5lVGV4dFxuXHQgKi9cblx0cHJpdmF0ZSBtYXRjaEVudGVyUnVsZU1vdmluZ0Rvd24obW9kZWw6IElUZXh0TW9kZWwsIGluZGVudENvbnZlcnRlcjogSUluZGVudENvbnZlcnRlciwgdGFiU2l6ZTogbnVtYmVyLCBsaW5lOiBudW1iZXIsIGZ1dHVyZUFib3ZlTGluZU51bWJlcjogbnVtYmVyLCBmdXR1cmVBYm92ZUxpbmVUZXh0OiBzdHJpbmcpIHtcblx0XHRpZiAoc3RyaW5ncy5sYXN0Tm9uV2hpdGVzcGFjZUluZGV4KGZ1dHVyZUFib3ZlTGluZVRleHQpID49IDApIHtcblx0XHRcdC8vIGJyZWFrXG5cdFx0XHRjb25zdCBtYXhDb2x1bW4gPSBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGZ1dHVyZUFib3ZlTGluZU51bWJlcik7XG5cdFx0XHRjb25zdCBlbnRlciA9IGdldEVudGVyQWN0aW9uKHRoaXMuX2F1dG9JbmRlbnQsIG1vZGVsLCBuZXcgUmFuZ2UoZnV0dXJlQWJvdmVMaW5lTnVtYmVyLCBtYXhDb2x1bW4sIGZ1dHVyZUFib3ZlTGluZU51bWJlciwgbWF4Q29sdW1uKSwgdGhpcy5fbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0XHRyZXR1cm4gdGhpcy5wYXJzZUVudGVyUmVzdWx0KG1vZGVsLCBpbmRlbnRDb252ZXJ0ZXIsIHRhYlNpemUsIGxpbmUsIGVudGVyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gZ28gdXB3YXJkcywgc3RhcnRpbmcgZnJvbSBgbGluZSAtIDFgXG5cdFx0XHRsZXQgdmFsaWRQcmVjZWRpbmdMaW5lID0gbGluZSAtIDE7XG5cdFx0XHR3aGlsZSAodmFsaWRQcmVjZWRpbmdMaW5lID49IDEpIHtcblx0XHRcdFx0Y29uc3QgbGluZUNvbnRlbnQgPSBtb2RlbC5nZXRMaW5lQ29udGVudCh2YWxpZFByZWNlZGluZ0xpbmUpO1xuXHRcdFx0XHRjb25zdCBub25XaGl0ZXNwYWNlSWR4ID0gc3RyaW5ncy5sYXN0Tm9uV2hpdGVzcGFjZUluZGV4KGxpbmVDb250ZW50KTtcblxuXHRcdFx0XHRpZiAobm9uV2hpdGVzcGFjZUlkeCA+PSAwKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR2YWxpZFByZWNlZGluZ0xpbmUtLTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHZhbGlkUHJlY2VkaW5nTGluZSA8IDEgfHwgbGluZSA+IG1vZGVsLmdldExpbmVDb3VudCgpKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtYXhDb2x1bW4gPSBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKHZhbGlkUHJlY2VkaW5nTGluZSk7XG5cdFx0XHRjb25zdCBlbnRlciA9IGdldEVudGVyQWN0aW9uKHRoaXMuX2F1dG9JbmRlbnQsIG1vZGVsLCBuZXcgUmFuZ2UodmFsaWRQcmVjZWRpbmdMaW5lLCBtYXhDb2x1bW4sIHZhbGlkUHJlY2VkaW5nTGluZSwgbWF4Q29sdW1uKSwgdGhpcy5fbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0XHRyZXR1cm4gdGhpcy5wYXJzZUVudGVyUmVzdWx0KG1vZGVsLCBpbmRlbnRDb252ZXJ0ZXIsIHRhYlNpemUsIGxpbmUsIGVudGVyKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG1hdGNoRW50ZXJSdWxlKG1vZGVsOiBJVGV4dE1vZGVsLCBpbmRlbnRDb252ZXJ0ZXI6IElJbmRlbnRDb252ZXJ0ZXIsIHRhYlNpemU6IG51bWJlciwgbGluZTogbnVtYmVyLCBvbmVMaW5lQWJvdmU6IG51bWJlciwgcHJldmlvdXNMaW5lVGV4dD86IHN0cmluZykge1xuXHRcdGxldCB2YWxpZFByZWNlZGluZ0xpbmUgPSBvbmVMaW5lQWJvdmU7XG5cdFx0d2hpbGUgKHZhbGlkUHJlY2VkaW5nTGluZSA+PSAxKSB7XG5cdFx0XHQvLyBzaGlwIGVtcHR5IGxpbmVzIGFzIGVtcHR5IGxpbmVzIGp1c3QgaW5oZXJpdCBpbmRlbnRhdGlvblxuXHRcdFx0bGV0IGxpbmVDb250ZW50O1xuXHRcdFx0aWYgKHZhbGlkUHJlY2VkaW5nTGluZSA9PT0gb25lTGluZUFib3ZlICYmIHByZXZpb3VzTGluZVRleHQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRsaW5lQ29udGVudCA9IHByZXZpb3VzTGluZVRleHQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsaW5lQ29udGVudCA9IG1vZGVsLmdldExpbmVDb250ZW50KHZhbGlkUHJlY2VkaW5nTGluZSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG5vbldoaXRlc3BhY2VJZHggPSBzdHJpbmdzLmxhc3ROb25XaGl0ZXNwYWNlSW5kZXgobGluZUNvbnRlbnQpO1xuXHRcdFx0aWYgKG5vbldoaXRlc3BhY2VJZHggPj0gMCkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdHZhbGlkUHJlY2VkaW5nTGluZS0tO1xuXHRcdH1cblxuXHRcdGlmICh2YWxpZFByZWNlZGluZ0xpbmUgPCAxIHx8IGxpbmUgPiBtb2RlbC5nZXRMaW5lQ291bnQoKSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWF4Q29sdW1uID0gbW9kZWwuZ2V0TGluZU1heENvbHVtbih2YWxpZFByZWNlZGluZ0xpbmUpO1xuXHRcdGNvbnN0IGVudGVyID0gZ2V0RW50ZXJBY3Rpb24odGhpcy5fYXV0b0luZGVudCwgbW9kZWwsIG5ldyBSYW5nZSh2YWxpZFByZWNlZGluZ0xpbmUsIG1heENvbHVtbiwgdmFsaWRQcmVjZWRpbmdMaW5lLCBtYXhDb2x1bW4pLCB0aGlzLl9sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRyZXR1cm4gdGhpcy5wYXJzZUVudGVyUmVzdWx0KG1vZGVsLCBpbmRlbnRDb252ZXJ0ZXIsIHRhYlNpemUsIGxpbmUsIGVudGVyKTtcblx0fVxuXG5cdHByaXZhdGUgdHJpbVN0YXJ0KHN0cjogc3RyaW5nKSB7XG5cdFx0cmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzKy8sICcnKTtcblx0fVxuXG5cdHByaXZhdGUgc2hvdWxkQXV0b0luZGVudChtb2RlbDogSVRleHRNb2RlbCwgc2VsZWN0aW9uOiBTZWxlY3Rpb24pIHtcblx0XHRpZiAodGhpcy5fYXV0b0luZGVudCA8IEVkaXRvckF1dG9JbmRlbnRTdHJhdGVneS5GdWxsKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdC8vIGlmIGl0J3Mgbm90IGVhc3kgdG8gdG9rZW5pemUsIHdlIHN0b3AgYXV0byBpbmRlbnQuXG5cdFx0aWYgKCFtb2RlbC50b2tlbml6YXRpb24uaXNDaGVhcFRvVG9rZW5pemUoc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlcikpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29uc3QgbGFuZ3VhZ2VBdFNlbGVjdGlvblN0YXJ0ID0gbW9kZWwuZ2V0TGFuZ3VhZ2VJZEF0UG9zaXRpb24oc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciwgMSk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VBdFNlbGVjdGlvbkVuZCA9IG1vZGVsLmdldExhbmd1YWdlSWRBdFBvc2l0aW9uKHNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyLCAxKTtcblxuXHRcdGlmIChsYW5ndWFnZUF0U2VsZWN0aW9uU3RhcnQgIT09IGxhbmd1YWdlQXRTZWxlY3Rpb25FbmQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5nZXRMYW5ndWFnZUNvbmZpZ3VyYXRpb24obGFuZ3VhZ2VBdFNlbGVjdGlvblN0YXJ0KS5pbmRlbnRSdWxlc1N1cHBvcnQgPT09IG51bGwpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0SW5kZW50RWRpdHNPZk1vdmluZ0Jsb2NrKG1vZGVsOiBJVGV4dE1vZGVsLCBidWlsZGVyOiBJRWRpdE9wZXJhdGlvbkJ1aWxkZXIsIHM6IFNlbGVjdGlvbiwgdGFiU2l6ZTogbnVtYmVyLCBpbnNlcnRTcGFjZXM6IGJvb2xlYW4sIG9mZnNldDogbnVtYmVyKSB7XG5cdFx0Zm9yIChsZXQgaSA9IHMuc3RhcnRMaW5lTnVtYmVyOyBpIDw9IHMuZW5kTGluZU51bWJlcjsgaSsrKSB7XG5cdFx0XHRjb25zdCBsaW5lQ29udGVudCA9IG1vZGVsLmdldExpbmVDb250ZW50KGkpO1xuXHRcdFx0Y29uc3Qgb3JpZ2luYWxJbmRlbnQgPSBzdHJpbmdzLmdldExlYWRpbmdXaGl0ZXNwYWNlKGxpbmVDb250ZW50KTtcblx0XHRcdGNvbnN0IG9yaWdpbmFsU3BhY2VzQ250ID0gaW5kZW50VXRpbHMuZ2V0U3BhY2VDbnQob3JpZ2luYWxJbmRlbnQsIHRhYlNpemUpO1xuXHRcdFx0Y29uc3QgbmV3U3BhY2VzQ250ID0gb3JpZ2luYWxTcGFjZXNDbnQgKyBvZmZzZXQ7XG5cdFx0XHRjb25zdCBuZXdJbmRlbnQgPSBpbmRlbnRVdGlscy5nZW5lcmF0ZUluZGVudChuZXdTcGFjZXNDbnQsIHRhYlNpemUsIGluc2VydFNwYWNlcyk7XG5cblx0XHRcdGlmIChuZXdJbmRlbnQgIT09IG9yaWdpbmFsSW5kZW50KSB7XG5cdFx0XHRcdGJ1aWxkZXIuYWRkRWRpdE9wZXJhdGlvbihuZXcgUmFuZ2UoaSwgMSwgaSwgb3JpZ2luYWxJbmRlbnQubGVuZ3RoICsgMSksIG5ld0luZGVudCk7XG5cblx0XHRcdFx0aWYgKGkgPT09IHMuZW5kTGluZU51bWJlciAmJiBzLmVuZENvbHVtbiA8PSBvcmlnaW5hbEluZGVudC5sZW5ndGggKyAxICYmIG5ld0luZGVudCA9PT0gJycpIHtcblx0XHRcdFx0XHQvLyBhcyB1c2VycyBzZWxlY3QgcGFydCBvZiB0aGUgb3JpZ2luYWwgaW5kZW50IHdoaXRlIHNwYWNlc1xuXHRcdFx0XHRcdC8vIHdoZW4gd2UgYWRqdXN0IHRoZSBpbmRlbnRhdGlvbiBvZiBlbmRMaW5lLCB3ZSBzaG91bGQgYWRqdXN0IHRoZSBjdXJzb3IgcG9zaXRpb24gYXMgd2VsbC5cblx0XHRcdFx0XHR0aGlzLl9tb3ZlRW5kTGluZVNlbGVjdGlvblNocmluayA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBjb21wdXRlQ3Vyc29yU3RhdGUobW9kZWw6IElUZXh0TW9kZWwsIGhlbHBlcjogSUN1cnNvclN0YXRlQ29tcHV0ZXJEYXRhKTogU2VsZWN0aW9uIHtcblx0XHRsZXQgcmVzdWx0ID0gaGVscGVyLmdldFRyYWNrZWRTZWxlY3Rpb24odGhpcy5fc2VsZWN0aW9uSWQhKTtcblxuXHRcdGlmICh0aGlzLl9tb3ZlRW5kUG9zaXRpb25Eb3duKSB7XG5cdFx0XHRyZXN1bHQgPSByZXN1bHQuc2V0RW5kUG9zaXRpb24ocmVzdWx0LmVuZExpbmVOdW1iZXIgKyAxLCAxKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fbW92ZUVuZExpbmVTZWxlY3Rpb25TaHJpbmsgJiYgcmVzdWx0LnN0YXJ0TGluZU51bWJlciA8IHJlc3VsdC5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRyZXN1bHQgPSByZXN1bHQuc2V0RW5kUG9zaXRpb24ocmVzdWx0LmVuZExpbmVOdW1iZXIsIDIpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxhQUFhO0FBQ3pCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsYUFBYTtBQUN0QixTQUFTLGlCQUFpQjtBQUcxQixTQUE4QixvQkFBb0I7QUFDbEQsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyxvQkFBb0I7QUFDN0IsWUFBWSxpQkFBaUI7QUFDN0IsU0FBUyxzQkFBc0IseUJBQTBEO0FBQ3pGLFNBQVMsc0JBQXNCO0FBRXhCLElBQU0sbUJBQU4sTUFBMkM7QUFBQSxFQVVqRCxZQUNDLFdBQ0EsY0FDQSxZQUNnRCwrQkFDL0M7QUFEK0M7QUFFaEQsU0FBSyxhQUFhO0FBQ2xCLFNBQUssZ0JBQWdCO0FBQ3JCLFNBQUssY0FBYztBQUNuQixTQUFLLGVBQWU7QUFDcEIsU0FBSyw4QkFBOEI7QUFBQSxFQUNwQztBQUFB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
