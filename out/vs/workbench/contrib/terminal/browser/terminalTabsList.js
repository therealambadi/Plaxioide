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
import { IListService, WorkbenchList } from "../../../../platform/list/browser/listService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { ITerminalConfigurationService, ITerminalGroupService, ITerminalService, TerminalDataTransfers } from "./terminal.js";
import { localize } from "../../../../nls.js";
import * as DOM from "../../../../base/browser/dom.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { MenuEntryActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { TerminalCommandId } from "../common/terminal.js";
import { TerminalLocation, TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Action } from "../../../../base/common/actions.js";
import { DEFAULT_LABELS_CONTAINER, ResourceLabels } from "../../../browser/labels.js";
import { IDecorationsService } from "../../../services/decorations/common/decorations.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import Severity from "../../../../base/common/severity.js";
import { Disposable, DisposableStore, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { ListDragOverEffectPosition, ListDragOverEffectType } from "../../../../base/browser/ui/list/list.js";
import { DataTransfers } from "../../../../base/browser/dnd.js";
import { disposableTimeout } from "../../../../base/common/async.js";
import { ElementsDragAndDropData, NativeDragAndDropData } from "../../../../base/browser/ui/list/listView.js";
import { URI } from "../../../../base/common/uri.js";
import { getColorClass, getIconId, getUriClasses } from "./terminalIcon.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { InputBox, MessageType } from "../../../../base/browser/ui/inputbox/inputBox.js";
import { createSingleCallFunction } from "../../../../base/common/functional.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { CodeDataTransfers, containsDragType, getPathForFile } from "../../../../platform/dnd/browser/dnd.js";
import { terminalStrings } from "../common/terminalStrings.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { TerminalContextKeys } from "../common/terminalContextKey.js";
import { getTerminalResourcesFromDragEvent, parseTerminalUri } from "./terminalUri.js";
import { getInstanceHoverInfo } from "./terminalTooltip.js";
import { defaultInputBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { Emitter } from "../../../../base/common/event.js";
import { Schemas } from "../../../../base/common/network.js";
import { getColorForSeverity } from "./terminalStatusList.js";
import { TerminalContextActionRunner } from "./terminalContextMenu.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { TerminalStorageKeys } from "../common/terminalStorageKeys.js";
const $ = DOM.$;
var TerminalTabsListSizes = /* @__PURE__ */ ((TerminalTabsListSizes2) => {
  TerminalTabsListSizes2[TerminalTabsListSizes2["TabHeight"] = 22] = "TabHeight";
  TerminalTabsListSizes2[TerminalTabsListSizes2["NarrowViewWidth"] = 46] = "NarrowViewWidth";
  TerminalTabsListSizes2[TerminalTabsListSizes2["WideViewMinimumWidth"] = 80] = "WideViewMinimumWidth";
  TerminalTabsListSizes2[TerminalTabsListSizes2["DefaultWidth"] = 120] = "DefaultWidth";
  TerminalTabsListSizes2[TerminalTabsListSizes2["MidpointViewWidth"] = 63] = "MidpointViewWidth";
  TerminalTabsListSizes2[TerminalTabsListSizes2["ActionbarMinimumWidth"] = 105] = "ActionbarMinimumWidth";
  TerminalTabsListSizes2[TerminalTabsListSizes2["MaximumWidth"] = 500] = "MaximumWidth";
  return TerminalTabsListSizes2;
})(TerminalTabsListSizes || {});
let TerminalTabList = class extends WorkbenchList {
  constructor(container, disposableStore, contextKeyService, listService, _configurationService, _terminalService, _terminalGroupService, instantiationService, decorationsService, _themeService, _storageService, lifecycleService, _hoverService) {
    super(
      "TerminalTabsList",
      container,
      {
        getHeight: () => 22 /* TabHeight */,
        getTemplateId: () => "terminal.tabs"
      },
      [disposableStore.add(instantiationService.createInstance(TerminalTabsRenderer, container, instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER), () => this.getSelectedElements()))],
      {
        horizontalScrolling: false,
        supportDynamicHeights: false,
        selectionNavigation: true,
        identityProvider: {
          getId: (e) => e?.instanceId
        },
        accessibilityProvider: instantiationService.createInstance(TerminalTabsAccessibilityProvider),
        smoothScrolling: _configurationService.getValue("workbench.list.smoothScrolling"),
        multipleSelectionSupport: true,
        paddingBottom: 22 /* TabHeight */,
        dnd: instantiationService.createInstance(TerminalTabsDragAndDrop),
        openOnSingleClick: true
      },
      contextKeyService,
      listService,
      _configurationService,
      instantiationService
    );
    this._configurationService = _configurationService;
    this._terminalService = _terminalService;
    this._terminalGroupService = _terminalGroupService;
    this._themeService = _themeService;
    this._storageService = _storageService;
    this._hoverService = _hoverService;
    const instanceDisposables = [
      this._terminalGroupService.onDidChangeInstances(() => this.refresh()),
      this._terminalGroupService.onDidChangeGroups(() => this.refresh()),
      this._terminalGroupService.onDidShow(() => this.refresh()),
      this._terminalGroupService.onDidChangeInstanceCapability(() => this.refresh()),
      this._terminalService.onAnyInstanceTitleChange(() => this.refresh()),
      this._terminalService.onAnyInstanceIconChange(() => this.refresh()),
      this._terminalService.onAnyInstancePrimaryStatusChange(() => this.refresh()),
      this._terminalService.onDidChangeConnectionState(() => this.refresh()),
      this._themeService.onDidColorThemeChange(() => this.refresh()),
      this._terminalGroupService.onDidChangeActiveInstance((e) => {
        if (e) {
          const i = this._terminalGroupService.instances.indexOf(e);
          this.setSelection([i]);
          this.reveal(i);
        }
        this.refresh();
      }),
      this._storageService.onDidChangeValue(StorageScope.APPLICATION, TerminalStorageKeys.TabsShowDetailed, this.disposables)(() => this.refresh())
    ];
    this.disposables.add(lifecycleService.onWillShutdown((e) => {
      dispose(instanceDisposables);
      instanceDisposables.length = 0;
    }));
    this.disposables.add(toDisposable(() => {
      dispose(instanceDisposables);
      instanceDisposables.length = 0;
    }));
    this.disposables.add(this.onMouseDblClick(async (e) => {
      const focus = this.getFocus();
      if (focus.length === 0) {
        const instance = await this._terminalService.createTerminal({ location: TerminalLocation.Panel });
        this._terminalGroupService.setActiveInstance(instance);
        await instance.focusWhenReady();
      }
      if (this._terminalService.getEditingTerminal()?.instanceId === e.element?.instanceId) {
        return;
      }
      if (this._getFocusMode() === "doubleClick" && this.getFocus().length === 1) {
        e.element?.focus(true);
      }
    }));
    this.disposables.add(this.onMouseClick(async (e) => {
      if (this._terminalService.getEditingTerminal()?.instanceId === e.element?.instanceId) {
        return;
      }
      if (e.browserEvent.altKey && e.element) {
        await this._terminalService.createTerminal({ location: { parentTerminal: e.element } });
      } else if (this._getFocusMode() === "singleClick") {
        if (this.getSelection().length <= 1) {
          e.element?.focus(true);
        }
      }
    }));
    this.disposables.add(this.onContextMenu((e) => {
      if (!e.element) {
        this.setSelection([]);
        return;
      }
      const selection = this.getSelectedElements();
      if (!selection || !selection.find((s) => e.element === s)) {
        this.setFocus(e.index !== void 0 ? [e.index] : []);
      }
    }));
    this._terminalTabsSingleSelectedContextKey = TerminalContextKeys.tabsSingularSelection.bindTo(contextKeyService);
    this._isSplitContextKey = TerminalContextKeys.splitTerminal.bindTo(contextKeyService);
    this.disposables.add(this.onDidChangeSelection((e) => this._updateContextKey()));
    this.disposables.add(this.onDidChangeFocus(() => this._updateContextKey()));
    this.disposables.add(this.onDidOpen(async (e) => {
      const instance = e.element;
      if (!instance) {
        return;
      }
      this._terminalGroupService.setActiveInstance(instance);
      if (!e.editorOptions.preserveFocus) {
        await instance.focusWhenReady();
      }
    }));
    if (!this._decorationsProvider) {
      this._decorationsProvider = this.disposables.add(instantiationService.createInstance(TabDecorationsProvider));
      this.disposables.add(decorationsService.registerDecorationsProvider(this._decorationsProvider));
    }
    this.refresh();
  }
  _getFocusMode() {
    return this._configurationService.getValue(TerminalSettingId.TabsFocusMode);
  }
  refresh(cancelEditing = true) {
    if (cancelEditing && this._terminalService.isEditable(void 0)) {
      this.domFocus();
    }
    this.splice(0, this.length, this._terminalGroupService.instances.slice());
  }
  focusHover() {
    const instance = this.getSelectedElements()[0];
    if (!instance) {
      return;
    }
    this._hoverService.showInstantHover({
      ...getInstanceHoverInfo(instance, this._storageService),
      target: this.getHTMLElement(),
      trapFocus: true
    }, true);
  }
  _updateContextKey() {
    this._terminalTabsSingleSelectedContextKey.set(this.getSelectedElements().length === 1);
    const instance = this.getFocusedElements();
    this._isSplitContextKey.set(instance.length > 0 && this._terminalGroupService.instanceIsSplit(instance[0]));
  }
};
TerminalTabList = __decorateClass([
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IListService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, ITerminalService),
  __decorateParam(6, ITerminalGroupService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IDecorationsService),
  __decorateParam(9, IThemeService),
  __decorateParam(10, IStorageService),
  __decorateParam(11, ILifecycleService),
  __decorateParam(12, IHoverService)
], TerminalTabList);
let TerminalTabsRenderer = class extends Disposable {
  constructor(_container, _labels, _getSelection, _instantiationService, _terminalConfigurationService, _terminalService, _terminalGroupService, _hoverService, _keybindingService, _listService, _storageService, _themeService, _contextViewService, _commandService) {
    super();
    this._container = _container;
    this._labels = _labels;
    this._getSelection = _getSelection;
    this._instantiationService = _instantiationService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._terminalService = _terminalService;
    this._terminalGroupService = _terminalGroupService;
    this._hoverService = _hoverService;
    this._keybindingService = _keybindingService;
    this._listService = _listService;
    this._storageService = _storageService;
    this._themeService = _themeService;
    this._contextViewService = _contextViewService;
    this._commandService = _commandService;
    this.templateId = "terminal.tabs";
  }
  renderTemplate(container) {
    const element = DOM.append(container, $(".terminal-tabs-entry"));
    const context = {};
    const label = this._labels.create(element, {
      supportHighlights: true,
      supportDescriptionHighlights: true,
      supportIcons: true,
      hoverDelegate: {
        delay: 0,
        showHover: (options) => {
          return this._hoverService.showDelayedHover({
            ...options,
            actions: context.hoverActions,
            target: element,
            appearance: {
              showPointer: true
            },
            position: {
              hoverPosition: this._terminalConfigurationService.config.tabs.location === "left" ? HoverPosition.RIGHT : HoverPosition.LEFT
            }
          }, { groupId: "terminal-tabs-list" });
        }
      }
    });
    const actionsContainer = DOM.append(label.element, $(".actions"));
    const actionBar = this._register(new ActionBar(actionsContainer, {
      actionRunner: this._register(new TerminalContextActionRunner()),
      actionViewItemProvider: (action, options) => action instanceof MenuItemAction ? this._register(this._instantiationService.createInstance(MenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate })) : void 0
    }));
    return {
      element,
      label,
      actionBar,
      context,
      elementDisposables: new DisposableStore()
    };
  }
  shouldHideText() {
    return this._container ? this._container.clientWidth < 63 /* MidpointViewWidth */ : false;
  }
  shouldHideActionBar() {
    return this._container ? this._container.clientWidth <= 105 /* ActionbarMinimumWidth */ : false;
  }
  renderElement(instance, index, template) {
    const hasText = !this.shouldHideText();
    const group = this._terminalGroupService.getGroupForInstance(instance);
    if (!group) {
      throw new Error(`Could not find group for instance "${instance.instanceId}"`);
    }
    template.element.classList.toggle("has-text", hasText);
    template.element.classList.toggle("is-active", this._terminalGroupService.activeInstance === instance);
    let prefix = "";
    if (group.terminalInstances.length > 1) {
      const terminalIndex = group.terminalInstances.indexOf(instance);
      if (terminalIndex === 0) {
        prefix = `\u250C `;
      } else if (terminalIndex === group.terminalInstances.length - 1) {
        prefix = `\u2514 `;
      } else {
        prefix = `\u251C `;
      }
    }
    const hoverInfo = getInstanceHoverInfo(instance, this._storageService);
    template.context.hoverActions = hoverInfo.actions;
    const iconId = this._instantiationService.invokeFunction(getIconId, instance);
    const hasActionbar = !this.shouldHideActionBar();
    let label = "";
    if (!hasText) {
      const primaryStatus = instance.statusList.primary;
      if (primaryStatus && primaryStatus.severity > Severity.Ignore) {
        label = `${prefix}$(${primaryStatus.icon?.id || iconId})`;
      } else {
        label = `${prefix}$(${iconId})`;
      }
    } else {
      this.fillActionBar(instance, template);
      label = prefix;
      if (instance.icon) {
        label += `$(${iconId}) ${instance.title}`;
      }
    }
    if (!hasActionbar) {
      template.actionBar.clear();
    }
    template.elementDisposables.add(DOM.addDisposableListener(template.element, DOM.EventType.AUXCLICK, (e) => {
      e.stopImmediatePropagation();
      if (e.button === 1) {
        this._terminalService.safeDisposeTerminal(instance);
      }
    }));
    const extraClasses = [];
    const colorClass = getColorClass(instance);
    if (colorClass) {
      extraClasses.push(colorClass);
    }
    const uriClasses = getUriClasses(instance, this._themeService.getColorTheme().type);
    if (uriClasses) {
      extraClasses.push(...uriClasses);
    }
    template.label.setResource({
      resource: instance.resource,
      name: label,
      description: hasText ? instance.description : void 0
    }, {
      fileDecorations: {
        colors: true,
        badges: hasText
      },
      title: {
        markdown: hoverInfo.content,
        markdownNotSupportedFallback: void 0
      },
      extraClasses
    });
    const editableData = this._terminalService.getEditableData(instance);
    template.label.element.classList.toggle("editable-tab", !!editableData);
    if (editableData) {
      template.elementDisposables.add(this._renderInputBox(template.label.element.querySelector(".monaco-icon-label-container"), instance, editableData));
      template.actionBar.clear();
    }
  }
  _renderInputBox(container, instance, editableData) {
    const value = instance.title || "";
    const inputBox = new InputBox(container, this._contextViewService, {
      validationOptions: {
        validation: (value2) => {
          const message = editableData.validationMessage(value2);
          if (!message || message.severity !== Severity.Error) {
            return null;
          }
          return {
            content: message.content,
            formatContent: true,
            type: MessageType.ERROR
          };
        }
      },
      ariaLabel: localize("terminalInputAriaLabel", "Type terminal name. Press Enter to confirm or Escape to cancel."),
      inputBoxStyles: defaultInputBoxStyles
    });
    inputBox.element.style.height = "22px";
    inputBox.value = value;
    inputBox.focus();
    inputBox.select({ start: 0, end: value.length });
    const done = createSingleCallFunction((success, finishEditing) => {
      inputBox.element.style.display = "none";
      const value2 = inputBox.value;
      dispose(toDispose);
      inputBox.element.remove();
      if (finishEditing) {
        editableData.onFinish(value2, success);
      }
    });
    const showInputBoxNotification = () => {
      if (inputBox.isInputValid()) {
        const message = editableData.validationMessage(inputBox.value);
        if (message) {
          inputBox.showMessage({
            content: message.content,
            formatContent: true,
            type: message.severity === Severity.Info ? MessageType.INFO : message.severity === Severity.Warning ? MessageType.WARNING : MessageType.ERROR
          });
        } else {
          inputBox.hideMessage();
        }
      }
    };
    showInputBoxNotification();
    const toDispose = [
      inputBox,
      DOM.addStandardDisposableListener(inputBox.inputElement, DOM.EventType.KEY_DOWN, (e) => {
        e.stopPropagation();
        if (e.equals(KeyCode.Enter)) {
          done(inputBox.isInputValid(), true);
        } else if (e.equals(KeyCode.Escape)) {
          done(false, true);
        }
      }),
      DOM.addStandardDisposableListener(inputBox.inputElement, DOM.EventType.KEY_UP, (e) => {
        showInputBoxNotification();
      }),
      DOM.addDisposableListener(inputBox.inputElement, DOM.EventType.BLUR, () => {
        done(inputBox.isInputValid(), true);
      })
    ];
    return toDisposable(() => {
      done(false, false);
    });
  }
  disposeElement(instance, index, templateData) {
    templateData.elementDisposables.clear();
    templateData.actionBar.clear();
  }
  disposeTemplate(templateData) {
    templateData.elementDisposables.dispose();
    templateData.label.dispose();
    templateData.actionBar.dispose();
  }
  fillActionBar(instance, template) {
    const actions = [
      this._register(new Action(TerminalCommandId.SplitActiveTab, terminalStrings.split.short, ThemeIcon.asClassName(Codicon.splitHorizontal), true, async () => {
        this._runForSelectionOrInstance(instance, async (e) => {
          this._terminalService.createTerminal({ location: { parentTerminal: e } });
        });
      }))
    ];
    if (instance.shellLaunchConfig.tabActions) {
      for (const action of instance.shellLaunchConfig.tabActions) {
        actions.push(this._register(new Action(action.id, action.label, action.icon ? ThemeIcon.asClassName(action.icon) : void 0, true, async () => {
          this._runForSelectionOrInstance(instance, (e) => this._commandService.executeCommand(action.id, instance));
        })));
      }
    }
    actions.push(this._register(new Action(TerminalCommandId.KillActiveTab, terminalStrings.kill.short, ThemeIcon.asClassName(Codicon.trashcan), true, async () => {
      this._runForSelectionOrInstance(instance, (e) => this._terminalService.safeDisposeTerminal(e));
    })));
    template.actionBar.clear();
    for (const action of actions) {
      template.actionBar.push(action, { icon: true, label: false, keybinding: this._keybindingService.lookupKeybinding(action.id)?.getLabel() });
    }
  }
  _runForSelectionOrInstance(instance, callback) {
    const selection = this._getSelection();
    if (selection.includes(instance)) {
      for (const s of selection) {
        if (s) {
          callback(s);
        }
      }
    } else {
      callback(instance);
    }
    this._terminalGroupService.focusTabs();
    this._listService.lastFocusedList?.focusNext();
  }
};
TerminalTabsRenderer = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ITerminalConfigurationService),
  __decorateParam(5, ITerminalService),
  __decorateParam(6, ITerminalGroupService),
  __decorateParam(7, IHoverService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, IListService),
  __decorateParam(10, IStorageService),
  __decorateParam(11, IThemeService),
  __decorateParam(12, IContextViewService),
  __decorateParam(13, ICommandService)
], TerminalTabsRenderer);
let TerminalTabsAccessibilityProvider = class {
  constructor(_terminalGroupService) {
    this._terminalGroupService = _terminalGroupService;
  }
  getWidgetAriaLabel() {
    return localize("terminal.tabs", "Terminal tabs");
  }
  getAriaLabel(instance) {
    let ariaLabel = "";
    const tab = this._terminalGroupService.getGroupForInstance(instance);
    if (tab && tab.terminalInstances?.length > 1) {
      const terminalIndex = tab.terminalInstances.indexOf(instance);
      ariaLabel = localize({
        key: "splitTerminalAriaLabel",
        comment: [
          `The terminal's ID`,
          `The terminal's title`,
          `The terminal's split number`,
          `The terminal group's total split number`
        ]
      }, "Terminal {0} {1}, split {2} of {3}", instance.instanceId, instance.title, terminalIndex + 1, tab.terminalInstances.length);
    } else {
      ariaLabel = localize({
        key: "terminalAriaLabel",
        comment: [
          `The terminal's ID`,
          `The terminal's title`
        ]
      }, "Terminal {0} {1}", instance.instanceId, instance.title);
    }
    return ariaLabel;
  }
};
TerminalTabsAccessibilityProvider = __decorateClass([
  __decorateParam(0, ITerminalGroupService)
], TerminalTabsAccessibilityProvider);
let TerminalTabsDragAndDrop = class extends Disposable {
  constructor(_terminalService, _terminalGroupService, _listService) {
    super();
    this._terminalService = _terminalService;
    this._terminalGroupService = _terminalGroupService;
    this._listService = _listService;
    this._autoFocusDisposable = Disposable.None;
    this._primaryBackend = this._terminalService.getPrimaryBackend();
  }
  getDragURI(instance) {
    if (this._terminalService.getEditingTerminal()?.instanceId === instance.instanceId) {
      return null;
    }
    return instance.resource.toString();
  }
  getDragLabel(elements, originalEvent) {
    return elements.length === 1 ? elements[0].title : void 0;
  }
  onDragLeave() {
    this._autoFocusInstance = void 0;
    this._autoFocusDisposable.dispose();
    this._autoFocusDisposable = Disposable.None;
  }
  onDragStart(data, originalEvent) {
    if (!originalEvent.dataTransfer) {
      return;
    }
    const dndData = data.getData();
    if (!Array.isArray(dndData)) {
      return;
    }
    const terminals = dndData.filter((e) => "instanceId" in e);
    if (terminals.length > 0) {
      originalEvent.dataTransfer.setData(TerminalDataTransfers.Terminals, JSON.stringify(terminals.map((e) => e.resource.toString())));
    }
  }
  onDragOver(data, targetInstance, targetIndex, targetSector, originalEvent) {
    if (data instanceof NativeDragAndDropData) {
      if (!containsDragType(originalEvent, DataTransfers.FILES, DataTransfers.RESOURCES, TerminalDataTransfers.Terminals, CodeDataTransfers.FILES)) {
        return false;
      }
    }
    const didChangeAutoFocusInstance = this._autoFocusInstance !== targetInstance;
    if (didChangeAutoFocusInstance) {
      this._autoFocusDisposable.dispose();
      this._autoFocusInstance = targetInstance;
    }
    if (!targetInstance && !containsDragType(originalEvent, TerminalDataTransfers.Terminals)) {
      return data instanceof ElementsDragAndDropData;
    }
    if (didChangeAutoFocusInstance && targetInstance) {
      this._autoFocusDisposable = disposableTimeout(() => {
        this._terminalService.setActiveInstance(targetInstance);
        this._autoFocusInstance = void 0;
      }, 500, this._store);
    }
    return {
      feedback: targetIndex ? [targetIndex] : void 0,
      accept: true,
      effect: { type: ListDragOverEffectType.Move, position: ListDragOverEffectPosition.Over }
    };
  }
  async drop(data, targetInstance, targetIndex, targetSector, originalEvent) {
    this._autoFocusDisposable.dispose();
    this._autoFocusInstance = void 0;
    let sourceInstances;
    const promises = [];
    const resources = getTerminalResourcesFromDragEvent(originalEvent);
    if (resources) {
      for (const uri of resources) {
        const instance = this._terminalService.getInstanceFromResource(uri);
        if (instance) {
          if (Array.isArray(sourceInstances)) {
            sourceInstances.push(instance);
          } else {
            sourceInstances = [instance];
          }
          this._terminalService.moveToTerminalView(instance);
        } else if (this._primaryBackend) {
          const terminalIdentifier = parseTerminalUri(uri);
          if (terminalIdentifier.instanceId) {
            promises.push(this._primaryBackend.requestDetachInstance(terminalIdentifier.workspaceId, terminalIdentifier.instanceId));
          }
        }
      }
    }
    if (promises.length) {
      let processes = await Promise.all(promises);
      processes = processes.filter((p) => p !== void 0);
      let lastInstance;
      for (const attachPersistentProcess of processes) {
        lastInstance = await this._terminalService.createTerminal({ config: { attachPersistentProcess } });
      }
      if (lastInstance) {
        this._terminalService.setActiveInstance(lastInstance);
      }
      return;
    }
    if (sourceInstances === void 0) {
      if (!(data instanceof ElementsDragAndDropData)) {
        this._handleExternalDrop(targetInstance, originalEvent);
        return;
      }
      const draggedElement = data.getData();
      if (!draggedElement || !Array.isArray(draggedElement)) {
        return;
      }
      sourceInstances = [];
      for (const e of draggedElement) {
        if ("instanceId" in e) {
          sourceInstances.push(e);
        }
      }
    }
    if (!targetInstance) {
      this._terminalGroupService.moveGroupToEnd(sourceInstances);
      this._terminalService.setActiveInstance(sourceInstances[0]);
      const targetGroup2 = this._terminalGroupService.getGroupForInstance(sourceInstances[0]);
      if (targetGroup2) {
        const index = this._terminalGroupService.groups.indexOf(targetGroup2);
        this._listService.lastFocusedList?.setSelection([index]);
      }
      return;
    }
    this._terminalGroupService.moveGroup(sourceInstances, targetInstance);
    this._terminalService.setActiveInstance(sourceInstances[0]);
    const targetGroup = this._terminalGroupService.getGroupForInstance(sourceInstances[0]);
    if (targetGroup) {
      const index = this._terminalGroupService.groups.indexOf(targetGroup);
      this._listService.lastFocusedList?.setSelection([index]);
    }
  }
  async _handleExternalDrop(instance, e) {
    if (!instance || !e.dataTransfer) {
      return;
    }
    let resource;
    const rawResources = e.dataTransfer.getData(DataTransfers.RESOURCES);
    if (rawResources) {
      resource = URI.parse(JSON.parse(rawResources)[0]);
    }
    const rawCodeFiles = e.dataTransfer.getData(CodeDataTransfers.FILES);
    if (!resource && rawCodeFiles) {
      resource = URI.file(JSON.parse(rawCodeFiles)[0]);
    }
    if (!resource && e.dataTransfer.files.length > 0 && getPathForFile(e.dataTransfer.files[0])) {
      resource = URI.file(getPathForFile(e.dataTransfer.files[0]));
    }
    if (!resource) {
      return;
    }
    this._terminalService.setActiveInstance(instance);
    instance.focus();
    await instance.sendPath(resource, false);
  }
};
TerminalTabsDragAndDrop = __decorateClass([
  __decorateParam(0, ITerminalService),
  __decorateParam(1, ITerminalGroupService),
  __decorateParam(2, IListService)
], TerminalTabsDragAndDrop);
let TabDecorationsProvider = class extends Disposable {
  constructor(_terminalService) {
    super();
    this._terminalService = _terminalService;
    this.label = localize("label", "Terminal");
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._register(this._terminalService.onAnyInstancePrimaryStatusChange((e) => this._onDidChange.fire([e.resource])));
  }
  provideDecorations(resource) {
    if (resource.scheme !== Schemas.vscodeTerminal) {
      return void 0;
    }
    const instance = this._terminalService.getInstanceFromResource(resource);
    if (!instance) {
      return void 0;
    }
    const primaryStatus = instance?.statusList?.primary;
    if (!primaryStatus?.icon) {
      return void 0;
    }
    return {
      color: getColorForSeverity(primaryStatus.severity),
      letter: primaryStatus.icon,
      tooltip: primaryStatus.tooltip
    };
  }
};
TabDecorationsProvider = __decorateClass([
  __decorateParam(0, ITerminalService)
], TabDecorationsProvider);
export {
  TerminalTabList,
  TerminalTabsListSizes
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsVGFic0xpc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJTGlzdFNlcnZpY2UsIFdvcmtiZW5jaExpc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0V2lkZ2V0LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UsIElUZXJtaW5hbEdyb3VwU2VydmljZSwgSVRlcm1pbmFsSW5zdGFuY2UsIElUZXJtaW5hbFNlcnZpY2UsIFRlcm1pbmFsRGF0YVRyYW5zZmVycyB9IGZyb20gJy4vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0ICogYXMgRE9NIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBNZW51SXRlbUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgTWVudUVudHJ5QWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb21tYW5kSWQgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsQmFja2VuZCwgVGVybWluYWxMb2NhdGlvbiwgVGVybWluYWxTZXR0aW5nSWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgREVGQVVMVF9MQUJFTFNfQ09OVEFJTkVSLCBJUmVzb3VyY2VMYWJlbCwgUmVzb3VyY2VMYWJlbHMgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2xhYmVscy5qcyc7XG5pbXBvcnQgeyBJRGVjb3JhdGlvbkRhdGEsIElEZWNvcmF0aW9uc1Byb3ZpZGVyLCBJRGVjb3JhdGlvbnNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZGVjb3JhdGlvbnMvY29tbW9uL2RlY29yYXRpb25zLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUxpc3REcmFnQW5kRHJvcCwgSUxpc3REcmFnT3ZlclJlYWN0aW9uLCBJTGlzdFJlbmRlcmVyLCBMaXN0RHJhZ092ZXJFZmZlY3RQb3NpdGlvbiwgTGlzdERyYWdPdmVyRWZmZWN0VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3QuanMnO1xuaW1wb3J0IHsgRGF0YVRyYW5zZmVycywgSURyYWdBbmREcm9wRGF0YSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgZGlzcG9zYWJsZVRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBFbGVtZW50c0RyYWdBbmREcm9wRGF0YSwgTGlzdFZpZXdUYXJnZXRTZWN0b3IsIE5hdGl2ZURyYWdBbmREcm9wRGF0YSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RWaWV3LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBnZXRDb2xvckNsYXNzLCBnZXRJY29uSWQsIGdldFVyaUNsYXNzZXMgfSBmcm9tICcuL3Rlcm1pbmFsSWNvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdGFibGVEYXRhIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElDb250ZXh0Vmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElucHV0Qm94LCBNZXNzYWdlVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pbnB1dGJveC9pbnB1dEJveC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTaW5nbGVDYWxsRnVuY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9mdW5jdGlvbmFsLmpzJztcbmltcG9ydCB7IElLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IENvZGVEYXRhVHJhbnNmZXJzLCBjb250YWluc0RyYWdUeXBlLCBnZXRQYXRoRm9yRmlsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RuZC9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgeyB0ZXJtaW5hbFN0cmluZ3MgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWxTdHJpbmdzLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVByb2Nlc3NEZXRhaWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsUHJvY2Vzcy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENvbnRleHRLZXlzIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsQ29udGV4dEtleS5qcyc7XG5pbXBvcnQgeyBnZXRUZXJtaW5hbFJlc291cmNlc0Zyb21EcmFnRXZlbnQsIHBhcnNlVGVybWluYWxVcmkgfSBmcm9tICcuL3Rlcm1pbmFsVXJpLmpzJztcbmltcG9ydCB7IGdldEluc3RhbmNlSG92ZXJJbmZvIH0gZnJvbSAnLi90ZXJtaW5hbFRvb2x0aXAuanMnO1xuaW1wb3J0IHsgZGVmYXVsdElucHV0Qm94U3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBnZXRDb2xvckZvclNldmVyaXR5IH0gZnJvbSAnLi90ZXJtaW5hbFN0YXR1c0xpc3QuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb250ZXh0QWN0aW9uUnVubmVyIH0gZnJvbSAnLi90ZXJtaW5hbENvbnRleHRNZW51LmpzJztcbmltcG9ydCB0eXBlIHsgSUhvdmVyQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyLmpzJztcbmltcG9ydCB7IEhvdmVyUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJXaWRnZXQuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbFN0b3JhZ2VLZXlzIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsU3RvcmFnZUtleXMuanMnO1xuXG5jb25zdCAkID0gRE9NLiQ7XG5cbmV4cG9ydCBjb25zdCBlbnVtIFRlcm1pbmFsVGFic0xpc3RTaXplcyB7XG5cdFRhYkhlaWdodCA9IDIyLFxuXHROYXJyb3dWaWV3V2lkdGggPSA0Nixcblx0V2lkZVZpZXdNaW5pbXVtV2lkdGggPSA4MCxcblx0RGVmYXVsdFdpZHRoID0gMTIwLFxuXHRNaWRwb2ludFZpZXdXaWR0aCA9IChUZXJtaW5hbFRhYnNMaXN0U2l6ZXMuTmFycm93Vmlld1dpZHRoICsgVGVybWluYWxUYWJzTGlzdFNpemVzLldpZGVWaWV3TWluaW11bVdpZHRoKSAvIDIsXG5cdEFjdGlvbmJhck1pbmltdW1XaWR0aCA9IDEwNSxcblx0TWF4aW11bVdpZHRoID0gNTAwXG59XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbFRhYkxpc3QgZXh0ZW5kcyBXb3JrYmVuY2hMaXN0PElUZXJtaW5hbEluc3RhbmNlPiB7XG5cdHByaXZhdGUgX2RlY29yYXRpb25zUHJvdmlkZXI6IFRhYkRlY29yYXRpb25zUHJvdmlkZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3Rlcm1pbmFsVGFic1NpbmdsZVNlbGVjdGVkQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgX2lzU3BsaXRDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdGRpc3Bvc2FibGVTdG9yZTogRGlzcG9zYWJsZVN0b3JlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUxpc3RTZXJ2aWNlIGxpc3RTZXJ2aWNlOiBJTGlzdFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsU2VydmljZTogSVRlcm1pbmFsU2VydmljZSxcblx0XHRASVRlcm1pbmFsR3JvdXBTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlOiBJVGVybWluYWxHcm91cFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJRGVjb3JhdGlvbnNTZXJ2aWNlIGRlY29yYXRpb25zU2VydmljZTogSURlY29yYXRpb25zU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBsaWZlY3ljbGVTZXJ2aWNlOiBJTGlmZWN5Y2xlU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9ob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCdUZXJtaW5hbFRhYnNMaXN0JywgY29udGFpbmVyLFxuXHRcdFx0e1xuXHRcdFx0XHRnZXRIZWlnaHQ6ICgpID0+IFRlcm1pbmFsVGFic0xpc3RTaXplcy5UYWJIZWlnaHQsXG5cdFx0XHRcdGdldFRlbXBsYXRlSWQ6ICgpID0+ICd0ZXJtaW5hbC50YWJzJ1xuXHRcdFx0fSxcblx0XHRcdFtkaXNwb3NhYmxlU3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsVGFic1JlbmRlcmVyLCBjb250YWluZXIsIGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlc291cmNlTGFiZWxzLCBERUZBVUxUX0xBQkVMU19DT05UQUlORVIpLCAoKSA9PiB0aGlzLmdldFNlbGVjdGVkRWxlbWVudHMoKSkpXSxcblx0XHRcdHtcblx0XHRcdFx0aG9yaXpvbnRhbFNjcm9sbGluZzogZmFsc2UsXG5cdFx0XHRcdHN1cHBvcnREeW5hbWljSGVpZ2h0czogZmFsc2UsXG5cdFx0XHRcdHNlbGVjdGlvbk5hdmlnYXRpb246IHRydWUsXG5cdFx0XHRcdGlkZW50aXR5UHJvdmlkZXI6IHtcblx0XHRcdFx0XHRnZXRJZDogZSA9PiBlPy5pbnN0YW5jZUlkXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxUYWJzQWNjZXNzaWJpbGl0eVByb3ZpZGVyKSxcblx0XHRcdFx0c21vb3RoU2Nyb2xsaW5nOiBfY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ3dvcmtiZW5jaC5saXN0LnNtb290aFNjcm9sbGluZycpLFxuXHRcdFx0XHRtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ6IHRydWUsXG5cdFx0XHRcdHBhZGRpbmdCb3R0b206IFRlcm1pbmFsVGFic0xpc3RTaXplcy5UYWJIZWlnaHQsXG5cdFx0XHRcdGRuZDogaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxUYWJzRHJhZ0FuZERyb3ApLFxuXHRcdFx0XHRvcGVuT25TaW5nbGVDbGljazogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdGNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0bGlzdFNlcnZpY2UsXG5cdFx0XHRfY29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHQpO1xuXG5cdFx0Y29uc3QgaW5zdGFuY2VEaXNwb3NhYmxlczogSURpc3Bvc2FibGVbXSA9IFtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLm9uRGlkQ2hhbmdlSW5zdGFuY2VzKCgpID0+IHRoaXMucmVmcmVzaCgpKSxcblx0XHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLm9uRGlkQ2hhbmdlR3JvdXBzKCgpID0+IHRoaXMucmVmcmVzaCgpKSxcblx0XHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLm9uRGlkU2hvdygoKSA9PiB0aGlzLnJlZnJlc2goKSksXG5cdFx0XHR0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5vbkRpZENoYW5nZUluc3RhbmNlQ2FwYWJpbGl0eSgoKSA9PiB0aGlzLnJlZnJlc2goKSksXG5cdFx0XHR0aGlzLl90ZXJtaW5hbFNlcnZpY2Uub25BbnlJbnN0YW5jZVRpdGxlQ2hhbmdlKCgpID0+IHRoaXMucmVmcmVzaCgpKSxcblx0XHRcdHRoaXMuX3Rlcm1pbmFsU2VydmljZS5vbkFueUluc3RhbmNlSWNvbkNoYW5nZSgoKSA9PiB0aGlzLnJlZnJlc2goKSksXG5cdFx0XHR0aGlzLl90ZXJtaW5hbFNlcnZpY2Uub25BbnlJbnN0YW5jZVByaW1hcnlTdGF0dXNDaGFuZ2UoKCkgPT4gdGhpcy5yZWZyZXNoKCkpLFxuXHRcdFx0dGhpcy5fdGVybWluYWxTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29ubmVjdGlvblN0YXRlKCgpID0+IHRoaXMucmVmcmVzaCgpKSxcblx0XHRcdHRoaXMuX3RoZW1lU2VydmljZS5vbkRpZENvbG9yVGhlbWVDaGFuZ2UoKCkgPT4gdGhpcy5yZWZyZXNoKCkpLFxuXHRcdFx0dGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2Uub25EaWRDaGFuZ2VBY3RpdmVJbnN0YW5jZShlID0+IHtcblx0XHRcdFx0aWYgKGUpIHtcblx0XHRcdFx0XHRjb25zdCBpID0gdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuaW5zdGFuY2VzLmluZGV4T2YoZSk7XG5cdFx0XHRcdFx0dGhpcy5zZXRTZWxlY3Rpb24oW2ldKTtcblx0XHRcdFx0XHR0aGlzLnJldmVhbChpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnJlZnJlc2goKTtcblx0XHRcdH0pLFxuXHRcdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2Uub25EaWRDaGFuZ2VWYWx1ZShTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFRlcm1pbmFsU3RvcmFnZUtleXMuVGFic1Nob3dEZXRhaWxlZCwgdGhpcy5kaXNwb3NhYmxlcykoKCkgPT4gdGhpcy5yZWZyZXNoKCkpLFxuXHRcdF07XG5cblx0XHQvLyBEaXNwb3NlIG9mIGluc3RhbmNlIGxpc3RlbmVycyBvbiBzaHV0ZG93biB0byBhdm9pZCBleHRyYSB3b3JrIGFuZCBzbyB0YWJzIGRvbid0IGRpc2FwcGVhclxuXHRcdC8vIGJyaWVmbHlcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZChsaWZlY3ljbGVTZXJ2aWNlLm9uV2lsbFNodXRkb3duKGUgPT4ge1xuXHRcdFx0ZGlzcG9zZShpbnN0YW5jZURpc3Bvc2FibGVzKTtcblx0XHRcdGluc3RhbmNlRGlzcG9zYWJsZXMubGVuZ3RoID0gMDtcblx0XHR9KSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGRpc3Bvc2UoaW5zdGFuY2VEaXNwb3NhYmxlcyk7XG5cdFx0XHRpbnN0YW5jZURpc3Bvc2FibGVzLmxlbmd0aCA9IDA7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5vbk1vdXNlRGJsQ2xpY2soYXN5bmMgZSA9PiB7XG5cdFx0XHRjb25zdCBmb2N1cyA9IHRoaXMuZ2V0Rm9jdXMoKTtcblx0XHRcdGlmIChmb2N1cy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0Y29uc3QgaW5zdGFuY2UgPSBhd2FpdCB0aGlzLl90ZXJtaW5hbFNlcnZpY2UuY3JlYXRlVGVybWluYWwoeyBsb2NhdGlvbjogVGVybWluYWxMb2NhdGlvbi5QYW5lbCB9KTtcblx0XHRcdFx0dGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2Uuc2V0QWN0aXZlSW5zdGFuY2UoaW5zdGFuY2UpO1xuXHRcdFx0XHRhd2FpdCBpbnN0YW5jZS5mb2N1c1doZW5SZWFkeSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5fdGVybWluYWxTZXJ2aWNlLmdldEVkaXRpbmdUZXJtaW5hbCgpPy5pbnN0YW5jZUlkID09PSBlLmVsZW1lbnQ/Lmluc3RhbmNlSWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5fZ2V0Rm9jdXNNb2RlKCkgPT09ICdkb3VibGVDbGljaycgJiYgdGhpcy5nZXRGb2N1cygpLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRlLmVsZW1lbnQ/LmZvY3VzKHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIG9uIGxlZnQgY2xpY2ssIGlmIGZvY3VzIG1vZGUgPSBzaW5nbGUgY2xpY2ssIGZvY3VzIHRoZSBlbGVtZW50XG5cdFx0Ly8gdW5sZXNzIG11bHRpLXNlbGVjdGlvbiBpcyBpbiBwcm9ncmVzc1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMub25Nb3VzZUNsaWNrKGFzeW5jIGUgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX3Rlcm1pbmFsU2VydmljZS5nZXRFZGl0aW5nVGVybWluYWwoKT8uaW5zdGFuY2VJZCA9PT0gZS5lbGVtZW50Py5pbnN0YW5jZUlkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGUuYnJvd3NlckV2ZW50LmFsdEtleSAmJiBlLmVsZW1lbnQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fdGVybWluYWxTZXJ2aWNlLmNyZWF0ZVRlcm1pbmFsKHsgbG9jYXRpb246IHsgcGFyZW50VGVybWluYWw6IGUuZWxlbWVudCB9IH0pO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLl9nZXRGb2N1c01vZGUoKSA9PT0gJ3NpbmdsZUNsaWNrJykge1xuXHRcdFx0XHRpZiAodGhpcy5nZXRTZWxlY3Rpb24oKS5sZW5ndGggPD0gMSkge1xuXHRcdFx0XHRcdGUuZWxlbWVudD8uZm9jdXModHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBvbiByaWdodCBjbGljaywgc2V0IHRoZSBmb2N1cyB0byB0aGF0IGVsZW1lbnRcblx0XHQvLyB1bmxlc3MgbXVsdGktc2VsZWN0aW9uIGlzIGluIHByb2dyZXNzXG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5vbkNvbnRleHRNZW51KGUgPT4ge1xuXHRcdFx0aWYgKCFlLmVsZW1lbnQpIHtcblx0XHRcdFx0dGhpcy5zZXRTZWxlY3Rpb24oW10pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLmdldFNlbGVjdGVkRWxlbWVudHMoKTtcblx0XHRcdGlmICghc2VsZWN0aW9uIHx8ICFzZWxlY3Rpb24uZmluZChzID0+IGUuZWxlbWVudCA9PT0gcykpIHtcblx0XHRcdFx0dGhpcy5zZXRGb2N1cyhlLmluZGV4ICE9PSB1bmRlZmluZWQgPyBbZS5pbmRleF0gOiBbXSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fdGVybWluYWxUYWJzU2luZ2xlU2VsZWN0ZWRDb250ZXh0S2V5ID0gVGVybWluYWxDb250ZXh0S2V5cy50YWJzU2luZ3VsYXJTZWxlY3Rpb24uYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9pc1NwbGl0Q29udGV4dEtleSA9IFRlcm1pbmFsQ29udGV4dEtleXMuc3BsaXRUZXJtaW5hbC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5vbkRpZENoYW5nZVNlbGVjdGlvbihlID0+IHRoaXMuX3VwZGF0ZUNvbnRleHRLZXkoKSkpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMub25EaWRDaGFuZ2VGb2N1cygoKSA9PiB0aGlzLl91cGRhdGVDb250ZXh0S2V5KCkpKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMub25EaWRPcGVuKGFzeW5jIGUgPT4ge1xuXHRcdFx0Y29uc3QgaW5zdGFuY2UgPSBlLmVsZW1lbnQ7XG5cdFx0XHRpZiAoIWluc3RhbmNlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLnNldEFjdGl2ZUluc3RhbmNlKGluc3RhbmNlKTtcblx0XHRcdGlmICghZS5lZGl0b3JPcHRpb25zLnByZXNlcnZlRm9jdXMpIHtcblx0XHRcdFx0YXdhaXQgaW5zdGFuY2UuZm9jdXNXaGVuUmVhZHkoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0aWYgKCF0aGlzLl9kZWNvcmF0aW9uc1Byb3ZpZGVyKSB7XG5cdFx0XHR0aGlzLl9kZWNvcmF0aW9uc1Byb3ZpZGVyID0gdGhpcy5kaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGFiRGVjb3JhdGlvbnNQcm92aWRlcikpO1xuXHRcdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQoZGVjb3JhdGlvbnNTZXJ2aWNlLnJlZ2lzdGVyRGVjb3JhdGlvbnNQcm92aWRlcih0aGlzLl9kZWNvcmF0aW9uc1Byb3ZpZGVyKSk7XG5cdFx0fVxuXHRcdHRoaXMucmVmcmVzaCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Rm9jdXNNb2RlKCk6ICdzaW5nbGVDbGljaycgfCAnZG91YmxlQ2xpY2snIHtcblx0XHRyZXR1cm4gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J3NpbmdsZUNsaWNrJyB8ICdkb3VibGVDbGljayc+KFRlcm1pbmFsU2V0dGluZ0lkLlRhYnNGb2N1c01vZGUpO1xuXHR9XG5cblx0cmVmcmVzaChjYW5jZWxFZGl0aW5nOiBib29sZWFuID0gdHJ1ZSk6IHZvaWQge1xuXHRcdGlmIChjYW5jZWxFZGl0aW5nICYmIHRoaXMuX3Rlcm1pbmFsU2VydmljZS5pc0VkaXRhYmxlKHVuZGVmaW5lZCkpIHtcblx0XHRcdHRoaXMuZG9tRm9jdXMoKTtcblx0XHR9XG5cblx0XHR0aGlzLnNwbGljZSgwLCB0aGlzLmxlbmd0aCwgdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuaW5zdGFuY2VzLnNsaWNlKCkpO1xuXHR9XG5cblx0Zm9jdXNIb3ZlcigpOiB2b2lkIHtcblx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuZ2V0U2VsZWN0ZWRFbGVtZW50cygpWzBdO1xuXHRcdGlmICghaW5zdGFuY2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9ob3ZlclNlcnZpY2Uuc2hvd0luc3RhbnRIb3Zlcih7XG5cdFx0XHQuLi5nZXRJbnN0YW5jZUhvdmVySW5mbyhpbnN0YW5jZSwgdGhpcy5fc3RvcmFnZVNlcnZpY2UpLFxuXHRcdFx0dGFyZ2V0OiB0aGlzLmdldEhUTUxFbGVtZW50KCksXG5cdFx0XHR0cmFwRm9jdXM6IHRydWVcblx0XHR9LCB0cnVlKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUNvbnRleHRLZXkoKSB7XG5cdFx0dGhpcy5fdGVybWluYWxUYWJzU2luZ2xlU2VsZWN0ZWRDb250ZXh0S2V5LnNldCh0aGlzLmdldFNlbGVjdGVkRWxlbWVudHMoKS5sZW5ndGggPT09IDEpO1xuXHRcdGNvbnN0IGluc3RhbmNlID0gdGhpcy5nZXRGb2N1c2VkRWxlbWVudHMoKTtcblx0XHR0aGlzLl9pc1NwbGl0Q29udGV4dEtleS5zZXQoaW5zdGFuY2UubGVuZ3RoID4gMCAmJiB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5pbnN0YW5jZUlzU3BsaXQoaW5zdGFuY2VbMF0pKTtcblx0fVxufVxuXG5jbGFzcyBUZXJtaW5hbFRhYnNSZW5kZXJlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTGlzdFJlbmRlcmVyPElUZXJtaW5hbEluc3RhbmNlLCBJVGVybWluYWxUYWJFbnRyeVRlbXBsYXRlPiB7XG5cdHRlbXBsYXRlSWQgPSAndGVybWluYWwudGFicyc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9sYWJlbHM6IFJlc291cmNlTGFiZWxzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2dldFNlbGVjdGlvbjogKCkgPT4gSVRlcm1pbmFsSW5zdGFuY2VbXSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2U6IElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsU2VydmljZTogSVRlcm1pbmFsU2VydmljZSxcblx0XHRASVRlcm1pbmFsR3JvdXBTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlOiBJVGVybWluYWxHcm91cFNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfa2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUxpc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xpc3RTZXJ2aWNlOiBJTGlzdFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUNvbnRleHRWaWV3U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0Vmlld1NlcnZpY2U6IElDb250ZXh0Vmlld1NlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElUZXJtaW5hbFRhYkVudHJ5VGVtcGxhdGUge1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLnRlcm1pbmFsLXRhYnMtZW50cnknKSk7XG5cdFx0Y29uc3QgY29udGV4dDogeyBob3ZlckFjdGlvbnM/OiBJSG92ZXJBY3Rpb25bXSB9ID0ge307XG5cdFx0Y29uc3QgbGFiZWwgPSB0aGlzLl9sYWJlbHMuY3JlYXRlKGVsZW1lbnQsIHtcblx0XHRcdHN1cHBvcnRIaWdobGlnaHRzOiB0cnVlLFxuXHRcdFx0c3VwcG9ydERlc2NyaXB0aW9uSGlnaGxpZ2h0czogdHJ1ZSxcblx0XHRcdHN1cHBvcnRJY29uczogdHJ1ZSxcblx0XHRcdGhvdmVyRGVsZWdhdGU6IHtcblx0XHRcdFx0ZGVsYXk6IDAsXG5cdFx0XHRcdHNob3dIb3Zlcjogb3B0aW9ucyA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX2hvdmVyU2VydmljZS5zaG93RGVsYXllZEhvdmVyKHtcblx0XHRcdFx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRcdFx0XHRhY3Rpb25zOiBjb250ZXh0LmhvdmVyQWN0aW9ucyxcblx0XHRcdFx0XHRcdHRhcmdldDogZWxlbWVudCxcblx0XHRcdFx0XHRcdGFwcGVhcmFuY2U6IHtcblx0XHRcdFx0XHRcdFx0c2hvd1BvaW50ZXI6IHRydWVcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRwb3NpdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRob3ZlclBvc2l0aW9uOiB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy50YWJzLmxvY2F0aW9uID09PSAnbGVmdCcgPyBIb3ZlclBvc2l0aW9uLlJJR0hUIDogSG92ZXJQb3NpdGlvbi5MRUZUXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSwgeyBncm91cElkOiAndGVybWluYWwtdGFicy1saXN0JyB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgYWN0aW9uc0NvbnRhaW5lciA9IERPTS5hcHBlbmQobGFiZWwuZWxlbWVudCwgJCgnLmFjdGlvbnMnKSk7XG5cblx0XHRjb25zdCBhY3Rpb25CYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgQWN0aW9uQmFyKGFjdGlvbnNDb250YWluZXIsIHtcblx0XHRcdGFjdGlvblJ1bm5lcjogdGhpcy5fcmVnaXN0ZXIobmV3IFRlcm1pbmFsQ29udGV4dEFjdGlvblJ1bm5lcigpKSxcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24sIG9wdGlvbnMpID0+XG5cdFx0XHRcdGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uXG5cdFx0XHRcdFx0PyB0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51RW50cnlBY3Rpb25WaWV3SXRlbSwgYWN0aW9uLCB7IGhvdmVyRGVsZWdhdGU6IG9wdGlvbnMuaG92ZXJEZWxlZ2F0ZSB9KSlcblx0XHRcdFx0XHQ6IHVuZGVmaW5lZFxuXHRcdH0pKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRlbGVtZW50LFxuXHRcdFx0bGFiZWwsXG5cdFx0XHRhY3Rpb25CYXIsXG5cdFx0XHRjb250ZXh0LFxuXHRcdFx0ZWxlbWVudERpc3Bvc2FibGVzOiBuZXcgRGlzcG9zYWJsZVN0b3JlKCksXG5cdFx0fTtcblx0fVxuXG5cdHNob3VsZEhpZGVUZXh0KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9jb250YWluZXIgPyB0aGlzLl9jb250YWluZXIuY2xpZW50V2lkdGggPCBUZXJtaW5hbFRhYnNMaXN0U2l6ZXMuTWlkcG9pbnRWaWV3V2lkdGggOiBmYWxzZTtcblx0fVxuXG5cdHNob3VsZEhpZGVBY3Rpb25CYXIoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRhaW5lciA/IHRoaXMuX2NvbnRhaW5lci5jbGllbnRXaWR0aCA8PSBUZXJtaW5hbFRhYnNMaXN0U2l6ZXMuQWN0aW9uYmFyTWluaW11bVdpZHRoIDogZmFsc2U7XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGU6IElUZXJtaW5hbFRhYkVudHJ5VGVtcGxhdGUpOiB2b2lkIHtcblx0XHRjb25zdCBoYXNUZXh0ID0gIXRoaXMuc2hvdWxkSGlkZVRleHQoKTtcblxuXHRcdGNvbnN0IGdyb3VwID0gdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuZ2V0R3JvdXBGb3JJbnN0YW5jZShpbnN0YW5jZSk7XG5cdFx0aWYgKCFncm91cCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCBncm91cCBmb3IgaW5zdGFuY2UgXCIke2luc3RhbmNlLmluc3RhbmNlSWR9XCJgKTtcblx0XHR9XG5cblx0XHR0ZW1wbGF0ZS5lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2hhcy10ZXh0JywgaGFzVGV4dCk7XG5cdFx0dGVtcGxhdGUuZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdpcy1hY3RpdmUnLCB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5hY3RpdmVJbnN0YW5jZSA9PT0gaW5zdGFuY2UpO1xuXG5cdFx0bGV0IHByZWZpeDogc3RyaW5nID0gJyc7XG5cdFx0aWYgKGdyb3VwLnRlcm1pbmFsSW5zdGFuY2VzLmxlbmd0aCA+IDEpIHtcblx0XHRcdGNvbnN0IHRlcm1pbmFsSW5kZXggPSBncm91cC50ZXJtaW5hbEluc3RhbmNlcy5pbmRleE9mKGluc3RhbmNlKTtcblx0XHRcdGlmICh0ZXJtaW5hbEluZGV4ID09PSAwKSB7XG5cdFx0XHRcdHByZWZpeCA9IGBcdTI1MEMgYDtcblx0XHRcdH0gZWxzZSBpZiAodGVybWluYWxJbmRleCA9PT0gZ3JvdXAudGVybWluYWxJbnN0YW5jZXMubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRwcmVmaXggPSBgXHUyNTE0IGA7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRwcmVmaXggPSBgXHUyNTFDIGA7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgaG92ZXJJbmZvID0gZ2V0SW5zdGFuY2VIb3ZlckluZm8oaW5zdGFuY2UsIHRoaXMuX3N0b3JhZ2VTZXJ2aWNlKTtcblx0XHR0ZW1wbGF0ZS5jb250ZXh0LmhvdmVyQWN0aW9ucyA9IGhvdmVySW5mby5hY3Rpb25zO1xuXG5cdFx0Y29uc3QgaWNvbklkID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZ2V0SWNvbklkLCBpbnN0YW5jZSk7XG5cdFx0Y29uc3QgaGFzQWN0aW9uYmFyID0gIXRoaXMuc2hvdWxkSGlkZUFjdGlvbkJhcigpO1xuXHRcdGxldCBsYWJlbDogc3RyaW5nID0gJyc7XG5cdFx0aWYgKCFoYXNUZXh0KSB7XG5cdFx0XHRjb25zdCBwcmltYXJ5U3RhdHVzID0gaW5zdGFuY2Uuc3RhdHVzTGlzdC5wcmltYXJ5O1xuXHRcdFx0Ly8gRG9uJ3Qgc2hvdyBpZ25vcmUgc2V2ZXJpdHlcblx0XHRcdGlmIChwcmltYXJ5U3RhdHVzICYmIHByaW1hcnlTdGF0dXMuc2V2ZXJpdHkgPiBTZXZlcml0eS5JZ25vcmUpIHtcblx0XHRcdFx0bGFiZWwgPSBgJHtwcmVmaXh9JCgke3ByaW1hcnlTdGF0dXMuaWNvbj8uaWQgfHwgaWNvbklkfSlgO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGFiZWwgPSBgJHtwcmVmaXh9JCgke2ljb25JZH0pYDtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5maWxsQWN0aW9uQmFyKGluc3RhbmNlLCB0ZW1wbGF0ZSk7XG5cdFx0XHRsYWJlbCA9IHByZWZpeDtcblx0XHRcdC8vIE9ubHkgYWRkIHRoZSB0aXRsZSBpZiB0aGUgaWNvbiBpcyBzZXQsIHRoaXMgcHJldmVudHMgdGhlIHRpdGxlIGp1bXBpbmcgYXJvdW5kIGZvclxuXHRcdFx0Ly8gZXhhbXBsZSB3aGVuIGxhdW5jaGluZyB3aXRoIGEgU2hlbGxMYXVuY2hDb25maWcubmFtZSBhbmQgbm8gaWNvblxuXHRcdFx0aWYgKGluc3RhbmNlLmljb24pIHtcblx0XHRcdFx0bGFiZWwgKz0gYCQoJHtpY29uSWR9KSAke2luc3RhbmNlLnRpdGxlfWA7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFoYXNBY3Rpb25iYXIpIHtcblx0XHRcdHRlbXBsYXRlLmFjdGlvbkJhci5jbGVhcigpO1xuXHRcdH1cblxuXHRcdC8vIEtpbGwgdGVybWluYWwgb24gbWlkZGxlIGNsaWNrXG5cdFx0dGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzLmFkZChET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRlbXBsYXRlLmVsZW1lbnQsIERPTS5FdmVudFR5cGUuQVVYQ0xJQ0ssIGUgPT4ge1xuXHRcdFx0ZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdGlmIChlLmJ1dHRvbiA9PT0gMS8qbWlkZGxlKi8pIHtcblx0XHRcdFx0dGhpcy5fdGVybWluYWxTZXJ2aWNlLnNhZmVEaXNwb3NlVGVybWluYWwoaW5zdGFuY2UpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGV4dHJhQ2xhc3Nlczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBjb2xvckNsYXNzID0gZ2V0Q29sb3JDbGFzcyhpbnN0YW5jZSk7XG5cdFx0aWYgKGNvbG9yQ2xhc3MpIHtcblx0XHRcdGV4dHJhQ2xhc3Nlcy5wdXNoKGNvbG9yQ2xhc3MpO1xuXHRcdH1cblx0XHRjb25zdCB1cmlDbGFzc2VzID0gZ2V0VXJpQ2xhc3NlcyhpbnN0YW5jZSwgdGhpcy5fdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKS50eXBlKTtcblx0XHRpZiAodXJpQ2xhc3Nlcykge1xuXHRcdFx0ZXh0cmFDbGFzc2VzLnB1c2goLi4udXJpQ2xhc3Nlcyk7XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGUubGFiZWwuc2V0UmVzb3VyY2Uoe1xuXHRcdFx0cmVzb3VyY2U6IGluc3RhbmNlLnJlc291cmNlLFxuXHRcdFx0bmFtZTogbGFiZWwsXG5cdFx0XHRkZXNjcmlwdGlvbjogaGFzVGV4dCA/IGluc3RhbmNlLmRlc2NyaXB0aW9uIDogdW5kZWZpbmVkXG5cdFx0fSwge1xuXHRcdFx0ZmlsZURlY29yYXRpb25zOiB7XG5cdFx0XHRcdGNvbG9yczogdHJ1ZSxcblx0XHRcdFx0YmFkZ2VzOiBoYXNUZXh0XG5cdFx0XHR9LFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0bWFya2Rvd246IGhvdmVySW5mby5jb250ZW50LFxuXHRcdFx0XHRtYXJrZG93bk5vdFN1cHBvcnRlZEZhbGxiYWNrOiB1bmRlZmluZWRcblx0XHRcdH0sXG5cdFx0XHRleHRyYUNsYXNzZXNcblx0XHR9KTtcblx0XHRjb25zdCBlZGl0YWJsZURhdGEgPSB0aGlzLl90ZXJtaW5hbFNlcnZpY2UuZ2V0RWRpdGFibGVEYXRhKGluc3RhbmNlKTtcblx0XHR0ZW1wbGF0ZS5sYWJlbC5lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2VkaXRhYmxlLXRhYicsICEhZWRpdGFibGVEYXRhKTtcblx0XHRpZiAoZWRpdGFibGVEYXRhKSB7XG5cdFx0XHR0ZW1wbGF0ZS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKHRoaXMuX3JlbmRlcklucHV0Qm94KHRlbXBsYXRlLmxhYmVsLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLm1vbmFjby1pY29uLWxhYmVsLWNvbnRhaW5lcicpISwgaW5zdGFuY2UsIGVkaXRhYmxlRGF0YSkpO1xuXHRcdFx0dGVtcGxhdGUuYWN0aW9uQmFyLmNsZWFyKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVySW5wdXRCb3goY29udGFpbmVyOiBIVE1MRWxlbWVudCwgaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlLCBlZGl0YWJsZURhdGE6IElFZGl0YWJsZURhdGEpOiBJRGlzcG9zYWJsZSB7XG5cblx0XHRjb25zdCB2YWx1ZSA9IGluc3RhbmNlLnRpdGxlIHx8ICcnO1xuXG5cdFx0Y29uc3QgaW5wdXRCb3ggPSBuZXcgSW5wdXRCb3goY29udGFpbmVyLCB0aGlzLl9jb250ZXh0Vmlld1NlcnZpY2UsIHtcblx0XHRcdHZhbGlkYXRpb25PcHRpb25zOiB7XG5cdFx0XHRcdHZhbGlkYXRpb246ICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBlZGl0YWJsZURhdGEudmFsaWRhdGlvbk1lc3NhZ2UodmFsdWUpO1xuXHRcdFx0XHRcdGlmICghbWVzc2FnZSB8fCBtZXNzYWdlLnNldmVyaXR5ICE9PSBTZXZlcml0eS5FcnJvcikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGNvbnRlbnQ6IG1lc3NhZ2UuY29udGVudCxcblx0XHRcdFx0XHRcdGZvcm1hdENvbnRlbnQ6IHRydWUsXG5cdFx0XHRcdFx0XHR0eXBlOiBNZXNzYWdlVHlwZS5FUlJPUlxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRhcmlhTGFiZWw6IGxvY2FsaXplKCd0ZXJtaW5hbElucHV0QXJpYUxhYmVsJywgXCJUeXBlIHRlcm1pbmFsIG5hbWUuIFByZXNzIEVudGVyIHRvIGNvbmZpcm0gb3IgRXNjYXBlIHRvIGNhbmNlbC5cIiksXG5cdFx0XHRpbnB1dEJveFN0eWxlczogZGVmYXVsdElucHV0Qm94U3R5bGVzXG5cdFx0fSk7XG5cdFx0aW5wdXRCb3guZWxlbWVudC5zdHlsZS5oZWlnaHQgPSAnMjJweCc7XG5cdFx0aW5wdXRCb3gudmFsdWUgPSB2YWx1ZTtcblx0XHRpbnB1dEJveC5mb2N1cygpO1xuXHRcdGlucHV0Qm94LnNlbGVjdCh7IHN0YXJ0OiAwLCBlbmQ6IHZhbHVlLmxlbmd0aCB9KTtcblxuXHRcdGNvbnN0IGRvbmUgPSBjcmVhdGVTaW5nbGVDYWxsRnVuY3Rpb24oKHN1Y2Nlc3M6IGJvb2xlYW4sIGZpbmlzaEVkaXRpbmc6IGJvb2xlYW4pID0+IHtcblx0XHRcdGlucHV0Qm94LmVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdGNvbnN0IHZhbHVlID0gaW5wdXRCb3gudmFsdWU7XG5cdFx0XHRkaXNwb3NlKHRvRGlzcG9zZSk7XG5cdFx0XHRpbnB1dEJveC5lbGVtZW50LnJlbW92ZSgpO1xuXHRcdFx0aWYgKGZpbmlzaEVkaXRpbmcpIHtcblx0XHRcdFx0ZWRpdGFibGVEYXRhLm9uRmluaXNoKHZhbHVlLCBzdWNjZXNzKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHNob3dJbnB1dEJveE5vdGlmaWNhdGlvbiA9ICgpID0+IHtcblx0XHRcdGlmIChpbnB1dEJveC5pc0lucHV0VmFsaWQoKSkge1xuXHRcdFx0XHRjb25zdCBtZXNzYWdlID0gZWRpdGFibGVEYXRhLnZhbGlkYXRpb25NZXNzYWdlKGlucHV0Qm94LnZhbHVlKTtcblx0XHRcdFx0aWYgKG1lc3NhZ2UpIHtcblx0XHRcdFx0XHRpbnB1dEJveC5zaG93TWVzc2FnZSh7XG5cdFx0XHRcdFx0XHRjb250ZW50OiBtZXNzYWdlLmNvbnRlbnQsXG5cdFx0XHRcdFx0XHRmb3JtYXRDb250ZW50OiB0cnVlLFxuXHRcdFx0XHRcdFx0dHlwZTogbWVzc2FnZS5zZXZlcml0eSA9PT0gU2V2ZXJpdHkuSW5mbyA/IE1lc3NhZ2VUeXBlLklORk8gOiBtZXNzYWdlLnNldmVyaXR5ID09PSBTZXZlcml0eS5XYXJuaW5nID8gTWVzc2FnZVR5cGUuV0FSTklORyA6IE1lc3NhZ2VUeXBlLkVSUk9SXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aW5wdXRCb3guaGlkZU1lc3NhZ2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0c2hvd0lucHV0Qm94Tm90aWZpY2F0aW9uKCk7XG5cblx0XHRjb25zdCB0b0Rpc3Bvc2UgPSBbXG5cdFx0XHRpbnB1dEJveCxcblx0XHRcdERPTS5hZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihpbnB1dEJveC5pbnB1dEVsZW1lbnQsIERPTS5FdmVudFR5cGUuS0VZX0RPV04sIChlOiBJS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRpZiAoZS5lcXVhbHMoS2V5Q29kZS5FbnRlcikpIHtcblx0XHRcdFx0XHRkb25lKGlucHV0Qm94LmlzSW5wdXRWYWxpZCgpLCB0cnVlKTtcblx0XHRcdFx0fSBlbHNlIGlmIChlLmVxdWFscyhLZXlDb2RlLkVzY2FwZSkpIHtcblx0XHRcdFx0XHRkb25lKGZhbHNlLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSksXG5cdFx0XHRET00uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIoaW5wdXRCb3guaW5wdXRFbGVtZW50LCBET00uRXZlbnRUeXBlLktFWV9VUCwgKGU6IElLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRcdHNob3dJbnB1dEJveE5vdGlmaWNhdGlvbigpO1xuXHRcdFx0fSksXG5cdFx0XHRET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGlucHV0Qm94LmlucHV0RWxlbWVudCwgRE9NLkV2ZW50VHlwZS5CTFVSLCAoKSA9PiB7XG5cdFx0XHRcdGRvbmUoaW5wdXRCb3guaXNJbnB1dFZhbGlkKCksIHRydWUpO1xuXHRcdFx0fSlcblx0XHRdO1xuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRkb25lKGZhbHNlLCBmYWxzZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UsIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVRlcm1pbmFsVGFiRW50cnlUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9uQmFyLmNsZWFyKCk7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJVGVybWluYWxUYWJFbnRyeVRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGVtcGxhdGVEYXRhLmxhYmVsLmRpc3Bvc2UoKTtcblx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9uQmFyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGZpbGxBY3Rpb25CYXIoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlLCB0ZW1wbGF0ZTogSVRlcm1pbmFsVGFiRW50cnlUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdC8vIElmIHRoZSBpbnN0YW5jZSBpcyB3aXRoaW4gdGhlIHNlbGVjdGlvbiwgc3BsaXQgYWxsIHNlbGVjdGVkXG5cdFx0Y29uc3QgYWN0aW9ucyA9IFtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKG5ldyBBY3Rpb24oVGVybWluYWxDb21tYW5kSWQuU3BsaXRBY3RpdmVUYWIsIHRlcm1pbmFsU3RyaW5ncy5zcGxpdC5zaG9ydCwgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uc3BsaXRIb3Jpem9udGFsKSwgdHJ1ZSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9ydW5Gb3JTZWxlY3Rpb25Pckluc3RhbmNlKGluc3RhbmNlLCBhc3luYyBlID0+IHtcblx0XHRcdFx0XHR0aGlzLl90ZXJtaW5hbFNlcnZpY2UuY3JlYXRlVGVybWluYWwoeyBsb2NhdGlvbjogeyBwYXJlbnRUZXJtaW5hbDogZSB9IH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pKSxcblx0XHRdO1xuXHRcdGlmIChpbnN0YW5jZS5zaGVsbExhdW5jaENvbmZpZy50YWJBY3Rpb25zKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGFjdGlvbiBvZiBpbnN0YW5jZS5zaGVsbExhdW5jaENvbmZpZy50YWJBY3Rpb25zKSB7XG5cdFx0XHRcdGFjdGlvbnMucHVzaCh0aGlzLl9yZWdpc3RlcihuZXcgQWN0aW9uKGFjdGlvbi5pZCwgYWN0aW9uLmxhYmVsLCBhY3Rpb24uaWNvbiA/IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShhY3Rpb24uaWNvbikgOiB1bmRlZmluZWQsIHRydWUsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9ydW5Gb3JTZWxlY3Rpb25Pckluc3RhbmNlKGluc3RhbmNlLCBlID0+IHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGFjdGlvbi5pZCwgaW5zdGFuY2UpKTtcblx0XHRcdFx0fSkpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0YWN0aW9ucy5wdXNoKHRoaXMuX3JlZ2lzdGVyKG5ldyBBY3Rpb24oVGVybWluYWxDb21tYW5kSWQuS2lsbEFjdGl2ZVRhYiwgdGVybWluYWxTdHJpbmdzLmtpbGwuc2hvcnQsIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLnRyYXNoY2FuKSwgdHJ1ZSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhpcy5fcnVuRm9yU2VsZWN0aW9uT3JJbnN0YW5jZShpbnN0YW5jZSwgZSA9PiB0aGlzLl90ZXJtaW5hbFNlcnZpY2Uuc2FmZURpc3Bvc2VUZXJtaW5hbChlKSk7XG5cdFx0fSkpKTtcblx0XHQvLyBUT0RPOiBDYWNoZSB0aGVzZSBpbiBhIHdheSB0aGF0IHdpbGwgdXNlIHRoZSBjb3JyZWN0IGluc3RhbmNlXG5cdFx0dGVtcGxhdGUuYWN0aW9uQmFyLmNsZWFyKCk7XG5cdFx0Zm9yIChjb25zdCBhY3Rpb24gb2YgYWN0aW9ucykge1xuXHRcdFx0dGVtcGxhdGUuYWN0aW9uQmFyLnB1c2goYWN0aW9uLCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSwga2V5YmluZGluZzogdGhpcy5fa2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhhY3Rpb24uaWQpPy5nZXRMYWJlbCgpIH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3J1bkZvclNlbGVjdGlvbk9ySW5zdGFuY2UoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlLCBjYWxsYmFjazogKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuX2dldFNlbGVjdGlvbigpO1xuXHRcdGlmIChzZWxlY3Rpb24uaW5jbHVkZXMoaW5zdGFuY2UpKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHMgb2Ygc2VsZWN0aW9uKSB7XG5cdFx0XHRcdGlmIChzKSB7XG5cdFx0XHRcdFx0Y2FsbGJhY2socyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y2FsbGJhY2soaW5zdGFuY2UpO1xuXHRcdH1cblx0XHR0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5mb2N1c1RhYnMoKTtcblx0XHR0aGlzLl9saXN0U2VydmljZS5sYXN0Rm9jdXNlZExpc3Q/LmZvY3VzTmV4dCgpO1xuXHR9XG59XG5cbmludGVyZmFjZSBJVGVybWluYWxUYWJFbnRyeVRlbXBsYXRlIHtcblx0cmVhZG9ubHkgZWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IGxhYmVsOiBJUmVzb3VyY2VMYWJlbDtcblx0cmVhZG9ubHkgYWN0aW9uQmFyOiBBY3Rpb25CYXI7XG5cdGNvbnRleHQ6IHtcblx0XHRob3ZlckFjdGlvbnM/OiBJSG92ZXJBY3Rpb25bXTtcblx0fTtcblx0cmVhZG9ubHkgZWxlbWVudERpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG59XG5cblxuY2xhc3MgVGVybWluYWxUYWJzQWNjZXNzaWJpbGl0eVByb3ZpZGVyIGltcGxlbWVudHMgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8SVRlcm1pbmFsSW5zdGFuY2U+IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0QElUZXJtaW5hbEdyb3VwU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbEdyb3VwU2VydmljZTogSVRlcm1pbmFsR3JvdXBTZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdGdldFdpZGdldEFyaWFMYWJlbCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgndGVybWluYWwudGFicycsIFwiVGVybWluYWwgdGFic1wiKTtcblx0fVxuXG5cdGdldEFyaWFMYWJlbChpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UpOiBzdHJpbmcge1xuXHRcdGxldCBhcmlhTGFiZWw6IHN0cmluZyA9ICcnO1xuXHRcdGNvbnN0IHRhYiA9IHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmdldEdyb3VwRm9ySW5zdGFuY2UoaW5zdGFuY2UpO1xuXHRcdGlmICh0YWIgJiYgdGFiLnRlcm1pbmFsSW5zdGFuY2VzPy5sZW5ndGggPiAxKSB7XG5cdFx0XHRjb25zdCB0ZXJtaW5hbEluZGV4ID0gdGFiLnRlcm1pbmFsSW5zdGFuY2VzLmluZGV4T2YoaW5zdGFuY2UpO1xuXHRcdFx0YXJpYUxhYmVsID0gbG9jYWxpemUoe1xuXHRcdFx0XHRrZXk6ICdzcGxpdFRlcm1pbmFsQXJpYUxhYmVsJyxcblx0XHRcdFx0Y29tbWVudDogW1xuXHRcdFx0XHRcdGBUaGUgdGVybWluYWwncyBJRGAsXG5cdFx0XHRcdFx0YFRoZSB0ZXJtaW5hbCdzIHRpdGxlYCxcblx0XHRcdFx0XHRgVGhlIHRlcm1pbmFsJ3Mgc3BsaXQgbnVtYmVyYCxcblx0XHRcdFx0XHRgVGhlIHRlcm1pbmFsIGdyb3VwJ3MgdG90YWwgc3BsaXQgbnVtYmVyYFxuXHRcdFx0XHRdXG5cdFx0XHR9LCBcIlRlcm1pbmFsIHswfSB7MX0sIHNwbGl0IHsyfSBvZiB7M31cIiwgaW5zdGFuY2UuaW5zdGFuY2VJZCwgaW5zdGFuY2UudGl0bGUsIHRlcm1pbmFsSW5kZXggKyAxLCB0YWIudGVybWluYWxJbnN0YW5jZXMubGVuZ3RoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXJpYUxhYmVsID0gbG9jYWxpemUoe1xuXHRcdFx0XHRrZXk6ICd0ZXJtaW5hbEFyaWFMYWJlbCcsXG5cdFx0XHRcdGNvbW1lbnQ6IFtcblx0XHRcdFx0XHRgVGhlIHRlcm1pbmFsJ3MgSURgLFxuXHRcdFx0XHRcdGBUaGUgdGVybWluYWwncyB0aXRsZWBcblx0XHRcdFx0XVxuXHRcdFx0fSwgXCJUZXJtaW5hbCB7MH0gezF9XCIsIGluc3RhbmNlLmluc3RhbmNlSWQsIGluc3RhbmNlLnRpdGxlKTtcblx0XHR9XG5cdFx0cmV0dXJuIGFyaWFMYWJlbDtcblx0fVxufVxuXG5jbGFzcyBUZXJtaW5hbFRhYnNEcmFnQW5kRHJvcCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTGlzdERyYWdBbmREcm9wPElUZXJtaW5hbEluc3RhbmNlPiB7XG5cdHByaXZhdGUgX2F1dG9Gb2N1c0luc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfYXV0b0ZvY3VzRGlzcG9zYWJsZTogSURpc3Bvc2FibGUgPSBEaXNwb3NhYmxlLk5vbmU7XG5cdHByaXZhdGUgX3ByaW1hcnlCYWNrZW5kOiBJVGVybWluYWxCYWNrZW5kIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVGVybWluYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsU2VydmljZTogSVRlcm1pbmFsU2VydmljZSxcblx0XHRASVRlcm1pbmFsR3JvdXBTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlOiBJVGVybWluYWxHcm91cFNlcnZpY2UsXG5cdFx0QElMaXN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9saXN0U2VydmljZTogSUxpc3RTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3ByaW1hcnlCYWNrZW5kID0gdGhpcy5fdGVybWluYWxTZXJ2aWNlLmdldFByaW1hcnlCYWNrZW5kKCk7XG5cdH1cblxuXHRnZXREcmFnVVJJKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSk6IHN0cmluZyB8IG51bGwge1xuXHRcdGlmICh0aGlzLl90ZXJtaW5hbFNlcnZpY2UuZ2V0RWRpdGluZ1Rlcm1pbmFsKCk/Lmluc3RhbmNlSWQgPT09IGluc3RhbmNlLmluc3RhbmNlSWQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiBpbnN0YW5jZS5yZXNvdXJjZS50b1N0cmluZygpO1xuXHR9XG5cblx0Z2V0RHJhZ0xhYmVsPyhlbGVtZW50czogSVRlcm1pbmFsSW5zdGFuY2VbXSwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gZWxlbWVudHMubGVuZ3RoID09PSAxID8gZWxlbWVudHNbMF0udGl0bGUgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRvbkRyYWdMZWF2ZSgpIHtcblx0XHR0aGlzLl9hdXRvRm9jdXNJbnN0YW5jZSA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9hdXRvRm9jdXNEaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9hdXRvRm9jdXNEaXNwb3NhYmxlID0gRGlzcG9zYWJsZS5Ob25lO1xuXHR9XG5cblx0b25EcmFnU3RhcnQoZGF0YTogSURyYWdBbmREcm9wRGF0YSwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG5cdFx0aWYgKCFvcmlnaW5hbEV2ZW50LmRhdGFUcmFuc2Zlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBkbmREYXRhOiB1bmtub3duID0gZGF0YS5nZXREYXRhKCk7XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGRuZERhdGEpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIEF0dGFjaCB0ZXJtaW5hbHMgdHlwZSB0byBldmVudFxuXHRcdGNvbnN0IHRlcm1pbmFsczogSVRlcm1pbmFsSW5zdGFuY2VbXSA9IGRuZERhdGEuZmlsdGVyKGUgPT4gJ2luc3RhbmNlSWQnIGluIChlIGFzIGFueSkpO1xuXHRcdGlmICh0ZXJtaW5hbHMubGVuZ3RoID4gMCkge1xuXHRcdFx0b3JpZ2luYWxFdmVudC5kYXRhVHJhbnNmZXIuc2V0RGF0YShUZXJtaW5hbERhdGFUcmFuc2ZlcnMuVGVybWluYWxzLCBKU09OLnN0cmluZ2lmeSh0ZXJtaW5hbHMubWFwKGUgPT4gZS5yZXNvdXJjZS50b1N0cmluZygpKSkpO1xuXHRcdH1cblx0fVxuXG5cdG9uRHJhZ092ZXIoZGF0YTogSURyYWdBbmREcm9wRGF0YSwgdGFyZ2V0SW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlIHwgdW5kZWZpbmVkLCB0YXJnZXRJbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkLCB0YXJnZXRTZWN0b3I6IExpc3RWaWV3VGFyZ2V0U2VjdG9yIHwgdW5kZWZpbmVkLCBvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQpOiBib29sZWFuIHwgSUxpc3REcmFnT3ZlclJlYWN0aW9uIHtcblx0XHRpZiAoZGF0YSBpbnN0YW5jZW9mIE5hdGl2ZURyYWdBbmREcm9wRGF0YSkge1xuXHRcdFx0aWYgKCFjb250YWluc0RyYWdUeXBlKG9yaWdpbmFsRXZlbnQsIERhdGFUcmFuc2ZlcnMuRklMRVMsIERhdGFUcmFuc2ZlcnMuUkVTT1VSQ0VTLCBUZXJtaW5hbERhdGFUcmFuc2ZlcnMuVGVybWluYWxzLCBDb2RlRGF0YVRyYW5zZmVycy5GSUxFUykpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGRpZENoYW5nZUF1dG9Gb2N1c0luc3RhbmNlID0gdGhpcy5fYXV0b0ZvY3VzSW5zdGFuY2UgIT09IHRhcmdldEluc3RhbmNlO1xuXHRcdGlmIChkaWRDaGFuZ2VBdXRvRm9jdXNJbnN0YW5jZSkge1xuXHRcdFx0dGhpcy5fYXV0b0ZvY3VzRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9hdXRvRm9jdXNJbnN0YW5jZSA9IHRhcmdldEluc3RhbmNlO1xuXHRcdH1cblxuXHRcdGlmICghdGFyZ2V0SW5zdGFuY2UgJiYgIWNvbnRhaW5zRHJhZ1R5cGUob3JpZ2luYWxFdmVudCwgVGVybWluYWxEYXRhVHJhbnNmZXJzLlRlcm1pbmFscykpIHtcblx0XHRcdHJldHVybiBkYXRhIGluc3RhbmNlb2YgRWxlbWVudHNEcmFnQW5kRHJvcERhdGE7XG5cdFx0fVxuXG5cdFx0aWYgKGRpZENoYW5nZUF1dG9Gb2N1c0luc3RhbmNlICYmIHRhcmdldEluc3RhbmNlKSB7XG5cdFx0XHR0aGlzLl9hdXRvRm9jdXNEaXNwb3NhYmxlID0gZGlzcG9zYWJsZVRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl90ZXJtaW5hbFNlcnZpY2Uuc2V0QWN0aXZlSW5zdGFuY2UodGFyZ2V0SW5zdGFuY2UpO1xuXHRcdFx0XHR0aGlzLl9hdXRvRm9jdXNJbnN0YW5jZSA9IHVuZGVmaW5lZDtcblx0XHRcdH0sIDUwMCwgdGhpcy5fc3RvcmUpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRmZWVkYmFjazogdGFyZ2V0SW5kZXggPyBbdGFyZ2V0SW5kZXhdIDogdW5kZWZpbmVkLFxuXHRcdFx0YWNjZXB0OiB0cnVlLFxuXHRcdFx0ZWZmZWN0OiB7IHR5cGU6IExpc3REcmFnT3ZlckVmZmVjdFR5cGUuTW92ZSwgcG9zaXRpb246IExpc3REcmFnT3ZlckVmZmVjdFBvc2l0aW9uLk92ZXIgfVxuXHRcdH07XG5cdH1cblxuXHRhc3luYyBkcm9wKGRhdGE6IElEcmFnQW5kRHJvcERhdGEsIHRhcmdldEluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZCwgdGFyZ2V0SW5kZXg6IG51bWJlciB8IHVuZGVmaW5lZCwgdGFyZ2V0U2VjdG9yOiBMaXN0Vmlld1RhcmdldFNlY3RvciB8IHVuZGVmaW5lZCwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fYXV0b0ZvY3VzRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fYXV0b0ZvY3VzSW5zdGFuY2UgPSB1bmRlZmluZWQ7XG5cblx0XHRsZXQgc291cmNlSW5zdGFuY2VzOiBJVGVybWluYWxJbnN0YW5jZVtdIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHByb21pc2VzOiBQcm9taXNlPElQcm9jZXNzRGV0YWlscyB8IHVuZGVmaW5lZD5bXSA9IFtdO1xuXHRcdGNvbnN0IHJlc291cmNlcyA9IGdldFRlcm1pbmFsUmVzb3VyY2VzRnJvbURyYWdFdmVudChvcmlnaW5hbEV2ZW50KTtcblx0XHRpZiAocmVzb3VyY2VzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHVyaSBvZiByZXNvdXJjZXMpIHtcblx0XHRcdFx0Y29uc3QgaW5zdGFuY2UgPSB0aGlzLl90ZXJtaW5hbFNlcnZpY2UuZ2V0SW5zdGFuY2VGcm9tUmVzb3VyY2UodXJpKTtcblx0XHRcdFx0aWYgKGluc3RhbmNlKSB7XG5cdFx0XHRcdFx0aWYgKEFycmF5LmlzQXJyYXkoc291cmNlSW5zdGFuY2VzKSkge1xuXHRcdFx0XHRcdFx0c291cmNlSW5zdGFuY2VzLnB1c2goaW5zdGFuY2UpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRzb3VyY2VJbnN0YW5jZXMgPSBbaW5zdGFuY2VdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLl90ZXJtaW5hbFNlcnZpY2UubW92ZVRvVGVybWluYWxWaWV3KGluc3RhbmNlKTtcblx0XHRcdFx0fSBlbHNlIGlmICh0aGlzLl9wcmltYXJ5QmFja2VuZCkge1xuXHRcdFx0XHRcdGNvbnN0IHRlcm1pbmFsSWRlbnRpZmllciA9IHBhcnNlVGVybWluYWxVcmkodXJpKTtcblx0XHRcdFx0XHRpZiAodGVybWluYWxJZGVudGlmaWVyLmluc3RhbmNlSWQpIHtcblx0XHRcdFx0XHRcdHByb21pc2VzLnB1c2godGhpcy5fcHJpbWFyeUJhY2tlbmQucmVxdWVzdERldGFjaEluc3RhbmNlKHRlcm1pbmFsSWRlbnRpZmllci53b3Jrc3BhY2VJZCwgdGVybWluYWxJZGVudGlmaWVyLmluc3RhbmNlSWQpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAocHJvbWlzZXMubGVuZ3RoKSB7XG5cdFx0XHRsZXQgcHJvY2Vzc2VzID0gYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuXHRcdFx0cHJvY2Vzc2VzID0gcHJvY2Vzc2VzLmZpbHRlcihwID0+IHAgIT09IHVuZGVmaW5lZCk7XG5cdFx0XHRsZXQgbGFzdEluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZDtcblx0XHRcdGZvciAoY29uc3QgYXR0YWNoUGVyc2lzdGVudFByb2Nlc3Mgb2YgcHJvY2Vzc2VzKSB7XG5cdFx0XHRcdGxhc3RJbnN0YW5jZSA9IGF3YWl0IHRoaXMuX3Rlcm1pbmFsU2VydmljZS5jcmVhdGVUZXJtaW5hbCh7IGNvbmZpZzogeyBhdHRhY2hQZXJzaXN0ZW50UHJvY2VzcyB9IH0pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGxhc3RJbnN0YW5jZSkge1xuXHRcdFx0XHR0aGlzLl90ZXJtaW5hbFNlcnZpY2Uuc2V0QWN0aXZlSW5zdGFuY2UobGFzdEluc3RhbmNlKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoc291cmNlSW5zdGFuY2VzID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmICghKGRhdGEgaW5zdGFuY2VvZiBFbGVtZW50c0RyYWdBbmREcm9wRGF0YSkpIHtcblx0XHRcdFx0dGhpcy5faGFuZGxlRXh0ZXJuYWxEcm9wKHRhcmdldEluc3RhbmNlLCBvcmlnaW5hbEV2ZW50KTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkcmFnZ2VkRWxlbWVudCA9IGRhdGEuZ2V0RGF0YSgpO1xuXHRcdFx0aWYgKCFkcmFnZ2VkRWxlbWVudCB8fCAhQXJyYXkuaXNBcnJheShkcmFnZ2VkRWxlbWVudCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzb3VyY2VJbnN0YW5jZXMgPSBbXTtcblx0XHRcdGZvciAoY29uc3QgZSBvZiBkcmFnZ2VkRWxlbWVudCkge1xuXHRcdFx0XHRpZiAoJ2luc3RhbmNlSWQnIGluIGUpIHtcblx0XHRcdFx0XHRzb3VyY2VJbnN0YW5jZXMucHVzaChlIGFzIElUZXJtaW5hbEluc3RhbmNlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghdGFyZ2V0SW5zdGFuY2UpIHtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLm1vdmVHcm91cFRvRW5kKHNvdXJjZUluc3RhbmNlcyk7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbFNlcnZpY2Uuc2V0QWN0aXZlSW5zdGFuY2Uoc291cmNlSW5zdGFuY2VzWzBdKTtcblx0XHRcdGNvbnN0IHRhcmdldEdyb3VwID0gdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuZ2V0R3JvdXBGb3JJbnN0YW5jZShzb3VyY2VJbnN0YW5jZXNbMF0pO1xuXHRcdFx0aWYgKHRhcmdldEdyb3VwKSB7XG5cdFx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuZ3JvdXBzLmluZGV4T2YodGFyZ2V0R3JvdXApO1xuXHRcdFx0XHR0aGlzLl9saXN0U2VydmljZS5sYXN0Rm9jdXNlZExpc3Q/LnNldFNlbGVjdGlvbihbaW5kZXhdKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5tb3ZlR3JvdXAoc291cmNlSW5zdGFuY2VzLCB0YXJnZXRJbnN0YW5jZSk7XG5cdFx0dGhpcy5fdGVybWluYWxTZXJ2aWNlLnNldEFjdGl2ZUluc3RhbmNlKHNvdXJjZUluc3RhbmNlc1swXSk7XG5cdFx0Y29uc3QgdGFyZ2V0R3JvdXAgPSB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5nZXRHcm91cEZvckluc3RhbmNlKHNvdXJjZUluc3RhbmNlc1swXSk7XG5cdFx0aWYgKHRhcmdldEdyb3VwKSB7XG5cdFx0XHRjb25zdCBpbmRleCA9IHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmdyb3Vwcy5pbmRleE9mKHRhcmdldEdyb3VwKTtcblx0XHRcdHRoaXMuX2xpc3RTZXJ2aWNlLmxhc3RGb2N1c2VkTGlzdD8uc2V0U2VsZWN0aW9uKFtpbmRleF0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2hhbmRsZUV4dGVybmFsRHJvcChpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQsIGU6IERyYWdFdmVudCkge1xuXHRcdGlmICghaW5zdGFuY2UgfHwgIWUuZGF0YVRyYW5zZmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgaWYgZmlsZXMgd2VyZSBkcmFnZ2VkIGZyb20gdGhlIHRyZWUgZXhwbG9yZXJcblx0XHRsZXQgcmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCByYXdSZXNvdXJjZXMgPSBlLmRhdGFUcmFuc2Zlci5nZXREYXRhKERhdGFUcmFuc2ZlcnMuUkVTT1VSQ0VTKTtcblx0XHRpZiAocmF3UmVzb3VyY2VzKSB7XG5cdFx0XHRyZXNvdXJjZSA9IFVSSS5wYXJzZShKU09OLnBhcnNlKHJhd1Jlc291cmNlcylbMF0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJhd0NvZGVGaWxlcyA9IGUuZGF0YVRyYW5zZmVyLmdldERhdGEoQ29kZURhdGFUcmFuc2ZlcnMuRklMRVMpO1xuXHRcdGlmICghcmVzb3VyY2UgJiYgcmF3Q29kZUZpbGVzKSB7XG5cdFx0XHRyZXNvdXJjZSA9IFVSSS5maWxlKEpTT04ucGFyc2UocmF3Q29kZUZpbGVzKVswXSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFyZXNvdXJjZSAmJiBlLmRhdGFUcmFuc2Zlci5maWxlcy5sZW5ndGggPiAwICYmIGdldFBhdGhGb3JGaWxlKGUuZGF0YVRyYW5zZmVyLmZpbGVzWzBdKSkge1xuXHRcdFx0Ly8gQ2hlY2sgaWYgdGhlIGZpbGUgd2FzIGRyYWdnZWQgZnJvbSB0aGUgZmlsZXN5c3RlbVxuXHRcdFx0cmVzb3VyY2UgPSBVUkkuZmlsZShnZXRQYXRoRm9yRmlsZShlLmRhdGFUcmFuc2Zlci5maWxlc1swXSkhKTtcblx0XHR9XG5cblx0XHRpZiAoIXJlc291cmNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fdGVybWluYWxTZXJ2aWNlLnNldEFjdGl2ZUluc3RhbmNlKGluc3RhbmNlKTtcblxuXHRcdGluc3RhbmNlLmZvY3VzKCk7XG5cdFx0YXdhaXQgaW5zdGFuY2Uuc2VuZFBhdGgocmVzb3VyY2UsIGZhbHNlKTtcblx0fVxufVxuXG5jbGFzcyBUYWJEZWNvcmF0aW9uc1Byb3ZpZGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElEZWNvcmF0aW9uc1Byb3ZpZGVyIHtcblx0cmVhZG9ubHkgbGFiZWw6IHN0cmluZyA9IGxvY2FsaXplKCdsYWJlbCcsIFwiVGVybWluYWxcIik7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxVUklbXT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlID0gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElUZXJtaW5hbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxTZXJ2aWNlOiBJVGVybWluYWxTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGVybWluYWxTZXJ2aWNlLm9uQW55SW5zdGFuY2VQcmltYXJ5U3RhdHVzQ2hhbmdlKGUgPT4gdGhpcy5fb25EaWRDaGFuZ2UuZmlyZShbZS5yZXNvdXJjZV0pKSk7XG5cdH1cblxuXHRwcm92aWRlRGVjb3JhdGlvbnMocmVzb3VyY2U6IFVSSSk6IElEZWNvcmF0aW9uRGF0YSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHJlc291cmNlLnNjaGVtZSAhPT0gU2NoZW1hcy52c2NvZGVUZXJtaW5hbCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuX3Rlcm1pbmFsU2VydmljZS5nZXRJbnN0YW5jZUZyb21SZXNvdXJjZShyZXNvdXJjZSk7XG5cdFx0aWYgKCFpbnN0YW5jZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBwcmltYXJ5U3RhdHVzID0gaW5zdGFuY2U/LnN0YXR1c0xpc3Q/LnByaW1hcnk7XG5cdFx0aWYgKCFwcmltYXJ5U3RhdHVzPy5pY29uKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRjb2xvcjogZ2V0Q29sb3JGb3JTZXZlcml0eShwcmltYXJ5U3RhdHVzLnNldmVyaXR5KSxcblx0XHRcdGxldHRlcjogcHJpbWFyeVN0YXR1cy5pY29uLFxuXHRcdFx0dG9vbHRpcDogcHJpbWFyeVN0YXR1cy50b29sdGlwXG5cdFx0fTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGNBQWMscUJB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LGFBQWEsUUFBUSxjQUFjLFNBQVM7QUFDbkUsUUFBSSxjQUFjO0FBQ2pCLGlCQUFXLElBQUksTUFBTSxLQUFLLE1BQU0sWUFBWSxFQUFFLENBQUMsQ0FBQztBQUFBLElBQ2pEO0FBRUEsVUFBTSxlQUFlLEVBQUUsYUFBYSxRQUFRLGtCQUFrQixLQUFLO0FBQ25FLFFBQUksQ0FBQyxZQUFZLGNBQWM7QUFDOUIsaUJBQVcsSUFBSSxLQUFLLEtBQUssTUFBTSxZQUFZLEVBQUUsQ0FBQyxDQUFDO0FBQUEsSUFDaEQ7QUFFQSxRQUFJLENBQUMsWUFBWSxFQUFFLGFBQWEsTUFBTSxTQUFTLEtBQUssZUFBZSxFQUFFLGFBQWEsTUFBTSxDQUFDLENBQUMsR0FBRztBQUU1RixpQkFBVyxJQUFJLEtBQUssZUFBZSxFQUFFLGFBQWEsTUFBTSxDQUFDLENBQUMsQ0FBRTtBQUFBLElBQzdEO0FBRUEsUUFBSSxDQUFDLFVBQVU7QUFDZDtBQUFBLElBQ0Q7QUFFQSxTQUFLLGlCQUFpQixrQkFBa0IsUUFBUTtBQUVoRCxhQUFTLE1BQU07QUFDZixVQUFNLFNBQVMsU0FBUyxVQUFVLEtBQUs7QUFBQSxFQUN4QztBQUNEO0FBM0xNLDBCQUFOO0FBQUEsRUFNRztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FSRztBQTZMTixJQUFNLHlCQUFOLGNBQXFDLFdBQTJDO0FBQUEsRUFNL0UsWUFDb0Msa0JBQ2xDO0FBQ0QsVUFBTTtBQUY2QjtBQU5wQyxTQUFTLFFBQWdCLFNBQVMsU0FBUyxVQUFVO0FBRXJELFNBQWlCLGVBQWUsS0FBSyxVQUFVLElBQUksUUFBZSxDQUFDO0FBQ25FLFNBQVMsY0FBYyxLQUFLLGFBQWE7QUFNeEMsU0FBSyxVQUFVLEtBQUssaUJBQWlCLGlDQUFpQyxPQUFLLEtBQUssYUFBYSxLQUFLLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQUEsRUFDakg7QUFBQSxFQUVBLG1CQUFtQixVQUE0QztBQUM5RCxRQUFJLFNBQVMsV0FBVyxRQUFRLGdCQUFnQjtBQUMvQyxhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sV0FBVyxLQUFLLGlCQUFpQix3QkFBd0IsUUFBUTtBQUN2RSxRQUFJLENBQUMsVUFBVTtBQUNkLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxnQkFBZ0IsVUFBVSxZQUFZO0FBQzVDLFFBQUksQ0FBQyxlQUFlLE1BQU07QUFDekIsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPO0FBQUEsTUFDTixPQUFPLG9CQUFvQixjQUFjLFFBQVE7QUFBQSxNQUNqRCxRQUFRLGNBQWM7QUFBQSxNQUN0QixTQUFTLGNBQWM7QUFBQSxJQUN4QjtBQUFBLEVBQ0Q7QUFDRDtBQWxDTSx5QkFBTjtBQUFBLEVBT0c7QUFBQSxHQVBHOyIsCiAgIm5hbWVzIjogWyJUZXJtaW5hbFRhYnNMaXN0U2l6ZXMiLCAidmFsdWUiLCAidGFyZ2V0R3JvdXAiXQp9Cg==
