import "./media/actions.css";
import { localize, localize2 } from "../../../nls.js";
import { IKeybindingService } from "../../../platform/keybinding/common/keybinding.js";
import { DomEmitter } from "../../../base/browser/event.js";
import { Color } from "../../../base/common/color.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { toDisposable, dispose, DisposableStore, setDisposableTracker, DisposableTracker } from "../../../base/common/lifecycle.js";
import { getDomNodePagePosition, append, $, getActiveDocument, onDidRegisterWindow, getWindows } from "../../../base/browser/dom.js";
import { createCSSRule, createStyleSheet } from "../../../base/browser/domStylesheets.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../platform/contextkey/common/contextkey.js";
import { StandardKeyboardEvent } from "../../../base/browser/keyboardEvent.js";
import { RunOnceScheduler } from "../../../base/common/async.js";
import { ILayoutService } from "../../../platform/layout/browser/layoutService.js";
import { Registry } from "../../../platform/registry/common/platform.js";
import { registerAction2, Action2, MenuRegistry } from "../../../platform/actions/common/actions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../platform/storage/common/storage.js";
import { clamp } from "../../../base/common/numbers.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { Extensions as ConfigurationExtensions } from "../../../platform/configuration/common/configurationRegistry.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { IWorkingCopyService } from "../../services/workingCopy/common/workingCopyService.js";
import { Categories } from "../../../platform/action/common/actionCommonCategories.js";
import { IWorkingCopyBackupService } from "../../services/workingCopy/common/workingCopyBackup.js";
import { ResultKind } from "../../../platform/keybinding/common/keybindingResolver.js";
import { IDialogService } from "../../../platform/dialogs/common/dialogs.js";
import { IOutputService } from "../../services/output/common/output.js";
import { windowLogId } from "../../services/log/common/logConstants.js";
import { ByteSize } from "../../../platform/files/common/files.js";
import { IQuickInputService } from "../../../platform/quickinput/common/quickInput.js";
import { IUserDataProfileService } from "../../services/userDataProfile/common/userDataProfile.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import product from "../../../platform/product/common/product.js";
import { CommandsRegistry } from "../../../platform/commands/common/commands.js";
import { IEnvironmentService } from "../../../platform/environment/common/environment.js";
class InspectContextKeysAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.inspectContextKeys",
      title: localize2("inspect context keys", "Inspect Context Keys"),
      category: Categories.Developer,
      f1: true
    });
  }
  run(accessor) {
    const contextKeyService = accessor.get(IContextKeyService);
    const disposables = new DisposableStore();
    const stylesheet = createStyleSheet(void 0, void 0, disposables);
    createCSSRule("*", "cursor: crosshair !important;", stylesheet);
    const hoverFeedback = document.createElement("div");
    const activeDocument = getActiveDocument();
    activeDocument.body.appendChild(hoverFeedback);
    disposables.add(toDisposable(() => hoverFeedback.remove()));
    hoverFeedback.style.position = "absolute";
    hoverFeedback.style.pointerEvents = "none";
    hoverFeedback.style.backgroundColor = "rgba(255, 0, 0, 0.5)";
    hoverFeedback.style.zIndex = "1000";
    const onMouseMove = disposables.add(new DomEmitter(activeDocument, "mousemove", true));
    disposables.add(onMouseMove.event((e) => {
      const target = e.target;
      const position = getDomNodePagePosition(target);
      hoverFeedback.style.top = `${position.top}px`;
      hoverFeedback.style.left = `${position.left}px`;
      hoverFeedback.style.width = `${position.width}px`;
      hoverFeedback.style.height = `${position.height}px`;
    }));
    const onMouseDown = disposables.add(new DomEmitter(activeDocument, "mousedown", true));
    Event.once(onMouseDown.event)((e) => {
      e.preventDefault();
      e.stopPropagation();
    }, null, disposables);
    const onMouseUp = disposables.add(new DomEmitter(activeDocument, "mouseup", true));
    Event.once(onMouseUp.event)((e) => {
      e.preventDefault();
      e.stopPropagation();
      const context = contextKeyService.getContext(e.target);
      console.log(context.collectAllValues());
      dispose(disposables);
    }, null, disposables);
  }
}
class ToggleScreencastModeAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.toggleScreencastMode",
      title: localize2("toggle screencast mode", "Toggle Screencast Mode"),
      category: Categories.Developer,
      f1: true
    });
  }
  run(accessor) {
    if (ToggleScreencastModeAction.disposable) {
      ToggleScreencastModeAction.disposable.dispose();
      ToggleScreencastModeAction.disposable = void 0;
      return;
    }
    const layoutService = accessor.get(ILayoutService);
    const configurationService = accessor.get(IConfigurationService);
    const keybindingService = accessor.get(IKeybindingService);
    const disposables = new DisposableStore();
    const container = layoutService.activeContainer;
    const mouseMarker = append(container, $(".screencast-mouse"));
    disposables.add(toDisposable(() => mouseMarker.remove()));
    const keyboardMarker = append(container, $(".screencast-keyboard"));
    disposables.add(toDisposable(() => keyboardMarker.remove()));
    const onMouseDown = disposables.add(new Emitter());
    const onMouseUp = disposables.add(new Emitter());
    const onMouseMove = disposables.add(new Emitter());
    function registerContainerListeners(container2, disposables2) {
      disposables2.add(disposables2.add(new DomEmitter(container2, "mousedown", true)).event((e) => onMouseDown.fire(e)));
      disposables2.add(disposables2.add(new DomEmitter(container2, "mouseup", true)).event((e) => onMouseUp.fire(e)));
      disposables2.add(disposables2.add(new DomEmitter(container2, "mousemove", true)).event((e) => onMouseMove.fire(e)));
    }
    for (const { window, disposables: disposables2 } of getWindows()) {
      registerContainerListeners(layoutService.getContainer(window), disposables2);
    }
    disposables.add(onDidRegisterWindow(({ window, disposables: disposables2 }) => registerContainerListeners(layoutService.getContainer(window), disposables2)));
    disposables.add(layoutService.onDidChangeActiveContainer(() => {
      layoutService.activeContainer.appendChild(mouseMarker);
      layoutService.activeContainer.appendChild(keyboardMarker);
    }));
    const updateMouseIndicatorColor = () => {
      mouseMarker.style.borderColor = Color.fromHex(configurationService.getValue("screencastMode.mouseIndicatorColor")).toString();
    };
    let mouseIndicatorSize;
    const updateMouseIndicatorSize = () => {
      mouseIndicatorSize = clamp(configurationService.getValue("screencastMode.mouseIndicatorSize") || 20, 20, 100);
      mouseMarker.style.height = `${mouseIndicatorSize}px`;
      mouseMarker.style.width = `${mouseIndicatorSize}px`;
    };
    updateMouseIndicatorColor();
    updateMouseIndicatorSize();
    disposables.add(onMouseDown.event((e) => {
      mouseMarker.style.top = `${e.clientY - mouseIndicatorSize / 2}px`;
      mouseMarker.style.left = `${e.clientX - mouseIndicatorSize / 2}px`;
      mouseMarker.style.display = "block";
      mouseMarker.style.transform = `scale(${1})`;
      mouseMarker.style.transition = "transform 0.1s";
      const mouseMoveListener = onMouseMove.event((e2) => {
        mouseMarker.style.top = `${e2.clientY - mouseIndicatorSize / 2}px`;
        mouseMarker.style.left = `${e2.clientX - mouseIndicatorSize / 2}px`;
        mouseMarker.style.transform = `scale(${0.8})`;
      });
      Event.once(onMouseUp.event)(() => {
        mouseMarker.style.display = "none";
        mouseMoveListener.dispose();
      });
    }));
    const updateKeyboardFontSize = () => {
      keyboardMarker.style.fontSize = `${clamp(configurationService.getValue("screencastMode.fontSize") || 56, 20, 100)}px`;
    };
    const updateKeyboardMarker = () => {
      keyboardMarker.style.bottom = `${clamp(configurationService.getValue("screencastMode.verticalOffset") || 0, 0, 90)}%`;
    };
    let keyboardMarkerTimeout;
    const updateKeyboardMarkerTimeout = () => {
      keyboardMarkerTimeout = clamp(configurationService.getValue("screencastMode.keyboardOverlayTimeout") || 800, 500, 5e3);
    };
    updateKeyboardFontSize();
    updateKeyboardMarker();
    updateKeyboardMarkerTimeout();
    disposables.add(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("screencastMode.verticalOffset")) {
        updateKeyboardMarker();
      }
      if (e.affectsConfiguration("screencastMode.fontSize")) {
        updateKeyboardFontSize();
      }
      if (e.affectsConfiguration("screencastMode.keyboardOverlayTimeout")) {
        updateKeyboardMarkerTimeout();
      }
      if (e.affectsConfiguration("screencastMode.mouseIndicatorColor")) {
        updateMouseIndicatorColor();
      }
      if (e.affectsConfiguration("screencastMode.mouseIndicatorSize")) {
        updateMouseIndicatorSize();
      }
    }));
    const onKeyDown = disposables.add(new Emitter());
    const onCompositionStart = disposables.add(new Emitter());
    const onCompositionUpdate = disposables.add(new Emitter());
    const onCompositionEnd = disposables.add(new Emitter());
    function registerWindowListeners(window, disposables2) {
      disposables2.add(disposables2.add(new DomEmitter(window, "keydown", true)).event((e) => onKeyDown.fire(e)));
      disposables2.add(disposables2.add(new DomEmitter(window, "compositionstart", true)).event((e) => onCompositionStart.fire(e)));
      disposables2.add(disposables2.add(new DomEmitter(window, "compositionupdate", true)).event((e) => onCompositionUpdate.fire(e)));
      disposables2.add(disposables2.add(new DomEmitter(window, "compositionend", true)).event((e) => onCompositionEnd.fire(e)));
    }
    for (const { window, disposables: disposables2 } of getWindows()) {
      registerWindowListeners(window, disposables2);
    }
    disposables.add(onDidRegisterWindow(({ window, disposables: disposables2 }) => registerWindowListeners(window, disposables2)));
    let length = 0;
    let composing = void 0;
    let imeBackSpace = false;
    const clearKeyboardScheduler = new RunOnceScheduler(() => {
      keyboardMarker.textContent = "";
      composing = void 0;
      length = 0;
    }, keyboardMarkerTimeout);
    disposables.add(onCompositionStart.event((e) => {
      imeBackSpace = true;
    }));
    disposables.add(onCompositionUpdate.event((e) => {
      if (e.data && imeBackSpace) {
        if (length > 20) {
          keyboardMarker.innerText = "";
          length = 0;
        }
        composing = composing ?? append(keyboardMarker, $("span.key"));
        composing.textContent = e.data;
      } else if (imeBackSpace) {
        keyboardMarker.innerText = "";
        append(keyboardMarker, $("span.key", {}, `Backspace`));
      }
      clearKeyboardScheduler.schedule();
    }));
    disposables.add(onCompositionEnd.event((e) => {
      composing = void 0;
      length++;
    }));
    disposables.add(onKeyDown.event((e) => {
      if (e.key === "Process" || /[\uac00-\ud787\u3131-\u314e\u314f-\u3163\u3041-\u3094\u30a1-\u30f4\u30fc\u3005\u3006\u3024\u4e00-\u9fa5]/u.test(e.key)) {
        if (e.code === "Backspace") {
          imeBackSpace = true;
        } else if (!e.code.includes("Key")) {
          composing = void 0;
          imeBackSpace = false;
        } else {
          imeBackSpace = true;
        }
        clearKeyboardScheduler.schedule();
        return;
      }
      if (e.isComposing) {
        return;
      }
      const options = configurationService.getValue("screencastMode.keyboardOptions");
      const event = new StandardKeyboardEvent(e);
      const shortcut = keybindingService.softDispatch(event, event.target);
      if (shortcut.kind === ResultKind.KbFound && shortcut.commandId && !(options.showSingleEditorCursorMoves ?? true) && ["cursorLeft", "cursorRight", "cursorUp", "cursorDown"].includes(shortcut.commandId)) {
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || length > 20 || event.keyCode === KeyCode.Backspace || event.keyCode === KeyCode.Escape || event.keyCode === KeyCode.UpArrow || event.keyCode === KeyCode.DownArrow || event.keyCode === KeyCode.LeftArrow || event.keyCode === KeyCode.RightArrow) {
        keyboardMarker.innerText = "";
        length = 0;
      }
      const keybinding = keybindingService.resolveKeyboardEvent(event);
      const commandDetails = this._isKbFound(shortcut) && shortcut.commandId ? this.getCommandDetails(shortcut.commandId) : void 0;
      let commandAndGroupLabel = commandDetails?.title;
      let keyLabel = keybinding.getLabel();
      if (commandDetails) {
        if ((options.showCommandGroups ?? false) && commandDetails.category) {
          commandAndGroupLabel = `${commandDetails.category}: ${commandAndGroupLabel} `;
        }
        if (this._isKbFound(shortcut) && shortcut.commandId) {
          const keybindings = keybindingService.lookupKeybindings(shortcut.commandId).filter((k) => k.getLabel()?.endsWith(keyLabel ?? ""));
          if (keybindings.length > 0) {
            keyLabel = keybindings[keybindings.length - 1].getLabel();
          }
        }
      }
      if ((options.showCommands ?? true) && commandAndGroupLabel) {
        append(keyboardMarker, $("span.title", {}, `${commandAndGroupLabel} `));
      }
      if ((options.showKeys ?? true) || (options.showKeybindings ?? true) && this._isKbFound(shortcut)) {
        keyLabel = keyLabel?.replace("UpArrow", "\u2191")?.replace("DownArrow", "\u2193")?.replace("LeftArrow", "\u2190")?.replace("RightArrow", "\u2192");
        append(keyboardMarker, $("span.key", {}, keyLabel ?? ""));
      }
      length++;
      clearKeyboardScheduler.schedule();
    }));
    ToggleScreencastModeAction.disposable = disposables;
  }
  _isKbFound(resolutionResult) {
    return resolutionResult.kind === ResultKind.KbFound;
  }
  getCommandDetails(commandId) {
    const fromMenuRegistry = MenuRegistry.getCommand(commandId);
    if (fromMenuRegistry) {
      return {
        title: typeof fromMenuRegistry.title === "string" ? fromMenuRegistry.title : fromMenuRegistry.title.value,
        category: fromMenuRegistry.category ? typeof fromMenuRegistry.category === "string" ? fromMenuRegistry.category : fromMenuRegistry.category.value : void 0
      };
    }
    const fromCommandsRegistry = CommandsRegistry.getCommand(commandId);
    if (fromCommandsRegistry && fromCommandsRegistry.metadata?.description) {
      return { title: typeof fromCommandsRegistry.metadata.description === "string" ? fromCommandsRegistry.metadata.description : fromCommandsRegistry.metadata.description.value };
    }
    return void 0;
  }
}
class LogStorageAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.logStorage",
      title: localize2({ key: "logStorage", comment: ["A developer only action to log the contents of the storage for the current window."] }, "Log Storage Database Contents"),
      category: Categories.Developer,
      f1: true
    });
  }
  run(accessor) {
    const storageService = accessor.get(IStorageService);
    const dialogService = accessor.get(IDialogService);
    storageService.log();
    dialogService.info(localize("storageLogDialogMessage", "The storage database contents have been logged to the developer tools."), localize("storageLogDialogDetails", "Open developer tools from the menu and select the Console tab."));
  }
}
class LogWorkingCopiesAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.logWorkingCopies",
      title: localize2({ key: "logWorkingCopies", comment: ["A developer only action to log the working copies that exist."] }, "Log Working Copies"),
      category: Categories.Developer,
      f1: true
    });
  }
  async run(accessor) {
    const workingCopyService = accessor.get(IWorkingCopyService);
    const workingCopyBackupService = accessor.get(IWorkingCopyBackupService);
    const logService = accessor.get(ILogService);
    const outputService = accessor.get(IOutputService);
    const backups = await workingCopyBackupService.getBackups();
    const msg = [
      ``,
      `[Working Copies]`,
      ...workingCopyService.workingCopies.length > 0 ? workingCopyService.workingCopies.map((workingCopy) => `${workingCopy.isDirty() ? "\u25CF " : ""}${workingCopy.resource.toString(true)} (typeId: ${workingCopy.typeId || "<no typeId>"})`) : ["<none>"],
      ``,
      `[Backups]`,
      ...backups.length > 0 ? backups.map((backup) => `${backup.resource.toString(true)} (typeId: ${backup.typeId || "<no typeId>"})`) : ["<none>"]
    ];
    logService.info(msg.join("\n"));
    outputService.showChannel(windowLogId, true);
  }
}
const _RemoveLargeStorageEntriesAction = class _RemoveLargeStorageEntriesAction extends Action2 {
  // 16kb
  constructor() {
    super({
      id: "workbench.action.removeLargeStorageDatabaseEntries",
      title: localize2("removeLargeStorageDatabaseEntries", "Remove Large Storage Database Entries..."),
      category: Categories.Developer,
      f1: true
    });
  }
  async run(accessor) {
    const storageService = accessor.get(IStorageService);
    const quickInputService = accessor.get(IQuickInputService);
    const userDataProfileService = accessor.get(IUserDataProfileService);
    const dialogService = accessor.get(IDialogService);
    const environmentService = accessor.get(IEnvironmentService);
    const items = [];
    for (const scope of [StorageScope.APPLICATION, StorageScope.PROFILE, StorageScope.WORKSPACE]) {
      if (scope === StorageScope.PROFILE && userDataProfileService.currentProfile.isDefault) {
        continue;
      }
      for (const target of [StorageTarget.MACHINE, StorageTarget.USER]) {
        for (const key of storageService.keys(scope, target)) {
          const value = storageService.get(key, scope);
          if (value && (!environmentService.isBuilt || value.length > _RemoveLargeStorageEntriesAction.SIZE_THRESHOLD)) {
            items.push({
              key,
              scope,
              target,
              size: value.length,
              label: key,
              description: ByteSize.formatSize(value.length),
              detail: localize("largeStorageItemDetail", "Scope: {0}, Target: {1}", scope === StorageScope.APPLICATION ? localize("global", "Global") : scope === StorageScope.PROFILE ? localize("profile", "Profile") : localize("workspace", "Workspace"), target === StorageTarget.MACHINE ? localize("machine", "Machine") : localize("user", "User"))
            });
          }
        }
      }
    }
    items.sort((itemA, itemB) => itemB.size - itemA.size);
    const selectedItems = await new Promise((resolve) => {
      const disposables = new DisposableStore();
      const picker = disposables.add(quickInputService.createQuickPick());
      picker.items = items;
      picker.canSelectMany = true;
      picker.ok = false;
      picker.customButton = true;
      picker.hideCheckAll = true;
      picker.customLabel = localize("removeLargeStorageEntriesPickerButton", "Remove");
      picker.placeholder = localize("removeLargeStorageEntriesPickerPlaceholder", "Select large entries to remove from storage");
      if (items.length === 0) {
        picker.description = localize("removeLargeStorageEntriesPickerDescriptionNoEntries", "There are no large storage entries to remove.");
      }
      picker.show();
      disposables.add(picker.onDidCustom(() => {
        resolve(picker.selectedItems);
        picker.hide();
      }));
      disposables.add(picker.onDidHide(() => disposables.dispose()));
    });
    if (selectedItems.length === 0) {
      return;
    }
    const { confirmed } = await dialogService.confirm({
      type: "warning",
      message: localize("removeLargeStorageEntriesConfirmRemove", "Do you want to remove the selected storage entries from the database?"),
      detail: localize("removeLargeStorageEntriesConfirmRemoveDetail", "{0}\n\nThis action is irreversible and may result in data loss!", selectedItems.map((item) => item.label).join("\n")),
      primaryButton: localize({ key: "removeLargeStorageEntriesButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Remove")
    });
    if (!confirmed) {
      return;
    }
    const scopesToOptimize = /* @__PURE__ */ new Set();
    for (const item of selectedItems) {
      storageService.remove(item.key, item.scope);
      scopesToOptimize.add(item.scope);
    }
    for (const scope of scopesToOptimize) {
      await storageService.optimize(scope);
    }
  }
};
_RemoveLargeStorageEntriesAction.SIZE_THRESHOLD = 1024 * 16;
let RemoveLargeStorageEntriesAction = _RemoveLargeStorageEntriesAction;
let tracker = void 0;
let trackedDisposables = /* @__PURE__ */ new Set();
const DisposablesSnapshotStateContext = new RawContextKey("dirtyWorkingCopies", "stopped");
class StartTrackDisposables extends Action2 {
  constructor() {
    super({
      id: "workbench.action.startTrackDisposables",
      title: localize2("startTrackDisposables", "Start Tracking Disposables"),
      category: Categories.Developer,
      f1: true,
      precondition: ContextKeyExpr.and(DisposablesSnapshotStateContext.isEqualTo("pending").negate(), DisposablesSnapshotStateContext.isEqualTo("started").negate())
    });
  }
  run(accessor) {
    const disposablesSnapshotStateContext = DisposablesSnapshotStateContext.bindTo(accessor.get(IContextKeyService));
    disposablesSnapshotStateContext.set("started");
    trackedDisposables.clear();
    tracker = new DisposableTracker();
    setDisposableTracker(tracker);
  }
}
class SnapshotTrackedDisposables extends Action2 {
  constructor() {
    super({
      id: "workbench.action.snapshotTrackedDisposables",
      title: localize2("snapshotTrackedDisposables", "Snapshot Tracked Disposables"),
      category: Categories.Developer,
      f1: true,
      precondition: DisposablesSnapshotStateContext.isEqualTo("started")
    });
  }
  run(accessor) {
    const disposablesSnapshotStateContext = DisposablesSnapshotStateContext.bindTo(accessor.get(IContextKeyService));
    disposablesSnapshotStateContext.set("pending");
    trackedDisposables = new Set(tracker?.computeLeakingDisposables(1e3)?.leaks.map((disposable) => disposable.value));
  }
}
class StopTrackDisposables extends Action2 {
  constructor() {
    super({
      id: "workbench.action.stopTrackDisposables",
      title: localize2("stopTrackDisposables", "Stop Tracking Disposables"),
      category: Categories.Developer,
      f1: true,
      precondition: DisposablesSnapshotStateContext.isEqualTo("pending")
    });
  }
  run(accessor) {
    const editorService = accessor.get(IEditorService);
    const disposablesSnapshotStateContext = DisposablesSnapshotStateContext.bindTo(accessor.get(IContextKeyService));
    disposablesSnapshotStateContext.set("stopped");
    if (tracker) {
      const disposableLeaks = /* @__PURE__ */ new Set();
      for (const disposable of new Set(tracker.computeLeakingDisposables(1e3)?.leaks) ?? []) {
        if (trackedDisposables.has(disposable.value)) {
          disposableLeaks.add(disposable);
        }
      }
      const leaks = tracker.computeLeakingDisposables(1e3, Array.from(disposableLeaks));
      if (leaks) {
        editorService.openEditor({ resource: void 0, contents: leaks.details });
      }
    }
    setDisposableTracker(null);
    tracker = void 0;
    trackedDisposables.clear();
  }
}
registerAction2(InspectContextKeysAction);
registerAction2(ToggleScreencastModeAction);
registerAction2(LogStorageAction);
registerAction2(LogWorkingCopiesAction);
registerAction2(RemoveLargeStorageEntriesAction);
if (!product.commit) {
  registerAction2(StartTrackDisposables);
  registerAction2(SnapshotTrackedDisposables);
  registerAction2(StopTrackDisposables);
}
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
  id: "screencastMode",
  order: 9,
  title: localize("screencastModeConfigurationTitle", "Screencast Mode"),
  type: "object",
  properties: {
    "screencastMode.verticalOffset": {
      type: "number",
      default: 20,
      minimum: 0,
      maximum: 90,
      description: localize("screencastMode.location.verticalPosition", "Controls the vertical offset of the screencast mode overlay from the bottom as a percentage of the workbench height.")
    },
    "screencastMode.fontSize": {
      type: "number",
      default: 56,
      minimum: 20,
      maximum: 100,
      description: localize("screencastMode.fontSize", "Controls the font size (in pixels) of the screencast mode keyboard.")
    },
    "screencastMode.keyboardOptions": {
      type: "object",
      description: localize("screencastMode.keyboardOptions.description", "Options for customizing the keyboard overlay in screencast mode."),
      properties: {
        "showKeys": {
          type: "boolean",
          default: true,
          description: localize("screencastMode.keyboardOptions.showKeys", "Show raw keys.")
        },
        "showKeybindings": {
          type: "boolean",
          default: true,
          description: localize("screencastMode.keyboardOptions.showKeybindings", "Show keyboard shortcuts.")
        },
        "showCommands": {
          type: "boolean",
          default: true,
          description: localize("screencastMode.keyboardOptions.showCommands", "Show command names.")
        },
        "showCommandGroups": {
          type: "boolean",
          default: false,
          description: localize("screencastMode.keyboardOptions.showCommandGroups", "Show command group names, when commands are also shown.")
        },
        "showSingleEditorCursorMoves": {
          type: "boolean",
          default: true,
          description: localize("screencastMode.keyboardOptions.showSingleEditorCursorMoves", "Show single editor cursor move commands.")
        }
      },
      default: {
        "showKeys": true,
        "showKeybindings": true,
        "showCommands": true,
        "showCommandGroups": false,
        "showSingleEditorCursorMoves": true
      },
      additionalProperties: false
    },
    "screencastMode.keyboardOverlayTimeout": {
      type: "number",
      default: 800,
      minimum: 500,
      maximum: 5e3,
      description: localize("screencastMode.keyboardOverlayTimeout", "Controls how long (in milliseconds) the keyboard overlay is shown in screencast mode.")
    },
    "screencastMode.mouseIndicatorColor": {
      type: "string",
      format: "color-hex",
      default: "#FF0000",
      description: localize("screencastMode.mouseIndicatorColor", "Controls the color in hex (#RGB, #RGBA, #RRGGBB or #RRGGBBAA) of the mouse indicator in screencast mode.")
    },
    "screencastMode.mouseIndicatorSize": {
      type: "number",
      default: 20,
      minimum: 20,
      maximum: 100,
      description: localize("screencastMode.mouseIndicatorSize", "Controls the size (in pixels) of the mouse indicator in screencast mode.")
    }
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9hY3Rpb25zL2RldmVsb3BlckFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvYWN0aW9ucy5jc3MnO1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgRG9tRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9ldmVudC5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSwgZGlzcG9zZSwgRGlzcG9zYWJsZVN0b3JlLCBzZXREaXNwb3NhYmxlVHJhY2tlciwgRGlzcG9zYWJsZVRyYWNrZXIsIERpc3Bvc2FibGVJbmZvIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGdldERvbU5vZGVQYWdlUG9zaXRpb24sIGFwcGVuZCwgJCwgZ2V0QWN0aXZlRG9jdW1lbnQsIG9uRGlkUmVnaXN0ZXJXaW5kb3csIGdldFdpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IGNyZWF0ZUNTU1J1bGUsIGNyZWF0ZVN0eWxlU2hlZXQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tU3R5bGVzaGVldHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXlTZXJ2aWNlLCBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9icm93c2VyL2NvbnRleHRLZXlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBJTGF5b3V0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xheW91dC9icm93c2VyL2xheW91dFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJBY3Rpb24yLCBBY3Rpb24yLCBNZW51UmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBjbGFtcCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL251bWJlcnMuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHlCYWNrdXAuanMnO1xuaW1wb3J0IHsgUmVzb2x1dGlvblJlc3VsdCwgUmVzdWx0S2luZCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSU91dHB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9vdXRwdXQvY29tbW9uL291dHB1dC5qcyc7XG5pbXBvcnQgeyB3aW5kb3dMb2dJZCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2xvZy9jb21tb24vbG9nQ29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEJ5dGVTaXplIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHByb2R1Y3QgZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdC5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuXG5jbGFzcyBJbnNwZWN0Q29udGV4dEtleXNBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uaW5zcGVjdENvbnRleHRLZXlzJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2luc3BlY3QgY29udGV4dCBrZXlzJywgJ0luc3BlY3QgQ29udGV4dCBLZXlzJyksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Y29uc3Qgc3R5bGVzaGVldCA9IGNyZWF0ZVN0eWxlU2hlZXQodW5kZWZpbmVkLCB1bmRlZmluZWQsIGRpc3Bvc2FibGVzKTtcblx0XHRjcmVhdGVDU1NSdWxlKCcqJywgJ2N1cnNvcjogY3Jvc3NoYWlyICFpbXBvcnRhbnQ7Jywgc3R5bGVzaGVldCk7XG5cblx0XHRjb25zdCBob3ZlckZlZWRiYWNrID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29uc3QgYWN0aXZlRG9jdW1lbnQgPSBnZXRBY3RpdmVEb2N1bWVudCgpO1xuXHRcdGFjdGl2ZURvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaG92ZXJGZWVkYmFjayk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBob3ZlckZlZWRiYWNrLnJlbW92ZSgpKSk7XG5cblx0XHRob3ZlckZlZWRiYWNrLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHRob3ZlckZlZWRiYWNrLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG5cdFx0aG92ZXJGZWVkYmFjay5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAncmdiYSgyNTUsIDAsIDAsIDAuNSknO1xuXHRcdGhvdmVyRmVlZGJhY2suc3R5bGUuekluZGV4ID0gJzEwMDAnO1xuXG5cdFx0Y29uc3Qgb25Nb3VzZU1vdmUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIoYWN0aXZlRG9jdW1lbnQsICdtb3VzZW1vdmUnLCB0cnVlKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG9uTW91c2VNb3ZlLmV2ZW50KGUgPT4ge1xuXHRcdFx0Y29uc3QgdGFyZ2V0ID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0XHRjb25zdCBwb3NpdGlvbiA9IGdldERvbU5vZGVQYWdlUG9zaXRpb24odGFyZ2V0KTtcblxuXHRcdFx0aG92ZXJGZWVkYmFjay5zdHlsZS50b3AgPSBgJHtwb3NpdGlvbi50b3B9cHhgO1xuXHRcdFx0aG92ZXJGZWVkYmFjay5zdHlsZS5sZWZ0ID0gYCR7cG9zaXRpb24ubGVmdH1weGA7XG5cdFx0XHRob3ZlckZlZWRiYWNrLnN0eWxlLndpZHRoID0gYCR7cG9zaXRpb24ud2lkdGh9cHhgO1xuXHRcdFx0aG92ZXJGZWVkYmFjay5zdHlsZS5oZWlnaHQgPSBgJHtwb3NpdGlvbi5oZWlnaHR9cHhgO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IG9uTW91c2VEb3duID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKGFjdGl2ZURvY3VtZW50LCAnbW91c2Vkb3duJywgdHJ1ZSkpO1xuXHRcdEV2ZW50Lm9uY2Uob25Nb3VzZURvd24uZXZlbnQpKGUgPT4geyBlLnByZXZlbnREZWZhdWx0KCk7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IH0sIG51bGwsIGRpc3Bvc2FibGVzKTtcblxuXHRcdGNvbnN0IG9uTW91c2VVcCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRG9tRW1pdHRlcihhY3RpdmVEb2N1bWVudCwgJ21vdXNldXAnLCB0cnVlKSk7XG5cdFx0RXZlbnQub25jZShvbk1vdXNlVXAuZXZlbnQpKGUgPT4ge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblxuXHRcdFx0Y29uc3QgY29udGV4dCA9IGNvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpIGFzIENvbnRleHQ7XG5cdFx0XHRjb25zb2xlLmxvZyhjb250ZXh0LmNvbGxlY3RBbGxWYWx1ZXMoKSk7XG5cblx0XHRcdGRpc3Bvc2UoZGlzcG9zYWJsZXMpO1xuXHRcdH0sIG51bGwsIGRpc3Bvc2FibGVzKTtcblx0fVxufVxuXG5pbnRlcmZhY2UgSVNjcmVlbmNhc3RLZXlib2FyZE9wdGlvbnMge1xuXHRyZWFkb25seSBzaG93S2V5cz86IGJvb2xlYW47XG5cdHJlYWRvbmx5IHNob3dLZXliaW5kaW5ncz86IGJvb2xlYW47XG5cdHJlYWRvbmx5IHNob3dDb21tYW5kcz86IGJvb2xlYW47XG5cdHJlYWRvbmx5IHNob3dDb21tYW5kR3JvdXBzPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgc2hvd1NpbmdsZUVkaXRvckN1cnNvck1vdmVzPzogYm9vbGVhbjtcbn1cblxuY2xhc3MgVG9nZ2xlU2NyZWVuY2FzdE1vZGVBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRzdGF0aWMgZGlzcG9zYWJsZTogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnRvZ2dsZVNjcmVlbmNhc3RNb2RlJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3RvZ2dsZSBzY3JlZW5jYXN0IG1vZGUnLCAnVG9nZ2xlIFNjcmVlbmNhc3QgTW9kZScpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRGV2ZWxvcGVyLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGlmIChUb2dnbGVTY3JlZW5jYXN0TW9kZUFjdGlvbi5kaXNwb3NhYmxlKSB7XG5cdFx0XHRUb2dnbGVTY3JlZW5jYXN0TW9kZUFjdGlvbi5kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdFRvZ2dsZVNjcmVlbmNhc3RNb2RlQWN0aW9uLmRpc3Bvc2FibGUgPSB1bmRlZmluZWQ7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGF5b3V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJTGF5b3V0U2VydmljZSk7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBrZXliaW5kaW5nU2VydmljZSA9IGFjY2Vzc29yLmdldChJS2V5YmluZGluZ1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBjb250YWluZXIgPSBsYXlvdXRTZXJ2aWNlLmFjdGl2ZUNvbnRhaW5lcjtcblxuXHRcdGNvbnN0IG1vdXNlTWFya2VyID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnLnNjcmVlbmNhc3QtbW91c2UnKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBtb3VzZU1hcmtlci5yZW1vdmUoKSkpO1xuXG5cdFx0Y29uc3Qga2V5Ym9hcmRNYXJrZXIgPSBhcHBlbmQoY29udGFpbmVyLCAkKCcuc2NyZWVuY2FzdC1rZXlib2FyZCcpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IGtleWJvYXJkTWFya2VyLnJlbW92ZSgpKSk7XG5cblx0XHRjb25zdCBvbk1vdXNlRG93biA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRW1pdHRlcjxNb3VzZUV2ZW50PigpKTtcblx0XHRjb25zdCBvbk1vdXNlVXAgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEVtaXR0ZXI8TW91c2VFdmVudD4oKSk7XG5cdFx0Y29uc3Qgb25Nb3VzZU1vdmUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEVtaXR0ZXI8TW91c2VFdmVudD4oKSk7XG5cblx0XHRmdW5jdGlvbiByZWdpc3RlckNvbnRhaW5lckxpc3RlbmVycyhjb250YWluZXI6IEhUTUxFbGVtZW50LCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKTogdm9pZCB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKGNvbnRhaW5lciwgJ21vdXNlZG93bicsIHRydWUpKS5ldmVudChlID0+IG9uTW91c2VEb3duLmZpcmUoZSkpKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChkaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIoY29udGFpbmVyLCAnbW91c2V1cCcsIHRydWUpKS5ldmVudChlID0+IG9uTW91c2VVcC5maXJlKGUpKSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKGNvbnRhaW5lciwgJ21vdXNlbW92ZScsIHRydWUpKS5ldmVudChlID0+IG9uTW91c2VNb3ZlLmZpcmUoZSkpKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IHsgd2luZG93LCBkaXNwb3NhYmxlcyB9IG9mIGdldFdpbmRvd3MoKSkge1xuXHRcdFx0cmVnaXN0ZXJDb250YWluZXJMaXN0ZW5lcnMobGF5b3V0U2VydmljZS5nZXRDb250YWluZXIod2luZG93KSwgZGlzcG9zYWJsZXMpO1xuXHRcdH1cblxuXHRcdGRpc3Bvc2FibGVzLmFkZChvbkRpZFJlZ2lzdGVyV2luZG93KCh7IHdpbmRvdywgZGlzcG9zYWJsZXMgfSkgPT4gcmVnaXN0ZXJDb250YWluZXJMaXN0ZW5lcnMobGF5b3V0U2VydmljZS5nZXRDb250YWluZXIod2luZG93KSwgZGlzcG9zYWJsZXMpKSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobGF5b3V0U2VydmljZS5vbkRpZENoYW5nZUFjdGl2ZUNvbnRhaW5lcigoKSA9PiB7XG5cdFx0XHRsYXlvdXRTZXJ2aWNlLmFjdGl2ZUNvbnRhaW5lci5hcHBlbmRDaGlsZChtb3VzZU1hcmtlcik7XG5cdFx0XHRsYXlvdXRTZXJ2aWNlLmFjdGl2ZUNvbnRhaW5lci5hcHBlbmRDaGlsZChrZXlib2FyZE1hcmtlcik7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgdXBkYXRlTW91c2VJbmRpY2F0b3JDb2xvciA9ICgpID0+IHtcblx0XHRcdG1vdXNlTWFya2VyLnN0eWxlLmJvcmRlckNvbG9yID0gQ29sb3IuZnJvbUhleChjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxzdHJpbmc+KCdzY3JlZW5jYXN0TW9kZS5tb3VzZUluZGljYXRvckNvbG9yJykpLnRvU3RyaW5nKCk7XG5cdFx0fTtcblxuXHRcdGxldCBtb3VzZUluZGljYXRvclNpemU6IG51bWJlcjtcblx0XHRjb25zdCB1cGRhdGVNb3VzZUluZGljYXRvclNpemUgPSAoKSA9PiB7XG5cdFx0XHRtb3VzZUluZGljYXRvclNpemUgPSBjbGFtcChjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KCdzY3JlZW5jYXN0TW9kZS5tb3VzZUluZGljYXRvclNpemUnKSB8fCAyMCwgMjAsIDEwMCk7XG5cblx0XHRcdG1vdXNlTWFya2VyLnN0eWxlLmhlaWdodCA9IGAke21vdXNlSW5kaWNhdG9yU2l6ZX1weGA7XG5cdFx0XHRtb3VzZU1hcmtlci5zdHlsZS53aWR0aCA9IGAke21vdXNlSW5kaWNhdG9yU2l6ZX1weGA7XG5cdFx0fTtcblxuXHRcdHVwZGF0ZU1vdXNlSW5kaWNhdG9yQ29sb3IoKTtcblx0XHR1cGRhdGVNb3VzZUluZGljYXRvclNpemUoKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChvbk1vdXNlRG93bi5ldmVudChlID0+IHtcblx0XHRcdG1vdXNlTWFya2VyLnN0eWxlLnRvcCA9IGAke2UuY2xpZW50WSAtIG1vdXNlSW5kaWNhdG9yU2l6ZSAvIDJ9cHhgO1xuXHRcdFx0bW91c2VNYXJrZXIuc3R5bGUubGVmdCA9IGAke2UuY2xpZW50WCAtIG1vdXNlSW5kaWNhdG9yU2l6ZSAvIDJ9cHhgO1xuXHRcdFx0bW91c2VNYXJrZXIuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdFx0XHRtb3VzZU1hcmtlci5zdHlsZS50cmFuc2Zvcm0gPSBgc2NhbGUoJHsxfSlgO1xuXHRcdFx0bW91c2VNYXJrZXIuc3R5bGUudHJhbnNpdGlvbiA9ICd0cmFuc2Zvcm0gMC4xcyc7XG5cblx0XHRcdGNvbnN0IG1vdXNlTW92ZUxpc3RlbmVyID0gb25Nb3VzZU1vdmUuZXZlbnQoZSA9PiB7XG5cdFx0XHRcdG1vdXNlTWFya2VyLnN0eWxlLnRvcCA9IGAke2UuY2xpZW50WSAtIG1vdXNlSW5kaWNhdG9yU2l6ZSAvIDJ9cHhgO1xuXHRcdFx0XHRtb3VzZU1hcmtlci5zdHlsZS5sZWZ0ID0gYCR7ZS5jbGllbnRYIC0gbW91c2VJbmRpY2F0b3JTaXplIC8gMn1weGA7XG5cdFx0XHRcdG1vdXNlTWFya2VyLnN0eWxlLnRyYW5zZm9ybSA9IGBzY2FsZSgkey44fSlgO1xuXHRcdFx0fSk7XG5cblx0XHRcdEV2ZW50Lm9uY2Uob25Nb3VzZVVwLmV2ZW50KSgoKSA9PiB7XG5cdFx0XHRcdG1vdXNlTWFya2VyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRcdG1vdXNlTW92ZUxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdH0pO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHVwZGF0ZUtleWJvYXJkRm9udFNpemUgPSAoKSA9PiB7XG5cdFx0XHRrZXlib2FyZE1hcmtlci5zdHlsZS5mb250U2l6ZSA9IGAke2NsYW1wKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPG51bWJlcj4oJ3NjcmVlbmNhc3RNb2RlLmZvbnRTaXplJykgfHwgNTYsIDIwLCAxMDApfXB4YDtcblx0XHR9O1xuXG5cdFx0Y29uc3QgdXBkYXRlS2V5Ym9hcmRNYXJrZXIgPSAoKSA9PiB7XG5cdFx0XHRrZXlib2FyZE1hcmtlci5zdHlsZS5ib3R0b20gPSBgJHtjbGFtcChjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KCdzY3JlZW5jYXN0TW9kZS52ZXJ0aWNhbE9mZnNldCcpIHx8IDAsIDAsIDkwKX0lYDtcblx0XHR9O1xuXG5cdFx0bGV0IGtleWJvYXJkTWFya2VyVGltZW91dCE6IG51bWJlcjtcblx0XHRjb25zdCB1cGRhdGVLZXlib2FyZE1hcmtlclRpbWVvdXQgPSAoKSA9PiB7XG5cdFx0XHRrZXlib2FyZE1hcmtlclRpbWVvdXQgPSBjbGFtcChjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KCdzY3JlZW5jYXN0TW9kZS5rZXlib2FyZE92ZXJsYXlUaW1lb3V0JykgfHwgODAwLCA1MDAsIDUwMDApO1xuXHRcdH07XG5cblx0XHR1cGRhdGVLZXlib2FyZEZvbnRTaXplKCk7XG5cdFx0dXBkYXRlS2V5Ym9hcmRNYXJrZXIoKTtcblx0XHR1cGRhdGVLZXlib2FyZE1hcmtlclRpbWVvdXQoKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignc2NyZWVuY2FzdE1vZGUudmVydGljYWxPZmZzZXQnKSkge1xuXHRcdFx0XHR1cGRhdGVLZXlib2FyZE1hcmtlcigpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignc2NyZWVuY2FzdE1vZGUuZm9udFNpemUnKSkge1xuXHRcdFx0XHR1cGRhdGVLZXlib2FyZEZvbnRTaXplKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdzY3JlZW5jYXN0TW9kZS5rZXlib2FyZE92ZXJsYXlUaW1lb3V0JykpIHtcblx0XHRcdFx0dXBkYXRlS2V5Ym9hcmRNYXJrZXJUaW1lb3V0KCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdzY3JlZW5jYXN0TW9kZS5tb3VzZUluZGljYXRvckNvbG9yJykpIHtcblx0XHRcdFx0dXBkYXRlTW91c2VJbmRpY2F0b3JDb2xvcigpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignc2NyZWVuY2FzdE1vZGUubW91c2VJbmRpY2F0b3JTaXplJykpIHtcblx0XHRcdFx0dXBkYXRlTW91c2VJbmRpY2F0b3JTaXplKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3Qgb25LZXlEb3duID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBFbWl0dGVyPEtleWJvYXJkRXZlbnQ+KCkpO1xuXHRcdGNvbnN0IG9uQ29tcG9zaXRpb25TdGFydCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRW1pdHRlcjxDb21wb3NpdGlvbkV2ZW50PigpKTtcblx0XHRjb25zdCBvbkNvbXBvc2l0aW9uVXBkYXRlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBFbWl0dGVyPENvbXBvc2l0aW9uRXZlbnQ+KCkpO1xuXHRcdGNvbnN0IG9uQ29tcG9zaXRpb25FbmQgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEVtaXR0ZXI8Q29tcG9zaXRpb25FdmVudD4oKSk7XG5cblx0XHRmdW5jdGlvbiByZWdpc3RlcldpbmRvd0xpc3RlbmVycyh3aW5kb3c6IFdpbmRvdywgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IHZvaWQge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGRpc3Bvc2FibGVzLmFkZChuZXcgRG9tRW1pdHRlcih3aW5kb3csICdrZXlkb3duJywgdHJ1ZSkpLmV2ZW50KGUgPT4gb25LZXlEb3duLmZpcmUoZSkpKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChkaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIod2luZG93LCAnY29tcG9zaXRpb25zdGFydCcsIHRydWUpKS5ldmVudChlID0+IG9uQ29tcG9zaXRpb25TdGFydC5maXJlKGUpKSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKHdpbmRvdywgJ2NvbXBvc2l0aW9udXBkYXRlJywgdHJ1ZSkpLmV2ZW50KGUgPT4gb25Db21wb3NpdGlvblVwZGF0ZS5maXJlKGUpKSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKHdpbmRvdywgJ2NvbXBvc2l0aW9uZW5kJywgdHJ1ZSkpLmV2ZW50KGUgPT4gb25Db21wb3NpdGlvbkVuZC5maXJlKGUpKSk7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCB7IHdpbmRvdywgZGlzcG9zYWJsZXMgfSBvZiBnZXRXaW5kb3dzKCkpIHtcblx0XHRcdHJlZ2lzdGVyV2luZG93TGlzdGVuZXJzKHdpbmRvdywgZGlzcG9zYWJsZXMpO1xuXHRcdH1cblxuXHRcdGRpc3Bvc2FibGVzLmFkZChvbkRpZFJlZ2lzdGVyV2luZG93KCh7IHdpbmRvdywgZGlzcG9zYWJsZXMgfSkgPT4gcmVnaXN0ZXJXaW5kb3dMaXN0ZW5lcnMod2luZG93LCBkaXNwb3NhYmxlcykpKTtcblxuXHRcdGxldCBsZW5ndGggPSAwO1xuXHRcdGxldCBjb21wb3Npbmc6IEVsZW1lbnQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0bGV0IGltZUJhY2tTcGFjZSA9IGZhbHNlO1xuXG5cdFx0Y29uc3QgY2xlYXJLZXlib2FyZFNjaGVkdWxlciA9IG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHtcblx0XHRcdGtleWJvYXJkTWFya2VyLnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHRjb21wb3NpbmcgPSB1bmRlZmluZWQ7XG5cdFx0XHRsZW5ndGggPSAwO1xuXHRcdH0sIGtleWJvYXJkTWFya2VyVGltZW91dCk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQob25Db21wb3NpdGlvblN0YXJ0LmV2ZW50KGUgPT4ge1xuXHRcdFx0aW1lQmFja1NwYWNlID0gdHJ1ZTtcblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQob25Db21wb3NpdGlvblVwZGF0ZS5ldmVudChlID0+IHtcblx0XHRcdGlmIChlLmRhdGEgJiYgaW1lQmFja1NwYWNlKSB7XG5cdFx0XHRcdGlmIChsZW5ndGggPiAyMCkge1xuXHRcdFx0XHRcdGtleWJvYXJkTWFya2VyLmlubmVyVGV4dCA9ICcnO1xuXHRcdFx0XHRcdGxlbmd0aCA9IDA7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29tcG9zaW5nID0gY29tcG9zaW5nID8/IGFwcGVuZChrZXlib2FyZE1hcmtlciwgJCgnc3Bhbi5rZXknKSk7XG5cdFx0XHRcdGNvbXBvc2luZy50ZXh0Q29udGVudCA9IGUuZGF0YTtcblx0XHRcdH0gZWxzZSBpZiAoaW1lQmFja1NwYWNlKSB7XG5cdFx0XHRcdGtleWJvYXJkTWFya2VyLmlubmVyVGV4dCA9ICcnO1xuXHRcdFx0XHRhcHBlbmQoa2V5Ym9hcmRNYXJrZXIsICQoJ3NwYW4ua2V5Jywge30sIGBCYWNrc3BhY2VgKSk7XG5cdFx0XHR9XG5cdFx0XHRjbGVhcktleWJvYXJkU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG9uQ29tcG9zaXRpb25FbmQuZXZlbnQoZSA9PiB7XG5cdFx0XHRjb21wb3NpbmcgPSB1bmRlZmluZWQ7XG5cdFx0XHRsZW5ndGgrKztcblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQob25LZXlEb3duLmV2ZW50KGUgPT4ge1xuXHRcdFx0aWYgKGUua2V5ID09PSAnUHJvY2VzcycgfHwgL1tcXHVhYzAwLVxcdWQ3ODdcXHUzMTMxLVxcdTMxNGVcXHUzMTRmLVxcdTMxNjNcXHUzMDQxLVxcdTMwOTRcXHUzMGExLVxcdTMwZjRcXHUzMGZjXFx1MzAwNVxcdTMwMDZcXHUzMDI0XFx1NGUwMC1cXHU5ZmE1XS91LnRlc3QoZS5rZXkpKSB7XG5cdFx0XHRcdGlmIChlLmNvZGUgPT09ICdCYWNrc3BhY2UnKSB7XG5cdFx0XHRcdFx0aW1lQmFja1NwYWNlID0gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIGlmICghZS5jb2RlLmluY2x1ZGVzKCdLZXknKSkge1xuXHRcdFx0XHRcdGNvbXBvc2luZyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRpbWVCYWNrU3BhY2UgPSBmYWxzZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpbWVCYWNrU3BhY2UgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNsZWFyS2V5Ym9hcmRTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZS5pc0NvbXBvc2luZykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG9wdGlvbnMgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJU2NyZWVuY2FzdEtleWJvYXJkT3B0aW9ucz4oJ3NjcmVlbmNhc3RNb2RlLmtleWJvYXJkT3B0aW9ucycpO1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0Y29uc3Qgc2hvcnRjdXQgPSBrZXliaW5kaW5nU2VydmljZS5zb2Z0RGlzcGF0Y2goZXZlbnQsIGV2ZW50LnRhcmdldCk7XG5cblx0XHRcdC8vIEhpZGUgdGhlIHNpbmdsZSBhcnJvdyBrZXkgcHJlc3NlZFxuXHRcdFx0aWYgKHNob3J0Y3V0LmtpbmQgPT09IFJlc3VsdEtpbmQuS2JGb3VuZCAmJiBzaG9ydGN1dC5jb21tYW5kSWQgJiYgIShvcHRpb25zLnNob3dTaW5nbGVFZGl0b3JDdXJzb3JNb3ZlcyA/PyB0cnVlKSAmJiAoXG5cdFx0XHRcdFsnY3Vyc29yTGVmdCcsICdjdXJzb3JSaWdodCcsICdjdXJzb3JVcCcsICdjdXJzb3JEb3duJ10uaW5jbHVkZXMoc2hvcnRjdXQuY29tbWFuZElkKSlcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChcblx0XHRcdFx0ZXZlbnQuY3RybEtleSB8fCBldmVudC5hbHRLZXkgfHwgZXZlbnQubWV0YUtleSB8fCBldmVudC5zaGlmdEtleVxuXHRcdFx0XHR8fCBsZW5ndGggPiAyMFxuXHRcdFx0XHR8fCBldmVudC5rZXlDb2RlID09PSBLZXlDb2RlLkJhY2tzcGFjZSB8fCBldmVudC5rZXlDb2RlID09PSBLZXlDb2RlLkVzY2FwZVxuXHRcdFx0XHR8fCBldmVudC5rZXlDb2RlID09PSBLZXlDb2RlLlVwQXJyb3cgfHwgZXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZS5Eb3duQXJyb3dcblx0XHRcdFx0fHwgZXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZS5MZWZ0QXJyb3cgfHwgZXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZS5SaWdodEFycm93XG5cdFx0XHQpIHtcblx0XHRcdFx0a2V5Ym9hcmRNYXJrZXIuaW5uZXJUZXh0ID0gJyc7XG5cdFx0XHRcdGxlbmd0aCA9IDA7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGtleWJpbmRpbmcgPSBrZXliaW5kaW5nU2VydmljZS5yZXNvbHZlS2V5Ym9hcmRFdmVudChldmVudCk7XG5cdFx0XHRjb25zdCBjb21tYW5kRGV0YWlscyA9ICh0aGlzLl9pc0tiRm91bmQoc2hvcnRjdXQpICYmIHNob3J0Y3V0LmNvbW1hbmRJZCkgPyB0aGlzLmdldENvbW1hbmREZXRhaWxzKHNob3J0Y3V0LmNvbW1hbmRJZCkgOiB1bmRlZmluZWQ7XG5cblx0XHRcdGxldCBjb21tYW5kQW5kR3JvdXBMYWJlbCA9IGNvbW1hbmREZXRhaWxzPy50aXRsZTtcblx0XHRcdGxldCBrZXlMYWJlbDogc3RyaW5nIHwgdW5kZWZpbmVkIHwgbnVsbCA9IGtleWJpbmRpbmcuZ2V0TGFiZWwoKTtcblxuXHRcdFx0aWYgKGNvbW1hbmREZXRhaWxzKSB7XG5cdFx0XHRcdGlmICgob3B0aW9ucy5zaG93Q29tbWFuZEdyb3VwcyA/PyBmYWxzZSkgJiYgY29tbWFuZERldGFpbHMuY2F0ZWdvcnkpIHtcblx0XHRcdFx0XHRjb21tYW5kQW5kR3JvdXBMYWJlbCA9IGAke2NvbW1hbmREZXRhaWxzLmNhdGVnb3J5fTogJHtjb21tYW5kQW5kR3JvdXBMYWJlbH0gYDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aGlzLl9pc0tiRm91bmQoc2hvcnRjdXQpICYmIHNob3J0Y3V0LmNvbW1hbmRJZCkge1xuXHRcdFx0XHRcdGNvbnN0IGtleWJpbmRpbmdzID0ga2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZ3Moc2hvcnRjdXQuY29tbWFuZElkKVxuXHRcdFx0XHRcdFx0LmZpbHRlcihrID0+IGsuZ2V0TGFiZWwoKT8uZW5kc1dpdGgoa2V5TGFiZWwgPz8gJycpKTtcblxuXHRcdFx0XHRcdGlmIChrZXliaW5kaW5ncy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHRrZXlMYWJlbCA9IGtleWJpbmRpbmdzW2tleWJpbmRpbmdzLmxlbmd0aCAtIDFdLmdldExhYmVsKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICgob3B0aW9ucy5zaG93Q29tbWFuZHMgPz8gdHJ1ZSkgJiYgY29tbWFuZEFuZEdyb3VwTGFiZWwpIHtcblx0XHRcdFx0YXBwZW5kKGtleWJvYXJkTWFya2VyLCAkKCdzcGFuLnRpdGxlJywge30sIGAke2NvbW1hbmRBbmRHcm91cExhYmVsfSBgKSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICgob3B0aW9ucy5zaG93S2V5cyA/PyB0cnVlKSB8fCAoKG9wdGlvbnMuc2hvd0tleWJpbmRpbmdzID8/IHRydWUpICYmIHRoaXMuX2lzS2JGb3VuZChzaG9ydGN1dCkpKSB7XG5cdFx0XHRcdC8vIEZpeCBsYWJlbCBmb3IgYXJyb3cga2V5c1xuXHRcdFx0XHRrZXlMYWJlbCA9IGtleUxhYmVsPy5yZXBsYWNlKCdVcEFycm93JywgJ1x1MjE5MScpXG5cdFx0XHRcdFx0Py5yZXBsYWNlKCdEb3duQXJyb3cnLCAnXHUyMTkzJylcblx0XHRcdFx0XHQ/LnJlcGxhY2UoJ0xlZnRBcnJvdycsICdcdTIxOTAnKVxuXHRcdFx0XHRcdD8ucmVwbGFjZSgnUmlnaHRBcnJvdycsICdcdTIxOTInKTtcblxuXHRcdFx0XHRhcHBlbmQoa2V5Ym9hcmRNYXJrZXIsICQoJ3NwYW4ua2V5Jywge30sIGtleUxhYmVsID8/ICcnKSk7XG5cdFx0XHR9XG5cblx0XHRcdGxlbmd0aCsrO1xuXHRcdFx0Y2xlYXJLZXlib2FyZFNjaGVkdWxlci5zY2hlZHVsZSgpO1xuXHRcdH0pKTtcblxuXHRcdFRvZ2dsZVNjcmVlbmNhc3RNb2RlQWN0aW9uLmRpc3Bvc2FibGUgPSBkaXNwb3NhYmxlcztcblx0fVxuXG5cdHByaXZhdGUgX2lzS2JGb3VuZChyZXNvbHV0aW9uUmVzdWx0OiBSZXNvbHV0aW9uUmVzdWx0KTogcmVzb2x1dGlvblJlc3VsdCBpcyB7IGtpbmQ6IFJlc3VsdEtpbmQuS2JGb3VuZDsgY29tbWFuZElkOiBzdHJpbmcgfCBudWxsOyBjb21tYW5kQXJnczogYW55OyBpc0J1YmJsZTogYm9vbGVhbiB9IHtcblx0XHRyZXR1cm4gcmVzb2x1dGlvblJlc3VsdC5raW5kID09PSBSZXN1bHRLaW5kLktiRm91bmQ7XG5cdH1cblxuXHRwcml2YXRlIGdldENvbW1hbmREZXRhaWxzKGNvbW1hbmRJZDogc3RyaW5nKTogeyB0aXRsZTogc3RyaW5nOyBjYXRlZ29yeT86IHN0cmluZyB9IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBmcm9tTWVudVJlZ2lzdHJ5ID0gTWVudVJlZ2lzdHJ5LmdldENvbW1hbmQoY29tbWFuZElkKTtcblxuXHRcdGlmIChmcm9tTWVudVJlZ2lzdHJ5KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0aXRsZTogdHlwZW9mIGZyb21NZW51UmVnaXN0cnkudGl0bGUgPT09ICdzdHJpbmcnID8gZnJvbU1lbnVSZWdpc3RyeS50aXRsZSA6IGZyb21NZW51UmVnaXN0cnkudGl0bGUudmFsdWUsXG5cdFx0XHRcdGNhdGVnb3J5OiBmcm9tTWVudVJlZ2lzdHJ5LmNhdGVnb3J5ID8gKHR5cGVvZiBmcm9tTWVudVJlZ2lzdHJ5LmNhdGVnb3J5ID09PSAnc3RyaW5nJyA/IGZyb21NZW51UmVnaXN0cnkuY2F0ZWdvcnkgOiBmcm9tTWVudVJlZ2lzdHJ5LmNhdGVnb3J5LnZhbHVlKSA6IHVuZGVmaW5lZFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRjb25zdCBmcm9tQ29tbWFuZHNSZWdpc3RyeSA9IENvbW1hbmRzUmVnaXN0cnkuZ2V0Q29tbWFuZChjb21tYW5kSWQpO1xuXG5cdFx0aWYgKGZyb21Db21tYW5kc1JlZ2lzdHJ5ICYmIGZyb21Db21tYW5kc1JlZ2lzdHJ5Lm1ldGFkYXRhPy5kZXNjcmlwdGlvbikge1xuXHRcdFx0cmV0dXJuIHsgdGl0bGU6IHR5cGVvZiBmcm9tQ29tbWFuZHNSZWdpc3RyeS5tZXRhZGF0YS5kZXNjcmlwdGlvbiA9PT0gJ3N0cmluZycgPyBmcm9tQ29tbWFuZHNSZWdpc3RyeS5tZXRhZGF0YS5kZXNjcmlwdGlvbiA6IGZyb21Db21tYW5kc1JlZ2lzdHJ5Lm1ldGFkYXRhLmRlc2NyaXB0aW9uLnZhbHVlIH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5jbGFzcyBMb2dTdG9yYWdlQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmxvZ1N0b3JhZ2UnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMih7IGtleTogJ2xvZ1N0b3JhZ2UnLCBjb21tZW50OiBbJ0EgZGV2ZWxvcGVyIG9ubHkgYWN0aW9uIHRvIGxvZyB0aGUgY29udGVudHMgb2YgdGhlIHN0b3JhZ2UgZm9yIHRoZSBjdXJyZW50IHdpbmRvdy4nXSB9LCBcIkxvZyBTdG9yYWdlIERhdGFiYXNlIENvbnRlbnRzXCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRGV2ZWxvcGVyLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IHN0b3JhZ2VTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElTdG9yYWdlU2VydmljZSk7XG5cdFx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSk7XG5cblx0XHRzdG9yYWdlU2VydmljZS5sb2coKTtcblxuXHRcdGRpYWxvZ1NlcnZpY2UuaW5mbyhsb2NhbGl6ZSgnc3RvcmFnZUxvZ0RpYWxvZ01lc3NhZ2UnLCBcIlRoZSBzdG9yYWdlIGRhdGFiYXNlIGNvbnRlbnRzIGhhdmUgYmVlbiBsb2dnZWQgdG8gdGhlIGRldmVsb3BlciB0b29scy5cIiksIGxvY2FsaXplKCdzdG9yYWdlTG9nRGlhbG9nRGV0YWlscycsIFwiT3BlbiBkZXZlbG9wZXIgdG9vbHMgZnJvbSB0aGUgbWVudSBhbmQgc2VsZWN0IHRoZSBDb25zb2xlIHRhYi5cIikpO1xuXHR9XG59XG5cbmNsYXNzIExvZ1dvcmtpbmdDb3BpZXNBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubG9nV29ya2luZ0NvcGllcycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKHsga2V5OiAnbG9nV29ya2luZ0NvcGllcycsIGNvbW1lbnQ6IFsnQSBkZXZlbG9wZXIgb25seSBhY3Rpb24gdG8gbG9nIHRoZSB3b3JraW5nIGNvcGllcyB0aGF0IGV4aXN0LiddIH0sIFwiTG9nIFdvcmtpbmcgQ29waWVzXCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRGV2ZWxvcGVyLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHdvcmtpbmdDb3B5U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2luZ0NvcHlTZXJ2aWNlKTtcblx0XHRjb25zdCB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSk7XG5cdFx0Y29uc3QgbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJTG9nU2VydmljZSk7XG5cdFx0Y29uc3Qgb3V0cHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJT3V0cHV0U2VydmljZSk7XG5cblx0XHRjb25zdCBiYWNrdXBzID0gYXdhaXQgd29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLmdldEJhY2t1cHMoKTtcblxuXHRcdGNvbnN0IG1zZyA9IFtcblx0XHRcdGBgLFxuXHRcdFx0YFtXb3JraW5nIENvcGllc11gLFxuXHRcdFx0Li4uKHdvcmtpbmdDb3B5U2VydmljZS53b3JraW5nQ29waWVzLmxlbmd0aCA+IDApID9cblx0XHRcdFx0d29ya2luZ0NvcHlTZXJ2aWNlLndvcmtpbmdDb3BpZXMubWFwKHdvcmtpbmdDb3B5ID0+IGAke3dvcmtpbmdDb3B5LmlzRGlydHkoKSA/ICdcdTI1Q0YgJyA6ICcnfSR7d29ya2luZ0NvcHkucmVzb3VyY2UudG9TdHJpbmcodHJ1ZSl9ICh0eXBlSWQ6ICR7d29ya2luZ0NvcHkudHlwZUlkIHx8ICc8bm8gdHlwZUlkPid9KWApIDpcblx0XHRcdFx0Wyc8bm9uZT4nXSxcblx0XHRcdGBgLFxuXHRcdFx0YFtCYWNrdXBzXWAsXG5cdFx0XHQuLi4oYmFja3Vwcy5sZW5ndGggPiAwKSA/XG5cdFx0XHRcdGJhY2t1cHMubWFwKGJhY2t1cCA9PiBgJHtiYWNrdXAucmVzb3VyY2UudG9TdHJpbmcodHJ1ZSl9ICh0eXBlSWQ6ICR7YmFja3VwLnR5cGVJZCB8fCAnPG5vIHR5cGVJZD4nfSlgKSA6XG5cdFx0XHRcdFsnPG5vbmU+J10sXG5cdFx0XTtcblxuXHRcdGxvZ1NlcnZpY2UuaW5mbyhtc2cuam9pbignXFxuJykpO1xuXG5cdFx0b3V0cHV0U2VydmljZS5zaG93Q2hhbm5lbCh3aW5kb3dMb2dJZCwgdHJ1ZSk7XG5cdH1cbn1cblxuY2xhc3MgUmVtb3ZlTGFyZ2VTdG9yYWdlRW50cmllc0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHByaXZhdGUgc3RhdGljIFNJWkVfVEhSRVNIT0xEID0gMTAyNCAqIDE2OyAvLyAxNmtiXG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnJlbW92ZUxhcmdlU3RvcmFnZURhdGFiYXNlRW50cmllcycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdyZW1vdmVMYXJnZVN0b3JhZ2VEYXRhYmFzZUVudHJpZXMnLCAnUmVtb3ZlIExhcmdlIFN0b3JhZ2UgRGF0YWJhc2UgRW50cmllcy4uLicpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRGV2ZWxvcGVyLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHN0b3JhZ2VTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElTdG9yYWdlU2VydmljZSk7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRjb25zdCB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlKTtcblx0XHRjb25zdCBkaWFsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEaWFsb2dTZXJ2aWNlKTtcblx0XHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVudmlyb25tZW50U2VydmljZSk7XG5cblx0XHRpbnRlcmZhY2UgSVN0b3JhZ2VJdGVtIGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0ge1xuXHRcdFx0cmVhZG9ubHkga2V5OiBzdHJpbmc7XG5cdFx0XHRyZWFkb25seSBzY29wZTogU3RvcmFnZVNjb3BlO1xuXHRcdFx0cmVhZG9ubHkgdGFyZ2V0OiBTdG9yYWdlVGFyZ2V0O1xuXHRcdFx0cmVhZG9ubHkgc2l6ZTogbnVtYmVyO1xuXHRcdH1cblxuXHRcdGNvbnN0IGl0ZW1zOiBJU3RvcmFnZUl0ZW1bXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBzY29wZSBvZiBbU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRV0pIHtcblx0XHRcdGlmIChzY29wZSA9PT0gU3RvcmFnZVNjb3BlLlBST0ZJTEUgJiYgdXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5pc0RlZmF1bHQpIHtcblx0XHRcdFx0Y29udGludWU7IC8vIGF2b2lkIGR1cGxpY2F0ZXNcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCB0YXJnZXQgb2YgW1N0b3JhZ2VUYXJnZXQuTUFDSElORSwgU3RvcmFnZVRhcmdldC5VU0VSXSkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGtleSBvZiBzdG9yYWdlU2VydmljZS5rZXlzKHNjb3BlLCB0YXJnZXQpKSB7XG5cdFx0XHRcdFx0Y29uc3QgdmFsdWUgPSBzdG9yYWdlU2VydmljZS5nZXQoa2V5LCBzY29wZSk7XG5cdFx0XHRcdFx0aWYgKHZhbHVlICYmICghZW52aXJvbm1lbnRTZXJ2aWNlLmlzQnVpbHQgLyogc2hvdyBhbGwga2V5cyBpbiBkZXYgKi8gfHwgdmFsdWUubGVuZ3RoID4gUmVtb3ZlTGFyZ2VTdG9yYWdlRW50cmllc0FjdGlvbi5TSVpFX1RIUkVTSE9MRCkpIHtcblx0XHRcdFx0XHRcdGl0ZW1zLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRrZXksXG5cdFx0XHRcdFx0XHRcdHNjb3BlLFxuXHRcdFx0XHRcdFx0XHR0YXJnZXQsXG5cdFx0XHRcdFx0XHRcdHNpemU6IHZhbHVlLmxlbmd0aCxcblx0XHRcdFx0XHRcdFx0bGFiZWw6IGtleSxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IEJ5dGVTaXplLmZvcm1hdFNpemUodmFsdWUubGVuZ3RoKSxcblx0XHRcdFx0XHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgnbGFyZ2VTdG9yYWdlSXRlbURldGFpbCcsIFwiU2NvcGU6IHswfSwgVGFyZ2V0OiB7MX1cIiwgc2NvcGUgPT09IFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiA/IGxvY2FsaXplKCdnbG9iYWwnLCBcIkdsb2JhbFwiKSA6IHNjb3BlID09PSBTdG9yYWdlU2NvcGUuUFJPRklMRSA/IGxvY2FsaXplKCdwcm9maWxlJywgXCJQcm9maWxlXCIpIDogbG9jYWxpemUoJ3dvcmtzcGFjZScsIFwiV29ya3NwYWNlXCIpLCB0YXJnZXQgPT09IFN0b3JhZ2VUYXJnZXQuTUFDSElORSA/IGxvY2FsaXplKCdtYWNoaW5lJywgXCJNYWNoaW5lXCIpIDogbG9jYWxpemUoJ3VzZXInLCBcIlVzZXJcIikpLFxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aXRlbXMuc29ydCgoaXRlbUEsIGl0ZW1CKSA9PiBpdGVtQi5zaXplIC0gaXRlbUEuc2l6ZSk7XG5cblx0XHRjb25zdCBzZWxlY3RlZEl0ZW1zID0gYXdhaXQgbmV3IFByb21pc2U8cmVhZG9ubHkgSVN0b3JhZ2VJdGVtW10+KHJlc29sdmUgPT4ge1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRcdGNvbnN0IHBpY2tlciA9IGRpc3Bvc2FibGVzLmFkZChxdWlja0lucHV0U2VydmljZS5jcmVhdGVRdWlja1BpY2s8SVN0b3JhZ2VJdGVtPigpKTtcblx0XHRcdHBpY2tlci5pdGVtcyA9IGl0ZW1zO1xuXHRcdFx0cGlja2VyLmNhblNlbGVjdE1hbnkgPSB0cnVlO1xuXHRcdFx0cGlja2VyLm9rID0gZmFsc2U7XG5cdFx0XHRwaWNrZXIuY3VzdG9tQnV0dG9uID0gdHJ1ZTtcblx0XHRcdHBpY2tlci5oaWRlQ2hlY2tBbGwgPSB0cnVlO1xuXHRcdFx0cGlja2VyLmN1c3RvbUxhYmVsID0gbG9jYWxpemUoJ3JlbW92ZUxhcmdlU3RvcmFnZUVudHJpZXNQaWNrZXJCdXR0b24nLCBcIlJlbW92ZVwiKTtcblx0XHRcdHBpY2tlci5wbGFjZWhvbGRlciA9IGxvY2FsaXplKCdyZW1vdmVMYXJnZVN0b3JhZ2VFbnRyaWVzUGlja2VyUGxhY2Vob2xkZXInLCBcIlNlbGVjdCBsYXJnZSBlbnRyaWVzIHRvIHJlbW92ZSBmcm9tIHN0b3JhZ2VcIik7XG5cblx0XHRcdGlmIChpdGVtcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0cGlja2VyLmRlc2NyaXB0aW9uID0gbG9jYWxpemUoJ3JlbW92ZUxhcmdlU3RvcmFnZUVudHJpZXNQaWNrZXJEZXNjcmlwdGlvbk5vRW50cmllcycsIFwiVGhlcmUgYXJlIG5vIGxhcmdlIHN0b3JhZ2UgZW50cmllcyB0byByZW1vdmUuXCIpO1xuXHRcdFx0fVxuXG5cdFx0XHRwaWNrZXIuc2hvdygpO1xuXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocGlja2VyLm9uRGlkQ3VzdG9tKCgpID0+IHtcblx0XHRcdFx0cmVzb2x2ZShwaWNrZXIuc2VsZWN0ZWRJdGVtcyk7XG5cdFx0XHRcdHBpY2tlci5oaWRlKCk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZChwaWNrZXIub25EaWRIaWRlKCgpID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKSkpO1xuXHRcdH0pO1xuXG5cdFx0aWYgKHNlbGVjdGVkSXRlbXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBjb25maXJtZWQgfSA9IGF3YWl0IGRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHR0eXBlOiAnd2FybmluZycsXG5cdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgncmVtb3ZlTGFyZ2VTdG9yYWdlRW50cmllc0NvbmZpcm1SZW1vdmUnLCBcIkRvIHlvdSB3YW50IHRvIHJlbW92ZSB0aGUgc2VsZWN0ZWQgc3RvcmFnZSBlbnRyaWVzIGZyb20gdGhlIGRhdGFiYXNlP1wiKSxcblx0XHRcdGRldGFpbDogbG9jYWxpemUoJ3JlbW92ZUxhcmdlU3RvcmFnZUVudHJpZXNDb25maXJtUmVtb3ZlRGV0YWlsJywgXCJ7MH1cXG5cXG5UaGlzIGFjdGlvbiBpcyBpcnJldmVyc2libGUgYW5kIG1heSByZXN1bHQgaW4gZGF0YSBsb3NzIVwiLCBzZWxlY3RlZEl0ZW1zLm1hcChpdGVtID0+IGl0ZW0ubGFiZWwpLmpvaW4oJ1xcbicpKSxcblx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAncmVtb3ZlTGFyZ2VTdG9yYWdlRW50cmllc0J1dHRvbkxhYmVsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUmVtb3ZlXCIpXG5cdFx0fSk7XG5cblx0XHRpZiAoIWNvbmZpcm1lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNjb3Blc1RvT3B0aW1pemUgPSBuZXcgU2V0PFN0b3JhZ2VTY29wZT4oKTtcblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2Ygc2VsZWN0ZWRJdGVtcykge1xuXHRcdFx0c3RvcmFnZVNlcnZpY2UucmVtb3ZlKGl0ZW0ua2V5LCBpdGVtLnNjb3BlKTtcblx0XHRcdHNjb3Blc1RvT3B0aW1pemUuYWRkKGl0ZW0uc2NvcGUpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3Qgc2NvcGUgb2Ygc2NvcGVzVG9PcHRpbWl6ZSkge1xuXHRcdFx0YXdhaXQgc3RvcmFnZVNlcnZpY2Uub3B0aW1pemUoc2NvcGUpO1xuXHRcdH1cblx0fVxufVxuXG5sZXQgdHJhY2tlcjogRGlzcG9zYWJsZVRyYWNrZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5sZXQgdHJhY2tlZERpc3Bvc2FibGVzID0gbmV3IFNldDxJRGlzcG9zYWJsZT4oKTtcblxuY29uc3QgRGlzcG9zYWJsZXNTbmFwc2hvdFN0YXRlQ29udGV4dCA9IG5ldyBSYXdDb250ZXh0S2V5PCdzdGFydGVkJyB8ICdwZW5kaW5nJyB8ICdzdG9wcGVkJz4oJ2RpcnR5V29ya2luZ0NvcGllcycsICdzdG9wcGVkJyk7XG5cbmNsYXNzIFN0YXJ0VHJhY2tEaXNwb3NhYmxlcyBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5zdGFydFRyYWNrRGlzcG9zYWJsZXMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc3RhcnRUcmFja0Rpc3Bvc2FibGVzJywgJ1N0YXJ0IFRyYWNraW5nIERpc3Bvc2FibGVzJyksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKERpc3Bvc2FibGVzU25hcHNob3RTdGF0ZUNvbnRleHQuaXNFcXVhbFRvKCdwZW5kaW5nJykubmVnYXRlKCksIERpc3Bvc2FibGVzU25hcHNob3RTdGF0ZUNvbnRleHQuaXNFcXVhbFRvKCdzdGFydGVkJykubmVnYXRlKCkpXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlc1NuYXBzaG90U3RhdGVDb250ZXh0ID0gRGlzcG9zYWJsZXNTbmFwc2hvdFN0YXRlQ29udGV4dC5iaW5kVG8oYWNjZXNzb3IuZ2V0KElDb250ZXh0S2V5U2VydmljZSkpO1xuXHRcdGRpc3Bvc2FibGVzU25hcHNob3RTdGF0ZUNvbnRleHQuc2V0KCdzdGFydGVkJyk7XG5cblx0XHR0cmFja2VkRGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdHRyYWNrZXIgPSBuZXcgRGlzcG9zYWJsZVRyYWNrZXIoKTtcblx0XHRzZXREaXNwb3NhYmxlVHJhY2tlcih0cmFja2VyKTtcblx0fVxufVxuXG5jbGFzcyBTbmFwc2hvdFRyYWNrZWREaXNwb3NhYmxlcyBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5zbmFwc2hvdFRyYWNrZWREaXNwb3NhYmxlcycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzbmFwc2hvdFRyYWNrZWREaXNwb3NhYmxlcycsICdTbmFwc2hvdCBUcmFja2VkIERpc3Bvc2FibGVzJyksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogRGlzcG9zYWJsZXNTbmFwc2hvdFN0YXRlQ29udGV4dC5pc0VxdWFsVG8oJ3N0YXJ0ZWQnKVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXNTbmFwc2hvdFN0YXRlQ29udGV4dCA9IERpc3Bvc2FibGVzU25hcHNob3RTdGF0ZUNvbnRleHQuYmluZFRvKGFjY2Vzc29yLmdldChJQ29udGV4dEtleVNlcnZpY2UpKTtcblx0XHRkaXNwb3NhYmxlc1NuYXBzaG90U3RhdGVDb250ZXh0LnNldCgncGVuZGluZycpO1xuXG5cdFx0dHJhY2tlZERpc3Bvc2FibGVzID0gbmV3IFNldCh0cmFja2VyPy5jb21wdXRlTGVha2luZ0Rpc3Bvc2FibGVzKDEwMDApPy5sZWFrcy5tYXAoZGlzcG9zYWJsZSA9PiBkaXNwb3NhYmxlLnZhbHVlKSk7XG5cdH1cbn1cblxuY2xhc3MgU3RvcFRyYWNrRGlzcG9zYWJsZXMgZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uc3RvcFRyYWNrRGlzcG9zYWJsZXMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc3RvcFRyYWNrRGlzcG9zYWJsZXMnLCAnU3RvcCBUcmFja2luZyBEaXNwb3NhYmxlcycpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRGV2ZWxvcGVyLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IERpc3Bvc2FibGVzU25hcHNob3RTdGF0ZUNvbnRleHQuaXNFcXVhbFRvKCdwZW5kaW5nJylcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXNTbmFwc2hvdFN0YXRlQ29udGV4dCA9IERpc3Bvc2FibGVzU25hcHNob3RTdGF0ZUNvbnRleHQuYmluZFRvKGFjY2Vzc29yLmdldChJQ29udGV4dEtleVNlcnZpY2UpKTtcblx0XHRkaXNwb3NhYmxlc1NuYXBzaG90U3RhdGVDb250ZXh0LnNldCgnc3RvcHBlZCcpO1xuXG5cdFx0aWYgKHRyYWNrZXIpIHtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVMZWFrcyA9IG5ldyBTZXQ8RGlzcG9zYWJsZUluZm8+KCk7XG5cblx0XHRcdGZvciAoY29uc3QgZGlzcG9zYWJsZSBvZiBuZXcgU2V0KHRyYWNrZXIuY29tcHV0ZUxlYWtpbmdEaXNwb3NhYmxlcygxMDAwKT8ubGVha3MpID8/IFtdKSB7XG5cdFx0XHRcdGlmICh0cmFja2VkRGlzcG9zYWJsZXMuaGFzKGRpc3Bvc2FibGUudmFsdWUpKSB7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZUxlYWtzLmFkZChkaXNwb3NhYmxlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBsZWFrcyA9IHRyYWNrZXIuY29tcHV0ZUxlYWtpbmdEaXNwb3NhYmxlcygxMDAwLCBBcnJheS5mcm9tKGRpc3Bvc2FibGVMZWFrcykpO1xuXHRcdFx0aWYgKGxlYWtzKSB7XG5cdFx0XHRcdGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlOiB1bmRlZmluZWQsIGNvbnRlbnRzOiBsZWFrcy5kZXRhaWxzIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHNldERpc3Bvc2FibGVUcmFja2VyKG51bGwpO1xuXHRcdHRyYWNrZXIgPSB1bmRlZmluZWQ7XG5cdFx0dHJhY2tlZERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH1cbn1cblxuLy8gLS0tIEFjdGlvbnMgUmVnaXN0cmF0aW9uXG5yZWdpc3RlckFjdGlvbjIoSW5zcGVjdENvbnRleHRLZXlzQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihUb2dnbGVTY3JlZW5jYXN0TW9kZUFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoTG9nU3RvcmFnZUFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoTG9nV29ya2luZ0NvcGllc0FjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoUmVtb3ZlTGFyZ2VTdG9yYWdlRW50cmllc0FjdGlvbik7XG5pZiAoIXByb2R1Y3QuY29tbWl0KSB7XG5cdHJlZ2lzdGVyQWN0aW9uMihTdGFydFRyYWNrRGlzcG9zYWJsZXMpO1xuXHRyZWdpc3RlckFjdGlvbjIoU25hcHNob3RUcmFja2VkRGlzcG9zYWJsZXMpO1xuXHRyZWdpc3RlckFjdGlvbjIoU3RvcFRyYWNrRGlzcG9zYWJsZXMpO1xufVxuXG4vLyAtLS0gQ29uZmlndXJhdGlvblxuXG4vLyBTY3JlZW4gQ2FzdCBNb2RlXG5jb25zdCBjb25maWd1cmF0aW9uUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihDb25maWd1cmF0aW9uRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKTtcbmNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRpZDogJ3NjcmVlbmNhc3RNb2RlJyxcblx0b3JkZXI6IDksXG5cdHRpdGxlOiBsb2NhbGl6ZSgnc2NyZWVuY2FzdE1vZGVDb25maWd1cmF0aW9uVGl0bGUnLCBcIlNjcmVlbmNhc3QgTW9kZVwiKSxcblx0dHlwZTogJ29iamVjdCcsXG5cdHByb3BlcnRpZXM6IHtcblx0XHQnc2NyZWVuY2FzdE1vZGUudmVydGljYWxPZmZzZXQnOiB7XG5cdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdGRlZmF1bHQ6IDIwLFxuXHRcdFx0bWluaW11bTogMCxcblx0XHRcdG1heGltdW06IDkwLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdzY3JlZW5jYXN0TW9kZS5sb2NhdGlvbi52ZXJ0aWNhbFBvc2l0aW9uJywgXCJDb250cm9scyB0aGUgdmVydGljYWwgb2Zmc2V0IG9mIHRoZSBzY3JlZW5jYXN0IG1vZGUgb3ZlcmxheSBmcm9tIHRoZSBib3R0b20gYXMgYSBwZXJjZW50YWdlIG9mIHRoZSB3b3JrYmVuY2ggaGVpZ2h0LlwiKVxuXHRcdH0sXG5cdFx0J3NjcmVlbmNhc3RNb2RlLmZvbnRTaXplJzoge1xuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRkZWZhdWx0OiA1Nixcblx0XHRcdG1pbmltdW06IDIwLFxuXHRcdFx0bWF4aW11bTogMTAwLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdzY3JlZW5jYXN0TW9kZS5mb250U2l6ZScsIFwiQ29udHJvbHMgdGhlIGZvbnQgc2l6ZSAoaW4gcGl4ZWxzKSBvZiB0aGUgc2NyZWVuY2FzdCBtb2RlIGtleWJvYXJkLlwiKVxuXHRcdH0sXG5cdFx0J3NjcmVlbmNhc3RNb2RlLmtleWJvYXJkT3B0aW9ucyc6IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdzY3JlZW5jYXN0TW9kZS5rZXlib2FyZE9wdGlvbnMuZGVzY3JpcHRpb24nLCBcIk9wdGlvbnMgZm9yIGN1c3RvbWl6aW5nIHRoZSBrZXlib2FyZCBvdmVybGF5IGluIHNjcmVlbmNhc3QgbW9kZS5cIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdCdzaG93S2V5cyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3NjcmVlbmNhc3RNb2RlLmtleWJvYXJkT3B0aW9ucy5zaG93S2V5cycsIFwiU2hvdyByYXcga2V5cy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J3Nob3dLZXliaW5kaW5ncyc6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3NjcmVlbmNhc3RNb2RlLmtleWJvYXJkT3B0aW9ucy5zaG93S2V5YmluZGluZ3MnLCBcIlNob3cga2V5Ym9hcmQgc2hvcnRjdXRzLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnc2hvd0NvbW1hbmRzJzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc2NyZWVuY2FzdE1vZGUua2V5Ym9hcmRPcHRpb25zLnNob3dDb21tYW5kcycsIFwiU2hvdyBjb21tYW5kIG5hbWVzLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnc2hvd0NvbW1hbmRHcm91cHMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc2NyZWVuY2FzdE1vZGUua2V5Ym9hcmRPcHRpb25zLnNob3dDb21tYW5kR3JvdXBzJywgXCJTaG93IGNvbW1hbmQgZ3JvdXAgbmFtZXMsIHdoZW4gY29tbWFuZHMgYXJlIGFsc28gc2hvd24uXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdzaG93U2luZ2xlRWRpdG9yQ3Vyc29yTW92ZXMnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdzY3JlZW5jYXN0TW9kZS5rZXlib2FyZE9wdGlvbnMuc2hvd1NpbmdsZUVkaXRvckN1cnNvck1vdmVzJywgXCJTaG93IHNpbmdsZSBlZGl0b3IgY3Vyc29yIG1vdmUgY29tbWFuZHMuXCIpXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdCdzaG93S2V5cyc6IHRydWUsXG5cdFx0XHRcdCdzaG93S2V5YmluZGluZ3MnOiB0cnVlLFxuXHRcdFx0XHQnc2hvd0NvbW1hbmRzJzogdHJ1ZSxcblx0XHRcdFx0J3Nob3dDb21tYW5kR3JvdXBzJzogZmFsc2UsXG5cdFx0XHRcdCdzaG93U2luZ2xlRWRpdG9yQ3Vyc29yTW92ZXMnOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlXG5cdFx0fSxcblx0XHQnc2NyZWVuY2FzdE1vZGUua2V5Ym9hcmRPdmVybGF5VGltZW91dCc6IHtcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0ZGVmYXVsdDogODAwLFxuXHRcdFx0bWluaW11bTogNTAwLFxuXHRcdFx0bWF4aW11bTogNTAwMCxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc2NyZWVuY2FzdE1vZGUua2V5Ym9hcmRPdmVybGF5VGltZW91dCcsIFwiQ29udHJvbHMgaG93IGxvbmcgKGluIG1pbGxpc2Vjb25kcykgdGhlIGtleWJvYXJkIG92ZXJsYXkgaXMgc2hvd24gaW4gc2NyZWVuY2FzdCBtb2RlLlwiKVxuXHRcdH0sXG5cdFx0J3NjcmVlbmNhc3RNb2RlLm1vdXNlSW5kaWNhdG9yQ29sb3InOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGZvcm1hdDogJ2NvbG9yLWhleCcsXG5cdFx0XHRkZWZhdWx0OiAnI0ZGMDAwMCcsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3NjcmVlbmNhc3RNb2RlLm1vdXNlSW5kaWNhdG9yQ29sb3InLCBcIkNvbnRyb2xzIHRoZSBjb2xvciBpbiBoZXggKCNSR0IsICNSR0JBLCAjUlJHR0JCIG9yICNSUkdHQkJBQSkgb2YgdGhlIG1vdXNlIGluZGljYXRvciBpbiBzY3JlZW5jYXN0IG1vZGUuXCIpXG5cdFx0fSxcblx0XHQnc2NyZWVuY2FzdE1vZGUubW91c2VJbmRpY2F0b3JTaXplJzoge1xuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRkZWZhdWx0OiAyMCxcblx0XHRcdG1pbmltdW06IDIwLFxuXHRcdFx0bWF4aW11bTogMTAwLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdzY3JlZW5jYXN0TW9kZS5tb3VzZUluZGljYXRvclNpemUnLCBcIkNvbnRyb2xzIHRoZSBzaXplIChpbiBwaXhlbHMpIG9mIHRoZSBtb3VzZSBpbmRpY2F0b3IgaW4gc2NyZWVuY2FzdCBtb2RlLlwiKVxuXHRcdH0sXG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTztBQUVQLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQXNCLGNBQWMsU0FBUyxpQkFBaUIsc0JBQXNCLHlCQUF5QztBQUM3SCxTQUFTLHdCQUF3QixRQUFRLEdBQUcsbUJBQW1CLHFCQUFxQixrQkFBa0I7QUFDdEcsU0FBUyxlQUFlLHdCQUF3QjtBQUNoRCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdCQUFnQixvQkFBb0IscUJBQXFCO0FBRWxFLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUJBQWlCLFNBQVMsb0JBQW9CO0FBQ3ZELFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMsYUFBYTtBQUN0QixTQUFTLGVBQWU7QUFDeEIsU0FBaUMsY0FBYywrQkFB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QUFTLDJCQUEyQixxRUFBcUU7QUFBQSxJQUN2SDtBQUFBLElBQ0Esa0NBQWtDO0FBQUEsTUFDakMsTUFBTTtBQUFBLE1BQ04sYUFBYSxTQUFTLDhDQUE4QyxrRUFBa0U7QUFBQSxNQUN0SSxZQUFZO0FBQUEsUUFDWCxZQUFZO0FBQUEsVUFDWCxNQUFNO0FBQUEsVUFDTixTQUFTO0FBQUEsVUFDVCxhQUFhLFNBQVMsMkNBQTJDLGdCQUFnQjtBQUFBLFFBQ2xGO0FBQUEsUUFDQSxtQkFBbUI7QUFBQSxVQUNsQixNQUFNO0FBQUEsVUFDTixTQUFTO0FBQUEsVUFDVCxhQUFhLFNBQVMsa0RBQWtELDBCQUEwQjtBQUFBLFFBQ25HO0FBQUEsUUFDQSxnQkFBZ0I7QUFBQSxVQUNmLE1BQU07QUFBQSxVQUNOLFNBQVM7QUFBQSxVQUNULGFBQWEsU0FBUywrQ0FBK0MscUJBQXFCO0FBQUEsUUFDM0Y7QUFBQSxRQUNBLHFCQUFxQjtBQUFBLFVBQ3BCLE1BQU07QUFBQSxVQUNOLFNBQVM7QUFBQSxVQUNULGFBQWEsU0FBUyxvREFBb0QseURBQXlEO0FBQUEsUUFDcEk7QUFBQSxRQUNBLCtCQUErQjtBQUFBLFVBQzlCLE1BQU07QUFBQSxVQUNOLFNBQVM7QUFBQSxVQUNULGFBQWEsU0FBUyw4REFBOEQsMENBQTBDO0FBQUEsUUFDL0g7QUFBQSxNQUNEO0FBQUEsTUFDQSxTQUFTO0FBQUEsUUFDUixZQUFZO0FBQUEsUUFDWixtQkFBbUI7QUFBQSxRQUNuQixnQkFBZ0I7QUFBQSxRQUNoQixxQkFBcUI7QUFBQSxRQUNyQiwrQkFBK0I7QUFBQSxNQUNoQztBQUFBLE1BQ0Esc0JBQXNCO0FBQUEsSUFDdkI7QUFBQSxJQUNBLHlDQUF5QztBQUFBLE1BQ3hDLE1BQU07QUFBQSxNQUNOLFNBQVM7QUFBQSxNQUNULFNBQVM7QUFBQSxNQUNULFNBQVM7QUFBQSxNQUNULGFBQWEsU0FBUyx5Q0FBeUMsdUZBQXVGO0FBQUEsSUFDdko7QUFBQSxJQUNBLHNDQUFzQztBQUFBLE1BQ3JDLE1BQU07QUFBQSxNQUNOLFFBQVE7QUFBQSxNQUNSLFNBQVM7QUFBQSxNQUNULGFBQWEsU0FBUyxzQ0FBc0MsMEdBQTBHO0FBQUEsSUFDdks7QUFBQSxJQUNBLHFDQUFxQztBQUFBLE1BQ3BDLE1BQU07QUFBQSxNQUNOLFNBQVM7QUFBQSxNQUNULFNBQVM7QUFBQSxNQUNULFNBQVM7QUFBQSxNQUNULGFBQWEsU0FBUyxxQ0FBcUMsMEVBQTBFO0FBQUEsSUFDdEk7QUFBQSxFQUNEO0FBQ0QsQ0FBQzsiLAogICJuYW1lcyI6IFsiY29udGFpbmVyIiwgImRpc3Bvc2FibGVzIiwgImUiXQp9Cg==
