import assert from "assert";
import { URI } from "../../../../base/common/uri.js";
import { ExtHostWorkspace } from "../../common/extHostWorkspace.js";
import { ExtHostConfigProvider } from "../../common/extHostConfiguration.js";
import { ConfigurationModel, ConfigurationModelParser } from "../../../../platform/configuration/common/configurationModels.js";
import { TestRPCProtocol } from "../common/testRPCProtocol.js";
import { mock } from "../../../../base/test/common/mock.js";
import { WorkspaceFolder } from "../../../../platform/workspace/common/workspace.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { NullLogService } from "../../../../platform/log/common/log.js";
import { FileSystemProviderCapabilities } from "../../../../platform/files/common/files.js";
import { isLinux } from "../../../../base/common/platform.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
suite("ExtHostConfiguration", function() {
  class RecordingShape extends mock() {
    $updateConfigurationOption(target, key, value) {
      this.lastArgs = [target, key, value];
      return Promise.resolve(void 0);
    }
  }
  function createExtHostWorkspace() {
    return new ExtHostWorkspace(new TestRPCProtocol(), new class extends mock() {
    }(), new class extends mock() {
      getCapabilities() {
        return isLinux ? FileSystemProviderCapabilities.PathCaseSensitive : void 0;
      }
    }(), new NullLogService(), new class extends mock() {
    }());
  }
  function createExtHostConfiguration(contents = /* @__PURE__ */ Object.create(null), shape) {
    if (!shape) {
      shape = new class extends mock() {
      }();
    }
    return new ExtHostConfigProvider(shape, createExtHostWorkspace(), createConfigurationData(contents), new NullLogService());
  }
  function createConfigurationData(contents) {
    return {
      defaults: new ConfigurationModel(contents, [], [], void 0, new NullLogService()),
      policy: ConfigurationModel.createEmptyModel(new NullLogService()),
      application: ConfigurationModel.createEmptyModel(new NullLogService()),
      userLocal: new ConfigurationModel(contents, [], [], void 0, new NullLogService()),
      userRemote: ConfigurationModel.createEmptyModel(new NullLogService()),
      workspace: ConfigurationModel.createEmptyModel(new NullLogService()),
      folders: [],
      configurationScopes: []
    };
  }
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  test("getConfiguration fails regression test 1.7.1 -> 1.8 #15552", function() {
    const extHostConfig = createExtHostConfiguration({
      "search": {
        "exclude": {
          "**/node_modules": true
        }
      }
    });
    assert.strictEqual(extHostConfig.getConfiguration("search.exclude")["**/node_modules"], true);
    assert.strictEqual(extHostConfig.getConfiguration("search.exclude").get("**/node_modules"), true);
    assert.strictEqual(extHostConfig.getConfiguration("search").get("exclude")["**/node_modules"], true);
    assert.strictEqual(extHostConfig.getConfiguration("search.exclude").has("**/node_modules"), true);
    assert.strictEqual(extHostConfig.getConfiguration("search").has("exclude.**/node_modules"), true);
  });
  test("has/get", () => {
    const all = createExtHostConfiguration({
      "farboo": {
        "config0": true,
        "nested": {
          "config1": 42,
          "config2": "Das Pferd frisst kein Reis."
        },
        "config4": ""
      }
    });
    const config = all.getConfiguration("farboo");
    assert.ok(config.has("config0"));
    assert.strictEqual(config.get("config0"), true);
    assert.strictEqual(config.get("config4"), "");
    assert.strictEqual(config["config0"], true);
    assert.strictEqual(config["config4"], "");
    assert.ok(config.has("nested.config1"));
    assert.strictEqual(config.get("nested.config1"), 42);
    assert.ok(config.has("nested.config2"));
    assert.strictEqual(config.get("nested.config2"), "Das Pferd frisst kein Reis.");
    assert.ok(config.has("nested"));
    assert.deepStrictEqual(config.get("nested"), { config1: 42, config2: "Das Pferd frisst kein Reis." });
  });
  test("get nested config", () => {
    const all = createExtHostConfiguration({
      "farboo": {
        "config0": true,
        "nested": {
          "config1": 42,
          "config2": "Das Pferd frisst kein Reis."
        },
        "config4": ""
      }
    });
    assert.deepStrictEqual(all.getConfiguration("farboo.nested").get("config1"), 42);
    assert.deepStrictEqual(all.getConfiguration("farboo.nested").get("config2"), "Das Pferd frisst kein Reis.");
    assert.deepStrictEqual(all.getConfiguration("farboo.nested")["config1"], 42);
    assert.deepStrictEqual(all.getConfiguration("farboo.nested")["config2"], "Das Pferd frisst kein Reis.");
    assert.deepStrictEqual(all.getConfiguration("farboo.nested1").get("config1"), void 0);
    assert.deepStrictEqual(all.getConfiguration("farboo.nested1").get("config2"), void 0);
    assert.deepStrictEqual(all.getConfiguration("farboo.config0.config1").get("a"), void 0);
    assert.deepStrictEqual(all.getConfiguration("farboo.config0.config1")["a"], void 0);
  });
  test("can modify the returned configuration", function() {
    const all = createExtHostConfiguration({
      "farboo": {
        "config0": true,
        "nested": {
          "config1": 42,
          "config2": "Das Pferd frisst kein Reis."
        },
        "config4": ""
      },
      "workbench": {
        "colorCustomizations": {
          "statusBar.foreground": "somevalue"
        }
      }
    });
    let testObject = all.getConfiguration();
    let actual = testObject.get("farboo");
    actual["nested"]["config1"] = 41;
    assert.strictEqual(41, actual["nested"]["config1"]);
    actual["farboo1"] = "newValue";
    assert.strictEqual("newValue", actual["farboo1"]);
    testObject = all.getConfiguration();
    actual = testObject.get("farboo");
    assert.strictEqual(actual["nested"]["config1"], 42);
    assert.strictEqual(actual["farboo1"], void 0);
    testObject = all.getConfiguration();
    actual = testObject.get("farboo");
    assert.strictEqual(actual["config0"], true);
    actual["config0"] = false;
    assert.strictEqual(actual["config0"], false);
    testObject = all.getConfiguration();
    actual = testObject.get("farboo");
    assert.strictEqual(actual["config0"], true);
    testObject = all.getConfiguration();
    actual = testObject.inspect("farboo");
    actual["value"] = "effectiveValue";
    assert.strictEqual("effectiveValue", actual["value"]);
    testObject = all.getConfiguration("workbench");
    actual = testObject.get("colorCustomizations");
    actual["statusBar.foreground"] = void 0;
    assert.strictEqual(actual["statusBar.foreground"], void 0);
    testObject = all.getConfiguration("workbench");
    actual = testObject.get("colorCustomizations");
    assert.strictEqual(actual["statusBar.foreground"], "somevalue");
  });
  test("Stringify returned configuration", function() {
    const all = createExtHostConfiguration({
      "farboo": {
        "config0": true,
        "nested": {
          "config1": 42,
          "config2": "Das Pferd frisst kein Reis."
        },
        "config4": ""
      },
      "workbench": {
        "colorCustomizations": {
          "statusBar.foreground": "somevalue"
        },
        "emptyobjectkey": {}
      }
    });
    const testObject = all.getConfiguration();
    let actual = testObject.get("farboo");
    assert.deepStrictEqual(JSON.stringify({
      "config0": true,
      "nested": {
        "config1": 42,
        "config2": "Das Pferd frisst kein Reis."
      },
      "config4": ""
    }), JSON.stringify(actual));
    assert.deepStrictEqual(void 0, JSON.stringify(testObject.get("unknownkey")));
    actual = testObject.get("farboo");
    actual["config0"] = false;
    assert.deepStrictEqual(JSON.stringify({
      "config0": false,
      "nested": {
        "config1": 42,
        "config2": "Das Pferd frisst kein Reis."
      },
      "config4": ""
    }), JSON.stringify(actual));
    actual = testObject.get("workbench")["colorCustomizations"];
    actual["statusBar.background"] = "anothervalue";
    assert.deepStrictEqual(JSON.stringify({
      "statusBar.foreground": "somevalue",
      "statusBar.background": "anothervalue"
    }), JSON.stringify(actual));
    actual = testObject.get("workbench");
    actual["unknownkey"] = "somevalue";
    assert.deepStrictEqual(JSON.stringify({
      "colorCustomizations": {
        "statusBar.foreground": "somevalue"
      },
      "emptyobjectkey": {},
      "unknownkey": "somevalue"
    }), JSON.stringify(actual));
    actual = all.getConfiguration("workbench").get("emptyobjectkey");
    actual = {
      ...actual || {},
      "statusBar.background": `#0ff`,
      "statusBar.foreground": `#ff0`
    };
    assert.deepStrictEqual(JSON.stringify({
      "statusBar.background": `#0ff`,
      "statusBar.foreground": `#ff0`
    }), JSON.stringify(actual));
    actual = all.getConfiguration("workbench").get("unknownkey");
    actual = {
      ...actual || {},
      "statusBar.background": `#0ff`,
      "statusBar.foreground": `#ff0`
    };
    assert.deepStrictEqual(JSON.stringify({
      "statusBar.background": `#0ff`,
      "statusBar.foreground": `#ff0`
    }), JSON.stringify(actual));
  });
  test("cannot modify returned configuration", function() {
    const all = createExtHostConfiguration({
      "farboo": {
        "config0": true,
        "nested": {
          "config1": 42,
          "config2": "Das Pferd frisst kein Reis."
        },
        "config4": ""
      }
    });
    const testObject = all.getConfiguration();
    try {
      testObject["get"] = null;
      assert.fail("This should be readonly");
    } catch (e) {
    }
    try {
      testObject["farboo"]["config0"] = false;
      assert.fail("This should be readonly");
    } catch (e) {
    }
    try {
      testObject["farboo"]["farboo1"] = "hello";
      assert.fail("This should be readonly");
    } catch (e) {
    }
  });
  test("inspect in no workspace context", function() {
    const testObject = new ExtHostConfigProvider(
      new class extends mock() {
      }(),
      createExtHostWorkspace(),
      {
        defaults: new ConfigurationModel({
          "editor": {
            "wordWrap": "off",
            "lineNumbers": "on",
            "fontSize": "12px"
          }
        }, ["editor.wordWrap"], [], void 0, new NullLogService()),
        policy: ConfigurationModel.createEmptyModel(new NullLogService()),
        application: ConfigurationModel.createEmptyModel(new NullLogService()),
        userLocal: new ConfigurationModel({
          "editor": {
            "wordWrap": "on",
            "lineNumbers": "off"
          }
        }, ["editor.wordWrap", "editor.lineNumbers"], [], void 0, new NullLogService()),
        userRemote: new ConfigurationModel({
          "editor": {
            "lineNumbers": "relative"
          }
        }, ["editor.lineNumbers"], [], {
          "editor": {
            "lineNumbers": "relative",
            "fontSize": "14px"
          }
        }, new NullLogService()),
        workspace: new ConfigurationModel({}, [], [], void 0, new NullLogService()),
        folders: [],
        configurationScopes: []
      },
      new NullLogService()
    );
    let actual = testObject.getConfiguration().inspect("editor.wordWrap");
    assert.strictEqual(actual.defaultValue, "off");
    assert.strictEqual(actual.globalLocalValue, "on");
    assert.strictEqual(actual.globalRemoteValue, void 0);
    assert.strictEqual(actual.globalValue, "on");
    assert.strictEqual(actual.workspaceValue, void 0);
    assert.strictEqual(actual.workspaceFolderValue, void 0);
    actual = testObject.getConfiguration("editor").inspect("wordWrap");
    assert.strictEqual(actual.defaultValue, "off");
    assert.strictEqual(actual.globalLocalValue, "on");
    assert.strictEqual(actual.globalRemoteValue, void 0);
    assert.strictEqual(actual.globalValue, "on");
    assert.strictEqual(actual.workspaceValue, void 0);
    assert.strictEqual(actual.workspaceFolderValue, void 0);
    actual = testObject.getConfiguration("editor").inspect("lineNumbers");
    assert.strictEqual(actual.defaultValue, "on");
    assert.strictEqual(actual.globalLocalValue, "off");
    assert.strictEqual(actual.globalRemoteValue, "relative");
    assert.strictEqual(actual.globalValue, "relative");
    assert.strictEqual(actual.workspaceValue, void 0);
    assert.strictEqual(actual.workspaceFolderValue, void 0);
    assert.strictEqual(testObject.getConfiguration("editor").get("fontSize"), "12px");
    actual = testObject.getConfiguration("editor").inspect("fontSize");
    assert.strictEqual(actual.defaultValue, "12px");
    assert.strictEqual(actual.globalLocalValue, void 0);
    assert.strictEqual(actual.globalRemoteValue, "14px");
    assert.strictEqual(actual.globalValue, void 0);
    assert.strictEqual(actual.workspaceValue, void 0);
    assert.strictEqual(actual.workspaceFolderValue, void 0);
  });
  test("inspect in single root context", function() {
    const workspaceUri = URI.file("foo");
    const folders = [];
    const workspace = new ConfigurationModel({
      "editor": {
        "wordWrap": "bounded"
      }
    }, ["editor.wordWrap"], [], void 0, new NullLogService());
    folders.push([workspaceUri, workspace]);
    const extHostWorkspace = createExtHostWorkspace();
    extHostWorkspace.$initializeWorkspace({
      "id": "foo",
      "folders": [aWorkspaceFolder(URI.file("foo"), 0)],
      "name": "foo"
    }, true);
    const testObject = new ExtHostConfigProvider(
      new class extends mock() {
      }(),
      extHostWorkspace,
      {
        defaults: new ConfigurationModel({
          "editor": {
            "wordWrap": "off"
          }
        }, ["editor.wordWrap"], [], void 0, new NullLogService()),
        policy: ConfigurationModel.createEmptyModel(new NullLogService()),
        application: ConfigurationModel.createEmptyModel(new NullLogService()),
        userLocal: new ConfigurationModel({
          "editor": {
            "wordWrap": "on"
          }
        }, ["editor.wordWrap"], [], void 0, new NullLogService()),
        userRemote: ConfigurationModel.createEmptyModel(new NullLogService()),
        workspace,
        folders,
        configurationScopes: []
      },
      new NullLogService()
    );
    let actual1 = testObject.getConfiguration().inspect("editor.wordWrap");
    assert.strictEqual(actual1.defaultValue, "off");
    assert.strictEqual(actual1.globalLocalValue, "on");
    assert.strictEqual(actual1.globalRemoteValue, void 0);
    assert.strictEqual(actual1.globalValue, "on");
    assert.strictEqual(actual1.workspaceValue, "bounded");
    assert.strictEqual(actual1.workspaceFolderValue, void 0);
    actual1 = testObject.getConfiguration("editor").inspect("wordWrap");
    assert.strictEqual(actual1.defaultValue, "off");
    assert.strictEqual(actual1.globalLocalValue, "on");
    assert.strictEqual(actual1.globalRemoteValue, void 0);
    assert.strictEqual(actual1.globalValue, "on");
    assert.strictEqual(actual1.workspaceValue, "bounded");
    assert.strictEqual(actual1.workspaceFolderValue, void 0);
    let actual2 = testObject.getConfiguration(void 0, workspaceUri).inspect("editor.wordWrap");
    assert.strictEqual(actual2.defaultValue, "off");
    assert.strictEqual(actual2.globalLocalValue, "on");
    assert.strictEqual(actual2.globalRemoteValue, void 0);
    assert.strictEqual(actual2.globalValue, "on");
    assert.strictEqual(actual2.workspaceValue, "bounded");
    assert.strictEqual(actual2.workspaceFolderValue, "bounded");
    actual2 = testObject.getConfiguration("editor", workspaceUri).inspect("wordWrap");
    assert.strictEqual(actual2.defaultValue, "off");
    assert.strictEqual(actual2.globalLocalValue, "on");
    assert.strictEqual(actual2.globalRemoteValue, void 0);
    assert.strictEqual(actual2.globalValue, "on");
    assert.strictEqual(actual2.workspaceValue, "bounded");
    assert.strictEqual(actual2.workspaceFolderValue, "bounded");
  });
  test("inspect in multi root context", function() {
    const workspace = new ConfigurationModel({
      "editor": {
        "wordWrap": "bounded"
      }
    }, ["editor.wordWrap"], [], void 0, new NullLogService());
    const firstRoot = URI.file("foo1");
    const secondRoot = URI.file("foo2");
    const thirdRoot = URI.file("foo3");
    const folders = [];
    folders.push([firstRoot, new ConfigurationModel({
      "editor": {
        "wordWrap": "off",
        "lineNumbers": "relative"
      }
    }, ["editor.wordWrap"], [], void 0, new NullLogService())]);
    folders.push([secondRoot, new ConfigurationModel({
      "editor": {
        "wordWrap": "on"
      }
    }, ["editor.wordWrap"], [], void 0, new NullLogService())]);
    folders.push([thirdRoot, new ConfigurationModel({}, [], [], void 0, new NullLogService())]);
    const extHostWorkspace = createExtHostWorkspace();
    extHostWorkspace.$initializeWorkspace({
      "id": "foo",
      "folders": [aWorkspaceFolder(firstRoot, 0), aWorkspaceFolder(secondRoot, 1)],
      "name": "foo"
    }, true);
    const testObject = new ExtHostConfigProvider(
      new class extends mock() {
      }(),
      extHostWorkspace,
      {
        defaults: new ConfigurationModel({
          "editor": {
            "wordWrap": "off",
            "lineNumbers": "on"
          }
        }, ["editor.wordWrap"], [], void 0, new NullLogService()),
        policy: ConfigurationModel.createEmptyModel(new NullLogService()),
        application: ConfigurationModel.createEmptyModel(new NullLogService()),
        userLocal: new ConfigurationModel({
          "editor": {
            "wordWrap": "on"
          }
        }, ["editor.wordWrap"], [], void 0, new NullLogService()),
        userRemote: ConfigurationModel.createEmptyModel(new NullLogService()),
        workspace,
        folders,
        configurationScopes: []
      },
      new NullLogService()
    );
    let actual1 = testObject.getConfiguration().inspect("editor.wordWrap");
    assert.strictEqual(actual1.defaultValue, "off");
    assert.strictEqual(actual1.globalValue, "on");
    assert.strictEqual(actual1.globalLocalValue, "on");
    assert.strictEqual(actual1.globalRemoteValue, void 0);
    assert.strictEqual(actual1.workspaceValue, "bounded");
    assert.strictEqual(actual1.workspaceFolderValue, void 0);
    actual1 = testObject.getConfiguration("editor").inspect("wordWrap");
    assert.strictEqual(actual1.defaultValue, "off");
    assert.strictEqual(actual1.globalValue, "on");
    assert.strictEqual(actual1.globalLocalValue, "on");
    assert.strictEqual(actual1.globalRemoteValue, void 0);
    assert.strictEqual(actual1.workspaceValue, "bounded");
    assert.strictEqual(actual1.workspaceFolderValue, void 0);
    actual1 = testObject.getConfiguration("editor").inspect("lineNumbers");
    assert.strictEqual(actual1.defaultValue, "on");
    assert.strictEqual(actual1.globalValue, void 0);
    assert.strictEqual(actual1.globalLocalValue, void 0);
    assert.strictEqual(actual1.globalRemoteValue, void 0);
    assert.strictEqual(actual1.workspaceValue, void 0);
    assert.strictEqual(actual1.workspaceFolderValue, void 0);
    let actual2 = testObject.getConfiguration(void 0, firstRoot).inspect("editor.wordWrap");
    assert.strictEqual(actual2.defaultValue, "off");
    assert.strictEqual(actual2.globalValue, "on");
    assert.strictEqual(actual2.globalLocalValue, "on");
    assert.strictEqual(actual2.globalRemoteValue, void 0);
    assert.strictEqual(actual2.workspaceValue, "bounded");
    assert.strictEqual(actual2.workspaceFolderValue, "off");
    actual2 = testObject.getConfiguration("editor", firstRoot).inspect("wordWrap");
    assert.strictEqual(actual2.defaultValue, "off");
    assert.strictEqual(actual2.globalValue, "on");
    assert.strictEqual(actual2.globalLocalValue, "on");
    assert.strictEqual(actual2.globalRemoteValue, void 0);
    assert.strictEqual(actual2.workspaceValue, "bounded");
    assert.strictEqual(actual2.workspaceFolderValue, "off");
    actual2 = testObject.getConfiguration("editor", firstRoot).inspect("lineNumbers");
    assert.strictEqual(actual2.defaultValue, "on");
    assert.strictEqual(actual2.globalValue, void 0);
    assert.strictEqual(actual2.globalLocalValue, void 0);
    assert.strictEqual(actual2.globalRemoteValue, void 0);
    assert.strictEqual(actual2.workspaceValue, void 0);
    assert.strictEqual(actual2.workspaceFolderValue, "relative");
    actual2 = testObject.getConfiguration(void 0, secondRoot).inspect("editor.wordWrap");
    assert.strictEqual(actual2.defaultValue, "off");
    assert.strictEqual(actual2.globalValue, "on");
    assert.strictEqual(actual2.globalLocalValue, "on");
    assert.strictEqual(actual2.globalRemoteValue, void 0);
    assert.strictEqual(actual2.workspaceValue, "bounded");
    assert.strictEqual(actual2.workspaceFolderValue, "on");
    actual2 = testObject.getConfiguration("editor", secondRoot).inspect("wordWrap");
    assert.strictEqual(actual2.defaultValue, "off");
    assert.strictEqual(actual2.globalValue, "on");
    assert.strictEqual(actual2.globalLocalValue, "on");
    assert.strictEqual(actual2.globalRemoteValue, void 0);
    assert.strictEqual(actual2.workspaceValue, "bounded");
    assert.strictEqual(actual2.workspaceFolderValue, "on");
    actual2 = testObject.getConfiguration(void 0, thirdRoot).inspect("editor.wordWrap");
    assert.strictEqual(actual2.defaultValue, "off");
    assert.strictEqual(actual2.globalValue, "on");
    assert.strictEqual(actual2.globalLocalValue, "on");
    assert.strictEqual(actual2.globalRemoteValue, void 0);
    assert.strictEqual(actual2.workspaceValue, "bounded");
    assert.ok(Object.keys(actual2).indexOf("workspaceFolderValue") !== -1);
    assert.strictEqual(actual2.workspaceFolderValue, void 0);
    actual2 = testObject.getConfiguration("editor", thirdRoot).inspect("wordWrap");
    assert.strictEqual(actual2.defaultValue, "off");
    assert.strictEqual(actual2.globalValue, "on");
    assert.strictEqual(actual2.globalLocalValue, "on");
    assert.strictEqual(actual2.globalRemoteValue, void 0);
    assert.strictEqual(actual2.workspaceValue, "bounded");
    assert.ok(Object.keys(actual2).indexOf("workspaceFolderValue") !== -1);
    assert.strictEqual(actual2.workspaceFolderValue, void 0);
  });
  test("inspect with language overrides", function() {
    const firstRoot = URI.file("foo1");
    const secondRoot = URI.file("foo2");
    const folders = [];
    folders.push([firstRoot, toConfigurationModel({
      "editor.wordWrap": "bounded",
      "[typescript]": {
        "editor.wordWrap": "unbounded"
      }
    })]);
    folders.push([secondRoot, toConfigurationModel({})]);
    const extHostWorkspace = createExtHostWorkspace();
    extHostWorkspace.$initializeWorkspace({
      "id": "foo",
      "folders": [aWorkspaceFolder(firstRoot, 0), aWorkspaceFolder(secondRoot, 1)],
      "name": "foo"
    }, true);
    const testObject = new ExtHostConfigProvider(
      new class extends mock() {
      }(),
      extHostWorkspace,
      {
        defaults: toConfigurationModel({
          "editor.wordWrap": "off",
          "[markdown]": {
            "editor.wordWrap": "bounded"
          }
        }),
        policy: ConfigurationModel.createEmptyModel(new NullLogService()),
        application: ConfigurationModel.createEmptyModel(new NullLogService()),
        userLocal: toConfigurationModel({
          "editor.wordWrap": "bounded",
          "[typescript]": {
            "editor.lineNumbers": "off"
          }
        }),
        userRemote: ConfigurationModel.createEmptyModel(new NullLogService()),
        workspace: toConfigurationModel({
          "[typescript]": {
            "editor.wordWrap": "unbounded",
            "editor.lineNumbers": "off"
          }
        }),
        folders,
        configurationScopes: []
      },
      new NullLogService()
    );
    let actual = testObject.getConfiguration(void 0, { uri: firstRoot, languageId: "typescript" }).inspect("editor.wordWrap");
    assert.strictEqual(actual.defaultValue, "off");
    assert.strictEqual(actual.globalValue, "bounded");
    assert.strictEqual(actual.globalLocalValue, "bounded");
    assert.strictEqual(actual.globalRemoteValue, void 0);
    assert.strictEqual(actual.workspaceValue, void 0);
    assert.strictEqual(actual.workspaceFolderValue, "bounded");
    assert.strictEqual(actual.defaultLanguageValue, void 0);
    assert.strictEqual(actual.globalLanguageValue, void 0);
    assert.strictEqual(actual.workspaceLanguageValue, "unbounded");
    assert.strictEqual(actual.workspaceFolderLanguageValue, "unbounded");
    assert.deepStrictEqual(actual.languageIds, ["markdown", "typescript"]);
    actual = testObject.getConfiguration(void 0, { uri: secondRoot, languageId: "typescript" }).inspect("editor.wordWrap");
    assert.strictEqual(actual.defaultValue, "off");
    assert.strictEqual(actual.globalValue, "bounded");
    assert.strictEqual(actual.globalLocalValue, "bounded");
    assert.strictEqual(actual.globalRemoteValue, void 0);
    assert.strictEqual(actual.workspaceValue, void 0);
    assert.strictEqual(actual.workspaceFolderValue, void 0);
    assert.strictEqual(actual.defaultLanguageValue, void 0);
    assert.strictEqual(actual.globalLanguageValue, void 0);
    assert.strictEqual(actual.workspaceLanguageValue, "unbounded");
    assert.strictEqual(actual.workspaceFolderLanguageValue, void 0);
    assert.deepStrictEqual(actual.languageIds, ["markdown", "typescript"]);
  });
  test("application is not set in inspect", () => {
    const testObject = new ExtHostConfigProvider(
      new class extends mock() {
      }(),
      createExtHostWorkspace(),
      {
        defaults: new ConfigurationModel({
          "editor": {
            "wordWrap": "off",
            "lineNumbers": "on",
            "fontSize": "12px"
          }
        }, ["editor.wordWrap"], [], void 0, new NullLogService()),
        policy: ConfigurationModel.createEmptyModel(new NullLogService()),
        application: new ConfigurationModel({
          "editor": {
            "wordWrap": "on"
          }
        }, ["editor.wordWrap"], [], void 0, new NullLogService()),
        userLocal: new ConfigurationModel({
          "editor": {
            "wordWrap": "auto",
            "lineNumbers": "off"
          }
        }, ["editor.wordWrap"], [], void 0, new NullLogService()),
        userRemote: ConfigurationModel.createEmptyModel(new NullLogService()),
        workspace: new ConfigurationModel({}, [], [], void 0, new NullLogService()),
        folders: [],
        configurationScopes: []
      },
      new NullLogService()
    );
    let actual = testObject.getConfiguration().inspect("editor.wordWrap");
    assert.strictEqual(actual.defaultValue, "off");
    assert.strictEqual(actual.globalValue, "auto");
    assert.strictEqual(actual.globalLocalValue, "auto");
    assert.strictEqual(actual.globalRemoteValue, void 0);
    assert.strictEqual(actual.workspaceValue, void 0);
    assert.strictEqual(actual.workspaceFolderValue, void 0);
    assert.strictEqual(testObject.getConfiguration().get("editor.wordWrap"), "auto");
    actual = testObject.getConfiguration().inspect("editor.lineNumbers");
    assert.strictEqual(actual.defaultValue, "on");
    assert.strictEqual(actual.globalValue, "off");
    assert.strictEqual(actual.globalLocalValue, "off");
    assert.strictEqual(actual.globalRemoteValue, void 0);
    assert.strictEqual(actual.workspaceValue, void 0);
    assert.strictEqual(actual.workspaceFolderValue, void 0);
    assert.strictEqual(testObject.getConfiguration().get("editor.lineNumbers"), "off");
    actual = testObject.getConfiguration().inspect("editor.fontSize");
    assert.strictEqual(actual.defaultValue, "12px");
    assert.strictEqual(actual.globalLocalValue, void 0);
    assert.strictEqual(actual.globalRemoteValue, void 0);
    assert.strictEqual(actual.globalValue, void 0);
    assert.strictEqual(actual.workspaceValue, void 0);
    assert.strictEqual(actual.workspaceFolderValue, void 0);
    assert.strictEqual(testObject.getConfiguration().get("editor.fontSize"), "12px");
  });
  test("getConfiguration vs get", function() {
    const all = createExtHostConfiguration({
      "farboo": {
        "config0": true,
        "config4": 38
      }
    });
    let config = all.getConfiguration("farboo.config0");
    assert.strictEqual(config.get(""), void 0);
    assert.strictEqual(config.has(""), false);
    config = all.getConfiguration("farboo");
    assert.strictEqual(config.get("config0"), true);
    assert.strictEqual(config.has("config0"), true);
  });
  test("name vs property", function() {
    const all = createExtHostConfiguration({
      "farboo": {
        "get": "get-prop"
      }
    });
    const config = all.getConfiguration("farboo");
    assert.ok(config.has("get"));
    assert.strictEqual(config.get("get"), "get-prop");
    assert.deepStrictEqual(config["get"], config.get);
    assert.throws(() => config["get"] = "get-prop");
  });
  test("update: no target passes null", function() {
    const shape = new RecordingShape();
    const allConfig = createExtHostConfiguration({
      "foo": {
        "bar": 1,
        "far": 1
      }
    }, shape);
    const config = allConfig.getConfiguration("foo");
    config.update("bar", 42);
    assert.strictEqual(shape.lastArgs[0], null);
  });
  test("update/section to key", function() {
    const shape = new RecordingShape();
    const allConfig = createExtHostConfiguration({
      "foo": {
        "bar": 1,
        "far": 1
      }
    }, shape);
    let config = allConfig.getConfiguration("foo");
    config.update("bar", 42, true);
    assert.strictEqual(shape.lastArgs[0], ConfigurationTarget.USER);
    assert.strictEqual(shape.lastArgs[1], "foo.bar");
    assert.strictEqual(shape.lastArgs[2], 42);
    config = allConfig.getConfiguration("");
    config.update("bar", 42, true);
    assert.strictEqual(shape.lastArgs[1], "bar");
    config.update("foo.bar", 42, true);
    assert.strictEqual(shape.lastArgs[1], "foo.bar");
  });
  test("update, what is #15834", function() {
    const shape = new RecordingShape();
    const allConfig = createExtHostConfiguration({
      "editor": {
        "formatOnSave": true
      }
    }, shape);
    allConfig.getConfiguration("editor").update("formatOnSave", { extensions: ["ts"] });
    assert.strictEqual(shape.lastArgs[1], "editor.formatOnSave");
    assert.deepStrictEqual(shape.lastArgs[2], { extensions: ["ts"] });
  });
  test("update/error-state not OK", function() {
    const shape = new class extends mock() {
      $updateConfigurationOption(target, key, value) {
        return Promise.reject(new Error("Unknown Key"));
      }
    }();
    return createExtHostConfiguration({}, shape).getConfiguration("").update("", true, false).then(() => assert.ok(false), (err) => {
    });
  });
  test("configuration change event", (done) => {
    const workspaceFolder = aWorkspaceFolder(URI.file("folder1"), 0);
    const extHostWorkspace = createExtHostWorkspace();
    extHostWorkspace.$initializeWorkspace({
      "id": "foo",
      "folders": [workspaceFolder],
      "name": "foo"
    }, true);
    const testObject = new ExtHostConfigProvider(
      new class extends mock() {
      }(),
      extHostWorkspace,
      createConfigurationData({
        "farboo": {
          "config": false,
          "updatedConfig": false
        }
      }),
      new NullLogService()
    );
    const newConfigData = createConfigurationData({
      "farboo": {
        "config": false,
        "updatedConfig": true,
        "newConfig": true
      }
    });
    const configEventData = { keys: ["farboo.updatedConfig", "farboo.newConfig"], overrides: [] };
    store.add(testObject.onDidChangeConfiguration((e) => {
      assert.deepStrictEqual(testObject.getConfiguration().get("farboo"), {
        "config": false,
        "updatedConfig": true,
        "newConfig": true
      });
      assert.ok(e.affectsConfiguration("farboo"));
      assert.ok(e.affectsConfiguration("farboo", workspaceFolder.uri));
      assert.ok(e.affectsConfiguration("farboo", URI.file("any")));
      assert.ok(e.affectsConfiguration("farboo.updatedConfig"));
      assert.ok(e.affectsConfiguration("farboo.updatedConfig", workspaceFolder.uri));
      assert.ok(e.affectsConfiguration("farboo.updatedConfig", URI.file("any")));
      assert.ok(e.affectsConfiguration("farboo.newConfig"));
      assert.ok(e.affectsConfiguration("farboo.newConfig", workspaceFolder.uri));
      assert.ok(e.affectsConfiguration("farboo.newConfig", URI.file("any")));
      assert.ok(!e.affectsConfiguration("farboo.config"));
      assert.ok(!e.affectsConfiguration("farboo.config", workspaceFolder.uri));
      assert.ok(!e.affectsConfiguration("farboo.config", URI.file("any")));
      done();
    }));
    testObject.$acceptConfigurationChanged(newConfigData, configEventData);
  });
  test("get return instance of array value", function() {
    const testObject = createExtHostConfiguration({ "far": { "boo": [] } });
    const value = testObject.getConfiguration().get("far.boo", []);
    value.push("a");
    const actual = testObject.getConfiguration().get("far.boo", []);
    assert.deepStrictEqual(actual, []);
  });
  function aWorkspaceFolder(uri, index, name = "") {
    return new WorkspaceFolder({ uri, name, index });
  }
  function toConfigurationModel(obj) {
    const parser = new ConfigurationModelParser("test", new NullLogService());
    parser.parse(JSON.stringify(obj));
    return parser.configurationModel;
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0Q29uZmlndXJhdGlvbi50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEV4dEhvc3RXb3Jrc3BhY2UgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdFdvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uSW5zcGVjdCwgRXh0SG9zdENvbmZpZ1Byb3ZpZGVyIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IE1haW5UaHJlYWRDb25maWd1cmF0aW9uU2hhcGUsIElDb25maWd1cmF0aW9uSW5pdERhdGEgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uTW9kZWwsIENvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25Nb2RlbHMuanMnO1xuaW1wb3J0IHsgVGVzdFJQQ1Byb3RvY29sIH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RSUENQcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VGb2xkZXIsIFdvcmtzcGFjZUZvbGRlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25UYXJnZXQsIElDb25maWd1cmF0aW9uTW9kZWwsIElDb25maWd1cmF0aW9uQ2hhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElFeHRIb3N0SW5pdERhdGFTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RJbml0RGF0YVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RGaWxlU3lzdGVtSW5mbyB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0RmlsZVN5c3RlbUluZm8uanMnO1xuaW1wb3J0IHsgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IGlzTGludXggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJVVJJVHJhbnNmb3JtZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RVcmlUcmFuc2Zvcm1lclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbnN1aXRlKCdFeHRIb3N0Q29uZmlndXJhdGlvbicsIGZ1bmN0aW9uICgpIHtcblxuXHRjbGFzcyBSZWNvcmRpbmdTaGFwZSBleHRlbmRzIG1vY2s8TWFpblRocmVhZENvbmZpZ3VyYXRpb25TaGFwZT4oKSB7XG5cdFx0bGFzdEFyZ3MhOiBbQ29uZmlndXJhdGlvblRhcmdldCwgc3RyaW5nLCBhbnldO1xuXHRcdG92ZXJyaWRlICR1cGRhdGVDb25maWd1cmF0aW9uT3B0aW9uKHRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldCwga2V5OiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdHRoaXMubGFzdEFyZ3MgPSBbdGFyZ2V0LCBrZXksIHZhbHVlXTtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVFeHRIb3N0V29ya3NwYWNlKCk6IEV4dEhvc3RXb3Jrc3BhY2Uge1xuXHRcdHJldHVybiBuZXcgRXh0SG9zdFdvcmtzcGFjZShuZXcgVGVzdFJQQ1Byb3RvY29sKCksIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUV4dEhvc3RJbml0RGF0YVNlcnZpY2U+KCkgeyB9LCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElFeHRIb3N0RmlsZVN5c3RlbUluZm8+KCkgeyBvdmVycmlkZSBnZXRDYXBhYmlsaXRpZXMoKSB7IHJldHVybiBpc0xpbnV4ID8gRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLlBhdGhDYXNlU2Vuc2l0aXZlIDogdW5kZWZpbmVkOyB9IH0sIG5ldyBOdWxsTG9nU2VydmljZSgpLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElVUklUcmFuc2Zvcm1lclNlcnZpY2U+KCkgeyB9KTtcblx0fVxuXG5cdGZ1bmN0aW9uIGNyZWF0ZUV4dEhvc3RDb25maWd1cmF0aW9uKGNvbnRlbnRzOiBhbnkgPSBPYmplY3QuY3JlYXRlKG51bGwpLCBzaGFwZT86IE1haW5UaHJlYWRDb25maWd1cmF0aW9uU2hhcGUpIHtcblx0XHRpZiAoIXNoYXBlKSB7XG5cdFx0XHRzaGFwZSA9IG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8TWFpblRocmVhZENvbmZpZ3VyYXRpb25TaGFwZT4oKSB7IH07XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgRXh0SG9zdENvbmZpZ1Byb3ZpZGVyKHNoYXBlLCBjcmVhdGVFeHRIb3N0V29ya3NwYWNlKCksIGNyZWF0ZUNvbmZpZ3VyYXRpb25EYXRhKGNvbnRlbnRzKSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHR9XG5cblx0ZnVuY3Rpb24gY3JlYXRlQ29uZmlndXJhdGlvbkRhdGEoY29udGVudHM6IGFueSk6IElDb25maWd1cmF0aW9uSW5pdERhdGEge1xuXHRcdHJldHVybiB7XG5cdFx0XHRkZWZhdWx0czogbmV3IENvbmZpZ3VyYXRpb25Nb2RlbChjb250ZW50cywgW10sIFtdLCB1bmRlZmluZWQsIG5ldyBOdWxsTG9nU2VydmljZSgpKSxcblx0XHRcdHBvbGljeTogQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobmV3IE51bGxMb2dTZXJ2aWNlKCkpLFxuXHRcdFx0YXBwbGljYXRpb246IENvbmZpZ3VyYXRpb25Nb2RlbC5jcmVhdGVFbXB0eU1vZGVsKG5ldyBOdWxsTG9nU2VydmljZSgpKSxcblx0XHRcdHVzZXJMb2NhbDogbmV3IENvbmZpZ3VyYXRpb25Nb2RlbChjb250ZW50cywgW10sIFtdLCB1bmRlZmluZWQsIG5ldyBOdWxsTG9nU2VydmljZSgpKSxcblx0XHRcdHVzZXJSZW1vdGU6IENvbmZpZ3VyYXRpb25Nb2RlbC5jcmVhdGVFbXB0eU1vZGVsKG5ldyBOdWxsTG9nU2VydmljZSgpKSxcblx0XHRcdHdvcmtzcGFjZTogQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobmV3IE51bGxMb2dTZXJ2aWNlKCkpLFxuXHRcdFx0Zm9sZGVyczogW10sXG5cdFx0XHRjb25maWd1cmF0aW9uU2NvcGVzOiBbXVxuXHRcdH07XG5cdH1cblxuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2dldENvbmZpZ3VyYXRpb24gZmFpbHMgcmVncmVzc2lvbiB0ZXN0IDEuNy4xIC0+IDEuOCAjMTU1NTInLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZXh0SG9zdENvbmZpZyA9IGNyZWF0ZUV4dEhvc3RDb25maWd1cmF0aW9uKHtcblx0XHRcdCdzZWFyY2gnOiB7XG5cdFx0XHRcdCdleGNsdWRlJzoge1xuXHRcdFx0XHRcdCcqKi9ub2RlX21vZHVsZXMnOiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0Q29uZmlnLmdldENvbmZpZ3VyYXRpb24oJ3NlYXJjaC5leGNsdWRlJylbJyoqL25vZGVfbW9kdWxlcyddLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdENvbmZpZy5nZXRDb25maWd1cmF0aW9uKCdzZWFyY2guZXhjbHVkZScpLmdldCgnKiovbm9kZV9tb2R1bGVzJyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0Q29uZmlnLmdldENvbmZpZ3VyYXRpb24oJ3NlYXJjaCcpLmdldDxhbnk+KCdleGNsdWRlJylbJyoqL25vZGVfbW9kdWxlcyddLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0Q29uZmlnLmdldENvbmZpZ3VyYXRpb24oJ3NlYXJjaC5leGNsdWRlJykuaGFzKCcqKi9ub2RlX21vZHVsZXMnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4dEhvc3RDb25maWcuZ2V0Q29uZmlndXJhdGlvbignc2VhcmNoJykuaGFzKCdleGNsdWRlLioqL25vZGVfbW9kdWxlcycpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnaGFzL2dldCcsICgpID0+IHtcblxuXHRcdGNvbnN0IGFsbCA9IGNyZWF0ZUV4dEhvc3RDb25maWd1cmF0aW9uKHtcblx0XHRcdCdmYXJib28nOiB7XG5cdFx0XHRcdCdjb25maWcwJzogdHJ1ZSxcblx0XHRcdFx0J25lc3RlZCc6IHtcblx0XHRcdFx0XHQnY29uZmlnMSc6IDQyLFxuXHRcdFx0XHRcdCdjb25maWcyJzogJ0RhcyBQZmVyZCBmcmlzc3Qga2VpbiBSZWlzLidcblx0XHRcdFx0fSxcblx0XHRcdFx0J2NvbmZpZzQnOiAnJ1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgY29uZmlnID0gYWxsLmdldENvbmZpZ3VyYXRpb24oJ2ZhcmJvbycpO1xuXG5cdFx0YXNzZXJ0Lm9rKGNvbmZpZy5oYXMoJ2NvbmZpZzAnKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbmZpZy5nZXQoJ2NvbmZpZzAnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbmZpZy5nZXQoJ2NvbmZpZzQnKSwgJycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb25maWdbJ2NvbmZpZzAnXSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbmZpZ1snY29uZmlnNCddLCAnJyk7XG5cblx0XHRhc3NlcnQub2soY29uZmlnLmhhcygnbmVzdGVkLmNvbmZpZzEnKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbmZpZy5nZXQoJ25lc3RlZC5jb25maWcxJyksIDQyKTtcblx0XHRhc3NlcnQub2soY29uZmlnLmhhcygnbmVzdGVkLmNvbmZpZzInKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbmZpZy5nZXQoJ25lc3RlZC5jb25maWcyJyksICdEYXMgUGZlcmQgZnJpc3N0IGtlaW4gUmVpcy4nKTtcblxuXHRcdGFzc2VydC5vayhjb25maWcuaGFzKCduZXN0ZWQnKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjb25maWcuZ2V0KCduZXN0ZWQnKSwgeyBjb25maWcxOiA0MiwgY29uZmlnMjogJ0RhcyBQZmVyZCBmcmlzc3Qga2VpbiBSZWlzLicgfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldCBuZXN0ZWQgY29uZmlnJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgYWxsID0gY3JlYXRlRXh0SG9zdENvbmZpZ3VyYXRpb24oe1xuXHRcdFx0J2ZhcmJvbyc6IHtcblx0XHRcdFx0J2NvbmZpZzAnOiB0cnVlLFxuXHRcdFx0XHQnbmVzdGVkJzoge1xuXHRcdFx0XHRcdCdjb25maWcxJzogNDIsXG5cdFx0XHRcdFx0J2NvbmZpZzInOiAnRGFzIFBmZXJkIGZyaXNzdCBrZWluIFJlaXMuJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHQnY29uZmlnNCc6ICcnXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFsbC5nZXRDb25maWd1cmF0aW9uKCdmYXJib28ubmVzdGVkJykuZ2V0KCdjb25maWcxJyksIDQyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFsbC5nZXRDb25maWd1cmF0aW9uKCdmYXJib28ubmVzdGVkJykuZ2V0KCdjb25maWcyJyksICdEYXMgUGZlcmQgZnJpc3N0IGtlaW4gUmVpcy4nKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFsbC5nZXRDb25maWd1cmF0aW9uKCdmYXJib28ubmVzdGVkJylbJ2NvbmZpZzEnXSwgNDIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWxsLmdldENvbmZpZ3VyYXRpb24oJ2ZhcmJvby5uZXN0ZWQnKVsnY29uZmlnMiddLCAnRGFzIFBmZXJkIGZyaXNzdCBrZWluIFJlaXMuJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhbGwuZ2V0Q29uZmlndXJhdGlvbignZmFyYm9vLm5lc3RlZDEnKS5nZXQoJ2NvbmZpZzEnKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFsbC5nZXRDb25maWd1cmF0aW9uKCdmYXJib28ubmVzdGVkMScpLmdldCgnY29uZmlnMicpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWxsLmdldENvbmZpZ3VyYXRpb24oJ2ZhcmJvby5jb25maWcwLmNvbmZpZzEnKS5nZXQoJ2EnKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFsbC5nZXRDb25maWd1cmF0aW9uKCdmYXJib28uY29uZmlnMC5jb25maWcxJylbJ2EnXSwgdW5kZWZpbmVkKTtcblx0fSk7XG5cblx0dGVzdCgnY2FuIG1vZGlmeSB0aGUgcmV0dXJuZWQgY29uZmlndXJhdGlvbicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGFsbCA9IGNyZWF0ZUV4dEhvc3RDb25maWd1cmF0aW9uKHtcblx0XHRcdCdmYXJib28nOiB7XG5cdFx0XHRcdCdjb25maWcwJzogdHJ1ZSxcblx0XHRcdFx0J25lc3RlZCc6IHtcblx0XHRcdFx0XHQnY29uZmlnMSc6IDQyLFxuXHRcdFx0XHRcdCdjb25maWcyJzogJ0RhcyBQZmVyZCBmcmlzc3Qga2VpbiBSZWlzLidcblx0XHRcdFx0fSxcblx0XHRcdFx0J2NvbmZpZzQnOiAnJ1xuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2gnOiB7XG5cdFx0XHRcdCdjb2xvckN1c3RvbWl6YXRpb25zJzoge1xuXHRcdFx0XHRcdCdzdGF0dXNCYXIuZm9yZWdyb3VuZCc6ICdzb21ldmFsdWUnXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGxldCB0ZXN0T2JqZWN0ID0gYWxsLmdldENvbmZpZ3VyYXRpb24oKTtcblx0XHRsZXQgYWN0dWFsID0gdGVzdE9iamVjdC5nZXQ8YW55PignZmFyYm9vJykhO1xuXHRcdGFjdHVhbFsnbmVzdGVkJ11bJ2NvbmZpZzEnXSA9IDQxO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCg0MSwgYWN0dWFsWyduZXN0ZWQnXVsnY29uZmlnMSddKTtcblx0XHRhY3R1YWxbJ2ZhcmJvbzEnXSA9ICduZXdWYWx1ZSc7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCduZXdWYWx1ZScsIGFjdHVhbFsnZmFyYm9vMSddKTtcblxuXHRcdHRlc3RPYmplY3QgPSBhbGwuZ2V0Q29uZmlndXJhdGlvbigpO1xuXHRcdGFjdHVhbCA9IHRlc3RPYmplY3QuZ2V0KCdmYXJib28nKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbFsnbmVzdGVkJ11bJ2NvbmZpZzEnXSwgNDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWxbJ2ZhcmJvbzEnXSwgdW5kZWZpbmVkKTtcblxuXHRcdHRlc3RPYmplY3QgPSBhbGwuZ2V0Q29uZmlndXJhdGlvbigpO1xuXHRcdGFjdHVhbCA9IHRlc3RPYmplY3QuZ2V0KCdmYXJib28nKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbFsnY29uZmlnMCddLCB0cnVlKTtcblx0XHRhY3R1YWxbJ2NvbmZpZzAnXSA9IGZhbHNlO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWxbJ2NvbmZpZzAnXSwgZmFsc2UpO1xuXG5cdFx0dGVzdE9iamVjdCA9IGFsbC5nZXRDb25maWd1cmF0aW9uKCk7XG5cdFx0YWN0dWFsID0gdGVzdE9iamVjdC5nZXQoJ2ZhcmJvbycpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsWydjb25maWcwJ10sIHRydWUpO1xuXG5cdFx0dGVzdE9iamVjdCA9IGFsbC5nZXRDb25maWd1cmF0aW9uKCk7XG5cdFx0YWN0dWFsID0gdGVzdE9iamVjdC5pbnNwZWN0KCdmYXJib28nKSE7XG5cdFx0YWN0dWFsWyd2YWx1ZSddID0gJ2VmZmVjdGl2ZVZhbHVlJztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ2VmZmVjdGl2ZVZhbHVlJywgYWN0dWFsWyd2YWx1ZSddKTtcblxuXHRcdHRlc3RPYmplY3QgPSBhbGwuZ2V0Q29uZmlndXJhdGlvbignd29ya2JlbmNoJyk7XG5cdFx0YWN0dWFsID0gdGVzdE9iamVjdC5nZXQoJ2NvbG9yQ3VzdG9taXphdGlvbnMnKSE7XG5cdFx0YWN0dWFsWydzdGF0dXNCYXIuZm9yZWdyb3VuZCddID0gdW5kZWZpbmVkO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWxbJ3N0YXR1c0Jhci5mb3JlZ3JvdW5kJ10sIHVuZGVmaW5lZCk7XG5cdFx0dGVzdE9iamVjdCA9IGFsbC5nZXRDb25maWd1cmF0aW9uKCd3b3JrYmVuY2gnKTtcblx0XHRhY3R1YWwgPSB0ZXN0T2JqZWN0LmdldCgnY29sb3JDdXN0b21pemF0aW9ucycpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsWydzdGF0dXNCYXIuZm9yZWdyb3VuZCddLCAnc29tZXZhbHVlJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ1N0cmluZ2lmeSByZXR1cm5lZCBjb25maWd1cmF0aW9uJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgYWxsID0gY3JlYXRlRXh0SG9zdENvbmZpZ3VyYXRpb24oe1xuXHRcdFx0J2ZhcmJvbyc6IHtcblx0XHRcdFx0J2NvbmZpZzAnOiB0cnVlLFxuXHRcdFx0XHQnbmVzdGVkJzoge1xuXHRcdFx0XHRcdCdjb25maWcxJzogNDIsXG5cdFx0XHRcdFx0J2NvbmZpZzInOiAnRGFzIFBmZXJkIGZyaXNzdCBrZWluIFJlaXMuJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHQnY29uZmlnNCc6ICcnXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaCc6IHtcblx0XHRcdFx0J2NvbG9yQ3VzdG9taXphdGlvbnMnOiB7XG5cdFx0XHRcdFx0J3N0YXR1c0Jhci5mb3JlZ3JvdW5kJzogJ3NvbWV2YWx1ZSdcblx0XHRcdFx0fSxcblx0XHRcdFx0J2VtcHR5b2JqZWN0a2V5Jzoge1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYWxsLmdldENvbmZpZ3VyYXRpb24oKTtcblx0XHRsZXQgYWN0dWFsOiBhbnkgPSB0ZXN0T2JqZWN0LmdldCgnZmFyYm9vJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHQnY29uZmlnMCc6IHRydWUsXG5cdFx0XHQnbmVzdGVkJzoge1xuXHRcdFx0XHQnY29uZmlnMSc6IDQyLFxuXHRcdFx0XHQnY29uZmlnMic6ICdEYXMgUGZlcmQgZnJpc3N0IGtlaW4gUmVpcy4nXG5cdFx0XHR9LFxuXHRcdFx0J2NvbmZpZzQnOiAnJ1xuXHRcdH0pLCBKU09OLnN0cmluZ2lmeShhY3R1YWwpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodW5kZWZpbmVkLCBKU09OLnN0cmluZ2lmeSh0ZXN0T2JqZWN0LmdldCgndW5rbm93bmtleScpKSk7XG5cblx0XHRhY3R1YWwgPSB0ZXN0T2JqZWN0LmdldCgnZmFyYm9vJykhO1xuXHRcdGFjdHVhbFsnY29uZmlnMCddID0gZmFsc2U7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHQnY29uZmlnMCc6IGZhbHNlLFxuXHRcdFx0J25lc3RlZCc6IHtcblx0XHRcdFx0J2NvbmZpZzEnOiA0Mixcblx0XHRcdFx0J2NvbmZpZzInOiAnRGFzIFBmZXJkIGZyaXNzdCBrZWluIFJlaXMuJ1xuXHRcdFx0fSxcblx0XHRcdCdjb25maWc0JzogJydcblx0XHR9KSwgSlNPTi5zdHJpbmdpZnkoYWN0dWFsKSk7XG5cblx0XHRhY3R1YWwgPSB0ZXN0T2JqZWN0LmdldDxhbnk+KCd3b3JrYmVuY2gnKSFbJ2NvbG9yQ3VzdG9taXphdGlvbnMnXSE7XG5cdFx0YWN0dWFsWydzdGF0dXNCYXIuYmFja2dyb3VuZCddID0gJ2Fub3RoZXJ2YWx1ZSc7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHQnc3RhdHVzQmFyLmZvcmVncm91bmQnOiAnc29tZXZhbHVlJyxcblx0XHRcdCdzdGF0dXNCYXIuYmFja2dyb3VuZCc6ICdhbm90aGVydmFsdWUnXG5cdFx0fSksIEpTT04uc3RyaW5naWZ5KGFjdHVhbCkpO1xuXG5cdFx0YWN0dWFsID0gdGVzdE9iamVjdC5nZXQoJ3dvcmtiZW5jaCcpO1xuXHRcdGFjdHVhbFsndW5rbm93bmtleSddID0gJ3NvbWV2YWx1ZSc7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHQnY29sb3JDdXN0b21pemF0aW9ucyc6IHtcblx0XHRcdFx0J3N0YXR1c0Jhci5mb3JlZ3JvdW5kJzogJ3NvbWV2YWx1ZSdcblx0XHRcdH0sXG5cdFx0XHQnZW1wdHlvYmplY3RrZXknOiB7fSxcblx0XHRcdCd1bmtub3dua2V5JzogJ3NvbWV2YWx1ZSdcblx0XHR9KSwgSlNPTi5zdHJpbmdpZnkoYWN0dWFsKSk7XG5cblx0XHRhY3R1YWwgPSBhbGwuZ2V0Q29uZmlndXJhdGlvbignd29ya2JlbmNoJykuZ2V0KCdlbXB0eW9iamVjdGtleScpO1xuXHRcdGFjdHVhbCA9IHtcblx0XHRcdC4uLihhY3R1YWwgfHwge30pLFxuXHRcdFx0J3N0YXR1c0Jhci5iYWNrZ3JvdW5kJzogYCMwZmZgLFxuXHRcdFx0J3N0YXR1c0Jhci5mb3JlZ3JvdW5kJzogYCNmZjBgLFxuXHRcdH07XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHQnc3RhdHVzQmFyLmJhY2tncm91bmQnOiBgIzBmZmAsXG5cdFx0XHQnc3RhdHVzQmFyLmZvcmVncm91bmQnOiBgI2ZmMGAsXG5cdFx0fSksIEpTT04uc3RyaW5naWZ5KGFjdHVhbCkpO1xuXG5cdFx0YWN0dWFsID0gYWxsLmdldENvbmZpZ3VyYXRpb24oJ3dvcmtiZW5jaCcpLmdldCgndW5rbm93bmtleScpO1xuXHRcdGFjdHVhbCA9IHtcblx0XHRcdC4uLihhY3R1YWwgfHwge30pLFxuXHRcdFx0J3N0YXR1c0Jhci5iYWNrZ3JvdW5kJzogYCMwZmZgLFxuXHRcdFx0J3N0YXR1c0Jhci5mb3JlZ3JvdW5kJzogYCNmZjBgLFxuXHRcdH07XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHQnc3RhdHVzQmFyLmJhY2tncm91bmQnOiBgIzBmZmAsXG5cdFx0XHQnc3RhdHVzQmFyLmZvcmVncm91bmQnOiBgI2ZmMGAsXG5cdFx0fSksIEpTT04uc3RyaW5naWZ5KGFjdHVhbCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdjYW5ub3QgbW9kaWZ5IHJldHVybmVkIGNvbmZpZ3VyYXRpb24nLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBhbGwgPSBjcmVhdGVFeHRIb3N0Q29uZmlndXJhdGlvbih7XG5cdFx0XHQnZmFyYm9vJzoge1xuXHRcdFx0XHQnY29uZmlnMCc6IHRydWUsXG5cdFx0XHRcdCduZXN0ZWQnOiB7XG5cdFx0XHRcdFx0J2NvbmZpZzEnOiA0Mixcblx0XHRcdFx0XHQnY29uZmlnMic6ICdEYXMgUGZlcmQgZnJpc3N0IGtlaW4gUmVpcy4nXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdjb25maWc0JzogJydcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHRlc3RPYmplY3Q6IGFueSA9IGFsbC5nZXRDb25maWd1cmF0aW9uKCk7XG5cblx0XHR0cnkge1xuXHRcdFx0dGVzdE9iamVjdFsnZ2V0J10gPSBudWxsO1xuXHRcdFx0YXNzZXJ0LmZhaWwoJ1RoaXMgc2hvdWxkIGJlIHJlYWRvbmx5Jyk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHR0ZXN0T2JqZWN0WydmYXJib28nXVsnY29uZmlnMCddID0gZmFsc2U7XG5cdFx0XHRhc3NlcnQuZmFpbCgnVGhpcyBzaG91bGQgYmUgcmVhZG9ubHknKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHRlc3RPYmplY3RbJ2ZhcmJvbyddWydmYXJib28xJ10gPSAnaGVsbG8nO1xuXHRcdFx0YXNzZXJ0LmZhaWwoJ1RoaXMgc2hvdWxkIGJlIHJlYWRvbmx5Jyk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnaW5zcGVjdCBpbiBubyB3b3Jrc3BhY2UgY29udGV4dCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gbmV3IEV4dEhvc3RDb25maWdQcm92aWRlcihcblx0XHRcdG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8TWFpblRocmVhZENvbmZpZ3VyYXRpb25TaGFwZT4oKSB7IH0sXG5cdFx0XHRjcmVhdGVFeHRIb3N0V29ya3NwYWNlKCksXG5cdFx0XHR7XG5cdFx0XHRcdGRlZmF1bHRzOiBuZXcgQ29uZmlndXJhdGlvbk1vZGVsKHtcblx0XHRcdFx0XHQnZWRpdG9yJzoge1xuXHRcdFx0XHRcdFx0J3dvcmRXcmFwJzogJ29mZicsXG5cdFx0XHRcdFx0XHQnbGluZU51bWJlcnMnOiAnb24nLFxuXHRcdFx0XHRcdFx0J2ZvbnRTaXplJzogJzEycHgnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCBbJ2VkaXRvci53b3JkV3JhcCddLCBbXSwgdW5kZWZpbmVkLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSksXG5cdFx0XHRcdHBvbGljeTogQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobmV3IE51bGxMb2dTZXJ2aWNlKCkpLFxuXHRcdFx0XHRhcHBsaWNhdGlvbjogQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobmV3IE51bGxMb2dTZXJ2aWNlKCkpLFxuXHRcdFx0XHR1c2VyTG9jYWw6IG5ldyBDb25maWd1cmF0aW9uTW9kZWwoe1xuXHRcdFx0XHRcdCdlZGl0b3InOiB7XG5cdFx0XHRcdFx0XHQnd29yZFdyYXAnOiAnb24nLFxuXHRcdFx0XHRcdFx0J2xpbmVOdW1iZXJzJzogJ29mZidcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIFsnZWRpdG9yLndvcmRXcmFwJywgJ2VkaXRvci5saW5lTnVtYmVycyddLCBbXSwgdW5kZWZpbmVkLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSksXG5cdFx0XHRcdHVzZXJSZW1vdGU6IG5ldyBDb25maWd1cmF0aW9uTW9kZWwoe1xuXHRcdFx0XHRcdCdlZGl0b3InOiB7XG5cdFx0XHRcdFx0XHQnbGluZU51bWJlcnMnOiAncmVsYXRpdmUnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCBbJ2VkaXRvci5saW5lTnVtYmVycyddLCBbXSwge1xuXHRcdFx0XHRcdCdlZGl0b3InOiB7XG5cdFx0XHRcdFx0XHQnbGluZU51bWJlcnMnOiAncmVsYXRpdmUnLFxuXHRcdFx0XHRcdFx0J2ZvbnRTaXplJzogJzE0cHgnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCBuZXcgTnVsbExvZ1NlcnZpY2UoKSksXG5cdFx0XHRcdHdvcmtzcGFjZTogbmV3IENvbmZpZ3VyYXRpb25Nb2RlbCh7fSwgW10sIFtdLCB1bmRlZmluZWQsIG5ldyBOdWxsTG9nU2VydmljZSgpKSxcblx0XHRcdFx0Zm9sZGVyczogW10sXG5cdFx0XHRcdGNvbmZpZ3VyYXRpb25TY29wZXM6IFtdXG5cdFx0XHR9LFxuXHRcdFx0bmV3IE51bGxMb2dTZXJ2aWNlKClcblx0XHQpO1xuXG5cdFx0bGV0IGFjdHVhbDogQ29uZmlndXJhdGlvbkluc3BlY3Q8c3RyaW5nPiA9IHRlc3RPYmplY3QuZ2V0Q29uZmlndXJhdGlvbigpLmluc3BlY3QoJ2VkaXRvci53b3JkV3JhcCcpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmRlZmF1bHRWYWx1ZSwgJ29mZicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2xvYmFsTG9jYWxWYWx1ZSwgJ29uJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5nbG9iYWxSZW1vdGVWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmdsb2JhbFZhbHVlLCAnb24nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLndvcmtzcGFjZVZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwud29ya3NwYWNlRm9sZGVyVmFsdWUsIHVuZGVmaW5lZCk7XG5cblx0XHRhY3R1YWwgPSB0ZXN0T2JqZWN0LmdldENvbmZpZ3VyYXRpb24oJ2VkaXRvcicpLmluc3BlY3QoJ3dvcmRXcmFwJykhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZGVmYXVsdFZhbHVlLCAnb2ZmJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5nbG9iYWxMb2NhbFZhbHVlLCAnb24nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmdsb2JhbFJlbW90ZVZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2xvYmFsVmFsdWUsICdvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwud29ya3NwYWNlVmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC53b3Jrc3BhY2VGb2xkZXJWYWx1ZSwgdW5kZWZpbmVkKTtcblxuXHRcdGFjdHVhbCA9IHRlc3RPYmplY3QuZ2V0Q29uZmlndXJhdGlvbignZWRpdG9yJykuaW5zcGVjdCgnbGluZU51bWJlcnMnKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5kZWZhdWx0VmFsdWUsICdvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2xvYmFsTG9jYWxWYWx1ZSwgJ29mZicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2xvYmFsUmVtb3RlVmFsdWUsICdyZWxhdGl2ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2xvYmFsVmFsdWUsICdyZWxhdGl2ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwud29ya3NwYWNlVmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC53b3Jrc3BhY2VGb2xkZXJWYWx1ZSwgdW5kZWZpbmVkKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmdldENvbmZpZ3VyYXRpb24oJ2VkaXRvcicpLmdldCgnZm9udFNpemUnKSwgJzEycHgnKTtcblxuXHRcdGFjdHVhbCA9IHRlc3RPYmplY3QuZ2V0Q29uZmlndXJhdGlvbignZWRpdG9yJykuaW5zcGVjdCgnZm9udFNpemUnKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5kZWZhdWx0VmFsdWUsICcxMnB4Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5nbG9iYWxMb2NhbFZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2xvYmFsUmVtb3RlVmFsdWUsICcxNHB4Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5nbG9iYWxWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLndvcmtzcGFjZVZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwud29ya3NwYWNlRm9sZGVyVmFsdWUsIHVuZGVmaW5lZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc3BlY3QgaW4gc2luZ2xlIHJvb3QgY29udGV4dCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB3b3Jrc3BhY2VVcmkgPSBVUkkuZmlsZSgnZm9vJyk7XG5cdFx0Y29uc3QgZm9sZGVyczogW1VyaUNvbXBvbmVudHMsIElDb25maWd1cmF0aW9uTW9kZWxdW10gPSBbXTtcblx0XHRjb25zdCB3b3Jrc3BhY2UgPSBuZXcgQ29uZmlndXJhdGlvbk1vZGVsKHtcblx0XHRcdCdlZGl0b3InOiB7XG5cdFx0XHRcdCd3b3JkV3JhcCc6ICdib3VuZGVkJ1xuXHRcdFx0fVxuXHRcdH0sIFsnZWRpdG9yLndvcmRXcmFwJ10sIFtdLCB1bmRlZmluZWQsIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0XHRmb2xkZXJzLnB1c2goW3dvcmtzcGFjZVVyaSwgd29ya3NwYWNlXSk7XG5cdFx0Y29uc3QgZXh0SG9zdFdvcmtzcGFjZSA9IGNyZWF0ZUV4dEhvc3RXb3Jrc3BhY2UoKTtcblx0XHRleHRIb3N0V29ya3NwYWNlLiRpbml0aWFsaXplV29ya3NwYWNlKHtcblx0XHRcdCdpZCc6ICdmb28nLFxuXHRcdFx0J2ZvbGRlcnMnOiBbYVdvcmtzcGFjZUZvbGRlcihVUkkuZmlsZSgnZm9vJyksIDApXSxcblx0XHRcdCduYW1lJzogJ2Zvbydcblx0XHR9LCB0cnVlKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gbmV3IEV4dEhvc3RDb25maWdQcm92aWRlcihcblx0XHRcdG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8TWFpblRocmVhZENvbmZpZ3VyYXRpb25TaGFwZT4oKSB7IH0sXG5cdFx0XHRleHRIb3N0V29ya3NwYWNlLFxuXHRcdFx0e1xuXHRcdFx0XHRkZWZhdWx0czogbmV3IENvbmZpZ3VyYXRpb25Nb2RlbCh7XG5cdFx0XHRcdFx0J2VkaXRvcic6IHtcblx0XHRcdFx0XHRcdCd3b3JkV3JhcCc6ICdvZmYnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCBbJ2VkaXRvci53b3JkV3JhcCddLCBbXSwgdW5kZWZpbmVkLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSksXG5cdFx0XHRcdHBvbGljeTogQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobmV3IE51bGxMb2dTZXJ2aWNlKCkpLFxuXHRcdFx0XHRhcHBsaWNhdGlvbjogQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobmV3IE51bGxMb2dTZXJ2aWNlKCkpLFxuXHRcdFx0XHR1c2VyTG9jYWw6IG5ldyBDb25maWd1cmF0aW9uTW9kZWwoe1xuXHRcdFx0XHRcdCdlZGl0b3InOiB7XG5cdFx0XHRcdFx0XHQnd29yZFdyYXAnOiAnb24nXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCBbJ2VkaXRvci53b3JkV3JhcCddLCBbXSwgdW5kZWZpbmVkLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSksXG5cdFx0XHRcdHVzZXJSZW1vdGU6IENvbmZpZ3VyYXRpb25Nb2RlbC5jcmVhdGVFbXB0eU1vZGVsKG5ldyBOdWxsTG9nU2VydmljZSgpKSxcblx0XHRcdFx0d29ya3NwYWNlLFxuXHRcdFx0XHRmb2xkZXJzLFxuXHRcdFx0XHRjb25maWd1cmF0aW9uU2NvcGVzOiBbXVxuXHRcdFx0fSxcblx0XHRcdG5ldyBOdWxsTG9nU2VydmljZSgpXG5cdFx0KTtcblxuXHRcdGxldCBhY3R1YWwxOiBDb25maWd1cmF0aW9uSW5zcGVjdDxzdHJpbmc+ID0gdGVzdE9iamVjdC5nZXRDb25maWd1cmF0aW9uKCkuaW5zcGVjdCgnZWRpdG9yLndvcmRXcmFwJykhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLmRlZmF1bHRWYWx1ZSwgJ29mZicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLmdsb2JhbExvY2FsVmFsdWUsICdvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLmdsb2JhbFJlbW90ZVZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLmdsb2JhbFZhbHVlLCAnb24nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS53b3Jrc3BhY2VWYWx1ZSwgJ2JvdW5kZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS53b3Jrc3BhY2VGb2xkZXJWYWx1ZSwgdW5kZWZpbmVkKTtcblxuXHRcdGFjdHVhbDEgPSB0ZXN0T2JqZWN0LmdldENvbmZpZ3VyYXRpb24oJ2VkaXRvcicpLmluc3BlY3QoJ3dvcmRXcmFwJykhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLmRlZmF1bHRWYWx1ZSwgJ29mZicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLmdsb2JhbExvY2FsVmFsdWUsICdvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLmdsb2JhbFJlbW90ZVZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLmdsb2JhbFZhbHVlLCAnb24nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS53b3Jrc3BhY2VWYWx1ZSwgJ2JvdW5kZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS53b3Jrc3BhY2VGb2xkZXJWYWx1ZSwgdW5kZWZpbmVkKTtcblxuXHRcdGxldCBhY3R1YWwyOiBDb25maWd1cmF0aW9uSW5zcGVjdDxzdHJpbmc+ID0gdGVzdE9iamVjdC5nZXRDb25maWd1cmF0aW9uKHVuZGVmaW5lZCwgd29ya3NwYWNlVXJpKS5pbnNwZWN0KCdlZGl0b3Iud29yZFdyYXAnKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIuZGVmYXVsdFZhbHVlLCAnb2ZmJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIuZ2xvYmFsTG9jYWxWYWx1ZSwgJ29uJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIuZ2xvYmFsUmVtb3RlVmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIuZ2xvYmFsVmFsdWUsICdvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLndvcmtzcGFjZVZhbHVlLCAnYm91bmRlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLndvcmtzcGFjZUZvbGRlclZhbHVlLCAnYm91bmRlZCcpO1xuXG5cdFx0YWN0dWFsMiA9IHRlc3RPYmplY3QuZ2V0Q29uZmlndXJhdGlvbignZWRpdG9yJywgd29ya3NwYWNlVXJpKS5pbnNwZWN0KCd3b3JkV3JhcCcpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi5kZWZhdWx0VmFsdWUsICdvZmYnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi5nbG9iYWxMb2NhbFZhbHVlLCAnb24nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi5nbG9iYWxSZW1vdGVWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi5nbG9iYWxWYWx1ZSwgJ29uJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIud29ya3NwYWNlVmFsdWUsICdib3VuZGVkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIud29ya3NwYWNlRm9sZGVyVmFsdWUsICdib3VuZGVkJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc3BlY3QgaW4gbXVsdGkgcm9vdCBjb250ZXh0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IG5ldyBDb25maWd1cmF0aW9uTW9kZWwoe1xuXHRcdFx0J2VkaXRvcic6IHtcblx0XHRcdFx0J3dvcmRXcmFwJzogJ2JvdW5kZWQnXG5cdFx0XHR9XG5cdFx0fSwgWydlZGl0b3Iud29yZFdyYXAnXSwgW10sIHVuZGVmaW5lZCwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXG5cdFx0Y29uc3QgZmlyc3RSb290ID0gVVJJLmZpbGUoJ2ZvbzEnKTtcblx0XHRjb25zdCBzZWNvbmRSb290ID0gVVJJLmZpbGUoJ2ZvbzInKTtcblx0XHRjb25zdCB0aGlyZFJvb3QgPSBVUkkuZmlsZSgnZm9vMycpO1xuXHRcdGNvbnN0IGZvbGRlcnM6IFtVcmlDb21wb25lbnRzLCBJQ29uZmlndXJhdGlvbk1vZGVsXVtdID0gW107XG5cdFx0Zm9sZGVycy5wdXNoKFtmaXJzdFJvb3QsIG5ldyBDb25maWd1cmF0aW9uTW9kZWwoe1xuXHRcdFx0J2VkaXRvcic6IHtcblx0XHRcdFx0J3dvcmRXcmFwJzogJ29mZicsXG5cdFx0XHRcdCdsaW5lTnVtYmVycyc6ICdyZWxhdGl2ZSdcblx0XHRcdH1cblx0XHR9LCBbJ2VkaXRvci53b3JkV3JhcCddLCBbXSwgdW5kZWZpbmVkLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSldKTtcblx0XHRmb2xkZXJzLnB1c2goW3NlY29uZFJvb3QsIG5ldyBDb25maWd1cmF0aW9uTW9kZWwoe1xuXHRcdFx0J2VkaXRvcic6IHtcblx0XHRcdFx0J3dvcmRXcmFwJzogJ29uJ1xuXHRcdFx0fVxuXHRcdH0sIFsnZWRpdG9yLndvcmRXcmFwJ10sIFtdLCB1bmRlZmluZWQsIG5ldyBOdWxsTG9nU2VydmljZSgpKV0pO1xuXHRcdGZvbGRlcnMucHVzaChbdGhpcmRSb290LCBuZXcgQ29uZmlndXJhdGlvbk1vZGVsKHt9LCBbXSwgW10sIHVuZGVmaW5lZCwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpXSk7XG5cblx0XHRjb25zdCBleHRIb3N0V29ya3NwYWNlID0gY3JlYXRlRXh0SG9zdFdvcmtzcGFjZSgpO1xuXHRcdGV4dEhvc3RXb3Jrc3BhY2UuJGluaXRpYWxpemVXb3Jrc3BhY2Uoe1xuXHRcdFx0J2lkJzogJ2ZvbycsXG5cdFx0XHQnZm9sZGVycyc6IFthV29ya3NwYWNlRm9sZGVyKGZpcnN0Um9vdCwgMCksIGFXb3Jrc3BhY2VGb2xkZXIoc2Vjb25kUm9vdCwgMSldLFxuXHRcdFx0J25hbWUnOiAnZm9vJ1xuXHRcdH0sIHRydWUpO1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBuZXcgRXh0SG9zdENvbmZpZ1Byb3ZpZGVyKFxuXHRcdFx0bmV3IGNsYXNzIGV4dGVuZHMgbW9jazxNYWluVGhyZWFkQ29uZmlndXJhdGlvblNoYXBlPigpIHsgfSxcblx0XHRcdGV4dEhvc3RXb3Jrc3BhY2UsXG5cdFx0XHR7XG5cdFx0XHRcdGRlZmF1bHRzOiBuZXcgQ29uZmlndXJhdGlvbk1vZGVsKHtcblx0XHRcdFx0XHQnZWRpdG9yJzoge1xuXHRcdFx0XHRcdFx0J3dvcmRXcmFwJzogJ29mZicsXG5cdFx0XHRcdFx0XHQnbGluZU51bWJlcnMnOiAnb24nXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCBbJ2VkaXRvci53b3JkV3JhcCddLCBbXSwgdW5kZWZpbmVkLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSksXG5cdFx0XHRcdHBvbGljeTogQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobmV3IE51bGxMb2dTZXJ2aWNlKCkpLFxuXHRcdFx0XHRhcHBsaWNhdGlvbjogQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobmV3IE51bGxMb2dTZXJ2aWNlKCkpLFxuXHRcdFx0XHR1c2VyTG9jYWw6IG5ldyBDb25maWd1cmF0aW9uTW9kZWwoe1xuXHRcdFx0XHRcdCdlZGl0b3InOiB7XG5cdFx0XHRcdFx0XHQnd29yZFdyYXAnOiAnb24nXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCBbJ2VkaXRvci53b3JkV3JhcCddLCBbXSwgdW5kZWZpbmVkLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSksXG5cdFx0XHRcdHVzZXJSZW1vdGU6IENvbmZpZ3VyYXRpb25Nb2RlbC5jcmVhdGVFbXB0eU1vZGVsKG5ldyBOdWxsTG9nU2VydmljZSgpKSxcblx0XHRcdFx0d29ya3NwYWNlLFxuXHRcdFx0XHRmb2xkZXJzLFxuXHRcdFx0XHRjb25maWd1cmF0aW9uU2NvcGVzOiBbXVxuXHRcdFx0fSxcblx0XHRcdG5ldyBOdWxsTG9nU2VydmljZSgpXG5cdFx0KTtcblxuXHRcdGxldCBhY3R1YWwxOiBDb25maWd1cmF0aW9uSW5zcGVjdDxzdHJpbmc+ID0gdGVzdE9iamVjdC5nZXRDb25maWd1cmF0aW9uKCkuaW5zcGVjdCgnZWRpdG9yLndvcmRXcmFwJykhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLmRlZmF1bHRWYWx1ZSwgJ29mZicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLmdsb2JhbFZhbHVlLCAnb24nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS5nbG9iYWxMb2NhbFZhbHVlLCAnb24nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS5nbG9iYWxSZW1vdGVWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS53b3Jrc3BhY2VWYWx1ZSwgJ2JvdW5kZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS53b3Jrc3BhY2VGb2xkZXJWYWx1ZSwgdW5kZWZpbmVkKTtcblxuXHRcdGFjdHVhbDEgPSB0ZXN0T2JqZWN0LmdldENvbmZpZ3VyYXRpb24oJ2VkaXRvcicpLmluc3BlY3QoJ3dvcmRXcmFwJykhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLmRlZmF1bHRWYWx1ZSwgJ29mZicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLmdsb2JhbFZhbHVlLCAnb24nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS5nbG9iYWxMb2NhbFZhbHVlLCAnb24nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS5nbG9iYWxSZW1vdGVWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS53b3Jrc3BhY2VWYWx1ZSwgJ2JvdW5kZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS53b3Jrc3BhY2VGb2xkZXJWYWx1ZSwgdW5kZWZpbmVkKTtcblxuXHRcdGFjdHVhbDEgPSB0ZXN0T2JqZWN0LmdldENvbmZpZ3VyYXRpb24oJ2VkaXRvcicpLmluc3BlY3QoJ2xpbmVOdW1iZXJzJykhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLmRlZmF1bHRWYWx1ZSwgJ29uJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEuZ2xvYmFsVmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEuZ2xvYmFsTG9jYWxWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS5nbG9iYWxSZW1vdGVWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS53b3Jrc3BhY2VWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS53b3Jrc3BhY2VGb2xkZXJWYWx1ZSwgdW5kZWZpbmVkKTtcblxuXHRcdGxldCBhY3R1YWwyOiBDb25maWd1cmF0aW9uSW5zcGVjdDxzdHJpbmc+ID0gdGVzdE9iamVjdC5nZXRDb25maWd1cmF0aW9uKHVuZGVmaW5lZCwgZmlyc3RSb290KS5pbnNwZWN0KCdlZGl0b3Iud29yZFdyYXAnKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIuZGVmYXVsdFZhbHVlLCAnb2ZmJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIuZ2xvYmFsVmFsdWUsICdvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLmdsb2JhbExvY2FsVmFsdWUsICdvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLmdsb2JhbFJlbW90ZVZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLndvcmtzcGFjZVZhbHVlLCAnYm91bmRlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLndvcmtzcGFjZUZvbGRlclZhbHVlLCAnb2ZmJyk7XG5cblx0XHRhY3R1YWwyID0gdGVzdE9iamVjdC5nZXRDb25maWd1cmF0aW9uKCdlZGl0b3InLCBmaXJzdFJvb3QpLmluc3BlY3QoJ3dvcmRXcmFwJykhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLmRlZmF1bHRWYWx1ZSwgJ29mZicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLmdsb2JhbFZhbHVlLCAnb24nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi5nbG9iYWxMb2NhbFZhbHVlLCAnb24nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi5nbG9iYWxSZW1vdGVWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi53b3Jrc3BhY2VWYWx1ZSwgJ2JvdW5kZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi53b3Jrc3BhY2VGb2xkZXJWYWx1ZSwgJ29mZicpO1xuXG5cdFx0YWN0dWFsMiA9IHRlc3RPYmplY3QuZ2V0Q29uZmlndXJhdGlvbignZWRpdG9yJywgZmlyc3RSb290KS5pbnNwZWN0KCdsaW5lTnVtYmVycycpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi5kZWZhdWx0VmFsdWUsICdvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLmdsb2JhbFZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLmdsb2JhbExvY2FsVmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIuZ2xvYmFsUmVtb3RlVmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIud29ya3NwYWNlVmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIud29ya3NwYWNlRm9sZGVyVmFsdWUsICdyZWxhdGl2ZScpO1xuXG5cdFx0YWN0dWFsMiA9IHRlc3RPYmplY3QuZ2V0Q29uZmlndXJhdGlvbih1bmRlZmluZWQsIHNlY29uZFJvb3QpLmluc3BlY3QoJ2VkaXRvci53b3JkV3JhcCcpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi5kZWZhdWx0VmFsdWUsICdvZmYnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi5nbG9iYWxWYWx1ZSwgJ29uJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIuZ2xvYmFsTG9jYWxWYWx1ZSwgJ29uJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIuZ2xvYmFsUmVtb3RlVmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIud29ya3NwYWNlVmFsdWUsICdib3VuZGVkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIud29ya3NwYWNlRm9sZGVyVmFsdWUsICdvbicpO1xuXG5cdFx0YWN0dWFsMiA9IHRlc3RPYmplY3QuZ2V0Q29uZmlndXJhdGlvbignZWRpdG9yJywgc2Vjb25kUm9vdCkuaW5zcGVjdCgnd29yZFdyYXAnKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIuZGVmYXVsdFZhbHVlLCAnb2ZmJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIuZ2xvYmFsVmFsdWUsICdvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLmdsb2JhbExvY2FsVmFsdWUsICdvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLmdsb2JhbFJlbW90ZVZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLndvcmtzcGFjZVZhbHVlLCAnYm91bmRlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLndvcmtzcGFjZUZvbGRlclZhbHVlLCAnb24nKTtcblxuXHRcdGFjdHVhbDIgPSB0ZXN0T2JqZWN0LmdldENvbmZpZ3VyYXRpb24odW5kZWZpbmVkLCB0aGlyZFJvb3QpLmluc3BlY3QoJ2VkaXRvci53b3JkV3JhcCcpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi5kZWZhdWx0VmFsdWUsICdvZmYnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi5nbG9iYWxWYWx1ZSwgJ29uJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIuZ2xvYmFsTG9jYWxWYWx1ZSwgJ29uJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIuZ2xvYmFsUmVtb3RlVmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIud29ya3NwYWNlVmFsdWUsICdib3VuZGVkJyk7XG5cdFx0YXNzZXJ0Lm9rKE9iamVjdC5rZXlzKGFjdHVhbDIpLmluZGV4T2YoJ3dvcmtzcGFjZUZvbGRlclZhbHVlJykgIT09IC0xKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi53b3Jrc3BhY2VGb2xkZXJWYWx1ZSwgdW5kZWZpbmVkKTtcblxuXHRcdGFjdHVhbDIgPSB0ZXN0T2JqZWN0LmdldENvbmZpZ3VyYXRpb24oJ2VkaXRvcicsIHRoaXJkUm9vdCkuaW5zcGVjdCgnd29yZFdyYXAnKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIuZGVmYXVsdFZhbHVlLCAnb2ZmJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIuZ2xvYmFsVmFsdWUsICdvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLmdsb2JhbExvY2FsVmFsdWUsICdvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLmdsb2JhbFJlbW90ZVZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLndvcmtzcGFjZVZhbHVlLCAnYm91bmRlZCcpO1xuXHRcdGFzc2VydC5vayhPYmplY3Qua2V5cyhhY3R1YWwyKS5pbmRleE9mKCd3b3Jrc3BhY2VGb2xkZXJWYWx1ZScpICE9PSAtMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIud29ya3NwYWNlRm9sZGVyVmFsdWUsIHVuZGVmaW5lZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc3BlY3Qgd2l0aCBsYW5ndWFnZSBvdmVycmlkZXMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZmlyc3RSb290ID0gVVJJLmZpbGUoJ2ZvbzEnKTtcblx0XHRjb25zdCBzZWNvbmRSb290ID0gVVJJLmZpbGUoJ2ZvbzInKTtcblx0XHRjb25zdCBmb2xkZXJzOiBbVXJpQ29tcG9uZW50cywgSUNvbmZpZ3VyYXRpb25Nb2RlbF1bXSA9IFtdO1xuXHRcdGZvbGRlcnMucHVzaChbZmlyc3RSb290LCB0b0NvbmZpZ3VyYXRpb25Nb2RlbCh7XG5cdFx0XHQnZWRpdG9yLndvcmRXcmFwJzogJ2JvdW5kZWQnLFxuXHRcdFx0J1t0eXBlc2NyaXB0XSc6IHtcblx0XHRcdFx0J2VkaXRvci53b3JkV3JhcCc6ICd1bmJvdW5kZWQnLFxuXHRcdFx0fVxuXHRcdH0pXSk7XG5cdFx0Zm9sZGVycy5wdXNoKFtzZWNvbmRSb290LCB0b0NvbmZpZ3VyYXRpb25Nb2RlbCh7fSldKTtcblxuXHRcdGNvbnN0IGV4dEhvc3RXb3Jrc3BhY2UgPSBjcmVhdGVFeHRIb3N0V29ya3NwYWNlKCk7XG5cdFx0ZXh0SG9zdFdvcmtzcGFjZS4kaW5pdGlhbGl6ZVdvcmtzcGFjZSh7XG5cdFx0XHQnaWQnOiAnZm9vJyxcblx0XHRcdCdmb2xkZXJzJzogW2FXb3Jrc3BhY2VGb2xkZXIoZmlyc3RSb290LCAwKSwgYVdvcmtzcGFjZUZvbGRlcihzZWNvbmRSb290LCAxKV0sXG5cdFx0XHQnbmFtZSc6ICdmb28nXG5cdFx0fSwgdHJ1ZSk7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IG5ldyBFeHRIb3N0Q29uZmlnUHJvdmlkZXIoXG5cdFx0XHRuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPE1haW5UaHJlYWRDb25maWd1cmF0aW9uU2hhcGU+KCkgeyB9LFxuXHRcdFx0ZXh0SG9zdFdvcmtzcGFjZSxcblx0XHRcdHtcblx0XHRcdFx0ZGVmYXVsdHM6IHRvQ29uZmlndXJhdGlvbk1vZGVsKHtcblx0XHRcdFx0XHQnZWRpdG9yLndvcmRXcmFwJzogJ29mZicsXG5cdFx0XHRcdFx0J1ttYXJrZG93bl0nOiB7XG5cdFx0XHRcdFx0XHQnZWRpdG9yLndvcmRXcmFwJzogJ2JvdW5kZWQnLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSksXG5cdFx0XHRcdHBvbGljeTogQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobmV3IE51bGxMb2dTZXJ2aWNlKCkpLFxuXHRcdFx0XHRhcHBsaWNhdGlvbjogQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobmV3IE51bGxMb2dTZXJ2aWNlKCkpLFxuXHRcdFx0XHR1c2VyTG9jYWw6IHRvQ29uZmlndXJhdGlvbk1vZGVsKHtcblx0XHRcdFx0XHQnZWRpdG9yLndvcmRXcmFwJzogJ2JvdW5kZWQnLFxuXHRcdFx0XHRcdCdbdHlwZXNjcmlwdF0nOiB7XG5cdFx0XHRcdFx0XHQnZWRpdG9yLmxpbmVOdW1iZXJzJzogJ29mZicsXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSxcblx0XHRcdFx0dXNlclJlbW90ZTogQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobmV3IE51bGxMb2dTZXJ2aWNlKCkpLFxuXHRcdFx0XHR3b3Jrc3BhY2U6IHRvQ29uZmlndXJhdGlvbk1vZGVsKHtcblx0XHRcdFx0XHQnW3R5cGVzY3JpcHRdJzoge1xuXHRcdFx0XHRcdFx0J2VkaXRvci53b3JkV3JhcCc6ICd1bmJvdW5kZWQnLFxuXHRcdFx0XHRcdFx0J2VkaXRvci5saW5lTnVtYmVycyc6ICdvZmYnLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSksXG5cdFx0XHRcdGZvbGRlcnMsXG5cdFx0XHRcdGNvbmZpZ3VyYXRpb25TY29wZXM6IFtdXG5cdFx0XHR9LFxuXHRcdFx0bmV3IE51bGxMb2dTZXJ2aWNlKClcblx0XHQpO1xuXG5cdFx0bGV0IGFjdHVhbDogQ29uZmlndXJhdGlvbkluc3BlY3Q8c3RyaW5nPiA9IHRlc3RPYmplY3QuZ2V0Q29uZmlndXJhdGlvbih1bmRlZmluZWQsIHsgdXJpOiBmaXJzdFJvb3QsIGxhbmd1YWdlSWQ6ICd0eXBlc2NyaXB0JyB9KS5pbnNwZWN0KCdlZGl0b3Iud29yZFdyYXAnKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5kZWZhdWx0VmFsdWUsICdvZmYnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmdsb2JhbFZhbHVlLCAnYm91bmRlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2xvYmFsTG9jYWxWYWx1ZSwgJ2JvdW5kZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmdsb2JhbFJlbW90ZVZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwud29ya3NwYWNlVmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC53b3Jrc3BhY2VGb2xkZXJWYWx1ZSwgJ2JvdW5kZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmRlZmF1bHRMYW5ndWFnZVZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2xvYmFsTGFuZ3VhZ2VWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLndvcmtzcGFjZUxhbmd1YWdlVmFsdWUsICd1bmJvdW5kZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLndvcmtzcGFjZUZvbGRlckxhbmd1YWdlVmFsdWUsICd1bmJvdW5kZWQnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sYW5ndWFnZUlkcywgWydtYXJrZG93bicsICd0eXBlc2NyaXB0J10pO1xuXG5cdFx0YWN0dWFsID0gdGVzdE9iamVjdC5nZXRDb25maWd1cmF0aW9uKHVuZGVmaW5lZCwgeyB1cmk6IHNlY29uZFJvb3QsIGxhbmd1YWdlSWQ6ICd0eXBlc2NyaXB0JyB9KS5pbnNwZWN0KCdlZGl0b3Iud29yZFdyYXAnKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5kZWZhdWx0VmFsdWUsICdvZmYnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmdsb2JhbFZhbHVlLCAnYm91bmRlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2xvYmFsTG9jYWxWYWx1ZSwgJ2JvdW5kZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmdsb2JhbFJlbW90ZVZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwud29ya3NwYWNlVmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC53b3Jrc3BhY2VGb2xkZXJWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmRlZmF1bHRMYW5ndWFnZVZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2xvYmFsTGFuZ3VhZ2VWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLndvcmtzcGFjZUxhbmd1YWdlVmFsdWUsICd1bmJvdW5kZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLndvcmtzcGFjZUZvbGRlckxhbmd1YWdlVmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubGFuZ3VhZ2VJZHMsIFsnbWFya2Rvd24nLCAndHlwZXNjcmlwdCddKTtcblx0fSk7XG5cblx0dGVzdCgnYXBwbGljYXRpb24gaXMgbm90IHNldCBpbiBpbnNwZWN0JywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IG5ldyBFeHRIb3N0Q29uZmlnUHJvdmlkZXIoXG5cdFx0XHRuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPE1haW5UaHJlYWRDb25maWd1cmF0aW9uU2hhcGU+KCkgeyB9LFxuXHRcdFx0Y3JlYXRlRXh0SG9zdFdvcmtzcGFjZSgpLFxuXHRcdFx0e1xuXHRcdFx0XHRkZWZhdWx0czogbmV3IENvbmZpZ3VyYXRpb25Nb2RlbCh7XG5cdFx0XHRcdFx0J2VkaXRvcic6IHtcblx0XHRcdFx0XHRcdCd3b3JkV3JhcCc6ICdvZmYnLFxuXHRcdFx0XHRcdFx0J2xpbmVOdW1iZXJzJzogJ29uJyxcblx0XHRcdFx0XHRcdCdmb250U2l6ZSc6ICcxMnB4J1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSwgWydlZGl0b3Iud29yZFdyYXAnXSwgW10sIHVuZGVmaW5lZCwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpLFxuXHRcdFx0XHRwb2xpY3k6IENvbmZpZ3VyYXRpb25Nb2RlbC5jcmVhdGVFbXB0eU1vZGVsKG5ldyBOdWxsTG9nU2VydmljZSgpKSxcblx0XHRcdFx0YXBwbGljYXRpb246IG5ldyBDb25maWd1cmF0aW9uTW9kZWwoe1xuXHRcdFx0XHRcdCdlZGl0b3InOiB7XG5cdFx0XHRcdFx0XHQnd29yZFdyYXAnOiAnb24nXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCBbJ2VkaXRvci53b3JkV3JhcCddLCBbXSwgdW5kZWZpbmVkLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSksXG5cdFx0XHRcdHVzZXJMb2NhbDogbmV3IENvbmZpZ3VyYXRpb25Nb2RlbCh7XG5cdFx0XHRcdFx0J2VkaXRvcic6IHtcblx0XHRcdFx0XHRcdCd3b3JkV3JhcCc6ICdhdXRvJyxcblx0XHRcdFx0XHRcdCdsaW5lTnVtYmVycyc6ICdvZmYnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCBbJ2VkaXRvci53b3JkV3JhcCddLCBbXSwgdW5kZWZpbmVkLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSksXG5cdFx0XHRcdHVzZXJSZW1vdGU6IENvbmZpZ3VyYXRpb25Nb2RlbC5jcmVhdGVFbXB0eU1vZGVsKG5ldyBOdWxsTG9nU2VydmljZSgpKSxcblx0XHRcdFx0d29ya3NwYWNlOiBuZXcgQ29uZmlndXJhdGlvbk1vZGVsKHt9LCBbXSwgW10sIHVuZGVmaW5lZCwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpLFxuXHRcdFx0XHRmb2xkZXJzOiBbXSxcblx0XHRcdFx0Y29uZmlndXJhdGlvblNjb3BlczogW11cblx0XHRcdH0sXG5cdFx0XHRuZXcgTnVsbExvZ1NlcnZpY2UoKVxuXHRcdCk7XG5cblx0XHRsZXQgYWN0dWFsOiBDb25maWd1cmF0aW9uSW5zcGVjdDxzdHJpbmc+ID0gdGVzdE9iamVjdC5nZXRDb25maWd1cmF0aW9uKCkuaW5zcGVjdCgnZWRpdG9yLndvcmRXcmFwJykhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZGVmYXVsdFZhbHVlLCAnb2ZmJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5nbG9iYWxWYWx1ZSwgJ2F1dG8nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmdsb2JhbExvY2FsVmFsdWUsICdhdXRvJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5nbG9iYWxSZW1vdGVWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLndvcmtzcGFjZVZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwud29ya3NwYWNlRm9sZGVyVmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3QuZ2V0Q29uZmlndXJhdGlvbigpLmdldCgnZWRpdG9yLndvcmRXcmFwJyksICdhdXRvJyk7XG5cblx0XHRhY3R1YWwgPSB0ZXN0T2JqZWN0LmdldENvbmZpZ3VyYXRpb24oKS5pbnNwZWN0KCdlZGl0b3IubGluZU51bWJlcnMnKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5kZWZhdWx0VmFsdWUsICdvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2xvYmFsVmFsdWUsICdvZmYnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmdsb2JhbExvY2FsVmFsdWUsICdvZmYnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmdsb2JhbFJlbW90ZVZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwud29ya3NwYWNlVmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC53b3Jrc3BhY2VGb2xkZXJWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5nZXRDb25maWd1cmF0aW9uKCkuZ2V0KCdlZGl0b3IubGluZU51bWJlcnMnKSwgJ29mZicpO1xuXG5cdFx0YWN0dWFsID0gdGVzdE9iamVjdC5nZXRDb25maWd1cmF0aW9uKCkuaW5zcGVjdCgnZWRpdG9yLmZvbnRTaXplJykhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZGVmYXVsdFZhbHVlLCAnMTJweCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2xvYmFsTG9jYWxWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmdsb2JhbFJlbW90ZVZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZ2xvYmFsVmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC53b3Jrc3BhY2VWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLndvcmtzcGFjZUZvbGRlclZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmdldENvbmZpZ3VyYXRpb24oKS5nZXQoJ2VkaXRvci5mb250U2l6ZScpLCAnMTJweCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRDb25maWd1cmF0aW9uIHZzIGdldCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGFsbCA9IGNyZWF0ZUV4dEhvc3RDb25maWd1cmF0aW9uKHtcblx0XHRcdCdmYXJib28nOiB7XG5cdFx0XHRcdCdjb25maWcwJzogdHJ1ZSxcblx0XHRcdFx0J2NvbmZpZzQnOiAzOFxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0bGV0IGNvbmZpZyA9IGFsbC5nZXRDb25maWd1cmF0aW9uKCdmYXJib28uY29uZmlnMCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb25maWcuZ2V0KCcnKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29uZmlnLmhhcygnJyksIGZhbHNlKTtcblxuXHRcdGNvbmZpZyA9IGFsbC5nZXRDb25maWd1cmF0aW9uKCdmYXJib28nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29uZmlnLmdldCgnY29uZmlnMCcpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29uZmlnLmhhcygnY29uZmlnMCcpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnbmFtZSB2cyBwcm9wZXJ0eScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBhbGwgPSBjcmVhdGVFeHRIb3N0Q29uZmlndXJhdGlvbih7XG5cdFx0XHQnZmFyYm9vJzoge1xuXHRcdFx0XHQnZ2V0JzogJ2dldC1wcm9wJ1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGNvbnN0IGNvbmZpZyA9IGFsbC5nZXRDb25maWd1cmF0aW9uKCdmYXJib28nKTtcblxuXHRcdGFzc2VydC5vayhjb25maWcuaGFzKCdnZXQnKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbmZpZy5nZXQoJ2dldCcpLCAnZ2V0LXByb3AnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbmZpZ1snZ2V0J10sIGNvbmZpZy5nZXQpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gY29uZmlnWydnZXQnXSA9IDxhbnk+J2dldC1wcm9wJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZTogbm8gdGFyZ2V0IHBhc3NlcyBudWxsJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHNoYXBlID0gbmV3IFJlY29yZGluZ1NoYXBlKCk7XG5cdFx0Y29uc3QgYWxsQ29uZmlnID0gY3JlYXRlRXh0SG9zdENvbmZpZ3VyYXRpb24oe1xuXHRcdFx0J2Zvbyc6IHtcblx0XHRcdFx0J2Jhcic6IDEsXG5cdFx0XHRcdCdmYXInOiAxXG5cdFx0XHR9XG5cdFx0fSwgc2hhcGUpO1xuXG5cdFx0Y29uc3QgY29uZmlnID0gYWxsQ29uZmlnLmdldENvbmZpZ3VyYXRpb24oJ2ZvbycpO1xuXHRcdGNvbmZpZy51cGRhdGUoJ2JhcicsIDQyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaGFwZS5sYXN0QXJnc1swXSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZS9zZWN0aW9uIHRvIGtleScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHNoYXBlID0gbmV3IFJlY29yZGluZ1NoYXBlKCk7XG5cdFx0Y29uc3QgYWxsQ29uZmlnID0gY3JlYXRlRXh0SG9zdENvbmZpZ3VyYXRpb24oe1xuXHRcdFx0J2Zvbyc6IHtcblx0XHRcdFx0J2Jhcic6IDEsXG5cdFx0XHRcdCdmYXInOiAxXG5cdFx0XHR9XG5cdFx0fSwgc2hhcGUpO1xuXG5cdFx0bGV0IGNvbmZpZyA9IGFsbENvbmZpZy5nZXRDb25maWd1cmF0aW9uKCdmb28nKTtcblx0XHRjb25maWcudXBkYXRlKCdiYXInLCA0MiwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hhcGUubGFzdEFyZ3NbMF0sIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNoYXBlLmxhc3RBcmdzWzFdLCAnZm9vLmJhcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaGFwZS5sYXN0QXJnc1syXSwgNDIpO1xuXG5cdFx0Y29uZmlnID0gYWxsQ29uZmlnLmdldENvbmZpZ3VyYXRpb24oJycpO1xuXHRcdGNvbmZpZy51cGRhdGUoJ2JhcicsIDQyLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hhcGUubGFzdEFyZ3NbMV0sICdiYXInKTtcblxuXHRcdGNvbmZpZy51cGRhdGUoJ2Zvby5iYXInLCA0MiwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNoYXBlLmxhc3RBcmdzWzFdLCAnZm9vLmJhcicpO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGUsIHdoYXQgaXMgIzE1ODM0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHNoYXBlID0gbmV3IFJlY29yZGluZ1NoYXBlKCk7XG5cdFx0Y29uc3QgYWxsQ29uZmlnID0gY3JlYXRlRXh0SG9zdENvbmZpZ3VyYXRpb24oe1xuXHRcdFx0J2VkaXRvcic6IHtcblx0XHRcdFx0J2Zvcm1hdE9uU2F2ZSc6IHRydWVcblx0XHRcdH1cblx0XHR9LCBzaGFwZSk7XG5cblx0XHRhbGxDb25maWcuZ2V0Q29uZmlndXJhdGlvbignZWRpdG9yJykudXBkYXRlKCdmb3JtYXRPblNhdmUnLCB7IGV4dGVuc2lvbnM6IFsndHMnXSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hhcGUubGFzdEFyZ3NbMV0sICdlZGl0b3IuZm9ybWF0T25TYXZlJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzaGFwZS5sYXN0QXJnc1syXSwgeyBleHRlbnNpb25zOiBbJ3RzJ10gfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZS9lcnJvci1zdGF0ZSBub3QgT0snLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBzaGFwZSA9IG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8TWFpblRocmVhZENvbmZpZ3VyYXRpb25TaGFwZT4oKSB7XG5cdFx0XHRvdmVycmlkZSAkdXBkYXRlQ29uZmlndXJhdGlvbk9wdGlvbih0YXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQsIGtleTogc3RyaW5nLCB2YWx1ZTogYW55KTogUHJvbWlzZTxhbnk+IHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignVW5rbm93biBLZXknKSk7IC8vIHNvbWV0aGluZyAhPT0gT0tcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0cmV0dXJuIGNyZWF0ZUV4dEhvc3RDb25maWd1cmF0aW9uKHt9LCBzaGFwZSlcblx0XHRcdC5nZXRDb25maWd1cmF0aW9uKCcnKVxuXHRcdFx0LnVwZGF0ZSgnJywgdHJ1ZSwgZmFsc2UpXG5cdFx0XHQudGhlbigoKSA9PiBhc3NlcnQub2soZmFsc2UpLCBlcnIgPT4geyAvKiBleHBlY3RpbmcgcmVqZWN0aW9uICovIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25maWd1cmF0aW9uIGNoYW5nZSBldmVudCcsIChkb25lKSA9PiB7XG5cblx0XHRjb25zdCB3b3Jrc3BhY2VGb2xkZXIgPSBhV29ya3NwYWNlRm9sZGVyKFVSSS5maWxlKCdmb2xkZXIxJyksIDApO1xuXHRcdGNvbnN0IGV4dEhvc3RXb3Jrc3BhY2UgPSBjcmVhdGVFeHRIb3N0V29ya3NwYWNlKCk7XG5cdFx0ZXh0SG9zdFdvcmtzcGFjZS4kaW5pdGlhbGl6ZVdvcmtzcGFjZSh7XG5cdFx0XHQnaWQnOiAnZm9vJyxcblx0XHRcdCdmb2xkZXJzJzogW3dvcmtzcGFjZUZvbGRlcl0sXG5cdFx0XHQnbmFtZSc6ICdmb28nXG5cdFx0fSwgdHJ1ZSk7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IG5ldyBFeHRIb3N0Q29uZmlnUHJvdmlkZXIoXG5cdFx0XHRuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPE1haW5UaHJlYWRDb25maWd1cmF0aW9uU2hhcGU+KCkgeyB9LFxuXHRcdFx0ZXh0SG9zdFdvcmtzcGFjZSxcblx0XHRcdGNyZWF0ZUNvbmZpZ3VyYXRpb25EYXRhKHtcblx0XHRcdFx0J2ZhcmJvbyc6IHtcblx0XHRcdFx0XHQnY29uZmlnJzogZmFsc2UsXG5cdFx0XHRcdFx0J3VwZGF0ZWRDb25maWcnOiBmYWxzZVxuXHRcdFx0XHR9XG5cdFx0XHR9KSxcblx0XHRcdG5ldyBOdWxsTG9nU2VydmljZSgpXG5cdFx0KTtcblxuXHRcdGNvbnN0IG5ld0NvbmZpZ0RhdGEgPSBjcmVhdGVDb25maWd1cmF0aW9uRGF0YSh7XG5cdFx0XHQnZmFyYm9vJzoge1xuXHRcdFx0XHQnY29uZmlnJzogZmFsc2UsXG5cdFx0XHRcdCd1cGRhdGVkQ29uZmlnJzogdHJ1ZSxcblx0XHRcdFx0J25ld0NvbmZpZyc6IHRydWUsXG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0Y29uc3QgY29uZmlnRXZlbnREYXRhOiBJQ29uZmlndXJhdGlvbkNoYW5nZSA9IHsga2V5czogWydmYXJib28udXBkYXRlZENvbmZpZycsICdmYXJib28ubmV3Q29uZmlnJ10sIG92ZXJyaWRlczogW10gfTtcblx0XHRzdG9yZS5hZGQodGVzdE9iamVjdC5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5nZXRDb25maWd1cmF0aW9uKCkuZ2V0KCdmYXJib28nKSwge1xuXHRcdFx0XHQnY29uZmlnJzogZmFsc2UsXG5cdFx0XHRcdCd1cGRhdGVkQ29uZmlnJzogdHJ1ZSxcblx0XHRcdFx0J25ld0NvbmZpZyc6IHRydWUsXG5cdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0Lm9rKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2ZhcmJvbycpKTtcblx0XHRcdGFzc2VydC5vayhlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdmYXJib28nLCB3b3Jrc3BhY2VGb2xkZXIudXJpKSk7XG5cdFx0XHRhc3NlcnQub2soZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZmFyYm9vJywgVVJJLmZpbGUoJ2FueScpKSk7XG5cblx0XHRcdGFzc2VydC5vayhlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdmYXJib28udXBkYXRlZENvbmZpZycpKTtcblx0XHRcdGFzc2VydC5vayhlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdmYXJib28udXBkYXRlZENvbmZpZycsIHdvcmtzcGFjZUZvbGRlci51cmkpKTtcblx0XHRcdGFzc2VydC5vayhlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdmYXJib28udXBkYXRlZENvbmZpZycsIFVSSS5maWxlKCdhbnknKSkpO1xuXG5cdFx0XHRhc3NlcnQub2soZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZmFyYm9vLm5ld0NvbmZpZycpKTtcblx0XHRcdGFzc2VydC5vayhlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdmYXJib28ubmV3Q29uZmlnJywgd29ya3NwYWNlRm9sZGVyLnVyaSkpO1xuXHRcdFx0YXNzZXJ0Lm9rKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2ZhcmJvby5uZXdDb25maWcnLCBVUkkuZmlsZSgnYW55JykpKTtcblxuXHRcdFx0YXNzZXJ0Lm9rKCFlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdmYXJib28uY29uZmlnJykpO1xuXHRcdFx0YXNzZXJ0Lm9rKCFlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdmYXJib28uY29uZmlnJywgd29ya3NwYWNlRm9sZGVyLnVyaSkpO1xuXHRcdFx0YXNzZXJ0Lm9rKCFlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdmYXJib28uY29uZmlnJywgVVJJLmZpbGUoJ2FueScpKSk7XG5cdFx0XHRkb25lKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGVzdE9iamVjdC4kYWNjZXB0Q29uZmlndXJhdGlvbkNoYW5nZWQobmV3Q29uZmlnRGF0YSwgY29uZmlnRXZlbnREYXRhKTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0IHJldHVybiBpbnN0YW5jZSBvZiBhcnJheSB2YWx1ZScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gY3JlYXRlRXh0SG9zdENvbmZpZ3VyYXRpb24oeyAnZmFyJzogeyAnYm9vJzogW10gfSB9KTtcblxuXHRcdGNvbnN0IHZhbHVlOiBzdHJpbmdbXSA9IHRlc3RPYmplY3QuZ2V0Q29uZmlndXJhdGlvbigpLmdldCgnZmFyLmJvbycsIFtdKTtcblx0XHR2YWx1ZS5wdXNoKCdhJyk7XG5cblx0XHRjb25zdCBhY3R1YWwgPSB0ZXN0T2JqZWN0LmdldENvbmZpZ3VyYXRpb24oKS5nZXQoJ2Zhci5ib28nLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIFtdKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gYVdvcmtzcGFjZUZvbGRlcih1cmk6IFVSSSwgaW5kZXg6IG51bWJlciwgbmFtZTogc3RyaW5nID0gJycpOiBJV29ya3NwYWNlRm9sZGVyIHtcblx0XHRyZXR1cm4gbmV3IFdvcmtzcGFjZUZvbGRlcih7IHVyaSwgbmFtZSwgaW5kZXggfSk7XG5cdH1cblxuXHRmdW5jdGlvbiB0b0NvbmZpZ3VyYXRpb25Nb2RlbChvYmo6IGFueSk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0Y29uc3QgcGFyc2VyID0gbmV3IENvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlcigndGVzdCcsIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0XHRwYXJzZXIucGFyc2UoSlNPTi5zdHJpbmdpZnkob2JqKSk7XG5cdFx0cmV0dXJuIHBhcnNlci5jb25maWd1cmF0aW9uTW9kZWw7XG5cdH1cblxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxXQUEwQjtBQUNuQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUErQiw2QkFBNkI7QUFFNUQsU0FBUyxvQkFBb0IsZ0NBQWdDO0FBQzdELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsWUFBWTtBQUNyQixTQUEyQix1QkFBdUI7QUFDbEQsU0FBUywyQkFBc0U7QUFDL0UsU0FBUyxzQkFBc0I7QUFHL0IsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyxlQUFlO0FBRXhCLFNBQVMsK0NBQStDO0FBRXhELE1BQU0sd0JBQXdCLFdBQVk7QUFBQSxFQUV6QyxNQUFNLHVCQUF1QixLQUFtQyxFQUFFO0FBQUEsSUFFeEQsMkJBQTJCLFFBQTZCLEtBQWEsT0FBMkI7QUFDeEcsV0FBSyxXQUFXLENBQUMsUUFBUSxLQUFLLEtBQUs7QUFDbkMsYUFBTyxRQUFRLFFBQVEsTUFBUztBQUFBLElBQ2pDO0FBQUEsRUFDRDtBQUVBLFdBQVMseUJBQTJDO0FBQ25ELFdBQU8sSUFBSSxpQkFBaUIsSUFBSSxnQkFBZ0IsR0FBRyxJQUFJLGNBQWMsS0FBOEIsRUFBRTtBQUFBLElBQUUsS0FBRyxJQUFJLGNBQWMsS0FBNkIsRUFBRTtBQUFBLE1BQVcsa0JBQWtCO0FBQUUsZUFBTyxVQUFVLCtCQUErQixvQkFBb0I7QUFBQSxNQUFXO0FBQUEsSUFBRSxLQUFHLElBQUksZUFBZSxHQUFHLElBQUksY0FBYyxLQUE2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
