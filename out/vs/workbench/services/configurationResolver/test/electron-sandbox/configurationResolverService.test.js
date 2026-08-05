import assert from "assert";
import { stub } from "sinon";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { normalize } from "../../../../../base/common/path.js";
import * as platform from "../../../../../base/common/platform.js";
import { isLinux, isMacintosh, isWindows } from "../../../../../base/common/platform.js";
import { isObject } from "../../../../../base/common/types.js";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Selection } from "../../../../../editor/common/core/selection.js";
import { EditorType } from "../../../../../editor/common/editorCommon.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { testWorkspace } from "../../../../../platform/workspace/test/common/testWorkspace.js";
import { TestEditorService, TestQuickInputService } from "../../../../test/browser/workbenchTestServices.js";
import { TestContextService, TestExtensionService, TestStorageService } from "../../../../test/common/workbenchTestServices.js";
import { BaseConfigurationResolverService } from "../../browser/baseConfigurationResolverService.js";
import { ConfigurationResolverExpression } from "../../common/configurationResolverExpression.js";
const mockLineNumber = 10;
class TestEditorServiceWithActiveEditor extends TestEditorService {
  get activeTextEditorControl() {
    return {
      getEditorType() {
        return EditorType.ICodeEditor;
      },
      getSelection() {
        return new Selection(mockLineNumber, 1, mockLineNumber, 10);
      }
    };
  }
  get activeEditor() {
    return {
      get resource() {
        return URI.parse("file:///VSCode/workspaceLocation/file");
      }
    };
  }
}
class TestConfigurationResolverService extends BaseConfigurationResolverService {
}
const nullContext = {
  getAppRoot: () => void 0,
  getExecPath: () => void 0
};
suite("Configuration Resolver Service", () => {
  let configurationResolverService;
  const envVariables = { key1: "Value for key1", key2: "Value for key2" };
  let mockCommandService;
  let editorService;
  let containingWorkspace;
  let workspace;
  let quickInputService;
  let labelService;
  let pathService;
  let extensionService;
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  setup(() => {
    mockCommandService = new MockCommandService();
    editorService = disposables.add(new TestEditorServiceWithActiveEditor());
    quickInputService = new TestQuickInputService();
    labelService = new MockLabelService();
    pathService = new MockPathService();
    extensionService = new TestExtensionService();
    containingWorkspace = testWorkspace(URI.parse("file:///VSCode/workspaceLocation"));
    workspace = containingWorkspace.folders[0];
    configurationResolverService = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), editorService, new MockInputsConfigurationService(), mockCommandService, new TestContextService(containingWorkspace), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
  });
  teardown(() => {
    configurationResolverService = null;
  });
  test("substitute one", async () => {
    if (platform.isWindows) {
      assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "abc ${workspaceFolder} xyz"), "abc \\VSCode\\workspaceLocation xyz");
    } else {
      assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "abc ${workspaceFolder} xyz"), "abc /VSCode/workspaceLocation xyz");
    }
  });
  test("apples platform specific config", async () => {
    const expected = isWindows ? "windows.exe" : isMacintosh ? "osx.sh" : isLinux ? "linux.sh" : void 0;
    const obj = {
      windows: {
        program: "windows.exe"
      },
      osx: {
        program: "osx.sh"
      },
      linux: {
        program: "linux.sh"
      }
    };
    const originalObj = JSON.stringify(obj);
    const config = await configurationResolverService.resolveAsync(workspace, obj);
    assert.strictEqual(config.program, expected);
    assert.strictEqual(config.windows, void 0);
    assert.strictEqual(config.osx, void 0);
    assert.strictEqual(config.linux, void 0);
    assert.strictEqual(JSON.stringify(obj), originalObj);
  });
  test("workspace folder with argument", async () => {
    if (platform.isWindows) {
      assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "abc ${workspaceFolder:workspaceLocation} xyz"), "abc \\VSCode\\workspaceLocation xyz");
    } else {
      assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "abc ${workspaceFolder:workspaceLocation} xyz"), "abc /VSCode/workspaceLocation xyz");
    }
  });
  test("workspace folder with invalid argument", async () => {
    await assert.rejects(async () => await configurationResolverService.resolveAsync(workspace, "abc ${workspaceFolder:invalidLocation} xyz"));
  });
  test("workspace folder with undefined workspace folder", async () => {
    await assert.rejects(async () => await configurationResolverService.resolveAsync(void 0, "abc ${workspaceFolder} xyz"));
  });
  test("workspace folder with argument and undefined workspace folder", async () => {
    if (platform.isWindows) {
      assert.strictEqual(await configurationResolverService.resolveAsync(void 0, "abc ${workspaceFolder:workspaceLocation} xyz"), "abc \\VSCode\\workspaceLocation xyz");
    } else {
      assert.strictEqual(await configurationResolverService.resolveAsync(void 0, "abc ${workspaceFolder:workspaceLocation} xyz"), "abc /VSCode/workspaceLocation xyz");
    }
  });
  test("workspace folder with invalid argument and undefined workspace folder", () => {
    assert.rejects(async () => await configurationResolverService.resolveAsync(void 0, "abc ${workspaceFolder:invalidLocation} xyz"));
  });
  test("workspace root folder name", async () => {
    assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "abc ${workspaceRootFolderName} xyz"), "abc workspaceLocation xyz");
  });
  test("current selected line number", async () => {
    assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "abc ${lineNumber} xyz"), `abc ${mockLineNumber} xyz`);
  });
  test("relative file", async () => {
    assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "abc ${relativeFile} xyz"), "abc file xyz");
  });
  test("relative file with argument", async () => {
    assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "abc ${relativeFile:workspaceLocation} xyz"), "abc file xyz");
  });
  test("relative file with invalid argument", () => {
    assert.rejects(async () => await configurationResolverService.resolveAsync(workspace, "abc ${relativeFile:invalidLocation} xyz"));
  });
  test("relative file with undefined workspace folder", async () => {
    if (platform.isWindows) {
      assert.strictEqual(await configurationResolverService.resolveAsync(void 0, "abc ${relativeFile} xyz"), "abc \\VSCode\\workspaceLocation\\file xyz");
    } else {
      assert.strictEqual(await configurationResolverService.resolveAsync(void 0, "abc ${relativeFile} xyz"), "abc /VSCode/workspaceLocation/file xyz");
    }
  });
  test("relative file with argument and undefined workspace folder", async () => {
    assert.strictEqual(await configurationResolverService.resolveAsync(void 0, "abc ${relativeFile:workspaceLocation} xyz"), "abc file xyz");
  });
  test("relative file with invalid argument and undefined workspace folder", () => {
    assert.rejects(async () => await configurationResolverService.resolveAsync(void 0, "abc ${relativeFile:invalidLocation} xyz"));
  });
  test("substitute many", async () => {
    if (platform.isWindows) {
      assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "${workspaceFolder} - ${workspaceFolder}"), "\\VSCode\\workspaceLocation - \\VSCode\\workspaceLocation");
    } else {
      assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "${workspaceFolder} - ${workspaceFolder}"), "/VSCode/workspaceLocation - /VSCode/workspaceLocation");
    }
  });
  test("substitute one env variable", async () => {
    if (platform.isWindows) {
      assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "abc ${workspaceFolder} ${env:key1} xyz"), "abc \\VSCode\\workspaceLocation Value for key1 xyz");
    } else {
      assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "abc ${workspaceFolder} ${env:key1} xyz"), "abc /VSCode/workspaceLocation Value for key1 xyz");
    }
  });
  test("substitute many env variable", async () => {
    if (platform.isWindows) {
      assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "${workspaceFolder} - ${workspaceFolder} ${env:key1} - ${env:key2}"), "\\VSCode\\workspaceLocation - \\VSCode\\workspaceLocation Value for key1 - Value for key2");
    } else {
      assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "${workspaceFolder} - ${workspaceFolder} ${env:key1} - ${env:key2}"), "/VSCode/workspaceLocation - /VSCode/workspaceLocation Value for key1 - Value for key2");
    }
  });
  test("disallows nested keys (#77289)", async () => {
    assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "${env:key1} ${env:key1${env:key2}}"), "Value for key1 ");
  });
  test("supports extensionDir", async () => {
    const getExtension = stub(extensionService, "getExtension");
    getExtension.withArgs("publisher.extId").returns(Promise.resolve({ extensionLocation: URI.file("/some/path") }));
    assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "${extensionInstallFolder:publisher.extId}"), URI.file("/some/path").fsPath);
  });
  test("substitute one env variable using platform case sensitivity", async () => {
    if (platform.isWindows) {
      assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "${env:key1} - ${env:Key1}"), "Value for key1 - Value for key1");
    } else {
      assert.strictEqual(await configurationResolverService.resolveAsync(workspace, "${env:key1} - ${env:Key1}"), "Value for key1 - ");
    }
  });
  test("substitute one configuration variable", async () => {
    const configurationService = new TestConfigurationService({
      editor: {
        fontFamily: "foo"
      },
      terminal: {
        integrated: {
          fontFamily: "bar"
        }
      }
    });
    const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
    assert.strictEqual(await service.resolveAsync(workspace, "abc ${config:editor.fontFamily} xyz"), "abc foo xyz");
  });
  test("substitute configuration variable with undefined workspace folder", async () => {
    const configurationService = new TestConfigurationService({
      editor: {
        fontFamily: "foo"
      }
    });
    const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
    assert.strictEqual(await service.resolveAsync(void 0, "abc ${config:editor.fontFamily} xyz"), "abc foo xyz");
  });
  test("substitute many configuration variables", async () => {
    const configurationService = new TestConfigurationService({
      editor: {
        fontFamily: "foo"
      },
      terminal: {
        integrated: {
          fontFamily: "bar"
        }
      }
    });
    const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
    assert.strictEqual(await service.resolveAsync(workspace, "abc ${config:editor.fontFamily} ${config:terminal.integrated.fontFamily} xyz"), "abc foo bar xyz");
  });
  test("substitute one env variable and a configuration variable", async () => {
    const configurationService = new TestConfigurationService({
      editor: {
        fontFamily: "foo"
      },
      terminal: {
        integrated: {
          fontFamily: "bar"
        }
      }
    });
    const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
    if (platform.isWindows) {
      assert.strictEqual(await service.resolveAsync(workspace, "abc ${config:editor.fontFamily} ${workspaceFolder} ${env:key1} xyz"), "abc foo \\VSCode\\workspaceLocation Value for key1 xyz");
    } else {
      assert.strictEqual(await service.resolveAsync(workspace, "abc ${config:editor.fontFamily} ${workspaceFolder} ${env:key1} xyz"), "abc foo /VSCode/workspaceLocation Value for key1 xyz");
    }
  });
  test("substitute many env variable and a configuration variable", async () => {
    const configurationService = new TestConfigurationService({
      editor: {
        fontFamily: "foo"
      },
      terminal: {
        integrated: {
          fontFamily: "bar"
        }
      }
    });
    const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
    if (platform.isWindows) {
      assert.strictEqual(await service.resolveAsync(workspace, "${config:editor.fontFamily} ${config:terminal.integrated.fontFamily} ${workspaceFolder} - ${workspaceFolder} ${env:key1} - ${env:key2}"), "foo bar \\VSCode\\workspaceLocation - \\VSCode\\workspaceLocation Value for key1 - Value for key2");
    } else {
      assert.strictEqual(await service.resolveAsync(workspace, "${config:editor.fontFamily} ${config:terminal.integrated.fontFamily} ${workspaceFolder} - ${workspaceFolder} ${env:key1} - ${env:key2}"), "foo bar /VSCode/workspaceLocation - /VSCode/workspaceLocation Value for key1 - Value for key2");
    }
  });
  test("mixed types of configuration variables", async () => {
    const configurationService = new TestConfigurationService({
      editor: {
        fontFamily: "foo",
        lineNumbers: 123,
        insertSpaces: false
      },
      terminal: {
        integrated: {
          fontFamily: "bar"
        }
      },
      json: {
        schemas: [
          {
            fileMatch: [
              "/myfile",
              "/myOtherfile"
            ],
            url: "schemaURL"
          }
        ]
      }
    });
    const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
    assert.strictEqual(await service.resolveAsync(workspace, "abc ${config:editor.fontFamily} ${config:editor.lineNumbers} ${config:editor.insertSpaces} xyz"), "abc foo 123 false xyz");
  });
  test("uses original variable as fallback", async () => {
    const configurationService = new TestConfigurationService({
      editor: {}
    });
    const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
    assert.strictEqual(await service.resolveAsync(workspace, "abc ${unknownVariable} xyz"), "abc ${unknownVariable} xyz");
    assert.strictEqual(await service.resolveAsync(workspace, "abc ${env:unknownVariable} xyz"), "abc  xyz");
  });
  test("configuration variables with invalid accessor", () => {
    const configurationService = new TestConfigurationService({
      editor: {
        fontFamily: "foo"
      }
    });
    const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
    assert.rejects(async () => await service.resolveAsync(workspace, "abc ${env} xyz"));
    assert.rejects(async () => await service.resolveAsync(workspace, "abc ${env:} xyz"));
    assert.rejects(async () => await service.resolveAsync(workspace, "abc ${config} xyz"));
    assert.rejects(async () => await service.resolveAsync(workspace, "abc ${config:} xyz"));
    assert.rejects(async () => await service.resolveAsync(workspace, "abc ${config:editor} xyz"));
    assert.rejects(async () => await service.resolveAsync(workspace, "abc ${config:editor..fontFamily} xyz"));
    assert.rejects(async () => await service.resolveAsync(workspace, "abc ${config:editor.none.none2} xyz"));
  });
  test("a single command variable", () => {
    const configuration = {
      "name": "Attach to Process",
      "type": "node",
      "request": "attach",
      "processId": "${command:command1}",
      "port": 5858,
      "sourceMaps": false,
      "outDir": null
    };
    return configurationResolverService.resolveWithInteractionReplace(void 0, configuration).then((result) => {
      assert.deepStrictEqual({ ...result }, {
        "name": "Attach to Process",
        "type": "node",
        "request": "attach",
        "processId": "command1-result",
        "port": 5858,
        "sourceMaps": false,
        "outDir": null
      });
      assert.strictEqual(1, mockCommandService.callCount);
    });
  });
  test("an old style command variable", () => {
    const configuration = {
      "name": "Attach to Process",
      "type": "node",
      "request": "attach",
      "processId": "${command:commandVariable1}",
      "port": 5858,
      "sourceMaps": false,
      "outDir": null
    };
    const commandVariables = /* @__PURE__ */ Object.create(null);
    commandVariables["commandVariable1"] = "command1";
    return configurationResolverService.resolveWithInteractionReplace(void 0, configuration, void 0, commandVariables).then((result) => {
      assert.deepStrictEqual({ ...result }, {
        "name": "Attach to Process",
        "type": "node",
        "request": "attach",
        "processId": "command1-result",
        "port": 5858,
        "sourceMaps": false,
        "outDir": null
      });
      assert.strictEqual(1, mockCommandService.callCount);
    });
  });
  test("multiple new and old-style command variables", () => {
    const configuration = {
      "name": "Attach to Process",
      "type": "node",
      "request": "attach",
      "processId": "${command:commandVariable1}",
      "pid": "${command:command2}",
      "sourceMaps": false,
      "outDir": "src/${command:command2}",
      "env": {
        "processId": "__${command:command2}__"
      }
    };
    const commandVariables = /* @__PURE__ */ Object.create(null);
    commandVariables["commandVariable1"] = "command1";
    return configurationResolverService.resolveWithInteractionReplace(void 0, configuration, void 0, commandVariables).then((result) => {
      const expected = {
        "name": "Attach to Process",
        "type": "node",
        "request": "attach",
        "processId": "command1-result",
        "pid": "command2-result",
        "sourceMaps": false,
        "outDir": "src/command2-result",
        "env": {
          "processId": "__command2-result__"
        }
      };
      assert.deepStrictEqual(Object.keys(result), Object.keys(expected));
      Object.keys(result).forEach((property) => {
        const expectedProperty = expected[property];
        if (isObject(result[property])) {
          assert.deepStrictEqual({ ...result[property] }, expectedProperty);
        } else {
          assert.deepStrictEqual(result[property], expectedProperty);
        }
      });
      assert.strictEqual(2, mockCommandService.callCount);
    });
  });
  test("a command variable that relies on resolved env vars", () => {
    const configuration = {
      "name": "Attach to Process",
      "type": "node",
      "request": "attach",
      "processId": "${command:commandVariable1}",
      "value": "${env:key1}"
    };
    const commandVariables = /* @__PURE__ */ Object.create(null);
    commandVariables["commandVariable1"] = "command1";
    return configurationResolverService.resolveWithInteractionReplace(void 0, configuration, void 0, commandVariables).then((result) => {
      assert.deepStrictEqual({ ...result }, {
        "name": "Attach to Process",
        "type": "node",
        "request": "attach",
        "processId": "Value for key1",
        "value": "Value for key1"
      });
      assert.strictEqual(1, mockCommandService.callCount);
    });
  });
  test("a single prompt input variable", () => {
    const configuration = {
      "name": "Attach to Process",
      "type": "node",
      "request": "attach",
      "processId": "${input:input1}",
      "port": 5858,
      "sourceMaps": false,
      "outDir": null
    };
    return configurationResolverService.resolveWithInteractionReplace(workspace, configuration, "tasks").then((result) => {
      assert.deepStrictEqual({ ...result }, {
        "name": "Attach to Process",
        "type": "node",
        "request": "attach",
        "processId": "resolvedEnterinput1",
        "port": 5858,
        "sourceMaps": false,
        "outDir": null
      });
      assert.strictEqual(0, mockCommandService.callCount);
    });
  });
  test("a single pick input variable", () => {
    const configuration = {
      "name": "Attach to Process",
      "type": "node",
      "request": "attach",
      "processId": "${input:input2}",
      "port": 5858,
      "sourceMaps": false,
      "outDir": null
    };
    return configurationResolverService.resolveWithInteractionReplace(workspace, configuration, "tasks").then((result) => {
      assert.deepStrictEqual({ ...result }, {
        "name": "Attach to Process",
        "type": "node",
        "request": "attach",
        "processId": "selectedPick",
        "port": 5858,
        "sourceMaps": false,
        "outDir": null
      });
      assert.strictEqual(0, mockCommandService.callCount);
    });
  });
  test("a single command input variable", () => {
    const configuration = {
      "name": "Attach to Process",
      "type": "node",
      "request": "attach",
      "processId": "${input:input4}",
      "port": 5858,
      "sourceMaps": false,
      "outDir": null
    };
    return configurationResolverService.resolveWithInteractionReplace(workspace, configuration, "tasks").then((result) => {
      assert.deepStrictEqual({ ...result }, {
        "name": "Attach to Process",
        "type": "node",
        "request": "attach",
        "processId": "arg for command",
        "port": 5858,
        "sourceMaps": false,
        "outDir": null
      });
      assert.strictEqual(1, mockCommandService.callCount);
    });
  });
  test("several input variables and command", () => {
    const configuration = {
      "name": "${input:input3}",
      "type": "${command:command1}",
      "request": "${input:input1}",
      "processId": "${input:input2}",
      "command": "${input:input4}",
      "port": 5858,
      "sourceMaps": false,
      "outDir": null
    };
    return configurationResolverService.resolveWithInteractionReplace(workspace, configuration, "tasks").then((result) => {
      assert.deepStrictEqual({ ...result }, {
        "name": "resolvedEnterinput3",
        "type": "command1-result",
        "request": "resolvedEnterinput1",
        "processId": "selectedPick",
        "command": "arg for command",
        "port": 5858,
        "sourceMaps": false,
        "outDir": null
      });
      assert.strictEqual(2, mockCommandService.callCount);
    });
  });
  test("input variable with undefined workspace folder", () => {
    const configuration = {
      "name": "Attach to Process",
      "type": "node",
      "request": "attach",
      "processId": "${input:input1}",
      "port": 5858,
      "sourceMaps": false,
      "outDir": null
    };
    return configurationResolverService.resolveWithInteractionReplace(void 0, configuration, "tasks").then((result) => {
      assert.deepStrictEqual({ ...result }, {
        "name": "Attach to Process",
        "type": "node",
        "request": "attach",
        "processId": "resolvedEnterinput1",
        "port": 5858,
        "sourceMaps": false,
        "outDir": null
      });
      assert.strictEqual(0, mockCommandService.callCount);
    });
  });
  test("contributed variable", () => {
    const buildTask = "npm: compile";
    const variable = "defaultBuildTask";
    const configuration = {
      "name": "${" + variable + "}"
    };
    configurationResolverService.contributeVariable(variable, async () => {
      return buildTask;
    });
    return configurationResolverService.resolveWithInteractionReplace(workspace, configuration).then((result) => {
      assert.deepStrictEqual({ ...result }, {
        "name": `${buildTask}`
      });
    });
  });
  test("resolveWithEnvironment", async () => {
    const env = {
      "VAR_1": "VAL_1",
      "VAR_2": "VAL_2"
    };
    const configuration = "echo ${env:VAR_1}${env:VAR_2}";
    const resolvedResult = await configurationResolverService.resolveWithEnvironment({ ...env }, void 0, configuration);
    assert.deepStrictEqual(resolvedResult, "echo VAL_1VAL_2");
  });
});
class MockCommandService {
  constructor() {
    this.callCount = 0;
    this.onWillExecuteCommand = () => Disposable.None;
    this.onDidExecuteCommand = () => Disposable.None;
  }
  executeCommand(commandId, ...args) {
    this.callCount++;
    let result = `${commandId}-result`;
    if (args.length >= 1) {
      if (args[0] && args[0].value) {
        result = args[0].value;
      }
    }
    return Promise.resolve(result);
  }
}
class MockLabelService {
  constructor() {
    this.onDidChangeFormatters = new Emitter().event;
  }
  getUriLabel(resource, options) {
    return normalize(resource.fsPath);
  }
  getUriBasenameLabel(resource) {
    throw new Error("Method not implemented.");
  }
  getWorkspaceLabel(workspace, options) {
    throw new Error("Method not implemented.");
  }
  getHostLabel(scheme, authority) {
    throw new Error("Method not implemented.");
  }
  getHostTooltip() {
    throw new Error("Method not implemented.");
  }
  getSeparator(scheme, authority) {
    throw new Error("Method not implemented.");
  }
  registerFormatter(formatter) {
    throw new Error("Method not implemented.");
  }
  registerCachedFormatter(formatter) {
    throw new Error("Method not implemented.");
  }
}
class MockPathService {
  constructor() {
    this.defaultUriScheme = Schemas.file;
  }
  get path() {
    throw new Error("Property not implemented");
  }
  fileURI(path) {
    throw new Error("Method not implemented.");
  }
  userHome(options) {
    const uri = URI.file("c:\\users\\username");
    return options?.preferLocal ? uri : Promise.resolve(uri);
  }
  hasValidBasename(resource, arg2, name) {
    throw new Error("Method not implemented.");
  }
}
class MockInputsConfigurationService extends TestConfigurationService {
  getValue(arg1, arg2) {
    let configuration;
    if (arg1 === "tasks") {
      configuration = {
        inputs: [
          {
            id: "input1",
            type: "promptString",
            description: "Enterinput1",
            default: "default input1"
          },
          {
            id: "input2",
            type: "pickString",
            description: "Enterinput1",
            default: "option2",
            options: ["option1", "option2", "option3"]
          },
          {
            id: "input3",
            type: "promptString",
            description: "Enterinput3",
            default: "default input3",
            provide: true,
            password: true
          },
          {
            id: "input4",
            type: "command",
            command: "command1",
            args: {
              value: "arg for command"
            }
          }
        ]
      };
    }
    return configuration;
  }
  inspect(key, overrides) {
    return {
      value: void 0,
      defaultValue: void 0,
      userValue: void 0,
      overrideIdentifiers: []
    };
  }
}
suite("ConfigurationResolverExpression", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("parse empty object", () => {
    const expr = ConfigurationResolverExpression.parse({});
    assert.strictEqual(Array.from(expr.unresolved()).length, 0);
    assert.deepStrictEqual(expr.toObject(), {});
  });
  test("parse simple string", () => {
    const expr = ConfigurationResolverExpression.parse({ value: "${env:HOME}" });
    const unresolved = Array.from(expr.unresolved());
    assert.strictEqual(unresolved.length, 1);
    assert.strictEqual(unresolved[0].name, "env");
    assert.strictEqual(unresolved[0].arg, "HOME");
  });
  test("parse string with argument and colon", () => {
    const expr = ConfigurationResolverExpression.parse({ value: "${config:path:to:value}" });
    const unresolved = Array.from(expr.unresolved());
    assert.strictEqual(unresolved.length, 1);
    assert.strictEqual(unresolved[0].name, "config");
    assert.strictEqual(unresolved[0].arg, "path:to:value");
  });
  test("parse object with nested variables", () => {
    const expr = ConfigurationResolverExpression.parse({
      name: "${env:USERNAME}",
      path: "${env:HOME}/folder",
      settings: {
        value: "${config:path}"
      },
      array: ["${env:TERM}", { key: "${env:KEY}" }]
    });
    const unresolved = Array.from(expr.unresolved());
    assert.strictEqual(unresolved.length, 5);
    assert.deepStrictEqual(unresolved.map((r) => r.name).sort(), ["config", "env", "env", "env", "env"]);
  });
  test("resolve and get result", () => {
    const expr = ConfigurationResolverExpression.parse({
      name: "${env:USERNAME}",
      path: "${env:HOME}/folder"
    });
    expr.resolve({ inner: "env:USERNAME", id: "${env:USERNAME}", name: "env", arg: "USERNAME" }, "testuser");
    expr.resolve({ inner: "env:HOME", id: "${env:HOME}", name: "env", arg: "HOME" }, "/home/testuser");
    assert.deepStrictEqual(expr.toObject(), {
      name: "testuser",
      path: "/home/testuser/folder"
    });
  });
  test("keeps unresolved variables", () => {
    const expr = ConfigurationResolverExpression.parse({
      name: "${env:USERNAME}"
    });
    assert.deepStrictEqual(expr.toObject(), {
      name: "${env:USERNAME}"
    });
  });
  test("deduplicates identical variables", () => {
    const expr = ConfigurationResolverExpression.parse({
      first: "${env:HOME}",
      second: "${env:HOME}"
    });
    const unresolved = Array.from(expr.unresolved());
    assert.strictEqual(unresolved.length, 1);
    assert.strictEqual(unresolved[0].name, "env");
    assert.strictEqual(unresolved[0].arg, "HOME");
    expr.resolve(unresolved[0], "/home/user");
    assert.deepStrictEqual(expr.toObject(), {
      first: "/home/user",
      second: "/home/user"
    });
  });
  test("handles root string value", () => {
    const expr = ConfigurationResolverExpression.parse("abc ${env:HOME} xyz");
    const unresolved = Array.from(expr.unresolved());
    assert.strictEqual(unresolved.length, 1);
    assert.strictEqual(unresolved[0].name, "env");
    assert.strictEqual(unresolved[0].arg, "HOME");
    expr.resolve(unresolved[0], "/home/user");
    assert.strictEqual(expr.toObject(), "abc /home/user xyz");
  });
  test("handles root string value with multiple variables", () => {
    const expr = ConfigurationResolverExpression.parse("${env:HOME}/folder${env:SHELL}");
    const unresolved = Array.from(expr.unresolved());
    assert.strictEqual(unresolved.length, 2);
    expr.resolve({ id: "${env:HOME}", inner: "env:HOME", name: "env", arg: "HOME" }, "/home/user");
    expr.resolve({ id: "${env:SHELL}", inner: "env:SHELL", name: "env", arg: "SHELL" }, "/bin/bash");
    assert.strictEqual(expr.toObject(), "/home/user/folder/bin/bash");
  });
  test("handles root string with escaped variables", () => {
    const expr = ConfigurationResolverExpression.parse("abc ${env:HOME${env:USER}} xyz");
    const unresolved = Array.from(expr.unresolved());
    assert.strictEqual(unresolved.length, 1);
    assert.strictEqual(unresolved[0].name, "env");
    assert.strictEqual(unresolved[0].arg, "HOME${env:USER}");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvY29uZmlndXJhdGlvblJlc29sdmVyL3Rlc3QvZWxlY3Ryb24tc2FuZGJveC9jb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBzdHViIH0gZnJvbSAnc2lub24nO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJUGF0aCwgbm9ybWFsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgKiBhcyBwbGF0Zm9ybSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4LCBpc01hY2ludG9zaCwgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgaXNPYmplY3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IEVkaXRvclR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25PdmVycmlkZXMsIElDb25maWd1cmF0aW9uU2VydmljZSwgSUNvbmZpZ3VyYXRpb25WYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJRm9ybWF0dGVyQ2hhbmdlRXZlbnQsIElMYWJlbFNlcnZpY2UsIFJlc291cmNlTGFiZWxGb3JtYXR0ZXIsIFZlcmJvc2l0eSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlLCBJV29ya3NwYWNlRm9sZGVyLCBJV29ya3NwYWNlSWRlbnRpZmllciwgV29ya3NwYWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgdGVzdFdvcmtzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS90ZXN0L2NvbW1vbi90ZXN0V29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFRlc3RFZGl0b3JTZXJ2aWNlLCBUZXN0UXVpY2tJbnB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IFRlc3RDb250ZXh0U2VydmljZSwgVGVzdEV4dGVuc2lvblNlcnZpY2UsIFRlc3RTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVBhdGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGF0aC9jb21tb24vcGF0aFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQmFzZUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL2Jhc2VDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbmZpZ3VyYXRpb25SZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uUmVzb2x2ZXJFeHByZXNzaW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbmZpZ3VyYXRpb25SZXNvbHZlckV4cHJlc3Npb24uanMnO1xuXG5jb25zdCBtb2NrTGluZU51bWJlciA9IDEwO1xuY2xhc3MgVGVzdEVkaXRvclNlcnZpY2VXaXRoQWN0aXZlRWRpdG9yIGV4dGVuZHMgVGVzdEVkaXRvclNlcnZpY2Uge1xuXHRvdmVycmlkZSBnZXQgYWN0aXZlVGV4dEVkaXRvckNvbnRyb2woKTogYW55IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Z2V0RWRpdG9yVHlwZSgpIHtcblx0XHRcdFx0cmV0dXJuIEVkaXRvclR5cGUuSUNvZGVFZGl0b3I7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0U2VsZWN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFNlbGVjdGlvbihtb2NrTGluZU51bWJlciwgMSwgbW9ja0xpbmVOdW1iZXIsIDEwKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cdG92ZXJyaWRlIGdldCBhY3RpdmVFZGl0b3IoKTogYW55IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Z2V0IHJlc291cmNlKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBVUkkucGFyc2UoJ2ZpbGU6Ly8vVlNDb2RlL3dvcmtzcGFjZUxvY2F0aW9uL2ZpbGUnKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG59XG5cbmNsYXNzIFRlc3RDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIGV4dGVuZHMgQmFzZUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2Uge1xuXG59XG5cbmNvbnN0IG51bGxDb250ZXh0ID0ge1xuXHRnZXRBcHBSb290OiAoKSA9PiB1bmRlZmluZWQsXG5cdGdldEV4ZWNQYXRoOiAoKSA9PiB1bmRlZmluZWRcbn07XG5cbnN1aXRlKCdDb25maWd1cmF0aW9uIFJlc29sdmVyIFNlcnZpY2UnLCAoKSA9PiB7XG5cdGxldCBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSB8IG51bGw7XG5cdGNvbnN0IGVudlZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHsga2V5MTogJ1ZhbHVlIGZvciBrZXkxJywga2V5MjogJ1ZhbHVlIGZvciBrZXkyJyB9O1xuXHQvLyBsZXQgZW52aXJvbm1lbnRTZXJ2aWNlOiBNb2NrV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlO1xuXHRsZXQgbW9ja0NvbW1hbmRTZXJ2aWNlOiBNb2NrQ29tbWFuZFNlcnZpY2U7XG5cdGxldCBlZGl0b3JTZXJ2aWNlOiBUZXN0RWRpdG9yU2VydmljZVdpdGhBY3RpdmVFZGl0b3I7XG5cdGxldCBjb250YWluaW5nV29ya3NwYWNlOiBXb3Jrc3BhY2U7XG5cdGxldCB3b3Jrc3BhY2U6IElXb3Jrc3BhY2VGb2xkZXI7XG5cdGxldCBxdWlja0lucHV0U2VydmljZTogVGVzdFF1aWNrSW5wdXRTZXJ2aWNlO1xuXHRsZXQgbGFiZWxTZXJ2aWNlOiBNb2NrTGFiZWxTZXJ2aWNlO1xuXHRsZXQgcGF0aFNlcnZpY2U6IE1vY2tQYXRoU2VydmljZTtcblx0bGV0IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlO1xuXG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdG1vY2tDb21tYW5kU2VydmljZSA9IG5ldyBNb2NrQ29tbWFuZFNlcnZpY2UoKTtcblx0XHRlZGl0b3JTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0RWRpdG9yU2VydmljZVdpdGhBY3RpdmVFZGl0b3IoKSk7XG5cdFx0cXVpY2tJbnB1dFNlcnZpY2UgPSBuZXcgVGVzdFF1aWNrSW5wdXRTZXJ2aWNlKCk7XG5cdFx0Ly8gZW52aXJvbm1lbnRTZXJ2aWNlID0gbmV3IE1vY2tXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UoZW52VmFyaWFibGVzKTtcblx0XHRsYWJlbFNlcnZpY2UgPSBuZXcgTW9ja0xhYmVsU2VydmljZSgpO1xuXHRcdHBhdGhTZXJ2aWNlID0gbmV3IE1vY2tQYXRoU2VydmljZSgpO1xuXHRcdGV4dGVuc2lvblNlcnZpY2UgPSBuZXcgVGVzdEV4dGVuc2lvblNlcnZpY2UoKTtcblx0XHRjb250YWluaW5nV29ya3NwYWNlID0gdGVzdFdvcmtzcGFjZShVUkkucGFyc2UoJ2ZpbGU6Ly8vVlNDb2RlL3dvcmtzcGFjZUxvY2F0aW9uJykpO1xuXHRcdHdvcmtzcGFjZSA9IGNvbnRhaW5pbmdXb3Jrc3BhY2UuZm9sZGVyc1swXTtcblx0XHRjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlKG51bGxDb250ZXh0LCBQcm9taXNlLnJlc29sdmUoZW52VmFyaWFibGVzKSwgZWRpdG9yU2VydmljZSwgbmV3IE1vY2tJbnB1dHNDb25maWd1cmF0aW9uU2VydmljZSgpLCBtb2NrQ29tbWFuZFNlcnZpY2UsIG5ldyBUZXN0Q29udGV4dFNlcnZpY2UoY29udGFpbmluZ1dvcmtzcGFjZSksIHF1aWNrSW5wdXRTZXJ2aWNlLCBsYWJlbFNlcnZpY2UsIHBhdGhTZXJ2aWNlLCBleHRlbnNpb25TZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RTdG9yYWdlU2VydmljZSgpKSk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlID0gbnVsbDtcblx0fSk7XG5cblx0dGVzdCgnc3Vic3RpdHV0ZSBvbmUnLCBhc3luYyAoKSA9PiB7XG5cdFx0aWYgKHBsYXRmb3JtLmlzV2luZG93cykge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UhLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICdhYmMgJHt3b3Jrc3BhY2VGb2xkZXJ9IHh5eicpLCAnYWJjIFxcXFxWU0NvZGVcXFxcd29ya3NwYWNlTG9jYXRpb24geHl6Jyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIS5yZXNvbHZlQXN5bmMod29ya3NwYWNlLCAnYWJjICR7d29ya3NwYWNlRm9sZGVyfSB4eXonKSwgJ2FiYyAvVlNDb2RlL3dvcmtzcGFjZUxvY2F0aW9uIHh5eicpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnYXBwbGVzIHBsYXRmb3JtIHNwZWNpZmljIGNvbmZpZycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBleHBlY3RlZCA9IGlzV2luZG93cyA/ICd3aW5kb3dzLmV4ZScgOiBpc01hY2ludG9zaCA/ICdvc3guc2gnIDogaXNMaW51eCA/ICdsaW51eC5zaCcgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3Qgb2JqID0ge1xuXHRcdFx0d2luZG93czoge1xuXHRcdFx0XHRwcm9ncmFtOiAnd2luZG93cy5leGUnXG5cdFx0XHR9LFxuXHRcdFx0b3N4OiB7XG5cdFx0XHRcdHByb2dyYW06ICdvc3guc2gnXG5cdFx0XHR9LFxuXHRcdFx0bGludXg6IHtcblx0XHRcdFx0cHJvZ3JhbTogJ2xpbnV4LnNoJ1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uc3Qgb3JpZ2luYWxPYmogPSBKU09OLnN0cmluZ2lmeShvYmopO1xuXHRcdGNvbnN0IGNvbmZpZzogYW55ID0gYXdhaXQgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZUFzeW5jKHdvcmtzcGFjZSwgb2JqKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb25maWcucHJvZ3JhbSwgZXhwZWN0ZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb25maWcud2luZG93cywgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29uZmlnLm9zeCwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29uZmlnLmxpbnV4LCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChKU09OLnN0cmluZ2lmeShvYmopLCBvcmlnaW5hbE9iaik7IC8vIGRpZCBub3QgbXV0YXRlIG9yaWdpbmFsXG5cdH0pO1xuXG5cdHRlc3QoJ3dvcmtzcGFjZSBmb2xkZXIgd2l0aCBhcmd1bWVudCcsIGFzeW5jICgpID0+IHtcblx0XHRpZiAocGxhdGZvcm0uaXNXaW5kb3dzKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZUFzeW5jKHdvcmtzcGFjZSwgJ2FiYyAke3dvcmtzcGFjZUZvbGRlcjp3b3Jrc3BhY2VMb2NhdGlvbn0geHl6JyksICdhYmMgXFxcXFZTQ29kZVxcXFx3b3Jrc3BhY2VMb2NhdGlvbiB4eXonKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UhLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICdhYmMgJHt3b3Jrc3BhY2VGb2xkZXI6d29ya3NwYWNlTG9jYXRpb259IHh5eicpLCAnYWJjIC9WU0NvZGUvd29ya3NwYWNlTG9jYXRpb24geHl6Jyk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCd3b3Jrc3BhY2UgZm9sZGVyIHdpdGggaW52YWxpZCBhcmd1bWVudCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBhc3NlcnQucmVqZWN0cyhhc3luYyAoKSA9PiBhd2FpdCBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIS5yZXNvbHZlQXN5bmMod29ya3NwYWNlLCAnYWJjICR7d29ya3NwYWNlRm9sZGVyOmludmFsaWRMb2NhdGlvbn0geHl6JykpO1xuXHR9KTtcblxuXHR0ZXN0KCd3b3Jrc3BhY2UgZm9sZGVyIHdpdGggdW5kZWZpbmVkIHdvcmtzcGFjZSBmb2xkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgYXNzZXJ0LnJlamVjdHMoYXN5bmMgKCkgPT4gYXdhaXQgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZUFzeW5jKHVuZGVmaW5lZCwgJ2FiYyAke3dvcmtzcGFjZUZvbGRlcn0geHl6JykpO1xuXHR9KTtcblxuXHR0ZXN0KCd3b3Jrc3BhY2UgZm9sZGVyIHdpdGggYXJndW1lbnQgYW5kIHVuZGVmaW5lZCB3b3Jrc3BhY2UgZm9sZGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGlmIChwbGF0Zm9ybS5pc1dpbmRvd3MpIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIS5yZXNvbHZlQXN5bmModW5kZWZpbmVkLCAnYWJjICR7d29ya3NwYWNlRm9sZGVyOndvcmtzcGFjZUxvY2F0aW9ufSB4eXonKSwgJ2FiYyBcXFxcVlNDb2RlXFxcXHdvcmtzcGFjZUxvY2F0aW9uIHh5eicpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZUFzeW5jKHVuZGVmaW5lZCwgJ2FiYyAke3dvcmtzcGFjZUZvbGRlcjp3b3Jrc3BhY2VMb2NhdGlvbn0geHl6JyksICdhYmMgL1ZTQ29kZS93b3Jrc3BhY2VMb2NhdGlvbiB4eXonKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3dvcmtzcGFjZSBmb2xkZXIgd2l0aCBpbnZhbGlkIGFyZ3VtZW50IGFuZCB1bmRlZmluZWQgd29ya3NwYWNlIGZvbGRlcicsICgpID0+IHtcblx0XHRhc3NlcnQucmVqZWN0cyhhc3luYyAoKSA9PiBhd2FpdCBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIS5yZXNvbHZlQXN5bmModW5kZWZpbmVkLCAnYWJjICR7d29ya3NwYWNlRm9sZGVyOmludmFsaWRMb2NhdGlvbn0geHl6JykpO1xuXHR9KTtcblxuXHR0ZXN0KCd3b3Jrc3BhY2Ugcm9vdCBmb2xkZXIgbmFtZScsIGFzeW5jICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZUFzeW5jKHdvcmtzcGFjZSwgJ2FiYyAke3dvcmtzcGFjZVJvb3RGb2xkZXJOYW1lfSB4eXonKSwgJ2FiYyB3b3Jrc3BhY2VMb2NhdGlvbiB4eXonKTtcblx0fSk7XG5cblx0dGVzdCgnY3VycmVudCBzZWxlY3RlZCBsaW5lIG51bWJlcicsIGFzeW5jICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZUFzeW5jKHdvcmtzcGFjZSwgJ2FiYyAke2xpbmVOdW1iZXJ9IHh5eicpLCBgYWJjICR7bW9ja0xpbmVOdW1iZXJ9IHh5emApO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWxhdGl2ZSBmaWxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIS5yZXNvbHZlQXN5bmMod29ya3NwYWNlLCAnYWJjICR7cmVsYXRpdmVGaWxlfSB4eXonKSwgJ2FiYyBmaWxlIHh5eicpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWxhdGl2ZSBmaWxlIHdpdGggYXJndW1lbnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UhLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICdhYmMgJHtyZWxhdGl2ZUZpbGU6d29ya3NwYWNlTG9jYXRpb259IHh5eicpLCAnYWJjIGZpbGUgeHl6Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbGF0aXZlIGZpbGUgd2l0aCBpbnZhbGlkIGFyZ3VtZW50JywgKCkgPT4ge1xuXHRcdGFzc2VydC5yZWplY3RzKGFzeW5jICgpID0+IGF3YWl0IGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UhLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICdhYmMgJHtyZWxhdGl2ZUZpbGU6aW52YWxpZExvY2F0aW9ufSB4eXonKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbGF0aXZlIGZpbGUgd2l0aCB1bmRlZmluZWQgd29ya3NwYWNlIGZvbGRlcicsIGFzeW5jICgpID0+IHtcblx0XHRpZiAocGxhdGZvcm0uaXNXaW5kb3dzKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZUFzeW5jKHVuZGVmaW5lZCwgJ2FiYyAke3JlbGF0aXZlRmlsZX0geHl6JyksICdhYmMgXFxcXFZTQ29kZVxcXFx3b3Jrc3BhY2VMb2NhdGlvblxcXFxmaWxlIHh5eicpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZUFzeW5jKHVuZGVmaW5lZCwgJ2FiYyAke3JlbGF0aXZlRmlsZX0geHl6JyksICdhYmMgL1ZTQ29kZS93b3Jrc3BhY2VMb2NhdGlvbi9maWxlIHh5eicpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgncmVsYXRpdmUgZmlsZSB3aXRoIGFyZ3VtZW50IGFuZCB1bmRlZmluZWQgd29ya3NwYWNlIGZvbGRlcicsIGFzeW5jICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZUFzeW5jKHVuZGVmaW5lZCwgJ2FiYyAke3JlbGF0aXZlRmlsZTp3b3Jrc3BhY2VMb2NhdGlvbn0geHl6JyksICdhYmMgZmlsZSB4eXonKTtcblx0fSk7XG5cblx0dGVzdCgncmVsYXRpdmUgZmlsZSB3aXRoIGludmFsaWQgYXJndW1lbnQgYW5kIHVuZGVmaW5lZCB3b3Jrc3BhY2UgZm9sZGVyJywgKCkgPT4ge1xuXHRcdGFzc2VydC5yZWplY3RzKGFzeW5jICgpID0+IGF3YWl0IGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UhLnJlc29sdmVBc3luYyh1bmRlZmluZWQsICdhYmMgJHtyZWxhdGl2ZUZpbGU6aW52YWxpZExvY2F0aW9ufSB4eXonKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N1YnN0aXR1dGUgbWFueScsIGFzeW5jICgpID0+IHtcblx0XHRpZiAocGxhdGZvcm0uaXNXaW5kb3dzKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZUFzeW5jKHdvcmtzcGFjZSwgJyR7d29ya3NwYWNlRm9sZGVyfSAtICR7d29ya3NwYWNlRm9sZGVyfScpLCAnXFxcXFZTQ29kZVxcXFx3b3Jrc3BhY2VMb2NhdGlvbiAtIFxcXFxWU0NvZGVcXFxcd29ya3NwYWNlTG9jYXRpb24nKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UhLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICcke3dvcmtzcGFjZUZvbGRlcn0gLSAke3dvcmtzcGFjZUZvbGRlcn0nKSwgJy9WU0NvZGUvd29ya3NwYWNlTG9jYXRpb24gLSAvVlNDb2RlL3dvcmtzcGFjZUxvY2F0aW9uJyk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdzdWJzdGl0dXRlIG9uZSBlbnYgdmFyaWFibGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0aWYgKHBsYXRmb3JtLmlzV2luZG93cykge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UhLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICdhYmMgJHt3b3Jrc3BhY2VGb2xkZXJ9ICR7ZW52OmtleTF9IHh5eicpLCAnYWJjIFxcXFxWU0NvZGVcXFxcd29ya3NwYWNlTG9jYXRpb24gVmFsdWUgZm9yIGtleTEgeHl6Jyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIS5yZXNvbHZlQXN5bmMod29ya3NwYWNlLCAnYWJjICR7d29ya3NwYWNlRm9sZGVyfSAke2VudjprZXkxfSB4eXonKSwgJ2FiYyAvVlNDb2RlL3dvcmtzcGFjZUxvY2F0aW9uIFZhbHVlIGZvciBrZXkxIHh5eicpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnc3Vic3RpdHV0ZSBtYW55IGVudiB2YXJpYWJsZScsIGFzeW5jICgpID0+IHtcblx0XHRpZiAocGxhdGZvcm0uaXNXaW5kb3dzKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZUFzeW5jKHdvcmtzcGFjZSwgJyR7d29ya3NwYWNlRm9sZGVyfSAtICR7d29ya3NwYWNlRm9sZGVyfSAke2VudjprZXkxfSAtICR7ZW52OmtleTJ9JyksICdcXFxcVlNDb2RlXFxcXHdvcmtzcGFjZUxvY2F0aW9uIC0gXFxcXFZTQ29kZVxcXFx3b3Jrc3BhY2VMb2NhdGlvbiBWYWx1ZSBmb3Iga2V5MSAtIFZhbHVlIGZvciBrZXkyJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIS5yZXNvbHZlQXN5bmMod29ya3NwYWNlLCAnJHt3b3Jrc3BhY2VGb2xkZXJ9IC0gJHt3b3Jrc3BhY2VGb2xkZXJ9ICR7ZW52OmtleTF9IC0gJHtlbnY6a2V5Mn0nKSwgJy9WU0NvZGUvd29ya3NwYWNlTG9jYXRpb24gLSAvVlNDb2RlL3dvcmtzcGFjZUxvY2F0aW9uIFZhbHVlIGZvciBrZXkxIC0gVmFsdWUgZm9yIGtleTInKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2Rpc2FsbG93cyBuZXN0ZWQga2V5cyAoIzc3Mjg5KScsIGFzeW5jICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZUFzeW5jKHdvcmtzcGFjZSwgJyR7ZW52OmtleTF9ICR7ZW52OmtleTEke2VudjprZXkyfX0nKSwgJ1ZhbHVlIGZvciBrZXkxICcpO1xuXHR9KTtcblxuXHR0ZXN0KCdzdXBwb3J0cyBleHRlbnNpb25EaXInLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZ2V0RXh0ZW5zaW9uID0gc3R1YihleHRlbnNpb25TZXJ2aWNlLCAnZ2V0RXh0ZW5zaW9uJyk7XG5cdFx0Z2V0RXh0ZW5zaW9uLndpdGhBcmdzKCdwdWJsaXNoZXIuZXh0SWQnKS5yZXR1cm5zKFByb21pc2UucmVzb2x2ZSh7IGV4dGVuc2lvbkxvY2F0aW9uOiBVUkkuZmlsZSgnL3NvbWUvcGF0aCcpIH0gYXMgSUV4dGVuc2lvbkRlc2NyaXB0aW9uKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZUFzeW5jKHdvcmtzcGFjZSwgJyR7ZXh0ZW5zaW9uSW5zdGFsbEZvbGRlcjpwdWJsaXNoZXIuZXh0SWR9JyksIFVSSS5maWxlKCcvc29tZS9wYXRoJykuZnNQYXRoKTtcblx0fSk7XG5cblx0Ly8gdGVzdCgnc3Vic3RpdHV0ZSBrZXlzIGFuZCB2YWx1ZXMgaW4gb2JqZWN0JywgKCkgPT4ge1xuXHQvLyBcdGNvbnN0IG15T2JqZWN0ID0ge1xuXHQvLyBcdFx0JyR7d29ya3NwYWNlUm9vdEZvbGRlck5hbWV9JzogJyR7bGluZU51bWJlcn0nLFxuXHQvLyBcdFx0J2hleSAke2VudjprZXkxfSAnOiAnJHt3b3Jrc3BhY2VSb290Rm9sZGVyTmFtZX0nXG5cdC8vIFx0fTtcblx0Ly8gXHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UhLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsIG15T2JqZWN0KSwge1xuXHQvLyBcdFx0J3dvcmtzcGFjZUxvY2F0aW9uJzogYCR7ZWRpdG9yU2VydmljZS5tb2NrTGluZU51bWJlcn1gLFxuXHQvLyBcdFx0J2hleSBWYWx1ZSBmb3Iga2V5MSAnOiAnd29ya3NwYWNlTG9jYXRpb24nXG5cdC8vIFx0fSk7XG5cdC8vIH0pO1xuXG5cblx0dGVzdCgnc3Vic3RpdHV0ZSBvbmUgZW52IHZhcmlhYmxlIHVzaW5nIHBsYXRmb3JtIGNhc2Ugc2Vuc2l0aXZpdHknLCBhc3luYyAoKSA9PiB7XG5cdFx0aWYgKHBsYXRmb3JtLmlzV2luZG93cykge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UhLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICcke2VudjprZXkxfSAtICR7ZW52OktleTF9JyksICdWYWx1ZSBmb3Iga2V5MSAtIFZhbHVlIGZvciBrZXkxJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIS5yZXNvbHZlQXN5bmMod29ya3NwYWNlLCAnJHtlbnY6a2V5MX0gLSAke2VudjpLZXkxfScpLCAnVmFsdWUgZm9yIGtleTEgLSAnKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3N1YnN0aXR1dGUgb25lIGNvbmZpZ3VyYXRpb24gdmFyaWFibGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2Uoe1xuXHRcdFx0ZWRpdG9yOiB7XG5cdFx0XHRcdGZvbnRGYW1pbHk6ICdmb28nXG5cdFx0XHR9LFxuXHRcdFx0dGVybWluYWw6IHtcblx0XHRcdFx0aW50ZWdyYXRlZDoge1xuXHRcdFx0XHRcdGZvbnRGYW1pbHk6ICdiYXInXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgVGVzdENvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UobnVsbENvbnRleHQsIFByb21pc2UucmVzb2x2ZShlbnZWYXJpYWJsZXMpLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RFZGl0b3JTZXJ2aWNlV2l0aEFjdGl2ZUVkaXRvcigpKSwgY29uZmlndXJhdGlvblNlcnZpY2UsIG1vY2tDb21tYW5kU2VydmljZSwgbmV3IFRlc3RDb250ZXh0U2VydmljZSgpLCBxdWlja0lucHV0U2VydmljZSwgbGFiZWxTZXJ2aWNlLCBwYXRoU2VydmljZSwgZXh0ZW5zaW9uU2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBzZXJ2aWNlLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICdhYmMgJHtjb25maWc6ZWRpdG9yLmZvbnRGYW1pbHl9IHh5eicpLCAnYWJjIGZvbyB4eXonKTtcblx0fSk7XG5cblx0dGVzdCgnc3Vic3RpdHV0ZSBjb25maWd1cmF0aW9uIHZhcmlhYmxlIHdpdGggdW5kZWZpbmVkIHdvcmtzcGFjZSBmb2xkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2Uoe1xuXHRcdFx0ZWRpdG9yOiB7XG5cdFx0XHRcdGZvbnRGYW1pbHk6ICdmb28nXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlKG51bGxDb250ZXh0LCBQcm9taXNlLnJlc29sdmUoZW52VmFyaWFibGVzKSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0RWRpdG9yU2VydmljZVdpdGhBY3RpdmVFZGl0b3IoKSksIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBtb2NrQ29tbWFuZFNlcnZpY2UsIG5ldyBUZXN0Q29udGV4dFNlcnZpY2UoKSwgcXVpY2tJbnB1dFNlcnZpY2UsIGxhYmVsU2VydmljZSwgcGF0aFNlcnZpY2UsIGV4dGVuc2lvblNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2VydmljZS5yZXNvbHZlQXN5bmModW5kZWZpbmVkLCAnYWJjICR7Y29uZmlnOmVkaXRvci5mb250RmFtaWx5fSB4eXonKSwgJ2FiYyBmb28geHl6Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N1YnN0aXR1dGUgbWFueSBjb25maWd1cmF0aW9uIHZhcmlhYmxlcycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2Uoe1xuXHRcdFx0ZWRpdG9yOiB7XG5cdFx0XHRcdGZvbnRGYW1pbHk6ICdmb28nXG5cdFx0XHR9LFxuXHRcdFx0dGVybWluYWw6IHtcblx0XHRcdFx0aW50ZWdyYXRlZDoge1xuXHRcdFx0XHRcdGZvbnRGYW1pbHk6ICdiYXInXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgVGVzdENvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UobnVsbENvbnRleHQsIFByb21pc2UucmVzb2x2ZShlbnZWYXJpYWJsZXMpLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RFZGl0b3JTZXJ2aWNlV2l0aEFjdGl2ZUVkaXRvcigpKSwgY29uZmlndXJhdGlvblNlcnZpY2UsIG1vY2tDb21tYW5kU2VydmljZSwgbmV3IFRlc3RDb250ZXh0U2VydmljZSgpLCBxdWlja0lucHV0U2VydmljZSwgbGFiZWxTZXJ2aWNlLCBwYXRoU2VydmljZSwgZXh0ZW5zaW9uU2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBzZXJ2aWNlLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICdhYmMgJHtjb25maWc6ZWRpdG9yLmZvbnRGYW1pbHl9ICR7Y29uZmlnOnRlcm1pbmFsLmludGVncmF0ZWQuZm9udEZhbWlseX0geHl6JyksICdhYmMgZm9vIGJhciB4eXonKTtcblx0fSk7XG5cblx0dGVzdCgnc3Vic3RpdHV0ZSBvbmUgZW52IHZhcmlhYmxlIGFuZCBhIGNvbmZpZ3VyYXRpb24gdmFyaWFibGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKHtcblx0XHRcdGVkaXRvcjoge1xuXHRcdFx0XHRmb250RmFtaWx5OiAnZm9vJ1xuXHRcdFx0fSxcblx0XHRcdHRlcm1pbmFsOiB7XG5cdFx0XHRcdGludGVncmF0ZWQ6IHtcblx0XHRcdFx0XHRmb250RmFtaWx5OiAnYmFyJ1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlKG51bGxDb250ZXh0LCBQcm9taXNlLnJlc29sdmUoZW52VmFyaWFibGVzKSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0RWRpdG9yU2VydmljZVdpdGhBY3RpdmVFZGl0b3IoKSksIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBtb2NrQ29tbWFuZFNlcnZpY2UsIG5ldyBUZXN0Q29udGV4dFNlcnZpY2UoKSwgcXVpY2tJbnB1dFNlcnZpY2UsIGxhYmVsU2VydmljZSwgcGF0aFNlcnZpY2UsIGV4dGVuc2lvblNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpKTtcblx0XHRpZiAocGxhdGZvcm0uaXNXaW5kb3dzKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2VydmljZS5yZXNvbHZlQXN5bmMod29ya3NwYWNlLCAnYWJjICR7Y29uZmlnOmVkaXRvci5mb250RmFtaWx5fSAke3dvcmtzcGFjZUZvbGRlcn0gJHtlbnY6a2V5MX0geHl6JyksICdhYmMgZm9vIFxcXFxWU0NvZGVcXFxcd29ya3NwYWNlTG9jYXRpb24gVmFsdWUgZm9yIGtleTEgeHl6Jyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBzZXJ2aWNlLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICdhYmMgJHtjb25maWc6ZWRpdG9yLmZvbnRGYW1pbHl9ICR7d29ya3NwYWNlRm9sZGVyfSAke2VudjprZXkxfSB4eXonKSwgJ2FiYyBmb28gL1ZTQ29kZS93b3Jrc3BhY2VMb2NhdGlvbiBWYWx1ZSBmb3Iga2V5MSB4eXonKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3N1YnN0aXR1dGUgbWFueSBlbnYgdmFyaWFibGUgYW5kIGEgY29uZmlndXJhdGlvbiB2YXJpYWJsZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2Uoe1xuXHRcdFx0ZWRpdG9yOiB7XG5cdFx0XHRcdGZvbnRGYW1pbHk6ICdmb28nXG5cdFx0XHR9LFxuXHRcdFx0dGVybWluYWw6IHtcblx0XHRcdFx0aW50ZWdyYXRlZDoge1xuXHRcdFx0XHRcdGZvbnRGYW1pbHk6ICdiYXInXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgVGVzdENvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UobnVsbENvbnRleHQsIFByb21pc2UucmVzb2x2ZShlbnZWYXJpYWJsZXMpLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RFZGl0b3JTZXJ2aWNlV2l0aEFjdGl2ZUVkaXRvcigpKSwgY29uZmlndXJhdGlvblNlcnZpY2UsIG1vY2tDb21tYW5kU2VydmljZSwgbmV3IFRlc3RDb250ZXh0U2VydmljZSgpLCBxdWlja0lucHV0U2VydmljZSwgbGFiZWxTZXJ2aWNlLCBwYXRoU2VydmljZSwgZXh0ZW5zaW9uU2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSkpO1xuXHRcdGlmIChwbGF0Zm9ybS5pc1dpbmRvd3MpIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBzZXJ2aWNlLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICcke2NvbmZpZzplZGl0b3IuZm9udEZhbWlseX0gJHtjb25maWc6dGVybWluYWwuaW50ZWdyYXRlZC5mb250RmFtaWx5fSAke3dvcmtzcGFjZUZvbGRlcn0gLSAke3dvcmtzcGFjZUZvbGRlcn0gJHtlbnY6a2V5MX0gLSAke2VudjprZXkyfScpLCAnZm9vIGJhciBcXFxcVlNDb2RlXFxcXHdvcmtzcGFjZUxvY2F0aW9uIC0gXFxcXFZTQ29kZVxcXFx3b3Jrc3BhY2VMb2NhdGlvbiBWYWx1ZSBmb3Iga2V5MSAtIFZhbHVlIGZvciBrZXkyJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBzZXJ2aWNlLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICcke2NvbmZpZzplZGl0b3IuZm9udEZhbWlseX0gJHtjb25maWc6dGVybWluYWwuaW50ZWdyYXRlZC5mb250RmFtaWx5fSAke3dvcmtzcGFjZUZvbGRlcn0gLSAke3dvcmtzcGFjZUZvbGRlcn0gJHtlbnY6a2V5MX0gLSAke2VudjprZXkyfScpLCAnZm9vIGJhciAvVlNDb2RlL3dvcmtzcGFjZUxvY2F0aW9uIC0gL1ZTQ29kZS93b3Jrc3BhY2VMb2NhdGlvbiBWYWx1ZSBmb3Iga2V5MSAtIFZhbHVlIGZvciBrZXkyJyk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdtaXhlZCB0eXBlcyBvZiBjb25maWd1cmF0aW9uIHZhcmlhYmxlcycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2Uoe1xuXHRcdFx0ZWRpdG9yOiB7XG5cdFx0XHRcdGZvbnRGYW1pbHk6ICdmb28nLFxuXHRcdFx0XHRsaW5lTnVtYmVyczogMTIzLFxuXHRcdFx0XHRpbnNlcnRTcGFjZXM6IGZhbHNlXG5cdFx0XHR9LFxuXHRcdFx0dGVybWluYWw6IHtcblx0XHRcdFx0aW50ZWdyYXRlZDoge1xuXHRcdFx0XHRcdGZvbnRGYW1pbHk6ICdiYXInXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRqc29uOiB7XG5cdFx0XHRcdHNjaGVtYXM6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRmaWxlTWF0Y2g6IFtcblx0XHRcdFx0XHRcdFx0Jy9teWZpbGUnLFxuXHRcdFx0XHRcdFx0XHQnL215T3RoZXJmaWxlJ1xuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdHVybDogJ3NjaGVtYVVSTCdcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgVGVzdENvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UobnVsbENvbnRleHQsIFByb21pc2UucmVzb2x2ZShlbnZWYXJpYWJsZXMpLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RFZGl0b3JTZXJ2aWNlV2l0aEFjdGl2ZUVkaXRvcigpKSwgY29uZmlndXJhdGlvblNlcnZpY2UsIG1vY2tDb21tYW5kU2VydmljZSwgbmV3IFRlc3RDb250ZXh0U2VydmljZSgpLCBxdWlja0lucHV0U2VydmljZSwgbGFiZWxTZXJ2aWNlLCBwYXRoU2VydmljZSwgZXh0ZW5zaW9uU2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBzZXJ2aWNlLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICdhYmMgJHtjb25maWc6ZWRpdG9yLmZvbnRGYW1pbHl9ICR7Y29uZmlnOmVkaXRvci5saW5lTnVtYmVyc30gJHtjb25maWc6ZWRpdG9yLmluc2VydFNwYWNlc30geHl6JyksICdhYmMgZm9vIDEyMyBmYWxzZSB4eXonKTtcblx0fSk7XG5cblx0dGVzdCgndXNlcyBvcmlnaW5hbCB2YXJpYWJsZSBhcyBmYWxsYmFjaycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2Uoe1xuXHRcdFx0ZWRpdG9yOiB7fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgc2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZShudWxsQ29udGV4dCwgUHJvbWlzZS5yZXNvbHZlKGVudlZhcmlhYmxlcyksIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdEVkaXRvclNlcnZpY2VXaXRoQWN0aXZlRWRpdG9yKCkpLCBjb25maWd1cmF0aW9uU2VydmljZSwgbW9ja0NvbW1hbmRTZXJ2aWNlLCBuZXcgVGVzdENvbnRleHRTZXJ2aWNlKCksIHF1aWNrSW5wdXRTZXJ2aWNlLCBsYWJlbFNlcnZpY2UsIHBhdGhTZXJ2aWNlLCBleHRlbnNpb25TZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RTdG9yYWdlU2VydmljZSgpKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHNlcnZpY2UucmVzb2x2ZUFzeW5jKHdvcmtzcGFjZSwgJ2FiYyAke3Vua25vd25WYXJpYWJsZX0geHl6JyksICdhYmMgJHt1bmtub3duVmFyaWFibGV9IHh5eicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBzZXJ2aWNlLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICdhYmMgJHtlbnY6dW5rbm93blZhcmlhYmxlfSB4eXonKSwgJ2FiYyAgeHl6Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbmZpZ3VyYXRpb24gdmFyaWFibGVzIHdpdGggaW52YWxpZCBhY2Nlc3NvcicsICgpID0+IHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2Uoe1xuXHRcdFx0ZWRpdG9yOiB7XG5cdFx0XHRcdGZvbnRGYW1pbHk6ICdmb28nXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlKG51bGxDb250ZXh0LCBQcm9taXNlLnJlc29sdmUoZW52VmFyaWFibGVzKSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0RWRpdG9yU2VydmljZVdpdGhBY3RpdmVFZGl0b3IoKSksIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBtb2NrQ29tbWFuZFNlcnZpY2UsIG5ldyBUZXN0Q29udGV4dFNlcnZpY2UoKSwgcXVpY2tJbnB1dFNlcnZpY2UsIGxhYmVsU2VydmljZSwgcGF0aFNlcnZpY2UsIGV4dGVuc2lvblNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpKTtcblxuXHRcdGFzc2VydC5yZWplY3RzKGFzeW5jICgpID0+IGF3YWl0IHNlcnZpY2UucmVzb2x2ZUFzeW5jKHdvcmtzcGFjZSwgJ2FiYyAke2Vudn0geHl6JykpO1xuXHRcdGFzc2VydC5yZWplY3RzKGFzeW5jICgpID0+IGF3YWl0IHNlcnZpY2UucmVzb2x2ZUFzeW5jKHdvcmtzcGFjZSwgJ2FiYyAke2Vudjp9IHh5eicpKTtcblx0XHRhc3NlcnQucmVqZWN0cyhhc3luYyAoKSA9PiBhd2FpdCBzZXJ2aWNlLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICdhYmMgJHtjb25maWd9IHh5eicpKTtcblx0XHRhc3NlcnQucmVqZWN0cyhhc3luYyAoKSA9PiBhd2FpdCBzZXJ2aWNlLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICdhYmMgJHtjb25maWc6fSB4eXonKSk7XG5cdFx0YXNzZXJ0LnJlamVjdHMoYXN5bmMgKCkgPT4gYXdhaXQgc2VydmljZS5yZXNvbHZlQXN5bmMod29ya3NwYWNlLCAnYWJjICR7Y29uZmlnOmVkaXRvcn0geHl6JykpO1xuXHRcdGFzc2VydC5yZWplY3RzKGFzeW5jICgpID0+IGF3YWl0IHNlcnZpY2UucmVzb2x2ZUFzeW5jKHdvcmtzcGFjZSwgJ2FiYyAke2NvbmZpZzplZGl0b3IuLmZvbnRGYW1pbHl9IHh5eicpKTtcblx0XHRhc3NlcnQucmVqZWN0cyhhc3luYyAoKSA9PiBhd2FpdCBzZXJ2aWNlLnJlc29sdmVBc3luYyh3b3Jrc3BhY2UsICdhYmMgJHtjb25maWc6ZWRpdG9yLm5vbmUubm9uZTJ9IHh5eicpKTtcblx0fSk7XG5cblx0dGVzdCgnYSBzaW5nbGUgY29tbWFuZCB2YXJpYWJsZScsICgpID0+IHtcblxuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHQnbmFtZSc6ICdBdHRhY2ggdG8gUHJvY2VzcycsXG5cdFx0XHQndHlwZSc6ICdub2RlJyxcblx0XHRcdCdyZXF1ZXN0JzogJ2F0dGFjaCcsXG5cdFx0XHQncHJvY2Vzc0lkJzogJyR7Y29tbWFuZDpjb21tYW5kMX0nLFxuXHRcdFx0J3BvcnQnOiA1ODU4LFxuXHRcdFx0J3NvdXJjZU1hcHMnOiBmYWxzZSxcblx0XHRcdCdvdXREaXInOiBudWxsXG5cdFx0fTtcblxuXHRcdHJldHVybiBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIS5yZXNvbHZlV2l0aEludGVyYWN0aW9uUmVwbGFjZSh1bmRlZmluZWQsIGNvbmZpZ3VyYXRpb24pLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoeyAuLi5yZXN1bHQgfSwge1xuXHRcdFx0XHQnbmFtZSc6ICdBdHRhY2ggdG8gUHJvY2VzcycsXG5cdFx0XHRcdCd0eXBlJzogJ25vZGUnLFxuXHRcdFx0XHQncmVxdWVzdCc6ICdhdHRhY2gnLFxuXHRcdFx0XHQncHJvY2Vzc0lkJzogJ2NvbW1hbmQxLXJlc3VsdCcsXG5cdFx0XHRcdCdwb3J0JzogNTg1OCxcblx0XHRcdFx0J3NvdXJjZU1hcHMnOiBmYWxzZSxcblx0XHRcdFx0J291dERpcic6IG51bGxcblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMSwgbW9ja0NvbW1hbmRTZXJ2aWNlLmNhbGxDb3VudCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FuIG9sZCBzdHlsZSBjb21tYW5kIHZhcmlhYmxlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHQnbmFtZSc6ICdBdHRhY2ggdG8gUHJvY2VzcycsXG5cdFx0XHQndHlwZSc6ICdub2RlJyxcblx0XHRcdCdyZXF1ZXN0JzogJ2F0dGFjaCcsXG5cdFx0XHQncHJvY2Vzc0lkJzogJyR7Y29tbWFuZDpjb21tYW5kVmFyaWFibGUxfScsXG5cdFx0XHQncG9ydCc6IDU4NTgsXG5cdFx0XHQnc291cmNlTWFwcyc6IGZhbHNlLFxuXHRcdFx0J291dERpcic6IG51bGxcblx0XHR9O1xuXHRcdGNvbnN0IGNvbW1hbmRWYXJpYWJsZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdGNvbW1hbmRWYXJpYWJsZXNbJ2NvbW1hbmRWYXJpYWJsZTEnXSA9ICdjb21tYW5kMSc7XG5cblx0XHRyZXR1cm4gY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZVdpdGhJbnRlcmFjdGlvblJlcGxhY2UodW5kZWZpbmVkLCBjb25maWd1cmF0aW9uLCB1bmRlZmluZWQsIGNvbW1hbmRWYXJpYWJsZXMpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoeyAuLi5yZXN1bHQgfSwge1xuXHRcdFx0XHQnbmFtZSc6ICdBdHRhY2ggdG8gUHJvY2VzcycsXG5cdFx0XHRcdCd0eXBlJzogJ25vZGUnLFxuXHRcdFx0XHQncmVxdWVzdCc6ICdhdHRhY2gnLFxuXHRcdFx0XHQncHJvY2Vzc0lkJzogJ2NvbW1hbmQxLXJlc3VsdCcsXG5cdFx0XHRcdCdwb3J0JzogNTg1OCxcblx0XHRcdFx0J3NvdXJjZU1hcHMnOiBmYWxzZSxcblx0XHRcdFx0J291dERpcic6IG51bGxcblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMSwgbW9ja0NvbW1hbmRTZXJ2aWNlLmNhbGxDb3VudCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpcGxlIG5ldyBhbmQgb2xkLXN0eWxlIGNvbW1hbmQgdmFyaWFibGVzJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgY29uZmlndXJhdGlvbiA9IHtcblx0XHRcdCduYW1lJzogJ0F0dGFjaCB0byBQcm9jZXNzJyxcblx0XHRcdCd0eXBlJzogJ25vZGUnLFxuXHRcdFx0J3JlcXVlc3QnOiAnYXR0YWNoJyxcblx0XHRcdCdwcm9jZXNzSWQnOiAnJHtjb21tYW5kOmNvbW1hbmRWYXJpYWJsZTF9Jyxcblx0XHRcdCdwaWQnOiAnJHtjb21tYW5kOmNvbW1hbmQyfScsXG5cdFx0XHQnc291cmNlTWFwcyc6IGZhbHNlLFxuXHRcdFx0J291dERpcic6ICdzcmMvJHtjb21tYW5kOmNvbW1hbmQyfScsXG5cdFx0XHQnZW52Jzoge1xuXHRcdFx0XHQncHJvY2Vzc0lkJzogJ19fJHtjb21tYW5kOmNvbW1hbmQyfV9fJyxcblx0XHRcdH1cblx0XHR9O1xuXHRcdGNvbnN0IGNvbW1hbmRWYXJpYWJsZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdGNvbW1hbmRWYXJpYWJsZXNbJ2NvbW1hbmRWYXJpYWJsZTEnXSA9ICdjb21tYW5kMSc7XG5cblx0XHRyZXR1cm4gY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZVdpdGhJbnRlcmFjdGlvblJlcGxhY2UodW5kZWZpbmVkLCBjb25maWd1cmF0aW9uLCB1bmRlZmluZWQsIGNvbW1hbmRWYXJpYWJsZXMpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdGNvbnN0IGV4cGVjdGVkID0ge1xuXHRcdFx0XHQnbmFtZSc6ICdBdHRhY2ggdG8gUHJvY2VzcycsXG5cdFx0XHRcdCd0eXBlJzogJ25vZGUnLFxuXHRcdFx0XHQncmVxdWVzdCc6ICdhdHRhY2gnLFxuXHRcdFx0XHQncHJvY2Vzc0lkJzogJ2NvbW1hbmQxLXJlc3VsdCcsXG5cdFx0XHRcdCdwaWQnOiAnY29tbWFuZDItcmVzdWx0Jyxcblx0XHRcdFx0J3NvdXJjZU1hcHMnOiBmYWxzZSxcblx0XHRcdFx0J291dERpcic6ICdzcmMvY29tbWFuZDItcmVzdWx0Jyxcblx0XHRcdFx0J2Vudic6IHtcblx0XHRcdFx0XHQncHJvY2Vzc0lkJzogJ19fY29tbWFuZDItcmVzdWx0X18nLFxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKE9iamVjdC5rZXlzKHJlc3VsdCksIE9iamVjdC5rZXlzKGV4cGVjdGVkKSk7XG5cdFx0XHRPYmplY3Qua2V5cyhyZXN1bHQpLmZvckVhY2gocHJvcGVydHkgPT4ge1xuXHRcdFx0XHRjb25zdCBleHBlY3RlZFByb3BlcnR5ID0gKDxhbnk+ZXhwZWN0ZWQpW3Byb3BlcnR5XTtcblx0XHRcdFx0aWYgKGlzT2JqZWN0KHJlc3VsdFtwcm9wZXJ0eV0pKSB7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh7IC4uLnJlc3VsdFtwcm9wZXJ0eV0gfSwgZXhwZWN0ZWRQcm9wZXJ0eSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHRbcHJvcGVydHldLCBleHBlY3RlZFByb3BlcnR5KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMiwgbW9ja0NvbW1hbmRTZXJ2aWNlLmNhbGxDb3VudCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2EgY29tbWFuZCB2YXJpYWJsZSB0aGF0IHJlbGllcyBvbiByZXNvbHZlZCBlbnYgdmFycycsICgpID0+IHtcblxuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHQnbmFtZSc6ICdBdHRhY2ggdG8gUHJvY2VzcycsXG5cdFx0XHQndHlwZSc6ICdub2RlJyxcblx0XHRcdCdyZXF1ZXN0JzogJ2F0dGFjaCcsXG5cdFx0XHQncHJvY2Vzc0lkJzogJyR7Y29tbWFuZDpjb21tYW5kVmFyaWFibGUxfScsXG5cdFx0XHQndmFsdWUnOiAnJHtlbnY6a2V5MX0nXG5cdFx0fTtcblx0XHRjb25zdCBjb21tYW5kVmFyaWFibGVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRjb21tYW5kVmFyaWFibGVzWydjb21tYW5kVmFyaWFibGUxJ10gPSAnY29tbWFuZDEnO1xuXG5cdFx0cmV0dXJuIGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UhLnJlc29sdmVXaXRoSW50ZXJhY3Rpb25SZXBsYWNlKHVuZGVmaW5lZCwgY29uZmlndXJhdGlvbiwgdW5kZWZpbmVkLCBjb21tYW5kVmFyaWFibGVzKS50aGVuKHJlc3VsdCA9PiB7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoeyAuLi5yZXN1bHQgfSwge1xuXHRcdFx0XHQnbmFtZSc6ICdBdHRhY2ggdG8gUHJvY2VzcycsXG5cdFx0XHRcdCd0eXBlJzogJ25vZGUnLFxuXHRcdFx0XHQncmVxdWVzdCc6ICdhdHRhY2gnLFxuXHRcdFx0XHQncHJvY2Vzc0lkJzogJ1ZhbHVlIGZvciBrZXkxJyxcblx0XHRcdFx0J3ZhbHVlJzogJ1ZhbHVlIGZvciBrZXkxJ1xuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgxLCBtb2NrQ29tbWFuZFNlcnZpY2UuY2FsbENvdW50KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnYSBzaW5nbGUgcHJvbXB0IGlucHV0IHZhcmlhYmxlJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgY29uZmlndXJhdGlvbiA9IHtcblx0XHRcdCduYW1lJzogJ0F0dGFjaCB0byBQcm9jZXNzJyxcblx0XHRcdCd0eXBlJzogJ25vZGUnLFxuXHRcdFx0J3JlcXVlc3QnOiAnYXR0YWNoJyxcblx0XHRcdCdwcm9jZXNzSWQnOiAnJHtpbnB1dDppbnB1dDF9Jyxcblx0XHRcdCdwb3J0JzogNTg1OCxcblx0XHRcdCdzb3VyY2VNYXBzJzogZmFsc2UsXG5cdFx0XHQnb3V0RGlyJzogbnVsbFxuXHRcdH07XG5cblx0XHRyZXR1cm4gY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZVdpdGhJbnRlcmFjdGlvblJlcGxhY2Uod29ya3NwYWNlLCBjb25maWd1cmF0aW9uLCAndGFza3MnKS50aGVuKHJlc3VsdCA9PiB7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoeyAuLi5yZXN1bHQgfSwge1xuXHRcdFx0XHQnbmFtZSc6ICdBdHRhY2ggdG8gUHJvY2VzcycsXG5cdFx0XHRcdCd0eXBlJzogJ25vZGUnLFxuXHRcdFx0XHQncmVxdWVzdCc6ICdhdHRhY2gnLFxuXHRcdFx0XHQncHJvY2Vzc0lkJzogJ3Jlc29sdmVkRW50ZXJpbnB1dDEnLFxuXHRcdFx0XHQncG9ydCc6IDU4NTgsXG5cdFx0XHRcdCdzb3VyY2VNYXBzJzogZmFsc2UsXG5cdFx0XHRcdCdvdXREaXInOiBudWxsXG5cdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDAsIG1vY2tDb21tYW5kU2VydmljZS5jYWxsQ291bnQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdhIHNpbmdsZSBwaWNrIGlucHV0IHZhcmlhYmxlJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgY29uZmlndXJhdGlvbiA9IHtcblx0XHRcdCduYW1lJzogJ0F0dGFjaCB0byBQcm9jZXNzJyxcblx0XHRcdCd0eXBlJzogJ25vZGUnLFxuXHRcdFx0J3JlcXVlc3QnOiAnYXR0YWNoJyxcblx0XHRcdCdwcm9jZXNzSWQnOiAnJHtpbnB1dDppbnB1dDJ9Jyxcblx0XHRcdCdwb3J0JzogNTg1OCxcblx0XHRcdCdzb3VyY2VNYXBzJzogZmFsc2UsXG5cdFx0XHQnb3V0RGlyJzogbnVsbFxuXHRcdH07XG5cblx0XHRyZXR1cm4gY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZVdpdGhJbnRlcmFjdGlvblJlcGxhY2Uod29ya3NwYWNlLCBjb25maWd1cmF0aW9uLCAndGFza3MnKS50aGVuKHJlc3VsdCA9PiB7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoeyAuLi5yZXN1bHQgfSwge1xuXHRcdFx0XHQnbmFtZSc6ICdBdHRhY2ggdG8gUHJvY2VzcycsXG5cdFx0XHRcdCd0eXBlJzogJ25vZGUnLFxuXHRcdFx0XHQncmVxdWVzdCc6ICdhdHRhY2gnLFxuXHRcdFx0XHQncHJvY2Vzc0lkJzogJ3NlbGVjdGVkUGljaycsXG5cdFx0XHRcdCdwb3J0JzogNTg1OCxcblx0XHRcdFx0J3NvdXJjZU1hcHMnOiBmYWxzZSxcblx0XHRcdFx0J291dERpcic6IG51bGxcblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMCwgbW9ja0NvbW1hbmRTZXJ2aWNlLmNhbGxDb3VudCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Egc2luZ2xlIGNvbW1hbmQgaW5wdXQgdmFyaWFibGUnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBjb25maWd1cmF0aW9uID0ge1xuXHRcdFx0J25hbWUnOiAnQXR0YWNoIHRvIFByb2Nlc3MnLFxuXHRcdFx0J3R5cGUnOiAnbm9kZScsXG5cdFx0XHQncmVxdWVzdCc6ICdhdHRhY2gnLFxuXHRcdFx0J3Byb2Nlc3NJZCc6ICcke2lucHV0OmlucHV0NH0nLFxuXHRcdFx0J3BvcnQnOiA1ODU4LFxuXHRcdFx0J3NvdXJjZU1hcHMnOiBmYWxzZSxcblx0XHRcdCdvdXREaXInOiBudWxsXG5cdFx0fTtcblxuXHRcdHJldHVybiBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIS5yZXNvbHZlV2l0aEludGVyYWN0aW9uUmVwbGFjZSh3b3Jrc3BhY2UsIGNvbmZpZ3VyYXRpb24sICd0YXNrcycpLnRoZW4ocmVzdWx0ID0+IHtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh7IC4uLnJlc3VsdCB9LCB7XG5cdFx0XHRcdCduYW1lJzogJ0F0dGFjaCB0byBQcm9jZXNzJyxcblx0XHRcdFx0J3R5cGUnOiAnbm9kZScsXG5cdFx0XHRcdCdyZXF1ZXN0JzogJ2F0dGFjaCcsXG5cdFx0XHRcdCdwcm9jZXNzSWQnOiAnYXJnIGZvciBjb21tYW5kJyxcblx0XHRcdFx0J3BvcnQnOiA1ODU4LFxuXHRcdFx0XHQnc291cmNlTWFwcyc6IGZhbHNlLFxuXHRcdFx0XHQnb3V0RGlyJzogbnVsbFxuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgxLCBtb2NrQ29tbWFuZFNlcnZpY2UuY2FsbENvdW50KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnc2V2ZXJhbCBpbnB1dCB2YXJpYWJsZXMgYW5kIGNvbW1hbmQnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBjb25maWd1cmF0aW9uID0ge1xuXHRcdFx0J25hbWUnOiAnJHtpbnB1dDppbnB1dDN9Jyxcblx0XHRcdCd0eXBlJzogJyR7Y29tbWFuZDpjb21tYW5kMX0nLFxuXHRcdFx0J3JlcXVlc3QnOiAnJHtpbnB1dDppbnB1dDF9Jyxcblx0XHRcdCdwcm9jZXNzSWQnOiAnJHtpbnB1dDppbnB1dDJ9Jyxcblx0XHRcdCdjb21tYW5kJzogJyR7aW5wdXQ6aW5wdXQ0fScsXG5cdFx0XHQncG9ydCc6IDU4NTgsXG5cdFx0XHQnc291cmNlTWFwcyc6IGZhbHNlLFxuXHRcdFx0J291dERpcic6IG51bGxcblx0XHR9O1xuXG5cdFx0cmV0dXJuIGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UhLnJlc29sdmVXaXRoSW50ZXJhY3Rpb25SZXBsYWNlKHdvcmtzcGFjZSwgY29uZmlndXJhdGlvbiwgJ3Rhc2tzJykudGhlbihyZXN1bHQgPT4ge1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHsgLi4ucmVzdWx0IH0sIHtcblx0XHRcdFx0J25hbWUnOiAncmVzb2x2ZWRFbnRlcmlucHV0MycsXG5cdFx0XHRcdCd0eXBlJzogJ2NvbW1hbmQxLXJlc3VsdCcsXG5cdFx0XHRcdCdyZXF1ZXN0JzogJ3Jlc29sdmVkRW50ZXJpbnB1dDEnLFxuXHRcdFx0XHQncHJvY2Vzc0lkJzogJ3NlbGVjdGVkUGljaycsXG5cdFx0XHRcdCdjb21tYW5kJzogJ2FyZyBmb3IgY29tbWFuZCcsXG5cdFx0XHRcdCdwb3J0JzogNTg1OCxcblx0XHRcdFx0J3NvdXJjZU1hcHMnOiBmYWxzZSxcblx0XHRcdFx0J291dERpcic6IG51bGxcblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMiwgbW9ja0NvbW1hbmRTZXJ2aWNlLmNhbGxDb3VudCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lucHV0IHZhcmlhYmxlIHdpdGggdW5kZWZpbmVkIHdvcmtzcGFjZSBmb2xkZXInLCAoKSA9PiB7XG5cblx0XHRjb25zdCBjb25maWd1cmF0aW9uID0ge1xuXHRcdFx0J25hbWUnOiAnQXR0YWNoIHRvIFByb2Nlc3MnLFxuXHRcdFx0J3R5cGUnOiAnbm9kZScsXG5cdFx0XHQncmVxdWVzdCc6ICdhdHRhY2gnLFxuXHRcdFx0J3Byb2Nlc3NJZCc6ICcke2lucHV0OmlucHV0MX0nLFxuXHRcdFx0J3BvcnQnOiA1ODU4LFxuXHRcdFx0J3NvdXJjZU1hcHMnOiBmYWxzZSxcblx0XHRcdCdvdXREaXInOiBudWxsXG5cdFx0fTtcblxuXHRcdHJldHVybiBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIS5yZXNvbHZlV2l0aEludGVyYWN0aW9uUmVwbGFjZSh1bmRlZmluZWQsIGNvbmZpZ3VyYXRpb24sICd0YXNrcycpLnRoZW4ocmVzdWx0ID0+IHtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh7IC4uLnJlc3VsdCB9LCB7XG5cdFx0XHRcdCduYW1lJzogJ0F0dGFjaCB0byBQcm9jZXNzJyxcblx0XHRcdFx0J3R5cGUnOiAnbm9kZScsXG5cdFx0XHRcdCdyZXF1ZXN0JzogJ2F0dGFjaCcsXG5cdFx0XHRcdCdwcm9jZXNzSWQnOiAncmVzb2x2ZWRFbnRlcmlucHV0MScsXG5cdFx0XHRcdCdwb3J0JzogNTg1OCxcblx0XHRcdFx0J3NvdXJjZU1hcHMnOiBmYWxzZSxcblx0XHRcdFx0J291dERpcic6IG51bGxcblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMCwgbW9ja0NvbW1hbmRTZXJ2aWNlLmNhbGxDb3VudCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbnRyaWJ1dGVkIHZhcmlhYmxlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGJ1aWxkVGFzayA9ICducG06IGNvbXBpbGUnO1xuXHRcdGNvbnN0IHZhcmlhYmxlID0gJ2RlZmF1bHRCdWlsZFRhc2snO1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHQnbmFtZSc6ICckeycgKyB2YXJpYWJsZSArICd9Jyxcblx0XHR9O1xuXHRcdGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UhLmNvbnRyaWJ1dGVWYXJpYWJsZSh2YXJpYWJsZSwgYXN5bmMgKCkgPT4geyByZXR1cm4gYnVpbGRUYXNrOyB9KTtcblx0XHRyZXR1cm4gY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZVdpdGhJbnRlcmFjdGlvblJlcGxhY2Uod29ya3NwYWNlLCBjb25maWd1cmF0aW9uKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHsgLi4ucmVzdWx0IH0sIHtcblx0XHRcdFx0J25hbWUnOiBgJHtidWlsZFRhc2t9YFxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVXaXRoRW52aXJvbm1lbnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZW52ID0ge1xuXHRcdFx0J1ZBUl8xJzogJ1ZBTF8xJyxcblx0XHRcdCdWQVJfMic6ICdWQUxfMidcblx0XHR9O1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb24gPSAnZWNobyAke2VudjpWQVJfMX0ke2VudjpWQVJfMn0nO1xuXHRcdGNvbnN0IHJlc29sdmVkUmVzdWx0ID0gYXdhaXQgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSEucmVzb2x2ZVdpdGhFbnZpcm9ubWVudCh7IC4uLmVudiB9LCB1bmRlZmluZWQsIGNvbmZpZ3VyYXRpb24pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzb2x2ZWRSZXN1bHQsICdlY2hvIFZBTF8xVkFMXzInKTtcblx0fSk7XG59KTtcblxuXG5jbGFzcyBNb2NrQ29tbWFuZFNlcnZpY2UgaW1wbGVtZW50cyBJQ29tbWFuZFNlcnZpY2Uge1xuXG5cdHB1YmxpYyBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHB1YmxpYyBjYWxsQ291bnQgPSAwO1xuXG5cdG9uV2lsbEV4ZWN1dGVDb21tYW5kID0gKCkgPT4gRGlzcG9zYWJsZS5Ob25lO1xuXHRvbkRpZEV4ZWN1dGVDb21tYW5kID0gKCkgPT4gRGlzcG9zYWJsZS5Ob25lO1xuXHRwdWJsaWMgZXhlY3V0ZUNvbW1hbmQoY29tbWFuZElkOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+IHtcblx0XHR0aGlzLmNhbGxDb3VudCsrO1xuXG5cdFx0bGV0IHJlc3VsdCA9IGAke2NvbW1hbmRJZH0tcmVzdWx0YDtcblx0XHRpZiAoYXJncy5sZW5ndGggPj0gMSkge1xuXHRcdFx0aWYgKGFyZ3NbMF0gJiYgYXJnc1swXS52YWx1ZSkge1xuXHRcdFx0XHRyZXN1bHQgPSBhcmdzWzBdLnZhbHVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUocmVzdWx0KTtcblx0fVxufVxuXG5jbGFzcyBNb2NrTGFiZWxTZXJ2aWNlIGltcGxlbWVudHMgSUxhYmVsU2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0Z2V0VXJpTGFiZWwocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IHsgcmVsYXRpdmU/OiBib29sZWFuIHwgdW5kZWZpbmVkOyBub1ByZWZpeD86IGJvb2xlYW4gfCB1bmRlZmluZWQgfSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIG5vcm1hbGl6ZShyZXNvdXJjZS5mc1BhdGgpO1xuXHR9XG5cdGdldFVyaUJhc2VuYW1lTGFiZWwocmVzb3VyY2U6IFVSSSk6IHN0cmluZyB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdGdldFdvcmtzcGFjZUxhYmVsKHdvcmtzcGFjZTogVVJJIHwgSVdvcmtzcGFjZUlkZW50aWZpZXIgfCBJV29ya3NwYWNlLCBvcHRpb25zPzogeyB2ZXJib3NlOiBWZXJib3NpdHkgfSk6IHN0cmluZyB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdGdldEhvc3RMYWJlbChzY2hlbWU6IHN0cmluZywgYXV0aG9yaXR5Pzogc3RyaW5nKTogc3RyaW5nIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0cHVibGljIGdldEhvc3RUb29sdGlwKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdGdldFNlcGFyYXRvcihzY2hlbWU6IHN0cmluZywgYXV0aG9yaXR5Pzogc3RyaW5nKTogJy8nIHwgJ1xcXFwnIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0cmVnaXN0ZXJGb3JtYXR0ZXIoZm9ybWF0dGVyOiBSZXNvdXJjZUxhYmVsRm9ybWF0dGVyKTogSURpc3Bvc2FibGUge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRyZWdpc3RlckNhY2hlZEZvcm1hdHRlcihmb3JtYXR0ZXI6IFJlc291cmNlTGFiZWxGb3JtYXR0ZXIpOiBJRGlzcG9zYWJsZSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdG9uRGlkQ2hhbmdlRm9ybWF0dGVyczogRXZlbnQ8SUZvcm1hdHRlckNoYW5nZUV2ZW50PiA9IG5ldyBFbWl0dGVyPElGb3JtYXR0ZXJDaGFuZ2VFdmVudD4oKS5ldmVudDtcbn1cblxuY2xhc3MgTW9ja1BhdGhTZXJ2aWNlIGltcGxlbWVudHMgSVBhdGhTZXJ2aWNlIHtcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRnZXQgcGF0aCgpOiBQcm9taXNlPElQYXRoPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdQcm9wZXJ0eSBub3QgaW1wbGVtZW50ZWQnKTtcblx0fVxuXHRkZWZhdWx0VXJpU2NoZW1lOiBzdHJpbmcgPSBTY2hlbWFzLmZpbGU7XG5cdGZpbGVVUkkocGF0aDogc3RyaW5nKTogUHJvbWlzZTxVUkk+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0dXNlckhvbWUob3B0aW9ucz86IHsgcHJlZmVyTG9jYWw6IGJvb2xlYW4gfSk6IFByb21pc2U8VVJJPjtcblx0dXNlckhvbWUob3B0aW9uczogeyBwcmVmZXJMb2NhbDogdHJ1ZSB9KTogVVJJO1xuXHR1c2VySG9tZShvcHRpb25zPzogeyBwcmVmZXJMb2NhbDogYm9vbGVhbiB9KTogUHJvbWlzZTxVUkk+IHwgVVJJIHtcblx0XHRjb25zdCB1cmkgPSBVUkkuZmlsZSgnYzpcXFxcdXNlcnNcXFxcdXNlcm5hbWUnKTtcblx0XHRyZXR1cm4gb3B0aW9ucz8ucHJlZmVyTG9jYWwgPyB1cmkgOiBQcm9taXNlLnJlc29sdmUodXJpKTtcblx0fVxuXHRoYXNWYWxpZEJhc2VuYW1lKHJlc291cmNlOiBVUkksIGJhc2VuYW1lPzogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPjtcblx0aGFzVmFsaWRCYXNlbmFtZShyZXNvdXJjZTogVVJJLCBvczogcGxhdGZvcm0uT3BlcmF0aW5nU3lzdGVtLCBiYXNlbmFtZT86IHN0cmluZyk6IGJvb2xlYW47XG5cdGhhc1ZhbGlkQmFzZW5hbWUocmVzb3VyY2U6IFVSSSwgYXJnMj86IHN0cmluZyB8IHBsYXRmb3JtLk9wZXJhdGluZ1N5c3RlbSwgbmFtZT86IHN0cmluZyk6IGJvb2xlYW4gfCBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0cmVzb2x2ZWRVc2VySG9tZTogVVJJIHwgdW5kZWZpbmVkO1xufVxuXG5jbGFzcyBNb2NrSW5wdXRzQ29uZmlndXJhdGlvblNlcnZpY2UgZXh0ZW5kcyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2Uge1xuXHRwdWJsaWMgb3ZlcnJpZGUgZ2V0VmFsdWUoYXJnMT86IGFueSwgYXJnMj86IGFueSk6IGFueSB7XG5cdFx0bGV0IGNvbmZpZ3VyYXRpb247XG5cdFx0aWYgKGFyZzEgPT09ICd0YXNrcycpIHtcblx0XHRcdGNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHRcdGlucHV0czogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGlkOiAnaW5wdXQxJyxcblx0XHRcdFx0XHRcdHR5cGU6ICdwcm9tcHRTdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdFbnRlcmlucHV0MScsXG5cdFx0XHRcdFx0XHRkZWZhdWx0OiAnZGVmYXVsdCBpbnB1dDEnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRpZDogJ2lucHV0MicsXG5cdFx0XHRcdFx0XHR0eXBlOiAncGlja1N0cmluZycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ0VudGVyaW5wdXQxJyxcblx0XHRcdFx0XHRcdGRlZmF1bHQ6ICdvcHRpb24yJyxcblx0XHRcdFx0XHRcdG9wdGlvbnM6IFsnb3B0aW9uMScsICdvcHRpb24yJywgJ29wdGlvbjMnXVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0aWQ6ICdpbnB1dDMnLFxuXHRcdFx0XHRcdFx0dHlwZTogJ3Byb21wdFN0cmluZycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ0VudGVyaW5wdXQzJyxcblx0XHRcdFx0XHRcdGRlZmF1bHQ6ICdkZWZhdWx0IGlucHV0MycsXG5cdFx0XHRcdFx0XHRwcm92aWRlOiB0cnVlLFxuXHRcdFx0XHRcdFx0cGFzc3dvcmQ6IHRydWVcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGlkOiAnaW5wdXQ0Jyxcblx0XHRcdFx0XHRcdHR5cGU6ICdjb21tYW5kJyxcblx0XHRcdFx0XHRcdGNvbW1hbmQ6ICdjb21tYW5kMScsXG5cdFx0XHRcdFx0XHRhcmdzOiB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlOiAnYXJnIGZvciBjb21tYW5kJ1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmV0dXJuIGNvbmZpZ3VyYXRpb247XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgaW5zcGVjdDxUPihrZXk6IHN0cmluZywgb3ZlcnJpZGVzPzogSUNvbmZpZ3VyYXRpb25PdmVycmlkZXMpOiBJQ29uZmlndXJhdGlvblZhbHVlPFQ+IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dmFsdWU6IHVuZGVmaW5lZCxcblx0XHRcdGRlZmF1bHRWYWx1ZTogdW5kZWZpbmVkLFxuXHRcdFx0dXNlclZhbHVlOiB1bmRlZmluZWQsXG5cdFx0XHRvdmVycmlkZUlkZW50aWZpZXJzOiBbXVxuXHRcdH07XG5cdH1cbn1cblxuc3VpdGUoJ0NvbmZpZ3VyYXRpb25SZXNvbHZlckV4cHJlc3Npb24nLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ3BhcnNlIGVtcHR5IG9iamVjdCcsICgpID0+IHtcblx0XHRjb25zdCBleHByID0gQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5wYXJzZSh7fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKEFycmF5LmZyb20oZXhwci51bnJlc29sdmVkKCkpLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChleHByLnRvT2JqZWN0KCksIHt9KTtcblx0fSk7XG5cblx0dGVzdCgncGFyc2Ugc2ltcGxlIHN0cmluZycsICgpID0+IHtcblx0XHRjb25zdCBleHByID0gQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5wYXJzZSh7IHZhbHVlOiAnJHtlbnY6SE9NRX0nIH0pO1xuXHRcdGNvbnN0IHVucmVzb2x2ZWQgPSBBcnJheS5mcm9tKGV4cHIudW5yZXNvbHZlZCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5yZXNvbHZlZC5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnJlc29sdmVkWzBdLm5hbWUsICdlbnYnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5yZXNvbHZlZFswXS5hcmcsICdIT01FJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BhcnNlIHN0cmluZyB3aXRoIGFyZ3VtZW50IGFuZCBjb2xvbicsICgpID0+IHtcblx0XHRjb25zdCBleHByID0gQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5wYXJzZSh7IHZhbHVlOiAnJHtjb25maWc6cGF0aDp0bzp2YWx1ZX0nIH0pO1xuXHRcdGNvbnN0IHVucmVzb2x2ZWQgPSBBcnJheS5mcm9tKGV4cHIudW5yZXNvbHZlZCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5yZXNvbHZlZC5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnJlc29sdmVkWzBdLm5hbWUsICdjb25maWcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5yZXNvbHZlZFswXS5hcmcsICdwYXRoOnRvOnZhbHVlJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BhcnNlIG9iamVjdCB3aXRoIG5lc3RlZCB2YXJpYWJsZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXhwciA9IENvbmZpZ3VyYXRpb25SZXNvbHZlckV4cHJlc3Npb24ucGFyc2Uoe1xuXHRcdFx0bmFtZTogJyR7ZW52OlVTRVJOQU1FfScsXG5cdFx0XHRwYXRoOiAnJHtlbnY6SE9NRX0vZm9sZGVyJyxcblx0XHRcdHNldHRpbmdzOiB7XG5cdFx0XHRcdHZhbHVlOiAnJHtjb25maWc6cGF0aH0nXG5cdFx0XHR9LFxuXHRcdFx0YXJyYXk6IFsnJHtlbnY6VEVSTX0nLCB7IGtleTogJyR7ZW52OktFWX0nIH1dXG5cdFx0fSk7XG5cblx0XHRjb25zdCB1bnJlc29sdmVkID0gQXJyYXkuZnJvbShleHByLnVucmVzb2x2ZWQoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVucmVzb2x2ZWQubGVuZ3RoLCA1KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHVucmVzb2x2ZWQubWFwKHIgPT4gci5uYW1lKS5zb3J0KCksIFsnY29uZmlnJywgJ2VudicsICdlbnYnLCAnZW52JywgJ2VudiddKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZSBhbmQgZ2V0IHJlc3VsdCcsICgpID0+IHtcblx0XHRjb25zdCBleHByID0gQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5wYXJzZSh7XG5cdFx0XHRuYW1lOiAnJHtlbnY6VVNFUk5BTUV9Jyxcblx0XHRcdHBhdGg6ICcke2VudjpIT01FfS9mb2xkZXInXG5cdFx0fSk7XG5cblx0XHRleHByLnJlc29sdmUoeyBpbm5lcjogJ2VudjpVU0VSTkFNRScsIGlkOiAnJHtlbnY6VVNFUk5BTUV9JywgbmFtZTogJ2VudicsIGFyZzogJ1VTRVJOQU1FJyB9LCAndGVzdHVzZXInKTtcblx0XHRleHByLnJlc29sdmUoeyBpbm5lcjogJ2VudjpIT01FJywgaWQ6ICcke2VudjpIT01FfScsIG5hbWU6ICdlbnYnLCBhcmc6ICdIT01FJyB9LCAnL2hvbWUvdGVzdHVzZXInKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZXhwci50b09iamVjdCgpLCB7XG5cdFx0XHRuYW1lOiAndGVzdHVzZXInLFxuXHRcdFx0cGF0aDogJy9ob21lL3Rlc3R1c2VyL2ZvbGRlcidcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgna2VlcHMgdW5yZXNvbHZlZCB2YXJpYWJsZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXhwciA9IENvbmZpZ3VyYXRpb25SZXNvbHZlckV4cHJlc3Npb24ucGFyc2Uoe1xuXHRcdFx0bmFtZTogJyR7ZW52OlVTRVJOQU1FfSdcblx0XHR9KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZXhwci50b09iamVjdCgpLCB7XG5cdFx0XHRuYW1lOiAnJHtlbnY6VVNFUk5BTUV9J1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWR1cGxpY2F0ZXMgaWRlbnRpY2FsIHZhcmlhYmxlcycsICgpID0+IHtcblx0XHRjb25zdCBleHByID0gQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5wYXJzZSh7XG5cdFx0XHRmaXJzdDogJyR7ZW52OkhPTUV9Jyxcblx0XHRcdHNlY29uZDogJyR7ZW52OkhPTUV9J1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdW5yZXNvbHZlZCA9IEFycmF5LmZyb20oZXhwci51bnJlc29sdmVkKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnJlc29sdmVkLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVucmVzb2x2ZWRbMF0ubmFtZSwgJ2VudicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnJlc29sdmVkWzBdLmFyZywgJ0hPTUUnKTtcblxuXHRcdGV4cHIucmVzb2x2ZSh1bnJlc29sdmVkWzBdLCAnL2hvbWUvdXNlcicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZXhwci50b09iamVjdCgpLCB7XG5cdFx0XHRmaXJzdDogJy9ob21lL3VzZXInLFxuXHRcdFx0c2Vjb25kOiAnL2hvbWUvdXNlcidcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaGFuZGxlcyByb290IHN0cmluZyB2YWx1ZScsICgpID0+IHtcblx0XHRjb25zdCBleHByID0gQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5wYXJzZSgnYWJjICR7ZW52OkhPTUV9IHh5eicpO1xuXHRcdGNvbnN0IHVucmVzb2x2ZWQgPSBBcnJheS5mcm9tKGV4cHIudW5yZXNvbHZlZCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5yZXNvbHZlZC5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnJlc29sdmVkWzBdLm5hbWUsICdlbnYnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5yZXNvbHZlZFswXS5hcmcsICdIT01FJyk7XG5cblx0XHRleHByLnJlc29sdmUodW5yZXNvbHZlZFswXSwgJy9ob21lL3VzZXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhwci50b09iamVjdCgpLCAnYWJjIC9ob21lL3VzZXIgeHl6Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2hhbmRsZXMgcm9vdCBzdHJpbmcgdmFsdWUgd2l0aCBtdWx0aXBsZSB2YXJpYWJsZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXhwciA9IENvbmZpZ3VyYXRpb25SZXNvbHZlckV4cHJlc3Npb24ucGFyc2UoJyR7ZW52OkhPTUV9L2ZvbGRlciR7ZW52OlNIRUxMfScpO1xuXHRcdGNvbnN0IHVucmVzb2x2ZWQgPSBBcnJheS5mcm9tKGV4cHIudW5yZXNvbHZlZCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5yZXNvbHZlZC5sZW5ndGgsIDIpO1xuXG5cdFx0ZXhwci5yZXNvbHZlKHsgaWQ6ICcke2VudjpIT01FfScsIGlubmVyOiAnZW52OkhPTUUnLCBuYW1lOiAnZW52JywgYXJnOiAnSE9NRScgfSwgJy9ob21lL3VzZXInKTtcblx0XHRleHByLnJlc29sdmUoeyBpZDogJyR7ZW52OlNIRUxMfScsIGlubmVyOiAnZW52OlNIRUxMJywgbmFtZTogJ2VudicsIGFyZzogJ1NIRUxMJyB9LCAnL2Jpbi9iYXNoJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4cHIudG9PYmplY3QoKSwgJy9ob21lL3VzZXIvZm9sZGVyL2Jpbi9iYXNoJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2hhbmRsZXMgcm9vdCBzdHJpbmcgd2l0aCBlc2NhcGVkIHZhcmlhYmxlcycsICgpID0+IHtcblx0XHRjb25zdCBleHByID0gQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5wYXJzZSgnYWJjICR7ZW52OkhPTUUke2VudjpVU0VSfX0geHl6Jyk7XG5cdFx0Y29uc3QgdW5yZXNvbHZlZCA9IEFycmF5LmZyb20oZXhwci51bnJlc29sdmVkKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnJlc29sdmVkLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVucmVzb2x2ZWRbMF0ubmFtZSwgJ2VudicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnJlc29sdmVkWzBdLmFyZywgJ0hPTUUke2VudjpVU0VSfScpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsWUFBWTtBQUNyQixTQUFTLGVBQXNCO0FBQy9CLFNBQVMsa0JBQStCO0FBQ3hDLFNBQVMsZUFBZTtBQUN4QixTQUFnQixpQkFBaUI7QUFDakMsWUFBWSxjQUFjO0FBQzFCLFNBQVMsU0FBUyxhQUFhLGlCQUFpQjtBQUNoRCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFdBQVc7QUFDcEIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxrQkFBa0I7QUFHM0IsU0FBUyxnQ0FBZ0M7QUFJekMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxtQkFBbUIsNkJBQTZCO0FBQ3pELFNBQVMsb0JBQW9CLHNCQUFzQiwwQkFBMEI7QUFHN0UsU0FBUyx3Q0FBd0M7QUFFakQsU0FBUyx1Q0FBdUM7QUFFaEQsTUFBTSxpQkFBaUI7QUFDdkIsTUFBTSwwQ0FBMEMsa0JBQWtCO0FBQUEsRUFDakUsSUFBYSwwQkFBK0I7QUFDM0MsV0FBTztBQUFBLE1BQ04sZ0JBQWdCO0FBQ2Ys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
