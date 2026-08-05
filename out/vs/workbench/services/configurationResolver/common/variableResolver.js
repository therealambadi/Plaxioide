import { normalizeDriveLetter } from "../../../../base/common/labels.js";
import * as paths from "../../../../base/common/path.js";
import { isWindows } from "../../../../base/common/platform.js";
import * as process from "../../../../base/common/process.js";
import * as types from "../../../../base/common/types.js";
import { localize } from "../../../../nls.js";
import { allVariableKinds, VariableError, VariableKind } from "./configurationResolver.js";
import { ConfigurationResolverExpression } from "./configurationResolverExpression.js";
class AbstractVariableResolverService {
  constructor(_context, _labelService, _userHomePromise, _envVariablesPromise) {
    this._contributedVariables = /* @__PURE__ */ new Map();
    this.resolvableVariables = new Set(allVariableKinds);
    this._context = _context;
    this._labelService = _labelService;
    this._userHomePromise = _userHomePromise;
    if (_envVariablesPromise) {
      this._envVariablesPromise = _envVariablesPromise.then((envVariables) => {
        return this.prepareEnv(envVariables);
      });
    }
  }
  prepareEnv(envVariables) {
    if (isWindows) {
      const ev = /* @__PURE__ */ Object.create(null);
      Object.keys(envVariables).forEach((key) => {
        ev[key.toLowerCase()] = envVariables[key];
      });
      return ev;
    }
    return envVariables;
  }
  async resolveWithEnvironment(environment, folder, value) {
    const expr = ConfigurationResolverExpression.parse(value);
    const env = {
      env: this.prepareEnv(environment),
      userHome: void 0
    };
    for (const replacement of expr.unresolved()) {
      const resolvedValue = await this.evaluateSingleVariable(env, replacement, folder?.uri);
      if (resolvedValue !== void 0) {
        expr.resolve(replacement, resolvedValue);
      }
    }
    return expr.toObject();
  }
  async resolveAsync(folder, config) {
    const expr = ConfigurationResolverExpression.parse(config);
    const environment = {
      env: await this._envVariablesPromise,
      userHome: await this._userHomePromise
    };
    for (const replacement of expr.unresolved()) {
      const resolvedValue = await this.evaluateSingleVariable(environment, replacement, folder?.uri);
      if (resolvedValue !== void 0) {
        expr.resolve(replacement, resolvedValue);
      }
    }
    return expr.toObject();
  }
  resolveWithInteractionReplace(folder, config) {
    throw new Error("resolveWithInteractionReplace not implemented.");
  }
  resolveWithInteraction(folder, config) {
    throw new Error("resolveWithInteraction not implemented.");
  }
  contributeVariable(variable, resolution) {
    if (this._contributedVariables.has(variable)) {
      throw new Error("Variable " + variable + " is contributed twice.");
    } else {
      this.resolvableVariables.add(variable);
      this._contributedVariables.set(variable, resolution);
    }
  }
  fsPath(displayUri) {
    return this._labelService ? this._labelService.getUriLabel(displayUri, { noPrefix: true }) : displayUri.fsPath;
  }
  async evaluateSingleVariable(environment, replacement, folderUri, commandValueMapping) {
    const { name: variable, arg: argument } = replacement;
    const getFilePath = (variableKind) => {
      const filePath = this._context.getFilePath();
      if (filePath) {
        return normalizeDriveLetter(filePath);
      }
      throw new VariableError(variableKind, localize("canNotResolveFile", "Variable {0} can not be resolved. Please open an editor.", replacement.id));
    };
    const getFolderPathForFile = (variableKind) => {
      const filePath = getFilePath(variableKind);
      if (this._context.getWorkspaceFolderPathForFile) {
        const folderPath = this._context.getWorkspaceFolderPathForFile();
        if (folderPath) {
          return normalizeDriveLetter(folderPath);
        }
      }
      throw new VariableError(variableKind, localize("canNotResolveFolderForFile", "Variable {0}: can not find workspace folder of '{1}'.", replacement.id, paths.basename(filePath)));
    };
    const getFolderUri = (variableKind) => {
      if (argument) {
        const folder = this._context.getFolderUri(argument);
        if (folder) {
          return folder;
        }
        throw new VariableError(variableKind, localize("canNotFindFolder", "Variable {0} can not be resolved. No such folder '{1}'.", variableKind, argument));
      }
      if (folderUri) {
        return folderUri;
      }
      if (this._context.getWorkspaceFolderCount() > 1) {
        throw new VariableError(variableKind, localize("canNotResolveWorkspaceFolderMultiRoot", "Variable {0} can not be resolved in a multi folder workspace. Scope this variable using ':' and a workspace folder name.", variableKind));
      }
      throw new VariableError(variableKind, localize("canNotResolveWorkspaceFolder", "Variable {0} can not be resolved. Please open a folder.", variableKind));
    };
    switch (variable) {
      case "env":
        if (argument) {
          if (environment.env) {
            const env = environment.env[isWindows ? argument.toLowerCase() : argument];
            if (types.isString(env)) {
              return env;
            }
          }
          return "";
        }
        throw new VariableError(VariableKind.Env, localize("missingEnvVarName", "Variable {0} can not be resolved because no environment variable name is given.", replacement.id));
      case "config":
        if (argument) {
          const config = this._context.getConfigurationValue(folderUri, argument);
          if (types.isUndefinedOrNull(config)) {
            throw new VariableError(VariableKind.Config, localize("configNotFound", "Variable {0} can not be resolved because setting '{1}' not found.", replacement.id, argument));
          }
          if (types.isObject(config)) {
            throw new VariableError(VariableKind.Config, localize("configNoString", "Variable {0} can not be resolved because '{1}' is a structured value.", replacement.id, argument));
          }
          return config;
        }
        throw new VariableError(VariableKind.Config, localize("missingConfigName", "Variable {0} can not be resolved because no settings name is given.", replacement.id));
      case "command":
        return this.resolveFromMap(VariableKind.Command, replacement.id, argument, commandValueMapping, "command");
      case "input":
        return this.resolveFromMap(VariableKind.Input, replacement.id, argument, commandValueMapping, "input");
      case "extensionInstallFolder":
        if (argument) {
          const ext = await this._context.getExtension(argument);
          if (!ext) {
            throw new VariableError(VariableKind.ExtensionInstallFolder, localize("extensionNotInstalled", "Variable {0} can not be resolved because the extension {1} is not installed.", replacement.id, argument));
          }
          return this.fsPath(ext.extensionLocation);
        }
        throw new VariableError(VariableKind.ExtensionInstallFolder, localize("missingExtensionName", "Variable {0} can not be resolved because no extension name is given.", replacement.id));
      default: {
        switch (variable) {
          case "workspaceRoot":
          case "workspaceFolder": {
            const uri2 = getFolderUri(VariableKind.WorkspaceFolder);
            return uri2 ? normalizeDriveLetter(this.fsPath(uri2)) : void 0;
          }
          case "cwd": {
            if (!folderUri && !argument) {
              return process.cwd();
            }
            const uri2 = getFolderUri(VariableKind.Cwd);
            return uri2 ? normalizeDriveLetter(this.fsPath(uri2)) : void 0;
          }
          case "workspaceRootFolderName":
          case "workspaceFolderBasename": {
            const uri2 = getFolderUri(VariableKind.WorkspaceFolderBasename);
            return uri2 ? normalizeDriveLetter(paths.basename(this.fsPath(uri2))) : void 0;
          }
          case "userHome":
            if (environment.userHome) {
              return environment.userHome;
            }
            throw new VariableError(VariableKind.UserHome, localize("canNotResolveUserHome", "Variable {0} can not be resolved. UserHome path is not defined", replacement.id));
          case "lineNumber": {
            const lineNumber = this._context.getLineNumber();
            if (lineNumber) {
              return lineNumber;
            }
            throw new VariableError(VariableKind.LineNumber, localize("canNotResolveLineNumber", "Variable {0} can not be resolved. Make sure to have a line selected in the active editor.", replacement.id));
          }
          case "columnNumber": {
            const columnNumber = this._context.getColumnNumber();
            if (columnNumber) {
              return columnNumber;
            }
            throw new Error(localize("canNotResolveColumnNumber", "Variable {0} can not be resolved. Make sure to have a column selected in the active editor.", replacement.id));
          }
          case "selectedText": {
            const selectedText = this._context.getSelectedText();
            if (selectedText) {
              return selectedText;
            }
            throw new VariableError(VariableKind.SelectedText, localize("canNotResolveSelectedText", "Variable {0} can not be resolved. Make sure to have some text selected in the active editor.", replacement.id));
          }
          case "file":
            return getFilePath(VariableKind.File);
          case "fileWorkspaceFolder":
            return getFolderPathForFile(VariableKind.FileWorkspaceFolder);
          case "fileWorkspaceFolderBasename":
            return paths.basename(getFolderPathForFile(VariableKind.FileWorkspaceFolderBasename));
          case "relativeFile":
            if (folderUri || argument) {
              return paths.relative(this.fsPath(getFolderUri(VariableKind.RelativeFile)), getFilePath(VariableKind.RelativeFile));
            }
            return getFilePath(VariableKind.RelativeFile);
          case "relativeFileDirname": {
            const dirname = paths.dirname(getFilePath(VariableKind.RelativeFileDirname));
            if (folderUri || argument) {
              const relative = paths.relative(this.fsPath(getFolderUri(VariableKind.RelativeFileDirname)), dirname);
              return relative.length === 0 ? "." : relative;
            }
            return dirname;
          }
          case "fileDirname":
            return paths.dirname(getFilePath(VariableKind.FileDirname));
          case "fileExtname":
            return paths.extname(getFilePath(VariableKind.FileExtname));
          case "fileBasename":
            return paths.basename(getFilePath(VariableKind.FileBasename));
          case "fileBasenameNoExtension": {
            const basename = paths.basename(getFilePath(VariableKind.FileBasenameNoExtension));
            return basename.slice(0, basename.length - paths.extname(basename).length);
          }
          case "fileDirnameBasename":
            return paths.basename(paths.dirname(getFilePath(VariableKind.FileDirnameBasename)));
          case "execPath": {
            const ep = this._context.getExecPath();
            if (ep) {
              return ep;
            }
            return replacement.id;
          }
          case "execInstallFolder": {
            const ar = this._context.getAppRoot();
            if (ar) {
              return ar;
            }
            return replacement.id;
          }
          case "pathSeparator":
          case "/":
            return paths.sep;
          default: {
            try {
              return this.resolveFromMap(VariableKind.Unknown, replacement.id, argument, commandValueMapping, void 0);
            } catch {
              return replacement.id;
            }
          }
        }
      }
    }
  }
  resolveFromMap(variableKind, match, argument, commandValueMapping, prefix) {
    if (argument && commandValueMapping) {
      const v = prefix === void 0 ? commandValueMapping[argument] : commandValueMapping[prefix + ":" + argument];
      if (typeof v === "string") {
        return v;
      }
      throw new VariableError(variableKind, localize("noValueForCommand", "Variable {0} can not be resolved because the command has no value.", match));
    }
    return match;
  }
}
export {
  AbstractVariableResolverService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvY29uZmlndXJhdGlvblJlc29sdmVyL2NvbW1vbi92YXJpYWJsZVJlc29sdmVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSVN0cmluZ0RpY3Rpb25hcnkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBub3JtYWxpemVEcml2ZUxldHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhYmVscy5qcyc7XG5pbXBvcnQgKiBhcyBwYXRocyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IElQcm9jZXNzRW52aXJvbm1lbnQsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCAqIGFzIHByb2Nlc3MgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcHJvY2Vzcy5qcyc7XG5pbXBvcnQgKiBhcyB0eXBlcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgYXMgdXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUZvbGRlckRhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBhbGxWYXJpYWJsZUtpbmRzLCBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSwgVmFyaWFibGVFcnJvciwgVmFyaWFibGVLaW5kIH0gZnJvbSAnLi9jb25maWd1cmF0aW9uUmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbiwgSVJlc29sdmVkVmFsdWUsIFJlcGxhY2VtZW50IH0gZnJvbSAnLi9jb25maWd1cmF0aW9uUmVzb2x2ZXJFeHByZXNzaW9uLmpzJztcblxuaW50ZXJmYWNlIElWYXJpYWJsZVJlc29sdmVDb250ZXh0IHtcblx0Z2V0Rm9sZGVyVXJpKGZvbGRlck5hbWU6IHN0cmluZyk6IHVyaSB8IHVuZGVmaW5lZDtcblx0Z2V0V29ya3NwYWNlRm9sZGVyQ291bnQoKTogbnVtYmVyO1xuXHRnZXRDb25maWd1cmF0aW9uVmFsdWUoZm9sZGVyVXJpOiB1cmkgfCB1bmRlZmluZWQsIHNlY3Rpb246IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Z2V0QXBwUm9vdCgpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGdldEV4ZWNQYXRoKCk6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Z2V0RmlsZVBhdGgoKTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRnZXRXb3Jrc3BhY2VGb2xkZXJQYXRoRm9yRmlsZT8oKTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRnZXRTZWxlY3RlZFRleHQoKTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRnZXRMaW5lTnVtYmVyKCk6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Z2V0Q29sdW1uTnVtYmVyKCk6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Z2V0RXh0ZW5zaW9uKGlkOiBzdHJpbmcpOiBQcm9taXNlPHsgcmVhZG9ubHkgZXh0ZW5zaW9uTG9jYXRpb246IHVyaSB9IHwgdW5kZWZpbmVkPjtcbn1cblxudHlwZSBFbnZpcm9ubWVudCA9IHsgZW52OiBJUHJvY2Vzc0Vudmlyb25tZW50IHwgdW5kZWZpbmVkOyB1c2VySG9tZTogc3RyaW5nIHwgdW5kZWZpbmVkIH07XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdFZhcmlhYmxlUmVzb2x2ZXJTZXJ2aWNlIGltcGxlbWVudHMgSUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX2NvbnRleHQ6IElWYXJpYWJsZVJlc29sdmVDb250ZXh0O1xuXHRwcml2YXRlIF9sYWJlbFNlcnZpY2U/OiBJTGFiZWxTZXJ2aWNlO1xuXHRwcml2YXRlIF9lbnZWYXJpYWJsZXNQcm9taXNlPzogUHJvbWlzZTxJUHJvY2Vzc0Vudmlyb25tZW50Pjtcblx0cHJpdmF0ZSBfdXNlckhvbWVQcm9taXNlPzogUHJvbWlzZTxzdHJpbmc+O1xuXHRwcm90ZWN0ZWQgX2NvbnRyaWJ1dGVkVmFyaWFibGVzOiBNYXA8c3RyaW5nLCAoKSA9PiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4+ID0gbmV3IE1hcCgpO1xuXG5cdHB1YmxpYyByZWFkb25seSByZXNvbHZhYmxlVmFyaWFibGVzID0gbmV3IFNldDxzdHJpbmc+KGFsbFZhcmlhYmxlS2luZHMpO1xuXG5cdGNvbnN0cnVjdG9yKF9jb250ZXh0OiBJVmFyaWFibGVSZXNvbHZlQ29udGV4dCwgX2xhYmVsU2VydmljZT86IElMYWJlbFNlcnZpY2UsIF91c2VySG9tZVByb21pc2U/OiBQcm9taXNlPHN0cmluZz4sIF9lbnZWYXJpYWJsZXNQcm9taXNlPzogUHJvbWlzZTxJUHJvY2Vzc0Vudmlyb25tZW50Pikge1xuXHRcdHRoaXMuX2NvbnRleHQgPSBfY29udGV4dDtcblx0XHR0aGlzLl9sYWJlbFNlcnZpY2UgPSBfbGFiZWxTZXJ2aWNlO1xuXHRcdHRoaXMuX3VzZXJIb21lUHJvbWlzZSA9IF91c2VySG9tZVByb21pc2U7XG5cdFx0aWYgKF9lbnZWYXJpYWJsZXNQcm9taXNlKSB7XG5cdFx0XHR0aGlzLl9lbnZWYXJpYWJsZXNQcm9taXNlID0gX2VudlZhcmlhYmxlc1Byb21pc2UudGhlbihlbnZWYXJpYWJsZXMgPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5wcmVwYXJlRW52KGVudlZhcmlhYmxlcyk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHByZXBhcmVFbnYoZW52VmFyaWFibGVzOiBJUHJvY2Vzc0Vudmlyb25tZW50KTogSVByb2Nlc3NFbnZpcm9ubWVudCB7XG5cdFx0Ly8gd2luZG93cyBlbnYgdmFyaWFibGVzIGFyZSBjYXNlIGluc2Vuc2l0aXZlXG5cdFx0aWYgKGlzV2luZG93cykge1xuXHRcdFx0Y29uc3QgZXY6IElQcm9jZXNzRW52aXJvbm1lbnQgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdFx0T2JqZWN0LmtleXMoZW52VmFyaWFibGVzKS5mb3JFYWNoKGtleSA9PiB7XG5cdFx0XHRcdGV2W2tleS50b0xvd2VyQ2FzZSgpXSA9IGVudlZhcmlhYmxlc1trZXldO1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gZXY7XG5cdFx0fVxuXHRcdHJldHVybiBlbnZWYXJpYWJsZXM7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcmVzb2x2ZVdpdGhFbnZpcm9ubWVudChlbnZpcm9ubWVudDogSVByb2Nlc3NFbnZpcm9ubWVudCwgZm9sZGVyOiBJV29ya3NwYWNlRm9sZGVyRGF0YSB8IHVuZGVmaW5lZCwgdmFsdWU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Y29uc3QgZXhwciA9IENvbmZpZ3VyYXRpb25SZXNvbHZlckV4cHJlc3Npb24ucGFyc2UodmFsdWUpO1xuXHRcdGNvbnN0IGVudjogRW52aXJvbm1lbnQgPSB7XG5cdFx0XHRlbnY6IHRoaXMucHJlcGFyZUVudihlbnZpcm9ubWVudCksXG5cdFx0XHR1c2VySG9tZTogdW5kZWZpbmVkXG5cdFx0fTtcblxuXHRcdGZvciAoY29uc3QgcmVwbGFjZW1lbnQgb2YgZXhwci51bnJlc29sdmVkKCkpIHtcblx0XHRcdGNvbnN0IHJlc29sdmVkVmFsdWUgPSBhd2FpdCB0aGlzLmV2YWx1YXRlU2luZ2xlVmFyaWFibGUoZW52LCByZXBsYWNlbWVudCwgZm9sZGVyPy51cmkpO1xuXHRcdFx0aWYgKHJlc29sdmVkVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRleHByLnJlc29sdmUocmVwbGFjZW1lbnQsIHJlc29sdmVkVmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBleHByLnRvT2JqZWN0KCk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcmVzb2x2ZUFzeW5jPFQ+KGZvbGRlcjogSVdvcmtzcGFjZUZvbGRlckRhdGEgfCB1bmRlZmluZWQsIGNvbmZpZzogVCk6IFByb21pc2U8VCBleHRlbmRzIENvbmZpZ3VyYXRpb25SZXNvbHZlckV4cHJlc3Npb248aW5mZXIgUj4gPyBSIDogVD4ge1xuXHRcdGNvbnN0IGV4cHIgPSBDb25maWd1cmF0aW9uUmVzb2x2ZXJFeHByZXNzaW9uLnBhcnNlKGNvbmZpZyk7XG5cblx0XHRjb25zdCBlbnZpcm9ubWVudDogRW52aXJvbm1lbnQgPSB7XG5cdFx0XHRlbnY6IGF3YWl0IHRoaXMuX2VudlZhcmlhYmxlc1Byb21pc2UsXG5cdFx0XHR1c2VySG9tZTogYXdhaXQgdGhpcy5fdXNlckhvbWVQcm9taXNlXG5cdFx0fTtcblxuXHRcdGZvciAoY29uc3QgcmVwbGFjZW1lbnQgb2YgZXhwci51bnJlc29sdmVkKCkpIHtcblx0XHRcdGNvbnN0IHJlc29sdmVkVmFsdWUgPSBhd2FpdCB0aGlzLmV2YWx1YXRlU2luZ2xlVmFyaWFibGUoZW52aXJvbm1lbnQsIHJlcGxhY2VtZW50LCBmb2xkZXI/LnVyaSk7XG5cdFx0XHRpZiAocmVzb2x2ZWRWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGV4cHIucmVzb2x2ZShyZXBsYWNlbWVudCwgcmVzb2x2ZWRWYWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGV4cHIudG9PYmplY3QoKSBhcyBhbnk7XG5cdH1cblxuXHRwdWJsaWMgcmVzb2x2ZVdpdGhJbnRlcmFjdGlvblJlcGxhY2UoZm9sZGVyOiBJV29ya3NwYWNlRm9sZGVyRGF0YSB8IHVuZGVmaW5lZCwgY29uZmlnOiBhbnkpOiBQcm9taXNlPGFueT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcigncmVzb2x2ZVdpdGhJbnRlcmFjdGlvblJlcGxhY2Ugbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0cHVibGljIHJlc29sdmVXaXRoSW50ZXJhY3Rpb24oZm9sZGVyOiBJV29ya3NwYWNlRm9sZGVyRGF0YSB8IHVuZGVmaW5lZCwgY29uZmlnOiBhbnkpOiBQcm9taXNlPE1hcDxzdHJpbmcsIHN0cmluZz4gfCB1bmRlZmluZWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ3Jlc29sdmVXaXRoSW50ZXJhY3Rpb24gbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0cHVibGljIGNvbnRyaWJ1dGVWYXJpYWJsZSh2YXJpYWJsZTogc3RyaW5nLCByZXNvbHV0aW9uOiAoKSA9PiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fY29udHJpYnV0ZWRWYXJpYWJsZXMuaGFzKHZhcmlhYmxlKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdWYXJpYWJsZSAnICsgdmFyaWFibGUgKyAnIGlzIGNvbnRyaWJ1dGVkIHR3aWNlLicpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnJlc29sdmFibGVWYXJpYWJsZXMuYWRkKHZhcmlhYmxlKTtcblx0XHRcdHRoaXMuX2NvbnRyaWJ1dGVkVmFyaWFibGVzLnNldCh2YXJpYWJsZSwgcmVzb2x1dGlvbik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBmc1BhdGgoZGlzcGxheVVyaTogdXJpKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5fbGFiZWxTZXJ2aWNlID8gdGhpcy5fbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGRpc3BsYXlVcmksIHsgbm9QcmVmaXg6IHRydWUgfSkgOiBkaXNwbGF5VXJpLmZzUGF0aDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZXZhbHVhdGVTaW5nbGVWYXJpYWJsZShlbnZpcm9ubWVudDogRW52aXJvbm1lbnQsIHJlcGxhY2VtZW50OiBSZXBsYWNlbWVudCwgZm9sZGVyVXJpOiB1cmkgfCB1bmRlZmluZWQsIGNvbW1hbmRWYWx1ZU1hcHBpbmc/OiBJU3RyaW5nRGljdGlvbmFyeTxJUmVzb2x2ZWRWYWx1ZT4pOiBQcm9taXNlPElSZXNvbHZlZFZhbHVlIHwgc3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgeyBuYW1lOiB2YXJpYWJsZSwgYXJnOiBhcmd1bWVudCB9ID0gcmVwbGFjZW1lbnQ7XG5cblx0XHQvLyBjb21tb24gZXJyb3IgaGFuZGxpbmcgZm9yIGFsbCB2YXJpYWJsZXMgdGhhdCByZXF1aXJlIGFuIG9wZW4gZWRpdG9yXG5cdFx0Y29uc3QgZ2V0RmlsZVBhdGggPSAodmFyaWFibGVLaW5kOiBWYXJpYWJsZUtpbmQpOiBzdHJpbmcgPT4ge1xuXHRcdFx0Y29uc3QgZmlsZVBhdGggPSB0aGlzLl9jb250ZXh0LmdldEZpbGVQYXRoKCk7XG5cdFx0XHRpZiAoZmlsZVBhdGgpIHtcblx0XHRcdFx0cmV0dXJuIG5vcm1hbGl6ZURyaXZlTGV0dGVyKGZpbGVQYXRoKTtcblx0XHRcdH1cblx0XHRcdHRocm93IG5ldyBWYXJpYWJsZUVycm9yKHZhcmlhYmxlS2luZCwgKGxvY2FsaXplKCdjYW5Ob3RSZXNvbHZlRmlsZScsIFwiVmFyaWFibGUgezB9IGNhbiBub3QgYmUgcmVzb2x2ZWQuIFBsZWFzZSBvcGVuIGFuIGVkaXRvci5cIiwgcmVwbGFjZW1lbnQuaWQpKSk7XG5cdFx0fTtcblxuXHRcdC8vIGNvbW1vbiBlcnJvciBoYW5kbGluZyBmb3IgYWxsIHZhcmlhYmxlcyB0aGF0IHJlcXVpcmUgYW4gb3BlbiBlZGl0b3Jcblx0XHRjb25zdCBnZXRGb2xkZXJQYXRoRm9yRmlsZSA9ICh2YXJpYWJsZUtpbmQ6IFZhcmlhYmxlS2luZCk6IHN0cmluZyA9PiB7XG5cdFx0XHRjb25zdCBmaWxlUGF0aCA9IGdldEZpbGVQYXRoKHZhcmlhYmxlS2luZCk7XHRcdC8vIHRocm93cyBlcnJvciBpZiBubyBlZGl0b3Igb3BlblxuXHRcdFx0aWYgKHRoaXMuX2NvbnRleHQuZ2V0V29ya3NwYWNlRm9sZGVyUGF0aEZvckZpbGUpIHtcblx0XHRcdFx0Y29uc3QgZm9sZGVyUGF0aCA9IHRoaXMuX2NvbnRleHQuZ2V0V29ya3NwYWNlRm9sZGVyUGF0aEZvckZpbGUoKTtcblx0XHRcdFx0aWYgKGZvbGRlclBhdGgpIHtcblx0XHRcdFx0XHRyZXR1cm4gbm9ybWFsaXplRHJpdmVMZXR0ZXIoZm9sZGVyUGF0aCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRocm93IG5ldyBWYXJpYWJsZUVycm9yKHZhcmlhYmxlS2luZCwgbG9jYWxpemUoJ2Nhbk5vdFJlc29sdmVGb2xkZXJGb3JGaWxlJywgXCJWYXJpYWJsZSB7MH06IGNhbiBub3QgZmluZCB3b3Jrc3BhY2UgZm9sZGVyIG9mICd7MX0nLlwiLCByZXBsYWNlbWVudC5pZCwgcGF0aHMuYmFzZW5hbWUoZmlsZVBhdGgpKSk7XG5cdFx0fTtcblxuXHRcdC8vIGNvbW1vbiBlcnJvciBoYW5kbGluZyBmb3IgYWxsIHZhcmlhYmxlcyB0aGF0IHJlcXVpcmUgYW4gb3BlbiBmb2xkZXIgYW5kIGFjY2VwdCBhIGZvbGRlciBuYW1lIGFyZ3VtZW50XG5cdFx0Y29uc3QgZ2V0Rm9sZGVyVXJpID0gKHZhcmlhYmxlS2luZDogVmFyaWFibGVLaW5kKTogdXJpID0+IHtcblx0XHRcdGlmIChhcmd1bWVudCkge1xuXHRcdFx0XHRjb25zdCBmb2xkZXIgPSB0aGlzLl9jb250ZXh0LmdldEZvbGRlclVyaShhcmd1bWVudCk7XG5cdFx0XHRcdGlmIChmb2xkZXIpIHtcblx0XHRcdFx0XHRyZXR1cm4gZm9sZGVyO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRocm93IG5ldyBWYXJpYWJsZUVycm9yKHZhcmlhYmxlS2luZCwgbG9jYWxpemUoJ2Nhbk5vdEZpbmRGb2xkZXInLCBcIlZhcmlhYmxlIHswfSBjYW4gbm90IGJlIHJlc29sdmVkLiBObyBzdWNoIGZvbGRlciAnezF9Jy5cIiwgdmFyaWFibGVLaW5kLCBhcmd1bWVudCkpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZm9sZGVyVXJpKSB7XG5cdFx0XHRcdHJldHVybiBmb2xkZXJVcmk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLl9jb250ZXh0LmdldFdvcmtzcGFjZUZvbGRlckNvdW50KCkgPiAxKSB7XG5cdFx0XHRcdHRocm93IG5ldyBWYXJpYWJsZUVycm9yKHZhcmlhYmxlS2luZCwgbG9jYWxpemUoJ2Nhbk5vdFJlc29sdmVXb3Jrc3BhY2VGb2xkZXJNdWx0aVJvb3QnLCBcIlZhcmlhYmxlIHswfSBjYW4gbm90IGJlIHJlc29sdmVkIGluIGEgbXVsdGkgZm9sZGVyIHdvcmtzcGFjZS4gU2NvcGUgdGhpcyB2YXJpYWJsZSB1c2luZyAnOicgYW5kIGEgd29ya3NwYWNlIGZvbGRlciBuYW1lLlwiLCB2YXJpYWJsZUtpbmQpKTtcblx0XHRcdH1cblx0XHRcdHRocm93IG5ldyBWYXJpYWJsZUVycm9yKHZhcmlhYmxlS2luZCwgbG9jYWxpemUoJ2Nhbk5vdFJlc29sdmVXb3Jrc3BhY2VGb2xkZXInLCBcIlZhcmlhYmxlIHswfSBjYW4gbm90IGJlIHJlc29sdmVkLiBQbGVhc2Ugb3BlbiBhIGZvbGRlci5cIiwgdmFyaWFibGVLaW5kKSk7XG5cdFx0fTtcblxuXHRcdHN3aXRjaCAodmFyaWFibGUpIHtcblx0XHRcdGNhc2UgJ2Vudic6XG5cdFx0XHRcdGlmIChhcmd1bWVudCkge1xuXHRcdFx0XHRcdGlmIChlbnZpcm9ubWVudC5lbnYpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGVudiA9IGVudmlyb25tZW50LmVudltpc1dpbmRvd3MgPyBhcmd1bWVudC50b0xvd2VyQ2FzZSgpIDogYXJndW1lbnRdO1xuXHRcdFx0XHRcdFx0aWYgKHR5cGVzLmlzU3RyaW5nKGVudikpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGVudjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRocm93IG5ldyBWYXJpYWJsZUVycm9yKFZhcmlhYmxlS2luZC5FbnYsIGxvY2FsaXplKCdtaXNzaW5nRW52VmFyTmFtZScsIFwiVmFyaWFibGUgezB9IGNhbiBub3QgYmUgcmVzb2x2ZWQgYmVjYXVzZSBubyBlbnZpcm9ubWVudCB2YXJpYWJsZSBuYW1lIGlzIGdpdmVuLlwiLCByZXBsYWNlbWVudC5pZCkpO1xuXG5cdFx0XHRjYXNlICdjb25maWcnOlxuXHRcdFx0XHRpZiAoYXJndW1lbnQpIHtcblx0XHRcdFx0XHRjb25zdCBjb25maWcgPSB0aGlzLl9jb250ZXh0LmdldENvbmZpZ3VyYXRpb25WYWx1ZShmb2xkZXJVcmksIGFyZ3VtZW50KTtcblx0XHRcdFx0XHRpZiAodHlwZXMuaXNVbmRlZmluZWRPck51bGwoY29uZmlnKSkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IFZhcmlhYmxlRXJyb3IoVmFyaWFibGVLaW5kLkNvbmZpZywgbG9jYWxpemUoJ2NvbmZpZ05vdEZvdW5kJywgXCJWYXJpYWJsZSB7MH0gY2FuIG5vdCBiZSByZXNvbHZlZCBiZWNhdXNlIHNldHRpbmcgJ3sxfScgbm90IGZvdW5kLlwiLCByZXBsYWNlbWVudC5pZCwgYXJndW1lbnQpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHR5cGVzLmlzT2JqZWN0KGNvbmZpZykpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBWYXJpYWJsZUVycm9yKFZhcmlhYmxlS2luZC5Db25maWcsIGxvY2FsaXplKCdjb25maWdOb1N0cmluZycsIFwiVmFyaWFibGUgezB9IGNhbiBub3QgYmUgcmVzb2x2ZWQgYmVjYXVzZSAnezF9JyBpcyBhIHN0cnVjdHVyZWQgdmFsdWUuXCIsIHJlcGxhY2VtZW50LmlkLCBhcmd1bWVudCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gY29uZmlnO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRocm93IG5ldyBWYXJpYWJsZUVycm9yKFZhcmlhYmxlS2luZC5Db25maWcsIGxvY2FsaXplKCdtaXNzaW5nQ29uZmlnTmFtZScsIFwiVmFyaWFibGUgezB9IGNhbiBub3QgYmUgcmVzb2x2ZWQgYmVjYXVzZSBubyBzZXR0aW5ncyBuYW1lIGlzIGdpdmVuLlwiLCByZXBsYWNlbWVudC5pZCkpO1xuXG5cdFx0XHRjYXNlICdjb21tYW5kJzpcblx0XHRcdFx0cmV0dXJuIHRoaXMucmVzb2x2ZUZyb21NYXAoVmFyaWFibGVLaW5kLkNvbW1hbmQsIHJlcGxhY2VtZW50LmlkLCBhcmd1bWVudCwgY29tbWFuZFZhbHVlTWFwcGluZywgJ2NvbW1hbmQnKTtcblxuXHRcdFx0Y2FzZSAnaW5wdXQnOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5yZXNvbHZlRnJvbU1hcChWYXJpYWJsZUtpbmQuSW5wdXQsIHJlcGxhY2VtZW50LmlkLCBhcmd1bWVudCwgY29tbWFuZFZhbHVlTWFwcGluZywgJ2lucHV0Jyk7XG5cblx0XHRcdGNhc2UgJ2V4dGVuc2lvbkluc3RhbGxGb2xkZXInOlxuXHRcdFx0XHRpZiAoYXJndW1lbnQpIHtcblx0XHRcdFx0XHRjb25zdCBleHQgPSBhd2FpdCB0aGlzLl9jb250ZXh0LmdldEV4dGVuc2lvbihhcmd1bWVudCk7XG5cdFx0XHRcdFx0aWYgKCFleHQpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBWYXJpYWJsZUVycm9yKFZhcmlhYmxlS2luZC5FeHRlbnNpb25JbnN0YWxsRm9sZGVyLCBsb2NhbGl6ZSgnZXh0ZW5zaW9uTm90SW5zdGFsbGVkJywgXCJWYXJpYWJsZSB7MH0gY2FuIG5vdCBiZSByZXNvbHZlZCBiZWNhdXNlIHRoZSBleHRlbnNpb24gezF9IGlzIG5vdCBpbnN0YWxsZWQuXCIsIHJlcGxhY2VtZW50LmlkLCBhcmd1bWVudCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5mc1BhdGgoZXh0LmV4dGVuc2lvbkxvY2F0aW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aHJvdyBuZXcgVmFyaWFibGVFcnJvcihWYXJpYWJsZUtpbmQuRXh0ZW5zaW9uSW5zdGFsbEZvbGRlciwgbG9jYWxpemUoJ21pc3NpbmdFeHRlbnNpb25OYW1lJywgXCJWYXJpYWJsZSB7MH0gY2FuIG5vdCBiZSByZXNvbHZlZCBiZWNhdXNlIG5vIGV4dGVuc2lvbiBuYW1lIGlzIGdpdmVuLlwiLCByZXBsYWNlbWVudC5pZCkpO1xuXG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdHN3aXRjaCAodmFyaWFibGUpIHtcblx0XHRcdFx0XHRjYXNlICd3b3Jrc3BhY2VSb290Jzpcblx0XHRcdFx0XHRjYXNlICd3b3Jrc3BhY2VGb2xkZXInOiB7XG5cdFx0XHRcdFx0XHRjb25zdCB1cmkgPSBnZXRGb2xkZXJVcmkoVmFyaWFibGVLaW5kLldvcmtzcGFjZUZvbGRlcik7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdXJpID8gbm9ybWFsaXplRHJpdmVMZXR0ZXIodGhpcy5mc1BhdGgodXJpKSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y2FzZSAnY3dkJzoge1xuXHRcdFx0XHRcdFx0aWYgKCFmb2xkZXJVcmkgJiYgIWFyZ3VtZW50KSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBwcm9jZXNzLmN3ZCgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y29uc3QgdXJpID0gZ2V0Rm9sZGVyVXJpKFZhcmlhYmxlS2luZC5Dd2QpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVyaSA/IG5vcm1hbGl6ZURyaXZlTGV0dGVyKHRoaXMuZnNQYXRoKHVyaSkpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNhc2UgJ3dvcmtzcGFjZVJvb3RGb2xkZXJOYW1lJzpcblx0XHRcdFx0XHRjYXNlICd3b3Jrc3BhY2VGb2xkZXJCYXNlbmFtZSc6IHtcblx0XHRcdFx0XHRcdGNvbnN0IHVyaSA9IGdldEZvbGRlclVyaShWYXJpYWJsZUtpbmQuV29ya3NwYWNlRm9sZGVyQmFzZW5hbWUpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVyaSA/IG5vcm1hbGl6ZURyaXZlTGV0dGVyKHBhdGhzLmJhc2VuYW1lKHRoaXMuZnNQYXRoKHVyaSkpKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjYXNlICd1c2VySG9tZSc6XG5cdFx0XHRcdFx0XHRpZiAoZW52aXJvbm1lbnQudXNlckhvbWUpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGVudmlyb25tZW50LnVzZXJIb21lO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IFZhcmlhYmxlRXJyb3IoVmFyaWFibGVLaW5kLlVzZXJIb21lLCBsb2NhbGl6ZSgnY2FuTm90UmVzb2x2ZVVzZXJIb21lJywgXCJWYXJpYWJsZSB7MH0gY2FuIG5vdCBiZSByZXNvbHZlZC4gVXNlckhvbWUgcGF0aCBpcyBub3QgZGVmaW5lZFwiLCByZXBsYWNlbWVudC5pZCkpO1xuXG5cdFx0XHRcdFx0Y2FzZSAnbGluZU51bWJlcic6IHtcblx0XHRcdFx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSB0aGlzLl9jb250ZXh0LmdldExpbmVOdW1iZXIoKTtcblx0XHRcdFx0XHRcdGlmIChsaW5lTnVtYmVyKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBsaW5lTnVtYmVyO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IFZhcmlhYmxlRXJyb3IoVmFyaWFibGVLaW5kLkxpbmVOdW1iZXIsIGxvY2FsaXplKCdjYW5Ob3RSZXNvbHZlTGluZU51bWJlcicsIFwiVmFyaWFibGUgezB9IGNhbiBub3QgYmUgcmVzb2x2ZWQuIE1ha2Ugc3VyZSB0byBoYXZlIGEgbGluZSBzZWxlY3RlZCBpbiB0aGUgYWN0aXZlIGVkaXRvci5cIiwgcmVwbGFjZW1lbnQuaWQpKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjYXNlICdjb2x1bW5OdW1iZXInOiB7XG5cdFx0XHRcdFx0XHRjb25zdCBjb2x1bW5OdW1iZXIgPSB0aGlzLl9jb250ZXh0LmdldENvbHVtbk51bWJlcigpO1xuXHRcdFx0XHRcdFx0aWYgKGNvbHVtbk51bWJlcikge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gY29sdW1uTnVtYmVyO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdjYW5Ob3RSZXNvbHZlQ29sdW1uTnVtYmVyJywgXCJWYXJpYWJsZSB7MH0gY2FuIG5vdCBiZSByZXNvbHZlZC4gTWFrZSBzdXJlIHRvIGhhdmUgYSBjb2x1bW4gc2VsZWN0ZWQgaW4gdGhlIGFjdGl2ZSBlZGl0b3IuXCIsIHJlcGxhY2VtZW50LmlkKSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y2FzZSAnc2VsZWN0ZWRUZXh0Jzoge1xuXHRcdFx0XHRcdFx0Y29uc3Qgc2VsZWN0ZWRUZXh0ID0gdGhpcy5fY29udGV4dC5nZXRTZWxlY3RlZFRleHQoKTtcblx0XHRcdFx0XHRcdGlmIChzZWxlY3RlZFRleHQpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHNlbGVjdGVkVGV4dDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRocm93IG5ldyBWYXJpYWJsZUVycm9yKFZhcmlhYmxlS2luZC5TZWxlY3RlZFRleHQsIGxvY2FsaXplKCdjYW5Ob3RSZXNvbHZlU2VsZWN0ZWRUZXh0JywgXCJWYXJpYWJsZSB7MH0gY2FuIG5vdCBiZSByZXNvbHZlZC4gTWFrZSBzdXJlIHRvIGhhdmUgc29tZSB0ZXh0IHNlbGVjdGVkIGluIHRoZSBhY3RpdmUgZWRpdG9yLlwiLCByZXBsYWNlbWVudC5pZCkpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNhc2UgJ2ZpbGUnOlxuXHRcdFx0XHRcdFx0cmV0dXJuIGdldEZpbGVQYXRoKFZhcmlhYmxlS2luZC5GaWxlKTtcblxuXHRcdFx0XHRcdGNhc2UgJ2ZpbGVXb3Jrc3BhY2VGb2xkZXInOlxuXHRcdFx0XHRcdFx0cmV0dXJuIGdldEZvbGRlclBhdGhGb3JGaWxlKFZhcmlhYmxlS2luZC5GaWxlV29ya3NwYWNlRm9sZGVyKTtcblxuXHRcdFx0XHRcdGNhc2UgJ2ZpbGVXb3Jrc3BhY2VGb2xkZXJCYXNlbmFtZSc6XG5cdFx0XHRcdFx0XHRyZXR1cm4gcGF0aHMuYmFzZW5hbWUoZ2V0Rm9sZGVyUGF0aEZvckZpbGUoVmFyaWFibGVLaW5kLkZpbGVXb3Jrc3BhY2VGb2xkZXJCYXNlbmFtZSkpO1xuXG5cdFx0XHRcdFx0Y2FzZSAncmVsYXRpdmVGaWxlJzpcblx0XHRcdFx0XHRcdGlmIChmb2xkZXJVcmkgfHwgYXJndW1lbnQpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHBhdGhzLnJlbGF0aXZlKHRoaXMuZnNQYXRoKGdldEZvbGRlclVyaShWYXJpYWJsZUtpbmQuUmVsYXRpdmVGaWxlKSksIGdldEZpbGVQYXRoKFZhcmlhYmxlS2luZC5SZWxhdGl2ZUZpbGUpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiBnZXRGaWxlUGF0aChWYXJpYWJsZUtpbmQuUmVsYXRpdmVGaWxlKTtcblxuXHRcdFx0XHRcdGNhc2UgJ3JlbGF0aXZlRmlsZURpcm5hbWUnOiB7XG5cdFx0XHRcdFx0XHRjb25zdCBkaXJuYW1lID0gcGF0aHMuZGlybmFtZShnZXRGaWxlUGF0aChWYXJpYWJsZUtpbmQuUmVsYXRpdmVGaWxlRGlybmFtZSkpO1xuXHRcdFx0XHRcdFx0aWYgKGZvbGRlclVyaSB8fCBhcmd1bWVudCkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCByZWxhdGl2ZSA9IHBhdGhzLnJlbGF0aXZlKHRoaXMuZnNQYXRoKGdldEZvbGRlclVyaShWYXJpYWJsZUtpbmQuUmVsYXRpdmVGaWxlRGlybmFtZSkpLCBkaXJuYW1lKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHJlbGF0aXZlLmxlbmd0aCA9PT0gMCA/ICcuJyA6IHJlbGF0aXZlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIGRpcm5hbWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y2FzZSAnZmlsZURpcm5hbWUnOlxuXHRcdFx0XHRcdFx0cmV0dXJuIHBhdGhzLmRpcm5hbWUoZ2V0RmlsZVBhdGgoVmFyaWFibGVLaW5kLkZpbGVEaXJuYW1lKSk7XG5cblx0XHRcdFx0XHRjYXNlICdmaWxlRXh0bmFtZSc6XG5cdFx0XHRcdFx0XHRyZXR1cm4gcGF0aHMuZXh0bmFtZShnZXRGaWxlUGF0aChWYXJpYWJsZUtpbmQuRmlsZUV4dG5hbWUpKTtcblxuXHRcdFx0XHRcdGNhc2UgJ2ZpbGVCYXNlbmFtZSc6XG5cdFx0XHRcdFx0XHRyZXR1cm4gcGF0aHMuYmFzZW5hbWUoZ2V0RmlsZVBhdGgoVmFyaWFibGVLaW5kLkZpbGVCYXNlbmFtZSkpO1xuXG5cdFx0XHRcdFx0Y2FzZSAnZmlsZUJhc2VuYW1lTm9FeHRlbnNpb24nOiB7XG5cdFx0XHRcdFx0XHRjb25zdCBiYXNlbmFtZSA9IHBhdGhzLmJhc2VuYW1lKGdldEZpbGVQYXRoKFZhcmlhYmxlS2luZC5GaWxlQmFzZW5hbWVOb0V4dGVuc2lvbikpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIChiYXNlbmFtZS5zbGljZSgwLCBiYXNlbmFtZS5sZW5ndGggLSBwYXRocy5leHRuYW1lKGJhc2VuYW1lKS5sZW5ndGgpKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjYXNlICdmaWxlRGlybmFtZUJhc2VuYW1lJzpcblx0XHRcdFx0XHRcdHJldHVybiBwYXRocy5iYXNlbmFtZShwYXRocy5kaXJuYW1lKGdldEZpbGVQYXRoKFZhcmlhYmxlS2luZC5GaWxlRGlybmFtZUJhc2VuYW1lKSkpO1xuXG5cdFx0XHRcdFx0Y2FzZSAnZXhlY1BhdGgnOiB7XG5cdFx0XHRcdFx0XHRjb25zdCBlcCA9IHRoaXMuX2NvbnRleHQuZ2V0RXhlY1BhdGgoKTtcblx0XHRcdFx0XHRcdGlmIChlcCkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZXA7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gcmVwbGFjZW1lbnQuaWQ7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y2FzZSAnZXhlY0luc3RhbGxGb2xkZXInOiB7XG5cdFx0XHRcdFx0XHRjb25zdCBhciA9IHRoaXMuX2NvbnRleHQuZ2V0QXBwUm9vdCgpO1xuXHRcdFx0XHRcdFx0aWYgKGFyKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBhcjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiByZXBsYWNlbWVudC5pZDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjYXNlICdwYXRoU2VwYXJhdG9yJzpcblx0XHRcdFx0XHRjYXNlICcvJzpcblx0XHRcdFx0XHRcdHJldHVybiBwYXRocy5zZXA7XG5cblx0XHRcdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5yZXNvbHZlRnJvbU1hcChWYXJpYWJsZUtpbmQuVW5rbm93biwgcmVwbGFjZW1lbnQuaWQsIGFyZ3VtZW50LCBjb21tYW5kVmFsdWVNYXBwaW5nLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiByZXBsYWNlbWVudC5pZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlc29sdmVGcm9tTWFwKHZhcmlhYmxlS2luZDogVmFyaWFibGVLaW5kLCBtYXRjaDogc3RyaW5nLCBhcmd1bWVudDogc3RyaW5nIHwgdW5kZWZpbmVkLCBjb21tYW5kVmFsdWVNYXBwaW5nOiBJU3RyaW5nRGljdGlvbmFyeTxJUmVzb2x2ZWRWYWx1ZT4gfCB1bmRlZmluZWQsIHByZWZpeDogc3RyaW5nIHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcblx0XHRpZiAoYXJndW1lbnQgJiYgY29tbWFuZFZhbHVlTWFwcGluZykge1xuXHRcdFx0Y29uc3QgdiA9IChwcmVmaXggPT09IHVuZGVmaW5lZCkgPyBjb21tYW5kVmFsdWVNYXBwaW5nW2FyZ3VtZW50XSA6IGNvbW1hbmRWYWx1ZU1hcHBpbmdbcHJlZml4ICsgJzonICsgYXJndW1lbnRdO1xuXHRcdFx0aWYgKHR5cGVvZiB2ID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRyZXR1cm4gdjtcblx0XHRcdH1cblx0XHRcdHRocm93IG5ldyBWYXJpYWJsZUVycm9yKHZhcmlhYmxlS2luZCwgbG9jYWxpemUoJ25vVmFsdWVGb3JDb21tYW5kJywgXCJWYXJpYWJsZSB7MH0gY2FuIG5vdCBiZSByZXNvbHZlZCBiZWNhdXNlIHRoZSBjb21tYW5kIGhhcyBubyB2YWx1ZS5cIiwgbWF0Y2gpKTtcblx0XHR9XG5cdFx0cmV0dXJuIG1hdGNoO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLDRCQUE0QjtBQUNyQyxZQUFZLFdBQVc7QUFDdkIsU0FBOEIsaUJBQWlCO0FBQy9DLFlBQVksYUFBYTtBQUN6QixZQUFZLFdBQVc7QUFFdkIsU0FBUyxnQkFBZ0I7QUFHekIsU0FBUyxrQkFBaUQsZUFBZSxvQkFBb0I7QUFDN0YsU0FBUyx1Q0FBb0U7QUFrQnRFLE1BQWUsZ0NBQXlFO0FBQUEsRUFZOUYsWUFBWSxVQUFtQyxlQUErQixrQkFBb0Msc0JBQXFEO0FBSnZLLFNBQVUsd0JBQXdF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
