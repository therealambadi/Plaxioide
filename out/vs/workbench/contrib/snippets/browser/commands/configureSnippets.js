import { isValidBasename } from "../../../../../base/common/extpath.js";
import { extname } from "../../../../../base/common/path.js";
import { basename, joinPath } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { getIconClassesForLanguageId } from "../../../../../editor/common/services/getIconClasses.js";
import * as nls from "../../../../../nls.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { SnippetsAction } from "./abstractSnippetsActions.js";
import { ISnippetsService } from "../snippets.js";
import { SnippetSource } from "../snippetsFile.js";
import { ITextFileService } from "../../../../services/textfile/common/textfiles.js";
import { IUserDataProfileService } from "../../../../services/userDataProfile/common/userDataProfile.js";
var ISnippetPick;
((ISnippetPick2) => {
  function is(thing) {
    return !!thing && URI.isUri(thing.filepath);
  }
  ISnippetPick2.is = is;
})(ISnippetPick || (ISnippetPick = {}));
async function computePicks(snippetService, userDataProfileService, languageService, labelService) {
  const existing = [];
  const future = [];
  const seen = /* @__PURE__ */ new Set();
  const added = /* @__PURE__ */ new Map();
  for (const file of await snippetService.getSnippetFiles()) {
    if (file.source === SnippetSource.Extension) {
      continue;
    }
    if (file.isGlobalSnippets) {
      await file.load();
      const names = /* @__PURE__ */ new Set();
      let source;
      outer: for (const snippet2 of file.data) {
        if (!source) {
          source = snippet2.source;
        }
        for (const scope of snippet2.scopes) {
          const name = languageService.getLanguageName(scope);
          if (name) {
            if (names.size >= 4) {
              names.add(`${name}...`);
              break outer;
            } else {
              names.add(name);
            }
          }
        }
      }
      const snippet = {
        label: basename(file.location),
        filepath: file.location,
        description: names.size === 0 ? nls.localize("global.scope", "(global)") : nls.localize("global.1", "({0})", [...names].join(", "))
      };
      existing.push(snippet);
      if (!source) {
        continue;
      }
      const detail = nls.localize("detail.label", "({0}) {1}", source, labelService.getUriLabel(file.location, { relative: true }));
      const lastItem = added.get(basename(file.location));
      if (lastItem) {
        snippet.detail = detail;
        lastItem.snippet.detail = lastItem.detail;
      }
      added.set(basename(file.location), { snippet, detail });
    } else {
      const mode = basename(file.location).replace(/\.json$/, "");
      existing.push({
        label: basename(file.location),
        description: `(${languageService.getLanguageName(mode) ?? mode})`,
        filepath: file.location
      });
      seen.add(mode);
    }
  }
  const dir = userDataProfileService.currentProfile.snippetsHome;
  for (const languageId of languageService.getRegisteredLanguageIds()) {
    const label = languageService.getLanguageName(languageId);
    if (label && !seen.has(languageId)) {
      future.push({
        label: languageId,
        description: `(${label})`,
        filepath: joinPath(dir, `${languageId}.json`),
        hint: true,
        iconClasses: getIconClassesForLanguageId(languageId)
      });
    }
  }
  existing.sort((a, b) => {
    const a_ext = extname(a.filepath.path);
    const b_ext = extname(b.filepath.path);
    if (a_ext === b_ext) {
      return a.label.localeCompare(b.label);
    } else if (a_ext === ".code-snippets") {
      return -1;
    } else {
      return 1;
    }
  });
  future.sort((a, b) => {
    return a.label.localeCompare(b.label);
  });
  return { existing, future };
}
async function createSnippetFile(scope, defaultPath, quickInputService, fileService, textFileService, opener) {
  function createSnippetUri(input2) {
    const filename = extname(input2) !== ".code-snippets" ? `${input2}.code-snippets` : input2;
    return joinPath(defaultPath, filename);
  }
  await fileService.createFolder(defaultPath);
  const input = await quickInputService.input({
    placeHolder: nls.localize("name", "Type snippet file name"),
    async validateInput(input2) {
      if (!input2) {
        return nls.localize("bad_name1", "Invalid file name");
      }
      if (!isValidBasename(input2)) {
        return nls.localize("bad_name2", "'{0}' is not a valid file name", input2);
      }
      if (await fileService.exists(createSnippetUri(input2))) {
        return nls.localize("bad_name3", "'{0}' already exists", input2);
      }
      return void 0;
    }
  });
  if (!input) {
    return void 0;
  }
  const resource = createSnippetUri(input);
  await textFileService.write(resource, [
    "{",
    "	// Place your " + scope + " snippets here. Each snippet is defined under a snippet name and has a scope, prefix, body and ",
    "	// description. Add comma separated ids of the languages where the snippet is applicable in the scope field. If scope ",
    "	// is left empty or omitted, the snippet gets applied to all languages. The prefix is what is ",
    "	// used to trigger the snippet and the body will be expanded and inserted. Possible variables are: ",
    "	// $1, $2 for tab stops, $0 for the final cursor position, and ${1:label}, ${2:another} for placeholders. ",
    "	// Placeholders with the same ids are connected.",
    "	// Example:",
    '	// "Print to console": {',
    '	// 	"scope": "javascript,typescript",',
    '	// 	"prefix": "log",',
    '	// 	"body": [',
    `	// 		"console.log('$1');",`,
    '	// 		"$2"',
    "	// 	],",
    '	// 	"description": "Log output to console"',
    "	// }",
    "}"
  ].join("\n"));
  await opener.open(resource);
  return void 0;
}
async function createLanguageSnippetFile(pick, fileService, textFileService) {
  if (await fileService.exists(pick.filepath)) {
    return;
  }
  const contents = [
    "{",
    "	// Place your snippets for " + pick.label + " here. Each snippet is defined under a snippet name and has a prefix, body and ",
    "	// description. The prefix is what is used to trigger the snippet and the body will be expanded and inserted. Possible variables are:",
    "	// $1, $2 for tab stops, $0 for the final cursor position, and ${1:label}, ${2:another} for placeholders. Placeholders with the ",
    "	// same ids are connected.",
    "	// Example:",
    '	// "Print to console": {',
    '	// 	"prefix": "log",',
    '	// 	"body": [',
    `	// 		"console.log('$1');",`,
    '	// 		"$2"',
    "	// 	],",
    '	// 	"description": "Log output to console"',
    "	// }",
    "}"
  ].join("\n");
  await textFileService.write(pick.filepath, contents);
}
class ConfigureSnippetsAction extends SnippetsAction {
  constructor() {
    super({
      id: "workbench.action.openSnippets",
      title: nls.localize2("openSnippet.label", "Configure Snippets"),
      shortTitle: {
        ...nls.localize2("userSnippets", "Snippets"),
        mnemonicTitle: nls.localize({ key: "miOpenSnippets", comment: ["&& denotes a mnemonic"] }, "&&Snippets")
      },
      f1: true,
      menu: [
        { id: MenuId.MenubarPreferencesMenu, group: "2_configuration", order: 5 },
        { id: MenuId.GlobalActivity, group: "2_configuration", order: 5 }
      ]
    });
  }
  async run(accessor) {
    const snippetService = accessor.get(ISnippetsService);
    const quickInputService = accessor.get(IQuickInputService);
    const opener = accessor.get(IOpenerService);
    const languageService = accessor.get(ILanguageService);
    const userDataProfileService = accessor.get(IUserDataProfileService);
    const workspaceService = accessor.get(IWorkspaceContextService);
    const fileService = accessor.get(IFileService);
    const textFileService = accessor.get(ITextFileService);
    const labelService = accessor.get(ILabelService);
    const picks = await computePicks(snippetService, userDataProfileService, languageService, labelService);
    const existing = picks.existing;
    const globalSnippetPicks = [{
      scope: nls.localize("new.global_scope", "global"),
      label: nls.localize("new.global", "New Global Snippets file..."),
      uri: userDataProfileService.currentProfile.snippetsHome
    }];
    const workspaceSnippetPicks = [];
    for (const folder of workspaceService.getWorkspace().folders) {
      workspaceSnippetPicks.push({
        scope: nls.localize("new.workspace_scope", "{0} workspace", folder.name),
        label: nls.localize("new.folder", "New Snippets file for '{0}'...", folder.name),
        uri: folder.toResource(".vscode")
      });
    }
    if (existing.length > 0) {
      existing.unshift({ type: "separator", label: nls.localize("group.global", "Existing Snippets") });
      existing.push({ type: "separator", label: nls.localize("new.global.sep", "New Snippets") });
    } else {
      existing.push({ type: "separator", label: nls.localize("new.global.sep", "New Snippets") });
    }
    const pick = await quickInputService.pick([].concat(existing, globalSnippetPicks, workspaceSnippetPicks, picks.future), {
      placeHolder: nls.localize("openSnippet.pickLanguage", "Select Snippets File or Create Snippets"),
      matchOnDescription: true
    });
    if (globalSnippetPicks.indexOf(pick) >= 0) {
      return createSnippetFile(pick.scope, pick.uri, quickInputService, fileService, textFileService, opener);
    } else if (workspaceSnippetPicks.indexOf(pick) >= 0) {
      return createSnippetFile(pick.scope, pick.uri, quickInputService, fileService, textFileService, opener);
    } else if (ISnippetPick.is(pick)) {
      if (pick.hint) {
        await createLanguageSnippetFile(pick, fileService, textFileService);
      }
      return opener.open(pick.filepath);
    }
  }
}
export {
  ConfigureSnippetsAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zbmlwcGV0cy9icm93c2VyL2NvbW1hbmRzL2NvbmZpZ3VyZVNuaXBwZXRzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgaXNWYWxpZEJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXh0cGF0aC5qcyc7XG5pbXBvcnQgeyBleHRuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgam9pblBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBnZXRJY29uQ2xhc3Nlc0Zvckxhbmd1YWdlSWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2dldEljb25DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0sIFF1aWNrUGlja0lucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0c0FjdGlvbiB9IGZyb20gJy4vYWJzdHJhY3RTbmlwcGV0c0FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSVNuaXBwZXRzU2VydmljZSB9IGZyb20gJy4uL3NuaXBwZXRzLmpzJztcbmltcG9ydCB7IFNuaXBwZXRTb3VyY2UgfSBmcm9tICcuLi9zbmlwcGV0c0ZpbGUuanMnO1xuaW1wb3J0IHsgSVRleHRGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3RleHRmaWxlL2NvbW1vbi90ZXh0ZmlsZXMuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5cbm5hbWVzcGFjZSBJU25pcHBldFBpY2sge1xuXHRleHBvcnQgZnVuY3Rpb24gaXModGhpbmc6IG9iamVjdCB8IHVuZGVmaW5lZCk6IHRoaW5nIGlzIElTbmlwcGV0UGljayB7XG5cdFx0cmV0dXJuICEhdGhpbmcgJiYgVVJJLmlzVXJpKCg8SVNuaXBwZXRQaWNrPnRoaW5nKS5maWxlcGF0aCk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElTbmlwcGV0UGljayBleHRlbmRzIElRdWlja1BpY2tJdGVtIHtcblx0ZmlsZXBhdGg6IFVSSTtcblx0aGludD86IHRydWU7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNvbXB1dGVQaWNrcyhzbmlwcGV0U2VydmljZTogSVNuaXBwZXRzU2VydmljZSwgdXNlckRhdGFQcm9maWxlU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UsIGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSwgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlKSB7XG5cblx0Y29uc3QgZXhpc3Rpbmc6IElTbmlwcGV0UGlja1tdID0gW107XG5cdGNvbnN0IGZ1dHVyZTogSVNuaXBwZXRQaWNrW10gPSBbXTtcblxuXHRjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdGNvbnN0IGFkZGVkID0gbmV3IE1hcDxzdHJpbmcsIHsgc25pcHBldDogSVNuaXBwZXRQaWNrOyBkZXRhaWw6IHN0cmluZyB9PigpO1xuXG5cdGZvciAoY29uc3QgZmlsZSBvZiBhd2FpdCBzbmlwcGV0U2VydmljZS5nZXRTbmlwcGV0RmlsZXMoKSkge1xuXG5cdFx0aWYgKGZpbGUuc291cmNlID09PSBTbmlwcGV0U291cmNlLkV4dGVuc2lvbikge1xuXHRcdFx0Ly8gc2tpcCBleHRlbnNpb24gc25pcHBldHNcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdGlmIChmaWxlLmlzR2xvYmFsU25pcHBldHMpIHtcblxuXHRcdFx0YXdhaXQgZmlsZS5sb2FkKCk7XG5cblx0XHRcdC8vIGxpc3Qgc2NvcGVzIGZvciBnbG9iYWwgc25pcHBldHNcblx0XHRcdGNvbnN0IG5hbWVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0XHRsZXQgc291cmNlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0XHRcdG91dGVyOiBmb3IgKGNvbnN0IHNuaXBwZXQgb2YgZmlsZS5kYXRhKSB7XG5cdFx0XHRcdGlmICghc291cmNlKSB7XG5cdFx0XHRcdFx0c291cmNlID0gc25pcHBldC5zb3VyY2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGNvbnN0IHNjb3BlIG9mIHNuaXBwZXQuc2NvcGVzKSB7XG5cdFx0XHRcdFx0Y29uc3QgbmFtZSA9IGxhbmd1YWdlU2VydmljZS5nZXRMYW5ndWFnZU5hbWUoc2NvcGUpO1xuXHRcdFx0XHRcdGlmIChuYW1lKSB7XG5cdFx0XHRcdFx0XHRpZiAobmFtZXMuc2l6ZSA+PSA0KSB7XG5cdFx0XHRcdFx0XHRcdG5hbWVzLmFkZChgJHtuYW1lfS4uLmApO1xuXHRcdFx0XHRcdFx0XHRicmVhayBvdXRlcjtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdG5hbWVzLmFkZChuYW1lKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc25pcHBldDogSVNuaXBwZXRQaWNrID0ge1xuXHRcdFx0XHRsYWJlbDogYmFzZW5hbWUoZmlsZS5sb2NhdGlvbiksXG5cdFx0XHRcdGZpbGVwYXRoOiBmaWxlLmxvY2F0aW9uLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmFtZXMuc2l6ZSA9PT0gMFxuXHRcdFx0XHRcdD8gbmxzLmxvY2FsaXplKCdnbG9iYWwuc2NvcGUnLCBcIihnbG9iYWwpXCIpXG5cdFx0XHRcdFx0OiBubHMubG9jYWxpemUoJ2dsb2JhbC4xJywgXCIoezB9KVwiLCBbLi4ubmFtZXNdLmpvaW4oJywgJykpXG5cdFx0XHR9O1xuXHRcdFx0ZXhpc3RpbmcucHVzaChzbmlwcGV0KTtcblxuXHRcdFx0aWYgKCFzb3VyY2UpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGRldGFpbCA9IG5scy5sb2NhbGl6ZSgnZGV0YWlsLmxhYmVsJywgXCIoezB9KSB7MX1cIiwgc291cmNlLCBsYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoZmlsZS5sb2NhdGlvbiwgeyByZWxhdGl2ZTogdHJ1ZSB9KSk7XG5cdFx0XHRjb25zdCBsYXN0SXRlbSA9IGFkZGVkLmdldChiYXNlbmFtZShmaWxlLmxvY2F0aW9uKSk7XG5cdFx0XHRpZiAobGFzdEl0ZW0pIHtcblx0XHRcdFx0c25pcHBldC5kZXRhaWwgPSBkZXRhaWw7XG5cdFx0XHRcdGxhc3RJdGVtLnNuaXBwZXQuZGV0YWlsID0gbGFzdEl0ZW0uZGV0YWlsO1xuXHRcdFx0fVxuXHRcdFx0YWRkZWQuc2V0KGJhc2VuYW1lKGZpbGUubG9jYXRpb24pLCB7IHNuaXBwZXQsIGRldGFpbCB9KTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBsYW5ndWFnZSBzbmlwcGV0XG5cdFx0XHRjb25zdCBtb2RlID0gYmFzZW5hbWUoZmlsZS5sb2NhdGlvbikucmVwbGFjZSgvXFwuanNvbiQvLCAnJyk7XG5cdFx0XHRleGlzdGluZy5wdXNoKHtcblx0XHRcdFx0bGFiZWw6IGJhc2VuYW1lKGZpbGUubG9jYXRpb24pLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogYCgke2xhbmd1YWdlU2VydmljZS5nZXRMYW5ndWFnZU5hbWUobW9kZSkgPz8gbW9kZX0pYCxcblx0XHRcdFx0ZmlsZXBhdGg6IGZpbGUubG9jYXRpb25cblx0XHRcdH0pO1xuXHRcdFx0c2Vlbi5hZGQobW9kZSk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgZGlyID0gdXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5zbmlwcGV0c0hvbWU7XG5cdGZvciAoY29uc3QgbGFuZ3VhZ2VJZCBvZiBsYW5ndWFnZVNlcnZpY2UuZ2V0UmVnaXN0ZXJlZExhbmd1YWdlSWRzKCkpIHtcblx0XHRjb25zdCBsYWJlbCA9IGxhbmd1YWdlU2VydmljZS5nZXRMYW5ndWFnZU5hbWUobGFuZ3VhZ2VJZCk7XG5cdFx0aWYgKGxhYmVsICYmICFzZWVuLmhhcyhsYW5ndWFnZUlkKSkge1xuXHRcdFx0ZnV0dXJlLnB1c2goe1xuXHRcdFx0XHRsYWJlbDogbGFuZ3VhZ2VJZCxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGAoJHtsYWJlbH0pYCxcblx0XHRcdFx0ZmlsZXBhdGg6IGpvaW5QYXRoKGRpciwgYCR7bGFuZ3VhZ2VJZH0uanNvbmApLFxuXHRcdFx0XHRoaW50OiB0cnVlLFxuXHRcdFx0XHRpY29uQ2xhc3NlczogZ2V0SWNvbkNsYXNzZXNGb3JMYW5ndWFnZUlkKGxhbmd1YWdlSWQpXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRleGlzdGluZy5zb3J0KChhLCBiKSA9PiB7XG5cdFx0Y29uc3QgYV9leHQgPSBleHRuYW1lKGEuZmlsZXBhdGgucGF0aCk7XG5cdFx0Y29uc3QgYl9leHQgPSBleHRuYW1lKGIuZmlsZXBhdGgucGF0aCk7XG5cdFx0aWYgKGFfZXh0ID09PSBiX2V4dCkge1xuXHRcdFx0cmV0dXJuIGEubGFiZWwubG9jYWxlQ29tcGFyZShiLmxhYmVsKTtcblx0XHR9IGVsc2UgaWYgKGFfZXh0ID09PSAnLmNvZGUtc25pcHBldHMnKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiAxO1xuXHRcdH1cblx0fSk7XG5cblx0ZnV0dXJlLnNvcnQoKGEsIGIpID0+IHtcblx0XHRyZXR1cm4gYS5sYWJlbC5sb2NhbGVDb21wYXJlKGIubGFiZWwpO1xuXHR9KTtcblxuXHRyZXR1cm4geyBleGlzdGluZywgZnV0dXJlIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVNuaXBwZXRGaWxlKHNjb3BlOiBzdHJpbmcsIGRlZmF1bHRQYXRoOiBVUkksIHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsIHRleHRGaWxlU2VydmljZTogSVRleHRGaWxlU2VydmljZSwgb3BlbmVyOiBJT3BlbmVyU2VydmljZSkge1xuXG5cdGZ1bmN0aW9uIGNyZWF0ZVNuaXBwZXRVcmkoaW5wdXQ6IHN0cmluZykge1xuXHRcdGNvbnN0IGZpbGVuYW1lID0gZXh0bmFtZShpbnB1dCkgIT09ICcuY29kZS1zbmlwcGV0cydcblx0XHRcdD8gYCR7aW5wdXR9LmNvZGUtc25pcHBldHNgXG5cdFx0XHQ6IGlucHV0O1xuXHRcdHJldHVybiBqb2luUGF0aChkZWZhdWx0UGF0aCwgZmlsZW5hbWUpO1xuXHR9XG5cblx0YXdhaXQgZmlsZVNlcnZpY2UuY3JlYXRlRm9sZGVyKGRlZmF1bHRQYXRoKTtcblxuXHRjb25zdCBpbnB1dCA9IGF3YWl0IHF1aWNrSW5wdXRTZXJ2aWNlLmlucHV0KHtcblx0XHRwbGFjZUhvbGRlcjogbmxzLmxvY2FsaXplKCduYW1lJywgXCJUeXBlIHNuaXBwZXQgZmlsZSBuYW1lXCIpLFxuXHRcdGFzeW5jIHZhbGlkYXRlSW5wdXQoaW5wdXQpIHtcblx0XHRcdGlmICghaW5wdXQpIHtcblx0XHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnYmFkX25hbWUxJywgXCJJbnZhbGlkIGZpbGUgbmFtZVwiKTtcblx0XHRcdH1cblx0XHRcdGlmICghaXNWYWxpZEJhc2VuYW1lKGlucHV0KSkge1xuXHRcdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdiYWRfbmFtZTInLCBcIid7MH0nIGlzIG5vdCBhIHZhbGlkIGZpbGUgbmFtZVwiLCBpbnB1dCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKGNyZWF0ZVNuaXBwZXRVcmkoaW5wdXQpKSkge1xuXHRcdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdiYWRfbmFtZTMnLCBcIid7MH0nIGFscmVhZHkgZXhpc3RzXCIsIGlucHV0KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9KTtcblxuXHRpZiAoIWlucHV0KSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGNvbnN0IHJlc291cmNlID0gY3JlYXRlU25pcHBldFVyaShpbnB1dCk7XG5cblx0YXdhaXQgdGV4dEZpbGVTZXJ2aWNlLndyaXRlKHJlc291cmNlLCBbXG5cdFx0J3snLFxuXHRcdCdcXHQvLyBQbGFjZSB5b3VyICcgKyBzY29wZSArICcgc25pcHBldHMgaGVyZS4gRWFjaCBzbmlwcGV0IGlzIGRlZmluZWQgdW5kZXIgYSBzbmlwcGV0IG5hbWUgYW5kIGhhcyBhIHNjb3BlLCBwcmVmaXgsIGJvZHkgYW5kICcsXG5cdFx0J1xcdC8vIGRlc2NyaXB0aW9uLiBBZGQgY29tbWEgc2VwYXJhdGVkIGlkcyBvZiB0aGUgbGFuZ3VhZ2VzIHdoZXJlIHRoZSBzbmlwcGV0IGlzIGFwcGxpY2FibGUgaW4gdGhlIHNjb3BlIGZpZWxkLiBJZiBzY29wZSAnLFxuXHRcdCdcXHQvLyBpcyBsZWZ0IGVtcHR5IG9yIG9taXR0ZWQsIHRoZSBzbmlwcGV0IGdldHMgYXBwbGllZCB0byBhbGwgbGFuZ3VhZ2VzLiBUaGUgcHJlZml4IGlzIHdoYXQgaXMgJyxcblx0XHQnXFx0Ly8gdXNlZCB0byB0cmlnZ2VyIHRoZSBzbmlwcGV0IGFuZCB0aGUgYm9keSB3aWxsIGJlIGV4cGFuZGVkIGFuZCBpbnNlcnRlZC4gUG9zc2libGUgdmFyaWFibGVzIGFyZTogJyxcblx0XHQnXFx0Ly8gJDEsICQyIGZvciB0YWIgc3RvcHMsICQwIGZvciB0aGUgZmluYWwgY3Vyc29yIHBvc2l0aW9uLCBhbmQgJHsxOmxhYmVsfSwgJHsyOmFub3RoZXJ9IGZvciBwbGFjZWhvbGRlcnMuICcsXG5cdFx0J1xcdC8vIFBsYWNlaG9sZGVycyB3aXRoIHRoZSBzYW1lIGlkcyBhcmUgY29ubmVjdGVkLicsXG5cdFx0J1xcdC8vIEV4YW1wbGU6Jyxcblx0XHQnXFx0Ly8gXCJQcmludCB0byBjb25zb2xlXCI6IHsnLFxuXHRcdCdcXHQvLyBcXHRcInNjb3BlXCI6IFwiamF2YXNjcmlwdCx0eXBlc2NyaXB0XCIsJyxcblx0XHQnXFx0Ly8gXFx0XCJwcmVmaXhcIjogXCJsb2dcIiwnLFxuXHRcdCdcXHQvLyBcXHRcImJvZHlcIjogWycsXG5cdFx0J1xcdC8vIFxcdFxcdFwiY29uc29sZS5sb2coXFwnJDFcXCcpO1wiLCcsXG5cdFx0J1xcdC8vIFxcdFxcdFwiJDJcIicsXG5cdFx0J1xcdC8vIFxcdF0sJyxcblx0XHQnXFx0Ly8gXFx0XCJkZXNjcmlwdGlvblwiOiBcIkxvZyBvdXRwdXQgdG8gY29uc29sZVwiJyxcblx0XHQnXFx0Ly8gfScsXG5cdFx0J30nXG5cdF0uam9pbignXFxuJykpO1xuXG5cdGF3YWl0IG9wZW5lci5vcGVuKHJlc291cmNlKTtcblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gY3JlYXRlTGFuZ3VhZ2VTbmlwcGV0RmlsZShwaWNrOiBJU25pcHBldFBpY2ssIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsIHRleHRGaWxlU2VydmljZTogSVRleHRGaWxlU2VydmljZSkge1xuXHRpZiAoYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKHBpY2suZmlsZXBhdGgpKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdGNvbnN0IGNvbnRlbnRzID0gW1xuXHRcdCd7Jyxcblx0XHQnXFx0Ly8gUGxhY2UgeW91ciBzbmlwcGV0cyBmb3IgJyArIHBpY2subGFiZWwgKyAnIGhlcmUuIEVhY2ggc25pcHBldCBpcyBkZWZpbmVkIHVuZGVyIGEgc25pcHBldCBuYW1lIGFuZCBoYXMgYSBwcmVmaXgsIGJvZHkgYW5kICcsXG5cdFx0J1xcdC8vIGRlc2NyaXB0aW9uLiBUaGUgcHJlZml4IGlzIHdoYXQgaXMgdXNlZCB0byB0cmlnZ2VyIHRoZSBzbmlwcGV0IGFuZCB0aGUgYm9keSB3aWxsIGJlIGV4cGFuZGVkIGFuZCBpbnNlcnRlZC4gUG9zc2libGUgdmFyaWFibGVzIGFyZTonLFxuXHRcdCdcXHQvLyAkMSwgJDIgZm9yIHRhYiBzdG9wcywgJDAgZm9yIHRoZSBmaW5hbCBjdXJzb3IgcG9zaXRpb24sIGFuZCAkezE6bGFiZWx9LCAkezI6YW5vdGhlcn0gZm9yIHBsYWNlaG9sZGVycy4gUGxhY2Vob2xkZXJzIHdpdGggdGhlICcsXG5cdFx0J1xcdC8vIHNhbWUgaWRzIGFyZSBjb25uZWN0ZWQuJyxcblx0XHQnXFx0Ly8gRXhhbXBsZTonLFxuXHRcdCdcXHQvLyBcIlByaW50IHRvIGNvbnNvbGVcIjogeycsXG5cdFx0J1xcdC8vIFxcdFwicHJlZml4XCI6IFwibG9nXCIsJyxcblx0XHQnXFx0Ly8gXFx0XCJib2R5XCI6IFsnLFxuXHRcdCdcXHQvLyBcXHRcXHRcImNvbnNvbGUubG9nKFxcJyQxXFwnKTtcIiwnLFxuXHRcdCdcXHQvLyBcXHRcXHRcIiQyXCInLFxuXHRcdCdcXHQvLyBcXHRdLCcsXG5cdFx0J1xcdC8vIFxcdFwiZGVzY3JpcHRpb25cIjogXCJMb2cgb3V0cHV0IHRvIGNvbnNvbGVcIicsXG5cdFx0J1xcdC8vIH0nLFxuXHRcdCd9J1xuXHRdLmpvaW4oJ1xcbicpO1xuXHRhd2FpdCB0ZXh0RmlsZVNlcnZpY2Uud3JpdGUocGljay5maWxlcGF0aCwgY29udGVudHMpO1xufVxuXG5leHBvcnQgY2xhc3MgQ29uZmlndXJlU25pcHBldHNBY3Rpb24gZXh0ZW5kcyBTbmlwcGV0c0FjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5vcGVuU25pcHBldHMnLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ29wZW5TbmlwcGV0LmxhYmVsJywgXCJDb25maWd1cmUgU25pcHBldHNcIiksXG5cdFx0XHRzaG9ydFRpdGxlOiB7XG5cdFx0XHRcdC4uLm5scy5sb2NhbGl6ZTIoJ3VzZXJTbmlwcGV0cycsIFwiU25pcHBldHNcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pT3BlblNuaXBwZXRzJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmU25pcHBldHNcIiksXG5cdFx0XHR9LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHsgaWQ6IE1lbnVJZC5NZW51YmFyUHJlZmVyZW5jZXNNZW51LCBncm91cDogJzJfY29uZmlndXJhdGlvbicsIG9yZGVyOiA1IH0sXG5cdFx0XHRcdHsgaWQ6IE1lbnVJZC5HbG9iYWxBY3Rpdml0eSwgZ3JvdXA6ICcyX2NvbmZpZ3VyYXRpb24nLCBvcmRlcjogNSB9LFxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTxhbnk+IHtcblxuXHRcdGNvbnN0IHNuaXBwZXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElTbmlwcGV0c1NlcnZpY2UpO1xuXHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0Y29uc3Qgb3BlbmVyID0gYWNjZXNzb3IuZ2V0KElPcGVuZXJTZXJ2aWNlKTtcblx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlU2VydmljZSk7XG5cdFx0Y29uc3QgdXNlckRhdGFQcm9maWxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJVXNlckRhdGFQcm9maWxlU2VydmljZSk7XG5cdFx0Y29uc3Qgd29ya3NwYWNlU2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UpO1xuXHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0Y29uc3QgdGV4dEZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUZXh0RmlsZVNlcnZpY2UpO1xuXHRcdGNvbnN0IGxhYmVsU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGFiZWxTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHBpY2tzID0gYXdhaXQgY29tcHV0ZVBpY2tzKHNuaXBwZXRTZXJ2aWNlLCB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLCBsYW5ndWFnZVNlcnZpY2UsIGxhYmVsU2VydmljZSk7XG5cdFx0Y29uc3QgZXhpc3Rpbmc6IFF1aWNrUGlja0lucHV0W10gPSBwaWNrcy5leGlzdGluZztcblxuXHRcdHR5cGUgU25pcHBldFBpY2sgPSBJUXVpY2tQaWNrSXRlbSAmIHsgdXJpOiBVUkkgfSAmIHsgc2NvcGU6IHN0cmluZyB9O1xuXHRcdGNvbnN0IGdsb2JhbFNuaXBwZXRQaWNrczogU25pcHBldFBpY2tbXSA9IFt7XG5cdFx0XHRzY29wZTogbmxzLmxvY2FsaXplKCduZXcuZ2xvYmFsX3Njb3BlJywgJ2dsb2JhbCcpLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnbmV3Lmdsb2JhbCcsIFwiTmV3IEdsb2JhbCBTbmlwcGV0cyBmaWxlLi4uXCIpLFxuXHRcdFx0dXJpOiB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLnNuaXBwZXRzSG9tZVxuXHRcdH1dO1xuXG5cdFx0Y29uc3Qgd29ya3NwYWNlU25pcHBldFBpY2tzOiBTbmlwcGV0UGlja1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBmb2xkZXIgb2Ygd29ya3NwYWNlU2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzKSB7XG5cdFx0XHR3b3Jrc3BhY2VTbmlwcGV0UGlja3MucHVzaCh7XG5cdFx0XHRcdHNjb3BlOiBubHMubG9jYWxpemUoJ25ldy53b3Jrc3BhY2Vfc2NvcGUnLCBcInswfSB3b3Jrc3BhY2VcIiwgZm9sZGVyLm5hbWUpLFxuXHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCduZXcuZm9sZGVyJywgXCJOZXcgU25pcHBldHMgZmlsZSBmb3IgJ3swfScuLi5cIiwgZm9sZGVyLm5hbWUpLFxuXHRcdFx0XHR1cmk6IGZvbGRlci50b1Jlc291cmNlKCcudnNjb2RlJylcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmIChleGlzdGluZy5sZW5ndGggPiAwKSB7XG5cdFx0XHRleGlzdGluZy51bnNoaWZ0KHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBubHMubG9jYWxpemUoJ2dyb3VwLmdsb2JhbCcsIFwiRXhpc3RpbmcgU25pcHBldHNcIikgfSk7XG5cdFx0XHRleGlzdGluZy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBubHMubG9jYWxpemUoJ25ldy5nbG9iYWwuc2VwJywgXCJOZXcgU25pcHBldHNcIikgfSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGV4aXN0aW5nLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IG5scy5sb2NhbGl6ZSgnbmV3Lmdsb2JhbC5zZXAnLCBcIk5ldyBTbmlwcGV0c1wiKSB9KTtcblx0XHR9XG5cblx0XHRjb25zdCBwaWNrID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljaygoW10gYXMgUXVpY2tQaWNrSW5wdXRbXSkuY29uY2F0KGV4aXN0aW5nLCBnbG9iYWxTbmlwcGV0UGlja3MsIHdvcmtzcGFjZVNuaXBwZXRQaWNrcywgcGlja3MuZnV0dXJlKSwge1xuXHRcdFx0cGxhY2VIb2xkZXI6IG5scy5sb2NhbGl6ZSgnb3BlblNuaXBwZXQucGlja0xhbmd1YWdlJywgXCJTZWxlY3QgU25pcHBldHMgRmlsZSBvciBDcmVhdGUgU25pcHBldHNcIiksXG5cdFx0XHRtYXRjaE9uRGVzY3JpcHRpb246IHRydWVcblx0XHR9KTtcblxuXHRcdGlmIChnbG9iYWxTbmlwcGV0UGlja3MuaW5kZXhPZihwaWNrIGFzIFNuaXBwZXRQaWNrKSA+PSAwKSB7XG5cdFx0XHRyZXR1cm4gY3JlYXRlU25pcHBldEZpbGUoKHBpY2sgYXMgU25pcHBldFBpY2spLnNjb3BlLCAocGljayBhcyBTbmlwcGV0UGljaykudXJpLCBxdWlja0lucHV0U2VydmljZSwgZmlsZVNlcnZpY2UsIHRleHRGaWxlU2VydmljZSwgb3BlbmVyKTtcblx0XHR9IGVsc2UgaWYgKHdvcmtzcGFjZVNuaXBwZXRQaWNrcy5pbmRleE9mKHBpY2sgYXMgU25pcHBldFBpY2spID49IDApIHtcblx0XHRcdHJldHVybiBjcmVhdGVTbmlwcGV0RmlsZSgocGljayBhcyBTbmlwcGV0UGljaykuc2NvcGUsIChwaWNrIGFzIFNuaXBwZXRQaWNrKS51cmksIHF1aWNrSW5wdXRTZXJ2aWNlLCBmaWxlU2VydmljZSwgdGV4dEZpbGVTZXJ2aWNlLCBvcGVuZXIpO1xuXHRcdH0gZWxzZSBpZiAoSVNuaXBwZXRQaWNrLmlzKHBpY2spKSB7XG5cdFx0XHRpZiAocGljay5oaW50KSB7XG5cdFx0XHRcdGF3YWl0IGNyZWF0ZUxhbmd1YWdlU25pcHBldEZpbGUocGljaywgZmlsZVNlcnZpY2UsIHRleHRGaWxlU2VydmljZSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gb3BlbmVyLm9wZW4ocGljay5maWxlcGF0aCk7XG5cdFx0fVxuXG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZUFBZTtBQUN4QixTQUFTLFVBQVUsZ0JBQWdCO0FBQ25DLFNBQVMsV0FBVztBQUNwQixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG1DQUFtQztBQUM1QyxZQUFZLFNBQVM7QUFDckIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMEJBQTBEO0FBQ25FLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsd0JBQXdCO0FB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
