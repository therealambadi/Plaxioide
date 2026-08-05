import * as nls from "../../../../nls.js";
import * as Objects from "../../../../base/common/objects.js";
import commonSchema from "./jsonSchemaCommon.js";
import { ProblemMatcherRegistry } from "./problemMatcher.js";
import { TaskDefinitionRegistry } from "./taskDefinitionRegistry.js";
import * as ConfigurationResolverUtils from "../../../services/configurationResolver/common/configurationResolverUtils.js";
import { inputsSchema } from "../../../services/configurationResolver/common/configurationResolverSchema.js";
import { getAllCodicons } from "../../../../base/common/codicons.js";
function fixReferences(literal) {
  if (Array.isArray(literal)) {
    literal.forEach(fixReferences);
  } else if (typeof literal === "object") {
    if (literal["$ref"]) {
      literal["$ref"] = literal["$ref"] + "2";
    }
    Object.getOwnPropertyNames(literal).forEach((property) => {
      const value = literal[property];
      if (Array.isArray(value) || typeof value === "object") {
        fixReferences(value);
      }
    });
  }
}
const shellCommand = {
  anyOf: [
    {
      type: "boolean",
      default: true,
      description: nls.localize("JsonSchema.shell", "Specifies whether the command is a shell command or an external program. Defaults to false if omitted.")
    },
    {
      $ref: "#/definitions/shellConfiguration"
    }
  ],
  deprecationMessage: nls.localize("JsonSchema.tasks.isShellCommand.deprecated", "The property isShellCommand is deprecated. Use the type property of the task and the shell property in the options instead. See also the 1.14 release notes.")
};
const hide = {
  type: "boolean",
  description: nls.localize("JsonSchema.hide", "Hide this task from the run task quick pick"),
  default: true
};
const taskIdentifier = {
  type: "object",
  additionalProperties: true,
  properties: {
    type: {
      type: "string",
      description: nls.localize("JsonSchema.tasks.dependsOn.identifier", "The task identifier.")
    }
  }
};
const dependsOn = {
  anyOf: [
    {
      type: "string",
      description: nls.localize("JsonSchema.tasks.dependsOn.string", "Another task this task depends on.")
    },
    taskIdentifier,
    {
      type: "array",
      description: nls.localize("JsonSchema.tasks.dependsOn.array", "The other tasks this task depends on."),
      items: {
        anyOf: [
          {
            type: "string"
          },
          taskIdentifier
        ]
      }
    }
  ],
  description: nls.localize("JsonSchema.tasks.dependsOn", "Either a string representing another task or an array of other tasks that this task depends on.")
};
const dependsOrder = {
  type: "string",
  enum: ["parallel", "sequence"],
  enumDescriptions: [
    nls.localize("JsonSchema.tasks.dependsOrder.parallel", "Run all dependsOn tasks in parallel."),
    nls.localize("JsonSchema.tasks.dependsOrder.sequence", "Run all dependsOn tasks in sequence.")
  ],
  default: "parallel",
  description: nls.localize("JsonSchema.tasks.dependsOrder", "Determines the order of the dependsOn tasks for this task. Note that this property is not recursive.")
};
const detail = {
  type: "string",
  description: nls.localize("JsonSchema.tasks.detail", "An optional description of a task that shows in the Run Task quick pick as a detail.")
};
const icon = {
  type: "object",
  description: nls.localize("JsonSchema.tasks.icon", "An optional icon for the task"),
  properties: {
    id: {
      description: nls.localize("JsonSchema.tasks.icon.id", "An optional codicon ID to use"),
      type: ["string", "null"],
      enum: Array.from(getAllCodicons(), (icon2) => icon2.id),
      markdownEnumDescriptions: Array.from(getAllCodicons(), (icon2) => `$(${icon2.id})`)
    },
    color: {
      description: nls.localize("JsonSchema.tasks.icon.color", "An optional color of the icon"),
      type: ["string", "null"],
      enum: [
        "terminal.ansiBlack",
        "terminal.ansiRed",
        "terminal.ansiGreen",
        "terminal.ansiYellow",
        "terminal.ansiBlue",
        "terminal.ansiMagenta",
        "terminal.ansiCyan",
        "terminal.ansiWhite"
      ]
    }
  }
};
const presentation = {
  type: "object",
  default: {
    echo: true,
    reveal: "always",
    focus: false,
    panel: "shared",
    showReuseMessage: true,
    clear: false
  },
  description: nls.localize("JsonSchema.tasks.presentation", "Configures the panel that is used to present the task's output and reads its input."),
  additionalProperties: false,
  properties: {
    echo: {
      type: "boolean",
      default: true,
      description: nls.localize("JsonSchema.tasks.presentation.echo", "Controls whether the executed command is echoed to the panel. Default is true.")
    },
    focus: {
      type: "boolean",
      default: false,
      description: nls.localize("JsonSchema.tasks.presentation.focus", "Controls whether the panel takes focus. Default is false. If set to true the panel is revealed as well.")
    },
    revealProblems: {
      type: "string",
      enum: ["always", "onProblem", "never"],
      enumDescriptions: [
        nls.localize("JsonSchema.tasks.presentation.revealProblems.always", "Always reveals the problems panel when this task is executed."),
        nls.localize("JsonSchema.tasks.presentation.revealProblems.onProblem", "Only reveals the problems panel if a problem is found."),
        nls.localize("JsonSchema.tasks.presentation.revealProblems.never", "Never reveals the problems panel when this task is executed.")
      ],
      default: "never",
      description: nls.localize("JsonSchema.tasks.presentation.revealProblems", 'Controls whether the problems panel is revealed when running this task or not. Takes precedence over option "reveal". Default is "never".')
    },
    reveal: {
      type: "string",
      enum: ["always", "silent", "never"],
      enumDescriptions: [
        nls.localize("JsonSchema.tasks.presentation.reveal.always", "Always reveals the terminal when this task is executed."),
        nls.localize("JsonSchema.tasks.presentation.reveal.silent", "Only reveals the terminal if the task exits with an error or the problem matcher finds an error."),
        nls.localize("JsonSchema.tasks.presentation.reveal.never", "Never reveals the terminal when this task is executed.")
      ],
      default: "always",
      description: nls.localize("JsonSchema.tasks.presentation.reveal", 'Controls whether the terminal running the task is revealed or not. May be overridden by option "revealProblems". Default is "always".')
    },
    panel: {
      type: "string",
      enum: ["shared", "dedicated", "new"],
      default: "shared",
      description: nls.localize("JsonSchema.tasks.presentation.instance", "Controls if the panel is shared between tasks, dedicated to this task or a new one is created on every run.")
    },
    showReuseMessage: {
      type: "boolean",
      default: true,
      description: nls.localize("JsonSchema.tasks.presentation.showReuseMessage", "Controls whether to show the `Terminal will be reused by tasks, press any key to close it` message.")
    },
    clear: {
      type: "boolean",
      default: false,
      description: nls.localize("JsonSchema.tasks.presentation.clear", "Controls whether the terminal is cleared before executing the task.")
    },
    group: {
      type: "string",
      description: nls.localize("JsonSchema.tasks.presentation.group", "Controls whether the task is executed in a specific terminal group using split panes.")
    },
    close: {
      type: "boolean",
      description: nls.localize("JsonSchema.tasks.presentation.close", "Controls whether the terminal the task runs in is closed when the task exits.")
    }
  }
};
const terminal = Objects.deepClone(presentation);
terminal.deprecationMessage = nls.localize("JsonSchema.tasks.terminal", "The terminal property is deprecated. Use presentation instead");
const groupStrings = {
  type: "string",
  enum: [
    "build",
    "test",
    "none"
  ],
  enumDescriptions: [
    nls.localize("JsonSchema.tasks.group.build", "Marks the task as a build task accessible through the 'Run Build Task' command."),
    nls.localize("JsonSchema.tasks.group.test", "Marks the task as a test task accessible through the 'Run Test Task' command."),
    nls.localize("JsonSchema.tasks.group.none", "Assigns the task to no group")
  ],
  description: nls.localize("JsonSchema.tasks.group.kind", "The task's execution group.")
};
const group = {
  oneOf: [
    groupStrings,
    {
      type: "object",
      properties: {
        kind: groupStrings,
        isDefault: {
          type: ["boolean", "string"],
          default: false,
          description: nls.localize("JsonSchema.tasks.group.isDefault", "Defines if this task is the default task in the group, or a glob to match the file which should trigger this task.")
        }
      }
    }
  ],
  defaultSnippets: [
    {
      body: { kind: "build", isDefault: true },
      description: nls.localize("JsonSchema.tasks.group.defaultBuild", "Marks the task as the default build task.")
    },
    {
      body: { kind: "test", isDefault: true },
      description: nls.localize("JsonSchema.tasks.group.defaultTest", "Marks the task as the default test task.")
    }
  ],
  description: nls.localize("JsonSchema.tasks.group", 'Defines to which execution group this task belongs to. It supports "build" to add it to the build group and "test" to add it to the test group.')
};
const taskType = {
  type: "string",
  enum: ["shell"],
  default: "process",
  description: nls.localize("JsonSchema.tasks.type", "Defines whether the task is run as a process or as a command inside a shell.")
};
const command = {
  oneOf: [
    {
      oneOf: [
        {
          type: "string"
        },
        {
          type: "array",
          items: {
            type: "string"
          },
          description: nls.localize("JsonSchema.commandArray", "The shell command to be executed. Array items will be joined using a space character")
        }
      ]
    },
    {
      type: "object",
      required: ["value", "quoting"],
      properties: {
        value: {
          oneOf: [
            {
              type: "string"
            },
            {
              type: "array",
              items: {
                type: "string"
              },
              description: nls.localize("JsonSchema.commandArray", "The shell command to be executed. Array items will be joined using a space character")
            }
          ],
          description: nls.localize("JsonSchema.command.quotedString.value", "The actual command value")
        },
        quoting: {
          type: "string",
          enum: ["escape", "strong", "weak"],
          enumDescriptions: [
            nls.localize("JsonSchema.tasks.quoting.escape", "Escapes characters using the shell's escape character (e.g. ` under PowerShell and \\ under bash)."),
            nls.localize("JsonSchema.tasks.quoting.strong", "Quotes the argument using the shell's strong quote character (e.g. ' under PowerShell and bash)."),
            nls.localize("JsonSchema.tasks.quoting.weak", `Quotes the argument using the shell's weak quote character (e.g. " under PowerShell and bash).`)
          ],
          default: "strong",
          description: nls.localize("JsonSchema.command.quotesString.quote", "How the command value should be quoted.")
        }
      }
    }
  ],
  description: nls.localize("JsonSchema.command", "The command to be executed. Can be an external program or a shell command.")
};
const args = {
  type: "array",
  items: {
    oneOf: [
      {
        type: "string"
      },
      {
        type: "object",
        required: ["value", "quoting"],
        properties: {
          value: {
            type: "string",
            description: nls.localize("JsonSchema.args.quotedString.value", "The actual argument value")
          },
          quoting: {
            type: "string",
            enum: ["escape", "strong", "weak"],
            enumDescriptions: [
              nls.localize("JsonSchema.tasks.quoting.escape", "Escapes characters using the shell's escape character (e.g. ` under PowerShell and \\ under bash)."),
              nls.localize("JsonSchema.tasks.quoting.strong", "Quotes the argument using the shell's strong quote character (e.g. ' under PowerShell and bash)."),
              nls.localize("JsonSchema.tasks.quoting.weak", `Quotes the argument using the shell's weak quote character (e.g. " under PowerShell and bash).`)
            ],
            default: "strong",
            description: nls.localize("JsonSchema.args.quotesString.quote", "How the argument value should be quoted.")
          }
        }
      }
    ]
  },
  description: nls.localize("JsonSchema.tasks.args", "Arguments passed to the command when this task is invoked.")
};
const label = {
  type: "string",
  description: nls.localize("JsonSchema.tasks.label", "The task's user interface label")
};
const version = {
  type: "string",
  enum: ["2.0.0"],
  description: nls.localize("JsonSchema.version", "The config's version number.")
};
const identifier = {
  type: "string",
  description: nls.localize("JsonSchema.tasks.identifier", "A user defined identifier to reference the task in launch.json or a dependsOn clause."),
  deprecationMessage: nls.localize("JsonSchema.tasks.identifier.deprecated", "User defined identifiers are deprecated. For custom task use the name as a reference and for tasks provided by extensions use their defined task identifier.")
};
const runOptions = {
  type: "object",
  additionalProperties: false,
  properties: {
    reevaluateOnRerun: {
      type: "boolean",
      description: nls.localize("JsonSchema.tasks.reevaluateOnRerun", "Whether to reevaluate task variables on rerun."),
      default: true
    },
    runOn: {
      type: "string",
      enum: ["default", "folderOpen"],
      description: nls.localize("JsonSchema.tasks.runOn", "Configures when the task should be run. If set to folderOpen, then the task will be run automatically when the folder is opened."),
      default: "default"
    },
    instanceLimit: {
      type: "number",
      description: nls.localize("JsonSchema.tasks.instanceLimit", "The number of instances of the task that are allowed to run simultaneously."),
      default: 1
    }
  },
  description: nls.localize("JsonSchema.tasks.runOptions", "The task's run related options")
};
const commonSchemaDefinitions = commonSchema.definitions;
const options = Objects.deepClone(commonSchemaDefinitions.options);
const optionsProperties = options.properties;
optionsProperties.shell = Objects.deepClone(commonSchemaDefinitions.shellConfiguration);
const taskConfiguration = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: {
      type: "string",
      description: nls.localize("JsonSchema.tasks.taskLabel", "The task's label")
    },
    taskName: {
      type: "string",
      description: nls.localize("JsonSchema.tasks.taskName", "The task's name"),
      deprecationMessage: nls.localize("JsonSchema.tasks.taskName.deprecated", "The task's name property is deprecated. Use the label property instead.")
    },
    identifier: Objects.deepClone(identifier),
    group: Objects.deepClone(group),
    isBackground: {
      type: "boolean",
      description: nls.localize("JsonSchema.tasks.background", "Whether the executed task is kept alive and is running in the background."),
      default: true
    },
    promptOnClose: {
      type: "boolean",
      description: nls.localize("JsonSchema.tasks.promptOnClose", "Whether the user is prompted when VS Code closes with a running task."),
      default: false
    },
    presentation: Objects.deepClone(presentation),
    icon: Objects.deepClone(icon),
    hide: Objects.deepClone(hide),
    options,
    problemMatcher: {
      $ref: "#/definitions/problemMatcherType",
      description: nls.localize("JsonSchema.tasks.matchers", "The problem matcher(s) to use. Can either be a string or a problem matcher definition or an array of strings and problem matchers.")
    },
    runOptions: Objects.deepClone(runOptions),
    dependsOn: Objects.deepClone(dependsOn),
    dependsOrder: Objects.deepClone(dependsOrder),
    detail: Objects.deepClone(detail)
  }
};
const taskDefinitions = [];
TaskDefinitionRegistry.onReady().then(() => {
  updateTaskDefinitions();
});
function updateTaskDefinitions() {
  for (const taskType2 of TaskDefinitionRegistry.all()) {
    if (taskDefinitions.find((schema3) => {
      return schema3.properties?.type?.enum?.find ? schema3.properties?.type.enum.find((element) => element === taskType2.taskType) : void 0;
    })) {
      continue;
    }
    const schema2 = Objects.deepClone(taskConfiguration);
    const schemaProperties = schema2.properties;
    schemaProperties.type = {
      type: "string",
      description: nls.localize("JsonSchema.customizations.customizes.type", "The task type to customize"),
      enum: [taskType2.taskType]
    };
    if (taskType2.required) {
      schema2.required = taskType2.required.slice();
    } else {
      schema2.required = [];
    }
    schema2.required.push("type");
    if (taskType2.properties) {
      for (const key of Object.keys(taskType2.properties)) {
        const property = taskType2.properties[key];
        schemaProperties[key] = Objects.deepClone(property);
      }
    }
    fixReferences(schema2);
    taskDefinitions.push(schema2);
  }
}
const customize = Objects.deepClone(taskConfiguration);
customize.properties.customize = {
  type: "string",
  deprecationMessage: nls.localize("JsonSchema.tasks.customize.deprecated", "The customize property is deprecated. See the 1.14 release notes on how to migrate to the new task customization approach")
};
if (!customize.required) {
  customize.required = [];
}
customize.required.push("customize");
taskDefinitions.push(customize);
const definitions = Objects.deepClone(commonSchemaDefinitions);
const taskDescription = definitions.taskDescription;
taskDescription.required = ["label"];
const taskDescriptionProperties = taskDescription.properties;
taskDescriptionProperties.label = Objects.deepClone(label);
taskDescriptionProperties.command = Objects.deepClone(command);
taskDescriptionProperties.args = Objects.deepClone(args);
taskDescriptionProperties.isShellCommand = Objects.deepClone(shellCommand);
taskDescriptionProperties.dependsOn = dependsOn;
taskDescriptionProperties.hide = Objects.deepClone(hide);
taskDescriptionProperties.dependsOrder = dependsOrder;
taskDescriptionProperties.identifier = Objects.deepClone(identifier);
taskDescriptionProperties.type = Objects.deepClone(taskType);
taskDescriptionProperties.presentation = Objects.deepClone(presentation);
taskDescriptionProperties.terminal = terminal;
taskDescriptionProperties.icon = Objects.deepClone(icon);
taskDescriptionProperties.group = Objects.deepClone(group);
taskDescriptionProperties.runOptions = Objects.deepClone(runOptions);
taskDescriptionProperties.detail = detail;
taskDescriptionProperties.taskName.deprecationMessage = nls.localize(
  "JsonSchema.tasks.taskName.deprecated",
  "The task's name property is deprecated. Use the label property instead."
);
const processTask = Objects.deepClone(taskDescription);
taskDescription.default = {
  label: "My Task",
  type: "shell",
  command: "echo Hello",
  problemMatcher: []
};
definitions.showOutputType.deprecationMessage = nls.localize(
  "JsonSchema.tasks.showOutput.deprecated",
  "The property showOutput is deprecated. Use the reveal property inside the presentation property instead. See also the 1.14 release notes."
);
taskDescriptionProperties.echoCommand.deprecationMessage = nls.localize(
  "JsonSchema.tasks.echoCommand.deprecated",
  "The property echoCommand is deprecated. Use the echo property inside the presentation property instead. See also the 1.14 release notes."
);
taskDescriptionProperties.suppressTaskName.deprecationMessage = nls.localize(
  "JsonSchema.tasks.suppressTaskName.deprecated",
  "The property suppressTaskName is deprecated. Inline the command with its arguments into the task instead. See also the 1.14 release notes."
);
taskDescriptionProperties.isBuildCommand.deprecationMessage = nls.localize(
  "JsonSchema.tasks.isBuildCommand.deprecated",
  "The property isBuildCommand is deprecated. Use the group property instead. See also the 1.14 release notes."
);
taskDescriptionProperties.isTestCommand.deprecationMessage = nls.localize(
  "JsonSchema.tasks.isTestCommand.deprecated",
  "The property isTestCommand is deprecated. Use the group property instead. See also the 1.14 release notes."
);
processTask.properties.type = {
  type: "string",
  enum: ["process"],
  default: "process",
  description: nls.localize("JsonSchema.tasks.type", "Defines whether the task is run as a process or as a command inside a shell.")
};
processTask.required.push("command");
processTask.required.push("type");
taskDefinitions.push(processTask);
taskDefinitions.push({
  $ref: "#/definitions/taskDescription"
});
const definitionsTaskRunnerConfigurationProperties = definitions.taskRunnerConfiguration.properties;
const tasks = definitionsTaskRunnerConfigurationProperties.tasks;
tasks.items = {
  oneOf: taskDefinitions
};
definitionsTaskRunnerConfigurationProperties.inputs = inputsSchema.definitions.inputs;
definitions.commandConfiguration.properties.isShellCommand = Objects.deepClone(shellCommand);
definitions.commandConfiguration.properties.args = Objects.deepClone(args);
definitions.options.properties.shell = {
  $ref: "#/definitions/shellConfiguration"
};
definitionsTaskRunnerConfigurationProperties.isShellCommand = Objects.deepClone(shellCommand);
definitionsTaskRunnerConfigurationProperties.type = Objects.deepClone(taskType);
definitionsTaskRunnerConfigurationProperties.group = Objects.deepClone(group);
definitionsTaskRunnerConfigurationProperties.presentation = Objects.deepClone(presentation);
definitionsTaskRunnerConfigurationProperties.suppressTaskName.deprecationMessage = nls.localize(
  "JsonSchema.tasks.suppressTaskName.deprecated",
  "The property suppressTaskName is deprecated. Inline the command with its arguments into the task instead. See also the 1.14 release notes."
);
definitionsTaskRunnerConfigurationProperties.taskSelector.deprecationMessage = nls.localize(
  "JsonSchema.tasks.taskSelector.deprecated",
  "The property taskSelector is deprecated. Inline the command with its arguments into the task instead. See also the 1.14 release notes."
);
const osSpecificTaskRunnerConfiguration = Objects.deepClone(definitions.taskRunnerConfiguration);
delete osSpecificTaskRunnerConfiguration.properties.tasks;
osSpecificTaskRunnerConfiguration.additionalProperties = false;
definitions.osSpecificTaskRunnerConfiguration = osSpecificTaskRunnerConfiguration;
definitionsTaskRunnerConfigurationProperties.version = Objects.deepClone(version);
const schema = {
  oneOf: [
    {
      "allOf": [
        {
          type: "object",
          required: ["version"],
          properties: {
            version: Objects.deepClone(version),
            windows: {
              "$ref": "#/definitions/osSpecificTaskRunnerConfiguration",
              "description": nls.localize("JsonSchema.windows", "Windows specific command configuration")
            },
            osx: {
              "$ref": "#/definitions/osSpecificTaskRunnerConfiguration",
              "description": nls.localize("JsonSchema.mac", "Mac specific command configuration")
            },
            linux: {
              "$ref": "#/definitions/osSpecificTaskRunnerConfiguration",
              "description": nls.localize("JsonSchema.linux", "Linux specific command configuration")
            }
          }
        },
        {
          $ref: "#/definitions/taskRunnerConfiguration"
        }
      ]
    }
  ]
};
schema.definitions = definitions;
function deprecatedVariableMessage(schemaMap, property) {
  const mapAtProperty = schemaMap[property].properties;
  if (mapAtProperty) {
    Object.keys(mapAtProperty).forEach((name) => {
      deprecatedVariableMessage(mapAtProperty, name);
    });
  } else {
    ConfigurationResolverUtils.applyDeprecatedVariableMessage(schemaMap[property]);
  }
}
Object.getOwnPropertyNames(definitions).forEach((key) => {
  const newKey = key + "2";
  definitions[newKey] = definitions[key];
  delete definitions[key];
  deprecatedVariableMessage(definitions, newKey);
});
fixReferences(schema);
function updateProblemMatchers() {
  try {
    const matcherIds = ProblemMatcherRegistry.keys().map((key) => "$" + key);
    definitions.problemMatcherType2.oneOf[0].enum = matcherIds;
    definitions.problemMatcherType2.oneOf[2].items.anyOf[0].enum = matcherIds;
  } catch (err) {
    console.log("Installing problem matcher ids failed");
  }
}
ProblemMatcherRegistry.onReady().then(() => {
  updateProblemMatchers();
});
var jsonSchema_v2_default = schema;
export {
  jsonSchema_v2_default as default,
  updateProblemMatchers,
  updateTaskDefinitions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9jb21tb24vanNvblNjaGVtYV92Mi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0ICogYXMgT2JqZWN0cyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IElKU09OU2NoZW1hLCBJSlNPTlNjaGVtYU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuXG5pbXBvcnQgY29tbW9uU2NoZW1hIGZyb20gJy4vanNvblNjaGVtYUNvbW1vbi5qcyc7XG5cbmltcG9ydCB7IFByb2JsZW1NYXRjaGVyUmVnaXN0cnkgfSBmcm9tICcuL3Byb2JsZW1NYXRjaGVyLmpzJztcbmltcG9ydCB7IFRhc2tEZWZpbml0aW9uUmVnaXN0cnkgfSBmcm9tICcuL3Rhc2tEZWZpbml0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0ICogYXMgQ29uZmlndXJhdGlvblJlc29sdmVyVXRpbHMgZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvY29uZmlndXJhdGlvblJlc29sdmVyL2NvbW1vbi9jb25maWd1cmF0aW9uUmVzb2x2ZXJVdGlscy5qcyc7XG5pbXBvcnQgeyBpbnB1dHNTY2hlbWEgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9jb25maWd1cmF0aW9uUmVzb2x2ZXIvY29tbW9uL2NvbmZpZ3VyYXRpb25SZXNvbHZlclNjaGVtYS5qcyc7XG5pbXBvcnQgeyBnZXRBbGxDb2RpY29ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcblxuZnVuY3Rpb24gZml4UmVmZXJlbmNlcyhsaXRlcmFsOiBhbnkpIHtcblx0aWYgKEFycmF5LmlzQXJyYXkobGl0ZXJhbCkpIHtcblx0XHRsaXRlcmFsLmZvckVhY2goZml4UmVmZXJlbmNlcyk7XG5cdH0gZWxzZSBpZiAodHlwZW9mIGxpdGVyYWwgPT09ICdvYmplY3QnKSB7XG5cdFx0aWYgKGxpdGVyYWxbJyRyZWYnXSkge1xuXHRcdFx0bGl0ZXJhbFsnJHJlZiddID0gbGl0ZXJhbFsnJHJlZiddICsgJzInO1xuXHRcdH1cblx0XHRPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhsaXRlcmFsKS5mb3JFYWNoKHByb3BlcnR5ID0+IHtcblx0XHRcdGNvbnN0IHZhbHVlID0gbGl0ZXJhbFtwcm9wZXJ0eV07XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgfHwgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuXHRcdFx0XHRmaXhSZWZlcmVuY2VzKHZhbHVlKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuXG5jb25zdCBzaGVsbENvbW1hbmQ6IElKU09OU2NoZW1hID0ge1xuXHRhbnlPZjogW1xuXHRcdHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnNoZWxsJywgJ1NwZWNpZmllcyB3aGV0aGVyIHRoZSBjb21tYW5kIGlzIGEgc2hlbGwgY29tbWFuZCBvciBhbiBleHRlcm5hbCBwcm9ncmFtLiBEZWZhdWx0cyB0byBmYWxzZSBpZiBvbWl0dGVkLicpXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9zaGVsbENvbmZpZ3VyYXRpb24nXG5cdFx0fVxuXHRdLFxuXHRkZXByZWNhdGlvbk1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5pc1NoZWxsQ29tbWFuZC5kZXByZWNhdGVkJywgJ1RoZSBwcm9wZXJ0eSBpc1NoZWxsQ29tbWFuZCBpcyBkZXByZWNhdGVkLiBVc2UgdGhlIHR5cGUgcHJvcGVydHkgb2YgdGhlIHRhc2sgYW5kIHRoZSBzaGVsbCBwcm9wZXJ0eSBpbiB0aGUgb3B0aW9ucyBpbnN0ZWFkLiBTZWUgYWxzbyB0aGUgMS4xNCByZWxlYXNlIG5vdGVzLicpXG59O1xuXG5cbmNvbnN0IGhpZGU6IElKU09OU2NoZW1hID0ge1xuXHR0eXBlOiAnYm9vbGVhbicsXG5cdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuaGlkZScsICdIaWRlIHRoaXMgdGFzayBmcm9tIHRoZSBydW4gdGFzayBxdWljayBwaWNrJyksXG5cdGRlZmF1bHQ6IHRydWVcbn07XG5cbmNvbnN0IHRhc2tJZGVudGlmaWVyOiBJSlNPTlNjaGVtYSA9IHtcblx0dHlwZTogJ29iamVjdCcsXG5cdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB0cnVlLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0dHlwZToge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLmRlcGVuZHNPbi5pZGVudGlmaWVyJywgJ1RoZSB0YXNrIGlkZW50aWZpZXIuJylcblx0XHR9XG5cdH1cbn07XG5cbmNvbnN0IGRlcGVuZHNPbjogSUpTT05TY2hlbWEgPSB7XG5cdGFueU9mOiBbXG5cdFx0e1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLmRlcGVuZHNPbi5zdHJpbmcnLCAnQW5vdGhlciB0YXNrIHRoaXMgdGFzayBkZXBlbmRzIG9uLicpXG5cdFx0fSxcblx0XHR0YXNrSWRlbnRpZmllcixcblx0XHR7XG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5kZXBlbmRzT24uYXJyYXknLCAnVGhlIG90aGVyIHRhc2tzIHRoaXMgdGFzayBkZXBlbmRzIG9uLicpLFxuXHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0YW55T2Y6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHRhc2tJZGVudGlmaWVyXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHR9XG5cdF0sXG5cdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MuZGVwZW5kc09uJywgJ0VpdGhlciBhIHN0cmluZyByZXByZXNlbnRpbmcgYW5vdGhlciB0YXNrIG9yIGFuIGFycmF5IG9mIG90aGVyIHRhc2tzIHRoYXQgdGhpcyB0YXNrIGRlcGVuZHMgb24uJylcbn07XG5cbmNvbnN0IGRlcGVuZHNPcmRlcjogSUpTT05TY2hlbWEgPSB7XG5cdHR5cGU6ICdzdHJpbmcnLFxuXHRlbnVtOiBbJ3BhcmFsbGVsJywgJ3NlcXVlbmNlJ10sXG5cdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MuZGVwZW5kc09yZGVyLnBhcmFsbGVsJywgJ1J1biBhbGwgZGVwZW5kc09uIHRhc2tzIGluIHBhcmFsbGVsLicpLFxuXHRcdG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5kZXBlbmRzT3JkZXIuc2VxdWVuY2UnLCAnUnVuIGFsbCBkZXBlbmRzT24gdGFza3MgaW4gc2VxdWVuY2UuJyksXG5cdF0sXG5cdGRlZmF1bHQ6ICdwYXJhbGxlbCcsXG5cdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MuZGVwZW5kc09yZGVyJywgJ0RldGVybWluZXMgdGhlIG9yZGVyIG9mIHRoZSBkZXBlbmRzT24gdGFza3MgZm9yIHRoaXMgdGFzay4gTm90ZSB0aGF0IHRoaXMgcHJvcGVydHkgaXMgbm90IHJlY3Vyc2l2ZS4nKVxufTtcblxuY29uc3QgZGV0YWlsOiBJSlNPTlNjaGVtYSA9IHtcblx0dHlwZTogJ3N0cmluZycsXG5cdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MuZGV0YWlsJywgJ0FuIG9wdGlvbmFsIGRlc2NyaXB0aW9uIG9mIGEgdGFzayB0aGF0IHNob3dzIGluIHRoZSBSdW4gVGFzayBxdWljayBwaWNrIGFzIGEgZGV0YWlsLicpXG59O1xuXG5jb25zdCBpY29uOiBJSlNPTlNjaGVtYSA9IHtcblx0dHlwZTogJ29iamVjdCcsXG5cdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MuaWNvbicsICdBbiBvcHRpb25hbCBpY29uIGZvciB0aGUgdGFzaycpLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0aWQ6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MuaWNvbi5pZCcsICdBbiBvcHRpb25hbCBjb2RpY29uIElEIHRvIHVzZScpLFxuXHRcdFx0dHlwZTogWydzdHJpbmcnLCAnbnVsbCddLFxuXHRcdFx0ZW51bTogQXJyYXkuZnJvbShnZXRBbGxDb2RpY29ucygpLCBpY29uID0+IGljb24uaWQpLFxuXHRcdFx0bWFya2Rvd25FbnVtRGVzY3JpcHRpb25zOiBBcnJheS5mcm9tKGdldEFsbENvZGljb25zKCksIGljb24gPT4gYCQoJHtpY29uLmlkfSlgKSxcblx0XHR9LFxuXHRcdGNvbG9yOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLmljb24uY29sb3InLCAnQW4gb3B0aW9uYWwgY29sb3Igb2YgdGhlIGljb24nKSxcblx0XHRcdHR5cGU6IFsnc3RyaW5nJywgJ251bGwnXSxcblx0XHRcdGVudW06IFtcblx0XHRcdFx0J3Rlcm1pbmFsLmFuc2lCbGFjaycsXG5cdFx0XHRcdCd0ZXJtaW5hbC5hbnNpUmVkJyxcblx0XHRcdFx0J3Rlcm1pbmFsLmFuc2lHcmVlbicsXG5cdFx0XHRcdCd0ZXJtaW5hbC5hbnNpWWVsbG93Jyxcblx0XHRcdFx0J3Rlcm1pbmFsLmFuc2lCbHVlJyxcblx0XHRcdFx0J3Rlcm1pbmFsLmFuc2lNYWdlbnRhJyxcblx0XHRcdFx0J3Rlcm1pbmFsLmFuc2lDeWFuJyxcblx0XHRcdFx0J3Rlcm1pbmFsLmFuc2lXaGl0ZSdcblx0XHRcdF0sXG5cdFx0fSxcblx0fVxufTtcblxuY29uc3QgcHJlc2VudGF0aW9uOiBJSlNPTlNjaGVtYSA9IHtcblx0dHlwZTogJ29iamVjdCcsXG5cdGRlZmF1bHQ6IHtcblx0XHRlY2hvOiB0cnVlLFxuXHRcdHJldmVhbDogJ2Fsd2F5cycsXG5cdFx0Zm9jdXM6IGZhbHNlLFxuXHRcdHBhbmVsOiAnc2hhcmVkJyxcblx0XHRzaG93UmV1c2VNZXNzYWdlOiB0cnVlLFxuXHRcdGNsZWFyOiBmYWxzZSxcblx0fSxcblx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5wcmVzZW50YXRpb24nLCAnQ29uZmlndXJlcyB0aGUgcGFuZWwgdGhhdCBpcyB1c2VkIHRvIHByZXNlbnQgdGhlIHRhc2tcXCdzIG91dHB1dCBhbmQgcmVhZHMgaXRzIGlucHV0LicpLFxuXHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdHByb3BlcnRpZXM6IHtcblx0XHRlY2hvOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5wcmVzZW50YXRpb24uZWNobycsICdDb250cm9scyB3aGV0aGVyIHRoZSBleGVjdXRlZCBjb21tYW5kIGlzIGVjaG9lZCB0byB0aGUgcGFuZWwuIERlZmF1bHQgaXMgdHJ1ZS4nKVxuXHRcdH0sXG5cdFx0Zm9jdXM6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5wcmVzZW50YXRpb24uZm9jdXMnLCAnQ29udHJvbHMgd2hldGhlciB0aGUgcGFuZWwgdGFrZXMgZm9jdXMuIERlZmF1bHQgaXMgZmFsc2UuIElmIHNldCB0byB0cnVlIHRoZSBwYW5lbCBpcyByZXZlYWxlZCBhcyB3ZWxsLicpXG5cdFx0fSxcblx0XHRyZXZlYWxQcm9ibGVtczoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ2Fsd2F5cycsICdvblByb2JsZW0nLCAnbmV2ZXInXSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLnByZXNlbnRhdGlvbi5yZXZlYWxQcm9ibGVtcy5hbHdheXMnLCAnQWx3YXlzIHJldmVhbHMgdGhlIHByb2JsZW1zIHBhbmVsIHdoZW4gdGhpcyB0YXNrIGlzIGV4ZWN1dGVkLicpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MucHJlc2VudGF0aW9uLnJldmVhbFByb2JsZW1zLm9uUHJvYmxlbScsICdPbmx5IHJldmVhbHMgdGhlIHByb2JsZW1zIHBhbmVsIGlmIGEgcHJvYmxlbSBpcyBmb3VuZC4nKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLnByZXNlbnRhdGlvbi5yZXZlYWxQcm9ibGVtcy5uZXZlcicsICdOZXZlciByZXZlYWxzIHRoZSBwcm9ibGVtcyBwYW5lbCB3aGVuIHRoaXMgdGFzayBpcyBleGVjdXRlZC4nKSxcblx0XHRcdF0sXG5cdFx0XHRkZWZhdWx0OiAnbmV2ZXInLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5wcmVzZW50YXRpb24ucmV2ZWFsUHJvYmxlbXMnLCAnQ29udHJvbHMgd2hldGhlciB0aGUgcHJvYmxlbXMgcGFuZWwgaXMgcmV2ZWFsZWQgd2hlbiBydW5uaW5nIHRoaXMgdGFzayBvciBub3QuIFRha2VzIHByZWNlZGVuY2Ugb3ZlciBvcHRpb24gXFxcInJldmVhbFxcXCIuIERlZmF1bHQgaXMgXFxcIm5ldmVyXFxcIi4nKVxuXHRcdH0sXG5cdFx0cmV2ZWFsOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnYWx3YXlzJywgJ3NpbGVudCcsICduZXZlciddLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MucHJlc2VudGF0aW9uLnJldmVhbC5hbHdheXMnLCAnQWx3YXlzIHJldmVhbHMgdGhlIHRlcm1pbmFsIHdoZW4gdGhpcyB0YXNrIGlzIGV4ZWN1dGVkLicpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MucHJlc2VudGF0aW9uLnJldmVhbC5zaWxlbnQnLCAnT25seSByZXZlYWxzIHRoZSB0ZXJtaW5hbCBpZiB0aGUgdGFzayBleGl0cyB3aXRoIGFuIGVycm9yIG9yIHRoZSBwcm9ibGVtIG1hdGNoZXIgZmluZHMgYW4gZXJyb3IuJyksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5wcmVzZW50YXRpb24ucmV2ZWFsLm5ldmVyJywgJ05ldmVyIHJldmVhbHMgdGhlIHRlcm1pbmFsIHdoZW4gdGhpcyB0YXNrIGlzIGV4ZWN1dGVkLicpLFxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6ICdhbHdheXMnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5wcmVzZW50YXRpb24ucmV2ZWFsJywgJ0NvbnRyb2xzIHdoZXRoZXIgdGhlIHRlcm1pbmFsIHJ1bm5pbmcgdGhlIHRhc2sgaXMgcmV2ZWFsZWQgb3Igbm90LiBNYXkgYmUgb3ZlcnJpZGRlbiBieSBvcHRpb24gXFxcInJldmVhbFByb2JsZW1zXFxcIi4gRGVmYXVsdCBpcyBcXFwiYWx3YXlzXFxcIi4nKVxuXHRcdH0sXG5cdFx0cGFuZWw6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydzaGFyZWQnLCAnZGVkaWNhdGVkJywgJ25ldyddLFxuXHRcdFx0ZGVmYXVsdDogJ3NoYXJlZCcsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLnByZXNlbnRhdGlvbi5pbnN0YW5jZScsICdDb250cm9scyBpZiB0aGUgcGFuZWwgaXMgc2hhcmVkIGJldHdlZW4gdGFza3MsIGRlZGljYXRlZCB0byB0aGlzIHRhc2sgb3IgYSBuZXcgb25lIGlzIGNyZWF0ZWQgb24gZXZlcnkgcnVuLicpXG5cdFx0fSxcblx0XHRzaG93UmV1c2VNZXNzYWdlOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5wcmVzZW50YXRpb24uc2hvd1JldXNlTWVzc2FnZScsICdDb250cm9scyB3aGV0aGVyIHRvIHNob3cgdGhlIGBUZXJtaW5hbCB3aWxsIGJlIHJldXNlZCBieSB0YXNrcywgcHJlc3MgYW55IGtleSB0byBjbG9zZSBpdGAgbWVzc2FnZS4nKVxuXHRcdH0sXG5cdFx0Y2xlYXI6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5wcmVzZW50YXRpb24uY2xlYXInLCAnQ29udHJvbHMgd2hldGhlciB0aGUgdGVybWluYWwgaXMgY2xlYXJlZCBiZWZvcmUgZXhlY3V0aW5nIHRoZSB0YXNrLicpXG5cdFx0fSxcblx0XHRncm91cDoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLnByZXNlbnRhdGlvbi5ncm91cCcsICdDb250cm9scyB3aGV0aGVyIHRoZSB0YXNrIGlzIGV4ZWN1dGVkIGluIGEgc3BlY2lmaWMgdGVybWluYWwgZ3JvdXAgdXNpbmcgc3BsaXQgcGFuZXMuJylcblx0XHR9LFxuXHRcdGNsb3NlOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLnByZXNlbnRhdGlvbi5jbG9zZScsICdDb250cm9scyB3aGV0aGVyIHRoZSB0ZXJtaW5hbCB0aGUgdGFzayBydW5zIGluIGlzIGNsb3NlZCB3aGVuIHRoZSB0YXNrIGV4aXRzLicpXG5cdFx0fVxuXHR9XG59O1xuXG5jb25zdCB0ZXJtaW5hbDogSUpTT05TY2hlbWEgPSBPYmplY3RzLmRlZXBDbG9uZShwcmVzZW50YXRpb24pO1xudGVybWluYWwuZGVwcmVjYXRpb25NZXNzYWdlID0gbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLnRlcm1pbmFsJywgJ1RoZSB0ZXJtaW5hbCBwcm9wZXJ0eSBpcyBkZXByZWNhdGVkLiBVc2UgcHJlc2VudGF0aW9uIGluc3RlYWQnKTtcblxuY29uc3QgZ3JvdXBTdHJpbmdzOiBJSlNPTlNjaGVtYSA9IHtcblx0dHlwZTogJ3N0cmluZycsXG5cdGVudW06IFtcblx0XHQnYnVpbGQnLFxuXHRcdCd0ZXN0Jyxcblx0XHQnbm9uZSdcblx0XSxcblx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5ncm91cC5idWlsZCcsICdNYXJrcyB0aGUgdGFzayBhcyBhIGJ1aWxkIHRhc2sgYWNjZXNzaWJsZSB0aHJvdWdoIHRoZSBcXCdSdW4gQnVpbGQgVGFza1xcJyBjb21tYW5kLicpLFxuXHRcdG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5ncm91cC50ZXN0JywgJ01hcmtzIHRoZSB0YXNrIGFzIGEgdGVzdCB0YXNrIGFjY2Vzc2libGUgdGhyb3VnaCB0aGUgXFwnUnVuIFRlc3QgVGFza1xcJyBjb21tYW5kLicpLFxuXHRcdG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5ncm91cC5ub25lJywgJ0Fzc2lnbnMgdGhlIHRhc2sgdG8gbm8gZ3JvdXAnKVxuXHRdLFxuXHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLmdyb3VwLmtpbmQnLCAnVGhlIHRhc2tcXCdzIGV4ZWN1dGlvbiBncm91cC4nKVxufTtcblxuY29uc3QgZ3JvdXA6IElKU09OU2NoZW1hID0ge1xuXHRvbmVPZjogW1xuXHRcdGdyb3VwU3RyaW5ncyxcblx0XHR7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0a2luZDogZ3JvdXBTdHJpbmdzLFxuXHRcdFx0XHRpc0RlZmF1bHQ6IHtcblx0XHRcdFx0XHR0eXBlOiBbJ2Jvb2xlYW4nLCAnc3RyaW5nJ10sXG5cdFx0XHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5ncm91cC5pc0RlZmF1bHQnLCAnRGVmaW5lcyBpZiB0aGlzIHRhc2sgaXMgdGhlIGRlZmF1bHQgdGFzayBpbiB0aGUgZ3JvdXAsIG9yIGEgZ2xvYiB0byBtYXRjaCB0aGUgZmlsZSB3aGljaCBzaG91bGQgdHJpZ2dlciB0aGlzIHRhc2suJylcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sXG5cdF0sXG5cdGRlZmF1bHRTbmlwcGV0czogW1xuXHRcdHtcblx0XHRcdGJvZHk6IHsga2luZDogJ2J1aWxkJywgaXNEZWZhdWx0OiB0cnVlIH0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLmdyb3VwLmRlZmF1bHRCdWlsZCcsICdNYXJrcyB0aGUgdGFzayBhcyB0aGUgZGVmYXVsdCBidWlsZCB0YXNrLicpXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRib2R5OiB7IGtpbmQ6ICd0ZXN0JywgaXNEZWZhdWx0OiB0cnVlIH0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLmdyb3VwLmRlZmF1bHRUZXN0JywgJ01hcmtzIHRoZSB0YXNrIGFzIHRoZSBkZWZhdWx0IHRlc3QgdGFzay4nKVxuXHRcdH1cblx0XSxcblx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5ncm91cCcsICdEZWZpbmVzIHRvIHdoaWNoIGV4ZWN1dGlvbiBncm91cCB0aGlzIHRhc2sgYmVsb25ncyB0by4gSXQgc3VwcG9ydHMgXCJidWlsZFwiIHRvIGFkZCBpdCB0byB0aGUgYnVpbGQgZ3JvdXAgYW5kIFwidGVzdFwiIHRvIGFkZCBpdCB0byB0aGUgdGVzdCBncm91cC4nKVxufTtcblxuY29uc3QgdGFza1R5cGU6IElKU09OU2NoZW1hID0ge1xuXHR0eXBlOiAnc3RyaW5nJyxcblx0ZW51bTogWydzaGVsbCddLFxuXHRkZWZhdWx0OiAncHJvY2VzcycsXG5cdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MudHlwZScsICdEZWZpbmVzIHdoZXRoZXIgdGhlIHRhc2sgaXMgcnVuIGFzIGEgcHJvY2VzcyBvciBhcyBhIGNvbW1hbmQgaW5zaWRlIGEgc2hlbGwuJylcbn07XG5cbmNvbnN0IGNvbW1hbmQ6IElKU09OU2NoZW1hID0ge1xuXHRvbmVPZjogW1xuXHRcdHtcblx0XHRcdG9uZU9mOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuY29tbWFuZEFycmF5JywgJ1RoZSBzaGVsbCBjb21tYW5kIHRvIGJlIGV4ZWN1dGVkLiBBcnJheSBpdGVtcyB3aWxsIGJlIGpvaW5lZCB1c2luZyBhIHNwYWNlIGNoYXJhY3RlcicpXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9LFxuXHRcdHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0cmVxdWlyZWQ6IFsndmFsdWUnLCAncXVvdGluZyddLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHR2YWx1ZToge1xuXHRcdFx0XHRcdG9uZU9mOiBbXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuY29tbWFuZEFycmF5JywgJ1RoZSBzaGVsbCBjb21tYW5kIHRvIGJlIGV4ZWN1dGVkLiBBcnJheSBpdGVtcyB3aWxsIGJlIGpvaW5lZCB1c2luZyBhIHNwYWNlIGNoYXJhY3RlcicpXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLmNvbW1hbmQucXVvdGVkU3RyaW5nLnZhbHVlJywgJ1RoZSBhY3R1YWwgY29tbWFuZCB2YWx1ZScpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHF1b3Rpbmc6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRlbnVtOiBbJ2VzY2FwZScsICdzdHJvbmcnLCAnd2VhayddLFxuXHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5xdW90aW5nLmVzY2FwZScsICdFc2NhcGVzIGNoYXJhY3RlcnMgdXNpbmcgdGhlIHNoZWxsXFwncyBlc2NhcGUgY2hhcmFjdGVyIChlLmcuIGAgdW5kZXIgUG93ZXJTaGVsbCBhbmQgXFxcXCB1bmRlciBiYXNoKS4nKSxcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5xdW90aW5nLnN0cm9uZycsICdRdW90ZXMgdGhlIGFyZ3VtZW50IHVzaW5nIHRoZSBzaGVsbFxcJ3Mgc3Ryb25nIHF1b3RlIGNoYXJhY3RlciAoZS5nLiBcXCcgdW5kZXIgUG93ZXJTaGVsbCBhbmQgYmFzaCkuJyksXG5cdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MucXVvdGluZy53ZWFrJywgJ1F1b3RlcyB0aGUgYXJndW1lbnQgdXNpbmcgdGhlIHNoZWxsXFwncyB3ZWFrIHF1b3RlIGNoYXJhY3RlciAoZS5nLiBcIiB1bmRlciBQb3dlclNoZWxsIGFuZCBiYXNoKS4nKSxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdGRlZmF1bHQ6ICdzdHJvbmcnLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuY29tbWFuZC5xdW90ZXNTdHJpbmcucXVvdGUnLCAnSG93IHRoZSBjb21tYW5kIHZhbHVlIHNob3VsZCBiZSBxdW90ZWQuJylcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0fVxuXHRdLFxuXHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLmNvbW1hbmQnLCAnVGhlIGNvbW1hbmQgdG8gYmUgZXhlY3V0ZWQuIENhbiBiZSBhbiBleHRlcm5hbCBwcm9ncmFtIG9yIGEgc2hlbGwgY29tbWFuZC4nKVxufTtcblxuY29uc3QgYXJnczogSUpTT05TY2hlbWEgPSB7XG5cdHR5cGU6ICdhcnJheScsXG5cdGl0ZW1zOiB7XG5cdFx0b25lT2Y6IFtcblx0XHRcdHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0cmVxdWlyZWQ6IFsndmFsdWUnLCAncXVvdGluZyddLFxuXHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0dmFsdWU6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS5hcmdzLnF1b3RlZFN0cmluZy52YWx1ZScsICdUaGUgYWN0dWFsIGFyZ3VtZW50IHZhbHVlJylcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHF1b3Rpbmc6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZW51bTogWydlc2NhcGUnLCAnc3Ryb25nJywgJ3dlYWsnXSxcblx0XHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLnF1b3RpbmcuZXNjYXBlJywgJ0VzY2FwZXMgY2hhcmFjdGVycyB1c2luZyB0aGUgc2hlbGxcXCdzIGVzY2FwZSBjaGFyYWN0ZXIgKGUuZy4gYCB1bmRlciBQb3dlclNoZWxsIGFuZCBcXFxcIHVuZGVyIGJhc2gpLicpLFxuXHRcdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MucXVvdGluZy5zdHJvbmcnLCAnUXVvdGVzIHRoZSBhcmd1bWVudCB1c2luZyB0aGUgc2hlbGxcXCdzIHN0cm9uZyBxdW90ZSBjaGFyYWN0ZXIgKGUuZy4gXFwnIHVuZGVyIFBvd2VyU2hlbGwgYW5kIGJhc2gpLicpLFxuXHRcdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MucXVvdGluZy53ZWFrJywgJ1F1b3RlcyB0aGUgYXJndW1lbnQgdXNpbmcgdGhlIHNoZWxsXFwncyB3ZWFrIHF1b3RlIGNoYXJhY3RlciAoZS5nLiBcIiB1bmRlciBQb3dlclNoZWxsIGFuZCBiYXNoKS4nKSxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRkZWZhdWx0OiAnc3Ryb25nJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuYXJncy5xdW90ZXNTdHJpbmcucXVvdGUnLCAnSG93IHRoZSBhcmd1bWVudCB2YWx1ZSBzaG91bGQgYmUgcXVvdGVkLicpXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdH1cblx0XHRdXG5cdH0sXG5cdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MuYXJncycsICdBcmd1bWVudHMgcGFzc2VkIHRvIHRoZSBjb21tYW5kIHdoZW4gdGhpcyB0YXNrIGlzIGludm9rZWQuJylcbn07XG5cbmNvbnN0IGxhYmVsOiBJSlNPTlNjaGVtYSA9IHtcblx0dHlwZTogJ3N0cmluZycsXG5cdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MubGFiZWwnLCBcIlRoZSB0YXNrJ3MgdXNlciBpbnRlcmZhY2UgbGFiZWxcIilcbn07XG5cbmNvbnN0IHZlcnNpb246IElKU09OU2NoZW1hID0ge1xuXHR0eXBlOiAnc3RyaW5nJyxcblx0ZW51bTogWycyLjAuMCddLFxuXHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnZlcnNpb24nLCAnVGhlIGNvbmZpZ1xcJ3MgdmVyc2lvbiBudW1iZXIuJylcbn07XG5cbmNvbnN0IGlkZW50aWZpZXI6IElKU09OU2NoZW1hID0ge1xuXHR0eXBlOiAnc3RyaW5nJyxcblx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5pZGVudGlmaWVyJywgJ0EgdXNlciBkZWZpbmVkIGlkZW50aWZpZXIgdG8gcmVmZXJlbmNlIHRoZSB0YXNrIGluIGxhdW5jaC5qc29uIG9yIGEgZGVwZW5kc09uIGNsYXVzZS4nKSxcblx0ZGVwcmVjYXRpb25NZXNzYWdlOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MuaWRlbnRpZmllci5kZXByZWNhdGVkJywgJ1VzZXIgZGVmaW5lZCBpZGVudGlmaWVycyBhcmUgZGVwcmVjYXRlZC4gRm9yIGN1c3RvbSB0YXNrIHVzZSB0aGUgbmFtZSBhcyBhIHJlZmVyZW5jZSBhbmQgZm9yIHRhc2tzIHByb3ZpZGVkIGJ5IGV4dGVuc2lvbnMgdXNlIHRoZWlyIGRlZmluZWQgdGFzayBpZGVudGlmaWVyLicpXG59O1xuXG5jb25zdCBydW5PcHRpb25zOiBJSlNPTlNjaGVtYSA9IHtcblx0dHlwZTogJ29iamVjdCcsXG5cdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcblx0cHJvcGVydGllczoge1xuXHRcdHJlZXZhbHVhdGVPblJlcnVuOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLnJlZXZhbHVhdGVPblJlcnVuJywgJ1doZXRoZXIgdG8gcmVldmFsdWF0ZSB0YXNrIHZhcmlhYmxlcyBvbiByZXJ1bi4nKSxcblx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHR9LFxuXHRcdHJ1bk9uOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnZGVmYXVsdCcsICdmb2xkZXJPcGVuJ10sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLnJ1bk9uJywgJ0NvbmZpZ3VyZXMgd2hlbiB0aGUgdGFzayBzaG91bGQgYmUgcnVuLiBJZiBzZXQgdG8gZm9sZGVyT3BlbiwgdGhlbiB0aGUgdGFzayB3aWxsIGJlIHJ1biBhdXRvbWF0aWNhbGx5IHdoZW4gdGhlIGZvbGRlciBpcyBvcGVuZWQuJyksXG5cdFx0XHRkZWZhdWx0OiAnZGVmYXVsdCdcblx0XHR9LFxuXHRcdGluc3RhbmNlTGltaXQ6IHtcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5pbnN0YW5jZUxpbWl0JywgJ1RoZSBudW1iZXIgb2YgaW5zdGFuY2VzIG9mIHRoZSB0YXNrIHRoYXQgYXJlIGFsbG93ZWQgdG8gcnVuIHNpbXVsdGFuZW91c2x5LicpLFxuXHRcdFx0ZGVmYXVsdDogMVxuXHRcdH0sXG5cdH0sXG5cdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MucnVuT3B0aW9ucycsICdUaGUgdGFza1xcJ3MgcnVuIHJlbGF0ZWQgb3B0aW9ucycpXG59O1xuXG5jb25zdCBjb21tb25TY2hlbWFEZWZpbml0aW9ucyA9IGNvbW1vblNjaGVtYS5kZWZpbml0aW9ucyE7XG5jb25zdCBvcHRpb25zOiBJSlNPTlNjaGVtYSA9IE9iamVjdHMuZGVlcENsb25lKGNvbW1vblNjaGVtYURlZmluaXRpb25zLm9wdGlvbnMpO1xuY29uc3Qgb3B0aW9uc1Byb3BlcnRpZXMgPSBvcHRpb25zLnByb3BlcnRpZXMhO1xub3B0aW9uc1Byb3BlcnRpZXMuc2hlbGwgPSBPYmplY3RzLmRlZXBDbG9uZShjb21tb25TY2hlbWFEZWZpbml0aW9ucy5zaGVsbENvbmZpZ3VyYXRpb24pO1xuXG5jb25zdCB0YXNrQ29uZmlndXJhdGlvbjogSUpTT05TY2hlbWEgPSB7XG5cdHR5cGU6ICdvYmplY3QnLFxuXHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdHByb3BlcnRpZXM6IHtcblx0XHRsYWJlbDoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLnRhc2tMYWJlbCcsIFwiVGhlIHRhc2sncyBsYWJlbFwiKVxuXHRcdH0sXG5cdFx0dGFza05hbWU6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy50YXNrTmFtZScsICdUaGUgdGFza1xcJ3MgbmFtZScpLFxuXHRcdFx0ZGVwcmVjYXRpb25NZXNzYWdlOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MudGFza05hbWUuZGVwcmVjYXRlZCcsICdUaGUgdGFza1xcJ3MgbmFtZSBwcm9wZXJ0eSBpcyBkZXByZWNhdGVkLiBVc2UgdGhlIGxhYmVsIHByb3BlcnR5IGluc3RlYWQuJylcblx0XHR9LFxuXHRcdGlkZW50aWZpZXI6IE9iamVjdHMuZGVlcENsb25lKGlkZW50aWZpZXIpLFxuXHRcdGdyb3VwOiBPYmplY3RzLmRlZXBDbG9uZShncm91cCksXG5cdFx0aXNCYWNrZ3JvdW5kOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLmJhY2tncm91bmQnLCAnV2hldGhlciB0aGUgZXhlY3V0ZWQgdGFzayBpcyBrZXB0IGFsaXZlIGFuZCBpcyBydW5uaW5nIGluIHRoZSBiYWNrZ3JvdW5kLicpLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdH0sXG5cdFx0cHJvbXB0T25DbG9zZToge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5wcm9tcHRPbkNsb3NlJywgJ1doZXRoZXIgdGhlIHVzZXIgaXMgcHJvbXB0ZWQgd2hlbiBWUyBDb2RlIGNsb3NlcyB3aXRoIGEgcnVubmluZyB0YXNrLicpLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHR9LFxuXHRcdHByZXNlbnRhdGlvbjogT2JqZWN0cy5kZWVwQ2xvbmUocHJlc2VudGF0aW9uKSxcblx0XHRpY29uOiBPYmplY3RzLmRlZXBDbG9uZShpY29uKSxcblx0XHRoaWRlOiBPYmplY3RzLmRlZXBDbG9uZShoaWRlKSxcblx0XHRvcHRpb25zOiBvcHRpb25zLFxuXHRcdHByb2JsZW1NYXRjaGVyOiB7XG5cdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9wcm9ibGVtTWF0Y2hlclR5cGUnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5tYXRjaGVycycsICdUaGUgcHJvYmxlbSBtYXRjaGVyKHMpIHRvIHVzZS4gQ2FuIGVpdGhlciBiZSBhIHN0cmluZyBvciBhIHByb2JsZW0gbWF0Y2hlciBkZWZpbml0aW9uIG9yIGFuIGFycmF5IG9mIHN0cmluZ3MgYW5kIHByb2JsZW0gbWF0Y2hlcnMuJylcblx0XHR9LFxuXHRcdHJ1bk9wdGlvbnM6IE9iamVjdHMuZGVlcENsb25lKHJ1bk9wdGlvbnMpLFxuXHRcdGRlcGVuZHNPbjogT2JqZWN0cy5kZWVwQ2xvbmUoZGVwZW5kc09uKSxcblx0XHRkZXBlbmRzT3JkZXI6IE9iamVjdHMuZGVlcENsb25lKGRlcGVuZHNPcmRlciksXG5cdFx0ZGV0YWlsOiBPYmplY3RzLmRlZXBDbG9uZShkZXRhaWwpLFxuXHR9XG59O1xuXG5jb25zdCB0YXNrRGVmaW5pdGlvbnM6IElKU09OU2NoZW1hW10gPSBbXTtcblRhc2tEZWZpbml0aW9uUmVnaXN0cnkub25SZWFkeSgpLnRoZW4oKCkgPT4ge1xuXHR1cGRhdGVUYXNrRGVmaW5pdGlvbnMoKTtcbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlVGFza0RlZmluaXRpb25zKCkge1xuXHRmb3IgKGNvbnN0IHRhc2tUeXBlIG9mIFRhc2tEZWZpbml0aW9uUmVnaXN0cnkuYWxsKCkpIHtcblx0XHQvLyBDaGVjayB0aGF0IHdlIGhhdmVuJ3QgYWxyZWFkeSBhZGRlZCB0aGlzIHRhc2sgdHlwZVxuXHRcdGlmICh0YXNrRGVmaW5pdGlvbnMuZmluZChzY2hlbWEgPT4ge1xuXHRcdFx0cmV0dXJuIHNjaGVtYS5wcm9wZXJ0aWVzPy50eXBlPy5lbnVtPy5maW5kID8gc2NoZW1hLnByb3BlcnRpZXM/LnR5cGUuZW51bS5maW5kKGVsZW1lbnQgPT4gZWxlbWVudCA9PT0gdGFza1R5cGUudGFza1R5cGUpIDogdW5kZWZpbmVkO1xuXHRcdH0pKSB7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cblx0XHRjb25zdCBzY2hlbWE6IElKU09OU2NoZW1hID0gT2JqZWN0cy5kZWVwQ2xvbmUodGFza0NvbmZpZ3VyYXRpb24pO1xuXHRcdGNvbnN0IHNjaGVtYVByb3BlcnRpZXMgPSBzY2hlbWEucHJvcGVydGllcyE7XG5cdFx0Ly8gU2luY2Ugd2UgZG8gdGhpcyBhZnRlciB0aGUgc2NoZW1hIGlzIGFzc2lnbmVkIHdlIG5lZWQgdG8gcGF0Y2ggdGhlIHJlZnMuXG5cdFx0c2NoZW1hUHJvcGVydGllcy50eXBlID0ge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLmN1c3RvbWl6YXRpb25zLmN1c3RvbWl6ZXMudHlwZScsICdUaGUgdGFzayB0eXBlIHRvIGN1c3RvbWl6ZScpLFxuXHRcdFx0ZW51bTogW3Rhc2tUeXBlLnRhc2tUeXBlXVxuXHRcdH07XG5cdFx0aWYgKHRhc2tUeXBlLnJlcXVpcmVkKSB7XG5cdFx0XHRzY2hlbWEucmVxdWlyZWQgPSB0YXNrVHlwZS5yZXF1aXJlZC5zbGljZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzY2hlbWEucmVxdWlyZWQgPSBbXTtcblx0XHR9XG5cdFx0Ly8gQ3VzdG9taXplZCB0YXNrcyByZXF1aXJlIHRoYXQgdGhlIHRhc2sgdHlwZSBiZSBzZXQuXG5cdFx0c2NoZW1hLnJlcXVpcmVkLnB1c2goJ3R5cGUnKTtcblx0XHRpZiAodGFza1R5cGUucHJvcGVydGllcykge1xuXHRcdFx0Zm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXModGFza1R5cGUucHJvcGVydGllcykpIHtcblx0XHRcdFx0Y29uc3QgcHJvcGVydHkgPSB0YXNrVHlwZS5wcm9wZXJ0aWVzW2tleV07XG5cdFx0XHRcdHNjaGVtYVByb3BlcnRpZXNba2V5XSA9IE9iamVjdHMuZGVlcENsb25lKHByb3BlcnR5KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Zml4UmVmZXJlbmNlcyhzY2hlbWEpO1xuXHRcdHRhc2tEZWZpbml0aW9ucy5wdXNoKHNjaGVtYSk7XG5cdH1cbn1cblxuY29uc3QgY3VzdG9taXplID0gT2JqZWN0cy5kZWVwQ2xvbmUodGFza0NvbmZpZ3VyYXRpb24pO1xuY3VzdG9taXplLnByb3BlcnRpZXMhLmN1c3RvbWl6ZSA9IHtcblx0dHlwZTogJ3N0cmluZycsXG5cdGRlcHJlY2F0aW9uTWVzc2FnZTogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLmN1c3RvbWl6ZS5kZXByZWNhdGVkJywgJ1RoZSBjdXN0b21pemUgcHJvcGVydHkgaXMgZGVwcmVjYXRlZC4gU2VlIHRoZSAxLjE0IHJlbGVhc2Ugbm90ZXMgb24gaG93IHRvIG1pZ3JhdGUgdG8gdGhlIG5ldyB0YXNrIGN1c3RvbWl6YXRpb24gYXBwcm9hY2gnKVxufTtcbmlmICghY3VzdG9taXplLnJlcXVpcmVkKSB7XG5cdGN1c3RvbWl6ZS5yZXF1aXJlZCA9IFtdO1xufVxuY3VzdG9taXplLnJlcXVpcmVkLnB1c2goJ2N1c3RvbWl6ZScpO1xudGFza0RlZmluaXRpb25zLnB1c2goY3VzdG9taXplKTtcblxuY29uc3QgZGVmaW5pdGlvbnMgPSBPYmplY3RzLmRlZXBDbG9uZShjb21tb25TY2hlbWFEZWZpbml0aW9ucyk7XG5jb25zdCB0YXNrRGVzY3JpcHRpb246IElKU09OU2NoZW1hID0gZGVmaW5pdGlvbnMudGFza0Rlc2NyaXB0aW9uO1xudGFza0Rlc2NyaXB0aW9uLnJlcXVpcmVkID0gWydsYWJlbCddO1xuY29uc3QgdGFza0Rlc2NyaXB0aW9uUHJvcGVydGllcyA9IHRhc2tEZXNjcmlwdGlvbi5wcm9wZXJ0aWVzITtcbnRhc2tEZXNjcmlwdGlvblByb3BlcnRpZXMubGFiZWwgPSBPYmplY3RzLmRlZXBDbG9uZShsYWJlbCk7XG50YXNrRGVzY3JpcHRpb25Qcm9wZXJ0aWVzLmNvbW1hbmQgPSBPYmplY3RzLmRlZXBDbG9uZShjb21tYW5kKTtcbnRhc2tEZXNjcmlwdGlvblByb3BlcnRpZXMuYXJncyA9IE9iamVjdHMuZGVlcENsb25lKGFyZ3MpO1xudGFza0Rlc2NyaXB0aW9uUHJvcGVydGllcy5pc1NoZWxsQ29tbWFuZCA9IE9iamVjdHMuZGVlcENsb25lKHNoZWxsQ29tbWFuZCk7XG50YXNrRGVzY3JpcHRpb25Qcm9wZXJ0aWVzLmRlcGVuZHNPbiA9IGRlcGVuZHNPbjtcbnRhc2tEZXNjcmlwdGlvblByb3BlcnRpZXMuaGlkZSA9IE9iamVjdHMuZGVlcENsb25lKGhpZGUpO1xudGFza0Rlc2NyaXB0aW9uUHJvcGVydGllcy5kZXBlbmRzT3JkZXIgPSBkZXBlbmRzT3JkZXI7XG50YXNrRGVzY3JpcHRpb25Qcm9wZXJ0aWVzLmlkZW50aWZpZXIgPSBPYmplY3RzLmRlZXBDbG9uZShpZGVudGlmaWVyKTtcbnRhc2tEZXNjcmlwdGlvblByb3BlcnRpZXMudHlwZSA9IE9iamVjdHMuZGVlcENsb25lKHRhc2tUeXBlKTtcbnRhc2tEZXNjcmlwdGlvblByb3BlcnRpZXMucHJlc2VudGF0aW9uID0gT2JqZWN0cy5kZWVwQ2xvbmUocHJlc2VudGF0aW9uKTtcbnRhc2tEZXNjcmlwdGlvblByb3BlcnRpZXMudGVybWluYWwgPSB0ZXJtaW5hbDtcbnRhc2tEZXNjcmlwdGlvblByb3BlcnRpZXMuaWNvbiA9IE9iamVjdHMuZGVlcENsb25lKGljb24pO1xudGFza0Rlc2NyaXB0aW9uUHJvcGVydGllcy5ncm91cCA9IE9iamVjdHMuZGVlcENsb25lKGdyb3VwKTtcbnRhc2tEZXNjcmlwdGlvblByb3BlcnRpZXMucnVuT3B0aW9ucyA9IE9iamVjdHMuZGVlcENsb25lKHJ1bk9wdGlvbnMpO1xudGFza0Rlc2NyaXB0aW9uUHJvcGVydGllcy5kZXRhaWwgPSBkZXRhaWw7XG50YXNrRGVzY3JpcHRpb25Qcm9wZXJ0aWVzLnRhc2tOYW1lLmRlcHJlY2F0aW9uTWVzc2FnZSA9IG5scy5sb2NhbGl6ZShcblx0J0pzb25TY2hlbWEudGFza3MudGFza05hbWUuZGVwcmVjYXRlZCcsXG5cdCdUaGUgdGFza1xcJ3MgbmFtZSBwcm9wZXJ0eSBpcyBkZXByZWNhdGVkLiBVc2UgdGhlIGxhYmVsIHByb3BlcnR5IGluc3RlYWQuJ1xuKTtcbi8vIENsb25lIHRoZSB0YXNrRGVzY3JpcHRpb24gZm9yIHByb2Nlc3MgdGFzayBiZWZvcmUgc2V0dGluZyBhIGRlZmF1bHQgdG8gcHJldmVudCB0d28gZGVmYXVsdHMgIzExNTI4MVxuY29uc3QgcHJvY2Vzc1Rhc2sgPSBPYmplY3RzLmRlZXBDbG9uZSh0YXNrRGVzY3JpcHRpb24pO1xudGFza0Rlc2NyaXB0aW9uLmRlZmF1bHQgPSB7XG5cdGxhYmVsOiAnTXkgVGFzaycsXG5cdHR5cGU6ICdzaGVsbCcsXG5cdGNvbW1hbmQ6ICdlY2hvIEhlbGxvJyxcblx0cHJvYmxlbU1hdGNoZXI6IFtdXG59O1xuZGVmaW5pdGlvbnMuc2hvd091dHB1dFR5cGUuZGVwcmVjYXRpb25NZXNzYWdlID0gbmxzLmxvY2FsaXplKFxuXHQnSnNvblNjaGVtYS50YXNrcy5zaG93T3V0cHV0LmRlcHJlY2F0ZWQnLFxuXHQnVGhlIHByb3BlcnR5IHNob3dPdXRwdXQgaXMgZGVwcmVjYXRlZC4gVXNlIHRoZSByZXZlYWwgcHJvcGVydHkgaW5zaWRlIHRoZSBwcmVzZW50YXRpb24gcHJvcGVydHkgaW5zdGVhZC4gU2VlIGFsc28gdGhlIDEuMTQgcmVsZWFzZSBub3Rlcy4nXG4pO1xudGFza0Rlc2NyaXB0aW9uUHJvcGVydGllcy5lY2hvQ29tbWFuZC5kZXByZWNhdGlvbk1lc3NhZ2UgPSBubHMubG9jYWxpemUoXG5cdCdKc29uU2NoZW1hLnRhc2tzLmVjaG9Db21tYW5kLmRlcHJlY2F0ZWQnLFxuXHQnVGhlIHByb3BlcnR5IGVjaG9Db21tYW5kIGlzIGRlcHJlY2F0ZWQuIFVzZSB0aGUgZWNobyBwcm9wZXJ0eSBpbnNpZGUgdGhlIHByZXNlbnRhdGlvbiBwcm9wZXJ0eSBpbnN0ZWFkLiBTZWUgYWxzbyB0aGUgMS4xNCByZWxlYXNlIG5vdGVzLidcbik7XG50YXNrRGVzY3JpcHRpb25Qcm9wZXJ0aWVzLnN1cHByZXNzVGFza05hbWUuZGVwcmVjYXRpb25NZXNzYWdlID0gbmxzLmxvY2FsaXplKFxuXHQnSnNvblNjaGVtYS50YXNrcy5zdXBwcmVzc1Rhc2tOYW1lLmRlcHJlY2F0ZWQnLFxuXHQnVGhlIHByb3BlcnR5IHN1cHByZXNzVGFza05hbWUgaXMgZGVwcmVjYXRlZC4gSW5saW5lIHRoZSBjb21tYW5kIHdpdGggaXRzIGFyZ3VtZW50cyBpbnRvIHRoZSB0YXNrIGluc3RlYWQuIFNlZSBhbHNvIHRoZSAxLjE0IHJlbGVhc2Ugbm90ZXMuJ1xuKTtcbnRhc2tEZXNjcmlwdGlvblByb3BlcnRpZXMuaXNCdWlsZENvbW1hbmQuZGVwcmVjYXRpb25NZXNzYWdlID0gbmxzLmxvY2FsaXplKFxuXHQnSnNvblNjaGVtYS50YXNrcy5pc0J1aWxkQ29tbWFuZC5kZXByZWNhdGVkJyxcblx0J1RoZSBwcm9wZXJ0eSBpc0J1aWxkQ29tbWFuZCBpcyBkZXByZWNhdGVkLiBVc2UgdGhlIGdyb3VwIHByb3BlcnR5IGluc3RlYWQuIFNlZSBhbHNvIHRoZSAxLjE0IHJlbGVhc2Ugbm90ZXMuJ1xuKTtcbnRhc2tEZXNjcmlwdGlvblByb3BlcnRpZXMuaXNUZXN0Q29tbWFuZC5kZXByZWNhdGlvbk1lc3NhZ2UgPSBubHMubG9jYWxpemUoXG5cdCdKc29uU2NoZW1hLnRhc2tzLmlzVGVzdENvbW1hbmQuZGVwcmVjYXRlZCcsXG5cdCdUaGUgcHJvcGVydHkgaXNUZXN0Q29tbWFuZCBpcyBkZXByZWNhdGVkLiBVc2UgdGhlIGdyb3VwIHByb3BlcnR5IGluc3RlYWQuIFNlZSBhbHNvIHRoZSAxLjE0IHJlbGVhc2Ugbm90ZXMuJ1xuKTtcblxuLy8gUHJvY2VzcyB0YXNrcyBhcmUgYWxtb3N0IGlkZW50aWNhbCBzY2hlbWEtd2lzZSB0byBzaGVsbCB0YXNrcywgYnV0IHRoZXkgYXJlIHJlcXVpcmVkIHRvIGhhdmUgYSBjb21tYW5kXG5wcm9jZXNzVGFzay5wcm9wZXJ0aWVzIS50eXBlID0ge1xuXHR0eXBlOiAnc3RyaW5nJyxcblx0ZW51bTogWydwcm9jZXNzJ10sXG5cdGRlZmF1bHQ6ICdwcm9jZXNzJyxcblx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy50eXBlJywgJ0RlZmluZXMgd2hldGhlciB0aGUgdGFzayBpcyBydW4gYXMgYSBwcm9jZXNzIG9yIGFzIGEgY29tbWFuZCBpbnNpZGUgYSBzaGVsbC4nKVxufTtcbnByb2Nlc3NUYXNrLnJlcXVpcmVkIS5wdXNoKCdjb21tYW5kJyk7XG5wcm9jZXNzVGFzay5yZXF1aXJlZCEucHVzaCgndHlwZScpO1xuXG50YXNrRGVmaW5pdGlvbnMucHVzaChwcm9jZXNzVGFzayk7XG5cbnRhc2tEZWZpbml0aW9ucy5wdXNoKHtcblx0JHJlZjogJyMvZGVmaW5pdGlvbnMvdGFza0Rlc2NyaXB0aW9uJ1xufSk7XG5cbmNvbnN0IGRlZmluaXRpb25zVGFza1J1bm5lckNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzID0gZGVmaW5pdGlvbnMudGFza1J1bm5lckNvbmZpZ3VyYXRpb24ucHJvcGVydGllcyE7XG5jb25zdCB0YXNrcyA9IGRlZmluaXRpb25zVGFza1J1bm5lckNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnRhc2tzO1xudGFza3MuaXRlbXMgPSB7XG5cdG9uZU9mOiB0YXNrRGVmaW5pdGlvbnNcbn07XG5cbmRlZmluaXRpb25zVGFza1J1bm5lckNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmlucHV0cyA9IGlucHV0c1NjaGVtYS5kZWZpbml0aW9ucyEuaW5wdXRzO1xuXG5kZWZpbml0aW9ucy5jb21tYW5kQ29uZmlndXJhdGlvbi5wcm9wZXJ0aWVzIS5pc1NoZWxsQ29tbWFuZCA9IE9iamVjdHMuZGVlcENsb25lKHNoZWxsQ29tbWFuZCk7XG5kZWZpbml0aW9ucy5jb21tYW5kQ29uZmlndXJhdGlvbi5wcm9wZXJ0aWVzIS5hcmdzID0gT2JqZWN0cy5kZWVwQ2xvbmUoYXJncyk7XG5kZWZpbml0aW9ucy5vcHRpb25zLnByb3BlcnRpZXMhLnNoZWxsID0ge1xuXHQkcmVmOiAnIy9kZWZpbml0aW9ucy9zaGVsbENvbmZpZ3VyYXRpb24nXG59O1xuXG5kZWZpbml0aW9uc1Rhc2tSdW5uZXJDb25maWd1cmF0aW9uUHJvcGVydGllcy5pc1NoZWxsQ29tbWFuZCA9IE9iamVjdHMuZGVlcENsb25lKHNoZWxsQ29tbWFuZCk7XG5kZWZpbml0aW9uc1Rhc2tSdW5uZXJDb25maWd1cmF0aW9uUHJvcGVydGllcy50eXBlID0gT2JqZWN0cy5kZWVwQ2xvbmUodGFza1R5cGUpO1xuZGVmaW5pdGlvbnNUYXNrUnVubmVyQ29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXAgPSBPYmplY3RzLmRlZXBDbG9uZShncm91cCk7XG5kZWZpbml0aW9uc1Rhc2tSdW5uZXJDb25maWd1cmF0aW9uUHJvcGVydGllcy5wcmVzZW50YXRpb24gPSBPYmplY3RzLmRlZXBDbG9uZShwcmVzZW50YXRpb24pO1xuZGVmaW5pdGlvbnNUYXNrUnVubmVyQ29uZmlndXJhdGlvblByb3BlcnRpZXMuc3VwcHJlc3NUYXNrTmFtZS5kZXByZWNhdGlvbk1lc3NhZ2UgPSBubHMubG9jYWxpemUoXG5cdCdKc29uU2NoZW1hLnRhc2tzLnN1cHByZXNzVGFza05hbWUuZGVwcmVjYXRlZCcsXG5cdCdUaGUgcHJvcGVydHkgc3VwcHJlc3NUYXNrTmFtZSBpcyBkZXByZWNhdGVkLiBJbmxpbmUgdGhlIGNvbW1hbmQgd2l0aCBpdHMgYXJndW1lbnRzIGludG8gdGhlIHRhc2sgaW5zdGVhZC4gU2VlIGFsc28gdGhlIDEuMTQgcmVsZWFzZSBub3Rlcy4nXG4pO1xuZGVmaW5pdGlvbnNUYXNrUnVubmVyQ29uZmlndXJhdGlvblByb3BlcnRpZXMudGFza1NlbGVjdG9yLmRlcHJlY2F0aW9uTWVzc2FnZSA9IG5scy5sb2NhbGl6ZShcblx0J0pzb25TY2hlbWEudGFza3MudGFza1NlbGVjdG9yLmRlcHJlY2F0ZWQnLFxuXHQnVGhlIHByb3BlcnR5IHRhc2tTZWxlY3RvciBpcyBkZXByZWNhdGVkLiBJbmxpbmUgdGhlIGNvbW1hbmQgd2l0aCBpdHMgYXJndW1lbnRzIGludG8gdGhlIHRhc2sgaW5zdGVhZC4gU2VlIGFsc28gdGhlIDEuMTQgcmVsZWFzZSBub3Rlcy4nXG4pO1xuXG5jb25zdCBvc1NwZWNpZmljVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSBPYmplY3RzLmRlZXBDbG9uZShkZWZpbml0aW9ucy50YXNrUnVubmVyQ29uZmlndXJhdGlvbik7XG5kZWxldGUgb3NTcGVjaWZpY1Rhc2tSdW5uZXJDb25maWd1cmF0aW9uLnByb3BlcnRpZXMhLnRhc2tzO1xub3NTcGVjaWZpY1Rhc2tSdW5uZXJDb25maWd1cmF0aW9uLmFkZGl0aW9uYWxQcm9wZXJ0aWVzID0gZmFsc2U7XG5kZWZpbml0aW9ucy5vc1NwZWNpZmljVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSBvc1NwZWNpZmljVGFza1J1bm5lckNvbmZpZ3VyYXRpb247XG5kZWZpbml0aW9uc1Rhc2tSdW5uZXJDb25maWd1cmF0aW9uUHJvcGVydGllcy52ZXJzaW9uID0gT2JqZWN0cy5kZWVwQ2xvbmUodmVyc2lvbik7XG5cbmNvbnN0IHNjaGVtYTogSUpTT05TY2hlbWEgPSB7XG5cdG9uZU9mOiBbXG5cdFx0e1xuXHRcdFx0J2FsbE9mJzogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0cmVxdWlyZWQ6IFsndmVyc2lvbiddLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdHZlcnNpb246IE9iamVjdHMuZGVlcENsb25lKHZlcnNpb24pLFxuXHRcdFx0XHRcdFx0d2luZG93czoge1xuXHRcdFx0XHRcdFx0XHQnJHJlZic6ICcjL2RlZmluaXRpb25zL29zU3BlY2lmaWNUYXNrUnVubmVyQ29uZmlndXJhdGlvbicsXG5cdFx0XHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS53aW5kb3dzJywgJ1dpbmRvd3Mgc3BlY2lmaWMgY29tbWFuZCBjb25maWd1cmF0aW9uJylcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRvc3g6IHtcblx0XHRcdFx0XHRcdFx0JyRyZWYnOiAnIy9kZWZpbml0aW9ucy9vc1NwZWNpZmljVGFza1J1bm5lckNvbmZpZ3VyYXRpb24nLFxuXHRcdFx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEubWFjJywgJ01hYyBzcGVjaWZpYyBjb21tYW5kIGNvbmZpZ3VyYXRpb24nKVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGxpbnV4OiB7XG5cdFx0XHRcdFx0XHRcdCckcmVmJzogJyMvZGVmaW5pdGlvbnMvb3NTcGVjaWZpY1Rhc2tSdW5uZXJDb25maWd1cmF0aW9uJyxcblx0XHRcdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLmxpbnV4JywgJ0xpbnV4IHNwZWNpZmljIGNvbW1hbmQgY29uZmlndXJhdGlvbicpXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvdGFza1J1bm5lckNvbmZpZ3VyYXRpb24nXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9XG5cdF1cbn07XG5cbnNjaGVtYS5kZWZpbml0aW9ucyA9IGRlZmluaXRpb25zO1xuXG5mdW5jdGlvbiBkZXByZWNhdGVkVmFyaWFibGVNZXNzYWdlKHNjaGVtYU1hcDogSUpTT05TY2hlbWFNYXAsIHByb3BlcnR5OiBzdHJpbmcpIHtcblx0Y29uc3QgbWFwQXRQcm9wZXJ0eSA9IHNjaGVtYU1hcFtwcm9wZXJ0eV0ucHJvcGVydGllcyE7XG5cdGlmIChtYXBBdFByb3BlcnR5KSB7XG5cdFx0T2JqZWN0LmtleXMobWFwQXRQcm9wZXJ0eSkuZm9yRWFjaChuYW1lID0+IHtcblx0XHRcdGRlcHJlY2F0ZWRWYXJpYWJsZU1lc3NhZ2UobWFwQXRQcm9wZXJ0eSwgbmFtZSk7XG5cdFx0fSk7XG5cdH0gZWxzZSB7XG5cdFx0Q29uZmlndXJhdGlvblJlc29sdmVyVXRpbHMuYXBwbHlEZXByZWNhdGVkVmFyaWFibGVNZXNzYWdlKHNjaGVtYU1hcFtwcm9wZXJ0eV0pO1xuXHR9XG59XG5cbk9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGRlZmluaXRpb25zKS5mb3JFYWNoKGtleSA9PiB7XG5cdGNvbnN0IG5ld0tleSA9IGtleSArICcyJztcblx0ZGVmaW5pdGlvbnNbbmV3S2V5XSA9IGRlZmluaXRpb25zW2tleV07XG5cdGRlbGV0ZSBkZWZpbml0aW9uc1trZXldO1xuXHRkZXByZWNhdGVkVmFyaWFibGVNZXNzYWdlKGRlZmluaXRpb25zLCBuZXdLZXkpO1xufSk7XG5maXhSZWZlcmVuY2VzKHNjaGVtYSk7XG5cbmV4cG9ydCBmdW5jdGlvbiB1cGRhdGVQcm9ibGVtTWF0Y2hlcnMoKSB7XG5cdHRyeSB7XG5cdFx0Y29uc3QgbWF0Y2hlcklkcyA9IFByb2JsZW1NYXRjaGVyUmVnaXN0cnkua2V5cygpLm1hcChrZXkgPT4gJyQnICsga2V5KTtcblx0XHRkZWZpbml0aW9ucy5wcm9ibGVtTWF0Y2hlclR5cGUyLm9uZU9mIVswXS5lbnVtID0gbWF0Y2hlcklkcztcblx0XHQoZGVmaW5pdGlvbnMucHJvYmxlbU1hdGNoZXJUeXBlMi5vbmVPZiFbMl0uaXRlbXMgYXMgSUpTT05TY2hlbWEpLmFueU9mIVswXS5lbnVtID0gbWF0Y2hlcklkcztcblx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0Y29uc29sZS5sb2coJ0luc3RhbGxpbmcgcHJvYmxlbSBtYXRjaGVyIGlkcyBmYWlsZWQnKTtcblx0fVxufVxuXG5Qcm9ibGVtTWF0Y2hlclJlZ2lzdHJ5Lm9uUmVhZHkoKS50aGVuKCgpID0+IHtcblx0dXBkYXRlUHJvYmxlbU1hdGNoZXJzKCk7XG59KTtcblxuZXhwb3J0IGRlZmF1bHQgc2NoZW1hO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxTQUFTO0FBQ3JCLFlBQVksYUFBYTtBQUd6QixPQUFPLGtCQUFrQjtBQUV6QixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLDhCQUE4QjtBQUN2QyxZQUFZLGdDQUFnQztBQUM1QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHNCQUFzQjtBQUUvQixTQUFTLGNBQWMsU0FBYztBQUNwQyxNQUFJLE1BQU0sUUFBUSxPQUFPLEdBQUc7QUFDM0IsWUFBUSxRQUFRLGFBQWE7QUFBQSxFQUM5QixXQUFXLE9BQU8sWUFBWSxVQUFVO0FBQ3ZDLFFBQUksUUFBUSxNQUFNLEdBQUc7QUFDcEIsY0FBUSxNQUFNLElBQUksUUFBUSxNQUFNLElBQUk7QUFBQSxJQUNyQztBQUNBLFdBQU8sb0JBQW9CLE9BQU8sRUFBRSxRQUFRLGNBQVk7QUFDdkQsWUFBTSxRQUFRLFFBQVEsUUFBUTtBQUM5QixVQUFJLE1BQU0sUUFBUSxLQUFLLEtBQUssT0FBTyxVQUFVLFVBQVU7QUFDdEQsc0JBQWMsS0FBSztBQUFBLE1BQ3BCO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUNEO0FBRUEsTUFBTSxlQUE0QjtBQUFBLEVBQ2pDLE9BQU87QUFBQSxJQUNOO0FBQUEsTUFDQyxNQUFNO0FBQUEsTUFDTixTQUFTO0FBQUEsTUFDVCxhQUFhLElBQUksU0FBUyxvQkFBb0Isd0dBQXdHO0FBQUEsSUFDdko7QUFBQSxJQUNBO0FBQUEsTUFDQyxNQUFNO0FBQUEsSUFDUDtBQUFBLEVBQ0Q7QUFBQSxFQUNBLG9CQUFvQixJQUFJLFNBQVMsOENBQThDLDhKQUE4SjtBQUM5TztBQUdBLE1BQU0sT0FBb0I7QUFBQSxFQUN6QixNQUFNO0FBQUEsRUFDTixhQUFhLElBQUksU0FBUyxtQkFBbUIsNkNBQTZDO0FBQUEsRUFDMUYsU0FBUztBQUNWO0FBRUEsTUFBTSxpQkFBOEI7QUFBQSxFQUNuQyxNQUFNO0FB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QUEsVUFDcEIsWUFBWTtBQUFBLFlBQ1gsU0FBUyxRQUFRLFVBQVUsT0FBTztBQUFBLFlBQ2xDLFNBQVM7QUFBQSxjQUNSLFFBQVE7QUFBQSxjQUNSLGVBQWUsSUFBSSxTQUFTLHNCQUFzQix3Q0FBd0M7QUFBQSxZQUMzRjtBQUFBLFlBQ0EsS0FBSztBQUFBLGNBQ0osUUFBUTtBQUFBLGNBQ1IsZUFBZSxJQUFJLFNBQVMsa0JBQWtCLG9DQUFvQztBQUFBLFlBQ25GO0FBQUEsWUFDQSxPQUFPO0FBQUEsY0FDTixRQUFRO0FBQUEsY0FDUixlQUFlLElBQUksU0FBUyxvQkFBb0Isc0NBQXNDO0FBQUEsWUFDdkY7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxVQUNDLE1BQU07QUFBQSxRQUNQO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxPQUFPLGNBQWM7QUFFckIsU0FBUywwQkFBMEIsV0FBMkIsVUFBa0I7QUFDL0UsUUFBTSxnQkFBZ0IsVUFBVSxRQUFRLEVBQUU7QUFDMUMsTUFBSSxlQUFlO0FBQ2xCLFdBQU8sS0FBSyxhQUFhLEVBQUUsUUFBUSxVQUFRO0FBQzFDLGdDQUEwQixlQUFlLElBQUk7QUFBQSxJQUM5QyxDQUFDO0FBQUEsRUFDRixPQUFPO0FBQ04sK0JBQTJCLCtCQUErQixVQUFVLFFBQVEsQ0FBQztBQUFBLEVBQzlFO0FBQ0Q7QUFFQSxPQUFPLG9CQUFvQixXQUFXLEVBQUUsUUFBUSxTQUFPO0FBQ3RELFFBQU0sU0FBUyxNQUFNO0FBQ3JCLGNBQVksTUFBTSxJQUFJLFlBQVksR0FBRztBQUNyQyxTQUFPLFlBQVksR0FBRztBQUN0Qiw0QkFBMEIsYUFBYSxNQUFNO0FBQzlDLENBQUM7QUFDRCxjQUFjLE1BQU07QUFFYixTQUFTLHdCQUF3QjtBQUN2QyxNQUFJO0FBQ0gsVUFBTSxhQUFhLHVCQUF1QixLQUFLLEVBQUUsSUFBSSxTQUFPLE1BQU0sR0FBRztBQUNyRSxnQkFBWSxvQkFBb0IsTUFBTyxDQUFDLEVBQUUsT0FBTztBQUNqRCxJQUFDLFlBQVksb0JBQW9CLE1BQU8sQ0FBQyxFQUFFLE1BQXNCLE1BQU8sQ0FBQyxFQUFFLE9BQU87QUFBQSxFQUNuRixTQUFTLEtBQUs7QUFDYixZQUFRLElBQUksdUNBQXVDO0FBQUEsRUFDcEQ7QUFDRDtBQUVBLHVCQUF1QixRQUFRLEVBQUUsS0FBSyxNQUFNO0FBQzNDLHdCQUFzQjtBQUN2QixDQUFDO0FBRUQsSUFBTyx3QkFBUTsiLAogICJuYW1lcyI6IFsiaWNvbiIsICJ0YXNrVHlwZSIsICJzY2hlbWEiXQp9Cg==
