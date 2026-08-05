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
import { localize } from "../../../../nls.js";
import { ConfigurationScope, Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { workbenchConfigurationNodeBase, Extensions as WorkbenchExtensions } from "../../../common/configuration.js";
import { AccessibilitySignal } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { AccessibilityVoiceSettingId, ISpeechService, SPEECH_LANGUAGES } from "../../speech/common/speechService.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Event } from "../../../../base/common/event.js";
import { isDefined } from "../../../../base/common/types.js";
const accessibilityHelpIsShown = new RawContextKey("accessibilityHelpIsShown", false, true);
const accessibleViewIsShown = new RawContextKey("accessibleViewIsShown", false, true);
const accessibleViewSupportsNavigation = new RawContextKey("accessibleViewSupportsNavigation", false, true);
const accessibleViewVerbosityEnabled = new RawContextKey("accessibleViewVerbosityEnabled", false, true);
const accessibleViewGoToSymbolSupported = new RawContextKey("accessibleViewGoToSymbolSupported", false, true);
const accessibleViewOnLastLine = new RawContextKey("accessibleViewOnLastLine", false, true);
const accessibleViewCurrentProviderId = new RawContextKey("accessibleViewCurrentProviderId", void 0, void 0);
const accessibleViewInCodeBlock = new RawContextKey("accessibleViewInCodeBlock", void 0, void 0);
const accessibleViewContainsCodeBlocks = new RawContextKey("accessibleViewContainsCodeBlocks", void 0, void 0);
const accessibleViewHasUnassignedKeybindings = new RawContextKey("accessibleViewHasUnassignedKeybindings", void 0, void 0);
const accessibleViewHasAssignedKeybindings = new RawContextKey("accessibleViewHasAssignedKeybindings", void 0, void 0);
var AccessibilityWorkbenchSettingId = /* @__PURE__ */ ((AccessibilityWorkbenchSettingId2) => {
  AccessibilityWorkbenchSettingId2["DimUnfocusedEnabled"] = "accessibility.dimUnfocused.enabled";
  AccessibilityWorkbenchSettingId2["DimUnfocusedOpacity"] = "accessibility.dimUnfocused.opacity";
  AccessibilityWorkbenchSettingId2["HideAccessibleView"] = "accessibility.hideAccessibleView";
  AccessibilityWorkbenchSettingId2["AccessibleViewCloseOnKeyPress"] = "accessibility.accessibleView.closeOnKeyPress";
  return AccessibilityWorkbenchSettingId2;
})(AccessibilityWorkbenchSettingId || {});
var ViewDimUnfocusedOpacityProperties = /* @__PURE__ */ ((ViewDimUnfocusedOpacityProperties2) => {
  ViewDimUnfocusedOpacityProperties2[ViewDimUnfocusedOpacityProperties2["Default"] = 0.75] = "Default";
  ViewDimUnfocusedOpacityProperties2[ViewDimUnfocusedOpacityProperties2["Minimum"] = 0.2] = "Minimum";
  ViewDimUnfocusedOpacityProperties2[ViewDimUnfocusedOpacityProperties2["Maximum"] = 1] = "Maximum";
  return ViewDimUnfocusedOpacityProperties2;
})(ViewDimUnfocusedOpacityProperties || {});
var AccessibilityVerbositySettingId = /* @__PURE__ */ ((AccessibilityVerbositySettingId2) => {
  AccessibilityVerbositySettingId2["Terminal"] = "accessibility.verbosity.terminal";
  AccessibilityVerbositySettingId2["DiffEditor"] = "accessibility.verbosity.diffEditor";
  AccessibilityVerbositySettingId2["MergeEditor"] = "accessibility.verbosity.mergeEditor";
  AccessibilityVerbositySettingId2["Chat"] = "accessibility.verbosity.panelChat";
  AccessibilityVerbositySettingId2["InlineChat"] = "accessibility.verbosity.inlineChat";
  AccessibilityVerbositySettingId2["TerminalChat"] = "accessibility.verbosity.terminalChat";
  AccessibilityVerbositySettingId2["InlineCompletions"] = "accessibility.verbosity.inlineCompletions";
  AccessibilityVerbositySettingId2["KeybindingsEditor"] = "accessibility.verbosity.keybindingsEditor";
  AccessibilityVerbositySettingId2["Notebook"] = "accessibility.verbosity.notebook";
  AccessibilityVerbositySettingId2["Editor"] = "accessibility.verbosity.editor";
  AccessibilityVerbositySettingId2["Hover"] = "accessibility.verbosity.hover";
  AccessibilityVerbositySettingId2["Notification"] = "accessibility.verbosity.notification";
  AccessibilityVerbositySettingId2["EmptyEditorHint"] = "accessibility.verbosity.emptyEditorHint";
  AccessibilityVerbositySettingId2["ReplEditor"] = "accessibility.verbosity.replEditor";
  AccessibilityVerbositySettingId2["Comments"] = "accessibility.verbosity.comments";
  AccessibilityVerbositySettingId2["DiffEditorActive"] = "accessibility.verbosity.diffEditorActive";
  AccessibilityVerbositySettingId2["Debug"] = "accessibility.verbosity.debug";
  AccessibilityVerbositySettingId2["Walkthrough"] = "accessibility.verbosity.walkthrough";
  AccessibilityVerbositySettingId2["SourceControl"] = "accessibility.verbosity.sourceControl";
  return AccessibilityVerbositySettingId2;
})(AccessibilityVerbositySettingId || {});
const baseVerbosityProperty = {
  type: "boolean",
  default: true,
  tags: ["accessibility"]
};
const accessibilityConfigurationNodeBase = Object.freeze({
  id: "accessibility",
  title: localize("accessibilityConfigurationTitle", "Accessibility"),
  type: "object"
});
const soundFeatureBase = {
  "type": "string",
  "enum": ["auto", "on", "off"],
  "default": "auto",
  "enumDescriptions": [
    localize("sound.enabled.auto", "Enable sound when a screen reader is attached."),
    localize("sound.enabled.on", "Enable sound."),
    localize("sound.enabled.off", "Disable sound.")
  ],
  tags: ["accessibility"]
};
const signalFeatureBase = {
  "type": "object",
  "tags": ["accessibility"],
  additionalProperties: false,
  default: {
    sound: "auto",
    announcement: "auto"
  }
};
const announcementFeatureBase = {
  "type": "string",
  "enum": ["auto", "off"],
  "default": "auto",
  "enumDescriptions": [
    localize("announcement.enabled.auto", "Enable announcement, will only play when in screen reader optimized mode."),
    localize("announcement.enabled.off", "Disable announcement.")
  ],
  tags: ["accessibility"]
};
const defaultNoAnnouncement = {
  "type": "object",
  "tags": ["accessibility"],
  additionalProperties: false,
  "default": {
    "sound": "auto"
  }
};
const configuration = {
  ...accessibilityConfigurationNodeBase,
  scope: ConfigurationScope.RESOURCE,
  properties: {
    ["accessibility.verbosity.terminal" /* Terminal */]: {
      description: localize("verbosity.terminal.description", "Provide information about how to access the terminal accessibility help menu when the terminal is focused."),
      ...baseVerbosityProperty
    },
    ["accessibility.verbosity.diffEditor" /* DiffEditor */]: {
      description: localize("verbosity.diffEditor.description", "Provide information about how to navigate changes in the diff editor when it is focused."),
      ...baseVerbosityProperty
    },
    ["accessibility.verbosity.panelChat" /* Chat */]: {
      description: localize("verbosity.chat.description", "Provide information about how to access the chat help menu when the chat input is focused."),
      ...baseVerbosityProperty
    },
    ["accessibility.verbosity.inlineChat" /* InlineChat */]: {
      description: localize("verbosity.interactiveEditor.description", "Provide information about how to access the inline editor chat accessibility help menu and alert with hints that describe how to use the feature when the input is focused."),
      ...baseVerbosityProperty
    },
    ["accessibility.verbosity.inlineCompletions" /* InlineCompletions */]: {
      description: localize("verbosity.inlineCompletions.description", "Provide information about how to access the inline completions hover and Accessible View."),
      ...baseVerbosityProperty
    },
    ["accessibility.verbosity.keybindingsEditor" /* KeybindingsEditor */]: {
      description: localize("verbosity.keybindingsEditor.description", "Provide information about how to change a keybinding in the keybindings editor when a row is focused."),
      ...baseVerbosityProperty
    },
    ["accessibility.verbosity.notebook" /* Notebook */]: {
      description: localize("verbosity.notebook", "Provide information about how to focus the cell container or inner editor when a notebook cell is focused."),
      ...baseVerbosityProperty
    },
    ["accessibility.verbosity.hover" /* Hover */]: {
      description: localize("verbosity.hover", "Provide information about how to open the hover in an Accessible View."),
      ...baseVerbosityProperty
    },
    ["accessibility.verbosity.notification" /* Notification */]: {
      description: localize("verbosity.notification", "Provide information about how to open the notification in an Accessible View."),
      ...baseVerbosityProperty
    },
    ["accessibility.verbosity.emptyEditorHint" /* EmptyEditorHint */]: {
      description: localize("verbosity.emptyEditorHint", "Provide information about relevant actions in an empty text editor."),
      ...baseVerbosityProperty
    },
    ["accessibility.verbosity.replEditor" /* ReplEditor */]: {
      description: localize("verbosity.replEditor.description", "Provide information about how to access the REPL editor accessibility help menu when the REPL editor is focused."),
      ...baseVerbosityProperty
    },
    ["accessibility.verbosity.comments" /* Comments */]: {
      description: localize("verbosity.comments", "Provide information about actions that can be taken in the comment widget or in a file which contains comments."),
      ...baseVerbosityProperty
    },
    ["accessibility.verbosity.diffEditorActive" /* DiffEditorActive */]: {
      description: localize("verbosity.diffEditorActive", "Indicate when a diff editor becomes the active editor."),
      ...baseVerbosityProperty
    },
    ["accessibility.verbosity.debug" /* Debug */]: {
      description: localize("verbosity.debug", "Provide information about how to access the debug console accessibility help dialog when the debug console or run and debug viewlet is focused. Note that a reload of the window is required for this to take effect."),
      ...baseVerbosityProperty
    },
    ["accessibility.verbosity.walkthrough" /* Walkthrough */]: {
      description: localize("verbosity.walkthrough", "Provide information about how to open the walkthrough in an Accessible View."),
      ...baseVerbosityProperty
    },
    ["accessibility.accessibleView.closeOnKeyPress" /* AccessibleViewCloseOnKeyPress */]: {
      markdownDescription: localize("terminal.integrated.accessibleView.closeOnKeyPress", "On keypress, close the Accessible View and focus the element from which it was invoked."),
      type: "boolean",
      default: true
    },
    ["accessibility.verbosity.sourceControl" /* SourceControl */]: {
      description: localize("verbosity.scm", "Provide information about how to access the source control accessibility help menu when the input is focused."),
      ...baseVerbosityProperty
    },
    "accessibility.signalOptions.volume": {
      "description": localize("accessibility.signalOptions.volume", "The volume of the sounds in percent (0-100)."),
      "type": "number",
      "minimum": 0,
      "maximum": 100,
      "default": 70,
      "tags": ["accessibility"]
    },
    "accessibility.signalOptions.debouncePositionChanges": {
      "description": localize("accessibility.signalOptions.debouncePositionChanges", "Whether or not position changes should be debounced"),
      "type": "boolean",
      "default": false,
      "tags": ["accessibility"]
    },
    "accessibility.signalOptions.experimental.delays.general": {
      "type": "object",
      "description": "Delays for all signals besides error and warning at position",
      "additionalProperties": false,
      "properties": {
        "announcement": {
          "description": localize("accessibility.signalOptions.delays.general.announcement", "The delay in milliseconds before an announcement is made."),
          "type": "number",
          "minimum": 0,
          "default": 3e3
        },
        "sound": {
          "description": localize("accessibility.signalOptions.delays.general.sound", "The delay in milliseconds before a sound is played."),
          "type": "number",
          "minimum": 0,
          "default": 400
        }
      },
      "tags": ["accessibility"]
    },
    "accessibility.signalOptions.experimental.delays.warningAtPosition": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "announcement": {
          "description": localize("accessibility.signalOptions.delays.warningAtPosition.announcement", "The delay in milliseconds before an announcement is made when there's a warning at the position."),
          "type": "number",
          "minimum": 0,
          "default": 3e3
        },
        "sound": {
          "description": localize("accessibility.signalOptions.delays.warningAtPosition.sound", "The delay in milliseconds before a sound is played when there's a warning at the position."),
          "type": "number",
          "minimum": 0,
          "default": 1e3
        }
      },
      "tags": ["accessibility"]
    },
    "accessibility.signalOptions.experimental.delays.errorAtPosition": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "announcement": {
          "description": localize("accessibility.signalOptions.delays.errorAtPosition.announcement", "The delay in milliseconds before an announcement is made when there's an error at the position."),
          "type": "number",
          "minimum": 0,
          "default": 3e3
        },
        "sound": {
          "description": localize("accessibility.signalOptions.delays.errorAtPosition.sound", "The delay in milliseconds before a sound is played when there's an error at the position."),
          "type": "number",
          "minimum": 0,
          "default": 1e3
        }
      },
      "tags": ["accessibility"]
    },
    "accessibility.signals.lineHasBreakpoint": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.lineHasBreakpoint", "Plays a signal - sound (audio cue) and/or announcement (alert) - when the active line has a breakpoint."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.lineHasBreakpoint.sound", "Plays a sound when the active line has a breakpoint."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.lineHasBreakpoint.announcement", "Announces when the active line has a breakpoint."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.lineHasInlineSuggestion": {
      ...defaultNoAnnouncement,
      "description": localize("accessibility.signals.lineHasInlineSuggestion", "Plays a sound / audio cue when the active line has an inline suggestion."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.lineHasInlineSuggestion.sound", "Plays a sound when the active line has an inline suggestion."),
          ...soundFeatureBase,
          "default": "off"
        }
      }
    },
    "accessibility.signals.lineHasError": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.lineHasError", "Plays a signal - sound (audio cue) and/or announcement (alert) - when the active line has an error."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.lineHasError.sound", "Plays a sound when the active line has an error."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.lineHasError.announcement", "Announces when the active line has an error."),
          ...announcementFeatureBase,
          default: "off"
        }
      }
    },
    "accessibility.signals.lineHasFoldedArea": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.lineHasFoldedArea", "Plays a signal - sound (audio cue) and/or announcement (alert) - the active line has a folded area that can be unfolded."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.lineHasFoldedArea.sound", "Plays a sound when the active line has a folded area that can be unfolded."),
          ...soundFeatureBase,
          default: "off"
        },
        "announcement": {
          "description": localize("accessibility.signals.lineHasFoldedArea.announcement", "Announces when the active line has a folded area that can be unfolded."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.lineHasWarning": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.lineHasWarning", "Plays a signal - sound (audio cue) and/or announcement (alert) - when the active line has a warning."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.lineHasWarning.sound", "Plays a sound when the active line has a warning."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.lineHasWarning.announcement", "Announces when the active line has a warning."),
          ...announcementFeatureBase,
          default: "off"
        }
      }
    },
    "accessibility.signals.positionHasError": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.positionHasError", "Plays a signal - sound (audio cue) and/or announcement (alert) - when the active line has a warning."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.positionHasError.sound", "Plays a sound when the active line has a warning."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.positionHasError.announcement", "Announces when the active line has a warning."),
          ...announcementFeatureBase,
          default: "on"
        }
      }
    },
    "accessibility.signals.positionHasWarning": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.positionHasWarning", "Plays a signal - sound (audio cue) and/or announcement (alert) - when the active line has a warning."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.positionHasWarning.sound", "Plays a sound when the active line has a warning."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.positionHasWarning.announcement", "Announces when the active line has a warning."),
          ...announcementFeatureBase,
          default: "on"
        }
      }
    },
    "accessibility.signals.onDebugBreak": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.onDebugBreak", "Plays a signal - sound (audio cue) and/or announcement (alert) - when the debugger stopped on a breakpoint."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.onDebugBreak.sound", "Plays a sound when the debugger stopped on a breakpoint."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.onDebugBreak.announcement", "Announces when the debugger stopped on a breakpoint."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.noInlayHints": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.noInlayHints", "Plays a signal - sound (audio cue) and/or announcement (alert) - when trying to read a line with inlay hints that has no inlay hints."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.noInlayHints.sound", "Plays a sound when trying to read a line with inlay hints that has no inlay hints."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.noInlayHints.announcement", "Announces when trying to read a line with inlay hints that has no inlay hints."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.taskCompleted": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.taskCompleted", "Plays a signal - sound (audio cue) and/or announcement (alert) - when a task is completed."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.taskCompleted.sound", "Plays a sound when a task is completed."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.taskCompleted.announcement", "Announces when a task is completed."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.taskFailed": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.taskFailed", "Plays a signal - sound (audio cue) and/or announcement (alert) - when a task fails (non-zero exit code)."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.taskFailed.sound", "Plays a sound when a task fails (non-zero exit code)."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.taskFailed.announcement", "Announces when a task fails (non-zero exit code)."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.terminalCommandFailed": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.terminalCommandFailed", "Plays a signal - sound (audio cue) and/or announcement (alert) - when a terminal command fails (non-zero exit code) or when a command with such an exit code is navigated to in the accessible view."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.terminalCommandFailed.sound", "Plays a sound when a terminal command fails (non-zero exit code) or when a command with such an exit code is navigated to in the accessible view."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.terminalCommandFailed.announcement", "Announces when a terminal command fails (non-zero exit code) or when a command with such an exit code is navigated to in the accessible view."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.terminalCommandSucceeded": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.terminalCommandSucceeded", "Plays a signal - sound (audio cue) and/or announcement (alert) - when a terminal command succeeds (zero exit code) or when a command with such an exit code is navigated to in the accessible view."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.terminalCommandSucceeded.sound", "Plays a sound when a terminal command succeeds (zero exit code) or when a command with such an exit code is navigated to in the accessible view."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.terminalCommandSucceeded.announcement", "Announces when a terminal command succeeds (zero exit code) or when a command with such an exit code is navigated to in the accessible view."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.terminalQuickFix": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.terminalQuickFix", "Plays a signal - sound (audio cue) and/or announcement (alert) - when terminal Quick Fixes are available."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.terminalQuickFix.sound", "Plays a sound when terminal Quick Fixes are available."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.terminalQuickFix.announcement", "Announces when terminal Quick Fixes are available."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.terminalBell": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.terminalBell", "Plays a signal - sound (audio cue) and/or announcement (alert) - when the terminal bell is ringing."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.terminalBell.sound", "Plays a sound when the terminal bell is ringing."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.terminalBell.announcement", "Announces when the terminal bell is ringing."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.diffLineInserted": {
      ...defaultNoAnnouncement,
      "description": localize("accessibility.signals.diffLineInserted", "Plays a sound / audio cue when the focus moves to an inserted line in Accessible Diff Viewer mode or to the next/previous change."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.sound", "Plays a sound when the focus moves to an inserted line in Accessible Diff Viewer mode or to the next/previous change."),
          ...soundFeatureBase
        }
      }
    },
    "accessibility.signals.diffLineModified": {
      ...defaultNoAnnouncement,
      "description": localize("accessibility.signals.diffLineModified", "Plays a sound / audio cue when the focus moves to an modified line in Accessible Diff Viewer mode or to the next/previous change."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.diffLineModified.sound", "Plays a sound when the focus moves to a modified line in Accessible Diff Viewer mode or to the next/previous change."),
          ...soundFeatureBase
        }
      }
    },
    "accessibility.signals.diffLineDeleted": {
      ...defaultNoAnnouncement,
      "description": localize("accessibility.signals.diffLineDeleted", "Plays a sound / audio cue when the focus moves to an deleted line in Accessible Diff Viewer mode or to the next/previous change."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.diffLineDeleted.sound", "Plays a sound when the focus moves to an deleted line in Accessible Diff Viewer mode or to the next/previous change."),
          ...soundFeatureBase
        }
      }
    },
    "accessibility.signals.chatEditModifiedFile": {
      ...defaultNoAnnouncement,
      "description": localize("accessibility.signals.chatEditModifiedFile", "Plays a sound / audio cue when revealing a file with changes from chat edits"),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.chatEditModifiedFile.sound", "Plays a sound when revealing a file with changes from chat edits"),
          ...soundFeatureBase
        }
      }
    },
    "accessibility.signals.notebookCellCompleted": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.notebookCellCompleted", "Plays a signal - sound (audio cue) and/or announcement (alert) - when a notebook cell execution is successfully completed."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.notebookCellCompleted.sound", "Plays a sound when a notebook cell execution is successfully completed."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.notebookCellCompleted.announcement", "Announces when a notebook cell execution is successfully completed."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.notebookCellFailed": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.notebookCellFailed", "Plays a signal - sound (audio cue) and/or announcement (alert) - when a notebook cell execution fails."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.notebookCellFailed.sound", "Plays a sound when a notebook cell execution fails."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.notebookCellFailed.announcement", "Announces when a notebook cell execution fails."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.progress": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.progress", "Plays a signal - sound (audio cue) and/or announcement (alert) - on loop while progress is occurring."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.progress.sound", "Plays a sound on loop while progress is occurring."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.progress.announcement", "Alerts on loop while progress is occurring."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.chatRequestSent": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.chatRequestSent", "Plays a signal - sound (audio cue) and/or announcement (alert) - when a chat request is made."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.chatRequestSent.sound", "Plays a sound when a chat request is made."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.chatRequestSent.announcement", "Announces when a chat request is made."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.chatResponseReceived": {
      ...defaultNoAnnouncement,
      "description": localize("accessibility.signals.chatResponseReceived", "Plays a sound / audio cue when the response has been received."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.chatResponseReceived.sound", "Plays a sound on when the response has been received."),
          ...soundFeatureBase
        }
      }
    },
    "accessibility.signals.codeActionTriggered": {
      ...defaultNoAnnouncement,
      "description": localize("accessibility.signals.codeActionTriggered", "Plays a sound / audio cue - when a code action has been triggered."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.codeActionTriggered.sound", "Plays a sound when a code action has been triggered."),
          ...soundFeatureBase
        }
      }
    },
    "accessibility.signals.codeActionApplied": {
      ...defaultNoAnnouncement,
      "description": localize("accessibility.signals.codeActionApplied", "Plays a sound / audio cue when the code action has been applied."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.codeActionApplied.sound", "Plays a sound when the code action has been applied."),
          ...soundFeatureBase
        }
      }
    },
    "accessibility.signals.voiceRecordingStarted": {
      ...defaultNoAnnouncement,
      "description": localize("accessibility.signals.voiceRecordingStarted", "Plays a sound / audio cue when the voice recording has started."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.voiceRecordingStarted.sound", "Plays a sound when the voice recording has started."),
          ...soundFeatureBase
        }
      },
      "default": {
        "sound": "on"
      }
    },
    "accessibility.signals.voiceRecordingStopped": {
      ...defaultNoAnnouncement,
      "description": localize("accessibility.signals.voiceRecordingStopped", "Plays a sound / audio cue when the voice recording has stopped."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.voiceRecordingStopped.sound", "Plays a sound when the voice recording has stopped."),
          ...soundFeatureBase,
          default: "off"
        }
      }
    },
    "accessibility.signals.clear": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.clear", "Plays a signal - sound (audio cue) and/or announcement (alert) - when a feature is cleared (for example, the terminal, Debug Console, or Output channel)."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.clear.sound", "Plays a sound when a feature is cleared."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.clear.announcement", "Announces when a feature is cleared."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.editsUndone": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.editsUndone", "Plays a signal - sound (audio cue) and/or announcement (alert) - when edits have been undone."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.editsUndone.sound", "Plays a sound when edits have been undone."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.editsUndone.announcement", "Announces when edits have been undone."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.editsKept": {
      ...signalFeatureBase,
      "description": localize("accessibility.signals.editsKept", "Plays a signal - sound (audio cue) and/or announcement (alert) - when edits are kept."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.editsKept.sound", "Plays a sound when edits are kept."),
          ...soundFeatureBase
        },
        "announcement": {
          "description": localize("accessibility.signals.editsKept.announcement", "Announces when edits are kept."),
          ...announcementFeatureBase
        }
      }
    },
    "accessibility.signals.save": {
      "type": "object",
      "tags": ["accessibility"],
      additionalProperties: false,
      "markdownDescription": localize("accessibility.signals.save", "Plays a signal - sound (audio cue) and/or announcement (alert) - when a file is saved."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.save.sound", "Plays a sound when a file is saved."),
          "type": "string",
          "enum": ["userGesture", "always", "never"],
          "default": "never",
          "enumDescriptions": [
            localize("accessibility.signals.save.sound.userGesture", "Plays the sound when a user explicitly saves a file."),
            localize("accessibility.signals.save.sound.always", "Plays the sound whenever a file is saved, including auto save."),
            localize("accessibility.signals.save.sound.never", "Never plays the sound.")
          ]
        },
        "announcement": {
          "description": localize("accessibility.signals.save.announcement", "Announces when a file is saved."),
          "type": "string",
          "enum": ["userGesture", "always", "never"],
          "default": "never",
          "enumDescriptions": [
            localize("accessibility.signals.save.announcement.userGesture", "Announces when a user explicitly saves a file."),
            localize("accessibility.signals.save.announcement.always", "Announces whenever a file is saved, including auto save."),
            localize("accessibility.signals.save.announcement.never", "Never plays the announcement.")
          ]
        }
      },
      default: {
        "sound": "never",
        "announcement": "never"
      }
    },
    "accessibility.signals.format": {
      "type": "object",
      "tags": ["accessibility"],
      additionalProperties: false,
      "markdownDescription": localize("accessibility.signals.format", "Plays a signal - sound (audio cue) and/or announcement (alert) - when a file or notebook is formatted."),
      "properties": {
        "sound": {
          "description": localize("accessibility.signals.format.sound", "Plays a sound when a file or notebook is formatted."),
          "type": "string",
          "enum": ["userGesture", "always", "never"],
          "default": "never",
          "enumDescriptions": [
            localize("accessibility.signals.format.userGesture", "Plays the sound when a user explicitly formats a file."),
            localize("accessibility.signals.format.always", "Plays the sound whenever a file is formatted, including if it is set to format on save, type, or, paste, or run of a cell."),
            localize("accessibility.signals.format.never", "Never plays the sound.")
          ]
        },
        "announcement": {
          "description": localize("accessibility.signals.format.announcement", "Announces when a file or notebook is formatted."),
          "type": "string",
          "enum": ["userGesture", "always", "never"],
          "default": "never",
          "enumDescriptions": [
            localize("accessibility.signals.format.announcement.userGesture", "Announces when a user explicitly formats a file."),
            localize("accessibility.signals.format.announcement.always", "Announces whenever a file is formatted, including if it is set to format on save, type, or, paste, or run of a cell."),
            localize("accessibility.signals.format.announcement.never", "Never announces.")
          ]
        }
      },
      default: {
        "sound": "never",
        "announcement": "never"
      }
    },
    "accessibility.underlineLinks": {
      "type": "boolean",
      "description": localize("accessibility.underlineLinks", "Controls whether links should be underlined in the workbench."),
      "default": false
    },
    "accessibility.debugWatchVariableAnnouncements": {
      "type": "boolean",
      "description": localize("accessibility.debugWatchVariableAnnouncements", "Controls whether variable changes should be announced in the debug watch view."),
      "default": true
    },
    "accessibility.replEditor.readLastExecutionOutput": {
      "type": "boolean",
      "description": localize("accessibility.replEditor.readLastExecutedOutput", "Controls whether the output from an execution in the native REPL will be announced."),
      "default": true
    },
    "accessibility.replEditor.autoFocusReplExecution": {
      type: "string",
      enum: ["none", "input", "lastExecution"],
      default: "input",
      description: localize("replEditor.autoFocusAppendedCell", "Control whether focus should automatically be sent to the REPL when code is executed.")
    },
    "accessibility.windowTitleOptimized": {
      "type": "boolean",
      "default": true,
      "markdownDescription": localize("accessibility.windowTitleOptimized", "Controls whether the {0} should be optimized for screen readers when in screen reader mode. When enabled, the window title will have {1} appended to the end.", "`#window.title#`", "`activeEditorState`")
    }
  }
};
function registerAccessibilityConfiguration() {
  const registry = Registry.as(Extensions.Configuration);
  registry.registerConfiguration(configuration);
  registry.registerConfiguration({
    ...workbenchConfigurationNodeBase,
    properties: {
      ["accessibility.dimUnfocused.enabled" /* DimUnfocusedEnabled */]: {
        description: localize("dimUnfocusedEnabled", "Whether to dim unfocused editors and terminals, which makes it more clear where typed input will go to. This works with the majority of editors with the notable exceptions of those that utilize iframes like notebooks and extension webview editors."),
        type: "boolean",
        default: false,
        tags: ["accessibility"],
        scope: ConfigurationScope.APPLICATION
      },
      ["accessibility.dimUnfocused.opacity" /* DimUnfocusedOpacity */]: {
        markdownDescription: localize("dimUnfocusedOpacity", "The opacity fraction (0.2 to 1.0) to use for unfocused editors and terminals. This will only take effect when {0} is enabled.", `\`#${"accessibility.dimUnfocused.enabled" /* DimUnfocusedEnabled */}#\``),
        type: "number",
        minimum: 0.2 /* Minimum */,
        maximum: 1 /* Maximum */,
        default: 0.75 /* Default */,
        tags: ["accessibility"],
        scope: ConfigurationScope.APPLICATION
      },
      ["accessibility.hideAccessibleView" /* HideAccessibleView */]: {
        description: localize("accessibility.hideAccessibleView", "Controls whether the Accessible View is hidden."),
        type: "boolean",
        default: false,
        tags: ["accessibility"]
      }
    }
  });
}
const SpeechTimeoutDefault = 1200;
let DynamicSpeechAccessibilityConfiguration = class extends Disposable {
  constructor(speechService) {
    super();
    this.speechService = speechService;
    this._register(Event.runAndSubscribe(speechService.onDidChangeHasSpeechProvider, () => this.updateConfiguration()));
  }
  updateConfiguration() {
    if (!this.speechService.hasSpeechProvider) {
      return;
    }
    const languages = this.getLanguages();
    const languagesSorted = Object.keys(languages).sort((langA, langB) => {
      return languages[langA].name.localeCompare(languages[langB].name);
    });
    const registry = Registry.as(Extensions.Configuration);
    registry.registerConfiguration({
      ...accessibilityConfigurationNodeBase,
      properties: {
        [AccessibilityVoiceSettingId.SpeechTimeout]: {
          "markdownDescription": localize("voice.speechTimeout", "The duration in milliseconds that voice speech recognition remains active after you stop speaking. For example in a chat session, the transcribed text is submitted automatically after the timeout is met. Set to `0` to disable this feature."),
          "type": "number",
          "default": SpeechTimeoutDefault,
          "minimum": 0,
          "tags": ["accessibility"]
        },
        [AccessibilityVoiceSettingId.IgnoreCodeBlocks]: {
          "markdownDescription": localize("voice.ignoreCodeBlocks", "Whether to ignore code snippets in text-to-speech synthesis."),
          "type": "boolean",
          "default": false,
          "tags": ["accessibility"]
        },
        [AccessibilityVoiceSettingId.SpeechLanguage]: {
          "markdownDescription": localize("voice.speechLanguage", "The language that text-to-speech and speech-to-text should use. Select `auto` to use the configured display language if possible. Note that not all display languages maybe supported by speech recognition and synthesizers."),
          "type": "string",
          "enum": languagesSorted,
          "default": "auto",
          "tags": ["accessibility"],
          "enumDescriptions": languagesSorted.map((key) => languages[key].name),
          "enumItemLabels": languagesSorted.map((key) => languages[key].name)
        },
        [AccessibilityVoiceSettingId.AutoSynthesize]: {
          "type": "string",
          "enum": ["on", "off"],
          "enumDescriptions": [
            localize("accessibility.voice.autoSynthesize.on", "Enable the feature. When a screen reader is enabled, note that this will disable aria updates."),
            localize("accessibility.voice.autoSynthesize.off", "Disable the feature.")
          ],
          "markdownDescription": localize("autoSynthesize", "Whether a textual response should automatically be read out aloud when speech was used as input. For example in a chat session, a response is automatically synthesized when voice was used as chat request."),
          "default": "off",
          "tags": ["accessibility"]
        }
      }
    });
  }
  getLanguages() {
    return {
      ["auto"]: {
        name: localize("speechLanguage.auto", "Auto (Use Display Language)")
      },
      ...SPEECH_LANGUAGES
    };
  }
};
DynamicSpeechAccessibilityConfiguration.ID = "workbench.contrib.dynamicSpeechAccessibilityConfiguration";
DynamicSpeechAccessibilityConfiguration = __decorateClass([
  __decorateParam(0, ISpeechService)
], DynamicSpeechAccessibilityConfiguration);
Registry.as(WorkbenchExtensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: "audioCues.volume",
  migrateFn: (value, accessor) => {
    return [
      ["accessibility.signalOptions.volume", { value }],
      ["audioCues.volume", { value: void 0 }]
    ];
  }
}]);
Registry.as(WorkbenchExtensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: "audioCues.debouncePositionChanges",
  migrateFn: (value) => {
    return [
      ["accessibility.signalOptions.debouncePositionChanges", { value }],
      ["audioCues.debouncePositionChanges", { value: void 0 }]
    ];
  }
}]);
Registry.as(WorkbenchExtensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: "accessibility.signalOptions",
  migrateFn: (value, accessor) => {
    const delayGeneral = getDelaysFromConfig(accessor, "general");
    const delayError = getDelaysFromConfig(accessor, "errorAtPosition");
    const delayWarning = getDelaysFromConfig(accessor, "warningAtPosition");
    const volume = getVolumeFromConfig(accessor);
    const debouncePositionChanges = getDebouncePositionChangesFromConfig(accessor);
    const result = [];
    if (!!volume) {
      result.push(["accessibility.signalOptions.volume", { value: volume }]);
    }
    if (!!delayGeneral) {
      result.push(["accessibility.signalOptions.experimental.delays.general", { value: delayGeneral }]);
    }
    if (!!delayError) {
      result.push(["accessibility.signalOptions.experimental.delays.errorAtPosition", { value: delayError }]);
    }
    if (!!delayWarning) {
      result.push(["accessibility.signalOptions.experimental.delays.warningAtPosition", { value: delayWarning }]);
    }
    if (!!debouncePositionChanges) {
      result.push(["accessibility.signalOptions.debouncePositionChanges", { value: debouncePositionChanges }]);
    }
    result.push(["accessibility.signalOptions", { value: void 0 }]);
    return result;
  }
}]);
Registry.as(WorkbenchExtensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: "accessibility.signals.sounds.volume",
  migrateFn: (value) => {
    return [
      ["accessibility.signalOptions.volume", { value }],
      ["accessibility.signals.sounds.volume", { value: void 0 }]
    ];
  }
}]);
Registry.as(WorkbenchExtensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: "accessibility.signals.debouncePositionChanges",
  migrateFn: (value) => {
    return [
      ["accessibility.signalOptions.debouncePositionChanges", { value }],
      ["accessibility.signals.debouncePositionChanges", { value: void 0 }]
    ];
  }
}]);
function getDelaysFromConfig(accessor, type) {
  return accessor(`accessibility.signalOptions.experimental.delays.${type}`) || accessor("accessibility.signalOptions")?.["experimental.delays"]?.[`${type}`] || accessor("accessibility.signalOptions")?.["delays"]?.[`${type}`];
}
function getVolumeFromConfig(accessor) {
  return accessor("accessibility.signalOptions.volume") || accessor("accessibility.signalOptions")?.volume || accessor("accessibility.signals.sounds.volume") || accessor("audioCues.volume");
}
function getDebouncePositionChangesFromConfig(accessor) {
  return accessor("accessibility.signalOptions.debouncePositionChanges") || accessor("accessibility.signalOptions")?.debouncePositionChanges || accessor("accessibility.signals.debouncePositionChanges") || accessor("audioCues.debouncePositionChanges");
}
Registry.as(WorkbenchExtensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: AccessibilityVoiceSettingId.AutoSynthesize,
  migrateFn: (value) => {
    let newValue;
    if (value === true) {
      newValue = "on";
    } else if (value === false) {
      newValue = "off";
    } else {
      return [];
    }
    return [
      [AccessibilityVoiceSettingId.AutoSynthesize, { value: newValue }]
    ];
  }
}]);
Registry.as(WorkbenchExtensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: "accessibility.signals.chatResponsePending",
  migrateFn: (value, accessor) => {
    return [
      ["accessibility.signals.progress", { value }],
      ["accessibility.signals.chatResponsePending", { value: void 0 }]
    ];
  }
}]);
Registry.as(WorkbenchExtensions.ConfigurationMigration).registerConfigurationMigrations(AccessibilitySignal.allAccessibilitySignals.map((item) => item.legacySoundSettingsKey ? {
  key: item.legacySoundSettingsKey,
  migrateFn: (sound, accessor) => {
    const configurationKeyValuePairs = [];
    const legacyAnnouncementSettingsKey = item.legacyAnnouncementSettingsKey;
    let announcement;
    if (legacyAnnouncementSettingsKey) {
      announcement = accessor(legacyAnnouncementSettingsKey) ?? void 0;
      if (announcement !== void 0 && typeof announcement !== "string") {
        announcement = announcement ? "auto" : "off";
      }
    }
    configurationKeyValuePairs.push([`${item.legacySoundSettingsKey}`, { value: void 0 }]);
    configurationKeyValuePairs.push([`${item.settingsKey}`, { value: announcement !== void 0 ? { announcement, sound } : { sound } }]);
    return configurationKeyValuePairs;
  }
} : void 0).filter(isDefined));
Registry.as(WorkbenchExtensions.ConfigurationMigration).registerConfigurationMigrations(AccessibilitySignal.allAccessibilitySignals.filter((i) => !!i.legacyAnnouncementSettingsKey && !!i.legacySoundSettingsKey).map((item) => ({
  key: item.legacyAnnouncementSettingsKey,
  migrateFn: (announcement, accessor) => {
    const configurationKeyValuePairs = [];
    const sound = accessor(item.settingsKey)?.sound || accessor(item.legacySoundSettingsKey);
    if (announcement !== void 0 && typeof announcement !== "string") {
      announcement = announcement ? "auto" : "off";
    }
    configurationKeyValuePairs.push([`${item.settingsKey}`, { value: announcement !== void 0 ? { announcement, sound } : { sound } }]);
    configurationKeyValuePairs.push([`${item.legacyAnnouncementSettingsKey}`, { value: void 0 }]);
    configurationKeyValuePairs.push([`${item.legacySoundSettingsKey}`, { value: void 0 }]);
    return configurationKeyValuePairs;
  }
})));
export {
  AccessibilityVerbositySettingId,
  AccessibilityVoiceSettingId,
  AccessibilityWorkbenchSettingId,
  DynamicSpeechAccessibilityConfiguration,
  SpeechTimeoutDefault,
  ViewDimUnfocusedOpacityProperties,
  accessibilityConfigurationNodeBase,
  accessibilityHelpIsShown,
  accessibleViewContainsCodeBlocks,
  accessibleViewCurrentProviderId,
  accessibleViewGoToSymbolSupported,
  accessibleViewHasAssignedKeybindings,
  accessibleViewHasUnassignedKeybindings,
  accessibleViewInCodeBlock,
  accessibleViewIsShown,
  accessibleViewOnLastLine,
  accessibleViewSupportsNavigation,
  accessibleViewVerbosityEnabled,
  announcementFeatureBase,
  registerAccessibilityConfiguration,
  soundFeatureBase
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uU2NvcGUsIEV4dGVuc2lvbnMsIElDb25maWd1cmF0aW9uTm9kZSwgSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSwgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyB3b3JrYmVuY2hDb25maWd1cmF0aW9uTm9kZUJhc2UsIEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucywgSUNvbmZpZ3VyYXRpb25NaWdyYXRpb25SZWdpc3RyeSwgQ29uZmlndXJhdGlvbktleVZhbHVlUGFpcnMsIENvbmZpZ3VyYXRpb25NaWdyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5U2lnbmFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlWb2ljZVNldHRpbmdJZCwgSVNwZWVjaFNlcnZpY2UsIFNQRUVDSF9MQU5HVUFHRVMgfSBmcm9tICcuLi8uLi9zcGVlY2gvY29tbW9uL3NwZWVjaFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBpc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5cbmV4cG9ydCBjb25zdCBhY2Nlc3NpYmlsaXR5SGVscElzU2hvd24gPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignYWNjZXNzaWJpbGl0eUhlbHBJc1Nob3duJywgZmFsc2UsIHRydWUpO1xuZXhwb3J0IGNvbnN0IGFjY2Vzc2libGVWaWV3SXNTaG93biA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdhY2Nlc3NpYmxlVmlld0lzU2hvd24nLCBmYWxzZSwgdHJ1ZSk7XG5leHBvcnQgY29uc3QgYWNjZXNzaWJsZVZpZXdTdXBwb3J0c05hdmlnYXRpb24gPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignYWNjZXNzaWJsZVZpZXdTdXBwb3J0c05hdmlnYXRpb24nLCBmYWxzZSwgdHJ1ZSk7XG5leHBvcnQgY29uc3QgYWNjZXNzaWJsZVZpZXdWZXJib3NpdHlFbmFibGVkID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2FjY2Vzc2libGVWaWV3VmVyYm9zaXR5RW5hYmxlZCcsIGZhbHNlLCB0cnVlKTtcbmV4cG9ydCBjb25zdCBhY2Nlc3NpYmxlVmlld0dvVG9TeW1ib2xTdXBwb3J0ZWQgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignYWNjZXNzaWJsZVZpZXdHb1RvU3ltYm9sU3VwcG9ydGVkJywgZmFsc2UsIHRydWUpO1xuZXhwb3J0IGNvbnN0IGFjY2Vzc2libGVWaWV3T25MYXN0TGluZSA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdhY2Nlc3NpYmxlVmlld09uTGFzdExpbmUnLCBmYWxzZSwgdHJ1ZSk7XG5leHBvcnQgY29uc3QgYWNjZXNzaWJsZVZpZXdDdXJyZW50UHJvdmlkZXJJZCA9IG5ldyBSYXdDb250ZXh0S2V5PHN0cmluZz4oJ2FjY2Vzc2libGVWaWV3Q3VycmVudFByb3ZpZGVySWQnLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5leHBvcnQgY29uc3QgYWNjZXNzaWJsZVZpZXdJbkNvZGVCbG9jayA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdhY2Nlc3NpYmxlVmlld0luQ29kZUJsb2NrJywgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuZXhwb3J0IGNvbnN0IGFjY2Vzc2libGVWaWV3Q29udGFpbnNDb2RlQmxvY2tzID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2FjY2Vzc2libGVWaWV3Q29udGFpbnNDb2RlQmxvY2tzJywgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuZXhwb3J0IGNvbnN0IGFjY2Vzc2libGVWaWV3SGFzVW5hc3NpZ25lZEtleWJpbmRpbmdzID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2FjY2Vzc2libGVWaWV3SGFzVW5hc3NpZ25lZEtleWJpbmRpbmdzJywgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuZXhwb3J0IGNvbnN0IGFjY2Vzc2libGVWaWV3SGFzQXNzaWduZWRLZXliaW5kaW5ncyA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdhY2Nlc3NpYmxlVmlld0hhc0Fzc2lnbmVkS2V5YmluZGluZ3MnLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cbi8qKlxuICogTWlzY2VsbGFuZW91cyBzZXR0aW5ncyB0YWdnZWQgd2l0aCBhY2Nlc3NpYmlsaXR5IGFuZCBpbXBsZW1lbnRlZCBpbiB0aGUgYWNjZXNzaWJpbGl0eSBjb250cmliIGJ1dFxuICogd2VyZSBiZXR0ZXIgdG8gbGl2ZSB1bmRlciB3b3JrYmVuY2ggZm9yIGRpc2NvdmVyYWJpbGl0eS5cbiAqL1xuZXhwb3J0IGNvbnN0IGVudW0gQWNjZXNzaWJpbGl0eVdvcmtiZW5jaFNldHRpbmdJZCB7XG5cdERpbVVuZm9jdXNlZEVuYWJsZWQgPSAnYWNjZXNzaWJpbGl0eS5kaW1VbmZvY3VzZWQuZW5hYmxlZCcsXG5cdERpbVVuZm9jdXNlZE9wYWNpdHkgPSAnYWNjZXNzaWJpbGl0eS5kaW1VbmZvY3VzZWQub3BhY2l0eScsXG5cdEhpZGVBY2Nlc3NpYmxlVmlldyA9ICdhY2Nlc3NpYmlsaXR5LmhpZGVBY2Nlc3NpYmxlVmlldycsXG5cdEFjY2Vzc2libGVWaWV3Q2xvc2VPbktleVByZXNzID0gJ2FjY2Vzc2liaWxpdHkuYWNjZXNzaWJsZVZpZXcuY2xvc2VPbktleVByZXNzJ1xufVxuXG5leHBvcnQgY29uc3QgZW51bSBWaWV3RGltVW5mb2N1c2VkT3BhY2l0eVByb3BlcnRpZXMge1xuXHREZWZhdWx0ID0gMC43NSxcblx0TWluaW11bSA9IDAuMixcblx0TWF4aW11bSA9IDFcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZCB7XG5cdFRlcm1pbmFsID0gJ2FjY2Vzc2liaWxpdHkudmVyYm9zaXR5LnRlcm1pbmFsJyxcblx0RGlmZkVkaXRvciA9ICdhY2Nlc3NpYmlsaXR5LnZlcmJvc2l0eS5kaWZmRWRpdG9yJyxcblx0TWVyZ2VFZGl0b3IgPSAnYWNjZXNzaWJpbGl0eS52ZXJib3NpdHkubWVyZ2VFZGl0b3InLFxuXHRDaGF0ID0gJ2FjY2Vzc2liaWxpdHkudmVyYm9zaXR5LnBhbmVsQ2hhdCcsXG5cdElubGluZUNoYXQgPSAnYWNjZXNzaWJpbGl0eS52ZXJib3NpdHkuaW5saW5lQ2hhdCcsXG5cdFRlcm1pbmFsQ2hhdCA9ICdhY2Nlc3NpYmlsaXR5LnZlcmJvc2l0eS50ZXJtaW5hbENoYXQnLFxuXHRJbmxpbmVDb21wbGV0aW9ucyA9ICdhY2Nlc3NpYmlsaXR5LnZlcmJvc2l0eS5pbmxpbmVDb21wbGV0aW9ucycsXG5cdEtleWJpbmRpbmdzRWRpdG9yID0gJ2FjY2Vzc2liaWxpdHkudmVyYm9zaXR5LmtleWJpbmRpbmdzRWRpdG9yJyxcblx0Tm90ZWJvb2sgPSAnYWNjZXNzaWJpbGl0eS52ZXJib3NpdHkubm90ZWJvb2snLFxuXHRFZGl0b3IgPSAnYWNjZXNzaWJpbGl0eS52ZXJib3NpdHkuZWRpdG9yJyxcblx0SG92ZXIgPSAnYWNjZXNzaWJpbGl0eS52ZXJib3NpdHkuaG92ZXInLFxuXHROb3RpZmljYXRpb24gPSAnYWNjZXNzaWJpbGl0eS52ZXJib3NpdHkubm90aWZpY2F0aW9uJyxcblx0RW1wdHlFZGl0b3JIaW50ID0gJ2FjY2Vzc2liaWxpdHkudmVyYm9zaXR5LmVtcHR5RWRpdG9ySGludCcsXG5cdFJlcGxFZGl0b3IgPSAnYWNjZXNzaWJpbGl0eS52ZXJib3NpdHkucmVwbEVkaXRvcicsXG5cdENvbW1lbnRzID0gJ2FjY2Vzc2liaWxpdHkudmVyYm9zaXR5LmNvbW1lbnRzJyxcblx0RGlmZkVkaXRvckFjdGl2ZSA9ICdhY2Nlc3NpYmlsaXR5LnZlcmJvc2l0eS5kaWZmRWRpdG9yQWN0aXZlJyxcblx0RGVidWcgPSAnYWNjZXNzaWJpbGl0eS52ZXJib3NpdHkuZGVidWcnLFxuXHRXYWxrdGhyb3VnaCA9ICdhY2Nlc3NpYmlsaXR5LnZlcmJvc2l0eS53YWxrdGhyb3VnaCcsXG5cdFNvdXJjZUNvbnRyb2wgPSAnYWNjZXNzaWJpbGl0eS52ZXJib3NpdHkuc291cmNlQ29udHJvbCdcbn1cblxuY29uc3QgYmFzZVZlcmJvc2l0eVByb3BlcnR5OiBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hID0ge1xuXHR0eXBlOiAnYm9vbGVhbicsXG5cdGRlZmF1bHQ6IHRydWUsXG5cdHRhZ3M6IFsnYWNjZXNzaWJpbGl0eSddXG59O1xuXG5leHBvcnQgY29uc3QgYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb25Ob2RlQmFzZSA9IE9iamVjdC5mcmVlemU8SUNvbmZpZ3VyYXRpb25Ob2RlPih7XG5cdGlkOiAnYWNjZXNzaWJpbGl0eScsXG5cdHRpdGxlOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb25UaXRsZScsIFwiQWNjZXNzaWJpbGl0eVwiKSxcblx0dHlwZTogJ29iamVjdCdcbn0pO1xuXG5leHBvcnQgY29uc3Qgc291bmRGZWF0dXJlQmFzZTogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSA9IHtcblx0J3R5cGUnOiAnc3RyaW5nJyxcblx0J2VudW0nOiBbJ2F1dG8nLCAnb24nLCAnb2ZmJ10sXG5cdCdkZWZhdWx0JzogJ2F1dG8nLFxuXHQnZW51bURlc2NyaXB0aW9ucyc6IFtcblx0XHRsb2NhbGl6ZSgnc291bmQuZW5hYmxlZC5hdXRvJywgXCJFbmFibGUgc291bmQgd2hlbiBhIHNjcmVlbiByZWFkZXIgaXMgYXR0YWNoZWQuXCIpLFxuXHRcdGxvY2FsaXplKCdzb3VuZC5lbmFibGVkLm9uJywgXCJFbmFibGUgc291bmQuXCIpLFxuXHRcdGxvY2FsaXplKCdzb3VuZC5lbmFibGVkLm9mZicsIFwiRGlzYWJsZSBzb3VuZC5cIilcblx0XSxcblx0dGFnczogWydhY2Nlc3NpYmlsaXR5J10sXG59O1xuXG5jb25zdCBzaWduYWxGZWF0dXJlQmFzZTogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSA9IHtcblx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0J3RhZ3MnOiBbJ2FjY2Vzc2liaWxpdHknXSxcblx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuXHRkZWZhdWx0OiB7XG5cdFx0c291bmQ6ICdhdXRvJyxcblx0XHRhbm5vdW5jZW1lbnQ6ICdhdXRvJ1xuXHR9XG59O1xuXG5leHBvcnQgY29uc3QgYW5ub3VuY2VtZW50RmVhdHVyZUJhc2U6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgPSB7XG5cdCd0eXBlJzogJ3N0cmluZycsXG5cdCdlbnVtJzogWydhdXRvJywgJ29mZiddLFxuXHQnZGVmYXVsdCc6ICdhdXRvJyxcblx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0bG9jYWxpemUoJ2Fubm91bmNlbWVudC5lbmFibGVkLmF1dG8nLCBcIkVuYWJsZSBhbm5vdW5jZW1lbnQsIHdpbGwgb25seSBwbGF5IHdoZW4gaW4gc2NyZWVuIHJlYWRlciBvcHRpbWl6ZWQgbW9kZS5cIiksXG5cdFx0bG9jYWxpemUoJ2Fubm91bmNlbWVudC5lbmFibGVkLm9mZicsIFwiRGlzYWJsZSBhbm5vdW5jZW1lbnQuXCIpXG5cdF0sXG5cdHRhZ3M6IFsnYWNjZXNzaWJpbGl0eSddLFxufTtcblxuY29uc3QgZGVmYXVsdE5vQW5ub3VuY2VtZW50OiBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hID0ge1xuXHQndHlwZSc6ICdvYmplY3QnLFxuXHQndGFncyc6IFsnYWNjZXNzaWJpbGl0eSddLFxuXHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdCdkZWZhdWx0Jzoge1xuXHRcdCdzb3VuZCc6ICdhdXRvJyxcblx0fVxufTtcblxuY29uc3QgY29uZmlndXJhdGlvbjogSUNvbmZpZ3VyYXRpb25Ob2RlID0ge1xuXHQuLi5hY2Nlc3NpYmlsaXR5Q29uZmlndXJhdGlvbk5vZGVCYXNlLFxuXHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLlJFU09VUkNFLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0W0FjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuVGVybWluYWxdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZlcmJvc2l0eS50ZXJtaW5hbC5kZXNjcmlwdGlvbicsICdQcm92aWRlIGluZm9ybWF0aW9uIGFib3V0IGhvdyB0byBhY2Nlc3MgdGhlIHRlcm1pbmFsIGFjY2Vzc2liaWxpdHkgaGVscCBtZW51IHdoZW4gdGhlIHRlcm1pbmFsIGlzIGZvY3VzZWQuJyksXG5cdFx0XHQuLi5iYXNlVmVyYm9zaXR5UHJvcGVydHlcblx0XHR9LFxuXHRcdFtBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkLkRpZmZFZGl0b3JdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZlcmJvc2l0eS5kaWZmRWRpdG9yLmRlc2NyaXB0aW9uJywgJ1Byb3ZpZGUgaW5mb3JtYXRpb24gYWJvdXQgaG93IHRvIG5hdmlnYXRlIGNoYW5nZXMgaW4gdGhlIGRpZmYgZWRpdG9yIHdoZW4gaXQgaXMgZm9jdXNlZC4nKSxcblx0XHRcdC4uLmJhc2VWZXJib3NpdHlQcm9wZXJ0eVxuXHRcdH0sXG5cdFx0W0FjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuQ2hhdF06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndmVyYm9zaXR5LmNoYXQuZGVzY3JpcHRpb24nLCAnUHJvdmlkZSBpbmZvcm1hdGlvbiBhYm91dCBob3cgdG8gYWNjZXNzIHRoZSBjaGF0IGhlbHAgbWVudSB3aGVuIHRoZSBjaGF0IGlucHV0IGlzIGZvY3VzZWQuJyksXG5cdFx0XHQuLi5iYXNlVmVyYm9zaXR5UHJvcGVydHlcblx0XHR9LFxuXHRcdFtBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkLklubGluZUNoYXRdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZlcmJvc2l0eS5pbnRlcmFjdGl2ZUVkaXRvci5kZXNjcmlwdGlvbicsICdQcm92aWRlIGluZm9ybWF0aW9uIGFib3V0IGhvdyB0byBhY2Nlc3MgdGhlIGlubGluZSBlZGl0b3IgY2hhdCBhY2Nlc3NpYmlsaXR5IGhlbHAgbWVudSBhbmQgYWxlcnQgd2l0aCBoaW50cyB0aGF0IGRlc2NyaWJlIGhvdyB0byB1c2UgdGhlIGZlYXR1cmUgd2hlbiB0aGUgaW5wdXQgaXMgZm9jdXNlZC4nKSxcblx0XHRcdC4uLmJhc2VWZXJib3NpdHlQcm9wZXJ0eVxuXHRcdH0sXG5cdFx0W0FjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuSW5saW5lQ29tcGxldGlvbnNdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZlcmJvc2l0eS5pbmxpbmVDb21wbGV0aW9ucy5kZXNjcmlwdGlvbicsICdQcm92aWRlIGluZm9ybWF0aW9uIGFib3V0IGhvdyB0byBhY2Nlc3MgdGhlIGlubGluZSBjb21wbGV0aW9ucyBob3ZlciBhbmQgQWNjZXNzaWJsZSBWaWV3LicpLFxuXHRcdFx0Li4uYmFzZVZlcmJvc2l0eVByb3BlcnR5XG5cdFx0fSxcblx0XHRbQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZC5LZXliaW5kaW5nc0VkaXRvcl06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndmVyYm9zaXR5LmtleWJpbmRpbmdzRWRpdG9yLmRlc2NyaXB0aW9uJywgJ1Byb3ZpZGUgaW5mb3JtYXRpb24gYWJvdXQgaG93IHRvIGNoYW5nZSBhIGtleWJpbmRpbmcgaW4gdGhlIGtleWJpbmRpbmdzIGVkaXRvciB3aGVuIGEgcm93IGlzIGZvY3VzZWQuJyksXG5cdFx0XHQuLi5iYXNlVmVyYm9zaXR5UHJvcGVydHlcblx0XHR9LFxuXHRcdFtBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkLk5vdGVib29rXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2ZXJib3NpdHkubm90ZWJvb2snLCAnUHJvdmlkZSBpbmZvcm1hdGlvbiBhYm91dCBob3cgdG8gZm9jdXMgdGhlIGNlbGwgY29udGFpbmVyIG9yIGlubmVyIGVkaXRvciB3aGVuIGEgbm90ZWJvb2sgY2VsbCBpcyBmb2N1c2VkLicpLFxuXHRcdFx0Li4uYmFzZVZlcmJvc2l0eVByb3BlcnR5XG5cdFx0fSxcblx0XHRbQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZC5Ib3Zlcl06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndmVyYm9zaXR5LmhvdmVyJywgJ1Byb3ZpZGUgaW5mb3JtYXRpb24gYWJvdXQgaG93IHRvIG9wZW4gdGhlIGhvdmVyIGluIGFuIEFjY2Vzc2libGUgVmlldy4nKSxcblx0XHRcdC4uLmJhc2VWZXJib3NpdHlQcm9wZXJ0eVxuXHRcdH0sXG5cdFx0W0FjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuTm90aWZpY2F0aW9uXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2ZXJib3NpdHkubm90aWZpY2F0aW9uJywgJ1Byb3ZpZGUgaW5mb3JtYXRpb24gYWJvdXQgaG93IHRvIG9wZW4gdGhlIG5vdGlmaWNhdGlvbiBpbiBhbiBBY2Nlc3NpYmxlIFZpZXcuJyksXG5cdFx0XHQuLi5iYXNlVmVyYm9zaXR5UHJvcGVydHlcblx0XHR9LFxuXHRcdFtBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkLkVtcHR5RWRpdG9ySGludF06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndmVyYm9zaXR5LmVtcHR5RWRpdG9ySGludCcsICdQcm92aWRlIGluZm9ybWF0aW9uIGFib3V0IHJlbGV2YW50IGFjdGlvbnMgaW4gYW4gZW1wdHkgdGV4dCBlZGl0b3IuJyksXG5cdFx0XHQuLi5iYXNlVmVyYm9zaXR5UHJvcGVydHlcblx0XHR9LFxuXHRcdFtBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkLlJlcGxFZGl0b3JdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZlcmJvc2l0eS5yZXBsRWRpdG9yLmRlc2NyaXB0aW9uJywgJ1Byb3ZpZGUgaW5mb3JtYXRpb24gYWJvdXQgaG93IHRvIGFjY2VzcyB0aGUgUkVQTCBlZGl0b3IgYWNjZXNzaWJpbGl0eSBoZWxwIG1lbnUgd2hlbiB0aGUgUkVQTCBlZGl0b3IgaXMgZm9jdXNlZC4nKSxcblx0XHRcdC4uLmJhc2VWZXJib3NpdHlQcm9wZXJ0eVxuXHRcdH0sXG5cdFx0W0FjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuQ29tbWVudHNdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZlcmJvc2l0eS5jb21tZW50cycsICdQcm92aWRlIGluZm9ybWF0aW9uIGFib3V0IGFjdGlvbnMgdGhhdCBjYW4gYmUgdGFrZW4gaW4gdGhlIGNvbW1lbnQgd2lkZ2V0IG9yIGluIGEgZmlsZSB3aGljaCBjb250YWlucyBjb21tZW50cy4nKSxcblx0XHRcdC4uLmJhc2VWZXJib3NpdHlQcm9wZXJ0eVxuXHRcdH0sXG5cdFx0W0FjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuRGlmZkVkaXRvckFjdGl2ZV06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndmVyYm9zaXR5LmRpZmZFZGl0b3JBY3RpdmUnLCAnSW5kaWNhdGUgd2hlbiBhIGRpZmYgZWRpdG9yIGJlY29tZXMgdGhlIGFjdGl2ZSBlZGl0b3IuJyksXG5cdFx0XHQuLi5iYXNlVmVyYm9zaXR5UHJvcGVydHlcblx0XHR9LFxuXHRcdFtBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkLkRlYnVnXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2ZXJib3NpdHkuZGVidWcnLCAnUHJvdmlkZSBpbmZvcm1hdGlvbiBhYm91dCBob3cgdG8gYWNjZXNzIHRoZSBkZWJ1ZyBjb25zb2xlIGFjY2Vzc2liaWxpdHkgaGVscCBkaWFsb2cgd2hlbiB0aGUgZGVidWcgY29uc29sZSBvciBydW4gYW5kIGRlYnVnIHZpZXdsZXQgaXMgZm9jdXNlZC4gTm90ZSB0aGF0IGEgcmVsb2FkIG9mIHRoZSB3aW5kb3cgaXMgcmVxdWlyZWQgZm9yIHRoaXMgdG8gdGFrZSBlZmZlY3QuJyksXG5cdFx0XHQuLi5iYXNlVmVyYm9zaXR5UHJvcGVydHlcblx0XHR9LFxuXHRcdFtBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkLldhbGt0aHJvdWdoXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2ZXJib3NpdHkud2Fsa3Rocm91Z2gnLCAnUHJvdmlkZSBpbmZvcm1hdGlvbiBhYm91dCBob3cgdG8gb3BlbiB0aGUgd2Fsa3Rocm91Z2ggaW4gYW4gQWNjZXNzaWJsZSBWaWV3LicpLFxuXHRcdFx0Li4uYmFzZVZlcmJvc2l0eVByb3BlcnR5XG5cdFx0fSxcblx0XHRbQWNjZXNzaWJpbGl0eVdvcmtiZW5jaFNldHRpbmdJZC5BY2Nlc3NpYmxlVmlld0Nsb3NlT25LZXlQcmVzc106IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmFjY2Vzc2libGVWaWV3LmNsb3NlT25LZXlQcmVzcycsIFwiT24ga2V5cHJlc3MsIGNsb3NlIHRoZSBBY2Nlc3NpYmxlIFZpZXcgYW5kIGZvY3VzIHRoZSBlbGVtZW50IGZyb20gd2hpY2ggaXQgd2FzIGludm9rZWQuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdH0sXG5cdFx0W0FjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuU291cmNlQ29udHJvbF06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndmVyYm9zaXR5LnNjbScsICdQcm92aWRlIGluZm9ybWF0aW9uIGFib3V0IGhvdyB0byBhY2Nlc3MgdGhlIHNvdXJjZSBjb250cm9sIGFjY2Vzc2liaWxpdHkgaGVscCBtZW51IHdoZW4gdGhlIGlucHV0IGlzIGZvY3VzZWQuJyksXG5cdFx0XHQuLi5iYXNlVmVyYm9zaXR5UHJvcGVydHlcblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbE9wdGlvbnMudm9sdW1lJzoge1xuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucy52b2x1bWUnLCBcIlRoZSB2b2x1bWUgb2YgdGhlIHNvdW5kcyBpbiBwZXJjZW50ICgwLTEwMCkuXCIpLFxuXHRcdFx0J3R5cGUnOiAnbnVtYmVyJyxcblx0XHRcdCdtaW5pbXVtJzogMCxcblx0XHRcdCdtYXhpbXVtJzogMTAwLFxuXHRcdFx0J2RlZmF1bHQnOiA3MCxcblx0XHRcdCd0YWdzJzogWydhY2Nlc3NpYmlsaXR5J11cblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbE9wdGlvbnMuZGVib3VuY2VQb3NpdGlvbkNoYW5nZXMnOiB7XG5cdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxPcHRpb25zLmRlYm91bmNlUG9zaXRpb25DaGFuZ2VzJywgXCJXaGV0aGVyIG9yIG5vdCBwb3NpdGlvbiBjaGFuZ2VzIHNob3VsZCBiZSBkZWJvdW5jZWRcIiksXG5cdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdCdkZWZhdWx0JzogZmFsc2UsXG5cdFx0XHQndGFncyc6IFsnYWNjZXNzaWJpbGl0eSddXG5cdFx0fSxcblx0XHQnYWNjZXNzaWJpbGl0eS5zaWduYWxPcHRpb25zLmV4cGVyaW1lbnRhbC5kZWxheXMuZ2VuZXJhbCc6IHtcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiAnRGVsYXlzIGZvciBhbGwgc2lnbmFscyBiZXNpZGVzIGVycm9yIGFuZCB3YXJuaW5nIGF0IHBvc2l0aW9uJyxcblx0XHRcdCdhZGRpdGlvbmFsUHJvcGVydGllcyc6IGZhbHNlLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdhbm5vdW5jZW1lbnQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucy5kZWxheXMuZ2VuZXJhbC5hbm5vdW5jZW1lbnQnLCBcIlRoZSBkZWxheSBpbiBtaWxsaXNlY29uZHMgYmVmb3JlIGFuIGFubm91bmNlbWVudCBpcyBtYWRlLlwiKSxcblx0XHRcdFx0XHQndHlwZSc6ICdudW1iZXInLFxuXHRcdFx0XHRcdCdtaW5pbXVtJzogMCxcblx0XHRcdFx0XHQnZGVmYXVsdCc6IDMwMDBcblx0XHRcdFx0fSxcblx0XHRcdFx0J3NvdW5kJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbE9wdGlvbnMuZGVsYXlzLmdlbmVyYWwuc291bmQnLCBcIlRoZSBkZWxheSBpbiBtaWxsaXNlY29uZHMgYmVmb3JlIGEgc291bmQgaXMgcGxheWVkLlwiKSxcblx0XHRcdFx0XHQndHlwZSc6ICdudW1iZXInLFxuXHRcdFx0XHRcdCdtaW5pbXVtJzogMCxcblx0XHRcdFx0XHQnZGVmYXVsdCc6IDQwMFxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J3RhZ3MnOiBbJ2FjY2Vzc2liaWxpdHknXVxuXHRcdH0sXG5cdFx0J2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucy5leHBlcmltZW50YWwuZGVsYXlzLndhcm5pbmdBdFBvc2l0aW9uJzoge1xuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdhZGRpdGlvbmFsUHJvcGVydGllcyc6IGZhbHNlLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdhbm5vdW5jZW1lbnQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucy5kZWxheXMud2FybmluZ0F0UG9zaXRpb24uYW5ub3VuY2VtZW50JywgXCJUaGUgZGVsYXkgaW4gbWlsbGlzZWNvbmRzIGJlZm9yZSBhbiBhbm5vdW5jZW1lbnQgaXMgbWFkZSB3aGVuIHRoZXJlJ3MgYSB3YXJuaW5nIGF0IHRoZSBwb3NpdGlvbi5cIiksXG5cdFx0XHRcdFx0J3R5cGUnOiAnbnVtYmVyJyxcblx0XHRcdFx0XHQnbWluaW11bSc6IDAsXG5cdFx0XHRcdFx0J2RlZmF1bHQnOiAzMDAwXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdzb3VuZCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxPcHRpb25zLmRlbGF5cy53YXJuaW5nQXRQb3NpdGlvbi5zb3VuZCcsIFwiVGhlIGRlbGF5IGluIG1pbGxpc2Vjb25kcyBiZWZvcmUgYSBzb3VuZCBpcyBwbGF5ZWQgd2hlbiB0aGVyZSdzIGEgd2FybmluZyBhdCB0aGUgcG9zaXRpb24uXCIpLFxuXHRcdFx0XHRcdCd0eXBlJzogJ251bWJlcicsXG5cdFx0XHRcdFx0J21pbmltdW0nOiAwLFxuXHRcdFx0XHRcdCdkZWZhdWx0JzogMTAwMFxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J3RhZ3MnOiBbJ2FjY2Vzc2liaWxpdHknXVxuXHRcdH0sXG5cdFx0J2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucy5leHBlcmltZW50YWwuZGVsYXlzLmVycm9yQXRQb3NpdGlvbic6IHtcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQnYWRkaXRpb25hbFByb3BlcnRpZXMnOiBmYWxzZSxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnYW5ub3VuY2VtZW50Jzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbE9wdGlvbnMuZGVsYXlzLmVycm9yQXRQb3NpdGlvbi5hbm5vdW5jZW1lbnQnLCBcIlRoZSBkZWxheSBpbiBtaWxsaXNlY29uZHMgYmVmb3JlIGFuIGFubm91bmNlbWVudCBpcyBtYWRlIHdoZW4gdGhlcmUncyBhbiBlcnJvciBhdCB0aGUgcG9zaXRpb24uXCIpLFxuXHRcdFx0XHRcdCd0eXBlJzogJ251bWJlcicsXG5cdFx0XHRcdFx0J21pbmltdW0nOiAwLFxuXHRcdFx0XHRcdCdkZWZhdWx0JzogMzAwMFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnc291bmQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucy5kZWxheXMuZXJyb3JBdFBvc2l0aW9uLnNvdW5kJywgXCJUaGUgZGVsYXkgaW4gbWlsbGlzZWNvbmRzIGJlZm9yZSBhIHNvdW5kIGlzIHBsYXllZCB3aGVuIHRoZXJlJ3MgYW4gZXJyb3IgYXQgdGhlIHBvc2l0aW9uLlwiKSxcblx0XHRcdFx0XHQndHlwZSc6ICdudW1iZXInLFxuXHRcdFx0XHRcdCdtaW5pbXVtJzogMCxcblx0XHRcdFx0XHQnZGVmYXVsdCc6IDEwMDBcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdCd0YWdzJzogWydhY2Nlc3NpYmlsaXR5J11cblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubGluZUhhc0JyZWFrcG9pbnQnOiB7XG5cdFx0XHQuLi5zaWduYWxGZWF0dXJlQmFzZSxcblx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubGluZUhhc0JyZWFrcG9pbnQnLCBcIlBsYXlzIGEgc2lnbmFsIC0gc291bmQgKGF1ZGlvIGN1ZSkgYW5kL29yIGFubm91bmNlbWVudCAoYWxlcnQpIC0gd2hlbiB0aGUgYWN0aXZlIGxpbmUgaGFzIGEgYnJlYWtwb2ludC5cIiksXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J3NvdW5kJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubGluZUhhc0JyZWFrcG9pbnQuc291bmQnLCBcIlBsYXlzIGEgc291bmQgd2hlbiB0aGUgYWN0aXZlIGxpbmUgaGFzIGEgYnJlYWtwb2ludC5cIiksXG5cdFx0XHRcdFx0Li4uc291bmRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnYW5ub3VuY2VtZW50Jzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubGluZUhhc0JyZWFrcG9pbnQuYW5ub3VuY2VtZW50JywgXCJBbm5vdW5jZXMgd2hlbiB0aGUgYWN0aXZlIGxpbmUgaGFzIGEgYnJlYWtwb2ludC5cIiksXG5cdFx0XHRcdFx0Li4uYW5ub3VuY2VtZW50RmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0fSxcblx0XHQnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmxpbmVIYXNJbmxpbmVTdWdnZXN0aW9uJzoge1xuXHRcdFx0Li4uZGVmYXVsdE5vQW5ub3VuY2VtZW50LFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5saW5lSGFzSW5saW5lU3VnZ2VzdGlvbicsIFwiUGxheXMgYSBzb3VuZCAvIGF1ZGlvIGN1ZSB3aGVuIHRoZSBhY3RpdmUgbGluZSBoYXMgYW4gaW5saW5lIHN1Z2dlc3Rpb24uXCIpLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdzb3VuZCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmxpbmVIYXNJbmxpbmVTdWdnZXN0aW9uLnNvdW5kJywgXCJQbGF5cyBhIHNvdW5kIHdoZW4gdGhlIGFjdGl2ZSBsaW5lIGhhcyBhbiBpbmxpbmUgc3VnZ2VzdGlvbi5cIiksXG5cdFx0XHRcdFx0Li4uc291bmRGZWF0dXJlQmFzZSxcblx0XHRcdFx0XHQnZGVmYXVsdCc6ICdvZmYnXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubGluZUhhc0Vycm9yJzoge1xuXHRcdFx0Li4uc2lnbmFsRmVhdHVyZUJhc2UsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmxpbmVIYXNFcnJvcicsIFwiUGxheXMgYSBzaWduYWwgLSBzb3VuZCAoYXVkaW8gY3VlKSBhbmQvb3IgYW5ub3VuY2VtZW50IChhbGVydCkgLSB3aGVuIHRoZSBhY3RpdmUgbGluZSBoYXMgYW4gZXJyb3IuXCIpLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdzb3VuZCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmxpbmVIYXNFcnJvci5zb3VuZCcsIFwiUGxheXMgYSBzb3VuZCB3aGVuIHRoZSBhY3RpdmUgbGluZSBoYXMgYW4gZXJyb3IuXCIpLFxuXHRcdFx0XHRcdC4uLnNvdW5kRmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0J2Fubm91bmNlbWVudCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmxpbmVIYXNFcnJvci5hbm5vdW5jZW1lbnQnLCBcIkFubm91bmNlcyB3aGVuIHRoZSBhY3RpdmUgbGluZSBoYXMgYW4gZXJyb3IuXCIpLFxuXHRcdFx0XHRcdC4uLmFubm91bmNlbWVudEZlYXR1cmVCYXNlLFxuXHRcdFx0XHRcdGRlZmF1bHQ6ICdvZmYnXG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdH0sXG5cdFx0J2FjY2Vzc2liaWxpdHkuc2lnbmFscy5saW5lSGFzRm9sZGVkQXJlYSc6IHtcblx0XHRcdC4uLnNpZ25hbEZlYXR1cmVCYXNlLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5saW5lSGFzRm9sZGVkQXJlYScsIFwiUGxheXMgYSBzaWduYWwgLSBzb3VuZCAoYXVkaW8gY3VlKSBhbmQvb3IgYW5ub3VuY2VtZW50IChhbGVydCkgLSB0aGUgYWN0aXZlIGxpbmUgaGFzIGEgZm9sZGVkIGFyZWEgdGhhdCBjYW4gYmUgdW5mb2xkZWQuXCIpLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdzb3VuZCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmxpbmVIYXNGb2xkZWRBcmVhLnNvdW5kJywgXCJQbGF5cyBhIHNvdW5kIHdoZW4gdGhlIGFjdGl2ZSBsaW5lIGhhcyBhIGZvbGRlZCBhcmVhIHRoYXQgY2FuIGJlIHVuZm9sZGVkLlwiKSxcblx0XHRcdFx0XHQuLi5zb3VuZEZlYXR1cmVCYXNlLFxuXHRcdFx0XHRcdGRlZmF1bHQ6ICdvZmYnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdhbm5vdW5jZW1lbnQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5saW5lSGFzRm9sZGVkQXJlYS5hbm5vdW5jZW1lbnQnLCBcIkFubm91bmNlcyB3aGVuIHRoZSBhY3RpdmUgbGluZSBoYXMgYSBmb2xkZWQgYXJlYSB0aGF0IGNhbiBiZSB1bmZvbGRlZC5cIiksXG5cdFx0XHRcdFx0Li4uYW5ub3VuY2VtZW50RmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdH1cblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubGluZUhhc1dhcm5pbmcnOiB7XG5cdFx0XHQuLi5zaWduYWxGZWF0dXJlQmFzZSxcblx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubGluZUhhc1dhcm5pbmcnLCBcIlBsYXlzIGEgc2lnbmFsIC0gc291bmQgKGF1ZGlvIGN1ZSkgYW5kL29yIGFubm91bmNlbWVudCAoYWxlcnQpIC0gd2hlbiB0aGUgYWN0aXZlIGxpbmUgaGFzIGEgd2FybmluZy5cIiksXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J3NvdW5kJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubGluZUhhc1dhcm5pbmcuc291bmQnLCBcIlBsYXlzIGEgc291bmQgd2hlbiB0aGUgYWN0aXZlIGxpbmUgaGFzIGEgd2FybmluZy5cIiksXG5cdFx0XHRcdFx0Li4uc291bmRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnYW5ub3VuY2VtZW50Jzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubGluZUhhc1dhcm5pbmcuYW5ub3VuY2VtZW50JywgXCJBbm5vdW5jZXMgd2hlbiB0aGUgYWN0aXZlIGxpbmUgaGFzIGEgd2FybmluZy5cIiksXG5cdFx0XHRcdFx0Li4uYW5ub3VuY2VtZW50RmVhdHVyZUJhc2UsXG5cdFx0XHRcdFx0ZGVmYXVsdDogJ29mZidcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0fSxcblx0XHQnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnBvc2l0aW9uSGFzRXJyb3InOiB7XG5cdFx0XHQuLi5zaWduYWxGZWF0dXJlQmFzZSxcblx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMucG9zaXRpb25IYXNFcnJvcicsIFwiUGxheXMgYSBzaWduYWwgLSBzb3VuZCAoYXVkaW8gY3VlKSBhbmQvb3IgYW5ub3VuY2VtZW50IChhbGVydCkgLSB3aGVuIHRoZSBhY3RpdmUgbGluZSBoYXMgYSB3YXJuaW5nLlwiKSxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnc291bmQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5wb3NpdGlvbkhhc0Vycm9yLnNvdW5kJywgXCJQbGF5cyBhIHNvdW5kIHdoZW4gdGhlIGFjdGl2ZSBsaW5lIGhhcyBhIHdhcm5pbmcuXCIpLFxuXHRcdFx0XHRcdC4uLnNvdW5kRmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0J2Fubm91bmNlbWVudCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnBvc2l0aW9uSGFzRXJyb3IuYW5ub3VuY2VtZW50JywgXCJBbm5vdW5jZXMgd2hlbiB0aGUgYWN0aXZlIGxpbmUgaGFzIGEgd2FybmluZy5cIiksXG5cdFx0XHRcdFx0Li4uYW5ub3VuY2VtZW50RmVhdHVyZUJhc2UsXG5cdFx0XHRcdFx0ZGVmYXVsdDogJ29uJ1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMucG9zaXRpb25IYXNXYXJuaW5nJzoge1xuXHRcdFx0Li4uc2lnbmFsRmVhdHVyZUJhc2UsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnBvc2l0aW9uSGFzV2FybmluZycsIFwiUGxheXMgYSBzaWduYWwgLSBzb3VuZCAoYXVkaW8gY3VlKSBhbmQvb3IgYW5ub3VuY2VtZW50IChhbGVydCkgLSB3aGVuIHRoZSBhY3RpdmUgbGluZSBoYXMgYSB3YXJuaW5nLlwiKSxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnc291bmQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5wb3NpdGlvbkhhc1dhcm5pbmcuc291bmQnLCBcIlBsYXlzIGEgc291bmQgd2hlbiB0aGUgYWN0aXZlIGxpbmUgaGFzIGEgd2FybmluZy5cIiksXG5cdFx0XHRcdFx0Li4uc291bmRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnYW5ub3VuY2VtZW50Jzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMucG9zaXRpb25IYXNXYXJuaW5nLmFubm91bmNlbWVudCcsIFwiQW5ub3VuY2VzIHdoZW4gdGhlIGFjdGl2ZSBsaW5lIGhhcyBhIHdhcm5pbmcuXCIpLFxuXHRcdFx0XHRcdC4uLmFubm91bmNlbWVudEZlYXR1cmVCYXNlLFxuXHRcdFx0XHRcdGRlZmF1bHQ6ICdvbidcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0fSxcblx0XHQnYWNjZXNzaWJpbGl0eS5zaWduYWxzLm9uRGVidWdCcmVhayc6IHtcblx0XHRcdC4uLnNpZ25hbEZlYXR1cmVCYXNlLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5vbkRlYnVnQnJlYWsnLCBcIlBsYXlzIGEgc2lnbmFsIC0gc291bmQgKGF1ZGlvIGN1ZSkgYW5kL29yIGFubm91bmNlbWVudCAoYWxlcnQpIC0gd2hlbiB0aGUgZGVidWdnZXIgc3RvcHBlZCBvbiBhIGJyZWFrcG9pbnQuXCIpLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdzb3VuZCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLm9uRGVidWdCcmVhay5zb3VuZCcsIFwiUGxheXMgYSBzb3VuZCB3aGVuIHRoZSBkZWJ1Z2dlciBzdG9wcGVkIG9uIGEgYnJlYWtwb2ludC5cIiksXG5cdFx0XHRcdFx0Li4uc291bmRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnYW5ub3VuY2VtZW50Jzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMub25EZWJ1Z0JyZWFrLmFubm91bmNlbWVudCcsIFwiQW5ub3VuY2VzIHdoZW4gdGhlIGRlYnVnZ2VyIHN0b3BwZWQgb24gYSBicmVha3BvaW50LlwiKSxcblx0XHRcdFx0XHQuLi5hbm5vdW5jZW1lbnRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9LFxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0J2FjY2Vzc2liaWxpdHkuc2lnbmFscy5ub0lubGF5SGludHMnOiB7XG5cdFx0XHQuLi5zaWduYWxGZWF0dXJlQmFzZSxcblx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubm9JbmxheUhpbnRzJywgXCJQbGF5cyBhIHNpZ25hbCAtIHNvdW5kIChhdWRpbyBjdWUpIGFuZC9vciBhbm5vdW5jZW1lbnQgKGFsZXJ0KSAtIHdoZW4gdHJ5aW5nIHRvIHJlYWQgYSBsaW5lIHdpdGggaW5sYXkgaGludHMgdGhhdCBoYXMgbm8gaW5sYXkgaGludHMuXCIpLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdzb3VuZCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLm5vSW5sYXlIaW50cy5zb3VuZCcsIFwiUGxheXMgYSBzb3VuZCB3aGVuIHRyeWluZyB0byByZWFkIGEgbGluZSB3aXRoIGlubGF5IGhpbnRzIHRoYXQgaGFzIG5vIGlubGF5IGhpbnRzLlwiKSxcblx0XHRcdFx0XHQuLi5zb3VuZEZlYXR1cmVCYXNlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdhbm5vdW5jZW1lbnQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5ub0lubGF5SGludHMuYW5ub3VuY2VtZW50JywgXCJBbm5vdW5jZXMgd2hlbiB0cnlpbmcgdG8gcmVhZCBhIGxpbmUgd2l0aCBpbmxheSBoaW50cyB0aGF0IGhhcyBubyBpbmxheSBoaW50cy5cIiksXG5cdFx0XHRcdFx0Li4uYW5ub3VuY2VtZW50RmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdH1cblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGFza0NvbXBsZXRlZCc6IHtcblx0XHRcdC4uLnNpZ25hbEZlYXR1cmVCYXNlLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy50YXNrQ29tcGxldGVkJywgXCJQbGF5cyBhIHNpZ25hbCAtIHNvdW5kIChhdWRpbyBjdWUpIGFuZC9vciBhbm5vdW5jZW1lbnQgKGFsZXJ0KSAtIHdoZW4gYSB0YXNrIGlzIGNvbXBsZXRlZC5cIiksXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J3NvdW5kJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGFza0NvbXBsZXRlZC5zb3VuZCcsIFwiUGxheXMgYSBzb3VuZCB3aGVuIGEgdGFzayBpcyBjb21wbGV0ZWQuXCIpLFxuXHRcdFx0XHRcdC4uLnNvdW5kRmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0J2Fubm91bmNlbWVudCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnRhc2tDb21wbGV0ZWQuYW5ub3VuY2VtZW50JywgXCJBbm5vdW5jZXMgd2hlbiBhIHRhc2sgaXMgY29tcGxldGVkLlwiKSxcblx0XHRcdFx0XHQuLi5hbm5vdW5jZW1lbnRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9LFxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0J2FjY2Vzc2liaWxpdHkuc2lnbmFscy50YXNrRmFpbGVkJzoge1xuXHRcdFx0Li4uc2lnbmFsRmVhdHVyZUJhc2UsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnRhc2tGYWlsZWQnLCBcIlBsYXlzIGEgc2lnbmFsIC0gc291bmQgKGF1ZGlvIGN1ZSkgYW5kL29yIGFubm91bmNlbWVudCAoYWxlcnQpIC0gd2hlbiBhIHRhc2sgZmFpbHMgKG5vbi16ZXJvIGV4aXQgY29kZSkuXCIpLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdzb3VuZCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnRhc2tGYWlsZWQuc291bmQnLCBcIlBsYXlzIGEgc291bmQgd2hlbiBhIHRhc2sgZmFpbHMgKG5vbi16ZXJvIGV4aXQgY29kZSkuXCIpLFxuXHRcdFx0XHRcdC4uLnNvdW5kRmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0J2Fubm91bmNlbWVudCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnRhc2tGYWlsZWQuYW5ub3VuY2VtZW50JywgXCJBbm5vdW5jZXMgd2hlbiBhIHRhc2sgZmFpbHMgKG5vbi16ZXJvIGV4aXQgY29kZSkuXCIpLFxuXHRcdFx0XHRcdC4uLmFubm91bmNlbWVudEZlYXR1cmVCYXNlXG5cdFx0XHRcdH0sXG5cdFx0XHR9XG5cdFx0fSxcblx0XHQnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnRlcm1pbmFsQ29tbWFuZEZhaWxlZCc6IHtcblx0XHRcdC4uLnNpZ25hbEZlYXR1cmVCYXNlLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy50ZXJtaW5hbENvbW1hbmRGYWlsZWQnLCBcIlBsYXlzIGEgc2lnbmFsIC0gc291bmQgKGF1ZGlvIGN1ZSkgYW5kL29yIGFubm91bmNlbWVudCAoYWxlcnQpIC0gd2hlbiBhIHRlcm1pbmFsIGNvbW1hbmQgZmFpbHMgKG5vbi16ZXJvIGV4aXQgY29kZSkgb3Igd2hlbiBhIGNvbW1hbmQgd2l0aCBzdWNoIGFuIGV4aXQgY29kZSBpcyBuYXZpZ2F0ZWQgdG8gaW4gdGhlIGFjY2Vzc2libGUgdmlldy5cIiksXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J3NvdW5kJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGVybWluYWxDb21tYW5kRmFpbGVkLnNvdW5kJywgXCJQbGF5cyBhIHNvdW5kIHdoZW4gYSB0ZXJtaW5hbCBjb21tYW5kIGZhaWxzIChub24temVybyBleGl0IGNvZGUpIG9yIHdoZW4gYSBjb21tYW5kIHdpdGggc3VjaCBhbiBleGl0IGNvZGUgaXMgbmF2aWdhdGVkIHRvIGluIHRoZSBhY2Nlc3NpYmxlIHZpZXcuXCIpLFxuXHRcdFx0XHRcdC4uLnNvdW5kRmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0J2Fubm91bmNlbWVudCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnRlcm1pbmFsQ29tbWFuZEZhaWxlZC5hbm5vdW5jZW1lbnQnLCBcIkFubm91bmNlcyB3aGVuIGEgdGVybWluYWwgY29tbWFuZCBmYWlscyAobm9uLXplcm8gZXhpdCBjb2RlKSBvciB3aGVuIGEgY29tbWFuZCB3aXRoIHN1Y2ggYW4gZXhpdCBjb2RlIGlzIG5hdmlnYXRlZCB0byBpbiB0aGUgYWNjZXNzaWJsZSB2aWV3LlwiKSxcblx0XHRcdFx0XHQuLi5hbm5vdW5jZW1lbnRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9LFxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0J2FjY2Vzc2liaWxpdHkuc2lnbmFscy50ZXJtaW5hbENvbW1hbmRTdWNjZWVkZWQnOiB7XG5cdFx0XHQuLi5zaWduYWxGZWF0dXJlQmFzZSxcblx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGVybWluYWxDb21tYW5kU3VjY2VlZGVkJywgXCJQbGF5cyBhIHNpZ25hbCAtIHNvdW5kIChhdWRpbyBjdWUpIGFuZC9vciBhbm5vdW5jZW1lbnQgKGFsZXJ0KSAtIHdoZW4gYSB0ZXJtaW5hbCBjb21tYW5kIHN1Y2NlZWRzICh6ZXJvIGV4aXQgY29kZSkgb3Igd2hlbiBhIGNvbW1hbmQgd2l0aCBzdWNoIGFuIGV4aXQgY29kZSBpcyBuYXZpZ2F0ZWQgdG8gaW4gdGhlIGFjY2Vzc2libGUgdmlldy5cIiksXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J3NvdW5kJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGVybWluYWxDb21tYW5kU3VjY2VlZGVkLnNvdW5kJywgXCJQbGF5cyBhIHNvdW5kIHdoZW4gYSB0ZXJtaW5hbCBjb21tYW5kIHN1Y2NlZWRzICh6ZXJvIGV4aXQgY29kZSkgb3Igd2hlbiBhIGNvbW1hbmQgd2l0aCBzdWNoIGFuIGV4aXQgY29kZSBpcyBuYXZpZ2F0ZWQgdG8gaW4gdGhlIGFjY2Vzc2libGUgdmlldy5cIiksXG5cdFx0XHRcdFx0Li4uc291bmRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnYW5ub3VuY2VtZW50Jzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGVybWluYWxDb21tYW5kU3VjY2VlZGVkLmFubm91bmNlbWVudCcsIFwiQW5ub3VuY2VzIHdoZW4gYSB0ZXJtaW5hbCBjb21tYW5kIHN1Y2NlZWRzICh6ZXJvIGV4aXQgY29kZSkgb3Igd2hlbiBhIGNvbW1hbmQgd2l0aCBzdWNoIGFuIGV4aXQgY29kZSBpcyBuYXZpZ2F0ZWQgdG8gaW4gdGhlIGFjY2Vzc2libGUgdmlldy5cIiksXG5cdFx0XHRcdFx0Li4uYW5ub3VuY2VtZW50RmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdH1cblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGVybWluYWxRdWlja0ZpeCc6IHtcblx0XHRcdC4uLnNpZ25hbEZlYXR1cmVCYXNlLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy50ZXJtaW5hbFF1aWNrRml4JywgXCJQbGF5cyBhIHNpZ25hbCAtIHNvdW5kIChhdWRpbyBjdWUpIGFuZC9vciBhbm5vdW5jZW1lbnQgKGFsZXJ0KSAtIHdoZW4gdGVybWluYWwgUXVpY2sgRml4ZXMgYXJlIGF2YWlsYWJsZS5cIiksXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J3NvdW5kJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGVybWluYWxRdWlja0ZpeC5zb3VuZCcsIFwiUGxheXMgYSBzb3VuZCB3aGVuIHRlcm1pbmFsIFF1aWNrIEZpeGVzIGFyZSBhdmFpbGFibGUuXCIpLFxuXHRcdFx0XHRcdC4uLnNvdW5kRmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0J2Fubm91bmNlbWVudCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnRlcm1pbmFsUXVpY2tGaXguYW5ub3VuY2VtZW50JywgXCJBbm5vdW5jZXMgd2hlbiB0ZXJtaW5hbCBRdWljayBGaXhlcyBhcmUgYXZhaWxhYmxlLlwiKSxcblx0XHRcdFx0XHQuLi5hbm5vdW5jZW1lbnRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9LFxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0J2FjY2Vzc2liaWxpdHkuc2lnbmFscy50ZXJtaW5hbEJlbGwnOiB7XG5cdFx0XHQuLi5zaWduYWxGZWF0dXJlQmFzZSxcblx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGVybWluYWxCZWxsJywgXCJQbGF5cyBhIHNpZ25hbCAtIHNvdW5kIChhdWRpbyBjdWUpIGFuZC9vciBhbm5vdW5jZW1lbnQgKGFsZXJ0KSAtIHdoZW4gdGhlIHRlcm1pbmFsIGJlbGwgaXMgcmluZ2luZy5cIiksXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J3NvdW5kJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGVybWluYWxCZWxsLnNvdW5kJywgXCJQbGF5cyBhIHNvdW5kIHdoZW4gdGhlIHRlcm1pbmFsIGJlbGwgaXMgcmluZ2luZy5cIiksXG5cdFx0XHRcdFx0Li4uc291bmRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnYW5ub3VuY2VtZW50Jzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGVybWluYWxCZWxsLmFubm91bmNlbWVudCcsIFwiQW5ub3VuY2VzIHdoZW4gdGhlIHRlcm1pbmFsIGJlbGwgaXMgcmluZ2luZy5cIiksXG5cdFx0XHRcdFx0Li4uYW5ub3VuY2VtZW50RmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdH1cblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuZGlmZkxpbmVJbnNlcnRlZCc6IHtcblx0XHRcdC4uLmRlZmF1bHROb0Fubm91bmNlbWVudCxcblx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuZGlmZkxpbmVJbnNlcnRlZCcsIFwiUGxheXMgYSBzb3VuZCAvIGF1ZGlvIGN1ZSB3aGVuIHRoZSBmb2N1cyBtb3ZlcyB0byBhbiBpbnNlcnRlZCBsaW5lIGluIEFjY2Vzc2libGUgRGlmZiBWaWV3ZXIgbW9kZSBvciB0byB0aGUgbmV4dC9wcmV2aW91cyBjaGFuZ2UuXCIpLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdzb3VuZCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnNvdW5kJywgXCJQbGF5cyBhIHNvdW5kIHdoZW4gdGhlIGZvY3VzIG1vdmVzIHRvIGFuIGluc2VydGVkIGxpbmUgaW4gQWNjZXNzaWJsZSBEaWZmIFZpZXdlciBtb2RlIG9yIHRvIHRoZSBuZXh0L3ByZXZpb3VzIGNoYW5nZS5cIiksXG5cdFx0XHRcdFx0Li4uc291bmRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblx0XHQnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmRpZmZMaW5lTW9kaWZpZWQnOiB7XG5cdFx0XHQuLi5kZWZhdWx0Tm9Bbm5vdW5jZW1lbnQsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmRpZmZMaW5lTW9kaWZpZWQnLCBcIlBsYXlzIGEgc291bmQgLyBhdWRpbyBjdWUgd2hlbiB0aGUgZm9jdXMgbW92ZXMgdG8gYW4gbW9kaWZpZWQgbGluZSBpbiBBY2Nlc3NpYmxlIERpZmYgVmlld2VyIG1vZGUgb3IgdG8gdGhlIG5leHQvcHJldmlvdXMgY2hhbmdlLlwiKSxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnc291bmQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5kaWZmTGluZU1vZGlmaWVkLnNvdW5kJywgXCJQbGF5cyBhIHNvdW5kIHdoZW4gdGhlIGZvY3VzIG1vdmVzIHRvIGEgbW9kaWZpZWQgbGluZSBpbiBBY2Nlc3NpYmxlIERpZmYgVmlld2VyIG1vZGUgb3IgdG8gdGhlIG5leHQvcHJldmlvdXMgY2hhbmdlLlwiKSxcblx0XHRcdFx0XHQuLi5zb3VuZEZlYXR1cmVCYXNlXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuZGlmZkxpbmVEZWxldGVkJzoge1xuXHRcdFx0Li4uZGVmYXVsdE5vQW5ub3VuY2VtZW50LFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5kaWZmTGluZURlbGV0ZWQnLCBcIlBsYXlzIGEgc291bmQgLyBhdWRpbyBjdWUgd2hlbiB0aGUgZm9jdXMgbW92ZXMgdG8gYW4gZGVsZXRlZCBsaW5lIGluIEFjY2Vzc2libGUgRGlmZiBWaWV3ZXIgbW9kZSBvciB0byB0aGUgbmV4dC9wcmV2aW91cyBjaGFuZ2UuXCIpLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdzb3VuZCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmRpZmZMaW5lRGVsZXRlZC5zb3VuZCcsIFwiUGxheXMgYSBzb3VuZCB3aGVuIHRoZSBmb2N1cyBtb3ZlcyB0byBhbiBkZWxldGVkIGxpbmUgaW4gQWNjZXNzaWJsZSBEaWZmIFZpZXdlciBtb2RlIG9yIHRvIHRoZSBuZXh0L3ByZXZpb3VzIGNoYW5nZS5cIiksXG5cdFx0XHRcdFx0Li4uc291bmRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblx0XHQnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmNoYXRFZGl0TW9kaWZpZWRGaWxlJzoge1xuXHRcdFx0Li4uZGVmYXVsdE5vQW5ub3VuY2VtZW50LFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5jaGF0RWRpdE1vZGlmaWVkRmlsZScsIFwiUGxheXMgYSBzb3VuZCAvIGF1ZGlvIGN1ZSB3aGVuIHJldmVhbGluZyBhIGZpbGUgd2l0aCBjaGFuZ2VzIGZyb20gY2hhdCBlZGl0c1wiKSxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnc291bmQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5jaGF0RWRpdE1vZGlmaWVkRmlsZS5zb3VuZCcsIFwiUGxheXMgYSBzb3VuZCB3aGVuIHJldmVhbGluZyBhIGZpbGUgd2l0aCBjaGFuZ2VzIGZyb20gY2hhdCBlZGl0c1wiKSxcblx0XHRcdFx0XHQuLi5zb3VuZEZlYXR1cmVCYXNlXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubm90ZWJvb2tDZWxsQ29tcGxldGVkJzoge1xuXHRcdFx0Li4uc2lnbmFsRmVhdHVyZUJhc2UsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLm5vdGVib29rQ2VsbENvbXBsZXRlZCcsIFwiUGxheXMgYSBzaWduYWwgLSBzb3VuZCAoYXVkaW8gY3VlKSBhbmQvb3IgYW5ub3VuY2VtZW50IChhbGVydCkgLSB3aGVuIGEgbm90ZWJvb2sgY2VsbCBleGVjdXRpb24gaXMgc3VjY2Vzc2Z1bGx5IGNvbXBsZXRlZC5cIiksXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J3NvdW5kJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubm90ZWJvb2tDZWxsQ29tcGxldGVkLnNvdW5kJywgXCJQbGF5cyBhIHNvdW5kIHdoZW4gYSBub3RlYm9vayBjZWxsIGV4ZWN1dGlvbiBpcyBzdWNjZXNzZnVsbHkgY29tcGxldGVkLlwiKSxcblx0XHRcdFx0XHQuLi5zb3VuZEZlYXR1cmVCYXNlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdhbm5vdW5jZW1lbnQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5ub3RlYm9va0NlbGxDb21wbGV0ZWQuYW5ub3VuY2VtZW50JywgXCJBbm5vdW5jZXMgd2hlbiBhIG5vdGVib29rIGNlbGwgZXhlY3V0aW9uIGlzIHN1Y2Nlc3NmdWxseSBjb21wbGV0ZWQuXCIpLFxuXHRcdFx0XHRcdC4uLmFubm91bmNlbWVudEZlYXR1cmVCYXNlXG5cdFx0XHRcdH0sXG5cdFx0XHR9XG5cdFx0fSxcblx0XHQnYWNjZXNzaWJpbGl0eS5zaWduYWxzLm5vdGVib29rQ2VsbEZhaWxlZCc6IHtcblx0XHRcdC4uLnNpZ25hbEZlYXR1cmVCYXNlLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5ub3RlYm9va0NlbGxGYWlsZWQnLCBcIlBsYXlzIGEgc2lnbmFsIC0gc291bmQgKGF1ZGlvIGN1ZSkgYW5kL29yIGFubm91bmNlbWVudCAoYWxlcnQpIC0gd2hlbiBhIG5vdGVib29rIGNlbGwgZXhlY3V0aW9uIGZhaWxzLlwiKSxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnc291bmQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5ub3RlYm9va0NlbGxGYWlsZWQuc291bmQnLCBcIlBsYXlzIGEgc291bmQgd2hlbiBhIG5vdGVib29rIGNlbGwgZXhlY3V0aW9uIGZhaWxzLlwiKSxcblx0XHRcdFx0XHQuLi5zb3VuZEZlYXR1cmVCYXNlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdhbm5vdW5jZW1lbnQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5ub3RlYm9va0NlbGxGYWlsZWQuYW5ub3VuY2VtZW50JywgXCJBbm5vdW5jZXMgd2hlbiBhIG5vdGVib29rIGNlbGwgZXhlY3V0aW9uIGZhaWxzLlwiKSxcblx0XHRcdFx0XHQuLi5hbm5vdW5jZW1lbnRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9LFxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0J2FjY2Vzc2liaWxpdHkuc2lnbmFscy5wcm9ncmVzcyc6IHtcblx0XHRcdC4uLnNpZ25hbEZlYXR1cmVCYXNlLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5wcm9ncmVzcycsIFwiUGxheXMgYSBzaWduYWwgLSBzb3VuZCAoYXVkaW8gY3VlKSBhbmQvb3IgYW5ub3VuY2VtZW50IChhbGVydCkgLSBvbiBsb29wIHdoaWxlIHByb2dyZXNzIGlzIG9jY3VycmluZy5cIiksXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J3NvdW5kJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMucHJvZ3Jlc3Muc291bmQnLCBcIlBsYXlzIGEgc291bmQgb24gbG9vcCB3aGlsZSBwcm9ncmVzcyBpcyBvY2N1cnJpbmcuXCIpLFxuXHRcdFx0XHRcdC4uLnNvdW5kRmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0J2Fubm91bmNlbWVudCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnByb2dyZXNzLmFubm91bmNlbWVudCcsIFwiQWxlcnRzIG9uIGxvb3Agd2hpbGUgcHJvZ3Jlc3MgaXMgb2NjdXJyaW5nLlwiKSxcblx0XHRcdFx0XHQuLi5hbm5vdW5jZW1lbnRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuY2hhdFJlcXVlc3RTZW50Jzoge1xuXHRcdFx0Li4uc2lnbmFsRmVhdHVyZUJhc2UsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmNoYXRSZXF1ZXN0U2VudCcsIFwiUGxheXMgYSBzaWduYWwgLSBzb3VuZCAoYXVkaW8gY3VlKSBhbmQvb3IgYW5ub3VuY2VtZW50IChhbGVydCkgLSB3aGVuIGEgY2hhdCByZXF1ZXN0IGlzIG1hZGUuXCIpLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdzb3VuZCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmNoYXRSZXF1ZXN0U2VudC5zb3VuZCcsIFwiUGxheXMgYSBzb3VuZCB3aGVuIGEgY2hhdCByZXF1ZXN0IGlzIG1hZGUuXCIpLFxuXHRcdFx0XHRcdC4uLnNvdW5kRmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0J2Fubm91bmNlbWVudCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmNoYXRSZXF1ZXN0U2VudC5hbm5vdW5jZW1lbnQnLCBcIkFubm91bmNlcyB3aGVuIGEgY2hhdCByZXF1ZXN0IGlzIG1hZGUuXCIpLFxuXHRcdFx0XHRcdC4uLmFubm91bmNlbWVudEZlYXR1cmVCYXNlXG5cdFx0XHRcdH0sXG5cdFx0XHR9XG5cdFx0fSxcblx0XHQnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmNoYXRSZXNwb25zZVJlY2VpdmVkJzoge1xuXHRcdFx0Li4uZGVmYXVsdE5vQW5ub3VuY2VtZW50LFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5jaGF0UmVzcG9uc2VSZWNlaXZlZCcsIFwiUGxheXMgYSBzb3VuZCAvIGF1ZGlvIGN1ZSB3aGVuIHRoZSByZXNwb25zZSBoYXMgYmVlbiByZWNlaXZlZC5cIiksXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J3NvdW5kJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuY2hhdFJlc3BvbnNlUmVjZWl2ZWQuc291bmQnLCBcIlBsYXlzIGEgc291bmQgb24gd2hlbiB0aGUgcmVzcG9uc2UgaGFzIGJlZW4gcmVjZWl2ZWQuXCIpLFxuXHRcdFx0XHRcdC4uLnNvdW5kRmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdH1cblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuY29kZUFjdGlvblRyaWdnZXJlZCc6IHtcblx0XHRcdC4uLmRlZmF1bHROb0Fubm91bmNlbWVudCxcblx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuY29kZUFjdGlvblRyaWdnZXJlZCcsIFwiUGxheXMgYSBzb3VuZCAvIGF1ZGlvIGN1ZSAtIHdoZW4gYSBjb2RlIGFjdGlvbiBoYXMgYmVlbiB0cmlnZ2VyZWQuXCIpLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdzb3VuZCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmNvZGVBY3Rpb25UcmlnZ2VyZWQuc291bmQnLCBcIlBsYXlzIGEgc291bmQgd2hlbiBhIGNvZGUgYWN0aW9uIGhhcyBiZWVuIHRyaWdnZXJlZC5cIiksXG5cdFx0XHRcdFx0Li4uc291bmRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblx0XHQnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmNvZGVBY3Rpb25BcHBsaWVkJzoge1xuXHRcdFx0Li4uZGVmYXVsdE5vQW5ub3VuY2VtZW50LFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5jb2RlQWN0aW9uQXBwbGllZCcsIFwiUGxheXMgYSBzb3VuZCAvIGF1ZGlvIGN1ZSB3aGVuIHRoZSBjb2RlIGFjdGlvbiBoYXMgYmVlbiBhcHBsaWVkLlwiKSxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnc291bmQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5jb2RlQWN0aW9uQXBwbGllZC5zb3VuZCcsIFwiUGxheXMgYSBzb3VuZCB3aGVuIHRoZSBjb2RlIGFjdGlvbiBoYXMgYmVlbiBhcHBsaWVkLlwiKSxcblx0XHRcdFx0XHQuLi5zb3VuZEZlYXR1cmVCYXNlXG5cdFx0XHRcdH0sXG5cdFx0XHR9XG5cdFx0fSxcblx0XHQnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnZvaWNlUmVjb3JkaW5nU3RhcnRlZCc6IHtcblx0XHRcdC4uLmRlZmF1bHROb0Fubm91bmNlbWVudCxcblx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudm9pY2VSZWNvcmRpbmdTdGFydGVkJywgXCJQbGF5cyBhIHNvdW5kIC8gYXVkaW8gY3VlIHdoZW4gdGhlIHZvaWNlIHJlY29yZGluZyBoYXMgc3RhcnRlZC5cIiksXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J3NvdW5kJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudm9pY2VSZWNvcmRpbmdTdGFydGVkLnNvdW5kJywgXCJQbGF5cyBhIHNvdW5kIHdoZW4gdGhlIHZvaWNlIHJlY29yZGluZyBoYXMgc3RhcnRlZC5cIiksXG5cdFx0XHRcdFx0Li4uc291bmRGZWF0dXJlQmFzZSxcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHQnZGVmYXVsdCc6IHtcblx0XHRcdFx0J3NvdW5kJzogJ29uJ1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0J2FjY2Vzc2liaWxpdHkuc2lnbmFscy52b2ljZVJlY29yZGluZ1N0b3BwZWQnOiB7XG5cdFx0XHQuLi5kZWZhdWx0Tm9Bbm5vdW5jZW1lbnQsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnZvaWNlUmVjb3JkaW5nU3RvcHBlZCcsIFwiUGxheXMgYSBzb3VuZCAvIGF1ZGlvIGN1ZSB3aGVuIHRoZSB2b2ljZSByZWNvcmRpbmcgaGFzIHN0b3BwZWQuXCIpLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdzb3VuZCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnZvaWNlUmVjb3JkaW5nU3RvcHBlZC5zb3VuZCcsIFwiUGxheXMgYSBzb3VuZCB3aGVuIHRoZSB2b2ljZSByZWNvcmRpbmcgaGFzIHN0b3BwZWQuXCIpLFxuXHRcdFx0XHRcdC4uLnNvdW5kRmVhdHVyZUJhc2UsXG5cdFx0XHRcdFx0ZGVmYXVsdDogJ29mZidcblx0XHRcdFx0fSxcblx0XHRcdH1cblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuY2xlYXInOiB7XG5cdFx0XHQuLi5zaWduYWxGZWF0dXJlQmFzZSxcblx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuY2xlYXInLCBcIlBsYXlzIGEgc2lnbmFsIC0gc291bmQgKGF1ZGlvIGN1ZSkgYW5kL29yIGFubm91bmNlbWVudCAoYWxlcnQpIC0gd2hlbiBhIGZlYXR1cmUgaXMgY2xlYXJlZCAoZm9yIGV4YW1wbGUsIHRoZSB0ZXJtaW5hbCwgRGVidWcgQ29uc29sZSwgb3IgT3V0cHV0IGNoYW5uZWwpLlwiKSxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnc291bmQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5jbGVhci5zb3VuZCcsIFwiUGxheXMgYSBzb3VuZCB3aGVuIGEgZmVhdHVyZSBpcyBjbGVhcmVkLlwiKSxcblx0XHRcdFx0XHQuLi5zb3VuZEZlYXR1cmVCYXNlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdhbm5vdW5jZW1lbnQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5jbGVhci5hbm5vdW5jZW1lbnQnLCBcIkFubm91bmNlcyB3aGVuIGEgZmVhdHVyZSBpcyBjbGVhcmVkLlwiKSxcblx0XHRcdFx0XHQuLi5hbm5vdW5jZW1lbnRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuZWRpdHNVbmRvbmUnOiB7XG5cdFx0XHQuLi5zaWduYWxGZWF0dXJlQmFzZSxcblx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuZWRpdHNVbmRvbmUnLCBcIlBsYXlzIGEgc2lnbmFsIC0gc291bmQgKGF1ZGlvIGN1ZSkgYW5kL29yIGFubm91bmNlbWVudCAoYWxlcnQpIC0gd2hlbiBlZGl0cyBoYXZlIGJlZW4gdW5kb25lLlwiKSxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnc291bmQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5lZGl0c1VuZG9uZS5zb3VuZCcsIFwiUGxheXMgYSBzb3VuZCB3aGVuIGVkaXRzIGhhdmUgYmVlbiB1bmRvbmUuXCIpLFxuXHRcdFx0XHRcdC4uLnNvdW5kRmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0J2Fubm91bmNlbWVudCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmVkaXRzVW5kb25lLmFubm91bmNlbWVudCcsIFwiQW5ub3VuY2VzIHdoZW4gZWRpdHMgaGF2ZSBiZWVuIHVuZG9uZS5cIiksXG5cdFx0XHRcdFx0Li4uYW5ub3VuY2VtZW50RmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0fSxcblx0XHQnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmVkaXRzS2VwdCc6IHtcblx0XHRcdC4uLnNpZ25hbEZlYXR1cmVCYXNlLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5lZGl0c0tlcHQnLCBcIlBsYXlzIGEgc2lnbmFsIC0gc291bmQgKGF1ZGlvIGN1ZSkgYW5kL29yIGFubm91bmNlbWVudCAoYWxlcnQpIC0gd2hlbiBlZGl0cyBhcmUga2VwdC5cIiksXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J3NvdW5kJzoge1xuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuZWRpdHNLZXB0LnNvdW5kJywgXCJQbGF5cyBhIHNvdW5kIHdoZW4gZWRpdHMgYXJlIGtlcHQuXCIpLFxuXHRcdFx0XHRcdC4uLnNvdW5kRmVhdHVyZUJhc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0J2Fubm91bmNlbWVudCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmVkaXRzS2VwdC5hbm5vdW5jZW1lbnQnLCBcIkFubm91bmNlcyB3aGVuIGVkaXRzIGFyZSBrZXB0LlwiKSxcblx0XHRcdFx0XHQuLi5hbm5vdW5jZW1lbnRGZWF0dXJlQmFzZVxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuc2F2ZSc6IHtcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQndGFncyc6IFsnYWNjZXNzaWJpbGl0eSddLFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuXHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnNhdmUnLCBcIlBsYXlzIGEgc2lnbmFsIC0gc291bmQgKGF1ZGlvIGN1ZSkgYW5kL29yIGFubm91bmNlbWVudCAoYWxlcnQpIC0gd2hlbiBhIGZpbGUgaXMgc2F2ZWQuXCIpLFxuXHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdzb3VuZCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnNhdmUuc291bmQnLCBcIlBsYXlzIGEgc291bmQgd2hlbiBhIGZpbGUgaXMgc2F2ZWQuXCIpLFxuXHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdFx0J2VudW0nOiBbJ3VzZXJHZXN0dXJlJywgJ2Fsd2F5cycsICduZXZlciddLFxuXHRcdFx0XHRcdCdkZWZhdWx0JzogJ25ldmVyJyxcblx0XHRcdFx0XHQnZW51bURlc2NyaXB0aW9ucyc6IFtcblx0XHRcdFx0XHRcdGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuc2F2ZS5zb3VuZC51c2VyR2VzdHVyZScsIFwiUGxheXMgdGhlIHNvdW5kIHdoZW4gYSB1c2VyIGV4cGxpY2l0bHkgc2F2ZXMgYSBmaWxlLlwiKSxcblx0XHRcdFx0XHRcdGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuc2F2ZS5zb3VuZC5hbHdheXMnLCBcIlBsYXlzIHRoZSBzb3VuZCB3aGVuZXZlciBhIGZpbGUgaXMgc2F2ZWQsIGluY2x1ZGluZyBhdXRvIHNhdmUuXCIpLFxuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5zYXZlLnNvdW5kLm5ldmVyJywgXCJOZXZlciBwbGF5cyB0aGUgc291bmQuXCIpXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0fSxcblx0XHRcdFx0J2Fubm91bmNlbWVudCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnNhdmUuYW5ub3VuY2VtZW50JywgXCJBbm5vdW5jZXMgd2hlbiBhIGZpbGUgaXMgc2F2ZWQuXCIpLFxuXHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdFx0J2VudW0nOiBbJ3VzZXJHZXN0dXJlJywgJ2Fsd2F5cycsICduZXZlciddLFxuXHRcdFx0XHRcdCdkZWZhdWx0JzogJ25ldmVyJyxcblx0XHRcdFx0XHQnZW51bURlc2NyaXB0aW9ucyc6IFtcblx0XHRcdFx0XHRcdGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuc2F2ZS5hbm5vdW5jZW1lbnQudXNlckdlc3R1cmUnLCBcIkFubm91bmNlcyB3aGVuIGEgdXNlciBleHBsaWNpdGx5IHNhdmVzIGEgZmlsZS5cIiksXG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnNhdmUuYW5ub3VuY2VtZW50LmFsd2F5cycsIFwiQW5ub3VuY2VzIHdoZW5ldmVyIGEgZmlsZSBpcyBzYXZlZCwgaW5jbHVkaW5nIGF1dG8gc2F2ZS5cIiksXG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnNhdmUuYW5ub3VuY2VtZW50Lm5ldmVyJywgXCJOZXZlciBwbGF5cyB0aGUgYW5ub3VuY2VtZW50LlwiKVxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0ZGVmYXVsdDoge1xuXHRcdFx0XHQnc291bmQnOiAnbmV2ZXInLFxuXHRcdFx0XHQnYW5ub3VuY2VtZW50JzogJ25ldmVyJ1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0J2FjY2Vzc2liaWxpdHkuc2lnbmFscy5mb3JtYXQnOiB7XG5cdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0J3RhZ3MnOiBbJ2FjY2Vzc2liaWxpdHknXSxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcblx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5mb3JtYXQnLCBcIlBsYXlzIGEgc2lnbmFsIC0gc291bmQgKGF1ZGlvIGN1ZSkgYW5kL29yIGFubm91bmNlbWVudCAoYWxlcnQpIC0gd2hlbiBhIGZpbGUgb3Igbm90ZWJvb2sgaXMgZm9ybWF0dGVkLlwiKSxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnc291bmQnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5mb3JtYXQuc291bmQnLCBcIlBsYXlzIGEgc291bmQgd2hlbiBhIGZpbGUgb3Igbm90ZWJvb2sgaXMgZm9ybWF0dGVkLlwiKSxcblx0XHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdCdlbnVtJzogWyd1c2VyR2VzdHVyZScsICdhbHdheXMnLCAnbmV2ZXInXSxcblx0XHRcdFx0XHQnZGVmYXVsdCc6ICduZXZlcicsXG5cdFx0XHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmZvcm1hdC51c2VyR2VzdHVyZScsIFwiUGxheXMgdGhlIHNvdW5kIHdoZW4gYSB1c2VyIGV4cGxpY2l0bHkgZm9ybWF0cyBhIGZpbGUuXCIpLFxuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5mb3JtYXQuYWx3YXlzJywgXCJQbGF5cyB0aGUgc291bmQgd2hlbmV2ZXIgYSBmaWxlIGlzIGZvcm1hdHRlZCwgaW5jbHVkaW5nIGlmIGl0IGlzIHNldCB0byBmb3JtYXQgb24gc2F2ZSwgdHlwZSwgb3IsIHBhc3RlLCBvciBydW4gb2YgYSBjZWxsLlwiKSxcblx0XHRcdFx0XHRcdGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuZm9ybWF0Lm5ldmVyJywgXCJOZXZlciBwbGF5cyB0aGUgc291bmQuXCIpXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0fSxcblx0XHRcdFx0J2Fubm91bmNlbWVudCc6IHtcblx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmZvcm1hdC5hbm5vdW5jZW1lbnQnLCBcIkFubm91bmNlcyB3aGVuIGEgZmlsZSBvciBub3RlYm9vayBpcyBmb3JtYXR0ZWQuXCIpLFxuXHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdFx0J2VudW0nOiBbJ3VzZXJHZXN0dXJlJywgJ2Fsd2F5cycsICduZXZlciddLFxuXHRcdFx0XHRcdCdkZWZhdWx0JzogJ25ldmVyJyxcblx0XHRcdFx0XHQnZW51bURlc2NyaXB0aW9ucyc6IFtcblx0XHRcdFx0XHRcdGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuZm9ybWF0LmFubm91bmNlbWVudC51c2VyR2VzdHVyZScsIFwiQW5ub3VuY2VzIHdoZW4gYSB1c2VyIGV4cGxpY2l0bHkgZm9ybWF0cyBhIGZpbGUuXCIpLFxuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5mb3JtYXQuYW5ub3VuY2VtZW50LmFsd2F5cycsIFwiQW5ub3VuY2VzIHdoZW5ldmVyIGEgZmlsZSBpcyBmb3JtYXR0ZWQsIGluY2x1ZGluZyBpZiBpdCBpcyBzZXQgdG8gZm9ybWF0IG9uIHNhdmUsIHR5cGUsIG9yLCBwYXN0ZSwgb3IgcnVuIG9mIGEgY2VsbC5cIiksXG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmZvcm1hdC5hbm5vdW5jZW1lbnQubmV2ZXInLCBcIk5ldmVyIGFubm91bmNlcy5cIilcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0J3NvdW5kJzogJ25ldmVyJyxcblx0XHRcdFx0J2Fubm91bmNlbWVudCc6ICduZXZlcidcblx0XHRcdH1cblx0XHR9LFxuXHRcdCdhY2Nlc3NpYmlsaXR5LnVuZGVybGluZUxpbmtzJzoge1xuXHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS51bmRlcmxpbmVMaW5rcycsIFwiQ29udHJvbHMgd2hldGhlciBsaW5rcyBzaG91bGQgYmUgdW5kZXJsaW5lZCBpbiB0aGUgd29ya2JlbmNoLlwiKSxcblx0XHRcdCdkZWZhdWx0JzogZmFsc2UsXG5cdFx0fSxcblx0XHQnYWNjZXNzaWJpbGl0eS5kZWJ1Z1dhdGNoVmFyaWFibGVBbm5vdW5jZW1lbnRzJzoge1xuXHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5kZWJ1Z1dhdGNoVmFyaWFibGVBbm5vdW5jZW1lbnRzJywgXCJDb250cm9scyB3aGV0aGVyIHZhcmlhYmxlIGNoYW5nZXMgc2hvdWxkIGJlIGFubm91bmNlZCBpbiB0aGUgZGVidWcgd2F0Y2ggdmlldy5cIiksXG5cdFx0XHQnZGVmYXVsdCc6IHRydWUsXG5cdFx0fSxcblx0XHQnYWNjZXNzaWJpbGl0eS5yZXBsRWRpdG9yLnJlYWRMYXN0RXhlY3V0aW9uT3V0cHV0Jzoge1xuXHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5yZXBsRWRpdG9yLnJlYWRMYXN0RXhlY3V0ZWRPdXRwdXQnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIG91dHB1dCBmcm9tIGFuIGV4ZWN1dGlvbiBpbiB0aGUgbmF0aXZlIFJFUEwgd2lsbCBiZSBhbm5vdW5jZWQuXCIpLFxuXHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdH0sXG5cdFx0J2FjY2Vzc2liaWxpdHkucmVwbEVkaXRvci5hdXRvRm9jdXNSZXBsRXhlY3V0aW9uJzoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ25vbmUnLCAnaW5wdXQnLCAnbGFzdEV4ZWN1dGlvbiddLFxuXHRcdFx0ZGVmYXVsdDogJ2lucHV0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgncmVwbEVkaXRvci5hdXRvRm9jdXNBcHBlbmRlZENlbGwnLCBcIkNvbnRyb2wgd2hldGhlciBmb2N1cyBzaG91bGQgYXV0b21hdGljYWxseSBiZSBzZW50IHRvIHRoZSBSRVBMIHdoZW4gY29kZSBpcyBleGVjdXRlZC5cIiksXG5cdFx0fSxcblx0XHQnYWNjZXNzaWJpbGl0eS53aW5kb3dUaXRsZU9wdGltaXplZCc6IHtcblx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS53aW5kb3dUaXRsZU9wdGltaXplZCcsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgezB9IHNob3VsZCBiZSBvcHRpbWl6ZWQgZm9yIHNjcmVlbiByZWFkZXJzIHdoZW4gaW4gc2NyZWVuIHJlYWRlciBtb2RlLiBXaGVuIGVuYWJsZWQsIHRoZSB3aW5kb3cgdGl0bGUgd2lsbCBoYXZlIHsxfSBhcHBlbmRlZCB0byB0aGUgZW5kLlwiLCAnYCN3aW5kb3cudGl0bGUjYCcsICdgYWN0aXZlRWRpdG9yU3RhdGVgJylcblx0XHR9LFxuXHR9XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJBY2Nlc3NpYmlsaXR5Q29uZmlndXJhdGlvbigpIHtcblx0Y29uc3QgcmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pO1xuXHRyZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oY29uZmlndXJhdGlvbik7XG5cblx0cmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0XHQuLi53b3JrYmVuY2hDb25maWd1cmF0aW9uTm9kZUJhc2UsXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0W0FjY2Vzc2liaWxpdHlXb3JrYmVuY2hTZXR0aW5nSWQuRGltVW5mb2N1c2VkRW5hYmxlZF06IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdkaW1VbmZvY3VzZWRFbmFibGVkJywgJ1doZXRoZXIgdG8gZGltIHVuZm9jdXNlZCBlZGl0b3JzIGFuZCB0ZXJtaW5hbHMsIHdoaWNoIG1ha2VzIGl0IG1vcmUgY2xlYXIgd2hlcmUgdHlwZWQgaW5wdXQgd2lsbCBnbyB0by4gVGhpcyB3b3JrcyB3aXRoIHRoZSBtYWpvcml0eSBvZiBlZGl0b3JzIHdpdGggdGhlIG5vdGFibGUgZXhjZXB0aW9ucyBvZiB0aG9zZSB0aGF0IHV0aWxpemUgaWZyYW1lcyBsaWtlIG5vdGVib29rcyBhbmQgZXh0ZW5zaW9uIHdlYnZpZXcgZWRpdG9ycy4nKSxcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRkZWZhdWx0OiBmYWxzZSxcblx0XHRcdFx0dGFnczogWydhY2Nlc3NpYmlsaXR5J10sXG5cdFx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHR9LFxuXHRcdFx0W0FjY2Vzc2liaWxpdHlXb3JrYmVuY2hTZXR0aW5nSWQuRGltVW5mb2N1c2VkT3BhY2l0eV06IHtcblx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2RpbVVuZm9jdXNlZE9wYWNpdHknLCAnVGhlIG9wYWNpdHkgZnJhY3Rpb24gKDAuMiB0byAxLjApIHRvIHVzZSBmb3IgdW5mb2N1c2VkIGVkaXRvcnMgYW5kIHRlcm1pbmFscy4gVGhpcyB3aWxsIG9ubHkgdGFrZSBlZmZlY3Qgd2hlbiB7MH0gaXMgZW5hYmxlZC4nLCBgXFxgIyR7QWNjZXNzaWJpbGl0eVdvcmtiZW5jaFNldHRpbmdJZC5EaW1VbmZvY3VzZWRFbmFibGVkfSNcXGBgKSxcblx0XHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRcdG1pbmltdW06IFZpZXdEaW1VbmZvY3VzZWRPcGFjaXR5UHJvcGVydGllcy5NaW5pbXVtLFxuXHRcdFx0XHRtYXhpbXVtOiBWaWV3RGltVW5mb2N1c2VkT3BhY2l0eVByb3BlcnRpZXMuTWF4aW11bSxcblx0XHRcdFx0ZGVmYXVsdDogVmlld0RpbVVuZm9jdXNlZE9wYWNpdHlQcm9wZXJ0aWVzLkRlZmF1bHQsXG5cdFx0XHRcdHRhZ3M6IFsnYWNjZXNzaWJpbGl0eSddLFxuXHRcdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OLFxuXHRcdFx0fSxcblx0XHRcdFtBY2Nlc3NpYmlsaXR5V29ya2JlbmNoU2V0dGluZ0lkLkhpZGVBY2Nlc3NpYmxlVmlld106IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LmhpZGVBY2Nlc3NpYmxlVmlldycsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgQWNjZXNzaWJsZSBWaWV3IGlzIGhpZGRlbi5cIiksXG5cdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRcdHRhZ3M6IFsnYWNjZXNzaWJpbGl0eSddXG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcbn1cblxuZXhwb3J0IHsgQWNjZXNzaWJpbGl0eVZvaWNlU2V0dGluZ0lkIH07XG5cbmV4cG9ydCBjb25zdCBTcGVlY2hUaW1lb3V0RGVmYXVsdCA9IDEyMDA7XG5cbmV4cG9ydCBjbGFzcyBEeW5hbWljU3BlZWNoQWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLmR5bmFtaWNTcGVlY2hBY2Nlc3NpYmlsaXR5Q29uZmlndXJhdGlvbic7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElTcGVlY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3BlZWNoU2VydmljZTogSVNwZWVjaFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LnJ1bkFuZFN1YnNjcmliZShzcGVlY2hTZXJ2aWNlLm9uRGlkQ2hhbmdlSGFzU3BlZWNoUHJvdmlkZXIsICgpID0+IHRoaXMudXBkYXRlQ29uZmlndXJhdGlvbigpKSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNvbmZpZ3VyYXRpb24oKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnNwZWVjaFNlcnZpY2UuaGFzU3BlZWNoUHJvdmlkZXIpIHtcblx0XHRcdHJldHVybjsgLy8gdGhlc2Ugc2V0dGluZ3MgcmVxdWlyZSBhIHNwZWVjaCBwcm92aWRlclxuXHRcdH1cblxuXHRcdGNvbnN0IGxhbmd1YWdlcyA9IHRoaXMuZ2V0TGFuZ3VhZ2VzKCk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VzU29ydGVkID0gT2JqZWN0LmtleXMobGFuZ3VhZ2VzKS5zb3J0KChsYW5nQSwgbGFuZ0IpID0+IHtcblx0XHRcdHJldHVybiBsYW5ndWFnZXNbbGFuZ0FdLm5hbWUubG9jYWxlQ29tcGFyZShsYW5ndWFnZXNbbGFuZ0JdLm5hbWUpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pO1xuXHRcdHJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0XHQuLi5hY2Nlc3NpYmlsaXR5Q29uZmlndXJhdGlvbk5vZGVCYXNlLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRbQWNjZXNzaWJpbGl0eVZvaWNlU2V0dGluZ0lkLlNwZWVjaFRpbWVvdXRdOiB7XG5cdFx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgndm9pY2Uuc3BlZWNoVGltZW91dCcsIFwiVGhlIGR1cmF0aW9uIGluIG1pbGxpc2Vjb25kcyB0aGF0IHZvaWNlIHNwZWVjaCByZWNvZ25pdGlvbiByZW1haW5zIGFjdGl2ZSBhZnRlciB5b3Ugc3RvcCBzcGVha2luZy4gRm9yIGV4YW1wbGUgaW4gYSBjaGF0IHNlc3Npb24sIHRoZSB0cmFuc2NyaWJlZCB0ZXh0IGlzIHN1Ym1pdHRlZCBhdXRvbWF0aWNhbGx5IGFmdGVyIHRoZSB0aW1lb3V0IGlzIG1ldC4gU2V0IHRvIGAwYCB0byBkaXNhYmxlIHRoaXMgZmVhdHVyZS5cIiksXG5cdFx0XHRcdFx0J3R5cGUnOiAnbnVtYmVyJyxcblx0XHRcdFx0XHQnZGVmYXVsdCc6IFNwZWVjaFRpbWVvdXREZWZhdWx0LFxuXHRcdFx0XHRcdCdtaW5pbXVtJzogMCxcblx0XHRcdFx0XHQndGFncyc6IFsnYWNjZXNzaWJpbGl0eSddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdFtBY2Nlc3NpYmlsaXR5Vm9pY2VTZXR0aW5nSWQuSWdub3JlQ29kZUJsb2Nrc106IHtcblx0XHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKCd2b2ljZS5pZ25vcmVDb2RlQmxvY2tzJywgXCJXaGV0aGVyIHRvIGlnbm9yZSBjb2RlIHNuaXBwZXRzIGluIHRleHQtdG8tc3BlZWNoIHN5bnRoZXNpcy5cIiksXG5cdFx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZSxcblx0XHRcdFx0XHQndGFncyc6IFsnYWNjZXNzaWJpbGl0eSddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdFtBY2Nlc3NpYmlsaXR5Vm9pY2VTZXR0aW5nSWQuU3BlZWNoTGFuZ3VhZ2VdOiB7XG5cdFx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgndm9pY2Uuc3BlZWNoTGFuZ3VhZ2UnLCBcIlRoZSBsYW5ndWFnZSB0aGF0IHRleHQtdG8tc3BlZWNoIGFuZCBzcGVlY2gtdG8tdGV4dCBzaG91bGQgdXNlLiBTZWxlY3QgYGF1dG9gIHRvIHVzZSB0aGUgY29uZmlndXJlZCBkaXNwbGF5IGxhbmd1YWdlIGlmIHBvc3NpYmxlLiBOb3RlIHRoYXQgbm90IGFsbCBkaXNwbGF5IGxhbmd1YWdlcyBtYXliZSBzdXBwb3J0ZWQgYnkgc3BlZWNoIHJlY29nbml0aW9uIGFuZCBzeW50aGVzaXplcnMuXCIpLFxuXHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdFx0J2VudW0nOiBsYW5ndWFnZXNTb3J0ZWQsXG5cdFx0XHRcdFx0J2RlZmF1bHQnOiAnYXV0bycsXG5cdFx0XHRcdFx0J3RhZ3MnOiBbJ2FjY2Vzc2liaWxpdHknXSxcblx0XHRcdFx0XHQnZW51bURlc2NyaXB0aW9ucyc6IGxhbmd1YWdlc1NvcnRlZC5tYXAoa2V5ID0+IGxhbmd1YWdlc1trZXldLm5hbWUpLFxuXHRcdFx0XHRcdCdlbnVtSXRlbUxhYmVscyc6IGxhbmd1YWdlc1NvcnRlZC5tYXAoa2V5ID0+IGxhbmd1YWdlc1trZXldLm5hbWUpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdFtBY2Nlc3NpYmlsaXR5Vm9pY2VTZXR0aW5nSWQuQXV0b1N5bnRoZXNpemVdOiB7XG5cdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0XHQnZW51bSc6IFsnb24nLCAnb2ZmJ10sXG5cdFx0XHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS52b2ljZS5hdXRvU3ludGhlc2l6ZS5vbicsIFwiRW5hYmxlIHRoZSBmZWF0dXJlLiBXaGVuIGEgc2NyZWVuIHJlYWRlciBpcyBlbmFibGVkLCBub3RlIHRoYXQgdGhpcyB3aWxsIGRpc2FibGUgYXJpYSB1cGRhdGVzLlwiKSxcblx0XHRcdFx0XHRcdGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnZvaWNlLmF1dG9TeW50aGVzaXplLm9mZicsIFwiRGlzYWJsZSB0aGUgZmVhdHVyZS5cIiksXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKCdhdXRvU3ludGhlc2l6ZScsIFwiV2hldGhlciBhIHRleHR1YWwgcmVzcG9uc2Ugc2hvdWxkIGF1dG9tYXRpY2FsbHkgYmUgcmVhZCBvdXQgYWxvdWQgd2hlbiBzcGVlY2ggd2FzIHVzZWQgYXMgaW5wdXQuIEZvciBleGFtcGxlIGluIGEgY2hhdCBzZXNzaW9uLCBhIHJlc3BvbnNlIGlzIGF1dG9tYXRpY2FsbHkgc3ludGhlc2l6ZWQgd2hlbiB2b2ljZSB3YXMgdXNlZCBhcyBjaGF0IHJlcXVlc3QuXCIpLFxuXHRcdFx0XHRcdCdkZWZhdWx0JzogJ29mZicsXG5cdFx0XHRcdFx0J3RhZ3MnOiBbJ2FjY2Vzc2liaWxpdHknXVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGdldExhbmd1YWdlcygpOiB7IFtsb2NhbGU6IHN0cmluZ106IHsgbmFtZTogc3RyaW5nIH0gfSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdFsnYXV0byddOiB7XG5cdFx0XHRcdG5hbWU6IGxvY2FsaXplKCdzcGVlY2hMYW5ndWFnZS5hdXRvJywgXCJBdXRvIChVc2UgRGlzcGxheSBMYW5ndWFnZSlcIilcblx0XHRcdH0sXG5cdFx0XHQuLi5TUEVFQ0hfTEFOR1VBR0VTXG5cdFx0fTtcblx0fVxufVxuXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvbk1pZ3JhdGlvblJlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb25NaWdyYXRpb24pXG5cdC5yZWdpc3RlckNvbmZpZ3VyYXRpb25NaWdyYXRpb25zKFt7XG5cdFx0a2V5OiAnYXVkaW9DdWVzLnZvbHVtZScsXG5cdFx0bWlncmF0ZUZuOiAodmFsdWUsIGFjY2Vzc29yKSA9PiB7XG5cdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRbJ2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucy52b2x1bWUnLCB7IHZhbHVlIH1dLFxuXHRcdFx0XHRbJ2F1ZGlvQ3Vlcy52b2x1bWUnLCB7IHZhbHVlOiB1bmRlZmluZWQgfV1cblx0XHRcdF07XG5cdFx0fVxuXHR9XSk7XG5cblJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uTWlncmF0aW9uUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbk1pZ3JhdGlvbilcblx0LnJlZ2lzdGVyQ29uZmlndXJhdGlvbk1pZ3JhdGlvbnMoW3tcblx0XHRrZXk6ICdhdWRpb0N1ZXMuZGVib3VuY2VQb3NpdGlvbkNoYW5nZXMnLFxuXHRcdG1pZ3JhdGVGbjogKHZhbHVlKSA9PiB7XG5cdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRbJ2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucy5kZWJvdW5jZVBvc2l0aW9uQ2hhbmdlcycsIHsgdmFsdWUgfV0sXG5cdFx0XHRcdFsnYXVkaW9DdWVzLmRlYm91bmNlUG9zaXRpb25DaGFuZ2VzJywgeyB2YWx1ZTogdW5kZWZpbmVkIH1dXG5cdFx0XHRdO1xuXHRcdH1cblx0fV0pO1xuXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvbk1pZ3JhdGlvblJlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb25NaWdyYXRpb24pXG5cdC5yZWdpc3RlckNvbmZpZ3VyYXRpb25NaWdyYXRpb25zKFt7XG5cdFx0a2V5OiAnYWNjZXNzaWJpbGl0eS5zaWduYWxPcHRpb25zJyxcblx0XHRtaWdyYXRlRm46ICh2YWx1ZSwgYWNjZXNzb3IpID0+IHtcblx0XHRcdGNvbnN0IGRlbGF5R2VuZXJhbCA9IGdldERlbGF5c0Zyb21Db25maWcoYWNjZXNzb3IsICdnZW5lcmFsJyk7XG5cdFx0XHRjb25zdCBkZWxheUVycm9yID0gZ2V0RGVsYXlzRnJvbUNvbmZpZyhhY2Nlc3NvciwgJ2Vycm9yQXRQb3NpdGlvbicpO1xuXHRcdFx0Y29uc3QgZGVsYXlXYXJuaW5nID0gZ2V0RGVsYXlzRnJvbUNvbmZpZyhhY2Nlc3NvciwgJ3dhcm5pbmdBdFBvc2l0aW9uJyk7XG5cdFx0XHRjb25zdCB2b2x1bWUgPSBnZXRWb2x1bWVGcm9tQ29uZmlnKGFjY2Vzc29yKTtcblx0XHRcdGNvbnN0IGRlYm91bmNlUG9zaXRpb25DaGFuZ2VzID0gZ2V0RGVib3VuY2VQb3NpdGlvbkNoYW5nZXNGcm9tQ29uZmlnKGFjY2Vzc29yKTtcblx0XHRcdGNvbnN0IHJlc3VsdDogW2tleTogc3RyaW5nLCB7IHZhbHVlOiBhbnkgfV1bXSA9IFtdO1xuXHRcdFx0aWYgKCEhdm9sdW1lKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKFsnYWNjZXNzaWJpbGl0eS5zaWduYWxPcHRpb25zLnZvbHVtZScsIHsgdmFsdWU6IHZvbHVtZSB9XSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoISFkZWxheUdlbmVyYWwpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goWydhY2Nlc3NpYmlsaXR5LnNpZ25hbE9wdGlvbnMuZXhwZXJpbWVudGFsLmRlbGF5cy5nZW5lcmFsJywgeyB2YWx1ZTogZGVsYXlHZW5lcmFsIH1dKTtcblx0XHRcdH1cblx0XHRcdGlmICghIWRlbGF5RXJyb3IpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goWydhY2Nlc3NpYmlsaXR5LnNpZ25hbE9wdGlvbnMuZXhwZXJpbWVudGFsLmRlbGF5cy5lcnJvckF0UG9zaXRpb24nLCB7IHZhbHVlOiBkZWxheUVycm9yIH1dKTtcblx0XHRcdH1cblx0XHRcdGlmICghIWRlbGF5V2FybmluZykge1xuXHRcdFx0XHRyZXN1bHQucHVzaChbJ2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucy5leHBlcmltZW50YWwuZGVsYXlzLndhcm5pbmdBdFBvc2l0aW9uJywgeyB2YWx1ZTogZGVsYXlXYXJuaW5nIH1dKTtcblx0XHRcdH1cblx0XHRcdGlmICghIWRlYm91bmNlUG9zaXRpb25DaGFuZ2VzKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKFsnYWNjZXNzaWJpbGl0eS5zaWduYWxPcHRpb25zLmRlYm91bmNlUG9zaXRpb25DaGFuZ2VzJywgeyB2YWx1ZTogZGVib3VuY2VQb3NpdGlvbkNoYW5nZXMgfV0pO1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0LnB1c2goWydhY2Nlc3NpYmlsaXR5LnNpZ25hbE9wdGlvbnMnLCB7IHZhbHVlOiB1bmRlZmluZWQgfV0pO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdH1dKTtcblxuXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvbk1pZ3JhdGlvblJlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb25NaWdyYXRpb24pXG5cdC5yZWdpc3RlckNvbmZpZ3VyYXRpb25NaWdyYXRpb25zKFt7XG5cdFx0a2V5OiAnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnNvdW5kcy52b2x1bWUnLFxuXHRcdG1pZ3JhdGVGbjogKHZhbHVlKSA9PiB7XG5cdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRbJ2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucy52b2x1bWUnLCB7IHZhbHVlIH1dLFxuXHRcdFx0XHRbJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5zb3VuZHMudm9sdW1lJywgeyB2YWx1ZTogdW5kZWZpbmVkIH1dXG5cdFx0XHRdO1xuXHRcdH1cblx0fV0pO1xuXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvbk1pZ3JhdGlvblJlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb25NaWdyYXRpb24pXG5cdC5yZWdpc3RlckNvbmZpZ3VyYXRpb25NaWdyYXRpb25zKFt7XG5cdFx0a2V5OiAnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmRlYm91bmNlUG9zaXRpb25DaGFuZ2VzJyxcblx0XHRtaWdyYXRlRm46ICh2YWx1ZSkgPT4ge1xuXHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0WydhY2Nlc3NpYmlsaXR5LnNpZ25hbE9wdGlvbnMuZGVib3VuY2VQb3NpdGlvbkNoYW5nZXMnLCB7IHZhbHVlIH1dLFxuXHRcdFx0XHRbJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5kZWJvdW5jZVBvc2l0aW9uQ2hhbmdlcycsIHsgdmFsdWU6IHVuZGVmaW5lZCB9XVxuXHRcdFx0XTtcblx0XHR9XG5cdH1dKTtcblxuZnVuY3Rpb24gZ2V0RGVsYXlzRnJvbUNvbmZpZyhhY2Nlc3NvcjogKGtleTogc3RyaW5nKSA9PiBhbnksIHR5cGU6ICdnZW5lcmFsJyB8ICdlcnJvckF0UG9zaXRpb24nIHwgJ3dhcm5pbmdBdFBvc2l0aW9uJyk6IHsgYW5ub3VuY2VtZW50OiBudW1iZXI7IHNvdW5kOiBudW1iZXIgfSB8IHVuZGVmaW5lZCB7XG5cdHJldHVybiBhY2Nlc3NvcihgYWNjZXNzaWJpbGl0eS5zaWduYWxPcHRpb25zLmV4cGVyaW1lbnRhbC5kZWxheXMuJHt0eXBlfWApIHx8IGFjY2Vzc29yKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbE9wdGlvbnMnKT8uWydleHBlcmltZW50YWwuZGVsYXlzJ10/LltgJHt0eXBlfWBdIHx8IGFjY2Vzc29yKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbE9wdGlvbnMnKT8uWydkZWxheXMnXT8uW2Ake3R5cGV9YF07XG59XG5cbmZ1bmN0aW9uIGdldFZvbHVtZUZyb21Db25maWcoYWNjZXNzb3I6IChrZXk6IHN0cmluZykgPT4gYW55KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0cmV0dXJuIGFjY2Vzc29yKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbE9wdGlvbnMudm9sdW1lJykgfHwgYWNjZXNzb3IoJ2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucycpPy52b2x1bWUgfHwgYWNjZXNzb3IoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5zb3VuZHMudm9sdW1lJykgfHwgYWNjZXNzb3IoJ2F1ZGlvQ3Vlcy52b2x1bWUnKTtcbn1cblxuZnVuY3Rpb24gZ2V0RGVib3VuY2VQb3NpdGlvbkNoYW5nZXNGcm9tQ29uZmlnKGFjY2Vzc29yOiAoa2V5OiBzdHJpbmcpID0+IGFueSk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdHJldHVybiBhY2Nlc3NvcignYWNjZXNzaWJpbGl0eS5zaWduYWxPcHRpb25zLmRlYm91bmNlUG9zaXRpb25DaGFuZ2VzJykgfHwgYWNjZXNzb3IoJ2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucycpPy5kZWJvdW5jZVBvc2l0aW9uQ2hhbmdlcyB8fCBhY2Nlc3NvcignYWNjZXNzaWJpbGl0eS5zaWduYWxzLmRlYm91bmNlUG9zaXRpb25DaGFuZ2VzJykgfHwgYWNjZXNzb3IoJ2F1ZGlvQ3Vlcy5kZWJvdW5jZVBvc2l0aW9uQ2hhbmdlcycpO1xufVxuXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvbk1pZ3JhdGlvblJlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb25NaWdyYXRpb24pXG5cdC5yZWdpc3RlckNvbmZpZ3VyYXRpb25NaWdyYXRpb25zKFt7XG5cdFx0a2V5OiBBY2Nlc3NpYmlsaXR5Vm9pY2VTZXR0aW5nSWQuQXV0b1N5bnRoZXNpemUsXG5cdFx0bWlncmF0ZUZuOiAodmFsdWU6IGJvb2xlYW4pID0+IHtcblx0XHRcdGxldCBuZXdWYWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHZhbHVlID09PSB0cnVlKSB7XG5cdFx0XHRcdG5ld1ZhbHVlID0gJ29uJztcblx0XHRcdH0gZWxzZSBpZiAodmFsdWUgPT09IGZhbHNlKSB7XG5cdFx0XHRcdG5ld1ZhbHVlID0gJ29mZic7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRbQWNjZXNzaWJpbGl0eVZvaWNlU2V0dGluZ0lkLkF1dG9TeW50aGVzaXplLCB7IHZhbHVlOiBuZXdWYWx1ZSB9XSxcblx0XHRcdF07XG5cdFx0fVxuXHR9XSk7XG5cblJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uTWlncmF0aW9uUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbk1pZ3JhdGlvbilcblx0LnJlZ2lzdGVyQ29uZmlndXJhdGlvbk1pZ3JhdGlvbnMoW3tcblx0XHRrZXk6ICdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuY2hhdFJlc3BvbnNlUGVuZGluZycsXG5cdFx0bWlncmF0ZUZuOiAodmFsdWUsIGFjY2Vzc29yKSA9PiB7XG5cdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRbJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5wcm9ncmVzcycsIHsgdmFsdWUgfV0sXG5cdFx0XHRcdFsnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmNoYXRSZXNwb25zZVBlbmRpbmcnLCB7IHZhbHVlOiB1bmRlZmluZWQgfV0sXG5cdFx0XHRdO1xuXHRcdH1cblx0fV0pO1xuXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvbk1pZ3JhdGlvblJlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb25NaWdyYXRpb24pXG5cdC5yZWdpc3RlckNvbmZpZ3VyYXRpb25NaWdyYXRpb25zKEFjY2Vzc2liaWxpdHlTaWduYWwuYWxsQWNjZXNzaWJpbGl0eVNpZ25hbHMubWFwPENvbmZpZ3VyYXRpb25NaWdyYXRpb24gfCB1bmRlZmluZWQ+KGl0ZW0gPT4gaXRlbS5sZWdhY3lTb3VuZFNldHRpbmdzS2V5ID8gKHtcblx0XHRrZXk6IGl0ZW0ubGVnYWN5U291bmRTZXR0aW5nc0tleSxcblx0XHRtaWdyYXRlRm46IChzb3VuZCwgYWNjZXNzb3IpID0+IHtcblx0XHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25LZXlWYWx1ZVBhaXJzOiBDb25maWd1cmF0aW9uS2V5VmFsdWVQYWlycyA9IFtdO1xuXHRcdFx0Y29uc3QgbGVnYWN5QW5ub3VuY2VtZW50U2V0dGluZ3NLZXkgPSBpdGVtLmxlZ2FjeUFubm91bmNlbWVudFNldHRpbmdzS2V5O1xuXHRcdFx0bGV0IGFubm91bmNlbWVudDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKGxlZ2FjeUFubm91bmNlbWVudFNldHRpbmdzS2V5KSB7XG5cdFx0XHRcdGFubm91bmNlbWVudCA9IGFjY2Vzc29yKGxlZ2FjeUFubm91bmNlbWVudFNldHRpbmdzS2V5KSA/PyB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmIChhbm5vdW5jZW1lbnQgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgYW5ub3VuY2VtZW50ICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGFubm91bmNlbWVudCA9IGFubm91bmNlbWVudCA/ICdhdXRvJyA6ICdvZmYnO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjb25maWd1cmF0aW9uS2V5VmFsdWVQYWlycy5wdXNoKFtgJHtpdGVtLmxlZ2FjeVNvdW5kU2V0dGluZ3NLZXl9YCwgeyB2YWx1ZTogdW5kZWZpbmVkIH1dKTtcblx0XHRcdGNvbmZpZ3VyYXRpb25LZXlWYWx1ZVBhaXJzLnB1c2goW2Ake2l0ZW0uc2V0dGluZ3NLZXl9YCwgeyB2YWx1ZTogYW5ub3VuY2VtZW50ICE9PSB1bmRlZmluZWQgPyB7IGFubm91bmNlbWVudCwgc291bmQgfSA6IHsgc291bmQgfSB9XSk7XG5cdFx0XHRyZXR1cm4gY29uZmlndXJhdGlvbktleVZhbHVlUGFpcnM7XG5cdFx0fVxuXHR9KSA6IHVuZGVmaW5lZCkuZmlsdGVyKGlzRGVmaW5lZCkpO1xuXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvbk1pZ3JhdGlvblJlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb25NaWdyYXRpb24pXG5cdC5yZWdpc3RlckNvbmZpZ3VyYXRpb25NaWdyYXRpb25zKEFjY2Vzc2liaWxpdHlTaWduYWwuYWxsQWNjZXNzaWJpbGl0eVNpZ25hbHMuZmlsdGVyKGkgPT4gISFpLmxlZ2FjeUFubm91bmNlbWVudFNldHRpbmdzS2V5ICYmICEhaS5sZWdhY3lTb3VuZFNldHRpbmdzS2V5KS5tYXAoaXRlbSA9PiAoe1xuXHRcdGtleTogaXRlbS5sZWdhY3lBbm5vdW5jZW1lbnRTZXR0aW5nc0tleSEsXG5cdFx0bWlncmF0ZUZuOiAoYW5ub3VuY2VtZW50LCBhY2Nlc3NvcikgPT4ge1xuXHRcdFx0Y29uc3QgY29uZmlndXJhdGlvbktleVZhbHVlUGFpcnM6IENvbmZpZ3VyYXRpb25LZXlWYWx1ZVBhaXJzID0gW107XG5cdFx0XHRjb25zdCBzb3VuZCA9IGFjY2Vzc29yKGl0ZW0uc2V0dGluZ3NLZXkpPy5zb3VuZCB8fCBhY2Nlc3NvcihpdGVtLmxlZ2FjeVNvdW5kU2V0dGluZ3NLZXkhKTtcblx0XHRcdGlmIChhbm5vdW5jZW1lbnQgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgYW5ub3VuY2VtZW50ICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRhbm5vdW5jZW1lbnQgPSBhbm5vdW5jZW1lbnQgPyAnYXV0bycgOiAnb2ZmJztcblx0XHRcdH1cblx0XHRcdGNvbmZpZ3VyYXRpb25LZXlWYWx1ZVBhaXJzLnB1c2goW2Ake2l0ZW0uc2V0dGluZ3NLZXl9YCwgeyB2YWx1ZTogYW5ub3VuY2VtZW50ICE9PSB1bmRlZmluZWQgPyB7IGFubm91bmNlbWVudCwgc291bmQgfSA6IHsgc291bmQgfSB9XSk7XG5cdFx0XHRjb25maWd1cmF0aW9uS2V5VmFsdWVQYWlycy5wdXNoKFtgJHtpdGVtLmxlZ2FjeUFubm91bmNlbWVudFNldHRpbmdzS2V5fWAsIHsgdmFsdWU6IHVuZGVmaW5lZCB9XSk7XG5cdFx0XHRjb25maWd1cmF0aW9uS2V5VmFsdWVQYWlycy5wdXNoKFtgJHtpdGVtLmxlZ2FjeVNvdW5kU2V0dGluZ3NLZXl9YCwgeyB2YWx1ZTogdW5kZWZpbmVkIH1dKTtcblx0XHRcdHJldHVybiBjb25maWd1cmF0aW9uS2V5VmFsdWVQYWlycztcblx0XHR9XG5cdH0pKSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsb0JBQW9CLGtCQUE0RjtBQUN6SCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGdDQUFnQyxjQUFjLDJCQUFnSDtBQUN2SyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFT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QUFLLHNCQUF1QjtBQUN4RixRQUFJLGlCQUFpQixVQUFhLE9BQU8saUJBQWlCLFVBQVU7QUFDbkUscUJBQWUsZUFBZSxTQUFTO0FBQUEsSUFDeEM7QUFDQSwrQkFBMkIsS0FBSyxDQUFDLEdBQUcsS0FBSyxXQUFXLElBQUksRUFBRSxPQUFPLGlCQUFpQixTQUFZLEVBQUUsY0FBYyxNQUFNLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQ3BJLCtCQUEyQixLQUFLLENBQUMsR0FBRyxLQUFLLDZCQUE2QixJQUFJLEVBQUUsT0FBTyxPQUFVLENBQUMsQ0FBQztBQUMvRiwrQkFBMkIsS0FBSyxDQUFDLEdBQUcsS0FBSyxzQkFBc0IsSUFBSSxFQUFFLE9BQU8sT0FBVSxDQUFDLENBQUM7QUFDeEYsV0FBTztBQUFBLEVBQ1I7QUFDRCxFQUFFLENBQUM7IiwKICAibmFtZXMiOiBbIkFjY2Vzc2liaWxpdHlXb3JrYmVuY2hTZXR0aW5nSWQiLCAiVmlld0RpbVVuZm9jdXNlZE9wYWNpdHlQcm9wZXJ0aWVzIiwgIkFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQiXQp9Cg==
