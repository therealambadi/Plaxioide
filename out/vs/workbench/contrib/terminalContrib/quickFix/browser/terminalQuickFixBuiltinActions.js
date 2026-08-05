import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { TerminalQuickFixType } from "./quickFix.js";
const GitCommandLineRegex = /git/;
const GitFastForwardPullOutputRegex = /and can be fast-forwarded/;
const GitPushCommandLineRegex = /git\s+push/;
const GitTwoDashesRegex = /error: did you mean `--(.+)` \(with two dashes\)\?/;
const GitSimilarOutputRegex = /(?:(most similar commands? (is|are)))/;
const FreePortOutputRegex = /(?:address already in use (?:0\.0\.0\.0|127\.0\.0\.1|localhost|::):|Unable to bind [^ ]*:|can't listen on port |listen EADDRINUSE [^ ]*:)(?<portNumber>\d{4,5})/;
const GitPushOutputRegex = /git push --set-upstream origin (?<branchName>[^\s]+)/;
const GitCreatePrOutputRegex = /remote:\s*(?<link>https:\/\/github\.com\/.+\/.+\/pull\/new\/.+)/;
const PwshGeneralErrorOutputRegex = /Suggestion \[General\]:/;
const PwshUnixCommandNotFoundErrorOutputRegex = /Suggestion \[cmd-not-found\]:/;
var QuickFixSource = /* @__PURE__ */ ((QuickFixSource2) => {
  QuickFixSource2["Builtin"] = "builtin";
  return QuickFixSource2;
})(QuickFixSource || {});
function gitSimilar() {
  return {
    id: "Git Similar",
    type: "internal",
    commandLineMatcher: GitCommandLineRegex,
    outputMatcher: {
      lineMatcher: GitSimilarOutputRegex,
      anchor: "bottom",
      offset: 0,
      length: 10
    },
    commandExitResult: "error",
    getQuickFixes: (matchResult) => {
      const regexMatch = matchResult.outputMatch?.regexMatch[0];
      if (!regexMatch || !matchResult.outputMatch) {
        return;
      }
      const actions = [];
      const startIndex = matchResult.outputMatch.outputLines.findIndex((l) => l.includes(regexMatch)) + 1;
      const results = matchResult.outputMatch.outputLines.map((r) => r.trim());
      for (let i = startIndex; i < results.length; i++) {
        const fixedCommand = results[i];
        if (fixedCommand) {
          actions.push({
            id: "Git Similar",
            type: TerminalQuickFixType.TerminalCommand,
            terminalCommand: matchResult.commandLine.replace(/git\s+[^\s]+/, () => `git ${fixedCommand}`),
            shouldExecute: true,
            source: "builtin" /* Builtin */
          });
        }
      }
      return actions;
    }
  };
}
function gitFastForwardPull() {
  return {
    id: "Git Fast Forward Pull",
    type: "internal",
    commandLineMatcher: GitCommandLineRegex,
    outputMatcher: {
      lineMatcher: GitFastForwardPullOutputRegex,
      anchor: "bottom",
      offset: 0,
      length: 8
    },
    commandExitResult: "success",
    getQuickFixes: (matchResult) => {
      return {
        type: TerminalQuickFixType.TerminalCommand,
        id: "Git Fast Forward Pull",
        terminalCommand: `git pull`,
        shouldExecute: true,
        source: "builtin" /* Builtin */
      };
    }
  };
}
function gitTwoDashes() {
  return {
    id: "Git Two Dashes",
    type: "internal",
    commandLineMatcher: GitCommandLineRegex,
    outputMatcher: {
      lineMatcher: GitTwoDashesRegex,
      anchor: "bottom",
      offset: 0,
      length: 2
    },
    commandExitResult: "error",
    getQuickFixes: (matchResult) => {
      const problemArg = matchResult?.outputMatch?.regexMatch?.[1];
      if (!problemArg) {
        return;
      }
      return {
        type: TerminalQuickFixType.TerminalCommand,
        id: "Git Two Dashes",
        terminalCommand: matchResult.commandLine.replace(` -${problemArg}`, () => ` --${problemArg}`),
        shouldExecute: true,
        source: "builtin" /* Builtin */
      };
    }
  };
}
function freePort(runCallback) {
  return {
    id: "Free Port",
    type: "internal",
    commandLineMatcher: /.+/,
    outputMatcher: {
      lineMatcher: FreePortOutputRegex,
      anchor: "bottom",
      offset: 0,
      length: 30
    },
    commandExitResult: "error",
    getQuickFixes: (matchResult) => {
      const port = matchResult?.outputMatch?.regexMatch?.groups?.portNumber;
      if (!port) {
        return;
      }
      const label = localize("terminal.freePort", "Free port {0}", port);
      return {
        type: TerminalQuickFixType.Port,
        class: void 0,
        tooltip: label,
        id: "Free Port",
        label,
        enabled: true,
        source: "builtin" /* Builtin */,
        run: () => runCallback(port, matchResult.commandLine)
      };
    }
  };
}
function gitPushSetUpstream() {
  return {
    id: "Git Push Set Upstream",
    type: "internal",
    commandLineMatcher: GitPushCommandLineRegex,
    /**
    			Example output on Windows:
    			8: PS C:\Users\merogge\repos\xterm.js> git push
    			7: fatal: The current branch sdjfskdjfdslkjf has no upstream branch.
    			6: To push the current branch and set the remote as upstream, use
    			5:
    			4:	git push --set-upstream origin sdjfskdjfdslkjf
    			3:
    			2: To have this happen automatically for branches without a tracking
    			1: upstream, see 'push.autoSetupRemote' in 'git help config'.
    			0:
    
    			Example output on macOS:
    			5: meganrogge@Megans-MacBook-Pro xterm.js % git push
    			4: fatal: The current branch merogge/asjdkfsjdkfsdjf has no upstream branch.
    			3: To push the current branch and set the remote as upstream, use
    			2:
    			1:	git push --set-upstream origin merogge/asjdkfsjdkfsdjf
    			0:
    		 */
    outputMatcher: {
      lineMatcher: GitPushOutputRegex,
      anchor: "bottom",
      offset: 0,
      length: 8
    },
    commandExitResult: "error",
    getQuickFixes: (matchResult) => {
      const matches = matchResult.outputMatch;
      const commandToRun = "git push --set-upstream origin ${group:branchName}";
      if (!matches) {
        return;
      }
      const groups = matches.regexMatch.groups;
      if (!groups) {
        return;
      }
      const actions = [];
      let fixedCommand = commandToRun;
      for (const [key, value] of Object.entries(groups)) {
        const varToResolve = `\${group:${key}}`;
        if (!commandToRun.includes(varToResolve)) {
          return [];
        }
        fixedCommand = fixedCommand.replaceAll(varToResolve, () => value);
      }
      if (fixedCommand) {
        actions.push({
          type: TerminalQuickFixType.TerminalCommand,
          id: "Git Push Set Upstream",
          terminalCommand: fixedCommand,
          shouldExecute: true,
          source: "builtin" /* Builtin */
        });
        return actions;
      }
      return;
    }
  };
}
function gitCreatePr() {
  return {
    id: "Git Create Pr",
    type: "internal",
    commandLineMatcher: GitPushCommandLineRegex,
    // Example output:
    // ...
    // 10: remote:
    // 9:  remote: Create a pull request for 'my_branch' on GitHub by visiting:
    // 8:  remote:      https://github.com/microsoft/vscode/pull/new/my_branch
    // 7:  remote:
    // 6:  remote: GitHub found x vulnerabilities on microsoft/vscode's default branch (...). To find out more, visit:
    // 5:  remote:      https://github.com/microsoft/vscode/security/dependabot
    // 4:  remote:
    // 3:  To https://github.com/microsoft/vscode
    // 2:  * [new branch]              my_branch -> my_branch
    // 1:  Branch 'my_branch' set up to track remote branch 'my_branch' from 'origin'.
    // 0:
    outputMatcher: {
      lineMatcher: GitCreatePrOutputRegex,
      anchor: "bottom",
      offset: 4,
      // ~6 should only be needed here for security alerts, but the git provider can customize
      // the text, so use 12 to be safe.
      length: 12
    },
    commandExitResult: "success",
    getQuickFixes: (matchResult) => {
      const link = matchResult?.outputMatch?.regexMatch?.groups?.link?.trimEnd();
      if (!link) {
        return;
      }
      const label = localize("terminal.createPR", "Create PR {0}", link);
      return {
        id: "Git Create Pr",
        label,
        enabled: true,
        type: TerminalQuickFixType.Opener,
        uri: URI.parse(link),
        source: "builtin" /* Builtin */
      };
    }
  };
}
function pwshGeneralError() {
  return {
    id: "Pwsh General Error",
    type: "internal",
    commandLineMatcher: /.+/,
    outputMatcher: {
      lineMatcher: PwshGeneralErrorOutputRegex,
      anchor: "bottom",
      offset: 0,
      length: 10
    },
    commandExitResult: "error",
    getQuickFixes: (matchResult) => {
      const lines = matchResult.outputMatch?.regexMatch.input?.split("\n");
      if (!lines) {
        return;
      }
      let i = 0;
      let inFeedbackProvider = false;
      for (; i < lines.length; i++) {
        if (lines[i].match(PwshGeneralErrorOutputRegex)) {
          inFeedbackProvider = true;
          break;
        }
      }
      if (!inFeedbackProvider) {
        return;
      }
      const suggestions = lines[i + 1].match(/The most similar commands are: (?<values>.+)./)?.groups?.values?.split(", ");
      if (!suggestions) {
        return;
      }
      const result = [];
      for (const suggestion of suggestions) {
        result.push({
          id: "Pwsh General Error",
          type: TerminalQuickFixType.TerminalCommand,
          terminalCommand: suggestion,
          source: "builtin" /* Builtin */
        });
      }
      return result;
    }
  };
}
function pwshUnixCommandNotFoundError() {
  return {
    id: "Unix Command Not Found",
    type: "internal",
    commandLineMatcher: /.+/,
    outputMatcher: {
      lineMatcher: PwshUnixCommandNotFoundErrorOutputRegex,
      anchor: "bottom",
      offset: 0,
      length: 10
    },
    commandExitResult: "error",
    getQuickFixes: (matchResult) => {
      const lines = matchResult.outputMatch?.regexMatch.input?.split("\n");
      if (!lines) {
        return;
      }
      let i = 0;
      let inFeedbackProvider = false;
      for (; i < lines.length; i++) {
        if (lines[i].match(PwshUnixCommandNotFoundErrorOutputRegex)) {
          inFeedbackProvider = true;
          break;
        }
      }
      if (!inFeedbackProvider) {
        return;
      }
      const result = [];
      let inSuggestions = false;
      for (; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.length === 0) {
          break;
        }
        const installCommand = line.match(/You also have .+ installed, you can run '(?<command>.+)' instead./)?.groups?.command;
        if (installCommand) {
          result.push({
            id: "Pwsh Unix Command Not Found Error",
            type: TerminalQuickFixType.TerminalCommand,
            terminalCommand: installCommand,
            source: "builtin" /* Builtin */
          });
          inSuggestions = false;
          continue;
        }
        if (line.match(/Command '.+' not found, but can be installed with:/)) {
          inSuggestions = true;
          continue;
        }
        if (inSuggestions) {
          result.push({
            id: "Pwsh Unix Command Not Found Error",
            type: TerminalQuickFixType.TerminalCommand,
            terminalCommand: line.trim(),
            source: "builtin" /* Builtin */
          });
        }
      }
      return result;
    }
  };
}
export {
  FreePortOutputRegex,
  GitCommandLineRegex,
  GitCreatePrOutputRegex,
  GitFastForwardPullOutputRegex,
  GitPushCommandLineRegex,
  GitPushOutputRegex,
  GitSimilarOutputRegex,
  GitTwoDashesRegex,
  PwshGeneralErrorOutputRegex,
  PwshUnixCommandNotFoundErrorOutputRegex,
  QuickFixSource,
  freePort,
  gitCreatePr,
  gitFastForwardPull,
  gitPushSetUpstream,
  gitSimilar,
  gitTwoDashes,
  pwshGeneralError,
  pwshUnixCommandNotFoundError
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvcXVpY2tGaXgvYnJvd3Nlci90ZXJtaW5hbFF1aWNrRml4QnVpbHRpbkFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsUXVpY2tGaXhJbnRlcm5hbE9wdGlvbnMsIElUZXJtaW5hbENvbW1hbmRNYXRjaFJlc3VsdCwgSVRlcm1pbmFsUXVpY2tGaXhUZXJtaW5hbENvbW1hbmRBY3Rpb24sIFRlcm1pbmFsUXVpY2tGaXhBY3Rpb25JbnRlcm5hbCwgVGVybWluYWxRdWlja0ZpeFR5cGUgfSBmcm9tICcuL3F1aWNrRml4LmpzJztcblxuZXhwb3J0IGNvbnN0IEdpdENvbW1hbmRMaW5lUmVnZXggPSAvZ2l0LztcbmV4cG9ydCBjb25zdCBHaXRGYXN0Rm9yd2FyZFB1bGxPdXRwdXRSZWdleCA9IC9hbmQgY2FuIGJlIGZhc3QtZm9yd2FyZGVkLztcbmV4cG9ydCBjb25zdCBHaXRQdXNoQ29tbWFuZExpbmVSZWdleCA9IC9naXRcXHMrcHVzaC87XG5leHBvcnQgY29uc3QgR2l0VHdvRGFzaGVzUmVnZXggPSAvZXJyb3I6IGRpZCB5b3UgbWVhbiBgLS0oLispYCBcXCh3aXRoIHR3byBkYXNoZXNcXClcXD8vO1xuZXhwb3J0IGNvbnN0IEdpdFNpbWlsYXJPdXRwdXRSZWdleCA9IC8oPzoobW9zdCBzaW1pbGFyIGNvbW1hbmRzPyAoaXN8YXJlKSkpLztcbmV4cG9ydCBjb25zdCBGcmVlUG9ydE91dHB1dFJlZ2V4ID0gLyg/OmFkZHJlc3MgYWxyZWFkeSBpbiB1c2UgKD86MFxcLjBcXC4wXFwuMHwxMjdcXC4wXFwuMFxcLjF8bG9jYWxob3N0fDo6KTp8VW5hYmxlIHRvIGJpbmQgW14gXSo6fGNhbid0IGxpc3RlbiBvbiBwb3J0IHxsaXN0ZW4gRUFERFJJTlVTRSBbXiBdKjopKD88cG9ydE51bWJlcj5cXGR7NCw1fSkvO1xuZXhwb3J0IGNvbnN0IEdpdFB1c2hPdXRwdXRSZWdleCA9IC9naXQgcHVzaCAtLXNldC11cHN0cmVhbSBvcmlnaW4gKD88YnJhbmNoTmFtZT5bXlxcc10rKS87XG4vLyBUaGUgcHJldmlvdXMgbGluZSBzdGFydHMgd2l0aCBcIkNyZWF0ZSBhIHB1bGwgcmVxdWVzdCBmb3IgXFwnKFteXFxzXSspXFwnIG9uIEdpdEh1YiBieSB2aXNpdGluZzpcXHMqXCJcbi8vIGl0J3Mgc2FmZSB0byBhc3N1bWUgaXQncyBhIGdpdGh1YiBwdWxsIHJlcXVlc3QgaWYgdGhlIFVSTCBpbmNsdWRlcyBgL3B1bGwvYFxuZXhwb3J0IGNvbnN0IEdpdENyZWF0ZVByT3V0cHV0UmVnZXggPSAvcmVtb3RlOlxccyooPzxsaW5rPmh0dHBzOlxcL1xcL2dpdGh1YlxcLmNvbVxcLy4rXFwvLitcXC9wdWxsXFwvbmV3XFwvLispLztcbmV4cG9ydCBjb25zdCBQd3NoR2VuZXJhbEVycm9yT3V0cHV0UmVnZXggPSAvU3VnZ2VzdGlvbiBcXFtHZW5lcmFsXFxdOi87XG5leHBvcnQgY29uc3QgUHdzaFVuaXhDb21tYW5kTm90Rm91bmRFcnJvck91dHB1dFJlZ2V4ID0gL1N1Z2dlc3Rpb24gXFxbY21kLW5vdC1mb3VuZFxcXTovO1xuXG5leHBvcnQgY29uc3QgZW51bSBRdWlja0ZpeFNvdXJjZSB7XG5cdEJ1aWx0aW4gPSAnYnVpbHRpbidcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdpdFNpbWlsYXIoKTogSVRlcm1pbmFsUXVpY2tGaXhJbnRlcm5hbE9wdGlvbnMge1xuXHRyZXR1cm4ge1xuXHRcdGlkOiAnR2l0IFNpbWlsYXInLFxuXHRcdHR5cGU6ICdpbnRlcm5hbCcsXG5cdFx0Y29tbWFuZExpbmVNYXRjaGVyOiBHaXRDb21tYW5kTGluZVJlZ2V4LFxuXHRcdG91dHB1dE1hdGNoZXI6IHtcblx0XHRcdGxpbmVNYXRjaGVyOiBHaXRTaW1pbGFyT3V0cHV0UmVnZXgsXG5cdFx0XHRhbmNob3I6ICdib3R0b20nLFxuXHRcdFx0b2Zmc2V0OiAwLFxuXHRcdFx0bGVuZ3RoOiAxMFxuXHRcdH0sXG5cdFx0Y29tbWFuZEV4aXRSZXN1bHQ6ICdlcnJvcicsXG5cdFx0Z2V0UXVpY2tGaXhlczogKG1hdGNoUmVzdWx0OiBJVGVybWluYWxDb21tYW5kTWF0Y2hSZXN1bHQpID0+IHtcblx0XHRcdGNvbnN0IHJlZ2V4TWF0Y2ggPSBtYXRjaFJlc3VsdC5vdXRwdXRNYXRjaD8ucmVnZXhNYXRjaFswXTtcblx0XHRcdGlmICghcmVnZXhNYXRjaCB8fCAhbWF0Y2hSZXN1bHQub3V0cHV0TWF0Y2gpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYWN0aW9uczogVGVybWluYWxRdWlja0ZpeEFjdGlvbkludGVybmFsW10gPSBbXTtcblx0XHRcdGNvbnN0IHN0YXJ0SW5kZXggPSBtYXRjaFJlc3VsdC5vdXRwdXRNYXRjaC5vdXRwdXRMaW5lcy5maW5kSW5kZXgobCA9PiBsLmluY2x1ZGVzKHJlZ2V4TWF0Y2gpKSArIDE7XG5cdFx0XHRjb25zdCByZXN1bHRzID0gbWF0Y2hSZXN1bHQub3V0cHV0TWF0Y2gub3V0cHV0TGluZXMubWFwKHIgPT4gci50cmltKCkpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPCByZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGZpeGVkQ29tbWFuZCA9IHJlc3VsdHNbaV07XG5cdFx0XHRcdGlmIChmaXhlZENvbW1hbmQpIHtcblx0XHRcdFx0XHRhY3Rpb25zLnB1c2goe1xuXHRcdFx0XHRcdFx0aWQ6ICdHaXQgU2ltaWxhcicsXG5cdFx0XHRcdFx0XHR0eXBlOiBUZXJtaW5hbFF1aWNrRml4VHlwZS5UZXJtaW5hbENvbW1hbmQsXG5cdFx0XHRcdFx0XHR0ZXJtaW5hbENvbW1hbmQ6IG1hdGNoUmVzdWx0LmNvbW1hbmRMaW5lLnJlcGxhY2UoL2dpdFxccytbXlxcc10rLywgKCkgPT4gYGdpdCAke2ZpeGVkQ29tbWFuZH1gKSxcblx0XHRcdFx0XHRcdHNob3VsZEV4ZWN1dGU6IHRydWUsXG5cdFx0XHRcdFx0XHRzb3VyY2U6IFF1aWNrRml4U291cmNlLkJ1aWx0aW5cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGFjdGlvbnM7XG5cdFx0fVxuXHR9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2l0RmFzdEZvcndhcmRQdWxsKCk6IElUZXJtaW5hbFF1aWNrRml4SW50ZXJuYWxPcHRpb25zIHtcblx0cmV0dXJuIHtcblx0XHRpZDogJ0dpdCBGYXN0IEZvcndhcmQgUHVsbCcsXG5cdFx0dHlwZTogJ2ludGVybmFsJyxcblx0XHRjb21tYW5kTGluZU1hdGNoZXI6IEdpdENvbW1hbmRMaW5lUmVnZXgsXG5cdFx0b3V0cHV0TWF0Y2hlcjoge1xuXHRcdFx0bGluZU1hdGNoZXI6IEdpdEZhc3RGb3J3YXJkUHVsbE91dHB1dFJlZ2V4LFxuXHRcdFx0YW5jaG9yOiAnYm90dG9tJyxcblx0XHRcdG9mZnNldDogMCxcblx0XHRcdGxlbmd0aDogOFxuXHRcdH0sXG5cdFx0Y29tbWFuZEV4aXRSZXN1bHQ6ICdzdWNjZXNzJyxcblx0XHRnZXRRdWlja0ZpeGVzOiAobWF0Y2hSZXN1bHQ6IElUZXJtaW5hbENvbW1hbmRNYXRjaFJlc3VsdCkgPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dHlwZTogVGVybWluYWxRdWlja0ZpeFR5cGUuVGVybWluYWxDb21tYW5kLFxuXHRcdFx0XHRpZDogJ0dpdCBGYXN0IEZvcndhcmQgUHVsbCcsXG5cdFx0XHRcdHRlcm1pbmFsQ29tbWFuZDogYGdpdCBwdWxsYCxcblx0XHRcdFx0c2hvdWxkRXhlY3V0ZTogdHJ1ZSxcblx0XHRcdFx0c291cmNlOiBRdWlja0ZpeFNvdXJjZS5CdWlsdGluXG5cdFx0XHR9O1xuXHRcdH1cblx0fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdpdFR3b0Rhc2hlcygpOiBJVGVybWluYWxRdWlja0ZpeEludGVybmFsT3B0aW9ucyB7XG5cdHJldHVybiB7XG5cdFx0aWQ6ICdHaXQgVHdvIERhc2hlcycsXG5cdFx0dHlwZTogJ2ludGVybmFsJyxcblx0XHRjb21tYW5kTGluZU1hdGNoZXI6IEdpdENvbW1hbmRMaW5lUmVnZXgsXG5cdFx0b3V0cHV0TWF0Y2hlcjoge1xuXHRcdFx0bGluZU1hdGNoZXI6IEdpdFR3b0Rhc2hlc1JlZ2V4LFxuXHRcdFx0YW5jaG9yOiAnYm90dG9tJyxcblx0XHRcdG9mZnNldDogMCxcblx0XHRcdGxlbmd0aDogMlxuXHRcdH0sXG5cdFx0Y29tbWFuZEV4aXRSZXN1bHQ6ICdlcnJvcicsXG5cdFx0Z2V0UXVpY2tGaXhlczogKG1hdGNoUmVzdWx0OiBJVGVybWluYWxDb21tYW5kTWF0Y2hSZXN1bHQpID0+IHtcblx0XHRcdGNvbnN0IHByb2JsZW1BcmcgPSBtYXRjaFJlc3VsdD8ub3V0cHV0TWF0Y2g/LnJlZ2V4TWF0Y2g/LlsxXTtcblx0XHRcdGlmICghcHJvYmxlbUFyZykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0eXBlOiBUZXJtaW5hbFF1aWNrRml4VHlwZS5UZXJtaW5hbENvbW1hbmQsXG5cdFx0XHRcdGlkOiAnR2l0IFR3byBEYXNoZXMnLFxuXHRcdFx0XHR0ZXJtaW5hbENvbW1hbmQ6IG1hdGNoUmVzdWx0LmNvbW1hbmRMaW5lLnJlcGxhY2UoYCAtJHtwcm9ibGVtQXJnfWAsICgpID0+IGAgLS0ke3Byb2JsZW1Bcmd9YCksXG5cdFx0XHRcdHNob3VsZEV4ZWN1dGU6IHRydWUsXG5cdFx0XHRcdHNvdXJjZTogUXVpY2tGaXhTb3VyY2UuQnVpbHRpblxuXHRcdFx0fTtcblx0XHR9XG5cdH07XG59XG5leHBvcnQgZnVuY3Rpb24gZnJlZVBvcnQocnVuQ2FsbGJhY2s6IChwb3J0OiBzdHJpbmcsIGNvbW1hbmRMaW5lOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD4pOiBJVGVybWluYWxRdWlja0ZpeEludGVybmFsT3B0aW9ucyB7XG5cdHJldHVybiB7XG5cdFx0aWQ6ICdGcmVlIFBvcnQnLFxuXHRcdHR5cGU6ICdpbnRlcm5hbCcsXG5cdFx0Y29tbWFuZExpbmVNYXRjaGVyOiAvLisvLFxuXHRcdG91dHB1dE1hdGNoZXI6IHtcblx0XHRcdGxpbmVNYXRjaGVyOiBGcmVlUG9ydE91dHB1dFJlZ2V4LFxuXHRcdFx0YW5jaG9yOiAnYm90dG9tJyxcblx0XHRcdG9mZnNldDogMCxcblx0XHRcdGxlbmd0aDogMzBcblx0XHR9LFxuXHRcdGNvbW1hbmRFeGl0UmVzdWx0OiAnZXJyb3InLFxuXHRcdGdldFF1aWNrRml4ZXM6IChtYXRjaFJlc3VsdDogSVRlcm1pbmFsQ29tbWFuZE1hdGNoUmVzdWx0KSA9PiB7XG5cdFx0XHRjb25zdCBwb3J0ID0gbWF0Y2hSZXN1bHQ/Lm91dHB1dE1hdGNoPy5yZWdleE1hdGNoPy5ncm91cHM/LnBvcnROdW1iZXI7XG5cdFx0XHRpZiAoIXBvcnQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbGFiZWwgPSBsb2NhbGl6ZShcInRlcm1pbmFsLmZyZWVQb3J0XCIsIFwiRnJlZSBwb3J0IHswfVwiLCBwb3J0KTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHR5cGU6IFRlcm1pbmFsUXVpY2tGaXhUeXBlLlBvcnQsXG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdHRvb2x0aXA6IGxhYmVsLFxuXHRcdFx0XHRpZDogJ0ZyZWUgUG9ydCcsXG5cdFx0XHRcdGxhYmVsLFxuXHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRzb3VyY2U6IFF1aWNrRml4U291cmNlLkJ1aWx0aW4sXG5cdFx0XHRcdHJ1bjogKCkgPT4gcnVuQ2FsbGJhY2socG9ydCwgbWF0Y2hSZXN1bHQuY29tbWFuZExpbmUpXG5cdFx0XHR9O1xuXHRcdH1cblx0fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdpdFB1c2hTZXRVcHN0cmVhbSgpOiBJVGVybWluYWxRdWlja0ZpeEludGVybmFsT3B0aW9ucyB7XG5cdHJldHVybiB7XG5cdFx0aWQ6ICdHaXQgUHVzaCBTZXQgVXBzdHJlYW0nLFxuXHRcdHR5cGU6ICdpbnRlcm5hbCcsXG5cdFx0Y29tbWFuZExpbmVNYXRjaGVyOiBHaXRQdXNoQ29tbWFuZExpbmVSZWdleCxcblx0XHQvKipcblx0XHRcdEV4YW1wbGUgb3V0cHV0IG9uIFdpbmRvd3M6XG5cdFx0XHQ4OiBQUyBDOlxcVXNlcnNcXG1lcm9nZ2VcXHJlcG9zXFx4dGVybS5qcz4gZ2l0IHB1c2hcblx0XHRcdDc6IGZhdGFsOiBUaGUgY3VycmVudCBicmFuY2ggc2RqZnNrZGpmZHNsa2pmIGhhcyBubyB1cHN0cmVhbSBicmFuY2guXG5cdFx0XHQ2OiBUbyBwdXNoIHRoZSBjdXJyZW50IGJyYW5jaCBhbmQgc2V0IHRoZSByZW1vdGUgYXMgdXBzdHJlYW0sIHVzZVxuXHRcdFx0NTpcblx0XHRcdDQ6XHRnaXQgcHVzaCAtLXNldC11cHN0cmVhbSBvcmlnaW4gc2RqZnNrZGpmZHNsa2pmXG5cdFx0XHQzOlxuXHRcdFx0MjogVG8gaGF2ZSB0aGlzIGhhcHBlbiBhdXRvbWF0aWNhbGx5IGZvciBicmFuY2hlcyB3aXRob3V0IGEgdHJhY2tpbmdcblx0XHRcdDE6IHVwc3RyZWFtLCBzZWUgJ3B1c2guYXV0b1NldHVwUmVtb3RlJyBpbiAnZ2l0IGhlbHAgY29uZmlnJy5cblx0XHRcdDA6XG5cblx0XHRcdEV4YW1wbGUgb3V0cHV0IG9uIG1hY09TOlxuXHRcdFx0NTogbWVnYW5yb2dnZUBNZWdhbnMtTWFjQm9vay1Qcm8geHRlcm0uanMgJSBnaXQgcHVzaFxuXHRcdFx0NDogZmF0YWw6IFRoZSBjdXJyZW50IGJyYW5jaCBtZXJvZ2dlL2FzamRrZnNqZGtmc2RqZiBoYXMgbm8gdXBzdHJlYW0gYnJhbmNoLlxuXHRcdFx0MzogVG8gcHVzaCB0aGUgY3VycmVudCBicmFuY2ggYW5kIHNldCB0aGUgcmVtb3RlIGFzIHVwc3RyZWFtLCB1c2Vcblx0XHRcdDI6XG5cdFx0XHQxOlx0Z2l0IHB1c2ggLS1zZXQtdXBzdHJlYW0gb3JpZ2luIG1lcm9nZ2UvYXNqZGtmc2pka2ZzZGpmXG5cdFx0XHQwOlxuXHRcdCAqL1xuXHRcdG91dHB1dE1hdGNoZXI6IHtcblx0XHRcdGxpbmVNYXRjaGVyOiBHaXRQdXNoT3V0cHV0UmVnZXgsXG5cdFx0XHRhbmNob3I6ICdib3R0b20nLFxuXHRcdFx0b2Zmc2V0OiAwLFxuXHRcdFx0bGVuZ3RoOiA4XG5cdFx0fSxcblx0XHRjb21tYW5kRXhpdFJlc3VsdDogJ2Vycm9yJyxcblx0XHRnZXRRdWlja0ZpeGVzOiAobWF0Y2hSZXN1bHQ6IElUZXJtaW5hbENvbW1hbmRNYXRjaFJlc3VsdCkgPT4ge1xuXHRcdFx0Y29uc3QgbWF0Y2hlcyA9IG1hdGNoUmVzdWx0Lm91dHB1dE1hdGNoO1xuXHRcdFx0Y29uc3QgY29tbWFuZFRvUnVuID0gJ2dpdCBwdXNoIC0tc2V0LXVwc3RyZWFtIG9yaWdpbiAke2dyb3VwOmJyYW5jaE5hbWV9Jztcblx0XHRcdGlmICghbWF0Y2hlcykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBncm91cHMgPSBtYXRjaGVzLnJlZ2V4TWF0Y2guZ3JvdXBzO1xuXHRcdFx0aWYgKCFncm91cHMpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYWN0aW9uczogVGVybWluYWxRdWlja0ZpeEFjdGlvbkludGVybmFsW10gPSBbXTtcblx0XHRcdGxldCBmaXhlZENvbW1hbmQgPSBjb21tYW5kVG9SdW47XG5cdFx0XHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhncm91cHMpKSB7XG5cdFx0XHRcdGNvbnN0IHZhclRvUmVzb2x2ZSA9ICcke2dyb3VwOicgKyBgJHtrZXl9YCArICd9Jztcblx0XHRcdFx0aWYgKCFjb21tYW5kVG9SdW4uaW5jbHVkZXModmFyVG9SZXNvbHZlKSkge1xuXHRcdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRmaXhlZENvbW1hbmQgPSBmaXhlZENvbW1hbmQucmVwbGFjZUFsbCh2YXJUb1Jlc29sdmUsICgpID0+IHZhbHVlKTtcblx0XHRcdH1cblx0XHRcdGlmIChmaXhlZENvbW1hbmQpIHtcblx0XHRcdFx0YWN0aW9ucy5wdXNoKHtcblx0XHRcdFx0XHR0eXBlOiBUZXJtaW5hbFF1aWNrRml4VHlwZS5UZXJtaW5hbENvbW1hbmQsXG5cdFx0XHRcdFx0aWQ6ICdHaXQgUHVzaCBTZXQgVXBzdHJlYW0nLFxuXHRcdFx0XHRcdHRlcm1pbmFsQ29tbWFuZDogZml4ZWRDb21tYW5kLFxuXHRcdFx0XHRcdHNob3VsZEV4ZWN1dGU6IHRydWUsXG5cdFx0XHRcdFx0c291cmNlOiBRdWlja0ZpeFNvdXJjZS5CdWlsdGluXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm4gYWN0aW9ucztcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnaXRDcmVhdGVQcigpOiBJVGVybWluYWxRdWlja0ZpeEludGVybmFsT3B0aW9ucyB7XG5cdHJldHVybiB7XG5cdFx0aWQ6ICdHaXQgQ3JlYXRlIFByJyxcblx0XHR0eXBlOiAnaW50ZXJuYWwnLFxuXHRcdGNvbW1hbmRMaW5lTWF0Y2hlcjogR2l0UHVzaENvbW1hbmRMaW5lUmVnZXgsXG5cdFx0Ly8gRXhhbXBsZSBvdXRwdXQ6XG5cdFx0Ly8gLi4uXG5cdFx0Ly8gMTA6IHJlbW90ZTpcblx0XHQvLyA5OiAgcmVtb3RlOiBDcmVhdGUgYSBwdWxsIHJlcXVlc3QgZm9yICdteV9icmFuY2gnIG9uIEdpdEh1YiBieSB2aXNpdGluZzpcblx0XHQvLyA4OiAgcmVtb3RlOiAgICAgIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL3B1bGwvbmV3L215X2JyYW5jaFxuXHRcdC8vIDc6ICByZW1vdGU6XG5cdFx0Ly8gNjogIHJlbW90ZTogR2l0SHViIGZvdW5kIHggdnVsbmVyYWJpbGl0aWVzIG9uIG1pY3Jvc29mdC92c2NvZGUncyBkZWZhdWx0IGJyYW5jaCAoLi4uKS4gVG8gZmluZCBvdXQgbW9yZSwgdmlzaXQ6XG5cdFx0Ly8gNTogIHJlbW90ZTogICAgICBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9zZWN1cml0eS9kZXBlbmRhYm90XG5cdFx0Ly8gNDogIHJlbW90ZTpcblx0XHQvLyAzOiAgVG8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGVcblx0XHQvLyAyOiAgKiBbbmV3IGJyYW5jaF0gICAgICAgICAgICAgIG15X2JyYW5jaCAtPiBteV9icmFuY2hcblx0XHQvLyAxOiAgQnJhbmNoICdteV9icmFuY2gnIHNldCB1cCB0byB0cmFjayByZW1vdGUgYnJhbmNoICdteV9icmFuY2gnIGZyb20gJ29yaWdpbicuXG5cdFx0Ly8gMDpcblx0XHRvdXRwdXRNYXRjaGVyOiB7XG5cdFx0XHRsaW5lTWF0Y2hlcjogR2l0Q3JlYXRlUHJPdXRwdXRSZWdleCxcblx0XHRcdGFuY2hvcjogJ2JvdHRvbScsXG5cdFx0XHRvZmZzZXQ6IDQsXG5cdFx0XHQvLyB+NiBzaG91bGQgb25seSBiZSBuZWVkZWQgaGVyZSBmb3Igc2VjdXJpdHkgYWxlcnRzLCBidXQgdGhlIGdpdCBwcm92aWRlciBjYW4gY3VzdG9taXplXG5cdFx0XHQvLyB0aGUgdGV4dCwgc28gdXNlIDEyIHRvIGJlIHNhZmUuXG5cdFx0XHRsZW5ndGg6IDEyXG5cdFx0fSxcblx0XHRjb21tYW5kRXhpdFJlc3VsdDogJ3N1Y2Nlc3MnLFxuXHRcdGdldFF1aWNrRml4ZXM6IChtYXRjaFJlc3VsdDogSVRlcm1pbmFsQ29tbWFuZE1hdGNoUmVzdWx0KSA9PiB7XG5cdFx0XHRjb25zdCBsaW5rID0gbWF0Y2hSZXN1bHQ/Lm91dHB1dE1hdGNoPy5yZWdleE1hdGNoPy5ncm91cHM/Lmxpbms/LnRyaW1FbmQoKTtcblx0XHRcdGlmICghbGluaykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBsYWJlbCA9IGxvY2FsaXplKFwidGVybWluYWwuY3JlYXRlUFJcIiwgXCJDcmVhdGUgUFIgezB9XCIsIGxpbmspO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aWQ6ICdHaXQgQ3JlYXRlIFByJyxcblx0XHRcdFx0bGFiZWwsXG5cdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdHR5cGU6IFRlcm1pbmFsUXVpY2tGaXhUeXBlLk9wZW5lcixcblx0XHRcdFx0dXJpOiBVUkkucGFyc2UobGluayksXG5cdFx0XHRcdHNvdXJjZTogUXVpY2tGaXhTb3VyY2UuQnVpbHRpblxuXHRcdFx0fTtcblx0XHR9XG5cdH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwd3NoR2VuZXJhbEVycm9yKCk6IElUZXJtaW5hbFF1aWNrRml4SW50ZXJuYWxPcHRpb25zIHtcblx0cmV0dXJuIHtcblx0XHRpZDogJ1B3c2ggR2VuZXJhbCBFcnJvcicsXG5cdFx0dHlwZTogJ2ludGVybmFsJyxcblx0XHRjb21tYW5kTGluZU1hdGNoZXI6IC8uKy8sXG5cdFx0b3V0cHV0TWF0Y2hlcjoge1xuXHRcdFx0bGluZU1hdGNoZXI6IFB3c2hHZW5lcmFsRXJyb3JPdXRwdXRSZWdleCxcblx0XHRcdGFuY2hvcjogJ2JvdHRvbScsXG5cdFx0XHRvZmZzZXQ6IDAsXG5cdFx0XHRsZW5ndGg6IDEwXG5cdFx0fSxcblx0XHRjb21tYW5kRXhpdFJlc3VsdDogJ2Vycm9yJyxcblx0XHRnZXRRdWlja0ZpeGVzOiAobWF0Y2hSZXN1bHQ6IElUZXJtaW5hbENvbW1hbmRNYXRjaFJlc3VsdCkgPT4ge1xuXHRcdFx0Y29uc3QgbGluZXMgPSBtYXRjaFJlc3VsdC5vdXRwdXRNYXRjaD8ucmVnZXhNYXRjaC5pbnB1dD8uc3BsaXQoJ1xcbicpO1xuXHRcdFx0aWYgKCFsaW5lcykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIEZpbmQgdGhlIHN0YXJ0XG5cdFx0XHRsZXQgaSA9IDA7XG5cdFx0XHRsZXQgaW5GZWVkYmFja1Byb3ZpZGVyID0gZmFsc2U7XG5cdFx0XHRmb3IgKDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmIChsaW5lc1tpXS5tYXRjaChQd3NoR2VuZXJhbEVycm9yT3V0cHV0UmVnZXgpKSB7XG5cdFx0XHRcdFx0aW5GZWVkYmFja1Byb3ZpZGVyID0gdHJ1ZTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCFpbkZlZWRiYWNrUHJvdmlkZXIpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzdWdnZXN0aW9ucyA9IGxpbmVzW2kgKyAxXS5tYXRjaCgvVGhlIG1vc3Qgc2ltaWxhciBjb21tYW5kcyBhcmU6ICg/PHZhbHVlcz4uKykuLyk/Lmdyb3Vwcz8udmFsdWVzPy5zcGxpdCgnLCAnKTtcblx0XHRcdGlmICghc3VnZ2VzdGlvbnMpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcmVzdWx0OiBJVGVybWluYWxRdWlja0ZpeFRlcm1pbmFsQ29tbWFuZEFjdGlvbltdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IHN1Z2dlc3Rpb24gb2Ygc3VnZ2VzdGlvbnMpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goe1xuXHRcdFx0XHRcdGlkOiAnUHdzaCBHZW5lcmFsIEVycm9yJyxcblx0XHRcdFx0XHR0eXBlOiBUZXJtaW5hbFF1aWNrRml4VHlwZS5UZXJtaW5hbENvbW1hbmQsXG5cdFx0XHRcdFx0dGVybWluYWxDb21tYW5kOiBzdWdnZXN0aW9uLFxuXHRcdFx0XHRcdHNvdXJjZTogUXVpY2tGaXhTb3VyY2UuQnVpbHRpblxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHR9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHdzaFVuaXhDb21tYW5kTm90Rm91bmRFcnJvcigpOiBJVGVybWluYWxRdWlja0ZpeEludGVybmFsT3B0aW9ucyB7XG5cdHJldHVybiB7XG5cdFx0aWQ6ICdVbml4IENvbW1hbmQgTm90IEZvdW5kJyxcblx0XHR0eXBlOiAnaW50ZXJuYWwnLFxuXHRcdGNvbW1hbmRMaW5lTWF0Y2hlcjogLy4rLyxcblx0XHRvdXRwdXRNYXRjaGVyOiB7XG5cdFx0XHRsaW5lTWF0Y2hlcjogUHdzaFVuaXhDb21tYW5kTm90Rm91bmRFcnJvck91dHB1dFJlZ2V4LFxuXHRcdFx0YW5jaG9yOiAnYm90dG9tJyxcblx0XHRcdG9mZnNldDogMCxcblx0XHRcdGxlbmd0aDogMTBcblx0XHR9LFxuXHRcdGNvbW1hbmRFeGl0UmVzdWx0OiAnZXJyb3InLFxuXHRcdGdldFF1aWNrRml4ZXM6IChtYXRjaFJlc3VsdDogSVRlcm1pbmFsQ29tbWFuZE1hdGNoUmVzdWx0KSA9PiB7XG5cdFx0XHRjb25zdCBsaW5lcyA9IG1hdGNoUmVzdWx0Lm91dHB1dE1hdGNoPy5yZWdleE1hdGNoLmlucHV0Py5zcGxpdCgnXFxuJyk7XG5cdFx0XHRpZiAoIWxpbmVzKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRmluZCB0aGUgc3RhcnRcblx0XHRcdGxldCBpID0gMDtcblx0XHRcdGxldCBpbkZlZWRiYWNrUHJvdmlkZXIgPSBmYWxzZTtcblx0XHRcdGZvciAoOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKGxpbmVzW2ldLm1hdGNoKFB3c2hVbml4Q29tbWFuZE5vdEZvdW5kRXJyb3JPdXRwdXRSZWdleCkpIHtcblx0XHRcdFx0XHRpbkZlZWRiYWNrUHJvdmlkZXIgPSB0cnVlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWluRmVlZGJhY2tQcm92aWRlcikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIEFsd2F5cyByZW1vdmUgdGhlIGZpcnN0IGVsZW1lbnQgYXMgaXQncyB0aGUgXCJTdWdnZXN0aW9uIFtjbWQtbm90LWZvdW5kXVwiXCIgbGluZVxuXHRcdFx0Y29uc3QgcmVzdWx0OiBJVGVybWluYWxRdWlja0ZpeFRlcm1pbmFsQ29tbWFuZEFjdGlvbltdID0gW107XG5cdFx0XHRsZXQgaW5TdWdnZXN0aW9ucyA9IGZhbHNlO1xuXHRcdFx0Zm9yICg7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBsaW5lID0gbGluZXNbaV0udHJpbSgpO1xuXHRcdFx0XHRpZiAobGluZS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBpbnN0YWxsQ29tbWFuZCA9IGxpbmUubWF0Y2goL1lvdSBhbHNvIGhhdmUgLisgaW5zdGFsbGVkLCB5b3UgY2FuIHJ1biAnKD88Y29tbWFuZD4uKyknIGluc3RlYWQuLyk/Lmdyb3Vwcz8uY29tbWFuZDtcblx0XHRcdFx0aWYgKGluc3RhbGxDb21tYW5kKSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2goe1xuXHRcdFx0XHRcdFx0aWQ6ICdQd3NoIFVuaXggQ29tbWFuZCBOb3QgRm91bmQgRXJyb3InLFxuXHRcdFx0XHRcdFx0dHlwZTogVGVybWluYWxRdWlja0ZpeFR5cGUuVGVybWluYWxDb21tYW5kLFxuXHRcdFx0XHRcdFx0dGVybWluYWxDb21tYW5kOiBpbnN0YWxsQ29tbWFuZCxcblx0XHRcdFx0XHRcdHNvdXJjZTogUXVpY2tGaXhTb3VyY2UuQnVpbHRpblxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGluU3VnZ2VzdGlvbnMgPSBmYWxzZTtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAobGluZS5tYXRjaCgvQ29tbWFuZCAnLisnIG5vdCBmb3VuZCwgYnV0IGNhbiBiZSBpbnN0YWxsZWQgd2l0aDovKSkge1xuXHRcdFx0XHRcdGluU3VnZ2VzdGlvbnMgPSB0cnVlO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChpblN1Z2dlc3Rpb25zKSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2goe1xuXHRcdFx0XHRcdFx0aWQ6ICdQd3NoIFVuaXggQ29tbWFuZCBOb3QgRm91bmQgRXJyb3InLFxuXHRcdFx0XHRcdFx0dHlwZTogVGVybWluYWxRdWlja0ZpeFR5cGUuVGVybWluYWxDb21tYW5kLFxuXHRcdFx0XHRcdFx0dGVybWluYWxDb21tYW5kOiBsaW5lLnRyaW0oKSxcblx0XHRcdFx0XHRcdHNvdXJjZTogUXVpY2tGaXhTb3VyY2UuQnVpbHRpblxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0fTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsV0FBVztBQUNwQixTQUFTLGdCQUFnQjtBQUN6QixTQUFnSiw0QkFBNEI7QUFFckssTUFBTSxzQkFBc0I7QUFDNUIsTUFBTSxnQ0FBZ0M7QUFDdEMsTUFBTSwwQkFBMEI7QUFDaEMsTUFBTSxvQkFBb0I7QUFDMUIsTUFBTSx3QkFBd0I7QUFDOUIsTUFBTSxzQkFBc0I7QUFDNUIsTUFBTSxxQkFBcUI7QUFHM0IsTUFBTSx5QkFB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
