import { Registry } from "../../platform/registry/common/platform.js";
import { localize } from "../../nls.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../platform/configuration/common/configurationRegistry.js";
import { isMacintosh, isWindows, isLinux, isWeb, isNative } from "../../base/common/platform.js";
import { ConfigurationMigrationWorkbenchContribution, DynamicWorkbenchSecurityConfiguration, workbenchConfigurationNodeBase, Extensions, problemsConfigurationNodeBase, windowConfigurationNodeBase, DynamicWindowConfiguration } from "../common/configuration.js";
import { isStandalone } from "../../base/browser/browser.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../common/contributions.js";
import { ActivityBarPosition, EditorActionsLocation, EditorTabsMode, LayoutSettings } from "../services/layout/browser/layoutService.js";
import { defaultWindowTitle, defaultWindowTitleSeparator } from "./parts/titlebar/windowTitle.js";
import { CustomEditorLabelService } from "../services/editor/common/customEditorLabelService.js";
const registry = Registry.as(ConfigurationExtensions.Configuration);
(function registerConfiguration() {
  registerWorkbenchContribution2(ConfigurationMigrationWorkbenchContribution.ID, ConfigurationMigrationWorkbenchContribution, WorkbenchPhase.Eventually);
  registerWorkbenchContribution2(DynamicWorkbenchSecurityConfiguration.ID, DynamicWorkbenchSecurityConfiguration, WorkbenchPhase.AfterRestored);
  registry.registerConfiguration({
    ...workbenchConfigurationNodeBase,
    "properties": {
      "workbench.externalBrowser": {
        type: "string",
        markdownDescription: localize("browser", "Configure the browser to use for opening http or https links externally. This can either be the name of the browser (`edge`, `chrome`, `firefox`) or an absolute path to the browser's executable. Will use the system default if not set."),
        included: isNative,
        restricted: true
      },
      "workbench.editor.titleScrollbarSizing": {
        type: "string",
        enum: ["default", "large"],
        enumDescriptions: [
          localize("workbench.editor.titleScrollbarSizing.default", "The default size."),
          localize("workbench.editor.titleScrollbarSizing.large", "Increases the size, so it can be grabbed more easily with the mouse.")
        ],
        description: localize("tabScrollbarHeight", "Controls the height of the scrollbars used for tabs and breadcrumbs in the editor title area."),
        default: "default"
      },
      [LayoutSettings.EDITOR_TABS_MODE]: {
        "type": "string",
        "enum": [EditorTabsMode.MULTIPLE, EditorTabsMode.SINGLE, EditorTabsMode.NONE],
        "enumDescriptions": [
          localize("workbench.editor.showTabs.multiple", "Each editor is displayed as a tab in the editor title area."),
          localize("workbench.editor.showTabs.single", "The active editor is displayed as a single large tab in the editor title area."),
          localize("workbench.editor.showTabs.none", "The editor title area is not displayed.")
        ],
        "description": localize("showEditorTabs", "Controls whether opened editors should show as individual tabs, one single large tab or if the title area should not be shown."),
        "default": "multiple"
      },
      [LayoutSettings.EDITOR_ACTIONS_LOCATION]: {
        "type": "string",
        "enum": [EditorActionsLocation.DEFAULT, EditorActionsLocation.TITLEBAR, EditorActionsLocation.HIDDEN],
        "markdownEnumDescriptions": [
          localize({ comment: ["{0} will be a setting name rendered as a link"], key: "workbench.editor.editorActionsLocation.default" }, "Show editor actions in the window title bar when {0} is set to {1}. Otherwise, editor actions are shown in the editor tab bar.", "`#workbench.editor.showTabs#`", "`none`"),
          localize({ comment: ["{0} will be a setting name rendered as a link"], key: "workbench.editor.editorActionsLocation.titleBar" }, "Show editor actions in the window title bar. If {0} is set to {1}, editor actions are hidden.", "`#window.customTitleBarVisibility#`", "`never`"),
          localize("workbench.editor.editorActionsLocation.hidden", "Editor actions are not shown.")
        ],
        "markdownDescription": localize("editorActionsLocation", "Controls where the editor actions are shown."),
        "default": "default"
      },
      "workbench.editor.alwaysShowEditorActions": {
        "type": "boolean",
        "markdownDescription": localize("alwaysShowEditorActions", "Controls whether to always show the editor actions, even when the editor group is not active."),
        "default": false
      },
      "workbench.editor.wrapTabs": {
        "type": "boolean",
        "markdownDescription": localize({ comment: ["{0}, {1} will be a setting name rendered as a link"], key: "wrapTabs" }, "Controls whether tabs should be wrapped over multiple lines when exceeding available space or whether a scrollbar should appear instead. This value is ignored when {0} is not set to '{1}'.", "`#workbench.editor.showTabs#`", "`multiple`"),
        "default": false
      },
      "workbench.editor.scrollToSwitchTabs": {
        "type": "boolean",
        "markdownDescription": localize({ comment: ["{0}, {1} will be a setting name rendered as a link"], key: "scrollToSwitchTabs" }, "Controls whether scrolling over tabs will open them or not. By default tabs will only reveal upon scrolling, but not open. You can press and hold the Shift-key while scrolling to change this behavior for that duration. This value is ignored when {0} is not set to {1}.", "`#workbench.editor.showTabs#`", "`multiple`"),
        "default": false
      },
      "workbench.editor.highlightModifiedTabs": {
        "type": "boolean",
        "markdownDescription": localize({ comment: ["{0}, {1} will be a setting name rendered as a link"], key: "highlightModifiedTabs" }, "Controls whether a top border is drawn on tabs for editors that have unsaved changes. This value is ignored when {0} is not set to {1}.", "`#workbench.editor.showTabs#`", `multiple`),
        "default": false
      },
      "workbench.editor.decorations.badges": {
        "type": "boolean",
        "markdownDescription": localize("decorations.badges", "Controls whether editor file decorations should use badges."),
        "default": true
      },
      "workbench.editor.decorations.colors": {
        "type": "boolean",
        "markdownDescription": localize("decorations.colors", "Controls whether editor file decorations should use colors."),
        "default": true
      },
      [CustomEditorLabelService.SETTING_ID_ENABLED]: {
        "type": "boolean",
        "markdownDescription": localize("workbench.editor.label.enabled", "Controls whether the custom workbench editor labels should be applied."),
        "default": true
      },
      [CustomEditorLabelService.SETTING_ID_PATTERNS]: {
        "type": "object",
        "markdownDescription": (() => {
          let customEditorLabelDescription = localize("workbench.editor.label.patterns", "Controls the rendering of the editor label. Each __Item__ is a pattern that matches a file path. Both relative and absolute file paths are supported. The relative path must include the WORKSPACE_FOLDER (e.g `WORKSPACE_FOLDER/src/**.tsx` or `*/src/**.tsx`). Absolute patterns must start with a `/`. In case multiple patterns match, the longest matching path will be picked. Each __Value__ is the template for the rendered editor when the __Item__ matches. Variables are substituted based on the context:");
          customEditorLabelDescription += "\n- " + [
            localize("workbench.editor.label.dirname", "`${dirname}`: name of the folder in which the file is located (e.g. `WORKSPACE_FOLDER/folder/file.txt -> folder`)."),
            localize("workbench.editor.label.nthdirname", "`${dirname(N)}`: name of the nth parent folder in which the file is located (e.g. `N=2: WORKSPACE_FOLDER/static/folder/file.txt -> WORKSPACE_FOLDER`). Folders can be picked from the start of the path by using negative numbers (e.g. `N=-1: WORKSPACE_FOLDER/folder/file.txt -> WORKSPACE_FOLDER`). If the __Item__ is an absolute pattern path, the first folder (`N=-1`) refers to the first folder in the absolute path, otherwise it corresponds to the workspace folder."),
            localize("workbench.editor.label.filename", "`${filename}`: name of the file without the file extension (e.g. `WORKSPACE_FOLDER/folder/file.txt -> file`)."),
            localize("workbench.editor.label.extname", "`${extname}`: the file extension (e.g. `WORKSPACE_FOLDER/folder/file.txt -> txt`)."),
            localize("workbench.editor.label.nthextname", "`${extname(N)}`: the nth extension of the file separated by '.' (e.g. `N=2: WORKSPACE_FOLDER/folder/file.ext1.ext2.ext3 -> ext1`). Extension can be picked from the start of the extension by using negative numbers (e.g. `N=-1: WORKSPACE_FOLDER/folder/file.ext1.ext2.ext3 -> ext2`).")
          ].join("\n- ");
          customEditorLabelDescription += "\n\n" + localize("customEditorLabelDescriptionExample", 'Example: `"**/static/**/*.html": "${filename} - ${dirname} (${extname})"` will render a file `WORKSPACE_FOLDER/static/folder/file.html` as `file - folder (html)`.');
          return customEditorLabelDescription;
        })(),
        additionalProperties: {
          type: ["string", "null"],
          markdownDescription: localize("workbench.editor.label.template", "The template which should be rendered when the pattern matches. May include the variables ${dirname}, ${filename} and ${extname}."),
          minLength: 1,
          pattern: ".*[a-zA-Z0-9].*"
        },
        "default": {}
      },
      "workbench.editor.labelFormat": {
        "type": "string",
        "enum": ["default", "short", "medium", "long"],
        "enumDescriptions": [
          localize("workbench.editor.labelFormat.default", "Show the name of the file. When tabs are enabled and two files have the same name in one group the distinguishing sections of each file's path are added. When tabs are disabled, the path relative to the workspace folder is shown if the editor is active."),
          localize("workbench.editor.labelFormat.short", "Show the name of the file followed by its directory name."),
          localize("workbench.editor.labelFormat.medium", "Show the name of the file followed by its path relative to the workspace folder."),
          localize("workbench.editor.labelFormat.long", "Show the name of the file followed by its absolute path.")
        ],
        "default": "default",
        "description": localize("tabDescription", "Controls the format of the label for an editor.")
      },
      "workbench.editor.untitled.labelFormat": {
        "type": "string",
        "enum": ["content", "name"],
        "enumDescriptions": [
          localize("workbench.editor.untitled.labelFormat.content", "The name of the untitled file is derived from the contents of its first line unless it has an associated file path. It will fallback to the name in case the line is empty or contains no word characters."),
          localize("workbench.editor.untitled.labelFormat.name", "The name of the untitled file is not derived from the contents of the file.")
        ],
        "default": "content",
        "description": localize("untitledLabelFormat", "Controls the format of the label for an untitled editor.")
      },
      "workbench.editor.empty.hint": {
        "type": "string",
        "enum": ["text", "hidden"],
        "default": "text",
        "markdownDescription": localize("workbench.editor.empty.hint", "Controls if the empty editor text hint should be visible in the editor.")
      },
      "workbench.editor.languageDetection": {
        type: "boolean",
        default: true,
        description: localize("workbench.editor.languageDetection", "Controls whether the language in a text editor is automatically detected unless the language has been explicitly set by the language picker. This can also be scoped by language so you can specify which languages you do not want to be switched off of. This is useful for languages like Markdown that often contain other languages that might trick language detection into thinking it's the embedded language and not Markdown."),
        scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
      },
      "workbench.editor.historyBasedLanguageDetection": {
        type: "boolean",
        default: true,
        description: localize("workbench.editor.historyBasedLanguageDetection", "Enables use of editor history in language detection. This causes automatic language detection to favor languages that have been recently opened and allows for automatic language detection to operate with smaller inputs.")
      },
      "workbench.editor.preferHistoryBasedLanguageDetection": {
        type: "boolean",
        default: false,
        description: localize("workbench.editor.preferBasedLanguageDetection", "When enabled, a language detection model that takes into account editor history will be given higher precedence.")
      },
      "workbench.editor.languageDetectionHints": {
        type: "object",
        default: { "untitledEditors": true, "notebookEditors": true },
        description: localize("workbench.editor.showLanguageDetectionHints", "When enabled, shows a Status bar Quick Fix when the editor language doesn't match detected content language."),
        additionalProperties: false,
        properties: {
          untitledEditors: {
            type: "boolean",
            description: localize("workbench.editor.showLanguageDetectionHints.editors", "Show in untitled text editors")
          },
          notebookEditors: {
            type: "boolean",
            description: localize("workbench.editor.showLanguageDetectionHints.notebook", "Show in notebook editors")
          }
        }
      },
      "workbench.editor.tabActionLocation": {
        type: "string",
        enum: ["left", "right"],
        default: "right",
        markdownDescription: localize({ comment: ["{0} will be a setting name rendered as a link"], key: "tabActionLocation" }, "Controls the position of the editor's tabs action buttons (close, unpin). This value is ignored when {0} is not set to {1}.", "`#workbench.editor.showTabs#`", "`multiple`")
      },
      "workbench.editor.tabActionCloseVisibility": {
        type: "boolean",
        default: true,
        description: localize("workbench.editor.tabActionCloseVisibility", "Controls the visibility of the tab close action button.")
      },
      "workbench.editor.tabActionUnpinVisibility": {
        type: "boolean",
        default: true,
        description: localize("workbench.editor.tabActionUnpinVisibility", "Controls the visibility of the tab unpin action button.")
      },
      "workbench.editor.tabSizing": {
        "type": "string",
        "enum": ["fit", "shrink", "fixed"],
        "default": "fit",
        "enumDescriptions": [
          localize("workbench.editor.tabSizing.fit", "Always keep tabs large enough to show the full editor label."),
          localize("workbench.editor.tabSizing.shrink", "Allow tabs to get smaller when the available space is not enough to show all tabs at once."),
          localize("workbench.editor.tabSizing.fixed", "Make all tabs the same size, while allowing them to get smaller when the available space is not enough to show all tabs at once.")
        ],
        "markdownDescription": localize({ comment: ["{0}, {1} will be a setting name rendered as a link"], key: "tabSizing" }, "Controls the size of editor tabs. This value is ignored when {0} is not set to {1}.", "`#workbench.editor.showTabs#`", "`multiple`")
      },
      "workbench.editor.tabSizingFixedMinWidth": {
        "type": "number",
        "default": 50,
        "minimum": 38,
        "markdownDescription": localize({ comment: ["{0}, {1} will be a setting name rendered as a link"], key: "workbench.editor.tabSizingFixedMinWidth" }, "Controls the minimum width of tabs when {0} size is set to {1}.", "`#workbench.editor.tabSizing#`", "`fixed`")
      },
      "workbench.editor.tabSizingFixedMaxWidth": {
        "type": "number",
        "default": 160,
        "minimum": 38,
        "markdownDescription": localize({ comment: ["{0}, {1} will be a setting name rendered as a link"], key: "workbench.editor.tabSizingFixedMaxWidth" }, "Controls the maximum width of tabs when {0} size is set to {1}.", "`#workbench.editor.tabSizing#`", "`fixed`")
      },
      "window.density.editorTabHeight": {
        "type": "string",
        "enum": ["default", "compact"],
        "default": "default",
        "markdownDescription": localize({ comment: ["{0}, {1} will be a setting name rendered as a link"], key: "workbench.editor.tabHeight" }, "Controls the height of editor tabs. Also applies to the title control bar when {0} is not set to {1}.", "`#workbench.editor.showTabs#`", "`multiple`")
      },
      "workbench.editor.pinnedTabSizing": {
        "type": "string",
        "enum": ["normal", "compact", "shrink"],
        "default": "normal",
        "enumDescriptions": [
          localize("workbench.editor.pinnedTabSizing.normal", "A pinned tab inherits the look of non pinned tabs."),
          localize("workbench.editor.pinnedTabSizing.compact", "A pinned tab will show in a compact form with only icon or first letter of the editor name."),
          localize("workbench.editor.pinnedTabSizing.shrink", "A pinned tab shrinks to a compact fixed size showing parts of the editor name.")
        ],
        "markdownDescription": localize({ comment: ["{0}, {1} will be a setting name rendered as a link"], key: "pinnedTabSizing" }, "Controls the size of pinned editor tabs. Pinned tabs are sorted to the beginning of all opened tabs and typically do not close until unpinned. This value is ignored when {0} is not set to {1}.", "`#workbench.editor.showTabs#`", "`multiple`")
      },
      "workbench.editor.pinnedTabsOnSeparateRow": {
        "type": "boolean",
        "default": false,
        "markdownDescription": localize({ comment: ["{0}, {1} will be a setting name rendered as a link"], key: "workbench.editor.pinnedTabsOnSeparateRow" }, "When enabled, displays pinned tabs in a separate row above all other tabs. This value is ignored when {0} is not set to {1}.", "`#workbench.editor.showTabs#`", "`multiple`")
      },
      "workbench.editor.preventPinnedEditorClose": {
        "type": "string",
        "enum": ["keyboardAndMouse", "keyboard", "mouse", "never"],
        "default": "keyboardAndMouse",
        "enumDescriptions": [
          localize("workbench.editor.preventPinnedEditorClose.always", "Always prevent closing the pinned editor when using mouse middle click or keyboard."),
          localize("workbench.editor.preventPinnedEditorClose.onlyKeyboard", "Prevent closing the pinned editor when using the keyboard."),
          localize("workbench.editor.preventPinnedEditorClose.onlyMouse", "Prevent closing the pinned editor when using mouse middle click."),
          localize("workbench.editor.preventPinnedEditorClose.never", "Never prevent closing a pinned editor.")
        ],
        description: localize("workbench.editor.preventPinnedEditorClose", "Controls whether pinned editors should close when keyboard or middle mouse click is used for closing.")
      },
      "workbench.editor.splitSizing": {
        "type": "string",
        "enum": ["auto", "distribute", "split"],
        "default": "auto",
        "enumDescriptions": [
          localize("workbench.editor.splitSizingAuto", "Splits the active editor group to equal parts, unless all editor groups are already in equal parts. In that case, splits all the editor groups to equal parts."),
          localize("workbench.editor.splitSizingDistribute", "Splits all the editor groups to equal parts."),
          localize("workbench.editor.splitSizingSplit", "Splits the active editor group to equal parts.")
        ],
        "description": localize("splitSizing", "Controls the size of editor groups when splitting them.")
      },
      "workbench.editor.splitOnDragAndDrop": {
        "type": "boolean",
        "default": true,
        "description": localize("splitOnDragAndDrop", "Controls if editor groups can be split from drag and drop operations by dropping an editor or file on the edges of the editor area.")
      },
      "workbench.editor.dragToOpenWindow": {
        "type": "boolean",
        "default": true,
        "markdownDescription": localize("dragToOpenWindow", "Controls if editors can be dragged out of the window to open them in a new window. Press and hold the `Alt` key while dragging to toggle this dynamically.")
      },
      "workbench.editor.focusRecentEditorAfterClose": {
        "type": "boolean",
        "description": localize("focusRecentEditorAfterClose", "Controls whether editors are closed in most recently used order or from left to right."),
        "default": true
      },
      "workbench.editor.showIcons": {
        "type": "boolean",
        "description": localize("showIcons", "Controls whether opened editors should show with an icon or not. This requires a file icon theme to be enabled as well."),
        "default": true
      },
      "workbench.editor.enablePreview": {
        "type": "boolean",
        "description": localize("enablePreview", "Controls whether preview mode is used when editors open. There is a maximum of one preview mode editor per editor group. This editor displays its filename in italics on its tab or title label and in the Open Editors view. Its contents will be replaced by the next editor opened in preview mode. Making a change in a preview mode editor will persist it, as will a double-click on its label, or the 'Keep Open' option in its label context menu. Opening a file from Explorer with a double-click persists its editor immediately."),
        "default": true
      },
      "workbench.editor.enablePreviewFromQuickOpen": {
        "type": "boolean",
        "markdownDescription": localize({ comment: ["{0}, {1} will be a setting name rendered as a link"], key: "enablePreviewFromQuickOpen" }, "Controls whether editors opened from Quick Open show as preview editors. Preview editors do not stay open, and are reused until explicitly set to be kept open (via double-click or editing). When enabled, hold Ctrl before selection to open an editor as a non-preview. This value is ignored when {0} is not set to {1}.", "`#workbench.editor.showTabs#`", "`multiple`"),
        "default": false
      },
      "workbench.editor.enablePreviewFromCodeNavigation": {
        "type": "boolean",
        "markdownDescription": localize({ comment: ["{0}, {1} will be a setting name rendered as a link"], key: "enablePreviewFromCodeNavigation" }, "Controls whether editors remain in preview when a code navigation is started from them. Preview editors do not stay open, and are reused until explicitly set to be kept open (via double-click or editing). This value is ignored when {0} is not set to {1}.", "`#workbench.editor.showTabs#`", "`multiple`"),
        "default": false
      },
      "workbench.editor.closeOnFileDelete": {
        "type": "boolean",
        "description": localize("closeOnFileDelete", "Controls whether editors showing a file that was opened during the session should close automatically when getting deleted or renamed by some other process. Disabling this will keep the editor open  on such an event. Note that deleting from within the application will always close the editor and that editors with unsaved changes will never close to preserve your data."),
        "default": false
      },
      "workbench.editor.openPositioning": {
        "type": "string",
        "enum": ["left", "right", "first", "last"],
        "default": "right",
        "markdownDescription": localize({ comment: ["{0}, {1}, {2}, {3} will be a setting name rendered as a link"], key: "editorOpenPositioning" }, "Controls where editors open. Select {0} or {1} to open editors to the left or right of the currently active one. Select {2} or {3} to open editors independently from the currently active one.", "`left`", "`right`", "`first`", "`last`")
      },
      "workbench.editor.openSideBySideDirection": {
        "type": "string",
        "enum": ["right", "down"],
        "default": "right",
        "markdownDescription": localize("sideBySideDirection", "Controls the default direction of editors that are opened side by side (for example, from the Explorer). By default, editors will open on the right hand side of the currently active one. If changed to `down`, the editors will open below the currently active one.")
      },
      "workbench.editor.closeEmptyGroups": {
        "type": "boolean",
        "description": localize("closeEmptyGroups", "Controls the behavior of empty editor groups when the last tab in the group is closed. When enabled, empty groups will automatically close. When disabled, empty groups will remain part of the grid."),
        "default": true
      },
      "workbench.editor.revealIfOpen": {
        "type": "boolean",
        "description": localize("revealIfOpen", "Controls whether an editor is revealed in any of the visible groups if opened. If disabled, an editor will prefer to open in the currently active editor group. If enabled, an already opened editor will be revealed instead of opened again in the currently active editor group. Note that there are some cases where this setting is ignored, such as when forcing an editor to open in a specific group or to the side of the currently active group."),
        "default": false
      },
      "workbench.editor.mouseBackForwardToNavigate": {
        "type": "boolean",
        "description": localize("mouseBackForwardToNavigate", "Enables the use of mouse buttons four and five for commands 'Go Back' and 'Go Forward'."),
        "default": true
      },
      "workbench.editor.navigationScope": {
        "type": "string",
        "enum": ["default", "editorGroup", "editor"],
        "default": "default",
        "markdownDescription": localize("navigationScope", "Controls the scope of history navigation in editors for commands such as 'Go Back' and 'Go Forward'."),
        "enumDescriptions": [
          localize("workbench.editor.navigationScopeDefault", "Navigate across all opened editors and editor groups."),
          localize("workbench.editor.navigationScopeEditorGroup", "Navigate only in editors of the active editor group."),
          localize("workbench.editor.navigationScopeEditor", "Navigate only in the active editor.")
        ]
      },
      "workbench.editor.restoreViewState": {
        "type": "boolean",
        "markdownDescription": localize("restoreViewState", "Restores the last editor view state (such as scroll position) when re-opening editors after they have been closed. Editor view state is stored per editor group and discarded when a group closes. Use the {0} setting to use the last known view state across all editor groups in case no previous view state was found for a editor group.", "`#workbench.editor.sharedViewState#`"),
        "default": true,
        "scope": ConfigurationScope.LANGUAGE_OVERRIDABLE
      },
      "workbench.editor.sharedViewState": {
        "type": "boolean",
        "description": localize("sharedViewState", "Preserves the most recent editor view state (such as scroll position) across all editor groups and restores that if no specific editor view state is found for the editor group."),
        "default": false
      },
      "workbench.editor.splitInGroupLayout": {
        "type": "string",
        "enum": ["vertical", "horizontal"],
        "default": "horizontal",
        "markdownDescription": localize("splitInGroupLayout", "Controls the layout for when an editor is split in an editor group to be either vertical or horizontal."),
        "enumDescriptions": [
          localize("workbench.editor.splitInGroupLayoutVertical", "Editors are positioned from top to bottom."),
          localize("workbench.editor.splitInGroupLayoutHorizontal", "Editors are positioned from left to right.")
        ]
      },
      "workbench.editor.centeredLayoutAutoResize": {
        "type": "boolean",
        "default": true,
        "description": localize("centeredLayoutAutoResize", "Controls if the centered layout should automatically resize to maximum width when more than one group is open. Once only one group is open it will resize back to the original centered width.")
      },
      "workbench.editor.centeredLayoutFixedWidth": {
        "type": "boolean",
        "default": false,
        "description": localize("centeredLayoutDynamicWidth", "Controls whether the centered layout tries to maintain constant width when the window is resized.")
      },
      "workbench.editor.doubleClickTabToToggleEditorGroupSizes": {
        "type": "string",
        "enum": ["maximize", "expand", "off"],
        "default": "expand",
        "markdownDescription": localize({ comment: ["{0}, {1} will be a setting name rendered as a link"], key: "doubleClickTabToToggleEditorGroupSizes" }, "Controls how the editor group is resized when double clicking on a tab. This value is ignored when {0} is not set to {1}.", "`#workbench.editor.showTabs#`", "`multiple`"),
        "enumDescriptions": [
          localize("workbench.editor.doubleClickTabToToggleEditorGroupSizes.maximize", "All other editor groups are hidden and the current editor group is maximized to take up the entire editor area."),
          localize("workbench.editor.doubleClickTabToToggleEditorGroupSizes.expand", "The editor group takes as much space as possible by making all other editor groups as small as possible."),
          localize("workbench.editor.doubleClickTabToToggleEditorGroupSizes.off", "No editor group is resized when double clicking on a tab.")
        ]
      },
      "workbench.editor.limit.enabled": {
        "type": "boolean",
        "default": false,
        "description": localize("limitEditorsEnablement", "Controls if the number of opened editors should be limited or not. When enabled, less recently used editors will close to make space for newly opening editors.")
      },
      "workbench.editor.limit.value": {
        "type": "number",
        "default": 10,
        "exclusiveMinimum": 0,
        "markdownDescription": localize("limitEditorsMaximum", "Controls the maximum number of opened editors. Use the {0} setting to control this limit per editor group or across all groups.", "`#workbench.editor.limit.perEditorGroup#`")
      },
      "workbench.editor.limit.excludeDirty": {
        "type": "boolean",
        "default": false,
        "description": localize("limitEditorsExcludeDirty", "Controls if the maximum number of opened editors should exclude dirty editors for counting towards the configured limit.")
      },
      "workbench.editor.limit.perEditorGroup": {
        "type": "boolean",
        "default": false,
        "description": localize("perEditorGroup", "Controls if the limit of maximum opened editors should apply per editor group or across all editor groups.")
      },
      "workbench.localHistory.enabled": {
        "type": "boolean",
        "default": true,
        "description": localize("localHistoryEnabled", "Controls whether local file history is enabled. When enabled, the file contents of an editor that is saved will be stored to a backup location to be able to restore or review the contents later. Changing this setting has no effect on existing local file history entries."),
        "scope": ConfigurationScope.RESOURCE
      },
      "workbench.localHistory.maxFileSize": {
        "type": "number",
        "default": 256,
        "minimum": 1,
        "description": localize("localHistoryMaxFileSize", "Controls the maximum size of a file (in KB) to be considered for local file history. Files that are larger will not be added to the local file history. Changing this setting has no effect on existing local file history entries."),
        "scope": ConfigurationScope.RESOURCE
      },
      "workbench.localHistory.maxFileEntries": {
        "type": "number",
        "default": 50,
        "minimum": 0,
        "description": localize("localHistoryMaxFileEntries", "Controls the maximum number of local file history entries per file. When the number of local file history entries exceeds this number for a file, the oldest entries will be discarded."),
        "scope": ConfigurationScope.RESOURCE
      },
      "workbench.localHistory.exclude": {
        "type": "object",
        "patternProperties": {
          ".*": { "type": "boolean" }
        },
        "markdownDescription": localize("exclude", "Configure paths or [glob patterns](https://aka.ms/vscode-glob-patterns) for excluding files from the local file history. Glob patterns are always evaluated relative to the path of the workspace folder unless they are absolute paths. Changing this setting has no effect on existing local file history entries."),
        "scope": ConfigurationScope.RESOURCE
      },
      "workbench.localHistory.mergeWindow": {
        "type": "number",
        "default": 10,
        "minimum": 1,
        "markdownDescription": localize("mergeWindow", "Configure an interval in seconds during which the last entry in local file history is replaced with the entry that is being added. This helps reduce the overall number of entries that are added, for example when auto save is enabled. This setting is only applied to entries that have the same source of origin. Changing this setting has no effect on existing local file history entries."),
        "scope": ConfigurationScope.RESOURCE
      },
      "workbench.commandPalette.history": {
        "type": "number",
        "description": localize("commandHistory", "Controls the number of recently used commands to keep in history for the command palette. Set to 0 to disable command history."),
        "default": 50,
        "minimum": 0
      },
      "workbench.commandPalette.preserveInput": {
        "type": "boolean",
        "description": localize("preserveInput", "Controls whether the last typed input to the command palette should be restored when opening it the next time."),
        "default": false
      },
      "workbench.commandPalette.experimental.suggestCommands": {
        "type": "boolean",
        tags: ["experimental"],
        "description": localize("suggestCommands", "Controls whether the command palette should have a list of commonly used commands."),
        "default": false
      },
      "workbench.commandPalette.experimental.askChatLocation": {
        "type": "string",
        tags: ["experimental"],
        "description": localize("askChatLocation", "Controls where the command palette should ask chat questions."),
        "default": "chatView",
        enum: ["chatView", "quickChat"],
        enumDescriptions: [
          localize("askChatLocation.chatView", "Ask chat questions in the Chat view."),
          localize("askChatLocation.quickChat", "Ask chat questions in Quick Chat.")
        ]
      },
      "workbench.commandPalette.experimental.enableNaturalLanguageSearch": {
        "type": "boolean",
        tags: ["experimental"],
        "description": localize("enableNaturalLanguageSearch", "Controls whether the command palette should include similar commands. You must have an extension installed that provides Natural Language support."),
        "default": true
      },
      "workbench.quickOpen.closeOnFocusLost": {
        "type": "boolean",
        "description": localize("closeOnFocusLost", "Controls whether Quick Open should close automatically once it loses focus."),
        "default": true
      },
      "workbench.quickOpen.preserveInput": {
        "type": "boolean",
        "description": localize("workbench.quickOpen.preserveInput", "Controls whether the last typed input to Quick Open should be restored when opening it the next time."),
        "default": false
      },
      "workbench.settings.openDefaultSettings": {
        "type": "boolean",
        "description": localize("openDefaultSettings", "Controls whether opening settings also opens an editor showing all default settings."),
        "default": false
      },
      "workbench.settings.useSplitJSON": {
        "type": "boolean",
        "markdownDescription": localize("useSplitJSON", "Controls whether to use the split JSON editor when editing settings as JSON."),
        "default": false
      },
      "workbench.settings.openDefaultKeybindings": {
        "type": "boolean",
        "description": localize("openDefaultKeybindings", "Controls whether opening keybinding settings also opens an editor showing all default keybindings."),
        "default": false
      },
      "workbench.sideBar.location": {
        "type": "string",
        "enum": ["left", "right"],
        "default": "left",
        "description": localize("sideBarLocation", "Controls the location of the primary side bar and activity bar. They can either show on the left or right of the workbench. The Void side bar will show on the opposite side of the workbench.")
      },
      "workbench.panel.showLabels": {
        "type": "boolean",
        "default": true,
        "description": localize("panelShowLabels", "Controls whether activity items in the panel title are shown as label or icon.")
      },
      "workbench.panel.defaultLocation": {
        "type": "string",
        "enum": ["left", "bottom", "top", "right"],
        "default": "bottom",
        "description": localize("panelDefaultLocation", "Controls the default location of the panel (Terminal, Debug Console, Output, Problems) in a new workspace. It can either show at the bottom, top, right, or left of the editor area.")
      },
      "workbench.panel.opensMaximized": {
        "type": "string",
        "enum": ["always", "never", "preserve"],
        "default": "preserve",
        "description": localize("panelOpensMaximized", "Controls whether the panel opens maximized. It can either always open maximized, never open maximized, or open to the last state it was in before being closed."),
        "enumDescriptions": [
          localize("workbench.panel.opensMaximized.always", "Always maximize the panel when opening it."),
          localize("workbench.panel.opensMaximized.never", "Never maximize the panel when opening it. The panel will open un-maximized."),
          localize("workbench.panel.opensMaximized.preserve", "Open the panel to the state that it was in, before it was closed.")
        ]
      },
      "workbench.secondarySideBar.showLabels": {
        "type": "boolean",
        "default": true,
        "markdownDescription": localize("secondarySideBarShowLabels", "Controls whether activity items in the secondary sidebar title are shown as label or icon. This setting only has an effect when {0} is not set to {1}.", "`#workbench.activityBar.location#`", "`top`")
      },
      "workbench.statusBar.visible": {
        "type": "boolean",
        "default": true,
        "description": localize("statusBarVisibility", "Controls the visibility of the status bar at the bottom of the workbench.")
      },
      [LayoutSettings.ACTIVITY_BAR_LOCATION]: {
        "type": "string",
        "enum": ["default", "top", "bottom", "hidden"],
        "default": "top",
        "markdownDescription": localize({ comment: ["This is the description for a setting"], key: "activityBarLocation" }, "Controls the location of the Activity Bar relative to the Primary and Void Side Bars."),
        // Void side bar
        "enumDescriptions": [
          localize("workbench.activityBar.location.default", "Show the Activity Bar on the side of the Primary Side Bar and on top of the Void Side Bar."),
          // Void side bar
          localize("workbench.activityBar.location.top", "Show the Activity Bar on top of the Primary and Void Side Bars."),
          // Void side bar
          localize("workbench.activityBar.location.bottom", "Show the Activity Bar at the bottom of the Primary and Void Side Bars."),
          // Void side bar
          localize("workbench.activityBar.location.hide", "Hide the Activity Bar in the Primary and Void Side Bars.")
          // Void side bar
        ]
      },
      "workbench.activityBar.iconClickBehavior": {
        "type": "string",
        "enum": ["toggle", "focus"],
        "default": "toggle",
        "markdownDescription": localize({ comment: ["{0}, {1} will be a setting name rendered as a link"], key: "activityBarIconClickBehavior" }, "Controls the behavior of clicking an Activity Bar icon in the workbench. This value is ignored when {0} is not set to {1}.", "`#workbench.activityBar.location#`", "`default`"),
        "enumDescriptions": [
          localize("workbench.activityBar.iconClickBehavior.toggle", "Hide the Primary Side Bar if the clicked item is already visible."),
          localize("workbench.activityBar.iconClickBehavior.focus", "Focus the Primary Side Bar if the clicked item is already visible.")
        ]
      },
      "workbench.view.alwaysShowHeaderActions": {
        "type": "boolean",
        "default": false,
        "description": localize("viewVisibility", "Controls the visibility of view header actions. View header actions may either be always visible, or only visible when that view is focused or hovered over.")
      },
      "workbench.view.showQuietly": {
        "type": "object",
        "description": localize("workbench.view.showQuietly", "If an extension requests a hidden view to be shown, display a clickable status bar indicator instead."),
        "scope": ConfigurationScope.WINDOW,
        "properties": {
          "workbench.panel.output": {
            "type": "boolean",
            "description": localize("workbench.panel.output", "Output view")
          }
        },
        "additionalProperties": false
      },
      "workbench.fontAliasing": {
        "type": "string",
        "enum": ["default", "antialiased", "none", "auto"],
        "default": "default",
        "description": localize("fontAliasing", "Controls font aliasing method in the workbench."),
        "enumDescriptions": [
          localize("workbench.fontAliasing.default", "Sub-pixel font smoothing. On most non-retina displays this will give the sharpest text."),
          localize("workbench.fontAliasing.antialiased", "Smooth the font on the level of the pixel, as opposed to the subpixel. Can make the font appear lighter overall."),
          localize("workbench.fontAliasing.none", "Disables font smoothing. Text will show with jagged sharp edges."),
          localize("workbench.fontAliasing.auto", "Applies `default` or `antialiased` automatically based on the DPI of displays.")
        ],
        "included": isMacintosh
      },
      "workbench.settings.editor": {
        "type": "string",
        "enum": ["ui", "json"],
        "enumDescriptions": [
          localize("settings.editor.ui", "Use the settings UI editor."),
          localize("settings.editor.json", "Use the JSON file editor.")
        ],
        "description": localize("settings.editor.desc", "Determines which settings editor to use by default."),
        "default": "ui",
        "scope": ConfigurationScope.WINDOW
      },
      "workbench.hover.delay": {
        "type": "number",
        "description": localize("workbench.hover.delay", "Controls the delay in milliseconds after which the hover is shown for workbench items (ex. some extension provided tree view items). Already visible items may require a refresh before reflecting this setting change."),
        // Testing has indicated that on Windows and Linux 500 ms matches the native hovers most closely.
        // On Mac, the delay is 1500.
        "default": 300,
        // Void changed this from isMacintosh ? 1500 : 500,
        "minimum": 0
      },
      "workbench.reduceMotion": {
        type: "string",
        description: localize("workbench.reduceMotion", "Controls whether the workbench should render with fewer animations."),
        "enumDescriptions": [
          localize("workbench.reduceMotion.on", "Always render with reduced motion."),
          localize("workbench.reduceMotion.off", "Do not render with reduced motion"),
          localize("workbench.reduceMotion.auto", "Render with reduced motion based on OS configuration.")
        ],
        default: "auto",
        tags: ["accessibility"],
        enum: ["on", "off", "auto"]
      },
      "workbench.navigationControl.enabled": {
        "type": "boolean",
        "default": true,
        "markdownDescription": isWeb ? localize("navigationControlEnabledWeb", "Controls whether the navigation control in the title bar is shown.") : localize({ key: "navigationControlEnabled", comment: ["{0}, {1} is a placeholder for a setting identifier."] }, "Controls whether the navigation control is shown in the custom title bar. This setting only has an effect when {0} is not set to {1}.", "`#window.customTitleBarVisibility#`", "`never`")
      },
      [LayoutSettings.LAYOUT_ACTIONS]: {
        "type": "boolean",
        "default": true,
        "markdownDescription": isWeb ? localize("layoutControlEnabledWeb", "Controls whether the layout control in the title bar is shown.") : localize({ key: "layoutControlEnabled", comment: ["{0}, {1} is a placeholder for a setting identifier."] }, "Controls whether the layout control is shown in the custom title bar. This setting only has an effect when {0} is not set to {1}.", "`#window.customTitleBarVisibility#`", "`never`")
      },
      "workbench.layoutControl.type": {
        "type": "string",
        "enum": ["menu", "toggles", "both"],
        "enumDescriptions": [
          localize("layoutcontrol.type.menu", "Shows a single button with a dropdown of layout options."),
          localize("layoutcontrol.type.toggles", "Shows several buttons for toggling the visibility of the panels and side bar."),
          localize("layoutcontrol.type.both", "Shows both the dropdown and toggle buttons.")
        ],
        "default": "both",
        "description": localize("layoutControlType", "Controls whether the layout control in the custom title bar is displayed as a single menu button or with multiple UI toggles.")
      },
      "workbench.tips.enabled": {
        "type": "boolean",
        "default": true,
        "description": localize("tips.enabled", "When enabled, will show the watermark tips when no editor is open.")
      }
    }
  });
  let windowTitleDescription = localize("windowTitle", "Controls the window title based on the current context such as the opened workspace or active editor. Variables are substituted based on the context:");
  windowTitleDescription += "\n- " + [
    localize("activeEditorShort", "`${activeEditorShort}`: the file name (e.g. myFile.txt)."),
    localize("activeEditorMedium", "`${activeEditorMedium}`: the path of the file relative to the workspace folder (e.g. myFolder/myFileFolder/myFile.txt)."),
    localize("activeEditorLong", "`${activeEditorLong}`: the full path of the file (e.g. /Users/Development/myFolder/myFileFolder/myFile.txt)."),
    localize("activeFolderShort", "`${activeFolderShort}`: the name of the folder the file is contained in (e.g. myFileFolder)."),
    localize("activeFolderMedium", "`${activeFolderMedium}`: the path of the folder the file is contained in, relative to the workspace folder (e.g. myFolder/myFileFolder)."),
    localize("activeFolderLong", "`${activeFolderLong}`: the full path of the folder the file is contained in (e.g. /Users/Development/myFolder/myFileFolder)."),
    localize("folderName", "`${folderName}`: name of the workspace folder the file is contained in (e.g. myFolder)."),
    localize("folderPath", "`${folderPath}`: file path of the workspace folder the file is contained in (e.g. /Users/Development/myFolder)."),
    localize("rootName", "`${rootName}`: name of the workspace with optional remote name and workspace indicator if applicable (e.g. myFolder, myRemoteFolder [SSH] or myWorkspace (Workspace))."),
    localize("rootNameShort", "`${rootNameShort}`: shortened name of the workspace without suffixes (e.g. myFolder, myRemoteFolder or myWorkspace)."),
    localize("rootPath", "`${rootPath}`: file path of the opened workspace or folder (e.g. /Users/Development/myWorkspace)."),
    localize("profileName", "`${profileName}`: name of the profile in which the workspace is opened (e.g. Data Science (Profile)). Ignored if default profile is used."),
    localize("appName", "`${appName}`: e.g. VS Code."),
    localize("remoteName", "`${remoteName}`: e.g. SSH"),
    localize("dirty", "`${dirty}`: an indicator for when the active editor has unsaved changes."),
    localize("focusedView", "`${focusedView}`: the name of the view that is currently focused."),
    localize("activeRepositoryName", "`${activeRepositoryName}`: the name of the active repository (e.g. vscode)."),
    localize("activeRepositoryBranchName", "`${activeRepositoryBranchName}`: the name of the active branch in the active repository (e.g. main)."),
    localize("activeEditorState", "`${activeEditorState}`: provides information about the state of the active editor (e.g. modified). This will be appended by default when in screen reader mode with {0} enabled.", "`accessibility.windowTitleOptimized`"),
    localize("separator", '`${separator}`: a conditional separator (" - ") that only shows when surrounded by variables with values or static text.')
  ].join("\n- ");
  registry.registerConfiguration({
    ...windowConfigurationNodeBase,
    "properties": {
      "window.title": {
        "type": "string",
        "default": defaultWindowTitle,
        "markdownDescription": windowTitleDescription
      },
      "window.titleSeparator": {
        "type": "string",
        "default": defaultWindowTitleSeparator,
        "markdownDescription": localize("window.titleSeparator", "Separator used by {0}.", "`#window.title#`")
      },
      [LayoutSettings.COMMAND_CENTER]: {
        type: "boolean",
        default: true,
        markdownDescription: isWeb ? localize("window.commandCenterWeb", "Show command launcher together with the window title.") : localize({ key: "window.commandCenter", comment: ["{0}, {1} is a placeholder for a setting identifier."] }, "Show command launcher together with the window title. This setting only has an effect when {0} is not set to {1}.", "`#window.customTitleBarVisibility#`", "`never`")
      },
      "window.menuBarVisibility": {
        "type": "string",
        "enum": ["classic", "visible", "toggle", "hidden", "compact"],
        "markdownEnumDescriptions": [
          localize("window.menuBarVisibility.classic", "Menu is displayed at the top of the window and only hidden in full screen mode."),
          localize("window.menuBarVisibility.visible", "Menu is always visible at the top of the window even in full screen mode."),
          isMacintosh ? localize("window.menuBarVisibility.toggle.mac", "Menu is hidden but can be displayed at the top of the window by executing the `Focus Application Menu` command.") : localize("window.menuBarVisibility.toggle", "Menu is hidden but can be displayed at the top of the window via the Alt key."),
          localize("window.menuBarVisibility.hidden", "Menu is always hidden."),
          isWeb ? localize("window.menuBarVisibility.compact.web", "Menu is displayed as a compact button in the side bar.") : localize({ key: "window.menuBarVisibility.compact", comment: ["{0}, {1} is a placeholder for a setting identifier."] }, "Menu is displayed as a compact button in the side bar. This value is ignored when {0} is {1}.", "`#window.titleBarStyle#`", "`native`")
        ],
        "default": isWeb ? "compact" : "classic",
        "scope": ConfigurationScope.APPLICATION,
        "markdownDescription": isMacintosh ? localize("menuBarVisibility.mac", "Control the visibility of the menu bar. A setting of 'toggle' means that the menu bar is hidden and executing `Focus Application Menu` will show it. A setting of 'compact' will move the menu into the side bar.") : localize("menuBarVisibility", "Control the visibility of the menu bar. A setting of 'toggle' means that the menu bar is hidden and a single press of the Alt key will show it. A setting of 'compact' will move the menu into the side bar."),
        "included": isWindows || isLinux || isWeb
      },
      "window.enableMenuBarMnemonics": {
        "type": "boolean",
        "default": true,
        "scope": ConfigurationScope.APPLICATION,
        "description": localize("enableMenuBarMnemonics", "Controls whether the main menus can be opened via Alt-key shortcuts. Disabling mnemonics allows to bind these Alt-key shortcuts to editor commands instead."),
        "included": isWindows || isLinux
      },
      "window.customMenuBarAltFocus": {
        "type": "boolean",
        "default": true,
        "scope": ConfigurationScope.APPLICATION,
        "markdownDescription": localize("customMenuBarAltFocus", "Controls whether the menu bar will be focused by pressing the Alt-key. This setting has no effect on toggling the menu bar with the Alt-key."),
        "included": isWindows || isLinux
      },
      "window.openFilesInNewWindow": {
        "type": "string",
        "enum": ["on", "off", "default"],
        "enumDescriptions": [
          localize("window.openFilesInNewWindow.on", "Files will open in a new window."),
          localize("window.openFilesInNewWindow.off", "Files will open in the window with the files' folder open or the last active window."),
          isMacintosh ? localize("window.openFilesInNewWindow.defaultMac", "Files will open in the window with the files' folder open or the last active window unless opened via the Dock or from Finder.") : localize("window.openFilesInNewWindow.default", "Files will open in a new window unless picked from within the application (e.g. via the File menu).")
        ],
        "default": "off",
        "scope": ConfigurationScope.APPLICATION,
        "markdownDescription": isMacintosh ? localize("openFilesInNewWindowMac", "Controls whether files should open in a new window when using a command line or file dialog.\nNote that there can still be cases where this setting is ignored (e.g. when using the `--new-window` or `--reuse-window` command line option).") : localize("openFilesInNewWindow", "Controls whether files should open in a new window when using a command line or file dialog.\nNote that there can still be cases where this setting is ignored (e.g. when using the `--new-window` or `--reuse-window` command line option).")
      },
      "window.openFoldersInNewWindow": {
        "type": "string",
        "enum": ["on", "off", "default"],
        "enumDescriptions": [
          localize("window.openFoldersInNewWindow.on", "Folders will open in a new window."),
          localize("window.openFoldersInNewWindow.off", "Folders will replace the last active window."),
          localize("window.openFoldersInNewWindow.default", "Folders will open in a new window unless a folder is picked from within the application (e.g. via the File menu).")
        ],
        "default": "default",
        "scope": ConfigurationScope.APPLICATION,
        "markdownDescription": localize("openFoldersInNewWindow", "Controls whether folders should open in a new window or replace the last active window.\nNote that there can still be cases where this setting is ignored (e.g. when using the `--new-window` or `--reuse-window` command line option).")
      },
      "window.confirmBeforeClose": {
        "type": "string",
        "enum": ["always", "keyboardOnly", "never"],
        "enumDescriptions": [
          isWeb ? localize("window.confirmBeforeClose.always.web", "Always try to ask for confirmation. Note that browsers may still decide to close a tab or window without confirmation.") : localize("window.confirmBeforeClose.always", "Always ask for confirmation."),
          isWeb ? localize("window.confirmBeforeClose.keyboardOnly.web", "Only ask for confirmation if a keybinding was used to close the window. Note that detection may not be possible in some cases.") : localize("window.confirmBeforeClose.keyboardOnly", "Only ask for confirmation if a keybinding was used."),
          isWeb ? localize("window.confirmBeforeClose.never.web", "Never explicitly ask for confirmation unless data loss is imminent.") : localize("window.confirmBeforeClose.never", "Never explicitly ask for confirmation.")
        ],
        "default": isWeb && !isStandalone() ? "keyboardOnly" : "never",
        // on by default in web, unless PWA, never on desktop
        "markdownDescription": isWeb ? localize("confirmBeforeCloseWeb", "Controls whether to show a confirmation dialog before closing the browser tab or window. Note that even if enabled, browsers may still decide to close a tab or window without confirmation and that this setting is only a hint that may not work in all cases.") : localize("confirmBeforeClose", "Controls whether to show a confirmation dialog before closing a window or quitting the application."),
        "scope": ConfigurationScope.APPLICATION
      }
    }
  });
  registerWorkbenchContribution2(DynamicWindowConfiguration.ID, DynamicWindowConfiguration, WorkbenchPhase.Eventually);
  registry.registerConfiguration({
    ...problemsConfigurationNodeBase,
    "properties": {
      "problems.visibility": {
        "type": "boolean",
        "default": true,
        "description": localize("problems.visibility", "Controls whether the problems are visible throughout the editor and workbench.")
      }
    }
  });
  registry.registerConfiguration({
    "id": "zenMode",
    "order": 9,
    "title": localize("zenModeConfigurationTitle", "Zen Mode"),
    "type": "object",
    "properties": {
      "zenMode.fullScreen": {
        "type": "boolean",
        "default": true,
        "description": localize("zenMode.fullScreen", "Controls whether turning on Zen Mode also puts the workbench into full screen mode.")
      },
      "zenMode.centerLayout": {
        "type": "boolean",
        "default": true,
        "description": localize("zenMode.centerLayout", "Controls whether turning on Zen Mode also centers the layout.")
      },
      "zenMode.showTabs": {
        "type": "string",
        "enum": ["multiple", "single", "none"],
        "description": localize("zenMode.showTabs", "Controls whether turning on Zen Mode should show multiple editor tabs, a single editor tab, or hide the editor title area completely."),
        "enumDescriptions": [
          localize("zenMode.showTabs.multiple", "Each editor is displayed as a tab in the editor title area."),
          localize("zenMode.showTabs.single", "The active editor is displayed as a single large tab in the editor title area."),
          localize("zenMode.showTabs.none", "The editor title area is not displayed.")
        ],
        "default": "multiple"
      },
      "zenMode.hideStatusBar": {
        "type": "boolean",
        "default": true,
        "description": localize("zenMode.hideStatusBar", "Controls whether turning on Zen Mode also hides the status bar at the bottom of the workbench.")
      },
      "zenMode.hideActivityBar": {
        "type": "boolean",
        "default": true,
        "description": localize("zenMode.hideActivityBar", "Controls whether turning on Zen Mode also hides the activity bar either at the left or right of the workbench.")
      },
      "zenMode.hideLineNumbers": {
        "type": "boolean",
        "default": true,
        "description": localize("zenMode.hideLineNumbers", "Controls whether turning on Zen Mode also hides the editor line numbers.")
      },
      "zenMode.restore": {
        "type": "boolean",
        "default": true,
        "description": localize("zenMode.restore", "Controls whether a window should restore to Zen Mode if it was exited in Zen Mode.")
      },
      "zenMode.silentNotifications": {
        "type": "boolean",
        "default": true,
        "description": localize("zenMode.silentNotifications", "Controls whether notifications do not disturb mode should be enabled while in Zen Mode. If true, only error notifications will pop out.")
      }
    }
  });
})();
Registry.as(Extensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: "workbench.activityBar.visible",
  migrateFn: (value) => {
    const result = [];
    if (value !== void 0) {
      result.push(["workbench.activityBar.visible", { value: void 0 }]);
    }
    if (value === false) {
      result.push([LayoutSettings.ACTIVITY_BAR_LOCATION, { value: ActivityBarPosition.HIDDEN }]);
    }
    return result;
  }
}]);
Registry.as(Extensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: LayoutSettings.ACTIVITY_BAR_LOCATION,
  migrateFn: (value) => {
    const results = [];
    if (value === "side") {
      results.push([LayoutSettings.ACTIVITY_BAR_LOCATION, { value: ActivityBarPosition.DEFAULT }]);
    }
    return results;
  }
}]);
Registry.as(Extensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: "workbench.editor.doubleClickTabToToggleEditorGroupSizes",
  migrateFn: (value) => {
    const results = [];
    if (typeof value === "boolean") {
      value = value ? "expand" : "off";
      results.push(["workbench.editor.doubleClickTabToToggleEditorGroupSizes", { value }]);
    }
    return results;
  }
}, {
  key: LayoutSettings.EDITOR_TABS_MODE,
  migrateFn: (value) => {
    const results = [];
    if (typeof value === "boolean") {
      value = value ? EditorTabsMode.MULTIPLE : EditorTabsMode.SINGLE;
      results.push([LayoutSettings.EDITOR_TABS_MODE, { value }]);
    }
    return results;
  }
}, {
  key: "workbench.editor.tabCloseButton",
  migrateFn: (value) => {
    const result = [];
    if (value === "left" || value === "right") {
      result.push(["workbench.editor.tabActionLocation", { value }]);
    } else if (value === "off") {
      result.push(["workbench.editor.tabActionCloseVisibility", { value: false }]);
    }
    return result;
  }
}, {
  key: "zenMode.hideTabs",
  migrateFn: (value) => {
    const result = [["zenMode.hideTabs", { value: void 0 }]];
    if (value === true) {
      result.push(["zenMode.showTabs", { value: "single" }]);
    }
    return result;
  }
}]);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci93b3JrYmVuY2guY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBDb25maWd1cmF0aW9uRXh0ZW5zaW9ucywgQ29uZmlndXJhdGlvblNjb3BlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGlzTWFjaW50b3NoLCBpc1dpbmRvd3MsIGlzTGludXgsIGlzV2ViLCBpc05hdGl2ZSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25NaWdyYXRpb25Xb3JrYmVuY2hDb250cmlidXRpb24sIER5bmFtaWNXb3JrYmVuY2hTZWN1cml0eUNvbmZpZ3VyYXRpb24sIElDb25maWd1cmF0aW9uTWlncmF0aW9uUmVnaXN0cnksIHdvcmtiZW5jaENvbmZpZ3VyYXRpb25Ob2RlQmFzZSwgRXh0ZW5zaW9ucywgQ29uZmlndXJhdGlvbktleVZhbHVlUGFpcnMsIHByb2JsZW1zQ29uZmlndXJhdGlvbk5vZGVCYXNlLCB3aW5kb3dDb25maWd1cmF0aW9uTm9kZUJhc2UsIER5bmFtaWNXaW5kb3dDb25maWd1cmF0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgaXNTdGFuZGFsb25lIH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL2Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoUGhhc2UsIHJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMiB9IGZyb20gJy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IEFjdGl2aXR5QmFyUG9zaXRpb24sIEVkaXRvckFjdGlvbnNMb2NhdGlvbiwgRWRpdG9yVGFic01vZGUsIExheW91dFNldHRpbmdzIH0gZnJvbSAnLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0V2luZG93VGl0bGUsIGRlZmF1bHRXaW5kb3dUaXRsZVNlcGFyYXRvciB9IGZyb20gJy4vcGFydHMvdGl0bGViYXIvd2luZG93VGl0bGUuanMnO1xuaW1wb3J0IHsgQ3VzdG9tRWRpdG9yTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9jdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UuanMnO1xuXG5jb25zdCByZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pO1xuXG4vLyBDb25maWd1cmF0aW9uXG4oZnVuY3Rpb24gcmVnaXN0ZXJDb25maWd1cmF0aW9uKCk6IHZvaWQge1xuXG5cdC8vIE1pZ3JhdGlvbiBzdXBwb3J0XG5cdHJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihDb25maWd1cmF0aW9uTWlncmF0aW9uV29ya2JlbmNoQ29udHJpYnV0aW9uLklELCBDb25maWd1cmF0aW9uTWlncmF0aW9uV29ya2JlbmNoQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5FdmVudHVhbGx5KTtcblxuXHQvLyBEeW5hbWljIENvbmZpZ3VyYXRpb25cblx0cmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKER5bmFtaWNXb3JrYmVuY2hTZWN1cml0eUNvbmZpZ3VyYXRpb24uSUQsIER5bmFtaWNXb3JrYmVuY2hTZWN1cml0eUNvbmZpZ3VyYXRpb24sIFdvcmtiZW5jaFBoYXNlLkFmdGVyUmVzdG9yZWQpO1xuXG5cdC8vIFdvcmtiZW5jaFxuXHRyZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdC4uLndvcmtiZW5jaENvbmZpZ3VyYXRpb25Ob2RlQmFzZSxcblx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdCd3b3JrYmVuY2guZXh0ZXJuYWxCcm93c2VyJzoge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2Jyb3dzZXInLCBcIkNvbmZpZ3VyZSB0aGUgYnJvd3NlciB0byB1c2UgZm9yIG9wZW5pbmcgaHR0cCBvciBodHRwcyBsaW5rcyBleHRlcm5hbGx5LiBUaGlzIGNhbiBlaXRoZXIgYmUgdGhlIG5hbWUgb2YgdGhlIGJyb3dzZXIgKGBlZGdlYCwgYGNocm9tZWAsIGBmaXJlZm94YCkgb3IgYW4gYWJzb2x1dGUgcGF0aCB0byB0aGUgYnJvd3NlcidzIGV4ZWN1dGFibGUuIFdpbGwgdXNlIHRoZSBzeXN0ZW0gZGVmYXVsdCBpZiBub3Qgc2V0LlwiKSxcblx0XHRcdFx0aW5jbHVkZWQ6IGlzTmF0aXZlLFxuXHRcdFx0XHRyZXN0cmljdGVkOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3IudGl0bGVTY3JvbGxiYXJTaXppbmcnOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRlbnVtOiBbJ2RlZmF1bHQnLCAnbGFyZ2UnXSxcblx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLnRpdGxlU2Nyb2xsYmFyU2l6aW5nLmRlZmF1bHQnLCBcIlRoZSBkZWZhdWx0IHNpemUuXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLnRpdGxlU2Nyb2xsYmFyU2l6aW5nLmxhcmdlJywgXCJJbmNyZWFzZXMgdGhlIHNpemUsIHNvIGl0IGNhbiBiZSBncmFiYmVkIG1vcmUgZWFzaWx5IHdpdGggdGhlIG1vdXNlLlwiKVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3RhYlNjcm9sbGJhckhlaWdodCcsIFwiQ29udHJvbHMgdGhlIGhlaWdodCBvZiB0aGUgc2Nyb2xsYmFycyB1c2VkIGZvciB0YWJzIGFuZCBicmVhZGNydW1icyBpbiB0aGUgZWRpdG9yIHRpdGxlIGFyZWEuXCIpLFxuXHRcdFx0XHRkZWZhdWx0OiAnZGVmYXVsdCcsXG5cdFx0XHR9LFxuXHRcdFx0W0xheW91dFNldHRpbmdzLkVESVRPUl9UQUJTX01PREVdOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdlbnVtJzogW0VkaXRvclRhYnNNb2RlLk1VTFRJUExFLCBFZGl0b3JUYWJzTW9kZS5TSU5HTEUsIEVkaXRvclRhYnNNb2RlLk5PTkVdLFxuXHRcdFx0XHQnZW51bURlc2NyaXB0aW9ucyc6IFtcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya2JlbmNoLmVkaXRvci5zaG93VGFicy5tdWx0aXBsZScsIFwiRWFjaCBlZGl0b3IgaXMgZGlzcGxheWVkIGFzIGEgdGFiIGluIHRoZSBlZGl0b3IgdGl0bGUgYXJlYS5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3Iuc2hvd1RhYnMuc2luZ2xlJywgXCJUaGUgYWN0aXZlIGVkaXRvciBpcyBkaXNwbGF5ZWQgYXMgYSBzaW5nbGUgbGFyZ2UgdGFiIGluIHRoZSBlZGl0b3IgdGl0bGUgYXJlYS5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3Iuc2hvd1RhYnMubm9uZScsIFwiVGhlIGVkaXRvciB0aXRsZSBhcmVhIGlzIG5vdCBkaXNwbGF5ZWQuXCIpLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnc2hvd0VkaXRvclRhYnMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgb3BlbmVkIGVkaXRvcnMgc2hvdWxkIHNob3cgYXMgaW5kaXZpZHVhbCB0YWJzLCBvbmUgc2luZ2xlIGxhcmdlIHRhYiBvciBpZiB0aGUgdGl0bGUgYXJlYSBzaG91bGQgbm90IGJlIHNob3duLlwiKSxcblx0XHRcdFx0J2RlZmF1bHQnOiAnbXVsdGlwbGUnXG5cdFx0XHR9LFxuXHRcdFx0W0xheW91dFNldHRpbmdzLkVESVRPUl9BQ1RJT05TX0xPQ0FUSU9OXToge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHQnZW51bSc6IFtFZGl0b3JBY3Rpb25zTG9jYXRpb24uREVGQVVMVCwgRWRpdG9yQWN0aW9uc0xvY2F0aW9uLlRJVExFQkFSLCBFZGl0b3JBY3Rpb25zTG9jYXRpb24uSElEREVOXSxcblx0XHRcdFx0J21hcmtkb3duRW51bURlc2NyaXB0aW9ucyc6IFtcblx0XHRcdFx0XHRsb2NhbGl6ZSh7IGNvbW1lbnQ6IFsnezB9IHdpbGwgYmUgYSBzZXR0aW5nIG5hbWUgcmVuZGVyZWQgYXMgYSBsaW5rJ10sIGtleTogJ3dvcmtiZW5jaC5lZGl0b3IuZWRpdG9yQWN0aW9uc0xvY2F0aW9uLmRlZmF1bHQnIH0sIFwiU2hvdyBlZGl0b3IgYWN0aW9ucyBpbiB0aGUgd2luZG93IHRpdGxlIGJhciB3aGVuIHswfSBpcyBzZXQgdG8gezF9LiBPdGhlcndpc2UsIGVkaXRvciBhY3Rpb25zIGFyZSBzaG93biBpbiB0aGUgZWRpdG9yIHRhYiBiYXIuXCIsICdgI3dvcmtiZW5jaC5lZGl0b3Iuc2hvd1RhYnMjYCcsICdgbm9uZWAnKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSh7IGNvbW1lbnQ6IFsnezB9IHdpbGwgYmUgYSBzZXR0aW5nIG5hbWUgcmVuZGVyZWQgYXMgYSBsaW5rJ10sIGtleTogJ3dvcmtiZW5jaC5lZGl0b3IuZWRpdG9yQWN0aW9uc0xvY2F0aW9uLnRpdGxlQmFyJyB9LCBcIlNob3cgZWRpdG9yIGFjdGlvbnMgaW4gdGhlIHdpbmRvdyB0aXRsZSBiYXIuIElmIHswfSBpcyBzZXQgdG8gezF9LCBlZGl0b3IgYWN0aW9ucyBhcmUgaGlkZGVuLlwiLCAnYCN3aW5kb3cuY3VzdG9tVGl0bGVCYXJWaXNpYmlsaXR5I2AnLCAnYG5ldmVyYCcpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLmVkaXRvckFjdGlvbnNMb2NhdGlvbi5oaWRkZW4nLCBcIkVkaXRvciBhY3Rpb25zIGFyZSBub3Qgc2hvd24uXCIpLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKCdlZGl0b3JBY3Rpb25zTG9jYXRpb24nLCBcIkNvbnRyb2xzIHdoZXJlIHRoZSBlZGl0b3IgYWN0aW9ucyBhcmUgc2hvd24uXCIpLFxuXHRcdFx0XHQnZGVmYXVsdCc6ICdkZWZhdWx0J1xuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLmFsd2F5c1Nob3dFZGl0b3JBY3Rpb25zJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYWx3YXlzU2hvd0VkaXRvckFjdGlvbnMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdG8gYWx3YXlzIHNob3cgdGhlIGVkaXRvciBhY3Rpb25zLCBldmVuIHdoZW4gdGhlIGVkaXRvciBncm91cCBpcyBub3QgYWN0aXZlLlwiKSxcblx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLndyYXBUYWJzJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSh7IGNvbW1lbnQ6IFsnezB9LCB7MX0gd2lsbCBiZSBhIHNldHRpbmcgbmFtZSByZW5kZXJlZCBhcyBhIGxpbmsnXSwga2V5OiAnd3JhcFRhYnMnIH0sIFwiQ29udHJvbHMgd2hldGhlciB0YWJzIHNob3VsZCBiZSB3cmFwcGVkIG92ZXIgbXVsdGlwbGUgbGluZXMgd2hlbiBleGNlZWRpbmcgYXZhaWxhYmxlIHNwYWNlIG9yIHdoZXRoZXIgYSBzY3JvbGxiYXIgc2hvdWxkIGFwcGVhciBpbnN0ZWFkLiBUaGlzIHZhbHVlIGlzIGlnbm9yZWQgd2hlbiB7MH0gaXMgbm90IHNldCB0byAnezF9Jy5cIiwgJ2Ajd29ya2JlbmNoLmVkaXRvci5zaG93VGFicyNgJywgJ2BtdWx0aXBsZWAnKSxcblx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLnNjcm9sbFRvU3dpdGNoVGFicyc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbG9jYWxpemUoeyBjb21tZW50OiBbJ3swfSwgezF9IHdpbGwgYmUgYSBzZXR0aW5nIG5hbWUgcmVuZGVyZWQgYXMgYSBsaW5rJ10sIGtleTogJ3Njcm9sbFRvU3dpdGNoVGFicycgfSwgXCJDb250cm9scyB3aGV0aGVyIHNjcm9sbGluZyBvdmVyIHRhYnMgd2lsbCBvcGVuIHRoZW0gb3Igbm90LiBCeSBkZWZhdWx0IHRhYnMgd2lsbCBvbmx5IHJldmVhbCB1cG9uIHNjcm9sbGluZywgYnV0IG5vdCBvcGVuLiBZb3UgY2FuIHByZXNzIGFuZCBob2xkIHRoZSBTaGlmdC1rZXkgd2hpbGUgc2Nyb2xsaW5nIHRvIGNoYW5nZSB0aGlzIGJlaGF2aW9yIGZvciB0aGF0IGR1cmF0aW9uLiBUaGlzIHZhbHVlIGlzIGlnbm9yZWQgd2hlbiB7MH0gaXMgbm90IHNldCB0byB7MX0uXCIsICdgI3dvcmtiZW5jaC5lZGl0b3Iuc2hvd1RhYnMjYCcsICdgbXVsdGlwbGVgJyksXG5cdFx0XHRcdCdkZWZhdWx0JzogZmFsc2Vcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmVkaXRvci5oaWdobGlnaHRNb2RpZmllZFRhYnMnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKHsgY29tbWVudDogWyd7MH0sIHsxfSB3aWxsIGJlIGEgc2V0dGluZyBuYW1lIHJlbmRlcmVkIGFzIGEgbGluayddLCBrZXk6ICdoaWdobGlnaHRNb2RpZmllZFRhYnMnIH0sIFwiQ29udHJvbHMgd2hldGhlciBhIHRvcCBib3JkZXIgaXMgZHJhd24gb24gdGFicyBmb3IgZWRpdG9ycyB0aGF0IGhhdmUgdW5zYXZlZCBjaGFuZ2VzLiBUaGlzIHZhbHVlIGlzIGlnbm9yZWQgd2hlbiB7MH0gaXMgbm90IHNldCB0byB7MX0uXCIsICdgI3dvcmtiZW5jaC5lZGl0b3Iuc2hvd1RhYnMjYCcsIGBtdWx0aXBsZWApLFxuXHRcdFx0XHQnZGVmYXVsdCc6IGZhbHNlXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3IuZGVjb3JhdGlvbnMuYmFkZ2VzJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnZGVjb3JhdGlvbnMuYmFkZ2VzJywgXCJDb250cm9scyB3aGV0aGVyIGVkaXRvciBmaWxlIGRlY29yYXRpb25zIHNob3VsZCB1c2UgYmFkZ2VzLlwiKSxcblx0XHRcdFx0J2RlZmF1bHQnOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3IuZGVjb3JhdGlvbnMuY29sb3JzJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnZGVjb3JhdGlvbnMuY29sb3JzJywgXCJDb250cm9scyB3aGV0aGVyIGVkaXRvciBmaWxlIGRlY29yYXRpb25zIHNob3VsZCB1c2UgY29sb3JzLlwiKSxcblx0XHRcdFx0J2RlZmF1bHQnOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0W0N1c3RvbUVkaXRvckxhYmVsU2VydmljZS5TRVRUSU5HX0lEX0VOQUJMRURdOiB7XG5cdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLmxhYmVsLmVuYWJsZWQnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGN1c3RvbSB3b3JrYmVuY2ggZWRpdG9yIGxhYmVscyBzaG91bGQgYmUgYXBwbGllZC5cIiksXG5cdFx0XHRcdCdkZWZhdWx0JzogdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHRbQ3VzdG9tRWRpdG9yTGFiZWxTZXJ2aWNlLlNFVFRJTkdfSURfUEFUVEVSTlNdOiB7XG5cdFx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogKCgpID0+IHtcblx0XHRcdFx0XHRsZXQgY3VzdG9tRWRpdG9yTGFiZWxEZXNjcmlwdGlvbiA9IGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLmxhYmVsLnBhdHRlcm5zJywgXCJDb250cm9scyB0aGUgcmVuZGVyaW5nIG9mIHRoZSBlZGl0b3IgbGFiZWwuIEVhY2ggX19JdGVtX18gaXMgYSBwYXR0ZXJuIHRoYXQgbWF0Y2hlcyBhIGZpbGUgcGF0aC4gQm90aCByZWxhdGl2ZSBhbmQgYWJzb2x1dGUgZmlsZSBwYXRocyBhcmUgc3VwcG9ydGVkLiBUaGUgcmVsYXRpdmUgcGF0aCBtdXN0IGluY2x1ZGUgdGhlIFdPUktTUEFDRV9GT0xERVIgKGUuZyBgV09SS1NQQUNFX0ZPTERFUi9zcmMvKioudHN4YCBvciBgKi9zcmMvKioudHN4YCkuIEFic29sdXRlIHBhdHRlcm5zIG11c3Qgc3RhcnQgd2l0aCBhIGAvYC4gSW4gY2FzZSBtdWx0aXBsZSBwYXR0ZXJucyBtYXRjaCwgdGhlIGxvbmdlc3QgbWF0Y2hpbmcgcGF0aCB3aWxsIGJlIHBpY2tlZC4gRWFjaCBfX1ZhbHVlX18gaXMgdGhlIHRlbXBsYXRlIGZvciB0aGUgcmVuZGVyZWQgZWRpdG9yIHdoZW4gdGhlIF9fSXRlbV9fIG1hdGNoZXMuIFZhcmlhYmxlcyBhcmUgc3Vic3RpdHV0ZWQgYmFzZWQgb24gdGhlIGNvbnRleHQ6XCIpO1xuXHRcdFx0XHRcdGN1c3RvbUVkaXRvckxhYmVsRGVzY3JpcHRpb24gKz0gJ1xcbi0gJyArIFtcblx0XHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLmxhYmVsLmRpcm5hbWUnLCBcImAke2Rpcm5hbWV9YDogbmFtZSBvZiB0aGUgZm9sZGVyIGluIHdoaWNoIHRoZSBmaWxlIGlzIGxvY2F0ZWQgKGUuZy4gYFdPUktTUEFDRV9GT0xERVIvZm9sZGVyL2ZpbGUudHh0IC0+IGZvbGRlcmApLlwiKSxcblx0XHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLmxhYmVsLm50aGRpcm5hbWUnLCBcImAke2Rpcm5hbWUoTil9YDogbmFtZSBvZiB0aGUgbnRoIHBhcmVudCBmb2xkZXIgaW4gd2hpY2ggdGhlIGZpbGUgaXMgbG9jYXRlZCAoZS5nLiBgTj0yOiBXT1JLU1BBQ0VfRk9MREVSL3N0YXRpYy9mb2xkZXIvZmlsZS50eHQgLT4gV09SS1NQQUNFX0ZPTERFUmApLiBGb2xkZXJzIGNhbiBiZSBwaWNrZWQgZnJvbSB0aGUgc3RhcnQgb2YgdGhlIHBhdGggYnkgdXNpbmcgbmVnYXRpdmUgbnVtYmVycyAoZS5nLiBgTj0tMTogV09SS1NQQUNFX0ZPTERFUi9mb2xkZXIvZmlsZS50eHQgLT4gV09SS1NQQUNFX0ZPTERFUmApLiBJZiB0aGUgX19JdGVtX18gaXMgYW4gYWJzb2x1dGUgcGF0dGVybiBwYXRoLCB0aGUgZmlyc3QgZm9sZGVyIChgTj0tMWApIHJlZmVycyB0byB0aGUgZmlyc3QgZm9sZGVyIGluIHRoZSBhYnNvbHV0ZSBwYXRoLCBvdGhlcndpc2UgaXQgY29ycmVzcG9uZHMgdG8gdGhlIHdvcmtzcGFjZSBmb2xkZXIuXCIpLFxuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3IubGFiZWwuZmlsZW5hbWUnLCBcImAke2ZpbGVuYW1lfWA6IG5hbWUgb2YgdGhlIGZpbGUgd2l0aG91dCB0aGUgZmlsZSBleHRlbnNpb24gKGUuZy4gYFdPUktTUEFDRV9GT0xERVIvZm9sZGVyL2ZpbGUudHh0IC0+IGZpbGVgKS5cIiksXG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya2JlbmNoLmVkaXRvci5sYWJlbC5leHRuYW1lJywgXCJgJHtleHRuYW1lfWA6IHRoZSBmaWxlIGV4dGVuc2lvbiAoZS5nLiBgV09SS1NQQUNFX0ZPTERFUi9mb2xkZXIvZmlsZS50eHQgLT4gdHh0YCkuXCIpLFxuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3IubGFiZWwubnRoZXh0bmFtZScsIFwiYCR7ZXh0bmFtZShOKX1gOiB0aGUgbnRoIGV4dGVuc2lvbiBvZiB0aGUgZmlsZSBzZXBhcmF0ZWQgYnkgJy4nIChlLmcuIGBOPTI6IFdPUktTUEFDRV9GT0xERVIvZm9sZGVyL2ZpbGUuZXh0MS5leHQyLmV4dDMgLT4gZXh0MWApLiBFeHRlbnNpb24gY2FuIGJlIHBpY2tlZCBmcm9tIHRoZSBzdGFydCBvZiB0aGUgZXh0ZW5zaW9uIGJ5IHVzaW5nIG5lZ2F0aXZlIG51bWJlcnMgKGUuZy4gYE49LTE6IFdPUktTUEFDRV9GT0xERVIvZm9sZGVyL2ZpbGUuZXh0MS5leHQyLmV4dDMgLT4gZXh0MmApLlwiKSxcblx0XHRcdFx0XHRdLmpvaW4oJ1xcbi0gJyk7IC8vIGludGVudGlvbmFsbHkgY29uY2F0ZW5hdGVkIHRvIG5vdCBwcm9kdWNlIGEgc3RyaW5nIHRoYXQgaXMgdG9vIGxvbmcgZm9yIHRyYW5zbGF0aW9uc1xuXHRcdFx0XHRcdGN1c3RvbUVkaXRvckxhYmVsRGVzY3JpcHRpb24gKz0gJ1xcblxcbicgKyBsb2NhbGl6ZSgnY3VzdG9tRWRpdG9yTGFiZWxEZXNjcmlwdGlvbkV4YW1wbGUnLCBcIkV4YW1wbGU6IGBcXFwiKiovc3RhdGljLyoqLyouaHRtbFxcXCI6IFxcXCIke2ZpbGVuYW1lfSAtICR7ZGlybmFtZX0gKCR7ZXh0bmFtZX0pXFxcImAgd2lsbCByZW5kZXIgYSBmaWxlIGBXT1JLU1BBQ0VfRk9MREVSL3N0YXRpYy9mb2xkZXIvZmlsZS5odG1sYCBhcyBgZmlsZSAtIGZvbGRlciAoaHRtbClgLlwiKTtcblxuXHRcdFx0XHRcdHJldHVybiBjdXN0b21FZGl0b3JMYWJlbERlc2NyaXB0aW9uO1xuXHRcdFx0XHR9KSgpLFxuXHRcdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczpcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHR5cGU6IFsnc3RyaW5nJywgJ251bGwnXSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmVkaXRvci5sYWJlbC50ZW1wbGF0ZScsIFwiVGhlIHRlbXBsYXRlIHdoaWNoIHNob3VsZCBiZSByZW5kZXJlZCB3aGVuIHRoZSBwYXR0ZXJuIG1hdGNoZXMuIE1heSBpbmNsdWRlIHRoZSB2YXJpYWJsZXMgJHtkaXJuYW1lfSwgJHtmaWxlbmFtZX0gYW5kICR7ZXh0bmFtZX0uXCIpLFxuXHRcdFx0XHRcdG1pbkxlbmd0aDogMSxcblx0XHRcdFx0XHRwYXR0ZXJuOiAnLipbYS16QS1aMC05XS4qJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHQnZGVmYXVsdCc6IHt9XG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3IubGFiZWxGb3JtYXQnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdlbnVtJzogWydkZWZhdWx0JywgJ3Nob3J0JywgJ21lZGl1bScsICdsb25nJ10sXG5cdFx0XHRcdCdlbnVtRGVzY3JpcHRpb25zJzogW1xuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLmxhYmVsRm9ybWF0LmRlZmF1bHQnLCBcIlNob3cgdGhlIG5hbWUgb2YgdGhlIGZpbGUuIFdoZW4gdGFicyBhcmUgZW5hYmxlZCBhbmQgdHdvIGZpbGVzIGhhdmUgdGhlIHNhbWUgbmFtZSBpbiBvbmUgZ3JvdXAgdGhlIGRpc3Rpbmd1aXNoaW5nIHNlY3Rpb25zIG9mIGVhY2ggZmlsZSdzIHBhdGggYXJlIGFkZGVkLiBXaGVuIHRhYnMgYXJlIGRpc2FibGVkLCB0aGUgcGF0aCByZWxhdGl2ZSB0byB0aGUgd29ya3NwYWNlIGZvbGRlciBpcyBzaG93biBpZiB0aGUgZWRpdG9yIGlzIGFjdGl2ZS5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3IubGFiZWxGb3JtYXQuc2hvcnQnLCBcIlNob3cgdGhlIG5hbWUgb2YgdGhlIGZpbGUgZm9sbG93ZWQgYnkgaXRzIGRpcmVjdG9yeSBuYW1lLlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya2JlbmNoLmVkaXRvci5sYWJlbEZvcm1hdC5tZWRpdW0nLCBcIlNob3cgdGhlIG5hbWUgb2YgdGhlIGZpbGUgZm9sbG93ZWQgYnkgaXRzIHBhdGggcmVsYXRpdmUgdG8gdGhlIHdvcmtzcGFjZSBmb2xkZXIuXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLmxhYmVsRm9ybWF0LmxvbmcnLCBcIlNob3cgdGhlIG5hbWUgb2YgdGhlIGZpbGUgZm9sbG93ZWQgYnkgaXRzIGFic29sdXRlIHBhdGguXCIpXG5cdFx0XHRcdF0sXG5cdFx0XHRcdCdkZWZhdWx0JzogJ2RlZmF1bHQnLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgndGFiRGVzY3JpcHRpb24nLCBcIkNvbnRyb2xzIHRoZSBmb3JtYXQgb2YgdGhlIGxhYmVsIGZvciBhbiBlZGl0b3IuXCIpLFxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLnVudGl0bGVkLmxhYmVsRm9ybWF0Jzoge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHQnZW51bSc6IFsnY29udGVudCcsICduYW1lJ10sXG5cdFx0XHRcdCdlbnVtRGVzY3JpcHRpb25zJzogW1xuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLnVudGl0bGVkLmxhYmVsRm9ybWF0LmNvbnRlbnQnLCBcIlRoZSBuYW1lIG9mIHRoZSB1bnRpdGxlZCBmaWxlIGlzIGRlcml2ZWQgZnJvbSB0aGUgY29udGVudHMgb2YgaXRzIGZpcnN0IGxpbmUgdW5sZXNzIGl0IGhhcyBhbiBhc3NvY2lhdGVkIGZpbGUgcGF0aC4gSXQgd2lsbCBmYWxsYmFjayB0byB0aGUgbmFtZSBpbiBjYXNlIHRoZSBsaW5lIGlzIGVtcHR5IG9yIGNvbnRhaW5zIG5vIHdvcmQgY2hhcmFjdGVycy5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3IudW50aXRsZWQubGFiZWxGb3JtYXQubmFtZScsIFwiVGhlIG5hbWUgb2YgdGhlIHVudGl0bGVkIGZpbGUgaXMgbm90IGRlcml2ZWQgZnJvbSB0aGUgY29udGVudHMgb2YgdGhlIGZpbGUuXCIpLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHQnZGVmYXVsdCc6ICdjb250ZW50Jyxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3VudGl0bGVkTGFiZWxGb3JtYXQnLCBcIkNvbnRyb2xzIHRoZSBmb3JtYXQgb2YgdGhlIGxhYmVsIGZvciBhbiB1bnRpdGxlZCBlZGl0b3IuXCIpLFxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLmVtcHR5LmhpbnQnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdlbnVtJzogWyd0ZXh0JywgJ2hpZGRlbiddLFxuXHRcdFx0XHQnZGVmYXVsdCc6ICd0ZXh0Jyxcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZShcIndvcmtiZW5jaC5lZGl0b3IuZW1wdHkuaGludFwiLCBcIkNvbnRyb2xzIGlmIHRoZSBlbXB0eSBlZGl0b3IgdGV4dCBoaW50IHNob3VsZCBiZSB2aXNpYmxlIGluIHRoZSBlZGl0b3IuXCIpXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3IubGFuZ3VhZ2VEZXRlY3Rpb24nOiB7XG5cdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLmxhbmd1YWdlRGV0ZWN0aW9uJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBsYW5ndWFnZSBpbiBhIHRleHQgZWRpdG9yIGlzIGF1dG9tYXRpY2FsbHkgZGV0ZWN0ZWQgdW5sZXNzIHRoZSBsYW5ndWFnZSBoYXMgYmVlbiBleHBsaWNpdGx5IHNldCBieSB0aGUgbGFuZ3VhZ2UgcGlja2VyLiBUaGlzIGNhbiBhbHNvIGJlIHNjb3BlZCBieSBsYW5ndWFnZSBzbyB5b3UgY2FuIHNwZWNpZnkgd2hpY2ggbGFuZ3VhZ2VzIHlvdSBkbyBub3Qgd2FudCB0byBiZSBzd2l0Y2hlZCBvZmYgb2YuIFRoaXMgaXMgdXNlZnVsIGZvciBsYW5ndWFnZXMgbGlrZSBNYXJrZG93biB0aGF0IG9mdGVuIGNvbnRhaW4gb3RoZXIgbGFuZ3VhZ2VzIHRoYXQgbWlnaHQgdHJpY2sgbGFuZ3VhZ2UgZGV0ZWN0aW9uIGludG8gdGhpbmtpbmcgaXQncyB0aGUgZW1iZWRkZWQgbGFuZ3VhZ2UgYW5kIG5vdCBNYXJrZG93bi5cIiksXG5cdFx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEVcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmVkaXRvci5oaXN0b3J5QmFzZWRMYW5ndWFnZURldGVjdGlvbic6IHtcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3IuaGlzdG9yeUJhc2VkTGFuZ3VhZ2VEZXRlY3Rpb24nLCBcIkVuYWJsZXMgdXNlIG9mIGVkaXRvciBoaXN0b3J5IGluIGxhbmd1YWdlIGRldGVjdGlvbi4gVGhpcyBjYXVzZXMgYXV0b21hdGljIGxhbmd1YWdlIGRldGVjdGlvbiB0byBmYXZvciBsYW5ndWFnZXMgdGhhdCBoYXZlIGJlZW4gcmVjZW50bHkgb3BlbmVkIGFuZCBhbGxvd3MgZm9yIGF1dG9tYXRpYyBsYW5ndWFnZSBkZXRlY3Rpb24gdG8gb3BlcmF0ZSB3aXRoIHNtYWxsZXIgaW5wdXRzLlwiKSxcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmVkaXRvci5wcmVmZXJIaXN0b3J5QmFzZWRMYW5ndWFnZURldGVjdGlvbic6IHtcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRkZWZhdWx0OiBmYWxzZSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLnByZWZlckJhc2VkTGFuZ3VhZ2VEZXRlY3Rpb24nLCBcIldoZW4gZW5hYmxlZCwgYSBsYW5ndWFnZSBkZXRlY3Rpb24gbW9kZWwgdGhhdCB0YWtlcyBpbnRvIGFjY291bnQgZWRpdG9yIGhpc3Rvcnkgd2lsbCBiZSBnaXZlbiBoaWdoZXIgcHJlY2VkZW5jZS5cIiksXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3IubGFuZ3VhZ2VEZXRlY3Rpb25IaW50cyc6IHtcblx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdGRlZmF1bHQ6IHsgJ3VudGl0bGVkRWRpdG9ycyc6IHRydWUsICdub3RlYm9va0VkaXRvcnMnOiB0cnVlIH0sXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmVkaXRvci5zaG93TGFuZ3VhZ2VEZXRlY3Rpb25IaW50cycsIFwiV2hlbiBlbmFibGVkLCBzaG93cyBhIFN0YXR1cyBiYXIgUXVpY2sgRml4IHdoZW4gdGhlIGVkaXRvciBsYW5ndWFnZSBkb2Vzbid0IG1hdGNoIGRldGVjdGVkIGNvbnRlbnQgbGFuZ3VhZ2UuXCIpLFxuXHRcdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHR1bnRpdGxlZEVkaXRvcnM6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmVkaXRvci5zaG93TGFuZ3VhZ2VEZXRlY3Rpb25IaW50cy5lZGl0b3JzJywgXCJTaG93IGluIHVudGl0bGVkIHRleHQgZWRpdG9yc1wiKSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdG5vdGVib29rRWRpdG9yczoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLnNob3dMYW5ndWFnZURldGVjdGlvbkhpbnRzLm5vdGVib29rJywgXCJTaG93IGluIG5vdGVib29rIGVkaXRvcnNcIiksXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3IudGFiQWN0aW9uTG9jYXRpb24nOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRlbnVtOiBbJ2xlZnQnLCAncmlnaHQnXSxcblx0XHRcdFx0ZGVmYXVsdDogJ3JpZ2h0Jyxcblx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoeyBjb21tZW50OiBbJ3swfSB3aWxsIGJlIGEgc2V0dGluZyBuYW1lIHJlbmRlcmVkIGFzIGEgbGluayddLCBrZXk6ICd0YWJBY3Rpb25Mb2NhdGlvbicgfSwgXCJDb250cm9scyB0aGUgcG9zaXRpb24gb2YgdGhlIGVkaXRvcidzIHRhYnMgYWN0aW9uIGJ1dHRvbnMgKGNsb3NlLCB1bnBpbikuIFRoaXMgdmFsdWUgaXMgaWdub3JlZCB3aGVuIHswfSBpcyBub3Qgc2V0IHRvIHsxfS5cIiwgJ2Ajd29ya2JlbmNoLmVkaXRvci5zaG93VGFicyNgJywgJ2BtdWx0aXBsZWAnKVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLnRhYkFjdGlvbkNsb3NlVmlzaWJpbGl0eSc6IHtcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3IudGFiQWN0aW9uQ2xvc2VWaXNpYmlsaXR5JywgXCJDb250cm9scyB0aGUgdmlzaWJpbGl0eSBvZiB0aGUgdGFiIGNsb3NlIGFjdGlvbiBidXR0b24uXCIpXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3IudGFiQWN0aW9uVW5waW5WaXNpYmlsaXR5Jzoge1xuXHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmVkaXRvci50YWJBY3Rpb25VbnBpblZpc2liaWxpdHknLCBcIkNvbnRyb2xzIHRoZSB2aXNpYmlsaXR5IG9mIHRoZSB0YWIgdW5waW4gYWN0aW9uIGJ1dHRvbi5cIilcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmVkaXRvci50YWJTaXppbmcnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdlbnVtJzogWydmaXQnLCAnc2hyaW5rJywgJ2ZpeGVkJ10sXG5cdFx0XHRcdCdkZWZhdWx0JzogJ2ZpdCcsXG5cdFx0XHRcdCdlbnVtRGVzY3JpcHRpb25zJzogW1xuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLnRhYlNpemluZy5maXQnLCBcIkFsd2F5cyBrZWVwIHRhYnMgbGFyZ2UgZW5vdWdoIHRvIHNob3cgdGhlIGZ1bGwgZWRpdG9yIGxhYmVsLlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya2JlbmNoLmVkaXRvci50YWJTaXppbmcuc2hyaW5rJywgXCJBbGxvdyB0YWJzIHRvIGdldCBzbWFsbGVyIHdoZW4gdGhlIGF2YWlsYWJsZSBzcGFjZSBpcyBub3QgZW5vdWdoIHRvIHNob3cgYWxsIHRhYnMgYXQgb25jZS5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3IudGFiU2l6aW5nLmZpeGVkJywgXCJNYWtlIGFsbCB0YWJzIHRoZSBzYW1lIHNpemUsIHdoaWxlIGFsbG93aW5nIHRoZW0gdG8gZ2V0IHNtYWxsZXIgd2hlbiB0aGUgYXZhaWxhYmxlIHNwYWNlIGlzIG5vdCBlbm91Z2ggdG8gc2hvdyBhbGwgdGFicyBhdCBvbmNlLlwiKVxuXHRcdFx0XHRdLFxuXHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKHsgY29tbWVudDogWyd7MH0sIHsxfSB3aWxsIGJlIGEgc2V0dGluZyBuYW1lIHJlbmRlcmVkIGFzIGEgbGluayddLCBrZXk6ICd0YWJTaXppbmcnIH0sIFwiQ29udHJvbHMgdGhlIHNpemUgb2YgZWRpdG9yIHRhYnMuIFRoaXMgdmFsdWUgaXMgaWdub3JlZCB3aGVuIHswfSBpcyBub3Qgc2V0IHRvIHsxfS5cIiwgJ2Ajd29ya2JlbmNoLmVkaXRvci5zaG93VGFicyNgJywgJ2BtdWx0aXBsZWAnKVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLnRhYlNpemluZ0ZpeGVkTWluV2lkdGgnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ251bWJlcicsXG5cdFx0XHRcdCdkZWZhdWx0JzogNTAsXG5cdFx0XHRcdCdtaW5pbXVtJzogMzgsXG5cdFx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbG9jYWxpemUoeyBjb21tZW50OiBbJ3swfSwgezF9IHdpbGwgYmUgYSBzZXR0aW5nIG5hbWUgcmVuZGVyZWQgYXMgYSBsaW5rJ10sIGtleTogJ3dvcmtiZW5jaC5lZGl0b3IudGFiU2l6aW5nRml4ZWRNaW5XaWR0aCcgfSwgXCJDb250cm9scyB0aGUgbWluaW11bSB3aWR0aCBvZiB0YWJzIHdoZW4gezB9IHNpemUgaXMgc2V0IHRvIHsxfS5cIiwgJ2Ajd29ya2JlbmNoLmVkaXRvci50YWJTaXppbmcjYCcsICdgZml4ZWRgJylcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmVkaXRvci50YWJTaXppbmdGaXhlZE1heFdpZHRoJzoge1xuXHRcdFx0XHQndHlwZSc6ICdudW1iZXInLFxuXHRcdFx0XHQnZGVmYXVsdCc6IDE2MCxcblx0XHRcdFx0J21pbmltdW0nOiAzOCxcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSh7IGNvbW1lbnQ6IFsnezB9LCB7MX0gd2lsbCBiZSBhIHNldHRpbmcgbmFtZSByZW5kZXJlZCBhcyBhIGxpbmsnXSwga2V5OiAnd29ya2JlbmNoLmVkaXRvci50YWJTaXppbmdGaXhlZE1heFdpZHRoJyB9LCBcIkNvbnRyb2xzIHRoZSBtYXhpbXVtIHdpZHRoIG9mIHRhYnMgd2hlbiB7MH0gc2l6ZSBpcyBzZXQgdG8gezF9LlwiLCAnYCN3b3JrYmVuY2guZWRpdG9yLnRhYlNpemluZyNgJywgJ2BmaXhlZGAnKVxuXHRcdFx0fSxcblx0XHRcdCd3aW5kb3cuZGVuc2l0eS5lZGl0b3JUYWJIZWlnaHQnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdlbnVtJzogWydkZWZhdWx0JywgJ2NvbXBhY3QnXSxcblx0XHRcdFx0J2RlZmF1bHQnOiAnZGVmYXVsdCcsXG5cdFx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbG9jYWxpemUoeyBjb21tZW50OiBbJ3swfSwgezF9IHdpbGwgYmUgYSBzZXR0aW5nIG5hbWUgcmVuZGVyZWQgYXMgYSBsaW5rJ10sIGtleTogJ3dvcmtiZW5jaC5lZGl0b3IudGFiSGVpZ2h0JyB9LCBcIkNvbnRyb2xzIHRoZSBoZWlnaHQgb2YgZWRpdG9yIHRhYnMuIEFsc28gYXBwbGllcyB0byB0aGUgdGl0bGUgY29udHJvbCBiYXIgd2hlbiB7MH0gaXMgbm90IHNldCB0byB7MX0uXCIsICdgI3dvcmtiZW5jaC5lZGl0b3Iuc2hvd1RhYnMjYCcsICdgbXVsdGlwbGVgJylcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmVkaXRvci5waW5uZWRUYWJTaXppbmcnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdlbnVtJzogWydub3JtYWwnLCAnY29tcGFjdCcsICdzaHJpbmsnXSxcblx0XHRcdFx0J2RlZmF1bHQnOiAnbm9ybWFsJyxcblx0XHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3IucGlubmVkVGFiU2l6aW5nLm5vcm1hbCcsIFwiQSBwaW5uZWQgdGFiIGluaGVyaXRzIHRoZSBsb29rIG9mIG5vbiBwaW5uZWQgdGFicy5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3IucGlubmVkVGFiU2l6aW5nLmNvbXBhY3QnLCBcIkEgcGlubmVkIHRhYiB3aWxsIHNob3cgaW4gYSBjb21wYWN0IGZvcm0gd2l0aCBvbmx5IGljb24gb3IgZmlyc3QgbGV0dGVyIG9mIHRoZSBlZGl0b3IgbmFtZS5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3IucGlubmVkVGFiU2l6aW5nLnNocmluaycsIFwiQSBwaW5uZWQgdGFiIHNocmlua3MgdG8gYSBjb21wYWN0IGZpeGVkIHNpemUgc2hvd2luZyBwYXJ0cyBvZiB0aGUgZWRpdG9yIG5hbWUuXCIpXG5cdFx0XHRcdF0sXG5cdFx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbG9jYWxpemUoeyBjb21tZW50OiBbJ3swfSwgezF9IHdpbGwgYmUgYSBzZXR0aW5nIG5hbWUgcmVuZGVyZWQgYXMgYSBsaW5rJ10sIGtleTogJ3Bpbm5lZFRhYlNpemluZycgfSwgXCJDb250cm9scyB0aGUgc2l6ZSBvZiBwaW5uZWQgZWRpdG9yIHRhYnMuIFBpbm5lZCB0YWJzIGFyZSBzb3J0ZWQgdG8gdGhlIGJlZ2lubmluZyBvZiBhbGwgb3BlbmVkIHRhYnMgYW5kIHR5cGljYWxseSBkbyBub3QgY2xvc2UgdW50aWwgdW5waW5uZWQuIFRoaXMgdmFsdWUgaXMgaWdub3JlZCB3aGVuIHswfSBpcyBub3Qgc2V0IHRvIHsxfS5cIiwgJ2Ajd29ya2JlbmNoLmVkaXRvci5zaG93VGFicyNgJywgJ2BtdWx0aXBsZWAnKVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLnBpbm5lZFRhYnNPblNlcGFyYXRlUm93Jzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZSxcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSh7IGNvbW1lbnQ6IFsnezB9LCB7MX0gd2lsbCBiZSBhIHNldHRpbmcgbmFtZSByZW5kZXJlZCBhcyBhIGxpbmsnXSwga2V5OiAnd29ya2JlbmNoLmVkaXRvci5waW5uZWRUYWJzT25TZXBhcmF0ZVJvdycgfSwgXCJXaGVuIGVuYWJsZWQsIGRpc3BsYXlzIHBpbm5lZCB0YWJzIGluIGEgc2VwYXJhdGUgcm93IGFib3ZlIGFsbCBvdGhlciB0YWJzLiBUaGlzIHZhbHVlIGlzIGlnbm9yZWQgd2hlbiB7MH0gaXMgbm90IHNldCB0byB7MX0uXCIsICdgI3dvcmtiZW5jaC5lZGl0b3Iuc2hvd1RhYnMjYCcsICdgbXVsdGlwbGVgJyksXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3IucHJldmVudFBpbm5lZEVkaXRvckNsb3NlJzoge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHQnZW51bSc6IFsna2V5Ym9hcmRBbmRNb3VzZScsICdrZXlib2FyZCcsICdtb3VzZScsICduZXZlciddLFxuXHRcdFx0XHQnZGVmYXVsdCc6ICdrZXlib2FyZEFuZE1vdXNlJyxcblx0XHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3IucHJldmVudFBpbm5lZEVkaXRvckNsb3NlLmFsd2F5cycsIFwiQWx3YXlzIHByZXZlbnQgY2xvc2luZyB0aGUgcGlubmVkIGVkaXRvciB3aGVuIHVzaW5nIG1vdXNlIG1pZGRsZSBjbGljayBvciBrZXlib2FyZC5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3IucHJldmVudFBpbm5lZEVkaXRvckNsb3NlLm9ubHlLZXlib2FyZCcsIFwiUHJldmVudCBjbG9zaW5nIHRoZSBwaW5uZWQgZWRpdG9yIHdoZW4gdXNpbmcgdGhlIGtleWJvYXJkLlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya2JlbmNoLmVkaXRvci5wcmV2ZW50UGlubmVkRWRpdG9yQ2xvc2Uub25seU1vdXNlJywgXCJQcmV2ZW50IGNsb3NpbmcgdGhlIHBpbm5lZCBlZGl0b3Igd2hlbiB1c2luZyBtb3VzZSBtaWRkbGUgY2xpY2suXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLnByZXZlbnRQaW5uZWRFZGl0b3JDbG9zZS5uZXZlcicsIFwiTmV2ZXIgcHJldmVudCBjbG9zaW5nIGEgcGlubmVkIGVkaXRvci5cIilcblx0XHRcdFx0XSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLnByZXZlbnRQaW5uZWRFZGl0b3JDbG9zZScsIFwiQ29udHJvbHMgd2hldGhlciBwaW5uZWQgZWRpdG9ycyBzaG91bGQgY2xvc2Ugd2hlbiBrZXlib2FyZCBvciBtaWRkbGUgbW91c2UgY2xpY2sgaXMgdXNlZCBmb3IgY2xvc2luZy5cIiksXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3Iuc3BsaXRTaXppbmcnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdlbnVtJzogWydhdXRvJywgJ2Rpc3RyaWJ1dGUnLCAnc3BsaXQnXSxcblx0XHRcdFx0J2RlZmF1bHQnOiAnYXV0bycsXG5cdFx0XHRcdCdlbnVtRGVzY3JpcHRpb25zJzogW1xuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLnNwbGl0U2l6aW5nQXV0bycsIFwiU3BsaXRzIHRoZSBhY3RpdmUgZWRpdG9yIGdyb3VwIHRvIGVxdWFsIHBhcnRzLCB1bmxlc3MgYWxsIGVkaXRvciBncm91cHMgYXJlIGFscmVhZHkgaW4gZXF1YWwgcGFydHMuIEluIHRoYXQgY2FzZSwgc3BsaXRzIGFsbCB0aGUgZWRpdG9yIGdyb3VwcyB0byBlcXVhbCBwYXJ0cy5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3Iuc3BsaXRTaXppbmdEaXN0cmlidXRlJywgXCJTcGxpdHMgYWxsIHRoZSBlZGl0b3IgZ3JvdXBzIHRvIGVxdWFsIHBhcnRzLlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya2JlbmNoLmVkaXRvci5zcGxpdFNpemluZ1NwbGl0JywgXCJTcGxpdHMgdGhlIGFjdGl2ZSBlZGl0b3IgZ3JvdXAgdG8gZXF1YWwgcGFydHMuXCIpXG5cdFx0XHRcdF0sXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdzcGxpdFNpemluZycsIFwiQ29udHJvbHMgdGhlIHNpemUgb2YgZWRpdG9yIGdyb3VwcyB3aGVuIHNwbGl0dGluZyB0aGVtLlwiKVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLnNwbGl0T25EcmFnQW5kRHJvcCc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZWZhdWx0JzogdHJ1ZSxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3NwbGl0T25EcmFnQW5kRHJvcCcsIFwiQ29udHJvbHMgaWYgZWRpdG9yIGdyb3VwcyBjYW4gYmUgc3BsaXQgZnJvbSBkcmFnIGFuZCBkcm9wIG9wZXJhdGlvbnMgYnkgZHJvcHBpbmcgYW4gZWRpdG9yIG9yIGZpbGUgb24gdGhlIGVkZ2VzIG9mIHRoZSBlZGl0b3IgYXJlYS5cIilcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmVkaXRvci5kcmFnVG9PcGVuV2luZG93Jzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKCdkcmFnVG9PcGVuV2luZG93JywgXCJDb250cm9scyBpZiBlZGl0b3JzIGNhbiBiZSBkcmFnZ2VkIG91dCBvZiB0aGUgd2luZG93IHRvIG9wZW4gdGhlbSBpbiBhIG5ldyB3aW5kb3cuIFByZXNzIGFuZCBob2xkIHRoZSBgQWx0YCBrZXkgd2hpbGUgZHJhZ2dpbmcgdG8gdG9nZ2xlIHRoaXMgZHluYW1pY2FsbHkuXCIpXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3IuZm9jdXNSZWNlbnRFZGl0b3JBZnRlckNsb3NlJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2ZvY3VzUmVjZW50RWRpdG9yQWZ0ZXJDbG9zZScsIFwiQ29udHJvbHMgd2hldGhlciBlZGl0b3JzIGFyZSBjbG9zZWQgaW4gbW9zdCByZWNlbnRseSB1c2VkIG9yZGVyIG9yIGZyb20gbGVmdCB0byByaWdodC5cIiksXG5cdFx0XHRcdCdkZWZhdWx0JzogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLnNob3dJY29ucyc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdzaG93SWNvbnMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgb3BlbmVkIGVkaXRvcnMgc2hvdWxkIHNob3cgd2l0aCBhbiBpY29uIG9yIG5vdC4gVGhpcyByZXF1aXJlcyBhIGZpbGUgaWNvbiB0aGVtZSB0byBiZSBlbmFibGVkIGFzIHdlbGwuXCIpLFxuXHRcdFx0XHQnZGVmYXVsdCc6IHRydWVcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmVkaXRvci5lbmFibGVQcmV2aWV3Jzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2VuYWJsZVByZXZpZXcnLCBcIkNvbnRyb2xzIHdoZXRoZXIgcHJldmlldyBtb2RlIGlzIHVzZWQgd2hlbiBlZGl0b3JzIG9wZW4uIFRoZXJlIGlzIGEgbWF4aW11bSBvZiBvbmUgcHJldmlldyBtb2RlIGVkaXRvciBwZXIgZWRpdG9yIGdyb3VwLiBUaGlzIGVkaXRvciBkaXNwbGF5cyBpdHMgZmlsZW5hbWUgaW4gaXRhbGljcyBvbiBpdHMgdGFiIG9yIHRpdGxlIGxhYmVsIGFuZCBpbiB0aGUgT3BlbiBFZGl0b3JzIHZpZXcuIEl0cyBjb250ZW50cyB3aWxsIGJlIHJlcGxhY2VkIGJ5IHRoZSBuZXh0IGVkaXRvciBvcGVuZWQgaW4gcHJldmlldyBtb2RlLiBNYWtpbmcgYSBjaGFuZ2UgaW4gYSBwcmV2aWV3IG1vZGUgZWRpdG9yIHdpbGwgcGVyc2lzdCBpdCwgYXMgd2lsbCBhIGRvdWJsZS1jbGljayBvbiBpdHMgbGFiZWwsIG9yIHRoZSAnS2VlcCBPcGVuJyBvcHRpb24gaW4gaXRzIGxhYmVsIGNvbnRleHQgbWVudS4gT3BlbmluZyBhIGZpbGUgZnJvbSBFeHBsb3JlciB3aXRoIGEgZG91YmxlLWNsaWNrIHBlcnNpc3RzIGl0cyBlZGl0b3IgaW1tZWRpYXRlbHkuXCIpLFxuXHRcdFx0XHQnZGVmYXVsdCc6IHRydWVcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmVkaXRvci5lbmFibGVQcmV2aWV3RnJvbVF1aWNrT3Blbic6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbG9jYWxpemUoeyBjb21tZW50OiBbJ3swfSwgezF9IHdpbGwgYmUgYSBzZXR0aW5nIG5hbWUgcmVuZGVyZWQgYXMgYSBsaW5rJ10sIGtleTogJ2VuYWJsZVByZXZpZXdGcm9tUXVpY2tPcGVuJyB9LCBcIkNvbnRyb2xzIHdoZXRoZXIgZWRpdG9ycyBvcGVuZWQgZnJvbSBRdWljayBPcGVuIHNob3cgYXMgcHJldmlldyBlZGl0b3JzLiBQcmV2aWV3IGVkaXRvcnMgZG8gbm90IHN0YXkgb3BlbiwgYW5kIGFyZSByZXVzZWQgdW50aWwgZXhwbGljaXRseSBzZXQgdG8gYmUga2VwdCBvcGVuICh2aWEgZG91YmxlLWNsaWNrIG9yIGVkaXRpbmcpLiBXaGVuIGVuYWJsZWQsIGhvbGQgQ3RybCBiZWZvcmUgc2VsZWN0aW9uIHRvIG9wZW4gYW4gZWRpdG9yIGFzIGEgbm9uLXByZXZpZXcuIFRoaXMgdmFsdWUgaXMgaWdub3JlZCB3aGVuIHswfSBpcyBub3Qgc2V0IHRvIHsxfS5cIiwgJ2Ajd29ya2JlbmNoLmVkaXRvci5zaG93VGFicyNgJywgJ2BtdWx0aXBsZWAnKSxcblx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLmVuYWJsZVByZXZpZXdGcm9tQ29kZU5hdmlnYXRpb24nOiB7XG5cdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKHsgY29tbWVudDogWyd7MH0sIHsxfSB3aWxsIGJlIGEgc2V0dGluZyBuYW1lIHJlbmRlcmVkIGFzIGEgbGluayddLCBrZXk6ICdlbmFibGVQcmV2aWV3RnJvbUNvZGVOYXZpZ2F0aW9uJyB9LCBcIkNvbnRyb2xzIHdoZXRoZXIgZWRpdG9ycyByZW1haW4gaW4gcHJldmlldyB3aGVuIGEgY29kZSBuYXZpZ2F0aW9uIGlzIHN0YXJ0ZWQgZnJvbSB0aGVtLiBQcmV2aWV3IGVkaXRvcnMgZG8gbm90IHN0YXkgb3BlbiwgYW5kIGFyZSByZXVzZWQgdW50aWwgZXhwbGljaXRseSBzZXQgdG8gYmUga2VwdCBvcGVuICh2aWEgZG91YmxlLWNsaWNrIG9yIGVkaXRpbmcpLiBUaGlzIHZhbHVlIGlzIGlnbm9yZWQgd2hlbiB7MH0gaXMgbm90IHNldCB0byB7MX0uXCIsICdgI3dvcmtiZW5jaC5lZGl0b3Iuc2hvd1RhYnMjYCcsICdgbXVsdGlwbGVgJyksXG5cdFx0XHRcdCdkZWZhdWx0JzogZmFsc2Vcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmVkaXRvci5jbG9zZU9uRmlsZURlbGV0ZSc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdjbG9zZU9uRmlsZURlbGV0ZScsIFwiQ29udHJvbHMgd2hldGhlciBlZGl0b3JzIHNob3dpbmcgYSBmaWxlIHRoYXQgd2FzIG9wZW5lZCBkdXJpbmcgdGhlIHNlc3Npb24gc2hvdWxkIGNsb3NlIGF1dG9tYXRpY2FsbHkgd2hlbiBnZXR0aW5nIGRlbGV0ZWQgb3IgcmVuYW1lZCBieSBzb21lIG90aGVyIHByb2Nlc3MuIERpc2FibGluZyB0aGlzIHdpbGwga2VlcCB0aGUgZWRpdG9yIG9wZW4gIG9uIHN1Y2ggYW4gZXZlbnQuIE5vdGUgdGhhdCBkZWxldGluZyBmcm9tIHdpdGhpbiB0aGUgYXBwbGljYXRpb24gd2lsbCBhbHdheXMgY2xvc2UgdGhlIGVkaXRvciBhbmQgdGhhdCBlZGl0b3JzIHdpdGggdW5zYXZlZCBjaGFuZ2VzIHdpbGwgbmV2ZXIgY2xvc2UgdG8gcHJlc2VydmUgeW91ciBkYXRhLlwiKSxcblx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLm9wZW5Qb3NpdGlvbmluZyc6IHtcblx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0J2VudW0nOiBbJ2xlZnQnLCAncmlnaHQnLCAnZmlyc3QnLCAnbGFzdCddLFxuXHRcdFx0XHQnZGVmYXVsdCc6ICdyaWdodCcsXG5cdFx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbG9jYWxpemUoeyBjb21tZW50OiBbJ3swfSwgezF9LCB7Mn0sIHszfSB3aWxsIGJlIGEgc2V0dGluZyBuYW1lIHJlbmRlcmVkIGFzIGEgbGluayddLCBrZXk6ICdlZGl0b3JPcGVuUG9zaXRpb25pbmcnIH0sIFwiQ29udHJvbHMgd2hlcmUgZWRpdG9ycyBvcGVuLiBTZWxlY3QgezB9IG9yIHsxfSB0byBvcGVuIGVkaXRvcnMgdG8gdGhlIGxlZnQgb3IgcmlnaHQgb2YgdGhlIGN1cnJlbnRseSBhY3RpdmUgb25lLiBTZWxlY3QgezJ9IG9yIHszfSB0byBvcGVuIGVkaXRvcnMgaW5kZXBlbmRlbnRseSBmcm9tIHRoZSBjdXJyZW50bHkgYWN0aXZlIG9uZS5cIiwgJ2BsZWZ0YCcsICdgcmlnaHRgJywgJ2BmaXJzdGAnLCAnYGxhc3RgJylcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmVkaXRvci5vcGVuU2lkZUJ5U2lkZURpcmVjdGlvbic6IHtcblx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0J2VudW0nOiBbJ3JpZ2h0JywgJ2Rvd24nXSxcblx0XHRcdFx0J2RlZmF1bHQnOiAncmlnaHQnLFxuXHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKCdzaWRlQnlTaWRlRGlyZWN0aW9uJywgXCJDb250cm9scyB0aGUgZGVmYXVsdCBkaXJlY3Rpb24gb2YgZWRpdG9ycyB0aGF0IGFyZSBvcGVuZWQgc2lkZSBieSBzaWRlIChmb3IgZXhhbXBsZSwgZnJvbSB0aGUgRXhwbG9yZXIpLiBCeSBkZWZhdWx0LCBlZGl0b3JzIHdpbGwgb3BlbiBvbiB0aGUgcmlnaHQgaGFuZCBzaWRlIG9mIHRoZSBjdXJyZW50bHkgYWN0aXZlIG9uZS4gSWYgY2hhbmdlZCB0byBgZG93bmAsIHRoZSBlZGl0b3JzIHdpbGwgb3BlbiBiZWxvdyB0aGUgY3VycmVudGx5IGFjdGl2ZSBvbmUuXCIpXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3IuY2xvc2VFbXB0eUdyb3Vwcyc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdjbG9zZUVtcHR5R3JvdXBzJywgXCJDb250cm9scyB0aGUgYmVoYXZpb3Igb2YgZW1wdHkgZWRpdG9yIGdyb3VwcyB3aGVuIHRoZSBsYXN0IHRhYiBpbiB0aGUgZ3JvdXAgaXMgY2xvc2VkLiBXaGVuIGVuYWJsZWQsIGVtcHR5IGdyb3VwcyB3aWxsIGF1dG9tYXRpY2FsbHkgY2xvc2UuIFdoZW4gZGlzYWJsZWQsIGVtcHR5IGdyb3VwcyB3aWxsIHJlbWFpbiBwYXJ0IG9mIHRoZSBncmlkLlwiKSxcblx0XHRcdFx0J2RlZmF1bHQnOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3IucmV2ZWFsSWZPcGVuJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3JldmVhbElmT3BlbicsIFwiQ29udHJvbHMgd2hldGhlciBhbiBlZGl0b3IgaXMgcmV2ZWFsZWQgaW4gYW55IG9mIHRoZSB2aXNpYmxlIGdyb3VwcyBpZiBvcGVuZWQuIElmIGRpc2FibGVkLCBhbiBlZGl0b3Igd2lsbCBwcmVmZXIgdG8gb3BlbiBpbiB0aGUgY3VycmVudGx5IGFjdGl2ZSBlZGl0b3IgZ3JvdXAuIElmIGVuYWJsZWQsIGFuIGFscmVhZHkgb3BlbmVkIGVkaXRvciB3aWxsIGJlIHJldmVhbGVkIGluc3RlYWQgb2Ygb3BlbmVkIGFnYWluIGluIHRoZSBjdXJyZW50bHkgYWN0aXZlIGVkaXRvciBncm91cC4gTm90ZSB0aGF0IHRoZXJlIGFyZSBzb21lIGNhc2VzIHdoZXJlIHRoaXMgc2V0dGluZyBpcyBpZ25vcmVkLCBzdWNoIGFzIHdoZW4gZm9yY2luZyBhbiBlZGl0b3IgdG8gb3BlbiBpbiBhIHNwZWNpZmljIGdyb3VwIG9yIHRvIHRoZSBzaWRlIG9mIHRoZSBjdXJyZW50bHkgYWN0aXZlIGdyb3VwLlwiKSxcblx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLm1vdXNlQmFja0ZvcndhcmRUb05hdmlnYXRlJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ21vdXNlQmFja0ZvcndhcmRUb05hdmlnYXRlJywgXCJFbmFibGVzIHRoZSB1c2Ugb2YgbW91c2UgYnV0dG9ucyBmb3VyIGFuZCBmaXZlIGZvciBjb21tYW5kcyAnR28gQmFjaycgYW5kICdHbyBGb3J3YXJkJy5cIiksXG5cdFx0XHRcdCdkZWZhdWx0JzogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLm5hdmlnYXRpb25TY29wZSc6IHtcblx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0J2VudW0nOiBbJ2RlZmF1bHQnLCAnZWRpdG9yR3JvdXAnLCAnZWRpdG9yJ10sXG5cdFx0XHRcdCdkZWZhdWx0JzogJ2RlZmF1bHQnLFxuXHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKCduYXZpZ2F0aW9uU2NvcGUnLCBcIkNvbnRyb2xzIHRoZSBzY29wZSBvZiBoaXN0b3J5IG5hdmlnYXRpb24gaW4gZWRpdG9ycyBmb3IgY29tbWFuZHMgc3VjaCBhcyAnR28gQmFjaycgYW5kICdHbyBGb3J3YXJkJy5cIiksXG5cdFx0XHRcdCdlbnVtRGVzY3JpcHRpb25zJzogW1xuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLm5hdmlnYXRpb25TY29wZURlZmF1bHQnLCBcIk5hdmlnYXRlIGFjcm9zcyBhbGwgb3BlbmVkIGVkaXRvcnMgYW5kIGVkaXRvciBncm91cHMuXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLm5hdmlnYXRpb25TY29wZUVkaXRvckdyb3VwJywgXCJOYXZpZ2F0ZSBvbmx5IGluIGVkaXRvcnMgb2YgdGhlIGFjdGl2ZSBlZGl0b3IgZ3JvdXAuXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLm5hdmlnYXRpb25TY29wZUVkaXRvcicsIFwiTmF2aWdhdGUgb25seSBpbiB0aGUgYWN0aXZlIGVkaXRvci5cIilcblx0XHRcdFx0XSxcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmVkaXRvci5yZXN0b3JlVmlld1N0YXRlJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgncmVzdG9yZVZpZXdTdGF0ZScsIFwiUmVzdG9yZXMgdGhlIGxhc3QgZWRpdG9yIHZpZXcgc3RhdGUgKHN1Y2ggYXMgc2Nyb2xsIHBvc2l0aW9uKSB3aGVuIHJlLW9wZW5pbmcgZWRpdG9ycyBhZnRlciB0aGV5IGhhdmUgYmVlbiBjbG9zZWQuIEVkaXRvciB2aWV3IHN0YXRlIGlzIHN0b3JlZCBwZXIgZWRpdG9yIGdyb3VwIGFuZCBkaXNjYXJkZWQgd2hlbiBhIGdyb3VwIGNsb3Nlcy4gVXNlIHRoZSB7MH0gc2V0dGluZyB0byB1c2UgdGhlIGxhc3Qga25vd24gdmlldyBzdGF0ZSBhY3Jvc3MgYWxsIGVkaXRvciBncm91cHMgaW4gY2FzZSBubyBwcmV2aW91cyB2aWV3IHN0YXRlIHdhcyBmb3VuZCBmb3IgYSBlZGl0b3IgZ3JvdXAuXCIsICdgI3dvcmtiZW5jaC5lZGl0b3Iuc2hhcmVkVmlld1N0YXRlI2AnKSxcblx0XHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdFx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEVcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmVkaXRvci5zaGFyZWRWaWV3U3RhdGUnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnc2hhcmVkVmlld1N0YXRlJywgXCJQcmVzZXJ2ZXMgdGhlIG1vc3QgcmVjZW50IGVkaXRvciB2aWV3IHN0YXRlIChzdWNoIGFzIHNjcm9sbCBwb3NpdGlvbikgYWNyb3NzIGFsbCBlZGl0b3IgZ3JvdXBzIGFuZCByZXN0b3JlcyB0aGF0IGlmIG5vIHNwZWNpZmljIGVkaXRvciB2aWV3IHN0YXRlIGlzIGZvdW5kIGZvciB0aGUgZWRpdG9yIGdyb3VwLlwiKSxcblx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLnNwbGl0SW5Hcm91cExheW91dCc6IHtcblx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0J2VudW0nOiBbJ3ZlcnRpY2FsJywgJ2hvcml6b250YWwnXSxcblx0XHRcdFx0J2RlZmF1bHQnOiAnaG9yaXpvbnRhbCcsXG5cdFx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3NwbGl0SW5Hcm91cExheW91dCcsIFwiQ29udHJvbHMgdGhlIGxheW91dCBmb3Igd2hlbiBhbiBlZGl0b3IgaXMgc3BsaXQgaW4gYW4gZWRpdG9yIGdyb3VwIHRvIGJlIGVpdGhlciB2ZXJ0aWNhbCBvciBob3Jpem9udGFsLlwiKSxcblx0XHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3Iuc3BsaXRJbkdyb3VwTGF5b3V0VmVydGljYWwnLCBcIkVkaXRvcnMgYXJlIHBvc2l0aW9uZWQgZnJvbSB0b3AgdG8gYm90dG9tLlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya2JlbmNoLmVkaXRvci5zcGxpdEluR3JvdXBMYXlvdXRIb3Jpem9udGFsJywgXCJFZGl0b3JzIGFyZSBwb3NpdGlvbmVkIGZyb20gbGVmdCB0byByaWdodC5cIilcblx0XHRcdFx0XVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLmNlbnRlcmVkTGF5b3V0QXV0b1Jlc2l6ZSc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZWZhdWx0JzogdHJ1ZSxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2NlbnRlcmVkTGF5b3V0QXV0b1Jlc2l6ZScsIFwiQ29udHJvbHMgaWYgdGhlIGNlbnRlcmVkIGxheW91dCBzaG91bGQgYXV0b21hdGljYWxseSByZXNpemUgdG8gbWF4aW11bSB3aWR0aCB3aGVuIG1vcmUgdGhhbiBvbmUgZ3JvdXAgaXMgb3Blbi4gT25jZSBvbmx5IG9uZSBncm91cCBpcyBvcGVuIGl0IHdpbGwgcmVzaXplIGJhY2sgdG8gdGhlIG9yaWdpbmFsIGNlbnRlcmVkIHdpZHRoLlwiKVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLmNlbnRlcmVkTGF5b3V0Rml4ZWRXaWR0aCc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZWZhdWx0JzogZmFsc2UsXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdjZW50ZXJlZExheW91dER5bmFtaWNXaWR0aCcsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgY2VudGVyZWQgbGF5b3V0IHRyaWVzIHRvIG1haW50YWluIGNvbnN0YW50IHdpZHRoIHdoZW4gdGhlIHdpbmRvdyBpcyByZXNpemVkLlwiKVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guZWRpdG9yLmRvdWJsZUNsaWNrVGFiVG9Ub2dnbGVFZGl0b3JHcm91cFNpemVzJzoge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHQnZW51bSc6IFsnbWF4aW1pemUnLCAnZXhwYW5kJywgJ29mZiddLFxuXHRcdFx0XHQnZGVmYXVsdCc6ICdleHBhbmQnLFxuXHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKHsgY29tbWVudDogWyd7MH0sIHsxfSB3aWxsIGJlIGEgc2V0dGluZyBuYW1lIHJlbmRlcmVkIGFzIGEgbGluayddLCBrZXk6ICdkb3VibGVDbGlja1RhYlRvVG9nZ2xlRWRpdG9yR3JvdXBTaXplcycgfSwgXCJDb250cm9scyBob3cgdGhlIGVkaXRvciBncm91cCBpcyByZXNpemVkIHdoZW4gZG91YmxlIGNsaWNraW5nIG9uIGEgdGFiLiBUaGlzIHZhbHVlIGlzIGlnbm9yZWQgd2hlbiB7MH0gaXMgbm90IHNldCB0byB7MX0uXCIsICdgI3dvcmtiZW5jaC5lZGl0b3Iuc2hvd1RhYnMjYCcsICdgbXVsdGlwbGVgJyksXG5cdFx0XHRcdCdlbnVtRGVzY3JpcHRpb25zJzogW1xuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZWRpdG9yLmRvdWJsZUNsaWNrVGFiVG9Ub2dnbGVFZGl0b3JHcm91cFNpemVzLm1heGltaXplJywgXCJBbGwgb3RoZXIgZWRpdG9yIGdyb3VwcyBhcmUgaGlkZGVuIGFuZCB0aGUgY3VycmVudCBlZGl0b3IgZ3JvdXAgaXMgbWF4aW1pemVkIHRvIHRha2UgdXAgdGhlIGVudGlyZSBlZGl0b3IgYXJlYS5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5lZGl0b3IuZG91YmxlQ2xpY2tUYWJUb1RvZ2dsZUVkaXRvckdyb3VwU2l6ZXMuZXhwYW5kJywgXCJUaGUgZWRpdG9yIGdyb3VwIHRha2VzIGFzIG11Y2ggc3BhY2UgYXMgcG9zc2libGUgYnkgbWFraW5nIGFsbCBvdGhlciBlZGl0b3IgZ3JvdXBzIGFzIHNtYWxsIGFzIHBvc3NpYmxlLlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya2JlbmNoLmVkaXRvci5kb3VibGVDbGlja1RhYlRvVG9nZ2xlRWRpdG9yR3JvdXBTaXplcy5vZmYnLCBcIk5vIGVkaXRvciBncm91cCBpcyByZXNpemVkIHdoZW4gZG91YmxlIGNsaWNraW5nIG9uIGEgdGFiLlwiKVxuXHRcdFx0XHRdXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3IubGltaXQuZW5hYmxlZCc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZWZhdWx0JzogZmFsc2UsXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdsaW1pdEVkaXRvcnNFbmFibGVtZW50JywgXCJDb250cm9scyBpZiB0aGUgbnVtYmVyIG9mIG9wZW5lZCBlZGl0b3JzIHNob3VsZCBiZSBsaW1pdGVkIG9yIG5vdC4gV2hlbiBlbmFibGVkLCBsZXNzIHJlY2VudGx5IHVzZWQgZWRpdG9ycyB3aWxsIGNsb3NlIHRvIG1ha2Ugc3BhY2UgZm9yIG5ld2x5IG9wZW5pbmcgZWRpdG9ycy5cIilcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmVkaXRvci5saW1pdC52YWx1ZSc6IHtcblx0XHRcdFx0J3R5cGUnOiAnbnVtYmVyJyxcblx0XHRcdFx0J2RlZmF1bHQnOiAxMCxcblx0XHRcdFx0J2V4Y2x1c2l2ZU1pbmltdW0nOiAwLFxuXHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKCdsaW1pdEVkaXRvcnNNYXhpbXVtJywgXCJDb250cm9scyB0aGUgbWF4aW11bSBudW1iZXIgb2Ygb3BlbmVkIGVkaXRvcnMuIFVzZSB0aGUgezB9IHNldHRpbmcgdG8gY29udHJvbCB0aGlzIGxpbWl0IHBlciBlZGl0b3IgZ3JvdXAgb3IgYWNyb3NzIGFsbCBncm91cHMuXCIsICdgI3dvcmtiZW5jaC5lZGl0b3IubGltaXQucGVyRWRpdG9yR3JvdXAjYCcpXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3IubGltaXQuZXhjbHVkZURpcnR5Jzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZSxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2xpbWl0RWRpdG9yc0V4Y2x1ZGVEaXJ0eScsIFwiQ29udHJvbHMgaWYgdGhlIG1heGltdW0gbnVtYmVyIG9mIG9wZW5lZCBlZGl0b3JzIHNob3VsZCBleGNsdWRlIGRpcnR5IGVkaXRvcnMgZm9yIGNvdW50aW5nIHRvd2FyZHMgdGhlIGNvbmZpZ3VyZWQgbGltaXQuXCIpXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5lZGl0b3IubGltaXQucGVyRWRpdG9yR3JvdXAnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHQnZGVmYXVsdCc6IGZhbHNlLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgncGVyRWRpdG9yR3JvdXAnLCBcIkNvbnRyb2xzIGlmIHRoZSBsaW1pdCBvZiBtYXhpbXVtIG9wZW5lZCBlZGl0b3JzIHNob3VsZCBhcHBseSBwZXIgZWRpdG9yIGdyb3VwIG9yIGFjcm9zcyBhbGwgZWRpdG9yIGdyb3Vwcy5cIilcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmxvY2FsSGlzdG9yeS5lbmFibGVkJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnbG9jYWxIaXN0b3J5RW5hYmxlZCcsIFwiQ29udHJvbHMgd2hldGhlciBsb2NhbCBmaWxlIGhpc3RvcnkgaXMgZW5hYmxlZC4gV2hlbiBlbmFibGVkLCB0aGUgZmlsZSBjb250ZW50cyBvZiBhbiBlZGl0b3IgdGhhdCBpcyBzYXZlZCB3aWxsIGJlIHN0b3JlZCB0byBhIGJhY2t1cCBsb2NhdGlvbiB0byBiZSBhYmxlIHRvIHJlc3RvcmUgb3IgcmV2aWV3IHRoZSBjb250ZW50cyBsYXRlci4gQ2hhbmdpbmcgdGhpcyBzZXR0aW5nIGhhcyBubyBlZmZlY3Qgb24gZXhpc3RpbmcgbG9jYWwgZmlsZSBoaXN0b3J5IGVudHJpZXMuXCIpLFxuXHRcdFx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuUkVTT1VSQ0Vcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmxvY2FsSGlzdG9yeS5tYXhGaWxlU2l6ZSc6IHtcblx0XHRcdFx0J3R5cGUnOiAnbnVtYmVyJyxcblx0XHRcdFx0J2RlZmF1bHQnOiAyNTYsXG5cdFx0XHRcdCdtaW5pbXVtJzogMSxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2xvY2FsSGlzdG9yeU1heEZpbGVTaXplJywgXCJDb250cm9scyB0aGUgbWF4aW11bSBzaXplIG9mIGEgZmlsZSAoaW4gS0IpIHRvIGJlIGNvbnNpZGVyZWQgZm9yIGxvY2FsIGZpbGUgaGlzdG9yeS4gRmlsZXMgdGhhdCBhcmUgbGFyZ2VyIHdpbGwgbm90IGJlIGFkZGVkIHRvIHRoZSBsb2NhbCBmaWxlIGhpc3RvcnkuIENoYW5naW5nIHRoaXMgc2V0dGluZyBoYXMgbm8gZWZmZWN0IG9uIGV4aXN0aW5nIGxvY2FsIGZpbGUgaGlzdG9yeSBlbnRyaWVzLlwiKSxcblx0XHRcdFx0J3Njb3BlJzogQ29uZmlndXJhdGlvblNjb3BlLlJFU09VUkNFXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5sb2NhbEhpc3RvcnkubWF4RmlsZUVudHJpZXMnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ251bWJlcicsXG5cdFx0XHRcdCdkZWZhdWx0JzogNTAsXG5cdFx0XHRcdCdtaW5pbXVtJzogMCxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2xvY2FsSGlzdG9yeU1heEZpbGVFbnRyaWVzJywgXCJDb250cm9scyB0aGUgbWF4aW11bSBudW1iZXIgb2YgbG9jYWwgZmlsZSBoaXN0b3J5IGVudHJpZXMgcGVyIGZpbGUuIFdoZW4gdGhlIG51bWJlciBvZiBsb2NhbCBmaWxlIGhpc3RvcnkgZW50cmllcyBleGNlZWRzIHRoaXMgbnVtYmVyIGZvciBhIGZpbGUsIHRoZSBvbGRlc3QgZW50cmllcyB3aWxsIGJlIGRpc2NhcmRlZC5cIiksXG5cdFx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5SRVNPVVJDRVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2gubG9jYWxIaXN0b3J5LmV4Y2x1ZGUnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHRcdCdwYXR0ZXJuUHJvcGVydGllcyc6IHtcblx0XHRcdFx0XHQnLionOiB7ICd0eXBlJzogJ2Jvb2xlYW4nIH1cblx0XHRcdFx0fSxcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnZXhjbHVkZScsIFwiQ29uZmlndXJlIHBhdGhzIG9yIFtnbG9iIHBhdHRlcm5zXShodHRwczovL2FrYS5tcy92c2NvZGUtZ2xvYi1wYXR0ZXJucykgZm9yIGV4Y2x1ZGluZyBmaWxlcyBmcm9tIHRoZSBsb2NhbCBmaWxlIGhpc3RvcnkuIEdsb2IgcGF0dGVybnMgYXJlIGFsd2F5cyBldmFsdWF0ZWQgcmVsYXRpdmUgdG8gdGhlIHBhdGggb2YgdGhlIHdvcmtzcGFjZSBmb2xkZXIgdW5sZXNzIHRoZXkgYXJlIGFic29sdXRlIHBhdGhzLiBDaGFuZ2luZyB0aGlzIHNldHRpbmcgaGFzIG5vIGVmZmVjdCBvbiBleGlzdGluZyBsb2NhbCBmaWxlIGhpc3RvcnkgZW50cmllcy5cIiksXG5cdFx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5SRVNPVVJDRVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2gubG9jYWxIaXN0b3J5Lm1lcmdlV2luZG93Jzoge1xuXHRcdFx0XHQndHlwZSc6ICdudW1iZXInLFxuXHRcdFx0XHQnZGVmYXVsdCc6IDEwLFxuXHRcdFx0XHQnbWluaW11bSc6IDEsXG5cdFx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbG9jYWxpemUoJ21lcmdlV2luZG93JywgXCJDb25maWd1cmUgYW4gaW50ZXJ2YWwgaW4gc2Vjb25kcyBkdXJpbmcgd2hpY2ggdGhlIGxhc3QgZW50cnkgaW4gbG9jYWwgZmlsZSBoaXN0b3J5IGlzIHJlcGxhY2VkIHdpdGggdGhlIGVudHJ5IHRoYXQgaXMgYmVpbmcgYWRkZWQuIFRoaXMgaGVscHMgcmVkdWNlIHRoZSBvdmVyYWxsIG51bWJlciBvZiBlbnRyaWVzIHRoYXQgYXJlIGFkZGVkLCBmb3IgZXhhbXBsZSB3aGVuIGF1dG8gc2F2ZSBpcyBlbmFibGVkLiBUaGlzIHNldHRpbmcgaXMgb25seSBhcHBsaWVkIHRvIGVudHJpZXMgdGhhdCBoYXZlIHRoZSBzYW1lIHNvdXJjZSBvZiBvcmlnaW4uIENoYW5naW5nIHRoaXMgc2V0dGluZyBoYXMgbm8gZWZmZWN0IG9uIGV4aXN0aW5nIGxvY2FsIGZpbGUgaGlzdG9yeSBlbnRyaWVzLlwiKSxcblx0XHRcdFx0J3Njb3BlJzogQ29uZmlndXJhdGlvblNjb3BlLlJFU09VUkNFXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5jb21tYW5kUGFsZXR0ZS5oaXN0b3J5Jzoge1xuXHRcdFx0XHQndHlwZSc6ICdudW1iZXInLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnY29tbWFuZEhpc3RvcnknLCBcIkNvbnRyb2xzIHRoZSBudW1iZXIgb2YgcmVjZW50bHkgdXNlZCBjb21tYW5kcyB0byBrZWVwIGluIGhpc3RvcnkgZm9yIHRoZSBjb21tYW5kIHBhbGV0dGUuIFNldCB0byAwIHRvIGRpc2FibGUgY29tbWFuZCBoaXN0b3J5LlwiKSxcblx0XHRcdFx0J2RlZmF1bHQnOiA1MCxcblx0XHRcdFx0J21pbmltdW0nOiAwXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5jb21tYW5kUGFsZXR0ZS5wcmVzZXJ2ZUlucHV0Jzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3ByZXNlcnZlSW5wdXQnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGxhc3QgdHlwZWQgaW5wdXQgdG8gdGhlIGNvbW1hbmQgcGFsZXR0ZSBzaG91bGQgYmUgcmVzdG9yZWQgd2hlbiBvcGVuaW5nIGl0IHRoZSBuZXh0IHRpbWUuXCIpLFxuXHRcdFx0XHQnZGVmYXVsdCc6IGZhbHNlXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5jb21tYW5kUGFsZXR0ZS5leHBlcmltZW50YWwuc3VnZ2VzdENvbW1hbmRzJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0dGFnczogWydleHBlcmltZW50YWwnXSxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3N1Z2dlc3RDb21tYW5kcycsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgY29tbWFuZCBwYWxldHRlIHNob3VsZCBoYXZlIGEgbGlzdCBvZiBjb21tb25seSB1c2VkIGNvbW1hbmRzLlwiKSxcblx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guY29tbWFuZFBhbGV0dGUuZXhwZXJpbWVudGFsLmFza0NoYXRMb2NhdGlvbic6IHtcblx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0dGFnczogWydleHBlcmltZW50YWwnXSxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2Fza0NoYXRMb2NhdGlvbicsIFwiQ29udHJvbHMgd2hlcmUgdGhlIGNvbW1hbmQgcGFsZXR0ZSBzaG91bGQgYXNrIGNoYXQgcXVlc3Rpb25zLlwiKSxcblx0XHRcdFx0J2RlZmF1bHQnOiAnY2hhdFZpZXcnLFxuXHRcdFx0XHRlbnVtOiBbJ2NoYXRWaWV3JywgJ3F1aWNrQ2hhdCddLFxuXHRcdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdFx0bG9jYWxpemUoJ2Fza0NoYXRMb2NhdGlvbi5jaGF0VmlldycsIFwiQXNrIGNoYXQgcXVlc3Rpb25zIGluIHRoZSBDaGF0IHZpZXcuXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCdhc2tDaGF0TG9jYXRpb24ucXVpY2tDaGF0JywgXCJBc2sgY2hhdCBxdWVzdGlvbnMgaW4gUXVpY2sgQ2hhdC5cIilcblx0XHRcdFx0XVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guY29tbWFuZFBhbGV0dGUuZXhwZXJpbWVudGFsLmVuYWJsZU5hdHVyYWxMYW5ndWFnZVNlYXJjaCc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdHRhZ3M6IFsnZXhwZXJpbWVudGFsJ10sXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdlbmFibGVOYXR1cmFsTGFuZ3VhZ2VTZWFyY2gnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGNvbW1hbmQgcGFsZXR0ZSBzaG91bGQgaW5jbHVkZSBzaW1pbGFyIGNvbW1hbmRzLiBZb3UgbXVzdCBoYXZlIGFuIGV4dGVuc2lvbiBpbnN0YWxsZWQgdGhhdCBwcm92aWRlcyBOYXR1cmFsIExhbmd1YWdlIHN1cHBvcnQuXCIpLFxuXHRcdFx0XHQnZGVmYXVsdCc6IHRydWVcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLnF1aWNrT3Blbi5jbG9zZU9uRm9jdXNMb3N0Jzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2Nsb3NlT25Gb2N1c0xvc3QnLCBcIkNvbnRyb2xzIHdoZXRoZXIgUXVpY2sgT3BlbiBzaG91bGQgY2xvc2UgYXV0b21hdGljYWxseSBvbmNlIGl0IGxvc2VzIGZvY3VzLlwiKSxcblx0XHRcdFx0J2RlZmF1bHQnOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5xdWlja09wZW4ucHJlc2VydmVJbnB1dCc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCd3b3JrYmVuY2gucXVpY2tPcGVuLnByZXNlcnZlSW5wdXQnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGxhc3QgdHlwZWQgaW5wdXQgdG8gUXVpY2sgT3BlbiBzaG91bGQgYmUgcmVzdG9yZWQgd2hlbiBvcGVuaW5nIGl0IHRoZSBuZXh0IHRpbWUuXCIpLFxuXHRcdFx0XHQnZGVmYXVsdCc6IGZhbHNlXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5zZXR0aW5ncy5vcGVuRGVmYXVsdFNldHRpbmdzJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ29wZW5EZWZhdWx0U2V0dGluZ3MnLCBcIkNvbnRyb2xzIHdoZXRoZXIgb3BlbmluZyBzZXR0aW5ncyBhbHNvIG9wZW5zIGFuIGVkaXRvciBzaG93aW5nIGFsbCBkZWZhdWx0IHNldHRpbmdzLlwiKSxcblx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guc2V0dGluZ3MudXNlU3BsaXRKU09OJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgndXNlU3BsaXRKU09OJywgXCJDb250cm9scyB3aGV0aGVyIHRvIHVzZSB0aGUgc3BsaXQgSlNPTiBlZGl0b3Igd2hlbiBlZGl0aW5nIHNldHRpbmdzIGFzIEpTT04uXCIpLFxuXHRcdFx0XHQnZGVmYXVsdCc6IGZhbHNlXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5zZXR0aW5ncy5vcGVuRGVmYXVsdEtleWJpbmRpbmdzJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ29wZW5EZWZhdWx0S2V5YmluZGluZ3MnLCBcIkNvbnRyb2xzIHdoZXRoZXIgb3BlbmluZyBrZXliaW5kaW5nIHNldHRpbmdzIGFsc28gb3BlbnMgYW4gZWRpdG9yIHNob3dpbmcgYWxsIGRlZmF1bHQga2V5YmluZGluZ3MuXCIpLFxuXHRcdFx0XHQnZGVmYXVsdCc6IGZhbHNlXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5zaWRlQmFyLmxvY2F0aW9uJzoge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHQnZW51bSc6IFsnbGVmdCcsICdyaWdodCddLFxuXHRcdFx0XHQnZGVmYXVsdCc6ICdsZWZ0Jyxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3NpZGVCYXJMb2NhdGlvbicsIFwiQ29udHJvbHMgdGhlIGxvY2F0aW9uIG9mIHRoZSBwcmltYXJ5IHNpZGUgYmFyIGFuZCBhY3Rpdml0eSBiYXIuIFRoZXkgY2FuIGVpdGhlciBzaG93IG9uIHRoZSBsZWZ0IG9yIHJpZ2h0IG9mIHRoZSB3b3JrYmVuY2guIFRoZSBWb2lkIHNpZGUgYmFyIHdpbGwgc2hvdyBvbiB0aGUgb3Bwb3NpdGUgc2lkZSBvZiB0aGUgd29ya2JlbmNoLlwiKVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2gucGFuZWwuc2hvd0xhYmVscyc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZWZhdWx0JzogdHJ1ZSxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3BhbmVsU2hvd0xhYmVscycsIFwiQ29udHJvbHMgd2hldGhlciBhY3Rpdml0eSBpdGVtcyBpbiB0aGUgcGFuZWwgdGl0bGUgYXJlIHNob3duIGFzIGxhYmVsIG9yIGljb24uXCIpLFxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2gucGFuZWwuZGVmYXVsdExvY2F0aW9uJzoge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHQnZW51bSc6IFsnbGVmdCcsICdib3R0b20nLCAndG9wJywgJ3JpZ2h0J10sXG5cdFx0XHRcdCdkZWZhdWx0JzogJ2JvdHRvbScsXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdwYW5lbERlZmF1bHRMb2NhdGlvbicsIFwiQ29udHJvbHMgdGhlIGRlZmF1bHQgbG9jYXRpb24gb2YgdGhlIHBhbmVsIChUZXJtaW5hbCwgRGVidWcgQ29uc29sZSwgT3V0cHV0LCBQcm9ibGVtcykgaW4gYSBuZXcgd29ya3NwYWNlLiBJdCBjYW4gZWl0aGVyIHNob3cgYXQgdGhlIGJvdHRvbSwgdG9wLCByaWdodCwgb3IgbGVmdCBvZiB0aGUgZWRpdG9yIGFyZWEuXCIpLFxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2gucGFuZWwub3BlbnNNYXhpbWl6ZWQnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdlbnVtJzogWydhbHdheXMnLCAnbmV2ZXInLCAncHJlc2VydmUnXSxcblx0XHRcdFx0J2RlZmF1bHQnOiAncHJlc2VydmUnLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgncGFuZWxPcGVuc01heGltaXplZCcsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgcGFuZWwgb3BlbnMgbWF4aW1pemVkLiBJdCBjYW4gZWl0aGVyIGFsd2F5cyBvcGVuIG1heGltaXplZCwgbmV2ZXIgb3BlbiBtYXhpbWl6ZWQsIG9yIG9wZW4gdG8gdGhlIGxhc3Qgc3RhdGUgaXQgd2FzIGluIGJlZm9yZSBiZWluZyBjbG9zZWQuXCIpLFxuXHRcdFx0XHQnZW51bURlc2NyaXB0aW9ucyc6IFtcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya2JlbmNoLnBhbmVsLm9wZW5zTWF4aW1pemVkLmFsd2F5cycsIFwiQWx3YXlzIG1heGltaXplIHRoZSBwYW5lbCB3aGVuIG9wZW5pbmcgaXQuXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2gucGFuZWwub3BlbnNNYXhpbWl6ZWQubmV2ZXInLCBcIk5ldmVyIG1heGltaXplIHRoZSBwYW5lbCB3aGVuIG9wZW5pbmcgaXQuIFRoZSBwYW5lbCB3aWxsIG9wZW4gdW4tbWF4aW1pemVkLlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya2JlbmNoLnBhbmVsLm9wZW5zTWF4aW1pemVkLnByZXNlcnZlJywgXCJPcGVuIHRoZSBwYW5lbCB0byB0aGUgc3RhdGUgdGhhdCBpdCB3YXMgaW4sIGJlZm9yZSBpdCB3YXMgY2xvc2VkLlwiKVxuXHRcdFx0XHRdXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5zZWNvbmRhcnlTaWRlQmFyLnNob3dMYWJlbHMnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHQnZGVmYXVsdCc6IHRydWUsXG5cdFx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3NlY29uZGFyeVNpZGVCYXJTaG93TGFiZWxzJywgXCJDb250cm9scyB3aGV0aGVyIGFjdGl2aXR5IGl0ZW1zIGluIHRoZSBzZWNvbmRhcnkgc2lkZWJhciB0aXRsZSBhcmUgc2hvd24gYXMgbGFiZWwgb3IgaWNvbi4gVGhpcyBzZXR0aW5nIG9ubHkgaGFzIGFuIGVmZmVjdCB3aGVuIHswfSBpcyBub3Qgc2V0IHRvIHsxfS5cIiwgJ2Ajd29ya2JlbmNoLmFjdGl2aXR5QmFyLmxvY2F0aW9uI2AnLCAnYHRvcGAnKSxcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLnN0YXR1c0Jhci52aXNpYmxlJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnc3RhdHVzQmFyVmlzaWJpbGl0eScsIFwiQ29udHJvbHMgdGhlIHZpc2liaWxpdHkgb2YgdGhlIHN0YXR1cyBiYXIgYXQgdGhlIGJvdHRvbSBvZiB0aGUgd29ya2JlbmNoLlwiKVxuXHRcdFx0fSxcblx0XHRcdFtMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT05dOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdlbnVtJzogWydkZWZhdWx0JywgJ3RvcCcsICdib3R0b20nLCAnaGlkZGVuJ10sXG5cdFx0XHRcdCdkZWZhdWx0JzogJ2RlZmF1bHQnLFxuXHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKHsgY29tbWVudDogWydUaGlzIGlzIHRoZSBkZXNjcmlwdGlvbiBmb3IgYSBzZXR0aW5nJ10sIGtleTogJ2FjdGl2aXR5QmFyTG9jYXRpb24nIH0sIFwiQ29udHJvbHMgdGhlIGxvY2F0aW9uIG9mIHRoZSBBY3Rpdml0eSBCYXIgcmVsYXRpdmUgdG8gdGhlIFByaW1hcnkgYW5kIFZvaWQgU2lkZSBCYXJzLlwiKSwgLy8gVm9pZCBzaWRlIGJhclxuXHRcdFx0XHQnZW51bURlc2NyaXB0aW9ucyc6IFtcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGl2aXR5QmFyLmxvY2F0aW9uLmRlZmF1bHQnLCBcIlNob3cgdGhlIEFjdGl2aXR5IEJhciBvbiB0aGUgc2lkZSBvZiB0aGUgUHJpbWFyeSBTaWRlIEJhciBhbmQgb24gdG9wIG9mIHRoZSBWb2lkIFNpZGUgQmFyLlwiKSwgLy8gVm9pZCBzaWRlIGJhclxuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guYWN0aXZpdHlCYXIubG9jYXRpb24udG9wJywgXCJTaG93IHRoZSBBY3Rpdml0eSBCYXIgb24gdG9wIG9mIHRoZSBQcmltYXJ5IGFuZCBWb2lkIFNpZGUgQmFycy5cIiksIC8vIFZvaWQgc2lkZSBiYXJcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGl2aXR5QmFyLmxvY2F0aW9uLmJvdHRvbScsIFwiU2hvdyB0aGUgQWN0aXZpdHkgQmFyIGF0IHRoZSBib3R0b20gb2YgdGhlIFByaW1hcnkgYW5kIFZvaWQgU2lkZSBCYXJzLlwiKSwgLy8gVm9pZCBzaWRlIGJhclxuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guYWN0aXZpdHlCYXIubG9jYXRpb24uaGlkZScsIFwiSGlkZSB0aGUgQWN0aXZpdHkgQmFyIGluIHRoZSBQcmltYXJ5IGFuZCBWb2lkIFNpZGUgQmFycy5cIikgLy8gVm9pZCBzaWRlIGJhclxuXHRcdFx0XHRdLFxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2guYWN0aXZpdHlCYXIuaWNvbkNsaWNrQmVoYXZpb3InOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdlbnVtJzogWyd0b2dnbGUnLCAnZm9jdXMnXSxcblx0XHRcdFx0J2RlZmF1bHQnOiAndG9nZ2xlJyxcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSh7IGNvbW1lbnQ6IFsnezB9LCB7MX0gd2lsbCBiZSBhIHNldHRpbmcgbmFtZSByZW5kZXJlZCBhcyBhIGxpbmsnXSwga2V5OiAnYWN0aXZpdHlCYXJJY29uQ2xpY2tCZWhhdmlvcicgfSwgXCJDb250cm9scyB0aGUgYmVoYXZpb3Igb2YgY2xpY2tpbmcgYW4gQWN0aXZpdHkgQmFyIGljb24gaW4gdGhlIHdvcmtiZW5jaC4gVGhpcyB2YWx1ZSBpcyBpZ25vcmVkIHdoZW4gezB9IGlzIG5vdCBzZXQgdG8gezF9LlwiLCAnYCN3b3JrYmVuY2guYWN0aXZpdHlCYXIubG9jYXRpb24jYCcsICdgZGVmYXVsdGAnKSxcblx0XHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpdml0eUJhci5pY29uQ2xpY2tCZWhhdmlvci50b2dnbGUnLCBcIkhpZGUgdGhlIFByaW1hcnkgU2lkZSBCYXIgaWYgdGhlIGNsaWNrZWQgaXRlbSBpcyBhbHJlYWR5IHZpc2libGUuXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guYWN0aXZpdHlCYXIuaWNvbkNsaWNrQmVoYXZpb3IuZm9jdXMnLCBcIkZvY3VzIHRoZSBQcmltYXJ5IFNpZGUgQmFyIGlmIHRoZSBjbGlja2VkIGl0ZW0gaXMgYWxyZWFkeSB2aXNpYmxlLlwiKVxuXHRcdFx0XHRdXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC52aWV3LmFsd2F5c1Nob3dIZWFkZXJBY3Rpb25zJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZSxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3ZpZXdWaXNpYmlsaXR5JywgXCJDb250cm9scyB0aGUgdmlzaWJpbGl0eSBvZiB2aWV3IGhlYWRlciBhY3Rpb25zLiBWaWV3IGhlYWRlciBhY3Rpb25zIG1heSBlaXRoZXIgYmUgYWx3YXlzIHZpc2libGUsIG9yIG9ubHkgdmlzaWJsZSB3aGVuIHRoYXQgdmlldyBpcyBmb2N1c2VkIG9yIGhvdmVyZWQgb3Zlci5cIilcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLnZpZXcuc2hvd1F1aWV0bHknOiB7XG5cdFx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCd3b3JrYmVuY2gudmlldy5zaG93UXVpZXRseScsIFwiSWYgYW4gZXh0ZW5zaW9uIHJlcXVlc3RzIGEgaGlkZGVuIHZpZXcgdG8gYmUgc2hvd24sIGRpc3BsYXkgYSBjbGlja2FibGUgc3RhdHVzIGJhciBpbmRpY2F0b3IgaW5zdGVhZC5cIiksXG5cdFx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5XSU5ET1csXG5cdFx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHRcdCd3b3JrYmVuY2gucGFuZWwub3V0cHV0Jzoge1xuXHRcdFx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnd29ya2JlbmNoLnBhbmVsLm91dHB1dCcsIFwiT3V0cHV0IHZpZXdcIilcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdhZGRpdGlvbmFsUHJvcGVydGllcyc6IGZhbHNlXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5mb250QWxpYXNpbmcnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdlbnVtJzogWydkZWZhdWx0JywgJ2FudGlhbGlhc2VkJywgJ25vbmUnLCAnYXV0byddLFxuXHRcdFx0XHQnZGVmYXVsdCc6ICdkZWZhdWx0Jyxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzpcblx0XHRcdFx0XHRsb2NhbGl6ZSgnZm9udEFsaWFzaW5nJywgXCJDb250cm9scyBmb250IGFsaWFzaW5nIG1ldGhvZCBpbiB0aGUgd29ya2JlbmNoLlwiKSxcblx0XHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5mb250QWxpYXNpbmcuZGVmYXVsdCcsIFwiU3ViLXBpeGVsIGZvbnQgc21vb3RoaW5nLiBPbiBtb3N0IG5vbi1yZXRpbmEgZGlzcGxheXMgdGhpcyB3aWxsIGdpdmUgdGhlIHNoYXJwZXN0IHRleHQuXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZm9udEFsaWFzaW5nLmFudGlhbGlhc2VkJywgXCJTbW9vdGggdGhlIGZvbnQgb24gdGhlIGxldmVsIG9mIHRoZSBwaXhlbCwgYXMgb3Bwb3NlZCB0byB0aGUgc3VicGl4ZWwuIENhbiBtYWtlIHRoZSBmb250IGFwcGVhciBsaWdodGVyIG92ZXJhbGwuXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3JrYmVuY2guZm9udEFsaWFzaW5nLm5vbmUnLCBcIkRpc2FibGVzIGZvbnQgc21vb3RoaW5nLiBUZXh0IHdpbGwgc2hvdyB3aXRoIGphZ2dlZCBzaGFycCBlZGdlcy5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtiZW5jaC5mb250QWxpYXNpbmcuYXV0bycsIFwiQXBwbGllcyBgZGVmYXVsdGAgb3IgYGFudGlhbGlhc2VkYCBhdXRvbWF0aWNhbGx5IGJhc2VkIG9uIHRoZSBEUEkgb2YgZGlzcGxheXMuXCIpXG5cdFx0XHRcdF0sXG5cdFx0XHRcdCdpbmNsdWRlZCc6IGlzTWFjaW50b3NoXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5zZXR0aW5ncy5lZGl0b3InOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdlbnVtJzogWyd1aScsICdqc29uJ10sXG5cdFx0XHRcdCdlbnVtRGVzY3JpcHRpb25zJzogW1xuXHRcdFx0XHRcdGxvY2FsaXplKCdzZXR0aW5ncy5lZGl0b3IudWknLCBcIlVzZSB0aGUgc2V0dGluZ3MgVUkgZWRpdG9yLlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnc2V0dGluZ3MuZWRpdG9yLmpzb24nLCBcIlVzZSB0aGUgSlNPTiBmaWxlIGVkaXRvci5cIiksXG5cdFx0XHRcdF0sXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdzZXR0aW5ncy5lZGl0b3IuZGVzYycsIFwiRGV0ZXJtaW5lcyB3aGljaCBzZXR0aW5ncyBlZGl0b3IgdG8gdXNlIGJ5IGRlZmF1bHQuXCIpLFxuXHRcdFx0XHQnZGVmYXVsdCc6ICd1aScsXG5cdFx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5XSU5ET1dcblx0XHRcdH0sXG5cdFx0XHQnd29ya2JlbmNoLmhvdmVyLmRlbGF5Jzoge1xuXHRcdFx0XHQndHlwZSc6ICdudW1iZXInLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmhvdmVyLmRlbGF5JywgXCJDb250cm9scyB0aGUgZGVsYXkgaW4gbWlsbGlzZWNvbmRzIGFmdGVyIHdoaWNoIHRoZSBob3ZlciBpcyBzaG93biBmb3Igd29ya2JlbmNoIGl0ZW1zIChleC4gc29tZSBleHRlbnNpb24gcHJvdmlkZWQgdHJlZSB2aWV3IGl0ZW1zKS4gQWxyZWFkeSB2aXNpYmxlIGl0ZW1zIG1heSByZXF1aXJlIGEgcmVmcmVzaCBiZWZvcmUgcmVmbGVjdGluZyB0aGlzIHNldHRpbmcgY2hhbmdlLlwiKSxcblx0XHRcdFx0Ly8gVGVzdGluZyBoYXMgaW5kaWNhdGVkIHRoYXQgb24gV2luZG93cyBhbmQgTGludXggNTAwIG1zIG1hdGNoZXMgdGhlIG5hdGl2ZSBob3ZlcnMgbW9zdCBjbG9zZWx5LlxuXHRcdFx0XHQvLyBPbiBNYWMsIHRoZSBkZWxheSBpcyAxNTAwLlxuXHRcdFx0XHQnZGVmYXVsdCc6IDMwMCwgLy8gVm9pZCBjaGFuZ2VkIHRoaXMgZnJvbSBpc01hY2ludG9zaCA/IDE1MDAgOiA1MDAsXG5cdFx0XHRcdCdtaW5pbXVtJzogMFxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2gucmVkdWNlTW90aW9uJzoge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3b3JrYmVuY2gucmVkdWNlTW90aW9uJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSB3b3JrYmVuY2ggc2hvdWxkIHJlbmRlciB3aXRoIGZld2VyIGFuaW1hdGlvbnMuXCIpLFxuXHRcdFx0XHQnZW51bURlc2NyaXB0aW9ucyc6IFtcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya2JlbmNoLnJlZHVjZU1vdGlvbi5vbicsIFwiQWx3YXlzIHJlbmRlciB3aXRoIHJlZHVjZWQgbW90aW9uLlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya2JlbmNoLnJlZHVjZU1vdGlvbi5vZmYnLCBcIkRvIG5vdCByZW5kZXIgd2l0aCByZWR1Y2VkIG1vdGlvblwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya2JlbmNoLnJlZHVjZU1vdGlvbi5hdXRvJywgXCJSZW5kZXIgd2l0aCByZWR1Y2VkIG1vdGlvbiBiYXNlZCBvbiBPUyBjb25maWd1cmF0aW9uLlwiKSxcblx0XHRcdFx0XSxcblx0XHRcdFx0ZGVmYXVsdDogJ2F1dG8nLFxuXHRcdFx0XHR0YWdzOiBbJ2FjY2Vzc2liaWxpdHknXSxcblx0XHRcdFx0ZW51bTogWydvbicsICdvZmYnLCAnYXV0byddXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC5uYXZpZ2F0aW9uQ29udHJvbC5lbmFibGVkJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGlzV2ViID9cblx0XHRcdFx0XHRsb2NhbGl6ZSgnbmF2aWdhdGlvbkNvbnRyb2xFbmFibGVkV2ViJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBuYXZpZ2F0aW9uIGNvbnRyb2wgaW4gdGhlIHRpdGxlIGJhciBpcyBzaG93bi5cIikgOlxuXHRcdFx0XHRcdGxvY2FsaXplKHsga2V5OiAnbmF2aWdhdGlvbkNvbnRyb2xFbmFibGVkJywgY29tbWVudDogWyd7MH0sIHsxfSBpcyBhIHBsYWNlaG9sZGVyIGZvciBhIHNldHRpbmcgaWRlbnRpZmllci4nXSB9LCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIG5hdmlnYXRpb24gY29udHJvbCBpcyBzaG93biBpbiB0aGUgY3VzdG9tIHRpdGxlIGJhci4gVGhpcyBzZXR0aW5nIG9ubHkgaGFzIGFuIGVmZmVjdCB3aGVuIHswfSBpcyBub3Qgc2V0IHRvIHsxfS5cIiwgJ2Ajd2luZG93LmN1c3RvbVRpdGxlQmFyVmlzaWJpbGl0eSNgJywgJ2BuZXZlcmAnKVxuXHRcdFx0fSxcblx0XHRcdFtMYXlvdXRTZXR0aW5ncy5MQVlPVVRfQUNUSU9OU106IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZWZhdWx0JzogdHJ1ZSxcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBpc1dlYiA/XG5cdFx0XHRcdFx0bG9jYWxpemUoJ2xheW91dENvbnRyb2xFbmFibGVkV2ViJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBsYXlvdXQgY29udHJvbCBpbiB0aGUgdGl0bGUgYmFyIGlzIHNob3duLlwiKSA6XG5cdFx0XHRcdFx0bG9jYWxpemUoeyBrZXk6ICdsYXlvdXRDb250cm9sRW5hYmxlZCcsIGNvbW1lbnQ6IFsnezB9LCB7MX0gaXMgYSBwbGFjZWhvbGRlciBmb3IgYSBzZXR0aW5nIGlkZW50aWZpZXIuJ10gfSwgXCJDb250cm9scyB3aGV0aGVyIHRoZSBsYXlvdXQgY29udHJvbCBpcyBzaG93biBpbiB0aGUgY3VzdG9tIHRpdGxlIGJhci4gVGhpcyBzZXR0aW5nIG9ubHkgaGFzIGFuIGVmZmVjdCB3aGVuIHswfSBpcyBub3Qgc2V0IHRvIHsxfS5cIiwgJ2Ajd2luZG93LmN1c3RvbVRpdGxlQmFyVmlzaWJpbGl0eSNgJywgJ2BuZXZlcmAnKVxuXHRcdFx0fSxcblx0XHRcdCd3b3JrYmVuY2gubGF5b3V0Q29udHJvbC50eXBlJzoge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHQnZW51bSc6IFsnbWVudScsICd0b2dnbGVzJywgJ2JvdGgnXSxcblx0XHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdFx0bG9jYWxpemUoJ2xheW91dGNvbnRyb2wudHlwZS5tZW51JywgXCJTaG93cyBhIHNpbmdsZSBidXR0b24gd2l0aCBhIGRyb3Bkb3duIG9mIGxheW91dCBvcHRpb25zLlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnbGF5b3V0Y29udHJvbC50eXBlLnRvZ2dsZXMnLCBcIlNob3dzIHNldmVyYWwgYnV0dG9ucyBmb3IgdG9nZ2xpbmcgdGhlIHZpc2liaWxpdHkgb2YgdGhlIHBhbmVscyBhbmQgc2lkZSBiYXIuXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCdsYXlvdXRjb250cm9sLnR5cGUuYm90aCcsIFwiU2hvd3MgYm90aCB0aGUgZHJvcGRvd24gYW5kIHRvZ2dsZSBidXR0b25zLlwiKSxcblx0XHRcdFx0XSxcblx0XHRcdFx0J2RlZmF1bHQnOiAnYm90aCcsXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdsYXlvdXRDb250cm9sVHlwZScsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgbGF5b3V0IGNvbnRyb2wgaW4gdGhlIGN1c3RvbSB0aXRsZSBiYXIgaXMgZGlzcGxheWVkIGFzIGEgc2luZ2xlIG1lbnUgYnV0dG9uIG9yIHdpdGggbXVsdGlwbGUgVUkgdG9nZ2xlcy5cIiksXG5cdFx0XHR9LFxuXHRcdFx0J3dvcmtiZW5jaC50aXBzLmVuYWJsZWQnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHQnZGVmYXVsdCc6IHRydWUsXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCd0aXBzLmVuYWJsZWQnLCBcIldoZW4gZW5hYmxlZCwgd2lsbCBzaG93IHRoZSB3YXRlcm1hcmsgdGlwcyB3aGVuIG5vIGVkaXRvciBpcyBvcGVuLlwiKVxuXHRcdFx0fSxcblx0XHR9XG5cdH0pO1xuXG5cdC8vIFdpbmRvd1xuXG5cdGxldCB3aW5kb3dUaXRsZURlc2NyaXB0aW9uID0gbG9jYWxpemUoJ3dpbmRvd1RpdGxlJywgXCJDb250cm9scyB0aGUgd2luZG93IHRpdGxlIGJhc2VkIG9uIHRoZSBjdXJyZW50IGNvbnRleHQgc3VjaCBhcyB0aGUgb3BlbmVkIHdvcmtzcGFjZSBvciBhY3RpdmUgZWRpdG9yLiBWYXJpYWJsZXMgYXJlIHN1YnN0aXR1dGVkIGJhc2VkIG9uIHRoZSBjb250ZXh0OlwiKTtcblx0d2luZG93VGl0bGVEZXNjcmlwdGlvbiArPSAnXFxuLSAnICsgW1xuXHRcdGxvY2FsaXplKCdhY3RpdmVFZGl0b3JTaG9ydCcsIFwiYCR7YWN0aXZlRWRpdG9yU2hvcnR9YDogdGhlIGZpbGUgbmFtZSAoZS5nLiBteUZpbGUudHh0KS5cIiksXG5cdFx0bG9jYWxpemUoJ2FjdGl2ZUVkaXRvck1lZGl1bScsIFwiYCR7YWN0aXZlRWRpdG9yTWVkaXVtfWA6IHRoZSBwYXRoIG9mIHRoZSBmaWxlIHJlbGF0aXZlIHRvIHRoZSB3b3Jrc3BhY2UgZm9sZGVyIChlLmcuIG15Rm9sZGVyL215RmlsZUZvbGRlci9teUZpbGUudHh0KS5cIiksXG5cdFx0bG9jYWxpemUoJ2FjdGl2ZUVkaXRvckxvbmcnLCBcImAke2FjdGl2ZUVkaXRvckxvbmd9YDogdGhlIGZ1bGwgcGF0aCBvZiB0aGUgZmlsZSAoZS5nLiAvVXNlcnMvRGV2ZWxvcG1lbnQvbXlGb2xkZXIvbXlGaWxlRm9sZGVyL215RmlsZS50eHQpLlwiKSxcblx0XHRsb2NhbGl6ZSgnYWN0aXZlRm9sZGVyU2hvcnQnLCBcImAke2FjdGl2ZUZvbGRlclNob3J0fWA6IHRoZSBuYW1lIG9mIHRoZSBmb2xkZXIgdGhlIGZpbGUgaXMgY29udGFpbmVkIGluIChlLmcuIG15RmlsZUZvbGRlcikuXCIpLFxuXHRcdGxvY2FsaXplKCdhY3RpdmVGb2xkZXJNZWRpdW0nLCBcImAke2FjdGl2ZUZvbGRlck1lZGl1bX1gOiB0aGUgcGF0aCBvZiB0aGUgZm9sZGVyIHRoZSBmaWxlIGlzIGNvbnRhaW5lZCBpbiwgcmVsYXRpdmUgdG8gdGhlIHdvcmtzcGFjZSBmb2xkZXIgKGUuZy4gbXlGb2xkZXIvbXlGaWxlRm9sZGVyKS5cIiksXG5cdFx0bG9jYWxpemUoJ2FjdGl2ZUZvbGRlckxvbmcnLCBcImAke2FjdGl2ZUZvbGRlckxvbmd9YDogdGhlIGZ1bGwgcGF0aCBvZiB0aGUgZm9sZGVyIHRoZSBmaWxlIGlzIGNvbnRhaW5lZCBpbiAoZS5nLiAvVXNlcnMvRGV2ZWxvcG1lbnQvbXlGb2xkZXIvbXlGaWxlRm9sZGVyKS5cIiksXG5cdFx0bG9jYWxpemUoJ2ZvbGRlck5hbWUnLCBcImAke2ZvbGRlck5hbWV9YDogbmFtZSBvZiB0aGUgd29ya3NwYWNlIGZvbGRlciB0aGUgZmlsZSBpcyBjb250YWluZWQgaW4gKGUuZy4gbXlGb2xkZXIpLlwiKSxcblx0XHRsb2NhbGl6ZSgnZm9sZGVyUGF0aCcsIFwiYCR7Zm9sZGVyUGF0aH1gOiBmaWxlIHBhdGggb2YgdGhlIHdvcmtzcGFjZSBmb2xkZXIgdGhlIGZpbGUgaXMgY29udGFpbmVkIGluIChlLmcuIC9Vc2Vycy9EZXZlbG9wbWVudC9teUZvbGRlcikuXCIpLFxuXHRcdGxvY2FsaXplKCdyb290TmFtZScsIFwiYCR7cm9vdE5hbWV9YDogbmFtZSBvZiB0aGUgd29ya3NwYWNlIHdpdGggb3B0aW9uYWwgcmVtb3RlIG5hbWUgYW5kIHdvcmtzcGFjZSBpbmRpY2F0b3IgaWYgYXBwbGljYWJsZSAoZS5nLiBteUZvbGRlciwgbXlSZW1vdGVGb2xkZXIgW1NTSF0gb3IgbXlXb3Jrc3BhY2UgKFdvcmtzcGFjZSkpLlwiKSxcblx0XHRsb2NhbGl6ZSgncm9vdE5hbWVTaG9ydCcsIFwiYCR7cm9vdE5hbWVTaG9ydH1gOiBzaG9ydGVuZWQgbmFtZSBvZiB0aGUgd29ya3NwYWNlIHdpdGhvdXQgc3VmZml4ZXMgKGUuZy4gbXlGb2xkZXIsIG15UmVtb3RlRm9sZGVyIG9yIG15V29ya3NwYWNlKS5cIiksXG5cdFx0bG9jYWxpemUoJ3Jvb3RQYXRoJywgXCJgJHtyb290UGF0aH1gOiBmaWxlIHBhdGggb2YgdGhlIG9wZW5lZCB3b3Jrc3BhY2Ugb3IgZm9sZGVyIChlLmcuIC9Vc2Vycy9EZXZlbG9wbWVudC9teVdvcmtzcGFjZSkuXCIpLFxuXHRcdGxvY2FsaXplKCdwcm9maWxlTmFtZScsIFwiYCR7cHJvZmlsZU5hbWV9YDogbmFtZSBvZiB0aGUgcHJvZmlsZSBpbiB3aGljaCB0aGUgd29ya3NwYWNlIGlzIG9wZW5lZCAoZS5nLiBEYXRhIFNjaWVuY2UgKFByb2ZpbGUpKS4gSWdub3JlZCBpZiBkZWZhdWx0IHByb2ZpbGUgaXMgdXNlZC5cIiksXG5cdFx0bG9jYWxpemUoJ2FwcE5hbWUnLCBcImAke2FwcE5hbWV9YDogZS5nLiBWUyBDb2RlLlwiKSxcblx0XHRsb2NhbGl6ZSgncmVtb3RlTmFtZScsIFwiYCR7cmVtb3RlTmFtZX1gOiBlLmcuIFNTSFwiKSxcblx0XHRsb2NhbGl6ZSgnZGlydHknLCBcImAke2RpcnR5fWA6IGFuIGluZGljYXRvciBmb3Igd2hlbiB0aGUgYWN0aXZlIGVkaXRvciBoYXMgdW5zYXZlZCBjaGFuZ2VzLlwiKSxcblx0XHRsb2NhbGl6ZSgnZm9jdXNlZFZpZXcnLCBcImAke2ZvY3VzZWRWaWV3fWA6IHRoZSBuYW1lIG9mIHRoZSB2aWV3IHRoYXQgaXMgY3VycmVudGx5IGZvY3VzZWQuXCIpLFxuXHRcdGxvY2FsaXplKCdhY3RpdmVSZXBvc2l0b3J5TmFtZScsIFwiYCR7YWN0aXZlUmVwb3NpdG9yeU5hbWV9YDogdGhlIG5hbWUgb2YgdGhlIGFjdGl2ZSByZXBvc2l0b3J5IChlLmcuIHZzY29kZSkuXCIpLFxuXHRcdGxvY2FsaXplKCdhY3RpdmVSZXBvc2l0b3J5QnJhbmNoTmFtZScsIFwiYCR7YWN0aXZlUmVwb3NpdG9yeUJyYW5jaE5hbWV9YDogdGhlIG5hbWUgb2YgdGhlIGFjdGl2ZSBicmFuY2ggaW4gdGhlIGFjdGl2ZSByZXBvc2l0b3J5IChlLmcuIG1haW4pLlwiKSxcblx0XHRsb2NhbGl6ZSgnYWN0aXZlRWRpdG9yU3RhdGUnLCBcImAke2FjdGl2ZUVkaXRvclN0YXRlfWA6IHByb3ZpZGVzIGluZm9ybWF0aW9uIGFib3V0IHRoZSBzdGF0ZSBvZiB0aGUgYWN0aXZlIGVkaXRvciAoZS5nLiBtb2RpZmllZCkuIFRoaXMgd2lsbCBiZSBhcHBlbmRlZCBieSBkZWZhdWx0IHdoZW4gaW4gc2NyZWVuIHJlYWRlciBtb2RlIHdpdGggezB9IGVuYWJsZWQuXCIsICdgYWNjZXNzaWJpbGl0eS53aW5kb3dUaXRsZU9wdGltaXplZGAnKSxcblx0XHRsb2NhbGl6ZSgnc2VwYXJhdG9yJywgXCJgJHtzZXBhcmF0b3J9YDogYSBjb25kaXRpb25hbCBzZXBhcmF0b3IgKFxcXCIgLSBcXFwiKSB0aGF0IG9ubHkgc2hvd3Mgd2hlbiBzdXJyb3VuZGVkIGJ5IHZhcmlhYmxlcyB3aXRoIHZhbHVlcyBvciBzdGF0aWMgdGV4dC5cIilcblx0XS5qb2luKCdcXG4tICcpOyAvLyBpbnRlbnRpb25hbGx5IGNvbmNhdGVuYXRlZCB0byBub3QgcHJvZHVjZSBhIHN0cmluZyB0aGF0IGlzIHRvbyBsb25nIGZvciB0cmFuc2xhdGlvbnNcblxuXHRyZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdC4uLndpbmRvd0NvbmZpZ3VyYXRpb25Ob2RlQmFzZSxcblx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdCd3aW5kb3cudGl0bGUnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdkZWZhdWx0JzogZGVmYXVsdFdpbmRvd1RpdGxlLFxuXHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IHdpbmRvd1RpdGxlRGVzY3JpcHRpb25cblx0XHRcdH0sXG5cdFx0XHQnd2luZG93LnRpdGxlU2VwYXJhdG9yJzoge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHQnZGVmYXVsdCc6IGRlZmF1bHRXaW5kb3dUaXRsZVNlcGFyYXRvcixcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZShcIndpbmRvdy50aXRsZVNlcGFyYXRvclwiLCBcIlNlcGFyYXRvciB1c2VkIGJ5IHswfS5cIiwgJ2Ajd2luZG93LnRpdGxlI2AnKVxuXHRcdFx0fSxcblx0XHRcdFtMYXlvdXRTZXR0aW5ncy5DT01NQU5EX0NFTlRFUl06IHtcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBpc1dlYiA/XG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dpbmRvdy5jb21tYW5kQ2VudGVyV2ViJywgXCJTaG93IGNvbW1hbmQgbGF1bmNoZXIgdG9nZXRoZXIgd2l0aCB0aGUgd2luZG93IHRpdGxlLlwiKSA6XG5cdFx0XHRcdFx0bG9jYWxpemUoeyBrZXk6ICd3aW5kb3cuY29tbWFuZENlbnRlcicsIGNvbW1lbnQ6IFsnezB9LCB7MX0gaXMgYSBwbGFjZWhvbGRlciBmb3IgYSBzZXR0aW5nIGlkZW50aWZpZXIuJ10gfSwgXCJTaG93IGNvbW1hbmQgbGF1bmNoZXIgdG9nZXRoZXIgd2l0aCB0aGUgd2luZG93IHRpdGxlLiBUaGlzIHNldHRpbmcgb25seSBoYXMgYW4gZWZmZWN0IHdoZW4gezB9IGlzIG5vdCBzZXQgdG8gezF9LlwiLCAnYCN3aW5kb3cuY3VzdG9tVGl0bGVCYXJWaXNpYmlsaXR5I2AnLCAnYG5ldmVyYCcpXG5cdFx0XHR9LFxuXHRcdFx0J3dpbmRvdy5tZW51QmFyVmlzaWJpbGl0eSc6IHtcblx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0J2VudW0nOiBbJ2NsYXNzaWMnLCAndmlzaWJsZScsICd0b2dnbGUnLCAnaGlkZGVuJywgJ2NvbXBhY3QnXSxcblx0XHRcdFx0J21hcmtkb3duRW51bURlc2NyaXB0aW9ucyc6IFtcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd2luZG93Lm1lbnVCYXJWaXNpYmlsaXR5LmNsYXNzaWMnLCBcIk1lbnUgaXMgZGlzcGxheWVkIGF0IHRoZSB0b3Agb2YgdGhlIHdpbmRvdyBhbmQgb25seSBoaWRkZW4gaW4gZnVsbCBzY3JlZW4gbW9kZS5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dpbmRvdy5tZW51QmFyVmlzaWJpbGl0eS52aXNpYmxlJywgXCJNZW51IGlzIGFsd2F5cyB2aXNpYmxlIGF0IHRoZSB0b3Agb2YgdGhlIHdpbmRvdyBldmVuIGluIGZ1bGwgc2NyZWVuIG1vZGUuXCIpLFxuXHRcdFx0XHRcdGlzTWFjaW50b3NoID9cblx0XHRcdFx0XHRcdGxvY2FsaXplKCd3aW5kb3cubWVudUJhclZpc2liaWxpdHkudG9nZ2xlLm1hYycsIFwiTWVudSBpcyBoaWRkZW4gYnV0IGNhbiBiZSBkaXNwbGF5ZWQgYXQgdGhlIHRvcCBvZiB0aGUgd2luZG93IGJ5IGV4ZWN1dGluZyB0aGUgYEZvY3VzIEFwcGxpY2F0aW9uIE1lbnVgIGNvbW1hbmQuXCIpIDpcblx0XHRcdFx0XHRcdGxvY2FsaXplKCd3aW5kb3cubWVudUJhclZpc2liaWxpdHkudG9nZ2xlJywgXCJNZW51IGlzIGhpZGRlbiBidXQgY2FuIGJlIGRpc3BsYXllZCBhdCB0aGUgdG9wIG9mIHRoZSB3aW5kb3cgdmlhIHRoZSBBbHQga2V5LlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd2luZG93Lm1lbnVCYXJWaXNpYmlsaXR5LmhpZGRlbicsIFwiTWVudSBpcyBhbHdheXMgaGlkZGVuLlwiKSxcblx0XHRcdFx0XHRpc1dlYiA/XG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnd2luZG93Lm1lbnVCYXJWaXNpYmlsaXR5LmNvbXBhY3Qud2ViJywgXCJNZW51IGlzIGRpc3BsYXllZCBhcyBhIGNvbXBhY3QgYnV0dG9uIGluIHRoZSBzaWRlIGJhci5cIikgOlxuXHRcdFx0XHRcdFx0bG9jYWxpemUoeyBrZXk6ICd3aW5kb3cubWVudUJhclZpc2liaWxpdHkuY29tcGFjdCcsIGNvbW1lbnQ6IFsnezB9LCB7MX0gaXMgYSBwbGFjZWhvbGRlciBmb3IgYSBzZXR0aW5nIGlkZW50aWZpZXIuJ10gfSwgXCJNZW51IGlzIGRpc3BsYXllZCBhcyBhIGNvbXBhY3QgYnV0dG9uIGluIHRoZSBzaWRlIGJhci4gVGhpcyB2YWx1ZSBpcyBpZ25vcmVkIHdoZW4gezB9IGlzIHsxfS5cIiwgJ2Ajd2luZG93LnRpdGxlQmFyU3R5bGUjYCcsICdgbmF0aXZlYCcpXG5cdFx0XHRcdF0sXG5cdFx0XHRcdCdkZWZhdWx0JzogaXNXZWIgPyAnY29tcGFjdCcgOiAnY2xhc3NpYycsXG5cdFx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTixcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBpc01hY2ludG9zaCA/XG5cdFx0XHRcdFx0bG9jYWxpemUoJ21lbnVCYXJWaXNpYmlsaXR5Lm1hYycsIFwiQ29udHJvbCB0aGUgdmlzaWJpbGl0eSBvZiB0aGUgbWVudSBiYXIuIEEgc2V0dGluZyBvZiAndG9nZ2xlJyBtZWFucyB0aGF0IHRoZSBtZW51IGJhciBpcyBoaWRkZW4gYW5kIGV4ZWN1dGluZyBgRm9jdXMgQXBwbGljYXRpb24gTWVudWAgd2lsbCBzaG93IGl0LiBBIHNldHRpbmcgb2YgJ2NvbXBhY3QnIHdpbGwgbW92ZSB0aGUgbWVudSBpbnRvIHRoZSBzaWRlIGJhci5cIikgOlxuXHRcdFx0XHRcdGxvY2FsaXplKCdtZW51QmFyVmlzaWJpbGl0eScsIFwiQ29udHJvbCB0aGUgdmlzaWJpbGl0eSBvZiB0aGUgbWVudSBiYXIuIEEgc2V0dGluZyBvZiAndG9nZ2xlJyBtZWFucyB0aGF0IHRoZSBtZW51IGJhciBpcyBoaWRkZW4gYW5kIGEgc2luZ2xlIHByZXNzIG9mIHRoZSBBbHQga2V5IHdpbGwgc2hvdyBpdC4gQSBzZXR0aW5nIG9mICdjb21wYWN0JyB3aWxsIG1vdmUgdGhlIG1lbnUgaW50byB0aGUgc2lkZSBiYXIuXCIpLFxuXHRcdFx0XHQnaW5jbHVkZWQnOiBpc1dpbmRvd3MgfHwgaXNMaW51eCB8fCBpc1dlYlxuXHRcdFx0fSxcblx0XHRcdCd3aW5kb3cuZW5hYmxlTWVudUJhck1uZW1vbmljcyc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZWZhdWx0JzogdHJ1ZSxcblx0XHRcdFx0J3Njb3BlJzogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnZW5hYmxlTWVudUJhck1uZW1vbmljcycsIFwiQ29udHJvbHMgd2hldGhlciB0aGUgbWFpbiBtZW51cyBjYW4gYmUgb3BlbmVkIHZpYSBBbHQta2V5IHNob3J0Y3V0cy4gRGlzYWJsaW5nIG1uZW1vbmljcyBhbGxvd3MgdG8gYmluZCB0aGVzZSBBbHQta2V5IHNob3J0Y3V0cyB0byBlZGl0b3IgY29tbWFuZHMgaW5zdGVhZC5cIiksXG5cdFx0XHRcdCdpbmNsdWRlZCc6IGlzV2luZG93cyB8fCBpc0xpbnV4XG5cdFx0XHR9LFxuXHRcdFx0J3dpbmRvdy5jdXN0b21NZW51QmFyQWx0Rm9jdXMnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHQnZGVmYXVsdCc6IHRydWUsXG5cdFx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTixcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnY3VzdG9tTWVudUJhckFsdEZvY3VzJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBtZW51IGJhciB3aWxsIGJlIGZvY3VzZWQgYnkgcHJlc3NpbmcgdGhlIEFsdC1rZXkuIFRoaXMgc2V0dGluZyBoYXMgbm8gZWZmZWN0IG9uIHRvZ2dsaW5nIHRoZSBtZW51IGJhciB3aXRoIHRoZSBBbHQta2V5LlwiKSxcblx0XHRcdFx0J2luY2x1ZGVkJzogaXNXaW5kb3dzIHx8IGlzTGludXhcblx0XHRcdH0sXG5cdFx0XHQnd2luZG93Lm9wZW5GaWxlc0luTmV3V2luZG93Jzoge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHQnZW51bSc6IFsnb24nLCAnb2ZmJywgJ2RlZmF1bHQnXSxcblx0XHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dpbmRvdy5vcGVuRmlsZXNJbk5ld1dpbmRvdy5vbicsIFwiRmlsZXMgd2lsbCBvcGVuIGluIGEgbmV3IHdpbmRvdy5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dpbmRvdy5vcGVuRmlsZXNJbk5ld1dpbmRvdy5vZmYnLCBcIkZpbGVzIHdpbGwgb3BlbiBpbiB0aGUgd2luZG93IHdpdGggdGhlIGZpbGVzJyBmb2xkZXIgb3BlbiBvciB0aGUgbGFzdCBhY3RpdmUgd2luZG93LlwiKSxcblx0XHRcdFx0XHRpc01hY2ludG9zaCA/XG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnd2luZG93Lm9wZW5GaWxlc0luTmV3V2luZG93LmRlZmF1bHRNYWMnLCBcIkZpbGVzIHdpbGwgb3BlbiBpbiB0aGUgd2luZG93IHdpdGggdGhlIGZpbGVzJyBmb2xkZXIgb3BlbiBvciB0aGUgbGFzdCBhY3RpdmUgd2luZG93IHVubGVzcyBvcGVuZWQgdmlhIHRoZSBEb2NrIG9yIGZyb20gRmluZGVyLlwiKSA6XG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnd2luZG93Lm9wZW5GaWxlc0luTmV3V2luZG93LmRlZmF1bHQnLCBcIkZpbGVzIHdpbGwgb3BlbiBpbiBhIG5ldyB3aW5kb3cgdW5sZXNzIHBpY2tlZCBmcm9tIHdpdGhpbiB0aGUgYXBwbGljYXRpb24gKGUuZy4gdmlhIHRoZSBGaWxlIG1lbnUpLlwiKVxuXHRcdFx0XHRdLFxuXHRcdFx0XHQnZGVmYXVsdCc6ICdvZmYnLFxuXHRcdFx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzpcblx0XHRcdFx0XHRpc01hY2ludG9zaCA/XG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnb3BlbkZpbGVzSW5OZXdXaW5kb3dNYWMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgZmlsZXMgc2hvdWxkIG9wZW4gaW4gYSBuZXcgd2luZG93IHdoZW4gdXNpbmcgYSBjb21tYW5kIGxpbmUgb3IgZmlsZSBkaWFsb2cuXFxuTm90ZSB0aGF0IHRoZXJlIGNhbiBzdGlsbCBiZSBjYXNlcyB3aGVyZSB0aGlzIHNldHRpbmcgaXMgaWdub3JlZCAoZS5nLiB3aGVuIHVzaW5nIHRoZSBgLS1uZXctd2luZG93YCBvciBgLS1yZXVzZS13aW5kb3dgIGNvbW1hbmQgbGluZSBvcHRpb24pLlwiKSA6XG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnb3BlbkZpbGVzSW5OZXdXaW5kb3cnLCBcIkNvbnRyb2xzIHdoZXRoZXIgZmlsZXMgc2hvdWxkIG9wZW4gaW4gYSBuZXcgd2luZG93IHdoZW4gdXNpbmcgYSBjb21tYW5kIGxpbmUgb3IgZmlsZSBkaWFsb2cuXFxuTm90ZSB0aGF0IHRoZXJlIGNhbiBzdGlsbCBiZSBjYXNlcyB3aGVyZSB0aGlzIHNldHRpbmcgaXMgaWdub3JlZCAoZS5nLiB3aGVuIHVzaW5nIHRoZSBgLS1uZXctd2luZG93YCBvciBgLS1yZXVzZS13aW5kb3dgIGNvbW1hbmQgbGluZSBvcHRpb24pLlwiKVxuXHRcdFx0fSxcblx0XHRcdCd3aW5kb3cub3BlbkZvbGRlcnNJbk5ld1dpbmRvdyc6IHtcblx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0J2VudW0nOiBbJ29uJywgJ29mZicsICdkZWZhdWx0J10sXG5cdFx0XHRcdCdlbnVtRGVzY3JpcHRpb25zJzogW1xuXHRcdFx0XHRcdGxvY2FsaXplKCd3aW5kb3cub3BlbkZvbGRlcnNJbk5ld1dpbmRvdy5vbicsIFwiRm9sZGVycyB3aWxsIG9wZW4gaW4gYSBuZXcgd2luZG93LlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd2luZG93Lm9wZW5Gb2xkZXJzSW5OZXdXaW5kb3cub2ZmJywgXCJGb2xkZXJzIHdpbGwgcmVwbGFjZSB0aGUgbGFzdCBhY3RpdmUgd2luZG93LlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd2luZG93Lm9wZW5Gb2xkZXJzSW5OZXdXaW5kb3cuZGVmYXVsdCcsIFwiRm9sZGVycyB3aWxsIG9wZW4gaW4gYSBuZXcgd2luZG93IHVubGVzcyBhIGZvbGRlciBpcyBwaWNrZWQgZnJvbSB3aXRoaW4gdGhlIGFwcGxpY2F0aW9uIChlLmcuIHZpYSB0aGUgRmlsZSBtZW51KS5cIilcblx0XHRcdFx0XSxcblx0XHRcdFx0J2RlZmF1bHQnOiAnZGVmYXVsdCcsXG5cdFx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTixcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnb3BlbkZvbGRlcnNJbk5ld1dpbmRvdycsIFwiQ29udHJvbHMgd2hldGhlciBmb2xkZXJzIHNob3VsZCBvcGVuIGluIGEgbmV3IHdpbmRvdyBvciByZXBsYWNlIHRoZSBsYXN0IGFjdGl2ZSB3aW5kb3cuXFxuTm90ZSB0aGF0IHRoZXJlIGNhbiBzdGlsbCBiZSBjYXNlcyB3aGVyZSB0aGlzIHNldHRpbmcgaXMgaWdub3JlZCAoZS5nLiB3aGVuIHVzaW5nIHRoZSBgLS1uZXctd2luZG93YCBvciBgLS1yZXVzZS13aW5kb3dgIGNvbW1hbmQgbGluZSBvcHRpb24pLlwiKVxuXHRcdFx0fSxcblx0XHRcdCd3aW5kb3cuY29uZmlybUJlZm9yZUNsb3NlJzoge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHQnZW51bSc6IFsnYWx3YXlzJywgJ2tleWJvYXJkT25seScsICduZXZlciddLFxuXHRcdFx0XHQnZW51bURlc2NyaXB0aW9ucyc6IFtcblx0XHRcdFx0XHRpc1dlYiA/XG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnd2luZG93LmNvbmZpcm1CZWZvcmVDbG9zZS5hbHdheXMud2ViJywgXCJBbHdheXMgdHJ5IHRvIGFzayBmb3IgY29uZmlybWF0aW9uLiBOb3RlIHRoYXQgYnJvd3NlcnMgbWF5IHN0aWxsIGRlY2lkZSB0byBjbG9zZSBhIHRhYiBvciB3aW5kb3cgd2l0aG91dCBjb25maXJtYXRpb24uXCIpIDpcblx0XHRcdFx0XHRcdGxvY2FsaXplKCd3aW5kb3cuY29uZmlybUJlZm9yZUNsb3NlLmFsd2F5cycsIFwiQWx3YXlzIGFzayBmb3IgY29uZmlybWF0aW9uLlwiKSxcblx0XHRcdFx0XHRpc1dlYiA/XG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnd2luZG93LmNvbmZpcm1CZWZvcmVDbG9zZS5rZXlib2FyZE9ubHkud2ViJywgXCJPbmx5IGFzayBmb3IgY29uZmlybWF0aW9uIGlmIGEga2V5YmluZGluZyB3YXMgdXNlZCB0byBjbG9zZSB0aGUgd2luZG93LiBOb3RlIHRoYXQgZGV0ZWN0aW9uIG1heSBub3QgYmUgcG9zc2libGUgaW4gc29tZSBjYXNlcy5cIikgOlxuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ3dpbmRvdy5jb25maXJtQmVmb3JlQ2xvc2Uua2V5Ym9hcmRPbmx5JywgXCJPbmx5IGFzayBmb3IgY29uZmlybWF0aW9uIGlmIGEga2V5YmluZGluZyB3YXMgdXNlZC5cIiksXG5cdFx0XHRcdFx0aXNXZWIgP1xuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ3dpbmRvdy5jb25maXJtQmVmb3JlQ2xvc2UubmV2ZXIud2ViJywgXCJOZXZlciBleHBsaWNpdGx5IGFzayBmb3IgY29uZmlybWF0aW9uIHVubGVzcyBkYXRhIGxvc3MgaXMgaW1taW5lbnQuXCIpIDpcblx0XHRcdFx0XHRcdGxvY2FsaXplKCd3aW5kb3cuY29uZmlybUJlZm9yZUNsb3NlLm5ldmVyJywgXCJOZXZlciBleHBsaWNpdGx5IGFzayBmb3IgY29uZmlybWF0aW9uLlwiKVxuXHRcdFx0XHRdLFxuXHRcdFx0XHQnZGVmYXVsdCc6IChpc1dlYiAmJiAhaXNTdGFuZGFsb25lKCkpID8gJ2tleWJvYXJkT25seScgOiAnbmV2ZXInLCAvLyBvbiBieSBkZWZhdWx0IGluIHdlYiwgdW5sZXNzIFBXQSwgbmV2ZXIgb24gZGVza3RvcFxuXHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGlzV2ViID9cblx0XHRcdFx0XHRsb2NhbGl6ZSgnY29uZmlybUJlZm9yZUNsb3NlV2ViJywgXCJDb250cm9scyB3aGV0aGVyIHRvIHNob3cgYSBjb25maXJtYXRpb24gZGlhbG9nIGJlZm9yZSBjbG9zaW5nIHRoZSBicm93c2VyIHRhYiBvciB3aW5kb3cuIE5vdGUgdGhhdCBldmVuIGlmIGVuYWJsZWQsIGJyb3dzZXJzIG1heSBzdGlsbCBkZWNpZGUgdG8gY2xvc2UgYSB0YWIgb3Igd2luZG93IHdpdGhvdXQgY29uZmlybWF0aW9uIGFuZCB0aGF0IHRoaXMgc2V0dGluZyBpcyBvbmx5IGEgaGludCB0aGF0IG1heSBub3Qgd29yayBpbiBhbGwgY2FzZXMuXCIpIDpcblx0XHRcdFx0XHRsb2NhbGl6ZSgnY29uZmlybUJlZm9yZUNsb3NlJywgXCJDb250cm9scyB3aGV0aGVyIHRvIHNob3cgYSBjb25maXJtYXRpb24gZGlhbG9nIGJlZm9yZSBjbG9zaW5nIGEgd2luZG93IG9yIHF1aXR0aW5nIHRoZSBhcHBsaWNhdGlvbi5cIiksXG5cdFx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTlxuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0Ly8gRHluYW1pYyBXaW5kb3cgQ29uZmlndXJhdGlvblxuXHRyZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoRHluYW1pY1dpbmRvd0NvbmZpZ3VyYXRpb24uSUQsIER5bmFtaWNXaW5kb3dDb25maWd1cmF0aW9uLCBXb3JrYmVuY2hQaGFzZS5FdmVudHVhbGx5KTtcblxuXHQvLyBQcm9ibGVtc1xuXHRyZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdC4uLnByb2JsZW1zQ29uZmlndXJhdGlvbk5vZGVCYXNlLFxuXHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0J3Byb2JsZW1zLnZpc2liaWxpdHknOiB7XG5cdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHQnZGVmYXVsdCc6IHRydWUsXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdwcm9ibGVtcy52aXNpYmlsaXR5JywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBwcm9ibGVtcyBhcmUgdmlzaWJsZSB0aHJvdWdob3V0IHRoZSBlZGl0b3IgYW5kIHdvcmtiZW5jaC5cIiksXG5cdFx0XHR9LFxuXHRcdH1cblx0fSk7XG5cblx0Ly8gWmVuIE1vZGVcblx0cmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0XHQnaWQnOiAnemVuTW9kZScsXG5cdFx0J29yZGVyJzogOSxcblx0XHQndGl0bGUnOiBsb2NhbGl6ZSgnemVuTW9kZUNvbmZpZ3VyYXRpb25UaXRsZScsIFwiWmVuIE1vZGVcIiksXG5cdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdCd6ZW5Nb2RlLmZ1bGxTY3JlZW4nOiB7XG5cdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHQnZGVmYXVsdCc6IHRydWUsXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCd6ZW5Nb2RlLmZ1bGxTY3JlZW4nLCBcIkNvbnRyb2xzIHdoZXRoZXIgdHVybmluZyBvbiBaZW4gTW9kZSBhbHNvIHB1dHMgdGhlIHdvcmtiZW5jaCBpbnRvIGZ1bGwgc2NyZWVuIG1vZGUuXCIpXG5cdFx0XHR9LFxuXHRcdFx0J3plbk1vZGUuY2VudGVyTGF5b3V0Jzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnemVuTW9kZS5jZW50ZXJMYXlvdXQnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdHVybmluZyBvbiBaZW4gTW9kZSBhbHNvIGNlbnRlcnMgdGhlIGxheW91dC5cIilcblx0XHRcdH0sXG5cdFx0XHQnemVuTW9kZS5zaG93VGFicyc6IHtcblx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0J2VudW0nOiBbJ211bHRpcGxlJywgJ3NpbmdsZScsICdub25lJ10sXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCd6ZW5Nb2RlLnNob3dUYWJzJywgXCJDb250cm9scyB3aGV0aGVyIHR1cm5pbmcgb24gWmVuIE1vZGUgc2hvdWxkIHNob3cgbXVsdGlwbGUgZWRpdG9yIHRhYnMsIGEgc2luZ2xlIGVkaXRvciB0YWIsIG9yIGhpZGUgdGhlIGVkaXRvciB0aXRsZSBhcmVhIGNvbXBsZXRlbHkuXCIpLFxuXHRcdFx0XHQnZW51bURlc2NyaXB0aW9ucyc6IFtcblx0XHRcdFx0XHRsb2NhbGl6ZSgnemVuTW9kZS5zaG93VGFicy5tdWx0aXBsZScsIFwiRWFjaCBlZGl0b3IgaXMgZGlzcGxheWVkIGFzIGEgdGFiIGluIHRoZSBlZGl0b3IgdGl0bGUgYXJlYS5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3plbk1vZGUuc2hvd1RhYnMuc2luZ2xlJywgXCJUaGUgYWN0aXZlIGVkaXRvciBpcyBkaXNwbGF5ZWQgYXMgYSBzaW5nbGUgbGFyZ2UgdGFiIGluIHRoZSBlZGl0b3IgdGl0bGUgYXJlYS5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3plbk1vZGUuc2hvd1RhYnMubm9uZScsIFwiVGhlIGVkaXRvciB0aXRsZSBhcmVhIGlzIG5vdCBkaXNwbGF5ZWQuXCIpLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHQnZGVmYXVsdCc6ICdtdWx0aXBsZSdcblx0XHRcdH0sXG5cdFx0XHQnemVuTW9kZS5oaWRlU3RhdHVzQmFyJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnemVuTW9kZS5oaWRlU3RhdHVzQmFyJywgXCJDb250cm9scyB3aGV0aGVyIHR1cm5pbmcgb24gWmVuIE1vZGUgYWxzbyBoaWRlcyB0aGUgc3RhdHVzIGJhciBhdCB0aGUgYm90dG9tIG9mIHRoZSB3b3JrYmVuY2guXCIpXG5cdFx0XHR9LFxuXHRcdFx0J3plbk1vZGUuaGlkZUFjdGl2aXR5QmFyJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnemVuTW9kZS5oaWRlQWN0aXZpdHlCYXInLCBcIkNvbnRyb2xzIHdoZXRoZXIgdHVybmluZyBvbiBaZW4gTW9kZSBhbHNvIGhpZGVzIHRoZSBhY3Rpdml0eSBiYXIgZWl0aGVyIGF0IHRoZSBsZWZ0IG9yIHJpZ2h0IG9mIHRoZSB3b3JrYmVuY2guXCIpXG5cdFx0XHR9LFxuXHRcdFx0J3plbk1vZGUuaGlkZUxpbmVOdW1iZXJzJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnemVuTW9kZS5oaWRlTGluZU51bWJlcnMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdHVybmluZyBvbiBaZW4gTW9kZSBhbHNvIGhpZGVzIHRoZSBlZGl0b3IgbGluZSBudW1iZXJzLlwiKVxuXHRcdFx0fSxcblx0XHRcdCd6ZW5Nb2RlLnJlc3RvcmUnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHQnZGVmYXVsdCc6IHRydWUsXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCd6ZW5Nb2RlLnJlc3RvcmUnLCBcIkNvbnRyb2xzIHdoZXRoZXIgYSB3aW5kb3cgc2hvdWxkIHJlc3RvcmUgdG8gWmVuIE1vZGUgaWYgaXQgd2FzIGV4aXRlZCBpbiBaZW4gTW9kZS5cIilcblx0XHRcdH0sXG5cdFx0XHQnemVuTW9kZS5zaWxlbnROb3RpZmljYXRpb25zJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnemVuTW9kZS5zaWxlbnROb3RpZmljYXRpb25zJywgXCJDb250cm9scyB3aGV0aGVyIG5vdGlmaWNhdGlvbnMgZG8gbm90IGRpc3R1cmIgbW9kZSBzaG91bGQgYmUgZW5hYmxlZCB3aGlsZSBpbiBaZW4gTW9kZS4gSWYgdHJ1ZSwgb25seSBlcnJvciBub3RpZmljYXRpb25zIHdpbGwgcG9wIG91dC5cIilcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xufSkoKTtcblxuUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25NaWdyYXRpb25SZWdpc3RyeT4oRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uTWlncmF0aW9uKVxuXHQucmVnaXN0ZXJDb25maWd1cmF0aW9uTWlncmF0aW9ucyhbe1xuXHRcdGtleTogJ3dvcmtiZW5jaC5hY3Rpdml0eUJhci52aXNpYmxlJywgbWlncmF0ZUZuOiAodmFsdWU6IGFueSkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBDb25maWd1cmF0aW9uS2V5VmFsdWVQYWlycyA9IFtdO1xuXHRcdFx0aWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goWyd3b3JrYmVuY2guYWN0aXZpdHlCYXIudmlzaWJsZScsIHsgdmFsdWU6IHVuZGVmaW5lZCB9XSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodmFsdWUgPT09IGZhbHNlKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKFtMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT04sIHsgdmFsdWU6IEFjdGl2aXR5QmFyUG9zaXRpb24uSElEREVOIH1dKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHR9XSk7XG5cblJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uTWlncmF0aW9uUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbk1pZ3JhdGlvbilcblx0LnJlZ2lzdGVyQ29uZmlndXJhdGlvbk1pZ3JhdGlvbnMoW3tcblx0XHRrZXk6IExheW91dFNldHRpbmdzLkFDVElWSVRZX0JBUl9MT0NBVElPTiwgbWlncmF0ZUZuOiAodmFsdWU6IGFueSkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzdWx0czogQ29uZmlndXJhdGlvbktleVZhbHVlUGFpcnMgPSBbXTtcblx0XHRcdGlmICh2YWx1ZSA9PT0gJ3NpZGUnKSB7XG5cdFx0XHRcdHJlc3VsdHMucHVzaChbTGF5b3V0U2V0dGluZ3MuQUNUSVZJVFlfQkFSX0xPQ0FUSU9OLCB7IHZhbHVlOiBBY3Rpdml0eUJhclBvc2l0aW9uLkRFRkFVTFQgfV0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdHM7XG5cdFx0fVxuXHR9XSk7XG5cblJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uTWlncmF0aW9uUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbk1pZ3JhdGlvbilcblx0LnJlZ2lzdGVyQ29uZmlndXJhdGlvbk1pZ3JhdGlvbnMoW3tcblx0XHRrZXk6ICd3b3JrYmVuY2guZWRpdG9yLmRvdWJsZUNsaWNrVGFiVG9Ub2dnbGVFZGl0b3JHcm91cFNpemVzJywgbWlncmF0ZUZuOiAodmFsdWU6IGFueSkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzdWx0czogQ29uZmlndXJhdGlvbktleVZhbHVlUGFpcnMgPSBbXTtcblx0XHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJykge1xuXHRcdFx0XHR2YWx1ZSA9IHZhbHVlID8gJ2V4cGFuZCcgOiAnb2ZmJztcblx0XHRcdFx0cmVzdWx0cy5wdXNoKFsnd29ya2JlbmNoLmVkaXRvci5kb3VibGVDbGlja1RhYlRvVG9nZ2xlRWRpdG9yR3JvdXBTaXplcycsIHsgdmFsdWUgfV0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdHM7XG5cdFx0fVxuXHR9LCB7XG5cdFx0a2V5OiBMYXlvdXRTZXR0aW5ncy5FRElUT1JfVEFCU19NT0RFLCBtaWdyYXRlRm46ICh2YWx1ZTogYW55KSA9PiB7XG5cdFx0XHRjb25zdCByZXN1bHRzOiBDb25maWd1cmF0aW9uS2V5VmFsdWVQYWlycyA9IFtdO1xuXHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHRcdHZhbHVlID0gdmFsdWUgPyBFZGl0b3JUYWJzTW9kZS5NVUxUSVBMRSA6IEVkaXRvclRhYnNNb2RlLlNJTkdMRTtcblx0XHRcdFx0cmVzdWx0cy5wdXNoKFtMYXlvdXRTZXR0aW5ncy5FRElUT1JfVEFCU19NT0RFLCB7IHZhbHVlIH1dKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHRzO1xuXHRcdH1cblx0fSwge1xuXHRcdGtleTogJ3dvcmtiZW5jaC5lZGl0b3IudGFiQ2xvc2VCdXR0b24nLCBtaWdyYXRlRm46ICh2YWx1ZTogYW55KSA9PiB7XG5cdFx0XHRjb25zdCByZXN1bHQ6IENvbmZpZ3VyYXRpb25LZXlWYWx1ZVBhaXJzID0gW107XG5cdFx0XHRpZiAodmFsdWUgPT09ICdsZWZ0JyB8fCB2YWx1ZSA9PT0gJ3JpZ2h0Jykge1xuXHRcdFx0XHRyZXN1bHQucHVzaChbJ3dvcmtiZW5jaC5lZGl0b3IudGFiQWN0aW9uTG9jYXRpb24nLCB7IHZhbHVlIH1dKTtcblx0XHRcdH0gZWxzZSBpZiAodmFsdWUgPT09ICdvZmYnKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKFsnd29ya2JlbmNoLmVkaXRvci50YWJBY3Rpb25DbG9zZVZpc2liaWxpdHknLCB7IHZhbHVlOiBmYWxzZSB9XSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0fSwge1xuXHRcdGtleTogJ3plbk1vZGUuaGlkZVRhYnMnLCBtaWdyYXRlRm46ICh2YWx1ZTogYW55KSA9PiB7XG5cdFx0XHRjb25zdCByZXN1bHQ6IENvbmZpZ3VyYXRpb25LZXlWYWx1ZVBhaXJzID0gW1snemVuTW9kZS5oaWRlVGFicycsIHsgdmFsdWU6IHVuZGVmaW5lZCB9XV07XG5cdFx0XHRpZiAodmFsdWUgPT09IHRydWUpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goWyd6ZW5Nb2RlLnNob3dUYWJzJywgeyB2YWx1ZTogJ3NpbmdsZScgfV0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdH1dKTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQWlDLGNBQWMseUJBQXlCLDBCQUEwQjtBQUNsRyxTQUFTLGFBQWEsV0FBVyxTQUFTLE9BQU8sZ0JBQWdCO0FBQ2pFLFNBQVMsNkNBQTZDLHVDQUF3RSxnQ0FBZ0MsWUFBd0MsK0JBQStCLDZCQUE2QixrQ0FBa0M7QUFDcFMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxnQkFBZ0Isc0NB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
