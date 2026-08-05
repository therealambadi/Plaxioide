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
import { n } from "../../../../../../../base/browser/dom.js";
import { ActionBar } from "../../../../../../../base/browser/ui/actionbar/actionbar.js";
import { renderIcon } from "../../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { KeybindingLabel, unthemedKeybindingLabelOptions } from "../../../../../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { autorun, constObservable, derived, derivedWithStore, observableFromEvent, observableValue } from "../../../../../../../base/common/observable.js";
import { OS } from "../../../../../../../base/common/platform.js";
import { ThemeIcon } from "../../../../../../../base/common/themables.js";
import { localize } from "../../../../../../../nls.js";
import { ICommandService } from "../../../../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../../../../platform/contextkey/common/contextkey.js";
import { nativeHoverDelegate } from "../../../../../../../platform/hover/browser/hover.js";
import { IKeybindingService } from "../../../../../../../platform/keybinding/common/keybinding.js";
import { asCssVariable, descriptionForeground, editorActionListForeground, editorHoverBorder } from "../../../../../../../platform/theme/common/colorRegistry.js";
import { EditorOption } from "../../../../../../common/config/editorOptions.js";
import { hideInlineCompletionId, inlineSuggestCommitId, jumpToNextInlineEditId, toggleShowCollapsedId } from "../../../controller/commandIds.js";
import { InlineEditTabAction } from "../inlineEditsViewInterface.js";
let GutterIndicatorMenuContent = class {
  constructor(_model, _close, _editorObs, _contextKeyService, _keybindingService, _commandService) {
    this._model = _model;
    this._close = _close;
    this._editorObs = _editorObs;
    this._contextKeyService = _contextKeyService;
    this._keybindingService = _keybindingService;
    this._commandService = _commandService;
    this._inlineEditsShowCollapsed = this._editorObs.getOption(EditorOption.inlineSuggest).map((s) => s.edits.showCollapsed);
  }
  toDisposableLiveElement() {
    return this._createHoverContent().toDisposableLiveElement();
  }
  _createHoverContent() {
    const activeElement = observableValue("active", void 0);
    const createOptionArgs = (options) => {
      return {
        title: options.title,
        icon: options.icon,
        keybinding: typeof options.commandId === "string" ? this._getKeybinding(options.commandArgs ? void 0 : options.commandId) : derived((reader) => typeof options.commandId === "string" ? void 0 : this._getKeybinding(options.commandArgs ? void 0 : options.commandId.read(reader)).read(reader)),
        isActive: activeElement.map((v) => v === options.id),
        onHoverChange: (v) => activeElement.set(v ? options.id : void 0, void 0),
        onAction: () => {
          this._close(true);
          return this._commandService.executeCommand(typeof options.commandId === "string" ? options.commandId : options.commandId.get(), ...options.commandArgs ?? []);
        }
      };
    };
    const title = header(this._model.displayName);
    const gotoAndAccept = option(createOptionArgs({
      id: "gotoAndAccept",
      title: `${localize("goto", "Go To")} / ${localize("accept", "Accept")}`,
      icon: this._model.tabAction.map((action) => action === InlineEditTabAction.Accept ? Codicon.check : Codicon.arrowRight),
      commandId: this._model.tabAction.map((action) => action === InlineEditTabAction.Accept ? inlineSuggestCommitId : jumpToNextInlineEditId)
    }));
    const reject = option(createOptionArgs({
      id: "reject",
      title: localize("reject", "Reject"),
      icon: Codicon.close,
      commandId: hideInlineCompletionId
    }));
    const extensionCommands = this._model.extensionCommands.map((c, idx) => option(createOptionArgs({ id: c.id + "_" + idx, title: c.title, icon: Codicon.symbolEvent, commandId: c.id, commandArgs: c.arguments })));
    const toggleCollapsedMode = this._inlineEditsShowCollapsed.map(
      (showCollapsed) => showCollapsed ? option(createOptionArgs({
        id: "showExpanded",
        title: localize("showExpanded", "Show Expanded"),
        icon: Codicon.expandAll,
        commandId: toggleShowCollapsedId
      })) : option(createOptionArgs({
        id: "showCollapsed",
        title: localize("showCollapsed", "Show Collapsed"),
        icon: Codicon.collapseAll,
        commandId: toggleShowCollapsedId
      }))
    );
    const settings = option(createOptionArgs({
      id: "settings",
      title: localize("settings", "Settings"),
      icon: Codicon.gear,
      commandId: "workbench.action.openSettings",
      commandArgs: ["@tag:nextEditSuggestions"]
    }));
    const actions = this._model.action ? [this._model.action] : [];
    const actionBarFooter = actions.length > 0 ? actionBar(
      actions.map((action) => ({
        id: action.id,
        label: action.title,
        enabled: true,
        run: () => this._commandService.executeCommand(action.id, ...action.arguments ?? []),
        class: void 0,
        tooltip: action.tooltip ?? action.title
      })),
      {
        hoverDelegate: nativeHoverDelegate
        /* unable to show hover inside another hover */
      }
    ) : void 0;
    return hoverContent([
      title,
      gotoAndAccept,
      reject,
      toggleCollapsedMode,
      settings,
      extensionCommands.length ? separator() : void 0,
      ...extensionCommands,
      actionBarFooter ? separator() : void 0,
      actionBarFooter
    ]);
  }
  _getKeybinding(commandId) {
    if (!commandId) {
      return constObservable(void 0);
    }
    return observableFromEvent(this._contextKeyService.onDidChangeContext, () => this._keybindingService.lookupKeybinding(commandId));
  }
};
GutterIndicatorMenuContent = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, ICommandService)
], GutterIndicatorMenuContent);
function hoverContent(content) {
  return n.div({
    class: "content",
    style: {
      margin: 4,
      minWidth: 150
    }
  }, content);
}
function header(title) {
  return n.div({
    class: "header",
    style: {
      color: asCssVariable(descriptionForeground),
      fontSize: "12px",
      fontWeight: "600",
      padding: "0 10px",
      lineHeight: 26
    }
  }, [title]);
}
function option(props) {
  return derivedWithStore((_reader, store) => n.div({
    class: ["monaco-menu-option", props.isActive?.map((v) => v && "active")],
    onmouseenter: () => props.onHoverChange?.(true),
    onmouseleave: () => props.onHoverChange?.(false),
    onclick: props.onAction,
    onkeydown: (e) => {
      if (e.key === "Enter") {
        props.onAction?.();
      }
    },
    tabIndex: 0,
    style: {
      borderRadius: 3
      // same as hover widget border radius
    }
  }, [
    n.elem("span", {
      style: {
        fontSize: 16,
        display: "flex"
      }
    }, [ThemeIcon.isThemeIcon(props.icon) ? renderIcon(props.icon) : props.icon.map((icon) => renderIcon(icon))]),
    n.elem("span", {}, [props.title]),
    n.div({
      style: { marginLeft: "auto", opacity: "0.6" },
      ref: (elem) => {
        const keybindingLabel = store.add(new KeybindingLabel(elem, OS, { disableTitle: true, ...unthemedKeybindingLabelOptions }));
        store.add(autorun((reader) => {
          keybindingLabel.set(props.keybinding.read(reader));
        }));
      }
    })
  ]));
}
function actionBar(actions, options) {
  return derivedWithStore((_reader, store) => n.div({
    class: ["action-widget-action-bar"],
    style: {
      padding: "0 10px"
    }
  }, [
    n.div({
      ref: (elem) => {
        const actionBar2 = store.add(new ActionBar(elem, options));
        actionBar2.push(actions, { icon: false, label: true });
      }
    })
  ]));
}
function separator() {
  return n.div({
    id: "inline-edit-gutter-indicator-menu-separator",
    class: "menu-separator",
    style: {
      color: asCssVariable(editorActionListForeground),
      padding: "4px 0"
    }
  }, n.div({
    style: {
      borderBottom: `1px solid ${asCssVariable(editorHoverBorder)}`
    }
  }));
}
export {
  GutterIndicatorMenuContent
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvY29tcG9uZW50cy9ndXR0ZXJJbmRpY2F0b3JNZW51LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2hpbGROb2RlLCBMaXZlRWxlbWVudCwgbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyLCBJQWN0aW9uQmFyT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IHJlbmRlckljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaWNvbkxhYmVsL2ljb25MYWJlbHMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ0xhYmVsLCB1bnRoZW1lZEtleWJpbmRpbmdMYWJlbE9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkva2V5YmluZGluZ0xhYmVsL2tleWJpbmRpbmdMYWJlbC5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgUmVzb2x2ZWRLZXliaW5kaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5YmluZGluZ3MuanMnO1xuaW1wb3J0IHsgSU9ic2VydmFibGUsIGF1dG9ydW4sIGNvbnN0T2JzZXJ2YWJsZSwgZGVyaXZlZCwgZGVyaXZlZFdpdGhTdG9yZSwgb2JzZXJ2YWJsZUZyb21FdmVudCwgb2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBPUyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBuYXRpdmVIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IGFzQ3NzVmFyaWFibGUsIGRlc2NyaXB0aW9uRm9yZWdyb3VuZCwgZWRpdG9yQWN0aW9uTGlzdEZvcmVncm91bmQsIGVkaXRvckhvdmVyQm9yZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9icm93c2VyL29ic2VydmFibGVDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBoaWRlSW5saW5lQ29tcGxldGlvbklkLCBpbmxpbmVTdWdnZXN0Q29tbWl0SWQsIGp1bXBUb05leHRJbmxpbmVFZGl0SWQsIHRvZ2dsZVNob3dDb2xsYXBzZWRJZCB9IGZyb20gJy4uLy4uLy4uL2NvbnRyb2xsZXIvY29tbWFuZElkcy5qcyc7XG5pbXBvcnQgeyBJSW5saW5lRWRpdE1vZGVsLCBJbmxpbmVFZGl0VGFiQWN0aW9uIH0gZnJvbSAnLi4vaW5saW5lRWRpdHNWaWV3SW50ZXJmYWNlLmpzJztcbmltcG9ydCB7IEZpcnN0Rm5BcmcsIH0gZnJvbSAnLi4vdXRpbHMvdXRpbHMuanMnO1xuXG5leHBvcnQgY2xhc3MgR3V0dGVySW5kaWNhdG9yTWVudUNvbnRlbnQge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2lubGluZUVkaXRzU2hvd0NvbGxhcHNlZDogSU9ic2VydmFibGU8Ym9vbGVhbj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWw6IElJbmxpbmVFZGl0TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY2xvc2U6IChmb2N1c0VkaXRvcjogYm9vbGVhbikgPT4gdm9pZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JPYnM6IE9ic2VydmFibGVDb2RlRWRpdG9yLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLl9pbmxpbmVFZGl0c1Nob3dDb2xsYXBzZWQgPSB0aGlzLl9lZGl0b3JPYnMuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5pbmxpbmVTdWdnZXN0KS5tYXAocyA9PiBzLmVkaXRzLnNob3dDb2xsYXBzZWQpO1xuXHR9XG5cblx0cHVibGljIHRvRGlzcG9zYWJsZUxpdmVFbGVtZW50KCk6IExpdmVFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlSG92ZXJDb250ZW50KCkudG9EaXNwb3NhYmxlTGl2ZUVsZW1lbnQoKTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZUhvdmVyQ29udGVudCgpIHtcblx0XHRjb25zdCBhY3RpdmVFbGVtZW50ID0gb2JzZXJ2YWJsZVZhbHVlPHN0cmluZyB8IHVuZGVmaW5lZD4oJ2FjdGl2ZScsIHVuZGVmaW5lZCk7XG5cblx0XHRjb25zdCBjcmVhdGVPcHRpb25BcmdzID0gKG9wdGlvbnM6IHsgaWQ6IHN0cmluZzsgdGl0bGU6IHN0cmluZzsgaWNvbjogSU9ic2VydmFibGU8VGhlbWVJY29uPiB8IFRoZW1lSWNvbjsgY29tbWFuZElkOiBzdHJpbmcgfCBJT2JzZXJ2YWJsZTxzdHJpbmc+OyBjb21tYW5kQXJncz86IHVua25vd25bXSB9KTogRmlyc3RGbkFyZzx0eXBlb2Ygb3B0aW9uPiA9PiB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0aXRsZTogb3B0aW9ucy50aXRsZSxcblx0XHRcdFx0aWNvbjogb3B0aW9ucy5pY29uLFxuXHRcdFx0XHRrZXliaW5kaW5nOiB0eXBlb2Ygb3B0aW9ucy5jb21tYW5kSWQgPT09ICdzdHJpbmcnID8gdGhpcy5fZ2V0S2V5YmluZGluZyhvcHRpb25zLmNvbW1hbmRBcmdzID8gdW5kZWZpbmVkIDogb3B0aW9ucy5jb21tYW5kSWQpIDogZGVyaXZlZChyZWFkZXIgPT4gdHlwZW9mIG9wdGlvbnMuY29tbWFuZElkID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IHRoaXMuX2dldEtleWJpbmRpbmcob3B0aW9ucy5jb21tYW5kQXJncyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuY29tbWFuZElkLnJlYWQocmVhZGVyKSkucmVhZChyZWFkZXIpKSxcblx0XHRcdFx0aXNBY3RpdmU6IGFjdGl2ZUVsZW1lbnQubWFwKHYgPT4gdiA9PT0gb3B0aW9ucy5pZCksXG5cdFx0XHRcdG9uSG92ZXJDaGFuZ2U6IHYgPT4gYWN0aXZlRWxlbWVudC5zZXQodiA/IG9wdGlvbnMuaWQgOiB1bmRlZmluZWQsIHVuZGVmaW5lZCksXG5cdFx0XHRcdG9uQWN0aW9uOiAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fY2xvc2UodHJ1ZSk7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKHR5cGVvZiBvcHRpb25zLmNvbW1hbmRJZCA9PT0gJ3N0cmluZycgPyBvcHRpb25zLmNvbW1hbmRJZCA6IG9wdGlvbnMuY29tbWFuZElkLmdldCgpLCAuLi4ob3B0aW9ucy5jb21tYW5kQXJncyA/PyBbXSkpO1xuXHRcdFx0XHR9LFxuXHRcdFx0fTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgdGl0bGUgPSBoZWFkZXIodGhpcy5fbW9kZWwuZGlzcGxheU5hbWUpO1xuXG5cdFx0Y29uc3QgZ290b0FuZEFjY2VwdCA9IG9wdGlvbihjcmVhdGVPcHRpb25BcmdzKHtcblx0XHRcdGlkOiAnZ290b0FuZEFjY2VwdCcsXG5cdFx0XHR0aXRsZTogYCR7bG9jYWxpemUoJ2dvdG8nLCBcIkdvIFRvXCIpfSAvICR7bG9jYWxpemUoJ2FjY2VwdCcsIFwiQWNjZXB0XCIpfWAsXG5cdFx0XHRpY29uOiB0aGlzLl9tb2RlbC50YWJBY3Rpb24ubWFwKGFjdGlvbiA9PiBhY3Rpb24gPT09IElubGluZUVkaXRUYWJBY3Rpb24uQWNjZXB0ID8gQ29kaWNvbi5jaGVjayA6IENvZGljb24uYXJyb3dSaWdodCksXG5cdFx0XHRjb21tYW5kSWQ6IHRoaXMuX21vZGVsLnRhYkFjdGlvbi5tYXAoYWN0aW9uID0+IGFjdGlvbiA9PT0gSW5saW5lRWRpdFRhYkFjdGlvbi5BY2NlcHQgPyBpbmxpbmVTdWdnZXN0Q29tbWl0SWQgOiBqdW1wVG9OZXh0SW5saW5lRWRpdElkKVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHJlamVjdCA9IG9wdGlvbihjcmVhdGVPcHRpb25BcmdzKHtcblx0XHRcdGlkOiAncmVqZWN0Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgncmVqZWN0JywgXCJSZWplY3RcIiksXG5cdFx0XHRpY29uOiBDb2RpY29uLmNsb3NlLFxuXHRcdFx0Y29tbWFuZElkOiBoaWRlSW5saW5lQ29tcGxldGlvbklkXG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgZXh0ZW5zaW9uQ29tbWFuZHMgPSB0aGlzLl9tb2RlbC5leHRlbnNpb25Db21tYW5kcy5tYXAoKGMsIGlkeCkgPT4gb3B0aW9uKGNyZWF0ZU9wdGlvbkFyZ3MoeyBpZDogYy5pZCArICdfJyArIGlkeCwgdGl0bGU6IGMudGl0bGUsIGljb246IENvZGljb24uc3ltYm9sRXZlbnQsIGNvbW1hbmRJZDogYy5pZCwgY29tbWFuZEFyZ3M6IGMuYXJndW1lbnRzIH0pKSk7XG5cblx0XHRjb25zdCB0b2dnbGVDb2xsYXBzZWRNb2RlID0gdGhpcy5faW5saW5lRWRpdHNTaG93Q29sbGFwc2VkLm1hcChzaG93Q29sbGFwc2VkID0+IHNob3dDb2xsYXBzZWQgP1xuXHRcdFx0b3B0aW9uKGNyZWF0ZU9wdGlvbkFyZ3Moe1xuXHRcdFx0XHRpZDogJ3Nob3dFeHBhbmRlZCcsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnc2hvd0V4cGFuZGVkJywgXCJTaG93IEV4cGFuZGVkXCIpLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLmV4cGFuZEFsbCxcblx0XHRcdFx0Y29tbWFuZElkOiB0b2dnbGVTaG93Q29sbGFwc2VkSWRcblx0XHRcdH0pKVxuXHRcdFx0OiBvcHRpb24oY3JlYXRlT3B0aW9uQXJncyh7XG5cdFx0XHRcdGlkOiAnc2hvd0NvbGxhcHNlZCcsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnc2hvd0NvbGxhcHNlZCcsIFwiU2hvdyBDb2xsYXBzZWRcIiksXG5cdFx0XHRcdGljb246IENvZGljb24uY29sbGFwc2VBbGwsXG5cdFx0XHRcdGNvbW1hbmRJZDogdG9nZ2xlU2hvd0NvbGxhcHNlZElkXG5cdFx0XHR9KSlcblx0XHQpO1xuXG5cdFx0Y29uc3Qgc2V0dGluZ3MgPSBvcHRpb24oY3JlYXRlT3B0aW9uQXJncyh7XG5cdFx0XHRpZDogJ3NldHRpbmdzJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnc2V0dGluZ3MnLCBcIlNldHRpbmdzXCIpLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5nZWFyLFxuXHRcdFx0Y29tbWFuZElkOiAnd29ya2JlbmNoLmFjdGlvbi5vcGVuU2V0dGluZ3MnLFxuXHRcdFx0Y29tbWFuZEFyZ3M6IFsnQHRhZzpuZXh0RWRpdFN1Z2dlc3Rpb25zJ11cblx0XHR9KSk7XG5cblx0XHRjb25zdCBhY3Rpb25zID0gdGhpcy5fbW9kZWwuYWN0aW9uID8gW3RoaXMuX21vZGVsLmFjdGlvbl0gOiBbXTtcblx0XHRjb25zdCBhY3Rpb25CYXJGb290ZXIgPSBhY3Rpb25zLmxlbmd0aCA+IDAgPyBhY3Rpb25CYXIoXG5cdFx0XHRhY3Rpb25zLm1hcChhY3Rpb24gPT4gKHtcblx0XHRcdFx0aWQ6IGFjdGlvbi5pZCxcblx0XHRcdFx0bGFiZWw6IGFjdGlvbi50aXRsZSxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChhY3Rpb24uaWQsIC4uLihhY3Rpb24uYXJndW1lbnRzID8/IFtdKSksXG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdHRvb2x0aXA6IGFjdGlvbi50b29sdGlwID8/IGFjdGlvbi50aXRsZVxuXHRcdFx0fSkpLFxuXHRcdFx0eyBob3ZlckRlbGVnYXRlOiBuYXRpdmVIb3ZlckRlbGVnYXRlIC8qIHVuYWJsZSB0byBzaG93IGhvdmVyIGluc2lkZSBhbm90aGVyIGhvdmVyICovIH1cblx0XHQpIDogdW5kZWZpbmVkO1xuXG5cdFx0cmV0dXJuIGhvdmVyQ29udGVudChbXG5cdFx0XHR0aXRsZSxcblx0XHRcdGdvdG9BbmRBY2NlcHQsXG5cdFx0XHRyZWplY3QsXG5cdFx0XHR0b2dnbGVDb2xsYXBzZWRNb2RlLFxuXHRcdFx0c2V0dGluZ3MsXG5cblx0XHRcdGV4dGVuc2lvbkNvbW1hbmRzLmxlbmd0aCA/IHNlcGFyYXRvcigpIDogdW5kZWZpbmVkLFxuXHRcdFx0Li4uZXh0ZW5zaW9uQ29tbWFuZHMsXG5cblx0XHRcdGFjdGlvbkJhckZvb3RlciA/IHNlcGFyYXRvcigpIDogdW5kZWZpbmVkLFxuXHRcdFx0YWN0aW9uQmFyRm9vdGVyXG5cdFx0XSk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRLZXliaW5kaW5nKGNvbW1hbmRJZDogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKCFjb21tYW5kSWQpIHtcblx0XHRcdHJldHVybiBjb25zdE9ic2VydmFibGUodW5kZWZpbmVkKTtcblx0XHR9XG5cdFx0cmV0dXJuIG9ic2VydmFibGVGcm9tRXZlbnQodGhpcy5fY29udGV4dEtleVNlcnZpY2Uub25EaWRDaGFuZ2VDb250ZXh0LCAoKSA9PiB0aGlzLl9rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGNvbW1hbmRJZCkpOyAvLyBUT0RPOiB1c2UgY29udGV4dGtleXNlcnZpY2UgdG8gdXNlIGRpZmZlcmVudCByZW5kZXJpbmdzXG5cdH1cbn1cblxuZnVuY3Rpb24gaG92ZXJDb250ZW50KGNvbnRlbnQ6IENoaWxkTm9kZSkge1xuXHRyZXR1cm4gbi5kaXYoe1xuXHRcdGNsYXNzOiAnY29udGVudCcsXG5cdFx0c3R5bGU6IHtcblx0XHRcdG1hcmdpbjogNCxcblx0XHRcdG1pbldpZHRoOiAxNTAsXG5cdFx0fVxuXHR9LCBjb250ZW50KTtcbn1cblxuZnVuY3Rpb24gaGVhZGVyKHRpdGxlOiBzdHJpbmcgfCBJT2JzZXJ2YWJsZTxzdHJpbmc+KSB7XG5cdHJldHVybiBuLmRpdih7XG5cdFx0Y2xhc3M6ICdoZWFkZXInLFxuXHRcdHN0eWxlOiB7XG5cdFx0XHRjb2xvcjogYXNDc3NWYXJpYWJsZShkZXNjcmlwdGlvbkZvcmVncm91bmQpLFxuXHRcdFx0Zm9udFNpemU6ICcxMnB4Jyxcblx0XHRcdGZvbnRXZWlnaHQ6ICc2MDAnLFxuXHRcdFx0cGFkZGluZzogJzAgMTBweCcsXG5cdFx0XHRsaW5lSGVpZ2h0OiAyNixcblx0XHR9XG5cdH0sIFt0aXRsZV0pO1xufVxuXG5mdW5jdGlvbiBvcHRpb24ocHJvcHM6IHtcblx0dGl0bGU6IHN0cmluZztcblx0aWNvbjogSU9ic2VydmFibGU8VGhlbWVJY29uPiB8IFRoZW1lSWNvbjtcblx0a2V5YmluZGluZzogSU9ic2VydmFibGU8UmVzb2x2ZWRLZXliaW5kaW5nIHwgdW5kZWZpbmVkPjtcblx0aXNBY3RpdmU/OiBJT2JzZXJ2YWJsZTxib29sZWFuPjtcblx0b25Ib3ZlckNoYW5nZT86IChpc0hvdmVyZWQ6IGJvb2xlYW4pID0+IHZvaWQ7XG5cdG9uQWN0aW9uPzogKCkgPT4gdm9pZDtcbn0pIHtcblx0cmV0dXJuIGRlcml2ZWRXaXRoU3RvcmUoKF9yZWFkZXIsIHN0b3JlKSA9PiBuLmRpdih7XG5cdFx0Y2xhc3M6IFsnbW9uYWNvLW1lbnUtb3B0aW9uJywgcHJvcHMuaXNBY3RpdmU/Lm1hcCh2ID0+IHYgJiYgJ2FjdGl2ZScpXSxcblx0XHRvbm1vdXNlZW50ZXI6ICgpID0+IHByb3BzLm9uSG92ZXJDaGFuZ2U/Lih0cnVlKSxcblx0XHRvbm1vdXNlbGVhdmU6ICgpID0+IHByb3BzLm9uSG92ZXJDaGFuZ2U/LihmYWxzZSksXG5cdFx0b25jbGljazogcHJvcHMub25BY3Rpb24sXG5cdFx0b25rZXlkb3duOiBlID0+IHtcblx0XHRcdGlmIChlLmtleSA9PT0gJ0VudGVyJykge1xuXHRcdFx0XHRwcm9wcy5vbkFjdGlvbj8uKCk7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHR0YWJJbmRleDogMCxcblx0XHRzdHlsZToge1xuXHRcdFx0Ym9yZGVyUmFkaXVzOiAzLCAvLyBzYW1lIGFzIGhvdmVyIHdpZGdldCBib3JkZXIgcmFkaXVzXG5cdFx0fVxuXHR9LCBbXG5cdFx0bi5lbGVtKCdzcGFuJywge1xuXHRcdFx0c3R5bGU6IHtcblx0XHRcdFx0Zm9udFNpemU6IDE2LFxuXHRcdFx0XHRkaXNwbGF5OiAnZmxleCcsXG5cdFx0XHR9XG5cdFx0fSwgW1RoZW1lSWNvbi5pc1RoZW1lSWNvbihwcm9wcy5pY29uKSA/IHJlbmRlckljb24ocHJvcHMuaWNvbikgOiBwcm9wcy5pY29uLm1hcChpY29uID0+IHJlbmRlckljb24oaWNvbikpXSksXG5cdFx0bi5lbGVtKCdzcGFuJywge30sIFtwcm9wcy50aXRsZV0pLFxuXHRcdG4uZGl2KHtcblx0XHRcdHN0eWxlOiB7IG1hcmdpbkxlZnQ6ICdhdXRvJywgb3BhY2l0eTogJzAuNicgfSxcblx0XHRcdHJlZjogZWxlbSA9PiB7XG5cdFx0XHRcdGNvbnN0IGtleWJpbmRpbmdMYWJlbCA9IHN0b3JlLmFkZChuZXcgS2V5YmluZGluZ0xhYmVsKGVsZW0sIE9TLCB7IGRpc2FibGVUaXRsZTogdHJ1ZSwgLi4udW50aGVtZWRLZXliaW5kaW5nTGFiZWxPcHRpb25zIH0pKTtcblx0XHRcdFx0c3RvcmUuYWRkKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdFx0XHRrZXliaW5kaW5nTGFiZWwuc2V0KHByb3BzLmtleWJpbmRpbmcucmVhZChyZWFkZXIpKTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdH0pXG5cdF0pKTtcbn1cblxuLy8gVE9ETzogbWFrZSB0aGlzIG9ic2VydmFibGVcbmZ1bmN0aW9uIGFjdGlvbkJhcihhY3Rpb25zOiBJQWN0aW9uW10sIG9wdGlvbnM6IElBY3Rpb25CYXJPcHRpb25zKSB7XG5cdHJldHVybiBkZXJpdmVkV2l0aFN0b3JlKChfcmVhZGVyLCBzdG9yZSkgPT4gbi5kaXYoe1xuXHRcdGNsYXNzOiBbJ2FjdGlvbi13aWRnZXQtYWN0aW9uLWJhciddLFxuXHRcdHN0eWxlOiB7XG5cdFx0XHRwYWRkaW5nOiAnMCAxMHB4Jyxcblx0XHR9XG5cdH0sIFtcblx0XHRuLmRpdih7XG5cdFx0XHRyZWY6IGVsZW0gPT4ge1xuXHRcdFx0XHRjb25zdCBhY3Rpb25CYXIgPSBzdG9yZS5hZGQobmV3IEFjdGlvbkJhcihlbGVtLCBvcHRpb25zKSk7XG5cdFx0XHRcdGFjdGlvbkJhci5wdXNoKGFjdGlvbnMsIHsgaWNvbjogZmFsc2UsIGxhYmVsOiB0cnVlIH0pO1xuXHRcdFx0fVxuXHRcdH0pXG5cdF0pKTtcbn1cblxuZnVuY3Rpb24gc2VwYXJhdG9yKCkge1xuXHRyZXR1cm4gbi5kaXYoe1xuXHRcdGlkOiAnaW5saW5lLWVkaXQtZ3V0dGVyLWluZGljYXRvci1tZW51LXNlcGFyYXRvcicsXG5cdFx0Y2xhc3M6ICdtZW51LXNlcGFyYXRvcicsXG5cdFx0c3R5bGU6IHtcblx0XHRcdGNvbG9yOiBhc0Nzc1ZhcmlhYmxlKGVkaXRvckFjdGlvbkxpc3RGb3JlZ3JvdW5kKSxcblx0XHRcdHBhZGRpbmc6ICc0cHggMCcsXG5cdFx0fVxuXHR9LCBuLmRpdih7XG5cdFx0c3R5bGU6IHtcblx0XHRcdGJvcmRlckJvdHRvbTogYDFweCBzb2xpZCAke2FzQ3NzVmFyaWFibGUoZWRpdG9ySG92ZXJCb3JkZXIpfWAsXG5cdFx0fVxuXHR9KSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQWlDLFNBQVM7QUFDMUMsU0FBUyxpQkFBb0M7QUFDN0MsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxpQkFBaUIsc0NBQXNDO0FBRWhFLFNBQVMsZUFBZTtBQUV4QixTQUFzQixTQUFTLGlCQUFpQixTQUFTLGtCQUFrQixxQkFBcUIsdUJBQXVCO0FBQ3ZILFNBQVMsVUFBVTtBQUNuQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGVBQWUsdUJBQXVCLDRCQUE0Qix5QkFBeUI7QUFFcEcsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyx3QkFBd0IsdUJBQXVCLHdCQUF3Qiw2QkFBNkI7QUFDN0csU0FBMkIsMkJBQTJCO0FBRy9DLElBQU0sNkJBQU4sTUFBaUM7QUFBQSxFQUl2QyxZQUNrQixRQUNBLFFBQ0EsWUFDb0Isb0JBQ0Esb0JBQ0gsaUJBQ2pDO0FBTmdCO0FBQ0E7QUFDQTtBQUNvQjtBQUNBO0FBQ0g7QUFFbEMsU0FBSyw0QkFBNEIsS0FBSyxXQUFXLFVBQVUsYUFBYSxhQUFhLEVBQUUsSUFBSSxPQUFLLEVBQUUsTUFBTSxhQUFhO0FBQUEsRUFDdEg7QUFBQSxFQUVPLDBCQUF1QztBQUM3QyxXQUFPLEtBQUssb0JBQW9CLEVBQUUsd0JBQXdCO0FBQUEsRUFDM0Q7QUFBQSxFQUVRLHNCQUFzQjtBQUM3QixVQUFNLGdCQUFnQixnQkFBb0MsVUFBVSxNQUFTO0FBRTdFLFVBQU0sbUJBQW1CLENBQUMsWUFBa0w7QUFDM00sYUFBTztBQUFBLFFBQ04sT0FBTyxRQUFR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
