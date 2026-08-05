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
import { normalizeDriveLetter } from "../../../../base/common/labels.js";
import * as path from "../../../../base/common/path.js";
import { dirname } from "../../../../base/common/resources.js";
import { commonPrefixLength, getLeadingWhitespace, isFalsyOrWhitespace, splitLines } from "../../../../base/common/strings.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { Text } from "./snippetParser.js";
import * as nls from "../../../../nls.js";
import { WORKSPACE_EXTENSION, isSingleFolderWorkspaceIdentifier, toWorkspaceIdentifier, isEmptyWorkspaceIdentifier } from "../../../../platform/workspace/common/workspace.js";
const KnownSnippetVariableNames = Object.freeze({
  "CURRENT_YEAR": true,
  "CURRENT_YEAR_SHORT": true,
  "CURRENT_MONTH": true,
  "CURRENT_DATE": true,
  "CURRENT_HOUR": true,
  "CURRENT_MINUTE": true,
  "CURRENT_SECOND": true,
  "CURRENT_DAY_NAME": true,
  "CURRENT_DAY_NAME_SHORT": true,
  "CURRENT_MONTH_NAME": true,
  "CURRENT_MONTH_NAME_SHORT": true,
  "CURRENT_SECONDS_UNIX": true,
  "CURRENT_TIMEZONE_OFFSET": true,
  "SELECTION": true,
  "CLIPBOARD": true,
  "TM_SELECTED_TEXT": true,
  "TM_CURRENT_LINE": true,
  "TM_CURRENT_WORD": true,
  "TM_LINE_INDEX": true,
  "TM_LINE_NUMBER": true,
  "TM_FILENAME": true,
  "TM_FILENAME_BASE": true,
  "TM_DIRECTORY": true,
  "TM_FILEPATH": true,
  "CURSOR_INDEX": true,
  // 0-offset
  "CURSOR_NUMBER": true,
  // 1-offset
  "RELATIVE_FILEPATH": true,
  "BLOCK_COMMENT_START": true,
  "BLOCK_COMMENT_END": true,
  "LINE_COMMENT": true,
  "WORKSPACE_NAME": true,
  "WORKSPACE_FOLDER": true,
  "RANDOM": true,
  "RANDOM_HEX": true,
  "UUID": true
});
class CompositeSnippetVariableResolver {
  constructor(_delegates) {
    this._delegates = _delegates;
  }
  resolve(variable) {
    for (const delegate of this._delegates) {
      const value = delegate.resolve(variable);
      if (value !== void 0) {
        return value;
      }
    }
    return void 0;
  }
}
class SelectionBasedVariableResolver {
  constructor(_model, _selection, _selectionIdx, _overtypingCapturer) {
    this._model = _model;
    this._selection = _selection;
    this._selectionIdx = _selectionIdx;
    this._overtypingCapturer = _overtypingCapturer;
  }
  resolve(variable) {
    const { name } = variable;
    if (name === "SELECTION" || name === "TM_SELECTED_TEXT") {
      let value = this._model.getValueInRange(this._selection) || void 0;
      let isMultiline = this._selection.startLineNumber !== this._selection.endLineNumber;
      if (!value && this._overtypingCapturer) {
        const info = this._overtypingCapturer.getLastOvertypedInfo(this._selectionIdx);
        if (info) {
          value = info.value;
          isMultiline = info.multiline;
        }
      }
      if (value && isMultiline && variable.snippet) {
        const line = this._model.getLineContent(this._selection.startLineNumber);
        const lineLeadingWhitespace = getLeadingWhitespace(line, 0, this._selection.startColumn - 1);
        let varLeadingWhitespace = lineLeadingWhitespace;
        variable.snippet.walk((marker) => {
          if (marker === variable) {
            return false;
          }
          if (marker instanceof Text) {
            varLeadingWhitespace = getLeadingWhitespace(splitLines(marker.value).pop());
          }
          return true;
        });
        const whitespaceCommonLength = commonPrefixLength(varLeadingWhitespace, lineLeadingWhitespace);
        value = value.replace(
          /(\r\n|\r|\n)(.*)/g,
          (m, newline, rest) => `${newline}${varLeadingWhitespace.substr(whitespaceCommonLength)}${rest}`
        );
      }
      return value;
    } else if (name === "TM_CURRENT_LINE") {
      return this._model.getLineContent(this._selection.positionLineNumber);
    } else if (name === "TM_CURRENT_WORD") {
      const info = this._model.getWordAtPosition({
        lineNumber: this._selection.positionLineNumber,
        column: this._selection.positionColumn
      });
      return info && info.word || void 0;
    } else if (name === "TM_LINE_INDEX") {
      return String(this._selection.positionLineNumber - 1);
    } else if (name === "TM_LINE_NUMBER") {
      return String(this._selection.positionLineNumber);
    } else if (name === "CURSOR_INDEX") {
      return String(this._selectionIdx);
    } else if (name === "CURSOR_NUMBER") {
      return String(this._selectionIdx + 1);
    }
    return void 0;
  }
}
class ModelBasedVariableResolver {
  constructor(_labelService, _model) {
    this._labelService = _labelService;
    this._model = _model;
  }
  resolve(variable) {
    const { name } = variable;
    if (name === "TM_FILENAME") {
      return path.basename(this._model.uri.fsPath);
    } else if (name === "TM_FILENAME_BASE") {
      const name2 = path.basename(this._model.uri.fsPath);
      const idx = name2.lastIndexOf(".");
      if (idx <= 0) {
        return name2;
      } else {
        return name2.slice(0, idx);
      }
    } else if (name === "TM_DIRECTORY") {
      if (path.dirname(this._model.uri.fsPath) === ".") {
        return "";
      }
      return this._labelService.getUriLabel(dirname(this._model.uri));
    } else if (name === "TM_FILEPATH") {
      return this._labelService.getUriLabel(this._model.uri);
    } else if (name === "RELATIVE_FILEPATH") {
      return this._labelService.getUriLabel(this._model.uri, { relative: true, noPrefix: true });
    }
    return void 0;
  }
}
class ClipboardBasedVariableResolver {
  constructor(_readClipboardText, _selectionIdx, _selectionCount, _spread) {
    this._readClipboardText = _readClipboardText;
    this._selectionIdx = _selectionIdx;
    this._selectionCount = _selectionCount;
    this._spread = _spread;
  }
  resolve(variable) {
    if (variable.name !== "CLIPBOARD") {
      return void 0;
    }
    const clipboardText = this._readClipboardText();
    if (!clipboardText) {
      return void 0;
    }
    if (this._spread) {
      const lines = clipboardText.split(/\r\n|\n|\r/).filter((s) => !isFalsyOrWhitespace(s));
      if (lines.length === this._selectionCount) {
        return lines[this._selectionIdx];
      }
    }
    return clipboardText;
  }
}
let CommentBasedVariableResolver = class {
  constructor(_model, _selection, _languageConfigurationService) {
    this._model = _model;
    this._selection = _selection;
    this._languageConfigurationService = _languageConfigurationService;
  }
  resolve(variable) {
    const { name } = variable;
    const langId = this._model.getLanguageIdAtPosition(this._selection.selectionStartLineNumber, this._selection.selectionStartColumn);
    const config = this._languageConfigurationService.getLanguageConfiguration(langId).comments;
    if (!config) {
      return void 0;
    }
    if (name === "LINE_COMMENT") {
      return config.lineCommentToken || void 0;
    } else if (name === "BLOCK_COMMENT_START") {
      return config.blockCommentStartToken || void 0;
    } else if (name === "BLOCK_COMMENT_END") {
      return config.blockCommentEndToken || void 0;
    }
    return void 0;
  }
};
CommentBasedVariableResolver = __decorateClass([
  __decorateParam(2, ILanguageConfigurationService)
], CommentBasedVariableResolver);
const _TimeBasedVariableResolver = class _TimeBasedVariableResolver {
  constructor() {
    this._date = /* @__PURE__ */ new Date();
  }
  resolve(variable) {
    const { name } = variable;
    if (name === "CURRENT_YEAR") {
      return String(this._date.getFullYear());
    } else if (name === "CURRENT_YEAR_SHORT") {
      return String(this._date.getFullYear()).slice(-2);
    } else if (name === "CURRENT_MONTH") {
      return String(this._date.getMonth().valueOf() + 1).padStart(2, "0");
    } else if (name === "CURRENT_DATE") {
      return String(this._date.getDate().valueOf()).padStart(2, "0");
    } else if (name === "CURRENT_HOUR") {
      return String(this._date.getHours().valueOf()).padStart(2, "0");
    } else if (name === "CURRENT_MINUTE") {
      return String(this._date.getMinutes().valueOf()).padStart(2, "0");
    } else if (name === "CURRENT_SECOND") {
      return String(this._date.getSeconds().valueOf()).padStart(2, "0");
    } else if (name === "CURRENT_DAY_NAME") {
      return _TimeBasedVariableResolver.dayNames[this._date.getDay()];
    } else if (name === "CURRENT_DAY_NAME_SHORT") {
      return _TimeBasedVariableResolver.dayNamesShort[this._date.getDay()];
    } else if (name === "CURRENT_MONTH_NAME") {
      return _TimeBasedVariableResolver.monthNames[this._date.getMonth()];
    } else if (name === "CURRENT_MONTH_NAME_SHORT") {
      return _TimeBasedVariableResolver.monthNamesShort[this._date.getMonth()];
    } else if (name === "CURRENT_SECONDS_UNIX") {
      return String(Math.floor(this._date.getTime() / 1e3));
    } else if (name === "CURRENT_TIMEZONE_OFFSET") {
      const rawTimeOffset = this._date.getTimezoneOffset();
      const sign = rawTimeOffset > 0 ? "-" : "+";
      const hours = Math.trunc(Math.abs(rawTimeOffset / 60));
      const hoursString = hours < 10 ? "0" + hours : hours;
      const minutes = Math.abs(rawTimeOffset) - hours * 60;
      const minutesString = minutes < 10 ? "0" + minutes : minutes;
      return sign + hoursString + ":" + minutesString;
    }
    return void 0;
  }
};
_TimeBasedVariableResolver.dayNames = [nls.localize("Sunday", "Sunday"), nls.localize("Monday", "Monday"), nls.localize("Tuesday", "Tuesday"), nls.localize("Wednesday", "Wednesday"), nls.localize("Thursday", "Thursday"), nls.localize("Friday", "Friday"), nls.localize("Saturday", "Saturday")];
_TimeBasedVariableResolver.dayNamesShort = [nls.localize("SundayShort", "Sun"), nls.localize("MondayShort", "Mon"), nls.localize("TuesdayShort", "Tue"), nls.localize("WednesdayShort", "Wed"), nls.localize("ThursdayShort", "Thu"), nls.localize("FridayShort", "Fri"), nls.localize("SaturdayShort", "Sat")];
_TimeBasedVariableResolver.monthNames = [nls.localize("January", "January"), nls.localize("February", "February"), nls.localize("March", "March"), nls.localize("April", "April"), nls.localize("May", "May"), nls.localize("June", "June"), nls.localize("July", "July"), nls.localize("August", "August"), nls.localize("September", "September"), nls.localize("October", "October"), nls.localize("November", "November"), nls.localize("December", "December")];
_TimeBasedVariableResolver.monthNamesShort = [nls.localize("JanuaryShort", "Jan"), nls.localize("FebruaryShort", "Feb"), nls.localize("MarchShort", "Mar"), nls.localize("AprilShort", "Apr"), nls.localize("MayShort", "May"), nls.localize("JuneShort", "Jun"), nls.localize("JulyShort", "Jul"), nls.localize("AugustShort", "Aug"), nls.localize("SeptemberShort", "Sep"), nls.localize("OctoberShort", "Oct"), nls.localize("NovemberShort", "Nov"), nls.localize("DecemberShort", "Dec")];
let TimeBasedVariableResolver = _TimeBasedVariableResolver;
class WorkspaceBasedVariableResolver {
  constructor(_workspaceService) {
    this._workspaceService = _workspaceService;
  }
  resolve(variable) {
    if (!this._workspaceService) {
      return void 0;
    }
    const workspaceIdentifier = toWorkspaceIdentifier(this._workspaceService.getWorkspace());
    if (isEmptyWorkspaceIdentifier(workspaceIdentifier)) {
      return void 0;
    }
    if (variable.name === "WORKSPACE_NAME") {
      return this._resolveWorkspaceName(workspaceIdentifier);
    } else if (variable.name === "WORKSPACE_FOLDER") {
      return this._resoveWorkspacePath(workspaceIdentifier);
    }
    return void 0;
  }
  _resolveWorkspaceName(workspaceIdentifier) {
    if (isSingleFolderWorkspaceIdentifier(workspaceIdentifier)) {
      return path.basename(workspaceIdentifier.uri.path);
    }
    let filename = path.basename(workspaceIdentifier.configPath.path);
    if (filename.endsWith(WORKSPACE_EXTENSION)) {
      filename = filename.substr(0, filename.length - WORKSPACE_EXTENSION.length - 1);
    }
    return filename;
  }
  _resoveWorkspacePath(workspaceIdentifier) {
    if (isSingleFolderWorkspaceIdentifier(workspaceIdentifier)) {
      return normalizeDriveLetter(workspaceIdentifier.uri.fsPath);
    }
    const filename = path.basename(workspaceIdentifier.configPath.path);
    let folderpath = workspaceIdentifier.configPath.fsPath;
    if (folderpath.endsWith(filename)) {
      folderpath = folderpath.substr(0, folderpath.length - filename.length - 1);
    }
    return folderpath ? normalizeDriveLetter(folderpath) : "/";
  }
}
class RandomBasedVariableResolver {
  resolve(variable) {
    const { name } = variable;
    if (name === "RANDOM") {
      return Math.random().toString().slice(-6);
    } else if (name === "RANDOM_HEX") {
      return Math.random().toString(16).slice(-6);
    } else if (name === "UUID") {
      return generateUuid();
    }
    return void 0;
  }
}
export {
  ClipboardBasedVariableResolver,
  CommentBasedVariableResolver,
  CompositeSnippetVariableResolver,
  KnownSnippetVariableNames,
  ModelBasedVariableResolver,
  RandomBasedVariableResolver,
  SelectionBasedVariableResolver,
  TimeBasedVariableResolver,
  WorkspaceBasedVariableResolver
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zbmlwcGV0L2Jyb3dzZXIvc25pcHBldFZhcmlhYmxlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IG5vcm1hbGl6ZURyaXZlTGV0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGFiZWxzLmpzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBkaXJuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGNvbW1vblByZWZpeExlbmd0aCwgZ2V0TGVhZGluZ1doaXRlc3BhY2UsIGlzRmFsc3lPcldoaXRlc3BhY2UsIHNwbGl0TGluZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFRleHQsIFZhcmlhYmxlLCBWYXJpYWJsZVJlc29sdmVyIH0gZnJvbSAnLi9zbmlwcGV0UGFyc2VyLmpzJztcbmltcG9ydCB7IE92ZXJ0eXBpbmdDYXB0dXJlciB9IGZyb20gJy4uLy4uL3N1Z2dlc3QvYnJvd3Nlci9zdWdnZXN0T3ZlcnR5cGluZ0NhcHR1cmVyLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBXT1JLU1BBQ0VfRVhURU5TSU9OLCBpc1NpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIsIHRvV29ya3NwYWNlSWRlbnRpZmllciwgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBJU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllciwgSVdvcmtzcGFjZUlkZW50aWZpZXIsIGlzRW1wdHlXb3Jrc3BhY2VJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuXG5leHBvcnQgY29uc3QgS25vd25TbmlwcGV0VmFyaWFibGVOYW1lcyA9IE9iamVjdC5mcmVlemU8eyBba2V5OiBzdHJpbmddOiB0cnVlIH0+KHtcblx0J0NVUlJFTlRfWUVBUic6IHRydWUsXG5cdCdDVVJSRU5UX1lFQVJfU0hPUlQnOiB0cnVlLFxuXHQnQ1VSUkVOVF9NT05USCc6IHRydWUsXG5cdCdDVVJSRU5UX0RBVEUnOiB0cnVlLFxuXHQnQ1VSUkVOVF9IT1VSJzogdHJ1ZSxcblx0J0NVUlJFTlRfTUlOVVRFJzogdHJ1ZSxcblx0J0NVUlJFTlRfU0VDT05EJzogdHJ1ZSxcblx0J0NVUlJFTlRfREFZX05BTUUnOiB0cnVlLFxuXHQnQ1VSUkVOVF9EQVlfTkFNRV9TSE9SVCc6IHRydWUsXG5cdCdDVVJSRU5UX01PTlRIX05BTUUnOiB0cnVlLFxuXHQnQ1VSUkVOVF9NT05USF9OQU1FX1NIT1JUJzogdHJ1ZSxcblx0J0NVUlJFTlRfU0VDT05EU19VTklYJzogdHJ1ZSxcblx0J0NVUlJFTlRfVElNRVpPTkVfT0ZGU0VUJzogdHJ1ZSxcblx0J1NFTEVDVElPTic6IHRydWUsXG5cdCdDTElQQk9BUkQnOiB0cnVlLFxuXHQnVE1fU0VMRUNURURfVEVYVCc6IHRydWUsXG5cdCdUTV9DVVJSRU5UX0xJTkUnOiB0cnVlLFxuXHQnVE1fQ1VSUkVOVF9XT1JEJzogdHJ1ZSxcblx0J1RNX0xJTkVfSU5ERVgnOiB0cnVlLFxuXHQnVE1fTElORV9OVU1CRVInOiB0cnVlLFxuXHQnVE1fRklMRU5BTUUnOiB0cnVlLFxuXHQnVE1fRklMRU5BTUVfQkFTRSc6IHRydWUsXG5cdCdUTV9ESVJFQ1RPUlknOiB0cnVlLFxuXHQnVE1fRklMRVBBVEgnOiB0cnVlLFxuXHQnQ1VSU09SX0lOREVYJzogdHJ1ZSwgLy8gMC1vZmZzZXRcblx0J0NVUlNPUl9OVU1CRVInOiB0cnVlLCAvLyAxLW9mZnNldFxuXHQnUkVMQVRJVkVfRklMRVBBVEgnOiB0cnVlLFxuXHQnQkxPQ0tfQ09NTUVOVF9TVEFSVCc6IHRydWUsXG5cdCdCTE9DS19DT01NRU5UX0VORCc6IHRydWUsXG5cdCdMSU5FX0NPTU1FTlQnOiB0cnVlLFxuXHQnV09SS1NQQUNFX05BTUUnOiB0cnVlLFxuXHQnV09SS1NQQUNFX0ZPTERFUic6IHRydWUsXG5cdCdSQU5ET00nOiB0cnVlLFxuXHQnUkFORE9NX0hFWCc6IHRydWUsXG5cdCdVVUlEJzogdHJ1ZVxufSk7XG5cbmV4cG9ydCBjbGFzcyBDb21wb3NpdGVTbmlwcGV0VmFyaWFibGVSZXNvbHZlciBpbXBsZW1lbnRzIFZhcmlhYmxlUmVzb2x2ZXIge1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgX2RlbGVnYXRlczogVmFyaWFibGVSZXNvbHZlcltdKSB7XG5cdFx0Ly9cblx0fVxuXG5cdHJlc29sdmUodmFyaWFibGU6IFZhcmlhYmxlKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRmb3IgKGNvbnN0IGRlbGVnYXRlIG9mIHRoaXMuX2RlbGVnYXRlcykge1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBkZWxlZ2F0ZS5yZXNvbHZlKHZhcmlhYmxlKTtcblx0XHRcdGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2VsZWN0aW9uQmFzZWRWYXJpYWJsZVJlc29sdmVyIGltcGxlbWVudHMgVmFyaWFibGVSZXNvbHZlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWw6IElUZXh0TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc2VsZWN0aW9uOiBTZWxlY3Rpb24sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc2VsZWN0aW9uSWR4OiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb3ZlcnR5cGluZ0NhcHR1cmVyOiBPdmVydHlwaW5nQ2FwdHVyZXIgfCB1bmRlZmluZWRcblx0KSB7XG5cdFx0Ly9cblx0fVxuXG5cdHJlc29sdmUodmFyaWFibGU6IFZhcmlhYmxlKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblxuXHRcdGNvbnN0IHsgbmFtZSB9ID0gdmFyaWFibGU7XG5cblx0XHRpZiAobmFtZSA9PT0gJ1NFTEVDVElPTicgfHwgbmFtZSA9PT0gJ1RNX1NFTEVDVEVEX1RFWFQnKSB7XG5cdFx0XHRsZXQgdmFsdWUgPSB0aGlzLl9tb2RlbC5nZXRWYWx1ZUluUmFuZ2UodGhpcy5fc2VsZWN0aW9uKSB8fCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgaXNNdWx0aWxpbmUgPSB0aGlzLl9zZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyICE9PSB0aGlzLl9zZWxlY3Rpb24uZW5kTGluZU51bWJlcjtcblxuXHRcdFx0Ly8gSWYgdGhlcmUgd2FzIG5vIHNlbGVjdGVkIHRleHQsIHRyeSB0byBnZXQgbGFzdCBvdmVydHlwZWQgdGV4dFxuXHRcdFx0aWYgKCF2YWx1ZSAmJiB0aGlzLl9vdmVydHlwaW5nQ2FwdHVyZXIpIHtcblx0XHRcdFx0Y29uc3QgaW5mbyA9IHRoaXMuX292ZXJ0eXBpbmdDYXB0dXJlci5nZXRMYXN0T3ZlcnR5cGVkSW5mbyh0aGlzLl9zZWxlY3Rpb25JZHgpO1xuXHRcdFx0XHRpZiAoaW5mbykge1xuXHRcdFx0XHRcdHZhbHVlID0gaW5mby52YWx1ZTtcblx0XHRcdFx0XHRpc011bHRpbGluZSA9IGluZm8ubXVsdGlsaW5lO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICh2YWx1ZSAmJiBpc011bHRpbGluZSAmJiB2YXJpYWJsZS5zbmlwcGV0KSB7XG5cdFx0XHRcdC8vIFNlbGVjdGlvbiBpcyBhIG11bHRpbGluZSBzdHJpbmcgd2hpY2ggd2UgaW5kZW50YXRpb24gd2Ugbm93XG5cdFx0XHRcdC8vIG5lZWQgdG8gYWRqdXN0LiBXZSBjb21wYXJlIHRoZSBpbmRlbnRhdGlvbiBvZiB0aGlzIHZhcmlhYmxlXG5cdFx0XHRcdC8vIHdpdGggdGhlIGluZGVudGF0aW9uIGF0IHRoZSBlZGl0b3IgcG9zaXRpb24gYW5kIGFkZCBwb3RlbnRpYWxcblx0XHRcdFx0Ly8gZXh0cmEgaW5kZW50YXRpb24gdG8gdGhlIHZhbHVlXG5cblx0XHRcdFx0Y29uc3QgbGluZSA9IHRoaXMuX21vZGVsLmdldExpbmVDb250ZW50KHRoaXMuX3NlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0XHRjb25zdCBsaW5lTGVhZGluZ1doaXRlc3BhY2UgPSBnZXRMZWFkaW5nV2hpdGVzcGFjZShsaW5lLCAwLCB0aGlzLl9zZWxlY3Rpb24uc3RhcnRDb2x1bW4gLSAxKTtcblxuXHRcdFx0XHRsZXQgdmFyTGVhZGluZ1doaXRlc3BhY2UgPSBsaW5lTGVhZGluZ1doaXRlc3BhY2U7XG5cdFx0XHRcdHZhcmlhYmxlLnNuaXBwZXQud2FsayhtYXJrZXIgPT4ge1xuXHRcdFx0XHRcdGlmIChtYXJrZXIgPT09IHZhcmlhYmxlKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChtYXJrZXIgaW5zdGFuY2VvZiBUZXh0KSB7XG5cdFx0XHRcdFx0XHR2YXJMZWFkaW5nV2hpdGVzcGFjZSA9IGdldExlYWRpbmdXaGl0ZXNwYWNlKHNwbGl0TGluZXMobWFya2VyLnZhbHVlKS5wb3AoKSEpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGNvbnN0IHdoaXRlc3BhY2VDb21tb25MZW5ndGggPSBjb21tb25QcmVmaXhMZW5ndGgodmFyTGVhZGluZ1doaXRlc3BhY2UsIGxpbmVMZWFkaW5nV2hpdGVzcGFjZSk7XG5cblx0XHRcdFx0dmFsdWUgPSB2YWx1ZS5yZXBsYWNlKFxuXHRcdFx0XHRcdC8oXFxyXFxufFxccnxcXG4pKC4qKS9nLFxuXHRcdFx0XHRcdChtLCBuZXdsaW5lLCByZXN0KSA9PiBgJHtuZXdsaW5lfSR7dmFyTGVhZGluZ1doaXRlc3BhY2Uuc3Vic3RyKHdoaXRlc3BhY2VDb21tb25MZW5ndGgpfSR7cmVzdH1gXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cblx0XHR9IGVsc2UgaWYgKG5hbWUgPT09ICdUTV9DVVJSRU5UX0xJTkUnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbW9kZWwuZ2V0TGluZUNvbnRlbnQodGhpcy5fc2VsZWN0aW9uLnBvc2l0aW9uTGluZU51bWJlcik7XG5cblx0XHR9IGVsc2UgaWYgKG5hbWUgPT09ICdUTV9DVVJSRU5UX1dPUkQnKSB7XG5cdFx0XHRjb25zdCBpbmZvID0gdGhpcy5fbW9kZWwuZ2V0V29yZEF0UG9zaXRpb24oe1xuXHRcdFx0XHRsaW5lTnVtYmVyOiB0aGlzLl9zZWxlY3Rpb24ucG9zaXRpb25MaW5lTnVtYmVyLFxuXHRcdFx0XHRjb2x1bW46IHRoaXMuX3NlbGVjdGlvbi5wb3NpdGlvbkNvbHVtblxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gaW5mbyAmJiBpbmZvLndvcmQgfHwgdW5kZWZpbmVkO1xuXG5cdFx0fSBlbHNlIGlmIChuYW1lID09PSAnVE1fTElORV9JTkRFWCcpIHtcblx0XHRcdHJldHVybiBTdHJpbmcodGhpcy5fc2VsZWN0aW9uLnBvc2l0aW9uTGluZU51bWJlciAtIDEpO1xuXG5cdFx0fSBlbHNlIGlmIChuYW1lID09PSAnVE1fTElORV9OVU1CRVInKSB7XG5cdFx0XHRyZXR1cm4gU3RyaW5nKHRoaXMuX3NlbGVjdGlvbi5wb3NpdGlvbkxpbmVOdW1iZXIpO1xuXG5cdFx0fSBlbHNlIGlmIChuYW1lID09PSAnQ1VSU09SX0lOREVYJykge1xuXHRcdFx0cmV0dXJuIFN0cmluZyh0aGlzLl9zZWxlY3Rpb25JZHgpO1xuXG5cdFx0fSBlbHNlIGlmIChuYW1lID09PSAnQ1VSU09SX05VTUJFUicpIHtcblx0XHRcdHJldHVybiBTdHJpbmcodGhpcy5fc2VsZWN0aW9uSWR4ICsgMSk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vZGVsQmFzZWRWYXJpYWJsZVJlc29sdmVyIGltcGxlbWVudHMgVmFyaWFibGVSZXNvbHZlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX21vZGVsOiBJVGV4dE1vZGVsXG5cdCkge1xuXHRcdC8vXG5cdH1cblxuXHRyZXNvbHZlKHZhcmlhYmxlOiBWYXJpYWJsZSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cblx0XHRjb25zdCB7IG5hbWUgfSA9IHZhcmlhYmxlO1xuXG5cdFx0aWYgKG5hbWUgPT09ICdUTV9GSUxFTkFNRScpIHtcblx0XHRcdHJldHVybiBwYXRoLmJhc2VuYW1lKHRoaXMuX21vZGVsLnVyaS5mc1BhdGgpO1xuXG5cdFx0fSBlbHNlIGlmIChuYW1lID09PSAnVE1fRklMRU5BTUVfQkFTRScpIHtcblx0XHRcdGNvbnN0IG5hbWUgPSBwYXRoLmJhc2VuYW1lKHRoaXMuX21vZGVsLnVyaS5mc1BhdGgpO1xuXHRcdFx0Y29uc3QgaWR4ID0gbmFtZS5sYXN0SW5kZXhPZignLicpO1xuXHRcdFx0aWYgKGlkeCA8PSAwKSB7XG5cdFx0XHRcdHJldHVybiBuYW1lO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIG5hbWUuc2xpY2UoMCwgaWR4KTtcblx0XHRcdH1cblxuXHRcdH0gZWxzZSBpZiAobmFtZSA9PT0gJ1RNX0RJUkVDVE9SWScpIHtcblx0XHRcdGlmIChwYXRoLmRpcm5hbWUodGhpcy5fbW9kZWwudXJpLmZzUGF0aCkgPT09ICcuJykge1xuXHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcy5fbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGRpcm5hbWUodGhpcy5fbW9kZWwudXJpKSk7XG5cblx0XHR9IGVsc2UgaWYgKG5hbWUgPT09ICdUTV9GSUxFUEFUSCcpIHtcblx0XHRcdHJldHVybiB0aGlzLl9sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwodGhpcy5fbW9kZWwudXJpKTtcblx0XHR9IGVsc2UgaWYgKG5hbWUgPT09ICdSRUxBVElWRV9GSUxFUEFUSCcpIHtcblx0XHRcdHJldHVybiB0aGlzLl9sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwodGhpcy5fbW9kZWwudXJpLCB7IHJlbGF0aXZlOiB0cnVlLCBub1ByZWZpeDogdHJ1ZSB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlYWRDbGlwYm9hcmRUZXh0IHtcblx0KCk6IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGNsYXNzIENsaXBib2FyZEJhc2VkVmFyaWFibGVSZXNvbHZlciBpbXBsZW1lbnRzIFZhcmlhYmxlUmVzb2x2ZXIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3JlYWRDbGlwYm9hcmRUZXh0OiBJUmVhZENsaXBib2FyZFRleHQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc2VsZWN0aW9uSWR4OiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc2VsZWN0aW9uQ291bnQ6IG51bWJlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9zcHJlYWQ6IGJvb2xlYW5cblx0KSB7XG5cdFx0Ly9cblx0fVxuXG5cdHJlc29sdmUodmFyaWFibGU6IFZhcmlhYmxlKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodmFyaWFibGUubmFtZSAhPT0gJ0NMSVBCT0FSRCcpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2xpcGJvYXJkVGV4dCA9IHRoaXMuX3JlYWRDbGlwYm9hcmRUZXh0KCk7XG5cdFx0aWYgKCFjbGlwYm9hcmRUZXh0KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIGBzcHJlYWRgIGlzIGFzc2lnbmluZyBlYWNoIGN1cnNvciBhIGxpbmUgb2YgdGhlIGNsaXBib2FyZFxuXHRcdC8vIHRleHQgd2hlbmV2ZXIgdGhlcmUgdGhlIGxpbmUgY291bnQgZXF1YWxzIHRoZSBjdXJzb3IgY291bnRcblx0XHQvLyBhbmQgd2hlbiBlbmFibGVkXG5cdFx0aWYgKHRoaXMuX3NwcmVhZCkge1xuXHRcdFx0Y29uc3QgbGluZXMgPSBjbGlwYm9hcmRUZXh0LnNwbGl0KC9cXHJcXG58XFxufFxcci8pLmZpbHRlcihzID0+ICFpc0ZhbHN5T3JXaGl0ZXNwYWNlKHMpKTtcblx0XHRcdGlmIChsaW5lcy5sZW5ndGggPT09IHRoaXMuX3NlbGVjdGlvbkNvdW50KSB7XG5cdFx0XHRcdHJldHVybiBsaW5lc1t0aGlzLl9zZWxlY3Rpb25JZHhdO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gY2xpcGJvYXJkVGV4dDtcblx0fVxufVxuZXhwb3J0IGNsYXNzIENvbW1lbnRCYXNlZFZhcmlhYmxlUmVzb2x2ZXIgaW1wbGVtZW50cyBWYXJpYWJsZVJlc29sdmVyIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWw6IElUZXh0TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc2VsZWN0aW9uOiBTZWxlY3Rpb24sXG5cdFx0QElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdC8vXG5cdH1cblx0cmVzb2x2ZSh2YXJpYWJsZTogVmFyaWFibGUpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHsgbmFtZSB9ID0gdmFyaWFibGU7XG5cdFx0Y29uc3QgbGFuZ0lkID0gdGhpcy5fbW9kZWwuZ2V0TGFuZ3VhZ2VJZEF0UG9zaXRpb24odGhpcy5fc2VsZWN0aW9uLnNlbGVjdGlvblN0YXJ0TGluZU51bWJlciwgdGhpcy5fc2VsZWN0aW9uLnNlbGVjdGlvblN0YXJ0Q29sdW1uKTtcblx0XHRjb25zdCBjb25maWcgPSB0aGlzLl9sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldExhbmd1YWdlQ29uZmlndXJhdGlvbihsYW5nSWQpLmNvbW1lbnRzO1xuXHRcdGlmICghY29uZmlnKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAobmFtZSA9PT0gJ0xJTkVfQ09NTUVOVCcpIHtcblx0XHRcdHJldHVybiBjb25maWcubGluZUNvbW1lbnRUb2tlbiB8fCB1bmRlZmluZWQ7XG5cdFx0fSBlbHNlIGlmIChuYW1lID09PSAnQkxPQ0tfQ09NTUVOVF9TVEFSVCcpIHtcblx0XHRcdHJldHVybiBjb25maWcuYmxvY2tDb21tZW50U3RhcnRUb2tlbiB8fCB1bmRlZmluZWQ7XG5cdFx0fSBlbHNlIGlmIChuYW1lID09PSAnQkxPQ0tfQ09NTUVOVF9FTkQnKSB7XG5cdFx0XHRyZXR1cm4gY29uZmlnLmJsb2NrQ29tbWVudEVuZFRva2VuIHx8IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuZXhwb3J0IGNsYXNzIFRpbWVCYXNlZFZhcmlhYmxlUmVzb2x2ZXIgaW1wbGVtZW50cyBWYXJpYWJsZVJlc29sdmVyIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBkYXlOYW1lcyA9IFtubHMubG9jYWxpemUoJ1N1bmRheScsIFwiU3VuZGF5XCIpLCBubHMubG9jYWxpemUoJ01vbmRheScsIFwiTW9uZGF5XCIpLCBubHMubG9jYWxpemUoJ1R1ZXNkYXknLCBcIlR1ZXNkYXlcIiksIG5scy5sb2NhbGl6ZSgnV2VkbmVzZGF5JywgXCJXZWRuZXNkYXlcIiksIG5scy5sb2NhbGl6ZSgnVGh1cnNkYXknLCBcIlRodXJzZGF5XCIpLCBubHMubG9jYWxpemUoJ0ZyaWRheScsIFwiRnJpZGF5XCIpLCBubHMubG9jYWxpemUoJ1NhdHVyZGF5JywgXCJTYXR1cmRheVwiKV07XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IGRheU5hbWVzU2hvcnQgPSBbbmxzLmxvY2FsaXplKCdTdW5kYXlTaG9ydCcsIFwiU3VuXCIpLCBubHMubG9jYWxpemUoJ01vbmRheVNob3J0JywgXCJNb25cIiksIG5scy5sb2NhbGl6ZSgnVHVlc2RheVNob3J0JywgXCJUdWVcIiksIG5scy5sb2NhbGl6ZSgnV2VkbmVzZGF5U2hvcnQnLCBcIldlZFwiKSwgbmxzLmxvY2FsaXplKCdUaHVyc2RheVNob3J0JywgXCJUaHVcIiksIG5scy5sb2NhbGl6ZSgnRnJpZGF5U2hvcnQnLCBcIkZyaVwiKSwgbmxzLmxvY2FsaXplKCdTYXR1cmRheVNob3J0JywgXCJTYXRcIildO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBtb250aE5hbWVzID0gW25scy5sb2NhbGl6ZSgnSmFudWFyeScsIFwiSmFudWFyeVwiKSwgbmxzLmxvY2FsaXplKCdGZWJydWFyeScsIFwiRmVicnVhcnlcIiksIG5scy5sb2NhbGl6ZSgnTWFyY2gnLCBcIk1hcmNoXCIpLCBubHMubG9jYWxpemUoJ0FwcmlsJywgXCJBcHJpbFwiKSwgbmxzLmxvY2FsaXplKCdNYXknLCBcIk1heVwiKSwgbmxzLmxvY2FsaXplKCdKdW5lJywgXCJKdW5lXCIpLCBubHMubG9jYWxpemUoJ0p1bHknLCBcIkp1bHlcIiksIG5scy5sb2NhbGl6ZSgnQXVndXN0JywgXCJBdWd1c3RcIiksIG5scy5sb2NhbGl6ZSgnU2VwdGVtYmVyJywgXCJTZXB0ZW1iZXJcIiksIG5scy5sb2NhbGl6ZSgnT2N0b2JlcicsIFwiT2N0b2JlclwiKSwgbmxzLmxvY2FsaXplKCdOb3ZlbWJlcicsIFwiTm92ZW1iZXJcIiksIG5scy5sb2NhbGl6ZSgnRGVjZW1iZXInLCBcIkRlY2VtYmVyXCIpXTtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgbW9udGhOYW1lc1Nob3J0ID0gW25scy5sb2NhbGl6ZSgnSmFudWFyeVNob3J0JywgXCJKYW5cIiksIG5scy5sb2NhbGl6ZSgnRmVicnVhcnlTaG9ydCcsIFwiRmViXCIpLCBubHMubG9jYWxpemUoJ01hcmNoU2hvcnQnLCBcIk1hclwiKSwgbmxzLmxvY2FsaXplKCdBcHJpbFNob3J0JywgXCJBcHJcIiksIG5scy5sb2NhbGl6ZSgnTWF5U2hvcnQnLCBcIk1heVwiKSwgbmxzLmxvY2FsaXplKCdKdW5lU2hvcnQnLCBcIkp1blwiKSwgbmxzLmxvY2FsaXplKCdKdWx5U2hvcnQnLCBcIkp1bFwiKSwgbmxzLmxvY2FsaXplKCdBdWd1c3RTaG9ydCcsIFwiQXVnXCIpLCBubHMubG9jYWxpemUoJ1NlcHRlbWJlclNob3J0JywgXCJTZXBcIiksIG5scy5sb2NhbGl6ZSgnT2N0b2JlclNob3J0JywgXCJPY3RcIiksIG5scy5sb2NhbGl6ZSgnTm92ZW1iZXJTaG9ydCcsIFwiTm92XCIpLCBubHMubG9jYWxpemUoJ0RlY2VtYmVyU2hvcnQnLCBcIkRlY1wiKV07XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGF0ZSA9IG5ldyBEYXRlKCk7XG5cblx0cmVzb2x2ZSh2YXJpYWJsZTogVmFyaWFibGUpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHsgbmFtZSB9ID0gdmFyaWFibGU7XG5cblx0XHRpZiAobmFtZSA9PT0gJ0NVUlJFTlRfWUVBUicpIHtcblx0XHRcdHJldHVybiBTdHJpbmcodGhpcy5fZGF0ZS5nZXRGdWxsWWVhcigpKTtcblx0XHR9IGVsc2UgaWYgKG5hbWUgPT09ICdDVVJSRU5UX1lFQVJfU0hPUlQnKSB7XG5cdFx0XHRyZXR1cm4gU3RyaW5nKHRoaXMuX2RhdGUuZ2V0RnVsbFllYXIoKSkuc2xpY2UoLTIpO1xuXHRcdH0gZWxzZSBpZiAobmFtZSA9PT0gJ0NVUlJFTlRfTU9OVEgnKSB7XG5cdFx0XHRyZXR1cm4gU3RyaW5nKHRoaXMuX2RhdGUuZ2V0TW9udGgoKS52YWx1ZU9mKCkgKyAxKS5wYWRTdGFydCgyLCAnMCcpO1xuXHRcdH0gZWxzZSBpZiAobmFtZSA9PT0gJ0NVUlJFTlRfREFURScpIHtcblx0XHRcdHJldHVybiBTdHJpbmcodGhpcy5fZGF0ZS5nZXREYXRlKCkudmFsdWVPZigpKS5wYWRTdGFydCgyLCAnMCcpO1xuXHRcdH0gZWxzZSBpZiAobmFtZSA9PT0gJ0NVUlJFTlRfSE9VUicpIHtcblx0XHRcdHJldHVybiBTdHJpbmcodGhpcy5fZGF0ZS5nZXRIb3VycygpLnZhbHVlT2YoKSkucGFkU3RhcnQoMiwgJzAnKTtcblx0XHR9IGVsc2UgaWYgKG5hbWUgPT09ICdDVVJSRU5UX01JTlVURScpIHtcblx0XHRcdHJldHVybiBTdHJpbmcodGhpcy5fZGF0ZS5nZXRNaW51dGVzKCkudmFsdWVPZigpKS5wYWRTdGFydCgyLCAnMCcpO1xuXHRcdH0gZWxzZSBpZiAobmFtZSA9PT0gJ0NVUlJFTlRfU0VDT05EJykge1xuXHRcdFx0cmV0dXJuIFN0cmluZyh0aGlzLl9kYXRlLmdldFNlY29uZHMoKS52YWx1ZU9mKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG5cdFx0fSBlbHNlIGlmIChuYW1lID09PSAnQ1VSUkVOVF9EQVlfTkFNRScpIHtcblx0XHRcdHJldHVybiBUaW1lQmFzZWRWYXJpYWJsZVJlc29sdmVyLmRheU5hbWVzW3RoaXMuX2RhdGUuZ2V0RGF5KCldO1xuXHRcdH0gZWxzZSBpZiAobmFtZSA9PT0gJ0NVUlJFTlRfREFZX05BTUVfU0hPUlQnKSB7XG5cdFx0XHRyZXR1cm4gVGltZUJhc2VkVmFyaWFibGVSZXNvbHZlci5kYXlOYW1lc1Nob3J0W3RoaXMuX2RhdGUuZ2V0RGF5KCldO1xuXHRcdH0gZWxzZSBpZiAobmFtZSA9PT0gJ0NVUlJFTlRfTU9OVEhfTkFNRScpIHtcblx0XHRcdHJldHVybiBUaW1lQmFzZWRWYXJpYWJsZVJlc29sdmVyLm1vbnRoTmFtZXNbdGhpcy5fZGF0ZS5nZXRNb250aCgpXTtcblx0XHR9IGVsc2UgaWYgKG5hbWUgPT09ICdDVVJSRU5UX01PTlRIX05BTUVfU0hPUlQnKSB7XG5cdFx0XHRyZXR1cm4gVGltZUJhc2VkVmFyaWFibGVSZXNvbHZlci5tb250aE5hbWVzU2hvcnRbdGhpcy5fZGF0ZS5nZXRNb250aCgpXTtcblx0XHR9IGVsc2UgaWYgKG5hbWUgPT09ICdDVVJSRU5UX1NFQ09ORFNfVU5JWCcpIHtcblx0XHRcdHJldHVybiBTdHJpbmcoTWF0aC5mbG9vcih0aGlzLl9kYXRlLmdldFRpbWUoKSAvIDEwMDApKTtcblx0XHR9IGVsc2UgaWYgKG5hbWUgPT09ICdDVVJSRU5UX1RJTUVaT05FX09GRlNFVCcpIHtcblx0XHRcdGNvbnN0IHJhd1RpbWVPZmZzZXQgPSB0aGlzLl9kYXRlLmdldFRpbWV6b25lT2Zmc2V0KCk7XG5cdFx0XHRjb25zdCBzaWduID0gcmF3VGltZU9mZnNldCA+IDAgPyAnLScgOiAnKyc7XG5cdFx0XHRjb25zdCBob3VycyA9IE1hdGgudHJ1bmMoTWF0aC5hYnMocmF3VGltZU9mZnNldCAvIDYwKSk7XG5cdFx0XHRjb25zdCBob3Vyc1N0cmluZyA9IChob3VycyA8IDEwID8gJzAnICsgaG91cnMgOiBob3Vycyk7XG5cdFx0XHRjb25zdCBtaW51dGVzID0gTWF0aC5hYnMocmF3VGltZU9mZnNldCkgLSBob3VycyAqIDYwO1xuXHRcdFx0Y29uc3QgbWludXRlc1N0cmluZyA9IChtaW51dGVzIDwgMTAgPyAnMCcgKyBtaW51dGVzIDogbWludXRlcyk7XG5cdFx0XHRyZXR1cm4gc2lnbiArIGhvdXJzU3RyaW5nICsgJzonICsgbWludXRlc1N0cmluZztcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBXb3Jrc3BhY2VCYXNlZFZhcmlhYmxlUmVzb2x2ZXIgaW1wbGVtZW50cyBWYXJpYWJsZVJlc29sdmVyIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfd29ya3NwYWNlU2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHwgdW5kZWZpbmVkLFxuXHQpIHtcblx0XHQvL1xuXHR9XG5cblx0cmVzb2x2ZSh2YXJpYWJsZTogVmFyaWFibGUpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGhpcy5fd29ya3NwYWNlU2VydmljZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCB3b3Jrc3BhY2VJZGVudGlmaWVyID0gdG9Xb3Jrc3BhY2VJZGVudGlmaWVyKHRoaXMuX3dvcmtzcGFjZVNlcnZpY2UuZ2V0V29ya3NwYWNlKCkpO1xuXHRcdGlmIChpc0VtcHR5V29ya3NwYWNlSWRlbnRpZmllcih3b3Jrc3BhY2VJZGVudGlmaWVyKSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAodmFyaWFibGUubmFtZSA9PT0gJ1dPUktTUEFDRV9OQU1FJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3Jlc29sdmVXb3Jrc3BhY2VOYW1lKHdvcmtzcGFjZUlkZW50aWZpZXIpO1xuXHRcdH0gZWxzZSBpZiAodmFyaWFibGUubmFtZSA9PT0gJ1dPUktTUEFDRV9GT0xERVInKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcmVzb3ZlV29ya3NwYWNlUGF0aCh3b3Jrc3BhY2VJZGVudGlmaWVyKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdHByaXZhdGUgX3Jlc29sdmVXb3Jrc3BhY2VOYW1lKHdvcmtzcGFjZUlkZW50aWZpZXI6IElXb3Jrc3BhY2VJZGVudGlmaWVyIHwgSVNpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmIChpc1NpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIod29ya3NwYWNlSWRlbnRpZmllcikpIHtcblx0XHRcdHJldHVybiBwYXRoLmJhc2VuYW1lKHdvcmtzcGFjZUlkZW50aWZpZXIudXJpLnBhdGgpO1xuXHRcdH1cblxuXHRcdGxldCBmaWxlbmFtZSA9IHBhdGguYmFzZW5hbWUod29ya3NwYWNlSWRlbnRpZmllci5jb25maWdQYXRoLnBhdGgpO1xuXHRcdGlmIChmaWxlbmFtZS5lbmRzV2l0aChXT1JLU1BBQ0VfRVhURU5TSU9OKSkge1xuXHRcdFx0ZmlsZW5hbWUgPSBmaWxlbmFtZS5zdWJzdHIoMCwgZmlsZW5hbWUubGVuZ3RoIC0gV09SS1NQQUNFX0VYVEVOU0lPTi5sZW5ndGggLSAxKTtcblx0XHR9XG5cdFx0cmV0dXJuIGZpbGVuYW1lO1xuXHR9XG5cdHByaXZhdGUgX3Jlc292ZVdvcmtzcGFjZVBhdGgod29ya3NwYWNlSWRlbnRpZmllcjogSVdvcmtzcGFjZUlkZW50aWZpZXIgfCBJU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllcik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGlzU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllcih3b3Jrc3BhY2VJZGVudGlmaWVyKSkge1xuXHRcdFx0cmV0dXJuIG5vcm1hbGl6ZURyaXZlTGV0dGVyKHdvcmtzcGFjZUlkZW50aWZpZXIudXJpLmZzUGF0aCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlsZW5hbWUgPSBwYXRoLmJhc2VuYW1lKHdvcmtzcGFjZUlkZW50aWZpZXIuY29uZmlnUGF0aC5wYXRoKTtcblx0XHRsZXQgZm9sZGVycGF0aCA9IHdvcmtzcGFjZUlkZW50aWZpZXIuY29uZmlnUGF0aC5mc1BhdGg7XG5cdFx0aWYgKGZvbGRlcnBhdGguZW5kc1dpdGgoZmlsZW5hbWUpKSB7XG5cdFx0XHRmb2xkZXJwYXRoID0gZm9sZGVycGF0aC5zdWJzdHIoMCwgZm9sZGVycGF0aC5sZW5ndGggLSBmaWxlbmFtZS5sZW5ndGggLSAxKTtcblx0XHR9XG5cdFx0cmV0dXJuIChmb2xkZXJwYXRoID8gbm9ybWFsaXplRHJpdmVMZXR0ZXIoZm9sZGVycGF0aCkgOiAnLycpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSYW5kb21CYXNlZFZhcmlhYmxlUmVzb2x2ZXIgaW1wbGVtZW50cyBWYXJpYWJsZVJlc29sdmVyIHtcblx0cmVzb2x2ZSh2YXJpYWJsZTogVmFyaWFibGUpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHsgbmFtZSB9ID0gdmFyaWFibGU7XG5cblx0XHRpZiAobmFtZSA9PT0gJ1JBTkRPTScpIHtcblx0XHRcdHJldHVybiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCkuc2xpY2UoLTYpO1xuXHRcdH0gZWxzZSBpZiAobmFtZSA9PT0gJ1JBTkRPTV9IRVgnKSB7XG5cdFx0XHRyZXR1cm4gTWF0aC5yYW5kb20oKS50b1N0cmluZygxNikuc2xpY2UoLTYpO1xuXHRcdH0gZWxzZSBpZiAobmFtZSA9PT0gJ1VVSUQnKSB7XG5cdFx0XHRyZXR1cm4gZ2VuZXJhdGVVdWlkKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLDRCQUE0QjtBQUNyQyxZQUFZLFVBQVU7QUFDdEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsb0JBQW9CLHNCQUFzQixxQkFBcUIsa0JBQWtCO0FBQzFGLFNBQVMsb0JBQW9CO0FBRzdCLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsWUFBd0M7QUFFakQsWUFBWSxTQUFTO0FBRXJCLFNBQVMscUJBQXFCLG1DQUFtQyx1QkFBeUcsa0NBQWtDO0FBRXJNLE1BQU0sNEJBQTRCLE9BQU8sT0FBZ0M7QUFBQSxFQUMvRSxnQkFBZ0I7QUFBQSxFQUNoQixzQkFBc0I7QUFBQSxFQUN0QixpQkFBaUI7QUFBQSxFQUNqQixnQkFBZ0I7QUFBQSxFQUNoQixnQkFBZ0I7QUFBQSxFQUNoQixrQkFBa0I7QUFBQSxFQUNsQixrQkFBa0I7QUFBQSxFQUNsQixvQkFBb0I7QUFBQSxFQUNwQiwwQkFBMEI7QUFBQSxFQUMxQixzQkFBc0I7QUFBQSxFQUN0Qiw0QkFBNEI7QUFBQSxFQUM1Qix3QkFBd0I7QUFBQSxFQUN4QiwyQkFBMkI7QUFBQSxFQUMzQixhQUFhO0FBQUEsRUFDYixhQUFhO0FBQUEsRUFDYixvQkFBb0I7QUFBQSxFQUNwQixtQkFBbUI7QUFBQSxFQUNuQixtQkFBbUI7QUFBQSxFQUNuQixpQkFBaUI7QUFBQSxFQUNqQixrQkFBa0I7QUFBQSxFQUNsQixlQUFlO0FBQUEsRUFDZixvQkFBb0I7QUFBQSxFQUNwQixnQkFBZ0I7QUFBQSxFQUNoQixlQUFlO0FBQUEsRUFDZixnQkFBZ0I7QUFBQTtBQUFBLEVBQ2hCLGlCQUFpQjtBQUFBO0FBQUEsRUFDakIscUJBQXFCO0FBQUEsRUFDckIsdUJBQXVCO0FBQUEsRUFDdkIscUJBQXFCO0FBQUEsRUFDckIs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
