import { CancellationToken } from "../../../base/common/cancellation.js";
import { Emitter } from "../../../base/common/event.js";
import { dispose } from "../../../base/common/lifecycle.js";
import { MainContext } from "./extHost.protocol.js";
import { URI } from "../../../base/common/uri.js";
import { ThemeIcon, QuickInputButtons, QuickPickItemKind, InputBoxValidationSeverity } from "./extHostTypes.js";
import { isCancellationError } from "../../../base/common/errors.js";
import { coalesce } from "../../../base/common/arrays.js";
import Severity from "../../../base/common/severity.js";
import { ThemeIcon as ThemeIconUtils } from "../../../base/common/themables.js";
import { isProposedApiEnabled } from "../../services/extensions/common/extensions.js";
import { MarkdownString } from "./extHostTypeConverters.js";
function createExtHostQuickOpen(mainContext, workspace, commands) {
  const proxy = mainContext.getProxy(MainContext.MainThreadQuickOpen);
  class ExtHostQuickOpenImpl {
    constructor(workspace2, commands2) {
      this._sessions = /* @__PURE__ */ new Map();
      this._instances = 0;
      this._workspace = workspace2;
      this._commands = commands2;
    }
    showQuickPick(extension, itemsOrItemsPromise, options, token = CancellationToken.None) {
      this._onDidSelectItem = void 0;
      const itemsPromise = Promise.resolve(itemsOrItemsPromise);
      const instance = ++this._instances;
      const quickPickWidget = proxy.$show(instance, {
        title: options?.title,
        placeHolder: options?.placeHolder,
        matchOnDescription: options?.matchOnDescription,
        matchOnDetail: options?.matchOnDetail,
        ignoreFocusLost: options?.ignoreFocusOut,
        canPickMany: options?.canPickMany
      }, token);
      const widgetClosedMarker = {};
      const widgetClosedPromise = quickPickWidget.then(() => widgetClosedMarker);
      return Promise.race([widgetClosedPromise, itemsPromise]).then((result) => {
        if (result === widgetClosedMarker) {
          return void 0;
        }
        const allowedTooltips = isProposedApiEnabled(extension, "quickPickItemTooltip");
        return itemsPromise.then((items) => {
          const pickItems = [];
          for (let handle = 0; handle < items.length; handle++) {
            const item = items[handle];
            if (typeof item === "string") {
              pickItems.push({ label: item, handle });
            } else if (item.kind === QuickPickItemKind.Separator) {
              pickItems.push({ type: "separator", label: item.label });
            } else {
              if (item.tooltip && !allowedTooltips) {
                console.warn(`Extension '${extension.identifier.value}' uses a tooltip which is proposed API that is only available when running out of dev or with the following command line switch: --enable-proposed-api ${extension.identifier.value}`);
              }
              const icon = item.iconPath ? getIconPathOrClass(item.iconPath) : void 0;
              pickItems.push({
                label: item.label,
                iconPath: icon?.iconPath,
                iconClass: icon?.iconClass,
                description: item.description,
                detail: item.detail,
                picked: item.picked,
                alwaysShow: item.alwaysShow,
                tooltip: allowedTooltips ? MarkdownString.fromStrict(item.tooltip) : void 0,
                handle
              });
            }
          }
          if (options && typeof options.onDidSelectItem === "function") {
            this._onDidSelectItem = (handle) => {
              options.onDidSelectItem(items[handle]);
            };
          }
          proxy.$setItems(instance, pickItems);
          return quickPickWidget.then((handle) => {
            if (typeof handle === "number") {
              return items[handle];
            } else if (Array.isArray(handle)) {
              return handle.map((h) => items[h]);
            }
            return void 0;
          });
        });
      }).then(void 0, (err) => {
        if (isCancellationError(err)) {
          return void 0;
        }
        proxy.$setError(instance, err);
        return Promise.reject(err);
      });
    }
    $onItemSelected(handle) {
      this._onDidSelectItem?.(handle);
    }
    // ---- input
    showInput(options, token = CancellationToken.None) {
      this._validateInput = options?.validateInput;
      return proxy.$input(options, typeof this._validateInput === "function", token).then(void 0, (err) => {
        if (isCancellationError(err)) {
          return void 0;
        }
        return Promise.reject(err);
      });
    }
    async $validateInput(input) {
      if (!this._validateInput) {
        return;
      }
      const result = await this._validateInput(input);
      if (!result || typeof result === "string") {
        return result;
      }
      let severity;
      switch (result.severity) {
        case InputBoxValidationSeverity.Info:
          severity = Severity.Info;
          break;
        case InputBoxValidationSeverity.Warning:
          severity = Severity.Warning;
          break;
        case InputBoxValidationSeverity.Error:
          severity = Severity.Error;
          break;
        default:
          severity = result.message ? Severity.Error : Severity.Ignore;
          break;
      }
      return {
        content: result.message,
        severity
      };
    }
    // ---- workspace folder picker
    async showWorkspaceFolderPick(options, token = CancellationToken.None) {
      const selectedFolder = await this._commands.executeCommand("_workbench.pickWorkspaceFolder", [options]);
      if (!selectedFolder) {
        return void 0;
      }
      const workspaceFolders = await this._workspace.getWorkspaceFolders2();
      if (!workspaceFolders) {
        return void 0;
      }
      return workspaceFolders.find((folder) => folder.uri.toString() === selectedFolder.uri.toString());
    }
    // ---- QuickInput
    createQuickPick(extension) {
      const session = new ExtHostQuickPick(extension, () => this._sessions.delete(session._id));
      this._sessions.set(session._id, session);
      return session;
    }
    createInputBox(extension) {
      const session = new ExtHostInputBox(extension, () => this._sessions.delete(session._id));
      this._sessions.set(session._id, session);
      return session;
    }
    $onDidChangeValue(sessionId, value) {
      const session = this._sessions.get(sessionId);
      session?._fireDidChangeValue(value);
    }
    $onDidAccept(sessionId) {
      const session = this._sessions.get(sessionId);
      session?._fireDidAccept();
    }
    $onDidChangeActive(sessionId, handles) {
      const session = this._sessions.get(sessionId);
      if (session instanceof ExtHostQuickPick) {
        session._fireDidChangeActive(handles);
      }
    }
    $onDidChangeSelection(sessionId, handles) {
      const session = this._sessions.get(sessionId);
      if (session instanceof ExtHostQuickPick) {
        session._fireDidChangeSelection(handles);
      }
    }
    $onDidTriggerButton(sessionId, handle) {
      const session = this._sessions.get(sessionId);
      session?._fireDidTriggerButton(handle);
    }
    $onDidTriggerItemButton(sessionId, itemHandle, buttonHandle) {
      const session = this._sessions.get(sessionId);
      if (session instanceof ExtHostQuickPick) {
        session._fireDidTriggerItemButton(itemHandle, buttonHandle);
      }
    }
    $onDidHide(sessionId) {
      const session = this._sessions.get(sessionId);
      session?._fireDidHide();
    }
  }
  class ExtHostQuickInput {
    constructor(_extension, _onDidDispose) {
      this._extension = _extension;
      this._onDidDispose = _onDidDispose;
      this._id = ExtHostQuickPick._nextId++;
      this._visible = false;
      this._expectingHide = false;
      this._enabled = true;
      this._busy = false;
      this._ignoreFocusOut = true;
      this._value = "";
      this._valueSelection = void 0;
      this._buttons = [];
      this._handlesToButtons = /* @__PURE__ */ new Map();
      this._onDidAcceptEmitter = new Emitter();
      this._onDidChangeValueEmitter = new Emitter();
      this._onDidTriggerButtonEmitter = new Emitter();
      this._onDidHideEmitter = new Emitter();
      this._pendingUpdate = { id: this._id };
      this._disposed = false;
      this._disposables = [
        this._onDidTriggerButtonEmitter,
        this._onDidHideEmitter,
        this._onDidAcceptEmitter,
        this._onDidChangeValueEmitter
      ];
      this.onDidChangeValue = this._onDidChangeValueEmitter.event;
      this.onDidAccept = this._onDidAcceptEmitter.event;
      this.onDidTriggerButton = this._onDidTriggerButtonEmitter.event;
      this.onDidHide = this._onDidHideEmitter.event;
    }
    get title() {
      return this._title;
    }
    set title(title) {
      this._title = title;
      this.update({ title });
    }
    get step() {
      return this._steps;
    }
    set step(step) {
      this._steps = step;
      this.update({ step });
    }
    get totalSteps() {
      return this._totalSteps;
    }
    set totalSteps(totalSteps) {
      this._totalSteps = totalSteps;
      this.update({ totalSteps });
    }
    get enabled() {
      return this._enabled;
    }
    set enabled(enabled) {
      this._enabled = enabled;
      this.update({ enabled });
    }
    get busy() {
      return this._busy;
    }
    set busy(busy) {
      this._busy = busy;
      this.update({ busy });
    }
    get ignoreFocusOut() {
      return this._ignoreFocusOut;
    }
    set ignoreFocusOut(ignoreFocusOut) {
      this._ignoreFocusOut = ignoreFocusOut;
      this.update({ ignoreFocusOut });
    }
    get value() {
      return this._value;
    }
    set value(value) {
      this._value = value;
      this.update({ value });
    }
    get valueSelection() {
      return this._valueSelection;
    }
    set valueSelection(valueSelection) {
      this._valueSelection = valueSelection;
      this.update({ valueSelection });
    }
    get placeholder() {
      return this._placeholder;
    }
    set placeholder(placeholder) {
      this._placeholder = placeholder;
      this.update({ placeholder });
    }
    get buttons() {
      return this._buttons;
    }
    set buttons(buttons) {
      const allowedButtonLocation = isProposedApiEnabled(this._extension, "quickInputButtonLocation");
      if (!allowedButtonLocation && buttons.some((button) => button.location)) {
        console.warn(`Extension '${this._extension.identifier.value}' uses a button location which is proposed API that is only available when running out of dev or with the following command line switch: --enable-proposed-api ${this._extension.identifier.value}`);
      }
      this._buttons = buttons.slice();
      this._handlesToButtons.clear();
      buttons.forEach((button, i) => {
        const handle = button === QuickInputButtons.Back ? -1 : i;
        this._handlesToButtons.set(handle, button);
      });
      this.update({
        buttons: buttons.map((button, i) => {
          return {
            ...getIconPathOrClass(button.iconPath),
            tooltip: button.tooltip,
            handle: button === QuickInputButtons.Back ? -1 : i,
            location: allowedButtonLocation ? button.location : void 0
          };
        })
      });
    }
    show() {
      this._visible = true;
      this._expectingHide = true;
      this.update({ visible: true });
    }
    hide() {
      this._visible = false;
      this.update({ visible: false });
    }
    _fireDidAccept() {
      this._onDidAcceptEmitter.fire();
    }
    _fireDidChangeValue(value) {
      this._value = value;
      this._onDidChangeValueEmitter.fire(value);
    }
    _fireDidTriggerButton(handle) {
      const button = this._handlesToButtons.get(handle);
      if (button) {
        this._onDidTriggerButtonEmitter.fire(button);
      }
    }
    _fireDidHide() {
      if (this._expectingHide) {
        this._expectingHide = this._visible;
        this._onDidHideEmitter.fire();
      }
    }
    dispose() {
      if (this._disposed) {
        return;
      }
      this._disposed = true;
      this._fireDidHide();
      this._disposables = dispose(this._disposables);
      if (this._updateTimeout) {
        clearTimeout(this._updateTimeout);
        this._updateTimeout = void 0;
      }
      this._onDidDispose();
      proxy.$dispose(this._id);
    }
    update(properties) {
      if (this._disposed) {
        return;
      }
      for (const key of Object.keys(properties)) {
        const value = properties[key];
        this._pendingUpdate[key] = value === void 0 ? null : value;
      }
      if ("visible" in this._pendingUpdate) {
        if (this._updateTimeout) {
          clearTimeout(this._updateTimeout);
          this._updateTimeout = void 0;
        }
        this.dispatchUpdate();
      } else if (this._visible && !this._updateTimeout) {
        this._updateTimeout = setTimeout(() => {
          this._updateTimeout = void 0;
          this.dispatchUpdate();
        }, 0);
      }
    }
    dispatchUpdate() {
      proxy.$createOrUpdate(this._pendingUpdate);
      this._pendingUpdate = { id: this._id };
    }
  }
  ExtHostQuickInput._nextId = 1;
  function getIconUris(iconPath) {
    if (iconPath instanceof ThemeIcon) {
      return { id: iconPath.id };
    }
    const dark = getDarkIconUri(iconPath);
    const light = getLightIconUri(iconPath);
    return {
      dark: typeof dark === "string" ? URI.file(dark) : dark,
      light: typeof light === "string" ? URI.file(light) : light
    };
  }
  function getLightIconUri(iconPath) {
    return typeof iconPath === "object" && "light" in iconPath ? iconPath.light : iconPath;
  }
  function getDarkIconUri(iconPath) {
    return typeof iconPath === "object" && "dark" in iconPath ? iconPath.dark : iconPath;
  }
  function getIconPathOrClass(icon) {
    const iconPathOrIconClass = getIconUris(icon);
    let iconPath;
    let iconClass;
    if ("id" in iconPathOrIconClass) {
      iconClass = ThemeIconUtils.asClassName(iconPathOrIconClass);
    } else {
      iconPath = iconPathOrIconClass;
    }
    return {
      iconPath,
      iconClass
    };
  }
  class ExtHostQuickPick extends ExtHostQuickInput {
    constructor(extension, onDispose) {
      super(extension, onDispose);
      this._items = [];
      this._handlesToItems = /* @__PURE__ */ new Map();
      this._itemsToHandles = /* @__PURE__ */ new Map();
      this._canSelectMany = false;
      this._matchOnDescription = true;
      this._matchOnDetail = true;
      this._sortByLabel = true;
      this._keepScrollPosition = false;
      this._activeItems = [];
      this._onDidChangeActiveEmitter = new Emitter();
      this._selectedItems = [];
      this._onDidChangeSelectionEmitter = new Emitter();
      this._onDidTriggerItemButtonEmitter = new Emitter();
      this.onDidChangeActive = this._onDidChangeActiveEmitter.event;
      this.onDidChangeSelection = this._onDidChangeSelectionEmitter.event;
      this.onDidTriggerItemButton = this._onDidTriggerItemButtonEmitter.event;
      this._disposables.push(
        this._onDidChangeActiveEmitter,
        this._onDidChangeSelectionEmitter,
        this._onDidTriggerItemButtonEmitter
      );
      this.update({ type: "quickPick" });
    }
    get items() {
      return this._items;
    }
    set items(items) {
      this._items = items.slice();
      this._handlesToItems.clear();
      this._itemsToHandles.clear();
      items.forEach((item, i) => {
        this._handlesToItems.set(i, item);
        this._itemsToHandles.set(item, i);
      });
      const allowedTooltips = isProposedApiEnabled(this._extension, "quickPickItemTooltip");
      const pickItems = [];
      for (let handle = 0; handle < items.length; handle++) {
        const item = items[handle];
        if (item.kind === QuickPickItemKind.Separator) {
          pickItems.push({ type: "separator", label: item.label });
        } else {
          if (item.tooltip && !allowedTooltips) {
            console.warn(`Extension '${this._extension.identifier.value}' uses a tooltip which is proposed API that is only available when running out of dev or with the following command line switch: --enable-proposed-api ${this._extension.identifier.value}`);
          }
          const icon = item.iconPath ? getIconPathOrClass(item.iconPath) : void 0;
          pickItems.push({
            handle,
            label: item.label,
            iconPath: icon?.iconPath,
            iconClass: icon?.iconClass,
            description: item.description,
            detail: item.detail,
            picked: item.picked,
            alwaysShow: item.alwaysShow,
            tooltip: allowedTooltips ? MarkdownString.fromStrict(item.tooltip) : void 0,
            buttons: item.buttons?.map((button, i) => {
              return {
                ...getIconPathOrClass(button.iconPath),
                tooltip: button.tooltip,
                handle: i
              };
            })
          });
        }
      }
      this.update({
        items: pickItems
      });
    }
    get canSelectMany() {
      return this._canSelectMany;
    }
    set canSelectMany(canSelectMany) {
      this._canSelectMany = canSelectMany;
      this.update({ canSelectMany });
    }
    get matchOnDescription() {
      return this._matchOnDescription;
    }
    set matchOnDescription(matchOnDescription) {
      this._matchOnDescription = matchOnDescription;
      this.update({ matchOnDescription });
    }
    get matchOnDetail() {
      return this._matchOnDetail;
    }
    set matchOnDetail(matchOnDetail) {
      this._matchOnDetail = matchOnDetail;
      this.update({ matchOnDetail });
    }
    get sortByLabel() {
      return this._sortByLabel;
    }
    set sortByLabel(sortByLabel) {
      this._sortByLabel = sortByLabel;
      this.update({ sortByLabel });
    }
    get keepScrollPosition() {
      return this._keepScrollPosition;
    }
    set keepScrollPosition(keepScrollPosition) {
      this._keepScrollPosition = keepScrollPosition;
      this.update({ keepScrollPosition });
    }
    get activeItems() {
      return this._activeItems;
    }
    set activeItems(activeItems) {
      this._activeItems = activeItems.filter((item) => this._itemsToHandles.has(item));
      this.update({ activeItems: this._activeItems.map((item) => this._itemsToHandles.get(item)) });
    }
    get selectedItems() {
      return this._selectedItems;
    }
    set selectedItems(selectedItems) {
      this._selectedItems = selectedItems.filter((item) => this._itemsToHandles.has(item));
      this.update({ selectedItems: this._selectedItems.map((item) => this._itemsToHandles.get(item)) });
    }
    _fireDidChangeActive(handles) {
      const items = coalesce(handles.map((handle) => this._handlesToItems.get(handle)));
      this._activeItems = items;
      this._onDidChangeActiveEmitter.fire(items);
    }
    _fireDidChangeSelection(handles) {
      const items = coalesce(handles.map((handle) => this._handlesToItems.get(handle)));
      this._selectedItems = items;
      this._onDidChangeSelectionEmitter.fire(items);
    }
    _fireDidTriggerItemButton(itemHandle, buttonHandle) {
      const item = this._handlesToItems.get(itemHandle);
      if (!item || !item.buttons || !item.buttons.length) {
        return;
      }
      const button = item.buttons[buttonHandle];
      if (button) {
        this._onDidTriggerItemButtonEmitter.fire({
          button,
          item
        });
      }
    }
  }
  class ExtHostInputBox extends ExtHostQuickInput {
    constructor(extension, onDispose) {
      super(extension, onDispose);
      this._password = false;
      this.update({ type: "inputBox" });
    }
    get password() {
      return this._password;
    }
    set password(password) {
      this._password = password;
      this.update({ password });
    }
    get prompt() {
      return this._prompt;
    }
    set prompt(prompt) {
      this._prompt = prompt;
      this.update({ prompt });
    }
    get validationMessage() {
      return this._validationMessage;
    }
    set validationMessage(validationMessage) {
      this._validationMessage = validationMessage;
      if (!validationMessage) {
        this.update({ validationMessage: void 0, severity: Severity.Ignore });
      } else if (typeof validationMessage === "string") {
        this.update({ validationMessage, severity: Severity.Error });
      } else {
        this.update({ validationMessage: validationMessage.message, severity: validationMessage.severity ?? Severity.Error });
      }
    }
  }
  return new ExtHostQuickOpenImpl(workspace, commands);
}
export {
  createExtHostQuickOpen
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0UXVpY2tPcGVuLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGRpc3Bvc2UsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEV4dEhvc3RDb21tYW5kcyB9IGZyb20gJy4vZXh0SG9zdENvbW1hbmRzLmpzJztcbmltcG9ydCB7IElFeHRIb3N0V29ya3NwYWNlUHJvdmlkZXIgfSBmcm9tICcuL2V4dEhvc3RXb3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSW5wdXRCb3gsIElucHV0Qm94T3B0aW9ucywgSW5wdXRCb3hWYWxpZGF0aW9uTWVzc2FnZSwgUXVpY2tJbnB1dCwgUXVpY2tJbnB1dEJ1dHRvbiwgUXVpY2tQaWNrLCBRdWlja1BpY2tJdGVtLCBRdWlja1BpY2tJdGVtQnV0dG9uRXZlbnQsIFF1aWNrUGlja09wdGlvbnMsIFdvcmtzcGFjZUZvbGRlciwgV29ya3NwYWNlRm9sZGVyUGlja09wdGlvbnMgfSBmcm9tICd2c2NvZGUnO1xuaW1wb3J0IHsgRXh0SG9zdFF1aWNrT3BlblNoYXBlLCBJTWFpbkNvbnRleHQsIE1haW5Db250ZXh0LCBUcmFuc2ZlclF1aWNrSW5wdXQsIFRyYW5zZmVyUXVpY2tJbnB1dEJ1dHRvbiwgVHJhbnNmZXJRdWlja1BpY2tJdGVtT3JTZXBhcmF0b3IgfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiwgUXVpY2tJbnB1dEJ1dHRvbnMsIFF1aWNrUGlja0l0ZW1LaW5kLCBJbnB1dEJveFZhbGlkYXRpb25TZXZlcml0eSB9IGZyb20gJy4vZXh0SG9zdFR5cGVzLmpzJztcbmltcG9ydCB7IGlzQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIGFzIFRoZW1lSWNvblV0aWxzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGlzUHJvcG9zZWRBcGlFbmFibGVkIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blN0cmluZyB9IGZyb20gJy4vZXh0SG9zdFR5cGVDb252ZXJ0ZXJzLmpzJztcblxuZXhwb3J0IHR5cGUgSXRlbSA9IHN0cmluZyB8IFF1aWNrUGlja0l0ZW07XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXh0SG9zdFF1aWNrT3BlbiB7XG5cdHNob3dRdWlja1BpY2soZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGl0ZW1zT3JJdGVtc1Byb21pc2U6IFF1aWNrUGlja0l0ZW1bXSB8IFByb21pc2U8UXVpY2tQaWNrSXRlbVtdPiwgb3B0aW9uczogUXVpY2tQaWNrT3B0aW9ucyAmIHsgY2FuUGlja01hbnk6IHRydWUgfSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8UXVpY2tQaWNrSXRlbVtdIHwgdW5kZWZpbmVkPjtcblx0c2hvd1F1aWNrUGljayhleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgaXRlbXNPckl0ZW1zUHJvbWlzZTogc3RyaW5nW10gfCBQcm9taXNlPHN0cmluZ1tdPiwgb3B0aW9ucz86IFF1aWNrUGlja09wdGlvbnMsIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD47XG5cdHNob3dRdWlja1BpY2soZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGl0ZW1zT3JJdGVtc1Byb21pc2U6IFF1aWNrUGlja0l0ZW1bXSB8IFByb21pc2U8UXVpY2tQaWNrSXRlbVtdPiwgb3B0aW9ucz86IFF1aWNrUGlja09wdGlvbnMsIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFF1aWNrUGlja0l0ZW0gfCB1bmRlZmluZWQ+O1xuXHRzaG93UXVpY2tQaWNrKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBpdGVtc09ySXRlbXNQcm9taXNlOiBJdGVtW10gfCBQcm9taXNlPEl0ZW1bXT4sIG9wdGlvbnM/OiBRdWlja1BpY2tPcHRpb25zLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJdGVtIHwgSXRlbVtdIHwgdW5kZWZpbmVkPjtcblxuXHRzaG93SW5wdXQob3B0aW9ucz86IElucHV0Qm94T3B0aW9ucywgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPjtcblxuXHRzaG93V29ya3NwYWNlRm9sZGVyUGljayhvcHRpb25zPzogV29ya3NwYWNlRm9sZGVyUGlja09wdGlvbnMsIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFdvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZD47XG5cblx0Y3JlYXRlUXVpY2tQaWNrPFQgZXh0ZW5kcyBRdWlja1BpY2tJdGVtPihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbik6IFF1aWNrUGljazxUPjtcblxuXHRjcmVhdGVJbnB1dEJveChleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbik6IElucHV0Qm94O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRXh0SG9zdFF1aWNrT3BlbihtYWluQ29udGV4dDogSU1haW5Db250ZXh0LCB3b3Jrc3BhY2U6IElFeHRIb3N0V29ya3NwYWNlUHJvdmlkZXIsIGNvbW1hbmRzOiBFeHRIb3N0Q29tbWFuZHMpOiBFeHRIb3N0UXVpY2tPcGVuU2hhcGUgJiBFeHRIb3N0UXVpY2tPcGVuIHtcblx0Y29uc3QgcHJveHkgPSBtYWluQ29udGV4dC5nZXRQcm94eShNYWluQ29udGV4dC5NYWluVGhyZWFkUXVpY2tPcGVuKTtcblxuXHRjbGFzcyBFeHRIb3N0UXVpY2tPcGVuSW1wbCBpbXBsZW1lbnRzIEV4dEhvc3RRdWlja09wZW5TaGFwZSB7XG5cblx0XHRwcml2YXRlIF93b3Jrc3BhY2U6IElFeHRIb3N0V29ya3NwYWNlUHJvdmlkZXI7XG5cdFx0cHJpdmF0ZSBfY29tbWFuZHM6IEV4dEhvc3RDb21tYW5kcztcblxuXHRcdHByaXZhdGUgX29uRGlkU2VsZWN0SXRlbT86IChoYW5kbGU6IG51bWJlcikgPT4gdm9pZDtcblx0XHRwcml2YXRlIF92YWxpZGF0ZUlucHV0PzogKGlucHV0OiBzdHJpbmcpID0+IHN0cmluZyB8IElucHV0Qm94VmFsaWRhdGlvbk1lc3NhZ2UgfCB1bmRlZmluZWQgfCBudWxsIHwgVGhlbmFibGU8c3RyaW5nIHwgSW5wdXRCb3hWYWxpZGF0aW9uTWVzc2FnZSB8IHVuZGVmaW5lZCB8IG51bGw+O1xuXG5cdFx0cHJpdmF0ZSBfc2Vzc2lvbnMgPSBuZXcgTWFwPG51bWJlciwgRXh0SG9zdFF1aWNrSW5wdXQ+KCk7XG5cblx0XHRwcml2YXRlIF9pbnN0YW5jZXMgPSAwO1xuXG5cdFx0Y29uc3RydWN0b3Iod29ya3NwYWNlOiBJRXh0SG9zdFdvcmtzcGFjZVByb3ZpZGVyLCBjb21tYW5kczogRXh0SG9zdENvbW1hbmRzKSB7XG5cdFx0XHR0aGlzLl93b3Jrc3BhY2UgPSB3b3Jrc3BhY2U7XG5cdFx0XHR0aGlzLl9jb21tYW5kcyA9IGNvbW1hbmRzO1xuXHRcdH1cblxuXHRcdHNob3dRdWlja1BpY2soZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGl0ZW1zT3JJdGVtc1Byb21pc2U6IFF1aWNrUGlja0l0ZW1bXSB8IFByb21pc2U8UXVpY2tQaWNrSXRlbVtdPiwgb3B0aW9uczogUXVpY2tQaWNrT3B0aW9ucyAmIHsgY2FuUGlja01hbnk6IHRydWUgfSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8UXVpY2tQaWNrSXRlbVtdIHwgdW5kZWZpbmVkPjtcblx0XHRzaG93UXVpY2tQaWNrKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBpdGVtc09ySXRlbXNQcm9taXNlOiBzdHJpbmdbXSB8IFByb21pc2U8c3RyaW5nW10+LCBvcHRpb25zPzogUXVpY2tQaWNrT3B0aW9ucywgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPjtcblx0XHRzaG93UXVpY2tQaWNrKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBpdGVtc09ySXRlbXNQcm9taXNlOiBRdWlja1BpY2tJdGVtW10gfCBQcm9taXNlPFF1aWNrUGlja0l0ZW1bXT4sIG9wdGlvbnM/OiBRdWlja1BpY2tPcHRpb25zLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxRdWlja1BpY2tJdGVtIHwgdW5kZWZpbmVkPjtcblx0XHRzaG93UXVpY2tQaWNrKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBpdGVtc09ySXRlbXNQcm9taXNlOiBJdGVtW10gfCBQcm9taXNlPEl0ZW1bXT4sIG9wdGlvbnM/OiBRdWlja1BpY2tPcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTogUHJvbWlzZTxJdGVtIHwgSXRlbVtdIHwgdW5kZWZpbmVkPiB7XG5cdFx0XHQvLyBjbGVhciBzdGF0ZSBmcm9tIGxhc3QgaW52b2NhdGlvblxuXHRcdFx0dGhpcy5fb25EaWRTZWxlY3RJdGVtID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRjb25zdCBpdGVtc1Byb21pc2UgPSBQcm9taXNlLnJlc29sdmUoaXRlbXNPckl0ZW1zUHJvbWlzZSk7XG5cblx0XHRcdGNvbnN0IGluc3RhbmNlID0gKyt0aGlzLl9pbnN0YW5jZXM7XG5cblx0XHRcdGNvbnN0IHF1aWNrUGlja1dpZGdldCA9IHByb3h5LiRzaG93KGluc3RhbmNlLCB7XG5cdFx0XHRcdHRpdGxlOiBvcHRpb25zPy50aXRsZSxcblx0XHRcdFx0cGxhY2VIb2xkZXI6IG9wdGlvbnM/LnBsYWNlSG9sZGVyLFxuXHRcdFx0XHRtYXRjaE9uRGVzY3JpcHRpb246IG9wdGlvbnM/Lm1hdGNoT25EZXNjcmlwdGlvbixcblx0XHRcdFx0bWF0Y2hPbkRldGFpbDogb3B0aW9ucz8ubWF0Y2hPbkRldGFpbCxcblx0XHRcdFx0aWdub3JlRm9jdXNMb3N0OiBvcHRpb25zPy5pZ25vcmVGb2N1c091dCxcblx0XHRcdFx0Y2FuUGlja01hbnk6IG9wdGlvbnM/LmNhblBpY2tNYW55LFxuXHRcdFx0fSwgdG9rZW4pO1xuXG5cdFx0XHRjb25zdCB3aWRnZXRDbG9zZWRNYXJrZXIgPSB7fTtcblx0XHRcdGNvbnN0IHdpZGdldENsb3NlZFByb21pc2UgPSBxdWlja1BpY2tXaWRnZXQudGhlbigoKSA9PiB3aWRnZXRDbG9zZWRNYXJrZXIpO1xuXG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yYWNlKFt3aWRnZXRDbG9zZWRQcm9taXNlLCBpdGVtc1Byb21pc2VdKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRcdGlmIChyZXN1bHQgPT09IHdpZGdldENsb3NlZE1hcmtlcikge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBhbGxvd2VkVG9vbHRpcHMgPSBpc1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdxdWlja1BpY2tJdGVtVG9vbHRpcCcpO1xuXG5cdFx0XHRcdHJldHVybiBpdGVtc1Byb21pc2UudGhlbihpdGVtcyA9PiB7XG5cblx0XHRcdFx0XHRjb25zdCBwaWNrSXRlbXM6IFRyYW5zZmVyUXVpY2tQaWNrSXRlbU9yU2VwYXJhdG9yW10gPSBbXTtcblx0XHRcdFx0XHRmb3IgKGxldCBoYW5kbGUgPSAwOyBoYW5kbGUgPCBpdGVtcy5sZW5ndGg7IGhhbmRsZSsrKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBpdGVtID0gaXRlbXNbaGFuZGxlXTtcblx0XHRcdFx0XHRcdGlmICh0eXBlb2YgaXRlbSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdFx0cGlja0l0ZW1zLnB1c2goeyBsYWJlbDogaXRlbSwgaGFuZGxlIH0pO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChpdGVtLmtpbmQgPT09IFF1aWNrUGlja0l0ZW1LaW5kLlNlcGFyYXRvcikge1xuXHRcdFx0XHRcdFx0XHRwaWNrSXRlbXMucHVzaCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogaXRlbS5sYWJlbCB9KTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGlmIChpdGVtLnRvb2x0aXAgJiYgIWFsbG93ZWRUb29sdGlwcykge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnNvbGUud2FybihgRXh0ZW5zaW9uICcke2V4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlfScgdXNlcyBhIHRvb2x0aXAgd2hpY2ggaXMgcHJvcG9zZWQgQVBJIHRoYXQgaXMgb25seSBhdmFpbGFibGUgd2hlbiBydW5uaW5nIG91dCBvZiBkZXYgb3Igd2l0aCB0aGUgZm9sbG93aW5nIGNvbW1hbmQgbGluZSBzd2l0Y2g6IC0tZW5hYmxlLXByb3Bvc2VkLWFwaSAke2V4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlfWApO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0Y29uc3QgaWNvbiA9IChpdGVtLmljb25QYXRoKSA/IGdldEljb25QYXRoT3JDbGFzcyhpdGVtLmljb25QYXRoKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdFx0cGlja0l0ZW1zLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdGxhYmVsOiBpdGVtLmxhYmVsLFxuXHRcdFx0XHRcdFx0XHRcdGljb25QYXRoOiBpY29uPy5pY29uUGF0aCxcblx0XHRcdFx0XHRcdFx0XHRpY29uQ2xhc3M6IGljb24/Lmljb25DbGFzcyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogaXRlbS5kZXNjcmlwdGlvbixcblx0XHRcdFx0XHRcdFx0XHRkZXRhaWw6IGl0ZW0uZGV0YWlsLFxuXHRcdFx0XHRcdFx0XHRcdHBpY2tlZDogaXRlbS5waWNrZWQsXG5cdFx0XHRcdFx0XHRcdFx0YWx3YXlzU2hvdzogaXRlbS5hbHdheXNTaG93LFxuXHRcdFx0XHRcdFx0XHRcdHRvb2x0aXA6IGFsbG93ZWRUb29sdGlwcyA/IE1hcmtkb3duU3RyaW5nLmZyb21TdHJpY3QoaXRlbS50b29sdGlwKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0XHRoYW5kbGVcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gaGFuZGxlIHNlbGVjdGlvbiBjaGFuZ2VzXG5cdFx0XHRcdFx0aWYgKG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMub25EaWRTZWxlY3RJdGVtID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9vbkRpZFNlbGVjdEl0ZW0gPSAoaGFuZGxlKSA9PiB7XG5cdFx0XHRcdFx0XHRcdG9wdGlvbnMub25EaWRTZWxlY3RJdGVtIShpdGVtc1toYW5kbGVdKTtcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gc2hvdyBpdGVtc1xuXHRcdFx0XHRcdHByb3h5LiRzZXRJdGVtcyhpbnN0YW5jZSwgcGlja0l0ZW1zKTtcblxuXHRcdFx0XHRcdHJldHVybiBxdWlja1BpY2tXaWRnZXQudGhlbihoYW5kbGUgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKHR5cGVvZiBoYW5kbGUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBpdGVtc1toYW5kbGVdO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGhhbmRsZSkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGhhbmRsZS5tYXAoaCA9PiBpdGVtc1toXSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pLnRoZW4odW5kZWZpbmVkLCBlcnIgPT4ge1xuXHRcdFx0XHRpZiAoaXNDYW5jZWxsYXRpb25FcnJvcihlcnIpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHByb3h5LiRzZXRFcnJvcihpbnN0YW5jZSwgZXJyKTtcblxuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdCRvbkl0ZW1TZWxlY3RlZChoYW5kbGU6IG51bWJlcik6IHZvaWQge1xuXHRcdFx0dGhpcy5fb25EaWRTZWxlY3RJdGVtPy4oaGFuZGxlKTtcblx0XHR9XG5cblx0XHQvLyAtLS0tIGlucHV0XG5cblx0XHRzaG93SW5wdXQob3B0aW9ucz86IElucHV0Qm94T3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuID0gQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cblx0XHRcdC8vIGdsb2JhbCB2YWxpZGF0ZSBmbiB1c2VkIGluIGNhbGxiYWNrIGJlbG93XG5cdFx0XHR0aGlzLl92YWxpZGF0ZUlucHV0ID0gb3B0aW9ucz8udmFsaWRhdGVJbnB1dDtcblxuXHRcdFx0cmV0dXJuIHByb3h5LiRpbnB1dChvcHRpb25zLCB0eXBlb2YgdGhpcy5fdmFsaWRhdGVJbnB1dCA9PT0gJ2Z1bmN0aW9uJywgdG9rZW4pXG5cdFx0XHRcdC50aGVuKHVuZGVmaW5lZCwgZXJyID0+IHtcblx0XHRcdFx0XHRpZiAoaXNDYW5jZWxsYXRpb25FcnJvcihlcnIpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuXHRcdFx0XHR9KTtcblx0XHR9XG5cblx0XHRhc3luYyAkdmFsaWRhdGVJbnB1dChpbnB1dDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCB7IGNvbnRlbnQ6IHN0cmluZzsgc2V2ZXJpdHk6IFNldmVyaXR5IH0gfCBudWxsIHwgdW5kZWZpbmVkPiB7XG5cdFx0XHRpZiAoIXRoaXMuX3ZhbGlkYXRlSW5wdXQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl92YWxpZGF0ZUlucHV0KGlucHV0KTtcblx0XHRcdGlmICghcmVzdWx0IHx8IHR5cGVvZiByZXN1bHQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9XG5cblx0XHRcdGxldCBzZXZlcml0eTogU2V2ZXJpdHk7XG5cdFx0XHRzd2l0Y2ggKHJlc3VsdC5zZXZlcml0eSkge1xuXHRcdFx0XHRjYXNlIElucHV0Qm94VmFsaWRhdGlvblNldmVyaXR5LkluZm86XG5cdFx0XHRcdFx0c2V2ZXJpdHkgPSBTZXZlcml0eS5JbmZvO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIElucHV0Qm94VmFsaWRhdGlvblNldmVyaXR5Lldhcm5pbmc6XG5cdFx0XHRcdFx0c2V2ZXJpdHkgPSBTZXZlcml0eS5XYXJuaW5nO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIElucHV0Qm94VmFsaWRhdGlvblNldmVyaXR5LkVycm9yOlxuXHRcdFx0XHRcdHNldmVyaXR5ID0gU2V2ZXJpdHkuRXJyb3I7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0c2V2ZXJpdHkgPSByZXN1bHQubWVzc2FnZSA/IFNldmVyaXR5LkVycm9yIDogU2V2ZXJpdHkuSWdub3JlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjb250ZW50OiByZXN1bHQubWVzc2FnZSxcblx0XHRcdFx0c2V2ZXJpdHlcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gLS0tLSB3b3Jrc3BhY2UgZm9sZGVyIHBpY2tlclxuXG5cdFx0YXN5bmMgc2hvd1dvcmtzcGFjZUZvbGRlclBpY2sob3B0aW9ucz86IFdvcmtzcGFjZUZvbGRlclBpY2tPcHRpb25zLCB0b2tlbiA9IENhbmNlbGxhdGlvblRva2VuLk5vbmUpOiBQcm9taXNlPFdvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZD4ge1xuXHRcdFx0Y29uc3Qgc2VsZWN0ZWRGb2xkZXIgPSBhd2FpdCB0aGlzLl9jb21tYW5kcy5leGVjdXRlQ29tbWFuZDxXb3Jrc3BhY2VGb2xkZXI+KCdfd29ya2JlbmNoLnBpY2tXb3Jrc3BhY2VGb2xkZXInLCBbb3B0aW9uc10pO1xuXHRcdFx0aWYgKCFzZWxlY3RlZEZvbGRlcikge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3Qgd29ya3NwYWNlRm9sZGVycyA9IGF3YWl0IHRoaXMuX3dvcmtzcGFjZS5nZXRXb3Jrc3BhY2VGb2xkZXJzMigpO1xuXHRcdFx0aWYgKCF3b3Jrc3BhY2VGb2xkZXJzKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gd29ya3NwYWNlRm9sZGVycy5maW5kKGZvbGRlciA9PiBmb2xkZXIudXJpLnRvU3RyaW5nKCkgPT09IHNlbGVjdGVkRm9sZGVyLnVyaS50b1N0cmluZygpKTtcblx0XHR9XG5cblx0XHQvLyAtLS0tIFF1aWNrSW5wdXRcblxuXHRcdGNyZWF0ZVF1aWNrUGljazxUIGV4dGVuZHMgUXVpY2tQaWNrSXRlbT4oZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24pOiBRdWlja1BpY2s8VD4ge1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbjogRXh0SG9zdFF1aWNrUGljazxUPiA9IG5ldyBFeHRIb3N0UXVpY2tQaWNrKGV4dGVuc2lvbiwgKCkgPT4gdGhpcy5fc2Vzc2lvbnMuZGVsZXRlKHNlc3Npb24uX2lkKSk7XG5cdFx0XHR0aGlzLl9zZXNzaW9ucy5zZXQoc2Vzc2lvbi5faWQsIHNlc3Npb24pO1xuXHRcdFx0cmV0dXJuIHNlc3Npb247XG5cdFx0fVxuXG5cdFx0Y3JlYXRlSW5wdXRCb3goZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24pOiBJbnB1dEJveCB7XG5cdFx0XHRjb25zdCBzZXNzaW9uOiBFeHRIb3N0SW5wdXRCb3ggPSBuZXcgRXh0SG9zdElucHV0Qm94KGV4dGVuc2lvbiwgKCkgPT4gdGhpcy5fc2Vzc2lvbnMuZGVsZXRlKHNlc3Npb24uX2lkKSk7XG5cdFx0XHR0aGlzLl9zZXNzaW9ucy5zZXQoc2Vzc2lvbi5faWQsIHNlc3Npb24pO1xuXHRcdFx0cmV0dXJuIHNlc3Npb247XG5cdFx0fVxuXG5cdFx0JG9uRGlkQ2hhbmdlVmFsdWUoc2Vzc2lvbklkOiBudW1iZXIsIHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLl9zZXNzaW9ucy5nZXQoc2Vzc2lvbklkKTtcblx0XHRcdHNlc3Npb24/Ll9maXJlRGlkQ2hhbmdlVmFsdWUodmFsdWUpO1xuXHRcdH1cblxuXHRcdCRvbkRpZEFjY2VwdChzZXNzaW9uSWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuX3Nlc3Npb25zLmdldChzZXNzaW9uSWQpO1xuXHRcdFx0c2Vzc2lvbj8uX2ZpcmVEaWRBY2NlcHQoKTtcblx0XHR9XG5cblx0XHQkb25EaWRDaGFuZ2VBY3RpdmUoc2Vzc2lvbklkOiBudW1iZXIsIGhhbmRsZXM6IG51bWJlcltdKTogdm9pZCB7XG5cdFx0XHRjb25zdCBzZXNzaW9uID0gdGhpcy5fc2Vzc2lvbnMuZ2V0KHNlc3Npb25JZCk7XG5cdFx0XHRpZiAoc2Vzc2lvbiBpbnN0YW5jZW9mIEV4dEhvc3RRdWlja1BpY2spIHtcblx0XHRcdFx0c2Vzc2lvbi5fZmlyZURpZENoYW5nZUFjdGl2ZShoYW5kbGVzKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQkb25EaWRDaGFuZ2VTZWxlY3Rpb24oc2Vzc2lvbklkOiBudW1iZXIsIGhhbmRsZXM6IG51bWJlcltdKTogdm9pZCB7XG5cdFx0XHRjb25zdCBzZXNzaW9uID0gdGhpcy5fc2Vzc2lvbnMuZ2V0KHNlc3Npb25JZCk7XG5cdFx0XHRpZiAoc2Vzc2lvbiBpbnN0YW5jZW9mIEV4dEhvc3RRdWlja1BpY2spIHtcblx0XHRcdFx0c2Vzc2lvbi5fZmlyZURpZENoYW5nZVNlbGVjdGlvbihoYW5kbGVzKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQkb25EaWRUcmlnZ2VyQnV0dG9uKHNlc3Npb25JZDogbnVtYmVyLCBoYW5kbGU6IG51bWJlcik6IHZvaWQge1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuX3Nlc3Npb25zLmdldChzZXNzaW9uSWQpO1xuXHRcdFx0c2Vzc2lvbj8uX2ZpcmVEaWRUcmlnZ2VyQnV0dG9uKGhhbmRsZSk7XG5cdFx0fVxuXG5cdFx0JG9uRGlkVHJpZ2dlckl0ZW1CdXR0b24oc2Vzc2lvbklkOiBudW1iZXIsIGl0ZW1IYW5kbGU6IG51bWJlciwgYnV0dG9uSGFuZGxlOiBudW1iZXIpOiB2b2lkIHtcblx0XHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLl9zZXNzaW9ucy5nZXQoc2Vzc2lvbklkKTtcblx0XHRcdGlmIChzZXNzaW9uIGluc3RhbmNlb2YgRXh0SG9zdFF1aWNrUGljaykge1xuXHRcdFx0XHRzZXNzaW9uLl9maXJlRGlkVHJpZ2dlckl0ZW1CdXR0b24oaXRlbUhhbmRsZSwgYnV0dG9uSGFuZGxlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQkb25EaWRIaWRlKHNlc3Npb25JZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0XHRjb25zdCBzZXNzaW9uID0gdGhpcy5fc2Vzc2lvbnMuZ2V0KHNlc3Npb25JZCk7XG5cdFx0XHRzZXNzaW9uPy5fZmlyZURpZEhpZGUoKTtcblx0XHR9XG5cdH1cblxuXHRjbGFzcyBFeHRIb3N0UXVpY2tJbnB1dCBpbXBsZW1lbnRzIFF1aWNrSW5wdXQge1xuXG5cdFx0cHJpdmF0ZSBzdGF0aWMgX25leHRJZCA9IDE7XG5cdFx0X2lkID0gRXh0SG9zdFF1aWNrUGljay5fbmV4dElkKys7XG5cblx0XHRwcml2YXRlIF90aXRsZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdHByaXZhdGUgX3N0ZXBzOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdFx0cHJpdmF0ZSBfdG90YWxTdGVwczogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdHByaXZhdGUgX3Zpc2libGUgPSBmYWxzZTtcblx0XHRwcml2YXRlIF9leHBlY3RpbmdIaWRlID0gZmFsc2U7XG5cdFx0cHJpdmF0ZSBfZW5hYmxlZCA9IHRydWU7XG5cdFx0cHJpdmF0ZSBfYnVzeSA9IGZhbHNlO1xuXHRcdHByaXZhdGUgX2lnbm9yZUZvY3VzT3V0ID0gdHJ1ZTtcblx0XHRwcml2YXRlIF92YWx1ZSA9ICcnO1xuXHRcdHByaXZhdGUgX3ZhbHVlU2VsZWN0aW9uOiByZWFkb25seSBbbnVtYmVyLCBudW1iZXJdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdHByaXZhdGUgX3BsYWNlaG9sZGVyOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0cHJpdmF0ZSBfYnV0dG9uczogUXVpY2tJbnB1dEJ1dHRvbltdID0gW107XG5cdFx0cHJpdmF0ZSBfaGFuZGxlc1RvQnV0dG9ucyA9IG5ldyBNYXA8bnVtYmVyLCBRdWlja0lucHV0QnV0dG9uPigpO1xuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQWNjZXB0RW1pdHRlciA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VWYWx1ZUVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxzdHJpbmc+KCk7XG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRUcmlnZ2VyQnV0dG9uRW1pdHRlciA9IG5ldyBFbWl0dGVyPFF1aWNrSW5wdXRCdXR0b24+KCk7XG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRIaWRlRW1pdHRlciA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdFx0cHJpdmF0ZSBfdXBkYXRlVGltZW91dDogYW55O1xuXHRcdHByaXZhdGUgX3BlbmRpbmdVcGRhdGU6IFRyYW5zZmVyUXVpY2tJbnB1dCA9IHsgaWQ6IHRoaXMuX2lkIH07XG5cblx0XHRwcml2YXRlIF9kaXNwb3NlZCA9IGZhbHNlO1xuXHRcdHByb3RlY3RlZCBfZGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlW10gPSBbXG5cdFx0XHR0aGlzLl9vbkRpZFRyaWdnZXJCdXR0b25FbWl0dGVyLFxuXHRcdFx0dGhpcy5fb25EaWRIaWRlRW1pdHRlcixcblx0XHRcdHRoaXMuX29uRGlkQWNjZXB0RW1pdHRlcixcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVmFsdWVFbWl0dGVyXG5cdFx0XTtcblxuXHRcdGNvbnN0cnVjdG9yKHByb3RlY3RlZCBfZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHByaXZhdGUgX29uRGlkRGlzcG9zZTogKCkgPT4gdm9pZCkge1xuXHRcdH1cblxuXHRcdGdldCB0aXRsZSgpIHtcblx0XHRcdHJldHVybiB0aGlzLl90aXRsZTtcblx0XHR9XG5cblx0XHRzZXQgdGl0bGUodGl0bGU6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fdGl0bGUgPSB0aXRsZTtcblx0XHRcdHRoaXMudXBkYXRlKHsgdGl0bGUgfSk7XG5cdFx0fVxuXG5cdFx0Z2V0IHN0ZXAoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc3RlcHM7XG5cdFx0fVxuXG5cdFx0c2V0IHN0ZXAoc3RlcDogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLl9zdGVwcyA9IHN0ZXA7XG5cdFx0XHR0aGlzLnVwZGF0ZSh7IHN0ZXAgfSk7XG5cdFx0fVxuXG5cdFx0Z2V0IHRvdGFsU3RlcHMoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fdG90YWxTdGVwcztcblx0XHR9XG5cblx0XHRzZXQgdG90YWxTdGVwcyh0b3RhbFN0ZXBzOiBudW1iZXIgfCB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX3RvdGFsU3RlcHMgPSB0b3RhbFN0ZXBzO1xuXHRcdFx0dGhpcy51cGRhdGUoeyB0b3RhbFN0ZXBzIH0pO1xuXHRcdH1cblxuXHRcdGdldCBlbmFibGVkKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2VuYWJsZWQ7XG5cdFx0fVxuXG5cdFx0c2V0IGVuYWJsZWQoZW5hYmxlZDogYm9vbGVhbikge1xuXHRcdFx0dGhpcy5fZW5hYmxlZCA9IGVuYWJsZWQ7XG5cdFx0XHR0aGlzLnVwZGF0ZSh7IGVuYWJsZWQgfSk7XG5cdFx0fVxuXG5cdFx0Z2V0IGJ1c3koKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYnVzeTtcblx0XHR9XG5cblx0XHRzZXQgYnVzeShidXN5OiBib29sZWFuKSB7XG5cdFx0XHR0aGlzLl9idXN5ID0gYnVzeTtcblx0XHRcdHRoaXMudXBkYXRlKHsgYnVzeSB9KTtcblx0XHR9XG5cblx0XHRnZXQgaWdub3JlRm9jdXNPdXQoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5faWdub3JlRm9jdXNPdXQ7XG5cdFx0fVxuXG5cdFx0c2V0IGlnbm9yZUZvY3VzT3V0KGlnbm9yZUZvY3VzT3V0OiBib29sZWFuKSB7XG5cdFx0XHR0aGlzLl9pZ25vcmVGb2N1c091dCA9IGlnbm9yZUZvY3VzT3V0O1xuXHRcdFx0dGhpcy51cGRhdGUoeyBpZ25vcmVGb2N1c091dCB9KTtcblx0XHR9XG5cblx0XHRnZXQgdmFsdWUoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fdmFsdWU7XG5cdFx0fVxuXG5cdFx0c2V0IHZhbHVlKHZhbHVlOiBzdHJpbmcpIHtcblx0XHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0XHR0aGlzLnVwZGF0ZSh7IHZhbHVlIH0pO1xuXHRcdH1cblxuXHRcdGdldCB2YWx1ZVNlbGVjdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLl92YWx1ZVNlbGVjdGlvbjtcblx0XHR9XG5cblx0XHRzZXQgdmFsdWVTZWxlY3Rpb24odmFsdWVTZWxlY3Rpb246IHJlYWRvbmx5IFtudW1iZXIsIG51bWJlcl0gfCB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX3ZhbHVlU2VsZWN0aW9uID0gdmFsdWVTZWxlY3Rpb247XG5cdFx0XHR0aGlzLnVwZGF0ZSh7IHZhbHVlU2VsZWN0aW9uIH0pO1xuXHRcdH1cblxuXHRcdGdldCBwbGFjZWhvbGRlcigpIHtcblx0XHRcdHJldHVybiB0aGlzLl9wbGFjZWhvbGRlcjtcblx0XHR9XG5cblx0XHRzZXQgcGxhY2Vob2xkZXIocGxhY2Vob2xkZXI6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fcGxhY2Vob2xkZXIgPSBwbGFjZWhvbGRlcjtcblx0XHRcdHRoaXMudXBkYXRlKHsgcGxhY2Vob2xkZXIgfSk7XG5cdFx0fVxuXG5cdFx0b25EaWRDaGFuZ2VWYWx1ZSA9IHRoaXMuX29uRGlkQ2hhbmdlVmFsdWVFbWl0dGVyLmV2ZW50O1xuXG5cdFx0b25EaWRBY2NlcHQgPSB0aGlzLl9vbkRpZEFjY2VwdEVtaXR0ZXIuZXZlbnQ7XG5cblx0XHRnZXQgYnV0dG9ucygpIHtcblx0XHRcdHJldHVybiB0aGlzLl9idXR0b25zO1xuXHRcdH1cblxuXHRcdHNldCBidXR0b25zKGJ1dHRvbnM6IFF1aWNrSW5wdXRCdXR0b25bXSkge1xuXHRcdFx0Y29uc3QgYWxsb3dlZEJ1dHRvbkxvY2F0aW9uID0gaXNQcm9wb3NlZEFwaUVuYWJsZWQodGhpcy5fZXh0ZW5zaW9uLCAncXVpY2tJbnB1dEJ1dHRvbkxvY2F0aW9uJyk7XG5cdFx0XHRpZiAoIWFsbG93ZWRCdXR0b25Mb2NhdGlvbiAmJiBidXR0b25zLnNvbWUoYnV0dG9uID0+IGJ1dHRvbi5sb2NhdGlvbikpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKGBFeHRlbnNpb24gJyR7dGhpcy5fZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWV9JyB1c2VzIGEgYnV0dG9uIGxvY2F0aW9uIHdoaWNoIGlzIHByb3Bvc2VkIEFQSSB0aGF0IGlzIG9ubHkgYXZhaWxhYmxlIHdoZW4gcnVubmluZyBvdXQgb2YgZGV2IG9yIHdpdGggdGhlIGZvbGxvd2luZyBjb21tYW5kIGxpbmUgc3dpdGNoOiAtLWVuYWJsZS1wcm9wb3NlZC1hcGkgJHt0aGlzLl9leHRlbnNpb24uaWRlbnRpZmllci52YWx1ZX1gKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2J1dHRvbnMgPSBidXR0b25zLnNsaWNlKCk7XG5cdFx0XHR0aGlzLl9oYW5kbGVzVG9CdXR0b25zLmNsZWFyKCk7XG5cdFx0XHRidXR0b25zLmZvckVhY2goKGJ1dHRvbiwgaSkgPT4ge1xuXHRcdFx0XHRjb25zdCBoYW5kbGUgPSBidXR0b24gPT09IFF1aWNrSW5wdXRCdXR0b25zLkJhY2sgPyAtMSA6IGk7XG5cdFx0XHRcdHRoaXMuX2hhbmRsZXNUb0J1dHRvbnMuc2V0KGhhbmRsZSwgYnV0dG9uKTtcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy51cGRhdGUoe1xuXHRcdFx0XHRidXR0b25zOiBidXR0b25zLm1hcDxUcmFuc2ZlclF1aWNrSW5wdXRCdXR0b24+KChidXR0b24sIGkpID0+IHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0Li4uZ2V0SWNvblBhdGhPckNsYXNzKGJ1dHRvbi5pY29uUGF0aCksXG5cdFx0XHRcdFx0XHR0b29sdGlwOiBidXR0b24udG9vbHRpcCxcblx0XHRcdFx0XHRcdGhhbmRsZTogYnV0dG9uID09PSBRdWlja0lucHV0QnV0dG9ucy5CYWNrID8gLTEgOiBpLFxuXHRcdFx0XHRcdFx0bG9jYXRpb246IGFsbG93ZWRCdXR0b25Mb2NhdGlvbiA/IGJ1dHRvbi5sb2NhdGlvbiA6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0pXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRvbkRpZFRyaWdnZXJCdXR0b24gPSB0aGlzLl9vbkRpZFRyaWdnZXJCdXR0b25FbWl0dGVyLmV2ZW50O1xuXG5cdFx0c2hvdygpOiB2b2lkIHtcblx0XHRcdHRoaXMuX3Zpc2libGUgPSB0cnVlO1xuXHRcdFx0dGhpcy5fZXhwZWN0aW5nSGlkZSA9IHRydWU7XG5cdFx0XHR0aGlzLnVwZGF0ZSh7IHZpc2libGU6IHRydWUgfSk7XG5cdFx0fVxuXG5cdFx0aGlkZSgpOiB2b2lkIHtcblx0XHRcdHRoaXMuX3Zpc2libGUgPSBmYWxzZTtcblx0XHRcdHRoaXMudXBkYXRlKHsgdmlzaWJsZTogZmFsc2UgfSk7XG5cdFx0fVxuXG5cdFx0b25EaWRIaWRlID0gdGhpcy5fb25EaWRIaWRlRW1pdHRlci5ldmVudDtcblxuXHRcdF9maXJlRGlkQWNjZXB0KCkge1xuXHRcdFx0dGhpcy5fb25EaWRBY2NlcHRFbWl0dGVyLmZpcmUoKTtcblx0XHR9XG5cblx0XHRfZmlyZURpZENoYW5nZVZhbHVlKHZhbHVlOiBzdHJpbmcpIHtcblx0XHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVZhbHVlRW1pdHRlci5maXJlKHZhbHVlKTtcblx0XHR9XG5cblx0XHRfZmlyZURpZFRyaWdnZXJCdXR0b24oaGFuZGxlOiBudW1iZXIpIHtcblx0XHRcdGNvbnN0IGJ1dHRvbiA9IHRoaXMuX2hhbmRsZXNUb0J1dHRvbnMuZ2V0KGhhbmRsZSk7XG5cdFx0XHRpZiAoYnV0dG9uKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkVHJpZ2dlckJ1dHRvbkVtaXR0ZXIuZmlyZShidXR0b24pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdF9maXJlRGlkSGlkZSgpIHtcblx0XHRcdGlmICh0aGlzLl9leHBlY3RpbmdIaWRlKSB7XG5cdFx0XHRcdC8vIGlmIHRoaXMuX3Zpc2libGUgaXMgdHJ1ZSwgaXQgbWVhbnMgdGhhdCAuc2hvdygpIHdhcyBjYWxsZWQgYmV0d2VlblxuXHRcdFx0XHQvLyAuaGlkZSgpIGFuZCAub25EaWRIaWRlLiBUbyBlbnN1cmUgdGhlIGNvcnJlY3QgbnVtYmVyIG9mIG9uRGlkSGlkZSBldmVudHNcblx0XHRcdFx0Ly8gYXJlIGVtaXR0ZWQsIHdlIHNldCB0aGlzLl9leHBlY3RpbmdIaWRlIHRvIHRoaXMgdmFsdWUgc28gdGhhdFxuXHRcdFx0XHQvLyB0aGUgbmV4dCB0aW1lIC5oaWRlKCkgaXMgY2FsbGVkLCB3ZSBjYW4gZW1pdCB0aGUgZXZlbnQgYWdhaW4uXG5cdFx0XHRcdC8vIEV4YW1wbGU6XG5cdFx0XHRcdC8vIC5zaG93KCkgLT4gLmhpZGUoKSAtPiAuc2hvdygpIC0+IC5oaWRlKCkgc2hvdWxkIGVtaXQgMiBvbkRpZEhpZGUgZXZlbnRzLlxuXHRcdFx0XHQvLyAuc2hvdygpIC0+IC5oaWRlKCkgLT4gLmhpZGUoKSBzaG91bGQgZW1pdCAxIG9uRGlkSGlkZSBldmVudC5cblx0XHRcdFx0Ly8gRml4ZXMgIzEzNTc0N1xuXHRcdFx0XHR0aGlzLl9leHBlY3RpbmdIaWRlID0gdGhpcy5fdmlzaWJsZTtcblx0XHRcdFx0dGhpcy5fb25EaWRIaWRlRW1pdHRlci5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRcdGlmICh0aGlzLl9kaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9kaXNwb3NlZCA9IHRydWU7XG5cdFx0XHR0aGlzLl9maXJlRGlkSGlkZSgpO1xuXHRcdFx0dGhpcy5fZGlzcG9zYWJsZXMgPSBkaXNwb3NlKHRoaXMuX2Rpc3Bvc2FibGVzKTtcblx0XHRcdGlmICh0aGlzLl91cGRhdGVUaW1lb3V0KSB7XG5cdFx0XHRcdGNsZWFyVGltZW91dCh0aGlzLl91cGRhdGVUaW1lb3V0KTtcblx0XHRcdFx0dGhpcy5fdXBkYXRlVGltZW91dCA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdHRoaXMuX29uRGlkRGlzcG9zZSgpO1xuXHRcdFx0cHJveHkuJGRpc3Bvc2UodGhpcy5faWQpO1xuXHRcdH1cblxuXHRcdHByb3RlY3RlZCB1cGRhdGUocHJvcGVydGllczogUmVjb3JkPHN0cmluZywgYW55Pik6IHZvaWQge1xuXHRcdFx0aWYgKHRoaXMuX2Rpc3Bvc2VkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKHByb3BlcnRpZXMpKSB7XG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gcHJvcGVydGllc1trZXldO1xuXHRcdFx0XHR0aGlzLl9wZW5kaW5nVXBkYXRlW2tleV0gPSB2YWx1ZSA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IHZhbHVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoJ3Zpc2libGUnIGluIHRoaXMuX3BlbmRpbmdVcGRhdGUpIHtcblx0XHRcdFx0aWYgKHRoaXMuX3VwZGF0ZVRpbWVvdXQpIHtcblx0XHRcdFx0XHRjbGVhclRpbWVvdXQodGhpcy5fdXBkYXRlVGltZW91dCk7XG5cdFx0XHRcdFx0dGhpcy5fdXBkYXRlVGltZW91dCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmRpc3BhdGNoVXBkYXRlKCk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuX3Zpc2libGUgJiYgIXRoaXMuX3VwZGF0ZVRpbWVvdXQpIHtcblx0XHRcdFx0Ly8gRGVmZXIgdGhlIHVwZGF0ZSBzbyB0aGF0IG11bHRpcGxlIGNoYW5nZXMgdG8gc2V0dGVycyBkb250IGNhdXNlIGEgcmVkcmF3IGVhY2hcblx0XHRcdFx0dGhpcy5fdXBkYXRlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX3VwZGF0ZVRpbWVvdXQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0dGhpcy5kaXNwYXRjaFVwZGF0ZSgpO1xuXHRcdFx0XHR9LCAwKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRwcml2YXRlIGRpc3BhdGNoVXBkYXRlKCkge1xuXHRcdFx0cHJveHkuJGNyZWF0ZU9yVXBkYXRlKHRoaXMuX3BlbmRpbmdVcGRhdGUpO1xuXHRcdFx0dGhpcy5fcGVuZGluZ1VwZGF0ZSA9IHsgaWQ6IHRoaXMuX2lkIH07XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0SWNvblVyaXMoaWNvblBhdGg6IFF1aWNrSW5wdXRCdXR0b25bJ2ljb25QYXRoJ10pOiB7IGRhcms6IFVSSTsgbGlnaHQ/OiBVUkkgfSB8IHsgaWQ6IHN0cmluZyB9IHtcblx0XHRpZiAoaWNvblBhdGggaW5zdGFuY2VvZiBUaGVtZUljb24pIHtcblx0XHRcdHJldHVybiB7IGlkOiBpY29uUGF0aC5pZCB9O1xuXHRcdH1cblx0XHRjb25zdCBkYXJrID0gZ2V0RGFya0ljb25VcmkoaWNvblBhdGggYXMgVVJJIHwgeyBsaWdodDogVVJJOyBkYXJrOiBVUkkgfSk7XG5cdFx0Y29uc3QgbGlnaHQgPSBnZXRMaWdodEljb25VcmkoaWNvblBhdGggYXMgVVJJIHwgeyBsaWdodDogVVJJOyBkYXJrOiBVUkkgfSk7XG5cdFx0Ly8gVG9sZXJhdGUgc3RyaW5nczogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzExMDQzMiNpc3N1ZWNvbW1lbnQtNzI2MTQ0NTU2XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRhcms6IHR5cGVvZiBkYXJrID09PSAnc3RyaW5nJyA/IFVSSS5maWxlKGRhcmspIDogZGFyayxcblx0XHRcdGxpZ2h0OiB0eXBlb2YgbGlnaHQgPT09ICdzdHJpbmcnID8gVVJJLmZpbGUobGlnaHQpIDogbGlnaHRcblx0XHR9O1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0TGlnaHRJY29uVXJpKGljb25QYXRoOiBVUkkgfCB7IGxpZ2h0OiBVUkk7IGRhcms6IFVSSSB9KSB7XG5cdFx0cmV0dXJuIHR5cGVvZiBpY29uUGF0aCA9PT0gJ29iamVjdCcgJiYgJ2xpZ2h0JyBpbiBpY29uUGF0aCA/IGljb25QYXRoLmxpZ2h0IDogaWNvblBhdGg7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXREYXJrSWNvblVyaShpY29uUGF0aDogVVJJIHwgeyBsaWdodDogVVJJOyBkYXJrOiBVUkkgfSkge1xuXHRcdHJldHVybiB0eXBlb2YgaWNvblBhdGggPT09ICdvYmplY3QnICYmICdkYXJrJyBpbiBpY29uUGF0aCA/IGljb25QYXRoLmRhcmsgOiBpY29uUGF0aDtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldEljb25QYXRoT3JDbGFzcyhpY29uOiBRdWlja0lucHV0QnV0dG9uWydpY29uUGF0aCddKSB7XG5cdFx0Y29uc3QgaWNvblBhdGhPckljb25DbGFzcyA9IGdldEljb25VcmlzKGljb24pO1xuXHRcdGxldCBpY29uUGF0aDogeyBkYXJrOiBVUkk7IGxpZ2h0PzogVVJJIHwgdW5kZWZpbmVkIH0gfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGljb25DbGFzczogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGlmICgnaWQnIGluIGljb25QYXRoT3JJY29uQ2xhc3MpIHtcblx0XHRcdGljb25DbGFzcyA9IFRoZW1lSWNvblV0aWxzLmFzQ2xhc3NOYW1lKGljb25QYXRoT3JJY29uQ2xhc3MpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpY29uUGF0aCA9IGljb25QYXRoT3JJY29uQ2xhc3M7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGljb25QYXRoLFxuXHRcdFx0aWNvbkNsYXNzXG5cdFx0fTtcblx0fVxuXG5cdGNsYXNzIEV4dEhvc3RRdWlja1BpY2s8VCBleHRlbmRzIFF1aWNrUGlja0l0ZW0+IGV4dGVuZHMgRXh0SG9zdFF1aWNrSW5wdXQgaW1wbGVtZW50cyBRdWlja1BpY2s8VD4ge1xuXG5cdFx0cHJpdmF0ZSBfaXRlbXM6IFRbXSA9IFtdO1xuXHRcdHByaXZhdGUgX2hhbmRsZXNUb0l0ZW1zID0gbmV3IE1hcDxudW1iZXIsIFQ+KCk7XG5cdFx0cHJpdmF0ZSBfaXRlbXNUb0hhbmRsZXMgPSBuZXcgTWFwPFQsIG51bWJlcj4oKTtcblx0XHRwcml2YXRlIF9jYW5TZWxlY3RNYW55ID0gZmFsc2U7XG5cdFx0cHJpdmF0ZSBfbWF0Y2hPbkRlc2NyaXB0aW9uID0gdHJ1ZTtcblx0XHRwcml2YXRlIF9tYXRjaE9uRGV0YWlsID0gdHJ1ZTtcblx0XHRwcml2YXRlIF9zb3J0QnlMYWJlbCA9IHRydWU7XG5cdFx0cHJpdmF0ZSBfa2VlcFNjcm9sbFBvc2l0aW9uID0gZmFsc2U7XG5cdFx0cHJpdmF0ZSBfYWN0aXZlSXRlbXM6IFRbXSA9IFtdO1xuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQWN0aXZlRW1pdHRlciA9IG5ldyBFbWl0dGVyPFRbXT4oKTtcblx0XHRwcml2YXRlIF9zZWxlY3RlZEl0ZW1zOiBUW10gPSBbXTtcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVNlbGVjdGlvbkVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxUW10+KCk7XG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRUcmlnZ2VySXRlbUJ1dHRvbkVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxRdWlja1BpY2tJdGVtQnV0dG9uRXZlbnQ8VD4+KCk7XG5cblx0XHRjb25zdHJ1Y3RvcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgb25EaXNwb3NlOiAoKSA9PiB2b2lkKSB7XG5cdFx0XHRzdXBlcihleHRlbnNpb24sIG9uRGlzcG9zZSk7XG5cdFx0XHR0aGlzLl9kaXNwb3NhYmxlcy5wdXNoKFxuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZUVtaXR0ZXIsXG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU2VsZWN0aW9uRW1pdHRlcixcblx0XHRcdFx0dGhpcy5fb25EaWRUcmlnZ2VySXRlbUJ1dHRvbkVtaXR0ZXJcblx0XHRcdCk7XG5cdFx0XHR0aGlzLnVwZGF0ZSh7IHR5cGU6ICdxdWlja1BpY2snIH0pO1xuXHRcdH1cblxuXHRcdGdldCBpdGVtcygpIHtcblx0XHRcdHJldHVybiB0aGlzLl9pdGVtcztcblx0XHR9XG5cblx0XHRzZXQgaXRlbXMoaXRlbXM6IFRbXSkge1xuXHRcdFx0dGhpcy5faXRlbXMgPSBpdGVtcy5zbGljZSgpO1xuXHRcdFx0dGhpcy5faGFuZGxlc1RvSXRlbXMuY2xlYXIoKTtcblx0XHRcdHRoaXMuX2l0ZW1zVG9IYW5kbGVzLmNsZWFyKCk7XG5cdFx0XHRpdGVtcy5mb3JFYWNoKChpdGVtLCBpKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2hhbmRsZXNUb0l0ZW1zLnNldChpLCBpdGVtKTtcblx0XHRcdFx0dGhpcy5faXRlbXNUb0hhbmRsZXMuc2V0KGl0ZW0sIGkpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IGFsbG93ZWRUb29sdGlwcyA9IGlzUHJvcG9zZWRBcGlFbmFibGVkKHRoaXMuX2V4dGVuc2lvbiwgJ3F1aWNrUGlja0l0ZW1Ub29sdGlwJyk7XG5cblx0XHRcdGNvbnN0IHBpY2tJdGVtczogVHJhbnNmZXJRdWlja1BpY2tJdGVtT3JTZXBhcmF0b3JbXSA9IFtdO1xuXHRcdFx0Zm9yIChsZXQgaGFuZGxlID0gMDsgaGFuZGxlIDwgaXRlbXMubGVuZ3RoOyBoYW5kbGUrKykge1xuXHRcdFx0XHRjb25zdCBpdGVtID0gaXRlbXNbaGFuZGxlXTtcblx0XHRcdFx0aWYgKGl0ZW0ua2luZCA9PT0gUXVpY2tQaWNrSXRlbUtpbmQuU2VwYXJhdG9yKSB7XG5cdFx0XHRcdFx0cGlja0l0ZW1zLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IGl0ZW0ubGFiZWwgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKGl0ZW0udG9vbHRpcCAmJiAhYWxsb3dlZFRvb2x0aXBzKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLndhcm4oYEV4dGVuc2lvbiAnJHt0aGlzLl9leHRlbnNpb24uaWRlbnRpZmllci52YWx1ZX0nIHVzZXMgYSB0b29sdGlwIHdoaWNoIGlzIHByb3Bvc2VkIEFQSSB0aGF0IGlzIG9ubHkgYXZhaWxhYmxlIHdoZW4gcnVubmluZyBvdXQgb2YgZGV2IG9yIHdpdGggdGhlIGZvbGxvd2luZyBjb21tYW5kIGxpbmUgc3dpdGNoOiAtLWVuYWJsZS1wcm9wb3NlZC1hcGkgJHt0aGlzLl9leHRlbnNpb24uaWRlbnRpZmllci52YWx1ZX1gKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBpY29uID0gKGl0ZW0uaWNvblBhdGgpID8gZ2V0SWNvblBhdGhPckNsYXNzKGl0ZW0uaWNvblBhdGgpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRcdHBpY2tJdGVtcy5wdXNoKHtcblx0XHRcdFx0XHRcdGhhbmRsZSxcblx0XHRcdFx0XHRcdGxhYmVsOiBpdGVtLmxhYmVsLFxuXHRcdFx0XHRcdFx0aWNvblBhdGg6IGljb24/Lmljb25QYXRoLFxuXHRcdFx0XHRcdFx0aWNvbkNsYXNzOiBpY29uPy5pY29uQ2xhc3MsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogaXRlbS5kZXNjcmlwdGlvbixcblx0XHRcdFx0XHRcdGRldGFpbDogaXRlbS5kZXRhaWwsXG5cdFx0XHRcdFx0XHRwaWNrZWQ6IGl0ZW0ucGlja2VkLFxuXHRcdFx0XHRcdFx0YWx3YXlzU2hvdzogaXRlbS5hbHdheXNTaG93LFxuXHRcdFx0XHRcdFx0dG9vbHRpcDogYWxsb3dlZFRvb2x0aXBzID8gTWFya2Rvd25TdHJpbmcuZnJvbVN0cmljdChpdGVtLnRvb2x0aXApIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0YnV0dG9uczogaXRlbS5idXR0b25zPy5tYXA8VHJhbnNmZXJRdWlja0lucHV0QnV0dG9uPigoYnV0dG9uLCBpKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0Li4uZ2V0SWNvblBhdGhPckNsYXNzKGJ1dHRvbi5pY29uUGF0aCksXG5cdFx0XHRcdFx0XHRcdFx0dG9vbHRpcDogYnV0dG9uLnRvb2x0aXAsXG5cdFx0XHRcdFx0XHRcdFx0aGFuZGxlOiBpXG5cdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHR9KSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnVwZGF0ZSh7XG5cdFx0XHRcdGl0ZW1zOiBwaWNrSXRlbXMsXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRnZXQgY2FuU2VsZWN0TWFueSgpIHtcblx0XHRcdHJldHVybiB0aGlzLl9jYW5TZWxlY3RNYW55O1xuXHRcdH1cblxuXHRcdHNldCBjYW5TZWxlY3RNYW55KGNhblNlbGVjdE1hbnk6IGJvb2xlYW4pIHtcblx0XHRcdHRoaXMuX2NhblNlbGVjdE1hbnkgPSBjYW5TZWxlY3RNYW55O1xuXHRcdFx0dGhpcy51cGRhdGUoeyBjYW5TZWxlY3RNYW55IH0pO1xuXHRcdH1cblxuXHRcdGdldCBtYXRjaE9uRGVzY3JpcHRpb24oKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbWF0Y2hPbkRlc2NyaXB0aW9uO1xuXHRcdH1cblxuXHRcdHNldCBtYXRjaE9uRGVzY3JpcHRpb24obWF0Y2hPbkRlc2NyaXB0aW9uOiBib29sZWFuKSB7XG5cdFx0XHR0aGlzLl9tYXRjaE9uRGVzY3JpcHRpb24gPSBtYXRjaE9uRGVzY3JpcHRpb247XG5cdFx0XHR0aGlzLnVwZGF0ZSh7IG1hdGNoT25EZXNjcmlwdGlvbiB9KTtcblx0XHR9XG5cblx0XHRnZXQgbWF0Y2hPbkRldGFpbCgpIHtcblx0XHRcdHJldHVybiB0aGlzLl9tYXRjaE9uRGV0YWlsO1xuXHRcdH1cblxuXHRcdHNldCBtYXRjaE9uRGV0YWlsKG1hdGNoT25EZXRhaWw6IGJvb2xlYW4pIHtcblx0XHRcdHRoaXMuX21hdGNoT25EZXRhaWwgPSBtYXRjaE9uRGV0YWlsO1xuXHRcdFx0dGhpcy51cGRhdGUoeyBtYXRjaE9uRGV0YWlsIH0pO1xuXHRcdH1cblxuXHRcdGdldCBzb3J0QnlMYWJlbCgpIHtcblx0XHRcdHJldHVybiB0aGlzLl9zb3J0QnlMYWJlbDtcblx0XHR9XG5cblx0XHRzZXQgc29ydEJ5TGFiZWwoc29ydEJ5TGFiZWw6IGJvb2xlYW4pIHtcblx0XHRcdHRoaXMuX3NvcnRCeUxhYmVsID0gc29ydEJ5TGFiZWw7XG5cdFx0XHR0aGlzLnVwZGF0ZSh7IHNvcnRCeUxhYmVsIH0pO1xuXHRcdH1cblxuXHRcdGdldCBrZWVwU2Nyb2xsUG9zaXRpb24oKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fa2VlcFNjcm9sbFBvc2l0aW9uO1xuXHRcdH1cblxuXHRcdHNldCBrZWVwU2Nyb2xsUG9zaXRpb24oa2VlcFNjcm9sbFBvc2l0aW9uOiBib29sZWFuKSB7XG5cdFx0XHR0aGlzLl9rZWVwU2Nyb2xsUG9zaXRpb24gPSBrZWVwU2Nyb2xsUG9zaXRpb247XG5cdFx0XHR0aGlzLnVwZGF0ZSh7IGtlZXBTY3JvbGxQb3NpdGlvbiB9KTtcblx0XHR9XG5cblx0XHRnZXQgYWN0aXZlSXRlbXMoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWN0aXZlSXRlbXM7XG5cdFx0fVxuXG5cdFx0c2V0IGFjdGl2ZUl0ZW1zKGFjdGl2ZUl0ZW1zOiBUW10pIHtcblx0XHRcdHRoaXMuX2FjdGl2ZUl0ZW1zID0gYWN0aXZlSXRlbXMuZmlsdGVyKGl0ZW0gPT4gdGhpcy5faXRlbXNUb0hhbmRsZXMuaGFzKGl0ZW0pKTtcblx0XHRcdHRoaXMudXBkYXRlKHsgYWN0aXZlSXRlbXM6IHRoaXMuX2FjdGl2ZUl0ZW1zLm1hcChpdGVtID0+IHRoaXMuX2l0ZW1zVG9IYW5kbGVzLmdldChpdGVtKSkgfSk7XG5cdFx0fVxuXG5cdFx0b25EaWRDaGFuZ2VBY3RpdmUgPSB0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZUVtaXR0ZXIuZXZlbnQ7XG5cblx0XHRnZXQgc2VsZWN0ZWRJdGVtcygpIHtcblx0XHRcdHJldHVybiB0aGlzLl9zZWxlY3RlZEl0ZW1zO1xuXHRcdH1cblxuXHRcdHNldCBzZWxlY3RlZEl0ZW1zKHNlbGVjdGVkSXRlbXM6IFRbXSkge1xuXHRcdFx0dGhpcy5fc2VsZWN0ZWRJdGVtcyA9IHNlbGVjdGVkSXRlbXMuZmlsdGVyKGl0ZW0gPT4gdGhpcy5faXRlbXNUb0hhbmRsZXMuaGFzKGl0ZW0pKTtcblx0XHRcdHRoaXMudXBkYXRlKHsgc2VsZWN0ZWRJdGVtczogdGhpcy5fc2VsZWN0ZWRJdGVtcy5tYXAoaXRlbSA9PiB0aGlzLl9pdGVtc1RvSGFuZGxlcy5nZXQoaXRlbSkpIH0pO1xuXHRcdH1cblxuXHRcdG9uRGlkQ2hhbmdlU2VsZWN0aW9uID0gdGhpcy5fb25EaWRDaGFuZ2VTZWxlY3Rpb25FbWl0dGVyLmV2ZW50O1xuXG5cdFx0X2ZpcmVEaWRDaGFuZ2VBY3RpdmUoaGFuZGxlczogbnVtYmVyW10pIHtcblx0XHRcdGNvbnN0IGl0ZW1zID0gY29hbGVzY2UoaGFuZGxlcy5tYXAoaGFuZGxlID0+IHRoaXMuX2hhbmRsZXNUb0l0ZW1zLmdldChoYW5kbGUpKSk7XG5cdFx0XHR0aGlzLl9hY3RpdmVJdGVtcyA9IGl0ZW1zO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVFbWl0dGVyLmZpcmUoaXRlbXMpO1xuXHRcdH1cblxuXHRcdF9maXJlRGlkQ2hhbmdlU2VsZWN0aW9uKGhhbmRsZXM6IG51bWJlcltdKSB7XG5cdFx0XHRjb25zdCBpdGVtcyA9IGNvYWxlc2NlKGhhbmRsZXMubWFwKGhhbmRsZSA9PiB0aGlzLl9oYW5kbGVzVG9JdGVtcy5nZXQoaGFuZGxlKSkpO1xuXHRcdFx0dGhpcy5fc2VsZWN0ZWRJdGVtcyA9IGl0ZW1zO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTZWxlY3Rpb25FbWl0dGVyLmZpcmUoaXRlbXMpO1xuXHRcdH1cblxuXHRcdG9uRGlkVHJpZ2dlckl0ZW1CdXR0b24gPSB0aGlzLl9vbkRpZFRyaWdnZXJJdGVtQnV0dG9uRW1pdHRlci5ldmVudDtcblxuXHRcdF9maXJlRGlkVHJpZ2dlckl0ZW1CdXR0b24oaXRlbUhhbmRsZTogbnVtYmVyLCBidXR0b25IYW5kbGU6IG51bWJlcikge1xuXHRcdFx0Y29uc3QgaXRlbSA9IHRoaXMuX2hhbmRsZXNUb0l0ZW1zLmdldChpdGVtSGFuZGxlKSE7XG5cdFx0XHRpZiAoIWl0ZW0gfHwgIWl0ZW0uYnV0dG9ucyB8fCAhaXRlbS5idXR0b25zLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBidXR0b24gPSBpdGVtLmJ1dHRvbnNbYnV0dG9uSGFuZGxlXTtcblx0XHRcdGlmIChidXR0b24pIHtcblx0XHRcdFx0dGhpcy5fb25EaWRUcmlnZ2VySXRlbUJ1dHRvbkVtaXR0ZXIuZmlyZSh7XG5cdFx0XHRcdFx0YnV0dG9uLFxuXHRcdFx0XHRcdGl0ZW1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Y2xhc3MgRXh0SG9zdElucHV0Qm94IGV4dGVuZHMgRXh0SG9zdFF1aWNrSW5wdXQgaW1wbGVtZW50cyBJbnB1dEJveCB7XG5cblx0XHRwcml2YXRlIF9wYXNzd29yZCA9IGZhbHNlO1xuXHRcdHByaXZhdGUgX3Byb21wdDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdHByaXZhdGUgX3ZhbGlkYXRpb25NZXNzYWdlOiBzdHJpbmcgfCBJbnB1dEJveFZhbGlkYXRpb25NZXNzYWdlIHwgdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3RydWN0b3IoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIG9uRGlzcG9zZTogKCkgPT4gdm9pZCkge1xuXHRcdFx0c3VwZXIoZXh0ZW5zaW9uLCBvbkRpc3Bvc2UpO1xuXHRcdFx0dGhpcy51cGRhdGUoeyB0eXBlOiAnaW5wdXRCb3gnIH0pO1xuXHRcdH1cblxuXHRcdGdldCBwYXNzd29yZCgpIHtcblx0XHRcdHJldHVybiB0aGlzLl9wYXNzd29yZDtcblx0XHR9XG5cblx0XHRzZXQgcGFzc3dvcmQocGFzc3dvcmQ6IGJvb2xlYW4pIHtcblx0XHRcdHRoaXMuX3Bhc3N3b3JkID0gcGFzc3dvcmQ7XG5cdFx0XHR0aGlzLnVwZGF0ZSh7IHBhc3N3b3JkIH0pO1xuXHRcdH1cblxuXHRcdGdldCBwcm9tcHQoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcHJvbXB0O1xuXHRcdH1cblxuXHRcdHNldCBwcm9tcHQocHJvbXB0OiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX3Byb21wdCA9IHByb21wdDtcblx0XHRcdHRoaXMudXBkYXRlKHsgcHJvbXB0IH0pO1xuXHRcdH1cblxuXHRcdGdldCB2YWxpZGF0aW9uTWVzc2FnZSgpIHtcblx0XHRcdHJldHVybiB0aGlzLl92YWxpZGF0aW9uTWVzc2FnZTtcblx0XHR9XG5cblx0XHRzZXQgdmFsaWRhdGlvbk1lc3NhZ2UodmFsaWRhdGlvbk1lc3NhZ2U6IHN0cmluZyB8IElucHV0Qm94VmFsaWRhdGlvbk1lc3NhZ2UgfCB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX3ZhbGlkYXRpb25NZXNzYWdlID0gdmFsaWRhdGlvbk1lc3NhZ2U7XG5cdFx0XHRpZiAoIXZhbGlkYXRpb25NZXNzYWdlKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlKHsgdmFsaWRhdGlvbk1lc3NhZ2U6IHVuZGVmaW5lZCwgc2V2ZXJpdHk6IFNldmVyaXR5Lklnbm9yZSB9KTtcblx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIHZhbGlkYXRpb25NZXNzYWdlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZSh7IHZhbGlkYXRpb25NZXNzYWdlLCBzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3IgfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZSh7IHZhbGlkYXRpb25NZXNzYWdlOiB2YWxpZGF0aW9uTWVzc2FnZS5tZXNzYWdlLCBzZXZlcml0eTogdmFsaWRhdGlvbk1lc3NhZ2Uuc2V2ZXJpdHkgPz8gU2V2ZXJpdHkuRXJyb3IgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIG5ldyBFeHRIb3N0UXVpY2tPcGVuSW1wbCh3b3Jrc3BhY2UsIGNvbW1hbmRzKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQTRCO0FBSXJDLFNBQThDLG1CQUFtRztBQUNqSixTQUFTLFdBQVc7QUFDcEIsU0FBUyxXQUFXLG1CQUFtQixtQkFBbUIsa0NBQWtDO0FBQzVGLFNBQVMsMkJBQTJCO0FBRXBDLFNBQVMsZ0JBQWdCO0FBQ3pCLE9BQU8sY0FBYztBQUNyQixTQUFTLGFBQWEsc0JBQXNCO0FBQzVDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsc0JBQXNCO0FBbUJ4QixTQUFTLHVCQUF1QixhQUEyQixXQUFzQyxVQUFxRTtBQUM1SyxRQUFNLFFBQVEsWUFBWSxTQUFTLFlBQVksbUJBQW1CO0FBQUEsRUFFbEUsTUFBTSxxQkFBc0Q7QUFBQSxJQVkzRCxZQUFZQSxZQUFzQ0MsV0FBMkI7QUFKN0UsV0FBUSxZQUFZLG9CQUFJLElBQStCO0FBRXZELFdBQVEsYUFBYTtBQUdwQixXQUFLLGFBQWFEO0FBQ2xCLFdBQUssWUFBWUM7QUFBQSxJQUNsQjtBQUFBLElBS0EsY0FBYyxXQUFrQyxxQkFBK0MsU0FBNEIsUUFBMkIsa0JBQWtCLE1BQTBDO0FBRWpOLFdBQUssbUJBQW1CO0FBRXhCLFlBQU0sZUFBZSxRQUFRLFFB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
