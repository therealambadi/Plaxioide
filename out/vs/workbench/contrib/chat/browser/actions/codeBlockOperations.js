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
import { AsyncIterableObject } from "../../../../../base/common/async.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { CharCode } from "../../../../../base/common/charCode.js";
import { isCancellationError } from "../../../../../base/common/errors.js";
import { isEqual } from "../../../../../base/common/resources.js";
import * as strings from "../../../../../base/common/strings.js";
import { URI } from "../../../../../base/common/uri.js";
import { getCodeEditor } from "../../../../../editor/browser/editorBrowser.js";
import { IBulkEditService, ResourceTextEdit } from "../../../../../editor/browser/services/bulkEditService.js";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { localize } from "../../../../../nls.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IProgressService, ProgressLocation } from "../../../../../platform/progress/common/progress.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { ITextFileService } from "../../../../services/textfile/common/textfiles.js";
import { reviewEdits } from "../../../inlineChat/browser/inlineChatController.js";
import { insertCell } from "../../../notebook/browser/controller/cellOperations.js";
import { CellKind, NOTEBOOK_EDITOR_ID } from "../../../notebook/common/notebookCommon.js";
import { ICodeMapperService } from "../../common/chatCodeMapperService.js";
import { IChatService } from "../../common/chatService.js";
import { isResponseVM } from "../../common/chatViewModel.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
let InsertCodeBlockOperation = class {
  constructor(editorService, textFileService, bulkEditService, codeEditorService, chatService, languageService, dialogService) {
    this.editorService = editorService;
    this.textFileService = textFileService;
    this.bulkEditService = bulkEditService;
    this.codeEditorService = codeEditorService;
    this.chatService = chatService;
    this.languageService = languageService;
    this.dialogService = dialogService;
  }
  async run(context) {
    const activeEditorControl = getEditableActiveCodeEditor(this.editorService);
    if (activeEditorControl) {
      await this.handleTextEditor(activeEditorControl, context);
    } else {
      const activeNotebookEditor = getActiveNotebookEditor(this.editorService);
      if (activeNotebookEditor) {
        await this.handleNotebookEditor(activeNotebookEditor, context);
      } else {
        this.notify(localize("insertCodeBlock.noActiveEditor", "To insert the code block, open a code editor or notebook editor and set the cursor at the location where to insert the code block."));
      }
    }
    notifyUserAction(this.chatService, context, {
      kind: "insert",
      codeBlockIndex: context.codeBlockIndex,
      totalCharacters: context.code.length
    });
  }
  async handleNotebookEditor(notebookEditor, codeBlockContext) {
    if (notebookEditor.isReadOnly) {
      this.notify(localize("insertCodeBlock.readonlyNotebook", "Cannot insert the code block to read-only notebook editor."));
      return false;
    }
    const focusRange = notebookEditor.getFocus();
    const next = Math.max(focusRange.end - 1, 0);
    insertCell(this.languageService, notebookEditor, next, CellKind.Code, "below", codeBlockContext.code, true);
    return true;
  }
  async handleTextEditor(codeEditor, codeBlockContext) {
    const activeModel = codeEditor.getModel();
    if (isReadOnly(activeModel, this.textFileService)) {
      this.notify(localize("insertCodeBlock.readonly", "Cannot insert the code block to read-only code editor."));
      return false;
    }
    const range = codeEditor.getSelection() ?? new Range(activeModel.getLineCount(), 1, activeModel.getLineCount(), 1);
    const text = reindent(codeBlockContext.code, activeModel, range.startLineNumber);
    const edits = [new ResourceTextEdit(activeModel.uri, { range, text })];
    await this.bulkEditService.apply(edits);
    this.codeEditorService.listCodeEditors().find((editor) => editor.getModel()?.uri.toString() === activeModel.uri.toString())?.focus();
    return true;
  }
  notify(message) {
    this.dialogService.info(message);
  }
};
InsertCodeBlockOperation = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, ITextFileService),
  __decorateParam(2, IBulkEditService),
  __decorateParam(3, ICodeEditorService),
  __decorateParam(4, IChatService),
  __decorateParam(5, ILanguageService),
  __decorateParam(6, IDialogService)
], InsertCodeBlockOperation);
let ApplyCodeBlockOperation = class {
  constructor(editorService, textFileService, chatService, languageService, fileService, dialogService, logService, codeMapperService, progressService, quickInputService, labelService, instantiationService) {
    this.editorService = editorService;
    this.textFileService = textFileService;
    this.chatService = chatService;
    this.languageService = languageService;
    this.fileService = fileService;
    this.dialogService = dialogService;
    this.logService = logService;
    this.codeMapperService = codeMapperService;
    this.progressService = progressService;
    this.quickInputService = quickInputService;
    this.labelService = labelService;
    this.instantiationService = instantiationService;
  }
  async run(context) {
    let activeEditorControl = getEditableActiveCodeEditor(this.editorService);
    const codemapperUri = await this.evaluateURIToUse(context.codemapperUri, activeEditorControl);
    if (!codemapperUri) {
      return;
    }
    if (codemapperUri && !isEqual(activeEditorControl?.getModel().uri, codemapperUri)) {
      try {
        const editorPane = await this.editorService.openEditor({ resource: codemapperUri });
        const codeEditor = getCodeEditor(editorPane?.getControl());
        if (codeEditor && codeEditor.hasModel()) {
          this.tryToRevealCodeBlock(codeEditor, context.code);
          activeEditorControl = codeEditor;
        } else {
          this.notify(localize("applyCodeBlock.errorOpeningFile", "Failed to open {0} in a code editor.", codemapperUri.toString()));
          return;
        }
      } catch (e) {
        this.logService.info("[ApplyCodeBlockOperation] error opening code mapper file", codemapperUri, e);
        return;
      }
    }
    let result = void 0;
    if (activeEditorControl) {
      result = await this.handleTextEditor(activeEditorControl, context.code);
    } else {
      const activeNotebookEditor = getActiveNotebookEditor(this.editorService);
      if (activeNotebookEditor) {
        result = await this.handleNotebookEditor(activeNotebookEditor, context.code);
      } else {
        this.notify(localize("applyCodeBlock.noActiveEditor", "To apply this code block, open a code or notebook editor."));
      }
    }
    notifyUserAction(this.chatService, context, {
      kind: "apply",
      codeBlockIndex: context.codeBlockIndex,
      totalCharacters: context.code.length,
      codeMapper: result?.codeMapper,
      editsProposed: !!result?.editsProposed
    });
  }
  async evaluateURIToUse(resource, activeEditorControl) {
    if (resource && await this.fileService.exists(resource)) {
      return resource;
    }
    const activeEditorOption = activeEditorControl?.getModel().uri ? { label: localize("activeEditor", "Active editor '{0}'", this.labelService.getUriLabel(activeEditorControl.getModel().uri, { relative: true })), id: "activeEditor" } : void 0;
    const untitledEditorOption = { label: localize("newUntitledFile", "New untitled editor"), id: "newUntitledFile" };
    const options = [];
    if (resource) {
      options.push({ label: localize("createFile", "New file '{0}'", this.labelService.getUriLabel(resource, { relative: true })), id: "createFile" });
      options.push(untitledEditorOption);
      if (activeEditorOption) {
        options.push(activeEditorOption);
      }
    } else {
      if (activeEditorOption) {
        options.push(activeEditorOption);
      }
      options.push(untitledEditorOption);
    }
    const selected = options.length > 1 ? await this.quickInputService.pick(options, { placeHolder: localize("selectOption", "Select where to apply the code block") }) : options[0];
    if (selected) {
      switch (selected.id) {
        case "createFile":
          if (resource) {
            try {
              await this.fileService.writeFile(resource, VSBuffer.fromString(""));
            } catch (error) {
              this.notify(localize("applyCodeBlock.fileWriteError", "Failed to create file: {0}", error.message));
              return URI.from({ scheme: "untitled", path: resource.path });
            }
          }
          return resource;
        case "newUntitledFile":
          return URI.from({ scheme: "untitled", path: resource ? resource.path : "Untitled-1" });
        case "activeEditor":
          return activeEditorControl?.getModel().uri;
      }
    }
    return void 0;
  }
  async handleNotebookEditor(notebookEditor, code) {
    if (notebookEditor.isReadOnly) {
      this.notify(localize("applyCodeBlock.readonlyNotebook", "Cannot apply code block to read-only notebook editor."));
      return void 0;
    }
    const focusRange = notebookEditor.getFocus();
    const next = Math.max(focusRange.end - 1, 0);
    insertCell(this.languageService, notebookEditor, next, CellKind.Code, "below", code, true);
    return void 0;
  }
  async handleTextEditor(codeEditor, code) {
    const activeModel = codeEditor.getModel();
    if (isReadOnly(activeModel, this.textFileService)) {
      this.notify(localize("applyCodeBlock.readonly", "Cannot apply code block to read-only file."));
      return void 0;
    }
    const codeBlock = { code, resource: activeModel.uri, markdownBeforeBlock: void 0 };
    const codeMapper = this.codeMapperService.providers[0]?.displayName;
    if (!codeMapper) {
      this.notify(localize("applyCodeBlock.noCodeMapper", "No code mapper available."));
      return void 0;
    }
    let editsProposed = false;
    const cancellationTokenSource = new CancellationTokenSource();
    try {
      const iterable = await this.progressService.withProgress(
        { location: ProgressLocation.Notification, delay: 500, sticky: true, cancellable: true },
        async (progress) => {
          progress.report({ message: localize("applyCodeBlock.progress", "Applying code block using {0}...", codeMapper) });
          const editsIterable = this.getEdits(codeBlock, cancellationTokenSource.token);
          return await this.waitForFirstElement(editsIterable);
        },
        () => cancellationTokenSource.cancel()
      );
      editsProposed = await this.applyWithInlinePreview(iterable, codeEditor, cancellationTokenSource);
    } catch (e) {
      if (!isCancellationError(e)) {
        this.notify(localize("applyCodeBlock.error", "Failed to apply code block: {0}", e.message));
      }
    } finally {
      cancellationTokenSource.dispose();
    }
    return {
      editsProposed,
      codeMapper
    };
  }
  getEdits(codeBlock, token) {
    return new AsyncIterableObject(async (executor) => {
      const request = {
        codeBlocks: [codeBlock]
      };
      const response = {
        textEdit: (target, edit) => {
          executor.emitOne(edit);
        },
        notebookEdit(_resource, _edit) {
        }
      };
      const result = await this.codeMapperService.mapCode(request, response, token);
      if (result?.errorMessage) {
        executor.reject(new Error(result.errorMessage));
      }
    });
  }
  async waitForFirstElement(iterable) {
    const iterator = iterable[Symbol.asyncIterator]();
    let result = await iterator.next();
    if (result.done) {
      return {
        async *[Symbol.asyncIterator]() {
          return;
        }
      };
    }
    return {
      async *[Symbol.asyncIterator]() {
        while (!result.done) {
          yield result.value;
          result = await iterator.next();
        }
      }
    };
  }
  async applyWithInlinePreview(edits, codeEditor, tokenSource) {
    return this.instantiationService.invokeFunction(reviewEdits, codeEditor, edits, tokenSource.token);
  }
  tryToRevealCodeBlock(codeEditor, codeBlock) {
    const match = codeBlock.match(/(\S[^\n]*)\n/);
    if (match && match[1].length > 10) {
      const findMatch = codeEditor.getModel().findNextMatch(match[1], { lineNumber: 1, column: 1 }, false, false, null, false);
      if (findMatch) {
        codeEditor.revealRangeInCenter(findMatch.range);
      }
    }
  }
  notify(message) {
    this.dialogService.info(message);
  }
};
ApplyCodeBlockOperation = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, ITextFileService),
  __decorateParam(2, IChatService),
  __decorateParam(3, ILanguageService),
  __decorateParam(4, IFileService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, ILogService),
  __decorateParam(7, ICodeMapperService),
  __decorateParam(8, IProgressService),
  __decorateParam(9, IQuickInputService),
  __decorateParam(10, ILabelService),
  __decorateParam(11, IInstantiationService)
], ApplyCodeBlockOperation);
function notifyUserAction(chatService, context, action) {
  if (isResponseVM(context.element)) {
    chatService.notifyUserAction({
      agentId: context.element.agent?.id,
      command: context.element.slashCommand?.name,
      sessionId: context.element.sessionId,
      requestId: context.element.requestId,
      result: context.element.result,
      action
    });
  }
}
function getActiveNotebookEditor(editorService) {
  const activeEditorPane = editorService.activeEditorPane;
  if (activeEditorPane?.getId() === NOTEBOOK_EDITOR_ID) {
    const notebookEditor = activeEditorPane.getControl();
    if (notebookEditor.hasModel()) {
      return notebookEditor;
    }
  }
  return void 0;
}
function getEditableActiveCodeEditor(editorService) {
  const activeCodeEditorInNotebook = getActiveNotebookEditor(editorService)?.activeCodeEditor;
  if (activeCodeEditorInNotebook && activeCodeEditorInNotebook.hasTextFocus() && activeCodeEditorInNotebook.hasModel()) {
    return activeCodeEditorInNotebook;
  }
  let codeEditor = getCodeEditor(editorService.activeTextEditorControl);
  if (!codeEditor) {
    for (const editor of editorService.visibleTextEditorControls) {
      codeEditor = getCodeEditor(editor);
      if (codeEditor) {
        break;
      }
    }
  }
  if (!codeEditor || !codeEditor.hasModel()) {
    return void 0;
  }
  return codeEditor;
}
function isReadOnly(model, textFileService) {
  const activeTextModel = textFileService.files.get(model.uri) ?? textFileService.untitled.get(model.uri);
  return !!activeTextModel?.isReadonly();
}
function reindent(codeBlockContent, model, seletionStartLine) {
  const newContent = strings.splitLines(codeBlockContent);
  if (newContent.length === 0) {
    return codeBlockContent;
  }
  const formattingOptions = model.getFormattingOptions();
  const codeIndentLevel = computeIndentation(model.getLineContent(seletionStartLine), formattingOptions.tabSize).level;
  const indents = newContent.map((line) => computeIndentation(line, formattingOptions.tabSize));
  const newContentIndentLevel = indents.reduce((min, indent, index) => {
    if (indent.length !== newContent[index].length) {
      return Math.min(indent.level, min);
    }
    return min;
  }, Number.MAX_VALUE);
  if (newContentIndentLevel === Number.MAX_VALUE || newContentIndentLevel === codeIndentLevel) {
    return codeBlockContent;
  }
  const newLines = [];
  for (let i = 0; i < newContent.length; i++) {
    const { level, length } = indents[i];
    const newLevel = Math.max(0, codeIndentLevel + level - newContentIndentLevel);
    const newIndentation = formattingOptions.insertSpaces ? " ".repeat(formattingOptions.tabSize * newLevel) : "	".repeat(newLevel);
    newLines.push(newIndentation + newContent[i].substring(length));
  }
  return newLines.join("\n");
}
function computeIndentation(line, tabSize) {
  let nSpaces = 0;
  let level = 0;
  let i = 0;
  let length = 0;
  const len = line.length;
  while (i < len) {
    const chCode = line.charCodeAt(i);
    if (chCode === CharCode.Space) {
      nSpaces++;
      if (nSpaces === tabSize) {
        level++;
        nSpaces = 0;
        length = i + 1;
      }
    } else if (chCode === CharCode.Tab) {
      level++;
      nSpaces = 0;
      length = i + 1;
    } else {
      break;
    }
    i++;
  }
  return { level, length };
}
export {
  ApplyCodeBlockOperation,
  InsertCodeBlockOperation,
  computeIndentation
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jb2RlQmxvY2tPcGVyYXRpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCB7IEFzeW5jSXRlcmFibGVPYmplY3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgQ2hhckNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jaGFyQ29kZS5qcyc7XG5pbXBvcnQgeyBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0ICogYXMgc3RyaW5ncyBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBnZXRDb2RlRWRpdG9yLCBJQWN0aXZlQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSUJ1bGtFZGl0U2VydmljZSwgUmVzb3VyY2VUZXh0RWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2J1bGtFZGl0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBUZXh0RWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGV4dEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL3RleHRmaWxlcy5qcyc7XG5pbXBvcnQgeyByZXZpZXdFZGl0cyB9IGZyb20gJy4uLy4uLy4uL2lubGluZUNoYXQvYnJvd3Nlci9pbmxpbmVDaGF0Q29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBpbnNlcnRDZWxsIH0gZnJvbSAnLi4vLi4vLi4vbm90ZWJvb2svYnJvd3Nlci9jb250cm9sbGVyL2NlbGxPcGVyYXRpb25zLmpzJztcbmltcG9ydCB7IElBY3RpdmVOb3RlYm9va0VkaXRvciwgSU5vdGVib29rRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vbm90ZWJvb2svYnJvd3Nlci9ub3RlYm9va0Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgQ2VsbEtpbmQsIE5PVEVCT09LX0VESVRPUl9JRCB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBJQ29kZU1hcHBlckNvZGVCbG9jaywgSUNvZGVNYXBwZXJSZXF1ZXN0LCBJQ29kZU1hcHBlclJlc3BvbnNlLCBJQ29kZU1hcHBlclNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdENvZGVNYXBwZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENoYXRVc2VyQWN0aW9uLCBJQ2hhdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNSZXNwb25zZVZNIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgSUNvZGVCbG9ja0FjdGlvbkNvbnRleHQgfSBmcm9tICcuLi9jb2RlQmxvY2tQYXJ0LmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcblxuZXhwb3J0IGNsYXNzIEluc2VydENvZGVCbG9ja09wZXJhdGlvbiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJVGV4dEZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGV4dEZpbGVTZXJ2aWNlOiBJVGV4dEZpbGVTZXJ2aWNlLFxuXHRcdEBJQnVsa0VkaXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYnVsa0VkaXRTZXJ2aWNlOiBJQnVsa0VkaXRTZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJQ2hhdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0U2VydmljZTogSUNoYXRTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHQpIHtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBydW4oY29udGV4dDogSUNvZGVCbG9ja0FjdGlvbkNvbnRleHQpIHtcblx0XHRjb25zdCBhY3RpdmVFZGl0b3JDb250cm9sID0gZ2V0RWRpdGFibGVBY3RpdmVDb2RlRWRpdG9yKHRoaXMuZWRpdG9yU2VydmljZSk7XG5cdFx0aWYgKGFjdGl2ZUVkaXRvckNvbnRyb2wpIHtcblx0XHRcdGF3YWl0IHRoaXMuaGFuZGxlVGV4dEVkaXRvcihhY3RpdmVFZGl0b3JDb250cm9sLCBjb250ZXh0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgYWN0aXZlTm90ZWJvb2tFZGl0b3IgPSBnZXRBY3RpdmVOb3RlYm9va0VkaXRvcih0aGlzLmVkaXRvclNlcnZpY2UpO1xuXHRcdFx0aWYgKGFjdGl2ZU5vdGVib29rRWRpdG9yKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuaGFuZGxlTm90ZWJvb2tFZGl0b3IoYWN0aXZlTm90ZWJvb2tFZGl0b3IsIGNvbnRleHQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5ub3RpZnkobG9jYWxpemUoJ2luc2VydENvZGVCbG9jay5ub0FjdGl2ZUVkaXRvcicsIFwiVG8gaW5zZXJ0IHRoZSBjb2RlIGJsb2NrLCBvcGVuIGEgY29kZSBlZGl0b3Igb3Igbm90ZWJvb2sgZWRpdG9yIGFuZCBzZXQgdGhlIGN1cnNvciBhdCB0aGUgbG9jYXRpb24gd2hlcmUgdG8gaW5zZXJ0IHRoZSBjb2RlIGJsb2NrLlwiKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdG5vdGlmeVVzZXJBY3Rpb24odGhpcy5jaGF0U2VydmljZSwgY29udGV4dCwge1xuXHRcdFx0a2luZDogJ2luc2VydCcsXG5cdFx0XHRjb2RlQmxvY2tJbmRleDogY29udGV4dC5jb2RlQmxvY2tJbmRleCxcblx0XHRcdHRvdGFsQ2hhcmFjdGVyczogY29udGV4dC5jb2RlLmxlbmd0aFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYW5kbGVOb3RlYm9va0VkaXRvcihub3RlYm9va0VkaXRvcjogSUFjdGl2ZU5vdGVib29rRWRpdG9yLCBjb2RlQmxvY2tDb250ZXh0OiBJQ29kZUJsb2NrQWN0aW9uQ29udGV4dCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmIChub3RlYm9va0VkaXRvci5pc1JlYWRPbmx5KSB7XG5cdFx0XHR0aGlzLm5vdGlmeShsb2NhbGl6ZSgnaW5zZXJ0Q29kZUJsb2NrLnJlYWRvbmx5Tm90ZWJvb2snLCBcIkNhbm5vdCBpbnNlcnQgdGhlIGNvZGUgYmxvY2sgdG8gcmVhZC1vbmx5IG5vdGVib29rIGVkaXRvci5cIikpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBmb2N1c1JhbmdlID0gbm90ZWJvb2tFZGl0b3IuZ2V0Rm9jdXMoKTtcblx0XHRjb25zdCBuZXh0ID0gTWF0aC5tYXgoZm9jdXNSYW5nZS5lbmQgLSAxLCAwKTtcblx0XHRpbnNlcnRDZWxsKHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLCBub3RlYm9va0VkaXRvciwgbmV4dCwgQ2VsbEtpbmQuQ29kZSwgJ2JlbG93JywgY29kZUJsb2NrQ29udGV4dC5jb2RlLCB0cnVlKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaGFuZGxlVGV4dEVkaXRvcihjb2RlRWRpdG9yOiBJQWN0aXZlQ29kZUVkaXRvciwgY29kZUJsb2NrQ29udGV4dDogSUNvZGVCbG9ja0FjdGlvbkNvbnRleHQpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCBhY3RpdmVNb2RlbCA9IGNvZGVFZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAoaXNSZWFkT25seShhY3RpdmVNb2RlbCwgdGhpcy50ZXh0RmlsZVNlcnZpY2UpKSB7XG5cdFx0XHR0aGlzLm5vdGlmeShsb2NhbGl6ZSgnaW5zZXJ0Q29kZUJsb2NrLnJlYWRvbmx5JywgXCJDYW5ub3QgaW5zZXJ0IHRoZSBjb2RlIGJsb2NrIHRvIHJlYWQtb25seSBjb2RlIGVkaXRvci5cIikpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJhbmdlID0gY29kZUVkaXRvci5nZXRTZWxlY3Rpb24oKSA/PyBuZXcgUmFuZ2UoYWN0aXZlTW9kZWwuZ2V0TGluZUNvdW50KCksIDEsIGFjdGl2ZU1vZGVsLmdldExpbmVDb3VudCgpLCAxKTtcblx0XHRjb25zdCB0ZXh0ID0gcmVpbmRlbnQoY29kZUJsb2NrQ29udGV4dC5jb2RlLCBhY3RpdmVNb2RlbCwgcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKTtcblxuXHRcdGNvbnN0IGVkaXRzID0gW25ldyBSZXNvdXJjZVRleHRFZGl0KGFjdGl2ZU1vZGVsLnVyaSwgeyByYW5nZSwgdGV4dCB9KV07XG5cdFx0YXdhaXQgdGhpcy5idWxrRWRpdFNlcnZpY2UuYXBwbHkoZWRpdHMpO1xuXHRcdHRoaXMuY29kZUVkaXRvclNlcnZpY2UubGlzdENvZGVFZGl0b3JzKCkuZmluZChlZGl0b3IgPT4gZWRpdG9yLmdldE1vZGVsKCk/LnVyaS50b1N0cmluZygpID09PSBhY3RpdmVNb2RlbC51cmkudG9TdHJpbmcoKSk/LmZvY3VzKCk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIG5vdGlmeShtZXNzYWdlOiBzdHJpbmcpIHtcblx0XHQvL3RoaXMubm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoeyBzZXZlcml0eTogU2V2ZXJpdHkuSW5mbywgbWVzc2FnZSB9KTtcblx0XHR0aGlzLmRpYWxvZ1NlcnZpY2UuaW5mbyhtZXNzYWdlKTtcblx0fVxufVxuXG50eXBlIElDb21wdXRlRWRpdHNSZXN1bHQgPSB7IHJlYWRvbmx5IGVkaXRzUHJvcG9zZWQ6IGJvb2xlYW47IHJlYWRvbmx5IGNvZGVNYXBwZXI/OiBzdHJpbmcgfTtcblxuZXhwb3J0IGNsYXNzIEFwcGx5Q29kZUJsb2NrT3BlcmF0aW9uIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASVRleHRGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRleHRGaWxlU2VydmljZTogSVRleHRGaWxlU2VydmljZSxcblx0XHRASUNoYXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdFNlcnZpY2U6IElDaGF0U2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUNvZGVNYXBwZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29kZU1hcHBlclNlcnZpY2U6IElDb2RlTWFwcGVyU2VydmljZSxcblx0XHRASVByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2dyZXNzU2VydmljZTogSVByb2dyZXNzU2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuKGNvbnRleHQ6IElDb2RlQmxvY2tBY3Rpb25Db250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bGV0IGFjdGl2ZUVkaXRvckNvbnRyb2wgPSBnZXRFZGl0YWJsZUFjdGl2ZUNvZGVFZGl0b3IodGhpcy5lZGl0b3JTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGNvZGVtYXBwZXJVcmkgPSBhd2FpdCB0aGlzLmV2YWx1YXRlVVJJVG9Vc2UoY29udGV4dC5jb2RlbWFwcGVyVXJpLCBhY3RpdmVFZGl0b3JDb250cm9sKTtcblx0XHRpZiAoIWNvZGVtYXBwZXJVcmkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoY29kZW1hcHBlclVyaSAmJiAhaXNFcXVhbChhY3RpdmVFZGl0b3JDb250cm9sPy5nZXRNb2RlbCgpLnVyaSwgY29kZW1hcHBlclVyaSkpIHtcblx0XHRcdC8vIHJldmVhbCB0aGUgdGFyZ2V0IGZpbGVcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclBhbmUgPSBhd2FpdCB0aGlzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlOiBjb2RlbWFwcGVyVXJpIH0pO1xuXHRcdFx0XHRjb25zdCBjb2RlRWRpdG9yID0gZ2V0Q29kZUVkaXRvcihlZGl0b3JQYW5lPy5nZXRDb250cm9sKCkpO1xuXHRcdFx0XHRpZiAoY29kZUVkaXRvciAmJiBjb2RlRWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0XHR0aGlzLnRyeVRvUmV2ZWFsQ29kZUJsb2NrKGNvZGVFZGl0b3IsIGNvbnRleHQuY29kZSk7XG5cdFx0XHRcdFx0YWN0aXZlRWRpdG9yQ29udHJvbCA9IGNvZGVFZGl0b3I7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5ub3RpZnkobG9jYWxpemUoJ2FwcGx5Q29kZUJsb2NrLmVycm9yT3BlbmluZ0ZpbGUnLCBcIkZhaWxlZCB0byBvcGVuIHswfSBpbiBhIGNvZGUgZWRpdG9yLlwiLCBjb2RlbWFwcGVyVXJpLnRvU3RyaW5nKCkpKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ1tBcHBseUNvZGVCbG9ja09wZXJhdGlvbl0gZXJyb3Igb3BlbmluZyBjb2RlIG1hcHBlciBmaWxlJywgY29kZW1hcHBlclVyaSwgZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgcmVzdWx0OiBJQ29tcHV0ZUVkaXRzUmVzdWx0IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0aWYgKGFjdGl2ZUVkaXRvckNvbnRyb2wpIHtcblx0XHRcdHJlc3VsdCA9IGF3YWl0IHRoaXMuaGFuZGxlVGV4dEVkaXRvcihhY3RpdmVFZGl0b3JDb250cm9sLCBjb250ZXh0LmNvZGUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBhY3RpdmVOb3RlYm9va0VkaXRvciA9IGdldEFjdGl2ZU5vdGVib29rRWRpdG9yKHRoaXMuZWRpdG9yU2VydmljZSk7XG5cdFx0XHRpZiAoYWN0aXZlTm90ZWJvb2tFZGl0b3IpIHtcblx0XHRcdFx0cmVzdWx0ID0gYXdhaXQgdGhpcy5oYW5kbGVOb3RlYm9va0VkaXRvcihhY3RpdmVOb3RlYm9va0VkaXRvciwgY29udGV4dC5jb2RlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMubm90aWZ5KGxvY2FsaXplKCdhcHBseUNvZGVCbG9jay5ub0FjdGl2ZUVkaXRvcicsIFwiVG8gYXBwbHkgdGhpcyBjb2RlIGJsb2NrLCBvcGVuIGEgY29kZSBvciBub3RlYm9vayBlZGl0b3IuXCIpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0bm90aWZ5VXNlckFjdGlvbih0aGlzLmNoYXRTZXJ2aWNlLCBjb250ZXh0LCB7XG5cdFx0XHRraW5kOiAnYXBwbHknLFxuXHRcdFx0Y29kZUJsb2NrSW5kZXg6IGNvbnRleHQuY29kZUJsb2NrSW5kZXgsXG5cdFx0XHR0b3RhbENoYXJhY3RlcnM6IGNvbnRleHQuY29kZS5sZW5ndGgsXG5cdFx0XHRjb2RlTWFwcGVyOiByZXN1bHQ/LmNvZGVNYXBwZXIsXG5cdFx0XHRlZGl0c1Byb3Bvc2VkOiAhIXJlc3VsdD8uZWRpdHNQcm9wb3NlZFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBldmFsdWF0ZVVSSVRvVXNlKHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQsIGFjdGl2ZUVkaXRvckNvbnRyb2w6IElBY3RpdmVDb2RlRWRpdG9yIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxVUkkgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAocmVzb3VyY2UgJiYgYXdhaXQgdGhpcy5maWxlU2VydmljZS5leGlzdHMocmVzb3VyY2UpKSB7XG5cdFx0XHRyZXR1cm4gcmVzb3VyY2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aXZlRWRpdG9yT3B0aW9uID0gYWN0aXZlRWRpdG9yQ29udHJvbD8uZ2V0TW9kZWwoKS51cmkgPyB7IGxhYmVsOiBsb2NhbGl6ZSgnYWN0aXZlRWRpdG9yJywgXCJBY3RpdmUgZWRpdG9yICd7MH0nXCIsIHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGFjdGl2ZUVkaXRvckNvbnRyb2wuZ2V0TW9kZWwoKS51cmksIHsgcmVsYXRpdmU6IHRydWUgfSkpLCBpZDogJ2FjdGl2ZUVkaXRvcicgfSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCB1bnRpdGxlZEVkaXRvck9wdGlvbiA9IHsgbGFiZWw6IGxvY2FsaXplKCduZXdVbnRpdGxlZEZpbGUnLCBcIk5ldyB1bnRpdGxlZCBlZGl0b3JcIiksIGlkOiAnbmV3VW50aXRsZWRGaWxlJyB9O1xuXG5cdFx0Y29uc3Qgb3B0aW9ucyA9IFtdO1xuXHRcdGlmIChyZXNvdXJjZSkge1xuXHRcdFx0Ly8gY29kZSBibG9jayBoYWQgYW4gVVJJLCBidXQgaXQgZG9lc24ndCBleGlzdFxuXHRcdFx0b3B0aW9ucy5wdXNoKHsgbGFiZWw6IGxvY2FsaXplKCdjcmVhdGVGaWxlJywgXCJOZXcgZmlsZSAnezB9J1wiLCB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChyZXNvdXJjZSwgeyByZWxhdGl2ZTogdHJ1ZSB9KSksIGlkOiAnY3JlYXRlRmlsZScgfSk7XG5cdFx0XHRvcHRpb25zLnB1c2godW50aXRsZWRFZGl0b3JPcHRpb24pO1xuXHRcdFx0aWYgKGFjdGl2ZUVkaXRvck9wdGlvbikge1xuXHRcdFx0XHRvcHRpb25zLnB1c2goYWN0aXZlRWRpdG9yT3B0aW9uKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gY29kZSBibG9jayBoYWQgbm8gVVJJXG5cdFx0XHRpZiAoYWN0aXZlRWRpdG9yT3B0aW9uKSB7XG5cdFx0XHRcdG9wdGlvbnMucHVzaChhY3RpdmVFZGl0b3JPcHRpb24pO1xuXHRcdFx0fVxuXHRcdFx0b3B0aW9ucy5wdXNoKHVudGl0bGVkRWRpdG9yT3B0aW9uKTtcblx0XHR9XG5cblx0XHRjb25zdCBzZWxlY3RlZCA9IG9wdGlvbnMubGVuZ3RoID4gMSA/IGF3YWl0IHRoaXMucXVpY2tJbnB1dFNlcnZpY2UucGljayhvcHRpb25zLCB7IHBsYWNlSG9sZGVyOiBsb2NhbGl6ZSgnc2VsZWN0T3B0aW9uJywgXCJTZWxlY3Qgd2hlcmUgdG8gYXBwbHkgdGhlIGNvZGUgYmxvY2tcIikgfSkgOiBvcHRpb25zWzBdO1xuXHRcdGlmIChzZWxlY3RlZCkge1xuXHRcdFx0c3dpdGNoIChzZWxlY3RlZC5pZCkge1xuXHRcdFx0XHRjYXNlICdjcmVhdGVGaWxlJzpcblx0XHRcdFx0XHRpZiAocmVzb3VyY2UpIHtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHJlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCcnKSk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0XHR0aGlzLm5vdGlmeShsb2NhbGl6ZSgnYXBwbHlDb2RlQmxvY2suZmlsZVdyaXRlRXJyb3InLCBcIkZhaWxlZCB0byBjcmVhdGUgZmlsZTogezB9XCIsIGVycm9yLm1lc3NhZ2UpKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIFVSSS5mcm9tKHsgc2NoZW1lOiAndW50aXRsZWQnLCBwYXRoOiByZXNvdXJjZS5wYXRoIH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gcmVzb3VyY2U7XG5cdFx0XHRcdGNhc2UgJ25ld1VudGl0bGVkRmlsZSc6XG5cdFx0XHRcdFx0cmV0dXJuIFVSSS5mcm9tKHsgc2NoZW1lOiAndW50aXRsZWQnLCBwYXRoOiByZXNvdXJjZSA/IHJlc291cmNlLnBhdGggOiAnVW50aXRsZWQtMScgfSk7XG5cdFx0XHRcdGNhc2UgJ2FjdGl2ZUVkaXRvcic6XG5cdFx0XHRcdFx0cmV0dXJuIGFjdGl2ZUVkaXRvckNvbnRyb2w/LmdldE1vZGVsKCkudXJpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYW5kbGVOb3RlYm9va0VkaXRvcihub3RlYm9va0VkaXRvcjogSUFjdGl2ZU5vdGVib29rRWRpdG9yLCBjb2RlOiBzdHJpbmcpOiBQcm9taXNlPElDb21wdXRlRWRpdHNSZXN1bHQgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAobm90ZWJvb2tFZGl0b3IuaXNSZWFkT25seSkge1xuXHRcdFx0dGhpcy5ub3RpZnkobG9jYWxpemUoJ2FwcGx5Q29kZUJsb2NrLnJlYWRvbmx5Tm90ZWJvb2snLCBcIkNhbm5vdCBhcHBseSBjb2RlIGJsb2NrIHRvIHJlYWQtb25seSBub3RlYm9vayBlZGl0b3IuXCIpKTtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IGZvY3VzUmFuZ2UgPSBub3RlYm9va0VkaXRvci5nZXRGb2N1cygpO1xuXHRcdGNvbnN0IG5leHQgPSBNYXRoLm1heChmb2N1c1JhbmdlLmVuZCAtIDEsIDApO1xuXHRcdGluc2VydENlbGwodGhpcy5sYW5ndWFnZVNlcnZpY2UsIG5vdGVib29rRWRpdG9yLCBuZXh0LCBDZWxsS2luZC5Db2RlLCAnYmVsb3cnLCBjb2RlLCB0cnVlKTtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYW5kbGVUZXh0RWRpdG9yKGNvZGVFZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yLCBjb2RlOiBzdHJpbmcpOiBQcm9taXNlPElDb21wdXRlRWRpdHNSZXN1bHQgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBhY3RpdmVNb2RlbCA9IGNvZGVFZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAoaXNSZWFkT25seShhY3RpdmVNb2RlbCwgdGhpcy50ZXh0RmlsZVNlcnZpY2UpKSB7XG5cdFx0XHR0aGlzLm5vdGlmeShsb2NhbGl6ZSgnYXBwbHlDb2RlQmxvY2sucmVhZG9ubHknLCBcIkNhbm5vdCBhcHBseSBjb2RlIGJsb2NrIHRvIHJlYWQtb25seSBmaWxlLlwiKSk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvZGVCbG9jayA9IHsgY29kZSwgcmVzb3VyY2U6IGFjdGl2ZU1vZGVsLnVyaSwgbWFya2Rvd25CZWZvcmVCbG9jazogdW5kZWZpbmVkIH07XG5cblx0XHRjb25zdCBjb2RlTWFwcGVyID0gdGhpcy5jb2RlTWFwcGVyU2VydmljZS5wcm92aWRlcnNbMF0/LmRpc3BsYXlOYW1lO1xuXHRcdGlmICghY29kZU1hcHBlcikge1xuXHRcdFx0dGhpcy5ub3RpZnkobG9jYWxpemUoJ2FwcGx5Q29kZUJsb2NrLm5vQ29kZU1hcHBlcicsIFwiTm8gY29kZSBtYXBwZXIgYXZhaWxhYmxlLlwiKSk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRsZXQgZWRpdHNQcm9wb3NlZCA9IGZhbHNlO1xuXHRcdGNvbnN0IGNhbmNlbGxhdGlvblRva2VuU291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGl0ZXJhYmxlID0gYXdhaXQgdGhpcy5wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzPEFzeW5jSXRlcmFibGU8VGV4dEVkaXRbXT4+KFxuXHRcdFx0XHR7IGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLk5vdGlmaWNhdGlvbiwgZGVsYXk6IDUwMCwgc3RpY2t5OiB0cnVlLCBjYW5jZWxsYWJsZTogdHJ1ZSB9LFxuXHRcdFx0XHRhc3luYyBwcm9ncmVzcyA9PiB7XG5cdFx0XHRcdFx0cHJvZ3Jlc3MucmVwb3J0KHsgbWVzc2FnZTogbG9jYWxpemUoJ2FwcGx5Q29kZUJsb2NrLnByb2dyZXNzJywgXCJBcHBseWluZyBjb2RlIGJsb2NrIHVzaW5nIHswfS4uLlwiLCBjb2RlTWFwcGVyKSB9KTtcblx0XHRcdFx0XHRjb25zdCBlZGl0c0l0ZXJhYmxlID0gdGhpcy5nZXRFZGl0cyhjb2RlQmxvY2ssIGNhbmNlbGxhdGlvblRva2VuU291cmNlLnRva2VuKTtcblx0XHRcdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy53YWl0Rm9yRmlyc3RFbGVtZW50KGVkaXRzSXRlcmFibGUpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHQoKSA9PiBjYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5jYW5jZWwoKVxuXHRcdFx0KTtcblx0XHRcdGVkaXRzUHJvcG9zZWQgPSBhd2FpdCB0aGlzLmFwcGx5V2l0aElubGluZVByZXZpZXcoaXRlcmFibGUsIGNvZGVFZGl0b3IsIGNhbmNlbGxhdGlvblRva2VuU291cmNlKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRpZiAoIWlzQ2FuY2VsbGF0aW9uRXJyb3IoZSkpIHtcblx0XHRcdFx0dGhpcy5ub3RpZnkobG9jYWxpemUoJ2FwcGx5Q29kZUJsb2NrLmVycm9yJywgXCJGYWlsZWQgdG8gYXBwbHkgY29kZSBibG9jazogezB9XCIsIGUubWVzc2FnZSkpO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRjYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGVkaXRzUHJvcG9zZWQsXG5cdFx0XHRjb2RlTWFwcGVyXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RWRpdHMoY29kZUJsb2NrOiBJQ29kZU1hcHBlckNvZGVCbG9jaywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogQXN5bmNJdGVyYWJsZTxUZXh0RWRpdFtdPiB7XG5cdFx0cmV0dXJuIG5ldyBBc3luY0l0ZXJhYmxlT2JqZWN0PFRleHRFZGl0W10+KGFzeW5jIGV4ZWN1dG9yID0+IHtcblx0XHRcdGNvbnN0IHJlcXVlc3Q6IElDb2RlTWFwcGVyUmVxdWVzdCA9IHtcblx0XHRcdFx0Y29kZUJsb2NrczogW2NvZGVCbG9ja11cblx0XHRcdH07XG5cdFx0XHRjb25zdCByZXNwb25zZTogSUNvZGVNYXBwZXJSZXNwb25zZSA9IHtcblx0XHRcdFx0dGV4dEVkaXQ6ICh0YXJnZXQ6IFVSSSwgZWRpdDogVGV4dEVkaXRbXSkgPT4ge1xuXHRcdFx0XHRcdGV4ZWN1dG9yLmVtaXRPbmUoZWRpdCk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdG5vdGVib29rRWRpdChfcmVzb3VyY2UsIF9lZGl0KSB7XG5cdFx0XHRcdFx0Ly9cblx0XHRcdFx0fSxcblx0XHRcdH07XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNvZGVNYXBwZXJTZXJ2aWNlLm1hcENvZGUocmVxdWVzdCwgcmVzcG9uc2UsIHRva2VuKTtcblx0XHRcdGlmIChyZXN1bHQ/LmVycm9yTWVzc2FnZSkge1xuXHRcdFx0XHRleGVjdXRvci5yZWplY3QobmV3IEVycm9yKHJlc3VsdC5lcnJvck1lc3NhZ2UpKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgd2FpdEZvckZpcnN0RWxlbWVudDxUPihpdGVyYWJsZTogQXN5bmNJdGVyYWJsZTxUPik6IFByb21pc2U8QXN5bmNJdGVyYWJsZTxUPj4ge1xuXHRcdGNvbnN0IGl0ZXJhdG9yID0gaXRlcmFibGVbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCk7XG5cdFx0bGV0IHJlc3VsdCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcblxuXHRcdGlmIChyZXN1bHQuZG9uZSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0YXN5bmMgKltTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRhc3luYyAqW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcblx0XHRcdFx0d2hpbGUgKCFyZXN1bHQuZG9uZSkge1xuXHRcdFx0XHRcdHlpZWxkIHJlc3VsdC52YWx1ZTtcblx0XHRcdFx0XHRyZXN1bHQgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBhcHBseVdpdGhJbmxpbmVQcmV2aWV3KGVkaXRzOiBBc3luY0l0ZXJhYmxlPFRleHRFZGl0W10+LCBjb2RlRWRpdG9yOiBJQWN0aXZlQ29kZUVkaXRvciwgdG9rZW5Tb3VyY2U6IENhbmNlbGxhdGlvblRva2VuU291cmNlKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24ocmV2aWV3RWRpdHMsIGNvZGVFZGl0b3IsIGVkaXRzLCB0b2tlblNvdXJjZS50b2tlbik7XG5cdH1cblxuXHRwcml2YXRlIHRyeVRvUmV2ZWFsQ29kZUJsb2NrKGNvZGVFZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yLCBjb2RlQmxvY2s6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IG1hdGNoID0gY29kZUJsb2NrLm1hdGNoKC8oXFxTW15cXG5dKilcXG4vKTsgLy8gc3Vic3RyaW5nIHRoYXQgc3RhcnRzIHdpdGggYSBub24td2hpdGVzcGFjZSBjaGFyYWN0ZXIgYW5kIGVuZHMgd2l0aCBhIG5ld2xpbmVcblx0XHRpZiAobWF0Y2ggJiYgbWF0Y2hbMV0ubGVuZ3RoID4gMTApIHtcblx0XHRcdGNvbnN0IGZpbmRNYXRjaCA9IGNvZGVFZGl0b3IuZ2V0TW9kZWwoKS5maW5kTmV4dE1hdGNoKG1hdGNoWzFdLCB7IGxpbmVOdW1iZXI6IDEsIGNvbHVtbjogMSB9LCBmYWxzZSwgZmFsc2UsIG51bGwsIGZhbHNlKTtcblx0XHRcdGlmIChmaW5kTWF0Y2gpIHtcblx0XHRcdFx0Y29kZUVkaXRvci5yZXZlYWxSYW5nZUluQ2VudGVyKGZpbmRNYXRjaC5yYW5nZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBub3RpZnkobWVzc2FnZTogc3RyaW5nKSB7XG5cdFx0Ly90aGlzLm5vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHsgc2V2ZXJpdHk6IFNldmVyaXR5LkluZm8sIG1lc3NhZ2UgfSk7XG5cdFx0dGhpcy5kaWFsb2dTZXJ2aWNlLmluZm8obWVzc2FnZSk7XG5cdH1cblxufVxuXG5mdW5jdGlvbiBub3RpZnlVc2VyQWN0aW9uKGNoYXRTZXJ2aWNlOiBJQ2hhdFNlcnZpY2UsIGNvbnRleHQ6IElDb2RlQmxvY2tBY3Rpb25Db250ZXh0LCBhY3Rpb246IENoYXRVc2VyQWN0aW9uKSB7XG5cdGlmIChpc1Jlc3BvbnNlVk0oY29udGV4dC5lbGVtZW50KSkge1xuXHRcdGNoYXRTZXJ2aWNlLm5vdGlmeVVzZXJBY3Rpb24oe1xuXHRcdFx0YWdlbnRJZDogY29udGV4dC5lbGVtZW50LmFnZW50Py5pZCxcblx0XHRcdGNvbW1hbmQ6IGNvbnRleHQuZWxlbWVudC5zbGFzaENvbW1hbmQ/Lm5hbWUsXG5cdFx0XHRzZXNzaW9uSWQ6IGNvbnRleHQuZWxlbWVudC5zZXNzaW9uSWQsXG5cdFx0XHRyZXF1ZXN0SWQ6IGNvbnRleHQuZWxlbWVudC5yZXF1ZXN0SWQsXG5cdFx0XHRyZXN1bHQ6IGNvbnRleHQuZWxlbWVudC5yZXN1bHQsXG5cdFx0XHRhY3Rpb25cblx0XHR9KTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRBY3RpdmVOb3RlYm9va0VkaXRvcihlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSk6IElBY3RpdmVOb3RlYm9va0VkaXRvciB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGFjdGl2ZUVkaXRvclBhbmUgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmU7XG5cdGlmIChhY3RpdmVFZGl0b3JQYW5lPy5nZXRJZCgpID09PSBOT1RFQk9PS19FRElUT1JfSUQpIHtcblx0XHRjb25zdCBub3RlYm9va0VkaXRvciA9IGFjdGl2ZUVkaXRvclBhbmUuZ2V0Q29udHJvbCgpIGFzIElOb3RlYm9va0VkaXRvcjtcblx0XHRpZiAobm90ZWJvb2tFZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuIG5vdGVib29rRWRpdG9yO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBnZXRFZGl0YWJsZUFjdGl2ZUNvZGVFZGl0b3IoZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UpOiBJQWN0aXZlQ29kZUVkaXRvciB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGFjdGl2ZUNvZGVFZGl0b3JJbk5vdGVib29rID0gZ2V0QWN0aXZlTm90ZWJvb2tFZGl0b3IoZWRpdG9yU2VydmljZSk/LmFjdGl2ZUNvZGVFZGl0b3I7XG5cdGlmIChhY3RpdmVDb2RlRWRpdG9ySW5Ob3RlYm9vayAmJiBhY3RpdmVDb2RlRWRpdG9ySW5Ob3RlYm9vay5oYXNUZXh0Rm9jdXMoKSAmJiBhY3RpdmVDb2RlRWRpdG9ySW5Ob3RlYm9vay5oYXNNb2RlbCgpKSB7XG5cdFx0cmV0dXJuIGFjdGl2ZUNvZGVFZGl0b3JJbk5vdGVib29rO1xuXHR9XG5cblx0bGV0IGNvZGVFZGl0b3IgPSBnZXRDb2RlRWRpdG9yKGVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wpO1xuXHRpZiAoIWNvZGVFZGl0b3IpIHtcblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBlZGl0b3JTZXJ2aWNlLnZpc2libGVUZXh0RWRpdG9yQ29udHJvbHMpIHtcblx0XHRcdGNvZGVFZGl0b3IgPSBnZXRDb2RlRWRpdG9yKGVkaXRvcik7XG5cdFx0XHRpZiAoY29kZUVkaXRvcikge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRpZiAoIWNvZGVFZGl0b3IgfHwgIWNvZGVFZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblx0cmV0dXJuIGNvZGVFZGl0b3I7XG59XG5cbmZ1bmN0aW9uIGlzUmVhZE9ubHkobW9kZWw6IElUZXh0TW9kZWwsIHRleHRGaWxlU2VydmljZTogSVRleHRGaWxlU2VydmljZSk6IGJvb2xlYW4ge1xuXHQvLyBDaGVjayBpZiBtb2RlbCBpcyBlZGl0YWJsZSwgY3VycmVudGx5IG9ubHkgc3VwcG9ydCB1bnRpdGxlZCBhbmQgdGV4dCBmaWxlXG5cdGNvbnN0IGFjdGl2ZVRleHRNb2RlbCA9IHRleHRGaWxlU2VydmljZS5maWxlcy5nZXQobW9kZWwudXJpKSA/PyB0ZXh0RmlsZVNlcnZpY2UudW50aXRsZWQuZ2V0KG1vZGVsLnVyaSk7XG5cdHJldHVybiAhIWFjdGl2ZVRleHRNb2RlbD8uaXNSZWFkb25seSgpO1xufVxuXG5mdW5jdGlvbiByZWluZGVudChjb2RlQmxvY2tDb250ZW50OiBzdHJpbmcsIG1vZGVsOiBJVGV4dE1vZGVsLCBzZWxldGlvblN0YXJ0TGluZTogbnVtYmVyKTogc3RyaW5nIHtcblx0Y29uc3QgbmV3Q29udGVudCA9IHN0cmluZ3Muc3BsaXRMaW5lcyhjb2RlQmxvY2tDb250ZW50KTtcblx0aWYgKG5ld0NvbnRlbnQubGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuIGNvZGVCbG9ja0NvbnRlbnQ7XG5cdH1cblxuXHRjb25zdCBmb3JtYXR0aW5nT3B0aW9ucyA9IG1vZGVsLmdldEZvcm1hdHRpbmdPcHRpb25zKCk7XG5cdGNvbnN0IGNvZGVJbmRlbnRMZXZlbCA9IGNvbXB1dGVJbmRlbnRhdGlvbihtb2RlbC5nZXRMaW5lQ29udGVudChzZWxldGlvblN0YXJ0TGluZSksIGZvcm1hdHRpbmdPcHRpb25zLnRhYlNpemUpLmxldmVsO1xuXG5cdGNvbnN0IGluZGVudHMgPSBuZXdDb250ZW50Lm1hcChsaW5lID0+IGNvbXB1dGVJbmRlbnRhdGlvbihsaW5lLCBmb3JtYXR0aW5nT3B0aW9ucy50YWJTaXplKSk7XG5cblx0Ly8gZmluZCB0aGUgc21hbGxlc3QgaW5kZW50IGxldmVsIGluIHRoZSBjb2RlIGJsb2NrXG5cdGNvbnN0IG5ld0NvbnRlbnRJbmRlbnRMZXZlbCA9IGluZGVudHMucmVkdWNlPG51bWJlcj4oKG1pbiwgaW5kZW50LCBpbmRleCkgPT4ge1xuXHRcdGlmIChpbmRlbnQubGVuZ3RoICE9PSBuZXdDb250ZW50W2luZGV4XS5sZW5ndGgpIHsgLy8gaWdub3JlIGVtcHR5IGxpbmVzXG5cdFx0XHRyZXR1cm4gTWF0aC5taW4oaW5kZW50LmxldmVsLCBtaW4pO1xuXHRcdH1cblx0XHRyZXR1cm4gbWluO1xuXHR9LCBOdW1iZXIuTUFYX1ZBTFVFKTtcblxuXHRpZiAobmV3Q29udGVudEluZGVudExldmVsID09PSBOdW1iZXIuTUFYX1ZBTFVFIHx8IG5ld0NvbnRlbnRJbmRlbnRMZXZlbCA9PT0gY29kZUluZGVudExldmVsKSB7XG5cdFx0Ly8gYWxsIGxpbmVzIGFyZSBlbXB0eSBvciB0aGUgaW5kZW50IGlzIGFscmVhZHkgY29ycmVjdFxuXHRcdHJldHVybiBjb2RlQmxvY2tDb250ZW50O1xuXHR9XG5cdGNvbnN0IG5ld0xpbmVzID0gW107XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbmV3Q29udGVudC5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IHsgbGV2ZWwsIGxlbmd0aCB9ID0gaW5kZW50c1tpXTtcblx0XHRjb25zdCBuZXdMZXZlbCA9IE1hdGgubWF4KDAsIGNvZGVJbmRlbnRMZXZlbCArIGxldmVsIC0gbmV3Q29udGVudEluZGVudExldmVsKTtcblx0XHRjb25zdCBuZXdJbmRlbnRhdGlvbiA9IGZvcm1hdHRpbmdPcHRpb25zLmluc2VydFNwYWNlcyA/ICcgJy5yZXBlYXQoZm9ybWF0dGluZ09wdGlvbnMudGFiU2l6ZSAqIG5ld0xldmVsKSA6ICdcXHQnLnJlcGVhdChuZXdMZXZlbCk7XG5cdFx0bmV3TGluZXMucHVzaChuZXdJbmRlbnRhdGlvbiArIG5ld0NvbnRlbnRbaV0uc3Vic3RyaW5nKGxlbmd0aCkpO1xuXHR9XG5cdHJldHVybiBuZXdMaW5lcy5qb2luKCdcXG4nKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zOlxuICogIC0gbGV2ZWw6IHRoZSBsaW5lJ3MgdGhlIGlkZW50IGxldmVsIGluIHRhYnNcbiAqICAtIGxlbmd0aDogdGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIG9mIHRoZSBsZWFkaW5nIHdoaXRlc3BhY2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXB1dGVJbmRlbnRhdGlvbihsaW5lOiBzdHJpbmcsIHRhYlNpemU6IG51bWJlcik6IHsgbGV2ZWw6IG51bWJlcjsgbGVuZ3RoOiBudW1iZXIgfSB7XG5cdGxldCBuU3BhY2VzID0gMDtcblx0bGV0IGxldmVsID0gMDtcblx0bGV0IGkgPSAwO1xuXHRsZXQgbGVuZ3RoID0gMDtcblx0Y29uc3QgbGVuID0gbGluZS5sZW5ndGg7XG5cdHdoaWxlIChpIDwgbGVuKSB7XG5cdFx0Y29uc3QgY2hDb2RlID0gbGluZS5jaGFyQ29kZUF0KGkpO1xuXHRcdGlmIChjaENvZGUgPT09IENoYXJDb2RlLlNwYWNlKSB7XG5cdFx0XHRuU3BhY2VzKys7XG5cdFx0XHRpZiAoblNwYWNlcyA9PT0gdGFiU2l6ZSkge1xuXHRcdFx0XHRsZXZlbCsrO1xuXHRcdFx0XHRuU3BhY2VzID0gMDtcblx0XHRcdFx0bGVuZ3RoID0gaSArIDE7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChjaENvZGUgPT09IENoYXJDb2RlLlRhYikge1xuXHRcdFx0bGV2ZWwrKztcblx0XHRcdG5TcGFjZXMgPSAwO1xuXHRcdFx0bGVuZ3RoID0gaSArIDE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHRpKys7XG5cdH1cblx0cmV0dXJuIHsgbGV2ZWwsIGxlbmd0aCB9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFJQSxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGdCQUFnQjtBQUN6QixTQUE0QiwrQkFBK0I7QUFDM0QsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxlQUFlO0FBQ3hCLFlBQVksYUFBYTtBQUN6QixTQUFTLFdBQVc7QUFDcEIsU0FBUyxxQkFBd0M7QUFDakQsU0FBUyxrQkFBa0Isd0JBQXdCO0FBQ25ELFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsYUFBYTtBQUV0QixTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGtCQUFrQix3QkFBd0I7QUFDbkQsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyxVQUFVLDBCQUEwQjtBQUM3QyxTQUF3RSwwQkFBMEI7QUFDbEcsU0FBeUIsb0JBQW9CO0FBQzdDLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsNkJBQTZCO0FBRS9CLElBQU0sMkJBQU4sTUFBK0I7QUFBQSxFQUNyQyxZQUNrQyxlQUNFLGlCQUNBLGlCQUNFLG1CQUNOLGFBQ0ksaUJBQ0YsZUFDaEM7QUFQZ0M7QUFDRTtBQUNBO0FB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
