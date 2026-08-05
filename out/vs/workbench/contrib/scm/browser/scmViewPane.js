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
import "./media/scm.css";
import { Event, Emitter } from "../../../../base/common/event.js";
import { basename, dirname } from "../../../../base/common/resources.js";
import { Disposable, DisposableStore, combinedDisposable, dispose, toDisposable, MutableDisposable, DisposableMap } from "../../../../base/common/lifecycle.js";
import { ViewPane, ViewAction } from "../../../browser/parts/views/viewPane.js";
import { append, $, Dimension, trackFocus, clearNode, isPointerEvent, isActiveElement } from "../../../../base/browser/dom.js";
import { asCSSUrl } from "../../../../base/browser/cssValue.js";
import { InputValidationType, ISCMViewService, ISCMService, SCMInputChangeReason, VIEW_PANE_ID, ISCMRepositorySortKey } from "../common/scm.js";
import { ResourceLabels } from "../../../browser/labels.js";
import { CountBadge } from "../../../../base/browser/ui/countBadge/countBadge.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IContextViewService, IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IContextKeyService, ContextKeyExpr, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { MenuItemAction, IMenuService, registerAction2, MenuId, MenuRegistry, Action2 } from "../../../../platform/actions/common/actions.js";
import { ActionRunner, Action, Separator, toAction } from "../../../../base/common/actions.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { isSCMResource, isSCMResourceGroup, isSCMRepository, isSCMInput, collectContextMenuActions, getActionViewItemProvider, isSCMActionButton, isSCMViewService, isSCMResourceNode, connectPrimaryMenu } from "./util.js";
import { WorkbenchCompressibleAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { IConfigurationService, ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { disposableTimeout, Sequencer, ThrottledDelayer, Throttler } from "../../../../base/common/async.js";
import { ResourceTree } from "../../../../base/common/resourceTree.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { FileKind } from "../../../../platform/files/common/files.js";
import { compareFileNames, comparePaths } from "../../../../base/common/comparers.js";
import { createMatches } from "../../../../base/common/filters.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { localize } from "../../../../nls.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../common/editor.js";
import { CodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { getSimpleEditorOptions, setupSimpleEditorSelectionStyling } from "../../codeEditor/browser/simpleEditorOptions.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { EditorExtensionsRegistry } from "../../../../editor/browser/editorExtensions.js";
import { MenuPreventer } from "../../codeEditor/browser/menuPreventer.js";
import { SelectionClipboardContributionID } from "../../codeEditor/browser/selectionClipboard.js";
import { EditorDictation } from "../../codeEditor/browser/dictation/editorDictation.js";
import { ContextMenuController } from "../../../../editor/contrib/contextmenu/browser/contextmenu.js";
import * as platform from "../../../../base/common/platform.js";
import { compare, format } from "../../../../base/common/strings.js";
import { SuggestController } from "../../../../editor/contrib/suggest/browser/suggestController.js";
import { SnippetController2 } from "../../../../editor/contrib/snippet/browser/snippetController2.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { ColorDetector } from "../../../../editor/contrib/colorPicker/browser/colorDetector.js";
import { LinkDetector } from "../../../../editor/contrib/links/browser/links.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { DEFAULT_FONT_FAMILY } from "../../../../base/browser/fonts.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { AnchorAlignment } from "../../../../base/browser/ui/contextview/contextview.js";
import { RepositoryActionRunner, RepositoryRenderer } from "./scmRepositoryRenderer.js";
import { ColorScheme } from "../../../../platform/theme/common/theme.js";
import { API_OPEN_DIFF_EDITOR_COMMAND_ID, API_OPEN_EDITOR_COMMAND_ID } from "../../../browser/parts/editor/editorCommands.js";
import { createActionViewItem, getFlatActionBarActions, getFlatContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { MarkdownRenderer, openLinkFromMarkdown } from "../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { Button, ButtonWithDropdown } from "../../../../base/browser/ui/button/button.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { RepositoryContextKeys } from "./scmViewService.js";
import { DragAndDropController } from "../../../../editor/contrib/dnd/browser/dnd.js";
import { CopyPasteController } from "../../../../editor/contrib/dropOrPasteInto/browser/copyPasteController.js";
import { DropIntoEditorController } from "../../../../editor/contrib/dropOrPasteInto/browser/dropIntoEditorController.js";
import { MessageController } from "../../../../editor/contrib/message/browser/messageController.js";
import { defaultButtonStyles, defaultCountBadgeStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { InlineCompletionsController } from "../../../../editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController.js";
import { CodeActionController } from "../../../../editor/contrib/codeAction/browser/codeActionController.js";
import { Schemas } from "../../../../base/common/network.js";
import { fillEditorsDragData } from "../../../browser/dnd.js";
import { CodeDataTransfers } from "../../../../platform/dnd/browser/dnd.js";
import { FormatOnType } from "../../../../editor/contrib/format/browser/formatActions.js";
import { EditorOption, EditorOptions } from "../../../../editor/common/config/editorOptions.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { EditOperation } from "../../../../editor/common/core/editOperation.js";
import { WorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { DropdownWithPrimaryActionViewItem } from "../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js";
import { clamp, rot } from "../../../../base/common/numbers.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { OpenScmGroupAction } from "../../multiDiffEditor/browser/scmMultiDiffSourceResolver.js";
import { ContentHoverController } from "../../../../editor/contrib/hover/browser/contentHoverController.js";
import { GlyphHoverController } from "../../../../editor/contrib/hover/browser/glyphHoverController.js";
import { autorun, runOnChange } from "../../../../base/common/observable.js";
import { PlaceholderTextContribution } from "../../../../editor/contrib/placeholderText/browser/placeholderTextContribution.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
function processResourceFilterData(uri, filterData) {
  if (!filterData) {
    return [void 0, void 0];
  }
  if (!filterData.label) {
    const matches2 = createMatches(filterData);
    return [matches2, void 0];
  }
  const fileName = basename(uri);
  const label = filterData.label;
  const pathLength = label.length - fileName.length;
  const matches = createMatches(filterData.score);
  if (label === fileName) {
    return [matches, void 0];
  }
  const labelMatches = [];
  const descriptionMatches = [];
  for (const match of matches) {
    if (match.start > pathLength) {
      labelMatches.push({
        start: match.start - pathLength,
        end: match.end - pathLength
      });
    } else if (match.end < pathLength) {
      descriptionMatches.push(match);
    } else {
      labelMatches.push({
        start: 0,
        end: match.end - pathLength
      });
      descriptionMatches.push({
        start: match.start,
        end: pathLength
      });
    }
  }
  return [labelMatches, descriptionMatches];
}
let ActionButtonRenderer = class {
  constructor(commandService, contextMenuService, notificationService) {
    this.commandService = commandService;
    this.contextMenuService = contextMenuService;
    this.notificationService = notificationService;
    this.actionButtons = /* @__PURE__ */ new Map();
  }
  get templateId() {
    return ActionButtonRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    container.parentElement.parentElement.querySelector(".monaco-tl-twistie").classList.add("force-no-twistie");
    container.parentElement.parentElement.classList.add("cursor-default", "force-no-hover");
    const buttonContainer = append(container, $(".button-container"));
    const actionButton = new SCMActionButton(buttonContainer, this.contextMenuService, this.commandService, this.notificationService);
    return { actionButton, disposable: Disposable.None, templateDisposable: actionButton };
  }
  renderElement(node, index, templateData, height) {
    templateData.disposable.dispose();
    const disposables = new DisposableStore();
    const actionButton = node.element;
    templateData.actionButton.setButton(node.element.button);
    this.actionButtons.set(actionButton, templateData.actionButton);
    disposables.add({ dispose: () => this.actionButtons.delete(actionButton) });
    templateData.disposable = disposables;
  }
  renderCompressedElements() {
    throw new Error("Should never happen since node is incompressible");
  }
  focusActionButton(actionButton) {
    this.actionButtons.get(actionButton)?.focus();
  }
  disposeElement(node, index, template) {
    template.disposable.dispose();
  }
  disposeTemplate(templateData) {
    templateData.disposable.dispose();
    templateData.templateDisposable.dispose();
  }
};
ActionButtonRenderer.DEFAULT_HEIGHT = 28;
ActionButtonRenderer.TEMPLATE_ID = "actionButton";
ActionButtonRenderer = __decorateClass([
  __decorateParam(0, ICommandService),
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, INotificationService)
], ActionButtonRenderer);
class SCMTreeDragAndDrop {
  constructor(instantiationService) {
    this.instantiationService = instantiationService;
  }
  getDragURI(element) {
    if (isSCMResource(element)) {
      return element.sourceUri.toString();
    }
    return null;
  }
  onDragStart(data, originalEvent) {
    const items = SCMTreeDragAndDrop.getResourcesFromDragAndDropData(data);
    if (originalEvent.dataTransfer && items?.length) {
      this.instantiationService.invokeFunction((accessor) => fillEditorsDragData(accessor, items, originalEvent));
      const fileResources = items.filter((s) => s.scheme === Schemas.file).map((r) => r.fsPath);
      if (fileResources.length) {
        originalEvent.dataTransfer.setData(CodeDataTransfers.FILES, JSON.stringify(fileResources));
      }
    }
  }
  getDragLabel(elements, originalEvent) {
    if (elements.length === 1) {
      const element = elements[0];
      if (isSCMResource(element)) {
        return basename(element.sourceUri);
      }
    }
    return String(elements.length);
  }
  onDragOver(data, targetElement, targetIndex, targetSector, originalEvent) {
    return true;
  }
  drop(data, targetElement, targetIndex, targetSector, originalEvent) {
  }
  static getResourcesFromDragAndDropData(data) {
    const uris = [];
    for (const element of [...data.context ?? [], ...data.elements]) {
      if (isSCMResource(element)) {
        uris.push(element.sourceUri);
      }
    }
    return uris;
  }
  dispose() {
  }
}
let InputRenderer = class {
  constructor(outerLayout, overflowWidgetsDomNode, updateHeight, instantiationService) {
    this.outerLayout = outerLayout;
    this.overflowWidgetsDomNode = overflowWidgetsDomNode;
    this.updateHeight = updateHeight;
    this.instantiationService = instantiationService;
    this.inputWidgets = /* @__PURE__ */ new Map();
    this.contentHeights = /* @__PURE__ */ new WeakMap();
    this.editorSelections = /* @__PURE__ */ new WeakMap();
  }
  get templateId() {
    return InputRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    container.parentElement.parentElement.querySelector(".monaco-tl-twistie").classList.add("force-no-twistie");
    container.parentElement.parentElement.classList.add("force-no-hover");
    const templateDisposable = new DisposableStore();
    const inputElement = append(container, $(".scm-input"));
    const inputWidget = this.instantiationService.createInstance(SCMInputWidget, inputElement, this.overflowWidgetsDomNode);
    templateDisposable.add(inputWidget);
    return { inputWidget, inputWidgetHeight: InputRenderer.DEFAULT_HEIGHT, elementDisposables: new DisposableStore(), templateDisposable };
  }
  renderElement(node, index, templateData) {
    const input = node.element;
    templateData.inputWidget.input = input;
    this.inputWidgets.set(input, templateData.inputWidget);
    templateData.elementDisposables.add({
      dispose: () => this.inputWidgets.delete(input)
    });
    const selections = this.editorSelections.get(input);
    if (selections) {
      templateData.inputWidget.selections = selections;
    }
    templateData.elementDisposables.add(toDisposable(() => {
      const selections2 = templateData.inputWidget.selections;
      if (selections2) {
        this.editorSelections.set(input, selections2);
      }
    }));
    templateData.inputWidgetHeight = InputRenderer.DEFAULT_HEIGHT;
    const onDidChangeContentHeight = () => {
      const contentHeight = templateData.inputWidget.getContentHeight();
      this.contentHeights.set(input, contentHeight);
      if (templateData.inputWidgetHeight !== contentHeight) {
        this.updateHeight(input, contentHeight + 10);
        templateData.inputWidgetHeight = contentHeight;
        templateData.inputWidget.layout();
      }
    };
    const startListeningContentHeightChange = () => {
      templateData.elementDisposables.add(templateData.inputWidget.onDidChangeContentHeight(onDidChangeContentHeight));
      onDidChangeContentHeight();
    };
    disposableTimeout(startListeningContentHeightChange, 0, templateData.elementDisposables);
    const layoutEditor = () => templateData.inputWidget.layout();
    templateData.elementDisposables.add(this.outerLayout.onDidChange(layoutEditor));
    layoutEditor();
  }
  renderCompressedElements() {
    throw new Error("Should never happen since node is incompressible");
  }
  disposeElement(group, index, template) {
    template.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposable.dispose();
  }
  getHeight(input) {
    return (this.contentHeights.get(input) ?? InputRenderer.DEFAULT_HEIGHT) + 10;
  }
  getRenderedInputWidget(input) {
    return this.inputWidgets.get(input);
  }
  getFocusedInput() {
    for (const [input, inputWidget] of this.inputWidgets) {
      if (inputWidget.hasFocus()) {
        return input;
      }
    }
    return void 0;
  }
  clearValidation() {
    for (const [, inputWidget] of this.inputWidgets) {
      inputWidget.clearValidation();
    }
  }
};
InputRenderer.DEFAULT_HEIGHT = 26;
InputRenderer.TEMPLATE_ID = "input";
InputRenderer = __decorateClass([
  __decorateParam(3, IInstantiationService)
], InputRenderer);
let ResourceGroupRenderer = class {
  constructor(actionViewItemProvider, actionRunner, commandService, contextKeyService, contextMenuService, keybindingService, menuService, scmViewService, telemetryService) {
    this.actionViewItemProvider = actionViewItemProvider;
    this.actionRunner = actionRunner;
    this.commandService = commandService;
    this.contextKeyService = contextKeyService;
    this.contextMenuService = contextMenuService;
    this.keybindingService = keybindingService;
    this.menuService = menuService;
    this.scmViewService = scmViewService;
    this.telemetryService = telemetryService;
  }
  get templateId() {
    return ResourceGroupRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    container.parentElement.parentElement.querySelector(".monaco-tl-twistie").classList.add("force-twistie");
    const element = append(container, $(".resource-group"));
    const name = append(element, $(".name"));
    const actionsContainer = append(element, $(".actions"));
    const actionBar = new WorkbenchToolBar(actionsContainer, {
      actionViewItemProvider: this.actionViewItemProvider,
      actionRunner: this.actionRunner
    }, this.menuService, this.contextKeyService, this.contextMenuService, this.keybindingService, this.commandService, this.telemetryService);
    const countContainer = append(element, $(".count"));
    const count = new CountBadge(countContainer, {}, defaultCountBadgeStyles);
    const disposables = combinedDisposable(actionBar, count);
    return { name, count, actionBar, elementDisposables: new DisposableStore(), disposables };
  }
  renderElement(node, index, template) {
    const group = node.element;
    template.name.textContent = group.label;
    template.count.setCount(group.resources.length);
    const menus = this.scmViewService.menus.getRepositoryMenus(group.provider);
    template.elementDisposables.add(connectPrimaryMenu(menus.getResourceGroupMenu(group), (primary) => {
      template.actionBar.setActions(primary);
    }, "inline"));
    template.actionBar.context = group;
  }
  renderCompressedElements(node, index, templateData, height) {
    throw new Error("Should never happen since node is incompressible");
  }
  disposeElement(group, index, template) {
    template.elementDisposables.clear();
  }
  disposeTemplate(template) {
    template.elementDisposables.dispose();
    template.disposables.dispose();
  }
};
ResourceGroupRenderer.TEMPLATE_ID = "resource group";
ResourceGroupRenderer = __decorateClass([
  __decorateParam(2, ICommandService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IMenuService),
  __decorateParam(7, ISCMViewService),
  __decorateParam(8, ITelemetryService)
], ResourceGroupRenderer);
class RepositoryPaneActionRunner extends ActionRunner {
  constructor(getSelectedResources) {
    super();
    this.getSelectedResources = getSelectedResources;
  }
  async runAction(action, context) {
    if (!(action instanceof MenuItemAction)) {
      return super.runAction(action, context);
    }
    const isContextResourceGroup = isSCMResourceGroup(context);
    const selection = this.getSelectedResources().filter((r) => isSCMResourceGroup(r) === isContextResourceGroup);
    const contextIsSelected = selection.some((s) => s === context);
    const actualContext = contextIsSelected ? selection : [context];
    const args = actualContext.map((e) => ResourceTree.isResourceNode(e) ? ResourceTree.collect(e) : [e]).flat();
    await action.run(...args);
  }
}
let ResourceRenderer = class {
  constructor(viewMode, labels, actionViewItemProvider, actionRunner, commandService, contextKeyService, contextMenuService, keybindingService, labelService, menuService, scmViewService, telemetryService, themeService) {
    this.viewMode = viewMode;
    this.labels = labels;
    this.actionViewItemProvider = actionViewItemProvider;
    this.actionRunner = actionRunner;
    this.commandService = commandService;
    this.contextKeyService = contextKeyService;
    this.contextMenuService = contextMenuService;
    this.keybindingService = keybindingService;
    this.labelService = labelService;
    this.menuService = menuService;
    this.scmViewService = scmViewService;
    this.telemetryService = telemetryService;
    this.themeService = themeService;
    this.disposables = new DisposableStore();
    this.renderedResources = /* @__PURE__ */ new Map();
    themeService.onDidColorThemeChange(this.onDidColorThemeChange, this, this.disposables);
  }
  get templateId() {
    return ResourceRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const element = append(container, $(".resource"));
    const name = append(element, $(".name"));
    const fileLabel = this.labels.create(name, { supportDescriptionHighlights: true, supportHighlights: true });
    const actionsContainer = append(fileLabel.element, $(".actions"));
    const actionBar = new WorkbenchToolBar(actionsContainer, {
      actionViewItemProvider: this.actionViewItemProvider,
      actionRunner: this.actionRunner
    }, this.menuService, this.contextKeyService, this.contextMenuService, this.keybindingService, this.commandService, this.telemetryService);
    const decorationIcon = append(element, $(".decoration-icon"));
    const actionBarMenuListener = new MutableDisposable();
    const disposables = combinedDisposable(actionBar, fileLabel, actionBarMenuListener);
    return { element, name, fileLabel, decorationIcon, actionBar, actionBarMenu: void 0, actionBarMenuListener, elementDisposables: new DisposableStore(), disposables };
  }
  renderElement(node, index, template) {
    const resourceOrFolder = node.element;
    const iconResource = ResourceTree.isResourceNode(resourceOrFolder) ? resourceOrFolder.element : resourceOrFolder;
    const uri = ResourceTree.isResourceNode(resourceOrFolder) ? resourceOrFolder.uri : resourceOrFolder.sourceUri;
    const fileKind = ResourceTree.isResourceNode(resourceOrFolder) ? FileKind.FOLDER : FileKind.FILE;
    const tooltip = !ResourceTree.isResourceNode(resourceOrFolder) && resourceOrFolder.decorations.tooltip || "";
    const hidePath = this.viewMode() === "tree" /* Tree */;
    let matches;
    let descriptionMatches;
    let strikethrough;
    if (ResourceTree.isResourceNode(resourceOrFolder)) {
      if (resourceOrFolder.element) {
        const menus = this.scmViewService.menus.getRepositoryMenus(resourceOrFolder.element.resourceGroup.provider);
        this._renderActionBar(template, resourceOrFolder, menus.getResourceMenu(resourceOrFolder.element));
        template.element.classList.toggle("faded", resourceOrFolder.element.decorations.faded);
        strikethrough = resourceOrFolder.element.decorations.strikeThrough;
      } else {
        const menus = this.scmViewService.menus.getRepositoryMenus(resourceOrFolder.context.provider);
        this._renderActionBar(template, resourceOrFolder, menus.getResourceFolderMenu(resourceOrFolder.context));
        matches = createMatches(node.filterData);
        template.element.classList.remove("faded");
      }
    } else {
      const menus = this.scmViewService.menus.getRepositoryMenus(resourceOrFolder.resourceGroup.provider);
      this._renderActionBar(template, resourceOrFolder, menus.getResourceMenu(resourceOrFolder));
      [matches, descriptionMatches] = processResourceFilterData(uri, node.filterData);
      template.element.classList.toggle("faded", resourceOrFolder.decorations.faded);
      strikethrough = resourceOrFolder.decorations.strikeThrough;
    }
    const renderedData = {
      tooltip,
      uri,
      fileLabelOptions: { hidePath, fileKind, matches, descriptionMatches, strikethrough },
      iconResource
    };
    this.renderIcon(template, renderedData);
    this.renderedResources.set(template, renderedData);
    template.elementDisposables.add(toDisposable(() => this.renderedResources.delete(template)));
    template.element.setAttribute("data-tooltip", tooltip);
  }
  disposeElement(resource, index, template) {
    template.elementDisposables.clear();
  }
  renderCompressedElements(node, index, template, height) {
    const compressed = node.element;
    const folder = compressed.elements[compressed.elements.length - 1];
    const label = compressed.elements.map((e) => e.name);
    const fileKind = FileKind.FOLDER;
    const matches = createMatches(node.filterData);
    template.fileLabel.setResource({ resource: folder.uri, name: label }, {
      fileDecorations: { colors: false, badges: true },
      fileKind,
      matches,
      separator: this.labelService.getSeparator(folder.uri.scheme)
    });
    const menus = this.scmViewService.menus.getRepositoryMenus(folder.context.provider);
    this._renderActionBar(template, folder, menus.getResourceFolderMenu(folder.context));
    template.name.classList.remove("strike-through");
    template.element.classList.remove("faded");
    template.decorationIcon.style.display = "none";
    template.decorationIcon.style.backgroundImage = "";
    template.element.setAttribute("data-tooltip", "");
  }
  disposeCompressedElements(node, index, template, height) {
    template.elementDisposables.clear();
  }
  disposeTemplate(template) {
    template.elementDisposables.dispose();
    template.disposables.dispose();
  }
  _renderActionBar(template, resourceOrFolder, menu) {
    if (!template.actionBarMenu || template.actionBarMenu !== menu) {
      template.actionBarMenu = menu;
      template.actionBarMenuListener.value = connectPrimaryMenu(menu, (primary) => {
        template.actionBar.setActions(primary);
      }, "inline");
    }
    template.actionBar.context = resourceOrFolder;
  }
  onDidColorThemeChange() {
    for (const [template, data] of this.renderedResources) {
      this.renderIcon(template, data);
    }
  }
  renderIcon(template, data) {
    const theme = this.themeService.getColorTheme();
    const icon = theme.type === ColorScheme.LIGHT ? data.iconResource?.decorations.icon : data.iconResource?.decorations.iconDark;
    template.fileLabel.setFile(data.uri, {
      ...data.fileLabelOptions,
      fileDecorations: { colors: false, badges: !icon }
    });
    if (icon) {
      if (ThemeIcon.isThemeIcon(icon)) {
        template.decorationIcon.className = `decoration-icon ${ThemeIcon.asClassName(icon)}`;
        if (icon.color) {
          template.decorationIcon.style.color = theme.getColor(icon.color.id)?.toString() ?? "";
        }
        template.decorationIcon.style.display = "";
        template.decorationIcon.style.backgroundImage = "";
      } else {
        template.decorationIcon.className = "decoration-icon";
        template.decorationIcon.style.color = "";
        template.decorationIcon.style.display = "";
        template.decorationIcon.style.backgroundImage = asCSSUrl(icon);
      }
      template.decorationIcon.title = data.tooltip;
    } else {
      template.decorationIcon.className = "decoration-icon";
      template.decorationIcon.style.color = "";
      template.decorationIcon.style.display = "none";
      template.decorationIcon.style.backgroundImage = "";
      template.decorationIcon.title = "";
    }
  }
  dispose() {
    this.disposables.dispose();
  }
};
ResourceRenderer.TEMPLATE_ID = "resource";
ResourceRenderer = __decorateClass([
  __decorateParam(4, ICommandService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, ILabelService),
  __decorateParam(9, IMenuService),
  __decorateParam(10, ISCMViewService),
  __decorateParam(11, ITelemetryService),
  __decorateParam(12, IThemeService)
], ResourceRenderer);
class ListDelegate {
  constructor(inputRenderer) {
    this.inputRenderer = inputRenderer;
  }
  getHeight(element) {
    if (isSCMInput(element)) {
      return this.inputRenderer.getHeight(element);
    } else if (isSCMActionButton(element)) {
      return ActionButtonRenderer.DEFAULT_HEIGHT + 8;
    } else {
      return 22;
    }
  }
  getTemplateId(element) {
    if (isSCMRepository(element)) {
      return RepositoryRenderer.TEMPLATE_ID;
    } else if (isSCMInput(element)) {
      return InputRenderer.TEMPLATE_ID;
    } else if (isSCMActionButton(element)) {
      return ActionButtonRenderer.TEMPLATE_ID;
    } else if (isSCMResourceGroup(element)) {
      return ResourceGroupRenderer.TEMPLATE_ID;
    } else if (isSCMResource(element) || isSCMResourceNode(element)) {
      return ResourceRenderer.TEMPLATE_ID;
    } else {
      throw new Error("Unknown element");
    }
  }
}
class SCMTreeCompressionDelegate {
  isIncompressible(element) {
    if (ResourceTree.isResourceNode(element)) {
      return element.childrenCount === 0 || !element.parent || !element.parent.parent;
    }
    return true;
  }
}
class SCMTreeFilter {
  filter(element) {
    if (isSCMResourceGroup(element)) {
      return element.resources.length > 0 || !element.hideWhenEmpty;
    } else {
      return true;
    }
  }
}
class SCMTreeSorter {
  constructor(viewMode, viewSortKey) {
    this.viewMode = viewMode;
    this.viewSortKey = viewSortKey;
  }
  compare(one, other) {
    if (isSCMRepository(one)) {
      if (!isSCMRepository(other)) {
        throw new Error("Invalid comparison");
      }
      return 0;
    }
    if (isSCMInput(one)) {
      return -1;
    } else if (isSCMInput(other)) {
      return 1;
    }
    if (isSCMActionButton(one)) {
      return -1;
    } else if (isSCMActionButton(other)) {
      return 1;
    }
    if (isSCMResourceGroup(one)) {
      return isSCMResourceGroup(other) ? 0 : -1;
    }
    if (this.viewMode() === "list" /* List */) {
      if (this.viewSortKey() === "name" /* Name */) {
        const oneName2 = basename(one.sourceUri);
        const otherName2 = basename(other.sourceUri);
        return compareFileNames(oneName2, otherName2);
      }
      if (this.viewSortKey() === "status" /* Status */) {
        const oneTooltip = one.decorations.tooltip ?? "";
        const otherTooltip = other.decorations.tooltip ?? "";
        if (oneTooltip !== otherTooltip) {
          return compare(oneTooltip, otherTooltip);
        }
      }
      const onePath = one.sourceUri.fsPath;
      const otherPath = other.sourceUri.fsPath;
      return comparePaths(onePath, otherPath);
    }
    const oneIsDirectory = ResourceTree.isResourceNode(one);
    const otherIsDirectory = ResourceTree.isResourceNode(other);
    if (oneIsDirectory !== otherIsDirectory) {
      return oneIsDirectory ? -1 : 1;
    }
    const oneName = ResourceTree.isResourceNode(one) ? one.name : basename(one.sourceUri);
    const otherName = ResourceTree.isResourceNode(other) ? other.name : basename(other.sourceUri);
    return compareFileNames(oneName, otherName);
  }
}
let SCMTreeKeyboardNavigationLabelProvider = class {
  constructor(viewMode, labelService) {
    this.viewMode = viewMode;
    this.labelService = labelService;
  }
  getKeyboardNavigationLabel(element) {
    if (ResourceTree.isResourceNode(element)) {
      return element.name;
    } else if (isSCMRepository(element) || isSCMInput(element) || isSCMActionButton(element)) {
      return void 0;
    } else if (isSCMResourceGroup(element)) {
      return element.label;
    } else {
      if (this.viewMode() === "list" /* List */) {
        const fileName = basename(element.sourceUri);
        const filePath = this.labelService.getUriLabel(element.sourceUri, { relative: true });
        return [fileName, filePath];
      } else {
        return basename(element.sourceUri);
      }
    }
  }
  getCompressedNodeKeyboardNavigationLabel(elements) {
    const folders = elements;
    return folders.map((e) => e.name).join("/");
  }
};
SCMTreeKeyboardNavigationLabelProvider = __decorateClass([
  __decorateParam(1, ILabelService)
], SCMTreeKeyboardNavigationLabelProvider);
function getSCMResourceId(element) {
  if (isSCMRepository(element)) {
    const provider = element.provider;
    return `repo:${provider.id}`;
  } else if (isSCMInput(element)) {
    const provider = element.repository.provider;
    return `input:${provider.id}`;
  } else if (isSCMActionButton(element)) {
    const provider = element.repository.provider;
    return `actionButton:${provider.id}`;
  } else if (isSCMResourceGroup(element)) {
    const provider = element.provider;
    return `resourceGroup:${provider.id}/${element.id}`;
  } else if (isSCMResource(element)) {
    const group = element.resourceGroup;
    const provider = group.provider;
    return `resource:${provider.id}/${group.id}/${element.sourceUri.toString()}`;
  } else if (isSCMResourceNode(element)) {
    const group = element.context;
    return `folder:${group.provider.id}/${group.id}/$FOLDER/${element.uri.toString()}`;
  } else {
    throw new Error("Invalid tree element");
  }
}
class SCMResourceIdentityProvider {
  getId(element) {
    return getSCMResourceId(element);
  }
}
let SCMAccessibilityProvider = class {
  constructor(accessibilityService, configurationService, keybindingService, labelService) {
    this.accessibilityService = accessibilityService;
    this.configurationService = configurationService;
    this.keybindingService = keybindingService;
    this.labelService = labelService;
  }
  getWidgetAriaLabel() {
    return localize("scm", "Source Control Management");
  }
  getAriaLabel(element) {
    if (ResourceTree.isResourceNode(element)) {
      return this.labelService.getUriLabel(element.uri, { relative: true, noPrefix: true }) || element.name;
    } else if (isSCMRepository(element)) {
      return `${element.provider.name} ${element.provider.label}`;
    } else if (isSCMInput(element)) {
      const verbosity = this.configurationService.getValue(AccessibilityVerbositySettingId.SourceControl) === true;
      if (!verbosity || !this.accessibilityService.isScreenReaderOptimized()) {
        return localize("scmInput", "Source Control Input");
      }
      const kbLabel = this.keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp)?.getLabel();
      return kbLabel ? localize("scmInputRow.accessibilityHelp", "Source Control Input, Use {0} to open Source Control Accessibility Help.", kbLabel) : localize("scmInputRow.accessibilityHelpNoKb", "Source Control Input, Run the Open Accessibility Help command for more information.");
    } else if (isSCMActionButton(element)) {
      return element.button?.command.title ?? "";
    } else if (isSCMResourceGroup(element)) {
      return element.label;
    } else {
      const result = [];
      result.push(basename(element.sourceUri));
      if (element.decorations.tooltip) {
        result.push(element.decorations.tooltip);
      }
      const path = this.labelService.getUriLabel(dirname(element.sourceUri), { relative: true, noPrefix: true });
      if (path) {
        result.push(path);
      }
      return result.join(", ");
    }
  }
};
SCMAccessibilityProvider = __decorateClass([
  __decorateParam(0, IAccessibilityService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, ILabelService)
], SCMAccessibilityProvider);
var ViewMode = /* @__PURE__ */ ((ViewMode2) => {
  ViewMode2["List"] = "list";
  ViewMode2["Tree"] = "tree";
  return ViewMode2;
})(ViewMode || {});
var ViewSortKey = /* @__PURE__ */ ((ViewSortKey2) => {
  ViewSortKey2["Path"] = "path";
  ViewSortKey2["Name"] = "name";
  ViewSortKey2["Status"] = "status";
  return ViewSortKey2;
})(ViewSortKey || {});
const Menus = {
  ViewSort: new MenuId("SCMViewSort"),
  Repositories: new MenuId("SCMRepositories"),
  ChangesSettings: new MenuId("SCMChangesSettings")
};
const ContextKeys = {
  SCMViewMode: new RawContextKey("scmViewMode", "list" /* List */),
  SCMViewSortKey: new RawContextKey("scmViewSortKey", "path" /* Path */),
  SCMViewAreAllRepositoriesCollapsed: new RawContextKey("scmViewAreAllRepositoriesCollapsed", false),
  SCMViewIsAnyRepositoryCollapsible: new RawContextKey("scmViewIsAnyRepositoryCollapsible", false),
  SCMProvider: new RawContextKey("scmProvider", void 0),
  SCMProviderRootUri: new RawContextKey("scmProviderRootUri", void 0),
  SCMProviderHasRootUri: new RawContextKey("scmProviderHasRootUri", void 0),
  SCMHistoryItemCount: new RawContextKey("scmHistoryItemCount", 0),
  SCMCurrentHistoryItemRefHasRemote: new RawContextKey("scmCurrentHistoryItemRefHasRemote", false),
  SCMCurrentHistoryItemRefInFilter: new RawContextKey("scmCurrentHistoryItemRefInFilter", false),
  RepositoryCount: new RawContextKey("scmRepositoryCount", 0),
  RepositoryVisibilityCount: new RawContextKey("scmRepositoryVisibleCount", 0),
  RepositoryVisibility(repository) {
    return new RawContextKey(`scmRepositoryVisible:${repository.provider.id}`, false);
  }
};
MenuRegistry.appendMenuItem(MenuId.SCMTitle, {
  title: localize("sortAction", "View & Sort"),
  submenu: Menus.ViewSort,
  when: ContextKeyExpr.and(ContextKeyExpr.equals("view", VIEW_PANE_ID), ContextKeys.RepositoryCount.notEqualsTo(0)),
  group: "0_view&sort",
  order: 1
});
MenuRegistry.appendMenuItem(Menus.ViewSort, {
  title: localize("repositories", "Repositories"),
  submenu: Menus.Repositories,
  when: ContextKeyExpr.greater(ContextKeys.RepositoryCount.key, 1),
  group: "0_repositories"
});
class RepositoryVisibilityAction extends Action2 {
  constructor(repository) {
    super({
      id: `workbench.scm.action.toggleRepositoryVisibility.${repository.provider.id}`,
      title: repository.provider.name,
      f1: false,
      precondition: ContextKeyExpr.or(ContextKeys.RepositoryVisibilityCount.notEqualsTo(1), ContextKeys.RepositoryVisibility(repository).isEqualTo(false)),
      toggled: ContextKeys.RepositoryVisibility(repository).isEqualTo(true),
      menu: { id: Menus.Repositories, group: "0_repositories" }
    });
    this.repository = repository;
  }
  run(accessor) {
    const scmViewService = accessor.get(ISCMViewService);
    scmViewService.toggleVisibility(this.repository);
  }
}
let RepositoryVisibilityActionController = class {
  constructor(contextKeyService, scmViewService, scmService) {
    this.contextKeyService = contextKeyService;
    this.scmViewService = scmViewService;
    this.items = /* @__PURE__ */ new Map();
    this.disposables = new DisposableStore();
    this.repositoryCountContextKey = ContextKeys.RepositoryCount.bindTo(contextKeyService);
    this.repositoryVisibilityCountContextKey = ContextKeys.RepositoryVisibilityCount.bindTo(contextKeyService);
    scmViewService.onDidChangeVisibleRepositories(this.onDidChangeVisibleRepositories, this, this.disposables);
    scmService.onDidAddRepository(this.onDidAddRepository, this, this.disposables);
    scmService.onDidRemoveRepository(this.onDidRemoveRepository, this, this.disposables);
    for (const repository of scmService.repositories) {
      this.onDidAddRepository(repository);
    }
  }
  onDidAddRepository(repository) {
    const action = registerAction2(class extends RepositoryVisibilityAction {
      constructor() {
        super(repository);
      }
    });
    const contextKey = ContextKeys.RepositoryVisibility(repository).bindTo(this.contextKeyService);
    contextKey.set(this.scmViewService.isVisible(repository));
    this.items.set(repository, {
      contextKey,
      dispose() {
        contextKey.reset();
        action.dispose();
      }
    });
    this.updateRepositoryContextKeys();
  }
  onDidRemoveRepository(repository) {
    this.items.get(repository)?.dispose();
    this.items.delete(repository);
    this.updateRepositoryContextKeys();
  }
  onDidChangeVisibleRepositories() {
    let count = 0;
    for (const [repository, item] of this.items) {
      const isVisible = this.scmViewService.isVisible(repository);
      item.contextKey.set(isVisible);
      if (isVisible) {
        count++;
      }
    }
    this.repositoryCountContextKey.set(this.items.size);
    this.repositoryVisibilityCountContextKey.set(count);
  }
  updateRepositoryContextKeys() {
    this.repositoryCountContextKey.set(this.items.size);
    this.repositoryVisibilityCountContextKey.set(Iterable.reduce(this.items.keys(), (r, repository) => r + (this.scmViewService.isVisible(repository) ? 1 : 0), 0));
  }
  dispose() {
    this.disposables.dispose();
    dispose(this.items.values());
    this.items.clear();
  }
};
RepositoryVisibilityActionController = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, ISCMViewService),
  __decorateParam(2, ISCMService)
], RepositoryVisibilityActionController);
class SetListViewModeAction extends ViewAction {
  constructor(id = "workbench.scm.action.setListViewMode", menu = {}) {
    super({
      id,
      title: localize("setListViewMode", "View as List"),
      viewId: VIEW_PANE_ID,
      f1: false,
      icon: Codicon.listTree,
      toggled: ContextKeys.SCMViewMode.isEqualTo("list" /* List */),
      menu: { id: Menus.ViewSort, group: "1_viewmode", ...menu }
    });
  }
  async runInView(_, view) {
    view.viewMode = "list" /* List */;
  }
}
class SetListViewModeNavigationAction extends SetListViewModeAction {
  constructor() {
    super(
      "workbench.scm.action.setListViewModeNavigation",
      {
        id: MenuId.SCMTitle,
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", VIEW_PANE_ID), ContextKeys.RepositoryCount.notEqualsTo(0), ContextKeys.SCMViewMode.isEqualTo("tree" /* Tree */)),
        group: "navigation",
        order: -1e3
      }
    );
  }
}
class SetTreeViewModeAction extends ViewAction {
  constructor(id = "workbench.scm.action.setTreeViewMode", menu = {}) {
    super(
      {
        id,
        title: localize("setTreeViewMode", "View as Tree"),
        viewId: VIEW_PANE_ID,
        f1: false,
        icon: Codicon.listFlat,
        toggled: ContextKeys.SCMViewMode.isEqualTo("tree" /* Tree */),
        menu: { id: Menus.ViewSort, group: "1_viewmode", ...menu }
      }
    );
  }
  async runInView(_, view) {
    view.viewMode = "tree" /* Tree */;
  }
}
class SetTreeViewModeNavigationAction extends SetTreeViewModeAction {
  constructor() {
    super(
      "workbench.scm.action.setTreeViewModeNavigation",
      {
        id: MenuId.SCMTitle,
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", VIEW_PANE_ID), ContextKeys.RepositoryCount.notEqualsTo(0), ContextKeys.SCMViewMode.isEqualTo("list" /* List */)),
        group: "navigation",
        order: -1e3
      }
    );
  }
}
registerAction2(SetListViewModeAction);
registerAction2(SetTreeViewModeAction);
registerAction2(SetListViewModeNavigationAction);
registerAction2(SetTreeViewModeNavigationAction);
class RepositorySortAction extends ViewAction {
  constructor(sortKey, title) {
    super({
      id: `workbench.scm.action.repositories.setSortKey.${sortKey}`,
      title,
      viewId: VIEW_PANE_ID,
      f1: false,
      toggled: RepositoryContextKeys.RepositorySortKey.isEqualTo(sortKey),
      menu: [
        {
          id: Menus.Repositories,
          group: "1_sort"
        },
        {
          id: MenuId.SCMSourceControlTitle,
          group: "1_sort"
        }
      ]
    });
    this.sortKey = sortKey;
  }
  runInView(accessor) {
    accessor.get(ISCMViewService).toggleSortKey(this.sortKey);
  }
}
class RepositorySortByDiscoveryTimeAction extends RepositorySortAction {
  constructor() {
    super(ISCMRepositorySortKey.DiscoveryTime, localize("repositorySortByDiscoveryTime", "Sort by Discovery Time"));
  }
}
class RepositorySortByNameAction extends RepositorySortAction {
  constructor() {
    super(ISCMRepositorySortKey.Name, localize("repositorySortByName", "Sort by Name"));
  }
}
class RepositorySortByPathAction extends RepositorySortAction {
  constructor() {
    super(ISCMRepositorySortKey.Path, localize("repositorySortByPath", "Sort by Path"));
  }
}
registerAction2(RepositorySortByDiscoveryTimeAction);
registerAction2(RepositorySortByNameAction);
registerAction2(RepositorySortByPathAction);
class SetSortKeyAction extends ViewAction {
  constructor(sortKey, title) {
    super({
      id: `workbench.scm.action.setSortKey.${sortKey}`,
      title,
      viewId: VIEW_PANE_ID,
      f1: false,
      toggled: ContextKeys.SCMViewSortKey.isEqualTo(sortKey),
      precondition: ContextKeys.SCMViewMode.isEqualTo("list" /* List */),
      menu: { id: Menus.ViewSort, group: "2_sort" }
    });
    this.sortKey = sortKey;
  }
  async runInView(_, view) {
    view.viewSortKey = this.sortKey;
  }
}
class SetSortByNameAction extends SetSortKeyAction {
  constructor() {
    super("name" /* Name */, localize("sortChangesByName", "Sort Changes by Name"));
  }
}
class SetSortByPathAction extends SetSortKeyAction {
  constructor() {
    super("path" /* Path */, localize("sortChangesByPath", "Sort Changes by Path"));
  }
}
class SetSortByStatusAction extends SetSortKeyAction {
  constructor() {
    super("status" /* Status */, localize("sortChangesByStatus", "Sort Changes by Status"));
  }
}
registerAction2(SetSortByNameAction);
registerAction2(SetSortByPathAction);
registerAction2(SetSortByStatusAction);
class CollapseAllRepositoriesAction extends ViewAction {
  constructor() {
    super({
      id: `workbench.scm.action.collapseAllRepositories`,
      title: localize("collapse all", "Collapse All Repositories"),
      viewId: VIEW_PANE_ID,
      f1: false,
      icon: Codicon.collapseAll,
      menu: {
        id: MenuId.SCMTitle,
        group: "navigation",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", VIEW_PANE_ID), ContextKeys.SCMViewIsAnyRepositoryCollapsible.isEqualTo(true), ContextKeys.SCMViewAreAllRepositoriesCollapsed.isEqualTo(false))
      }
    });
  }
  async runInView(_, view) {
    view.collapseAllRepositories();
  }
}
class ExpandAllRepositoriesAction extends ViewAction {
  constructor() {
    super({
      id: `workbench.scm.action.expandAllRepositories`,
      title: localize("expand all", "Expand All Repositories"),
      viewId: VIEW_PANE_ID,
      f1: false,
      icon: Codicon.expandAll,
      menu: {
        id: MenuId.SCMTitle,
        group: "navigation",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", VIEW_PANE_ID), ContextKeys.SCMViewIsAnyRepositoryCollapsible.isEqualTo(true), ContextKeys.SCMViewAreAllRepositoriesCollapsed.isEqualTo(true))
      }
    });
  }
  async runInView(_, view) {
    view.expandAllRepositories();
  }
}
registerAction2(CollapseAllRepositoriesAction);
registerAction2(ExpandAllRepositoriesAction);
var SCMInputWidgetCommandId = /* @__PURE__ */ ((SCMInputWidgetCommandId2) => {
  SCMInputWidgetCommandId2["CancelAction"] = "scm.input.cancelAction";
  return SCMInputWidgetCommandId2;
})(SCMInputWidgetCommandId || {});
var SCMInputWidgetStorageKey = /* @__PURE__ */ ((SCMInputWidgetStorageKey2) => {
  SCMInputWidgetStorageKey2["LastActionId"] = "scm.input.lastActionId";
  return SCMInputWidgetStorageKey2;
})(SCMInputWidgetStorageKey || {});
let SCMInputWidgetActionRunner = class extends ActionRunner {
  constructor(input, storageService) {
    super();
    this.input = input;
    this.storageService = storageService;
    this._runningActions = /* @__PURE__ */ new Set();
  }
  get runningActions() {
    return this._runningActions;
  }
  async runAction(action) {
    try {
      if (this.runningActions.size !== 0) {
        this._cts?.cancel();
        if (action.id === "scm.input.cancelAction" /* CancelAction */) {
          return;
        }
      }
      const context = [];
      for (const group of this.input.repository.provider.groups) {
        context.push({
          resourceGroupId: group.id,
          resources: [...group.resources.map((r) => r.sourceUri)]
        });
      }
      this._runningActions.add(action);
      this._cts = new CancellationTokenSource();
      await action.run(...[this.input.repository.provider.rootUri, context, this._cts.token]);
    } finally {
      this._runningActions.delete(action);
      if (this._runningActions.size === 0) {
        this.storageService.store("scm.input.lastActionId" /* LastActionId */, action.id, StorageScope.PROFILE, StorageTarget.USER);
      }
    }
  }
};
SCMInputWidgetActionRunner = __decorateClass([
  __decorateParam(1, IStorageService)
], SCMInputWidgetActionRunner);
let SCMInputWidgetToolbar = class extends WorkbenchToolBar {
  constructor(container, options, menuService, contextKeyService, contextMenuService, commandService, keybindingService, storageService, telemetryService) {
    super(container, { resetMenu: MenuId.SCMInputBox, ...options }, menuService, contextKeyService, contextMenuService, keybindingService, commandService, telemetryService);
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.storageService = storageService;
    this._dropdownActions = [];
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._disposables = this._register(new MutableDisposable());
    this._dropdownAction = new Action(
      "scmInputMoreActions",
      localize("scmInputMoreActions", "More Actions..."),
      "codicon-chevron-down"
    );
    this._cancelAction = new MenuItemAction({
      id: "scm.input.cancelAction" /* CancelAction */,
      title: localize("scmInputCancelAction", "Cancel"),
      icon: Codicon.stopCircle
    }, void 0, void 0, void 0, void 0, contextKeyService, commandService);
  }
  get dropdownActions() {
    return this._dropdownActions;
  }
  get dropdownAction() {
    return this._dropdownAction;
  }
  setInput(input) {
    this._disposables.value = new DisposableStore();
    const contextKeyService = this.contextKeyService.createOverlay([
      ["scmProvider", input.repository.provider.contextValue],
      ["scmProviderRootUri", input.repository.provider.rootUri?.toString()],
      ["scmProviderHasRootUri", !!input.repository.provider.rootUri]
    ]);
    const menu = this._disposables.value.add(this.menuService.createMenu(MenuId.SCMInputBox, contextKeyService, { emitEventsForSubmenuChanges: true }));
    const isEnabled = () => {
      return input.repository.provider.groups.some((g) => g.resources.length > 0);
    };
    const updateToolbar = () => {
      const actions = getFlatActionBarActions(menu.getActions({ shouldForwardArgs: true }));
      for (const action of actions) {
        action.enabled = isEnabled();
      }
      this._dropdownAction.enabled = isEnabled();
      let primaryAction = void 0;
      if (actions.length === 1) {
        primaryAction = actions[0];
      } else if (actions.length > 1) {
        const lastActionId = this.storageService.get("scm.input.lastActionId" /* LastActionId */, StorageScope.PROFILE, "");
        primaryAction = actions.find((a) => a.id === lastActionId) ?? actions[0];
      }
      this._dropdownActions = actions.length === 1 ? [] : actions;
      super.setActions(primaryAction ? [primaryAction] : [], []);
      this._onDidChange.fire();
    };
    this._disposables.value.add(menu.onDidChange(() => updateToolbar()));
    this._disposables.value.add(input.repository.provider.onDidChangeResources(() => updateToolbar()));
    this._disposables.value.add(this.storageService.onDidChangeValue(StorageScope.PROFILE, "scm.input.lastActionId" /* LastActionId */, this._disposables.value)(() => updateToolbar()));
    this.actionRunner = this._disposables.value.add(new SCMInputWidgetActionRunner(input, this.storageService));
    this._disposables.value.add(this.actionRunner.onWillRun((e) => {
      if (this.actionRunner.runningActions.size === 0) {
        super.setActions([this._cancelAction], []);
        this._onDidChange.fire();
      }
    }));
    this._disposables.value.add(this.actionRunner.onDidRun((e) => {
      if (this.actionRunner.runningActions.size === 0) {
        updateToolbar();
      }
    }));
    updateToolbar();
  }
};
SCMInputWidgetToolbar = __decorateClass([
  __decorateParam(2, IMenuService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, ITelemetryService)
], SCMInputWidgetToolbar);
class SCMInputWidgetEditorOptions {
  constructor(overflowWidgetsDomNode, configurationService) {
    this.overflowWidgetsDomNode = overflowWidgetsDomNode;
    this.configurationService = configurationService;
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this.defaultInputFontFamily = DEFAULT_FONT_FAMILY;
    this._disposables = new DisposableStore();
    const onDidChangeConfiguration = Event.filter(
      this.configurationService.onDidChangeConfiguration,
      (e) => {
        return e.affectsConfiguration("editor.accessibilitySupport") || e.affectsConfiguration("editor.cursorBlinking") || e.affectsConfiguration("editor.cursorStyle") || e.affectsConfiguration("editor.cursorWidth") || e.affectsConfiguration("editor.emptySelectionClipboard") || e.affectsConfiguration("editor.fontFamily") || e.affectsConfiguration("editor.rulers") || e.affectsConfiguration("editor.wordWrap") || e.affectsConfiguration("scm.inputFontFamily") || e.affectsConfiguration("scm.inputFontSize");
      },
      this._disposables
    );
    this._disposables.add(onDidChangeConfiguration(() => this._onDidChange.fire()));
  }
  getEditorConstructionOptions() {
    return {
      ...getSimpleEditorOptions(this.configurationService),
      ...this.getEditorOptions(),
      dragAndDrop: true,
      dropIntoEditor: { enabled: true },
      formatOnType: true,
      lineDecorationsWidth: 6,
      overflowWidgetsDomNode: this.overflowWidgetsDomNode,
      padding: { top: 2, bottom: 2 },
      quickSuggestions: false,
      renderWhitespace: "none",
      scrollbar: {
        alwaysConsumeMouseWheel: false,
        vertical: "hidden"
      },
      wrappingIndent: "none",
      wrappingStrategy: "advanced"
    };
  }
  getEditorOptions() {
    const fontFamily = this._getEditorFontFamily();
    const fontSize = this._getEditorFontSize();
    const lineHeight = this._getEditorLineHeight(fontSize);
    const accessibilitySupport = this.configurationService.getValue("editor.accessibilitySupport");
    const cursorBlinking = this.configurationService.getValue("editor.cursorBlinking");
    const cursorStyle = this.configurationService.getValue("editor.cursorStyle");
    const cursorWidth = this.configurationService.getValue("editor.cursorWidth") ?? 1;
    const emptySelectionClipboard = this.configurationService.getValue("editor.emptySelectionClipboard") === true;
    return { ...this._getEditorLanguageConfiguration(), accessibilitySupport, cursorBlinking, cursorStyle, cursorWidth, fontFamily, fontSize, lineHeight, emptySelectionClipboard };
  }
  _getEditorFontFamily() {
    const inputFontFamily = this.configurationService.getValue("scm.inputFontFamily").trim();
    if (inputFontFamily.toLowerCase() === "editor") {
      return this.configurationService.getValue("editor.fontFamily").trim();
    }
    if (inputFontFamily.length !== 0 && inputFontFamily.toLowerCase() !== "default") {
      return inputFontFamily;
    }
    return this.defaultInputFontFamily;
  }
  _getEditorFontSize() {
    return this.configurationService.getValue("scm.inputFontSize");
  }
  _getEditorLanguageConfiguration() {
    const rulersConfig = this.configurationService.inspect("editor.rulers", { overrideIdentifier: "scminput" });
    const rulers = rulersConfig.overrideIdentifiers?.includes("scminput") ? EditorOptions.rulers.validate(rulersConfig.value) : [];
    const wordWrapConfig = this.configurationService.inspect("editor.wordWrap", { overrideIdentifier: "scminput" });
    const wordWrap = wordWrapConfig.overrideIdentifiers?.includes("scminput") ? EditorOptions.wordWrap.validate(wordWrapConfig.value) : "on";
    return { rulers, wordWrap };
  }
  _getEditorLineHeight(fontSize) {
    return Math.round(fontSize * 1.5);
  }
  dispose() {
    this._disposables.dispose();
  }
}
let SCMInputWidget = class {
  constructor(container, overflowWidgetsDomNode, contextKeyService, modelService, keybindingService, configurationService, instantiationService, scmViewService, contextViewService, openerService, accessibilityService) {
    this.modelService = modelService;
    this.keybindingService = keybindingService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.scmViewService = scmViewService;
    this.contextViewService = contextViewService;
    this.openerService = openerService;
    this.accessibilityService = accessibilityService;
    this.disposables = new DisposableStore();
    this.repositoryDisposables = new DisposableStore();
    this.validationHasFocus = false;
    // This is due to "Setup height change listener on next tick" above
    // https://github.com/microsoft/vscode/issues/108067
    this.lastLayoutWasTrash = false;
    this.shouldFocusAfterLayout = false;
    this.element = append(container, $(".scm-editor"));
    this.editorContainer = append(this.element, $(".scm-editor-container"));
    this.toolbarContainer = append(this.element, $(".scm-editor-toolbar"));
    this.contextKeyService = contextKeyService.createScoped(this.element);
    this.repositoryIdContextKey = this.contextKeyService.createKey("scmRepository", void 0);
    this.inputEditorOptions = new SCMInputWidgetEditorOptions(overflowWidgetsDomNode, this.configurationService);
    this.disposables.add(this.inputEditorOptions.onDidChange(this.onDidChangeEditorOptions, this));
    this.disposables.add(this.inputEditorOptions);
    const codeEditorWidgetOptions = {
      contributions: EditorExtensionsRegistry.getSomeEditorContributions([
        CodeActionController.ID,
        ColorDetector.ID,
        ContextMenuController.ID,
        CopyPasteController.ID,
        DragAndDropController.ID,
        DropIntoEditorController.ID,
        EditorDictation.ID,
        FormatOnType.ID,
        ContentHoverController.ID,
        GlyphHoverController.ID,
        InlineCompletionsController.ID,
        LinkDetector.ID,
        MenuPreventer.ID,
        MessageController.ID,
        PlaceholderTextContribution.ID,
        SelectionClipboardContributionID,
        SnippetController2.ID,
        SuggestController.ID
      ]),
      isSimpleWidget: true
    };
    const services = new ServiceCollection([IContextKeyService, this.contextKeyService]);
    const instantiationService2 = instantiationService.createChild(services, this.disposables);
    const editorConstructionOptions = this.inputEditorOptions.getEditorConstructionOptions();
    this.inputEditor = instantiationService2.createInstance(CodeEditorWidget, this.editorContainer, editorConstructionOptions, codeEditorWidgetOptions);
    this.disposables.add(this.inputEditor);
    this.disposables.add(this.inputEditor.onDidFocusEditorText(() => {
      if (this.input?.repository) {
        this.scmViewService.focus(this.input.repository);
      }
      this.element.classList.add("synthetic-focus");
      this.renderValidation();
    }));
    this.disposables.add(this.inputEditor.onDidBlurEditorText(() => {
      this.element.classList.remove("synthetic-focus");
      setTimeout(() => {
        if (!this.validation || !this.validationHasFocus) {
          this.clearValidation();
        }
      }, 0);
    }));
    this.disposables.add(this.inputEditor.onDidBlurEditorWidget(() => {
      CopyPasteController.get(this.inputEditor)?.clearWidgets();
      DropIntoEditorController.get(this.inputEditor)?.clearWidgets();
    }));
    const firstLineKey = this.contextKeyService.createKey("scmInputIsInFirstPosition", false);
    const lastLineKey = this.contextKeyService.createKey("scmInputIsInLastPosition", false);
    this.disposables.add(this.inputEditor.onDidChangeCursorPosition(({ position }) => {
      const viewModel = this.inputEditor._getViewModel();
      const lastLineNumber = viewModel.getLineCount();
      const lastLineCol = viewModel.getLineLength(lastLineNumber) + 1;
      const viewPosition = viewModel.coordinatesConverter.convertModelPositionToViewPosition(position);
      firstLineKey.set(viewPosition.lineNumber === 1 && viewPosition.column === 1);
      lastLineKey.set(viewPosition.lineNumber === lastLineNumber && viewPosition.column === lastLineCol);
    }));
    this.disposables.add(this.inputEditor.onDidScrollChange((e) => {
      this.toolbarContainer.classList.toggle("scroll-decoration", e.scrollTop > 0);
    }));
    Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("scm.showInputActionButton"))(() => this.layout(), this, this.disposables);
    this.onDidChangeContentHeight = Event.signal(Event.filter(this.inputEditor.onDidContentSizeChange, (e) => e.contentHeightChanged, this.disposables));
    this.toolbar = instantiationService2.createInstance(SCMInputWidgetToolbar, this.toolbarContainer, {
      actionViewItemProvider: (action, options) => {
        if (action instanceof MenuItemAction && this.toolbar.dropdownActions.length > 1) {
          return instantiationService.createInstance(DropdownWithPrimaryActionViewItem, action, this.toolbar.dropdownAction, this.toolbar.dropdownActions, "", { actionRunner: this.toolbar.actionRunner, hoverDelegate: options.hoverDelegate });
        }
        return createActionViewItem(instantiationService, action, options);
      },
      menuOptions: {
        shouldForwardArgs: true
      }
    });
    this.disposables.add(this.toolbar.onDidChange(() => this.layout()));
    this.disposables.add(this.toolbar);
  }
  get input() {
    return this.model?.input;
  }
  set input(input) {
    if (input === this.input) {
      return;
    }
    this.clearValidation();
    this.element.classList.remove("synthetic-focus");
    this.repositoryDisposables.clear();
    this.repositoryIdContextKey.set(input?.repository.id);
    if (!input) {
      this.inputEditor.setModel(void 0);
      this.model = void 0;
      return;
    }
    const textModel = input.repository.provider.inputBoxTextModel;
    this.inputEditor.setModel(textModel);
    if (this.configurationService.getValue("editor.wordBasedSuggestions", { resource: textModel.uri }) !== "off") {
      this.configurationService.updateValue("editor.wordBasedSuggestions", "off", { resource: textModel.uri }, ConfigurationTarget.MEMORY);
    }
    const validationDelayer = new ThrottledDelayer(200);
    const validate = async () => {
      const position = this.inputEditor.getSelection()?.getStartPosition();
      const offset = position && textModel.getOffsetAt(position);
      const value = textModel.getValue();
      this.setValidation(await input.validateInput(value, offset || 0));
    };
    const triggerValidation = () => validationDelayer.trigger(validate);
    this.repositoryDisposables.add(validationDelayer);
    this.repositoryDisposables.add(this.inputEditor.onDidChangeCursorPosition(triggerValidation));
    const opts = this.modelService.getCreationOptions(textModel.getLanguageId(), textModel.uri, textModel.isForSimpleWidget);
    const onEnter = Event.filter(this.inputEditor.onKeyDown, (e) => e.keyCode === KeyCode.Enter, this.repositoryDisposables);
    this.repositoryDisposables.add(onEnter(() => textModel.detectIndentation(opts.insertSpaces, opts.tabSize)));
    textModel.setValue(input.value);
    this.repositoryDisposables.add(input.onDidChange(({ value, reason }) => {
      const currentValue = textModel.getValue();
      if (value === currentValue) {
        return;
      }
      textModel.pushStackElement();
      textModel.pushEditOperations(null, [EditOperation.replaceMove(textModel.getFullModelRange(), value)], () => []);
      const position = reason === SCMInputChangeReason.HistoryPrevious ? textModel.getFullModelRange().getStartPosition() : textModel.getFullModelRange().getEndPosition();
      this.inputEditor.setPosition(position);
      this.inputEditor.revealPositionInCenterIfOutsideViewport(position);
    }));
    this.repositoryDisposables.add(input.onDidChangeFocus(() => this.focus()));
    this.repositoryDisposables.add(input.onDidChangeValidationMessage((e) => this.setValidation(e, { focus: true, timeout: true })));
    this.repositoryDisposables.add(input.onDidChangeValidateInput((e) => triggerValidation()));
    this.repositoryDisposables.add(textModel.onDidChangeContent(() => {
      input.setValue(textModel.getValue(), true);
      triggerValidation();
    }));
    const accessibilityVerbosityConfig = observableConfigValue(
      AccessibilityVerbositySettingId.SourceControl,
      true,
      this.configurationService
    );
    const getAriaLabel = (placeholder, verbosity) => {
      verbosity = verbosity ?? accessibilityVerbosityConfig.get();
      if (!verbosity || !this.accessibilityService.isScreenReaderOptimized()) {
        return placeholder;
      }
      const kbLabel = this.keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp)?.getLabel();
      return kbLabel ? localize("scmInput.accessibilityHelp", "{0}, Use {1} to open Source Control Accessibility Help.", placeholder, kbLabel) : localize("scmInput.accessibilityHelpNoKb", "{0}, Run the Open Accessibility Help command for more information.", placeholder);
    };
    const getPlaceholderText = () => {
      const binding = this.keybindingService.lookupKeybinding("scm.acceptInput");
      const label = binding ? binding.getLabel() : platform.isMacintosh ? "Cmd+Enter" : "Ctrl+Enter";
      return format(input.placeholder, label);
    };
    const updatePlaceholderText = () => {
      const placeholder = getPlaceholderText();
      const ariaLabel = getAriaLabel(placeholder);
      this.inputEditor.updateOptions({ ariaLabel, placeholder });
    };
    this.repositoryDisposables.add(input.onDidChangePlaceholder(updatePlaceholderText));
    this.repositoryDisposables.add(this.keybindingService.onDidUpdateKeybindings(updatePlaceholderText));
    this.repositoryDisposables.add(runOnChange(accessibilityVerbosityConfig, (verbosity) => {
      const placeholder = getPlaceholderText();
      const ariaLabel = getAriaLabel(placeholder, verbosity);
      this.inputEditor.updateOptions({ ariaLabel });
    }));
    updatePlaceholderText();
    let commitTemplate = "";
    this.repositoryDisposables.add(autorun((reader) => {
      if (!input.visible) {
        return;
      }
      const oldCommitTemplate = commitTemplate;
      commitTemplate = input.repository.provider.commitTemplate.read(reader);
      const value = textModel.getValue();
      if (value && value !== oldCommitTemplate) {
        return;
      }
      textModel.setValue(commitTemplate);
    }));
    const updateEnablement = (enabled) => {
      this.inputEditor.updateOptions({ readOnly: !enabled });
    };
    this.repositoryDisposables.add(input.onDidChangeEnablement((enabled) => updateEnablement(enabled)));
    updateEnablement(input.enabled);
    this.toolbar.setInput(input);
    this.model = { input, textModel };
  }
  get selections() {
    return this.inputEditor.getSelections();
  }
  set selections(selections) {
    if (selections) {
      this.inputEditor.setSelections(selections);
    }
  }
  setValidation(validation, options) {
    if (this._validationTimer) {
      clearTimeout(this._validationTimer);
      this._validationTimer = 0;
    }
    this.validation = validation;
    this.renderValidation();
    if (options?.focus && !this.hasFocus()) {
      this.focus();
    }
    if (validation && options?.timeout) {
      this._validationTimer = setTimeout(() => this.setValidation(void 0), SCMInputWidget.ValidationTimeouts[validation.type]);
    }
  }
  getContentHeight() {
    const lineHeight = this.inputEditor.getOption(EditorOption.lineHeight);
    const { top, bottom } = this.inputEditor.getOption(EditorOption.padding);
    const inputMinLinesConfig = this.configurationService.getValue("scm.inputMinLineCount");
    const inputMinLines = typeof inputMinLinesConfig === "number" ? clamp(inputMinLinesConfig, 1, 50) : 1;
    const editorMinHeight = inputMinLines * lineHeight + top + bottom;
    const inputMaxLinesConfig = this.configurationService.getValue("scm.inputMaxLineCount");
    const inputMaxLines = typeof inputMaxLinesConfig === "number" ? clamp(inputMaxLinesConfig, 1, 50) : 10;
    const editorMaxHeight = inputMaxLines * lineHeight + top + bottom;
    return clamp(this.inputEditor.getContentHeight(), editorMinHeight, editorMaxHeight);
  }
  layout() {
    const editorHeight = this.getContentHeight();
    const toolbarWidth = this.getToolbarWidth();
    const dimension = new Dimension(this.element.clientWidth - toolbarWidth, editorHeight);
    if (dimension.width < 0) {
      this.lastLayoutWasTrash = true;
      return;
    }
    this.lastLayoutWasTrash = false;
    this.inputEditor.layout(dimension);
    this.renderValidation();
    const showInputActionButton = this.configurationService.getValue("scm.showInputActionButton") === true;
    this.toolbarContainer.classList.toggle("hidden", !showInputActionButton || this.toolbar?.isEmpty() === true);
    if (this.shouldFocusAfterLayout) {
      this.shouldFocusAfterLayout = false;
      this.focus();
    }
  }
  focus() {
    if (this.lastLayoutWasTrash) {
      this.lastLayoutWasTrash = false;
      this.shouldFocusAfterLayout = true;
      return;
    }
    this.inputEditor.focus();
    this.element.classList.add("synthetic-focus");
  }
  hasFocus() {
    return this.inputEditor.hasTextFocus();
  }
  onDidChangeEditorOptions() {
    this.inputEditor.updateOptions(this.inputEditorOptions.getEditorOptions());
  }
  renderValidation() {
    this.clearValidation();
    this.element.classList.toggle("validation-info", this.validation?.type === InputValidationType.Information);
    this.element.classList.toggle("validation-warning", this.validation?.type === InputValidationType.Warning);
    this.element.classList.toggle("validation-error", this.validation?.type === InputValidationType.Error);
    if (!this.validation || !this.inputEditor.hasTextFocus()) {
      return;
    }
    const disposables = new DisposableStore();
    this.validationContextView = this.contextViewService.showContextView({
      getAnchor: () => this.element,
      render: (container) => {
        this.element.style.borderBottomLeftRadius = "0";
        this.element.style.borderBottomRightRadius = "0";
        const validationContainer = append(container, $(".scm-editor-validation-container"));
        validationContainer.classList.toggle("validation-info", this.validation.type === InputValidationType.Information);
        validationContainer.classList.toggle("validation-warning", this.validation.type === InputValidationType.Warning);
        validationContainer.classList.toggle("validation-error", this.validation.type === InputValidationType.Error);
        validationContainer.style.width = `${this.element.clientWidth + 2}px`;
        const element = append(validationContainer, $(".scm-editor-validation"));
        const message = this.validation.message;
        if (typeof message === "string") {
          element.textContent = message;
        } else {
          const tracker = trackFocus(element);
          disposables.add(tracker);
          disposables.add(tracker.onDidFocus(() => this.validationHasFocus = true));
          disposables.add(tracker.onDidBlur(() => {
            this.validationHasFocus = false;
            this.element.style.borderBottomLeftRadius = "2px";
            this.element.style.borderBottomRightRadius = "2px";
            this.contextViewService.hideContextView();
          }));
          const renderer = this.instantiationService.createInstance(MarkdownRenderer, {});
          const renderedMarkdown = renderer.render(message, {
            actionHandler: {
              callback: (link) => {
                openLinkFromMarkdown(this.openerService, link, message.isTrusted);
                this.element.style.borderBottomLeftRadius = "2px";
                this.element.style.borderBottomRightRadius = "2px";
                this.contextViewService.hideContextView();
              },
              disposables
            }
          });
          disposables.add(renderedMarkdown);
          element.appendChild(renderedMarkdown.element);
        }
        const actionsContainer = append(validationContainer, $(".scm-editor-validation-actions"));
        const actionbar = new ActionBar(actionsContainer);
        const action = new Action("scmInputWidget.validationMessage.close", localize("label.close", "Close"), ThemeIcon.asClassName(Codicon.close), true, () => {
          this.contextViewService.hideContextView();
          this.element.style.borderBottomLeftRadius = "2px";
          this.element.style.borderBottomRightRadius = "2px";
        });
        disposables.add(actionbar);
        actionbar.push(action, { icon: true, label: false });
        return Disposable.None;
      },
      onHide: () => {
        this.validationHasFocus = false;
        this.element.style.borderBottomLeftRadius = "2px";
        this.element.style.borderBottomRightRadius = "2px";
        disposables.dispose();
      },
      anchorAlignment: AnchorAlignment.LEFT
    });
  }
  getToolbarWidth() {
    const showInputActionButton = this.configurationService.getValue("scm.showInputActionButton");
    if (!this.toolbar || !showInputActionButton || this.toolbar?.isEmpty() === true) {
      return 0;
    }
    return this.toolbar.dropdownActions.length === 0 ? 26 : 39;
  }
  clearValidation() {
    this.validationContextView?.close();
    this.validationContextView = void 0;
    this.validationHasFocus = false;
  }
  dispose() {
    this.input = void 0;
    this.repositoryDisposables.dispose();
    this.clearValidation();
    this.disposables.dispose();
  }
};
SCMInputWidget.ValidationTimeouts = {
  [InputValidationType.Information]: 5e3,
  [InputValidationType.Warning]: 8e3,
  [InputValidationType.Error]: 1e4
};
SCMInputWidget = __decorateClass([
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IModelService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, ISCMViewService),
  __decorateParam(8, IContextViewService),
  __decorateParam(9, IOpenerService),
  __decorateParam(10, IAccessibilityService)
], SCMInputWidget);
let SCMViewPane = class extends ViewPane {
  constructor(options, commandService, editorService, menuService, scmService, scmViewService, storageService, uriIdentityService, keybindingService, themeService, contextMenuService, instantiationService, viewDescriptorService, configurationService, contextKeyService, openerService, hoverService) {
    super({ ...options, titleMenuId: MenuId.SCMTitle }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.commandService = commandService;
    this.editorService = editorService;
    this.menuService = menuService;
    this.scmService = scmService;
    this.scmViewService = scmViewService;
    this.storageService = storageService;
    this.uriIdentityService = uriIdentityService;
    this._onDidChangeViewMode = new Emitter();
    this.onDidChangeViewMode = this._onDidChangeViewMode.event;
    this._onDidChangeViewSortKey = new Emitter();
    this.onDidChangeViewSortKey = this._onDidChangeViewSortKey.event;
    this.items = new DisposableMap();
    this.visibilityDisposables = new DisposableStore();
    this.treeOperationSequencer = new Sequencer();
    this.revealResourceThrottler = new Throttler();
    this.updateChildrenThrottler = new Throttler();
    this.disposables = new DisposableStore();
    this._viewMode = this.getViewMode();
    this._viewSortKey = this.getViewSortKey();
    this.viewModeContextKey = ContextKeys.SCMViewMode.bindTo(contextKeyService);
    this.viewModeContextKey.set(this._viewMode);
    this.viewSortKeyContextKey = ContextKeys.SCMViewSortKey.bindTo(contextKeyService);
    this.viewSortKeyContextKey.set(this.viewSortKey);
    this.areAllRepositoriesCollapsedContextKey = ContextKeys.SCMViewAreAllRepositoriesCollapsed.bindTo(contextKeyService);
    this.isAnyRepositoryCollapsibleContextKey = ContextKeys.SCMViewIsAnyRepositoryCollapsible.bindTo(contextKeyService);
    this.scmProviderContextKey = ContextKeys.SCMProvider.bindTo(contextKeyService);
    this.scmProviderRootUriContextKey = ContextKeys.SCMProviderRootUri.bindTo(contextKeyService);
    this.scmProviderHasRootUriContextKey = ContextKeys.SCMProviderHasRootUri.bindTo(contextKeyService);
    this._onDidLayout = new Emitter();
    this.layoutCache = { height: void 0, width: void 0, onDidChange: this._onDidLayout.event };
    this.storageService.onDidChangeValue(StorageScope.WORKSPACE, void 0, this.disposables)((e) => {
      switch (e.key) {
        case "scm.viewMode":
          this.viewMode = this.getViewMode();
          break;
        case "scm.viewSortKey":
          this.viewSortKey = this.getViewSortKey();
          break;
      }
    }, this, this.disposables);
    this.storageService.onWillSaveState((e) => {
      this.viewMode = this.getViewMode();
      this.viewSortKey = this.getViewSortKey();
      this.storeTreeViewState();
    }, this, this.disposables);
    Event.any(this.scmService.onDidAddRepository, this.scmService.onDidRemoveRepository)(() => this._onDidChangeViewWelcomeState.fire(), this, this.disposables);
    this.disposables.add(this.revealResourceThrottler);
    this.disposables.add(this.updateChildrenThrottler);
  }
  get viewMode() {
    return this._viewMode;
  }
  set viewMode(mode) {
    if (this._viewMode === mode) {
      return;
    }
    this._viewMode = mode;
    this.viewSortKey = this.getViewSortKey();
    this.updateChildren();
    this.onDidActiveEditorChange();
    this._onDidChangeViewMode.fire(mode);
    this.viewModeContextKey.set(mode);
    this.updateIndentStyles(this.themeService.getFileIconTheme());
    this.storageService.store(`scm.viewMode`, mode, StorageScope.WORKSPACE, StorageTarget.USER);
  }
  get viewSortKey() {
    return this._viewSortKey;
  }
  set viewSortKey(sortKey) {
    if (this._viewSortKey === sortKey) {
      return;
    }
    this._viewSortKey = sortKey;
    this.updateChildren();
    this.viewSortKeyContextKey.set(sortKey);
    this._onDidChangeViewSortKey.fire(sortKey);
    if (this._viewMode === "list" /* List */) {
      this.storageService.store(`scm.viewSortKey`, sortKey, StorageScope.WORKSPACE, StorageTarget.USER);
    }
  }
  layoutBody(height = this.layoutCache.height, width = this.layoutCache.width) {
    if (height === void 0) {
      return;
    }
    if (width !== void 0) {
      super.layoutBody(height, width);
    }
    this.layoutCache.height = height;
    this.layoutCache.width = width;
    this._onDidLayout.fire();
    this.treeContainer.style.height = `${height}px`;
    this.tree.layout(height, width);
  }
  renderBody(container) {
    super.renderBody(container);
    this.treeContainer = append(container, $(".scm-view.show-file-icons"));
    this.treeContainer.classList.add("file-icon-themable-tree");
    this.treeContainer.classList.add("show-file-icons");
    const updateActionsVisibility = () => this.treeContainer.classList.toggle("show-actions", this.configurationService.getValue("scm.alwaysShowActions"));
    Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("scm.alwaysShowActions"), this.disposables)(updateActionsVisibility, this, this.disposables);
    updateActionsVisibility();
    const updateProviderCountVisibility = () => {
      const value = this.configurationService.getValue("scm.providerCountBadge");
      this.treeContainer.classList.toggle("hide-provider-counts", value === "hidden");
      this.treeContainer.classList.toggle("auto-provider-counts", value === "auto");
    };
    Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("scm.providerCountBadge"), this.disposables)(updateProviderCountVisibility, this, this.disposables);
    updateProviderCountVisibility();
    const viewState = this.loadTreeViewState();
    this.createTree(this.treeContainer, viewState);
    this.onDidChangeBodyVisibility(async (visible) => {
      if (visible) {
        this.treeOperationSequencer.queue(async () => {
          await this.tree.setInput(this.scmViewService, viewState);
          Event.filter(
            this.configurationService.onDidChangeConfiguration,
            (e) => e.affectsConfiguration("scm.alwaysShowRepositories"),
            this.visibilityDisposables
          )(() => {
            this.updateActions();
            this.updateChildren();
          }, this, this.visibilityDisposables);
          Event.filter(
            this.configurationService.onDidChangeConfiguration,
            (e) => e.affectsConfiguration("scm.inputMinLineCount") || e.affectsConfiguration("scm.inputMaxLineCount") || e.affectsConfiguration("scm.showActionButton"),
            this.visibilityDisposables
          )(() => this.updateChildren(), this, this.visibilityDisposables);
          this.editorService.onDidActiveEditorChange(this.onDidActiveEditorChange, this, this.visibilityDisposables);
          this.scmViewService.onDidChangeVisibleRepositories(this.onDidChangeVisibleRepositories, this, this.visibilityDisposables);
          this.onDidChangeVisibleRepositories({ added: this.scmViewService.visibleRepositories, removed: Iterable.empty() });
          if (typeof this.treeScrollTop === "number") {
            this.tree.scrollTop = this.treeScrollTop;
            this.treeScrollTop = void 0;
          }
          this.updateRepositoryCollapseAllContextKeys();
        });
      } else {
        this.visibilityDisposables.clear();
        this.onDidChangeVisibleRepositories({ added: Iterable.empty(), removed: [...this.items.keys()] });
        this.treeScrollTop = this.tree.scrollTop;
        this.updateRepositoryCollapseAllContextKeys();
      }
    }, this, this.disposables);
    this.disposables.add(this.instantiationService.createInstance(RepositoryVisibilityActionController));
    this.themeService.onDidFileIconThemeChange(this.updateIndentStyles, this, this.disposables);
    this.updateIndentStyles(this.themeService.getFileIconTheme());
  }
  createTree(container, viewState) {
    const overflowWidgetsDomNode = $(".scm-overflow-widgets-container.monaco-editor");
    this.inputRenderer = this.instantiationService.createInstance(InputRenderer, this.layoutCache, overflowWidgetsDomNode, (input, height) => {
      try {
        this.tree.updateElementHeight(input, height);
      } catch {
      }
    });
    this.actionButtonRenderer = this.instantiationService.createInstance(ActionButtonRenderer);
    this.listLabels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
    this.disposables.add(this.listLabels);
    const resourceActionRunner = new RepositoryPaneActionRunner(() => this.getSelectedResources());
    resourceActionRunner.onWillRun(() => this.tree.domFocus(), this, this.disposables);
    this.disposables.add(resourceActionRunner);
    const treeDataSource = this.instantiationService.createInstance(SCMTreeDataSource, () => this.viewMode);
    this.disposables.add(treeDataSource);
    const compressionEnabled = observableConfigValue("scm.compactFolders", true, this.configurationService);
    this.tree = this.instantiationService.createInstance(
      WorkbenchCompressibleAsyncDataTree,
      "SCM Tree Repo",
      container,
      new ListDelegate(this.inputRenderer),
      new SCMTreeCompressionDelegate(),
      [
        this.inputRenderer,
        this.actionButtonRenderer,
        this.instantiationService.createInstance(RepositoryRenderer, MenuId.SCMTitle, getActionViewItemProvider(this.instantiationService)),
        this.instantiationService.createInstance(ResourceGroupRenderer, getActionViewItemProvider(this.instantiationService), resourceActionRunner),
        this.instantiationService.createInstance(ResourceRenderer, () => this.viewMode, this.listLabels, getActionViewItemProvider(this.instantiationService), resourceActionRunner)
      ],
      treeDataSource,
      {
        horizontalScrolling: false,
        setRowLineHeight: false,
        transformOptimization: false,
        filter: new SCMTreeFilter(),
        dnd: new SCMTreeDragAndDrop(this.instantiationService),
        identityProvider: new SCMResourceIdentityProvider(),
        sorter: new SCMTreeSorter(() => this.viewMode, () => this.viewSortKey),
        keyboardNavigationLabelProvider: this.instantiationService.createInstance(SCMTreeKeyboardNavigationLabelProvider, () => this.viewMode),
        overrideStyles: this.getLocationBasedColors().listOverrideStyles,
        compressionEnabled: compressionEnabled.get(),
        collapseByDefault: (e) => {
          if (isSCMRepository(e) || isSCMResourceGroup(e) || isSCMResourceNode(e)) {
            return false;
          }
          return (viewState?.expanded ?? []).indexOf(getSCMResourceId(e)) === -1;
        },
        accessibilityProvider: this.instantiationService.createInstance(SCMAccessibilityProvider)
      }
    );
    this.disposables.add(this.tree);
    this.tree.onDidOpen(this.open, this, this.disposables);
    this.tree.onContextMenu(this.onListContextMenu, this, this.disposables);
    this.tree.onDidScroll(this.inputRenderer.clearValidation, this.inputRenderer, this.disposables);
    Event.filter(this.tree.onDidChangeCollapseState, (e) => isSCMRepository(e.node.element?.element), this.disposables)(this.updateRepositoryCollapseAllContextKeys, this, this.disposables);
    this.disposables.add(autorun((reader) => {
      this.tree.updateOptions({
        compressionEnabled: compressionEnabled.read(reader)
      });
    }));
    append(container, overflowWidgetsDomNode);
  }
  async open(e) {
    if (!e.element) {
      return;
    } else if (isSCMRepository(e.element)) {
      this.scmViewService.focus(e.element);
      return;
    } else if (isSCMInput(e.element)) {
      this.scmViewService.focus(e.element.repository);
      const widget = this.inputRenderer.getRenderedInputWidget(e.element);
      if (widget) {
        widget.focus();
        this.tree.setFocus([], e.browserEvent);
        const selection = this.tree.getSelection();
        if (selection.length === 1 && selection[0] === e.element) {
          setTimeout(() => this.tree.setSelection([]));
        }
      }
      return;
    } else if (isSCMActionButton(e.element)) {
      this.scmViewService.focus(e.element.repository);
      this.actionButtonRenderer.focusActionButton(e.element);
      this.tree.setFocus([], e.browserEvent);
      return;
    } else if (isSCMResourceGroup(e.element)) {
      const provider = e.element.provider;
      const repository = Iterable.find(this.scmService.repositories, (r) => r.provider === provider);
      if (repository) {
        this.scmViewService.focus(repository);
      }
      return;
    } else if (isSCMResource(e.element)) {
      if (e.element.command?.id === API_OPEN_EDITOR_COMMAND_ID || e.element.command?.id === API_OPEN_DIFF_EDITOR_COMMAND_ID) {
        if (isPointerEvent(e.browserEvent) && e.browserEvent.button === 1) {
          const resourceGroup = e.element.resourceGroup;
          const title = `${resourceGroup.provider.label}: ${resourceGroup.label}`;
          await OpenScmGroupAction.openMultiFileDiffEditor(this.editorService, title, resourceGroup.provider.rootUri, resourceGroup.id, {
            ...e.editorOptions,
            viewState: {
              revealData: {
                resource: {
                  original: e.element.multiDiffEditorOriginalUri,
                  modified: e.element.multiDiffEditorModifiedUri
                }
              }
            },
            preserveFocus: true
          });
        } else {
          await this.commandService.executeCommand(e.element.command.id, ...e.element.command.arguments || [], e);
        }
      } else {
        await e.element.open(!!e.editorOptions.preserveFocus);
        if (e.editorOptions.pinned) {
          const activeEditorPane = this.editorService.activeEditorPane;
          activeEditorPane?.group.pinEditor(activeEditorPane.input);
        }
      }
      const provider = e.element.resourceGroup.provider;
      const repository = Iterable.find(this.scmService.repositories, (r) => r.provider === provider);
      if (repository) {
        this.scmViewService.focus(repository);
      }
    } else if (isSCMResourceNode(e.element)) {
      const provider = e.element.context.provider;
      const repository = Iterable.find(this.scmService.repositories, (r) => r.provider === provider);
      if (repository) {
        this.scmViewService.focus(repository);
      }
      return;
    }
  }
  onDidActiveEditorChange() {
    if (!this.configurationService.getValue("scm.autoReveal")) {
      return;
    }
    const uri = EditorResourceAccessor.getOriginalUri(this.editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (!uri) {
      return;
    }
    if (this.tree.getFocus().some((e) => isSCMResource(e) && this.uriIdentityService.extUri.isEqual(e.sourceUri, uri)) && this.tree.getSelection().some((e) => isSCMResource(e) && this.uriIdentityService.extUri.isEqual(e.sourceUri, uri))) {
      return;
    }
    this.revealResourceThrottler.queue(
      () => this.treeOperationSequencer.queue(
        async () => {
          for (const repository of this.scmViewService.visibleRepositories) {
            const item = this.items.get(repository);
            if (!item) {
              continue;
            }
            for (let j = repository.provider.groups.length - 1; j >= 0; j--) {
              const groupItem = repository.provider.groups[j];
              const resource = this.viewMode === "tree" /* Tree */ ? groupItem.resourceTree.getNode(uri)?.element : groupItem.resources.find((r) => this.uriIdentityService.extUri.isEqual(r.sourceUri, uri));
              if (resource) {
                await this.tree.expandTo(resource);
                this.tree.reveal(resource);
                this.tree.setSelection([resource]);
                this.tree.setFocus([resource]);
                return;
              }
            }
          }
        }
      )
    );
  }
  onDidChangeVisibleRepositories({ added, removed }) {
    for (const repository of added) {
      const repositoryDisposables = new DisposableStore();
      repositoryDisposables.add(autorun((reader) => {
        repository.provider.actionButton.read(reader);
        this.updateChildren(repository);
      }));
      repositoryDisposables.add(repository.input.onDidChangeVisibility(() => this.updateChildren(repository)));
      repositoryDisposables.add(repository.provider.onDidChangeResourceGroups(() => this.updateChildren(repository)));
      const resourceGroupDisposables = repositoryDisposables.add(new DisposableMap());
      const onDidChangeResourceGroups = () => {
        for (const [resourceGroup] of resourceGroupDisposables) {
          if (!repository.provider.groups.includes(resourceGroup)) {
            resourceGroupDisposables.deleteAndDispose(resourceGroup);
          }
        }
        for (const resourceGroup of repository.provider.groups) {
          if (!resourceGroupDisposables.has(resourceGroup)) {
            const disposableStore = new DisposableStore();
            disposableStore.add(resourceGroup.onDidChange(() => this.updateChildren(repository)));
            disposableStore.add(resourceGroup.onDidChangeResources(() => this.updateChildren(repository)));
            resourceGroupDisposables.set(resourceGroup, disposableStore);
          }
        }
      };
      repositoryDisposables.add(repository.provider.onDidChangeResourceGroups(onDidChangeResourceGroups));
      onDidChangeResourceGroups();
      this.items.set(repository, repositoryDisposables);
    }
    for (const repository of removed) {
      this.items.deleteAndDispose(repository);
    }
    this.updateChildren();
    this.onDidActiveEditorChange();
  }
  onListContextMenu(e) {
    if (!e.element) {
      const menu = this.menuService.getMenuActions(Menus.ViewSort, this.contextKeyService);
      const actions2 = getFlatContextMenuActions(menu);
      return this.contextMenuService.showContextMenu({
        getAnchor: () => e.anchor,
        getActions: () => actions2,
        onHide: () => {
        }
      });
    }
    const element = e.element;
    let context = element;
    let actions = [];
    let actionRunner = new RepositoryPaneActionRunner(() => this.getSelectedResources());
    if (isSCMRepository(element)) {
      const menus = this.scmViewService.menus.getRepositoryMenus(element.provider);
      const menu = menus.repositoryContextMenu;
      context = element.provider;
      actionRunner = new RepositoryActionRunner(() => this.getSelectedRepositories());
      actions = collectContextMenuActions(menu);
    } else if (isSCMInput(element) || isSCMActionButton(element)) {
    } else if (isSCMResourceGroup(element)) {
      const menus = this.scmViewService.menus.getRepositoryMenus(element.provider);
      const menu = menus.getResourceGroupMenu(element);
      actions = collectContextMenuActions(menu);
    } else if (isSCMResource(element)) {
      const menus = this.scmViewService.menus.getRepositoryMenus(element.resourceGroup.provider);
      const menu = menus.getResourceMenu(element);
      actions = collectContextMenuActions(menu);
    } else if (isSCMResourceNode(element)) {
      if (element.element) {
        const menus = this.scmViewService.menus.getRepositoryMenus(element.element.resourceGroup.provider);
        const menu = menus.getResourceMenu(element.element);
        actions = collectContextMenuActions(menu);
      } else {
        const menus = this.scmViewService.menus.getRepositoryMenus(element.context.provider);
        const menu = menus.getResourceFolderMenu(element.context);
        actions = collectContextMenuActions(menu);
      }
    }
    actionRunner.onWillRun(() => this.tree.domFocus());
    this.contextMenuService.showContextMenu({
      actionRunner,
      getAnchor: () => e.anchor,
      getActions: () => actions,
      getActionsContext: () => context,
      onHide: () => actionRunner.dispose()
    });
  }
  getSelectedRepositories() {
    const focusedRepositories = this.tree.getFocus().filter((r) => !!r && isSCMRepository(r));
    const selectedRepositories = this.tree.getSelection().filter((r) => !!r && isSCMRepository(r));
    return Array.from(/* @__PURE__ */ new Set([...focusedRepositories, ...selectedRepositories]));
  }
  getSelectedResources() {
    return this.tree.getSelection().filter((r) => isSCMResourceGroup(r) || isSCMResource(r) || isSCMResourceNode(r));
  }
  getViewMode() {
    let mode = this.configurationService.getValue("scm.defaultViewMode") === "list" ? "list" /* List */ : "tree" /* Tree */;
    const storageMode = this.storageService.get(`scm.viewMode`, StorageScope.WORKSPACE);
    if (typeof storageMode === "string") {
      mode = storageMode;
    }
    return mode;
  }
  getViewSortKey() {
    if (this._viewMode === "tree" /* Tree */) {
      return "path" /* Path */;
    }
    let viewSortKey;
    const viewSortKeyString = this.configurationService.getValue("scm.defaultViewSortKey");
    switch (viewSortKeyString) {
      case "name":
        viewSortKey = "name" /* Name */;
        break;
      case "status":
        viewSortKey = "status" /* Status */;
        break;
      default:
        viewSortKey = "path" /* Path */;
        break;
    }
    const storageSortKey = this.storageService.get(`scm.viewSortKey`, StorageScope.WORKSPACE);
    if (typeof storageSortKey === "string") {
      viewSortKey = storageSortKey;
    }
    return viewSortKey;
  }
  loadTreeViewState() {
    const storageViewState = this.storageService.get("scm.viewState2", StorageScope.WORKSPACE);
    if (!storageViewState) {
      return void 0;
    }
    try {
      const treeViewState = JSON.parse(storageViewState);
      return treeViewState;
    } catch {
      return void 0;
    }
  }
  storeTreeViewState() {
    if (this.tree) {
      this.storageService.store("scm.viewState2", JSON.stringify(this.tree.getViewState()), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
  }
  updateChildren(element) {
    this.updateChildrenThrottler.queue(
      () => this.treeOperationSequencer.queue(
        async () => {
          const focusedInput = this.inputRenderer.getFocusedInput();
          if (element && this.tree.hasNode(element)) {
            await this.tree.updateChildren(element);
          } else {
            await this.tree.updateChildren(void 0);
          }
          if (focusedInput) {
            this.inputRenderer.getRenderedInputWidget(focusedInput)?.focus();
          }
          this.updateScmProviderContextKeys();
          this.updateRepositoryCollapseAllContextKeys();
        }
      )
    );
  }
  updateIndentStyles(theme) {
    this.treeContainer.classList.toggle("list-view-mode", this.viewMode === "list" /* List */);
    this.treeContainer.classList.toggle("tree-view-mode", this.viewMode === "tree" /* Tree */);
    this.treeContainer.classList.toggle("align-icons-and-twisties", this.viewMode === "list" /* List */ && theme.hasFileIcons || theme.hasFileIcons && !theme.hasFolderIcons);
    this.treeContainer.classList.toggle("hide-arrows", this.viewMode === "tree" /* Tree */ && theme.hidesExplorerArrows === true);
  }
  updateScmProviderContextKeys() {
    const alwaysShowRepositories = this.configurationService.getValue("scm.alwaysShowRepositories");
    if (!alwaysShowRepositories && this.items.size === 1) {
      const provider = Iterable.first(this.items.keys()).provider;
      this.scmProviderContextKey.set(provider.contextValue);
      this.scmProviderRootUriContextKey.set(provider.rootUri?.toString());
      this.scmProviderHasRootUriContextKey.set(!!provider.rootUri);
    } else {
      this.scmProviderContextKey.set(void 0);
      this.scmProviderRootUriContextKey.set(void 0);
      this.scmProviderHasRootUriContextKey.set(false);
    }
  }
  updateRepositoryCollapseAllContextKeys() {
    if (!this.isBodyVisible() || this.items.size === 1) {
      this.isAnyRepositoryCollapsibleContextKey.set(false);
      this.areAllRepositoriesCollapsedContextKey.set(false);
      return;
    }
    this.isAnyRepositoryCollapsibleContextKey.set(this.scmViewService.visibleRepositories.some((r) => this.tree.hasNode(r) && this.tree.isCollapsible(r)));
    this.areAllRepositoriesCollapsedContextKey.set(this.scmViewService.visibleRepositories.every((r) => this.tree.hasNode(r) && (!this.tree.isCollapsible(r) || this.tree.isCollapsed(r))));
  }
  collapseAllRepositories() {
    for (const repository of this.scmViewService.visibleRepositories) {
      if (this.tree.isCollapsible(repository)) {
        this.tree.collapse(repository);
      }
    }
  }
  expandAllRepositories() {
    for (const repository of this.scmViewService.visibleRepositories) {
      if (this.tree.isCollapsible(repository)) {
        this.tree.expand(repository);
      }
    }
  }
  focusPreviousInput() {
    this.treeOperationSequencer.queue(() => this.focusInput(-1));
  }
  focusNextInput() {
    this.treeOperationSequencer.queue(() => this.focusInput(1));
  }
  async focusInput(delta) {
    if (!this.scmViewService.focusedRepository || this.scmViewService.visibleRepositories.length === 0) {
      return;
    }
    let input = this.scmViewService.focusedRepository.input;
    const repositories = this.scmViewService.visibleRepositories;
    if (repositories.length === 1 && this.inputRenderer.getRenderedInputWidget(input)?.hasFocus() === true) {
      return;
    }
    if (repositories.length > 1 && this.inputRenderer.getRenderedInputWidget(input)?.hasFocus() === true) {
      const focusedRepositoryIndex = repositories.indexOf(this.scmViewService.focusedRepository);
      const newFocusedRepositoryIndex = rot(focusedRepositoryIndex + delta, repositories.length);
      input = repositories[newFocusedRepositoryIndex].input;
    }
    await this.tree.expandTo(input);
    this.tree.reveal(input);
    this.inputRenderer.getRenderedInputWidget(input)?.focus();
  }
  focusPreviousResourceGroup() {
    this.treeOperationSequencer.queue(() => this.focusResourceGroup(-1));
  }
  focusNextResourceGroup() {
    this.treeOperationSequencer.queue(() => this.focusResourceGroup(1));
  }
  async focusResourceGroup(delta) {
    if (!this.scmViewService.focusedRepository || this.scmViewService.visibleRepositories.length === 0) {
      return;
    }
    const treeHasDomFocus = isActiveElement(this.tree.getHTMLElement());
    const resourceGroups = this.scmViewService.focusedRepository.provider.groups;
    const focusedResourceGroup = this.tree.getFocus().find((e) => isSCMResourceGroup(e));
    const focusedResourceGroupIndex = treeHasDomFocus && focusedResourceGroup ? resourceGroups.indexOf(focusedResourceGroup) : -1;
    let resourceGroupNext;
    if (focusedResourceGroupIndex === -1) {
      for (const resourceGroup of resourceGroups) {
        if (this.tree.hasNode(resourceGroup)) {
          resourceGroupNext = resourceGroup;
          break;
        }
      }
    } else {
      let index = rot(focusedResourceGroupIndex + delta, resourceGroups.length);
      while (index !== focusedResourceGroupIndex) {
        if (this.tree.hasNode(resourceGroups[index])) {
          resourceGroupNext = resourceGroups[index];
          break;
        }
        index = rot(index + delta, resourceGroups.length);
      }
    }
    if (resourceGroupNext) {
      await this.tree.expandTo(resourceGroupNext);
      this.tree.reveal(resourceGroupNext);
      this.tree.setSelection([resourceGroupNext]);
      this.tree.setFocus([resourceGroupNext]);
      this.tree.domFocus();
    }
  }
  shouldShowWelcome() {
    return this.scmService.repositoryCount === 0;
  }
  getActionsContext() {
    return this.scmViewService.visibleRepositories.length === 1 ? this.scmViewService.visibleRepositories[0].provider : void 0;
  }
  focus() {
    super.focus();
    this.treeOperationSequencer.queue(() => {
      return new Promise((resolve) => {
        if (this.isExpanded()) {
          if (this.tree.getFocus().length === 0) {
            for (const repository of this.scmViewService.visibleRepositories) {
              const widget = this.inputRenderer.getRenderedInputWidget(repository.input);
              if (widget) {
                widget.focus();
                resolve();
                return;
              }
            }
          }
          this.tree.domFocus();
          resolve();
        }
      });
    });
  }
  dispose() {
    this.visibilityDisposables.dispose();
    this.disposables.dispose();
    this.items.dispose();
    super.dispose();
  }
};
SCMViewPane = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IMenuService),
  __decorateParam(4, ISCMService),
  __decorateParam(5, ISCMViewService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IUriIdentityService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, IThemeService),
  __decorateParam(10, IContextMenuService),
  __decorateParam(11, IInstantiationService),
  __decorateParam(12, IViewDescriptorService),
  __decorateParam(13, IConfigurationService),
  __decorateParam(14, IContextKeyService),
  __decorateParam(15, IOpenerService),
  __decorateParam(16, IHoverService)
], SCMViewPane);
let SCMTreeDataSource = class extends Disposable {
  constructor(viewMode, configurationService, scmViewService) {
    super();
    this.viewMode = viewMode;
    this.configurationService = configurationService;
    this.scmViewService = scmViewService;
  }
  async getChildren(inputOrElement) {
    const repositoryCount = this.scmViewService.visibleRepositories.length;
    const showActionButton = this.configurationService.getValue("scm.showActionButton") === true;
    const alwaysShowRepositories = this.configurationService.getValue("scm.alwaysShowRepositories") === true;
    if (isSCMViewService(inputOrElement) && (repositoryCount > 1 || alwaysShowRepositories)) {
      return this.scmViewService.visibleRepositories;
    } else if (isSCMViewService(inputOrElement) && repositoryCount === 1 && !alwaysShowRepositories || isSCMRepository(inputOrElement)) {
      const children = [];
      inputOrElement = isSCMRepository(inputOrElement) ? inputOrElement : this.scmViewService.visibleRepositories[0];
      const actionButton = inputOrElement.provider.actionButton.get();
      const resourceGroups = inputOrElement.provider.groups;
      if (inputOrElement.input.visible) {
        children.push(inputOrElement.input);
      }
      if (showActionButton && actionButton) {
        children.push({
          type: "actionButton",
          repository: inputOrElement,
          button: actionButton
        });
      }
      const hasSomeChanges = resourceGroups.some((group) => group.resources.length > 0);
      if (hasSomeChanges || repositoryCount === 1 && (!showActionButton || !actionButton)) {
        children.push(...resourceGroups);
      }
      return children;
    } else if (isSCMResourceGroup(inputOrElement)) {
      if (this.viewMode() === "list" /* List */) {
        return inputOrElement.resources;
      } else if (this.viewMode() === "tree" /* Tree */) {
        const children = [];
        for (const node of inputOrElement.resourceTree.root.children) {
          children.push(node.element && node.childrenCount === 0 ? node.element : node);
        }
        return children;
      }
    } else if (isSCMResourceNode(inputOrElement)) {
      const children = [];
      for (const node of inputOrElement.children) {
        children.push(node.element && node.childrenCount === 0 ? node.element : node);
      }
      return children;
    }
    return [];
  }
  getParent(element) {
    if (isSCMResourceNode(element)) {
      if (element.parent === element.context.resourceTree.root) {
        return element.context;
      } else if (element.parent) {
        return element.parent;
      } else {
        throw new Error("Invalid element passed to getParent");
      }
    } else if (isSCMResource(element)) {
      if (this.viewMode() === "list" /* List */) {
        return element.resourceGroup;
      }
      const node = element.resourceGroup.resourceTree.getNode(element.sourceUri);
      const result = node?.parent;
      if (!result) {
        throw new Error("Invalid element passed to getParent");
      }
      if (result === element.resourceGroup.resourceTree.root) {
        return element.resourceGroup;
      }
      return result;
    } else if (isSCMInput(element)) {
      return element.repository;
    } else if (isSCMResourceGroup(element)) {
      const repository = this.scmViewService.visibleRepositories.find((r) => r.provider === element.provider);
      if (!repository) {
        throw new Error("Invalid element passed to getParent");
      }
      return repository;
    } else {
      throw new Error("Unexpected call to getParent");
    }
  }
  hasChildren(inputOrElement) {
    if (isSCMViewService(inputOrElement)) {
      return this.scmViewService.visibleRepositories.length !== 0;
    } else if (isSCMRepository(inputOrElement)) {
      return true;
    } else if (isSCMInput(inputOrElement)) {
      return false;
    } else if (isSCMActionButton(inputOrElement)) {
      return false;
    } else if (isSCMResourceGroup(inputOrElement)) {
      return true;
    } else if (isSCMResource(inputOrElement)) {
      return false;
    } else if (ResourceTree.isResourceNode(inputOrElement)) {
      return inputOrElement.childrenCount > 0;
    } else {
      throw new Error("hasChildren not implemented.");
    }
  }
};
SCMTreeDataSource = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ISCMViewService)
], SCMTreeDataSource);
class SCMActionButton {
  constructor(container, contextMenuService, commandService, notificationService) {
    this.container = container;
    this.contextMenuService = contextMenuService;
    this.commandService = commandService;
    this.notificationService = notificationService;
    this.disposables = new MutableDisposable();
  }
  dispose() {
    this.disposables?.dispose();
  }
  setButton(button) {
    this.clear();
    if (!button) {
      return;
    }
    if (button.secondaryCommands?.length) {
      const actions = [];
      for (let index = 0; index < button.secondaryCommands.length; index++) {
        const commands = button.secondaryCommands[index];
        for (const command of commands) {
          actions.push(toAction({
            id: command.id,
            label: command.title,
            enabled: true,
            run: async () => {
              await this.executeCommand(command.id, ...command.arguments || []);
            }
          }));
        }
        if (commands.length) {
          actions.push(new Separator());
        }
      }
      actions.pop();
      this.button = new ButtonWithDropdown(this.container, {
        actions,
        addPrimaryActionToDropdown: false,
        contextMenuProvider: this.contextMenuService,
        title: button.command.tooltip,
        supportIcons: true,
        ...defaultButtonStyles
      });
    } else {
      this.button = new Button(this.container, { supportIcons: true, supportShortLabel: !!button.command.shortTitle, title: button.command.tooltip, ...defaultButtonStyles });
    }
    this.button.enabled = button.enabled;
    this.button.label = button.command.title;
    if (this.button instanceof Button && button.command.shortTitle) {
      this.button.labelShort = button.command.shortTitle;
    }
    this.button.onDidClick(async () => await this.executeCommand(button.command.id, ...button.command.arguments || []), null, this.disposables.value);
    this.disposables.value.add(this.button);
  }
  focus() {
    this.button?.focus();
  }
  clear() {
    this.disposables.value = new DisposableStore();
    this.button = void 0;
    clearNode(this.container);
  }
  async executeCommand(commandId, ...args) {
    try {
      await this.commandService.executeCommand(commandId, ...args);
    } catch (ex) {
      this.notificationService.error(ex);
    }
  }
}
setupSimpleEditorSelectionStyling(".scm-view .scm-editor-container");
export {
  ActionButtonRenderer,
  ContextKeys,
  SCMAccessibilityProvider,
  SCMActionButton,
  SCMTreeKeyboardNavigationLabelProvider,
  SCMTreeSorter,
  SCMViewPane
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zY20vYnJvd3Nlci9zY21WaWV3UGFuZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS9zY20uY3NzJztcbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGRpcm5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUsIERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgY29tYmluZWREaXNwb3NhYmxlLCBkaXNwb3NlLCB0b0Rpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlLCBEaXNwb3NhYmxlTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFZpZXdQYW5lLCBJVmlld1BhbmVPcHRpb25zLCBWaWV3QWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZS5qcyc7XG5pbXBvcnQgeyBhcHBlbmQsICQsIERpbWVuc2lvbiwgdHJhY2tGb2N1cywgY2xlYXJOb2RlLCBpc1BvaW50ZXJFdmVudCwgaXNBY3RpdmVFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBhc0NTU1VybCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9jc3NWYWx1ZS5qcyc7XG5pbXBvcnQgeyBJTGlzdFZpcnR1YWxEZWxlZ2F0ZSwgSUlkZW50aXR5UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IElTQ01SZXNvdXJjZUdyb3VwLCBJU0NNUmVzb3VyY2UsIElucHV0VmFsaWRhdGlvblR5cGUsIElTQ01SZXBvc2l0b3J5LCBJU0NNSW5wdXQsIElJbnB1dFZhbGlkYXRpb24sIElTQ01WaWV3U2VydmljZSwgSVNDTVZpZXdWaXNpYmxlUmVwb3NpdG9yeUNoYW5nZUV2ZW50LCBJU0NNU2VydmljZSwgU0NNSW5wdXRDaGFuZ2VSZWFzb24sIFZJRVdfUEFORV9JRCwgSVNDTUFjdGlvbkJ1dHRvbiwgSVNDTUFjdGlvbkJ1dHRvbkRlc2NyaXB0b3IsIElTQ01SZXBvc2l0b3J5U29ydEtleSwgSVNDTUlucHV0VmFsdWVQcm92aWRlckNvbnRleHQgfSBmcm9tICcuLi9jb21tb24vc2NtLmpzJztcbmltcG9ydCB7IFJlc291cmNlTGFiZWxzLCBJUmVzb3VyY2VMYWJlbCwgSUZpbGVMYWJlbE9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2xhYmVscy5qcyc7XG5pbXBvcnQgeyBDb3VudEJhZGdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2NvdW50QmFkZ2UvY291bnRCYWRnZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0Vmlld1NlcnZpY2UsIElDb250ZXh0TWVudVNlcnZpY2UsIElPcGVuQ29udGV4dFZpZXcgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSwgSUNvbnRleHRLZXksIENvbnRleHRLZXlFeHByLCBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBNZW51SXRlbUFjdGlvbiwgSU1lbnVTZXJ2aWNlLCByZWdpc3RlckFjdGlvbjIsIE1lbnVJZCwgSUFjdGlvbjJPcHRpb25zLCBNZW51UmVnaXN0cnksIEFjdGlvbjIsIElNZW51IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uLCBBY3Rpb25SdW5uZXIsIEFjdGlvbiwgU2VwYXJhdG9yLCBJQWN0aW9uUnVubmVyLCB0b0FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyLCBJQWN0aW9uVmlld0l0ZW1Qcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UsIElGaWxlSWNvblRoZW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc1NDTVJlc291cmNlLCBpc1NDTVJlc291cmNlR3JvdXAsIGlzU0NNUmVwb3NpdG9yeSwgaXNTQ01JbnB1dCwgY29sbGVjdENvbnRleHRNZW51QWN0aW9ucywgZ2V0QWN0aW9uVmlld0l0ZW1Qcm92aWRlciwgaXNTQ01BY3Rpb25CdXR0b24sIGlzU0NNVmlld1NlcnZpY2UsIGlzU0NNUmVzb3VyY2VOb2RlLCBjb25uZWN0UHJpbWFyeU1lbnUgfSBmcm9tICcuL3V0aWwuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZSwgSU9wZW5FdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UsIENvbmZpZ3VyYXRpb25UYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IGRpc3Bvc2FibGVUaW1lb3V0LCBTZXF1ZW5jZXIsIFRocm90dGxlZERlbGF5ZXIsIFRocm90dGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElUcmVlTm9kZSwgSVRyZWVGaWx0ZXIsIElUcmVlU29ydGVyLCBJVHJlZUNvbnRleHRNZW51RXZlbnQsIElUcmVlRHJhZ0FuZERyb3AsIElUcmVlRHJhZ092ZXJSZWFjdGlvbiwgSUFzeW5jRGF0YVNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL3RyZWUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VUcmVlLCBJUmVzb3VyY2VOb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VUcmVlLmpzJztcbmltcG9ydCB7IElDb21wcmVzc2libGVUcmVlUmVuZGVyZXIsIElDb21wcmVzc2libGVLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvb2JqZWN0VHJlZS5qcyc7XG5pbXBvcnQgeyBJdGVyYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2l0ZXJhdG9yLmpzJztcbmltcG9ydCB7IElDb21wcmVzc2VkVHJlZU5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9jb21wcmVzc2VkT2JqZWN0VHJlZU1vZGVsLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBGaWxlS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBjb21wYXJlRmlsZU5hbWVzLCBjb21wYXJlUGF0aHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb21wYXJlcnMuanMnO1xuaW1wb3J0IHsgRnV6enlTY29yZSwgY3JlYXRlTWF0Y2hlcywgSU1hdGNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLCBTaWRlQnlTaWRlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBDb2RlRWRpdG9yV2lkZ2V0LCBJQ29kZUVkaXRvcldpZGdldE9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvci9jb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IElFZGl0b3JDb25zdHJ1Y3Rpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvY29uZmlnL2VkaXRvckNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgZ2V0U2ltcGxlRWRpdG9yT3B0aW9ucywgc2V0dXBTaW1wbGVFZGl0b3JTZWxlY3Rpb25TdHlsaW5nIH0gZnJvbSAnLi4vLi4vY29kZUVkaXRvci9icm93c2VyL3NpbXBsZUVkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgRWRpdG9yRXh0ZW5zaW9uc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBNZW51UHJldmVudGVyIH0gZnJvbSAnLi4vLi4vY29kZUVkaXRvci9icm93c2VyL21lbnVQcmV2ZW50ZXIuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uQ2xpcGJvYXJkQ29udHJpYnV0aW9uSUQgfSBmcm9tICcuLi8uLi9jb2RlRWRpdG9yL2Jyb3dzZXIvc2VsZWN0aW9uQ2xpcGJvYXJkLmpzJztcbmltcG9ydCB7IEVkaXRvckRpY3RhdGlvbiB9IGZyb20gJy4uLy4uL2NvZGVFZGl0b3IvYnJvd3Nlci9kaWN0YXRpb24vZWRpdG9yRGljdGF0aW9uLmpzJztcbmltcG9ydCB7IENvbnRleHRNZW51Q29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2NvbnRleHRtZW51L2Jyb3dzZXIvY29udGV4dG1lbnUuanMnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgY29tcGFyZSwgZm9ybWF0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBTdWdnZXN0Q29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3N1Z2dlc3QvYnJvd3Nlci9zdWdnZXN0Q29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0Q29udHJvbGxlcjIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zbmlwcGV0L2Jyb3dzZXIvc25pcHBldENvbnRyb2xsZXIyLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgQ29sb3JEZXRlY3RvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2NvbG9yUGlja2VyL2Jyb3dzZXIvY29sb3JEZXRlY3Rvci5qcyc7XG5pbXBvcnQgeyBMaW5rRGV0ZWN0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9saW5rcy9icm93c2VyL2xpbmtzLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJTGlzdEFjY2Vzc2liaWxpdHlQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RXaWRnZXQuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgREVGQVVMVF9GT05UX0ZBTUlMWSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9mb250cy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IEFuY2hvckFsaWdubWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9jb250ZXh0dmlldy9jb250ZXh0dmlldy5qcyc7XG5pbXBvcnQgeyBSZXBvc2l0b3J5QWN0aW9uUnVubmVyLCBSZXBvc2l0b3J5UmVuZGVyZXIgfSBmcm9tICcuL3NjbVJlcG9zaXRvcnlSZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBDb2xvclNjaGVtZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZS5qcyc7XG5pbXBvcnQgeyBMYWJlbEZ1enp5U2NvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9hYnN0cmFjdFRyZWUuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBBUElfT1BFTl9ESUZGX0VESVRPUl9DT01NQU5EX0lELCBBUElfT1BFTl9FRElUT1JfQ09NTUFORF9JRCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvckNvbW1hbmRzLmpzJztcbmltcG9ydCB7IGNyZWF0ZUFjdGlvblZpZXdJdGVtLCBnZXRGbGF0QWN0aW9uQmFyQWN0aW9ucywgZ2V0RmxhdENvbnRleHRNZW51QWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blJlbmRlcmVyLCBvcGVuTGlua0Zyb21NYXJrZG93biB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9tYXJrZG93blJlbmRlcmVyL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBCdXR0b24sIEJ1dHRvbldpdGhEZXNjcmlwdGlvbiwgQnV0dG9uV2l0aERyb3Bkb3duIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2J1dHRvbi9idXR0b24uanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBSZXBvc2l0b3J5Q29udGV4dEtleXMgfSBmcm9tICcuL3NjbVZpZXdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IERyYWdBbmREcm9wQ29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2RuZC9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgeyBDb3B5UGFzdGVDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZHJvcE9yUGFzdGVJbnRvL2Jyb3dzZXIvY29weVBhc3RlQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBEcm9wSW50b0VkaXRvckNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9kcm9wT3JQYXN0ZUludG8vYnJvd3Nlci9kcm9wSW50b0VkaXRvckNvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgTWVzc2FnZUNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9tZXNzYWdlL2Jyb3dzZXIvbWVzc2FnZUNvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgZGVmYXVsdEJ1dHRvblN0eWxlcywgZGVmYXVsdENvdW50QmFkZ2VTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvYnJvd3Nlci9jb250cm9sbGVyL2lubGluZUNvbXBsZXRpb25zQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBDb2RlQWN0aW9uQ29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2NvZGVBY3Rpb24vYnJvd3Nlci9jb2RlQWN0aW9uQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJRHJhZ0FuZERyb3BEYXRhIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgeyBmaWxsRWRpdG9yc0RyYWdEYXRhIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgRWxlbWVudHNEcmFnQW5kRHJvcERhdGEsIExpc3RWaWV3VGFyZ2V0U2VjdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdFZpZXcuanMnO1xuaW1wb3J0IHsgQ29kZURhdGFUcmFuc2ZlcnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kbmQvYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgRm9ybWF0T25UeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZm9ybWF0L2Jyb3dzZXIvZm9ybWF0QWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24sIEVkaXRvck9wdGlvbnMsIElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQXN5bmNEYXRhVHJlZVZpZXdTdGF0ZSwgSVRyZWVDb21wcmVzc2lvbkRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvYXN5bmNEYXRhVHJlZS5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvZWRpdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTWVudVdvcmtiZW5jaFRvb2xCYXJPcHRpb25zLCBXb3JrYmVuY2hUb29sQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL3Rvb2xiYXIuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRHJvcGRvd25XaXRoUHJpbWFyeUFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL2Ryb3Bkb3duV2l0aFByaW1hcnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBjbGFtcCwgcm90IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbnVtYmVycy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBPcGVuU2NtR3JvdXBBY3Rpb24gfSBmcm9tICcuLi8uLi9tdWx0aURpZmZFZGl0b3IvYnJvd3Nlci9zY21NdWx0aURpZmZTb3VyY2VSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBDb250ZW50SG92ZXJDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvaG92ZXIvYnJvd3Nlci9jb250ZW50SG92ZXJDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IEdseXBoSG92ZXJDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvaG92ZXIvYnJvd3Nlci9nbHlwaEhvdmVyQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBhdXRvcnVuLCBydW5PbkNoYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgUGxhY2Vob2xkZXJUZXh0Q29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvcGxhY2Vob2xkZXJUZXh0L2Jyb3dzZXIvcGxhY2Vob2xkZXJUZXh0Q29udHJpYnV0aW9uLmpzJztcbmltcG9ydCB7IG9ic2VydmFibGVDb25maWdWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29ic2VydmFibGUvY29tbW9uL3BsYXRmb3JtT2JzZXJ2YWJsZVV0aWxzLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQgfSBmcm9tICcuLi8uLi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5Q29tbWFuZElkIH0gZnJvbSAnLi4vLi4vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eUNvbW1hbmRzLmpzJztcblxudHlwZSBUcmVlRWxlbWVudCA9IElTQ01SZXBvc2l0b3J5IHwgSVNDTUlucHV0IHwgSVNDTUFjdGlvbkJ1dHRvbiB8IElTQ01SZXNvdXJjZUdyb3VwIHwgSVNDTVJlc291cmNlIHwgSVJlc291cmNlTm9kZTxJU0NNUmVzb3VyY2UsIElTQ01SZXNvdXJjZUdyb3VwPjtcblxuZnVuY3Rpb24gcHJvY2Vzc1Jlc291cmNlRmlsdGVyRGF0YSh1cmk6IFVSSSwgZmlsdGVyRGF0YTogRnV6enlTY29yZSB8IExhYmVsRnV6enlTY29yZSB8IHVuZGVmaW5lZCk6IFtJTWF0Y2hbXSB8IHVuZGVmaW5lZCwgSU1hdGNoW10gfCB1bmRlZmluZWRdIHtcblx0aWYgKCFmaWx0ZXJEYXRhKSB7XG5cdFx0cmV0dXJuIFt1bmRlZmluZWQsIHVuZGVmaW5lZF07XG5cdH1cblxuXHRpZiAoIShmaWx0ZXJEYXRhIGFzIExhYmVsRnV6enlTY29yZSkubGFiZWwpIHtcblx0XHRjb25zdCBtYXRjaGVzID0gY3JlYXRlTWF0Y2hlcyhmaWx0ZXJEYXRhIGFzIEZ1enp5U2NvcmUpO1xuXHRcdHJldHVybiBbbWF0Y2hlcywgdW5kZWZpbmVkXTtcblx0fVxuXG5cdGNvbnN0IGZpbGVOYW1lID0gYmFzZW5hbWUodXJpKTtcblx0Y29uc3QgbGFiZWwgPSAoZmlsdGVyRGF0YSBhcyBMYWJlbEZ1enp5U2NvcmUpLmxhYmVsO1xuXHRjb25zdCBwYXRoTGVuZ3RoID0gbGFiZWwubGVuZ3RoIC0gZmlsZU5hbWUubGVuZ3RoO1xuXHRjb25zdCBtYXRjaGVzID0gY3JlYXRlTWF0Y2hlcygoZmlsdGVyRGF0YSBhcyBMYWJlbEZ1enp5U2NvcmUpLnNjb3JlKTtcblxuXHQvLyBGaWxlTmFtZSBtYXRjaFxuXHRpZiAobGFiZWwgPT09IGZpbGVOYW1lKSB7XG5cdFx0cmV0dXJuIFttYXRjaGVzLCB1bmRlZmluZWRdO1xuXHR9XG5cblx0Ly8gRmlsZVBhdGggbWF0Y2hcblx0Y29uc3QgbGFiZWxNYXRjaGVzOiBJTWF0Y2hbXSA9IFtdO1xuXHRjb25zdCBkZXNjcmlwdGlvbk1hdGNoZXM6IElNYXRjaFtdID0gW107XG5cblx0Zm9yIChjb25zdCBtYXRjaCBvZiBtYXRjaGVzKSB7XG5cdFx0aWYgKG1hdGNoLnN0YXJ0ID4gcGF0aExlbmd0aCkge1xuXHRcdFx0Ly8gTGFiZWwgbWF0Y2hcblx0XHRcdGxhYmVsTWF0Y2hlcy5wdXNoKHtcblx0XHRcdFx0c3RhcnQ6IG1hdGNoLnN0YXJ0IC0gcGF0aExlbmd0aCxcblx0XHRcdFx0ZW5kOiBtYXRjaC5lbmQgLSBwYXRoTGVuZ3RoXG5cdFx0XHR9KTtcblx0XHR9IGVsc2UgaWYgKG1hdGNoLmVuZCA8IHBhdGhMZW5ndGgpIHtcblx0XHRcdC8vIERlc2NyaXB0aW9uIG1hdGNoXG5cdFx0XHRkZXNjcmlwdGlvbk1hdGNoZXMucHVzaChtYXRjaCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIFNwYW5uaW5nIG1hdGNoXG5cdFx0XHRsYWJlbE1hdGNoZXMucHVzaCh7XG5cdFx0XHRcdHN0YXJ0OiAwLFxuXHRcdFx0XHRlbmQ6IG1hdGNoLmVuZCAtIHBhdGhMZW5ndGhcblx0XHRcdH0pO1xuXHRcdFx0ZGVzY3JpcHRpb25NYXRjaGVzLnB1c2goe1xuXHRcdFx0XHRzdGFydDogbWF0Y2guc3RhcnQsXG5cdFx0XHRcdGVuZDogcGF0aExlbmd0aFxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIFtsYWJlbE1hdGNoZXMsIGRlc2NyaXB0aW9uTWF0Y2hlc107XG59XG5cbmludGVyZmFjZSBJU0NNTGF5b3V0IHtcblx0aGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdHdpZHRoOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDx2b2lkPjtcbn1cblxuaW50ZXJmYWNlIEFjdGlvbkJ1dHRvblRlbXBsYXRlIHtcblx0cmVhZG9ubHkgYWN0aW9uQnV0dG9uOiBTQ01BY3Rpb25CdXR0b247XG5cdGRpc3Bvc2FibGU6IElEaXNwb3NhYmxlO1xuXHRyZWFkb25seSB0ZW1wbGF0ZURpc3Bvc2FibGU6IElEaXNwb3NhYmxlO1xufVxuXG5leHBvcnQgY2xhc3MgQWN0aW9uQnV0dG9uUmVuZGVyZXIgaW1wbGVtZW50cyBJQ29tcHJlc3NpYmxlVHJlZVJlbmRlcmVyPElTQ01BY3Rpb25CdXR0b24sIEZ1enp5U2NvcmUsIEFjdGlvbkJ1dHRvblRlbXBsYXRlPiB7XG5cdHN0YXRpYyByZWFkb25seSBERUZBVUxUX0hFSUdIVCA9IDI4O1xuXG5cdHN0YXRpYyByZWFkb25seSBURU1QTEFURV9JRCA9ICdhY3Rpb25CdXR0b24nO1xuXHRnZXQgdGVtcGxhdGVJZCgpOiBzdHJpbmcgeyByZXR1cm4gQWN0aW9uQnV0dG9uUmVuZGVyZXIuVEVNUExBVEVfSUQ7IH1cblxuXHRwcml2YXRlIGFjdGlvbkJ1dHRvbnMgPSBuZXcgTWFwPElTQ01BY3Rpb25CdXR0b24sIFNDTUFjdGlvbkJ1dHRvbj4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0KSB7IH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogQWN0aW9uQnV0dG9uVGVtcGxhdGUge1xuXHRcdC8vIGhhY2tcblx0XHQoY29udGFpbmVyLnBhcmVudEVsZW1lbnQhLnBhcmVudEVsZW1lbnQhLnF1ZXJ5U2VsZWN0b3IoJy5tb25hY28tdGwtdHdpc3RpZScpISBhcyBIVE1MRWxlbWVudCkuY2xhc3NMaXN0LmFkZCgnZm9yY2Utbm8tdHdpc3RpZScpO1xuXG5cdFx0Ly8gVXNlIGRlZmF1bHQgY3Vyc29yICYgZGlzYWJsZSBob3ZlciBmb3IgbGlzdCBpdGVtXG5cdFx0Y29udGFpbmVyLnBhcmVudEVsZW1lbnQhLnBhcmVudEVsZW1lbnQhLmNsYXNzTGlzdC5hZGQoJ2N1cnNvci1kZWZhdWx0JywgJ2ZvcmNlLW5vLWhvdmVyJyk7XG5cblx0XHRjb25zdCBidXR0b25Db250YWluZXIgPSBhcHBlbmQoY29udGFpbmVyLCAkKCcuYnV0dG9uLWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCBhY3Rpb25CdXR0b24gPSBuZXcgU0NNQWN0aW9uQnV0dG9uKGJ1dHRvbkNvbnRhaW5lciwgdGhpcy5jb250ZXh0TWVudVNlcnZpY2UsIHRoaXMuY29tbWFuZFNlcnZpY2UsIHRoaXMubm90aWZpY2F0aW9uU2VydmljZSk7XG5cblx0XHRyZXR1cm4geyBhY3Rpb25CdXR0b24sIGRpc3Bvc2FibGU6IERpc3Bvc2FibGUuTm9uZSwgdGVtcGxhdGVEaXNwb3NhYmxlOiBhY3Rpb25CdXR0b24gfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQobm9kZTogSVRyZWVOb2RlPElTQ01BY3Rpb25CdXR0b24sIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IEFjdGlvbkJ1dHRvblRlbXBsYXRlLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGFjdGlvbkJ1dHRvbiA9IG5vZGUuZWxlbWVudDtcblx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9uQnV0dG9uLnNldEJ1dHRvbihub2RlLmVsZW1lbnQuYnV0dG9uKTtcblxuXHRcdC8vIFJlbWVtYmVyIGFjdGlvbiBidXR0b25cblx0XHR0aGlzLmFjdGlvbkJ1dHRvbnMuc2V0KGFjdGlvbkJ1dHRvbiwgdGVtcGxhdGVEYXRhLmFjdGlvbkJ1dHRvbik7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHsgZGlzcG9zZTogKCkgPT4gdGhpcy5hY3Rpb25CdXR0b25zLmRlbGV0ZShhY3Rpb25CdXR0b24pIH0pO1xuXG5cdFx0dGVtcGxhdGVEYXRhLmRpc3Bvc2FibGUgPSBkaXNwb3NhYmxlcztcblx0fVxuXG5cdHJlbmRlckNvbXByZXNzZWRFbGVtZW50cygpOiB2b2lkIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Nob3VsZCBuZXZlciBoYXBwZW4gc2luY2Ugbm9kZSBpcyBpbmNvbXByZXNzaWJsZScpO1xuXHR9XG5cblx0Zm9jdXNBY3Rpb25CdXR0b24oYWN0aW9uQnV0dG9uOiBJU0NNQWN0aW9uQnV0dG9uKTogdm9pZCB7XG5cdFx0dGhpcy5hY3Rpb25CdXR0b25zLmdldChhY3Rpb25CdXR0b24pPy5mb2N1cygpO1xuXHR9XG5cblx0ZGlzcG9zZUVsZW1lbnQobm9kZTogSVRyZWVOb2RlPElTQ01BY3Rpb25CdXR0b24sIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZTogQWN0aW9uQnV0dG9uVGVtcGxhdGUpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZS5kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IEFjdGlvbkJ1dHRvblRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdHRlbXBsYXRlRGF0YS50ZW1wbGF0ZURpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9XG59XG5cblxuY2xhc3MgU0NNVHJlZURyYWdBbmREcm9wIGltcGxlbWVudHMgSVRyZWVEcmFnQW5kRHJvcDxUcmVlRWxlbWVudD4ge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpIHsgfVxuXG5cdGdldERyYWdVUkkoZWxlbWVudDogVHJlZUVsZW1lbnQpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRpZiAoaXNTQ01SZXNvdXJjZShlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIGVsZW1lbnQuc291cmNlVXJpLnRvU3RyaW5nKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRvbkRyYWdTdGFydChkYXRhOiBJRHJhZ0FuZERyb3BEYXRhLCBvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBpdGVtcyA9IFNDTVRyZWVEcmFnQW5kRHJvcC5nZXRSZXNvdXJjZXNGcm9tRHJhZ0FuZERyb3BEYXRhKGRhdGEgYXMgRWxlbWVudHNEcmFnQW5kRHJvcERhdGE8VHJlZUVsZW1lbnQsIFRyZWVFbGVtZW50W10+KTtcblx0XHRpZiAob3JpZ2luYWxFdmVudC5kYXRhVHJhbnNmZXIgJiYgaXRlbXM/Lmxlbmd0aCkge1xuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBmaWxsRWRpdG9yc0RyYWdEYXRhKGFjY2Vzc29yLCBpdGVtcywgb3JpZ2luYWxFdmVudCkpO1xuXG5cdFx0XHRjb25zdCBmaWxlUmVzb3VyY2VzID0gaXRlbXMuZmlsdGVyKHMgPT4gcy5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkubWFwKHIgPT4gci5mc1BhdGgpO1xuXHRcdFx0aWYgKGZpbGVSZXNvdXJjZXMubGVuZ3RoKSB7XG5cdFx0XHRcdG9yaWdpbmFsRXZlbnQuZGF0YVRyYW5zZmVyLnNldERhdGEoQ29kZURhdGFUcmFuc2ZlcnMuRklMRVMsIEpTT04uc3RyaW5naWZ5KGZpbGVSZXNvdXJjZXMpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRnZXREcmFnTGFiZWwoZWxlbWVudHM6IFRyZWVFbGVtZW50W10sIG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGVsZW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0Y29uc3QgZWxlbWVudCA9IGVsZW1lbnRzWzBdO1xuXHRcdFx0aWYgKGlzU0NNUmVzb3VyY2UoZWxlbWVudCkpIHtcblx0XHRcdFx0cmV0dXJuIGJhc2VuYW1lKGVsZW1lbnQuc291cmNlVXJpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gU3RyaW5nKGVsZW1lbnRzLmxlbmd0aCk7XG5cdH1cblxuXHRvbkRyYWdPdmVyKGRhdGE6IElEcmFnQW5kRHJvcERhdGEsIHRhcmdldEVsZW1lbnQ6IFRyZWVFbGVtZW50IHwgdW5kZWZpbmVkLCB0YXJnZXRJbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkLCB0YXJnZXRTZWN0b3I6IExpc3RWaWV3VGFyZ2V0U2VjdG9yIHwgdW5kZWZpbmVkLCBvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQpOiBib29sZWFuIHwgSVRyZWVEcmFnT3ZlclJlYWN0aW9uIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGRyb3AoZGF0YTogSURyYWdBbmREcm9wRGF0YSwgdGFyZ2V0RWxlbWVudDogVHJlZUVsZW1lbnQgfCB1bmRlZmluZWQsIHRhcmdldEluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQsIHRhcmdldFNlY3RvcjogTGlzdFZpZXdUYXJnZXRTZWN0b3IgfCB1bmRlZmluZWQsIG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IHZvaWQgeyB9XG5cblx0cHJpdmF0ZSBzdGF0aWMgZ2V0UmVzb3VyY2VzRnJvbURyYWdBbmREcm9wRGF0YShkYXRhOiBFbGVtZW50c0RyYWdBbmREcm9wRGF0YTxUcmVlRWxlbWVudCwgVHJlZUVsZW1lbnRbXT4pOiBVUklbXSB7XG5cdFx0Y29uc3QgdXJpczogVVJJW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGVsZW1lbnQgb2YgWy4uLmRhdGEuY29udGV4dCA/PyBbXSwgLi4uZGF0YS5lbGVtZW50c10pIHtcblx0XHRcdGlmIChpc1NDTVJlc291cmNlKGVsZW1lbnQpKSB7XG5cdFx0XHRcdHVyaXMucHVzaChlbGVtZW50LnNvdXJjZVVyaSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1cmlzO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHsgfVxufVxuXG5pbnRlcmZhY2UgSW5wdXRUZW1wbGF0ZSB7XG5cdHJlYWRvbmx5IGlucHV0V2lkZ2V0OiBTQ01JbnB1dFdpZGdldDtcblx0aW5wdXRXaWRnZXRIZWlnaHQ6IG51bWJlcjtcblx0cmVhZG9ubHkgZWxlbWVudERpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHJlYWRvbmx5IHRlbXBsYXRlRGlzcG9zYWJsZTogSURpc3Bvc2FibGU7XG59XG5cbmNsYXNzIElucHV0UmVuZGVyZXIgaW1wbGVtZW50cyBJQ29tcHJlc3NpYmxlVHJlZVJlbmRlcmVyPElTQ01JbnB1dCwgRnV6enlTY29yZSwgSW5wdXRUZW1wbGF0ZT4ge1xuXG5cdHN0YXRpYyByZWFkb25seSBERUZBVUxUX0hFSUdIVCA9IDI2O1xuXG5cdHN0YXRpYyByZWFkb25seSBURU1QTEFURV9JRCA9ICdpbnB1dCc7XG5cdGdldCB0ZW1wbGF0ZUlkKCk6IHN0cmluZyB7IHJldHVybiBJbnB1dFJlbmRlcmVyLlRFTVBMQVRFX0lEOyB9XG5cblx0cHJpdmF0ZSBpbnB1dFdpZGdldHMgPSBuZXcgTWFwPElTQ01JbnB1dCwgU0NNSW5wdXRXaWRnZXQ+KCk7XG5cdHByaXZhdGUgY29udGVudEhlaWdodHMgPSBuZXcgV2Vha01hcDxJU0NNSW5wdXQsIG51bWJlcj4oKTtcblx0cHJpdmF0ZSBlZGl0b3JTZWxlY3Rpb25zID0gbmV3IFdlYWtNYXA8SVNDTUlucHV0LCBTZWxlY3Rpb25bXT4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIG91dGVyTGF5b3V0OiBJU0NNTGF5b3V0LFxuXHRcdHByaXZhdGUgb3ZlcmZsb3dXaWRnZXRzRG9tTm9kZTogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSB1cGRhdGVIZWlnaHQ6IChpbnB1dDogSVNDTUlucHV0LCBoZWlnaHQ6IG51bWJlcikgPT4gdm9pZCxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZVxuXHQpIHsgfVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJbnB1dFRlbXBsYXRlIHtcblx0XHQvLyBoYWNrXG5cdFx0KGNvbnRhaW5lci5wYXJlbnRFbGVtZW50IS5wYXJlbnRFbGVtZW50IS5xdWVyeVNlbGVjdG9yKCcubW9uYWNvLXRsLXR3aXN0aWUnKSEgYXMgSFRNTEVsZW1lbnQpLmNsYXNzTGlzdC5hZGQoJ2ZvcmNlLW5vLXR3aXN0aWUnKTtcblxuXHRcdC8vIERpc2FibGUgaG92ZXIgZm9yIGxpc3QgaXRlbVxuXHRcdGNvbnRhaW5lci5wYXJlbnRFbGVtZW50IS5wYXJlbnRFbGVtZW50IS5jbGFzc0xpc3QuYWRkKCdmb3JjZS1uby1ob3ZlcicpO1xuXG5cdFx0Y29uc3QgdGVtcGxhdGVEaXNwb3NhYmxlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGlucHV0RWxlbWVudCA9IGFwcGVuZChjb250YWluZXIsICQoJy5zY20taW5wdXQnKSk7XG5cdFx0Y29uc3QgaW5wdXRXaWRnZXQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNDTUlucHV0V2lkZ2V0LCBpbnB1dEVsZW1lbnQsIHRoaXMub3ZlcmZsb3dXaWRnZXRzRG9tTm9kZSk7XG5cdFx0dGVtcGxhdGVEaXNwb3NhYmxlLmFkZChpbnB1dFdpZGdldCk7XG5cblx0XHRyZXR1cm4geyBpbnB1dFdpZGdldCwgaW5wdXRXaWRnZXRIZWlnaHQ6IElucHV0UmVuZGVyZXIuREVGQVVMVF9IRUlHSFQsIGVsZW1lbnREaXNwb3NhYmxlczogbmV3IERpc3Bvc2FibGVTdG9yZSgpLCB0ZW1wbGF0ZURpc3Bvc2FibGUgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQobm9kZTogSVRyZWVOb2RlPElTQ01JbnB1dCwgRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSW5wdXRUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdGNvbnN0IGlucHV0ID0gbm9kZS5lbGVtZW50O1xuXHRcdHRlbXBsYXRlRGF0YS5pbnB1dFdpZGdldC5pbnB1dCA9IGlucHV0O1xuXG5cdFx0Ly8gUmVtZW1iZXIgd2lkZ2V0XG5cdFx0dGhpcy5pbnB1dFdpZGdldHMuc2V0KGlucHV0LCB0ZW1wbGF0ZURhdGEuaW5wdXRXaWRnZXQpO1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKHtcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHRoaXMuaW5wdXRXaWRnZXRzLmRlbGV0ZShpbnB1dClcblx0XHR9KTtcblxuXHRcdC8vIFdpZGdldCBjdXJzb3Igc2VsZWN0aW9uc1xuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSB0aGlzLmVkaXRvclNlbGVjdGlvbnMuZ2V0KGlucHV0KTtcblxuXHRcdGlmIChzZWxlY3Rpb25zKSB7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuaW5wdXRXaWRnZXQuc2VsZWN0aW9ucyA9IHNlbGVjdGlvbnM7XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbnMgPSB0ZW1wbGF0ZURhdGEuaW5wdXRXaWRnZXQuc2VsZWN0aW9ucztcblxuXHRcdFx0aWYgKHNlbGVjdGlvbnMpIHtcblx0XHRcdFx0dGhpcy5lZGl0b3JTZWxlY3Rpb25zLnNldChpbnB1dCwgc2VsZWN0aW9ucyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gUmVzZXQgd2lkZ2V0IGhlaWdodCBzbyBpdCdzIHJlY2FsY3VsYXRlZFxuXHRcdHRlbXBsYXRlRGF0YS5pbnB1dFdpZGdldEhlaWdodCA9IElucHV0UmVuZGVyZXIuREVGQVVMVF9IRUlHSFQ7XG5cblx0XHQvLyBSZXJlbmRlciB0aGUgZWxlbWVudCB3aGVuZXZlciB0aGUgZWRpdG9yIGNvbnRlbnQgaGVpZ2h0IGNoYW5nZXNcblx0XHRjb25zdCBvbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBjb250ZW50SGVpZ2h0ID0gdGVtcGxhdGVEYXRhLmlucHV0V2lkZ2V0LmdldENvbnRlbnRIZWlnaHQoKTtcblx0XHRcdHRoaXMuY29udGVudEhlaWdodHMuc2V0KGlucHV0LCBjb250ZW50SGVpZ2h0KTtcblxuXHRcdFx0aWYgKHRlbXBsYXRlRGF0YS5pbnB1dFdpZGdldEhlaWdodCAhPT0gY29udGVudEhlaWdodCkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUhlaWdodChpbnB1dCwgY29udGVudEhlaWdodCArIDEwKTtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmlucHV0V2lkZ2V0SGVpZ2h0ID0gY29udGVudEhlaWdodDtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmlucHV0V2lkZ2V0LmxheW91dCgpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBzdGFydExpc3RlbmluZ0NvbnRlbnRIZWlnaHRDaGFuZ2UgPSAoKSA9PiB7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0ZW1wbGF0ZURhdGEuaW5wdXRXaWRnZXQub25EaWRDaGFuZ2VDb250ZW50SGVpZ2h0KG9uRGlkQ2hhbmdlQ29udGVudEhlaWdodCkpO1xuXHRcdFx0b25EaWRDaGFuZ2VDb250ZW50SGVpZ2h0KCk7XG5cdFx0fTtcblxuXHRcdC8vIFNldHVwIGhlaWdodCBjaGFuZ2UgbGlzdGVuZXIgb24gbmV4dCB0aWNrXG5cdFx0ZGlzcG9zYWJsZVRpbWVvdXQoc3RhcnRMaXN0ZW5pbmdDb250ZW50SGVpZ2h0Q2hhbmdlLCAwLCB0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzKTtcblxuXHRcdC8vIExheW91dCB0aGUgZWRpdG9yIHdoZW5ldmVyIHRoZSBvdXRlciBsYXlvdXQgaGFwcGVuc1xuXHRcdGNvbnN0IGxheW91dEVkaXRvciA9ICgpID0+IHRlbXBsYXRlRGF0YS5pbnB1dFdpZGdldC5sYXlvdXQoKTtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0aGlzLm91dGVyTGF5b3V0Lm9uRGlkQ2hhbmdlKGxheW91dEVkaXRvcikpO1xuXHRcdGxheW91dEVkaXRvcigpO1xuXHR9XG5cblx0cmVuZGVyQ29tcHJlc3NlZEVsZW1lbnRzKCk6IHZvaWQge1xuXHRcdHRocm93IG5ldyBFcnJvcignU2hvdWxkIG5ldmVyIGhhcHBlbiBzaW5jZSBub2RlIGlzIGluY29tcHJlc3NpYmxlJyk7XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChncm91cDogSVRyZWVOb2RlPElTQ01JbnB1dCwgRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlOiBJbnB1dFRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJbnB1dFRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLnRlbXBsYXRlRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH1cblxuXHRnZXRIZWlnaHQoaW5wdXQ6IElTQ01JbnB1dCk6IG51bWJlciB7XG5cdFx0cmV0dXJuICh0aGlzLmNvbnRlbnRIZWlnaHRzLmdldChpbnB1dCkgPz8gSW5wdXRSZW5kZXJlci5ERUZBVUxUX0hFSUdIVCkgKyAxMDtcblx0fVxuXG5cdGdldFJlbmRlcmVkSW5wdXRXaWRnZXQoaW5wdXQ6IElTQ01JbnB1dCk6IFNDTUlucHV0V2lkZ2V0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5pbnB1dFdpZGdldHMuZ2V0KGlucHV0KTtcblx0fVxuXG5cdGdldEZvY3VzZWRJbnB1dCgpOiBJU0NNSW5wdXQgfCB1bmRlZmluZWQge1xuXHRcdGZvciAoY29uc3QgW2lucHV0LCBpbnB1dFdpZGdldF0gb2YgdGhpcy5pbnB1dFdpZGdldHMpIHtcblx0XHRcdGlmIChpbnB1dFdpZGdldC5oYXNGb2N1cygpKSB7XG5cdFx0XHRcdHJldHVybiBpbnB1dDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Y2xlYXJWYWxpZGF0aW9uKCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgWywgaW5wdXRXaWRnZXRdIG9mIHRoaXMuaW5wdXRXaWRnZXRzKSB7XG5cdFx0XHRpbnB1dFdpZGdldC5jbGVhclZhbGlkYXRpb24oKTtcblx0XHR9XG5cdH1cbn1cblxuaW50ZXJmYWNlIFJlc291cmNlR3JvdXBUZW1wbGF0ZSB7XG5cdHJlYWRvbmx5IG5hbWU6IEhUTUxFbGVtZW50O1xuXHRyZWFkb25seSBjb3VudDogQ291bnRCYWRnZTtcblx0cmVhZG9ubHkgYWN0aW9uQmFyOiBXb3JrYmVuY2hUb29sQmFyO1xuXHRyZWFkb25seSBlbGVtZW50RGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0cmVhZG9ubHkgZGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlO1xufVxuXG5jbGFzcyBSZXNvdXJjZUdyb3VwUmVuZGVyZXIgaW1wbGVtZW50cyBJQ29tcHJlc3NpYmxlVHJlZVJlbmRlcmVyPElTQ01SZXNvdXJjZUdyb3VwLCBGdXp6eVNjb3JlLCBSZXNvdXJjZUdyb3VwVGVtcGxhdGU+IHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgVEVNUExBVEVfSUQgPSAncmVzb3VyY2UgZ3JvdXAnO1xuXHRnZXQgdGVtcGxhdGVJZCgpOiBzdHJpbmcgeyByZXR1cm4gUmVzb3VyY2VHcm91cFJlbmRlcmVyLlRFTVBMQVRFX0lEOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiBJQWN0aW9uVmlld0l0ZW1Qcm92aWRlcixcblx0XHRwcml2YXRlIGFjdGlvblJ1bm5lcjogQWN0aW9uUnVubmVyLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgcHJpdmF0ZSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJU0NNVmlld1NlcnZpY2UgcHJpdmF0ZSBzY21WaWV3U2VydmljZTogSVNDTVZpZXdTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlXG5cdCkgeyB9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IFJlc291cmNlR3JvdXBUZW1wbGF0ZSB7XG5cdFx0Ly8gaGFja1xuXHRcdChjb250YWluZXIucGFyZW50RWxlbWVudCEucGFyZW50RWxlbWVudCEucXVlcnlTZWxlY3RvcignLm1vbmFjby10bC10d2lzdGllJykhIGFzIEhUTUxFbGVtZW50KS5jbGFzc0xpc3QuYWRkKCdmb3JjZS10d2lzdGllJyk7XG5cblx0XHRjb25zdCBlbGVtZW50ID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnLnJlc291cmNlLWdyb3VwJykpO1xuXHRcdGNvbnN0IG5hbWUgPSBhcHBlbmQoZWxlbWVudCwgJCgnLm5hbWUnKSk7XG5cdFx0Y29uc3QgYWN0aW9uc0NvbnRhaW5lciA9IGFwcGVuZChlbGVtZW50LCAkKCcuYWN0aW9ucycpKTtcblx0XHRjb25zdCBhY3Rpb25CYXIgPSBuZXcgV29ya2JlbmNoVG9vbEJhcihhY3Rpb25zQ29udGFpbmVyLCB7XG5cdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiB0aGlzLmFjdGlvblZpZXdJdGVtUHJvdmlkZXIsXG5cdFx0XHRhY3Rpb25SdW5uZXI6IHRoaXMuYWN0aW9uUnVubmVyXG5cdFx0fSwgdGhpcy5tZW51U2VydmljZSwgdGhpcy5jb250ZXh0S2V5U2VydmljZSwgdGhpcy5jb250ZXh0TWVudVNlcnZpY2UsIHRoaXMua2V5YmluZGluZ1NlcnZpY2UsIHRoaXMuY29tbWFuZFNlcnZpY2UsIHRoaXMudGVsZW1ldHJ5U2VydmljZSk7XG5cdFx0Y29uc3QgY291bnRDb250YWluZXIgPSBhcHBlbmQoZWxlbWVudCwgJCgnLmNvdW50JykpO1xuXHRcdGNvbnN0IGNvdW50ID0gbmV3IENvdW50QmFkZ2UoY291bnRDb250YWluZXIsIHt9LCBkZWZhdWx0Q291bnRCYWRnZVN0eWxlcyk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBjb21iaW5lZERpc3Bvc2FibGUoYWN0aW9uQmFyLCBjb3VudCk7XG5cblx0XHRyZXR1cm4geyBuYW1lLCBjb3VudCwgYWN0aW9uQmFyLCBlbGVtZW50RGlzcG9zYWJsZXM6IG5ldyBEaXNwb3NhYmxlU3RvcmUoKSwgZGlzcG9zYWJsZXMgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQobm9kZTogSVRyZWVOb2RlPElTQ01SZXNvdXJjZUdyb3VwLCBGdXp6eVNjb3JlPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGU6IFJlc291cmNlR3JvdXBUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdGNvbnN0IGdyb3VwID0gbm9kZS5lbGVtZW50O1xuXHRcdHRlbXBsYXRlLm5hbWUudGV4dENvbnRlbnQgPSBncm91cC5sYWJlbDtcblx0XHR0ZW1wbGF0ZS5jb3VudC5zZXRDb3VudChncm91cC5yZXNvdXJjZXMubGVuZ3RoKTtcblxuXHRcdGNvbnN0IG1lbnVzID0gdGhpcy5zY21WaWV3U2VydmljZS5tZW51cy5nZXRSZXBvc2l0b3J5TWVudXMoZ3JvdXAucHJvdmlkZXIpO1xuXHRcdHRlbXBsYXRlLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQoY29ubmVjdFByaW1hcnlNZW51KG1lbnVzLmdldFJlc291cmNlR3JvdXBNZW51KGdyb3VwKSwgcHJpbWFyeSA9PiB7XG5cdFx0XHR0ZW1wbGF0ZS5hY3Rpb25CYXIuc2V0QWN0aW9ucyhwcmltYXJ5KTtcblx0XHR9LCAnaW5saW5lJykpO1xuXHRcdHRlbXBsYXRlLmFjdGlvbkJhci5jb250ZXh0ID0gZ3JvdXA7XG5cdH1cblxuXHRyZW5kZXJDb21wcmVzc2VkRWxlbWVudHMobm9kZTogSVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8SVNDTVJlc291cmNlR3JvdXA+LCBGdXp6eVNjb3JlPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBSZXNvdXJjZUdyb3VwVGVtcGxhdGUsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdTaG91bGQgbmV2ZXIgaGFwcGVuIHNpbmNlIG5vZGUgaXMgaW5jb21wcmVzc2libGUnKTtcblx0fVxuXG5cdGRpc3Bvc2VFbGVtZW50KGdyb3VwOiBJVHJlZU5vZGU8SVNDTVJlc291cmNlR3JvdXAsIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZTogUmVzb3VyY2VHcm91cFRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGU6IFJlc291cmNlR3JvdXBUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlLmVsZW1lbnREaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGVtcGxhdGUuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmludGVyZmFjZSBSZXNvdXJjZVRlbXBsYXRlIHtcblx0ZWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdG5hbWU6IEhUTUxFbGVtZW50O1xuXHRmaWxlTGFiZWw6IElSZXNvdXJjZUxhYmVsO1xuXHRkZWNvcmF0aW9uSWNvbjogSFRNTEVsZW1lbnQ7XG5cdGFjdGlvbkJhcjogV29ya2JlbmNoVG9vbEJhcjtcblx0YWN0aW9uQmFyTWVudTogSU1lbnUgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGFjdGlvbkJhck1lbnVMaXN0ZW5lcjogTXV0YWJsZURpc3Bvc2FibGU8SURpc3Bvc2FibGU+O1xuXHRyZWFkb25seSBlbGVtZW50RGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0cmVhZG9ubHkgZGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlO1xufVxuXG5pbnRlcmZhY2UgUmVuZGVyZWRSZXNvdXJjZURhdGEge1xuXHRyZWFkb25seSB0b29sdGlwOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHVyaTogVVJJO1xuXHRyZWFkb25seSBmaWxlTGFiZWxPcHRpb25zOiBQYXJ0aWFsPElGaWxlTGFiZWxPcHRpb25zPjtcblx0cmVhZG9ubHkgaWNvblJlc291cmNlOiBJU0NNUmVzb3VyY2UgfCB1bmRlZmluZWQ7XG59XG5cbmNsYXNzIFJlcG9zaXRvcnlQYW5lQWN0aW9uUnVubmVyIGV4dGVuZHMgQWN0aW9uUnVubmVyIHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIGdldFNlbGVjdGVkUmVzb3VyY2VzOiAoKSA9PiAoSVNDTVJlc291cmNlR3JvdXAgfCBJU0NNUmVzb3VyY2UgfCBJUmVzb3VyY2VOb2RlPElTQ01SZXNvdXJjZSwgSVNDTVJlc291cmNlR3JvdXA+KVtdKSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyBydW5BY3Rpb24oYWN0aW9uOiBJQWN0aW9uLCBjb250ZXh0OiBJU0NNUmVzb3VyY2VHcm91cCB8IElTQ01SZXNvdXJjZSB8IElSZXNvdXJjZU5vZGU8SVNDTVJlc291cmNlLCBJU0NNUmVzb3VyY2VHcm91cD4pOiBQcm9taXNlPGFueT4ge1xuXHRcdGlmICghKGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uKSkge1xuXHRcdFx0cmV0dXJuIHN1cGVyLnJ1bkFjdGlvbihhY3Rpb24sIGNvbnRleHQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlzQ29udGV4dFJlc291cmNlR3JvdXAgPSBpc1NDTVJlc291cmNlR3JvdXAoY29udGV4dCk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gdGhpcy5nZXRTZWxlY3RlZFJlc291cmNlcygpLmZpbHRlcihyID0+IGlzU0NNUmVzb3VyY2VHcm91cChyKSA9PT0gaXNDb250ZXh0UmVzb3VyY2VHcm91cCk7XG5cblx0XHRjb25zdCBjb250ZXh0SXNTZWxlY3RlZCA9IHNlbGVjdGlvbi5zb21lKHMgPT4gcyA9PT0gY29udGV4dCk7XG5cdFx0Y29uc3QgYWN0dWFsQ29udGV4dCA9IGNvbnRleHRJc1NlbGVjdGVkID8gc2VsZWN0aW9uIDogW2NvbnRleHRdO1xuXHRcdGNvbnN0IGFyZ3MgPSBhY3R1YWxDb250ZXh0Lm1hcChlID0+IFJlc291cmNlVHJlZS5pc1Jlc291cmNlTm9kZShlKSA/IFJlc291cmNlVHJlZS5jb2xsZWN0KGUpIDogW2VdKS5mbGF0KCk7XG5cdFx0YXdhaXQgYWN0aW9uLnJ1biguLi5hcmdzKTtcblx0fVxufVxuXG5jbGFzcyBSZXNvdXJjZVJlbmRlcmVyIGltcGxlbWVudHMgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlcjxJU0NNUmVzb3VyY2UgfCBJUmVzb3VyY2VOb2RlPElTQ01SZXNvdXJjZSwgSVNDTVJlc291cmNlR3JvdXA+LCBGdXp6eVNjb3JlIHwgTGFiZWxGdXp6eVNjb3JlLCBSZXNvdXJjZVRlbXBsYXRlPiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IFRFTVBMQVRFX0lEID0gJ3Jlc291cmNlJztcblx0Z2V0IHRlbXBsYXRlSWQoKTogc3RyaW5nIHsgcmV0dXJuIFJlc291cmNlUmVuZGVyZXIuVEVNUExBVEVfSUQ7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlbmRlcmVkUmVzb3VyY2VzID0gbmV3IE1hcDxSZXNvdXJjZVRlbXBsYXRlLCBSZW5kZXJlZFJlc291cmNlRGF0YT4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHZpZXdNb2RlOiAoKSA9PiBWaWV3TW9kZSxcblx0XHRwcml2YXRlIGxhYmVsczogUmVzb3VyY2VMYWJlbHMsXG5cdFx0cHJpdmF0ZSBhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiBJQWN0aW9uVmlld0l0ZW1Qcm92aWRlcixcblx0XHRwcml2YXRlIGFjdGlvblJ1bm5lcjogQWN0aW9uUnVubmVyLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgcHJpdmF0ZSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJU0NNVmlld1NlcnZpY2UgcHJpdmF0ZSBzY21WaWV3U2VydmljZTogSVNDTVZpZXdTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlXG5cdCkge1xuXHRcdHRoZW1lU2VydmljZS5vbkRpZENvbG9yVGhlbWVDaGFuZ2UodGhpcy5vbkRpZENvbG9yVGhlbWVDaGFuZ2UsIHRoaXMsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IFJlc291cmNlVGVtcGxhdGUge1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBhcHBlbmQoY29udGFpbmVyLCAkKCcucmVzb3VyY2UnKSk7XG5cdFx0Y29uc3QgbmFtZSA9IGFwcGVuZChlbGVtZW50LCAkKCcubmFtZScpKTtcblx0XHRjb25zdCBmaWxlTGFiZWwgPSB0aGlzLmxhYmVscy5jcmVhdGUobmFtZSwgeyBzdXBwb3J0RGVzY3JpcHRpb25IaWdobGlnaHRzOiB0cnVlLCBzdXBwb3J0SGlnaGxpZ2h0czogdHJ1ZSB9KTtcblx0XHRjb25zdCBhY3Rpb25zQ29udGFpbmVyID0gYXBwZW5kKGZpbGVMYWJlbC5lbGVtZW50LCAkKCcuYWN0aW9ucycpKTtcblx0XHRjb25zdCBhY3Rpb25CYXIgPSBuZXcgV29ya2JlbmNoVG9vbEJhcihhY3Rpb25zQ29udGFpbmVyLCB7XG5cdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiB0aGlzLmFjdGlvblZpZXdJdGVtUHJvdmlkZXIsXG5cdFx0XHRhY3Rpb25SdW5uZXI6IHRoaXMuYWN0aW9uUnVubmVyXG5cdFx0fSwgdGhpcy5tZW51U2VydmljZSwgdGhpcy5jb250ZXh0S2V5U2VydmljZSwgdGhpcy5jb250ZXh0TWVudVNlcnZpY2UsIHRoaXMua2V5YmluZGluZ1NlcnZpY2UsIHRoaXMuY29tbWFuZFNlcnZpY2UsIHRoaXMudGVsZW1ldHJ5U2VydmljZSk7XG5cblx0XHRjb25zdCBkZWNvcmF0aW9uSWNvbiA9IGFwcGVuZChlbGVtZW50LCAkKCcuZGVjb3JhdGlvbi1pY29uJykpO1xuXHRcdGNvbnN0IGFjdGlvbkJhck1lbnVMaXN0ZW5lciA9IG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJRGlzcG9zYWJsZT4oKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IGNvbWJpbmVkRGlzcG9zYWJsZShhY3Rpb25CYXIsIGZpbGVMYWJlbCwgYWN0aW9uQmFyTWVudUxpc3RlbmVyKTtcblxuXHRcdHJldHVybiB7IGVsZW1lbnQsIG5hbWUsIGZpbGVMYWJlbCwgZGVjb3JhdGlvbkljb24sIGFjdGlvbkJhciwgYWN0aW9uQmFyTWVudTogdW5kZWZpbmVkLCBhY3Rpb25CYXJNZW51TGlzdGVuZXIsIGVsZW1lbnREaXNwb3NhYmxlczogbmV3IERpc3Bvc2FibGVTdG9yZSgpLCBkaXNwb3NhYmxlcyB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8SVNDTVJlc291cmNlLCBGdXp6eVNjb3JlIHwgTGFiZWxGdXp6eVNjb3JlPiB8IElUcmVlTm9kZTxJU0NNUmVzb3VyY2UgfCBJUmVzb3VyY2VOb2RlPElTQ01SZXNvdXJjZSwgSVNDTVJlc291cmNlR3JvdXA+LCBGdXp6eVNjb3JlIHwgTGFiZWxGdXp6eVNjb3JlPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGU6IFJlc291cmNlVGVtcGxhdGUpOiB2b2lkIHtcblx0XHRjb25zdCByZXNvdXJjZU9yRm9sZGVyID0gbm9kZS5lbGVtZW50O1xuXHRcdGNvbnN0IGljb25SZXNvdXJjZSA9IFJlc291cmNlVHJlZS5pc1Jlc291cmNlTm9kZShyZXNvdXJjZU9yRm9sZGVyKSA/IHJlc291cmNlT3JGb2xkZXIuZWxlbWVudCA6IHJlc291cmNlT3JGb2xkZXI7XG5cdFx0Y29uc3QgdXJpID0gUmVzb3VyY2VUcmVlLmlzUmVzb3VyY2VOb2RlKHJlc291cmNlT3JGb2xkZXIpID8gcmVzb3VyY2VPckZvbGRlci51cmkgOiByZXNvdXJjZU9yRm9sZGVyLnNvdXJjZVVyaTtcblx0XHRjb25zdCBmaWxlS2luZCA9IFJlc291cmNlVHJlZS5pc1Jlc291cmNlTm9kZShyZXNvdXJjZU9yRm9sZGVyKSA/IEZpbGVLaW5kLkZPTERFUiA6IEZpbGVLaW5kLkZJTEU7XG5cdFx0Y29uc3QgdG9vbHRpcCA9ICFSZXNvdXJjZVRyZWUuaXNSZXNvdXJjZU5vZGUocmVzb3VyY2VPckZvbGRlcikgJiYgcmVzb3VyY2VPckZvbGRlci5kZWNvcmF0aW9ucy50b29sdGlwIHx8ICcnO1xuXHRcdGNvbnN0IGhpZGVQYXRoID0gdGhpcy52aWV3TW9kZSgpID09PSBWaWV3TW9kZS5UcmVlO1xuXG5cdFx0bGV0IG1hdGNoZXM6IElNYXRjaFtdIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBkZXNjcmlwdGlvbk1hdGNoZXM6IElNYXRjaFtdIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBzdHJpa2V0aHJvdWdoOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXG5cdFx0aWYgKFJlc291cmNlVHJlZS5pc1Jlc291cmNlTm9kZShyZXNvdXJjZU9yRm9sZGVyKSkge1xuXHRcdFx0aWYgKHJlc291cmNlT3JGb2xkZXIuZWxlbWVudCkge1xuXHRcdFx0XHRjb25zdCBtZW51cyA9IHRoaXMuc2NtVmlld1NlcnZpY2UubWVudXMuZ2V0UmVwb3NpdG9yeU1lbnVzKHJlc291cmNlT3JGb2xkZXIuZWxlbWVudC5yZXNvdXJjZUdyb3VwLnByb3ZpZGVyKTtcblx0XHRcdFx0dGhpcy5fcmVuZGVyQWN0aW9uQmFyKHRlbXBsYXRlLCByZXNvdXJjZU9yRm9sZGVyLCBtZW51cy5nZXRSZXNvdXJjZU1lbnUocmVzb3VyY2VPckZvbGRlci5lbGVtZW50KSk7XG5cblx0XHRcdFx0dGVtcGxhdGUuZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdmYWRlZCcsIHJlc291cmNlT3JGb2xkZXIuZWxlbWVudC5kZWNvcmF0aW9ucy5mYWRlZCk7XG5cdFx0XHRcdHN0cmlrZXRocm91Z2ggPSByZXNvdXJjZU9yRm9sZGVyLmVsZW1lbnQuZGVjb3JhdGlvbnMuc3RyaWtlVGhyb3VnaDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IG1lbnVzID0gdGhpcy5zY21WaWV3U2VydmljZS5tZW51cy5nZXRSZXBvc2l0b3J5TWVudXMocmVzb3VyY2VPckZvbGRlci5jb250ZXh0LnByb3ZpZGVyKTtcblx0XHRcdFx0dGhpcy5fcmVuZGVyQWN0aW9uQmFyKHRlbXBsYXRlLCByZXNvdXJjZU9yRm9sZGVyLCBtZW51cy5nZXRSZXNvdXJjZUZvbGRlck1lbnUocmVzb3VyY2VPckZvbGRlci5jb250ZXh0KSk7XG5cblx0XHRcdFx0bWF0Y2hlcyA9IGNyZWF0ZU1hdGNoZXMobm9kZS5maWx0ZXJEYXRhIGFzIEZ1enp5U2NvcmUgfCB1bmRlZmluZWQpO1xuXHRcdFx0XHR0ZW1wbGF0ZS5lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2ZhZGVkJyk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IG1lbnVzID0gdGhpcy5zY21WaWV3U2VydmljZS5tZW51cy5nZXRSZXBvc2l0b3J5TWVudXMocmVzb3VyY2VPckZvbGRlci5yZXNvdXJjZUdyb3VwLnByb3ZpZGVyKTtcblx0XHRcdHRoaXMuX3JlbmRlckFjdGlvbkJhcih0ZW1wbGF0ZSwgcmVzb3VyY2VPckZvbGRlciwgbWVudXMuZ2V0UmVzb3VyY2VNZW51KHJlc291cmNlT3JGb2xkZXIpKTtcblxuXHRcdFx0W21hdGNoZXMsIGRlc2NyaXB0aW9uTWF0Y2hlc10gPSBwcm9jZXNzUmVzb3VyY2VGaWx0ZXJEYXRhKHVyaSwgbm9kZS5maWx0ZXJEYXRhKTtcblx0XHRcdHRlbXBsYXRlLmVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnZmFkZWQnLCByZXNvdXJjZU9yRm9sZGVyLmRlY29yYXRpb25zLmZhZGVkKTtcblx0XHRcdHN0cmlrZXRocm91Z2ggPSByZXNvdXJjZU9yRm9sZGVyLmRlY29yYXRpb25zLnN0cmlrZVRocm91Z2g7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVuZGVyZWREYXRhOiBSZW5kZXJlZFJlc291cmNlRGF0YSA9IHtcblx0XHRcdHRvb2x0aXAsIHVyaSwgZmlsZUxhYmVsT3B0aW9uczogeyBoaWRlUGF0aCwgZmlsZUtpbmQsIG1hdGNoZXMsIGRlc2NyaXB0aW9uTWF0Y2hlcywgc3RyaWtldGhyb3VnaCB9LCBpY29uUmVzb3VyY2Vcblx0XHR9O1xuXG5cdFx0dGhpcy5yZW5kZXJJY29uKHRlbXBsYXRlLCByZW5kZXJlZERhdGEpO1xuXG5cdFx0dGhpcy5yZW5kZXJlZFJlc291cmNlcy5zZXQodGVtcGxhdGUsIHJlbmRlcmVkRGF0YSk7XG5cdFx0dGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5yZW5kZXJlZFJlc291cmNlcy5kZWxldGUodGVtcGxhdGUpKSk7XG5cblx0XHR0ZW1wbGF0ZS5lbGVtZW50LnNldEF0dHJpYnV0ZSgnZGF0YS10b29sdGlwJywgdG9vbHRpcCk7XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChyZXNvdXJjZTogSVRyZWVOb2RlPElTQ01SZXNvdXJjZSwgRnV6enlTY29yZSB8IExhYmVsRnV6enlTY29yZT4gfCBJVHJlZU5vZGU8SVJlc291cmNlTm9kZTxJU0NNUmVzb3VyY2UsIElTQ01SZXNvdXJjZUdyb3VwPiwgRnV6enlTY29yZSB8IExhYmVsRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlOiBSZXNvdXJjZVRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH1cblxuXHRyZW5kZXJDb21wcmVzc2VkRWxlbWVudHMobm9kZTogSVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8SVNDTVJlc291cmNlPiB8IElDb21wcmVzc2VkVHJlZU5vZGU8SVJlc291cmNlTm9kZTxJU0NNUmVzb3VyY2UsIElTQ01SZXNvdXJjZUdyb3VwPj4sIEZ1enp5U2NvcmUgfCBMYWJlbEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZTogUmVzb3VyY2VUZW1wbGF0ZSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCBjb21wcmVzc2VkID0gbm9kZS5lbGVtZW50IGFzIElDb21wcmVzc2VkVHJlZU5vZGU8SVJlc291cmNlTm9kZTxJU0NNUmVzb3VyY2UsIElTQ01SZXNvdXJjZUdyb3VwPj47XG5cdFx0Y29uc3QgZm9sZGVyID0gY29tcHJlc3NlZC5lbGVtZW50c1tjb21wcmVzc2VkLmVsZW1lbnRzLmxlbmd0aCAtIDFdO1xuXG5cdFx0Y29uc3QgbGFiZWwgPSBjb21wcmVzc2VkLmVsZW1lbnRzLm1hcChlID0+IGUubmFtZSk7XG5cdFx0Y29uc3QgZmlsZUtpbmQgPSBGaWxlS2luZC5GT0xERVI7XG5cblx0XHRjb25zdCBtYXRjaGVzID0gY3JlYXRlTWF0Y2hlcyhub2RlLmZpbHRlckRhdGEgYXMgRnV6enlTY29yZSB8IHVuZGVmaW5lZCk7XG5cdFx0dGVtcGxhdGUuZmlsZUxhYmVsLnNldFJlc291cmNlKHsgcmVzb3VyY2U6IGZvbGRlci51cmksIG5hbWU6IGxhYmVsIH0sIHtcblx0XHRcdGZpbGVEZWNvcmF0aW9uczogeyBjb2xvcnM6IGZhbHNlLCBiYWRnZXM6IHRydWUgfSxcblx0XHRcdGZpbGVLaW5kLFxuXHRcdFx0bWF0Y2hlcyxcblx0XHRcdHNlcGFyYXRvcjogdGhpcy5sYWJlbFNlcnZpY2UuZ2V0U2VwYXJhdG9yKGZvbGRlci51cmkuc2NoZW1lKVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgbWVudXMgPSB0aGlzLnNjbVZpZXdTZXJ2aWNlLm1lbnVzLmdldFJlcG9zaXRvcnlNZW51cyhmb2xkZXIuY29udGV4dC5wcm92aWRlcik7XG5cdFx0dGhpcy5fcmVuZGVyQWN0aW9uQmFyKHRlbXBsYXRlLCBmb2xkZXIsIG1lbnVzLmdldFJlc291cmNlRm9sZGVyTWVudShmb2xkZXIuY29udGV4dCkpO1xuXG5cdFx0dGVtcGxhdGUubmFtZS5jbGFzc0xpc3QucmVtb3ZlKCdzdHJpa2UtdGhyb3VnaCcpO1xuXHRcdHRlbXBsYXRlLmVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnZmFkZWQnKTtcblx0XHR0ZW1wbGF0ZS5kZWNvcmF0aW9uSWNvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdHRlbXBsYXRlLmRlY29yYXRpb25JY29uLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9ICcnO1xuXG5cdFx0dGVtcGxhdGUuZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2RhdGEtdG9vbHRpcCcsICcnKTtcblx0fVxuXG5cdGRpc3Bvc2VDb21wcmVzc2VkRWxlbWVudHMobm9kZTogSVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8SVNDTVJlc291cmNlPiB8IElDb21wcmVzc2VkVHJlZU5vZGU8SVJlc291cmNlTm9kZTxJU0NNUmVzb3VyY2UsIElTQ01SZXNvdXJjZUdyb3VwPj4sIEZ1enp5U2NvcmUgfCBMYWJlbEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZTogUmVzb3VyY2VUZW1wbGF0ZSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZS5lbGVtZW50RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZTogUmVzb3VyY2VUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlLmVsZW1lbnREaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGVtcGxhdGUuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyQWN0aW9uQmFyKHRlbXBsYXRlOiBSZXNvdXJjZVRlbXBsYXRlLCByZXNvdXJjZU9yRm9sZGVyOiBJU0NNUmVzb3VyY2UgfCBJUmVzb3VyY2VOb2RlPElTQ01SZXNvdXJjZSwgSVNDTVJlc291cmNlR3JvdXA+LCBtZW51OiBJTWVudSk6IHZvaWQge1xuXHRcdGlmICghdGVtcGxhdGUuYWN0aW9uQmFyTWVudSB8fCB0ZW1wbGF0ZS5hY3Rpb25CYXJNZW51ICE9PSBtZW51KSB7XG5cdFx0XHR0ZW1wbGF0ZS5hY3Rpb25CYXJNZW51ID0gbWVudTtcblx0XHRcdHRlbXBsYXRlLmFjdGlvbkJhck1lbnVMaXN0ZW5lci52YWx1ZSA9IGNvbm5lY3RQcmltYXJ5TWVudShtZW51LCBwcmltYXJ5ID0+IHtcblx0XHRcdFx0dGVtcGxhdGUuYWN0aW9uQmFyLnNldEFjdGlvbnMocHJpbWFyeSk7XG5cdFx0XHR9LCAnaW5saW5lJyk7XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGUuYWN0aW9uQmFyLmNvbnRleHQgPSByZXNvdXJjZU9yRm9sZGVyO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENvbG9yVGhlbWVDaGFuZ2UoKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBbdGVtcGxhdGUsIGRhdGFdIG9mIHRoaXMucmVuZGVyZWRSZXNvdXJjZXMpIHtcblx0XHRcdHRoaXMucmVuZGVySWNvbih0ZW1wbGF0ZSwgZGF0YSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJJY29uKHRlbXBsYXRlOiBSZXNvdXJjZVRlbXBsYXRlLCBkYXRhOiBSZW5kZXJlZFJlc291cmNlRGF0YSk6IHZvaWQge1xuXHRcdGNvbnN0IHRoZW1lID0gdGhpcy50aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpO1xuXHRcdGNvbnN0IGljb24gPSB0aGVtZS50eXBlID09PSBDb2xvclNjaGVtZS5MSUdIVCA/IGRhdGEuaWNvblJlc291cmNlPy5kZWNvcmF0aW9ucy5pY29uIDogZGF0YS5pY29uUmVzb3VyY2U/LmRlY29yYXRpb25zLmljb25EYXJrO1xuXG5cdFx0dGVtcGxhdGUuZmlsZUxhYmVsLnNldEZpbGUoZGF0YS51cmksIHtcblx0XHRcdC4uLmRhdGEuZmlsZUxhYmVsT3B0aW9ucyxcblx0XHRcdGZpbGVEZWNvcmF0aW9uczogeyBjb2xvcnM6IGZhbHNlLCBiYWRnZXM6ICFpY29uIH0sXG5cdFx0fSk7XG5cblx0XHRpZiAoaWNvbikge1xuXHRcdFx0aWYgKFRoZW1lSWNvbi5pc1RoZW1lSWNvbihpY29uKSkge1xuXHRcdFx0XHR0ZW1wbGF0ZS5kZWNvcmF0aW9uSWNvbi5jbGFzc05hbWUgPSBgZGVjb3JhdGlvbi1pY29uICR7VGhlbWVJY29uLmFzQ2xhc3NOYW1lKGljb24pfWA7XG5cdFx0XHRcdGlmIChpY29uLmNvbG9yKSB7XG5cdFx0XHRcdFx0dGVtcGxhdGUuZGVjb3JhdGlvbkljb24uc3R5bGUuY29sb3IgPSB0aGVtZS5nZXRDb2xvcihpY29uLmNvbG9yLmlkKT8udG9TdHJpbmcoKSA/PyAnJztcblx0XHRcdFx0fVxuXHRcdFx0XHR0ZW1wbGF0ZS5kZWNvcmF0aW9uSWNvbi5zdHlsZS5kaXNwbGF5ID0gJyc7XG5cdFx0XHRcdHRlbXBsYXRlLmRlY29yYXRpb25JY29uLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9ICcnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGVtcGxhdGUuZGVjb3JhdGlvbkljb24uY2xhc3NOYW1lID0gJ2RlY29yYXRpb24taWNvbic7XG5cdFx0XHRcdHRlbXBsYXRlLmRlY29yYXRpb25JY29uLnN0eWxlLmNvbG9yID0gJyc7XG5cdFx0XHRcdHRlbXBsYXRlLmRlY29yYXRpb25JY29uLnN0eWxlLmRpc3BsYXkgPSAnJztcblx0XHRcdFx0dGVtcGxhdGUuZGVjb3JhdGlvbkljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gYXNDU1NVcmwoaWNvbik7XG5cdFx0XHR9XG5cdFx0XHR0ZW1wbGF0ZS5kZWNvcmF0aW9uSWNvbi50aXRsZSA9IGRhdGEudG9vbHRpcDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGVtcGxhdGUuZGVjb3JhdGlvbkljb24uY2xhc3NOYW1lID0gJ2RlY29yYXRpb24taWNvbic7XG5cdFx0XHR0ZW1wbGF0ZS5kZWNvcmF0aW9uSWNvbi5zdHlsZS5jb2xvciA9ICcnO1xuXHRcdFx0dGVtcGxhdGUuZGVjb3JhdGlvbkljb24uc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdHRlbXBsYXRlLmRlY29yYXRpb25JY29uLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9ICcnO1xuXHRcdFx0dGVtcGxhdGUuZGVjb3JhdGlvbkljb24udGl0bGUgPSAnJztcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIExpc3REZWxlZ2F0ZSBpbXBsZW1lbnRzIElMaXN0VmlydHVhbERlbGVnYXRlPFRyZWVFbGVtZW50PiB7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBpbnB1dFJlbmRlcmVyOiBJbnB1dFJlbmRlcmVyKSB7IH1cblxuXHRnZXRIZWlnaHQoZWxlbWVudDogVHJlZUVsZW1lbnQpIHtcblx0XHRpZiAoaXNTQ01JbnB1dChlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuaW5wdXRSZW5kZXJlci5nZXRIZWlnaHQoZWxlbWVudCk7XG5cdFx0fSBlbHNlIGlmIChpc1NDTUFjdGlvbkJ1dHRvbihlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIEFjdGlvbkJ1dHRvblJlbmRlcmVyLkRFRkFVTFRfSEVJR0hUICsgODtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIDIyO1xuXHRcdH1cblx0fVxuXG5cdGdldFRlbXBsYXRlSWQoZWxlbWVudDogVHJlZUVsZW1lbnQpIHtcblx0XHRpZiAoaXNTQ01SZXBvc2l0b3J5KGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gUmVwb3NpdG9yeVJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXHRcdH0gZWxzZSBpZiAoaXNTQ01JbnB1dChlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIElucHV0UmVuZGVyZXIuVEVNUExBVEVfSUQ7XG5cdFx0fSBlbHNlIGlmIChpc1NDTUFjdGlvbkJ1dHRvbihlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIEFjdGlvbkJ1dHRvblJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXHRcdH0gZWxzZSBpZiAoaXNTQ01SZXNvdXJjZUdyb3VwKGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gUmVzb3VyY2VHcm91cFJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXHRcdH0gZWxzZSBpZiAoaXNTQ01SZXNvdXJjZShlbGVtZW50KSB8fCBpc1NDTVJlc291cmNlTm9kZShlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIFJlc291cmNlUmVuZGVyZXIuVEVNUExBVEVfSUQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbGVtZW50Jyk7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIFNDTVRyZWVDb21wcmVzc2lvbkRlbGVnYXRlIGltcGxlbWVudHMgSVRyZWVDb21wcmVzc2lvbkRlbGVnYXRlPFRyZWVFbGVtZW50PiB7XG5cblx0aXNJbmNvbXByZXNzaWJsZShlbGVtZW50OiBUcmVlRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRcdGlmIChSZXNvdXJjZVRyZWUuaXNSZXNvdXJjZU5vZGUoZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiBlbGVtZW50LmNoaWxkcmVuQ291bnQgPT09IDAgfHwgIWVsZW1lbnQucGFyZW50IHx8ICFlbGVtZW50LnBhcmVudC5wYXJlbnQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxufVxuXG5jbGFzcyBTQ01UcmVlRmlsdGVyIGltcGxlbWVudHMgSVRyZWVGaWx0ZXI8VHJlZUVsZW1lbnQ+IHtcblxuXHRmaWx0ZXIoZWxlbWVudDogVHJlZUVsZW1lbnQpOiBib29sZWFuIHtcblx0XHRpZiAoaXNTQ01SZXNvdXJjZUdyb3VwKGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudC5yZXNvdXJjZXMubGVuZ3RoID4gMCB8fCAhZWxlbWVudC5oaWRlV2hlbkVtcHR5O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNDTVRyZWVTb3J0ZXIgaW1wbGVtZW50cyBJVHJlZVNvcnRlcjxUcmVlRWxlbWVudD4ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdmlld01vZGU6ICgpID0+IFZpZXdNb2RlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdmlld1NvcnRLZXk6ICgpID0+IFZpZXdTb3J0S2V5KSB7IH1cblxuXHRjb21wYXJlKG9uZTogVHJlZUVsZW1lbnQsIG90aGVyOiBUcmVlRWxlbWVudCk6IG51bWJlciB7XG5cdFx0aWYgKGlzU0NNUmVwb3NpdG9yeShvbmUpKSB7XG5cdFx0XHRpZiAoIWlzU0NNUmVwb3NpdG9yeShvdGhlcikpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvbXBhcmlzb24nKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0aWYgKGlzU0NNSW5wdXQob25lKSkge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH0gZWxzZSBpZiAoaXNTQ01JbnB1dChvdGhlcikpIHtcblx0XHRcdHJldHVybiAxO1xuXHRcdH1cblxuXHRcdGlmIChpc1NDTUFjdGlvbkJ1dHRvbihvbmUpKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fSBlbHNlIGlmIChpc1NDTUFjdGlvbkJ1dHRvbihvdGhlcikpIHtcblx0XHRcdHJldHVybiAxO1xuXHRcdH1cblxuXHRcdGlmIChpc1NDTVJlc291cmNlR3JvdXAob25lKSkge1xuXHRcdFx0cmV0dXJuIGlzU0NNUmVzb3VyY2VHcm91cChvdGhlcikgPyAwIDogLTE7XG5cdFx0fVxuXG5cdFx0Ly8gUmVzb3VyY2UgKExpc3QpXG5cdFx0aWYgKHRoaXMudmlld01vZGUoKSA9PT0gVmlld01vZGUuTGlzdCkge1xuXHRcdFx0Ly8gRmlsZU5hbWVcblx0XHRcdGlmICh0aGlzLnZpZXdTb3J0S2V5KCkgPT09IFZpZXdTb3J0S2V5Lk5hbWUpIHtcblx0XHRcdFx0Y29uc3Qgb25lTmFtZSA9IGJhc2VuYW1lKChvbmUgYXMgSVNDTVJlc291cmNlKS5zb3VyY2VVcmkpO1xuXHRcdFx0XHRjb25zdCBvdGhlck5hbWUgPSBiYXNlbmFtZSgob3RoZXIgYXMgSVNDTVJlc291cmNlKS5zb3VyY2VVcmkpO1xuXG5cdFx0XHRcdHJldHVybiBjb21wYXJlRmlsZU5hbWVzKG9uZU5hbWUsIG90aGVyTmFtZSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFN0YXR1c1xuXHRcdFx0aWYgKHRoaXMudmlld1NvcnRLZXkoKSA9PT0gVmlld1NvcnRLZXkuU3RhdHVzKSB7XG5cdFx0XHRcdGNvbnN0IG9uZVRvb2x0aXAgPSAob25lIGFzIElTQ01SZXNvdXJjZSkuZGVjb3JhdGlvbnMudG9vbHRpcCA/PyAnJztcblx0XHRcdFx0Y29uc3Qgb3RoZXJUb29sdGlwID0gKG90aGVyIGFzIElTQ01SZXNvdXJjZSkuZGVjb3JhdGlvbnMudG9vbHRpcCA/PyAnJztcblxuXHRcdFx0XHRpZiAob25lVG9vbHRpcCAhPT0gb3RoZXJUb29sdGlwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGNvbXBhcmUob25lVG9vbHRpcCwgb3RoZXJUb29sdGlwKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBQYXRoIChkZWZhdWx0KVxuXHRcdFx0Y29uc3Qgb25lUGF0aCA9IChvbmUgYXMgSVNDTVJlc291cmNlKS5zb3VyY2VVcmkuZnNQYXRoO1xuXHRcdFx0Y29uc3Qgb3RoZXJQYXRoID0gKG90aGVyIGFzIElTQ01SZXNvdXJjZSkuc291cmNlVXJpLmZzUGF0aDtcblxuXHRcdFx0cmV0dXJuIGNvbXBhcmVQYXRocyhvbmVQYXRoLCBvdGhlclBhdGgpO1xuXHRcdH1cblxuXHRcdC8vIFJlc291cmNlIChUcmVlKVxuXHRcdGNvbnN0IG9uZUlzRGlyZWN0b3J5ID0gUmVzb3VyY2VUcmVlLmlzUmVzb3VyY2VOb2RlKG9uZSk7XG5cdFx0Y29uc3Qgb3RoZXJJc0RpcmVjdG9yeSA9IFJlc291cmNlVHJlZS5pc1Jlc291cmNlTm9kZShvdGhlcik7XG5cblx0XHRpZiAob25lSXNEaXJlY3RvcnkgIT09IG90aGVySXNEaXJlY3RvcnkpIHtcblx0XHRcdHJldHVybiBvbmVJc0RpcmVjdG9yeSA/IC0xIDogMTtcblx0XHR9XG5cblx0XHRjb25zdCBvbmVOYW1lID0gUmVzb3VyY2VUcmVlLmlzUmVzb3VyY2VOb2RlKG9uZSkgPyBvbmUubmFtZSA6IGJhc2VuYW1lKChvbmUgYXMgSVNDTVJlc291cmNlKS5zb3VyY2VVcmkpO1xuXHRcdGNvbnN0IG90aGVyTmFtZSA9IFJlc291cmNlVHJlZS5pc1Jlc291cmNlTm9kZShvdGhlcikgPyBvdGhlci5uYW1lIDogYmFzZW5hbWUoKG90aGVyIGFzIElTQ01SZXNvdXJjZSkuc291cmNlVXJpKTtcblxuXHRcdHJldHVybiBjb21wYXJlRmlsZU5hbWVzKG9uZU5hbWUsIG90aGVyTmFtZSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNDTVRyZWVLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyIGltcGxlbWVudHMgSUNvbXByZXNzaWJsZUtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI8VHJlZUVsZW1lbnQ+IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHZpZXdNb2RlOiAoKSA9PiBWaWV3TW9kZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0KSB7IH1cblxuXHRnZXRLZXlib2FyZE5hdmlnYXRpb25MYWJlbChlbGVtZW50OiBUcmVlRWxlbWVudCk6IHsgdG9TdHJpbmcoKTogc3RyaW5nIH0gfCB7IHRvU3RyaW5nKCk6IHN0cmluZyB9W10gfCB1bmRlZmluZWQge1xuXHRcdGlmIChSZXNvdXJjZVRyZWUuaXNSZXNvdXJjZU5vZGUoZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiBlbGVtZW50Lm5hbWU7XG5cdFx0fSBlbHNlIGlmIChpc1NDTVJlcG9zaXRvcnkoZWxlbWVudCkgfHwgaXNTQ01JbnB1dChlbGVtZW50KSB8fCBpc1NDTUFjdGlvbkJ1dHRvbihlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9IGVsc2UgaWYgKGlzU0NNUmVzb3VyY2VHcm91cChlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIGVsZW1lbnQubGFiZWw7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0aGlzLnZpZXdNb2RlKCkgPT09IFZpZXdNb2RlLkxpc3QpIHtcblx0XHRcdFx0Ly8gSW4gTGlzdCBtb2RlIG1hdGNoIHVzaW5nIHRoZSBmaWxlIG5hbWUgYW5kIHRoZSBwYXRoLlxuXHRcdFx0XHQvLyBTaW5jZSB3ZSB3YW50IHRvIG1hdGNoIGJvdGggb24gdGhlIGZpbGUgbmFtZSBhbmQgdGhlXG5cdFx0XHRcdC8vIGZ1bGwgcGF0aCB3ZSByZXR1cm4gYW4gYXJyYXkgb2YgbGFiZWxzLiBBIG1hdGNoIGluIHRoZVxuXHRcdFx0XHQvLyBmaWxlIG5hbWUgdGFrZXMgcHJlY2VkZW5jZSBvdmVyIGEgbWF0Y2ggaW4gdGhlIHBhdGguXG5cdFx0XHRcdGNvbnN0IGZpbGVOYW1lID0gYmFzZW5hbWUoZWxlbWVudC5zb3VyY2VVcmkpO1xuXHRcdFx0XHRjb25zdCBmaWxlUGF0aCA9IHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGVsZW1lbnQuc291cmNlVXJpLCB7IHJlbGF0aXZlOiB0cnVlIH0pO1xuXG5cdFx0XHRcdHJldHVybiBbZmlsZU5hbWUsIGZpbGVQYXRoXTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIEluIFRyZWUgbW9kZSBvbmx5IG1hdGNoIHVzaW5nIHRoZSBmaWxlIG5hbWVcblx0XHRcdFx0cmV0dXJuIGJhc2VuYW1lKGVsZW1lbnQuc291cmNlVXJpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRnZXRDb21wcmVzc2VkTm9kZUtleWJvYXJkTmF2aWdhdGlvbkxhYmVsKGVsZW1lbnRzOiBUcmVlRWxlbWVudFtdKTogeyB0b1N0cmluZygpOiBzdHJpbmcgfCB1bmRlZmluZWQgfSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgZm9sZGVycyA9IGVsZW1lbnRzIGFzIElSZXNvdXJjZU5vZGU8SVNDTVJlc291cmNlLCBJU0NNUmVzb3VyY2VHcm91cD5bXTtcblx0XHRyZXR1cm4gZm9sZGVycy5tYXAoZSA9PiBlLm5hbWUpLmpvaW4oJy8nKTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRTQ01SZXNvdXJjZUlkKGVsZW1lbnQ6IFRyZWVFbGVtZW50KTogc3RyaW5nIHtcblx0aWYgKGlzU0NNUmVwb3NpdG9yeShlbGVtZW50KSkge1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gZWxlbWVudC5wcm92aWRlcjtcblx0XHRyZXR1cm4gYHJlcG86JHtwcm92aWRlci5pZH1gO1xuXHR9IGVsc2UgaWYgKGlzU0NNSW5wdXQoZWxlbWVudCkpIHtcblx0XHRjb25zdCBwcm92aWRlciA9IGVsZW1lbnQucmVwb3NpdG9yeS5wcm92aWRlcjtcblx0XHRyZXR1cm4gYGlucHV0OiR7cHJvdmlkZXIuaWR9YDtcblx0fSBlbHNlIGlmIChpc1NDTUFjdGlvbkJ1dHRvbihlbGVtZW50KSkge1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gZWxlbWVudC5yZXBvc2l0b3J5LnByb3ZpZGVyO1xuXHRcdHJldHVybiBgYWN0aW9uQnV0dG9uOiR7cHJvdmlkZXIuaWR9YDtcblx0fSBlbHNlIGlmIChpc1NDTVJlc291cmNlR3JvdXAoZWxlbWVudCkpIHtcblx0XHRjb25zdCBwcm92aWRlciA9IGVsZW1lbnQucHJvdmlkZXI7XG5cdFx0cmV0dXJuIGByZXNvdXJjZUdyb3VwOiR7cHJvdmlkZXIuaWR9LyR7ZWxlbWVudC5pZH1gO1xuXHR9IGVsc2UgaWYgKGlzU0NNUmVzb3VyY2UoZWxlbWVudCkpIHtcblx0XHRjb25zdCBncm91cCA9IGVsZW1lbnQucmVzb3VyY2VHcm91cDtcblx0XHRjb25zdCBwcm92aWRlciA9IGdyb3VwLnByb3ZpZGVyO1xuXHRcdHJldHVybiBgcmVzb3VyY2U6JHtwcm92aWRlci5pZH0vJHtncm91cC5pZH0vJHtlbGVtZW50LnNvdXJjZVVyaS50b1N0cmluZygpfWA7XG5cdH0gZWxzZSBpZiAoaXNTQ01SZXNvdXJjZU5vZGUoZWxlbWVudCkpIHtcblx0XHRjb25zdCBncm91cCA9IGVsZW1lbnQuY29udGV4dDtcblx0XHRyZXR1cm4gYGZvbGRlcjoke2dyb3VwLnByb3ZpZGVyLmlkfS8ke2dyb3VwLmlkfS8kRk9MREVSLyR7ZWxlbWVudC51cmkudG9TdHJpbmcoKX1gO1xuXHR9IGVsc2Uge1xuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCB0cmVlIGVsZW1lbnQnKTtcblx0fVxufVxuXG5jbGFzcyBTQ01SZXNvdXJjZUlkZW50aXR5UHJvdmlkZXIgaW1wbGVtZW50cyBJSWRlbnRpdHlQcm92aWRlcjxUcmVlRWxlbWVudD4ge1xuXG5cdGdldElkKGVsZW1lbnQ6IFRyZWVFbGVtZW50KTogc3RyaW5nIHtcblx0XHRyZXR1cm4gZ2V0U0NNUmVzb3VyY2VJZChlbGVtZW50KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU0NNQWNjZXNzaWJpbGl0eVByb3ZpZGVyIGltcGxlbWVudHMgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8VHJlZUVsZW1lbnQ+IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUFjY2Vzc2liaWxpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZVxuXHQpIHsgfVxuXG5cdGdldFdpZGdldEFyaWFMYWJlbCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgnc2NtJywgXCJTb3VyY2UgQ29udHJvbCBNYW5hZ2VtZW50XCIpO1xuXHR9XG5cblx0Z2V0QXJpYUxhYmVsKGVsZW1lbnQ6IFRyZWVFbGVtZW50KTogc3RyaW5nIHtcblx0XHRpZiAoUmVzb3VyY2VUcmVlLmlzUmVzb3VyY2VOb2RlKGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoZWxlbWVudC51cmksIHsgcmVsYXRpdmU6IHRydWUsIG5vUHJlZml4OiB0cnVlIH0pIHx8IGVsZW1lbnQubmFtZTtcblx0XHR9IGVsc2UgaWYgKGlzU0NNUmVwb3NpdG9yeShlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIGAke2VsZW1lbnQucHJvdmlkZXIubmFtZX0gJHtlbGVtZW50LnByb3ZpZGVyLmxhYmVsfWA7XG5cdFx0fSBlbHNlIGlmIChpc1NDTUlucHV0KGVsZW1lbnQpKSB7XG5cdFx0XHRjb25zdCB2ZXJib3NpdHkgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuU291cmNlQ29udHJvbCkgPT09IHRydWU7XG5cblx0XHRcdGlmICghdmVyYm9zaXR5IHx8ICF0aGlzLmFjY2Vzc2liaWxpdHlTZXJ2aWNlLmlzU2NyZWVuUmVhZGVyT3B0aW1pemVkKCkpIHtcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzY21JbnB1dCcsIFwiU291cmNlIENvbnRyb2wgSW5wdXRcIik7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGtiTGFiZWwgPSB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoQWNjZXNzaWJpbGl0eUNvbW1hbmRJZC5PcGVuQWNjZXNzaWJpbGl0eUhlbHApPy5nZXRMYWJlbCgpO1xuXHRcdFx0cmV0dXJuIGtiTGFiZWxcblx0XHRcdFx0PyBsb2NhbGl6ZSgnc2NtSW5wdXRSb3cuYWNjZXNzaWJpbGl0eUhlbHAnLCBcIlNvdXJjZSBDb250cm9sIElucHV0LCBVc2UgezB9IHRvIG9wZW4gU291cmNlIENvbnRyb2wgQWNjZXNzaWJpbGl0eSBIZWxwLlwiLCBrYkxhYmVsKVxuXHRcdFx0XHQ6IGxvY2FsaXplKCdzY21JbnB1dFJvdy5hY2Nlc3NpYmlsaXR5SGVscE5vS2InLCBcIlNvdXJjZSBDb250cm9sIElucHV0LCBSdW4gdGhlIE9wZW4gQWNjZXNzaWJpbGl0eSBIZWxwIGNvbW1hbmQgZm9yIG1vcmUgaW5mb3JtYXRpb24uXCIpO1xuXHRcdH0gZWxzZSBpZiAoaXNTQ01BY3Rpb25CdXR0b24oZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiBlbGVtZW50LmJ1dHRvbj8uY29tbWFuZC50aXRsZSA/PyAnJztcblx0XHR9IGVsc2UgaWYgKGlzU0NNUmVzb3VyY2VHcm91cChlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIGVsZW1lbnQubGFiZWw7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcblxuXHRcdFx0cmVzdWx0LnB1c2goYmFzZW5hbWUoZWxlbWVudC5zb3VyY2VVcmkpKTtcblxuXHRcdFx0aWYgKGVsZW1lbnQuZGVjb3JhdGlvbnMudG9vbHRpcCkge1xuXHRcdFx0XHRyZXN1bHQucHVzaChlbGVtZW50LmRlY29yYXRpb25zLnRvb2x0aXApO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBwYXRoID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoZGlybmFtZShlbGVtZW50LnNvdXJjZVVyaSksIHsgcmVsYXRpdmU6IHRydWUsIG5vUHJlZml4OiB0cnVlIH0pO1xuXG5cdFx0XHRpZiAocGF0aCkge1xuXHRcdFx0XHRyZXN1bHQucHVzaChwYXRoKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHJlc3VsdC5qb2luKCcsICcpO1xuXHRcdH1cblx0fVxufVxuXG5jb25zdCBlbnVtIFZpZXdNb2RlIHtcblx0TGlzdCA9ICdsaXN0Jyxcblx0VHJlZSA9ICd0cmVlJ1xufVxuXG5jb25zdCBlbnVtIFZpZXdTb3J0S2V5IHtcblx0UGF0aCA9ICdwYXRoJyxcblx0TmFtZSA9ICduYW1lJyxcblx0U3RhdHVzID0gJ3N0YXR1cydcbn1cblxuY29uc3QgTWVudXMgPSB7XG5cdFZpZXdTb3J0OiBuZXcgTWVudUlkKCdTQ01WaWV3U29ydCcpLFxuXHRSZXBvc2l0b3JpZXM6IG5ldyBNZW51SWQoJ1NDTVJlcG9zaXRvcmllcycpLFxuXHRDaGFuZ2VzU2V0dGluZ3M6IG5ldyBNZW51SWQoJ1NDTUNoYW5nZXNTZXR0aW5ncycpLFxufTtcblxuZXhwb3J0IGNvbnN0IENvbnRleHRLZXlzID0ge1xuXHRTQ01WaWV3TW9kZTogbmV3IFJhd0NvbnRleHRLZXk8Vmlld01vZGU+KCdzY21WaWV3TW9kZScsIFZpZXdNb2RlLkxpc3QpLFxuXHRTQ01WaWV3U29ydEtleTogbmV3IFJhd0NvbnRleHRLZXk8Vmlld1NvcnRLZXk+KCdzY21WaWV3U29ydEtleScsIFZpZXdTb3J0S2V5LlBhdGgpLFxuXHRTQ01WaWV3QXJlQWxsUmVwb3NpdG9yaWVzQ29sbGFwc2VkOiBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignc2NtVmlld0FyZUFsbFJlcG9zaXRvcmllc0NvbGxhcHNlZCcsIGZhbHNlKSxcblx0U0NNVmlld0lzQW55UmVwb3NpdG9yeUNvbGxhcHNpYmxlOiBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignc2NtVmlld0lzQW55UmVwb3NpdG9yeUNvbGxhcHNpYmxlJywgZmFsc2UpLFxuXHRTQ01Qcm92aWRlcjogbmV3IFJhd0NvbnRleHRLZXk8c3RyaW5nIHwgdW5kZWZpbmVkPignc2NtUHJvdmlkZXInLCB1bmRlZmluZWQpLFxuXHRTQ01Qcm92aWRlclJvb3RVcmk6IG5ldyBSYXdDb250ZXh0S2V5PHN0cmluZyB8IHVuZGVmaW5lZD4oJ3NjbVByb3ZpZGVyUm9vdFVyaScsIHVuZGVmaW5lZCksXG5cdFNDTVByb3ZpZGVySGFzUm9vdFVyaTogbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ3NjbVByb3ZpZGVySGFzUm9vdFVyaScsIHVuZGVmaW5lZCksXG5cdFNDTUhpc3RvcnlJdGVtQ291bnQ6IG5ldyBSYXdDb250ZXh0S2V5PG51bWJlcj4oJ3NjbUhpc3RvcnlJdGVtQ291bnQnLCAwKSxcblx0U0NNQ3VycmVudEhpc3RvcnlJdGVtUmVmSGFzUmVtb3RlOiBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignc2NtQ3VycmVudEhpc3RvcnlJdGVtUmVmSGFzUmVtb3RlJywgZmFsc2UpLFxuXHRTQ01DdXJyZW50SGlzdG9yeUl0ZW1SZWZJbkZpbHRlcjogbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ3NjbUN1cnJlbnRIaXN0b3J5SXRlbVJlZkluRmlsdGVyJywgZmFsc2UpLFxuXHRSZXBvc2l0b3J5Q291bnQ6IG5ldyBSYXdDb250ZXh0S2V5PG51bWJlcj4oJ3NjbVJlcG9zaXRvcnlDb3VudCcsIDApLFxuXHRSZXBvc2l0b3J5VmlzaWJpbGl0eUNvdW50OiBuZXcgUmF3Q29udGV4dEtleTxudW1iZXI+KCdzY21SZXBvc2l0b3J5VmlzaWJsZUNvdW50JywgMCksXG5cdFJlcG9zaXRvcnlWaXNpYmlsaXR5KHJlcG9zaXRvcnk6IElTQ01SZXBvc2l0b3J5KSB7XG5cdFx0cmV0dXJuIG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KGBzY21SZXBvc2l0b3J5VmlzaWJsZToke3JlcG9zaXRvcnkucHJvdmlkZXIuaWR9YCwgZmFsc2UpO1xuXHR9XG59O1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLlNDTVRpdGxlLCB7XG5cdHRpdGxlOiBsb2NhbGl6ZSgnc29ydEFjdGlvbicsIFwiVmlldyAmIFNvcnRcIiksXG5cdHN1Ym1lbnU6IE1lbnVzLlZpZXdTb3J0LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgVklFV19QQU5FX0lEKSwgQ29udGV4dEtleXMuUmVwb3NpdG9yeUNvdW50Lm5vdEVxdWFsc1RvKDApKSxcblx0Z3JvdXA6ICcwX3ZpZXcmc29ydCcsXG5cdG9yZGVyOiAxXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVzLlZpZXdTb3J0LCB7XG5cdHRpdGxlOiBsb2NhbGl6ZSgncmVwb3NpdG9yaWVzJywgXCJSZXBvc2l0b3JpZXNcIiksXG5cdHN1Ym1lbnU6IE1lbnVzLlJlcG9zaXRvcmllcyxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuZ3JlYXRlcihDb250ZXh0S2V5cy5SZXBvc2l0b3J5Q291bnQua2V5LCAxKSxcblx0Z3JvdXA6ICcwX3JlcG9zaXRvcmllcydcbn0pO1xuXG5jbGFzcyBSZXBvc2l0b3J5VmlzaWJpbGl0eUFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHByaXZhdGUgcmVwb3NpdG9yeTogSVNDTVJlcG9zaXRvcnk7XG5cblx0Y29uc3RydWN0b3IocmVwb3NpdG9yeTogSVNDTVJlcG9zaXRvcnkpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogYHdvcmtiZW5jaC5zY20uYWN0aW9uLnRvZ2dsZVJlcG9zaXRvcnlWaXNpYmlsaXR5LiR7cmVwb3NpdG9yeS5wcm92aWRlci5pZH1gLFxuXHRcdFx0dGl0bGU6IHJlcG9zaXRvcnkucHJvdmlkZXIubmFtZSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIub3IoQ29udGV4dEtleXMuUmVwb3NpdG9yeVZpc2liaWxpdHlDb3VudC5ub3RFcXVhbHNUbygxKSwgQ29udGV4dEtleXMuUmVwb3NpdG9yeVZpc2liaWxpdHkocmVwb3NpdG9yeSkuaXNFcXVhbFRvKGZhbHNlKSksXG5cdFx0XHR0b2dnbGVkOiBDb250ZXh0S2V5cy5SZXBvc2l0b3J5VmlzaWJpbGl0eShyZXBvc2l0b3J5KS5pc0VxdWFsVG8odHJ1ZSksXG5cdFx0XHRtZW51OiB7IGlkOiBNZW51cy5SZXBvc2l0b3JpZXMsIGdyb3VwOiAnMF9yZXBvc2l0b3JpZXMnIH1cblx0XHR9KTtcblx0XHR0aGlzLnJlcG9zaXRvcnkgPSByZXBvc2l0b3J5O1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Y29uc3Qgc2NtVmlld1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVNDTVZpZXdTZXJ2aWNlKTtcblx0XHRzY21WaWV3U2VydmljZS50b2dnbGVWaXNpYmlsaXR5KHRoaXMucmVwb3NpdG9yeSk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIFJlcG9zaXRvcnlWaXNpYmlsaXR5SXRlbSB7XG5cdHJlYWRvbmx5IGNvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRkaXNwb3NlKCk6IHZvaWQ7XG59XG5cbmNsYXNzIFJlcG9zaXRvcnlWaXNpYmlsaXR5QWN0aW9uQ29udHJvbGxlciB7XG5cblx0cHJpdmF0ZSBpdGVtcyA9IG5ldyBNYXA8SVNDTVJlcG9zaXRvcnksIFJlcG9zaXRvcnlWaXNpYmlsaXR5SXRlbT4oKTtcblx0cHJpdmF0ZSByZXBvc2l0b3J5Q291bnRDb250ZXh0S2V5OiBJQ29udGV4dEtleTxudW1iZXI+O1xuXHRwcml2YXRlIHJlcG9zaXRvcnlWaXNpYmlsaXR5Q291bnRDb250ZXh0S2V5OiBJQ29udGV4dEtleTxudW1iZXI+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJU0NNVmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzY21WaWV3U2VydmljZTogSVNDTVZpZXdTZXJ2aWNlLFxuXHRcdEBJU0NNU2VydmljZSBzY21TZXJ2aWNlOiBJU0NNU2VydmljZVxuXHQpIHtcblx0XHR0aGlzLnJlcG9zaXRvcnlDb3VudENvbnRleHRLZXkgPSBDb250ZXh0S2V5cy5SZXBvc2l0b3J5Q291bnQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnJlcG9zaXRvcnlWaXNpYmlsaXR5Q291bnRDb250ZXh0S2V5ID0gQ29udGV4dEtleXMuUmVwb3NpdG9yeVZpc2liaWxpdHlDb3VudC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0c2NtVmlld1NlcnZpY2Uub25EaWRDaGFuZ2VWaXNpYmxlUmVwb3NpdG9yaWVzKHRoaXMub25EaWRDaGFuZ2VWaXNpYmxlUmVwb3NpdG9yaWVzLCB0aGlzLCB0aGlzLmRpc3Bvc2FibGVzKTtcblx0XHRzY21TZXJ2aWNlLm9uRGlkQWRkUmVwb3NpdG9yeSh0aGlzLm9uRGlkQWRkUmVwb3NpdG9yeSwgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cdFx0c2NtU2VydmljZS5vbkRpZFJlbW92ZVJlcG9zaXRvcnkodGhpcy5vbkRpZFJlbW92ZVJlcG9zaXRvcnksIHRoaXMsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXG5cdFx0Zm9yIChjb25zdCByZXBvc2l0b3J5IG9mIHNjbVNlcnZpY2UucmVwb3NpdG9yaWVzKSB7XG5cdFx0XHR0aGlzLm9uRGlkQWRkUmVwb3NpdG9yeShyZXBvc2l0b3J5KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQWRkUmVwb3NpdG9yeShyZXBvc2l0b3J5OiBJU0NNUmVwb3NpdG9yeSk6IHZvaWQge1xuXHRcdGNvbnN0IGFjdGlvbiA9IHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIFJlcG9zaXRvcnlWaXNpYmlsaXR5QWN0aW9uIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcihyZXBvc2l0b3J5KTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGNvbnRleHRLZXkgPSBDb250ZXh0S2V5cy5SZXBvc2l0b3J5VmlzaWJpbGl0eShyZXBvc2l0b3J5KS5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29udGV4dEtleS5zZXQodGhpcy5zY21WaWV3U2VydmljZS5pc1Zpc2libGUocmVwb3NpdG9yeSkpO1xuXG5cdFx0dGhpcy5pdGVtcy5zZXQocmVwb3NpdG9yeSwge1xuXHRcdFx0Y29udGV4dEtleSxcblx0XHRcdGRpc3Bvc2UoKSB7XG5cdFx0XHRcdGNvbnRleHRLZXkucmVzZXQoKTtcblx0XHRcdFx0YWN0aW9uLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMudXBkYXRlUmVwb3NpdG9yeUNvbnRleHRLZXlzKCk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkUmVtb3ZlUmVwb3NpdG9yeShyZXBvc2l0b3J5OiBJU0NNUmVwb3NpdG9yeSk6IHZvaWQge1xuXHRcdHRoaXMuaXRlbXMuZ2V0KHJlcG9zaXRvcnkpPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5pdGVtcy5kZWxldGUocmVwb3NpdG9yeSk7XG5cdFx0dGhpcy51cGRhdGVSZXBvc2l0b3J5Q29udGV4dEtleXMoKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VWaXNpYmxlUmVwb3NpdG9yaWVzKCk6IHZvaWQge1xuXHRcdGxldCBjb3VudCA9IDA7XG5cblx0XHRmb3IgKGNvbnN0IFtyZXBvc2l0b3J5LCBpdGVtXSBvZiB0aGlzLml0ZW1zKSB7XG5cdFx0XHRjb25zdCBpc1Zpc2libGUgPSB0aGlzLnNjbVZpZXdTZXJ2aWNlLmlzVmlzaWJsZShyZXBvc2l0b3J5KTtcblx0XHRcdGl0ZW0uY29udGV4dEtleS5zZXQoaXNWaXNpYmxlKTtcblxuXHRcdFx0aWYgKGlzVmlzaWJsZSkge1xuXHRcdFx0XHRjb3VudCsrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMucmVwb3NpdG9yeUNvdW50Q29udGV4dEtleS5zZXQodGhpcy5pdGVtcy5zaXplKTtcblx0XHR0aGlzLnJlcG9zaXRvcnlWaXNpYmlsaXR5Q291bnRDb250ZXh0S2V5LnNldChjb3VudCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVJlcG9zaXRvcnlDb250ZXh0S2V5cygpOiB2b2lkIHtcblx0XHR0aGlzLnJlcG9zaXRvcnlDb3VudENvbnRleHRLZXkuc2V0KHRoaXMuaXRlbXMuc2l6ZSk7XG5cdFx0dGhpcy5yZXBvc2l0b3J5VmlzaWJpbGl0eUNvdW50Q29udGV4dEtleS5zZXQoSXRlcmFibGUucmVkdWNlKHRoaXMuaXRlbXMua2V5cygpLCAociwgcmVwb3NpdG9yeSkgPT4gciArICh0aGlzLnNjbVZpZXdTZXJ2aWNlLmlzVmlzaWJsZShyZXBvc2l0b3J5KSA/IDEgOiAwKSwgMCkpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRkaXNwb3NlKHRoaXMuaXRlbXMudmFsdWVzKCkpO1xuXHRcdHRoaXMuaXRlbXMuY2xlYXIoKTtcblx0fVxufVxuXG5jbGFzcyBTZXRMaXN0Vmlld01vZGVBY3Rpb24gZXh0ZW5kcyBWaWV3QWN0aW9uPFNDTVZpZXdQYW5lPiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdGlkID0gJ3dvcmtiZW5jaC5zY20uYWN0aW9uLnNldExpc3RWaWV3TW9kZScsXG5cdFx0bWVudTogUGFydGlhbDxJQWN0aW9uMk9wdGlvbnNbJ21lbnUnXT4gPSB7fSkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzZXRMaXN0Vmlld01vZGUnLCBcIlZpZXcgYXMgTGlzdFwiKSxcblx0XHRcdHZpZXdJZDogVklFV19QQU5FX0lELFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5saXN0VHJlZSxcblx0XHRcdHRvZ2dsZWQ6IENvbnRleHRLZXlzLlNDTVZpZXdNb2RlLmlzRXF1YWxUbyhWaWV3TW9kZS5MaXN0KSxcblx0XHRcdG1lbnU6IHsgaWQ6IE1lbnVzLlZpZXdTb3J0LCBncm91cDogJzFfdmlld21vZGUnLCAuLi5tZW51IH1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bkluVmlldyhfOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3OiBTQ01WaWV3UGFuZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHZpZXcudmlld01vZGUgPSBWaWV3TW9kZS5MaXN0O1xuXHR9XG59XG5cbmNsYXNzIFNldExpc3RWaWV3TW9kZU5hdmlnYXRpb25BY3Rpb24gZXh0ZW5kcyBTZXRMaXN0Vmlld01vZGVBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihcblx0XHRcdCd3b3JrYmVuY2guc2NtLmFjdGlvbi5zZXRMaXN0Vmlld01vZGVOYXZpZ2F0aW9uJyxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5TQ01UaXRsZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIFZJRVdfUEFORV9JRCksIENvbnRleHRLZXlzLlJlcG9zaXRvcnlDb3VudC5ub3RFcXVhbHNUbygwKSwgQ29udGV4dEtleXMuU0NNVmlld01vZGUuaXNFcXVhbFRvKFZpZXdNb2RlLlRyZWUpKSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IC0xMDAwXG5cdFx0XHR9KTtcblx0fVxufVxuXG5jbGFzcyBTZXRUcmVlVmlld01vZGVBY3Rpb24gZXh0ZW5kcyBWaWV3QWN0aW9uPFNDTVZpZXdQYW5lPiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdGlkID0gJ3dvcmtiZW5jaC5zY20uYWN0aW9uLnNldFRyZWVWaWV3TW9kZScsXG5cdFx0bWVudTogUGFydGlhbDxJQWN0aW9uMk9wdGlvbnNbJ21lbnUnXT4gPSB7fSkge1xuXHRcdHN1cGVyKFxuXHRcdFx0e1xuXHRcdFx0XHRpZCxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzZXRUcmVlVmlld01vZGUnLCBcIlZpZXcgYXMgVHJlZVwiKSxcblx0XHRcdFx0dmlld0lkOiBWSUVXX1BBTkVfSUQsXG5cdFx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdFx0aWNvbjogQ29kaWNvbi5saXN0RmxhdCxcblx0XHRcdFx0dG9nZ2xlZDogQ29udGV4dEtleXMuU0NNVmlld01vZGUuaXNFcXVhbFRvKFZpZXdNb2RlLlRyZWUpLFxuXHRcdFx0XHRtZW51OiB7IGlkOiBNZW51cy5WaWV3U29ydCwgZ3JvdXA6ICcxX3ZpZXdtb2RlJywgLi4ubWVudSB9XG5cdFx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bkluVmlldyhfOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3OiBTQ01WaWV3UGFuZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHZpZXcudmlld01vZGUgPSBWaWV3TW9kZS5UcmVlO1xuXHR9XG59XG5cbmNsYXNzIFNldFRyZWVWaWV3TW9kZU5hdmlnYXRpb25BY3Rpb24gZXh0ZW5kcyBTZXRUcmVlVmlld01vZGVBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihcblx0XHRcdCd3b3JrYmVuY2guc2NtLmFjdGlvbi5zZXRUcmVlVmlld01vZGVOYXZpZ2F0aW9uJyxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5TQ01UaXRsZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIFZJRVdfUEFORV9JRCksIENvbnRleHRLZXlzLlJlcG9zaXRvcnlDb3VudC5ub3RFcXVhbHNUbygwKSwgQ29udGV4dEtleXMuU0NNVmlld01vZGUuaXNFcXVhbFRvKFZpZXdNb2RlLkxpc3QpKSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IC0xMDAwXG5cdFx0XHR9KTtcblx0fVxufVxuXG5yZWdpc3RlckFjdGlvbjIoU2V0TGlzdFZpZXdNb2RlQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihTZXRUcmVlVmlld01vZGVBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKFNldExpc3RWaWV3TW9kZU5hdmlnYXRpb25BY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKFNldFRyZWVWaWV3TW9kZU5hdmlnYXRpb25BY3Rpb24pO1xuXG5hYnN0cmFjdCBjbGFzcyBSZXBvc2l0b3J5U29ydEFjdGlvbiBleHRlbmRzIFZpZXdBY3Rpb248U0NNVmlld1BhbmU+IHtcblx0Y29uc3RydWN0b3IocHJpdmF0ZSBzb3J0S2V5OiBJU0NNUmVwb3NpdG9yeVNvcnRLZXksIHRpdGxlOiBzdHJpbmcpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogYHdvcmtiZW5jaC5zY20uYWN0aW9uLnJlcG9zaXRvcmllcy5zZXRTb3J0S2V5LiR7c29ydEtleX1gLFxuXHRcdFx0dGl0bGUsXG5cdFx0XHR2aWV3SWQ6IFZJRVdfUEFORV9JRCxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdHRvZ2dsZWQ6IFJlcG9zaXRvcnlDb250ZXh0S2V5cy5SZXBvc2l0b3J5U29ydEtleS5pc0VxdWFsVG8oc29ydEtleSksXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudXMuUmVwb3NpdG9yaWVzLFxuXHRcdFx0XHRcdGdyb3VwOiAnMV9zb3J0J1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5TQ01Tb3VyY2VDb250cm9sVGl0bGUsXG5cdFx0XHRcdFx0Z3JvdXA6ICcxX3NvcnQnLFxuXHRcdFx0XHR9LFxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuSW5WaWV3KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0YWNjZXNzb3IuZ2V0KElTQ01WaWV3U2VydmljZSkudG9nZ2xlU29ydEtleSh0aGlzLnNvcnRLZXkpO1xuXHR9XG59XG5cblxuY2xhc3MgUmVwb3NpdG9yeVNvcnRCeURpc2NvdmVyeVRpbWVBY3Rpb24gZXh0ZW5kcyBSZXBvc2l0b3J5U29ydEFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKElTQ01SZXBvc2l0b3J5U29ydEtleS5EaXNjb3ZlcnlUaW1lLCBsb2NhbGl6ZSgncmVwb3NpdG9yeVNvcnRCeURpc2NvdmVyeVRpbWUnLCBcIlNvcnQgYnkgRGlzY292ZXJ5IFRpbWVcIikpO1xuXHR9XG59XG5cbmNsYXNzIFJlcG9zaXRvcnlTb3J0QnlOYW1lQWN0aW9uIGV4dGVuZHMgUmVwb3NpdG9yeVNvcnRBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihJU0NNUmVwb3NpdG9yeVNvcnRLZXkuTmFtZSwgbG9jYWxpemUoJ3JlcG9zaXRvcnlTb3J0QnlOYW1lJywgXCJTb3J0IGJ5IE5hbWVcIikpO1xuXHR9XG59XG5cbmNsYXNzIFJlcG9zaXRvcnlTb3J0QnlQYXRoQWN0aW9uIGV4dGVuZHMgUmVwb3NpdG9yeVNvcnRBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihJU0NNUmVwb3NpdG9yeVNvcnRLZXkuUGF0aCwgbG9jYWxpemUoJ3JlcG9zaXRvcnlTb3J0QnlQYXRoJywgXCJTb3J0IGJ5IFBhdGhcIikpO1xuXHR9XG59XG5cbnJlZ2lzdGVyQWN0aW9uMihSZXBvc2l0b3J5U29ydEJ5RGlzY292ZXJ5VGltZUFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoUmVwb3NpdG9yeVNvcnRCeU5hbWVBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKFJlcG9zaXRvcnlTb3J0QnlQYXRoQWN0aW9uKTtcblxuYWJzdHJhY3QgY2xhc3MgU2V0U29ydEtleUFjdGlvbiBleHRlbmRzIFZpZXdBY3Rpb248U0NNVmlld1BhbmU+IHtcblx0Y29uc3RydWN0b3IocHJpdmF0ZSBzb3J0S2V5OiBWaWV3U29ydEtleSwgdGl0bGU6IHN0cmluZykge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBgd29ya2JlbmNoLnNjbS5hY3Rpb24uc2V0U29ydEtleS4ke3NvcnRLZXl9YCxcblx0XHRcdHRpdGxlLFxuXHRcdFx0dmlld0lkOiBWSUVXX1BBTkVfSUQsXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHR0b2dnbGVkOiBDb250ZXh0S2V5cy5TQ01WaWV3U29ydEtleS5pc0VxdWFsVG8oc29ydEtleSksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlzLlNDTVZpZXdNb2RlLmlzRXF1YWxUbyhWaWV3TW9kZS5MaXN0KSxcblx0XHRcdG1lbnU6IHsgaWQ6IE1lbnVzLlZpZXdTb3J0LCBncm91cDogJzJfc29ydCcgfVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuSW5WaWV3KF86IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IFNDTVZpZXdQYW5lKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dmlldy52aWV3U29ydEtleSA9IHRoaXMuc29ydEtleTtcblx0fVxufVxuXG5jbGFzcyBTZXRTb3J0QnlOYW1lQWN0aW9uIGV4dGVuZHMgU2V0U29ydEtleUFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFZpZXdTb3J0S2V5Lk5hbWUsIGxvY2FsaXplKCdzb3J0Q2hhbmdlc0J5TmFtZScsIFwiU29ydCBDaGFuZ2VzIGJ5IE5hbWVcIikpO1xuXHR9XG59XG5cbmNsYXNzIFNldFNvcnRCeVBhdGhBY3Rpb24gZXh0ZW5kcyBTZXRTb3J0S2V5QWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoVmlld1NvcnRLZXkuUGF0aCwgbG9jYWxpemUoJ3NvcnRDaGFuZ2VzQnlQYXRoJywgXCJTb3J0IENoYW5nZXMgYnkgUGF0aFwiKSk7XG5cdH1cbn1cblxuY2xhc3MgU2V0U29ydEJ5U3RhdHVzQWN0aW9uIGV4dGVuZHMgU2V0U29ydEtleUFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFZpZXdTb3J0S2V5LlN0YXR1cywgbG9jYWxpemUoJ3NvcnRDaGFuZ2VzQnlTdGF0dXMnLCBcIlNvcnQgQ2hhbmdlcyBieSBTdGF0dXNcIikpO1xuXHR9XG59XG5cbnJlZ2lzdGVyQWN0aW9uMihTZXRTb3J0QnlOYW1lQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihTZXRTb3J0QnlQYXRoQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihTZXRTb3J0QnlTdGF0dXNBY3Rpb24pO1xuXG5jbGFzcyBDb2xsYXBzZUFsbFJlcG9zaXRvcmllc0FjdGlvbiBleHRlbmRzIFZpZXdBY3Rpb248U0NNVmlld1BhbmU+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogYHdvcmtiZW5jaC5zY20uYWN0aW9uLmNvbGxhcHNlQWxsUmVwb3NpdG9yaWVzYCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnY29sbGFwc2UgYWxsJywgXCJDb2xsYXBzZSBBbGwgUmVwb3NpdG9yaWVzXCIpLFxuXHRcdFx0dmlld0lkOiBWSUVXX1BBTkVfSUQsXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRpY29uOiBDb2RpY29uLmNvbGxhcHNlQWxsLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlNDTVRpdGxlLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgVklFV19QQU5FX0lEKSwgQ29udGV4dEtleXMuU0NNVmlld0lzQW55UmVwb3NpdG9yeUNvbGxhcHNpYmxlLmlzRXF1YWxUbyh0cnVlKSwgQ29udGV4dEtleXMuU0NNVmlld0FyZUFsbFJlcG9zaXRvcmllc0NvbGxhcHNlZC5pc0VxdWFsVG8oZmFsc2UpKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuSW5WaWV3KF86IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IFNDTVZpZXdQYW5lKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dmlldy5jb2xsYXBzZUFsbFJlcG9zaXRvcmllcygpO1xuXHR9XG59XG5cbmNsYXNzIEV4cGFuZEFsbFJlcG9zaXRvcmllc0FjdGlvbiBleHRlbmRzIFZpZXdBY3Rpb248U0NNVmlld1BhbmU+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogYHdvcmtiZW5jaC5zY20uYWN0aW9uLmV4cGFuZEFsbFJlcG9zaXRvcmllc2AsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2V4cGFuZCBhbGwnLCBcIkV4cGFuZCBBbGwgUmVwb3NpdG9yaWVzXCIpLFxuXHRcdFx0dmlld0lkOiBWSUVXX1BBTkVfSUQsXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRpY29uOiBDb2RpY29uLmV4cGFuZEFsbCxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5TQ01UaXRsZSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIFZJRVdfUEFORV9JRCksIENvbnRleHRLZXlzLlNDTVZpZXdJc0FueVJlcG9zaXRvcnlDb2xsYXBzaWJsZS5pc0VxdWFsVG8odHJ1ZSksIENvbnRleHRLZXlzLlNDTVZpZXdBcmVBbGxSZXBvc2l0b3JpZXNDb2xsYXBzZWQuaXNFcXVhbFRvKHRydWUpKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuSW5WaWV3KF86IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IFNDTVZpZXdQYW5lKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dmlldy5leHBhbmRBbGxSZXBvc2l0b3JpZXMoKTtcblx0fVxufVxuXG5yZWdpc3RlckFjdGlvbjIoQ29sbGFwc2VBbGxSZXBvc2l0b3JpZXNBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKEV4cGFuZEFsbFJlcG9zaXRvcmllc0FjdGlvbik7XG5cbmNvbnN0IGVudW0gU0NNSW5wdXRXaWRnZXRDb21tYW5kSWQge1xuXHRDYW5jZWxBY3Rpb24gPSAnc2NtLmlucHV0LmNhbmNlbEFjdGlvbidcbn1cblxuY29uc3QgZW51bSBTQ01JbnB1dFdpZGdldFN0b3JhZ2VLZXkge1xuXHRMYXN0QWN0aW9uSWQgPSAnc2NtLmlucHV0Lmxhc3RBY3Rpb25JZCdcbn1cblxuY2xhc3MgU0NNSW5wdXRXaWRnZXRBY3Rpb25SdW5uZXIgZXh0ZW5kcyBBY3Rpb25SdW5uZXIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3J1bm5pbmdBY3Rpb25zID0gbmV3IFNldDxJQWN0aW9uPigpO1xuXHRwdWJsaWMgZ2V0IHJ1bm5pbmdBY3Rpb25zKCk6IFNldDxJQWN0aW9uPiB7IHJldHVybiB0aGlzLl9ydW5uaW5nQWN0aW9uczsgfVxuXG5cdHByaXZhdGUgX2N0czogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBpbnB1dDogSVNDTUlucHV0LFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgcnVuQWN0aW9uKGFjdGlvbjogSUFjdGlvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHQvLyBDYW5jZWwgcHJldmlvdXMgYWN0aW9uXG5cdFx0XHRpZiAodGhpcy5ydW5uaW5nQWN0aW9ucy5zaXplICE9PSAwKSB7XG5cdFx0XHRcdHRoaXMuX2N0cz8uY2FuY2VsKCk7XG5cblx0XHRcdFx0aWYgKGFjdGlvbi5pZCA9PT0gU0NNSW5wdXRXaWRnZXRDb21tYW5kSWQuQ2FuY2VsQWN0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIENyZWF0ZSBhY3Rpb24gY29udGV4dFxuXHRcdFx0Y29uc3QgY29udGV4dDogSVNDTUlucHV0VmFsdWVQcm92aWRlckNvbnRleHRbXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBncm91cCBvZiB0aGlzLmlucHV0LnJlcG9zaXRvcnkucHJvdmlkZXIuZ3JvdXBzKSB7XG5cdFx0XHRcdGNvbnRleHQucHVzaCh7XG5cdFx0XHRcdFx0cmVzb3VyY2VHcm91cElkOiBncm91cC5pZCxcblx0XHRcdFx0XHRyZXNvdXJjZXM6IFsuLi5ncm91cC5yZXNvdXJjZXMubWFwKHIgPT4gci5zb3VyY2VVcmkpXVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUnVuIGFjdGlvblxuXHRcdFx0dGhpcy5fcnVubmluZ0FjdGlvbnMuYWRkKGFjdGlvbik7XG5cdFx0XHR0aGlzLl9jdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRcdGF3YWl0IGFjdGlvbi5ydW4oLi4uW3RoaXMuaW5wdXQucmVwb3NpdG9yeS5wcm92aWRlci5yb290VXJpLCBjb250ZXh0LCB0aGlzLl9jdHMudG9rZW5dKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5fcnVubmluZ0FjdGlvbnMuZGVsZXRlKGFjdGlvbik7XG5cblx0XHRcdC8vIFNhdmUgbGFzdCBhY3Rpb25cblx0XHRcdGlmICh0aGlzLl9ydW5uaW5nQWN0aW9ucy5zaXplID09PSAwKSB7XG5cdFx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoU0NNSW5wdXRXaWRnZXRTdG9yYWdlS2V5Lkxhc3RBY3Rpb25JZCwgYWN0aW9uLmlkLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxufVxuXG5jbGFzcyBTQ01JbnB1dFdpZGdldFRvb2xiYXIgZXh0ZW5kcyBXb3JrYmVuY2hUb29sQmFyIHtcblxuXHRwcml2YXRlIF9kcm9wZG93bkFjdGlvbnM6IElBY3Rpb25bXSA9IFtdO1xuXHRnZXQgZHJvcGRvd25BY3Rpb25zKCk6IElBY3Rpb25bXSB7IHJldHVybiB0aGlzLl9kcm9wZG93bkFjdGlvbnM7IH1cblxuXHRwcml2YXRlIF9kcm9wZG93bkFjdGlvbjogSUFjdGlvbjtcblx0Z2V0IGRyb3Bkb3duQWN0aW9uKCk6IElBY3Rpb24geyByZXR1cm4gdGhpcy5fZHJvcGRvd25BY3Rpb247IH1cblxuXHRwcml2YXRlIF9jYW5jZWxBY3Rpb246IElBY3Rpb247XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2UgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxEaXNwb3NhYmxlU3RvcmU+KCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0b3B0aW9uczogSU1lbnVXb3JrYmVuY2hUb29sQmFyT3B0aW9ucyB8IHVuZGVmaW5lZCxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGNvbnRhaW5lciwgeyByZXNldE1lbnU6IE1lbnVJZC5TQ01JbnB1dEJveCwgLi4ub3B0aW9ucyB9LCBtZW51U2VydmljZSwgY29udGV4dEtleVNlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwga2V5YmluZGluZ1NlcnZpY2UsIGNvbW1hbmRTZXJ2aWNlLCB0ZWxlbWV0cnlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX2Ryb3Bkb3duQWN0aW9uID0gbmV3IEFjdGlvbihcblx0XHRcdCdzY21JbnB1dE1vcmVBY3Rpb25zJyxcblx0XHRcdGxvY2FsaXplKCdzY21JbnB1dE1vcmVBY3Rpb25zJywgXCJNb3JlIEFjdGlvbnMuLi5cIiksXG5cdFx0XHQnY29kaWNvbi1jaGV2cm9uLWRvd24nKTtcblxuXHRcdHRoaXMuX2NhbmNlbEFjdGlvbiA9IG5ldyBNZW51SXRlbUFjdGlvbih7XG5cdFx0XHRpZDogU0NNSW5wdXRXaWRnZXRDb21tYW5kSWQuQ2FuY2VsQWN0aW9uLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzY21JbnB1dENhbmNlbEFjdGlvbicsIFwiQ2FuY2VsXCIpLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5zdG9wQ2lyY2xlLFxuXHRcdH0sIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgY29udGV4dEtleVNlcnZpY2UsIGNvbW1hbmRTZXJ2aWNlKTtcblx0fVxuXG5cdHB1YmxpYyBzZXRJbnB1dChpbnB1dDogSVNDTUlucHV0KTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMudmFsdWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBjb250ZXh0S2V5U2VydmljZSA9IHRoaXMuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlT3ZlcmxheShbXG5cdFx0XHRbJ3NjbVByb3ZpZGVyJywgaW5wdXQucmVwb3NpdG9yeS5wcm92aWRlci5jb250ZXh0VmFsdWVdLFxuXHRcdFx0WydzY21Qcm92aWRlclJvb3RVcmknLCBpbnB1dC5yZXBvc2l0b3J5LnByb3ZpZGVyLnJvb3RVcmk/LnRvU3RyaW5nKCldLFxuXHRcdFx0WydzY21Qcm92aWRlckhhc1Jvb3RVcmknLCAhIWlucHV0LnJlcG9zaXRvcnkucHJvdmlkZXIucm9vdFVyaV1cblx0XHRdKTtcblxuXHRcdGNvbnN0IG1lbnUgPSB0aGlzLl9kaXNwb3NhYmxlcy52YWx1ZS5hZGQodGhpcy5tZW51U2VydmljZS5jcmVhdGVNZW51KE1lbnVJZC5TQ01JbnB1dEJveCwgY29udGV4dEtleVNlcnZpY2UsIHsgZW1pdEV2ZW50c0ZvclN1Ym1lbnVDaGFuZ2VzOiB0cnVlIH0pKTtcblxuXHRcdGNvbnN0IGlzRW5hYmxlZCA9ICgpOiBib29sZWFuID0+IHtcblx0XHRcdHJldHVybiBpbnB1dC5yZXBvc2l0b3J5LnByb3ZpZGVyLmdyb3Vwcy5zb21lKGcgPT4gZy5yZXNvdXJjZXMubGVuZ3RoID4gMCk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHVwZGF0ZVRvb2xiYXIgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBhY3Rpb25zID0gZ2V0RmxhdEFjdGlvbkJhckFjdGlvbnMobWVudS5nZXRBY3Rpb25zKHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUgfSkpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGFjdGlvbiBvZiBhY3Rpb25zKSB7XG5cdFx0XHRcdGFjdGlvbi5lbmFibGVkID0gaXNFbmFibGVkKCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9kcm9wZG93bkFjdGlvbi5lbmFibGVkID0gaXNFbmFibGVkKCk7XG5cblx0XHRcdGxldCBwcmltYXJ5QWN0aW9uOiBJQWN0aW9uIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRpZiAoYWN0aW9ucy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0cHJpbWFyeUFjdGlvbiA9IGFjdGlvbnNbMF07XG5cdFx0XHR9IGVsc2UgaWYgKGFjdGlvbnMubGVuZ3RoID4gMSkge1xuXHRcdFx0XHRjb25zdCBsYXN0QWN0aW9uSWQgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChTQ01JbnB1dFdpZGdldFN0b3JhZ2VLZXkuTGFzdEFjdGlvbklkLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgJycpO1xuXHRcdFx0XHRwcmltYXJ5QWN0aW9uID0gYWN0aW9ucy5maW5kKGEgPT4gYS5pZCA9PT0gbGFzdEFjdGlvbklkKSA/PyBhY3Rpb25zWzBdO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9kcm9wZG93bkFjdGlvbnMgPSBhY3Rpb25zLmxlbmd0aCA9PT0gMSA/IFtdIDogYWN0aW9ucztcblx0XHRcdHN1cGVyLnNldEFjdGlvbnMocHJpbWFyeUFjdGlvbiA/IFtwcmltYXJ5QWN0aW9uXSA6IFtdLCBbXSk7XG5cblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0XHR9O1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMudmFsdWUuYWRkKG1lbnUub25EaWRDaGFuZ2UoKCkgPT4gdXBkYXRlVG9vbGJhcigpKSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMudmFsdWUuYWRkKGlucHV0LnJlcG9zaXRvcnkucHJvdmlkZXIub25EaWRDaGFuZ2VSZXNvdXJjZXMoKCkgPT4gdXBkYXRlVG9vbGJhcigpKSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMudmFsdWUuYWRkKHRoaXMuc3RvcmFnZVNlcnZpY2Uub25EaWRDaGFuZ2VWYWx1ZShTdG9yYWdlU2NvcGUuUFJPRklMRSwgU0NNSW5wdXRXaWRnZXRTdG9yYWdlS2V5Lkxhc3RBY3Rpb25JZCwgdGhpcy5fZGlzcG9zYWJsZXMudmFsdWUpKCgpID0+IHVwZGF0ZVRvb2xiYXIoKSkpO1xuXG5cdFx0dGhpcy5hY3Rpb25SdW5uZXIgPSB0aGlzLl9kaXNwb3NhYmxlcy52YWx1ZS5hZGQobmV3IFNDTUlucHV0V2lkZ2V0QWN0aW9uUnVubmVyKGlucHV0LCB0aGlzLnN0b3JhZ2VTZXJ2aWNlKSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMudmFsdWUuYWRkKHRoaXMuYWN0aW9uUnVubmVyLm9uV2lsbFJ1bihlID0+IHtcblx0XHRcdGlmICgodGhpcy5hY3Rpb25SdW5uZXIgYXMgU0NNSW5wdXRXaWRnZXRBY3Rpb25SdW5uZXIpLnJ1bm5pbmdBY3Rpb25zLnNpemUgPT09IDApIHtcblx0XHRcdFx0c3VwZXIuc2V0QWN0aW9ucyhbdGhpcy5fY2FuY2VsQWN0aW9uXSwgW10pO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLnZhbHVlLmFkZCh0aGlzLmFjdGlvblJ1bm5lci5vbkRpZFJ1bihlID0+IHtcblx0XHRcdGlmICgodGhpcy5hY3Rpb25SdW5uZXIgYXMgU0NNSW5wdXRXaWRnZXRBY3Rpb25SdW5uZXIpLnJ1bm5pbmdBY3Rpb25zLnNpemUgPT09IDApIHtcblx0XHRcdFx0dXBkYXRlVG9vbGJhcigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHVwZGF0ZVRvb2xiYXIoKTtcblx0fVxufVxuXG5jbGFzcyBTQ01JbnB1dFdpZGdldEVkaXRvck9wdGlvbnMge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2UgPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRlZmF1bHRJbnB1dEZvbnRGYW1pbHkgPSBERUZBVUxUX0ZPTlRfRkFNSUxZO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb3ZlcmZsb3dXaWRnZXRzRG9tTm9kZTogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSB7XG5cblx0XHRjb25zdCBvbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24gPSBFdmVudC5maWx0ZXIoXG5cdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbixcblx0XHRcdGUgPT4ge1xuXHRcdFx0XHRyZXR1cm4gZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZWRpdG9yLmFjY2Vzc2liaWxpdHlTdXBwb3J0JykgfHxcblx0XHRcdFx0XHRlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3IuY3Vyc29yQmxpbmtpbmcnKSB8fFxuXHRcdFx0XHRcdGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2VkaXRvci5jdXJzb3JTdHlsZScpIHx8XG5cdFx0XHRcdFx0ZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZWRpdG9yLmN1cnNvcldpZHRoJykgfHxcblx0XHRcdFx0XHRlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3IuZW1wdHlTZWxlY3Rpb25DbGlwYm9hcmQnKSB8fFxuXHRcdFx0XHRcdGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2VkaXRvci5mb250RmFtaWx5JykgfHxcblx0XHRcdFx0XHRlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3IucnVsZXJzJykgfHxcblx0XHRcdFx0XHRlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3Iud29yZFdyYXAnKSB8fFxuXHRcdFx0XHRcdGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3NjbS5pbnB1dEZvbnRGYW1pbHknKSB8fFxuXHRcdFx0XHRcdGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3NjbS5pbnB1dEZvbnRTaXplJyk7XG5cdFx0XHR9LFxuXHRcdFx0dGhpcy5fZGlzcG9zYWJsZXNcblx0XHQpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKG9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoKSA9PiB0aGlzLl9vbkRpZENoYW5nZS5maXJlKCkpKTtcblx0fVxuXG5cdGdldEVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnMoKTogSUVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnMge1xuXHRcdHJldHVybiB7XG5cdFx0XHQuLi5nZXRTaW1wbGVFZGl0b3JPcHRpb25zKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpLFxuXHRcdFx0Li4udGhpcy5nZXRFZGl0b3JPcHRpb25zKCksXG5cdFx0XHRkcmFnQW5kRHJvcDogdHJ1ZSxcblx0XHRcdGRyb3BJbnRvRWRpdG9yOiB7IGVuYWJsZWQ6IHRydWUgfSxcblx0XHRcdGZvcm1hdE9uVHlwZTogdHJ1ZSxcblx0XHRcdGxpbmVEZWNvcmF0aW9uc1dpZHRoOiA2LFxuXHRcdFx0b3ZlcmZsb3dXaWRnZXRzRG9tTm9kZTogdGhpcy5vdmVyZmxvd1dpZGdldHNEb21Ob2RlLFxuXHRcdFx0cGFkZGluZzogeyB0b3A6IDIsIGJvdHRvbTogMiB9LFxuXHRcdFx0cXVpY2tTdWdnZXN0aW9uczogZmFsc2UsXG5cdFx0XHRyZW5kZXJXaGl0ZXNwYWNlOiAnbm9uZScsXG5cdFx0XHRzY3JvbGxiYXI6IHtcblx0XHRcdFx0YWx3YXlzQ29uc3VtZU1vdXNlV2hlZWw6IGZhbHNlLFxuXHRcdFx0XHR2ZXJ0aWNhbDogJ2hpZGRlbidcblx0XHRcdH0sXG5cdFx0XHR3cmFwcGluZ0luZGVudDogJ25vbmUnLFxuXHRcdFx0d3JhcHBpbmdTdHJhdGVneTogJ2FkdmFuY2VkJyxcblx0XHR9O1xuXHR9XG5cblx0Z2V0RWRpdG9yT3B0aW9ucygpOiBJRWRpdG9yT3B0aW9ucyB7XG5cdFx0Y29uc3QgZm9udEZhbWlseSA9IHRoaXMuX2dldEVkaXRvckZvbnRGYW1pbHkoKTtcblx0XHRjb25zdCBmb250U2l6ZSA9IHRoaXMuX2dldEVkaXRvckZvbnRTaXplKCk7XG5cdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMuX2dldEVkaXRvckxpbmVIZWlnaHQoZm9udFNpemUpO1xuXHRcdGNvbnN0IGFjY2Vzc2liaWxpdHlTdXBwb3J0ID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTwnYXV0bycgfCAnb2ZmJyB8ICdvbic+KCdlZGl0b3IuYWNjZXNzaWJpbGl0eVN1cHBvcnQnKTtcblx0XHRjb25zdCBjdXJzb3JCbGlua2luZyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J2JsaW5rJyB8ICdzbW9vdGgnIHwgJ3BoYXNlJyB8ICdleHBhbmQnIHwgJ3NvbGlkJz4oJ2VkaXRvci5jdXJzb3JCbGlua2luZycpO1xuXHRcdGNvbnN0IGN1cnNvclN0eWxlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRWRpdG9yT3B0aW9uc1snY3Vyc29yU3R5bGUnXT4oJ2VkaXRvci5jdXJzb3JTdHlsZScpO1xuXHRcdGNvbnN0IGN1cnNvcldpZHRoID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRWRpdG9yT3B0aW9uc1snY3Vyc29yV2lkdGgnXT4oJ2VkaXRvci5jdXJzb3JXaWR0aCcpID8/IDE7XG5cdFx0Y29uc3QgZW1wdHlTZWxlY3Rpb25DbGlwYm9hcmQgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KCdlZGl0b3IuZW1wdHlTZWxlY3Rpb25DbGlwYm9hcmQnKSA9PT0gdHJ1ZTtcblxuXHRcdHJldHVybiB7IC4uLnRoaXMuX2dldEVkaXRvckxhbmd1YWdlQ29uZmlndXJhdGlvbigpLCBhY2Nlc3NpYmlsaXR5U3VwcG9ydCwgY3Vyc29yQmxpbmtpbmcsIGN1cnNvclN0eWxlLCBjdXJzb3JXaWR0aCwgZm9udEZhbWlseSwgZm9udFNpemUsIGxpbmVIZWlnaHQsIGVtcHR5U2VsZWN0aW9uQ2xpcGJvYXJkIH07XG5cdH1cblxuXHRwcml2YXRlIF9nZXRFZGl0b3JGb250RmFtaWx5KCk6IHN0cmluZyB7XG5cdFx0Y29uc3QgaW5wdXRGb250RmFtaWx5ID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxzdHJpbmc+KCdzY20uaW5wdXRGb250RmFtaWx5JykudHJpbSgpO1xuXG5cdFx0aWYgKGlucHV0Rm9udEZhbWlseS50b0xvd2VyQ2FzZSgpID09PSAnZWRpdG9yJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8c3RyaW5nPignZWRpdG9yLmZvbnRGYW1pbHknKS50cmltKCk7XG5cdFx0fVxuXG5cdFx0aWYgKGlucHV0Rm9udEZhbWlseS5sZW5ndGggIT09IDAgJiYgaW5wdXRGb250RmFtaWx5LnRvTG93ZXJDYXNlKCkgIT09ICdkZWZhdWx0Jykge1xuXHRcdFx0cmV0dXJuIGlucHV0Rm9udEZhbWlseTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5kZWZhdWx0SW5wdXRGb250RmFtaWx5O1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0RWRpdG9yRm9udFNpemUoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KCdzY20uaW5wdXRGb250U2l6ZScpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0RWRpdG9yTGFuZ3VhZ2VDb25maWd1cmF0aW9uKCk6IElFZGl0b3JPcHRpb25zIHtcblx0XHQvLyBlZGl0b3IucnVsZXJzXG5cdFx0Y29uc3QgcnVsZXJzQ29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0KCdlZGl0b3IucnVsZXJzJywgeyBvdmVycmlkZUlkZW50aWZpZXI6ICdzY21pbnB1dCcgfSk7XG5cdFx0Y29uc3QgcnVsZXJzID0gcnVsZXJzQ29uZmlnLm92ZXJyaWRlSWRlbnRpZmllcnM/LmluY2x1ZGVzKCdzY21pbnB1dCcpID8gRWRpdG9yT3B0aW9ucy5ydWxlcnMudmFsaWRhdGUocnVsZXJzQ29uZmlnLnZhbHVlKSA6IFtdO1xuXG5cdFx0Ly8gZWRpdG9yLndvcmRXcmFwXG5cdFx0Y29uc3Qgd29yZFdyYXBDb25maWcgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmluc3BlY3QoJ2VkaXRvci53b3JkV3JhcCcsIHsgb3ZlcnJpZGVJZGVudGlmaWVyOiAnc2NtaW5wdXQnIH0pO1xuXHRcdGNvbnN0IHdvcmRXcmFwID0gd29yZFdyYXBDb25maWcub3ZlcnJpZGVJZGVudGlmaWVycz8uaW5jbHVkZXMoJ3NjbWlucHV0JykgPyBFZGl0b3JPcHRpb25zLndvcmRXcmFwLnZhbGlkYXRlKHdvcmRXcmFwQ29uZmlnLnZhbHVlKSA6ICdvbic7XG5cblx0XHRyZXR1cm4geyBydWxlcnMsIHdvcmRXcmFwIH07XG5cdH1cblxuXHRwcml2YXRlIF9nZXRFZGl0b3JMaW5lSGVpZ2h0KGZvbnRTaXplOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiBNYXRoLnJvdW5kKGZvbnRTaXplICogMS41KTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cbn1cblxuY2xhc3MgU0NNSW5wdXRXaWRnZXQge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFZhbGlkYXRpb25UaW1lb3V0czogeyBbc2V2ZXJpdHk6IG51bWJlcl06IG51bWJlciB9ID0ge1xuXHRcdFtJbnB1dFZhbGlkYXRpb25UeXBlLkluZm9ybWF0aW9uXTogNTAwMCxcblx0XHRbSW5wdXRWYWxpZGF0aW9uVHlwZS5XYXJuaW5nXTogODAwMCxcblx0XHRbSW5wdXRWYWxpZGF0aW9uVHlwZS5FcnJvcl06IDEwMDAwXG5cdH07XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlO1xuXG5cdHByaXZhdGUgZWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgZWRpdG9yQ29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBpbnB1dEVkaXRvcjogQ29kZUVkaXRvcldpZGdldDtcblx0cHJpdmF0ZSByZWFkb25seSBpbnB1dEVkaXRvck9wdGlvbnM6IFNDTUlucHV0V2lkZ2V0RWRpdG9yT3B0aW9ucztcblx0cHJpdmF0ZSB0b29sYmFyQ29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSB0b29sYmFyOiBTQ01JbnB1dFdpZGdldFRvb2xiYXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSBtb2RlbDogeyByZWFkb25seSBpbnB1dDogSVNDTUlucHV0OyByZWFkb25seSB0ZXh0TW9kZWw6IElUZXh0TW9kZWwgfSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZXBvc2l0b3J5SWRDb250ZXh0S2V5OiBJQ29udGV4dEtleTxzdHJpbmcgfCB1bmRlZmluZWQ+O1xuXHRwcml2YXRlIHJlYWRvbmx5IHJlcG9zaXRvcnlEaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRwcml2YXRlIHZhbGlkYXRpb246IElJbnB1dFZhbGlkYXRpb24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgdmFsaWRhdGlvbkNvbnRleHRWaWV3OiBJT3BlbkNvbnRleHRWaWV3IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHZhbGlkYXRpb25IYXNGb2N1czogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF92YWxpZGF0aW9uVGltZXI6IGFueTtcblxuXHQvLyBUaGlzIGlzIGR1ZSB0byBcIlNldHVwIGhlaWdodCBjaGFuZ2UgbGlzdGVuZXIgb24gbmV4dCB0aWNrXCIgYWJvdmVcblx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEwODA2N1xuXHRwcml2YXRlIGxhc3RMYXlvdXRXYXNUcmFzaCA9IGZhbHNlO1xuXHRwcml2YXRlIHNob3VsZEZvY3VzQWZ0ZXJMYXlvdXQgPSBmYWxzZTtcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQ6IEV2ZW50PHZvaWQ+O1xuXG5cdGdldCBpbnB1dCgpOiBJU0NNSW5wdXQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsPy5pbnB1dDtcblx0fVxuXG5cdHNldCBpbnB1dChpbnB1dDogSVNDTUlucHV0IHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKGlucHV0ID09PSB0aGlzLmlucHV0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5jbGVhclZhbGlkYXRpb24oKTtcblx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnc3ludGhldGljLWZvY3VzJyk7XG5cblx0XHR0aGlzLnJlcG9zaXRvcnlEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRoaXMucmVwb3NpdG9yeUlkQ29udGV4dEtleS5zZXQoaW5wdXQ/LnJlcG9zaXRvcnkuaWQpO1xuXG5cdFx0aWYgKCFpbnB1dCkge1xuXHRcdFx0dGhpcy5pbnB1dEVkaXRvci5zZXRNb2RlbCh1bmRlZmluZWQpO1xuXHRcdFx0dGhpcy5tb2RlbCA9IHVuZGVmaW5lZDtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB0ZXh0TW9kZWwgPSBpbnB1dC5yZXBvc2l0b3J5LnByb3ZpZGVyLmlucHV0Qm94VGV4dE1vZGVsO1xuXHRcdHRoaXMuaW5wdXRFZGl0b3Iuc2V0TW9kZWwodGV4dE1vZGVsKTtcblxuXHRcdGlmICh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdlZGl0b3Iud29yZEJhc2VkU3VnZ2VzdGlvbnMnLCB7IHJlc291cmNlOiB0ZXh0TW9kZWwudXJpIH0pICE9PSAnb2ZmJykge1xuXHRcdFx0dGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZSgnZWRpdG9yLndvcmRCYXNlZFN1Z2dlc3Rpb25zJywgJ29mZicsIHsgcmVzb3VyY2U6IHRleHRNb2RlbC51cmkgfSwgQ29uZmlndXJhdGlvblRhcmdldC5NRU1PUlkpO1xuXHRcdH1cblxuXHRcdC8vIFZhbGlkYXRpb25cblx0XHRjb25zdCB2YWxpZGF0aW9uRGVsYXllciA9IG5ldyBUaHJvdHRsZWREZWxheWVyPGFueT4oMjAwKTtcblx0XHRjb25zdCB2YWxpZGF0ZSA9IGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHBvc2l0aW9uID0gdGhpcy5pbnB1dEVkaXRvci5nZXRTZWxlY3Rpb24oKT8uZ2V0U3RhcnRQb3NpdGlvbigpO1xuXHRcdFx0Y29uc3Qgb2Zmc2V0ID0gcG9zaXRpb24gJiYgdGV4dE1vZGVsLmdldE9mZnNldEF0KHBvc2l0aW9uKTtcblx0XHRcdGNvbnN0IHZhbHVlID0gdGV4dE1vZGVsLmdldFZhbHVlKCk7XG5cblx0XHRcdHRoaXMuc2V0VmFsaWRhdGlvbihhd2FpdCBpbnB1dC52YWxpZGF0ZUlucHV0KHZhbHVlLCBvZmZzZXQgfHwgMCkpO1xuXHRcdH07XG5cblx0XHRjb25zdCB0cmlnZ2VyVmFsaWRhdGlvbiA9ICgpID0+IHZhbGlkYXRpb25EZWxheWVyLnRyaWdnZXIodmFsaWRhdGUpO1xuXHRcdHRoaXMucmVwb3NpdG9yeURpc3Bvc2FibGVzLmFkZCh2YWxpZGF0aW9uRGVsYXllcik7XG5cdFx0dGhpcy5yZXBvc2l0b3J5RGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5wdXRFZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbih0cmlnZ2VyVmFsaWRhdGlvbikpO1xuXG5cdFx0Ly8gQWRhcHRpdmUgaW5kZW50YXRpb24gcnVsZXNcblx0XHRjb25zdCBvcHRzID0gdGhpcy5tb2RlbFNlcnZpY2UuZ2V0Q3JlYXRpb25PcHRpb25zKHRleHRNb2RlbC5nZXRMYW5ndWFnZUlkKCksIHRleHRNb2RlbC51cmksIHRleHRNb2RlbC5pc0ZvclNpbXBsZVdpZGdldCk7XG5cdFx0Y29uc3Qgb25FbnRlciA9IEV2ZW50LmZpbHRlcih0aGlzLmlucHV0RWRpdG9yLm9uS2V5RG93biwgZSA9PiBlLmtleUNvZGUgPT09IEtleUNvZGUuRW50ZXIsIHRoaXMucmVwb3NpdG9yeURpc3Bvc2FibGVzKTtcblx0XHR0aGlzLnJlcG9zaXRvcnlEaXNwb3NhYmxlcy5hZGQob25FbnRlcigoKSA9PiB0ZXh0TW9kZWwuZGV0ZWN0SW5kZW50YXRpb24ob3B0cy5pbnNlcnRTcGFjZXMsIG9wdHMudGFiU2l6ZSkpKTtcblxuXHRcdC8vIEtlZXAgbW9kZWwgaW4gc3luYyB3aXRoIEFQSVxuXHRcdHRleHRNb2RlbC5zZXRWYWx1ZShpbnB1dC52YWx1ZSk7XG5cdFx0dGhpcy5yZXBvc2l0b3J5RGlzcG9zYWJsZXMuYWRkKGlucHV0Lm9uRGlkQ2hhbmdlKCh7IHZhbHVlLCByZWFzb24gfSkgPT4ge1xuXHRcdFx0Y29uc3QgY3VycmVudFZhbHVlID0gdGV4dE1vZGVsLmdldFZhbHVlKCk7XG5cdFx0XHRpZiAodmFsdWUgPT09IGN1cnJlbnRWYWx1ZSkgeyAvLyBjaXJjdWl0IGJyZWFrZXJcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0ZXh0TW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdFx0dGV4dE1vZGVsLnB1c2hFZGl0T3BlcmF0aW9ucyhudWxsLCBbRWRpdE9wZXJhdGlvbi5yZXBsYWNlTW92ZSh0ZXh0TW9kZWwuZ2V0RnVsbE1vZGVsUmFuZ2UoKSwgdmFsdWUpXSwgKCkgPT4gW10pO1xuXG5cdFx0XHRjb25zdCBwb3NpdGlvbiA9IHJlYXNvbiA9PT0gU0NNSW5wdXRDaGFuZ2VSZWFzb24uSGlzdG9yeVByZXZpb3VzXG5cdFx0XHRcdD8gdGV4dE1vZGVsLmdldEZ1bGxNb2RlbFJhbmdlKCkuZ2V0U3RhcnRQb3NpdGlvbigpXG5cdFx0XHRcdDogdGV4dE1vZGVsLmdldEZ1bGxNb2RlbFJhbmdlKCkuZ2V0RW5kUG9zaXRpb24oKTtcblx0XHRcdHRoaXMuaW5wdXRFZGl0b3Iuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuXHRcdFx0dGhpcy5pbnB1dEVkaXRvci5yZXZlYWxQb3NpdGlvbkluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQocG9zaXRpb24pO1xuXHRcdH0pKTtcblx0XHR0aGlzLnJlcG9zaXRvcnlEaXNwb3NhYmxlcy5hZGQoaW5wdXQub25EaWRDaGFuZ2VGb2N1cygoKSA9PiB0aGlzLmZvY3VzKCkpKTtcblx0XHR0aGlzLnJlcG9zaXRvcnlEaXNwb3NhYmxlcy5hZGQoaW5wdXQub25EaWRDaGFuZ2VWYWxpZGF0aW9uTWVzc2FnZSgoZSkgPT4gdGhpcy5zZXRWYWxpZGF0aW9uKGUsIHsgZm9jdXM6IHRydWUsIHRpbWVvdXQ6IHRydWUgfSkpKTtcblx0XHR0aGlzLnJlcG9zaXRvcnlEaXNwb3NhYmxlcy5hZGQoaW5wdXQub25EaWRDaGFuZ2VWYWxpZGF0ZUlucHV0KChlKSA9PiB0cmlnZ2VyVmFsaWRhdGlvbigpKSk7XG5cblx0XHQvLyBLZWVwIEFQSSBpbiBzeW5jIHdpdGggbW9kZWwgYW5kIHZhbGlkYXRlXG5cdFx0dGhpcy5yZXBvc2l0b3J5RGlzcG9zYWJsZXMuYWRkKHRleHRNb2RlbC5vbkRpZENoYW5nZUNvbnRlbnQoKCkgPT4ge1xuXHRcdFx0aW5wdXQuc2V0VmFsdWUodGV4dE1vZGVsLmdldFZhbHVlKCksIHRydWUpO1xuXHRcdFx0dHJpZ2dlclZhbGlkYXRpb24oKTtcblx0XHR9KSk7XG5cblx0XHQvLyBBcmlhIGxhYmVsICYgcGxhY2Vob2xkZXIgdGV4dFxuXHRcdGNvbnN0IGFjY2Vzc2liaWxpdHlWZXJib3NpdHlDb25maWcgPSBvYnNlcnZhYmxlQ29uZmlnVmFsdWUoXG5cdFx0XHRBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkLlNvdXJjZUNvbnRyb2wsIHRydWUsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZ2V0QXJpYUxhYmVsID0gKHBsYWNlaG9sZGVyOiBzdHJpbmcsIHZlcmJvc2l0eT86IGJvb2xlYW4pID0+IHtcblx0XHRcdHZlcmJvc2l0eSA9IHZlcmJvc2l0eSA/PyBhY2Nlc3NpYmlsaXR5VmVyYm9zaXR5Q29uZmlnLmdldCgpO1xuXG5cdFx0XHRpZiAoIXZlcmJvc2l0eSB8fCAhdGhpcy5hY2Nlc3NpYmlsaXR5U2VydmljZS5pc1NjcmVlblJlYWRlck9wdGltaXplZCgpKSB7XG5cdFx0XHRcdHJldHVybiBwbGFjZWhvbGRlcjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qga2JMYWJlbCA9IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhBY2Nlc3NpYmlsaXR5Q29tbWFuZElkLk9wZW5BY2Nlc3NpYmlsaXR5SGVscCk/LmdldExhYmVsKCk7XG5cdFx0XHRyZXR1cm4ga2JMYWJlbFxuXHRcdFx0XHQ/IGxvY2FsaXplKCdzY21JbnB1dC5hY2Nlc3NpYmlsaXR5SGVscCcsIFwiezB9LCBVc2UgezF9IHRvIG9wZW4gU291cmNlIENvbnRyb2wgQWNjZXNzaWJpbGl0eSBIZWxwLlwiLCBwbGFjZWhvbGRlciwga2JMYWJlbClcblx0XHRcdFx0OiBsb2NhbGl6ZSgnc2NtSW5wdXQuYWNjZXNzaWJpbGl0eUhlbHBOb0tiJywgXCJ7MH0sIFJ1biB0aGUgT3BlbiBBY2Nlc3NpYmlsaXR5IEhlbHAgY29tbWFuZCBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cIiwgcGxhY2Vob2xkZXIpO1xuXHRcdH07XG5cblx0XHRjb25zdCBnZXRQbGFjZWhvbGRlclRleHQgPSAoKTogc3RyaW5nID0+IHtcblx0XHRcdGNvbnN0IGJpbmRpbmcgPSB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoJ3NjbS5hY2NlcHRJbnB1dCcpO1xuXHRcdFx0Y29uc3QgbGFiZWwgPSBiaW5kaW5nID8gYmluZGluZy5nZXRMYWJlbCgpIDogKHBsYXRmb3JtLmlzTWFjaW50b3NoID8gJ0NtZCtFbnRlcicgOiAnQ3RybCtFbnRlcicpO1xuXHRcdFx0cmV0dXJuIGZvcm1hdChpbnB1dC5wbGFjZWhvbGRlciwgbGFiZWwpO1xuXHRcdH07XG5cblx0XHRjb25zdCB1cGRhdGVQbGFjZWhvbGRlclRleHQgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBwbGFjZWhvbGRlciA9IGdldFBsYWNlaG9sZGVyVGV4dCgpO1xuXHRcdFx0Y29uc3QgYXJpYUxhYmVsID0gZ2V0QXJpYUxhYmVsKHBsYWNlaG9sZGVyKTtcblxuXHRcdFx0dGhpcy5pbnB1dEVkaXRvci51cGRhdGVPcHRpb25zKHsgYXJpYUxhYmVsLCBwbGFjZWhvbGRlciB9KTtcblx0XHR9O1xuXG5cdFx0dGhpcy5yZXBvc2l0b3J5RGlzcG9zYWJsZXMuYWRkKGlucHV0Lm9uRGlkQ2hhbmdlUGxhY2Vob2xkZXIodXBkYXRlUGxhY2Vob2xkZXJUZXh0KSk7XG5cdFx0dGhpcy5yZXBvc2l0b3J5RGlzcG9zYWJsZXMuYWRkKHRoaXMua2V5YmluZGluZ1NlcnZpY2Uub25EaWRVcGRhdGVLZXliaW5kaW5ncyh1cGRhdGVQbGFjZWhvbGRlclRleHQpKTtcblxuXHRcdHRoaXMucmVwb3NpdG9yeURpc3Bvc2FibGVzLmFkZChydW5PbkNoYW5nZShhY2Nlc3NpYmlsaXR5VmVyYm9zaXR5Q29uZmlnLCB2ZXJib3NpdHkgPT4ge1xuXHRcdFx0Y29uc3QgcGxhY2Vob2xkZXIgPSBnZXRQbGFjZWhvbGRlclRleHQoKTtcblx0XHRcdGNvbnN0IGFyaWFMYWJlbCA9IGdldEFyaWFMYWJlbChwbGFjZWhvbGRlciwgdmVyYm9zaXR5KTtcblxuXHRcdFx0dGhpcy5pbnB1dEVkaXRvci51cGRhdGVPcHRpb25zKHsgYXJpYUxhYmVsIH0pO1xuXHRcdH0pKTtcblxuXHRcdHVwZGF0ZVBsYWNlaG9sZGVyVGV4dCgpO1xuXG5cdFx0Ly8gVXBkYXRlIGlucHV0IHRlbXBsYXRlXG5cdFx0bGV0IGNvbW1pdFRlbXBsYXRlID0gJyc7XG5cdFx0dGhpcy5yZXBvc2l0b3J5RGlzcG9zYWJsZXMuYWRkKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdGlmICghaW5wdXQudmlzaWJsZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG9sZENvbW1pdFRlbXBsYXRlID0gY29tbWl0VGVtcGxhdGU7XG5cdFx0XHRjb21taXRUZW1wbGF0ZSA9IGlucHV0LnJlcG9zaXRvcnkucHJvdmlkZXIuY29tbWl0VGVtcGxhdGUucmVhZChyZWFkZXIpO1xuXG5cdFx0XHRjb25zdCB2YWx1ZSA9IHRleHRNb2RlbC5nZXRWYWx1ZSgpO1xuXHRcdFx0aWYgKHZhbHVlICYmIHZhbHVlICE9PSBvbGRDb21taXRUZW1wbGF0ZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRleHRNb2RlbC5zZXRWYWx1ZShjb21taXRUZW1wbGF0ZSk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gVXBkYXRlIGlucHV0IGVuYWJsZW1lbnRcblx0XHRjb25zdCB1cGRhdGVFbmFibGVtZW50ID0gKGVuYWJsZWQ6IGJvb2xlYW4pID0+IHtcblx0XHRcdHRoaXMuaW5wdXRFZGl0b3IudXBkYXRlT3B0aW9ucyh7IHJlYWRPbmx5OiAhZW5hYmxlZCB9KTtcblx0XHR9O1xuXHRcdHRoaXMucmVwb3NpdG9yeURpc3Bvc2FibGVzLmFkZChpbnB1dC5vbkRpZENoYW5nZUVuYWJsZW1lbnQoZW5hYmxlZCA9PiB1cGRhdGVFbmFibGVtZW50KGVuYWJsZWQpKSk7XG5cdFx0dXBkYXRlRW5hYmxlbWVudChpbnB1dC5lbmFibGVkKTtcblxuXHRcdC8vIFRvb2xiYXJcblx0XHR0aGlzLnRvb2xiYXIuc2V0SW5wdXQoaW5wdXQpO1xuXG5cdFx0Ly8gU2F2ZSBtb2RlbFxuXHRcdHRoaXMubW9kZWwgPSB7IGlucHV0LCB0ZXh0TW9kZWwgfTtcblx0fVxuXG5cdGdldCBzZWxlY3Rpb25zKCk6IFNlbGVjdGlvbltdIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuaW5wdXRFZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHR9XG5cblx0c2V0IHNlbGVjdGlvbnMoc2VsZWN0aW9uczogU2VsZWN0aW9uW10gfCBudWxsKSB7XG5cdFx0aWYgKHNlbGVjdGlvbnMpIHtcblx0XHRcdHRoaXMuaW5wdXRFZGl0b3Iuc2V0U2VsZWN0aW9ucyhzZWxlY3Rpb25zKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldFZhbGlkYXRpb24odmFsaWRhdGlvbjogSUlucHV0VmFsaWRhdGlvbiB8IHVuZGVmaW5lZCwgb3B0aW9ucz86IHsgZm9jdXM/OiBib29sZWFuOyB0aW1lb3V0PzogYm9vbGVhbiB9KSB7XG5cdFx0aWYgKHRoaXMuX3ZhbGlkYXRpb25UaW1lcikge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMuX3ZhbGlkYXRpb25UaW1lcik7XG5cdFx0XHR0aGlzLl92YWxpZGF0aW9uVGltZXIgPSAwO1xuXHRcdH1cblxuXHRcdHRoaXMudmFsaWRhdGlvbiA9IHZhbGlkYXRpb247XG5cdFx0dGhpcy5yZW5kZXJWYWxpZGF0aW9uKCk7XG5cblx0XHRpZiAob3B0aW9ucz8uZm9jdXMgJiYgIXRoaXMuaGFzRm9jdXMoKSkge1xuXHRcdFx0dGhpcy5mb2N1cygpO1xuXHRcdH1cblxuXHRcdGlmICh2YWxpZGF0aW9uICYmIG9wdGlvbnM/LnRpbWVvdXQpIHtcblx0XHRcdHRoaXMuX3ZhbGlkYXRpb25UaW1lciA9IHNldFRpbWVvdXQoKCkgPT4gdGhpcy5zZXRWYWxpZGF0aW9uKHVuZGVmaW5lZCksIFNDTUlucHV0V2lkZ2V0LlZhbGlkYXRpb25UaW1lb3V0c1t2YWxpZGF0aW9uLnR5cGVdKTtcblx0XHR9XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdG92ZXJmbG93V2lkZ2V0c0RvbU5vZGU6IEhUTUxFbGVtZW50LFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVNDTVZpZXdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc2NtVmlld1NlcnZpY2U6IElTQ01WaWV3U2VydmljZSxcblx0XHRASUNvbnRleHRWaWV3U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZVxuXHQpIHtcblx0XHR0aGlzLmVsZW1lbnQgPSBhcHBlbmQoY29udGFpbmVyLCAkKCcuc2NtLWVkaXRvcicpKTtcblx0XHR0aGlzLmVkaXRvckNvbnRhaW5lciA9IGFwcGVuZCh0aGlzLmVsZW1lbnQsICQoJy5zY20tZWRpdG9yLWNvbnRhaW5lcicpKTtcblx0XHR0aGlzLnRvb2xiYXJDb250YWluZXIgPSBhcHBlbmQodGhpcy5lbGVtZW50LCAkKCcuc2NtLWVkaXRvci10b29sYmFyJykpO1xuXG5cdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZSA9IGNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZCh0aGlzLmVsZW1lbnQpO1xuXHRcdHRoaXMucmVwb3NpdG9yeUlkQ29udGV4dEtleSA9IHRoaXMuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlS2V5KCdzY21SZXBvc2l0b3J5JywgdW5kZWZpbmVkKTtcblxuXHRcdHRoaXMuaW5wdXRFZGl0b3JPcHRpb25zID0gbmV3IFNDTUlucHV0V2lkZ2V0RWRpdG9yT3B0aW9ucyhvdmVyZmxvd1dpZGdldHNEb21Ob2RlLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLmlucHV0RWRpdG9yT3B0aW9ucy5vbkRpZENoYW5nZSh0aGlzLm9uRGlkQ2hhbmdlRWRpdG9yT3B0aW9ucywgdGhpcykpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5wdXRFZGl0b3JPcHRpb25zKTtcblxuXHRcdGNvbnN0IGNvZGVFZGl0b3JXaWRnZXRPcHRpb25zOiBJQ29kZUVkaXRvcldpZGdldE9wdGlvbnMgPSB7XG5cdFx0XHRjb250cmlidXRpb25zOiBFZGl0b3JFeHRlbnNpb25zUmVnaXN0cnkuZ2V0U29tZUVkaXRvckNvbnRyaWJ1dGlvbnMoW1xuXHRcdFx0XHRDb2RlQWN0aW9uQ29udHJvbGxlci5JRCxcblx0XHRcdFx0Q29sb3JEZXRlY3Rvci5JRCxcblx0XHRcdFx0Q29udGV4dE1lbnVDb250cm9sbGVyLklELFxuXHRcdFx0XHRDb3B5UGFzdGVDb250cm9sbGVyLklELFxuXHRcdFx0XHREcmFnQW5kRHJvcENvbnRyb2xsZXIuSUQsXG5cdFx0XHRcdERyb3BJbnRvRWRpdG9yQ29udHJvbGxlci5JRCxcblx0XHRcdFx0RWRpdG9yRGljdGF0aW9uLklELFxuXHRcdFx0XHRGb3JtYXRPblR5cGUuSUQsXG5cdFx0XHRcdENvbnRlbnRIb3ZlckNvbnRyb2xsZXIuSUQsXG5cdFx0XHRcdEdseXBoSG92ZXJDb250cm9sbGVyLklELFxuXHRcdFx0XHRJbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIuSUQsXG5cdFx0XHRcdExpbmtEZXRlY3Rvci5JRCxcblx0XHRcdFx0TWVudVByZXZlbnRlci5JRCxcblx0XHRcdFx0TWVzc2FnZUNvbnRyb2xsZXIuSUQsXG5cdFx0XHRcdFBsYWNlaG9sZGVyVGV4dENvbnRyaWJ1dGlvbi5JRCxcblx0XHRcdFx0U2VsZWN0aW9uQ2xpcGJvYXJkQ29udHJpYnV0aW9uSUQsXG5cdFx0XHRcdFNuaXBwZXRDb250cm9sbGVyMi5JRCxcblx0XHRcdFx0U3VnZ2VzdENvbnRyb2xsZXIuSURcblx0XHRcdF0pLFxuXHRcdFx0aXNTaW1wbGVXaWRnZXQ6IHRydWVcblx0XHR9O1xuXG5cdFx0Y29uc3Qgc2VydmljZXMgPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oW0lDb250ZXh0S2V5U2VydmljZSwgdGhpcy5jb250ZXh0S2V5U2VydmljZV0pO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlMiA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKHNlcnZpY2VzLCB0aGlzLmRpc3Bvc2FibGVzKTtcblx0XHRjb25zdCBlZGl0b3JDb25zdHJ1Y3Rpb25PcHRpb25zID0gdGhpcy5pbnB1dEVkaXRvck9wdGlvbnMuZ2V0RWRpdG9yQ29uc3RydWN0aW9uT3B0aW9ucygpO1xuXHRcdHRoaXMuaW5wdXRFZGl0b3IgPSBpbnN0YW50aWF0aW9uU2VydmljZTIuY3JlYXRlSW5zdGFuY2UoQ29kZUVkaXRvcldpZGdldCwgdGhpcy5lZGl0b3JDb250YWluZXIsIGVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnMsIGNvZGVFZGl0b3JXaWRnZXRPcHRpb25zKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLmlucHV0RWRpdG9yKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5wdXRFZGl0b3Iub25EaWRGb2N1c0VkaXRvclRleHQoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuaW5wdXQ/LnJlcG9zaXRvcnkpIHtcblx0XHRcdFx0dGhpcy5zY21WaWV3U2VydmljZS5mb2N1cyh0aGlzLmlucHV0LnJlcG9zaXRvcnkpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnc3ludGhldGljLWZvY3VzJyk7XG5cdFx0XHR0aGlzLnJlbmRlclZhbGlkYXRpb24oKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5pbnB1dEVkaXRvci5vbkRpZEJsdXJFZGl0b3JUZXh0KCgpID0+IHtcblx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdzeW50aGV0aWMtZm9jdXMnKTtcblxuXHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy52YWxpZGF0aW9uIHx8ICF0aGlzLnZhbGlkYXRpb25IYXNGb2N1cykge1xuXHRcdFx0XHRcdHRoaXMuY2xlYXJWYWxpZGF0aW9uKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIDApO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5wdXRFZGl0b3Iub25EaWRCbHVyRWRpdG9yV2lkZ2V0KCgpID0+IHtcblx0XHRcdENvcHlQYXN0ZUNvbnRyb2xsZXIuZ2V0KHRoaXMuaW5wdXRFZGl0b3IpPy5jbGVhcldpZGdldHMoKTtcblx0XHRcdERyb3BJbnRvRWRpdG9yQ29udHJvbGxlci5nZXQodGhpcy5pbnB1dEVkaXRvcik/LmNsZWFyV2lkZ2V0cygpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGZpcnN0TGluZUtleSA9IHRoaXMuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlS2V5PGJvb2xlYW4+KCdzY21JbnB1dElzSW5GaXJzdFBvc2l0aW9uJywgZmFsc2UpO1xuXHRcdGNvbnN0IGxhc3RMaW5lS2V5ID0gdGhpcy5jb250ZXh0S2V5U2VydmljZS5jcmVhdGVLZXk8Ym9vbGVhbj4oJ3NjbUlucHV0SXNJbkxhc3RQb3NpdGlvbicsIGZhbHNlKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5wdXRFZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbigoeyBwb3NpdGlvbiB9KSA9PiB7XG5cdFx0XHRjb25zdCB2aWV3TW9kZWwgPSB0aGlzLmlucHV0RWRpdG9yLl9nZXRWaWV3TW9kZWwoKSE7XG5cdFx0XHRjb25zdCBsYXN0TGluZU51bWJlciA9IHZpZXdNb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0XHRcdGNvbnN0IGxhc3RMaW5lQ29sID0gdmlld01vZGVsLmdldExpbmVMZW5ndGgobGFzdExpbmVOdW1iZXIpICsgMTtcblx0XHRcdGNvbnN0IHZpZXdQb3NpdGlvbiA9IHZpZXdNb2RlbC5jb29yZGluYXRlc0NvbnZlcnRlci5jb252ZXJ0TW9kZWxQb3NpdGlvblRvVmlld1Bvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHRcdGZpcnN0TGluZUtleS5zZXQodmlld1Bvc2l0aW9uLmxpbmVOdW1iZXIgPT09IDEgJiYgdmlld1Bvc2l0aW9uLmNvbHVtbiA9PT0gMSk7XG5cdFx0XHRsYXN0TGluZUtleS5zZXQodmlld1Bvc2l0aW9uLmxpbmVOdW1iZXIgPT09IGxhc3RMaW5lTnVtYmVyICYmIHZpZXdQb3NpdGlvbi5jb2x1bW4gPT09IGxhc3RMaW5lQ29sKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5pbnB1dEVkaXRvci5vbkRpZFNjcm9sbENoYW5nZShlID0+IHtcblx0XHRcdHRoaXMudG9vbGJhckNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdzY3JvbGwtZGVjb3JhdGlvbicsIGUuc2Nyb2xsVG9wID4gMCk7XG5cdFx0fSkpO1xuXG5cdFx0RXZlbnQuZmlsdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLCBlID0+IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3NjbS5zaG93SW5wdXRBY3Rpb25CdXR0b24nKSkoKCkgPT4gdGhpcy5sYXlvdXQoKSwgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cblx0XHR0aGlzLm9uRGlkQ2hhbmdlQ29udGVudEhlaWdodCA9IEV2ZW50LnNpZ25hbChFdmVudC5maWx0ZXIodGhpcy5pbnB1dEVkaXRvci5vbkRpZENvbnRlbnRTaXplQ2hhbmdlLCBlID0+IGUuY29udGVudEhlaWdodENoYW5nZWQsIHRoaXMuZGlzcG9zYWJsZXMpKTtcblxuXHRcdC8vIFRvb2xiYXJcblx0XHR0aGlzLnRvb2xiYXIgPSBpbnN0YW50aWF0aW9uU2VydmljZTIuY3JlYXRlSW5zdGFuY2UoU0NNSW5wdXRXaWRnZXRUb29sYmFyLCB0aGlzLnRvb2xiYXJDb250YWluZXIsIHtcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24sIG9wdGlvbnMpID0+IHtcblx0XHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uICYmIHRoaXMudG9vbGJhci5kcm9wZG93bkFjdGlvbnMubGVuZ3RoID4gMSkge1xuXHRcdFx0XHRcdHJldHVybiBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEcm9wZG93bldpdGhQcmltYXJ5QWN0aW9uVmlld0l0ZW0sIGFjdGlvbiwgdGhpcy50b29sYmFyLmRyb3Bkb3duQWN0aW9uLCB0aGlzLnRvb2xiYXIuZHJvcGRvd25BY3Rpb25zLCAnJywgeyBhY3Rpb25SdW5uZXI6IHRoaXMudG9vbGJhci5hY3Rpb25SdW5uZXIsIGhvdmVyRGVsZWdhdGU6IG9wdGlvbnMuaG92ZXJEZWxlZ2F0ZSB9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBjcmVhdGVBY3Rpb25WaWV3SXRlbShpbnN0YW50aWF0aW9uU2VydmljZSwgYWN0aW9uLCBvcHRpb25zKTtcblx0XHRcdH0sXG5cdFx0XHRtZW51T3B0aW9uczoge1xuXHRcdFx0XHRzaG91bGRGb3J3YXJkQXJnczogdHJ1ZVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMudG9vbGJhci5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLmxheW91dCgpKSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy50b29sYmFyKTtcblx0fVxuXG5cdGdldENvbnRlbnRIZWlnaHQoKTogbnVtYmVyIHtcblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gdGhpcy5pbnB1dEVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpO1xuXHRcdGNvbnN0IHsgdG9wLCBib3R0b20gfSA9IHRoaXMuaW5wdXRFZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5wYWRkaW5nKTtcblxuXHRcdGNvbnN0IGlucHV0TWluTGluZXNDb25maWcgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdzY20uaW5wdXRNaW5MaW5lQ291bnQnKTtcblx0XHRjb25zdCBpbnB1dE1pbkxpbmVzID0gdHlwZW9mIGlucHV0TWluTGluZXNDb25maWcgPT09ICdudW1iZXInID8gY2xhbXAoaW5wdXRNaW5MaW5lc0NvbmZpZywgMSwgNTApIDogMTtcblx0XHRjb25zdCBlZGl0b3JNaW5IZWlnaHQgPSBpbnB1dE1pbkxpbmVzICogbGluZUhlaWdodCArIHRvcCArIGJvdHRvbTtcblxuXHRcdGNvbnN0IGlucHV0TWF4TGluZXNDb25maWcgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdzY20uaW5wdXRNYXhMaW5lQ291bnQnKTtcblx0XHRjb25zdCBpbnB1dE1heExpbmVzID0gdHlwZW9mIGlucHV0TWF4TGluZXNDb25maWcgPT09ICdudW1iZXInID8gY2xhbXAoaW5wdXRNYXhMaW5lc0NvbmZpZywgMSwgNTApIDogMTA7XG5cdFx0Y29uc3QgZWRpdG9yTWF4SGVpZ2h0ID0gaW5wdXRNYXhMaW5lcyAqIGxpbmVIZWlnaHQgKyB0b3AgKyBib3R0b207XG5cblx0XHRyZXR1cm4gY2xhbXAodGhpcy5pbnB1dEVkaXRvci5nZXRDb250ZW50SGVpZ2h0KCksIGVkaXRvck1pbkhlaWdodCwgZWRpdG9yTWF4SGVpZ2h0KTtcblx0fVxuXG5cdGxheW91dCgpOiB2b2lkIHtcblx0XHRjb25zdCBlZGl0b3JIZWlnaHQgPSB0aGlzLmdldENvbnRlbnRIZWlnaHQoKTtcblx0XHRjb25zdCB0b29sYmFyV2lkdGggPSB0aGlzLmdldFRvb2xiYXJXaWR0aCgpO1xuXHRcdGNvbnN0IGRpbWVuc2lvbiA9IG5ldyBEaW1lbnNpb24odGhpcy5lbGVtZW50LmNsaWVudFdpZHRoIC0gdG9vbGJhcldpZHRoLCBlZGl0b3JIZWlnaHQpO1xuXG5cdFx0aWYgKGRpbWVuc2lvbi53aWR0aCA8IDApIHtcblx0XHRcdHRoaXMubGFzdExheW91dFdhc1RyYXNoID0gdHJ1ZTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmxhc3RMYXlvdXRXYXNUcmFzaCA9IGZhbHNlO1xuXHRcdHRoaXMuaW5wdXRFZGl0b3IubGF5b3V0KGRpbWVuc2lvbik7XG5cdFx0dGhpcy5yZW5kZXJWYWxpZGF0aW9uKCk7XG5cblx0XHRjb25zdCBzaG93SW5wdXRBY3Rpb25CdXR0b24gPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KCdzY20uc2hvd0lucHV0QWN0aW9uQnV0dG9uJykgPT09IHRydWU7XG5cdFx0dGhpcy50b29sYmFyQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsICFzaG93SW5wdXRBY3Rpb25CdXR0b24gfHwgdGhpcy50b29sYmFyPy5pc0VtcHR5KCkgPT09IHRydWUpO1xuXG5cdFx0aWYgKHRoaXMuc2hvdWxkRm9jdXNBZnRlckxheW91dCkge1xuXHRcdFx0dGhpcy5zaG91bGRGb2N1c0FmdGVyTGF5b3V0ID0gZmFsc2U7XG5cdFx0XHR0aGlzLmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0Zm9jdXMoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubGFzdExheW91dFdhc1RyYXNoKSB7XG5cdFx0XHR0aGlzLmxhc3RMYXlvdXRXYXNUcmFzaCA9IGZhbHNlO1xuXHRcdFx0dGhpcy5zaG91bGRGb2N1c0FmdGVyTGF5b3V0ID0gdHJ1ZTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmlucHV0RWRpdG9yLmZvY3VzKCk7XG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3N5bnRoZXRpYy1mb2N1cycpO1xuXHR9XG5cblx0aGFzRm9jdXMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuaW5wdXRFZGl0b3IuaGFzVGV4dEZvY3VzKCk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlRWRpdG9yT3B0aW9ucygpOiB2b2lkIHtcblx0XHR0aGlzLmlucHV0RWRpdG9yLnVwZGF0ZU9wdGlvbnModGhpcy5pbnB1dEVkaXRvck9wdGlvbnMuZ2V0RWRpdG9yT3B0aW9ucygpKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyVmFsaWRhdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLmNsZWFyVmFsaWRhdGlvbigpO1xuXG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ3ZhbGlkYXRpb24taW5mbycsIHRoaXMudmFsaWRhdGlvbj8udHlwZSA9PT0gSW5wdXRWYWxpZGF0aW9uVHlwZS5JbmZvcm1hdGlvbik7XG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ3ZhbGlkYXRpb24td2FybmluZycsIHRoaXMudmFsaWRhdGlvbj8udHlwZSA9PT0gSW5wdXRWYWxpZGF0aW9uVHlwZS5XYXJuaW5nKTtcblx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgndmFsaWRhdGlvbi1lcnJvcicsIHRoaXMudmFsaWRhdGlvbj8udHlwZSA9PT0gSW5wdXRWYWxpZGF0aW9uVHlwZS5FcnJvcik7XG5cblx0XHRpZiAoIXRoaXMudmFsaWRhdGlvbiB8fCAhdGhpcy5pbnB1dEVkaXRvci5oYXNUZXh0Rm9jdXMoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0dGhpcy52YWxpZGF0aW9uQ29udGV4dFZpZXcgPSB0aGlzLmNvbnRleHRWaWV3U2VydmljZS5zaG93Q29udGV4dFZpZXcoe1xuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiB0aGlzLmVsZW1lbnQsXG5cdFx0XHRyZW5kZXI6IGNvbnRhaW5lciA9PiB7XG5cdFx0XHRcdHRoaXMuZWxlbWVudC5zdHlsZS5ib3JkZXJCb3R0b21MZWZ0UmFkaXVzID0gJzAnO1xuXHRcdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuYm9yZGVyQm90dG9tUmlnaHRSYWRpdXMgPSAnMCc7XG5cblx0XHRcdFx0Y29uc3QgdmFsaWRhdGlvbkNvbnRhaW5lciA9IGFwcGVuZChjb250YWluZXIsICQoJy5zY20tZWRpdG9yLXZhbGlkYXRpb24tY29udGFpbmVyJykpO1xuXHRcdFx0XHR2YWxpZGF0aW9uQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ3ZhbGlkYXRpb24taW5mbycsIHRoaXMudmFsaWRhdGlvbiEudHlwZSA9PT0gSW5wdXRWYWxpZGF0aW9uVHlwZS5JbmZvcm1hdGlvbik7XG5cdFx0XHRcdHZhbGlkYXRpb25Db250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgndmFsaWRhdGlvbi13YXJuaW5nJywgdGhpcy52YWxpZGF0aW9uIS50eXBlID09PSBJbnB1dFZhbGlkYXRpb25UeXBlLldhcm5pbmcpO1xuXHRcdFx0XHR2YWxpZGF0aW9uQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ3ZhbGlkYXRpb24tZXJyb3InLCB0aGlzLnZhbGlkYXRpb24hLnR5cGUgPT09IElucHV0VmFsaWRhdGlvblR5cGUuRXJyb3IpO1xuXHRcdFx0XHR2YWxpZGF0aW9uQ29udGFpbmVyLnN0eWxlLndpZHRoID0gYCR7dGhpcy5lbGVtZW50LmNsaWVudFdpZHRoICsgMn1weGA7XG5cdFx0XHRcdGNvbnN0IGVsZW1lbnQgPSBhcHBlbmQodmFsaWRhdGlvbkNvbnRhaW5lciwgJCgnLnNjbS1lZGl0b3ItdmFsaWRhdGlvbicpKTtcblxuXHRcdFx0XHRjb25zdCBtZXNzYWdlID0gdGhpcy52YWxpZGF0aW9uIS5tZXNzYWdlO1xuXHRcdFx0XHRpZiAodHlwZW9mIG1lc3NhZ2UgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0ZWxlbWVudC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgdHJhY2tlciA9IHRyYWNrRm9jdXMoZWxlbWVudCk7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRyYWNrZXIpO1xuXHRcdFx0XHRcdGRpc3Bvc2FibGVzLmFkZCh0cmFja2VyLm9uRGlkRm9jdXMoKCkgPT4gKHRoaXMudmFsaWRhdGlvbkhhc0ZvY3VzID0gdHJ1ZSkpKTtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQodHJhY2tlci5vbkRpZEJsdXIoKCkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy52YWxpZGF0aW9uSGFzRm9jdXMgPSBmYWxzZTtcblx0XHRcdFx0XHRcdHRoaXMuZWxlbWVudC5zdHlsZS5ib3JkZXJCb3R0b21MZWZ0UmFkaXVzID0gJzJweCc7XG5cdFx0XHRcdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuYm9yZGVyQm90dG9tUmlnaHRSYWRpdXMgPSAnMnB4Jztcblx0XHRcdFx0XHRcdHRoaXMuY29udGV4dFZpZXdTZXJ2aWNlLmhpZGVDb250ZXh0VmlldygpO1xuXHRcdFx0XHRcdH0pKTtcblxuXHRcdFx0XHRcdGNvbnN0IHJlbmRlcmVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYXJrZG93blJlbmRlcmVyLCB7fSk7XG5cdFx0XHRcdFx0Y29uc3QgcmVuZGVyZWRNYXJrZG93biA9IHJlbmRlcmVyLnJlbmRlcihtZXNzYWdlLCB7XG5cdFx0XHRcdFx0XHRhY3Rpb25IYW5kbGVyOiB7XG5cdFx0XHRcdFx0XHRcdGNhbGxiYWNrOiAobGluaykgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdG9wZW5MaW5rRnJvbU1hcmtkb3duKHRoaXMub3BlbmVyU2VydmljZSwgbGluaywgbWVzc2FnZS5pc1RydXN0ZWQpO1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMuZWxlbWVudC5zdHlsZS5ib3JkZXJCb3R0b21MZWZ0UmFkaXVzID0gJzJweCc7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLmJvcmRlckJvdHRvbVJpZ2h0UmFkaXVzID0gJzJweCc7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5jb250ZXh0Vmlld1NlcnZpY2UuaGlkZUNvbnRleHRWaWV3KCk7XG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGRpc3Bvc2FibGVzOiBkaXNwb3NhYmxlc1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQocmVuZGVyZWRNYXJrZG93bik7XG5cdFx0XHRcdFx0ZWxlbWVudC5hcHBlbmRDaGlsZChyZW5kZXJlZE1hcmtkb3duLmVsZW1lbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGFjdGlvbnNDb250YWluZXIgPSBhcHBlbmQodmFsaWRhdGlvbkNvbnRhaW5lciwgJCgnLnNjbS1lZGl0b3ItdmFsaWRhdGlvbi1hY3Rpb25zJykpO1xuXHRcdFx0XHRjb25zdCBhY3Rpb25iYXIgPSBuZXcgQWN0aW9uQmFyKGFjdGlvbnNDb250YWluZXIpO1xuXHRcdFx0XHRjb25zdCBhY3Rpb24gPSBuZXcgQWN0aW9uKCdzY21JbnB1dFdpZGdldC52YWxpZGF0aW9uTWVzc2FnZS5jbG9zZScsIGxvY2FsaXplKCdsYWJlbC5jbG9zZScsIFwiQ2xvc2VcIiksIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLmNsb3NlKSwgdHJ1ZSwgKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuY29udGV4dFZpZXdTZXJ2aWNlLmhpZGVDb250ZXh0VmlldygpO1xuXHRcdFx0XHRcdHRoaXMuZWxlbWVudC5zdHlsZS5ib3JkZXJCb3R0b21MZWZ0UmFkaXVzID0gJzJweCc7XG5cdFx0XHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLmJvcmRlckJvdHRvbVJpZ2h0UmFkaXVzID0gJzJweCc7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQoYWN0aW9uYmFyKTtcblx0XHRcdFx0YWN0aW9uYmFyLnB1c2goYWN0aW9uLCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSB9KTtcblxuXHRcdFx0XHRyZXR1cm4gRGlzcG9zYWJsZS5Ob25lO1xuXHRcdFx0fSxcblx0XHRcdG9uSGlkZTogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnZhbGlkYXRpb25IYXNGb2N1cyA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuYm9yZGVyQm90dG9tTGVmdFJhZGl1cyA9ICcycHgnO1xuXHRcdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuYm9yZGVyQm90dG9tUmlnaHRSYWRpdXMgPSAnMnB4Jztcblx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0fSxcblx0XHRcdGFuY2hvckFsaWdubWVudDogQW5jaG9yQWxpZ25tZW50LkxFRlRcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0VG9vbGJhcldpZHRoKCk6IG51bWJlciB7XG5cdFx0Y29uc3Qgc2hvd0lucHV0QWN0aW9uQnV0dG9uID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignc2NtLnNob3dJbnB1dEFjdGlvbkJ1dHRvbicpO1xuXHRcdGlmICghdGhpcy50b29sYmFyIHx8ICFzaG93SW5wdXRBY3Rpb25CdXR0b24gfHwgdGhpcy50b29sYmFyPy5pc0VtcHR5KCkgPT09IHRydWUpIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnRvb2xiYXIuZHJvcGRvd25BY3Rpb25zLmxlbmd0aCA9PT0gMCA/XG5cdFx0XHQyNiAvKiAyMnB4IGFjdGlvbiArIDRweCBtYXJnaW4gKi8gOlxuXHRcdFx0MzkgLyogMzVweCBhY3Rpb24gKyA0cHggbWFyZ2luICovO1xuXHR9XG5cblx0Y2xlYXJWYWxpZGF0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMudmFsaWRhdGlvbkNvbnRleHRWaWV3Py5jbG9zZSgpO1xuXHRcdHRoaXMudmFsaWRhdGlvbkNvbnRleHRWaWV3ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMudmFsaWRhdGlvbkhhc0ZvY3VzID0gZmFsc2U7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuaW5wdXQgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5yZXBvc2l0b3J5RGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuY2xlYXJWYWxpZGF0aW9uKCk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNDTVZpZXdQYW5lIGV4dGVuZHMgVmlld1BhbmUge1xuXG5cdHByaXZhdGUgX29uRGlkTGF5b3V0OiBFbWl0dGVyPHZvaWQ+O1xuXHRwcml2YXRlIGxheW91dENhY2hlOiBJU0NNTGF5b3V0O1xuXG5cdHByaXZhdGUgdHJlZVNjcm9sbFRvcDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHRyZWVDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSB0cmVlITogV29ya2JlbmNoQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZTxJU0NNVmlld1NlcnZpY2UsIFRyZWVFbGVtZW50LCBGdXp6eVNjb3JlPjtcblxuXHRwcml2YXRlIGxpc3RMYWJlbHMhOiBSZXNvdXJjZUxhYmVscztcblx0cHJpdmF0ZSBpbnB1dFJlbmRlcmVyITogSW5wdXRSZW5kZXJlcjtcblx0cHJpdmF0ZSBhY3Rpb25CdXR0b25SZW5kZXJlciE6IEFjdGlvbkJ1dHRvblJlbmRlcmVyO1xuXG5cdHByaXZhdGUgX3ZpZXdNb2RlOiBWaWV3TW9kZTtcblx0Z2V0IHZpZXdNb2RlKCk6IFZpZXdNb2RlIHsgcmV0dXJuIHRoaXMuX3ZpZXdNb2RlOyB9XG5cdHNldCB2aWV3TW9kZShtb2RlOiBWaWV3TW9kZSkge1xuXHRcdGlmICh0aGlzLl92aWV3TW9kZSA9PT0gbW9kZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3ZpZXdNb2RlID0gbW9kZTtcblxuXHRcdC8vIFVwZGF0ZSBzb3J0IGtleSBiYXNlZCBvbiB2aWV3IG1vZGVcblx0XHR0aGlzLnZpZXdTb3J0S2V5ID0gdGhpcy5nZXRWaWV3U29ydEtleSgpO1xuXG5cdFx0dGhpcy51cGRhdGVDaGlsZHJlbigpO1xuXHRcdHRoaXMub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UoKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVZpZXdNb2RlLmZpcmUobW9kZSk7XG5cdFx0dGhpcy52aWV3TW9kZUNvbnRleHRLZXkuc2V0KG1vZGUpO1xuXG5cdFx0dGhpcy51cGRhdGVJbmRlbnRTdHlsZXModGhpcy50aGVtZVNlcnZpY2UuZ2V0RmlsZUljb25UaGVtZSgpKTtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKGBzY20udmlld01vZGVgLCBtb2RlLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VWaWV3TW9kZSA9IG5ldyBFbWl0dGVyPFZpZXdNb2RlPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVZpZXdNb2RlID0gdGhpcy5fb25EaWRDaGFuZ2VWaWV3TW9kZS5ldmVudDtcblxuXHRwcml2YXRlIF92aWV3U29ydEtleTogVmlld1NvcnRLZXk7XG5cdGdldCB2aWV3U29ydEtleSgpOiBWaWV3U29ydEtleSB7IHJldHVybiB0aGlzLl92aWV3U29ydEtleTsgfVxuXHRzZXQgdmlld1NvcnRLZXkoc29ydEtleTogVmlld1NvcnRLZXkpIHtcblx0XHRpZiAodGhpcy5fdmlld1NvcnRLZXkgPT09IHNvcnRLZXkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl92aWV3U29ydEtleSA9IHNvcnRLZXk7XG5cblx0XHR0aGlzLnVwZGF0ZUNoaWxkcmVuKCk7XG5cdFx0dGhpcy52aWV3U29ydEtleUNvbnRleHRLZXkuc2V0KHNvcnRLZXkpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlVmlld1NvcnRLZXkuZmlyZShzb3J0S2V5KTtcblxuXHRcdGlmICh0aGlzLl92aWV3TW9kZSA9PT0gVmlld01vZGUuTGlzdCkge1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShgc2NtLnZpZXdTb3J0S2V5YCwgc29ydEtleSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVZpZXdTb3J0S2V5ID0gbmV3IEVtaXR0ZXI8Vmlld1NvcnRLZXk+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmlld1NvcnRLZXkgPSB0aGlzLl9vbkRpZENoYW5nZVZpZXdTb3J0S2V5LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgaXRlbXMgPSBuZXcgRGlzcG9zYWJsZU1hcDxJU0NNUmVwb3NpdG9yeSwgSURpc3Bvc2FibGU+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgdmlzaWJpbGl0eURpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgdHJlZU9wZXJhdGlvblNlcXVlbmNlciA9IG5ldyBTZXF1ZW5jZXIoKTtcblx0cHJpdmF0ZSByZWFkb25seSByZXZlYWxSZXNvdXJjZVRocm90dGxlciA9IG5ldyBUaHJvdHRsZXIoKTtcblx0cHJpdmF0ZSByZWFkb25seSB1cGRhdGVDaGlsZHJlblRocm90dGxlciA9IG5ldyBUaHJvdHRsZXIoKTtcblxuXHRwcml2YXRlIHZpZXdNb2RlQ29udGV4dEtleTogSUNvbnRleHRLZXk8Vmlld01vZGU+O1xuXHRwcml2YXRlIHZpZXdTb3J0S2V5Q29udGV4dEtleTogSUNvbnRleHRLZXk8Vmlld1NvcnRLZXk+O1xuXHRwcml2YXRlIGFyZUFsbFJlcG9zaXRvcmllc0NvbGxhcHNlZENvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGlzQW55UmVwb3NpdG9yeUNvbGxhcHNpYmxlQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0cHJpdmF0ZSBzY21Qcm92aWRlckNvbnRleHRLZXk6IElDb250ZXh0S2V5PHN0cmluZyB8IHVuZGVmaW5lZD47XG5cdHByaXZhdGUgc2NtUHJvdmlkZXJSb290VXJpQ29udGV4dEtleTogSUNvbnRleHRLZXk8c3RyaW5nIHwgdW5kZWZpbmVkPjtcblx0cHJpdmF0ZSBzY21Qcm92aWRlckhhc1Jvb3RVcmlDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdGlvbnM6IElWaWV3UGFuZU9wdGlvbnMsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElTQ01TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc2NtU2VydmljZTogSVNDTVNlcnZpY2UsXG5cdFx0QElTQ01WaWV3U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHNjbVZpZXdTZXJ2aWNlOiBJU0NNVmlld1NlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKHsgLi4ub3B0aW9ucywgdGl0bGVNZW51SWQ6IE1lbnVJZC5TQ01UaXRsZSB9LCBrZXliaW5kaW5nU2VydmljZSwgY29udGV4dE1lbnVTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgY29udGV4dEtleVNlcnZpY2UsIHZpZXdEZXNjcmlwdG9yU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIHRoZW1lU2VydmljZSwgaG92ZXJTZXJ2aWNlKTtcblxuXHRcdC8vIFZpZXcgbW9kZSBhbmQgc29ydCBrZXlcblx0XHR0aGlzLl92aWV3TW9kZSA9IHRoaXMuZ2V0Vmlld01vZGUoKTtcblx0XHR0aGlzLl92aWV3U29ydEtleSA9IHRoaXMuZ2V0Vmlld1NvcnRLZXkoKTtcblxuXHRcdC8vIENvbnRleHQgS2V5c1xuXHRcdHRoaXMudmlld01vZGVDb250ZXh0S2V5ID0gQ29udGV4dEtleXMuU0NNVmlld01vZGUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnZpZXdNb2RlQ29udGV4dEtleS5zZXQodGhpcy5fdmlld01vZGUpO1xuXHRcdHRoaXMudmlld1NvcnRLZXlDb250ZXh0S2V5ID0gQ29udGV4dEtleXMuU0NNVmlld1NvcnRLZXkuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnZpZXdTb3J0S2V5Q29udGV4dEtleS5zZXQodGhpcy52aWV3U29ydEtleSk7XG5cdFx0dGhpcy5hcmVBbGxSZXBvc2l0b3JpZXNDb2xsYXBzZWRDb250ZXh0S2V5ID0gQ29udGV4dEtleXMuU0NNVmlld0FyZUFsbFJlcG9zaXRvcmllc0NvbGxhcHNlZC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuaXNBbnlSZXBvc2l0b3J5Q29sbGFwc2libGVDb250ZXh0S2V5ID0gQ29udGV4dEtleXMuU0NNVmlld0lzQW55UmVwb3NpdG9yeUNvbGxhcHNpYmxlLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5zY21Qcm92aWRlckNvbnRleHRLZXkgPSBDb250ZXh0S2V5cy5TQ01Qcm92aWRlci5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuc2NtUHJvdmlkZXJSb290VXJpQ29udGV4dEtleSA9IENvbnRleHRLZXlzLlNDTVByb3ZpZGVyUm9vdFVyaS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuc2NtUHJvdmlkZXJIYXNSb290VXJpQ29udGV4dEtleSA9IENvbnRleHRLZXlzLlNDTVByb3ZpZGVySGFzUm9vdFVyaS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fb25EaWRMYXlvdXQgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRcdHRoaXMubGF5b3V0Q2FjaGUgPSB7IGhlaWdodDogdW5kZWZpbmVkLCB3aWR0aDogdW5kZWZpbmVkLCBvbkRpZENoYW5nZTogdGhpcy5fb25EaWRMYXlvdXQuZXZlbnQgfTtcblxuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uub25EaWRDaGFuZ2VWYWx1ZShTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCB1bmRlZmluZWQsIHRoaXMuZGlzcG9zYWJsZXMpKGUgPT4ge1xuXHRcdFx0c3dpdGNoIChlLmtleSkge1xuXHRcdFx0XHRjYXNlICdzY20udmlld01vZGUnOlxuXHRcdFx0XHRcdHRoaXMudmlld01vZGUgPSB0aGlzLmdldFZpZXdNb2RlKCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ3NjbS52aWV3U29ydEtleSc6XG5cdFx0XHRcdFx0dGhpcy52aWV3U29ydEtleSA9IHRoaXMuZ2V0Vmlld1NvcnRLZXkoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9LCB0aGlzLCB0aGlzLmRpc3Bvc2FibGVzKTtcblxuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uub25XaWxsU2F2ZVN0YXRlKGUgPT4ge1xuXHRcdFx0dGhpcy52aWV3TW9kZSA9IHRoaXMuZ2V0Vmlld01vZGUoKTtcblx0XHRcdHRoaXMudmlld1NvcnRLZXkgPSB0aGlzLmdldFZpZXdTb3J0S2V5KCk7XG5cblx0XHRcdHRoaXMuc3RvcmVUcmVlVmlld1N0YXRlKCk7XG5cdFx0fSwgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cblx0XHRFdmVudC5hbnkodGhpcy5zY21TZXJ2aWNlLm9uRGlkQWRkUmVwb3NpdG9yeSwgdGhpcy5zY21TZXJ2aWNlLm9uRGlkUmVtb3ZlUmVwb3NpdG9yeSkoKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VWaWV3V2VsY29tZVN0YXRlLmZpcmUoKSwgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLnJldmVhbFJlc291cmNlVGhyb3R0bGVyKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLnVwZGF0ZUNoaWxkcmVuVGhyb3R0bGVyKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBsYXlvdXRCb2R5KGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkID0gdGhpcy5sYXlvdXRDYWNoZS5oZWlnaHQsIHdpZHRoOiBudW1iZXIgfCB1bmRlZmluZWQgPSB0aGlzLmxheW91dENhY2hlLndpZHRoKTogdm9pZCB7XG5cdFx0aWYgKGhlaWdodCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHdpZHRoICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHN1cGVyLmxheW91dEJvZHkoaGVpZ2h0LCB3aWR0aCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5sYXlvdXRDYWNoZS5oZWlnaHQgPSBoZWlnaHQ7XG5cdFx0dGhpcy5sYXlvdXRDYWNoZS53aWR0aCA9IHdpZHRoO1xuXHRcdHRoaXMuX29uRGlkTGF5b3V0LmZpcmUoKTtcblxuXHRcdHRoaXMudHJlZUNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHtoZWlnaHR9cHhgO1xuXHRcdHRoaXMudHJlZS5sYXlvdXQoaGVpZ2h0LCB3aWR0aCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyQm9keShjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyQm9keShjb250YWluZXIpO1xuXG5cdFx0Ly8gVHJlZVxuXHRcdHRoaXMudHJlZUNvbnRhaW5lciA9IGFwcGVuZChjb250YWluZXIsICQoJy5zY20tdmlldy5zaG93LWZpbGUtaWNvbnMnKSk7XG5cdFx0dGhpcy50cmVlQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2ZpbGUtaWNvbi10aGVtYWJsZS10cmVlJyk7XG5cdFx0dGhpcy50cmVlQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3Nob3ctZmlsZS1pY29ucycpO1xuXG5cdFx0Y29uc3QgdXBkYXRlQWN0aW9uc1Zpc2liaWxpdHkgPSAoKSA9PiB0aGlzLnRyZWVDb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnc2hvdy1hY3Rpb25zJywgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignc2NtLmFsd2F5c1Nob3dBY3Rpb25zJykpO1xuXHRcdEV2ZW50LmZpbHRlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbiwgZSA9PiBlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdzY20uYWx3YXlzU2hvd0FjdGlvbnMnKSwgdGhpcy5kaXNwb3NhYmxlcykodXBkYXRlQWN0aW9uc1Zpc2liaWxpdHksIHRoaXMsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHRcdHVwZGF0ZUFjdGlvbnNWaXNpYmlsaXR5KCk7XG5cblx0XHRjb25zdCB1cGRhdGVQcm92aWRlckNvdW50VmlzaWJpbGl0eSA9ICgpID0+IHtcblx0XHRcdGNvbnN0IHZhbHVlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTwnaGlkZGVuJyB8ICdhdXRvJyB8ICd2aXNpYmxlJz4oJ3NjbS5wcm92aWRlckNvdW50QmFkZ2UnKTtcblx0XHRcdHRoaXMudHJlZUNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdoaWRlLXByb3ZpZGVyLWNvdW50cycsIHZhbHVlID09PSAnaGlkZGVuJyk7XG5cdFx0XHR0aGlzLnRyZWVDb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnYXV0by1wcm92aWRlci1jb3VudHMnLCB2YWx1ZSA9PT0gJ2F1dG8nKTtcblx0XHR9O1xuXHRcdEV2ZW50LmZpbHRlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbiwgZSA9PiBlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdzY20ucHJvdmlkZXJDb3VudEJhZGdlJyksIHRoaXMuZGlzcG9zYWJsZXMpKHVwZGF0ZVByb3ZpZGVyQ291bnRWaXNpYmlsaXR5LCB0aGlzLCB0aGlzLmRpc3Bvc2FibGVzKTtcblx0XHR1cGRhdGVQcm92aWRlckNvdW50VmlzaWJpbGl0eSgpO1xuXG5cdFx0Y29uc3Qgdmlld1N0YXRlID0gdGhpcy5sb2FkVHJlZVZpZXdTdGF0ZSgpO1xuXHRcdHRoaXMuY3JlYXRlVHJlZSh0aGlzLnRyZWVDb250YWluZXIsIHZpZXdTdGF0ZSk7XG5cblx0XHR0aGlzLm9uRGlkQ2hhbmdlQm9keVZpc2liaWxpdHkoYXN5bmMgdmlzaWJsZSA9PiB7XG5cdFx0XHRpZiAodmlzaWJsZSkge1xuXHRcdFx0XHR0aGlzLnRyZWVPcGVyYXRpb25TZXF1ZW5jZXIucXVldWUoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMudHJlZS5zZXRJbnB1dCh0aGlzLnNjbVZpZXdTZXJ2aWNlLCB2aWV3U3RhdGUpO1xuXG5cdFx0XHRcdFx0RXZlbnQuZmlsdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLFxuXHRcdFx0XHRcdFx0ZSA9PlxuXHRcdFx0XHRcdFx0XHRlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdzY20uYWx3YXlzU2hvd1JlcG9zaXRvcmllcycpLFxuXHRcdFx0XHRcdFx0dGhpcy52aXNpYmlsaXR5RGlzcG9zYWJsZXMpXG5cdFx0XHRcdFx0XHQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZUFjdGlvbnMoKTtcblx0XHRcdFx0XHRcdFx0dGhpcy51cGRhdGVDaGlsZHJlbigpO1xuXHRcdFx0XHRcdFx0fSwgdGhpcywgdGhpcy52aXNpYmlsaXR5RGlzcG9zYWJsZXMpO1xuXG5cdFx0XHRcdFx0RXZlbnQuZmlsdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLFxuXHRcdFx0XHRcdFx0ZSA9PlxuXHRcdFx0XHRcdFx0XHRlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdzY20uaW5wdXRNaW5MaW5lQ291bnQnKSB8fFxuXHRcdFx0XHRcdFx0XHRlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdzY20uaW5wdXRNYXhMaW5lQ291bnQnKSB8fFxuXHRcdFx0XHRcdFx0XHRlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdzY20uc2hvd0FjdGlvbkJ1dHRvbicpLFxuXHRcdFx0XHRcdFx0dGhpcy52aXNpYmlsaXR5RGlzcG9zYWJsZXMpXG5cdFx0XHRcdFx0XHQoKCkgPT4gdGhpcy51cGRhdGVDaGlsZHJlbigpLCB0aGlzLCB0aGlzLnZpc2liaWxpdHlEaXNwb3NhYmxlcyk7XG5cblx0XHRcdFx0XHQvLyBBZGQgdmlzaWJsZSByZXBvc2l0b3JpZXNcblx0XHRcdFx0XHR0aGlzLmVkaXRvclNlcnZpY2Uub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UodGhpcy5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSwgdGhpcywgdGhpcy52aXNpYmlsaXR5RGlzcG9zYWJsZXMpO1xuXHRcdFx0XHRcdHRoaXMuc2NtVmlld1NlcnZpY2Uub25EaWRDaGFuZ2VWaXNpYmxlUmVwb3NpdG9yaWVzKHRoaXMub25EaWRDaGFuZ2VWaXNpYmxlUmVwb3NpdG9yaWVzLCB0aGlzLCB0aGlzLnZpc2liaWxpdHlEaXNwb3NhYmxlcyk7XG5cdFx0XHRcdFx0dGhpcy5vbkRpZENoYW5nZVZpc2libGVSZXBvc2l0b3JpZXMoeyBhZGRlZDogdGhpcy5zY21WaWV3U2VydmljZS52aXNpYmxlUmVwb3NpdG9yaWVzLCByZW1vdmVkOiBJdGVyYWJsZS5lbXB0eSgpIH0pO1xuXG5cdFx0XHRcdFx0Ly8gUmVzdG9yZSBzY3JvbGwgcG9zaXRpb25cblx0XHRcdFx0XHRpZiAodHlwZW9mIHRoaXMudHJlZVNjcm9sbFRvcCA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRcdHRoaXMudHJlZS5zY3JvbGxUb3AgPSB0aGlzLnRyZWVTY3JvbGxUb3A7XG5cdFx0XHRcdFx0XHR0aGlzLnRyZWVTY3JvbGxUb3AgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhpcy51cGRhdGVSZXBvc2l0b3J5Q29sbGFwc2VBbGxDb250ZXh0S2V5cygpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMudmlzaWJpbGl0eURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHRcdHRoaXMub25EaWRDaGFuZ2VWaXNpYmxlUmVwb3NpdG9yaWVzKHsgYWRkZWQ6IEl0ZXJhYmxlLmVtcHR5KCksIHJlbW92ZWQ6IFsuLi50aGlzLml0ZW1zLmtleXMoKV0gfSk7XG5cdFx0XHRcdHRoaXMudHJlZVNjcm9sbFRvcCA9IHRoaXMudHJlZS5zY3JvbGxUb3A7XG5cblx0XHRcdFx0dGhpcy51cGRhdGVSZXBvc2l0b3J5Q29sbGFwc2VBbGxDb250ZXh0S2V5cygpO1xuXHRcdFx0fVxuXHRcdH0sIHRoaXMsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXBvc2l0b3J5VmlzaWJpbGl0eUFjdGlvbkNvbnRyb2xsZXIpKTtcblxuXHRcdHRoaXMudGhlbWVTZXJ2aWNlLm9uRGlkRmlsZUljb25UaGVtZUNoYW5nZSh0aGlzLnVwZGF0ZUluZGVudFN0eWxlcywgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cdFx0dGhpcy51cGRhdGVJbmRlbnRTdHlsZXModGhpcy50aGVtZVNlcnZpY2UuZ2V0RmlsZUljb25UaGVtZSgpKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlVHJlZShjb250YWluZXI6IEhUTUxFbGVtZW50LCB2aWV3U3RhdGU/OiBJQXN5bmNEYXRhVHJlZVZpZXdTdGF0ZSk6IHZvaWQge1xuXHRcdGNvbnN0IG92ZXJmbG93V2lkZ2V0c0RvbU5vZGUgPSAkKCcuc2NtLW92ZXJmbG93LXdpZGdldHMtY29udGFpbmVyLm1vbmFjby1lZGl0b3InKTtcblxuXHRcdHRoaXMuaW5wdXRSZW5kZXJlciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5wdXRSZW5kZXJlciwgdGhpcy5sYXlvdXRDYWNoZSwgb3ZlcmZsb3dXaWRnZXRzRG9tTm9kZSwgKGlucHV0LCBoZWlnaHQpID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdC8vIEF0dGVtcHQgdG8gdXBkYXRlIHRoZSBpbnB1dCBlbGVtZW50IGhlaWdodC4gVGhlcmUgaXMgYW5cblx0XHRcdFx0Ly8gZWRnZSBjYXNlIHdoZXJlIHRoZSBpbnB1dCBoYXMgYWxyZWFkeSBiZWVuIGRpc3Bvc2VkIGFuZFxuXHRcdFx0XHQvLyB1cGRhdGluZyB0aGUgaGVpZ2h0IHdvdWxkIGZhaWwuXG5cdFx0XHRcdHRoaXMudHJlZS51cGRhdGVFbGVtZW50SGVpZ2h0KGlucHV0LCBoZWlnaHQpO1xuXHRcdFx0fVxuXHRcdFx0Y2F0Y2ggeyB9XG5cdFx0fSk7XG5cdFx0dGhpcy5hY3Rpb25CdXR0b25SZW5kZXJlciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQWN0aW9uQnV0dG9uUmVuZGVyZXIpO1xuXG5cdFx0dGhpcy5saXN0TGFiZWxzID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvdXJjZUxhYmVscywgeyBvbkRpZENoYW5nZVZpc2liaWxpdHk6IHRoaXMub25EaWRDaGFuZ2VCb2R5VmlzaWJpbGl0eSB9KTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLmxpc3RMYWJlbHMpO1xuXG5cdFx0Y29uc3QgcmVzb3VyY2VBY3Rpb25SdW5uZXIgPSBuZXcgUmVwb3NpdG9yeVBhbmVBY3Rpb25SdW5uZXIoKCkgPT4gdGhpcy5nZXRTZWxlY3RlZFJlc291cmNlcygpKTtcblx0XHRyZXNvdXJjZUFjdGlvblJ1bm5lci5vbldpbGxSdW4oKCkgPT4gdGhpcy50cmVlLmRvbUZvY3VzKCksIHRoaXMsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHJlc291cmNlQWN0aW9uUnVubmVyKTtcblxuXHRcdGNvbnN0IHRyZWVEYXRhU291cmNlID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTQ01UcmVlRGF0YVNvdXJjZSwgKCkgPT4gdGhpcy52aWV3TW9kZSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodHJlZURhdGFTb3VyY2UpO1xuXG5cdFx0Y29uc3QgY29tcHJlc3Npb25FbmFibGVkID0gb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlKCdzY20uY29tcGFjdEZvbGRlcnMnLCB0cnVlLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdHRoaXMudHJlZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRXb3JrYmVuY2hDb21wcmVzc2libGVBc3luY0RhdGFUcmVlLFxuXHRcdFx0J1NDTSBUcmVlIFJlcG8nLFxuXHRcdFx0Y29udGFpbmVyLFxuXHRcdFx0bmV3IExpc3REZWxlZ2F0ZSh0aGlzLmlucHV0UmVuZGVyZXIpLFxuXHRcdFx0bmV3IFNDTVRyZWVDb21wcmVzc2lvbkRlbGVnYXRlKCksXG5cdFx0XHRbXG5cdFx0XHRcdHRoaXMuaW5wdXRSZW5kZXJlcixcblx0XHRcdFx0dGhpcy5hY3Rpb25CdXR0b25SZW5kZXJlcixcblx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXBvc2l0b3J5UmVuZGVyZXIsIE1lbnVJZC5TQ01UaXRsZSwgZ2V0QWN0aW9uVmlld0l0ZW1Qcm92aWRlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlKSksXG5cdFx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVzb3VyY2VHcm91cFJlbmRlcmVyLCBnZXRBY3Rpb25WaWV3SXRlbVByb3ZpZGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpLCByZXNvdXJjZUFjdGlvblJ1bm5lciksXG5cdFx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVzb3VyY2VSZW5kZXJlciwgKCkgPT4gdGhpcy52aWV3TW9kZSwgdGhpcy5saXN0TGFiZWxzLCBnZXRBY3Rpb25WaWV3SXRlbVByb3ZpZGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpLCByZXNvdXJjZUFjdGlvblJ1bm5lcilcblx0XHRcdF0sXG5cdFx0XHR0cmVlRGF0YVNvdXJjZSxcblx0XHRcdHtcblx0XHRcdFx0aG9yaXpvbnRhbFNjcm9sbGluZzogZmFsc2UsXG5cdFx0XHRcdHNldFJvd0xpbmVIZWlnaHQ6IGZhbHNlLFxuXHRcdFx0XHR0cmFuc2Zvcm1PcHRpbWl6YXRpb246IGZhbHNlLFxuXHRcdFx0XHRmaWx0ZXI6IG5ldyBTQ01UcmVlRmlsdGVyKCksXG5cdFx0XHRcdGRuZDogbmV3IFNDTVRyZWVEcmFnQW5kRHJvcCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlKSxcblx0XHRcdFx0aWRlbnRpdHlQcm92aWRlcjogbmV3IFNDTVJlc291cmNlSWRlbnRpdHlQcm92aWRlcigpLFxuXHRcdFx0XHRzb3J0ZXI6IG5ldyBTQ01UcmVlU29ydGVyKCgpID0+IHRoaXMudmlld01vZGUsICgpID0+IHRoaXMudmlld1NvcnRLZXkpLFxuXHRcdFx0XHRrZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyOiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNDTVRyZWVLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyLCAoKSA9PiB0aGlzLnZpZXdNb2RlKSxcblx0XHRcdFx0b3ZlcnJpZGVTdHlsZXM6IHRoaXMuZ2V0TG9jYXRpb25CYXNlZENvbG9ycygpLmxpc3RPdmVycmlkZVN0eWxlcyxcblx0XHRcdFx0Y29tcHJlc3Npb25FbmFibGVkOiBjb21wcmVzc2lvbkVuYWJsZWQuZ2V0KCksXG5cdFx0XHRcdGNvbGxhcHNlQnlEZWZhdWx0OiAoZTogdW5rbm93bikgPT4ge1xuXHRcdFx0XHRcdC8vIFJlcG9zaXRvcnksIFJlc291cmNlIEdyb3VwLCBSZXNvdXJjZSBGb2xkZXIgKFRyZWUpXG5cdFx0XHRcdFx0aWYgKGlzU0NNUmVwb3NpdG9yeShlKSB8fCBpc1NDTVJlc291cmNlR3JvdXAoZSkgfHwgaXNTQ01SZXNvdXJjZU5vZGUoZSkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBIaXN0b3J5IEl0ZW0gR3JvdXAsIEhpc3RvcnkgSXRlbSwgb3IgSGlzdG9yeSBJdGVtIENoYW5nZVxuXHRcdFx0XHRcdHJldHVybiAodmlld1N0YXRlPy5leHBhbmRlZCA/PyBbXSkuaW5kZXhPZihnZXRTQ01SZXNvdXJjZUlkKGUgYXMgVHJlZUVsZW1lbnQpKSA9PT0gLTE7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTQ01BY2Nlc3NpYmlsaXR5UHJvdmlkZXIpXG5cdFx0XHR9KSBhcyBXb3JrYmVuY2hDb21wcmVzc2libGVBc3luY0RhdGFUcmVlPElTQ01WaWV3U2VydmljZSwgVHJlZUVsZW1lbnQsIEZ1enp5U2NvcmU+O1xuXG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy50cmVlKTtcblxuXHRcdHRoaXMudHJlZS5vbkRpZE9wZW4odGhpcy5vcGVuLCB0aGlzLCB0aGlzLmRpc3Bvc2FibGVzKTtcblx0XHR0aGlzLnRyZWUub25Db250ZXh0TWVudSh0aGlzLm9uTGlzdENvbnRleHRNZW51LCB0aGlzLCB0aGlzLmRpc3Bvc2FibGVzKTtcblx0XHR0aGlzLnRyZWUub25EaWRTY3JvbGwodGhpcy5pbnB1dFJlbmRlcmVyLmNsZWFyVmFsaWRhdGlvbiwgdGhpcy5pbnB1dFJlbmRlcmVyLCB0aGlzLmRpc3Bvc2FibGVzKTtcblx0XHRFdmVudC5maWx0ZXIodGhpcy50cmVlLm9uRGlkQ2hhbmdlQ29sbGFwc2VTdGF0ZSwgZSA9PiBpc1NDTVJlcG9zaXRvcnkoZS5ub2RlLmVsZW1lbnQ/LmVsZW1lbnQpLCB0aGlzLmRpc3Bvc2FibGVzKSh0aGlzLnVwZGF0ZVJlcG9zaXRvcnlDb2xsYXBzZUFsbENvbnRleHRLZXlzLCB0aGlzLCB0aGlzLmRpc3Bvc2FibGVzKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdHRoaXMudHJlZS51cGRhdGVPcHRpb25zKHtcblx0XHRcdFx0Y29tcHJlc3Npb25FbmFibGVkOiBjb21wcmVzc2lvbkVuYWJsZWQucmVhZChyZWFkZXIpXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHRhcHBlbmQoY29udGFpbmVyLCBvdmVyZmxvd1dpZGdldHNEb21Ob2RlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb3BlbihlOiBJT3BlbkV2ZW50PFRyZWVFbGVtZW50IHwgdW5kZWZpbmVkPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghZS5lbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fSBlbHNlIGlmIChpc1NDTVJlcG9zaXRvcnkoZS5lbGVtZW50KSkge1xuXHRcdFx0dGhpcy5zY21WaWV3U2VydmljZS5mb2N1cyhlLmVsZW1lbnQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH0gZWxzZSBpZiAoaXNTQ01JbnB1dChlLmVsZW1lbnQpKSB7XG5cdFx0XHR0aGlzLnNjbVZpZXdTZXJ2aWNlLmZvY3VzKGUuZWxlbWVudC5yZXBvc2l0b3J5KTtcblxuXHRcdFx0Y29uc3Qgd2lkZ2V0ID0gdGhpcy5pbnB1dFJlbmRlcmVyLmdldFJlbmRlcmVkSW5wdXRXaWRnZXQoZS5lbGVtZW50KTtcblxuXHRcdFx0aWYgKHdpZGdldCkge1xuXHRcdFx0XHR3aWRnZXQuZm9jdXMoKTtcblx0XHRcdFx0dGhpcy50cmVlLnNldEZvY3VzKFtdLCBlLmJyb3dzZXJFdmVudCk7XG5cblx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gdGhpcy50cmVlLmdldFNlbGVjdGlvbigpO1xuXG5cdFx0XHRcdGlmIChzZWxlY3Rpb24ubGVuZ3RoID09PSAxICYmIHNlbGVjdGlvblswXSA9PT0gZS5lbGVtZW50KSB7XG5cdFx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiB0aGlzLnRyZWUuc2V0U2VsZWN0aW9uKFtdKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuO1xuXHRcdH0gZWxzZSBpZiAoaXNTQ01BY3Rpb25CdXR0b24oZS5lbGVtZW50KSkge1xuXHRcdFx0dGhpcy5zY21WaWV3U2VydmljZS5mb2N1cyhlLmVsZW1lbnQucmVwb3NpdG9yeSk7XG5cblx0XHRcdC8vIEZvY3VzIHRoZSBhY3Rpb24gYnV0dG9uXG5cdFx0XHR0aGlzLmFjdGlvbkJ1dHRvblJlbmRlcmVyLmZvY3VzQWN0aW9uQnV0dG9uKGUuZWxlbWVudCk7XG5cdFx0XHR0aGlzLnRyZWUuc2V0Rm9jdXMoW10sIGUuYnJvd3NlckV2ZW50KTtcblxuXHRcdFx0cmV0dXJuO1xuXHRcdH0gZWxzZSBpZiAoaXNTQ01SZXNvdXJjZUdyb3VwKGUuZWxlbWVudCkpIHtcblx0XHRcdGNvbnN0IHByb3ZpZGVyID0gZS5lbGVtZW50LnByb3ZpZGVyO1xuXHRcdFx0Y29uc3QgcmVwb3NpdG9yeSA9IEl0ZXJhYmxlLmZpbmQodGhpcy5zY21TZXJ2aWNlLnJlcG9zaXRvcmllcywgciA9PiByLnByb3ZpZGVyID09PSBwcm92aWRlcik7XG5cdFx0XHRpZiAocmVwb3NpdG9yeSkge1xuXHRcdFx0XHR0aGlzLnNjbVZpZXdTZXJ2aWNlLmZvY3VzKHJlcG9zaXRvcnkpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH0gZWxzZSBpZiAoaXNTQ01SZXNvdXJjZShlLmVsZW1lbnQpKSB7XG5cdFx0XHRpZiAoZS5lbGVtZW50LmNvbW1hbmQ/LmlkID09PSBBUElfT1BFTl9FRElUT1JfQ09NTUFORF9JRCB8fCBlLmVsZW1lbnQuY29tbWFuZD8uaWQgPT09IEFQSV9PUEVOX0RJRkZfRURJVE9SX0NPTU1BTkRfSUQpIHtcblx0XHRcdFx0aWYgKGlzUG9pbnRlckV2ZW50KGUuYnJvd3NlckV2ZW50KSAmJiBlLmJyb3dzZXJFdmVudC5idXR0b24gPT09IDEpIHtcblx0XHRcdFx0XHRjb25zdCByZXNvdXJjZUdyb3VwID0gZS5lbGVtZW50LnJlc291cmNlR3JvdXA7XG5cdFx0XHRcdFx0Y29uc3QgdGl0bGUgPSBgJHtyZXNvdXJjZUdyb3VwLnByb3ZpZGVyLmxhYmVsfTogJHtyZXNvdXJjZUdyb3VwLmxhYmVsfWA7XG5cdFx0XHRcdFx0YXdhaXQgT3BlblNjbUdyb3VwQWN0aW9uLm9wZW5NdWx0aUZpbGVEaWZmRWRpdG9yKHRoaXMuZWRpdG9yU2VydmljZSwgdGl0bGUsIHJlc291cmNlR3JvdXAucHJvdmlkZXIucm9vdFVyaSwgcmVzb3VyY2VHcm91cC5pZCwge1xuXHRcdFx0XHRcdFx0Li4uZS5lZGl0b3JPcHRpb25zLFxuXHRcdFx0XHRcdFx0dmlld1N0YXRlOiB7XG5cdFx0XHRcdFx0XHRcdHJldmVhbERhdGE6IHtcblx0XHRcdFx0XHRcdFx0XHRyZXNvdXJjZToge1xuXHRcdFx0XHRcdFx0XHRcdFx0b3JpZ2luYWw6IGUuZWxlbWVudC5tdWx0aURpZmZFZGl0b3JPcmlnaW5hbFVyaSxcblx0XHRcdFx0XHRcdFx0XHRcdG1vZGlmaWVkOiBlLmVsZW1lbnQubXVsdGlEaWZmRWRpdG9yTW9kaWZpZWRVcmksXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0cHJlc2VydmVGb2N1czogdHJ1ZSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGUuZWxlbWVudC5jb21tYW5kLmlkLCAuLi4oZS5lbGVtZW50LmNvbW1hbmQuYXJndW1lbnRzIHx8IFtdKSwgZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IGUuZWxlbWVudC5vcGVuKCEhZS5lZGl0b3JPcHRpb25zLnByZXNlcnZlRm9jdXMpO1xuXG5cdFx0XHRcdGlmIChlLmVkaXRvck9wdGlvbnMucGlubmVkKSB7XG5cdFx0XHRcdFx0Y29uc3QgYWN0aXZlRWRpdG9yUGFuZSA9IHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lO1xuXG5cdFx0XHRcdFx0YWN0aXZlRWRpdG9yUGFuZT8uZ3JvdXAucGluRWRpdG9yKGFjdGl2ZUVkaXRvclBhbmUuaW5wdXQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHByb3ZpZGVyID0gZS5lbGVtZW50LnJlc291cmNlR3JvdXAucHJvdmlkZXI7XG5cdFx0XHRjb25zdCByZXBvc2l0b3J5ID0gSXRlcmFibGUuZmluZCh0aGlzLnNjbVNlcnZpY2UucmVwb3NpdG9yaWVzLCByID0+IHIucHJvdmlkZXIgPT09IHByb3ZpZGVyKTtcblxuXHRcdFx0aWYgKHJlcG9zaXRvcnkpIHtcblx0XHRcdFx0dGhpcy5zY21WaWV3U2VydmljZS5mb2N1cyhyZXBvc2l0b3J5KTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGlzU0NNUmVzb3VyY2VOb2RlKGUuZWxlbWVudCkpIHtcblx0XHRcdGNvbnN0IHByb3ZpZGVyID0gZS5lbGVtZW50LmNvbnRleHQucHJvdmlkZXI7XG5cdFx0XHRjb25zdCByZXBvc2l0b3J5ID0gSXRlcmFibGUuZmluZCh0aGlzLnNjbVNlcnZpY2UucmVwb3NpdG9yaWVzLCByID0+IHIucHJvdmlkZXIgPT09IHByb3ZpZGVyKTtcblx0XHRcdGlmIChyZXBvc2l0b3J5KSB7XG5cdFx0XHRcdHRoaXMuc2NtVmlld1NlcnZpY2UuZm9jdXMocmVwb3NpdG9yeSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ3NjbS5hdXRvUmV2ZWFsJykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB1cmkgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3IsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuUFJJTUFSWSB9KTtcblxuXHRcdGlmICghdXJpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gRG8gbm90IHNldCBmb2N1cy9zZWxlY3Rpb24gd2hlbiB0aGUgcmVzb3VyY2UgaXMgYWxyZWFkeSBmb2N1c2VkIGFuZCBzZWxlY3RlZFxuXHRcdGlmICh0aGlzLnRyZWUuZ2V0Rm9jdXMoKS5zb21lKGUgPT4gaXNTQ01SZXNvdXJjZShlKSAmJiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChlLnNvdXJjZVVyaSwgdXJpKSkgJiZcblx0XHRcdHRoaXMudHJlZS5nZXRTZWxlY3Rpb24oKS5zb21lKGUgPT4gaXNTQ01SZXNvdXJjZShlKSAmJiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChlLnNvdXJjZVVyaSwgdXJpKSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnJldmVhbFJlc291cmNlVGhyb3R0bGVyLnF1ZXVlKFxuXHRcdFx0KCkgPT4gdGhpcy50cmVlT3BlcmF0aW9uU2VxdWVuY2VyLnF1ZXVlKFxuXHRcdFx0XHRhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCByZXBvc2l0b3J5IG9mIHRoaXMuc2NtVmlld1NlcnZpY2UudmlzaWJsZVJlcG9zaXRvcmllcykge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbSA9IHRoaXMuaXRlbXMuZ2V0KHJlcG9zaXRvcnkpO1xuXG5cdFx0XHRcdFx0XHRpZiAoIWl0ZW0pIHtcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIGdvIGJhY2t3YXJkcyBmcm9tIGxhc3QgZ3JvdXBcblx0XHRcdFx0XHRcdGZvciAobGV0IGogPSByZXBvc2l0b3J5LnByb3ZpZGVyLmdyb3Vwcy5sZW5ndGggLSAxOyBqID49IDA7IGotLSkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBncm91cEl0ZW0gPSByZXBvc2l0b3J5LnByb3ZpZGVyLmdyb3Vwc1tqXTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgcmVzb3VyY2UgPSB0aGlzLnZpZXdNb2RlID09PSBWaWV3TW9kZS5UcmVlXG5cdFx0XHRcdFx0XHRcdFx0PyBncm91cEl0ZW0ucmVzb3VyY2VUcmVlLmdldE5vZGUodXJpKT8uZWxlbWVudFxuXHRcdFx0XHRcdFx0XHRcdDogZ3JvdXBJdGVtLnJlc291cmNlcy5maW5kKHIgPT4gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoci5zb3VyY2VVcmksIHVyaSkpO1xuXG5cdFx0XHRcdFx0XHRcdGlmIChyZXNvdXJjZSkge1xuXHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMudHJlZS5leHBhbmRUbyhyZXNvdXJjZSk7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy50cmVlLnJldmVhbChyZXNvdXJjZSk7XG5cblx0XHRcdFx0XHRcdFx0XHR0aGlzLnRyZWUuc2V0U2VsZWN0aW9uKFtyZXNvdXJjZV0pO1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMudHJlZS5zZXRGb2N1cyhbcmVzb3VyY2VdKTtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VWaXNpYmxlUmVwb3NpdG9yaWVzKHsgYWRkZWQsIHJlbW92ZWQgfTogSVNDTVZpZXdWaXNpYmxlUmVwb3NpdG9yeUNoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0Ly8gQWRkZWQgcmVwb3NpdG9yaWVzXG5cdFx0Zm9yIChjb25zdCByZXBvc2l0b3J5IG9mIGFkZGVkKSB7XG5cdFx0XHRjb25zdCByZXBvc2l0b3J5RGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRcdHJlcG9zaXRvcnlEaXNwb3NhYmxlcy5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIGFjdGlvbiBidXR0b24gKi9cblx0XHRcdFx0cmVwb3NpdG9yeS5wcm92aWRlci5hY3Rpb25CdXR0b24ucmVhZChyZWFkZXIpO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUNoaWxkcmVuKHJlcG9zaXRvcnkpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHRyZXBvc2l0b3J5RGlzcG9zYWJsZXMuYWRkKHJlcG9zaXRvcnkuaW5wdXQub25EaWRDaGFuZ2VWaXNpYmlsaXR5KCgpID0+IHRoaXMudXBkYXRlQ2hpbGRyZW4ocmVwb3NpdG9yeSkpKTtcblx0XHRcdHJlcG9zaXRvcnlEaXNwb3NhYmxlcy5hZGQocmVwb3NpdG9yeS5wcm92aWRlci5vbkRpZENoYW5nZVJlc291cmNlR3JvdXBzKCgpID0+IHRoaXMudXBkYXRlQ2hpbGRyZW4ocmVwb3NpdG9yeSkpKTtcblxuXHRcdFx0Y29uc3QgcmVzb3VyY2VHcm91cERpc3Bvc2FibGVzID0gcmVwb3NpdG9yeURpc3Bvc2FibGVzLmFkZChuZXcgRGlzcG9zYWJsZU1hcDxJU0NNUmVzb3VyY2VHcm91cCwgSURpc3Bvc2FibGU+KCkpO1xuXG5cdFx0XHRjb25zdCBvbkRpZENoYW5nZVJlc291cmNlR3JvdXBzID0gKCkgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IFtyZXNvdXJjZUdyb3VwXSBvZiByZXNvdXJjZUdyb3VwRGlzcG9zYWJsZXMpIHtcblx0XHRcdFx0XHRpZiAoIXJlcG9zaXRvcnkucHJvdmlkZXIuZ3JvdXBzLmluY2x1ZGVzKHJlc291cmNlR3JvdXApKSB7XG5cdFx0XHRcdFx0XHRyZXNvdXJjZUdyb3VwRGlzcG9zYWJsZXMuZGVsZXRlQW5kRGlzcG9zZShyZXNvdXJjZUdyb3VwKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGNvbnN0IHJlc291cmNlR3JvdXAgb2YgcmVwb3NpdG9yeS5wcm92aWRlci5ncm91cHMpIHtcblx0XHRcdFx0XHRpZiAoIXJlc291cmNlR3JvdXBEaXNwb3NhYmxlcy5oYXMocmVzb3VyY2VHcm91cCkpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGRpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdFx0XHRcdFx0ZGlzcG9zYWJsZVN0b3JlLmFkZChyZXNvdXJjZUdyb3VwLm9uRGlkQ2hhbmdlKCgpID0+IHRoaXMudXBkYXRlQ2hpbGRyZW4ocmVwb3NpdG9yeSkpKTtcblx0XHRcdFx0XHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQocmVzb3VyY2VHcm91cC5vbkRpZENoYW5nZVJlc291cmNlcygoKSA9PiB0aGlzLnVwZGF0ZUNoaWxkcmVuKHJlcG9zaXRvcnkpKSk7XG5cdFx0XHRcdFx0XHRyZXNvdXJjZUdyb3VwRGlzcG9zYWJsZXMuc2V0KHJlc291cmNlR3JvdXAsIGRpc3Bvc2FibGVTdG9yZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHRyZXBvc2l0b3J5RGlzcG9zYWJsZXMuYWRkKHJlcG9zaXRvcnkucHJvdmlkZXIub25EaWRDaGFuZ2VSZXNvdXJjZUdyb3VwcyhvbkRpZENoYW5nZVJlc291cmNlR3JvdXBzKSk7XG5cdFx0XHRvbkRpZENoYW5nZVJlc291cmNlR3JvdXBzKCk7XG5cblx0XHRcdHRoaXMuaXRlbXMuc2V0KHJlcG9zaXRvcnksIHJlcG9zaXRvcnlEaXNwb3NhYmxlcyk7XG5cdFx0fVxuXG5cdFx0Ly8gUmVtb3ZlZCByZXBvc2l0b3JpZXNcblx0XHRmb3IgKGNvbnN0IHJlcG9zaXRvcnkgb2YgcmVtb3ZlZCkge1xuXHRcdFx0dGhpcy5pdGVtcy5kZWxldGVBbmREaXNwb3NlKHJlcG9zaXRvcnkpO1xuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlQ2hpbGRyZW4oKTtcblx0XHR0aGlzLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlKCk7XG5cdH1cblxuXHRwcml2YXRlIG9uTGlzdENvbnRleHRNZW51KGU6IElUcmVlQ29udGV4dE1lbnVFdmVudDxUcmVlRWxlbWVudCB8IG51bGw+KTogdm9pZCB7XG5cdFx0aWYgKCFlLmVsZW1lbnQpIHtcblx0XHRcdGNvbnN0IG1lbnUgPSB0aGlzLm1lbnVTZXJ2aWNlLmdldE1lbnVBY3Rpb25zKE1lbnVzLlZpZXdTb3J0LCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGFjdGlvbnMgPSBnZXRGbGF0Q29udGV4dE1lbnVBY3Rpb25zKG1lbnUpO1xuXG5cdFx0XHRyZXR1cm4gdGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiBlLmFuY2hvcixcblx0XHRcdFx0Z2V0QWN0aW9uczogKCkgPT4gYWN0aW9ucyxcblx0XHRcdFx0b25IaWRlOiAoKSA9PiB7IH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVsZW1lbnQgPSBlLmVsZW1lbnQ7XG5cdFx0bGV0IGNvbnRleHQ6IGFueSA9IGVsZW1lbnQ7XG5cdFx0bGV0IGFjdGlvbnM6IElBY3Rpb25bXSA9IFtdO1xuXHRcdGxldCBhY3Rpb25SdW5uZXI6IElBY3Rpb25SdW5uZXIgPSBuZXcgUmVwb3NpdG9yeVBhbmVBY3Rpb25SdW5uZXIoKCkgPT4gdGhpcy5nZXRTZWxlY3RlZFJlc291cmNlcygpKTtcblxuXHRcdGlmIChpc1NDTVJlcG9zaXRvcnkoZWxlbWVudCkpIHtcblx0XHRcdGNvbnN0IG1lbnVzID0gdGhpcy5zY21WaWV3U2VydmljZS5tZW51cy5nZXRSZXBvc2l0b3J5TWVudXMoZWxlbWVudC5wcm92aWRlcik7XG5cdFx0XHRjb25zdCBtZW51ID0gbWVudXMucmVwb3NpdG9yeUNvbnRleHRNZW51O1xuXHRcdFx0Y29udGV4dCA9IGVsZW1lbnQucHJvdmlkZXI7XG5cdFx0XHRhY3Rpb25SdW5uZXIgPSBuZXcgUmVwb3NpdG9yeUFjdGlvblJ1bm5lcigoKSA9PiB0aGlzLmdldFNlbGVjdGVkUmVwb3NpdG9yaWVzKCkpO1xuXHRcdFx0YWN0aW9ucyA9IGNvbGxlY3RDb250ZXh0TWVudUFjdGlvbnMobWVudSk7XG5cdFx0fSBlbHNlIGlmIChpc1NDTUlucHV0KGVsZW1lbnQpIHx8IGlzU0NNQWN0aW9uQnV0dG9uKGVsZW1lbnQpKSB7XG5cdFx0XHQvLyBub29wXG5cdFx0fSBlbHNlIGlmIChpc1NDTVJlc291cmNlR3JvdXAoZWxlbWVudCkpIHtcblx0XHRcdGNvbnN0IG1lbnVzID0gdGhpcy5zY21WaWV3U2VydmljZS5tZW51cy5nZXRSZXBvc2l0b3J5TWVudXMoZWxlbWVudC5wcm92aWRlcik7XG5cdFx0XHRjb25zdCBtZW51ID0gbWVudXMuZ2V0UmVzb3VyY2VHcm91cE1lbnUoZWxlbWVudCk7XG5cdFx0XHRhY3Rpb25zID0gY29sbGVjdENvbnRleHRNZW51QWN0aW9ucyhtZW51KTtcblx0XHR9IGVsc2UgaWYgKGlzU0NNUmVzb3VyY2UoZWxlbWVudCkpIHtcblx0XHRcdGNvbnN0IG1lbnVzID0gdGhpcy5zY21WaWV3U2VydmljZS5tZW51cy5nZXRSZXBvc2l0b3J5TWVudXMoZWxlbWVudC5yZXNvdXJjZUdyb3VwLnByb3ZpZGVyKTtcblx0XHRcdGNvbnN0IG1lbnUgPSBtZW51cy5nZXRSZXNvdXJjZU1lbnUoZWxlbWVudCk7XG5cdFx0XHRhY3Rpb25zID0gY29sbGVjdENvbnRleHRNZW51QWN0aW9ucyhtZW51KTtcblx0XHR9IGVsc2UgaWYgKGlzU0NNUmVzb3VyY2VOb2RlKGVsZW1lbnQpKSB7XG5cdFx0XHRpZiAoZWxlbWVudC5lbGVtZW50KSB7XG5cdFx0XHRcdGNvbnN0IG1lbnVzID0gdGhpcy5zY21WaWV3U2VydmljZS5tZW51cy5nZXRSZXBvc2l0b3J5TWVudXMoZWxlbWVudC5lbGVtZW50LnJlc291cmNlR3JvdXAucHJvdmlkZXIpO1xuXHRcdFx0XHRjb25zdCBtZW51ID0gbWVudXMuZ2V0UmVzb3VyY2VNZW51KGVsZW1lbnQuZWxlbWVudCk7XG5cdFx0XHRcdGFjdGlvbnMgPSBjb2xsZWN0Q29udGV4dE1lbnVBY3Rpb25zKG1lbnUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgbWVudXMgPSB0aGlzLnNjbVZpZXdTZXJ2aWNlLm1lbnVzLmdldFJlcG9zaXRvcnlNZW51cyhlbGVtZW50LmNvbnRleHQucHJvdmlkZXIpO1xuXHRcdFx0XHRjb25zdCBtZW51ID0gbWVudXMuZ2V0UmVzb3VyY2VGb2xkZXJNZW51KGVsZW1lbnQuY29udGV4dCk7XG5cdFx0XHRcdGFjdGlvbnMgPSBjb2xsZWN0Q29udGV4dE1lbnVBY3Rpb25zKG1lbnUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGFjdGlvblJ1bm5lci5vbldpbGxSdW4oKCkgPT4gdGhpcy50cmVlLmRvbUZvY3VzKCkpO1xuXG5cdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdGFjdGlvblJ1bm5lcixcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gZS5hbmNob3IsXG5cdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiBhY3Rpb25zLFxuXHRcdFx0Z2V0QWN0aW9uc0NvbnRleHQ6ICgpID0+IGNvbnRleHQsXG5cdFx0XHRvbkhpZGU6ICgpID0+IGFjdGlvblJ1bm5lci5kaXNwb3NlKClcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0U2VsZWN0ZWRSZXBvc2l0b3JpZXMoKTogSVNDTVJlcG9zaXRvcnlbXSB7XG5cdFx0Y29uc3QgZm9jdXNlZFJlcG9zaXRvcmllcyA9IHRoaXMudHJlZS5nZXRGb2N1cygpLmZpbHRlcihyID0+ICEhciAmJiBpc1NDTVJlcG9zaXRvcnkocikpISBhcyBJU0NNUmVwb3NpdG9yeVtdO1xuXHRcdGNvbnN0IHNlbGVjdGVkUmVwb3NpdG9yaWVzID0gdGhpcy50cmVlLmdldFNlbGVjdGlvbigpLmZpbHRlcihyID0+ICEhciAmJiBpc1NDTVJlcG9zaXRvcnkocikpISBhcyBJU0NNUmVwb3NpdG9yeVtdO1xuXG5cdFx0cmV0dXJuIEFycmF5LmZyb20obmV3IFNldDxJU0NNUmVwb3NpdG9yeT4oWy4uLmZvY3VzZWRSZXBvc2l0b3JpZXMsIC4uLnNlbGVjdGVkUmVwb3NpdG9yaWVzXSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRTZWxlY3RlZFJlc291cmNlcygpOiAoSVNDTVJlc291cmNlR3JvdXAgfCBJU0NNUmVzb3VyY2UgfCBJUmVzb3VyY2VOb2RlPElTQ01SZXNvdXJjZSwgSVNDTVJlc291cmNlR3JvdXA+KVtdIHtcblx0XHRyZXR1cm4gdGhpcy50cmVlLmdldFNlbGVjdGlvbigpLmZpbHRlcihyID0+IGlzU0NNUmVzb3VyY2VHcm91cChyKSB8fCBpc1NDTVJlc291cmNlKHIpIHx8IGlzU0NNUmVzb3VyY2VOb2RlKHIpKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Vmlld01vZGUoKTogVmlld01vZGUge1xuXHRcdGxldCBtb2RlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTwndHJlZScgfCAnbGlzdCc+KCdzY20uZGVmYXVsdFZpZXdNb2RlJykgPT09ICdsaXN0JyA/IFZpZXdNb2RlLkxpc3QgOiBWaWV3TW9kZS5UcmVlO1xuXHRcdGNvbnN0IHN0b3JhZ2VNb2RlID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoYHNjbS52aWV3TW9kZWAsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpIGFzIFZpZXdNb2RlO1xuXHRcdGlmICh0eXBlb2Ygc3RvcmFnZU1vZGUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRtb2RlID0gc3RvcmFnZU1vZGU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG1vZGU7XG5cdH1cblxuXHRwcml2YXRlIGdldFZpZXdTb3J0S2V5KCk6IFZpZXdTb3J0S2V5IHtcblx0XHQvLyBUcmVlXG5cdFx0aWYgKHRoaXMuX3ZpZXdNb2RlID09PSBWaWV3TW9kZS5UcmVlKSB7XG5cdFx0XHRyZXR1cm4gVmlld1NvcnRLZXkuUGF0aDtcblx0XHR9XG5cblx0XHQvLyBMaXN0XG5cdFx0bGV0IHZpZXdTb3J0S2V5OiBWaWV3U29ydEtleTtcblx0XHRjb25zdCB2aWV3U29ydEtleVN0cmluZyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J3BhdGgnIHwgJ25hbWUnIHwgJ3N0YXR1cyc+KCdzY20uZGVmYXVsdFZpZXdTb3J0S2V5Jyk7XG5cdFx0c3dpdGNoICh2aWV3U29ydEtleVN0cmluZykge1xuXHRcdFx0Y2FzZSAnbmFtZSc6XG5cdFx0XHRcdHZpZXdTb3J0S2V5ID0gVmlld1NvcnRLZXkuTmFtZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdzdGF0dXMnOlxuXHRcdFx0XHR2aWV3U29ydEtleSA9IFZpZXdTb3J0S2V5LlN0YXR1cztcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR2aWV3U29ydEtleSA9IFZpZXdTb3J0S2V5LlBhdGg7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0b3JhZ2VTb3J0S2V5ID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoYHNjbS52aWV3U29ydEtleWAsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpIGFzIFZpZXdTb3J0S2V5O1xuXHRcdGlmICh0eXBlb2Ygc3RvcmFnZVNvcnRLZXkgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR2aWV3U29ydEtleSA9IHN0b3JhZ2VTb3J0S2V5O1xuXHRcdH1cblxuXHRcdHJldHVybiB2aWV3U29ydEtleTtcblx0fVxuXG5cdHByaXZhdGUgbG9hZFRyZWVWaWV3U3RhdGUoKTogSUFzeW5jRGF0YVRyZWVWaWV3U3RhdGUgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHN0b3JhZ2VWaWV3U3RhdGUgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldCgnc2NtLnZpZXdTdGF0ZTInLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0XHRpZiAoIXN0b3JhZ2VWaWV3U3RhdGUpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHRyZWVWaWV3U3RhdGUgPSBKU09OLnBhcnNlKHN0b3JhZ2VWaWV3U3RhdGUpO1xuXHRcdFx0cmV0dXJuIHRyZWVWaWV3U3RhdGU7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RvcmVUcmVlVmlld1N0YXRlKCkge1xuXHRcdGlmICh0aGlzLnRyZWUpIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ3NjbS52aWV3U3RhdGUyJywgSlNPTi5zdHJpbmdpZnkodGhpcy50cmVlLmdldFZpZXdTdGF0ZSgpKSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNoaWxkcmVuKGVsZW1lbnQ/OiBJU0NNUmVwb3NpdG9yeSkge1xuXHRcdHRoaXMudXBkYXRlQ2hpbGRyZW5UaHJvdHRsZXIucXVldWUoXG5cdFx0XHQoKSA9PiB0aGlzLnRyZWVPcGVyYXRpb25TZXF1ZW5jZXIucXVldWUoXG5cdFx0XHRcdGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBmb2N1c2VkSW5wdXQgPSB0aGlzLmlucHV0UmVuZGVyZXIuZ2V0Rm9jdXNlZElucHV0KCk7XG5cblx0XHRcdFx0XHRpZiAoZWxlbWVudCAmJiB0aGlzLnRyZWUuaGFzTm9kZShlbGVtZW50KSkge1xuXHRcdFx0XHRcdFx0Ly8gUmVmcmVzaCBzcGVjaWZpYyByZXBvc2l0b3J5XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnRyZWUudXBkYXRlQ2hpbGRyZW4oZWxlbWVudCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIFJlZnJlc2ggdGhlIGVudGlyZSB0cmVlXG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnRyZWUudXBkYXRlQ2hpbGRyZW4odW5kZWZpbmVkKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoZm9jdXNlZElucHV0KSB7XG5cdFx0XHRcdFx0XHR0aGlzLmlucHV0UmVuZGVyZXIuZ2V0UmVuZGVyZWRJbnB1dFdpZGdldChmb2N1c2VkSW5wdXQpPy5mb2N1cygpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoaXMudXBkYXRlU2NtUHJvdmlkZXJDb250ZXh0S2V5cygpO1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlUmVwb3NpdG9yeUNvbGxhcHNlQWxsQ29udGV4dEtleXMoKTtcblx0XHRcdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVJbmRlbnRTdHlsZXModGhlbWU6IElGaWxlSWNvblRoZW1lKTogdm9pZCB7XG5cdFx0dGhpcy50cmVlQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2xpc3Qtdmlldy1tb2RlJywgdGhpcy52aWV3TW9kZSA9PT0gVmlld01vZGUuTGlzdCk7XG5cdFx0dGhpcy50cmVlQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ3RyZWUtdmlldy1tb2RlJywgdGhpcy52aWV3TW9kZSA9PT0gVmlld01vZGUuVHJlZSk7XG5cdFx0dGhpcy50cmVlQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2FsaWduLWljb25zLWFuZC10d2lzdGllcycsICh0aGlzLnZpZXdNb2RlID09PSBWaWV3TW9kZS5MaXN0ICYmIHRoZW1lLmhhc0ZpbGVJY29ucykgfHwgKHRoZW1lLmhhc0ZpbGVJY29ucyAmJiAhdGhlbWUuaGFzRm9sZGVySWNvbnMpKTtcblx0XHR0aGlzLnRyZWVDb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZS1hcnJvd3MnLCB0aGlzLnZpZXdNb2RlID09PSBWaWV3TW9kZS5UcmVlICYmIHRoZW1lLmhpZGVzRXhwbG9yZXJBcnJvd3MgPT09IHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVTY21Qcm92aWRlckNvbnRleHRLZXlzKCk6IHZvaWQge1xuXHRcdGNvbnN0IGFsd2F5c1Nob3dSZXBvc2l0b3JpZXMgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KCdzY20uYWx3YXlzU2hvd1JlcG9zaXRvcmllcycpO1xuXG5cdFx0aWYgKCFhbHdheXNTaG93UmVwb3NpdG9yaWVzICYmIHRoaXMuaXRlbXMuc2l6ZSA9PT0gMSkge1xuXHRcdFx0Y29uc3QgcHJvdmlkZXIgPSBJdGVyYWJsZS5maXJzdCh0aGlzLml0ZW1zLmtleXMoKSkhLnByb3ZpZGVyO1xuXHRcdFx0dGhpcy5zY21Qcm92aWRlckNvbnRleHRLZXkuc2V0KHByb3ZpZGVyLmNvbnRleHRWYWx1ZSk7XG5cdFx0XHR0aGlzLnNjbVByb3ZpZGVyUm9vdFVyaUNvbnRleHRLZXkuc2V0KHByb3ZpZGVyLnJvb3RVcmk/LnRvU3RyaW5nKCkpO1xuXHRcdFx0dGhpcy5zY21Qcm92aWRlckhhc1Jvb3RVcmlDb250ZXh0S2V5LnNldCghIXByb3ZpZGVyLnJvb3RVcmkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNjbVByb3ZpZGVyQ29udGV4dEtleS5zZXQodW5kZWZpbmVkKTtcblx0XHRcdHRoaXMuc2NtUHJvdmlkZXJSb290VXJpQ29udGV4dEtleS5zZXQodW5kZWZpbmVkKTtcblx0XHRcdHRoaXMuc2NtUHJvdmlkZXJIYXNSb290VXJpQ29udGV4dEtleS5zZXQoZmFsc2UpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlUmVwb3NpdG9yeUNvbGxhcHNlQWxsQ29udGV4dEtleXMoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmlzQm9keVZpc2libGUoKSB8fCB0aGlzLml0ZW1zLnNpemUgPT09IDEpIHtcblx0XHRcdHRoaXMuaXNBbnlSZXBvc2l0b3J5Q29sbGFwc2libGVDb250ZXh0S2V5LnNldChmYWxzZSk7XG5cdFx0XHR0aGlzLmFyZUFsbFJlcG9zaXRvcmllc0NvbGxhcHNlZENvbnRleHRLZXkuc2V0KGZhbHNlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmlzQW55UmVwb3NpdG9yeUNvbGxhcHNpYmxlQ29udGV4dEtleS5zZXQodGhpcy5zY21WaWV3U2VydmljZS52aXNpYmxlUmVwb3NpdG9yaWVzLnNvbWUociA9PiB0aGlzLnRyZWUuaGFzTm9kZShyKSAmJiB0aGlzLnRyZWUuaXNDb2xsYXBzaWJsZShyKSkpO1xuXHRcdHRoaXMuYXJlQWxsUmVwb3NpdG9yaWVzQ29sbGFwc2VkQ29udGV4dEtleS5zZXQodGhpcy5zY21WaWV3U2VydmljZS52aXNpYmxlUmVwb3NpdG9yaWVzLmV2ZXJ5KHIgPT4gdGhpcy50cmVlLmhhc05vZGUocikgJiYgKCF0aGlzLnRyZWUuaXNDb2xsYXBzaWJsZShyKSB8fCB0aGlzLnRyZWUuaXNDb2xsYXBzZWQocikpKSk7XG5cdH1cblxuXHRjb2xsYXBzZUFsbFJlcG9zaXRvcmllcygpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IHJlcG9zaXRvcnkgb2YgdGhpcy5zY21WaWV3U2VydmljZS52aXNpYmxlUmVwb3NpdG9yaWVzKSB7XG5cdFx0XHRpZiAodGhpcy50cmVlLmlzQ29sbGFwc2libGUocmVwb3NpdG9yeSkpIHtcblx0XHRcdFx0dGhpcy50cmVlLmNvbGxhcHNlKHJlcG9zaXRvcnkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGV4cGFuZEFsbFJlcG9zaXRvcmllcygpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IHJlcG9zaXRvcnkgb2YgdGhpcy5zY21WaWV3U2VydmljZS52aXNpYmxlUmVwb3NpdG9yaWVzKSB7XG5cdFx0XHRpZiAodGhpcy50cmVlLmlzQ29sbGFwc2libGUocmVwb3NpdG9yeSkpIHtcblx0XHRcdFx0dGhpcy50cmVlLmV4cGFuZChyZXBvc2l0b3J5KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRmb2N1c1ByZXZpb3VzSW5wdXQoKTogdm9pZCB7XG5cdFx0dGhpcy50cmVlT3BlcmF0aW9uU2VxdWVuY2VyLnF1ZXVlKCgpID0+IHRoaXMuZm9jdXNJbnB1dCgtMSkpO1xuXHR9XG5cblx0Zm9jdXNOZXh0SW5wdXQoKTogdm9pZCB7XG5cdFx0dGhpcy50cmVlT3BlcmF0aW9uU2VxdWVuY2VyLnF1ZXVlKCgpID0+IHRoaXMuZm9jdXNJbnB1dCgxKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGZvY3VzSW5wdXQoZGVsdGE6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5zY21WaWV3U2VydmljZS5mb2N1c2VkUmVwb3NpdG9yeSB8fFxuXHRcdFx0dGhpcy5zY21WaWV3U2VydmljZS52aXNpYmxlUmVwb3NpdG9yaWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBpbnB1dCA9IHRoaXMuc2NtVmlld1NlcnZpY2UuZm9jdXNlZFJlcG9zaXRvcnkuaW5wdXQ7XG5cdFx0Y29uc3QgcmVwb3NpdG9yaWVzID0gdGhpcy5zY21WaWV3U2VydmljZS52aXNpYmxlUmVwb3NpdG9yaWVzO1xuXG5cdFx0Ly8gT25lIHZpc2libGUgcmVwb3NpdG9yeSBhbmQgdGhlIGlucHV0IGlzIGFscmVhZHkgZm9jdXNlZFxuXHRcdGlmIChyZXBvc2l0b3JpZXMubGVuZ3RoID09PSAxICYmIHRoaXMuaW5wdXRSZW5kZXJlci5nZXRSZW5kZXJlZElucHV0V2lkZ2V0KGlucHV0KT8uaGFzRm9jdXMoKSA9PT0gdHJ1ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIE11bHRpcGxlIHZpc2libGUgcmVwb3NpdG9yaWVzIGFuZCB0aGUgaW5wdXQgYWxyZWFkeSBmb2N1c2VkXG5cdFx0aWYgKHJlcG9zaXRvcmllcy5sZW5ndGggPiAxICYmIHRoaXMuaW5wdXRSZW5kZXJlci5nZXRSZW5kZXJlZElucHV0V2lkZ2V0KGlucHV0KT8uaGFzRm9jdXMoKSA9PT0gdHJ1ZSkge1xuXHRcdFx0Y29uc3QgZm9jdXNlZFJlcG9zaXRvcnlJbmRleCA9IHJlcG9zaXRvcmllcy5pbmRleE9mKHRoaXMuc2NtVmlld1NlcnZpY2UuZm9jdXNlZFJlcG9zaXRvcnkpO1xuXHRcdFx0Y29uc3QgbmV3Rm9jdXNlZFJlcG9zaXRvcnlJbmRleCA9IHJvdChmb2N1c2VkUmVwb3NpdG9yeUluZGV4ICsgZGVsdGEsIHJlcG9zaXRvcmllcy5sZW5ndGgpO1xuXHRcdFx0aW5wdXQgPSByZXBvc2l0b3JpZXNbbmV3Rm9jdXNlZFJlcG9zaXRvcnlJbmRleF0uaW5wdXQ7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy50cmVlLmV4cGFuZFRvKGlucHV0KTtcblxuXHRcdHRoaXMudHJlZS5yZXZlYWwoaW5wdXQpO1xuXHRcdHRoaXMuaW5wdXRSZW5kZXJlci5nZXRSZW5kZXJlZElucHV0V2lkZ2V0KGlucHV0KT8uZm9jdXMoKTtcblx0fVxuXG5cdGZvY3VzUHJldmlvdXNSZXNvdXJjZUdyb3VwKCk6IHZvaWQge1xuXHRcdHRoaXMudHJlZU9wZXJhdGlvblNlcXVlbmNlci5xdWV1ZSgoKSA9PiB0aGlzLmZvY3VzUmVzb3VyY2VHcm91cCgtMSkpO1xuXHR9XG5cblx0Zm9jdXNOZXh0UmVzb3VyY2VHcm91cCgpOiB2b2lkIHtcblx0XHR0aGlzLnRyZWVPcGVyYXRpb25TZXF1ZW5jZXIucXVldWUoKCkgPT4gdGhpcy5mb2N1c1Jlc291cmNlR3JvdXAoMSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBmb2N1c1Jlc291cmNlR3JvdXAoZGVsdGE6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5zY21WaWV3U2VydmljZS5mb2N1c2VkUmVwb3NpdG9yeSB8fFxuXHRcdFx0dGhpcy5zY21WaWV3U2VydmljZS52aXNpYmxlUmVwb3NpdG9yaWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRyZWVIYXNEb21Gb2N1cyA9IGlzQWN0aXZlRWxlbWVudCh0aGlzLnRyZWUuZ2V0SFRNTEVsZW1lbnQoKSk7XG5cdFx0Y29uc3QgcmVzb3VyY2VHcm91cHMgPSB0aGlzLnNjbVZpZXdTZXJ2aWNlLmZvY3VzZWRSZXBvc2l0b3J5LnByb3ZpZGVyLmdyb3Vwcztcblx0XHRjb25zdCBmb2N1c2VkUmVzb3VyY2VHcm91cCA9IHRoaXMudHJlZS5nZXRGb2N1cygpLmZpbmQoZSA9PiBpc1NDTVJlc291cmNlR3JvdXAoZSkpO1xuXHRcdGNvbnN0IGZvY3VzZWRSZXNvdXJjZUdyb3VwSW5kZXggPSB0cmVlSGFzRG9tRm9jdXMgJiYgZm9jdXNlZFJlc291cmNlR3JvdXAgPyByZXNvdXJjZUdyb3Vwcy5pbmRleE9mKGZvY3VzZWRSZXNvdXJjZUdyb3VwKSA6IC0xO1xuXG5cdFx0bGV0IHJlc291cmNlR3JvdXBOZXh0OiBJU0NNUmVzb3VyY2VHcm91cCB8IHVuZGVmaW5lZDtcblxuXHRcdGlmIChmb2N1c2VkUmVzb3VyY2VHcm91cEluZGV4ID09PSAtMSkge1xuXHRcdFx0Ly8gRmlyc3QgdmlzaWJsZSByZXNvdXJjZSBncm91cFxuXHRcdFx0Zm9yIChjb25zdCByZXNvdXJjZUdyb3VwIG9mIHJlc291cmNlR3JvdXBzKSB7XG5cdFx0XHRcdGlmICh0aGlzLnRyZWUuaGFzTm9kZShyZXNvdXJjZUdyb3VwKSkge1xuXHRcdFx0XHRcdHJlc291cmNlR3JvdXBOZXh0ID0gcmVzb3VyY2VHcm91cDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBOZXh0L1ByZXZpb3VzIHZpc2libGUgcmVzb3VyY2UgZ3JvdXBcblx0XHRcdGxldCBpbmRleCA9IHJvdChmb2N1c2VkUmVzb3VyY2VHcm91cEluZGV4ICsgZGVsdGEsIHJlc291cmNlR3JvdXBzLmxlbmd0aCk7XG5cdFx0XHR3aGlsZSAoaW5kZXggIT09IGZvY3VzZWRSZXNvdXJjZUdyb3VwSW5kZXgpIHtcblx0XHRcdFx0aWYgKHRoaXMudHJlZS5oYXNOb2RlKHJlc291cmNlR3JvdXBzW2luZGV4XSkpIHtcblx0XHRcdFx0XHRyZXNvdXJjZUdyb3VwTmV4dCA9IHJlc291cmNlR3JvdXBzW2luZGV4XTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRpbmRleCA9IHJvdChpbmRleCArIGRlbHRhLCByZXNvdXJjZUdyb3Vwcy5sZW5ndGgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChyZXNvdXJjZUdyb3VwTmV4dCkge1xuXHRcdFx0YXdhaXQgdGhpcy50cmVlLmV4cGFuZFRvKHJlc291cmNlR3JvdXBOZXh0KTtcblx0XHRcdHRoaXMudHJlZS5yZXZlYWwocmVzb3VyY2VHcm91cE5leHQpO1xuXG5cdFx0XHR0aGlzLnRyZWUuc2V0U2VsZWN0aW9uKFtyZXNvdXJjZUdyb3VwTmV4dF0pO1xuXHRcdFx0dGhpcy50cmVlLnNldEZvY3VzKFtyZXNvdXJjZUdyb3VwTmV4dF0pO1xuXHRcdFx0dGhpcy50cmVlLmRvbUZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgc2hvdWxkU2hvd1dlbGNvbWUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuc2NtU2VydmljZS5yZXBvc2l0b3J5Q291bnQgPT09IDA7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRBY3Rpb25zQ29udGV4dCgpOiB1bmtub3duIHtcblx0XHRyZXR1cm4gdGhpcy5zY21WaWV3U2VydmljZS52aXNpYmxlUmVwb3NpdG9yaWVzLmxlbmd0aCA9PT0gMSA/IHRoaXMuc2NtVmlld1NlcnZpY2UudmlzaWJsZVJlcG9zaXRvcmllc1swXS5wcm92aWRlciA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdG92ZXJyaWRlIGZvY3VzKCk6IHZvaWQge1xuXHRcdHN1cGVyLmZvY3VzKCk7XG5cblx0XHR0aGlzLnRyZWVPcGVyYXRpb25TZXF1ZW5jZXIucXVldWUoKCkgPT4ge1xuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5pc0V4cGFuZGVkKCkpIHtcblx0XHRcdFx0XHRpZiAodGhpcy50cmVlLmdldEZvY3VzKCkubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHJlcG9zaXRvcnkgb2YgdGhpcy5zY21WaWV3U2VydmljZS52aXNpYmxlUmVwb3NpdG9yaWVzKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuaW5wdXRSZW5kZXJlci5nZXRSZW5kZXJlZElucHV0V2lkZ2V0KHJlcG9zaXRvcnkuaW5wdXQpO1xuXG5cdFx0XHRcdFx0XHRcdGlmICh3aWRnZXQpIHtcblx0XHRcdFx0XHRcdFx0XHR3aWRnZXQuZm9jdXMoKTtcblx0XHRcdFx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhpcy50cmVlLmRvbUZvY3VzKCk7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy52aXNpYmlsaXR5RGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuaXRlbXMuZGlzcG9zZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBTQ01UcmVlRGF0YVNvdXJjZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQXN5bmNEYXRhU291cmNlPElTQ01WaWV3U2VydmljZSwgVHJlZUVsZW1lbnQ+IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSB2aWV3TW9kZTogKCkgPT4gVmlld01vZGUsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElTQ01WaWV3U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHNjbVZpZXdTZXJ2aWNlOiBJU0NNVmlld1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGFzeW5jIGdldENoaWxkcmVuKGlucHV0T3JFbGVtZW50OiBJU0NNVmlld1NlcnZpY2UgfCBUcmVlRWxlbWVudCk6IFByb21pc2U8SXRlcmFibGU8VHJlZUVsZW1lbnQ+PiB7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeUNvdW50ID0gdGhpcy5zY21WaWV3U2VydmljZS52aXNpYmxlUmVwb3NpdG9yaWVzLmxlbmd0aDtcblxuXHRcdGNvbnN0IHNob3dBY3Rpb25CdXR0b24gPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KCdzY20uc2hvd0FjdGlvbkJ1dHRvbicpID09PSB0cnVlO1xuXHRcdGNvbnN0IGFsd2F5c1Nob3dSZXBvc2l0b3JpZXMgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KCdzY20uYWx3YXlzU2hvd1JlcG9zaXRvcmllcycpID09PSB0cnVlO1xuXG5cdFx0aWYgKGlzU0NNVmlld1NlcnZpY2UoaW5wdXRPckVsZW1lbnQpICYmIChyZXBvc2l0b3J5Q291bnQgPiAxIHx8IGFsd2F5c1Nob3dSZXBvc2l0b3JpZXMpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zY21WaWV3U2VydmljZS52aXNpYmxlUmVwb3NpdG9yaWVzO1xuXHRcdH0gZWxzZSBpZiAoKGlzU0NNVmlld1NlcnZpY2UoaW5wdXRPckVsZW1lbnQpICYmIHJlcG9zaXRvcnlDb3VudCA9PT0gMSAmJiAhYWx3YXlzU2hvd1JlcG9zaXRvcmllcykgfHwgaXNTQ01SZXBvc2l0b3J5KGlucHV0T3JFbGVtZW50KSkge1xuXHRcdFx0Y29uc3QgY2hpbGRyZW46IFRyZWVFbGVtZW50W10gPSBbXTtcblxuXHRcdFx0aW5wdXRPckVsZW1lbnQgPSBpc1NDTVJlcG9zaXRvcnkoaW5wdXRPckVsZW1lbnQpID8gaW5wdXRPckVsZW1lbnQgOiB0aGlzLnNjbVZpZXdTZXJ2aWNlLnZpc2libGVSZXBvc2l0b3JpZXNbMF07XG5cdFx0XHRjb25zdCBhY3Rpb25CdXR0b24gPSBpbnB1dE9yRWxlbWVudC5wcm92aWRlci5hY3Rpb25CdXR0b24uZ2V0KCk7XG5cdFx0XHRjb25zdCByZXNvdXJjZUdyb3VwcyA9IGlucHV0T3JFbGVtZW50LnByb3ZpZGVyLmdyb3VwcztcblxuXHRcdFx0Ly8gU0NNIElucHV0XG5cdFx0XHRpZiAoaW5wdXRPckVsZW1lbnQuaW5wdXQudmlzaWJsZSkge1xuXHRcdFx0XHRjaGlsZHJlbi5wdXNoKGlucHV0T3JFbGVtZW50LmlucHV0KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQWN0aW9uIEJ1dHRvblxuXHRcdFx0aWYgKHNob3dBY3Rpb25CdXR0b24gJiYgYWN0aW9uQnV0dG9uKSB7XG5cdFx0XHRcdGNoaWxkcmVuLnB1c2goe1xuXHRcdFx0XHRcdHR5cGU6ICdhY3Rpb25CdXR0b24nLFxuXHRcdFx0XHRcdHJlcG9zaXRvcnk6IGlucHV0T3JFbGVtZW50LFxuXHRcdFx0XHRcdGJ1dHRvbjogYWN0aW9uQnV0dG9uXG5cdFx0XHRcdH0gc2F0aXNmaWVzIElTQ01BY3Rpb25CdXR0b24pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBSZXNvdXJjZUdyb3Vwc1xuXHRcdFx0Y29uc3QgaGFzU29tZUNoYW5nZXMgPSByZXNvdXJjZUdyb3Vwcy5zb21lKGdyb3VwID0+IGdyb3VwLnJlc291cmNlcy5sZW5ndGggPiAwKTtcblx0XHRcdGlmIChoYXNTb21lQ2hhbmdlcyB8fCAocmVwb3NpdG9yeUNvdW50ID09PSAxICYmICghc2hvd0FjdGlvbkJ1dHRvbiB8fCAhYWN0aW9uQnV0dG9uKSkpIHtcblx0XHRcdFx0Y2hpbGRyZW4ucHVzaCguLi5yZXNvdXJjZUdyb3Vwcyk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBjaGlsZHJlbjtcblx0XHR9IGVsc2UgaWYgKGlzU0NNUmVzb3VyY2VHcm91cChpbnB1dE9yRWxlbWVudCkpIHtcblx0XHRcdGlmICh0aGlzLnZpZXdNb2RlKCkgPT09IFZpZXdNb2RlLkxpc3QpIHtcblx0XHRcdFx0Ly8gUmVzb3VyY2VzIChMaXN0KVxuXHRcdFx0XHRyZXR1cm4gaW5wdXRPckVsZW1lbnQucmVzb3VyY2VzO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLnZpZXdNb2RlKCkgPT09IFZpZXdNb2RlLlRyZWUpIHtcblx0XHRcdFx0Ly8gUmVzb3VyY2VzIChUcmVlKVxuXHRcdFx0XHRjb25zdCBjaGlsZHJlbjogVHJlZUVsZW1lbnRbXSA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IG5vZGUgb2YgaW5wdXRPckVsZW1lbnQucmVzb3VyY2VUcmVlLnJvb3QuY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRjaGlsZHJlbi5wdXNoKG5vZGUuZWxlbWVudCAmJiBub2RlLmNoaWxkcmVuQ291bnQgPT09IDAgPyBub2RlLmVsZW1lbnQgOiBub2RlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBjaGlsZHJlbjtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGlzU0NNUmVzb3VyY2VOb2RlKGlucHV0T3JFbGVtZW50KSkge1xuXHRcdFx0Ly8gUmVzb3VyY2VzIChUcmVlKSwgSGlzdG9yeSBpdGVtIGNoYW5nZXMgKFRyZWUpXG5cdFx0XHRjb25zdCBjaGlsZHJlbjogVHJlZUVsZW1lbnRbXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBub2RlIG9mIGlucHV0T3JFbGVtZW50LmNoaWxkcmVuKSB7XG5cdFx0XHRcdGNoaWxkcmVuLnB1c2gobm9kZS5lbGVtZW50ICYmIG5vZGUuY2hpbGRyZW5Db3VudCA9PT0gMCA/IG5vZGUuZWxlbWVudCA6IG5vZGUpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gY2hpbGRyZW47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0Z2V0UGFyZW50KGVsZW1lbnQ6IFRyZWVFbGVtZW50KTogSVNDTVZpZXdTZXJ2aWNlIHwgVHJlZUVsZW1lbnQge1xuXHRcdGlmIChpc1NDTVJlc291cmNlTm9kZShlbGVtZW50KSkge1xuXHRcdFx0aWYgKGVsZW1lbnQucGFyZW50ID09PSBlbGVtZW50LmNvbnRleHQucmVzb3VyY2VUcmVlLnJvb3QpIHtcblx0XHRcdFx0cmV0dXJuIGVsZW1lbnQuY29udGV4dDtcblx0XHRcdH0gZWxzZSBpZiAoZWxlbWVudC5wYXJlbnQpIHtcblx0XHRcdFx0cmV0dXJuIGVsZW1lbnQucGFyZW50O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGVsZW1lbnQgcGFzc2VkIHRvIGdldFBhcmVudCcpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoaXNTQ01SZXNvdXJjZShlbGVtZW50KSkge1xuXHRcdFx0aWYgKHRoaXMudmlld01vZGUoKSA9PT0gVmlld01vZGUuTGlzdCkge1xuXHRcdFx0XHRyZXR1cm4gZWxlbWVudC5yZXNvdXJjZUdyb3VwO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBub2RlID0gZWxlbWVudC5yZXNvdXJjZUdyb3VwLnJlc291cmNlVHJlZS5nZXROb2RlKGVsZW1lbnQuc291cmNlVXJpKTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IG5vZGU/LnBhcmVudDtcblxuXHRcdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGVsZW1lbnQgcGFzc2VkIHRvIGdldFBhcmVudCcpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVzdWx0ID09PSBlbGVtZW50LnJlc291cmNlR3JvdXAucmVzb3VyY2VUcmVlLnJvb3QpIHtcblx0XHRcdFx0cmV0dXJuIGVsZW1lbnQucmVzb3VyY2VHcm91cDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9IGVsc2UgaWYgKGlzU0NNSW5wdXQoZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiBlbGVtZW50LnJlcG9zaXRvcnk7XG5cdFx0fSBlbHNlIGlmIChpc1NDTVJlc291cmNlR3JvdXAoZWxlbWVudCkpIHtcblx0XHRcdGNvbnN0IHJlcG9zaXRvcnkgPSB0aGlzLnNjbVZpZXdTZXJ2aWNlLnZpc2libGVSZXBvc2l0b3JpZXMuZmluZChyID0+IHIucHJvdmlkZXIgPT09IGVsZW1lbnQucHJvdmlkZXIpO1xuXHRcdFx0aWYgKCFyZXBvc2l0b3J5KSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBlbGVtZW50IHBhc3NlZCB0byBnZXRQYXJlbnQnKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHJlcG9zaXRvcnk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjYWxsIHRvIGdldFBhcmVudCcpO1xuXHRcdH1cblx0fVxuXG5cdGhhc0NoaWxkcmVuKGlucHV0T3JFbGVtZW50OiBJU0NNVmlld1NlcnZpY2UgfCBUcmVlRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRcdGlmIChpc1NDTVZpZXdTZXJ2aWNlKGlucHV0T3JFbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuc2NtVmlld1NlcnZpY2UudmlzaWJsZVJlcG9zaXRvcmllcy5sZW5ndGggIT09IDA7XG5cdFx0fSBlbHNlIGlmIChpc1NDTVJlcG9zaXRvcnkoaW5wdXRPckVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGVsc2UgaWYgKGlzU0NNSW5wdXQoaW5wdXRPckVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSBlbHNlIGlmIChpc1NDTUFjdGlvbkJ1dHRvbihpbnB1dE9yRWxlbWVudCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9IGVsc2UgaWYgKGlzU0NNUmVzb3VyY2VHcm91cChpbnB1dE9yRWxlbWVudCkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gZWxzZSBpZiAoaXNTQ01SZXNvdXJjZShpbnB1dE9yRWxlbWVudCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9IGVsc2UgaWYgKFJlc291cmNlVHJlZS5pc1Jlc291cmNlTm9kZShpbnB1dE9yRWxlbWVudCkpIHtcblx0XHRcdHJldHVybiBpbnB1dE9yRWxlbWVudC5jaGlsZHJlbkNvdW50ID4gMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdoYXNDaGlsZHJlbiBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTQ01BY3Rpb25CdXR0b24gaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgYnV0dG9uOiBCdXR0b24gfCBCdXR0b25XaXRoRGVzY3JpcHRpb24gfCBCdXR0b25XaXRoRHJvcGRvd24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSBuZXcgTXV0YWJsZURpc3Bvc2FibGU8RGlzcG9zYWJsZVN0b3JlPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZVxuXHQpIHtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcz8uZGlzcG9zZSgpO1xuXHR9XG5cblx0c2V0QnV0dG9uKGJ1dHRvbjogSVNDTUFjdGlvbkJ1dHRvbkRlc2NyaXB0b3IgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHQvLyBDbGVhciBvbGQgYnV0dG9uXG5cdFx0dGhpcy5jbGVhcigpO1xuXHRcdGlmICghYnV0dG9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGJ1dHRvbi5zZWNvbmRhcnlDb21tYW5kcz8ubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblx0XHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBidXR0b24uc2Vjb25kYXJ5Q29tbWFuZHMubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHRcdGNvbnN0IGNvbW1hbmRzID0gYnV0dG9uLnNlY29uZGFyeUNvbW1hbmRzW2luZGV4XTtcblx0XHRcdFx0Zm9yIChjb25zdCBjb21tYW5kIG9mIGNvbW1hbmRzKSB7XG5cdFx0XHRcdFx0YWN0aW9ucy5wdXNoKHRvQWN0aW9uKHtcblx0XHRcdFx0XHRcdGlkOiBjb21tYW5kLmlkLFxuXHRcdFx0XHRcdFx0bGFiZWw6IGNvbW1hbmQudGl0bGUsXG5cdFx0XHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRcdFx0cnVuOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuZXhlY3V0ZUNvbW1hbmQoY29tbWFuZC5pZCwgLi4uKGNvbW1hbmQuYXJndW1lbnRzIHx8IFtdKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChjb21tYW5kcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRhY3Rpb25zLnB1c2gobmV3IFNlcGFyYXRvcigpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Ly8gUmVtb3ZlIGxhc3Qgc2VwYXJhdG9yXG5cdFx0XHRhY3Rpb25zLnBvcCgpO1xuXG5cdFx0XHQvLyBCdXR0b25XaXRoRHJvcGRvd25cblx0XHRcdHRoaXMuYnV0dG9uID0gbmV3IEJ1dHRvbldpdGhEcm9wZG93bih0aGlzLmNvbnRhaW5lciwge1xuXHRcdFx0XHRhY3Rpb25zOiBhY3Rpb25zLFxuXHRcdFx0XHRhZGRQcmltYXJ5QWN0aW9uVG9Ecm9wZG93bjogZmFsc2UsXG5cdFx0XHRcdGNvbnRleHRNZW51UHJvdmlkZXI6IHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdFx0XHR0aXRsZTogYnV0dG9uLmNvbW1hbmQudG9vbHRpcCxcblx0XHRcdFx0c3VwcG9ydEljb25zOiB0cnVlLFxuXHRcdFx0XHQuLi5kZWZhdWx0QnV0dG9uU3R5bGVzXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gQnV0dG9uXG5cdFx0XHR0aGlzLmJ1dHRvbiA9IG5ldyBCdXR0b24odGhpcy5jb250YWluZXIsIHsgc3VwcG9ydEljb25zOiB0cnVlLCBzdXBwb3J0U2hvcnRMYWJlbDogISFidXR0b24uY29tbWFuZC5zaG9ydFRpdGxlLCB0aXRsZTogYnV0dG9uLmNvbW1hbmQudG9vbHRpcCwgLi4uZGVmYXVsdEJ1dHRvblN0eWxlcyB9KTtcblx0XHR9XG5cblx0XHR0aGlzLmJ1dHRvbi5lbmFibGVkID0gYnV0dG9uLmVuYWJsZWQ7XG5cdFx0dGhpcy5idXR0b24ubGFiZWwgPSBidXR0b24uY29tbWFuZC50aXRsZTtcblx0XHRpZiAodGhpcy5idXR0b24gaW5zdGFuY2VvZiBCdXR0b24gJiYgYnV0dG9uLmNvbW1hbmQuc2hvcnRUaXRsZSkge1xuXHRcdFx0dGhpcy5idXR0b24ubGFiZWxTaG9ydCA9IGJ1dHRvbi5jb21tYW5kLnNob3J0VGl0bGU7XG5cdFx0fVxuXHRcdHRoaXMuYnV0dG9uLm9uRGlkQ2xpY2soYXN5bmMgKCkgPT4gYXdhaXQgdGhpcy5leGVjdXRlQ29tbWFuZChidXR0b24uY29tbWFuZC5pZCwgLi4uKGJ1dHRvbi5jb21tYW5kLmFyZ3VtZW50cyB8fCBbXSkpLCBudWxsLCB0aGlzLmRpc3Bvc2FibGVzLnZhbHVlKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMudmFsdWUhLmFkZCh0aGlzLmJ1dHRvbik7XG5cdH1cblxuXHRmb2N1cygpOiB2b2lkIHtcblx0XHR0aGlzLmJ1dHRvbj8uZm9jdXMoKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXIoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy52YWx1ZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHR0aGlzLmJ1dHRvbiA9IHVuZGVmaW5lZDtcblx0XHRjbGVhck5vZGUodGhpcy5jb250YWluZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBleGVjdXRlQ29tbWFuZChjb21tYW5kSWQ6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChjb21tYW5kSWQsIC4uLmFyZ3MpO1xuXHRcdH0gY2F0Y2ggKGV4KSB7XG5cdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IoZXgpO1xuXHRcdH1cblx0fVxufVxuXG5zZXR1cFNpbXBsZUVkaXRvclNlbGVjdGlvblN0eWxpbmcoJy5zY20tdmlldyAuc2NtLWVkaXRvci1jb250YWluZXInKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFNBQVMsT0FBTyxlQUFlO0FBQy9CLFNBQVMsVUFBVSxlQUFlO0FBQ2xDLFNBQXNCLFlBQVksaUJBQWlCLG9CQUFvQixTQUFTLGNBQWMsbUJBQW1CLHFCQUFxQjtBQUN0SSxTQUFTLFVBQTRCLGtCQUFrQjtBQUN2RCxTQUFTLFFBQVEsR0FBRyxXQUFXLFlBQVksV0FBVyxnQkFBZ0IsdUJBQXVCO0FBQzdGLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQTBDLHFCQUFrRSxpQkFBdUQsYUFBYSxzQkFBc0IsY0FBNEQsNkJBQTREO0FBQzlULFNBQVMsc0JBQXlEO0FBQ2xFLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsNkJBQStDO0FBQ3hELFNBQVMscUJBQXFCLDJCQUE2QztBQUMzRSxTQUFTLG9CQUFpQyxnQkFBZ0IscUJBQXFCO0FBQy9FLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsZ0JBQWdCLGNBQWMs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QUFDLENBQUMsT0FBTyxRQUFRLFlBQVksT0FBTyxPQUFPLFFBQVEsU0FBUyxHQUFHLG9CQUFvQixDQUFDO0FBQUEsSUFDdks7QUFFQSxTQUFLLE9BQU8sVUFBVSxPQUFPO0FBQzdCLFNBQUssT0FBTyxRQUFRLE9BQU8sUUFBUTtBQUNuQyxRQUFJLEtBQUssa0JBQWtCLFVBQVUsT0FBTyxRQUFRLFlBQVk7QUFDL0QsV0FBSyxPQUFPLGFBQWEsT0FBTyxRQUFRO0FBQUEsSUFDekM7QUFDQSxTQUFLLE9BQU8sV0FBVyxZQUFZLE1BQU0sS0FBSyxlQUFlLE9BQU8sUUFBUSxJQUFJLEdBQUksT0FBTyxRQUFRLGFBQWEsQ0FBQyxDQUFFLEdBQUcsTUFBTSxLQUFLLFlBQVksS0FBSztBQUVsSixTQUFLLFlBQVksTUFBTyxJQUFJLEtBQUssTUFBTTtBQUFBLEVBQ3hDO0FBQUEsRUFFQSxRQUFjO0FBQ2IsU0FBSyxRQUFRLE1BQU07QUFBQSxFQUNwQjtBQUFBLEVBRVEsUUFBYztBQUNyQixTQUFLLFlBQVksUUFBUSxJQUFJLGdCQUFnQjtBQUM3QyxTQUFLLFNBQVM7QUFDZCxjQUFVLEtBQUssU0FBUztBQUFBLEVBQ3pCO0FBQUEsRUFFQSxNQUFjLGVBQWUsY0FBc0IsTUFBNEI7QUFDOUUsUUFBSTtBQUNILFlBQU0sS0FBSyxlQUFlLGVBQWUsV0FBVyxHQUFHLElBQUk7QUFBQSxJQUM1RCxTQUFTLElBQUk7QUFDWixXQUFLLG9CQUFvQixNQUFNLEVBQUU7QUFBQSxJQUNsQztBQUFBLEVBQ0Q7QUFDRDtBQUVBLGtDQUFrQyxpQ0FBaUM7IiwKICAibmFtZXMiOiBbIm1hdGNoZXMiLCAic2VsZWN0aW9ucyIsICJvbmVOYW1lIiwgIm90aGVyTmFtZSIsICJWaWV3TW9kZSIsICJWaWV3U29ydEtleSIsICJTQ01JbnB1dFdpZGdldENvbW1hbmRJZCIsICJTQ01JbnB1dFdpZGdldFN0b3JhZ2VLZXkiLCAiYWN0aW9ucyJdCn0K
