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
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { basename } from "../../../../../base/common/path.js";
import { URI } from "../../../../../base/common/uri.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { GeneralShellType } from "../../../../../platform/terminal/common/terminal.js";
import { TerminalSuggestSettingId } from "../common/terminalSuggestConfiguration.js";
import { TerminalCompletionItemKind } from "./terminalCompletionItem.js";
import { env as processEnv } from "../../../../../base/common/process.js";
import { timeout } from "../../../../../base/common/async.js";
const ITerminalCompletionService = createDecorator("terminalCompletionService");
class TerminalCompletionList {
  /**
   * Creates a new completion list.
   *
   * @param items The completion items.
   * @param isIncomplete The list is not complete.
   */
  constructor(items, resourceRequestConfig) {
    this.items = items;
    this.resourceRequestConfig = resourceRequestConfig;
  }
}
let TerminalCompletionService = class extends Disposable {
  constructor(_configurationService, _fileService) {
    super();
    this._configurationService = _configurationService;
    this._fileService = _fileService;
    this._providers = /* @__PURE__ */ new Map();
    this._processEnv = processEnv;
  }
  get providers() {
    return this._providersGenerator();
  }
  *_providersGenerator() {
    for (const providerMap of this._providers.values()) {
      for (const provider of providerMap.values()) {
        yield provider;
      }
    }
  }
  /** Overrides the environment for testing purposes. */
  set processEnv(env) {
    this._processEnv = env;
  }
  registerTerminalCompletionProvider(extensionIdentifier, id, provider, ...triggerCharacters) {
    let extMap = this._providers.get(extensionIdentifier);
    if (!extMap) {
      extMap = /* @__PURE__ */ new Map();
      this._providers.set(extensionIdentifier, extMap);
    }
    provider.triggerCharacters = triggerCharacters;
    provider.id = id;
    extMap.set(id, provider);
    return toDisposable(() => {
      const extMap2 = this._providers.get(extensionIdentifier);
      if (extMap2) {
        extMap2.delete(id);
        if (extMap2.size === 0) {
          this._providers.delete(extensionIdentifier);
        }
      }
    });
  }
  async provideCompletions(promptValue, cursorPosition, allowFallbackCompletions, shellType, capabilities, token, triggerCharacter, skipExtensionCompletions) {
    if (!this._providers || !this._providers.values || cursorPosition < 0) {
      return void 0;
    }
    let providers;
    if (triggerCharacter) {
      const providersToRequest = [];
      for (const provider of this.providers) {
        if (!provider.triggerCharacters) {
          continue;
        }
        for (const char of provider.triggerCharacters) {
          if (promptValue.substring(0, cursorPosition)?.endsWith(char)) {
            providersToRequest.push(provider);
            break;
          }
        }
      }
      providers = providersToRequest;
    } else {
      providers = [...this._providers.values()].flatMap((providerMap) => [...providerMap.values()]);
    }
    if (skipExtensionCompletions) {
      providers = providers.filter((p) => p.isBuiltin);
      return this._collectCompletions(providers, shellType, promptValue, cursorPosition, allowFallbackCompletions, capabilities, token);
    }
    const providerConfig = this._configurationService.getValue(TerminalSuggestSettingId.Providers);
    providers = providers.filter((p) => {
      const providerId = p.id;
      return providerId && providerId in providerConfig && providerConfig[providerId] !== false;
    });
    if (!providers.length) {
      return;
    }
    return this._collectCompletions(providers, shellType, promptValue, cursorPosition, allowFallbackCompletions, capabilities, token);
  }
  async _collectCompletions(providers, shellType, promptValue, cursorPosition, allowFallbackCompletions, capabilities, token) {
    const completionPromises = providers.map(async (provider) => {
      if (provider.shellTypes && !provider.shellTypes.includes(shellType)) {
        return void 0;
      }
      const completions = await Promise.race([
        provider.provideCompletions(promptValue, cursorPosition, allowFallbackCompletions, token),
        timeout(5e3)
      ]);
      if (!completions) {
        return void 0;
      }
      const completionItems = Array.isArray(completions) ? completions : completions.items ?? [];
      if (shellType === GeneralShellType.PowerShell) {
        for (const completion of completionItems) {
          completion.isFileOverride ??= completion.kind === TerminalCompletionItemKind.Method && completion.replacementIndex === 0;
        }
      }
      if (provider.isBuiltin) {
        for (const item of completionItems) {
          item.provider = provider.id;
        }
      }
      if (Array.isArray(completions)) {
        return completionItems;
      }
      if (completions.resourceRequestConfig) {
        const resourceCompletions = await this.resolveResources(completions.resourceRequestConfig, promptValue, cursorPosition, provider.id, capabilities);
        if (resourceCompletions) {
          completionItems.push(...resourceCompletions);
        }
      }
      return completionItems;
    });
    const results = await Promise.all(completionPromises);
    return results.filter((result) => !!result).flat();
  }
  async resolveResources(resourceRequestConfig, promptValue, cursorPosition, provider, capabilities) {
    const useWindowsStylePath = resourceRequestConfig.pathSeparator === "\\";
    if (useWindowsStylePath) {
      promptValue = promptValue.replaceAll(/[\\/]/g, resourceRequestConfig.pathSeparator);
    }
    const foldersRequested = (resourceRequestConfig.foldersRequested || resourceRequestConfig.filesRequested) ?? false;
    const filesRequested = resourceRequestConfig.filesRequested ?? false;
    const fileExtensions = resourceRequestConfig.fileExtensions ?? void 0;
    const cwd = URI.revive(resourceRequestConfig.cwd);
    if (!cwd || !foldersRequested && !filesRequested) {
      return;
    }
    const resourceCompletions = [];
    const cursorPrefix = promptValue.substring(0, cursorPosition);
    const lastWord = cursorPrefix.endsWith(" ") ? "" : cursorPrefix.split(/(?<!\\) /).at(-1) ?? "";
    let lastSlashIndex;
    if (useWindowsStylePath) {
      let lastBackslashIndex = -1;
      for (let i = lastWord.length - 1; i >= 0; i--) {
        if (lastWord[i] === "\\") {
          if (i === lastWord.length - 1 || lastWord[i + 1] !== " ") {
            lastBackslashIndex = i;
            break;
          }
        }
      }
      lastSlashIndex = Math.max(lastBackslashIndex, lastWord.lastIndexOf("/"));
    } else {
      lastSlashIndex = lastWord.lastIndexOf(resourceRequestConfig.pathSeparator);
    }
    let lastWordFolder = lastSlashIndex === -1 ? "" : lastWord.slice(0, lastSlashIndex + 1);
    if (useWindowsStylePath) {
      lastWordFolder = lastWordFolder.replaceAll("/", "\\");
    }
    let lastWordFolderResource;
    const lastWordFolderHasDotPrefix = !!lastWordFolder.match(/^\.\.?[\\\/]/);
    const lastWordFolderHasTildePrefix = !!lastWordFolder.match(/^~[\\\/]?/);
    const isAbsolutePath = useWindowsStylePath ? /^[a-zA-Z]:[\\\/]/.test(lastWord) : lastWord.startsWith(resourceRequestConfig.pathSeparator);
    const type = lastWordFolderHasTildePrefix ? "tilde" : isAbsolutePath ? "absolute" : "relative";
    switch (type) {
      case "tilde": {
        const home = this._getHomeDir(useWindowsStylePath, capabilities);
        if (home) {
          lastWordFolderResource = URI.joinPath(URI.file(home), lastWordFolder.slice(1).replaceAll("\\ ", " "));
        }
        if (!lastWordFolderResource) {
          if (lastWord.match(/^~[\\\/]$/)) {
            lastWordFolderResource = useWindowsStylePath ? "Home directory" : "$HOME";
          }
        }
        break;
      }
      case "absolute": {
        lastWordFolderResource = URI.file(lastWordFolder.replaceAll("\\ ", " "));
        break;
      }
      case "relative": {
        lastWordFolderResource = cwd;
        break;
      }
    }
    if (!lastWordFolderResource) {
      return void 0;
    }
    if (typeof lastWordFolderResource === "string") {
      resourceCompletions.push({
        label: lastWordFolder,
        provider,
        kind: TerminalCompletionItemKind.Folder,
        detail: lastWordFolderResource,
        replacementIndex: cursorPosition - lastWord.length,
        replacementLength: lastWord.length
      });
      return resourceCompletions;
    }
    const stat = await this._fileService.resolve(lastWordFolderResource, { resolveSingleChildDescendants: true });
    if (!stat?.children) {
      return;
    }
    if (foldersRequested) {
      let label;
      switch (type) {
        case "tilde": {
          label = lastWordFolder;
          break;
        }
        case "absolute": {
          label = lastWordFolder;
          break;
        }
        case "relative": {
          label = ".";
          if (lastWordFolder.length > 0) {
            label = addPathRelativePrefix(lastWordFolder, resourceRequestConfig, lastWordFolderHasDotPrefix);
          }
          break;
        }
      }
      resourceCompletions.push({
        label,
        provider,
        kind: TerminalCompletionItemKind.Folder,
        detail: getFriendlyPath(lastWordFolderResource, resourceRequestConfig.pathSeparator, TerminalCompletionItemKind.Folder),
        replacementIndex: cursorPosition - lastWord.length,
        replacementLength: lastWord.length
      });
    }
    for (const child of stat.children) {
      let kind;
      if (foldersRequested && child.isDirectory) {
        kind = TerminalCompletionItemKind.Folder;
      } else if (filesRequested && child.isFile) {
        kind = TerminalCompletionItemKind.File;
      }
      if (kind === void 0) {
        continue;
      }
      let label = lastWordFolder;
      if (label.length > 0 && !label.endsWith(resourceRequestConfig.pathSeparator)) {
        label += resourceRequestConfig.pathSeparator;
      }
      label += child.name;
      if (type === "relative") {
        label = addPathRelativePrefix(label, resourceRequestConfig, lastWordFolderHasDotPrefix);
      }
      if (child.isDirectory && !label.endsWith(resourceRequestConfig.pathSeparator)) {
        label += resourceRequestConfig.pathSeparator;
      }
      if (child.isFile && fileExtensions) {
        const extension = child.name.split(".").length > 1 ? child.name.split(".").at(-1) : void 0;
        if (extension && !fileExtensions.includes(extension)) {
          continue;
        }
      }
      resourceCompletions.push({
        label,
        provider,
        kind,
        detail: getFriendlyPath(child.resource, resourceRequestConfig.pathSeparator, kind),
        replacementIndex: cursorPosition - lastWord.length,
        replacementLength: lastWord.length
      });
    }
    if (type === "relative" && foldersRequested) {
      if (promptValue.startsWith("cd ")) {
        const config = this._configurationService.getValue(TerminalSuggestSettingId.CdPath);
        if (config === "absolute" || config === "relative") {
          const cdPath = this._getEnvVar("CDPATH", capabilities);
          if (cdPath) {
            const cdPathEntries = cdPath.split(useWindowsStylePath ? ";" : ":");
            for (const cdPathEntry of cdPathEntries) {
              try {
                const fileStat = await this._fileService.resolve(URI.file(cdPathEntry), { resolveSingleChildDescendants: true });
                if (fileStat?.children) {
                  for (const child of fileStat.children) {
                    if (!child.isDirectory) {
                      continue;
                    }
                    const useRelative = config === "relative";
                    const kind = TerminalCompletionItemKind.Folder;
                    const label = useRelative ? basename(child.resource.fsPath) : getFriendlyPath(child.resource, resourceRequestConfig.pathSeparator, kind);
                    const detail = useRelative ? `CDPATH ${getFriendlyPath(child.resource, resourceRequestConfig.pathSeparator, kind)}` : `CDPATH`;
                    resourceCompletions.push({
                      label,
                      provider,
                      kind,
                      detail,
                      replacementIndex: cursorPosition - lastWord.length,
                      replacementLength: lastWord.length
                    });
                  }
                }
              } catch {
              }
            }
          }
        }
      }
    }
    if (type === "relative" && foldersRequested) {
      let label = `..${resourceRequestConfig.pathSeparator}`;
      if (lastWordFolder.length > 0) {
        label = addPathRelativePrefix(lastWordFolder + label, resourceRequestConfig, lastWordFolderHasDotPrefix);
      }
      const parentDir = URI.joinPath(cwd, ".." + resourceRequestConfig.pathSeparator);
      resourceCompletions.push({
        label,
        provider,
        kind: TerminalCompletionItemKind.Folder,
        detail: getFriendlyPath(parentDir, resourceRequestConfig.pathSeparator, TerminalCompletionItemKind.Folder),
        replacementIndex: cursorPosition - lastWord.length,
        replacementLength: lastWord.length
      });
    }
    if (type === "relative" && !lastWordFolder.match(/[\\\/]/)) {
      let homeResource;
      const home = this._getHomeDir(useWindowsStylePath, capabilities);
      if (home) {
        homeResource = URI.joinPath(URI.file(home), lastWordFolder.slice(1).replaceAll("\\ ", " "));
      }
      if (!homeResource) {
        homeResource = useWindowsStylePath ? "Home directory" : "$HOME";
      }
      resourceCompletions.push({
        label: "~",
        provider,
        kind: TerminalCompletionItemKind.Folder,
        detail: typeof homeResource === "string" ? homeResource : getFriendlyPath(homeResource, resourceRequestConfig.pathSeparator, TerminalCompletionItemKind.Folder),
        replacementIndex: cursorPosition - lastWord.length,
        replacementLength: lastWord.length
      });
    }
    return resourceCompletions;
  }
  _getEnvVar(key, capabilities) {
    const env = capabilities.get(TerminalCapability.ShellEnvDetection)?.env?.value;
    if (env) {
      return env[key];
    }
    return this._processEnv[key];
  }
  _getHomeDir(useWindowsStylePath, capabilities) {
    return useWindowsStylePath ? this._getEnvVar("USERPROFILE", capabilities) : this._getEnvVar("HOME", capabilities);
  }
};
TerminalCompletionService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IFileService)
], TerminalCompletionService);
function getFriendlyPath(uri, pathSeparator, kind) {
  let path = uri.fsPath;
  if (kind === TerminalCompletionItemKind.Folder && !path.endsWith(pathSeparator)) {
    path += pathSeparator;
  }
  if (pathSeparator === "\\" && path.match(/^[a-zA-Z]:\\/)) {
    path = `${path[0].toUpperCase()}:${path.slice(2)}`;
  }
  return path;
}
function addPathRelativePrefix(text, resourceRequestConfig, lastWordFolderHasDotPrefix) {
  if (!lastWordFolderHasDotPrefix) {
    return `.${resourceRequestConfig.pathSeparator}${text}`;
  }
  return text;
}
export {
  ITerminalCompletionService,
  TerminalCompletionList,
  TerminalCompletionService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvc3VnZ2VzdC9icm93c2VyL3Rlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENhcGFiaWxpdHksIHR5cGUgSVRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jYXBhYmlsaXRpZXMuanMnO1xuaW1wb3J0IHsgR2VuZXJhbFNoZWxsVHlwZSwgVGVybWluYWxTaGVsbFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxTdWdnZXN0U2V0dGluZ0lkIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsU3VnZ2VzdENvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQsIHR5cGUgSVRlcm1pbmFsQ29tcGxldGlvbiB9IGZyb20gJy4vdGVybWluYWxDb21wbGV0aW9uSXRlbS5qcyc7XG5pbXBvcnQgeyBlbnYgYXMgcHJvY2Vzc0VudiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Byb2Nlc3MuanMnO1xuaW1wb3J0IHR5cGUgeyBJUHJvY2Vzc0Vudmlyb25tZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcblxuZXhwb3J0IGNvbnN0IElUZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElUZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlPigndGVybWluYWxDb21wbGV0aW9uU2VydmljZScpO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBjb2xsZWN0aW9uIG9mIHtAbGluayBDb21wbGV0aW9uSXRlbSBjb21wbGV0aW9uIGl0ZW1zfSB0byBiZSBwcmVzZW50ZWRcbiAqIGluIHRoZSB0ZXJtaW5hbC5cbiAqL1xuZXhwb3J0IGNsYXNzIFRlcm1pbmFsQ29tcGxldGlvbkxpc3Q8SVRlcm1pbmFsQ29tcGxldGlvbj4ge1xuXG5cdC8qKlxuXHQgKiBSZXNvdXJjZXMgc2hvdWxkIGJlIHNob3duIGluIHRoZSBjb21wbGV0aW9ucyBsaXN0XG5cdCAqL1xuXHRyZXNvdXJjZVJlcXVlc3RDb25maWc/OiBUZXJtaW5hbFJlc291cmNlUmVxdWVzdENvbmZpZztcblxuXHQvKipcblx0ICogVGhlIGNvbXBsZXRpb24gaXRlbXMuXG5cdCAqL1xuXHRpdGVtcz86IElUZXJtaW5hbENvbXBsZXRpb25bXTtcblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIG5ldyBjb21wbGV0aW9uIGxpc3QuXG5cdCAqXG5cdCAqIEBwYXJhbSBpdGVtcyBUaGUgY29tcGxldGlvbiBpdGVtcy5cblx0ICogQHBhcmFtIGlzSW5jb21wbGV0ZSBUaGUgbGlzdCBpcyBub3QgY29tcGxldGUuXG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihpdGVtcz86IElUZXJtaW5hbENvbXBsZXRpb25bXSwgcmVzb3VyY2VSZXF1ZXN0Q29uZmlnPzogVGVybWluYWxSZXNvdXJjZVJlcXVlc3RDb25maWcpIHtcblx0XHR0aGlzLml0ZW1zID0gaXRlbXM7XG5cdFx0dGhpcy5yZXNvdXJjZVJlcXVlc3RDb25maWcgPSByZXNvdXJjZVJlcXVlc3RDb25maWc7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBUZXJtaW5hbFJlc291cmNlUmVxdWVzdENvbmZpZyB7XG5cdGZpbGVzUmVxdWVzdGVkPzogYm9vbGVhbjtcblx0Zm9sZGVyc1JlcXVlc3RlZD86IGJvb2xlYW47XG5cdGZpbGVFeHRlbnNpb25zPzogc3RyaW5nW107XG5cdGN3ZD86IFVyaUNvbXBvbmVudHM7XG5cdHBhdGhTZXBhcmF0b3I6IHN0cmluZztcblx0ZW52PzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkIH07XG59XG5cblxuZXhwb3J0IGludGVyZmFjZSBJVGVybWluYWxDb21wbGV0aW9uUHJvdmlkZXIge1xuXHRpZDogc3RyaW5nO1xuXHRzaGVsbFR5cGVzPzogVGVybWluYWxTaGVsbFR5cGVbXTtcblx0cHJvdmlkZUNvbXBsZXRpb25zKHZhbHVlOiBzdHJpbmcsIGN1cnNvclBvc2l0aW9uOiBudW1iZXIsIGFsbG93RmFsbGJhY2tDb21wbGV0aW9uczogYm9vbGVhbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJVGVybWluYWxDb21wbGV0aW9uW10gfCBUZXJtaW5hbENvbXBsZXRpb25MaXN0PElUZXJtaW5hbENvbXBsZXRpb24+IHwgdW5kZWZpbmVkPjtcblx0dHJpZ2dlckNoYXJhY3RlcnM/OiBzdHJpbmdbXTtcblx0aXNCdWlsdGluPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGVybWluYWxDb21wbGV0aW9uU2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgcHJvdmlkZXJzOiBJdGVyYWJsZUl0ZXJhdG9yPElUZXJtaW5hbENvbXBsZXRpb25Qcm92aWRlcj47XG5cdHJlZ2lzdGVyVGVybWluYWxDb21wbGV0aW9uUHJvdmlkZXIoZXh0ZW5zaW9uSWRlbnRpZmllcjogc3RyaW5nLCBpZDogc3RyaW5nLCBwcm92aWRlcjogSVRlcm1pbmFsQ29tcGxldGlvblByb3ZpZGVyLCAuLi50cmlnZ2VyQ2hhcmFjdGVyczogc3RyaW5nW10pOiBJRGlzcG9zYWJsZTtcblx0cHJvdmlkZUNvbXBsZXRpb25zKHByb21wdFZhbHVlOiBzdHJpbmcsIGN1cnNvclBvc2l0aW9uOiBudW1iZXIsIGFsbG93RmFsbGJhY2tDb21wbGV0aW9uczogYm9vbGVhbiwgc2hlbGxUeXBlOiBUZXJtaW5hbFNoZWxsVHlwZSwgY2FwYWJpbGl0aWVzOiBJVGVybWluYWxDYXBhYmlsaXR5U3RvcmUsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiwgdHJpZ2dlckNoYXJhY3Rlcj86IGJvb2xlYW4sIHNraXBFeHRlbnNpb25Db21wbGV0aW9ucz86IGJvb2xlYW4pOiBQcm9taXNlPElUZXJtaW5hbENvbXBsZXRpb25bXSB8IHVuZGVmaW5lZD47XG59XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlIHtcblx0ZGVjbGFyZSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyczogTWFwPC8qZXh0IGlkKi9zdHJpbmcsIE1hcDwvKnByb3ZpZGVyIGlkKi9zdHJpbmcsIElUZXJtaW5hbENvbXBsZXRpb25Qcm92aWRlcj4+ID0gbmV3IE1hcCgpO1xuXG5cdGdldCBwcm92aWRlcnMoKTogSXRlcmFibGVJdGVyYXRvcjxJVGVybWluYWxDb21wbGV0aW9uUHJvdmlkZXI+IHtcblx0XHRyZXR1cm4gdGhpcy5fcHJvdmlkZXJzR2VuZXJhdG9yKCk7XG5cdH1cblxuXHRwcml2YXRlICpfcHJvdmlkZXJzR2VuZXJhdG9yKCk6IEl0ZXJhYmxlSXRlcmF0b3I8SVRlcm1pbmFsQ29tcGxldGlvblByb3ZpZGVyPiB7XG5cdFx0Zm9yIChjb25zdCBwcm92aWRlck1hcCBvZiB0aGlzLl9wcm92aWRlcnMudmFsdWVzKCkpIHtcblx0XHRcdGZvciAoY29uc3QgcHJvdmlkZXIgb2YgcHJvdmlkZXJNYXAudmFsdWVzKCkpIHtcblx0XHRcdFx0eWllbGQgcHJvdmlkZXI7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqIE92ZXJyaWRlcyB0aGUgZW52aXJvbm1lbnQgZm9yIHRlc3RpbmcgcHVycG9zZXMuICovXG5cdHNldCBwcm9jZXNzRW52KGVudjogSVByb2Nlc3NFbnZpcm9ubWVudCkgeyB0aGlzLl9wcm9jZXNzRW52ID0gZW52OyB9XG5cdHByaXZhdGUgX3Byb2Nlc3NFbnYgPSBwcm9jZXNzRW52O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2ZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRyZWdpc3RlclRlcm1pbmFsQ29tcGxldGlvblByb3ZpZGVyKGV4dGVuc2lvbklkZW50aWZpZXI6IHN0cmluZywgaWQ6IHN0cmluZywgcHJvdmlkZXI6IElUZXJtaW5hbENvbXBsZXRpb25Qcm92aWRlciwgLi4udHJpZ2dlckNoYXJhY3RlcnM6IHN0cmluZ1tdKTogSURpc3Bvc2FibGUge1xuXHRcdGxldCBleHRNYXAgPSB0aGlzLl9wcm92aWRlcnMuZ2V0KGV4dGVuc2lvbklkZW50aWZpZXIpO1xuXHRcdGlmICghZXh0TWFwKSB7XG5cdFx0XHRleHRNYXAgPSBuZXcgTWFwKCk7XG5cdFx0XHR0aGlzLl9wcm92aWRlcnMuc2V0KGV4dGVuc2lvbklkZW50aWZpZXIsIGV4dE1hcCk7XG5cdFx0fVxuXHRcdHByb3ZpZGVyLnRyaWdnZXJDaGFyYWN0ZXJzID0gdHJpZ2dlckNoYXJhY3RlcnM7XG5cdFx0cHJvdmlkZXIuaWQgPSBpZDtcblx0XHRleHRNYXAuc2V0KGlkLCBwcm92aWRlcik7XG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRjb25zdCBleHRNYXAgPSB0aGlzLl9wcm92aWRlcnMuZ2V0KGV4dGVuc2lvbklkZW50aWZpZXIpO1xuXHRcdFx0aWYgKGV4dE1hcCkge1xuXHRcdFx0XHRleHRNYXAuZGVsZXRlKGlkKTtcblx0XHRcdFx0aWYgKGV4dE1hcC5zaXplID09PSAwKSB7XG5cdFx0XHRcdFx0dGhpcy5fcHJvdmlkZXJzLmRlbGV0ZShleHRlbnNpb25JZGVudGlmaWVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcHJvdmlkZUNvbXBsZXRpb25zKHByb21wdFZhbHVlOiBzdHJpbmcsIGN1cnNvclBvc2l0aW9uOiBudW1iZXIsIGFsbG93RmFsbGJhY2tDb21wbGV0aW9uczogYm9vbGVhbiwgc2hlbGxUeXBlOiBUZXJtaW5hbFNoZWxsVHlwZSwgY2FwYWJpbGl0aWVzOiBJVGVybWluYWxDYXBhYmlsaXR5U3RvcmUsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiwgdHJpZ2dlckNoYXJhY3Rlcj86IGJvb2xlYW4sIHNraXBFeHRlbnNpb25Db21wbGV0aW9ucz86IGJvb2xlYW4pOiBQcm9taXNlPElUZXJtaW5hbENvbXBsZXRpb25bXSB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghdGhpcy5fcHJvdmlkZXJzIHx8ICF0aGlzLl9wcm92aWRlcnMudmFsdWVzIHx8IGN1cnNvclBvc2l0aW9uIDwgMCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRsZXQgcHJvdmlkZXJzO1xuXHRcdGlmICh0cmlnZ2VyQ2hhcmFjdGVyKSB7XG5cdFx0XHRjb25zdCBwcm92aWRlcnNUb1JlcXVlc3Q6IElUZXJtaW5hbENvbXBsZXRpb25Qcm92aWRlcltdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IHByb3ZpZGVyIG9mIHRoaXMucHJvdmlkZXJzKSB7XG5cdFx0XHRcdGlmICghcHJvdmlkZXIudHJpZ2dlckNoYXJhY3RlcnMpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRmb3IgKGNvbnN0IGNoYXIgb2YgcHJvdmlkZXIudHJpZ2dlckNoYXJhY3RlcnMpIHtcblx0XHRcdFx0XHRpZiAocHJvbXB0VmFsdWUuc3Vic3RyaW5nKDAsIGN1cnNvclBvc2l0aW9uKT8uZW5kc1dpdGgoY2hhcikpIHtcblx0XHRcdFx0XHRcdHByb3ZpZGVyc1RvUmVxdWVzdC5wdXNoKHByb3ZpZGVyKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cHJvdmlkZXJzID0gcHJvdmlkZXJzVG9SZXF1ZXN0O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRwcm92aWRlcnMgPSBbLi4udGhpcy5fcHJvdmlkZXJzLnZhbHVlcygpXS5mbGF0TWFwKHByb3ZpZGVyTWFwID0+IFsuLi5wcm92aWRlck1hcC52YWx1ZXMoKV0pO1xuXHRcdH1cblxuXHRcdGlmIChza2lwRXh0ZW5zaW9uQ29tcGxldGlvbnMpIHtcblx0XHRcdHByb3ZpZGVycyA9IHByb3ZpZGVycy5maWx0ZXIocCA9PiBwLmlzQnVpbHRpbik7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY29sbGVjdENvbXBsZXRpb25zKHByb3ZpZGVycywgc2hlbGxUeXBlLCBwcm9tcHRWYWx1ZSwgY3Vyc29yUG9zaXRpb24sIGFsbG93RmFsbGJhY2tDb21wbGV0aW9ucywgY2FwYWJpbGl0aWVzLCB0b2tlbik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJvdmlkZXJDb25maWc6IHsgW2tleTogc3RyaW5nXTogYm9vbGVhbiB9ID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGVybWluYWxTdWdnZXN0U2V0dGluZ0lkLlByb3ZpZGVycyk7XG5cdFx0cHJvdmlkZXJzID0gcHJvdmlkZXJzLmZpbHRlcihwID0+IHtcblx0XHRcdGNvbnN0IHByb3ZpZGVySWQgPSBwLmlkO1xuXHRcdFx0cmV0dXJuIHByb3ZpZGVySWQgJiYgcHJvdmlkZXJJZCBpbiBwcm92aWRlckNvbmZpZyAmJiBwcm92aWRlckNvbmZpZ1twcm92aWRlcklkXSAhPT0gZmFsc2U7XG5cdFx0fSk7XG5cblx0XHRpZiAoIXByb3ZpZGVycy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fY29sbGVjdENvbXBsZXRpb25zKHByb3ZpZGVycywgc2hlbGxUeXBlLCBwcm9tcHRWYWx1ZSwgY3Vyc29yUG9zaXRpb24sIGFsbG93RmFsbGJhY2tDb21wbGV0aW9ucywgY2FwYWJpbGl0aWVzLCB0b2tlbik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jb2xsZWN0Q29tcGxldGlvbnMocHJvdmlkZXJzOiBJVGVybWluYWxDb21wbGV0aW9uUHJvdmlkZXJbXSwgc2hlbGxUeXBlOiBUZXJtaW5hbFNoZWxsVHlwZSwgcHJvbXB0VmFsdWU6IHN0cmluZywgY3Vyc29yUG9zaXRpb246IG51bWJlciwgYWxsb3dGYWxsYmFja0NvbXBsZXRpb25zOiBib29sZWFuLCBjYXBhYmlsaXRpZXM6IElUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJVGVybWluYWxDb21wbGV0aW9uW10gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBjb21wbGV0aW9uUHJvbWlzZXMgPSBwcm92aWRlcnMubWFwKGFzeW5jIHByb3ZpZGVyID0+IHtcblx0XHRcdGlmIChwcm92aWRlci5zaGVsbFR5cGVzICYmICFwcm92aWRlci5zaGVsbFR5cGVzLmluY2x1ZGVzKHNoZWxsVHlwZSkpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGNvbXBsZXRpb25zID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdFx0cHJvdmlkZXIucHJvdmlkZUNvbXBsZXRpb25zKHByb21wdFZhbHVlLCBjdXJzb3JQb3NpdGlvbiwgYWxsb3dGYWxsYmFja0NvbXBsZXRpb25zLCB0b2tlbiksXG5cdFx0XHRcdHRpbWVvdXQoNTAwMClcblx0XHRcdF0pO1xuXHRcdFx0aWYgKCFjb21wbGV0aW9ucykge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY29tcGxldGlvbkl0ZW1zID0gQXJyYXkuaXNBcnJheShjb21wbGV0aW9ucykgPyBjb21wbGV0aW9ucyA6IGNvbXBsZXRpb25zLml0ZW1zID8/IFtdO1xuXHRcdFx0aWYgKHNoZWxsVHlwZSA9PT0gR2VuZXJhbFNoZWxsVHlwZS5Qb3dlclNoZWxsKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgY29tcGxldGlvbiBvZiBjb21wbGV0aW9uSXRlbXMpIHtcblx0XHRcdFx0XHRjb21wbGV0aW9uLmlzRmlsZU92ZXJyaWRlID8/PSBjb21wbGV0aW9uLmtpbmQgPT09IFRlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLk1ldGhvZCAmJiBjb21wbGV0aW9uLnJlcGxhY2VtZW50SW5kZXggPT09IDA7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChwcm92aWRlci5pc0J1aWx0aW4pIHtcblx0XHRcdFx0Ly9UT0RPOiB3aHkgaXMgdGhpcyBuZWVkZWQ/XG5cdFx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiBjb21wbGV0aW9uSXRlbXMpIHtcblx0XHRcdFx0XHRpdGVtLnByb3ZpZGVyID0gcHJvdmlkZXIuaWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChBcnJheS5pc0FycmF5KGNvbXBsZXRpb25zKSkge1xuXHRcdFx0XHRyZXR1cm4gY29tcGxldGlvbkl0ZW1zO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGNvbXBsZXRpb25zLnJlc291cmNlUmVxdWVzdENvbmZpZykge1xuXHRcdFx0XHRjb25zdCByZXNvdXJjZUNvbXBsZXRpb25zID0gYXdhaXQgdGhpcy5yZXNvbHZlUmVzb3VyY2VzKGNvbXBsZXRpb25zLnJlc291cmNlUmVxdWVzdENvbmZpZywgcHJvbXB0VmFsdWUsIGN1cnNvclBvc2l0aW9uLCBwcm92aWRlci5pZCwgY2FwYWJpbGl0aWVzKTtcblx0XHRcdFx0aWYgKHJlc291cmNlQ29tcGxldGlvbnMpIHtcblx0XHRcdFx0XHRjb21wbGV0aW9uSXRlbXMucHVzaCguLi5yZXNvdXJjZUNvbXBsZXRpb25zKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGNvbXBsZXRpb25JdGVtcztcblx0XHR9KTtcblxuXHRcdGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChjb21wbGV0aW9uUHJvbWlzZXMpO1xuXHRcdHJldHVybiByZXN1bHRzLmZpbHRlcihyZXN1bHQgPT4gISFyZXN1bHQpLmZsYXQoKTtcblx0fVxuXG5cdGFzeW5jIHJlc29sdmVSZXNvdXJjZXMocmVzb3VyY2VSZXF1ZXN0Q29uZmlnOiBUZXJtaW5hbFJlc291cmNlUmVxdWVzdENvbmZpZywgcHJvbXB0VmFsdWU6IHN0cmluZywgY3Vyc29yUG9zaXRpb246IG51bWJlciwgcHJvdmlkZXI6IHN0cmluZywgY2FwYWJpbGl0aWVzOiBJVGVybWluYWxDYXBhYmlsaXR5U3RvcmUpOiBQcm9taXNlPElUZXJtaW5hbENvbXBsZXRpb25bXSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHVzZVdpbmRvd3NTdHlsZVBhdGggPSByZXNvdXJjZVJlcXVlc3RDb25maWcucGF0aFNlcGFyYXRvciA9PT0gJ1xcXFwnO1xuXHRcdGlmICh1c2VXaW5kb3dzU3R5bGVQYXRoKSB7XG5cdFx0XHQvLyBmb3IgdGVzdHMsIG1ha2Ugc3VyZSB0aGUgcmlnaHQgcGF0aCBzZXBhcmF0b3IgaXMgdXNlZFxuXHRcdFx0cHJvbXB0VmFsdWUgPSBwcm9tcHRWYWx1ZS5yZXBsYWNlQWxsKC9bXFxcXC9dL2csIHJlc291cmNlUmVxdWVzdENvbmZpZy5wYXRoU2VwYXJhdG9yKTtcblx0XHR9XG5cblx0XHQvLyBGaWxlcyByZXF1ZXN0ZWQgaW1wbGllcyBmb2xkZXJzIHJlcXVlc3RlZCBzaW5jZSB0aGUgZmlsZSBjb3VsZCBiZSBpbiBhbnkgZm9sZGVyLiBXZSBjb3VsZFxuXHRcdC8vIHByb3ZpZGUgZGlhZ25vc3RpY3Mgd2hlbiBhIGZvbGRlciBpcyBwcm92aWRlZCB3aGVyZSBhIGZpbGUgaXMgZXhwZWN0ZWQuXG5cdFx0Y29uc3QgZm9sZGVyc1JlcXVlc3RlZCA9IChyZXNvdXJjZVJlcXVlc3RDb25maWcuZm9sZGVyc1JlcXVlc3RlZCB8fCByZXNvdXJjZVJlcXVlc3RDb25maWcuZmlsZXNSZXF1ZXN0ZWQpID8/IGZhbHNlO1xuXHRcdGNvbnN0IGZpbGVzUmVxdWVzdGVkID0gcmVzb3VyY2VSZXF1ZXN0Q29uZmlnLmZpbGVzUmVxdWVzdGVkID8/IGZhbHNlO1xuXHRcdGNvbnN0IGZpbGVFeHRlbnNpb25zID0gcmVzb3VyY2VSZXF1ZXN0Q29uZmlnLmZpbGVFeHRlbnNpb25zID8/IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IGN3ZCA9IFVSSS5yZXZpdmUocmVzb3VyY2VSZXF1ZXN0Q29uZmlnLmN3ZCk7XG5cdFx0aWYgKCFjd2QgfHwgKCFmb2xkZXJzUmVxdWVzdGVkICYmICFmaWxlc1JlcXVlc3RlZCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCByZXNvdXJjZUNvbXBsZXRpb25zOiBJVGVybWluYWxDb21wbGV0aW9uW10gPSBbXTtcblx0XHRjb25zdCBjdXJzb3JQcmVmaXggPSBwcm9tcHRWYWx1ZS5zdWJzdHJpbmcoMCwgY3Vyc29yUG9zaXRpb24pO1xuXG5cdFx0Ly8gVE9ETzogTGV2ZXJhZ2UgRmlnJ3MgdG9rZW5zIGFycmF5IGhlcmU/XG5cdFx0Ly8gVGhlIGxhc3Qgd29yZCAob3IgYXJndW1lbnQpLiBXaGVuIHRoZSBjdXJzb3IgaXMgZm9sbG93aW5nIGEgc3BhY2UgaXQgd2lsbCBiZSB0aGUgZW1wdHlcblx0XHQvLyBzdHJpbmdcblx0XHRjb25zdCBsYXN0V29yZCA9IGN1cnNvclByZWZpeC5lbmRzV2l0aCgnICcpID8gJycgOiBjdXJzb3JQcmVmaXguc3BsaXQoLyg/PCFcXFxcKSAvKS5hdCgtMSkgPz8gJyc7XG5cblx0XHQvLyBHZXQgdGhlIG5lYXJlc3QgZm9sZGVyIHBhdGggZnJvbSB0aGUgcHJlZml4LiBUaGlzIGlnbm9yZXMgZXZlcnl0aGluZyBhZnRlciB0aGUgYC9gIGFzXG5cdFx0Ly8gdGhleSBhcmUgd2hhdCB0cmlnZ2VycyBjaGFuZ2VzIGluIHRoZSBkaXJlY3RvcnkuXG5cdFx0bGV0IGxhc3RTbGFzaEluZGV4OiBudW1iZXI7XG5cdFx0aWYgKHVzZVdpbmRvd3NTdHlsZVBhdGgpIHtcblx0XHRcdC8vIFRPRE86IEZsZXNoIG91dCBlc2NhcGVkIHBhdGggbG9naWMsIGl0IGN1cnJlbnRseSBvbmx5IHBhcnRpYWxseSB3b3Jrc1xuXHRcdFx0bGV0IGxhc3RCYWNrc2xhc2hJbmRleCA9IC0xO1xuXHRcdFx0Zm9yIChsZXQgaSA9IGxhc3RXb3JkLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRcdGlmIChsYXN0V29yZFtpXSA9PT0gJ1xcXFwnKSB7XG5cdFx0XHRcdFx0aWYgKGkgPT09IGxhc3RXb3JkLmxlbmd0aCAtIDEgfHwgbGFzdFdvcmRbaSArIDFdICE9PSAnICcpIHtcblx0XHRcdFx0XHRcdGxhc3RCYWNrc2xhc2hJbmRleCA9IGk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGxhc3RTbGFzaEluZGV4ID0gTWF0aC5tYXgobGFzdEJhY2tzbGFzaEluZGV4LCBsYXN0V29yZC5sYXN0SW5kZXhPZignLycpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGFzdFNsYXNoSW5kZXggPSBsYXN0V29yZC5sYXN0SW5kZXhPZihyZXNvdXJjZVJlcXVlc3RDb25maWcucGF0aFNlcGFyYXRvcik7XG5cdFx0fVxuXG5cdFx0Ly8gVGhlIF9jb21wbGV0ZV8gZm9sZGVyIG9mIHRoZSBsYXN0IHdvcmQuIEZvciBleGFtcGxlIGlmIHRoZSBsYXN0IHdvcmQgaXMgYC4vc3JjL2ZpbGVgLFxuXHRcdC8vIHRoaXMgd2lsbCBiZSBgLi9zcmMvYC4gVGhpcyBhbHNvIGFsd2F5cyBlbmRzIGluIHRoZSBwYXRoIHNlcGFyYXRvciBpZiBpdCBpcyBub3QgdGhlIGVtcHR5XG5cdFx0Ly8gc3RyaW5nIGFuZCBwYXRoIHNlcGFyYXRvcnMgYXJlIG5vcm1hbGl6ZWQgb24gV2luZG93cy5cblx0XHRsZXQgbGFzdFdvcmRGb2xkZXIgPSBsYXN0U2xhc2hJbmRleCA9PT0gLTEgPyAnJyA6IGxhc3RXb3JkLnNsaWNlKDAsIGxhc3RTbGFzaEluZGV4ICsgMSk7XG5cdFx0aWYgKHVzZVdpbmRvd3NTdHlsZVBhdGgpIHtcblx0XHRcdGxhc3RXb3JkRm9sZGVyID0gbGFzdFdvcmRGb2xkZXIucmVwbGFjZUFsbCgnLycsICdcXFxcJyk7XG5cdFx0fVxuXG5cblx0XHQvLyBEZXRlcm1pbmUgdGhlIGN1cnJlbnQgZm9sZGVyIGJlaW5nIHNob3duXG5cdFx0bGV0IGxhc3RXb3JkRm9sZGVyUmVzb3VyY2U6IFVSSSB8IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBsYXN0V29yZEZvbGRlckhhc0RvdFByZWZpeCA9ICEhbGFzdFdvcmRGb2xkZXIubWF0Y2goL15cXC5cXC4/W1xcXFxcXC9dLyk7XG5cdFx0Y29uc3QgbGFzdFdvcmRGb2xkZXJIYXNUaWxkZVByZWZpeCA9ICEhbGFzdFdvcmRGb2xkZXIubWF0Y2goL15+W1xcXFxcXC9dPy8pO1xuXHRcdGNvbnN0IGlzQWJzb2x1dGVQYXRoID0gdXNlV2luZG93c1N0eWxlUGF0aFxuXHRcdFx0PyAvXlthLXpBLVpdOltcXFxcXFwvXS8udGVzdChsYXN0V29yZClcblx0XHRcdDogbGFzdFdvcmQuc3RhcnRzV2l0aChyZXNvdXJjZVJlcXVlc3RDb25maWcucGF0aFNlcGFyYXRvcik7XG5cdFx0Y29uc3QgdHlwZSA9IGxhc3RXb3JkRm9sZGVySGFzVGlsZGVQcmVmaXggPyAndGlsZGUnIDogaXNBYnNvbHV0ZVBhdGggPyAnYWJzb2x1dGUnIDogJ3JlbGF0aXZlJztcblx0XHRzd2l0Y2ggKHR5cGUpIHtcblx0XHRcdGNhc2UgJ3RpbGRlJzoge1xuXHRcdFx0XHRjb25zdCBob21lID0gdGhpcy5fZ2V0SG9tZURpcih1c2VXaW5kb3dzU3R5bGVQYXRoLCBjYXBhYmlsaXRpZXMpO1xuXHRcdFx0XHRpZiAoaG9tZSkge1xuXHRcdFx0XHRcdGxhc3RXb3JkRm9sZGVyUmVzb3VyY2UgPSBVUkkuam9pblBhdGgoVVJJLmZpbGUoaG9tZSksIGxhc3RXb3JkRm9sZGVyLnNsaWNlKDEpLnJlcGxhY2VBbGwoJ1xcXFwgJywgJyAnKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFsYXN0V29yZEZvbGRlclJlc291cmNlKSB7XG5cdFx0XHRcdFx0Ly8gVXNlIGxlc3Mgc3Ryb25nIHdvcmRpbmcgaGVyZSBhcyBpdCdzIG5vdCBhcyBzdHJvbmcgb2YgYSBjb25jZXB0IG9uIFdpbmRvd3Ncblx0XHRcdFx0XHQvLyBhbmQgY291bGQgYmUgbWlzbGVhZGluZ1xuXHRcdFx0XHRcdGlmIChsYXN0V29yZC5tYXRjaCgvXn5bXFxcXFxcL10kLykpIHtcblx0XHRcdFx0XHRcdGxhc3RXb3JkRm9sZGVyUmVzb3VyY2UgPSB1c2VXaW5kb3dzU3R5bGVQYXRoID8gJ0hvbWUgZGlyZWN0b3J5JyA6ICckSE9NRSc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnYWJzb2x1dGUnOiB7XG5cdFx0XHRcdGxhc3RXb3JkRm9sZGVyUmVzb3VyY2UgPSBVUkkuZmlsZShsYXN0V29yZEZvbGRlci5yZXBsYWNlQWxsKCdcXFxcICcsICcgJykpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ3JlbGF0aXZlJzoge1xuXHRcdFx0XHRsYXN0V29yZEZvbGRlclJlc291cmNlID0gY3dkO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBBc3NlbWJsZSBjb21wbGV0aW9ucyBiYXNlZCBvbiB0aGUgcmVzb3VyY2Ugb2YgbGFzdFdvcmRGb2xkZXIuIE5vdGUgdGhhdCBvbiBXaW5kb3dzIHRoZVxuXHRcdC8vIHBhdGggc2VwcmF0b3JzIGFyZSBub3JtYWxpemVkIHRvIGBcXGAuXG5cdFx0aWYgKCFsYXN0V29yZEZvbGRlclJlc291cmNlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIEVhcmx5IGV4aXQgd2l0aCBiYXNpYyBjb21wbGV0aW9uIGlmIHdlIGRvbid0IGtub3cgdGhlIHJlc291cmNlXG5cdFx0aWYgKHR5cGVvZiBsYXN0V29yZEZvbGRlclJlc291cmNlID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmVzb3VyY2VDb21wbGV0aW9ucy5wdXNoKHtcblx0XHRcdFx0bGFiZWw6IGxhc3RXb3JkRm9sZGVyLFxuXHRcdFx0XHRwcm92aWRlcixcblx0XHRcdFx0a2luZDogVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuRm9sZGVyLFxuXHRcdFx0XHRkZXRhaWw6IGxhc3RXb3JkRm9sZGVyUmVzb3VyY2UsXG5cdFx0XHRcdHJlcGxhY2VtZW50SW5kZXg6IGN1cnNvclBvc2l0aW9uIC0gbGFzdFdvcmQubGVuZ3RoLFxuXHRcdFx0XHRyZXBsYWNlbWVudExlbmd0aDogbGFzdFdvcmQubGVuZ3RoXG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiByZXNvdXJjZUNvbXBsZXRpb25zO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXQgPSBhd2FpdCB0aGlzLl9maWxlU2VydmljZS5yZXNvbHZlKGxhc3RXb3JkRm9sZGVyUmVzb3VyY2UsIHsgcmVzb2x2ZVNpbmdsZUNoaWxkRGVzY2VuZGFudHM6IHRydWUgfSk7XG5cdFx0aWYgKCFzdGF0Py5jaGlsZHJlbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIEFkZCBjdXJyZW50IGRpcmVjdG9yeS4gVGhpcyBzaG91bGQgYmUgc2hvd24gYXQgdGhlIHRvcCBiZWNhdXNlIGl0IHdpbGwgYmUgYW4gZXhhY3Rcblx0XHQvLyBtYXRjaCBhbmQgdGhlcmVmb3JlIGhpZ2hsaWdodCB0aGUgZGV0YWlsLCBwbHVzIGl0IGltcHJvdmVzIHRoZSBleHBlcmllbmNlIHdoZW5cblx0XHQvLyBydW5PbkVudGVyIGlzIHVzZWQuXG5cdFx0Ly9cblx0XHQvLyAtIChyZWxhdGl2ZSkgYHxgICAgICAgIC0+IGAuYFxuXHRcdC8vICAgdGhpcyBkb2VzIG5vdCBoYXZlIHRoZSB0cmFpbGluZyBgL2AgaW50ZW50aW9uYWxseSBhcyBpdCdzIGNvbW1vbiB0byBjb21wbGV0ZSB0aGVcblx0XHQvLyAgIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnkgYW5kIHdlIGRvIG5vdCB3YW50IHRvIGNvbXBsZXRlIGAuL2Agd2hlbiBgcnVuT25FbnRlcmAgaXNcblx0XHQvLyAgIHVzZWQuXG5cdFx0Ly8gLSAocmVsYXRpdmUpIGAuL3NyYy98YCAtPiBgLi9zcmMvYFxuXHRcdC8vIC0gKGFic29sdXRlKSBgL3NyYy98YCAgLT4gYC9zcmMvYFxuXHRcdC8vIC0gKHRpbGRlKSAgICBgfi98YCAgICAgLT4gYH4vYFxuXHRcdC8vIC0gKHRpbGRlKSAgICBgfi9zcmMvfGAgLT4gYH4vc3JjL2Bcblx0XHRpZiAoZm9sZGVyc1JlcXVlc3RlZCkge1xuXHRcdFx0bGV0IGxhYmVsOiBzdHJpbmc7XG5cdFx0XHRzd2l0Y2ggKHR5cGUpIHtcblx0XHRcdFx0Y2FzZSAndGlsZGUnOiB7XG5cdFx0XHRcdFx0bGFiZWwgPSBsYXN0V29yZEZvbGRlcjtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlICdhYnNvbHV0ZSc6IHtcblx0XHRcdFx0XHRsYWJlbCA9IGxhc3RXb3JkRm9sZGVyO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ3JlbGF0aXZlJzoge1xuXHRcdFx0XHRcdGxhYmVsID0gJy4nO1xuXHRcdFx0XHRcdGlmIChsYXN0V29yZEZvbGRlci5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHRsYWJlbCA9IGFkZFBhdGhSZWxhdGl2ZVByZWZpeChsYXN0V29yZEZvbGRlciwgcmVzb3VyY2VSZXF1ZXN0Q29uZmlnLCBsYXN0V29yZEZvbGRlckhhc0RvdFByZWZpeCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJlc291cmNlQ29tcGxldGlvbnMucHVzaCh7XG5cdFx0XHRcdGxhYmVsLFxuXHRcdFx0XHRwcm92aWRlcixcblx0XHRcdFx0a2luZDogVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuRm9sZGVyLFxuXHRcdFx0XHRkZXRhaWw6IGdldEZyaWVuZGx5UGF0aChsYXN0V29yZEZvbGRlclJlc291cmNlLCByZXNvdXJjZVJlcXVlc3RDb25maWcucGF0aFNlcGFyYXRvciwgVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuRm9sZGVyKSxcblx0XHRcdFx0cmVwbGFjZW1lbnRJbmRleDogY3Vyc29yUG9zaXRpb24gLSBsYXN0V29yZC5sZW5ndGgsXG5cdFx0XHRcdHJlcGxhY2VtZW50TGVuZ3RoOiBsYXN0V29yZC5sZW5ndGhcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIEFkZCBhbGwgZGlyZWN0IGNoaWxkcmVuIGZpbGVzIG9yIGZvbGRlcnNcblx0XHQvL1xuXHRcdC8vIC0gKHJlbGF0aXZlKSBgY2QgLi9zcmMvYCAgLT4gYGNkIC4vc3JjL2ZvbGRlcjEvYCwgLi4uXG5cdFx0Ly8gLSAoYWJzb2x1dGUpIGBjZCBjOi9zcmMvYCAtPiBgY2QgYzovc3JjL2ZvbGRlcjEvYCwgLi4uXG5cdFx0Ly8gLSAodGlsZGUpICAgIGBjZCB+L3NyYy9gICAtPiBgY2Qgfi9zcmMvZm9sZGVyMS9gLCAuLi5cblx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIHN0YXQuY2hpbGRyZW4pIHtcblx0XHRcdGxldCBraW5kOiBUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZCB8IHVuZGVmaW5lZDtcblx0XHRcdGlmIChmb2xkZXJzUmVxdWVzdGVkICYmIGNoaWxkLmlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdGtpbmQgPSBUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5Gb2xkZXI7XG5cdFx0XHR9IGVsc2UgaWYgKGZpbGVzUmVxdWVzdGVkICYmIGNoaWxkLmlzRmlsZSkge1xuXHRcdFx0XHRraW5kID0gVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuRmlsZTtcblx0XHRcdH1cblx0XHRcdGlmIChraW5kID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGxldCBsYWJlbCA9IGxhc3RXb3JkRm9sZGVyO1xuXHRcdFx0aWYgKGxhYmVsLmxlbmd0aCA+IDAgJiYgIWxhYmVsLmVuZHNXaXRoKHJlc291cmNlUmVxdWVzdENvbmZpZy5wYXRoU2VwYXJhdG9yKSkge1xuXHRcdFx0XHRsYWJlbCArPSByZXNvdXJjZVJlcXVlc3RDb25maWcucGF0aFNlcGFyYXRvcjtcblx0XHRcdH1cblx0XHRcdGxhYmVsICs9IGNoaWxkLm5hbWU7XG5cdFx0XHRpZiAodHlwZSA9PT0gJ3JlbGF0aXZlJykge1xuXHRcdFx0XHRsYWJlbCA9IGFkZFBhdGhSZWxhdGl2ZVByZWZpeChsYWJlbCwgcmVzb3VyY2VSZXF1ZXN0Q29uZmlnLCBsYXN0V29yZEZvbGRlckhhc0RvdFByZWZpeCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoY2hpbGQuaXNEaXJlY3RvcnkgJiYgIWxhYmVsLmVuZHNXaXRoKHJlc291cmNlUmVxdWVzdENvbmZpZy5wYXRoU2VwYXJhdG9yKSkge1xuXHRcdFx0XHRsYWJlbCArPSByZXNvdXJjZVJlcXVlc3RDb25maWcucGF0aFNlcGFyYXRvcjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNoaWxkLmlzRmlsZSAmJiBmaWxlRXh0ZW5zaW9ucykge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb24gPSBjaGlsZC5uYW1lLnNwbGl0KCcuJykubGVuZ3RoID4gMSA/IGNoaWxkLm5hbWUuc3BsaXQoJy4nKS5hdCgtMSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmIChleHRlbnNpb24gJiYgIWZpbGVFeHRlbnNpb25zLmluY2x1ZGVzKGV4dGVuc2lvbikpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXNvdXJjZUNvbXBsZXRpb25zLnB1c2goe1xuXHRcdFx0XHRsYWJlbCxcblx0XHRcdFx0cHJvdmlkZXIsXG5cdFx0XHRcdGtpbmQsXG5cdFx0XHRcdGRldGFpbDogZ2V0RnJpZW5kbHlQYXRoKGNoaWxkLnJlc291cmNlLCByZXNvdXJjZVJlcXVlc3RDb25maWcucGF0aFNlcGFyYXRvciwga2luZCksXG5cdFx0XHRcdHJlcGxhY2VtZW50SW5kZXg6IGN1cnNvclBvc2l0aW9uIC0gbGFzdFdvcmQubGVuZ3RoLFxuXHRcdFx0XHRyZXBsYWNlbWVudExlbmd0aDogbGFzdFdvcmQubGVuZ3RoXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBTdXBwb3J0ICRDRFBBVEggc3BlY2lhbGx5IGZvciB0aGUgYGNkYCBjb21tYW5kIG9ubHlcblx0XHQvL1xuXHRcdC8vIC0gKHJlbGF0aXZlKSBgfGAgLT4gYC9mb28vdnNjb2RlYCAoQ0RQQVRIIGhhcyAvZm9vIHdoaWNoIGNvbnRhaW5zIHZzY29kZSBmb2xkZXIpXG5cdFx0aWYgKHR5cGUgPT09ICdyZWxhdGl2ZScgJiYgZm9sZGVyc1JlcXVlc3RlZCkge1xuXHRcdFx0aWYgKHByb21wdFZhbHVlLnN0YXJ0c1dpdGgoJ2NkICcpKSB7XG5cdFx0XHRcdGNvbnN0IGNvbmZpZyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsU3VnZ2VzdFNldHRpbmdJZC5DZFBhdGgpO1xuXHRcdFx0XHRpZiAoY29uZmlnID09PSAnYWJzb2x1dGUnIHx8IGNvbmZpZyA9PT0gJ3JlbGF0aXZlJykge1xuXHRcdFx0XHRcdGNvbnN0IGNkUGF0aCA9IHRoaXMuX2dldEVudlZhcignQ0RQQVRIJywgY2FwYWJpbGl0aWVzKTtcblx0XHRcdFx0XHRpZiAoY2RQYXRoKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjZFBhdGhFbnRyaWVzID0gY2RQYXRoLnNwbGl0KHVzZVdpbmRvd3NTdHlsZVBhdGggPyAnOycgOiAnOicpO1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBjZFBhdGhFbnRyeSBvZiBjZFBhdGhFbnRyaWVzKSB7XG5cdFx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgZmlsZVN0YXQgPSBhd2FpdCB0aGlzLl9maWxlU2VydmljZS5yZXNvbHZlKFVSSS5maWxlKGNkUGF0aEVudHJ5KSwgeyByZXNvbHZlU2luZ2xlQ2hpbGREZXNjZW5kYW50czogdHJ1ZSB9KTtcblx0XHRcdFx0XHRcdFx0XHRpZiAoZmlsZVN0YXQ/LmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIGZpbGVTdGF0LmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGlmICghY2hpbGQuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjb25zdCB1c2VSZWxhdGl2ZSA9IGNvbmZpZyA9PT0gJ3JlbGF0aXZlJztcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29uc3Qga2luZCA9IFRlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLkZvbGRlcjtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgbGFiZWwgPSB1c2VSZWxhdGl2ZSA/IGJhc2VuYW1lKGNoaWxkLnJlc291cmNlLmZzUGF0aCkgOiBnZXRGcmllbmRseVBhdGgoY2hpbGQucmVzb3VyY2UsIHJlc291cmNlUmVxdWVzdENvbmZpZy5wYXRoU2VwYXJhdG9yLCBraW5kKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgZGV0YWlsID0gdXNlUmVsYXRpdmUgPyBgQ0RQQVRIICR7Z2V0RnJpZW5kbHlQYXRoKGNoaWxkLnJlc291cmNlLCByZXNvdXJjZVJlcXVlc3RDb25maWcucGF0aFNlcGFyYXRvciwga2luZCl9YCA6IGBDRFBBVEhgO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXNvdXJjZUNvbXBsZXRpb25zLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGxhYmVsLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHByb3ZpZGVyLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGtpbmQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGV0YWlsLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHJlcGxhY2VtZW50SW5kZXg6IGN1cnNvclBvc2l0aW9uIC0gbGFzdFdvcmQubGVuZ3RoLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHJlcGxhY2VtZW50TGVuZ3RoOiBsYXN0V29yZC5sZW5ndGhcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9IGNhdGNoIHsgLyogaWdub3JlICovIH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBBZGQgcGFyZW50IGRpcmVjdG9yeSB0byB0aGUgYm90dG9tIG9mIHRoZSBsaXN0IGJlY2F1c2UgaXQncyBub3QgYXMgdXNlZnVsIGFzIG90aGVyIHN1Z2dlc3Rpb25zXG5cdFx0Ly9cblx0XHQvLyAtIChyZWxhdGl2ZSkgYHxgIC0+IGAuLi9gXG5cdFx0Ly8gLSAocmVsYXRpdmUpIGAuL3NyYy98YCAtPiBgLi9zcmMvLi4vYFxuXHRcdGlmICh0eXBlID09PSAncmVsYXRpdmUnICYmIGZvbGRlcnNSZXF1ZXN0ZWQpIHtcblx0XHRcdGxldCBsYWJlbCA9IGAuLiR7cmVzb3VyY2VSZXF1ZXN0Q29uZmlnLnBhdGhTZXBhcmF0b3J9YDtcblx0XHRcdGlmIChsYXN0V29yZEZvbGRlci5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGxhYmVsID0gYWRkUGF0aFJlbGF0aXZlUHJlZml4KGxhc3RXb3JkRm9sZGVyICsgbGFiZWwsIHJlc291cmNlUmVxdWVzdENvbmZpZywgbGFzdFdvcmRGb2xkZXJIYXNEb3RQcmVmaXgpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcGFyZW50RGlyID0gVVJJLmpvaW5QYXRoKGN3ZCwgJy4uJyArIHJlc291cmNlUmVxdWVzdENvbmZpZy5wYXRoU2VwYXJhdG9yKTtcblx0XHRcdHJlc291cmNlQ29tcGxldGlvbnMucHVzaCh7XG5cdFx0XHRcdGxhYmVsLFxuXHRcdFx0XHRwcm92aWRlcixcblx0XHRcdFx0a2luZDogVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuRm9sZGVyLFxuXHRcdFx0XHRkZXRhaWw6IGdldEZyaWVuZGx5UGF0aChwYXJlbnREaXIsIHJlc291cmNlUmVxdWVzdENvbmZpZy5wYXRoU2VwYXJhdG9yLCBUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5Gb2xkZXIpLFxuXHRcdFx0XHRyZXBsYWNlbWVudEluZGV4OiBjdXJzb3JQb3NpdGlvbiAtIGxhc3RXb3JkLmxlbmd0aCxcblx0XHRcdFx0cmVwbGFjZW1lbnRMZW5ndGg6IGxhc3RXb3JkLmxlbmd0aFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gQWRkIHRpbGRlIGZvciBob21lIGRpcmVjdG9yeSBmb3IgcmVsYXRpdmUgcGF0aHMgd2hlbiB0aGVyZSBpcyBubyBwYXRoIHNlcGFyYXRvciBpbiB0aGVcblx0XHQvLyBpbnB1dC5cblx0XHQvL1xuXHRcdC8vIC0gKHJlbGF0aXZlKSBgfGAgLT4gYH5gXG5cdFx0aWYgKHR5cGUgPT09ICdyZWxhdGl2ZScgJiYgIWxhc3RXb3JkRm9sZGVyLm1hdGNoKC9bXFxcXFxcL10vKSkge1xuXHRcdFx0bGV0IGhvbWVSZXNvdXJjZTogVVJJIHwgc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgaG9tZSA9IHRoaXMuX2dldEhvbWVEaXIodXNlV2luZG93c1N0eWxlUGF0aCwgY2FwYWJpbGl0aWVzKTtcblx0XHRcdGlmIChob21lKSB7XG5cdFx0XHRcdGhvbWVSZXNvdXJjZSA9IFVSSS5qb2luUGF0aChVUkkuZmlsZShob21lKSwgbGFzdFdvcmRGb2xkZXIuc2xpY2UoMSkucmVwbGFjZUFsbCgnXFxcXCAnLCAnICcpKTtcblx0XHRcdH1cblx0XHRcdGlmICghaG9tZVJlc291cmNlKSB7XG5cdFx0XHRcdC8vIFVzZSBsZXNzIHN0cm9uZyB3b3JkaW5nIGhlcmUgYXMgaXQncyBub3QgYXMgc3Ryb25nIG9mIGEgY29uY2VwdCBvbiBXaW5kb3dzXG5cdFx0XHRcdC8vIGFuZCBjb3VsZCBiZSBtaXNsZWFkaW5nXG5cdFx0XHRcdGhvbWVSZXNvdXJjZSA9IHVzZVdpbmRvd3NTdHlsZVBhdGggPyAnSG9tZSBkaXJlY3RvcnknIDogJyRIT01FJztcblx0XHRcdH1cblx0XHRcdHJlc291cmNlQ29tcGxldGlvbnMucHVzaCh7XG5cdFx0XHRcdGxhYmVsOiAnficsXG5cdFx0XHRcdHByb3ZpZGVyLFxuXHRcdFx0XHRraW5kOiBUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5Gb2xkZXIsXG5cdFx0XHRcdGRldGFpbDogdHlwZW9mIGhvbWVSZXNvdXJjZSA9PT0gJ3N0cmluZycgPyBob21lUmVzb3VyY2UgOiBnZXRGcmllbmRseVBhdGgoaG9tZVJlc291cmNlLCByZXNvdXJjZVJlcXVlc3RDb25maWcucGF0aFNlcGFyYXRvciwgVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuRm9sZGVyKSxcblx0XHRcdFx0cmVwbGFjZW1lbnRJbmRleDogY3Vyc29yUG9zaXRpb24gLSBsYXN0V29yZC5sZW5ndGgsXG5cdFx0XHRcdHJlcGxhY2VtZW50TGVuZ3RoOiBsYXN0V29yZC5sZW5ndGhcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXNvdXJjZUNvbXBsZXRpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0RW52VmFyKGtleTogc3RyaW5nLCBjYXBhYmlsaXRpZXM6IElUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgZW52ID0gY2FwYWJpbGl0aWVzLmdldChUZXJtaW5hbENhcGFiaWxpdHkuU2hlbGxFbnZEZXRlY3Rpb24pPy5lbnY/LnZhbHVlIGFzIHsgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkIH07XG5cdFx0aWYgKGVudikge1xuXHRcdFx0cmV0dXJuIGVudltrZXldO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcHJvY2Vzc0VudltrZXldO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0SG9tZURpcih1c2VXaW5kb3dzU3R5bGVQYXRoOiBib29sZWFuLCBjYXBhYmlsaXRpZXM6IElUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHVzZVdpbmRvd3NTdHlsZVBhdGggPyB0aGlzLl9nZXRFbnZWYXIoJ1VTRVJQUk9GSUxFJywgY2FwYWJpbGl0aWVzKSA6IHRoaXMuX2dldEVudlZhcignSE9NRScsIGNhcGFiaWxpdGllcyk7XG5cdH1cbn1cblxuZnVuY3Rpb24gZ2V0RnJpZW5kbHlQYXRoKHVyaTogVVJJLCBwYXRoU2VwYXJhdG9yOiBzdHJpbmcsIGtpbmQ6IFRlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kKTogc3RyaW5nIHtcblx0bGV0IHBhdGggPSB1cmkuZnNQYXRoO1xuXHQvLyBFbnN1cmUgZm9sZGVycyBlbmQgd2l0aCB0aGUgcGF0aCBzZXBhcmF0b3IgdG8gZGlmZmVyZW50aWF0ZSBwcmVzZW50YXRpb24gZnJvbSBmaWxlc1xuXHRpZiAoa2luZCA9PT0gVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuRm9sZGVyICYmICFwYXRoLmVuZHNXaXRoKHBhdGhTZXBhcmF0b3IpKSB7XG5cdFx0cGF0aCArPSBwYXRoU2VwYXJhdG9yO1xuXHR9XG5cdC8vIEVuc3VyZSBkcml2ZSBpcyBjYXBpdGFsaXplZCBvbiBXaW5kb3dzXG5cdGlmIChwYXRoU2VwYXJhdG9yID09PSAnXFxcXCcgJiYgcGF0aC5tYXRjaCgvXlthLXpBLVpdOlxcXFwvKSkge1xuXHRcdHBhdGggPSBgJHtwYXRoWzBdLnRvVXBwZXJDYXNlKCl9OiR7cGF0aC5zbGljZSgyKX1gO1xuXHR9XG5cdHJldHVybiBwYXRoO1xufVxuXG4vKipcbiAqIE5vcm1hbGl6ZSBzdWdnZXN0aW9uIHRvIGFkZCBhIC4vIHByZWZpeCB0byB0aGUgc3RhcnQgb2YgdGhlIHBhdGggaWYgdGhlcmUgaXNuJ3Qgb25lIGFscmVhZHkuIFdlXG4gKiBtYXkgd2FudCB0byBjaGFuZ2UgdGhpcyBiZWhhdmlvciBpbiB0aGUgZnV0dXJlIHRvIGdvIHdpdGggd2hhdGV2ZXIgZm9ybWF0IHRoZSB1c2VyIGhhcy5cbiAqL1xuZnVuY3Rpb24gYWRkUGF0aFJlbGF0aXZlUHJlZml4KHRleHQ6IHN0cmluZywgcmVzb3VyY2VSZXF1ZXN0Q29uZmlnOiBQaWNrPFRlcm1pbmFsUmVzb3VyY2VSZXF1ZXN0Q29uZmlnLCAncGF0aFNlcGFyYXRvcic+LCBsYXN0V29yZEZvbGRlckhhc0RvdFByZWZpeDogYm9vbGVhbik6IHN0cmluZyB7XG5cdGlmICghbGFzdFdvcmRGb2xkZXJIYXNEb3RQcmVmaXgpIHtcblx0XHRyZXR1cm4gYC4ke3Jlc291cmNlUmVxdWVzdENvbmZpZy5wYXRoU2VwYXJhdG9yfSR7dGV4dH1gO1xuXHR9XG5cdHJldHVybiB0ZXh0O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFTLFlBQXlCLG9CQUFvQjtBQUN0RCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFdBQTBCO0FBQ25DLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMEJBQXlEO0FBQ2xFLFNBQVMsd0JBQTJDO0FBQ3BELFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsa0NBQTREO0FBQ3JFLFNBQVMsT0FBTyxrQkFBa0I7QUFFbEMsU0FBUyxlQUFlO0FBRWpCLE1BQU0sNkJBQTZCLGdCQUE0QywyQkFBMkI7QUFNMUcsTUFBTSx1QkFBNEM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQWtCeEQsWUFBWSxPQUErQix1QkFBdUQ7QUFDakcsU0FBSyxRQUFRO0FBQ2IsU0FBSyx3QkFBd0I7QUFBQSxFQUM5QjtBQUNEO0FBMkJPLElBQU0sNEJB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LEtBQUssWUFBWSxxQkFBcUIsWUFBWTtBQUMvRCxVQUFJLE1BQU07QUFDVCx1QkFBZSxJQUFJLFNBQVMsSUFBSSxLQUFLLElBQUksR0FBRyxlQUFlLE1BQU0sQ0FBQyxFQUFFLFdBQVcsT0FBTyxHQUFHLENBQUM7QUFBQSxNQUMzRjtBQUNBLFVBQUksQ0FBQyxjQUFjO0FBR2xCLHVCQUFlLHNCQUFzQixtQkFBbUI7QUFBQSxNQUN6RDtBQUNBLDBCQUFvQixLQUFLO0FBQUEsUUFDeEIsT0FBTztBQUFBLFFBQ1A7QUFBQSxRQUNBLE1BQU0sMkJBQTJCO0FBQUEsUUFDakMsUUFBUSxPQUFPLGlCQUFpQixXQUFXLGVBQWUsZ0JBQWdCLGNBQWMsc0JBQXNCLGVBQWUsMkJBQTJCLE1BQU07QUFBQSxRQUM5SixrQkFBa0IsaUJBQWlCLFNBQVM7QUFBQSxRQUM1QyxtQkFBbUIsU0FBUztBQUFBLE1BQzdCLENBQUM7QUFBQSxJQUNGO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLFdBQVcsS0FBYSxjQUE0RDtBQUMzRixVQUFNLE1BQU0sYUFBYSxJQUFJLG1CQUFtQixpQkFBaUIsR0FBRyxLQUFLO0FBQ3pFLFFBQUksS0FBSztBQUNSLGFBQU8sSUFBSSxHQUFHO0FBQUEsSUFDZjtBQUNBLFdBQU8sS0FBSyxZQUFZLEdBQUc7QUFBQSxFQUM1QjtBQUFBLEVBRVEsWUFBWSxxQkFBOEIsY0FBNEQ7QUFDN0csV0FBTyxzQkFBc0IsS0FBSyxXQUFXLGVBQWUsWUFBWSxJQUFJLEtBQUssV0FBVyxRQUFRLFlBQVk7QUFBQSxFQUNqSDtBQUNEO0FBemFhLDRCQUFOO0FBQUEsRUFxQko7QUFBQSxFQUNBO0FBQUEsR0F0QlU7QUEyYWIsU0FBUyxnQkFBZ0IsS0FBVSxlQUF1QixNQUEwQztBQUNuRyxNQUFJLE9BQU8sSUFBSTtBQUVmLE1BQUksU0FBUywyQkFBMkIsVUFBVSxDQUFDLEtBQUssU0FBUyxhQUFhLEdBQUc7QUFDaEYsWUFBUTtBQUFBLEVBQ1Q7QUFFQSxNQUFJLGtCQUFrQixRQUFRLEtBQUssTUFBTSxjQUFjLEdBQUc7QUFDekQsV0FBTyxHQUFHLEtBQUssQ0FBQyxFQUFFLFlBQVksQ0FBQyxJQUFJLEtBQUssTUFBTSxDQUFDLENBQUM7QUFBQSxFQUNqRDtBQUNBLFNBQU87QUFDUjtBQU1BLFNBQVMsc0JBQXNCLE1BQWMsdUJBQTZFLDRCQUE2QztBQUN0SyxNQUFJLENBQUMsNEJBQTRCO0FBQ2hDLFdBQU8sSUFBSSxzQkFBc0IsYUFBYSxHQUFHLElBQUk7QUFBQSxFQUN0RDtBQUNBLFNBQU87QUFDUjsiLAogICJuYW1lcyI6IFsiZXh0TWFwIl0KfQo=
