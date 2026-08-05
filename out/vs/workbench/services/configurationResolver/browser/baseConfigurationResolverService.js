import { Queue } from "../../../../base/common/async.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { LRUCache } from "../../../../base/common/map.js";
import { Schemas } from "../../../../base/common/network.js";
import * as Types from "../../../../base/common/types.js";
import { isCodeEditor, isDiffEditor } from "../../../../editor/browser/editorBrowser.js";
import { localize } from "../../../../nls.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../common/editor.js";
import { VariableError, VariableKind } from "../common/configurationResolver.js";
import { ConfigurationResolverExpression } from "../common/configurationResolverExpression.js";
import { AbstractVariableResolverService } from "../common/variableResolver.js";
const LAST_INPUT_STORAGE_KEY = "configResolveInputLru";
const LAST_INPUT_CACHE_SIZE = 5;
class BaseConfigurationResolverService extends AbstractVariableResolverService {
  constructor(context, envVariablesPromise, editorService, configurationService, commandService, workspaceContextService, quickInputService, labelService, pathService, extensionService, storageService) {
    super({
      getFolderUri: (folderName) => {
        const folder = workspaceContextService.getWorkspace().folders.filter((f) => f.name === folderName).pop();
        return folder ? folder.uri : void 0;
      },
      getWorkspaceFolderCount: () => {
        return workspaceContextService.getWorkspace().folders.length;
      },
      getConfigurationValue: (folderUri, section) => {
        return configurationService.getValue(section, folderUri ? { resource: folderUri } : {});
      },
      getAppRoot: () => {
        return context.getAppRoot();
      },
      getExecPath: () => {
        return context.getExecPath();
      },
      getFilePath: () => {
        const fileResource = EditorResourceAccessor.getOriginalUri(editorService.activeEditor, {
          supportSideBySide: SideBySideEditor.PRIMARY,
          filterByScheme: [Schemas.file, Schemas.vscodeUserData, this.pathService.defaultUriScheme]
        });
        if (!fileResource) {
          return void 0;
        }
        return this.labelService.getUriLabel(fileResource, { noPrefix: true });
      },
      getWorkspaceFolderPathForFile: () => {
        const fileResource = EditorResourceAccessor.getOriginalUri(editorService.activeEditor, {
          supportSideBySide: SideBySideEditor.PRIMARY,
          filterByScheme: [Schemas.file, Schemas.vscodeUserData, this.pathService.defaultUriScheme]
        });
        if (!fileResource) {
          return void 0;
        }
        const wsFolder = workspaceContextService.getWorkspaceFolder(fileResource);
        if (!wsFolder) {
          return void 0;
        }
        return this.labelService.getUriLabel(wsFolder.uri, { noPrefix: true });
      },
      getSelectedText: () => {
        const activeTextEditorControl = editorService.activeTextEditorControl;
        let activeControl = null;
        if (isCodeEditor(activeTextEditorControl)) {
          activeControl = activeTextEditorControl;
        } else if (isDiffEditor(activeTextEditorControl)) {
          const original = activeTextEditorControl.getOriginalEditor();
          const modified = activeTextEditorControl.getModifiedEditor();
          activeControl = original.hasWidgetFocus() ? original : modified;
        }
        const activeModel = activeControl?.getModel();
        const activeSelection = activeControl?.getSelection();
        if (activeModel && activeSelection) {
          return activeModel.getValueInRange(activeSelection);
        }
        return void 0;
      },
      getLineNumber: () => {
        const activeTextEditorControl = editorService.activeTextEditorControl;
        if (isCodeEditor(activeTextEditorControl)) {
          const selection = activeTextEditorControl.getSelection();
          if (selection) {
            const lineNumber = selection.positionLineNumber;
            return String(lineNumber);
          }
        }
        return void 0;
      },
      getColumnNumber: () => {
        const activeTextEditorControl = editorService.activeTextEditorControl;
        if (isCodeEditor(activeTextEditorControl)) {
          const selection = activeTextEditorControl.getSelection();
          if (selection) {
            const columnNumber = selection.positionColumn;
            return String(columnNumber);
          }
        }
        return void 0;
      },
      getExtension: (id) => {
        return extensionService.getExtension(id);
      }
    }, labelService, pathService.userHome().then((home) => home.path), envVariablesPromise);
    this.configurationService = configurationService;
    this.commandService = commandService;
    this.workspaceContextService = workspaceContextService;
    this.quickInputService = quickInputService;
    this.labelService = labelService;
    this.pathService = pathService;
    this.storageService = storageService;
    this.userInputAccessQueue = new Queue();
    this.resolvableVariables.add("command");
    this.resolvableVariables.add("input");
  }
  async resolveWithInteractionReplace(folder, config, section, variables, target) {
    config = await this.resolveAsync(folder, config);
    const parsed = ConfigurationResolverExpression.parse(config);
    await this.resolveWithInteraction(folder, parsed, section, variables, target);
    return parsed.toObject();
  }
  async resolveWithInteraction(folder, config, section, variableToCommandMap, target) {
    const expr = ConfigurationResolverExpression.parse(config);
    for (const variable of expr.unresolved()) {
      let result;
      if (variable.name === "command") {
        const commandId = (variableToCommandMap ? variableToCommandMap[variable.arg] : void 0) || variable.arg;
        const value = await this.commandService.executeCommand(commandId, expr.toObject());
        if (!Types.isUndefinedOrNull(value)) {
          if (typeof value !== "string") {
            throw new VariableError(VariableKind.Command, localize("commandVariable.noStringType", "Cannot substitute command variable '{0}' because command did not return a result of type string.", commandId));
          }
          result = { value };
        }
      } else if (variable.name === "input") {
        result = await this.showUserInput(section, variable.arg, await this.resolveInputs(folder, section, target), variableToCommandMap);
      } else if (this._contributedVariables.has(variable.inner)) {
        result = { value: await this._contributedVariables.get(variable.inner)() };
      } else {
        continue;
      }
      if (result === void 0) {
        return void 0;
      }
      expr.resolve(variable, result);
    }
    return new Map(Iterable.map(expr.resolved(), ([key, value]) => [key.inner, value.value]));
  }
  async resolveInputs(folder, section, target) {
    if (this.workspaceContextService.getWorkbenchState() === WorkbenchState.EMPTY || !section) {
      return void 0;
    }
    let inputs;
    const overrides = folder ? { resource: folder.uri } : {};
    const result = this.configurationService.inspect(section, overrides);
    if (result) {
      switch (target) {
        case ConfigurationTarget.MEMORY:
          inputs = result.memoryValue?.inputs;
          break;
        case ConfigurationTarget.DEFAULT:
          inputs = result.defaultValue?.inputs;
          break;
        case ConfigurationTarget.USER:
          inputs = result.userValue?.inputs;
          break;
        case ConfigurationTarget.USER_LOCAL:
          inputs = result.userLocalValue?.inputs;
          break;
        case ConfigurationTarget.USER_REMOTE:
          inputs = result.userRemoteValue?.inputs;
          break;
        case ConfigurationTarget.APPLICATION:
          inputs = result.applicationValue?.inputs;
          break;
        case ConfigurationTarget.WORKSPACE:
          inputs = result.workspaceValue?.inputs;
          break;
        case ConfigurationTarget.WORKSPACE_FOLDER:
        default:
          inputs = result.workspaceFolderValue?.inputs;
          break;
      }
    }
    inputs ??= this.configurationService.getValue(section, overrides)?.inputs;
    return inputs;
  }
  readInputLru() {
    const contents = this.storageService.get(LAST_INPUT_STORAGE_KEY, StorageScope.WORKSPACE);
    const lru = new LRUCache(LAST_INPUT_CACHE_SIZE);
    try {
      if (contents) {
        lru.fromJSON(JSON.parse(contents));
      }
    } catch {
    }
    return lru;
  }
  storeInputLru(lru) {
    this.storageService.store(LAST_INPUT_STORAGE_KEY, JSON.stringify(lru.toJSON()), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  async showUserInput(section, variable, inputInfos, variableToCommandMap) {
    if (!inputInfos) {
      throw new VariableError(VariableKind.Input, localize("inputVariable.noInputSection", "Variable '{0}' must be defined in an '{1}' section of the debug or task configuration.", variable, "inputs"));
    }
    const info = inputInfos.filter((item) => item.id === variable).pop();
    if (info) {
      const missingAttribute = (attrName) => {
        throw new VariableError(VariableKind.Input, localize("inputVariable.missingAttribute", "Input variable '{0}' is of type '{1}' and must include '{2}'.", variable, info.type, attrName));
      };
      const defaultValueMap = this.readInputLru();
      const defaultValueKey = `${section}.${variable}`;
      const previousPickedValue = defaultValueMap.get(defaultValueKey);
      switch (info.type) {
        case "promptString": {
          if (!Types.isString(info.description)) {
            missingAttribute("description");
          }
          const inputOptions = { prompt: info.description, ignoreFocusLost: true, value: variableToCommandMap?.[`input:${variable}`] ?? previousPickedValue ?? info.default };
          if (info.password) {
            inputOptions.password = info.password;
          }
          return this.userInputAccessQueue.queue(() => this.quickInputService.input(inputOptions)).then((resolvedInput) => {
            if (typeof resolvedInput === "string") {
              this.storeInputLru(defaultValueMap.set(defaultValueKey, resolvedInput));
            }
            return resolvedInput ? { value: resolvedInput, input: info } : void 0;
          });
        }
        case "pickString": {
          if (!Types.isString(info.description)) {
            missingAttribute("description");
          }
          if (Array.isArray(info.options)) {
            for (const pickOption of info.options) {
              if (!Types.isString(pickOption) && !Types.isString(pickOption.value)) {
                missingAttribute("value");
              }
            }
          } else {
            missingAttribute("options");
          }
          const picks = new Array();
          for (const pickOption of info.options) {
            const value = Types.isString(pickOption) ? pickOption : pickOption.value;
            const label = Types.isString(pickOption) ? void 0 : pickOption.label;
            const item = {
              label: label ? `${label}: ${value}` : value,
              value
            };
            const topValue = variableToCommandMap?.[`input:${variable}`] ?? previousPickedValue ?? info.default;
            if (value === info.default) {
              item.description = localize("inputVariable.defaultInputValue", "(Default)");
              picks.unshift(item);
            } else if (value === topValue) {
              picks.unshift(item);
            } else {
              picks.push(item);
            }
          }
          const pickOptions = { placeHolder: info.description, matchOnDetail: true, ignoreFocusLost: true };
          return this.userInputAccessQueue.queue(() => this.quickInputService.pick(picks, pickOptions, void 0)).then((resolvedInput) => {
            if (resolvedInput) {
              const value = resolvedInput.value;
              this.storeInputLru(defaultValueMap.set(defaultValueKey, value));
              return { value, input: info };
            }
            return void 0;
          });
        }
        case "command": {
          if (!Types.isString(info.command)) {
            missingAttribute("command");
          }
          return this.userInputAccessQueue.queue(() => this.commandService.executeCommand(info.command, info.args)).then((result) => {
            if (typeof result === "string" || Types.isUndefinedOrNull(result)) {
              return { value: result, input: info };
            }
            throw new VariableError(VariableKind.Input, localize("inputVariable.command.noStringType", "Cannot substitute input variable '{0}' because command '{1}' did not return a result of type string.", variable, info.command));
          });
        }
        default:
          throw new VariableError(VariableKind.Input, localize("inputVariable.unknownType", "Input variable '{0}' can only be of type 'promptString', 'pickString', or 'command'.", variable));
      }
    }
    throw new VariableError(VariableKind.Input, localize("inputVariable.undefinedVariable", "Undefined input variable '{0}' encountered. Remove or define '{0}' to continue.", variable));
  }
}
BaseConfigurationResolverService.INPUT_OR_COMMAND_VARIABLES_PATTERN = /\${((input|command):(.*?))}/g;
export {
  BaseConfigurationResolverService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvY29uZmlndXJhdGlvblJlc29sdmVyL2Jyb3dzZXIvYmFzZUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuaW1wb3J0IHsgUXVldWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBJU3RyaW5nRGljdGlvbmFyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgTFJVQ2FjaGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSVByb2Nlc3NFbnZpcm9ubWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSBhcyB1cmkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIGlzQ29kZUVkaXRvciwgaXNEaWZmRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCwgSUNvbmZpZ3VyYXRpb25PdmVycmlkZXMsIElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJSW5wdXRPcHRpb25zLCBJUGlja09wdGlvbnMsIElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIElXb3Jrc3BhY2VGb2xkZXJEYXRhLCBXb3JrYmVuY2hTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IEVkaXRvclJlc291cmNlQWNjZXNzb3IsIFNpZGVCeVNpZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJUGF0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wYXRoL2NvbW1vbi9wYXRoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmVkSW5wdXQsIFZhcmlhYmxlRXJyb3IsIFZhcmlhYmxlS2luZCB9IGZyb20gJy4uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbiwgSVJlc29sdmVkVmFsdWUgfSBmcm9tICcuLi9jb21tb24vY29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdFZhcmlhYmxlUmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3ZhcmlhYmxlUmVzb2x2ZXIuanMnO1xuXG5jb25zdCBMQVNUX0lOUFVUX1NUT1JBR0VfS0VZID0gJ2NvbmZpZ1Jlc29sdmVJbnB1dExydSc7XG5jb25zdCBMQVNUX0lOUFVUX0NBQ0hFX1NJWkUgPSA1O1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UgZXh0ZW5kcyBBYnN0cmFjdFZhcmlhYmxlUmVzb2x2ZXJTZXJ2aWNlIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSU5QVVRfT1JfQ09NTUFORF9WQVJJQUJMRVNfUEFUVEVSTiA9IC9cXCR7KChpbnB1dHxjb21tYW5kKTooLio/KSl9L2c7XG5cblx0cHJpdmF0ZSB1c2VySW5wdXRBY2Nlc3NRdWV1ZSA9IG5ldyBRdWV1ZTxzdHJpbmcgfCBJUXVpY2tQaWNrSXRlbSB8IHVuZGVmaW5lZD4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250ZXh0OiB7XG5cdFx0XHRnZXRBcHBSb290OiAoKSA9PiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRnZXRFeGVjUGF0aDogKCkgPT4gc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdH0sXG5cdFx0ZW52VmFyaWFibGVzUHJvbWlzZTogUHJvbWlzZTxJUHJvY2Vzc0Vudmlyb25tZW50Pixcblx0XHRlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBwYXRoU2VydmljZTogSVBhdGhTZXJ2aWNlLFxuXHRcdGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0Z2V0Rm9sZGVyVXJpOiAoZm9sZGVyTmFtZTogc3RyaW5nKTogdXJpIHwgdW5kZWZpbmVkID0+IHtcblx0XHRcdFx0Y29uc3QgZm9sZGVyID0gd29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycy5maWx0ZXIoZiA9PiBmLm5hbWUgPT09IGZvbGRlck5hbWUpLnBvcCgpO1xuXHRcdFx0XHRyZXR1cm4gZm9sZGVyID8gZm9sZGVyLnVyaSA6IHVuZGVmaW5lZDtcblx0XHRcdH0sXG5cdFx0XHRnZXRXb3Jrc3BhY2VGb2xkZXJDb3VudDogKCk6IG51bWJlciA9PiB7XG5cdFx0XHRcdHJldHVybiB3b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzLmxlbmd0aDtcblx0XHRcdH0sXG5cdFx0XHRnZXRDb25maWd1cmF0aW9uVmFsdWU6IChmb2xkZXJVcmk6IHVyaSB8IHVuZGVmaW5lZCwgc2VjdGlvbjogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkID0+IHtcblx0XHRcdFx0cmV0dXJuIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHN0cmluZz4oc2VjdGlvbiwgZm9sZGVyVXJpID8geyByZXNvdXJjZTogZm9sZGVyVXJpIH0gOiB7fSk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0QXBwUm9vdDogKCk6IHN0cmluZyB8IHVuZGVmaW5lZCA9PiB7XG5cdFx0XHRcdHJldHVybiBjb250ZXh0LmdldEFwcFJvb3QoKTtcblx0XHRcdH0sXG5cdFx0XHRnZXRFeGVjUGF0aDogKCk6IHN0cmluZyB8IHVuZGVmaW5lZCA9PiB7XG5cdFx0XHRcdHJldHVybiBjb250ZXh0LmdldEV4ZWNQYXRoKCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0RmlsZVBhdGg6ICgpOiBzdHJpbmcgfCB1bmRlZmluZWQgPT4ge1xuXHRcdFx0XHRjb25zdCBmaWxlUmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yLCB7XG5cdFx0XHRcdFx0c3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuUFJJTUFSWSxcblx0XHRcdFx0XHRmaWx0ZXJCeVNjaGVtZTogW1NjaGVtYXMuZmlsZSwgU2NoZW1hcy52c2NvZGVVc2VyRGF0YSwgdGhpcy5wYXRoU2VydmljZS5kZWZhdWx0VXJpU2NoZW1lXVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKCFmaWxlUmVzb3VyY2UpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChmaWxlUmVzb3VyY2UsIHsgbm9QcmVmaXg6IHRydWUgfSk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0V29ya3NwYWNlRm9sZGVyUGF0aEZvckZpbGU6ICgpOiBzdHJpbmcgfCB1bmRlZmluZWQgPT4ge1xuXHRcdFx0XHRjb25zdCBmaWxlUmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yLCB7XG5cdFx0XHRcdFx0c3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuUFJJTUFSWSxcblx0XHRcdFx0XHRmaWx0ZXJCeVNjaGVtZTogW1NjaGVtYXMuZmlsZSwgU2NoZW1hcy52c2NvZGVVc2VyRGF0YSwgdGhpcy5wYXRoU2VydmljZS5kZWZhdWx0VXJpU2NoZW1lXVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKCFmaWxlUmVzb3VyY2UpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHdzRm9sZGVyID0gd29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlRm9sZGVyKGZpbGVSZXNvdXJjZSk7XG5cdFx0XHRcdGlmICghd3NGb2xkZXIpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbCh3c0ZvbGRlci51cmksIHsgbm9QcmVmaXg6IHRydWUgfSk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0U2VsZWN0ZWRUZXh0OiAoKTogc3RyaW5nIHwgdW5kZWZpbmVkID0+IHtcblx0XHRcdFx0Y29uc3QgYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZVRleHRFZGl0b3JDb250cm9sO1xuXG5cdFx0XHRcdGxldCBhY3RpdmVDb250cm9sOiBJQ29kZUVkaXRvciB8IG51bGwgPSBudWxsO1xuXG5cdFx0XHRcdGlmIChpc0NvZGVFZGl0b3IoYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wpKSB7XG5cdFx0XHRcdFx0YWN0aXZlQ29udHJvbCA9IGFjdGl2ZVRleHRFZGl0b3JDb250cm9sO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGlzRGlmZkVkaXRvcihhY3RpdmVUZXh0RWRpdG9yQ29udHJvbCkpIHtcblx0XHRcdFx0XHRjb25zdCBvcmlnaW5hbCA9IGFjdGl2ZVRleHRFZGl0b3JDb250cm9sLmdldE9yaWdpbmFsRWRpdG9yKCk7XG5cdFx0XHRcdFx0Y29uc3QgbW9kaWZpZWQgPSBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbC5nZXRNb2RpZmllZEVkaXRvcigpO1xuXHRcdFx0XHRcdGFjdGl2ZUNvbnRyb2wgPSBvcmlnaW5hbC5oYXNXaWRnZXRGb2N1cygpID8gb3JpZ2luYWwgOiBtb2RpZmllZDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGFjdGl2ZU1vZGVsID0gYWN0aXZlQ29udHJvbD8uZ2V0TW9kZWwoKTtcblx0XHRcdFx0Y29uc3QgYWN0aXZlU2VsZWN0aW9uID0gYWN0aXZlQ29udHJvbD8uZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRcdGlmIChhY3RpdmVNb2RlbCAmJiBhY3RpdmVTZWxlY3Rpb24pIHtcblx0XHRcdFx0XHRyZXR1cm4gYWN0aXZlTW9kZWwuZ2V0VmFsdWVJblJhbmdlKGFjdGl2ZVNlbGVjdGlvbik7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0sXG5cdFx0XHRnZXRMaW5lTnVtYmVyOiAoKTogc3RyaW5nIHwgdW5kZWZpbmVkID0+IHtcblx0XHRcdFx0Y29uc3QgYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZVRleHRFZGl0b3JDb250cm9sO1xuXHRcdFx0XHRpZiAoaXNDb2RlRWRpdG9yKGFjdGl2ZVRleHRFZGl0b3JDb250cm9sKSkge1xuXHRcdFx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IGFjdGl2ZVRleHRFZGl0b3JDb250cm9sLmdldFNlbGVjdGlvbigpO1xuXHRcdFx0XHRcdGlmIChzZWxlY3Rpb24pIHtcblx0XHRcdFx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBzZWxlY3Rpb24ucG9zaXRpb25MaW5lTnVtYmVyO1xuXHRcdFx0XHRcdFx0cmV0dXJuIFN0cmluZyhsaW5lTnVtYmVyKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0sXG5cdFx0XHRnZXRDb2x1bW5OdW1iZXI6ICgpOiBzdHJpbmcgfCB1bmRlZmluZWQgPT4ge1xuXHRcdFx0XHRjb25zdCBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbCA9IGVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2w7XG5cdFx0XHRcdGlmIChpc0NvZGVFZGl0b3IoYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wpKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRcdFx0aWYgKHNlbGVjdGlvbikge1xuXHRcdFx0XHRcdFx0Y29uc3QgY29sdW1uTnVtYmVyID0gc2VsZWN0aW9uLnBvc2l0aW9uQ29sdW1uO1xuXHRcdFx0XHRcdFx0cmV0dXJuIFN0cmluZyhjb2x1bW5OdW1iZXIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblx0XHRcdGdldEV4dGVuc2lvbjogaWQgPT4ge1xuXHRcdFx0XHRyZXR1cm4gZXh0ZW5zaW9uU2VydmljZS5nZXRFeHRlbnNpb24oaWQpO1xuXHRcdFx0fSxcblx0XHR9LCBsYWJlbFNlcnZpY2UsIHBhdGhTZXJ2aWNlLnVzZXJIb21lKCkudGhlbihob21lID0+IGhvbWUucGF0aCksIGVudlZhcmlhYmxlc1Byb21pc2UpO1xuXG5cdFx0dGhpcy5yZXNvbHZhYmxlVmFyaWFibGVzLmFkZCgnY29tbWFuZCcpO1xuXHRcdHRoaXMucmVzb2x2YWJsZVZhcmlhYmxlcy5hZGQoJ2lucHV0Jyk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyByZXNvbHZlV2l0aEludGVyYWN0aW9uUmVwbGFjZShmb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXJEYXRhIHwgdW5kZWZpbmVkLCBjb25maWc6IGFueSwgc2VjdGlvbj86IHN0cmluZywgdmFyaWFibGVzPzogSVN0cmluZ0RpY3Rpb25hcnk8c3RyaW5nPiwgdGFyZ2V0PzogQ29uZmlndXJhdGlvblRhcmdldCk6IFByb21pc2U8YW55PiB7XG5cdFx0Ly8gRmlyc3QgcmVzb2x2ZSBhbnkgbm9uLWludGVyYWN0aXZlIHZhcmlhYmxlcyBhbmQgYW55IGNvbnRyaWJ1dGVkIHZhcmlhYmxlc1xuXHRcdGNvbmZpZyA9IGF3YWl0IHRoaXMucmVzb2x2ZUFzeW5jKGZvbGRlciwgY29uZmlnKTtcblxuXHRcdC8vIFRoZW4gcmVzb2x2ZSBpbnB1dCB2YXJpYWJsZXMgaW4gdGhlIG9yZGVyIGluIHdoaWNoIHRoZXkgYXJlIGVuY291bnRlcmVkXG5cdFx0Y29uc3QgcGFyc2VkID0gQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5wYXJzZShjb25maWcpO1xuXHRcdGF3YWl0IHRoaXMucmVzb2x2ZVdpdGhJbnRlcmFjdGlvbihmb2xkZXIsIHBhcnNlZCwgc2VjdGlvbiwgdmFyaWFibGVzLCB0YXJnZXQpO1xuXG5cdFx0cmV0dXJuIHBhcnNlZC50b09iamVjdCgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcmVzb2x2ZVdpdGhJbnRlcmFjdGlvbihmb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXJEYXRhIHwgdW5kZWZpbmVkLCBjb25maWc6IGFueSwgc2VjdGlvbj86IHN0cmluZywgdmFyaWFibGVUb0NvbW1hbmRNYXA/OiBJU3RyaW5nRGljdGlvbmFyeTxzdHJpbmc+LCB0YXJnZXQ/OiBDb25maWd1cmF0aW9uVGFyZ2V0KTogUHJvbWlzZTxNYXA8c3RyaW5nLCBzdHJpbmc+IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZXhwciA9IENvbmZpZ3VyYXRpb25SZXNvbHZlckV4cHJlc3Npb24ucGFyc2UoY29uZmlnKTtcblxuXHRcdC8vIEdldCB2YWx1ZXMgZm9yIGlucHV0IHZhcmlhYmxlcyBmcm9tIFVJXG5cdFx0Zm9yIChjb25zdCB2YXJpYWJsZSBvZiBleHByLnVucmVzb2x2ZWQoKSkge1xuXHRcdFx0bGV0IHJlc3VsdDogSVJlc29sdmVkVmFsdWUgfCB1bmRlZmluZWQ7XG5cblx0XHRcdC8vIENvbW1hbmRcblx0XHRcdGlmICh2YXJpYWJsZS5uYW1lID09PSAnY29tbWFuZCcpIHtcblx0XHRcdFx0Y29uc3QgY29tbWFuZElkID0gKHZhcmlhYmxlVG9Db21tYW5kTWFwID8gdmFyaWFibGVUb0NvbW1hbmRNYXBbdmFyaWFibGUuYXJnIV0gOiB1bmRlZmluZWQpIHx8IHZhcmlhYmxlLmFyZyE7XG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChjb21tYW5kSWQsIGV4cHIudG9PYmplY3QoKSk7XG5cdFx0XHRcdGlmICghVHlwZXMuaXNVbmRlZmluZWRPck51bGwodmFsdWUpKSB7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBWYXJpYWJsZUVycm9yKFZhcmlhYmxlS2luZC5Db21tYW5kLCBsb2NhbGl6ZSgnY29tbWFuZFZhcmlhYmxlLm5vU3RyaW5nVHlwZScsIFwiQ2Fubm90IHN1YnN0aXR1dGUgY29tbWFuZCB2YXJpYWJsZSAnezB9JyBiZWNhdXNlIGNvbW1hbmQgZGlkIG5vdCByZXR1cm4gYSByZXN1bHQgb2YgdHlwZSBzdHJpbmcuXCIsIGNvbW1hbmRJZCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXN1bHQgPSB7IHZhbHVlIH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdC8vIElucHV0XG5cdFx0XHRlbHNlIGlmICh2YXJpYWJsZS5uYW1lID09PSAnaW5wdXQnKSB7XG5cdFx0XHRcdHJlc3VsdCA9IGF3YWl0IHRoaXMuc2hvd1VzZXJJbnB1dChzZWN0aW9uISwgdmFyaWFibGUuYXJnISwgYXdhaXQgdGhpcy5yZXNvbHZlSW5wdXRzKGZvbGRlciwgc2VjdGlvbiEsIHRhcmdldCksIHZhcmlhYmxlVG9Db21tYW5kTWFwKTtcblx0XHRcdH1cblx0XHRcdC8vIENvbnRyaWJ1dGVkIHZhcmlhYmxlXG5cdFx0XHRlbHNlIGlmICh0aGlzLl9jb250cmlidXRlZFZhcmlhYmxlcy5oYXModmFyaWFibGUuaW5uZXIpKSB7XG5cdFx0XHRcdHJlc3VsdCA9IHsgdmFsdWU6IGF3YWl0IHRoaXMuX2NvbnRyaWJ1dGVkVmFyaWFibGVzLmdldCh2YXJpYWJsZS5pbm5lcikhKCkgfTtcblx0XHRcdH1cblx0XHRcdC8vIE5vdCBzb21ldGhpbmcgd2UgY2FuIGhhbmRsZVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Ly8gU2tpcCB0aGUgZW50aXJlIGZsb3cgaWYgYW55IGlucHV0IHZhcmlhYmxlIHdhcyBjYW5jZWxlZFxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRleHByLnJlc29sdmUodmFyaWFibGUsIHJlc3VsdCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBNYXAoSXRlcmFibGUubWFwKGV4cHIucmVzb2x2ZWQoKSwgKFtrZXksIHZhbHVlXSkgPT4gW2tleS5pbm5lciwgdmFsdWUudmFsdWUhXSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXNvbHZlSW5wdXRzKGZvbGRlcjogSVdvcmtzcGFjZUZvbGRlckRhdGEgfCB1bmRlZmluZWQsIHNlY3Rpb246IHN0cmluZywgdGFyZ2V0PzogQ29uZmlndXJhdGlvblRhcmdldCk6IFByb21pc2U8Q29uZmlndXJlZElucHV0W10gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAodGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5FTVBUWSB8fCAhc2VjdGlvbikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHQvLyBMb29rIGF0IHdvcmtzcGFjZSBjb25maWd1cmF0aW9uXG5cdFx0bGV0IGlucHV0czogQ29uZmlndXJlZElucHV0W10gfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3Qgb3ZlcnJpZGVzOiBJQ29uZmlndXJhdGlvbk92ZXJyaWRlcyA9IGZvbGRlciA/IHsgcmVzb3VyY2U6IGZvbGRlci51cmkgfSA6IHt9O1xuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuaW5zcGVjdDx7IGlucHV0cz86IENvbmZpZ3VyZWRJbnB1dFtdIH0+KHNlY3Rpb24sIG92ZXJyaWRlcyk7XG5cblx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRzd2l0Y2ggKHRhcmdldCkge1xuXHRcdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25UYXJnZXQuTUVNT1JZOiBpbnB1dHMgPSByZXN1bHQubWVtb3J5VmFsdWU/LmlucHV0czsgYnJlYWs7XG5cdFx0XHRcdGNhc2UgQ29uZmlndXJhdGlvblRhcmdldC5ERUZBVUxUOiBpbnB1dHMgPSByZXN1bHQuZGVmYXVsdFZhbHVlPy5pbnB1dHM7IGJyZWFrO1xuXHRcdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUjogaW5wdXRzID0gcmVzdWx0LnVzZXJWYWx1ZT8uaW5wdXRzOyBicmVhaztcblx0XHRcdFx0Y2FzZSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUw6IGlucHV0cyA9IHJlc3VsdC51c2VyTG9jYWxWYWx1ZT8uaW5wdXRzOyBicmVhaztcblx0XHRcdFx0Y2FzZSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfUkVNT1RFOiBpbnB1dHMgPSByZXN1bHQudXNlclJlbW90ZVZhbHVlPy5pbnB1dHM7IGJyZWFrO1xuXHRcdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25UYXJnZXQuQVBQTElDQVRJT046IGlucHV0cyA9IHJlc3VsdC5hcHBsaWNhdGlvblZhbHVlPy5pbnB1dHM7IGJyZWFrO1xuXHRcdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFOiBpbnB1dHMgPSByZXN1bHQud29ya3NwYWNlVmFsdWU/LmlucHV0czsgYnJlYWs7XG5cblx0XHRcdFx0Y2FzZSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVI6XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0aW5wdXRzID0gcmVzdWx0LndvcmtzcGFjZUZvbGRlclZhbHVlPy5pbnB1dHM7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cblx0XHRpbnB1dHMgPz89IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8YW55PihzZWN0aW9uLCBvdmVycmlkZXMpPy5pbnB1dHM7XG5cblx0XHRyZXR1cm4gaW5wdXRzO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkSW5wdXRMcnUoKTogTFJVQ2FjaGU8c3RyaW5nLCBzdHJpbmc+IHtcblx0XHRjb25zdCBjb250ZW50cyA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KExBU1RfSU5QVVRfU1RPUkFHRV9LRVksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpO1xuXHRcdGNvbnN0IGxydSA9IG5ldyBMUlVDYWNoZTxzdHJpbmcsIHN0cmluZz4oTEFTVF9JTlBVVF9DQUNIRV9TSVpFKTtcblx0XHR0cnkge1xuXHRcdFx0aWYgKGNvbnRlbnRzKSB7XG5cdFx0XHRcdGxydS5mcm9tSlNPTihKU09OLnBhcnNlKGNvbnRlbnRzKSk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHQvLyBpZ25vcmVkXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxydTtcblx0fVxuXG5cdHByaXZhdGUgc3RvcmVJbnB1dExydShscnU6IExSVUNhY2hlPHN0cmluZywgc3RyaW5nPik6IHZvaWQge1xuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoTEFTVF9JTlBVVF9TVE9SQUdFX0tFWSwgSlNPTi5zdHJpbmdpZnkobHJ1LnRvSlNPTigpKSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2hvd1VzZXJJbnB1dChzZWN0aW9uOiBzdHJpbmcsIHZhcmlhYmxlOiBzdHJpbmcsIGlucHV0SW5mb3M6IENvbmZpZ3VyZWRJbnB1dFtdIHwgdW5kZWZpbmVkLCB2YXJpYWJsZVRvQ29tbWFuZE1hcD86IElTdHJpbmdEaWN0aW9uYXJ5PHN0cmluZz4pOiBQcm9taXNlPElSZXNvbHZlZFZhbHVlIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCFpbnB1dEluZm9zKSB7XG5cdFx0XHR0aHJvdyBuZXcgVmFyaWFibGVFcnJvcihWYXJpYWJsZUtpbmQuSW5wdXQsIGxvY2FsaXplKCdpbnB1dFZhcmlhYmxlLm5vSW5wdXRTZWN0aW9uJywgXCJWYXJpYWJsZSAnezB9JyBtdXN0IGJlIGRlZmluZWQgaW4gYW4gJ3sxfScgc2VjdGlvbiBvZiB0aGUgZGVidWcgb3IgdGFzayBjb25maWd1cmF0aW9uLlwiLCB2YXJpYWJsZSwgJ2lucHV0cycpKTtcblx0XHR9XG5cblx0XHQvLyBGaW5kIGluZm8gZm9yIHRoZSBnaXZlbiBpbnB1dCB2YXJpYWJsZVxuXHRcdGNvbnN0IGluZm8gPSBpbnB1dEluZm9zLmZpbHRlcihpdGVtID0+IGl0ZW0uaWQgPT09IHZhcmlhYmxlKS5wb3AoKTtcblx0XHRpZiAoaW5mbykge1xuXHRcdFx0Y29uc3QgbWlzc2luZ0F0dHJpYnV0ZSA9IChhdHRyTmFtZTogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdHRocm93IG5ldyBWYXJpYWJsZUVycm9yKFZhcmlhYmxlS2luZC5JbnB1dCwgbG9jYWxpemUoJ2lucHV0VmFyaWFibGUubWlzc2luZ0F0dHJpYnV0ZScsIFwiSW5wdXQgdmFyaWFibGUgJ3swfScgaXMgb2YgdHlwZSAnezF9JyBhbmQgbXVzdCBpbmNsdWRlICd7Mn0nLlwiLCB2YXJpYWJsZSwgaW5mby50eXBlLCBhdHRyTmFtZSkpO1xuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgZGVmYXVsdFZhbHVlTWFwID0gdGhpcy5yZWFkSW5wdXRMcnUoKTtcblx0XHRcdGNvbnN0IGRlZmF1bHRWYWx1ZUtleSA9IGAke3NlY3Rpb259LiR7dmFyaWFibGV9YDtcblx0XHRcdGNvbnN0IHByZXZpb3VzUGlja2VkVmFsdWUgPSBkZWZhdWx0VmFsdWVNYXAuZ2V0KGRlZmF1bHRWYWx1ZUtleSk7XG5cblx0XHRcdHN3aXRjaCAoaW5mby50eXBlKSB7XG5cdFx0XHRcdGNhc2UgJ3Byb21wdFN0cmluZyc6IHtcblx0XHRcdFx0XHRpZiAoIVR5cGVzLmlzU3RyaW5nKGluZm8uZGVzY3JpcHRpb24pKSB7XG5cdFx0XHRcdFx0XHRtaXNzaW5nQXR0cmlidXRlKCdkZXNjcmlwdGlvbicpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCBpbnB1dE9wdGlvbnM6IElJbnB1dE9wdGlvbnMgPSB7IHByb21wdDogaW5mby5kZXNjcmlwdGlvbiwgaWdub3JlRm9jdXNMb3N0OiB0cnVlLCB2YWx1ZTogdmFyaWFibGVUb0NvbW1hbmRNYXA/LltgaW5wdXQ6JHt2YXJpYWJsZX1gXSA/PyBwcmV2aW91c1BpY2tlZFZhbHVlID8/IGluZm8uZGVmYXVsdCB9O1xuXHRcdFx0XHRcdGlmIChpbmZvLnBhc3N3b3JkKSB7XG5cdFx0XHRcdFx0XHRpbnB1dE9wdGlvbnMucGFzc3dvcmQgPSBpbmZvLnBhc3N3b3JkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdGhpcy51c2VySW5wdXRBY2Nlc3NRdWV1ZS5xdWV1ZSgoKSA9PiB0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLmlucHV0KGlucHV0T3B0aW9ucykpLnRoZW4ocmVzb2x2ZWRJbnB1dCA9PiB7XG5cdFx0XHRcdFx0XHRpZiAodHlwZW9mIHJlc29sdmVkSW5wdXQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuc3RvcmVJbnB1dExydShkZWZhdWx0VmFsdWVNYXAuc2V0KGRlZmF1bHRWYWx1ZUtleSwgcmVzb2x2ZWRJbnB1dCkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIHJlc29sdmVkSW5wdXQgPyB7IHZhbHVlOiByZXNvbHZlZElucHV0IGFzIHN0cmluZywgaW5wdXQ6IGluZm8gfSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNhc2UgJ3BpY2tTdHJpbmcnOiB7XG5cdFx0XHRcdFx0aWYgKCFUeXBlcy5pc1N0cmluZyhpbmZvLmRlc2NyaXB0aW9uKSkge1xuXHRcdFx0XHRcdFx0bWlzc2luZ0F0dHJpYnV0ZSgnZGVzY3JpcHRpb24nKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKEFycmF5LmlzQXJyYXkoaW5mby5vcHRpb25zKSkge1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBwaWNrT3B0aW9uIG9mIGluZm8ub3B0aW9ucykge1xuXHRcdFx0XHRcdFx0XHRpZiAoIVR5cGVzLmlzU3RyaW5nKHBpY2tPcHRpb24pICYmICFUeXBlcy5pc1N0cmluZyhwaWNrT3B0aW9uLnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0XHRcdG1pc3NpbmdBdHRyaWJ1dGUoJ3ZhbHVlJyk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0bWlzc2luZ0F0dHJpYnV0ZSgnb3B0aW9ucycpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGludGVyZmFjZSBQaWNrU3RyaW5nSXRlbSBleHRlbmRzIElRdWlja1BpY2tJdGVtIHtcblx0XHRcdFx0XHRcdHZhbHVlOiBzdHJpbmc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHBpY2tzID0gbmV3IEFycmF5PFBpY2tTdHJpbmdJdGVtPigpO1xuXHRcdFx0XHRcdGZvciAoY29uc3QgcGlja09wdGlvbiBvZiBpbmZvLm9wdGlvbnMpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHZhbHVlID0gVHlwZXMuaXNTdHJpbmcocGlja09wdGlvbikgPyBwaWNrT3B0aW9uIDogcGlja09wdGlvbi52YWx1ZTtcblx0XHRcdFx0XHRcdGNvbnN0IGxhYmVsID0gVHlwZXMuaXNTdHJpbmcocGlja09wdGlvbikgPyB1bmRlZmluZWQgOiBwaWNrT3B0aW9uLmxhYmVsO1xuXG5cdFx0XHRcdFx0XHRjb25zdCBpdGVtOiBQaWNrU3RyaW5nSXRlbSA9IHtcblx0XHRcdFx0XHRcdFx0bGFiZWw6IGxhYmVsID8gYCR7bGFiZWx9OiAke3ZhbHVlfWAgOiB2YWx1ZSxcblx0XHRcdFx0XHRcdFx0dmFsdWU6IHZhbHVlXG5cdFx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0XHRjb25zdCB0b3BWYWx1ZSA9IHZhcmlhYmxlVG9Db21tYW5kTWFwPy5bYGlucHV0OiR7dmFyaWFibGV9YF0gPz8gcHJldmlvdXNQaWNrZWRWYWx1ZSA/PyBpbmZvLmRlZmF1bHQ7XG5cdFx0XHRcdFx0XHRpZiAodmFsdWUgPT09IGluZm8uZGVmYXVsdCkge1xuXHRcdFx0XHRcdFx0XHRpdGVtLmRlc2NyaXB0aW9uID0gbG9jYWxpemUoJ2lucHV0VmFyaWFibGUuZGVmYXVsdElucHV0VmFsdWUnLCBcIihEZWZhdWx0KVwiKTtcblx0XHRcdFx0XHRcdFx0cGlja3MudW5zaGlmdChpdGVtKTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAodmFsdWUgPT09IHRvcFZhbHVlKSB7XG5cdFx0XHRcdFx0XHRcdHBpY2tzLnVuc2hpZnQoaXRlbSk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRwaWNrcy5wdXNoKGl0ZW0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IHBpY2tPcHRpb25zOiBJUGlja09wdGlvbnM8UGlja1N0cmluZ0l0ZW0+ID0geyBwbGFjZUhvbGRlcjogaW5mby5kZXNjcmlwdGlvbiwgbWF0Y2hPbkRldGFpbDogdHJ1ZSwgaWdub3JlRm9jdXNMb3N0OiB0cnVlIH07XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMudXNlcklucHV0QWNjZXNzUXVldWUucXVldWUoKCkgPT4gdGhpcy5xdWlja0lucHV0U2VydmljZS5waWNrKHBpY2tzLCBwaWNrT3B0aW9ucywgdW5kZWZpbmVkKSkudGhlbihyZXNvbHZlZElucHV0ID0+IHtcblx0XHRcdFx0XHRcdGlmIChyZXNvbHZlZElucHV0KSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHZhbHVlID0gKHJlc29sdmVkSW5wdXQgYXMgUGlja1N0cmluZ0l0ZW0pLnZhbHVlO1xuXHRcdFx0XHRcdFx0XHR0aGlzLnN0b3JlSW5wdXRMcnUoZGVmYXVsdFZhbHVlTWFwLnNldChkZWZhdWx0VmFsdWVLZXksIHZhbHVlKSk7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB7IHZhbHVlLCBpbnB1dDogaW5mbyB9O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNhc2UgJ2NvbW1hbmQnOiB7XG5cdFx0XHRcdFx0aWYgKCFUeXBlcy5pc1N0cmluZyhpbmZvLmNvbW1hbmQpKSB7XG5cdFx0XHRcdFx0XHRtaXNzaW5nQXR0cmlidXRlKCdjb21tYW5kJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0aGlzLnVzZXJJbnB1dEFjY2Vzc1F1ZXVlLnF1ZXVlKCgpID0+IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQ8c3RyaW5nPihpbmZvLmNvbW1hbmQsIGluZm8uYXJncykpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdFx0XHRcdGlmICh0eXBlb2YgcmVzdWx0ID09PSAnc3RyaW5nJyB8fCBUeXBlcy5pc1VuZGVmaW5lZE9yTnVsbChyZXN1bHQpKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB7IHZhbHVlOiByZXN1bHQsIGlucHV0OiBpbmZvIH07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgVmFyaWFibGVFcnJvcihWYXJpYWJsZUtpbmQuSW5wdXQsIGxvY2FsaXplKCdpbnB1dFZhcmlhYmxlLmNvbW1hbmQubm9TdHJpbmdUeXBlJywgXCJDYW5ub3Qgc3Vic3RpdHV0ZSBpbnB1dCB2YXJpYWJsZSAnezB9JyBiZWNhdXNlIGNvbW1hbmQgJ3sxfScgZGlkIG5vdCByZXR1cm4gYSByZXN1bHQgb2YgdHlwZSBzdHJpbmcuXCIsIHZhcmlhYmxlLCBpbmZvLmNvbW1hbmQpKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IFZhcmlhYmxlRXJyb3IoVmFyaWFibGVLaW5kLklucHV0LCBsb2NhbGl6ZSgnaW5wdXRWYXJpYWJsZS51bmtub3duVHlwZScsIFwiSW5wdXQgdmFyaWFibGUgJ3swfScgY2FuIG9ubHkgYmUgb2YgdHlwZSAncHJvbXB0U3RyaW5nJywgJ3BpY2tTdHJpbmcnLCBvciAnY29tbWFuZCcuXCIsIHZhcmlhYmxlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhyb3cgbmV3IFZhcmlhYmxlRXJyb3IoVmFyaWFibGVLaW5kLklucHV0LCBsb2NhbGl6ZSgnaW5wdXRWYXJpYWJsZS51bmRlZmluZWRWYXJpYWJsZScsIFwiVW5kZWZpbmVkIGlucHV0IHZhcmlhYmxlICd7MH0nIGVuY291bnRlcmVkLiBSZW1vdmUgb3IgZGVmaW5lICd7MH0nIHRvIGNvbnRpbnVlLlwiLCB2YXJpYWJsZSkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxTQUFTLGFBQWE7QUFFdEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxlQUFlO0FBRXhCLFlBQVksV0FBVztBQUV2QixTQUFzQixjQUFjLG9CQUFvQjtBQUN4RCxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLDJCQUEyRTtBQUdwRixTQUEwQixjQUFjLHFCQUFxQjtBQUM3RCxTQUF5RCxzQkFBc0I7QUFDL0UsU0FBUyx3QkFBd0Isd0JBQXdCO0FBSXpELFNBQTBCLGVBQWUsb0JBQW9CO0FBQzdELFNBQVMsdUNBQXVEO0FBQ2hFLFNBQVMsdUNBQXVDO0FBRWhELE1BQU0seUJBQXlCO0FBQy9CLE1BQU0sd0JBQXdCO0FBRXZCLE1BQWUseUNBQXlDLGdDQUFnQztBQUFBLEVBTTlGLFlBQ0MsU0FJQSxxQkFDQSxlQUNpQixzQkFDQSxnQkFDQSx5QkFDQSxtQkFDQSxjQUNBLGFBQ2pCLGtCQUNpQixnQkFDaEI7QUFDRCxVQUFNO0FBQUEsTUFDTCxjQUFjLENBQUMsZUFBd0M7QUFDdEQsY0FBTSxTQUFTLHdCQUF3QixhQUFhLEVBQUUsUUFBUSxPQUFPLE9BQUssRUFBRSxTQUFTLFVBQVUsRUFBRSxJQUFJO0FBQ3JHLGVBQU8sU0FBUyxPQUFPLE1BQU07QUFBQSxNQUM5QjtBQUFBLE1BQ0EseUJBQXlCLE1BQWM7QUFDdEMsZUFBTyx3QkFBd0IsYUFBYSxFQUFFLFFBQVE7QUFBQSxNQUN2RDtBQUFBLE1BQ0EsdUJBQXVCLENBQUMsV0FBNEIsWUFBd0M7QUFDM0YsZUFBTyxxQkFBcUIsU0FBaUIsU0FBUyxZQUFZLEVBQUUsVUFBVSxVQUFVLElBQUksQ0FBQyxDQUFDO0FBQUEsTUFDL0Y7QUFBQSxNQUNBLFlBQVksTUFBMEI7QUFDckMsZUFBTyxRQUFRLFdBQVc7QUFBQSxNQUMzQjtBQUFBLE1BQ0EsYUFBYSxNQUEwQjtBQUN0QyxlQUFP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
