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
import * as nls from "../../../../nls.js";
import * as browser from "../../../../base/browser/browser.js";
import { BrowserFeatures, KeyboardSupport } from "../../../../base/browser/canIUse.js";
import * as dom from "../../../../base/browser/dom.js";
import { printKeyboardEvent, printStandardKeyboardEvent, StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { DeferredPromise, RunOnceScheduler } from "../../../../base/common/async.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { parse } from "../../../../base/common/json.js";
import { UserSettingsLabelProvider } from "../../../../base/common/keybindingLabels.js";
import { KeybindingParser } from "../../../../base/common/keybindingParser.js";
import { KeyCodeChord, ScanCodeChord } from "../../../../base/common/keybindings.js";
import { IMMUTABLE_CODE_TO_KEY_CODE, KeyCode, KeyCodeUtils, KeyMod, ScanCode, ScanCodeUtils } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import * as objects from "../../../../base/common/objects.js";
import { isMacintosh, OperatingSystem, OS } from "../../../../base/common/platform.js";
import { dirname } from "../../../../base/common/resources.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { FileOperation, IFileService } from "../../../../platform/files/common/files.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { Extensions } from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { AbstractKeybindingService } from "../../../../platform/keybinding/common/abstractKeybindingService.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingResolver } from "../../../../platform/keybinding/common/keybindingResolver.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ResolvedKeybindingItem } from "../../../../platform/keybinding/common/resolvedKeybindingItem.js";
import { IKeyboardLayoutService } from "../../../../platform/keyboardLayout/common/keyboardLayout.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { isLocalizedString } from "../../../../platform/action/common/action.js";
import { commandsExtensionPoint } from "../../actions/common/menusExtensionPoint.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { ExtensionsRegistry } from "../../extensions/common/extensionsRegistry.js";
import { IHostService } from "../../host/browser/host.js";
import { getAllUnboundCommands } from "./unboundCommands.js";
import { KeybindingIO, OutputBuilder } from "../common/keybindingIO.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
function isValidContributedKeyBinding(keyBinding, rejects) {
  if (!keyBinding) {
    rejects.push(nls.localize("nonempty", "expected non-empty value."));
    return false;
  }
  if (typeof keyBinding.command !== "string") {
    rejects.push(nls.localize("requirestring", "property `{0}` is mandatory and must be of type `string`", "command"));
    return false;
  }
  if (keyBinding.key && typeof keyBinding.key !== "string") {
    rejects.push(nls.localize("optstring", "property `{0}` can be omitted or must be of type `string`", "key"));
    return false;
  }
  if (keyBinding.when && typeof keyBinding.when !== "string") {
    rejects.push(nls.localize("optstring", "property `{0}` can be omitted or must be of type `string`", "when"));
    return false;
  }
  if (keyBinding.mac && typeof keyBinding.mac !== "string") {
    rejects.push(nls.localize("optstring", "property `{0}` can be omitted or must be of type `string`", "mac"));
    return false;
  }
  if (keyBinding.linux && typeof keyBinding.linux !== "string") {
    rejects.push(nls.localize("optstring", "property `{0}` can be omitted or must be of type `string`", "linux"));
    return false;
  }
  if (keyBinding.win && typeof keyBinding.win !== "string") {
    rejects.push(nls.localize("optstring", "property `{0}` can be omitted or must be of type `string`", "win"));
    return false;
  }
  return true;
}
const keybindingType = {
  type: "object",
  default: { command: "", key: "" },
  properties: {
    command: {
      description: nls.localize("vscode.extension.contributes.keybindings.command", "Identifier of the command to run when keybinding is triggered."),
      type: "string"
    },
    args: {
      description: nls.localize("vscode.extension.contributes.keybindings.args", "Arguments to pass to the command to execute.")
    },
    key: {
      description: nls.localize("vscode.extension.contributes.keybindings.key", "Key or key sequence (separate keys with plus-sign and sequences with space, e.g. Ctrl+O and Ctrl+L L for a chord)."),
      type: "string"
    },
    mac: {
      description: nls.localize("vscode.extension.contributes.keybindings.mac", "Mac specific key or key sequence."),
      type: "string"
    },
    linux: {
      description: nls.localize("vscode.extension.contributes.keybindings.linux", "Linux specific key or key sequence."),
      type: "string"
    },
    win: {
      description: nls.localize("vscode.extension.contributes.keybindings.win", "Windows specific key or key sequence."),
      type: "string"
    },
    when: {
      description: nls.localize("vscode.extension.contributes.keybindings.when", "Condition when the key is active."),
      type: "string"
    }
  }
};
const keybindingsExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "keybindings",
  deps: [commandsExtensionPoint],
  jsonSchema: {
    description: nls.localize("vscode.extension.contributes.keybindings", "Contributes keybindings."),
    oneOf: [
      keybindingType,
      {
        type: "array",
        items: keybindingType
      }
    ]
  }
});
const NUMPAD_PRINTABLE_SCANCODES = [
  ScanCode.NumpadDivide,
  ScanCode.NumpadMultiply,
  ScanCode.NumpadSubtract,
  ScanCode.NumpadAdd,
  ScanCode.Numpad1,
  ScanCode.Numpad2,
  ScanCode.Numpad3,
  ScanCode.Numpad4,
  ScanCode.Numpad5,
  ScanCode.Numpad6,
  ScanCode.Numpad7,
  ScanCode.Numpad8,
  ScanCode.Numpad9,
  ScanCode.Numpad0,
  ScanCode.NumpadDecimal
];
const otherMacNumpadMapping = /* @__PURE__ */ new Map();
otherMacNumpadMapping.set(ScanCode.Numpad1, KeyCode.Digit1);
otherMacNumpadMapping.set(ScanCode.Numpad2, KeyCode.Digit2);
otherMacNumpadMapping.set(ScanCode.Numpad3, KeyCode.Digit3);
otherMacNumpadMapping.set(ScanCode.Numpad4, KeyCode.Digit4);
otherMacNumpadMapping.set(ScanCode.Numpad5, KeyCode.Digit5);
otherMacNumpadMapping.set(ScanCode.Numpad6, KeyCode.Digit6);
otherMacNumpadMapping.set(ScanCode.Numpad7, KeyCode.Digit7);
otherMacNumpadMapping.set(ScanCode.Numpad8, KeyCode.Digit8);
otherMacNumpadMapping.set(ScanCode.Numpad9, KeyCode.Digit9);
otherMacNumpadMapping.set(ScanCode.Numpad0, KeyCode.Digit0);
let WorkbenchKeybindingService = class extends AbstractKeybindingService {
  constructor(contextKeyService, commandService, telemetryService, notificationService, userDataProfileService, hostService, extensionService, fileService, uriIdentityService, logService, keyboardLayoutService) {
    super(contextKeyService, commandService, telemetryService, notificationService, logService);
    this.hostService = hostService;
    this.keyboardLayoutService = keyboardLayoutService;
    this._contributions = [];
    this.isComposingGlobalContextKey = contextKeyService.createKey("isComposing", false);
    this.kbsJsonSchema = new KeybindingsJsonSchema();
    this.updateKeybindingsJsonSchema();
    this._keyboardMapper = this.keyboardLayoutService.getKeyboardMapper();
    this._register(this.keyboardLayoutService.onDidChangeKeyboardLayout(() => {
      this._keyboardMapper = this.keyboardLayoutService.getKeyboardMapper();
      this.updateResolver();
    }));
    this._keybindingHoldMode = null;
    this._cachedResolver = null;
    this.userKeybindings = this._register(new UserKeybindings(userDataProfileService, uriIdentityService, fileService, logService));
    this.userKeybindings.initialize().then(() => {
      if (this.userKeybindings.keybindings.length) {
        this.updateResolver();
      }
    });
    this._register(this.userKeybindings.onDidChange(() => {
      logService.debug("User keybindings changed");
      this.updateResolver();
    }));
    keybindingsExtPoint.setHandler((extensions) => {
      const keybindings = [];
      for (const extension of extensions) {
        this._handleKeybindingsExtensionPointUser(extension.description.identifier, extension.description.isBuiltin, extension.value, extension.collector, keybindings);
      }
      KeybindingsRegistry.setExtensionKeybindings(keybindings);
      this.updateResolver();
    });
    this.updateKeybindingsJsonSchema();
    this._register(extensionService.onDidRegisterExtensions(() => this.updateKeybindingsJsonSchema()));
    this._register(Event.runAndSubscribe(dom.onDidRegisterWindow, ({ window, disposables }) => disposables.add(this._registerKeyListeners(window)), { window: mainWindow, disposables: this._store }));
    this._register(browser.onDidChangeFullscreen((windowId) => {
      if (windowId !== mainWindow.vscodeWindowId) {
        return;
      }
      const keyboard = navigator.keyboard;
      if (BrowserFeatures.keyboard === KeyboardSupport.None) {
        return;
      }
      if (browser.isFullscreen(mainWindow)) {
        keyboard?.lock(["Escape"]);
      } else {
        keyboard?.unlock();
      }
      this._cachedResolver = null;
      this._onDidUpdateKeybindings.fire();
    }));
  }
  _registerKeyListeners(window) {
    const disposables = new DisposableStore();
    disposables.add(dom.addDisposableListener(window, dom.EventType.KEY_DOWN, (e) => {
      if (this._keybindingHoldMode) {
        return;
      }
      this.isComposingGlobalContextKey.set(e.isComposing);
      const keyEvent = new StandardKeyboardEvent(e);
      this._log(`/ Received  keydown event - ${printKeyboardEvent(e)}`);
      this._log(`| Converted keydown event - ${printStandardKeyboardEvent(keyEvent)}`);
      const shouldPreventDefault = this._dispatch(keyEvent, keyEvent.target);
      if (shouldPreventDefault) {
        keyEvent.preventDefault();
      }
      this.isComposingGlobalContextKey.set(false);
    }));
    disposables.add(dom.addDisposableListener(window, dom.EventType.KEY_UP, (e) => {
      this._resetKeybindingHoldMode();
      this.isComposingGlobalContextKey.set(e.isComposing);
      const keyEvent = new StandardKeyboardEvent(e);
      const shouldPreventDefault = this._singleModifierDispatch(keyEvent, keyEvent.target);
      if (shouldPreventDefault) {
        keyEvent.preventDefault();
      }
      this.isComposingGlobalContextKey.set(false);
    }));
    return disposables;
  }
  registerSchemaContribution(contribution) {
    this._contributions.push(contribution);
    if (contribution.onDidChange) {
      this._register(contribution.onDidChange(() => this.updateKeybindingsJsonSchema()));
    }
    this.updateKeybindingsJsonSchema();
  }
  updateKeybindingsJsonSchema() {
    this.kbsJsonSchema.updateSchema(this._contributions.flatMap((x) => x.getSchemaAdditions()));
  }
  _printKeybinding(keybinding) {
    return UserSettingsLabelProvider.toLabel(OS, keybinding.chords, (chord) => {
      if (chord instanceof KeyCodeChord) {
        return KeyCodeUtils.toString(chord.keyCode);
      }
      return ScanCodeUtils.toString(chord.scanCode);
    }) || "[null]";
  }
  _printResolvedKeybinding(resolvedKeybinding) {
    return resolvedKeybinding.getDispatchChords().map((x) => x || "[null]").join(" ");
  }
  _printResolvedKeybindings(output, input, resolvedKeybindings) {
    const padLength = 35;
    const firstRow = `${input.padStart(padLength, " ")} => `;
    if (resolvedKeybindings.length === 0) {
      output.push(`${firstRow}${"[NO BINDING]".padStart(padLength, " ")}`);
      return;
    }
    const firstRowIndentation = firstRow.length;
    const isFirst = true;
    for (const resolvedKeybinding of resolvedKeybindings) {
      if (isFirst) {
        output.push(`${firstRow}${this._printResolvedKeybinding(resolvedKeybinding).padStart(padLength, " ")}`);
      } else {
        output.push(`${" ".repeat(firstRowIndentation)}${this._printResolvedKeybinding(resolvedKeybinding).padStart(padLength, " ")}`);
      }
    }
  }
  _dumpResolveKeybindingDebugInfo() {
    const seenBindings = /* @__PURE__ */ new Set();
    const result = [];
    result.push(`Default Resolved Keybindings (unique only):`);
    for (const item of KeybindingsRegistry.getDefaultKeybindings()) {
      if (!item.keybinding) {
        continue;
      }
      const input = this._printKeybinding(item.keybinding);
      if (seenBindings.has(input)) {
        continue;
      }
      seenBindings.add(input);
      const resolvedKeybindings = this._keyboardMapper.resolveKeybinding(item.keybinding);
      this._printResolvedKeybindings(result, input, resolvedKeybindings);
    }
    result.push(`User Resolved Keybindings (unique only):`);
    for (const item of this.userKeybindings.keybindings) {
      if (!item.keybinding) {
        continue;
      }
      const input = item._sourceKey ?? "Impossible: missing source key, but has keybinding";
      if (seenBindings.has(input)) {
        continue;
      }
      seenBindings.add(input);
      const resolvedKeybindings = this._keyboardMapper.resolveKeybinding(item.keybinding);
      this._printResolvedKeybindings(result, input, resolvedKeybindings);
    }
    return result.join("\n");
  }
  _dumpDebugInfo() {
    const layoutInfo = JSON.stringify(this.keyboardLayoutService.getCurrentKeyboardLayout(), null, "	");
    const mapperInfo = this._keyboardMapper.dumpDebugInfo();
    const resolvedKeybindings = this._dumpResolveKeybindingDebugInfo();
    const rawMapping = JSON.stringify(this.keyboardLayoutService.getRawKeyboardMapping(), null, "	");
    return `Layout info:
${layoutInfo}

${resolvedKeybindings}

${mapperInfo}

Raw mapping:
${rawMapping}`;
  }
  _dumpDebugInfoJSON() {
    const info = {
      layout: this.keyboardLayoutService.getCurrentKeyboardLayout(),
      rawMapping: this.keyboardLayoutService.getRawKeyboardMapping()
    };
    return JSON.stringify(info, null, "	");
  }
  enableKeybindingHoldMode(commandId) {
    if (this._currentlyDispatchingCommandId !== commandId) {
      return void 0;
    }
    this._keybindingHoldMode = new DeferredPromise();
    const focusTracker = dom.trackFocus(dom.getWindow(void 0));
    const listener = focusTracker.onDidBlur(() => this._resetKeybindingHoldMode());
    this._keybindingHoldMode.p.finally(() => {
      listener.dispose();
      focusTracker.dispose();
    });
    this._log(`+ Enabled hold-mode for ${commandId}.`);
    return this._keybindingHoldMode.p;
  }
  _resetKeybindingHoldMode() {
    if (this._keybindingHoldMode) {
      this._keybindingHoldMode?.complete();
      this._keybindingHoldMode = null;
    }
  }
  customKeybindingsCount() {
    return this.userKeybindings.keybindings.length;
  }
  updateResolver() {
    this._cachedResolver = null;
    this._onDidUpdateKeybindings.fire();
  }
  _getResolver() {
    if (!this._cachedResolver) {
      const defaults = this._resolveKeybindingItems(KeybindingsRegistry.getDefaultKeybindings(), true);
      const overrides = this._resolveUserKeybindingItems(this.userKeybindings.keybindings, false);
      this._cachedResolver = new KeybindingResolver(defaults, overrides, (str) => this._log(str));
    }
    return this._cachedResolver;
  }
  _documentHasFocus() {
    return this.hostService.hasFocus;
  }
  _resolveKeybindingItems(items, isDefault) {
    const result = [];
    let resultLen = 0;
    for (const item of items) {
      const when = item.when || void 0;
      const keybinding = item.keybinding;
      if (!keybinding) {
        result[resultLen++] = new ResolvedKeybindingItem(void 0, item.command, item.commandArgs, when, isDefault, item.extensionId, item.isBuiltinExtension);
      } else {
        if (this._assertBrowserConflicts(keybinding)) {
          continue;
        }
        const resolvedKeybindings = this._keyboardMapper.resolveKeybinding(keybinding);
        for (let i = resolvedKeybindings.length - 1; i >= 0; i--) {
          const resolvedKeybinding = resolvedKeybindings[i];
          result[resultLen++] = new ResolvedKeybindingItem(resolvedKeybinding, item.command, item.commandArgs, when, isDefault, item.extensionId, item.isBuiltinExtension);
        }
      }
    }
    return result;
  }
  _resolveUserKeybindingItems(items, isDefault) {
    const result = [];
    let resultLen = 0;
    for (const item of items) {
      const when = item.when || void 0;
      if (!item.keybinding) {
        result[resultLen++] = new ResolvedKeybindingItem(void 0, item.command, item.commandArgs, when, isDefault, null, false);
      } else {
        const resolvedKeybindings = this._keyboardMapper.resolveKeybinding(item.keybinding);
        for (const resolvedKeybinding of resolvedKeybindings) {
          result[resultLen++] = new ResolvedKeybindingItem(resolvedKeybinding, item.command, item.commandArgs, when, isDefault, null, false);
        }
      }
    }
    return result;
  }
  _assertBrowserConflicts(keybinding) {
    if (BrowserFeatures.keyboard === KeyboardSupport.Always) {
      return false;
    }
    if (BrowserFeatures.keyboard === KeyboardSupport.FullScreen && browser.isFullscreen(mainWindow)) {
      return false;
    }
    for (const chord of keybinding.chords) {
      if (!chord.metaKey && !chord.altKey && !chord.ctrlKey && !chord.shiftKey) {
        continue;
      }
      const modifiersMask = KeyMod.CtrlCmd | KeyMod.Alt | KeyMod.Shift;
      let partModifiersMask = 0;
      if (chord.metaKey) {
        partModifiersMask |= KeyMod.CtrlCmd;
      }
      if (chord.shiftKey) {
        partModifiersMask |= KeyMod.Shift;
      }
      if (chord.altKey) {
        partModifiersMask |= KeyMod.Alt;
      }
      if (chord.ctrlKey && OS === OperatingSystem.Macintosh) {
        partModifiersMask |= KeyMod.WinCtrl;
      }
      if ((partModifiersMask & modifiersMask) === (KeyMod.CtrlCmd | KeyMod.Alt)) {
        if (chord instanceof ScanCodeChord && (chord.scanCode === ScanCode.ArrowLeft || chord.scanCode === ScanCode.ArrowRight)) {
          return true;
        }
        if (chord instanceof KeyCodeChord && (chord.keyCode === KeyCode.LeftArrow || chord.keyCode === KeyCode.RightArrow)) {
          return true;
        }
      }
      if ((partModifiersMask & modifiersMask) === KeyMod.CtrlCmd) {
        if (chord instanceof ScanCodeChord && (chord.scanCode >= ScanCode.Digit1 && chord.scanCode <= ScanCode.Digit0)) {
          return true;
        }
        if (chord instanceof KeyCodeChord && (chord.keyCode >= KeyCode.Digit0 && chord.keyCode <= KeyCode.Digit9)) {
          return true;
        }
      }
    }
    return false;
  }
  resolveKeybinding(kb) {
    return this._keyboardMapper.resolveKeybinding(kb);
  }
  resolveKeyboardEvent(keyboardEvent) {
    this.keyboardLayoutService.validateCurrentKeyboardMapping(keyboardEvent);
    return this._keyboardMapper.resolveKeyboardEvent(keyboardEvent);
  }
  resolveUserBinding(userBinding) {
    const keybinding = KeybindingParser.parseKeybinding(userBinding);
    return keybinding ? this._keyboardMapper.resolveKeybinding(keybinding) : [];
  }
  _handleKeybindingsExtensionPointUser(extensionId, isBuiltin, keybindings, collector, result) {
    if (Array.isArray(keybindings)) {
      for (let i = 0, len = keybindings.length; i < len; i++) {
        this._handleKeybinding(extensionId, isBuiltin, i + 1, keybindings[i], collector, result);
      }
    } else {
      this._handleKeybinding(extensionId, isBuiltin, 1, keybindings, collector, result);
    }
  }
  _handleKeybinding(extensionId, isBuiltin, idx, keybindings, collector, result) {
    const rejects = [];
    if (isValidContributedKeyBinding(keybindings, rejects)) {
      const rule = this._asCommandRule(extensionId, isBuiltin, idx++, keybindings);
      if (rule) {
        result.push(rule);
      }
    }
    if (rejects.length > 0) {
      collector.error(nls.localize(
        "invalid.keybindings",
        "Invalid `contributes.{0}`: {1}",
        keybindingsExtPoint.name,
        rejects.join("\n")
      ));
    }
  }
  static bindToCurrentPlatform(key, mac, linux, win) {
    if (OS === OperatingSystem.Windows && win) {
      if (win) {
        return win;
      }
    } else if (OS === OperatingSystem.Macintosh) {
      if (mac) {
        return mac;
      }
    } else {
      if (linux) {
        return linux;
      }
    }
    return key;
  }
  _asCommandRule(extensionId, isBuiltin, idx, binding) {
    const { command, args, when, key, mac, linux, win } = binding;
    const keybinding = WorkbenchKeybindingService.bindToCurrentPlatform(key, mac, linux, win);
    if (!keybinding) {
      return void 0;
    }
    let weight;
    if (isBuiltin) {
      weight = KeybindingWeight.BuiltinExtension + idx;
    } else {
      weight = KeybindingWeight.ExternalExtension + idx;
    }
    const commandAction = MenuRegistry.getCommand(command);
    const precondition = commandAction && commandAction.precondition;
    let fullWhen;
    if (when && precondition) {
      fullWhen = ContextKeyExpr.and(precondition, ContextKeyExpr.deserialize(when));
    } else if (when) {
      fullWhen = ContextKeyExpr.deserialize(when);
    } else if (precondition) {
      fullWhen = precondition;
    }
    const desc = {
      id: command,
      args,
      when: fullWhen,
      weight,
      keybinding: KeybindingParser.parseKeybinding(keybinding),
      extensionId: extensionId.value,
      isBuiltinExtension: isBuiltin
    };
    return desc;
  }
  getDefaultKeybindingsContent() {
    const resolver = this._getResolver();
    const defaultKeybindings = resolver.getDefaultKeybindings();
    const boundCommands = resolver.getDefaultBoundCommands();
    return WorkbenchKeybindingService._getDefaultKeybindings(defaultKeybindings) + "\n\n" + WorkbenchKeybindingService._getAllCommandsAsComment(boundCommands);
  }
  static _getDefaultKeybindings(defaultKeybindings) {
    const out = new OutputBuilder();
    out.writeLine("[");
    const lastIndex = defaultKeybindings.length - 1;
    defaultKeybindings.forEach((k, index) => {
      KeybindingIO.writeKeybindingItem(out, k);
      if (index !== lastIndex) {
        out.writeLine(",");
      } else {
        out.writeLine();
      }
    });
    out.writeLine("]");
    return out.toString();
  }
  static _getAllCommandsAsComment(boundCommands) {
    const unboundCommands = getAllUnboundCommands(boundCommands);
    const pretty = unboundCommands.sort().join("\n// - ");
    return "// " + nls.localize("unboundCommands", "Here are other available commands: ") + "\n// - " + pretty;
  }
  mightProducePrintableCharacter(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }
    const code = ScanCodeUtils.toEnum(event.code);
    if (NUMPAD_PRINTABLE_SCANCODES.indexOf(code) !== -1) {
      if (event.keyCode === IMMUTABLE_CODE_TO_KEY_CODE[code]) {
        return true;
      }
      if (isMacintosh && event.keyCode === otherMacNumpadMapping.get(code)) {
        return true;
      }
      return false;
    }
    const keycode = IMMUTABLE_CODE_TO_KEY_CODE[code];
    if (keycode !== -1) {
      return false;
    }
    const mapping = this.keyboardLayoutService.getRawKeyboardMapping();
    if (!mapping) {
      return false;
    }
    const keyInfo = mapping[event.code];
    if (!keyInfo) {
      return false;
    }
    if (!keyInfo.value || /\s/.test(keyInfo.value)) {
      return false;
    }
    return true;
  }
};
WorkbenchKeybindingService = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IUserDataProfileService),
  __decorateParam(5, IHostService),
  __decorateParam(6, IExtensionService),
  __decorateParam(7, IFileService),
  __decorateParam(8, IUriIdentityService),
  __decorateParam(9, ILogService),
  __decorateParam(10, IKeyboardLayoutService)
], WorkbenchKeybindingService);
class UserKeybindings extends Disposable {
  constructor(userDataProfileService, uriIdentityService, fileService, logService) {
    super();
    this.userDataProfileService = userDataProfileService;
    this.uriIdentityService = uriIdentityService;
    this.fileService = fileService;
    this._rawKeybindings = [];
    this._keybindings = [];
    this.watchDisposables = this._register(new DisposableStore());
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.watch();
    this.reloadConfigurationScheduler = this._register(new RunOnceScheduler(() => this.reload().then((changed) => {
      if (changed) {
        this._onDidChange.fire();
      }
    }), 50));
    this._register(Event.filter(this.fileService.onDidFilesChange, (e) => e.contains(this.userDataProfileService.currentProfile.keybindingsResource))(() => {
      logService.debug("Keybindings file changed");
      this.reloadConfigurationScheduler.schedule();
    }));
    this._register(this.fileService.onDidRunOperation((e) => {
      if (e.operation === FileOperation.WRITE && e.resource.toString() === this.userDataProfileService.currentProfile.keybindingsResource.toString()) {
        logService.debug("Keybindings file written");
        this.reloadConfigurationScheduler.schedule();
      }
    }));
    this._register(userDataProfileService.onDidChangeCurrentProfile((e) => {
      if (!this.uriIdentityService.extUri.isEqual(e.previous.keybindingsResource, e.profile.keybindingsResource)) {
        e.join(this.whenCurrentProfileChanged());
      }
    }));
  }
  get keybindings() {
    return this._keybindings;
  }
  async whenCurrentProfileChanged() {
    this.watch();
    this.reloadConfigurationScheduler.schedule();
  }
  watch() {
    this.watchDisposables.clear();
    this.watchDisposables.add(this.fileService.watch(dirname(this.userDataProfileService.currentProfile.keybindingsResource)));
    this.watchDisposables.add(this.fileService.watch(this.userDataProfileService.currentProfile.keybindingsResource));
  }
  async initialize() {
    await this.reload();
  }
  async reload() {
    const newKeybindings = await this.readUserKeybindings();
    if (objects.equals(this._rawKeybindings, newKeybindings)) {
      return false;
    }
    this._rawKeybindings = newKeybindings;
    this._keybindings = this._rawKeybindings.map((k) => KeybindingIO.readUserKeybindingItem(k));
    return true;
  }
  async readUserKeybindings() {
    try {
      const content = await this.fileService.readFile(this.userDataProfileService.currentProfile.keybindingsResource);
      const value = parse(content.value.toString());
      return Array.isArray(value) ? value.filter(
        (v) => v && typeof v === "object"
        /* just typeof === object doesn't catch `null` */
      ) : [];
    } catch (e) {
      return [];
    }
  }
}
const _KeybindingsJsonSchema = class _KeybindingsJsonSchema {
  constructor() {
    this.commandsSchemas = [];
    this.commandsEnum = [];
    this.removalCommandsEnum = [];
    this.commandsEnumDescriptions = [];
    this.schema = {
      id: _KeybindingsJsonSchema.schemaId,
      type: "array",
      title: nls.localize("keybindings.json.title", "Keybindings configuration"),
      allowTrailingCommas: true,
      allowComments: true,
      definitions: {
        "editorGroupsSchema": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "groups": {
                "$ref": "#/definitions/editorGroupsSchema",
                "default": [{}, {}]
              },
              "size": {
                "type": "number",
                "default": 0.5
              }
            }
          }
        },
        "commandNames": {
          "type": "string",
          "enum": this.commandsEnum,
          "enumDescriptions": this.commandsEnumDescriptions,
          "description": nls.localize("keybindings.json.command", "Name of the command to execute")
        },
        "commandType": {
          "anyOf": [
            // repetition of this clause here and below is intentional: one is for nice diagnostics & one is for code completion
            {
              $ref: "#/definitions/commandNames"
            },
            {
              "type": "string",
              "enum": this.removalCommandsEnum,
              "enumDescriptions": this.commandsEnumDescriptions,
              "description": nls.localize("keybindings.json.removalCommand", "Name of the command to remove keyboard shortcut for")
            },
            {
              "type": "string"
            }
          ]
        },
        "commandsSchemas": {
          "allOf": this.commandsSchemas
        }
      },
      items: {
        "required": ["key"],
        "type": "object",
        "defaultSnippets": [{ "body": { "key": "$1", "command": "$2", "when": "$3" } }],
        "properties": {
          "key": {
            "type": "string",
            "description": nls.localize("keybindings.json.key", "Key or key sequence (separated by space)")
          },
          "command": {
            "anyOf": [
              {
                "if": {
                  "type": "array"
                },
                "then": {
                  "not": {
                    "type": "array"
                  },
                  "errorMessage": nls.localize("keybindings.commandsIsArray", `Incorrect type. Expected "{0}". The field 'command' does not support running multiple commands. Use command 'runCommands' to pass it multiple commands to run.`, "string")
                },
                "else": {
                  "$ref": "#/definitions/commandType"
                }
              },
              {
                "$ref": "#/definitions/commandType"
              }
            ]
          },
          "when": {
            "type": "string",
            "description": nls.localize("keybindings.json.when", "Condition when the key is active.")
          },
          "args": {
            "description": nls.localize("keybindings.json.args", "Arguments to pass to the command to execute.")
          }
        },
        "$ref": "#/definitions/commandsSchemas"
      }
    };
    this.schemaRegistry = Registry.as(Extensions.JSONContribution);
    this.schemaRegistry.registerSchema(_KeybindingsJsonSchema.schemaId, this.schema);
  }
  // TODO@ulugbekna: can updates happen incrementally rather than rebuilding; concerns:
  // - is just appending additional schemas enough for the registry to pick them up?
  // - can `CommandsRegistry.getCommands` and `MenuRegistry.getCommands` return different values at different times? ie would just pushing new schemas from `additionalContributions` not be enough?
  updateSchema(additionalContributions) {
    this.commandsSchemas.length = 0;
    this.commandsEnum.length = 0;
    this.removalCommandsEnum.length = 0;
    this.commandsEnumDescriptions.length = 0;
    const knownCommands = /* @__PURE__ */ new Set();
    const addKnownCommand = (commandId, description) => {
      if (!/^_/.test(commandId)) {
        if (!knownCommands.has(commandId)) {
          knownCommands.add(commandId);
          this.commandsEnum.push(commandId);
          this.commandsEnumDescriptions.push(isLocalizedString(description) ? description.value : description);
          this.removalCommandsEnum.push(`-${commandId}`);
        }
      }
    };
    const allCommands = CommandsRegistry.getCommands();
    for (const [commandId, command] of allCommands) {
      const commandMetadata = command.metadata;
      addKnownCommand(commandId, commandMetadata?.description ?? MenuRegistry.getCommand(commandId)?.title);
      if (!commandMetadata || !commandMetadata.args || commandMetadata.args.length !== 1 || !commandMetadata.args[0].schema) {
        continue;
      }
      const argsSchema = commandMetadata.args[0].schema;
      const argsRequired = typeof commandMetadata.args[0].isOptional !== "undefined" ? !commandMetadata.args[0].isOptional : Array.isArray(argsSchema.required) && argsSchema.required.length > 0;
      const addition = {
        "if": {
          "required": ["command"],
          "properties": {
            "command": { "const": commandId }
          }
        },
        "then": {
          "required": [].concat(argsRequired ? ["args"] : []),
          "properties": {
            "args": argsSchema
          }
        }
      };
      this.commandsSchemas.push(addition);
    }
    const menuCommands = MenuRegistry.getCommands();
    for (const commandId of menuCommands.keys()) {
      addKnownCommand(commandId);
    }
    this.commandsSchemas.push(...additionalContributions);
    this.schemaRegistry.notifySchemaChanged(_KeybindingsJsonSchema.schemaId);
  }
};
_KeybindingsJsonSchema.schemaId = "vscode://schemas/keybindings";
let KeybindingsJsonSchema = _KeybindingsJsonSchema;
registerSingleton(IKeybindingService, WorkbenchKeybindingService, InstantiationType.Eager);
export {
  WorkbenchKeybindingService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMva2V5YmluZGluZy9icm93c2VyL2tleWJpbmRpbmdTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5cbi8vIGJhc2VcbmltcG9ydCAqIGFzIGJyb3dzZXIgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgQnJvd3NlckZlYXR1cmVzLCBLZXlib2FyZFN1cHBvcnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvY2FuSVVzZS5qcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBwcmludEtleWJvYXJkRXZlbnQsIHByaW50U3RhbmRhcmRLZXlib2FyZEV2ZW50LCBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UsIFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IHBhcnNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vanNvbi5qcyc7XG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IHsgVXNlclNldHRpbmdzTGFiZWxQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleWJpbmRpbmdMYWJlbHMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1BhcnNlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleWJpbmRpbmdQYXJzZXIuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZywgS2V5Q29kZUNob3JkLCBSZXNvbHZlZEtleWJpbmRpbmcsIFNjYW5Db2RlQ2hvcmQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXliaW5kaW5ncy5qcyc7XG5pbXBvcnQgeyBJTU1VVEFCTEVfQ09ERV9UT19LRVlfQ09ERSwgS2V5Q29kZSwgS2V5Q29kZVV0aWxzLCBLZXlNb2QsIFNjYW5Db2RlLCBTY2FuQ29kZVV0aWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgKiBhcyBvYmplY3RzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2gsIE9wZXJhdGluZ1N5c3RlbSwgT1MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBkaXJuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcblxuLy8gcGxhdGZvcm1cbmltcG9ydCB7IE1lbnVSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSwgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBDb250ZXh0S2V5RXhwcmVzc2lvbiwgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRmlsZU9wZXJhdGlvbiwgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucywgSUpTT05Db250cmlidXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2pzb25zY2hlbWFzL2NvbW1vbi9qc29uQ29udHJpYnV0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2Fic3RyYWN0S2V5YmluZGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlLCBJS2V5Ym9hcmRFdmVudCwgS2V5YmluZGluZ3NTY2hlbWFDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdSZXNvbHZlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uS2V5YmluZGluZ1J1bGUsIElLZXliaW5kaW5nSXRlbSwgS2V5YmluZGluZ3NSZWdpc3RyeSwgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgUmVzb2x2ZWRLZXliaW5kaW5nSXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL3Jlc29sdmVkS2V5YmluZGluZ0l0ZW0uanMnO1xuaW1wb3J0IHsgSUtleWJvYXJkTGF5b3V0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJvYXJkTGF5b3V0L2NvbW1vbi9rZXlib2FyZExheW91dC5qcyc7XG5pbXBvcnQgeyBJS2V5Ym9hcmRNYXBwZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXlib2FyZExheW91dC9jb21tb24va2V5Ym9hcmRNYXBwZXIuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBJTG9jYWxpemVkU3RyaW5nLCBpc0xvY2FsaXplZFN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uLmpzJztcblxuLy8gd29ya2JlbmNoXG5pbXBvcnQgeyBjb21tYW5kc0V4dGVuc2lvblBvaW50IH0gZnJvbSAnLi4vLi4vYWN0aW9ucy9jb21tb24vbWVudXNFeHRlbnNpb25Qb2ludC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uTWVzc2FnZUNvbGxlY3RvciwgRXh0ZW5zaW9uc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9uc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IElLZXlib2FyZCwgSU5hdmlnYXRvcldpdGhLZXlib2FyZCB9IGZyb20gJy4vbmF2aWdhdG9yS2V5Ym9hcmQuanMnO1xuaW1wb3J0IHsgZ2V0QWxsVW5ib3VuZENvbW1hbmRzIH0gZnJvbSAnLi91bmJvdW5kQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSVVzZXJLZXliaW5kaW5nSXRlbSwgS2V5YmluZGluZ0lPLCBPdXRwdXRCdWlsZGVyIH0gZnJvbSAnLi4vY29tbW9uL2tleWJpbmRpbmdJTy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlU2VydmljZSB9IGZyb20gJy4uLy4uL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcblxuaW50ZXJmYWNlIENvbnRyaWJ1dGVkS2V5QmluZGluZyB7XG5cdGNvbW1hbmQ6IHN0cmluZztcblx0YXJncz86IGFueTtcblx0a2V5OiBzdHJpbmc7XG5cdHdoZW4/OiBzdHJpbmc7XG5cdG1hYz86IHN0cmluZztcblx0bGludXg/OiBzdHJpbmc7XG5cdHdpbj86IHN0cmluZztcbn1cblxuZnVuY3Rpb24gaXNWYWxpZENvbnRyaWJ1dGVkS2V5QmluZGluZyhrZXlCaW5kaW5nOiBDb250cmlidXRlZEtleUJpbmRpbmcsIHJlamVjdHM6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG5cdGlmICgha2V5QmluZGluZykge1xuXHRcdHJlamVjdHMucHVzaChubHMubG9jYWxpemUoJ25vbmVtcHR5JywgXCJleHBlY3RlZCBub24tZW1wdHkgdmFsdWUuXCIpKTtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKHR5cGVvZiBrZXlCaW5kaW5nLmNvbW1hbmQgIT09ICdzdHJpbmcnKSB7XG5cdFx0cmVqZWN0cy5wdXNoKG5scy5sb2NhbGl6ZSgncmVxdWlyZXN0cmluZycsIFwicHJvcGVydHkgYHswfWAgaXMgbWFuZGF0b3J5IGFuZCBtdXN0IGJlIG9mIHR5cGUgYHN0cmluZ2BcIiwgJ2NvbW1hbmQnKSk7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdGlmIChrZXlCaW5kaW5nLmtleSAmJiB0eXBlb2Yga2V5QmluZGluZy5rZXkgIT09ICdzdHJpbmcnKSB7XG5cdFx0cmVqZWN0cy5wdXNoKG5scy5sb2NhbGl6ZSgnb3B0c3RyaW5nJywgXCJwcm9wZXJ0eSBgezB9YCBjYW4gYmUgb21pdHRlZCBvciBtdXN0IGJlIG9mIHR5cGUgYHN0cmluZ2BcIiwgJ2tleScpKTtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKGtleUJpbmRpbmcud2hlbiAmJiB0eXBlb2Yga2V5QmluZGluZy53aGVuICE9PSAnc3RyaW5nJykge1xuXHRcdHJlamVjdHMucHVzaChubHMubG9jYWxpemUoJ29wdHN0cmluZycsIFwicHJvcGVydHkgYHswfWAgY2FuIGJlIG9taXR0ZWQgb3IgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdgXCIsICd3aGVuJykpO1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRpZiAoa2V5QmluZGluZy5tYWMgJiYgdHlwZW9mIGtleUJpbmRpbmcubWFjICE9PSAnc3RyaW5nJykge1xuXHRcdHJlamVjdHMucHVzaChubHMubG9jYWxpemUoJ29wdHN0cmluZycsIFwicHJvcGVydHkgYHswfWAgY2FuIGJlIG9taXR0ZWQgb3IgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdgXCIsICdtYWMnKSk7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdGlmIChrZXlCaW5kaW5nLmxpbnV4ICYmIHR5cGVvZiBrZXlCaW5kaW5nLmxpbnV4ICE9PSAnc3RyaW5nJykge1xuXHRcdHJlamVjdHMucHVzaChubHMubG9jYWxpemUoJ29wdHN0cmluZycsIFwicHJvcGVydHkgYHswfWAgY2FuIGJlIG9taXR0ZWQgb3IgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdgXCIsICdsaW51eCcpKTtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKGtleUJpbmRpbmcud2luICYmIHR5cGVvZiBrZXlCaW5kaW5nLndpbiAhPT0gJ3N0cmluZycpIHtcblx0XHRyZWplY3RzLnB1c2gobmxzLmxvY2FsaXplKCdvcHRzdHJpbmcnLCBcInByb3BlcnR5IGB7MH1gIGNhbiBiZSBvbWl0dGVkIG9yIG11c3QgYmUgb2YgdHlwZSBgc3RyaW5nYFwiLCAnd2luJykpO1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuY29uc3Qga2V5YmluZGluZ1R5cGU6IElKU09OU2NoZW1hID0ge1xuXHR0eXBlOiAnb2JqZWN0Jyxcblx0ZGVmYXVsdDogeyBjb21tYW5kOiAnJywga2V5OiAnJyB9LFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0Y29tbWFuZDoge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5rZXliaW5kaW5ncy5jb21tYW5kJywgJ0lkZW50aWZpZXIgb2YgdGhlIGNvbW1hbmQgdG8gcnVuIHdoZW4ga2V5YmluZGluZyBpcyB0cmlnZ2VyZWQuJyksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdH0sXG5cdFx0YXJnczoge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5rZXliaW5kaW5ncy5hcmdzJywgXCJBcmd1bWVudHMgdG8gcGFzcyB0byB0aGUgY29tbWFuZCB0byBleGVjdXRlLlwiKVxuXHRcdH0sXG5cdFx0a2V5OiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmtleWJpbmRpbmdzLmtleScsICdLZXkgb3Iga2V5IHNlcXVlbmNlIChzZXBhcmF0ZSBrZXlzIHdpdGggcGx1cy1zaWduIGFuZCBzZXF1ZW5jZXMgd2l0aCBzcGFjZSwgZS5nLiBDdHJsK08gYW5kIEN0cmwrTCBMIGZvciBhIGNob3JkKS4nKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0fSxcblx0XHRtYWM6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMua2V5YmluZGluZ3MubWFjJywgJ01hYyBzcGVjaWZpYyBrZXkgb3Iga2V5IHNlcXVlbmNlLicpLFxuXHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHR9LFxuXHRcdGxpbnV4OiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmtleWJpbmRpbmdzLmxpbnV4JywgJ0xpbnV4IHNwZWNpZmljIGtleSBvciBrZXkgc2VxdWVuY2UuJyksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdH0sXG5cdFx0d2luOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmtleWJpbmRpbmdzLndpbicsICdXaW5kb3dzIHNwZWNpZmljIGtleSBvciBrZXkgc2VxdWVuY2UuJyksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdH0sXG5cdFx0d2hlbjoge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5rZXliaW5kaW5ncy53aGVuJywgJ0NvbmRpdGlvbiB3aGVuIHRoZSBrZXkgaXMgYWN0aXZlLicpLFxuXHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHR9LFxuXHR9XG59O1xuXG5jb25zdCBrZXliaW5kaW5nc0V4dFBvaW50ID0gRXh0ZW5zaW9uc1JlZ2lzdHJ5LnJlZ2lzdGVyRXh0ZW5zaW9uUG9pbnQ8Q29udHJpYnV0ZWRLZXlCaW5kaW5nIHwgQ29udHJpYnV0ZWRLZXlCaW5kaW5nW10+KHtcblx0ZXh0ZW5zaW9uUG9pbnQ6ICdrZXliaW5kaW5ncycsXG5cdGRlcHM6IFtjb21tYW5kc0V4dGVuc2lvblBvaW50XSxcblx0anNvblNjaGVtYToge1xuXHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMua2V5YmluZGluZ3MnLCBcIkNvbnRyaWJ1dGVzIGtleWJpbmRpbmdzLlwiKSxcblx0XHRvbmVPZjogW1xuXHRcdFx0a2V5YmluZGluZ1R5cGUsXG5cdFx0XHR7XG5cdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdGl0ZW1zOiBrZXliaW5kaW5nVHlwZVxuXHRcdFx0fVxuXHRcdF1cblx0fVxufSk7XG5cbmNvbnN0IE5VTVBBRF9QUklOVEFCTEVfU0NBTkNPREVTID0gW1xuXHRTY2FuQ29kZS5OdW1wYWREaXZpZGUsXG5cdFNjYW5Db2RlLk51bXBhZE11bHRpcGx5LFxuXHRTY2FuQ29kZS5OdW1wYWRTdWJ0cmFjdCxcblx0U2NhbkNvZGUuTnVtcGFkQWRkLFxuXHRTY2FuQ29kZS5OdW1wYWQxLFxuXHRTY2FuQ29kZS5OdW1wYWQyLFxuXHRTY2FuQ29kZS5OdW1wYWQzLFxuXHRTY2FuQ29kZS5OdW1wYWQ0LFxuXHRTY2FuQ29kZS5OdW1wYWQ1LFxuXHRTY2FuQ29kZS5OdW1wYWQ2LFxuXHRTY2FuQ29kZS5OdW1wYWQ3LFxuXHRTY2FuQ29kZS5OdW1wYWQ4LFxuXHRTY2FuQ29kZS5OdW1wYWQ5LFxuXHRTY2FuQ29kZS5OdW1wYWQwLFxuXHRTY2FuQ29kZS5OdW1wYWREZWNpbWFsXG5dO1xuXG5jb25zdCBvdGhlck1hY051bXBhZE1hcHBpbmcgPSBuZXcgTWFwPFNjYW5Db2RlLCBLZXlDb2RlPigpO1xub3RoZXJNYWNOdW1wYWRNYXBwaW5nLnNldChTY2FuQ29kZS5OdW1wYWQxLCBLZXlDb2RlLkRpZ2l0MSk7XG5vdGhlck1hY051bXBhZE1hcHBpbmcuc2V0KFNjYW5Db2RlLk51bXBhZDIsIEtleUNvZGUuRGlnaXQyKTtcbm90aGVyTWFjTnVtcGFkTWFwcGluZy5zZXQoU2NhbkNvZGUuTnVtcGFkMywgS2V5Q29kZS5EaWdpdDMpO1xub3RoZXJNYWNOdW1wYWRNYXBwaW5nLnNldChTY2FuQ29kZS5OdW1wYWQ0LCBLZXlDb2RlLkRpZ2l0NCk7XG5vdGhlck1hY051bXBhZE1hcHBpbmcuc2V0KFNjYW5Db2RlLk51bXBhZDUsIEtleUNvZGUuRGlnaXQ1KTtcbm90aGVyTWFjTnVtcGFkTWFwcGluZy5zZXQoU2NhbkNvZGUuTnVtcGFkNiwgS2V5Q29kZS5EaWdpdDYpO1xub3RoZXJNYWNOdW1wYWRNYXBwaW5nLnNldChTY2FuQ29kZS5OdW1wYWQ3LCBLZXlDb2RlLkRpZ2l0Nyk7XG5vdGhlck1hY051bXBhZE1hcHBpbmcuc2V0KFNjYW5Db2RlLk51bXBhZDgsIEtleUNvZGUuRGlnaXQ4KTtcbm90aGVyTWFjTnVtcGFkTWFwcGluZy5zZXQoU2NhbkNvZGUuTnVtcGFkOSwgS2V5Q29kZS5EaWdpdDkpO1xub3RoZXJNYWNOdW1wYWRNYXBwaW5nLnNldChTY2FuQ29kZS5OdW1wYWQwLCBLZXlDb2RlLkRpZ2l0MCk7XG5cbmV4cG9ydCBjbGFzcyBXb3JrYmVuY2hLZXliaW5kaW5nU2VydmljZSBleHRlbmRzIEFic3RyYWN0S2V5YmluZGluZ1NlcnZpY2Uge1xuXG5cdHByaXZhdGUgX2tleWJvYXJkTWFwcGVyOiBJS2V5Ym9hcmRNYXBwZXI7XG5cdHByaXZhdGUgX2NhY2hlZFJlc29sdmVyOiBLZXliaW5kaW5nUmVzb2x2ZXIgfCBudWxsO1xuXHRwcml2YXRlIHVzZXJLZXliaW5kaW5nczogVXNlcktleWJpbmRpbmdzO1xuXHRwcml2YXRlIGlzQ29tcG9zaW5nR2xvYmFsQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgX2tleWJpbmRpbmdIb2xkTW9kZTogRGVmZXJyZWRQcm9taXNlPHZvaWQ+IHwgbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBfY29udHJpYnV0aW9uczogS2V5YmluZGluZ3NTY2hlbWFDb250cmlidXRpb25bXSA9IFtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IGtic0pzb25TY2hlbWE6IEtleWJpbmRpbmdzSnNvblNjaGVtYTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2Ugbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIHVzZXJEYXRhUHJvZmlsZVNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUtleWJvYXJkTGF5b3V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGtleWJvYXJkTGF5b3V0U2VydmljZTogSUtleWJvYXJkTGF5b3V0U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihjb250ZXh0S2V5U2VydmljZSwgY29tbWFuZFNlcnZpY2UsIHRlbGVtZXRyeVNlcnZpY2UsIG5vdGlmaWNhdGlvblNlcnZpY2UsIGxvZ1NlcnZpY2UpO1xuXG5cdFx0dGhpcy5pc0NvbXBvc2luZ0dsb2JhbENvbnRleHRLZXkgPSBjb250ZXh0S2V5U2VydmljZS5jcmVhdGVLZXkoJ2lzQ29tcG9zaW5nJywgZmFsc2UpO1xuXG5cdFx0dGhpcy5rYnNKc29uU2NoZW1hID0gbmV3IEtleWJpbmRpbmdzSnNvblNjaGVtYSgpO1xuXHRcdHRoaXMudXBkYXRlS2V5YmluZGluZ3NKc29uU2NoZW1hKCk7XG5cblx0XHR0aGlzLl9rZXlib2FyZE1hcHBlciA9IHRoaXMua2V5Ym9hcmRMYXlvdXRTZXJ2aWNlLmdldEtleWJvYXJkTWFwcGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5rZXlib2FyZExheW91dFNlcnZpY2Uub25EaWRDaGFuZ2VLZXlib2FyZExheW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLl9rZXlib2FyZE1hcHBlciA9IHRoaXMua2V5Ym9hcmRMYXlvdXRTZXJ2aWNlLmdldEtleWJvYXJkTWFwcGVyKCk7XG5cdFx0XHR0aGlzLnVwZGF0ZVJlc29sdmVyKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fa2V5YmluZGluZ0hvbGRNb2RlID0gbnVsbDtcblx0XHR0aGlzLl9jYWNoZWRSZXNvbHZlciA9IG51bGw7XG5cblx0XHR0aGlzLnVzZXJLZXliaW5kaW5ncyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBVc2VyS2V5YmluZGluZ3ModXNlckRhdGFQcm9maWxlU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlLCBmaWxlU2VydmljZSwgbG9nU2VydmljZSkpO1xuXHRcdHRoaXMudXNlcktleWJpbmRpbmdzLmluaXRpYWxpemUoKS50aGVuKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLnVzZXJLZXliaW5kaW5ncy5rZXliaW5kaW5ncy5sZW5ndGgpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVSZXNvbHZlcigpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudXNlcktleWJpbmRpbmdzLm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdGxvZ1NlcnZpY2UuZGVidWcoJ1VzZXIga2V5YmluZGluZ3MgY2hhbmdlZCcpO1xuXHRcdFx0dGhpcy51cGRhdGVSZXNvbHZlcigpO1xuXHRcdH0pKTtcblxuXHRcdGtleWJpbmRpbmdzRXh0UG9pbnQuc2V0SGFuZGxlcigoZXh0ZW5zaW9ucykgPT4ge1xuXG5cdFx0XHRjb25zdCBrZXliaW5kaW5nczogSUV4dGVuc2lvbktleWJpbmRpbmdSdWxlW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGV4dGVuc2lvbnMpIHtcblx0XHRcdFx0dGhpcy5faGFuZGxlS2V5YmluZGluZ3NFeHRlbnNpb25Qb2ludFVzZXIoZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmlkZW50aWZpZXIsIGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5pc0J1aWx0aW4sIGV4dGVuc2lvbi52YWx1ZSwgZXh0ZW5zaW9uLmNvbGxlY3Rvciwga2V5YmluZGluZ3MpO1xuXHRcdFx0fVxuXG5cdFx0XHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnNldEV4dGVuc2lvbktleWJpbmRpbmdzKGtleWJpbmRpbmdzKTtcblx0XHRcdHRoaXMudXBkYXRlUmVzb2x2ZXIoKTtcblx0XHR9KTtcblxuXHRcdHRoaXMudXBkYXRlS2V5YmluZGluZ3NKc29uU2NoZW1hKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZXh0ZW5zaW9uU2VydmljZS5vbkRpZFJlZ2lzdGVyRXh0ZW5zaW9ucygoKSA9PiB0aGlzLnVwZGF0ZUtleWJpbmRpbmdzSnNvblNjaGVtYSgpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUoZG9tLm9uRGlkUmVnaXN0ZXJXaW5kb3csICh7IHdpbmRvdywgZGlzcG9zYWJsZXMgfSkgPT4gZGlzcG9zYWJsZXMuYWRkKHRoaXMuX3JlZ2lzdGVyS2V5TGlzdGVuZXJzKHdpbmRvdykpLCB7IHdpbmRvdzogbWFpbldpbmRvdywgZGlzcG9zYWJsZXM6IHRoaXMuX3N0b3JlIH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGJyb3dzZXIub25EaWRDaGFuZ2VGdWxsc2NyZWVuKHdpbmRvd0lkID0+IHtcblx0XHRcdGlmICh3aW5kb3dJZCAhPT0gbWFpbldpbmRvdy52c2NvZGVXaW5kb3dJZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGtleWJvYXJkOiBJS2V5Ym9hcmQgfCBudWxsID0gKDxJTmF2aWdhdG9yV2l0aEtleWJvYXJkPm5hdmlnYXRvcikua2V5Ym9hcmQ7XG5cblx0XHRcdGlmIChCcm93c2VyRmVhdHVyZXMua2V5Ym9hcmQgPT09IEtleWJvYXJkU3VwcG9ydC5Ob25lKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGJyb3dzZXIuaXNGdWxsc2NyZWVuKG1haW5XaW5kb3cpKSB7XG5cdFx0XHRcdGtleWJvYXJkPy5sb2NrKFsnRXNjYXBlJ10pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0a2V5Ym9hcmQ/LnVubG9jaygpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyB1cGRhdGUgcmVzb2x2ZXIgd2hpY2ggd2lsbCBicmluZyBiYWNrIGFsbCB1bmJvdW5kIGtleWJvYXJkIHNob3J0Y3V0c1xuXHRcdFx0dGhpcy5fY2FjaGVkUmVzb2x2ZXIgPSBudWxsO1xuXHRcdFx0dGhpcy5fb25EaWRVcGRhdGVLZXliaW5kaW5ncy5maXJlKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVnaXN0ZXJLZXlMaXN0ZW5lcnMod2luZG93OiBXaW5kb3cpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHQvLyBmb3Igc3RhbmRhcmQga2V5YmluZGluZ3Ncblx0XHRkaXNwb3NhYmxlcy5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih3aW5kb3csIGRvbS5FdmVudFR5cGUuS0VZX0RPV04sIChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fa2V5YmluZGluZ0hvbGRNb2RlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuaXNDb21wb3NpbmdHbG9iYWxDb250ZXh0S2V5LnNldChlLmlzQ29tcG9zaW5nKTtcblx0XHRcdGNvbnN0IGtleUV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdHRoaXMuX2xvZyhgLyBSZWNlaXZlZCAga2V5ZG93biBldmVudCAtICR7cHJpbnRLZXlib2FyZEV2ZW50KGUpfWApO1xuXHRcdFx0dGhpcy5fbG9nKGB8IENvbnZlcnRlZCBrZXlkb3duIGV2ZW50IC0gJHtwcmludFN0YW5kYXJkS2V5Ym9hcmRFdmVudChrZXlFdmVudCl9YCk7XG5cdFx0XHRjb25zdCBzaG91bGRQcmV2ZW50RGVmYXVsdCA9IHRoaXMuX2Rpc3BhdGNoKGtleUV2ZW50LCBrZXlFdmVudC50YXJnZXQpO1xuXHRcdFx0aWYgKHNob3VsZFByZXZlbnREZWZhdWx0KSB7XG5cdFx0XHRcdGtleUV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmlzQ29tcG9zaW5nR2xvYmFsQ29udGV4dEtleS5zZXQoZmFsc2UpO1xuXHRcdH0pKTtcblxuXHRcdC8vIGZvciBzaW5nbGUgbW9kaWZpZXIgY2hvcmQga2V5YmluZGluZ3MgKGUuZy4gc2hpZnQgc2hpZnQpXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIod2luZG93LCBkb20uRXZlbnRUeXBlLktFWV9VUCwgKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcblx0XHRcdHRoaXMuX3Jlc2V0S2V5YmluZGluZ0hvbGRNb2RlKCk7XG5cdFx0XHR0aGlzLmlzQ29tcG9zaW5nR2xvYmFsQ29udGV4dEtleS5zZXQoZS5pc0NvbXBvc2luZyk7XG5cdFx0XHRjb25zdCBrZXlFdmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRjb25zdCBzaG91bGRQcmV2ZW50RGVmYXVsdCA9IHRoaXMuX3NpbmdsZU1vZGlmaWVyRGlzcGF0Y2goa2V5RXZlbnQsIGtleUV2ZW50LnRhcmdldCk7XG5cdFx0XHRpZiAoc2hvdWxkUHJldmVudERlZmF1bHQpIHtcblx0XHRcdFx0a2V5RXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuaXNDb21wb3NpbmdHbG9iYWxDb250ZXh0S2V5LnNldChmYWxzZSk7XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIGRpc3Bvc2FibGVzO1xuXHR9XG5cblx0cHVibGljIHJlZ2lzdGVyU2NoZW1hQ29udHJpYnV0aW9uKGNvbnRyaWJ1dGlvbjogS2V5YmluZGluZ3NTY2hlbWFDb250cmlidXRpb24pOiB2b2lkIHtcblx0XHR0aGlzLl9jb250cmlidXRpb25zLnB1c2goY29udHJpYnV0aW9uKTtcblx0XHRpZiAoY29udHJpYnV0aW9uLm9uRGlkQ2hhbmdlKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcihjb250cmlidXRpb24ub25EaWRDaGFuZ2UoKCkgPT4gdGhpcy51cGRhdGVLZXliaW5kaW5nc0pzb25TY2hlbWEoKSkpO1xuXHRcdH1cblx0XHR0aGlzLnVwZGF0ZUtleWJpbmRpbmdzSnNvblNjaGVtYSgpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVLZXliaW5kaW5nc0pzb25TY2hlbWEoKSB7XG5cdFx0dGhpcy5rYnNKc29uU2NoZW1hLnVwZGF0ZVNjaGVtYSh0aGlzLl9jb250cmlidXRpb25zLmZsYXRNYXAoeCA9PiB4LmdldFNjaGVtYUFkZGl0aW9ucygpKSk7XG5cdH1cblxuXHRwcml2YXRlIF9wcmludEtleWJpbmRpbmcoa2V5YmluZGluZzogS2V5YmluZGluZyk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIFVzZXJTZXR0aW5nc0xhYmVsUHJvdmlkZXIudG9MYWJlbChPUywga2V5YmluZGluZy5jaG9yZHMsIChjaG9yZCkgPT4ge1xuXHRcdFx0aWYgKGNob3JkIGluc3RhbmNlb2YgS2V5Q29kZUNob3JkKSB7XG5cdFx0XHRcdHJldHVybiBLZXlDb2RlVXRpbHMudG9TdHJpbmcoY2hvcmQua2V5Q29kZSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gU2NhbkNvZGVVdGlscy50b1N0cmluZyhjaG9yZC5zY2FuQ29kZSk7XG5cdFx0fSkgfHwgJ1tudWxsXSc7XG5cdH1cblxuXHRwcml2YXRlIF9wcmludFJlc29sdmVkS2V5YmluZGluZyhyZXNvbHZlZEtleWJpbmRpbmc6IFJlc29sdmVkS2V5YmluZGluZyk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHJlc29sdmVkS2V5YmluZGluZy5nZXREaXNwYXRjaENob3JkcygpLm1hcCh4ID0+IHggfHwgJ1tudWxsXScpLmpvaW4oJyAnKTtcblx0fVxuXG5cdHByaXZhdGUgX3ByaW50UmVzb2x2ZWRLZXliaW5kaW5ncyhvdXRwdXQ6IHN0cmluZ1tdLCBpbnB1dDogc3RyaW5nLCByZXNvbHZlZEtleWJpbmRpbmdzOiBSZXNvbHZlZEtleWJpbmRpbmdbXSk6IHZvaWQge1xuXHRcdGNvbnN0IHBhZExlbmd0aCA9IDM1O1xuXHRcdGNvbnN0IGZpcnN0Um93ID0gYCR7aW5wdXQucGFkU3RhcnQocGFkTGVuZ3RoLCAnICcpfSA9PiBgO1xuXHRcdGlmIChyZXNvbHZlZEtleWJpbmRpbmdzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Ly8gbm8gYmluZGluZyBmb3VuZFxuXHRcdFx0b3V0cHV0LnB1c2goYCR7Zmlyc3RSb3d9JHsnW05PIEJJTkRJTkddJy5wYWRTdGFydChwYWRMZW5ndGgsICcgJyl9YCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlyc3RSb3dJbmRlbnRhdGlvbiA9IGZpcnN0Um93Lmxlbmd0aDtcblx0XHRjb25zdCBpc0ZpcnN0ID0gdHJ1ZTtcblx0XHRmb3IgKGNvbnN0IHJlc29sdmVkS2V5YmluZGluZyBvZiByZXNvbHZlZEtleWJpbmRpbmdzKSB7XG5cdFx0XHRpZiAoaXNGaXJzdCkge1xuXHRcdFx0XHRvdXRwdXQucHVzaChgJHtmaXJzdFJvd30ke3RoaXMuX3ByaW50UmVzb2x2ZWRLZXliaW5kaW5nKHJlc29sdmVkS2V5YmluZGluZykucGFkU3RhcnQocGFkTGVuZ3RoLCAnICcpfWApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b3V0cHV0LnB1c2goYCR7JyAnLnJlcGVhdChmaXJzdFJvd0luZGVudGF0aW9uKX0ke3RoaXMuX3ByaW50UmVzb2x2ZWRLZXliaW5kaW5nKHJlc29sdmVkS2V5YmluZGluZykucGFkU3RhcnQocGFkTGVuZ3RoLCAnICcpfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2R1bXBSZXNvbHZlS2V5YmluZGluZ0RlYnVnSW5mbygpOiBzdHJpbmcge1xuXG5cdFx0Y29uc3Qgc2VlbkJpbmRpbmdzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0Y29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0cmVzdWx0LnB1c2goYERlZmF1bHQgUmVzb2x2ZWQgS2V5YmluZGluZ3MgKHVuaXF1ZSBvbmx5KTpgKTtcblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgS2V5YmluZGluZ3NSZWdpc3RyeS5nZXREZWZhdWx0S2V5YmluZGluZ3MoKSkge1xuXHRcdFx0aWYgKCFpdGVtLmtleWJpbmRpbmcpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpbnB1dCA9IHRoaXMuX3ByaW50S2V5YmluZGluZyhpdGVtLmtleWJpbmRpbmcpO1xuXHRcdFx0aWYgKHNlZW5CaW5kaW5ncy5oYXMoaW5wdXQpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0c2VlbkJpbmRpbmdzLmFkZChpbnB1dCk7XG5cdFx0XHRjb25zdCByZXNvbHZlZEtleWJpbmRpbmdzID0gdGhpcy5fa2V5Ym9hcmRNYXBwZXIucmVzb2x2ZUtleWJpbmRpbmcoaXRlbS5rZXliaW5kaW5nKTtcblx0XHRcdHRoaXMuX3ByaW50UmVzb2x2ZWRLZXliaW5kaW5ncyhyZXN1bHQsIGlucHV0LCByZXNvbHZlZEtleWJpbmRpbmdzKTtcblx0XHR9XG5cblx0XHRyZXN1bHQucHVzaChgVXNlciBSZXNvbHZlZCBLZXliaW5kaW5ncyAodW5pcXVlIG9ubHkpOmApO1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLnVzZXJLZXliaW5kaW5ncy5rZXliaW5kaW5ncykge1xuXHRcdFx0aWYgKCFpdGVtLmtleWJpbmRpbmcpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpbnB1dCA9IGl0ZW0uX3NvdXJjZUtleSA/PyAnSW1wb3NzaWJsZTogbWlzc2luZyBzb3VyY2Uga2V5LCBidXQgaGFzIGtleWJpbmRpbmcnO1xuXHRcdFx0aWYgKHNlZW5CaW5kaW5ncy5oYXMoaW5wdXQpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0c2VlbkJpbmRpbmdzLmFkZChpbnB1dCk7XG5cdFx0XHRjb25zdCByZXNvbHZlZEtleWJpbmRpbmdzID0gdGhpcy5fa2V5Ym9hcmRNYXBwZXIucmVzb2x2ZUtleWJpbmRpbmcoaXRlbS5rZXliaW5kaW5nKTtcblx0XHRcdHRoaXMuX3ByaW50UmVzb2x2ZWRLZXliaW5kaW5ncyhyZXN1bHQsIGlucHV0LCByZXNvbHZlZEtleWJpbmRpbmdzKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0LmpvaW4oJ1xcbicpO1xuXHR9XG5cblx0cHVibGljIF9kdW1wRGVidWdJbmZvKCk6IHN0cmluZyB7XG5cdFx0Y29uc3QgbGF5b3V0SW5mbyA9IEpTT04uc3RyaW5naWZ5KHRoaXMua2V5Ym9hcmRMYXlvdXRTZXJ2aWNlLmdldEN1cnJlbnRLZXlib2FyZExheW91dCgpLCBudWxsLCAnXFx0Jyk7XG5cdFx0Y29uc3QgbWFwcGVySW5mbyA9IHRoaXMuX2tleWJvYXJkTWFwcGVyLmR1bXBEZWJ1Z0luZm8oKTtcblx0XHRjb25zdCByZXNvbHZlZEtleWJpbmRpbmdzID0gdGhpcy5fZHVtcFJlc29sdmVLZXliaW5kaW5nRGVidWdJbmZvKCk7XG5cdFx0Y29uc3QgcmF3TWFwcGluZyA9IEpTT04uc3RyaW5naWZ5KHRoaXMua2V5Ym9hcmRMYXlvdXRTZXJ2aWNlLmdldFJhd0tleWJvYXJkTWFwcGluZygpLCBudWxsLCAnXFx0Jyk7XG5cdFx0cmV0dXJuIGBMYXlvdXQgaW5mbzpcXG4ke2xheW91dEluZm99XFxuXFxuJHtyZXNvbHZlZEtleWJpbmRpbmdzfVxcblxcbiR7bWFwcGVySW5mb31cXG5cXG5SYXcgbWFwcGluZzpcXG4ke3Jhd01hcHBpbmd9YDtcblx0fVxuXG5cdHB1YmxpYyBfZHVtcERlYnVnSW5mb0pTT04oKTogc3RyaW5nIHtcblx0XHRjb25zdCBpbmZvID0ge1xuXHRcdFx0bGF5b3V0OiB0aGlzLmtleWJvYXJkTGF5b3V0U2VydmljZS5nZXRDdXJyZW50S2V5Ym9hcmRMYXlvdXQoKSxcblx0XHRcdHJhd01hcHBpbmc6IHRoaXMua2V5Ym9hcmRMYXlvdXRTZXJ2aWNlLmdldFJhd0tleWJvYXJkTWFwcGluZygpXG5cdFx0fTtcblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoaW5mbywgbnVsbCwgJ1xcdCcpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGVuYWJsZUtleWJpbmRpbmdIb2xkTW9kZShjb21tYW5kSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLl9jdXJyZW50bHlEaXNwYXRjaGluZ0NvbW1hbmRJZCAhPT0gY29tbWFuZElkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzLl9rZXliaW5kaW5nSG9sZE1vZGUgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdFx0Y29uc3QgZm9jdXNUcmFja2VyID0gZG9tLnRyYWNrRm9jdXMoZG9tLmdldFdpbmRvdyh1bmRlZmluZWQpKTtcblx0XHRjb25zdCBsaXN0ZW5lciA9IGZvY3VzVHJhY2tlci5vbkRpZEJsdXIoKCkgPT4gdGhpcy5fcmVzZXRLZXliaW5kaW5nSG9sZE1vZGUoKSk7XG5cdFx0dGhpcy5fa2V5YmluZGluZ0hvbGRNb2RlLnAuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRsaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHRmb2N1c1RyYWNrZXIuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHRcdHRoaXMuX2xvZyhgKyBFbmFibGVkIGhvbGQtbW9kZSBmb3IgJHtjb21tYW5kSWR9LmApO1xuXHRcdHJldHVybiB0aGlzLl9rZXliaW5kaW5nSG9sZE1vZGUucDtcblx0fVxuXG5cdHByaXZhdGUgX3Jlc2V0S2V5YmluZGluZ0hvbGRNb2RlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9rZXliaW5kaW5nSG9sZE1vZGUpIHtcblx0XHRcdHRoaXMuX2tleWJpbmRpbmdIb2xkTW9kZT8uY29tcGxldGUoKTtcblx0XHRcdHRoaXMuX2tleWJpbmRpbmdIb2xkTW9kZSA9IG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGN1c3RvbUtleWJpbmRpbmdzQ291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy51c2VyS2V5YmluZGluZ3Mua2V5YmluZGluZ3MubGVuZ3RoO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVSZXNvbHZlcigpOiB2b2lkIHtcblx0XHR0aGlzLl9jYWNoZWRSZXNvbHZlciA9IG51bGw7XG5cdFx0dGhpcy5fb25EaWRVcGRhdGVLZXliaW5kaW5ncy5maXJlKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldFJlc29sdmVyKCk6IEtleWJpbmRpbmdSZXNvbHZlciB7XG5cdFx0aWYgKCF0aGlzLl9jYWNoZWRSZXNvbHZlcikge1xuXHRcdFx0Y29uc3QgZGVmYXVsdHMgPSB0aGlzLl9yZXNvbHZlS2V5YmluZGluZ0l0ZW1zKEtleWJpbmRpbmdzUmVnaXN0cnkuZ2V0RGVmYXVsdEtleWJpbmRpbmdzKCksIHRydWUpO1xuXHRcdFx0Y29uc3Qgb3ZlcnJpZGVzID0gdGhpcy5fcmVzb2x2ZVVzZXJLZXliaW5kaW5nSXRlbXModGhpcy51c2VyS2V5YmluZGluZ3Mua2V5YmluZGluZ3MsIGZhbHNlKTtcblx0XHRcdHRoaXMuX2NhY2hlZFJlc29sdmVyID0gbmV3IEtleWJpbmRpbmdSZXNvbHZlcihkZWZhdWx0cywgb3ZlcnJpZGVzLCAoc3RyKSA9PiB0aGlzLl9sb2coc3RyKSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9jYWNoZWRSZXNvbHZlcjtcblx0fVxuXG5cdHByb3RlY3RlZCBfZG9jdW1lbnRIYXNGb2N1cygpOiBib29sZWFuIHtcblx0XHQvLyBpdCBpcyBwb3NzaWJsZSB0aGF0IHRoZSBkb2N1bWVudCBoYXMgbG9zdCBmb2N1cywgYnV0IHRoZVxuXHRcdC8vIHdpbmRvdyBpcyBzdGlsbCBmb2N1c2VkLCBlLmcuIHdoZW4gYSA8d2Vidmlldz4gZWxlbWVudFxuXHRcdC8vIGhhcyBmb2N1c1xuXHRcdHJldHVybiB0aGlzLmhvc3RTZXJ2aWNlLmhhc0ZvY3VzO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVzb2x2ZUtleWJpbmRpbmdJdGVtcyhpdGVtczogSUtleWJpbmRpbmdJdGVtW10sIGlzRGVmYXVsdDogYm9vbGVhbik6IFJlc29sdmVkS2V5YmluZGluZ0l0ZW1bXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBSZXNvbHZlZEtleWJpbmRpbmdJdGVtW10gPSBbXTtcblx0XHRsZXQgcmVzdWx0TGVuID0gMDtcblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcblx0XHRcdGNvbnN0IHdoZW4gPSBpdGVtLndoZW4gfHwgdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3Qga2V5YmluZGluZyA9IGl0ZW0ua2V5YmluZGluZztcblx0XHRcdGlmICgha2V5YmluZGluZykge1xuXHRcdFx0XHQvLyBUaGlzIG1pZ2h0IGJlIGEgcmVtb3ZhbCBrZXliaW5kaW5nIGl0ZW0gaW4gdXNlciBzZXR0aW5ncyA9PiBhY2NlcHQgaXRcblx0XHRcdFx0cmVzdWx0W3Jlc3VsdExlbisrXSA9IG5ldyBSZXNvbHZlZEtleWJpbmRpbmdJdGVtKHVuZGVmaW5lZCwgaXRlbS5jb21tYW5kLCBpdGVtLmNvbW1hbmRBcmdzLCB3aGVuLCBpc0RlZmF1bHQsIGl0ZW0uZXh0ZW5zaW9uSWQsIGl0ZW0uaXNCdWlsdGluRXh0ZW5zaW9uKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICh0aGlzLl9hc3NlcnRCcm93c2VyQ29uZmxpY3RzKGtleWJpbmRpbmcpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCByZXNvbHZlZEtleWJpbmRpbmdzID0gdGhpcy5fa2V5Ym9hcmRNYXBwZXIucmVzb2x2ZUtleWJpbmRpbmcoa2V5YmluZGluZyk7XG5cdFx0XHRcdGZvciAobGV0IGkgPSByZXNvbHZlZEtleWJpbmRpbmdzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzb2x2ZWRLZXliaW5kaW5nID0gcmVzb2x2ZWRLZXliaW5kaW5nc1tpXTtcblx0XHRcdFx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gbmV3IFJlc29sdmVkS2V5YmluZGluZ0l0ZW0ocmVzb2x2ZWRLZXliaW5kaW5nLCBpdGVtLmNvbW1hbmQsIGl0ZW0uY29tbWFuZEFyZ3MsIHdoZW4sIGlzRGVmYXVsdCwgaXRlbS5leHRlbnNpb25JZCwgaXRlbS5pc0J1aWx0aW5FeHRlbnNpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgX3Jlc29sdmVVc2VyS2V5YmluZGluZ0l0ZW1zKGl0ZW1zOiBJVXNlcktleWJpbmRpbmdJdGVtW10sIGlzRGVmYXVsdDogYm9vbGVhbik6IFJlc29sdmVkS2V5YmluZGluZ0l0ZW1bXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBSZXNvbHZlZEtleWJpbmRpbmdJdGVtW10gPSBbXTtcblx0XHRsZXQgcmVzdWx0TGVuID0gMDtcblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcblx0XHRcdGNvbnN0IHdoZW4gPSBpdGVtLndoZW4gfHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKCFpdGVtLmtleWJpbmRpbmcpIHtcblx0XHRcdFx0Ly8gVGhpcyBtaWdodCBiZSBhIHJlbW92YWwga2V5YmluZGluZyBpdGVtIGluIHVzZXIgc2V0dGluZ3MgPT4gYWNjZXB0IGl0XG5cdFx0XHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSBuZXcgUmVzb2x2ZWRLZXliaW5kaW5nSXRlbSh1bmRlZmluZWQsIGl0ZW0uY29tbWFuZCwgaXRlbS5jb21tYW5kQXJncywgd2hlbiwgaXNEZWZhdWx0LCBudWxsLCBmYWxzZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCByZXNvbHZlZEtleWJpbmRpbmdzID0gdGhpcy5fa2V5Ym9hcmRNYXBwZXIucmVzb2x2ZUtleWJpbmRpbmcoaXRlbS5rZXliaW5kaW5nKTtcblx0XHRcdFx0Zm9yIChjb25zdCByZXNvbHZlZEtleWJpbmRpbmcgb2YgcmVzb2x2ZWRLZXliaW5kaW5ncykge1xuXHRcdFx0XHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSBuZXcgUmVzb2x2ZWRLZXliaW5kaW5nSXRlbShyZXNvbHZlZEtleWJpbmRpbmcsIGl0ZW0uY29tbWFuZCwgaXRlbS5jb21tYW5kQXJncywgd2hlbiwgaXNEZWZhdWx0LCBudWxsLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBfYXNzZXJ0QnJvd3NlckNvbmZsaWN0cyhrZXliaW5kaW5nOiBLZXliaW5kaW5nKTogYm9vbGVhbiB7XG5cdFx0aWYgKEJyb3dzZXJGZWF0dXJlcy5rZXlib2FyZCA9PT0gS2V5Ym9hcmRTdXBwb3J0LkFsd2F5cykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmIChCcm93c2VyRmVhdHVyZXMua2V5Ym9hcmQgPT09IEtleWJvYXJkU3VwcG9ydC5GdWxsU2NyZWVuICYmIGJyb3dzZXIuaXNGdWxsc2NyZWVuKG1haW5XaW5kb3cpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBjaG9yZCBvZiBrZXliaW5kaW5nLmNob3Jkcykge1xuXHRcdFx0aWYgKCFjaG9yZC5tZXRhS2V5ICYmICFjaG9yZC5hbHRLZXkgJiYgIWNob3JkLmN0cmxLZXkgJiYgIWNob3JkLnNoaWZ0S2V5KSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtb2RpZmllcnNNYXNrID0gS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5TW9kLlNoaWZ0O1xuXG5cdFx0XHRsZXQgcGFydE1vZGlmaWVyc01hc2sgPSAwO1xuXHRcdFx0aWYgKGNob3JkLm1ldGFLZXkpIHtcblx0XHRcdFx0cGFydE1vZGlmaWVyc01hc2sgfD0gS2V5TW9kLkN0cmxDbWQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjaG9yZC5zaGlmdEtleSkge1xuXHRcdFx0XHRwYXJ0TW9kaWZpZXJzTWFzayB8PSBLZXlNb2QuU2hpZnQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjaG9yZC5hbHRLZXkpIHtcblx0XHRcdFx0cGFydE1vZGlmaWVyc01hc2sgfD0gS2V5TW9kLkFsdDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNob3JkLmN0cmxLZXkgJiYgT1MgPT09IE9wZXJhdGluZ1N5c3RlbS5NYWNpbnRvc2gpIHtcblx0XHRcdFx0cGFydE1vZGlmaWVyc01hc2sgfD0gS2V5TW9kLldpbkN0cmw7XG5cdFx0XHR9XG5cblx0XHRcdGlmICgocGFydE1vZGlmaWVyc01hc2sgJiBtb2RpZmllcnNNYXNrKSA9PT0gKEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCkpIHtcblx0XHRcdFx0aWYgKGNob3JkIGluc3RhbmNlb2YgU2NhbkNvZGVDaG9yZCAmJiAoY2hvcmQuc2NhbkNvZGUgPT09IFNjYW5Db2RlLkFycm93TGVmdCB8fCBjaG9yZC5zY2FuQ29kZSA9PT0gU2NhbkNvZGUuQXJyb3dSaWdodCkpIHtcblx0XHRcdFx0XHQvLyBjb25zb2xlLndhcm4oJ0N0cmwvQ21kK0Fycm93IGtleWJpbmRpbmdzIHNob3VsZCBub3QgYmUgdXNlZCBieSBkZWZhdWx0IGluIHdlYi4gT2ZmZW5kZXI6ICcsIGtiLmdldEhhc2hDb2RlKCksICcgZm9yICcsIGNvbW1hbmRJZCk7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGNob3JkIGluc3RhbmNlb2YgS2V5Q29kZUNob3JkICYmIChjaG9yZC5rZXlDb2RlID09PSBLZXlDb2RlLkxlZnRBcnJvdyB8fCBjaG9yZC5rZXlDb2RlID09PSBLZXlDb2RlLlJpZ2h0QXJyb3cpKSB7XG5cdFx0XHRcdFx0Ly8gY29uc29sZS53YXJuKCdDdHJsL0NtZCtBcnJvdyBrZXliaW5kaW5ncyBzaG91bGQgbm90IGJlIHVzZWQgYnkgZGVmYXVsdCBpbiB3ZWIuIE9mZmVuZGVyOiAnLCBrYi5nZXRIYXNoQ29kZSgpLCAnIGZvciAnLCBjb21tYW5kSWQpO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICgocGFydE1vZGlmaWVyc01hc2sgJiBtb2RpZmllcnNNYXNrKSA9PT0gS2V5TW9kLkN0cmxDbWQpIHtcblx0XHRcdFx0aWYgKGNob3JkIGluc3RhbmNlb2YgU2NhbkNvZGVDaG9yZCAmJiAoY2hvcmQuc2NhbkNvZGUgPj0gU2NhbkNvZGUuRGlnaXQxICYmIGNob3JkLnNjYW5Db2RlIDw9IFNjYW5Db2RlLkRpZ2l0MCkpIHtcblx0XHRcdFx0XHQvLyBjb25zb2xlLndhcm4oJ0N0cmwvQ21kK051bSBrZXliaW5kaW5ncyBzaG91bGQgbm90IGJlIHVzZWQgYnkgZGVmYXVsdCBpbiB3ZWIuIE9mZmVuZGVyOiAnLCBrYi5nZXRIYXNoQ29kZSgpLCAnIGZvciAnLCBjb21tYW5kSWQpO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChjaG9yZCBpbnN0YW5jZW9mIEtleUNvZGVDaG9yZCAmJiAoY2hvcmQua2V5Q29kZSA+PSBLZXlDb2RlLkRpZ2l0MCAmJiBjaG9yZC5rZXlDb2RlIDw9IEtleUNvZGUuRGlnaXQ5KSkge1xuXHRcdFx0XHRcdC8vIGNvbnNvbGUud2FybignQ3RybC9DbWQrTnVtIGtleWJpbmRpbmdzIHNob3VsZCBub3QgYmUgdXNlZCBieSBkZWZhdWx0IGluIHdlYi4gT2ZmZW5kZXI6ICcsIGtiLmdldEhhc2hDb2RlKCksICcgZm9yICcsIGNvbW1hbmRJZCk7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgcmVzb2x2ZUtleWJpbmRpbmcoa2I6IEtleWJpbmRpbmcpOiBSZXNvbHZlZEtleWJpbmRpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2tleWJvYXJkTWFwcGVyLnJlc29sdmVLZXliaW5kaW5nKGtiKTtcblx0fVxuXG5cdHB1YmxpYyByZXNvbHZlS2V5Ym9hcmRFdmVudChrZXlib2FyZEV2ZW50OiBJS2V5Ym9hcmRFdmVudCk6IFJlc29sdmVkS2V5YmluZGluZyB7XG5cdFx0dGhpcy5rZXlib2FyZExheW91dFNlcnZpY2UudmFsaWRhdGVDdXJyZW50S2V5Ym9hcmRNYXBwaW5nKGtleWJvYXJkRXZlbnQpO1xuXHRcdHJldHVybiB0aGlzLl9rZXlib2FyZE1hcHBlci5yZXNvbHZlS2V5Ym9hcmRFdmVudChrZXlib2FyZEV2ZW50KTtcblx0fVxuXG5cdHB1YmxpYyByZXNvbHZlVXNlckJpbmRpbmcodXNlckJpbmRpbmc6IHN0cmluZyk6IFJlc29sdmVkS2V5YmluZGluZ1tdIHtcblx0XHRjb25zdCBrZXliaW5kaW5nID0gS2V5YmluZGluZ1BhcnNlci5wYXJzZUtleWJpbmRpbmcodXNlckJpbmRpbmcpO1xuXHRcdHJldHVybiAoa2V5YmluZGluZyA/IHRoaXMuX2tleWJvYXJkTWFwcGVyLnJlc29sdmVLZXliaW5kaW5nKGtleWJpbmRpbmcpIDogW10pO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGFuZGxlS2V5YmluZGluZ3NFeHRlbnNpb25Qb2ludFVzZXIoZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIsIGlzQnVpbHRpbjogYm9vbGVhbiwga2V5YmluZGluZ3M6IENvbnRyaWJ1dGVkS2V5QmluZGluZyB8IENvbnRyaWJ1dGVkS2V5QmluZGluZ1tdLCBjb2xsZWN0b3I6IEV4dGVuc2lvbk1lc3NhZ2VDb2xsZWN0b3IsIHJlc3VsdDogSUV4dGVuc2lvbktleWJpbmRpbmdSdWxlW10pOiB2b2lkIHtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShrZXliaW5kaW5ncykpIHtcblx0XHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBrZXliaW5kaW5ncy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHR0aGlzLl9oYW5kbGVLZXliaW5kaW5nKGV4dGVuc2lvbklkLCBpc0J1aWx0aW4sIGkgKyAxLCBrZXliaW5kaW5nc1tpXSwgY29sbGVjdG9yLCByZXN1bHQpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9oYW5kbGVLZXliaW5kaW5nKGV4dGVuc2lvbklkLCBpc0J1aWx0aW4sIDEsIGtleWJpbmRpbmdzLCBjb2xsZWN0b3IsIHJlc3VsdCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfaGFuZGxlS2V5YmluZGluZyhleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciwgaXNCdWlsdGluOiBib29sZWFuLCBpZHg6IG51bWJlciwga2V5YmluZGluZ3M6IENvbnRyaWJ1dGVkS2V5QmluZGluZywgY29sbGVjdG9yOiBFeHRlbnNpb25NZXNzYWdlQ29sbGVjdG9yLCByZXN1bHQ6IElFeHRlbnNpb25LZXliaW5kaW5nUnVsZVtdKTogdm9pZCB7XG5cblx0XHRjb25zdCByZWplY3RzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0aWYgKGlzVmFsaWRDb250cmlidXRlZEtleUJpbmRpbmcoa2V5YmluZGluZ3MsIHJlamVjdHMpKSB7XG5cdFx0XHRjb25zdCBydWxlID0gdGhpcy5fYXNDb21tYW5kUnVsZShleHRlbnNpb25JZCwgaXNCdWlsdGluLCBpZHgrKywga2V5YmluZGluZ3MpO1xuXHRcdFx0aWYgKHJ1bGUpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2gocnVsZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHJlamVjdHMubGVuZ3RoID4gMCkge1xuXHRcdFx0Y29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZShcblx0XHRcdFx0J2ludmFsaWQua2V5YmluZGluZ3MnLFxuXHRcdFx0XHRcIkludmFsaWQgYGNvbnRyaWJ1dGVzLnswfWA6IHsxfVwiLFxuXHRcdFx0XHRrZXliaW5kaW5nc0V4dFBvaW50Lm5hbWUsXG5cdFx0XHRcdHJlamVjdHMuam9pbignXFxuJylcblx0XHRcdCkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIGJpbmRUb0N1cnJlbnRQbGF0Zm9ybShrZXk6IHN0cmluZyB8IHVuZGVmaW5lZCwgbWFjOiBzdHJpbmcgfCB1bmRlZmluZWQsIGxpbnV4OiBzdHJpbmcgfCB1bmRlZmluZWQsIHdpbjogc3RyaW5nIHwgdW5kZWZpbmVkKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoT1MgPT09IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzICYmIHdpbikge1xuXHRcdFx0aWYgKHdpbikge1xuXHRcdFx0XHRyZXR1cm4gd2luO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoT1MgPT09IE9wZXJhdGluZ1N5c3RlbS5NYWNpbnRvc2gpIHtcblx0XHRcdGlmIChtYWMpIHtcblx0XHRcdFx0cmV0dXJuIG1hYztcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGxpbnV4KSB7XG5cdFx0XHRcdHJldHVybiBsaW51eDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGtleTtcblx0fVxuXG5cdHByaXZhdGUgX2FzQ29tbWFuZFJ1bGUoZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIsIGlzQnVpbHRpbjogYm9vbGVhbiwgaWR4OiBudW1iZXIsIGJpbmRpbmc6IENvbnRyaWJ1dGVkS2V5QmluZGluZyk6IElFeHRlbnNpb25LZXliaW5kaW5nUnVsZSB8IHVuZGVmaW5lZCB7XG5cblx0XHRjb25zdCB7IGNvbW1hbmQsIGFyZ3MsIHdoZW4sIGtleSwgbWFjLCBsaW51eCwgd2luIH0gPSBiaW5kaW5nO1xuXHRcdGNvbnN0IGtleWJpbmRpbmcgPSBXb3JrYmVuY2hLZXliaW5kaW5nU2VydmljZS5iaW5kVG9DdXJyZW50UGxhdGZvcm0oa2V5LCBtYWMsIGxpbnV4LCB3aW4pO1xuXHRcdGlmICgha2V5YmluZGluZykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRsZXQgd2VpZ2h0OiBudW1iZXI7XG5cdFx0aWYgKGlzQnVpbHRpbikge1xuXHRcdFx0d2VpZ2h0ID0gS2V5YmluZGluZ1dlaWdodC5CdWlsdGluRXh0ZW5zaW9uICsgaWR4O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR3ZWlnaHQgPSBLZXliaW5kaW5nV2VpZ2h0LkV4dGVybmFsRXh0ZW5zaW9uICsgaWR4O1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbW1hbmRBY3Rpb24gPSBNZW51UmVnaXN0cnkuZ2V0Q29tbWFuZChjb21tYW5kKTtcblx0XHRjb25zdCBwcmVjb25kaXRpb24gPSBjb21tYW5kQWN0aW9uICYmIGNvbW1hbmRBY3Rpb24ucHJlY29uZGl0aW9uO1xuXHRcdGxldCBmdWxsV2hlbjogQ29udGV4dEtleUV4cHJlc3Npb24gfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHdoZW4gJiYgcHJlY29uZGl0aW9uKSB7XG5cdFx0XHRmdWxsV2hlbiA9IENvbnRleHRLZXlFeHByLmFuZChwcmVjb25kaXRpb24sIENvbnRleHRLZXlFeHByLmRlc2VyaWFsaXplKHdoZW4pKTtcblx0XHR9IGVsc2UgaWYgKHdoZW4pIHtcblx0XHRcdGZ1bGxXaGVuID0gQ29udGV4dEtleUV4cHIuZGVzZXJpYWxpemUod2hlbik7XG5cdFx0fSBlbHNlIGlmIChwcmVjb25kaXRpb24pIHtcblx0XHRcdGZ1bGxXaGVuID0gcHJlY29uZGl0aW9uO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlc2M6IElFeHRlbnNpb25LZXliaW5kaW5nUnVsZSA9IHtcblx0XHRcdGlkOiBjb21tYW5kLFxuXHRcdFx0YXJncyxcblx0XHRcdHdoZW46IGZ1bGxXaGVuLFxuXHRcdFx0d2VpZ2h0OiB3ZWlnaHQsXG5cdFx0XHRrZXliaW5kaW5nOiBLZXliaW5kaW5nUGFyc2VyLnBhcnNlS2V5YmluZGluZyhrZXliaW5kaW5nKSxcblx0XHRcdGV4dGVuc2lvbklkOiBleHRlbnNpb25JZC52YWx1ZSxcblx0XHRcdGlzQnVpbHRpbkV4dGVuc2lvbjogaXNCdWlsdGluXG5cdFx0fTtcblx0XHRyZXR1cm4gZGVzYztcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBnZXREZWZhdWx0S2V5YmluZGluZ3NDb250ZW50KCk6IHN0cmluZyB7XG5cdFx0Y29uc3QgcmVzb2x2ZXIgPSB0aGlzLl9nZXRSZXNvbHZlcigpO1xuXHRcdGNvbnN0IGRlZmF1bHRLZXliaW5kaW5ncyA9IHJlc29sdmVyLmdldERlZmF1bHRLZXliaW5kaW5ncygpO1xuXHRcdGNvbnN0IGJvdW5kQ29tbWFuZHMgPSByZXNvbHZlci5nZXREZWZhdWx0Qm91bmRDb21tYW5kcygpO1xuXHRcdHJldHVybiAoXG5cdFx0XHRXb3JrYmVuY2hLZXliaW5kaW5nU2VydmljZS5fZ2V0RGVmYXVsdEtleWJpbmRpbmdzKGRlZmF1bHRLZXliaW5kaW5ncylcblx0XHRcdCsgJ1xcblxcbidcblx0XHRcdCsgV29ya2JlbmNoS2V5YmluZGluZ1NlcnZpY2UuX2dldEFsbENvbW1hbmRzQXNDb21tZW50KGJvdW5kQ29tbWFuZHMpXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9nZXREZWZhdWx0S2V5YmluZGluZ3MoZGVmYXVsdEtleWJpbmRpbmdzOiByZWFkb25seSBSZXNvbHZlZEtleWJpbmRpbmdJdGVtW10pOiBzdHJpbmcge1xuXHRcdGNvbnN0IG91dCA9IG5ldyBPdXRwdXRCdWlsZGVyKCk7XG5cdFx0b3V0LndyaXRlTGluZSgnWycpO1xuXG5cdFx0Y29uc3QgbGFzdEluZGV4ID0gZGVmYXVsdEtleWJpbmRpbmdzLmxlbmd0aCAtIDE7XG5cdFx0ZGVmYXVsdEtleWJpbmRpbmdzLmZvckVhY2goKGssIGluZGV4KSA9PiB7XG5cdFx0XHRLZXliaW5kaW5nSU8ud3JpdGVLZXliaW5kaW5nSXRlbShvdXQsIGspO1xuXHRcdFx0aWYgKGluZGV4ICE9PSBsYXN0SW5kZXgpIHtcblx0XHRcdFx0b3V0LndyaXRlTGluZSgnLCcpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b3V0LndyaXRlTGluZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdG91dC53cml0ZUxpbmUoJ10nKTtcblx0XHRyZXR1cm4gb3V0LnRvU3RyaW5nKCk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfZ2V0QWxsQ29tbWFuZHNBc0NvbW1lbnQoYm91bmRDb21tYW5kczogTWFwPHN0cmluZywgYm9vbGVhbj4pOiBzdHJpbmcge1xuXHRcdGNvbnN0IHVuYm91bmRDb21tYW5kcyA9IGdldEFsbFVuYm91bmRDb21tYW5kcyhib3VuZENvbW1hbmRzKTtcblx0XHRjb25zdCBwcmV0dHkgPSB1bmJvdW5kQ29tbWFuZHMuc29ydCgpLmpvaW4oJ1xcbi8vIC0gJyk7XG5cdFx0cmV0dXJuICcvLyAnICsgbmxzLmxvY2FsaXplKCd1bmJvdW5kQ29tbWFuZHMnLCBcIkhlcmUgYXJlIG90aGVyIGF2YWlsYWJsZSBjb21tYW5kczogXCIpICsgJ1xcbi8vIC0gJyArIHByZXR0eTtcblx0fVxuXG5cdG92ZXJyaWRlIG1pZ2h0UHJvZHVjZVByaW50YWJsZUNoYXJhY3RlcihldmVudDogSUtleWJvYXJkRXZlbnQpOiBib29sZWFuIHtcblx0XHRpZiAoZXZlbnQuY3RybEtleSB8fCBldmVudC5tZXRhS2V5IHx8IGV2ZW50LmFsdEtleSkge1xuXHRcdFx0Ly8gaWdub3JlIGN0cmwvY21kL2FsdC1jb21iaW5hdGlvbiBidXQgbm90IHNoaWZ0LWNvbWJpbmF0aW9zXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGNvbnN0IGNvZGUgPSBTY2FuQ29kZVV0aWxzLnRvRW51bShldmVudC5jb2RlKTtcblxuXHRcdGlmIChOVU1QQURfUFJJTlRBQkxFX1NDQU5DT0RFUy5pbmRleE9mKGNvZGUpICE9PSAtMSkge1xuXHRcdFx0Ly8gVGhpcyBpcyBhIG51bXBhZCBrZXkgdGhhdCBtaWdodCBwcm9kdWNlIGEgcHJpbnRhYmxlIGNoYXJhY3RlciBiYXNlZCBvbiBOdW1Mb2NrLlxuXHRcdFx0Ly8gTGV0J3MgY2hlY2sgaWYgTnVtTG9jayBpcyBvbiBvciBvZmYgYmFzZWQgb24gdGhlIGV2ZW50J3Mga2V5Q29kZS5cblx0XHRcdC8vIGUuZy5cblx0XHRcdC8vIC0gd2hlbiBOdW1Mb2NrIGlzIG9mZiwgU2NhbkNvZGUuTnVtcGFkNCBwcm9kdWNlcyBLZXlDb2RlLkxlZnRBcnJvd1xuXHRcdFx0Ly8gLSB3aGVuIE51bUxvY2sgaXMgb24sIFNjYW5Db2RlLk51bXBhZDQgcHJvZHVjZXMgS2V5Q29kZS5OVU1QQURfNFxuXHRcdFx0Ly8gSG93ZXZlciwgU2NhbkNvZGUuTnVtcGFkQWRkIGFsd2F5cyBwcm9kdWNlcyBLZXlDb2RlLk5VTVBBRF9BRERcblx0XHRcdGlmIChldmVudC5rZXlDb2RlID09PSBJTU1VVEFCTEVfQ09ERV9UT19LRVlfQ09ERVtjb2RlXSkge1xuXHRcdFx0XHQvLyBOdW1Mb2NrIGlzIG9uIG9yIHRoaXMgaXMgLywgKiwgLSwgKyBvbiB0aGUgbnVtcGFkXG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGlzTWFjaW50b3NoICYmIGV2ZW50LmtleUNvZGUgPT09IG90aGVyTWFjTnVtcGFkTWFwcGluZy5nZXQoY29kZSkpIHtcblx0XHRcdFx0Ly8gb24gbWFjT1MsIHRoZSBudW1wYWQga2V5cyBjYW4gYWxzbyBtYXAgdG8ga2V5cyAxIC0gMC5cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3Qga2V5Y29kZSA9IElNTVVUQUJMRV9DT0RFX1RPX0tFWV9DT0RFW2NvZGVdO1xuXHRcdGlmIChrZXljb2RlICE9PSAtMSkge1xuXHRcdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzc0OTM0XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdC8vIGNvbnN1bHQgdGhlIEtleWJvYXJkTWFwcGVyRmFjdG9yeSB0byBjaGVjayB0aGUgZ2l2ZW4gZXZlbnQgZm9yXG5cdFx0Ly8gYSBwcmludGFibGUgdmFsdWUuXG5cdFx0Y29uc3QgbWFwcGluZyA9IHRoaXMua2V5Ym9hcmRMYXlvdXRTZXJ2aWNlLmdldFJhd0tleWJvYXJkTWFwcGluZygpO1xuXHRcdGlmICghbWFwcGluZykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBrZXlJbmZvID0gbWFwcGluZ1tldmVudC5jb2RlXTtcblx0XHRpZiAoIWtleUluZm8pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCFrZXlJbmZvLnZhbHVlIHx8IC9cXHMvLnRlc3Qoa2V5SW5mby52YWx1ZSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cbn1cblxuY2xhc3MgVXNlcktleWJpbmRpbmdzIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBfcmF3S2V5YmluZGluZ3M6IE9iamVjdFtdID0gW107XG5cdHByaXZhdGUgX2tleWJpbmRpbmdzOiBJVXNlcktleWJpbmRpbmdJdGVtW10gPSBbXTtcblx0Z2V0IGtleWJpbmRpbmdzKCk6IElVc2VyS2V5YmluZGluZ0l0ZW1bXSB7IHJldHVybiB0aGlzLl9rZXliaW5kaW5nczsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgcmVsb2FkQ29uZmlndXJhdGlvblNjaGVkdWxlcjogUnVuT25jZVNjaGVkdWxlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHdhdGNoRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlOiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy53YXRjaCgpO1xuXG5cdFx0dGhpcy5yZWxvYWRDb25maWd1cmF0aW9uU2NoZWR1bGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4gdGhpcy5yZWxvYWQoKS50aGVuKGNoYW5nZWQgPT4ge1xuXHRcdFx0aWYgKGNoYW5nZWQpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSgpO1xuXHRcdFx0fVxuXHRcdH0pLCA1MCkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZmlsdGVyKHRoaXMuZmlsZVNlcnZpY2Uub25EaWRGaWxlc0NoYW5nZSwgZSA9PiBlLmNvbnRhaW5zKHRoaXMudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5rZXliaW5kaW5nc1Jlc291cmNlKSkoKCkgPT4ge1xuXHRcdFx0bG9nU2VydmljZS5kZWJ1ZygnS2V5YmluZGluZ3MgZmlsZSBjaGFuZ2VkJyk7XG5cdFx0XHR0aGlzLnJlbG9hZENvbmZpZ3VyYXRpb25TY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkUnVuT3BlcmF0aW9uKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5vcGVyYXRpb24gPT09IEZpbGVPcGVyYXRpb24uV1JJVEUgJiYgZS5yZXNvdXJjZS50b1N0cmluZygpID09PSB0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUua2V5YmluZGluZ3NSZXNvdXJjZS50b1N0cmluZygpKSB7XG5cdFx0XHRcdGxvZ1NlcnZpY2UuZGVidWcoJ0tleWJpbmRpbmdzIGZpbGUgd3JpdHRlbicpO1xuXHRcdFx0XHR0aGlzLnJlbG9hZENvbmZpZ3VyYXRpb25TY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLm9uRGlkQ2hhbmdlQ3VycmVudFByb2ZpbGUoZSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGUucHJldmlvdXMua2V5YmluZGluZ3NSZXNvdXJjZSwgZS5wcm9maWxlLmtleWJpbmRpbmdzUmVzb3VyY2UpKSB7XG5cdFx0XHRcdGUuam9pbih0aGlzLndoZW5DdXJyZW50UHJvZmlsZUNoYW5nZWQoKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB3aGVuQ3VycmVudFByb2ZpbGVDaGFuZ2VkKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMud2F0Y2goKTtcblx0XHR0aGlzLnJlbG9hZENvbmZpZ3VyYXRpb25TY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0fVxuXG5cdHByaXZhdGUgd2F0Y2goKTogdm9pZCB7XG5cdFx0dGhpcy53YXRjaERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy53YXRjaERpc3Bvc2FibGVzLmFkZCh0aGlzLmZpbGVTZXJ2aWNlLndhdGNoKGRpcm5hbWUodGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmtleWJpbmRpbmdzUmVzb3VyY2UpKSk7XG5cdFx0Ly8gQWxzbyBsaXN0ZW4gdG8gdGhlIHJlc291cmNlIGluY2FzZSB0aGUgcmVzb3VyY2UgaXMgYSBzeW1saW5rIC0gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzExODEzNFxuXHRcdHRoaXMud2F0Y2hEaXNwb3NhYmxlcy5hZGQodGhpcy5maWxlU2VydmljZS53YXRjaCh0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUua2V5YmluZGluZ3NSZXNvdXJjZSkpO1xuXHR9XG5cblx0YXN5bmMgaW5pdGlhbGl6ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLnJlbG9hZCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWxvYWQoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgbmV3S2V5YmluZGluZ3MgPSBhd2FpdCB0aGlzLnJlYWRVc2VyS2V5YmluZGluZ3MoKTtcblx0XHRpZiAob2JqZWN0cy5lcXVhbHModGhpcy5fcmF3S2V5YmluZGluZ3MsIG5ld0tleWJpbmRpbmdzKSkge1xuXHRcdFx0Ly8gbm8gY2hhbmdlXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmF3S2V5YmluZGluZ3MgPSBuZXdLZXliaW5kaW5ncztcblx0XHR0aGlzLl9rZXliaW5kaW5ncyA9IHRoaXMuX3Jhd0tleWJpbmRpbmdzLm1hcCgoaykgPT4gS2V5YmluZGluZ0lPLnJlYWRVc2VyS2V5YmluZGluZ0l0ZW0oaykpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWFkVXNlcktleWJpbmRpbmdzKCk6IFByb21pc2U8T2JqZWN0W10+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVhZEZpbGUodGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmtleWJpbmRpbmdzUmVzb3VyY2UpO1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBwYXJzZShjb250ZW50LnZhbHVlLnRvU3RyaW5nKCkpO1xuXHRcdFx0cmV0dXJuIEFycmF5LmlzQXJyYXkodmFsdWUpXG5cdFx0XHRcdD8gdmFsdWUuZmlsdGVyKHYgPT4gdiAmJiB0eXBlb2YgdiA9PT0gJ29iamVjdCcgLyoganVzdCB0eXBlb2YgPT09IG9iamVjdCBkb2Vzbid0IGNhdGNoIGBudWxsYCAqLylcblx0XHRcdFx0OiBbXTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHR9XG59XG5cbi8qKlxuICogUmVnaXN0ZXJzIHRoZSBga2V5YmluZGluZ3MuanNvbmAncyBzY2hlbWEgd2l0aCB0aGUgSlNPTiBzY2hlbWEgcmVnaXN0cnkuIEFsbG93cyB1cGRhdGluZyB0aGUgc2NoZW1hLCBlLmcuLCB3aGVuIG5ldyBjb21tYW5kcyBhcmUgcmVnaXN0ZXJlZCAoZS5nLiwgYnkgZXh0ZW5zaW9ucykuXG4gKlxuICogTGlmZWN5Y2xlIG93bmVkIGJ5IGBXb3JrYmVuY2hLZXliaW5kaW5nU2VydmljZWAuIE11c3QgYmUgaW5zdGFudGlhdGVkIG9ubHkgb25jZS5cbiAqL1xuY2xhc3MgS2V5YmluZGluZ3NKc29uU2NoZW1hIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBzY2hlbWFJZCA9ICd2c2NvZGU6Ly9zY2hlbWFzL2tleWJpbmRpbmdzJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRzU2NoZW1hczogSUpTT05TY2hlbWFbXSA9IFtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRzRW51bTogc3RyaW5nW10gPSBbXTtcblx0cHJpdmF0ZSByZWFkb25seSByZW1vdmFsQ29tbWFuZHNFbnVtOiBzdHJpbmdbXSA9IFtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRzRW51bURlc2NyaXB0aW9uczogKHN0cmluZyB8IHVuZGVmaW5lZClbXSA9IFtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IHNjaGVtYTogSUpTT05TY2hlbWEgPSB7XG5cdFx0aWQ6IEtleWJpbmRpbmdzSnNvblNjaGVtYS5zY2hlbWFJZCxcblx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2tleWJpbmRpbmdzLmpzb24udGl0bGUnLCBcIktleWJpbmRpbmdzIGNvbmZpZ3VyYXRpb25cIiksXG5cdFx0YWxsb3dUcmFpbGluZ0NvbW1hczogdHJ1ZSxcblx0XHRhbGxvd0NvbW1lbnRzOiB0cnVlLFxuXHRcdGRlZmluaXRpb25zOiB7XG5cdFx0XHQnZWRpdG9yR3JvdXBzU2NoZW1hJzoge1xuXHRcdFx0XHQndHlwZSc6ICdhcnJheScsXG5cdFx0XHRcdCdpdGVtcyc6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHRcdFx0J2dyb3Vwcyc6IHtcblx0XHRcdFx0XHRcdFx0JyRyZWYnOiAnIy9kZWZpbml0aW9ucy9lZGl0b3JHcm91cHNTY2hlbWEnLFxuXHRcdFx0XHRcdFx0XHQnZGVmYXVsdCc6IFt7fSwge31dXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0J3NpemUnOiB7XG5cdFx0XHRcdFx0XHRcdCd0eXBlJzogJ251bWJlcicsXG5cdFx0XHRcdFx0XHRcdCdkZWZhdWx0JzogMC41XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J2NvbW1hbmROYW1lcyc6IHtcblx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0J2VudW0nOiB0aGlzLmNvbW1hbmRzRW51bSxcblx0XHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiA8YW55PnRoaXMuY29tbWFuZHNFbnVtRGVzY3JpcHRpb25zLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBubHMubG9jYWxpemUoJ2tleWJpbmRpbmdzLmpzb24uY29tbWFuZCcsIFwiTmFtZSBvZiB0aGUgY29tbWFuZCB0byBleGVjdXRlXCIpLFxuXHRcdFx0fSxcblx0XHRcdCdjb21tYW5kVHlwZSc6IHtcblx0XHRcdFx0J2FueU9mJzogWyAvLyByZXBldGl0aW9uIG9mIHRoaXMgY2xhdXNlIGhlcmUgYW5kIGJlbG93IGlzIGludGVudGlvbmFsOiBvbmUgaXMgZm9yIG5pY2UgZGlhZ25vc3RpY3MgJiBvbmUgaXMgZm9yIGNvZGUgY29tcGxldGlvblxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL2NvbW1hbmROYW1lcydcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHQnZW51bSc6IHRoaXMucmVtb3ZhbENvbW1hbmRzRW51bSxcblx0XHRcdFx0XHRcdCdlbnVtRGVzY3JpcHRpb25zJzogPGFueT50aGlzLmNvbW1hbmRzRW51bURlc2NyaXB0aW9ucyxcblx0XHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgna2V5YmluZGluZ3MuanNvbi5yZW1vdmFsQ29tbWFuZCcsIFwiTmFtZSBvZiB0aGUgY29tbWFuZCB0byByZW1vdmUga2V5Ym9hcmQgc2hvcnRjdXQgZm9yXCIpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF1cblx0XHRcdH0sXG5cdFx0XHQnY29tbWFuZHNTY2hlbWFzJzoge1xuXHRcdFx0XHQnYWxsT2YnOiB0aGlzLmNvbW1hbmRzU2NoZW1hc1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0aXRlbXM6IHtcblx0XHRcdCdyZXF1aXJlZCc6IFsna2V5J10sXG5cdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0J2RlZmF1bHRTbmlwcGV0cyc6IFt7ICdib2R5JzogeyAna2V5JzogJyQxJywgJ2NvbW1hbmQnOiAnJDInLCAnd2hlbic6ICckMycgfSB9XSxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQna2V5Jzoge1xuXHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdrZXliaW5kaW5ncy5qc29uLmtleScsIFwiS2V5IG9yIGtleSBzZXF1ZW5jZSAoc2VwYXJhdGVkIGJ5IHNwYWNlKVwiKSxcblx0XHRcdFx0fSxcblx0XHRcdFx0J2NvbW1hbmQnOiB7XG5cdFx0XHRcdFx0J2FueU9mJzogW1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHQnaWYnOiB7XG5cdFx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnYXJyYXknXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdCd0aGVuJzoge1xuXHRcdFx0XHRcdFx0XHRcdCdub3QnOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHQndHlwZSc6ICdhcnJheSdcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdCdlcnJvck1lc3NhZ2UnOiBubHMubG9jYWxpemUoJ2tleWJpbmRpbmdzLmNvbW1hbmRzSXNBcnJheScsIFwiSW5jb3JyZWN0IHR5cGUuIEV4cGVjdGVkIFxcXCJ7MH1cXFwiLiBUaGUgZmllbGQgJ2NvbW1hbmQnIGRvZXMgbm90IHN1cHBvcnQgcnVubmluZyBtdWx0aXBsZSBjb21tYW5kcy4gVXNlIGNvbW1hbmQgJ3J1bkNvbW1hbmRzJyB0byBwYXNzIGl0IG11bHRpcGxlIGNvbW1hbmRzIHRvIHJ1bi5cIiwgJ3N0cmluZycpXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdCdlbHNlJzoge1xuXHRcdFx0XHRcdFx0XHRcdCckcmVmJzogJyMvZGVmaW5pdGlvbnMvY29tbWFuZFR5cGUnXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdCckcmVmJzogJyMvZGVmaW5pdGlvbnMvY29tbWFuZFR5cGUnXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnd2hlbic6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IG5scy5sb2NhbGl6ZSgna2V5YmluZGluZ3MuanNvbi53aGVuJywgXCJDb25kaXRpb24gd2hlbiB0aGUga2V5IGlzIGFjdGl2ZS5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0J2FyZ3MnOiB7XG5cdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbmxzLmxvY2FsaXplKCdrZXliaW5kaW5ncy5qc29uLmFyZ3MnLCBcIkFyZ3VtZW50cyB0byBwYXNzIHRvIHRoZSBjb21tYW5kIHRvIGV4ZWN1dGUuXCIpXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHQnJHJlZic6ICcjL2RlZmluaXRpb25zL2NvbW1hbmRzU2NoZW1hcydcblx0XHR9XG5cdH07XG5cblx0cHJpdmF0ZSByZWFkb25seSBzY2hlbWFSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElKU09OQ29udHJpYnV0aW9uUmVnaXN0cnk+KEV4dGVuc2lvbnMuSlNPTkNvbnRyaWJ1dGlvbik7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5zY2hlbWFSZWdpc3RyeS5yZWdpc3RlclNjaGVtYShLZXliaW5kaW5nc0pzb25TY2hlbWEuc2NoZW1hSWQsIHRoaXMuc2NoZW1hKTtcblx0fVxuXG5cdC8vIFRPRE9AdWx1Z2Jla25hOiBjYW4gdXBkYXRlcyBoYXBwZW4gaW5jcmVtZW50YWxseSByYXRoZXIgdGhhbiByZWJ1aWxkaW5nOyBjb25jZXJuczpcblx0Ly8gLSBpcyBqdXN0IGFwcGVuZGluZyBhZGRpdGlvbmFsIHNjaGVtYXMgZW5vdWdoIGZvciB0aGUgcmVnaXN0cnkgdG8gcGljayB0aGVtIHVwP1xuXHQvLyAtIGNhbiBgQ29tbWFuZHNSZWdpc3RyeS5nZXRDb21tYW5kc2AgYW5kIGBNZW51UmVnaXN0cnkuZ2V0Q29tbWFuZHNgIHJldHVybiBkaWZmZXJlbnQgdmFsdWVzIGF0IGRpZmZlcmVudCB0aW1lcz8gaWUgd291bGQganVzdCBwdXNoaW5nIG5ldyBzY2hlbWFzIGZyb20gYGFkZGl0aW9uYWxDb250cmlidXRpb25zYCBub3QgYmUgZW5vdWdoP1xuXHR1cGRhdGVTY2hlbWEoYWRkaXRpb25hbENvbnRyaWJ1dGlvbnM6IHJlYWRvbmx5IElKU09OU2NoZW1hW10pIHtcblx0XHR0aGlzLmNvbW1hbmRzU2NoZW1hcy5sZW5ndGggPSAwO1xuXHRcdHRoaXMuY29tbWFuZHNFbnVtLmxlbmd0aCA9IDA7XG5cdFx0dGhpcy5yZW1vdmFsQ29tbWFuZHNFbnVtLmxlbmd0aCA9IDA7XG5cdFx0dGhpcy5jb21tYW5kc0VudW1EZXNjcmlwdGlvbnMubGVuZ3RoID0gMDtcblxuXHRcdGNvbnN0IGtub3duQ29tbWFuZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRjb25zdCBhZGRLbm93bkNvbW1hbmQgPSAoY29tbWFuZElkOiBzdHJpbmcsIGRlc2NyaXB0aW9uPzogc3RyaW5nIHwgSUxvY2FsaXplZFN0cmluZyB8IHVuZGVmaW5lZCkgPT4ge1xuXHRcdFx0aWYgKCEvXl8vLnRlc3QoY29tbWFuZElkKSkge1xuXHRcdFx0XHRpZiAoIWtub3duQ29tbWFuZHMuaGFzKGNvbW1hbmRJZCkpIHtcblx0XHRcdFx0XHRrbm93bkNvbW1hbmRzLmFkZChjb21tYW5kSWQpO1xuXG5cdFx0XHRcdFx0dGhpcy5jb21tYW5kc0VudW0ucHVzaChjb21tYW5kSWQpO1xuXHRcdFx0XHRcdHRoaXMuY29tbWFuZHNFbnVtRGVzY3JpcHRpb25zLnB1c2goaXNMb2NhbGl6ZWRTdHJpbmcoZGVzY3JpcHRpb24pID8gZGVzY3JpcHRpb24udmFsdWUgOiBkZXNjcmlwdGlvbik7XG5cblx0XHRcdFx0XHQvLyBBbHNvIGFkZCB0aGUgbmVnYXRpdmUgZm9ybSBmb3Iga2V5YmluZGluZyByZW1vdmFsXG5cdFx0XHRcdFx0dGhpcy5yZW1vdmFsQ29tbWFuZHNFbnVtLnB1c2goYC0ke2NvbW1hbmRJZH1gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBhbGxDb21tYW5kcyA9IENvbW1hbmRzUmVnaXN0cnkuZ2V0Q29tbWFuZHMoKTtcblx0XHRmb3IgKGNvbnN0IFtjb21tYW5kSWQsIGNvbW1hbmRdIG9mIGFsbENvbW1hbmRzKSB7XG5cdFx0XHRjb25zdCBjb21tYW5kTWV0YWRhdGEgPSBjb21tYW5kLm1ldGFkYXRhO1xuXG5cdFx0XHRhZGRLbm93bkNvbW1hbmQoY29tbWFuZElkLCBjb21tYW5kTWV0YWRhdGE/LmRlc2NyaXB0aW9uID8/IE1lbnVSZWdpc3RyeS5nZXRDb21tYW5kKGNvbW1hbmRJZCk/LnRpdGxlKTtcblxuXHRcdFx0aWYgKCFjb21tYW5kTWV0YWRhdGEgfHwgIWNvbW1hbmRNZXRhZGF0YS5hcmdzIHx8IGNvbW1hbmRNZXRhZGF0YS5hcmdzLmxlbmd0aCAhPT0gMSB8fCAhY29tbWFuZE1ldGFkYXRhLmFyZ3NbMF0uc2NoZW1hKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBhcmdzU2NoZW1hID0gY29tbWFuZE1ldGFkYXRhLmFyZ3NbMF0uc2NoZW1hO1xuXHRcdFx0Y29uc3QgYXJnc1JlcXVpcmVkID0gKFxuXHRcdFx0XHQodHlwZW9mIGNvbW1hbmRNZXRhZGF0YS5hcmdzWzBdLmlzT3B0aW9uYWwgIT09ICd1bmRlZmluZWQnKVxuXHRcdFx0XHRcdD8gKCFjb21tYW5kTWV0YWRhdGEuYXJnc1swXS5pc09wdGlvbmFsKVxuXHRcdFx0XHRcdDogKEFycmF5LmlzQXJyYXkoYXJnc1NjaGVtYS5yZXF1aXJlZCkgJiYgYXJnc1NjaGVtYS5yZXF1aXJlZC5sZW5ndGggPiAwKVxuXHRcdFx0KTtcblx0XHRcdGNvbnN0IGFkZGl0aW9uID0ge1xuXHRcdFx0XHQnaWYnOiB7XG5cdFx0XHRcdFx0J3JlcXVpcmVkJzogWydjb21tYW5kJ10sXG5cdFx0XHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdFx0XHQnY29tbWFuZCc6IHsgJ2NvbnN0JzogY29tbWFuZElkIH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdCd0aGVuJzoge1xuXHRcdFx0XHRcdCdyZXF1aXJlZCc6ICg8c3RyaW5nW10+W10pLmNvbmNhdChhcmdzUmVxdWlyZWQgPyBbJ2FyZ3MnXSA6IFtdKSxcblx0XHRcdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0XHRcdCdhcmdzJzogYXJnc1NjaGVtYVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0dGhpcy5jb21tYW5kc1NjaGVtYXMucHVzaChhZGRpdGlvbik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWVudUNvbW1hbmRzID0gTWVudVJlZ2lzdHJ5LmdldENvbW1hbmRzKCk7XG5cdFx0Zm9yIChjb25zdCBjb21tYW5kSWQgb2YgbWVudUNvbW1hbmRzLmtleXMoKSkge1xuXHRcdFx0YWRkS25vd25Db21tYW5kKGNvbW1hbmRJZCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5jb21tYW5kc1NjaGVtYXMucHVzaCguLi5hZGRpdGlvbmFsQ29udHJpYnV0aW9ucyk7XG5cdFx0dGhpcy5zY2hlbWFSZWdpc3RyeS5ub3RpZnlTY2hlbWFDaGFuZ2VkKEtleWJpbmRpbmdzSnNvblNjaGVtYS5zY2hlbWFJZCk7XG5cdH1cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSUtleWJpbmRpbmdTZXJ2aWNlLCBXb3JrYmVuY2hLZXliaW5kaW5nU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFHckIsWUFBWSxhQUFhO0FBQ3pCLFNBQVMsaUJBQWlCLHVCQUF1QjtBQUNqRCxZQUFZLFNBQVM7QUFDckIsU0FBUyxvQkFBb0IsNEJBQTRCLDZCQUE2QjtBQUN0RixTQUFTLGlCQUFpQix3QkFBd0I7QUFDbEQsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxhQUFhO0FBRXRCLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQXFCLGNBQWtDLHFCQUFxQjtBQUM1RSxTQUFTLDRCQUE0QixTQUFTLGNBQWMsUUFBUSxVQUFVLHFCQUFxQjtBQUNuRyxT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
