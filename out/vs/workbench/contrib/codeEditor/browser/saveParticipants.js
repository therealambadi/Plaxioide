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
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { HierarchicalKind } from "../../../../base/common/hierarchicalKind.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import * as strings from "../../../../base/common/strings.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { trimTrailingWhitespace } from "../../../../editor/common/commands/trimTrailingWhitespaceCommand.js";
import { EditOperation } from "../../../../editor/common/core/editOperation.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { CodeActionTriggerType } from "../../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { ApplyCodeActionReason, applyCodeAction, getCodeActions } from "../../../../editor/contrib/codeAction/browser/codeAction.js";
import { CodeActionKind, CodeActionTriggerSource } from "../../../../editor/contrib/codeAction/common/types.js";
import { FormattingMode, formatDocumentRangesWithSelectedProvider, formatDocumentWithSelectedProvider } from "../../../../editor/contrib/format/browser/format.js";
import { SnippetController2 } from "../../../../editor/contrib/snippet/browser/snippetController2.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Progress } from "../../../../platform/progress/common/progress.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchContributionsExtensions } from "../../../common/contributions.js";
import { SaveReason } from "../../../common/editor.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { getModifiedRanges } from "../../format/browser/formatModified.js";
let TrimWhitespaceParticipant = class {
  constructor(configurationService, codeEditorService) {
    this.configurationService = configurationService;
    this.codeEditorService = codeEditorService;
  }
  async participate(model, context) {
    if (!model.textEditorModel) {
      return;
    }
    const trimTrailingWhitespaceOption = this.configurationService.getValue("files.trimTrailingWhitespace", { overrideIdentifier: model.textEditorModel.getLanguageId(), resource: model.resource });
    const trimInRegexAndStrings = this.configurationService.getValue("files.trimTrailingWhitespaceInRegexAndStrings", { overrideIdentifier: model.textEditorModel.getLanguageId(), resource: model.resource });
    if (trimTrailingWhitespaceOption) {
      this.doTrimTrailingWhitespace(model.textEditorModel, context.reason === SaveReason.AUTO, trimInRegexAndStrings);
    }
  }
  doTrimTrailingWhitespace(model, isAutoSaved, trimInRegexesAndStrings) {
    let prevSelection = [];
    let cursors = [];
    const editor = findEditor(model, this.codeEditorService);
    if (editor) {
      prevSelection = editor.getSelections();
      if (isAutoSaved) {
        cursors = prevSelection.map((s) => s.getPosition());
        const snippetsRange = SnippetController2.get(editor)?.getSessionEnclosingRange();
        if (snippetsRange) {
          for (let lineNumber = snippetsRange.startLineNumber; lineNumber <= snippetsRange.endLineNumber; lineNumber++) {
            cursors.push(new Position(lineNumber, model.getLineMaxColumn(lineNumber)));
          }
        }
      }
    }
    const ops = trimTrailingWhitespace(model, cursors, trimInRegexesAndStrings);
    if (!ops.length) {
      return;
    }
    model.pushEditOperations(prevSelection, ops, (_edits) => prevSelection);
  }
};
TrimWhitespaceParticipant = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ICodeEditorService)
], TrimWhitespaceParticipant);
function findEditor(model, codeEditorService) {
  let candidate = null;
  if (model.isAttachedToEditor()) {
    for (const editor of codeEditorService.listCodeEditors()) {
      if (editor.hasModel() && editor.getModel() === model) {
        if (editor.hasTextFocus()) {
          return editor;
        }
        candidate = editor;
      }
    }
  }
  return candidate;
}
let FinalNewLineParticipant = class {
  constructor(configurationService, codeEditorService) {
    this.configurationService = configurationService;
    this.codeEditorService = codeEditorService;
  }
  async participate(model, context) {
    if (!model.textEditorModel) {
      return;
    }
    if (this.configurationService.getValue("files.insertFinalNewline", { overrideIdentifier: model.textEditorModel.getLanguageId(), resource: model.resource })) {
      this.doInsertFinalNewLine(model.textEditorModel);
    }
  }
  doInsertFinalNewLine(model) {
    const lineCount = model.getLineCount();
    const lastLine = model.getLineContent(lineCount);
    const lastLineIsEmptyOrWhitespace = strings.lastNonWhitespaceIndex(lastLine) === -1;
    if (!lineCount || lastLineIsEmptyOrWhitespace) {
      return;
    }
    const edits = [EditOperation.insert(new Position(lineCount, model.getLineMaxColumn(lineCount)), model.getEOL())];
    const editor = findEditor(model, this.codeEditorService);
    if (editor) {
      editor.executeEdits("insertFinalNewLine", edits, editor.getSelections());
    } else {
      model.pushEditOperations([], edits, () => null);
    }
  }
};
FinalNewLineParticipant = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ICodeEditorService)
], FinalNewLineParticipant);
let TrimFinalNewLinesParticipant = class {
  constructor(configurationService, codeEditorService) {
    this.configurationService = configurationService;
    this.codeEditorService = codeEditorService;
  }
  async participate(model, context) {
    if (!model.textEditorModel) {
      return;
    }
    if (this.configurationService.getValue("files.trimFinalNewlines", { overrideIdentifier: model.textEditorModel.getLanguageId(), resource: model.resource })) {
      this.doTrimFinalNewLines(model.textEditorModel, context.reason === SaveReason.AUTO);
    }
  }
  /**
   * returns 0 if the entire file is empty
   */
  findLastNonEmptyLine(model) {
    for (let lineNumber = model.getLineCount(); lineNumber >= 1; lineNumber--) {
      const lineLength = model.getLineLength(lineNumber);
      if (lineLength > 0) {
        return lineNumber;
      }
    }
    return 0;
  }
  doTrimFinalNewLines(model, isAutoSaved) {
    const lineCount = model.getLineCount();
    if (lineCount === 1) {
      return;
    }
    let prevSelection = [];
    let cannotTouchLineNumber = 0;
    const editor = findEditor(model, this.codeEditorService);
    if (editor) {
      prevSelection = editor.getSelections();
      if (isAutoSaved) {
        for (let i = 0, len = prevSelection.length; i < len; i++) {
          const positionLineNumber = prevSelection[i].positionLineNumber;
          if (positionLineNumber > cannotTouchLineNumber) {
            cannotTouchLineNumber = positionLineNumber;
          }
        }
      }
    }
    const lastNonEmptyLine = this.findLastNonEmptyLine(model);
    const deleteFromLineNumber = Math.max(lastNonEmptyLine + 1, cannotTouchLineNumber + 1);
    const deletionRange = model.validateRange(new Range(deleteFromLineNumber, 1, lineCount, model.getLineMaxColumn(lineCount)));
    if (deletionRange.isEmpty()) {
      return;
    }
    model.pushEditOperations(prevSelection, [EditOperation.delete(deletionRange)], (_edits) => prevSelection);
    editor?.setSelections(prevSelection);
  }
};
TrimFinalNewLinesParticipant = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ICodeEditorService)
], TrimFinalNewLinesParticipant);
let FormatOnSaveParticipant = class {
  constructor(configurationService, codeEditorService, instantiationService) {
    this.configurationService = configurationService;
    this.codeEditorService = codeEditorService;
    this.instantiationService = instantiationService;
  }
  async participate(model, context, progress, token) {
    if (!model.textEditorModel) {
      return;
    }
    if (context.reason === SaveReason.AUTO) {
      return void 0;
    }
    const textEditorModel = model.textEditorModel;
    const overrides = { overrideIdentifier: textEditorModel.getLanguageId(), resource: textEditorModel.uri };
    const nestedProgress = new Progress((provider) => {
      progress.report({
        message: localize(
          { key: "formatting2", comment: ["[configure]({1}) is a link. Only translate `configure`. Do not change brackets and parentheses or {1}"] },
          "Running '{0}' Formatter ([configure]({1})).",
          provider.displayName || provider.extensionId && provider.extensionId.value || "???",
          "command:workbench.action.openSettings?%5B%22editor.formatOnSave%22%5D"
        )
      });
    });
    const enabled = this.configurationService.getValue("editor.formatOnSave", overrides);
    if (!enabled) {
      return void 0;
    }
    const editorOrModel = findEditor(textEditorModel, this.codeEditorService) || textEditorModel;
    const mode = this.configurationService.getValue("editor.formatOnSaveMode", overrides);
    if (mode === "file") {
      await this.instantiationService.invokeFunction(formatDocumentWithSelectedProvider, editorOrModel, FormattingMode.Silent, nestedProgress, token);
    } else {
      const ranges = await this.instantiationService.invokeFunction(getModifiedRanges, isCodeEditor(editorOrModel) ? editorOrModel.getModel() : editorOrModel);
      if (ranges === null && mode === "modificationsIfAvailable") {
        await this.instantiationService.invokeFunction(formatDocumentWithSelectedProvider, editorOrModel, FormattingMode.Silent, nestedProgress, token);
      } else if (ranges) {
        await this.instantiationService.invokeFunction(formatDocumentRangesWithSelectedProvider, editorOrModel, ranges, FormattingMode.Silent, nestedProgress, token, false);
      }
    }
  }
};
FormatOnSaveParticipant = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ICodeEditorService),
  __decorateParam(2, IInstantiationService)
], FormatOnSaveParticipant);
let CodeActionOnSaveParticipant = class extends Disposable {
  constructor(configurationService, instantiationService, languageFeaturesService, hostService, editorService, codeEditorService) {
    super();
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.languageFeaturesService = languageFeaturesService;
    this.hostService = hostService;
    this.editorService = editorService;
    this.codeEditorService = codeEditorService;
    this._register(this.hostService.onDidChangeFocus(() => {
      this.triggerCodeActionsCommand();
    }));
    this._register(this.editorService.onDidActiveEditorChange(() => {
      this.triggerCodeActionsCommand();
    }));
  }
  async triggerCodeActionsCommand() {
    if (this.configurationService.getValue("editor.codeActions.triggerOnFocusChange") && this.configurationService.getValue("files.autoSave") === "afterDelay") {
      const model = this.codeEditorService.getActiveCodeEditor()?.getModel();
      if (!model) {
        return void 0;
      }
      const settingsOverrides = { overrideIdentifier: model.getLanguageId(), resource: model.uri };
      const setting = this.configurationService.getValue("editor.codeActionsOnSave", settingsOverrides);
      if (!setting) {
        return void 0;
      }
      if (Array.isArray(setting)) {
        return void 0;
      }
      const settingItems = Object.keys(setting).filter((x) => setting[x] && setting[x] === "always" && CodeActionKind.Source.contains(new HierarchicalKind(x)));
      const cancellationTokenSource = new CancellationTokenSource();
      const codeActionKindList = [];
      for (const item of settingItems) {
        codeActionKindList.push(new HierarchicalKind(item));
      }
      await this.applyOnSaveActions(model, codeActionKindList, [], Progress.None, cancellationTokenSource.token);
    }
  }
  async participate(model, context, progress, token) {
    if (!model.textEditorModel) {
      return;
    }
    const textEditorModel = model.textEditorModel;
    const settingsOverrides = { overrideIdentifier: textEditorModel.getLanguageId(), resource: textEditorModel.uri };
    const setting = this.configurationService.getValue("editor.codeActionsOnSave", settingsOverrides);
    if (!setting) {
      return void 0;
    }
    if (context.reason === SaveReason.AUTO) {
      return void 0;
    }
    if (context.reason !== SaveReason.EXPLICIT && Array.isArray(setting)) {
      return void 0;
    }
    const settingItems = Array.isArray(setting) ? setting : Object.keys(setting).filter((x) => setting[x] && setting[x] !== "never");
    const codeActionsOnSave = this.createCodeActionsOnSave(settingItems);
    if (!Array.isArray(setting)) {
      codeActionsOnSave.sort((a, b) => {
        if (CodeActionKind.SourceFixAll.contains(a)) {
          if (CodeActionKind.SourceFixAll.contains(b)) {
            return 0;
          }
          return -1;
        }
        if (CodeActionKind.SourceFixAll.contains(b)) {
          return 1;
        }
        return 0;
      });
    }
    if (!codeActionsOnSave.length) {
      return void 0;
    }
    const excludedActions = Array.isArray(setting) ? [] : Object.keys(setting).filter((x) => setting[x] === "never" || false).map((x) => new HierarchicalKind(x));
    progress.report({ message: localize("codeaction", "Quick Fixes") });
    const filteredSaveList = Array.isArray(setting) ? codeActionsOnSave : codeActionsOnSave.filter((x) => setting[x.value] === "always" || (setting[x.value] === "explicit" || setting[x.value] === true) && context.reason === SaveReason.EXPLICIT);
    await this.applyOnSaveActions(textEditorModel, filteredSaveList, excludedActions, progress, token);
  }
  createCodeActionsOnSave(settingItems) {
    const kinds = settingItems.map((x) => new HierarchicalKind(x));
    return kinds.filter((kind) => {
      return kinds.every((otherKind) => otherKind.equals(kind) || !otherKind.contains(kind));
    });
  }
  async applyOnSaveActions(model, codeActionsOnSave, excludes, progress, token) {
    const getActionProgress = new class {
      constructor() {
        this._names = /* @__PURE__ */ new Set();
      }
      _report() {
        progress.report({
          message: localize(
            { key: "codeaction.get2", comment: ["[configure]({1}) is a link. Only translate `configure`. Do not change brackets and parentheses or {1}"] },
            "Getting code actions from {0} ([configure]({1})).",
            [...this._names].map((name) => `'${name}'`).join(", "),
            "command:workbench.action.openSettings?%5B%22editor.codeActionsOnSave%22%5D"
          )
        });
      }
      report(provider) {
        if (provider.displayName && !this._names.has(provider.displayName)) {
          this._names.add(provider.displayName);
          this._report();
        }
      }
    }();
    for (const codeActionKind of codeActionsOnSave) {
      const actionsToRun = await this.getActionsToRun(model, codeActionKind, excludes, getActionProgress, token);
      if (token.isCancellationRequested) {
        actionsToRun.dispose();
        return;
      }
      try {
        for (const action of actionsToRun.validActions) {
          progress.report({ message: localize("codeAction.apply", "Applying code action '{0}'.", action.action.title) });
          await this.instantiationService.invokeFunction(applyCodeAction, action, ApplyCodeActionReason.OnSave, {}, token);
          if (token.isCancellationRequested) {
            return;
          }
        }
      } catch {
      } finally {
        actionsToRun.dispose();
      }
    }
  }
  getActionsToRun(model, codeActionKind, excludes, progress, token) {
    return getCodeActions(this.languageFeaturesService.codeActionProvider, model, model.getFullModelRange(), {
      type: CodeActionTriggerType.Auto,
      triggerAction: CodeActionTriggerSource.OnSave,
      filter: { include: codeActionKind, excludes, includeSourceActions: true }
    }, progress, token);
  }
};
CodeActionOnSaveParticipant = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILanguageFeaturesService),
  __decorateParam(3, IHostService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, ICodeEditorService)
], CodeActionOnSaveParticipant);
let SaveParticipantsContribution = class extends Disposable {
  constructor(instantiationService, textFileService) {
    super();
    this.instantiationService = instantiationService;
    this.textFileService = textFileService;
    this.registerSaveParticipants();
  }
  registerSaveParticipants() {
    this._register(this.textFileService.files.addSaveParticipant(this.instantiationService.createInstance(TrimWhitespaceParticipant)));
    this._register(this.textFileService.files.addSaveParticipant(this.instantiationService.createInstance(CodeActionOnSaveParticipant)));
    this._register(this.textFileService.files.addSaveParticipant(this.instantiationService.createInstance(FormatOnSaveParticipant)));
    this._register(this.textFileService.files.addSaveParticipant(this.instantiationService.createInstance(FinalNewLineParticipant)));
    this._register(this.textFileService.files.addSaveParticipant(this.instantiationService.createInstance(TrimFinalNewLinesParticipant)));
  }
};
SaveParticipantsContribution = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ITextFileService)
], SaveParticipantsContribution);
const workbenchContributionsRegistry = Registry.as(WorkbenchContributionsExtensions.Workbench);
workbenchContributionsRegistry.registerWorkbenchContribution(SaveParticipantsContribution, LifecyclePhase.Restored);
export {
  FinalNewLineParticipant,
  SaveParticipantsContribution,
  TrimFinalNewLinesParticipant,
  TrimWhitespaceParticipant
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvc2F2ZVBhcnRpY2lwYW50cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBIaWVyYXJjaGljYWxLaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGllcmFyY2hpY2FsS2luZC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBJQWN0aXZlQ29kZUVkaXRvciwgaXNDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyB0cmltVHJhaWxpbmdXaGl0ZXNwYWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb21tYW5kcy90cmltVHJhaWxpbmdXaGl0ZXNwYWNlQ29tbWFuZC5qcyc7XG5pbXBvcnQgeyBFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2RlQWN0aW9uUHJvdmlkZXIsIENvZGVBY3Rpb25UcmlnZ2VyVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBBcHBseUNvZGVBY3Rpb25SZWFzb24sIGFwcGx5Q29kZUFjdGlvbiwgZ2V0Q29kZUFjdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9jb2RlQWN0aW9uL2Jyb3dzZXIvY29kZUFjdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2RlQWN0aW9uS2luZCwgQ29kZUFjdGlvblRyaWdnZXJTb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9jb2RlQWN0aW9uL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBGb3JtYXR0aW5nTW9kZSwgZm9ybWF0RG9jdW1lbnRSYW5nZXNXaXRoU2VsZWN0ZWRQcm92aWRlciwgZm9ybWF0RG9jdW1lbnRXaXRoU2VsZWN0ZWRQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2Zvcm1hdC9icm93c2VyL2Zvcm1hdC5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0Q29udHJvbGxlcjIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zbmlwcGV0L2Jyb3dzZXIvc25pcHBldENvbnRyb2xsZXIyLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3MsIElQcm9ncmVzc1N0ZXAsIFByb2dyZXNzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24sIElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoQ29udHJpYnV0aW9uc0V4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBTYXZlUmVhc29uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBMaWZlY3ljbGVQaGFzZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElUZXh0RmlsZUVkaXRvck1vZGVsLCBJVGV4dEZpbGVTYXZlUGFydGljaXBhbnQsIElUZXh0RmlsZVNhdmVQYXJ0aWNpcGFudENvbnRleHQsIElUZXh0RmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vdGV4dGZpbGVzLmpzJztcbmltcG9ydCB7IGdldE1vZGlmaWVkUmFuZ2VzIH0gZnJvbSAnLi4vLi4vZm9ybWF0L2Jyb3dzZXIvZm9ybWF0TW9kaWZpZWQuanMnO1xuXG5leHBvcnQgY2xhc3MgVHJpbVdoaXRlc3BhY2VQYXJ0aWNpcGFudCBpbXBsZW1lbnRzIElUZXh0RmlsZVNhdmVQYXJ0aWNpcGFudCB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElDb2RlRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvZGVFZGl0b3JTZXJ2aWNlOiBJQ29kZUVkaXRvclNlcnZpY2Vcblx0KSB7XG5cdFx0Ly8gTm90aGluZ1xuXHR9XG5cblx0YXN5bmMgcGFydGljaXBhdGUobW9kZWw6IElUZXh0RmlsZUVkaXRvck1vZGVsLCBjb250ZXh0OiBJVGV4dEZpbGVTYXZlUGFydGljaXBhbnRDb250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCFtb2RlbC50ZXh0RWRpdG9yTW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB0cmltVHJhaWxpbmdXaGl0ZXNwYWNlT3B0aW9uID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignZmlsZXMudHJpbVRyYWlsaW5nV2hpdGVzcGFjZScsIHsgb3ZlcnJpZGVJZGVudGlmaWVyOiBtb2RlbC50ZXh0RWRpdG9yTW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpLCByZXNvdXJjZTogbW9kZWwucmVzb3VyY2UgfSk7XG5cdFx0Y29uc3QgdHJpbUluUmVnZXhBbmRTdHJpbmdzID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignZmlsZXMudHJpbVRyYWlsaW5nV2hpdGVzcGFjZUluUmVnZXhBbmRTdHJpbmdzJywgeyBvdmVycmlkZUlkZW50aWZpZXI6IG1vZGVsLnRleHRFZGl0b3JNb2RlbC5nZXRMYW5ndWFnZUlkKCksIHJlc291cmNlOiBtb2RlbC5yZXNvdXJjZSB9KTtcblx0XHRpZiAodHJpbVRyYWlsaW5nV2hpdGVzcGFjZU9wdGlvbikge1xuXHRcdFx0dGhpcy5kb1RyaW1UcmFpbGluZ1doaXRlc3BhY2UobW9kZWwudGV4dEVkaXRvck1vZGVsLCBjb250ZXh0LnJlYXNvbiA9PT0gU2F2ZVJlYXNvbi5BVVRPLCB0cmltSW5SZWdleEFuZFN0cmluZ3MpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZG9UcmltVHJhaWxpbmdXaGl0ZXNwYWNlKG1vZGVsOiBJVGV4dE1vZGVsLCBpc0F1dG9TYXZlZDogYm9vbGVhbiwgdHJpbUluUmVnZXhlc0FuZFN0cmluZ3M6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRsZXQgcHJldlNlbGVjdGlvbjogU2VsZWN0aW9uW10gPSBbXTtcblx0XHRsZXQgY3Vyc29yczogUG9zaXRpb25bXSA9IFtdO1xuXG5cdFx0Y29uc3QgZWRpdG9yID0gZmluZEVkaXRvcihtb2RlbCwgdGhpcy5jb2RlRWRpdG9yU2VydmljZSk7XG5cdFx0aWYgKGVkaXRvcikge1xuXHRcdFx0Ly8gRmluZCBgcHJldlNlbGVjdGlvbmAgaW4gYW55IGNhc2UgZG8gZW5zdXJlIGEgZ29vZCB1bmRvIHN0YWNrIHdoZW4gcHVzaGluZyB0aGUgZWRpdFxuXHRcdFx0Ly8gQ29sbGVjdCBhY3RpdmUgY3Vyc29ycyBpbiBgY3Vyc29yc2Agb25seSBpZiBgaXNBdXRvU2F2ZWRgIHRvIGF2b2lkIGhhdmluZyB0aGUgY3Vyc29ycyBqdW1wXG5cdFx0XHRwcmV2U2VsZWN0aW9uID0gZWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRcdGlmIChpc0F1dG9TYXZlZCkge1xuXHRcdFx0XHRjdXJzb3JzID0gcHJldlNlbGVjdGlvbi5tYXAocyA9PiBzLmdldFBvc2l0aW9uKCkpO1xuXHRcdFx0XHRjb25zdCBzbmlwcGV0c1JhbmdlID0gU25pcHBldENvbnRyb2xsZXIyLmdldChlZGl0b3IpPy5nZXRTZXNzaW9uRW5jbG9zaW5nUmFuZ2UoKTtcblx0XHRcdFx0aWYgKHNuaXBwZXRzUmFuZ2UpIHtcblx0XHRcdFx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gc25pcHBldHNSYW5nZS5zdGFydExpbmVOdW1iZXI7IGxpbmVOdW1iZXIgPD0gc25pcHBldHNSYW5nZS5lbmRMaW5lTnVtYmVyOyBsaW5lTnVtYmVyKyspIHtcblx0XHRcdFx0XHRcdGN1cnNvcnMucHVzaChuZXcgUG9zaXRpb24obGluZU51bWJlciwgbW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyKSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IG9wcyA9IHRyaW1UcmFpbGluZ1doaXRlc3BhY2UobW9kZWwsIGN1cnNvcnMsIHRyaW1JblJlZ2V4ZXNBbmRTdHJpbmdzKTtcblx0XHRpZiAoIW9wcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjsgLy8gTm90aGluZyB0byBkb1xuXHRcdH1cblxuXHRcdG1vZGVsLnB1c2hFZGl0T3BlcmF0aW9ucyhwcmV2U2VsZWN0aW9uLCBvcHMsIChfZWRpdHMpID0+IHByZXZTZWxlY3Rpb24pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGZpbmRFZGl0b3IobW9kZWw6IElUZXh0TW9kZWwsIGNvZGVFZGl0b3JTZXJ2aWNlOiBJQ29kZUVkaXRvclNlcnZpY2UpOiBJQWN0aXZlQ29kZUVkaXRvciB8IG51bGwge1xuXHRsZXQgY2FuZGlkYXRlOiBJQWN0aXZlQ29kZUVkaXRvciB8IG51bGwgPSBudWxsO1xuXG5cdGlmIChtb2RlbC5pc0F0dGFjaGVkVG9FZGl0b3IoKSkge1xuXHRcdGZvciAoY29uc3QgZWRpdG9yIG9mIGNvZGVFZGl0b3JTZXJ2aWNlLmxpc3RDb2RlRWRpdG9ycygpKSB7XG5cdFx0XHRpZiAoZWRpdG9yLmhhc01vZGVsKCkgJiYgZWRpdG9yLmdldE1vZGVsKCkgPT09IG1vZGVsKSB7XG5cdFx0XHRcdGlmIChlZGl0b3IuaGFzVGV4dEZvY3VzKCkpIHtcblx0XHRcdFx0XHRyZXR1cm4gZWRpdG9yOyAvLyBmYXZvdXIgZm9jdXNlZCBlZGl0b3IgaWYgdGhlcmUgYXJlIG11bHRpcGxlXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjYW5kaWRhdGUgPSBlZGl0b3I7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGNhbmRpZGF0ZTtcbn1cblxuZXhwb3J0IGNsYXNzIEZpbmFsTmV3TGluZVBhcnRpY2lwYW50IGltcGxlbWVudHMgSVRleHRGaWxlU2F2ZVBhcnRpY2lwYW50IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvZGVFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZVxuXHQpIHtcblx0XHQvLyBOb3RoaW5nXG5cdH1cblxuXHRhc3luYyBwYXJ0aWNpcGF0ZShtb2RlbDogSVRleHRGaWxlRWRpdG9yTW9kZWwsIGNvbnRleHQ6IElUZXh0RmlsZVNhdmVQYXJ0aWNpcGFudENvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIW1vZGVsLnRleHRFZGl0b3JNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdmaWxlcy5pbnNlcnRGaW5hbE5ld2xpbmUnLCB7IG92ZXJyaWRlSWRlbnRpZmllcjogbW9kZWwudGV4dEVkaXRvck1vZGVsLmdldExhbmd1YWdlSWQoKSwgcmVzb3VyY2U6IG1vZGVsLnJlc291cmNlIH0pKSB7XG5cdFx0XHR0aGlzLmRvSW5zZXJ0RmluYWxOZXdMaW5lKG1vZGVsLnRleHRFZGl0b3JNb2RlbCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBkb0luc2VydEZpbmFsTmV3TGluZShtb2RlbDogSVRleHRNb2RlbCk6IHZvaWQge1xuXHRcdGNvbnN0IGxpbmVDb3VudCA9IG1vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdGNvbnN0IGxhc3RMaW5lID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZUNvdW50KTtcblx0XHRjb25zdCBsYXN0TGluZUlzRW1wdHlPcldoaXRlc3BhY2UgPSBzdHJpbmdzLmxhc3ROb25XaGl0ZXNwYWNlSW5kZXgobGFzdExpbmUpID09PSAtMTtcblxuXHRcdGlmICghbGluZUNvdW50IHx8IGxhc3RMaW5lSXNFbXB0eU9yV2hpdGVzcGFjZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRzID0gW0VkaXRPcGVyYXRpb24uaW5zZXJ0KG5ldyBQb3NpdGlvbihsaW5lQ291bnQsIG1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZUNvdW50KSksIG1vZGVsLmdldEVPTCgpKV07XG5cdFx0Y29uc3QgZWRpdG9yID0gZmluZEVkaXRvcihtb2RlbCwgdGhpcy5jb2RlRWRpdG9yU2VydmljZSk7XG5cdFx0aWYgKGVkaXRvcikge1xuXHRcdFx0ZWRpdG9yLmV4ZWN1dGVFZGl0cygnaW5zZXJ0RmluYWxOZXdMaW5lJywgZWRpdHMsIGVkaXRvci5nZXRTZWxlY3Rpb25zKCkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtb2RlbC5wdXNoRWRpdE9wZXJhdGlvbnMoW10sIGVkaXRzLCAoKSA9PiBudWxsKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRyaW1GaW5hbE5ld0xpbmVzUGFydGljaXBhbnQgaW1wbGVtZW50cyBJVGV4dEZpbGVTYXZlUGFydGljaXBhbnQge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlXG5cdCkge1xuXHRcdC8vIE5vdGhpbmdcblx0fVxuXG5cdGFzeW5jIHBhcnRpY2lwYXRlKG1vZGVsOiBJVGV4dEZpbGVFZGl0b3JNb2RlbCwgY29udGV4dDogSVRleHRGaWxlU2F2ZVBhcnRpY2lwYW50Q29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghbW9kZWwudGV4dEVkaXRvck1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2ZpbGVzLnRyaW1GaW5hbE5ld2xpbmVzJywgeyBvdmVycmlkZUlkZW50aWZpZXI6IG1vZGVsLnRleHRFZGl0b3JNb2RlbC5nZXRMYW5ndWFnZUlkKCksIHJlc291cmNlOiBtb2RlbC5yZXNvdXJjZSB9KSkge1xuXHRcdFx0dGhpcy5kb1RyaW1GaW5hbE5ld0xpbmVzKG1vZGVsLnRleHRFZGl0b3JNb2RlbCwgY29udGV4dC5yZWFzb24gPT09IFNhdmVSZWFzb24uQVVUTyk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIHJldHVybnMgMCBpZiB0aGUgZW50aXJlIGZpbGUgaXMgZW1wdHlcblx0ICovXG5cdHByaXZhdGUgZmluZExhc3ROb25FbXB0eUxpbmUobW9kZWw6IElUZXh0TW9kZWwpOiBudW1iZXIge1xuXHRcdGZvciAobGV0IGxpbmVOdW1iZXIgPSBtb2RlbC5nZXRMaW5lQ291bnQoKTsgbGluZU51bWJlciA+PSAxOyBsaW5lTnVtYmVyLS0pIHtcblx0XHRcdGNvbnN0IGxpbmVMZW5ndGggPSBtb2RlbC5nZXRMaW5lTGVuZ3RoKGxpbmVOdW1iZXIpO1xuXHRcdFx0aWYgKGxpbmVMZW5ndGggPiAwKSB7XG5cdFx0XHRcdC8vIHRoaXMgbGluZSBoYXMgY29udGVudFxuXHRcdFx0XHRyZXR1cm4gbGluZU51bWJlcjtcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gbm8gbGluZSBoYXMgY29udGVudFxuXHRcdHJldHVybiAwO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1RyaW1GaW5hbE5ld0xpbmVzKG1vZGVsOiBJVGV4dE1vZGVsLCBpc0F1dG9TYXZlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IGxpbmVDb3VudCA9IG1vZGVsLmdldExpbmVDb3VudCgpO1xuXG5cdFx0Ly8gRG8gbm90IGluc2VydCBuZXcgbGluZSBpZiBmaWxlIGRvZXMgbm90IGVuZCB3aXRoIG5ldyBsaW5lXG5cdFx0aWYgKGxpbmVDb3VudCA9PT0gMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBwcmV2U2VsZWN0aW9uOiBTZWxlY3Rpb25bXSA9IFtdO1xuXHRcdGxldCBjYW5ub3RUb3VjaExpbmVOdW1iZXIgPSAwO1xuXHRcdGNvbnN0IGVkaXRvciA9IGZpbmRFZGl0b3IobW9kZWwsIHRoaXMuY29kZUVkaXRvclNlcnZpY2UpO1xuXHRcdGlmIChlZGl0b3IpIHtcblx0XHRcdHByZXZTZWxlY3Rpb24gPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdFx0aWYgKGlzQXV0b1NhdmVkKSB7XG5cdFx0XHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBwcmV2U2VsZWN0aW9uLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdFx0Y29uc3QgcG9zaXRpb25MaW5lTnVtYmVyID0gcHJldlNlbGVjdGlvbltpXS5wb3NpdGlvbkxpbmVOdW1iZXI7XG5cdFx0XHRcdFx0aWYgKHBvc2l0aW9uTGluZU51bWJlciA+IGNhbm5vdFRvdWNoTGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0Y2Fubm90VG91Y2hMaW5lTnVtYmVyID0gcG9zaXRpb25MaW5lTnVtYmVyO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGxhc3ROb25FbXB0eUxpbmUgPSB0aGlzLmZpbmRMYXN0Tm9uRW1wdHlMaW5lKG1vZGVsKTtcblx0XHRjb25zdCBkZWxldGVGcm9tTGluZU51bWJlciA9IE1hdGgubWF4KGxhc3ROb25FbXB0eUxpbmUgKyAxLCBjYW5ub3RUb3VjaExpbmVOdW1iZXIgKyAxKTtcblx0XHRjb25zdCBkZWxldGlvblJhbmdlID0gbW9kZWwudmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UoZGVsZXRlRnJvbUxpbmVOdW1iZXIsIDEsIGxpbmVDb3VudCwgbW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lQ291bnQpKSk7XG5cblx0XHRpZiAoZGVsZXRpb25SYW5nZS5pc0VtcHR5KCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRtb2RlbC5wdXNoRWRpdE9wZXJhdGlvbnMocHJldlNlbGVjdGlvbiwgW0VkaXRPcGVyYXRpb24uZGVsZXRlKGRlbGV0aW9uUmFuZ2UpXSwgX2VkaXRzID0+IHByZXZTZWxlY3Rpb24pO1xuXG5cdFx0ZWRpdG9yPy5zZXRTZWxlY3Rpb25zKHByZXZTZWxlY3Rpb24pO1xuXHR9XG59XG5cbmNsYXNzIEZvcm1hdE9uU2F2ZVBhcnRpY2lwYW50IGltcGxlbWVudHMgSVRleHRGaWxlU2F2ZVBhcnRpY2lwYW50IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvZGVFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0Ly8gTm90aGluZ1xuXHR9XG5cblx0YXN5bmMgcGFydGljaXBhdGUobW9kZWw6IElUZXh0RmlsZUVkaXRvck1vZGVsLCBjb250ZXh0OiBJVGV4dEZpbGVTYXZlUGFydGljaXBhbnRDb250ZXh0LCBwcm9ncmVzczogSVByb2dyZXNzPElQcm9ncmVzc1N0ZXA+LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIW1vZGVsLnRleHRFZGl0b3JNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoY29udGV4dC5yZWFzb24gPT09IFNhdmVSZWFzb24uQVVUTykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCB0ZXh0RWRpdG9yTW9kZWwgPSBtb2RlbC50ZXh0RWRpdG9yTW9kZWw7XG5cdFx0Y29uc3Qgb3ZlcnJpZGVzID0geyBvdmVycmlkZUlkZW50aWZpZXI6IHRleHRFZGl0b3JNb2RlbC5nZXRMYW5ndWFnZUlkKCksIHJlc291cmNlOiB0ZXh0RWRpdG9yTW9kZWwudXJpIH07XG5cblx0XHRjb25zdCBuZXN0ZWRQcm9ncmVzcyA9IG5ldyBQcm9ncmVzczx7IGRpc3BsYXlOYW1lPzogc3RyaW5nOyBleHRlbnNpb25JZD86IEV4dGVuc2lvbklkZW50aWZpZXIgfT4ocHJvdmlkZXIgPT4ge1xuXHRcdFx0cHJvZ3Jlc3MucmVwb3J0KHtcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoXG5cdFx0XHRcdFx0eyBrZXk6ICdmb3JtYXR0aW5nMicsIGNvbW1lbnQ6IFsnW2NvbmZpZ3VyZV0oezF9KSBpcyBhIGxpbmsuIE9ubHkgdHJhbnNsYXRlIGBjb25maWd1cmVgLiBEbyBub3QgY2hhbmdlIGJyYWNrZXRzIGFuZCBwYXJlbnRoZXNlcyBvciB7MX0nXSB9LFxuXHRcdFx0XHRcdFwiUnVubmluZyAnezB9JyBGb3JtYXR0ZXIgKFtjb25maWd1cmVdKHsxfSkpLlwiLFxuXHRcdFx0XHRcdHByb3ZpZGVyLmRpc3BsYXlOYW1lIHx8IHByb3ZpZGVyLmV4dGVuc2lvbklkICYmIHByb3ZpZGVyLmV4dGVuc2lvbklkLnZhbHVlIHx8ICc/Pz8nLFxuXHRcdFx0XHRcdCdjb21tYW5kOndvcmtiZW5jaC5hY3Rpb24ub3BlblNldHRpbmdzPyU1QiUyMmVkaXRvci5mb3JtYXRPblNhdmUlMjIlNUQnXG5cdFx0XHRcdClcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZW5hYmxlZCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ2VkaXRvci5mb3JtYXRPblNhdmUnLCBvdmVycmlkZXMpO1xuXHRcdGlmICghZW5hYmxlZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0b3JPck1vZGVsID0gZmluZEVkaXRvcih0ZXh0RWRpdG9yTW9kZWwsIHRoaXMuY29kZUVkaXRvclNlcnZpY2UpIHx8IHRleHRFZGl0b3JNb2RlbDtcblx0XHRjb25zdCBtb2RlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTwnZmlsZScgfCAnbW9kaWZpY2F0aW9ucycgfCAnbW9kaWZpY2F0aW9uc0lmQXZhaWxhYmxlJz4oJ2VkaXRvci5mb3JtYXRPblNhdmVNb2RlJywgb3ZlcnJpZGVzKTtcblxuXHRcdGlmIChtb2RlID09PSAnZmlsZScpIHtcblx0XHRcdGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZm9ybWF0RG9jdW1lbnRXaXRoU2VsZWN0ZWRQcm92aWRlciwgZWRpdG9yT3JNb2RlbCwgRm9ybWF0dGluZ01vZGUuU2lsZW50LCBuZXN0ZWRQcm9ncmVzcywgdG9rZW4pO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHJhbmdlcyA9IGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZ2V0TW9kaWZpZWRSYW5nZXMsIGlzQ29kZUVkaXRvcihlZGl0b3JPck1vZGVsKSA/IGVkaXRvck9yTW9kZWwuZ2V0TW9kZWwoKSA6IGVkaXRvck9yTW9kZWwpO1xuXHRcdFx0aWYgKHJhbmdlcyA9PT0gbnVsbCAmJiBtb2RlID09PSAnbW9kaWZpY2F0aW9uc0lmQXZhaWxhYmxlJykge1xuXHRcdFx0XHQvLyBubyBTQ00sIGZhbGxiYWNrIHRvIGZvcm1hdHRpbmcgdGhlIHdob2xlIGZpbGUgaWZmIHdhbnRlZFxuXHRcdFx0XHRhd2FpdCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGZvcm1hdERvY3VtZW50V2l0aFNlbGVjdGVkUHJvdmlkZXIsIGVkaXRvck9yTW9kZWwsIEZvcm1hdHRpbmdNb2RlLlNpbGVudCwgbmVzdGVkUHJvZ3Jlc3MsIHRva2VuKTtcblxuXHRcdFx0fSBlbHNlIGlmIChyYW5nZXMpIHtcblx0XHRcdFx0Ly8gZm9ybWF0dGVkIG1vZGlmaWVkIHJhbmdlc1xuXHRcdFx0XHRhd2FpdCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGZvcm1hdERvY3VtZW50UmFuZ2VzV2l0aFNlbGVjdGVkUHJvdmlkZXIsIGVkaXRvck9yTW9kZWwsIHJhbmdlcywgRm9ybWF0dGluZ01vZGUuU2lsZW50LCBuZXN0ZWRQcm9ncmVzcywgdG9rZW4sIGZhbHNlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgQ29kZUFjdGlvbk9uU2F2ZVBhcnRpY2lwYW50IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUZXh0RmlsZVNhdmVQYXJ0aWNpcGFudCB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElDb2RlRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvZGVFZGl0b3JTZXJ2aWNlOiBJQ29kZUVkaXRvclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmhvc3RTZXJ2aWNlLm9uRGlkQ2hhbmdlRm9jdXMoKCkgPT4geyB0aGlzLnRyaWdnZXJDb2RlQWN0aW9uc0NvbW1hbmQoKTsgfSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yU2VydmljZS5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSgoKSA9PiB7IHRoaXMudHJpZ2dlckNvZGVBY3Rpb25zQ29tbWFuZCgpOyB9KSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHRyaWdnZXJDb2RlQWN0aW9uc0NvbW1hbmQoKSB7XG5cdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ2VkaXRvci5jb2RlQWN0aW9ucy50cmlnZ2VyT25Gb2N1c0NoYW5nZScpICYmIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8c3RyaW5nPignZmlsZXMuYXV0b1NhdmUnKSA9PT0gJ2FmdGVyRGVsYXknKSB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuY29kZUVkaXRvclNlcnZpY2UuZ2V0QWN0aXZlQ29kZUVkaXRvcigpPy5nZXRNb2RlbCgpO1xuXHRcdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzZXR0aW5nc092ZXJyaWRlcyA9IHsgb3ZlcnJpZGVJZGVudGlmaWVyOiBtb2RlbC5nZXRMYW5ndWFnZUlkKCksIHJlc291cmNlOiBtb2RlbC51cmkgfTtcblx0XHRcdGNvbnN0IHNldHRpbmcgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHsgW2tpbmQ6IHN0cmluZ106IHN0cmluZyB8IGJvb2xlYW4gfSB8IHN0cmluZ1tdPignZWRpdG9yLmNvZGVBY3Rpb25zT25TYXZlJywgc2V0dGluZ3NPdmVycmlkZXMpO1xuXG5cdFx0XHRpZiAoIXNldHRpbmcpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKEFycmF5LmlzQXJyYXkoc2V0dGluZykpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc2V0dGluZ0l0ZW1zOiBzdHJpbmdbXSA9IE9iamVjdC5rZXlzKHNldHRpbmcpLmZpbHRlcih4ID0+IHNldHRpbmdbeF0gJiYgc2V0dGluZ1t4XSA9PT0gJ2Fsd2F5cycgJiYgQ29kZUFjdGlvbktpbmQuU291cmNlLmNvbnRhaW5zKG5ldyBIaWVyYXJjaGljYWxLaW5kKHgpKSk7XG5cblx0XHRcdGNvbnN0IGNhbmNlbGxhdGlvblRva2VuU291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cblx0XHRcdGNvbnN0IGNvZGVBY3Rpb25LaW5kTGlzdCA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBpdGVtIG9mIHNldHRpbmdJdGVtcykge1xuXHRcdFx0XHRjb2RlQWN0aW9uS2luZExpc3QucHVzaChuZXcgSGllcmFyY2hpY2FsS2luZChpdGVtKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHJ1biBjb2RlIGFjdGlvbnMgYmFzZWQgb24gd2hhdCBpcyBmb3VuZCBmcm9tIHNldHRpbmcgPT09ICdhbHdheXMnLCBubyBleGNsdXNpb25zLlxuXHRcdFx0YXdhaXQgdGhpcy5hcHBseU9uU2F2ZUFjdGlvbnMobW9kZWwsIGNvZGVBY3Rpb25LaW5kTGlzdCwgW10sIFByb2dyZXNzLk5vbmUsIGNhbmNlbGxhdGlvblRva2VuU291cmNlLnRva2VuKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBwYXJ0aWNpcGF0ZShtb2RlbDogSVRleHRGaWxlRWRpdG9yTW9kZWwsIGNvbnRleHQ6IElUZXh0RmlsZVNhdmVQYXJ0aWNpcGFudENvbnRleHQsIHByb2dyZXNzOiBJUHJvZ3Jlc3M8SVByb2dyZXNzU3RlcD4sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghbW9kZWwudGV4dEVkaXRvck1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGV4dEVkaXRvck1vZGVsID0gbW9kZWwudGV4dEVkaXRvck1vZGVsO1xuXHRcdGNvbnN0IHNldHRpbmdzT3ZlcnJpZGVzID0geyBvdmVycmlkZUlkZW50aWZpZXI6IHRleHRFZGl0b3JNb2RlbC5nZXRMYW5ndWFnZUlkKCksIHJlc291cmNlOiB0ZXh0RWRpdG9yTW9kZWwudXJpIH07XG5cblx0XHQvLyBDb252ZXJ0IGJvb2xlYW4gdmFsdWVzIHRvIHN0cmluZ3Ncblx0XHRjb25zdCBzZXR0aW5nID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTx7IFtraW5kOiBzdHJpbmddOiBzdHJpbmcgfCBib29sZWFuIH0gfCBzdHJpbmdbXT4oJ2VkaXRvci5jb2RlQWN0aW9uc09uU2F2ZScsIHNldHRpbmdzT3ZlcnJpZGVzKTtcblx0XHRpZiAoIXNldHRpbmcpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbnRleHQucmVhc29uID09PSBTYXZlUmVhc29uLkFVVE8pIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbnRleHQucmVhc29uICE9PSBTYXZlUmVhc29uLkVYUExJQ0lUICYmIEFycmF5LmlzQXJyYXkoc2V0dGluZykpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2V0dGluZ0l0ZW1zOiBzdHJpbmdbXSA9IEFycmF5LmlzQXJyYXkoc2V0dGluZylcblx0XHRcdD8gc2V0dGluZ1xuXHRcdFx0OiBPYmplY3Qua2V5cyhzZXR0aW5nKS5maWx0ZXIoeCA9PiBzZXR0aW5nW3hdICYmIHNldHRpbmdbeF0gIT09ICduZXZlcicpO1xuXG5cdFx0Y29uc3QgY29kZUFjdGlvbnNPblNhdmUgPSB0aGlzLmNyZWF0ZUNvZGVBY3Rpb25zT25TYXZlKHNldHRpbmdJdGVtcyk7XG5cblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoc2V0dGluZykpIHtcblx0XHRcdGNvZGVBY3Rpb25zT25TYXZlLnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdFx0aWYgKENvZGVBY3Rpb25LaW5kLlNvdXJjZUZpeEFsbC5jb250YWlucyhhKSkge1xuXHRcdFx0XHRcdGlmIChDb2RlQWN0aW9uS2luZC5Tb3VyY2VGaXhBbGwuY29udGFpbnMoYikpIHtcblx0XHRcdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKENvZGVBY3Rpb25LaW5kLlNvdXJjZUZpeEFsbC5jb250YWlucyhiKSkge1xuXHRcdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFjb2RlQWN0aW9uc09uU2F2ZS5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IGV4Y2x1ZGVkQWN0aW9ucyA9IEFycmF5LmlzQXJyYXkoc2V0dGluZylcblx0XHRcdD8gW11cblx0XHRcdDogT2JqZWN0LmtleXMoc2V0dGluZylcblx0XHRcdFx0LmZpbHRlcih4ID0+IHNldHRpbmdbeF0gPT09ICduZXZlcicgfHwgZmFsc2UpXG5cdFx0XHRcdC5tYXAoeCA9PiBuZXcgSGllcmFyY2hpY2FsS2luZCh4KSk7XG5cblx0XHRwcm9ncmVzcy5yZXBvcnQoeyBtZXNzYWdlOiBsb2NhbGl6ZSgnY29kZWFjdGlvbicsIFwiUXVpY2sgRml4ZXNcIikgfSk7XG5cblx0XHRjb25zdCBmaWx0ZXJlZFNhdmVMaXN0ID0gQXJyYXkuaXNBcnJheShzZXR0aW5nKSA/IGNvZGVBY3Rpb25zT25TYXZlIDogY29kZUFjdGlvbnNPblNhdmUuZmlsdGVyKHggPT4gc2V0dGluZ1t4LnZhbHVlXSA9PT0gJ2Fsd2F5cycgfHwgKChzZXR0aW5nW3gudmFsdWVdID09PSAnZXhwbGljaXQnIHx8IHNldHRpbmdbeC52YWx1ZV0gPT09IHRydWUpICYmIGNvbnRleHQucmVhc29uID09PSBTYXZlUmVhc29uLkVYUExJQ0lUKSk7XG5cblx0XHRhd2FpdCB0aGlzLmFwcGx5T25TYXZlQWN0aW9ucyh0ZXh0RWRpdG9yTW9kZWwsIGZpbHRlcmVkU2F2ZUxpc3QsIGV4Y2x1ZGVkQWN0aW9ucywgcHJvZ3Jlc3MsIHRva2VuKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlQ29kZUFjdGlvbnNPblNhdmUoc2V0dGluZ0l0ZW1zOiByZWFkb25seSBzdHJpbmdbXSk6IEhpZXJhcmNoaWNhbEtpbmRbXSB7XG5cdFx0Y29uc3Qga2luZHMgPSBzZXR0aW5nSXRlbXMubWFwKHggPT4gbmV3IEhpZXJhcmNoaWNhbEtpbmQoeCkpO1xuXG5cdFx0Ly8gUmVtb3ZlIHN1YnNldHNcblx0XHRyZXR1cm4ga2luZHMuZmlsdGVyKGtpbmQgPT4ge1xuXHRcdFx0cmV0dXJuIGtpbmRzLmV2ZXJ5KG90aGVyS2luZCA9PiBvdGhlcktpbmQuZXF1YWxzKGtpbmQpIHx8ICFvdGhlcktpbmQuY29udGFpbnMoa2luZCkpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBhcHBseU9uU2F2ZUFjdGlvbnMobW9kZWw6IElUZXh0TW9kZWwsIGNvZGVBY3Rpb25zT25TYXZlOiByZWFkb25seSBIaWVyYXJjaGljYWxLaW5kW10sIGV4Y2x1ZGVzOiByZWFkb25seSBIaWVyYXJjaGljYWxLaW5kW10sIHByb2dyZXNzOiBJUHJvZ3Jlc3M8SVByb2dyZXNzU3RlcD4sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Y29uc3QgZ2V0QWN0aW9uUHJvZ3Jlc3MgPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBJUHJvZ3Jlc3M8Q29kZUFjdGlvblByb3ZpZGVyPiB7XG5cdFx0XHRwcml2YXRlIF9uYW1lcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdFx0cHJpdmF0ZSBfcmVwb3J0KCk6IHZvaWQge1xuXHRcdFx0XHRwcm9ncmVzcy5yZXBvcnQoe1xuXHRcdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKFxuXHRcdFx0XHRcdFx0eyBrZXk6ICdjb2RlYWN0aW9uLmdldDInLCBjb21tZW50OiBbJ1tjb25maWd1cmVdKHsxfSkgaXMgYSBsaW5rLiBPbmx5IHRyYW5zbGF0ZSBgY29uZmlndXJlYC4gRG8gbm90IGNoYW5nZSBicmFja2V0cyBhbmQgcGFyZW50aGVzZXMgb3IgezF9J10gfSxcblx0XHRcdFx0XHRcdFwiR2V0dGluZyBjb2RlIGFjdGlvbnMgZnJvbSB7MH0gKFtjb25maWd1cmVdKHsxfSkpLlwiLFxuXHRcdFx0XHRcdFx0Wy4uLnRoaXMuX25hbWVzXS5tYXAobmFtZSA9PiBgJyR7bmFtZX0nYCkuam9pbignLCAnKSxcblx0XHRcdFx0XHRcdCdjb21tYW5kOndvcmtiZW5jaC5hY3Rpb24ub3BlblNldHRpbmdzPyU1QiUyMmVkaXRvci5jb2RlQWN0aW9uc09uU2F2ZSUyMiU1RCdcblx0XHRcdFx0XHQpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cmVwb3J0KHByb3ZpZGVyOiBDb2RlQWN0aW9uUHJvdmlkZXIpIHtcblx0XHRcdFx0aWYgKHByb3ZpZGVyLmRpc3BsYXlOYW1lICYmICF0aGlzLl9uYW1lcy5oYXMocHJvdmlkZXIuZGlzcGxheU5hbWUpKSB7XG5cdFx0XHRcdFx0dGhpcy5fbmFtZXMuYWRkKHByb3ZpZGVyLmRpc3BsYXlOYW1lKTtcblx0XHRcdFx0XHR0aGlzLl9yZXBvcnQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRmb3IgKGNvbnN0IGNvZGVBY3Rpb25LaW5kIG9mIGNvZGVBY3Rpb25zT25TYXZlKSB7XG5cdFx0XHRjb25zdCBhY3Rpb25zVG9SdW4gPSBhd2FpdCB0aGlzLmdldEFjdGlvbnNUb1J1bihtb2RlbCwgY29kZUFjdGlvbktpbmQsIGV4Y2x1ZGVzLCBnZXRBY3Rpb25Qcm9ncmVzcywgdG9rZW4pO1xuXG5cdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0YWN0aW9uc1RvUnVuLmRpc3Bvc2UoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGFjdGlvbiBvZiBhY3Rpb25zVG9SdW4udmFsaWRBY3Rpb25zKSB7XG5cdFx0XHRcdFx0cHJvZ3Jlc3MucmVwb3J0KHsgbWVzc2FnZTogbG9jYWxpemUoJ2NvZGVBY3Rpb24uYXBwbHknLCBcIkFwcGx5aW5nIGNvZGUgYWN0aW9uICd7MH0nLlwiLCBhY3Rpb24uYWN0aW9uLnRpdGxlKSB9KTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFwcGx5Q29kZUFjdGlvbiwgYWN0aW9uLCBBcHBseUNvZGVBY3Rpb25SZWFzb24uT25TYXZlLCB7fSwgdG9rZW4pO1xuXHRcdFx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdC8vIEZhaWx1cmUgdG8gYXBwbHkgYSBjb2RlIGFjdGlvbiBzaG91bGQgbm90IGJsb2NrIG90aGVyIG9uIHNhdmUgYWN0aW9uc1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0YWN0aW9uc1RvUnVuLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldEFjdGlvbnNUb1J1bihtb2RlbDogSVRleHRNb2RlbCwgY29kZUFjdGlvbktpbmQ6IEhpZXJhcmNoaWNhbEtpbmQsIGV4Y2x1ZGVzOiByZWFkb25seSBIaWVyYXJjaGljYWxLaW5kW10sIHByb2dyZXNzOiBJUHJvZ3Jlc3M8Q29kZUFjdGlvblByb3ZpZGVyPiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSB7XG5cdFx0cmV0dXJuIGdldENvZGVBY3Rpb25zKHRoaXMubGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29kZUFjdGlvblByb3ZpZGVyLCBtb2RlbCwgbW9kZWwuZ2V0RnVsbE1vZGVsUmFuZ2UoKSwge1xuXHRcdFx0dHlwZTogQ29kZUFjdGlvblRyaWdnZXJUeXBlLkF1dG8sXG5cdFx0XHR0cmlnZ2VyQWN0aW9uOiBDb2RlQWN0aW9uVHJpZ2dlclNvdXJjZS5PblNhdmUsXG5cdFx0XHRmaWx0ZXI6IHsgaW5jbHVkZTogY29kZUFjdGlvbktpbmQsIGV4Y2x1ZGVzOiBleGNsdWRlcywgaW5jbHVkZVNvdXJjZUFjdGlvbnM6IHRydWUgfSxcblx0XHR9LCBwcm9ncmVzcywgdG9rZW4pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTYXZlUGFydGljaXBhbnRzQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGV4dEZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGV4dEZpbGVTZXJ2aWNlOiBJVGV4dEZpbGVTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyU2F2ZVBhcnRpY2lwYW50cygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlclNhdmVQYXJ0aWNpcGFudHMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50ZXh0RmlsZVNlcnZpY2UuZmlsZXMuYWRkU2F2ZVBhcnRpY2lwYW50KHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVHJpbVdoaXRlc3BhY2VQYXJ0aWNpcGFudCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRleHRGaWxlU2VydmljZS5maWxlcy5hZGRTYXZlUGFydGljaXBhbnQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb2RlQWN0aW9uT25TYXZlUGFydGljaXBhbnQpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50ZXh0RmlsZVNlcnZpY2UuZmlsZXMuYWRkU2F2ZVBhcnRpY2lwYW50KHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRm9ybWF0T25TYXZlUGFydGljaXBhbnQpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50ZXh0RmlsZVNlcnZpY2UuZmlsZXMuYWRkU2F2ZVBhcnRpY2lwYW50KHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRmluYWxOZXdMaW5lUGFydGljaXBhbnQpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50ZXh0RmlsZVNlcnZpY2UuZmlsZXMuYWRkU2F2ZVBhcnRpY2lwYW50KHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVHJpbUZpbmFsTmV3TGluZXNQYXJ0aWNpcGFudCkpKTtcblx0fVxufVxuXG5jb25zdCB3b3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5PihXb3JrYmVuY2hDb250cmlidXRpb25zRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpO1xud29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5LnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKFNhdmVQYXJ0aWNpcGFudHNDb250cmlidXRpb24sIExpZmVjeWNsZVBoYXNlLlJlc3RvcmVkKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBNEIsK0JBQStCO0FBQzNELFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsa0JBQWtCO0FBQzNCLFlBQVksYUFBYTtBQUN6QixTQUE0QixvQkFBb0I7QUFDaEQsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBRXRCLFNB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
