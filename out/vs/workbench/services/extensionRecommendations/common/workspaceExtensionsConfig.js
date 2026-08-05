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
import { distinct } from "../../../../base/common/arrays.js";
import { Emitter } from "../../../../base/common/event.js";
import { parse } from "../../../../base/common/json.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { getIconClasses } from "../../../../editor/common/services/getIconClasses.js";
import { FileKind, IFileService } from "../../../../platform/files/common/files.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { isWorkspace, IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { localize } from "../../../../nls.js";
import { IJSONEditingService } from "../../configuration/common/jsonEditing.js";
import { ResourceMap } from "../../../../base/common/map.js";
const EXTENSIONS_CONFIG = ".vscode/extensions.json";
const IWorkspaceExtensionsConfigService = createDecorator("IWorkspaceExtensionsConfigService");
let WorkspaceExtensionsConfigService = class extends Disposable {
  constructor(workspaceContextService, fileService, quickInputService, modelService, languageService, jsonEditingService) {
    super();
    this.workspaceContextService = workspaceContextService;
    this.fileService = fileService;
    this.quickInputService = quickInputService;
    this.modelService = modelService;
    this.languageService = languageService;
    this.jsonEditingService = jsonEditingService;
    this._onDidChangeExtensionsConfigs = this._register(new Emitter());
    this.onDidChangeExtensionsConfigs = this._onDidChangeExtensionsConfigs.event;
    this._register(workspaceContextService.onDidChangeWorkspaceFolders((e) => this._onDidChangeExtensionsConfigs.fire()));
    this._register(fileService.onDidFilesChange((e) => {
      const workspace = workspaceContextService.getWorkspace();
      if (workspace.configuration && e.affects(workspace.configuration) || workspace.folders.some((folder) => e.affects(folder.toResource(EXTENSIONS_CONFIG)))) {
        this._onDidChangeExtensionsConfigs.fire();
      }
    }));
  }
  async getExtensionsConfigs() {
    const workspace = this.workspaceContextService.getWorkspace();
    const result = [];
    const workspaceExtensionsConfigContent = workspace.configuration ? await this.resolveWorkspaceExtensionConfig(workspace.configuration) : void 0;
    if (workspaceExtensionsConfigContent) {
      result.push(workspaceExtensionsConfigContent);
    }
    result.push(...await Promise.all(workspace.folders.map((workspaceFolder) => this.resolveWorkspaceFolderExtensionConfig(workspaceFolder))));
    return result;
  }
  async getRecommendations() {
    const configs = await this.getExtensionsConfigs();
    return distinct(configs.flatMap((c) => c.recommendations ? c.recommendations.map((c2) => c2.toLowerCase()) : []));
  }
  async getUnwantedRecommendations() {
    const configs = await this.getExtensionsConfigs();
    return distinct(configs.flatMap((c) => c.unwantedRecommendations ? c.unwantedRecommendations.map((c2) => c2.toLowerCase()) : []));
  }
  async toggleRecommendation(extensionId) {
    extensionId = extensionId.toLowerCase();
    const workspace = this.workspaceContextService.getWorkspace();
    const workspaceExtensionsConfigContent = workspace.configuration ? await this.resolveWorkspaceExtensionConfig(workspace.configuration) : void 0;
    const workspaceFolderExtensionsConfigContents = new ResourceMap();
    await Promise.all(workspace.folders.map(async (workspaceFolder) => {
      const extensionsConfigContent = await this.resolveWorkspaceFolderExtensionConfig(workspaceFolder);
      workspaceFolderExtensionsConfigContents.set(workspaceFolder.uri, extensionsConfigContent);
    }));
    const isWorkspaceRecommended = workspaceExtensionsConfigContent && workspaceExtensionsConfigContent.recommendations?.some((r) => r.toLowerCase() === extensionId);
    const recommendedWorksapceFolders = workspace.folders.filter((workspaceFolder) => workspaceFolderExtensionsConfigContents.get(workspaceFolder.uri)?.recommendations?.some((r) => r.toLowerCase() === extensionId));
    const isRecommended = isWorkspaceRecommended || recommendedWorksapceFolders.length > 0;
    const workspaceOrFolders = isRecommended ? await this.pickWorkspaceOrFolders(recommendedWorksapceFolders, isWorkspaceRecommended ? workspace : void 0, localize("select for remove", "Remove extension recommendation from")) : await this.pickWorkspaceOrFolders(workspace.folders, workspace.configuration ? workspace : void 0, localize("select for add", "Add extension recommendation to"));
    for (const workspaceOrWorkspaceFolder of workspaceOrFolders) {
      if (isWorkspace(workspaceOrWorkspaceFolder)) {
        await this.addOrRemoveWorkspaceRecommendation(extensionId, workspaceOrWorkspaceFolder, workspaceExtensionsConfigContent, !isRecommended);
      } else {
        await this.addOrRemoveWorkspaceFolderRecommendation(extensionId, workspaceOrWorkspaceFolder, workspaceFolderExtensionsConfigContents.get(workspaceOrWorkspaceFolder.uri), !isRecommended);
      }
    }
  }
  async toggleUnwantedRecommendation(extensionId) {
    const workspace = this.workspaceContextService.getWorkspace();
    const workspaceExtensionsConfigContent = workspace.configuration ? await this.resolveWorkspaceExtensionConfig(workspace.configuration) : void 0;
    const workspaceFolderExtensionsConfigContents = new ResourceMap();
    await Promise.all(workspace.folders.map(async (workspaceFolder) => {
      const extensionsConfigContent = await this.resolveWorkspaceFolderExtensionConfig(workspaceFolder);
      workspaceFolderExtensionsConfigContents.set(workspaceFolder.uri, extensionsConfigContent);
    }));
    const isWorkspaceUnwanted = workspaceExtensionsConfigContent && workspaceExtensionsConfigContent.unwantedRecommendations?.some((r) => r === extensionId);
    const unWantedWorksapceFolders = workspace.folders.filter((workspaceFolder) => workspaceFolderExtensionsConfigContents.get(workspaceFolder.uri)?.unwantedRecommendations?.some((r) => r === extensionId));
    const isUnwanted = isWorkspaceUnwanted || unWantedWorksapceFolders.length > 0;
    const workspaceOrFolders = isUnwanted ? await this.pickWorkspaceOrFolders(unWantedWorksapceFolders, isWorkspaceUnwanted ? workspace : void 0, localize("select for remove", "Remove extension recommendation from")) : await this.pickWorkspaceOrFolders(workspace.folders, workspace.configuration ? workspace : void 0, localize("select for add", "Add extension recommendation to"));
    for (const workspaceOrWorkspaceFolder of workspaceOrFolders) {
      if (isWorkspace(workspaceOrWorkspaceFolder)) {
        await this.addOrRemoveWorkspaceUnwantedRecommendation(extensionId, workspaceOrWorkspaceFolder, workspaceExtensionsConfigContent, !isUnwanted);
      } else {
        await this.addOrRemoveWorkspaceFolderUnwantedRecommendation(extensionId, workspaceOrWorkspaceFolder, workspaceFolderExtensionsConfigContents.get(workspaceOrWorkspaceFolder.uri), !isUnwanted);
      }
    }
  }
  async addOrRemoveWorkspaceFolderRecommendation(extensionId, workspaceFolder, extensionsConfigContent, add) {
    const values = [];
    if (add) {
      if (Array.isArray(extensionsConfigContent.recommendations)) {
        values.push({ path: ["recommendations", -1], value: extensionId });
      } else {
        values.push({ path: ["recommendations"], value: [extensionId] });
      }
      const unwantedRecommendationEdit = this.getEditToRemoveValueFromArray(["unwantedRecommendations"], extensionsConfigContent.unwantedRecommendations, extensionId);
      if (unwantedRecommendationEdit) {
        values.push(unwantedRecommendationEdit);
      }
    } else if (extensionsConfigContent.recommendations) {
      const recommendationEdit = this.getEditToRemoveValueFromArray(["recommendations"], extensionsConfigContent.recommendations, extensionId);
      if (recommendationEdit) {
        values.push(recommendationEdit);
      }
    }
    if (values.length) {
      return this.jsonEditingService.write(workspaceFolder.toResource(EXTENSIONS_CONFIG), values, true);
    }
  }
  async addOrRemoveWorkspaceRecommendation(extensionId, workspace, extensionsConfigContent, add) {
    const values = [];
    if (extensionsConfigContent) {
      if (add) {
        const path = ["extensions", "recommendations"];
        if (Array.isArray(extensionsConfigContent.recommendations)) {
          values.push({ path: [...path, -1], value: extensionId });
        } else {
          values.push({ path, value: [extensionId] });
        }
        const unwantedRecommendationEdit = this.getEditToRemoveValueFromArray(["extensions", "unwantedRecommendations"], extensionsConfigContent.unwantedRecommendations, extensionId);
        if (unwantedRecommendationEdit) {
          values.push(unwantedRecommendationEdit);
        }
      } else if (extensionsConfigContent.recommendations) {
        const recommendationEdit = this.getEditToRemoveValueFromArray(["extensions", "recommendations"], extensionsConfigContent.recommendations, extensionId);
        if (recommendationEdit) {
          values.push(recommendationEdit);
        }
      }
    } else if (add) {
      values.push({ path: ["extensions"], value: { recommendations: [extensionId] } });
    }
    if (values.length) {
      return this.jsonEditingService.write(workspace.configuration, values, true);
    }
  }
  async addOrRemoveWorkspaceFolderUnwantedRecommendation(extensionId, workspaceFolder, extensionsConfigContent, add) {
    const values = [];
    if (add) {
      const path = ["unwantedRecommendations"];
      if (Array.isArray(extensionsConfigContent.unwantedRecommendations)) {
        values.push({ path: [...path, -1], value: extensionId });
      } else {
        values.push({ path, value: [extensionId] });
      }
      const recommendationEdit = this.getEditToRemoveValueFromArray(["recommendations"], extensionsConfigContent.recommendations, extensionId);
      if (recommendationEdit) {
        values.push(recommendationEdit);
      }
    } else if (extensionsConfigContent.unwantedRecommendations) {
      const unwantedRecommendationEdit = this.getEditToRemoveValueFromArray(["unwantedRecommendations"], extensionsConfigContent.unwantedRecommendations, extensionId);
      if (unwantedRecommendationEdit) {
        values.push(unwantedRecommendationEdit);
      }
    }
    if (values.length) {
      return this.jsonEditingService.write(workspaceFolder.toResource(EXTENSIONS_CONFIG), values, true);
    }
  }
  async addOrRemoveWorkspaceUnwantedRecommendation(extensionId, workspace, extensionsConfigContent, add) {
    const values = [];
    if (extensionsConfigContent) {
      if (add) {
        const path = ["extensions", "unwantedRecommendations"];
        if (Array.isArray(extensionsConfigContent.recommendations)) {
          values.push({ path: [...path, -1], value: extensionId });
        } else {
          values.push({ path, value: [extensionId] });
        }
        const recommendationEdit = this.getEditToRemoveValueFromArray(["extensions", "recommendations"], extensionsConfigContent.recommendations, extensionId);
        if (recommendationEdit) {
          values.push(recommendationEdit);
        }
      } else if (extensionsConfigContent.unwantedRecommendations) {
        const unwantedRecommendationEdit = this.getEditToRemoveValueFromArray(["extensions", "unwantedRecommendations"], extensionsConfigContent.unwantedRecommendations, extensionId);
        if (unwantedRecommendationEdit) {
          values.push(unwantedRecommendationEdit);
        }
      }
    } else if (add) {
      values.push({ path: ["extensions"], value: { unwantedRecommendations: [extensionId] } });
    }
    if (values.length) {
      return this.jsonEditingService.write(workspace.configuration, values, true);
    }
  }
  async pickWorkspaceOrFolders(workspaceFolders, workspace, placeHolder) {
    const workspaceOrFolders = workspace ? [...workspaceFolders, workspace] : [...workspaceFolders];
    if (workspaceOrFolders.length === 1) {
      return workspaceOrFolders;
    }
    const folderPicks = workspaceFolders.map((workspaceFolder) => {
      return {
        label: workspaceFolder.name,
        description: localize("workspace folder", "Workspace Folder"),
        workspaceOrFolder: workspaceFolder,
        iconClasses: getIconClasses(this.modelService, this.languageService, workspaceFolder.uri, FileKind.ROOT_FOLDER)
      };
    });
    if (workspace) {
      folderPicks.push({ type: "separator" });
      folderPicks.push({
        label: localize("workspace", "Workspace"),
        workspaceOrFolder: workspace
      });
    }
    const result = await this.quickInputService.pick(folderPicks, { placeHolder, canPickMany: true }) || [];
    return result.map((r) => r.workspaceOrFolder);
  }
  async resolveWorkspaceExtensionConfig(workspaceConfigurationResource) {
    try {
      const content = await this.fileService.readFile(workspaceConfigurationResource);
      const extensionsConfigContent = parse(content.value.toString())["extensions"];
      return extensionsConfigContent ? this.parseExtensionConfig(extensionsConfigContent) : void 0;
    } catch (e) {
    }
    return void 0;
  }
  async resolveWorkspaceFolderExtensionConfig(workspaceFolder) {
    try {
      const content = await this.fileService.readFile(workspaceFolder.toResource(EXTENSIONS_CONFIG));
      const extensionsConfigContent = parse(content.value.toString());
      return this.parseExtensionConfig(extensionsConfigContent);
    } catch (e) {
    }
    return {};
  }
  parseExtensionConfig(extensionsConfigContent) {
    return {
      recommendations: distinct((extensionsConfigContent.recommendations || []).map((e) => e.toLowerCase())),
      unwantedRecommendations: distinct((extensionsConfigContent.unwantedRecommendations || []).map((e) => e.toLowerCase()))
    };
  }
  getEditToRemoveValueFromArray(path, array, value) {
    const index = array?.indexOf(value);
    if (index !== void 0 && index !== -1) {
      return { path: [...path, index], value: void 0 };
    }
    return void 0;
  }
};
WorkspaceExtensionsConfigService = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, IModelService),
  __decorateParam(4, ILanguageService),
  __decorateParam(5, IJSONEditingService)
], WorkspaceExtensionsConfigService);
registerSingleton(IWorkspaceExtensionsConfigService, WorkspaceExtensionsConfigService, InstantiationType.Delayed);
export {
  EXTENSIONS_CONFIG,
  IWorkspaceExtensionsConfigService,
  WorkspaceExtensionsConfigService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zL2NvbW1vbi93b3Jrc3BhY2VFeHRlbnNpb25zQ29uZmlnLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZGlzdGluY3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBKU09OUGF0aCwgcGFyc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZ2V0SWNvbkNsYXNzZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2dldEljb25DbGFzc2VzLmpzJztcbmltcG9ydCB7IEZpbGVLaW5kLCBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IGlzV29ya3NwYWNlLCBJV29ya3NwYWNlLCBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIElXb3Jrc3BhY2VGb2xkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtLCBJUXVpY2tQaWNrU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElKU09ORWRpdGluZ1NlcnZpY2UsIElKU09OVmFsdWUgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9qc29uRWRpdGluZy5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5cbmV4cG9ydCBjb25zdCBFWFRFTlNJT05TX0NPTkZJRyA9ICcudnNjb2RlL2V4dGVuc2lvbnMuanNvbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUV4dGVuc2lvbnNDb25maWdDb250ZW50IHtcblx0cmVjb21tZW5kYXRpb25zPzogc3RyaW5nW107XG5cdHVud2FudGVkUmVjb21tZW5kYXRpb25zPzogc3RyaW5nW107XG59XG5cbmV4cG9ydCBjb25zdCBJV29ya3NwYWNlRXh0ZW5zaW9uc0NvbmZpZ1NlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SVdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdTZXJ2aWNlPignSVdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdTZXJ2aWNlJyk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdTZXJ2aWNlIHtcblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdG9uRGlkQ2hhbmdlRXh0ZW5zaW9uc0NvbmZpZ3M6IEV2ZW50PHZvaWQ+O1xuXHRnZXRFeHRlbnNpb25zQ29uZmlncygpOiBQcm9taXNlPElFeHRlbnNpb25zQ29uZmlnQ29udGVudFtdPjtcblx0Z2V0UmVjb21tZW5kYXRpb25zKCk6IFByb21pc2U8c3RyaW5nW10+O1xuXHRnZXRVbndhbnRlZFJlY29tbWVuZGF0aW9ucygpOiBQcm9taXNlPHN0cmluZ1tdPjtcblxuXHR0b2dnbGVSZWNvbW1lbmRhdGlvbihleHRlbnNpb25JZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPjtcblx0dG9nZ2xlVW53YW50ZWRSZWNvbW1lbmRhdGlvbihleHRlbnNpb25JZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuZXhwb3J0IGNsYXNzIFdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3Jrc3BhY2VFeHRlbnNpb25zQ29uZmlnU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VFeHRlbnNpb25zQ29uZmlncyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUV4dGVuc2lvbnNDb25maWdzID0gdGhpcy5fb25EaWRDaGFuZ2VFeHRlbnNpb25zQ29uZmlncy5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASUpTT05FZGl0aW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGpzb25FZGl0aW5nU2VydmljZTogSUpTT05FZGl0aW5nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih3b3Jrc3BhY2VDb250ZXh0U2VydmljZS5vbkRpZENoYW5nZVdvcmtzcGFjZUZvbGRlcnMoZSA9PiB0aGlzLl9vbkRpZENoYW5nZUV4dGVuc2lvbnNDb25maWdzLmZpcmUoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGZpbGVTZXJ2aWNlLm9uRGlkRmlsZXNDaGFuZ2UoZSA9PiB7XG5cdFx0XHRjb25zdCB3b3Jrc3BhY2UgPSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKTtcblx0XHRcdGlmICgod29ya3NwYWNlLmNvbmZpZ3VyYXRpb24gJiYgZS5hZmZlY3RzKHdvcmtzcGFjZS5jb25maWd1cmF0aW9uKSlcblx0XHRcdFx0fHwgd29ya3NwYWNlLmZvbGRlcnMuc29tZShmb2xkZXIgPT4gZS5hZmZlY3RzKGZvbGRlci50b1Jlc291cmNlKEVYVEVOU0lPTlNfQ09ORklHKSkpXG5cdFx0XHQpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VFeHRlbnNpb25zQ29uZmlncy5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0YXN5bmMgZ2V0RXh0ZW5zaW9uc0NvbmZpZ3MoKTogUHJvbWlzZTxJRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnRbXT4ge1xuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCk7XG5cdFx0Y29uc3QgcmVzdWx0OiBJRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnRbXSA9IFtdO1xuXHRcdGNvbnN0IHdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdDb250ZW50ID0gd29ya3NwYWNlLmNvbmZpZ3VyYXRpb24gPyBhd2FpdCB0aGlzLnJlc29sdmVXb3Jrc3BhY2VFeHRlbnNpb25Db25maWcod29ya3NwYWNlLmNvbmZpZ3VyYXRpb24pIDogdW5kZWZpbmVkO1xuXHRcdGlmICh3b3Jrc3BhY2VFeHRlbnNpb25zQ29uZmlnQ29udGVudCkge1xuXHRcdFx0cmVzdWx0LnB1c2god29ya3NwYWNlRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQpO1xuXHRcdH1cblx0XHRyZXN1bHQucHVzaCguLi5hd2FpdCBQcm9taXNlLmFsbCh3b3Jrc3BhY2UuZm9sZGVycy5tYXAod29ya3NwYWNlRm9sZGVyID0+IHRoaXMucmVzb2x2ZVdvcmtzcGFjZUZvbGRlckV4dGVuc2lvbkNvbmZpZyh3b3Jrc3BhY2VGb2xkZXIpKSkpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRhc3luYyBnZXRSZWNvbW1lbmRhdGlvbnMoKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuXHRcdGNvbnN0IGNvbmZpZ3MgPSBhd2FpdCB0aGlzLmdldEV4dGVuc2lvbnNDb25maWdzKCk7XG5cdFx0cmV0dXJuIGRpc3RpbmN0KGNvbmZpZ3MuZmxhdE1hcChjID0+IGMucmVjb21tZW5kYXRpb25zID8gYy5yZWNvbW1lbmRhdGlvbnMubWFwKGMgPT4gYy50b0xvd2VyQ2FzZSgpKSA6IFtdKSk7XG5cdH1cblxuXHRhc3luYyBnZXRVbndhbnRlZFJlY29tbWVuZGF0aW9ucygpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG5cdFx0Y29uc3QgY29uZmlncyA9IGF3YWl0IHRoaXMuZ2V0RXh0ZW5zaW9uc0NvbmZpZ3MoKTtcblx0XHRyZXR1cm4gZGlzdGluY3QoY29uZmlncy5mbGF0TWFwKGMgPT4gYy51bndhbnRlZFJlY29tbWVuZGF0aW9ucyA/IGMudW53YW50ZWRSZWNvbW1lbmRhdGlvbnMubWFwKGMgPT4gYy50b0xvd2VyQ2FzZSgpKSA6IFtdKSk7XG5cdH1cblxuXHRhc3luYyB0b2dnbGVSZWNvbW1lbmRhdGlvbihleHRlbnNpb25JZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0ZXh0ZW5zaW9uSWQgPSBleHRlbnNpb25JZC50b0xvd2VyQ2FzZSgpO1xuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCk7XG5cdFx0Y29uc3Qgd29ya3NwYWNlRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQgPSB3b3Jrc3BhY2UuY29uZmlndXJhdGlvbiA/IGF3YWl0IHRoaXMucmVzb2x2ZVdvcmtzcGFjZUV4dGVuc2lvbkNvbmZpZyh3b3Jrc3BhY2UuY29uZmlndXJhdGlvbikgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3Qgd29ya3NwYWNlRm9sZGVyRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnRzID0gbmV3IFJlc291cmNlTWFwPElFeHRlbnNpb25zQ29uZmlnQ29udGVudD4oKTtcblx0XHRhd2FpdCBQcm9taXNlLmFsbCh3b3Jrc3BhY2UuZm9sZGVycy5tYXAoYXN5bmMgd29ya3NwYWNlRm9sZGVyID0+IHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbnNDb25maWdDb250ZW50ID0gYXdhaXQgdGhpcy5yZXNvbHZlV29ya3NwYWNlRm9sZGVyRXh0ZW5zaW9uQ29uZmlnKHdvcmtzcGFjZUZvbGRlcik7XG5cdFx0XHR3b3Jrc3BhY2VGb2xkZXJFeHRlbnNpb25zQ29uZmlnQ29udGVudHMuc2V0KHdvcmtzcGFjZUZvbGRlci51cmksIGV4dGVuc2lvbnNDb25maWdDb250ZW50KTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCBpc1dvcmtzcGFjZVJlY29tbWVuZGVkID0gd29ya3NwYWNlRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQgJiYgd29ya3NwYWNlRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQucmVjb21tZW5kYXRpb25zPy5zb21lKHIgPT4gci50b0xvd2VyQ2FzZSgpID09PSBleHRlbnNpb25JZCk7XG5cdFx0Y29uc3QgcmVjb21tZW5kZWRXb3Jrc2FwY2VGb2xkZXJzID0gd29ya3NwYWNlLmZvbGRlcnMuZmlsdGVyKHdvcmtzcGFjZUZvbGRlciA9PiB3b3Jrc3BhY2VGb2xkZXJFeHRlbnNpb25zQ29uZmlnQ29udGVudHMuZ2V0KHdvcmtzcGFjZUZvbGRlci51cmkpPy5yZWNvbW1lbmRhdGlvbnM/LnNvbWUociA9PiByLnRvTG93ZXJDYXNlKCkgPT09IGV4dGVuc2lvbklkKSk7XG5cdFx0Y29uc3QgaXNSZWNvbW1lbmRlZCA9IGlzV29ya3NwYWNlUmVjb21tZW5kZWQgfHwgcmVjb21tZW5kZWRXb3Jrc2FwY2VGb2xkZXJzLmxlbmd0aCA+IDA7XG5cblx0XHRjb25zdCB3b3Jrc3BhY2VPckZvbGRlcnMgPSBpc1JlY29tbWVuZGVkXG5cdFx0XHQ/IGF3YWl0IHRoaXMucGlja1dvcmtzcGFjZU9yRm9sZGVycyhyZWNvbW1lbmRlZFdvcmtzYXBjZUZvbGRlcnMsIGlzV29ya3NwYWNlUmVjb21tZW5kZWQgPyB3b3Jrc3BhY2UgOiB1bmRlZmluZWQsIGxvY2FsaXplKCdzZWxlY3QgZm9yIHJlbW92ZScsIFwiUmVtb3ZlIGV4dGVuc2lvbiByZWNvbW1lbmRhdGlvbiBmcm9tXCIpKVxuXHRcdFx0OiBhd2FpdCB0aGlzLnBpY2tXb3Jrc3BhY2VPckZvbGRlcnMod29ya3NwYWNlLmZvbGRlcnMsIHdvcmtzcGFjZS5jb25maWd1cmF0aW9uID8gd29ya3NwYWNlIDogdW5kZWZpbmVkLCBsb2NhbGl6ZSgnc2VsZWN0IGZvciBhZGQnLCBcIkFkZCBleHRlbnNpb24gcmVjb21tZW5kYXRpb24gdG9cIikpO1xuXG5cdFx0Zm9yIChjb25zdCB3b3Jrc3BhY2VPcldvcmtzcGFjZUZvbGRlciBvZiB3b3Jrc3BhY2VPckZvbGRlcnMpIHtcblx0XHRcdGlmIChpc1dvcmtzcGFjZSh3b3Jrc3BhY2VPcldvcmtzcGFjZUZvbGRlcikpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5hZGRPclJlbW92ZVdvcmtzcGFjZVJlY29tbWVuZGF0aW9uKGV4dGVuc2lvbklkLCB3b3Jrc3BhY2VPcldvcmtzcGFjZUZvbGRlciwgd29ya3NwYWNlRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQsICFpc1JlY29tbWVuZGVkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuYWRkT3JSZW1vdmVXb3Jrc3BhY2VGb2xkZXJSZWNvbW1lbmRhdGlvbihleHRlbnNpb25JZCwgd29ya3NwYWNlT3JXb3Jrc3BhY2VGb2xkZXIsIHdvcmtzcGFjZUZvbGRlckV4dGVuc2lvbnNDb25maWdDb250ZW50cy5nZXQod29ya3NwYWNlT3JXb3Jrc3BhY2VGb2xkZXIudXJpKSEsICFpc1JlY29tbWVuZGVkKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRhc3luYyB0b2dnbGVVbndhbnRlZFJlY29tbWVuZGF0aW9uKGV4dGVuc2lvbklkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB3b3Jrc3BhY2UgPSB0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpO1xuXHRcdGNvbnN0IHdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdDb250ZW50ID0gd29ya3NwYWNlLmNvbmZpZ3VyYXRpb24gPyBhd2FpdCB0aGlzLnJlc29sdmVXb3Jrc3BhY2VFeHRlbnNpb25Db25maWcod29ya3NwYWNlLmNvbmZpZ3VyYXRpb24pIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlckV4dGVuc2lvbnNDb25maWdDb250ZW50cyA9IG5ldyBSZXNvdXJjZU1hcDxJRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQ+KCk7XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwod29ya3NwYWNlLmZvbGRlcnMubWFwKGFzeW5jIHdvcmtzcGFjZUZvbGRlciA9PiB7XG5cdFx0XHRjb25zdCBleHRlbnNpb25zQ29uZmlnQ29udGVudCA9IGF3YWl0IHRoaXMucmVzb2x2ZVdvcmtzcGFjZUZvbGRlckV4dGVuc2lvbkNvbmZpZyh3b3Jrc3BhY2VGb2xkZXIpO1xuXHRcdFx0d29ya3NwYWNlRm9sZGVyRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnRzLnNldCh3b3Jrc3BhY2VGb2xkZXIudXJpLCBleHRlbnNpb25zQ29uZmlnQ29udGVudCk7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgaXNXb3Jrc3BhY2VVbndhbnRlZCA9IHdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdDb250ZW50ICYmIHdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdDb250ZW50LnVud2FudGVkUmVjb21tZW5kYXRpb25zPy5zb21lKHIgPT4gciA9PT0gZXh0ZW5zaW9uSWQpO1xuXHRcdGNvbnN0IHVuV2FudGVkV29ya3NhcGNlRm9sZGVycyA9IHdvcmtzcGFjZS5mb2xkZXJzLmZpbHRlcih3b3Jrc3BhY2VGb2xkZXIgPT4gd29ya3NwYWNlRm9sZGVyRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnRzLmdldCh3b3Jrc3BhY2VGb2xkZXIudXJpKT8udW53YW50ZWRSZWNvbW1lbmRhdGlvbnM/LnNvbWUociA9PiByID09PSBleHRlbnNpb25JZCkpO1xuXHRcdGNvbnN0IGlzVW53YW50ZWQgPSBpc1dvcmtzcGFjZVVud2FudGVkIHx8IHVuV2FudGVkV29ya3NhcGNlRm9sZGVycy5sZW5ndGggPiAwO1xuXG5cdFx0Y29uc3Qgd29ya3NwYWNlT3JGb2xkZXJzID0gaXNVbndhbnRlZFxuXHRcdFx0PyBhd2FpdCB0aGlzLnBpY2tXb3Jrc3BhY2VPckZvbGRlcnModW5XYW50ZWRXb3Jrc2FwY2VGb2xkZXJzLCBpc1dvcmtzcGFjZVVud2FudGVkID8gd29ya3NwYWNlIDogdW5kZWZpbmVkLCBsb2NhbGl6ZSgnc2VsZWN0IGZvciByZW1vdmUnLCBcIlJlbW92ZSBleHRlbnNpb24gcmVjb21tZW5kYXRpb24gZnJvbVwiKSlcblx0XHRcdDogYXdhaXQgdGhpcy5waWNrV29ya3NwYWNlT3JGb2xkZXJzKHdvcmtzcGFjZS5mb2xkZXJzLCB3b3Jrc3BhY2UuY29uZmlndXJhdGlvbiA/IHdvcmtzcGFjZSA6IHVuZGVmaW5lZCwgbG9jYWxpemUoJ3NlbGVjdCBmb3IgYWRkJywgXCJBZGQgZXh0ZW5zaW9uIHJlY29tbWVuZGF0aW9uIHRvXCIpKTtcblxuXHRcdGZvciAoY29uc3Qgd29ya3NwYWNlT3JXb3Jrc3BhY2VGb2xkZXIgb2Ygd29ya3NwYWNlT3JGb2xkZXJzKSB7XG5cdFx0XHRpZiAoaXNXb3Jrc3BhY2Uod29ya3NwYWNlT3JXb3Jrc3BhY2VGb2xkZXIpKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuYWRkT3JSZW1vdmVXb3Jrc3BhY2VVbndhbnRlZFJlY29tbWVuZGF0aW9uKGV4dGVuc2lvbklkLCB3b3Jrc3BhY2VPcldvcmtzcGFjZUZvbGRlciwgd29ya3NwYWNlRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQsICFpc1Vud2FudGVkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuYWRkT3JSZW1vdmVXb3Jrc3BhY2VGb2xkZXJVbndhbnRlZFJlY29tbWVuZGF0aW9uKGV4dGVuc2lvbklkLCB3b3Jrc3BhY2VPcldvcmtzcGFjZUZvbGRlciwgd29ya3NwYWNlRm9sZGVyRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnRzLmdldCh3b3Jrc3BhY2VPcldvcmtzcGFjZUZvbGRlci51cmkpISwgIWlzVW53YW50ZWQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgYWRkT3JSZW1vdmVXb3Jrc3BhY2VGb2xkZXJSZWNvbW1lbmRhdGlvbihleHRlbnNpb25JZDogc3RyaW5nLCB3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIsIGV4dGVuc2lvbnNDb25maWdDb250ZW50OiBJRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQsIGFkZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHZhbHVlczogSUpTT05WYWx1ZVtdID0gW107XG5cdFx0aWYgKGFkZCkge1xuXHRcdFx0aWYgKEFycmF5LmlzQXJyYXkoZXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQucmVjb21tZW5kYXRpb25zKSkge1xuXHRcdFx0XHR2YWx1ZXMucHVzaCh7IHBhdGg6IFsncmVjb21tZW5kYXRpb25zJywgLTFdLCB2YWx1ZTogZXh0ZW5zaW9uSWQgfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2YWx1ZXMucHVzaCh7IHBhdGg6IFsncmVjb21tZW5kYXRpb25zJ10sIHZhbHVlOiBbZXh0ZW5zaW9uSWRdIH0pO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgdW53YW50ZWRSZWNvbW1lbmRhdGlvbkVkaXQgPSB0aGlzLmdldEVkaXRUb1JlbW92ZVZhbHVlRnJvbUFycmF5KFsndW53YW50ZWRSZWNvbW1lbmRhdGlvbnMnXSwgZXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQudW53YW50ZWRSZWNvbW1lbmRhdGlvbnMsIGV4dGVuc2lvbklkKTtcblx0XHRcdGlmICh1bndhbnRlZFJlY29tbWVuZGF0aW9uRWRpdCkge1xuXHRcdFx0XHR2YWx1ZXMucHVzaCh1bndhbnRlZFJlY29tbWVuZGF0aW9uRWRpdCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChleHRlbnNpb25zQ29uZmlnQ29udGVudC5yZWNvbW1lbmRhdGlvbnMpIHtcblx0XHRcdGNvbnN0IHJlY29tbWVuZGF0aW9uRWRpdCA9IHRoaXMuZ2V0RWRpdFRvUmVtb3ZlVmFsdWVGcm9tQXJyYXkoWydyZWNvbW1lbmRhdGlvbnMnXSwgZXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQucmVjb21tZW5kYXRpb25zLCBleHRlbnNpb25JZCk7XG5cdFx0XHRpZiAocmVjb21tZW5kYXRpb25FZGl0KSB7XG5cdFx0XHRcdHZhbHVlcy5wdXNoKHJlY29tbWVuZGF0aW9uRWRpdCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHZhbHVlcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB0aGlzLmpzb25FZGl0aW5nU2VydmljZS53cml0ZSh3b3Jrc3BhY2VGb2xkZXIudG9SZXNvdXJjZShFWFRFTlNJT05TX0NPTkZJRyksIHZhbHVlcywgdHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBhZGRPclJlbW92ZVdvcmtzcGFjZVJlY29tbWVuZGF0aW9uKGV4dGVuc2lvbklkOiBzdHJpbmcsIHdvcmtzcGFjZTogSVdvcmtzcGFjZSwgZXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQ6IElFeHRlbnNpb25zQ29uZmlnQ29udGVudCB8IHVuZGVmaW5lZCwgYWRkOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdmFsdWVzOiBJSlNPTlZhbHVlW10gPSBbXTtcblx0XHRpZiAoZXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQpIHtcblx0XHRcdGlmIChhZGQpIHtcblx0XHRcdFx0Y29uc3QgcGF0aDogSlNPTlBhdGggPSBbJ2V4dGVuc2lvbnMnLCAncmVjb21tZW5kYXRpb25zJ107XG5cdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KGV4dGVuc2lvbnNDb25maWdDb250ZW50LnJlY29tbWVuZGF0aW9ucykpIHtcblx0XHRcdFx0XHR2YWx1ZXMucHVzaCh7IHBhdGg6IFsuLi5wYXRoLCAtMV0sIHZhbHVlOiBleHRlbnNpb25JZCB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR2YWx1ZXMucHVzaCh7IHBhdGgsIHZhbHVlOiBbZXh0ZW5zaW9uSWRdIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHVud2FudGVkUmVjb21tZW5kYXRpb25FZGl0ID0gdGhpcy5nZXRFZGl0VG9SZW1vdmVWYWx1ZUZyb21BcnJheShbJ2V4dGVuc2lvbnMnLCAndW53YW50ZWRSZWNvbW1lbmRhdGlvbnMnXSwgZXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQudW53YW50ZWRSZWNvbW1lbmRhdGlvbnMsIGV4dGVuc2lvbklkKTtcblx0XHRcdFx0aWYgKHVud2FudGVkUmVjb21tZW5kYXRpb25FZGl0KSB7XG5cdFx0XHRcdFx0dmFsdWVzLnB1c2godW53YW50ZWRSZWNvbW1lbmRhdGlvbkVkaXQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGV4dGVuc2lvbnNDb25maWdDb250ZW50LnJlY29tbWVuZGF0aW9ucykge1xuXHRcdFx0XHRjb25zdCByZWNvbW1lbmRhdGlvbkVkaXQgPSB0aGlzLmdldEVkaXRUb1JlbW92ZVZhbHVlRnJvbUFycmF5KFsnZXh0ZW5zaW9ucycsICdyZWNvbW1lbmRhdGlvbnMnXSwgZXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQucmVjb21tZW5kYXRpb25zLCBleHRlbnNpb25JZCk7XG5cdFx0XHRcdGlmIChyZWNvbW1lbmRhdGlvbkVkaXQpIHtcblx0XHRcdFx0XHR2YWx1ZXMucHVzaChyZWNvbW1lbmRhdGlvbkVkaXQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChhZGQpIHtcblx0XHRcdHZhbHVlcy5wdXNoKHsgcGF0aDogWydleHRlbnNpb25zJ10sIHZhbHVlOiB7IHJlY29tbWVuZGF0aW9uczogW2V4dGVuc2lvbklkXSB9IH0pO1xuXHRcdH1cblxuXHRcdGlmICh2YWx1ZXMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5qc29uRWRpdGluZ1NlcnZpY2Uud3JpdGUod29ya3NwYWNlLmNvbmZpZ3VyYXRpb24hLCB2YWx1ZXMsIHRydWUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgYWRkT3JSZW1vdmVXb3Jrc3BhY2VGb2xkZXJVbndhbnRlZFJlY29tbWVuZGF0aW9uKGV4dGVuc2lvbklkOiBzdHJpbmcsIHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZUZvbGRlciwgZXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQ6IElFeHRlbnNpb25zQ29uZmlnQ29udGVudCwgYWRkOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdmFsdWVzOiBJSlNPTlZhbHVlW10gPSBbXTtcblx0XHRpZiAoYWRkKSB7XG5cdFx0XHRjb25zdCBwYXRoOiBKU09OUGF0aCA9IFsndW53YW50ZWRSZWNvbW1lbmRhdGlvbnMnXTtcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KGV4dGVuc2lvbnNDb25maWdDb250ZW50LnVud2FudGVkUmVjb21tZW5kYXRpb25zKSkge1xuXHRcdFx0XHR2YWx1ZXMucHVzaCh7IHBhdGg6IFsuLi5wYXRoLCAtMV0sIHZhbHVlOiBleHRlbnNpb25JZCB9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHZhbHVlcy5wdXNoKHsgcGF0aCwgdmFsdWU6IFtleHRlbnNpb25JZF0gfSk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZWNvbW1lbmRhdGlvbkVkaXQgPSB0aGlzLmdldEVkaXRUb1JlbW92ZVZhbHVlRnJvbUFycmF5KFsncmVjb21tZW5kYXRpb25zJ10sIGV4dGVuc2lvbnNDb25maWdDb250ZW50LnJlY29tbWVuZGF0aW9ucywgZXh0ZW5zaW9uSWQpO1xuXHRcdFx0aWYgKHJlY29tbWVuZGF0aW9uRWRpdCkge1xuXHRcdFx0XHR2YWx1ZXMucHVzaChyZWNvbW1lbmRhdGlvbkVkaXQpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoZXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQudW53YW50ZWRSZWNvbW1lbmRhdGlvbnMpIHtcblx0XHRcdGNvbnN0IHVud2FudGVkUmVjb21tZW5kYXRpb25FZGl0ID0gdGhpcy5nZXRFZGl0VG9SZW1vdmVWYWx1ZUZyb21BcnJheShbJ3Vud2FudGVkUmVjb21tZW5kYXRpb25zJ10sIGV4dGVuc2lvbnNDb25maWdDb250ZW50LnVud2FudGVkUmVjb21tZW5kYXRpb25zLCBleHRlbnNpb25JZCk7XG5cdFx0XHRpZiAodW53YW50ZWRSZWNvbW1lbmRhdGlvbkVkaXQpIHtcblx0XHRcdFx0dmFsdWVzLnB1c2godW53YW50ZWRSZWNvbW1lbmRhdGlvbkVkaXQpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAodmFsdWVzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuanNvbkVkaXRpbmdTZXJ2aWNlLndyaXRlKHdvcmtzcGFjZUZvbGRlci50b1Jlc291cmNlKEVYVEVOU0lPTlNfQ09ORklHKSwgdmFsdWVzLCB0cnVlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGFkZE9yUmVtb3ZlV29ya3NwYWNlVW53YW50ZWRSZWNvbW1lbmRhdGlvbihleHRlbnNpb25JZDogc3RyaW5nLCB3b3Jrc3BhY2U6IElXb3Jrc3BhY2UsIGV4dGVuc2lvbnNDb25maWdDb250ZW50OiBJRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQgfCB1bmRlZmluZWQsIGFkZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHZhbHVlczogSUpTT05WYWx1ZVtdID0gW107XG5cdFx0aWYgKGV4dGVuc2lvbnNDb25maWdDb250ZW50KSB7XG5cdFx0XHRpZiAoYWRkKSB7XG5cdFx0XHRcdGNvbnN0IHBhdGg6IEpTT05QYXRoID0gWydleHRlbnNpb25zJywgJ3Vud2FudGVkUmVjb21tZW5kYXRpb25zJ107XG5cdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KGV4dGVuc2lvbnNDb25maWdDb250ZW50LnJlY29tbWVuZGF0aW9ucykpIHtcblx0XHRcdFx0XHR2YWx1ZXMucHVzaCh7IHBhdGg6IFsuLi5wYXRoLCAtMV0sIHZhbHVlOiBleHRlbnNpb25JZCB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR2YWx1ZXMucHVzaCh7IHBhdGgsIHZhbHVlOiBbZXh0ZW5zaW9uSWRdIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHJlY29tbWVuZGF0aW9uRWRpdCA9IHRoaXMuZ2V0RWRpdFRvUmVtb3ZlVmFsdWVGcm9tQXJyYXkoWydleHRlbnNpb25zJywgJ3JlY29tbWVuZGF0aW9ucyddLCBleHRlbnNpb25zQ29uZmlnQ29udGVudC5yZWNvbW1lbmRhdGlvbnMsIGV4dGVuc2lvbklkKTtcblx0XHRcdFx0aWYgKHJlY29tbWVuZGF0aW9uRWRpdCkge1xuXHRcdFx0XHRcdHZhbHVlcy5wdXNoKHJlY29tbWVuZGF0aW9uRWRpdCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoZXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQudW53YW50ZWRSZWNvbW1lbmRhdGlvbnMpIHtcblx0XHRcdFx0Y29uc3QgdW53YW50ZWRSZWNvbW1lbmRhdGlvbkVkaXQgPSB0aGlzLmdldEVkaXRUb1JlbW92ZVZhbHVlRnJvbUFycmF5KFsnZXh0ZW5zaW9ucycsICd1bndhbnRlZFJlY29tbWVuZGF0aW9ucyddLCBleHRlbnNpb25zQ29uZmlnQ29udGVudC51bndhbnRlZFJlY29tbWVuZGF0aW9ucywgZXh0ZW5zaW9uSWQpO1xuXHRcdFx0XHRpZiAodW53YW50ZWRSZWNvbW1lbmRhdGlvbkVkaXQpIHtcblx0XHRcdFx0XHR2YWx1ZXMucHVzaCh1bndhbnRlZFJlY29tbWVuZGF0aW9uRWRpdCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGFkZCkge1xuXHRcdFx0dmFsdWVzLnB1c2goeyBwYXRoOiBbJ2V4dGVuc2lvbnMnXSwgdmFsdWU6IHsgdW53YW50ZWRSZWNvbW1lbmRhdGlvbnM6IFtleHRlbnNpb25JZF0gfSB9KTtcblx0XHR9XG5cblx0XHRpZiAodmFsdWVzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuanNvbkVkaXRpbmdTZXJ2aWNlLndyaXRlKHdvcmtzcGFjZS5jb25maWd1cmF0aW9uISwgdmFsdWVzLCB0cnVlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHBpY2tXb3Jrc3BhY2VPckZvbGRlcnMod29ya3NwYWNlRm9sZGVyczogSVdvcmtzcGFjZUZvbGRlcltdLCB3b3Jrc3BhY2U6IElXb3Jrc3BhY2UgfCB1bmRlZmluZWQsIHBsYWNlSG9sZGVyOiBzdHJpbmcpOiBQcm9taXNlPChJV29ya3NwYWNlIHwgSVdvcmtzcGFjZUZvbGRlcilbXT4ge1xuXHRcdGNvbnN0IHdvcmtzcGFjZU9yRm9sZGVycyA9IHdvcmtzcGFjZSA/IFsuLi53b3Jrc3BhY2VGb2xkZXJzLCB3b3Jrc3BhY2VdIDogWy4uLndvcmtzcGFjZUZvbGRlcnNdO1xuXHRcdGlmICh3b3Jrc3BhY2VPckZvbGRlcnMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRyZXR1cm4gd29ya3NwYWNlT3JGb2xkZXJzO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvbGRlclBpY2tzOiAoSVF1aWNrUGlja0l0ZW0gJiB7IHdvcmtzcGFjZU9yRm9sZGVyOiBJV29ya3NwYWNlIHwgSVdvcmtzcGFjZUZvbGRlciB9IHwgSVF1aWNrUGlja1NlcGFyYXRvcilbXSA9IHdvcmtzcGFjZUZvbGRlcnMubWFwKHdvcmtzcGFjZUZvbGRlciA9PiB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRsYWJlbDogd29ya3NwYWNlRm9sZGVyLm5hbWUsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd29ya3NwYWNlIGZvbGRlcicsIFwiV29ya3NwYWNlIEZvbGRlclwiKSxcblx0XHRcdFx0d29ya3NwYWNlT3JGb2xkZXI6IHdvcmtzcGFjZUZvbGRlcixcblx0XHRcdFx0aWNvbkNsYXNzZXM6IGdldEljb25DbGFzc2VzKHRoaXMubW9kZWxTZXJ2aWNlLCB0aGlzLmxhbmd1YWdlU2VydmljZSwgd29ya3NwYWNlRm9sZGVyLnVyaSwgRmlsZUtpbmQuUk9PVF9GT0xERVIpXG5cdFx0XHR9O1xuXHRcdH0pO1xuXG5cdFx0aWYgKHdvcmtzcGFjZSkge1xuXHRcdFx0Zm9sZGVyUGlja3MucHVzaCh7IHR5cGU6ICdzZXBhcmF0b3InIH0pO1xuXHRcdFx0Zm9sZGVyUGlja3MucHVzaCh7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnd29ya3NwYWNlJywgXCJXb3Jrc3BhY2VcIiksXG5cdFx0XHRcdHdvcmtzcGFjZU9yRm9sZGVyOiB3b3Jrc3BhY2UsXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLnBpY2soZm9sZGVyUGlja3MsIHsgcGxhY2VIb2xkZXIsIGNhblBpY2tNYW55OiB0cnVlIH0pIHx8IFtdO1xuXHRcdHJldHVybiByZXN1bHQubWFwKHIgPT4gci53b3Jrc3BhY2VPckZvbGRlcik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlc29sdmVXb3Jrc3BhY2VFeHRlbnNpb25Db25maWcod29ya3NwYWNlQ29uZmlndXJhdGlvblJlc291cmNlOiBVUkkpOiBQcm9taXNlPElFeHRlbnNpb25zQ29uZmlnQ29udGVudCB8IHVuZGVmaW5lZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZSh3b3Jrc3BhY2VDb25maWd1cmF0aW9uUmVzb3VyY2UpO1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQgPSA8SUV4dGVuc2lvbnNDb25maWdDb250ZW50IHwgdW5kZWZpbmVkPnBhcnNlKGNvbnRlbnQudmFsdWUudG9TdHJpbmcoKSlbJ2V4dGVuc2lvbnMnXTtcblx0XHRcdHJldHVybiBleHRlbnNpb25zQ29uZmlnQ29udGVudCA/IHRoaXMucGFyc2VFeHRlbnNpb25Db25maWcoZXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQpIDogdW5kZWZpbmVkO1xuXHRcdH0gY2F0Y2ggKGUpIHsgLyogSWdub3JlICovIH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXNvbHZlV29ya3NwYWNlRm9sZGVyRXh0ZW5zaW9uQ29uZmlnKHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZUZvbGRlcik6IFByb21pc2U8SUV4dGVuc2lvbnNDb25maWdDb250ZW50PiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKHdvcmtzcGFjZUZvbGRlci50b1Jlc291cmNlKEVYVEVOU0lPTlNfQ09ORklHKSk7XG5cdFx0XHRjb25zdCBleHRlbnNpb25zQ29uZmlnQ29udGVudCA9IDxJRXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQ+cGFyc2UoY29udGVudC52YWx1ZS50b1N0cmluZygpKTtcblx0XHRcdHJldHVybiB0aGlzLnBhcnNlRXh0ZW5zaW9uQ29uZmlnKGV4dGVuc2lvbnNDb25maWdDb250ZW50KTtcblx0XHR9IGNhdGNoIChlKSB7IC8qIGlnbm9yZSAqLyB9XG5cdFx0cmV0dXJuIHt9O1xuXHR9XG5cblx0cHJpdmF0ZSBwYXJzZUV4dGVuc2lvbkNvbmZpZyhleHRlbnNpb25zQ29uZmlnQ29udGVudDogSUV4dGVuc2lvbnNDb25maWdDb250ZW50KTogSUV4dGVuc2lvbnNDb25maWdDb250ZW50IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVjb21tZW5kYXRpb25zOiBkaXN0aW5jdCgoZXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQucmVjb21tZW5kYXRpb25zIHx8IFtdKS5tYXAoZSA9PiBlLnRvTG93ZXJDYXNlKCkpKSxcblx0XHRcdHVud2FudGVkUmVjb21tZW5kYXRpb25zOiBkaXN0aW5jdCgoZXh0ZW5zaW9uc0NvbmZpZ0NvbnRlbnQudW53YW50ZWRSZWNvbW1lbmRhdGlvbnMgfHwgW10pLm1hcChlID0+IGUudG9Mb3dlckNhc2UoKSkpXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RWRpdFRvUmVtb3ZlVmFsdWVGcm9tQXJyYXkocGF0aDogSlNPTlBhdGgsIGFycmF5OiBzdHJpbmdbXSB8IHVuZGVmaW5lZCwgdmFsdWU6IHN0cmluZyk6IElKU09OVmFsdWUgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGluZGV4ID0gYXJyYXk/LmluZGV4T2YodmFsdWUpO1xuXHRcdGlmIChpbmRleCAhPT0gdW5kZWZpbmVkICYmIGluZGV4ICE9PSAtMSkge1xuXHRcdFx0cmV0dXJuIHsgcGF0aDogWy4uLnBhdGgsIGluZGV4XSwgdmFsdWU6IHVuZGVmaW5lZCB9O1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSVdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdTZXJ2aWNlLCBXb3Jrc3BhY2VFeHRlbnNpb25zQ29uZmlnU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZUFBc0I7QUFDL0IsU0FBbUIsYUFBYTtBQUNoQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFVBQVUsb0JBQW9CO0FBQ3ZDLFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGFBQXlCLGdDQUFrRDtBQUNwRixTQUFTLDBCQUErRDtBQUN4RSxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLDJCQUF1QztBQUNoRCxTQUFTLG1CQUFtQjtBQUVyQixNQUFNLG9CQUFvQjtBQU8xQixNQUFNLG9DQUFvQyxnQkFBbUQsbUNBQW1D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
