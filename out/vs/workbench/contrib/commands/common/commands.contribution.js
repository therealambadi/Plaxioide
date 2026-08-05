import { safeStringify } from "../../../../base/common/objects.js";
import * as nls from "../../../../nls.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
class RunCommands extends Action2 {
  constructor() {
    super({
      id: "runCommands",
      title: nls.localize2("runCommands", "Run Commands"),
      f1: false,
      metadata: {
        description: nls.localize("runCommands.description", "Run several commands"),
        args: [
          {
            name: "args",
            schema: {
              type: "object",
              required: ["commands"],
              properties: {
                commands: {
                  type: "array",
                  description: nls.localize("runCommands.commands", "Commands to run"),
                  items: {
                    anyOf: [
                      {
                        $ref: "vscode://schemas/keybindings#/definitions/commandNames"
                      },
                      {
                        type: "string"
                      },
                      {
                        type: "object",
                        required: ["command"],
                        properties: {
                          command: {
                            "anyOf": [
                              {
                                $ref: "vscode://schemas/keybindings#/definitions/commandNames"
                              },
                              {
                                type: "string"
                              }
                            ]
                          }
                        },
                        $ref: "vscode://schemas/keybindings#/definitions/commandsSchemas"
                      }
                    ]
                  }
                }
              }
            }
          }
        ]
      }
    });
  }
  // dev decisions:
  // - this command takes a single argument-object because
  //	- keybinding definitions don't allow running commands with several arguments
  //  - and we want to be able to take on different other arguments in future, e.g., `runMode : 'serial' | 'concurrent'`
  async run(accessor, args) {
    const notificationService = accessor.get(INotificationService);
    if (!this._isCommandArgs(args)) {
      notificationService.error(nls.localize("runCommands.invalidArgs", "'runCommands' has received an argument with incorrect type. Please, review the argument passed to the command."));
      return;
    }
    if (args.commands.length === 0) {
      notificationService.warn(nls.localize("runCommands.noCommandsToRun", "'runCommands' has not received commands to run. Did you forget to pass commands in the 'runCommands' argument?"));
      return;
    }
    const commandService = accessor.get(ICommandService);
    const logService = accessor.get(ILogService);
    let i = 0;
    try {
      for (; i < args.commands.length; ++i) {
        const cmd = args.commands[i];
        logService.debug(`runCommands: executing ${i}-th command: ${safeStringify(cmd)}`);
        await this._runCommand(commandService, cmd);
        logService.debug(`runCommands: executed ${i}-th command`);
      }
    } catch (err) {
      logService.debug(`runCommands: executing ${i}-th command resulted in an error: ${err instanceof Error ? err.message : safeStringify(err)}`);
      notificationService.error(err);
    }
  }
  _isCommandArgs(args) {
    if (!args || typeof args !== "object") {
      return false;
    }
    if (!("commands" in args) || !Array.isArray(args.commands)) {
      return false;
    }
    for (const cmd of args.commands) {
      if (typeof cmd === "string") {
        continue;
      }
      if (typeof cmd === "object" && typeof cmd.command === "string") {
        continue;
      }
      return false;
    }
    return true;
  }
  _runCommand(commandService, cmd) {
    let commandID, commandArgs;
    if (typeof cmd === "string") {
      commandID = cmd;
    } else {
      commandID = cmd.command;
      commandArgs = cmd.args;
    }
    if (commandArgs === void 0) {
      return commandService.executeCommand(commandID);
    } else {
      if (Array.isArray(commandArgs)) {
        return commandService.executeCommand(commandID, ...commandArgs);
      } else {
        return commandService.executeCommand(commandID, commandArgs);
      }
    }
  }
}
registerAction2(RunCommands);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgc2FmZVN0cmluZ2lmeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuXG50eXBlIFJ1bm5hYmxlQ29tbWFuZCA9IHN0cmluZyB8IHsgY29tbWFuZDogc3RyaW5nOyBhcmdzOiBhbnlbXSB9O1xuXG50eXBlIENvbW1hbmRBcmdzID0ge1xuXHRjb21tYW5kczogUnVubmFibGVDb21tYW5kW107XG59O1xuXG4vKiogUnVucyBzZXZlcmFsIGNvbW1hbmRzIHBhc3NlZCB0byBpdCBhcyBhbiBhcmd1bWVudCAqL1xuY2xhc3MgUnVuQ29tbWFuZHMgZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3J1bkNvbW1hbmRzJyxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdydW5Db21tYW5kcycsIFwiUnVuIENvbW1hbmRzXCIpLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgncnVuQ29tbWFuZHMuZGVzY3JpcHRpb24nLCBcIlJ1biBzZXZlcmFsIGNvbW1hbmRzXCIpLFxuXHRcdFx0XHRhcmdzOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmFtZTogJ2FyZ3MnLFxuXHRcdFx0XHRcdFx0c2NoZW1hOiB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0XHRyZXF1aXJlZDogWydjb21tYW5kcyddLFxuXHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0Y29tbWFuZHM6IHtcblx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdydW5Db21tYW5kcy5jb21tYW5kcycsIFwiQ29tbWFuZHMgdG8gcnVuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0YW55T2Y6IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQkcmVmOiAndnNjb2RlOi8vc2NoZW1hcy9rZXliaW5kaW5ncyMvZGVmaW5pdGlvbnMvY29tbWFuZE5hbWVzJ1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHJlcXVpcmVkOiBbJ2NvbW1hbmQnXSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhbnlPZic6IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JHJlZjogJ3ZzY29kZTovL3NjaGVtYXMva2V5YmluZGluZ3MjL2RlZmluaXRpb25zL2NvbW1hbmROYW1lcydcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCRyZWY6ICd2c2NvZGU6Ly9zY2hlbWFzL2tleWJpbmRpbmdzIy9kZWZpbml0aW9ucy9jb21tYW5kc1NjaGVtYXMnXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHQvLyBkZXYgZGVjaXNpb25zOlxuXHQvLyAtIHRoaXMgY29tbWFuZCB0YWtlcyBhIHNpbmdsZSBhcmd1bWVudC1vYmplY3QgYmVjYXVzZVxuXHQvL1x0LSBrZXliaW5kaW5nIGRlZmluaXRpb25zIGRvbid0IGFsbG93IHJ1bm5pbmcgY29tbWFuZHMgd2l0aCBzZXZlcmFsIGFyZ3VtZW50c1xuXHQvLyAgLSBhbmQgd2Ugd2FudCB0byBiZSBhYmxlIHRvIHRha2Ugb24gZGlmZmVyZW50IG90aGVyIGFyZ3VtZW50cyBpbiBmdXR1cmUsIGUuZy4sIGBydW5Nb2RlIDogJ3NlcmlhbCcgfCAnY29uY3VycmVudCdgXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJnczogdW5rbm93bikge1xuXG5cdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cblx0XHRpZiAoIXRoaXMuX2lzQ29tbWFuZEFyZ3MoYXJncykpIHtcblx0XHRcdG5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IobmxzLmxvY2FsaXplKCdydW5Db21tYW5kcy5pbnZhbGlkQXJncycsIFwiJ3J1bkNvbW1hbmRzJyBoYXMgcmVjZWl2ZWQgYW4gYXJndW1lbnQgd2l0aCBpbmNvcnJlY3QgdHlwZS4gUGxlYXNlLCByZXZpZXcgdGhlIGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgY29tbWFuZC5cIikpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChhcmdzLmNvbW1hbmRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0bm90aWZpY2F0aW9uU2VydmljZS53YXJuKG5scy5sb2NhbGl6ZSgncnVuQ29tbWFuZHMubm9Db21tYW5kc1RvUnVuJywgXCIncnVuQ29tbWFuZHMnIGhhcyBub3QgcmVjZWl2ZWQgY29tbWFuZHMgdG8gcnVuLiBEaWQgeW91IGZvcmdldCB0byBwYXNzIGNvbW1hbmRzIGluIHRoZSAncnVuQ29tbWFuZHMnIGFyZ3VtZW50P1wiKSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblx0XHRjb25zdCBsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMb2dTZXJ2aWNlKTtcblxuXHRcdGxldCBpID0gMDtcblx0XHR0cnkge1xuXHRcdFx0Zm9yICg7IGkgPCBhcmdzLmNvbW1hbmRzLmxlbmd0aDsgKytpKSB7XG5cblx0XHRcdFx0Y29uc3QgY21kID0gYXJncy5jb21tYW5kc1tpXTtcblxuXHRcdFx0XHRsb2dTZXJ2aWNlLmRlYnVnKGBydW5Db21tYW5kczogZXhlY3V0aW5nICR7aX0tdGggY29tbWFuZDogJHtzYWZlU3RyaW5naWZ5KGNtZCl9YCk7XG5cblx0XHRcdFx0YXdhaXQgdGhpcy5fcnVuQ29tbWFuZChjb21tYW5kU2VydmljZSwgY21kKTtcblxuXHRcdFx0XHRsb2dTZXJ2aWNlLmRlYnVnKGBydW5Db21tYW5kczogZXhlY3V0ZWQgJHtpfS10aCBjb21tYW5kYCk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRsb2dTZXJ2aWNlLmRlYnVnKGBydW5Db21tYW5kczogZXhlY3V0aW5nICR7aX0tdGggY29tbWFuZCByZXN1bHRlZCBpbiBhbiBlcnJvcjogJHtlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogc2FmZVN0cmluZ2lmeShlcnIpfWApO1xuXG5cdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfaXNDb21tYW5kQXJncyhhcmdzOiB1bmtub3duKTogYXJncyBpcyBDb21tYW5kQXJncyB7XG5cdFx0aWYgKCFhcmdzIHx8IHR5cGVvZiBhcmdzICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoISgnY29tbWFuZHMnIGluIGFyZ3MpIHx8ICFBcnJheS5pc0FycmF5KGFyZ3MuY29tbWFuZHMpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgY21kIG9mIGFyZ3MuY29tbWFuZHMpIHtcblx0XHRcdGlmICh0eXBlb2YgY21kID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGlmICh0eXBlb2YgY21kID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgY21kLmNvbW1hbmQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgX3J1bkNvbW1hbmQoY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSwgY21kOiBSdW5uYWJsZUNvbW1hbmQpIHtcblx0XHRsZXQgY29tbWFuZElEOiBzdHJpbmcsIGNvbW1hbmRBcmdzO1xuXG5cdFx0aWYgKHR5cGVvZiBjbWQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRjb21tYW5kSUQgPSBjbWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbW1hbmRJRCA9IGNtZC5jb21tYW5kO1xuXHRcdFx0Y29tbWFuZEFyZ3MgPSBjbWQuYXJncztcblx0XHR9XG5cblx0XHRpZiAoY29tbWFuZEFyZ3MgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGNvbW1hbmRJRCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KGNvbW1hbmRBcmdzKSkge1xuXHRcdFx0XHRyZXR1cm4gY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoY29tbWFuZElELCAuLi5jb21tYW5kQXJncyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoY29tbWFuZElELCBjb21tYW5kQXJncyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbnJlZ2lzdGVyQWN0aW9uMihSdW5Db21tYW5kcyk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHFCQUFxQjtBQUM5QixZQUFZLFNBQVM7QUFDckIsU0FBUyxTQUFTLHVCQUF1QjtBQUN6QyxTQUFTLHVCQUF1QjtBQUVoQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDRCQUE0QjtBQVNyQyxNQUFNLG9CQUFvQixRQUFRO0FBQUEsRUFFakMsY0FBYztBQUNiLFVBQU07QUFBQSxNQUNMLElBQUk7QUFBQSxNQUNKLE9BQU8sSUFBSSxVQUFVLGVBQWUsY0FBYztBQUFBLE1BQ2xELElBQUk7QUFBQSxNQUNKLFVBQVU7QUFBQSxRQUNULGFBQWEsSUFBSSxTQUFTLDJCQUEyQixzQkFBc0I7QUFBQSxRQUMzRSxNQUFNO0FBQUEsVUFDTDtBQUFBLFlBQ0MsTUFBTTtBQUFBLFlBQ04sUUFBUTtBQUFBLGNBQ1AsTUFBTTtBQUFBLGNBQ04sVUFBVSxDQUFDLFVBQVU7QUFBQSxjQUNyQixZQUFZO0FBQUEsZ0JBQ1gsVUFBVTtBQUFBLGtCQUNULE1BQU07QUFBQSxrQkFDTixhQUFhLElBQUksU0FBUyx3QkFBd0IsaUJBQWlCO0FBQUEsa0JBQ25FLE9BQU87QUFBQSxvQkFDTixPQUFPO0FBQUEsc0JBQ047QUFBQSx3QkFDQyxNQUFNO0FBQUEsc0JBQ1A7QUFBQSxzQkFDQTtBQUFBLHdCQUNDLE1BQU07QUFBQSxzQkFDUDtBQUFBLHNCQUNBO0FBQUEsd0JBQ0MsTUFBTTtBQUFBLHdCQUNOLFVBQVUsQ0FBQyxTQUFTO0FBQUEsd0JBQ3BCLFlBQVk7QUFBQSwwQkFDWCxTQUFTO0FBQUEsNEJBQ1IsU0FBUztBQUFBLDhCQUNSO0FBQUEsZ0NBQ0MsTUFBTTtBQUFBLDhCQUNQO0FBQUEsOEJBQ0E7QUFBQSxnQ0FDQyxNQUFNO0FBQUEsOEJBQ1A7QUFBQSw0QkFDRDtBQUFBLDBCQUNEO0FBQUEsd0JBQ0Q7QUFBQSx3QkFDQSxNQUFNO0FBQUEsc0JBQ1A7QUFBQSxvQkFDRDtBQUFBLGtCQUNEO0FBQUEsZ0JBQ0Q7QUFBQSxjQUNEO0FBQUEsWUFDRDtBQUFBLFVBQ0Q7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTUEsTUFBTSxJQUFJLFVBQTRCLE1BQWU7QUFFcEQsVUFBTSxzQkFBc0IsU0FBUyxJQUFJLG9CQUFvQjtBQUU3RCxRQUFJLENBQUMsS0FBSyxlQUFlLElBQUksR0FBRztBQUMvQiwwQkFBb0IsTUFBTSxJQUFJLFNBQVMsMkJBQTJCLGdIQUFnSCxDQUFDO0FBQ25MO0FBQUEsSUFDRDtBQUVBLFFBQUksS0FBSyxTQUFTLFdBQVcsR0FBRztBQUMvQiwwQkFBb0IsS0FBSyxJQUFJLFNBQVMsK0JBQStCLGdIQUFnSCxDQUFDO0FBQ3RMO0FBQUEsSUFDRDtBQUVBLFVBQU0saUJBQWlCLFNBQVMsSUFBSSxlQUFlO0FBQ25ELFVBQU0sYUFBYSxTQUFTLElBQUksV0FBVztBQUUzQyxRQUFJLElBQUk7QUFDUixRQUFJO0FBQ0gsYUFBTyxJQUFJLEtBQUssU0FBUyxRQUFRLEVBQUUsR0FBRztBQUVyQyxjQUFNLE1BQU0sS0FBSyxTQUFTLENBQUM7QUFFM0IsbUJBQVcsTUFBTSwwQkFBMEIsQ0FBQyxnQkFBZ0IsY0FBYyxHQUFHLENBQUMsRUFBRTtBQUVoRixjQUFNLEtBQUssWUFBWSxnQkFBZ0IsR0FBRztBQUUxQyxtQkFBVyxNQUFNLHlCQUF5QixDQUFDLGFBQWE7QUFBQSxNQUN6RDtBQUFBLElBQ0QsU0FBUyxLQUFLO0FBQ2IsaUJBQVcsTUFBTSwwQkFBMEIsQ0FBQyxxQ0FBcUMsZUFBZSxRQUFRLElBQUksVUFBVSxjQUFjLEdBQUcsQ0FBQyxFQUFFO0FBRTFJLDBCQUFvQixNQUFNLEdBQUc7QUFBQSxJQUM5QjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGVBQWUsTUFBb0M7QUFDMUQsUUFBSSxDQUFDLFFBQVEsT0FBTyxTQUFTLFVBQVU7QUFDdEMsYUFBTztBQUFBLElBQ1I7QUFDQSxRQUFJLEVBQUUsY0FBYyxTQUFTLENBQUMsTUFBTSxRQUFRLEtBQUssUUFBUSxHQUFHO0FBQzNELGFBQU87QUFBQSxJQUNSO0FBQ0EsZUFBVyxPQUFPLEtBQUssVUFBVTtBQUNoQyxVQUFJLE9BQU8sUUFBUSxVQUFVO0FBQzVCO0FBQUEsTUFDRDtBQUNBLFVBQUksT0FBTyxRQUFRLFlBQVksT0FBTyxJQUFJLFlBQVksVUFBVTtBQUMvRDtBQUFBLE1BQ0Q7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxZQUFZLGdCQUFpQyxLQUFzQjtBQUMxRSxRQUFJLFdBQW1CO0FBRXZCLFFBQUksT0FBTyxRQUFRLFVBQVU7QUFDNUIsa0JBQVk7QUFBQSxJQUNiLE9BQU87QUFDTixrQkFBWSxJQUFJO0FBQ2hCLG9CQUFjLElBQUk7QUFBQSxJQUNuQjtBQUVBLFFBQUksZ0JBQWdCLFFBQVc7QUFDOUIsYUFBTyxlQUFlLGVBQWUsU0FBUztBQUFBLElBQy9DLE9BQU87QUFDTixVQUFJLE1BQU0sUUFBUSxXQUFXLEdBQUc7QUFDL0IsZUFBTyxlQUFlLGVBQWUsV0FBVyxHQUFHLFdBQVc7QUFBQSxNQUMvRCxPQUFPO0FBQ04sZUFBTyxlQUFlLGVBQWUsV0FBVyxXQUFXO0FBQUEsTUFDNUQ7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNEO0FBRUEsZ0JBQWdCLFdBQVc7IiwKICAibmFtZXMiOiBbXQp9Cg==
