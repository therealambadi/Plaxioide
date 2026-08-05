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
import { ExtensionRecommendations } from "./extensionRecommendations.js";
import { EnablementState } from "../../../services/extensionManagement/common/extensionManagement.js";
import { ExtensionRecommendationReason, IExtensionIgnoredRecommendationsService } from "../../../services/extensionRecommendations/common/extensionRecommendations.js";
import { IExtensionsWorkbenchService } from "../common/extensions.js";
import { localize } from "../../../../nls.js";
import { StorageScope, IStorageService, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { Schemas } from "../../../../base/common/network.js";
import { basename, extname } from "../../../../base/common/resources.js";
import { match } from "../../../../base/common/glob.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IExtensionRecommendationNotificationService, RecommendationsNotificationResult, RecommendationSource } from "../../../../platform/extensionRecommendations/common/extensionRecommendations.js";
import { distinct } from "../../../../base/common/arrays.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { CellUri } from "../../notebook/common/notebookCommon.js";
import { disposableTimeout } from "../../../../base/common/async.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { areSameExtensions } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { isEmptyObject } from "../../../../base/common/types.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../editor/common/languages/modesRegistry.js";
const promptedRecommendationsStorageKey = "fileBasedRecommendations/promptedRecommendations";
const recommendationsStorageKey = "extensionsAssistant/recommendations";
const milliSecondsInADay = 1e3 * 60 * 60 * 24;
let FileBasedRecommendations = class extends ExtensionRecommendations {
  constructor(extensionsWorkbenchService, modelService, languageService, productService, storageService, extensionRecommendationNotificationService, extensionIgnoredRecommendationsService, workspaceContextService) {
    super();
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.modelService = modelService;
    this.languageService = languageService;
    this.storageService = storageService;
    this.extensionRecommendationNotificationService = extensionRecommendationNotificationService;
    this.extensionIgnoredRecommendationsService = extensionIgnoredRecommendationsService;
    this.workspaceContextService = workspaceContextService;
    this.recommendationsByPattern = /* @__PURE__ */ new Map();
    this.fileBasedRecommendations = /* @__PURE__ */ new Map();
    this.fileBasedImportantRecommendations = /* @__PURE__ */ new Set();
    this.fileOpenRecommendations = {};
    if (productService.extensionRecommendations) {
      for (const [extensionId, recommendation] of Object.entries(productService.extensionRecommendations)) {
        if (recommendation.onFileOpen) {
          this.fileOpenRecommendations[extensionId.toLowerCase()] = recommendation.onFileOpen;
        }
      }
    }
  }
  get recommendations() {
    const recommendations = [];
    [...this.fileBasedRecommendations.keys()].sort((a, b) => {
      if (this.fileBasedRecommendations.get(a).recommendedTime === this.fileBasedRecommendations.get(b).recommendedTime) {
        if (this.fileBasedImportantRecommendations.has(a)) {
          return -1;
        }
        if (this.fileBasedImportantRecommendations.has(b)) {
          return 1;
        }
      }
      return this.fileBasedRecommendations.get(a).recommendedTime > this.fileBasedRecommendations.get(b).recommendedTime ? -1 : 1;
    }).forEach((extensionId) => {
      recommendations.push({
        extension: extensionId,
        reason: {
          reasonId: ExtensionRecommendationReason.File,
          reasonText: localize("fileBasedRecommendation", "This extension is recommended based on the files you recently opened.")
        }
      });
    });
    return recommendations;
  }
  get importantRecommendations() {
    return this.recommendations.filter((e) => this.fileBasedImportantRecommendations.has(e.extension));
  }
  get otherRecommendations() {
    return this.recommendations.filter((e) => !this.fileBasedImportantRecommendations.has(e.extension));
  }
  async doActivate() {
    if (isEmptyObject(this.fileOpenRecommendations)) {
      return;
    }
    await this.extensionsWorkbenchService.whenInitialized;
    const cachedRecommendations = this.getCachedRecommendations();
    const now = Date.now();
    Object.entries(cachedRecommendations).forEach(([key, value]) => {
      const diff = (now - value) / milliSecondsInADay;
      if (diff <= 7 && this.fileOpenRecommendations[key]) {
        this.fileBasedRecommendations.set(key.toLowerCase(), { recommendedTime: value });
      }
    });
    this._register(this.modelService.onModelAdded((model) => this.onModelAdded(model)));
    this.modelService.getModels().forEach((model) => this.onModelAdded(model));
  }
  onModelAdded(model) {
    const uri = model.uri.scheme === Schemas.vscodeNotebookCell ? CellUri.parse(model.uri)?.notebook : model.uri;
    if (!uri) {
      return;
    }
    const supportedSchemes = distinct([Schemas.untitled, Schemas.file, Schemas.vscodeRemote, ...this.workspaceContextService.getWorkspace().folders.map((folder) => folder.uri.scheme)]);
    if (!uri || !supportedSchemes.includes(uri.scheme)) {
      return;
    }
    disposableTimeout(() => this.promptImportantRecommendations(uri, model), 0, this._store);
  }
  /**
   * Prompt the user to either install the recommended extension for the file type in the current editor model
   * or prompt to search the marketplace if it has extensions that can support the file type
   */
  promptImportantRecommendations(uri, model, extensionRecommendations) {
    if (model.isDisposed()) {
      return;
    }
    const pattern = extname(uri).toLowerCase();
    extensionRecommendations = extensionRecommendations ?? this.recommendationsByPattern.get(pattern) ?? this.fileOpenRecommendations;
    const extensionRecommendationEntries = Object.entries(extensionRecommendations);
    if (extensionRecommendationEntries.length === 0) {
      return;
    }
    const processedPathGlobs = /* @__PURE__ */ new Map();
    const installed = this.extensionsWorkbenchService.local;
    const recommendationsByPattern = {};
    const matchedRecommendations = {};
    const unmatchedRecommendations = {};
    let listenOnLanguageChange = false;
    const languageId = model.getLanguageId();
    for (const [extensionId, conditions] of extensionRecommendationEntries) {
      const conditionsByPattern = [];
      const matchedConditions = [];
      const unmatchedConditions = [];
      for (const condition of conditions) {
        let languageMatched = false;
        let pathGlobMatched = false;
        const isLanguageCondition = !!condition.languages;
        const isFileContentCondition = !!condition.contentPattern;
        if (isLanguageCondition || isFileContentCondition) {
          conditionsByPattern.push(condition);
        }
        if (isLanguageCondition) {
          if (condition.languages.includes(languageId)) {
            languageMatched = true;
          }
        }
        if (condition.pathGlob) {
          const pathGlob = condition.pathGlob;
          if (processedPathGlobs.get(pathGlob) ?? match(condition.pathGlob, uri.with({ fragment: "" }).toString())) {
            pathGlobMatched = true;
          }
          processedPathGlobs.set(pathGlob, pathGlobMatched);
        }
        let matched = languageMatched || pathGlobMatched;
        if (pattern && !matched) {
          continue;
        }
        if (matched && condition.whenInstalled) {
          if (!condition.whenInstalled.every((id) => installed.some((local) => areSameExtensions({ id }, local.identifier)))) {
            matched = false;
          }
        }
        if (matched && condition.whenNotInstalled) {
          if (installed.some((local) => condition.whenNotInstalled?.some((id) => areSameExtensions({ id }, local.identifier)))) {
            matched = false;
          }
        }
        if (matched && isFileContentCondition) {
          if (!model.findMatches(condition.contentPattern, false, true, false, null, false).length) {
            matched = false;
          }
        }
        if (matched) {
          matchedConditions.push(condition);
          conditionsByPattern.pop();
        } else {
          if (isLanguageCondition || isFileContentCondition) {
            unmatchedConditions.push(condition);
            if (isLanguageCondition) {
              listenOnLanguageChange = true;
            }
          }
        }
      }
      if (matchedConditions.length) {
        matchedRecommendations[extensionId] = matchedConditions;
      }
      if (unmatchedConditions.length) {
        unmatchedRecommendations[extensionId] = unmatchedConditions;
      }
      if (conditionsByPattern.length) {
        recommendationsByPattern[extensionId] = conditionsByPattern;
      }
    }
    if (pattern) {
      this.recommendationsByPattern.set(pattern, recommendationsByPattern);
    }
    if (Object.keys(unmatchedRecommendations).length) {
      if (listenOnLanguageChange) {
        const disposables = new DisposableStore();
        disposables.add(model.onDidChangeLanguage(() => {
          disposableTimeout(() => {
            if (!disposables.isDisposed) {
              this.promptImportantRecommendations(uri, model, unmatchedRecommendations);
              disposables.dispose();
            }
          }, 0, disposables);
        }));
        disposables.add(model.onWillDispose(() => disposables.dispose()));
      }
    }
    if (Object.keys(matchedRecommendations).length) {
      this.promptFromRecommendations(uri, model, matchedRecommendations);
    }
  }
  promptFromRecommendations(uri, model, extensionRecommendations) {
    let isImportantRecommendationForLanguage = false;
    const importantRecommendations = /* @__PURE__ */ new Set();
    const fileBasedRecommendations = /* @__PURE__ */ new Set();
    for (const [extensionId, conditions] of Object.entries(extensionRecommendations)) {
      for (const condition of conditions) {
        fileBasedRecommendations.add(extensionId);
        if (condition.important) {
          importantRecommendations.add(extensionId);
          this.fileBasedImportantRecommendations.add(extensionId);
        }
        if (condition.languages) {
          isImportantRecommendationForLanguage = true;
        }
      }
    }
    for (const recommendation of fileBasedRecommendations) {
      const filedBasedRecommendation = this.fileBasedRecommendations.get(recommendation) || { recommendedTime: Date.now(), sources: [] };
      filedBasedRecommendation.recommendedTime = Date.now();
      this.fileBasedRecommendations.set(recommendation, filedBasedRecommendation);
    }
    this.storeCachedRecommendations();
    if (this.extensionRecommendationNotificationService.hasToIgnoreRecommendationNotifications()) {
      return;
    }
    const language = model.getLanguageId();
    const languageName = this.languageService.getLanguageName(language);
    if (importantRecommendations.size && this.promptRecommendedExtensionForFileType(languageName && isImportantRecommendationForLanguage && language !== PLAINTEXT_LANGUAGE_ID ? localize("languageName", "the {0} language", languageName) : basename(uri), language, [...importantRecommendations])) {
      return;
    }
  }
  promptRecommendedExtensionForFileType(name, language, recommendations) {
    recommendations = this.filterIgnoredOrNotAllowed(recommendations);
    if (recommendations.length === 0) {
      return false;
    }
    recommendations = this.filterInstalled(recommendations, this.extensionsWorkbenchService.local).filter((extensionId) => this.fileBasedImportantRecommendations.has(extensionId));
    const promptedRecommendations = language !== PLAINTEXT_LANGUAGE_ID ? this.getPromptedRecommendations()[language] : void 0;
    if (promptedRecommendations) {
      recommendations = recommendations.filter((extensionId) => promptedRecommendations.includes(extensionId));
    }
    if (recommendations.length === 0) {
      return false;
    }
    this.promptImportantExtensionsInstallNotification(recommendations, name, language);
    return true;
  }
  async promptImportantExtensionsInstallNotification(extensions, name, language) {
    try {
      const result = await this.extensionRecommendationNotificationService.promptImportantExtensionsInstallNotification({ extensions, name, source: RecommendationSource.FILE });
      if (result === RecommendationsNotificationResult.Accepted) {
        this.addToPromptedRecommendations(language, extensions);
      }
    } catch (error) {
    }
  }
  getPromptedRecommendations() {
    return JSON.parse(this.storageService.get(promptedRecommendationsStorageKey, StorageScope.PROFILE, "{}"));
  }
  addToPromptedRecommendations(language, extensions) {
    const promptedRecommendations = this.getPromptedRecommendations();
    promptedRecommendations[language] = distinct([...promptedRecommendations[language] ?? [], ...extensions]);
    this.storageService.store(promptedRecommendationsStorageKey, JSON.stringify(promptedRecommendations), StorageScope.PROFILE, StorageTarget.USER);
  }
  filterIgnoredOrNotAllowed(recommendationsToSuggest) {
    const ignoredRecommendations = [...this.extensionIgnoredRecommendationsService.ignoredRecommendations, ...this.extensionRecommendationNotificationService.ignoredRecommendations];
    return recommendationsToSuggest.filter((id) => !ignoredRecommendations.includes(id));
  }
  filterInstalled(recommendationsToSuggest, installed) {
    const installedExtensionsIds = installed.reduce((result, i) => {
      if (i.enablementState !== EnablementState.DisabledByExtensionKind) {
        result.add(i.identifier.id.toLowerCase());
      }
      return result;
    }, /* @__PURE__ */ new Set());
    return recommendationsToSuggest.filter((id) => !installedExtensionsIds.has(id.toLowerCase()));
  }
  getCachedRecommendations() {
    let storedRecommendations = JSON.parse(this.storageService.get(recommendationsStorageKey, StorageScope.PROFILE, "[]"));
    if (Array.isArray(storedRecommendations)) {
      storedRecommendations = storedRecommendations.reduce((result2, id) => {
        result2[id] = Date.now();
        return result2;
      }, {});
    }
    const result = {};
    Object.entries(storedRecommendations).forEach(([key, value]) => {
      if (typeof value === "number") {
        result[key.toLowerCase()] = value;
      }
    });
    return result;
  }
  storeCachedRecommendations() {
    const storedRecommendations = {};
    this.fileBasedRecommendations.forEach((value, key) => storedRecommendations[key] = value.recommendedTime);
    this.storageService.store(recommendationsStorageKey, JSON.stringify(storedRecommendations), StorageScope.PROFILE, StorageTarget.MACHINE);
  }
};
FileBasedRecommendations = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IModelService),
  __decorateParam(2, ILanguageService),
  __decorateParam(3, IProductService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IExtensionRecommendationNotificationService),
  __decorateParam(6, IExtensionIgnoredRecommendationsService),
  __decorateParam(7, IWorkspaceContextService)
], FileBasedRecommendations);
export {
  FileBasedRecommendations
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvZmlsZUJhc2VkUmVjb21tZW5kYXRpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zLCBHYWxsZXJ5RXh0ZW5zaW9uUmVjb21tZW5kYXRpb24gfSBmcm9tICcuL2V4dGVuc2lvblJlY29tbWVuZGF0aW9ucy5qcyc7XG5pbXBvcnQgeyBFbmFibGVtZW50U3RhdGUgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblJlY29tbWVuZGF0aW9uUmVhc29uLCBJRXh0ZW5zaW9uSWdub3JlZFJlY29tbWVuZGF0aW9uc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25SZWNvbW1lbmRhdGlvbnMvY29tbW9uL2V4dGVuc2lvblJlY29tbWVuZGF0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsIElFeHRlbnNpb24gfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBTdG9yYWdlU2NvcGUsIElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUZpbGVDb250ZW50Q29uZGl0aW9uLCBJRmlsZVBhdGhDb25kaXRpb24sIElGaWxlTGFuZ3VhZ2VDb25kaXRpb24sIElGaWxlT3BlbkNvbmRpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Byb2R1Y3QuanMnO1xuaW1wb3J0IHsgSVN0cmluZ0RpY3Rpb25hcnkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZXh0bmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBtYXRjaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2dsb2IuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25Ob3RpZmljYXRpb25TZXJ2aWNlLCBSZWNvbW1lbmRhdGlvbnNOb3RpZmljYXRpb25SZXN1bHQsIFJlY29tbWVuZGF0aW9uU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zL2NvbW1vbi9leHRlbnNpb25SZWNvbW1lbmRhdGlvbnMuanMnO1xuaW1wb3J0IHsgZGlzdGluY3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IENlbGxVcmkgfSBmcm9tICcuLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgZGlzcG9zYWJsZVRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBhcmVTYW1lRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnRVdGlsLmpzJztcbmltcG9ydCB7IGlzRW1wdHlPYmplY3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBQTEFJTlRFWFRfTEFOR1VBR0VfSUQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9tb2Rlc1JlZ2lzdHJ5LmpzJztcblxuY29uc3QgcHJvbXB0ZWRSZWNvbW1lbmRhdGlvbnNTdG9yYWdlS2V5ID0gJ2ZpbGVCYXNlZFJlY29tbWVuZGF0aW9ucy9wcm9tcHRlZFJlY29tbWVuZGF0aW9ucyc7XG5jb25zdCByZWNvbW1lbmRhdGlvbnNTdG9yYWdlS2V5ID0gJ2V4dGVuc2lvbnNBc3Npc3RhbnQvcmVjb21tZW5kYXRpb25zJztcbmNvbnN0IG1pbGxpU2Vjb25kc0luQURheSA9IDEwMDAgKiA2MCAqIDYwICogMjQ7XG5cbmV4cG9ydCBjbGFzcyBGaWxlQmFzZWRSZWNvbW1lbmRhdGlvbnMgZXh0ZW5kcyBFeHRlbnNpb25SZWNvbW1lbmRhdGlvbnMge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZmlsZU9wZW5SZWNvbW1lbmRhdGlvbnM6IElTdHJpbmdEaWN0aW9uYXJ5PElGaWxlT3BlbkNvbmRpdGlvbltdPjtcblx0cHJpdmF0ZSByZWFkb25seSByZWNvbW1lbmRhdGlvbnNCeVBhdHRlcm4gPSBuZXcgTWFwPHN0cmluZywgSVN0cmluZ0RpY3Rpb25hcnk8SUZpbGVPcGVuQ29uZGl0aW9uW10+PigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGZpbGVCYXNlZFJlY29tbWVuZGF0aW9ucyA9IG5ldyBNYXA8c3RyaW5nLCB7IHJlY29tbWVuZGVkVGltZTogbnVtYmVyIH0+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZmlsZUJhc2VkSW1wb3J0YW50UmVjb21tZW5kYXRpb25zID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0Z2V0IHJlY29tbWVuZGF0aW9ucygpOiBSZWFkb25seUFycmF5PEdhbGxlcnlFeHRlbnNpb25SZWNvbW1lbmRhdGlvbj4ge1xuXHRcdGNvbnN0IHJlY29tbWVuZGF0aW9uczogR2FsbGVyeUV4dGVuc2lvblJlY29tbWVuZGF0aW9uW10gPSBbXTtcblx0XHRbLi4udGhpcy5maWxlQmFzZWRSZWNvbW1lbmRhdGlvbnMua2V5cygpXVxuXHRcdFx0LnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuZmlsZUJhc2VkUmVjb21tZW5kYXRpb25zLmdldChhKSEucmVjb21tZW5kZWRUaW1lID09PSB0aGlzLmZpbGVCYXNlZFJlY29tbWVuZGF0aW9ucy5nZXQoYikhLnJlY29tbWVuZGVkVGltZSkge1xuXHRcdFx0XHRcdGlmICh0aGlzLmZpbGVCYXNlZEltcG9ydGFudFJlY29tbWVuZGF0aW9ucy5oYXMoYSkpIHtcblx0XHRcdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHRoaXMuZmlsZUJhc2VkSW1wb3J0YW50UmVjb21tZW5kYXRpb25zLmhhcyhiKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLmZpbGVCYXNlZFJlY29tbWVuZGF0aW9ucy5nZXQoYSkhLnJlY29tbWVuZGVkVGltZSA+IHRoaXMuZmlsZUJhc2VkUmVjb21tZW5kYXRpb25zLmdldChiKSEucmVjb21tZW5kZWRUaW1lID8gLTEgOiAxO1xuXHRcdFx0fSlcblx0XHRcdC5mb3JFYWNoKGV4dGVuc2lvbklkID0+IHtcblx0XHRcdFx0cmVjb21tZW5kYXRpb25zLnB1c2goe1xuXHRcdFx0XHRcdGV4dGVuc2lvbjogZXh0ZW5zaW9uSWQsXG5cdFx0XHRcdFx0cmVhc29uOiB7XG5cdFx0XHRcdFx0XHRyZWFzb25JZDogRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25SZWFzb24uRmlsZSxcblx0XHRcdFx0XHRcdHJlYXNvblRleHQ6IGxvY2FsaXplKCdmaWxlQmFzZWRSZWNvbW1lbmRhdGlvbicsIFwiVGhpcyBleHRlbnNpb24gaXMgcmVjb21tZW5kZWQgYmFzZWQgb24gdGhlIGZpbGVzIHlvdSByZWNlbnRseSBvcGVuZWQuXCIpXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdHJldHVybiByZWNvbW1lbmRhdGlvbnM7XG5cdH1cblxuXHRnZXQgaW1wb3J0YW50UmVjb21tZW5kYXRpb25zKCk6IFJlYWRvbmx5QXJyYXk8R2FsbGVyeUV4dGVuc2lvblJlY29tbWVuZGF0aW9uPiB7XG5cdFx0cmV0dXJuIHRoaXMucmVjb21tZW5kYXRpb25zLmZpbHRlcihlID0+IHRoaXMuZmlsZUJhc2VkSW1wb3J0YW50UmVjb21tZW5kYXRpb25zLmhhcyhlLmV4dGVuc2lvbikpO1xuXHR9XG5cblx0Z2V0IG90aGVyUmVjb21tZW5kYXRpb25zKCk6IFJlYWRvbmx5QXJyYXk8R2FsbGVyeUV4dGVuc2lvblJlY29tbWVuZGF0aW9uPiB7XG5cdFx0cmV0dXJuIHRoaXMucmVjb21tZW5kYXRpb25zLmZpbHRlcihlID0+ICF0aGlzLmZpbGVCYXNlZEltcG9ydGFudFJlY29tbWVuZGF0aW9ucy5oYXMoZS5leHRlbnNpb24pKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUV4dGVuc2lvblJlY29tbWVuZGF0aW9uTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblJlY29tbWVuZGF0aW9uTm90aWZpY2F0aW9uU2VydmljZTogSUV4dGVuc2lvblJlY29tbWVuZGF0aW9uTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUV4dGVuc2lvbklnbm9yZWRSZWNvbW1lbmRhdGlvbnNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uSWdub3JlZFJlY29tbWVuZGF0aW9uc1NlcnZpY2U6IElFeHRlbnNpb25JZ25vcmVkUmVjb21tZW5kYXRpb25zU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmZpbGVPcGVuUmVjb21tZW5kYXRpb25zID0ge307XG5cdFx0aWYgKHByb2R1Y3RTZXJ2aWNlLmV4dGVuc2lvblJlY29tbWVuZGF0aW9ucykge1xuXHRcdFx0Zm9yIChjb25zdCBbZXh0ZW5zaW9uSWQsIHJlY29tbWVuZGF0aW9uXSBvZiBPYmplY3QuZW50cmllcyhwcm9kdWN0U2VydmljZS5leHRlbnNpb25SZWNvbW1lbmRhdGlvbnMpKSB7XG5cdFx0XHRcdGlmIChyZWNvbW1lbmRhdGlvbi5vbkZpbGVPcGVuKSB7XG5cdFx0XHRcdFx0dGhpcy5maWxlT3BlblJlY29tbWVuZGF0aW9uc1tleHRlbnNpb25JZC50b0xvd2VyQ2FzZSgpXSA9IHJlY29tbWVuZGF0aW9uLm9uRmlsZU9wZW47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgZG9BY3RpdmF0ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoaXNFbXB0eU9iamVjdCh0aGlzLmZpbGVPcGVuUmVjb21tZW5kYXRpb25zKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uud2hlbkluaXRpYWxpemVkO1xuXG5cdFx0Y29uc3QgY2FjaGVkUmVjb21tZW5kYXRpb25zID0gdGhpcy5nZXRDYWNoZWRSZWNvbW1lbmRhdGlvbnMoKTtcblx0XHRjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXHRcdC8vIFJldGlyZSBleGlzdGluZyByZWNvbW1lbmRhdGlvbnMgaWYgdGhleSBhcmUgb2xkZXIgdGhhbiBhIHdlZWsgb3IgYXJlIG5vdCBwYXJ0IG9mIHRoaXMucHJvZHVjdFNlcnZpY2UuZXh0ZW5zaW9uVGlwcyBhbnltb3JlXG5cdFx0T2JqZWN0LmVudHJpZXMoY2FjaGVkUmVjb21tZW5kYXRpb25zKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcblx0XHRcdGNvbnN0IGRpZmYgPSAobm93IC0gdmFsdWUpIC8gbWlsbGlTZWNvbmRzSW5BRGF5O1xuXHRcdFx0aWYgKGRpZmYgPD0gNyAmJiB0aGlzLmZpbGVPcGVuUmVjb21tZW5kYXRpb25zW2tleV0pIHtcblx0XHRcdFx0dGhpcy5maWxlQmFzZWRSZWNvbW1lbmRhdGlvbnMuc2V0KGtleS50b0xvd2VyQ2FzZSgpLCB7IHJlY29tbWVuZGVkVGltZTogdmFsdWUgfSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm1vZGVsU2VydmljZS5vbk1vZGVsQWRkZWQobW9kZWwgPT4gdGhpcy5vbk1vZGVsQWRkZWQobW9kZWwpKSk7XG5cdFx0dGhpcy5tb2RlbFNlcnZpY2UuZ2V0TW9kZWxzKCkuZm9yRWFjaChtb2RlbCA9PiB0aGlzLm9uTW9kZWxBZGRlZChtb2RlbCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbk1vZGVsQWRkZWQobW9kZWw6IElUZXh0TW9kZWwpOiB2b2lkIHtcblx0XHRjb25zdCB1cmkgPSBtb2RlbC51cmkuc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbCA/IENlbGxVcmkucGFyc2UobW9kZWwudXJpKT8ubm90ZWJvb2sgOiBtb2RlbC51cmk7XG5cdFx0aWYgKCF1cmkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzdXBwb3J0ZWRTY2hlbWVzID0gZGlzdGluY3QoW1NjaGVtYXMudW50aXRsZWQsIFNjaGVtYXMuZmlsZSwgU2NoZW1hcy52c2NvZGVSZW1vdGUsIC4uLnRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycy5tYXAoZm9sZGVyID0+IGZvbGRlci51cmkuc2NoZW1lKV0pO1xuXHRcdGlmICghdXJpIHx8ICFzdXBwb3J0ZWRTY2hlbWVzLmluY2x1ZGVzKHVyaS5zY2hlbWUpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gcmUtc2NoZWR1bGUgdGhpcyBiaXQgb2YgdGhlIG9wZXJhdGlvbiB0byBiZSBvZmYgdGhlIGNyaXRpY2FsIHBhdGggLSBpbiBjYXNlIGdsb2ItbWF0Y2ggaXMgc2xvd1xuXHRcdGRpc3Bvc2FibGVUaW1lb3V0KCgpID0+IHRoaXMucHJvbXB0SW1wb3J0YW50UmVjb21tZW5kYXRpb25zKHVyaSwgbW9kZWwpLCAwLCB0aGlzLl9zdG9yZSk7XG5cdH1cblxuXHQvKipcblx0ICogUHJvbXB0IHRoZSB1c2VyIHRvIGVpdGhlciBpbnN0YWxsIHRoZSByZWNvbW1lbmRlZCBleHRlbnNpb24gZm9yIHRoZSBmaWxlIHR5cGUgaW4gdGhlIGN1cnJlbnQgZWRpdG9yIG1vZGVsXG5cdCAqIG9yIHByb21wdCB0byBzZWFyY2ggdGhlIG1hcmtldHBsYWNlIGlmIGl0IGhhcyBleHRlbnNpb25zIHRoYXQgY2FuIHN1cHBvcnQgdGhlIGZpbGUgdHlwZVxuXHQgKi9cblx0cHJpdmF0ZSBwcm9tcHRJbXBvcnRhbnRSZWNvbW1lbmRhdGlvbnModXJpOiBVUkksIG1vZGVsOiBJVGV4dE1vZGVsLCBleHRlbnNpb25SZWNvbW1lbmRhdGlvbnM/OiBJU3RyaW5nRGljdGlvbmFyeTxJRmlsZU9wZW5Db25kaXRpb25bXT4pOiB2b2lkIHtcblx0XHRpZiAobW9kZWwuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGF0dGVybiA9IGV4dG5hbWUodXJpKS50b0xvd2VyQ2FzZSgpO1xuXHRcdGV4dGVuc2lvblJlY29tbWVuZGF0aW9ucyA9IGV4dGVuc2lvblJlY29tbWVuZGF0aW9ucyA/PyB0aGlzLnJlY29tbWVuZGF0aW9uc0J5UGF0dGVybi5nZXQocGF0dGVybikgPz8gdGhpcy5maWxlT3BlblJlY29tbWVuZGF0aW9ucztcblx0XHRjb25zdCBleHRlbnNpb25SZWNvbW1lbmRhdGlvbkVudHJpZXMgPSBPYmplY3QuZW50cmllcyhleHRlbnNpb25SZWNvbW1lbmRhdGlvbnMpO1xuXHRcdGlmIChleHRlbnNpb25SZWNvbW1lbmRhdGlvbkVudHJpZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJvY2Vzc2VkUGF0aEdsb2JzID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG5cdFx0Y29uc3QgaW5zdGFsbGVkID0gdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5sb2NhbDtcblx0XHRjb25zdCByZWNvbW1lbmRhdGlvbnNCeVBhdHRlcm46IElTdHJpbmdEaWN0aW9uYXJ5PElGaWxlT3BlbkNvbmRpdGlvbltdPiA9IHt9O1xuXHRcdGNvbnN0IG1hdGNoZWRSZWNvbW1lbmRhdGlvbnM6IElTdHJpbmdEaWN0aW9uYXJ5PElGaWxlT3BlbkNvbmRpdGlvbltdPiA9IHt9O1xuXHRcdGNvbnN0IHVubWF0Y2hlZFJlY29tbWVuZGF0aW9uczogSVN0cmluZ0RpY3Rpb25hcnk8SUZpbGVPcGVuQ29uZGl0aW9uW10+ID0ge307XG5cdFx0bGV0IGxpc3Rlbk9uTGFuZ3VhZ2VDaGFuZ2UgPSBmYWxzZTtcblx0XHRjb25zdCBsYW5ndWFnZUlkID0gbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpO1xuXG5cdFx0Zm9yIChjb25zdCBbZXh0ZW5zaW9uSWQsIGNvbmRpdGlvbnNdIG9mIGV4dGVuc2lvblJlY29tbWVuZGF0aW9uRW50cmllcykge1xuXHRcdFx0Y29uc3QgY29uZGl0aW9uc0J5UGF0dGVybjogSUZpbGVPcGVuQ29uZGl0aW9uW10gPSBbXTtcblx0XHRcdGNvbnN0IG1hdGNoZWRDb25kaXRpb25zOiBJRmlsZU9wZW5Db25kaXRpb25bXSA9IFtdO1xuXHRcdFx0Y29uc3QgdW5tYXRjaGVkQ29uZGl0aW9uczogSUZpbGVPcGVuQ29uZGl0aW9uW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgY29uZGl0aW9uIG9mIGNvbmRpdGlvbnMpIHtcblx0XHRcdFx0bGV0IGxhbmd1YWdlTWF0Y2hlZCA9IGZhbHNlO1xuXHRcdFx0XHRsZXQgcGF0aEdsb2JNYXRjaGVkID0gZmFsc2U7XG5cblx0XHRcdFx0Y29uc3QgaXNMYW5ndWFnZUNvbmRpdGlvbiA9ICEhKDxJRmlsZUxhbmd1YWdlQ29uZGl0aW9uPmNvbmRpdGlvbikubGFuZ3VhZ2VzO1xuXHRcdFx0XHRjb25zdCBpc0ZpbGVDb250ZW50Q29uZGl0aW9uID0gISEoPElGaWxlQ29udGVudENvbmRpdGlvbj5jb25kaXRpb24pLmNvbnRlbnRQYXR0ZXJuO1xuXHRcdFx0XHRpZiAoaXNMYW5ndWFnZUNvbmRpdGlvbiB8fCBpc0ZpbGVDb250ZW50Q29uZGl0aW9uKSB7XG5cdFx0XHRcdFx0Y29uZGl0aW9uc0J5UGF0dGVybi5wdXNoKGNvbmRpdGlvbik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaXNMYW5ndWFnZUNvbmRpdGlvbikge1xuXHRcdFx0XHRcdGlmICgoPElGaWxlTGFuZ3VhZ2VDb25kaXRpb24+Y29uZGl0aW9uKS5sYW5ndWFnZXMuaW5jbHVkZXMobGFuZ3VhZ2VJZCkpIHtcblx0XHRcdFx0XHRcdGxhbmd1YWdlTWF0Y2hlZCA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCg8SUZpbGVQYXRoQ29uZGl0aW9uPmNvbmRpdGlvbikucGF0aEdsb2IpIHtcblx0XHRcdFx0XHRjb25zdCBwYXRoR2xvYiA9ICg8SUZpbGVQYXRoQ29uZGl0aW9uPmNvbmRpdGlvbikucGF0aEdsb2I7XG5cdFx0XHRcdFx0aWYgKHByb2Nlc3NlZFBhdGhHbG9icy5nZXQocGF0aEdsb2IpID8/IG1hdGNoKCg8SUZpbGVQYXRoQ29uZGl0aW9uPmNvbmRpdGlvbikucGF0aEdsb2IsIHVyaS53aXRoKHsgZnJhZ21lbnQ6ICcnIH0pLnRvU3RyaW5nKCkpKSB7XG5cdFx0XHRcdFx0XHRwYXRoR2xvYk1hdGNoZWQgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRwcm9jZXNzZWRQYXRoR2xvYnMuc2V0KHBhdGhHbG9iLCBwYXRoR2xvYk1hdGNoZWQpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bGV0IG1hdGNoZWQgPSBsYW5ndWFnZU1hdGNoZWQgfHwgcGF0aEdsb2JNYXRjaGVkO1xuXG5cdFx0XHRcdC8vIElmIHRoZSByZXNvdXJjZSBoYXMgcGF0dGVybiAoZXh0ZW5zaW9uKSBhbmQgbm90IG1hdGNoZWQsIHRoZW4gd2UgZG9uJ3QgbmVlZCB0byBjaGVjayB0aGUgb3RoZXIgY29uZGl0aW9uc1xuXHRcdFx0XHRpZiAocGF0dGVybiAmJiAhbWF0Y2hlZCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKG1hdGNoZWQgJiYgY29uZGl0aW9uLndoZW5JbnN0YWxsZWQpIHtcblx0XHRcdFx0XHRpZiAoIWNvbmRpdGlvbi53aGVuSW5zdGFsbGVkLmV2ZXJ5KGlkID0+IGluc3RhbGxlZC5zb21lKGxvY2FsID0+IGFyZVNhbWVFeHRlbnNpb25zKHsgaWQgfSwgbG9jYWwuaWRlbnRpZmllcikpKSkge1xuXHRcdFx0XHRcdFx0bWF0Y2hlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChtYXRjaGVkICYmIGNvbmRpdGlvbi53aGVuTm90SW5zdGFsbGVkKSB7XG5cdFx0XHRcdFx0aWYgKGluc3RhbGxlZC5zb21lKGxvY2FsID0+IGNvbmRpdGlvbi53aGVuTm90SW5zdGFsbGVkPy5zb21lKGlkID0+IGFyZVNhbWVFeHRlbnNpb25zKHsgaWQgfSwgbG9jYWwuaWRlbnRpZmllcikpKSkge1xuXHRcdFx0XHRcdFx0bWF0Y2hlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChtYXRjaGVkICYmIGlzRmlsZUNvbnRlbnRDb25kaXRpb24pIHtcblx0XHRcdFx0XHRpZiAoIW1vZGVsLmZpbmRNYXRjaGVzKCg8SUZpbGVDb250ZW50Q29uZGl0aW9uPmNvbmRpdGlvbikuY29udGVudFBhdHRlcm4sIGZhbHNlLCB0cnVlLCBmYWxzZSwgbnVsbCwgZmFsc2UpLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0bWF0Y2hlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChtYXRjaGVkKSB7XG5cdFx0XHRcdFx0bWF0Y2hlZENvbmRpdGlvbnMucHVzaChjb25kaXRpb24pO1xuXHRcdFx0XHRcdGNvbmRpdGlvbnNCeVBhdHRlcm4ucG9wKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKGlzTGFuZ3VhZ2VDb25kaXRpb24gfHwgaXNGaWxlQ29udGVudENvbmRpdGlvbikge1xuXHRcdFx0XHRcdFx0dW5tYXRjaGVkQ29uZGl0aW9ucy5wdXNoKGNvbmRpdGlvbik7XG5cdFx0XHRcdFx0XHRpZiAoaXNMYW5ndWFnZUNvbmRpdGlvbikge1xuXHRcdFx0XHRcdFx0XHRsaXN0ZW5Pbkxhbmd1YWdlQ2hhbmdlID0gdHJ1ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0fVxuXHRcdFx0aWYgKG1hdGNoZWRDb25kaXRpb25zLmxlbmd0aCkge1xuXHRcdFx0XHRtYXRjaGVkUmVjb21tZW5kYXRpb25zW2V4dGVuc2lvbklkXSA9IG1hdGNoZWRDb25kaXRpb25zO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHVubWF0Y2hlZENvbmRpdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRcdHVubWF0Y2hlZFJlY29tbWVuZGF0aW9uc1tleHRlbnNpb25JZF0gPSB1bm1hdGNoZWRDb25kaXRpb25zO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGNvbmRpdGlvbnNCeVBhdHRlcm4ubGVuZ3RoKSB7XG5cdFx0XHRcdHJlY29tbWVuZGF0aW9uc0J5UGF0dGVybltleHRlbnNpb25JZF0gPSBjb25kaXRpb25zQnlQYXR0ZXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChwYXR0ZXJuKSB7XG5cdFx0XHR0aGlzLnJlY29tbWVuZGF0aW9uc0J5UGF0dGVybi5zZXQocGF0dGVybiwgcmVjb21tZW5kYXRpb25zQnlQYXR0ZXJuKTtcblx0XHR9XG5cdFx0aWYgKE9iamVjdC5rZXlzKHVubWF0Y2hlZFJlY29tbWVuZGF0aW9ucykubGVuZ3RoKSB7XG5cdFx0XHRpZiAobGlzdGVuT25MYW5ndWFnZUNoYW5nZSkge1xuXHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsLm9uRGlkQ2hhbmdlTGFuZ3VhZ2UoKCkgPT4ge1xuXHRcdFx0XHRcdC8vIHJlLXNjaGVkdWxlIHRoaXMgYml0IG9mIHRoZSBvcGVyYXRpb24gdG8gYmUgb2ZmIHRoZSBjcml0aWNhbCBwYXRoIC0gaW4gY2FzZSBnbG9iLW1hdGNoIGlzIHNsb3dcblx0XHRcdFx0XHRkaXNwb3NhYmxlVGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIWRpc3Bvc2FibGVzLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5wcm9tcHRJbXBvcnRhbnRSZWNvbW1lbmRhdGlvbnModXJpLCBtb2RlbCwgdW5tYXRjaGVkUmVjb21tZW5kYXRpb25zKTtcblx0XHRcdFx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sIDAsIGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwub25XaWxsRGlzcG9zZSgoKSA9PiBkaXNwb3NhYmxlcy5kaXNwb3NlKCkpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoT2JqZWN0LmtleXMobWF0Y2hlZFJlY29tbWVuZGF0aW9ucykubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLnByb21wdEZyb21SZWNvbW1lbmRhdGlvbnModXJpLCBtb2RlbCwgbWF0Y2hlZFJlY29tbWVuZGF0aW9ucyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBwcm9tcHRGcm9tUmVjb21tZW5kYXRpb25zKHVyaTogVVJJLCBtb2RlbDogSVRleHRNb2RlbCwgZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zOiBJU3RyaW5nRGljdGlvbmFyeTxJRmlsZU9wZW5Db25kaXRpb25bXT4pOiB2b2lkIHtcblx0XHRsZXQgaXNJbXBvcnRhbnRSZWNvbW1lbmRhdGlvbkZvckxhbmd1YWdlID0gZmFsc2U7XG5cdFx0Y29uc3QgaW1wb3J0YW50UmVjb21tZW5kYXRpb25zID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0Y29uc3QgZmlsZUJhc2VkUmVjb21tZW5kYXRpb25zID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0Zm9yIChjb25zdCBbZXh0ZW5zaW9uSWQsIGNvbmRpdGlvbnNdIG9mIE9iamVjdC5lbnRyaWVzKGV4dGVuc2lvblJlY29tbWVuZGF0aW9ucykpIHtcblx0XHRcdGZvciAoY29uc3QgY29uZGl0aW9uIG9mIGNvbmRpdGlvbnMpIHtcblx0XHRcdFx0ZmlsZUJhc2VkUmVjb21tZW5kYXRpb25zLmFkZChleHRlbnNpb25JZCk7XG5cdFx0XHRcdGlmIChjb25kaXRpb24uaW1wb3J0YW50KSB7XG5cdFx0XHRcdFx0aW1wb3J0YW50UmVjb21tZW5kYXRpb25zLmFkZChleHRlbnNpb25JZCk7XG5cdFx0XHRcdFx0dGhpcy5maWxlQmFzZWRJbXBvcnRhbnRSZWNvbW1lbmRhdGlvbnMuYWRkKGV4dGVuc2lvbklkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoKDxJRmlsZUxhbmd1YWdlQ29uZGl0aW9uPmNvbmRpdGlvbikubGFuZ3VhZ2VzKSB7XG5cdFx0XHRcdFx0aXNJbXBvcnRhbnRSZWNvbW1lbmRhdGlvbkZvckxhbmd1YWdlID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZSBmaWxlIGJhc2VkIHJlY29tbWVuZGF0aW9uc1xuXHRcdGZvciAoY29uc3QgcmVjb21tZW5kYXRpb24gb2YgZmlsZUJhc2VkUmVjb21tZW5kYXRpb25zKSB7XG5cdFx0XHRjb25zdCBmaWxlZEJhc2VkUmVjb21tZW5kYXRpb24gPSB0aGlzLmZpbGVCYXNlZFJlY29tbWVuZGF0aW9ucy5nZXQocmVjb21tZW5kYXRpb24pIHx8IHsgcmVjb21tZW5kZWRUaW1lOiBEYXRlLm5vdygpLCBzb3VyY2VzOiBbXSB9O1xuXHRcdFx0ZmlsZWRCYXNlZFJlY29tbWVuZGF0aW9uLnJlY29tbWVuZGVkVGltZSA9IERhdGUubm93KCk7XG5cdFx0XHR0aGlzLmZpbGVCYXNlZFJlY29tbWVuZGF0aW9ucy5zZXQocmVjb21tZW5kYXRpb24sIGZpbGVkQmFzZWRSZWNvbW1lbmRhdGlvbik7XG5cdFx0fVxuXG5cdFx0dGhpcy5zdG9yZUNhY2hlZFJlY29tbWVuZGF0aW9ucygpO1xuXG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25Ob3RpZmljYXRpb25TZXJ2aWNlLmhhc1RvSWdub3JlUmVjb21tZW5kYXRpb25Ob3RpZmljYXRpb25zKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBsYW5ndWFnZSA9IG1vZGVsLmdldExhbmd1YWdlSWQoKTtcblx0XHRjb25zdCBsYW5ndWFnZU5hbWUgPSB0aGlzLmxhbmd1YWdlU2VydmljZS5nZXRMYW5ndWFnZU5hbWUobGFuZ3VhZ2UpO1xuXHRcdGlmIChpbXBvcnRhbnRSZWNvbW1lbmRhdGlvbnMuc2l6ZSAmJlxuXHRcdFx0dGhpcy5wcm9tcHRSZWNvbW1lbmRlZEV4dGVuc2lvbkZvckZpbGVUeXBlKGxhbmd1YWdlTmFtZSAmJiBpc0ltcG9ydGFudFJlY29tbWVuZGF0aW9uRm9yTGFuZ3VhZ2UgJiYgbGFuZ3VhZ2UgIT09IFBMQUlOVEVYVF9MQU5HVUFHRV9JRCA/IGxvY2FsaXplKCdsYW5ndWFnZU5hbWUnLCBcInRoZSB7MH0gbGFuZ3VhZ2VcIiwgbGFuZ3VhZ2VOYW1lKSA6IGJhc2VuYW1lKHVyaSksIGxhbmd1YWdlLCBbLi4uaW1wb3J0YW50UmVjb21tZW5kYXRpb25zXSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHByb21wdFJlY29tbWVuZGVkRXh0ZW5zaW9uRm9yRmlsZVR5cGUobmFtZTogc3RyaW5nLCBsYW5ndWFnZTogc3RyaW5nLCByZWNvbW1lbmRhdGlvbnM6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG5cdFx0cmVjb21tZW5kYXRpb25zID0gdGhpcy5maWx0ZXJJZ25vcmVkT3JOb3RBbGxvd2VkKHJlY29tbWVuZGF0aW9ucyk7XG5cdFx0aWYgKHJlY29tbWVuZGF0aW9ucy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZWNvbW1lbmRhdGlvbnMgPSB0aGlzLmZpbHRlckluc3RhbGxlZChyZWNvbW1lbmRhdGlvbnMsIHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UubG9jYWwpXG5cdFx0XHQuZmlsdGVyKGV4dGVuc2lvbklkID0+IHRoaXMuZmlsZUJhc2VkSW1wb3J0YW50UmVjb21tZW5kYXRpb25zLmhhcyhleHRlbnNpb25JZCkpO1xuXG5cdFx0Y29uc3QgcHJvbXB0ZWRSZWNvbW1lbmRhdGlvbnMgPSBsYW5ndWFnZSAhPT0gUExBSU5URVhUX0xBTkdVQUdFX0lEID8gdGhpcy5nZXRQcm9tcHRlZFJlY29tbWVuZGF0aW9ucygpW2xhbmd1YWdlXSA6IHVuZGVmaW5lZDtcblx0XHRpZiAocHJvbXB0ZWRSZWNvbW1lbmRhdGlvbnMpIHtcblx0XHRcdHJlY29tbWVuZGF0aW9ucyA9IHJlY29tbWVuZGF0aW9ucy5maWx0ZXIoZXh0ZW5zaW9uSWQgPT4gcHJvbXB0ZWRSZWNvbW1lbmRhdGlvbnMuaW5jbHVkZXMoZXh0ZW5zaW9uSWQpKTtcblx0XHR9XG5cblx0XHRpZiAocmVjb21tZW5kYXRpb25zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRoaXMucHJvbXB0SW1wb3J0YW50RXh0ZW5zaW9uc0luc3RhbGxOb3RpZmljYXRpb24ocmVjb21tZW5kYXRpb25zLCBuYW1lLCBsYW5ndWFnZSk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHByb21wdEltcG9ydGFudEV4dGVuc2lvbnNJbnN0YWxsTm90aWZpY2F0aW9uKGV4dGVuc2lvbnM6IHN0cmluZ1tdLCBuYW1lOiBzdHJpbmcsIGxhbmd1YWdlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25SZWNvbW1lbmRhdGlvbk5vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0SW1wb3J0YW50RXh0ZW5zaW9uc0luc3RhbGxOb3RpZmljYXRpb24oeyBleHRlbnNpb25zLCBuYW1lLCBzb3VyY2U6IFJlY29tbWVuZGF0aW9uU291cmNlLkZJTEUgfSk7XG5cdFx0XHRpZiAocmVzdWx0ID09PSBSZWNvbW1lbmRhdGlvbnNOb3RpZmljYXRpb25SZXN1bHQuQWNjZXB0ZWQpIHtcblx0XHRcdFx0dGhpcy5hZGRUb1Byb21wdGVkUmVjb21tZW5kYXRpb25zKGxhbmd1YWdlLCBleHRlbnNpb25zKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikgeyAvKiBJZ25vcmUgKi8gfVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRQcm9tcHRlZFJlY29tbWVuZGF0aW9ucygpOiBJU3RyaW5nRGljdGlvbmFyeTxzdHJpbmdbXT4ge1xuXHRcdHJldHVybiBKU09OLnBhcnNlKHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KHByb21wdGVkUmVjb21tZW5kYXRpb25zU3RvcmFnZUtleSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsICd7fScpKTtcblx0fVxuXG5cdHByaXZhdGUgYWRkVG9Qcm9tcHRlZFJlY29tbWVuZGF0aW9ucyhsYW5ndWFnZTogc3RyaW5nLCBleHRlbnNpb25zOiBzdHJpbmdbXSkge1xuXHRcdGNvbnN0IHByb21wdGVkUmVjb21tZW5kYXRpb25zID0gdGhpcy5nZXRQcm9tcHRlZFJlY29tbWVuZGF0aW9ucygpO1xuXHRcdHByb21wdGVkUmVjb21tZW5kYXRpb25zW2xhbmd1YWdlXSA9IGRpc3RpbmN0KFsuLi4ocHJvbXB0ZWRSZWNvbW1lbmRhdGlvbnNbbGFuZ3VhZ2VdID8/IFtdKSwgLi4uZXh0ZW5zaW9uc10pO1xuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUocHJvbXB0ZWRSZWNvbW1lbmRhdGlvbnNTdG9yYWdlS2V5LCBKU09OLnN0cmluZ2lmeShwcm9tcHRlZFJlY29tbWVuZGF0aW9ucyksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHR9XG5cblx0cHJpdmF0ZSBmaWx0ZXJJZ25vcmVkT3JOb3RBbGxvd2VkKHJlY29tbWVuZGF0aW9uc1RvU3VnZ2VzdDogc3RyaW5nW10pOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgaWdub3JlZFJlY29tbWVuZGF0aW9ucyA9IFsuLi50aGlzLmV4dGVuc2lvbklnbm9yZWRSZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLmlnbm9yZWRSZWNvbW1lbmRhdGlvbnMsIC4uLnRoaXMuZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25Ob3RpZmljYXRpb25TZXJ2aWNlLmlnbm9yZWRSZWNvbW1lbmRhdGlvbnNdO1xuXHRcdHJldHVybiByZWNvbW1lbmRhdGlvbnNUb1N1Z2dlc3QuZmlsdGVyKGlkID0+ICFpZ25vcmVkUmVjb21tZW5kYXRpb25zLmluY2x1ZGVzKGlkKSk7XG5cdH1cblxuXHRwcml2YXRlIGZpbHRlckluc3RhbGxlZChyZWNvbW1lbmRhdGlvbnNUb1N1Z2dlc3Q6IHN0cmluZ1tdLCBpbnN0YWxsZWQ6IElFeHRlbnNpb25bXSk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCBpbnN0YWxsZWRFeHRlbnNpb25zSWRzID0gaW5zdGFsbGVkLnJlZHVjZSgocmVzdWx0LCBpKSA9PiB7XG5cdFx0XHRpZiAoaS5lbmFibGVtZW50U3RhdGUgIT09IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5RXh0ZW5zaW9uS2luZCkge1xuXHRcdFx0XHRyZXN1bHQuYWRkKGkuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSwgbmV3IFNldDxzdHJpbmc+KCkpO1xuXHRcdHJldHVybiByZWNvbW1lbmRhdGlvbnNUb1N1Z2dlc3QuZmlsdGVyKGlkID0+ICFpbnN0YWxsZWRFeHRlbnNpb25zSWRzLmhhcyhpZC50b0xvd2VyQ2FzZSgpKSk7XG5cdH1cblxuXHRwcml2YXRlIGdldENhY2hlZFJlY29tbWVuZGF0aW9ucygpOiBJU3RyaW5nRGljdGlvbmFyeTxudW1iZXI+IHtcblx0XHRsZXQgc3RvcmVkUmVjb21tZW5kYXRpb25zID0gSlNPTi5wYXJzZSh0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChyZWNvbW1lbmRhdGlvbnNTdG9yYWdlS2V5LCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgJ1tdJykpO1xuXHRcdGlmIChBcnJheS5pc0FycmF5KHN0b3JlZFJlY29tbWVuZGF0aW9ucykpIHtcblx0XHRcdHN0b3JlZFJlY29tbWVuZGF0aW9ucyA9IHN0b3JlZFJlY29tbWVuZGF0aW9ucy5yZWR1Y2U8SVN0cmluZ0RpY3Rpb25hcnk8bnVtYmVyPj4oKHJlc3VsdCwgaWQpID0+IHsgcmVzdWx0W2lkXSA9IERhdGUubm93KCk7IHJldHVybiByZXN1bHQ7IH0sIHt9KTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0OiBJU3RyaW5nRGljdGlvbmFyeTxudW1iZXI+ID0ge307XG5cdFx0T2JqZWN0LmVudHJpZXMoc3RvcmVkUmVjb21tZW5kYXRpb25zKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcblx0XHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdHJlc3VsdFtrZXkudG9Mb3dlckNhc2UoKV0gPSB2YWx1ZTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBzdG9yZUNhY2hlZFJlY29tbWVuZGF0aW9ucygpOiB2b2lkIHtcblx0XHRjb25zdCBzdG9yZWRSZWNvbW1lbmRhdGlvbnM6IElTdHJpbmdEaWN0aW9uYXJ5PG51bWJlcj4gPSB7fTtcblx0XHR0aGlzLmZpbGVCYXNlZFJlY29tbWVuZGF0aW9ucy5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiBzdG9yZWRSZWNvbW1lbmRhdGlvbnNba2V5XSA9IHZhbHVlLnJlY29tbWVuZGVkVGltZSk7XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShyZWNvbW1lbmRhdGlvbnNTdG9yYWdlS2V5LCBKU09OLnN0cmluZ2lmeShzdG9yZWRSZWNvbW1lbmRhdGlvbnMpLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdDQUFnRTtBQUN6RSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLCtCQUErQiwrQ0FBK0M7QUFDdkYsU0FBUyxtQ0FBK0M7QUFDeEQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxjQUFjLGlCQUFpQixxQkFBcUI7QUFDN0QsU0FBUyx1QkFBdUI7QUFJaEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsVUFBVSxlQUFlO0FBQ2xDLFNBQVMsYUFBYTtBQUV0QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDZDQUE2QyxtQ0FBbUMsNEJBQTRCO0FBQ3JILFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZUFBZTtBQUN4QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGdDQUFn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
