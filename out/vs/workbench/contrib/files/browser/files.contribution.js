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
import * as nls from "../../../../nls.js";
import { sep } from "../../../../base/common/path.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../platform/configuration/common/configurationRegistry.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { EditorExtensions } from "../../../common/editor.js";
import { AutoSaveConfiguration, HotExitConfiguration, FILES_EXCLUDE_CONFIG, FILES_ASSOCIATIONS_CONFIG, FILES_READONLY_INCLUDE_CONFIG, FILES_READONLY_EXCLUDE_CONFIG, FILES_READONLY_FROM_PERMISSIONS_CONFIG } from "../../../../platform/files/common/files.js";
import { SortOrder, LexicographicOptions, FILE_EDITOR_INPUT_ID, BINARY_TEXT_FILE_MODE, UndoConfirmLevel } from "../common/files.js";
import { TextFileEditorTracker } from "./editors/textFileEditorTracker.js";
import { TextFileSaveErrorHandler } from "./editors/textFileSaveErrorHandler.js";
import { FileEditorInput } from "./editors/fileEditorInput.js";
import { BinaryFileEditor } from "./editors/binaryFileEditor.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { isNative, isWeb, isWindows } from "../../../../base/common/platform.js";
import { ExplorerViewletViewsContribution } from "./explorerViewlet.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ExplorerService, UNDO_REDO_SOURCE } from "./explorerService.js";
import { GUESSABLE_ENCODINGS, SUPPORTED_ENCODINGS } from "../../../services/textfile/common/encoding.js";
import { Schemas } from "../../../../base/common/network.js";
import { WorkspaceWatcher } from "./workspaceWatcher.js";
import { editorConfigurationBaseNode } from "../../../../editor/common/config/editorConfigurationSchema.js";
import { DirtyFilesIndicator } from "../common/dirtyFilesIndicator.js";
import { UndoCommand, RedoCommand } from "../../../../editor/browser/editorExtensions.js";
import { IUndoRedoService } from "../../../../platform/undoRedo/common/undoRedo.js";
import { IExplorerService } from "./files.js";
import { FileEditorInputSerializer, FileEditorWorkingCopyEditorHandler } from "./editors/fileEditorHandler.js";
import { ModesRegistry } from "../../../../editor/common/languages/modesRegistry.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { TextFileEditor } from "./editors/textFileEditor.js";
let FileUriLabelContribution = class {
  constructor(labelService) {
    labelService.registerFormatter({
      scheme: Schemas.file,
      formatting: {
        label: "${authority}${path}",
        separator: sep,
        tildify: !isWindows,
        normalizeDriveLetter: isWindows,
        authorityPrefix: sep + sep,
        workspaceSuffix: ""
      }
    });
  }
};
FileUriLabelContribution.ID = "workbench.contrib.fileUriLabel";
FileUriLabelContribution = __decorateClass([
  __decorateParam(0, ILabelService)
], FileUriLabelContribution);
registerSingleton(IExplorerService, ExplorerService, InstantiationType.Delayed);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    TextFileEditor,
    TextFileEditor.ID,
    nls.localize("textFileEditor", "Text File Editor")
  ),
  [
    new SyncDescriptor(FileEditorInput)
  ]
);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    BinaryFileEditor,
    BinaryFileEditor.ID,
    nls.localize("binaryFileEditor", "Binary File Editor")
  ),
  [
    new SyncDescriptor(FileEditorInput)
  ]
);
Registry.as(EditorExtensions.EditorFactory).registerFileEditorFactory({
  typeId: FILE_EDITOR_INPUT_ID,
  createFileEditor: (resource, preferredResource, preferredName, preferredDescription, preferredEncoding, preferredLanguageId, preferredContents, instantiationService) => {
    return instantiationService.createInstance(FileEditorInput, resource, preferredResource, preferredName, preferredDescription, preferredEncoding, preferredLanguageId, preferredContents);
  },
  isFileEditor: (obj) => {
    return obj instanceof FileEditorInput;
  }
});
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(FILE_EDITOR_INPUT_ID, FileEditorInputSerializer);
registerWorkbenchContribution2(FileEditorWorkingCopyEditorHandler.ID, FileEditorWorkingCopyEditorHandler, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ExplorerViewletViewsContribution.ID, ExplorerViewletViewsContribution, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(TextFileEditorTracker.ID, TextFileEditorTracker, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(TextFileSaveErrorHandler.ID, TextFileSaveErrorHandler, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(FileUriLabelContribution.ID, FileUriLabelContribution, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(WorkspaceWatcher.ID, WorkspaceWatcher, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(DirtyFilesIndicator.ID, DirtyFilesIndicator, WorkbenchPhase.BlockStartup);
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
const hotExitConfiguration = isNative ? {
  "type": "string",
  "scope": ConfigurationScope.APPLICATION,
  "enum": [HotExitConfiguration.OFF, HotExitConfiguration.ON_EXIT, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE],
  "default": HotExitConfiguration.ON_EXIT,
  "markdownEnumDescriptions": [
    nls.localize("hotExit.off", "Disable hot exit. A prompt will show when attempting to close a window with editors that have unsaved changes."),
    nls.localize("hotExit.onExit", "Hot exit will be triggered when the last window is closed on Windows/Linux or when the `workbench.action.quit` command is triggered (command palette, keybinding, menu). All windows without folders opened will be restored upon next launch. A list of previously opened windows with unsaved files can be accessed via `File > Open Recent > More...`"),
    nls.localize("hotExit.onExitAndWindowClose", "Hot exit will be triggered when the last window is closed on Windows/Linux or when the `workbench.action.quit` command is triggered (command palette, keybinding, menu), and also for any window with a folder opened regardless of whether it's the last window. All windows without folders opened will be restored upon next launch. A list of previously opened windows with unsaved files can be accessed via `File > Open Recent > More...`")
  ],
  "markdownDescription": nls.localize("hotExit", "[Hot Exit](https://aka.ms/vscode-hot-exit) controls whether unsaved files are remembered between sessions, allowing the save prompt when exiting the editor to be skipped.", HotExitConfiguration.ON_EXIT, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE)
} : {
  "type": "string",
  "scope": ConfigurationScope.APPLICATION,
  "enum": [HotExitConfiguration.OFF, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE],
  "default": HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE,
  "markdownEnumDescriptions": [
    nls.localize("hotExit.off", "Disable hot exit. A prompt will show when attempting to close a window with editors that have unsaved changes."),
    nls.localize("hotExit.onExitAndWindowCloseBrowser", "Hot exit will be triggered when the browser quits or the window or tab is closed.")
  ],
  "markdownDescription": nls.localize("hotExit", "[Hot Exit](https://aka.ms/vscode-hot-exit) controls whether unsaved files are remembered between sessions, allowing the save prompt when exiting the editor to be skipped.", HotExitConfiguration.ON_EXIT, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE)
};
configurationRegistry.registerConfiguration({
  "id": "files",
  "order": 9,
  "title": nls.localize("filesConfigurationTitle", "Files"),
  "type": "object",
  "properties": {
    [FILES_EXCLUDE_CONFIG]: {
      "type": "object",
      "markdownDescription": nls.localize("exclude", "Configure [glob patterns](https://aka.ms/vscode-glob-patterns) for excluding files and folders. For example, the File Explorer decides which files and folders to show or hide based on this setting. Refer to the `#search.exclude#` setting to define search-specific excludes. Refer to the `#explorer.excludeGitIgnore#` setting for ignoring files based on your `.gitignore`."),
      "default": {
        ...{ "**/.git": true, "**/.svn": true, "**/.hg": true, "**/.DS_Store": true, "**/Thumbs.db": true },
        ...isWeb ? {
          "**/*.crswap": true
          /* filter out swap files used for local file access */
        } : void 0
      },
      "scope": ConfigurationScope.RESOURCE,
      "additionalProperties": {
        "anyOf": [
          {
            "type": "boolean",
            "enum": [true, false],
            "enumDescriptions": [nls.localize("trueDescription", "Enable the pattern."), nls.localize("falseDescription", "Disable the pattern.")],
            "description": nls.localize("files.exclude.boolean", "The glob pattern to match file paths against. Set to true or false to enable or disable the pattern.")
          },
          {
            "type": "object",
            "properties": {
              "when": {
                "type": "string",
                // expression ({ "**/*.js": { "when": "$(basename).js" } })
                "pattern": "\\w*\\$\\(basename\\)\\w*",
                "default": "$(basename).ext",
                "markdownDescription": nls.localize({ key: "files.exclude.when", comment: ["\\$(basename) should not be translated"] }, "Additional check on the siblings of a matching file. Use \\$(basename) as variable for the matching file name.")
              }
            }
          }
        ]
      }
    },
    [FILES_ASSOCIATIONS_CONFIG]: {
      "type": "object",
      "markdownDescription": nls.localize("associations", 'Configure [glob patterns](https://aka.ms/vscode-glob-patterns) of file associations to languages (for example `"*.extension": "html"`). Patterns will match on the absolute path of a file if they contain a path separator and will match on the name of the file otherwise. These have precedence over the default associations of the languages installed.'),
      "additionalProperties": {
        "type": "string"
      }
    },
    "files.encoding": {
      "type": "string",
      "enum": Object.keys(SUPPORTED_ENCODINGS),
      "default": "utf8",
      "description": nls.localize("encoding", "The default character set encoding to use when reading and writing files. This setting can also be configured per language."),
      "scope": ConfigurationScope.LANGUAGE_OVERRIDABLE,
      "enumDescriptions": Object.keys(SUPPORTED_ENCODINGS).map((key) => SUPPORTED_ENCODINGS[key].labelLong),
      "enumItemLabels": Object.keys(SUPPORTED_ENCODINGS).map((key) => SUPPORTED_ENCODINGS[key].labelLong)
    },
    "files.autoGuessEncoding": {
      "type": "boolean",
      "default": false,
      "markdownDescription": nls.localize("autoGuessEncoding", "When enabled, the editor will attempt to guess the character set encoding when opening files. This setting can also be configured per language. Note, this setting is not respected by text search. Only {0} is respected.", "`#files.encoding#`"),
      "scope": ConfigurationScope.LANGUAGE_OVERRIDABLE
    },
    "files.candidateGuessEncodings": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": Object.keys(GUESSABLE_ENCODINGS),
        "enumDescriptions": Object.keys(GUESSABLE_ENCODINGS).map((key) => GUESSABLE_ENCODINGS[key].labelLong)
      },
      "default": [],
      "markdownDescription": nls.localize("candidateGuessEncodings", "List of character set encodings that the editor should attempt to guess in the order they are listed. In case it cannot be determined, {0} is respected", "`#files.encoding#`"),
      "scope": ConfigurationScope.LANGUAGE_OVERRIDABLE
    },
    "files.eol": {
      "type": "string",
      "enum": [
        "\n",
        "\r\n",
        "auto"
      ],
      "enumDescriptions": [
        nls.localize("eol.LF", "LF"),
        nls.localize("eol.CRLF", "CRLF"),
        nls.localize("eol.auto", "Uses operating system specific end of line character.")
      ],
      "default": "auto",
      "description": nls.localize("eol", "The default end of line character."),
      "scope": ConfigurationScope.LANGUAGE_OVERRIDABLE
    },
    "files.enableTrash": {
      "type": "boolean",
      "default": true,
      "description": nls.localize("useTrash", "Moves files/folders to the OS trash (recycle bin on Windows) when deleting. Disabling this will delete files/folders permanently.")
    },
    "files.trimTrailingWhitespace": {
      "type": "boolean",
      "default": false,
      "description": nls.localize("trimTrailingWhitespace", "When enabled, will trim trailing whitespace when saving a file."),
      "scope": ConfigurationScope.LANGUAGE_OVERRIDABLE
    },
    "files.trimTrailingWhitespaceInRegexAndStrings": {
      "type": "boolean",
      "default": true,
      "description": nls.localize("trimTrailingWhitespaceInRegexAndStrings", "When enabled, trailing whitespace will be removed from multiline strings and regexes will be removed on save or when executing 'editor.action.trimTrailingWhitespace'. This can cause whitespace to not be trimmed from lines when there isn't up-to-date token information."),
      "scope": ConfigurationScope.LANGUAGE_OVERRIDABLE
    },
    "files.insertFinalNewline": {
      "type": "boolean",
      "default": false,
      "description": nls.localize("insertFinalNewline", "When enabled, insert a final new line at the end of the file when saving it."),
      "scope": ConfigurationScope.LANGUAGE_OVERRIDABLE
    },
    "files.trimFinalNewlines": {
      "type": "boolean",
      "default": false,
      "description": nls.localize("trimFinalNewlines", "When enabled, will trim all new lines after the final new line at the end of the file when saving it."),
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
    },
    "files.autoSave": {
      "type": "string",
      "enum": [AutoSaveConfiguration.OFF, AutoSaveConfiguration.AFTER_DELAY, AutoSaveConfiguration.ON_FOCUS_CHANGE, AutoSaveConfiguration.ON_WINDOW_CHANGE],
      "markdownEnumDescriptions": [
        nls.localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "files.autoSave.off" }, "An editor with changes is never automatically saved."),
        nls.localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "files.autoSave.afterDelay" }, "An editor with changes is automatically saved after the configured `#files.autoSaveDelay#`."),
        nls.localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "files.autoSave.onFocusChange" }, "An editor with changes is automatically saved when the editor loses focus."),
        nls.localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "files.autoSave.onWindowChange" }, "An editor with changes is automatically saved when the window loses focus.")
      ],
      "default": isWeb ? AutoSaveConfiguration.AFTER_DELAY : AutoSaveConfiguration.OFF,
      "markdownDescription": nls.localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "autoSave" }, "Controls [auto save](https://code.visualstudio.com/docs/editor/codebasics#_save-auto-save) of editors that have unsaved changes.", AutoSaveConfiguration.OFF, AutoSaveConfiguration.AFTER_DELAY, AutoSaveConfiguration.ON_FOCUS_CHANGE, AutoSaveConfiguration.ON_WINDOW_CHANGE, AutoSaveConfiguration.AFTER_DELAY),
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
    },
    "files.autoSaveDelay": {
      "type": "number",
      "default": 1e3,
      "minimum": 0,
      "markdownDescription": nls.localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "autoSaveDelay" }, "Controls the delay in milliseconds after which an editor with unsaved changes is saved automatically. Only applies when `#files.autoSave#` is set to `{0}`.", AutoSaveConfiguration.AFTER_DELAY),
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
    },
    "files.autoSaveWorkspaceFilesOnly": {
      "type": "boolean",
      "default": false,
      "markdownDescription": nls.localize("autoSaveWorkspaceFilesOnly", "When enabled, will limit [auto save](https://code.visualstudio.com/docs/editor/codebasics#_save-auto-save) of editors to files that are inside the opened workspace. Only applies when {0} is enabled.", "`#files.autoSave#`"),
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
    },
    "files.autoSaveWhenNoErrors": {
      "type": "boolean",
      "default": false,
      "markdownDescription": nls.localize("autoSaveWhenNoErrors", "When enabled, will limit [auto save](https://code.visualstudio.com/docs/editor/codebasics#_save-auto-save) of editors to files that have no errors reported in them at the time the auto save is triggered. Only applies when {0} is enabled.", "`#files.autoSave#`"),
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
    },
    "files.watcherExclude": {
      "type": "object",
      "patternProperties": {
        ".*": { "type": "boolean" }
      },
      "default": { "**/.git/objects/**": true, "**/.git/subtree-cache/**": true, "**/.hg/store/**": true },
      "markdownDescription": nls.localize("watcherExclude", "Configure paths or [glob patterns](https://aka.ms/vscode-glob-patterns) to exclude from file watching. Paths can either be relative to the watched folder or absolute. Glob patterns are matched relative from the watched folder. When you experience the file watcher process consuming a lot of CPU, make sure to exclude large folders that are of less interest (such as build output folders)."),
      "scope": ConfigurationScope.RESOURCE
    },
    "files.watcherInclude": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "default": [],
      "description": nls.localize("watcherInclude", "Configure extra paths to watch for changes inside the workspace. By default, all workspace folders will be watched recursively, except for folders that are symbolic links. You can explicitly add absolute or relative paths to support watching folders that are symbolic links. Relative paths will be resolved to an absolute path using the currently opened workspace."),
      "scope": ConfigurationScope.RESOURCE
    },
    "files.hotExit": hotExitConfiguration,
    "files.defaultLanguage": {
      "type": "string",
      "markdownDescription": nls.localize("defaultLanguage", "The default language identifier that is assigned to new files. If configured to `${activeEditorLanguage}`, will use the language identifier of the currently active text editor if any.")
    },
    [FILES_READONLY_INCLUDE_CONFIG]: {
      "type": "object",
      "patternProperties": {
        ".*": { "type": "boolean" }
      },
      "default": {},
      "markdownDescription": nls.localize("filesReadonlyInclude", "Configure paths or [glob patterns](https://aka.ms/vscode-glob-patterns) to mark as read-only. Glob patterns are always evaluated relative to the path of the workspace folder unless they are absolute paths. You can exclude matching paths via the `#files.readonlyExclude#` setting. Files from readonly file system providers will always be read-only independent of this setting."),
      "scope": ConfigurationScope.RESOURCE
    },
    [FILES_READONLY_EXCLUDE_CONFIG]: {
      "type": "object",
      "patternProperties": {
        ".*": { "type": "boolean" }
      },
      "default": {},
      "markdownDescription": nls.localize("filesReadonlyExclude", "Configure paths or [glob patterns](https://aka.ms/vscode-glob-patterns) to exclude from being marked as read-only if they match as a result of the `#files.readonlyInclude#` setting. Glob patterns are always evaluated relative to the path of the workspace folder unless they are absolute paths. Files from readonly file system providers will always be read-only independent of this setting."),
      "scope": ConfigurationScope.RESOURCE
    },
    [FILES_READONLY_FROM_PERMISSIONS_CONFIG]: {
      "type": "boolean",
      "markdownDescription": nls.localize("filesReadonlyFromPermissions", "Marks files as read-only when their file permissions indicate as such. This can be overridden via `#files.readonlyInclude#` and `#files.readonlyExclude#` settings."),
      "default": false
    },
    "files.restoreUndoStack": {
      "type": "boolean",
      "description": nls.localize("files.restoreUndoStack", "Restore the undo stack when a file is reopened."),
      "default": true
    },
    "files.saveConflictResolution": {
      "type": "string",
      "enum": [
        "askUser",
        "overwriteFileOnDisk"
      ],
      "enumDescriptions": [
        nls.localize("askUser", "Will refuse to save and ask for resolving the save conflict manually."),
        nls.localize("overwriteFileOnDisk", "Will resolve the save conflict by overwriting the file on disk with the changes in the editor.")
      ],
      "description": nls.localize("files.saveConflictResolution", "A save conflict can occur when a file is saved to disk that was changed by another program in the meantime. To prevent data loss, the user is asked to compare the changes in the editor with the version on disk. This setting should only be changed if you frequently encounter save conflict errors and may result in data loss if used without caution."),
      "default": "askUser",
      "scope": ConfigurationScope.LANGUAGE_OVERRIDABLE
    },
    "files.dialog.defaultPath": {
      "type": "string",
      "pattern": "^((\\/|\\\\\\\\|[a-zA-Z]:\\\\).*)?$",
      // slash OR UNC-root OR drive-root OR undefined
      "patternErrorMessage": nls.localize("defaultPathErrorMessage", "Default path for file dialogs must be an absolute path (e.g. C:\\\\myFolder or /myFolder)."),
      "description": nls.localize("fileDialogDefaultPath", "Default path for file dialogs, overriding user's home path. Only used in the absence of a context-specific path, such as most recently opened file or folder."),
      "scope": ConfigurationScope.MACHINE
    },
    "files.simpleDialog.enable": {
      "type": "boolean",
      "description": nls.localize("files.simpleDialog.enable", "Enables the simple file dialog for opening and saving files and folders. The simple file dialog replaces the system file dialog when enabled."),
      "default": false
    },
    "files.participants.timeout": {
      type: "number",
      default: 6e4,
      markdownDescription: nls.localize("files.participants.timeout", "Timeout in milliseconds after which file participants for create, rename, and delete are cancelled. Use `0` to disable participants.")
    }
  }
});
configurationRegistry.registerConfiguration({
  ...editorConfigurationBaseNode,
  properties: {
    "editor.formatOnSave": {
      "type": "boolean",
      "markdownDescription": nls.localize("formatOnSave", "Format a file on save. A formatter must be available and the editor must not be shutting down. When {0} is set to `afterDelay`, the file will only be formatted when saved explicitly.", "`#files.autoSave#`"),
      "scope": ConfigurationScope.LANGUAGE_OVERRIDABLE
    },
    "editor.formatOnSaveMode": {
      "type": "string",
      "default": "file",
      "enum": [
        "file",
        "modifications",
        "modificationsIfAvailable"
      ],
      "enumDescriptions": [
        nls.localize({ key: "everything", comment: ["This is the description of an option"] }, "Format the whole file."),
        nls.localize({ key: "modification", comment: ["This is the description of an option"] }, "Format modifications (requires source control)."),
        nls.localize({ key: "modificationIfAvailable", comment: ["This is the description of an option"] }, "Will attempt to format modifications only (requires source control). If source control can't be used, then the whole file will be formatted.")
      ],
      "markdownDescription": nls.localize("formatOnSaveMode", "Controls if format on save formats the whole file or only modifications. Only applies when `#editor.formatOnSave#` is enabled."),
      "scope": ConfigurationScope.LANGUAGE_OVERRIDABLE
    }
  }
});
configurationRegistry.registerConfiguration({
  "id": "explorer",
  "order": 10,
  "title": nls.localize("explorerConfigurationTitle", "File Explorer"),
  "type": "object",
  "properties": {
    "explorer.openEditors.visible": {
      "type": "number",
      "description": nls.localize({ key: "openEditorsVisible", comment: ["Open is an adjective"] }, "The initial maximum number of editors shown in the Open Editors pane. Exceeding this limit will show a scroll bar and allow resizing the pane to display more items."),
      "default": 9,
      "minimum": 1
    },
    "explorer.openEditors.minVisible": {
      "type": "number",
      "description": nls.localize({ key: "openEditorsVisibleMin", comment: ["Open is an adjective"] }, "The minimum number of editor slots pre-allocated in the Open Editors pane. If set to 0 the Open Editors pane will dynamically resize based on the number of editors."),
      "default": 0,
      "minimum": 0
    },
    "explorer.openEditors.sortOrder": {
      "type": "string",
      "enum": ["editorOrder", "alphabetical", "fullPath"],
      "description": nls.localize({ key: "openEditorsSortOrder", comment: ["Open is an adjective"] }, "Controls the sorting order of editors in the Open Editors pane."),
      "enumDescriptions": [
        nls.localize("sortOrder.editorOrder", "Editors are ordered in the same order editor tabs are shown."),
        nls.localize("sortOrder.alphabetical", "Editors are ordered alphabetically by tab name inside each editor group."),
        nls.localize("sortOrder.fullPath", "Editors are ordered alphabetically by full path inside each editor group.")
      ],
      "default": "editorOrder"
    },
    "explorer.autoReveal": {
      "type": ["boolean", "string"],
      "enum": [true, false, "focusNoScroll"],
      "default": true,
      "enumDescriptions": [
        nls.localize("autoReveal.on", "Files will be revealed and selected."),
        nls.localize("autoReveal.off", "Files will not be revealed and selected."),
        nls.localize("autoReveal.focusNoScroll", "Files will not be scrolled into view, but will still be focused.")
      ],
      "description": nls.localize("autoReveal", "Controls whether the Explorer should automatically reveal and select files when opening them.")
    },
    "explorer.autoRevealExclude": {
      "type": "object",
      "markdownDescription": nls.localize("autoRevealExclude", "Configure paths or [glob patterns](https://aka.ms/vscode-glob-patterns) for excluding files and folders from being revealed and selected in the Explorer when they are opened. Glob patterns are always evaluated relative to the path of the workspace folder unless they are absolute paths."),
      "default": { "**/node_modules": true, "**/bower_components": true },
      "additionalProperties": {
        "anyOf": [
          {
            "type": "boolean",
            "description": nls.localize("explorer.autoRevealExclude.boolean", "The glob pattern to match file paths against. Set to true or false to enable or disable the pattern.")
          },
          {
            type: "object",
            properties: {
              when: {
                type: "string",
                // expression ({ "**/*.js": { "when": "$(basename).js" } })
                pattern: "\\w*\\$\\(basename\\)\\w*",
                default: "$(basename).ext",
                description: nls.localize("explorer.autoRevealExclude.when", "Additional check on the siblings of a matching file. Use $(basename) as variable for the matching file name.")
              }
            }
          }
        ]
      }
    },
    "explorer.enableDragAndDrop": {
      "type": "boolean",
      "description": nls.localize("enableDragAndDrop", "Controls whether the Explorer should allow to move files and folders via drag and drop. This setting only effects drag and drop from inside the Explorer."),
      "default": true
    },
    "explorer.confirmDragAndDrop": {
      "type": "boolean",
      "description": nls.localize("confirmDragAndDrop", "Controls whether the Explorer should ask for confirmation to move files and folders via drag and drop."),
      "default": true
    },
    "explorer.confirmPasteNative": {
      "type": "boolean",
      "description": nls.localize("confirmPasteNative", "Controls whether the Explorer should ask for confirmation when pasting native files and folders."),
      "default": true
    },
    "explorer.confirmDelete": {
      "type": "boolean",
      "description": nls.localize("confirmDelete", "Controls whether the Explorer should ask for confirmation when deleting a file via the trash."),
      "default": true
    },
    "explorer.enableUndo": {
      "type": "boolean",
      "description": nls.localize("enableUndo", "Controls whether the Explorer should support undoing file and folder operations."),
      "default": true
    },
    "explorer.confirmUndo": {
      "type": "string",
      "enum": [UndoConfirmLevel.Verbose, UndoConfirmLevel.Default, UndoConfirmLevel.Light],
      "description": nls.localize("confirmUndo", "Controls whether the Explorer should ask for confirmation when undoing."),
      "default": UndoConfirmLevel.Default,
      "enumDescriptions": [
        nls.localize("enableUndo.verbose", "Explorer will prompt before all undo operations."),
        nls.localize("enableUndo.default", "Explorer will prompt before destructive undo operations."),
        nls.localize("enableUndo.light", "Explorer will not prompt before undo operations when focused.")
      ]
    },
    "explorer.expandSingleFolderWorkspaces": {
      "type": "boolean",
      "description": nls.localize("expandSingleFolderWorkspaces", "Controls whether the Explorer should expand multi-root workspaces containing only one folder during initialization"),
      "default": true
    },
    "explorer.sortOrder": {
      "type": "string",
      "enum": [SortOrder.Default, SortOrder.Mixed, SortOrder.FilesFirst, SortOrder.Type, SortOrder.Modified, SortOrder.FoldersNestsFiles],
      "default": SortOrder.Default,
      "enumDescriptions": [
        nls.localize("sortOrder.default", "Files and folders are sorted by their names. Folders are displayed before files."),
        nls.localize("sortOrder.mixed", "Files and folders are sorted by their names. Files are interwoven with folders."),
        nls.localize("sortOrder.filesFirst", "Files and folders are sorted by their names. Files are displayed before folders."),
        nls.localize("sortOrder.type", "Files and folders are grouped by extension type then sorted by their names. Folders are displayed before files."),
        nls.localize("sortOrder.modified", "Files and folders are sorted by last modified date in descending order. Folders are displayed before files."),
        nls.localize("sortOrder.foldersNestsFiles", "Files and folders are sorted by their names. Folders are displayed before files. Files with nested children are displayed before other files.")
      ],
      "markdownDescription": nls.localize("sortOrder", "Controls the property-based sorting of files and folders in the Explorer. When `#explorer.fileNesting.enabled#` is enabled, also controls sorting of nested files.")
    },
    "explorer.sortOrderLexicographicOptions": {
      "type": "string",
      "enum": [LexicographicOptions.Default, LexicographicOptions.Upper, LexicographicOptions.Lower, LexicographicOptions.Unicode],
      "default": LexicographicOptions.Default,
      "enumDescriptions": [
        nls.localize("sortOrderLexicographicOptions.default", "Uppercase and lowercase names are mixed together."),
        nls.localize("sortOrderLexicographicOptions.upper", "Uppercase names are grouped together before lowercase names."),
        nls.localize("sortOrderLexicographicOptions.lower", "Lowercase names are grouped together before uppercase names."),
        nls.localize("sortOrderLexicographicOptions.unicode", "Names are sorted in Unicode order.")
      ],
      "description": nls.localize("sortOrderLexicographicOptions", "Controls the lexicographic sorting of file and folder names in the Explorer.")
    },
    "explorer.sortOrderReverse": {
      "type": "boolean",
      "description": nls.localize("sortOrderReverse", "Controls whether the file and folder sort order, should be reversed."),
      "default": false
    },
    "explorer.decorations.colors": {
      type: "boolean",
      description: nls.localize("explorer.decorations.colors", "Controls whether file decorations should use colors."),
      default: true
    },
    "explorer.decorations.badges": {
      type: "boolean",
      description: nls.localize("explorer.decorations.badges", "Controls whether file decorations should use badges."),
      default: true
    },
    "explorer.incrementalNaming": {
      "type": "string",
      enum: ["simple", "smart", "disabled"],
      enumDescriptions: [
        nls.localize("simple", 'Appends the word "copy" at the end of the duplicated name potentially followed by a number.'),
        nls.localize("smart", "Adds a number at the end of the duplicated name. If some number is already part of the name, tries to increase that number."),
        nls.localize("disabled", "Disables incremental naming. If two files with the same name exist you will be prompted to overwrite the existing file.")
      ],
      description: nls.localize("explorer.incrementalNaming", "Controls which naming strategy to use when giving a new name to a duplicated Explorer item on paste."),
      default: "simple"
    },
    "explorer.autoOpenDroppedFile": {
      "type": "boolean",
      "description": nls.localize("autoOpenDroppedFile", "Controls whether the Explorer should automatically open a file when it is dropped into the explorer"),
      "default": true
    },
    "explorer.compactFolders": {
      "type": "boolean",
      "description": nls.localize("compressSingleChildFolders", "Controls whether the Explorer should render folders in a compact form. In such a form, single child folders will be compressed in a combined tree element. Useful for Java package structures, for example."),
      "default": true
    },
    "explorer.copyRelativePathSeparator": {
      "type": "string",
      "enum": [
        "/",
        "\\",
        "auto"
      ],
      "enumDescriptions": [
        nls.localize("copyRelativePathSeparator.slash", "Use slash as path separation character."),
        nls.localize("copyRelativePathSeparator.backslash", "Use backslash as path separation character."),
        nls.localize("copyRelativePathSeparator.auto", "Uses operating system specific path separation character.")
      ],
      "description": nls.localize("copyRelativePathSeparator", "The path separation character used when copying relative file paths."),
      "default": "auto"
    },
    "explorer.copyPathSeparator": {
      "type": "string",
      "enum": [
        "/",
        "\\",
        "auto"
      ],
      "enumDescriptions": [
        nls.localize("copyPathSeparator.slash", "Use slash as path separation character."),
        nls.localize("copyPathSeparator.backslash", "Use backslash as path separation character."),
        nls.localize("copyPathSeparator.auto", "Uses operating system specific path separation character.")
      ],
      "description": nls.localize("copyPathSeparator", "The path separation character used when copying file paths."),
      "default": "auto"
    },
    "explorer.excludeGitIgnore": {
      type: "boolean",
      markdownDescription: nls.localize("excludeGitignore", "Controls whether entries in .gitignore should be parsed and excluded from the Explorer. Similar to {0}.", "`#files.exclude#`"),
      default: false,
      scope: ConfigurationScope.RESOURCE
    },
    "explorer.fileNesting.enabled": {
      "type": "boolean",
      scope: ConfigurationScope.RESOURCE,
      "markdownDescription": nls.localize("fileNestingEnabled", "Controls whether file nesting is enabled in the Explorer. File nesting allows for related files in a directory to be visually grouped together under a single parent file."),
      "default": false
    },
    "explorer.fileNesting.expand": {
      "type": "boolean",
      "markdownDescription": nls.localize("fileNestingExpand", "Controls whether file nests are automatically expanded. {0} must be set for this to take effect.", "`#explorer.fileNesting.enabled#`"),
      "default": true
    },
    "explorer.fileNesting.patterns": {
      "type": "object",
      scope: ConfigurationScope.RESOURCE,
      "markdownDescription": nls.localize("fileNestingPatterns", "Controls nesting of files in the Explorer. {0} must be set for this to take effect. Each __Item__ represents a parent pattern and may contain a single `*` character that matches any string. Each __Value__ represents a comma separated list of the child patterns that should be shown nested under a given parent. Child patterns may contain several special tokens:\n- `${capture}`: Matches the resolved value of the `*` from the parent pattern\n- `${basename}`: Matches the parent file's basename, the `file` in `file.ts`\n- `${extname}`: Matches the parent file's extension, the `ts` in `file.ts`\n- `${dirname}`: Matches the parent file's directory name, the `src` in `src/file.ts`\n- `*`:  Matches any string, may only be used once per child pattern", "`#explorer.fileNesting.enabled#`"),
      patternProperties: {
        "^[^*]*\\*?[^*]*$": {
          markdownDescription: nls.localize("fileNesting.description", "Each key pattern may contain a single `*` character which will match any string."),
          type: "string",
          pattern: "^([^,*]*\\*?[^,*]*)(, ?[^,*]*\\*?[^,*]*)*$"
        }
      },
      additionalProperties: false,
      "default": {
        "*.ts": "${capture}.js",
        "*.js": "${capture}.js.map, ${capture}.min.js, ${capture}.d.ts",
        "*.jsx": "${capture}.js",
        "*.tsx": "${capture}.ts",
        "tsconfig.json": "tsconfig.*.json",
        "package.json": "package-lock.json, yarn.lock, pnpm-lock.yaml, bun.lockb, bun.lock"
      }
    }
  }
});
UndoCommand.addImplementation(110, "explorer", (accessor) => {
  const undoRedoService = accessor.get(IUndoRedoService);
  const explorerService = accessor.get(IExplorerService);
  const configurationService = accessor.get(IConfigurationService);
  const explorerCanUndo = configurationService.getValue().explorer.enableUndo;
  if (explorerService.hasViewFocus() && undoRedoService.canUndo(UNDO_REDO_SOURCE) && explorerCanUndo) {
    undoRedoService.undo(UNDO_REDO_SOURCE);
    return true;
  }
  return false;
});
RedoCommand.addImplementation(110, "explorer", (accessor) => {
  const undoRedoService = accessor.get(IUndoRedoService);
  const explorerService = accessor.get(IExplorerService);
  const configurationService = accessor.get(IConfigurationService);
  const explorerCanUndo = configurationService.getValue().explorer.enableUndo;
  if (explorerService.hasViewFocus() && undoRedoService.canRedo(UNDO_REDO_SOURCE) && explorerCanUndo) {
    undoRedoService.redo(UNDO_REDO_SOURCE);
    return true;
  }
  return false;
});
ModesRegistry.registerLanguage({
  id: BINARY_TEXT_FILE_MODE,
  aliases: ["Binary"],
  mimetypes: ["text/x-code-binary"]
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL2ZpbGVzLmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgc2VwIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLCBDb25maWd1cmF0aW9uU2NvcGUsIElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgV29ya2JlbmNoUGhhc2UsIHJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElGaWxlRWRpdG9ySW5wdXQsIElFZGl0b3JGYWN0b3J5UmVnaXN0cnksIEVkaXRvckV4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEF1dG9TYXZlQ29uZmlndXJhdGlvbiwgSG90RXhpdENvbmZpZ3VyYXRpb24sIEZJTEVTX0VYQ0xVREVfQ09ORklHLCBGSUxFU19BU1NPQ0lBVElPTlNfQ09ORklHLCBGSUxFU19SRUFET05MWV9JTkNMVURFX0NPTkZJRywgRklMRVNfUkVBRE9OTFlfRVhDTFVERV9DT05GSUcsIEZJTEVTX1JFQURPTkxZX0ZST01fUEVSTUlTU0lPTlNfQ09ORklHIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IFNvcnRPcmRlciwgTGV4aWNvZ3JhcGhpY09wdGlvbnMsIEZJTEVfRURJVE9SX0lOUFVUX0lELCBCSU5BUllfVEVYVF9GSUxFX01PREUsIFVuZG9Db25maXJtTGV2ZWwsIElGaWxlc0NvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgVGV4dEZpbGVFZGl0b3JUcmFja2VyIH0gZnJvbSAnLi9lZGl0b3JzL3RleHRGaWxlRWRpdG9yVHJhY2tlci5qcyc7XG5pbXBvcnQgeyBUZXh0RmlsZVNhdmVFcnJvckhhbmRsZXIgfSBmcm9tICcuL2VkaXRvcnMvdGV4dEZpbGVTYXZlRXJyb3JIYW5kbGVyLmpzJztcbmltcG9ydCB7IEZpbGVFZGl0b3JJbnB1dCB9IGZyb20gJy4vZWRpdG9ycy9maWxlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgQmluYXJ5RmlsZUVkaXRvciB9IGZyb20gJy4vZWRpdG9ycy9iaW5hcnlGaWxlRWRpdG9yLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgaXNOYXRpdmUsIGlzV2ViLCBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBFeHBsb3JlclZpZXdsZXRWaWV3c0NvbnRyaWJ1dGlvbiB9IGZyb20gJy4vZXhwbG9yZXJWaWV3bGV0LmpzJztcbmltcG9ydCB7IElFZGl0b3JQYW5lUmVnaXN0cnksIEVkaXRvclBhbmVEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEV4cGxvcmVyU2VydmljZSwgVU5ET19SRURPX1NPVVJDRSB9IGZyb20gJy4vZXhwbG9yZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEdVRVNTQUJMRV9FTkNPRElOR1MsIFNVUFBPUlRFRF9FTkNPRElOR1MgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vZW5jb2RpbmcuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgV29ya3NwYWNlV2F0Y2hlciB9IGZyb20gJy4vd29ya3NwYWNlV2F0Y2hlci5qcyc7XG5pbXBvcnQgeyBlZGl0b3JDb25maWd1cmF0aW9uQmFzZU5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JDb25maWd1cmF0aW9uU2NoZW1hLmpzJztcbmltcG9ydCB7IERpcnR5RmlsZXNJbmRpY2F0b3IgfSBmcm9tICcuLi9jb21tb24vZGlydHlGaWxlc0luZGljYXRvci5qcyc7XG5pbXBvcnQgeyBVbmRvQ29tbWFuZCwgUmVkb0NvbW1hbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElVbmRvUmVkb1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91bmRvUmVkby9jb21tb24vdW5kb1JlZG8uanMnO1xuaW1wb3J0IHsgSUV4cGxvcmVyU2VydmljZSB9IGZyb20gJy4vZmlsZXMuanMnO1xuaW1wb3J0IHsgRmlsZUVkaXRvcklucHV0U2VyaWFsaXplciwgRmlsZUVkaXRvcldvcmtpbmdDb3B5RWRpdG9ySGFuZGxlciB9IGZyb20gJy4vZWRpdG9ycy9maWxlRWRpdG9ySGFuZGxlci5qcyc7XG5pbXBvcnQgeyBNb2Rlc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbW9kZXNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRleHRGaWxlRWRpdG9yIH0gZnJvbSAnLi9lZGl0b3JzL3RleHRGaWxlRWRpdG9yLmpzJztcblxuY2xhc3MgRmlsZVVyaUxhYmVsQ29udHJpYnV0aW9uIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLmZpbGVVcmlMYWJlbCc7XG5cblx0Y29uc3RydWN0b3IoQElMYWJlbFNlcnZpY2UgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlKSB7XG5cdFx0bGFiZWxTZXJ2aWNlLnJlZ2lzdGVyRm9ybWF0dGVyKHtcblx0XHRcdHNjaGVtZTogU2NoZW1hcy5maWxlLFxuXHRcdFx0Zm9ybWF0dGluZzoge1xuXHRcdFx0XHRsYWJlbDogJyR7YXV0aG9yaXR5fSR7cGF0aH0nLFxuXHRcdFx0XHRzZXBhcmF0b3I6IHNlcCxcblx0XHRcdFx0dGlsZGlmeTogIWlzV2luZG93cyxcblx0XHRcdFx0bm9ybWFsaXplRHJpdmVMZXR0ZXI6IGlzV2luZG93cyxcblx0XHRcdFx0YXV0aG9yaXR5UHJlZml4OiBzZXAgKyBzZXAsXG5cdFx0XHRcdHdvcmtzcGFjZVN1ZmZpeDogJydcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJRXhwbG9yZXJTZXJ2aWNlLCBFeHBsb3JlclNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xuXG4vLyBSZWdpc3RlciBmaWxlIGVkaXRvcnNcblxuUmVnaXN0cnkuYXM8SUVkaXRvclBhbmVSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JQYW5lKS5yZWdpc3RlckVkaXRvclBhbmUoXG5cdEVkaXRvclBhbmVEZXNjcmlwdG9yLmNyZWF0ZShcblx0XHRUZXh0RmlsZUVkaXRvcixcblx0XHRUZXh0RmlsZUVkaXRvci5JRCxcblx0XHRubHMubG9jYWxpemUoJ3RleHRGaWxlRWRpdG9yJywgXCJUZXh0IEZpbGUgRWRpdG9yXCIpXG5cdCksXG5cdFtcblx0XHRuZXcgU3luY0Rlc2NyaXB0b3IoRmlsZUVkaXRvcklucHV0KVxuXHRdXG4pO1xuXG5SZWdpc3RyeS5hczxJRWRpdG9yUGFuZVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvclBhbmUpLnJlZ2lzdGVyRWRpdG9yUGFuZShcblx0RWRpdG9yUGFuZURlc2NyaXB0b3IuY3JlYXRlKFxuXHRcdEJpbmFyeUZpbGVFZGl0b3IsXG5cdFx0QmluYXJ5RmlsZUVkaXRvci5JRCxcblx0XHRubHMubG9jYWxpemUoJ2JpbmFyeUZpbGVFZGl0b3InLCBcIkJpbmFyeSBGaWxlIEVkaXRvclwiKVxuXHQpLFxuXHRbXG5cdFx0bmV3IFN5bmNEZXNjcmlwdG9yKEZpbGVFZGl0b3JJbnB1dClcblx0XVxuKTtcblxuLy8gUmVnaXN0ZXIgZGVmYXVsdCBmaWxlIGlucHV0IGZhY3RvcnlcblJlZ2lzdHJ5LmFzPElFZGl0b3JGYWN0b3J5UmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSkucmVnaXN0ZXJGaWxlRWRpdG9yRmFjdG9yeSh7XG5cblx0dHlwZUlkOiBGSUxFX0VESVRPUl9JTlBVVF9JRCxcblxuXHRjcmVhdGVGaWxlRWRpdG9yOiAocmVzb3VyY2UsIHByZWZlcnJlZFJlc291cmNlLCBwcmVmZXJyZWROYW1lLCBwcmVmZXJyZWREZXNjcmlwdGlvbiwgcHJlZmVycmVkRW5jb2RpbmcsIHByZWZlcnJlZExhbmd1YWdlSWQsIHByZWZlcnJlZENvbnRlbnRzLCBpbnN0YW50aWF0aW9uU2VydmljZSk6IElGaWxlRWRpdG9ySW5wdXQgPT4ge1xuXHRcdHJldHVybiBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShGaWxlRWRpdG9ySW5wdXQsIHJlc291cmNlLCBwcmVmZXJyZWRSZXNvdXJjZSwgcHJlZmVycmVkTmFtZSwgcHJlZmVycmVkRGVzY3JpcHRpb24sIHByZWZlcnJlZEVuY29kaW5nLCBwcmVmZXJyZWRMYW5ndWFnZUlkLCBwcmVmZXJyZWRDb250ZW50cyk7XG5cdH0sXG5cblx0aXNGaWxlRWRpdG9yOiAob2JqKTogb2JqIGlzIElGaWxlRWRpdG9ySW5wdXQgPT4ge1xuXHRcdHJldHVybiBvYmogaW5zdGFuY2VvZiBGaWxlRWRpdG9ySW5wdXQ7XG5cdH1cbn0pO1xuXG4vLyBSZWdpc3RlciBFZGl0b3IgSW5wdXQgU2VyaWFsaXplciAmIEhhbmRsZXJcblJlZ2lzdHJ5LmFzPElFZGl0b3JGYWN0b3J5UmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSkucmVnaXN0ZXJFZGl0b3JTZXJpYWxpemVyKEZJTEVfRURJVE9SX0lOUFVUX0lELCBGaWxlRWRpdG9ySW5wdXRTZXJpYWxpemVyKTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihGaWxlRWRpdG9yV29ya2luZ0NvcHlFZGl0b3JIYW5kbGVyLklELCBGaWxlRWRpdG9yV29ya2luZ0NvcHlFZGl0b3JIYW5kbGVyLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1Jlc3RvcmUpO1xuXG4vLyBSZWdpc3RlciBFeHBsb3JlciB2aWV3c1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKEV4cGxvcmVyVmlld2xldFZpZXdzQ29udHJpYnV0aW9uLklELCBFeHBsb3JlclZpZXdsZXRWaWV3c0NvbnRyaWJ1dGlvbiwgV29ya2JlbmNoUGhhc2UuQmxvY2tTdGFydHVwKTtcblxuLy8gUmVnaXN0ZXIgVGV4dCBGaWxlIEVkaXRvciBUcmFja2VyXG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoVGV4dEZpbGVFZGl0b3JUcmFja2VyLklELCBUZXh0RmlsZUVkaXRvclRyYWNrZXIsIFdvcmtiZW5jaFBoYXNlLkJsb2NrU3RhcnR1cCk7XG5cbi8vIFJlZ2lzdGVyIFRleHQgRmlsZSBTYXZlIEVycm9yIEhhbmRsZXJcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihUZXh0RmlsZVNhdmVFcnJvckhhbmRsZXIuSUQsIFRleHRGaWxlU2F2ZUVycm9ySGFuZGxlciwgV29ya2JlbmNoUGhhc2UuQmxvY2tTdGFydHVwKTtcblxuLy8gUmVnaXN0ZXIgdXJpIGRpc3BsYXkgZm9yIGZpbGUgdXJpc1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKEZpbGVVcmlMYWJlbENvbnRyaWJ1dGlvbi5JRCwgRmlsZVVyaUxhYmVsQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1N0YXJ0dXApO1xuXG4vLyBSZWdpc3RlciBXb3Jrc3BhY2UgV2F0Y2hlclxucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKFdvcmtzcGFjZVdhdGNoZXIuSUQsIFdvcmtzcGFjZVdhdGNoZXIsIFdvcmtiZW5jaFBoYXNlLkFmdGVyUmVzdG9yZWQpO1xuXG4vLyBSZWdpc3RlciBEaXJ0eSBGaWxlcyBJbmRpY2F0b3JcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihEaXJ0eUZpbGVzSW5kaWNhdG9yLklELCBEaXJ0eUZpbGVzSW5kaWNhdG9yLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1N0YXJ0dXApO1xuXG4vLyBDb25maWd1cmF0aW9uXG5jb25zdCBjb25maWd1cmF0aW9uUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihDb25maWd1cmF0aW9uRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKTtcblxuY29uc3QgaG90RXhpdENvbmZpZ3VyYXRpb246IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgPSBpc05hdGl2ZSA/XG5cdHtcblx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTixcblx0XHQnZW51bSc6IFtIb3RFeGl0Q29uZmlndXJhdGlvbi5PRkYsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVQsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVRfQU5EX1dJTkRPV19DTE9TRV0sXG5cdFx0J2RlZmF1bHQnOiBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULFxuXHRcdCdtYXJrZG93bkVudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRubHMubG9jYWxpemUoJ2hvdEV4aXQub2ZmJywgJ0Rpc2FibGUgaG90IGV4aXQuIEEgcHJvbXB0IHdpbGwgc2hvdyB3aGVuIGF0dGVtcHRpbmcgdG8gY2xvc2UgYSB3aW5kb3cgd2l0aCBlZGl0b3JzIHRoYXQgaGF2ZSB1bnNhdmVkIGNoYW5nZXMuJyksXG5cdFx0XHRubHMubG9jYWxpemUoJ2hvdEV4aXQub25FeGl0JywgJ0hvdCBleGl0IHdpbGwgYmUgdHJpZ2dlcmVkIHdoZW4gdGhlIGxhc3Qgd2luZG93IGlzIGNsb3NlZCBvbiBXaW5kb3dzL0xpbnV4IG9yIHdoZW4gdGhlIGB3b3JrYmVuY2guYWN0aW9uLnF1aXRgIGNvbW1hbmQgaXMgdHJpZ2dlcmVkIChjb21tYW5kIHBhbGV0dGUsIGtleWJpbmRpbmcsIG1lbnUpLiBBbGwgd2luZG93cyB3aXRob3V0IGZvbGRlcnMgb3BlbmVkIHdpbGwgYmUgcmVzdG9yZWQgdXBvbiBuZXh0IGxhdW5jaC4gQSBsaXN0IG9mIHByZXZpb3VzbHkgb3BlbmVkIHdpbmRvd3Mgd2l0aCB1bnNhdmVkIGZpbGVzIGNhbiBiZSBhY2Nlc3NlZCB2aWEgYEZpbGUgPiBPcGVuIFJlY2VudCA+IE1vcmUuLi5gJyksXG5cdFx0XHRubHMubG9jYWxpemUoJ2hvdEV4aXQub25FeGl0QW5kV2luZG93Q2xvc2UnLCAnSG90IGV4aXQgd2lsbCBiZSB0cmlnZ2VyZWQgd2hlbiB0aGUgbGFzdCB3aW5kb3cgaXMgY2xvc2VkIG9uIFdpbmRvd3MvTGludXggb3Igd2hlbiB0aGUgYHdvcmtiZW5jaC5hY3Rpb24ucXVpdGAgY29tbWFuZCBpcyB0cmlnZ2VyZWQgKGNvbW1hbmQgcGFsZXR0ZSwga2V5YmluZGluZywgbWVudSksIGFuZCBhbHNvIGZvciBhbnkgd2luZG93IHdpdGggYSBmb2xkZXIgb3BlbmVkIHJlZ2FyZGxlc3Mgb2Ygd2hldGhlciBpdFxcJ3MgdGhlIGxhc3Qgd2luZG93LiBBbGwgd2luZG93cyB3aXRob3V0IGZvbGRlcnMgb3BlbmVkIHdpbGwgYmUgcmVzdG9yZWQgdXBvbiBuZXh0IGxhdW5jaC4gQSBsaXN0IG9mIHByZXZpb3VzbHkgb3BlbmVkIHdpbmRvd3Mgd2l0aCB1bnNhdmVkIGZpbGVzIGNhbiBiZSBhY2Nlc3NlZCB2aWEgYEZpbGUgPiBPcGVuIFJlY2VudCA+IE1vcmUuLi5gJylcblx0XHRdLFxuXHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdob3RFeGl0JywgXCJbSG90IEV4aXRdKGh0dHBzOi8vYWthLm1zL3ZzY29kZS1ob3QtZXhpdCkgY29udHJvbHMgd2hldGhlciB1bnNhdmVkIGZpbGVzIGFyZSByZW1lbWJlcmVkIGJldHdlZW4gc2Vzc2lvbnMsIGFsbG93aW5nIHRoZSBzYXZlIHByb21wdCB3aGVuIGV4aXRpbmcgdGhlIGVkaXRvciB0byBiZSBza2lwcGVkLlwiLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UpXG5cdH0gOiB7XG5cdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0J2VudW0nOiBbSG90RXhpdENvbmZpZ3VyYXRpb24uT0ZGLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0VdLFxuXHRcdCdkZWZhdWx0JzogSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVF9BTkRfV0lORE9XX0NMT1NFLFxuXHRcdCdtYXJrZG93bkVudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRubHMubG9jYWxpemUoJ2hvdEV4aXQub2ZmJywgJ0Rpc2FibGUgaG90IGV4aXQuIEEgcHJvbXB0IHdpbGwgc2hvdyB3aGVuIGF0dGVtcHRpbmcgdG8gY2xvc2UgYSB3aW5kb3cgd2l0aCBlZGl0b3JzIHRoYXQgaGF2ZSB1bnNhdmVkIGNoYW5nZXMuJyksXG5cdFx0XHRubHMubG9jYWxpemUoJ2hvdEV4aXQub25FeGl0QW5kV2luZG93Q2xvc2VCcm93c2VyJywgJ0hvdCBleGl0IHdpbGwgYmUgdHJpZ2dlcmVkIHdoZW4gdGhlIGJyb3dzZXIgcXVpdHMgb3IgdGhlIHdpbmRvdyBvciB0YWIgaXMgY2xvc2VkLicpXG5cdFx0XSxcblx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgnaG90RXhpdCcsIFwiW0hvdCBFeGl0XShodHRwczovL2FrYS5tcy92c2NvZGUtaG90LWV4aXQpIGNvbnRyb2xzIHdoZXRoZXIgdW5zYXZlZCBmaWxlcyBhcmUgcmVtZW1iZXJlZCBiZXR3ZWVuIHNlc3Npb25zLCBhbGxvd2luZyB0aGUgc2F2ZSBwcm9tcHQgd2hlbiBleGl0aW5nIHRoZSBlZGl0b3IgdG8gYmUgc2tpcHBlZC5cIiwgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVCwgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVF9BTkRfV0lORE9XX0NMT1NFKVxuXHR9O1xuXG5jb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0J2lkJzogJ2ZpbGVzJyxcblx0J29yZGVyJzogOSxcblx0J3RpdGxlJzogbmxzLmxvY2FsaXplKCdmaWxlc0NvbmZpZ3VyYXRpb25UaXRsZScsIFwiRmlsZXNcIiksXG5cdCd0eXBlJzogJ29iamVjdCcsXG5cdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFtGSUxFU19FWENMVURFX0NPTkZJR106IHtcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgnZXhjbHVkZScsIFwiQ29uZmlndXJlIFtnbG9iIHBhdHRlcm5zXShodHRwczovL2FrYS5tcy92c2NvZGUtZ2xvYi1wYXR0ZXJucykgZm9yIGV4Y2x1ZGluZyBmaWxlcyBhbmQgZm9sZGVycy4gRm9yIGV4YW1wbGUsIHRoZSBGaWxlIEV4cGxvcmVyIGRlY2lkZXMgd2hpY2ggZmlsZXMgYW5kIGZvbGRlcnMgdG8gc2hvdyBvciBoaWRlIGJhc2VkIG9uIHRoaXMgc2V0dGluZy4gUmVmZXIgdG8gdGhlIGAjc2VhcmNoLmV4Y2x1ZGUjYCBzZXR0aW5nIHRvIGRlZmluZSBzZWFyY2gtc3BlY2lmaWMgZXhjbHVkZXMuIFJlZmVyIHRvIHRoZSBgI2V4cGxvcmVyLmV4Y2x1ZGVHaXRJZ25vcmUjYCBzZXR0aW5nIGZvciBpZ25vcmluZyBmaWxlcyBiYXNlZCBvbiB5b3VyIGAuZ2l0aWdub3JlYC5cIiksXG5cdFx0XHQnZGVmYXVsdCc6IHtcblx0XHRcdFx0Li4ueyAnKiovLmdpdCc6IHRydWUsICcqKi8uc3ZuJzogdHJ1ZSwgJyoqLy5oZyc6IHRydWUsICcqKi8uRFNfU3RvcmUnOiB0cnVlLCAnKiovVGh1bWJzLmRiJzogdHJ1ZSB9LFxuXHRcdFx0XHQuLi4oaXNXZWIgPyB7ICcqKi8qLmNyc3dhcCc6IHRydWUgLyogZmlsdGVyIG91dCBzd2FwIGZpbGVzIHVzZWQgZm9yIGxvY2FsIGZpbGUgYWNjZXNzICovIH0gOiB1bmRlZmluZWQpXG5cdFx0XHR9LFxuXHRcdFx0J3Njb3BlJzogQ29uZmlndXJhdGlvblNjb3BlLlJFU09VUkNFLFxuXHRcdFx0J2FkZGl0aW9uYWxQcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnYW55T2YnOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHQnZW51bSc6IFt0cnVlLCBmYWxzZV0sXG5cdFx0XHRcdFx0XHQnZW51bURlc2NyaXB0aW9ucyc6IFtubHMubG9jYWxpemUoJ3RydWVEZXNjcmlwdGlvbicsIFwiRW5hYmxlIHRoZSBwYXR0ZXJuLlwiKSwgbmxzLmxvY2FsaXplKCdmYWxzZURlc2NyaXB0aW9uJywgXCJEaXNhYmxlIHRoZSBwYXR0ZXJuLlwiKV0sXG5cdFx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBubHMubG9jYWxpemUoJ2ZpbGVzLmV4Y2x1ZGUuYm9vbGVhbicsIFwiVGhlIGdsb2IgcGF0dGVybiB0byBtYXRjaCBmaWxlIHBhdGhzIGFnYWluc3QuIFNldCB0byB0cnVlIG9yIGZhbHNlIHRvIGVuYWJsZSBvciBkaXNhYmxlIHRoZSBwYXR0ZXJuLlwiKSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHRcdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0XHRcdFx0J3doZW4nOiB7XG5cdFx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJywgLy8gZXhwcmVzc2lvbiAoeyBcIioqLyouanNcIjogeyBcIndoZW5cIjogXCIkKGJhc2VuYW1lKS5qc1wiIH0gfSlcblx0XHRcdFx0XHRcdFx0XHQncGF0dGVybic6ICdcXFxcdypcXFxcJFxcXFwoYmFzZW5hbWVcXFxcKVxcXFx3KicsXG5cdFx0XHRcdFx0XHRcdFx0J2RlZmF1bHQnOiAnJChiYXNlbmFtZSkuZXh0Jyxcblx0XHRcdFx0XHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSh7IGtleTogJ2ZpbGVzLmV4Y2x1ZGUud2hlbicsIGNvbW1lbnQ6IFsnXFxcXCQoYmFzZW5hbWUpIHNob3VsZCBub3QgYmUgdHJhbnNsYXRlZCddIH0sIFwiQWRkaXRpb25hbCBjaGVjayBvbiB0aGUgc2libGluZ3Mgb2YgYSBtYXRjaGluZyBmaWxlLiBVc2UgXFxcXCQoYmFzZW5hbWUpIGFzIHZhcmlhYmxlIGZvciB0aGUgbWF0Y2hpbmcgZmlsZSBuYW1lLlwiKVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRbRklMRVNfQVNTT0NJQVRJT05TX0NPTkZJR106IHtcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgnYXNzb2NpYXRpb25zJywgXCJDb25maWd1cmUgW2dsb2IgcGF0dGVybnNdKGh0dHBzOi8vYWthLm1zL3ZzY29kZS1nbG9iLXBhdHRlcm5zKSBvZiBmaWxlIGFzc29jaWF0aW9ucyB0byBsYW5ndWFnZXMgKGZvciBleGFtcGxlIGBcXFwiKi5leHRlbnNpb25cXFwiOiBcXFwiaHRtbFxcXCJgKS4gUGF0dGVybnMgd2lsbCBtYXRjaCBvbiB0aGUgYWJzb2x1dGUgcGF0aCBvZiBhIGZpbGUgaWYgdGhleSBjb250YWluIGEgcGF0aCBzZXBhcmF0b3IgYW5kIHdpbGwgbWF0Y2ggb24gdGhlIG5hbWUgb2YgdGhlIGZpbGUgb3RoZXJ3aXNlLiBUaGVzZSBoYXZlIHByZWNlZGVuY2Ugb3ZlciB0aGUgZGVmYXVsdCBhc3NvY2lhdGlvbnMgb2YgdGhlIGxhbmd1YWdlcyBpbnN0YWxsZWQuXCIpLFxuXHRcdFx0J2FkZGl0aW9uYWxQcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnXG5cdFx0XHR9XG5cdFx0fSxcblx0XHQnZmlsZXMuZW5jb2RpbmcnOiB7XG5cdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0J2VudW0nOiBPYmplY3Qua2V5cyhTVVBQT1JURURfRU5DT0RJTkdTKSxcblx0XHRcdCdkZWZhdWx0JzogJ3V0ZjgnLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdlbmNvZGluZycsIFwiVGhlIGRlZmF1bHQgY2hhcmFjdGVyIHNldCBlbmNvZGluZyB0byB1c2Ugd2hlbiByZWFkaW5nIGFuZCB3cml0aW5nIGZpbGVzLiBUaGlzIHNldHRpbmcgY2FuIGFsc28gYmUgY29uZmlndXJlZCBwZXIgbGFuZ3VhZ2UuXCIpLFxuXHRcdFx0J3Njb3BlJzogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBPYmplY3Qua2V5cyhTVVBQT1JURURfRU5DT0RJTkdTKS5tYXAoa2V5ID0+IFNVUFBPUlRFRF9FTkNPRElOR1Nba2V5XS5sYWJlbExvbmcpLFxuXHRcdFx0J2VudW1JdGVtTGFiZWxzJzogT2JqZWN0LmtleXMoU1VQUE9SVEVEX0VOQ09ESU5HUykubWFwKGtleSA9PiBTVVBQT1JURURfRU5DT0RJTkdTW2tleV0ubGFiZWxMb25nKVxuXHRcdH0sXG5cdFx0J2ZpbGVzLmF1dG9HdWVzc0VuY29kaW5nJzoge1xuXHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHQnZGVmYXVsdCc6IGZhbHNlLFxuXHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBubHMubG9jYWxpemUoJ2F1dG9HdWVzc0VuY29kaW5nJywgXCJXaGVuIGVuYWJsZWQsIHRoZSBlZGl0b3Igd2lsbCBhdHRlbXB0IHRvIGd1ZXNzIHRoZSBjaGFyYWN0ZXIgc2V0IGVuY29kaW5nIHdoZW4gb3BlbmluZyBmaWxlcy4gVGhpcyBzZXR0aW5nIGNhbiBhbHNvIGJlIGNvbmZpZ3VyZWQgcGVyIGxhbmd1YWdlLiBOb3RlLCB0aGlzIHNldHRpbmcgaXMgbm90IHJlc3BlY3RlZCBieSB0ZXh0IHNlYXJjaC4gT25seSB7MH0gaXMgcmVzcGVjdGVkLlwiLCAnYCNmaWxlcy5lbmNvZGluZyNgJyksXG5cdFx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEVcblx0XHR9LFxuXHRcdCdmaWxlcy5jYW5kaWRhdGVHdWVzc0VuY29kaW5ncyc6IHtcblx0XHRcdCd0eXBlJzogJ2FycmF5Jyxcblx0XHRcdCdpdGVtcyc6IHtcblx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0J2VudW0nOiBPYmplY3Qua2V5cyhHVUVTU0FCTEVfRU5DT0RJTkdTKSxcblx0XHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBPYmplY3Qua2V5cyhHVUVTU0FCTEVfRU5DT0RJTkdTKS5tYXAoa2V5ID0+IEdVRVNTQUJMRV9FTkNPRElOR1Nba2V5XS5sYWJlbExvbmcpXG5cdFx0XHR9LFxuXHRcdFx0J2RlZmF1bHQnOiBbXSxcblx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdjYW5kaWRhdGVHdWVzc0VuY29kaW5ncycsIFwiTGlzdCBvZiBjaGFyYWN0ZXIgc2V0IGVuY29kaW5ncyB0aGF0IHRoZSBlZGl0b3Igc2hvdWxkIGF0dGVtcHQgdG8gZ3Vlc3MgaW4gdGhlIG9yZGVyIHRoZXkgYXJlIGxpc3RlZC4gSW4gY2FzZSBpdCBjYW5ub3QgYmUgZGV0ZXJtaW5lZCwgezB9IGlzIHJlc3BlY3RlZFwiLCAnYCNmaWxlcy5lbmNvZGluZyNgJyksXG5cdFx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEVcblx0XHR9LFxuXHRcdCdmaWxlcy5lb2wnOiB7XG5cdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0J2VudW0nOiBbXG5cdFx0XHRcdCdcXG4nLFxuXHRcdFx0XHQnXFxyXFxuJyxcblx0XHRcdFx0J2F1dG8nXG5cdFx0XHRdLFxuXHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnZW9sLkxGJywgXCJMRlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdlb2wuQ1JMRicsIFwiQ1JMRlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdlb2wuYXV0bycsIFwiVXNlcyBvcGVyYXRpbmcgc3lzdGVtIHNwZWNpZmljIGVuZCBvZiBsaW5lIGNoYXJhY3Rlci5cIilcblx0XHRcdF0sXG5cdFx0XHQnZGVmYXVsdCc6ICdhdXRvJyxcblx0XHRcdCdkZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgnZW9sJywgXCJUaGUgZGVmYXVsdCBlbmQgb2YgbGluZSBjaGFyYWN0ZXIuXCIpLFxuXHRcdFx0J3Njb3BlJzogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFXG5cdFx0fSxcblx0XHQnZmlsZXMuZW5hYmxlVHJhc2gnOiB7XG5cdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdCdkZWZhdWx0JzogdHJ1ZSxcblx0XHRcdCdkZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgndXNlVHJhc2gnLCBcIk1vdmVzIGZpbGVzL2ZvbGRlcnMgdG8gdGhlIE9TIHRyYXNoIChyZWN5Y2xlIGJpbiBvbiBXaW5kb3dzKSB3aGVuIGRlbGV0aW5nLiBEaXNhYmxpbmcgdGhpcyB3aWxsIGRlbGV0ZSBmaWxlcy9mb2xkZXJzIHBlcm1hbmVudGx5LlwiKVxuXHRcdH0sXG5cdFx0J2ZpbGVzLnRyaW1UcmFpbGluZ1doaXRlc3BhY2UnOiB7XG5cdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdCdkZWZhdWx0JzogZmFsc2UsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBubHMubG9jYWxpemUoJ3RyaW1UcmFpbGluZ1doaXRlc3BhY2UnLCBcIldoZW4gZW5hYmxlZCwgd2lsbCB0cmltIHRyYWlsaW5nIHdoaXRlc3BhY2Ugd2hlbiBzYXZpbmcgYSBmaWxlLlwiKSxcblx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRVxuXHRcdH0sXG5cdFx0J2ZpbGVzLnRyaW1UcmFpbGluZ1doaXRlc3BhY2VJblJlZ2V4QW5kU3RyaW5ncyc6IHtcblx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCd0cmltVHJhaWxpbmdXaGl0ZXNwYWNlSW5SZWdleEFuZFN0cmluZ3MnLCBcIldoZW4gZW5hYmxlZCwgdHJhaWxpbmcgd2hpdGVzcGFjZSB3aWxsIGJlIHJlbW92ZWQgZnJvbSBtdWx0aWxpbmUgc3RyaW5ncyBhbmQgcmVnZXhlcyB3aWxsIGJlIHJlbW92ZWQgb24gc2F2ZSBvciB3aGVuIGV4ZWN1dGluZyAnZWRpdG9yLmFjdGlvbi50cmltVHJhaWxpbmdXaGl0ZXNwYWNlJy4gVGhpcyBjYW4gY2F1c2Ugd2hpdGVzcGFjZSB0byBub3QgYmUgdHJpbW1lZCBmcm9tIGxpbmVzIHdoZW4gdGhlcmUgaXNuJ3QgdXAtdG8tZGF0ZSB0b2tlbiBpbmZvcm1hdGlvbi5cIiksXG5cdFx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEVcblx0XHR9LFxuXHRcdCdmaWxlcy5pbnNlcnRGaW5hbE5ld2xpbmUnOiB7XG5cdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdCdkZWZhdWx0JzogZmFsc2UsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBubHMubG9jYWxpemUoJ2luc2VydEZpbmFsTmV3bGluZScsIFwiV2hlbiBlbmFibGVkLCBpbnNlcnQgYSBmaW5hbCBuZXcgbGluZSBhdCB0aGUgZW5kIG9mIHRoZSBmaWxlIHdoZW4gc2F2aW5nIGl0LlwiKSxcblx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRVxuXHRcdH0sXG5cdFx0J2ZpbGVzLnRyaW1GaW5hbE5ld2xpbmVzJzoge1xuXHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHQnZGVmYXVsdCc6IGZhbHNlLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCd0cmltRmluYWxOZXdsaW5lcycsIFwiV2hlbiBlbmFibGVkLCB3aWxsIHRyaW0gYWxsIG5ldyBsaW5lcyBhZnRlciB0aGUgZmluYWwgbmV3IGxpbmUgYXQgdGhlIGVuZCBvZiB0aGUgZmlsZSB3aGVuIHNhdmluZyBpdC5cIiksXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdH0sXG5cdFx0J2ZpbGVzLmF1dG9TYXZlJzoge1xuXHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdCdlbnVtJzogW0F1dG9TYXZlQ29uZmlndXJhdGlvbi5PRkYsIEF1dG9TYXZlQ29uZmlndXJhdGlvbi5BRlRFUl9ERUxBWSwgQXV0b1NhdmVDb25maWd1cmF0aW9uLk9OX0ZPQ1VTX0NIQU5HRSwgQXV0b1NhdmVDb25maWd1cmF0aW9uLk9OX1dJTkRPV19DSEFOR0VdLFxuXHRcdFx0J21hcmtkb3duRW51bURlc2NyaXB0aW9ucyc6IFtcblx0XHRcdFx0bmxzLmxvY2FsaXplKHsgY29tbWVudDogWydUaGlzIGlzIHRoZSBkZXNjcmlwdGlvbiBmb3IgYSBzZXR0aW5nLiBWYWx1ZXMgc3Vycm91bmRlZCBieSBzaW5nbGUgcXVvdGVzIGFyZSBub3QgdG8gYmUgdHJhbnNsYXRlZC4nXSwga2V5OiAnZmlsZXMuYXV0b1NhdmUub2ZmJyB9LCBcIkFuIGVkaXRvciB3aXRoIGNoYW5nZXMgaXMgbmV2ZXIgYXV0b21hdGljYWxseSBzYXZlZC5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSh7IGNvbW1lbnQ6IFsnVGhpcyBpcyB0aGUgZGVzY3JpcHRpb24gZm9yIGEgc2V0dGluZy4gVmFsdWVzIHN1cnJvdW5kZWQgYnkgc2luZ2xlIHF1b3RlcyBhcmUgbm90IHRvIGJlIHRyYW5zbGF0ZWQuJ10sIGtleTogJ2ZpbGVzLmF1dG9TYXZlLmFmdGVyRGVsYXknIH0sIFwiQW4gZWRpdG9yIHdpdGggY2hhbmdlcyBpcyBhdXRvbWF0aWNhbGx5IHNhdmVkIGFmdGVyIHRoZSBjb25maWd1cmVkIGAjZmlsZXMuYXV0b1NhdmVEZWxheSNgLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKHsgY29tbWVudDogWydUaGlzIGlzIHRoZSBkZXNjcmlwdGlvbiBmb3IgYSBzZXR0aW5nLiBWYWx1ZXMgc3Vycm91bmRlZCBieSBzaW5nbGUgcXVvdGVzIGFyZSBub3QgdG8gYmUgdHJhbnNsYXRlZC4nXSwga2V5OiAnZmlsZXMuYXV0b1NhdmUub25Gb2N1c0NoYW5nZScgfSwgXCJBbiBlZGl0b3Igd2l0aCBjaGFuZ2VzIGlzIGF1dG9tYXRpY2FsbHkgc2F2ZWQgd2hlbiB0aGUgZWRpdG9yIGxvc2VzIGZvY3VzLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKHsgY29tbWVudDogWydUaGlzIGlzIHRoZSBkZXNjcmlwdGlvbiBmb3IgYSBzZXR0aW5nLiBWYWx1ZXMgc3Vycm91bmRlZCBieSBzaW5nbGUgcXVvdGVzIGFyZSBub3QgdG8gYmUgdHJhbnNsYXRlZC4nXSwga2V5OiAnZmlsZXMuYXV0b1NhdmUub25XaW5kb3dDaGFuZ2UnIH0sIFwiQW4gZWRpdG9yIHdpdGggY2hhbmdlcyBpcyBhdXRvbWF0aWNhbGx5IHNhdmVkIHdoZW4gdGhlIHdpbmRvdyBsb3NlcyBmb2N1cy5cIilcblx0XHRcdF0sXG5cdFx0XHQnZGVmYXVsdCc6IGlzV2ViID8gQXV0b1NhdmVDb25maWd1cmF0aW9uLkFGVEVSX0RFTEFZIDogQXV0b1NhdmVDb25maWd1cmF0aW9uLk9GRixcblx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKHsgY29tbWVudDogWydUaGlzIGlzIHRoZSBkZXNjcmlwdGlvbiBmb3IgYSBzZXR0aW5nLiBWYWx1ZXMgc3Vycm91bmRlZCBieSBzaW5nbGUgcXVvdGVzIGFyZSBub3QgdG8gYmUgdHJhbnNsYXRlZC4nXSwga2V5OiAnYXV0b1NhdmUnIH0sIFwiQ29udHJvbHMgW2F1dG8gc2F2ZV0oaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vZG9jcy9lZGl0b3IvY29kZWJhc2ljcyNfc2F2ZS1hdXRvLXNhdmUpIG9mIGVkaXRvcnMgdGhhdCBoYXZlIHVuc2F2ZWQgY2hhbmdlcy5cIiwgQXV0b1NhdmVDb25maWd1cmF0aW9uLk9GRiwgQXV0b1NhdmVDb25maWd1cmF0aW9uLkFGVEVSX0RFTEFZLCBBdXRvU2F2ZUNvbmZpZ3VyYXRpb24uT05fRk9DVVNfQ0hBTkdFLCBBdXRvU2F2ZUNvbmZpZ3VyYXRpb24uT05fV0lORE9XX0NIQU5HRSwgQXV0b1NhdmVDb25maWd1cmF0aW9uLkFGVEVSX0RFTEFZKSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEVcblx0XHR9LFxuXHRcdCdmaWxlcy5hdXRvU2F2ZURlbGF5Jzoge1xuXHRcdFx0J3R5cGUnOiAnbnVtYmVyJyxcblx0XHRcdCdkZWZhdWx0JzogMTAwMCxcblx0XHRcdCdtaW5pbXVtJzogMCxcblx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKHsgY29tbWVudDogWydUaGlzIGlzIHRoZSBkZXNjcmlwdGlvbiBmb3IgYSBzZXR0aW5nLiBWYWx1ZXMgc3Vycm91bmRlZCBieSBzaW5nbGUgcXVvdGVzIGFyZSBub3QgdG8gYmUgdHJhbnNsYXRlZC4nXSwga2V5OiAnYXV0b1NhdmVEZWxheScgfSwgXCJDb250cm9scyB0aGUgZGVsYXkgaW4gbWlsbGlzZWNvbmRzIGFmdGVyIHdoaWNoIGFuIGVkaXRvciB3aXRoIHVuc2F2ZWQgY2hhbmdlcyBpcyBzYXZlZCBhdXRvbWF0aWNhbGx5LiBPbmx5IGFwcGxpZXMgd2hlbiBgI2ZpbGVzLmF1dG9TYXZlI2AgaXMgc2V0IHRvIGB7MH1gLlwiLCBBdXRvU2F2ZUNvbmZpZ3VyYXRpb24uQUZURVJfREVMQVkpLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRVxuXHRcdH0sXG5cdFx0J2ZpbGVzLmF1dG9TYXZlV29ya3NwYWNlRmlsZXNPbmx5Jzoge1xuXHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHQnZGVmYXVsdCc6IGZhbHNlLFxuXHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBubHMubG9jYWxpemUoJ2F1dG9TYXZlV29ya3NwYWNlRmlsZXNPbmx5JywgXCJXaGVuIGVuYWJsZWQsIHdpbGwgbGltaXQgW2F1dG8gc2F2ZV0oaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vZG9jcy9lZGl0b3IvY29kZWJhc2ljcyNfc2F2ZS1hdXRvLXNhdmUpIG9mIGVkaXRvcnMgdG8gZmlsZXMgdGhhdCBhcmUgaW5zaWRlIHRoZSBvcGVuZWQgd29ya3NwYWNlLiBPbmx5IGFwcGxpZXMgd2hlbiB7MH0gaXMgZW5hYmxlZC5cIiwgJ2AjZmlsZXMuYXV0b1NhdmUjYCcpLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRVxuXHRcdH0sXG5cdFx0J2ZpbGVzLmF1dG9TYXZlV2hlbk5vRXJyb3JzJzoge1xuXHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHQnZGVmYXVsdCc6IGZhbHNlLFxuXHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBubHMubG9jYWxpemUoJ2F1dG9TYXZlV2hlbk5vRXJyb3JzJywgXCJXaGVuIGVuYWJsZWQsIHdpbGwgbGltaXQgW2F1dG8gc2F2ZV0oaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vZG9jcy9lZGl0b3IvY29kZWJhc2ljcyNfc2F2ZS1hdXRvLXNhdmUpIG9mIGVkaXRvcnMgdG8gZmlsZXMgdGhhdCBoYXZlIG5vIGVycm9ycyByZXBvcnRlZCBpbiB0aGVtIGF0IHRoZSB0aW1lIHRoZSBhdXRvIHNhdmUgaXMgdHJpZ2dlcmVkLiBPbmx5IGFwcGxpZXMgd2hlbiB7MH0gaXMgZW5hYmxlZC5cIiwgJ2AjZmlsZXMuYXV0b1NhdmUjYCcpLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRVxuXHRcdH0sXG5cdFx0J2ZpbGVzLndhdGNoZXJFeGNsdWRlJzoge1xuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdwYXR0ZXJuUHJvcGVydGllcyc6IHtcblx0XHRcdFx0Jy4qJzogeyAndHlwZSc6ICdib29sZWFuJyB9XG5cdFx0XHR9LFxuXHRcdFx0J2RlZmF1bHQnOiB7ICcqKi8uZ2l0L29iamVjdHMvKionOiB0cnVlLCAnKiovLmdpdC9zdWJ0cmVlLWNhY2hlLyoqJzogdHJ1ZSwgJyoqLy5oZy9zdG9yZS8qKic6IHRydWUgfSxcblx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCd3YXRjaGVyRXhjbHVkZScsIFwiQ29uZmlndXJlIHBhdGhzIG9yIFtnbG9iIHBhdHRlcm5zXShodHRwczovL2FrYS5tcy92c2NvZGUtZ2xvYi1wYXR0ZXJucykgdG8gZXhjbHVkZSBmcm9tIGZpbGUgd2F0Y2hpbmcuIFBhdGhzIGNhbiBlaXRoZXIgYmUgcmVsYXRpdmUgdG8gdGhlIHdhdGNoZWQgZm9sZGVyIG9yIGFic29sdXRlLiBHbG9iIHBhdHRlcm5zIGFyZSBtYXRjaGVkIHJlbGF0aXZlIGZyb20gdGhlIHdhdGNoZWQgZm9sZGVyLiBXaGVuIHlvdSBleHBlcmllbmNlIHRoZSBmaWxlIHdhdGNoZXIgcHJvY2VzcyBjb25zdW1pbmcgYSBsb3Qgb2YgQ1BVLCBtYWtlIHN1cmUgdG8gZXhjbHVkZSBsYXJnZSBmb2xkZXJzIHRoYXQgYXJlIG9mIGxlc3MgaW50ZXJlc3QgKHN1Y2ggYXMgYnVpbGQgb3V0cHV0IGZvbGRlcnMpLlwiKSxcblx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5SRVNPVVJDRVxuXHRcdH0sXG5cdFx0J2ZpbGVzLndhdGNoZXJJbmNsdWRlJzoge1xuXHRcdFx0J3R5cGUnOiAnYXJyYXknLFxuXHRcdFx0J2l0ZW1zJzoge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnXG5cdFx0XHR9LFxuXHRcdFx0J2RlZmF1bHQnOiBbXSxcblx0XHRcdCdkZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgnd2F0Y2hlckluY2x1ZGUnLCBcIkNvbmZpZ3VyZSBleHRyYSBwYXRocyB0byB3YXRjaCBmb3IgY2hhbmdlcyBpbnNpZGUgdGhlIHdvcmtzcGFjZS4gQnkgZGVmYXVsdCwgYWxsIHdvcmtzcGFjZSBmb2xkZXJzIHdpbGwgYmUgd2F0Y2hlZCByZWN1cnNpdmVseSwgZXhjZXB0IGZvciBmb2xkZXJzIHRoYXQgYXJlIHN5bWJvbGljIGxpbmtzLiBZb3UgY2FuIGV4cGxpY2l0bHkgYWRkIGFic29sdXRlIG9yIHJlbGF0aXZlIHBhdGhzIHRvIHN1cHBvcnQgd2F0Y2hpbmcgZm9sZGVycyB0aGF0IGFyZSBzeW1ib2xpYyBsaW5rcy4gUmVsYXRpdmUgcGF0aHMgd2lsbCBiZSByZXNvbHZlZCB0byBhbiBhYnNvbHV0ZSBwYXRoIHVzaW5nIHRoZSBjdXJyZW50bHkgb3BlbmVkIHdvcmtzcGFjZS5cIiksXG5cdFx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuUkVTT1VSQ0Vcblx0XHR9LFxuXHRcdCdmaWxlcy5ob3RFeGl0JzogaG90RXhpdENvbmZpZ3VyYXRpb24sXG5cdFx0J2ZpbGVzLmRlZmF1bHRMYW5ndWFnZSc6IHtcblx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgnZGVmYXVsdExhbmd1YWdlJywgXCJUaGUgZGVmYXVsdCBsYW5ndWFnZSBpZGVudGlmaWVyIHRoYXQgaXMgYXNzaWduZWQgdG8gbmV3IGZpbGVzLiBJZiBjb25maWd1cmVkIHRvIGAke2FjdGl2ZUVkaXRvckxhbmd1YWdlfWAsIHdpbGwgdXNlIHRoZSBsYW5ndWFnZSBpZGVudGlmaWVyIG9mIHRoZSBjdXJyZW50bHkgYWN0aXZlIHRleHQgZWRpdG9yIGlmIGFueS5cIilcblx0XHR9LFxuXHRcdFtGSUxFU19SRUFET05MWV9JTkNMVURFX0NPTkZJR106IHtcblx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHQncGF0dGVyblByb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCcuKic6IHsgJ3R5cGUnOiAnYm9vbGVhbicgfVxuXHRcdFx0fSxcblx0XHRcdCdkZWZhdWx0Jzoge30sXG5cdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgnZmlsZXNSZWFkb25seUluY2x1ZGUnLCBcIkNvbmZpZ3VyZSBwYXRocyBvciBbZ2xvYiBwYXR0ZXJuc10oaHR0cHM6Ly9ha2EubXMvdnNjb2RlLWdsb2ItcGF0dGVybnMpIHRvIG1hcmsgYXMgcmVhZC1vbmx5LiBHbG9iIHBhdHRlcm5zIGFyZSBhbHdheXMgZXZhbHVhdGVkIHJlbGF0aXZlIHRvIHRoZSBwYXRoIG9mIHRoZSB3b3Jrc3BhY2UgZm9sZGVyIHVubGVzcyB0aGV5IGFyZSBhYnNvbHV0ZSBwYXRocy4gWW91IGNhbiBleGNsdWRlIG1hdGNoaW5nIHBhdGhzIHZpYSB0aGUgYCNmaWxlcy5yZWFkb25seUV4Y2x1ZGUjYCBzZXR0aW5nLiBGaWxlcyBmcm9tIHJlYWRvbmx5IGZpbGUgc3lzdGVtIHByb3ZpZGVycyB3aWxsIGFsd2F5cyBiZSByZWFkLW9ubHkgaW5kZXBlbmRlbnQgb2YgdGhpcyBzZXR0aW5nLlwiKSxcblx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5SRVNPVVJDRVxuXHRcdH0sXG5cdFx0W0ZJTEVTX1JFQURPTkxZX0VYQ0xVREVfQ09ORklHXToge1xuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdwYXR0ZXJuUHJvcGVydGllcyc6IHtcblx0XHRcdFx0Jy4qJzogeyAndHlwZSc6ICdib29sZWFuJyB9XG5cdFx0XHR9LFxuXHRcdFx0J2RlZmF1bHQnOiB7fSxcblx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdmaWxlc1JlYWRvbmx5RXhjbHVkZScsIFwiQ29uZmlndXJlIHBhdGhzIG9yIFtnbG9iIHBhdHRlcm5zXShodHRwczovL2FrYS5tcy92c2NvZGUtZ2xvYi1wYXR0ZXJucykgdG8gZXhjbHVkZSBmcm9tIGJlaW5nIG1hcmtlZCBhcyByZWFkLW9ubHkgaWYgdGhleSBtYXRjaCBhcyBhIHJlc3VsdCBvZiB0aGUgYCNmaWxlcy5yZWFkb25seUluY2x1ZGUjYCBzZXR0aW5nLiBHbG9iIHBhdHRlcm5zIGFyZSBhbHdheXMgZXZhbHVhdGVkIHJlbGF0aXZlIHRvIHRoZSBwYXRoIG9mIHRoZSB3b3Jrc3BhY2UgZm9sZGVyIHVubGVzcyB0aGV5IGFyZSBhYnNvbHV0ZSBwYXRocy4gRmlsZXMgZnJvbSByZWFkb25seSBmaWxlIHN5c3RlbSBwcm92aWRlcnMgd2lsbCBhbHdheXMgYmUgcmVhZC1vbmx5IGluZGVwZW5kZW50IG9mIHRoaXMgc2V0dGluZy5cIiksXG5cdFx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuUkVTT1VSQ0Vcblx0XHR9LFxuXHRcdFtGSUxFU19SRUFET05MWV9GUk9NX1BFUk1JU1NJT05TX0NPTkZJR106IHtcblx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBubHMubG9jYWxpemUoJ2ZpbGVzUmVhZG9ubHlGcm9tUGVybWlzc2lvbnMnLCBcIk1hcmtzIGZpbGVzIGFzIHJlYWQtb25seSB3aGVuIHRoZWlyIGZpbGUgcGVybWlzc2lvbnMgaW5kaWNhdGUgYXMgc3VjaC4gVGhpcyBjYW4gYmUgb3ZlcnJpZGRlbiB2aWEgYCNmaWxlcy5yZWFkb25seUluY2x1ZGUjYCBhbmQgYCNmaWxlcy5yZWFkb25seUV4Y2x1ZGUjYCBzZXR0aW5ncy5cIiksXG5cdFx0XHQnZGVmYXVsdCc6IGZhbHNlXG5cdFx0fSxcblx0XHQnZmlsZXMucmVzdG9yZVVuZG9TdGFjayc6IHtcblx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdmaWxlcy5yZXN0b3JlVW5kb1N0YWNrJywgXCJSZXN0b3JlIHRoZSB1bmRvIHN0YWNrIHdoZW4gYSBmaWxlIGlzIHJlb3BlbmVkLlwiKSxcblx0XHRcdCdkZWZhdWx0JzogdHJ1ZVxuXHRcdH0sXG5cdFx0J2ZpbGVzLnNhdmVDb25mbGljdFJlc29sdXRpb24nOiB7XG5cdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0J2VudW0nOiBbXG5cdFx0XHRcdCdhc2tVc2VyJyxcblx0XHRcdFx0J292ZXJ3cml0ZUZpbGVPbkRpc2snXG5cdFx0XHRdLFxuXHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnYXNrVXNlcicsIFwiV2lsbCByZWZ1c2UgdG8gc2F2ZSBhbmQgYXNrIGZvciByZXNvbHZpbmcgdGhlIHNhdmUgY29uZmxpY3QgbWFudWFsbHkuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ292ZXJ3cml0ZUZpbGVPbkRpc2snLCBcIldpbGwgcmVzb2x2ZSB0aGUgc2F2ZSBjb25mbGljdCBieSBvdmVyd3JpdGluZyB0aGUgZmlsZSBvbiBkaXNrIHdpdGggdGhlIGNoYW5nZXMgaW4gdGhlIGVkaXRvci5cIilcblx0XHRcdF0sXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBubHMubG9jYWxpemUoJ2ZpbGVzLnNhdmVDb25mbGljdFJlc29sdXRpb24nLCBcIkEgc2F2ZSBjb25mbGljdCBjYW4gb2NjdXIgd2hlbiBhIGZpbGUgaXMgc2F2ZWQgdG8gZGlzayB0aGF0IHdhcyBjaGFuZ2VkIGJ5IGFub3RoZXIgcHJvZ3JhbSBpbiB0aGUgbWVhbnRpbWUuIFRvIHByZXZlbnQgZGF0YSBsb3NzLCB0aGUgdXNlciBpcyBhc2tlZCB0byBjb21wYXJlIHRoZSBjaGFuZ2VzIGluIHRoZSBlZGl0b3Igd2l0aCB0aGUgdmVyc2lvbiBvbiBkaXNrLiBUaGlzIHNldHRpbmcgc2hvdWxkIG9ubHkgYmUgY2hhbmdlZCBpZiB5b3UgZnJlcXVlbnRseSBlbmNvdW50ZXIgc2F2ZSBjb25mbGljdCBlcnJvcnMgYW5kIG1heSByZXN1bHQgaW4gZGF0YSBsb3NzIGlmIHVzZWQgd2l0aG91dCBjYXV0aW9uLlwiKSxcblx0XHRcdCdkZWZhdWx0JzogJ2Fza1VzZXInLFxuXHRcdFx0J3Njb3BlJzogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFXG5cdFx0fSxcblx0XHQnZmlsZXMuZGlhbG9nLmRlZmF1bHRQYXRoJzoge1xuXHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdCdwYXR0ZXJuJzogJ14oKFxcXFwvfFxcXFxcXFxcXFxcXFxcXFx8W2EtekEtWl06XFxcXFxcXFwpLiopPyQnLCAvLyBzbGFzaCBPUiBVTkMtcm9vdCBPUiBkcml2ZS1yb290IE9SIHVuZGVmaW5lZFxuXHRcdFx0J3BhdHRlcm5FcnJvck1lc3NhZ2UnOiBubHMubG9jYWxpemUoJ2RlZmF1bHRQYXRoRXJyb3JNZXNzYWdlJywgXCJEZWZhdWx0IHBhdGggZm9yIGZpbGUgZGlhbG9ncyBtdXN0IGJlIGFuIGFic29sdXRlIHBhdGggKGUuZy4gQzpcXFxcXFxcXG15Rm9sZGVyIG9yIC9teUZvbGRlcikuXCIpLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdmaWxlRGlhbG9nRGVmYXVsdFBhdGgnLCBcIkRlZmF1bHQgcGF0aCBmb3IgZmlsZSBkaWFsb2dzLCBvdmVycmlkaW5nIHVzZXIncyBob21lIHBhdGguIE9ubHkgdXNlZCBpbiB0aGUgYWJzZW5jZSBvZiBhIGNvbnRleHQtc3BlY2lmaWMgcGF0aCwgc3VjaCBhcyBtb3N0IHJlY2VudGx5IG9wZW5lZCBmaWxlIG9yIGZvbGRlci5cIiksXG5cdFx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuTUFDSElORVxuXHRcdH0sXG5cdFx0J2ZpbGVzLnNpbXBsZURpYWxvZy5lbmFibGUnOiB7XG5cdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdCdkZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgnZmlsZXMuc2ltcGxlRGlhbG9nLmVuYWJsZScsIFwiRW5hYmxlcyB0aGUgc2ltcGxlIGZpbGUgZGlhbG9nIGZvciBvcGVuaW5nIGFuZCBzYXZpbmcgZmlsZXMgYW5kIGZvbGRlcnMuIFRoZSBzaW1wbGUgZmlsZSBkaWFsb2cgcmVwbGFjZXMgdGhlIHN5c3RlbSBmaWxlIGRpYWxvZyB3aGVuIGVuYWJsZWQuXCIpLFxuXHRcdFx0J2RlZmF1bHQnOiBmYWxzZVxuXHRcdH0sXG5cdFx0J2ZpbGVzLnBhcnRpY2lwYW50cy50aW1lb3V0Jzoge1xuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRkZWZhdWx0OiA2MDAwMCxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZmlsZXMucGFydGljaXBhbnRzLnRpbWVvdXQnLCBcIlRpbWVvdXQgaW4gbWlsbGlzZWNvbmRzIGFmdGVyIHdoaWNoIGZpbGUgcGFydGljaXBhbnRzIGZvciBjcmVhdGUsIHJlbmFtZSwgYW5kIGRlbGV0ZSBhcmUgY2FuY2VsbGVkLiBVc2UgYDBgIHRvIGRpc2FibGUgcGFydGljaXBhbnRzLlwiKSxcblx0XHR9XG5cdH1cbn0pO1xuXG5jb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0Li4uZWRpdG9yQ29uZmlndXJhdGlvbkJhc2VOb2RlLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0J2VkaXRvci5mb3JtYXRPblNhdmUnOiB7XG5cdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdmb3JtYXRPblNhdmUnLCBcIkZvcm1hdCBhIGZpbGUgb24gc2F2ZS4gQSBmb3JtYXR0ZXIgbXVzdCBiZSBhdmFpbGFibGUgYW5kIHRoZSBlZGl0b3IgbXVzdCBub3QgYmUgc2h1dHRpbmcgZG93bi4gV2hlbiB7MH0gaXMgc2V0IHRvIGBhZnRlckRlbGF5YCwgdGhlIGZpbGUgd2lsbCBvbmx5IGJlIGZvcm1hdHRlZCB3aGVuIHNhdmVkIGV4cGxpY2l0bHkuXCIsICdgI2ZpbGVzLmF1dG9TYXZlI2AnKSxcblx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHR9LFxuXHRcdCdlZGl0b3IuZm9ybWF0T25TYXZlTW9kZSc6IHtcblx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHQnZGVmYXVsdCc6ICdmaWxlJyxcblx0XHRcdCdlbnVtJzogW1xuXHRcdFx0XHQnZmlsZScsXG5cdFx0XHRcdCdtb2RpZmljYXRpb25zJyxcblx0XHRcdFx0J21vZGlmaWNhdGlvbnNJZkF2YWlsYWJsZSdcblx0XHRcdF0sXG5cdFx0XHQnZW51bURlc2NyaXB0aW9ucyc6IFtcblx0XHRcdFx0bmxzLmxvY2FsaXplKHsga2V5OiAnZXZlcnl0aGluZycsIGNvbW1lbnQ6IFsnVGhpcyBpcyB0aGUgZGVzY3JpcHRpb24gb2YgYW4gb3B0aW9uJ10gfSwgXCJGb3JtYXQgdGhlIHdob2xlIGZpbGUuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoeyBrZXk6ICdtb2RpZmljYXRpb24nLCBjb21tZW50OiBbJ1RoaXMgaXMgdGhlIGRlc2NyaXB0aW9uIG9mIGFuIG9wdGlvbiddIH0sIFwiRm9ybWF0IG1vZGlmaWNhdGlvbnMgKHJlcXVpcmVzIHNvdXJjZSBjb250cm9sKS5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSh7IGtleTogJ21vZGlmaWNhdGlvbklmQXZhaWxhYmxlJywgY29tbWVudDogWydUaGlzIGlzIHRoZSBkZXNjcmlwdGlvbiBvZiBhbiBvcHRpb24nXSB9LCBcIldpbGwgYXR0ZW1wdCB0byBmb3JtYXQgbW9kaWZpY2F0aW9ucyBvbmx5IChyZXF1aXJlcyBzb3VyY2UgY29udHJvbCkuIElmIHNvdXJjZSBjb250cm9sIGNhbid0IGJlIHVzZWQsIHRoZW4gdGhlIHdob2xlIGZpbGUgd2lsbCBiZSBmb3JtYXR0ZWQuXCIpLFxuXHRcdFx0XSxcblx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdmb3JtYXRPblNhdmVNb2RlJywgXCJDb250cm9scyBpZiBmb3JtYXQgb24gc2F2ZSBmb3JtYXRzIHRoZSB3aG9sZSBmaWxlIG9yIG9ubHkgbW9kaWZpY2F0aW9ucy4gT25seSBhcHBsaWVzIHdoZW4gYCNlZGl0b3IuZm9ybWF0T25TYXZlI2AgaXMgZW5hYmxlZC5cIiksXG5cdFx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0fSxcblx0fVxufSk7XG5cbmNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHQnaWQnOiAnZXhwbG9yZXInLFxuXHQnb3JkZXInOiAxMCxcblx0J3RpdGxlJzogbmxzLmxvY2FsaXplKCdleHBsb3JlckNvbmZpZ3VyYXRpb25UaXRsZScsIFwiRmlsZSBFeHBsb3JlclwiKSxcblx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0J2V4cGxvcmVyLm9wZW5FZGl0b3JzLnZpc2libGUnOiB7XG5cdFx0XHQndHlwZSc6ICdudW1iZXInLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKHsga2V5OiAnb3BlbkVkaXRvcnNWaXNpYmxlJywgY29tbWVudDogWydPcGVuIGlzIGFuIGFkamVjdGl2ZSddIH0sIFwiVGhlIGluaXRpYWwgbWF4aW11bSBudW1iZXIgb2YgZWRpdG9ycyBzaG93biBpbiB0aGUgT3BlbiBFZGl0b3JzIHBhbmUuIEV4Y2VlZGluZyB0aGlzIGxpbWl0IHdpbGwgc2hvdyBhIHNjcm9sbCBiYXIgYW5kIGFsbG93IHJlc2l6aW5nIHRoZSBwYW5lIHRvIGRpc3BsYXkgbW9yZSBpdGVtcy5cIiksXG5cdFx0XHQnZGVmYXVsdCc6IDksXG5cdFx0XHQnbWluaW11bSc6IDFcblx0XHR9LFxuXHRcdCdleHBsb3Jlci5vcGVuRWRpdG9ycy5taW5WaXNpYmxlJzoge1xuXHRcdFx0J3R5cGUnOiAnbnVtYmVyJyxcblx0XHRcdCdkZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSh7IGtleTogJ29wZW5FZGl0b3JzVmlzaWJsZU1pbicsIGNvbW1lbnQ6IFsnT3BlbiBpcyBhbiBhZGplY3RpdmUnXSB9LCBcIlRoZSBtaW5pbXVtIG51bWJlciBvZiBlZGl0b3Igc2xvdHMgcHJlLWFsbG9jYXRlZCBpbiB0aGUgT3BlbiBFZGl0b3JzIHBhbmUuIElmIHNldCB0byAwIHRoZSBPcGVuIEVkaXRvcnMgcGFuZSB3aWxsIGR5bmFtaWNhbGx5IHJlc2l6ZSBiYXNlZCBvbiB0aGUgbnVtYmVyIG9mIGVkaXRvcnMuXCIpLFxuXHRcdFx0J2RlZmF1bHQnOiAwLFxuXHRcdFx0J21pbmltdW0nOiAwXG5cdFx0fSxcblx0XHQnZXhwbG9yZXIub3BlbkVkaXRvcnMuc29ydE9yZGVyJzoge1xuXHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdCdlbnVtJzogWydlZGl0b3JPcmRlcicsICdhbHBoYWJldGljYWwnLCAnZnVsbFBhdGgnXSxcblx0XHRcdCdkZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSh7IGtleTogJ29wZW5FZGl0b3JzU29ydE9yZGVyJywgY29tbWVudDogWydPcGVuIGlzIGFuIGFkamVjdGl2ZSddIH0sIFwiQ29udHJvbHMgdGhlIHNvcnRpbmcgb3JkZXIgb2YgZWRpdG9ycyBpbiB0aGUgT3BlbiBFZGl0b3JzIHBhbmUuXCIpLFxuXHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc29ydE9yZGVyLmVkaXRvck9yZGVyJywgJ0VkaXRvcnMgYXJlIG9yZGVyZWQgaW4gdGhlIHNhbWUgb3JkZXIgZWRpdG9yIHRhYnMgYXJlIHNob3duLicpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3NvcnRPcmRlci5hbHBoYWJldGljYWwnLCAnRWRpdG9ycyBhcmUgb3JkZXJlZCBhbHBoYWJldGljYWxseSBieSB0YWIgbmFtZSBpbnNpZGUgZWFjaCBlZGl0b3IgZ3JvdXAuJyksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc29ydE9yZGVyLmZ1bGxQYXRoJywgJ0VkaXRvcnMgYXJlIG9yZGVyZWQgYWxwaGFiZXRpY2FsbHkgYnkgZnVsbCBwYXRoIGluc2lkZSBlYWNoIGVkaXRvciBncm91cC4nKVxuXHRcdFx0XSxcblx0XHRcdCdkZWZhdWx0JzogJ2VkaXRvck9yZGVyJ1xuXHRcdH0sXG5cdFx0J2V4cGxvcmVyLmF1dG9SZXZlYWwnOiB7XG5cdFx0XHQndHlwZSc6IFsnYm9vbGVhbicsICdzdHJpbmcnXSxcblx0XHRcdCdlbnVtJzogW3RydWUsIGZhbHNlLCAnZm9jdXNOb1Njcm9sbCddLFxuXHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnYXV0b1JldmVhbC5vbicsICdGaWxlcyB3aWxsIGJlIHJldmVhbGVkIGFuZCBzZWxlY3RlZC4nKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdhdXRvUmV2ZWFsLm9mZicsICdGaWxlcyB3aWxsIG5vdCBiZSByZXZlYWxlZCBhbmQgc2VsZWN0ZWQuJyksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnYXV0b1JldmVhbC5mb2N1c05vU2Nyb2xsJywgJ0ZpbGVzIHdpbGwgbm90IGJlIHNjcm9sbGVkIGludG8gdmlldywgYnV0IHdpbGwgc3RpbGwgYmUgZm9jdXNlZC4nKSxcblx0XHRcdF0sXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBubHMubG9jYWxpemUoJ2F1dG9SZXZlYWwnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIEV4cGxvcmVyIHNob3VsZCBhdXRvbWF0aWNhbGx5IHJldmVhbCBhbmQgc2VsZWN0IGZpbGVzIHdoZW4gb3BlbmluZyB0aGVtLlwiKVxuXHRcdH0sXG5cdFx0J2V4cGxvcmVyLmF1dG9SZXZlYWxFeGNsdWRlJzoge1xuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdhdXRvUmV2ZWFsRXhjbHVkZScsIFwiQ29uZmlndXJlIHBhdGhzIG9yIFtnbG9iIHBhdHRlcm5zXShodHRwczovL2FrYS5tcy92c2NvZGUtZ2xvYi1wYXR0ZXJucykgZm9yIGV4Y2x1ZGluZyBmaWxlcyBhbmQgZm9sZGVycyBmcm9tIGJlaW5nIHJldmVhbGVkIGFuZCBzZWxlY3RlZCBpbiB0aGUgRXhwbG9yZXIgd2hlbiB0aGV5IGFyZSBvcGVuZWQuIEdsb2IgcGF0dGVybnMgYXJlIGFsd2F5cyBldmFsdWF0ZWQgcmVsYXRpdmUgdG8gdGhlIHBhdGggb2YgdGhlIHdvcmtzcGFjZSBmb2xkZXIgdW5sZXNzIHRoZXkgYXJlIGFic29sdXRlIHBhdGhzLlwiKSxcblx0XHRcdCdkZWZhdWx0JzogeyAnKiovbm9kZV9tb2R1bGVzJzogdHJ1ZSwgJyoqL2Jvd2VyX2NvbXBvbmVudHMnOiB0cnVlIH0sXG5cdFx0XHQnYWRkaXRpb25hbFByb3BlcnRpZXMnOiB7XG5cdFx0XHRcdCdhbnlPZic6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgnZXhwbG9yZXIuYXV0b1JldmVhbEV4Y2x1ZGUuYm9vbGVhbicsIFwiVGhlIGdsb2IgcGF0dGVybiB0byBtYXRjaCBmaWxlIHBhdGhzIGFnYWluc3QuIFNldCB0byB0cnVlIG9yIGZhbHNlIHRvIGVuYWJsZSBvciBkaXNhYmxlIHRoZSBwYXR0ZXJuLlwiKSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHR3aGVuOiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsIC8vIGV4cHJlc3Npb24gKHsgXCIqKi8qLmpzXCI6IHsgXCJ3aGVuXCI6IFwiJChiYXNlbmFtZSkuanNcIiB9IH0pXG5cdFx0XHRcdFx0XHRcdFx0cGF0dGVybjogJ1xcXFx3KlxcXFwkXFxcXChiYXNlbmFtZVxcXFwpXFxcXHcqJyxcblx0XHRcdFx0XHRcdFx0XHRkZWZhdWx0OiAnJChiYXNlbmFtZSkuZXh0Jyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdleHBsb3Jlci5hdXRvUmV2ZWFsRXhjbHVkZS53aGVuJywgJ0FkZGl0aW9uYWwgY2hlY2sgb24gdGhlIHNpYmxpbmdzIG9mIGEgbWF0Y2hpbmcgZmlsZS4gVXNlICQoYmFzZW5hbWUpIGFzIHZhcmlhYmxlIGZvciB0aGUgbWF0Y2hpbmcgZmlsZSBuYW1lLicpXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHR9LFxuXHRcdCdleHBsb3Jlci5lbmFibGVEcmFnQW5kRHJvcCc6IHtcblx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdlbmFibGVEcmFnQW5kRHJvcCcsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgRXhwbG9yZXIgc2hvdWxkIGFsbG93IHRvIG1vdmUgZmlsZXMgYW5kIGZvbGRlcnMgdmlhIGRyYWcgYW5kIGRyb3AuIFRoaXMgc2V0dGluZyBvbmx5IGVmZmVjdHMgZHJhZyBhbmQgZHJvcCBmcm9tIGluc2lkZSB0aGUgRXhwbG9yZXIuXCIpLFxuXHRcdFx0J2RlZmF1bHQnOiB0cnVlXG5cdFx0fSxcblx0XHQnZXhwbG9yZXIuY29uZmlybURyYWdBbmREcm9wJzoge1xuXHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBubHMubG9jYWxpemUoJ2NvbmZpcm1EcmFnQW5kRHJvcCcsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgRXhwbG9yZXIgc2hvdWxkIGFzayBmb3IgY29uZmlybWF0aW9uIHRvIG1vdmUgZmlsZXMgYW5kIGZvbGRlcnMgdmlhIGRyYWcgYW5kIGRyb3AuXCIpLFxuXHRcdFx0J2RlZmF1bHQnOiB0cnVlXG5cdFx0fSxcblx0XHQnZXhwbG9yZXIuY29uZmlybVBhc3RlTmF0aXZlJzoge1xuXHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBubHMubG9jYWxpemUoJ2NvbmZpcm1QYXN0ZU5hdGl2ZScsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgRXhwbG9yZXIgc2hvdWxkIGFzayBmb3IgY29uZmlybWF0aW9uIHdoZW4gcGFzdGluZyBuYXRpdmUgZmlsZXMgYW5kIGZvbGRlcnMuXCIpLFxuXHRcdFx0J2RlZmF1bHQnOiB0cnVlXG5cdFx0fSxcblx0XHQnZXhwbG9yZXIuY29uZmlybURlbGV0ZSc6IHtcblx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdjb25maXJtRGVsZXRlJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBFeHBsb3JlciBzaG91bGQgYXNrIGZvciBjb25maXJtYXRpb24gd2hlbiBkZWxldGluZyBhIGZpbGUgdmlhIHRoZSB0cmFzaC5cIiksXG5cdFx0XHQnZGVmYXVsdCc6IHRydWVcblx0XHR9LFxuXHRcdCdleHBsb3Jlci5lbmFibGVVbmRvJzoge1xuXHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBubHMubG9jYWxpemUoJ2VuYWJsZVVuZG8nLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIEV4cGxvcmVyIHNob3VsZCBzdXBwb3J0IHVuZG9pbmcgZmlsZSBhbmQgZm9sZGVyIG9wZXJhdGlvbnMuXCIpLFxuXHRcdFx0J2RlZmF1bHQnOiB0cnVlXG5cdFx0fSxcblx0XHQnZXhwbG9yZXIuY29uZmlybVVuZG8nOiB7XG5cdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0J2VudW0nOiBbVW5kb0NvbmZpcm1MZXZlbC5WZXJib3NlLCBVbmRvQ29uZmlybUxldmVsLkRlZmF1bHQsIFVuZG9Db25maXJtTGV2ZWwuTGlnaHRdLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdjb25maXJtVW5kbycsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgRXhwbG9yZXIgc2hvdWxkIGFzayBmb3IgY29uZmlybWF0aW9uIHdoZW4gdW5kb2luZy5cIiksXG5cdFx0XHQnZGVmYXVsdCc6IFVuZG9Db25maXJtTGV2ZWwuRGVmYXVsdCxcblx0XHRcdCdlbnVtRGVzY3JpcHRpb25zJzogW1xuXHRcdFx0XHRubHMubG9jYWxpemUoJ2VuYWJsZVVuZG8udmVyYm9zZScsICdFeHBsb3JlciB3aWxsIHByb21wdCBiZWZvcmUgYWxsIHVuZG8gb3BlcmF0aW9ucy4nKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdlbmFibGVVbmRvLmRlZmF1bHQnLCAnRXhwbG9yZXIgd2lsbCBwcm9tcHQgYmVmb3JlIGRlc3RydWN0aXZlIHVuZG8gb3BlcmF0aW9ucy4nKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdlbmFibGVVbmRvLmxpZ2h0JywgJ0V4cGxvcmVyIHdpbGwgbm90IHByb21wdCBiZWZvcmUgdW5kbyBvcGVyYXRpb25zIHdoZW4gZm9jdXNlZC4nKSxcblx0XHRcdF0sXG5cdFx0fSxcblx0XHQnZXhwbG9yZXIuZXhwYW5kU2luZ2xlRm9sZGVyV29ya3NwYWNlcyc6IHtcblx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdleHBhbmRTaW5nbGVGb2xkZXJXb3Jrc3BhY2VzJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBFeHBsb3JlciBzaG91bGQgZXhwYW5kIG11bHRpLXJvb3Qgd29ya3NwYWNlcyBjb250YWluaW5nIG9ubHkgb25lIGZvbGRlciBkdXJpbmcgaW5pdGlhbGl6YXRpb25cIiksXG5cdFx0XHQnZGVmYXVsdCc6IHRydWVcblx0XHR9LFxuXHRcdCdleHBsb3Jlci5zb3J0T3JkZXInOiB7XG5cdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0J2VudW0nOiBbU29ydE9yZGVyLkRlZmF1bHQsIFNvcnRPcmRlci5NaXhlZCwgU29ydE9yZGVyLkZpbGVzRmlyc3QsIFNvcnRPcmRlci5UeXBlLCBTb3J0T3JkZXIuTW9kaWZpZWQsIFNvcnRPcmRlci5Gb2xkZXJzTmVzdHNGaWxlc10sXG5cdFx0XHQnZGVmYXVsdCc6IFNvcnRPcmRlci5EZWZhdWx0LFxuXHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc29ydE9yZGVyLmRlZmF1bHQnLCAnRmlsZXMgYW5kIGZvbGRlcnMgYXJlIHNvcnRlZCBieSB0aGVpciBuYW1lcy4gRm9sZGVycyBhcmUgZGlzcGxheWVkIGJlZm9yZSBmaWxlcy4nKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdzb3J0T3JkZXIubWl4ZWQnLCAnRmlsZXMgYW5kIGZvbGRlcnMgYXJlIHNvcnRlZCBieSB0aGVpciBuYW1lcy4gRmlsZXMgYXJlIGludGVyd292ZW4gd2l0aCBmb2xkZXJzLicpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3NvcnRPcmRlci5maWxlc0ZpcnN0JywgJ0ZpbGVzIGFuZCBmb2xkZXJzIGFyZSBzb3J0ZWQgYnkgdGhlaXIgbmFtZXMuIEZpbGVzIGFyZSBkaXNwbGF5ZWQgYmVmb3JlIGZvbGRlcnMuJyksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc29ydE9yZGVyLnR5cGUnLCAnRmlsZXMgYW5kIGZvbGRlcnMgYXJlIGdyb3VwZWQgYnkgZXh0ZW5zaW9uIHR5cGUgdGhlbiBzb3J0ZWQgYnkgdGhlaXIgbmFtZXMuIEZvbGRlcnMgYXJlIGRpc3BsYXllZCBiZWZvcmUgZmlsZXMuJyksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc29ydE9yZGVyLm1vZGlmaWVkJywgJ0ZpbGVzIGFuZCBmb2xkZXJzIGFyZSBzb3J0ZWQgYnkgbGFzdCBtb2RpZmllZCBkYXRlIGluIGRlc2NlbmRpbmcgb3JkZXIuIEZvbGRlcnMgYXJlIGRpc3BsYXllZCBiZWZvcmUgZmlsZXMuJyksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc29ydE9yZGVyLmZvbGRlcnNOZXN0c0ZpbGVzJywgJ0ZpbGVzIGFuZCBmb2xkZXJzIGFyZSBzb3J0ZWQgYnkgdGhlaXIgbmFtZXMuIEZvbGRlcnMgYXJlIGRpc3BsYXllZCBiZWZvcmUgZmlsZXMuIEZpbGVzIHdpdGggbmVzdGVkIGNoaWxkcmVuIGFyZSBkaXNwbGF5ZWQgYmVmb3JlIG90aGVyIGZpbGVzLicpXG5cdFx0XHRdLFxuXHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBubHMubG9jYWxpemUoJ3NvcnRPcmRlcicsIFwiQ29udHJvbHMgdGhlIHByb3BlcnR5LWJhc2VkIHNvcnRpbmcgb2YgZmlsZXMgYW5kIGZvbGRlcnMgaW4gdGhlIEV4cGxvcmVyLiBXaGVuIGAjZXhwbG9yZXIuZmlsZU5lc3RpbmcuZW5hYmxlZCNgIGlzIGVuYWJsZWQsIGFsc28gY29udHJvbHMgc29ydGluZyBvZiBuZXN0ZWQgZmlsZXMuXCIpXG5cdFx0fSxcblx0XHQnZXhwbG9yZXIuc29ydE9yZGVyTGV4aWNvZ3JhcGhpY09wdGlvbnMnOiB7XG5cdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0J2VudW0nOiBbTGV4aWNvZ3JhcGhpY09wdGlvbnMuRGVmYXVsdCwgTGV4aWNvZ3JhcGhpY09wdGlvbnMuVXBwZXIsIExleGljb2dyYXBoaWNPcHRpb25zLkxvd2VyLCBMZXhpY29ncmFwaGljT3B0aW9ucy5Vbmljb2RlXSxcblx0XHRcdCdkZWZhdWx0JzogTGV4aWNvZ3JhcGhpY09wdGlvbnMuRGVmYXVsdCxcblx0XHRcdCdlbnVtRGVzY3JpcHRpb25zJzogW1xuXHRcdFx0XHRubHMubG9jYWxpemUoJ3NvcnRPcmRlckxleGljb2dyYXBoaWNPcHRpb25zLmRlZmF1bHQnLCAnVXBwZXJjYXNlIGFuZCBsb3dlcmNhc2UgbmFtZXMgYXJlIG1peGVkIHRvZ2V0aGVyLicpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3NvcnRPcmRlckxleGljb2dyYXBoaWNPcHRpb25zLnVwcGVyJywgJ1VwcGVyY2FzZSBuYW1lcyBhcmUgZ3JvdXBlZCB0b2dldGhlciBiZWZvcmUgbG93ZXJjYXNlIG5hbWVzLicpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3NvcnRPcmRlckxleGljb2dyYXBoaWNPcHRpb25zLmxvd2VyJywgJ0xvd2VyY2FzZSBuYW1lcyBhcmUgZ3JvdXBlZCB0b2dldGhlciBiZWZvcmUgdXBwZXJjYXNlIG5hbWVzLicpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3NvcnRPcmRlckxleGljb2dyYXBoaWNPcHRpb25zLnVuaWNvZGUnLCAnTmFtZXMgYXJlIHNvcnRlZCBpbiBVbmljb2RlIG9yZGVyLicpXG5cdFx0XHRdLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdzb3J0T3JkZXJMZXhpY29ncmFwaGljT3B0aW9ucycsIFwiQ29udHJvbHMgdGhlIGxleGljb2dyYXBoaWMgc29ydGluZyBvZiBmaWxlIGFuZCBmb2xkZXIgbmFtZXMgaW4gdGhlIEV4cGxvcmVyLlwiKVxuXHRcdH0sXG5cdFx0J2V4cGxvcmVyLnNvcnRPcmRlclJldmVyc2UnOiB7XG5cdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdCdkZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgnc29ydE9yZGVyUmV2ZXJzZScsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgZmlsZSBhbmQgZm9sZGVyIHNvcnQgb3JkZXIsIHNob3VsZCBiZSByZXZlcnNlZC5cIiksXG5cdFx0XHQnZGVmYXVsdCc6IGZhbHNlLFxuXHRcdH0sXG5cdFx0J2V4cGxvcmVyLmRlY29yYXRpb25zLmNvbG9ycyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2V4cGxvcmVyLmRlY29yYXRpb25zLmNvbG9ycycsIFwiQ29udHJvbHMgd2hldGhlciBmaWxlIGRlY29yYXRpb25zIHNob3VsZCB1c2UgY29sb3JzLlwiKSxcblx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHR9LFxuXHRcdCdleHBsb3Jlci5kZWNvcmF0aW9ucy5iYWRnZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdleHBsb3Jlci5kZWNvcmF0aW9ucy5iYWRnZXMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgZmlsZSBkZWNvcmF0aW9ucyBzaG91bGQgdXNlIGJhZGdlcy5cIiksXG5cdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0fSxcblx0XHQnZXhwbG9yZXIuaW5jcmVtZW50YWxOYW1pbmcnOiB7XG5cdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydzaW1wbGUnLCAnc21hcnQnLCAnZGlzYWJsZWQnXSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdzaW1wbGUnLCBcIkFwcGVuZHMgdGhlIHdvcmQgXFxcImNvcHlcXFwiIGF0IHRoZSBlbmQgb2YgdGhlIGR1cGxpY2F0ZWQgbmFtZSBwb3RlbnRpYWxseSBmb2xsb3dlZCBieSBhIG51bWJlci5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc21hcnQnLCBcIkFkZHMgYSBudW1iZXIgYXQgdGhlIGVuZCBvZiB0aGUgZHVwbGljYXRlZCBuYW1lLiBJZiBzb21lIG51bWJlciBpcyBhbHJlYWR5IHBhcnQgb2YgdGhlIG5hbWUsIHRyaWVzIHRvIGluY3JlYXNlIHRoYXQgbnVtYmVyLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdkaXNhYmxlZCcsIFwiRGlzYWJsZXMgaW5jcmVtZW50YWwgbmFtaW5nLiBJZiB0d28gZmlsZXMgd2l0aCB0aGUgc2FtZSBuYW1lIGV4aXN0IHlvdSB3aWxsIGJlIHByb21wdGVkIHRvIG92ZXJ3cml0ZSB0aGUgZXhpc3RpbmcgZmlsZS5cIilcblx0XHRcdF0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdleHBsb3Jlci5pbmNyZW1lbnRhbE5hbWluZycsIFwiQ29udHJvbHMgd2hpY2ggbmFtaW5nIHN0cmF0ZWd5IHRvIHVzZSB3aGVuIGdpdmluZyBhIG5ldyBuYW1lIHRvIGEgZHVwbGljYXRlZCBFeHBsb3JlciBpdGVtIG9uIHBhc3RlLlwiKSxcblx0XHRcdGRlZmF1bHQ6ICdzaW1wbGUnXG5cdFx0fSxcblx0XHQnZXhwbG9yZXIuYXV0b09wZW5Ecm9wcGVkRmlsZSc6IHtcblx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdhdXRvT3BlbkRyb3BwZWRGaWxlJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBFeHBsb3JlciBzaG91bGQgYXV0b21hdGljYWxseSBvcGVuIGEgZmlsZSB3aGVuIGl0IGlzIGRyb3BwZWQgaW50byB0aGUgZXhwbG9yZXJcIiksXG5cdFx0XHQnZGVmYXVsdCc6IHRydWVcblx0XHR9LFxuXHRcdCdleHBsb3Jlci5jb21wYWN0Rm9sZGVycyc6IHtcblx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdjb21wcmVzc1NpbmdsZUNoaWxkRm9sZGVycycsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgRXhwbG9yZXIgc2hvdWxkIHJlbmRlciBmb2xkZXJzIGluIGEgY29tcGFjdCBmb3JtLiBJbiBzdWNoIGEgZm9ybSwgc2luZ2xlIGNoaWxkIGZvbGRlcnMgd2lsbCBiZSBjb21wcmVzc2VkIGluIGEgY29tYmluZWQgdHJlZSBlbGVtZW50LiBVc2VmdWwgZm9yIEphdmEgcGFja2FnZSBzdHJ1Y3R1cmVzLCBmb3IgZXhhbXBsZS5cIiksXG5cdFx0XHQnZGVmYXVsdCc6IHRydWVcblx0XHR9LFxuXHRcdCdleHBsb3Jlci5jb3B5UmVsYXRpdmVQYXRoU2VwYXJhdG9yJzoge1xuXHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdCdlbnVtJzogW1xuXHRcdFx0XHQnLycsXG5cdFx0XHRcdCdcXFxcJyxcblx0XHRcdFx0J2F1dG8nXG5cdFx0XHRdLFxuXHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnY29weVJlbGF0aXZlUGF0aFNlcGFyYXRvci5zbGFzaCcsIFwiVXNlIHNsYXNoIGFzIHBhdGggc2VwYXJhdGlvbiBjaGFyYWN0ZXIuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2NvcHlSZWxhdGl2ZVBhdGhTZXBhcmF0b3IuYmFja3NsYXNoJywgXCJVc2UgYmFja3NsYXNoIGFzIHBhdGggc2VwYXJhdGlvbiBjaGFyYWN0ZXIuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2NvcHlSZWxhdGl2ZVBhdGhTZXBhcmF0b3IuYXV0bycsIFwiVXNlcyBvcGVyYXRpbmcgc3lzdGVtIHNwZWNpZmljIHBhdGggc2VwYXJhdGlvbiBjaGFyYWN0ZXIuXCIpLFxuXHRcdFx0XSxcblx0XHRcdCdkZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgnY29weVJlbGF0aXZlUGF0aFNlcGFyYXRvcicsIFwiVGhlIHBhdGggc2VwYXJhdGlvbiBjaGFyYWN0ZXIgdXNlZCB3aGVuIGNvcHlpbmcgcmVsYXRpdmUgZmlsZSBwYXRocy5cIiksXG5cdFx0XHQnZGVmYXVsdCc6ICdhdXRvJ1xuXHRcdH0sXG5cdFx0J2V4cGxvcmVyLmNvcHlQYXRoU2VwYXJhdG9yJzoge1xuXHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdCdlbnVtJzogW1xuXHRcdFx0XHQnLycsXG5cdFx0XHRcdCdcXFxcJyxcblx0XHRcdFx0J2F1dG8nXG5cdFx0XHRdLFxuXHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnY29weVBhdGhTZXBhcmF0b3Iuc2xhc2gnLCBcIlVzZSBzbGFzaCBhcyBwYXRoIHNlcGFyYXRpb24gY2hhcmFjdGVyLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdjb3B5UGF0aFNlcGFyYXRvci5iYWNrc2xhc2gnLCBcIlVzZSBiYWNrc2xhc2ggYXMgcGF0aCBzZXBhcmF0aW9uIGNoYXJhY3Rlci5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnY29weVBhdGhTZXBhcmF0b3IuYXV0bycsIFwiVXNlcyBvcGVyYXRpbmcgc3lzdGVtIHNwZWNpZmljIHBhdGggc2VwYXJhdGlvbiBjaGFyYWN0ZXIuXCIpLFxuXHRcdFx0XSxcblx0XHRcdCdkZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgnY29weVBhdGhTZXBhcmF0b3InLCBcIlRoZSBwYXRoIHNlcGFyYXRpb24gY2hhcmFjdGVyIHVzZWQgd2hlbiBjb3B5aW5nIGZpbGUgcGF0aHMuXCIpLFxuXHRcdFx0J2RlZmF1bHQnOiAnYXV0bydcblx0XHR9LFxuXHRcdCdleHBsb3Jlci5leGNsdWRlR2l0SWdub3JlJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdleGNsdWRlR2l0aWdub3JlJywgXCJDb250cm9scyB3aGV0aGVyIGVudHJpZXMgaW4gLmdpdGlnbm9yZSBzaG91bGQgYmUgcGFyc2VkIGFuZCBleGNsdWRlZCBmcm9tIHRoZSBFeHBsb3Jlci4gU2ltaWxhciB0byB7MH0uXCIsICdgI2ZpbGVzLmV4Y2x1ZGUjYCcpLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLlJFU09VUkNFXG5cdFx0fSxcblx0XHQnZXhwbG9yZXIuZmlsZU5lc3RpbmcuZW5hYmxlZCc6IHtcblx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5SRVNPVVJDRSxcblx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdmaWxlTmVzdGluZ0VuYWJsZWQnLCBcIkNvbnRyb2xzIHdoZXRoZXIgZmlsZSBuZXN0aW5nIGlzIGVuYWJsZWQgaW4gdGhlIEV4cGxvcmVyLiBGaWxlIG5lc3RpbmcgYWxsb3dzIGZvciByZWxhdGVkIGZpbGVzIGluIGEgZGlyZWN0b3J5IHRvIGJlIHZpc3VhbGx5IGdyb3VwZWQgdG9nZXRoZXIgdW5kZXIgYSBzaW5nbGUgcGFyZW50IGZpbGUuXCIpLFxuXHRcdFx0J2RlZmF1bHQnOiBmYWxzZSxcblx0XHR9LFxuXHRcdCdleHBsb3Jlci5maWxlTmVzdGluZy5leHBhbmQnOiB7XG5cdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdmaWxlTmVzdGluZ0V4cGFuZCcsIFwiQ29udHJvbHMgd2hldGhlciBmaWxlIG5lc3RzIGFyZSBhdXRvbWF0aWNhbGx5IGV4cGFuZGVkLiB7MH0gbXVzdCBiZSBzZXQgZm9yIHRoaXMgdG8gdGFrZSBlZmZlY3QuXCIsICdgI2V4cGxvcmVyLmZpbGVOZXN0aW5nLmVuYWJsZWQjYCcpLFxuXHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdH0sXG5cdFx0J2V4cGxvcmVyLmZpbGVOZXN0aW5nLnBhdHRlcm5zJzoge1xuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuUkVTT1VSQ0UsXG5cdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgnZmlsZU5lc3RpbmdQYXR0ZXJucycsIFwiQ29udHJvbHMgbmVzdGluZyBvZiBmaWxlcyBpbiB0aGUgRXhwbG9yZXIuIHswfSBtdXN0IGJlIHNldCBmb3IgdGhpcyB0byB0YWtlIGVmZmVjdC4gRWFjaCBfX0l0ZW1fXyByZXByZXNlbnRzIGEgcGFyZW50IHBhdHRlcm4gYW5kIG1heSBjb250YWluIGEgc2luZ2xlIGAqYCBjaGFyYWN0ZXIgdGhhdCBtYXRjaGVzIGFueSBzdHJpbmcuIEVhY2ggX19WYWx1ZV9fIHJlcHJlc2VudHMgYSBjb21tYSBzZXBhcmF0ZWQgbGlzdCBvZiB0aGUgY2hpbGQgcGF0dGVybnMgdGhhdCBzaG91bGQgYmUgc2hvd24gbmVzdGVkIHVuZGVyIGEgZ2l2ZW4gcGFyZW50LiBDaGlsZCBwYXR0ZXJucyBtYXkgY29udGFpbiBzZXZlcmFsIHNwZWNpYWwgdG9rZW5zOlxcbi0gYCR7Y2FwdHVyZX1gOiBNYXRjaGVzIHRoZSByZXNvbHZlZCB2YWx1ZSBvZiB0aGUgYCpgIGZyb20gdGhlIHBhcmVudCBwYXR0ZXJuXFxuLSBgJHtiYXNlbmFtZX1gOiBNYXRjaGVzIHRoZSBwYXJlbnQgZmlsZSdzIGJhc2VuYW1lLCB0aGUgYGZpbGVgIGluIGBmaWxlLnRzYFxcbi0gYCR7ZXh0bmFtZX1gOiBNYXRjaGVzIHRoZSBwYXJlbnQgZmlsZSdzIGV4dGVuc2lvbiwgdGhlIGB0c2AgaW4gYGZpbGUudHNgXFxuLSBgJHtkaXJuYW1lfWA6IE1hdGNoZXMgdGhlIHBhcmVudCBmaWxlJ3MgZGlyZWN0b3J5IG5hbWUsIHRoZSBgc3JjYCBpbiBgc3JjL2ZpbGUudHNgXFxuLSBgKmA6ICBNYXRjaGVzIGFueSBzdHJpbmcsIG1heSBvbmx5IGJlIHVzZWQgb25jZSBwZXIgY2hpbGQgcGF0dGVyblwiLCAnYCNleHBsb3Jlci5maWxlTmVzdGluZy5lbmFibGVkI2AnKSxcblx0XHRcdHBhdHRlcm5Qcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdCdeW14qXSpcXFxcKj9bXipdKiQnOiB7XG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdmaWxlTmVzdGluZy5kZXNjcmlwdGlvbicsIFwiRWFjaCBrZXkgcGF0dGVybiBtYXkgY29udGFpbiBhIHNpbmdsZSBgKmAgY2hhcmFjdGVyIHdoaWNoIHdpbGwgbWF0Y2ggYW55IHN0cmluZy5cIiksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0cGF0dGVybjogJ14oW14sKl0qXFxcXCo/W14sKl0qKSgsID9bXiwqXSpcXFxcKj9bXiwqXSopKiQnLFxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuXHRcdFx0J2RlZmF1bHQnOiB7XG5cdFx0XHRcdCcqLnRzJzogJyR7Y2FwdHVyZX0uanMnLFxuXHRcdFx0XHQnKi5qcyc6ICcke2NhcHR1cmV9LmpzLm1hcCwgJHtjYXB0dXJlfS5taW4uanMsICR7Y2FwdHVyZX0uZC50cycsXG5cdFx0XHRcdCcqLmpzeCc6ICcke2NhcHR1cmV9LmpzJyxcblx0XHRcdFx0JyoudHN4JzogJyR7Y2FwdHVyZX0udHMnLFxuXHRcdFx0XHQndHNjb25maWcuanNvbic6ICd0c2NvbmZpZy4qLmpzb24nLFxuXHRcdFx0XHQncGFja2FnZS5qc29uJzogJ3BhY2thZ2UtbG9jay5qc29uLCB5YXJuLmxvY2ssIHBucG0tbG9jay55YW1sLCBidW4ubG9ja2IsIGJ1bi5sb2NrJyxcblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuXG5VbmRvQ29tbWFuZC5hZGRJbXBsZW1lbnRhdGlvbigxMTAsICdleHBsb3JlcicsIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRjb25zdCB1bmRvUmVkb1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVVuZG9SZWRvU2VydmljZSk7XG5cdGNvbnN0IGV4cGxvcmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXhwbG9yZXJTZXJ2aWNlKTtcblx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRjb25zdCBleHBsb3JlckNhblVuZG8gPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRmlsZXNDb25maWd1cmF0aW9uPigpLmV4cGxvcmVyLmVuYWJsZVVuZG87XG5cdGlmIChleHBsb3JlclNlcnZpY2UuaGFzVmlld0ZvY3VzKCkgJiYgdW5kb1JlZG9TZXJ2aWNlLmNhblVuZG8oVU5ET19SRURPX1NPVVJDRSkgJiYgZXhwbG9yZXJDYW5VbmRvKSB7XG5cdFx0dW5kb1JlZG9TZXJ2aWNlLnVuZG8oVU5ET19SRURPX1NPVVJDRSk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRyZXR1cm4gZmFsc2U7XG59KTtcblxuUmVkb0NvbW1hbmQuYWRkSW1wbGVtZW50YXRpb24oMTEwLCAnZXhwbG9yZXInLCAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpID0+IHtcblx0Y29uc3QgdW5kb1JlZG9TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElVbmRvUmVkb1NlcnZpY2UpO1xuXHRjb25zdCBleHBsb3JlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4cGxvcmVyU2VydmljZSk7XG5cdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0Y29uc3QgZXhwbG9yZXJDYW5VbmRvID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SUZpbGVzQ29uZmlndXJhdGlvbj4oKS5leHBsb3Jlci5lbmFibGVVbmRvO1xuXHRpZiAoZXhwbG9yZXJTZXJ2aWNlLmhhc1ZpZXdGb2N1cygpICYmIHVuZG9SZWRvU2VydmljZS5jYW5SZWRvKFVORE9fUkVET19TT1VSQ0UpICYmIGV4cGxvcmVyQ2FuVW5kbykge1xuXHRcdHVuZG9SZWRvU2VydmljZS5yZWRvKFVORE9fUkVET19TT1VSQ0UpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cmV0dXJuIGZhbHNlO1xufSk7XG5cbk1vZGVzUmVnaXN0cnkucmVnaXN0ZXJMYW5ndWFnZSh7XG5cdGlkOiBCSU5BUllfVEVYVF9GSUxFX01PREUsXG5cdGFsaWFzZXM6IFsnQmluYXJ5J10sXG5cdG1pbWV0eXBlczogWyd0ZXh0L3gtY29kZS1iaW5hcnknXVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLFdBQVc7QUFDcEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FB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
