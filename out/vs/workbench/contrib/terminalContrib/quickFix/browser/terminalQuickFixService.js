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
import { Emitter } from "../../../../../base/common/event.js";
import { toDisposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { isProposedApiEnabled } from "../../../../services/extensions/common/extensions.js";
import { ExtensionsRegistry } from "../../../../services/extensions/common/extensionsRegistry.js";
let TerminalQuickFixService = class {
  constructor(_logService) {
    this._logService = _logService;
    this._selectors = /* @__PURE__ */ new Map();
    this._providers = /* @__PURE__ */ new Map();
    this._onDidRegisterProvider = new Emitter();
    this.onDidRegisterProvider = this._onDidRegisterProvider.event;
    this._onDidRegisterCommandSelector = new Emitter();
    this.onDidRegisterCommandSelector = this._onDidRegisterCommandSelector.event;
    this._onDidUnregisterProvider = new Emitter();
    this.onDidUnregisterProvider = this._onDidUnregisterProvider.event;
    this.extensionQuickFixes = new Promise((r) => quickFixExtensionPoint.setHandler((fixes) => {
      r(fixes.filter((c) => isProposedApiEnabled(c.description, "terminalQuickFixProvider")).map((c) => {
        if (!c.value) {
          return [];
        }
        return c.value.map((fix) => {
          return { ...fix, extensionIdentifier: c.description.identifier.value };
        });
      }).flat());
    }));
    this.extensionQuickFixes.then((selectors) => {
      for (const selector of selectors) {
        this.registerCommandSelector(selector);
      }
    });
  }
  get providers() {
    return this._providers;
  }
  registerCommandSelector(selector) {
    this._selectors.set(selector.id, selector);
    this._onDidRegisterCommandSelector.fire(selector);
  }
  registerQuickFixProvider(id, provider) {
    let disposed = false;
    this.extensionQuickFixes.then(() => {
      if (disposed) {
        return;
      }
      this._providers.set(id, provider);
      const selector = this._selectors.get(id);
      if (!selector) {
        this._logService.error(`No registered selector for ID: ${id}`);
        return;
      }
      this._onDidRegisterProvider.fire({ selector, provider });
    });
    return toDisposable(() => {
      disposed = true;
      this._providers.delete(id);
      const selector = this._selectors.get(id);
      if (selector) {
        this._selectors.delete(id);
        this._onDidUnregisterProvider.fire(selector.id);
      }
    });
  }
};
TerminalQuickFixService = __decorateClass([
  __decorateParam(0, ILogService)
], TerminalQuickFixService);
const quickFixExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "terminalQuickFixes",
  defaultExtensionKind: ["workspace"],
  activationEventsGenerator: (terminalQuickFixes, result) => {
    for (const quickFixContrib of terminalQuickFixes ?? []) {
      result.push(`onTerminalQuickFixRequest:${quickFixContrib.id}`);
    }
  },
  jsonSchema: {
    description: localize("vscode.extension.contributes.terminalQuickFixes", "Contributes terminal quick fixes."),
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      required: ["id", "commandLineMatcher", "outputMatcher", "commandExitResult"],
      defaultSnippets: [{
        body: {
          id: "$1",
          commandLineMatcher: "$2",
          outputMatcher: "$3",
          exitStatus: "$4"
        }
      }],
      properties: {
        id: {
          description: localize("vscode.extension.contributes.terminalQuickFixes.id", "The ID of the quick fix provider"),
          type: "string"
        },
        commandLineMatcher: {
          description: localize("vscode.extension.contributes.terminalQuickFixes.commandLineMatcher", "A regular expression or string to test the command line against"),
          type: "string"
        },
        outputMatcher: {
          markdownDescription: localize("vscode.extension.contributes.terminalQuickFixes.outputMatcher", "A regular expression or string to match a single line of the output against, which provides groups to be referenced in terminalCommand and uri.\n\nFor example:\n\n `lineMatcher: /git push --set-upstream origin (?<branchName>[^s]+)/;`\n\n`terminalCommand: 'git push --set-upstream origin ${group:branchName}';`\n"),
          type: "object",
          required: ["lineMatcher", "anchor", "offset", "length"],
          properties: {
            lineMatcher: {
              description: "A regular expression or string to test the command line against",
              type: "string"
            },
            anchor: {
              description: "Where the search should begin in the buffer",
              enum: ["top", "bottom"]
            },
            offset: {
              description: "The number of lines vertically from the anchor in the buffer to start matching against",
              type: "number"
            },
            length: {
              description: "The number of rows to match against, this should be as small as possible for performance reasons",
              type: "number"
            }
          }
        },
        commandExitResult: {
          description: localize("vscode.extension.contributes.terminalQuickFixes.commandExitResult", "The command exit result to match on"),
          enum: ["success", "error"],
          enumDescriptions: [
            "The command exited with an exit code of zero.",
            "The command exited with a non-zero exit code."
          ]
        },
        kind: {
          description: localize("vscode.extension.contributes.terminalQuickFixes.kind", "The kind of the resulting quick fix. This changes how the quick fix is presented. Defaults to {0}.", '`"fix"`'),
          enum: ["default", "explain"],
          enumDescriptions: [
            "A high confidence quick fix.",
            "An explanation of the problem."
          ]
        }
      }
    }
  }
});
export {
  TerminalQuickFixService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvcXVpY2tGaXgvYnJvd3Nlci90ZXJtaW5hbFF1aWNrRml4U2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsQ29tbWFuZFNlbGVjdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbFF1aWNrRml4U2VydmljZSwgSVRlcm1pbmFsUXVpY2tGaXhQcm92aWRlciwgSVRlcm1pbmFsUXVpY2tGaXhQcm92aWRlclNlbGVjdG9yIH0gZnJvbSAnLi9xdWlja0ZpeC5qcyc7XG5pbXBvcnQgeyBpc1Byb3Bvc2VkQXBpRW5hYmxlZCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9uc1JlZ2lzdHJ5LmpzJztcblxuZXhwb3J0IGNsYXNzIFRlcm1pbmFsUXVpY2tGaXhTZXJ2aWNlIGltcGxlbWVudHMgSVRlcm1pbmFsUXVpY2tGaXhTZXJ2aWNlIHtcblx0ZGVjbGFyZSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfc2VsZWN0b3JzOiBNYXA8c3RyaW5nLCBJVGVybWluYWxDb21tYW5kU2VsZWN0b3I+ID0gbmV3IE1hcCgpO1xuXG5cdHByaXZhdGUgX3Byb3ZpZGVyczogTWFwPHN0cmluZywgSVRlcm1pbmFsUXVpY2tGaXhQcm92aWRlcj4gPSBuZXcgTWFwKCk7XG5cdGdldCBwcm92aWRlcnMoKTogTWFwPHN0cmluZywgSVRlcm1pbmFsUXVpY2tGaXhQcm92aWRlcj4geyByZXR1cm4gdGhpcy5fcHJvdmlkZXJzOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZWdpc3RlclByb3ZpZGVyID0gbmV3IEVtaXR0ZXI8SVRlcm1pbmFsUXVpY2tGaXhQcm92aWRlclNlbGVjdG9yPigpO1xuXHRyZWFkb25seSBvbkRpZFJlZ2lzdGVyUHJvdmlkZXIgPSB0aGlzLl9vbkRpZFJlZ2lzdGVyUHJvdmlkZXIuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVnaXN0ZXJDb21tYW5kU2VsZWN0b3IgPSBuZXcgRW1pdHRlcjxJVGVybWluYWxDb21tYW5kU2VsZWN0b3I+KCk7XG5cdHJlYWRvbmx5IG9uRGlkUmVnaXN0ZXJDb21tYW5kU2VsZWN0b3IgPSB0aGlzLl9vbkRpZFJlZ2lzdGVyQ29tbWFuZFNlbGVjdG9yLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFVucmVnaXN0ZXJQcm92aWRlciA9IG5ldyBFbWl0dGVyPHN0cmluZz4oKTtcblx0cmVhZG9ubHkgb25EaWRVbnJlZ2lzdGVyUHJvdmlkZXIgPSB0aGlzLl9vbkRpZFVucmVnaXN0ZXJQcm92aWRlci5ldmVudDtcblxuXHRyZWFkb25seSBleHRlbnNpb25RdWlja0ZpeGVzOiBQcm9taXNlPEFycmF5PElUZXJtaW5hbENvbW1hbmRTZWxlY3Rvcj4+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5leHRlbnNpb25RdWlja0ZpeGVzID0gbmV3IFByb21pc2UoKHIpID0+IHF1aWNrRml4RXh0ZW5zaW9uUG9pbnQuc2V0SGFuZGxlcihmaXhlcyA9PiB7XG5cdFx0XHRyKGZpeGVzLmZpbHRlcihjID0+IGlzUHJvcG9zZWRBcGlFbmFibGVkKGMuZGVzY3JpcHRpb24sICd0ZXJtaW5hbFF1aWNrRml4UHJvdmlkZXInKSkubWFwKGMgPT4ge1xuXHRcdFx0XHRpZiAoIWMudmFsdWUpIHtcblx0XHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGMudmFsdWUubWFwKGZpeCA9PiB7IHJldHVybiB7IC4uLmZpeCwgZXh0ZW5zaW9uSWRlbnRpZmllcjogYy5kZXNjcmlwdGlvbi5pZGVudGlmaWVyLnZhbHVlIH07IH0pO1xuXHRcdFx0fSkuZmxhdCgpKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5leHRlbnNpb25RdWlja0ZpeGVzLnRoZW4oc2VsZWN0b3JzID0+IHtcblx0XHRcdGZvciAoY29uc3Qgc2VsZWN0b3Igb2Ygc2VsZWN0b3JzKSB7XG5cdFx0XHRcdHRoaXMucmVnaXN0ZXJDb21tYW5kU2VsZWN0b3Ioc2VsZWN0b3IpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cmVnaXN0ZXJDb21tYW5kU2VsZWN0b3Ioc2VsZWN0b3I6IElUZXJtaW5hbENvbW1hbmRTZWxlY3Rvcik6IHZvaWQge1xuXHRcdHRoaXMuX3NlbGVjdG9ycy5zZXQoc2VsZWN0b3IuaWQsIHNlbGVjdG9yKTtcblx0XHR0aGlzLl9vbkRpZFJlZ2lzdGVyQ29tbWFuZFNlbGVjdG9yLmZpcmUoc2VsZWN0b3IpO1xuXHR9XG5cblx0cmVnaXN0ZXJRdWlja0ZpeFByb3ZpZGVyKGlkOiBzdHJpbmcsIHByb3ZpZGVyOiBJVGVybWluYWxRdWlja0ZpeFByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRcdC8vIFRoaXMgaXMgbW9yZSBjb21wbGljYXRlZCB0aGFuIGl0IGxvb2tzIGxpa2UgaXQgc2hvdWxkIGJlIGJlY2F1c2Ugd2UgbmVlZCB0byByZXR1cm4gYW5cblx0XHQvLyBJRGlzcG9zYWJsZSBzeW5jaHJvbm91c2x5IGJ1dCB3ZSBtdXN0IGF3YWl0IElUZXJtaW5hbENvbnRyaWJ1dGlvblNlcnZpY2UucXVpY2tGaXhlc1xuXHRcdC8vIGFzeW5jaHJvbm91c2x5IGJlZm9yZSBhY3R1YWxseSByZWdpc3RlcmluZyB0aGUgcHJvdmlkZXIuXG5cdFx0bGV0IGRpc3Bvc2VkID0gZmFsc2U7XG5cdFx0dGhpcy5leHRlbnNpb25RdWlja0ZpeGVzLnRoZW4oKCkgPT4ge1xuXHRcdFx0aWYgKGRpc3Bvc2VkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3Byb3ZpZGVycy5zZXQoaWQsIHByb3ZpZGVyKTtcblx0XHRcdGNvbnN0IHNlbGVjdG9yID0gdGhpcy5fc2VsZWN0b3JzLmdldChpZCk7XG5cdFx0XHRpZiAoIXNlbGVjdG9yKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoYE5vIHJlZ2lzdGVyZWQgc2VsZWN0b3IgZm9yIElEOiAke2lkfWApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9vbkRpZFJlZ2lzdGVyUHJvdmlkZXIuZmlyZSh7IHNlbGVjdG9yLCBwcm92aWRlciB9KTtcblx0XHR9KTtcblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGRpc3Bvc2VkID0gdHJ1ZTtcblx0XHRcdHRoaXMuX3Byb3ZpZGVycy5kZWxldGUoaWQpO1xuXHRcdFx0Y29uc3Qgc2VsZWN0b3IgPSB0aGlzLl9zZWxlY3RvcnMuZ2V0KGlkKTtcblx0XHRcdGlmIChzZWxlY3Rvcikge1xuXHRcdFx0XHR0aGlzLl9zZWxlY3RvcnMuZGVsZXRlKGlkKTtcblx0XHRcdFx0dGhpcy5fb25EaWRVbnJlZ2lzdGVyUHJvdmlkZXIuZmlyZShzZWxlY3Rvci5pZCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuY29uc3QgcXVpY2tGaXhFeHRlbnNpb25Qb2ludCA9IEV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PElUZXJtaW5hbENvbW1hbmRTZWxlY3RvcltdPih7XG5cdGV4dGVuc2lvblBvaW50OiAndGVybWluYWxRdWlja0ZpeGVzJyxcblx0ZGVmYXVsdEV4dGVuc2lvbktpbmQ6IFsnd29ya3NwYWNlJ10sXG5cdGFjdGl2YXRpb25FdmVudHNHZW5lcmF0b3I6ICh0ZXJtaW5hbFF1aWNrRml4ZXM6IElUZXJtaW5hbENvbW1hbmRTZWxlY3RvcltdLCByZXN1bHQ6IHsgcHVzaChpdGVtOiBzdHJpbmcpOiB2b2lkIH0pID0+IHtcblx0XHRmb3IgKGNvbnN0IHF1aWNrRml4Q29udHJpYiBvZiB0ZXJtaW5hbFF1aWNrRml4ZXMgPz8gW10pIHtcblx0XHRcdHJlc3VsdC5wdXNoKGBvblRlcm1pbmFsUXVpY2tGaXhSZXF1ZXN0OiR7cXVpY2tGaXhDb250cmliLmlkfWApO1xuXHRcdH1cblx0fSxcblx0anNvblNjaGVtYToge1xuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy50ZXJtaW5hbFF1aWNrRml4ZXMnLCAnQ29udHJpYnV0ZXMgdGVybWluYWwgcXVpY2sgZml4ZXMuJyksXG5cdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRpdGVtczoge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHRyZXF1aXJlZDogWydpZCcsICdjb21tYW5kTGluZU1hdGNoZXInLCAnb3V0cHV0TWF0Y2hlcicsICdjb21tYW5kRXhpdFJlc3VsdCddLFxuXHRcdFx0ZGVmYXVsdFNuaXBwZXRzOiBbe1xuXHRcdFx0XHRib2R5OiB7XG5cdFx0XHRcdFx0aWQ6ICckMScsXG5cdFx0XHRcdFx0Y29tbWFuZExpbmVNYXRjaGVyOiAnJDInLFxuXHRcdFx0XHRcdG91dHB1dE1hdGNoZXI6ICckMycsXG5cdFx0XHRcdFx0ZXhpdFN0YXR1czogJyQ0J1xuXHRcdFx0XHR9XG5cdFx0XHR9XSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0aWQ6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMudGVybWluYWxRdWlja0ZpeGVzLmlkJywgXCJUaGUgSUQgb2YgdGhlIHF1aWNrIGZpeCBwcm92aWRlclwiKSxcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0fSxcblx0XHRcdFx0Y29tbWFuZExpbmVNYXRjaGVyOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnRlcm1pbmFsUXVpY2tGaXhlcy5jb21tYW5kTGluZU1hdGNoZXInLCBcIkEgcmVndWxhciBleHByZXNzaW9uIG9yIHN0cmluZyB0byB0ZXN0IHRoZSBjb21tYW5kIGxpbmUgYWdhaW5zdFwiKSxcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0fSxcblx0XHRcdFx0b3V0cHV0TWF0Y2hlcjoge1xuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnRlcm1pbmFsUXVpY2tGaXhlcy5vdXRwdXRNYXRjaGVyJywgXCJBIHJlZ3VsYXIgZXhwcmVzc2lvbiBvciBzdHJpbmcgdG8gbWF0Y2ggYSBzaW5nbGUgbGluZSBvZiB0aGUgb3V0cHV0IGFnYWluc3QsIHdoaWNoIHByb3ZpZGVzIGdyb3VwcyB0byBiZSByZWZlcmVuY2VkIGluIHRlcm1pbmFsQ29tbWFuZCBhbmQgdXJpLlxcblxcbkZvciBleGFtcGxlOlxcblxcbiBgbGluZU1hdGNoZXI6IC9naXQgcHVzaCAtLXNldC11cHN0cmVhbSBvcmlnaW4gKD88YnJhbmNoTmFtZT5bXlxcc10rKS87YFxcblxcbmB0ZXJtaW5hbENvbW1hbmQ6ICdnaXQgcHVzaCAtLXNldC11cHN0cmVhbSBvcmlnaW4gJHtncm91cDpicmFuY2hOYW1lfSc7YFxcblwiKSxcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRyZXF1aXJlZDogWydsaW5lTWF0Y2hlcicsICdhbmNob3InLCAnb2Zmc2V0JywgJ2xlbmd0aCddLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdGxpbmVNYXRjaGVyOiB7XG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAnQSByZWd1bGFyIGV4cHJlc3Npb24gb3Igc3RyaW5nIHRvIHRlc3QgdGhlIGNvbW1hbmQgbGluZSBhZ2FpbnN0Jyxcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRhbmNob3I6IHtcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdXaGVyZSB0aGUgc2VhcmNoIHNob3VsZCBiZWdpbiBpbiB0aGUgYnVmZmVyJyxcblx0XHRcdFx0XHRcdFx0ZW51bTogWyd0b3AnLCAnYm90dG9tJ11cblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRvZmZzZXQ6IHtcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdUaGUgbnVtYmVyIG9mIGxpbmVzIHZlcnRpY2FsbHkgZnJvbSB0aGUgYW5jaG9yIGluIHRoZSBidWZmZXIgdG8gc3RhcnQgbWF0Y2hpbmcgYWdhaW5zdCcsXG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdudW1iZXInXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0bGVuZ3RoOiB7XG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAnVGhlIG51bWJlciBvZiByb3dzIHRvIG1hdGNoIGFnYWluc3QsIHRoaXMgc2hvdWxkIGJlIGFzIHNtYWxsIGFzIHBvc3NpYmxlIGZvciBwZXJmb3JtYW5jZSByZWFzb25zJyxcblx0XHRcdFx0XHRcdFx0dHlwZTogJ251bWJlcidcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNvbW1hbmRFeGl0UmVzdWx0OiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnRlcm1pbmFsUXVpY2tGaXhlcy5jb21tYW5kRXhpdFJlc3VsdCcsIFwiVGhlIGNvbW1hbmQgZXhpdCByZXN1bHQgdG8gbWF0Y2ggb25cIiksXG5cdFx0XHRcdFx0ZW51bTogWydzdWNjZXNzJywgJ2Vycm9yJ10sXG5cdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0J1RoZSBjb21tYW5kIGV4aXRlZCB3aXRoIGFuIGV4aXQgY29kZSBvZiB6ZXJvLicsXG5cdFx0XHRcdFx0XHQnVGhlIGNvbW1hbmQgZXhpdGVkIHdpdGggYSBub24temVybyBleGl0IGNvZGUuJ1xuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0a2luZDoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy50ZXJtaW5hbFF1aWNrRml4ZXMua2luZCcsIFwiVGhlIGtpbmQgb2YgdGhlIHJlc3VsdGluZyBxdWljayBmaXguIFRoaXMgY2hhbmdlcyBob3cgdGhlIHF1aWNrIGZpeCBpcyBwcmVzZW50ZWQuIERlZmF1bHRzIHRvIHswfS5cIiwgJ2BcImZpeFwiYCcpLFxuXHRcdFx0XHRcdGVudW06IFsnZGVmYXVsdCcsICdleHBsYWluJ10sXG5cdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0J0EgaGlnaCBjb25maWRlbmNlIHF1aWNrIGZpeC4nLFxuXHRcdFx0XHRcdFx0J0FuIGV4cGxhbmF0aW9uIG9mIHRoZSBwcm9ibGVtLidcblx0XHRcdFx0XHRdXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fVxuXHR9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBZTtBQUN4QixTQUFzQixvQkFBb0I7QUFDMUMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxtQkFBbUI7QUFHNUIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUywwQkFBMEI7QUFFNUIsSUFBTSwwQkFBTixNQUFrRTtBQUFBLEVBaUJ4RSxZQUMrQixhQUM3QjtBQUQ2QjtBQWYvQixTQUFRLGFBQW9ELG9CQUFJLElBQUk7QUFFcEUsU0FBUSxhQUFxRCxvQkFBSSxJQUFJO0FBR3JFLFNBQWlCLHlCQUF5QixJQUFJLFFBQTJDO0FBQ3pGLFNBQVMsd0JBQXdCLEtBQUssdUJBQXVCO0FBQzdELFNBQWlCLGdDQUFnQyxJQUFJLFFBQWtDO0FBQ3ZGLFNBQVMsK0JBQStCLEtBQUssOEJBQThCO0FBQzNFLFNBQWlCLDJCQUEyQixJQUFJLFFBQWdCO0FBQ2hFLFNBQVMsMEJBQTBCLEtBQUsseUJBQXlCO0FBT2hFLFNBQUssc0JBQXNCLElBQUksUUFBUSxDQUFDLE1BQU0sdUJBQXVCLFdBQVcsV0FBUztBQUN4RixRQUFFLE1BQU0sT0FBTyxPQUFLLHFCQUFxQixFQUFFLGFBQWEsMEJBQTBCLENBQUMsRUFBRSxJQUFJLE9BQUs7QUFD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
