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
import { URI } from "../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { localize } from "../../../../../nls.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { SaveReason } from "../../../../common/editor.js";
import { ITextFileService } from "../../../../services/textfile/common/textfiles.js";
import { CellUri } from "../../../notebook/common/notebookCommon.js";
import { INotebookService } from "../../../notebook/common/notebookService.js";
import { ICodeMapperService } from "../chatCodeMapperService.js";
import { IChatEditingService } from "../chatEditingService.js";
import { IChatService } from "../chatService.js";
import { ILanguageModelIgnoredFilesService } from "../ignoredFiles.js";
const codeInstructions = `
The user is very smart and can understand how to insert cells to their new Notebook files
`;
const ExtensionEditToolId = "vscode_insert_notebook_cells";
const InternalEditToolId = "vscode_insert_notebook_cells_internal";
const EditToolData = {
  id: InternalEditToolId,
  displayName: localize("chat.tools.editFile", "Edit File"),
  modelDescription: `Insert cells into a new notebook n the workspace. Use this tool once per file that needs to be modified, even if there are multiple changes for a file. Generate the "explanation" property first. ${codeInstructions}`,
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
      cells: {
        type: "array",
        description: "The cells to insert to apply to the file. " + codeInstructions
      }
    },
    required: ["explanation", "filePath", "code"]
  }
};
let EditTool = class {
  constructor(chatService, chatEditingService, codeMapperService, workspaceContextService, ignoredFilesService, textFileService, notebookService) {
    this.chatService = chatService;
    this.chatEditingService = chatEditingService;
    this.codeMapperService = codeMapperService;
    this.workspaceContextService = workspaceContextService;
    this.ignoredFilesService = ignoredFilesService;
    this.textFileService = textFileService;
    this.notebookService = notebookService;
  }
  async invoke(invocation, countTokens, token) {
    if (!invocation.context) {
      throw new Error("toolInvocationToken is required for this tool");
    }
    const parameters = invocation.parameters;
    const uri = URI.revive(parameters.file);
    if (!this.workspaceContextService.isInsideWorkspace(uri)) {
      throw new Error(`File ${uri.fsPath} can't be edited because it's not inside the current workspace`);
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
      uri
    });
    model.acceptResponseProgress(request, {
      kind: "markdownContent",
      content: new MarkdownString(parameters.code + "\n````\n")
    });
    const notebookUri = CellUri.parse(uri)?.notebook || uri;
    if (this.notebookService.hasSupportedNotebooks(notebookUri) && this.notebookService.getNotebookTextModel(notebookUri)) {
      model.acceptResponseProgress(request, {
        kind: "notebookEdit",
        edits: [],
        uri: notebookUri
      });
    } else {
      model.acceptResponseProgress(request, {
        kind: "textEdit",
        edits: [],
        uri
      });
    }
    const editSession = this.chatEditingService.getEditingSession(model.sessionId);
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
    if (this.notebookService.hasSupportedNotebooks(notebookUri) && this.notebookService.getNotebookTextModel(notebookUri)) {
      model.acceptResponseProgress(request, { kind: "notebookEdit", uri: notebookUri, edits: [], done: true });
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
  __decorateParam(1, IChatEditingService),
  __decorateParam(2, ICodeMapperService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, ILanguageModelIgnoredFilesService),
  __decorateParam(5, ITextFileService),
  __decorateParam(6, INotebookService)
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi90b29scy9pbnNlcnROb3RlYm9va0NlbGxzVG9vbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1biB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgU2F2ZVJlYXNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSVRleHRGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3RleHRmaWxlL2NvbW1vbi90ZXh0ZmlsZXMuanMnO1xuaW1wb3J0IHsgQ2VsbFVyaSB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vbm90ZWJvb2svY29tbW9uL25vdGVib29rU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29kZU1hcHBlclNlcnZpY2UgfSBmcm9tICcuLi9jaGF0Q29kZU1hcHBlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRFZGl0aW5nU2VydmljZSB9IGZyb20gJy4uL2NoYXRFZGl0aW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0TW9kZWwgfSBmcm9tICcuLi9jaGF0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUNoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vY2hhdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlTW9kZWxJZ25vcmVkRmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vaWdub3JlZEZpbGVzLmpzJztcbmltcG9ydCB7IENvdW50VG9rZW5zQ2FsbGJhY2ssIElQcmVwYXJlZFRvb2xJbnZvY2F0aW9uLCBJVG9vbERhdGEsIElUb29sSW1wbCwgSVRvb2xJbnZvY2F0aW9uLCBJVG9vbFJlc3VsdCB9IGZyb20gJy4uL2xhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRvb2xJbnB1dFByb2Nlc3NvciB9IGZyb20gJy4vdG9vbHMuanMnO1xuXG5jb25zdCBjb2RlSW5zdHJ1Y3Rpb25zID0gYFxuVGhlIHVzZXIgaXMgdmVyeSBzbWFydCBhbmQgY2FuIHVuZGVyc3RhbmQgaG93IHRvIGluc2VydCBjZWxscyB0byB0aGVpciBuZXcgTm90ZWJvb2sgZmlsZXNcbmA7XG5cbmV4cG9ydCBjb25zdCBFeHRlbnNpb25FZGl0VG9vbElkID0gJ3ZzY29kZV9pbnNlcnRfbm90ZWJvb2tfY2VsbHMnO1xuZXhwb3J0IGNvbnN0IEludGVybmFsRWRpdFRvb2xJZCA9ICd2c2NvZGVfaW5zZXJ0X25vdGVib29rX2NlbGxzX2ludGVybmFsJztcbmV4cG9ydCBjb25zdCBFZGl0VG9vbERhdGE6IElUb29sRGF0YSA9IHtcblx0aWQ6IEludGVybmFsRWRpdFRvb2xJZCxcblx0ZGlzcGxheU5hbWU6IGxvY2FsaXplKCdjaGF0LnRvb2xzLmVkaXRGaWxlJywgXCJFZGl0IEZpbGVcIiksXG5cdG1vZGVsRGVzY3JpcHRpb246IGBJbnNlcnQgY2VsbHMgaW50byBhIG5ldyBub3RlYm9vayBuIHRoZSB3b3Jrc3BhY2UuIFVzZSB0aGlzIHRvb2wgb25jZSBwZXIgZmlsZSB0aGF0IG5lZWRzIHRvIGJlIG1vZGlmaWVkLCBldmVuIGlmIHRoZXJlIGFyZSBtdWx0aXBsZSBjaGFuZ2VzIGZvciBhIGZpbGUuIEdlbmVyYXRlIHRoZSBcImV4cGxhbmF0aW9uXCIgcHJvcGVydHkgZmlyc3QuICR7Y29kZUluc3RydWN0aW9uc31gLFxuXHRzb3VyY2U6IHsgdHlwZTogJ2ludGVybmFsJyB9LFxuXHRpbnB1dFNjaGVtYToge1xuXHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdGV4cGxhbmF0aW9uOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogJ0Egc2hvcnQgZXhwbGFuYXRpb24gb2YgdGhlIGVkaXQgYmVpbmcgbWFkZS4gQ2FuIGJlIHRoZSBzYW1lIGFzIHRoZSBleHBsYW5hdGlvbiB5b3Ugc2hvd2VkIHRvIHRoZSB1c2VyLicsXG5cdFx0XHR9LFxuXHRcdFx0ZmlsZVBhdGg6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAnQW4gYWJzb2x1dGUgcGF0aCB0byB0aGUgZmlsZSB0byBlZGl0LCBvciB0aGUgVVJJIG9mIGEgdW50aXRsZWQsIG5vdCB5ZXQgbmFtZWQsIGZpbGUsIHN1Y2ggYXMgYHVudGl0bGVkOlVudGl0bGVkLTEuJyxcblx0XHRcdH0sXG5cdFx0XHRjZWxsczoge1xuXHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogJ1RoZSBjZWxscyB0byBpbnNlcnQgdG8gYXBwbHkgdG8gdGhlIGZpbGUuICcgKyBjb2RlSW5zdHJ1Y3Rpb25zXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRyZXF1aXJlZDogWydleHBsYW5hdGlvbicsICdmaWxlUGF0aCcsICdjb2RlJ11cblx0fVxufTtcblxuZXhwb3J0IGNsYXNzIEVkaXRUb29sIGltcGxlbWVudHMgSVRvb2xJbXBsIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNoYXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdFNlcnZpY2U6IElDaGF0U2VydmljZSxcblx0XHRASUNoYXRFZGl0aW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNoYXRFZGl0aW5nU2VydmljZTogSUNoYXRFZGl0aW5nU2VydmljZSxcblx0XHRASUNvZGVNYXBwZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29kZU1hcHBlclNlcnZpY2U6IElDb2RlTWFwcGVyU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUxhbmd1YWdlTW9kZWxJZ25vcmVkRmlsZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaWdub3JlZEZpbGVzU2VydmljZTogSUxhbmd1YWdlTW9kZWxJZ25vcmVkRmlsZXNTZXJ2aWNlLFxuXHRcdEBJVGV4dEZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGV4dEZpbGVTZXJ2aWNlOiBJVGV4dEZpbGVTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90ZWJvb2tTZXJ2aWNlOiBJTm90ZWJvb2tTZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdGFzeW5jIGludm9rZShpbnZvY2F0aW9uOiBJVG9vbEludm9jYXRpb24sIGNvdW50VG9rZW5zOiBDb3VudFRva2Vuc0NhbGxiYWNrLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElUb29sUmVzdWx0PiB7XG5cdFx0aWYgKCFpbnZvY2F0aW9uLmNvbnRleHQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcigndG9vbEludm9jYXRpb25Ub2tlbiBpcyByZXF1aXJlZCBmb3IgdGhpcyB0b29sJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGFyYW1ldGVycyA9IGludm9jYXRpb24ucGFyYW1ldGVycyBhcyBFZGl0VG9vbFBhcmFtcztcblx0XHRjb25zdCB1cmkgPSBVUkkucmV2aXZlKHBhcmFtZXRlcnMuZmlsZSk7IC8vIFRPRE9Acm9ibG91cmVucyBkbyByZXZpdmUgaW4gTWFpblRocmVhZExhbmd1YWdlTW9kZWxUb29sc1xuXHRcdGlmICghdGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5pc0luc2lkZVdvcmtzcGFjZSh1cmkpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEZpbGUgJHt1cmkuZnNQYXRofSBjYW4ndCBiZSBlZGl0ZWQgYmVjYXVzZSBpdCdzIG5vdCBpbnNpZGUgdGhlIGN1cnJlbnQgd29ya3NwYWNlYCk7XG5cdFx0fVxuXG5cdFx0aWYgKGF3YWl0IHRoaXMuaWdub3JlZEZpbGVzU2VydmljZS5maWxlSXNJZ25vcmVkKHVyaSwgdG9rZW4pKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEZpbGUgJHt1cmkuZnNQYXRofSBjYW4ndCBiZSBlZGl0ZWQgYmVjYXVzZSBpdCBpcyBjb25maWd1cmVkIHRvIGJlIGlnbm9yZWQgYnkgQ29waWxvdGApO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5jaGF0U2VydmljZS5nZXRTZXNzaW9uKGludm9jYXRpb24uY29udGV4dD8uc2Vzc2lvbklkKSBhcyBDaGF0TW9kZWw7XG5cdFx0Y29uc3QgcmVxdWVzdCA9IG1vZGVsLmdldFJlcXVlc3RzKCkuYXQoLTEpITtcblxuXHRcdC8vIFVuZG8gc3RvcHMgbWFyayBncm91cHMgb2YgcmVzcG9uc2UgZGF0YSBpbiB0aGUgb3V0cHV0LiBPcGVyYXRpb25zLCBzdWNoXG5cdFx0Ly8gYXMgdGV4dCBlZGl0cywgdGhhdCBoYXBwZW4gYmV0d2VlbiB1bmRvIHN0b3BzIGFyZSBhbGwgZG9uZSBvciB1bmRvbmUgdG9nZXRoZXIuXG5cdFx0aWYgKHJlcXVlc3QucmVzcG9uc2U/LnJlc3BvbnNlLmdldE1hcmtkb3duKCkubGVuZ3RoKSB7XG5cdFx0XHQvLyBzbGlnaHRseSBoYWNreSB3YXkgdG8gYXZvaWQgYW4gZXh0cmEgJ25vLW9wJyB1bmRvIHN0b3AgYXQgdGhlIHN0YXJ0IG9mIHJlc3BvbnNlcyB0aGF0IGFyZSBqdXN0IGVkaXRzXG5cdFx0XHRtb2RlbC5hY2NlcHRSZXNwb25zZVByb2dyZXNzKHJlcXVlc3QsIHtcblx0XHRcdFx0a2luZDogJ3VuZG9TdG9wJyxcblx0XHRcdFx0aWQ6IGdlbmVyYXRlVXVpZCgpLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0bW9kZWwuYWNjZXB0UmVzcG9uc2VQcm9ncmVzcyhyZXF1ZXN0LCB7XG5cdFx0XHRraW5kOiAnbWFya2Rvd25Db250ZW50Jyxcblx0XHRcdGNvbnRlbnQ6IG5ldyBNYXJrZG93blN0cmluZygnXFxuYGBgYFxcbicpXG5cdFx0fSk7XG5cdFx0bW9kZWwuYWNjZXB0UmVzcG9uc2VQcm9ncmVzcyhyZXF1ZXN0LCB7XG5cdFx0XHRraW5kOiAnY29kZWJsb2NrVXJpJyxcblx0XHRcdHVyaVxuXHRcdH0pO1xuXHRcdG1vZGVsLmFjY2VwdFJlc3BvbnNlUHJvZ3Jlc3MocmVxdWVzdCwge1xuXHRcdFx0a2luZDogJ21hcmtkb3duQ29udGVudCcsXG5cdFx0XHRjb250ZW50OiBuZXcgTWFya2Rvd25TdHJpbmcocGFyYW1ldGVycy5jb2RlICsgJ1xcbmBgYGBcXG4nKVxuXHRcdH0pO1xuXHRcdGNvbnN0IG5vdGVib29rVXJpID0gQ2VsbFVyaS5wYXJzZSh1cmkpPy5ub3RlYm9vayB8fCB1cmk7XG5cdFx0Ly8gU2lnbmFsIHN0YXJ0LlxuXHRcdGlmICh0aGlzLm5vdGVib29rU2VydmljZS5oYXNTdXBwb3J0ZWROb3RlYm9va3Mobm90ZWJvb2tVcmkpICYmICh0aGlzLm5vdGVib29rU2VydmljZS5nZXROb3RlYm9va1RleHRNb2RlbChub3RlYm9va1VyaSkpKSB7XG5cdFx0XHRtb2RlbC5hY2NlcHRSZXNwb25zZVByb2dyZXNzKHJlcXVlc3QsIHtcblx0XHRcdFx0a2luZDogJ25vdGVib29rRWRpdCcsXG5cdFx0XHRcdGVkaXRzOiBbXSxcblx0XHRcdFx0dXJpOiBub3RlYm9va1VyaVxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1vZGVsLmFjY2VwdFJlc3BvbnNlUHJvZ3Jlc3MocmVxdWVzdCwge1xuXHRcdFx0XHRraW5kOiAndGV4dEVkaXQnLFxuXHRcdFx0XHRlZGl0czogW10sXG5cdFx0XHRcdHVyaVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdFNlc3Npb24gPSB0aGlzLmNoYXRFZGl0aW5nU2VydmljZS5nZXRFZGl0aW5nU2Vzc2lvbihtb2RlbC5zZXNzaW9uSWQpO1xuXHRcdGlmICghZWRpdFNlc3Npb24pIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignVGhpcyB0b29sIG11c3QgYmUgY2FsbGVkIGZyb20gd2l0aGluIGFuIGVkaXRpbmcgc2Vzc2lvbicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY29kZU1hcHBlclNlcnZpY2UubWFwQ29kZSh7XG5cdFx0XHRjb2RlQmxvY2tzOiBbeyBjb2RlOiBwYXJhbWV0ZXJzLmNvZGUsIHJlc291cmNlOiB1cmksIG1hcmtkb3duQmVmb3JlQmxvY2s6IHBhcmFtZXRlcnMuZXhwbGFuYXRpb24gfV0sXG5cdFx0XHRsb2NhdGlvbjogJ3Rvb2wnLFxuXHRcdFx0Y2hhdFJlcXVlc3RJZDogaW52b2NhdGlvbi5jaGF0UmVxdWVzdElkXG5cdFx0fSwge1xuXHRcdFx0dGV4dEVkaXQ6ICh0YXJnZXQsIGVkaXRzKSA9PiB7XG5cdFx0XHRcdG1vZGVsLmFjY2VwdFJlc3BvbnNlUHJvZ3Jlc3MocmVxdWVzdCwgeyBraW5kOiAndGV4dEVkaXQnLCB1cmk6IHRhcmdldCwgZWRpdHMgfSk7XG5cdFx0XHR9LFxuXHRcdFx0bm90ZWJvb2tFZGl0KHRhcmdldCwgZWRpdHMpIHtcblx0XHRcdFx0bW9kZWwuYWNjZXB0UmVzcG9uc2VQcm9ncmVzcyhyZXF1ZXN0LCB7IGtpbmQ6ICdub3RlYm9va0VkaXQnLCB1cmk6IHRhcmdldCwgZWRpdHMgfSk7XG5cdFx0XHR9LFxuXHRcdH0sIHRva2VuKTtcblxuXHRcdC8vIFNpZ25hbCBlbmQuXG5cdFx0aWYgKHRoaXMubm90ZWJvb2tTZXJ2aWNlLmhhc1N1cHBvcnRlZE5vdGVib29rcyhub3RlYm9va1VyaSkgJiYgKHRoaXMubm90ZWJvb2tTZXJ2aWNlLmdldE5vdGVib29rVGV4dE1vZGVsKG5vdGVib29rVXJpKSkpIHtcblx0XHRcdG1vZGVsLmFjY2VwdFJlc3BvbnNlUHJvZ3Jlc3MocmVxdWVzdCwgeyBraW5kOiAnbm90ZWJvb2tFZGl0JywgdXJpOiBub3RlYm9va1VyaSwgZWRpdHM6IFtdLCBkb25lOiB0cnVlIH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtb2RlbC5hY2NlcHRSZXNwb25zZVByb2dyZXNzKHJlcXVlc3QsIHsga2luZDogJ3RleHRFZGl0JywgdXJpLCBlZGl0czogW10sIGRvbmU6IHRydWUgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKHJlc3VsdD8uZXJyb3JNZXNzYWdlKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IocmVzdWx0LmVycm9yTWVzc2FnZSk7XG5cdFx0fVxuXG5cdFx0bGV0IGRpc3Bvc2U6IElEaXNwb3NhYmxlO1xuXHRcdGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG5cdFx0XHQvLyBUaGUgZmlsZSB3aWxsIG5vdCBiZSBtb2RpZmllZCB1bnRpbCB0aGUgZmlyc3QgZWRpdHMgc3RhcnQgc3RyZWFtaW5nIGluLFxuXHRcdFx0Ly8gc28gd2FpdCB1bnRpbCB3ZSBzZWUgdGhhdCBpdCBfd2FzXyBtb2RpZmllZCBiZWZvcmUgd2FpdGluZyBmb3IgaXQgdG8gYmUgZG9uZS5cblx0XHRcdGxldCB3YXNGaWxlQmVpbmdNb2RpZmllZCA9IGZhbHNlO1xuXG5cdFx0XHRkaXNwb3NlID0gYXV0b3J1bigocikgPT4ge1xuXG5cdFx0XHRcdGNvbnN0IGVudHJpZXMgPSBlZGl0U2Vzc2lvbi5lbnRyaWVzLnJlYWQocik7XG5cdFx0XHRcdGNvbnN0IGN1cnJlbnRGaWxlID0gZW50cmllcz8uZmluZCgoZSkgPT4gZS5tb2RpZmllZFVSSS50b1N0cmluZygpID09PSB1cmkudG9TdHJpbmcoKSk7XG5cdFx0XHRcdGlmIChjdXJyZW50RmlsZSkge1xuXHRcdFx0XHRcdGlmIChjdXJyZW50RmlsZS5pc0N1cnJlbnRseUJlaW5nTW9kaWZpZWRCeS5yZWFkKHIpKSB7XG5cdFx0XHRcdFx0XHR3YXNGaWxlQmVpbmdNb2RpZmllZCA9IHRydWU7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICh3YXNGaWxlQmVpbmdNb2RpZmllZCkge1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSh0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0ZGlzcG9zZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHRhd2FpdCB0aGlzLnRleHRGaWxlU2VydmljZS5zYXZlKHVyaSwge1xuXHRcdFx0cmVhc29uOiBTYXZlUmVhc29uLkFVVE8sXG5cdFx0XHRza2lwU2F2ZVBhcnRpY2lwYW50czogdHJ1ZSxcblx0XHR9KTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRjb250ZW50OiBbeyBraW5kOiAndGV4dCcsIHZhbHVlOiAnVGhlIGZpbGUgd2FzIGVkaXRlZCBzdWNjZXNzZnVsbHknIH1dXG5cdFx0fTtcblx0fVxuXG5cdGFzeW5jIHByZXBhcmVUb29sSW52b2NhdGlvbihwYXJhbWV0ZXJzOiBhbnksIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVByZXBhcmVkVG9vbEludm9jYXRpb24gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cHJlc2VudGF0aW9uOiAnaGlkZGVuJ1xuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBFZGl0VG9vbFBhcmFtcyB7XG5cdGZpbGU6IFVyaUNvbXBvbmVudHM7XG5cdGV4cGxhbmF0aW9uOiBzdHJpbmc7XG5cdGNvZGU6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFZGl0VG9vbFJhd1BhcmFtcyB7XG5cdGZpbGVQYXRoOiBzdHJpbmc7XG5cdGV4cGxhbmF0aW9uOiBzdHJpbmc7XG5cdGNvZGU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEVkaXRUb29sSW5wdXRQcm9jZXNzb3IgaW1wbGVtZW50cyBJVG9vbElucHV0UHJvY2Vzc29yIHtcblx0cHJvY2Vzc0lucHV0KGlucHV0OiBFZGl0VG9vbFJhd1BhcmFtcyk6IEVkaXRUb29sUGFyYW1zIHtcblx0XHRpZiAoIWlucHV0LmZpbGVQYXRoKSB7XG5cdFx0XHQvLyBUb29sIG5hbWUgY29sbGlzaW9uLCBvciBpbnB1dCB3YXNuJ3QgcHJvcGVybHkgdmFsaWRhdGVkIHVwc3RyZWFtXG5cdFx0XHRyZXR1cm4gaW5wdXQgYXMgYW55O1xuXHRcdH1cblx0XHRjb25zdCBmaWxlUGF0aCA9IGlucHV0LmZpbGVQYXRoO1xuXHRcdC8vIFJ1bnMgaW4gRUgsIHdpbGwgYmUgbWFwcGVkXG5cdFx0cmV0dXJuIHtcblx0XHRcdGZpbGU6IGZpbGVQYXRoLnN0YXJ0c1dpdGgoJ3VudGl0bGVkOicpID8gVVJJLnBhcnNlKGZpbGVQYXRoKSA6IFVSSS5maWxlKGZpbGVQYXRoKSxcblx0XHRcdGV4cGxhbmF0aW9uOiBpbnB1dC5leHBsYW5hdGlvbixcblx0XHRcdGNvZGU6IGlucHV0LmNvZGUsXG5cdFx0fTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFTLHNCQUFzQjtBQUUvQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxXQUEwQjtBQUNuQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywyQkFBMkI7QUFFcEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyx5Q0FBeUM7QUFJbEQsTUFBTSxtQkFBbUI7QUFBQTtBQUFBO0FBSWxCLE1BQU0sc0JBQXNCO0FBQzVCLE1BQU0scUJBQXFCO0FBQzNCLE1BQU0sZUFBMEI7QUFBQSxFQUN0QyxJQUFJO0FBQUEsRUFDSixhQUFhLFNBQVMsdUJBQXVCLFdBQVc7QUFBQSxFQUN4RCxrQkFBa0Isc01BQXNNLGdCQUFnQjtBQUFBLEVBQ3hPLFFBQVEsRUFBRSxNQUFNLFdBQVc7QUFBQSxFQUMzQixhQUFhO0FBQUEsSUFDWixNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsTUFDWCxhQUFhO0FBQUEsUUFDWixNQUFNO0FBQUEsUUFDTixhQUFhO0FBQUEsTUFDZDtBQUFBLE1BQ0EsVUFBVTtBQUFBLFFBQ1QsTUFBTTtBQUFBLFFBQ04s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
