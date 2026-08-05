import { Codicon } from "../../../../base/common/codicons.js";
import { isMacintosh, isWindows } from "../../../../base/common/platform.js";
import { localize } from "../../../../nls.js";
import { ConfigurationScope, Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import product from "../../../../platform/product/common/product.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { TerminalLocationString, TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { terminalColorSchema, terminalIconSchema } from "../../../../platform/terminal/common/terminalPlatformConfiguration.js";
import { Extensions as WorkbenchExtensions } from "../../../common/configuration.js";
import { terminalContribConfiguration, TerminalContribSettingId } from "../terminalContribExports.js";
import { DEFAULT_COMMANDS_TO_SKIP_SHELL, DEFAULT_LETTER_SPACING, DEFAULT_LINE_HEIGHT, MAXIMUM_FONT_WEIGHT, MINIMUM_FONT_WEIGHT, SUGGESTIONS_FONT_WEIGHT } from "./terminal.js";
const terminalDescriptors = "\n- " + [
  "`${cwd}`: " + localize("cwd", "the terminal's current working directory."),
  "`${cwdFolder}`: " + localize("cwdFolder", "the terminal's current working directory, displayed for multi-root workspaces or in a single root workspace when the value differs from the initial working directory. On Windows, this will only be displayed when shell integration is enabled."),
  "`${workspaceFolder}`: " + localize("workspaceFolder", "the workspace in which the terminal was launched."),
  "`${workspaceFolderName}`: " + localize("workspaceFolderName", "the `name` of the workspace in which the terminal was launched."),
  "`${local}`: " + localize("local", "indicates a local terminal in a remote workspace."),
  "`${process}`: " + localize("process", "the name of the terminal process."),
  "`${progress}`: " + localize("progress", "the progress state as reported by the `OSC 9;4` sequence."),
  "`${separator}`: " + localize("separator", "a conditional separator {0} that only shows when it's surrounded by variables with values or static text.", "(` - `)"),
  "`${sequence}`: " + localize("sequence", "the name provided to the terminal by the process."),
  "`${task}`: " + localize("task", "indicates this terminal is associated with a task."),
  "`${shellType}`: " + localize("shellType", "the detected shell type."),
  "`${shellCommand}`: " + localize("shellCommand", "the command being executed according to shell integration. This also requires high confidence in the detected command line, which may not work in some prompt frameworks."),
  "`${shellPromptInput}`: " + localize("shellPromptInput", "the shell's full prompt input according to shell integration.")
].join("\n- ");
let terminalTitle = localize("terminalTitle", "Controls the terminal title. Variables are substituted based on the context:");
terminalTitle += terminalDescriptors;
let terminalDescription = localize("terminalDescription", "Controls the terminal description, which appears to the right of the title. Variables are substituted based on the context:");
terminalDescription += terminalDescriptors;
const defaultTerminalFontSize = isMacintosh ? 12 : 14;
const terminalConfiguration = {
  id: "terminal",
  order: 100,
  title: localize("terminalIntegratedConfigurationTitle", "Integrated Terminal"),
  type: "object",
  properties: {
    [TerminalSettingId.SendKeybindingsToShell]: {
      markdownDescription: localize("terminal.integrated.sendKeybindingsToShell", "Dispatches most keybindings to the terminal instead of the workbench, overriding {0}, which can be used alternatively for fine tuning.", "`#terminal.integrated.commandsToSkipShell#`"),
      type: "boolean",
      default: false
    },
    [TerminalSettingId.TabsDefaultColor]: {
      description: localize("terminal.integrated.tabs.defaultColor", "A theme color ID to associate with terminal icons by default."),
      ...terminalColorSchema,
      scope: ConfigurationScope.RESOURCE
    },
    [TerminalSettingId.TabsDefaultIcon]: {
      description: localize("terminal.integrated.tabs.defaultIcon", "A codicon ID to associate with terminal icons by default."),
      ...terminalIconSchema,
      default: Codicon.terminal.id,
      scope: ConfigurationScope.RESOURCE
    },
    [TerminalSettingId.TabsEnabled]: {
      description: localize("terminal.integrated.tabs.enabled", "Controls whether terminal tabs display as a list to the side of the terminal. When this is disabled a dropdown will display instead."),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.TabsEnableAnimation]: {
      description: localize("terminal.integrated.tabs.enableAnimation", "Controls whether terminal tab statuses support animation (eg. in progress tasks)."),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.TabsHideCondition]: {
      description: localize("terminal.integrated.tabs.hideCondition", "Controls whether the terminal tabs view will hide under certain conditions."),
      type: "string",
      enum: ["never", "singleTerminal", "singleGroup"],
      enumDescriptions: [
        localize("terminal.integrated.tabs.hideCondition.never", "Never hide the terminal tabs view"),
        localize("terminal.integrated.tabs.hideCondition.singleTerminal", "Hide the terminal tabs view when there is only a single terminal opened"),
        localize("terminal.integrated.tabs.hideCondition.singleGroup", "Hide the terminal tabs view when there is only a single terminal group opened")
      ],
      default: "singleTerminal"
    },
    [TerminalSettingId.TabsShowActiveTerminal]: {
      description: localize("terminal.integrated.tabs.showActiveTerminal", "Shows the active terminal information in the view. This is particularly useful when the title within the tabs aren't visible."),
      type: "string",
      enum: ["always", "singleTerminal", "singleTerminalOrNarrow", "never"],
      enumDescriptions: [
        localize("terminal.integrated.tabs.showActiveTerminal.always", "Always show the active terminal"),
        localize("terminal.integrated.tabs.showActiveTerminal.singleTerminal", "Show the active terminal when it is the only terminal opened"),
        localize("terminal.integrated.tabs.showActiveTerminal.singleTerminalOrNarrow", "Show the active terminal when it is the only terminal opened or when the tabs view is in its narrow textless state"),
        localize("terminal.integrated.tabs.showActiveTerminal.never", "Never show the active terminal")
      ],
      default: "singleTerminalOrNarrow"
    },
    [TerminalSettingId.TabsShowActions]: {
      description: localize("terminal.integrated.tabs.showActions", "Controls whether terminal split and kill buttons are displays next to the new terminal button."),
      type: "string",
      enum: ["always", "singleTerminal", "singleTerminalOrNarrow", "never"],
      enumDescriptions: [
        localize("terminal.integrated.tabs.showActions.always", "Always show the actions"),
        localize("terminal.integrated.tabs.showActions.singleTerminal", "Show the actions when it is the only terminal opened"),
        localize("terminal.integrated.tabs.showActions.singleTerminalOrNarrow", "Show the actions when it is the only terminal opened or when the tabs view is in its narrow textless state"),
        localize("terminal.integrated.tabs.showActions.never", "Never show the actions")
      ],
      default: "singleTerminalOrNarrow"
    },
    [TerminalSettingId.TabsLocation]: {
      type: "string",
      enum: ["left", "right"],
      enumDescriptions: [
        localize("terminal.integrated.tabs.location.left", "Show the terminal tabs view to the left of the terminal"),
        localize("terminal.integrated.tabs.location.right", "Show the terminal tabs view to the right of the terminal")
      ],
      default: "right",
      description: localize("terminal.integrated.tabs.location", "Controls the location of the terminal tabs, either to the left or right of the actual terminal(s).")
    },
    [TerminalSettingId.DefaultLocation]: {
      type: "string",
      enum: [TerminalLocationString.Editor, TerminalLocationString.TerminalView],
      enumDescriptions: [
        localize("terminal.integrated.defaultLocation.editor", "Create terminals in the editor"),
        localize("terminal.integrated.defaultLocation.view", "Create terminals in the terminal view")
      ],
      default: "view",
      description: localize("terminal.integrated.defaultLocation", "Controls where newly created terminals will appear.")
    },
    [TerminalSettingId.TabsFocusMode]: {
      type: "string",
      enum: ["singleClick", "doubleClick"],
      enumDescriptions: [
        localize("terminal.integrated.tabs.focusMode.singleClick", "Focus the terminal when clicking a terminal tab"),
        localize("terminal.integrated.tabs.focusMode.doubleClick", "Focus the terminal when double-clicking a terminal tab")
      ],
      default: "doubleClick",
      description: localize("terminal.integrated.tabs.focusMode", "Controls whether focusing the terminal of a tab happens on double or single click.")
    },
    [TerminalSettingId.MacOptionIsMeta]: {
      description: localize("terminal.integrated.macOptionIsMeta", "Controls whether to treat the option key as the meta key in the terminal on macOS."),
      type: "boolean",
      default: false
    },
    [TerminalSettingId.MacOptionClickForcesSelection]: {
      description: localize("terminal.integrated.macOptionClickForcesSelection", "Controls whether to force selection when using Option+click on macOS. This will force a regular (line) selection and disallow the use of column selection mode. This enables copying and pasting using the regular terminal selection, for example, when mouse mode is enabled in tmux."),
      type: "boolean",
      default: false
    },
    [TerminalSettingId.AltClickMovesCursor]: {
      markdownDescription: localize("terminal.integrated.altClickMovesCursor", "If enabled, alt/option + click will reposition the prompt cursor to underneath the mouse when {0} is set to {1} (the default value). This may not work reliably depending on your shell.", "`#editor.multiCursorModifier#`", "`'alt'`"),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.CopyOnSelection]: {
      description: localize("terminal.integrated.copyOnSelection", "Controls whether text selected in the terminal will be copied to the clipboard."),
      type: "boolean",
      default: false
    },
    [TerminalSettingId.EnableMultiLinePasteWarning]: {
      markdownDescription: localize("terminal.integrated.enableMultiLinePasteWarning", "Controls whether to show a warning dialog when pasting multiple lines into the terminal."),
      type: "string",
      enum: ["auto", "always", "never"],
      markdownEnumDescriptions: [
        localize("terminal.integrated.enableMultiLinePasteWarning.auto", "Enable the warning but do not show it when:\n\n- Bracketed paste mode is enabled (the shell supports multi-line paste natively)\n- The paste is handled by the shell's readline (in the case of pwsh)"),
        localize("terminal.integrated.enableMultiLinePasteWarning.always", "Always show the warning if the text contains a new line."),
        localize("terminal.integrated.enableMultiLinePasteWarning.never", "Never show the warning.")
      ],
      default: "auto"
    },
    [TerminalSettingId.DrawBoldTextInBrightColors]: {
      description: localize("terminal.integrated.drawBoldTextInBrightColors", 'Controls whether bold text in the terminal will always use the "bright" ANSI color variant.'),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.FontFamily]: {
      markdownDescription: localize("terminal.integrated.fontFamily", "Controls the font family of the terminal. Defaults to {0}'s value.", "`#editor.fontFamily#`"),
      type: "string"
    },
    [TerminalSettingId.FontLigaturesEnabled]: {
      markdownDescription: localize("terminal.integrated.fontLigatures.enabled", "Controls whether font ligatures are enabled in the terminal. Ligatures will only work if the configured {0} supports them.", `\`#${TerminalSettingId.FontFamily}#\``),
      type: "boolean",
      default: false
    },
    [TerminalSettingId.FontLigaturesFeatureSettings]: {
      markdownDescription: localize("terminal.integrated.fontLigatures.featureSettings", "Controls what font feature settings are used when ligatures are enabled, in the format of the `font-feature-settings` CSS property. Some examples which may be valid depending on the font:") + "\n\n- " + [
        `\`"calt" off, "ss03"\``,
        `\`"liga" on\``,
        `\`"calt" off, "dlig" on\``
      ].join("\n- "),
      type: "string",
      default: '"calt" on'
    },
    [TerminalSettingId.FontLigaturesFallbackLigatures]: {
      markdownDescription: localize("terminal.integrated.fontLigatures.fallbackLigatures", "When {0} is enabled and the particular {1} cannot be parsed, this is the set of character sequences that will always be drawn together. This allows the use of a fixed set of ligatures even when the font isn't supported.", `\`#${TerminalSettingId.GpuAcceleration}#\``, `\`#${TerminalSettingId.FontFamily}#\``),
      type: "array",
      items: [{ type: "string" }],
      default: [
        "<--",
        "<---",
        "<<-",
        "<-",
        "->",
        "->>",
        "-->",
        "--->",
        "<==",
        "<===",
        "<<=",
        "<=",
        "=>",
        "=>>",
        "==>",
        "===>",
        ">=",
        ">>=",
        "<->",
        "<-->",
        "<--->",
        "<---->",
        "<=>",
        "<==>",
        "<===>",
        "<====>",
        "::",
        ":::",
        "<~~",
        "</",
        "</>",
        "/>",
        "~~>",
        "==",
        "!=",
        "/=",
        "~=",
        "<>",
        "===",
        "!==",
        "!===",
        "<:",
        ":=",
        "*=",
        "*+",
        "<*",
        "<*>",
        "*>",
        "<|",
        "<|>",
        "|>",
        "+*",
        "=*",
        "=:",
        ":>",
        "/*",
        "*/",
        "+++",
        "<!--",
        "<!---"
      ]
    },
    [TerminalSettingId.FontSize]: {
      description: localize("terminal.integrated.fontSize", "Controls the font size in pixels of the terminal."),
      type: "number",
      default: defaultTerminalFontSize,
      minimum: 6,
      maximum: 100
    },
    [TerminalSettingId.LetterSpacing]: {
      description: localize("terminal.integrated.letterSpacing", "Controls the letter spacing of the terminal. This is an integer value which represents the number of additional pixels to add between characters."),
      type: "number",
      default: DEFAULT_LETTER_SPACING
    },
    [TerminalSettingId.LineHeight]: {
      description: localize("terminal.integrated.lineHeight", "Controls the line height of the terminal. This number is multiplied by the terminal font size to get the actual line-height in pixels."),
      type: "number",
      default: DEFAULT_LINE_HEIGHT
    },
    [TerminalSettingId.MinimumContrastRatio]: {
      markdownDescription: localize("terminal.integrated.minimumContrastRatio", "When set, the foreground color of each cell will change to try meet the contrast ratio specified. Note that this will not apply to `powerline` characters per #146406. Example values:\n\n- 1: Do nothing and use the standard theme colors.\n- 4.5: [WCAG AA compliance (minimum)](https://www.w3.org/TR/UNDERSTANDING-WCAG20/visual-audio-contrast-contrast.html) (default).\n- 7: [WCAG AAA compliance (enhanced)](https://www.w3.org/TR/UNDERSTANDING-WCAG20/visual-audio-contrast7.html).\n- 21: White on black or black on white."),
      type: "number",
      default: 4.5,
      tags: ["accessibility"]
    },
    [TerminalSettingId.TabStopWidth]: {
      markdownDescription: localize("terminal.integrated.tabStopWidth", "The number of cells in a tab stop."),
      type: "number",
      minimum: 1,
      default: 8
    },
    [TerminalSettingId.FastScrollSensitivity]: {
      markdownDescription: localize("terminal.integrated.fastScrollSensitivity", "Scrolling speed multiplier when pressing `Alt`."),
      type: "number",
      default: 5
    },
    [TerminalSettingId.MouseWheelScrollSensitivity]: {
      markdownDescription: localize("terminal.integrated.mouseWheelScrollSensitivity", "A multiplier to be used on the `deltaY` of mouse wheel scroll events."),
      type: "number",
      default: 1
    },
    [TerminalSettingId.BellDuration]: {
      markdownDescription: localize("terminal.integrated.bellDuration", "The number of milliseconds to show the bell within a terminal tab when triggered."),
      type: "number",
      default: 1e3
    },
    [TerminalSettingId.FontWeight]: {
      "anyOf": [
        {
          type: "number",
          minimum: MINIMUM_FONT_WEIGHT,
          maximum: MAXIMUM_FONT_WEIGHT,
          errorMessage: localize("terminal.integrated.fontWeightError", 'Only "normal" and "bold" keywords or numbers between 1 and 1000 are allowed.')
        },
        {
          type: "string",
          pattern: "^(normal|bold|1000|[1-9][0-9]{0,2})$"
        },
        {
          enum: SUGGESTIONS_FONT_WEIGHT
        }
      ],
      description: localize("terminal.integrated.fontWeight", 'The font weight to use within the terminal for non-bold text. Accepts "normal" and "bold" keywords or numbers between 1 and 1000.'),
      default: "normal"
    },
    [TerminalSettingId.FontWeightBold]: {
      "anyOf": [
        {
          type: "number",
          minimum: MINIMUM_FONT_WEIGHT,
          maximum: MAXIMUM_FONT_WEIGHT,
          errorMessage: localize("terminal.integrated.fontWeightError", 'Only "normal" and "bold" keywords or numbers between 1 and 1000 are allowed.')
        },
        {
          type: "string",
          pattern: "^(normal|bold|1000|[1-9][0-9]{0,2})$"
        },
        {
          enum: SUGGESTIONS_FONT_WEIGHT
        }
      ],
      description: localize("terminal.integrated.fontWeightBold", 'The font weight to use within the terminal for bold text. Accepts "normal" and "bold" keywords or numbers between 1 and 1000.'),
      default: "bold"
    },
    [TerminalSettingId.CursorBlinking]: {
      description: localize("terminal.integrated.cursorBlinking", "Controls whether the terminal cursor blinks."),
      type: "boolean",
      default: false
    },
    [TerminalSettingId.CursorStyle]: {
      description: localize("terminal.integrated.cursorStyle", "Controls the style of terminal cursor when the terminal is focused."),
      enum: ["block", "line", "underline"],
      default: "block"
    },
    [TerminalSettingId.CursorStyleInactive]: {
      description: localize("terminal.integrated.cursorStyleInactive", "Controls the style of terminal cursor when the terminal is not focused."),
      enum: ["outline", "block", "line", "underline", "none"],
      default: "outline"
    },
    [TerminalSettingId.CursorWidth]: {
      markdownDescription: localize("terminal.integrated.cursorWidth", "Controls the width of the cursor when {0} is set to {1}.", "`#terminal.integrated.cursorStyle#`", "`line`"),
      type: "number",
      default: 1
    },
    [TerminalSettingId.Scrollback]: {
      description: localize("terminal.integrated.scrollback", "Controls the maximum number of lines the terminal keeps in its buffer. We pre-allocate memory based on this value in order to ensure a smooth experience. As such, as the value increases, so will the amount of memory."),
      type: "number",
      default: 1e3
    },
    [TerminalSettingId.DetectLocale]: {
      markdownDescription: localize("terminal.integrated.detectLocale", "Controls whether to detect and set the `$LANG` environment variable to a UTF-8 compliant option since VS Code's terminal only supports UTF-8 encoded data coming from the shell."),
      type: "string",
      enum: ["auto", "off", "on"],
      markdownEnumDescriptions: [
        localize("terminal.integrated.detectLocale.auto", "Set the `$LANG` environment variable if the existing variable does not exist or it does not end in `'.UTF-8'`."),
        localize("terminal.integrated.detectLocale.off", "Do not set the `$LANG` environment variable."),
        localize("terminal.integrated.detectLocale.on", "Always set the `$LANG` environment variable.")
      ],
      default: "auto"
    },
    [TerminalSettingId.GpuAcceleration]: {
      type: "string",
      enum: ["auto", "on", "off"],
      markdownEnumDescriptions: [
        localize("terminal.integrated.gpuAcceleration.auto", "Let VS Code detect which renderer will give the best experience."),
        localize("terminal.integrated.gpuAcceleration.on", "Enable GPU acceleration within the terminal."),
        localize("terminal.integrated.gpuAcceleration.off", "Disable GPU acceleration within the terminal. The terminal will render much slower when GPU acceleration is off but it should reliably work on all systems.")
      ],
      default: "auto",
      description: localize("terminal.integrated.gpuAcceleration", "Controls whether the terminal will leverage the GPU to do its rendering.")
    },
    [TerminalSettingId.TerminalTitleSeparator]: {
      "type": "string",
      "default": " - ",
      "markdownDescription": localize("terminal.integrated.tabs.separator", "Separator used by {0} and {1}.", `\`#${TerminalSettingId.TerminalTitle}#\``, `\`#${TerminalSettingId.TerminalDescription}#\``)
    },
    [TerminalSettingId.TerminalTitle]: {
      "type": "string",
      "default": "${process}",
      "markdownDescription": terminalTitle
    },
    [TerminalSettingId.TerminalDescription]: {
      "type": "string",
      "default": "${task}${separator}${local}${separator}${cwdFolder}",
      "markdownDescription": terminalDescription
    },
    [TerminalSettingId.RightClickBehavior]: {
      type: "string",
      enum: ["default", "copyPaste", "paste", "selectWord", "nothing"],
      enumDescriptions: [
        localize("terminal.integrated.rightClickBehavior.default", "Show the context menu."),
        localize("terminal.integrated.rightClickBehavior.copyPaste", "Copy when there is a selection, otherwise paste."),
        localize("terminal.integrated.rightClickBehavior.paste", "Paste on right click."),
        localize("terminal.integrated.rightClickBehavior.selectWord", "Select the word under the cursor and show the context menu."),
        localize("terminal.integrated.rightClickBehavior.nothing", "Do nothing and pass event to terminal.")
      ],
      default: isMacintosh ? "selectWord" : isWindows ? "copyPaste" : "default",
      description: localize("terminal.integrated.rightClickBehavior", "Controls how terminal reacts to right click.")
    },
    [TerminalSettingId.MiddleClickBehavior]: {
      type: "string",
      enum: ["default", "paste"],
      enumDescriptions: [
        localize("terminal.integrated.middleClickBehavior.default", "The platform default to focus the terminal. On Linux this will also paste the selection."),
        localize("terminal.integrated.middleClickBehavior.paste", "Paste on middle click.")
      ],
      default: "default",
      description: localize("terminal.integrated.middleClickBehavior", "Controls how terminal reacts to middle click.")
    },
    [TerminalSettingId.Cwd]: {
      restricted: true,
      description: localize("terminal.integrated.cwd", "An explicit start path where the terminal will be launched, this is used as the current working directory (cwd) for the shell process. This may be particularly useful in workspace settings if the root directory is not a convenient cwd."),
      type: "string",
      default: void 0,
      scope: ConfigurationScope.RESOURCE
    },
    [TerminalSettingId.ConfirmOnExit]: {
      description: localize("terminal.integrated.confirmOnExit", "Controls whether to confirm when the window closes if there are active terminal sessions. Background terminals like those launched by some extensions will not trigger the confirmation."),
      type: "string",
      enum: ["never", "always", "hasChildProcesses"],
      enumDescriptions: [
        localize("terminal.integrated.confirmOnExit.never", "Never confirm."),
        localize("terminal.integrated.confirmOnExit.always", "Always confirm if there are terminals."),
        localize("terminal.integrated.confirmOnExit.hasChildProcesses", "Confirm if there are any terminals that have child processes.")
      ],
      default: "never"
    },
    [TerminalSettingId.ConfirmOnKill]: {
      description: localize("terminal.integrated.confirmOnKill", "Controls whether to confirm killing terminals when they have child processes. When set to editor, terminals in the editor area will be marked as changed when they have child processes. Note that child process detection may not work well for shells like Git Bash which don't run their processes as child processes of the shell. Background terminals like those launched by some extensions will not trigger the confirmation."),
      type: "string",
      enum: ["never", "editor", "panel", "always"],
      enumDescriptions: [
        localize("terminal.integrated.confirmOnKill.never", "Never confirm."),
        localize("terminal.integrated.confirmOnKill.editor", "Confirm if the terminal is in the editor."),
        localize("terminal.integrated.confirmOnKill.panel", "Confirm if the terminal is in the panel."),
        localize("terminal.integrated.confirmOnKill.always", "Confirm if the terminal is either in the editor or panel.")
      ],
      default: "editor"
    },
    [TerminalSettingId.EnableBell]: {
      markdownDeprecationMessage: localize("terminal.integrated.enableBell", "This is now deprecated. Instead use the `terminal.integrated.enableVisualBell` and `accessibility.signals.terminalBell` settings."),
      type: "boolean",
      default: false
    },
    [TerminalSettingId.EnableVisualBell]: {
      description: localize("terminal.integrated.enableVisualBell", "Controls whether the visual terminal bell is enabled. This shows up next to the terminal's name."),
      type: "boolean",
      default: false
    },
    [TerminalSettingId.CommandsToSkipShell]: {
      markdownDescription: localize(
        "terminal.integrated.commandsToSkipShell",
        "A set of command IDs whose keybindings will not be sent to the shell but instead always be handled by VS Code. This allows keybindings that would normally be consumed by the shell to act instead the same as when the terminal is not focused, for example `Ctrl+P` to launch Quick Open.\n\n&nbsp;\n\nMany commands are skipped by default. To override a default and pass that command's keybinding to the shell instead, add the command prefixed with the `-` character. For example add `-workbench.action.quickOpen` to allow `Ctrl+P` to reach the shell.\n\n&nbsp;\n\nThe following list of default skipped commands is truncated when viewed in Settings Editor. To see the full list, {1} and search for the first command from the list below.\n\n&nbsp;\n\nDefault Skipped Commands:\n\n{0}",
        DEFAULT_COMMANDS_TO_SKIP_SHELL.sort().map((command) => `- ${command}`).join("\n"),
        `[${localize("openDefaultSettingsJson", "open the default settings JSON")}](command:workbench.action.openRawDefaultSettings '${localize("openDefaultSettingsJson.capitalized", "Open Default Settings (JSON)")}')`
      ),
      type: "array",
      items: {
        type: "string"
      },
      default: []
    },
    [TerminalSettingId.AllowChords]: {
      markdownDescription: localize("terminal.integrated.allowChords", "Whether or not to allow chord keybindings in the terminal. Note that when this is true and the keystroke results in a chord it will bypass {0}, setting this to false is particularly useful when you want ctrl+k to go to your shell (not VS Code).", "`#terminal.integrated.commandsToSkipShell#`"),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.AllowMnemonics]: {
      markdownDescription: localize("terminal.integrated.allowMnemonics", "Whether to allow menubar mnemonics (for example Alt+F) to trigger the open of the menubar. Note that this will cause all alt keystrokes to skip the shell when true. This does nothing on macOS."),
      type: "boolean",
      default: false
    },
    [TerminalSettingId.EnvMacOs]: {
      restricted: true,
      markdownDescription: localize("terminal.integrated.env.osx", "Object with environment variables that will be added to the VS Code process to be used by the terminal on macOS. Set to `null` to delete the environment variable."),
      type: "object",
      additionalProperties: {
        type: ["string", "null"]
      },
      default: {}
    },
    [TerminalSettingId.EnvLinux]: {
      restricted: true,
      markdownDescription: localize("terminal.integrated.env.linux", "Object with environment variables that will be added to the VS Code process to be used by the terminal on Linux. Set to `null` to delete the environment variable."),
      type: "object",
      additionalProperties: {
        type: ["string", "null"]
      },
      default: {}
    },
    [TerminalSettingId.EnvWindows]: {
      restricted: true,
      markdownDescription: localize("terminal.integrated.env.windows", "Object with environment variables that will be added to the VS Code process to be used by the terminal on Windows. Set to `null` to delete the environment variable."),
      type: "object",
      additionalProperties: {
        type: ["string", "null"]
      },
      default: {}
    },
    [TerminalSettingId.EnvironmentChangesIndicator]: {
      markdownDescription: localize("terminal.integrated.environmentChangesIndicator", "Whether to display the environment changes indicator on each terminal which explains whether extensions have made, or want to make changes to the terminal's environment."),
      type: "string",
      enum: ["off", "on", "warnonly"],
      enumDescriptions: [
        localize("terminal.integrated.environmentChangesIndicator.off", "Disable the indicator."),
        localize("terminal.integrated.environmentChangesIndicator.on", "Enable the indicator."),
        localize("terminal.integrated.environmentChangesIndicator.warnonly", "Only show the warning indicator when a terminal's environment is 'stale', not the information indicator that shows a terminal has had its environment modified by an extension.")
      ],
      default: "warnonly"
    },
    [TerminalSettingId.EnvironmentChangesRelaunch]: {
      markdownDescription: localize("terminal.integrated.environmentChangesRelaunch", "Whether to relaunch terminals automatically if extensions want to contribute to their environment and have not been interacted with yet."),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.ShowExitAlert]: {
      description: localize("terminal.integrated.showExitAlert", 'Controls whether to show the alert "The terminal process terminated with exit code" when exit code is non-zero.'),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.WindowsUseConptyDll]: {
      markdownDescription: localize("terminal.integrated.windowsUseConptyDll", "Whether to use the experimental conpty.dll (v1.22.250204002) shipped with VS Code, instead of the one bundled with Windows."),
      type: "boolean",
      tags: ["preview"],
      default: product.quality !== "stable"
    },
    [TerminalSettingId.SplitCwd]: {
      description: localize("terminal.integrated.splitCwd", "Controls the working directory a split terminal starts with."),
      type: "string",
      enum: ["workspaceRoot", "initial", "inherited"],
      enumDescriptions: [
        localize("terminal.integrated.splitCwd.workspaceRoot", "A new split terminal will use the workspace root as the working directory. In a multi-root workspace a choice for which root folder to use is offered."),
        localize("terminal.integrated.splitCwd.initial", "A new split terminal will use the working directory that the parent terminal started with."),
        localize("terminal.integrated.splitCwd.inherited", "On macOS and Linux, a new split terminal will use the working directory of the parent terminal. On Windows, this behaves the same as initial.")
      ],
      default: "inherited"
    },
    [TerminalSettingId.WindowsEnableConpty]: {
      description: localize("terminal.integrated.windowsEnableConpty", "Whether to use ConPTY for Windows terminal process communication (requires Windows 10 build number 18309+). Winpty will be used if this is false."),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.WordSeparators]: {
      markdownDescription: localize("terminal.integrated.wordSeparators", "A string containing all characters to be considered word separators when double-clicking to select word and in the fallback 'word' link detection. Since this is used for link detection, including characters such as `:` that are used when detecting links will cause the line and column part of links like `file:10:5` to be ignored."),
      type: "string",
      // allow-any-unicode-next-line
      default: " ()[]{}',\"`\u2500\u2018\u2019\u201C\u201D|"
    },
    [TerminalSettingId.EnableFileLinks]: {
      description: localize("terminal.integrated.enableFileLinks", "Whether to enable file links in terminals. Links can be slow when working on a network drive in particular because each file link is verified against the file system. Changing this will take effect only in new terminals."),
      type: "string",
      enum: ["off", "on", "notRemote"],
      enumDescriptions: [
        localize("enableFileLinks.off", "Always off."),
        localize("enableFileLinks.on", "Always on."),
        localize("enableFileLinks.notRemote", "Enable only when not in a remote workspace.")
      ],
      default: "on"
    },
    [TerminalSettingId.AllowedLinkSchemes]: {
      description: localize("terminal.integrated.allowedLinkSchemes", "An array of strings containing the URI schemes that the terminal is allowed to open links for. By default, only a small subset of possible schemes are allowed for security reasons."),
      type: "array",
      items: {
        type: "string"
      },
      default: [
        "file",
        "http",
        "https",
        "mailto",
        "vscode",
        "vscode-insiders"
      ]
    },
    [TerminalSettingId.UnicodeVersion]: {
      type: "string",
      enum: ["6", "11"],
      enumDescriptions: [
        localize("terminal.integrated.unicodeVersion.six", "Version 6 of Unicode. This is an older version which should work better on older systems."),
        localize("terminal.integrated.unicodeVersion.eleven", "Version 11 of Unicode. This version provides better support on modern systems that use modern versions of Unicode.")
      ],
      default: "11",
      description: localize("terminal.integrated.unicodeVersion", "Controls what version of Unicode to use when evaluating the width of characters in the terminal. If you experience emoji or other wide characters not taking up the right amount of space or backspace either deleting too much or too little then you may want to try tweaking this setting.")
    },
    [TerminalSettingId.EnablePersistentSessions]: {
      description: localize("terminal.integrated.enablePersistentSessions", "Persist terminal sessions/history for the workspace across window reloads."),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.PersistentSessionReviveProcess]: {
      markdownDescription: localize("terminal.integrated.persistentSessionReviveProcess", "When the terminal process must be shut down (for example on window or application close), this determines when the previous terminal session contents/history should be restored and processes be recreated when the workspace is next opened.\n\nCaveats:\n\n- Restoring of the process current working directory depends on whether it is supported by the shell.\n- Time to persist the session during shutdown is limited, so it may be aborted when using high-latency remote connections."),
      type: "string",
      enum: ["onExit", "onExitAndWindowClose", "never"],
      markdownEnumDescriptions: [
        localize("terminal.integrated.persistentSessionReviveProcess.onExit", "Revive the processes after the last window is closed on Windows/Linux or when the `workbench.action.quit` command is triggered (command palette, keybinding, menu)."),
        localize("terminal.integrated.persistentSessionReviveProcess.onExitAndWindowClose", "Revive the processes after the last window is closed on Windows/Linux or when the `workbench.action.quit` command is triggered (command palette, keybinding, menu), or when the window is closed."),
        localize("terminal.integrated.persistentSessionReviveProcess.never", "Never restore the terminal buffers or recreate the process.")
      ],
      default: "onExit"
    },
    [TerminalSettingId.HideOnStartup]: {
      description: localize("terminal.integrated.hideOnStartup", "Whether to hide the terminal view on startup, avoiding creating a terminal when there are no persistent sessions."),
      type: "string",
      enum: ["never", "whenEmpty", "always"],
      markdownEnumDescriptions: [
        localize("hideOnStartup.never", "Never hide the terminal view on startup."),
        localize("hideOnStartup.whenEmpty", "Only hide the terminal when there are no persistent sessions restored."),
        localize("hideOnStartup.always", "Always hide the terminal, even when there are persistent sessions restored.")
      ],
      default: "never"
    },
    [TerminalSettingId.HideOnLastClosed]: {
      description: localize("terminal.integrated.hideOnLastClosed", "Whether to hide the terminal view when the last terminal is closed. This will only happen when the terminal is the only visible view in the view container."),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.CustomGlyphs]: {
      markdownDescription: localize("terminal.integrated.customGlyphs", "Whether to draw custom glyphs for block element and box drawing characters instead of using the font, which typically yields better rendering with continuous lines. Note that this doesn't work when {0} is disabled.", `\`#${TerminalSettingId.GpuAcceleration}#\``),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.RescaleOverlappingGlyphs]: {
      markdownDescription: localize("terminal.integrated.rescaleOverlappingGlyphs", "Whether to rescale glyphs horizontally that are a single cell wide but have glyphs that would overlap following cell(s). This typically happens for ambiguous width characters (eg. the roman numeral characters U+2160+) which aren't featured in monospace fonts. Emoji glyphs are never rescaled."),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.ShellIntegrationEnabled]: {
      restricted: true,
      markdownDescription: localize("terminal.integrated.shellIntegration.enabled", "Determines whether or not shell integration is auto-injected to support features like enhanced command tracking and current working directory detection. \n\nShell integration works by injecting the shell with a startup script. The script gives VS Code insight into what is happening within the terminal.\n\nSupported shells:\n\n- Linux/macOS: bash, fish, pwsh, zsh\n - Windows: pwsh, git bash\n\nThis setting applies only when terminals are created, so you will need to restart your terminals for it to take effect.\n\n Note that the script injection may not work if you have custom arguments defined in the terminal profile, have enabled {1}, have a [complex bash `PROMPT_COMMAND`](https://code.visualstudio.com/docs/editor/integrated-terminal#_complex-bash-promptcommand), or other unsupported setup. To disable decorations, see {0}", "`#terminal.integrated.shellIntegration.decorationsEnabled#`", "`#editor.accessibilitySupport#`"),
      type: "boolean",
      default: true
    },
    [TerminalSettingId.ShellIntegrationDecorationsEnabled]: {
      restricted: true,
      markdownDescription: localize("terminal.integrated.shellIntegration.decorationsEnabled", "When shell integration is enabled, adds a decoration for each command."),
      type: "string",
      enum: ["both", "gutter", "overviewRuler", "never"],
      enumDescriptions: [
        localize("terminal.integrated.shellIntegration.decorationsEnabled.both", "Show decorations in the gutter (left) and overview ruler (right)"),
        localize("terminal.integrated.shellIntegration.decorationsEnabled.gutter", "Show gutter decorations to the left of the terminal"),
        localize("terminal.integrated.shellIntegration.decorationsEnabled.overviewRuler", "Show overview ruler decorations to the right of the terminal"),
        localize("terminal.integrated.shellIntegration.decorationsEnabled.never", "Do not show decorations")
      ],
      default: "both"
    },
    [TerminalSettingId.ShellIntegrationEnvironmentReporting]: {
      markdownDescription: localize("terminal.integrated.shellIntegration.environmentReporting", "Controls whether to report the shell environment, enabling its use in features such as {0}. This may cause a slowdown when printing your shell's prompt.", `\`#${TerminalContribSettingId.SuggestEnabled}#\``),
      type: "boolean",
      default: product.quality !== "stable"
    },
    [TerminalSettingId.SmoothScrolling]: {
      markdownDescription: localize("terminal.integrated.smoothScrolling", "Controls whether the terminal will scroll using an animation."),
      type: "boolean",
      default: false
    },
    [TerminalSettingId.IgnoreBracketedPasteMode]: {
      markdownDescription: localize("terminal.integrated.ignoreBracketedPasteMode", "Controls whether the terminal will ignore bracketed paste mode even if the terminal was put into the mode, omitting the {0} and {1} sequences when pasting. This is useful when the shell is not respecting the mode which can happen in sub-shells for example.", "`\\x1b[200~`", "`\\x1b[201~`"),
      type: "boolean",
      default: false
    },
    [TerminalSettingId.EnableImages]: {
      restricted: true,
      markdownDescription: localize("terminal.integrated.enableImages", "Enables image support in the terminal, this will only work when {0} is enabled. Both sixel and iTerm's inline image protocol are supported on Linux and macOS. This will only work on Windows for versions of ConPTY >= v2 which is shipped with Windows itself, see also {1}. Images will currently not be restored between window reloads/reconnects.", `\`#${TerminalSettingId.GpuAcceleration}#\``, `\`#${TerminalSettingId.WindowsUseConptyDll}#\``),
      type: "boolean",
      default: false
    },
    [TerminalSettingId.FocusAfterRun]: {
      markdownDescription: localize("terminal.integrated.focusAfterRun", "Controls whether the terminal, accessible buffer, or neither will be focused after `Terminal: Run Selected Text In Active Terminal` has been run."),
      enum: ["terminal", "accessible-buffer", "none"],
      default: "none",
      tags: ["accessibility"],
      markdownEnumDescriptions: [
        localize("terminal.integrated.focusAfterRun.terminal", "Always focus the terminal."),
        localize("terminal.integrated.focusAfterRun.accessible-buffer", "Always focus the accessible buffer."),
        localize("terminal.integrated.focusAfterRun.none", "Do nothing.")
      ]
    },
    ...terminalContribConfiguration
  }
};
async function registerTerminalConfiguration(getFontSnippets) {
  const configurationRegistry = Registry.as(Extensions.Configuration);
  configurationRegistry.registerConfiguration(terminalConfiguration);
  const fontsSnippets = await getFontSnippets();
  if (terminalConfiguration.properties) {
    terminalConfiguration.properties[TerminalSettingId.FontFamily].defaultSnippets = fontsSnippets;
  }
}
Registry.as(WorkbenchExtensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: TerminalSettingId.EnableBell,
  migrateFn: (enableBell, accessor) => {
    const configurationKeyValuePairs = [];
    let announcement = accessor("accessibility.signals.terminalBell")?.announcement ?? accessor("accessibility.alert.terminalBell");
    if (announcement !== void 0 && typeof announcement !== "string") {
      announcement = announcement ? "auto" : "off";
    }
    configurationKeyValuePairs.push(["accessibility.signals.terminalBell", { value: { sound: enableBell ? "on" : "off", announcement } }]);
    configurationKeyValuePairs.push([TerminalSettingId.EnableBell, { value: void 0 }]);
    configurationKeyValuePairs.push([TerminalSettingId.EnableVisualBell, { value: enableBell }]);
    return configurationKeyValuePairs;
  }
}]);
export {
  defaultTerminalFontSize,
  registerTerminalConfiguration
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9jb21tb24vdGVybWluYWxDb25maWd1cmF0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IElKU09OU2NoZW1hU25pcHBldCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2gsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25TY29wZSwgRXh0ZW5zaW9ucywgSUNvbmZpZ3VyYXRpb25Ob2RlLCBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCBwcm9kdWN0IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3QuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVGVybWluYWxMb2NhdGlvblN0cmluZywgVGVybWluYWxTZXR0aW5nSWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgdGVybWluYWxDb2xvclNjaGVtYSwgdGVybWluYWxJY29uU2NoZW1hIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsUGxhdGZvcm1Db25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25LZXlWYWx1ZVBhaXJzLCBJQ29uZmlndXJhdGlvbk1pZ3JhdGlvblJlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIFdvcmtiZW5jaEV4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyB0ZXJtaW5hbENvbnRyaWJDb25maWd1cmF0aW9uLCBUZXJtaW5hbENvbnRyaWJTZXR0aW5nSWQgfSBmcm9tICcuLi90ZXJtaW5hbENvbnRyaWJFeHBvcnRzLmpzJztcbmltcG9ydCB7IERFRkFVTFRfQ09NTUFORFNfVE9fU0tJUF9TSEVMTCwgREVGQVVMVF9MRVRURVJfU1BBQ0lORywgREVGQVVMVF9MSU5FX0hFSUdIVCwgTUFYSU1VTV9GT05UX1dFSUdIVCwgTUlOSU1VTV9GT05UX1dFSUdIVCwgU1VHR0VTVElPTlNfRk9OVF9XRUlHSFQgfSBmcm9tICcuL3Rlcm1pbmFsLmpzJztcblxuY29uc3QgdGVybWluYWxEZXNjcmlwdG9ycyA9ICdcXG4tICcgKyBbXG5cdCdgXFwke2N3ZH1gOiAnICsgbG9jYWxpemUoXCJjd2RcIiwgXCJ0aGUgdGVybWluYWwncyBjdXJyZW50IHdvcmtpbmcgZGlyZWN0b3J5LlwiKSxcblx0J2BcXCR7Y3dkRm9sZGVyfWA6ICcgKyBsb2NhbGl6ZSgnY3dkRm9sZGVyJywgXCJ0aGUgdGVybWluYWwncyBjdXJyZW50IHdvcmtpbmcgZGlyZWN0b3J5LCBkaXNwbGF5ZWQgZm9yIG11bHRpLXJvb3Qgd29ya3NwYWNlcyBvciBpbiBhIHNpbmdsZSByb290IHdvcmtzcGFjZSB3aGVuIHRoZSB2YWx1ZSBkaWZmZXJzIGZyb20gdGhlIGluaXRpYWwgd29ya2luZyBkaXJlY3RvcnkuIE9uIFdpbmRvd3MsIHRoaXMgd2lsbCBvbmx5IGJlIGRpc3BsYXllZCB3aGVuIHNoZWxsIGludGVncmF0aW9uIGlzIGVuYWJsZWQuXCIpLFxuXHQnYFxcJHt3b3Jrc3BhY2VGb2xkZXJ9YDogJyArIGxvY2FsaXplKCd3b3Jrc3BhY2VGb2xkZXInLCBcInRoZSB3b3Jrc3BhY2UgaW4gd2hpY2ggdGhlIHRlcm1pbmFsIHdhcyBsYXVuY2hlZC5cIiksXG5cdCdgXFwke3dvcmtzcGFjZUZvbGRlck5hbWV9YDogJyArIGxvY2FsaXplKCd3b3Jrc3BhY2VGb2xkZXJOYW1lJywgXCJ0aGUgYG5hbWVgIG9mIHRoZSB3b3Jrc3BhY2UgaW4gd2hpY2ggdGhlIHRlcm1pbmFsIHdhcyBsYXVuY2hlZC5cIiksXG5cdCdgXFwke2xvY2FsfWA6ICcgKyBsb2NhbGl6ZSgnbG9jYWwnLCBcImluZGljYXRlcyBhIGxvY2FsIHRlcm1pbmFsIGluIGEgcmVtb3RlIHdvcmtzcGFjZS5cIiksXG5cdCdgXFwke3Byb2Nlc3N9YDogJyArIGxvY2FsaXplKCdwcm9jZXNzJywgXCJ0aGUgbmFtZSBvZiB0aGUgdGVybWluYWwgcHJvY2Vzcy5cIiksXG5cdCdgXFwke3Byb2dyZXNzfWA6ICcgKyBsb2NhbGl6ZSgncHJvZ3Jlc3MnLCBcInRoZSBwcm9ncmVzcyBzdGF0ZSBhcyByZXBvcnRlZCBieSB0aGUgYE9TQyA5OzRgIHNlcXVlbmNlLlwiKSxcblx0J2BcXCR7c2VwYXJhdG9yfWA6ICcgKyBsb2NhbGl6ZSgnc2VwYXJhdG9yJywgXCJhIGNvbmRpdGlvbmFsIHNlcGFyYXRvciB7MH0gdGhhdCBvbmx5IHNob3dzIHdoZW4gaXQncyBzdXJyb3VuZGVkIGJ5IHZhcmlhYmxlcyB3aXRoIHZhbHVlcyBvciBzdGF0aWMgdGV4dC5cIiwgJyhgIC0gYCknKSxcblx0J2BcXCR7c2VxdWVuY2V9YDogJyArIGxvY2FsaXplKCdzZXF1ZW5jZScsIFwidGhlIG5hbWUgcHJvdmlkZWQgdG8gdGhlIHRlcm1pbmFsIGJ5IHRoZSBwcm9jZXNzLlwiKSxcblx0J2BcXCR7dGFza31gOiAnICsgbG9jYWxpemUoJ3Rhc2snLCBcImluZGljYXRlcyB0aGlzIHRlcm1pbmFsIGlzIGFzc29jaWF0ZWQgd2l0aCBhIHRhc2suXCIpLFxuXHQnYFxcJHtzaGVsbFR5cGV9YDogJyArIGxvY2FsaXplKCdzaGVsbFR5cGUnLCBcInRoZSBkZXRlY3RlZCBzaGVsbCB0eXBlLlwiKSxcblx0J2BcXCR7c2hlbGxDb21tYW5kfWA6ICcgKyBsb2NhbGl6ZSgnc2hlbGxDb21tYW5kJywgXCJ0aGUgY29tbWFuZCBiZWluZyBleGVjdXRlZCBhY2NvcmRpbmcgdG8gc2hlbGwgaW50ZWdyYXRpb24uIFRoaXMgYWxzbyByZXF1aXJlcyBoaWdoIGNvbmZpZGVuY2UgaW4gdGhlIGRldGVjdGVkIGNvbW1hbmQgbGluZSwgd2hpY2ggbWF5IG5vdCB3b3JrIGluIHNvbWUgcHJvbXB0IGZyYW1ld29ya3MuXCIpLFxuXHQnYFxcJHtzaGVsbFByb21wdElucHV0fWA6ICcgKyBsb2NhbGl6ZSgnc2hlbGxQcm9tcHRJbnB1dCcsIFwidGhlIHNoZWxsJ3MgZnVsbCBwcm9tcHQgaW5wdXQgYWNjb3JkaW5nIHRvIHNoZWxsIGludGVncmF0aW9uLlwiKSxcbl0uam9pbignXFxuLSAnKTsgLy8gaW50ZW50aW9uYWxseSBjb25jYXRlbmF0ZWQgdG8gbm90IHByb2R1Y2UgYSBzdHJpbmcgdGhhdCBpcyB0b28gbG9uZyBmb3IgdHJhbnNsYXRpb25zXG5cbmxldCB0ZXJtaW5hbFRpdGxlID0gbG9jYWxpemUoJ3Rlcm1pbmFsVGl0bGUnLCBcIkNvbnRyb2xzIHRoZSB0ZXJtaW5hbCB0aXRsZS4gVmFyaWFibGVzIGFyZSBzdWJzdGl0dXRlZCBiYXNlZCBvbiB0aGUgY29udGV4dDpcIik7XG50ZXJtaW5hbFRpdGxlICs9IHRlcm1pbmFsRGVzY3JpcHRvcnM7XG5cbmxldCB0ZXJtaW5hbERlc2NyaXB0aW9uID0gbG9jYWxpemUoJ3Rlcm1pbmFsRGVzY3JpcHRpb24nLCBcIkNvbnRyb2xzIHRoZSB0ZXJtaW5hbCBkZXNjcmlwdGlvbiwgd2hpY2ggYXBwZWFycyB0byB0aGUgcmlnaHQgb2YgdGhlIHRpdGxlLiBWYXJpYWJsZXMgYXJlIHN1YnN0aXR1dGVkIGJhc2VkIG9uIHRoZSBjb250ZXh0OlwiKTtcbnRlcm1pbmFsRGVzY3JpcHRpb24gKz0gdGVybWluYWxEZXNjcmlwdG9ycztcblxuZXhwb3J0IGNvbnN0IGRlZmF1bHRUZXJtaW5hbEZvbnRTaXplID0gaXNNYWNpbnRvc2ggPyAxMiA6IDE0O1xuXG5jb25zdCB0ZXJtaW5hbENvbmZpZ3VyYXRpb246IElDb25maWd1cmF0aW9uTm9kZSA9IHtcblx0aWQ6ICd0ZXJtaW5hbCcsXG5cdG9yZGVyOiAxMDAsXG5cdHRpdGxlOiBsb2NhbGl6ZSgndGVybWluYWxJbnRlZ3JhdGVkQ29uZmlndXJhdGlvblRpdGxlJywgXCJJbnRlZ3JhdGVkIFRlcm1pbmFsXCIpLFxuXHR0eXBlOiAnb2JqZWN0Jyxcblx0cHJvcGVydGllczoge1xuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5TZW5kS2V5YmluZGluZ3NUb1NoZWxsXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuc2VuZEtleWJpbmRpbmdzVG9TaGVsbCcsIFwiRGlzcGF0Y2hlcyBtb3N0IGtleWJpbmRpbmdzIHRvIHRoZSB0ZXJtaW5hbCBpbnN0ZWFkIG9mIHRoZSB3b3JrYmVuY2gsIG92ZXJyaWRpbmcgezB9LCB3aGljaCBjYW4gYmUgdXNlZCBhbHRlcm5hdGl2ZWx5IGZvciBmaW5lIHR1bmluZy5cIiwgJ2AjdGVybWluYWwuaW50ZWdyYXRlZC5jb21tYW5kc1RvU2tpcFNoZWxsI2AnKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuVGFic0RlZmF1bHRDb2xvcl06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC50YWJzLmRlZmF1bHRDb2xvcicsIFwiQSB0aGVtZSBjb2xvciBJRCB0byBhc3NvY2lhdGUgd2l0aCB0ZXJtaW5hbCBpY29ucyBieSBkZWZhdWx0LlwiKSxcblx0XHRcdC4uLnRlcm1pbmFsQ29sb3JTY2hlbWEsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLlJFU09VUkNFXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuVGFic0RlZmF1bHRJY29uXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnRhYnMuZGVmYXVsdEljb24nLCBcIkEgY29kaWNvbiBJRCB0byBhc3NvY2lhdGUgd2l0aCB0ZXJtaW5hbCBpY29ucyBieSBkZWZhdWx0LlwiKSxcblx0XHRcdC4uLnRlcm1pbmFsSWNvblNjaGVtYSxcblx0XHRcdGRlZmF1bHQ6IENvZGljb24udGVybWluYWwuaWQsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLlJFU09VUkNFXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuVGFic0VuYWJsZWRdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQudGFicy5lbmFibGVkJywgJ0NvbnRyb2xzIHdoZXRoZXIgdGVybWluYWwgdGFicyBkaXNwbGF5IGFzIGEgbGlzdCB0byB0aGUgc2lkZSBvZiB0aGUgdGVybWluYWwuIFdoZW4gdGhpcyBpcyBkaXNhYmxlZCBhIGRyb3Bkb3duIHdpbGwgZGlzcGxheSBpbnN0ZWFkLicpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5UYWJzRW5hYmxlQW5pbWF0aW9uXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnRhYnMuZW5hYmxlQW5pbWF0aW9uJywgJ0NvbnRyb2xzIHdoZXRoZXIgdGVybWluYWwgdGFiIHN0YXR1c2VzIHN1cHBvcnQgYW5pbWF0aW9uIChlZy4gaW4gcHJvZ3Jlc3MgdGFza3MpLicpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5UYWJzSGlkZUNvbmRpdGlvbl06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC50YWJzLmhpZGVDb25kaXRpb24nLCAnQ29udHJvbHMgd2hldGhlciB0aGUgdGVybWluYWwgdGFicyB2aWV3IHdpbGwgaGlkZSB1bmRlciBjZXJ0YWluIGNvbmRpdGlvbnMuJyksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnbmV2ZXInLCAnc2luZ2xlVGVybWluYWwnLCAnc2luZ2xlR3JvdXAnXSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQudGFicy5oaWRlQ29uZGl0aW9uLm5ldmVyJywgXCJOZXZlciBoaWRlIHRoZSB0ZXJtaW5hbCB0YWJzIHZpZXdcIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnRhYnMuaGlkZUNvbmRpdGlvbi5zaW5nbGVUZXJtaW5hbCcsIFwiSGlkZSB0aGUgdGVybWluYWwgdGFicyB2aWV3IHdoZW4gdGhlcmUgaXMgb25seSBhIHNpbmdsZSB0ZXJtaW5hbCBvcGVuZWRcIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnRhYnMuaGlkZUNvbmRpdGlvbi5zaW5nbGVHcm91cCcsIFwiSGlkZSB0aGUgdGVybWluYWwgdGFicyB2aWV3IHdoZW4gdGhlcmUgaXMgb25seSBhIHNpbmdsZSB0ZXJtaW5hbCBncm91cCBvcGVuZWRcIiksXG5cdFx0XHRdLFxuXHRcdFx0ZGVmYXVsdDogJ3NpbmdsZVRlcm1pbmFsJyxcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5UYWJzU2hvd0FjdGl2ZVRlcm1pbmFsXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnRhYnMuc2hvd0FjdGl2ZVRlcm1pbmFsJywgJ1Nob3dzIHRoZSBhY3RpdmUgdGVybWluYWwgaW5mb3JtYXRpb24gaW4gdGhlIHZpZXcuIFRoaXMgaXMgcGFydGljdWxhcmx5IHVzZWZ1bCB3aGVuIHRoZSB0aXRsZSB3aXRoaW4gdGhlIHRhYnMgYXJlblxcJ3QgdmlzaWJsZS4nKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydhbHdheXMnLCAnc2luZ2xlVGVybWluYWwnLCAnc2luZ2xlVGVybWluYWxPck5hcnJvdycsICduZXZlciddLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC50YWJzLnNob3dBY3RpdmVUZXJtaW5hbC5hbHdheXMnLCBcIkFsd2F5cyBzaG93IHRoZSBhY3RpdmUgdGVybWluYWxcIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnRhYnMuc2hvd0FjdGl2ZVRlcm1pbmFsLnNpbmdsZVRlcm1pbmFsJywgXCJTaG93IHRoZSBhY3RpdmUgdGVybWluYWwgd2hlbiBpdCBpcyB0aGUgb25seSB0ZXJtaW5hbCBvcGVuZWRcIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnRhYnMuc2hvd0FjdGl2ZVRlcm1pbmFsLnNpbmdsZVRlcm1pbmFsT3JOYXJyb3cnLCBcIlNob3cgdGhlIGFjdGl2ZSB0ZXJtaW5hbCB3aGVuIGl0IGlzIHRoZSBvbmx5IHRlcm1pbmFsIG9wZW5lZCBvciB3aGVuIHRoZSB0YWJzIHZpZXcgaXMgaW4gaXRzIG5hcnJvdyB0ZXh0bGVzcyBzdGF0ZVwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQudGFicy5zaG93QWN0aXZlVGVybWluYWwubmV2ZXInLCBcIk5ldmVyIHNob3cgdGhlIGFjdGl2ZSB0ZXJtaW5hbFwiKSxcblx0XHRcdF0sXG5cdFx0XHRkZWZhdWx0OiAnc2luZ2xlVGVybWluYWxPck5hcnJvdycsXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuVGFic1Nob3dBY3Rpb25zXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnRhYnMuc2hvd0FjdGlvbnMnLCAnQ29udHJvbHMgd2hldGhlciB0ZXJtaW5hbCBzcGxpdCBhbmQga2lsbCBidXR0b25zIGFyZSBkaXNwbGF5cyBuZXh0IHRvIHRoZSBuZXcgdGVybWluYWwgYnV0dG9uLicpLFxuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ2Fsd2F5cycsICdzaW5nbGVUZXJtaW5hbCcsICdzaW5nbGVUZXJtaW5hbE9yTmFycm93JywgJ25ldmVyJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnRhYnMuc2hvd0FjdGlvbnMuYWx3YXlzJywgXCJBbHdheXMgc2hvdyB0aGUgYWN0aW9uc1wiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQudGFicy5zaG93QWN0aW9ucy5zaW5nbGVUZXJtaW5hbCcsIFwiU2hvdyB0aGUgYWN0aW9ucyB3aGVuIGl0IGlzIHRoZSBvbmx5IHRlcm1pbmFsIG9wZW5lZFwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQudGFicy5zaG93QWN0aW9ucy5zaW5nbGVUZXJtaW5hbE9yTmFycm93JywgXCJTaG93IHRoZSBhY3Rpb25zIHdoZW4gaXQgaXMgdGhlIG9ubHkgdGVybWluYWwgb3BlbmVkIG9yIHdoZW4gdGhlIHRhYnMgdmlldyBpcyBpbiBpdHMgbmFycm93IHRleHRsZXNzIHN0YXRlXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC50YWJzLnNob3dBY3Rpb25zLm5ldmVyJywgXCJOZXZlciBzaG93IHRoZSBhY3Rpb25zXCIpLFxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6ICdzaW5nbGVUZXJtaW5hbE9yTmFycm93Jyxcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5UYWJzTG9jYXRpb25dOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnbGVmdCcsICdyaWdodCddLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC50YWJzLmxvY2F0aW9uLmxlZnQnLCBcIlNob3cgdGhlIHRlcm1pbmFsIHRhYnMgdmlldyB0byB0aGUgbGVmdCBvZiB0aGUgdGVybWluYWxcIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnRhYnMubG9jYXRpb24ucmlnaHQnLCBcIlNob3cgdGhlIHRlcm1pbmFsIHRhYnMgdmlldyB0byB0aGUgcmlnaHQgb2YgdGhlIHRlcm1pbmFsXCIpXG5cdFx0XHRdLFxuXHRcdFx0ZGVmYXVsdDogJ3JpZ2h0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC50YWJzLmxvY2F0aW9uJywgXCJDb250cm9scyB0aGUgbG9jYXRpb24gb2YgdGhlIHRlcm1pbmFsIHRhYnMsIGVpdGhlciB0byB0aGUgbGVmdCBvciByaWdodCBvZiB0aGUgYWN0dWFsIHRlcm1pbmFsKHMpLlwiKVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkRlZmF1bHRMb2NhdGlvbl06IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogW1Rlcm1pbmFsTG9jYXRpb25TdHJpbmcuRWRpdG9yLCBUZXJtaW5hbExvY2F0aW9uU3RyaW5nLlRlcm1pbmFsVmlld10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmRlZmF1bHRMb2NhdGlvbi5lZGl0b3InLCBcIkNyZWF0ZSB0ZXJtaW5hbHMgaW4gdGhlIGVkaXRvclwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZGVmYXVsdExvY2F0aW9uLnZpZXcnLCBcIkNyZWF0ZSB0ZXJtaW5hbHMgaW4gdGhlIHRlcm1pbmFsIHZpZXdcIilcblx0XHRcdF0sXG5cdFx0XHRkZWZhdWx0OiAndmlldycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZGVmYXVsdExvY2F0aW9uJywgXCJDb250cm9scyB3aGVyZSBuZXdseSBjcmVhdGVkIHRlcm1pbmFscyB3aWxsIGFwcGVhci5cIilcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5UYWJzRm9jdXNNb2RlXToge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ3NpbmdsZUNsaWNrJywgJ2RvdWJsZUNsaWNrJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnRhYnMuZm9jdXNNb2RlLnNpbmdsZUNsaWNrJywgXCJGb2N1cyB0aGUgdGVybWluYWwgd2hlbiBjbGlja2luZyBhIHRlcm1pbmFsIHRhYlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQudGFicy5mb2N1c01vZGUuZG91YmxlQ2xpY2snLCBcIkZvY3VzIHRoZSB0ZXJtaW5hbCB3aGVuIGRvdWJsZS1jbGlja2luZyBhIHRlcm1pbmFsIHRhYlwiKVxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6ICdkb3VibGVDbGljaycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQudGFicy5mb2N1c01vZGUnLCBcIkNvbnRyb2xzIHdoZXRoZXIgZm9jdXNpbmcgdGhlIHRlcm1pbmFsIG9mIGEgdGFiIGhhcHBlbnMgb24gZG91YmxlIG9yIHNpbmdsZSBjbGljay5cIilcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5NYWNPcHRpb25Jc01ldGFdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQubWFjT3B0aW9uSXNNZXRhJywgXCJDb250cm9scyB3aGV0aGVyIHRvIHRyZWF0IHRoZSBvcHRpb24ga2V5IGFzIHRoZSBtZXRhIGtleSBpbiB0aGUgdGVybWluYWwgb24gbWFjT1MuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5NYWNPcHRpb25DbGlja0ZvcmNlc1NlbGVjdGlvbl06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5tYWNPcHRpb25DbGlja0ZvcmNlc1NlbGVjdGlvbicsIFwiQ29udHJvbHMgd2hldGhlciB0byBmb3JjZSBzZWxlY3Rpb24gd2hlbiB1c2luZyBPcHRpb24rY2xpY2sgb24gbWFjT1MuIFRoaXMgd2lsbCBmb3JjZSBhIHJlZ3VsYXIgKGxpbmUpIHNlbGVjdGlvbiBhbmQgZGlzYWxsb3cgdGhlIHVzZSBvZiBjb2x1bW4gc2VsZWN0aW9uIG1vZGUuIFRoaXMgZW5hYmxlcyBjb3B5aW5nIGFuZCBwYXN0aW5nIHVzaW5nIHRoZSByZWd1bGFyIHRlcm1pbmFsIHNlbGVjdGlvbiwgZm9yIGV4YW1wbGUsIHdoZW4gbW91c2UgbW9kZSBpcyBlbmFibGVkIGluIHRtdXguXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5BbHRDbGlja01vdmVzQ3Vyc29yXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuYWx0Q2xpY2tNb3Zlc0N1cnNvcicsIFwiSWYgZW5hYmxlZCwgYWx0L29wdGlvbiArIGNsaWNrIHdpbGwgcmVwb3NpdGlvbiB0aGUgcHJvbXB0IGN1cnNvciB0byB1bmRlcm5lYXRoIHRoZSBtb3VzZSB3aGVuIHswfSBpcyBzZXQgdG8gezF9ICh0aGUgZGVmYXVsdCB2YWx1ZSkuIFRoaXMgbWF5IG5vdCB3b3JrIHJlbGlhYmx5IGRlcGVuZGluZyBvbiB5b3VyIHNoZWxsLlwiLCAnYCNlZGl0b3IubXVsdGlDdXJzb3JNb2RpZmllciNgJywgJ2BcXCdhbHRcXCdgJyksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuQ29weU9uU2VsZWN0aW9uXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmNvcHlPblNlbGVjdGlvbicsIFwiQ29udHJvbHMgd2hldGhlciB0ZXh0IHNlbGVjdGVkIGluIHRoZSB0ZXJtaW5hbCB3aWxsIGJlIGNvcGllZCB0byB0aGUgY2xpcGJvYXJkLlwiKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuRW5hYmxlTXVsdGlMaW5lUGFzdGVXYXJuaW5nXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZW5hYmxlTXVsdGlMaW5lUGFzdGVXYXJuaW5nJywgXCJDb250cm9scyB3aGV0aGVyIHRvIHNob3cgYSB3YXJuaW5nIGRpYWxvZyB3aGVuIHBhc3RpbmcgbXVsdGlwbGUgbGluZXMgaW50byB0aGUgdGVybWluYWwuXCIpLFxuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ2F1dG8nLCAnYWx3YXlzJywgJ25ldmVyJ10sXG5cdFx0XHRtYXJrZG93bkVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZW5hYmxlTXVsdGlMaW5lUGFzdGVXYXJuaW5nLmF1dG8nLCBcIkVuYWJsZSB0aGUgd2FybmluZyBidXQgZG8gbm90IHNob3cgaXQgd2hlbjpcXG5cXG4tIEJyYWNrZXRlZCBwYXN0ZSBtb2RlIGlzIGVuYWJsZWQgKHRoZSBzaGVsbCBzdXBwb3J0cyBtdWx0aS1saW5lIHBhc3RlIG5hdGl2ZWx5KVxcbi0gVGhlIHBhc3RlIGlzIGhhbmRsZWQgYnkgdGhlIHNoZWxsJ3MgcmVhZGxpbmUgKGluIHRoZSBjYXNlIG9mIHB3c2gpXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5lbmFibGVNdWx0aUxpbmVQYXN0ZVdhcm5pbmcuYWx3YXlzJywgXCJBbHdheXMgc2hvdyB0aGUgd2FybmluZyBpZiB0aGUgdGV4dCBjb250YWlucyBhIG5ldyBsaW5lLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZW5hYmxlTXVsdGlMaW5lUGFzdGVXYXJuaW5nLm5ldmVyJywgXCJOZXZlciBzaG93IHRoZSB3YXJuaW5nLlwiKVxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6ICdhdXRvJ1xuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkRyYXdCb2xkVGV4dEluQnJpZ2h0Q29sb3JzXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmRyYXdCb2xkVGV4dEluQnJpZ2h0Q29sb3JzJywgXCJDb250cm9scyB3aGV0aGVyIGJvbGQgdGV4dCBpbiB0aGUgdGVybWluYWwgd2lsbCBhbHdheXMgdXNlIHRoZSBcXFwiYnJpZ2h0XFxcIiBBTlNJIGNvbG9yIHZhcmlhbnQuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkZvbnRGYW1pbHldOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5mb250RmFtaWx5JywgXCJDb250cm9scyB0aGUgZm9udCBmYW1pbHkgb2YgdGhlIHRlcm1pbmFsLiBEZWZhdWx0cyB0byB7MH0ncyB2YWx1ZS5cIiwgJ2AjZWRpdG9yLmZvbnRGYW1pbHkjYCcpLFxuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuRm9udExpZ2F0dXJlc0VuYWJsZWRdOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5mb250TGlnYXR1cmVzLmVuYWJsZWQnLCBcIkNvbnRyb2xzIHdoZXRoZXIgZm9udCBsaWdhdHVyZXMgYXJlIGVuYWJsZWQgaW4gdGhlIHRlcm1pbmFsLiBMaWdhdHVyZXMgd2lsbCBvbmx5IHdvcmsgaWYgdGhlIGNvbmZpZ3VyZWQgezB9IHN1cHBvcnRzIHRoZW0uXCIsIGBcXGAjJHtUZXJtaW5hbFNldHRpbmdJZC5Gb250RmFtaWx5fSNcXGBgKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuRm9udExpZ2F0dXJlc0ZlYXR1cmVTZXR0aW5nc106IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmZvbnRMaWdhdHVyZXMuZmVhdHVyZVNldHRpbmdzJywgXCJDb250cm9scyB3aGF0IGZvbnQgZmVhdHVyZSBzZXR0aW5ncyBhcmUgdXNlZCB3aGVuIGxpZ2F0dXJlcyBhcmUgZW5hYmxlZCwgaW4gdGhlIGZvcm1hdCBvZiB0aGUgYGZvbnQtZmVhdHVyZS1zZXR0aW5nc2AgQ1NTIHByb3BlcnR5LiBTb21lIGV4YW1wbGVzIHdoaWNoIG1heSBiZSB2YWxpZCBkZXBlbmRpbmcgb24gdGhlIGZvbnQ6XCIpICsgJ1xcblxcbi0gJyArIFtcblx0XHRcdFx0YFxcYFwiY2FsdFwiIG9mZiwgXCJzczAzXCJcXGBgLFxuXHRcdFx0XHRgXFxgXCJsaWdhXCIgb25cXGBgLFxuXHRcdFx0XHRgXFxgXCJjYWx0XCIgb2ZmLCBcImRsaWdcIiBvblxcYGBcblx0XHRcdF0uam9pbignXFxuLSAnKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZGVmYXVsdDogJ1wiY2FsdFwiIG9uJ1xuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkZvbnRMaWdhdHVyZXNGYWxsYmFja0xpZ2F0dXJlc106IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmZvbnRMaWdhdHVyZXMuZmFsbGJhY2tMaWdhdHVyZXMnLCBcIldoZW4gezB9IGlzIGVuYWJsZWQgYW5kIHRoZSBwYXJ0aWN1bGFyIHsxfSBjYW5ub3QgYmUgcGFyc2VkLCB0aGlzIGlzIHRoZSBzZXQgb2YgY2hhcmFjdGVyIHNlcXVlbmNlcyB0aGF0IHdpbGwgYWx3YXlzIGJlIGRyYXduIHRvZ2V0aGVyLiBUaGlzIGFsbG93cyB0aGUgdXNlIG9mIGEgZml4ZWQgc2V0IG9mIGxpZ2F0dXJlcyBldmVuIHdoZW4gdGhlIGZvbnQgaXNuJ3Qgc3VwcG9ydGVkLlwiLCBgXFxgIyR7VGVybWluYWxTZXR0aW5nSWQuR3B1QWNjZWxlcmF0aW9ufSNcXGBgLCBgXFxgIyR7VGVybWluYWxTZXR0aW5nSWQuRm9udEZhbWlseX0jXFxgYCksXG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0aXRlbXM6IFt7IHR5cGU6ICdzdHJpbmcnIH1dLFxuXHRcdFx0ZGVmYXVsdDogW1xuXHRcdFx0XHQnPC0tJywgJzwtLS0nLCAnPDwtJywgJzwtJywgJy0+JywgJy0+PicsICctLT4nLCAnLS0tPicsXG5cdFx0XHRcdCc8PT0nLCAnPD09PScsICc8PD0nLCAnPD0nLCAnPT4nLCAnPT4+JywgJz09PicsICc9PT0+JywgJz49JywgJz4+PScsXG5cdFx0XHRcdCc8LT4nLCAnPC0tPicsICc8LS0tPicsICc8LS0tLT4nLCAnPD0+JywgJzw9PT4nLCAnPD09PT4nLCAnPD09PT0+JywgJzo6JywgJzo6OicsXG5cdFx0XHRcdCc8fn4nLCAnPC8nLCAnPC8+JywgJy8+JywgJ35+PicsICc9PScsICchPScsICcvPScsICd+PScsICc8PicsICc9PT0nLCAnIT09JywgJyE9PT0nLFxuXHRcdFx0XHQnPDonLCAnOj0nLCAnKj0nLCAnKisnLCAnPConLCAnPCo+JywgJyo+JywgJzx8JywgJzx8PicsICd8PicsICcrKicsICc9KicsICc9OicsICc6PicsXG5cdFx0XHRcdCcvKicsICcqLycsICcrKysnLCAnPCEtLScsICc8IS0tLSdcblx0XHRcdF1cblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5Gb250U2l6ZV06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5mb250U2l6ZScsIFwiQ29udHJvbHMgdGhlIGZvbnQgc2l6ZSBpbiBwaXhlbHMgb2YgdGhlIHRlcm1pbmFsLlwiKSxcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0ZGVmYXVsdDogZGVmYXVsdFRlcm1pbmFsRm9udFNpemUsXG5cdFx0XHRtaW5pbXVtOiA2LFxuXHRcdFx0bWF4aW11bTogMTAwXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuTGV0dGVyU3BhY2luZ106IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5sZXR0ZXJTcGFjaW5nJywgXCJDb250cm9scyB0aGUgbGV0dGVyIHNwYWNpbmcgb2YgdGhlIHRlcm1pbmFsLiBUaGlzIGlzIGFuIGludGVnZXIgdmFsdWUgd2hpY2ggcmVwcmVzZW50cyB0aGUgbnVtYmVyIG9mIGFkZGl0aW9uYWwgcGl4ZWxzIHRvIGFkZCBiZXR3ZWVuIGNoYXJhY3RlcnMuXCIpLFxuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRkZWZhdWx0OiBERUZBVUxUX0xFVFRFUl9TUEFDSU5HXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuTGluZUhlaWdodF06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5saW5lSGVpZ2h0JywgXCJDb250cm9scyB0aGUgbGluZSBoZWlnaHQgb2YgdGhlIHRlcm1pbmFsLiBUaGlzIG51bWJlciBpcyBtdWx0aXBsaWVkIGJ5IHRoZSB0ZXJtaW5hbCBmb250IHNpemUgdG8gZ2V0IHRoZSBhY3R1YWwgbGluZS1oZWlnaHQgaW4gcGl4ZWxzLlwiKSxcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0ZGVmYXVsdDogREVGQVVMVF9MSU5FX0hFSUdIVFxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLk1pbmltdW1Db250cmFzdFJhdGlvXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQubWluaW11bUNvbnRyYXN0UmF0aW8nLCBcIldoZW4gc2V0LCB0aGUgZm9yZWdyb3VuZCBjb2xvciBvZiBlYWNoIGNlbGwgd2lsbCBjaGFuZ2UgdG8gdHJ5IG1lZXQgdGhlIGNvbnRyYXN0IHJhdGlvIHNwZWNpZmllZC4gTm90ZSB0aGF0IHRoaXMgd2lsbCBub3QgYXBwbHkgdG8gYHBvd2VybGluZWAgY2hhcmFjdGVycyBwZXIgIzE0NjQwNi4gRXhhbXBsZSB2YWx1ZXM6XFxuXFxuLSAxOiBEbyBub3RoaW5nIGFuZCB1c2UgdGhlIHN0YW5kYXJkIHRoZW1lIGNvbG9ycy5cXG4tIDQuNTogW1dDQUcgQUEgY29tcGxpYW5jZSAobWluaW11bSldKGh0dHBzOi8vd3d3LnczLm9yZy9UUi9VTkRFUlNUQU5ESU5HLVdDQUcyMC92aXN1YWwtYXVkaW8tY29udHJhc3QtY29udHJhc3QuaHRtbCkgKGRlZmF1bHQpLlxcbi0gNzogW1dDQUcgQUFBIGNvbXBsaWFuY2UgKGVuaGFuY2VkKV0oaHR0cHM6Ly93d3cudzMub3JnL1RSL1VOREVSU1RBTkRJTkctV0NBRzIwL3Zpc3VhbC1hdWRpby1jb250cmFzdDcuaHRtbCkuXFxuLSAyMTogV2hpdGUgb24gYmxhY2sgb3IgYmxhY2sgb24gd2hpdGUuXCIpLFxuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRkZWZhdWx0OiA0LjUsXG5cdFx0XHR0YWdzOiBbJ2FjY2Vzc2liaWxpdHknXVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLlRhYlN0b3BXaWR0aF06IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnRhYlN0b3BXaWR0aCcsIFwiVGhlIG51bWJlciBvZiBjZWxscyBpbiBhIHRhYiBzdG9wLlwiKSxcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0bWluaW11bTogMSxcblx0XHRcdGRlZmF1bHQ6IDhcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5GYXN0U2Nyb2xsU2Vuc2l0aXZpdHldOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5mYXN0U2Nyb2xsU2Vuc2l0aXZpdHknLCBcIlNjcm9sbGluZyBzcGVlZCBtdWx0aXBsaWVyIHdoZW4gcHJlc3NpbmcgYEFsdGAuXCIpLFxuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRkZWZhdWx0OiA1XG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuTW91c2VXaGVlbFNjcm9sbFNlbnNpdGl2aXR5XToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQubW91c2VXaGVlbFNjcm9sbFNlbnNpdGl2aXR5JywgXCJBIG11bHRpcGxpZXIgdG8gYmUgdXNlZCBvbiB0aGUgYGRlbHRhWWAgb2YgbW91c2Ugd2hlZWwgc2Nyb2xsIGV2ZW50cy5cIiksXG5cdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdGRlZmF1bHQ6IDFcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5CZWxsRHVyYXRpb25dOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5iZWxsRHVyYXRpb24nLCBcIlRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRvIHNob3cgdGhlIGJlbGwgd2l0aGluIGEgdGVybWluYWwgdGFiIHdoZW4gdHJpZ2dlcmVkLlwiKSxcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0ZGVmYXVsdDogMTAwMFxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkZvbnRXZWlnaHRdOiB7XG5cdFx0XHQnYW55T2YnOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdFx0XHRtaW5pbXVtOiBNSU5JTVVNX0ZPTlRfV0VJR0hULFxuXHRcdFx0XHRcdG1heGltdW06IE1BWElNVU1fRk9OVF9XRUlHSFQsXG5cdFx0XHRcdFx0ZXJyb3JNZXNzYWdlOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5mb250V2VpZ2h0RXJyb3InLCBcIk9ubHkgXFxcIm5vcm1hbFxcXCIgYW5kIFxcXCJib2xkXFxcIiBrZXl3b3JkcyBvciBudW1iZXJzIGJldHdlZW4gMSBhbmQgMTAwMCBhcmUgYWxsb3dlZC5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdHBhdHRlcm46ICdeKG5vcm1hbHxib2xkfDEwMDB8WzEtOV1bMC05XXswLDJ9KSQnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRlbnVtOiBTVUdHRVNUSU9OU19GT05UX1dFSUdIVCxcblx0XHRcdFx0fVxuXHRcdFx0XSxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5mb250V2VpZ2h0JywgXCJUaGUgZm9udCB3ZWlnaHQgdG8gdXNlIHdpdGhpbiB0aGUgdGVybWluYWwgZm9yIG5vbi1ib2xkIHRleHQuIEFjY2VwdHMgXFxcIm5vcm1hbFxcXCIgYW5kIFxcXCJib2xkXFxcIiBrZXl3b3JkcyBvciBudW1iZXJzIGJldHdlZW4gMSBhbmQgMTAwMC5cIiksXG5cdFx0XHRkZWZhdWx0OiAnbm9ybWFsJ1xuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkZvbnRXZWlnaHRCb2xkXToge1xuXHRcdFx0J2FueU9mJzogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRcdFx0bWluaW11bTogTUlOSU1VTV9GT05UX1dFSUdIVCxcblx0XHRcdFx0XHRtYXhpbXVtOiBNQVhJTVVNX0ZPTlRfV0VJR0hULFxuXHRcdFx0XHRcdGVycm9yTWVzc2FnZTogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZm9udFdlaWdodEVycm9yJywgXCJPbmx5IFxcXCJub3JtYWxcXFwiIGFuZCBcXFwiYm9sZFxcXCIga2V5d29yZHMgb3IgbnVtYmVycyBiZXR3ZWVuIDEgYW5kIDEwMDAgYXJlIGFsbG93ZWQuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRwYXR0ZXJuOiAnXihub3JtYWx8Ym9sZHwxMDAwfFsxLTldWzAtOV17MCwyfSkkJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZW51bTogU1VHR0VTVElPTlNfRk9OVF9XRUlHSFQsXG5cdFx0XHRcdH1cblx0XHRcdF0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZm9udFdlaWdodEJvbGQnLCBcIlRoZSBmb250IHdlaWdodCB0byB1c2Ugd2l0aGluIHRoZSB0ZXJtaW5hbCBmb3IgYm9sZCB0ZXh0LiBBY2NlcHRzIFxcXCJub3JtYWxcXFwiIGFuZCBcXFwiYm9sZFxcXCIga2V5d29yZHMgb3IgbnVtYmVycyBiZXR3ZWVuIDEgYW5kIDEwMDAuXCIpLFxuXHRcdFx0ZGVmYXVsdDogJ2JvbGQnXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuQ3Vyc29yQmxpbmtpbmddOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuY3Vyc29yQmxpbmtpbmcnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIHRlcm1pbmFsIGN1cnNvciBibGlua3MuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5DdXJzb3JTdHlsZV06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5jdXJzb3JTdHlsZScsIFwiQ29udHJvbHMgdGhlIHN0eWxlIG9mIHRlcm1pbmFsIGN1cnNvciB3aGVuIHRoZSB0ZXJtaW5hbCBpcyBmb2N1c2VkLlwiKSxcblx0XHRcdGVudW06IFsnYmxvY2snLCAnbGluZScsICd1bmRlcmxpbmUnXSxcblx0XHRcdGRlZmF1bHQ6ICdibG9jaydcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5DdXJzb3JTdHlsZUluYWN0aXZlXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmN1cnNvclN0eWxlSW5hY3RpdmUnLCBcIkNvbnRyb2xzIHRoZSBzdHlsZSBvZiB0ZXJtaW5hbCBjdXJzb3Igd2hlbiB0aGUgdGVybWluYWwgaXMgbm90IGZvY3VzZWQuXCIpLFxuXHRcdFx0ZW51bTogWydvdXRsaW5lJywgJ2Jsb2NrJywgJ2xpbmUnLCAndW5kZXJsaW5lJywgJ25vbmUnXSxcblx0XHRcdGRlZmF1bHQ6ICdvdXRsaW5lJ1xuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkN1cnNvcldpZHRoXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuY3Vyc29yV2lkdGgnLCBcIkNvbnRyb2xzIHRoZSB3aWR0aCBvZiB0aGUgY3Vyc29yIHdoZW4gezB9IGlzIHNldCB0byB7MX0uXCIsICdgI3Rlcm1pbmFsLmludGVncmF0ZWQuY3Vyc29yU3R5bGUjYCcsICdgbGluZWAnKSxcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0ZGVmYXVsdDogMVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLlNjcm9sbGJhY2tdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuc2Nyb2xsYmFjaycsIFwiQ29udHJvbHMgdGhlIG1heGltdW0gbnVtYmVyIG9mIGxpbmVzIHRoZSB0ZXJtaW5hbCBrZWVwcyBpbiBpdHMgYnVmZmVyLiBXZSBwcmUtYWxsb2NhdGUgbWVtb3J5IGJhc2VkIG9uIHRoaXMgdmFsdWUgaW4gb3JkZXIgdG8gZW5zdXJlIGEgc21vb3RoIGV4cGVyaWVuY2UuIEFzIHN1Y2gsIGFzIHRoZSB2YWx1ZSBpbmNyZWFzZXMsIHNvIHdpbGwgdGhlIGFtb3VudCBvZiBtZW1vcnkuXCIpLFxuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRkZWZhdWx0OiAxMDAwXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuRGV0ZWN0TG9jYWxlXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZGV0ZWN0TG9jYWxlJywgXCJDb250cm9scyB3aGV0aGVyIHRvIGRldGVjdCBhbmQgc2V0IHRoZSBgJExBTkdgIGVudmlyb25tZW50IHZhcmlhYmxlIHRvIGEgVVRGLTggY29tcGxpYW50IG9wdGlvbiBzaW5jZSBWUyBDb2RlJ3MgdGVybWluYWwgb25seSBzdXBwb3J0cyBVVEYtOCBlbmNvZGVkIGRhdGEgY29taW5nIGZyb20gdGhlIHNoZWxsLlwiKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydhdXRvJywgJ29mZicsICdvbiddLFxuXHRcdFx0bWFya2Rvd25FbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmRldGVjdExvY2FsZS5hdXRvJywgXCJTZXQgdGhlIGAkTEFOR2AgZW52aXJvbm1lbnQgdmFyaWFibGUgaWYgdGhlIGV4aXN0aW5nIHZhcmlhYmxlIGRvZXMgbm90IGV4aXN0IG9yIGl0IGRvZXMgbm90IGVuZCBpbiBgJy5VVEYtOCdgLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZGV0ZWN0TG9jYWxlLm9mZicsIFwiRG8gbm90IHNldCB0aGUgYCRMQU5HYCBlbnZpcm9ubWVudCB2YXJpYWJsZS5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmRldGVjdExvY2FsZS5vbicsIFwiQWx3YXlzIHNldCB0aGUgYCRMQU5HYCBlbnZpcm9ubWVudCB2YXJpYWJsZS5cIilcblx0XHRcdF0sXG5cdFx0XHRkZWZhdWx0OiAnYXV0bydcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5HcHVBY2NlbGVyYXRpb25dOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnYXV0bycsICdvbicsICdvZmYnXSxcblx0XHRcdG1hcmtkb3duRW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5ncHVBY2NlbGVyYXRpb24uYXV0bycsIFwiTGV0IFZTIENvZGUgZGV0ZWN0IHdoaWNoIHJlbmRlcmVyIHdpbGwgZ2l2ZSB0aGUgYmVzdCBleHBlcmllbmNlLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZ3B1QWNjZWxlcmF0aW9uLm9uJywgXCJFbmFibGUgR1BVIGFjY2VsZXJhdGlvbiB3aXRoaW4gdGhlIHRlcm1pbmFsLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZ3B1QWNjZWxlcmF0aW9uLm9mZicsIFwiRGlzYWJsZSBHUFUgYWNjZWxlcmF0aW9uIHdpdGhpbiB0aGUgdGVybWluYWwuIFRoZSB0ZXJtaW5hbCB3aWxsIHJlbmRlciBtdWNoIHNsb3dlciB3aGVuIEdQVSBhY2NlbGVyYXRpb24gaXMgb2ZmIGJ1dCBpdCBzaG91bGQgcmVsaWFibHkgd29yayBvbiBhbGwgc3lzdGVtcy5cIiksXG5cdFx0XHRdLFxuXHRcdFx0ZGVmYXVsdDogJ2F1dG8nLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmdwdUFjY2VsZXJhdGlvbicsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgdGVybWluYWwgd2lsbCBsZXZlcmFnZSB0aGUgR1BVIHRvIGRvIGl0cyByZW5kZXJpbmcuXCIpXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuVGVybWluYWxUaXRsZVNlcGFyYXRvcl06IHtcblx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHQnZGVmYXVsdCc6ICcgLSAnLFxuXHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZShcInRlcm1pbmFsLmludGVncmF0ZWQudGFicy5zZXBhcmF0b3JcIiwgXCJTZXBhcmF0b3IgdXNlZCBieSB7MH0gYW5kIHsxfS5cIiwgYFxcYCMke1Rlcm1pbmFsU2V0dGluZ0lkLlRlcm1pbmFsVGl0bGV9I1xcYGAsIGBcXGAjJHtUZXJtaW5hbFNldHRpbmdJZC5UZXJtaW5hbERlc2NyaXB0aW9ufSNcXGBgKVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLlRlcm1pbmFsVGl0bGVdOiB7XG5cdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0J2RlZmF1bHQnOiAnJHtwcm9jZXNzfScsXG5cdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IHRlcm1pbmFsVGl0bGVcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5UZXJtaW5hbERlc2NyaXB0aW9uXToge1xuXHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdCdkZWZhdWx0JzogJyR7dGFza30ke3NlcGFyYXRvcn0ke2xvY2FsfSR7c2VwYXJhdG9yfSR7Y3dkRm9sZGVyfScsXG5cdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IHRlcm1pbmFsRGVzY3JpcHRpb25cblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5SaWdodENsaWNrQmVoYXZpb3JdOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnZGVmYXVsdCcsICdjb3B5UGFzdGUnLCAncGFzdGUnLCAnc2VsZWN0V29yZCcsICdub3RoaW5nJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnJpZ2h0Q2xpY2tCZWhhdmlvci5kZWZhdWx0JywgXCJTaG93IHRoZSBjb250ZXh0IG1lbnUuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5yaWdodENsaWNrQmVoYXZpb3IuY29weVBhc3RlJywgXCJDb3B5IHdoZW4gdGhlcmUgaXMgYSBzZWxlY3Rpb24sIG90aGVyd2lzZSBwYXN0ZS5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnJpZ2h0Q2xpY2tCZWhhdmlvci5wYXN0ZScsIFwiUGFzdGUgb24gcmlnaHQgY2xpY2suXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5yaWdodENsaWNrQmVoYXZpb3Iuc2VsZWN0V29yZCcsIFwiU2VsZWN0IHRoZSB3b3JkIHVuZGVyIHRoZSBjdXJzb3IgYW5kIHNob3cgdGhlIGNvbnRleHQgbWVudS5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnJpZ2h0Q2xpY2tCZWhhdmlvci5ub3RoaW5nJywgXCJEbyBub3RoaW5nIGFuZCBwYXNzIGV2ZW50IHRvIHRlcm1pbmFsLlwiKVxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6IGlzTWFjaW50b3NoID8gJ3NlbGVjdFdvcmQnIDogaXNXaW5kb3dzID8gJ2NvcHlQYXN0ZScgOiAnZGVmYXVsdCcsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQucmlnaHRDbGlja0JlaGF2aW9yJywgXCJDb250cm9scyBob3cgdGVybWluYWwgcmVhY3RzIHRvIHJpZ2h0IGNsaWNrLlwiKVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLk1pZGRsZUNsaWNrQmVoYXZpb3JdOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnZGVmYXVsdCcsICdwYXN0ZSddLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5taWRkbGVDbGlja0JlaGF2aW9yLmRlZmF1bHQnLCBcIlRoZSBwbGF0Zm9ybSBkZWZhdWx0IHRvIGZvY3VzIHRoZSB0ZXJtaW5hbC4gT24gTGludXggdGhpcyB3aWxsIGFsc28gcGFzdGUgdGhlIHNlbGVjdGlvbi5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLm1pZGRsZUNsaWNrQmVoYXZpb3IucGFzdGUnLCBcIlBhc3RlIG9uIG1pZGRsZSBjbGljay5cIiksXG5cdFx0XHRdLFxuXHRcdFx0ZGVmYXVsdDogJ2RlZmF1bHQnLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLm1pZGRsZUNsaWNrQmVoYXZpb3InLCBcIkNvbnRyb2xzIGhvdyB0ZXJtaW5hbCByZWFjdHMgdG8gbWlkZGxlIGNsaWNrLlwiKVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkN3ZF06IHtcblx0XHRcdHJlc3RyaWN0ZWQ6IHRydWUsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuY3dkJywgXCJBbiBleHBsaWNpdCBzdGFydCBwYXRoIHdoZXJlIHRoZSB0ZXJtaW5hbCB3aWxsIGJlIGxhdW5jaGVkLCB0aGlzIGlzIHVzZWQgYXMgdGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnkgKGN3ZCkgZm9yIHRoZSBzaGVsbCBwcm9jZXNzLiBUaGlzIG1heSBiZSBwYXJ0aWN1bGFybHkgdXNlZnVsIGluIHdvcmtzcGFjZSBzZXR0aW5ncyBpZiB0aGUgcm9vdCBkaXJlY3RvcnkgaXMgbm90IGEgY29udmVuaWVudCBjd2QuXCIpLFxuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRkZWZhdWx0OiB1bmRlZmluZWQsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLlJFU09VUkNFXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuQ29uZmlybU9uRXhpdF06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5jb25maXJtT25FeGl0JywgXCJDb250cm9scyB3aGV0aGVyIHRvIGNvbmZpcm0gd2hlbiB0aGUgd2luZG93IGNsb3NlcyBpZiB0aGVyZSBhcmUgYWN0aXZlIHRlcm1pbmFsIHNlc3Npb25zLiBCYWNrZ3JvdW5kIHRlcm1pbmFscyBsaWtlIHRob3NlIGxhdW5jaGVkIGJ5IHNvbWUgZXh0ZW5zaW9ucyB3aWxsIG5vdCB0cmlnZ2VyIHRoZSBjb25maXJtYXRpb24uXCIpLFxuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ25ldmVyJywgJ2Fsd2F5cycsICdoYXNDaGlsZFByb2Nlc3NlcyddLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5jb25maXJtT25FeGl0Lm5ldmVyJywgXCJOZXZlciBjb25maXJtLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuY29uZmlybU9uRXhpdC5hbHdheXMnLCBcIkFsd2F5cyBjb25maXJtIGlmIHRoZXJlIGFyZSB0ZXJtaW5hbHMuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5jb25maXJtT25FeGl0Lmhhc0NoaWxkUHJvY2Vzc2VzJywgXCJDb25maXJtIGlmIHRoZXJlIGFyZSBhbnkgdGVybWluYWxzIHRoYXQgaGF2ZSBjaGlsZCBwcm9jZXNzZXMuXCIpLFxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6ICduZXZlcidcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5Db25maXJtT25LaWxsXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmNvbmZpcm1PbktpbGwnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdG8gY29uZmlybSBraWxsaW5nIHRlcm1pbmFscyB3aGVuIHRoZXkgaGF2ZSBjaGlsZCBwcm9jZXNzZXMuIFdoZW4gc2V0IHRvIGVkaXRvciwgdGVybWluYWxzIGluIHRoZSBlZGl0b3IgYXJlYSB3aWxsIGJlIG1hcmtlZCBhcyBjaGFuZ2VkIHdoZW4gdGhleSBoYXZlIGNoaWxkIHByb2Nlc3Nlcy4gTm90ZSB0aGF0IGNoaWxkIHByb2Nlc3MgZGV0ZWN0aW9uIG1heSBub3Qgd29yayB3ZWxsIGZvciBzaGVsbHMgbGlrZSBHaXQgQmFzaCB3aGljaCBkb24ndCBydW4gdGhlaXIgcHJvY2Vzc2VzIGFzIGNoaWxkIHByb2Nlc3NlcyBvZiB0aGUgc2hlbGwuIEJhY2tncm91bmQgdGVybWluYWxzIGxpa2UgdGhvc2UgbGF1bmNoZWQgYnkgc29tZSBleHRlbnNpb25zIHdpbGwgbm90IHRyaWdnZXIgdGhlIGNvbmZpcm1hdGlvbi5cIiksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnbmV2ZXInLCAnZWRpdG9yJywgJ3BhbmVsJywgJ2Fsd2F5cyddLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5jb25maXJtT25LaWxsLm5ldmVyJywgXCJOZXZlciBjb25maXJtLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuY29uZmlybU9uS2lsbC5lZGl0b3InLCBcIkNvbmZpcm0gaWYgdGhlIHRlcm1pbmFsIGlzIGluIHRoZSBlZGl0b3IuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5jb25maXJtT25LaWxsLnBhbmVsJywgXCJDb25maXJtIGlmIHRoZSB0ZXJtaW5hbCBpcyBpbiB0aGUgcGFuZWwuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5jb25maXJtT25LaWxsLmFsd2F5cycsIFwiQ29uZmlybSBpZiB0aGUgdGVybWluYWwgaXMgZWl0aGVyIGluIHRoZSBlZGl0b3Igb3IgcGFuZWwuXCIpLFxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6ICdlZGl0b3InXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuRW5hYmxlQmVsbF06IHtcblx0XHRcdG1hcmtkb3duRGVwcmVjYXRpb25NZXNzYWdlOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5lbmFibGVCZWxsJywgXCJUaGlzIGlzIG5vdyBkZXByZWNhdGVkLiBJbnN0ZWFkIHVzZSB0aGUgYHRlcm1pbmFsLmludGVncmF0ZWQuZW5hYmxlVmlzdWFsQmVsbGAgYW5kIGBhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGVybWluYWxCZWxsYCBzZXR0aW5ncy5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkVuYWJsZVZpc3VhbEJlbGxdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZW5hYmxlVmlzdWFsQmVsbCcsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgdmlzdWFsIHRlcm1pbmFsIGJlbGwgaXMgZW5hYmxlZC4gVGhpcyBzaG93cyB1cCBuZXh0IHRvIHRoZSB0ZXJtaW5hbCdzIG5hbWUuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5Db21tYW5kc1RvU2tpcFNoZWxsXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoXG5cdFx0XHRcdCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmNvbW1hbmRzVG9Ta2lwU2hlbGwnLFxuXHRcdFx0XHRcIkEgc2V0IG9mIGNvbW1hbmQgSURzIHdob3NlIGtleWJpbmRpbmdzIHdpbGwgbm90IGJlIHNlbnQgdG8gdGhlIHNoZWxsIGJ1dCBpbnN0ZWFkIGFsd2F5cyBiZSBoYW5kbGVkIGJ5IFZTIENvZGUuIFRoaXMgYWxsb3dzIGtleWJpbmRpbmdzIHRoYXQgd291bGQgbm9ybWFsbHkgYmUgY29uc3VtZWQgYnkgdGhlIHNoZWxsIHRvIGFjdCBpbnN0ZWFkIHRoZSBzYW1lIGFzIHdoZW4gdGhlIHRlcm1pbmFsIGlzIG5vdCBmb2N1c2VkLCBmb3IgZXhhbXBsZSBgQ3RybCtQYCB0byBsYXVuY2ggUXVpY2sgT3Blbi5cXG5cXG4mbmJzcDtcXG5cXG5NYW55IGNvbW1hbmRzIGFyZSBza2lwcGVkIGJ5IGRlZmF1bHQuIFRvIG92ZXJyaWRlIGEgZGVmYXVsdCBhbmQgcGFzcyB0aGF0IGNvbW1hbmQncyBrZXliaW5kaW5nIHRvIHRoZSBzaGVsbCBpbnN0ZWFkLCBhZGQgdGhlIGNvbW1hbmQgcHJlZml4ZWQgd2l0aCB0aGUgYC1gIGNoYXJhY3Rlci4gRm9yIGV4YW1wbGUgYWRkIGAtd29ya2JlbmNoLmFjdGlvbi5xdWlja09wZW5gIHRvIGFsbG93IGBDdHJsK1BgIHRvIHJlYWNoIHRoZSBzaGVsbC5cXG5cXG4mbmJzcDtcXG5cXG5UaGUgZm9sbG93aW5nIGxpc3Qgb2YgZGVmYXVsdCBza2lwcGVkIGNvbW1hbmRzIGlzIHRydW5jYXRlZCB3aGVuIHZpZXdlZCBpbiBTZXR0aW5ncyBFZGl0b3IuIFRvIHNlZSB0aGUgZnVsbCBsaXN0LCB7MX0gYW5kIHNlYXJjaCBmb3IgdGhlIGZpcnN0IGNvbW1hbmQgZnJvbSB0aGUgbGlzdCBiZWxvdy5cXG5cXG4mbmJzcDtcXG5cXG5EZWZhdWx0IFNraXBwZWQgQ29tbWFuZHM6XFxuXFxuezB9XCIsXG5cdFx0XHRcdERFRkFVTFRfQ09NTUFORFNfVE9fU0tJUF9TSEVMTC5zb3J0KCkubWFwKGNvbW1hbmQgPT4gYC0gJHtjb21tYW5kfWApLmpvaW4oJ1xcbicpLFxuXHRcdFx0XHRgWyR7bG9jYWxpemUoJ29wZW5EZWZhdWx0U2V0dGluZ3NKc29uJywgXCJvcGVuIHRoZSBkZWZhdWx0IHNldHRpbmdzIEpTT05cIil9XShjb21tYW5kOndvcmtiZW5jaC5hY3Rpb24ub3BlblJhd0RlZmF1bHRTZXR0aW5ncyAnJHtsb2NhbGl6ZSgnb3BlbkRlZmF1bHRTZXR0aW5nc0pzb24uY2FwaXRhbGl6ZWQnLCBcIk9wZW4gRGVmYXVsdCBTZXR0aW5ncyAoSlNPTilcIil9JylgLFxuXG5cdFx0XHQpLFxuXHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHR9LFxuXHRcdFx0ZGVmYXVsdDogW11cblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5BbGxvd0Nob3Jkc106IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmFsbG93Q2hvcmRzJywgXCJXaGV0aGVyIG9yIG5vdCB0byBhbGxvdyBjaG9yZCBrZXliaW5kaW5ncyBpbiB0aGUgdGVybWluYWwuIE5vdGUgdGhhdCB3aGVuIHRoaXMgaXMgdHJ1ZSBhbmQgdGhlIGtleXN0cm9rZSByZXN1bHRzIGluIGEgY2hvcmQgaXQgd2lsbCBieXBhc3MgezB9LCBzZXR0aW5nIHRoaXMgdG8gZmFsc2UgaXMgcGFydGljdWxhcmx5IHVzZWZ1bCB3aGVuIHlvdSB3YW50IGN0cmwrayB0byBnbyB0byB5b3VyIHNoZWxsIChub3QgVlMgQ29kZSkuXCIsICdgI3Rlcm1pbmFsLmludGVncmF0ZWQuY29tbWFuZHNUb1NraXBTaGVsbCNgJyksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuQWxsb3dNbmVtb25pY3NdOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5hbGxvd01uZW1vbmljcycsIFwiV2hldGhlciB0byBhbGxvdyBtZW51YmFyIG1uZW1vbmljcyAoZm9yIGV4YW1wbGUgQWx0K0YpIHRvIHRyaWdnZXIgdGhlIG9wZW4gb2YgdGhlIG1lbnViYXIuIE5vdGUgdGhhdCB0aGlzIHdpbGwgY2F1c2UgYWxsIGFsdCBrZXlzdHJva2VzIHRvIHNraXAgdGhlIHNoZWxsIHdoZW4gdHJ1ZS4gVGhpcyBkb2VzIG5vdGhpbmcgb24gbWFjT1MuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5FbnZNYWNPc106IHtcblx0XHRcdHJlc3RyaWN0ZWQ6IHRydWUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5lbnYub3N4JywgXCJPYmplY3Qgd2l0aCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgdGhhdCB3aWxsIGJlIGFkZGVkIHRvIHRoZSBWUyBDb2RlIHByb2Nlc3MgdG8gYmUgdXNlZCBieSB0aGUgdGVybWluYWwgb24gbWFjT1MuIFNldCB0byBgbnVsbGAgdG8gZGVsZXRlIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZS5cIiksXG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdHR5cGU6IFsnc3RyaW5nJywgJ251bGwnXVxuXHRcdFx0fSxcblx0XHRcdGRlZmF1bHQ6IHt9XG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuRW52TGludXhdOiB7XG5cdFx0XHRyZXN0cmljdGVkOiB0cnVlLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZW52LmxpbnV4JywgXCJPYmplY3Qgd2l0aCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgdGhhdCB3aWxsIGJlIGFkZGVkIHRvIHRoZSBWUyBDb2RlIHByb2Nlc3MgdG8gYmUgdXNlZCBieSB0aGUgdGVybWluYWwgb24gTGludXguIFNldCB0byBgbnVsbGAgdG8gZGVsZXRlIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZS5cIiksXG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdHR5cGU6IFsnc3RyaW5nJywgJ251bGwnXVxuXHRcdFx0fSxcblx0XHRcdGRlZmF1bHQ6IHt9XG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuRW52V2luZG93c106IHtcblx0XHRcdHJlc3RyaWN0ZWQ6IHRydWUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5lbnYud2luZG93cycsIFwiT2JqZWN0IHdpdGggZW52aXJvbm1lbnQgdmFyaWFibGVzIHRoYXQgd2lsbCBiZSBhZGRlZCB0byB0aGUgVlMgQ29kZSBwcm9jZXNzIHRvIGJlIHVzZWQgYnkgdGhlIHRlcm1pbmFsIG9uIFdpbmRvd3MuIFNldCB0byBgbnVsbGAgdG8gZGVsZXRlIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZS5cIiksXG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdHR5cGU6IFsnc3RyaW5nJywgJ251bGwnXVxuXHRcdFx0fSxcblx0XHRcdGRlZmF1bHQ6IHt9XG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuRW52aXJvbm1lbnRDaGFuZ2VzSW5kaWNhdG9yXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZW52aXJvbm1lbnRDaGFuZ2VzSW5kaWNhdG9yJywgXCJXaGV0aGVyIHRvIGRpc3BsYXkgdGhlIGVudmlyb25tZW50IGNoYW5nZXMgaW5kaWNhdG9yIG9uIGVhY2ggdGVybWluYWwgd2hpY2ggZXhwbGFpbnMgd2hldGhlciBleHRlbnNpb25zIGhhdmUgbWFkZSwgb3Igd2FudCB0byBtYWtlIGNoYW5nZXMgdG8gdGhlIHRlcm1pbmFsJ3MgZW52aXJvbm1lbnQuXCIpLFxuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ29mZicsICdvbicsICd3YXJub25seSddLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5lbnZpcm9ubWVudENoYW5nZXNJbmRpY2F0b3Iub2ZmJywgXCJEaXNhYmxlIHRoZSBpbmRpY2F0b3IuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5lbnZpcm9ubWVudENoYW5nZXNJbmRpY2F0b3Iub24nLCBcIkVuYWJsZSB0aGUgaW5kaWNhdG9yLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZW52aXJvbm1lbnRDaGFuZ2VzSW5kaWNhdG9yLndhcm5vbmx5JywgXCJPbmx5IHNob3cgdGhlIHdhcm5pbmcgaW5kaWNhdG9yIHdoZW4gYSB0ZXJtaW5hbCdzIGVudmlyb25tZW50IGlzICdzdGFsZScsIG5vdCB0aGUgaW5mb3JtYXRpb24gaW5kaWNhdG9yIHRoYXQgc2hvd3MgYSB0ZXJtaW5hbCBoYXMgaGFkIGl0cyBlbnZpcm9ubWVudCBtb2RpZmllZCBieSBhbiBleHRlbnNpb24uXCIpLFxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6ICd3YXJub25seSdcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5FbnZpcm9ubWVudENoYW5nZXNSZWxhdW5jaF06IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmVudmlyb25tZW50Q2hhbmdlc1JlbGF1bmNoJywgXCJXaGV0aGVyIHRvIHJlbGF1bmNoIHRlcm1pbmFscyBhdXRvbWF0aWNhbGx5IGlmIGV4dGVuc2lvbnMgd2FudCB0byBjb250cmlidXRlIHRvIHRoZWlyIGVudmlyb25tZW50IGFuZCBoYXZlIG5vdCBiZWVuIGludGVyYWN0ZWQgd2l0aCB5ZXQuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLlNob3dFeGl0QWxlcnRdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuc2hvd0V4aXRBbGVydCcsIFwiQ29udHJvbHMgd2hldGhlciB0byBzaG93IHRoZSBhbGVydCBcXFwiVGhlIHRlcm1pbmFsIHByb2Nlc3MgdGVybWluYXRlZCB3aXRoIGV4aXQgY29kZVxcXCIgd2hlbiBleGl0IGNvZGUgaXMgbm9uLXplcm8uXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLldpbmRvd3NVc2VDb25wdHlEbGxdOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC53aW5kb3dzVXNlQ29ucHR5RGxsJywgXCJXaGV0aGVyIHRvIHVzZSB0aGUgZXhwZXJpbWVudGFsIGNvbnB0eS5kbGwgKHYxLjIyLjI1MDIwNDAwMikgc2hpcHBlZCB3aXRoIFZTIENvZGUsIGluc3RlYWQgb2YgdGhlIG9uZSBidW5kbGVkIHdpdGggV2luZG93cy5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHR0YWdzOiBbJ3ByZXZpZXcnXSxcblx0XHRcdGRlZmF1bHQ6IHByb2R1Y3QucXVhbGl0eSAhPT0gJ3N0YWJsZSdcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5TcGxpdEN3ZF06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5zcGxpdEN3ZCcsIFwiQ29udHJvbHMgdGhlIHdvcmtpbmcgZGlyZWN0b3J5IGEgc3BsaXQgdGVybWluYWwgc3RhcnRzIHdpdGguXCIpLFxuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ3dvcmtzcGFjZVJvb3QnLCAnaW5pdGlhbCcsICdpbmhlcml0ZWQnXSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuc3BsaXRDd2Qud29ya3NwYWNlUm9vdCcsIFwiQSBuZXcgc3BsaXQgdGVybWluYWwgd2lsbCB1c2UgdGhlIHdvcmtzcGFjZSByb290IGFzIHRoZSB3b3JraW5nIGRpcmVjdG9yeS4gSW4gYSBtdWx0aS1yb290IHdvcmtzcGFjZSBhIGNob2ljZSBmb3Igd2hpY2ggcm9vdCBmb2xkZXIgdG8gdXNlIGlzIG9mZmVyZWQuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5zcGxpdEN3ZC5pbml0aWFsJywgXCJBIG5ldyBzcGxpdCB0ZXJtaW5hbCB3aWxsIHVzZSB0aGUgd29ya2luZyBkaXJlY3RvcnkgdGhhdCB0aGUgcGFyZW50IHRlcm1pbmFsIHN0YXJ0ZWQgd2l0aC5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnNwbGl0Q3dkLmluaGVyaXRlZCcsIFwiT24gbWFjT1MgYW5kIExpbnV4LCBhIG5ldyBzcGxpdCB0ZXJtaW5hbCB3aWxsIHVzZSB0aGUgd29ya2luZyBkaXJlY3Rvcnkgb2YgdGhlIHBhcmVudCB0ZXJtaW5hbC4gT24gV2luZG93cywgdGhpcyBiZWhhdmVzIHRoZSBzYW1lIGFzIGluaXRpYWwuXCIpLFxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6ICdpbmhlcml0ZWQnXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuV2luZG93c0VuYWJsZUNvbnB0eV06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC53aW5kb3dzRW5hYmxlQ29ucHR5JywgXCJXaGV0aGVyIHRvIHVzZSBDb25QVFkgZm9yIFdpbmRvd3MgdGVybWluYWwgcHJvY2VzcyBjb21tdW5pY2F0aW9uIChyZXF1aXJlcyBXaW5kb3dzIDEwIGJ1aWxkIG51bWJlciAxODMwOSspLiBXaW5wdHkgd2lsbCBiZSB1c2VkIGlmIHRoaXMgaXMgZmFsc2UuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLldvcmRTZXBhcmF0b3JzXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQud29yZFNlcGFyYXRvcnMnLCBcIkEgc3RyaW5nIGNvbnRhaW5pbmcgYWxsIGNoYXJhY3RlcnMgdG8gYmUgY29uc2lkZXJlZCB3b3JkIHNlcGFyYXRvcnMgd2hlbiBkb3VibGUtY2xpY2tpbmcgdG8gc2VsZWN0IHdvcmQgYW5kIGluIHRoZSBmYWxsYmFjayAnd29yZCcgbGluayBkZXRlY3Rpb24uIFNpbmNlIHRoaXMgaXMgdXNlZCBmb3IgbGluayBkZXRlY3Rpb24sIGluY2x1ZGluZyBjaGFyYWN0ZXJzIHN1Y2ggYXMgYDpgIHRoYXQgYXJlIHVzZWQgd2hlbiBkZXRlY3RpbmcgbGlua3Mgd2lsbCBjYXVzZSB0aGUgbGluZSBhbmQgY29sdW1uIHBhcnQgb2YgbGlua3MgbGlrZSBgZmlsZToxMDo1YCB0byBiZSBpZ25vcmVkLlwiKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0Ly8gYWxsb3ctYW55LXVuaWNvZGUtbmV4dC1saW5lXG5cdFx0XHRkZWZhdWx0OiAnICgpW117fVxcJyxcImBcdTI1MDBcdTIwMThcdTIwMTlcdTIwMUNcdTIwMUR8J1xuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkVuYWJsZUZpbGVMaW5rc106IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5lbmFibGVGaWxlTGlua3MnLCBcIldoZXRoZXIgdG8gZW5hYmxlIGZpbGUgbGlua3MgaW4gdGVybWluYWxzLiBMaW5rcyBjYW4gYmUgc2xvdyB3aGVuIHdvcmtpbmcgb24gYSBuZXR3b3JrIGRyaXZlIGluIHBhcnRpY3VsYXIgYmVjYXVzZSBlYWNoIGZpbGUgbGluayBpcyB2ZXJpZmllZCBhZ2FpbnN0IHRoZSBmaWxlIHN5c3RlbS4gQ2hhbmdpbmcgdGhpcyB3aWxsIHRha2UgZWZmZWN0IG9ubHkgaW4gbmV3IHRlcm1pbmFscy5cIiksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnb2ZmJywgJ29uJywgJ25vdFJlbW90ZSddLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgnZW5hYmxlRmlsZUxpbmtzLm9mZicsIFwiQWx3YXlzIG9mZi5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCdlbmFibGVGaWxlTGlua3Mub24nLCBcIkFsd2F5cyBvbi5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCdlbmFibGVGaWxlTGlua3Mubm90UmVtb3RlJywgXCJFbmFibGUgb25seSB3aGVuIG5vdCBpbiBhIHJlbW90ZSB3b3Jrc3BhY2UuXCIpXG5cdFx0XHRdLFxuXHRcdFx0ZGVmYXVsdDogJ29uJ1xuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkFsbG93ZWRMaW5rU2NoZW1lc106IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5hbGxvd2VkTGlua1NjaGVtZXMnLCBcIkFuIGFycmF5IG9mIHN0cmluZ3MgY29udGFpbmluZyB0aGUgVVJJIHNjaGVtZXMgdGhhdCB0aGUgdGVybWluYWwgaXMgYWxsb3dlZCB0byBvcGVuIGxpbmtzIGZvci4gQnkgZGVmYXVsdCwgb25seSBhIHNtYWxsIHN1YnNldCBvZiBwb3NzaWJsZSBzY2hlbWVzIGFyZSBhbGxvd2VkIGZvciBzZWN1cml0eSByZWFzb25zLlwiKSxcblx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRpdGVtczoge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0fSxcblx0XHRcdGRlZmF1bHQ6IFtcblx0XHRcdFx0J2ZpbGUnLFxuXHRcdFx0XHQnaHR0cCcsXG5cdFx0XHRcdCdodHRwcycsXG5cdFx0XHRcdCdtYWlsdG8nLFxuXHRcdFx0XHQndnNjb2RlJyxcblx0XHRcdFx0J3ZzY29kZS1pbnNpZGVycycsXG5cdFx0XHRdXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuVW5pY29kZVZlcnNpb25dOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnNicsICcxMSddLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC51bmljb2RlVmVyc2lvbi5zaXgnLCBcIlZlcnNpb24gNiBvZiBVbmljb2RlLiBUaGlzIGlzIGFuIG9sZGVyIHZlcnNpb24gd2hpY2ggc2hvdWxkIHdvcmsgYmV0dGVyIG9uIG9sZGVyIHN5c3RlbXMuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC51bmljb2RlVmVyc2lvbi5lbGV2ZW4nLCBcIlZlcnNpb24gMTEgb2YgVW5pY29kZS4gVGhpcyB2ZXJzaW9uIHByb3ZpZGVzIGJldHRlciBzdXBwb3J0IG9uIG1vZGVybiBzeXN0ZW1zIHRoYXQgdXNlIG1vZGVybiB2ZXJzaW9ucyBvZiBVbmljb2RlLlwiKVxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6ICcxMScsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQudW5pY29kZVZlcnNpb24nLCBcIkNvbnRyb2xzIHdoYXQgdmVyc2lvbiBvZiBVbmljb2RlIHRvIHVzZSB3aGVuIGV2YWx1YXRpbmcgdGhlIHdpZHRoIG9mIGNoYXJhY3RlcnMgaW4gdGhlIHRlcm1pbmFsLiBJZiB5b3UgZXhwZXJpZW5jZSBlbW9qaSBvciBvdGhlciB3aWRlIGNoYXJhY3RlcnMgbm90IHRha2luZyB1cCB0aGUgcmlnaHQgYW1vdW50IG9mIHNwYWNlIG9yIGJhY2tzcGFjZSBlaXRoZXIgZGVsZXRpbmcgdG9vIG11Y2ggb3IgdG9vIGxpdHRsZSB0aGVuIHlvdSBtYXkgd2FudCB0byB0cnkgdHdlYWtpbmcgdGhpcyBzZXR0aW5nLlwiKVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkVuYWJsZVBlcnNpc3RlbnRTZXNzaW9uc106IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5lbmFibGVQZXJzaXN0ZW50U2Vzc2lvbnMnLCBcIlBlcnNpc3QgdGVybWluYWwgc2Vzc2lvbnMvaGlzdG9yeSBmb3IgdGhlIHdvcmtzcGFjZSBhY3Jvc3Mgd2luZG93IHJlbG9hZHMuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLlBlcnNpc3RlbnRTZXNzaW9uUmV2aXZlUHJvY2Vzc106IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnBlcnNpc3RlbnRTZXNzaW9uUmV2aXZlUHJvY2VzcycsIFwiV2hlbiB0aGUgdGVybWluYWwgcHJvY2VzcyBtdXN0IGJlIHNodXQgZG93biAoZm9yIGV4YW1wbGUgb24gd2luZG93IG9yIGFwcGxpY2F0aW9uIGNsb3NlKSwgdGhpcyBkZXRlcm1pbmVzIHdoZW4gdGhlIHByZXZpb3VzIHRlcm1pbmFsIHNlc3Npb24gY29udGVudHMvaGlzdG9yeSBzaG91bGQgYmUgcmVzdG9yZWQgYW5kIHByb2Nlc3NlcyBiZSByZWNyZWF0ZWQgd2hlbiB0aGUgd29ya3NwYWNlIGlzIG5leHQgb3BlbmVkLlxcblxcbkNhdmVhdHM6XFxuXFxuLSBSZXN0b3Jpbmcgb2YgdGhlIHByb2Nlc3MgY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeSBkZXBlbmRzIG9uIHdoZXRoZXIgaXQgaXMgc3VwcG9ydGVkIGJ5IHRoZSBzaGVsbC5cXG4tIFRpbWUgdG8gcGVyc2lzdCB0aGUgc2Vzc2lvbiBkdXJpbmcgc2h1dGRvd24gaXMgbGltaXRlZCwgc28gaXQgbWF5IGJlIGFib3J0ZWQgd2hlbiB1c2luZyBoaWdoLWxhdGVuY3kgcmVtb3RlIGNvbm5lY3Rpb25zLlwiKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydvbkV4aXQnLCAnb25FeGl0QW5kV2luZG93Q2xvc2UnLCAnbmV2ZXInXSxcblx0XHRcdG1hcmtkb3duRW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5wZXJzaXN0ZW50U2Vzc2lvblJldml2ZVByb2Nlc3Mub25FeGl0JywgXCJSZXZpdmUgdGhlIHByb2Nlc3NlcyBhZnRlciB0aGUgbGFzdCB3aW5kb3cgaXMgY2xvc2VkIG9uIFdpbmRvd3MvTGludXggb3Igd2hlbiB0aGUgYHdvcmtiZW5jaC5hY3Rpb24ucXVpdGAgY29tbWFuZCBpcyB0cmlnZ2VyZWQgKGNvbW1hbmQgcGFsZXR0ZSwga2V5YmluZGluZywgbWVudSkuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5wZXJzaXN0ZW50U2Vzc2lvblJldml2ZVByb2Nlc3Mub25FeGl0QW5kV2luZG93Q2xvc2UnLCBcIlJldml2ZSB0aGUgcHJvY2Vzc2VzIGFmdGVyIHRoZSBsYXN0IHdpbmRvdyBpcyBjbG9zZWQgb24gV2luZG93cy9MaW51eCBvciB3aGVuIHRoZSBgd29ya2JlbmNoLmFjdGlvbi5xdWl0YCBjb21tYW5kIGlzIHRyaWdnZXJlZCAoY29tbWFuZCBwYWxldHRlLCBrZXliaW5kaW5nLCBtZW51KSwgb3Igd2hlbiB0aGUgd2luZG93IGlzIGNsb3NlZC5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnBlcnNpc3RlbnRTZXNzaW9uUmV2aXZlUHJvY2Vzcy5uZXZlcicsIFwiTmV2ZXIgcmVzdG9yZSB0aGUgdGVybWluYWwgYnVmZmVycyBvciByZWNyZWF0ZSB0aGUgcHJvY2Vzcy5cIilcblx0XHRcdF0sXG5cdFx0XHRkZWZhdWx0OiAnb25FeGl0J1xuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkhpZGVPblN0YXJ0dXBdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuaGlkZU9uU3RhcnR1cCcsIFwiV2hldGhlciB0byBoaWRlIHRoZSB0ZXJtaW5hbCB2aWV3IG9uIHN0YXJ0dXAsIGF2b2lkaW5nIGNyZWF0aW5nIGEgdGVybWluYWwgd2hlbiB0aGVyZSBhcmUgbm8gcGVyc2lzdGVudCBzZXNzaW9ucy5cIiksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnbmV2ZXInLCAnd2hlbkVtcHR5JywgJ2Fsd2F5cyddLFxuXHRcdFx0bWFya2Rvd25FbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCdoaWRlT25TdGFydHVwLm5ldmVyJywgXCJOZXZlciBoaWRlIHRoZSB0ZXJtaW5hbCB2aWV3IG9uIHN0YXJ0dXAuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgnaGlkZU9uU3RhcnR1cC53aGVuRW1wdHknLCBcIk9ubHkgaGlkZSB0aGUgdGVybWluYWwgd2hlbiB0aGVyZSBhcmUgbm8gcGVyc2lzdGVudCBzZXNzaW9ucyByZXN0b3JlZC5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCdoaWRlT25TdGFydHVwLmFsd2F5cycsIFwiQWx3YXlzIGhpZGUgdGhlIHRlcm1pbmFsLCBldmVuIHdoZW4gdGhlcmUgYXJlIHBlcnNpc3RlbnQgc2Vzc2lvbnMgcmVzdG9yZWQuXCIpXG5cdFx0XHRdLFxuXHRcdFx0ZGVmYXVsdDogJ25ldmVyJ1xuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkhpZGVPbkxhc3RDbG9zZWRdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuaGlkZU9uTGFzdENsb3NlZCcsIFwiV2hldGhlciB0byBoaWRlIHRoZSB0ZXJtaW5hbCB2aWV3IHdoZW4gdGhlIGxhc3QgdGVybWluYWwgaXMgY2xvc2VkLiBUaGlzIHdpbGwgb25seSBoYXBwZW4gd2hlbiB0aGUgdGVybWluYWwgaXMgdGhlIG9ubHkgdmlzaWJsZSB2aWV3IGluIHRoZSB2aWV3IGNvbnRhaW5lci5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuQ3VzdG9tR2x5cGhzXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuY3VzdG9tR2x5cGhzJywgXCJXaGV0aGVyIHRvIGRyYXcgY3VzdG9tIGdseXBocyBmb3IgYmxvY2sgZWxlbWVudCBhbmQgYm94IGRyYXdpbmcgY2hhcmFjdGVycyBpbnN0ZWFkIG9mIHVzaW5nIHRoZSBmb250LCB3aGljaCB0eXBpY2FsbHkgeWllbGRzIGJldHRlciByZW5kZXJpbmcgd2l0aCBjb250aW51b3VzIGxpbmVzLiBOb3RlIHRoYXQgdGhpcyBkb2Vzbid0IHdvcmsgd2hlbiB7MH0gaXMgZGlzYWJsZWQuXCIsIGBcXGAjJHtUZXJtaW5hbFNldHRpbmdJZC5HcHVBY2NlbGVyYXRpb259I1xcYGApLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLlJlc2NhbGVPdmVybGFwcGluZ0dseXBoc106IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnJlc2NhbGVPdmVybGFwcGluZ0dseXBocycsIFwiV2hldGhlciB0byByZXNjYWxlIGdseXBocyBob3Jpem9udGFsbHkgdGhhdCBhcmUgYSBzaW5nbGUgY2VsbCB3aWRlIGJ1dCBoYXZlIGdseXBocyB0aGF0IHdvdWxkIG92ZXJsYXAgZm9sbG93aW5nIGNlbGwocykuIFRoaXMgdHlwaWNhbGx5IGhhcHBlbnMgZm9yIGFtYmlndW91cyB3aWR0aCBjaGFyYWN0ZXJzIChlZy4gdGhlIHJvbWFuIG51bWVyYWwgY2hhcmFjdGVycyBVKzIxNjArKSB3aGljaCBhcmVuJ3QgZmVhdHVyZWQgaW4gbW9ub3NwYWNlIGZvbnRzLiBFbW9qaSBnbHlwaHMgYXJlIG5ldmVyIHJlc2NhbGVkLlwiKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5TaGVsbEludGVncmF0aW9uRW5hYmxlZF06IHtcblx0XHRcdHJlc3RyaWN0ZWQ6IHRydWUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5zaGVsbEludGVncmF0aW9uLmVuYWJsZWQnLCBcIkRldGVybWluZXMgd2hldGhlciBvciBub3Qgc2hlbGwgaW50ZWdyYXRpb24gaXMgYXV0by1pbmplY3RlZCB0byBzdXBwb3J0IGZlYXR1cmVzIGxpa2UgZW5oYW5jZWQgY29tbWFuZCB0cmFja2luZyBhbmQgY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeSBkZXRlY3Rpb24uIFxcblxcblNoZWxsIGludGVncmF0aW9uIHdvcmtzIGJ5IGluamVjdGluZyB0aGUgc2hlbGwgd2l0aCBhIHN0YXJ0dXAgc2NyaXB0LiBUaGUgc2NyaXB0IGdpdmVzIFZTIENvZGUgaW5zaWdodCBpbnRvIHdoYXQgaXMgaGFwcGVuaW5nIHdpdGhpbiB0aGUgdGVybWluYWwuXFxuXFxuU3VwcG9ydGVkIHNoZWxsczpcXG5cXG4tIExpbnV4L21hY09TOiBiYXNoLCBmaXNoLCBwd3NoLCB6c2hcXG4gLSBXaW5kb3dzOiBwd3NoLCBnaXQgYmFzaFxcblxcblRoaXMgc2V0dGluZyBhcHBsaWVzIG9ubHkgd2hlbiB0ZXJtaW5hbHMgYXJlIGNyZWF0ZWQsIHNvIHlvdSB3aWxsIG5lZWQgdG8gcmVzdGFydCB5b3VyIHRlcm1pbmFscyBmb3IgaXQgdG8gdGFrZSBlZmZlY3QuXFxuXFxuIE5vdGUgdGhhdCB0aGUgc2NyaXB0IGluamVjdGlvbiBtYXkgbm90IHdvcmsgaWYgeW91IGhhdmUgY3VzdG9tIGFyZ3VtZW50cyBkZWZpbmVkIGluIHRoZSB0ZXJtaW5hbCBwcm9maWxlLCBoYXZlIGVuYWJsZWQgezF9LCBoYXZlIGEgW2NvbXBsZXggYmFzaCBgUFJPTVBUX0NPTU1BTkRgXShodHRwczovL2NvZGUudmlzdWFsc3R1ZGlvLmNvbS9kb2NzL2VkaXRvci9pbnRlZ3JhdGVkLXRlcm1pbmFsI19jb21wbGV4LWJhc2gtcHJvbXB0Y29tbWFuZCksIG9yIG90aGVyIHVuc3VwcG9ydGVkIHNldHVwLiBUbyBkaXNhYmxlIGRlY29yYXRpb25zLCBzZWUgezB9XCIsICdgI3Rlcm1pbmFsLmludGVncmF0ZWQuc2hlbGxJbnRlZ3JhdGlvbi5kZWNvcmF0aW9uc0VuYWJsZWQjYCcsICdgI2VkaXRvci5hY2Nlc3NpYmlsaXR5U3VwcG9ydCNgJyksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuU2hlbGxJbnRlZ3JhdGlvbkRlY29yYXRpb25zRW5hYmxlZF06IHtcblx0XHRcdHJlc3RyaWN0ZWQ6IHRydWUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5zaGVsbEludGVncmF0aW9uLmRlY29yYXRpb25zRW5hYmxlZCcsIFwiV2hlbiBzaGVsbCBpbnRlZ3JhdGlvbiBpcyBlbmFibGVkLCBhZGRzIGEgZGVjb3JhdGlvbiBmb3IgZWFjaCBjb21tYW5kLlwiKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydib3RoJywgJ2d1dHRlcicsICdvdmVydmlld1J1bGVyJywgJ25ldmVyJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnNoZWxsSW50ZWdyYXRpb24uZGVjb3JhdGlvbnNFbmFibGVkLmJvdGgnLCBcIlNob3cgZGVjb3JhdGlvbnMgaW4gdGhlIGd1dHRlciAobGVmdCkgYW5kIG92ZXJ2aWV3IHJ1bGVyIChyaWdodClcIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnNoZWxsSW50ZWdyYXRpb24uZGVjb3JhdGlvbnNFbmFibGVkLmd1dHRlcicsIFwiU2hvdyBndXR0ZXIgZGVjb3JhdGlvbnMgdG8gdGhlIGxlZnQgb2YgdGhlIHRlcm1pbmFsXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5zaGVsbEludGVncmF0aW9uLmRlY29yYXRpb25zRW5hYmxlZC5vdmVydmlld1J1bGVyJywgXCJTaG93IG92ZXJ2aWV3IHJ1bGVyIGRlY29yYXRpb25zIHRvIHRoZSByaWdodCBvZiB0aGUgdGVybWluYWxcIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnNoZWxsSW50ZWdyYXRpb24uZGVjb3JhdGlvbnNFbmFibGVkLm5ldmVyJywgXCJEbyBub3Qgc2hvdyBkZWNvcmF0aW9uc1wiKSxcblx0XHRcdF0sXG5cdFx0XHRkZWZhdWx0OiAnYm90aCdcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5TaGVsbEludGVncmF0aW9uRW52aXJvbm1lbnRSZXBvcnRpbmddOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5zaGVsbEludGVncmF0aW9uLmVudmlyb25tZW50UmVwb3J0aW5nJywgXCJDb250cm9scyB3aGV0aGVyIHRvIHJlcG9ydCB0aGUgc2hlbGwgZW52aXJvbm1lbnQsIGVuYWJsaW5nIGl0cyB1c2UgaW4gZmVhdHVyZXMgc3VjaCBhcyB7MH0uIFRoaXMgbWF5IGNhdXNlIGEgc2xvd2Rvd24gd2hlbiBwcmludGluZyB5b3VyIHNoZWxsJ3MgcHJvbXB0LlwiLCBgXFxgIyR7VGVybWluYWxDb250cmliU2V0dGluZ0lkLlN1Z2dlc3RFbmFibGVkfSNcXGBgKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHByb2R1Y3QucXVhbGl0eSAhPT0gJ3N0YWJsZSdcblx0XHR9LFxuXHRcdFtUZXJtaW5hbFNldHRpbmdJZC5TbW9vdGhTY3JvbGxpbmddOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5zbW9vdGhTY3JvbGxpbmcnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIHRlcm1pbmFsIHdpbGwgc2Nyb2xsIHVzaW5nIGFuIGFuaW1hdGlvbi5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLklnbm9yZUJyYWNrZXRlZFBhc3RlTW9kZV06IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmlnbm9yZUJyYWNrZXRlZFBhc3RlTW9kZScsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgdGVybWluYWwgd2lsbCBpZ25vcmUgYnJhY2tldGVkIHBhc3RlIG1vZGUgZXZlbiBpZiB0aGUgdGVybWluYWwgd2FzIHB1dCBpbnRvIHRoZSBtb2RlLCBvbWl0dGluZyB0aGUgezB9IGFuZCB7MX0gc2VxdWVuY2VzIHdoZW4gcGFzdGluZy4gVGhpcyBpcyB1c2VmdWwgd2hlbiB0aGUgc2hlbGwgaXMgbm90IHJlc3BlY3RpbmcgdGhlIG1vZGUgd2hpY2ggY2FuIGhhcHBlbiBpbiBzdWItc2hlbGxzIGZvciBleGFtcGxlLlwiLCAnYFxcXFx4MWJbMjAwfmAnLCAnYFxcXFx4MWJbMjAxfmAnKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlXG5cdFx0fSxcblx0XHRbVGVybWluYWxTZXR0aW5nSWQuRW5hYmxlSW1hZ2VzXToge1xuXHRcdFx0cmVzdHJpY3RlZDogdHJ1ZSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmVuYWJsZUltYWdlcycsIFwiRW5hYmxlcyBpbWFnZSBzdXBwb3J0IGluIHRoZSB0ZXJtaW5hbCwgdGhpcyB3aWxsIG9ubHkgd29yayB3aGVuIHswfSBpcyBlbmFibGVkLiBCb3RoIHNpeGVsIGFuZCBpVGVybSdzIGlubGluZSBpbWFnZSBwcm90b2NvbCBhcmUgc3VwcG9ydGVkIG9uIExpbnV4IGFuZCBtYWNPUy4gVGhpcyB3aWxsIG9ubHkgd29yayBvbiBXaW5kb3dzIGZvciB2ZXJzaW9ucyBvZiBDb25QVFkgPj0gdjIgd2hpY2ggaXMgc2hpcHBlZCB3aXRoIFdpbmRvd3MgaXRzZWxmLCBzZWUgYWxzbyB7MX0uIEltYWdlcyB3aWxsIGN1cnJlbnRseSBub3QgYmUgcmVzdG9yZWQgYmV0d2VlbiB3aW5kb3cgcmVsb2Fkcy9yZWNvbm5lY3RzLlwiLCBgXFxgIyR7VGVybWluYWxTZXR0aW5nSWQuR3B1QWNjZWxlcmF0aW9ufSNcXGBgLCBgXFxgIyR7VGVybWluYWxTZXR0aW5nSWQuV2luZG93c1VzZUNvbnB0eURsbH0jXFxgYCksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdH0sXG5cdFx0W1Rlcm1pbmFsU2V0dGluZ0lkLkZvY3VzQWZ0ZXJSdW5dOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5mb2N1c0FmdGVyUnVuJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSB0ZXJtaW5hbCwgYWNjZXNzaWJsZSBidWZmZXIsIG9yIG5laXRoZXIgd2lsbCBiZSBmb2N1c2VkIGFmdGVyIGBUZXJtaW5hbDogUnVuIFNlbGVjdGVkIFRleHQgSW4gQWN0aXZlIFRlcm1pbmFsYCBoYXMgYmVlbiBydW4uXCIpLFxuXHRcdFx0ZW51bTogWyd0ZXJtaW5hbCcsICdhY2Nlc3NpYmxlLWJ1ZmZlcicsICdub25lJ10sXG5cdFx0XHRkZWZhdWx0OiAnbm9uZScsXG5cdFx0XHR0YWdzOiBbJ2FjY2Vzc2liaWxpdHknXSxcblx0XHRcdG1hcmtkb3duRW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5mb2N1c0FmdGVyUnVuLnRlcm1pbmFsJywgXCJBbHdheXMgZm9jdXMgdGhlIHRlcm1pbmFsLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuZm9jdXNBZnRlclJ1bi5hY2Nlc3NpYmxlLWJ1ZmZlcicsIFwiQWx3YXlzIGZvY3VzIHRoZSBhY2Nlc3NpYmxlIGJ1ZmZlci5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmZvY3VzQWZ0ZXJSdW4ubm9uZScsIFwiRG8gbm90aGluZy5cIiksXG5cdFx0XHRdXG5cdFx0fSxcblx0XHQuLi50ZXJtaW5hbENvbnRyaWJDb25maWd1cmF0aW9uLFxuXHR9XG59O1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVnaXN0ZXJUZXJtaW5hbENvbmZpZ3VyYXRpb24oZ2V0Rm9udFNuaXBwZXRzOiAoKSA9PiBQcm9taXNlPElKU09OU2NoZW1hU25pcHBldFtdPikge1xuXHRjb25zdCBjb25maWd1cmF0aW9uUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pO1xuXHRjb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKHRlcm1pbmFsQ29uZmlndXJhdGlvbik7XG5cdGNvbnN0IGZvbnRzU25pcHBldHMgPSBhd2FpdCBnZXRGb250U25pcHBldHMoKTtcblx0aWYgKHRlcm1pbmFsQ29uZmlndXJhdGlvbi5wcm9wZXJ0aWVzKSB7XG5cdFx0dGVybWluYWxDb25maWd1cmF0aW9uLnByb3BlcnRpZXNbVGVybWluYWxTZXR0aW5nSWQuRm9udEZhbWlseV0uZGVmYXVsdFNuaXBwZXRzID0gZm9udHNTbmlwcGV0cztcblx0fVxufVxuXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvbk1pZ3JhdGlvblJlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb25NaWdyYXRpb24pXG5cdC5yZWdpc3RlckNvbmZpZ3VyYXRpb25NaWdyYXRpb25zKFt7XG5cdFx0a2V5OiBUZXJtaW5hbFNldHRpbmdJZC5FbmFibGVCZWxsLFxuXHRcdG1pZ3JhdGVGbjogKGVuYWJsZUJlbGwsIGFjY2Vzc29yKSA9PiB7XG5cdFx0XHRjb25zdCBjb25maWd1cmF0aW9uS2V5VmFsdWVQYWlyczogQ29uZmlndXJhdGlvbktleVZhbHVlUGFpcnMgPSBbXTtcblx0XHRcdGxldCBhbm5vdW5jZW1lbnQgPSBhY2Nlc3NvcignYWNjZXNzaWJpbGl0eS5zaWduYWxzLnRlcm1pbmFsQmVsbCcpPy5hbm5vdW5jZW1lbnQgPz8gYWNjZXNzb3IoJ2FjY2Vzc2liaWxpdHkuYWxlcnQudGVybWluYWxCZWxsJyk7XG5cdFx0XHRpZiAoYW5ub3VuY2VtZW50ICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGFubm91bmNlbWVudCAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0YW5ub3VuY2VtZW50ID0gYW5ub3VuY2VtZW50ID8gJ2F1dG8nIDogJ29mZic7XG5cdFx0XHR9XG5cdFx0XHRjb25maWd1cmF0aW9uS2V5VmFsdWVQYWlycy5wdXNoKFsnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnRlcm1pbmFsQmVsbCcsIHsgdmFsdWU6IHsgc291bmQ6IGVuYWJsZUJlbGwgPyAnb24nIDogJ29mZicsIGFubm91bmNlbWVudCB9IH1dKTtcblx0XHRcdGNvbmZpZ3VyYXRpb25LZXlWYWx1ZVBhaXJzLnB1c2goW1Rlcm1pbmFsU2V0dGluZ0lkLkVuYWJsZUJlbGwsIHsgdmFsdWU6IHVuZGVmaW5lZCB9XSk7XG5cdFx0XHRjb25maWd1cmF0aW9uS2V5VmFsdWVQYWlycy5wdXNoKFtUZXJtaW5hbFNldHRpbmdJZC5FbmFibGVWaXN1YWxCZWxsLCB7IHZhbHVlOiBlbmFibGVCZWxsIH1dKTtcblx0XHRcdHJldHVybiBjb25maWd1cmF0aW9uS2V5VmFsdWVQYWlycztcblx0XHR9XG5cdH1dKTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZUFBZTtBQUV4QixTQUFTLGFBQWEsaUJBQWlCO0FBQ3ZDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsb0JBQW9CLGtCQUE4RDtBQUMzRixPQUFPLGFBQWE7QUFDcEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx3QkFBd0IseUJBQXlCO0FBQzFELFNBQVMscUJBQXFCLDBCQUEwQjtBQUN4RCxTQUFzRSxjQUFjLDJCQUEyQjtBQUMvRyxTQUFTLDhCQUE4QixnQ0FBZ0M7QUFDdkUsU0FBUyxnQ0FBZ0Msd0JBQXdCLHFCQUFxQixxQkFB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TyxNQUFNLGtCQUFrQixtQkFBbUIsS0FBSztBQUFBLE1BQzNmLE1BQU07QUFBQSxNQUNOLFNBQVM7QUFBQSxJQUNWO0FBQUEsSUFDQSxDQUFDLGtCQUFrQixhQUFhLEdBQUc7QUFBQSxNQUNsQyxxQkFBcUIsU0FBUyxxQ0FBcUMsbUpBQW1KO0FBQUEsTUFDdE4sTUFBTSxDQUFDLFlBQVkscUJBQXFCLE1BQU07QUFBQSxNQUM5QyxTQUFTO0FBQUEsTUFDVCxNQUFNLENBQUMsZUFBZTtBQUFBLE1BQ3RCLDBCQUEwQjtBQUFBLFFBQ3pCLFNBQVMsOENBQThDLDRCQUE0QjtBQUFBLFFBQ25GLFNBQVMsdURBQXVELHFDQUFxQztBQUFBLFFBQ3JHLFNBQVMsMENBQTBDLGFBQWE7QUFBQSxNQUNqRTtBQUFBLElBQ0Q7QUFBQSxJQUNBLEdBQUc7QUFBQSxFQUNKO0FBQ0Q7QUFFQSxlQUFzQiw4QkFBOEIsaUJBQXNEO0FBQ3pHLFFBQU0sd0JBQXdCLFNBQVMsR0FBMkIsV0FBVyxhQUFhO0FBQzFGLHdCQUFzQixzQkFBc0IscUJBQXFCO0FBQ2pFLFFBQU0sZ0JBQWdCLE1BQU0sZ0JBQWdCO0FBQzVDLE1BQUksc0JBQXNCLFlBQVk7QUFDckMsMEJBQXNCLFdBQVcsa0JBQWtCLFVBQVUsRUFBRSxrQkFBa0I7QUFBQSxFQUNsRjtBQUNEO0FBRUEsU0FBUyxHQUFvQyxvQkFBb0Isc0JBQXNCLEVBQ3JGLGdDQUFnQyxDQUFDO0FBQUEsRUFDakMsS0FBSyxrQkFBa0I7QUFBQSxFQUN2QixXQUFXLENBQUMsWUFBWSxhQUFhO0FBQ3BDLFVBQU0sNkJBQXlELENBQUM7QUFDaEUsUUFBSSxlQUFlLFNBQVMsb0NBQW9DLEdBQUcsZ0JBQWdCLFNBQVMsa0NBQWtDO0FBQzlILFFBQUksaUJBQWlCLFVBQWEsT0FBTyxpQkFBaUIsVUFBVTtBQUNuRSxxQkFBZSxlQUFlLFNBQVM7QUFBQSxJQUN4QztBQUNBLCtCQUEyQixLQUFLLENBQUMsc0NBQXNDLEVBQUUsT0FBTyxFQUFFLE9BQU8sYUFBYSxPQUFPLE9BQU8sYUFBYSxFQUFFLENBQUMsQ0FBQztBQUNySSwrQkFBMkIsS0FBSyxDQUFDLGtCQUFrQixZQUFZLEVBQUUsT0FBTyxPQUFVLENBQUMsQ0FBQztBQUNwRiwrQkFBMkIsS0FBSyxDQUFDLGtCQUFrQixrQkFBa0IsRUFBRSxPQUFPLFdBQVcsQ0FBQyxDQUFDO0FBQzNGLFdBQU87QUFBQSxFQUNSO0FBQ0QsQ0FBQyxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
