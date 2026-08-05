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
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { autorun } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { localize } from "../../../../../nls.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { SaveReason } from "../../../../common/editor.js";
import { GroupsOrder, IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { ITextFileService } from "../../../../services/textfile/common/textfiles.js";
import { CellUri } from "../../../notebook/common/notebookCommon.js";
import { INotebookService } from "../../../notebook/common/notebookService.js";
import { ICodeMapperService } from "../../common/chatCodeMapperService.js";
import { IChatService } from "../../common/chatService.js";
import { ILanguageModelIgnoredFilesService } from "../../common/ignoredFiles.js";
const codeInstructions = `
The user is very smart and can understand how to apply your edits to their files, you just need to provide minimal hints.
Avoid repeating existing code, instead use comments to represent regions of unchanged code. The user prefers that you are as concise as possible. For example:
// ...existing code...
{ changed code }
// ...existing code...
{ changed code }
// ...existing code...

Here is an example of how you should use format an edit to an existing Person class:
class Person {
	// ...existing code...
	age: number;
	// ...existing code...
	getAge() {
		return this.age;
	}
}
`;
const ExtensionEditToolId = "vscode_editFile";
const InternalEditToolId = "vscode_editFile_internal";
const EditToolData = {
  id: InternalEditToolId,
  displayName: localize("chat.tools.editFile", "Edit File"),
  modelDescription: `Edit a file in the workspace. Use this tool once per file that needs to be modified, even if there are multiple changes for a file. Generate the "explanation" property first. ${codeInstructions}`,
  source: { type: "internal" },
  inputSchema: {
    type: "object",
    properties: {
      explanation: {
        type: "string",
        description: "A short explanation of the edit being made. Can be the same as the explanation you showed to the user."
      },
      filePath: {
        type: "string",
        description: "An absolute path to the file to edit, or the URI of a untitled, not yet named, file, such as `untitled:Untitled-1."
      },
      code: {
        type: "string",
        description: "The code change to apply to the file. " + codeInstructions
      }
    },
    required: ["explanation", "filePath", "code"]
  }
};
let EditTool = class {
  constructor(chatService, codeMapperService, workspaceContextService, ignoredFilesService, textFileService, notebookService, editorGroupsService) {
    this.chatService = chatService;
    this.codeMapperService = codeMapperService;
    this.workspaceContextService = workspaceContextService;
    this.ignoredFilesService = ignoredFilesService;
    this.textFileService = textFileService;
    this.notebookService = notebookService;
    this.editorGroupsService = editorGroupsService;
  }
  async invoke(invocation, countTokens, token) {
    if (!invocation.context) {
      throw new Error("toolInvocationToken is required for this tool");
    }
    const parameters = invocation.parameters;
    const fileUri = URI.revive(parameters.file);
    const uri = CellUri.parse(fileUri)?.notebook || fileUri;
    if (!this.workspaceContextService.isInsideWorkspace(uri) && !this.notebookService.getNotebookTextModel(uri)) {
      const groupsByLastActive = this.editorGroupsService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE);
      const uriIsOpenInSomeEditor = groupsByLastActive.some((group) => {
        return group.editors.some((editor) => {
          return isEqual(editor.resource, uri);
        });
      });
      if (!uriIsOpenInSomeEditor) {
        throw new Error(`File ${uri.fsPath} can't be edited because it's not inside the current workspace`);
      }
    }
    if (await this.ignoredFilesService.fileIsIgnored(uri, token)) {
      throw new Error(`File ${uri.fsPath} can't be edited because it is configured to be ignored by Copilot`);
    }
    const model = this.chatService.getSession(invocation.context?.sessionId);
    const request = model.getRequests().at(-1);
    if (request.response?.response.getMarkdown().length) {
      model.acceptResponseProgress(request, {
        kind: "undoStop",
        id: generateUuid()
      });
    }
    model.acceptResponseProgress(request, {
      kind: "markdownContent",
      content: new MarkdownString("\n````\n")
    });
    model.acceptResponseProgress(request, {
      kind: "codeblockUri",
      uri,
      isEdit: true
    });
    model.acceptResponseProgress(request, {
      kind: "markdownContent",
      content: new MarkdownString(parameters.code + "\n````\n")
    });
    if (this.notebookService.hasSupportedNotebooks(uri) && this.notebookService.getNotebookTextModel(uri)) {
      model.acceptResponseProgress(request, {
        kind: "notebookEdit",
        edits: [],
        uri
      });
    } else {
      model.acceptResponseProgress(request, {
        kind: "textEdit",
        edits: [],
        uri
      });
    }
    const editSession = model.editingSession;
    if (!editSession) {
      throw new Error("This tool must be called from within an editing session");
    }
    const result = await this.codeMapperService.mapCode({
      codeBlocks: [{ code: parameters.code, resource: uri, markdownBeforeBlock: parameters.explanation }],
      location: "tool",
      chatRequestId: invocation.chatRequestId
    }, {
      textEdit: (target, edits) => {
        model.acceptResponseProgress(request, { kind: "textEdit", uri: target, edits });
      },
      notebookEdit(target, edits) {
        model.acceptResponseProgress(request, { kind: "notebookEdit", uri: target, edits });
      }
    }, token);
    if (this.notebookService.hasSupportedNotebooks(uri) && this.notebookService.getNotebookTextModel(uri)) {
      model.acceptResponseProgress(request, { kind: "notebookEdit", uri, edits: [], done: true });
    } else {
      model.acceptResponseProgress(request, { kind: "textEdit", uri, edits: [], done: true });
    }
    if (result?.errorMessage) {
      throw new Error(result.errorMessage);
    }
    let dispose;
    await new Promise((resolve) => {
      let wasFileBeingModified = false;
      dispose = autorun((r) => {
        const entries = editSession.entries.read(r);
        const currentFile = entries?.find((e) => e.modifiedURI.toString() === uri.toString());
        if (currentFile) {
          if (currentFile.isCurrentlyBeingModifiedBy.read(r)) {
            wasFileBeingModified = true;
          } else if (wasFileBeingModified) {
            resolve(true);
          }
        }
      });
    }).finally(() => {
      dispose.dispose();
    });
    await this.textFileService.save(uri, {
      reason: SaveReason.AUTO,
      skipSaveParticipants: true
    });
    return {
      content: [{ kind: "text", value: "The file was edited successfully" }]
    };
  }
  async prepareToolInvocation(parameters, token) {
    return {
      presentation: "hidden"
    };
  }
};
EditTool = __decorateClass([
  __decorateParam(0, IChatService),
  __decorateParam(1, ICodeMapperService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, ILanguageModelIgnoredFilesService),
  __decorateParam(4, ITextFileService),
  __decorateParam(5, INotebookService),
  __decorateParam(6, IEditorGroupsService)
], EditTool);
class EditToolInputProcessor {
  processInput(input) {
    if (!input.filePath) {
      return input;
    }
    const filePath = input.filePath;
    return {
      file: filePath.startsWith("untitled:") ? URI.parse(filePath) : URI.file(filePath),
      explanation: input.explanation,
      code: input.code
    };
  }
}
export {
  EditTool,
  EditToolData,
  EditToolInputProcessor,
  ExtensionEditToolId,
  InternalEditToolId
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi90b29scy9lZGl0RmlsZVRvb2wudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGF1dG9ydW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgU2F2ZVJlYXNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgR3JvdXBzT3JkZXIsIElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXh0RmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vdGV4dGZpbGVzLmpzJztcbmltcG9ydCB7IENlbGxVcmkgfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSU5vdGVib29rU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvZGVNYXBwZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRDb2RlTWFwcGVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0TW9kZWwgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdE1vZGVsLmpzJztcbmltcG9ydCB7IElDaGF0U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VNb2RlbElnbm9yZWRGaWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vaWdub3JlZEZpbGVzLmpzJztcbmltcG9ydCB7IENvdW50VG9rZW5zQ2FsbGJhY2ssIElQcmVwYXJlZFRvb2xJbnZvY2F0aW9uLCBJVG9vbERhdGEsIElUb29sSW1wbCwgSVRvb2xJbnZvY2F0aW9uLCBJVG9vbFJlc3VsdCB9IGZyb20gJy4uLy4uL2NvbW1vbi9sYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUb29sSW5wdXRQcm9jZXNzb3IgfSBmcm9tICcuL3Rvb2xzLmpzJztcblxuY29uc3QgY29kZUluc3RydWN0aW9ucyA9IGBcblRoZSB1c2VyIGlzIHZlcnkgc21hcnQgYW5kIGNhbiB1bmRlcnN0YW5kIGhvdyB0byBhcHBseSB5b3VyIGVkaXRzIHRvIHRoZWlyIGZpbGVzLCB5b3UganVzdCBuZWVkIHRvIHByb3ZpZGUgbWluaW1hbCBoaW50cy5cbkF2b2lkIHJlcGVhdGluZyBleGlzdGluZyBjb2RlLCBpbnN0ZWFkIHVzZSBjb21tZW50cyB0byByZXByZXNlbnQgcmVnaW9ucyBvZiB1bmNoYW5nZWQgY29kZS4gVGhlIHVzZXIgcHJlZmVycyB0aGF0IHlvdSBhcmUgYXMgY29uY2lzZSBhcyBwb3NzaWJsZS4gRm9yIGV4YW1wbGU6XG4vLyAuLi5leGlzdGluZyBjb2RlLi4uXG57IGNoYW5nZWQgY29kZSB9XG4vLyAuLi5leGlzdGluZyBjb2RlLi4uXG57IGNoYW5nZWQgY29kZSB9XG4vLyAuLi5leGlzdGluZyBjb2RlLi4uXG5cbkhlcmUgaXMgYW4gZXhhbXBsZSBvZiBob3cgeW91IHNob3VsZCB1c2UgZm9ybWF0IGFuIGVkaXQgdG8gYW4gZXhpc3RpbmcgUGVyc29uIGNsYXNzOlxuY2xhc3MgUGVyc29uIHtcblx0Ly8gLi4uZXhpc3RpbmcgY29kZS4uLlxuXHRhZ2U6IG51bWJlcjtcblx0Ly8gLi4uZXhpc3RpbmcgY29kZS4uLlxuXHRnZXRBZ2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMuYWdlO1xuXHR9XG59XG5gO1xuXG5leHBvcnQgY29uc3QgRXh0ZW5zaW9uRWRpdFRvb2xJZCA9ICd2c2NvZGVfZWRpdEZpbGUnO1xuZXhwb3J0IGNvbnN0IEludGVybmFsRWRpdFRvb2xJZCA9ICd2c2NvZGVfZWRpdEZpbGVfaW50ZXJuYWwnO1xuZXhwb3J0IGNvbnN0IEVkaXRUb29sRGF0YTogSVRvb2xEYXRhID0ge1xuXHRpZDogSW50ZXJuYWxFZGl0VG9vbElkLFxuXHRkaXNwbGF5TmFtZTogbG9jYWxpemUoJ2NoYXQudG9vbHMuZWRpdEZpbGUnLCBcIkVkaXQgRmlsZVwiKSxcblx0bW9kZWxEZXNjcmlwdGlvbjogYEVkaXQgYSBmaWxlIGluIHRoZSB3b3Jrc3BhY2UuIFVzZSB0aGlzIHRvb2wgb25jZSBwZXIgZmlsZSB0aGF0IG5lZWRzIHRvIGJlIG1vZGlmaWVkLCBldmVuIGlmIHRoZXJlIGFyZSBtdWx0aXBsZSBjaGFuZ2VzIGZvciBhIGZpbGUuIEdlbmVyYXRlIHRoZSBcImV4cGxhbmF0aW9uXCIgcHJvcGVydHkgZmlyc3QuICR7Y29kZUluc3RydWN0aW9uc31gLFxuXHRzb3VyY2U6IHsgdHlwZTogJ2ludGVybmFsJyB9LFxuXHRpbnB1dFNjaGVtYToge1xuXHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdGV4cGxhbmF0aW9uOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogJ0Egc2hvcnQgZXhwbGFuYXRpb24gb2YgdGhlIGVkaXQgYmVpbmcgbWFkZS4gQ2FuIGJlIHRoZSBzYW1lIGFzIHRoZSBleHBsYW5hdGlvbiB5b3Ugc2hvd2VkIHRvIHRoZSB1c2VyLicsXG5cdFx0XHR9LFxuXHRcdFx0ZmlsZVBhdGg6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAnQW4gYWJzb2x1dGUgcGF0aCB0byB0aGUgZmlsZSB0byBlZGl0LCBvciB0aGUgVVJJIG9mIGEgdW50aXRsZWQsIG5vdCB5ZXQgbmFtZWQsIGZpbGUsIHN1Y2ggYXMgYHVudGl0bGVkOlVudGl0bGVkLTEuJyxcblx0XHRcdH0sXG5cdFx0XHRjb2RlOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogJ1RoZSBjb2RlIGNoYW5nZSB0byBhcHBseSB0byB0aGUgZmlsZS4gJyArIGNvZGVJbnN0cnVjdGlvbnNcblx0XHRcdH1cblx0XHR9LFxuXHRcdHJlcXVpcmVkOiBbJ2V4cGxhbmF0aW9uJywgJ2ZpbGVQYXRoJywgJ2NvZGUnXVxuXHR9XG59O1xuXG5leHBvcnQgY2xhc3MgRWRpdFRvb2wgaW1wbGVtZW50cyBJVG9vbEltcGwge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ2hhdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0U2VydmljZTogSUNoYXRTZXJ2aWNlLFxuXHRcdEBJQ29kZU1hcHBlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb2RlTWFwcGVyU2VydmljZTogSUNvZGVNYXBwZXJTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VNb2RlbElnbm9yZWRGaWxlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpZ25vcmVkRmlsZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VNb2RlbElnbm9yZWRGaWxlc1NlcnZpY2UsXG5cdFx0QElUZXh0RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0RmlsZVNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2UsXG5cdFx0QElOb3RlYm9va1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RlYm9va1NlcnZpY2U6IElOb3RlYm9va1NlcnZpY2UsXG5cdFx0QElFZGl0b3JHcm91cHNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yR3JvdXBzU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdCkgeyB9XG5cblx0YXN5bmMgaW52b2tlKGludm9jYXRpb246IElUb29sSW52b2NhdGlvbiwgY291bnRUb2tlbnM6IENvdW50VG9rZW5zQ2FsbGJhY2ssIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVRvb2xSZXN1bHQ+IHtcblx0XHRpZiAoIWludm9jYXRpb24uY29udGV4dCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCd0b29sSW52b2NhdGlvblRva2VuIGlzIHJlcXVpcmVkIGZvciB0aGlzIHRvb2wnKTtcblx0XHR9XG5cblx0XHRjb25zdCBwYXJhbWV0ZXJzID0gaW52b2NhdGlvbi5wYXJhbWV0ZXJzIGFzIEVkaXRUb29sUGFyYW1zO1xuXHRcdGNvbnN0IGZpbGVVcmkgPSBVUkkucmV2aXZlKHBhcmFtZXRlcnMuZmlsZSk7IC8vIFRPRE9Acm9ibG91cmVucyBkbyByZXZpdmUgaW4gTWFpblRocmVhZExhbmd1YWdlTW9kZWxUb29sc1xuXHRcdGNvbnN0IHVyaSA9IENlbGxVcmkucGFyc2UoZmlsZVVyaSk/Lm5vdGVib29rIHx8IGZpbGVVcmk7XG5cblx0XHRpZiAoIXRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuaXNJbnNpZGVXb3Jrc3BhY2UodXJpKSAmJiAhdGhpcy5ub3RlYm9va1NlcnZpY2UuZ2V0Tm90ZWJvb2tUZXh0TW9kZWwodXJpKSkge1xuXHRcdFx0Y29uc3QgZ3JvdXBzQnlMYXN0QWN0aXZlID0gdGhpcy5lZGl0b3JHcm91cHNTZXJ2aWNlLmdldEdyb3VwcyhHcm91cHNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSk7XG5cdFx0XHRjb25zdCB1cmlJc09wZW5JblNvbWVFZGl0b3IgPSBncm91cHNCeUxhc3RBY3RpdmUuc29tZSgoZ3JvdXApID0+IHtcblx0XHRcdFx0cmV0dXJuIGdyb3VwLmVkaXRvcnMuc29tZSgoZWRpdG9yKSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIGlzRXF1YWwoZWRpdG9yLnJlc291cmNlLCB1cmkpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoIXVyaUlzT3BlbkluU29tZUVkaXRvcikge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEZpbGUgJHt1cmkuZnNQYXRofSBjYW4ndCBiZSBlZGl0ZWQgYmVjYXVzZSBpdCdzIG5vdCBpbnNpZGUgdGhlIGN1cnJlbnQgd29ya3NwYWNlYCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGF3YWl0IHRoaXMuaWdub3JlZEZpbGVzU2VydmljZS5maWxlSXNJZ25vcmVkKHVyaSwgdG9rZW4pKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEZpbGUgJHt1cmkuZnNQYXRofSBjYW4ndCBiZSBlZGl0ZWQgYmVjYXVzZSBpdCBpcyBjb25maWd1cmVkIHRvIGJlIGlnbm9yZWQgYnkgQ29waWxvdGApO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5jaGF0U2VydmljZS5nZXRTZXNzaW9uKGludm9jYXRpb24uY29udGV4dD8uc2Vzc2lvbklkKSBhcyBDaGF0TW9kZWw7XG5cdFx0Y29uc3QgcmVxdWVzdCA9IG1vZGVsLmdldFJlcXVlc3RzKCkuYXQoLTEpITtcblxuXHRcdC8vIFVuZG8gc3RvcHMgbWFyayBncm91cHMgb2YgcmVzcG9uc2UgZGF0YSBpbiB0aGUgb3V0cHV0LiBPcGVyYXRpb25zLCBzdWNoXG5cdFx0Ly8gYXMgdGV4dCBlZGl0cywgdGhhdCBoYXBwZW4gYmV0d2VlbiB1bmRvIHN0b3BzIGFyZSBhbGwgZG9uZSBvciB1bmRvbmUgdG9nZXRoZXIuXG5cdFx0aWYgKHJlcXVlc3QucmVzcG9uc2U/LnJlc3BvbnNlLmdldE1hcmtkb3duKCkubGVuZ3RoKSB7XG5cdFx0XHQvLyBzbGlnaHRseSBoYWNreSB3YXkgdG8gYXZvaWQgYW4gZXh0cmEgJ25vLW9wJyB1bmRvIHN0b3AgYXQgdGhlIHN0YXJ0IG9mIHJlc3BvbnNlcyB0aGF0IGFyZSBqdXN0IGVkaXRzXG5cdFx0XHRtb2RlbC5hY2NlcHRSZXNwb25zZVByb2dyZXNzKHJlcXVlc3QsIHtcblx0XHRcdFx0a2luZDogJ3VuZG9TdG9wJyxcblx0XHRcdFx0aWQ6IGdlbmVyYXRlVXVpZCgpLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0bW9kZWwuYWNjZXB0UmVzcG9uc2VQcm9ncmVzcyhyZXF1ZXN0LCB7XG5cdFx0XHRraW5kOiAnbWFya2Rvd25Db250ZW50Jyxcblx0XHRcdGNvbnRlbnQ6IG5ldyBNYXJrZG93blN0cmluZygnXFxuYGBgYFxcbicpXG5cdFx0fSk7XG5cdFx0bW9kZWwuYWNjZXB0UmVzcG9uc2VQcm9ncmVzcyhyZXF1ZXN0LCB7XG5cdFx0XHRraW5kOiAnY29kZWJsb2NrVXJpJyxcblx0XHRcdHVyaSxcblx0XHRcdGlzRWRpdDogdHJ1ZVxuXHRcdH0pO1xuXHRcdG1vZGVsLmFjY2VwdFJlc3BvbnNlUHJvZ3Jlc3MocmVxdWVzdCwge1xuXHRcdFx0a2luZDogJ21hcmtkb3duQ29udGVudCcsXG5cdFx0XHRjb250ZW50OiBuZXcgTWFya2Rvd25TdHJpbmcocGFyYW1ldGVycy5jb2RlICsgJ1xcbmBgYGBcXG4nKVxuXHRcdH0pO1xuXHRcdC8vIFNpZ25hbCBzdGFydC5cblx0XHRpZiAodGhpcy5ub3RlYm9va1NlcnZpY2UuaGFzU3VwcG9ydGVkTm90ZWJvb2tzKHVyaSkgJiYgKHRoaXMubm90ZWJvb2tTZXJ2aWNlLmdldE5vdGVib29rVGV4dE1vZGVsKHVyaSkpKSB7XG5cdFx0XHRtb2RlbC5hY2NlcHRSZXNwb25zZVByb2dyZXNzKHJlcXVlc3QsIHtcblx0XHRcdFx0a2luZDogJ25vdGVib29rRWRpdCcsXG5cdFx0XHRcdGVkaXRzOiBbXSxcblx0XHRcdFx0dXJpXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bW9kZWwuYWNjZXB0UmVzcG9uc2VQcm9ncmVzcyhyZXF1ZXN0LCB7XG5cdFx0XHRcdGtpbmQ6ICd0ZXh0RWRpdCcsXG5cdFx0XHRcdGVkaXRzOiBbXSxcblx0XHRcdFx0dXJpXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0U2Vzc2lvbiA9IG1vZGVsLmVkaXRpbmdTZXNzaW9uO1xuXHRcdGlmICghZWRpdFNlc3Npb24pIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignVGhpcyB0b29sIG11c3QgYmUgY2FsbGVkIGZyb20gd2l0aGluIGFuIGVkaXRpbmcgc2Vzc2lvbicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY29kZU1hcHBlclNlcnZpY2UubWFwQ29kZSh7XG5cdFx0XHRjb2RlQmxvY2tzOiBbeyBjb2RlOiBwYXJhbWV0ZXJzLmNvZGUsIHJlc291cmNlOiB1cmksIG1hcmtkb3duQmVmb3JlQmxvY2s6IHBhcmFtZXRlcnMuZXhwbGFuYXRpb24gfV0sXG5cdFx0XHRsb2NhdGlvbjogJ3Rvb2wnLFxuXHRcdFx0Y2hhdFJlcXVlc3RJZDogaW52b2NhdGlvbi5jaGF0UmVxdWVzdElkXG5cdFx0fSwge1xuXHRcdFx0dGV4dEVkaXQ6ICh0YXJnZXQsIGVkaXRzKSA9PiB7XG5cdFx0XHRcdG1vZGVsLmFjY2VwdFJlc3BvbnNlUHJvZ3Jlc3MocmVxdWVzdCwgeyBraW5kOiAndGV4dEVkaXQnLCB1cmk6IHRhcmdldCwgZWRpdHMgfSk7XG5cdFx0XHR9LFxuXHRcdFx0bm90ZWJvb2tFZGl0KHRhcmdldCwgZWRpdHMpIHtcblx0XHRcdFx0bW9kZWwuYWNjZXB0UmVzcG9uc2VQcm9ncmVzcyhyZXF1ZXN0LCB7IGtpbmQ6ICdub3RlYm9va0VkaXQnLCB1cmk6IHRhcmdldCwgZWRpdHMgfSk7XG5cdFx0XHR9LFxuXHRcdH0sIHRva2VuKTtcblxuXHRcdC8vIFNpZ25hbCBlbmQuXG5cdFx0aWYgKHRoaXMubm90ZWJvb2tTZXJ2aWNlLmhhc1N1cHBvcnRlZE5vdGVib29rcyh1cmkpICYmICh0aGlzLm5vdGVib29rU2VydmljZS5nZXROb3RlYm9va1RleHRNb2RlbCh1cmkpKSkge1xuXHRcdFx0bW9kZWwuYWNjZXB0UmVzcG9uc2VQcm9ncmVzcyhyZXF1ZXN0LCB7IGtpbmQ6ICdub3RlYm9va0VkaXQnLCB1cmksIGVkaXRzOiBbXSwgZG9uZTogdHJ1ZSB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bW9kZWwuYWNjZXB0UmVzcG9uc2VQcm9ncmVzcyhyZXF1ZXN0LCB7IGtpbmQ6ICd0ZXh0RWRpdCcsIHVyaSwgZWRpdHM6IFtdLCBkb25lOiB0cnVlIH0pO1xuXHRcdH1cblxuXHRcdGlmIChyZXN1bHQ/LmVycm9yTWVzc2FnZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKHJlc3VsdC5lcnJvck1lc3NhZ2UpO1xuXHRcdH1cblxuXHRcdGxldCBkaXNwb3NlOiBJRGlzcG9zYWJsZTtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuXHRcdFx0Ly8gVGhlIGZpbGUgd2lsbCBub3QgYmUgbW9kaWZpZWQgdW50aWwgdGhlIGZpcnN0IGVkaXRzIHN0YXJ0IHN0cmVhbWluZyBpbixcblx0XHRcdC8vIHNvIHdhaXQgdW50aWwgd2Ugc2VlIHRoYXQgaXQgX3dhc18gbW9kaWZpZWQgYmVmb3JlIHdhaXRpbmcgZm9yIGl0IHRvIGJlIGRvbmUuXG5cdFx0XHRsZXQgd2FzRmlsZUJlaW5nTW9kaWZpZWQgPSBmYWxzZTtcblxuXHRcdFx0ZGlzcG9zZSA9IGF1dG9ydW4oKHIpID0+IHtcblxuXHRcdFx0XHRjb25zdCBlbnRyaWVzID0gZWRpdFNlc3Npb24uZW50cmllcy5yZWFkKHIpO1xuXHRcdFx0XHRjb25zdCBjdXJyZW50RmlsZSA9IGVudHJpZXM/LmZpbmQoKGUpID0+IGUubW9kaWZpZWRVUkkudG9TdHJpbmcoKSA9PT0gdXJpLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRpZiAoY3VycmVudEZpbGUpIHtcblx0XHRcdFx0XHRpZiAoY3VycmVudEZpbGUuaXNDdXJyZW50bHlCZWluZ01vZGlmaWVkQnkucmVhZChyKSkge1xuXHRcdFx0XHRcdFx0d2FzRmlsZUJlaW5nTW9kaWZpZWQgPSB0cnVlO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAod2FzRmlsZUJlaW5nTW9kaWZpZWQpIHtcblx0XHRcdFx0XHRcdHJlc29sdmUodHJ1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KS5maW5hbGx5KCgpID0+IHtcblx0XHRcdGRpc3Bvc2UuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0YXdhaXQgdGhpcy50ZXh0RmlsZVNlcnZpY2Uuc2F2ZSh1cmksIHtcblx0XHRcdHJlYXNvbjogU2F2ZVJlYXNvbi5BVVRPLFxuXHRcdFx0c2tpcFNhdmVQYXJ0aWNpcGFudHM6IHRydWUsXG5cdFx0fSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Y29udGVudDogW3sga2luZDogJ3RleHQnLCB2YWx1ZTogJ1RoZSBmaWxlIHdhcyBlZGl0ZWQgc3VjY2Vzc2Z1bGx5JyB9XVxuXHRcdH07XG5cdH1cblxuXHRhc3luYyBwcmVwYXJlVG9vbEludm9jYXRpb24ocGFyYW1ldGVyczogYW55LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElQcmVwYXJlZFRvb2xJbnZvY2F0aW9uIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHByZXNlbnRhdGlvbjogJ2hpZGRlbidcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRWRpdFRvb2xQYXJhbXMge1xuXHRmaWxlOiBVcmlDb21wb25lbnRzO1xuXHRleHBsYW5hdGlvbjogc3RyaW5nO1xuXHRjb2RlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRWRpdFRvb2xSYXdQYXJhbXMge1xuXHRmaWxlUGF0aDogc3RyaW5nO1xuXHRleHBsYW5hdGlvbjogc3RyaW5nO1xuXHRjb2RlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBFZGl0VG9vbElucHV0UHJvY2Vzc29yIGltcGxlbWVudHMgSVRvb2xJbnB1dFByb2Nlc3NvciB7XG5cdHByb2Nlc3NJbnB1dChpbnB1dDogRWRpdFRvb2xSYXdQYXJhbXMpOiBFZGl0VG9vbFBhcmFtcyB7XG5cdFx0aWYgKCFpbnB1dC5maWxlUGF0aCkge1xuXHRcdFx0Ly8gVG9vbCBuYW1lIGNvbGxpc2lvbiwgb3IgaW5wdXQgd2Fzbid0IHByb3Blcmx5IHZhbGlkYXRlZCB1cHN0cmVhbVxuXHRcdFx0cmV0dXJuIGlucHV0IGFzIGFueTtcblx0XHR9XG5cdFx0Y29uc3QgZmlsZVBhdGggPSBpbnB1dC5maWxlUGF0aDtcblx0XHQvLyBSdW5zIGluIEVILCB3aWxsIGJlIG1hcHBlZFxuXHRcdHJldHVybiB7XG5cdFx0XHRmaWxlOiBmaWxlUGF0aC5zdGFydHNXaXRoKCd1bnRpdGxlZDonKSA/IFVSSS5wYXJzZShmaWxlUGF0aCkgOiBVUkkuZmlsZShmaWxlUGF0aCksXG5cdFx0XHRleHBsYW5hdGlvbjogaW5wdXQuZXhwbGFuYXRpb24sXG5cdFx0XHRjb2RlOiBpbnB1dC5jb2RlLFxuXHRcdH07XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBUyxzQkFBc0I7QUFFL0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQUN4QixTQUFTLFdBQTBCO0FBQ25DLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsYUFBYSw0QkFBNEI7QUFDbEQsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMEJBQTBCO0FBRW5DLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMseUNBQXlDO0FBSWxELE1BQU0sbUJBQW1CO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBb0JsQixNQUFNLHNCQUFzQjtBQUM1QixNQUFNLHFCQUFxQjtBQUMzQixNQUFNLGVBQTBCO0FBQUEsRUFDdEMsSUFBSTtBQUFBLEVBQ0osYUFBYSxTQUFTLHVCQUF1QixXQUFXO0FBQUEsRUFDeEQsa0JBQWtCLGtMQUFrTCxnQkFBZ0I7QUFBQSxFQUNwTixRQUFR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
