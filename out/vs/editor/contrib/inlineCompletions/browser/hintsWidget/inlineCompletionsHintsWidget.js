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
import { h, n } from "../../../../../base/browser/dom.js";
import { renderMarkdown } from "../../../../../base/browser/markdownRenderer.js";
import { ActionViewItem } from "../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { KeybindingLabel, unthemedKeybindingLabelOptions } from "../../../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { Action, Separator } from "../../../../../base/common/actions.js";
import { equals } from "../../../../../base/common/arrays.js";
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { createHotClass } from "../../../../../base/common/hotReloadHelpers.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, derived, derivedObservableWithCache, derivedWithStore, observableFromEvent } from "../../../../../base/common/observable.js";
import { OS } from "../../../../../base/common/platform.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { MenuEntryActionViewItem, getActionBarActions } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { WorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { IMenuService, MenuId, MenuItemAction } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { registerIcon } from "../../../../../platform/theme/common/iconRegistry.js";
import { ContentWidgetPositionPreference } from "../../../../browser/editorBrowser.js";
import { EditorOption } from "../../../../common/config/editorOptions.js";
import { Position } from "../../../../common/core/position.js";
import { InlineCompletionTriggerKind } from "../../../../common/languages.js";
import { PositionAffinity } from "../../../../common/model.js";
import { showNextInlineSuggestionActionId, showPreviousInlineSuggestionActionId } from "../controller/commandIds.js";
import "./inlineCompletionsHintsWidget.css";
let InlineCompletionsHintsWidget = class extends Disposable {
  constructor(editor, model, instantiationService) {
    super();
    this.editor = editor;
    this.model = model;
    this.instantiationService = instantiationService;
    this.alwaysShowToolbar = observableFromEvent(this, this.editor.onDidChangeConfiguration, () => this.editor.getOption(EditorOption.inlineSuggest).showToolbar === "always");
    this.sessionPosition = void 0;
    this.position = derived(this, (reader) => {
      const ghostText = this.model.read(reader)?.primaryGhostText.read(reader);
      if (!this.alwaysShowToolbar.read(reader) || !ghostText || ghostText.parts.length === 0) {
        this.sessionPosition = void 0;
        return null;
      }
      const firstColumn = ghostText.parts[0].column;
      if (this.sessionPosition && this.sessionPosition.lineNumber !== ghostText.lineNumber) {
        this.sessionPosition = void 0;
      }
      const position = new Position(ghostText.lineNumber, Math.min(firstColumn, this.sessionPosition?.column ?? Number.MAX_SAFE_INTEGER));
      this.sessionPosition = position;
      return position;
    });
    this._register(autorunWithStore((reader, store) => {
      const model2 = this.model.read(reader);
      if (!model2 || !this.alwaysShowToolbar.read(reader)) {
        return;
      }
      const contentWidgetValue = derivedWithStore((reader2, store2) => {
        const contentWidget = store2.add(this.instantiationService.createInstance(
          InlineSuggestionHintsContentWidget.hot.read(reader2),
          this.editor,
          true,
          this.position,
          model2.selectedInlineCompletionIndex,
          model2.inlineCompletionsCount,
          model2.activeCommands,
          model2.warning,
          () => {
          }
        ));
        editor.addContentWidget(contentWidget);
        store2.add(toDisposable(() => editor.removeContentWidget(contentWidget)));
        store2.add(autorun((reader3) => {
          const position = this.position.read(reader3);
          if (!position) {
            return;
          }
          if (model2.lastTriggerKind.read(reader3) !== InlineCompletionTriggerKind.Explicit) {
            model2.triggerExplicitly();
          }
        }));
        return contentWidget;
      });
      const hadPosition = derivedObservableWithCache(this, (reader2, lastValue) => !!this.position.read(reader2) || !!lastValue);
      store.add(autorun((reader2) => {
        if (hadPosition.read(reader2)) {
          contentWidgetValue.read(reader2);
        }
      }));
    }));
  }
};
InlineCompletionsHintsWidget = __decorateClass([
  __decorateParam(2, IInstantiationService)
], InlineCompletionsHintsWidget);
const inlineSuggestionHintsNextIcon = registerIcon("inline-suggestion-hints-next", Codicon.chevronRight, localize("parameterHintsNextIcon", "Icon for show next parameter hint."));
const inlineSuggestionHintsPreviousIcon = registerIcon("inline-suggestion-hints-previous", Codicon.chevronLeft, localize("parameterHintsPreviousIcon", "Icon for show previous parameter hint."));
let InlineSuggestionHintsContentWidget = class extends Disposable {
  constructor(editor, withBorder, _position, _currentSuggestionIdx, _suggestionCount, _extraCommands, _warning, _relayout, _commandService, instantiationService, keybindingService, _contextKeyService, _menuService) {
    super();
    this.editor = editor;
    this.withBorder = withBorder;
    this._position = _position;
    this._currentSuggestionIdx = _currentSuggestionIdx;
    this._suggestionCount = _suggestionCount;
    this._extraCommands = _extraCommands;
    this._warning = _warning;
    this._relayout = _relayout;
    this._commandService = _commandService;
    this.keybindingService = keybindingService;
    this._contextKeyService = _contextKeyService;
    this._menuService = _menuService;
    this.id = `InlineSuggestionHintsContentWidget${InlineSuggestionHintsContentWidget.id++}`;
    this.allowEditorOverflow = true;
    this.suppressMouseDown = false;
    this._warningMessageContentNode = derivedWithStore((reader, store) => {
      const warning = this._warning.read(reader);
      if (!warning) {
        return void 0;
      }
      if (typeof warning.message === "string") {
        return warning.message;
      }
      const markdownElement = store.add(renderMarkdown(warning.message));
      return markdownElement.element;
    });
    this._warningMessageNode = n.div({
      class: "warningMessage",
      style: {
        maxWidth: 400,
        margin: 4,
        marginBottom: 4,
        display: derived((reader) => this._warning.read(reader) ? "block" : "none")
      }
    }, [
      this._warningMessageContentNode
    ]).keepUpdated(this._store);
    this.nodes = h("div.inlineSuggestionsHints", { className: this.withBorder ? "monaco-hover monaco-hover-content" : "" }, [
      this._warningMessageNode.element,
      h("div@toolBar")
    ]);
    this.previousAction = this._register(this.createCommandAction(showPreviousInlineSuggestionActionId, localize("previous", "Previous"), ThemeIcon.asClassName(inlineSuggestionHintsPreviousIcon)));
    this.availableSuggestionCountAction = this._register(new Action("inlineSuggestionHints.availableSuggestionCount", "", void 0, false));
    this.nextAction = this._register(this.createCommandAction(showNextInlineSuggestionActionId, localize("next", "Next"), ThemeIcon.asClassName(inlineSuggestionHintsNextIcon)));
    // TODO@hediet: deprecate MenuId.InlineCompletionsActions
    this.inlineCompletionsActionsMenus = this._register(this._menuService.createMenu(
      MenuId.InlineCompletionsActions,
      this._contextKeyService
    ));
    this.clearAvailableSuggestionCountLabelDebounced = this._register(new RunOnceScheduler(() => {
      this.availableSuggestionCountAction.label = "";
    }, 100));
    this.disableButtonsDebounced = this._register(new RunOnceScheduler(() => {
      this.previousAction.enabled = this.nextAction.enabled = false;
    }, 100));
    this._register(autorun((reader) => {
      this._warningMessageContentNode.read(reader);
      this._warningMessageNode.readEffect(reader);
      this._relayout();
    }));
    this.toolBar = this._register(instantiationService.createInstance(CustomizedMenuWorkbenchToolBar, this.nodes.toolBar, MenuId.InlineSuggestionToolbar, {
      menuOptions: { renderShortTitle: true },
      toolbarOptions: { primaryGroup: (g) => g.startsWith("primary") },
      actionViewItemProvider: (action, options) => {
        if (action instanceof MenuItemAction) {
          return instantiationService.createInstance(StatusBarViewItem, action, void 0);
        }
        if (action === this.availableSuggestionCountAction) {
          const a = new ActionViewItemWithClassName(void 0, action, { label: true, icon: false });
          a.setClass("availableSuggestionCount");
          return a;
        }
        return void 0;
      },
      telemetrySource: "InlineSuggestionToolbar"
    }));
    this.toolBar.setPrependedPrimaryActions([
      this.previousAction,
      this.availableSuggestionCountAction,
      this.nextAction
    ]);
    this._register(this.toolBar.onDidChangeDropdownVisibility((e) => {
      InlineSuggestionHintsContentWidget._dropDownVisible = e;
    }));
    this._register(autorun((reader) => {
      this._position.read(reader);
      this.editor.layoutContentWidget(this);
    }));
    this._register(autorun((reader) => {
      const suggestionCount = this._suggestionCount.read(reader);
      const currentSuggestionIdx = this._currentSuggestionIdx.read(reader);
      if (suggestionCount !== void 0) {
        this.clearAvailableSuggestionCountLabelDebounced.cancel();
        this.availableSuggestionCountAction.label = `${currentSuggestionIdx + 1}/${suggestionCount}`;
      } else {
        this.clearAvailableSuggestionCountLabelDebounced.schedule();
      }
      if (suggestionCount !== void 0 && suggestionCount > 1) {
        this.disableButtonsDebounced.cancel();
        this.previousAction.enabled = this.nextAction.enabled = true;
      } else {
        this.disableButtonsDebounced.schedule();
      }
    }));
    this._register(autorun((reader) => {
      const extraCommands = this._extraCommands.read(reader);
      const extraActions = extraCommands.map((c) => ({
        class: void 0,
        id: c.id,
        enabled: true,
        tooltip: c.tooltip || "",
        label: c.title,
        run: (event) => {
          return this._commandService.executeCommand(c.id);
        }
      }));
      for (const [_, group] of this.inlineCompletionsActionsMenus.getActions()) {
        for (const action of group) {
          if (action instanceof MenuItemAction) {
            extraActions.push(action);
          }
        }
      }
      if (extraActions.length > 0) {
        extraActions.unshift(new Separator());
      }
      this.toolBar.setAdditionalSecondaryActions(extraActions);
    }));
  }
  static get dropDownVisible() {
    return this._dropDownVisible;
  }
  createCommandAction(commandId, label, iconClassName) {
    const action = new Action(
      commandId,
      label,
      iconClassName,
      true,
      () => this._commandService.executeCommand(commandId)
    );
    const kb = this.keybindingService.lookupKeybinding(commandId, this._contextKeyService);
    let tooltip = label;
    if (kb) {
      tooltip = localize({ key: "content", comment: ["A label", "A keybinding"] }, "{0} ({1})", label, kb.getLabel());
    }
    action.tooltip = tooltip;
    return action;
  }
  getId() {
    return this.id;
  }
  getDomNode() {
    return this.nodes.root;
  }
  getPosition() {
    return {
      position: this._position.get(),
      preference: [ContentWidgetPositionPreference.ABOVE, ContentWidgetPositionPreference.BELOW],
      positionAffinity: PositionAffinity.LeftOfInjectedText
    };
  }
};
InlineSuggestionHintsContentWidget.hot = createHotClass(InlineSuggestionHintsContentWidget);
InlineSuggestionHintsContentWidget._dropDownVisible = false;
InlineSuggestionHintsContentWidget.id = 0;
InlineSuggestionHintsContentWidget = __decorateClass([
  __decorateParam(8, ICommandService),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, IKeybindingService),
  __decorateParam(11, IContextKeyService),
  __decorateParam(12, IMenuService)
], InlineSuggestionHintsContentWidget);
class ActionViewItemWithClassName extends ActionViewItem {
  constructor() {
    super(...arguments);
    this._className = void 0;
  }
  setClass(className) {
    this._className = className;
  }
  render(container) {
    super.render(container);
    if (this._className) {
      container.classList.add(this._className);
    }
  }
  updateTooltip() {
  }
}
class StatusBarViewItem extends MenuEntryActionViewItem {
  updateLabel() {
    const kb = this._keybindingService.lookupKeybinding(this._action.id, this._contextKeyService, true);
    if (!kb) {
      return super.updateLabel();
    }
    if (this.label) {
      const div = h("div.keybinding").root;
      const k = this._register(new KeybindingLabel(div, OS, { disableTitle: true, ...unthemedKeybindingLabelOptions }));
      k.set(kb);
      this.label.textContent = this._action.label;
      this.label.appendChild(div);
      this.label.classList.add("inlineSuggestionStatusBarItemLabel");
    }
  }
  updateTooltip() {
  }
}
let CustomizedMenuWorkbenchToolBar = class extends WorkbenchToolBar {
  constructor(container, menuId, options2, menuService, contextKeyService, contextMenuService, keybindingService, commandService, telemetryService) {
    super(container, { resetMenu: menuId, ...options2 }, menuService, contextKeyService, contextMenuService, keybindingService, commandService, telemetryService);
    this.menuId = menuId;
    this.options2 = options2;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.menu = this._store.add(this.menuService.createMenu(this.menuId, this.contextKeyService, { emitEventsForSubmenuChanges: true }));
    this.additionalActions = [];
    this.prependedPrimaryActions = [];
    this.additionalPrimaryActions = [];
    this._store.add(this.menu.onDidChange(() => this.updateToolbar()));
    this.updateToolbar();
  }
  updateToolbar() {
    const { primary, secondary } = getActionBarActions(
      this.menu.getActions(this.options2?.menuOptions),
      this.options2?.toolbarOptions?.primaryGroup,
      this.options2?.toolbarOptions?.shouldInlineSubmenu,
      this.options2?.toolbarOptions?.useSeparatorsInPrimaryActions
    );
    secondary.push(...this.additionalActions);
    primary.unshift(...this.prependedPrimaryActions);
    primary.push(...this.additionalPrimaryActions);
    this.setActions(primary, secondary);
  }
  setPrependedPrimaryActions(actions) {
    if (equals(this.prependedPrimaryActions, actions, (a, b) => a === b)) {
      return;
    }
    this.prependedPrimaryActions = actions;
    this.updateToolbar();
  }
  setAdditionalPrimaryActions(actions) {
    if (equals(this.additionalPrimaryActions, actions, (a, b) => a === b)) {
      return;
    }
    this.additionalPrimaryActions = actions;
    this.updateToolbar();
  }
  setAdditionalSecondaryActions(actions) {
    if (equals(this.additionalActions, actions, (a, b) => a === b)) {
      return;
    }
    this.additionalActions = actions;
    this.updateToolbar();
  }
};
CustomizedMenuWorkbenchToolBar = __decorateClass([
  __decorateParam(3, IMenuService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, ITelemetryService)
], CustomizedMenuWorkbenchToolBar);
export {
  CustomizedMenuWorkbenchToolBar,
  InlineCompletionsHintsWidget,
  InlineSuggestionHintsContentWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL2hpbnRzV2lkZ2V0L2lubGluZUNvbXBsZXRpb25zSGludHNXaWRnZXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBoLCBuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyByZW5kZXJNYXJrZG93biB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tYXJrZG93blJlbmRlcmVyLmpzJztcbmltcG9ydCB7IEFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25WaWV3SXRlbXMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ0xhYmVsLCB1bnRoZW1lZEtleWJpbmRpbmdMYWJlbE9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkva2V5YmluZGluZ0xhYmVsL2tleWJpbmRpbmdMYWJlbC5qcyc7XG5pbXBvcnQgeyBBY3Rpb24sIElBY3Rpb24sIFNlcGFyYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgY3JlYXRlSG90Q2xhc3MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ob3RSZWxvYWRIZWxwZXJzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJT2JzZXJ2YWJsZSwgYXV0b3J1biwgYXV0b3J1bldpdGhTdG9yZSwgZGVyaXZlZCwgZGVyaXZlZE9ic2VydmFibGVXaXRoQ2FjaGUsIGRlcml2ZWRXaXRoU3RvcmUsIG9ic2VydmFibGVGcm9tRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IE9TIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtLCBnZXRBY3Rpb25CYXJBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IElNZW51V29ya2JlbmNoVG9vbEJhck9wdGlvbnMsIFdvcmtiZW5jaFRvb2xCYXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBJTWVudVNlcnZpY2UsIE1lbnVJZCwgTWVudUl0ZW1BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IHJlZ2lzdGVySWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZSwgSUNvZGVFZGl0b3IsIElDb250ZW50V2lkZ2V0LCBJQ29udGVudFdpZGdldFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IENvbW1hbmQsIElubGluZUNvbXBsZXRpb25UcmlnZ2VyS2luZCwgSW5saW5lQ29tcGxldGlvbldhcm5pbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uQWZmaW5pdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgc2hvd05leHRJbmxpbmVTdWdnZXN0aW9uQWN0aW9uSWQsIHNob3dQcmV2aW91c0lubGluZVN1Z2dlc3Rpb25BY3Rpb25JZCB9IGZyb20gJy4uL2NvbnRyb2xsZXIvY29tbWFuZElkcy5qcyc7XG5pbXBvcnQgeyBJbmxpbmVDb21wbGV0aW9uc01vZGVsIH0gZnJvbSAnLi4vbW9kZWwvaW5saW5lQ29tcGxldGlvbnNNb2RlbC5qcyc7XG5pbXBvcnQgJy4vaW5saW5lQ29tcGxldGlvbnNIaW50c1dpZGdldC5jc3MnO1xuXG5leHBvcnQgY2xhc3MgSW5saW5lQ29tcGxldGlvbnNIaW50c1dpZGdldCBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IGFsd2F5c1Nob3dUb29sYmFyID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLCB0aGlzLmVkaXRvci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24sICgpID0+IHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uaW5saW5lU3VnZ2VzdCkuc2hvd1Rvb2xiYXIgPT09ICdhbHdheXMnKTtcblxuXHRwcml2YXRlIHNlc3Npb25Qb3NpdGlvbjogUG9zaXRpb24gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBwb3NpdGlvbiA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRjb25zdCBnaG9zdFRleHQgPSB0aGlzLm1vZGVsLnJlYWQocmVhZGVyKT8ucHJpbWFyeUdob3N0VGV4dC5yZWFkKHJlYWRlcik7XG5cblx0XHRpZiAoIXRoaXMuYWx3YXlzU2hvd1Rvb2xiYXIucmVhZChyZWFkZXIpIHx8ICFnaG9zdFRleHQgfHwgZ2hvc3RUZXh0LnBhcnRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5zZXNzaW9uUG9zaXRpb24gPSB1bmRlZmluZWQ7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBmaXJzdENvbHVtbiA9IGdob3N0VGV4dC5wYXJ0c1swXS5jb2x1bW47XG5cdFx0aWYgKHRoaXMuc2Vzc2lvblBvc2l0aW9uICYmIHRoaXMuc2Vzc2lvblBvc2l0aW9uLmxpbmVOdW1iZXIgIT09IGdob3N0VGV4dC5saW5lTnVtYmVyKSB7XG5cdFx0XHR0aGlzLnNlc3Npb25Qb3NpdGlvbiA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBwb3NpdGlvbiA9IG5ldyBQb3NpdGlvbihnaG9zdFRleHQubGluZU51bWJlciwgTWF0aC5taW4oZmlyc3RDb2x1bW4sIHRoaXMuc2Vzc2lvblBvc2l0aW9uPy5jb2x1bW4gPz8gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpKTtcblx0XHR0aGlzLnNlc3Npb25Qb3NpdGlvbiA9IHBvc2l0aW9uO1xuXHRcdHJldHVybiBwb3NpdGlvbjtcblx0fSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbW9kZWw6IElPYnNlcnZhYmxlPElubGluZUNvbXBsZXRpb25zTW9kZWwgfCB1bmRlZmluZWQ+LFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bldpdGhTdG9yZSgocmVhZGVyLCBzdG9yZSkgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBzZXR1cCBjb250ZW50IHdpZGdldCAqL1xuXHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLm1vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghbW9kZWwgfHwgIXRoaXMuYWx3YXlzU2hvd1Rvb2xiYXIucmVhZChyZWFkZXIpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY29udGVudFdpZGdldFZhbHVlID0gZGVyaXZlZFdpdGhTdG9yZSgocmVhZGVyLCBzdG9yZSkgPT4ge1xuXHRcdFx0XHRjb25zdCBjb250ZW50V2lkZ2V0ID0gc3RvcmUuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRcdFx0SW5saW5lU3VnZ2VzdGlvbkhpbnRzQ29udGVudFdpZGdldC5ob3QucmVhZChyZWFkZXIpLFxuXHRcdFx0XHRcdHRoaXMuZWRpdG9yLFxuXHRcdFx0XHRcdHRydWUsXG5cdFx0XHRcdFx0dGhpcy5wb3NpdGlvbixcblx0XHRcdFx0XHRtb2RlbC5zZWxlY3RlZElubGluZUNvbXBsZXRpb25JbmRleCxcblx0XHRcdFx0XHRtb2RlbC5pbmxpbmVDb21wbGV0aW9uc0NvdW50LFxuXHRcdFx0XHRcdG1vZGVsLmFjdGl2ZUNvbW1hbmRzLFxuXHRcdFx0XHRcdG1vZGVsLndhcm5pbmcsXG5cdFx0XHRcdFx0KCkgPT4geyB9LFxuXHRcdFx0XHQpKTtcblx0XHRcdFx0ZWRpdG9yLmFkZENvbnRlbnRXaWRnZXQoY29udGVudFdpZGdldCk7XG5cdFx0XHRcdHN0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gZWRpdG9yLnJlbW92ZUNvbnRlbnRXaWRnZXQoY29udGVudFdpZGdldCkpKTtcblxuXHRcdFx0XHRzdG9yZS5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gcmVxdWVzdCBleHBsaWNpdCAqL1xuXHRcdFx0XHRcdGNvbnN0IHBvc2l0aW9uID0gdGhpcy5wb3NpdGlvbi5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdFx0aWYgKCFwb3NpdGlvbikge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAobW9kZWwubGFzdFRyaWdnZXJLaW5kLnJlYWQocmVhZGVyKSAhPT0gSW5saW5lQ29tcGxldGlvblRyaWdnZXJLaW5kLkV4cGxpY2l0KSB7XG5cdFx0XHRcdFx0XHRtb2RlbC50cmlnZ2VyRXhwbGljaXRseSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRyZXR1cm4gY29udGVudFdpZGdldDtcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBoYWRQb3NpdGlvbiA9IGRlcml2ZWRPYnNlcnZhYmxlV2l0aENhY2hlKHRoaXMsIChyZWFkZXIsIGxhc3RWYWx1ZSkgPT4gISF0aGlzLnBvc2l0aW9uLnJlYWQocmVhZGVyKSB8fCAhIWxhc3RWYWx1ZSk7XG5cdFx0XHRzdG9yZS5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHRpZiAoaGFkUG9zaXRpb24ucmVhZChyZWFkZXIpKSB7XG5cdFx0XHRcdFx0Y29udGVudFdpZGdldFZhbHVlLnJlYWQocmVhZGVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0pKTtcblx0fVxufVxuXG5jb25zdCBpbmxpbmVTdWdnZXN0aW9uSGludHNOZXh0SWNvbiA9IHJlZ2lzdGVySWNvbignaW5saW5lLXN1Z2dlc3Rpb24taGludHMtbmV4dCcsIENvZGljb24uY2hldnJvblJpZ2h0LCBsb2NhbGl6ZSgncGFyYW1ldGVySGludHNOZXh0SWNvbicsICdJY29uIGZvciBzaG93IG5leHQgcGFyYW1ldGVyIGhpbnQuJykpO1xuY29uc3QgaW5saW5lU3VnZ2VzdGlvbkhpbnRzUHJldmlvdXNJY29uID0gcmVnaXN0ZXJJY29uKCdpbmxpbmUtc3VnZ2VzdGlvbi1oaW50cy1wcmV2aW91cycsIENvZGljb24uY2hldnJvbkxlZnQsIGxvY2FsaXplKCdwYXJhbWV0ZXJIaW50c1ByZXZpb3VzSWNvbicsICdJY29uIGZvciBzaG93IHByZXZpb3VzIHBhcmFtZXRlciBoaW50LicpKTtcblxuZXhwb3J0IGNsYXNzIElubGluZVN1Z2dlc3Rpb25IaW50c0NvbnRlbnRXaWRnZXQgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNvbnRlbnRXaWRnZXQge1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGhvdCA9IGNyZWF0ZUhvdENsYXNzKElubGluZVN1Z2dlc3Rpb25IaW50c0NvbnRlbnRXaWRnZXQpO1xuXG5cdHByaXZhdGUgc3RhdGljIF9kcm9wRG93blZpc2libGUgPSBmYWxzZTtcblx0cHVibGljIHN0YXRpYyBnZXQgZHJvcERvd25WaXNpYmxlKCkgeyByZXR1cm4gdGhpcy5fZHJvcERvd25WaXNpYmxlOyB9XG5cblx0cHJpdmF0ZSBzdGF0aWMgaWQgPSAwO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgaWQgPSBgSW5saW5lU3VnZ2VzdGlvbkhpbnRzQ29udGVudFdpZGdldCR7SW5saW5lU3VnZ2VzdGlvbkhpbnRzQ29udGVudFdpZGdldC5pZCsrfWA7XG5cdHB1YmxpYyByZWFkb25seSBhbGxvd0VkaXRvck92ZXJmbG93ID0gdHJ1ZTtcblx0cHVibGljIHJlYWRvbmx5IHN1cHByZXNzTW91c2VEb3duID0gZmFsc2U7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfd2FybmluZ01lc3NhZ2VDb250ZW50Tm9kZSA9IGRlcml2ZWRXaXRoU3RvcmUoKHJlYWRlciwgc3RvcmUpID0+IHtcblx0XHRjb25zdCB3YXJuaW5nID0gdGhpcy5fd2FybmluZy5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCF3YXJuaW5nKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIHdhcm5pbmcubWVzc2FnZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiB3YXJuaW5nLm1lc3NhZ2U7XG5cdFx0fVxuXHRcdGNvbnN0IG1hcmtkb3duRWxlbWVudCA9IHN0b3JlLmFkZChyZW5kZXJNYXJrZG93bih3YXJuaW5nLm1lc3NhZ2UpKTtcblx0XHRyZXR1cm4gbWFya2Rvd25FbGVtZW50LmVsZW1lbnQ7XG5cdH0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3dhcm5pbmdNZXNzYWdlTm9kZSA9IG4uZGl2KHtcblx0XHRjbGFzczogJ3dhcm5pbmdNZXNzYWdlJyxcblx0XHRzdHlsZToge1xuXHRcdFx0bWF4V2lkdGg6IDQwMCxcblx0XHRcdG1hcmdpbjogNCxcblx0XHRcdG1hcmdpbkJvdHRvbTogNCxcblx0XHRcdGRpc3BsYXk6IGRlcml2ZWQocmVhZGVyID0+IHRoaXMuX3dhcm5pbmcucmVhZChyZWFkZXIpID8gJ2Jsb2NrJyA6ICdub25lJyksXG5cdFx0fVxuXHR9LCBbXG5cdFx0dGhpcy5fd2FybmluZ01lc3NhZ2VDb250ZW50Tm9kZSxcblx0XSkua2VlcFVwZGF0ZWQodGhpcy5fc3RvcmUpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbm9kZXMgPSBoKCdkaXYuaW5saW5lU3VnZ2VzdGlvbnNIaW50cycsIHsgY2xhc3NOYW1lOiB0aGlzLndpdGhCb3JkZXIgPyAnbW9uYWNvLWhvdmVyIG1vbmFjby1ob3Zlci1jb250ZW50JyA6ICcnIH0sIFtcblx0XHR0aGlzLl93YXJuaW5nTWVzc2FnZU5vZGUuZWxlbWVudCxcblx0XHRoKCdkaXZAdG9vbEJhcicpLFxuXHRdKTtcblxuXHRwcml2YXRlIGNyZWF0ZUNvbW1hbmRBY3Rpb24oY29tbWFuZElkOiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcsIGljb25DbGFzc05hbWU6IHN0cmluZyk6IEFjdGlvbiB7XG5cdFx0Y29uc3QgYWN0aW9uID0gbmV3IEFjdGlvbihcblx0XHRcdGNvbW1hbmRJZCxcblx0XHRcdGxhYmVsLFxuXHRcdFx0aWNvbkNsYXNzTmFtZSxcblx0XHRcdHRydWUsXG5cdFx0XHQoKSA9PiB0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChjb21tYW5kSWQpLFxuXHRcdCk7XG5cdFx0Y29uc3Qga2IgPSB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoY29tbWFuZElkLCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0bGV0IHRvb2x0aXAgPSBsYWJlbDtcblx0XHRpZiAoa2IpIHtcblx0XHRcdHRvb2x0aXAgPSBsb2NhbGl6ZSh7IGtleTogJ2NvbnRlbnQnLCBjb21tZW50OiBbJ0EgbGFiZWwnLCAnQSBrZXliaW5kaW5nJ10gfSwgJ3swfSAoezF9KScsIGxhYmVsLCBrYi5nZXRMYWJlbCgpKTtcblx0XHR9XG5cdFx0YWN0aW9uLnRvb2x0aXAgPSB0b29sdGlwO1xuXHRcdHJldHVybiBhY3Rpb247XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IHByZXZpb3VzQWN0aW9uID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5jcmVhdGVDb21tYW5kQWN0aW9uKHNob3dQcmV2aW91c0lubGluZVN1Z2dlc3Rpb25BY3Rpb25JZCwgbG9jYWxpemUoJ3ByZXZpb3VzJywgJ1ByZXZpb3VzJyksIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShpbmxpbmVTdWdnZXN0aW9uSGludHNQcmV2aW91c0ljb24pKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgYXZhaWxhYmxlU3VnZ2VzdGlvbkNvdW50QWN0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEFjdGlvbignaW5saW5lU3VnZ2VzdGlvbkhpbnRzLmF2YWlsYWJsZVN1Z2dlc3Rpb25Db3VudCcsICcnLCB1bmRlZmluZWQsIGZhbHNlKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgbmV4dEFjdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuY3JlYXRlQ29tbWFuZEFjdGlvbihzaG93TmV4dElubGluZVN1Z2dlc3Rpb25BY3Rpb25JZCwgbG9jYWxpemUoJ25leHQnLCAnTmV4dCcpLCBUaGVtZUljb24uYXNDbGFzc05hbWUoaW5saW5lU3VnZ2VzdGlvbkhpbnRzTmV4dEljb24pKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSB0b29sQmFyOiBDdXN0b21pemVkTWVudVdvcmtiZW5jaFRvb2xCYXI7XG5cblx0Ly8gVE9ET0BoZWRpZXQ6IGRlcHJlY2F0ZSBNZW51SWQuSW5saW5lQ29tcGxldGlvbnNBY3Rpb25zXG5cdHByaXZhdGUgcmVhZG9ubHkgaW5saW5lQ29tcGxldGlvbnNBY3Rpb25zTWVudXMgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9tZW51U2VydmljZS5jcmVhdGVNZW51KFxuXHRcdE1lbnVJZC5JbmxpbmVDb21wbGV0aW9uc0FjdGlvbnMsXG5cdFx0dGhpcy5fY29udGV4dEtleVNlcnZpY2Vcblx0KSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBjbGVhckF2YWlsYWJsZVN1Z2dlc3Rpb25Db3VudExhYmVsRGVib3VuY2VkID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4ge1xuXHRcdHRoaXMuYXZhaWxhYmxlU3VnZ2VzdGlvbkNvdW50QWN0aW9uLmxhYmVsID0gJyc7XG5cdH0sIDEwMCkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzYWJsZUJ1dHRvbnNEZWJvdW5jZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0dGhpcy5wcmV2aW91c0FjdGlvbi5lbmFibGVkID0gdGhpcy5uZXh0QWN0aW9uLmVuYWJsZWQgPSBmYWxzZTtcblx0fSwgMTAwKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgd2l0aEJvcmRlcjogYm9vbGVhbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wb3NpdGlvbjogSU9ic2VydmFibGU8UG9zaXRpb24gfCBudWxsPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jdXJyZW50U3VnZ2VzdGlvbklkeDogSU9ic2VydmFibGU8bnVtYmVyPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9zdWdnZXN0aW9uQ291bnQ6IElPYnNlcnZhYmxlPG51bWJlciB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZXh0cmFDb21tYW5kczogSU9ic2VydmFibGU8Q29tbWFuZFtdPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF93YXJuaW5nOiBJT2JzZXJ2YWJsZTxJbmxpbmVDb21wbGV0aW9uV2FybmluZyB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcmVsYXlvdXQ6ICgpID0+IHZvaWQsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0dGhpcy5fd2FybmluZ01lc3NhZ2VDb250ZW50Tm9kZS5yZWFkKHJlYWRlcik7XG5cdFx0XHR0aGlzLl93YXJuaW5nTWVzc2FnZU5vZGUucmVhZEVmZmVjdChyZWFkZXIpO1xuXHRcdFx0Ly8gT25seSB1cGRhdGUgYWZ0ZXIgdGhlIHdhcm5pbmcgbWVzc2FnZSBub2RlIGhhcyBiZWVuIHJlbmRlcmVkXG5cdFx0XHR0aGlzLl9yZWxheW91dCgpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMudG9vbEJhciA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEN1c3RvbWl6ZWRNZW51V29ya2JlbmNoVG9vbEJhciwgdGhpcy5ub2Rlcy50b29sQmFyLCBNZW51SWQuSW5saW5lU3VnZ2VzdGlvblRvb2xiYXIsIHtcblx0XHRcdG1lbnVPcHRpb25zOiB7IHJlbmRlclNob3J0VGl0bGU6IHRydWUgfSxcblx0XHRcdHRvb2xiYXJPcHRpb25zOiB7IHByaW1hcnlHcm91cDogZyA9PiBnLnN0YXJ0c1dpdGgoJ3ByaW1hcnknKSB9LFxuXHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogKGFjdGlvbiwgb3B0aW9ucykgPT4ge1xuXHRcdFx0XHRpZiAoYWN0aW9uIGluc3RhbmNlb2YgTWVudUl0ZW1BY3Rpb24pIHtcblx0XHRcdFx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU3RhdHVzQmFyVmlld0l0ZW0sIGFjdGlvbiwgdW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoYWN0aW9uID09PSB0aGlzLmF2YWlsYWJsZVN1Z2dlc3Rpb25Db3VudEFjdGlvbikge1xuXHRcdFx0XHRcdGNvbnN0IGEgPSBuZXcgQWN0aW9uVmlld0l0ZW1XaXRoQ2xhc3NOYW1lKHVuZGVmaW5lZCwgYWN0aW9uLCB7IGxhYmVsOiB0cnVlLCBpY29uOiBmYWxzZSB9KTtcblx0XHRcdFx0XHRhLnNldENsYXNzKCdhdmFpbGFibGVTdWdnZXN0aW9uQ291bnQnKTtcblx0XHRcdFx0XHRyZXR1cm4gYTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblx0XHRcdHRlbGVtZXRyeVNvdXJjZTogJ0lubGluZVN1Z2dlc3Rpb25Ub29sYmFyJyxcblx0XHR9KSk7XG5cblx0XHR0aGlzLnRvb2xCYXIuc2V0UHJlcGVuZGVkUHJpbWFyeUFjdGlvbnMoW1xuXHRcdFx0dGhpcy5wcmV2aW91c0FjdGlvbixcblx0XHRcdHRoaXMuYXZhaWxhYmxlU3VnZ2VzdGlvbkNvdW50QWN0aW9uLFxuXHRcdFx0dGhpcy5uZXh0QWN0aW9uLFxuXHRcdF0pO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50b29sQmFyLm9uRGlkQ2hhbmdlRHJvcGRvd25WaXNpYmlsaXR5KGUgPT4ge1xuXHRcdFx0SW5saW5lU3VnZ2VzdGlvbkhpbnRzQ29udGVudFdpZGdldC5fZHJvcERvd25WaXNpYmxlID0gZTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIHVwZGF0ZSBwb3NpdGlvbiAqL1xuXHRcdFx0dGhpcy5fcG9zaXRpb24ucmVhZChyZWFkZXIpO1xuXHRcdFx0dGhpcy5lZGl0b3IubGF5b3V0Q29udGVudFdpZGdldCh0aGlzKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIGNvdW50cyAqL1xuXHRcdFx0Y29uc3Qgc3VnZ2VzdGlvbkNvdW50ID0gdGhpcy5fc3VnZ2VzdGlvbkNvdW50LnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IGN1cnJlbnRTdWdnZXN0aW9uSWR4ID0gdGhpcy5fY3VycmVudFN1Z2dlc3Rpb25JZHgucmVhZChyZWFkZXIpO1xuXG5cdFx0XHRpZiAoc3VnZ2VzdGlvbkNvdW50ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5jbGVhckF2YWlsYWJsZVN1Z2dlc3Rpb25Db3VudExhYmVsRGVib3VuY2VkLmNhbmNlbCgpO1xuXHRcdFx0XHR0aGlzLmF2YWlsYWJsZVN1Z2dlc3Rpb25Db3VudEFjdGlvbi5sYWJlbCA9IGAke2N1cnJlbnRTdWdnZXN0aW9uSWR4ICsgMX0vJHtzdWdnZXN0aW9uQ291bnR9YDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuY2xlYXJBdmFpbGFibGVTdWdnZXN0aW9uQ291bnRMYWJlbERlYm91bmNlZC5zY2hlZHVsZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc3VnZ2VzdGlvbkNvdW50ICE9PSB1bmRlZmluZWQgJiYgc3VnZ2VzdGlvbkNvdW50ID4gMSkge1xuXHRcdFx0XHR0aGlzLmRpc2FibGVCdXR0b25zRGVib3VuY2VkLmNhbmNlbCgpO1xuXHRcdFx0XHR0aGlzLnByZXZpb3VzQWN0aW9uLmVuYWJsZWQgPSB0aGlzLm5leHRBY3Rpb24uZW5hYmxlZCA9IHRydWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmRpc2FibGVCdXR0b25zRGVib3VuY2VkLnNjaGVkdWxlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBleHRyYSBjb21tYW5kcyAqL1xuXHRcdFx0Y29uc3QgZXh0cmFDb21tYW5kcyA9IHRoaXMuX2V4dHJhQ29tbWFuZHMucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgZXh0cmFBY3Rpb25zID0gZXh0cmFDb21tYW5kcy5tYXA8SUFjdGlvbj4oYyA9PiAoe1xuXHRcdFx0XHRjbGFzczogdW5kZWZpbmVkLFxuXHRcdFx0XHRpZDogYy5pZCxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0dG9vbHRpcDogYy50b29sdGlwIHx8ICcnLFxuXHRcdFx0XHRsYWJlbDogYy50aXRsZSxcblx0XHRcdFx0cnVuOiAoZXZlbnQpID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoYy5pZCk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9KSk7XG5cblx0XHRcdGZvciAoY29uc3QgW18sIGdyb3VwXSBvZiB0aGlzLmlubGluZUNvbXBsZXRpb25zQWN0aW9uc01lbnVzLmdldEFjdGlvbnMoKSkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGFjdGlvbiBvZiBncm91cCkge1xuXHRcdFx0XHRcdGlmIChhY3Rpb24gaW5zdGFuY2VvZiBNZW51SXRlbUFjdGlvbikge1xuXHRcdFx0XHRcdFx0ZXh0cmFBY3Rpb25zLnB1c2goYWN0aW9uKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGV4dHJhQWN0aW9ucy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGV4dHJhQWN0aW9ucy51bnNoaWZ0KG5ldyBTZXBhcmF0b3IoKSk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudG9vbEJhci5zZXRBZGRpdGlvbmFsU2Vjb25kYXJ5QWN0aW9ucyhleHRyYUFjdGlvbnMpO1xuXHRcdH0pKTtcblx0fVxuXG5cdGdldElkKCk6IHN0cmluZyB7IHJldHVybiB0aGlzLmlkOyB9XG5cblx0Z2V0RG9tTm9kZSgpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMubm9kZXMucm9vdDtcblx0fVxuXG5cdGdldFBvc2l0aW9uKCk6IElDb250ZW50V2lkZ2V0UG9zaXRpb24gfCBudWxsIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cG9zaXRpb246IHRoaXMuX3Bvc2l0aW9uLmdldCgpLFxuXHRcdFx0cHJlZmVyZW5jZTogW0NvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuQUJPVkUsIENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuQkVMT1ddLFxuXHRcdFx0cG9zaXRpb25BZmZpbml0eTogUG9zaXRpb25BZmZpbml0eS5MZWZ0T2ZJbmplY3RlZFRleHQsXG5cdFx0fTtcblx0fVxufVxuXG5jbGFzcyBBY3Rpb25WaWV3SXRlbVdpdGhDbGFzc05hbWUgZXh0ZW5kcyBBY3Rpb25WaWV3SXRlbSB7XG5cdHByaXZhdGUgX2NsYXNzTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHNldENsYXNzKGNsYXNzTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5fY2xhc3NOYW1lID0gY2xhc3NOYW1lO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXIoY29udGFpbmVyKTtcblx0XHRpZiAodGhpcy5fY2xhc3NOYW1lKSB7XG5cdFx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCh0aGlzLl9jbGFzc05hbWUpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGVUb29sdGlwKCk6IHZvaWQge1xuXHRcdC8vIE5PT1AsIGRpc2FibGUgdG9vbHRpcFxuXHR9XG59XG5cbmNsYXNzIFN0YXR1c0JhclZpZXdJdGVtIGV4dGVuZHMgTWVudUVudHJ5QWN0aW9uVmlld0l0ZW0ge1xuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdXBkYXRlTGFiZWwoKSB7XG5cdFx0Y29uc3Qga2IgPSB0aGlzLl9rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKHRoaXMuX2FjdGlvbi5pZCwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UsIHRydWUpO1xuXHRcdGlmICgha2IpIHtcblx0XHRcdHJldHVybiBzdXBlci51cGRhdGVMYWJlbCgpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5sYWJlbCkge1xuXHRcdFx0Y29uc3QgZGl2ID0gaCgnZGl2LmtleWJpbmRpbmcnKS5yb290O1xuXG5cdFx0XHRjb25zdCBrID0gdGhpcy5fcmVnaXN0ZXIobmV3IEtleWJpbmRpbmdMYWJlbChkaXYsIE9TLCB7IGRpc2FibGVUaXRsZTogdHJ1ZSwgLi4udW50aGVtZWRLZXliaW5kaW5nTGFiZWxPcHRpb25zIH0pKTtcblx0XHRcdGsuc2V0KGtiKTtcblx0XHRcdHRoaXMubGFiZWwudGV4dENvbnRlbnQgPSB0aGlzLl9hY3Rpb24ubGFiZWw7XG5cdFx0XHR0aGlzLmxhYmVsLmFwcGVuZENoaWxkKGRpdik7XG5cdFx0XHR0aGlzLmxhYmVsLmNsYXNzTGlzdC5hZGQoJ2lubGluZVN1Z2dlc3Rpb25TdGF0dXNCYXJJdGVtTGFiZWwnKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdXBkYXRlVG9vbHRpcCgpOiB2b2lkIHtcblx0XHQvLyBOT09QLCBkaXNhYmxlIHRvb2x0aXBcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ3VzdG9taXplZE1lbnVXb3JrYmVuY2hUb29sQmFyIGV4dGVuZHMgV29ya2JlbmNoVG9vbEJhciB7XG5cdHByaXZhdGUgcmVhZG9ubHkgbWVudSA9IHRoaXMuX3N0b3JlLmFkZCh0aGlzLm1lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUodGhpcy5tZW51SWQsIHRoaXMuY29udGV4dEtleVNlcnZpY2UsIHsgZW1pdEV2ZW50c0ZvclN1Ym1lbnVDaGFuZ2VzOiB0cnVlIH0pKTtcblx0cHJpdmF0ZSBhZGRpdGlvbmFsQWN0aW9uczogSUFjdGlvbltdID0gW107XG5cdHByaXZhdGUgcHJlcGVuZGVkUHJpbWFyeUFjdGlvbnM6IElBY3Rpb25bXSA9IFtdO1xuXHRwcml2YXRlIGFkZGl0aW9uYWxQcmltYXJ5QWN0aW9uczogSUFjdGlvbltdID0gW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IG1lbnVJZDogTWVudUlkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczI6IElNZW51V29ya2JlbmNoVG9vbEJhck9wdGlvbnMgfCB1bmRlZmluZWQsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihjb250YWluZXIsIHsgcmVzZXRNZW51OiBtZW51SWQsIC4uLm9wdGlvbnMyIH0sIG1lbnVTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgY29udGV4dE1lbnVTZXJ2aWNlLCBrZXliaW5kaW5nU2VydmljZSwgY29tbWFuZFNlcnZpY2UsIHRlbGVtZXRyeVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fc3RvcmUuYWRkKHRoaXMubWVudS5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLnVwZGF0ZVRvb2xiYXIoKSkpO1xuXHRcdHRoaXMudXBkYXRlVG9vbGJhcigpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVUb29sYmFyKCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgcHJpbWFyeSwgc2Vjb25kYXJ5IH0gPSBnZXRBY3Rpb25CYXJBY3Rpb25zKFxuXHRcdFx0dGhpcy5tZW51LmdldEFjdGlvbnModGhpcy5vcHRpb25zMj8ubWVudU9wdGlvbnMpLFxuXHRcdFx0dGhpcy5vcHRpb25zMj8udG9vbGJhck9wdGlvbnM/LnByaW1hcnlHcm91cCwgdGhpcy5vcHRpb25zMj8udG9vbGJhck9wdGlvbnM/LnNob3VsZElubGluZVN1Ym1lbnUsIHRoaXMub3B0aW9uczI/LnRvb2xiYXJPcHRpb25zPy51c2VTZXBhcmF0b3JzSW5QcmltYXJ5QWN0aW9uc1xuXHRcdCk7XG5cblx0XHRzZWNvbmRhcnkucHVzaCguLi50aGlzLmFkZGl0aW9uYWxBY3Rpb25zKTtcblx0XHRwcmltYXJ5LnVuc2hpZnQoLi4udGhpcy5wcmVwZW5kZWRQcmltYXJ5QWN0aW9ucyk7XG5cdFx0cHJpbWFyeS5wdXNoKC4uLnRoaXMuYWRkaXRpb25hbFByaW1hcnlBY3Rpb25zKTtcblx0XHR0aGlzLnNldEFjdGlvbnMocHJpbWFyeSwgc2Vjb25kYXJ5KTtcblx0fVxuXG5cdHNldFByZXBlbmRlZFByaW1hcnlBY3Rpb25zKGFjdGlvbnM6IElBY3Rpb25bXSk6IHZvaWQge1xuXHRcdGlmIChlcXVhbHModGhpcy5wcmVwZW5kZWRQcmltYXJ5QWN0aW9ucywgYWN0aW9ucywgKGEsIGIpID0+IGEgPT09IGIpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5wcmVwZW5kZWRQcmltYXJ5QWN0aW9ucyA9IGFjdGlvbnM7XG5cdFx0dGhpcy51cGRhdGVUb29sYmFyKCk7XG5cdH1cblxuXHRzZXRBZGRpdGlvbmFsUHJpbWFyeUFjdGlvbnMoYWN0aW9uczogSUFjdGlvbltdKTogdm9pZCB7XG5cdFx0aWYgKGVxdWFscyh0aGlzLmFkZGl0aW9uYWxQcmltYXJ5QWN0aW9ucywgYWN0aW9ucywgKGEsIGIpID0+IGEgPT09IGIpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5hZGRpdGlvbmFsUHJpbWFyeUFjdGlvbnMgPSBhY3Rpb25zO1xuXHRcdHRoaXMudXBkYXRlVG9vbGJhcigpO1xuXHR9XG5cblx0c2V0QWRkaXRpb25hbFNlY29uZGFyeUFjdGlvbnMoYWN0aW9uczogSUFjdGlvbltdKTogdm9pZCB7XG5cdFx0aWYgKGVxdWFscyh0aGlzLmFkZGl0aW9uYWxBY3Rpb25zLCBhY3Rpb25zLCAoYSwgYikgPT4gYSA9PT0gYikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmFkZGl0aW9uYWxB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QU0sTUFBTSxDQUFDLEdBQUc7QUFDckU7QUFBQSxJQUNEO0FBRUEsU0FBSywwQkFBMEI7QUFDL0IsU0FBSyxjQUFjO0FBQUEsRUFDcEI7QUFBQSxFQUVBLDRCQUE0QixTQUEwQjtBQUNyRCxRQUFJLE9BQU8sS0FBSywwQkFBMEIsU0FBUyxDQUFDLEdBQUcsTUFBTSxNQUFNLENBQUMsR0FBRztBQUN0RTtBQUFBLElBQ0Q7QUFFQSxTQUFLLDJCQUEyQjtBQUNoQyxTQUFLLGNBQWM7QUFBQSxFQUNwQjtBQUFBLEVBRUEsOEJBQThCLFNBQTBCO0FBQ3ZELFFBQUksT0FBTyxLQUFLLG1CQUFtQixTQUFTLENBQUMsR0FBRyxNQUFNLE1BQU0sQ0FBQyxHQUFHO0FBQy9EO0FBQUEsSUFDRDtBQUVBLFNBQUssb0JBQW9CO0FBQ3pCLFNBQUssY0FBYztBQUFBLEVBQ3BCO0FBQ0Q7QUE3RGEsaUNBQU47QUFBQSxFQVVKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWZVOyIsCiAgIm5hbWVzIjogWyJtb2RlbCIsICJyZWFkZXIiLCAic3RvcmUiXQp9Cg==
