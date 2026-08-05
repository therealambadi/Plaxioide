import { isLinux } from "../../../../base/common/platform.js";
import * as nls from "../../../../nls.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
import { defaultTerminalContribCommandsToSkipShell } from "../terminalContribExports.js";
const TERMINAL_VIEW_ID = "terminal";
const TERMINAL_CREATION_COMMANDS = ["workbench.action.terminal.toggleTerminal", "workbench.action.terminal.new", "workbench.action.togglePanel", "workbench.action.terminal.focus"];
const TERMINAL_CONFIG_SECTION = "terminal.integrated";
const DEFAULT_LETTER_SPACING = 0;
const MINIMUM_LETTER_SPACING = -5;
const DEFAULT_LINE_HEIGHT = isLinux ? 1.1 : 1;
const MINIMUM_FONT_WEIGHT = 1;
const MAXIMUM_FONT_WEIGHT = 1e3;
const DEFAULT_FONT_WEIGHT = "normal";
const DEFAULT_BOLD_FONT_WEIGHT = "bold";
const SUGGESTIONS_FONT_WEIGHT = ["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
const ITerminalProfileResolverService = createDecorator("terminalProfileResolverService");
const ShellIntegrationExitCode = 633;
const ITerminalProfileService = createDecorator("terminalProfileService");
const isTerminalProcessManager = (t) => typeof t.write === "function";
var ProcessState = /* @__PURE__ */ ((ProcessState2) => {
  ProcessState2[ProcessState2["Uninitialized"] = 1] = "Uninitialized";
  ProcessState2[ProcessState2["Launching"] = 2] = "Launching";
  ProcessState2[ProcessState2["Running"] = 3] = "Running";
  ProcessState2[ProcessState2["KilledDuringLaunch"] = 4] = "KilledDuringLaunch";
  ProcessState2[ProcessState2["KilledByUser"] = 5] = "KilledByUser";
  ProcessState2[ProcessState2["KilledByProcess"] = 6] = "KilledByProcess";
  return ProcessState2;
})(ProcessState || {});
const QUICK_LAUNCH_PROFILE_CHOICE = "workbench.action.terminal.profile.choice";
var TerminalCommandId = /* @__PURE__ */ ((TerminalCommandId2) => {
  TerminalCommandId2["Toggle"] = "workbench.action.terminal.toggleTerminal";
  TerminalCommandId2["Kill"] = "workbench.action.terminal.kill";
  TerminalCommandId2["KillViewOrEditor"] = "workbench.action.terminal.killViewOrEditor";
  TerminalCommandId2["KillEditor"] = "workbench.action.terminal.killEditor";
  TerminalCommandId2["KillActiveTab"] = "workbench.action.terminal.killActiveTab";
  TerminalCommandId2["KillAll"] = "workbench.action.terminal.killAll";
  TerminalCommandId2["QuickKill"] = "workbench.action.terminal.quickKill";
  TerminalCommandId2["ConfigureTerminalSettings"] = "workbench.action.terminal.openSettings";
  TerminalCommandId2["ShellIntegrationLearnMore"] = "workbench.action.terminal.learnMore";
  TerminalCommandId2["CopyLastCommand"] = "workbench.action.terminal.copyLastCommand";
  TerminalCommandId2["CopyLastCommandOutput"] = "workbench.action.terminal.copyLastCommandOutput";
  TerminalCommandId2["CopyLastCommandAndLastCommandOutput"] = "workbench.action.terminal.copyLastCommandAndLastCommandOutput";
  TerminalCommandId2["CopyAndClearSelection"] = "workbench.action.terminal.copyAndClearSelection";
  TerminalCommandId2["CopySelection"] = "workbench.action.terminal.copySelection";
  TerminalCommandId2["CopySelectionAsHtml"] = "workbench.action.terminal.copySelectionAsHtml";
  TerminalCommandId2["SelectAll"] = "workbench.action.terminal.selectAll";
  TerminalCommandId2["DeleteWordLeft"] = "workbench.action.terminal.deleteWordLeft";
  TerminalCommandId2["DeleteWordRight"] = "workbench.action.terminal.deleteWordRight";
  TerminalCommandId2["DeleteToLineStart"] = "workbench.action.terminal.deleteToLineStart";
  TerminalCommandId2["MoveToLineStart"] = "workbench.action.terminal.moveToLineStart";
  TerminalCommandId2["MoveToLineEnd"] = "workbench.action.terminal.moveToLineEnd";
  TerminalCommandId2["New"] = "workbench.action.terminal.new";
  TerminalCommandId2["NewWithCwd"] = "workbench.action.terminal.newWithCwd";
  TerminalCommandId2["NewLocal"] = "workbench.action.terminal.newLocal";
  TerminalCommandId2["NewInActiveWorkspace"] = "workbench.action.terminal.newInActiveWorkspace";
  TerminalCommandId2["NewWithProfile"] = "workbench.action.terminal.newWithProfile";
  TerminalCommandId2["Split"] = "workbench.action.terminal.split";
  TerminalCommandId2["SplitActiveTab"] = "workbench.action.terminal.splitActiveTab";
  TerminalCommandId2["SplitInActiveWorkspace"] = "workbench.action.terminal.splitInActiveWorkspace";
  TerminalCommandId2["Unsplit"] = "workbench.action.terminal.unsplit";
  TerminalCommandId2["JoinActiveTab"] = "workbench.action.terminal.joinActiveTab";
  TerminalCommandId2["Join"] = "workbench.action.terminal.join";
  TerminalCommandId2["Relaunch"] = "workbench.action.terminal.relaunch";
  TerminalCommandId2["FocusPreviousPane"] = "workbench.action.terminal.focusPreviousPane";
  TerminalCommandId2["CreateTerminalEditor"] = "workbench.action.createTerminalEditor";
  TerminalCommandId2["CreateTerminalEditorSameGroup"] = "workbench.action.createTerminalEditorSameGroup";
  TerminalCommandId2["CreateTerminalEditorSide"] = "workbench.action.createTerminalEditorSide";
  TerminalCommandId2["FocusTabs"] = "workbench.action.terminal.focusTabs";
  TerminalCommandId2["FocusNextPane"] = "workbench.action.terminal.focusNextPane";
  TerminalCommandId2["ResizePaneLeft"] = "workbench.action.terminal.resizePaneLeft";
  TerminalCommandId2["ResizePaneRight"] = "workbench.action.terminal.resizePaneRight";
  TerminalCommandId2["ResizePaneUp"] = "workbench.action.terminal.resizePaneUp";
  TerminalCommandId2["SizeToContentWidth"] = "workbench.action.terminal.sizeToContentWidth";
  TerminalCommandId2["SizeToContentWidthActiveTab"] = "workbench.action.terminal.sizeToContentWidthActiveTab";
  TerminalCommandId2["ResizePaneDown"] = "workbench.action.terminal.resizePaneDown";
  TerminalCommandId2["Focus"] = "workbench.action.terminal.focus";
  TerminalCommandId2["FocusNext"] = "workbench.action.terminal.focusNext";
  TerminalCommandId2["FocusPrevious"] = "workbench.action.terminal.focusPrevious";
  TerminalCommandId2["Paste"] = "workbench.action.terminal.paste";
  TerminalCommandId2["PasteSelection"] = "workbench.action.terminal.pasteSelection";
  TerminalCommandId2["SelectDefaultProfile"] = "workbench.action.terminal.selectDefaultShell";
  TerminalCommandId2["RunSelectedText"] = "workbench.action.terminal.runSelectedText";
  TerminalCommandId2["RunActiveFile"] = "workbench.action.terminal.runActiveFile";
  TerminalCommandId2["SwitchTerminal"] = "workbench.action.terminal.switchTerminal";
  TerminalCommandId2["ScrollDownLine"] = "workbench.action.terminal.scrollDown";
  TerminalCommandId2["ScrollDownPage"] = "workbench.action.terminal.scrollDownPage";
  TerminalCommandId2["ScrollToBottom"] = "workbench.action.terminal.scrollToBottom";
  TerminalCommandId2["ScrollUpLine"] = "workbench.action.terminal.scrollUp";
  TerminalCommandId2["ScrollUpPage"] = "workbench.action.terminal.scrollUpPage";
  TerminalCommandId2["ScrollToTop"] = "workbench.action.terminal.scrollToTop";
  TerminalCommandId2["Clear"] = "workbench.action.terminal.clear";
  TerminalCommandId2["ClearSelection"] = "workbench.action.terminal.clearSelection";
  TerminalCommandId2["ChangeIcon"] = "workbench.action.terminal.changeIcon";
  TerminalCommandId2["ChangeIconActiveTab"] = "workbench.action.terminal.changeIconActiveTab";
  TerminalCommandId2["ChangeColor"] = "workbench.action.terminal.changeColor";
  TerminalCommandId2["ChangeColorActiveTab"] = "workbench.action.terminal.changeColorActiveTab";
  TerminalCommandId2["Rename"] = "workbench.action.terminal.rename";
  TerminalCommandId2["RenameActiveTab"] = "workbench.action.terminal.renameActiveTab";
  TerminalCommandId2["RenameWithArgs"] = "workbench.action.terminal.renameWithArg";
  TerminalCommandId2["ScrollToPreviousCommand"] = "workbench.action.terminal.scrollToPreviousCommand";
  TerminalCommandId2["ScrollToNextCommand"] = "workbench.action.terminal.scrollToNextCommand";
  TerminalCommandId2["SelectToPreviousCommand"] = "workbench.action.terminal.selectToPreviousCommand";
  TerminalCommandId2["SelectToNextCommand"] = "workbench.action.terminal.selectToNextCommand";
  TerminalCommandId2["SelectToPreviousLine"] = "workbench.action.terminal.selectToPreviousLine";
  TerminalCommandId2["SelectToNextLine"] = "workbench.action.terminal.selectToNextLine";
  TerminalCommandId2["SendSequence"] = "workbench.action.terminal.sendSequence";
  TerminalCommandId2["AttachToSession"] = "workbench.action.terminal.attachToSession";
  TerminalCommandId2["DetachSession"] = "workbench.action.terminal.detachSession";
  TerminalCommandId2["MoveToEditor"] = "workbench.action.terminal.moveToEditor";
  TerminalCommandId2["MoveToTerminalPanel"] = "workbench.action.terminal.moveToTerminalPanel";
  TerminalCommandId2["MoveIntoNewWindow"] = "workbench.action.terminal.moveIntoNewWindow";
  TerminalCommandId2["SetDimensions"] = "workbench.action.terminal.setDimensions";
  TerminalCommandId2["FocusHover"] = "workbench.action.terminal.focusHover";
  TerminalCommandId2["ShowEnvironmentContributions"] = "workbench.action.terminal.showEnvironmentContributions";
  TerminalCommandId2["StartVoice"] = "workbench.action.terminal.startVoice";
  TerminalCommandId2["StopVoice"] = "workbench.action.terminal.stopVoice";
  return TerminalCommandId2;
})(TerminalCommandId || {});
const DEFAULT_COMMANDS_TO_SKIP_SHELL = [
  "workbench.action.terminal.clearSelection" /* ClearSelection */,
  "workbench.action.terminal.clear" /* Clear */,
  "workbench.action.terminal.copyAndClearSelection" /* CopyAndClearSelection */,
  "workbench.action.terminal.copySelection" /* CopySelection */,
  "workbench.action.terminal.copySelectionAsHtml" /* CopySelectionAsHtml */,
  "workbench.action.terminal.copyLastCommand" /* CopyLastCommand */,
  "workbench.action.terminal.copyLastCommandOutput" /* CopyLastCommandOutput */,
  "workbench.action.terminal.copyLastCommandAndLastCommandOutput" /* CopyLastCommandAndLastCommandOutput */,
  "workbench.action.terminal.deleteToLineStart" /* DeleteToLineStart */,
  "workbench.action.terminal.deleteWordLeft" /* DeleteWordLeft */,
  "workbench.action.terminal.deleteWordRight" /* DeleteWordRight */,
  "workbench.action.terminal.focusNextPane" /* FocusNextPane */,
  "workbench.action.terminal.focusNext" /* FocusNext */,
  "workbench.action.terminal.focusPreviousPane" /* FocusPreviousPane */,
  "workbench.action.terminal.focusPrevious" /* FocusPrevious */,
  "workbench.action.terminal.focus" /* Focus */,
  "workbench.action.terminal.sizeToContentWidth" /* SizeToContentWidth */,
  "workbench.action.terminal.kill" /* Kill */,
  "workbench.action.terminal.killEditor" /* KillEditor */,
  "workbench.action.terminal.moveToEditor" /* MoveToEditor */,
  "workbench.action.terminal.moveToLineEnd" /* MoveToLineEnd */,
  "workbench.action.terminal.moveToLineStart" /* MoveToLineStart */,
  "workbench.action.terminal.moveToTerminalPanel" /* MoveToTerminalPanel */,
  "workbench.action.terminal.newInActiveWorkspace" /* NewInActiveWorkspace */,
  "workbench.action.terminal.new" /* New */,
  "workbench.action.terminal.paste" /* Paste */,
  "workbench.action.terminal.pasteSelection" /* PasteSelection */,
  "workbench.action.terminal.resizePaneDown" /* ResizePaneDown */,
  "workbench.action.terminal.resizePaneLeft" /* ResizePaneLeft */,
  "workbench.action.terminal.resizePaneRight" /* ResizePaneRight */,
  "workbench.action.terminal.resizePaneUp" /* ResizePaneUp */,
  "workbench.action.terminal.runActiveFile" /* RunActiveFile */,
  "workbench.action.terminal.runSelectedText" /* RunSelectedText */,
  "workbench.action.terminal.scrollDown" /* ScrollDownLine */,
  "workbench.action.terminal.scrollDownPage" /* ScrollDownPage */,
  "workbench.action.terminal.scrollToBottom" /* ScrollToBottom */,
  "workbench.action.terminal.scrollToNextCommand" /* ScrollToNextCommand */,
  "workbench.action.terminal.scrollToPreviousCommand" /* ScrollToPreviousCommand */,
  "workbench.action.terminal.scrollToTop" /* ScrollToTop */,
  "workbench.action.terminal.scrollUp" /* ScrollUpLine */,
  "workbench.action.terminal.scrollUpPage" /* ScrollUpPage */,
  "workbench.action.terminal.sendSequence" /* SendSequence */,
  "workbench.action.terminal.selectAll" /* SelectAll */,
  "workbench.action.terminal.selectToNextCommand" /* SelectToNextCommand */,
  "workbench.action.terminal.selectToNextLine" /* SelectToNextLine */,
  "workbench.action.terminal.selectToPreviousCommand" /* SelectToPreviousCommand */,
  "workbench.action.terminal.selectToPreviousLine" /* SelectToPreviousLine */,
  "workbench.action.terminal.splitInActiveWorkspace" /* SplitInActiveWorkspace */,
  "workbench.action.terminal.split" /* Split */,
  "workbench.action.terminal.toggleTerminal" /* Toggle */,
  "workbench.action.terminal.focusHover" /* FocusHover */,
  AccessibilityCommandId.OpenAccessibilityHelp,
  "workbench.action.tasks.rerunForActiveTerminal",
  "editor.action.toggleTabFocusMode",
  "notifications.hideList",
  "notifications.hideToasts",
  "workbench.action.closeQuickOpen",
  "workbench.action.quickOpen",
  "workbench.action.quickOpenPreviousEditor",
  "workbench.action.showCommands",
  "workbench.action.tasks.build",
  "workbench.action.tasks.restartTask",
  "workbench.action.tasks.runTask",
  "workbench.action.tasks.reRunTask",
  "workbench.action.tasks.showLog",
  "workbench.action.tasks.showTasks",
  "workbench.action.tasks.terminate",
  "workbench.action.tasks.test",
  "workbench.action.toggleFullScreen",
  "workbench.action.terminal.focusAtIndex1",
  "workbench.action.terminal.focusAtIndex2",
  "workbench.action.terminal.focusAtIndex3",
  "workbench.action.terminal.focusAtIndex4",
  "workbench.action.terminal.focusAtIndex5",
  "workbench.action.terminal.focusAtIndex6",
  "workbench.action.terminal.focusAtIndex7",
  "workbench.action.terminal.focusAtIndex8",
  "workbench.action.terminal.focusAtIndex9",
  "workbench.action.focusSecondEditorGroup",
  "workbench.action.focusThirdEditorGroup",
  "workbench.action.focusFourthEditorGroup",
  "workbench.action.focusFifthEditorGroup",
  "workbench.action.focusSixthEditorGroup",
  "workbench.action.focusSeventhEditorGroup",
  "workbench.action.focusEighthEditorGroup",
  "workbench.action.focusNextPart",
  "workbench.action.focusPreviousPart",
  "workbench.action.nextPanelView",
  "workbench.action.previousPanelView",
  "workbench.action.nextSideBarView",
  "workbench.action.previousSideBarView",
  "workbench.action.debug.disconnect",
  "workbench.action.debug.start",
  "workbench.action.debug.stop",
  "workbench.action.debug.run",
  "workbench.action.debug.restart",
  "workbench.action.debug.continue",
  "workbench.action.debug.pause",
  "workbench.action.debug.stepInto",
  "workbench.action.debug.stepOut",
  "workbench.action.debug.stepOver",
  "workbench.action.nextEditor",
  "workbench.action.previousEditor",
  "workbench.action.nextEditorInGroup",
  "workbench.action.previousEditorInGroup",
  "workbench.action.openNextRecentlyUsedEditor",
  "workbench.action.openPreviousRecentlyUsedEditor",
  "workbench.action.openNextRecentlyUsedEditorInGroup",
  "workbench.action.openPreviousRecentlyUsedEditorInGroup",
  "workbench.action.quickOpenPreviousRecentlyUsedEditor",
  "workbench.action.quickOpenLeastRecentlyUsedEditor",
  "workbench.action.quickOpenPreviousRecentlyUsedEditorInGroup",
  "workbench.action.quickOpenLeastRecentlyUsedEditorInGroup",
  "workbench.action.focusActiveEditorGroup",
  "workbench.action.focusFirstEditorGroup",
  "workbench.action.focusLastEditorGroup",
  "workbench.action.firstEditorInGroup",
  "workbench.action.lastEditorInGroup",
  "workbench.action.navigateUp",
  "workbench.action.navigateDown",
  "workbench.action.navigateRight",
  "workbench.action.navigateLeft",
  "workbench.action.togglePanel",
  "workbench.action.quickOpenView",
  "workbench.action.toggleMaximizedPanel",
  "notification.acceptPrimaryAction",
  "runCommands",
  "workbench.action.terminal.chat.start",
  "workbench.action.terminal.chat.close",
  "workbench.action.terminal.chat.discard",
  "workbench.action.terminal.chat.makeRequest",
  "workbench.action.terminal.chat.cancel",
  "workbench.action.terminal.chat.feedbackHelpful",
  "workbench.action.terminal.chat.feedbackUnhelpful",
  "workbench.action.terminal.chat.feedbackReportIssue",
  "workbench.action.terminal.chat.runCommand",
  "workbench.action.terminal.chat.insertCommand",
  "workbench.action.terminal.chat.viewInChat",
  ...defaultTerminalContribCommandsToSkipShell
];
const terminalContributionsDescriptor = {
  extensionPoint: "terminal",
  defaultExtensionKind: ["workspace"],
  activationEventsGenerator: (contribs, result) => {
    for (const contrib of contribs) {
      for (const profileContrib of contrib.profiles ?? []) {
        result.push(`onTerminalProfile:${profileContrib.id}`);
      }
    }
  },
  jsonSchema: {
    description: nls.localize("vscode.extension.contributes.terminal", "Contributes terminal functionality."),
    type: "object",
    properties: {
      profiles: {
        type: "array",
        description: nls.localize("vscode.extension.contributes.terminal.profiles", "Defines additional terminal profiles that the user can create."),
        items: {
          type: "object",
          required: ["id", "title"],
          defaultSnippets: [{
            body: {
              id: "$1",
              title: "$2"
            }
          }],
          properties: {
            id: {
              description: nls.localize("vscode.extension.contributes.terminal.profiles.id", "The ID of the terminal profile provider."),
              type: "string"
            },
            title: {
              description: nls.localize("vscode.extension.contributes.terminal.profiles.title", "Title for this terminal profile."),
              type: "string"
            },
            icon: {
              description: nls.localize("vscode.extension.contributes.terminal.types.icon", "A codicon, URI, or light and dark URIs to associate with this terminal type."),
              anyOf: [
                {
                  type: "string"
                },
                {
                  type: "object",
                  properties: {
                    light: {
                      description: nls.localize("vscode.extension.contributes.terminal.types.icon.light", "Icon path when a light theme is used"),
                      type: "string"
                    },
                    dark: {
                      description: nls.localize("vscode.extension.contributes.terminal.types.icon.dark", "Icon path when a dark theme is used"),
                      type: "string"
                    }
                  }
                }
              ]
            }
          }
        }
      }
    }
  }
};
export {
  DEFAULT_BOLD_FONT_WEIGHT,
  DEFAULT_COMMANDS_TO_SKIP_SHELL,
  DEFAULT_FONT_WEIGHT,
  DEFAULT_LETTER_SPACING,
  DEFAULT_LINE_HEIGHT,
  ITerminalProfileResolverService,
  ITerminalProfileService,
  MAXIMUM_FONT_WEIGHT,
  MINIMUM_FONT_WEIGHT,
  MINIMUM_LETTER_SPACING,
  ProcessState,
  QUICK_LAUNCH_PROFILE_CHOICE,
  SUGGESTIONS_FONT_WEIGHT,
  ShellIntegrationExitCode,
  TERMINAL_CONFIG_SECTION,
  TERMINAL_CREATION_COMMANDS,
  TERMINAL_VIEW_ID,
  TerminalCommandId,
  isTerminalProcessManager,
  terminalContributionsDescriptor
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9jb21tb24vdGVybWluYWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE1hcnNoYWxsZWRJZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcnNoYWxsaW5nSWRzLmpzJztcbmltcG9ydCB7IElQcm9jZXNzRW52aXJvbm1lbnQsIGlzTGludXgsIE9wZXJhdGluZ1N5c3RlbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU2VyaWFsaXplZENvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5LCBJVGVybWluYWxDYXBhYmlsaXR5U3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBJTWVyZ2VkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vZW52aXJvbm1lbnRWYXJpYWJsZS5qcyc7XG5pbXBvcnQgeyBJQ3JlYXRlQ29udHJpYnV0ZWRUZXJtaW5hbFByb2ZpbGVPcHRpb25zLCBJRXh0ZW5zaW9uVGVybWluYWxQcm9maWxlLCBJRml4ZWRUZXJtaW5hbERpbWVuc2lvbnMsIElQcm9jZXNzRGF0YUV2ZW50LCBJUHJvY2Vzc1Byb3BlcnR5LCBJUHJvY2Vzc1Byb3BlcnR5TWFwLCBJUHJvY2Vzc1JlYWR5RXZlbnQsIElQcm9jZXNzUmVhZHlXaW5kb3dzUHR5LCBJU2hlbGxMYXVuY2hDb25maWcsIElUZXJtaW5hbEJhY2tlbmQsIElUZXJtaW5hbENvbnRyaWJ1dGlvbnMsIElUZXJtaW5hbEVudmlyb25tZW50LCBJVGVybWluYWxMYXVuY2hFcnJvciwgSVRlcm1pbmFsUHJvZmlsZSwgSVRlcm1pbmFsUHJvZmlsZU9iamVjdCwgSVRlcm1pbmFsVGFiQWN0aW9uLCBQcm9jZXNzUHJvcGVydHlUeXBlLCBUZXJtaW5hbEljb24sIFRlcm1pbmFsTG9jYXRpb25TdHJpbmcsIFRpdGxlRXZlbnRTb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eUNvbW1hbmRJZCB9IGZyb20gJy4uLy4uL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHlDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRWYXJpYWJsZUluZm8gfSBmcm9tICcuL2Vudmlyb25tZW50VmFyaWFibGUuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblBvaW50RGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0VGVybWluYWxDb250cmliQ29tbWFuZHNUb1NraXBTaGVsbCB9IGZyb20gJy4uL3Rlcm1pbmFsQ29udHJpYkV4cG9ydHMuanMnO1xuXG5leHBvcnQgY29uc3QgVEVSTUlOQUxfVklFV19JRCA9ICd0ZXJtaW5hbCc7XG5cbmV4cG9ydCBjb25zdCBURVJNSU5BTF9DUkVBVElPTl9DT01NQU5EUyA9IFsnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC50b2dnbGVUZXJtaW5hbCcsICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLm5ldycsICd3b3JrYmVuY2guYWN0aW9uLnRvZ2dsZVBhbmVsJywgJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuZm9jdXMnXTtcblxuZXhwb3J0IGNvbnN0IFRFUk1JTkFMX0NPTkZJR19TRUNUSU9OID0gJ3Rlcm1pbmFsLmludGVncmF0ZWQnO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9MRVRURVJfU1BBQ0lORyA9IDA7XG5leHBvcnQgY29uc3QgTUlOSU1VTV9MRVRURVJfU1BBQ0lORyA9IC01O1xuLy8gSEFDSzogT24gTGludXggaXQncyBjb21tb24gZm9yIGZvbnRzIHRvIGluY2x1ZGUgYW4gdW5kZXJsaW5lIHRoYXQgaXMgcmVuZGVyZWQgbG93ZXIgdGhhbiB0aGVcbi8vIGJvdHRvbSBvZiB0aGUgY2VsbCB3aGljaCBjYXVzZXMgaXQgdG8gYmUgY3V0IG9mZiBkdWUgdG8gYG92ZXJmbG93OmhpZGRlbmAgaW4gdGhlIERPTSByZW5kZXJlci5cbi8vIFNlZTpcbi8vIC0gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIxMTkzM1xuLy8gLSBodHRwczovL2dpdGh1Yi5jb20veHRlcm1qcy94dGVybS5qcy9pc3N1ZXMvNDA2N1xuZXhwb3J0IGNvbnN0IERFRkFVTFRfTElORV9IRUlHSFQgPSBpc0xpbnV4ID8gMS4xIDogMTtcblxuZXhwb3J0IGNvbnN0IE1JTklNVU1fRk9OVF9XRUlHSFQgPSAxO1xuZXhwb3J0IGNvbnN0IE1BWElNVU1fRk9OVF9XRUlHSFQgPSAxMDAwO1xuZXhwb3J0IGNvbnN0IERFRkFVTFRfRk9OVF9XRUlHSFQgPSAnbm9ybWFsJztcbmV4cG9ydCBjb25zdCBERUZBVUxUX0JPTERfRk9OVF9XRUlHSFQgPSAnYm9sZCc7XG5leHBvcnQgY29uc3QgU1VHR0VTVElPTlNfRk9OVF9XRUlHSFQgPSBbJ25vcm1hbCcsICdib2xkJywgJzEwMCcsICcyMDAnLCAnMzAwJywgJzQwMCcsICc1MDAnLCAnNjAwJywgJzcwMCcsICc4MDAnLCAnOTAwJ107XG5cbmV4cG9ydCBjb25zdCBJVGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2U+KCd0ZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UnKTtcbmV4cG9ydCBpbnRlcmZhY2UgSVRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBkZWZhdWx0UHJvZmlsZU5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHQvKipcblx0ICogUmVzb2x2ZXMgdGhlIGljb24gb2YgYSBzaGVsbCBsYXVuY2ggY29uZmlnIGlmIHRoaXMgd2lsbCB1c2UgdGhlIGRlZmF1bHQgcHJvZmlsZVxuXHQgKi9cblx0cmVzb2x2ZUljb24oc2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZywgb3M6IE9wZXJhdGluZ1N5c3RlbSk6IHZvaWQ7XG5cdHJlc29sdmVTaGVsbExhdW5jaENvbmZpZyhzaGVsbExhdW5jaENvbmZpZzogSVNoZWxsTGF1bmNoQ29uZmlnLCBvcHRpb25zOiBJU2hlbGxMYXVuY2hDb25maWdSZXNvbHZlT3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG5cdGdldERlZmF1bHRQcm9maWxlKG9wdGlvbnM6IElTaGVsbExhdW5jaENvbmZpZ1Jlc29sdmVPcHRpb25zKTogUHJvbWlzZTxJVGVybWluYWxQcm9maWxlPjtcblx0Z2V0RGVmYXVsdFNoZWxsKG9wdGlvbnM6IElTaGVsbExhdW5jaENvbmZpZ1Jlc29sdmVPcHRpb25zKTogUHJvbWlzZTxzdHJpbmc+O1xuXHRnZXREZWZhdWx0U2hlbGxBcmdzKG9wdGlvbnM6IElTaGVsbExhdW5jaENvbmZpZ1Jlc29sdmVPcHRpb25zKTogUHJvbWlzZTxzdHJpbmcgfCBzdHJpbmdbXT47XG5cdGdldERlZmF1bHRJY29uKCk6IFRlcm1pbmFsSWNvbiAmIFRoZW1lSWNvbjtcblx0Z2V0RW52aXJvbm1lbnQocmVtb3RlQXV0aG9yaXR5OiBzdHJpbmcgfCB1bmRlZmluZWQpOiBQcm9taXNlPElQcm9jZXNzRW52aXJvbm1lbnQ+O1xufVxuXG4vKlxuICogV2hlbiB0aGVyZSB3ZXJlIHNoZWxsIGludGVncmF0aW9uIGFyZ3MgaW5qZWN0ZWRcbiAqIGFuZCBjcmVhdGVQcm9jZXNzIHJldHVybnMgYW4gZXJyb3IsIHRoaXMgZXhpdCBjb2RlIHdpbGwgYmUgdXNlZC5cbiAqL1xuZXhwb3J0IGNvbnN0IFNoZWxsSW50ZWdyYXRpb25FeGl0Q29kZSA9IDYzMztcblxuZXhwb3J0IGludGVyZmFjZSBJUmVnaXN0ZXJDb250cmlidXRlZFByb2ZpbGVBcmdzIHtcblx0ZXh0ZW5zaW9uSWRlbnRpZmllcjogc3RyaW5nOyBpZDogc3RyaW5nOyB0aXRsZTogc3RyaW5nOyBvcHRpb25zOiBJQ3JlYXRlQ29udHJpYnV0ZWRUZXJtaW5hbFByb2ZpbGVPcHRpb25zO1xufVxuXG5leHBvcnQgY29uc3QgSVRlcm1pbmFsUHJvZmlsZVNlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SVRlcm1pbmFsUHJvZmlsZVNlcnZpY2U+KCd0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlJyk7XG5leHBvcnQgaW50ZXJmYWNlIElUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlIHtcblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRyZWFkb25seSBhdmFpbGFibGVQcm9maWxlczogSVRlcm1pbmFsUHJvZmlsZVtdO1xuXHRyZWFkb25seSBjb250cmlidXRlZFByb2ZpbGVzOiBJRXh0ZW5zaW9uVGVybWluYWxQcm9maWxlW107XG5cdHJlYWRvbmx5IHByb2ZpbGVzUmVhZHk6IFByb21pc2U8dm9pZD47XG5cdGdldFBsYXRmb3JtS2V5KCk6IFByb21pc2U8c3RyaW5nPjtcblx0cmVmcmVzaEF2YWlsYWJsZVByb2ZpbGVzKCk6IHZvaWQ7XG5cdGdldERlZmF1bHRQcm9maWxlTmFtZSgpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGdldERlZmF1bHRQcm9maWxlKG9zPzogT3BlcmF0aW5nU3lzdGVtKTogSVRlcm1pbmFsUHJvZmlsZSB8IHVuZGVmaW5lZDtcblx0b25EaWRDaGFuZ2VBdmFpbGFibGVQcm9maWxlczogRXZlbnQ8SVRlcm1pbmFsUHJvZmlsZVtdPjtcblx0Z2V0Q29udHJpYnV0ZWREZWZhdWx0UHJvZmlsZShzaGVsbExhdW5jaENvbmZpZzogSVNoZWxsTGF1bmNoQ29uZmlnKTogUHJvbWlzZTxJRXh0ZW5zaW9uVGVybWluYWxQcm9maWxlIHwgdW5kZWZpbmVkPjtcblx0cmVnaXN0ZXJDb250cmlidXRlZFByb2ZpbGUoYXJnczogSVJlZ2lzdGVyQ29udHJpYnV0ZWRQcm9maWxlQXJncyk6IFByb21pc2U8dm9pZD47XG5cdGdldENvbnRyaWJ1dGVkUHJvZmlsZVByb3ZpZGVyKGV4dGVuc2lvbklkZW50aWZpZXI6IHN0cmluZywgaWQ6IHN0cmluZyk6IElUZXJtaW5hbFByb2ZpbGVQcm92aWRlciB8IHVuZGVmaW5lZDtcblx0cmVnaXN0ZXJUZXJtaW5hbFByb2ZpbGVQcm92aWRlcihleHRlbnNpb25JZGVudGlmaWVyOiBzdHJpbmcsIGlkOiBzdHJpbmcsIHByb2ZpbGVQcm92aWRlcjogSVRlcm1pbmFsUHJvZmlsZVByb3ZpZGVyKTogSURpc3Bvc2FibGU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRlcm1pbmFsUHJvZmlsZVByb3ZpZGVyIHtcblx0Y3JlYXRlQ29udHJpYnV0ZWRUZXJtaW5hbFByb2ZpbGUob3B0aW9uczogSUNyZWF0ZUNvbnRyaWJ1dGVkVGVybWluYWxQcm9maWxlT3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNoZWxsTGF1bmNoQ29uZmlnUmVzb2x2ZU9wdGlvbnMge1xuXHRyZW1vdGVBdXRob3JpdHk6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0b3M6IE9wZXJhdGluZ1N5c3RlbTtcblx0YWxsb3dBdXRvbWF0aW9uU2hlbGw/OiBib29sZWFuO1xufVxuXG5leHBvcnQgdHlwZSBGb250V2VpZ2h0ID0gJ25vcm1hbCcgfCAnYm9sZCcgfCBudW1iZXI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRlcm1pbmFsUHJvZmlsZXMge1xuXHRsaW51eDogeyBba2V5OiBzdHJpbmddOiBJVGVybWluYWxQcm9maWxlT2JqZWN0IH07XG5cdG9zeDogeyBba2V5OiBzdHJpbmddOiBJVGVybWluYWxQcm9maWxlT2JqZWN0IH07XG5cdHdpbmRvd3M6IHsgW2tleTogc3RyaW5nXTogSVRlcm1pbmFsUHJvZmlsZU9iamVjdCB9O1xufVxuXG5leHBvcnQgdHlwZSBDb25maXJtT25LaWxsID0gJ25ldmVyJyB8ICdhbHdheXMnIHwgJ2VkaXRvcicgfCAncGFuZWwnO1xuZXhwb3J0IHR5cGUgQ29uZmlybU9uRXhpdCA9ICduZXZlcicgfCAnYWx3YXlzJyB8ICdoYXNDaGlsZFByb2Nlc3Nlcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbXBsZXRlVGVybWluYWxDb25maWd1cmF0aW9uIHtcblx0J3Rlcm1pbmFsLmludGVncmF0ZWQuZW52LndpbmRvd3MnOiBJVGVybWluYWxFbnZpcm9ubWVudDtcblx0J3Rlcm1pbmFsLmludGVncmF0ZWQuZW52Lm9zeCc6IElUZXJtaW5hbEVudmlyb25tZW50O1xuXHQndGVybWluYWwuaW50ZWdyYXRlZC5lbnYubGludXgnOiBJVGVybWluYWxFbnZpcm9ubWVudDtcblx0J3Rlcm1pbmFsLmludGVncmF0ZWQuY3dkJzogc3RyaW5nO1xuXHQndGVybWluYWwuaW50ZWdyYXRlZC5kZXRlY3RMb2NhbGUnOiAnYXV0bycgfCAnb2ZmJyB8ICdvbic7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRlcm1pbmFsQ29uZmlndXJhdGlvbiB7XG5cdHNoZWxsOiB7XG5cdFx0bGludXg6IHN0cmluZyB8IG51bGw7XG5cdFx0b3N4OiBzdHJpbmcgfCBudWxsO1xuXHRcdHdpbmRvd3M6IHN0cmluZyB8IG51bGw7XG5cdH07XG5cdGF1dG9tYXRpb25TaGVsbDoge1xuXHRcdGxpbnV4OiBzdHJpbmcgfCBudWxsO1xuXHRcdG9zeDogc3RyaW5nIHwgbnVsbDtcblx0XHR3aW5kb3dzOiBzdHJpbmcgfCBudWxsO1xuXHR9O1xuXHRzaGVsbEFyZ3M6IHtcblx0XHRsaW51eDogc3RyaW5nW107XG5cdFx0b3N4OiBzdHJpbmdbXTtcblx0XHR3aW5kb3dzOiBzdHJpbmdbXTtcblx0fTtcblx0cHJvZmlsZXM6IElUZXJtaW5hbFByb2ZpbGVzO1xuXHRkZWZhdWx0UHJvZmlsZToge1xuXHRcdGxpbnV4OiBzdHJpbmcgfCBudWxsO1xuXHRcdG9zeDogc3RyaW5nIHwgbnVsbDtcblx0XHR3aW5kb3dzOiBzdHJpbmcgfCBudWxsO1xuXHR9O1xuXHR1c2VXc2xQcm9maWxlczogYm9vbGVhbjtcblx0YWx0Q2xpY2tNb3Zlc0N1cnNvcjogYm9vbGVhbjtcblx0bWFjT3B0aW9uSXNNZXRhOiBib29sZWFuO1xuXHRtYWNPcHRpb25DbGlja0ZvcmNlc1NlbGVjdGlvbjogYm9vbGVhbjtcblx0Z3B1QWNjZWxlcmF0aW9uOiAnYXV0bycgfCAnb24nIHwgJ29mZic7XG5cdHJpZ2h0Q2xpY2tCZWhhdmlvcjogJ2RlZmF1bHQnIHwgJ2NvcHlQYXN0ZScgfCAncGFzdGUnIHwgJ3NlbGVjdFdvcmQnIHwgJ25vdGhpbmcnO1xuXHRtaWRkbGVDbGlja0JlaGF2aW9yOiAnZGVmYXVsdCcgfCAncGFzdGUnO1xuXHRjdXJzb3JCbGlua2luZzogYm9vbGVhbjtcblx0Y3Vyc29yU3R5bGU6ICdibG9jaycgfCAndW5kZXJsaW5lJyB8ICdsaW5lJztcblx0Y3Vyc29yU3R5bGVJbmFjdGl2ZTogJ291dGxpbmUnIHwgJ2Jsb2NrJyB8ICd1bmRlcmxpbmUnIHwgJ2xpbmUnIHwgJ25vbmUnO1xuXHRjdXJzb3JXaWR0aDogbnVtYmVyO1xuXHRkcmF3Qm9sZFRleHRJbkJyaWdodENvbG9yczogYm9vbGVhbjtcblx0ZmFzdFNjcm9sbFNlbnNpdGl2aXR5OiBudW1iZXI7XG5cdGZvbnRGYW1pbHk6IHN0cmluZztcblx0Zm9udFdlaWdodDogRm9udFdlaWdodDtcblx0Zm9udFdlaWdodEJvbGQ6IEZvbnRXZWlnaHQ7XG5cdG1pbmltdW1Db250cmFzdFJhdGlvOiBudW1iZXI7XG5cdG1vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eTogbnVtYmVyO1xuXHR0YWJTdG9wV2lkdGg6IG51bWJlcjtcblx0c2VuZEtleWJpbmRpbmdzVG9TaGVsbDogYm9vbGVhbjtcblx0Zm9udFNpemU6IG51bWJlcjtcblx0bGV0dGVyU3BhY2luZzogbnVtYmVyO1xuXHRsaW5lSGVpZ2h0OiBudW1iZXI7XG5cdGRldGVjdExvY2FsZTogJ2F1dG8nIHwgJ29mZicgfCAnb24nO1xuXHRzY3JvbGxiYWNrOiBudW1iZXI7XG5cdGNvbW1hbmRzVG9Ta2lwU2hlbGw6IHN0cmluZ1tdO1xuXHRhbGxvd0Nob3JkczogYm9vbGVhbjtcblx0YWxsb3dNbmVtb25pY3M6IGJvb2xlYW47XG5cdGN3ZDogc3RyaW5nO1xuXHRjb25maXJtT25FeGl0OiBDb25maXJtT25FeGl0O1xuXHRjb25maXJtT25LaWxsOiBDb25maXJtT25LaWxsO1xuXHRlbmFibGVCZWxsOiBib29sZWFuO1xuXHRlbnY6IHtcblx0XHRsaW51eDogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfTtcblx0XHRvc3g6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH07XG5cdFx0d2luZG93czogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfTtcblx0fTtcblx0ZW52aXJvbm1lbnRDaGFuZ2VzSW5kaWNhdG9yOiAnb2ZmJyB8ICdvbicgfCAnd2Fybm9ubHknO1xuXHRlbnZpcm9ubWVudENoYW5nZXNSZWxhdW5jaDogYm9vbGVhbjtcblx0c2hvd0V4aXRBbGVydDogYm9vbGVhbjtcblx0c3BsaXRDd2Q6ICd3b3Jrc3BhY2VSb290JyB8ICdpbml0aWFsJyB8ICdpbmhlcml0ZWQnO1xuXHR3aW5kb3dzRW5hYmxlQ29ucHR5OiBib29sZWFuO1xuXHR3aW5kb3dzVXNlQ29ucHR5RGxsPzogYm9vbGVhbjtcblx0d29yZFNlcGFyYXRvcnM6IHN0cmluZztcblx0ZW5hYmxlRmlsZUxpbmtzOiAnb2ZmJyB8ICdvbicgfCAnbm90UmVtb3RlJztcblx0YWxsb3dlZExpbmtTY2hlbWVzOiBzdHJpbmdbXTtcblx0dW5pY29kZVZlcnNpb246ICc2JyB8ICcxMSc7XG5cdGVuYWJsZVBlcnNpc3RlbnRTZXNzaW9uczogYm9vbGVhbjtcblx0dGFiczoge1xuXHRcdGVuYWJsZWQ6IGJvb2xlYW47XG5cdFx0aGlkZUNvbmRpdGlvbjogJ25ldmVyJyB8ICdzaW5nbGVUZXJtaW5hbCcgfCAnc2luZ2xlR3JvdXAnO1xuXHRcdHNob3dBY3RpdmVUZXJtaW5hbDogJ2Fsd2F5cycgfCAnc2luZ2xlVGVybWluYWwnIHwgJ3NpbmdsZVRlcm1pbmFsT3JOYXJyb3cnIHwgJ3NpbmdsZUdyb3VwJyB8ICduZXZlcic7XG5cdFx0bG9jYXRpb246ICdsZWZ0JyB8ICdyaWdodCc7XG5cdFx0Zm9jdXNNb2RlOiAnc2luZ2xlQ2xpY2snIHwgJ2RvdWJsZUNsaWNrJztcblx0XHR0aXRsZTogc3RyaW5nO1xuXHRcdGRlc2NyaXB0aW9uOiBzdHJpbmc7XG5cdFx0c2VwYXJhdG9yOiBzdHJpbmc7XG5cdH07XG5cdGJlbGxEdXJhdGlvbjogbnVtYmVyO1xuXHRkZWZhdWx0TG9jYXRpb246IFRlcm1pbmFsTG9jYXRpb25TdHJpbmc7XG5cdGN1c3RvbUdseXBoczogYm9vbGVhbjtcblx0cGVyc2lzdGVudFNlc3Npb25SZXZpdmVQcm9jZXNzOiAnb25FeGl0JyB8ICdvbkV4aXRBbmRXaW5kb3dDbG9zZScgfCAnbmV2ZXInO1xuXHRpZ25vcmVQcm9jZXNzTmFtZXM6IHN0cmluZ1tdO1xuXHRzaGVsbEludGVncmF0aW9uPzoge1xuXHRcdGVuYWJsZWQ6IGJvb2xlYW47XG5cdFx0ZGVjb3JhdGlvbnNFbmFibGVkOiAnYm90aCcgfCAnZ3V0dGVyJyB8ICdvdmVydmlld1J1bGVyJyB8ICduZXZlcic7XG5cdH07XG5cdGVuYWJsZUltYWdlczogYm9vbGVhbjtcblx0c21vb3RoU2Nyb2xsaW5nOiBib29sZWFuO1xuXHRpZ25vcmVCcmFja2V0ZWRQYXN0ZU1vZGU6IGJvb2xlYW47XG5cdHJlc2NhbGVPdmVybGFwcGluZ0dseXBoczogYm9vbGVhbjtcblx0Zm9udExpZ2F0dXJlcz86IHtcblx0XHRlbmFibGVkOiBib29sZWFuO1xuXHRcdGZlYXR1cmVTZXR0aW5nczogc3RyaW5nO1xuXHRcdGZhbGxiYWNrTGlnYXR1cmVzOiBzdHJpbmdbXTtcblx0fTtcblx0aGlkZU9uTGFzdENsb3NlZDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGVybWluYWxGb250IHtcblx0Zm9udEZhbWlseTogc3RyaW5nO1xuXHRmb250U2l6ZTogbnVtYmVyO1xuXHRsZXR0ZXJTcGFjaW5nOiBudW1iZXI7XG5cdGxpbmVIZWlnaHQ6IG51bWJlcjtcblx0Y2hhcldpZHRoPzogbnVtYmVyO1xuXHRjaGFySGVpZ2h0PzogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElSZW1vdGVUZXJtaW5hbEF0dGFjaFRhcmdldCB7XG5cdGlkOiBudW1iZXI7XG5cdHBpZDogbnVtYmVyO1xuXHR0aXRsZTogc3RyaW5nO1xuXHR0aXRsZVNvdXJjZTogVGl0bGVFdmVudFNvdXJjZTtcblx0Y3dkOiBzdHJpbmc7XG5cdHdvcmtzcGFjZUlkOiBzdHJpbmc7XG5cdHdvcmtzcGFjZU5hbWU6IHN0cmluZztcblx0aXNPcnBoYW46IGJvb2xlYW47XG5cdGljb246IFVSSSB8IHsgbGlnaHQ6IFVSSTsgZGFyazogVVJJIH0gfCB7IGlkOiBzdHJpbmc7IGNvbG9yPzogeyBpZDogc3RyaW5nIH0gfSB8IHVuZGVmaW5lZDtcblx0Y29sb3I6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Zml4ZWREaW1lbnNpb25zOiBJRml4ZWRUZXJtaW5hbERpbWVuc2lvbnMgfCB1bmRlZmluZWQ7XG5cdHNoZWxsSW50ZWdyYXRpb25Ob25jZTogc3RyaW5nO1xuXHR0YWJBY3Rpb25zPzogSVRlcm1pbmFsVGFiQWN0aW9uW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUJlZm9yZVByb2Nlc3NEYXRhRXZlbnQge1xuXHQvKipcblx0ICogVGhlIGRhdGEgb2YgdGhlIGV2ZW50LCB0aGlzIGNhbiBiZSBtb2RpZmllZCBieSB0aGUgZXZlbnQgbGlzdGVuZXIgdG8gY2hhbmdlIHdoYXQgZ2V0cyBzZW50XG5cdCAqIHRvIHRoZSB0ZXJtaW5hbC5cblx0ICovXG5cdGRhdGE6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRGVmYXVsdFNoZWxsQW5kQXJnc1JlcXVlc3Qge1xuXHR1c2VBdXRvbWF0aW9uU2hlbGw6IGJvb2xlYW47XG5cdGNhbGxiYWNrOiAoc2hlbGw6IHN0cmluZywgYXJnczogc3RyaW5nW10gfCBzdHJpbmcgfCB1bmRlZmluZWQpID0+IHZvaWQ7XG59XG5cbi8qKiBSZWFkLW9ubHkgcHJvY2VzcyBpbmZvcm1hdGlvbiB0aGF0IGNhbiBhcHBseSB0byBkZXRhY2hlZCB0ZXJtaW5hbHMuICovXG5leHBvcnQgaW50ZXJmYWNlIElUZXJtaW5hbFByb2Nlc3NJbmZvIHtcblx0cmVhZG9ubHkgcHJvY2Vzc1N0YXRlOiBQcm9jZXNzU3RhdGU7XG5cdHJlYWRvbmx5IHB0eVByb2Nlc3NSZWFkeTogUHJvbWlzZTx2b2lkPjtcblx0cmVhZG9ubHkgc2hlbGxQcm9jZXNzSWQ6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgcmVtb3RlQXV0aG9yaXR5OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IG9zOiBPcGVyYXRpbmdTeXN0ZW0gfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IHVzZXJIb21lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGluaXRpYWxDd2Q6IHN0cmluZztcblx0cmVhZG9ubHkgZW52aXJvbm1lbnRWYXJpYWJsZUluZm86IElFbnZpcm9ubWVudFZhcmlhYmxlSW5mbyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgcGVyc2lzdGVudFByb2Nlc3NJZDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBzaG91bGRQZXJzaXN0OiBib29sZWFuO1xuXHRyZWFkb25seSBoYXNXcml0dGVuRGF0YTogYm9vbGVhbjtcblx0cmVhZG9ubHkgaGFzQ2hpbGRQcm9jZXNzZXM6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGJhY2tlbmQ6IElUZXJtaW5hbEJhY2tlbmQgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGNhcGFiaWxpdGllczogSVRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlO1xuXHRyZWFkb25seSBzaGVsbEludGVncmF0aW9uTm9uY2U6IHN0cmluZztcblx0cmVhZG9ubHkgZXh0RW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb246IElNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbiB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGNvbnN0IGlzVGVybWluYWxQcm9jZXNzTWFuYWdlciA9ICh0OiBJVGVybWluYWxQcm9jZXNzSW5mbyB8IElUZXJtaW5hbFByb2Nlc3NNYW5hZ2VyKTogdCBpcyBJVGVybWluYWxQcm9jZXNzTWFuYWdlciA9PiB0eXBlb2YgKHQgYXMgSVRlcm1pbmFsUHJvY2Vzc01hbmFnZXIpLndyaXRlID09PSAnZnVuY3Rpb24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIElUZXJtaW5hbFByb2Nlc3NNYW5hZ2VyIGV4dGVuZHMgSURpc3Bvc2FibGUsIElUZXJtaW5hbFByb2Nlc3NJbmZvIHtcblx0cmVhZG9ubHkgcHJvY2Vzc1RyYWl0czogSVByb2Nlc3NSZWFkeUV2ZW50IHwgdW5kZWZpbmVkO1xuXG5cdHJlYWRvbmx5IG9uUHR5RGlzY29ubmVjdDogRXZlbnQ8dm9pZD47XG5cdHJlYWRvbmx5IG9uUHR5UmVjb25uZWN0OiBFdmVudDx2b2lkPjtcblxuXHRyZWFkb25seSBvblByb2Nlc3NSZWFkeTogRXZlbnQ8SVByb2Nlc3NSZWFkeUV2ZW50Pjtcblx0cmVhZG9ubHkgb25CZWZvcmVQcm9jZXNzRGF0YTogRXZlbnQ8SUJlZm9yZVByb2Nlc3NEYXRhRXZlbnQ+O1xuXHRyZWFkb25seSBvblByb2Nlc3NEYXRhOiBFdmVudDxJUHJvY2Vzc0RhdGFFdmVudD47XG5cdHJlYWRvbmx5IG9uUHJvY2Vzc1JlcGxheUNvbXBsZXRlOiBFdmVudDx2b2lkPjtcblx0cmVhZG9ubHkgb25FbnZpcm9ubWVudFZhcmlhYmxlSW5mb0NoYW5nZWQ6IEV2ZW50PElFbnZpcm9ubWVudFZhcmlhYmxlSW5mbz47XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUHJvcGVydHk6IEV2ZW50PElQcm9jZXNzUHJvcGVydHk8YW55Pj47XG5cdHJlYWRvbmx5IG9uUHJvY2Vzc0V4aXQ6IEV2ZW50PG51bWJlciB8IHVuZGVmaW5lZD47XG5cdHJlYWRvbmx5IG9uUmVzdG9yZUNvbW1hbmRzOiBFdmVudDxJU2VyaWFsaXplZENvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5PjtcblxuXHRkaXNwb3NlKGltbWVkaWF0ZT86IGJvb2xlYW4pOiB2b2lkO1xuXHRkZXRhY2hGcm9tUHJvY2Vzcyhmb3JjZVBlcnNpc3Q/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPjtcblx0Y3JlYXRlUHJvY2VzcyhzaGVsbExhdW5jaENvbmZpZzogSVNoZWxsTGF1bmNoQ29uZmlnLCBjb2xzOiBudW1iZXIsIHJvd3M6IG51bWJlcik6IFByb21pc2U8SVRlcm1pbmFsTGF1bmNoRXJyb3IgfCB7IGluamVjdGVkQXJnczogc3RyaW5nW10gfSB8IHVuZGVmaW5lZD47XG5cdHJlbGF1bmNoKHNoZWxsTGF1bmNoQ29uZmlnOiBJU2hlbGxMYXVuY2hDb25maWcsIGNvbHM6IG51bWJlciwgcm93czogbnVtYmVyLCByZXNldDogYm9vbGVhbik6IFByb21pc2U8SVRlcm1pbmFsTGF1bmNoRXJyb3IgfCB7IGluamVjdGVkQXJnczogc3RyaW5nW10gfSB8IHVuZGVmaW5lZD47XG5cdHdyaXRlKGRhdGE6IHN0cmluZyk6IFByb21pc2U8dm9pZD47XG5cdHNldERpbWVuc2lvbnMoY29sczogbnVtYmVyLCByb3dzOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+O1xuXHRzZXREaW1lbnNpb25zKGNvbHM6IG51bWJlciwgcm93czogbnVtYmVyLCBzeW5jOiBmYWxzZSk6IFByb21pc2U8dm9pZD47XG5cdHNldERpbWVuc2lvbnMoY29sczogbnVtYmVyLCByb3dzOiBudW1iZXIsIHN5bmM6IHRydWUpOiB2b2lkO1xuXHRjbGVhckJ1ZmZlcigpOiBQcm9taXNlPHZvaWQ+O1xuXHRzZXRVbmljb2RlVmVyc2lvbih2ZXJzaW9uOiAnNicgfCAnMTEnKTogUHJvbWlzZTx2b2lkPjtcblx0YWNrbm93bGVkZ2VEYXRhRXZlbnQoY2hhckNvdW50OiBudW1iZXIpOiB2b2lkO1xuXHRwcm9jZXNzQmluYXJ5KGRhdGE6IHN0cmluZyk6IHZvaWQ7XG5cblx0cmVmcmVzaFByb3BlcnR5PFQgZXh0ZW5kcyBQcm9jZXNzUHJvcGVydHlUeXBlPih0eXBlOiBUKTogUHJvbWlzZTxJUHJvY2Vzc1Byb3BlcnR5TWFwW1RdPjtcblx0dXBkYXRlUHJvcGVydHk8VCBleHRlbmRzIFByb2Nlc3NQcm9wZXJ0eVR5cGU+KHByb3BlcnR5OiBULCB2YWx1ZTogSVByb2Nlc3NQcm9wZXJ0eU1hcFtUXSk6IFByb21pc2U8dm9pZD47XG5cdGdldEJhY2tlbmRPUygpOiBQcm9taXNlPE9wZXJhdGluZ1N5c3RlbT47XG5cdGZyZWVQb3J0S2lsbFByb2Nlc3MocG9ydDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gUHJvY2Vzc1N0YXRlIHtcblx0Ly8gVGhlIHByb2Nlc3MgaGFzIG5vdCBiZWVuIGluaXRpYWxpemVkIHlldC5cblx0VW5pbml0aWFsaXplZCA9IDEsXG5cdC8vIFRoZSBwcm9jZXNzIGlzIGN1cnJlbnRseSBsYXVuY2hpbmcsIHRoZSBwcm9jZXNzIGlzIG1hcmtlZCBhcyBsYXVuY2hpbmdcblx0Ly8gZm9yIGEgc2hvcnQgZHVyYXRpb24gYWZ0ZXIgYmVpbmcgY3JlYXRlZCBhbmQgaXMgaGVscGZ1bCB0byBpbmRpY2F0ZVxuXHQvLyB3aGV0aGVyIHRoZSBwcm9jZXNzIGRpZWQgYXMgYSByZXN1bHQgb2YgYmFkIHNoZWxsIGFuZCBhcmdzLlxuXHRMYXVuY2hpbmcgPSAyLFxuXHQvLyBUaGUgcHJvY2VzcyBpcyBydW5uaW5nIG5vcm1hbGx5LlxuXHRSdW5uaW5nID0gMyxcblx0Ly8gVGhlIHByb2Nlc3Mgd2FzIGtpbGxlZCBkdXJpbmcgbGF1bmNoLCBsaWtlbHkgYXMgYSByZXN1bHQgb2YgYmFkIHNoZWxsIGFuZFxuXHQvLyBhcmdzLlxuXHRLaWxsZWREdXJpbmdMYXVuY2ggPSA0LFxuXHQvLyBUaGUgcHJvY2VzcyB3YXMga2lsbGVkIGJ5IHRoZSB1c2VyICh0aGUgZXZlbnQgb3JpZ2luYXRlZCBmcm9tIFZTIENvZGUpLlxuXHRLaWxsZWRCeVVzZXIgPSA1LFxuXHQvLyBUaGUgcHJvY2VzcyB3YXMga2lsbGVkIGJ5IGl0c2VsZiwgZm9yIGV4YW1wbGUgdGhlIHNoZWxsIGNyYXNoZWQgb3IgYGV4aXRgXG5cdC8vIHdhcyBydW4uXG5cdEtpbGxlZEJ5UHJvY2VzcyA9IDZcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGVybWluYWxQcm9jZXNzRXh0SG9zdFByb3h5IGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXHRyZWFkb25seSBpbnN0YW5jZUlkOiBudW1iZXI7XG5cblx0ZW1pdERhdGEoZGF0YTogc3RyaW5nKTogdm9pZDtcblx0ZW1pdFByb2Nlc3NQcm9wZXJ0eShwcm9wZXJ0eTogSVByb2Nlc3NQcm9wZXJ0eTxhbnk+KTogdm9pZDtcblx0ZW1pdFJlYWR5KHBpZDogbnVtYmVyLCBjd2Q6IHN0cmluZywgd2luZG93c1B0eTogSVByb2Nlc3NSZWFkeVdpbmRvd3NQdHkgfCB1bmRlZmluZWQpOiB2b2lkO1xuXHRlbWl0RXhpdChleGl0Q29kZTogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZDtcblxuXHRvbklucHV0OiBFdmVudDxzdHJpbmc+O1xuXHRvbkJpbmFyeTogRXZlbnQ8c3RyaW5nPjtcblx0b25SZXNpemU6IEV2ZW50PHsgY29sczogbnVtYmVyOyByb3dzOiBudW1iZXIgfT47XG5cdG9uQWNrbm93bGVkZ2VEYXRhRXZlbnQ6IEV2ZW50PG51bWJlcj47XG5cdG9uU2h1dGRvd246IEV2ZW50PGJvb2xlYW4+O1xuXHRvblJlcXVlc3RJbml0aWFsQ3dkOiBFdmVudDx2b2lkPjtcblx0b25SZXF1ZXN0Q3dkOiBFdmVudDx2b2lkPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU3RhcnRFeHRlbnNpb25UZXJtaW5hbFJlcXVlc3Qge1xuXHRwcm94eTogSVRlcm1pbmFsUHJvY2Vzc0V4dEhvc3RQcm94eTtcblx0Y29sczogbnVtYmVyO1xuXHRyb3dzOiBudW1iZXI7XG5cdGNhbGxiYWNrOiAoZXJyb3I6IElUZXJtaW5hbExhdW5jaEVycm9yIHwgdW5kZWZpbmVkKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUZXJtaW5hbFN0YXR1cyB7XG5cdC8qKiBBbiBpbnRlcm5hbCBzdHJpbmcgSUQgdXNlZCB0byBpZGVudGlmeSB0aGUgc3RhdHVzLiAqL1xuXHRpZDogc3RyaW5nO1xuXHQvKipcblx0ICogVGhlIHNldmVyaXR5IG9mIHRoZSBzdGF0dXMsIHRoaXMgZGVmaW5lcyBib3RoIHRoZSBjb2xvciBhbmQgaG93IGxpa2VseSB0aGUgc3RhdHVzIGlzIHRvIGJlXG5cdCAqIHRoZSBcInByaW1hcnkgc3RhdHVzXCIuXG5cdCAqL1xuXHRzZXZlcml0eTogU2V2ZXJpdHk7XG5cdC8qKlxuXHQgKiBBbiBpY29uIHJlcHJlc2VudGluZyB0aGUgc3RhdHVzLCBpZiB0aGlzIGlzIG5vdCBzcGVjaWZpZWQgaXQgd2lsbCBub3Qgc2hvdyB1cCBvbiB0aGUgdGVybWluYWxcblx0ICogdGFiIGFuZCB3aWxsIHVzZSB0aGUgZ2VuZXJpYyBgaW5mb2AgaWNvbiB3aGVuIGhvdmVyaW5nLlxuXHQgKi9cblx0aWNvbj86IFRoZW1lSWNvbjtcblx0LyoqXG5cdCAqIFdoYXQgdG8gc2hvdyBmb3IgdGhpcyBzdGF0dXMgaW4gdGhlIHRlcm1pbmFsJ3MgaG92ZXIuXG5cdCAqL1xuXHR0b29sdGlwPzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHQvKipcblx0ICogV2hhdCB0byBzaG93IGZvciB0aGlzIHN0YXR1cyBpbiB0aGUgdGVybWluYWwncyBob3ZlciB3aGVuIGRldGFpbHMgYXJlIHRvZ2dsZWQuXG5cdCAqL1xuXHRkZXRhaWxlZFRvb2x0aXA/OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdC8qKlxuXHQgKiBBY3Rpb25zIHRvIGV4cG9zZSBvbiBob3Zlci5cblx0ICovXG5cdGhvdmVyQWN0aW9ucz86IElUZXJtaW5hbFN0YXR1c0hvdmVyQWN0aW9uW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRlcm1pbmFsU3RhdHVzSG92ZXJBY3Rpb24ge1xuXHRsYWJlbDogc3RyaW5nO1xuXHRjb21tYW5kSWQ6IHN0cmluZztcblx0cnVuOiAoKSA9PiB2b2lkO1xufVxuXG4vKipcbiAqIENvbnRleHQgZm9yIGFjdGlvbnMgdGFrZW4gb24gdGVybWluYWwgaW5zdGFuY2VzLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElTZXJpYWxpemVkVGVybWluYWxJbnN0YW5jZUNvbnRleHQge1xuXHQkbWlkOiBNYXJzaGFsbGVkSWQuVGVybWluYWxDb250ZXh0O1xuXHRpbnN0YW5jZUlkOiBudW1iZXI7XG59XG5cbmV4cG9ydCBjb25zdCBRVUlDS19MQVVOQ0hfUFJPRklMRV9DSE9JQ0UgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5wcm9maWxlLmNob2ljZSc7XG5cbmV4cG9ydCBjb25zdCBlbnVtIFRlcm1pbmFsQ29tbWFuZElkIHtcblx0VG9nZ2xlID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwudG9nZ2xlVGVybWluYWwnLFxuXHRLaWxsID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwua2lsbCcsXG5cdEtpbGxWaWV3T3JFZGl0b3IgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5raWxsVmlld09yRWRpdG9yJyxcblx0S2lsbEVkaXRvciA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmtpbGxFZGl0b3InLFxuXHRLaWxsQWN0aXZlVGFiID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwua2lsbEFjdGl2ZVRhYicsXG5cdEtpbGxBbGwgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5raWxsQWxsJyxcblx0UXVpY2tLaWxsID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwucXVpY2tLaWxsJyxcblx0Q29uZmlndXJlVGVybWluYWxTZXR0aW5ncyA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLm9wZW5TZXR0aW5ncycsXG5cdFNoZWxsSW50ZWdyYXRpb25MZWFybk1vcmUgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5sZWFybk1vcmUnLFxuXHRDb3B5TGFzdENvbW1hbmQgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5jb3B5TGFzdENvbW1hbmQnLFxuXHRDb3B5TGFzdENvbW1hbmRPdXRwdXQgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5jb3B5TGFzdENvbW1hbmRPdXRwdXQnLFxuXHRDb3B5TGFzdENvbW1hbmRBbmRMYXN0Q29tbWFuZE91dHB1dCA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmNvcHlMYXN0Q29tbWFuZEFuZExhc3RDb21tYW5kT3V0cHV0Jyxcblx0Q29weUFuZENsZWFyU2VsZWN0aW9uID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuY29weUFuZENsZWFyU2VsZWN0aW9uJyxcblx0Q29weVNlbGVjdGlvbiA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmNvcHlTZWxlY3Rpb24nLFxuXHRDb3B5U2VsZWN0aW9uQXNIdG1sID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuY29weVNlbGVjdGlvbkFzSHRtbCcsXG5cdFNlbGVjdEFsbCA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNlbGVjdEFsbCcsXG5cdERlbGV0ZVdvcmRMZWZ0ID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuZGVsZXRlV29yZExlZnQnLFxuXHREZWxldGVXb3JkUmlnaHQgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5kZWxldGVXb3JkUmlnaHQnLFxuXHREZWxldGVUb0xpbmVTdGFydCA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmRlbGV0ZVRvTGluZVN0YXJ0Jyxcblx0TW92ZVRvTGluZVN0YXJ0ID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwubW92ZVRvTGluZVN0YXJ0Jyxcblx0TW92ZVRvTGluZUVuZCA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLm1vdmVUb0xpbmVFbmQnLFxuXHROZXcgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5uZXcnLFxuXHROZXdXaXRoQ3dkID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwubmV3V2l0aEN3ZCcsXG5cdE5ld0xvY2FsID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwubmV3TG9jYWwnLFxuXHROZXdJbkFjdGl2ZVdvcmtzcGFjZSA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLm5ld0luQWN0aXZlV29ya3NwYWNlJyxcblx0TmV3V2l0aFByb2ZpbGUgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5uZXdXaXRoUHJvZmlsZScsXG5cdFNwbGl0ID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc3BsaXQnLFxuXHRTcGxpdEFjdGl2ZVRhYiA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNwbGl0QWN0aXZlVGFiJyxcblx0U3BsaXRJbkFjdGl2ZVdvcmtzcGFjZSA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNwbGl0SW5BY3RpdmVXb3Jrc3BhY2UnLFxuXHRVbnNwbGl0ID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwudW5zcGxpdCcsXG5cdEpvaW5BY3RpdmVUYWIgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5qb2luQWN0aXZlVGFiJyxcblx0Sm9pbiA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmpvaW4nLFxuXHRSZWxhdW5jaCA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnJlbGF1bmNoJyxcblx0Rm9jdXNQcmV2aW91c1BhbmUgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5mb2N1c1ByZXZpb3VzUGFuZScsXG5cdENyZWF0ZVRlcm1pbmFsRWRpdG9yID0gJ3dvcmtiZW5jaC5hY3Rpb24uY3JlYXRlVGVybWluYWxFZGl0b3InLFxuXHRDcmVhdGVUZXJtaW5hbEVkaXRvclNhbWVHcm91cCA9ICd3b3JrYmVuY2guYWN0aW9uLmNyZWF0ZVRlcm1pbmFsRWRpdG9yU2FtZUdyb3VwJyxcblx0Q3JlYXRlVGVybWluYWxFZGl0b3JTaWRlID0gJ3dvcmtiZW5jaC5hY3Rpb24uY3JlYXRlVGVybWluYWxFZGl0b3JTaWRlJyxcblx0Rm9jdXNUYWJzID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuZm9jdXNUYWJzJyxcblx0Rm9jdXNOZXh0UGFuZSA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmZvY3VzTmV4dFBhbmUnLFxuXHRSZXNpemVQYW5lTGVmdCA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnJlc2l6ZVBhbmVMZWZ0Jyxcblx0UmVzaXplUGFuZVJpZ2h0ID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwucmVzaXplUGFuZVJpZ2h0Jyxcblx0UmVzaXplUGFuZVVwID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwucmVzaXplUGFuZVVwJyxcblx0U2l6ZVRvQ29udGVudFdpZHRoID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc2l6ZVRvQ29udGVudFdpZHRoJyxcblx0U2l6ZVRvQ29udGVudFdpZHRoQWN0aXZlVGFiID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc2l6ZVRvQ29udGVudFdpZHRoQWN0aXZlVGFiJyxcblx0UmVzaXplUGFuZURvd24gPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5yZXNpemVQYW5lRG93bicsXG5cdEZvY3VzID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuZm9jdXMnLFxuXHRGb2N1c05leHQgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5mb2N1c05leHQnLFxuXHRGb2N1c1ByZXZpb3VzID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuZm9jdXNQcmV2aW91cycsXG5cdFBhc3RlID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwucGFzdGUnLFxuXHRQYXN0ZVNlbGVjdGlvbiA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnBhc3RlU2VsZWN0aW9uJyxcblx0U2VsZWN0RGVmYXVsdFByb2ZpbGUgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zZWxlY3REZWZhdWx0U2hlbGwnLFxuXHRSdW5TZWxlY3RlZFRleHQgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5ydW5TZWxlY3RlZFRleHQnLFxuXHRSdW5BY3RpdmVGaWxlID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwucnVuQWN0aXZlRmlsZScsXG5cdFN3aXRjaFRlcm1pbmFsID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc3dpdGNoVGVybWluYWwnLFxuXHRTY3JvbGxEb3duTGluZSA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNjcm9sbERvd24nLFxuXHRTY3JvbGxEb3duUGFnZSA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNjcm9sbERvd25QYWdlJyxcblx0U2Nyb2xsVG9Cb3R0b20gPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zY3JvbGxUb0JvdHRvbScsXG5cdFNjcm9sbFVwTGluZSA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNjcm9sbFVwJyxcblx0U2Nyb2xsVXBQYWdlID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc2Nyb2xsVXBQYWdlJyxcblx0U2Nyb2xsVG9Ub3AgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zY3JvbGxUb1RvcCcsXG5cdENsZWFyID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuY2xlYXInLFxuXHRDbGVhclNlbGVjdGlvbiA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmNsZWFyU2VsZWN0aW9uJyxcblx0Q2hhbmdlSWNvbiA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmNoYW5nZUljb24nLFxuXHRDaGFuZ2VJY29uQWN0aXZlVGFiID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuY2hhbmdlSWNvbkFjdGl2ZVRhYicsXG5cdENoYW5nZUNvbG9yID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuY2hhbmdlQ29sb3InLFxuXHRDaGFuZ2VDb2xvckFjdGl2ZVRhYiA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmNoYW5nZUNvbG9yQWN0aXZlVGFiJyxcblx0UmVuYW1lID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwucmVuYW1lJyxcblx0UmVuYW1lQWN0aXZlVGFiID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwucmVuYW1lQWN0aXZlVGFiJyxcblx0UmVuYW1lV2l0aEFyZ3MgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5yZW5hbWVXaXRoQXJnJyxcblx0U2Nyb2xsVG9QcmV2aW91c0NvbW1hbmQgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zY3JvbGxUb1ByZXZpb3VzQ29tbWFuZCcsXG5cdFNjcm9sbFRvTmV4dENvbW1hbmQgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zY3JvbGxUb05leHRDb21tYW5kJyxcblx0U2VsZWN0VG9QcmV2aW91c0NvbW1hbmQgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zZWxlY3RUb1ByZXZpb3VzQ29tbWFuZCcsXG5cdFNlbGVjdFRvTmV4dENvbW1hbmQgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zZWxlY3RUb05leHRDb21tYW5kJyxcblx0U2VsZWN0VG9QcmV2aW91c0xpbmUgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zZWxlY3RUb1ByZXZpb3VzTGluZScsXG5cdFNlbGVjdFRvTmV4dExpbmUgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5zZWxlY3RUb05leHRMaW5lJyxcblx0U2VuZFNlcXVlbmNlID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc2VuZFNlcXVlbmNlJyxcblx0QXR0YWNoVG9TZXNzaW9uID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuYXR0YWNoVG9TZXNzaW9uJyxcblx0RGV0YWNoU2Vzc2lvbiA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmRldGFjaFNlc3Npb24nLFxuXHRNb3ZlVG9FZGl0b3IgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5tb3ZlVG9FZGl0b3InLFxuXHRNb3ZlVG9UZXJtaW5hbFBhbmVsID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwubW92ZVRvVGVybWluYWxQYW5lbCcsXG5cdE1vdmVJbnRvTmV3V2luZG93ID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwubW92ZUludG9OZXdXaW5kb3cnLFxuXHRTZXREaW1lbnNpb25zID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc2V0RGltZW5zaW9ucycsXG5cdEZvY3VzSG92ZXIgPSAnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5mb2N1c0hvdmVyJyxcblx0U2hvd0Vudmlyb25tZW50Q29udHJpYnV0aW9ucyA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnNob3dFbnZpcm9ubWVudENvbnRyaWJ1dGlvbnMnLFxuXHRTdGFydFZvaWNlID0gJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuc3RhcnRWb2ljZScsXG5cdFN0b3BWb2ljZSA9ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnN0b3BWb2ljZScsXG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0NPTU1BTkRTX1RPX1NLSVBfU0hFTEw6IHN0cmluZ1tdID0gW1xuXHRUZXJtaW5hbENvbW1hbmRJZC5DbGVhclNlbGVjdGlvbixcblx0VGVybWluYWxDb21tYW5kSWQuQ2xlYXIsXG5cdFRlcm1pbmFsQ29tbWFuZElkLkNvcHlBbmRDbGVhclNlbGVjdGlvbixcblx0VGVybWluYWxDb21tYW5kSWQuQ29weVNlbGVjdGlvbixcblx0VGVybWluYWxDb21tYW5kSWQuQ29weVNlbGVjdGlvbkFzSHRtbCxcblx0VGVybWluYWxDb21tYW5kSWQuQ29weUxhc3RDb21tYW5kLFxuXHRUZXJtaW5hbENvbW1hbmRJZC5Db3B5TGFzdENvbW1hbmRPdXRwdXQsXG5cdFRlcm1pbmFsQ29tbWFuZElkLkNvcHlMYXN0Q29tbWFuZEFuZExhc3RDb21tYW5kT3V0cHV0LFxuXHRUZXJtaW5hbENvbW1hbmRJZC5EZWxldGVUb0xpbmVTdGFydCxcblx0VGVybWluYWxDb21tYW5kSWQuRGVsZXRlV29yZExlZnQsXG5cdFRlcm1pbmFsQ29tbWFuZElkLkRlbGV0ZVdvcmRSaWdodCxcblx0VGVybWluYWxDb21tYW5kSWQuRm9jdXNOZXh0UGFuZSxcblx0VGVybWluYWxDb21tYW5kSWQuRm9jdXNOZXh0LFxuXHRUZXJtaW5hbENvbW1hbmRJZC5Gb2N1c1ByZXZpb3VzUGFuZSxcblx0VGVybWluYWxDb21tYW5kSWQuRm9jdXNQcmV2aW91cyxcblx0VGVybWluYWxDb21tYW5kSWQuRm9jdXMsXG5cdFRlcm1pbmFsQ29tbWFuZElkLlNpemVUb0NvbnRlbnRXaWR0aCxcblx0VGVybWluYWxDb21tYW5kSWQuS2lsbCxcblx0VGVybWluYWxDb21tYW5kSWQuS2lsbEVkaXRvcixcblx0VGVybWluYWxDb21tYW5kSWQuTW92ZVRvRWRpdG9yLFxuXHRUZXJtaW5hbENvbW1hbmRJZC5Nb3ZlVG9MaW5lRW5kLFxuXHRUZXJtaW5hbENvbW1hbmRJZC5Nb3ZlVG9MaW5lU3RhcnQsXG5cdFRlcm1pbmFsQ29tbWFuZElkLk1vdmVUb1Rlcm1pbmFsUGFuZWwsXG5cdFRlcm1pbmFsQ29tbWFuZElkLk5ld0luQWN0aXZlV29ya3NwYWNlLFxuXHRUZXJtaW5hbENvbW1hbmRJZC5OZXcsXG5cdFRlcm1pbmFsQ29tbWFuZElkLlBhc3RlLFxuXHRUZXJtaW5hbENvbW1hbmRJZC5QYXN0ZVNlbGVjdGlvbixcblx0VGVybWluYWxDb21tYW5kSWQuUmVzaXplUGFuZURvd24sXG5cdFRlcm1pbmFsQ29tbWFuZElkLlJlc2l6ZVBhbmVMZWZ0LFxuXHRUZXJtaW5hbENvbW1hbmRJZC5SZXNpemVQYW5lUmlnaHQsXG5cdFRlcm1pbmFsQ29tbWFuZElkLlJlc2l6ZVBhbmVVcCxcblx0VGVybWluYWxDb21tYW5kSWQuUnVuQWN0aXZlRmlsZSxcblx0VGVybWluYWxDb21tYW5kSWQuUnVuU2VsZWN0ZWRUZXh0LFxuXHRUZXJtaW5hbENvbW1hbmRJZC5TY3JvbGxEb3duTGluZSxcblx0VGVybWluYWxDb21tYW5kSWQuU2Nyb2xsRG93blBhZ2UsXG5cdFRlcm1pbmFsQ29tbWFuZElkLlNjcm9sbFRvQm90dG9tLFxuXHRUZXJtaW5hbENvbW1hbmRJZC5TY3JvbGxUb05leHRDb21tYW5kLFxuXHRUZXJtaW5hbENvbW1hbmRJZC5TY3JvbGxUb1ByZXZpb3VzQ29tbWFuZCxcblx0VGVybWluYWxDb21tYW5kSWQuU2Nyb2xsVG9Ub3AsXG5cdFRlcm1pbmFsQ29tbWFuZElkLlNjcm9sbFVwTGluZSxcblx0VGVybWluYWxDb21tYW5kSWQuU2Nyb2xsVXBQYWdlLFxuXHRUZXJtaW5hbENvbW1hbmRJZC5TZW5kU2VxdWVuY2UsXG5cdFRlcm1pbmFsQ29tbWFuZElkLlNlbGVjdEFsbCxcblx0VGVybWluYWxDb21tYW5kSWQuU2VsZWN0VG9OZXh0Q29tbWFuZCxcblx0VGVybWluYWxDb21tYW5kSWQuU2VsZWN0VG9OZXh0TGluZSxcblx0VGVybWluYWxDb21tYW5kSWQuU2VsZWN0VG9QcmV2aW91c0NvbW1hbmQsXG5cdFRlcm1pbmFsQ29tbWFuZElkLlNlbGVjdFRvUHJldmlvdXNMaW5lLFxuXHRUZXJtaW5hbENvbW1hbmRJZC5TcGxpdEluQWN0aXZlV29ya3NwYWNlLFxuXHRUZXJtaW5hbENvbW1hbmRJZC5TcGxpdCxcblx0VGVybWluYWxDb21tYW5kSWQuVG9nZ2xlLFxuXHRUZXJtaW5hbENvbW1hbmRJZC5Gb2N1c0hvdmVyLFxuXHRBY2Nlc3NpYmlsaXR5Q29tbWFuZElkLk9wZW5BY2Nlc3NpYmlsaXR5SGVscCxcblx0J3dvcmtiZW5jaC5hY3Rpb24udGFza3MucmVydW5Gb3JBY3RpdmVUZXJtaW5hbCcsXG5cdCdlZGl0b3IuYWN0aW9uLnRvZ2dsZVRhYkZvY3VzTW9kZScsXG5cdCdub3RpZmljYXRpb25zLmhpZGVMaXN0Jyxcblx0J25vdGlmaWNhdGlvbnMuaGlkZVRvYXN0cycsXG5cdCd3b3JrYmVuY2guYWN0aW9uLmNsb3NlUXVpY2tPcGVuJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24ucXVpY2tPcGVuJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24ucXVpY2tPcGVuUHJldmlvdXNFZGl0b3InLFxuXHQnd29ya2JlbmNoLmFjdGlvbi5zaG93Q29tbWFuZHMnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi50YXNrcy5idWlsZCcsXG5cdCd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLnJlc3RhcnRUYXNrJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24udGFza3MucnVuVGFzaycsXG5cdCd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLnJlUnVuVGFzaycsXG5cdCd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLnNob3dMb2cnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi50YXNrcy5zaG93VGFza3MnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi50YXNrcy50ZXJtaW5hdGUnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi50YXNrcy50ZXN0Jyxcblx0J3dvcmtiZW5jaC5hY3Rpb24udG9nZ2xlRnVsbFNjcmVlbicsXG5cdCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmZvY3VzQXRJbmRleDEnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5mb2N1c0F0SW5kZXgyJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuZm9jdXNBdEluZGV4MycsXG5cdCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmZvY3VzQXRJbmRleDQnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5mb2N1c0F0SW5kZXg1Jyxcblx0J3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuZm9jdXNBdEluZGV4NicsXG5cdCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmZvY3VzQXRJbmRleDcnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5mb2N1c0F0SW5kZXg4Jyxcblx0J3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuZm9jdXNBdEluZGV4OScsXG5cdCd3b3JrYmVuY2guYWN0aW9uLmZvY3VzU2Vjb25kRWRpdG9yR3JvdXAnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi5mb2N1c1RoaXJkRWRpdG9yR3JvdXAnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi5mb2N1c0ZvdXJ0aEVkaXRvckdyb3VwJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24uZm9jdXNGaWZ0aEVkaXRvckdyb3VwJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24uZm9jdXNTaXh0aEVkaXRvckdyb3VwJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24uZm9jdXNTZXZlbnRoRWRpdG9yR3JvdXAnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi5mb2N1c0VpZ2h0aEVkaXRvckdyb3VwJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24uZm9jdXNOZXh0UGFydCcsXG5cdCd3b3JrYmVuY2guYWN0aW9uLmZvY3VzUHJldmlvdXNQYXJ0Jyxcblx0J3dvcmtiZW5jaC5hY3Rpb24ubmV4dFBhbmVsVmlldycsXG5cdCd3b3JrYmVuY2guYWN0aW9uLnByZXZpb3VzUGFuZWxWaWV3Jyxcblx0J3dvcmtiZW5jaC5hY3Rpb24ubmV4dFNpZGVCYXJWaWV3Jyxcblx0J3dvcmtiZW5jaC5hY3Rpb24ucHJldmlvdXNTaWRlQmFyVmlldycsXG5cdCd3b3JrYmVuY2guYWN0aW9uLmRlYnVnLmRpc2Nvbm5lY3QnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5zdGFydCcsXG5cdCd3b3JrYmVuY2guYWN0aW9uLmRlYnVnLnN0b3AnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5ydW4nLFxuXHQnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5yZXN0YXJ0Jyxcblx0J3dvcmtiZW5jaC5hY3Rpb24uZGVidWcuY29udGludWUnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5wYXVzZScsXG5cdCd3b3JrYmVuY2guYWN0aW9uLmRlYnVnLnN0ZXBJbnRvJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24uZGVidWcuc3RlcE91dCcsXG5cdCd3b3JrYmVuY2guYWN0aW9uLmRlYnVnLnN0ZXBPdmVyJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24ubmV4dEVkaXRvcicsXG5cdCd3b3JrYmVuY2guYWN0aW9uLnByZXZpb3VzRWRpdG9yJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24ubmV4dEVkaXRvckluR3JvdXAnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi5wcmV2aW91c0VkaXRvckluR3JvdXAnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi5vcGVuTmV4dFJlY2VudGx5VXNlZEVkaXRvcicsXG5cdCd3b3JrYmVuY2guYWN0aW9uLm9wZW5QcmV2aW91c1JlY2VudGx5VXNlZEVkaXRvcicsXG5cdCd3b3JrYmVuY2guYWN0aW9uLm9wZW5OZXh0UmVjZW50bHlVc2VkRWRpdG9ySW5Hcm91cCcsXG5cdCd3b3JrYmVuY2guYWN0aW9uLm9wZW5QcmV2aW91c1JlY2VudGx5VXNlZEVkaXRvckluR3JvdXAnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi5xdWlja09wZW5QcmV2aW91c1JlY2VudGx5VXNlZEVkaXRvcicsXG5cdCd3b3JrYmVuY2guYWN0aW9uLnF1aWNrT3BlbkxlYXN0UmVjZW50bHlVc2VkRWRpdG9yJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24ucXVpY2tPcGVuUHJldmlvdXNSZWNlbnRseVVzZWRFZGl0b3JJbkdyb3VwJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24ucXVpY2tPcGVuTGVhc3RSZWNlbnRseVVzZWRFZGl0b3JJbkdyb3VwJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24uZm9jdXNBY3RpdmVFZGl0b3JHcm91cCcsXG5cdCd3b3JrYmVuY2guYWN0aW9uLmZvY3VzRmlyc3RFZGl0b3JHcm91cCcsXG5cdCd3b3JrYmVuY2guYWN0aW9uLmZvY3VzTGFzdEVkaXRvckdyb3VwJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24uZmlyc3RFZGl0b3JJbkdyb3VwJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24ubGFzdEVkaXRvckluR3JvdXAnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi5uYXZpZ2F0ZVVwJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24ubmF2aWdhdGVEb3duJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24ubmF2aWdhdGVSaWdodCcsXG5cdCd3b3JrYmVuY2guYWN0aW9uLm5hdmlnYXRlTGVmdCcsXG5cdCd3b3JrYmVuY2guYWN0aW9uLnRvZ2dsZVBhbmVsJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24ucXVpY2tPcGVuVmlldycsXG5cdCd3b3JrYmVuY2guYWN0aW9uLnRvZ2dsZU1heGltaXplZFBhbmVsJyxcblx0J25vdGlmaWNhdGlvbi5hY2NlcHRQcmltYXJ5QWN0aW9uJyxcblx0J3J1bkNvbW1hbmRzJyxcblx0J3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuY2hhdC5zdGFydCcsXG5cdCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmNoYXQuY2xvc2UnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5jaGF0LmRpc2NhcmQnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5jaGF0Lm1ha2VSZXF1ZXN0Jyxcblx0J3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuY2hhdC5jYW5jZWwnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5jaGF0LmZlZWRiYWNrSGVscGZ1bCcsXG5cdCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmNoYXQuZmVlZGJhY2tVbmhlbHBmdWwnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5jaGF0LmZlZWRiYWNrUmVwb3J0SXNzdWUnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5jaGF0LnJ1bkNvbW1hbmQnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5jaGF0Lmluc2VydENvbW1hbmQnLFxuXHQnd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5jaGF0LnZpZXdJbkNoYXQnLFxuXHQuLi5kZWZhdWx0VGVybWluYWxDb250cmliQ29tbWFuZHNUb1NraXBTaGVsbCxcbl07XG5cbmV4cG9ydCBjb25zdCB0ZXJtaW5hbENvbnRyaWJ1dGlvbnNEZXNjcmlwdG9yOiBJRXh0ZW5zaW9uUG9pbnREZXNjcmlwdG9yPElUZXJtaW5hbENvbnRyaWJ1dGlvbnM+ID0ge1xuXHRleHRlbnNpb25Qb2ludDogJ3Rlcm1pbmFsJyxcblx0ZGVmYXVsdEV4dGVuc2lvbktpbmQ6IFsnd29ya3NwYWNlJ10sXG5cdGFjdGl2YXRpb25FdmVudHNHZW5lcmF0b3I6IChjb250cmliczogSVRlcm1pbmFsQ29udHJpYnV0aW9uc1tdLCByZXN1bHQ6IHsgcHVzaChpdGVtOiBzdHJpbmcpOiB2b2lkIH0pID0+IHtcblx0XHRmb3IgKGNvbnN0IGNvbnRyaWIgb2YgY29udHJpYnMpIHtcblx0XHRcdGZvciAoY29uc3QgcHJvZmlsZUNvbnRyaWIgb2YgKGNvbnRyaWIucHJvZmlsZXMgPz8gW10pKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGBvblRlcm1pbmFsUHJvZmlsZToke3Byb2ZpbGVDb250cmliLmlkfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcblx0anNvblNjaGVtYToge1xuXHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMudGVybWluYWwnLCAnQ29udHJpYnV0ZXMgdGVybWluYWwgZnVuY3Rpb25hbGl0eS4nKSxcblx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRwcm9maWxlczoge1xuXHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnRlcm1pbmFsLnByb2ZpbGVzJywgXCJEZWZpbmVzIGFkZGl0aW9uYWwgdGVybWluYWwgcHJvZmlsZXMgdGhhdCB0aGUgdXNlciBjYW4gY3JlYXRlLlwiKSxcblx0XHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRyZXF1aXJlZDogWydpZCcsICd0aXRsZSddLFxuXHRcdFx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3tcblx0XHRcdFx0XHRcdGJvZHk6IHtcblx0XHRcdFx0XHRcdFx0aWQ6ICckMScsXG5cdFx0XHRcdFx0XHRcdHRpdGxlOiAnJDInXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0aWQ6IHtcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy50ZXJtaW5hbC5wcm9maWxlcy5pZCcsIFwiVGhlIElEIG9mIHRoZSB0ZXJtaW5hbCBwcm9maWxlIHByb3ZpZGVyLlwiKSxcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy50ZXJtaW5hbC5wcm9maWxlcy50aXRsZScsIFwiVGl0bGUgZm9yIHRoaXMgdGVybWluYWwgcHJvZmlsZS5cIiksXG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGljb246IHtcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy50ZXJtaW5hbC50eXBlcy5pY29uJywgXCJBIGNvZGljb24sIFVSSSwgb3IgbGlnaHQgYW5kIGRhcmsgVVJJcyB0byBhc3NvY2lhdGUgd2l0aCB0aGlzIHRlcm1pbmFsIHR5cGUuXCIpLFxuXHRcdFx0XHRcdFx0XHRhbnlPZjogW3tcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdFx0XHRcdGxpZ2h0OiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMudGVybWluYWwudHlwZXMuaWNvbi5saWdodCcsICdJY29uIHBhdGggd2hlbiBhIGxpZ2h0IHRoZW1lIGlzIHVzZWQnKSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRkYXJrOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMudGVybWluYWwudHlwZXMuaWNvbi5kYXJrJywgJ0ljb24gcGF0aCB3aGVuIGEgZGFyayB0aGVtZSBpcyB1c2VkJyksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHR9LFxuXHR9LFxufTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQVFBLFNBQThCLGVBQWdDO0FBSTlELFlBQVksU0FBUztBQUNyQixTQUFTLHVCQUF1QjtBQUloQyxTQUFTLDhCQUE4QjtBQUd2QyxTQUFTLGlEQUFpRDtBQUVuRCxNQUFNLG1CQUFtQjtBQUV6QixNQUFNLDZCQUE2QixDQUFDLDRDQUE0QyxpQ0FBaUMsZ0NBQWdDLGlDQUFpQztBQUVsTCxNQUFNLDBCQUEwQjtBQUVoQyxNQUFNLHlCQUF5QjtBQUMvQixNQUFNLHlCQUF5QjtBQU0vQixNQUFNLHNCQUFzQixVQUFVLE1BQU07QUFFNUMsTUFBTSxzQkFBc0I7QUFDNUIsTUFBTSxzQkFBc0I7QUFD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LEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQSx1QkFBdUI7QUFBQSxFQUN2QjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxF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
