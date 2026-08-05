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
import { SubmenuAction } from "../../../base/common/actions.js";
import { MicrotaskEmitter } from "../../../base/common/event.js";
import { DisposableStore, dispose, markAsSingleton, toDisposable } from "../../../base/common/lifecycle.js";
import { LinkedList } from "../../../base/common/linkedList.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { CommandsRegistry, ICommandService } from "../../commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService } from "../../contextkey/common/contextkey.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { KeybindingsRegistry } from "../../keybinding/common/keybindingsRegistry.js";
function isIMenuItem(item) {
  return item.command !== void 0;
}
function isISubmenuItem(item) {
  return item.submenu !== void 0;
}
const _MenuId = class _MenuId {
  /**
   * Create or reuse a `MenuId` with the given identifier
   */
  static for(identifier) {
    return _MenuId._instances.get(identifier) ?? new _MenuId(identifier);
  }
  /**
   * Create a new `MenuId` with the unique identifier. Will throw if a menu
   * with the identifier already exists, use `MenuId.for(ident)` or a unique
   * identifier
   */
  constructor(identifier) {
    if (_MenuId._instances.has(identifier)) {
      throw new TypeError(`MenuId with identifier '${identifier}' already exists. Use MenuId.for(ident) or a unique identifier`);
    }
    _MenuId._instances.set(identifier, this);
    this.id = identifier;
  }
};
_MenuId._instances = /* @__PURE__ */ new Map();
_MenuId.CommandPalette = new _MenuId("CommandPalette");
_MenuId.DebugBreakpointsContext = new _MenuId("DebugBreakpointsContext");
_MenuId.DebugCallStackContext = new _MenuId("DebugCallStackContext");
_MenuId.DebugConsoleContext = new _MenuId("DebugConsoleContext");
_MenuId.DebugVariablesContext = new _MenuId("DebugVariablesContext");
_MenuId.NotebookVariablesContext = new _MenuId("NotebookVariablesContext");
_MenuId.DebugHoverContext = new _MenuId("DebugHoverContext");
_MenuId.DebugWatchContext = new _MenuId("DebugWatchContext");
_MenuId.DebugToolBar = new _MenuId("DebugToolBar");
_MenuId.DebugToolBarStop = new _MenuId("DebugToolBarStop");
_MenuId.DebugCallStackToolbar = new _MenuId("DebugCallStackToolbar");
_MenuId.DebugCreateConfiguration = new _MenuId("DebugCreateConfiguration");
_MenuId.EditorContext = new _MenuId("EditorContext");
_MenuId.SimpleEditorContext = new _MenuId("SimpleEditorContext");
_MenuId.EditorContent = new _MenuId("EditorContent");
_MenuId.EditorLineNumberContext = new _MenuId("EditorLineNumberContext");
_MenuId.EditorContextCopy = new _MenuId("EditorContextCopy");
_MenuId.EditorContextPeek = new _MenuId("EditorContextPeek");
_MenuId.EditorContextShare = new _MenuId("EditorContextShare");
_MenuId.EditorTitle = new _MenuId("EditorTitle");
_MenuId.EditorTitleRun = new _MenuId("EditorTitleRun");
_MenuId.EditorTitleContext = new _MenuId("EditorTitleContext");
_MenuId.EditorTitleContextShare = new _MenuId("EditorTitleContextShare");
_MenuId.EmptyEditorGroup = new _MenuId("EmptyEditorGroup");
_MenuId.EmptyEditorGroupContext = new _MenuId("EmptyEditorGroupContext");
_MenuId.EditorTabsBarContext = new _MenuId("EditorTabsBarContext");
_MenuId.EditorTabsBarShowTabsSubmenu = new _MenuId("EditorTabsBarShowTabsSubmenu");
_MenuId.EditorTabsBarShowTabsZenModeSubmenu = new _MenuId("EditorTabsBarShowTabsZenModeSubmenu");
_MenuId.EditorActionsPositionSubmenu = new _MenuId("EditorActionsPositionSubmenu");
_MenuId.ExplorerContext = new _MenuId("ExplorerContext");
_MenuId.ExplorerContextShare = new _MenuId("ExplorerContextShare");
_MenuId.ExtensionContext = new _MenuId("ExtensionContext");
_MenuId.ExtensionEditorContextMenu = new _MenuId("ExtensionEditorContextMenu");
_MenuId.GlobalActivity = new _MenuId("GlobalActivity");
_MenuId.CommandCenter = new _MenuId("CommandCenter");
_MenuId.CommandCenterCenter = new _MenuId("CommandCenterCenter");
_MenuId.LayoutControlMenuSubmenu = new _MenuId("LayoutControlMenuSubmenu");
_MenuId.LayoutControlMenu = new _MenuId("LayoutControlMenu");
_MenuId.MenubarMainMenu = new _MenuId("MenubarMainMenu");
_MenuId.MenubarAppearanceMenu = new _MenuId("MenubarAppearanceMenu");
_MenuId.MenubarDebugMenu = new _MenuId("MenubarDebugMenu");
_MenuId.MenubarEditMenu = new _MenuId("MenubarEditMenu");
_MenuId.MenubarCopy = new _MenuId("MenubarCopy");
_MenuId.MenubarFileMenu = new _MenuId("MenubarFileMenu");
_MenuId.MenubarGoMenu = new _MenuId("MenubarGoMenu");
_MenuId.MenubarHelpMenu = new _MenuId("MenubarHelpMenu");
_MenuId.MenubarLayoutMenu = new _MenuId("MenubarLayoutMenu");
_MenuId.MenubarNewBreakpointMenu = new _MenuId("MenubarNewBreakpointMenu");
_MenuId.PanelAlignmentMenu = new _MenuId("PanelAlignmentMenu");
_MenuId.PanelPositionMenu = new _MenuId("PanelPositionMenu");
_MenuId.ActivityBarPositionMenu = new _MenuId("ActivityBarPositionMenu");
_MenuId.MenubarPreferencesMenu = new _MenuId("MenubarPreferencesMenu");
_MenuId.MenubarRecentMenu = new _MenuId("MenubarRecentMenu");
_MenuId.MenubarSelectionMenu = new _MenuId("MenubarSelectionMenu");
_MenuId.MenubarShare = new _MenuId("MenubarShare");
_MenuId.MenubarSwitchEditorMenu = new _MenuId("MenubarSwitchEditorMenu");
_MenuId.MenubarSwitchGroupMenu = new _MenuId("MenubarSwitchGroupMenu");
_MenuId.MenubarTerminalMenu = new _MenuId("MenubarTerminalMenu");
_MenuId.MenubarTerminalSuggestStatusMenu = new _MenuId("MenubarTerminalSuggestStatusMenu");
_MenuId.MenubarViewMenu = new _MenuId("MenubarViewMenu");
_MenuId.MenubarHomeMenu = new _MenuId("MenubarHomeMenu");
_MenuId.OpenEditorsContext = new _MenuId("OpenEditorsContext");
_MenuId.OpenEditorsContextShare = new _MenuId("OpenEditorsContextShare");
_MenuId.ProblemsPanelContext = new _MenuId("ProblemsPanelContext");
_MenuId.SCMInputBox = new _MenuId("SCMInputBox");
_MenuId.SCMChangeContext = new _MenuId("SCMChangeContext");
_MenuId.SCMResourceContext = new _MenuId("SCMResourceContext");
_MenuId.SCMResourceContextShare = new _MenuId("SCMResourceContextShare");
_MenuId.SCMResourceFolderContext = new _MenuId("SCMResourceFolderContext");
_MenuId.SCMResourceGroupContext = new _MenuId("SCMResourceGroupContext");
_MenuId.SCMSourceControl = new _MenuId("SCMSourceControl");
_MenuId.SCMSourceControlInline = new _MenuId("SCMSourceControlInline");
_MenuId.SCMSourceControlTitle = new _MenuId("SCMSourceControlTitle");
_MenuId.SCMHistoryTitle = new _MenuId("SCMHistoryTitle");
_MenuId.SCMHistoryItemContext = new _MenuId("SCMHistoryItemContext");
_MenuId.SCMHistoryItemHover = new _MenuId("SCMHistoryItemHover");
_MenuId.SCMHistoryItemRefContext = new _MenuId("SCMHistoryItemRefContext");
_MenuId.SCMTitle = new _MenuId("SCMTitle");
_MenuId.SearchContext = new _MenuId("SearchContext");
_MenuId.SearchActionMenu = new _MenuId("SearchActionContext");
_MenuId.StatusBarWindowIndicatorMenu = new _MenuId("StatusBarWindowIndicatorMenu");
_MenuId.StatusBarRemoteIndicatorMenu = new _MenuId("StatusBarRemoteIndicatorMenu");
_MenuId.StickyScrollContext = new _MenuId("StickyScrollContext");
_MenuId.TestItem = new _MenuId("TestItem");
_MenuId.TestItemGutter = new _MenuId("TestItemGutter");
_MenuId.TestProfilesContext = new _MenuId("TestProfilesContext");
_MenuId.TestMessageContext = new _MenuId("TestMessageContext");
_MenuId.TestMessageContent = new _MenuId("TestMessageContent");
_MenuId.TestPeekElement = new _MenuId("TestPeekElement");
_MenuId.TestPeekTitle = new _MenuId("TestPeekTitle");
_MenuId.TestCallStack = new _MenuId("TestCallStack");
_MenuId.TestCoverageFilterItem = new _MenuId("TestCoverageFilterItem");
_MenuId.TouchBarContext = new _MenuId("TouchBarContext");
_MenuId.TitleBar = new _MenuId("TitleBar");
_MenuId.TitleBarContext = new _MenuId("TitleBarContext");
_MenuId.TitleBarTitleContext = new _MenuId("TitleBarTitleContext");
_MenuId.TunnelContext = new _MenuId("TunnelContext");
_MenuId.TunnelPrivacy = new _MenuId("TunnelPrivacy");
_MenuId.TunnelProtocol = new _MenuId("TunnelProtocol");
_MenuId.TunnelPortInline = new _MenuId("TunnelInline");
_MenuId.TunnelTitle = new _MenuId("TunnelTitle");
_MenuId.TunnelLocalAddressInline = new _MenuId("TunnelLocalAddressInline");
_MenuId.TunnelOriginInline = new _MenuId("TunnelOriginInline");
_MenuId.ViewItemContext = new _MenuId("ViewItemContext");
_MenuId.ViewContainerTitle = new _MenuId("ViewContainerTitle");
_MenuId.ViewContainerTitleContext = new _MenuId("ViewContainerTitleContext");
_MenuId.ViewTitle = new _MenuId("ViewTitle");
_MenuId.ViewTitleContext = new _MenuId("ViewTitleContext");
_MenuId.CommentEditorActions = new _MenuId("CommentEditorActions");
_MenuId.CommentThreadTitle = new _MenuId("CommentThreadTitle");
_MenuId.CommentThreadActions = new _MenuId("CommentThreadActions");
_MenuId.CommentThreadAdditionalActions = new _MenuId("CommentThreadAdditionalActions");
_MenuId.CommentThreadTitleContext = new _MenuId("CommentThreadTitleContext");
_MenuId.CommentThreadCommentContext = new _MenuId("CommentThreadCommentContext");
_MenuId.CommentTitle = new _MenuId("CommentTitle");
_MenuId.CommentActions = new _MenuId("CommentActions");
_MenuId.CommentsViewThreadActions = new _MenuId("CommentsViewThreadActions");
_MenuId.InteractiveToolbar = new _MenuId("InteractiveToolbar");
_MenuId.InteractiveCellTitle = new _MenuId("InteractiveCellTitle");
_MenuId.InteractiveCellDelete = new _MenuId("InteractiveCellDelete");
_MenuId.InteractiveCellExecute = new _MenuId("InteractiveCellExecute");
_MenuId.InteractiveInputExecute = new _MenuId("InteractiveInputExecute");
_MenuId.InteractiveInputConfig = new _MenuId("InteractiveInputConfig");
_MenuId.ReplInputExecute = new _MenuId("ReplInputExecute");
_MenuId.IssueReporter = new _MenuId("IssueReporter");
_MenuId.NotebookToolbar = new _MenuId("NotebookToolbar");
_MenuId.NotebookToolbarContext = new _MenuId("NotebookToolbarContext");
_MenuId.NotebookStickyScrollContext = new _MenuId("NotebookStickyScrollContext");
_MenuId.NotebookCellTitle = new _MenuId("NotebookCellTitle");
_MenuId.NotebookCellDelete = new _MenuId("NotebookCellDelete");
_MenuId.NotebookCellInsert = new _MenuId("NotebookCellInsert");
_MenuId.NotebookCellBetween = new _MenuId("NotebookCellBetween");
_MenuId.NotebookCellListTop = new _MenuId("NotebookCellTop");
_MenuId.NotebookCellExecute = new _MenuId("NotebookCellExecute");
_MenuId.NotebookCellExecuteGoTo = new _MenuId("NotebookCellExecuteGoTo");
_MenuId.NotebookCellExecutePrimary = new _MenuId("NotebookCellExecutePrimary");
_MenuId.NotebookDiffCellInputTitle = new _MenuId("NotebookDiffCellInputTitle");
_MenuId.NotebookDiffDocumentMetadata = new _MenuId("NotebookDiffDocumentMetadata");
_MenuId.NotebookDiffCellMetadataTitle = new _MenuId("NotebookDiffCellMetadataTitle");
_MenuId.NotebookDiffCellOutputsTitle = new _MenuId("NotebookDiffCellOutputsTitle");
_MenuId.NotebookOutputToolbar = new _MenuId("NotebookOutputToolbar");
_MenuId.NotebookOutlineFilter = new _MenuId("NotebookOutlineFilter");
_MenuId.NotebookOutlineActionMenu = new _MenuId("NotebookOutlineActionMenu");
_MenuId.NotebookEditorLayoutConfigure = new _MenuId("NotebookEditorLayoutConfigure");
_MenuId.NotebookKernelSource = new _MenuId("NotebookKernelSource");
_MenuId.BulkEditTitle = new _MenuId("BulkEditTitle");
_MenuId.BulkEditContext = new _MenuId("BulkEditContext");
_MenuId.TimelineItemContext = new _MenuId("TimelineItemContext");
_MenuId.TimelineTitle = new _MenuId("TimelineTitle");
_MenuId.TimelineTitleContext = new _MenuId("TimelineTitleContext");
_MenuId.TimelineFilterSubMenu = new _MenuId("TimelineFilterSubMenu");
_MenuId.AccountsContext = new _MenuId("AccountsContext");
_MenuId.SidebarTitle = new _MenuId("SidebarTitle");
_MenuId.PanelTitle = new _MenuId("PanelTitle");
_MenuId.AuxiliaryBarTitle = new _MenuId("AuxiliaryBarTitle");
_MenuId.AuxiliaryBarHeader = new _MenuId("AuxiliaryBarHeader");
_MenuId.TerminalInstanceContext = new _MenuId("TerminalInstanceContext");
_MenuId.TerminalEditorInstanceContext = new _MenuId("TerminalEditorInstanceContext");
_MenuId.TerminalNewDropdownContext = new _MenuId("TerminalNewDropdownContext");
_MenuId.TerminalTabContext = new _MenuId("TerminalTabContext");
_MenuId.TerminalTabEmptyAreaContext = new _MenuId("TerminalTabEmptyAreaContext");
_MenuId.TerminalStickyScrollContext = new _MenuId("TerminalStickyScrollContext");
_MenuId.WebviewContext = new _MenuId("WebviewContext");
_MenuId.InlineCompletionsActions = new _MenuId("InlineCompletionsActions");
_MenuId.InlineEditsActions = new _MenuId("InlineEditsActions");
_MenuId.NewFile = new _MenuId("NewFile");
_MenuId.MergeInput1Toolbar = new _MenuId("MergeToolbar1Toolbar");
_MenuId.MergeInput2Toolbar = new _MenuId("MergeToolbar2Toolbar");
_MenuId.MergeBaseToolbar = new _MenuId("MergeBaseToolbar");
_MenuId.MergeInputResultToolbar = new _MenuId("MergeToolbarResultToolbar");
_MenuId.InlineSuggestionToolbar = new _MenuId("InlineSuggestionToolbar");
_MenuId.InlineEditToolbar = new _MenuId("InlineEditToolbar");
_MenuId.ChatContext = new _MenuId("ChatContext");
_MenuId.ChatCodeBlock = new _MenuId("ChatCodeblock");
_MenuId.ChatCompareBlock = new _MenuId("ChatCompareBlock");
_MenuId.ChatMessageTitle = new _MenuId("ChatMessageTitle");
_MenuId.ChatMessageFooter = new _MenuId("ChatMessageFooter");
_MenuId.ChatExecute = new _MenuId("ChatExecute");
_MenuId.ChatExecuteSecondary = new _MenuId("ChatExecuteSecondary");
_MenuId.ChatInput = new _MenuId("ChatInput");
_MenuId.ChatInputSide = new _MenuId("ChatInputSide");
_MenuId.ChatModelPicker = new _MenuId("ChatModelPicker");
_MenuId.ChatEditingWidgetToolbar = new _MenuId("ChatEditingWidgetToolbar");
_MenuId.ChatEditingEditorContent = new _MenuId("ChatEditingEditorContent");
_MenuId.ChatEditingEditorHunk = new _MenuId("ChatEditingEditorHunk");
_MenuId.ChatEditingDeletedNotebookCell = new _MenuId("ChatEditingDeletedNotebookCell");
_MenuId.ChatInputAttachmentToolbar = new _MenuId("ChatInputAttachmentToolbar");
_MenuId.ChatEditingWidgetModifiedFilesToolbar = new _MenuId("ChatEditingWidgetModifiedFilesToolbar");
_MenuId.ChatInputResourceAttachmentContext = new _MenuId("ChatInputResourceAttachmentContext");
_MenuId.ChatInputSymbolAttachmentContext = new _MenuId("ChatInputSymbolAttachmentContext");
_MenuId.ChatInlineResourceAnchorContext = new _MenuId("ChatInlineResourceAnchorContext");
_MenuId.ChatInlineSymbolAnchorContext = new _MenuId("ChatInlineSymbolAnchorContext");
_MenuId.ChatEditingCodeBlockContext = new _MenuId("ChatEditingCodeBlockContext");
_MenuId.ChatTitleBarMenu = new _MenuId("ChatTitleBarMenu");
_MenuId.ChatAttachmentsContext = new _MenuId("ChatAttachmentsContext");
_MenuId.AccessibleView = new _MenuId("AccessibleView");
_MenuId.MultiDiffEditorFileToolbar = new _MenuId("MultiDiffEditorFileToolbar");
_MenuId.DiffEditorHunkToolbar = new _MenuId("DiffEditorHunkToolbar");
_MenuId.DiffEditorSelectionToolbar = new _MenuId("DiffEditorSelectionToolbar");
let MenuId = _MenuId;
const IMenuService = createDecorator("menuService");
const _MenuRegistryChangeEvent = class _MenuRegistryChangeEvent {
  constructor(id) {
    this.id = id;
    this.has = (candidate) => candidate === id;
  }
  static for(id) {
    let value = this._all.get(id);
    if (!value) {
      value = new _MenuRegistryChangeEvent(id);
      this._all.set(id, value);
    }
    return value;
  }
  static merge(events) {
    const ids = /* @__PURE__ */ new Set();
    for (const item of events) {
      if (item instanceof _MenuRegistryChangeEvent) {
        ids.add(item.id);
      }
    }
    return ids;
  }
};
_MenuRegistryChangeEvent._all = /* @__PURE__ */ new Map();
let MenuRegistryChangeEvent = _MenuRegistryChangeEvent;
const MenuRegistry = new class {
  constructor() {
    this._commands = /* @__PURE__ */ new Map();
    this._menuItems = /* @__PURE__ */ new Map();
    this._onDidChangeMenu = new MicrotaskEmitter({
      merge: MenuRegistryChangeEvent.merge
    });
    this.onDidChangeMenu = this._onDidChangeMenu.event;
  }
  addCommand(command) {
    this._commands.set(command.id, command);
    this._onDidChangeMenu.fire(MenuRegistryChangeEvent.for(MenuId.CommandPalette));
    return markAsSingleton(toDisposable(() => {
      if (this._commands.delete(command.id)) {
        this._onDidChangeMenu.fire(MenuRegistryChangeEvent.for(MenuId.CommandPalette));
      }
    }));
  }
  getCommand(id) {
    return this._commands.get(id);
  }
  getCommands() {
    const map = /* @__PURE__ */ new Map();
    this._commands.forEach((value, key) => map.set(key, value));
    return map;
  }
  appendMenuItem(id, item) {
    let list = this._menuItems.get(id);
    if (!list) {
      list = new LinkedList();
      this._menuItems.set(id, list);
    }
    const rm = list.push(item);
    this._onDidChangeMenu.fire(MenuRegistryChangeEvent.for(id));
    return markAsSingleton(toDisposable(() => {
      rm();
      this._onDidChangeMenu.fire(MenuRegistryChangeEvent.for(id));
    }));
  }
  appendMenuItems(items) {
    const result = new DisposableStore();
    for (const { id, item } of items) {
      result.add(this.appendMenuItem(id, item));
    }
    return result;
  }
  getMenuItems(id) {
    let result;
    if (this._menuItems.has(id)) {
      result = [...this._menuItems.get(id)];
    } else {
      result = [];
    }
    if (id === MenuId.CommandPalette) {
      this._appendImplicitItems(result);
    }
    return result;
  }
  _appendImplicitItems(result) {
    const set = /* @__PURE__ */ new Set();
    for (const item of result) {
      if (isIMenuItem(item)) {
        set.add(item.command.id);
        if (item.alt) {
          set.add(item.alt.id);
        }
      }
    }
    this._commands.forEach((command, id) => {
      if (!set.has(id)) {
        result.push({ command });
      }
    });
  }
}();
class SubmenuItemAction extends SubmenuAction {
  constructor(item, hideActions, actions) {
    super(`submenuitem.${item.submenu.id}`, typeof item.title === "string" ? item.title : item.title.value, actions, "submenu");
    this.item = item;
    this.hideActions = hideActions;
  }
}
let MenuItemAction = class {
  constructor(item, alt, options, hideActions, menuKeybinding, contextKeyService, _commandService) {
    this.hideActions = hideActions;
    this.menuKeybinding = menuKeybinding;
    this._commandService = _commandService;
    this.id = item.id;
    this.label = MenuItemAction.label(item, options);
    this.tooltip = (typeof item.tooltip === "string" ? item.tooltip : item.tooltip?.value) ?? "";
    this.enabled = !item.precondition || contextKeyService.contextMatchesRules(item.precondition);
    this.checked = void 0;
    let icon;
    if (item.toggled) {
      const toggled = item.toggled.condition ? item.toggled : { condition: item.toggled };
      this.checked = contextKeyService.contextMatchesRules(toggled.condition);
      if (this.checked && toggled.tooltip) {
        this.tooltip = typeof toggled.tooltip === "string" ? toggled.tooltip : toggled.tooltip.value;
      }
      if (this.checked && ThemeIcon.isThemeIcon(toggled.icon)) {
        icon = toggled.icon;
      }
      if (this.checked && toggled.title) {
        this.label = typeof toggled.title === "string" ? toggled.title : toggled.title.value;
      }
    }
    if (!icon) {
      icon = ThemeIcon.isThemeIcon(item.icon) ? item.icon : void 0;
    }
    this.item = item;
    this.alt = alt ? new MenuItemAction(alt, void 0, options, hideActions, void 0, contextKeyService, _commandService) : void 0;
    this._options = options;
    this.class = icon && ThemeIcon.asClassName(icon);
  }
  static label(action, options) {
    return options?.renderShortTitle && action.shortTitle ? typeof action.shortTitle === "string" ? action.shortTitle : action.shortTitle.value : typeof action.title === "string" ? action.title : action.title.value;
  }
  run(...args) {
    let runArgs = [];
    if (this._options?.arg) {
      runArgs = [...runArgs, this._options.arg];
    }
    if (this._options?.shouldForwardArgs) {
      runArgs = [...runArgs, ...args];
    }
    return this._commandService.executeCommand(this.id, ...runArgs);
  }
};
MenuItemAction = __decorateClass([
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, ICommandService)
], MenuItemAction);
class Action2 {
  constructor(desc) {
    this.desc = desc;
  }
}
function registerAction2(ctor) {
  const disposables = [];
  const action = new ctor();
  const { f1, menu, keybinding, ...command } = action.desc;
  if (CommandsRegistry.getCommand(command.id)) {
    throw new Error(`Cannot register two commands with the same id: ${command.id}`);
  }
  disposables.push(CommandsRegistry.registerCommand({
    id: command.id,
    handler: (accessor, ...args) => action.run(accessor, ...args),
    metadata: command.metadata ?? { description: action.desc.title }
  }));
  if (Array.isArray(menu)) {
    for (const item of menu) {
      disposables.push(MenuRegistry.appendMenuItem(item.id, { command: { ...command, precondition: item.precondition === null ? void 0 : command.precondition }, ...item }));
    }
  } else if (menu) {
    disposables.push(MenuRegistry.appendMenuItem(menu.id, { command: { ...command, precondition: menu.precondition === null ? void 0 : command.precondition }, ...menu }));
  }
  if (f1) {
    disposables.push(MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command, when: command.precondition }));
    disposables.push(MenuRegistry.addCommand(command));
  }
  if (Array.isArray(keybinding)) {
    for (const item of keybinding) {
      disposables.push(KeybindingsRegistry.registerKeybindingRule({
        ...item,
        id: command.id,
        when: command.precondition ? ContextKeyExpr.and(command.precondition, item.when) : item.when
      }));
    }
  } else if (keybinding) {
    disposables.push(KeybindingsRegistry.registerKeybindingRule({
      ...keybinding,
      id: command.id,
      when: command.precondition ? ContextKeyExpr.and(command.precondition, keybinding.when) : keybinding.when
    }));
  }
  return {
    dispose() {
      dispose(disposables);
    }
  };
}
export {
  Action2,
  IMenuService,
  MenuId,
  MenuItemAction,
  MenuRegistry,
  SubmenuItemAction,
  isIMenuItem,
  isISubmenuItem,
  registerAction2
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSUFjdGlvbiwgU3VibWVudUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgRXZlbnQsIE1pY3JvdGFza0VtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlLCBtYXJrQXNTaW5nbGV0b24sIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBMaW5rZWRMaXN0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlua2VkTGlzdC5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRBY3Rpb24sIElDb21tYW5kQWN0aW9uVGl0bGUsIEljb24sIElMb2NhbGl6ZWRTdHJpbmcgfSBmcm9tICcuLi8uLi9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnksIElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgQ29udGV4dEtleUV4cHJlc3Npb24sIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1J1bGUsIEtleWJpbmRpbmdzUmVnaXN0cnkgfSBmcm9tICcuLi8uLi9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJTWVudUl0ZW0ge1xuXHRjb21tYW5kOiBJQ29tbWFuZEFjdGlvbjtcblx0YWx0PzogSUNvbW1hbmRBY3Rpb247XG5cdC8qKlxuXHQgKiBNZW51IGl0ZW0gaXMgaGlkZGVuIGlmIHRoaXMgZXhwcmVzc2lvbiByZXR1cm5zIGZhbHNlLlxuXHQgKi9cblx0d2hlbj86IENvbnRleHRLZXlFeHByZXNzaW9uO1xuXHRncm91cD86ICduYXZpZ2F0aW9uJyB8IHN0cmluZztcblx0b3JkZXI/OiBudW1iZXI7XG5cdGlzSGlkZGVuQnlEZWZhdWx0PzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU3VibWVudUl0ZW0ge1xuXHR0aXRsZTogc3RyaW5nIHwgSUNvbW1hbmRBY3Rpb25UaXRsZTtcblx0c3VibWVudTogTWVudUlkO1xuXHRpY29uPzogSWNvbjtcblx0d2hlbj86IENvbnRleHRLZXlFeHByZXNzaW9uO1xuXHRncm91cD86ICduYXZpZ2F0aW9uJyB8IHN0cmluZztcblx0b3JkZXI/OiBudW1iZXI7XG5cdGlzU2VsZWN0aW9uPzogYm9vbGVhbjtcblx0cmVtZW1iZXJEZWZhdWx0QWN0aW9uPzogYm9vbGVhbjtcdC8vIGZvciBkcm9wZG93biBtZW51OiBpZiB0cnVlIHRoZSBsYXN0IGV4ZWN1dGVkIGFjdGlvbiBpcyByZW1lbWJlcmVkIGFzIHRoZSBkZWZhdWx0IGFjdGlvblxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNJTWVudUl0ZW0oaXRlbTogYW55KTogaXRlbSBpcyBJTWVudUl0ZW0ge1xuXHRyZXR1cm4gKGl0ZW0gYXMgSU1lbnVJdGVtKS5jb21tYW5kICE9PSB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0lTdWJtZW51SXRlbShpdGVtOiBhbnkpOiBpdGVtIGlzIElTdWJtZW51SXRlbSB7XG5cdHJldHVybiAoaXRlbSBhcyBJU3VibWVudUl0ZW0pLnN1Ym1lbnUgIT09IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGNsYXNzIE1lbnVJZCB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX2luc3RhbmNlcyA9IG5ldyBNYXA8c3RyaW5nLCBNZW51SWQ+KCk7XG5cblx0c3RhdGljIHJlYWRvbmx5IENvbW1hbmRQYWxldHRlID0gbmV3IE1lbnVJZCgnQ29tbWFuZFBhbGV0dGUnKTtcblx0c3RhdGljIHJlYWRvbmx5IERlYnVnQnJlYWtwb2ludHNDb250ZXh0ID0gbmV3IE1lbnVJZCgnRGVidWdCcmVha3BvaW50c0NvbnRleHQnKTtcblx0c3RhdGljIHJlYWRvbmx5IERlYnVnQ2FsbFN0YWNrQ29udGV4dCA9IG5ldyBNZW51SWQoJ0RlYnVnQ2FsbFN0YWNrQ29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgRGVidWdDb25zb2xlQ29udGV4dCA9IG5ldyBNZW51SWQoJ0RlYnVnQ29uc29sZUNvbnRleHQnKTtcblx0c3RhdGljIHJlYWRvbmx5IERlYnVnVmFyaWFibGVzQ29udGV4dCA9IG5ldyBNZW51SWQoJ0RlYnVnVmFyaWFibGVzQ29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTm90ZWJvb2tWYXJpYWJsZXNDb250ZXh0ID0gbmV3IE1lbnVJZCgnTm90ZWJvb2tWYXJpYWJsZXNDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBEZWJ1Z0hvdmVyQ29udGV4dCA9IG5ldyBNZW51SWQoJ0RlYnVnSG92ZXJDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBEZWJ1Z1dhdGNoQ29udGV4dCA9IG5ldyBNZW51SWQoJ0RlYnVnV2F0Y2hDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBEZWJ1Z1Rvb2xCYXIgPSBuZXcgTWVudUlkKCdEZWJ1Z1Rvb2xCYXInKTtcblx0c3RhdGljIHJlYWRvbmx5IERlYnVnVG9vbEJhclN0b3AgPSBuZXcgTWVudUlkKCdEZWJ1Z1Rvb2xCYXJTdG9wJyk7XG5cdHN0YXRpYyByZWFkb25seSBEZWJ1Z0NhbGxTdGFja1Rvb2xiYXIgPSBuZXcgTWVudUlkKCdEZWJ1Z0NhbGxTdGFja1Rvb2xiYXInKTtcblx0c3RhdGljIHJlYWRvbmx5IERlYnVnQ3JlYXRlQ29uZmlndXJhdGlvbiA9IG5ldyBNZW51SWQoJ0RlYnVnQ3JlYXRlQ29uZmlndXJhdGlvbicpO1xuXHRzdGF0aWMgcmVhZG9ubHkgRWRpdG9yQ29udGV4dCA9IG5ldyBNZW51SWQoJ0VkaXRvckNvbnRleHQnKTtcblx0c3RhdGljIHJlYWRvbmx5IFNpbXBsZUVkaXRvckNvbnRleHQgPSBuZXcgTWVudUlkKCdTaW1wbGVFZGl0b3JDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBFZGl0b3JDb250ZW50ID0gbmV3IE1lbnVJZCgnRWRpdG9yQ29udGVudCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgRWRpdG9yTGluZU51bWJlckNvbnRleHQgPSBuZXcgTWVudUlkKCdFZGl0b3JMaW5lTnVtYmVyQ29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgRWRpdG9yQ29udGV4dENvcHkgPSBuZXcgTWVudUlkKCdFZGl0b3JDb250ZXh0Q29weScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgRWRpdG9yQ29udGV4dFBlZWsgPSBuZXcgTWVudUlkKCdFZGl0b3JDb250ZXh0UGVlaycpO1xuXHRzdGF0aWMgcmVhZG9ubHkgRWRpdG9yQ29udGV4dFNoYXJlID0gbmV3IE1lbnVJZCgnRWRpdG9yQ29udGV4dFNoYXJlJyk7XG5cdHN0YXRpYyByZWFkb25seSBFZGl0b3JUaXRsZSA9IG5ldyBNZW51SWQoJ0VkaXRvclRpdGxlJyk7XG5cdHN0YXRpYyByZWFkb25seSBFZGl0b3JUaXRsZVJ1biA9IG5ldyBNZW51SWQoJ0VkaXRvclRpdGxlUnVuJyk7XG5cdHN0YXRpYyByZWFkb25seSBFZGl0b3JUaXRsZUNvbnRleHQgPSBuZXcgTWVudUlkKCdFZGl0b3JUaXRsZUNvbnRleHQnKTtcblx0c3RhdGljIHJlYWRvbmx5IEVkaXRvclRpdGxlQ29udGV4dFNoYXJlID0gbmV3IE1lbnVJZCgnRWRpdG9yVGl0bGVDb250ZXh0U2hhcmUnKTtcblx0c3RhdGljIHJlYWRvbmx5IEVtcHR5RWRpdG9yR3JvdXAgPSBuZXcgTWVudUlkKCdFbXB0eUVkaXRvckdyb3VwJyk7XG5cdHN0YXRpYyByZWFkb25seSBFbXB0eUVkaXRvckdyb3VwQ29udGV4dCA9IG5ldyBNZW51SWQoJ0VtcHR5RWRpdG9yR3JvdXBDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBFZGl0b3JUYWJzQmFyQ29udGV4dCA9IG5ldyBNZW51SWQoJ0VkaXRvclRhYnNCYXJDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBFZGl0b3JUYWJzQmFyU2hvd1RhYnNTdWJtZW51ID0gbmV3IE1lbnVJZCgnRWRpdG9yVGFic0JhclNob3dUYWJzU3VibWVudScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgRWRpdG9yVGFic0JhclNob3dUYWJzWmVuTW9kZVN1Ym1lbnUgPSBuZXcgTWVudUlkKCdFZGl0b3JUYWJzQmFyU2hvd1RhYnNaZW5Nb2RlU3VibWVudScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgRWRpdG9yQWN0aW9uc1Bvc2l0aW9uU3VibWVudSA9IG5ldyBNZW51SWQoJ0VkaXRvckFjdGlvbnNQb3NpdGlvblN1Ym1lbnUnKTtcblx0c3RhdGljIHJlYWRvbmx5IEV4cGxvcmVyQ29udGV4dCA9IG5ldyBNZW51SWQoJ0V4cGxvcmVyQ29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgRXhwbG9yZXJDb250ZXh0U2hhcmUgPSBuZXcgTWVudUlkKCdFeHBsb3JlckNvbnRleHRTaGFyZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgRXh0ZW5zaW9uQ29udGV4dCA9IG5ldyBNZW51SWQoJ0V4dGVuc2lvbkNvbnRleHQnKTtcblx0c3RhdGljIHJlYWRvbmx5IEV4dGVuc2lvbkVkaXRvckNvbnRleHRNZW51ID0gbmV3IE1lbnVJZCgnRXh0ZW5zaW9uRWRpdG9yQ29udGV4dE1lbnUnKTtcblx0c3RhdGljIHJlYWRvbmx5IEdsb2JhbEFjdGl2aXR5ID0gbmV3IE1lbnVJZCgnR2xvYmFsQWN0aXZpdHknKTtcblx0c3RhdGljIHJlYWRvbmx5IENvbW1hbmRDZW50ZXIgPSBuZXcgTWVudUlkKCdDb21tYW5kQ2VudGVyJyk7XG5cdHN0YXRpYyByZWFkb25seSBDb21tYW5kQ2VudGVyQ2VudGVyID0gbmV3IE1lbnVJZCgnQ29tbWFuZENlbnRlckNlbnRlcicpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTGF5b3V0Q29udHJvbE1lbnVTdWJtZW51ID0gbmV3IE1lbnVJZCgnTGF5b3V0Q29udHJvbE1lbnVTdWJtZW51Jyk7XG5cdHN0YXRpYyByZWFkb25seSBMYXlvdXRDb250cm9sTWVudSA9IG5ldyBNZW51SWQoJ0xheW91dENvbnRyb2xNZW51Jyk7XG5cdHN0YXRpYyByZWFkb25seSBNZW51YmFyTWFpbk1lbnUgPSBuZXcgTWVudUlkKCdNZW51YmFyTWFpbk1lbnUnKTtcblx0c3RhdGljIHJlYWRvbmx5IE1lbnViYXJBcHBlYXJhbmNlTWVudSA9IG5ldyBNZW51SWQoJ01lbnViYXJBcHBlYXJhbmNlTWVudScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTWVudWJhckRlYnVnTWVudSA9IG5ldyBNZW51SWQoJ01lbnViYXJEZWJ1Z01lbnUnKTtcblx0c3RhdGljIHJlYWRvbmx5IE1lbnViYXJFZGl0TWVudSA9IG5ldyBNZW51SWQoJ01lbnViYXJFZGl0TWVudScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTWVudWJhckNvcHkgPSBuZXcgTWVudUlkKCdNZW51YmFyQ29weScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTWVudWJhckZpbGVNZW51ID0gbmV3IE1lbnVJZCgnTWVudWJhckZpbGVNZW51Jyk7XG5cdHN0YXRpYyByZWFkb25seSBNZW51YmFyR29NZW51ID0gbmV3IE1lbnVJZCgnTWVudWJhckdvTWVudScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTWVudWJhckhlbHBNZW51ID0gbmV3IE1lbnVJZCgnTWVudWJhckhlbHBNZW51Jyk7XG5cdHN0YXRpYyByZWFkb25seSBNZW51YmFyTGF5b3V0TWVudSA9IG5ldyBNZW51SWQoJ01lbnViYXJMYXlvdXRNZW51Jyk7XG5cdHN0YXRpYyByZWFkb25seSBNZW51YmFyTmV3QnJlYWtwb2ludE1lbnUgPSBuZXcgTWVudUlkKCdNZW51YmFyTmV3QnJlYWtwb2ludE1lbnUnKTtcblx0c3RhdGljIHJlYWRvbmx5IFBhbmVsQWxpZ25tZW50TWVudSA9IG5ldyBNZW51SWQoJ1BhbmVsQWxpZ25tZW50TWVudScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgUGFuZWxQb3NpdGlvbk1lbnUgPSBuZXcgTWVudUlkKCdQYW5lbFBvc2l0aW9uTWVudScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQWN0aXZpdHlCYXJQb3NpdGlvbk1lbnUgPSBuZXcgTWVudUlkKCdBY3Rpdml0eUJhclBvc2l0aW9uTWVudScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTWVudWJhclByZWZlcmVuY2VzTWVudSA9IG5ldyBNZW51SWQoJ01lbnViYXJQcmVmZXJlbmNlc01lbnUnKTtcblx0c3RhdGljIHJlYWRvbmx5IE1lbnViYXJSZWNlbnRNZW51ID0gbmV3IE1lbnVJZCgnTWVudWJhclJlY2VudE1lbnUnKTtcblx0c3RhdGljIHJlYWRvbmx5IE1lbnViYXJTZWxlY3Rpb25NZW51ID0gbmV3IE1lbnVJZCgnTWVudWJhclNlbGVjdGlvbk1lbnUnKTtcblx0c3RhdGljIHJlYWRvbmx5IE1lbnViYXJTaGFyZSA9IG5ldyBNZW51SWQoJ01lbnViYXJTaGFyZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTWVudWJhclN3aXRjaEVkaXRvck1lbnUgPSBuZXcgTWVudUlkKCdNZW51YmFyU3dpdGNoRWRpdG9yTWVudScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTWVudWJhclN3aXRjaEdyb3VwTWVudSA9IG5ldyBNZW51SWQoJ01lbnViYXJTd2l0Y2hHcm91cE1lbnUnKTtcblx0c3RhdGljIHJlYWRvbmx5IE1lbnViYXJUZXJtaW5hbE1lbnUgPSBuZXcgTWVudUlkKCdNZW51YmFyVGVybWluYWxNZW51Jyk7XG5cdHN0YXRpYyByZWFkb25seSBNZW51YmFyVGVybWluYWxTdWdnZXN0U3RhdHVzTWVudSA9IG5ldyBNZW51SWQoJ01lbnViYXJUZXJtaW5hbFN1Z2dlc3RTdGF0dXNNZW51Jyk7XG5cdHN0YXRpYyByZWFkb25seSBNZW51YmFyVmlld01lbnUgPSBuZXcgTWVudUlkKCdNZW51YmFyVmlld01lbnUnKTtcblx0c3RhdGljIHJlYWRvbmx5IE1lbnViYXJIb21lTWVudSA9IG5ldyBNZW51SWQoJ01lbnViYXJIb21lTWVudScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgT3BlbkVkaXRvcnNDb250ZXh0ID0gbmV3IE1lbnVJZCgnT3BlbkVkaXRvcnNDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBPcGVuRWRpdG9yc0NvbnRleHRTaGFyZSA9IG5ldyBNZW51SWQoJ09wZW5FZGl0b3JzQ29udGV4dFNoYXJlJyk7XG5cdHN0YXRpYyByZWFkb25seSBQcm9ibGVtc1BhbmVsQ29udGV4dCA9IG5ldyBNZW51SWQoJ1Byb2JsZW1zUGFuZWxDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBTQ01JbnB1dEJveCA9IG5ldyBNZW51SWQoJ1NDTUlucHV0Qm94Jyk7XG5cdHN0YXRpYyByZWFkb25seSBTQ01DaGFuZ2VDb250ZXh0ID0gbmV3IE1lbnVJZCgnU0NNQ2hhbmdlQ29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgU0NNUmVzb3VyY2VDb250ZXh0ID0gbmV3IE1lbnVJZCgnU0NNUmVzb3VyY2VDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBTQ01SZXNvdXJjZUNvbnRleHRTaGFyZSA9IG5ldyBNZW51SWQoJ1NDTVJlc291cmNlQ29udGV4dFNoYXJlJyk7XG5cdHN0YXRpYyByZWFkb25seSBTQ01SZXNvdXJjZUZvbGRlckNvbnRleHQgPSBuZXcgTWVudUlkKCdTQ01SZXNvdXJjZUZvbGRlckNvbnRleHQnKTtcblx0c3RhdGljIHJlYWRvbmx5IFNDTVJlc291cmNlR3JvdXBDb250ZXh0ID0gbmV3IE1lbnVJZCgnU0NNUmVzb3VyY2VHcm91cENvbnRleHQnKTtcblx0c3RhdGljIHJlYWRvbmx5IFNDTVNvdXJjZUNvbnRyb2wgPSBuZXcgTWVudUlkKCdTQ01Tb3VyY2VDb250cm9sJyk7XG5cdHN0YXRpYyByZWFkb25seSBTQ01Tb3VyY2VDb250cm9sSW5saW5lID0gbmV3IE1lbnVJZCgnU0NNU291cmNlQ29udHJvbElubGluZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgU0NNU291cmNlQ29udHJvbFRpdGxlID0gbmV3IE1lbnVJZCgnU0NNU291cmNlQ29udHJvbFRpdGxlJyk7XG5cdHN0YXRpYyByZWFkb25seSBTQ01IaXN0b3J5VGl0bGUgPSBuZXcgTWVudUlkKCdTQ01IaXN0b3J5VGl0bGUnKTtcblx0c3RhdGljIHJlYWRvbmx5IFNDTUhpc3RvcnlJdGVtQ29udGV4dCA9IG5ldyBNZW51SWQoJ1NDTUhpc3RvcnlJdGVtQ29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgU0NNSGlzdG9yeUl0ZW1Ib3ZlciA9IG5ldyBNZW51SWQoJ1NDTUhpc3RvcnlJdGVtSG92ZXInKTtcblx0c3RhdGljIHJlYWRvbmx5IFNDTUhpc3RvcnlJdGVtUmVmQ29udGV4dCA9IG5ldyBNZW51SWQoJ1NDTUhpc3RvcnlJdGVtUmVmQ29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgU0NNVGl0bGUgPSBuZXcgTWVudUlkKCdTQ01UaXRsZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgU2VhcmNoQ29udGV4dCA9IG5ldyBNZW51SWQoJ1NlYXJjaENvbnRleHQnKTtcblx0c3RhdGljIHJlYWRvbmx5IFNlYXJjaEFjdGlvbk1lbnUgPSBuZXcgTWVudUlkKCdTZWFyY2hBY3Rpb25Db250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBTdGF0dXNCYXJXaW5kb3dJbmRpY2F0b3JNZW51ID0gbmV3IE1lbnVJZCgnU3RhdHVzQmFyV2luZG93SW5kaWNhdG9yTWVudScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgU3RhdHVzQmFyUmVtb3RlSW5kaWNhdG9yTWVudSA9IG5ldyBNZW51SWQoJ1N0YXR1c0JhclJlbW90ZUluZGljYXRvck1lbnUnKTtcblx0c3RhdGljIHJlYWRvbmx5IFN0aWNreVNjcm9sbENvbnRleHQgPSBuZXcgTWVudUlkKCdTdGlja3lTY3JvbGxDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBUZXN0SXRlbSA9IG5ldyBNZW51SWQoJ1Rlc3RJdGVtJyk7XG5cdHN0YXRpYyByZWFkb25seSBUZXN0SXRlbUd1dHRlciA9IG5ldyBNZW51SWQoJ1Rlc3RJdGVtR3V0dGVyJyk7XG5cdHN0YXRpYyByZWFkb25seSBUZXN0UHJvZmlsZXNDb250ZXh0ID0gbmV3IE1lbnVJZCgnVGVzdFByb2ZpbGVzQ29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgVGVzdE1lc3NhZ2VDb250ZXh0ID0gbmV3IE1lbnVJZCgnVGVzdE1lc3NhZ2VDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBUZXN0TWVzc2FnZUNvbnRlbnQgPSBuZXcgTWVudUlkKCdUZXN0TWVzc2FnZUNvbnRlbnQnKTtcblx0c3RhdGljIHJlYWRvbmx5IFRlc3RQZWVrRWxlbWVudCA9IG5ldyBNZW51SWQoJ1Rlc3RQZWVrRWxlbWVudCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgVGVzdFBlZWtUaXRsZSA9IG5ldyBNZW51SWQoJ1Rlc3RQZWVrVGl0bGUnKTtcblx0c3RhdGljIHJlYWRvbmx5IFRlc3RDYWxsU3RhY2sgPSBuZXcgTWVudUlkKCdUZXN0Q2FsbFN0YWNrJyk7XG5cdHN0YXRpYyByZWFkb25seSBUZXN0Q292ZXJhZ2VGaWx0ZXJJdGVtID0gbmV3IE1lbnVJZCgnVGVzdENvdmVyYWdlRmlsdGVySXRlbScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgVG91Y2hCYXJDb250ZXh0ID0gbmV3IE1lbnVJZCgnVG91Y2hCYXJDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBUaXRsZUJhciA9IG5ldyBNZW51SWQoJ1RpdGxlQmFyJyk7XG5cdHN0YXRpYyByZWFkb25seSBUaXRsZUJhckNvbnRleHQgPSBuZXcgTWVudUlkKCdUaXRsZUJhckNvbnRleHQnKTtcblx0c3RhdGljIHJlYWRvbmx5IFRpdGxlQmFyVGl0bGVDb250ZXh0ID0gbmV3IE1lbnVJZCgnVGl0bGVCYXJUaXRsZUNvbnRleHQnKTtcblx0c3RhdGljIHJlYWRvbmx5IFR1bm5lbENvbnRleHQgPSBuZXcgTWVudUlkKCdUdW5uZWxDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBUdW5uZWxQcml2YWN5ID0gbmV3IE1lbnVJZCgnVHVubmVsUHJpdmFjeScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgVHVubmVsUHJvdG9jb2wgPSBuZXcgTWVudUlkKCdUdW5uZWxQcm90b2NvbCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgVHVubmVsUG9ydElubGluZSA9IG5ldyBNZW51SWQoJ1R1bm5lbElubGluZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgVHVubmVsVGl0bGUgPSBuZXcgTWVudUlkKCdUdW5uZWxUaXRsZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgVHVubmVsTG9jYWxBZGRyZXNzSW5saW5lID0gbmV3IE1lbnVJZCgnVHVubmVsTG9jYWxBZGRyZXNzSW5saW5lJyk7XG5cdHN0YXRpYyByZWFkb25seSBUdW5uZWxPcmlnaW5JbmxpbmUgPSBuZXcgTWVudUlkKCdUdW5uZWxPcmlnaW5JbmxpbmUnKTtcblx0c3RhdGljIHJlYWRvbmx5IFZpZXdJdGVtQ29udGV4dCA9IG5ldyBNZW51SWQoJ1ZpZXdJdGVtQ29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgVmlld0NvbnRhaW5lclRpdGxlID0gbmV3IE1lbnVJZCgnVmlld0NvbnRhaW5lclRpdGxlJyk7XG5cdHN0YXRpYyByZWFkb25seSBWaWV3Q29udGFpbmVyVGl0bGVDb250ZXh0ID0gbmV3IE1lbnVJZCgnVmlld0NvbnRhaW5lclRpdGxlQ29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgVmlld1RpdGxlID0gbmV3IE1lbnVJZCgnVmlld1RpdGxlJyk7XG5cdHN0YXRpYyByZWFkb25seSBWaWV3VGl0bGVDb250ZXh0ID0gbmV3IE1lbnVJZCgnVmlld1RpdGxlQ29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ29tbWVudEVkaXRvckFjdGlvbnMgPSBuZXcgTWVudUlkKCdDb21tZW50RWRpdG9yQWN0aW9ucycpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ29tbWVudFRocmVhZFRpdGxlID0gbmV3IE1lbnVJZCgnQ29tbWVudFRocmVhZFRpdGxlJyk7XG5cdHN0YXRpYyByZWFkb25seSBDb21tZW50VGhyZWFkQWN0aW9ucyA9IG5ldyBNZW51SWQoJ0NvbW1lbnRUaHJlYWRBY3Rpb25zJyk7XG5cdHN0YXRpYyByZWFkb25seSBDb21tZW50VGhyZWFkQWRkaXRpb25hbEFjdGlvbnMgPSBuZXcgTWVudUlkKCdDb21tZW50VGhyZWFkQWRkaXRpb25hbEFjdGlvbnMnKTtcblx0c3RhdGljIHJlYWRvbmx5IENvbW1lbnRUaHJlYWRUaXRsZUNvbnRleHQgPSBuZXcgTWVudUlkKCdDb21tZW50VGhyZWFkVGl0bGVDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBDb21tZW50VGhyZWFkQ29tbWVudENvbnRleHQgPSBuZXcgTWVudUlkKCdDb21tZW50VGhyZWFkQ29tbWVudENvbnRleHQnKTtcblx0c3RhdGljIHJlYWRvbmx5IENvbW1lbnRUaXRsZSA9IG5ldyBNZW51SWQoJ0NvbW1lbnRUaXRsZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ29tbWVudEFjdGlvbnMgPSBuZXcgTWVudUlkKCdDb21tZW50QWN0aW9ucycpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ29tbWVudHNWaWV3VGhyZWFkQWN0aW9ucyA9IG5ldyBNZW51SWQoJ0NvbW1lbnRzVmlld1RocmVhZEFjdGlvbnMnKTtcblx0c3RhdGljIHJlYWRvbmx5IEludGVyYWN0aXZlVG9vbGJhciA9IG5ldyBNZW51SWQoJ0ludGVyYWN0aXZlVG9vbGJhcicpO1xuXHRzdGF0aWMgcmVhZG9ubHkgSW50ZXJhY3RpdmVDZWxsVGl0bGUgPSBuZXcgTWVudUlkKCdJbnRlcmFjdGl2ZUNlbGxUaXRsZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgSW50ZXJhY3RpdmVDZWxsRGVsZXRlID0gbmV3IE1lbnVJZCgnSW50ZXJhY3RpdmVDZWxsRGVsZXRlJyk7XG5cdHN0YXRpYyByZWFkb25seSBJbnRlcmFjdGl2ZUNlbGxFeGVjdXRlID0gbmV3IE1lbnVJZCgnSW50ZXJhY3RpdmVDZWxsRXhlY3V0ZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgSW50ZXJhY3RpdmVJbnB1dEV4ZWN1dGUgPSBuZXcgTWVudUlkKCdJbnRlcmFjdGl2ZUlucHV0RXhlY3V0ZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgSW50ZXJhY3RpdmVJbnB1dENvbmZpZyA9IG5ldyBNZW51SWQoJ0ludGVyYWN0aXZlSW5wdXRDb25maWcnKTtcblx0c3RhdGljIHJlYWRvbmx5IFJlcGxJbnB1dEV4ZWN1dGUgPSBuZXcgTWVudUlkKCdSZXBsSW5wdXRFeGVjdXRlJyk7XG5cdHN0YXRpYyByZWFkb25seSBJc3N1ZVJlcG9ydGVyID0gbmV3IE1lbnVJZCgnSXNzdWVSZXBvcnRlcicpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTm90ZWJvb2tUb29sYmFyID0gbmV3IE1lbnVJZCgnTm90ZWJvb2tUb29sYmFyJyk7XG5cdHN0YXRpYyByZWFkb25seSBOb3RlYm9va1Rvb2xiYXJDb250ZXh0ID0gbmV3IE1lbnVJZCgnTm90ZWJvb2tUb29sYmFyQ29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTm90ZWJvb2tTdGlja3lTY3JvbGxDb250ZXh0ID0gbmV3IE1lbnVJZCgnTm90ZWJvb2tTdGlja3lTY3JvbGxDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBOb3RlYm9va0NlbGxUaXRsZSA9IG5ldyBNZW51SWQoJ05vdGVib29rQ2VsbFRpdGxlJyk7XG5cdHN0YXRpYyByZWFkb25seSBOb3RlYm9va0NlbGxEZWxldGUgPSBuZXcgTWVudUlkKCdOb3RlYm9va0NlbGxEZWxldGUnKTtcblx0c3RhdGljIHJlYWRvbmx5IE5vdGVib29rQ2VsbEluc2VydCA9IG5ldyBNZW51SWQoJ05vdGVib29rQ2VsbEluc2VydCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTm90ZWJvb2tDZWxsQmV0d2VlbiA9IG5ldyBNZW51SWQoJ05vdGVib29rQ2VsbEJldHdlZW4nKTtcblx0c3RhdGljIHJlYWRvbmx5IE5vdGVib29rQ2VsbExpc3RUb3AgPSBuZXcgTWVudUlkKCdOb3RlYm9va0NlbGxUb3AnKTtcblx0c3RhdGljIHJlYWRvbmx5IE5vdGVib29rQ2VsbEV4ZWN1dGUgPSBuZXcgTWVudUlkKCdOb3RlYm9va0NlbGxFeGVjdXRlJyk7XG5cdHN0YXRpYyByZWFkb25seSBOb3RlYm9va0NlbGxFeGVjdXRlR29UbyA9IG5ldyBNZW51SWQoJ05vdGVib29rQ2VsbEV4ZWN1dGVHb1RvJyk7XG5cdHN0YXRpYyByZWFkb25seSBOb3RlYm9va0NlbGxFeGVjdXRlUHJpbWFyeSA9IG5ldyBNZW51SWQoJ05vdGVib29rQ2VsbEV4ZWN1dGVQcmltYXJ5Jyk7XG5cdHN0YXRpYyByZWFkb25seSBOb3RlYm9va0RpZmZDZWxsSW5wdXRUaXRsZSA9IG5ldyBNZW51SWQoJ05vdGVib29rRGlmZkNlbGxJbnB1dFRpdGxlJyk7XG5cdHN0YXRpYyByZWFkb25seSBOb3RlYm9va0RpZmZEb2N1bWVudE1ldGFkYXRhID0gbmV3IE1lbnVJZCgnTm90ZWJvb2tEaWZmRG9jdW1lbnRNZXRhZGF0YScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTm90ZWJvb2tEaWZmQ2VsbE1ldGFkYXRhVGl0bGUgPSBuZXcgTWVudUlkKCdOb3RlYm9va0RpZmZDZWxsTWV0YWRhdGFUaXRsZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTm90ZWJvb2tEaWZmQ2VsbE91dHB1dHNUaXRsZSA9IG5ldyBNZW51SWQoJ05vdGVib29rRGlmZkNlbGxPdXRwdXRzVGl0bGUnKTtcblx0c3RhdGljIHJlYWRvbmx5IE5vdGVib29rT3V0cHV0VG9vbGJhciA9IG5ldyBNZW51SWQoJ05vdGVib29rT3V0cHV0VG9vbGJhcicpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTm90ZWJvb2tPdXRsaW5lRmlsdGVyID0gbmV3IE1lbnVJZCgnTm90ZWJvb2tPdXRsaW5lRmlsdGVyJyk7XG5cdHN0YXRpYyByZWFkb25seSBOb3RlYm9va091dGxpbmVBY3Rpb25NZW51ID0gbmV3IE1lbnVJZCgnTm90ZWJvb2tPdXRsaW5lQWN0aW9uTWVudScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTm90ZWJvb2tFZGl0b3JMYXlvdXRDb25maWd1cmUgPSBuZXcgTWVudUlkKCdOb3RlYm9va0VkaXRvckxheW91dENvbmZpZ3VyZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTm90ZWJvb2tLZXJuZWxTb3VyY2UgPSBuZXcgTWVudUlkKCdOb3RlYm9va0tlcm5lbFNvdXJjZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQnVsa0VkaXRUaXRsZSA9IG5ldyBNZW51SWQoJ0J1bGtFZGl0VGl0bGUnKTtcblx0c3RhdGljIHJlYWRvbmx5IEJ1bGtFZGl0Q29udGV4dCA9IG5ldyBNZW51SWQoJ0J1bGtFZGl0Q29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgVGltZWxpbmVJdGVtQ29udGV4dCA9IG5ldyBNZW51SWQoJ1RpbWVsaW5lSXRlbUNvbnRleHQnKTtcblx0c3RhdGljIHJlYWRvbmx5IFRpbWVsaW5lVGl0bGUgPSBuZXcgTWVudUlkKCdUaW1lbGluZVRpdGxlJyk7XG5cdHN0YXRpYyByZWFkb25seSBUaW1lbGluZVRpdGxlQ29udGV4dCA9IG5ldyBNZW51SWQoJ1RpbWVsaW5lVGl0bGVDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBUaW1lbGluZUZpbHRlclN1Yk1lbnUgPSBuZXcgTWVudUlkKCdUaW1lbGluZUZpbHRlclN1Yk1lbnUnKTtcblx0c3RhdGljIHJlYWRvbmx5IEFjY291bnRzQ29udGV4dCA9IG5ldyBNZW51SWQoJ0FjY291bnRzQ29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgU2lkZWJhclRpdGxlID0gbmV3IE1lbnVJZCgnU2lkZWJhclRpdGxlJyk7XG5cdHN0YXRpYyByZWFkb25seSBQYW5lbFRpdGxlID0gbmV3IE1lbnVJZCgnUGFuZWxUaXRsZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQXV4aWxpYXJ5QmFyVGl0bGUgPSBuZXcgTWVudUlkKCdBdXhpbGlhcnlCYXJUaXRsZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQXV4aWxpYXJ5QmFySGVhZGVyID0gbmV3IE1lbnVJZCgnQXV4aWxpYXJ5QmFySGVhZGVyJyk7XG5cdHN0YXRpYyByZWFkb25seSBUZXJtaW5hbEluc3RhbmNlQ29udGV4dCA9IG5ldyBNZW51SWQoJ1Rlcm1pbmFsSW5zdGFuY2VDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBUZXJtaW5hbEVkaXRvckluc3RhbmNlQ29udGV4dCA9IG5ldyBNZW51SWQoJ1Rlcm1pbmFsRWRpdG9ySW5zdGFuY2VDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBUZXJtaW5hbE5ld0Ryb3Bkb3duQ29udGV4dCA9IG5ldyBNZW51SWQoJ1Rlcm1pbmFsTmV3RHJvcGRvd25Db250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBUZXJtaW5hbFRhYkNvbnRleHQgPSBuZXcgTWVudUlkKCdUZXJtaW5hbFRhYkNvbnRleHQnKTtcblx0c3RhdGljIHJlYWRvbmx5IFRlcm1pbmFsVGFiRW1wdHlBcmVhQ29udGV4dCA9IG5ldyBNZW51SWQoJ1Rlcm1pbmFsVGFiRW1wdHlBcmVhQ29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgVGVybWluYWxTdGlja3lTY3JvbGxDb250ZXh0ID0gbmV3IE1lbnVJZCgnVGVybWluYWxTdGlja3lTY3JvbGxDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBXZWJ2aWV3Q29udGV4dCA9IG5ldyBNZW51SWQoJ1dlYnZpZXdDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBJbmxpbmVDb21wbGV0aW9uc0FjdGlvbnMgPSBuZXcgTWVudUlkKCdJbmxpbmVDb21wbGV0aW9uc0FjdGlvbnMnKTtcblx0c3RhdGljIHJlYWRvbmx5IElubGluZUVkaXRzQWN0aW9ucyA9IG5ldyBNZW51SWQoJ0lubGluZUVkaXRzQWN0aW9ucycpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTmV3RmlsZSA9IG5ldyBNZW51SWQoJ05ld0ZpbGUnKTtcblx0c3RhdGljIHJlYWRvbmx5IE1lcmdlSW5wdXQxVG9vbGJhciA9IG5ldyBNZW51SWQoJ01lcmdlVG9vbGJhcjFUb29sYmFyJyk7XG5cdHN0YXRpYyByZWFkb25seSBNZXJnZUlucHV0MlRvb2xiYXIgPSBuZXcgTWVudUlkKCdNZXJnZVRvb2xiYXIyVG9vbGJhcicpO1xuXHRzdGF0aWMgcmVhZG9ubHkgTWVyZ2VCYXNlVG9vbGJhciA9IG5ldyBNZW51SWQoJ01lcmdlQmFzZVRvb2xiYXInKTtcblx0c3RhdGljIHJlYWRvbmx5IE1lcmdlSW5wdXRSZXN1bHRUb29sYmFyID0gbmV3IE1lbnVJZCgnTWVyZ2VUb29sYmFyUmVzdWx0VG9vbGJhcicpO1xuXHRzdGF0aWMgcmVhZG9ubHkgSW5saW5lU3VnZ2VzdGlvblRvb2xiYXIgPSBuZXcgTWVudUlkKCdJbmxpbmVTdWdnZXN0aW9uVG9vbGJhcicpO1xuXHRzdGF0aWMgcmVhZG9ubHkgSW5saW5lRWRpdFRvb2xiYXIgPSBuZXcgTWVudUlkKCdJbmxpbmVFZGl0VG9vbGJhcicpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ2hhdENvbnRleHQgPSBuZXcgTWVudUlkKCdDaGF0Q29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ2hhdENvZGVCbG9jayA9IG5ldyBNZW51SWQoJ0NoYXRDb2RlYmxvY2snKTtcblx0c3RhdGljIHJlYWRvbmx5IENoYXRDb21wYXJlQmxvY2sgPSBuZXcgTWVudUlkKCdDaGF0Q29tcGFyZUJsb2NrJyk7XG5cdHN0YXRpYyByZWFkb25seSBDaGF0TWVzc2FnZVRpdGxlID0gbmV3IE1lbnVJZCgnQ2hhdE1lc3NhZ2VUaXRsZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ2hhdE1lc3NhZ2VGb290ZXIgPSBuZXcgTWVudUlkKCdDaGF0TWVzc2FnZUZvb3RlcicpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ2hhdEV4ZWN1dGUgPSBuZXcgTWVudUlkKCdDaGF0RXhlY3V0ZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ2hhdEV4ZWN1dGVTZWNvbmRhcnkgPSBuZXcgTWVudUlkKCdDaGF0RXhlY3V0ZVNlY29uZGFyeScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ2hhdElucHV0ID0gbmV3IE1lbnVJZCgnQ2hhdElucHV0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBDaGF0SW5wdXRTaWRlID0gbmV3IE1lbnVJZCgnQ2hhdElucHV0U2lkZScpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ2hhdE1vZGVsUGlja2VyID0gbmV3IE1lbnVJZCgnQ2hhdE1vZGVsUGlja2VyJyk7XG5cdHN0YXRpYyByZWFkb25seSBDaGF0RWRpdGluZ1dpZGdldFRvb2xiYXIgPSBuZXcgTWVudUlkKCdDaGF0RWRpdGluZ1dpZGdldFRvb2xiYXInKTtcblx0c3RhdGljIHJlYWRvbmx5IENoYXRFZGl0aW5nRWRpdG9yQ29udGVudCA9IG5ldyBNZW51SWQoJ0NoYXRFZGl0aW5nRWRpdG9yQ29udGVudCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ2hhdEVkaXRpbmdFZGl0b3JIdW5rID0gbmV3IE1lbnVJZCgnQ2hhdEVkaXRpbmdFZGl0b3JIdW5rJyk7XG5cdHN0YXRpYyByZWFkb25seSBDaGF0RWRpdGluZ0RlbGV0ZWROb3RlYm9va0NlbGwgPSBuZXcgTWVudUlkKCdDaGF0RWRpdGluZ0RlbGV0ZWROb3RlYm9va0NlbGwnKTtcblx0c3RhdGljIHJlYWRvbmx5IENoYXRJbnB1dEF0dGFjaG1lbnRUb29sYmFyID0gbmV3IE1lbnVJZCgnQ2hhdElucHV0QXR0YWNobWVudFRvb2xiYXInKTtcblx0c3RhdGljIHJlYWRvbmx5IENoYXRFZGl0aW5nV2lkZ2V0TW9kaWZpZWRGaWxlc1Rvb2xiYXIgPSBuZXcgTWVudUlkKCdDaGF0RWRpdGluZ1dpZGdldE1vZGlmaWVkRmlsZXNUb29sYmFyJyk7XG5cdHN0YXRpYyByZWFkb25seSBDaGF0SW5wdXRSZXNvdXJjZUF0dGFjaG1lbnRDb250ZXh0ID0gbmV3IE1lbnVJZCgnQ2hhdElucHV0UmVzb3VyY2VBdHRhY2htZW50Q29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ2hhdElucHV0U3ltYm9sQXR0YWNobWVudENvbnRleHQgPSBuZXcgTWVudUlkKCdDaGF0SW5wdXRTeW1ib2xBdHRhY2htZW50Q29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ2hhdElubGluZVJlc291cmNlQW5jaG9yQ29udGV4dCA9IG5ldyBNZW51SWQoJ0NoYXRJbmxpbmVSZXNvdXJjZUFuY2hvckNvbnRleHQnKTtcblx0c3RhdGljIHJlYWRvbmx5IENoYXRJbmxpbmVTeW1ib2xBbmNob3JDb250ZXh0ID0gbmV3IE1lbnVJZCgnQ2hhdElubGluZVN5bWJvbEFuY2hvckNvbnRleHQnKTtcblx0c3RhdGljIHJlYWRvbmx5IENoYXRFZGl0aW5nQ29kZUJsb2NrQ29udGV4dCA9IG5ldyBNZW51SWQoJ0NoYXRFZGl0aW5nQ29kZUJsb2NrQ29udGV4dCcpO1xuXHRzdGF0aWMgcmVhZG9ubHkgQ2hhdFRpdGxlQmFyTWVudSA9IG5ldyBNZW51SWQoJ0NoYXRUaXRsZUJhck1lbnUnKTtcblx0c3RhdGljIHJlYWRvbmx5IENoYXRBdHRhY2htZW50c0NvbnRleHQgPSBuZXcgTWVudUlkKCdDaGF0QXR0YWNobWVudHNDb250ZXh0Jyk7XG5cdHN0YXRpYyByZWFkb25seSBBY2Nlc3NpYmxlVmlldyA9IG5ldyBNZW51SWQoJ0FjY2Vzc2libGVWaWV3Jyk7XG5cdHN0YXRpYyByZWFkb25seSBNdWx0aURpZmZFZGl0b3JGaWxlVG9vbGJhciA9IG5ldyBNZW51SWQoJ011bHRpRGlmZkVkaXRvckZpbGVUb29sYmFyJyk7XG5cdHN0YXRpYyByZWFkb25seSBEaWZmRWRpdG9ySHVua1Rvb2xiYXIgPSBuZXcgTWVudUlkKCdEaWZmRWRpdG9ySHVua1Rvb2xiYXInKTtcblx0c3RhdGljIHJlYWRvbmx5IERpZmZFZGl0b3JTZWxlY3Rpb25Ub29sYmFyID0gbmV3IE1lbnVJZCgnRGlmZkVkaXRvclNlbGVjdGlvblRvb2xiYXInKTtcblxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgb3IgcmV1c2UgYSBgTWVudUlkYCB3aXRoIHRoZSBnaXZlbiBpZGVudGlmaWVyXG5cdCAqL1xuXHRzdGF0aWMgZm9yKGlkZW50aWZpZXI6IHN0cmluZyk6IE1lbnVJZCB7XG5cdFx0cmV0dXJuIE1lbnVJZC5faW5zdGFuY2VzLmdldChpZGVudGlmaWVyKSA/PyBuZXcgTWVudUlkKGlkZW50aWZpZXIpO1xuXHR9XG5cblx0cmVhZG9ubHkgaWQ6IHN0cmluZztcblxuXHQvKipcblx0ICogQ3JlYXRlIGEgbmV3IGBNZW51SWRgIHdpdGggdGhlIHVuaXF1ZSBpZGVudGlmaWVyLiBXaWxsIHRocm93IGlmIGEgbWVudVxuXHQgKiB3aXRoIHRoZSBpZGVudGlmaWVyIGFscmVhZHkgZXhpc3RzLCB1c2UgYE1lbnVJZC5mb3IoaWRlbnQpYCBvciBhIHVuaXF1ZVxuXHQgKiBpZGVudGlmaWVyXG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihpZGVudGlmaWVyOiBzdHJpbmcpIHtcblx0XHRpZiAoTWVudUlkLl9pbnN0YW5jZXMuaGFzKGlkZW50aWZpZXIpKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGBNZW51SWQgd2l0aCBpZGVudGlmaWVyICcke2lkZW50aWZpZXJ9JyBhbHJlYWR5IGV4aXN0cy4gVXNlIE1lbnVJZC5mb3IoaWRlbnQpIG9yIGEgdW5pcXVlIGlkZW50aWZpZXJgKTtcblx0XHR9XG5cdFx0TWVudUlkLl9pbnN0YW5jZXMuc2V0KGlkZW50aWZpZXIsIHRoaXMpO1xuXHRcdHRoaXMuaWQgPSBpZGVudGlmaWVyO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1lbnVBY3Rpb25PcHRpb25zIHtcblx0YXJnPzogYW55O1xuXHRzaG91bGRGb3J3YXJkQXJncz86IGJvb2xlYW47XG5cdHJlbmRlclNob3J0VGl0bGU/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElNZW51Q2hhbmdlRXZlbnQge1xuXHRyZWFkb25seSBtZW51OiBJTWVudTtcblx0cmVhZG9ubHkgaXNTdHJ1Y3R1cmFsQ2hhbmdlOiBib29sZWFuO1xuXHRyZWFkb25seSBpc1RvZ2dsZUNoYW5nZTogYm9vbGVhbjtcblx0cmVhZG9ubHkgaXNFbmFibGVtZW50Q2hhbmdlOiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElNZW51IGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8SU1lbnVDaGFuZ2VFdmVudD47XG5cdGdldEFjdGlvbnMob3B0aW9ucz86IElNZW51QWN0aW9uT3B0aW9ucyk6IFtzdHJpbmcsIEFycmF5PE1lbnVJdGVtQWN0aW9uIHwgU3VibWVudUl0ZW1BY3Rpb24+XVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElNZW51RGF0YSB7XG5cdGNvbnRleHRzOiBSZWFkb25seVNldDxzdHJpbmc+O1xuXHRhY3Rpb25zOiBbc3RyaW5nLCBBcnJheTxNZW51SXRlbUFjdGlvbiB8IFN1Ym1lbnVJdGVtQWN0aW9uPl1bXTtcbn1cblxuZXhwb3J0IGNvbnN0IElNZW51U2VydmljZSA9IGNyZWF0ZURlY29yYXRvcjxJTWVudVNlcnZpY2U+KCdtZW51U2VydmljZScpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElNZW51Q3JlYXRlT3B0aW9ucyB7XG5cdGVtaXRFdmVudHNGb3JTdWJtZW51Q2hhbmdlcz86IGJvb2xlYW47XG5cdGV2ZW50RGVib3VuY2VEZWxheT86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTWVudVNlcnZpY2Uge1xuXG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHQvKipcblx0ICogQ29uc2lkZXIgdXNpbmcgZ2V0TWVudUFjdGlvbnMgaWYgeW91IGRvbid0IG5lZWQgdG8gbGlzdGVuIHRvIGV2ZW50cy5cblx0ICpcblx0ICogQ3JlYXRlIGEgbmV3IG1lbnUgZm9yIHRoZSBnaXZlbiBtZW51IGlkZW50aWZpZXIuIEEgbWVudSBzZW5kcyBldmVudHMgd2hlbiBpdCdzIGVudHJpZXNcblx0ICogaGF2ZSBjaGFuZ2VkIChwbGFjZW1lbnQsIGVuYWJsZW1lbnQsIGNoZWNrZWQtc3RhdGUpLiBCeSBkZWZhdWx0IGl0IGRvZXMgbm90IHNlbmQgZXZlbnRzIGZvclxuXHQgKiBzdWJtZW51IGVudHJpZXMuIFRoYXQgaXMgbW9yZSBleHBlbnNpdmUgYW5kIG11c3QgYmUgZXhwbGljaXRseSBlbmFibGVkIHdpdGggdGhlXG5cdCAqIGBlbWl0RXZlbnRzRm9yU3VibWVudUNoYW5nZXNgIGZsYWcuXG5cdCAqL1xuXHRjcmVhdGVNZW51KGlkOiBNZW51SWQsIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsIG9wdGlvbnM/OiBJTWVudUNyZWF0ZU9wdGlvbnMpOiBJTWVudTtcblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIG5ldyBtZW51LCBnZXRzIHRoZSBhY3Rpb25zLCBhbmQgdGhlbiBkaXNwb3NlcyBvZiB0aGUgbWVudS5cblx0ICovXG5cdGdldE1lbnVBY3Rpb25zKGlkOiBNZW51SWQsIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsIG9wdGlvbnM/OiBJTWVudUFjdGlvbk9wdGlvbnMpOiBbc3RyaW5nLCBBcnJheTxNZW51SXRlbUFjdGlvbiB8IFN1Ym1lbnVJdGVtQWN0aW9uPl1bXTtcblxuXHQvKipcblx0ICogR2V0cyB0aGUgbmFtZXMgb2YgdGhlIGNvbnRleHRzIHRoYXQgdGhpcyBtZW51IGxpc3RlbnMgb24uXG5cdCAqL1xuXHRnZXRNZW51Q29udGV4dHMoaWQ6IE1lbnVJZCk6IFJlYWRvbmx5U2V0PHN0cmluZz47XG5cblx0LyoqXG5cdCAqIFJlc2V0ICoqYWxsKiogbWVudSBpdGVtIGhpZGRlbiBzdGF0ZXMuXG5cdCAqL1xuXHRyZXNldEhpZGRlblN0YXRlcygpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBSZXNldCB0aGUgbWVudSdzIGhpZGRlbiBzdGF0ZXMuXG5cdCAqL1xuXHRyZXNldEhpZGRlblN0YXRlcyhtZW51SWRzOiByZWFkb25seSBNZW51SWRbXSB8IHVuZGVmaW5lZCk6IHZvaWQ7XG59XG5cbnR5cGUgSUNvbW1hbmRzTWFwID0gTWFwPHN0cmluZywgSUNvbW1hbmRBY3Rpb24+O1xuXG5leHBvcnQgaW50ZXJmYWNlIElNZW51UmVnaXN0cnlDaGFuZ2VFdmVudCB7XG5cdGhhcyhpZDogTWVudUlkKTogYm9vbGVhbjtcbn1cblxuY2xhc3MgTWVudVJlZ2lzdHJ5Q2hhbmdlRXZlbnQge1xuXG5cdHByaXZhdGUgc3RhdGljIF9hbGwgPSBuZXcgTWFwPE1lbnVJZCwgTWVudVJlZ2lzdHJ5Q2hhbmdlRXZlbnQ+KCk7XG5cblx0c3RhdGljIGZvcihpZDogTWVudUlkKTogTWVudVJlZ2lzdHJ5Q2hhbmdlRXZlbnQge1xuXHRcdGxldCB2YWx1ZSA9IHRoaXMuX2FsbC5nZXQoaWQpO1xuXHRcdGlmICghdmFsdWUpIHtcblx0XHRcdHZhbHVlID0gbmV3IE1lbnVSZWdpc3RyeUNoYW5nZUV2ZW50KGlkKTtcblx0XHRcdHRoaXMuX2FsbC5zZXQoaWQsIHZhbHVlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG5cblx0c3RhdGljIG1lcmdlKGV2ZW50czogSU1lbnVSZWdpc3RyeUNoYW5nZUV2ZW50W10pOiBJTWVudVJlZ2lzdHJ5Q2hhbmdlRXZlbnQge1xuXHRcdGNvbnN0IGlkcyA9IG5ldyBTZXQ8TWVudUlkPigpO1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBldmVudHMpIHtcblx0XHRcdGlmIChpdGVtIGluc3RhbmNlb2YgTWVudVJlZ2lzdHJ5Q2hhbmdlRXZlbnQpIHtcblx0XHRcdFx0aWRzLmFkZChpdGVtLmlkKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGlkcztcblx0fVxuXG5cdHJlYWRvbmx5IGhhczogKGlkOiBNZW51SWQpID0+IGJvb2xlYW47XG5cblx0cHJpdmF0ZSBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGlkOiBNZW51SWQpIHtcblx0XHR0aGlzLmhhcyA9IGNhbmRpZGF0ZSA9PiBjYW5kaWRhdGUgPT09IGlkO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1lbnVSZWdpc3RyeSB7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlTWVudTogRXZlbnQ8SU1lbnVSZWdpc3RyeUNoYW5nZUV2ZW50Pjtcblx0YWRkQ29tbWFuZCh1c2VyQ29tbWFuZDogSUNvbW1hbmRBY3Rpb24pOiBJRGlzcG9zYWJsZTtcblx0Z2V0Q29tbWFuZChpZDogc3RyaW5nKTogSUNvbW1hbmRBY3Rpb24gfCB1bmRlZmluZWQ7XG5cdGdldENvbW1hbmRzKCk6IElDb21tYW5kc01hcDtcblxuXHQvKipcblx0ICogQGRlcHJlY2F0ZWQgVXNlIGBhcHBlbmRNZW51SXRlbWAgb3IgbW9zdCBsaWtlbHkgdXNlIGByZWdpc3RlckFjdGlvbjJgIGluc3RlYWQuIFRoZXJlIHNob3VsZCBiZSBubyBzdHJvbmdcblx0ICogcmVhc29uIHRvIHVzZSB0aGlzIGRpcmVjdGx5LlxuXHQgKi9cblx0YXBwZW5kTWVudUl0ZW1zKGl0ZW1zOiBJdGVyYWJsZTx7IGlkOiBNZW51SWQ7IGl0ZW06IElNZW51SXRlbSB8IElTdWJtZW51SXRlbSB9Pik6IElEaXNwb3NhYmxlO1xuXHRhcHBlbmRNZW51SXRlbShtZW51OiBNZW51SWQsIGl0ZW06IElNZW51SXRlbSB8IElTdWJtZW51SXRlbSk6IElEaXNwb3NhYmxlO1xuXHRnZXRNZW51SXRlbXMobG9jOiBNZW51SWQpOiBBcnJheTxJTWVudUl0ZW0gfCBJU3VibWVudUl0ZW0+O1xufVxuXG5leHBvcnQgY29uc3QgTWVudVJlZ2lzdHJ5OiBJTWVudVJlZ2lzdHJ5ID0gbmV3IGNsYXNzIGltcGxlbWVudHMgSU1lbnVSZWdpc3RyeSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY29tbWFuZHMgPSBuZXcgTWFwPHN0cmluZywgSUNvbW1hbmRBY3Rpb24+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX21lbnVJdGVtcyA9IG5ldyBNYXA8TWVudUlkLCBMaW5rZWRMaXN0PElNZW51SXRlbSB8IElTdWJtZW51SXRlbT4+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlTWVudSA9IG5ldyBNaWNyb3Rhc2tFbWl0dGVyPElNZW51UmVnaXN0cnlDaGFuZ2VFdmVudD4oe1xuXHRcdG1lcmdlOiBNZW51UmVnaXN0cnlDaGFuZ2VFdmVudC5tZXJnZVxuXHR9KTtcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZU1lbnU6IEV2ZW50PElNZW51UmVnaXN0cnlDaGFuZ2VFdmVudD4gPSB0aGlzLl9vbkRpZENoYW5nZU1lbnUuZXZlbnQ7XG5cblx0YWRkQ29tbWFuZChjb21tYW5kOiBJQ29tbWFuZEFjdGlvbik6IElEaXNwb3NhYmxlIHtcblx0XHR0aGlzLl9jb21tYW5kcy5zZXQoY29tbWFuZC5pZCwgY29tbWFuZCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VNZW51LmZpcmUoTWVudVJlZ2lzdHJ5Q2hhbmdlRXZlbnQuZm9yKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSkpO1xuXG5cdFx0cmV0dXJuIG1hcmtBc1NpbmdsZXRvbih0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX2NvbW1hbmRzLmRlbGV0ZShjb21tYW5kLmlkKSkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZU1lbnUuZmlyZShNZW51UmVnaXN0cnlDaGFuZ2VFdmVudC5mb3IoTWVudUlkLkNvbW1hbmRQYWxldHRlKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0Z2V0Q29tbWFuZChpZDogc3RyaW5nKTogSUNvbW1hbmRBY3Rpb24gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9jb21tYW5kcy5nZXQoaWQpO1xuXHR9XG5cblx0Z2V0Q29tbWFuZHMoKTogSUNvbW1hbmRzTWFwIHtcblx0XHRjb25zdCBtYXAgPSBuZXcgTWFwPHN0cmluZywgSUNvbW1hbmRBY3Rpb24+KCk7XG5cdFx0dGhpcy5fY29tbWFuZHMuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4gbWFwLnNldChrZXksIHZhbHVlKSk7XG5cdFx0cmV0dXJuIG1hcDtcblx0fVxuXG5cdGFwcGVuZE1lbnVJdGVtKGlkOiBNZW51SWQsIGl0ZW06IElNZW51SXRlbSB8IElTdWJtZW51SXRlbSk6IElEaXNwb3NhYmxlIHtcblx0XHRsZXQgbGlzdCA9IHRoaXMuX21lbnVJdGVtcy5nZXQoaWQpO1xuXHRcdGlmICghbGlzdCkge1xuXHRcdFx0bGlzdCA9IG5ldyBMaW5rZWRMaXN0KCk7XG5cdFx0XHR0aGlzLl9tZW51SXRlbXMuc2V0KGlkLCBsaXN0KTtcblx0XHR9XG5cdFx0Y29uc3Qgcm0gPSBsaXN0LnB1c2goaXRlbSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VNZW51LmZpcmUoTWVudVJlZ2lzdHJ5Q2hhbmdlRXZlbnQuZm9yKGlkKSk7XG5cdFx0cmV0dXJuIG1hcmtBc1NpbmdsZXRvbih0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0cm0oKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlTWVudS5maXJlKE1lbnVSZWdpc3RyeUNoYW5nZUV2ZW50LmZvcihpZCkpO1xuXHRcdH0pKTtcblx0fVxuXG5cdGFwcGVuZE1lbnVJdGVtcyhpdGVtczogSXRlcmFibGU8eyBpZDogTWVudUlkOyBpdGVtOiBJTWVudUl0ZW0gfCBJU3VibWVudUl0ZW0gfT4pOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGZvciAoY29uc3QgeyBpZCwgaXRlbSB9IG9mIGl0ZW1zKSB7XG5cdFx0XHRyZXN1bHQuYWRkKHRoaXMuYXBwZW5kTWVudUl0ZW0oaWQsIGl0ZW0pKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGdldE1lbnVJdGVtcyhpZDogTWVudUlkKTogQXJyYXk8SU1lbnVJdGVtIHwgSVN1Ym1lbnVJdGVtPiB7XG5cdFx0bGV0IHJlc3VsdDogQXJyYXk8SU1lbnVJdGVtIHwgSVN1Ym1lbnVJdGVtPjtcblx0XHRpZiAodGhpcy5fbWVudUl0ZW1zLmhhcyhpZCkpIHtcblx0XHRcdHJlc3VsdCA9IFsuLi50aGlzLl9tZW51SXRlbXMuZ2V0KGlkKSFdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHQgPSBbXTtcblx0XHR9XG5cdFx0aWYgKGlkID09PSBNZW51SWQuQ29tbWFuZFBhbGV0dGUpIHtcblx0XHRcdC8vIENvbW1hbmRQYWxldHRlIGlzIHNwZWNpYWwgYmVjYXVzZSBpdCBzaG93c1xuXHRcdFx0Ly8gYWxsIGNvbW1hbmRzIGJ5IGRlZmF1bHRcblx0XHRcdHRoaXMuX2FwcGVuZEltcGxpY2l0SXRlbXMocmVzdWx0KTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgX2FwcGVuZEltcGxpY2l0SXRlbXMocmVzdWx0OiBBcnJheTxJTWVudUl0ZW0gfCBJU3VibWVudUl0ZW0+KSB7XG5cdFx0Y29uc3Qgc2V0ID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgcmVzdWx0KSB7XG5cdFx0XHRpZiAoaXNJTWVudUl0ZW0oaXRlbSkpIHtcblx0XHRcdFx0c2V0LmFkZChpdGVtLmNvbW1hbmQuaWQpO1xuXHRcdFx0XHRpZiAoaXRlbS5hbHQpIHtcblx0XHRcdFx0XHRzZXQuYWRkKGl0ZW0uYWx0LmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9jb21tYW5kcy5mb3JFYWNoKChjb21tYW5kLCBpZCkgPT4ge1xuXHRcdFx0aWYgKCFzZXQuaGFzKGlkKSkge1xuXHRcdFx0XHRyZXN1bHQucHVzaCh7IGNvbW1hbmQgfSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn07XG5cbmV4cG9ydCBjbGFzcyBTdWJtZW51SXRlbUFjdGlvbiBleHRlbmRzIFN1Ym1lbnVBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGl0ZW06IElTdWJtZW51SXRlbSxcblx0XHRyZWFkb25seSBoaWRlQWN0aW9uczogSU1lbnVJdGVtSGlkZSB8IHVuZGVmaW5lZCxcblx0XHRhY3Rpb25zOiByZWFkb25seSBJQWN0aW9uW10sXG5cdCkge1xuXHRcdHN1cGVyKGBzdWJtZW51aXRlbS4ke2l0ZW0uc3VibWVudS5pZH1gLCB0eXBlb2YgaXRlbS50aXRsZSA9PT0gJ3N0cmluZycgPyBpdGVtLnRpdGxlIDogaXRlbS50aXRsZS52YWx1ZSwgYWN0aW9ucywgJ3N1Ym1lbnUnKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElNZW51SXRlbUhpZGUge1xuXHRyZWFkb25seSBpc0hpZGRlbjogYm9vbGVhbjtcblx0cmVhZG9ubHkgaGlkZTogSUFjdGlvbjtcblx0cmVhZG9ubHkgdG9nZ2xlOiBJQWN0aW9uO1xufVxuXG4vLyBpbXBsZW1lbnRzIElBY3Rpb24sIGRvZXMgTk9UIGV4dGVuZCBBY3Rpb24sIHNvIHRoYXQgbm8gb25lXG4vLyBzdWJzY3JpYmVzIHRvIGV2ZW50cyBvZiBBY3Rpb24gb3IgbW9kaWZpZWQgcHJvcGVydGllc1xuZXhwb3J0IGNsYXNzIE1lbnVJdGVtQWN0aW9uIGltcGxlbWVudHMgSUFjdGlvbiB7XG5cblx0c3RhdGljIGxhYmVsKGFjdGlvbjogSUNvbW1hbmRBY3Rpb24sIG9wdGlvbnM/OiBJTWVudUFjdGlvbk9wdGlvbnMpOiBzdHJpbmcge1xuXHRcdHJldHVybiBvcHRpb25zPy5yZW5kZXJTaG9ydFRpdGxlICYmIGFjdGlvbi5zaG9ydFRpdGxlXG5cdFx0XHQ/ICh0eXBlb2YgYWN0aW9uLnNob3J0VGl0bGUgPT09ICdzdHJpbmcnID8gYWN0aW9uLnNob3J0VGl0bGUgOiBhY3Rpb24uc2hvcnRUaXRsZS52YWx1ZSlcblx0XHRcdDogKHR5cGVvZiBhY3Rpb24udGl0bGUgPT09ICdzdHJpbmcnID8gYWN0aW9uLnRpdGxlIDogYWN0aW9uLnRpdGxlLnZhbHVlKTtcblx0fVxuXG5cdHJlYWRvbmx5IGl0ZW06IElDb21tYW5kQWN0aW9uO1xuXHRyZWFkb25seSBhbHQ6IE1lbnVJdGVtQWN0aW9uIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29wdGlvbnM6IElNZW51QWN0aW9uT3B0aW9ucyB8IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXHRyZWFkb25seSBsYWJlbDogc3RyaW5nO1xuXHRyZWFkb25seSB0b29sdGlwOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGNsYXNzOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGNoZWNrZWQ/OiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGl0ZW06IElDb21tYW5kQWN0aW9uLFxuXHRcdGFsdDogSUNvbW1hbmRBY3Rpb24gfCB1bmRlZmluZWQsXG5cdFx0b3B0aW9uczogSU1lbnVBY3Rpb25PcHRpb25zIHwgdW5kZWZpbmVkLFxuXHRcdHJlYWRvbmx5IGhpZGVBY3Rpb25zOiBJTWVudUl0ZW1IaWRlIHwgdW5kZWZpbmVkLFxuXHRcdHJlYWRvbmx5IG1lbnVLZXliaW5kaW5nOiBJQWN0aW9uIHwgdW5kZWZpbmVkLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgX2NvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2Vcblx0KSB7XG5cdFx0dGhpcy5pZCA9IGl0ZW0uaWQ7XG5cdFx0dGhpcy5sYWJlbCA9IE1lbnVJdGVtQWN0aW9uLmxhYmVsKGl0ZW0sIG9wdGlvbnMpO1xuXHRcdHRoaXMudG9vbHRpcCA9ICh0eXBlb2YgaXRlbS50b29sdGlwID09PSAnc3RyaW5nJyA/IGl0ZW0udG9vbHRpcCA6IGl0ZW0udG9vbHRpcD8udmFsdWUpID8/ICcnO1xuXHRcdHRoaXMuZW5hYmxlZCA9ICFpdGVtLnByZWNvbmRpdGlvbiB8fCBjb250ZXh0S2V5U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKGl0ZW0ucHJlY29uZGl0aW9uKTtcblx0XHR0aGlzLmNoZWNrZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRsZXQgaWNvbjogVGhlbWVJY29uIHwgdW5kZWZpbmVkO1xuXG5cdFx0aWYgKGl0ZW0udG9nZ2xlZCkge1xuXHRcdFx0Y29uc3QgdG9nZ2xlZCA9ICgoaXRlbS50b2dnbGVkIGFzIHsgY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB9KS5jb25kaXRpb24gPyBpdGVtLnRvZ2dsZWQgOiB7IGNvbmRpdGlvbjogaXRlbS50b2dnbGVkIH0pIGFzIHtcblx0XHRcdFx0Y29uZGl0aW9uOiBDb250ZXh0S2V5RXhwcmVzc2lvbjsgaWNvbj86IEljb247IHRvb2x0aXA/OiBzdHJpbmcgfCBJTG9jYWxpemVkU3RyaW5nOyB0aXRsZT86IHN0cmluZyB8IElMb2NhbGl6ZWRTdHJpbmc7XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5jaGVja2VkID0gY29udGV4dEtleVNlcnZpY2UuY29udGV4dE1hdGNoZXNSdWxlcyh0b2dnbGVkLmNvbmRpdGlvbik7XG5cdFx0XHRpZiAodGhpcy5jaGVja2VkICYmIHRvZ2dsZWQudG9vbHRpcCkge1xuXHRcdFx0XHR0aGlzLnRvb2x0aXAgPSB0eXBlb2YgdG9nZ2xlZC50b29sdGlwID09PSAnc3RyaW5nJyA/IHRvZ2dsZWQudG9vbHRpcCA6IHRvZ2dsZWQudG9vbHRpcC52YWx1ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuY2hlY2tlZCAmJiBUaGVtZUljb24uaXNUaGVtZUljb24odG9nZ2xlZC5pY29uKSkge1xuXHRcdFx0XHRpY29uID0gdG9nZ2xlZC5pY29uO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5jaGVja2VkICYmIHRvZ2dsZWQudGl0bGUpIHtcblx0XHRcdFx0dGhpcy5sYWJlbCA9IHR5cGVvZiB0b2dnbGVkLnRpdGxlID09PSAnc3RyaW5nJyA/IHRvZ2dsZWQudGl0bGUgOiB0b2dnbGVkLnRpdGxlLnZhbHVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghaWNvbikge1xuXHRcdFx0aWNvbiA9IFRoZW1lSWNvbi5pc1RoZW1lSWNvbihpdGVtLmljb24pID8gaXRlbS5pY29uIDogdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHRoaXMuaXRlbSA9IGl0ZW07XG5cdFx0dGhpcy5hbHQgPSBhbHQgPyBuZXcgTWVudUl0ZW1BY3Rpb24oYWx0LCB1bmRlZmluZWQsIG9wdGlvbnMsIGhpZGVBY3Rpb25zLCB1bmRlZmluZWQsIGNvbnRleHRLZXlTZXJ2aWNlLCBfY29tbWFuZFNlcnZpY2UpIDogdW5kZWZpbmVkO1xuXHRcdHRoaXMuX29wdGlvbnMgPSBvcHRpb25zO1xuXHRcdHRoaXMuY2xhc3MgPSBpY29uICYmIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShpY29uKTtcblxuXHR9XG5cblx0cnVuKC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bGV0IHJ1bkFyZ3M6IGFueVtdID0gW107XG5cblx0XHRpZiAodGhpcy5fb3B0aW9ucz8uYXJnKSB7XG5cdFx0XHRydW5BcmdzID0gWy4uLnJ1bkFyZ3MsIHRoaXMuX29wdGlvbnMuYXJnXTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fb3B0aW9ucz8uc2hvdWxkRm9yd2FyZEFyZ3MpIHtcblx0XHRcdHJ1bkFyZ3MgPSBbLi4ucnVuQXJncywgLi4uYXJnc107XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKHRoaXMuaWQsIC4uLnJ1bkFyZ3MpO1xuXHR9XG59XG5cbi8vI3JlZ2lvbiAtLS0gSUFjdGlvbjJcblxudHlwZSBPbmVPck48VD4gPSBUIHwgVFtdO1xuXG5pbnRlcmZhY2UgSUFjdGlvbjJDb21tb25PcHRpb25zIGV4dGVuZHMgSUNvbW1hbmRBY3Rpb24ge1xuXHQvKipcblx0ICogT25lIG9yIG1hbnkgbWVudSBpdGVtcy5cblx0ICovXG5cdG1lbnU/OiBPbmVPck48eyBpZDogTWVudUlkOyBwcmVjb25kaXRpb24/OiBudWxsIH0gJiBPbWl0PElNZW51SXRlbSwgJ2NvbW1hbmQnPj47XG5cblx0LyoqXG5cdCAqIE9uZSBrZXliaW5kaW5nLlxuXHQgKi9cblx0a2V5YmluZGluZz86IE9uZU9yTjxPbWl0PElLZXliaW5kaW5nUnVsZSwgJ2lkJz4+O1xufVxuXG5pbnRlcmZhY2UgSUJhc2VBY3Rpb24yT3B0aW9ucyBleHRlbmRzIElBY3Rpb24yQ29tbW9uT3B0aW9ucyB7XG5cblx0LyoqXG5cdCAqIFRoaXMgdHlwZSBpcyB1c2VkIHdoZW4gYW4gYWN0aW9uIGlzIG5vdCBnb2luZyB0byBzaG93IHVwIGluIHRoZSBjb21tYW5kIHBhbGV0dGUuXG5cdCAqIEluIHRoYXQgY2FzZSwgaXQncyBhYmxlIHRvIHVzZSBhIHN0cmluZyBmb3IgdGhlIGB0aXRsZWAgYW5kIGBjYXRlZ29yeWAgcHJvcGVydGllcy5cblx0ICovXG5cdGYxPzogZmFsc2U7XG59XG5cbmludGVyZmFjZSBJQ29tbWFuZFBhbGV0dGVPcHRpb25zIGV4dGVuZHMgSUFjdGlvbjJDb21tb25PcHRpb25zIHtcblxuXHQvKipcblx0ICogVGhlIHRpdGxlIG9mIHRoZSBjb21tYW5kIHRoYXQgd2lsbCBiZSBkaXNwbGF5ZWQgaW4gdGhlIGNvbW1hbmQgcGFsZXR0ZSBhZnRlciB0aGUgY2F0ZWdvcnkuXG5cdCAqICBUaGlzIG92ZXJyaWRlcyB7QGxpbmsgSUNvbW1hbmRBY3Rpb24udGl0bGV9IHRvIGVuc3VyZSBhIHN0cmluZyBpc24ndCB1c2VkIHNvIHRoYXQgdGhlIHRpdGxlXG5cdCAqICBpbmNsdWRlcyB0aGUgbG9jYWxpemVkIHZhbHVlIGFuZCB0aGUgb3JpZ2luYWwgdmFsdWUgZm9yIHVzZXJzIHVzaW5nIGxhbmd1YWdlIHBhY2tzLlxuXHQgKi9cblx0dGl0bGU6IElDb21tYW5kQWN0aW9uVGl0bGU7XG5cblx0LyoqXG5cdCAqIFRoZSBjYXRlZ29yeSBvZiB0aGUgY29tbWFuZCB0aGF0IHdpbGwgYmUgZGlzcGxheWVkIGluIHRoZSBjb21tYW5kIHBhbGV0dGUgYmVmb3JlIHRoZSB0aXRsZSBzdWZmaXhlZC5cblx0ICogd2l0aCBhIGNvbG9uIFRoaXMgb3ZlcnJpZGVzIHtAbGluayBJQ29tbWFuZEFjdGlvbi50aXRsZX0gdG8gZW5zdXJlIGEgc3RyaW5nIGlzbid0IHVzZWQgc28gdGhhdFxuXHQgKiB0aGUgdGl0bGUgaW5jbHVkZXMgdGhlIGxvY2FsaXplZCB2YWx1ZSBhbmQgdGhlIG9yaWdpbmFsIHZhbHVlIGZvciB1c2VycyB1c2luZyBsYW5ndWFnZSBwYWNrcy5cblx0ICovXG5cdGNhdGVnb3J5Pzoga2V5b2YgdHlwZW9mIENhdGVnb3JpZXMgfCBJTG9jYWxpemVkU3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBTaG9ydGhhbmQgdG8gYWRkIHRoaXMgY29tbWFuZCB0byB0aGUgY29tbWFuZCBwYWxldHRlLiBOb3RlOiB0aGlzIGlzIG5vdCB0aGUgb25seSB3YXkgdG8gZGVjbGFyZSB0aGF0XG5cdCAqIGEgY29tbWFuZCBzaG91bGQgYmUgaW4gdGhlIGNvbW1hbmQgcGFsZXR0ZS4uLiBob3dldmVyLCBlbmZvcmNpbmcgSUxvY2FsaXplZFN0cmluZyBpbiB0aGUgb3RoZXIgc2NlbmFyaW9zXG5cdCAqIGlzIG11Y2ggbW9yZSBjaGFsbGVuZ2luZyBhbmQgdGhpcyBnZXRzIHVzIG1vc3Qgb2YgdGhlIHdheSB0aGVyZS5cblx0ICovXG5cdGYxOiB0cnVlO1xufVxuXG5leHBvcnQgdHlwZSBJQWN0aW9uMk9wdGlvbnMgPSBJQ29tbWFuZFBhbGV0dGVPcHRpb25zIHwgSUJhc2VBY3Rpb24yT3B0aW9ucztcblxuZXhwb3J0IGludGVyZmFjZSBJQWN0aW9uMkYxUmVxdWlyZWRPcHRpb25zIHtcblx0dGl0bGU6IElDb21tYW5kQWN0aW9uVGl0bGU7XG5cdGNhdGVnb3J5Pzoga2V5b2YgdHlwZW9mIENhdGVnb3JpZXMgfCBJTG9jYWxpemVkU3RyaW5nO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IGRlc2M6IFJlYWRvbmx5PElBY3Rpb24yT3B0aW9ucz4pIHsgfVxuXHRhYnN0cmFjdCBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKTogdm9pZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyQWN0aW9uMihjdG9yOiB7IG5ldygpOiBBY3Rpb24yIH0pOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGRpc3Bvc2FibGVzOiBJRGlzcG9zYWJsZVtdID0gW107IC8vIG5vdCB1c2luZyBgRGlzcG9zYWJsZVN0b3JlYCB0byByZWR1Y2Ugc3RhcnR1cCBwZXJmIGNvc3Rcblx0Y29uc3QgYWN0aW9uID0gbmV3IGN0b3IoKTtcblxuXHRjb25zdCB7IGYxLCBtZW51LCBrZXliaW5kaW5nLCAuLi5jb21tYW5kIH0gPSBhY3Rpb24uZGVzYztcblxuXHRpZiAoQ29tbWFuZHNSZWdpc3RyeS5nZXRDb21tYW5kKGNvbW1hbmQuaWQpKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgcmVnaXN0ZXIgdHdvIGNvbW1hbmRzIHdpdGggdGhlIHNhbWUgaWQ6ICR7Y29tbWFuZC5pZH1gKTtcblx0fVxuXG5cdC8vIGNvbW1hbmRcblx0ZGlzcG9zYWJsZXMucHVzaChDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdFx0aWQ6IGNvbW1hbmQuaWQsXG5cdFx0aGFuZGxlcjogKGFjY2Vzc29yLCAuLi5hcmdzKSA9PiBhY3Rpb24ucnVuKGFjY2Vzc29yLCAuLi5hcmdzKSxcblx0XHRtZXRhZGF0YTogY29tbWFuZC5tZXRhZGF0YSA/PyB7IGRlc2NyaXB0aW9uOiBhY3Rpb24uZGVzYy50aXRsZSB9XG5cdH0pKTtcblxuXHQvLyBtZW51XG5cdGlmIChBcnJheS5pc0FycmF5KG1lbnUpKSB7XG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIG1lbnUpIHtcblx0XHRcdGRpc3Bvc2FibGVzLnB1c2goTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKGl0ZW0uaWQsIHsgY29tbWFuZDogeyAuLi5jb21tYW5kLCBwcmVjb25kaXRpb246IGl0ZW0ucHJlY29uZGl0aW9uID09PSBudWxsID8gdW5kZWZpbmVkIDogY29tbWFuZC5wcmVjb25kaXRpb24gfSwgLi4uaXRlbSB9KSk7XG5cdFx0fVxuXG5cdH0gZWxzZSBpZiAobWVudSkge1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKG1lbnUuaWQsIHsgY29tbWFuZDogeyAuLi5jb21tYW5kLCBwcmVjb25kaXRpb246IG1lbnUucHJlY29uZGl0aW9uID09PSBudWxsID8gdW5kZWZpbmVkIDogY29tbWFuZC5wcmVjb25kaXRpb24gfSwgLi4ubWVudSB9KSk7XG5cdH1cblx0aWYgKGYxKSB7XG5cdFx0ZGlzcG9zYWJsZXMucHVzaChNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkNvbW1hbmRQYWxldHRlLCB7IGNvbW1hbmQsIHdoZW46IGNvbW1hbmQucHJlY29uZGl0aW9uIH0pKTtcblx0XHRkaXNwb3NhYmxlcy5wdXNoKE1lbnVSZWdpc3RyeS5hZGRDb21tYW5kKGNvbW1hbmQpKTtcblx0fVxuXG5cdC8vIGtleWJpbmRpbmdcblx0aWYgKEFycmF5LmlzQXJyYXkoa2V5YmluZGluZykpIHtcblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2Yga2V5YmluZGluZykge1xuXHRcdFx0ZGlzcG9zYWJsZXMucHVzaChLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyS2V5YmluZGluZ1J1bGUoe1xuXHRcdFx0XHQuLi5pdGVtLFxuXHRcdFx0XHRpZDogY29tbWFuZC5pZCxcblx0XHRcdFx0d2hlbjogY29tbWFuZC5wcmVjb25kaXRpb24gPyBDb250ZXh0S2V5RXhwci5hbmQoY29tbWFuZC5wcmVjb25kaXRpb24sIGl0ZW0ud2hlbikgOiBpdGVtLndoZW5cblx0XHRcdH0pKTtcblx0XHR9XG5cdH0gZWxzZSBpZiAoa2V5YmluZGluZykge1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlcktleWJpbmRpbmdSdWxlKHtcblx0XHRcdC4uLmtleWJpbmRpbmcsXG5cdFx0XHRpZDogY29tbWFuZC5pZCxcblx0XHRcdHdoZW46IGNvbW1hbmQucHJlY29uZGl0aW9uID8gQ29udGV4dEtleUV4cHIuYW5kKGNvbW1hbmQucHJlY29uZGl0aW9uLCBrZXliaW5kaW5nLndoZW4pIDoga2V5YmluZGluZy53aGVuXG5cdFx0fSkpO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRkaXNwb3NlKCkge1xuXHRcdFx0ZGlzcG9zZShkaXNwb3NhYmxlcyk7XG5cdFx0fVxuXHR9O1xufVxuLy8jZW5kcmVnaW9uXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQWtCLHFCQUFxQjtBQUN2QyxTQUFnQix3QkFBd0I7QUFDeEMsU0FBUyxp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
