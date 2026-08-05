import { localize, localize2 } from "../../../../nls.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { registerWorkbenchContribution2, Extensions as WorkbenchExtensions, WorkbenchPhase } from "../../../common/contributions.js";
import { QuickDiffWorkbenchController } from "./quickDiffDecorator.js";
import { VIEWLET_ID, ISCMService, VIEW_PANE_ID, ISCMViewService, REPOSITORIES_VIEW_PANE_ID, HISTORY_VIEW_PANE_ID } from "../common/scm.js";
import { KeyMod, KeyCode } from "../../../../base/common/keyCodes.js";
import { MenuRegistry, MenuId } from "../../../../platform/actions/common/actions.js";
import { SCMActiveResourceContextKeyController, SCMActiveRepositoryController } from "./activity.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IContextKeyService, ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { SCMService } from "../common/scmService.js";
import { ViewContainerLocation, Extensions as ViewContainerExtensions } from "../../../common/views.js";
import { SCMViewPaneContainer } from "./scmViewPaneContainer.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { ModesRegistry } from "../../../../editor/common/languages/modesRegistry.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { ContextKeys, SCMViewPane } from "./scmViewPane.js";
import { RepositoryPicker, SCMViewService } from "./scmViewService.js";
import { SCMRepositoriesViewPane } from "./scmRepositoriesViewPane.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Context as SuggestContext } from "../../../../editor/contrib/suggest/browser/suggest.js";
import { MANAGE_TRUST_COMMAND_ID, WorkspaceTrustContext } from "../../workspace/common/workspace.js";
import { IQuickDiffService } from "../common/quickDiff.js";
import { QuickDiffService } from "../common/quickDiffService.js";
import { getActiveElement, isActiveElement } from "../../../../base/browser/dom.js";
import { SCMWorkingSetController } from "./workingSet.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { IListService, WorkbenchList } from "../../../../platform/list/browser/listService.js";
import { isSCMRepository } from "./util.js";
import { SCMHistoryViewPane } from "./scmHistoryViewPane.js";
import { QuickDiffModelService, IQuickDiffModelService } from "./quickDiffModel.js";
import { QuickDiffEditorController } from "./quickDiffWidget.js";
import { EditorContributionInstantiation, registerEditorContribution } from "../../../../editor/browser/editorExtensions.js";
import { RemoteNameContext } from "../../../common/contextkeys.js";
import { AccessibleViewRegistry } from "../../../../platform/accessibility/browser/accessibleViewRegistry.js";
import { SCMAccessibilityHelp } from "./scmAccessibilityHelp.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
ModesRegistry.registerLanguage({
  id: "scminput",
  extensions: [],
  aliases: [],
  // hide from language selector
  mimetypes: ["text/x-scm-input"]
});
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(QuickDiffWorkbenchController, LifecyclePhase.Restored);
registerEditorContribution(
  QuickDiffEditorController.ID,
  QuickDiffEditorController,
  EditorContributionInstantiation.AfterFirstRender
);
const sourceControlViewIcon = registerIcon("source-control-view-icon", Codicon.sourceControl, localize("sourceControlViewIcon", "View icon of the Source Control view."));
const viewContainer = Registry.as(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
  id: VIEWLET_ID,
  title: localize2("source control", "Source Control"),
  ctorDescriptor: new SyncDescriptor(SCMViewPaneContainer),
  storageId: "workbench.scm.views.state",
  icon: sourceControlViewIcon,
  alwaysUseContainerInfo: true,
  order: 2,
  hideIfEmpty: true
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: true });
const viewsRegistry = Registry.as(ViewContainerExtensions.ViewsRegistry);
const containerTitle = localize("source control view", "Source Control");
viewsRegistry.registerViewWelcomeContent(VIEW_PANE_ID, {
  content: localize("no open repo", "No source control providers registered."),
  when: "default"
});
viewsRegistry.registerViewWelcomeContent(VIEW_PANE_ID, {
  content: localize("no open repo in an untrusted workspace", "None of the registered source control providers work in Restricted Mode."),
  when: ContextKeyExpr.and(ContextKeyExpr.equals("scm.providerCount", 0), WorkspaceTrustContext.IsEnabled, WorkspaceTrustContext.IsTrusted.toNegated())
});
viewsRegistry.registerViewWelcomeContent(VIEW_PANE_ID, {
  content: `[${localize("manageWorkspaceTrustAction", "Manage Workspace Trust")}](command:${MANAGE_TRUST_COMMAND_ID})`,
  when: ContextKeyExpr.and(ContextKeyExpr.equals("scm.providerCount", 0), WorkspaceTrustContext.IsEnabled, WorkspaceTrustContext.IsTrusted.toNegated())
});
viewsRegistry.registerViewWelcomeContent(HISTORY_VIEW_PANE_ID, {
  content: localize("no history items", "The selected source control provider does not have any source control history items."),
  when: ContextKeys.SCMHistoryItemCount.isEqualTo(0)
});
viewsRegistry.registerViews([{
  id: REPOSITORIES_VIEW_PANE_ID,
  containerTitle,
  name: localize2("scmRepositories", "Repositories"),
  singleViewPaneContainerTitle: localize("source control repositories", "Source Control Repositories"),
  ctorDescriptor: new SyncDescriptor(SCMRepositoriesViewPane),
  canToggleVisibility: true,
  hideByDefault: true,
  canMoveView: true,
  weight: 20,
  order: 0,
  when: ContextKeyExpr.and(ContextKeyExpr.has("scm.providerCount"), ContextKeyExpr.notEquals("scm.providerCount", 0)),
  // readonly when = ContextKeyExpr.or(ContextKeyExpr.equals('config.scm.alwaysShowProviders', true), ContextKeyExpr.and(ContextKeyExpr.notEquals('scm.providerCount', 0), ContextKeyExpr.notEquals('scm.providerCount', 1)));
  containerIcon: sourceControlViewIcon
}], viewContainer);
viewsRegistry.registerViews([{
  id: VIEW_PANE_ID,
  containerTitle,
  name: localize2("scmChanges", "Changes"),
  singleViewPaneContainerTitle: containerTitle,
  ctorDescriptor: new SyncDescriptor(SCMViewPane),
  canToggleVisibility: true,
  canMoveView: true,
  weight: 40,
  order: 1,
  containerIcon: sourceControlViewIcon,
  openCommandActionDescriptor: {
    id: viewContainer.id,
    mnemonicTitle: localize({ key: "miViewSCM", comment: ["&& denotes a mnemonic"] }, "Source &&Control"),
    keybindings: {
      primary: 0,
      win: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyG },
      linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyG },
      mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyG }
    },
    order: 2
  }
}], viewContainer);
viewsRegistry.registerViews([{
  id: HISTORY_VIEW_PANE_ID,
  containerTitle,
  name: localize2("scmGraph", "Graph"),
  singleViewPaneContainerTitle: localize("source control graph", "Source Control Graph"),
  ctorDescriptor: new SyncDescriptor(SCMHistoryViewPane),
  canToggleVisibility: true,
  canMoveView: true,
  weight: 40,
  order: 2,
  when: ContextKeyExpr.and(
    ContextKeyExpr.has("scm.historyProviderCount"),
    ContextKeyExpr.notEquals("scm.historyProviderCount", 0)
  ),
  containerIcon: sourceControlViewIcon
}], viewContainer);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(SCMActiveRepositoryController, LifecyclePhase.Restored);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(SCMActiveResourceContextKeyController, LifecyclePhase.Restored);
registerWorkbenchContribution2(
  SCMWorkingSetController.ID,
  SCMWorkingSetController,
  WorkbenchPhase.AfterRestored
);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  id: "scm",
  order: 5,
  title: localize("scmConfigurationTitle", "Source Control"),
  type: "object",
  scope: ConfigurationScope.RESOURCE,
  properties: {
    "scm.diffDecorations": {
      type: "string",
      enum: ["all", "gutter", "overview", "minimap", "none"],
      enumDescriptions: [
        localize("scm.diffDecorations.all", "Show the diff decorations in all available locations."),
        localize("scm.diffDecorations.gutter", "Show the diff decorations only in the editor gutter."),
        localize("scm.diffDecorations.overviewRuler", "Show the diff decorations only in the overview ruler."),
        localize("scm.diffDecorations.minimap", "Show the diff decorations only in the minimap."),
        localize("scm.diffDecorations.none", "Do not show the diff decorations.")
      ],
      default: "all",
      description: localize("diffDecorations", "Controls diff decorations in the editor.")
    },
    "scm.diffDecorationsGutterWidth": {
      type: "number",
      enum: [1, 2, 3, 4, 5],
      default: 3,
      description: localize("diffGutterWidth", "Controls the width(px) of diff decorations in gutter (added & modified).")
    },
    "scm.diffDecorationsGutterVisibility": {
      type: "string",
      enum: ["always", "hover"],
      enumDescriptions: [
        localize("scm.diffDecorationsGutterVisibility.always", "Show the diff decorator in the gutter at all times."),
        localize("scm.diffDecorationsGutterVisibility.hover", "Show the diff decorator in the gutter only on hover.")
      ],
      description: localize("scm.diffDecorationsGutterVisibility", "Controls the visibility of the Source Control diff decorator in the gutter."),
      default: "always"
    },
    "scm.diffDecorationsGutterAction": {
      type: "string",
      enum: ["diff", "none"],
      enumDescriptions: [
        localize("scm.diffDecorationsGutterAction.diff", "Show the inline diff Peek view on click."),
        localize("scm.diffDecorationsGutterAction.none", "Do nothing.")
      ],
      description: localize("scm.diffDecorationsGutterAction", "Controls the behavior of Source Control diff gutter decorations."),
      default: "diff"
    },
    "scm.diffDecorationsGutterPattern": {
      type: "object",
      description: localize("diffGutterPattern", "Controls whether a pattern is used for the diff decorations in gutter."),
      additionalProperties: false,
      properties: {
        "added": {
          type: "boolean",
          description: localize("diffGutterPatternAdded", "Use pattern for the diff decorations in gutter for added lines.")
        },
        "modified": {
          type: "boolean",
          description: localize("diffGutterPatternModifed", "Use pattern for the diff decorations in gutter for modified lines.")
        }
      },
      default: {
        "added": false,
        "modified": true
      }
    },
    "scm.diffDecorationsIgnoreTrimWhitespace": {
      type: "string",
      enum: ["true", "false", "inherit"],
      enumDescriptions: [
        localize("scm.diffDecorationsIgnoreTrimWhitespace.true", "Ignore leading and trailing whitespace."),
        localize("scm.diffDecorationsIgnoreTrimWhitespace.false", "Do not ignore leading and trailing whitespace."),
        localize("scm.diffDecorationsIgnoreTrimWhitespace.inherit", "Inherit from `diffEditor.ignoreTrimWhitespace`.")
      ],
      description: localize("diffDecorationsIgnoreTrimWhitespace", "Controls whether leading and trailing whitespace is ignored in Source Control diff gutter decorations."),
      default: "false"
    },
    "scm.alwaysShowActions": {
      type: "boolean",
      description: localize("alwaysShowActions", "Controls whether inline actions are always visible in the Source Control view."),
      default: false
    },
    "scm.countBadge": {
      type: "string",
      enum: ["all", "focused", "off"],
      enumDescriptions: [
        localize("scm.countBadge.all", "Show the sum of all Source Control Provider count badges."),
        localize("scm.countBadge.focused", "Show the count badge of the focused Source Control Provider."),
        localize("scm.countBadge.off", "Disable the Source Control count badge.")
      ],
      description: localize("scm.countBadge", "Controls the count badge on the Source Control icon on the Activity Bar."),
      default: "all"
    },
    "scm.providerCountBadge": {
      type: "string",
      enum: ["hidden", "auto", "visible"],
      enumDescriptions: [
        localize("scm.providerCountBadge.hidden", "Hide Source Control Provider count badges."),
        localize("scm.providerCountBadge.auto", "Only show count badge for Source Control Provider when non-zero."),
        localize("scm.providerCountBadge.visible", "Show Source Control Provider count badges.")
      ],
      markdownDescription: localize("scm.providerCountBadge", "Controls the count badges on Source Control Provider headers. These headers appear in the Source Control view when there is more than one provider or when the {0} setting is enabled, and in the Source Control Repositories view.", "`#scm.alwaysShowRepositories#`"),
      default: "hidden"
    },
    "scm.defaultViewMode": {
      type: "string",
      enum: ["tree", "list"],
      enumDescriptions: [
        localize("scm.defaultViewMode.tree", "Show the repository changes as a tree."),
        localize("scm.defaultViewMode.list", "Show the repository changes as a list.")
      ],
      description: localize("scm.defaultViewMode", "Controls the default Source Control repository view mode."),
      default: "list"
    },
    "scm.defaultViewSortKey": {
      type: "string",
      enum: ["name", "path", "status"],
      enumDescriptions: [
        localize("scm.defaultViewSortKey.name", "Sort the repository changes by file name."),
        localize("scm.defaultViewSortKey.path", "Sort the repository changes by path."),
        localize("scm.defaultViewSortKey.status", "Sort the repository changes by Source Control status.")
      ],
      description: localize("scm.defaultViewSortKey", "Controls the default Source Control repository changes sort order when viewed as a list."),
      default: "path"
    },
    "scm.autoReveal": {
      type: "boolean",
      description: localize("autoReveal", "Controls whether the Source Control view should automatically reveal and select files when opening them."),
      default: true
    },
    "scm.inputFontFamily": {
      type: "string",
      markdownDescription: localize("inputFontFamily", "Controls the font for the input message. Use `default` for the workbench user interface font family, `editor` for the `#editor.fontFamily#`'s value, or a custom font family."),
      default: "default"
    },
    "scm.inputFontSize": {
      type: "number",
      markdownDescription: localize("inputFontSize", "Controls the font size for the input message in pixels."),
      default: 13
    },
    "scm.inputMaxLineCount": {
      type: "number",
      markdownDescription: localize("inputMaxLines", "Controls the maximum number of lines that the input will auto-grow to."),
      minimum: 1,
      maximum: 50,
      default: 10
    },
    "scm.inputMinLineCount": {
      type: "number",
      markdownDescription: localize("inputMinLines", "Controls the minimum number of lines that the input will auto-grow from."),
      minimum: 1,
      maximum: 50,
      default: 1
    },
    "scm.alwaysShowRepositories": {
      type: "boolean",
      markdownDescription: localize("alwaysShowRepository", "Controls whether repositories should always be visible in the Source Control view."),
      default: false
    },
    "scm.repositories.sortOrder": {
      type: "string",
      enum: ["discovery time", "name", "path"],
      enumDescriptions: [
        localize("scm.repositoriesSortOrder.discoveryTime", "Repositories in the Source Control Repositories view are sorted by discovery time. Repositories in the Source Control view are sorted in the order that they were selected."),
        localize("scm.repositoriesSortOrder.name", "Repositories in the Source Control Repositories and Source Control views are sorted by repository name."),
        localize("scm.repositoriesSortOrder.path", "Repositories in the Source Control Repositories and Source Control views are sorted by repository path.")
      ],
      description: localize("repositoriesSortOrder", "Controls the sort order of the repositories in the source control repositories view."),
      default: "discovery time"
    },
    "scm.repositories.visible": {
      type: "number",
      description: localize("providersVisible", "Controls how many repositories are visible in the Source Control Repositories section. Set to 0, to be able to manually resize the view."),
      default: 10
    },
    "scm.showActionButton": {
      type: "boolean",
      markdownDescription: localize("showActionButton", "Controls whether an action button can be shown in the Source Control view."),
      default: true
    },
    "scm.showInputActionButton": {
      type: "boolean",
      markdownDescription: localize("showInputActionButton", "Controls whether an action button can be shown in the Source Control input."),
      default: true
    },
    "scm.workingSets.enabled": {
      type: "boolean",
      description: localize("scm.workingSets.enabled", "Controls whether to store editor working sets when switching between source control history item groups."),
      default: false
    },
    "scm.workingSets.default": {
      type: "string",
      enum: ["empty", "current"],
      enumDescriptions: [
        localize("scm.workingSets.default.empty", "Use an empty working set when switching to a source control history item group that does not have a working set."),
        localize("scm.workingSets.default.current", "Use the current working set when switching to a source control history item group that does not have a working set.")
      ],
      description: localize("scm.workingSets.default", "Controls the default working set to use when switching to a source control history item group that does not have a working set."),
      default: "current"
    },
    "scm.compactFolders": {
      type: "boolean",
      description: localize("scm.compactFolders", "Controls whether the Source Control view should render folders in a compact form. In such a form, single child folders will be compressed in a combined tree element."),
      default: true
    },
    "scm.graph.pageOnScroll": {
      type: "boolean",
      description: localize("scm.graph.pageOnScroll", "Controls whether the Source Control Graph view will load the next page of items when you scroll to the end of the list."),
      default: true
    },
    "scm.graph.pageSize": {
      type: "number",
      description: localize("scm.graph.pageSize", "The number of items to show in the Source Control Graph view by default and when loading more items."),
      minimum: 1,
      maximum: 1e3,
      default: 50
    },
    "scm.graph.badges": {
      type: "string",
      enum: ["all", "filter"],
      enumDescriptions: [
        localize("scm.graph.badges.all", "Show badges of all history item groups in the Source Control Graph view."),
        localize("scm.graph.badges.filter", "Show only the badges of history item groups used as a filter in the Source Control Graph view.")
      ],
      description: localize("scm.graph.badges", "Controls which badges are shown in the Source Control Graph view. The badges are shown on the right side of the graph indicating the names of history item groups."),
      default: "filter"
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "scm.acceptInput",
  metadata: { description: localize("scm accept", "Source Control: Accept Input"), args: [] },
  weight: KeybindingWeight.WorkbenchContrib,
  when: ContextKeyExpr.has("scmRepository"),
  primary: KeyMod.CtrlCmd | KeyCode.Enter,
  handler: (accessor) => {
    const contextKeyService = accessor.get(IContextKeyService);
    const context = contextKeyService.getContext(getActiveElement());
    const repositoryId = context.getValue("scmRepository");
    if (!repositoryId) {
      return Promise.resolve(null);
    }
    const scmService = accessor.get(ISCMService);
    const repository = scmService.getRepository(repositoryId);
    if (!repository?.provider.acceptInputCommand) {
      return Promise.resolve(null);
    }
    const id = repository.provider.acceptInputCommand.id;
    const args = repository.provider.acceptInputCommand.arguments;
    const commandService = accessor.get(ICommandService);
    return commandService.executeCommand(id, ...args || []);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "scm.clearInput",
  weight: KeybindingWeight.WorkbenchContrib,
  when: ContextKeyExpr.and(ContextKeyExpr.has("scmRepository"), SuggestContext.Visible.toNegated(), EditorContextKeys.hasNonEmptySelection.toNegated()),
  primary: KeyCode.Escape,
  handler: async (accessor) => {
    const scmService = accessor.get(ISCMService);
    const contextKeyService = accessor.get(IContextKeyService);
    const context = contextKeyService.getContext(getActiveElement());
    const repositoryId = context.getValue("scmRepository");
    const repository = repositoryId ? scmService.getRepository(repositoryId) : void 0;
    repository?.input.setValue("", true);
  }
});
const viewNextCommitCommand = {
  description: { description: localize("scm view next commit", "Source Control: View Next Commit"), args: [] },
  weight: KeybindingWeight.WorkbenchContrib,
  handler: (accessor) => {
    const contextKeyService = accessor.get(IContextKeyService);
    const scmService = accessor.get(ISCMService);
    const context = contextKeyService.getContext(getActiveElement());
    const repositoryId = context.getValue("scmRepository");
    const repository = repositoryId ? scmService.getRepository(repositoryId) : void 0;
    repository?.input.showNextHistoryValue();
  }
};
const viewPreviousCommitCommand = {
  description: { description: localize("scm view previous commit", "Source Control: View Previous Commit"), args: [] },
  weight: KeybindingWeight.WorkbenchContrib,
  handler: (accessor) => {
    const contextKeyService = accessor.get(IContextKeyService);
    const scmService = accessor.get(ISCMService);
    const context = contextKeyService.getContext(getActiveElement());
    const repositoryId = context.getValue("scmRepository");
    const repository = repositoryId ? scmService.getRepository(repositoryId) : void 0;
    repository?.input.showPreviousHistoryValue();
  }
};
KeybindingsRegistry.registerCommandAndKeybindingRule({
  ...viewNextCommitCommand,
  id: "scm.viewNextCommit",
  when: ContextKeyExpr.and(ContextKeyExpr.has("scmRepository"), ContextKeyExpr.has("scmInputIsInLastPosition"), SuggestContext.Visible.toNegated()),
  primary: KeyCode.DownArrow
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  ...viewPreviousCommitCommand,
  id: "scm.viewPreviousCommit",
  when: ContextKeyExpr.and(ContextKeyExpr.has("scmRepository"), ContextKeyExpr.has("scmInputIsInFirstPosition"), SuggestContext.Visible.toNegated()),
  primary: KeyCode.UpArrow
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  ...viewNextCommitCommand,
  id: "scm.forceViewNextCommit",
  when: ContextKeyExpr.has("scmRepository"),
  primary: KeyMod.Alt | KeyCode.DownArrow
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  ...viewPreviousCommitCommand,
  id: "scm.forceViewPreviousCommit",
  when: ContextKeyExpr.has("scmRepository"),
  primary: KeyMod.Alt | KeyCode.UpArrow
});
CommandsRegistry.registerCommand("scm.openInIntegratedTerminal", async (accessor, ...providers) => {
  if (!providers || providers.length === 0) {
    return;
  }
  const commandService = accessor.get(ICommandService);
  const listService = accessor.get(IListService);
  let provider = providers.length === 1 ? providers[0] : void 0;
  if (!provider) {
    const list = listService.lastFocusedList;
    const element = list?.getHTMLElement();
    if (list instanceof WorkbenchList && element && isActiveElement(element)) {
      const [index] = list.getFocus();
      const focusedElement = list.element(index);
      if (isSCMRepository(focusedElement)) {
        provider = focusedElement.provider;
      }
    }
  }
  if (!provider?.rootUri) {
    return;
  }
  await commandService.executeCommand("openInIntegratedTerminal", provider.rootUri);
});
CommandsRegistry.registerCommand("scm.openInTerminal", async (accessor, provider) => {
  if (!provider || !provider.rootUri) {
    return;
  }
  const commandService = accessor.get(ICommandService);
  await commandService.executeCommand("openInTerminal", provider.rootUri);
});
CommandsRegistry.registerCommand("scm.setActiveProvider", async (accessor) => {
  const instantiationService = accessor.get(IInstantiationService);
  const scmViewService = accessor.get(ISCMViewService);
  const placeHolder = localize("scmActiveRepositoryPlaceHolder", "Select the active repository, type to filter all repositories");
  const autoQuickItemDescription = localize("scmActiveRepositoryAutoDescription", "The active repository is updated based on focused repository/active editor");
  const repositoryPicker = instantiationService.createInstance(RepositoryPicker, placeHolder, autoQuickItemDescription);
  const result = await repositoryPicker.pickRepository();
  if (result?.repository) {
    const repository = result.repository !== "auto" ? result.repository : void 0;
    scmViewService.pinActiveRepository(repository);
  }
});
MenuRegistry.appendMenuItem(MenuId.SCMSourceControl, {
  group: "100_end",
  command: {
    id: "scm.openInTerminal",
    title: localize("open in external terminal", "Open in External Terminal")
  },
  when: ContextKeyExpr.and(
    RemoteNameContext.isEqualTo(""),
    ContextKeyExpr.equals("scmProviderHasRootUri", true),
    ContextKeyExpr.or(
      ContextKeyExpr.equals("config.terminal.sourceControlRepositoriesKind", "external"),
      ContextKeyExpr.equals("config.terminal.sourceControlRepositoriesKind", "both")
    )
  )
});
MenuRegistry.appendMenuItem(MenuId.SCMSourceControl, {
  group: "100_end",
  command: {
    id: "scm.openInIntegratedTerminal",
    title: localize("open in integrated terminal", "Open in Integrated Terminal")
  },
  when: ContextKeyExpr.and(
    ContextKeyExpr.equals("scmProviderHasRootUri", true),
    ContextKeyExpr.or(
      ContextKeyExpr.equals("config.terminal.sourceControlRepositoriesKind", "integrated"),
      ContextKeyExpr.equals("config.terminal.sourceControlRepositoriesKind", "both")
    )
  )
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "workbench.scm.action.focusPreviousInput",
  weight: KeybindingWeight.WorkbenchContrib,
  when: ContextKeys.RepositoryVisibilityCount.notEqualsTo(0),
  handler: async (accessor) => {
    const viewsService = accessor.get(IViewsService);
    const scmView = await viewsService.openView(VIEW_PANE_ID);
    if (scmView) {
      scmView.focusPreviousInput();
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "workbench.scm.action.focusNextInput",
  weight: KeybindingWeight.WorkbenchContrib,
  when: ContextKeys.RepositoryVisibilityCount.notEqualsTo(0),
  handler: async (accessor) => {
    const viewsService = accessor.get(IViewsService);
    const scmView = await viewsService.openView(VIEW_PANE_ID);
    if (scmView) {
      scmView.focusNextInput();
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "workbench.scm.action.focusPreviousResourceGroup",
  weight: KeybindingWeight.WorkbenchContrib,
  handler: async (accessor) => {
    const viewsService = accessor.get(IViewsService);
    const scmView = await viewsService.openView(VIEW_PANE_ID);
    if (scmView) {
      scmView.focusPreviousResourceGroup();
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "workbench.scm.action.focusNextResourceGroup",
  weight: KeybindingWeight.WorkbenchContrib,
  handler: async (accessor) => {
    const viewsService = accessor.get(IViewsService);
    const scmView = await viewsService.openView(VIEW_PANE_ID);
    if (scmView) {
      scmView.focusNextResourceGroup();
    }
  }
});
registerSingleton(ISCMService, SCMService, InstantiationType.Delayed);
registerSingleton(ISCMViewService, SCMViewService, InstantiationType.Delayed);
registerSingleton(IQuickDiffService, QuickDiffService, InstantiationType.Delayed);
registerSingleton(IQuickDiffModelService, QuickDiffModelService, InstantiationType.Delayed);
AccessibleViewRegistry.register(new SCMAccessibilityHelp());
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zY20vYnJvd3Nlci9zY20uY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5LCByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIsIEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucywgV29ya2JlbmNoUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBRdWlja0RpZmZXb3JrYmVuY2hDb250cm9sbGVyIH0gZnJvbSAnLi9xdWlja0RpZmZEZWNvcmF0b3IuanMnO1xuaW1wb3J0IHsgVklFV0xFVF9JRCwgSVNDTVNlcnZpY2UsIFZJRVdfUEFORV9JRCwgSVNDTVByb3ZpZGVyLCBJU0NNVmlld1NlcnZpY2UsIFJFUE9TSVRPUklFU19WSUVXX1BBTkVfSUQsIEhJU1RPUllfVklFV19QQU5FX0lEIH0gZnJvbSAnLi4vY29tbW9uL3NjbS5qcyc7XG5pbXBvcnQgeyBLZXlNb2QsIEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBNZW51UmVnaXN0cnksIE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgU0NNQWN0aXZlUmVzb3VyY2VDb250ZXh0S2V5Q29udHJvbGxlciwgU0NNQWN0aXZlUmVwb3NpdG9yeUNvbnRyb2xsZXIgfSBmcm9tICcuL2FjdGl2aXR5LmpzJztcbmltcG9ydCB7IExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBDb25maWd1cmF0aW9uRXh0ZW5zaW9ucywgQ29uZmlndXJhdGlvblNjb3BlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSwgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnksIElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nc1JlZ2lzdHJ5LCBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFNDTVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vc2NtU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVmlld0NvbnRhaW5lcnNSZWdpc3RyeSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLCBFeHRlbnNpb25zIGFzIFZpZXdDb250YWluZXJFeHRlbnNpb25zLCBJVmlld3NSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBTQ01WaWV3UGFuZUNvbnRhaW5lciB9IGZyb20gJy4vc2NtVmlld1BhbmVDb250YWluZXIuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBNb2Rlc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbW9kZXNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2ljb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5cywgU0NNVmlld1BhbmUgfSBmcm9tICcuL3NjbVZpZXdQYW5lLmpzJztcbmltcG9ydCB7IFJlcG9zaXRvcnlQaWNrZXIsIFNDTVZpZXdTZXJ2aWNlIH0gZnJvbSAnLi9zY21WaWV3U2VydmljZS5qcyc7XG5pbXBvcnQgeyBTQ01SZXBvc2l0b3JpZXNWaWV3UGFuZSB9IGZyb20gJy4vc2NtUmVwb3NpdG9yaWVzVmlld1BhbmUuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0IGFzIFN1Z2dlc3RDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvc3VnZ2VzdC9icm93c2VyL3N1Z2dlc3QuanMnO1xuaW1wb3J0IHsgTUFOQUdFX1RSVVNUX0NPTU1BTkRfSUQsIFdvcmtzcGFjZVRydXN0Q29udGV4dCB9IGZyb20gJy4uLy4uL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElRdWlja0RpZmZTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3F1aWNrRGlmZi5qcyc7XG5pbXBvcnQgeyBRdWlja0RpZmZTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3F1aWNrRGlmZlNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZ2V0QWN0aXZlRWxlbWVudCwgaXNBY3RpdmVFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBTQ01Xb3JraW5nU2V0Q29udHJvbGxlciB9IGZyb20gJy4vd29ya2luZ1NldC5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGlzdFNlcnZpY2UsIFdvcmtiZW5jaExpc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNTQ01SZXBvc2l0b3J5IH0gZnJvbSAnLi91dGlsLmpzJztcbmltcG9ydCB7IFNDTUhpc3RvcnlWaWV3UGFuZSB9IGZyb20gJy4vc2NtSGlzdG9yeVZpZXdQYW5lLmpzJztcbmltcG9ydCB7IFF1aWNrRGlmZk1vZGVsU2VydmljZSwgSVF1aWNrRGlmZk1vZGVsU2VydmljZSB9IGZyb20gJy4vcXVpY2tEaWZmTW9kZWwuanMnO1xuaW1wb3J0IHsgUXVpY2tEaWZmRWRpdG9yQ29udHJvbGxlciB9IGZyb20gJy4vcXVpY2tEaWZmV2lkZ2V0LmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24sIHJlZ2lzdGVyRWRpdG9yQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBSZW1vdGVOYW1lQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmxlVmlld1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9icm93c2VyL2FjY2Vzc2libGVWaWV3UmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgU0NNQWNjZXNzaWJpbGl0eUhlbHAgfSBmcm9tICcuL3NjbUFjY2Vzc2liaWxpdHlIZWxwLmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5cbk1vZGVzUmVnaXN0cnkucmVnaXN0ZXJMYW5ndWFnZSh7XG5cdGlkOiAnc2NtaW5wdXQnLFxuXHRleHRlbnNpb25zOiBbXSxcblx0YWxpYXNlczogW10sIC8vIGhpZGUgZnJvbSBsYW5ndWFnZSBzZWxlY3RvclxuXHRtaW1ldHlwZXM6IFsndGV4dC94LXNjbS1pbnB1dCddXG59KTtcblxuUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpXG5cdC5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihRdWlja0RpZmZXb3JrYmVuY2hDb250cm9sbGVyLCBMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG5cbnJlZ2lzdGVyRWRpdG9yQ29udHJpYnV0aW9uKFF1aWNrRGlmZkVkaXRvckNvbnRyb2xsZXIuSUQsXG5cdFF1aWNrRGlmZkVkaXRvckNvbnRyb2xsZXIsIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24uQWZ0ZXJGaXJzdFJlbmRlcik7XG5cbmNvbnN0IHNvdXJjZUNvbnRyb2xWaWV3SWNvbiA9IHJlZ2lzdGVySWNvbignc291cmNlLWNvbnRyb2wtdmlldy1pY29uJywgQ29kaWNvbi5zb3VyY2VDb250cm9sLCBsb2NhbGl6ZSgnc291cmNlQ29udHJvbFZpZXdJY29uJywgJ1ZpZXcgaWNvbiBvZiB0aGUgU291cmNlIENvbnRyb2wgdmlldy4nKSk7XG5cbmNvbnN0IHZpZXdDb250YWluZXIgPSBSZWdpc3RyeS5hczxJVmlld0NvbnRhaW5lcnNSZWdpc3RyeT4oVmlld0NvbnRhaW5lckV4dGVuc2lvbnMuVmlld0NvbnRhaW5lcnNSZWdpc3RyeSkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHtcblx0aWQ6IFZJRVdMRVRfSUQsXG5cdHRpdGxlOiBsb2NhbGl6ZTIoJ3NvdXJjZSBjb250cm9sJywgJ1NvdXJjZSBDb250cm9sJyksXG5cdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoU0NNVmlld1BhbmVDb250YWluZXIpLFxuXHRzdG9yYWdlSWQ6ICd3b3JrYmVuY2guc2NtLnZpZXdzLnN0YXRlJyxcblx0aWNvbjogc291cmNlQ29udHJvbFZpZXdJY29uLFxuXHRhbHdheXNVc2VDb250YWluZXJJbmZvOiB0cnVlLFxuXHRvcmRlcjogMixcblx0aGlkZUlmRW1wdHk6IHRydWUsXG59LCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhciwgeyBkb05vdFJlZ2lzdGVyT3BlbkNvbW1hbmQ6IHRydWUgfSk7XG5cbmNvbnN0IHZpZXdzUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJVmlld3NSZWdpc3RyeT4oVmlld0NvbnRhaW5lckV4dGVuc2lvbnMuVmlld3NSZWdpc3RyeSk7XG5jb25zdCBjb250YWluZXJUaXRsZSA9IGxvY2FsaXplKCdzb3VyY2UgY29udHJvbCB2aWV3JywgXCJTb3VyY2UgQ29udHJvbFwiKTtcblxudmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdXZWxjb21lQ29udGVudChWSUVXX1BBTkVfSUQsIHtcblx0Y29udGVudDogbG9jYWxpemUoJ25vIG9wZW4gcmVwbycsIFwiTm8gc291cmNlIGNvbnRyb2wgcHJvdmlkZXJzIHJlZ2lzdGVyZWQuXCIpLFxuXHR3aGVuOiAnZGVmYXVsdCdcbn0pO1xuXG52aWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld1dlbGNvbWVDb250ZW50KFZJRVdfUEFORV9JRCwge1xuXHRjb250ZW50OiBsb2NhbGl6ZSgnbm8gb3BlbiByZXBvIGluIGFuIHVudHJ1c3RlZCB3b3Jrc3BhY2UnLCBcIk5vbmUgb2YgdGhlIHJlZ2lzdGVyZWQgc291cmNlIGNvbnRyb2wgcHJvdmlkZXJzIHdvcmsgaW4gUmVzdHJpY3RlZCBNb2RlLlwiKSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygnc2NtLnByb3ZpZGVyQ291bnQnLCAwKSwgV29ya3NwYWNlVHJ1c3RDb250ZXh0LklzRW5hYmxlZCwgV29ya3NwYWNlVHJ1c3RDb250ZXh0LklzVHJ1c3RlZC50b05lZ2F0ZWQoKSlcbn0pO1xuXG52aWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld1dlbGNvbWVDb250ZW50KFZJRVdfUEFORV9JRCwge1xuXHRjb250ZW50OiBgWyR7bG9jYWxpemUoJ21hbmFnZVdvcmtzcGFjZVRydXN0QWN0aW9uJywgXCJNYW5hZ2UgV29ya3NwYWNlIFRydXN0XCIpfV0oY29tbWFuZDoke01BTkFHRV9UUlVTVF9DT01NQU5EX0lEfSlgLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCdzY20ucHJvdmlkZXJDb3VudCcsIDApLCBXb3Jrc3BhY2VUcnVzdENvbnRleHQuSXNFbmFibGVkLCBXb3Jrc3BhY2VUcnVzdENvbnRleHQuSXNUcnVzdGVkLnRvTmVnYXRlZCgpKVxufSk7XG5cbnZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3V2VsY29tZUNvbnRlbnQoSElTVE9SWV9WSUVXX1BBTkVfSUQsIHtcblx0Y29udGVudDogbG9jYWxpemUoJ25vIGhpc3RvcnkgaXRlbXMnLCBcIlRoZSBzZWxlY3RlZCBzb3VyY2UgY29udHJvbCBwcm92aWRlciBkb2VzIG5vdCBoYXZlIGFueSBzb3VyY2UgY29udHJvbCBoaXN0b3J5IGl0ZW1zLlwiKSxcblx0d2hlbjogQ29udGV4dEtleXMuU0NNSGlzdG9yeUl0ZW1Db3VudC5pc0VxdWFsVG8oMClcbn0pO1xuXG52aWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3MoW3tcblx0aWQ6IFJFUE9TSVRPUklFU19WSUVXX1BBTkVfSUQsXG5cdGNvbnRhaW5lclRpdGxlLFxuXHRuYW1lOiBsb2NhbGl6ZTIoJ3NjbVJlcG9zaXRvcmllcycsIFwiUmVwb3NpdG9yaWVzXCIpLFxuXHRzaW5nbGVWaWV3UGFuZUNvbnRhaW5lclRpdGxlOiBsb2NhbGl6ZSgnc291cmNlIGNvbnRyb2wgcmVwb3NpdG9yaWVzJywgXCJTb3VyY2UgQ29udHJvbCBSZXBvc2l0b3JpZXNcIiksXG5cdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoU0NNUmVwb3NpdG9yaWVzVmlld1BhbmUpLFxuXHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiB0cnVlLFxuXHRoaWRlQnlEZWZhdWx0OiB0cnVlLFxuXHRjYW5Nb3ZlVmlldzogdHJ1ZSxcblx0d2VpZ2h0OiAyMCxcblx0b3JkZXI6IDAsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5oYXMoJ3NjbS5wcm92aWRlckNvdW50JyksIENvbnRleHRLZXlFeHByLm5vdEVxdWFscygnc2NtLnByb3ZpZGVyQ291bnQnLCAwKSksXG5cdC8vIHJlYWRvbmx5IHdoZW4gPSBDb250ZXh0S2V5RXhwci5vcihDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy5zY20uYWx3YXlzU2hvd1Byb3ZpZGVycycsIHRydWUpLCBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIubm90RXF1YWxzKCdzY20ucHJvdmlkZXJDb3VudCcsIDApLCBDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoJ3NjbS5wcm92aWRlckNvdW50JywgMSkpKTtcblx0Y29udGFpbmVySWNvbjogc291cmNlQ29udHJvbFZpZXdJY29uXG59XSwgdmlld0NvbnRhaW5lcik7XG5cbnZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3cyhbe1xuXHRpZDogVklFV19QQU5FX0lELFxuXHRjb250YWluZXJUaXRsZSxcblx0bmFtZTogbG9jYWxpemUyKCdzY21DaGFuZ2VzJywgJ0NoYW5nZXMnKSxcblx0c2luZ2xlVmlld1BhbmVDb250YWluZXJUaXRsZTogY29udGFpbmVyVGl0bGUsXG5cdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoU0NNVmlld1BhbmUpLFxuXHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiB0cnVlLFxuXHRjYW5Nb3ZlVmlldzogdHJ1ZSxcblx0d2VpZ2h0OiA0MCxcblx0b3JkZXI6IDEsXG5cdGNvbnRhaW5lckljb246IHNvdXJjZUNvbnRyb2xWaWV3SWNvbixcblx0b3BlbkNvbW1hbmRBY3Rpb25EZXNjcmlwdG9yOiB7XG5cdFx0aWQ6IHZpZXdDb250YWluZXIuaWQsXG5cdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVZpZXdTQ00nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiU291cmNlICYmQ29udHJvbFwiKSxcblx0XHRrZXliaW5kaW5nczoge1xuXHRcdFx0cHJpbWFyeTogMCxcblx0XHRcdHdpbjogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5RyB9LFxuXHRcdFx0bGludXg6IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleUcgfSxcblx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuV2luQ3RybCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5RyB9LFxuXHRcdH0sXG5cdFx0b3JkZXI6IDIsXG5cdH1cbn1dLCB2aWV3Q29udGFpbmVyKTtcblxudmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKFt7XG5cdGlkOiBISVNUT1JZX1ZJRVdfUEFORV9JRCxcblx0Y29udGFpbmVyVGl0bGUsXG5cdG5hbWU6IGxvY2FsaXplMignc2NtR3JhcGgnLCBcIkdyYXBoXCIpLFxuXHRzaW5nbGVWaWV3UGFuZUNvbnRhaW5lclRpdGxlOiBsb2NhbGl6ZSgnc291cmNlIGNvbnRyb2wgZ3JhcGgnLCBcIlNvdXJjZSBDb250cm9sIEdyYXBoXCIpLFxuXHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKFNDTUhpc3RvcnlWaWV3UGFuZSksXG5cdGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWUsXG5cdGNhbk1vdmVWaWV3OiB0cnVlLFxuXHR3ZWlnaHQ6IDQwLFxuXHRvcmRlcjogMixcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdENvbnRleHRLZXlFeHByLmhhcygnc2NtLmhpc3RvcnlQcm92aWRlckNvdW50JyksXG5cdFx0Q29udGV4dEtleUV4cHIubm90RXF1YWxzKCdzY20uaGlzdG9yeVByb3ZpZGVyQ291bnQnLCAwKSxcblx0KSxcblx0Y29udGFpbmVySWNvbjogc291cmNlQ29udHJvbFZpZXdJY29uXG59XSwgdmlld0NvbnRhaW5lcik7XG5cblJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuV29ya2JlbmNoKVxuXHQucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oU0NNQWN0aXZlUmVwb3NpdG9yeUNvbnRyb2xsZXIsIExpZmVjeWNsZVBoYXNlLlJlc3RvcmVkKTtcblxuUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpXG5cdC5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihTQ01BY3RpdmVSZXNvdXJjZUNvbnRleHRLZXlDb250cm9sbGVyLCBMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG5cbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihcblx0U0NNV29ya2luZ1NldENvbnRyb2xsZXIuSUQsXG5cdFNDTVdvcmtpbmdTZXRDb250cm9sbGVyLFxuXHRXb3JrYmVuY2hQaGFzZS5BZnRlclJlc3RvcmVkXG4pO1xuXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihDb25maWd1cmF0aW9uRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRpZDogJ3NjbScsXG5cdG9yZGVyOiA1LFxuXHR0aXRsZTogbG9jYWxpemUoJ3NjbUNvbmZpZ3VyYXRpb25UaXRsZScsIFwiU291cmNlIENvbnRyb2xcIiksXG5cdHR5cGU6ICdvYmplY3QnLFxuXHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLlJFU09VUkNFLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0J3NjbS5kaWZmRGVjb3JhdGlvbnMnOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnYWxsJywgJ2d1dHRlcicsICdvdmVydmlldycsICdtaW5pbWFwJywgJ25vbmUnXSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bG9jYWxpemUoJ3NjbS5kaWZmRGVjb3JhdGlvbnMuYWxsJywgXCJTaG93IHRoZSBkaWZmIGRlY29yYXRpb25zIGluIGFsbCBhdmFpbGFibGUgbG9jYXRpb25zLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3NjbS5kaWZmRGVjb3JhdGlvbnMuZ3V0dGVyJywgXCJTaG93IHRoZSBkaWZmIGRlY29yYXRpb25zIG9ubHkgaW4gdGhlIGVkaXRvciBndXR0ZXIuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgnc2NtLmRpZmZEZWNvcmF0aW9ucy5vdmVydmlld1J1bGVyJywgXCJTaG93IHRoZSBkaWZmIGRlY29yYXRpb25zIG9ubHkgaW4gdGhlIG92ZXJ2aWV3IHJ1bGVyLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3NjbS5kaWZmRGVjb3JhdGlvbnMubWluaW1hcCcsIFwiU2hvdyB0aGUgZGlmZiBkZWNvcmF0aW9ucyBvbmx5IGluIHRoZSBtaW5pbWFwLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3NjbS5kaWZmRGVjb3JhdGlvbnMubm9uZScsIFwiRG8gbm90IHNob3cgdGhlIGRpZmYgZGVjb3JhdGlvbnMuXCIpXG5cdFx0XHRdLFxuXHRcdFx0ZGVmYXVsdDogJ2FsbCcsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2RpZmZEZWNvcmF0aW9ucycsIFwiQ29udHJvbHMgZGlmZiBkZWNvcmF0aW9ucyBpbiB0aGUgZWRpdG9yLlwiKVxuXHRcdH0sXG5cdFx0J3NjbS5kaWZmRGVjb3JhdGlvbnNHdXR0ZXJXaWR0aCc6IHtcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0ZW51bTogWzEsIDIsIDMsIDQsIDVdLFxuXHRcdFx0ZGVmYXVsdDogMyxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZGlmZkd1dHRlcldpZHRoJywgXCJDb250cm9scyB0aGUgd2lkdGgocHgpIG9mIGRpZmYgZGVjb3JhdGlvbnMgaW4gZ3V0dGVyIChhZGRlZCAmIG1vZGlmaWVkKS5cIilcblx0XHR9LFxuXHRcdCdzY20uZGlmZkRlY29yYXRpb25zR3V0dGVyVmlzaWJpbGl0eSc6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydhbHdheXMnLCAnaG92ZXInXSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bG9jYWxpemUoJ3NjbS5kaWZmRGVjb3JhdGlvbnNHdXR0ZXJWaXNpYmlsaXR5LmFsd2F5cycsIFwiU2hvdyB0aGUgZGlmZiBkZWNvcmF0b3IgaW4gdGhlIGd1dHRlciBhdCBhbGwgdGltZXMuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgnc2NtLmRpZmZEZWNvcmF0aW9uc0d1dHRlclZpc2liaWxpdHkuaG92ZXInLCBcIlNob3cgdGhlIGRpZmYgZGVjb3JhdG9yIGluIHRoZSBndXR0ZXIgb25seSBvbiBob3Zlci5cIilcblx0XHRcdF0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3NjbS5kaWZmRGVjb3JhdGlvbnNHdXR0ZXJWaXNpYmlsaXR5JywgXCJDb250cm9scyB0aGUgdmlzaWJpbGl0eSBvZiB0aGUgU291cmNlIENvbnRyb2wgZGlmZiBkZWNvcmF0b3IgaW4gdGhlIGd1dHRlci5cIiksXG5cdFx0XHRkZWZhdWx0OiAnYWx3YXlzJ1xuXHRcdH0sXG5cdFx0J3NjbS5kaWZmRGVjb3JhdGlvbnNHdXR0ZXJBY3Rpb24nOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnZGlmZicsICdub25lJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCdzY20uZGlmZkRlY29yYXRpb25zR3V0dGVyQWN0aW9uLmRpZmYnLCBcIlNob3cgdGhlIGlubGluZSBkaWZmIFBlZWsgdmlldyBvbiBjbGljay5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCdzY20uZGlmZkRlY29yYXRpb25zR3V0dGVyQWN0aW9uLm5vbmUnLCBcIkRvIG5vdGhpbmcuXCIpXG5cdFx0XHRdLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdzY20uZGlmZkRlY29yYXRpb25zR3V0dGVyQWN0aW9uJywgXCJDb250cm9scyB0aGUgYmVoYXZpb3Igb2YgU291cmNlIENvbnRyb2wgZGlmZiBndXR0ZXIgZGVjb3JhdGlvbnMuXCIpLFxuXHRcdFx0ZGVmYXVsdDogJ2RpZmYnXG5cdFx0fSxcblx0XHQnc2NtLmRpZmZEZWNvcmF0aW9uc0d1dHRlclBhdHRlcm4nOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZGlmZkd1dHRlclBhdHRlcm4nLCBcIkNvbnRyb2xzIHdoZXRoZXIgYSBwYXR0ZXJuIGlzIHVzZWQgZm9yIHRoZSBkaWZmIGRlY29yYXRpb25zIGluIGd1dHRlci5cIiksXG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdCdhZGRlZCc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdkaWZmR3V0dGVyUGF0dGVybkFkZGVkJywgXCJVc2UgcGF0dGVybiBmb3IgdGhlIGRpZmYgZGVjb3JhdGlvbnMgaW4gZ3V0dGVyIGZvciBhZGRlZCBsaW5lcy5cIiksXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdtb2RpZmllZCc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdkaWZmR3V0dGVyUGF0dGVybk1vZGlmZWQnLCBcIlVzZSBwYXR0ZXJuIGZvciB0aGUgZGlmZiBkZWNvcmF0aW9ucyBpbiBndXR0ZXIgZm9yIG1vZGlmaWVkIGxpbmVzLlwiKSxcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdCdhZGRlZCc6IGZhbHNlLFxuXHRcdFx0XHQnbW9kaWZpZWQnOiB0cnVlXG5cdFx0XHR9XG5cdFx0fSxcblx0XHQnc2NtLmRpZmZEZWNvcmF0aW9uc0lnbm9yZVRyaW1XaGl0ZXNwYWNlJzoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ3RydWUnLCAnZmFsc2UnLCAnaW5oZXJpdCddLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgnc2NtLmRpZmZEZWNvcmF0aW9uc0lnbm9yZVRyaW1XaGl0ZXNwYWNlLnRydWUnLCBcIklnbm9yZSBsZWFkaW5nIGFuZCB0cmFpbGluZyB3aGl0ZXNwYWNlLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3NjbS5kaWZmRGVjb3JhdGlvbnNJZ25vcmVUcmltV2hpdGVzcGFjZS5mYWxzZScsIFwiRG8gbm90IGlnbm9yZSBsZWFkaW5nIGFuZCB0cmFpbGluZyB3aGl0ZXNwYWNlLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3NjbS5kaWZmRGVjb3JhdGlvbnNJZ25vcmVUcmltV2hpdGVzcGFjZS5pbmhlcml0JywgXCJJbmhlcml0IGZyb20gYGRpZmZFZGl0b3IuaWdub3JlVHJpbVdoaXRlc3BhY2VgLlwiKVxuXHRcdFx0XSxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZGlmZkRlY29yYXRpb25zSWdub3JlVHJpbVdoaXRlc3BhY2UnLCBcIkNvbnRyb2xzIHdoZXRoZXIgbGVhZGluZyBhbmQgdHJhaWxpbmcgd2hpdGVzcGFjZSBpcyBpZ25vcmVkIGluIFNvdXJjZSBDb250cm9sIGRpZmYgZ3V0dGVyIGRlY29yYXRpb25zLlwiKSxcblx0XHRcdGRlZmF1bHQ6ICdmYWxzZSdcblx0XHR9LFxuXHRcdCdzY20uYWx3YXlzU2hvd0FjdGlvbnMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2Fsd2F5c1Nob3dBY3Rpb25zJywgXCJDb250cm9scyB3aGV0aGVyIGlubGluZSBhY3Rpb25zIGFyZSBhbHdheXMgdmlzaWJsZSBpbiB0aGUgU291cmNlIENvbnRyb2wgdmlldy5cIiksXG5cdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdH0sXG5cdFx0J3NjbS5jb3VudEJhZGdlJzoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ2FsbCcsICdmb2N1c2VkJywgJ29mZiddLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgnc2NtLmNvdW50QmFkZ2UuYWxsJywgXCJTaG93IHRoZSBzdW0gb2YgYWxsIFNvdXJjZSBDb250cm9sIFByb3ZpZGVyIGNvdW50IGJhZGdlcy5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCdzY20uY291bnRCYWRnZS5mb2N1c2VkJywgXCJTaG93IHRoZSBjb3VudCBiYWRnZSBvZiB0aGUgZm9jdXNlZCBTb3VyY2UgQ29udHJvbCBQcm92aWRlci5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCdzY20uY291bnRCYWRnZS5vZmYnLCBcIkRpc2FibGUgdGhlIFNvdXJjZSBDb250cm9sIGNvdW50IGJhZGdlLlwiKVxuXHRcdFx0XSxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc2NtLmNvdW50QmFkZ2UnLCBcIkNvbnRyb2xzIHRoZSBjb3VudCBiYWRnZSBvbiB0aGUgU291cmNlIENvbnRyb2wgaWNvbiBvbiB0aGUgQWN0aXZpdHkgQmFyLlwiKSxcblx0XHRcdGRlZmF1bHQ6ICdhbGwnXG5cdFx0fSxcblx0XHQnc2NtLnByb3ZpZGVyQ291bnRCYWRnZSc6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydoaWRkZW4nLCAnYXV0bycsICd2aXNpYmxlJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCdzY20ucHJvdmlkZXJDb3VudEJhZGdlLmhpZGRlbicsIFwiSGlkZSBTb3VyY2UgQ29udHJvbCBQcm92aWRlciBjb3VudCBiYWRnZXMuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgnc2NtLnByb3ZpZGVyQ291bnRCYWRnZS5hdXRvJywgXCJPbmx5IHNob3cgY291bnQgYmFkZ2UgZm9yIFNvdXJjZSBDb250cm9sIFByb3ZpZGVyIHdoZW4gbm9uLXplcm8uXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgnc2NtLnByb3ZpZGVyQ291bnRCYWRnZS52aXNpYmxlJywgXCJTaG93IFNvdXJjZSBDb250cm9sIFByb3ZpZGVyIGNvdW50IGJhZGdlcy5cIilcblx0XHRcdF0sXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc2NtLnByb3ZpZGVyQ291bnRCYWRnZScsIFwiQ29udHJvbHMgdGhlIGNvdW50IGJhZGdlcyBvbiBTb3VyY2UgQ29udHJvbCBQcm92aWRlciBoZWFkZXJzLiBUaGVzZSBoZWFkZXJzIGFwcGVhciBpbiB0aGUgU291cmNlIENvbnRyb2wgdmlldyB3aGVuIHRoZXJlIGlzIG1vcmUgdGhhbiBvbmUgcHJvdmlkZXIgb3Igd2hlbiB0aGUgezB9IHNldHRpbmcgaXMgZW5hYmxlZCwgYW5kIGluIHRoZSBTb3VyY2UgQ29udHJvbCBSZXBvc2l0b3JpZXMgdmlldy5cIiwgJ1xcYCNzY20uYWx3YXlzU2hvd1JlcG9zaXRvcmllcyNcXGAnKSxcblx0XHRcdGRlZmF1bHQ6ICdoaWRkZW4nXG5cdFx0fSxcblx0XHQnc2NtLmRlZmF1bHRWaWV3TW9kZSc6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWyd0cmVlJywgJ2xpc3QnXSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bG9jYWxpemUoJ3NjbS5kZWZhdWx0Vmlld01vZGUudHJlZScsIFwiU2hvdyB0aGUgcmVwb3NpdG9yeSBjaGFuZ2VzIGFzIGEgdHJlZS5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCdzY20uZGVmYXVsdFZpZXdNb2RlLmxpc3QnLCBcIlNob3cgdGhlIHJlcG9zaXRvcnkgY2hhbmdlcyBhcyBhIGxpc3QuXCIpXG5cdFx0XHRdLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdzY20uZGVmYXVsdFZpZXdNb2RlJywgXCJDb250cm9scyB0aGUgZGVmYXVsdCBTb3VyY2UgQ29udHJvbCByZXBvc2l0b3J5IHZpZXcgbW9kZS5cIiksXG5cdFx0XHRkZWZhdWx0OiAnbGlzdCdcblx0XHR9LFxuXHRcdCdzY20uZGVmYXVsdFZpZXdTb3J0S2V5Jzoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ25hbWUnLCAncGF0aCcsICdzdGF0dXMnXSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bG9jYWxpemUoJ3NjbS5kZWZhdWx0Vmlld1NvcnRLZXkubmFtZScsIFwiU29ydCB0aGUgcmVwb3NpdG9yeSBjaGFuZ2VzIGJ5IGZpbGUgbmFtZS5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCdzY20uZGVmYXVsdFZpZXdTb3J0S2V5LnBhdGgnLCBcIlNvcnQgdGhlIHJlcG9zaXRvcnkgY2hhbmdlcyBieSBwYXRoLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3NjbS5kZWZhdWx0Vmlld1NvcnRLZXkuc3RhdHVzJywgXCJTb3J0IHRoZSByZXBvc2l0b3J5IGNoYW5nZXMgYnkgU291cmNlIENvbnRyb2wgc3RhdHVzLlwiKVxuXHRcdFx0XSxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc2NtLmRlZmF1bHRWaWV3U29ydEtleScsIFwiQ29udHJvbHMgdGhlIGRlZmF1bHQgU291cmNlIENvbnRyb2wgcmVwb3NpdG9yeSBjaGFuZ2VzIHNvcnQgb3JkZXIgd2hlbiB2aWV3ZWQgYXMgYSBsaXN0LlwiKSxcblx0XHRcdGRlZmF1bHQ6ICdwYXRoJ1xuXHRcdH0sXG5cdFx0J3NjbS5hdXRvUmV2ZWFsJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdhdXRvUmV2ZWFsJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBTb3VyY2UgQ29udHJvbCB2aWV3IHNob3VsZCBhdXRvbWF0aWNhbGx5IHJldmVhbCBhbmQgc2VsZWN0IGZpbGVzIHdoZW4gb3BlbmluZyB0aGVtLlwiKSxcblx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHR9LFxuXHRcdCdzY20uaW5wdXRGb250RmFtaWx5Jzoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnaW5wdXRGb250RmFtaWx5JywgXCJDb250cm9scyB0aGUgZm9udCBmb3IgdGhlIGlucHV0IG1lc3NhZ2UuIFVzZSBgZGVmYXVsdGAgZm9yIHRoZSB3b3JrYmVuY2ggdXNlciBpbnRlcmZhY2UgZm9udCBmYW1pbHksIGBlZGl0b3JgIGZvciB0aGUgYCNlZGl0b3IuZm9udEZhbWlseSNgJ3MgdmFsdWUsIG9yIGEgY3VzdG9tIGZvbnQgZmFtaWx5LlwiKSxcblx0XHRcdGRlZmF1bHQ6ICdkZWZhdWx0J1xuXHRcdH0sXG5cdFx0J3NjbS5pbnB1dEZvbnRTaXplJzoge1xuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnaW5wdXRGb250U2l6ZScsIFwiQ29udHJvbHMgdGhlIGZvbnQgc2l6ZSBmb3IgdGhlIGlucHV0IG1lc3NhZ2UgaW4gcGl4ZWxzLlwiKSxcblx0XHRcdGRlZmF1bHQ6IDEzXG5cdFx0fSxcblx0XHQnc2NtLmlucHV0TWF4TGluZUNvdW50Jzoge1xuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnaW5wdXRNYXhMaW5lcycsIFwiQ29udHJvbHMgdGhlIG1heGltdW0gbnVtYmVyIG9mIGxpbmVzIHRoYXQgdGhlIGlucHV0IHdpbGwgYXV0by1ncm93IHRvLlwiKSxcblx0XHRcdG1pbmltdW06IDEsXG5cdFx0XHRtYXhpbXVtOiA1MCxcblx0XHRcdGRlZmF1bHQ6IDEwXG5cdFx0fSxcblx0XHQnc2NtLmlucHV0TWluTGluZUNvdW50Jzoge1xuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnaW5wdXRNaW5MaW5lcycsIFwiQ29udHJvbHMgdGhlIG1pbmltdW0gbnVtYmVyIG9mIGxpbmVzIHRoYXQgdGhlIGlucHV0IHdpbGwgYXV0by1ncm93IGZyb20uXCIpLFxuXHRcdFx0bWluaW11bTogMSxcblx0XHRcdG1heGltdW06IDUwLFxuXHRcdFx0ZGVmYXVsdDogMVxuXHRcdH0sXG5cdFx0J3NjbS5hbHdheXNTaG93UmVwb3NpdG9yaWVzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2Fsd2F5c1Nob3dSZXBvc2l0b3J5JywgXCJDb250cm9scyB3aGV0aGVyIHJlcG9zaXRvcmllcyBzaG91bGQgYWx3YXlzIGJlIHZpc2libGUgaW4gdGhlIFNvdXJjZSBDb250cm9sIHZpZXcuXCIpLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHR9LFxuXHRcdCdzY20ucmVwb3NpdG9yaWVzLnNvcnRPcmRlcic6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydkaXNjb3ZlcnkgdGltZScsICduYW1lJywgJ3BhdGgnXSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bG9jYWxpemUoJ3NjbS5yZXBvc2l0b3JpZXNTb3J0T3JkZXIuZGlzY292ZXJ5VGltZScsIFwiUmVwb3NpdG9yaWVzIGluIHRoZSBTb3VyY2UgQ29udHJvbCBSZXBvc2l0b3JpZXMgdmlldyBhcmUgc29ydGVkIGJ5IGRpc2NvdmVyeSB0aW1lLiBSZXBvc2l0b3JpZXMgaW4gdGhlIFNvdXJjZSBDb250cm9sIHZpZXcgYXJlIHNvcnRlZCBpbiB0aGUgb3JkZXIgdGhhdCB0aGV5IHdlcmUgc2VsZWN0ZWQuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgnc2NtLnJlcG9zaXRvcmllc1NvcnRPcmRlci5uYW1lJywgXCJSZXBvc2l0b3JpZXMgaW4gdGhlIFNvdXJjZSBDb250cm9sIFJlcG9zaXRvcmllcyBhbmQgU291cmNlIENvbnRyb2wgdmlld3MgYXJlIHNvcnRlZCBieSByZXBvc2l0b3J5IG5hbWUuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgnc2NtLnJlcG9zaXRvcmllc1NvcnRPcmRlci5wYXRoJywgXCJSZXBvc2l0b3JpZXMgaW4gdGhlIFNvdXJjZSBDb250cm9sIFJlcG9zaXRvcmllcyBhbmQgU291cmNlIENvbnRyb2wgdmlld3MgYXJlIHNvcnRlZCBieSByZXBvc2l0b3J5IHBhdGguXCIpXG5cdFx0XHRdLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdyZXBvc2l0b3JpZXNTb3J0T3JkZXInLCBcIkNvbnRyb2xzIHRoZSBzb3J0IG9yZGVyIG9mIHRoZSByZXBvc2l0b3JpZXMgaW4gdGhlIHNvdXJjZSBjb250cm9sIHJlcG9zaXRvcmllcyB2aWV3LlwiKSxcblx0XHRcdGRlZmF1bHQ6ICdkaXNjb3ZlcnkgdGltZSdcblx0XHR9LFxuXHRcdCdzY20ucmVwb3NpdG9yaWVzLnZpc2libGUnOiB7XG5cdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgncHJvdmlkZXJzVmlzaWJsZScsIFwiQ29udHJvbHMgaG93IG1hbnkgcmVwb3NpdG9yaWVzIGFyZSB2aXNpYmxlIGluIHRoZSBTb3VyY2UgQ29udHJvbCBSZXBvc2l0b3JpZXMgc2VjdGlvbi4gU2V0IHRvIDAsIHRvIGJlIGFibGUgdG8gbWFudWFsbHkgcmVzaXplIHRoZSB2aWV3LlwiKSxcblx0XHRcdGRlZmF1bHQ6IDEwXG5cdFx0fSxcblx0XHQnc2NtLnNob3dBY3Rpb25CdXR0b24nOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc2hvd0FjdGlvbkJ1dHRvbicsIFwiQ29udHJvbHMgd2hldGhlciBhbiBhY3Rpb24gYnV0dG9uIGNhbiBiZSBzaG93biBpbiB0aGUgU291cmNlIENvbnRyb2wgdmlldy5cIiksXG5cdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0fSxcblx0XHQnc2NtLnNob3dJbnB1dEFjdGlvbkJ1dHRvbic6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdzaG93SW5wdXRBY3Rpb25CdXR0b24nLCBcIkNvbnRyb2xzIHdoZXRoZXIgYW4gYWN0aW9uIGJ1dHRvbiBjYW4gYmUgc2hvd24gaW4gdGhlIFNvdXJjZSBDb250cm9sIGlucHV0LlwiKSxcblx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHR9LFxuXHRcdCdzY20ud29ya2luZ1NldHMuZW5hYmxlZCc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc2NtLndvcmtpbmdTZXRzLmVuYWJsZWQnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdG8gc3RvcmUgZWRpdG9yIHdvcmtpbmcgc2V0cyB3aGVuIHN3aXRjaGluZyBiZXR3ZWVuIHNvdXJjZSBjb250cm9sIGhpc3RvcnkgaXRlbSBncm91cHMuXCIpLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHR9LFxuXHRcdCdzY20ud29ya2luZ1NldHMuZGVmYXVsdCc6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydlbXB0eScsICdjdXJyZW50J10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCdzY20ud29ya2luZ1NldHMuZGVmYXVsdC5lbXB0eScsIFwiVXNlIGFuIGVtcHR5IHdvcmtpbmcgc2V0IHdoZW4gc3dpdGNoaW5nIHRvIGEgc291cmNlIGNvbnRyb2wgaGlzdG9yeSBpdGVtIGdyb3VwIHRoYXQgZG9lcyBub3QgaGF2ZSBhIHdvcmtpbmcgc2V0LlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3NjbS53b3JraW5nU2V0cy5kZWZhdWx0LmN1cnJlbnQnLCBcIlVzZSB0aGUgY3VycmVudCB3b3JraW5nIHNldCB3aGVuIHN3aXRjaGluZyB0byBhIHNvdXJjZSBjb250cm9sIGhpc3RvcnkgaXRlbSBncm91cCB0aGF0IGRvZXMgbm90IGhhdmUgYSB3b3JraW5nIHNldC5cIilcblx0XHRcdF0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3NjbS53b3JraW5nU2V0cy5kZWZhdWx0JywgXCJDb250cm9scyB0aGUgZGVmYXVsdCB3b3JraW5nIHNldCB0byB1c2Ugd2hlbiBzd2l0Y2hpbmcgdG8gYSBzb3VyY2UgY29udHJvbCBoaXN0b3J5IGl0ZW0gZ3JvdXAgdGhhdCBkb2VzIG5vdCBoYXZlIGEgd29ya2luZyBzZXQuXCIpLFxuXHRcdFx0ZGVmYXVsdDogJ2N1cnJlbnQnXG5cdFx0fSxcblx0XHQnc2NtLmNvbXBhY3RGb2xkZXJzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdzY20uY29tcGFjdEZvbGRlcnMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIFNvdXJjZSBDb250cm9sIHZpZXcgc2hvdWxkIHJlbmRlciBmb2xkZXJzIGluIGEgY29tcGFjdCBmb3JtLiBJbiBzdWNoIGEgZm9ybSwgc2luZ2xlIGNoaWxkIGZvbGRlcnMgd2lsbCBiZSBjb21wcmVzc2VkIGluIGEgY29tYmluZWQgdHJlZSBlbGVtZW50LlwiKSxcblx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHR9LFxuXHRcdCdzY20uZ3JhcGgucGFnZU9uU2Nyb2xsJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdzY20uZ3JhcGgucGFnZU9uU2Nyb2xsJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBTb3VyY2UgQ29udHJvbCBHcmFwaCB2aWV3IHdpbGwgbG9hZCB0aGUgbmV4dCBwYWdlIG9mIGl0ZW1zIHdoZW4geW91IHNjcm9sbCB0byB0aGUgZW5kIG9mIHRoZSBsaXN0LlwiKSxcblx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHR9LFxuXHRcdCdzY20uZ3JhcGgucGFnZVNpemUnOiB7XG5cdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc2NtLmdyYXBoLnBhZ2VTaXplJywgXCJUaGUgbnVtYmVyIG9mIGl0ZW1zIHRvIHNob3cgaW4gdGhlIFNvdXJjZSBDb250cm9sIEdyYXBoIHZpZXcgYnkgZGVmYXVsdCBhbmQgd2hlbiBsb2FkaW5nIG1vcmUgaXRlbXMuXCIpLFxuXHRcdFx0bWluaW11bTogMSxcblx0XHRcdG1heGltdW06IDEwMDAsXG5cdFx0XHRkZWZhdWx0OiA1MFxuXHRcdH0sXG5cdFx0J3NjbS5ncmFwaC5iYWRnZXMnOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnYWxsJywgJ2ZpbHRlciddLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgnc2NtLmdyYXBoLmJhZGdlcy5hbGwnLCBcIlNob3cgYmFkZ2VzIG9mIGFsbCBoaXN0b3J5IGl0ZW0gZ3JvdXBzIGluIHRoZSBTb3VyY2UgQ29udHJvbCBHcmFwaCB2aWV3LlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3NjbS5ncmFwaC5iYWRnZXMuZmlsdGVyJywgXCJTaG93IG9ubHkgdGhlIGJhZGdlcyBvZiBoaXN0b3J5IGl0ZW0gZ3JvdXBzIHVzZWQgYXMgYSBmaWx0ZXIgaW4gdGhlIFNvdXJjZSBDb250cm9sIEdyYXBoIHZpZXcuXCIpXG5cdFx0XHRdLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdzY20uZ3JhcGguYmFkZ2VzJywgXCJDb250cm9scyB3aGljaCBiYWRnZXMgYXJlIHNob3duIGluIHRoZSBTb3VyY2UgQ29udHJvbCBHcmFwaCB2aWV3LiBUaGUgYmFkZ2VzIGFyZSBzaG93biBvbiB0aGUgcmlnaHQgc2lkZSBvZiB0aGUgZ3JhcGggaW5kaWNhdGluZyB0aGUgbmFtZXMgb2YgaGlzdG9yeSBpdGVtIGdyb3Vwcy5cIiksXG5cdFx0XHRkZWZhdWx0OiAnZmlsdGVyJ1xuXHRcdH1cblx0fVxufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ3NjbS5hY2NlcHRJbnB1dCcsXG5cdG1ldGFkYXRhOiB7IGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc2NtIGFjY2VwdCcsIFwiU291cmNlIENvbnRyb2w6IEFjY2VwdCBJbnB1dFwiKSwgYXJnczogW10gfSxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmhhcygnc2NtUmVwb3NpdG9yeScpLFxuXHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRW50ZXIsXG5cdGhhbmRsZXI6IGFjY2Vzc29yID0+IHtcblx0XHRjb25zdCBjb250ZXh0S2V5U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbnRleHQgPSBjb250ZXh0S2V5U2VydmljZS5nZXRDb250ZXh0KGdldEFjdGl2ZUVsZW1lbnQoKSk7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeUlkID0gY29udGV4dC5nZXRWYWx1ZTxzdHJpbmcgfCB1bmRlZmluZWQ+KCdzY21SZXBvc2l0b3J5Jyk7XG5cblx0XHRpZiAoIXJlcG9zaXRvcnlJZCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShudWxsKTtcblx0XHR9XG5cblx0XHRjb25zdCBzY21TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElTQ01TZXJ2aWNlKTtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0gc2NtU2VydmljZS5nZXRSZXBvc2l0b3J5KHJlcG9zaXRvcnlJZCk7XG5cblx0XHRpZiAoIXJlcG9zaXRvcnk/LnByb3ZpZGVyLmFjY2VwdElucHV0Q29tbWFuZCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShudWxsKTtcblx0XHR9XG5cblx0XHRjb25zdCBpZCA9IHJlcG9zaXRvcnkucHJvdmlkZXIuYWNjZXB0SW5wdXRDb21tYW5kLmlkO1xuXHRcdGNvbnN0IGFyZ3MgPSByZXBvc2l0b3J5LnByb3ZpZGVyLmFjY2VwdElucHV0Q29tbWFuZC5hcmd1bWVudHM7XG5cdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblxuXHRcdHJldHVybiBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChpZCwgLi4uKGFyZ3MgfHwgW10pKTtcblx0fVxufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ3NjbS5jbGVhcklucHV0Jyxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5oYXMoJ3NjbVJlcG9zaXRvcnknKSwgU3VnZ2VzdENvbnRleHQuVmlzaWJsZS50b05lZ2F0ZWQoKSwgRWRpdG9yQ29udGV4dEtleXMuaGFzTm9uRW1wdHlTZWxlY3Rpb24udG9OZWdhdGVkKCkpLFxuXHRwcmltYXJ5OiBLZXlDb2RlLkVzY2FwZSxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yKSA9PiB7XG5cdFx0Y29uc3Qgc2NtU2VydmljZSA9IGFjY2Vzc29yLmdldChJU0NNU2VydmljZSk7XG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGNvbnRleHQgPSBjb250ZXh0S2V5U2VydmljZS5nZXRDb250ZXh0KGdldEFjdGl2ZUVsZW1lbnQoKSk7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeUlkID0gY29udGV4dC5nZXRWYWx1ZTxzdHJpbmcgfCB1bmRlZmluZWQ+KCdzY21SZXBvc2l0b3J5Jyk7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeSA9IHJlcG9zaXRvcnlJZCA/IHNjbVNlcnZpY2UuZ2V0UmVwb3NpdG9yeShyZXBvc2l0b3J5SWQpIDogdW5kZWZpbmVkO1xuXHRcdHJlcG9zaXRvcnk/LmlucHV0LnNldFZhbHVlKCcnLCB0cnVlKTtcblx0fVxufSk7XG5cbmNvbnN0IHZpZXdOZXh0Q29tbWl0Q29tbWFuZCA9IHtcblx0ZGVzY3JpcHRpb246IHsgZGVzY3JpcHRpb246IGxvY2FsaXplKCdzY20gdmlldyBuZXh0IGNvbW1pdCcsIFwiU291cmNlIENvbnRyb2w6IFZpZXcgTmV4dCBDb21taXRcIiksIGFyZ3M6IFtdIH0sXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRoYW5kbGVyOiAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpID0+IHtcblx0XHRjb25zdCBjb250ZXh0S2V5U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IHNjbVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVNDTVNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbnRleHQgPSBjb250ZXh0S2V5U2VydmljZS5nZXRDb250ZXh0KGdldEFjdGl2ZUVsZW1lbnQoKSk7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeUlkID0gY29udGV4dC5nZXRWYWx1ZTxzdHJpbmcgfCB1bmRlZmluZWQ+KCdzY21SZXBvc2l0b3J5Jyk7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeSA9IHJlcG9zaXRvcnlJZCA/IHNjbVNlcnZpY2UuZ2V0UmVwb3NpdG9yeShyZXBvc2l0b3J5SWQpIDogdW5kZWZpbmVkO1xuXHRcdHJlcG9zaXRvcnk/LmlucHV0LnNob3dOZXh0SGlzdG9yeVZhbHVlKCk7XG5cdH1cbn07XG5cbmNvbnN0IHZpZXdQcmV2aW91c0NvbW1pdENvbW1hbmQgPSB7XG5cdGRlc2NyaXB0aW9uOiB7IGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc2NtIHZpZXcgcHJldmlvdXMgY29tbWl0JywgXCJTb3VyY2UgQ29udHJvbDogVmlldyBQcmV2aW91cyBDb21taXRcIiksIGFyZ3M6IFtdIH0sXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRoYW5kbGVyOiAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpID0+IHtcblx0XHRjb25zdCBjb250ZXh0S2V5U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IHNjbVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVNDTVNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbnRleHQgPSBjb250ZXh0S2V5U2VydmljZS5nZXRDb250ZXh0KGdldEFjdGl2ZUVsZW1lbnQoKSk7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeUlkID0gY29udGV4dC5nZXRWYWx1ZTxzdHJpbmcgfCB1bmRlZmluZWQ+KCdzY21SZXBvc2l0b3J5Jyk7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeSA9IHJlcG9zaXRvcnlJZCA/IHNjbVNlcnZpY2UuZ2V0UmVwb3NpdG9yeShyZXBvc2l0b3J5SWQpIDogdW5kZWZpbmVkO1xuXHRcdHJlcG9zaXRvcnk/LmlucHV0LnNob3dQcmV2aW91c0hpc3RvcnlWYWx1ZSgpO1xuXHR9XG59O1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0Li4udmlld05leHRDb21taXRDb21tYW5kLFxuXHRpZDogJ3NjbS52aWV3TmV4dENvbW1pdCcsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5oYXMoJ3NjbVJlcG9zaXRvcnknKSwgQ29udGV4dEtleUV4cHIuaGFzKCdzY21JbnB1dElzSW5MYXN0UG9zaXRpb24nKSwgU3VnZ2VzdENvbnRleHQuVmlzaWJsZS50b05lZ2F0ZWQoKSksXG5cdHByaW1hcnk6IEtleUNvZGUuRG93bkFycm93XG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdC4uLnZpZXdQcmV2aW91c0NvbW1pdENvbW1hbmQsXG5cdGlkOiAnc2NtLnZpZXdQcmV2aW91c0NvbW1pdCcsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5oYXMoJ3NjbVJlcG9zaXRvcnknKSwgQ29udGV4dEtleUV4cHIuaGFzKCdzY21JbnB1dElzSW5GaXJzdFBvc2l0aW9uJyksIFN1Z2dlc3RDb250ZXh0LlZpc2libGUudG9OZWdhdGVkKCkpLFxuXHRwcmltYXJ5OiBLZXlDb2RlLlVwQXJyb3dcbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0Li4udmlld05leHRDb21taXRDb21tYW5kLFxuXHRpZDogJ3NjbS5mb3JjZVZpZXdOZXh0Q29tbWl0Jyxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuaGFzKCdzY21SZXBvc2l0b3J5JyksXG5cdHByaW1hcnk6IEtleU1vZC5BbHQgfCBLZXlDb2RlLkRvd25BcnJvd1xufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHQuLi52aWV3UHJldmlvdXNDb21taXRDb21tYW5kLFxuXHRpZDogJ3NjbS5mb3JjZVZpZXdQcmV2aW91c0NvbW1pdCcsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmhhcygnc2NtUmVwb3NpdG9yeScpLFxuXHRwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5VcEFycm93XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ3NjbS5vcGVuSW5JbnRlZ3JhdGVkVGVybWluYWwnLCBhc3luYyAoYWNjZXNzb3IsIC4uLnByb3ZpZGVyczogSVNDTVByb3ZpZGVyW10pID0+IHtcblx0aWYgKCFwcm92aWRlcnMgfHwgcHJvdmlkZXJzLmxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdGNvbnN0IGxpc3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSk7XG5cblx0bGV0IHByb3ZpZGVyID0gcHJvdmlkZXJzLmxlbmd0aCA9PT0gMSA/IHByb3ZpZGVyc1swXSA6IHVuZGVmaW5lZDtcblxuXHRpZiAoIXByb3ZpZGVyKSB7XG5cdFx0Y29uc3QgbGlzdCA9IGxpc3RTZXJ2aWNlLmxhc3RGb2N1c2VkTGlzdDtcblx0XHRjb25zdCBlbGVtZW50ID0gbGlzdD8uZ2V0SFRNTEVsZW1lbnQoKTtcblxuXHRcdGlmIChsaXN0IGluc3RhbmNlb2YgV29ya2JlbmNoTGlzdCAmJiBlbGVtZW50ICYmIGlzQWN0aXZlRWxlbWVudChlbGVtZW50KSkge1xuXHRcdFx0Y29uc3QgW2luZGV4XSA9IGxpc3QuZ2V0Rm9jdXMoKTtcblx0XHRcdGNvbnN0IGZvY3VzZWRFbGVtZW50ID0gbGlzdC5lbGVtZW50KGluZGV4KTtcblxuXHRcdFx0Ly8gU291cmNlIENvbnRyb2wgUmVwb3NpdG9yaWVzXG5cdFx0XHRpZiAoaXNTQ01SZXBvc2l0b3J5KGZvY3VzZWRFbGVtZW50KSkge1xuXHRcdFx0XHRwcm92aWRlciA9IGZvY3VzZWRFbGVtZW50LnByb3ZpZGVyO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlmICghcHJvdmlkZXI/LnJvb3RVcmkpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRhd2FpdCBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnb3BlbkluSW50ZWdyYXRlZFRlcm1pbmFsJywgcHJvdmlkZXIucm9vdFVyaSk7XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ3NjbS5vcGVuSW5UZXJtaW5hbCcsIGFzeW5jIChhY2Nlc3NvciwgcHJvdmlkZXI6IElTQ01Qcm92aWRlcikgPT4ge1xuXHRpZiAoIXByb3ZpZGVyIHx8ICFwcm92aWRlci5yb290VXJpKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblx0YXdhaXQgY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ29wZW5JblRlcm1pbmFsJywgcHJvdmlkZXIucm9vdFVyaSk7XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ3NjbS5zZXRBY3RpdmVQcm92aWRlcicsIGFzeW5jIChhY2Nlc3NvcikgPT4ge1xuXHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRjb25zdCBzY21WaWV3U2VydmljZSA9IGFjY2Vzc29yLmdldChJU0NNVmlld1NlcnZpY2UpO1xuXG5cdGNvbnN0IHBsYWNlSG9sZGVyID0gbG9jYWxpemUoJ3NjbUFjdGl2ZVJlcG9zaXRvcnlQbGFjZUhvbGRlcicsIFwiU2VsZWN0IHRoZSBhY3RpdmUgcmVwb3NpdG9yeSwgdHlwZSB0byBmaWx0ZXIgYWxsIHJlcG9zaXRvcmllc1wiKTtcblx0Y29uc3QgYXV0b1F1aWNrSXRlbURlc2NyaXB0aW9uID0gbG9jYWxpemUoJ3NjbUFjdGl2ZVJlcG9zaXRvcnlBdXRvRGVzY3JpcHRpb24nLCBcIlRoZSBhY3RpdmUgcmVwb3NpdG9yeSBpcyB1cGRhdGVkIGJhc2VkIG9uIGZvY3VzZWQgcmVwb3NpdG9yeS9hY3RpdmUgZWRpdG9yXCIpO1xuXHRjb25zdCByZXBvc2l0b3J5UGlja2VyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVwb3NpdG9yeVBpY2tlciwgcGxhY2VIb2xkZXIsIGF1dG9RdWlja0l0ZW1EZXNjcmlwdGlvbik7XG5cblx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcmVwb3NpdG9yeVBpY2tlci5waWNrUmVwb3NpdG9yeSgpO1xuXHRpZiAocmVzdWx0Py5yZXBvc2l0b3J5KSB7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeSA9IHJlc3VsdC5yZXBvc2l0b3J5ICE9PSAnYXV0bycgPyByZXN1bHQucmVwb3NpdG9yeSA6IHVuZGVmaW5lZDtcblx0XHRzY21WaWV3U2VydmljZS5waW5BY3RpdmVSZXBvc2l0b3J5KHJlcG9zaXRvcnkpO1xuXHR9XG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5TQ01Tb3VyY2VDb250cm9sLCB7XG5cdGdyb3VwOiAnMTAwX2VuZCcsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogJ3NjbS5vcGVuSW5UZXJtaW5hbCcsXG5cdFx0dGl0bGU6IGxvY2FsaXplKCdvcGVuIGluIGV4dGVybmFsIHRlcm1pbmFsJywgXCJPcGVuIGluIEV4dGVybmFsIFRlcm1pbmFsXCIpXG5cdH0sXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRSZW1vdGVOYW1lQ29udGV4dC5pc0VxdWFsVG8oJycpLFxuXHRcdENvbnRleHRLZXlFeHByLmVxdWFscygnc2NtUHJvdmlkZXJIYXNSb290VXJpJywgdHJ1ZSksXG5cdFx0Q29udGV4dEtleUV4cHIub3IoXG5cdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy50ZXJtaW5hbC5zb3VyY2VDb250cm9sUmVwb3NpdG9yaWVzS2luZCcsICdleHRlcm5hbCcpLFxuXHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcudGVybWluYWwuc291cmNlQ29udHJvbFJlcG9zaXRvcmllc0tpbmQnLCAnYm90aCcpKSlcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLlNDTVNvdXJjZUNvbnRyb2wsIHtcblx0Z3JvdXA6ICcxMDBfZW5kJyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiAnc2NtLm9wZW5JbkludGVncmF0ZWRUZXJtaW5hbCcsXG5cdFx0dGl0bGU6IGxvY2FsaXplKCdvcGVuIGluIGludGVncmF0ZWQgdGVybWluYWwnLCBcIk9wZW4gaW4gSW50ZWdyYXRlZCBUZXJtaW5hbFwiKVxuXHR9LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCdzY21Qcm92aWRlckhhc1Jvb3RVcmknLCB0cnVlKSxcblx0XHRDb250ZXh0S2V5RXhwci5vcihcblx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLnRlcm1pbmFsLnNvdXJjZUNvbnRyb2xSZXBvc2l0b3JpZXNLaW5kJywgJ2ludGVncmF0ZWQnKSxcblx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLnRlcm1pbmFsLnNvdXJjZUNvbnRyb2xSZXBvc2l0b3JpZXNLaW5kJywgJ2JvdGgnKSkpXG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiAnd29ya2JlbmNoLnNjbS5hY3Rpb24uZm9jdXNQcmV2aW91c0lucHV0Jyxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHdoZW46IENvbnRleHRLZXlzLlJlcG9zaXRvcnlWaXNpYmlsaXR5Q291bnQubm90RXF1YWxzVG8oMCksXG5cdGhhbmRsZXI6IGFzeW5jIGFjY2Vzc29yID0+IHtcblx0XHRjb25zdCB2aWV3c1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdFx0Y29uc3Qgc2NtVmlldyA9IGF3YWl0IHZpZXdzU2VydmljZS5vcGVuVmlldzxTQ01WaWV3UGFuZT4oVklFV19QQU5FX0lEKTtcblx0XHRpZiAoc2NtVmlldykge1xuXHRcdFx0c2NtVmlldy5mb2N1c1ByZXZpb3VzSW5wdXQoKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6ICd3b3JrYmVuY2guc2NtLmFjdGlvbi5mb2N1c05leHRJbnB1dCcsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHR3aGVuOiBDb250ZXh0S2V5cy5SZXBvc2l0b3J5VmlzaWJpbGl0eUNvdW50Lm5vdEVxdWFsc1RvKDApLFxuXHRoYW5kbGVyOiBhc3luYyBhY2Nlc3NvciA9PiB7XG5cdFx0Y29uc3Qgdmlld3NTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpO1xuXHRcdGNvbnN0IHNjbVZpZXcgPSBhd2FpdCB2aWV3c1NlcnZpY2Uub3BlblZpZXc8U0NNVmlld1BhbmU+KFZJRVdfUEFORV9JRCk7XG5cdFx0aWYgKHNjbVZpZXcpIHtcblx0XHRcdHNjbVZpZXcuZm9jdXNOZXh0SW5wdXQoKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6ICd3b3JrYmVuY2guc2NtLmFjdGlvbi5mb2N1c1ByZXZpb3VzUmVzb3VyY2VHcm91cCcsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRoYW5kbGVyOiBhc3luYyBhY2Nlc3NvciA9PiB7XG5cdFx0Y29uc3Qgdmlld3NTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpO1xuXHRcdGNvbnN0IHNjbVZpZXcgPSBhd2FpdCB2aWV3c1NlcnZpY2Uub3BlblZpZXc8U0NNVmlld1BhbmU+KFZJRVdfUEFORV9JRCk7XG5cdFx0aWYgKHNjbVZpZXcpIHtcblx0XHRcdHNjbVZpZXcuZm9jdXNQcmV2aW91c1Jlc291cmNlR3JvdXAoKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6ICd3b3JrYmVuY2guc2NtLmFjdGlvbi5mb2N1c05leHRSZXNvdXJjZUdyb3VwJyxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdGhhbmRsZXI6IGFzeW5jIGFjY2Vzc29yID0+IHtcblx0XHRjb25zdCB2aWV3c1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdFx0Y29uc3Qgc2NtVmlldyA9IGF3YWl0IHZpZXdzU2VydmljZS5vcGVuVmlldzxTQ01WaWV3UGFuZT4oVklFV19QQU5FX0lEKTtcblx0XHRpZiAoc2NtVmlldykge1xuXHRcdFx0c2NtVmlldy5mb2N1c05leHRSZXNvdXJjZUdyb3VwKCk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJTaW5nbGV0b24oSVNDTVNlcnZpY2UsIFNDTVNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSVNDTVZpZXdTZXJ2aWNlLCBTQ01WaWV3U2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG5yZWdpc3RlclNpbmdsZXRvbihJUXVpY2tEaWZmU2VydmljZSwgUXVpY2tEaWZmU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG5yZWdpc3RlclNpbmdsZXRvbihJUXVpY2tEaWZmTW9kZWxTZXJ2aWNlLCBRdWlja0RpZmZNb2RlbFNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xuXG5BY2Nlc3NpYmxlVmlld1JlZ2lzdHJ5LnJlZ2lzdGVyKG5ldyBTQ01BY2Nlc3NpYmlsaXR5SGVscCgpKTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBMEMsZ0NBQWdDLGNBQWMscUJBQXFCLHNCQUFzQjtBQUNuSSxTQUFTLG9DQUFvQztBQUM3QyxTQUFTLFlBQVksYUFBYSxjQUE0QixpQkFBaUIsMkJBQTJCLDRCQUE0QjtBQUN0SSxTQUFTLFFBQVEsZUFBZTtBQUNoQyxTQUFTLGNBQWMsY0FBYztBQUNyQyxTQUFTLHVDQUF1QyxxQ0FBcUM7QUFDckYsU0FBUyxzQkFBc0I7QUFDL0IsU0FBaUMsY0FBYyx5QkFBeUIsMEJBQTBCO0FBQ2xHLFNBQVMsb0JBQW9CLHNCQUFzQjtBQUNuRCxTQUFTLGtCQUFrQix1QkFBdUI7QUFDbEQsU0FBUyxxQkFBcUIsd0JBQXdCO0FBQ3RELFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLGtCQUFrQjtBQUMzQixTQUFrQyx1QkFBdUIsY0FBYywrQkFBK0M7QUFDdEgsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxxQkFBcUI7QUFDOUIsU0FB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
