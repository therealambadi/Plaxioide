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
import { localize } from "../../../../nls.js";
import { URI } from "../../../../base/common/uri.js";
import { Disposable, dispose } from "../../../../base/common/lifecycle.js";
import { posix, sep, win32 } from "../../../../base/common/path.js";
import { Emitter } from "../../../../base/common/event.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IWorkspaceContextService, isWorkspace, isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier, toWorkspaceIdentifier, WORKSPACE_EXTENSION, isUntitledWorkspace, isTemporaryWorkspace } from "../../../../platform/workspace/common/workspace.js";
import { basenameOrAuthority, basename, joinPath, dirname } from "../../../../base/common/resources.js";
import { tildify, getPathLabel } from "../../../../base/common/labels.js";
import { ILabelService, Verbosity } from "../../../../platform/label/common/label.js";
import { ExtensionsRegistry } from "../../extensions/common/extensionsRegistry.js";
import { match } from "../../../../base/common/glob.js";
import { ILifecycleService, LifecyclePhase } from "../../lifecycle/common/lifecycle.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IPathService } from "../../path/common/pathService.js";
import { isProposedApiEnabled } from "../../extensions/common/extensions.js";
import { OperatingSystem, OS } from "../../../../base/common/platform.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { Schemas } from "../../../../base/common/network.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Memento } from "../../../common/memento.js";
const resourceLabelFormattersExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "resourceLabelFormatters",
  jsonSchema: {
    description: localize("vscode.extension.contributes.resourceLabelFormatters", "Contributes resource label formatting rules."),
    type: "array",
    items: {
      type: "object",
      required: ["scheme", "formatting"],
      properties: {
        scheme: {
          type: "string",
          description: localize("vscode.extension.contributes.resourceLabelFormatters.scheme", 'URI scheme on which to match the formatter on. For example "file". Simple glob patterns are supported.')
        },
        authority: {
          type: "string",
          description: localize("vscode.extension.contributes.resourceLabelFormatters.authority", "URI authority on which to match the formatter on. Simple glob patterns are supported.")
        },
        formatting: {
          description: localize("vscode.extension.contributes.resourceLabelFormatters.formatting", "Rules for formatting uri resource labels."),
          type: "object",
          properties: {
            label: {
              type: "string",
              description: localize("vscode.extension.contributes.resourceLabelFormatters.label", "Label rules to display. For example: myLabel:/${path}. ${path}, ${scheme}, ${authority} and ${authoritySuffix} are supported as variables.")
            },
            separator: {
              type: "string",
              description: localize("vscode.extension.contributes.resourceLabelFormatters.separator", "Separator to be used in the uri label display. '/' or '' as an example.")
            },
            stripPathStartingSeparator: {
              type: "boolean",
              description: localize("vscode.extension.contributes.resourceLabelFormatters.stripPathStartingSeparator", "Controls whether `${path}` substitutions should have starting separator characters stripped.")
            },
            tildify: {
              type: "boolean",
              description: localize("vscode.extension.contributes.resourceLabelFormatters.tildify", "Controls if the start of the uri label should be tildified when possible.")
            },
            workspaceSuffix: {
              type: "string",
              description: localize("vscode.extension.contributes.resourceLabelFormatters.formatting.workspaceSuffix", "Suffix appended to the workspace label.")
            }
          }
        }
      }
    }
  }
});
const sepRegexp = /\//g;
const labelMatchingRegexp = /\$\{(scheme|authoritySuffix|authority|path|(query)\.(.+?))\}/g;
function hasDriveLetterIgnorePlatform(path) {
  return !!(path && path[2] === ":");
}
let ResourceLabelFormattersHandler = class {
  constructor(labelService) {
    this.formattersDisposables = /* @__PURE__ */ new Map();
    resourceLabelFormattersExtPoint.setHandler((extensions, delta) => {
      for (const added of delta.added) {
        for (const untrustedFormatter of added.value) {
          const formatter = { ...untrustedFormatter };
          if (typeof formatter.formatting.label !== "string") {
            formatter.formatting.label = "${authority}${path}";
          }
          if (typeof formatter.formatting.separator !== `string`) {
            formatter.formatting.separator = sep;
          }
          if (!isProposedApiEnabled(added.description, "contribLabelFormatterWorkspaceTooltip") && formatter.formatting.workspaceTooltip) {
            formatter.formatting.workspaceTooltip = void 0;
          }
          this.formattersDisposables.set(formatter, labelService.registerFormatter(formatter));
        }
      }
      for (const removed of delta.removed) {
        for (const formatter of removed.value) {
          dispose(this.formattersDisposables.get(formatter));
        }
      }
    });
  }
};
ResourceLabelFormattersHandler = __decorateClass([
  __decorateParam(0, ILabelService)
], ResourceLabelFormattersHandler);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ResourceLabelFormattersHandler, LifecyclePhase.Restored);
const FORMATTER_CACHE_SIZE = 50;
let LabelService = class extends Disposable {
  constructor(environmentService, contextService, pathService, remoteAgentService, storageService, lifecycleService) {
    super();
    this.environmentService = environmentService;
    this.contextService = contextService;
    this.pathService = pathService;
    this.remoteAgentService = remoteAgentService;
    this._onDidChangeFormatters = this._register(new Emitter({ leakWarningThreshold: 400 }));
    this.onDidChangeFormatters = this._onDidChangeFormatters.event;
    this.os = OS;
    this.userHome = pathService.defaultUriScheme === Schemas.file ? this.pathService.userHome({ preferLocal: true }) : void 0;
    const memento = this.storedFormattersMemento = new Memento("cachedResourceLabelFormatters2", storageService);
    this.storedFormatters = memento.getMemento(StorageScope.PROFILE, StorageTarget.MACHINE);
    this.formatters = this.storedFormatters?.formatters?.slice() || [];
    this.resolveRemoteEnvironment();
  }
  async resolveRemoteEnvironment() {
    const env = await this.remoteAgentService.getEnvironment();
    this.os = env?.os ?? OS;
    this.userHome = await this.pathService.userHome();
  }
  findFormatting(resource) {
    let bestResult;
    for (const formatter of this.formatters) {
      if (formatter.scheme === resource.scheme) {
        if (!formatter.authority && (!bestResult || formatter.priority)) {
          bestResult = formatter;
          continue;
        }
        if (!formatter.authority) {
          continue;
        }
        if (match(formatter.authority.toLowerCase(), resource.authority.toLowerCase()) && (!bestResult || !bestResult.authority || formatter.authority.length > bestResult.authority.length || formatter.authority.length === bestResult.authority.length && formatter.priority)) {
          bestResult = formatter;
        }
      }
    }
    return bestResult ? bestResult.formatting : void 0;
  }
  getUriLabel(resource, options = {}) {
    let formatting = this.findFormatting(resource);
    if (formatting && options.separator) {
      formatting = { ...formatting, separator: options.separator };
    }
    let label = this.doGetUriLabel(resource, formatting, options);
    if (!formatting && options.separator) {
      label = label.replace(sepRegexp, options.separator);
    }
    if (options.appendWorkspaceSuffix && formatting?.workspaceSuffix) {
      label = this.appendWorkspaceSuffix(label, resource);
    }
    return label;
  }
  doGetUriLabel(resource, formatting, options = {}) {
    if (!formatting) {
      return getPathLabel(resource, {
        os: this.os,
        tildify: this.userHome ? { userHome: this.userHome } : void 0,
        relative: options.relative ? {
          noPrefix: options.noPrefix,
          getWorkspace: () => this.contextService.getWorkspace(),
          getWorkspaceFolder: (resource2) => this.contextService.getWorkspaceFolder(resource2)
        } : void 0
      });
    }
    if (options.relative && this.contextService) {
      let folder = this.contextService.getWorkspaceFolder(resource);
      if (!folder) {
        const workspace = this.contextService.getWorkspace();
        const firstFolder = workspace.folders.at(0);
        if (firstFolder && resource.scheme !== firstFolder.uri.scheme && resource.path.startsWith(posix.sep)) {
          folder = this.contextService.getWorkspaceFolder(firstFolder.uri.with({ path: resource.path }));
        }
      }
      if (folder) {
        const folderLabel = this.formatUri(folder.uri, formatting, options.noPrefix);
        let relativeLabel = this.formatUri(resource, formatting, options.noPrefix);
        let overlap = 0;
        while (relativeLabel[overlap] && relativeLabel[overlap] === folderLabel[overlap]) {
          overlap++;
        }
        if (!relativeLabel[overlap] || relativeLabel[overlap] === formatting.separator) {
          relativeLabel = relativeLabel.substring(1 + overlap);
        } else if (overlap === folderLabel.length && folder.uri.path === posix.sep) {
          relativeLabel = relativeLabel.substring(overlap);
        }
        const hasMultipleRoots = this.contextService.getWorkspace().folders.length > 1;
        if (hasMultipleRoots && !options.noPrefix) {
          const rootName = folder?.name ?? basenameOrAuthority(folder.uri);
          relativeLabel = relativeLabel ? `${rootName} \u2022 ${relativeLabel}` : rootName;
        }
        return relativeLabel;
      }
    }
    return this.formatUri(resource, formatting, options.noPrefix);
  }
  getUriBasenameLabel(resource) {
    const formatting = this.findFormatting(resource);
    const label = this.doGetUriLabel(resource, formatting);
    let pathLib;
    if (formatting?.separator === win32.sep) {
      pathLib = win32;
    } else if (formatting?.separator === posix.sep) {
      pathLib = posix;
    } else {
      pathLib = this.os === OperatingSystem.Windows ? win32 : posix;
    }
    return pathLib.basename(label);
  }
  getWorkspaceLabel(workspace, options) {
    if (isWorkspace(workspace)) {
      const identifier = toWorkspaceIdentifier(workspace);
      if (isSingleFolderWorkspaceIdentifier(identifier) || isWorkspaceIdentifier(identifier)) {
        return this.getWorkspaceLabel(identifier, options);
      }
      return "";
    }
    if (URI.isUri(workspace)) {
      return this.doGetSingleFolderWorkspaceLabel(workspace, options);
    }
    if (isSingleFolderWorkspaceIdentifier(workspace)) {
      return this.doGetSingleFolderWorkspaceLabel(workspace.uri, options);
    }
    if (isWorkspaceIdentifier(workspace)) {
      return this.doGetWorkspaceLabel(workspace.configPath, options);
    }
    return "";
  }
  doGetWorkspaceLabel(workspaceUri, options) {
    if (isUntitledWorkspace(workspaceUri, this.environmentService)) {
      return localize("untitledWorkspace", "Untitled (Workspace)");
    }
    if (isTemporaryWorkspace(workspaceUri)) {
      return localize("temporaryWorkspace", "Workspace");
    }
    let filename = basename(workspaceUri);
    if (filename.endsWith(WORKSPACE_EXTENSION)) {
      filename = filename.substr(0, filename.length - WORKSPACE_EXTENSION.length - 1);
    }
    let label;
    switch (options?.verbose) {
      case Verbosity.SHORT:
        label = filename;
        break;
      case Verbosity.LONG:
        label = localize("workspaceNameVerbose", "{0} (Workspace)", this.getUriLabel(joinPath(dirname(workspaceUri), filename)));
        break;
      case Verbosity.MEDIUM:
      default:
        label = localize("workspaceName", "{0} (Workspace)", filename);
        break;
    }
    if (options?.verbose === Verbosity.SHORT) {
      return label;
    }
    return this.appendWorkspaceSuffix(label, workspaceUri);
  }
  doGetSingleFolderWorkspaceLabel(folderUri, options) {
    let label;
    switch (options?.verbose) {
      case Verbosity.LONG:
        label = this.getUriLabel(folderUri);
        break;
      case Verbosity.SHORT:
      case Verbosity.MEDIUM:
      default:
        label = basename(folderUri) || posix.sep;
        break;
    }
    if (options?.verbose === Verbosity.SHORT) {
      return label;
    }
    return this.appendWorkspaceSuffix(label, folderUri);
  }
  getSeparator(scheme, authority) {
    const formatter = this.findFormatting(URI.from({ scheme, authority }));
    return formatter?.separator || posix.sep;
  }
  getHostLabel(scheme, authority) {
    const formatter = this.findFormatting(URI.from({ scheme, authority }));
    return formatter?.workspaceSuffix || authority || "";
  }
  getHostTooltip(scheme, authority) {
    const formatter = this.findFormatting(URI.from({ scheme, authority }));
    return formatter?.workspaceTooltip;
  }
  registerCachedFormatter(formatter) {
    const list = this.storedFormatters.formatters ??= [];
    let replace = list.findIndex((f) => f.scheme === formatter.scheme && f.authority === formatter.authority);
    if (replace === -1 && list.length >= FORMATTER_CACHE_SIZE) {
      replace = FORMATTER_CACHE_SIZE - 1;
    }
    if (replace === -1) {
      list.unshift(formatter);
    } else {
      for (let i = replace; i > 0; i--) {
        list[i] = list[i - 1];
      }
      list[0] = formatter;
    }
    this.storedFormattersMemento.saveMemento();
    return this.registerFormatter(formatter);
  }
  registerFormatter(formatter) {
    this.formatters.push(formatter);
    this._onDidChangeFormatters.fire({ scheme: formatter.scheme });
    return {
      dispose: () => {
        this.formatters = this.formatters.filter((f) => f !== formatter);
        this._onDidChangeFormatters.fire({ scheme: formatter.scheme });
      }
    };
  }
  formatUri(resource, formatting, forceNoTildify) {
    let label = formatting.label.replace(labelMatchingRegexp, (match2, token, qsToken, qsValue) => {
      switch (token) {
        case "scheme":
          return resource.scheme;
        case "authority":
          return resource.authority;
        case "authoritySuffix": {
          const i = resource.authority.indexOf("+");
          return i === -1 ? resource.authority : resource.authority.slice(i + 1);
        }
        case "path":
          return formatting.stripPathStartingSeparator ? resource.path.slice(resource.path[0] === formatting.separator ? 1 : 0) : resource.path;
        default: {
          if (qsToken === "query") {
            const { query } = resource;
            if (query && query[0] === "{" && query[query.length - 1] === "}") {
              try {
                return JSON.parse(query)[qsValue] || "";
              } catch {
              }
            }
          }
          return "";
        }
      }
    });
    if (formatting.normalizeDriveLetter && hasDriveLetterIgnorePlatform(label)) {
      label = label.charAt(1).toUpperCase() + label.substr(2);
    }
    if (formatting.tildify && !forceNoTildify) {
      if (this.userHome) {
        label = tildify(label, this.userHome.fsPath, this.os);
      }
    }
    if (formatting.authorityPrefix && resource.authority) {
      label = formatting.authorityPrefix + label;
    }
    return label.replace(sepRegexp, formatting.separator);
  }
  appendWorkspaceSuffix(label, uri) {
    const formatting = this.findFormatting(uri);
    const suffix = formatting && typeof formatting.workspaceSuffix === "string" ? formatting.workspaceSuffix : void 0;
    return suffix ? `${label} [${suffix}]` : label;
  }
};
LabelService = __decorateClass([
  __decorateParam(0, IWorkbenchEnvironmentService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IPathService),
  __decorateParam(3, IRemoteAgentService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, ILifecycleService)
], LabelService);
registerSingleton(ILabelService, LabelService, InstantiationType.Delayed);
export {
  LabelService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvbGFiZWwvY29tbW9uL2xhYmVsU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgRGlzcG9zYWJsZSwgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBwb3NpeCwgc2VwLCB3aW4zMiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucywgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeSwgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgSVdvcmtzcGFjZSwgaXNXb3Jrc3BhY2UsIElTaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyLCBpc1NpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIsIGlzV29ya3NwYWNlSWRlbnRpZmllciwgSVdvcmtzcGFjZUlkZW50aWZpZXIsIHRvV29ya3NwYWNlSWRlbnRpZmllciwgV09SS1NQQUNFX0VYVEVOU0lPTiwgaXNVbnRpdGxlZFdvcmtzcGFjZSwgaXNUZW1wb3JhcnlXb3Jrc3BhY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZU9yQXV0aG9yaXR5LCBiYXNlbmFtZSwgam9pblBhdGgsIGRpcm5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgdGlsZGlmeSwgZ2V0UGF0aExhYmVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGFiZWxzLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UsIFJlc291cmNlTGFiZWxGb3JtYXR0ZXIsIFJlc291cmNlTGFiZWxGb3JtYXR0aW5nLCBJRm9ybWF0dGVyQ2hhbmdlRXZlbnQsIFZlcmJvc2l0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zUmVnaXN0cnkgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgbWF0Y2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9nbG9iLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlLCBMaWZlY3ljbGVQaGFzZSB9IGZyb20gJy4uLy4uL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVBhdGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGF0aC9jb21tb24vcGF0aFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNQcm9wb3NlZEFwaUVuYWJsZWQgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IE9wZXJhdGluZ1N5c3RlbSwgT1MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IE1lbWVudG8gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbWVtZW50by5qcyc7XG5cbmNvbnN0IHJlc291cmNlTGFiZWxGb3JtYXR0ZXJzRXh0UG9pbnQgPSBFeHRlbnNpb25zUmVnaXN0cnkucmVnaXN0ZXJFeHRlbnNpb25Qb2ludDxSZXNvdXJjZUxhYmVsRm9ybWF0dGVyW10+KHtcblx0ZXh0ZW5zaW9uUG9pbnQ6ICdyZXNvdXJjZUxhYmVsRm9ybWF0dGVycycsXG5cdGpzb25TY2hlbWE6IHtcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMucmVzb3VyY2VMYWJlbEZvcm1hdHRlcnMnLCAnQ29udHJpYnV0ZXMgcmVzb3VyY2UgbGFiZWwgZm9ybWF0dGluZyBydWxlcy4nKSxcblx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdGl0ZW1zOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdHJlcXVpcmVkOiBbJ3NjaGVtZScsICdmb3JtYXR0aW5nJ10sXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdHNjaGVtZToge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5yZXNvdXJjZUxhYmVsRm9ybWF0dGVycy5zY2hlbWUnLCAnVVJJIHNjaGVtZSBvbiB3aGljaCB0byBtYXRjaCB0aGUgZm9ybWF0dGVyIG9uLiBGb3IgZXhhbXBsZSBcImZpbGVcIi4gU2ltcGxlIGdsb2IgcGF0dGVybnMgYXJlIHN1cHBvcnRlZC4nKSxcblx0XHRcdFx0fSxcblx0XHRcdFx0YXV0aG9yaXR5OiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnJlc291cmNlTGFiZWxGb3JtYXR0ZXJzLmF1dGhvcml0eScsICdVUkkgYXV0aG9yaXR5IG9uIHdoaWNoIHRvIG1hdGNoIHRoZSBmb3JtYXR0ZXIgb24uIFNpbXBsZSBnbG9iIHBhdHRlcm5zIGFyZSBzdXBwb3J0ZWQuJyksXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGZvcm1hdHRpbmc6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMucmVzb3VyY2VMYWJlbEZvcm1hdHRlcnMuZm9ybWF0dGluZycsIFwiUnVsZXMgZm9yIGZvcm1hdHRpbmcgdXJpIHJlc291cmNlIGxhYmVscy5cIiksXG5cdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0bGFiZWw6IHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5yZXNvdXJjZUxhYmVsRm9ybWF0dGVycy5sYWJlbCcsIFwiTGFiZWwgcnVsZXMgdG8gZGlzcGxheS4gRm9yIGV4YW1wbGU6IG15TGFiZWw6LyR7cGF0aH0uICR7cGF0aH0sICR7c2NoZW1lfSwgJHthdXRob3JpdHl9IGFuZCAke2F1dGhvcml0eVN1ZmZpeH0gYXJlIHN1cHBvcnRlZCBhcyB2YXJpYWJsZXMuXCIpXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0c2VwYXJhdG9yOiB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMucmVzb3VyY2VMYWJlbEZvcm1hdHRlcnMuc2VwYXJhdG9yJywgXCJTZXBhcmF0b3IgdG8gYmUgdXNlZCBpbiB0aGUgdXJpIGxhYmVsIGRpc3BsYXkuICcvJyBvciAnXFwnIGFzIGFuIGV4YW1wbGUuXCIpXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0c3RyaXBQYXRoU3RhcnRpbmdTZXBhcmF0b3I6IHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMucmVzb3VyY2VMYWJlbEZvcm1hdHRlcnMuc3RyaXBQYXRoU3RhcnRpbmdTZXBhcmF0b3InLCBcIkNvbnRyb2xzIHdoZXRoZXIgYCR7cGF0aH1gIHN1YnN0aXR1dGlvbnMgc2hvdWxkIGhhdmUgc3RhcnRpbmcgc2VwYXJhdG9yIGNoYXJhY3RlcnMgc3RyaXBwZWQuXCIpXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0dGlsZGlmeToge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5yZXNvdXJjZUxhYmVsRm9ybWF0dGVycy50aWxkaWZ5JywgXCJDb250cm9scyBpZiB0aGUgc3RhcnQgb2YgdGhlIHVyaSBsYWJlbCBzaG91bGQgYmUgdGlsZGlmaWVkIHdoZW4gcG9zc2libGUuXCIpXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0d29ya3NwYWNlU3VmZml4OiB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMucmVzb3VyY2VMYWJlbEZvcm1hdHRlcnMuZm9ybWF0dGluZy53b3Jrc3BhY2VTdWZmaXgnLCBcIlN1ZmZpeCBhcHBlbmRlZCB0byB0aGUgd29ya3NwYWNlIGxhYmVsLlwiKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbmNvbnN0IHNlcFJlZ2V4cCA9IC9cXC8vZztcbmNvbnN0IGxhYmVsTWF0Y2hpbmdSZWdleHAgPSAvXFwkXFx7KHNjaGVtZXxhdXRob3JpdHlTdWZmaXh8YXV0aG9yaXR5fHBhdGh8KHF1ZXJ5KVxcLiguKz8pKVxcfS9nO1xuXG5mdW5jdGlvbiBoYXNEcml2ZUxldHRlcklnbm9yZVBsYXRmb3JtKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gISEocGF0aCAmJiBwYXRoWzJdID09PSAnOicpO1xufVxuXG5jbGFzcyBSZXNvdXJjZUxhYmVsRm9ybWF0dGVyc0hhbmRsZXIgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGZvcm1hdHRlcnNEaXNwb3NhYmxlcyA9IG5ldyBNYXA8UmVzb3VyY2VMYWJlbEZvcm1hdHRlciwgSURpc3Bvc2FibGU+KCk7XG5cblx0Y29uc3RydWN0b3IoQElMYWJlbFNlcnZpY2UgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlKSB7XG5cdFx0cmVzb3VyY2VMYWJlbEZvcm1hdHRlcnNFeHRQb2ludC5zZXRIYW5kbGVyKChleHRlbnNpb25zLCBkZWx0YSkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBhZGRlZCBvZiBkZWx0YS5hZGRlZCkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHVudHJ1c3RlZEZvcm1hdHRlciBvZiBhZGRlZC52YWx1ZSkge1xuXG5cdFx0XHRcdFx0Ly8gV2UgY2Fubm90IHRydXN0IHRoYXQgdGhlIGZvcm1hdHRlciBhcyBpdCBjb21lcyBmcm9tIGFuIGV4dGVuc2lvblxuXHRcdFx0XHRcdC8vIGFkaGVyZXMgdG8gb3VyIGludGVyZmFjZSwgc28gZm9yIHRoZSByZXF1aXJlZCBwcm9wZXJ0aWVzIHdlIGZpbGxcblx0XHRcdFx0XHQvLyBpbiBzb21lIGRlZmF1bHRzIGlmIG1pc3NpbmcuXG5cblx0XHRcdFx0XHRjb25zdCBmb3JtYXR0ZXIgPSB7IC4uLnVudHJ1c3RlZEZvcm1hdHRlciB9O1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgZm9ybWF0dGVyLmZvcm1hdHRpbmcubGFiZWwgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0XHRmb3JtYXR0ZXIuZm9ybWF0dGluZy5sYWJlbCA9ICcke2F1dGhvcml0eX0ke3BhdGh9Jztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBmb3JtYXR0ZXIuZm9ybWF0dGluZy5zZXBhcmF0b3IgIT09IGBzdHJpbmdgKSB7XG5cdFx0XHRcdFx0XHRmb3JtYXR0ZXIuZm9ybWF0dGluZy5zZXBhcmF0b3IgPSBzZXA7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKCFpc1Byb3Bvc2VkQXBpRW5hYmxlZChhZGRlZC5kZXNjcmlwdGlvbiwgJ2NvbnRyaWJMYWJlbEZvcm1hdHRlcldvcmtzcGFjZVRvb2x0aXAnKSAmJiBmb3JtYXR0ZXIuZm9ybWF0dGluZy53b3Jrc3BhY2VUb29sdGlwKSB7XG5cdFx0XHRcdFx0XHRmb3JtYXR0ZXIuZm9ybWF0dGluZy53b3Jrc3BhY2VUb29sdGlwID0gdW5kZWZpbmVkOyAvLyB3b3Jrc3BhY2VUb29sdGlwIGlzIG9ubHkgcHJvcG9zZWRcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLmZvcm1hdHRlcnNEaXNwb3NhYmxlcy5zZXQoZm9ybWF0dGVyLCBsYWJlbFNlcnZpY2UucmVnaXN0ZXJGb3JtYXR0ZXIoZm9ybWF0dGVyKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCByZW1vdmVkIG9mIGRlbHRhLnJlbW92ZWQpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBmb3JtYXR0ZXIgb2YgcmVtb3ZlZC52YWx1ZSkge1xuXHRcdFx0XHRcdGRpc3Bvc2UodGhpcy5mb3JtYXR0ZXJzRGlzcG9zYWJsZXMuZ2V0KGZvcm1hdHRlcikpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuV29ya2JlbmNoKS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihSZXNvdXJjZUxhYmVsRm9ybWF0dGVyc0hhbmRsZXIsIExpZmVjeWNsZVBoYXNlLlJlc3RvcmVkKTtcblxuY29uc3QgRk9STUFUVEVSX0NBQ0hFX1NJWkUgPSA1MDtcblxuaW50ZXJmYWNlIElTdG9yZWRGb3JtYXR0ZXJzIHtcblx0Zm9ybWF0dGVycz86IFJlc291cmNlTGFiZWxGb3JtYXR0ZXJbXTtcblx0aT86IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIExhYmVsU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTGFiZWxTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIGZvcm1hdHRlcnM6IFJlc291cmNlTGFiZWxGb3JtYXR0ZXJbXTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUZvcm1hdHRlcnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJRm9ybWF0dGVyQ2hhbmdlRXZlbnQ+KHsgbGVha1dhcm5pbmdUaHJlc2hvbGQ6IDQwMCB9KSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRm9ybWF0dGVycyA9IHRoaXMuX29uRGlkQ2hhbmdlRm9ybWF0dGVycy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHN0b3JlZEZvcm1hdHRlcnNNZW1lbnRvOiBNZW1lbnRvO1xuXHRwcml2YXRlIHJlYWRvbmx5IHN0b3JlZEZvcm1hdHRlcnM6IElTdG9yZWRGb3JtYXR0ZXJzO1xuXHRwcml2YXRlIG9zOiBPcGVyYXRpbmdTeXN0ZW07XG5cdHByaXZhdGUgdXNlckhvbWU6IFVSSSB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASVBhdGhTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcGF0aFNlcnZpY2U6IElQYXRoU2VydmljZSxcblx0XHRASVJlbW90ZUFnZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHJlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIGxpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Ly8gRmluZCBzb21lIG1lYW5pbmdmdWwgZGVmYXVsdHMgdW50aWwgdGhlIHJlbW90ZSBlbnZpcm9ubWVudFxuXHRcdC8vIGlzIHJlc29sdmVkLCBieSB0YWtpbmcgdGhlIGN1cnJlbnQgT1Mgd2UgYXJlIHJ1bm5pbmcgaW5cblx0XHQvLyBhbmQgYnkgdGFraW5nIHRoZSBsb2NhbCBgdXNlckhvbWVgIGlmIHdlIHJ1biBvbiBhIGxvY2FsXG5cdFx0Ly8gZmlsZSBzY2hlbWUuXG5cdFx0dGhpcy5vcyA9IE9TO1xuXHRcdHRoaXMudXNlckhvbWUgPSBwYXRoU2VydmljZS5kZWZhdWx0VXJpU2NoZW1lID09PSBTY2hlbWFzLmZpbGUgPyB0aGlzLnBhdGhTZXJ2aWNlLnVzZXJIb21lKHsgcHJlZmVyTG9jYWw6IHRydWUgfSkgOiB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBtZW1lbnRvID0gdGhpcy5zdG9yZWRGb3JtYXR0ZXJzTWVtZW50byA9IG5ldyBNZW1lbnRvKCdjYWNoZWRSZXNvdXJjZUxhYmVsRm9ybWF0dGVyczInLCBzdG9yYWdlU2VydmljZSk7XG5cdFx0dGhpcy5zdG9yZWRGb3JtYXR0ZXJzID0gbWVtZW50by5nZXRNZW1lbnRvKFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdHRoaXMuZm9ybWF0dGVycyA9IHRoaXMuc3RvcmVkRm9ybWF0dGVycz8uZm9ybWF0dGVycz8uc2xpY2UoKSB8fCBbXTtcblxuXHRcdC8vIFJlbW90ZSBlbnZpcm9ubWVudCBpcyBwb3RlbnRpYWxseSBsb25nIHJ1bm5pbmdcblx0XHR0aGlzLnJlc29sdmVSZW1vdGVFbnZpcm9ubWVudCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXNvbHZlUmVtb3RlRW52aXJvbm1lbnQoKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBPU1xuXHRcdGNvbnN0IGVudiA9IGF3YWl0IHRoaXMucmVtb3RlQWdlbnRTZXJ2aWNlLmdldEVudmlyb25tZW50KCk7XG5cdFx0dGhpcy5vcyA9IGVudj8ub3MgPz8gT1M7XG5cblx0XHQvLyBVc2VyIGhvbWVcblx0XHR0aGlzLnVzZXJIb21lID0gYXdhaXQgdGhpcy5wYXRoU2VydmljZS51c2VySG9tZSgpO1xuXHR9XG5cblx0ZmluZEZvcm1hdHRpbmcocmVzb3VyY2U6IFVSSSk6IFJlc291cmNlTGFiZWxGb3JtYXR0aW5nIHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgYmVzdFJlc3VsdDogUmVzb3VyY2VMYWJlbEZvcm1hdHRlciB8IHVuZGVmaW5lZDtcblxuXHRcdGZvciAoY29uc3QgZm9ybWF0dGVyIG9mIHRoaXMuZm9ybWF0dGVycykge1xuXHRcdFx0aWYgKGZvcm1hdHRlci5zY2hlbWUgPT09IHJlc291cmNlLnNjaGVtZSkge1xuXHRcdFx0XHRpZiAoIWZvcm1hdHRlci5hdXRob3JpdHkgJiYgKCFiZXN0UmVzdWx0IHx8IGZvcm1hdHRlci5wcmlvcml0eSkpIHtcblx0XHRcdFx0XHRiZXN0UmVzdWx0ID0gZm9ybWF0dGVyO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCFmb3JtYXR0ZXIuYXV0aG9yaXR5KSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0bWF0Y2goZm9ybWF0dGVyLmF1dGhvcml0eS50b0xvd2VyQ2FzZSgpLCByZXNvdXJjZS5hdXRob3JpdHkudG9Mb3dlckNhc2UoKSkgJiZcblx0XHRcdFx0XHQoXG5cdFx0XHRcdFx0XHQhYmVzdFJlc3VsdCB8fFxuXHRcdFx0XHRcdFx0IWJlc3RSZXN1bHQuYXV0aG9yaXR5IHx8XG5cdFx0XHRcdFx0XHRmb3JtYXR0ZXIuYXV0aG9yaXR5Lmxlbmd0aCA+IGJlc3RSZXN1bHQuYXV0aG9yaXR5Lmxlbmd0aCB8fFxuXHRcdFx0XHRcdFx0KChmb3JtYXR0ZXIuYXV0aG9yaXR5Lmxlbmd0aCA9PT0gYmVzdFJlc3VsdC5hdXRob3JpdHkubGVuZ3RoKSAmJiBmb3JtYXR0ZXIucHJpb3JpdHkpXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHRiZXN0UmVzdWx0ID0gZm9ybWF0dGVyO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGJlc3RSZXN1bHQgPyBiZXN0UmVzdWx0LmZvcm1hdHRpbmcgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXRVcmlMYWJlbChyZXNvdXJjZTogVVJJLCBvcHRpb25zOiB7IHJlbGF0aXZlPzogYm9vbGVhbjsgbm9QcmVmaXg/OiBib29sZWFuOyBzZXBhcmF0b3I/OiAnLycgfCAnXFxcXCc7IGFwcGVuZFdvcmtzcGFjZVN1ZmZpeD86IGJvb2xlYW4gfSA9IHt9KTogc3RyaW5nIHtcblx0XHRsZXQgZm9ybWF0dGluZyA9IHRoaXMuZmluZEZvcm1hdHRpbmcocmVzb3VyY2UpO1xuXHRcdGlmIChmb3JtYXR0aW5nICYmIG9wdGlvbnMuc2VwYXJhdG9yKSB7XG5cdFx0XHQvLyBtaXhpbiBzZXBhcmF0b3IgaWYgZGVmaW5lZCBmcm9tIHRoZSBvdXRzaWRlXG5cdFx0XHRmb3JtYXR0aW5nID0geyAuLi5mb3JtYXR0aW5nLCBzZXBhcmF0b3I6IG9wdGlvbnMuc2VwYXJhdG9yIH07XG5cdFx0fVxuXG5cdFx0bGV0IGxhYmVsID0gdGhpcy5kb0dldFVyaUxhYmVsKHJlc291cmNlLCBmb3JtYXR0aW5nLCBvcHRpb25zKTtcblxuXHRcdC8vIFdpdGhvdXQgZm9ybWF0dGluZyB3ZSBzdGlsbCBuZWVkIHRvIHN1cHBvcnQgdGhlIHNlcGFyYXRvclxuXHRcdC8vIGFzIHByb3ZpZGVkIGluIG9wdGlvbnMgKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMzAwMTkpXG5cdFx0aWYgKCFmb3JtYXR0aW5nICYmIG9wdGlvbnMuc2VwYXJhdG9yKSB7XG5cdFx0XHRsYWJlbCA9IGxhYmVsLnJlcGxhY2Uoc2VwUmVnZXhwLCBvcHRpb25zLnNlcGFyYXRvcik7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnMuYXBwZW5kV29ya3NwYWNlU3VmZml4ICYmIGZvcm1hdHRpbmc/LndvcmtzcGFjZVN1ZmZpeCkge1xuXHRcdFx0bGFiZWwgPSB0aGlzLmFwcGVuZFdvcmtzcGFjZVN1ZmZpeChsYWJlbCwgcmVzb3VyY2UpO1xuXHRcdH1cblxuXHRcdHJldHVybiBsYWJlbDtcblx0fVxuXG5cdHByaXZhdGUgZG9HZXRVcmlMYWJlbChyZXNvdXJjZTogVVJJLCBmb3JtYXR0aW5nPzogUmVzb3VyY2VMYWJlbEZvcm1hdHRpbmcsIG9wdGlvbnM6IHsgcmVsYXRpdmU/OiBib29sZWFuOyBub1ByZWZpeD86IGJvb2xlYW4gfSA9IHt9KTogc3RyaW5nIHtcblx0XHRpZiAoIWZvcm1hdHRpbmcpIHtcblx0XHRcdHJldHVybiBnZXRQYXRoTGFiZWwocmVzb3VyY2UsIHtcblx0XHRcdFx0b3M6IHRoaXMub3MsXG5cdFx0XHRcdHRpbGRpZnk6IHRoaXMudXNlckhvbWUgPyB7IHVzZXJIb21lOiB0aGlzLnVzZXJIb21lIH0gOiB1bmRlZmluZWQsXG5cdFx0XHRcdHJlbGF0aXZlOiBvcHRpb25zLnJlbGF0aXZlID8ge1xuXHRcdFx0XHRcdG5vUHJlZml4OiBvcHRpb25zLm5vUHJlZml4LFxuXHRcdFx0XHRcdGdldFdvcmtzcGFjZTogKCkgPT4gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKSxcblx0XHRcdFx0XHRnZXRXb3Jrc3BhY2VGb2xkZXI6IHJlc291cmNlID0+IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlRm9sZGVyKHJlc291cmNlKVxuXHRcdFx0XHR9IDogdW5kZWZpbmVkXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBSZWxhdGl2ZSBsYWJlbFxuXHRcdGlmIChvcHRpb25zLnJlbGF0aXZlICYmIHRoaXMuY29udGV4dFNlcnZpY2UpIHtcblx0XHRcdGxldCBmb2xkZXIgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZUZvbGRlcihyZXNvdXJjZSk7XG5cdFx0XHRpZiAoIWZvbGRlcikge1xuXG5cdFx0XHRcdC8vIEl0IGlzIHBvc3NpYmxlIHRoYXQgdGhlIHJlc291cmNlIHdlIHdhbnQgdG8gcmVzb2x2ZSB0aGVcblx0XHRcdFx0Ly8gd29ya3NwYWNlIGZvbGRlciBmb3IgaXMgbm90IHVzaW5nIHRoZSBzYW1lIHNjaGVtZSBhc1xuXHRcdFx0XHQvLyB0aGUgZm9sZGVycyBpbiB0aGUgd29ya3NwYWNlLCBzbyB3ZSBoZWxwIGJ5IHRyeWluZyBhZ2FpblxuXHRcdFx0XHQvLyB0byByZXNvbHZlIGEgd29ya3NwYWNlIGZvbGRlciBieSB0cnlpbmcgYWdhaW4gd2l0aCBhXG5cdFx0XHRcdC8vIHNjaGVtZSB0aGF0IGlzIHdvcmtzcGFjZSBjb250YWluZWQuXG5cblx0XHRcdFx0Y29uc3Qgd29ya3NwYWNlID0gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKTtcblx0XHRcdFx0Y29uc3QgZmlyc3RGb2xkZXIgPSB3b3Jrc3BhY2UuZm9sZGVycy5hdCgwKTtcblx0XHRcdFx0aWYgKGZpcnN0Rm9sZGVyICYmIHJlc291cmNlLnNjaGVtZSAhPT0gZmlyc3RGb2xkZXIudXJpLnNjaGVtZSAmJiByZXNvdXJjZS5wYXRoLnN0YXJ0c1dpdGgocG9zaXguc2VwKSkge1xuXHRcdFx0XHRcdGZvbGRlciA9IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlRm9sZGVyKGZpcnN0Rm9sZGVyLnVyaS53aXRoKHsgcGF0aDogcmVzb3VyY2UucGF0aCB9KSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGZvbGRlcikge1xuXHRcdFx0XHRjb25zdCBmb2xkZXJMYWJlbCA9IHRoaXMuZm9ybWF0VXJpKGZvbGRlci51cmksIGZvcm1hdHRpbmcsIG9wdGlvbnMubm9QcmVmaXgpO1xuXG5cdFx0XHRcdGxldCByZWxhdGl2ZUxhYmVsID0gdGhpcy5mb3JtYXRVcmkocmVzb3VyY2UsIGZvcm1hdHRpbmcsIG9wdGlvbnMubm9QcmVmaXgpO1xuXHRcdFx0XHRsZXQgb3ZlcmxhcCA9IDA7XG5cdFx0XHRcdHdoaWxlIChyZWxhdGl2ZUxhYmVsW292ZXJsYXBdICYmIHJlbGF0aXZlTGFiZWxbb3ZlcmxhcF0gPT09IGZvbGRlckxhYmVsW292ZXJsYXBdKSB7XG5cdFx0XHRcdFx0b3ZlcmxhcCsrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCFyZWxhdGl2ZUxhYmVsW292ZXJsYXBdIHx8IHJlbGF0aXZlTGFiZWxbb3ZlcmxhcF0gPT09IGZvcm1hdHRpbmcuc2VwYXJhdG9yKSB7XG5cdFx0XHRcdFx0cmVsYXRpdmVMYWJlbCA9IHJlbGF0aXZlTGFiZWwuc3Vic3RyaW5nKDEgKyBvdmVybGFwKTtcblx0XHRcdFx0fSBlbHNlIGlmIChvdmVybGFwID09PSBmb2xkZXJMYWJlbC5sZW5ndGggJiYgZm9sZGVyLnVyaS5wYXRoID09PSBwb3NpeC5zZXApIHtcblx0XHRcdFx0XHRyZWxhdGl2ZUxhYmVsID0gcmVsYXRpdmVMYWJlbC5zdWJzdHJpbmcob3ZlcmxhcCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBhbHdheXMgc2hvdyByb290IGJhc2VuYW1lIGlmIHRoZXJlIGFyZSBtdWx0aXBsZSBmb2xkZXJzXG5cdFx0XHRcdGNvbnN0IGhhc011bHRpcGxlUm9vdHMgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMubGVuZ3RoID4gMTtcblx0XHRcdFx0aWYgKGhhc011bHRpcGxlUm9vdHMgJiYgIW9wdGlvbnMubm9QcmVmaXgpIHtcblx0XHRcdFx0XHRjb25zdCByb290TmFtZSA9IGZvbGRlcj8ubmFtZSA/PyBiYXNlbmFtZU9yQXV0aG9yaXR5KGZvbGRlci51cmkpO1xuXHRcdFx0XHRcdHJlbGF0aXZlTGFiZWwgPSByZWxhdGl2ZUxhYmVsID8gYCR7cm9vdE5hbWV9IFx1MjAyMiAke3JlbGF0aXZlTGFiZWx9YCA6IHJvb3ROYW1lO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHJlbGF0aXZlTGFiZWw7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQWJzb2x1dGUgbGFiZWxcblx0XHRyZXR1cm4gdGhpcy5mb3JtYXRVcmkocmVzb3VyY2UsIGZvcm1hdHRpbmcsIG9wdGlvbnMubm9QcmVmaXgpO1xuXHR9XG5cblx0Z2V0VXJpQmFzZW5hbWVMYWJlbChyZXNvdXJjZTogVVJJKTogc3RyaW5nIHtcblx0XHRjb25zdCBmb3JtYXR0aW5nID0gdGhpcy5maW5kRm9ybWF0dGluZyhyZXNvdXJjZSk7XG5cdFx0Y29uc3QgbGFiZWwgPSB0aGlzLmRvR2V0VXJpTGFiZWwocmVzb3VyY2UsIGZvcm1hdHRpbmcpO1xuXG5cdFx0bGV0IHBhdGhMaWI6IHR5cGVvZiB3aW4zMiB8IHR5cGVvZiBwb3NpeDtcblx0XHRpZiAoZm9ybWF0dGluZz8uc2VwYXJhdG9yID09PSB3aW4zMi5zZXApIHtcblx0XHRcdHBhdGhMaWIgPSB3aW4zMjtcblx0XHR9IGVsc2UgaWYgKGZvcm1hdHRpbmc/LnNlcGFyYXRvciA9PT0gcG9zaXguc2VwKSB7XG5cdFx0XHRwYXRoTGliID0gcG9zaXg7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHBhdGhMaWIgPSAodGhpcy5vcyA9PT0gT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MpID8gd2luMzIgOiBwb3NpeDtcblx0XHR9XG5cblx0XHRyZXR1cm4gcGF0aExpYi5iYXNlbmFtZShsYWJlbCk7XG5cdH1cblxuXHRnZXRXb3Jrc3BhY2VMYWJlbCh3b3Jrc3BhY2U6IElXb3Jrc3BhY2UgfCBJV29ya3NwYWNlSWRlbnRpZmllciB8IElTaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyIHwgVVJJLCBvcHRpb25zPzogeyB2ZXJib3NlOiBWZXJib3NpdHkgfSk6IHN0cmluZyB7XG5cdFx0aWYgKGlzV29ya3NwYWNlKHdvcmtzcGFjZSkpIHtcblx0XHRcdGNvbnN0IGlkZW50aWZpZXIgPSB0b1dvcmtzcGFjZUlkZW50aWZpZXIod29ya3NwYWNlKTtcblx0XHRcdGlmIChpc1NpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIoaWRlbnRpZmllcikgfHwgaXNXb3Jrc3BhY2VJZGVudGlmaWVyKGlkZW50aWZpZXIpKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmdldFdvcmtzcGFjZUxhYmVsKGlkZW50aWZpZXIsIG9wdGlvbnMpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXG5cdFx0Ly8gV29ya3NwYWNlOiBTaW5nbGUgRm9sZGVyIChhcyBVUkkpXG5cdFx0aWYgKFVSSS5pc1VyaSh3b3Jrc3BhY2UpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kb0dldFNpbmdsZUZvbGRlcldvcmtzcGFjZUxhYmVsKHdvcmtzcGFjZSwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0Ly8gV29ya3NwYWNlOiBTaW5nbGUgRm9sZGVyIChhcyB3b3Jrc3BhY2UgaWRlbnRpZmllcilcblx0XHRpZiAoaXNTaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyKHdvcmtzcGFjZSkpIHtcblx0XHRcdHJldHVybiB0aGlzLmRvR2V0U2luZ2xlRm9sZGVyV29ya3NwYWNlTGFiZWwod29ya3NwYWNlLnVyaSwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0Ly8gV29ya3NwYWNlOiBNdWx0aSBSb290XG5cdFx0aWYgKGlzV29ya3NwYWNlSWRlbnRpZmllcih3b3Jrc3BhY2UpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kb0dldFdvcmtzcGFjZUxhYmVsKHdvcmtzcGFjZS5jb25maWdQYXRoLCBvcHRpb25zKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gJyc7XG5cdH1cblxuXHRwcml2YXRlIGRvR2V0V29ya3NwYWNlTGFiZWwod29ya3NwYWNlVXJpOiBVUkksIG9wdGlvbnM/OiB7IHZlcmJvc2U6IFZlcmJvc2l0eSB9KTogc3RyaW5nIHtcblxuXHRcdC8vIFdvcmtzcGFjZTogVW50aXRsZWRcblx0XHRpZiAoaXNVbnRpdGxlZFdvcmtzcGFjZSh3b3Jrc3BhY2VVcmksIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlKSkge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCd1bnRpdGxlZFdvcmtzcGFjZScsIFwiVW50aXRsZWQgKFdvcmtzcGFjZSlcIik7XG5cdFx0fVxuXG5cdFx0Ly8gV29ya3NwYWNlOiBUZW1wb3Jhcnlcblx0XHRpZiAoaXNUZW1wb3JhcnlXb3Jrc3BhY2Uod29ya3NwYWNlVXJpKSkge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCd0ZW1wb3JhcnlXb3Jrc3BhY2UnLCBcIldvcmtzcGFjZVwiKTtcblx0XHR9XG5cblx0XHQvLyBXb3Jrc3BhY2U6IFNhdmVkXG5cdFx0bGV0IGZpbGVuYW1lID0gYmFzZW5hbWUod29ya3NwYWNlVXJpKTtcblx0XHRpZiAoZmlsZW5hbWUuZW5kc1dpdGgoV09SS1NQQUNFX0VYVEVOU0lPTikpIHtcblx0XHRcdGZpbGVuYW1lID0gZmlsZW5hbWUuc3Vic3RyKDAsIGZpbGVuYW1lLmxlbmd0aCAtIFdPUktTUEFDRV9FWFRFTlNJT04ubGVuZ3RoIC0gMSk7XG5cdFx0fVxuXG5cdFx0bGV0IGxhYmVsOiBzdHJpbmc7XG5cdFx0c3dpdGNoIChvcHRpb25zPy52ZXJib3NlKSB7XG5cdFx0XHRjYXNlIFZlcmJvc2l0eS5TSE9SVDpcblx0XHRcdFx0bGFiZWwgPSBmaWxlbmFtZTsgLy8gc2tpcCBzdWZmaXggZm9yIHNob3J0IGxhYmVsXG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBWZXJib3NpdHkuTE9ORzpcblx0XHRcdFx0bGFiZWwgPSBsb2NhbGl6ZSgnd29ya3NwYWNlTmFtZVZlcmJvc2UnLCBcInswfSAoV29ya3NwYWNlKVwiLCB0aGlzLmdldFVyaUxhYmVsKGpvaW5QYXRoKGRpcm5hbWUod29ya3NwYWNlVXJpKSwgZmlsZW5hbWUpKSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBWZXJib3NpdHkuTUVESVVNOlxuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0bGFiZWwgPSBsb2NhbGl6ZSgnd29ya3NwYWNlTmFtZScsIFwiezB9IChXb3Jrc3BhY2UpXCIsIGZpbGVuYW1lKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnM/LnZlcmJvc2UgPT09IFZlcmJvc2l0eS5TSE9SVCkge1xuXHRcdFx0cmV0dXJuIGxhYmVsOyAvLyBza2lwIHN1ZmZpeCBmb3Igc2hvcnQgbGFiZWxcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5hcHBlbmRXb3Jrc3BhY2VTdWZmaXgobGFiZWwsIHdvcmtzcGFjZVVyaSk7XG5cdH1cblxuXHRwcml2YXRlIGRvR2V0U2luZ2xlRm9sZGVyV29ya3NwYWNlTGFiZWwoZm9sZGVyVXJpOiBVUkksIG9wdGlvbnM/OiB7IHZlcmJvc2U6IFZlcmJvc2l0eSB9KTogc3RyaW5nIHtcblx0XHRsZXQgbGFiZWw6IHN0cmluZztcblx0XHRzd2l0Y2ggKG9wdGlvbnM/LnZlcmJvc2UpIHtcblx0XHRcdGNhc2UgVmVyYm9zaXR5LkxPTkc6XG5cdFx0XHRcdGxhYmVsID0gdGhpcy5nZXRVcmlMYWJlbChmb2xkZXJVcmkpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgVmVyYm9zaXR5LlNIT1JUOlxuXHRcdFx0Y2FzZSBWZXJib3NpdHkuTUVESVVNOlxuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0bGFiZWwgPSBiYXNlbmFtZShmb2xkZXJVcmkpIHx8IHBvc2l4LnNlcDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnM/LnZlcmJvc2UgPT09IFZlcmJvc2l0eS5TSE9SVCkge1xuXHRcdFx0cmV0dXJuIGxhYmVsOyAvLyBza2lwIHN1ZmZpeCBmb3Igc2hvcnQgbGFiZWxcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5hcHBlbmRXb3Jrc3BhY2VTdWZmaXgobGFiZWwsIGZvbGRlclVyaSk7XG5cdH1cblxuXHRnZXRTZXBhcmF0b3Ioc2NoZW1lOiBzdHJpbmcsIGF1dGhvcml0eT86IHN0cmluZyk6ICcvJyB8ICdcXFxcJyB7XG5cdFx0Y29uc3QgZm9ybWF0dGVyID0gdGhpcy5maW5kRm9ybWF0dGluZyhVUkkuZnJvbSh7IHNjaGVtZSwgYXV0aG9yaXR5IH0pKTtcblxuXHRcdHJldHVybiBmb3JtYXR0ZXI/LnNlcGFyYXRvciB8fCBwb3NpeC5zZXA7XG5cdH1cblxuXHRnZXRIb3N0TGFiZWwoc2NoZW1lOiBzdHJpbmcsIGF1dGhvcml0eT86IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgZm9ybWF0dGVyID0gdGhpcy5maW5kRm9ybWF0dGluZyhVUkkuZnJvbSh7IHNjaGVtZSwgYXV0aG9yaXR5IH0pKTtcblxuXHRcdHJldHVybiBmb3JtYXR0ZXI/LndvcmtzcGFjZVN1ZmZpeCB8fCBhdXRob3JpdHkgfHwgJyc7XG5cdH1cblxuXHRnZXRIb3N0VG9vbHRpcChzY2hlbWU6IHN0cmluZywgYXV0aG9yaXR5Pzogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBmb3JtYXR0ZXIgPSB0aGlzLmZpbmRGb3JtYXR0aW5nKFVSSS5mcm9tKHsgc2NoZW1lLCBhdXRob3JpdHkgfSkpO1xuXG5cdFx0cmV0dXJuIGZvcm1hdHRlcj8ud29ya3NwYWNlVG9vbHRpcDtcblx0fVxuXG5cdHJlZ2lzdGVyQ2FjaGVkRm9ybWF0dGVyKGZvcm1hdHRlcjogUmVzb3VyY2VMYWJlbEZvcm1hdHRlcik6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBsaXN0ID0gdGhpcy5zdG9yZWRGb3JtYXR0ZXJzLmZvcm1hdHRlcnMgPz89IFtdO1xuXG5cdFx0bGV0IHJlcGxhY2UgPSBsaXN0LmZpbmRJbmRleChmID0+IGYuc2NoZW1lID09PSBmb3JtYXR0ZXIuc2NoZW1lICYmIGYuYXV0aG9yaXR5ID09PSBmb3JtYXR0ZXIuYXV0aG9yaXR5KTtcblx0XHRpZiAocmVwbGFjZSA9PT0gLTEgJiYgbGlzdC5sZW5ndGggPj0gRk9STUFUVEVSX0NBQ0hFX1NJWkUpIHtcblx0XHRcdHJlcGxhY2UgPSBGT1JNQVRURVJfQ0FDSEVfU0laRSAtIDE7IC8vIGF0IG1heCBjYXBhY2l0eSwgcmVwbGFjZSB0aGUgbGFzdCBlbGVtZW50XG5cdFx0fVxuXG5cdFx0aWYgKHJlcGxhY2UgPT09IC0xKSB7XG5cdFx0XHRsaXN0LnVuc2hpZnQoZm9ybWF0dGVyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9yIChsZXQgaSA9IHJlcGxhY2U7IGkgPiAwOyBpLS0pIHtcblx0XHRcdFx0bGlzdFtpXSA9IGxpc3RbaSAtIDFdO1xuXHRcdFx0fVxuXHRcdFx0bGlzdFswXSA9IGZvcm1hdHRlcjtcblx0XHR9XG5cblx0XHR0aGlzLnN0b3JlZEZvcm1hdHRlcnNNZW1lbnRvLnNhdmVNZW1lbnRvKCk7XG5cblx0XHRyZXR1cm4gdGhpcy5yZWdpc3RlckZvcm1hdHRlcihmb3JtYXR0ZXIpO1xuXHR9XG5cblx0cmVnaXN0ZXJGb3JtYXR0ZXIoZm9ybWF0dGVyOiBSZXNvdXJjZUxhYmVsRm9ybWF0dGVyKTogSURpc3Bvc2FibGUge1xuXHRcdHRoaXMuZm9ybWF0dGVycy5wdXNoKGZvcm1hdHRlcik7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VGb3JtYXR0ZXJzLmZpcmUoeyBzY2hlbWU6IGZvcm1hdHRlci5zY2hlbWUgfSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmZvcm1hdHRlcnMgPSB0aGlzLmZvcm1hdHRlcnMuZmlsdGVyKGYgPT4gZiAhPT0gZm9ybWF0dGVyKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VGb3JtYXR0ZXJzLmZpcmUoeyBzY2hlbWU6IGZvcm1hdHRlci5zY2hlbWUgfSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgZm9ybWF0VXJpKHJlc291cmNlOiBVUkksIGZvcm1hdHRpbmc6IFJlc291cmNlTGFiZWxGb3JtYXR0aW5nLCBmb3JjZU5vVGlsZGlmeT86IGJvb2xlYW4pOiBzdHJpbmcge1xuXHRcdGxldCBsYWJlbCA9IGZvcm1hdHRpbmcubGFiZWwucmVwbGFjZShsYWJlbE1hdGNoaW5nUmVnZXhwLCAobWF0Y2gsIHRva2VuLCBxc1Rva2VuLCBxc1ZhbHVlKSA9PiB7XG5cdFx0XHRzd2l0Y2ggKHRva2VuKSB7XG5cdFx0XHRcdGNhc2UgJ3NjaGVtZSc6IHJldHVybiByZXNvdXJjZS5zY2hlbWU7XG5cdFx0XHRcdGNhc2UgJ2F1dGhvcml0eSc6IHJldHVybiByZXNvdXJjZS5hdXRob3JpdHk7XG5cdFx0XHRcdGNhc2UgJ2F1dGhvcml0eVN1ZmZpeCc6IHtcblx0XHRcdFx0XHRjb25zdCBpID0gcmVzb3VyY2UuYXV0aG9yaXR5LmluZGV4T2YoJysnKTtcblx0XHRcdFx0XHRyZXR1cm4gaSA9PT0gLTEgPyByZXNvdXJjZS5hdXRob3JpdHkgOiByZXNvdXJjZS5hdXRob3JpdHkuc2xpY2UoaSArIDEpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ3BhdGgnOlxuXHRcdFx0XHRcdHJldHVybiBmb3JtYXR0aW5nLnN0cmlwUGF0aFN0YXJ0aW5nU2VwYXJhdG9yXG5cdFx0XHRcdFx0XHQ/IHJlc291cmNlLnBhdGguc2xpY2UocmVzb3VyY2UucGF0aFswXSA9PT0gZm9ybWF0dGluZy5zZXBhcmF0b3IgPyAxIDogMClcblx0XHRcdFx0XHRcdDogcmVzb3VyY2UucGF0aDtcblx0XHRcdFx0ZGVmYXVsdDoge1xuXHRcdFx0XHRcdGlmIChxc1Rva2VuID09PSAncXVlcnknKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB7IHF1ZXJ5IH0gPSByZXNvdXJjZTtcblx0XHRcdFx0XHRcdGlmIChxdWVyeSAmJiBxdWVyeVswXSA9PT0gJ3snICYmIHF1ZXJ5W3F1ZXJ5Lmxlbmd0aCAtIDFdID09PSAnfScpIHtcblx0XHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gSlNPTi5wYXJzZShxdWVyeSlbcXNWYWx1ZV0gfHwgJyc7XG5cdFx0XHRcdFx0XHRcdH0gY2F0Y2ggeyB9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHQvLyBjb252ZXJ0IFxcYzpcXHNvbWV0aGluZyA9PiBDOlxcc29tZXRoaW5nXG5cdFx0aWYgKGZvcm1hdHRpbmcubm9ybWFsaXplRHJpdmVMZXR0ZXIgJiYgaGFzRHJpdmVMZXR0ZXJJZ25vcmVQbGF0Zm9ybShsYWJlbCkpIHtcblx0XHRcdGxhYmVsID0gbGFiZWwuY2hhckF0KDEpLnRvVXBwZXJDYXNlKCkgKyBsYWJlbC5zdWJzdHIoMik7XG5cdFx0fVxuXG5cdFx0aWYgKGZvcm1hdHRpbmcudGlsZGlmeSAmJiAhZm9yY2VOb1RpbGRpZnkpIHtcblx0XHRcdGlmICh0aGlzLnVzZXJIb21lKSB7XG5cdFx0XHRcdGxhYmVsID0gdGlsZGlmeShsYWJlbCwgdGhpcy51c2VySG9tZS5mc1BhdGgsIHRoaXMub3MpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChmb3JtYXR0aW5nLmF1dGhvcml0eVByZWZpeCAmJiByZXNvdXJjZS5hdXRob3JpdHkpIHtcblx0XHRcdGxhYmVsID0gZm9ybWF0dGluZy5hdXRob3JpdHlQcmVmaXggKyBsYWJlbDtcblx0XHR9XG5cblx0XHRyZXR1cm4gbGFiZWwucmVwbGFjZShzZXBSZWdleHAsIGZvcm1hdHRpbmcuc2VwYXJhdG9yKTtcblx0fVxuXG5cdHByaXZhdGUgYXBwZW5kV29ya3NwYWNlU3VmZml4KGxhYmVsOiBzdHJpbmcsIHVyaTogVVJJKTogc3RyaW5nIHtcblx0XHRjb25zdCBmb3JtYXR0aW5nID0gdGhpcy5maW5kRm9ybWF0dGluZyh1cmkpO1xuXHRcdGNvbnN0IHN1ZmZpeCA9IGZvcm1hdHRpbmcgJiYgKHR5cGVvZiBmb3JtYXR0aW5nLndvcmtzcGFjZVN1ZmZpeCA9PT0gJ3N0cmluZycpID8gZm9ybWF0dGluZy53b3Jrc3BhY2VTdWZmaXggOiB1bmRlZmluZWQ7XG5cblx0XHRyZXR1cm4gc3VmZml4ID8gYCR7bGFiZWx9IFske3N1ZmZpeH1dYCA6IGxhYmVsO1xuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElMYWJlbFNlcnZpY2UsIExhYmVsU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsV0FBVztBQUNwQixTQUFzQixZQUFZLGVBQWU7QUFDakQsU0FBUyxPQUFPLEtBQUssYUFBYTtBQUNsQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxjQUFjLDJCQUFvRjtBQUMzRyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLG9DQUFvQztBQUM3QyxTQUFTLDBCQUFzQyxhQUErQyxtQ0FBbUMsdUJBQTZDLHVCQUF1QixxQkFBcUIscUJBQXFCLDRCQUE0QjtBQUMzUSxTQUFTLHFCQUFxQixVQUFVLFVBQVUsZUFBZTtBQUNqRSxTQUFTLFNBQVMsb0JBQW9CO0FBQ3RDLFNBQVMsZUFBdUYsaUJBQWlCO0FBQ2pILFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsYUFBYTtBQUN0QixTQUFTLG1CQUFtQixzQkFBc0I7QUFDbEQsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsaUJBQWlCLFVBQVU7QUFDcEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMsZUFBZTtBQUV4QixNQUFNLGtDQUFrQyxtQkFBbUIsdUJBQWlEO0FBQUEsRUFDM0csZ0JBQWdCO0FBQUEsRUFDaEIsWUFBWTtBQUFBLElBQ1gsYUFBYSxTQUFTLHdEQUF3RCw4Q0FBOEM7QUFBQSxJQUM1SCxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixVQUFVLENBQUMsVUFBVSxZQUFZO0FBQUEsTUFDakMsWUFBWTtBQUFBLFFBQ1gsUUFBUTtBQUFBLFVBQ1AsTUFBTTtBQUFBLFVBQ04sYUFBYSxTQUFTLCtEQUErRCx3R0FBd0c7QUFBQSxRQUM5TDtBQUFBLFFBQ0EsV0FBVztBQUFBLFVBQ1YsTUFBTTtBQUFBLFVBQ04sYUFBYSxTQUFTLGtFQUFrRSx1RkFBdUY7QUFBQSxRQUNoTDtBQUFBLFFBQ0EsWUFBWTtBQUFBLFVBQ1gsYUFBYSxTQUFTLG1FQUFtRSwyQ0FBMkM7QUFBQSxVQUNwSSxNQUFNO0FBQUEsVUFDTixZQUFZO0FBQUEsWUFDWCxPQUFPO0FBQUEsY0FDTixNQUFNO0FBQUEsY0FDTixhQUFhLFNBQVMsOERBQThELDRJQUE0STtBQUFBLFlBQ2pPO0FBQUEsWUFDQSxXQUFXO0FBQUEsY0FDVixNQUFNO0FBQUEsY0FDTixhQUFhLFNBQVMsa0VBQWtFLHlFQUEwRTtBQUFBLFlBQ25LO0FBQUEsWUFDQSw0QkFBNEI7QUFBQSxjQUMzQixNQUFNO0FBQUEsY0FDTixhQUFhLFNBQVMsbUZBQW1GLDhGQUE4RjtBQUFBLFlBQ3hNO0FBQUEsWUFDQSxTQUFTO0FBQUEsY0FDUixNQUFNO0FBQUEsY0FDTixhQUFhLFNBQVMsZ0VBQWdFLDJFQUEyRTtBQUFBLFlBQ2xLO0FBQUEsWUFDQSxpQkFBaUI7QUFBQSxjQUNoQixNQUFNO0FBQUEsY0FDTixhQUFhLFNBQVMsbUZBQW1GLHlDQUF5QztBQUFBLFlBQ25KO0FBQUEsVUFDRDtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRCxDQUFDO0FBRUQsTUFBTSxZQUFZO0FBQ2xCLE1BQU0sc0JBQXNCO0FBRTVCLFNBQVMsNkJBQTZCLE1BQXVCO0FBQzVELFNBQU8sQ0FBQyxFQUFFLFFBQVEsS0FBSyxDQUFDLE1BQU07QUFDL0I7QUFFQSxJQUFNLGlDQUFOLE1BQXVFO0FBQUEsRUFJdEUsWUFBMkIsY0FBNkI7QUFGeEQsU0FBaUIsd0JBQXdCLG9CQUFJLElBQXlDO0FBR3JGLG9DQUFnQyxXQUFXLENBQUMsWUFBWSxVQUFVO0FBQ2pFLGlCQUFXLFNBQVMsTUFBTSxPQUFPO0FBQ2hDLG1CQUFXLHNCQUFzQixNQUFNLE9BQU87QUFNN0MsZ0JBQU0sWUFBWSxFQUFFLEdBQUcsbUJBQW1CO0FBQzFDLGNBQUksT0FBTyxVQUFVLFdBQVcsVUFBVSxVQUFVO0FBQ25ELHNCQUFVLFdBQVcsUUFBUTtBQUFBLFVBQzlCO0FBQ0EsY0FBSSxPQUFPLFVBQVUsV0FBVyxjQUFjLFVBQVU7QUFDdkQsc0JBQVUsV0FBVyxZQUFZO0FBQUEsVUFDbEM7QUFFQSxjQUFJLENBQUMscUJBQXFCLE1BQU0sYUFBYSx1Q0FBdUMsS0FBSyxVQUFVLFdBQVcsa0JBQWtCO0FBQy9ILHNCQUFVLFdBQVcsbUJBQW1CO0FBQUEsVUFDekM7QUFFQSxlQUFLLHNCQUFzQixJQUFJLFdBQVcsYUFBYSxrQkFBa0IsU0FBUyxDQUFDO0FBQUEsUUFDcEY7QUFBQSxNQUNEO0FBRUEsaUJBQVcsV0FBVyxNQUFNLFNBQVM7QUFDcEMsbUJBQVcsYUFBYSxRQUFRLE9BQU87QUFDdEMsa0JBQVEsS0FBSyxzQkFBc0IsSUFBSSxTQUFTLENBQUM7QUFBQSxRQUNsRDtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQ0Q7QUFwQ00saUNBQU47QUFBQSxFQUljO0FBQUEsR0FKUjtBQXFDTixTQUFTLEdBQW9DLG9CQUFvQixTQUFTLEVBQUUsOEJBQThCLGdDQUFnQyxlQUFlLFFBQVE7QUFFakssTUFBTSx1QkFBdUI7QUFPdEIsSUFBTSxlQUFOLGNBQTJCLFdBQW9DO0FBQUEsRUFjckUsWUFDZ0Qsb0JBQ0osZ0JBQ1osYUFDTyxvQkFDckIsZ0JBQ0Usa0JBQ2xCO0FBQ0QsVUFBTTtBQVB5QztBQUNKO0FBQ1o7QUFDTztBQVp2QyxTQUFpQix5QkFBeUIsS0FBSyxVQUFVLElBQUksUUFBK0IsRUFBRSxzQkFBc0IsSUFBSSxDQUFDLENBQUM7QUFDMUgsU0FBUyx3QkFBd0IsS0FBSyx1QkFBdUI7QUFxQjVELFNBQUssS0FBSztBQUNWLFNBQUssV0FBVyxZQUFZLHFCQUFxQixRQUFRLE9BQU8sS0FBSyxZQUFZLFNBQVMsRUFBRSxhQUFhLEtBQUssQ0FBQyxJQUFJO0FBRW5ILFVBQU0sVUFBVSxLQUFLLDBCQUEwQixJQUFJLFFBQVEsa0NBQWtDLGNBQWM7QUFDM0csU0FBSyxtQkFBbUIsUUFBUSxXQUFXLGFBQWEsU0FBUyxjQUFjLE9BQU87QUFDdEYsU0FBSyxhQUFhLEtBQUssa0JBQWtCLFlBQVksTUFBTSxLQUFLLENBQUM7QUFHakUsU0FBSyx5QkFBeUI7QUFBQSxFQUMvQjtBQUFBLEVBRUEsTUFBYywyQkFBMEM7QUFHdkQsVUFBTSxNQUFNLE1BQU0sS0FBSyxtQkFBbUIsZUFBZTtBQUN6RCxTQUFLLEtBQUssS0FBSyxNQUFNO0FBR3JCLFNBQUssV0FBVyxNQUFNLEtBQUssWUFBWSxTQUFTO0FBQUEsRUFDakQ7QUFBQSxFQUVBLGVBQWUsVUFBb0Q7QUFDbEUsUUFBSTtBQUVKLGVBQVcsYUFBYSxLQUFLLFlBQVk7QUFDeEMsVUFBSSxVQUFVLFdBQVcsU0FBUyxRQUFRO0FBQ3pDLFlBQUksQ0FBQyxVQUFVLGNBQWMsQ0FBQyxjQUFjLFVBQVUsV0FBVztBQUNoRSx1QkFBYTtBQUNiO0FBQUEsUUFDRDtBQUVBLFlBQUksQ0FBQyxVQUFVLFdBQVc7QUFDekI7QUFBQSxRQUNEO0FBRUEsWUFDQyxNQUFNLFVBQVUsVUFBVSxZQUFZLEdBQUcsU0FBUyxVQUFVLFlBQVksQ0FBQyxNQUV4RSxDQUFDLGNBQ0QsQ0FBQyxXQUFXLGFBQ1osVUFBVSxVQUFVLFNBQVMsV0FBVyxVQUFVLFVBQ2hELFVBQVUsVUFBVSxXQUFXLFdBQVcsVUFBVSxVQUFXLFVBQVUsV0FFM0U7QUFDRCx1QkFBYTtBQUFBLFFBQ2Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFdBQU8sYUFBYSxXQUFXLGFBQWE7QUFBQSxFQUM3QztBQUFBLEVBRUEsWUFBWSxVQUFlLFVBQStHLENBQUMsR0FBVztBQUNySixRQUFJLGFBQWEsS0FBSyxlQUFlLFFBQVE7QUFDN0MsUUFBSSxjQUFjLFFBQVEsV0FBVztBQUVwQyxtQkFBYSxFQUFFLEdBQUcsWUFBWSxXQUFXLFFBQVEsVUFBVTtBQUFBLElBQzVEO0FBRUEsUUFBSSxRQUFRLEtBQUssY0FBYyxVQUFVLFlBQVksT0FBTztBQUk1RCxRQUFJLENBQUMsY0FBYyxRQUFRLFdBQVc7QUFDckMsY0FBUSxNQUFNLFFBQVEsV0FBVyxRQUFRLFNBQVM7QUFBQSxJQUNuRDtBQUVBLFFBQUksUUFBUSx5QkFBeUIsWUFBWSxpQkFBaUI7QUFDakUsY0FBUSxLQUFLLHNCQUFzQixPQUFPLFFBQVE7QUFBQSxJQUNuRDtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxjQUFjLFVBQWUsWUFBc0MsVUFBc0QsQ0FBQyxHQUFXO0FBQzVJLFFBQUksQ0FBQyxZQUFZO0FBQ2hCLGFBQU8sYUFBYSxVQUFVO0FBQUEsUUFDN0IsSUFBSSxLQUFLO0FBQUEsUUFDVCxTQUFTLEtBQUssV0FBVyxFQUFFLFVBQVUsS0FBSyxTQUFTLElBQUk7QUFBQSxRQUN2RCxVQUFVLFFBQVEsV0FBVztBQUFBLFVBQzVCLFVBQVUsUUFBUTtBQUFBLFVBQ2xCLGNBQWMsTUFBTSxLQUFLLGVBQWUsYUFBYTtBQUFBLFVBQ3JELG9CQUFvQixDQUFBQSxjQUFZLEtBQUssZUFBZSxtQkFBbUJBLFNBQVE7QUFBQSxRQUNoRixJQUFJO0FBQUEsTUFDTCxDQUFDO0FBQUEsSUFDRjtBQUdBLFFBQUksUUFBUSxZQUFZLEtBQUssZ0JBQWdCO0FBQzVDLFVBQUksU0FBUyxLQUFLLGVBQWUsbUJBQW1CLFFBQVE7QUFDNUQsVUFBSSxDQUFDLFFBQVE7QUFRWixjQUFNLFlBQVksS0FBSyxlQUFlLGFBQWE7QUFDbkQsY0FBTSxjQUFjLFVBQVUsUUFBUSxHQUFHLENBQUM7QUFDMUMsWUFBSSxlQUFlLFNBQVMsV0FBVyxZQUFZLElBQUksVUFBVSxTQUFTLEtBQUssV0FBVyxNQUFNLEdBQUcsR0FBRztBQUNyRyxtQkFBUyxLQUFLLGVBQWUsbUJBQW1CLFlBQVksSUFBSSxLQUFLLEVBQUUsTUFBTSxTQUFTLEtBQUssQ0FBQyxDQUFDO0FBQUEsUUFDOUY7QUFBQSxNQUNEO0FBRUEsVUFBSSxRQUFRO0FBQ1gsY0FBTSxjQUFjLEtBQUssVUFBVSxPQUFPLEtBQUssWUFBWSxRQUFRLFFBQVE7QUFFM0UsWUFBSSxnQkFBZ0IsS0FBSyxVQUFVLFVBQVUsWUFBWSxRQUFRLFFBQVE7QUFDekUsWUFBSSxVQUFVO0FBQ2QsZUFBTyxjQUFjLE9BQU8sS0FBSyxjQUFjLE9BQU8sTUFBTSxZQUFZLE9BQU8sR0FBRztBQUNqRjtBQUFBLFFBQ0Q7QUFFQSxZQUFJLENBQUMsY0FBYyxPQUFPLEtBQUssY0FBYyxPQUFPLE1BQU0sV0FBVyxXQUFXO0FBQy9FLDBCQUFnQixjQUFjLFVBQVUsSUFBSSxPQUFPO0FBQUEsUUFDcEQsV0FBVyxZQUFZLFlBQVksVUFBVSxPQUFPLElBQUksU0FBUyxNQUFNLEtBQUs7QUFDM0UsMEJBQWdCLGNBQWMsVUFBVSxPQUFPO0FBQUEsUUFDaEQ7QUFHQSxjQUFNLG1CQUFtQixLQUFLLGVBQWUsYUFBYSxFQUFFLFFBQVEsU0FBUztBQUM3RSxZQUFJLG9CQUFvQixDQUFDLFFBQVEsVUFBVTtBQUMxQyxnQkFBTSxXQUFXLFFBQVEsUUFBUSxvQkFBb0IsT0FBTyxHQUFHO0FBQy9ELDBCQUFnQixnQkFBZ0IsR0FBRyxRQUFRLFdBQU0sYUFBYSxLQUFLO0FBQUEsUUFDcEU7QUFFQSxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFHQSxXQUFPLEtBQUssVUFBVSxVQUFVLFlBQVksUUFBUSxRQUFRO0FBQUEsRUFDN0Q7QUFBQSxFQUVBLG9CQUFvQixVQUF1QjtBQUMxQyxVQUFNLGFBQWEsS0FBSyxlQUFlLFFBQVE7QUFDL0MsVUFBTSxRQUFRLEtBQUssY0FBYyxVQUFVLFVBQVU7QUFFckQsUUFBSTtBQUNKLFFBQUksWUFBWSxjQUFjLE1BQU0sS0FBSztBQUN4QyxnQkFBVTtBQUFBLElBQ1gsV0FBVyxZQUFZLGNBQWMsTUFBTSxLQUFLO0FBQy9DLGdCQUFVO0FBQUEsSUFDWCxPQUFPO0FBQ04sZ0JBQVcsS0FBSyxPQUFPLGdCQUFnQixVQUFXLFFBQVE7QUFBQSxJQUMzRDtBQUVBLFdBQU8sUUFBUSxTQUFTLEtBQUs7QUFBQSxFQUM5QjtBQUFBLEVBRUEsa0JBQWtCLFdBQXVGLFNBQTBDO0FBQ2xKLFFBQUksWUFBWSxTQUFTLEdBQUc7QUFDM0IsWUFBTSxhQUFhLHNCQUFzQixTQUFTO0FBQ2xELFVBQUksa0NBQWtDLFVBQVUsS0FBSyxzQkFBc0IsVUFBVSxHQUFHO0FBQ3ZGLGVBQU8sS0FBSyxrQkFBa0IsWUFBWSxPQUFPO0FBQUEsTUFDbEQ7QUFFQSxhQUFPO0FBQUEsSUFDUjtBQUdBLFFBQUksSUFBSSxNQUFNLFNBQVMsR0FBRztBQUN6QixhQUFPLEtBQUssZ0NBQWdDLFdBQVcsT0FBTztBQUFBLElBQy9EO0FBR0EsUUFBSSxrQ0FBa0MsU0FBUyxHQUFHO0FBQ2pELGFBQU8sS0FBSyxnQ0FBZ0MsVUFBVSxLQUFLLE9BQU87QUFBQSxJQUNuRTtBQUdBLFFBQUksc0JBQXNCLFNBQVMsR0FBRztBQUNyQyxhQUFPLEtBQUssb0JBQW9CLFVBQVUsWUFBWSxPQUFPO0FBQUEsSUFDOUQ7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsb0JBQW9CLGNBQW1CLFNBQTBDO0FBR3hGLFFBQUksb0JBQW9CLGNBQWMsS0FBSyxrQkFBa0IsR0FBRztBQUMvRCxhQUFPLFNBQVMscUJBQXFCLHNCQUFzQjtBQUFBLElBQzVEO0FBR0EsUUFBSSxxQkFBcUIsWUFBWSxHQUFHO0FBQ3ZDLGFBQU8sU0FBUyxzQkFBc0IsV0FBVztBQUFBLElBQ2xEO0FBR0EsUUFBSSxXQUFXLFNBQVMsWUFBWTtBQUNwQyxRQUFJLFNBQVMsU0FBUyxtQkFBbUIsR0FBRztBQUMzQyxpQkFBVyxTQUFTLE9BQU8sR0FBRyxTQUFTLFNBQVMsb0JBQW9CLFNBQVMsQ0FBQztBQUFBLElBQy9FO0FBRUEsUUFBSTtBQUNKLFlBQVEsU0FBUyxTQUFTO0FBQUEsTUFDekIsS0FBSyxVQUFVO0FBQ2QsZ0JBQVE7QUFDUjtBQUFBLE1BQ0QsS0FBSyxVQUFVO0FBQ2QsZ0JBQVEsU0FBUyx3QkFBd0IsbUJBQW1CLEtBQUssWUFBWSxTQUFTLFFBQVEsWUFBWSxHQUFHLFFBQVEsQ0FBQyxDQUFDO0FBQ3ZIO0FBQUEsTUFDRCxLQUFLLFVBQVU7QUFBQSxNQUNmO0FBQ0MsZ0JBQVEsU0FBUyxpQkFBaUIsbUJBQW1CLFFBQVE7QUFDN0Q7QUFBQSxJQUNGO0FBRUEsUUFBSSxTQUFTLFlBQVksVUFBVSxPQUFPO0FBQ3pDLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTyxLQUFLLHNCQUFzQixPQUFPLFlBQVk7QUFBQSxFQUN0RDtBQUFBLEVBRVEsZ0NBQWdDLFdBQWdCLFNBQTBDO0FBQ2pHLFFBQUk7QUFDSixZQUFRLFNBQVMsU0FBUztBQUFBLE1BQ3pCLEtBQUssVUFBVTtBQUNkLGdCQUFRLEtBQUssWUFBWSxTQUFTO0FBQ2xDO0FBQUEsTUFDRCxLQUFLLFVBQVU7QUFBQSxNQUNmLEtBQUssVUFBVTtBQUFBLE1BQ2Y7QUFDQyxnQkFBUSxTQUFTLFNBQVMsS0FBSyxNQUFNO0FBQ3JDO0FBQUEsSUFDRjtBQUVBLFFBQUksU0FBUyxZQUFZLFVBQVUsT0FBTztBQUN6QyxhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU8sS0FBSyxzQkFBc0IsT0FBTyxTQUFTO0FBQUEsRUFDbkQ7QUFBQSxFQUVBLGFBQWEsUUFBZ0IsV0FBZ0M7QUFDNUQsVUFBTSxZQUFZLEtBQUssZUFBZSxJQUFJLEtBQUssRUFBRSxRQUFRLFVBQVUsQ0FBQyxDQUFDO0FBRXJFLFdBQU8sV0FBVyxhQUFhLE1BQU07QUFBQSxFQUN0QztBQUFBLEVBRUEsYUFBYSxRQUFnQixXQUE0QjtBQUN4RCxVQUFNLFlBQVksS0FBSyxlQUFlLElBQUksS0FBSyxFQUFFLFFBQVEsVUFBVSxDQUFDLENBQUM7QUFFckUsV0FBTyxXQUFXLG1CQUFtQixhQUFhO0FBQUEsRUFDbkQ7QUFBQSxFQUVBLGVBQWUsUUFBZ0IsV0FBd0M7QUFDdEUsVUFBTSxZQUFZLEtBQUssZUFBZSxJQUFJLEtBQUssRUFBRSxRQUFRLFVBQVUsQ0FBQyxDQUFDO0FBRXJFLFdBQU8sV0FBVztBQUFBLEVBQ25CO0FBQUEsRUFFQSx3QkFBd0IsV0FBZ0Q7QUFDdkUsVUFBTSxPQUFPLEtBQUssaUJBQWlCLGVBQWUsQ0FBQztBQUVuRCxRQUFJLFVBQVUsS0FBSyxVQUFVLE9BQUssRUFBRSxXQUFXLFVBQVUsVUFBVSxFQUFFLGNBQWMsVUFBVSxTQUFTO0FBQ3RHLFFBQUksWUFBWSxNQUFNLEtBQUssVUFBVSxzQkFBc0I7QUFDMUQsZ0JBQVUsdUJBQXVCO0FBQUEsSUFDbEM7QUFFQSxRQUFJLFlBQVksSUFBSTtBQUNuQixXQUFLLFFBQVEsU0FBUztBQUFBLElBQ3ZCLE9BQU87QUFDTixlQUFTLElBQUksU0FBUyxJQUFJLEdBQUcsS0FBSztBQUNqQyxhQUFLLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQztBQUFBLE1BQ3JCO0FBQ0EsV0FBSyxDQUFDLElBQUk7QUFBQSxJQUNYO0FBRUEsU0FBSyx3QkFBd0IsWUFBWTtBQUV6QyxXQUFPLEtBQUssa0JBQWtCLFNBQVM7QUFBQSxFQUN4QztBQUFBLEVBRUEsa0JBQWtCLFdBQWdEO0FBQ2pFLFNBQUssV0FBVyxLQUFLLFNBQVM7QUFDOUIsU0FBSyx1QkFBdUIsS0FBSyxFQUFFLFFBQVEsVUFBVSxPQUFPLENBQUM7QUFFN0QsV0FBTztBQUFBLE1BQ04sU0FBUyxNQUFNO0FBQ2QsYUFBSyxhQUFhLEtBQUssV0FBVyxPQUFPLE9BQUssTUFBTSxTQUFTO0FBQzdELGFBQUssdUJBQXVCLEtBQUssRUFBRSxRQUFRLFVBQVUsT0FBTyxDQUFDO0FBQUEsTUFDOUQ7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRVEsVUFBVSxVQUFlLFlBQXFDLGdCQUFrQztBQUN2RyxRQUFJLFFBQVEsV0FBVyxNQUFNLFFBQVEscUJBQXFCLENBQUNDLFFBQU8sT0FBTyxTQUFTLFlBQVk7QUFDN0YsY0FBUSxPQUFPO0FBQUEsUUFDZCxLQUFLO0FBQVUsaUJBQU8sU0FBUztBQUFBLFFBQy9CLEtBQUs7QUFBYSxpQkFBTyxTQUFTO0FBQUEsUUFDbEMsS0FBSyxtQkFBbUI7QUFDdkIsZ0JBQU0sSUFBSSxTQUFTLFVBQVUsUUFBUSxHQUFHO0FBQ3hDLGlCQUFPLE1BQU0sS0FBSyxTQUFTLFlBQVksU0FBUyxVQUFVLE1BQU0sSUFBSSxDQUFDO0FBQUEsUUFDdEU7QUFBQSxRQUNBLEtBQUs7QUFDSixpQkFBTyxXQUFXLDZCQUNmLFNBQVMsS0FBSyxNQUFNLFNBQVMsS0FBSyxDQUFDLE1BQU0sV0FBVyxZQUFZLElBQUksQ0FBQyxJQUNyRSxTQUFTO0FBQUEsUUFDYixTQUFTO0FBQ1IsY0FBSSxZQUFZLFNBQVM7QUFDeEIsa0JBQU0sRUFBRSxNQUFNLElBQUk7QUFDbEIsZ0JBQUksU0FBUyxNQUFNLENBQUMsTUFBTSxPQUFPLE1BQU0sTUFBTSxTQUFTLENBQUMsTUFBTSxLQUFLO0FBQ2pFLGtCQUFJO0FBQ0gsdUJBQU8sS0FBSyxNQUFNLEtBQUssRUFBRSxPQUFPLEtBQUs7QUFBQSxjQUN0QyxRQUFRO0FBQUEsY0FBRTtBQUFBLFlBQ1g7QUFBQSxVQUNEO0FBRUEsaUJBQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUdELFFBQUksV0FBVyx3QkFBd0IsNkJBQTZCLEtBQUssR0FBRztBQUMzRSxjQUFRLE1BQU0sT0FBTyxDQUFDLEVBQUUsWUFBWSxJQUFJLE1BQU0sT0FBTyxDQUFDO0FBQUEsSUFDdkQ7QUFFQSxRQUFJLFdBQVcsV0FBVyxDQUFDLGdCQUFnQjtBQUMxQyxVQUFJLEtBQUssVUFBVTtBQUNsQixnQkFBUSxRQUFRLE9BQU8sS0FBSyxTQUFTLFFBQVEsS0FBSyxFQUFFO0FBQUEsTUFDckQ7QUFBQSxJQUNEO0FBRUEsUUFBSSxXQUFXLG1CQUFtQixTQUFTLFdBQVc7QUFDckQsY0FBUSxXQUFXLGtCQUFrQjtBQUFBLElBQ3RDO0FBRUEsV0FBTyxNQUFNLFFBQVEsV0FBVyxXQUFXLFNBQVM7QUFBQSxFQUNyRDtBQUFBLEVBRVEsc0JBQXNCLE9BQWUsS0FBa0I7QUFDOUQsVUFBTSxhQUFhLEtBQUssZUFBZSxHQUFHO0FBQzFDLFVBQU0sU0FBUyxjQUFlLE9BQU8sV0FBVyxvQkFBb0IsV0FBWSxXQUFXLGtCQUFrQjtBQUU3RyxXQUFPLFNBQVMsR0FBRyxLQUFLLEtBQUssTUFBTSxNQUFNO0FBQUEsRUFDMUM7QUFDRDtBQWxYYSxlQUFOO0FBQUEsRUFlSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FwQlU7QUFvWGIsa0JBQWtCLGVBQWUsY0FBYyxrQkFBa0IsT0FBTzsiLAogICJuYW1lcyI6IFsicmVzb3VyY2UiLCAibWF0Y2giXQp9Cg==
