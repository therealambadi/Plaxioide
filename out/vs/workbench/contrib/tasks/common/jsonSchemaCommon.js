import * as nls from "../../../../nls.js";
import { Schemas } from "./problemMatcher.js";
const schema = {
  definitions: {
    showOutputType: {
      type: "string",
      enum: ["always", "silent", "never"]
    },
    options: {
      type: "object",
      description: nls.localize("JsonSchema.options", "Additional command options"),
      properties: {
        cwd: {
          type: "string",
          description: nls.localize("JsonSchema.options.cwd", "The current working directory of the executed program or script. If omitted Code's current workspace root is used.")
        },
        env: {
          type: "object",
          additionalProperties: {
            type: "string"
          },
          description: nls.localize("JsonSchema.options.env", "The environment of the executed program or shell. If omitted the parent process' environment is used.")
        }
      },
      additionalProperties: {
        type: ["string", "array", "object"]
      }
    },
    problemMatcherType: {
      oneOf: [
        {
          type: "string",
          errorMessage: nls.localize("JsonSchema.tasks.matcherError", "Unrecognized problem matcher. Is the extension that contributes this problem matcher installed?")
        },
        Schemas.LegacyProblemMatcher,
        {
          type: "array",
          items: {
            anyOf: [
              {
                type: "string",
                errorMessage: nls.localize("JsonSchema.tasks.matcherError", "Unrecognized problem matcher. Is the extension that contributes this problem matcher installed?")
              },
              Schemas.LegacyProblemMatcher
            ]
          }
        }
      ]
    },
    shellConfiguration: {
      type: "object",
      additionalProperties: false,
      description: nls.localize("JsonSchema.shellConfiguration", "Configures the shell to be used."),
      properties: {
        executable: {
          type: "string",
          description: nls.localize("JsonSchema.shell.executable", "The shell to be used.")
        },
        args: {
          type: "array",
          description: nls.localize("JsonSchema.shell.args", "The shell arguments."),
          items: {
            type: "string"
          }
        }
      }
    },
    commandConfiguration: {
      type: "object",
      additionalProperties: false,
      properties: {
        command: {
          type: "string",
          description: nls.localize("JsonSchema.command", "The command to be executed. Can be an external program or a shell command.")
        },
        args: {
          type: "array",
          description: nls.localize("JsonSchema.tasks.args", "Arguments passed to the command when this task is invoked."),
          items: {
            type: "string"
          }
        },
        options: {
          $ref: "#/definitions/options"
        }
      }
    },
    taskDescription: {
      type: "object",
      required: ["taskName"],
      additionalProperties: false,
      properties: {
        taskName: {
          type: "string",
          description: nls.localize("JsonSchema.tasks.taskName", "The task's name")
        },
        command: {
          type: "string",
          description: nls.localize("JsonSchema.command", "The command to be executed. Can be an external program or a shell command.")
        },
        args: {
          type: "array",
          description: nls.localize("JsonSchema.tasks.args", "Arguments passed to the command when this task is invoked."),
          items: {
            type: "string"
          }
        },
        options: {
          $ref: "#/definitions/options"
        },
        windows: {
          anyOf: [
            {
              $ref: "#/definitions/commandConfiguration",
              description: nls.localize("JsonSchema.tasks.windows", "Windows specific command configuration")
            },
            {
              properties: {
                problemMatcher: {
                  $ref: "#/definitions/problemMatcherType",
                  description: nls.localize("JsonSchema.tasks.matchers", "The problem matcher(s) to use. Can either be a string or a problem matcher definition or an array of strings and problem matchers.")
                }
              }
            }
          ]
        },
        osx: {
          anyOf: [
            {
              $ref: "#/definitions/commandConfiguration",
              description: nls.localize("JsonSchema.tasks.mac", "Mac specific command configuration")
            },
            {
              properties: {
                problemMatcher: {
                  $ref: "#/definitions/problemMatcherType",
                  description: nls.localize("JsonSchema.tasks.matchers", "The problem matcher(s) to use. Can either be a string or a problem matcher definition or an array of strings and problem matchers.")
                }
              }
            }
          ]
        },
        linux: {
          anyOf: [
            {
              $ref: "#/definitions/commandConfiguration",
              description: nls.localize("JsonSchema.tasks.linux", "Linux specific command configuration")
            },
            {
              properties: {
                problemMatcher: {
                  $ref: "#/definitions/problemMatcherType",
                  description: nls.localize("JsonSchema.tasks.matchers", "The problem matcher(s) to use. Can either be a string or a problem matcher definition or an array of strings and problem matchers.")
                }
              }
            }
          ]
        },
        suppressTaskName: {
          type: "boolean",
          description: nls.localize("JsonSchema.tasks.suppressTaskName", "Controls whether the task name is added as an argument to the command. If omitted the globally defined value is used."),
          default: true
        },
        showOutput: {
          $ref: "#/definitions/showOutputType",
          description: nls.localize("JsonSchema.tasks.showOutput", "Controls whether the output of the running task is shown or not. If omitted the globally defined value is used.")
        },
        echoCommand: {
          type: "boolean",
          description: nls.localize("JsonSchema.echoCommand", "Controls whether the executed command is echoed to the output. Default is false."),
          default: true
        },
        isWatching: {
          type: "boolean",
          deprecationMessage: nls.localize("JsonSchema.tasks.watching.deprecation", "Deprecated. Use isBackground instead."),
          description: nls.localize("JsonSchema.tasks.watching", "Whether the executed task is kept alive and is watching the file system."),
          default: true
        },
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
        isBuildCommand: {
          type: "boolean",
          description: nls.localize("JsonSchema.tasks.build", "Maps this task to Code's default build command."),
          default: true
        },
        isTestCommand: {
          type: "boolean",
          description: nls.localize("JsonSchema.tasks.test", "Maps this task to Code's default test command."),
          default: true
        },
        problemMatcher: {
          $ref: "#/definitions/problemMatcherType",
          description: nls.localize("JsonSchema.tasks.matchers", "The problem matcher(s) to use. Can either be a string or a problem matcher definition or an array of strings and problem matchers.")
        }
      }
    },
    taskRunnerConfiguration: {
      type: "object",
      required: [],
      properties: {
        command: {
          type: "string",
          description: nls.localize("JsonSchema.command", "The command to be executed. Can be an external program or a shell command.")
        },
        args: {
          type: "array",
          description: nls.localize("JsonSchema.args", "Additional arguments passed to the command."),
          items: {
            type: "string"
          }
        },
        options: {
          $ref: "#/definitions/options"
        },
        showOutput: {
          $ref: "#/definitions/showOutputType",
          description: nls.localize("JsonSchema.showOutput", "Controls whether the output of the running task is shown or not. If omitted 'always' is used.")
        },
        isWatching: {
          type: "boolean",
          deprecationMessage: nls.localize("JsonSchema.watching.deprecation", "Deprecated. Use isBackground instead."),
          description: nls.localize("JsonSchema.watching", "Whether the executed task is kept alive and is watching the file system."),
          default: true
        },
        isBackground: {
          type: "boolean",
          description: nls.localize("JsonSchema.background", "Whether the executed task is kept alive and is running in the background."),
          default: true
        },
        promptOnClose: {
          type: "boolean",
          description: nls.localize("JsonSchema.promptOnClose", "Whether the user is prompted when VS Code closes with a running background task."),
          default: false
        },
        echoCommand: {
          type: "boolean",
          description: nls.localize("JsonSchema.echoCommand", "Controls whether the executed command is echoed to the output. Default is false."),
          default: true
        },
        suppressTaskName: {
          type: "boolean",
          description: nls.localize("JsonSchema.suppressTaskName", "Controls whether the task name is added as an argument to the command. Default is false."),
          default: true
        },
        taskSelector: {
          type: "string",
          description: nls.localize("JsonSchema.taskSelector", "Prefix to indicate that an argument is task.")
        },
        problemMatcher: {
          $ref: "#/definitions/problemMatcherType",
          description: nls.localize("JsonSchema.matchers", "The problem matcher(s) to use. Can either be a string or a problem matcher definition or an array of strings and problem matchers.")
        },
        tasks: {
          type: "array",
          description: nls.localize("JsonSchema.tasks", "The task configurations. Usually these are enrichments of task already defined in the external task runner."),
          items: {
            type: "object",
            $ref: "#/definitions/taskDescription"
          }
        }
      }
    }
  }
};
var jsonSchemaCommon_default = schema;
export {
  jsonSchemaCommon_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9jb21tb24vanNvblNjaGVtYUNvbW1vbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUpTT05TY2hlbWEgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uU2NoZW1hLmpzJztcblxuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4vcHJvYmxlbU1hdGNoZXIuanMnO1xuXG5jb25zdCBzY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHRkZWZpbml0aW9uczoge1xuXHRcdHNob3dPdXRwdXRUeXBlOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnYWx3YXlzJywgJ3NpbGVudCcsICduZXZlciddXG5cdFx0fSxcblx0XHRvcHRpb25zOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEub3B0aW9ucycsICdBZGRpdGlvbmFsIGNvbW1hbmQgb3B0aW9ucycpLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRjd2Q6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLm9wdGlvbnMuY3dkJywgJ1RoZSBjdXJyZW50IHdvcmtpbmcgZGlyZWN0b3J5IG9mIHRoZSBleGVjdXRlZCBwcm9ncmFtIG9yIHNjcmlwdC4gSWYgb21pdHRlZCBDb2RlXFwncyBjdXJyZW50IHdvcmtzcGFjZSByb290IGlzIHVzZWQuJylcblx0XHRcdFx0fSxcblx0XHRcdFx0ZW52OiB7XG5cdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLm9wdGlvbnMuZW52JywgJ1RoZSBlbnZpcm9ubWVudCBvZiB0aGUgZXhlY3V0ZWQgcHJvZ3JhbSBvciBzaGVsbC4gSWYgb21pdHRlZCB0aGUgcGFyZW50IHByb2Nlc3NcXCcgZW52aXJvbm1lbnQgaXMgdXNlZC4nKVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHtcblx0XHRcdFx0dHlwZTogWydzdHJpbmcnLCAnYXJyYXknLCAnb2JqZWN0J11cblx0XHRcdH1cblx0XHR9LFxuXHRcdHByb2JsZW1NYXRjaGVyVHlwZToge1xuXHRcdFx0b25lT2Y6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGVycm9yTWVzc2FnZTogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLm1hdGNoZXJFcnJvcicsICdVbnJlY29nbml6ZWQgcHJvYmxlbSBtYXRjaGVyLiBJcyB0aGUgZXh0ZW5zaW9uIHRoYXQgY29udHJpYnV0ZXMgdGhpcyBwcm9ibGVtIG1hdGNoZXIgaW5zdGFsbGVkPycpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdFNjaGVtYXMuTGVnYWN5UHJvYmxlbU1hdGNoZXIsXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0XHRhbnlPZjogW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0ZXJyb3JNZXNzYWdlOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MubWF0Y2hlckVycm9yJywgJ1VucmVjb2duaXplZCBwcm9ibGVtIG1hdGNoZXIuIElzIHRoZSBleHRlbnNpb24gdGhhdCBjb250cmlidXRlcyB0aGlzIHByb2JsZW0gbWF0Y2hlciBpbnN0YWxsZWQ/Jylcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0U2NoZW1hcy5MZWdhY3lQcm9ibGVtTWF0Y2hlclxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0c2hlbGxDb25maWd1cmF0aW9uOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuc2hlbGxDb25maWd1cmF0aW9uJywgJ0NvbmZpZ3VyZXMgdGhlIHNoZWxsIHRvIGJlIHVzZWQuJyksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGV4ZWN1dGFibGU6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnNoZWxsLmV4ZWN1dGFibGUnLCAnVGhlIHNoZWxsIHRvIGJlIHVzZWQuJylcblx0XHRcdFx0fSxcblx0XHRcdFx0YXJnczoge1xuXHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS5zaGVsbC5hcmdzJywgJ1RoZSBzaGVsbCBhcmd1bWVudHMuJyksXG5cdFx0XHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRjb21tYW5kQ29uZmlndXJhdGlvbjoge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLmNvbW1hbmQnLCAnVGhlIGNvbW1hbmQgdG8gYmUgZXhlY3V0ZWQuIENhbiBiZSBhbiBleHRlcm5hbCBwcm9ncmFtIG9yIGEgc2hlbGwgY29tbWFuZC4nKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRhcmdzOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLmFyZ3MnLCAnQXJndW1lbnRzIHBhc3NlZCB0byB0aGUgY29tbWFuZCB3aGVuIHRoaXMgdGFzayBpcyBpbnZva2VkLicpLFxuXHRcdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL29wdGlvbnMnXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdHRhc2tEZXNjcmlwdGlvbjoge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRyZXF1aXJlZDogWyd0YXNrTmFtZSddLFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHR0YXNrTmFtZToge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MudGFza05hbWUnLCBcIlRoZSB0YXNrJ3MgbmFtZVwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS5jb21tYW5kJywgJ1RoZSBjb21tYW5kIHRvIGJlIGV4ZWN1dGVkLiBDYW4gYmUgYW4gZXh0ZXJuYWwgcHJvZ3JhbSBvciBhIHNoZWxsIGNvbW1hbmQuJylcblx0XHRcdFx0fSxcblx0XHRcdFx0YXJnczoge1xuXHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5hcmdzJywgJ0FyZ3VtZW50cyBwYXNzZWQgdG8gdGhlIGNvbW1hbmQgd2hlbiB0aGlzIHRhc2sgaXMgaW52b2tlZC4nKSxcblx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9vcHRpb25zJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR3aW5kb3dzOiB7XG5cdFx0XHRcdFx0YW55T2Y6IFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvY29tbWFuZENvbmZpZ3VyYXRpb24nLFxuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLndpbmRvd3MnLCAnV2luZG93cyBzcGVjaWZpYyBjb21tYW5kIGNvbmZpZ3VyYXRpb24nKSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdFx0XHRwcm9ibGVtTWF0Y2hlcjoge1xuXHRcdFx0XHRcdFx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvcHJvYmxlbU1hdGNoZXJUeXBlJyxcblx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MubWF0Y2hlcnMnLCAnVGhlIHByb2JsZW0gbWF0Y2hlcihzKSB0byB1c2UuIENhbiBlaXRoZXIgYmUgYSBzdHJpbmcgb3IgYSBwcm9ibGVtIG1hdGNoZXIgZGVmaW5pdGlvbiBvciBhbiBhcnJheSBvZiBzdHJpbmdzIGFuZCBwcm9ibGVtIG1hdGNoZXJzLicpXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRvc3g6IHtcblx0XHRcdFx0XHRhbnlPZjogW1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9jb21tYW5kQ29uZmlndXJhdGlvbicsXG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MubWFjJywgJ01hYyBzcGVjaWZpYyBjb21tYW5kIGNvbmZpZ3VyYXRpb24nKVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRcdHByb2JsZW1NYXRjaGVyOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9wcm9ibGVtTWF0Y2hlclR5cGUnLFxuXHRcdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy5tYXRjaGVycycsICdUaGUgcHJvYmxlbSBtYXRjaGVyKHMpIHRvIHVzZS4gQ2FuIGVpdGhlciBiZSBhIHN0cmluZyBvciBhIHByb2JsZW0gbWF0Y2hlciBkZWZpbml0aW9uIG9yIGFuIGFycmF5IG9mIHN0cmluZ3MgYW5kIHByb2JsZW0gbWF0Y2hlcnMuJylcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGxpbnV4OiB7XG5cdFx0XHRcdFx0YW55T2Y6IFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvY29tbWFuZENvbmZpZ3VyYXRpb24nLFxuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLmxpbnV4JywgJ0xpbnV4IHNwZWNpZmljIGNvbW1hbmQgY29uZmlndXJhdGlvbicpXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0cHJvYmxlbU1hdGNoZXI6IHtcblx0XHRcdFx0XHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL3Byb2JsZW1NYXRjaGVyVHlwZScsXG5cdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLm1hdGNoZXJzJywgJ1RoZSBwcm9ibGVtIG1hdGNoZXIocykgdG8gdXNlLiBDYW4gZWl0aGVyIGJlIGEgc3RyaW5nIG9yIGEgcHJvYmxlbSBtYXRjaGVyIGRlZmluaXRpb24gb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncyBhbmQgcHJvYmxlbSBtYXRjaGVycy4nKVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0c3VwcHJlc3NUYXNrTmFtZToge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLnN1cHByZXNzVGFza05hbWUnLCAnQ29udHJvbHMgd2hldGhlciB0aGUgdGFzayBuYW1lIGlzIGFkZGVkIGFzIGFuIGFyZ3VtZW50IHRvIHRoZSBjb21tYW5kLiBJZiBvbWl0dGVkIHRoZSBnbG9iYWxseSBkZWZpbmVkIHZhbHVlIGlzIHVzZWQuJyksXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRzaG93T3V0cHV0OiB7XG5cdFx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvc2hvd091dHB1dFR5cGUnLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3Muc2hvd091dHB1dCcsICdDb250cm9scyB3aGV0aGVyIHRoZSBvdXRwdXQgb2YgdGhlIHJ1bm5pbmcgdGFzayBpcyBzaG93biBvciBub3QuIElmIG9taXR0ZWQgdGhlIGdsb2JhbGx5IGRlZmluZWQgdmFsdWUgaXMgdXNlZC4nKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRlY2hvQ29tbWFuZDoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLmVjaG9Db21tYW5kJywgJ0NvbnRyb2xzIHdoZXRoZXIgdGhlIGV4ZWN1dGVkIGNvbW1hbmQgaXMgZWNob2VkIHRvIHRoZSBvdXRwdXQuIERlZmF1bHQgaXMgZmFsc2UuJyksXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRpc1dhdGNoaW5nOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlcHJlY2F0aW9uTWVzc2FnZTogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLndhdGNoaW5nLmRlcHJlY2F0aW9uJywgJ0RlcHJlY2F0ZWQuIFVzZSBpc0JhY2tncm91bmQgaW5zdGVhZC4nKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLndhdGNoaW5nJywgJ1doZXRoZXIgdGhlIGV4ZWN1dGVkIHRhc2sgaXMga2VwdCBhbGl2ZSBhbmQgaXMgd2F0Y2hpbmcgdGhlIGZpbGUgc3lzdGVtLicpLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHRcdFx0fSxcblx0XHRcdFx0aXNCYWNrZ3JvdW5kOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MuYmFja2dyb3VuZCcsICdXaGV0aGVyIHRoZSBleGVjdXRlZCB0YXNrIGlzIGtlcHQgYWxpdmUgYW5kIGlzIHJ1bm5pbmcgaW4gdGhlIGJhY2tncm91bmQuJyksXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRwcm9tcHRPbkNsb3NlOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MucHJvbXB0T25DbG9zZScsICdXaGV0aGVyIHRoZSB1c2VyIGlzIHByb21wdGVkIHdoZW4gVlMgQ29kZSBjbG9zZXMgd2l0aCBhIHJ1bm5pbmcgdGFzay4nKSxcblx0XHRcdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRpc0J1aWxkQ29tbWFuZDoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnRhc2tzLmJ1aWxkJywgJ01hcHMgdGhpcyB0YXNrIHRvIENvZGVcXCdzIGRlZmF1bHQgYnVpbGQgY29tbWFuZC4nKSxcblx0XHRcdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGlzVGVzdENvbW1hbmQ6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrcy50ZXN0JywgJ01hcHMgdGhpcyB0YXNrIHRvIENvZGVcXCdzIGRlZmF1bHQgdGVzdCBjb21tYW5kLicpLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHRcdFx0fSxcblx0XHRcdFx0cHJvYmxlbU1hdGNoZXI6IHtcblx0XHRcdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9wcm9ibGVtTWF0Y2hlclR5cGUnLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MubWF0Y2hlcnMnLCAnVGhlIHByb2JsZW0gbWF0Y2hlcihzKSB0byB1c2UuIENhbiBlaXRoZXIgYmUgYSBzdHJpbmcgb3IgYSBwcm9ibGVtIG1hdGNoZXIgZGVmaW5pdGlvbiBvciBhbiBhcnJheSBvZiBzdHJpbmdzIGFuZCBwcm9ibGVtIG1hdGNoZXJzLicpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdHRhc2tSdW5uZXJDb25maWd1cmF0aW9uOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdHJlcXVpcmVkOiBbXSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuY29tbWFuZCcsICdUaGUgY29tbWFuZCB0byBiZSBleGVjdXRlZC4gQ2FuIGJlIGFuIGV4dGVybmFsIHByb2dyYW0gb3IgYSBzaGVsbCBjb21tYW5kLicpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGFyZ3M6IHtcblx0XHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuYXJncycsICdBZGRpdGlvbmFsIGFyZ3VtZW50cyBwYXNzZWQgdG8gdGhlIGNvbW1hbmQuJyksXG5cdFx0XHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvb3B0aW9ucydcblx0XHRcdFx0fSxcblx0XHRcdFx0c2hvd091dHB1dDoge1xuXHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL3Nob3dPdXRwdXRUeXBlJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnNob3dPdXRwdXQnLCAnQ29udHJvbHMgd2hldGhlciB0aGUgb3V0cHV0IG9mIHRoZSBydW5uaW5nIHRhc2sgaXMgc2hvd24gb3Igbm90LiBJZiBvbWl0dGVkIFxcJ2Fsd2F5c1xcJyBpcyB1c2VkLicpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGlzV2F0Y2hpbmc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVwcmVjYXRpb25NZXNzYWdlOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEud2F0Y2hpbmcuZGVwcmVjYXRpb24nLCAnRGVwcmVjYXRlZC4gVXNlIGlzQmFja2dyb3VuZCBpbnN0ZWFkLicpLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEud2F0Y2hpbmcnLCAnV2hldGhlciB0aGUgZXhlY3V0ZWQgdGFzayBpcyBrZXB0IGFsaXZlIGFuZCBpcyB3YXRjaGluZyB0aGUgZmlsZSBzeXN0ZW0uJyksXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRpc0JhY2tncm91bmQ6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS5iYWNrZ3JvdW5kJywgJ1doZXRoZXIgdGhlIGV4ZWN1dGVkIHRhc2sgaXMga2VwdCBhbGl2ZSBhbmQgaXMgcnVubmluZyBpbiB0aGUgYmFja2dyb3VuZC4nKSxcblx0XHRcdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHByb21wdE9uQ2xvc2U6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS5wcm9tcHRPbkNsb3NlJywgJ1doZXRoZXIgdGhlIHVzZXIgaXMgcHJvbXB0ZWQgd2hlbiBWUyBDb2RlIGNsb3NlcyB3aXRoIGEgcnVubmluZyBiYWNrZ3JvdW5kIHRhc2suJyksXG5cdFx0XHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0ZWNob0NvbW1hbmQ6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS5lY2hvQ29tbWFuZCcsICdDb250cm9scyB3aGV0aGVyIHRoZSBleGVjdXRlZCBjb21tYW5kIGlzIGVjaG9lZCB0byB0aGUgb3V0cHV0LiBEZWZhdWx0IGlzIGZhbHNlLicpLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHRcdFx0fSxcblx0XHRcdFx0c3VwcHJlc3NUYXNrTmFtZToge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnN1cHByZXNzVGFza05hbWUnLCAnQ29udHJvbHMgd2hldGhlciB0aGUgdGFzayBuYW1lIGlzIGFkZGVkIGFzIGFuIGFyZ3VtZW50IHRvIHRoZSBjb21tYW5kLiBEZWZhdWx0IGlzIGZhbHNlLicpLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHRcdFx0fSxcblx0XHRcdFx0dGFza1NlbGVjdG9yOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS50YXNrU2VsZWN0b3InLCAnUHJlZml4IHRvIGluZGljYXRlIHRoYXQgYW4gYXJndW1lbnQgaXMgdGFzay4nKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRwcm9ibGVtTWF0Y2hlcjoge1xuXHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL3Byb2JsZW1NYXRjaGVyVHlwZScsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS5tYXRjaGVycycsICdUaGUgcHJvYmxlbSBtYXRjaGVyKHMpIHRvIHVzZS4gQ2FuIGVpdGhlciBiZSBhIHN0cmluZyBvciBhIHByb2JsZW0gbWF0Y2hlciBkZWZpbml0aW9uIG9yIGFuIGFycmF5IG9mIHN0cmluZ3MgYW5kIHByb2JsZW0gbWF0Y2hlcnMuJylcblx0XHRcdFx0fSxcblx0XHRcdFx0dGFza3M6IHtcblx0XHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEudGFza3MnLCAnVGhlIHRhc2sgY29uZmlndXJhdGlvbnMuIFVzdWFsbHkgdGhlc2UgYXJlIGVucmljaG1lbnRzIG9mIHRhc2sgYWxyZWFkeSBkZWZpbmVkIGluIHRoZSBleHRlcm5hbCB0YXNrIHJ1bm5lci4nKSxcblx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy90YXNrRGVzY3JpcHRpb24nXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59O1xuXG5leHBvcnQgZGVmYXVsdCBzY2hlbWE7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFNBQVM7QUFHckIs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
