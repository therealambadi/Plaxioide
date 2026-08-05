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
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { editorHoverBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { HoverWidget } from "./hoverWidget.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { addDisposableListener, EventType, getActiveElement, isAncestorOfActiveElement, isAncestor, getWindow, isHTMLElement, isEditableElement } from "../../../../base/browser/dom.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { ResultKind } from "../../../../platform/keybinding/common/keybindingResolver.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { ContextViewHandler } from "../../../../platform/contextview/browser/contextViewService.js";
import { ManagedHoverWidget } from "./updatableHoverWidget.js";
import { timeout, TimeoutTimer } from "../../../../base/common/async.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { isNumber } from "../../../../base/common/types.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
let HoverService = class extends Disposable {
  constructor(_instantiationService, _configurationService, contextMenuService, _keybindingService, _layoutService, _accessibilityService) {
    super();
    this._instantiationService = _instantiationService;
    this._configurationService = _configurationService;
    this._keybindingService = _keybindingService;
    this._layoutService = _layoutService;
    this._accessibilityService = _accessibilityService;
    this._currentDelayedHoverWasShown = false;
    this._delayedHovers = /* @__PURE__ */ new Map();
    this._managedHovers = /* @__PURE__ */ new Map();
    this._register(contextMenuService.onDidShowContextMenu(() => this.hideHover()));
    this._contextViewHandler = this._register(new ContextViewHandler(this._layoutService));
    this._register(KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: "workbench.action.showHover",
      weight: KeybindingWeight.WorkbenchContrib - 1,
      when: EditorContextKeys.editorTextFocus.negate(),
      primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyI),
      handler: () => {
        this._showAndFocusHoverForActiveElement();
      }
    }));
  }
  showInstantHover(options, focus, skipLastFocusedUpdate, dontShow) {
    const hover = this._createHover(options, skipLastFocusedUpdate);
    if (!hover) {
      return void 0;
    }
    this._showHover(hover, options, focus);
    return hover;
  }
  showDelayedHover(options, lifecycleOptions) {
    if (options.id === void 0) {
      options.id = getHoverIdFromContent(options.content);
    }
    if (!this._currentDelayedHover || this._currentDelayedHoverWasShown) {
      if (this._currentHover?.isLocked) {
        return void 0;
      }
      if (getHoverOptionsIdentity(this._currentHoverOptions) === getHoverOptionsIdentity(options)) {
        return this._currentHover;
      }
      if (this._currentHover && !this._currentHover.isDisposed && this._currentDelayedHoverGroupId !== void 0 && this._currentDelayedHoverGroupId === lifecycleOptions?.groupId) {
        return this.showInstantHover({
          ...options,
          appearance: {
            ...options.appearance,
            skipFadeInAnimation: true
          }
        });
      }
    } else if (this._currentDelayedHover && getHoverOptionsIdentity(this._currentHoverOptions) === getHoverOptionsIdentity(options)) {
      return this._currentDelayedHover;
    }
    const hover = this._createHover(options, void 0);
    if (!hover) {
      this._currentDelayedHover = void 0;
      this._currentDelayedHoverWasShown = false;
      this._currentDelayedHoverGroupId = void 0;
      return void 0;
    }
    this._currentDelayedHover = hover;
    this._currentDelayedHoverWasShown = false;
    this._currentDelayedHoverGroupId = lifecycleOptions?.groupId;
    timeout(this._configurationService.getValue("workbench.hover.delay")).then(() => {
      if (hover && !hover.isDisposed) {
        this._currentDelayedHoverWasShown = true;
        this._showHover(hover, options);
      }
    });
    return hover;
  }
  setupDelayedHover(target, options, lifecycleOptions) {
    const resolveHoverOptions = () => ({
      ...typeof options === "function" ? options() : options,
      target
    });
    return this._setupDelayedHover(target, resolveHoverOptions, lifecycleOptions);
  }
  setupDelayedHoverAtMouse(target, options, lifecycleOptions) {
    const resolveHoverOptions = (e) => ({
      ...typeof options === "function" ? options() : options,
      target: {
        targetElements: [target],
        x: e !== void 0 ? e.x + 10 : void 0
      }
    });
    return this._setupDelayedHover(target, resolveHoverOptions, lifecycleOptions);
  }
  _setupDelayedHover(target, resolveHoverOptions, lifecycleOptions) {
    const store = new DisposableStore();
    store.add(addDisposableListener(target, EventType.MOUSE_OVER, (e) => {
      this.showDelayedHover(resolveHoverOptions(e), {
        groupId: lifecycleOptions?.groupId
      });
    }));
    if (lifecycleOptions?.setupKeyboardEvents) {
      store.add(addDisposableListener(target, EventType.KEY_DOWN, (e) => {
        const evt = new StandardKeyboardEvent(e);
        if (evt.equals(KeyCode.Space) || evt.equals(KeyCode.Enter)) {
          this.showInstantHover(resolveHoverOptions(), true);
        }
      }));
    }
    this._delayedHovers.set(target, { show: (focus) => {
      this.showInstantHover(resolveHoverOptions(), focus);
    } });
    store.add(toDisposable(() => this._delayedHovers.delete(target)));
    return store;
  }
  _createHover(options, skipLastFocusedUpdate) {
    this._currentDelayedHover = void 0;
    if (this._currentHover?.isLocked) {
      return void 0;
    }
    if (options.id === void 0) {
      options.id = getHoverIdFromContent(options.content);
    }
    if (getHoverOptionsIdentity(this._currentHoverOptions) === getHoverOptionsIdentity(options)) {
      return void 0;
    }
    this._currentHoverOptions = options;
    this._lastHoverOptions = options;
    const trapFocus = options.trapFocus || this._accessibilityService.isScreenReaderOptimized();
    const activeElement = getActiveElement();
    if (!skipLastFocusedUpdate) {
      if (trapFocus && activeElement) {
        if (!activeElement.classList.contains("monaco-hover")) {
          this._lastFocusedElementBeforeOpen = activeElement;
        }
      } else {
        this._lastFocusedElementBeforeOpen = void 0;
      }
    }
    const hoverDisposables = new DisposableStore();
    const hover = this._instantiationService.createInstance(HoverWidget, options);
    if (options.persistence?.sticky) {
      hover.isLocked = true;
    }
    if (options.position?.hoverPosition && !isNumber(options.position.hoverPosition)) {
      options.target = {
        targetElements: isHTMLElement(options.target) ? [options.target] : options.target.targetElements,
        x: options.position.hoverPosition.x + 10
      };
    }
    hover.onDispose(() => {
      const hoverWasFocused = this._currentHover?.domNode && isAncestorOfActiveElement(this._currentHover.domNode);
      if (hoverWasFocused) {
        this._lastFocusedElementBeforeOpen?.focus();
      }
      if (getHoverOptionsIdentity(this._currentHoverOptions) === getHoverOptionsIdentity(options)) {
        this.doHideHover();
      }
      hoverDisposables.dispose();
    }, void 0, hoverDisposables);
    if (!options.container) {
      const targetElement = isHTMLElement(options.target) ? options.target : options.target.targetElements[0];
      options.container = this._layoutService.getContainer(getWindow(targetElement));
    }
    hover.onRequestLayout(() => this._contextViewHandler.layout(), void 0, hoverDisposables);
    if (options.persistence?.sticky) {
      hoverDisposables.add(addDisposableListener(getWindow(options.container).document, EventType.MOUSE_DOWN, (e) => {
        if (!isAncestor(e.target, hover.domNode)) {
          this.doHideHover();
        }
      }));
    } else {
      if ("targetElements" in options.target) {
        for (const element of options.target.targetElements) {
          hoverDisposables.add(addDisposableListener(element, EventType.CLICK, () => this.hideHover()));
        }
      } else {
        hoverDisposables.add(addDisposableListener(options.target, EventType.CLICK, () => this.hideHover()));
      }
      const focusedElement = getActiveElement();
      if (focusedElement) {
        const focusedElementDocument = getWindow(focusedElement).document;
        hoverDisposables.add(addDisposableListener(focusedElement, EventType.KEY_DOWN, (e) => this._keyDown(e, hover, !!options.persistence?.hideOnKeyDown)));
        hoverDisposables.add(addDisposableListener(focusedElementDocument, EventType.KEY_DOWN, (e) => this._keyDown(e, hover, !!options.persistence?.hideOnKeyDown)));
        hoverDisposables.add(addDisposableListener(focusedElement, EventType.KEY_UP, (e) => this._keyUp(e, hover)));
        hoverDisposables.add(addDisposableListener(focusedElementDocument, EventType.KEY_UP, (e) => this._keyUp(e, hover)));
      }
    }
    if ("IntersectionObserver" in mainWindow) {
      const observer = new IntersectionObserver((e) => this._intersectionChange(e, hover), { threshold: 0 });
      const firstTargetElement = "targetElements" in options.target ? options.target.targetElements[0] : options.target;
      observer.observe(firstTargetElement);
      hoverDisposables.add(toDisposable(() => observer.disconnect()));
    }
    this._currentHover = hover;
    return hover;
  }
  _showHover(hover, options, focus) {
    this._contextViewHandler.showContextView(
      new HoverContextViewDelegate(hover, focus),
      options.container
    );
  }
  hideHover(force) {
    if (!force && this._currentHover?.isLocked || !this._currentHoverOptions) {
      return;
    }
    this.doHideHover();
  }
  doHideHover() {
    this._currentHover = void 0;
    this._currentHoverOptions = void 0;
    this._contextViewHandler.hideContextView();
  }
  _intersectionChange(entries, hover) {
    const entry = entries[entries.length - 1];
    if (!entry.isIntersecting) {
      hover.dispose();
    }
  }
  showAndFocusLastHover() {
    if (!this._lastHoverOptions) {
      return;
    }
    this.showInstantHover(this._lastHoverOptions, true, true);
  }
  _showAndFocusHoverForActiveElement() {
    let activeElement = getActiveElement();
    while (activeElement) {
      const hover = this._delayedHovers.get(activeElement) ?? this._managedHovers.get(activeElement);
      if (hover) {
        hover.show(true);
        return;
      }
      activeElement = activeElement.parentElement;
    }
  }
  _keyDown(e, hover, hideOnKeyDown) {
    if (e.key === "Alt") {
      hover.isLocked = true;
      return;
    }
    const event = new StandardKeyboardEvent(e);
    const keybinding = this._keybindingService.resolveKeyboardEvent(event);
    if (keybinding.getSingleModifierDispatchChords().some((value) => !!value) || this._keybindingService.softDispatch(event, event.target).kind !== ResultKind.NoMatchingKb) {
      return;
    }
    if (hideOnKeyDown && (!this._currentHoverOptions?.trapFocus || e.key !== "Tab")) {
      this.hideHover();
      this._lastFocusedElementBeforeOpen?.focus();
    }
  }
  _keyUp(e, hover) {
    if (e.key === "Alt") {
      hover.isLocked = false;
      if (!hover.isMouseIn) {
        this.hideHover();
        this._lastFocusedElementBeforeOpen?.focus();
      }
    }
  }
  // TODO: Investigate performance of this function. There seems to be a lot of content created
  //       and thrown away on start up
  setupManagedHover(hoverDelegate, targetElement, content, options) {
    targetElement.setAttribute("custom-hover", "true");
    if (targetElement.title !== "") {
      console.warn("HTML element already has a title attribute, which will conflict with the custom hover. Please remove the title attribute.");
      console.trace("Stack trace:", targetElement.title);
      targetElement.title = "";
    }
    let hoverPreparation;
    let hoverWidget;
    const hideHover = (disposeWidget, disposePreparation) => {
      const hadHover = hoverWidget !== void 0;
      if (disposeWidget) {
        hoverWidget?.dispose();
        hoverWidget = void 0;
      }
      if (disposePreparation) {
        hoverPreparation?.dispose();
        hoverPreparation = void 0;
      }
      if (hadHover) {
        hoverDelegate.onDidHideHover?.();
        hoverWidget = void 0;
      }
    };
    const triggerShowHover = (delay, focus, target, trapFocus) => {
      return new TimeoutTimer(async () => {
        if (!hoverWidget || hoverWidget.isDisposed) {
          hoverWidget = new ManagedHoverWidget(hoverDelegate, target || targetElement, delay > 0);
          await hoverWidget.update(typeof content === "function" ? content() : content, focus, { ...options, trapFocus });
        }
      }, delay);
    };
    const store = new DisposableStore();
    let isMouseDown = false;
    store.add(addDisposableListener(targetElement, EventType.MOUSE_DOWN, () => {
      isMouseDown = true;
      hideHover(true, true);
    }, true));
    store.add(addDisposableListener(targetElement, EventType.MOUSE_UP, () => {
      isMouseDown = false;
    }, true));
    store.add(addDisposableListener(targetElement, EventType.MOUSE_LEAVE, (e) => {
      isMouseDown = false;
      hideHover(false, e.fromElement === targetElement);
    }, true));
    store.add(addDisposableListener(targetElement, EventType.MOUSE_OVER, (e) => {
      if (hoverPreparation) {
        return;
      }
      const mouseOverStore = new DisposableStore();
      const target = {
        targetElements: [targetElement],
        dispose: () => {
        }
      };
      if (hoverDelegate.placement === void 0 || hoverDelegate.placement === "mouse") {
        const onMouseMove = (e2) => {
          target.x = e2.x + 10;
          if (isHTMLElement(e2.target) && getHoverTargetElement(e2.target, targetElement) !== targetElement) {
            hideHover(true, true);
          }
        };
        mouseOverStore.add(addDisposableListener(targetElement, EventType.MOUSE_MOVE, onMouseMove, true));
      }
      hoverPreparation = mouseOverStore;
      if (isHTMLElement(e.target) && getHoverTargetElement(e.target, targetElement) !== targetElement) {
        return;
      }
      mouseOverStore.add(triggerShowHover(typeof hoverDelegate.delay === "function" ? hoverDelegate.delay(content) : hoverDelegate.delay, false, target));
    }, true));
    const onFocus = () => {
      if (isMouseDown || hoverPreparation) {
        return;
      }
      const target = {
        targetElements: [targetElement],
        dispose: () => {
        }
      };
      const toDispose = new DisposableStore();
      const onBlur = () => hideHover(true, true);
      toDispose.add(addDisposableListener(targetElement, EventType.BLUR, onBlur, true));
      toDispose.add(triggerShowHover(typeof hoverDelegate.delay === "function" ? hoverDelegate.delay(content) : hoverDelegate.delay, false, target));
      hoverPreparation = toDispose;
    };
    if (!isEditableElement(targetElement)) {
      store.add(addDisposableListener(targetElement, EventType.FOCUS, onFocus, true));
    }
    const hover = {
      show: (focus) => {
        hideHover(false, true);
        triggerShowHover(0, focus, void 0, focus);
      },
      hide: () => {
        hideHover(true, true);
      },
      update: async (newContent, hoverOptions) => {
        content = newContent;
        await hoverWidget?.update(content, void 0, hoverOptions);
      },
      dispose: () => {
        this._managedHovers.delete(targetElement);
        store.dispose();
        hideHover(true, true);
      }
    };
    this._managedHovers.set(targetElement, hover);
    return hover;
  }
  showManagedHover(target) {
    const hover = this._managedHovers.get(target);
    if (hover) {
      hover.show(true);
    }
  }
  dispose() {
    this._managedHovers.forEach((hover) => hover.dispose());
    super.dispose();
  }
};
HoverService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, ILayoutService),
  __decorateParam(5, IAccessibilityService)
], HoverService);
function getHoverOptionsIdentity(options) {
  if (options === void 0) {
    return void 0;
  }
  return options?.id ?? options;
}
function getHoverIdFromContent(content) {
  if (isHTMLElement(content)) {
    return void 0;
  }
  if (typeof content === "string") {
    return content.toString();
  }
  return content.value;
}
class HoverContextViewDelegate {
  constructor(_hover, _focus = false) {
    this._hover = _hover;
    this._focus = _focus;
    // Render over all other context views
    this.layer = 1;
  }
  get anchorPosition() {
    return this._hover.anchor;
  }
  render(container) {
    this._hover.render(container);
    if (this._focus) {
      this._hover.focus();
    }
    return this._hover;
  }
  getAnchor() {
    return {
      x: this._hover.x,
      y: this._hover.y
    };
  }
  layout() {
    this._hover.layout();
  }
}
function getHoverTargetElement(element, stopElement) {
  stopElement = stopElement ?? getWindow(element).document.body;
  while (!element.hasAttribute("custom-hover") && element !== stopElement) {
    element = element.parentElement;
  }
  return element;
}
registerSingleton(IHoverService, HoverService, InstantiationType.Delayed);
registerThemingParticipant((theme, collector) => {
  const hoverBorder = theme.getColor(editorHoverBorder);
  if (hoverBorder) {
    collector.addRule(`.monaco-workbench .workbench-hover .hover-row:not(:first-child):not(:empty) { border-top: 1px solid ${hoverBorder.transparent(0.5)}; }`);
    collector.addRule(`.monaco-workbench .workbench-hover hr { border-top: 1px solid ${hoverBorder.transparent(0.5)}; }`);
  }
});
export {
  HoverService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9ob3ZlclNlcnZpY2UvaG92ZXJTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyByZWdpc3RlclRoZW1pbmdQYXJ0aWNpcGFudCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZWRpdG9ySG92ZXJCb3JkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEhvdmVyV2lkZ2V0IH0gZnJvbSAnLi9ob3ZlcldpZGdldC5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dFZpZXdQcm92aWRlciwgSURlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2NvbnRleHR2aWV3L2NvbnRleHR2aWV3LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIEV2ZW50VHlwZSwgZ2V0QWN0aXZlRWxlbWVudCwgaXNBbmNlc3Rvck9mQWN0aXZlRWxlbWVudCwgaXNBbmNlc3RvciwgZ2V0V2luZG93LCBpc0hUTUxFbGVtZW50LCBpc0VkaXRhYmxlRWxlbWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBSZXN1bHRLaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ1Jlc29sdmVyLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgSUxheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IENvbnRleHRWaWV3SGFuZGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXdTZXJ2aWNlLmpzJztcbmltcG9ydCB0eXBlIHsgSUhvdmVyTGlmZWN5Y2xlT3B0aW9ucywgSUhvdmVyT3B0aW9ucywgSUhvdmVyV2lkZ2V0LCBJTWFuYWdlZEhvdmVyLCBJTWFuYWdlZEhvdmVyQ29udGVudE9yRmFjdG9yeSwgSU1hbmFnZWRIb3Zlck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXIuanMnO1xuaW1wb3J0IHR5cGUgeyBJSG92ZXJEZWxlZ2F0ZSwgSUhvdmVyRGVsZWdhdGVUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZS5qcyc7XG5pbXBvcnQgeyBNYW5hZ2VkSG92ZXJXaWRnZXQgfSBmcm9tICcuL3VwZGF0YWJsZUhvdmVyV2lkZ2V0LmpzJztcbmltcG9ydCB7IHRpbWVvdXQsIFRpbWVvdXRUaW1lciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgaXNOdW1iZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBLZXlDaG9yZCwgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ3NSZWdpc3RyeSwgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuXG5leHBvcnQgY2xhc3MgSG92ZXJTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElIb3ZlclNlcnZpY2Uge1xuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9jb250ZXh0Vmlld0hhbmRsZXI6IElDb250ZXh0Vmlld1Byb3ZpZGVyO1xuXHRwcml2YXRlIF9jdXJyZW50SG92ZXJPcHRpb25zOiBJSG92ZXJPcHRpb25zIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9jdXJyZW50SG92ZXI6IEhvdmVyV2lkZ2V0IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9jdXJyZW50RGVsYXllZEhvdmVyOiBIb3ZlcldpZGdldCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfY3VycmVudERlbGF5ZWRIb3Zlcldhc1Nob3duOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX2N1cnJlbnREZWxheWVkSG92ZXJHcm91cElkOiBudW1iZXIgfCBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2xhc3RIb3Zlck9wdGlvbnM6IElIb3Zlck9wdGlvbnMgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfbGFzdEZvY3VzZWRFbGVtZW50QmVmb3JlT3BlbjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGVsYXllZEhvdmVycyA9IG5ldyBNYXA8SFRNTEVsZW1lbnQsIHsgc2hvdzogKGZvY3VzOiBib29sZWFuKSA9PiB2b2lkIH0+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX21hbmFnZWRIb3ZlcnMgPSBuZXcgTWFwPEhUTUxFbGVtZW50LCBJTWFuYWdlZEhvdmVyPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfa2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUxheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGF5b3V0U2VydmljZTogSUxheW91dFNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9hY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihjb250ZXh0TWVudVNlcnZpY2Uub25EaWRTaG93Q29udGV4dE1lbnUoKCkgPT4gdGhpcy5oaWRlSG92ZXIoKSkpO1xuXHRcdHRoaXMuX2NvbnRleHRWaWV3SGFuZGxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBDb250ZXh0Vmlld0hhbmRsZXIodGhpcy5fbGF5b3V0U2VydmljZSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uc2hvd0hvdmVyJyxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliIC0gMSxcblx0XHRcdHdoZW46IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cy5uZWdhdGUoKSxcblx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SSksXG5cdFx0XHRoYW5kbGVyOiAoKSA9PiB7IHRoaXMuX3Nob3dBbmRGb2N1c0hvdmVyRm9yQWN0aXZlRWxlbWVudCgpOyB9LFxuXHRcdH0pKTtcblx0fVxuXG5cdHNob3dJbnN0YW50SG92ZXIob3B0aW9uczogSUhvdmVyT3B0aW9ucywgZm9jdXM/OiBib29sZWFuLCBza2lwTGFzdEZvY3VzZWRVcGRhdGU/OiBib29sZWFuLCBkb250U2hvdz86IGJvb2xlYW4pOiBJSG92ZXJXaWRnZXQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGhvdmVyID0gdGhpcy5fY3JlYXRlSG92ZXIob3B0aW9ucywgc2tpcExhc3RGb2N1c2VkVXBkYXRlKTtcblx0XHRpZiAoIWhvdmVyKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzLl9zaG93SG92ZXIoaG92ZXIsIG9wdGlvbnMsIGZvY3VzKTtcblx0XHRyZXR1cm4gaG92ZXI7XG5cdH1cblxuXHRzaG93RGVsYXllZEhvdmVyKFxuXHRcdG9wdGlvbnM6IElIb3Zlck9wdGlvbnMsXG5cdFx0bGlmZWN5Y2xlT3B0aW9uczogUGljazxJSG92ZXJMaWZlY3ljbGVPcHRpb25zLCAnZ3JvdXBJZCc+LFxuXHQpOiBJSG92ZXJXaWRnZXQgfCB1bmRlZmluZWQge1xuXHRcdC8vIFNldCBgaWRgIHRvIGRlZmF1bHQgaWYgaXQncyB1bmRlZmluZWRcblx0XHRpZiAob3B0aW9ucy5pZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRvcHRpb25zLmlkID0gZ2V0SG92ZXJJZEZyb21Db250ZW50KG9wdGlvbnMuY29udGVudCk7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9jdXJyZW50RGVsYXllZEhvdmVyIHx8IHRoaXMuX2N1cnJlbnREZWxheWVkSG92ZXJXYXNTaG93bikge1xuXHRcdFx0Ly8gQ3VycmVudCBob3ZlciBpcyBsb2NrZWQsIHJlamVjdFxuXHRcdFx0aWYgKHRoaXMuX2N1cnJlbnRIb3Zlcj8uaXNMb2NrZWQpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWRlbnRpdHkgaXMgdGhlIHNhbWUsIHJldHVybiBjdXJyZW50IGhvdmVyXG5cdFx0XHRpZiAoZ2V0SG92ZXJPcHRpb25zSWRlbnRpdHkodGhpcy5fY3VycmVudEhvdmVyT3B0aW9ucykgPT09IGdldEhvdmVyT3B0aW9uc0lkZW50aXR5KG9wdGlvbnMpKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9jdXJyZW50SG92ZXI7XG5cdFx0XHR9XG5cblx0XHRcdC8vIENoZWNrIGdyb3VwIGlkZW50aXR5LCBpZiBpdCdzIHRoZSBzYW1lIHNraXAgdGhlIGRlbGF5IGFuZCBzaG93IHRoZSBob3ZlciBpbW1lZGlhdGVseVxuXHRcdFx0aWYgKHRoaXMuX2N1cnJlbnRIb3ZlciAmJiAhdGhpcy5fY3VycmVudEhvdmVyLmlzRGlzcG9zZWQgJiYgdGhpcy5fY3VycmVudERlbGF5ZWRIb3Zlckdyb3VwSWQgIT09IHVuZGVmaW5lZCAmJiB0aGlzLl9jdXJyZW50RGVsYXllZEhvdmVyR3JvdXBJZCA9PT0gbGlmZWN5Y2xlT3B0aW9ucz8uZ3JvdXBJZCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zaG93SW5zdGFudEhvdmVyKHtcblx0XHRcdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0XHRcdGFwcGVhcmFuY2U6IHtcblx0XHRcdFx0XHRcdC4uLm9wdGlvbnMuYXBwZWFyYW5jZSxcblx0XHRcdFx0XHRcdHNraXBGYWRlSW5BbmltYXRpb246IHRydWVcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAodGhpcy5fY3VycmVudERlbGF5ZWRIb3ZlciAmJiBnZXRIb3Zlck9wdGlvbnNJZGVudGl0eSh0aGlzLl9jdXJyZW50SG92ZXJPcHRpb25zKSA9PT0gZ2V0SG92ZXJPcHRpb25zSWRlbnRpdHkob3B0aW9ucykpIHtcblx0XHRcdC8vIElmIHRoZSBob3ZlciBpcyB0aGUgc2FtZSBidXQgdGltZW91dCBpcyBub3QgZmluaXNoZWQgeWV0LCByZXR1cm4gdGhlIGN1cnJlbnQgaG92ZXJcblx0XHRcdHJldHVybiB0aGlzLl9jdXJyZW50RGVsYXllZEhvdmVyO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhvdmVyID0gdGhpcy5fY3JlYXRlSG92ZXIob3B0aW9ucywgdW5kZWZpbmVkKTtcblx0XHRpZiAoIWhvdmVyKSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50RGVsYXllZEhvdmVyID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5fY3VycmVudERlbGF5ZWRIb3Zlcldhc1Nob3duID0gZmFsc2U7XG5cdFx0XHR0aGlzLl9jdXJyZW50RGVsYXllZEhvdmVyR3JvdXBJZCA9IHVuZGVmaW5lZDtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY3VycmVudERlbGF5ZWRIb3ZlciA9IGhvdmVyO1xuXHRcdHRoaXMuX2N1cnJlbnREZWxheWVkSG92ZXJXYXNTaG93biA9IGZhbHNlO1xuXHRcdHRoaXMuX2N1cnJlbnREZWxheWVkSG92ZXJHcm91cElkID0gbGlmZWN5Y2xlT3B0aW9ucz8uZ3JvdXBJZDtcblxuXHRcdHRpbWVvdXQodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPignd29ya2JlbmNoLmhvdmVyLmRlbGF5JykpLnRoZW4oKCkgPT4ge1xuXHRcdFx0aWYgKGhvdmVyICYmICFob3Zlci5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdHRoaXMuX2N1cnJlbnREZWxheWVkSG92ZXJXYXNTaG93biA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX3Nob3dIb3Zlcihob3Zlciwgb3B0aW9ucyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gaG92ZXI7XG5cdH1cblxuXHRzZXR1cERlbGF5ZWRIb3Zlcihcblx0XHR0YXJnZXQ6IEhUTUxFbGVtZW50LFxuXHRcdG9wdGlvbnM6ICgoKSA9PiBPbWl0PElIb3Zlck9wdGlvbnMsICd0YXJnZXQnPikgfCBPbWl0PElIb3Zlck9wdGlvbnMsICd0YXJnZXQnPixcblx0XHRsaWZlY3ljbGVPcHRpb25zPzogSUhvdmVyTGlmZWN5Y2xlT3B0aW9ucyxcblx0KTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IHJlc29sdmVIb3Zlck9wdGlvbnMgPSAoKSA9PiAoe1xuXHRcdFx0Li4udHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicgPyBvcHRpb25zKCkgOiBvcHRpb25zLFxuXHRcdFx0dGFyZ2V0XG5cdFx0fSBzYXRpc2ZpZXMgSUhvdmVyT3B0aW9ucyk7XG5cdFx0cmV0dXJuIHRoaXMuX3NldHVwRGVsYXllZEhvdmVyKHRhcmdldCwgcmVzb2x2ZUhvdmVyT3B0aW9ucywgbGlmZWN5Y2xlT3B0aW9ucyk7XG5cdH1cblxuXHRzZXR1cERlbGF5ZWRIb3ZlckF0TW91c2UoXG5cdFx0dGFyZ2V0OiBIVE1MRWxlbWVudCxcblx0XHRvcHRpb25zOiAoKCkgPT4gT21pdDxJSG92ZXJPcHRpb25zLCAndGFyZ2V0JyB8ICdwb3NpdGlvbic+KSB8IE9taXQ8SUhvdmVyT3B0aW9ucywgJ3RhcmdldCcgfCAncG9zaXRpb24nPixcblx0XHRsaWZlY3ljbGVPcHRpb25zPzogSUhvdmVyTGlmZWN5Y2xlT3B0aW9ucyxcblx0KTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IHJlc29sdmVIb3Zlck9wdGlvbnMgPSAoZT86IE1vdXNlRXZlbnQpID0+ICh7XG5cdFx0XHQuLi50eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJyA/IG9wdGlvbnMoKSA6IG9wdGlvbnMsXG5cdFx0XHR0YXJnZXQ6IHtcblx0XHRcdFx0dGFyZ2V0RWxlbWVudHM6IFt0YXJnZXRdLFxuXHRcdFx0XHR4OiBlICE9PSB1bmRlZmluZWQgPyBlLnggKyAxMCA6IHVuZGVmaW5lZCxcblx0XHRcdH1cblx0XHR9IHNhdGlzZmllcyBJSG92ZXJPcHRpb25zKTtcblx0XHRyZXR1cm4gdGhpcy5fc2V0dXBEZWxheWVkSG92ZXIodGFyZ2V0LCByZXNvbHZlSG92ZXJPcHRpb25zLCBsaWZlY3ljbGVPcHRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgX3NldHVwRGVsYXllZEhvdmVyKFxuXHRcdHRhcmdldDogSFRNTEVsZW1lbnQsXG5cdFx0cmVzb2x2ZUhvdmVyT3B0aW9uczogKChlPzogTW91c2VFdmVudCkgPT4gSUhvdmVyT3B0aW9ucyksXG5cdFx0bGlmZWN5Y2xlT3B0aW9ucz86IElIb3ZlckxpZmVjeWNsZU9wdGlvbnMsXG5cdCkge1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHN0b3JlLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIodGFyZ2V0LCBFdmVudFR5cGUuTU9VU0VfT1ZFUiwgZSA9PiB7XG5cdFx0XHR0aGlzLnNob3dEZWxheWVkSG92ZXIocmVzb2x2ZUhvdmVyT3B0aW9ucyhlKSwge1xuXHRcdFx0XHRncm91cElkOiBsaWZlY3ljbGVPcHRpb25zPy5ncm91cElkXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cdFx0aWYgKGxpZmVjeWNsZU9wdGlvbnM/LnNldHVwS2V5Ym9hcmRFdmVudHMpIHtcblx0XHRcdHN0b3JlLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIodGFyZ2V0LCBFdmVudFR5cGUuS0VZX0RPV04sIGUgPT4ge1xuXHRcdFx0XHRjb25zdCBldnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0XHRpZiAoZXZ0LmVxdWFscyhLZXlDb2RlLlNwYWNlKSB8fCBldnQuZXF1YWxzKEtleUNvZGUuRW50ZXIpKSB7XG5cdFx0XHRcdFx0dGhpcy5zaG93SW5zdGFudEhvdmVyKHJlc29sdmVIb3Zlck9wdGlvbnMoKSwgdHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHR0aGlzLl9kZWxheWVkSG92ZXJzLnNldCh0YXJnZXQsIHsgc2hvdzogKGZvY3VzOiBib29sZWFuKSA9PiB7IHRoaXMuc2hvd0luc3RhbnRIb3ZlcihyZXNvbHZlSG92ZXJPcHRpb25zKCksIGZvY3VzKTsgfSB9KTtcblx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuX2RlbGF5ZWRIb3ZlcnMuZGVsZXRlKHRhcmdldCkpKTtcblxuXHRcdHJldHVybiBzdG9yZTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZUhvdmVyKG9wdGlvbnM6IElIb3Zlck9wdGlvbnMsIHNraXBMYXN0Rm9jdXNlZFVwZGF0ZT86IGJvb2xlYW4pOiBIb3ZlcldpZGdldCB8IHVuZGVmaW5lZCB7XG5cdFx0dGhpcy5fY3VycmVudERlbGF5ZWRIb3ZlciA9IHVuZGVmaW5lZDtcblxuXHRcdGlmICh0aGlzLl9jdXJyZW50SG92ZXI/LmlzTG9ja2VkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIFNldCBgaWRgIHRvIGRlZmF1bHQgaWYgaXQncyB1bmRlZmluZWRcblx0XHRpZiAob3B0aW9ucy5pZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRvcHRpb25zLmlkID0gZ2V0SG92ZXJJZEZyb21Db250ZW50KG9wdGlvbnMuY29udGVudCk7XG5cdFx0fVxuXG5cdFx0aWYgKGdldEhvdmVyT3B0aW9uc0lkZW50aXR5KHRoaXMuX2N1cnJlbnRIb3Zlck9wdGlvbnMpID09PSBnZXRIb3Zlck9wdGlvbnNJZGVudGl0eShvcHRpb25zKSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0dGhpcy5fY3VycmVudEhvdmVyT3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0dGhpcy5fbGFzdEhvdmVyT3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0Y29uc3QgdHJhcEZvY3VzID0gb3B0aW9ucy50cmFwRm9jdXMgfHwgdGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKTtcblx0XHRjb25zdCBhY3RpdmVFbGVtZW50ID0gZ2V0QWN0aXZlRWxlbWVudCgpO1xuXHRcdC8vIEhBQ0ssIHJlbW92ZSB0aGlzIGNoZWNrIHdoZW4gIzE4OTA3NiBpcyBmaXhlZFxuXHRcdGlmICghc2tpcExhc3RGb2N1c2VkVXBkYXRlKSB7XG5cdFx0XHRpZiAodHJhcEZvY3VzICYmIGFjdGl2ZUVsZW1lbnQpIHtcblx0XHRcdFx0aWYgKCFhY3RpdmVFbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnbW9uYWNvLWhvdmVyJykpIHtcblx0XHRcdFx0XHR0aGlzLl9sYXN0Rm9jdXNlZEVsZW1lbnRCZWZvcmVPcGVuID0gYWN0aXZlRWxlbWVudCBhcyBIVE1MRWxlbWVudDtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fbGFzdEZvY3VzZWRFbGVtZW50QmVmb3JlT3BlbiA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBob3ZlckRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGhvdmVyID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSG92ZXJXaWRnZXQsIG9wdGlvbnMpO1xuXHRcdGlmIChvcHRpb25zLnBlcnNpc3RlbmNlPy5zdGlja3kpIHtcblx0XHRcdGhvdmVyLmlzTG9ja2VkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBBZGp1c3QgdGFyZ2V0IHBvc2l0aW9uIHdoZW4gYSBtb3VzZSBldmVudCBpcyBwcm92aWRlZCBhcyB0aGUgaG92ZXIgcG9zaXRpb25cblx0XHRpZiAob3B0aW9ucy5wb3NpdGlvbj8uaG92ZXJQb3NpdGlvbiAmJiAhaXNOdW1iZXIob3B0aW9ucy5wb3NpdGlvbi5ob3ZlclBvc2l0aW9uKSkge1xuXHRcdFx0b3B0aW9ucy50YXJnZXQgPSB7XG5cdFx0XHRcdHRhcmdldEVsZW1lbnRzOiBpc0hUTUxFbGVtZW50KG9wdGlvbnMudGFyZ2V0KSA/IFtvcHRpb25zLnRhcmdldF0gOiBvcHRpb25zLnRhcmdldC50YXJnZXRFbGVtZW50cyxcblx0XHRcdFx0eDogb3B0aW9ucy5wb3NpdGlvbi5ob3ZlclBvc2l0aW9uLnggKyAxMFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRob3Zlci5vbkRpc3Bvc2UoKCkgPT4ge1xuXHRcdFx0Y29uc3QgaG92ZXJXYXNGb2N1c2VkID0gdGhpcy5fY3VycmVudEhvdmVyPy5kb21Ob2RlICYmIGlzQW5jZXN0b3JPZkFjdGl2ZUVsZW1lbnQodGhpcy5fY3VycmVudEhvdmVyLmRvbU5vZGUpO1xuXHRcdFx0aWYgKGhvdmVyV2FzRm9jdXNlZCkge1xuXHRcdFx0XHQvLyBSZXF1aXJlZCB0byBoYW5kbGUgY2FzZXMgc3VjaCBhcyBjbG9zaW5nIHRoZSBob3ZlciB3aXRoIHRoZSBlc2NhcGUga2V5XG5cdFx0XHRcdHRoaXMuX2xhc3RGb2N1c2VkRWxlbWVudEJlZm9yZU9wZW4/LmZvY3VzKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIE9ubHkgY2xlYXIgdGhlIGN1cnJlbnQgb3B0aW9ucyBpZiBpdCdzIHRoZSBjdXJyZW50IGhvdmVyLCB0aGUgY3VycmVudCBvcHRpb25zIGhlbHBcblx0XHRcdC8vIHJlZHVjZSBmbGlja2VyaW5nIHdoZW4gdGhlIHNhbWUgaG92ZXIgaXMgc2hvd24gbXVsdGlwbGUgdGltZXNcblx0XHRcdGlmIChnZXRIb3Zlck9wdGlvbnNJZGVudGl0eSh0aGlzLl9jdXJyZW50SG92ZXJPcHRpb25zKSA9PT0gZ2V0SG92ZXJPcHRpb25zSWRlbnRpdHkob3B0aW9ucykpIHtcblx0XHRcdFx0dGhpcy5kb0hpZGVIb3ZlcigpO1xuXHRcdFx0fVxuXHRcdFx0aG92ZXJEaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0fSwgdW5kZWZpbmVkLCBob3ZlckRpc3Bvc2FibGVzKTtcblx0XHQvLyBTZXQgdGhlIGNvbnRhaW5lciBleHBsaWNpdGx5IHRvIGVuYWJsZSBhdXggd2luZG93IHN1cHBvcnRcblx0XHRpZiAoIW9wdGlvbnMuY29udGFpbmVyKSB7XG5cdFx0XHRjb25zdCB0YXJnZXRFbGVtZW50ID0gaXNIVE1MRWxlbWVudChvcHRpb25zLnRhcmdldCkgPyBvcHRpb25zLnRhcmdldCA6IG9wdGlvbnMudGFyZ2V0LnRhcmdldEVsZW1lbnRzWzBdO1xuXHRcdFx0b3B0aW9ucy5jb250YWluZXIgPSB0aGlzLl9sYXlvdXRTZXJ2aWNlLmdldENvbnRhaW5lcihnZXRXaW5kb3codGFyZ2V0RWxlbWVudCkpO1xuXHRcdH1cblxuXHRcdGhvdmVyLm9uUmVxdWVzdExheW91dCgoKSA9PiB0aGlzLl9jb250ZXh0Vmlld0hhbmRsZXIubGF5b3V0KCksIHVuZGVmaW5lZCwgaG92ZXJEaXNwb3NhYmxlcyk7XG5cdFx0aWYgKG9wdGlvbnMucGVyc2lzdGVuY2U/LnN0aWNreSkge1xuXHRcdFx0aG92ZXJEaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGdldFdpbmRvdyhvcHRpb25zLmNvbnRhaW5lcikuZG9jdW1lbnQsIEV2ZW50VHlwZS5NT1VTRV9ET1dOLCBlID0+IHtcblx0XHRcdFx0aWYgKCFpc0FuY2VzdG9yKGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50LCBob3Zlci5kb21Ob2RlKSkge1xuXHRcdFx0XHRcdHRoaXMuZG9IaWRlSG92ZXIoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoJ3RhcmdldEVsZW1lbnRzJyBpbiBvcHRpb25zLnRhcmdldCkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGVsZW1lbnQgb2Ygb3B0aW9ucy50YXJnZXQudGFyZ2V0RWxlbWVudHMpIHtcblx0XHRcdFx0XHRob3ZlckRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIoZWxlbWVudCwgRXZlbnRUeXBlLkNMSUNLLCAoKSA9PiB0aGlzLmhpZGVIb3ZlcigpKSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGhvdmVyRGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihvcHRpb25zLnRhcmdldCwgRXZlbnRUeXBlLkNMSUNLLCAoKSA9PiB0aGlzLmhpZGVIb3ZlcigpKSk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmb2N1c2VkRWxlbWVudCA9IGdldEFjdGl2ZUVsZW1lbnQoKTtcblx0XHRcdGlmIChmb2N1c2VkRWxlbWVudCkge1xuXHRcdFx0XHRjb25zdCBmb2N1c2VkRWxlbWVudERvY3VtZW50ID0gZ2V0V2luZG93KGZvY3VzZWRFbGVtZW50KS5kb2N1bWVudDtcblx0XHRcdFx0aG92ZXJEaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGZvY3VzZWRFbGVtZW50LCBFdmVudFR5cGUuS0VZX0RPV04sIGUgPT4gdGhpcy5fa2V5RG93bihlLCBob3ZlciwgISFvcHRpb25zLnBlcnNpc3RlbmNlPy5oaWRlT25LZXlEb3duKSkpO1xuXHRcdFx0XHRob3ZlckRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIoZm9jdXNlZEVsZW1lbnREb2N1bWVudCwgRXZlbnRUeXBlLktFWV9ET1dOLCBlID0+IHRoaXMuX2tleURvd24oZSwgaG92ZXIsICEhb3B0aW9ucy5wZXJzaXN0ZW5jZT8uaGlkZU9uS2V5RG93bikpKTtcblx0XHRcdFx0aG92ZXJEaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGZvY3VzZWRFbGVtZW50LCBFdmVudFR5cGUuS0VZX1VQLCBlID0+IHRoaXMuX2tleVVwKGUsIGhvdmVyKSkpO1xuXHRcdFx0XHRob3ZlckRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIoZm9jdXNlZEVsZW1lbnREb2N1bWVudCwgRXZlbnRUeXBlLktFWV9VUCwgZSA9PiB0aGlzLl9rZXlVcChlLCBob3ZlcikpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoJ0ludGVyc2VjdGlvbk9ic2VydmVyJyBpbiBtYWluV2luZG93KSB7XG5cdFx0XHRjb25zdCBvYnNlcnZlciA9IG5ldyBJbnRlcnNlY3Rpb25PYnNlcnZlcihlID0+IHRoaXMuX2ludGVyc2VjdGlvbkNoYW5nZShlLCBob3ZlciksIHsgdGhyZXNob2xkOiAwIH0pO1xuXHRcdFx0Y29uc3QgZmlyc3RUYXJnZXRFbGVtZW50ID0gJ3RhcmdldEVsZW1lbnRzJyBpbiBvcHRpb25zLnRhcmdldCA/IG9wdGlvbnMudGFyZ2V0LnRhcmdldEVsZW1lbnRzWzBdIDogb3B0aW9ucy50YXJnZXQ7XG5cdFx0XHRvYnNlcnZlci5vYnNlcnZlKGZpcnN0VGFyZ2V0RWxlbWVudCk7XG5cdFx0XHRob3ZlckRpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gb2JzZXJ2ZXIuZGlzY29ubmVjdCgpKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY3VycmVudEhvdmVyID0gaG92ZXI7XG5cblx0XHRyZXR1cm4gaG92ZXI7XG5cdH1cblxuXHRwcml2YXRlIF9zaG93SG92ZXIoaG92ZXI6IEhvdmVyV2lkZ2V0LCBvcHRpb25zOiBJSG92ZXJPcHRpb25zLCBmb2N1cz86IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9jb250ZXh0Vmlld0hhbmRsZXIuc2hvd0NvbnRleHRWaWV3KFxuXHRcdFx0bmV3IEhvdmVyQ29udGV4dFZpZXdEZWxlZ2F0ZShob3ZlciwgZm9jdXMpLFxuXHRcdFx0b3B0aW9ucy5jb250YWluZXJcblx0XHQpO1xuXHR9XG5cblx0aGlkZUhvdmVyKGZvcmNlPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICgoIWZvcmNlICYmIHRoaXMuX2N1cnJlbnRIb3Zlcj8uaXNMb2NrZWQpIHx8ICF0aGlzLl9jdXJyZW50SG92ZXJPcHRpb25zKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuZG9IaWRlSG92ZXIoKTtcblx0fVxuXG5cdHByaXZhdGUgZG9IaWRlSG92ZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5fY3VycmVudEhvdmVyID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX2N1cnJlbnRIb3Zlck9wdGlvbnMgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fY29udGV4dFZpZXdIYW5kbGVyLmhpZGVDb250ZXh0VmlldygpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaW50ZXJzZWN0aW9uQ2hhbmdlKGVudHJpZXM6IEludGVyc2VjdGlvbk9ic2VydmVyRW50cnlbXSwgaG92ZXI6IElEaXNwb3NhYmxlKTogdm9pZCB7XG5cdFx0Y29uc3QgZW50cnkgPSBlbnRyaWVzW2VudHJpZXMubGVuZ3RoIC0gMV07XG5cdFx0aWYgKCFlbnRyeS5pc0ludGVyc2VjdGluZykge1xuXHRcdFx0aG92ZXIuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdHNob3dBbmRGb2N1c0xhc3RIb3ZlcigpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2xhc3RIb3Zlck9wdGlvbnMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5zaG93SW5zdGFudEhvdmVyKHRoaXMuX2xhc3RIb3Zlck9wdGlvbnMsIHRydWUsIHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2hvd0FuZEZvY3VzSG92ZXJGb3JBY3RpdmVFbGVtZW50KCk6IHZvaWQge1xuXHRcdC8vIFRPRE86IGlmIGhvdmVyIGlzIHZpc2libGUsIGZvY3VzIGl0IHRvIGF2b2lkIGZsaWNrZXJpbmdcblxuXHRcdGxldCBhY3RpdmVFbGVtZW50ID0gZ2V0QWN0aXZlRWxlbWVudCgpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHR3aGlsZSAoYWN0aXZlRWxlbWVudCkge1xuXHRcdFx0Y29uc3QgaG92ZXIgPSB0aGlzLl9kZWxheWVkSG92ZXJzLmdldChhY3RpdmVFbGVtZW50KSA/PyB0aGlzLl9tYW5hZ2VkSG92ZXJzLmdldChhY3RpdmVFbGVtZW50KTtcblx0XHRcdGlmIChob3Zlcikge1xuXHRcdFx0XHRob3Zlci5zaG93KHRydWUpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGFjdGl2ZUVsZW1lbnQgPSBhY3RpdmVFbGVtZW50LnBhcmVudEVsZW1lbnQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfa2V5RG93bihlOiBLZXlib2FyZEV2ZW50LCBob3ZlcjogSG92ZXJXaWRnZXQsIGhpZGVPbktleURvd246IGJvb2xlYW4pIHtcblx0XHRpZiAoZS5rZXkgPT09ICdBbHQnKSB7XG5cdFx0XHRob3Zlci5pc0xvY2tlZCA9IHRydWU7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRjb25zdCBrZXliaW5kaW5nID0gdGhpcy5fa2V5YmluZGluZ1NlcnZpY2UucmVzb2x2ZUtleWJvYXJkRXZlbnQoZXZlbnQpO1xuXHRcdGlmIChrZXliaW5kaW5nLmdldFNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hDaG9yZHMoKS5zb21lKHZhbHVlID0+ICEhdmFsdWUpIHx8IHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLnNvZnREaXNwYXRjaChldmVudCwgZXZlbnQudGFyZ2V0KS5raW5kICE9PSBSZXN1bHRLaW5kLk5vTWF0Y2hpbmdLYikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoaGlkZU9uS2V5RG93biAmJiAoIXRoaXMuX2N1cnJlbnRIb3Zlck9wdGlvbnM/LnRyYXBGb2N1cyB8fCBlLmtleSAhPT0gJ1RhYicpKSB7XG5cdFx0XHR0aGlzLmhpZGVIb3ZlcigpO1xuXHRcdFx0dGhpcy5fbGFzdEZvY3VzZWRFbGVtZW50QmVmb3JlT3Blbj8uZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9rZXlVcChlOiBLZXlib2FyZEV2ZW50LCBob3ZlcjogSG92ZXJXaWRnZXQpIHtcblx0XHRpZiAoZS5rZXkgPT09ICdBbHQnKSB7XG5cdFx0XHRob3Zlci5pc0xvY2tlZCA9IGZhbHNlO1xuXHRcdFx0Ly8gSGlkZSBpZiBhbHQgaXMgcmVsZWFzZWQgd2hpbGUgdGhlIG1vdXNlIGlzIG5vdCBvdmVyIGhvdmVyL3RhcmdldFxuXHRcdFx0aWYgKCFob3Zlci5pc01vdXNlSW4pIHtcblx0XHRcdFx0dGhpcy5oaWRlSG92ZXIoKTtcblx0XHRcdFx0dGhpcy5fbGFzdEZvY3VzZWRFbGVtZW50QmVmb3JlT3Blbj8uZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBUT0RPOiBJbnZlc3RpZ2F0ZSBwZXJmb3JtYW5jZSBvZiB0aGlzIGZ1bmN0aW9uLiBUaGVyZSBzZWVtcyB0byBiZSBhIGxvdCBvZiBjb250ZW50IGNyZWF0ZWRcblx0Ly8gICAgICAgYW5kIHRocm93biBhd2F5IG9uIHN0YXJ0IHVwXG5cdHNldHVwTWFuYWdlZEhvdmVyKGhvdmVyRGVsZWdhdGU6IElIb3ZlckRlbGVnYXRlLCB0YXJnZXRFbGVtZW50OiBIVE1MRWxlbWVudCwgY29udGVudDogSU1hbmFnZWRIb3ZlckNvbnRlbnRPckZhY3RvcnksIG9wdGlvbnM/OiBJTWFuYWdlZEhvdmVyT3B0aW9ucyB8IHVuZGVmaW5lZCk6IElNYW5hZ2VkSG92ZXIge1xuXHRcdHRhcmdldEVsZW1lbnQuc2V0QXR0cmlidXRlKCdjdXN0b20taG92ZXInLCAndHJ1ZScpO1xuXG5cdFx0aWYgKHRhcmdldEVsZW1lbnQudGl0bGUgIT09ICcnKSB7XG5cdFx0XHRjb25zb2xlLndhcm4oJ0hUTUwgZWxlbWVudCBhbHJlYWR5IGhhcyBhIHRpdGxlIGF0dHJpYnV0ZSwgd2hpY2ggd2lsbCBjb25mbGljdCB3aXRoIHRoZSBjdXN0b20gaG92ZXIuIFBsZWFzZSByZW1vdmUgdGhlIHRpdGxlIGF0dHJpYnV0ZS4nKTtcblx0XHRcdGNvbnNvbGUudHJhY2UoJ1N0YWNrIHRyYWNlOicsIHRhcmdldEVsZW1lbnQudGl0bGUpO1xuXHRcdFx0dGFyZ2V0RWxlbWVudC50aXRsZSA9ICcnO1xuXHRcdH1cblxuXHRcdGxldCBob3ZlclByZXBhcmF0aW9uOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgaG92ZXJXaWRnZXQ6IE1hbmFnZWRIb3ZlcldpZGdldCB8IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IGhpZGVIb3ZlciA9IChkaXNwb3NlV2lkZ2V0OiBib29sZWFuLCBkaXNwb3NlUHJlcGFyYXRpb246IGJvb2xlYW4pID0+IHtcblx0XHRcdGNvbnN0IGhhZEhvdmVyID0gaG92ZXJXaWRnZXQgIT09IHVuZGVmaW5lZDtcblx0XHRcdGlmIChkaXNwb3NlV2lkZ2V0KSB7XG5cdFx0XHRcdGhvdmVyV2lkZ2V0Py5kaXNwb3NlKCk7XG5cdFx0XHRcdGhvdmVyV2lkZ2V0ID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGRpc3Bvc2VQcmVwYXJhdGlvbikge1xuXHRcdFx0XHRob3ZlclByZXBhcmF0aW9uPy5kaXNwb3NlKCk7XG5cdFx0XHRcdGhvdmVyUHJlcGFyYXRpb24gPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoaGFkSG92ZXIpIHtcblx0XHRcdFx0aG92ZXJEZWxlZ2F0ZS5vbkRpZEhpZGVIb3Zlcj8uKCk7XG5cdFx0XHRcdGhvdmVyV2lkZ2V0ID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCB0cmlnZ2VyU2hvd0hvdmVyID0gKGRlbGF5OiBudW1iZXIsIGZvY3VzPzogYm9vbGVhbiwgdGFyZ2V0PzogSUhvdmVyRGVsZWdhdGVUYXJnZXQsIHRyYXBGb2N1cz86IGJvb2xlYW4pID0+IHtcblx0XHRcdHJldHVybiBuZXcgVGltZW91dFRpbWVyKGFzeW5jICgpID0+IHtcblx0XHRcdFx0aWYgKCFob3ZlcldpZGdldCB8fCBob3ZlcldpZGdldC5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0aG92ZXJXaWRnZXQgPSBuZXcgTWFuYWdlZEhvdmVyV2lkZ2V0KGhvdmVyRGVsZWdhdGUsIHRhcmdldCB8fCB0YXJnZXRFbGVtZW50LCBkZWxheSA+IDApO1xuXHRcdFx0XHRcdGF3YWl0IGhvdmVyV2lkZ2V0LnVwZGF0ZSh0eXBlb2YgY29udGVudCA9PT0gJ2Z1bmN0aW9uJyA/IGNvbnRlbnQoKSA6IGNvbnRlbnQsIGZvY3VzLCB7IC4uLm9wdGlvbnMsIHRyYXBGb2N1cyB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgZGVsYXkpO1xuXHRcdH07XG5cblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRsZXQgaXNNb3VzZURvd24gPSBmYWxzZTtcblx0XHRzdG9yZS5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRhcmdldEVsZW1lbnQsIEV2ZW50VHlwZS5NT1VTRV9ET1dOLCAoKSA9PiB7XG5cdFx0XHRpc01vdXNlRG93biA9IHRydWU7XG5cdFx0XHRoaWRlSG92ZXIodHJ1ZSwgdHJ1ZSk7XG5cdFx0fSwgdHJ1ZSkpO1xuXHRcdHN0b3JlLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIodGFyZ2V0RWxlbWVudCwgRXZlbnRUeXBlLk1PVVNFX1VQLCAoKSA9PiB7XG5cdFx0XHRpc01vdXNlRG93biA9IGZhbHNlO1xuXHRcdH0sIHRydWUpKTtcblx0XHRzdG9yZS5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRhcmdldEVsZW1lbnQsIEV2ZW50VHlwZS5NT1VTRV9MRUFWRSwgKGU6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdGlzTW91c2VEb3duID0gZmFsc2U7XG5cdFx0XHRoaWRlSG92ZXIoZmFsc2UsICg8YW55PmUpLmZyb21FbGVtZW50ID09PSB0YXJnZXRFbGVtZW50KTtcblx0XHR9LCB0cnVlKSk7XG5cdFx0c3RvcmUuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0YXJnZXRFbGVtZW50LCBFdmVudFR5cGUuTU9VU0VfT1ZFUiwgKGU6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdGlmIChob3ZlclByZXBhcmF0aW9uKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbW91c2VPdmVyU3RvcmU6IERpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdFx0Y29uc3QgdGFyZ2V0OiBJSG92ZXJEZWxlZ2F0ZVRhcmdldCA9IHtcblx0XHRcdFx0dGFyZ2V0RWxlbWVudHM6IFt0YXJnZXRFbGVtZW50XSxcblx0XHRcdFx0ZGlzcG9zZTogKCkgPT4geyB9XG5cdFx0XHR9O1xuXHRcdFx0aWYgKGhvdmVyRGVsZWdhdGUucGxhY2VtZW50ID09PSB1bmRlZmluZWQgfHwgaG92ZXJEZWxlZ2F0ZS5wbGFjZW1lbnQgPT09ICdtb3VzZScpIHtcblx0XHRcdFx0Ly8gdHJhY2sgdGhlIG1vdXNlIHBvc2l0aW9uXG5cdFx0XHRcdGNvbnN0IG9uTW91c2VNb3ZlID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdFx0XHR0YXJnZXQueCA9IGUueCArIDEwO1xuXHRcdFx0XHRcdGlmICgoaXNIVE1MRWxlbWVudChlLnRhcmdldCkpICYmIGdldEhvdmVyVGFyZ2V0RWxlbWVudChlLnRhcmdldCwgdGFyZ2V0RWxlbWVudCkgIT09IHRhcmdldEVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdGhpZGVIb3Zlcih0cnVlLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHRcdG1vdXNlT3ZlclN0b3JlLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIodGFyZ2V0RWxlbWVudCwgRXZlbnRUeXBlLk1PVVNFX01PVkUsIG9uTW91c2VNb3ZlLCB0cnVlKSk7XG5cdFx0XHR9XG5cblx0XHRcdGhvdmVyUHJlcGFyYXRpb24gPSBtb3VzZU92ZXJTdG9yZTtcblxuXHRcdFx0aWYgKChpc0hUTUxFbGVtZW50KGUudGFyZ2V0KSkgJiYgZ2V0SG92ZXJUYXJnZXRFbGVtZW50KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50LCB0YXJnZXRFbGVtZW50KSAhPT0gdGFyZ2V0RWxlbWVudCkge1xuXHRcdFx0XHRyZXR1cm47IC8vIERvIG5vdCBzaG93IGhvdmVyIHdoZW4gdGhlIG1vdXNlIGlzIG92ZXIgYW5vdGhlciBob3ZlciB0YXJnZXRcblx0XHRcdH1cblxuXHRcdFx0bW91c2VPdmVyU3RvcmUuYWRkKHRyaWdnZXJTaG93SG92ZXIodHlwZW9mIGhvdmVyRGVsZWdhdGUuZGVsYXkgPT09ICdmdW5jdGlvbicgPyBob3ZlckRlbGVnYXRlLmRlbGF5KGNvbnRlbnQpIDogaG92ZXJEZWxlZ2F0ZS5kZWxheSwgZmFsc2UsIHRhcmdldCkpO1xuXHRcdH0sIHRydWUpKTtcblxuXHRcdGNvbnN0IG9uRm9jdXMgPSAoKSA9PiB7XG5cdFx0XHRpZiAoaXNNb3VzZURvd24gfHwgaG92ZXJQcmVwYXJhdGlvbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB0YXJnZXQ6IElIb3ZlckRlbGVnYXRlVGFyZ2V0ID0ge1xuXHRcdFx0XHR0YXJnZXRFbGVtZW50czogW3RhcmdldEVsZW1lbnRdLFxuXHRcdFx0XHRkaXNwb3NlOiAoKSA9PiB7IH1cblx0XHRcdH07XG5cdFx0XHRjb25zdCB0b0Rpc3Bvc2U6IERpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdGNvbnN0IG9uQmx1ciA9ICgpID0+IGhpZGVIb3Zlcih0cnVlLCB0cnVlKTtcblx0XHRcdHRvRGlzcG9zZS5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRhcmdldEVsZW1lbnQsIEV2ZW50VHlwZS5CTFVSLCBvbkJsdXIsIHRydWUpKTtcblx0XHRcdHRvRGlzcG9zZS5hZGQodHJpZ2dlclNob3dIb3Zlcih0eXBlb2YgaG92ZXJEZWxlZ2F0ZS5kZWxheSA9PT0gJ2Z1bmN0aW9uJyA/IGhvdmVyRGVsZWdhdGUuZGVsYXkoY29udGVudCkgOiBob3ZlckRlbGVnYXRlLmRlbGF5LCBmYWxzZSwgdGFyZ2V0KSk7XG5cdFx0XHRob3ZlclByZXBhcmF0aW9uID0gdG9EaXNwb3NlO1xuXHRcdH07XG5cblx0XHQvLyBEbyBub3Qgc2hvdyBob3ZlciB3aGVuIGZvY3VzaW5nIGFuIGlucHV0IG9yIHRleHRhcmVhXG5cdFx0aWYgKCFpc0VkaXRhYmxlRWxlbWVudCh0YXJnZXRFbGVtZW50KSkge1xuXHRcdFx0c3RvcmUuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0YXJnZXRFbGVtZW50LCBFdmVudFR5cGUuRk9DVVMsIG9uRm9jdXMsIHRydWUpKTtcblx0XHR9XG5cblx0XHRjb25zdCBob3ZlcjogSU1hbmFnZWRIb3ZlciA9IHtcblx0XHRcdHNob3c6IGZvY3VzID0+IHtcblx0XHRcdFx0aGlkZUhvdmVyKGZhbHNlLCB0cnVlKTsgLy8gdGVybWluYXRlIGEgb25nb2luZyBtb3VzZSBvdmVyIHByZXBhcmF0aW9uXG5cdFx0XHRcdHRyaWdnZXJTaG93SG92ZXIoMCwgZm9jdXMsIHVuZGVmaW5lZCwgZm9jdXMpOyAvLyBzaG93IGhvdmVyIGltbWVkaWF0ZWx5XG5cdFx0XHR9LFxuXHRcdFx0aGlkZTogKCkgPT4ge1xuXHRcdFx0XHRoaWRlSG92ZXIodHJ1ZSwgdHJ1ZSk7XG5cdFx0XHR9LFxuXHRcdFx0dXBkYXRlOiBhc3luYyAobmV3Q29udGVudCwgaG92ZXJPcHRpb25zKSA9PiB7XG5cdFx0XHRcdGNvbnRlbnQgPSBuZXdDb250ZW50O1xuXHRcdFx0XHRhd2FpdCBob3ZlcldpZGdldD8udXBkYXRlKGNvbnRlbnQsIHVuZGVmaW5lZCwgaG92ZXJPcHRpb25zKTtcblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX21hbmFnZWRIb3ZlcnMuZGVsZXRlKHRhcmdldEVsZW1lbnQpO1xuXHRcdFx0XHRzdG9yZS5kaXNwb3NlKCk7XG5cdFx0XHRcdGhpZGVIb3Zlcih0cnVlLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHRoaXMuX21hbmFnZWRIb3ZlcnMuc2V0KHRhcmdldEVsZW1lbnQsIGhvdmVyKTtcblx0XHRyZXR1cm4gaG92ZXI7XG5cdH1cblxuXHRzaG93TWFuYWdlZEhvdmVyKHRhcmdldDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRjb25zdCBob3ZlciA9IHRoaXMuX21hbmFnZWRIb3ZlcnMuZ2V0KHRhcmdldCk7XG5cdFx0aWYgKGhvdmVyKSB7XG5cdFx0XHRob3Zlci5zaG93KHRydWUpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX21hbmFnZWRIb3ZlcnMuZm9yRWFjaChob3ZlciA9PiBob3Zlci5kaXNwb3NlKCkpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRIb3Zlck9wdGlvbnNJZGVudGl0eShvcHRpb25zOiBJSG92ZXJPcHRpb25zIHwgdW5kZWZpbmVkKTogSUhvdmVyT3B0aW9ucyB8IG51bWJlciB8IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdGlmIChvcHRpb25zID09PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdHJldHVybiBvcHRpb25zPy5pZCA/PyBvcHRpb25zO1xufVxuXG5mdW5jdGlvbiBnZXRIb3ZlcklkRnJvbUNvbnRlbnQoY29udGVudDogc3RyaW5nIHwgSFRNTEVsZW1lbnQgfCBJTWFya2Rvd25TdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRpZiAoaXNIVE1MRWxlbWVudChjb250ZW50KSkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblx0aWYgKHR5cGVvZiBjb250ZW50ID09PSAnc3RyaW5nJykge1xuXHRcdHJldHVybiBjb250ZW50LnRvU3RyaW5nKCk7XG5cdH1cblx0cmV0dXJuIGNvbnRlbnQudmFsdWU7XG59XG5cbmNsYXNzIEhvdmVyQ29udGV4dFZpZXdEZWxlZ2F0ZSBpbXBsZW1lbnRzIElEZWxlZ2F0ZSB7XG5cblx0Ly8gUmVuZGVyIG92ZXIgYWxsIG90aGVyIGNvbnRleHQgdmlld3Ncblx0cHVibGljIHJlYWRvbmx5IGxheWVyID0gMTtcblxuXHRnZXQgYW5jaG9yUG9zaXRpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2hvdmVyLmFuY2hvcjtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyOiBIb3ZlcldpZGdldCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9mb2N1czogYm9vbGVhbiA9IGZhbHNlXG5cdCkge1xuXHR9XG5cblx0cmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcblx0XHR0aGlzLl9ob3Zlci5yZW5kZXIoY29udGFpbmVyKTtcblx0XHRpZiAodGhpcy5fZm9jdXMpIHtcblx0XHRcdHRoaXMuX2hvdmVyLmZvY3VzKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9ob3Zlcjtcblx0fVxuXG5cdGdldEFuY2hvcigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0eDogdGhpcy5faG92ZXIueCxcblx0XHRcdHk6IHRoaXMuX2hvdmVyLnlcblx0XHR9O1xuXHR9XG5cblx0bGF5b3V0KCkge1xuXHRcdHRoaXMuX2hvdmVyLmxheW91dCgpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldEhvdmVyVGFyZ2V0RWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCwgc3RvcEVsZW1lbnQ/OiBIVE1MRWxlbWVudCk6IEhUTUxFbGVtZW50IHtcblx0c3RvcEVsZW1lbnQgPSBzdG9wRWxlbWVudCA/PyBnZXRXaW5kb3coZWxlbWVudCkuZG9jdW1lbnQuYm9keTtcblx0d2hpbGUgKCFlbGVtZW50Lmhhc0F0dHJpYnV0ZSgnY3VzdG9tLWhvdmVyJykgJiYgZWxlbWVudCAhPT0gc3RvcEVsZW1lbnQpIHtcblx0XHRlbGVtZW50ID0gZWxlbWVudC5wYXJlbnRFbGVtZW50ITtcblx0fVxuXHRyZXR1cm4gZWxlbWVudDtcbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSUhvdmVyU2VydmljZSwgSG92ZXJTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcblxucmVnaXN0ZXJUaGVtaW5nUGFydGljaXBhbnQoKHRoZW1lLCBjb2xsZWN0b3IpID0+IHtcblx0Y29uc3QgaG92ZXJCb3JkZXIgPSB0aGVtZS5nZXRDb2xvcihlZGl0b3JIb3ZlckJvcmRlcik7XG5cdGlmIChob3ZlckJvcmRlcikge1xuXHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAubW9uYWNvLXdvcmtiZW5jaCAud29ya2JlbmNoLWhvdmVyIC5ob3Zlci1yb3c6bm90KDpmaXJzdC1jaGlsZCk6bm90KDplbXB0eSkgeyBib3JkZXItdG9wOiAxcHggc29saWQgJHtob3ZlckJvcmRlci50cmFuc3BhcmVudCgwLjUpfTsgfWApO1xuXHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAubW9uYWNvLXdvcmtiZW5jaCAud29ya2JlbmNoLWhvdmVyIGhyIHsgYm9yZGVyLXRvcDogMXB4IHNvbGlkICR7aG92ZXJCb3JkZXIudHJhbnNwYXJlbnQoMC41KX07IH1gKTtcblx0fVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG1CQUFtQjtBQUU1QixTQUFTLFlBQVksaUJBQThCLG9CQUFvQjtBQUN2RSxTQUFTLHVCQUF1QixXQUFXLGtCQUFrQiwyQkFBMkIsWUFBWSxXQUFXLGVBQWUseUJBQXlCO0FBQ3ZKLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsMEJBQTBCO0FBR25DLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsU0FBUyxvQkFBb0I7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
