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
import { combinedDisposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import * as resources from "../../../../base/common/resources.js";
import { isFalsyOrWhitespace } from "../../../../base/common/strings.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { setSnippetSuggestSupport } from "../../../../editor/contrib/suggest/browser/suggest.js";
import { localize } from "../../../../nls.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { FileChangeType, IFileService } from "../../../../platform/files/common/files.js";
import { ILifecycleService, LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { SnippetFile, SnippetSource } from "./snippetsFile.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
import { languagesExtPoint } from "../../../services/language/common/languageService.js";
import { SnippetCompletionProvider } from "./snippetCompletionProvider.js";
import { IExtensionResourceLoaderService } from "../../../../platform/extensionResourceLoader/common/extensionResourceLoader.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { isStringArray } from "../../../../base/common/types.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { ILanguageConfigurationService } from "../../../../editor/common/languages/languageConfigurationRegistry.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { insertInto } from "../../../../base/common/arrays.js";
var snippetExt;
((snippetExt2) => {
  function toValidSnippet(extension, snippet, languageService) {
    if (isFalsyOrWhitespace(snippet.path)) {
      extension.collector.error(localize(
        "invalid.path.0",
        "Expected string in `contributes.{0}.path`. Provided value: {1}",
        extension.description.name,
        String(snippet.path)
      ));
      return null;
    }
    if (isFalsyOrWhitespace(snippet.language) && !snippet.path.endsWith(".code-snippets")) {
      extension.collector.error(localize(
        "invalid.language.0",
        "When omitting the language, the value of `contributes.{0}.path` must be a `.code-snippets`-file. Provided value: {1}",
        extension.description.name,
        String(snippet.path)
      ));
      return null;
    }
    if (!isFalsyOrWhitespace(snippet.language) && !languageService.isRegisteredLanguageId(snippet.language)) {
      extension.collector.error(localize(
        "invalid.language",
        "Unknown language in `contributes.{0}.language`. Provided value: {1}",
        extension.description.name,
        String(snippet.language)
      ));
      return null;
    }
    const extensionLocation = extension.description.extensionLocation;
    const snippetLocation = resources.joinPath(extensionLocation, snippet.path);
    if (!resources.isEqualOrParent(snippetLocation, extensionLocation)) {
      extension.collector.error(localize(
        "invalid.path.1",
        "Expected `contributes.{0}.path` ({1}) to be included inside extension's folder ({2}). This might make the extension non-portable.",
        extension.description.name,
        snippetLocation.path,
        extensionLocation.path
      ));
      return null;
    }
    return {
      language: snippet.language,
      location: snippetLocation
    };
  }
  snippetExt2.toValidSnippet = toValidSnippet;
  snippetExt2.snippetsContribution = {
    description: localize("vscode.extension.contributes.snippets", "Contributes snippets."),
    type: "array",
    defaultSnippets: [{ body: [{ language: "", path: "" }] }],
    items: {
      type: "object",
      defaultSnippets: [{ body: { language: "${1:id}", path: "./snippets/${2:id}.json." } }],
      properties: {
        language: {
          description: localize("vscode.extension.contributes.snippets-language", "Language identifier for which this snippet is contributed to."),
          type: "string"
        },
        path: {
          description: localize("vscode.extension.contributes.snippets-path", "Path of the snippets file. The path is relative to the extension folder and typically starts with './snippets/'."),
          type: "string"
        }
      }
    }
  };
  snippetExt2.point = ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: "snippets",
    deps: [languagesExtPoint],
    jsonSchema: snippetExt2.snippetsContribution
  });
})(snippetExt || (snippetExt = {}));
function watch(service, resource, callback) {
  return combinedDisposable(
    service.watch(resource),
    service.onDidFilesChange((e) => {
      if (e.affects(resource)) {
        callback();
      }
    })
  );
}
let SnippetEnablement = class {
  constructor(_storageService) {
    this._storageService = _storageService;
    const raw = _storageService.get(SnippetEnablement._key, StorageScope.PROFILE, "");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
    }
    this._ignored = isStringArray(data) ? new Set(data) : /* @__PURE__ */ new Set();
  }
  isIgnored(id) {
    return this._ignored.has(id);
  }
  updateIgnored(id, value) {
    let changed = false;
    if (this._ignored.has(id) && !value) {
      this._ignored.delete(id);
      changed = true;
    } else if (!this._ignored.has(id) && value) {
      this._ignored.add(id);
      changed = true;
    }
    if (changed) {
      this._storageService.store(SnippetEnablement._key, JSON.stringify(Array.from(this._ignored)), StorageScope.PROFILE, StorageTarget.USER);
    }
  }
};
SnippetEnablement._key = "snippets.ignoredSnippets";
SnippetEnablement = __decorateClass([
  __decorateParam(0, IStorageService)
], SnippetEnablement);
let SnippetUsageTimestamps = class {
  constructor(_storageService) {
    this._storageService = _storageService;
    const raw = _storageService.get(SnippetUsageTimestamps._key, StorageScope.PROFILE, "");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = [];
    }
    this._usages = Array.isArray(data) ? new Map(data) : /* @__PURE__ */ new Map();
  }
  getUsageTimestamp(id) {
    return this._usages.get(id);
  }
  updateUsageTimestamp(id) {
    this._usages.delete(id);
    this._usages.set(id, Date.now());
    const all = [...this._usages].slice(-100);
    this._storageService.store(SnippetUsageTimestamps._key, JSON.stringify(all), StorageScope.PROFILE, StorageTarget.USER);
  }
};
SnippetUsageTimestamps._key = "snippets.usageTimestamps";
SnippetUsageTimestamps = __decorateClass([
  __decorateParam(0, IStorageService)
], SnippetUsageTimestamps);
let SnippetsService = class {
  constructor(_environmentService, _userDataProfileService, _contextService, _languageService, _logService, _fileService, _textfileService, _extensionResourceLoaderService, lifecycleService, instantiationService, languageConfigurationService) {
    this._environmentService = _environmentService;
    this._userDataProfileService = _userDataProfileService;
    this._contextService = _contextService;
    this._languageService = _languageService;
    this._logService = _logService;
    this._fileService = _fileService;
    this._textfileService = _textfileService;
    this._extensionResourceLoaderService = _extensionResourceLoaderService;
    this._disposables = new DisposableStore();
    this._pendingWork = [];
    this._files = new ResourceMap();
    this._pendingWork.push(Promise.resolve(lifecycleService.when(LifecyclePhase.Restored).then(() => {
      this._initExtensionSnippets();
      this._initUserSnippets();
      this._initWorkspaceSnippets();
    })));
    setSnippetSuggestSupport(new SnippetCompletionProvider(this._languageService, this, languageConfigurationService));
    this._enablement = instantiationService.createInstance(SnippetEnablement);
    this._usageTimestamps = instantiationService.createInstance(SnippetUsageTimestamps);
  }
  dispose() {
    this._disposables.dispose();
  }
  isEnabled(snippet) {
    return !this._enablement.isIgnored(snippet.snippetIdentifier);
  }
  updateEnablement(snippet, enabled) {
    this._enablement.updateIgnored(snippet.snippetIdentifier, !enabled);
  }
  updateUsageTimestamp(snippet) {
    this._usageTimestamps.updateUsageTimestamp(snippet.snippetIdentifier);
  }
  _joinSnippets() {
    const promises = this._pendingWork.slice(0);
    this._pendingWork.length = 0;
    return Promise.all(promises);
  }
  async getSnippetFiles() {
    await this._joinSnippets();
    return this._files.values();
  }
  async getSnippets(languageId, opts) {
    await this._joinSnippets();
    const result = [];
    const promises = [];
    if (languageId) {
      if (this._languageService.isRegisteredLanguageId(languageId)) {
        for (const file of this._files.values()) {
          promises.push(
            file.load().then((file2) => file2.select(languageId, result)).catch((err) => this._logService.error(err, file.location.toString()))
          );
        }
      }
    } else {
      for (const file of this._files.values()) {
        promises.push(
          file.load().then((file2) => insertInto(result, result.length, file2.data)).catch((err) => this._logService.error(err, file.location.toString()))
        );
      }
    }
    await Promise.all(promises);
    return this._filterAndSortSnippets(result, opts);
  }
  getSnippetsSync(languageId, opts) {
    const result = [];
    if (this._languageService.isRegisteredLanguageId(languageId)) {
      for (const file of this._files.values()) {
        file.load().catch((_err) => {
        });
        file.select(languageId, result);
      }
    }
    return this._filterAndSortSnippets(result, opts);
  }
  _filterAndSortSnippets(snippets, opts) {
    const result = [];
    for (const snippet of snippets) {
      if (!snippet.prefix && !opts?.includeNoPrefixSnippets) {
        continue;
      }
      if (!this.isEnabled(snippet) && !opts?.includeDisabledSnippets) {
        continue;
      }
      if (typeof opts?.fileTemplateSnippets === "boolean" && opts.fileTemplateSnippets !== snippet.isFileTemplate) {
        continue;
      }
      result.push(snippet);
    }
    return result.sort((a, b) => {
      let result2 = 0;
      if (!opts?.noRecencySort) {
        const val1 = this._usageTimestamps.getUsageTimestamp(a.snippetIdentifier) ?? -1;
        const val2 = this._usageTimestamps.getUsageTimestamp(b.snippetIdentifier) ?? -1;
        result2 = val2 - val1;
      }
      if (result2 === 0) {
        result2 = this._compareSnippet(a, b);
      }
      return result2;
    });
  }
  _compareSnippet(a, b) {
    if (a.snippetSource < b.snippetSource) {
      return -1;
    } else if (a.snippetSource > b.snippetSource) {
      return 1;
    } else if (a.source < b.source) {
      return -1;
    } else if (a.source > b.source) {
      return 1;
    } else if (a.name > b.name) {
      return 1;
    } else if (a.name < b.name) {
      return -1;
    } else {
      return 0;
    }
  }
  // --- loading, watching
  _initExtensionSnippets() {
    snippetExt.point.setHandler((extensions) => {
      for (const [key, value] of this._files) {
        if (value.source === SnippetSource.Extension) {
          this._files.delete(key);
        }
      }
      for (const extension of extensions) {
        for (const contribution of extension.value) {
          const validContribution = snippetExt.toValidSnippet(extension, contribution, this._languageService);
          if (!validContribution) {
            continue;
          }
          const file = this._files.get(validContribution.location);
          if (file) {
            if (file.defaultScopes) {
              file.defaultScopes.push(validContribution.language);
            } else {
              file.defaultScopes = [];
            }
          } else {
            const file2 = new SnippetFile(SnippetSource.Extension, validContribution.location, validContribution.language ? [validContribution.language] : void 0, extension.description, this._fileService, this._extensionResourceLoaderService);
            this._files.set(file2.location, file2);
            if (this._environmentService.isExtensionDevelopment) {
              file2.load().then((file3) => {
                if (file3.data.some((snippet) => snippet.isBogous)) {
                  extension.collector.warn(localize(
                    "badVariableUse",
                    "One or more snippets from the extension '{0}' very likely confuse snippet-variables and snippet-placeholders (see https://code.visualstudio.com/docs/editor/userdefinedsnippets#_snippet-syntax for more details)",
                    extension.description.name
                  ));
                }
              }, (err) => {
                extension.collector.warn(localize(
                  "badFile",
                  'The snippet file "{0}" could not be read.',
                  file2.location.toString()
                ));
              });
            }
          }
        }
      }
    });
  }
  _initWorkspaceSnippets() {
    const disposables = new DisposableStore();
    const updateWorkspaceSnippets = () => {
      disposables.clear();
      this._pendingWork.push(this._initWorkspaceFolderSnippets(this._contextService.getWorkspace(), disposables));
    };
    this._disposables.add(disposables);
    this._disposables.add(this._contextService.onDidChangeWorkspaceFolders(updateWorkspaceSnippets));
    this._disposables.add(this._contextService.onDidChangeWorkbenchState(updateWorkspaceSnippets));
    updateWorkspaceSnippets();
  }
  async _initWorkspaceFolderSnippets(workspace, bucket) {
    const promises = workspace.folders.map(async (folder) => {
      const snippetFolder = folder.toResource(".vscode");
      const value = await this._fileService.exists(snippetFolder);
      if (value) {
        this._initFolderSnippets(SnippetSource.Workspace, snippetFolder, bucket);
      } else {
        bucket.add(this._fileService.onDidFilesChange((e) => {
          if (e.contains(snippetFolder, FileChangeType.ADDED)) {
            this._initFolderSnippets(SnippetSource.Workspace, snippetFolder, bucket);
          }
        }));
      }
    });
    await Promise.all(promises);
  }
  async _initUserSnippets() {
    const disposables = new DisposableStore();
    const updateUserSnippets = async () => {
      disposables.clear();
      const userSnippetsFolder = this._userDataProfileService.currentProfile.snippetsHome;
      await this._fileService.createFolder(userSnippetsFolder);
      await this._initFolderSnippets(SnippetSource.User, userSnippetsFolder, disposables);
    };
    this._disposables.add(disposables);
    this._disposables.add(this._userDataProfileService.onDidChangeCurrentProfile((e) => e.join((async () => {
      this._pendingWork.push(updateUserSnippets());
    })())));
    await updateUserSnippets();
  }
  _initFolderSnippets(source, folder, bucket) {
    const disposables = new DisposableStore();
    const addFolderSnippets = async () => {
      disposables.clear();
      if (!await this._fileService.exists(folder)) {
        return;
      }
      try {
        const stat = await this._fileService.resolve(folder);
        for (const entry of stat.children || []) {
          disposables.add(this._addSnippetFile(entry.resource, source));
        }
      } catch (err) {
        this._logService.error(`Failed snippets from folder '${folder.toString()}'`, err);
      }
    };
    bucket.add(this._textfileService.files.onDidSave((e) => {
      if (resources.isEqualOrParent(e.model.resource, folder)) {
        addFolderSnippets();
      }
    }));
    bucket.add(watch(this._fileService, folder, addFolderSnippets));
    bucket.add(disposables);
    return addFolderSnippets();
  }
  _addSnippetFile(uri, source) {
    const ext = resources.extname(uri);
    if (source === SnippetSource.User && ext === ".json") {
      const langName = resources.basename(uri).replace(/\.json/, "");
      this._files.set(uri, new SnippetFile(source, uri, [langName], void 0, this._fileService, this._extensionResourceLoaderService));
    } else if (ext === ".code-snippets") {
      this._files.set(uri, new SnippetFile(source, uri, void 0, void 0, this._fileService, this._extensionResourceLoaderService));
    }
    return {
      dispose: () => this._files.delete(uri)
    };
  }
};
SnippetsService = __decorateClass([
  __decorateParam(0, IEnvironmentService),
  __decorateParam(1, IUserDataProfileService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, ILanguageService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IFileService),
  __decorateParam(6, ITextFileService),
  __decorateParam(7, IExtensionResourceLoaderService),
  __decorateParam(8, ILifecycleService),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, ILanguageConfigurationService)
], SnippetsService);
function getNonWhitespacePrefix(model, position) {
  const MAX_PREFIX_LENGTH = 100;
  const line = model.getLineContent(position.lineNumber).substr(0, position.column - 1);
  const minChIndex = Math.max(0, line.length - MAX_PREFIX_LENGTH);
  for (let chIndex = line.length - 1; chIndex >= minChIndex; chIndex--) {
    const ch = line.charAt(chIndex);
    if (/\s/.test(ch)) {
      return line.substr(chIndex + 1);
    }
  }
  if (minChIndex === 0) {
    return line;
  }
  return "";
}
export {
  SnippetsService,
  getNonWhitespacePrefix
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zbmlwcGV0cy9icm93c2VyL3NuaXBwZXRzU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElKU09OU2NoZW1hIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vanNvblNjaGVtYS5qcyc7XG5pbXBvcnQgeyBjb21iaW5lZERpc3Bvc2FibGUsIElEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0ICogYXMgcmVzb3VyY2VzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBpc0ZhbHN5T3JXaGl0ZXNwYWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IHNldFNuaXBwZXRTdWdnZXN0U3VwcG9ydCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3N1Z2dlc3QvYnJvd3Nlci9zdWdnZXN0LmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgRmlsZUNoYW5nZVR5cGUsIElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSwgTGlmZWN5Y2xlUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2UsIElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElTbmlwcGV0R2V0T3B0aW9ucywgSVNuaXBwZXRzU2VydmljZSB9IGZyb20gJy4vc25pcHBldHMuanMnO1xuaW1wb3J0IHsgU25pcHBldCwgU25pcHBldEZpbGUsIFNuaXBwZXRTb3VyY2UgfSBmcm9tICcuL3NuaXBwZXRzRmlsZS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zUmVnaXN0cnksIElFeHRlbnNpb25Qb2ludFVzZXIgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgbGFuZ3VhZ2VzRXh0UG9pbnQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYW5ndWFnZS9jb21tb24vbGFuZ3VhZ2VTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFNuaXBwZXRDb21wbGV0aW9uUHJvdmlkZXIgfSBmcm9tICcuL3NuaXBwZXRDb21wbGV0aW9uUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvblJlc291cmNlTG9hZGVyL2NvbW1vbi9leHRlbnNpb25SZXNvdXJjZUxvYWRlci5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgaXNTdHJpbmdBcnJheSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVRleHRGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3RleHRmaWxlL2NvbW1vbi90ZXh0ZmlsZXMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IGluc2VydEludG8gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuXG5uYW1lc3BhY2Ugc25pcHBldEV4dCB7XG5cblx0ZXhwb3J0IGludGVyZmFjZSBJU25pcHBldHNFeHRlbnNpb25Qb2ludCB7XG5cdFx0bGFuZ3VhZ2U6IHN0cmluZztcblx0XHRwYXRoOiBzdHJpbmc7XG5cdH1cblxuXHRleHBvcnQgaW50ZXJmYWNlIElWYWxpZFNuaXBwZXRzRXh0ZW5zaW9uUG9pbnQge1xuXHRcdGxhbmd1YWdlOiBzdHJpbmc7XG5cdFx0bG9jYXRpb246IFVSSTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0b1ZhbGlkU25pcHBldChleHRlbnNpb246IElFeHRlbnNpb25Qb2ludFVzZXI8SVNuaXBwZXRzRXh0ZW5zaW9uUG9pbnRbXT4sIHNuaXBwZXQ6IElTbmlwcGV0c0V4dGVuc2lvblBvaW50LCBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UpOiBJVmFsaWRTbmlwcGV0c0V4dGVuc2lvblBvaW50IHwgbnVsbCB7XG5cblx0XHRpZiAoaXNGYWxzeU9yV2hpdGVzcGFjZShzbmlwcGV0LnBhdGgpKSB7XG5cdFx0XHRleHRlbnNpb24uY29sbGVjdG9yLmVycm9yKGxvY2FsaXplKFxuXHRcdFx0XHQnaW52YWxpZC5wYXRoLjAnLFxuXHRcdFx0XHRcIkV4cGVjdGVkIHN0cmluZyBpbiBgY29udHJpYnV0ZXMuezB9LnBhdGhgLiBQcm92aWRlZCB2YWx1ZTogezF9XCIsXG5cdFx0XHRcdGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5uYW1lLCBTdHJpbmcoc25pcHBldC5wYXRoKVxuXHRcdFx0KSk7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAoaXNGYWxzeU9yV2hpdGVzcGFjZShzbmlwcGV0Lmxhbmd1YWdlKSAmJiAhc25pcHBldC5wYXRoLmVuZHNXaXRoKCcuY29kZS1zbmlwcGV0cycpKSB7XG5cdFx0XHRleHRlbnNpb24uY29sbGVjdG9yLmVycm9yKGxvY2FsaXplKFxuXHRcdFx0XHQnaW52YWxpZC5sYW5ndWFnZS4wJyxcblx0XHRcdFx0XCJXaGVuIG9taXR0aW5nIHRoZSBsYW5ndWFnZSwgdGhlIHZhbHVlIG9mIGBjb250cmlidXRlcy57MH0ucGF0aGAgbXVzdCBiZSBhIGAuY29kZS1zbmlwcGV0c2AtZmlsZS4gUHJvdmlkZWQgdmFsdWU6IHsxfVwiLFxuXHRcdFx0XHRleHRlbnNpb24uZGVzY3JpcHRpb24ubmFtZSwgU3RyaW5nKHNuaXBwZXQucGF0aClcblx0XHRcdCkpO1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0aWYgKCFpc0ZhbHN5T3JXaGl0ZXNwYWNlKHNuaXBwZXQubGFuZ3VhZ2UpICYmICFsYW5ndWFnZVNlcnZpY2UuaXNSZWdpc3RlcmVkTGFuZ3VhZ2VJZChzbmlwcGV0Lmxhbmd1YWdlKSkge1xuXHRcdFx0ZXh0ZW5zaW9uLmNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZShcblx0XHRcdFx0J2ludmFsaWQubGFuZ3VhZ2UnLFxuXHRcdFx0XHRcIlVua25vd24gbGFuZ3VhZ2UgaW4gYGNvbnRyaWJ1dGVzLnswfS5sYW5ndWFnZWAuIFByb3ZpZGVkIHZhbHVlOiB7MX1cIixcblx0XHRcdFx0ZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLm5hbWUsIFN0cmluZyhzbmlwcGV0Lmxhbmd1YWdlKVxuXHRcdFx0KSk7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblxuXHRcdH1cblxuXHRcdGNvbnN0IGV4dGVuc2lvbkxvY2F0aW9uID0gZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmV4dGVuc2lvbkxvY2F0aW9uO1xuXHRcdGNvbnN0IHNuaXBwZXRMb2NhdGlvbiA9IHJlc291cmNlcy5qb2luUGF0aChleHRlbnNpb25Mb2NhdGlvbiwgc25pcHBldC5wYXRoKTtcblx0XHRpZiAoIXJlc291cmNlcy5pc0VxdWFsT3JQYXJlbnQoc25pcHBldExvY2F0aW9uLCBleHRlbnNpb25Mb2NhdGlvbikpIHtcblx0XHRcdGV4dGVuc2lvbi5jb2xsZWN0b3IuZXJyb3IobG9jYWxpemUoXG5cdFx0XHRcdCdpbnZhbGlkLnBhdGguMScsXG5cdFx0XHRcdFwiRXhwZWN0ZWQgYGNvbnRyaWJ1dGVzLnswfS5wYXRoYCAoezF9KSB0byBiZSBpbmNsdWRlZCBpbnNpZGUgZXh0ZW5zaW9uJ3MgZm9sZGVyICh7Mn0pLiBUaGlzIG1pZ2h0IG1ha2UgdGhlIGV4dGVuc2lvbiBub24tcG9ydGFibGUuXCIsXG5cdFx0XHRcdGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5uYW1lLCBzbmlwcGV0TG9jYXRpb24ucGF0aCwgZXh0ZW5zaW9uTG9jYXRpb24ucGF0aFxuXHRcdFx0KSk7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0bGFuZ3VhZ2U6IHNuaXBwZXQubGFuZ3VhZ2UsXG5cdFx0XHRsb2NhdGlvbjogc25pcHBldExvY2F0aW9uXG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBjb25zdCBzbmlwcGV0c0NvbnRyaWJ1dGlvbjogSUpTT05TY2hlbWEgPSB7XG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnNuaXBwZXRzJywgJ0NvbnRyaWJ1dGVzIHNuaXBwZXRzLicpLFxuXHRcdHR5cGU6ICdhcnJheScsXG5cdFx0ZGVmYXVsdFNuaXBwZXRzOiBbeyBib2R5OiBbeyBsYW5ndWFnZTogJycsIHBhdGg6ICcnIH1dIH1dLFxuXHRcdGl0ZW1zOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogeyBsYW5ndWFnZTogJyR7MTppZH0nLCBwYXRoOiAnLi9zbmlwcGV0cy8kezI6aWR9Lmpzb24uJyB9IH1dLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRsYW5ndWFnZToge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5zbmlwcGV0cy1sYW5ndWFnZScsICdMYW5ndWFnZSBpZGVudGlmaWVyIGZvciB3aGljaCB0aGlzIHNuaXBwZXQgaXMgY29udHJpYnV0ZWQgdG8uJyksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fSxcblx0XHRcdFx0cGF0aDoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5zbmlwcGV0cy1wYXRoJywgJ1BhdGggb2YgdGhlIHNuaXBwZXRzIGZpbGUuIFRoZSBwYXRoIGlzIHJlbGF0aXZlIHRvIHRoZSBleHRlbnNpb24gZm9sZGVyIGFuZCB0eXBpY2FsbHkgc3RhcnRzIHdpdGggXFwnLi9zbmlwcGV0cy9cXCcuJyksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fTtcblxuXHRleHBvcnQgY29uc3QgcG9pbnQgPSBFeHRlbnNpb25zUmVnaXN0cnkucmVnaXN0ZXJFeHRlbnNpb25Qb2ludDxzbmlwcGV0RXh0LklTbmlwcGV0c0V4dGVuc2lvblBvaW50W10+KHtcblx0XHRleHRlbnNpb25Qb2ludDogJ3NuaXBwZXRzJyxcblx0XHRkZXBzOiBbbGFuZ3VhZ2VzRXh0UG9pbnRdLFxuXHRcdGpzb25TY2hlbWE6IHNuaXBwZXRFeHQuc25pcHBldHNDb250cmlidXRpb25cblx0fSk7XG59XG5cbmZ1bmN0aW9uIHdhdGNoKHNlcnZpY2U6IElGaWxlU2VydmljZSwgcmVzb3VyY2U6IFVSSSwgY2FsbGJhY2s6ICgpID0+IHVua25vd24pOiBJRGlzcG9zYWJsZSB7XG5cdHJldHVybiBjb21iaW5lZERpc3Bvc2FibGUoXG5cdFx0c2VydmljZS53YXRjaChyZXNvdXJjZSksXG5cdFx0c2VydmljZS5vbkRpZEZpbGVzQ2hhbmdlKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0cyhyZXNvdXJjZSkpIHtcblx0XHRcdFx0Y2FsbGJhY2soKTtcblx0XHRcdH1cblx0XHR9KVxuXHQpO1xufVxuXG5jbGFzcyBTbmlwcGV0RW5hYmxlbWVudCB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2tleSA9ICdzbmlwcGV0cy5pZ25vcmVkU25pcHBldHMnO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2lnbm9yZWQ6IFNldDxzdHJpbmc+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0KSB7XG5cblx0XHRjb25zdCByYXcgPSBfc3RvcmFnZVNlcnZpY2UuZ2V0KFNuaXBwZXRFbmFibGVtZW50Ll9rZXksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCAnJyk7XG5cdFx0bGV0IGRhdGE6IHN0cmluZ1tdIHwgdW5kZWZpbmVkO1xuXHRcdHRyeSB7XG5cdFx0XHRkYXRhID0gSlNPTi5wYXJzZShyYXcpO1xuXHRcdH0gY2F0Y2ggeyB9XG5cblx0XHR0aGlzLl9pZ25vcmVkID0gaXNTdHJpbmdBcnJheShkYXRhKSA/IG5ldyBTZXQoZGF0YSkgOiBuZXcgU2V0KCk7XG5cdH1cblxuXHRpc0lnbm9yZWQoaWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9pZ25vcmVkLmhhcyhpZCk7XG5cdH1cblxuXHR1cGRhdGVJZ25vcmVkKGlkOiBzdHJpbmcsIHZhbHVlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0bGV0IGNoYW5nZWQgPSBmYWxzZTtcblx0XHRpZiAodGhpcy5faWdub3JlZC5oYXMoaWQpICYmICF2YWx1ZSkge1xuXHRcdFx0dGhpcy5faWdub3JlZC5kZWxldGUoaWQpO1xuXHRcdFx0Y2hhbmdlZCA9IHRydWU7XG5cdFx0fSBlbHNlIGlmICghdGhpcy5faWdub3JlZC5oYXMoaWQpICYmIHZhbHVlKSB7XG5cdFx0XHR0aGlzLl9pZ25vcmVkLmFkZChpZCk7XG5cdFx0XHRjaGFuZ2VkID0gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKGNoYW5nZWQpIHtcblx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKFNuaXBwZXRFbmFibGVtZW50Ll9rZXksIEpTT04uc3RyaW5naWZ5KEFycmF5LmZyb20odGhpcy5faWdub3JlZCkpLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgU25pcHBldFVzYWdlVGltZXN0YW1wcyB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2tleSA9ICdzbmlwcGV0cy51c2FnZVRpbWVzdGFtcHMnO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3VzYWdlczogTWFwPHN0cmluZywgbnVtYmVyPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdCkge1xuXG5cdFx0Y29uc3QgcmF3ID0gX3N0b3JhZ2VTZXJ2aWNlLmdldChTbmlwcGV0VXNhZ2VUaW1lc3RhbXBzLl9rZXksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCAnJyk7XG5cdFx0bGV0IGRhdGE6IFtzdHJpbmcsIG51bWJlcl1bXSB8IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0ZGF0YSA9IEpTT04ucGFyc2UocmF3KTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdGRhdGEgPSBbXTtcblx0XHR9XG5cblx0XHR0aGlzLl91c2FnZXMgPSBBcnJheS5pc0FycmF5KGRhdGEpID8gbmV3IE1hcChkYXRhKSA6IG5ldyBNYXAoKTtcblx0fVxuXG5cdGdldFVzYWdlVGltZXN0YW1wKGlkOiBzdHJpbmcpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl91c2FnZXMuZ2V0KGlkKTtcblx0fVxuXG5cdHVwZGF0ZVVzYWdlVGltZXN0YW1wKGlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHQvLyBtYXAgdXNlcyBpbnNlcnRpb24gb3JkZXIsIHdlIHdhbnQgbW9zdCByZWNlbnQgYXQgdGhlIGVuZFxuXHRcdHRoaXMuX3VzYWdlcy5kZWxldGUoaWQpO1xuXHRcdHRoaXMuX3VzYWdlcy5zZXQoaWQsIERhdGUubm93KCkpO1xuXG5cdFx0Ly8gcGVyc2lzdCBsYXN0IDEwMCBpdGVtXG5cdFx0Y29uc3QgYWxsID0gWy4uLnRoaXMuX3VzYWdlc10uc2xpY2UoLTEwMCk7XG5cdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2Uuc3RvcmUoU25pcHBldFVzYWdlVGltZXN0YW1wcy5fa2V5LCBKU09OLnN0cmluZ2lmeShhbGwpLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU25pcHBldHNTZXJ2aWNlIGltcGxlbWVudHMgSVNuaXBwZXRzU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3BlbmRpbmdXb3JrOiBQcm9taXNlPGFueT5bXSA9IFtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9maWxlcyA9IG5ldyBSZXNvdXJjZU1hcDxTbmlwcGV0RmlsZT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZW5hYmxlbWVudDogU25pcHBldEVuYWJsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3VzYWdlVGltZXN0YW1wczogU25pcHBldFVzYWdlVGltZXN0YW1wcztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lbnZpcm9ubWVudFNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3VzZXJEYXRhUHJvZmlsZVNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVRleHRGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXh0ZmlsZVNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlOiBJRXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBsaWZlY3ljbGVTZXJ2aWNlOiBJTGlmZWN5Y2xlU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLl9wZW5kaW5nV29yay5wdXNoKFByb21pc2UucmVzb2x2ZShsaWZlY3ljbGVTZXJ2aWNlLndoZW4oTGlmZWN5Y2xlUGhhc2UuUmVzdG9yZWQpLnRoZW4oKCkgPT4ge1xuXHRcdFx0dGhpcy5faW5pdEV4dGVuc2lvblNuaXBwZXRzKCk7XG5cdFx0XHR0aGlzLl9pbml0VXNlclNuaXBwZXRzKCk7XG5cdFx0XHR0aGlzLl9pbml0V29ya3NwYWNlU25pcHBldHMoKTtcblx0XHR9KSkpO1xuXG5cdFx0c2V0U25pcHBldFN1Z2dlc3RTdXBwb3J0KG5ldyBTbmlwcGV0Q29tcGxldGlvblByb3ZpZGVyKHRoaXMuX2xhbmd1YWdlU2VydmljZSwgdGhpcywgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSkpO1xuXG5cdFx0dGhpcy5fZW5hYmxlbWVudCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNuaXBwZXRFbmFibGVtZW50KTtcblx0XHR0aGlzLl91c2FnZVRpbWVzdGFtcHMgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTbmlwcGV0VXNhZ2VUaW1lc3RhbXBzKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0aXNFbmFibGVkKHNuaXBwZXQ6IFNuaXBwZXQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gIXRoaXMuX2VuYWJsZW1lbnQuaXNJZ25vcmVkKHNuaXBwZXQuc25pcHBldElkZW50aWZpZXIpO1xuXHR9XG5cblx0dXBkYXRlRW5hYmxlbWVudChzbmlwcGV0OiBTbmlwcGV0LCBlbmFibGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fZW5hYmxlbWVudC51cGRhdGVJZ25vcmVkKHNuaXBwZXQuc25pcHBldElkZW50aWZpZXIsICFlbmFibGVkKTtcblx0fVxuXG5cdHVwZGF0ZVVzYWdlVGltZXN0YW1wKHNuaXBwZXQ6IFNuaXBwZXQpOiB2b2lkIHtcblx0XHR0aGlzLl91c2FnZVRpbWVzdGFtcHMudXBkYXRlVXNhZ2VUaW1lc3RhbXAoc25pcHBldC5zbmlwcGV0SWRlbnRpZmllcik7XG5cdH1cblxuXHRwcml2YXRlIF9qb2luU25pcHBldHMoKTogUHJvbWlzZTxhbnk+IHtcblx0XHRjb25zdCBwcm9taXNlcyA9IHRoaXMuX3BlbmRpbmdXb3JrLnNsaWNlKDApO1xuXHRcdHRoaXMuX3BlbmRpbmdXb3JrLmxlbmd0aCA9IDA7XG5cdFx0cmV0dXJuIFByb21pc2UuYWxsKHByb21pc2VzKTtcblx0fVxuXG5cdGFzeW5jIGdldFNuaXBwZXRGaWxlcygpOiBQcm9taXNlPEl0ZXJhYmxlPFNuaXBwZXRGaWxlPj4ge1xuXHRcdGF3YWl0IHRoaXMuX2pvaW5TbmlwcGV0cygpO1xuXHRcdHJldHVybiB0aGlzLl9maWxlcy52YWx1ZXMoKTtcblx0fVxuXG5cdGFzeW5jIGdldFNuaXBwZXRzKGxhbmd1YWdlSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgb3B0cz86IElTbmlwcGV0R2V0T3B0aW9ucyk6IFByb21pc2U8U25pcHBldFtdPiB7XG5cdFx0YXdhaXQgdGhpcy5fam9pblNuaXBwZXRzKCk7XG5cblx0XHRjb25zdCByZXN1bHQ6IFNuaXBwZXRbXSA9IFtdO1xuXHRcdGNvbnN0IHByb21pc2VzOiBQcm9taXNlPGFueT5bXSA9IFtdO1xuXG5cdFx0aWYgKGxhbmd1YWdlSWQpIHtcblx0XHRcdGlmICh0aGlzLl9sYW5ndWFnZVNlcnZpY2UuaXNSZWdpc3RlcmVkTGFuZ3VhZ2VJZChsYW5ndWFnZUlkKSkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgdGhpcy5fZmlsZXMudmFsdWVzKCkpIHtcblx0XHRcdFx0XHRwcm9taXNlcy5wdXNoKGZpbGUubG9hZCgpXG5cdFx0XHRcdFx0XHQudGhlbihmaWxlID0+IGZpbGUuc2VsZWN0KGxhbmd1YWdlSWQsIHJlc3VsdCkpXG5cdFx0XHRcdFx0XHQuY2F0Y2goZXJyID0+IHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoZXJyLCBmaWxlLmxvY2F0aW9uLnRvU3RyaW5nKCkpKVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9yIChjb25zdCBmaWxlIG9mIHRoaXMuX2ZpbGVzLnZhbHVlcygpKSB7XG5cdFx0XHRcdHByb21pc2VzLnB1c2goZmlsZS5sb2FkKClcblx0XHRcdFx0XHQudGhlbihmaWxlID0+IGluc2VydEludG8ocmVzdWx0LCByZXN1bHQubGVuZ3RoLCBmaWxlLmRhdGEpKVxuXHRcdFx0XHRcdC5jYXRjaChlcnIgPT4gdGhpcy5fbG9nU2VydmljZS5lcnJvcihlcnIsIGZpbGUubG9jYXRpb24udG9TdHJpbmcoKSkpXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcblx0XHRyZXR1cm4gdGhpcy5fZmlsdGVyQW5kU29ydFNuaXBwZXRzKHJlc3VsdCwgb3B0cyk7XG5cdH1cblxuXHRnZXRTbmlwcGV0c1N5bmMobGFuZ3VhZ2VJZDogc3RyaW5nLCBvcHRzPzogSVNuaXBwZXRHZXRPcHRpb25zKTogU25pcHBldFtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFNuaXBwZXRbXSA9IFtdO1xuXHRcdGlmICh0aGlzLl9sYW5ndWFnZVNlcnZpY2UuaXNSZWdpc3RlcmVkTGFuZ3VhZ2VJZChsYW5ndWFnZUlkKSkge1xuXHRcdFx0Zm9yIChjb25zdCBmaWxlIG9mIHRoaXMuX2ZpbGVzLnZhbHVlcygpKSB7XG5cdFx0XHRcdC8vIGtpY2sgb2ZmIGxvYWRpbmcgKHdoaWNoIGlzIGEgbm9vcCBpbiBjYXNlIGl0J3MgYWxyZWFkeSBsb2FkZWQpXG5cdFx0XHRcdC8vIGFuZCBvcHRpbWlzdGljYWxseSBjb2xsZWN0IHNuaXBwZXRzXG5cdFx0XHRcdGZpbGUubG9hZCgpLmNhdGNoKF9lcnIgPT4geyAvKmlnbm9yZSovIH0pO1xuXHRcdFx0XHRmaWxlLnNlbGVjdChsYW5ndWFnZUlkLCByZXN1bHQpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fZmlsdGVyQW5kU29ydFNuaXBwZXRzKHJlc3VsdCwgb3B0cyk7XG5cdH1cblxuXHRwcml2YXRlIF9maWx0ZXJBbmRTb3J0U25pcHBldHMoc25pcHBldHM6IFNuaXBwZXRbXSwgb3B0cz86IElTbmlwcGV0R2V0T3B0aW9ucyk6IFNuaXBwZXRbXSB7XG5cblx0XHRjb25zdCByZXN1bHQ6IFNuaXBwZXRbXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBzbmlwcGV0IG9mIHNuaXBwZXRzKSB7XG5cdFx0XHRpZiAoIXNuaXBwZXQucHJlZml4ICYmICFvcHRzPy5pbmNsdWRlTm9QcmVmaXhTbmlwcGV0cykge1xuXHRcdFx0XHQvLyBwcmVmaXggb3Igbm8tcHJlZml4IHdhbnRlZFxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGlmICghdGhpcy5pc0VuYWJsZWQoc25pcHBldCkgJiYgIW9wdHM/LmluY2x1ZGVEaXNhYmxlZFNuaXBwZXRzKSB7XG5cdFx0XHRcdC8vIGVuYWJsZWQgb3IgZGlzYWJsZWQgd2FudGVkXG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHR5cGVvZiBvcHRzPy5maWxlVGVtcGxhdGVTbmlwcGV0cyA9PT0gJ2Jvb2xlYW4nICYmIG9wdHMuZmlsZVRlbXBsYXRlU25pcHBldHMgIT09IHNuaXBwZXQuaXNGaWxlVGVtcGxhdGUpIHtcblx0XHRcdFx0Ly8gaXNUb3BMZXZlbCByZXF1ZXN0ZWQgYnV0IG1pc21hdGNoaW5nXG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0LnB1c2goc25pcHBldCk7XG5cdFx0fVxuXG5cblx0XHRyZXR1cm4gcmVzdWx0LnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdGxldCByZXN1bHQgPSAwO1xuXHRcdFx0aWYgKCFvcHRzPy5ub1JlY2VuY3lTb3J0KSB7XG5cdFx0XHRcdGNvbnN0IHZhbDEgPSB0aGlzLl91c2FnZVRpbWVzdGFtcHMuZ2V0VXNhZ2VUaW1lc3RhbXAoYS5zbmlwcGV0SWRlbnRpZmllcikgPz8gLTE7XG5cdFx0XHRcdGNvbnN0IHZhbDIgPSB0aGlzLl91c2FnZVRpbWVzdGFtcHMuZ2V0VXNhZ2VUaW1lc3RhbXAoYi5zbmlwcGV0SWRlbnRpZmllcikgPz8gLTE7XG5cdFx0XHRcdHJlc3VsdCA9IHZhbDIgLSB2YWwxO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHJlc3VsdCA9PT0gMCkge1xuXHRcdFx0XHRyZXN1bHQgPSB0aGlzLl9jb21wYXJlU25pcHBldChhLCBiKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9jb21wYXJlU25pcHBldChhOiBTbmlwcGV0LCBiOiBTbmlwcGV0KTogbnVtYmVyIHtcblx0XHRpZiAoYS5zbmlwcGV0U291cmNlIDwgYi5zbmlwcGV0U291cmNlKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fSBlbHNlIGlmIChhLnNuaXBwZXRTb3VyY2UgPiBiLnNuaXBwZXRTb3VyY2UpIHtcblx0XHRcdHJldHVybiAxO1xuXHRcdH0gZWxzZSBpZiAoYS5zb3VyY2UgPCBiLnNvdXJjZSkge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH0gZWxzZSBpZiAoYS5zb3VyY2UgPiBiLnNvdXJjZSkge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fSBlbHNlIGlmIChhLm5hbWUgPiBiLm5hbWUpIHtcblx0XHRcdHJldHVybiAxO1xuXHRcdH0gZWxzZSBpZiAoYS5uYW1lIDwgYi5uYW1lKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblx0fVxuXG5cdC8vIC0tLSBsb2FkaW5nLCB3YXRjaGluZ1xuXG5cdHByaXZhdGUgX2luaXRFeHRlbnNpb25TbmlwcGV0cygpOiB2b2lkIHtcblx0XHRzbmlwcGV0RXh0LnBvaW50LnNldEhhbmRsZXIoZXh0ZW5zaW9ucyA9PiB7XG5cblx0XHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIHRoaXMuX2ZpbGVzKSB7XG5cdFx0XHRcdGlmICh2YWx1ZS5zb3VyY2UgPT09IFNuaXBwZXRTb3VyY2UuRXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0dGhpcy5fZmlsZXMuZGVsZXRlKGtleSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZXh0ZW5zaW9ucykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGNvbnRyaWJ1dGlvbiBvZiBleHRlbnNpb24udmFsdWUpIHtcblx0XHRcdFx0XHRjb25zdCB2YWxpZENvbnRyaWJ1dGlvbiA9IHNuaXBwZXRFeHQudG9WYWxpZFNuaXBwZXQoZXh0ZW5zaW9uLCBjb250cmlidXRpb24sIHRoaXMuX2xhbmd1YWdlU2VydmljZSk7XG5cdFx0XHRcdFx0aWYgKCF2YWxpZENvbnRyaWJ1dGlvbikge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgZmlsZSA9IHRoaXMuX2ZpbGVzLmdldCh2YWxpZENvbnRyaWJ1dGlvbi5sb2NhdGlvbik7XG5cdFx0XHRcdFx0aWYgKGZpbGUpIHtcblx0XHRcdFx0XHRcdGlmIChmaWxlLmRlZmF1bHRTY29wZXMpIHtcblx0XHRcdFx0XHRcdFx0ZmlsZS5kZWZhdWx0U2NvcGVzLnB1c2godmFsaWRDb250cmlidXRpb24ubGFuZ3VhZ2UpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0ZmlsZS5kZWZhdWx0U2NvcGVzID0gW107XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNvbnN0IGZpbGUgPSBuZXcgU25pcHBldEZpbGUoU25pcHBldFNvdXJjZS5FeHRlbnNpb24sIHZhbGlkQ29udHJpYnV0aW9uLmxvY2F0aW9uLCB2YWxpZENvbnRyaWJ1dGlvbi5sYW5ndWFnZSA/IFt2YWxpZENvbnRyaWJ1dGlvbi5sYW5ndWFnZV0gOiB1bmRlZmluZWQsIGV4dGVuc2lvbi5kZXNjcmlwdGlvbiwgdGhpcy5fZmlsZVNlcnZpY2UsIHRoaXMuX2V4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZSk7XG5cdFx0XHRcdFx0XHR0aGlzLl9maWxlcy5zZXQoZmlsZS5sb2NhdGlvbiwgZmlsZSk7XG5cblx0XHRcdFx0XHRcdGlmICh0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuaXNFeHRlbnNpb25EZXZlbG9wbWVudCkge1xuXHRcdFx0XHRcdFx0XHRmaWxlLmxvYWQoKS50aGVuKGZpbGUgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdC8vIHdhcm4gYWJvdXQgYmFkIHRhYnN0b3AvdmFyaWFibGUgdXNhZ2Vcblx0XHRcdFx0XHRcdFx0XHRpZiAoZmlsZS5kYXRhLnNvbWUoc25pcHBldCA9PiBzbmlwcGV0LmlzQm9nb3VzKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZXh0ZW5zaW9uLmNvbGxlY3Rvci53YXJuKGxvY2FsaXplKFxuXHRcdFx0XHRcdFx0XHRcdFx0XHQnYmFkVmFyaWFibGVVc2UnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcIk9uZSBvciBtb3JlIHNuaXBwZXRzIGZyb20gdGhlIGV4dGVuc2lvbiAnezB9JyB2ZXJ5IGxpa2VseSBjb25mdXNlIHNuaXBwZXQtdmFyaWFibGVzIGFuZCBzbmlwcGV0LXBsYWNlaG9sZGVycyAoc2VlIGh0dHBzOi8vY29kZS52aXN1YWxzdHVkaW8uY29tL2RvY3MvZWRpdG9yL3VzZXJkZWZpbmVkc25pcHBldHMjX3NuaXBwZXQtc3ludGF4IGZvciBtb3JlIGRldGFpbHMpXCIsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5uYW1lXG5cdFx0XHRcdFx0XHRcdFx0XHQpKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0sIGVyciA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0Ly8gZ2VuZXJpYyBlcnJvclxuXHRcdFx0XHRcdFx0XHRcdGV4dGVuc2lvbi5jb2xsZWN0b3Iud2Fybihsb2NhbGl6ZShcblx0XHRcdFx0XHRcdFx0XHRcdCdiYWRGaWxlJyxcblx0XHRcdFx0XHRcdFx0XHRcdFwiVGhlIHNuaXBwZXQgZmlsZSBcXFwiezB9XFxcIiBjb3VsZCBub3QgYmUgcmVhZC5cIixcblx0XHRcdFx0XHRcdFx0XHRcdGZpbGUubG9jYXRpb24udG9TdHJpbmcoKVxuXHRcdFx0XHRcdFx0XHRcdCkpO1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfaW5pdFdvcmtzcGFjZVNuaXBwZXRzKCk6IHZvaWQge1xuXHRcdC8vIHdvcmtzcGFjZSBzdHVmZlxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHVwZGF0ZVdvcmtzcGFjZVNuaXBwZXRzID0gKCkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRcdHRoaXMuX3BlbmRpbmdXb3JrLnB1c2godGhpcy5faW5pdFdvcmtzcGFjZUZvbGRlclNuaXBwZXRzKHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLCBkaXNwb3NhYmxlcykpO1xuXHRcdH07XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKGRpc3Bvc2FibGVzKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fY29udGV4dFNlcnZpY2Uub25EaWRDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzKHVwZGF0ZVdvcmtzcGFjZVNuaXBwZXRzKSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX2NvbnRleHRTZXJ2aWNlLm9uRGlkQ2hhbmdlV29ya2JlbmNoU3RhdGUodXBkYXRlV29ya3NwYWNlU25pcHBldHMpKTtcblx0XHR1cGRhdGVXb3Jrc3BhY2VTbmlwcGV0cygpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfaW5pdFdvcmtzcGFjZUZvbGRlclNuaXBwZXRzKHdvcmtzcGFjZTogSVdvcmtzcGFjZSwgYnVja2V0OiBEaXNwb3NhYmxlU3RvcmUpOiBQcm9taXNlPGFueT4ge1xuXHRcdGNvbnN0IHByb21pc2VzID0gd29ya3NwYWNlLmZvbGRlcnMubWFwKGFzeW5jIGZvbGRlciA9PiB7XG5cdFx0XHRjb25zdCBzbmlwcGV0Rm9sZGVyID0gZm9sZGVyLnRvUmVzb3VyY2UoJy52c2NvZGUnKTtcblx0XHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5fZmlsZVNlcnZpY2UuZXhpc3RzKHNuaXBwZXRGb2xkZXIpO1xuXHRcdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRcdHRoaXMuX2luaXRGb2xkZXJTbmlwcGV0cyhTbmlwcGV0U291cmNlLldvcmtzcGFjZSwgc25pcHBldEZvbGRlciwgYnVja2V0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIHdhdGNoXG5cdFx0XHRcdGJ1Y2tldC5hZGQodGhpcy5fZmlsZVNlcnZpY2Uub25EaWRGaWxlc0NoYW5nZShlID0+IHtcblx0XHRcdFx0XHRpZiAoZS5jb250YWlucyhzbmlwcGV0Rm9sZGVyLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCkpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2luaXRGb2xkZXJTbmlwcGV0cyhTbmlwcGV0U291cmNlLldvcmtzcGFjZSwgc25pcHBldEZvbGRlciwgYnVja2V0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9pbml0VXNlclNuaXBwZXRzKCk6IFByb21pc2U8YW55PiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgdXBkYXRlVXNlclNuaXBwZXRzID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRcdGNvbnN0IHVzZXJTbmlwcGV0c0ZvbGRlciA9IHRoaXMuX3VzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuc25pcHBldHNIb21lO1xuXHRcdFx0YXdhaXQgdGhpcy5fZmlsZVNlcnZpY2UuY3JlYXRlRm9sZGVyKHVzZXJTbmlwcGV0c0ZvbGRlcik7XG5cdFx0XHRhd2FpdCB0aGlzLl9pbml0Rm9sZGVyU25pcHBldHMoU25pcHBldFNvdXJjZS5Vc2VyLCB1c2VyU25pcHBldHNGb2xkZXIsIGRpc3Bvc2FibGVzKTtcblx0XHR9O1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChkaXNwb3NhYmxlcyk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX3VzZXJEYXRhUHJvZmlsZVNlcnZpY2Uub25EaWRDaGFuZ2VDdXJyZW50UHJvZmlsZShlID0+IGUuam9pbigoYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhpcy5fcGVuZGluZ1dvcmsucHVzaCh1cGRhdGVVc2VyU25pcHBldHMoKSk7XG5cdFx0fSkoKSkpKTtcblx0XHRhd2FpdCB1cGRhdGVVc2VyU25pcHBldHMoKTtcblx0fVxuXG5cdHByaXZhdGUgX2luaXRGb2xkZXJTbmlwcGV0cyhzb3VyY2U6IFNuaXBwZXRTb3VyY2UsIGZvbGRlcjogVVJJLCBidWNrZXQ6IERpc3Bvc2FibGVTdG9yZSk6IFByb21pc2U8YW55PiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgYWRkRm9sZGVyU25pcHBldHMgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdFx0aWYgKCFhd2FpdCB0aGlzLl9maWxlU2VydmljZS5leGlzdHMoZm9sZGVyKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5fZmlsZVNlcnZpY2UucmVzb2x2ZShmb2xkZXIpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHN0YXQuY2hpbGRyZW4gfHwgW10pIHtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5fYWRkU25pcHBldEZpbGUoZW50cnkucmVzb3VyY2UsIHNvdXJjZSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihgRmFpbGVkIHNuaXBwZXRzIGZyb20gZm9sZGVyICcke2ZvbGRlci50b1N0cmluZygpfSdgLCBlcnIpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRidWNrZXQuYWRkKHRoaXMuX3RleHRmaWxlU2VydmljZS5maWxlcy5vbkRpZFNhdmUoZSA9PiB7XG5cdFx0XHRpZiAocmVzb3VyY2VzLmlzRXF1YWxPclBhcmVudChlLm1vZGVsLnJlc291cmNlLCBmb2xkZXIpKSB7XG5cdFx0XHRcdGFkZEZvbGRlclNuaXBwZXRzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGJ1Y2tldC5hZGQod2F0Y2godGhpcy5fZmlsZVNlcnZpY2UsIGZvbGRlciwgYWRkRm9sZGVyU25pcHBldHMpKTtcblx0XHRidWNrZXQuYWRkKGRpc3Bvc2FibGVzKTtcblx0XHRyZXR1cm4gYWRkRm9sZGVyU25pcHBldHMoKTtcblx0fVxuXG5cdHByaXZhdGUgX2FkZFNuaXBwZXRGaWxlKHVyaTogVVJJLCBzb3VyY2U6IFNuaXBwZXRTb3VyY2UpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgZXh0ID0gcmVzb3VyY2VzLmV4dG5hbWUodXJpKTtcblx0XHRpZiAoc291cmNlID09PSBTbmlwcGV0U291cmNlLlVzZXIgJiYgZXh0ID09PSAnLmpzb24nKSB7XG5cdFx0XHRjb25zdCBsYW5nTmFtZSA9IHJlc291cmNlcy5iYXNlbmFtZSh1cmkpLnJlcGxhY2UoL1xcLmpzb24vLCAnJyk7XG5cdFx0XHR0aGlzLl9maWxlcy5zZXQodXJpLCBuZXcgU25pcHBldEZpbGUoc291cmNlLCB1cmksIFtsYW5nTmFtZV0sIHVuZGVmaW5lZCwgdGhpcy5fZmlsZVNlcnZpY2UsIHRoaXMuX2V4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZSkpO1xuXHRcdH0gZWxzZSBpZiAoZXh0ID09PSAnLmNvZGUtc25pcHBldHMnKSB7XG5cdFx0XHR0aGlzLl9maWxlcy5zZXQodXJpLCBuZXcgU25pcHBldEZpbGUoc291cmNlLCB1cmksIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0aGlzLl9maWxlU2VydmljZSwgdGhpcy5fZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlKSk7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB0aGlzLl9maWxlcy5kZWxldGUodXJpKVxuXHRcdH07XG5cdH1cbn1cblxuXG5leHBvcnQgaW50ZXJmYWNlIElTaW1wbGVNb2RlbCB7XG5cdGdldExpbmVDb250ZW50KGxpbmVOdW1iZXI6IG51bWJlcik6IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE5vbldoaXRlc3BhY2VQcmVmaXgobW9kZWw6IElTaW1wbGVNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uKTogc3RyaW5nIHtcblx0LyoqXG5cdCAqIERvIG5vdCBhbmFseXplIG1vcmUgY2hhcmFjdGVyc1xuXHQgKi9cblx0Y29uc3QgTUFYX1BSRUZJWF9MRU5HVEggPSAxMDA7XG5cblx0Y29uc3QgbGluZSA9IG1vZGVsLmdldExpbmVDb250ZW50KHBvc2l0aW9uLmxpbmVOdW1iZXIpLnN1YnN0cigwLCBwb3NpdGlvbi5jb2x1bW4gLSAxKTtcblxuXHRjb25zdCBtaW5DaEluZGV4ID0gTWF0aC5tYXgoMCwgbGluZS5sZW5ndGggLSBNQVhfUFJFRklYX0xFTkdUSCk7XG5cdGZvciAobGV0IGNoSW5kZXggPSBsaW5lLmxlbmd0aCAtIDE7IGNoSW5kZXggPj0gbWluQ2hJbmRleDsgY2hJbmRleC0tKSB7XG5cdFx0Y29uc3QgY2ggPSBsaW5lLmNoYXJBdChjaEluZGV4KTtcblxuXHRcdGlmICgvXFxzLy50ZXN0KGNoKSkge1xuXHRcdFx0cmV0dXJuIGxpbmUuc3Vic3RyKGNoSW5kZXggKyAxKTtcblx0XHR9XG5cdH1cblxuXHRpZiAobWluQ2hJbmRleCA9PT0gMCkge1xuXHRcdHJldHVybiBsaW5lO1xuXHR9XG5cblx0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QSxNQUNqRjtBQUFBLElBQ0Q7QUFFQSxXQUFPLElBQUksS0FBSyxpQkFBaUIsTUFBTSxVQUFVLE9BQUs7QUFDckQsVUFBSSxVQUFVLGdCQUFnQixFQUFFLE1BQU0sVUFBVSxNQUFNLEdBQUc7QUFDeEQsMEJBQWtCO0FBQUEsTUFDbkI7QUFBQSxJQUNELENBQUMsQ0FBQztBQUNGLFdBQU8sSUFBSSxNQUFNLEtBQUssY0FBYyxRQUFRLGlCQUFpQixDQUFDO0FBQzlELFdBQU8sSUFBSSxXQUFXO0FBQ3RCLFdBQU8sa0JBQWtCO0FBQUEsRUFDMUI7QUFBQSxFQUVRLGdCQUFnQixLQUFVLFFBQW9DO0FBQ3JFLFVBQU0sTUFBTSxVQUFVLFFBQVEsR0FBRztBQUNqQyxRQUFJLFdBQVcsY0FBYyxRQUFRLFFBQVEsU0FBUztBQUNyRCxZQUFNLFdBQVcsVUFBVSxTQUFTLEdBQUcsRUFBRSxRQUFRLFVBQVUsRUFBRTtBQUM3RCxXQUFLLE9BQU8sSUFBSSxLQUFLLElBQUksWUFBWSxRQUFRLEtBQUssQ0FBQyxRQUFRLEdBQUcsUUFBVyxLQUFLLGNBQWMsS0FBSywrQkFBK0IsQ0FBQztBQUFBLElBQ2xJLFdBQVcsUUFBUSxrQkFBa0I7QUFDcEMsV0FBSyxPQUFPLElBQUksS0FBSyxJQUFJLFlBQVksUUFBUSxLQUFLLFFBQVcsUUFBVyxLQUFLLGNBQWMsS0FBSywrQkFBK0IsQ0FBQztBQUFBLElBQ2pJO0FBQ0EsV0FBTztBQUFBLE1BQ04sU0FBUyxNQUFNLEtBQUssT0FBTyxPQUFPLEdBQUc7QUFBQSxJQUN0QztBQUFBLEVBQ0Q7QUFDRDtBQXZTYSxrQkFBTjtBQUFBLEVBV0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FyQlU7QUE4U04sU0FBUyx1QkFBdUIsT0FBcUIsVUFBNEI7QUFJdkYsUUFBTSxvQkFBb0I7QUFFMUIsUUFBTSxPQUFPLE1BQU0sZUFBZSxTQUFTLFVBQVUsRUFBRSxPQUFPLEdBQUcsU0FBUyxTQUFTLENBQUM7QUFFcEYsUUFBTSxhQUFhLEtBQUssSUFBSSxHQUFHLEtBQUssU0FBUyxpQkFBaUI7QUFDOUQsV0FBUyxVQUFVLEtBQUssU0FBUyxHQUFHLFdBQVcsWUFBWSxXQUFXO0FBQ3JFLFVBQU0sS0FBSyxLQUFLLE9BQU8sT0FBTztBQUU5QixRQUFJLEtBQUssS0FBSyxFQUFFLEdBQUc7QUFDbEIsYUFBTyxLQUFLLE9BQU8sVUFBVSxDQUFDO0FBQUEsSUFDL0I7QUFBQSxFQUNEO0FBRUEsTUFBSSxlQUFlLEdBQUc7QUFDckIsV0FBTztBQUFBLEVBQ1I7QUFFQSxTQUFPO0FBQ1I7IiwKICAibmFtZXMiOiBbInNuaXBwZXRFeHQiLCAiZmlsZSIsICJyZXN1bHQiXQp9Cg==
