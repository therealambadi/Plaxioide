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
var __decorateParam = (index2, decorator) => (target, key) => decorator(target, key, index2);
import { localize } from "../../../../nls.js";
import { isFalsyOrWhitespace } from "../../../../base/common/strings.js";
import * as resources from "../../../../base/common/resources.js";
import { ExtensionsRegistry } from "../../extensions/common/extensionsRegistry.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { index } from "../../../../base/common/arrays.js";
import { isProposedApiEnabled } from "../../extensions/common/extensions.js";
import { Extensions as ExtensionFeaturesExtensions } from "../../extensionManagement/common/extensionFeatures.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { platform } from "../../../../base/common/process.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
const apiMenus = [
  {
    key: "commandPalette",
    id: MenuId.CommandPalette,
    description: localize("menus.commandPalette", "The Command Palette"),
    supportsSubmenus: false
  },
  {
    key: "touchBar",
    id: MenuId.TouchBarContext,
    description: localize("menus.touchBar", "The touch bar (macOS only)"),
    supportsSubmenus: false
  },
  {
    key: "editor/title",
    id: MenuId.EditorTitle,
    description: localize("menus.editorTitle", "The editor title menu")
  },
  {
    key: "editor/title/run",
    id: MenuId.EditorTitleRun,
    description: localize("menus.editorTitleRun", "Run submenu inside the editor title menu")
  },
  {
    key: "editor/context",
    id: MenuId.EditorContext,
    description: localize("menus.editorContext", "The editor context menu")
  },
  {
    key: "editor/context/copy",
    id: MenuId.EditorContextCopy,
    description: localize("menus.editorContextCopyAs", "'Copy as' submenu in the editor context menu")
  },
  {
    key: "editor/context/share",
    id: MenuId.EditorContextShare,
    description: localize("menus.editorContextShare", "'Share' submenu in the editor context menu"),
    proposed: "contribShareMenu"
  },
  {
    key: "explorer/context",
    id: MenuId.ExplorerContext,
    description: localize("menus.explorerContext", "The file explorer context menu")
  },
  {
    key: "explorer/context/share",
    id: MenuId.ExplorerContextShare,
    description: localize("menus.explorerContextShare", "'Share' submenu in the file explorer context menu"),
    proposed: "contribShareMenu"
  },
  {
    key: "editor/title/context",
    id: MenuId.EditorTitleContext,
    description: localize("menus.editorTabContext", "The editor tabs context menu")
  },
  {
    key: "editor/title/context/share",
    id: MenuId.EditorTitleContextShare,
    description: localize("menus.editorTitleContextShare", "'Share' submenu inside the editor title context menu"),
    proposed: "contribShareMenu"
  },
  {
    key: "debug/callstack/context",
    id: MenuId.DebugCallStackContext,
    description: localize("menus.debugCallstackContext", "The debug callstack view context menu")
  },
  {
    key: "debug/variables/context",
    id: MenuId.DebugVariablesContext,
    description: localize("menus.debugVariablesContext", "The debug variables view context menu")
  },
  {
    key: "debug/toolBar",
    id: MenuId.DebugToolBar,
    description: localize("menus.debugToolBar", "The debug toolbar menu")
  },
  {
    key: "debug/createConfiguration",
    id: MenuId.DebugCreateConfiguration,
    proposed: "contribDebugCreateConfiguration",
    description: localize("menus.debugCreateConfiguation", "The debug create configuration menu")
  },
  {
    key: "notebook/variables/context",
    id: MenuId.NotebookVariablesContext,
    description: localize("menus.notebookVariablesContext", "The notebook variables view context menu")
  },
  {
    key: "menuBar/home",
    id: MenuId.MenubarHomeMenu,
    description: localize("menus.home", "The home indicator context menu (web only)"),
    proposed: "contribMenuBarHome",
    supportsSubmenus: false
  },
  {
    key: "menuBar/edit/copy",
    id: MenuId.MenubarCopy,
    description: localize("menus.opy", "'Copy as' submenu in the top level Edit menu")
  },
  {
    key: "scm/title",
    id: MenuId.SCMTitle,
    description: localize("menus.scmTitle", "The Source Control title menu")
  },
  {
    key: "scm/sourceControl",
    id: MenuId.SCMSourceControl,
    description: localize("menus.scmSourceControl", "The Source Control menu")
  },
  {
    key: "scm/sourceControl/title",
    id: MenuId.SCMSourceControlTitle,
    description: localize("menus.scmSourceControlTitle", "The Source Control title menu"),
    proposed: "contribSourceControlTitleMenu"
  },
  {
    key: "scm/resourceState/context",
    id: MenuId.SCMResourceContext,
    description: localize("menus.resourceStateContext", "The Source Control resource state context menu")
  },
  {
    key: "scm/resourceFolder/context",
    id: MenuId.SCMResourceFolderContext,
    description: localize("menus.resourceFolderContext", "The Source Control resource folder context menu")
  },
  {
    key: "scm/resourceGroup/context",
    id: MenuId.SCMResourceGroupContext,
    description: localize("menus.resourceGroupContext", "The Source Control resource group context menu")
  },
  {
    key: "scm/change/title",
    id: MenuId.SCMChangeContext,
    description: localize("menus.changeTitle", "The Source Control inline change menu")
  },
  {
    key: "scm/inputBox",
    id: MenuId.SCMInputBox,
    description: localize("menus.input", "The Source Control input box menu"),
    proposed: "contribSourceControlInputBoxMenu"
  },
  {
    key: "scm/history/title",
    id: MenuId.SCMHistoryTitle,
    description: localize("menus.scmHistoryTitle", "The Source Control History title menu"),
    proposed: "contribSourceControlHistoryTitleMenu"
  },
  {
    key: "scm/historyItem/context",
    id: MenuId.SCMHistoryItemContext,
    description: localize("menus.historyItemContext", "The Source Control history item context menu"),
    proposed: "contribSourceControlHistoryItemMenu"
  },
  {
    key: "scm/historyItem/hover",
    id: MenuId.SCMHistoryItemHover,
    description: localize("menus.historyItemHover", "The Source Control history item hover menu"),
    proposed: "contribSourceControlHistoryItemMenu"
  },
  {
    key: "scm/historyItemRef/context",
    id: MenuId.SCMHistoryItemRefContext,
    description: localize("menus.historyItemRefContext", "The Source Control history item reference context menu"),
    proposed: "contribSourceControlHistoryItemMenu"
  },
  {
    key: "statusBar/remoteIndicator",
    id: MenuId.StatusBarRemoteIndicatorMenu,
    description: localize("menus.statusBarRemoteIndicator", "The remote indicator menu in the status bar"),
    supportsSubmenus: false
  },
  {
    key: "terminal/context",
    id: MenuId.TerminalInstanceContext,
    description: localize("menus.terminalContext", "The terminal context menu")
  },
  {
    key: "terminal/title/context",
    id: MenuId.TerminalTabContext,
    description: localize("menus.terminalTabContext", "The terminal tabs context menu")
  },
  {
    key: "view/title",
    id: MenuId.ViewTitle,
    description: localize("view.viewTitle", "The contributed view title menu")
  },
  {
    key: "viewContainer/title",
    id: MenuId.ViewContainerTitle,
    description: localize("view.containerTitle", "The contributed view container title menu"),
    proposed: "contribViewContainerTitle"
  },
  {
    key: "view/item/context",
    id: MenuId.ViewItemContext,
    description: localize("view.itemContext", "The contributed view item context menu")
  },
  {
    key: "comments/comment/editorActions",
    id: MenuId.CommentEditorActions,
    description: localize("commentThread.editorActions", "The contributed comment editor actions"),
    proposed: "contribCommentEditorActionsMenu"
  },
  {
    key: "comments/commentThread/title",
    id: MenuId.CommentThreadTitle,
    description: localize("commentThread.title", "The contributed comment thread title menu")
  },
  {
    key: "comments/commentThread/context",
    id: MenuId.CommentThreadActions,
    description: localize("commentThread.actions", "The contributed comment thread context menu, rendered as buttons below the comment editor"),
    supportsSubmenus: false
  },
  {
    key: "comments/commentThread/additionalActions",
    id: MenuId.CommentThreadAdditionalActions,
    description: localize("commentThread.actions", "The contributed comment thread context menu, rendered as buttons below the comment editor"),
    supportsSubmenus: true,
    proposed: "contribCommentThreadAdditionalMenu"
  },
  {
    key: "comments/commentThread/title/context",
    id: MenuId.CommentThreadTitleContext,
    description: localize("commentThread.titleContext", "The contributed comment thread title's peek context menu, rendered as a right click menu on the comment thread's peek title."),
    proposed: "contribCommentPeekContext"
  },
  {
    key: "comments/comment/title",
    id: MenuId.CommentTitle,
    description: localize("comment.title", "The contributed comment title menu")
  },
  {
    key: "comments/comment/context",
    id: MenuId.CommentActions,
    description: localize("comment.actions", "The contributed comment context menu, rendered as buttons below the comment editor"),
    supportsSubmenus: false
  },
  {
    key: "comments/commentThread/comment/context",
    id: MenuId.CommentThreadCommentContext,
    description: localize("comment.commentContext", "The contributed comment context menu, rendered as a right click menu on the an individual comment in the comment thread's peek view."),
    proposed: "contribCommentPeekContext"
  },
  {
    key: "commentsView/commentThread/context",
    id: MenuId.CommentsViewThreadActions,
    description: localize("commentsView.threadActions", "The contributed comment thread context menu in the comments view"),
    proposed: "contribCommentsViewThreadMenus"
  },
  {
    key: "notebook/toolbar",
    id: MenuId.NotebookToolbar,
    description: localize("notebook.toolbar", "The contributed notebook toolbar menu")
  },
  {
    key: "notebook/kernelSource",
    id: MenuId.NotebookKernelSource,
    description: localize("notebook.kernelSource", "The contributed notebook kernel sources menu"),
    proposed: "notebookKernelSource"
  },
  {
    key: "notebook/cell/title",
    id: MenuId.NotebookCellTitle,
    description: localize("notebook.cell.title", "The contributed notebook cell title menu")
  },
  {
    key: "notebook/cell/execute",
    id: MenuId.NotebookCellExecute,
    description: localize("notebook.cell.execute", "The contributed notebook cell execution menu")
  },
  {
    key: "interactive/toolbar",
    id: MenuId.InteractiveToolbar,
    description: localize("interactive.toolbar", "The contributed interactive toolbar menu")
  },
  {
    key: "interactive/cell/title",
    id: MenuId.InteractiveCellTitle,
    description: localize("interactive.cell.title", "The contributed interactive cell title menu")
  },
  {
    key: "issue/reporter",
    id: MenuId.IssueReporter,
    description: localize("issue.reporter", "The contributed issue reporter menu")
  },
  {
    key: "testing/item/context",
    id: MenuId.TestItem,
    description: localize("testing.item.context", "The contributed test item menu")
  },
  {
    key: "testing/item/gutter",
    id: MenuId.TestItemGutter,
    description: localize("testing.item.gutter.title", "The menu for a gutter decoration for a test item")
  },
  {
    key: "testing/profiles/context",
    id: MenuId.TestProfilesContext,
    description: localize("testing.profiles.context.title", "The menu for configuring testing profiles.")
  },
  {
    key: "testing/item/result",
    id: MenuId.TestPeekElement,
    description: localize("testing.item.result.title", "The menu for an item in the Test Results view or peek.")
  },
  {
    key: "testing/message/context",
    id: MenuId.TestMessageContext,
    description: localize("testing.message.context.title", "A prominent button overlaying editor content where the message is displayed")
  },
  {
    key: "testing/message/content",
    id: MenuId.TestMessageContent,
    description: localize("testing.message.content.title", "Context menu for the message in the results tree")
  },
  {
    key: "extension/context",
    id: MenuId.ExtensionContext,
    description: localize("menus.extensionContext", "The extension context menu")
  },
  {
    key: "timeline/title",
    id: MenuId.TimelineTitle,
    description: localize("view.timelineTitle", "The Timeline view title menu")
  },
  {
    key: "timeline/item/context",
    id: MenuId.TimelineItemContext,
    description: localize("view.timelineContext", "The Timeline view item context menu")
  },
  {
    key: "ports/item/context",
    id: MenuId.TunnelContext,
    description: localize("view.tunnelContext", "The Ports view item context menu")
  },
  {
    key: "ports/item/origin/inline",
    id: MenuId.TunnelOriginInline,
    description: localize("view.tunnelOriginInline", "The Ports view item origin inline menu")
  },
  {
    key: "ports/item/port/inline",
    id: MenuId.TunnelPortInline,
    description: localize("view.tunnelPortInline", "The Ports view item port inline menu")
  },
  {
    key: "file/newFile",
    id: MenuId.NewFile,
    description: localize("file.newFile", "The 'New File...' quick pick, shown on welcome page and File menu."),
    supportsSubmenus: false
  },
  {
    key: "webview/context",
    id: MenuId.WebviewContext,
    description: localize("webview.context", "The webview context menu")
  },
  {
    key: "file/share",
    id: MenuId.MenubarShare,
    description: localize("menus.share", "Share submenu shown in the top level File menu."),
    proposed: "contribShareMenu"
  },
  {
    key: "editor/inlineCompletions/actions",
    id: MenuId.InlineCompletionsActions,
    description: localize("inlineCompletions.actions", "The actions shown when hovering on an inline completion"),
    supportsSubmenus: false,
    proposed: "inlineCompletionsAdditions"
  },
  {
    key: "editor/content",
    id: MenuId.EditorContent,
    description: localize("merge.toolbar", "The prominent button in an editor, overlays its content"),
    proposed: "contribEditorContentMenu"
  },
  {
    key: "editor/lineNumber/context",
    id: MenuId.EditorLineNumberContext,
    description: localize("editorLineNumberContext", "The contributed editor line number context menu")
  },
  {
    key: "mergeEditor/result/title",
    id: MenuId.MergeInputResultToolbar,
    description: localize("menus.mergeEditorResult", "The result toolbar of the merge editor"),
    proposed: "contribMergeEditorMenus"
  },
  {
    key: "multiDiffEditor/resource/title",
    id: MenuId.MultiDiffEditorFileToolbar,
    description: localize("menus.multiDiffEditorResource", "The resource toolbar in the multi diff editor"),
    proposed: "contribMultiDiffEditorMenus"
  },
  {
    key: "diffEditor/gutter/hunk",
    id: MenuId.DiffEditorHunkToolbar,
    description: localize("menus.diffEditorGutterToolBarMenus", "The gutter toolbar in the diff editor"),
    proposed: "contribDiffEditorGutterToolBarMenus"
  },
  {
    key: "diffEditor/gutter/selection",
    id: MenuId.DiffEditorSelectionToolbar,
    description: localize("menus.diffEditorGutterToolBarMenus", "The gutter toolbar in the diff editor"),
    proposed: "contribDiffEditorGutterToolBarMenus"
  },
  {
    key: "searchPanel/aiResults/commands",
    id: MenuId.SearchActionMenu,
    description: localize("searchPanel.aiResultsCommands", "The commands that will contribute to the menu rendered as buttons next to the AI search title")
  },
  {
    key: "chat/modelPicker",
    id: MenuId.ChatModelPicker,
    description: localize("menus.chatModelPicker", "The chat model picker dropdown menu"),
    supportsSubmenus: false,
    proposed: "chatParticipantPrivate"
  }
];
var schema;
((schema2) => {
  function isMenuItem(item) {
    return typeof item.command === "string";
  }
  schema2.isMenuItem = isMenuItem;
  function isValidMenuItem(item, collector) {
    if (typeof item.command !== "string") {
      collector.error(localize("requirestring", "property `{0}` is mandatory and must be of type `string`", "command"));
      return false;
    }
    if (item.alt && typeof item.alt !== "string") {
      collector.error(localize("optstring", "property `{0}` can be omitted or must be of type `string`", "alt"));
      return false;
    }
    if (item.when && typeof item.when !== "string") {
      collector.error(localize("optstring", "property `{0}` can be omitted or must be of type `string`", "when"));
      return false;
    }
    if (item.group && typeof item.group !== "string") {
      collector.error(localize("optstring", "property `{0}` can be omitted or must be of type `string`", "group"));
      return false;
    }
    return true;
  }
  schema2.isValidMenuItem = isValidMenuItem;
  function isValidSubmenuItem(item, collector) {
    if (typeof item.submenu !== "string") {
      collector.error(localize("requirestring", "property `{0}` is mandatory and must be of type `string`", "submenu"));
      return false;
    }
    if (item.when && typeof item.when !== "string") {
      collector.error(localize("optstring", "property `{0}` can be omitted or must be of type `string`", "when"));
      return false;
    }
    if (item.group && typeof item.group !== "string") {
      collector.error(localize("optstring", "property `{0}` can be omitted or must be of type `string`", "group"));
      return false;
    }
    return true;
  }
  schema2.isValidSubmenuItem = isValidSubmenuItem;
  function isValidItems(items, collector) {
    if (!Array.isArray(items)) {
      collector.error(localize("requirearray", "submenu items must be an array"));
      return false;
    }
    for (const item of items) {
      if (isMenuItem(item)) {
        if (!isValidMenuItem(item, collector)) {
          return false;
        }
      } else {
        if (!isValidSubmenuItem(item, collector)) {
          return false;
        }
      }
    }
    return true;
  }
  schema2.isValidItems = isValidItems;
  function isValidSubmenu(submenu2, collector) {
    if (typeof submenu2 !== "object") {
      collector.error(localize("require", "submenu items must be an object"));
      return false;
    }
    if (typeof submenu2.id !== "string") {
      collector.error(localize("requirestring", "property `{0}` is mandatory and must be of type `string`", "id"));
      return false;
    }
    if (typeof submenu2.label !== "string") {
      collector.error(localize("requirestring", "property `{0}` is mandatory and must be of type `string`", "label"));
      return false;
    }
    return true;
  }
  schema2.isValidSubmenu = isValidSubmenu;
  const menuItem = {
    type: "object",
    required: ["command"],
    properties: {
      command: {
        description: localize("vscode.extension.contributes.menuItem.command", "Identifier of the command to execute. The command must be declared in the 'commands'-section"),
        type: "string"
      },
      alt: {
        description: localize("vscode.extension.contributes.menuItem.alt", "Identifier of an alternative command to execute. The command must be declared in the 'commands'-section"),
        type: "string"
      },
      when: {
        description: localize("vscode.extension.contributes.menuItem.when", "Condition which must be true to show this item"),
        type: "string"
      },
      group: {
        description: localize("vscode.extension.contributes.menuItem.group", "Group into which this item belongs"),
        type: "string"
      }
    }
  };
  const submenuItem = {
    type: "object",
    required: ["submenu"],
    properties: {
      submenu: {
        description: localize("vscode.extension.contributes.menuItem.submenu", "Identifier of the submenu to display in this item."),
        type: "string"
      },
      when: {
        description: localize("vscode.extension.contributes.menuItem.when", "Condition which must be true to show this item"),
        type: "string"
      },
      group: {
        description: localize("vscode.extension.contributes.menuItem.group", "Group into which this item belongs"),
        type: "string"
      }
    }
  };
  const submenu = {
    type: "object",
    required: ["id", "label"],
    properties: {
      id: {
        description: localize("vscode.extension.contributes.submenu.id", "Identifier of the menu to display as a submenu."),
        type: "string"
      },
      label: {
        description: localize("vscode.extension.contributes.submenu.label", "The label of the menu item which leads to this submenu."),
        type: "string"
      },
      icon: {
        description: localize({ key: "vscode.extension.contributes.submenu.icon", comment: ["do not translate or change `\\$(zap)`, \\ in front of $ is important."] }, "(Optional) Icon which is used to represent the submenu in the UI. Either a file path, an object with file paths for dark and light themes, or a theme icon references, like `\\$(zap)`"),
        anyOf: [
          {
            type: "string"
          },
          {
            type: "object",
            properties: {
              light: {
                description: localize("vscode.extension.contributes.submenu.icon.light", "Icon path when a light theme is used"),
                type: "string"
              },
              dark: {
                description: localize("vscode.extension.contributes.submenu.icon.dark", "Icon path when a dark theme is used"),
                type: "string"
              }
            }
          }
        ]
      }
    }
  };
  schema2.menusContribution = {
    description: localize("vscode.extension.contributes.menus", "Contributes menu items to the editor"),
    type: "object",
    properties: index(apiMenus, (menu) => menu.key, (menu) => ({
      markdownDescription: menu.proposed ? localize("proposed", 'Proposed API, requires `enabledApiProposal: ["{0}"]` - {1}', menu.proposed, menu.description) : menu.description,
      type: "array",
      items: menu.supportsSubmenus === false ? menuItem : { oneOf: [menuItem, submenuItem] }
    })),
    additionalProperties: {
      description: "Submenu",
      type: "array",
      items: { oneOf: [menuItem, submenuItem] }
    }
  };
  schema2.submenusContribution = {
    description: localize("vscode.extension.contributes.submenus", "Contributes submenu items to the editor"),
    type: "array",
    items: submenu
  };
  function isValidCommand(command, collector) {
    if (!command) {
      collector.error(localize("nonempty", "expected non-empty value."));
      return false;
    }
    if (isFalsyOrWhitespace(command.command)) {
      collector.error(localize("requirestring", "property `{0}` is mandatory and must be of type `string`", "command"));
      return false;
    }
    if (!isValidLocalizedString(command.title, collector, "title")) {
      return false;
    }
    if (command.shortTitle && !isValidLocalizedString(command.shortTitle, collector, "shortTitle")) {
      return false;
    }
    if (command.enablement && typeof command.enablement !== "string") {
      collector.error(localize("optstring", "property `{0}` can be omitted or must be of type `string`", "precondition"));
      return false;
    }
    if (command.category && !isValidLocalizedString(command.category, collector, "category")) {
      return false;
    }
    if (!isValidIcon(command.icon, collector)) {
      return false;
    }
    return true;
  }
  schema2.isValidCommand = isValidCommand;
  function isValidIcon(icon, collector) {
    if (typeof icon === "undefined") {
      return true;
    }
    if (typeof icon === "string") {
      return true;
    } else if (typeof icon.dark === "string" && typeof icon.light === "string") {
      return true;
    }
    collector.error(localize("opticon", "property `icon` can be omitted or must be either a string or a literal like `{dark, light}`"));
    return false;
  }
  function isValidLocalizedString(localized, collector, propertyName) {
    if (typeof localized === "undefined") {
      collector.error(localize("requireStringOrObject", "property `{0}` is mandatory and must be of type `string` or `object`", propertyName));
      return false;
    } else if (typeof localized === "string" && isFalsyOrWhitespace(localized)) {
      collector.error(localize("requirestring", "property `{0}` is mandatory and must be of type `string`", propertyName));
      return false;
    } else if (typeof localized !== "string" && (isFalsyOrWhitespace(localized.original) || isFalsyOrWhitespace(localized.value))) {
      collector.error(localize("requirestrings", "properties `{0}` and `{1}` are mandatory and must be of type `string`", `${propertyName}.value`, `${propertyName}.original`));
      return false;
    }
    return true;
  }
  const commandType = {
    type: "object",
    required: ["command", "title"],
    properties: {
      command: {
        description: localize("vscode.extension.contributes.commandType.command", "Identifier of the command to execute"),
        type: "string"
      },
      title: {
        description: localize("vscode.extension.contributes.commandType.title", "Title by which the command is represented in the UI"),
        type: "string"
      },
      shortTitle: {
        markdownDescription: localize("vscode.extension.contributes.commandType.shortTitle", "(Optional) Short title by which the command is represented in the UI. Menus pick either `title` or `shortTitle` depending on the context in which they show commands."),
        type: "string"
      },
      category: {
        description: localize("vscode.extension.contributes.commandType.category", "(Optional) Category string by which the command is grouped in the UI"),
        type: "string"
      },
      enablement: {
        description: localize("vscode.extension.contributes.commandType.precondition", "(Optional) Condition which must be true to enable the command in the UI (menu and keybindings). Does not prevent executing the command by other means, like the `executeCommand`-api."),
        type: "string"
      },
      icon: {
        description: localize({ key: "vscode.extension.contributes.commandType.icon", comment: ["do not translate or change `\\$(zap)`, \\ in front of $ is important."] }, "(Optional) Icon which is used to represent the command in the UI. Either a file path, an object with file paths for dark and light themes, or a theme icon references, like `\\$(zap)`"),
        anyOf: [
          {
            type: "string"
          },
          {
            type: "object",
            properties: {
              light: {
                description: localize("vscode.extension.contributes.commandType.icon.light", "Icon path when a light theme is used"),
                type: "string"
              },
              dark: {
                description: localize("vscode.extension.contributes.commandType.icon.dark", "Icon path when a dark theme is used"),
                type: "string"
              }
            }
          }
        ]
      }
    }
  };
  schema2.commandsContribution = {
    description: localize("vscode.extension.contributes.commands", "Contributes commands to the command palette."),
    oneOf: [
      commandType,
      {
        type: "array",
        items: commandType
      }
    ]
  };
})(schema || (schema = {}));
const _commandRegistrations = new DisposableStore();
const commandsExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "commands",
  jsonSchema: schema.commandsContribution,
  activationEventsGenerator: (contribs, result) => {
    for (const contrib of contribs) {
      if (contrib.command) {
        result.push(`onCommand:${contrib.command}`);
      }
    }
  }
});
commandsExtensionPoint.setHandler((extensions) => {
  function handleCommand(userFriendlyCommand, extension) {
    if (!schema.isValidCommand(userFriendlyCommand, extension.collector)) {
      return;
    }
    const { icon, enablement, category, title, shortTitle, command } = userFriendlyCommand;
    let absoluteIcon;
    if (icon) {
      if (typeof icon === "string") {
        absoluteIcon = ThemeIcon.fromString(icon) ?? { dark: resources.joinPath(extension.description.extensionLocation, icon), light: resources.joinPath(extension.description.extensionLocation, icon) };
      } else {
        absoluteIcon = {
          dark: resources.joinPath(extension.description.extensionLocation, icon.dark),
          light: resources.joinPath(extension.description.extensionLocation, icon.light)
        };
      }
    }
    const existingCmd = MenuRegistry.getCommand(command);
    if (existingCmd) {
      if (existingCmd.source) {
        extension.collector.info(localize("dup1", "Command `{0}` already registered by {1} ({2})", userFriendlyCommand.command, existingCmd.source.title, existingCmd.source.id));
      } else {
        extension.collector.info(localize("dup0", "Command `{0}` already registered", userFriendlyCommand.command));
      }
    }
    _commandRegistrations.add(MenuRegistry.addCommand({
      id: command,
      title,
      source: { id: extension.description.identifier.value, title: extension.description.displayName ?? extension.description.name },
      shortTitle,
      tooltip: title,
      category,
      precondition: ContextKeyExpr.deserialize(enablement),
      icon: absoluteIcon
    }));
  }
  _commandRegistrations.clear();
  for (const extension of extensions) {
    const { value } = extension;
    if (Array.isArray(value)) {
      for (const command of value) {
        handleCommand(command, extension);
      }
    } else {
      handleCommand(value, extension);
    }
  }
});
const _submenus = /* @__PURE__ */ new Map();
const submenusExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "submenus",
  jsonSchema: schema.submenusContribution
});
submenusExtensionPoint.setHandler((extensions) => {
  _submenus.clear();
  for (const extension of extensions) {
    const { value, collector } = extension;
    for (const [, submenuInfo] of Object.entries(value)) {
      if (!schema.isValidSubmenu(submenuInfo, collector)) {
        continue;
      }
      if (!submenuInfo.id) {
        collector.warn(localize("submenuId.invalid.id", "`{0}` is not a valid submenu identifier", submenuInfo.id));
        continue;
      }
      if (_submenus.has(submenuInfo.id)) {
        collector.info(localize("submenuId.duplicate.id", "The `{0}` submenu was already previously registered.", submenuInfo.id));
        continue;
      }
      if (!submenuInfo.label) {
        collector.warn(localize("submenuId.invalid.label", "`{0}` is not a valid submenu label", submenuInfo.label));
        continue;
      }
      let absoluteIcon;
      if (submenuInfo.icon) {
        if (typeof submenuInfo.icon === "string") {
          absoluteIcon = ThemeIcon.fromString(submenuInfo.icon) || { dark: resources.joinPath(extension.description.extensionLocation, submenuInfo.icon) };
        } else {
          absoluteIcon = {
            dark: resources.joinPath(extension.description.extensionLocation, submenuInfo.icon.dark),
            light: resources.joinPath(extension.description.extensionLocation, submenuInfo.icon.light)
          };
        }
      }
      const item = {
        id: MenuId.for(`api:${submenuInfo.id}`),
        label: submenuInfo.label,
        icon: absoluteIcon
      };
      _submenus.set(submenuInfo.id, item);
    }
  }
});
const _apiMenusByKey = new Map(apiMenus.map((menu) => [menu.key, menu]));
const _menuRegistrations = new DisposableStore();
const _submenuMenuItems = /* @__PURE__ */ new Map();
const menusExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "menus",
  jsonSchema: schema.menusContribution,
  deps: [submenusExtensionPoint]
});
menusExtensionPoint.setHandler((extensions) => {
  _menuRegistrations.clear();
  _submenuMenuItems.clear();
  for (const extension of extensions) {
    const { value, collector } = extension;
    for (const entry of Object.entries(value)) {
      if (!schema.isValidItems(entry[1], collector)) {
        continue;
      }
      let menu = _apiMenusByKey.get(entry[0]);
      if (!menu) {
        const submenu = _submenus.get(entry[0]);
        if (submenu) {
          menu = {
            key: entry[0],
            id: submenu.id,
            description: ""
          };
        }
      }
      if (!menu) {
        continue;
      }
      if (menu.proposed && !isProposedApiEnabled(extension.description, menu.proposed)) {
        collector.error(localize("proposedAPI.invalid", `{0} is a proposed menu identifier. It requires 'package.json#enabledApiProposals: ["{1}"]' and is only available when running out of dev or with the following command line switch: --enable-proposed-api {2}`, entry[0], menu.proposed, extension.description.identifier.value));
        continue;
      }
      for (const menuItem of entry[1]) {
        let item;
        if (schema.isMenuItem(menuItem)) {
          const command = MenuRegistry.getCommand(menuItem.command);
          const alt = menuItem.alt && MenuRegistry.getCommand(menuItem.alt) || void 0;
          if (!command) {
            collector.error(localize("missing.command", "Menu item references a command `{0}` which is not defined in the 'commands' section.", menuItem.command));
            continue;
          }
          if (menuItem.alt && !alt) {
            collector.warn(localize("missing.altCommand", "Menu item references an alt-command `{0}` which is not defined in the 'commands' section.", menuItem.alt));
          }
          if (menuItem.command === menuItem.alt) {
            collector.info(localize("dupe.command", "Menu item references the same command as default and alt-command"));
          }
          item = { command, alt, group: void 0, order: void 0, when: void 0 };
        } else {
          if (menu.supportsSubmenus === false) {
            collector.error(localize("unsupported.submenureference", "Menu item references a submenu for a menu which doesn't have submenu support."));
            continue;
          }
          const submenu = _submenus.get(menuItem.submenu);
          if (!submenu) {
            collector.error(localize("missing.submenu", "Menu item references a submenu `{0}` which is not defined in the 'submenus' section.", menuItem.submenu));
            continue;
          }
          let submenuRegistrations = _submenuMenuItems.get(menu.id.id);
          if (!submenuRegistrations) {
            submenuRegistrations = /* @__PURE__ */ new Set();
            _submenuMenuItems.set(menu.id.id, submenuRegistrations);
          }
          if (submenuRegistrations.has(submenu.id.id)) {
            collector.warn(localize("submenuItem.duplicate", "The `{0}` submenu was already contributed to the `{1}` menu.", menuItem.submenu, entry[0]));
            continue;
          }
          submenuRegistrations.add(submenu.id.id);
          item = { submenu: submenu.id, icon: submenu.icon, title: submenu.label, group: void 0, order: void 0, when: void 0 };
        }
        if (menuItem.group) {
          const idx = menuItem.group.lastIndexOf("@");
          if (idx > 0) {
            item.group = menuItem.group.substr(0, idx);
            item.order = Number(menuItem.group.substr(idx + 1)) || void 0;
          } else {
            item.group = menuItem.group;
          }
        }
        if (menu.id === MenuId.ViewContainerTitle && !menuItem.when?.includes("viewContainer == workbench.view.debug")) {
          collector.error(localize("viewContainerTitle.when", "The {0} menu contribution must check {1} in its {2} clause.", "`viewContainer/title`", "`viewContainer == workbench.view.debug`", '"when"'));
          continue;
        }
        item.when = ContextKeyExpr.deserialize(menuItem.when);
        _menuRegistrations.add(MenuRegistry.appendMenuItem(menu.id, item));
      }
    }
  }
});
let CommandsTableRenderer = class extends Disposable {
  constructor(_keybindingService) {
    super();
    this._keybindingService = _keybindingService;
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.commands;
  }
  render(manifest) {
    const rawCommands = manifest.contributes?.commands || [];
    const commands = rawCommands.map((c) => ({
      id: c.command,
      title: c.title,
      keybindings: [],
      menus: []
    }));
    const byId = index(commands, (c) => c.id);
    const menus = manifest.contributes?.menus || {};
    const implicitlyOnCommandPalette = index(commands, (c) => c.id);
    if (menus["commandPalette"]) {
      for (const command of menus["commandPalette"]) {
        delete implicitlyOnCommandPalette[command.command];
      }
    }
    if (Object.keys(implicitlyOnCommandPalette).length) {
      if (!menus["commandPalette"]) {
        menus["commandPalette"] = [];
      }
      for (const command in implicitlyOnCommandPalette) {
        menus["commandPalette"].push({ command });
      }
    }
    for (const context in menus) {
      for (const menu of menus[context]) {
        if (menu.when === "false") {
          continue;
        }
        if (menu.command) {
          let command = byId[menu.command];
          if (command) {
            if (!command.menus.includes(context)) {
              command.menus.push(context);
            }
          } else {
            command = { id: menu.command, title: "", keybindings: [], menus: [context] };
            byId[command.id] = command;
            commands.push(command);
          }
        }
      }
    }
    const rawKeybindings = manifest.contributes?.keybindings ? Array.isArray(manifest.contributes.keybindings) ? manifest.contributes.keybindings : [manifest.contributes.keybindings] : [];
    rawKeybindings.forEach((rawKeybinding) => {
      const keybinding = this.resolveKeybinding(rawKeybinding);
      if (!keybinding) {
        return;
      }
      let command = byId[rawKeybinding.command];
      if (command) {
        command.keybindings.push(keybinding);
      } else {
        command = { id: rawKeybinding.command, title: "", keybindings: [keybinding], menus: [] };
        byId[command.id] = command;
        commands.push(command);
      }
    });
    if (!commands.length) {
      return { data: { headers: [], rows: [] }, dispose: () => {
      } };
    }
    const headers = [
      localize("command name", "ID"),
      localize("command title", "Title"),
      localize("keyboard shortcuts", "Keyboard Shortcuts"),
      localize("menuContexts", "Menu Contexts")
    ];
    const rows = commands.sort((a, b) => a.id.localeCompare(b.id)).map((command) => {
      return [
        new MarkdownString().appendMarkdown(`\`${command.id}\``),
        typeof command.title === "string" ? command.title : command.title.value,
        command.keybindings,
        new MarkdownString().appendMarkdown(`${command.menus.sort((a, b) => a.localeCompare(b)).map((menu) => `\`${menu}\``).join("&nbsp;")}`)
      ];
    });
    return {
      data: {
        headers,
        rows
      },
      dispose: () => {
      }
    };
  }
  resolveKeybinding(rawKeyBinding) {
    let key;
    switch (platform) {
      case "win32":
        key = rawKeyBinding.win;
        break;
      case "linux":
        key = rawKeyBinding.linux;
        break;
      case "darwin":
        key = rawKeyBinding.mac;
        break;
    }
    return this._keybindingService.resolveUserBinding(key ?? rawKeyBinding.key)[0];
  }
};
CommandsTableRenderer = __decorateClass([
  __decorateParam(0, IKeybindingService)
], CommandsTableRenderer);
Registry.as(ExtensionFeaturesExtensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "commands",
  label: localize("commands", "Commands"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(CommandsTableRenderer)
});
export {
  commandsExtensionPoint
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvYWN0aW9ucy9jb21tb24vbWVudXNFeHRlbnNpb25Qb2ludC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGlzRmFsc3lPcldoaXRlc3BhY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCAqIGFzIHJlc291cmNlcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSUpTT05TY2hlbWEgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uU2NoZW1hLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25Qb2ludFVzZXIsIEV4dGVuc2lvbk1lc3NhZ2VDb2xsZWN0b3IsIEV4dGVuc2lvbnNSZWdpc3RyeSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgTWVudUlkLCBNZW51UmVnaXN0cnksIElNZW51SXRlbSwgSVN1Ym1lbnVJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBpbmRleCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBpc1Byb3Bvc2VkQXBpRW5hYmxlZCB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUxvY2FsaXplZFN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25GZWF0dXJlVGFibGVSZW5kZXJlciwgSUV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnksIElSZW5kZXJlZERhdGEsIElSb3dEYXRhLCBJVGFibGVEYXRhLCBFeHRlbnNpb25zIGFzIEV4dGVuc2lvbkZlYXR1cmVzRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbkZlYXR1cmVzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25NYW5pZmVzdCwgSUtleUJpbmRpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wcm9jZXNzLmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgUmVzb2x2ZWRLZXliaW5kaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5YmluZGluZ3MuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBBcGlQcm9wb3NhbE5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zQXBpUHJvcG9zYWxzLmpzJztcblxuaW50ZXJmYWNlIElBUElNZW51IHtcblx0cmVhZG9ubHkga2V5OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGlkOiBNZW51SWQ7XG5cdHJlYWRvbmx5IGRlc2NyaXB0aW9uOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHByb3Bvc2VkPzogQXBpUHJvcG9zYWxOYW1lO1xuXHRyZWFkb25seSBzdXBwb3J0c1N1Ym1lbnVzPzogYm9vbGVhbjsgLy8gZGVmYXVsdHMgdG8gdHJ1ZVxufVxuXG5jb25zdCBhcGlNZW51czogSUFQSU1lbnVbXSA9IFtcblx0e1xuXHRcdGtleTogJ2NvbW1hbmRQYWxldHRlJyxcblx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWVudXMuY29tbWFuZFBhbGV0dGUnLCBcIlRoZSBDb21tYW5kIFBhbGV0dGVcIiksXG5cdFx0c3VwcG9ydHNTdWJtZW51czogZmFsc2Vcblx0fSxcblx0e1xuXHRcdGtleTogJ3RvdWNoQmFyJyxcblx0XHRpZDogTWVudUlkLlRvdWNoQmFyQ29udGV4dCxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21lbnVzLnRvdWNoQmFyJywgXCJUaGUgdG91Y2ggYmFyIChtYWNPUyBvbmx5KVwiKSxcblx0XHRzdXBwb3J0c1N1Ym1lbnVzOiBmYWxzZVxuXHR9LFxuXHR7XG5cdFx0a2V5OiAnZWRpdG9yL3RpdGxlJyxcblx0XHRpZDogTWVudUlkLkVkaXRvclRpdGxlLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWVudXMuZWRpdG9yVGl0bGUnLCBcIlRoZSBlZGl0b3IgdGl0bGUgbWVudVwiKVxuXHR9LFxuXHR7XG5cdFx0a2V5OiAnZWRpdG9yL3RpdGxlL3J1bicsXG5cdFx0aWQ6IE1lbnVJZC5FZGl0b3JUaXRsZVJ1bixcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21lbnVzLmVkaXRvclRpdGxlUnVuJywgXCJSdW4gc3VibWVudSBpbnNpZGUgdGhlIGVkaXRvciB0aXRsZSBtZW51XCIpXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdlZGl0b3IvY29udGV4dCcsXG5cdFx0aWQ6IE1lbnVJZC5FZGl0b3JDb250ZXh0LFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWVudXMuZWRpdG9yQ29udGV4dCcsIFwiVGhlIGVkaXRvciBjb250ZXh0IG1lbnVcIilcblx0fSxcblx0e1xuXHRcdGtleTogJ2VkaXRvci9jb250ZXh0L2NvcHknLFxuXHRcdGlkOiBNZW51SWQuRWRpdG9yQ29udGV4dENvcHksXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdtZW51cy5lZGl0b3JDb250ZXh0Q29weUFzJywgXCInQ29weSBhcycgc3VibWVudSBpbiB0aGUgZWRpdG9yIGNvbnRleHQgbWVudVwiKVxuXHR9LFxuXHR7XG5cdFx0a2V5OiAnZWRpdG9yL2NvbnRleHQvc2hhcmUnLFxuXHRcdGlkOiBNZW51SWQuRWRpdG9yQ29udGV4dFNoYXJlLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWVudXMuZWRpdG9yQ29udGV4dFNoYXJlJywgXCInU2hhcmUnIHN1Ym1lbnUgaW4gdGhlIGVkaXRvciBjb250ZXh0IG1lbnVcIiksXG5cdFx0cHJvcG9zZWQ6ICdjb250cmliU2hhcmVNZW51J1xuXHR9LFxuXHR7XG5cdFx0a2V5OiAnZXhwbG9yZXIvY29udGV4dCcsXG5cdFx0aWQ6IE1lbnVJZC5FeHBsb3JlckNvbnRleHQsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdtZW51cy5leHBsb3JlckNvbnRleHQnLCBcIlRoZSBmaWxlIGV4cGxvcmVyIGNvbnRleHQgbWVudVwiKVxuXHR9LFxuXHR7XG5cdFx0a2V5OiAnZXhwbG9yZXIvY29udGV4dC9zaGFyZScsXG5cdFx0aWQ6IE1lbnVJZC5FeHBsb3JlckNvbnRleHRTaGFyZSxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21lbnVzLmV4cGxvcmVyQ29udGV4dFNoYXJlJywgXCInU2hhcmUnIHN1Ym1lbnUgaW4gdGhlIGZpbGUgZXhwbG9yZXIgY29udGV4dCBtZW51XCIpLFxuXHRcdHByb3Bvc2VkOiAnY29udHJpYlNoYXJlTWVudSdcblx0fSxcblx0e1xuXHRcdGtleTogJ2VkaXRvci90aXRsZS9jb250ZXh0Jyxcblx0XHRpZDogTWVudUlkLkVkaXRvclRpdGxlQ29udGV4dCxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21lbnVzLmVkaXRvclRhYkNvbnRleHQnLCBcIlRoZSBlZGl0b3IgdGFicyBjb250ZXh0IG1lbnVcIilcblx0fSxcblx0e1xuXHRcdGtleTogJ2VkaXRvci90aXRsZS9jb250ZXh0L3NoYXJlJyxcblx0XHRpZDogTWVudUlkLkVkaXRvclRpdGxlQ29udGV4dFNoYXJlLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWVudXMuZWRpdG9yVGl0bGVDb250ZXh0U2hhcmUnLCBcIidTaGFyZScgc3VibWVudSBpbnNpZGUgdGhlIGVkaXRvciB0aXRsZSBjb250ZXh0IG1lbnVcIiksXG5cdFx0cHJvcG9zZWQ6ICdjb250cmliU2hhcmVNZW51J1xuXHR9LFxuXHR7XG5cdFx0a2V5OiAnZGVidWcvY2FsbHN0YWNrL2NvbnRleHQnLFxuXHRcdGlkOiBNZW51SWQuRGVidWdDYWxsU3RhY2tDb250ZXh0LFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWVudXMuZGVidWdDYWxsc3RhY2tDb250ZXh0JywgXCJUaGUgZGVidWcgY2FsbHN0YWNrIHZpZXcgY29udGV4dCBtZW51XCIpXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdkZWJ1Zy92YXJpYWJsZXMvY29udGV4dCcsXG5cdFx0aWQ6IE1lbnVJZC5EZWJ1Z1ZhcmlhYmxlc0NvbnRleHQsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdtZW51cy5kZWJ1Z1ZhcmlhYmxlc0NvbnRleHQnLCBcIlRoZSBkZWJ1ZyB2YXJpYWJsZXMgdmlldyBjb250ZXh0IG1lbnVcIilcblx0fSxcblx0e1xuXHRcdGtleTogJ2RlYnVnL3Rvb2xCYXInLFxuXHRcdGlkOiBNZW51SWQuRGVidWdUb29sQmFyLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWVudXMuZGVidWdUb29sQmFyJywgXCJUaGUgZGVidWcgdG9vbGJhciBtZW51XCIpXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdkZWJ1Zy9jcmVhdGVDb25maWd1cmF0aW9uJyxcblx0XHRpZDogTWVudUlkLkRlYnVnQ3JlYXRlQ29uZmlndXJhdGlvbixcblx0XHRwcm9wb3NlZDogJ2NvbnRyaWJEZWJ1Z0NyZWF0ZUNvbmZpZ3VyYXRpb24nLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWVudXMuZGVidWdDcmVhdGVDb25maWd1YXRpb24nLCBcIlRoZSBkZWJ1ZyBjcmVhdGUgY29uZmlndXJhdGlvbiBtZW51XCIpXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdub3RlYm9vay92YXJpYWJsZXMvY29udGV4dCcsXG5cdFx0aWQ6IE1lbnVJZC5Ob3RlYm9va1ZhcmlhYmxlc0NvbnRleHQsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdtZW51cy5ub3RlYm9va1ZhcmlhYmxlc0NvbnRleHQnLCBcIlRoZSBub3RlYm9vayB2YXJpYWJsZXMgdmlldyBjb250ZXh0IG1lbnVcIilcblx0fSxcblx0e1xuXHRcdGtleTogJ21lbnVCYXIvaG9tZScsXG5cdFx0aWQ6IE1lbnVJZC5NZW51YmFySG9tZU1lbnUsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdtZW51cy5ob21lJywgXCJUaGUgaG9tZSBpbmRpY2F0b3IgY29udGV4dCBtZW51ICh3ZWIgb25seSlcIiksXG5cdFx0cHJvcG9zZWQ6ICdjb250cmliTWVudUJhckhvbWUnLFxuXHRcdHN1cHBvcnRzU3VibWVudXM6IGZhbHNlXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdtZW51QmFyL2VkaXQvY29weScsXG5cdFx0aWQ6IE1lbnVJZC5NZW51YmFyQ29weSxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21lbnVzLm9weScsIFwiJ0NvcHkgYXMnIHN1Ym1lbnUgaW4gdGhlIHRvcCBsZXZlbCBFZGl0IG1lbnVcIilcblx0fSxcblx0e1xuXHRcdGtleTogJ3NjbS90aXRsZScsXG5cdFx0aWQ6IE1lbnVJZC5TQ01UaXRsZSxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21lbnVzLnNjbVRpdGxlJywgXCJUaGUgU291cmNlIENvbnRyb2wgdGl0bGUgbWVudVwiKVxuXHR9LFxuXHR7XG5cdFx0a2V5OiAnc2NtL3NvdXJjZUNvbnRyb2wnLFxuXHRcdGlkOiBNZW51SWQuU0NNU291cmNlQ29udHJvbCxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21lbnVzLnNjbVNvdXJjZUNvbnRyb2wnLCBcIlRoZSBTb3VyY2UgQ29udHJvbCBtZW51XCIpXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdzY20vc291cmNlQ29udHJvbC90aXRsZScsXG5cdFx0aWQ6IE1lbnVJZC5TQ01Tb3VyY2VDb250cm9sVGl0bGUsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdtZW51cy5zY21Tb3VyY2VDb250cm9sVGl0bGUnLCBcIlRoZSBTb3VyY2UgQ29udHJvbCB0aXRsZSBtZW51XCIpLFxuXHRcdHByb3Bvc2VkOiAnY29udHJpYlNvdXJjZUNvbnRyb2xUaXRsZU1lbnUnXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdzY20vcmVzb3VyY2VTdGF0ZS9jb250ZXh0Jyxcblx0XHRpZDogTWVudUlkLlNDTVJlc291cmNlQ29udGV4dCxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21lbnVzLnJlc291cmNlU3RhdGVDb250ZXh0JywgXCJUaGUgU291cmNlIENvbnRyb2wgcmVzb3VyY2Ugc3RhdGUgY29udGV4dCBtZW51XCIpXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdzY20vcmVzb3VyY2VGb2xkZXIvY29udGV4dCcsXG5cdFx0aWQ6IE1lbnVJZC5TQ01SZXNvdXJjZUZvbGRlckNvbnRleHQsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdtZW51cy5yZXNvdXJjZUZvbGRlckNvbnRleHQnLCBcIlRoZSBTb3VyY2UgQ29udHJvbCByZXNvdXJjZSBmb2xkZXIgY29udGV4dCBtZW51XCIpXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdzY20vcmVzb3VyY2VHcm91cC9jb250ZXh0Jyxcblx0XHRpZDogTWVudUlkLlNDTVJlc291cmNlR3JvdXBDb250ZXh0LFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWVudXMucmVzb3VyY2VHcm91cENvbnRleHQnLCBcIlRoZSBTb3VyY2UgQ29udHJvbCByZXNvdXJjZSBncm91cCBjb250ZXh0IG1lbnVcIilcblx0fSxcblx0e1xuXHRcdGtleTogJ3NjbS9jaGFuZ2UvdGl0bGUnLFxuXHRcdGlkOiBNZW51SWQuU0NNQ2hhbmdlQ29udGV4dCxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21lbnVzLmNoYW5nZVRpdGxlJywgXCJUaGUgU291cmNlIENvbnRyb2wgaW5saW5lIGNoYW5nZSBtZW51XCIpXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdzY20vaW5wdXRCb3gnLFxuXHRcdGlkOiBNZW51SWQuU0NNSW5wdXRCb3gsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdtZW51cy5pbnB1dCcsIFwiVGhlIFNvdXJjZSBDb250cm9sIGlucHV0IGJveCBtZW51XCIpLFxuXHRcdHByb3Bvc2VkOiAnY29udHJpYlNvdXJjZUNvbnRyb2xJbnB1dEJveE1lbnUnXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdzY20vaGlzdG9yeS90aXRsZScsXG5cdFx0aWQ6IE1lbnVJZC5TQ01IaXN0b3J5VGl0bGUsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdtZW51cy5zY21IaXN0b3J5VGl0bGUnLCBcIlRoZSBTb3VyY2UgQ29udHJvbCBIaXN0b3J5IHRpdGxlIG1lbnVcIiksXG5cdFx0cHJvcG9zZWQ6ICdjb250cmliU291cmNlQ29udHJvbEhpc3RvcnlUaXRsZU1lbnUnXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdzY20vaGlzdG9yeUl0ZW0vY29udGV4dCcsXG5cdFx0aWQ6IE1lbnVJZC5TQ01IaXN0b3J5SXRlbUNvbnRleHQsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdtZW51cy5oaXN0b3J5SXRlbUNvbnRleHQnLCBcIlRoZSBTb3VyY2UgQ29udHJvbCBoaXN0b3J5IGl0ZW0gY29udGV4dCBtZW51XCIpLFxuXHRcdHByb3Bvc2VkOiAnY29udHJpYlNvdXJjZUNvbnRyb2xIaXN0b3J5SXRlbU1lbnUnXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdzY20vaGlzdG9yeUl0ZW0vaG92ZXInLFxuXHRcdGlkOiBNZW51SWQuU0NNSGlzdG9yeUl0ZW1Ib3Zlcixcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21lbnVzLmhpc3RvcnlJdGVtSG92ZXInLCBcIlRoZSBTb3VyY2UgQ29udHJvbCBoaXN0b3J5IGl0ZW0gaG92ZXIgbWVudVwiKSxcblx0XHRwcm9wb3NlZDogJ2NvbnRyaWJTb3VyY2VDb250cm9sSGlzdG9yeUl0ZW1NZW51J1xuXHR9LFxuXHR7XG5cdFx0a2V5OiAnc2NtL2hpc3RvcnlJdGVtUmVmL2NvbnRleHQnLFxuXHRcdGlkOiBNZW51SWQuU0NNSGlzdG9yeUl0ZW1SZWZDb250ZXh0LFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWVudXMuaGlzdG9yeUl0ZW1SZWZDb250ZXh0JywgXCJUaGUgU291cmNlIENvbnRyb2wgaGlzdG9yeSBpdGVtIHJlZmVyZW5jZSBjb250ZXh0IG1lbnVcIiksXG5cdFx0cHJvcG9zZWQ6ICdjb250cmliU291cmNlQ29udHJvbEhpc3RvcnlJdGVtTWVudSdcblx0fSxcblx0e1xuXHRcdGtleTogJ3N0YXR1c0Jhci9yZW1vdGVJbmRpY2F0b3InLFxuXHRcdGlkOiBNZW51SWQuU3RhdHVzQmFyUmVtb3RlSW5kaWNhdG9yTWVudSxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21lbnVzLnN0YXR1c0JhclJlbW90ZUluZGljYXRvcicsIFwiVGhlIHJlbW90ZSBpbmRpY2F0b3IgbWVudSBpbiB0aGUgc3RhdHVzIGJhclwiKSxcblx0XHRzdXBwb3J0c1N1Ym1lbnVzOiBmYWxzZVxuXHR9LFxuXHR7XG5cdFx0a2V5OiAndGVybWluYWwvY29udGV4dCcsXG5cdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbEluc3RhbmNlQ29udGV4dCxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21lbnVzLnRlcm1pbmFsQ29udGV4dCcsIFwiVGhlIHRlcm1pbmFsIGNvbnRleHQgbWVudVwiKVxuXHR9LFxuXHR7XG5cdFx0a2V5OiAndGVybWluYWwvdGl0bGUvY29udGV4dCcsXG5cdFx0aWQ6IE1lbnVJZC5UZXJtaW5hbFRhYkNvbnRleHQsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdtZW51cy50ZXJtaW5hbFRhYkNvbnRleHQnLCBcIlRoZSB0ZXJtaW5hbCB0YWJzIGNvbnRleHQgbWVudVwiKVxuXHR9LFxuXHR7XG5cdFx0a2V5OiAndmlldy90aXRsZScsXG5cdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2aWV3LnZpZXdUaXRsZScsIFwiVGhlIGNvbnRyaWJ1dGVkIHZpZXcgdGl0bGUgbWVudVwiKVxuXHR9LFxuXHR7XG5cdFx0a2V5OiAndmlld0NvbnRhaW5lci90aXRsZScsXG5cdFx0aWQ6IE1lbnVJZC5WaWV3Q29udGFpbmVyVGl0bGUsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2aWV3LmNvbnRhaW5lclRpdGxlJywgXCJUaGUgY29udHJpYnV0ZWQgdmlldyBjb250YWluZXIgdGl0bGUgbWVudVwiKSxcblx0XHRwcm9wb3NlZDogJ2NvbnRyaWJWaWV3Q29udGFpbmVyVGl0bGUnXG5cdH0sXG5cdHtcblx0XHRrZXk6ICd2aWV3L2l0ZW0vY29udGV4dCcsXG5cdFx0aWQ6IE1lbnVJZC5WaWV3SXRlbUNvbnRleHQsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2aWV3Lml0ZW1Db250ZXh0JywgXCJUaGUgY29udHJpYnV0ZWQgdmlldyBpdGVtIGNvbnRleHQgbWVudVwiKVxuXHR9LFxuXHR7XG5cdFx0a2V5OiAnY29tbWVudHMvY29tbWVudC9lZGl0b3JBY3Rpb25zJyxcblx0XHRpZDogTWVudUlkLkNvbW1lbnRFZGl0b3JBY3Rpb25zLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY29tbWVudFRocmVhZC5lZGl0b3JBY3Rpb25zJywgXCJUaGUgY29udHJpYnV0ZWQgY29tbWVudCBlZGl0b3IgYWN0aW9uc1wiKSxcblx0XHRwcm9wb3NlZDogJ2NvbnRyaWJDb21tZW50RWRpdG9yQWN0aW9uc01lbnUnXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdjb21tZW50cy9jb21tZW50VGhyZWFkL3RpdGxlJyxcblx0XHRpZDogTWVudUlkLkNvbW1lbnRUaHJlYWRUaXRsZSxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NvbW1lbnRUaHJlYWQudGl0bGUnLCBcIlRoZSBjb250cmlidXRlZCBjb21tZW50IHRocmVhZCB0aXRsZSBtZW51XCIpXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdjb21tZW50cy9jb21tZW50VGhyZWFkL2NvbnRleHQnLFxuXHRcdGlkOiBNZW51SWQuQ29tbWVudFRocmVhZEFjdGlvbnMsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdjb21tZW50VGhyZWFkLmFjdGlvbnMnLCBcIlRoZSBjb250cmlidXRlZCBjb21tZW50IHRocmVhZCBjb250ZXh0IG1lbnUsIHJlbmRlcmVkIGFzIGJ1dHRvbnMgYmVsb3cgdGhlIGNvbW1lbnQgZWRpdG9yXCIpLFxuXHRcdHN1cHBvcnRzU3VibWVudXM6IGZhbHNlXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdjb21tZW50cy9jb21tZW50VGhyZWFkL2FkZGl0aW9uYWxBY3Rpb25zJyxcblx0XHRpZDogTWVudUlkLkNvbW1lbnRUaHJlYWRBZGRpdGlvbmFsQWN0aW9ucyxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NvbW1lbnRUaHJlYWQuYWN0aW9ucycsIFwiVGhlIGNvbnRyaWJ1dGVkIGNvbW1lbnQgdGhyZWFkIGNvbnRleHQgbWVudSwgcmVuZGVyZWQgYXMgYnV0dG9ucyBiZWxvdyB0aGUgY29tbWVudCBlZGl0b3JcIiksXG5cdFx0c3VwcG9ydHNTdWJtZW51czogdHJ1ZSxcblx0XHRwcm9wb3NlZDogJ2NvbnRyaWJDb21tZW50VGhyZWFkQWRkaXRpb25hbE1lbnUnXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdjb21tZW50cy9jb21tZW50VGhyZWFkL3RpdGxlL2NvbnRleHQnLFxuXHRcdGlkOiBNZW51SWQuQ29tbWVudFRocmVhZFRpdGxlQ29udGV4dCxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NvbW1lbnRUaHJlYWQudGl0bGVDb250ZXh0JywgXCJUaGUgY29udHJpYnV0ZWQgY29tbWVudCB0aHJlYWQgdGl0bGUncyBwZWVrIGNvbnRleHQgbWVudSwgcmVuZGVyZWQgYXMgYSByaWdodCBjbGljayBtZW51IG9uIHRoZSBjb21tZW50IHRocmVhZCdzIHBlZWsgdGl0bGUuXCIpLFxuXHRcdHByb3Bvc2VkOiAnY29udHJpYkNvbW1lbnRQZWVrQ29udGV4dCdcblx0fSxcblx0e1xuXHRcdGtleTogJ2NvbW1lbnRzL2NvbW1lbnQvdGl0bGUnLFxuXHRcdGlkOiBNZW51SWQuQ29tbWVudFRpdGxlLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY29tbWVudC50aXRsZScsIFwiVGhlIGNvbnRyaWJ1dGVkIGNvbW1lbnQgdGl0bGUgbWVudVwiKVxuXHR9LFxuXHR7XG5cdFx0a2V5OiAnY29tbWVudHMvY29tbWVudC9jb250ZXh0Jyxcblx0XHRpZDogTWVudUlkLkNvbW1lbnRBY3Rpb25zLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY29tbWVudC5hY3Rpb25zJywgXCJUaGUgY29udHJpYnV0ZWQgY29tbWVudCBjb250ZXh0IG1lbnUsIHJlbmRlcmVkIGFzIGJ1dHRvbnMgYmVsb3cgdGhlIGNvbW1lbnQgZWRpdG9yXCIpLFxuXHRcdHN1cHBvcnRzU3VibWVudXM6IGZhbHNlXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdjb21tZW50cy9jb21tZW50VGhyZWFkL2NvbW1lbnQvY29udGV4dCcsXG5cdFx0aWQ6IE1lbnVJZC5Db21tZW50VGhyZWFkQ29tbWVudENvbnRleHQsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdjb21tZW50LmNvbW1lbnRDb250ZXh0JywgXCJUaGUgY29udHJpYnV0ZWQgY29tbWVudCBjb250ZXh0IG1lbnUsIHJlbmRlcmVkIGFzIGEgcmlnaHQgY2xpY2sgbWVudSBvbiB0aGUgYW4gaW5kaXZpZHVhbCBjb21tZW50IGluIHRoZSBjb21tZW50IHRocmVhZCdzIHBlZWsgdmlldy5cIiksXG5cdFx0cHJvcG9zZWQ6ICdjb250cmliQ29tbWVudFBlZWtDb250ZXh0J1xuXHR9LFxuXHR7XG5cdFx0a2V5OiAnY29tbWVudHNWaWV3L2NvbW1lbnRUaHJlYWQvY29udGV4dCcsXG5cdFx0aWQ6IE1lbnVJZC5Db21tZW50c1ZpZXdUaHJlYWRBY3Rpb25zLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY29tbWVudHNWaWV3LnRocmVhZEFjdGlvbnMnLCBcIlRoZSBjb250cmlidXRlZCBjb21tZW50IHRocmVhZCBjb250ZXh0IG1lbnUgaW4gdGhlIGNvbW1lbnRzIHZpZXdcIiksXG5cdFx0cHJvcG9zZWQ6ICdjb250cmliQ29tbWVudHNWaWV3VGhyZWFkTWVudXMnXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdub3RlYm9vay90b29sYmFyJyxcblx0XHRpZDogTWVudUlkLk5vdGVib29rVG9vbGJhcixcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ25vdGVib29rLnRvb2xiYXInLCBcIlRoZSBjb250cmlidXRlZCBub3RlYm9vayB0b29sYmFyIG1lbnVcIilcblx0fSxcblx0e1xuXHRcdGtleTogJ25vdGVib29rL2tlcm5lbFNvdXJjZScsXG5cdFx0aWQ6IE1lbnVJZC5Ob3RlYm9va0tlcm5lbFNvdXJjZSxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ25vdGVib29rLmtlcm5lbFNvdXJjZScsIFwiVGhlIGNvbnRyaWJ1dGVkIG5vdGVib29rIGtlcm5lbCBzb3VyY2VzIG1lbnVcIiksXG5cdFx0cHJvcG9zZWQ6ICdub3RlYm9va0tlcm5lbFNvdXJjZSdcblx0fSxcblx0e1xuXHRcdGtleTogJ25vdGVib29rL2NlbGwvdGl0bGUnLFxuXHRcdGlkOiBNZW51SWQuTm90ZWJvb2tDZWxsVGl0bGUsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdub3RlYm9vay5jZWxsLnRpdGxlJywgXCJUaGUgY29udHJpYnV0ZWQgbm90ZWJvb2sgY2VsbCB0aXRsZSBtZW51XCIpXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdub3RlYm9vay9jZWxsL2V4ZWN1dGUnLFxuXHRcdGlkOiBNZW51SWQuTm90ZWJvb2tDZWxsRXhlY3V0ZSxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ25vdGVib29rLmNlbGwuZXhlY3V0ZScsIFwiVGhlIGNvbnRyaWJ1dGVkIG5vdGVib29rIGNlbGwgZXhlY3V0aW9uIG1lbnVcIilcblx0fSxcblx0e1xuXHRcdGtleTogJ2ludGVyYWN0aXZlL3Rvb2xiYXInLFxuXHRcdGlkOiBNZW51SWQuSW50ZXJhY3RpdmVUb29sYmFyLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnaW50ZXJhY3RpdmUudG9vbGJhcicsIFwiVGhlIGNvbnRyaWJ1dGVkIGludGVyYWN0aXZlIHRvb2xiYXIgbWVudVwiKSxcblx0fSxcblx0e1xuXHRcdGtleTogJ2ludGVyYWN0aXZlL2NlbGwvdGl0bGUnLFxuXHRcdGlkOiBNZW51SWQuSW50ZXJhY3RpdmVDZWxsVGl0bGUsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdpbnRlcmFjdGl2ZS5jZWxsLnRpdGxlJywgXCJUaGUgY29udHJpYnV0ZWQgaW50ZXJhY3RpdmUgY2VsbCB0aXRsZSBtZW51XCIpLFxuXHR9LFxuXHR7XG5cdFx0a2V5OiAnaXNzdWUvcmVwb3J0ZXInLFxuXHRcdGlkOiBNZW51SWQuSXNzdWVSZXBvcnRlcixcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2lzc3VlLnJlcG9ydGVyJywgXCJUaGUgY29udHJpYnV0ZWQgaXNzdWUgcmVwb3J0ZXIgbWVudVwiKVxuXHR9LFxuXHR7XG5cdFx0a2V5OiAndGVzdGluZy9pdGVtL2NvbnRleHQnLFxuXHRcdGlkOiBNZW51SWQuVGVzdEl0ZW0sXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXN0aW5nLml0ZW0uY29udGV4dCcsIFwiVGhlIGNvbnRyaWJ1dGVkIHRlc3QgaXRlbSBtZW51XCIpLFxuXHR9LFxuXHR7XG5cdFx0a2V5OiAndGVzdGluZy9pdGVtL2d1dHRlcicsXG5cdFx0aWQ6IE1lbnVJZC5UZXN0SXRlbUd1dHRlcixcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlc3RpbmcuaXRlbS5ndXR0ZXIudGl0bGUnLCBcIlRoZSBtZW51IGZvciBhIGd1dHRlciBkZWNvcmF0aW9uIGZvciBhIHRlc3QgaXRlbVwiKSxcblx0fSxcblx0e1xuXHRcdGtleTogJ3Rlc3RpbmcvcHJvZmlsZXMvY29udGV4dCcsXG5cdFx0aWQ6IE1lbnVJZC5UZXN0UHJvZmlsZXNDb250ZXh0LFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndGVzdGluZy5wcm9maWxlcy5jb250ZXh0LnRpdGxlJywgXCJUaGUgbWVudSBmb3IgY29uZmlndXJpbmcgdGVzdGluZyBwcm9maWxlcy5cIiksXG5cdH0sXG5cdHtcblx0XHRrZXk6ICd0ZXN0aW5nL2l0ZW0vcmVzdWx0Jyxcblx0XHRpZDogTWVudUlkLlRlc3RQZWVrRWxlbWVudCxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlc3RpbmcuaXRlbS5yZXN1bHQudGl0bGUnLCBcIlRoZSBtZW51IGZvciBhbiBpdGVtIGluIHRoZSBUZXN0IFJlc3VsdHMgdmlldyBvciBwZWVrLlwiKSxcblx0fSxcblx0e1xuXHRcdGtleTogJ3Rlc3RpbmcvbWVzc2FnZS9jb250ZXh0Jyxcblx0XHRpZDogTWVudUlkLlRlc3RNZXNzYWdlQ29udGV4dCxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Rlc3RpbmcubWVzc2FnZS5jb250ZXh0LnRpdGxlJywgXCJBIHByb21pbmVudCBidXR0b24gb3ZlcmxheWluZyBlZGl0b3IgY29udGVudCB3aGVyZSB0aGUgbWVzc2FnZSBpcyBkaXNwbGF5ZWRcIiksXG5cdH0sXG5cdHtcblx0XHRrZXk6ICd0ZXN0aW5nL21lc3NhZ2UvY29udGVudCcsXG5cdFx0aWQ6IE1lbnVJZC5UZXN0TWVzc2FnZUNvbnRlbnQsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0ZXN0aW5nLm1lc3NhZ2UuY29udGVudC50aXRsZScsIFwiQ29udGV4dCBtZW51IGZvciB0aGUgbWVzc2FnZSBpbiB0aGUgcmVzdWx0cyB0cmVlXCIpLFxuXHR9LFxuXHR7XG5cdFx0a2V5OiAnZXh0ZW5zaW9uL2NvbnRleHQnLFxuXHRcdGlkOiBNZW51SWQuRXh0ZW5zaW9uQ29udGV4dCxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21lbnVzLmV4dGVuc2lvbkNvbnRleHQnLCBcIlRoZSBleHRlbnNpb24gY29udGV4dCBtZW51XCIpXG5cdH0sXG5cdHtcblx0XHRrZXk6ICd0aW1lbGluZS90aXRsZScsXG5cdFx0aWQ6IE1lbnVJZC5UaW1lbGluZVRpdGxlLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndmlldy50aW1lbGluZVRpdGxlJywgXCJUaGUgVGltZWxpbmUgdmlldyB0aXRsZSBtZW51XCIpXG5cdH0sXG5cdHtcblx0XHRrZXk6ICd0aW1lbGluZS9pdGVtL2NvbnRleHQnLFxuXHRcdGlkOiBNZW51SWQuVGltZWxpbmVJdGVtQ29udGV4dCxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZpZXcudGltZWxpbmVDb250ZXh0JywgXCJUaGUgVGltZWxpbmUgdmlldyBpdGVtIGNvbnRleHQgbWVudVwiKVxuXHR9LFxuXHR7XG5cdFx0a2V5OiAncG9ydHMvaXRlbS9jb250ZXh0Jyxcblx0XHRpZDogTWVudUlkLlR1bm5lbENvbnRleHQsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2aWV3LnR1bm5lbENvbnRleHQnLCBcIlRoZSBQb3J0cyB2aWV3IGl0ZW0gY29udGV4dCBtZW51XCIpXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdwb3J0cy9pdGVtL29yaWdpbi9pbmxpbmUnLFxuXHRcdGlkOiBNZW51SWQuVHVubmVsT3JpZ2luSW5saW5lLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndmlldy50dW5uZWxPcmlnaW5JbmxpbmUnLCBcIlRoZSBQb3J0cyB2aWV3IGl0ZW0gb3JpZ2luIGlubGluZSBtZW51XCIpXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdwb3J0cy9pdGVtL3BvcnQvaW5saW5lJyxcblx0XHRpZDogTWVudUlkLlR1bm5lbFBvcnRJbmxpbmUsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2aWV3LnR1bm5lbFBvcnRJbmxpbmUnLCBcIlRoZSBQb3J0cyB2aWV3IGl0ZW0gcG9ydCBpbmxpbmUgbWVudVwiKVxuXHR9LFxuXHR7XG5cdFx0a2V5OiAnZmlsZS9uZXdGaWxlJyxcblx0XHRpZDogTWVudUlkLk5ld0ZpbGUsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWxlLm5ld0ZpbGUnLCBcIlRoZSAnTmV3IEZpbGUuLi4nIHF1aWNrIHBpY2ssIHNob3duIG9uIHdlbGNvbWUgcGFnZSBhbmQgRmlsZSBtZW51LlwiKSxcblx0XHRzdXBwb3J0c1N1Ym1lbnVzOiBmYWxzZSxcblx0fSxcblx0e1xuXHRcdGtleTogJ3dlYnZpZXcvY29udGV4dCcsXG5cdFx0aWQ6IE1lbnVJZC5XZWJ2aWV3Q29udGV4dCxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dlYnZpZXcuY29udGV4dCcsIFwiVGhlIHdlYnZpZXcgY29udGV4dCBtZW51XCIpXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdmaWxlL3NoYXJlJyxcblx0XHRpZDogTWVudUlkLk1lbnViYXJTaGFyZSxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21lbnVzLnNoYXJlJywgXCJTaGFyZSBzdWJtZW51IHNob3duIGluIHRoZSB0b3AgbGV2ZWwgRmlsZSBtZW51LlwiKSxcblx0XHRwcm9wb3NlZDogJ2NvbnRyaWJTaGFyZU1lbnUnXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdlZGl0b3IvaW5saW5lQ29tcGxldGlvbnMvYWN0aW9ucycsXG5cdFx0aWQ6IE1lbnVJZC5JbmxpbmVDb21wbGV0aW9uc0FjdGlvbnMsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdpbmxpbmVDb21wbGV0aW9ucy5hY3Rpb25zJywgXCJUaGUgYWN0aW9ucyBzaG93biB3aGVuIGhvdmVyaW5nIG9uIGFuIGlubGluZSBjb21wbGV0aW9uXCIpLFxuXHRcdHN1cHBvcnRzU3VibWVudXM6IGZhbHNlLFxuXHRcdHByb3Bvc2VkOiAnaW5saW5lQ29tcGxldGlvbnNBZGRpdGlvbnMnXG5cdH0sXG5cdHtcblx0XHRrZXk6ICdlZGl0b3IvY29udGVudCcsXG5cdFx0aWQ6IE1lbnVJZC5FZGl0b3JDb250ZW50LFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWVyZ2UudG9vbGJhcicsIFwiVGhlIHByb21pbmVudCBidXR0b24gaW4gYW4gZWRpdG9yLCBvdmVybGF5cyBpdHMgY29udGVudFwiKSxcblx0XHRwcm9wb3NlZDogJ2NvbnRyaWJFZGl0b3JDb250ZW50TWVudSdcblx0fSxcblx0e1xuXHRcdGtleTogJ2VkaXRvci9saW5lTnVtYmVyL2NvbnRleHQnLFxuXHRcdGlkOiBNZW51SWQuRWRpdG9yTGluZU51bWJlckNvbnRleHQsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdlZGl0b3JMaW5lTnVtYmVyQ29udGV4dCcsIFwiVGhlIGNvbnRyaWJ1dGVkIGVkaXRvciBsaW5lIG51bWJlciBjb250ZXh0IG1lbnVcIilcblx0fSxcblx0e1xuXHRcdGtleTogJ21lcmdlRWRpdG9yL3Jlc3VsdC90aXRsZScsXG5cdFx0aWQ6IE1lbnVJZC5NZXJnZUlucHV0UmVzdWx0VG9vbGJhcixcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21lbnVzLm1lcmdlRWRpdG9yUmVzdWx0JywgXCJUaGUgcmVzdWx0IHRvb2xiYXIgb2YgdGhlIG1lcmdlIGVkaXRvclwiKSxcblx0XHRwcm9wb3NlZDogJ2NvbnRyaWJNZXJnZUVkaXRvck1lbnVzJ1xuXHR9LFxuXHR7XG5cdFx0a2V5OiAnbXVsdGlEaWZmRWRpdG9yL3Jlc291cmNlL3RpdGxlJyxcblx0XHRpZDogTWVudUlkLk11bHRpRGlmZkVkaXRvckZpbGVUb29sYmFyLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWVudXMubXVsdGlEaWZmRWRpdG9yUmVzb3VyY2UnLCBcIlRoZSByZXNvdXJjZSB0b29sYmFyIGluIHRoZSBtdWx0aSBkaWZmIGVkaXRvclwiKSxcblx0XHRwcm9wb3NlZDogJ2NvbnRyaWJNdWx0aURpZmZFZGl0b3JNZW51cydcblx0fSxcblx0e1xuXHRcdGtleTogJ2RpZmZFZGl0b3IvZ3V0dGVyL2h1bmsnLFxuXHRcdGlkOiBNZW51SWQuRGlmZkVkaXRvckh1bmtUb29sYmFyLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWVudXMuZGlmZkVkaXRvckd1dHRlclRvb2xCYXJNZW51cycsIFwiVGhlIGd1dHRlciB0b29sYmFyIGluIHRoZSBkaWZmIGVkaXRvclwiKSxcblx0XHRwcm9wb3NlZDogJ2NvbnRyaWJEaWZmRWRpdG9yR3V0dGVyVG9vbEJhck1lbnVzJ1xuXHR9LFxuXHR7XG5cdFx0a2V5OiAnZGlmZkVkaXRvci9ndXR0ZXIvc2VsZWN0aW9uJyxcblx0XHRpZDogTWVudUlkLkRpZmZFZGl0b3JTZWxlY3Rpb25Ub29sYmFyLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWVudXMuZGlmZkVkaXRvckd1dHRlclRvb2xCYXJNZW51cycsIFwiVGhlIGd1dHRlciB0b29sYmFyIGluIHRoZSBkaWZmIGVkaXRvclwiKSxcblx0XHRwcm9wb3NlZDogJ2NvbnRyaWJEaWZmRWRpdG9yR3V0dGVyVG9vbEJhck1lbnVzJ1xuXHR9LFxuXHR7XG5cdFx0a2V5OiAnc2VhcmNoUGFuZWwvYWlSZXN1bHRzL2NvbW1hbmRzJyxcblx0XHRpZDogTWVudUlkLlNlYXJjaEFjdGlvbk1lbnUsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdzZWFyY2hQYW5lbC5haVJlc3VsdHNDb21tYW5kcycsIFwiVGhlIGNvbW1hbmRzIHRoYXQgd2lsbCBjb250cmlidXRlIHRvIHRoZSBtZW51IHJlbmRlcmVkIGFzIGJ1dHRvbnMgbmV4dCB0byB0aGUgQUkgc2VhcmNoIHRpdGxlXCIpLFxuXHR9LFxuXHR7XG5cdFx0a2V5OiAnY2hhdC9tb2RlbFBpY2tlcicsXG5cdFx0aWQ6IE1lbnVJZC5DaGF0TW9kZWxQaWNrZXIsXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdtZW51cy5jaGF0TW9kZWxQaWNrZXInLCBcIlRoZSBjaGF0IG1vZGVsIHBpY2tlciBkcm9wZG93biBtZW51XCIpLFxuXHRcdHN1cHBvcnRzU3VibWVudXM6IGZhbHNlLFxuXHRcdHByb3Bvc2VkOiAnY2hhdFBhcnRpY2lwYW50UHJpdmF0ZSdcblx0fVxuXTtcblxubmFtZXNwYWNlIHNjaGVtYSB7XG5cblx0Ly8gLS0tIG1lbnVzLCBzdWJtZW51cyBjb250cmlidXRpb24gcG9pbnRcblxuXHRleHBvcnQgaW50ZXJmYWNlIElVc2VyRnJpZW5kbHlNZW51SXRlbSB7XG5cdFx0Y29tbWFuZDogc3RyaW5nO1xuXHRcdGFsdD86IHN0cmluZztcblx0XHR3aGVuPzogc3RyaW5nO1xuXHRcdGdyb3VwPzogc3RyaW5nO1xuXHR9XG5cblx0ZXhwb3J0IGludGVyZmFjZSBJVXNlckZyaWVuZGx5U3VibWVudUl0ZW0ge1xuXHRcdHN1Ym1lbnU6IHN0cmluZztcblx0XHR3aGVuPzogc3RyaW5nO1xuXHRcdGdyb3VwPzogc3RyaW5nO1xuXHR9XG5cblx0ZXhwb3J0IGludGVyZmFjZSBJVXNlckZyaWVuZGx5U3VibWVudSB7XG5cdFx0aWQ6IHN0cmluZztcblx0XHRsYWJlbDogc3RyaW5nO1xuXHRcdGljb24/OiBJVXNlckZyaWVuZGx5SWNvbjtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBpc01lbnVJdGVtKGl0ZW06IElVc2VyRnJpZW5kbHlNZW51SXRlbSB8IElVc2VyRnJpZW5kbHlTdWJtZW51SXRlbSk6IGl0ZW0gaXMgSVVzZXJGcmllbmRseU1lbnVJdGVtIHtcblx0XHRyZXR1cm4gdHlwZW9mIChpdGVtIGFzIElVc2VyRnJpZW5kbHlNZW51SXRlbSkuY29tbWFuZCA9PT0gJ3N0cmluZyc7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gaXNWYWxpZE1lbnVJdGVtKGl0ZW06IElVc2VyRnJpZW5kbHlNZW51SXRlbSwgY29sbGVjdG9yOiBFeHRlbnNpb25NZXNzYWdlQ29sbGVjdG9yKTogYm9vbGVhbiB7XG5cdFx0aWYgKHR5cGVvZiBpdGVtLmNvbW1hbmQgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRjb2xsZWN0b3IuZXJyb3IobG9jYWxpemUoJ3JlcXVpcmVzdHJpbmcnLCBcInByb3BlcnR5IGB7MH1gIGlzIG1hbmRhdG9yeSBhbmQgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdgXCIsICdjb21tYW5kJykpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoaXRlbS5hbHQgJiYgdHlwZW9mIGl0ZW0uYWx0ICE9PSAnc3RyaW5nJykge1xuXHRcdFx0Y29sbGVjdG9yLmVycm9yKGxvY2FsaXplKCdvcHRzdHJpbmcnLCBcInByb3BlcnR5IGB7MH1gIGNhbiBiZSBvbWl0dGVkIG9yIG11c3QgYmUgb2YgdHlwZSBgc3RyaW5nYFwiLCAnYWx0JykpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoaXRlbS53aGVuICYmIHR5cGVvZiBpdGVtLndoZW4gIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRjb2xsZWN0b3IuZXJyb3IobG9jYWxpemUoJ29wdHN0cmluZycsIFwicHJvcGVydHkgYHswfWAgY2FuIGJlIG9taXR0ZWQgb3IgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdgXCIsICd3aGVuJykpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoaXRlbS5ncm91cCAmJiB0eXBlb2YgaXRlbS5ncm91cCAhPT0gJ3N0cmluZycpIHtcblx0XHRcdGNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgnb3B0c3RyaW5nJywgXCJwcm9wZXJ0eSBgezB9YCBjYW4gYmUgb21pdHRlZCBvciBtdXN0IGJlIG9mIHR5cGUgYHN0cmluZ2BcIiwgJ2dyb3VwJykpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRTdWJtZW51SXRlbShpdGVtOiBJVXNlckZyaWVuZGx5U3VibWVudUl0ZW0sIGNvbGxlY3RvcjogRXh0ZW5zaW9uTWVzc2FnZUNvbGxlY3Rvcik6IGJvb2xlYW4ge1xuXHRcdGlmICh0eXBlb2YgaXRlbS5zdWJtZW51ICE9PSAnc3RyaW5nJykge1xuXHRcdFx0Y29sbGVjdG9yLmVycm9yKGxvY2FsaXplKCdyZXF1aXJlc3RyaW5nJywgXCJwcm9wZXJ0eSBgezB9YCBpcyBtYW5kYXRvcnkgYW5kIG11c3QgYmUgb2YgdHlwZSBgc3RyaW5nYFwiLCAnc3VibWVudScpKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKGl0ZW0ud2hlbiAmJiB0eXBlb2YgaXRlbS53aGVuICE9PSAnc3RyaW5nJykge1xuXHRcdFx0Y29sbGVjdG9yLmVycm9yKGxvY2FsaXplKCdvcHRzdHJpbmcnLCBcInByb3BlcnR5IGB7MH1gIGNhbiBiZSBvbWl0dGVkIG9yIG11c3QgYmUgb2YgdHlwZSBgc3RyaW5nYFwiLCAnd2hlbicpKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKGl0ZW0uZ3JvdXAgJiYgdHlwZW9mIGl0ZW0uZ3JvdXAgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRjb2xsZWN0b3IuZXJyb3IobG9jYWxpemUoJ29wdHN0cmluZycsIFwicHJvcGVydHkgYHswfWAgY2FuIGJlIG9taXR0ZWQgb3IgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdgXCIsICdncm91cCcpKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkSXRlbXMoaXRlbXM6IChJVXNlckZyaWVuZGx5TWVudUl0ZW0gfCBJVXNlckZyaWVuZGx5U3VibWVudUl0ZW0pW10sIGNvbGxlY3RvcjogRXh0ZW5zaW9uTWVzc2FnZUNvbGxlY3Rvcik6IGJvb2xlYW4ge1xuXHRcdGlmICghQXJyYXkuaXNBcnJheShpdGVtcykpIHtcblx0XHRcdGNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgncmVxdWlyZWFycmF5JywgXCJzdWJtZW51IGl0ZW1zIG11c3QgYmUgYW4gYXJyYXlcIikpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuXHRcdFx0aWYgKGlzTWVudUl0ZW0oaXRlbSkpIHtcblx0XHRcdFx0aWYgKCFpc1ZhbGlkTWVudUl0ZW0oaXRlbSwgY29sbGVjdG9yKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKCFpc1ZhbGlkU3VibWVudUl0ZW0oaXRlbSwgY29sbGVjdG9yKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRTdWJtZW51KHN1Ym1lbnU6IElVc2VyRnJpZW5kbHlTdWJtZW51LCBjb2xsZWN0b3I6IEV4dGVuc2lvbk1lc3NhZ2VDb2xsZWN0b3IpOiBib29sZWFuIHtcblx0XHRpZiAodHlwZW9mIHN1Ym1lbnUgIT09ICdvYmplY3QnKSB7XG5cdFx0XHRjb2xsZWN0b3IuZXJyb3IobG9jYWxpemUoJ3JlcXVpcmUnLCBcInN1Ym1lbnUgaXRlbXMgbXVzdCBiZSBhbiBvYmplY3RcIikpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2Ygc3VibWVudS5pZCAhPT0gJ3N0cmluZycpIHtcblx0XHRcdGNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgncmVxdWlyZXN0cmluZycsIFwicHJvcGVydHkgYHswfWAgaXMgbWFuZGF0b3J5IGFuZCBtdXN0IGJlIG9mIHR5cGUgYHN0cmluZ2BcIiwgJ2lkJykpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIHN1Ym1lbnUubGFiZWwgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRjb2xsZWN0b3IuZXJyb3IobG9jYWxpemUoJ3JlcXVpcmVzdHJpbmcnLCBcInByb3BlcnR5IGB7MH1gIGlzIG1hbmRhdG9yeSBhbmQgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdgXCIsICdsYWJlbCcpKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGNvbnN0IG1lbnVJdGVtOiBJSlNPTlNjaGVtYSA9IHtcblx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRyZXF1aXJlZDogWydjb21tYW5kJ10sXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMubWVudUl0ZW0uY29tbWFuZCcsICdJZGVudGlmaWVyIG9mIHRoZSBjb21tYW5kIHRvIGV4ZWN1dGUuIFRoZSBjb21tYW5kIG11c3QgYmUgZGVjbGFyZWQgaW4gdGhlIFxcJ2NvbW1hbmRzXFwnLXNlY3Rpb24nKSxcblx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdH0sXG5cdFx0XHRhbHQ6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLm1lbnVJdGVtLmFsdCcsICdJZGVudGlmaWVyIG9mIGFuIGFsdGVybmF0aXZlIGNvbW1hbmQgdG8gZXhlY3V0ZS4gVGhlIGNvbW1hbmQgbXVzdCBiZSBkZWNsYXJlZCBpbiB0aGUgXFwnY29tbWFuZHNcXCctc2VjdGlvbicpLFxuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0fSxcblx0XHRcdHdoZW46IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLm1lbnVJdGVtLndoZW4nLCAnQ29uZGl0aW9uIHdoaWNoIG11c3QgYmUgdHJ1ZSB0byBzaG93IHRoaXMgaXRlbScpLFxuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0fSxcblx0XHRcdGdyb3VwOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5tZW51SXRlbS5ncm91cCcsICdHcm91cCBpbnRvIHdoaWNoIHRoaXMgaXRlbSBiZWxvbmdzJyksXG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXG5cdGNvbnN0IHN1Ym1lbnVJdGVtOiBJSlNPTlNjaGVtYSA9IHtcblx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRyZXF1aXJlZDogWydzdWJtZW51J10sXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0c3VibWVudToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMubWVudUl0ZW0uc3VibWVudScsICdJZGVudGlmaWVyIG9mIHRoZSBzdWJtZW51IHRvIGRpc3BsYXkgaW4gdGhpcyBpdGVtLicpLFxuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0fSxcblx0XHRcdHdoZW46IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLm1lbnVJdGVtLndoZW4nLCAnQ29uZGl0aW9uIHdoaWNoIG11c3QgYmUgdHJ1ZSB0byBzaG93IHRoaXMgaXRlbScpLFxuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0fSxcblx0XHRcdGdyb3VwOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5tZW51SXRlbS5ncm91cCcsICdHcm91cCBpbnRvIHdoaWNoIHRoaXMgaXRlbSBiZWxvbmdzJyksXG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXG5cdGNvbnN0IHN1Ym1lbnU6IElKU09OU2NoZW1hID0ge1xuXHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdHJlcXVpcmVkOiBbJ2lkJywgJ2xhYmVsJ10sXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0aWQ6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnN1Ym1lbnUuaWQnLCAnSWRlbnRpZmllciBvZiB0aGUgbWVudSB0byBkaXNwbGF5IGFzIGEgc3VibWVudS4nKSxcblx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdH0sXG5cdFx0XHRsYWJlbDoge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuc3VibWVudS5sYWJlbCcsICdUaGUgbGFiZWwgb2YgdGhlIG1lbnUgaXRlbSB3aGljaCBsZWFkcyB0byB0aGlzIHN1Ym1lbnUuJyksXG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHR9LFxuXHRcdFx0aWNvbjoge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoeyBrZXk6ICd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnN1Ym1lbnUuaWNvbicsIGNvbW1lbnQ6IFsnZG8gbm90IHRyYW5zbGF0ZSBvciBjaGFuZ2UgYFxcXFwkKHphcClgLCBcXFxcIGluIGZyb250IG9mICQgaXMgaW1wb3J0YW50LiddIH0sICcoT3B0aW9uYWwpIEljb24gd2hpY2ggaXMgdXNlZCB0byByZXByZXNlbnQgdGhlIHN1Ym1lbnUgaW4gdGhlIFVJLiBFaXRoZXIgYSBmaWxlIHBhdGgsIGFuIG9iamVjdCB3aXRoIGZpbGUgcGF0aHMgZm9yIGRhcmsgYW5kIGxpZ2h0IHRoZW1lcywgb3IgYSB0aGVtZSBpY29uIHJlZmVyZW5jZXMsIGxpa2UgYFxcXFwkKHphcClgJyksXG5cdFx0XHRcdGFueU9mOiBbe1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRsaWdodDoge1xuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuc3VibWVudS5pY29uLmxpZ2h0JywgJ0ljb24gcGF0aCB3aGVuIGEgbGlnaHQgdGhlbWUgaXMgdXNlZCcpLFxuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGRhcms6IHtcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnN1Ym1lbnUuaWNvbi5kYXJrJywgJ0ljb24gcGF0aCB3aGVuIGEgZGFyayB0aGVtZSBpcyB1c2VkJyksXG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XVxuXHRcdFx0fVxuXHRcdH1cblx0fTtcblxuXHRleHBvcnQgY29uc3QgbWVudXNDb250cmlidXRpb246IElKU09OU2NoZW1hID0ge1xuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5tZW51cycsIFwiQ29udHJpYnV0ZXMgbWVudSBpdGVtcyB0byB0aGUgZWRpdG9yXCIpLFxuXHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdHByb3BlcnRpZXM6IGluZGV4KGFwaU1lbnVzLCBtZW51ID0+IG1lbnUua2V5LCBtZW51ID0+ICh7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBtZW51LnByb3Bvc2VkID8gbG9jYWxpemUoJ3Byb3Bvc2VkJywgXCJQcm9wb3NlZCBBUEksIHJlcXVpcmVzIGBlbmFibGVkQXBpUHJvcG9zYWw6IFtcXFwiezB9XFxcIl1gIC0gezF9XCIsIG1lbnUucHJvcG9zZWQsIG1lbnUuZGVzY3JpcHRpb24pIDogbWVudS5kZXNjcmlwdGlvbixcblx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRpdGVtczogbWVudS5zdXBwb3J0c1N1Ym1lbnVzID09PSBmYWxzZSA/IG1lbnVJdGVtIDogeyBvbmVPZjogW21lbnVJdGVtLCBzdWJtZW51SXRlbV0gfVxuXHRcdH0pKSxcblx0XHRhZGRpdGlvbmFsUHJvcGVydGllczoge1xuXHRcdFx0ZGVzY3JpcHRpb246ICdTdWJtZW51Jyxcblx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRpdGVtczogeyBvbmVPZjogW21lbnVJdGVtLCBzdWJtZW51SXRlbV0gfVxuXHRcdH1cblx0fTtcblxuXHRleHBvcnQgY29uc3Qgc3VibWVudXNDb250cmlidXRpb246IElKU09OU2NoZW1hID0ge1xuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5zdWJtZW51cycsIFwiQ29udHJpYnV0ZXMgc3VibWVudSBpdGVtcyB0byB0aGUgZWRpdG9yXCIpLFxuXHRcdHR5cGU6ICdhcnJheScsXG5cdFx0aXRlbXM6IHN1Ym1lbnVcblx0fTtcblxuXHQvLyAtLS0gY29tbWFuZHMgY29udHJpYnV0aW9uIHBvaW50XG5cblx0ZXhwb3J0IGludGVyZmFjZSBJVXNlckZyaWVuZGx5Q29tbWFuZCB7XG5cdFx0Y29tbWFuZDogc3RyaW5nO1xuXHRcdHRpdGxlOiBzdHJpbmcgfCBJTG9jYWxpemVkU3RyaW5nO1xuXHRcdHNob3J0VGl0bGU/OiBzdHJpbmcgfCBJTG9jYWxpemVkU3RyaW5nO1xuXHRcdGVuYWJsZW1lbnQ/OiBzdHJpbmc7XG5cdFx0Y2F0ZWdvcnk/OiBzdHJpbmcgfCBJTG9jYWxpemVkU3RyaW5nO1xuXHRcdGljb24/OiBJVXNlckZyaWVuZGx5SWNvbjtcblx0fVxuXG5cdGV4cG9ydCB0eXBlIElVc2VyRnJpZW5kbHlJY29uID0gc3RyaW5nIHwgeyBsaWdodDogc3RyaW5nOyBkYXJrOiBzdHJpbmcgfTtcblxuXHRleHBvcnQgZnVuY3Rpb24gaXNWYWxpZENvbW1hbmQoY29tbWFuZDogSVVzZXJGcmllbmRseUNvbW1hbmQsIGNvbGxlY3RvcjogRXh0ZW5zaW9uTWVzc2FnZUNvbGxlY3Rvcik6IGJvb2xlYW4ge1xuXHRcdGlmICghY29tbWFuZCkge1xuXHRcdFx0Y29sbGVjdG9yLmVycm9yKGxvY2FsaXplKCdub25lbXB0eScsIFwiZXhwZWN0ZWQgbm9uLWVtcHR5IHZhbHVlLlwiKSk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmIChpc0ZhbHN5T3JXaGl0ZXNwYWNlKGNvbW1hbmQuY29tbWFuZCkpIHtcblx0XHRcdGNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgncmVxdWlyZXN0cmluZycsIFwicHJvcGVydHkgYHswfWAgaXMgbWFuZGF0b3J5IGFuZCBtdXN0IGJlIG9mIHR5cGUgYHN0cmluZ2BcIiwgJ2NvbW1hbmQnKSk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICghaXNWYWxpZExvY2FsaXplZFN0cmluZyhjb21tYW5kLnRpdGxlLCBjb2xsZWN0b3IsICd0aXRsZScpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmIChjb21tYW5kLnNob3J0VGl0bGUgJiYgIWlzVmFsaWRMb2NhbGl6ZWRTdHJpbmcoY29tbWFuZC5zaG9ydFRpdGxlLCBjb2xsZWN0b3IsICdzaG9ydFRpdGxlJykpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKGNvbW1hbmQuZW5hYmxlbWVudCAmJiB0eXBlb2YgY29tbWFuZC5lbmFibGVtZW50ICE9PSAnc3RyaW5nJykge1xuXHRcdFx0Y29sbGVjdG9yLmVycm9yKGxvY2FsaXplKCdvcHRzdHJpbmcnLCBcInByb3BlcnR5IGB7MH1gIGNhbiBiZSBvbWl0dGVkIG9yIG11c3QgYmUgb2YgdHlwZSBgc3RyaW5nYFwiLCAncHJlY29uZGl0aW9uJykpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoY29tbWFuZC5jYXRlZ29yeSAmJiAhaXNWYWxpZExvY2FsaXplZFN0cmluZyhjb21tYW5kLmNhdGVnb3J5LCBjb2xsZWN0b3IsICdjYXRlZ29yeScpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICghaXNWYWxpZEljb24oY29tbWFuZC5pY29uLCBjb2xsZWN0b3IpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0ZnVuY3Rpb24gaXNWYWxpZEljb24oaWNvbjogSVVzZXJGcmllbmRseUljb24gfCB1bmRlZmluZWQsIGNvbGxlY3RvcjogRXh0ZW5zaW9uTWVzc2FnZUNvbGxlY3Rvcik6IGJvb2xlYW4ge1xuXHRcdGlmICh0eXBlb2YgaWNvbiA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGljb24gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGVsc2UgaWYgKHR5cGVvZiBpY29uLmRhcmsgPT09ICdzdHJpbmcnICYmIHR5cGVvZiBpY29uLmxpZ2h0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgnb3B0aWNvbicsIFwicHJvcGVydHkgYGljb25gIGNhbiBiZSBvbWl0dGVkIG9yIG11c3QgYmUgZWl0aGVyIGEgc3RyaW5nIG9yIGEgbGl0ZXJhbCBsaWtlIGB7ZGFyaywgbGlnaHR9YFwiKSk7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0ZnVuY3Rpb24gaXNWYWxpZExvY2FsaXplZFN0cmluZyhsb2NhbGl6ZWQ6IHN0cmluZyB8IElMb2NhbGl6ZWRTdHJpbmcsIGNvbGxlY3RvcjogRXh0ZW5zaW9uTWVzc2FnZUNvbGxlY3RvciwgcHJvcGVydHlOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRpZiAodHlwZW9mIGxvY2FsaXplZCA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgncmVxdWlyZVN0cmluZ09yT2JqZWN0JywgXCJwcm9wZXJ0eSBgezB9YCBpcyBtYW5kYXRvcnkgYW5kIG11c3QgYmUgb2YgdHlwZSBgc3RyaW5nYCBvciBgb2JqZWN0YFwiLCBwcm9wZXJ0eU5hbWUpKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9IGVsc2UgaWYgKHR5cGVvZiBsb2NhbGl6ZWQgPT09ICdzdHJpbmcnICYmIGlzRmFsc3lPcldoaXRlc3BhY2UobG9jYWxpemVkKSkge1xuXHRcdFx0Y29sbGVjdG9yLmVycm9yKGxvY2FsaXplKCdyZXF1aXJlc3RyaW5nJywgXCJwcm9wZXJ0eSBgezB9YCBpcyBtYW5kYXRvcnkgYW5kIG11c3QgYmUgb2YgdHlwZSBgc3RyaW5nYFwiLCBwcm9wZXJ0eU5hbWUpKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9IGVsc2UgaWYgKHR5cGVvZiBsb2NhbGl6ZWQgIT09ICdzdHJpbmcnICYmIChpc0ZhbHN5T3JXaGl0ZXNwYWNlKGxvY2FsaXplZC5vcmlnaW5hbCkgfHwgaXNGYWxzeU9yV2hpdGVzcGFjZShsb2NhbGl6ZWQudmFsdWUpKSkge1xuXHRcdFx0Y29sbGVjdG9yLmVycm9yKGxvY2FsaXplKCdyZXF1aXJlc3RyaW5ncycsIFwicHJvcGVydGllcyBgezB9YCBhbmQgYHsxfWAgYXJlIG1hbmRhdG9yeSBhbmQgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdgXCIsIGAke3Byb3BlcnR5TmFtZX0udmFsdWVgLCBgJHtwcm9wZXJ0eU5hbWV9Lm9yaWdpbmFsYCkpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Y29uc3QgY29tbWFuZFR5cGU6IElKU09OU2NoZW1hID0ge1xuXHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdHJlcXVpcmVkOiBbJ2NvbW1hbmQnLCAndGl0bGUnXSxcblx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5jb21tYW5kVHlwZS5jb21tYW5kJywgJ0lkZW50aWZpZXIgb2YgdGhlIGNvbW1hbmQgdG8gZXhlY3V0ZScpLFxuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0fSxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5jb21tYW5kVHlwZS50aXRsZScsICdUaXRsZSBieSB3aGljaCB0aGUgY29tbWFuZCBpcyByZXByZXNlbnRlZCBpbiB0aGUgVUknKSxcblx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdH0sXG5cdFx0XHRzaG9ydFRpdGxlOiB7XG5cdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmNvbW1hbmRUeXBlLnNob3J0VGl0bGUnLCAnKE9wdGlvbmFsKSBTaG9ydCB0aXRsZSBieSB3aGljaCB0aGUgY29tbWFuZCBpcyByZXByZXNlbnRlZCBpbiB0aGUgVUkuIE1lbnVzIHBpY2sgZWl0aGVyIGB0aXRsZWAgb3IgYHNob3J0VGl0bGVgIGRlcGVuZGluZyBvbiB0aGUgY29udGV4dCBpbiB3aGljaCB0aGV5IHNob3cgY29tbWFuZHMuJyksXG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmNvbW1hbmRUeXBlLmNhdGVnb3J5JywgJyhPcHRpb25hbCkgQ2F0ZWdvcnkgc3RyaW5nIGJ5IHdoaWNoIHRoZSBjb21tYW5kIGlzIGdyb3VwZWQgaW4gdGhlIFVJJyksXG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHR9LFxuXHRcdFx0ZW5hYmxlbWVudDoge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuY29tbWFuZFR5cGUucHJlY29uZGl0aW9uJywgJyhPcHRpb25hbCkgQ29uZGl0aW9uIHdoaWNoIG11c3QgYmUgdHJ1ZSB0byBlbmFibGUgdGhlIGNvbW1hbmQgaW4gdGhlIFVJIChtZW51IGFuZCBrZXliaW5kaW5ncykuIERvZXMgbm90IHByZXZlbnQgZXhlY3V0aW5nIHRoZSBjb21tYW5kIGJ5IG90aGVyIG1lYW5zLCBsaWtlIHRoZSBgZXhlY3V0ZUNvbW1hbmRgLWFwaS4nKSxcblx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdH0sXG5cdFx0XHRpY29uOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSh7IGtleTogJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuY29tbWFuZFR5cGUuaWNvbicsIGNvbW1lbnQ6IFsnZG8gbm90IHRyYW5zbGF0ZSBvciBjaGFuZ2UgYFxcXFwkKHphcClgLCBcXFxcIGluIGZyb250IG9mICQgaXMgaW1wb3J0YW50LiddIH0sICcoT3B0aW9uYWwpIEljb24gd2hpY2ggaXMgdXNlZCB0byByZXByZXNlbnQgdGhlIGNvbW1hbmQgaW4gdGhlIFVJLiBFaXRoZXIgYSBmaWxlIHBhdGgsIGFuIG9iamVjdCB3aXRoIGZpbGUgcGF0aHMgZm9yIGRhcmsgYW5kIGxpZ2h0IHRoZW1lcywgb3IgYSB0aGVtZSBpY29uIHJlZmVyZW5jZXMsIGxpa2UgYFxcXFwkKHphcClgJyksXG5cdFx0XHRcdGFueU9mOiBbe1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRsaWdodDoge1xuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuY29tbWFuZFR5cGUuaWNvbi5saWdodCcsICdJY29uIHBhdGggd2hlbiBhIGxpZ2h0IHRoZW1lIGlzIHVzZWQnKSxcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRkYXJrOiB7XG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5jb21tYW5kVHlwZS5pY29uLmRhcmsnLCAnSWNvbiBwYXRoIHdoZW4gYSBkYXJrIHRoZW1lIGlzIHVzZWQnKSxcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1dXG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXG5cdGV4cG9ydCBjb25zdCBjb21tYW5kc0NvbnRyaWJ1dGlvbjogSUpTT05TY2hlbWEgPSB7XG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmNvbW1hbmRzJywgXCJDb250cmlidXRlcyBjb21tYW5kcyB0byB0aGUgY29tbWFuZCBwYWxldHRlLlwiKSxcblx0XHRvbmVPZjogW1xuXHRcdFx0Y29tbWFuZFR5cGUsXG5cdFx0XHR7XG5cdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdGl0ZW1zOiBjb21tYW5kVHlwZVxuXHRcdFx0fVxuXHRcdF1cblx0fTtcbn1cblxuY29uc3QgX2NvbW1hbmRSZWdpc3RyYXRpb25zID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5leHBvcnQgY29uc3QgY29tbWFuZHNFeHRlbnNpb25Qb2ludCA9IEV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PHNjaGVtYS5JVXNlckZyaWVuZGx5Q29tbWFuZCB8IHNjaGVtYS5JVXNlckZyaWVuZGx5Q29tbWFuZFtdPih7XG5cdGV4dGVuc2lvblBvaW50OiAnY29tbWFuZHMnLFxuXHRqc29uU2NoZW1hOiBzY2hlbWEuY29tbWFuZHNDb250cmlidXRpb24sXG5cdGFjdGl2YXRpb25FdmVudHNHZW5lcmF0b3I6IChjb250cmliczogc2NoZW1hLklVc2VyRnJpZW5kbHlDb21tYW5kW10sIHJlc3VsdDogeyBwdXNoKGl0ZW06IHN0cmluZyk6IHZvaWQgfSkgPT4ge1xuXHRcdGZvciAoY29uc3QgY29udHJpYiBvZiBjb250cmlicykge1xuXHRcdFx0aWYgKGNvbnRyaWIuY29tbWFuZCkge1xuXHRcdFx0XHRyZXN1bHQucHVzaChgb25Db21tYW5kOiR7Y29udHJpYi5jb21tYW5kfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbmNvbW1hbmRzRXh0ZW5zaW9uUG9pbnQuc2V0SGFuZGxlcihleHRlbnNpb25zID0+IHtcblxuXHRmdW5jdGlvbiBoYW5kbGVDb21tYW5kKHVzZXJGcmllbmRseUNvbW1hbmQ6IHNjaGVtYS5JVXNlckZyaWVuZGx5Q29tbWFuZCwgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uUG9pbnRVc2VyPGFueT4pIHtcblxuXHRcdGlmICghc2NoZW1hLmlzVmFsaWRDb21tYW5kKHVzZXJGcmllbmRseUNvbW1hbmQsIGV4dGVuc2lvbi5jb2xsZWN0b3IpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBpY29uLCBlbmFibGVtZW50LCBjYXRlZ29yeSwgdGl0bGUsIHNob3J0VGl0bGUsIGNvbW1hbmQgfSA9IHVzZXJGcmllbmRseUNvbW1hbmQ7XG5cblx0XHRsZXQgYWJzb2x1dGVJY29uOiB7IGRhcms6IFVSSTsgbGlnaHQ/OiBVUkkgfSB8IFRoZW1lSWNvbiB8IHVuZGVmaW5lZDtcblx0XHRpZiAoaWNvbikge1xuXHRcdFx0aWYgKHR5cGVvZiBpY29uID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRhYnNvbHV0ZUljb24gPSBUaGVtZUljb24uZnJvbVN0cmluZyhpY29uKSA/PyB7IGRhcms6IHJlc291cmNlcy5qb2luUGF0aChleHRlbnNpb24uZGVzY3JpcHRpb24uZXh0ZW5zaW9uTG9jYXRpb24sIGljb24pLCBsaWdodDogcmVzb3VyY2VzLmpvaW5QYXRoKGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5leHRlbnNpb25Mb2NhdGlvbiwgaWNvbikgfTtcblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YWJzb2x1dGVJY29uID0ge1xuXHRcdFx0XHRcdGRhcms6IHJlc291cmNlcy5qb2luUGF0aChleHRlbnNpb24uZGVzY3JpcHRpb24uZXh0ZW5zaW9uTG9jYXRpb24sIGljb24uZGFyayksXG5cdFx0XHRcdFx0bGlnaHQ6IHJlc291cmNlcy5qb2luUGF0aChleHRlbnNpb24uZGVzY3JpcHRpb24uZXh0ZW5zaW9uTG9jYXRpb24sIGljb24ubGlnaHQpXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXhpc3RpbmdDbWQgPSBNZW51UmVnaXN0cnkuZ2V0Q29tbWFuZChjb21tYW5kKTtcblx0XHRpZiAoZXhpc3RpbmdDbWQpIHtcblx0XHRcdGlmIChleGlzdGluZ0NtZC5zb3VyY2UpIHtcblx0XHRcdFx0ZXh0ZW5zaW9uLmNvbGxlY3Rvci5pbmZvKGxvY2FsaXplKCdkdXAxJywgXCJDb21tYW5kIGB7MH1gIGFscmVhZHkgcmVnaXN0ZXJlZCBieSB7MX0gKHsyfSlcIiwgdXNlckZyaWVuZGx5Q29tbWFuZC5jb21tYW5kLCBleGlzdGluZ0NtZC5zb3VyY2UudGl0bGUsIGV4aXN0aW5nQ21kLnNvdXJjZS5pZCkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZXh0ZW5zaW9uLmNvbGxlY3Rvci5pbmZvKGxvY2FsaXplKCdkdXAwJywgXCJDb21tYW5kIGB7MH1gIGFscmVhZHkgcmVnaXN0ZXJlZFwiLCB1c2VyRnJpZW5kbHlDb21tYW5kLmNvbW1hbmQpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0X2NvbW1hbmRSZWdpc3RyYXRpb25zLmFkZChNZW51UmVnaXN0cnkuYWRkQ29tbWFuZCh7XG5cdFx0XHRpZDogY29tbWFuZCxcblx0XHRcdHRpdGxlLFxuXHRcdFx0c291cmNlOiB7IGlkOiBleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZSwgdGl0bGU6IGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5kaXNwbGF5TmFtZSA/PyBleHRlbnNpb24uZGVzY3JpcHRpb24ubmFtZSB9LFxuXHRcdFx0c2hvcnRUaXRsZSxcblx0XHRcdHRvb2x0aXA6IHRpdGxlLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmRlc2VyaWFsaXplKGVuYWJsZW1lbnQpLFxuXHRcdFx0aWNvbjogYWJzb2x1dGVJY29uXG5cdFx0fSkpO1xuXHR9XG5cblx0Ly8gcmVtb3ZlIGFsbCBwcmV2aW91cyBjb21tYW5kIHJlZ2lzdHJhdGlvbnNcblx0X2NvbW1hbmRSZWdpc3RyYXRpb25zLmNsZWFyKCk7XG5cblx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZXh0ZW5zaW9ucykge1xuXHRcdGNvbnN0IHsgdmFsdWUgfSA9IGV4dGVuc2lvbjtcblx0XHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcblx0XHRcdGZvciAoY29uc3QgY29tbWFuZCBvZiB2YWx1ZSkge1xuXHRcdFx0XHRoYW5kbGVDb21tYW5kKGNvbW1hbmQsIGV4dGVuc2lvbik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGhhbmRsZUNvbW1hbmQodmFsdWUsIGV4dGVuc2lvbik7XG5cdFx0fVxuXHR9XG59KTtcblxuaW50ZXJmYWNlIElSZWdpc3RlcmVkU3VibWVudSB7XG5cdHJlYWRvbmx5IGlkOiBNZW51SWQ7XG5cdHJlYWRvbmx5IGxhYmVsOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGljb24/OiB7IGRhcms6IFVSSTsgbGlnaHQ/OiBVUkkgfSB8IFRoZW1lSWNvbjtcbn1cblxuY29uc3QgX3N1Ym1lbnVzID0gbmV3IE1hcDxzdHJpbmcsIElSZWdpc3RlcmVkU3VibWVudT4oKTtcblxuY29uc3Qgc3VibWVudXNFeHRlbnNpb25Qb2ludCA9IEV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PHNjaGVtYS5JVXNlckZyaWVuZGx5U3VibWVudVtdPih7XG5cdGV4dGVuc2lvblBvaW50OiAnc3VibWVudXMnLFxuXHRqc29uU2NoZW1hOiBzY2hlbWEuc3VibWVudXNDb250cmlidXRpb25cbn0pO1xuXG5zdWJtZW51c0V4dGVuc2lvblBvaW50LnNldEhhbmRsZXIoZXh0ZW5zaW9ucyA9PiB7XG5cblx0X3N1Ym1lbnVzLmNsZWFyKCk7XG5cblx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZXh0ZW5zaW9ucykge1xuXHRcdGNvbnN0IHsgdmFsdWUsIGNvbGxlY3RvciB9ID0gZXh0ZW5zaW9uO1xuXG5cdFx0Zm9yIChjb25zdCBbLCBzdWJtZW51SW5mb10gb2YgT2JqZWN0LmVudHJpZXModmFsdWUpKSB7XG5cblx0XHRcdGlmICghc2NoZW1hLmlzVmFsaWRTdWJtZW51KHN1Ym1lbnVJbmZvLCBjb2xsZWN0b3IpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXN1Ym1lbnVJbmZvLmlkKSB7XG5cdFx0XHRcdGNvbGxlY3Rvci53YXJuKGxvY2FsaXplKCdzdWJtZW51SWQuaW52YWxpZC5pZCcsIFwiYHswfWAgaXMgbm90IGEgdmFsaWQgc3VibWVudSBpZGVudGlmaWVyXCIsIHN1Ym1lbnVJbmZvLmlkKSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKF9zdWJtZW51cy5oYXMoc3VibWVudUluZm8uaWQpKSB7XG5cdFx0XHRcdGNvbGxlY3Rvci5pbmZvKGxvY2FsaXplKCdzdWJtZW51SWQuZHVwbGljYXRlLmlkJywgXCJUaGUgYHswfWAgc3VibWVudSB3YXMgYWxyZWFkeSBwcmV2aW91c2x5IHJlZ2lzdGVyZWQuXCIsIHN1Ym1lbnVJbmZvLmlkKSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFzdWJtZW51SW5mby5sYWJlbCkge1xuXHRcdFx0XHRjb2xsZWN0b3Iud2Fybihsb2NhbGl6ZSgnc3VibWVudUlkLmludmFsaWQubGFiZWwnLCBcImB7MH1gIGlzIG5vdCBhIHZhbGlkIHN1Ym1lbnUgbGFiZWxcIiwgc3VibWVudUluZm8ubGFiZWwpKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGxldCBhYnNvbHV0ZUljb246IHsgZGFyazogVVJJOyBsaWdodD86IFVSSSB9IHwgVGhlbWVJY29uIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHN1Ym1lbnVJbmZvLmljb24pIHtcblx0XHRcdFx0aWYgKHR5cGVvZiBzdWJtZW51SW5mby5pY29uID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGFic29sdXRlSWNvbiA9IFRoZW1lSWNvbi5mcm9tU3RyaW5nKHN1Ym1lbnVJbmZvLmljb24pIHx8IHsgZGFyazogcmVzb3VyY2VzLmpvaW5QYXRoKGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5leHRlbnNpb25Mb2NhdGlvbiwgc3VibWVudUluZm8uaWNvbikgfTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhYnNvbHV0ZUljb24gPSB7XG5cdFx0XHRcdFx0XHRkYXJrOiByZXNvdXJjZXMuam9pblBhdGgoZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmV4dGVuc2lvbkxvY2F0aW9uLCBzdWJtZW51SW5mby5pY29uLmRhcmspLFxuXHRcdFx0XHRcdFx0bGlnaHQ6IHJlc291cmNlcy5qb2luUGF0aChleHRlbnNpb24uZGVzY3JpcHRpb24uZXh0ZW5zaW9uTG9jYXRpb24sIHN1Ym1lbnVJbmZvLmljb24ubGlnaHQpXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpdGVtOiBJUmVnaXN0ZXJlZFN1Ym1lbnUgPSB7XG5cdFx0XHRcdGlkOiBNZW51SWQuZm9yKGBhcGk6JHtzdWJtZW51SW5mby5pZH1gKSxcblx0XHRcdFx0bGFiZWw6IHN1Ym1lbnVJbmZvLmxhYmVsLFxuXHRcdFx0XHRpY29uOiBhYnNvbHV0ZUljb25cblx0XHRcdH07XG5cblx0XHRcdF9zdWJtZW51cy5zZXQoc3VibWVudUluZm8uaWQsIGl0ZW0pO1xuXHRcdH1cblx0fVxufSk7XG5cbmNvbnN0IF9hcGlNZW51c0J5S2V5ID0gbmV3IE1hcChhcGlNZW51cy5tYXAobWVudSA9PiAoW21lbnUua2V5LCBtZW51XSkpKTtcbmNvbnN0IF9tZW51UmVnaXN0cmF0aW9ucyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcbmNvbnN0IF9zdWJtZW51TWVudUl0ZW1zID0gbmV3IE1hcDxzdHJpbmcgLyogbWVudSBpZCAqLywgU2V0PHN0cmluZyAvKiBzdWJtZW51IGlkICovPj4oKTtcblxuY29uc3QgbWVudXNFeHRlbnNpb25Qb2ludCA9IEV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PHsgW2xvYzogc3RyaW5nXTogKHNjaGVtYS5JVXNlckZyaWVuZGx5TWVudUl0ZW0gfCBzY2hlbWEuSVVzZXJGcmllbmRseVN1Ym1lbnVJdGVtKVtdIH0+KHtcblx0ZXh0ZW5zaW9uUG9pbnQ6ICdtZW51cycsXG5cdGpzb25TY2hlbWE6IHNjaGVtYS5tZW51c0NvbnRyaWJ1dGlvbixcblx0ZGVwczogW3N1Ym1lbnVzRXh0ZW5zaW9uUG9pbnRdXG59KTtcblxubWVudXNFeHRlbnNpb25Qb2ludC5zZXRIYW5kbGVyKGV4dGVuc2lvbnMgPT4ge1xuXG5cdC8vIHJlbW92ZSBhbGwgcHJldmlvdXMgbWVudSByZWdpc3RyYXRpb25zXG5cdF9tZW51UmVnaXN0cmF0aW9ucy5jbGVhcigpO1xuXHRfc3VibWVudU1lbnVJdGVtcy5jbGVhcigpO1xuXG5cdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGV4dGVuc2lvbnMpIHtcblx0XHRjb25zdCB7IHZhbHVlLCBjb2xsZWN0b3IgfSA9IGV4dGVuc2lvbjtcblxuXHRcdGZvciAoY29uc3QgZW50cnkgb2YgT2JqZWN0LmVudHJpZXModmFsdWUpKSB7XG5cdFx0XHRpZiAoIXNjaGVtYS5pc1ZhbGlkSXRlbXMoZW50cnlbMV0sIGNvbGxlY3RvcikpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGxldCBtZW51ID0gX2FwaU1lbnVzQnlLZXkuZ2V0KGVudHJ5WzBdKTtcblxuXHRcdFx0aWYgKCFtZW51KSB7XG5cdFx0XHRcdGNvbnN0IHN1Ym1lbnUgPSBfc3VibWVudXMuZ2V0KGVudHJ5WzBdKTtcblxuXHRcdFx0XHRpZiAoc3VibWVudSkge1xuXHRcdFx0XHRcdG1lbnUgPSB7XG5cdFx0XHRcdFx0XHRrZXk6IGVudHJ5WzBdLFxuXHRcdFx0XHRcdFx0aWQ6IHN1Ym1lbnUuaWQsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJydcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICghbWVudSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG1lbnUucHJvcG9zZWQgJiYgIWlzUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbi5kZXNjcmlwdGlvbiwgbWVudS5wcm9wb3NlZCkpIHtcblx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKGxvY2FsaXplKCdwcm9wb3NlZEFQSS5pbnZhbGlkJywgXCJ7MH0gaXMgYSBwcm9wb3NlZCBtZW51IGlkZW50aWZpZXIuIEl0IHJlcXVpcmVzICdwYWNrYWdlLmpzb24jZW5hYmxlZEFwaVByb3Bvc2FsczogW1xcXCJ7MX1cXFwiXScgYW5kIGlzIG9ubHkgYXZhaWxhYmxlIHdoZW4gcnVubmluZyBvdXQgb2YgZGV2IG9yIHdpdGggdGhlIGZvbGxvd2luZyBjb21tYW5kIGxpbmUgc3dpdGNoOiAtLWVuYWJsZS1wcm9wb3NlZC1hcGkgezJ9XCIsIGVudHJ5WzBdLCBtZW51LnByb3Bvc2VkLCBleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZSkpO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBtZW51SXRlbSBvZiBlbnRyeVsxXSkge1xuXHRcdFx0XHRsZXQgaXRlbTogSU1lbnVJdGVtIHwgSVN1Ym1lbnVJdGVtO1xuXG5cdFx0XHRcdGlmIChzY2hlbWEuaXNNZW51SXRlbShtZW51SXRlbSkpIHtcblx0XHRcdFx0XHRjb25zdCBjb21tYW5kID0gTWVudVJlZ2lzdHJ5LmdldENvbW1hbmQobWVudUl0ZW0uY29tbWFuZCk7XG5cdFx0XHRcdFx0Y29uc3QgYWx0ID0gbWVudUl0ZW0uYWx0ICYmIE1lbnVSZWdpc3RyeS5nZXRDb21tYW5kKG1lbnVJdGVtLmFsdCkgfHwgdW5kZWZpbmVkO1xuXG5cdFx0XHRcdFx0aWYgKCFjb21tYW5kKSB7XG5cdFx0XHRcdFx0XHRjb2xsZWN0b3IuZXJyb3IobG9jYWxpemUoJ21pc3NpbmcuY29tbWFuZCcsIFwiTWVudSBpdGVtIHJlZmVyZW5jZXMgYSBjb21tYW5kIGB7MH1gIHdoaWNoIGlzIG5vdCBkZWZpbmVkIGluIHRoZSAnY29tbWFuZHMnIHNlY3Rpb24uXCIsIG1lbnVJdGVtLmNvbW1hbmQpKTtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAobWVudUl0ZW0uYWx0ICYmICFhbHQpIHtcblx0XHRcdFx0XHRcdGNvbGxlY3Rvci53YXJuKGxvY2FsaXplKCdtaXNzaW5nLmFsdENvbW1hbmQnLCBcIk1lbnUgaXRlbSByZWZlcmVuY2VzIGFuIGFsdC1jb21tYW5kIGB7MH1gIHdoaWNoIGlzIG5vdCBkZWZpbmVkIGluIHRoZSAnY29tbWFuZHMnIHNlY3Rpb24uXCIsIG1lbnVJdGVtLmFsdCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAobWVudUl0ZW0uY29tbWFuZCA9PT0gbWVudUl0ZW0uYWx0KSB7XG5cdFx0XHRcdFx0XHRjb2xsZWN0b3IuaW5mbyhsb2NhbGl6ZSgnZHVwZS5jb21tYW5kJywgXCJNZW51IGl0ZW0gcmVmZXJlbmNlcyB0aGUgc2FtZSBjb21tYW5kIGFzIGRlZmF1bHQgYW5kIGFsdC1jb21tYW5kXCIpKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpdGVtID0geyBjb21tYW5kLCBhbHQsIGdyb3VwOiB1bmRlZmluZWQsIG9yZGVyOiB1bmRlZmluZWQsIHdoZW46IHVuZGVmaW5lZCB9O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmIChtZW51LnN1cHBvcnRzU3VibWVudXMgPT09IGZhbHNlKSB7XG5cdFx0XHRcdFx0XHRjb2xsZWN0b3IuZXJyb3IobG9jYWxpemUoJ3Vuc3VwcG9ydGVkLnN1Ym1lbnVyZWZlcmVuY2UnLCBcIk1lbnUgaXRlbSByZWZlcmVuY2VzIGEgc3VibWVudSBmb3IgYSBtZW51IHdoaWNoIGRvZXNuJ3QgaGF2ZSBzdWJtZW51IHN1cHBvcnQuXCIpKTtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IHN1Ym1lbnUgPSBfc3VibWVudXMuZ2V0KG1lbnVJdGVtLnN1Ym1lbnUpO1xuXG5cdFx0XHRcdFx0aWYgKCFzdWJtZW51KSB7XG5cdFx0XHRcdFx0XHRjb2xsZWN0b3IuZXJyb3IobG9jYWxpemUoJ21pc3Npbmcuc3VibWVudScsIFwiTWVudSBpdGVtIHJlZmVyZW5jZXMgYSBzdWJtZW51IGB7MH1gIHdoaWNoIGlzIG5vdCBkZWZpbmVkIGluIHRoZSAnc3VibWVudXMnIHNlY3Rpb24uXCIsIG1lbnVJdGVtLnN1Ym1lbnUpKTtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGxldCBzdWJtZW51UmVnaXN0cmF0aW9ucyA9IF9zdWJtZW51TWVudUl0ZW1zLmdldChtZW51LmlkLmlkKTtcblxuXHRcdFx0XHRcdGlmICghc3VibWVudVJlZ2lzdHJhdGlvbnMpIHtcblx0XHRcdFx0XHRcdHN1Ym1lbnVSZWdpc3RyYXRpb25zID0gbmV3IFNldCgpO1xuXHRcdFx0XHRcdFx0X3N1Ym1lbnVNZW51SXRlbXMuc2V0KG1lbnUuaWQuaWQsIHN1Ym1lbnVSZWdpc3RyYXRpb25zKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoc3VibWVudVJlZ2lzdHJhdGlvbnMuaGFzKHN1Ym1lbnUuaWQuaWQpKSB7XG5cdFx0XHRcdFx0XHRjb2xsZWN0b3Iud2Fybihsb2NhbGl6ZSgnc3VibWVudUl0ZW0uZHVwbGljYXRlJywgXCJUaGUgYHswfWAgc3VibWVudSB3YXMgYWxyZWFkeSBjb250cmlidXRlZCB0byB0aGUgYHsxfWAgbWVudS5cIiwgbWVudUl0ZW0uc3VibWVudSwgZW50cnlbMF0pKTtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHN1Ym1lbnVSZWdpc3RyYXRpb25zLmFkZChzdWJtZW51LmlkLmlkKTtcblxuXHRcdFx0XHRcdGl0ZW0gPSB7IHN1Ym1lbnU6IHN1Ym1lbnUuaWQsIGljb246IHN1Ym1lbnUuaWNvbiwgdGl0bGU6IHN1Ym1lbnUubGFiZWwsIGdyb3VwOiB1bmRlZmluZWQsIG9yZGVyOiB1bmRlZmluZWQsIHdoZW46IHVuZGVmaW5lZCB9O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKG1lbnVJdGVtLmdyb3VwKSB7XG5cdFx0XHRcdFx0Y29uc3QgaWR4ID0gbWVudUl0ZW0uZ3JvdXAubGFzdEluZGV4T2YoJ0AnKTtcblx0XHRcdFx0XHRpZiAoaWR4ID4gMCkge1xuXHRcdFx0XHRcdFx0aXRlbS5ncm91cCA9IG1lbnVJdGVtLmdyb3VwLnN1YnN0cigwLCBpZHgpO1xuXHRcdFx0XHRcdFx0aXRlbS5vcmRlciA9IE51bWJlcihtZW51SXRlbS5ncm91cC5zdWJzdHIoaWR4ICsgMSkpIHx8IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aXRlbS5ncm91cCA9IG1lbnVJdGVtLmdyb3VwO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChtZW51LmlkID09PSBNZW51SWQuVmlld0NvbnRhaW5lclRpdGxlICYmICFtZW51SXRlbS53aGVuPy5pbmNsdWRlcygndmlld0NvbnRhaW5lciA9PSB3b3JrYmVuY2gudmlldy5kZWJ1ZycpKSB7XG5cdFx0XHRcdFx0Ly8gTm90IGEgcGVyZmVjdCBjaGVjayBidXQgZW5vdWdoIHRvIGNvbW11bmljYXRlIHRoYXQgdGhpcyBwcm9wb3NlZCBleHRlbnNpb24gcG9pbnQgaXMgY3VycmVudGx5IG9ubHkgZm9yIHRoZSBkZWJ1ZyB2aWV3IGNvbnRhaW5lclxuXHRcdFx0XHRcdGNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgndmlld0NvbnRhaW5lclRpdGxlLndoZW4nLCBcIlRoZSB7MH0gbWVudSBjb250cmlidXRpb24gbXVzdCBjaGVjayB7MX0gaW4gaXRzIHsyfSBjbGF1c2UuXCIsICdgdmlld0NvbnRhaW5lci90aXRsZWAnLCAnYHZpZXdDb250YWluZXIgPT0gd29ya2JlbmNoLnZpZXcuZGVidWdgJywgJ1wid2hlblwiJykpO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aXRlbS53aGVuID0gQ29udGV4dEtleUV4cHIuZGVzZXJpYWxpemUobWVudUl0ZW0ud2hlbik7XG5cdFx0XHRcdF9tZW51UmVnaXN0cmF0aW9ucy5hZGQoTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKG1lbnUuaWQsIGl0ZW0pKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuXG5jbGFzcyBDb21tYW5kc1RhYmxlUmVuZGVyZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUV4dGVuc2lvbkZlYXR1cmVUYWJsZVJlbmRlcmVyIHtcblxuXHRyZWFkb25seSB0eXBlID0gJ3RhYmxlJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2Vcblx0KSB7IHN1cGVyKCk7IH1cblxuXHRzaG91bGRSZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIW1hbmlmZXN0LmNvbnRyaWJ1dGVzPy5jb21tYW5kcztcblx0fVxuXG5cdHJlbmRlcihtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0KTogSVJlbmRlcmVkRGF0YTxJVGFibGVEYXRhPiB7XG5cdFx0Y29uc3QgcmF3Q29tbWFuZHMgPSBtYW5pZmVzdC5jb250cmlidXRlcz8uY29tbWFuZHMgfHwgW107XG5cdFx0Y29uc3QgY29tbWFuZHMgPSByYXdDb21tYW5kcy5tYXAoYyA9PiAoe1xuXHRcdFx0aWQ6IGMuY29tbWFuZCxcblx0XHRcdHRpdGxlOiBjLnRpdGxlLFxuXHRcdFx0a2V5YmluZGluZ3M6IFtdIGFzIFJlc29sdmVkS2V5YmluZGluZ1tdLFxuXHRcdFx0bWVudXM6IFtdIGFzIHN0cmluZ1tdXG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgYnlJZCA9IGluZGV4KGNvbW1hbmRzLCBjID0+IGMuaWQpO1xuXG5cdFx0Y29uc3QgbWVudXMgPSBtYW5pZmVzdC5jb250cmlidXRlcz8ubWVudXMgfHwge307XG5cblx0XHQvLyBBZGQgdG8gY29tbWFuZFBhbGV0dGUgYXJyYXkgYW55IGNvbW1hbmRzIG5vdCBleHBsaWNpdGx5IGNvbnRyaWJ1dGVkIHRvIGl0XG5cdFx0Y29uc3QgaW1wbGljaXRseU9uQ29tbWFuZFBhbGV0dGUgPSBpbmRleChjb21tYW5kcywgYyA9PiBjLmlkKTtcblx0XHRpZiAobWVudXNbJ2NvbW1hbmRQYWxldHRlJ10pIHtcblx0XHRcdGZvciAoY29uc3QgY29tbWFuZCBvZiBtZW51c1snY29tbWFuZFBhbGV0dGUnXSkge1xuXHRcdFx0XHRkZWxldGUgaW1wbGljaXRseU9uQ29tbWFuZFBhbGV0dGVbY29tbWFuZC5jb21tYW5kXTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoT2JqZWN0LmtleXMoaW1wbGljaXRseU9uQ29tbWFuZFBhbGV0dGUpLmxlbmd0aCkge1xuXHRcdFx0aWYgKCFtZW51c1snY29tbWFuZFBhbGV0dGUnXSkge1xuXHRcdFx0XHRtZW51c1snY29tbWFuZFBhbGV0dGUnXSA9IFtdO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCBjb21tYW5kIGluIGltcGxpY2l0bHlPbkNvbW1hbmRQYWxldHRlKSB7XG5cdFx0XHRcdG1lbnVzWydjb21tYW5kUGFsZXR0ZSddLnB1c2goeyBjb21tYW5kIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgY29udGV4dCBpbiBtZW51cykge1xuXHRcdFx0Zm9yIChjb25zdCBtZW51IG9mIG1lbnVzW2NvbnRleHRdKSB7XG5cblx0XHRcdFx0Ly8gVGhpcyB0eXBpY2FsbHkgaGFwcGVucyBmb3IgdGhlIGNvbW1hbmRQYWxldHRlIGNvbnRleHRcblx0XHRcdFx0aWYgKG1lbnUud2hlbiA9PT0gJ2ZhbHNlJykge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChtZW51LmNvbW1hbmQpIHtcblx0XHRcdFx0XHRsZXQgY29tbWFuZCA9IGJ5SWRbbWVudS5jb21tYW5kXTtcblx0XHRcdFx0XHRpZiAoY29tbWFuZCkge1xuXHRcdFx0XHRcdFx0aWYgKCFjb21tYW5kLm1lbnVzLmluY2x1ZGVzKGNvbnRleHQpKSB7XG5cdFx0XHRcdFx0XHRcdGNvbW1hbmQubWVudXMucHVzaChjb250ZXh0KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y29tbWFuZCA9IHsgaWQ6IG1lbnUuY29tbWFuZCwgdGl0bGU6ICcnLCBrZXliaW5kaW5nczogW10sIG1lbnVzOiBbY29udGV4dF0gfTtcblx0XHRcdFx0XHRcdGJ5SWRbY29tbWFuZC5pZF0gPSBjb21tYW5kO1xuXHRcdFx0XHRcdFx0Y29tbWFuZHMucHVzaChjb21tYW5kKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCByYXdLZXliaW5kaW5ncyA9IG1hbmlmZXN0LmNvbnRyaWJ1dGVzPy5rZXliaW5kaW5ncyA/IChBcnJheS5pc0FycmF5KG1hbmlmZXN0LmNvbnRyaWJ1dGVzLmtleWJpbmRpbmdzKSA/IG1hbmlmZXN0LmNvbnRyaWJ1dGVzLmtleWJpbmRpbmdzIDogW21hbmlmZXN0LmNvbnRyaWJ1dGVzLmtleWJpbmRpbmdzXSkgOiBbXTtcblxuXHRcdHJhd0tleWJpbmRpbmdzLmZvckVhY2gocmF3S2V5YmluZGluZyA9PiB7XG5cdFx0XHRjb25zdCBrZXliaW5kaW5nID0gdGhpcy5yZXNvbHZlS2V5YmluZGluZyhyYXdLZXliaW5kaW5nKTtcblxuXHRcdFx0aWYgKCFrZXliaW5kaW5nKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bGV0IGNvbW1hbmQgPSBieUlkW3Jhd0tleWJpbmRpbmcuY29tbWFuZF07XG5cblx0XHRcdGlmIChjb21tYW5kKSB7XG5cdFx0XHRcdGNvbW1hbmQua2V5YmluZGluZ3MucHVzaChrZXliaW5kaW5nKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbW1hbmQgPSB7IGlkOiByYXdLZXliaW5kaW5nLmNvbW1hbmQsIHRpdGxlOiAnJywga2V5YmluZGluZ3M6IFtrZXliaW5kaW5nXSwgbWVudXM6IFtdIH07XG5cdFx0XHRcdGJ5SWRbY29tbWFuZC5pZF0gPSBjb21tYW5kO1xuXHRcdFx0XHRjb21tYW5kcy5wdXNoKGNvbW1hbmQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0aWYgKCFjb21tYW5kcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB7IGRhdGE6IHsgaGVhZGVyczogW10sIHJvd3M6IFtdIH0sIGRpc3Bvc2U6ICgpID0+IHsgfSB9O1xuXHRcdH1cblxuXHRcdGNvbnN0IGhlYWRlcnMgPSBbXG5cdFx0XHRsb2NhbGl6ZSgnY29tbWFuZCBuYW1lJywgXCJJRFwiKSxcblx0XHRcdGxvY2FsaXplKCdjb21tYW5kIHRpdGxlJywgXCJUaXRsZVwiKSxcblx0XHRcdGxvY2FsaXplKCdrZXlib2FyZCBzaG9ydGN1dHMnLCBcIktleWJvYXJkIFNob3J0Y3V0c1wiKSxcblx0XHRcdGxvY2FsaXplKCdtZW51Q29udGV4dHMnLCBcIk1lbnUgQ29udGV4dHNcIilcblx0XHRdO1xuXG5cdFx0Y29uc3Qgcm93czogSVJvd0RhdGFbXVtdID0gY29tbWFuZHMuc29ydCgoYSwgYikgPT4gYS5pZC5sb2NhbGVDb21wYXJlKGIuaWQpKVxuXHRcdFx0Lm1hcChjb21tYW5kID0+IHtcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRuZXcgTWFya2Rvd25TdHJpbmcoKS5hcHBlbmRNYXJrZG93bihgXFxgJHtjb21tYW5kLmlkfVxcYGApLFxuXHRcdFx0XHRcdHR5cGVvZiBjb21tYW5kLnRpdGxlID09PSAnc3RyaW5nJyA/IGNvbW1hbmQudGl0bGUgOiBjb21tYW5kLnRpdGxlLnZhbHVlLFxuXHRcdFx0XHRcdGNvbW1hbmQua2V5YmluZGluZ3MsXG5cdFx0XHRcdFx0bmV3IE1hcmtkb3duU3RyaW5nKCkuYXBwZW5kTWFya2Rvd24oYCR7Y29tbWFuZC5tZW51cy5zb3J0KChhLCBiKSA9PiBhLmxvY2FsZUNvbXBhcmUoYikpLm1hcChtZW51ID0+IGBcXGAke21lbnV9XFxgYCkuam9pbignJm5ic3A7Jyl9YCksXG5cdFx0XHRcdF07XG5cdFx0XHR9KTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRkYXRhOiB7XG5cdFx0XHRcdGhlYWRlcnMsXG5cdFx0XHRcdHJvd3Ncblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7IH1cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlS2V5YmluZGluZyhyYXdLZXlCaW5kaW5nOiBJS2V5QmluZGluZyk6IFJlc29sdmVkS2V5YmluZGluZyB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IGtleTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdFx0c3dpdGNoIChwbGF0Zm9ybSkge1xuXHRcdFx0Y2FzZSAnd2luMzInOiBrZXkgPSByYXdLZXlCaW5kaW5nLndpbjsgYnJlYWs7XG5cdFx0XHRjYXNlICdsaW51eCc6IGtleSA9IHJhd0tleUJpbmRpbmcubGludXg7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnZGFyd2luJzoga2V5ID0gcmF3S2V5QmluZGluZy5tYWM7IGJyZWFrO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9rZXliaW5kaW5nU2VydmljZS5yZXNvbHZlVXNlckJpbmRpbmcoa2V5ID8/IHJhd0tleUJpbmRpbmcua2V5KVswXTtcblx0fVxuXG59XG5cblJlZ2lzdHJ5LmFzPElFeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5PihFeHRlbnNpb25GZWF0dXJlc0V4dGVuc2lvbnMuRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeSkucmVnaXN0ZXJFeHRlbnNpb25GZWF0dXJlKHtcblx0aWQ6ICdjb21tYW5kcycsXG5cdGxhYmVsOiBsb2NhbGl6ZSgnY29tbWFuZHMnLCBcIkNvbW1hbmRzXCIpLFxuXHRhY2Nlc3M6IHtcblx0XHRjYW5Ub2dnbGU6IGZhbHNlLFxuXHR9LFxuXHRyZW5kZXJlcjogbmV3IFN5bmNEZXNjcmlwdG9yKENvbW1hbmRzVGFibGVSZW5kZXJlciksXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUywyQkFBMkI7QUFDcEMsWUFBWSxlQUFlO0FBRTNCLFNBQXlELDBCQUEwQjtBQUNuRixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFFBQVEsb0JBQTZDO0FBRTlELFNBQVMsWUFBWSx1QkFBdUI7QUFDNUMsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsNEJBQTRCO0FBRXJDLFNBQTBHLGNBQWMsbUNBQW1DO0FBRTNKLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsMEJBQTBCO0FBV25DLE1BQU0sV0FBdUI7QUFBQSxFQUM1QjtBQUFBLElBQ0MsS0FBSztBQUFBLElBQ0wsSUFBSSxPQUFPO0FBQUEsSUFDWCxhQUFhLFNBQVMsd0JBQXdCLHFCQUFxQjtBQUFBLElBQ25FLGtCQUFrQjtBQUFBLEVBQ25CO0FBQUEsRUFDQTtBQUFBLElBQ0MsS0FBSztBQUFBLElBQ0wsSUFBSSxPQUFPO0FBQUEsSUFDWCxh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QUUsRUFBRTtBQUFBLElBQzlEO0FBRUEsVUFBTSxVQUFVO0FBQUEsTUFDZixTQUFTLGdCQUFnQixJQUFJO0FBQUEsTUFDN0IsU0FBUyxpQkFBaUIsT0FBTztBQUFBLE1BQ2pDLFNBQVMsc0JBQXNCLG9CQUFvQjtBQUFBLE1BQ25ELFNBQVMsZ0JBQWdCLGVBQWU7QUFBQSxJQUN6QztBQUVBLFVBQU0sT0FBcUIsU0FBUyxLQUFLLENBQUMsR0FBRyxNQUFNLEVBQUUsR0FBRyxjQUFjLEVBQUUsRUFBRSxDQUFDLEVBQ3pFLElBQUksYUFBVztBQUNmLGFBQU87QUFBQSxRQUNOLElBQUksZUFBZSxFQUFFLGVBQWUsS0FBSyxRQUFRLEVBQUUsSUFBSTtBQUFBLFFBQ3ZELE9BQU8sUUFBUSxVQUFVLFdBQVcsUUFBUSxRQUFRLFFBQVEsTUFBTTtBQUFBLFFBQ2xFLFFBQVE7QUFBQSxRQUNSLElBQUksZUFBZSxFQUFFLGVBQWUsR0FBRyxRQUFRLE1BQU0sS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLGNBQWMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxVQUFRLEtBQUssSUFBSSxJQUFJLEVBQUUsS0FBSyxRQUFRLENBQUMsRUFBRTtBQUFBLE1BQ3BJO0FBQUEsSUFDRCxDQUFDO0FBRUYsV0FBTztBQUFBLE1BQ04sTUFBTTtBQUFBLFFBQ0w7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsU0FBUyxNQUFNO0FBQUEsTUFBRTtBQUFBLElBQ2xCO0FBQUEsRUFDRDtBQUFBLEVBRVEsa0JBQWtCLGVBQTREO0FBQ3JGLFFBQUk7QUFFSixZQUFRLFVBQVU7QUFBQSxNQUNqQixLQUFLO0FBQVMsY0FBTSxjQUFjO0FBQUs7QUFBQSxNQUN2QyxLQUFLO0FBQVMsY0FBTSxjQUFjO0FBQU87QUFBQSxNQUN6QyxLQUFLO0FBQVUsY0FBTSxjQUFjO0FBQUs7QUFBQSxJQUN6QztBQUVBLFdBQU8sS0FBSyxtQkFBbUIsbUJBQW1CLE9BQU8sY0FBYyxHQUFHLEVBQUUsQ0FBQztBQUFBLEVBQzlFO0FBRUQ7QUE5SE0sd0JBQU47QUFBQSxFQUtHO0FBQUEsR0FMRztBQWdJTixTQUFTLEdBQStCLDRCQUE0Qix5QkFBeUIsRUFBRSx5QkFBeUI7QUFBQSxFQUN2SCxJQUFJO0FBQUEsRUFDSixPQUFPLFNBQVMsWUFBWSxVQUFVO0FBQUEsRUFDdEMsUUFBUTtBQUFBLElBQ1AsV0FBVztBQUFBLEVBQ1o7QUFBQSxFQUNBLFVBQVUsSUFBSSxlQUFlLHFCQUFxQjtBQUNuRCxDQUFDOyIsCiAgIm5hbWVzIjogWyJzY2hlbWEiLCAic3VibWVudSJdCn0K
