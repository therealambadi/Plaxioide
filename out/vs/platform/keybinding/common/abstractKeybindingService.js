import * as arrays from "../../../base/common/arrays.js";
import { IntervalTimer, TimeoutTimer } from "../../../base/common/async.js";
import { illegalState } from "../../../base/common/errors.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { IME } from "../../../base/common/ime.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import * as nls from "../../../nls.js";
import { ResultKind, NoMatchingKb } from "./keybindingResolver.js";
const HIGH_FREQ_COMMANDS = /^(cursor|delete|undo|redo|tab|editor\.action\.clipboard)/;
class AbstractKeybindingService extends Disposable {
  constructor(_contextKeyService, _commandService, _telemetryService, _notificationService, _logService) {
    super();
    this._contextKeyService = _contextKeyService;
    this._commandService = _commandService;
    this._telemetryService = _telemetryService;
    this._notificationService = _notificationService;
    this._logService = _logService;
    this._onDidUpdateKeybindings = this._register(new Emitter());
    this._currentChords = [];
    this._currentChordChecker = new IntervalTimer();
    this._currentChordStatusMessage = null;
    this._ignoreSingleModifiers = KeybindingModifierSet.EMPTY;
    this._currentSingleModifier = null;
    this._currentSingleModifierClearTimeout = new TimeoutTimer();
    this._currentlyDispatchingCommandId = null;
    this._logging = false;
  }
  get onDidUpdateKeybindings() {
    return this._onDidUpdateKeybindings ? this._onDidUpdateKeybindings.event : Event.None;
  }
  get inChordMode() {
    return this._currentChords.length > 0;
  }
  dispose() {
    super.dispose();
  }
  getDefaultKeybindingsContent() {
    return "";
  }
  toggleLogging() {
    this._logging = !this._logging;
    return this._logging;
  }
  _log(str) {
    if (this._logging) {
      this._logService.info(`[KeybindingService]: ${str}`);
    }
  }
  getDefaultKeybindings() {
    return this._getResolver().getDefaultKeybindings();
  }
  getKeybindings() {
    return this._getResolver().getKeybindings();
  }
  customKeybindingsCount() {
    return 0;
  }
  lookupKeybindings(commandId) {
    return arrays.coalesce(
      this._getResolver().lookupKeybindings(commandId).map((item) => item.resolvedKeybinding)
    );
  }
  lookupKeybinding(commandId, context, enforceContextCheck = false) {
    const result = this._getResolver().lookupPrimaryKeybinding(commandId, context || this._contextKeyService, enforceContextCheck);
    if (!result) {
      return void 0;
    }
    return result.resolvedKeybinding;
  }
  dispatchEvent(e, target) {
    return this._dispatch(e, target);
  }
  // TODO@ulugbekna: update namings to align with `_doDispatch`
  // TODO@ulugbekna: this fn doesn't seem to take into account single-modifier keybindings, eg `shift shift`
  softDispatch(e, target) {
    this._log(`/ Soft dispatching keyboard event`);
    const keybinding = this.resolveKeyboardEvent(e);
    if (keybinding.hasMultipleChords()) {
      console.warn("keyboard event should not be mapped to multiple chords");
      return NoMatchingKb;
    }
    const [firstChord] = keybinding.getDispatchChords();
    if (firstChord === null) {
      this._log(`\\ Keyboard event cannot be dispatched`);
      return NoMatchingKb;
    }
    const contextValue = this._contextKeyService.getContext(target);
    const currentChords = this._currentChords.map(({ keypress }) => keypress);
    return this._getResolver().resolve(contextValue, currentChords, firstChord);
  }
  _scheduleLeaveChordMode() {
    const chordLastInteractedTime = Date.now();
    this._currentChordChecker.cancelAndSet(() => {
      if (!this._documentHasFocus()) {
        this._leaveChordMode();
        return;
      }
      if (Date.now() - chordLastInteractedTime > 5e3) {
        this._leaveChordMode();
      }
    }, 500);
  }
  _expectAnotherChord(firstChord, keypressLabel) {
    this._currentChords.push({ keypress: firstChord, label: keypressLabel });
    switch (this._currentChords.length) {
      case 0:
        throw illegalState("impossible");
      case 1:
        this._currentChordStatusMessage = this._notificationService.status(nls.localize("first.chord", "({0}) was pressed. Waiting for second key of chord...", keypressLabel));
        break;
      default: {
        const fullKeypressLabel = this._currentChords.map(({ label }) => label).join(", ");
        this._currentChordStatusMessage = this._notificationService.status(nls.localize("next.chord", "({0}) was pressed. Waiting for next key of chord...", fullKeypressLabel));
      }
    }
    this._scheduleLeaveChordMode();
    if (IME.enabled) {
      IME.disable();
    }
  }
  _leaveChordMode() {
    if (this._currentChordStatusMessage) {
      this._currentChordStatusMessage.dispose();
      this._currentChordStatusMessage = null;
    }
    this._currentChordChecker.cancel();
    this._currentChords = [];
    IME.enable();
  }
  dispatchByUserSettingsLabel(userSettingsLabel, target) {
    this._log(`/ Dispatching keybinding triggered via menu entry accelerator - ${userSettingsLabel}`);
    const keybindings = this.resolveUserBinding(userSettingsLabel);
    if (keybindings.length === 0) {
      this._log(`\\ Could not resolve - ${userSettingsLabel}`);
    } else {
      this._doDispatch(
        keybindings[0],
        target,
        /*isSingleModiferChord*/
        false
      );
    }
  }
  _dispatch(e, target) {
    return this._doDispatch(
      this.resolveKeyboardEvent(e),
      target,
      /*isSingleModiferChord*/
      false
    );
  }
  _singleModifierDispatch(e, target) {
    const keybinding = this.resolveKeyboardEvent(e);
    const [singleModifier] = keybinding.getSingleModifierDispatchChords();
    if (singleModifier) {
      if (this._ignoreSingleModifiers.has(singleModifier)) {
        this._log(`+ Ignoring single modifier ${singleModifier} due to it being pressed together with other keys.`);
        this._ignoreSingleModifiers = KeybindingModifierSet.EMPTY;
        this._currentSingleModifierClearTimeout.cancel();
        this._currentSingleModifier = null;
        return false;
      }
      this._ignoreSingleModifiers = KeybindingModifierSet.EMPTY;
      if (this._currentSingleModifier === null) {
        this._log(`+ Storing single modifier for possible chord ${singleModifier}.`);
        this._currentSingleModifier = singleModifier;
        this._currentSingleModifierClearTimeout.cancelAndSet(() => {
          this._log(`+ Clearing single modifier due to 300ms elapsed.`);
          this._currentSingleModifier = null;
        }, 300);
        return false;
      }
      if (singleModifier === this._currentSingleModifier) {
        this._log(`/ Dispatching single modifier chord ${singleModifier} ${singleModifier}`);
        this._currentSingleModifierClearTimeout.cancel();
        this._currentSingleModifier = null;
        return this._doDispatch(
          keybinding,
          target,
          /*isSingleModiferChord*/
          true
        );
      }
      this._log(`+ Clearing single modifier due to modifier mismatch: ${this._currentSingleModifier} ${singleModifier}`);
      this._currentSingleModifierClearTimeout.cancel();
      this._currentSingleModifier = null;
      return false;
    }
    const [firstChord] = keybinding.getChords();
    this._ignoreSingleModifiers = new KeybindingModifierSet(firstChord);
    if (this._currentSingleModifier !== null) {
      this._log(`+ Clearing single modifier due to other key up.`);
    }
    this._currentSingleModifierClearTimeout.cancel();
    this._currentSingleModifier = null;
    return false;
  }
  _doDispatch(userKeypress, target, isSingleModiferChord = false) {
    let shouldPreventDefault = false;
    if (userKeypress.hasMultipleChords()) {
      console.warn("Unexpected keyboard event mapped to multiple chords");
      return false;
    }
    let userPressedChord = null;
    let currentChords = null;
    if (isSingleModiferChord) {
      const [dispatchKeyname] = userKeypress.getSingleModifierDispatchChords();
      userPressedChord = dispatchKeyname;
      currentChords = dispatchKeyname ? [dispatchKeyname] : [];
    } else {
      [userPressedChord] = userKeypress.getDispatchChords();
      currentChords = this._currentChords.map(({ keypress }) => keypress);
    }
    if (userPressedChord === null) {
      this._log(`\\ Keyboard event cannot be dispatched in keydown phase.`);
      return shouldPreventDefault;
    }
    const contextValue = this._contextKeyService.getContext(target);
    const keypressLabel = userKeypress.getLabel();
    const resolveResult = this._getResolver().resolve(contextValue, currentChords, userPressedChord);
    switch (resolveResult.kind) {
      case ResultKind.NoMatchingKb: {
        this._logService.trace("KeybindingService#dispatch", keypressLabel, `[ No matching keybinding ]`);
        if (this.inChordMode) {
          const currentChordsLabel = this._currentChords.map(({ label }) => label).join(", ");
          this._log(`+ Leaving multi-chord mode: Nothing bound to "${currentChordsLabel}, ${keypressLabel}".`);
          this._notificationService.status(nls.localize("missing.chord", "The key combination ({0}, {1}) is not a command.", currentChordsLabel, keypressLabel), {
            hideAfter: 10 * 1e3
            /* 10s */
          });
          this._leaveChordMode();
          shouldPreventDefault = true;
        }
        return shouldPreventDefault;
      }
      case ResultKind.MoreChordsNeeded: {
        this._logService.trace("KeybindingService#dispatch", keypressLabel, `[ Several keybindings match - more chords needed ]`);
        shouldPreventDefault = true;
        this._expectAnotherChord(userPressedChord, keypressLabel);
        this._log(this._currentChords.length === 1 ? `+ Entering multi-chord mode...` : `+ Continuing multi-chord mode...`);
        return shouldPreventDefault;
      }
      case ResultKind.KbFound: {
        this._logService.trace("KeybindingService#dispatch", keypressLabel, `[ Will dispatch command ${resolveResult.commandId} ]`);
        if (resolveResult.commandId === null || resolveResult.commandId === "") {
          if (this.inChordMode) {
            const currentChordsLabel = this._currentChords.map(({ label }) => label).join(", ");
            this._log(`+ Leaving chord mode: Nothing bound to "${currentChordsLabel}, ${keypressLabel}".`);
            this._notificationService.status(nls.localize("missing.chord", "The key combination ({0}, {1}) is not a command.", currentChordsLabel, keypressLabel), {
              hideAfter: 10 * 1e3
              /* 10s */
            });
            this._leaveChordMode();
            shouldPreventDefault = true;
          }
        } else {
          if (this.inChordMode) {
            this._leaveChordMode();
          }
          if (!resolveResult.isBubble) {
            shouldPreventDefault = true;
          }
          this._log(`+ Invoking command ${resolveResult.commandId}.`);
          this._currentlyDispatchingCommandId = resolveResult.commandId;
          try {
            if (typeof resolveResult.commandArgs === "undefined") {
              this._commandService.executeCommand(resolveResult.commandId).then(void 0, (err) => this._notificationService.warn(err));
            } else {
              this._commandService.executeCommand(resolveResult.commandId, resolveResult.commandArgs).then(void 0, (err) => this._notificationService.warn(err));
            }
          } finally {
            this._currentlyDispatchingCommandId = null;
          }
          if (!HIGH_FREQ_COMMANDS.test(resolveResult.commandId)) {
            this._telemetryService.publicLog2("workbenchActionExecuted", { id: resolveResult.commandId, from: "keybinding", detail: userKeypress.getUserSettingsLabel() ?? void 0 });
          }
        }
        return shouldPreventDefault;
      }
    }
  }
  mightProducePrintableCharacter(event) {
    if (event.ctrlKey || event.metaKey) {
      return false;
    }
    if (event.keyCode >= KeyCode.KeyA && event.keyCode <= KeyCode.KeyZ || event.keyCode >= KeyCode.Digit0 && event.keyCode <= KeyCode.Digit9) {
      return true;
    }
    return false;
  }
}
const _KeybindingModifierSet = class _KeybindingModifierSet {
  constructor(source) {
    this._ctrlKey = source ? source.ctrlKey : false;
    this._shiftKey = source ? source.shiftKey : false;
    this._altKey = source ? source.altKey : false;
    this._metaKey = source ? source.metaKey : false;
  }
  has(modifier) {
    switch (modifier) {
      case "ctrl":
        return this._ctrlKey;
      case "shift":
        return this._shiftKey;
      case "alt":
        return this._altKey;
      case "meta":
        return this._metaKey;
    }
  }
};
_KeybindingModifierSet.EMPTY = new _KeybindingModifierSet(null);
let KeybindingModifierSet = _KeybindingModifierSet;
export {
  AbstractKeybindingService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9hYnN0cmFjdEtleWJpbmRpbmdTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRDbGFzc2lmaWNhdGlvbiwgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0ICogYXMgYXJyYXlzIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBJbnRlcnZhbFRpbWVyLCBUaW1lb3V0VGltZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBpbGxlZ2FsU3RhdGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJTUUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9pbWUuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmcsIFJlc29sdmVkQ2hvcmQsIFJlc29sdmVkS2V5YmluZGluZywgU2luZ2xlTW9kaWZpZXJDaG9yZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleWJpbmRpbmdzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuXG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlLCBJQ29udGV4dEtleVNlcnZpY2VUYXJnZXQgfSBmcm9tICcuLi8uLi9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSwgSUtleWJvYXJkRXZlbnQsIEtleWJpbmRpbmdzU2NoZW1hQ29udHJpYnV0aW9uIH0gZnJvbSAnLi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IFJlc29sdXRpb25SZXN1bHQsIEtleWJpbmRpbmdSZXNvbHZlciwgUmVzdWx0S2luZCwgTm9NYXRjaGluZ0tiIH0gZnJvbSAnLi9rZXliaW5kaW5nUmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgUmVzb2x2ZWRLZXliaW5kaW5nSXRlbSB9IGZyb20gJy4vcmVzb2x2ZWRLZXliaW5kaW5nSXRlbS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5cbmludGVyZmFjZSBDdXJyZW50Q2hvcmQge1xuXHRrZXlwcmVzczogc3RyaW5nO1xuXHRsYWJlbDogc3RyaW5nIHwgbnVsbDtcbn1cblxuY29uc3QgSElHSF9GUkVRX0NPTU1BTkRTID0gL14oY3Vyc29yfGRlbGV0ZXx1bmRvfHJlZG98dGFifGVkaXRvclxcLmFjdGlvblxcLmNsaXBib2FyZCkvO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RLZXliaW5kaW5nU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJS2V5YmluZGluZ1NlcnZpY2Uge1xuXG5cdHB1YmxpYyBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZFVwZGF0ZUtleWJpbmRpbmdzOiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdGdldCBvbkRpZFVwZGF0ZUtleWJpbmRpbmdzKCk6IEV2ZW50PHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRVcGRhdGVLZXliaW5kaW5ncyA/IHRoaXMuX29uRGlkVXBkYXRlS2V5YmluZGluZ3MuZXZlbnQgOiBFdmVudC5Ob25lOyAvLyBTaW5vbiBzdHViYmluZyB3YWxrcyBwcm9wZXJ0aWVzIG9uIHByb3RvdHlwZVxuXHR9XG5cblx0LyoqIHJlY2VudGx5IHJlY29yZGVkIGtleXByZXNzZXMgdGhhdCBjYW4gdHJpZ2dlciBhIGtleWJpbmRpbmc7XG5cdCAqXG5cdCAqIGV4YW1wbGU6IHNheSwgdGhlcmUncyBcImNtZCtrIGNtZCtpXCIga2V5YmluZGluZztcblx0ICogdGhlIHVzZXIgcHJlc3NlZCBcImNtZCtrXCIgKGJlZm9yZSB0aGV5IHByZXNzIFwiY21kK2lcIilcblx0ICogXCJjbWQra1wiIHdvdWxkIGJlIHN0b3JlZCBpbiB0aGlzIGFycmF5LCB3aGVuIG9uIHByZXNzaW5nIFwiY21kK2lcIiwgdGhlIHNlcnZpY2Vcblx0ICogd291bGQgaW52b2tlIHRoZSBjb21tYW5kIGJvdW5kIGJ5IHRoZSBrZXliaW5kaW5nXG5cdCAqL1xuXHRwcml2YXRlIF9jdXJyZW50Q2hvcmRzOiBDdXJyZW50Q2hvcmRbXTtcblxuXHRwcml2YXRlIF9jdXJyZW50Q2hvcmRDaGVja2VyOiBJbnRlcnZhbFRpbWVyO1xuXHRwcml2YXRlIF9jdXJyZW50Q2hvcmRTdGF0dXNNZXNzYWdlOiBJRGlzcG9zYWJsZSB8IG51bGw7XG5cdHByaXZhdGUgX2lnbm9yZVNpbmdsZU1vZGlmaWVyczogS2V5YmluZGluZ01vZGlmaWVyU2V0O1xuXHRwcml2YXRlIF9jdXJyZW50U2luZ2xlTW9kaWZpZXI6IFNpbmdsZU1vZGlmaWVyQ2hvcmQgfCBudWxsO1xuXHRwcml2YXRlIF9jdXJyZW50U2luZ2xlTW9kaWZpZXJDbGVhclRpbWVvdXQ6IFRpbWVvdXRUaW1lcjtcblx0cHJvdGVjdGVkIF9jdXJyZW50bHlEaXNwYXRjaGluZ0NvbW1hbmRJZDogc3RyaW5nIHwgbnVsbDtcblxuXHRwcm90ZWN0ZWQgX2xvZ2dpbmc6IGJvb2xlYW47XG5cblx0cHVibGljIGdldCBpbkNob3JkTW9kZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fY3VycmVudENob3Jkcy5sZW5ndGggPiAwO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBfY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRwcm90ZWN0ZWQgX2NvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0cHJvdGVjdGVkIF90ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRwcml2YXRlIF9ub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRwcm90ZWN0ZWQgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fY3VycmVudENob3JkcyA9IFtdO1xuXHRcdHRoaXMuX2N1cnJlbnRDaG9yZENoZWNrZXIgPSBuZXcgSW50ZXJ2YWxUaW1lcigpO1xuXHRcdHRoaXMuX2N1cnJlbnRDaG9yZFN0YXR1c01lc3NhZ2UgPSBudWxsO1xuXHRcdHRoaXMuX2lnbm9yZVNpbmdsZU1vZGlmaWVycyA9IEtleWJpbmRpbmdNb2RpZmllclNldC5FTVBUWTtcblx0XHR0aGlzLl9jdXJyZW50U2luZ2xlTW9kaWZpZXIgPSBudWxsO1xuXHRcdHRoaXMuX2N1cnJlbnRTaW5nbGVNb2RpZmllckNsZWFyVGltZW91dCA9IG5ldyBUaW1lb3V0VGltZXIoKTtcblx0XHR0aGlzLl9jdXJyZW50bHlEaXNwYXRjaGluZ0NvbW1hbmRJZCA9IG51bGw7XG5cdFx0dGhpcy5fbG9nZ2luZyA9IGZhbHNlO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IF9nZXRSZXNvbHZlcigpOiBLZXliaW5kaW5nUmVzb2x2ZXI7XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBfZG9jdW1lbnRIYXNGb2N1cygpOiBib29sZWFuO1xuXHRwdWJsaWMgYWJzdHJhY3QgcmVzb2x2ZUtleWJpbmRpbmcoa2V5YmluZGluZzogS2V5YmluZGluZyk6IFJlc29sdmVkS2V5YmluZGluZ1tdO1xuXHRwdWJsaWMgYWJzdHJhY3QgcmVzb2x2ZUtleWJvYXJkRXZlbnQoa2V5Ym9hcmRFdmVudDogSUtleWJvYXJkRXZlbnQpOiBSZXNvbHZlZEtleWJpbmRpbmc7XG5cdHB1YmxpYyBhYnN0cmFjdCByZXNvbHZlVXNlckJpbmRpbmcodXNlckJpbmRpbmc6IHN0cmluZyk6IFJlc29sdmVkS2V5YmluZGluZ1tdO1xuXHRwdWJsaWMgYWJzdHJhY3QgcmVnaXN0ZXJTY2hlbWFDb250cmlidXRpb24oY29udHJpYnV0aW9uOiBLZXliaW5kaW5nc1NjaGVtYUNvbnRyaWJ1dGlvbik6IHZvaWQ7XG5cdHB1YmxpYyBhYnN0cmFjdCBfZHVtcERlYnVnSW5mbygpOiBzdHJpbmc7XG5cdHB1YmxpYyBhYnN0cmFjdCBfZHVtcERlYnVnSW5mb0pTT04oKTogc3RyaW5nO1xuXG5cdHB1YmxpYyBnZXREZWZhdWx0S2V5YmluZGluZ3NDb250ZW50KCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0cHVibGljIHRvZ2dsZUxvZ2dpbmcoKTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fbG9nZ2luZyA9ICF0aGlzLl9sb2dnaW5nO1xuXHRcdHJldHVybiB0aGlzLl9sb2dnaW5nO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9sb2coc3RyOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fbG9nZ2luZykge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBbS2V5YmluZGluZ1NlcnZpY2VdOiAke3N0cn1gKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0RGVmYXVsdEtleWJpbmRpbmdzKCk6IHJlYWRvbmx5IFJlc29sdmVkS2V5YmluZGluZ0l0ZW1bXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2dldFJlc29sdmVyKCkuZ2V0RGVmYXVsdEtleWJpbmRpbmdzKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0S2V5YmluZGluZ3MoKTogcmVhZG9ubHkgUmVzb2x2ZWRLZXliaW5kaW5nSXRlbVtdIHtcblx0XHRyZXR1cm4gdGhpcy5fZ2V0UmVzb2x2ZXIoKS5nZXRLZXliaW5kaW5ncygpO1xuXHR9XG5cblx0cHVibGljIGN1c3RvbUtleWJpbmRpbmdzQ291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdHB1YmxpYyBsb29rdXBLZXliaW5kaW5ncyhjb21tYW5kSWQ6IHN0cmluZyk6IFJlc29sdmVkS2V5YmluZGluZ1tdIHtcblx0XHRyZXR1cm4gYXJyYXlzLmNvYWxlc2NlKFxuXHRcdFx0dGhpcy5fZ2V0UmVzb2x2ZXIoKS5sb29rdXBLZXliaW5kaW5ncyhjb21tYW5kSWQpLm1hcChpdGVtID0+IGl0ZW0ucmVzb2x2ZWRLZXliaW5kaW5nKVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgbG9va3VwS2V5YmluZGluZyhjb21tYW5kSWQ6IHN0cmluZywgY29udGV4dD86IElDb250ZXh0S2V5U2VydmljZSwgZW5mb3JjZUNvbnRleHRDaGVjayA9IGZhbHNlKTogUmVzb2x2ZWRLZXliaW5kaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9nZXRSZXNvbHZlcigpLmxvb2t1cFByaW1hcnlLZXliaW5kaW5nKGNvbW1hbmRJZCwgY29udGV4dCB8fCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSwgZW5mb3JjZUNvbnRleHRDaGVjayk7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQucmVzb2x2ZWRLZXliaW5kaW5nO1xuXHR9XG5cblx0cHVibGljIGRpc3BhdGNoRXZlbnQoZTogSUtleWJvYXJkRXZlbnQsIHRhcmdldDogSUNvbnRleHRLZXlTZXJ2aWNlVGFyZ2V0KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2Rpc3BhdGNoKGUsIHRhcmdldCk7XG5cdH1cblxuXHQvLyBUT0RPQHVsdWdiZWtuYTogdXBkYXRlIG5hbWluZ3MgdG8gYWxpZ24gd2l0aCBgX2RvRGlzcGF0Y2hgXG5cdC8vIFRPRE9AdWx1Z2Jla25hOiB0aGlzIGZuIGRvZXNuJ3Qgc2VlbSB0byB0YWtlIGludG8gYWNjb3VudCBzaW5nbGUtbW9kaWZpZXIga2V5YmluZGluZ3MsIGVnIGBzaGlmdCBzaGlmdGBcblx0cHVibGljIHNvZnREaXNwYXRjaChlOiBJS2V5Ym9hcmRFdmVudCwgdGFyZ2V0OiBJQ29udGV4dEtleVNlcnZpY2VUYXJnZXQpOiBSZXNvbHV0aW9uUmVzdWx0IHtcblx0XHR0aGlzLl9sb2coYC8gU29mdCBkaXNwYXRjaGluZyBrZXlib2FyZCBldmVudGApO1xuXHRcdGNvbnN0IGtleWJpbmRpbmcgPSB0aGlzLnJlc29sdmVLZXlib2FyZEV2ZW50KGUpO1xuXHRcdGlmIChrZXliaW5kaW5nLmhhc011bHRpcGxlQ2hvcmRzKCkpIHtcblx0XHRcdGNvbnNvbGUud2Fybigna2V5Ym9hcmQgZXZlbnQgc2hvdWxkIG5vdCBiZSBtYXBwZWQgdG8gbXVsdGlwbGUgY2hvcmRzJyk7XG5cdFx0XHRyZXR1cm4gTm9NYXRjaGluZ0tiO1xuXHRcdH1cblx0XHRjb25zdCBbZmlyc3RDaG9yZCxdID0ga2V5YmluZGluZy5nZXREaXNwYXRjaENob3JkcygpO1xuXHRcdGlmIChmaXJzdENob3JkID09PSBudWxsKSB7XG5cdFx0XHQvLyBjYW5ub3QgYmUgZGlzcGF0Y2hlZCwgcHJvYmFibHkgb25seSBtb2RpZmllciBrZXlzXG5cdFx0XHR0aGlzLl9sb2coYFxcXFwgS2V5Ym9hcmQgZXZlbnQgY2Fubm90IGJlIGRpc3BhdGNoZWRgKTtcblx0XHRcdHJldHVybiBOb01hdGNoaW5nS2I7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udGV4dFZhbHVlID0gdGhpcy5fY29udGV4dEtleVNlcnZpY2UuZ2V0Q29udGV4dCh0YXJnZXQpO1xuXHRcdGNvbnN0IGN1cnJlbnRDaG9yZHMgPSB0aGlzLl9jdXJyZW50Q2hvcmRzLm1hcCgoKHsga2V5cHJlc3MgfSkgPT4ga2V5cHJlc3MpKTtcblx0XHRyZXR1cm4gdGhpcy5fZ2V0UmVzb2x2ZXIoKS5yZXNvbHZlKGNvbnRleHRWYWx1ZSwgY3VycmVudENob3JkcywgZmlyc3RDaG9yZCk7XG5cdH1cblxuXHRwcml2YXRlIF9zY2hlZHVsZUxlYXZlQ2hvcmRNb2RlKCk6IHZvaWQge1xuXHRcdGNvbnN0IGNob3JkTGFzdEludGVyYWN0ZWRUaW1lID0gRGF0ZS5ub3coKTtcblx0XHR0aGlzLl9jdXJyZW50Q2hvcmRDaGVja2VyLmNhbmNlbEFuZFNldCgoKSA9PiB7XG5cblx0XHRcdGlmICghdGhpcy5fZG9jdW1lbnRIYXNGb2N1cygpKSB7XG5cdFx0XHRcdC8vIEZvY3VzIGhhcyBiZWVuIGxvc3QgPT4gbGVhdmUgY2hvcmQgbW9kZVxuXHRcdFx0XHR0aGlzLl9sZWF2ZUNob3JkTW9kZSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChEYXRlLm5vdygpIC0gY2hvcmRMYXN0SW50ZXJhY3RlZFRpbWUgPiA1MDAwKSB7XG5cdFx0XHRcdC8vIDUgc2Vjb25kcyBlbGFwc2VkID0+IGxlYXZlIGNob3JkIG1vZGVcblx0XHRcdFx0dGhpcy5fbGVhdmVDaG9yZE1vZGUoKTtcblx0XHRcdH1cblxuXHRcdH0sIDUwMCk7XG5cdH1cblxuXHRwcml2YXRlIF9leHBlY3RBbm90aGVyQ2hvcmQoZmlyc3RDaG9yZDogc3RyaW5nLCBrZXlwcmVzc0xhYmVsOiBzdHJpbmcgfCBudWxsKTogdm9pZCB7XG5cblx0XHR0aGlzLl9jdXJyZW50Q2hvcmRzLnB1c2goeyBrZXlwcmVzczogZmlyc3RDaG9yZCwgbGFiZWw6IGtleXByZXNzTGFiZWwgfSk7XG5cblx0XHRzd2l0Y2ggKHRoaXMuX2N1cnJlbnRDaG9yZHMubGVuZ3RoKSB7XG5cdFx0XHRjYXNlIDA6XG5cdFx0XHRcdHRocm93IGlsbGVnYWxTdGF0ZSgnaW1wb3NzaWJsZScpO1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHQvLyBUT0RPQHVsdWdiZWtuYTogcmV2aXNlIHRoaXMgbWVzc2FnZSBhbmQgdGhlIG9uZSBiZWxvdyAoYXQgbGVhc3QsIGZpeCB0ZXJtaW5vbG9neSlcblx0XHRcdFx0dGhpcy5fY3VycmVudENob3JkU3RhdHVzTWVzc2FnZSA9IHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2Uuc3RhdHVzKG5scy5sb2NhbGl6ZSgnZmlyc3QuY2hvcmQnLCBcIih7MH0pIHdhcyBwcmVzc2VkLiBXYWl0aW5nIGZvciBzZWNvbmQga2V5IG9mIGNob3JkLi4uXCIsIGtleXByZXNzTGFiZWwpKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdGNvbnN0IGZ1bGxLZXlwcmVzc0xhYmVsID0gdGhpcy5fY3VycmVudENob3Jkcy5tYXAoKHsgbGFiZWwgfSkgPT4gbGFiZWwpLmpvaW4oJywgJyk7XG5cdFx0XHRcdHRoaXMuX2N1cnJlbnRDaG9yZFN0YXR1c01lc3NhZ2UgPSB0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLnN0YXR1cyhubHMubG9jYWxpemUoJ25leHQuY2hvcmQnLCBcIih7MH0pIHdhcyBwcmVzc2VkLiBXYWl0aW5nIGZvciBuZXh0IGtleSBvZiBjaG9yZC4uLlwiLCBmdWxsS2V5cHJlc3NMYWJlbCkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX3NjaGVkdWxlTGVhdmVDaG9yZE1vZGUoKTtcblxuXHRcdGlmIChJTUUuZW5hYmxlZCkge1xuXHRcdFx0SU1FLmRpc2FibGUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9sZWF2ZUNob3JkTW9kZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fY3VycmVudENob3JkU3RhdHVzTWVzc2FnZSkge1xuXHRcdFx0dGhpcy5fY3VycmVudENob3JkU3RhdHVzTWVzc2FnZS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9jdXJyZW50Q2hvcmRTdGF0dXNNZXNzYWdlID0gbnVsbDtcblx0XHR9XG5cdFx0dGhpcy5fY3VycmVudENob3JkQ2hlY2tlci5jYW5jZWwoKTtcblx0XHR0aGlzLl9jdXJyZW50Q2hvcmRzID0gW107XG5cdFx0SU1FLmVuYWJsZSgpO1xuXHR9XG5cblx0cHVibGljIGRpc3BhdGNoQnlVc2VyU2V0dGluZ3NMYWJlbCh1c2VyU2V0dGluZ3NMYWJlbDogc3RyaW5nLCB0YXJnZXQ6IElDb250ZXh0S2V5U2VydmljZVRhcmdldCk6IHZvaWQge1xuXHRcdHRoaXMuX2xvZyhgLyBEaXNwYXRjaGluZyBrZXliaW5kaW5nIHRyaWdnZXJlZCB2aWEgbWVudSBlbnRyeSBhY2NlbGVyYXRvciAtICR7dXNlclNldHRpbmdzTGFiZWx9YCk7XG5cdFx0Y29uc3Qga2V5YmluZGluZ3MgPSB0aGlzLnJlc29sdmVVc2VyQmluZGluZyh1c2VyU2V0dGluZ3NMYWJlbCk7XG5cdFx0aWYgKGtleWJpbmRpbmdzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5fbG9nKGBcXFxcIENvdWxkIG5vdCByZXNvbHZlIC0gJHt1c2VyU2V0dGluZ3NMYWJlbH1gKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fZG9EaXNwYXRjaChrZXliaW5kaW5nc1swXSwgdGFyZ2V0LCAvKmlzU2luZ2xlTW9kaWZlckNob3JkKi9mYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIF9kaXNwYXRjaChlOiBJS2V5Ym9hcmRFdmVudCwgdGFyZ2V0OiBJQ29udGV4dEtleVNlcnZpY2VUYXJnZXQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZG9EaXNwYXRjaCh0aGlzLnJlc29sdmVLZXlib2FyZEV2ZW50KGUpLCB0YXJnZXQsIC8qaXNTaW5nbGVNb2RpZmVyQ2hvcmQqL2ZhbHNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfc2luZ2xlTW9kaWZpZXJEaXNwYXRjaChlOiBJS2V5Ym9hcmRFdmVudCwgdGFyZ2V0OiBJQ29udGV4dEtleVNlcnZpY2VUYXJnZXQpOiBib29sZWFuIHtcblx0XHRjb25zdCBrZXliaW5kaW5nID0gdGhpcy5yZXNvbHZlS2V5Ym9hcmRFdmVudChlKTtcblx0XHRjb25zdCBbc2luZ2xlTW9kaWZpZXIsXSA9IGtleWJpbmRpbmcuZ2V0U2luZ2xlTW9kaWZpZXJEaXNwYXRjaENob3JkcygpO1xuXG5cdFx0aWYgKHNpbmdsZU1vZGlmaWVyKSB7XG5cblx0XHRcdGlmICh0aGlzLl9pZ25vcmVTaW5nbGVNb2RpZmllcnMuaGFzKHNpbmdsZU1vZGlmaWVyKSkge1xuXHRcdFx0XHR0aGlzLl9sb2coYCsgSWdub3Jpbmcgc2luZ2xlIG1vZGlmaWVyICR7c2luZ2xlTW9kaWZpZXJ9IGR1ZSB0byBpdCBiZWluZyBwcmVzc2VkIHRvZ2V0aGVyIHdpdGggb3RoZXIga2V5cy5gKTtcblx0XHRcdFx0dGhpcy5faWdub3JlU2luZ2xlTW9kaWZpZXJzID0gS2V5YmluZGluZ01vZGlmaWVyU2V0LkVNUFRZO1xuXHRcdFx0XHR0aGlzLl9jdXJyZW50U2luZ2xlTW9kaWZpZXJDbGVhclRpbWVvdXQuY2FuY2VsKCk7XG5cdFx0XHRcdHRoaXMuX2N1cnJlbnRTaW5nbGVNb2RpZmllciA9IG51bGw7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5faWdub3JlU2luZ2xlTW9kaWZpZXJzID0gS2V5YmluZGluZ01vZGlmaWVyU2V0LkVNUFRZO1xuXG5cdFx0XHRpZiAodGhpcy5fY3VycmVudFNpbmdsZU1vZGlmaWVyID09PSBudWxsKSB7XG5cdFx0XHRcdC8vIHdlIGhhdmUgYSB2YWxpZCBgc2luZ2xlTW9kaWZpZXJgLCBzdG9yZSBpdCBmb3IgdGhlIG5leHQga2V5dXAsIGJ1dCBjbGVhciBpdCBpbiAzMDBtc1xuXHRcdFx0XHR0aGlzLl9sb2coYCsgU3RvcmluZyBzaW5nbGUgbW9kaWZpZXIgZm9yIHBvc3NpYmxlIGNob3JkICR7c2luZ2xlTW9kaWZpZXJ9LmApO1xuXHRcdFx0XHR0aGlzLl9jdXJyZW50U2luZ2xlTW9kaWZpZXIgPSBzaW5nbGVNb2RpZmllcjtcblx0XHRcdFx0dGhpcy5fY3VycmVudFNpbmdsZU1vZGlmaWVyQ2xlYXJUaW1lb3V0LmNhbmNlbEFuZFNldCgoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fbG9nKGArIENsZWFyaW5nIHNpbmdsZSBtb2RpZmllciBkdWUgdG8gMzAwbXMgZWxhcHNlZC5gKTtcblx0XHRcdFx0XHR0aGlzLl9jdXJyZW50U2luZ2xlTW9kaWZpZXIgPSBudWxsO1xuXHRcdFx0XHR9LCAzMDApO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzaW5nbGVNb2RpZmllciA9PT0gdGhpcy5fY3VycmVudFNpbmdsZU1vZGlmaWVyKSB7XG5cdFx0XHRcdC8vIGJpbmdvIVxuXHRcdFx0XHR0aGlzLl9sb2coYC8gRGlzcGF0Y2hpbmcgc2luZ2xlIG1vZGlmaWVyIGNob3JkICR7c2luZ2xlTW9kaWZpZXJ9ICR7c2luZ2xlTW9kaWZpZXJ9YCk7XG5cdFx0XHRcdHRoaXMuX2N1cnJlbnRTaW5nbGVNb2RpZmllckNsZWFyVGltZW91dC5jYW5jZWwoKTtcblx0XHRcdFx0dGhpcy5fY3VycmVudFNpbmdsZU1vZGlmaWVyID0gbnVsbDtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2RvRGlzcGF0Y2goa2V5YmluZGluZywgdGFyZ2V0LCAvKmlzU2luZ2xlTW9kaWZlckNob3JkKi90cnVlKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fbG9nKGArIENsZWFyaW5nIHNpbmdsZSBtb2RpZmllciBkdWUgdG8gbW9kaWZpZXIgbWlzbWF0Y2g6ICR7dGhpcy5fY3VycmVudFNpbmdsZU1vZGlmaWVyfSAke3NpbmdsZU1vZGlmaWVyfWApO1xuXHRcdFx0dGhpcy5fY3VycmVudFNpbmdsZU1vZGlmaWVyQ2xlYXJUaW1lb3V0LmNhbmNlbCgpO1xuXHRcdFx0dGhpcy5fY3VycmVudFNpbmdsZU1vZGlmaWVyID0gbnVsbDtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBXaGVuIHByZXNzaW5nIGEgbW9kaWZpZXIgYW5kIGhvbGRpbmcgaXQgcHJlc3NlZCB3aXRoIGFueSBvdGhlciBtb2RpZmllciBvciBrZXkgY29tYmluYXRpb24sXG5cdFx0Ly8gdGhlIHByZXNzZWQgbW9kaWZpZXJzIHNob3VsZCBubyBsb25nZXIgYmUgY29uc2lkZXJlZCBmb3Igc2luZ2xlIG1vZGlmaWVyIGRpc3BhdGNoLlxuXHRcdGNvbnN0IFtmaXJzdENob3JkLF0gPSBrZXliaW5kaW5nLmdldENob3JkcygpO1xuXHRcdHRoaXMuX2lnbm9yZVNpbmdsZU1vZGlmaWVycyA9IG5ldyBLZXliaW5kaW5nTW9kaWZpZXJTZXQoZmlyc3RDaG9yZCk7XG5cblx0XHRpZiAodGhpcy5fY3VycmVudFNpbmdsZU1vZGlmaWVyICE9PSBudWxsKSB7XG5cdFx0XHR0aGlzLl9sb2coYCsgQ2xlYXJpbmcgc2luZ2xlIG1vZGlmaWVyIGR1ZSB0byBvdGhlciBrZXkgdXAuYCk7XG5cdFx0fVxuXHRcdHRoaXMuX2N1cnJlbnRTaW5nbGVNb2RpZmllckNsZWFyVGltZW91dC5jYW5jZWwoKTtcblx0XHR0aGlzLl9jdXJyZW50U2luZ2xlTW9kaWZpZXIgPSBudWxsO1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgX2RvRGlzcGF0Y2godXNlcktleXByZXNzOiBSZXNvbHZlZEtleWJpbmRpbmcsIHRhcmdldDogSUNvbnRleHRLZXlTZXJ2aWNlVGFyZ2V0LCBpc1NpbmdsZU1vZGlmZXJDaG9yZCA9IGZhbHNlKTogYm9vbGVhbiB7XG5cdFx0bGV0IHNob3VsZFByZXZlbnREZWZhdWx0ID0gZmFsc2U7XG5cblx0XHRpZiAodXNlcktleXByZXNzLmhhc011bHRpcGxlQ2hvcmRzKCkpIHsgLy8gd2FybiAtIGJlY2F1c2UgdXNlciBjYW4gcHJlc3MgYSBzaW5nbGUgY2hvcmQgYXQgYSB0aW1lXG5cdFx0XHRjb25zb2xlLndhcm4oJ1VuZXhwZWN0ZWQga2V5Ym9hcmQgZXZlbnQgbWFwcGVkIHRvIG11bHRpcGxlIGNob3JkcycpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGxldCB1c2VyUHJlc3NlZENob3JkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblx0XHRsZXQgY3VycmVudENob3Jkczogc3RyaW5nW10gfCBudWxsID0gbnVsbDtcblxuXHRcdGlmIChpc1NpbmdsZU1vZGlmZXJDaG9yZCkge1xuXHRcdFx0Ly8gVGhlIGtleWJpbmRpbmcgaXMgdGhlIHNlY29uZCBrZXlwcmVzcyBvZiBhIHNpbmdsZSBtb2RpZmllciBjaG9yZCwgZS5nLiBcInNoaWZ0IHNoaWZ0XCIuXG5cdFx0XHQvLyBBIHNpbmdsZSBtb2RpZmllciBjYW4gb25seSBvY2N1ciB3aGVuIHRoZSBzYW1lIG1vZGlmaWVyIGlzIHByZXNzZWQgaW4gc2hvcnQgc2VxdWVuY2UsXG5cdFx0XHQvLyBoZW5jZSB3ZSBkaXNyZWdhcmQgYF9jdXJyZW50Q2hvcmRgIGFuZCB1c2UgdGhlIHNhbWUgbW9kaWZpZXIgaW5zdGVhZC5cblx0XHRcdGNvbnN0IFtkaXNwYXRjaEtleW5hbWUsXSA9IHVzZXJLZXlwcmVzcy5nZXRTaW5nbGVNb2RpZmllckRpc3BhdGNoQ2hvcmRzKCk7XG5cdFx0XHR1c2VyUHJlc3NlZENob3JkID0gZGlzcGF0Y2hLZXluYW1lO1xuXHRcdFx0Y3VycmVudENob3JkcyA9IGRpc3BhdGNoS2V5bmFtZSA/IFtkaXNwYXRjaEtleW5hbWVdIDogW107IC8vIFRPRE9AdWx1Z2Jla25hOiBpbiB0aGUgYGVsc2VgIGNhc2Ugd2UgYXNzaWduIGFuIGVtcHR5IGFycmF5IC0gbWFrZSBzdXJlIGByZXNvbHZlYCBjYW4gaGFuZGxlIGFuIGVtcHR5IGFycmF5IHdlbGxcblx0XHR9IGVsc2Uge1xuXHRcdFx0W3VzZXJQcmVzc2VkQ2hvcmQsXSA9IHVzZXJLZXlwcmVzcy5nZXREaXNwYXRjaENob3JkcygpO1xuXHRcdFx0Y3VycmVudENob3JkcyA9IHRoaXMuX2N1cnJlbnRDaG9yZHMubWFwKCh7IGtleXByZXNzIH0pID0+IGtleXByZXNzKTtcblx0XHR9XG5cblx0XHRpZiAodXNlclByZXNzZWRDaG9yZCA9PT0gbnVsbCkge1xuXHRcdFx0dGhpcy5fbG9nKGBcXFxcIEtleWJvYXJkIGV2ZW50IGNhbm5vdCBiZSBkaXNwYXRjaGVkIGluIGtleWRvd24gcGhhc2UuYCk7XG5cdFx0XHQvLyBjYW5ub3QgYmUgZGlzcGF0Y2hlZCwgcHJvYmFibHkgb25seSBtb2RpZmllciBrZXlzXG5cdFx0XHRyZXR1cm4gc2hvdWxkUHJldmVudERlZmF1bHQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udGV4dFZhbHVlID0gdGhpcy5fY29udGV4dEtleVNlcnZpY2UuZ2V0Q29udGV4dCh0YXJnZXQpO1xuXHRcdGNvbnN0IGtleXByZXNzTGFiZWwgPSB1c2VyS2V5cHJlc3MuZ2V0TGFiZWwoKTtcblxuXHRcdGNvbnN0IHJlc29sdmVSZXN1bHQgPSB0aGlzLl9nZXRSZXNvbHZlcigpLnJlc29sdmUoY29udGV4dFZhbHVlLCBjdXJyZW50Q2hvcmRzLCB1c2VyUHJlc3NlZENob3JkKTtcblxuXHRcdHN3aXRjaCAocmVzb2x2ZVJlc3VsdC5raW5kKSB7XG5cblx0XHRcdGNhc2UgUmVzdWx0S2luZC5Ob01hdGNoaW5nS2I6IHtcblxuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCdLZXliaW5kaW5nU2VydmljZSNkaXNwYXRjaCcsIGtleXByZXNzTGFiZWwsIGBbIE5vIG1hdGNoaW5nIGtleWJpbmRpbmcgXWApO1xuXG5cdFx0XHRcdGlmICh0aGlzLmluQ2hvcmRNb2RlKSB7XG5cdFx0XHRcdFx0Y29uc3QgY3VycmVudENob3Jkc0xhYmVsID0gdGhpcy5fY3VycmVudENob3Jkcy5tYXAoKHsgbGFiZWwgfSkgPT4gbGFiZWwpLmpvaW4oJywgJyk7XG5cdFx0XHRcdFx0dGhpcy5fbG9nKGArIExlYXZpbmcgbXVsdGktY2hvcmQgbW9kZTogTm90aGluZyBib3VuZCB0byBcIiR7Y3VycmVudENob3Jkc0xhYmVsfSwgJHtrZXlwcmVzc0xhYmVsfVwiLmApO1xuXHRcdFx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2Uuc3RhdHVzKG5scy5sb2NhbGl6ZSgnbWlzc2luZy5jaG9yZCcsIFwiVGhlIGtleSBjb21iaW5hdGlvbiAoezB9LCB7MX0pIGlzIG5vdCBhIGNvbW1hbmQuXCIsIGN1cnJlbnRDaG9yZHNMYWJlbCwga2V5cHJlc3NMYWJlbCksIHsgaGlkZUFmdGVyOiAxMCAqIDEwMDAgLyogMTBzICovIH0pO1xuXHRcdFx0XHRcdHRoaXMuX2xlYXZlQ2hvcmRNb2RlKCk7XG5cblx0XHRcdFx0XHRzaG91bGRQcmV2ZW50RGVmYXVsdCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHNob3VsZFByZXZlbnREZWZhdWx0O1xuXHRcdFx0fVxuXG5cdFx0XHRjYXNlIFJlc3VsdEtpbmQuTW9yZUNob3Jkc05lZWRlZDoge1xuXG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ0tleWJpbmRpbmdTZXJ2aWNlI2Rpc3BhdGNoJywga2V5cHJlc3NMYWJlbCwgYFsgU2V2ZXJhbCBrZXliaW5kaW5ncyBtYXRjaCAtIG1vcmUgY2hvcmRzIG5lZWRlZCBdYCk7XG5cblx0XHRcdFx0c2hvdWxkUHJldmVudERlZmF1bHQgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLl9leHBlY3RBbm90aGVyQ2hvcmQodXNlclByZXNzZWRDaG9yZCwga2V5cHJlc3NMYWJlbCk7XG5cdFx0XHRcdHRoaXMuX2xvZyh0aGlzLl9jdXJyZW50Q2hvcmRzLmxlbmd0aCA9PT0gMSA/IGArIEVudGVyaW5nIG11bHRpLWNob3JkIG1vZGUuLi5gIDogYCsgQ29udGludWluZyBtdWx0aS1jaG9yZCBtb2RlLi4uYCk7XG5cdFx0XHRcdHJldHVybiBzaG91bGRQcmV2ZW50RGVmYXVsdDtcblx0XHRcdH1cblxuXHRcdFx0Y2FzZSBSZXN1bHRLaW5kLktiRm91bmQ6IHtcblxuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCdLZXliaW5kaW5nU2VydmljZSNkaXNwYXRjaCcsIGtleXByZXNzTGFiZWwsIGBbIFdpbGwgZGlzcGF0Y2ggY29tbWFuZCAke3Jlc29sdmVSZXN1bHQuY29tbWFuZElkfSBdYCk7XG5cblx0XHRcdFx0aWYgKHJlc29sdmVSZXN1bHQuY29tbWFuZElkID09PSBudWxsIHx8IHJlc29sdmVSZXN1bHQuY29tbWFuZElkID09PSAnJykge1xuXG5cdFx0XHRcdFx0aWYgKHRoaXMuaW5DaG9yZE1vZGUpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGN1cnJlbnRDaG9yZHNMYWJlbCA9IHRoaXMuX2N1cnJlbnRDaG9yZHMubWFwKCh7IGxhYmVsIH0pID0+IGxhYmVsKS5qb2luKCcsICcpO1xuXHRcdFx0XHRcdFx0dGhpcy5fbG9nKGArIExlYXZpbmcgY2hvcmQgbW9kZTogTm90aGluZyBib3VuZCB0byBcIiR7Y3VycmVudENob3Jkc0xhYmVsfSwgJHtrZXlwcmVzc0xhYmVsfVwiLmApO1xuXHRcdFx0XHRcdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS5zdGF0dXMobmxzLmxvY2FsaXplKCdtaXNzaW5nLmNob3JkJywgXCJUaGUga2V5IGNvbWJpbmF0aW9uICh7MH0sIHsxfSkgaXMgbm90IGEgY29tbWFuZC5cIiwgY3VycmVudENob3Jkc0xhYmVsLCBrZXlwcmVzc0xhYmVsKSwgeyBoaWRlQWZ0ZXI6IDEwICogMTAwMCAvKiAxMHMgKi8gfSk7XG5cdFx0XHRcdFx0XHR0aGlzLl9sZWF2ZUNob3JkTW9kZSgpO1xuXHRcdFx0XHRcdFx0c2hvdWxkUHJldmVudERlZmF1bHQgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmICh0aGlzLmluQ2hvcmRNb2RlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9sZWF2ZUNob3JkTW9kZSgpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghcmVzb2x2ZVJlc3VsdC5pc0J1YmJsZSkge1xuXHRcdFx0XHRcdFx0c2hvdWxkUHJldmVudERlZmF1bHQgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoaXMuX2xvZyhgKyBJbnZva2luZyBjb21tYW5kICR7cmVzb2x2ZVJlc3VsdC5jb21tYW5kSWR9LmApO1xuXHRcdFx0XHRcdHRoaXMuX2N1cnJlbnRseURpc3BhdGNoaW5nQ29tbWFuZElkID0gcmVzb2x2ZVJlc3VsdC5jb21tYW5kSWQ7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGlmICh0eXBlb2YgcmVzb2x2ZVJlc3VsdC5jb21tYW5kQXJncyA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQocmVzb2x2ZVJlc3VsdC5jb21tYW5kSWQpLnRoZW4odW5kZWZpbmVkLCBlcnIgPT4gdGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS53YXJuKGVycikpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQocmVzb2x2ZVJlc3VsdC5jb21tYW5kSWQsIHJlc29sdmVSZXN1bHQuY29tbWFuZEFyZ3MpLnRoZW4odW5kZWZpbmVkLCBlcnIgPT4gdGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS53YXJuKGVycikpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9jdXJyZW50bHlEaXNwYXRjaGluZ0NvbW1hbmRJZCA9IG51bGw7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKCFISUdIX0ZSRVFfQ09NTUFORFMudGVzdChyZXNvbHZlUmVzdWx0LmNvbW1hbmRJZCkpIHtcblx0XHRcdFx0XHRcdHRoaXMuX3RlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uPignd29ya2JlbmNoQWN0aW9uRXhlY3V0ZWQnLCB7IGlkOiByZXNvbHZlUmVzdWx0LmNvbW1hbmRJZCwgZnJvbTogJ2tleWJpbmRpbmcnLCBkZXRhaWw6IHVzZXJLZXlwcmVzcy5nZXRVc2VyU2V0dGluZ3NMYWJlbCgpID8/IHVuZGVmaW5lZCB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gc2hvdWxkUHJldmVudERlZmF1bHQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YWJzdHJhY3QgZW5hYmxlS2V5YmluZGluZ0hvbGRNb2RlKGNvbW1hbmRJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZDtcblxuXHRtaWdodFByb2R1Y2VQcmludGFibGVDaGFyYWN0ZXIoZXZlbnQ6IElLZXlib2FyZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0aWYgKGV2ZW50LmN0cmxLZXkgfHwgZXZlbnQubWV0YUtleSkge1xuXHRcdFx0Ly8gaWdub3JlIGN0cmwvY21kLWNvbWJpbmF0aW9uIGJ1dCBub3Qgc2hpZnQvYWx0LWNvbWJpbmF0aW9zXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdC8vIHdlYWsgY2hlY2sgZm9yIGNlcnRhaW4gcmFuZ2VzLiB0aGlzIGlzIHByb3Blcmx5IGltcGxlbWVudGVkIGluIGEgc3ViY2xhc3Ncblx0XHQvLyB3aXRoIGFjY2VzcyB0byB0aGUgS2V5Ym9hcmRNYXBwZXJGYWN0b3J5LlxuXHRcdGlmICgoZXZlbnQua2V5Q29kZSA+PSBLZXlDb2RlLktleUEgJiYgZXZlbnQua2V5Q29kZSA8PSBLZXlDb2RlLktleVopXG5cdFx0XHR8fCAoZXZlbnQua2V5Q29kZSA+PSBLZXlDb2RlLkRpZ2l0MCAmJiBldmVudC5rZXlDb2RlIDw9IEtleUNvZGUuRGlnaXQ5KSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufVxuXG5jbGFzcyBLZXliaW5kaW5nTW9kaWZpZXJTZXQge1xuXG5cdHB1YmxpYyBzdGF0aWMgRU1QVFkgPSBuZXcgS2V5YmluZGluZ01vZGlmaWVyU2V0KG51bGwpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2N0cmxLZXk6IGJvb2xlYW47XG5cdHByaXZhdGUgcmVhZG9ubHkgX3NoaWZ0S2V5OiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hbHRLZXk6IGJvb2xlYW47XG5cdHByaXZhdGUgcmVhZG9ubHkgX21ldGFLZXk6IGJvb2xlYW47XG5cblx0Y29uc3RydWN0b3Ioc291cmNlOiBSZXNvbHZlZENob3JkIHwgbnVsbCkge1xuXHRcdHRoaXMuX2N0cmxLZXkgPSBzb3VyY2UgPyBzb3VyY2UuY3RybEtleSA6IGZhbHNlO1xuXHRcdHRoaXMuX3NoaWZ0S2V5ID0gc291cmNlID8gc291cmNlLnNoaWZ0S2V5IDogZmFsc2U7XG5cdFx0dGhpcy5fYWx0S2V5ID0gc291cmNlID8gc291cmNlLmFsdEtleSA6IGZhbHNlO1xuXHRcdHRoaXMuX21ldGFLZXkgPSBzb3VyY2UgPyBzb3VyY2UubWV0YUtleSA6IGZhbHNlO1xuXHR9XG5cblx0aGFzKG1vZGlmaWVyOiBTaW5nbGVNb2RpZmllckNob3JkKSB7XG5cdFx0c3dpdGNoIChtb2RpZmllcikge1xuXHRcdFx0Y2FzZSAnY3RybCc6IHJldHVybiB0aGlzLl9jdHJsS2V5O1xuXHRcdFx0Y2FzZSAnc2hpZnQnOiByZXR1cm4gdGhpcy5fc2hpZnRLZXk7XG5cdFx0XHRjYXNlICdhbHQnOiByZXR1cm4gdGhpcy5fYWx0S2V5O1xuXHRcdFx0Y2FzZSAnbWV0YSc6IHJldHVybiB0aGlzLl9tZXRhS2V5O1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsWUFBWSxZQUFZO0FBQ3hCLFNBQVMsZUFBZSxvQkFBb0I7QUFDNUMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsZUFBZTtBQUV4QixTQUFTLGtCQUErQjtBQUN4QyxZQUFZLFNBQVM7QUFLckIsU0FBK0MsWUFBWSxvQkFBb0I7QUFXL0UsTUFBTSxxQkFBcUI7QUFFcEIsTUFBZSxrQ0FBa0MsV0FBeUM7QUFBQSxFQStCaEcsWUFDUyxvQkFDRSxpQkFDQSxtQkFDRixzQkFDRSxhQUNUO0FBQ0QsVUFBTTtBQU5FO0FBQ0U7QUFDQTtBQUNGO0FBQ0U7QUFoQ1gsU0FBbUIsMEJBQXlDLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQW9DN0YsU0FBSyxpQkFBaUIsQ0FBQztBQUN2QixTQUFLLHVCQUF1QixJQUFJLGNBQWM7QUFDOUMsU0FBSyw2QkFBNkI7QUFDbEMsU0FBSyx5QkFBeUIsc0JBQXNCO0FBQ3BELFNBQUsseUJBQXlCO0FBQzlCLFNBQUsscUNBQXFDLElBQUksYUFBYTtBQUMzRCxTQUFLLGlDQUFpQztBQUN0QyxTQUFLLFdBQVc7QUFBQSxFQUNqQjtBQUFBLEVBM0NBLElBQUkseUJBQXNDO0FBQ3pDLFdBQU8sS0FBSywwQkFBMEIsS0FBSyx3QkFBd0IsUUFBUSxNQUFNO0FBQUEsRUFDbEY7QUFBQSxFQW9CQSxJQUFXLGNBQXVCO0FBQ2pDLFdBQU8sS0FBSyxlQUFlLFNBQVM7QUFBQSxFQUNyQztBQUFBLEVBcUJnQixVQUFnQjtBQUMvQixVQUFNLFFBQVE7QUFBQSxFQUNmO0FBQUEsRUFXTywrQkFBdUM7QUFDN0MsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVPLGdCQUF5QjtBQUMvQixTQUFLLFdBQVcsQ0FBQyxLQUFLO0FBQ3RCLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVVLEtBQUssS0FBbUI7QUFDakMsUUFBSSxLQUFLLFVBQVU7QUFDbEIsV0FBSyxZQUFZLEtBQUssd0JBQXdCLEdBQUcsRUFBRTtBQUFBLElBQ3BEO0FBQUEsRUFDRDtBQUFBLEVBRU8sd0JBQTJEO0FBQ2pFLFdBQU8sS0FBSyxhQUFhLEVBQUUsc0JBQXNCO0FBQUEsRUFDbEQ7QUFBQSxFQUVPLGlCQUFvRDtBQUMxRCxXQUFPLEtBQUssYUFBYSxFQUFFLGVBQWU7QUFBQSxFQUMzQztBQUFBLEVBRU8seUJBQWlDO0FBQ3ZDLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxrQkFBa0IsV0FBeUM7QUFDakUsV0FBTyxPQUFPO0FBQUEsTUFDYixLQUFLLGFBQWEsRUFBRSxrQkFBa0IsU0FBUyxFQUFFLElBQUksVUFBUSxLQUFLLGtCQUFrQjtBQUFBLElBQ3JGO0FBQUEsRUFDRDtBQUFBLEVBRU8saUJBQWlCLFdBQW1CLFNBQThCLHNCQUFzQixPQUF1QztBQUNySSxVQUFNLFNBQVMsS0FBSyxhQUFhLEVBQUUsd0JBQXdCLFdBQVcsV0FBVyxLQUFLLG9CQUFvQixtQkFBbUI7QUFDN0gsUUFBSSxDQUFDLFFBQVE7QUFDWixhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU8sT0FBTztBQUFBLEVBQ2Y7QUFBQSxFQUVPLGNBQWMsR0FBbUIsUUFBMkM7QUFDbEYsV0FBTyxLQUFLLFVBQVUsR0FBRyxNQUFNO0FBQUEsRUFDaEM7QUFBQTtBQUFBO0FBQUEsRUFJTyxhQUFhLEdBQW1CLFFBQW9EO0FBQzFGLFNBQUssS0FBSyxtQ0FBbUM7QUFDN0MsVUFBTSxhQUFhLEtBQUsscUJBQXFCLENBQUM7QUFDOUMsUUFBSSxXQUFXLGtCQUFrQixHQUFHO0FBQ25DLGNBQVEsS0FBSyx3REFBd0Q7QUFDckUsYUFBTztBQUFBLElBQ1I7QUFDQSxVQUFNLENBQUMsVUFBVyxJQUFJLFdBQVcsa0JBQWtCO0FBQ25ELFFBQUksZUFBZSxNQUFNO0FBRXhCLFdBQUssS0FBSyx3Q0FBd0M7QUFDbEQsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLGVBQWUsS0FBSyxtQkFBbUIsV0FBVyxNQUFNO0FBQzlELFVBQU0sZ0JBQWdCLEtBQUssZUFBZSxJQUFLLENBQUMsRUFBRSxTQUFTLE1BQU0sUUFBUztBQUMxRSxXQUFPLEtBQUssYUFBYSxFQUFFLFFBQVEsY0FBYyxlQUFlLFVBQVU7QUFBQSxFQUMzRTtBQUFBLEVBRVEsMEJBQWdDO0FBQ3ZDLFVBQU0sMEJBQTBCLEtBQUssSUFBSTtBQUN6QyxTQUFLLHFCQUFxQixhQUFhLE1BQU07QUFFNUMsVUFBSSxDQUFDLEtBQUssa0JBQWtCLEdBQUc7QUFFOUIsYUFBSyxnQkFBZ0I7QUFDckI7QUFBQSxNQUNEO0FBRUEsVUFBSSxLQUFLLElBQUksSUFBSSwwQkFBMEIsS0FBTTtBQUVoRCxhQUFLLGdCQUFnQjtBQUFBLE1BQ3RCO0FBQUEsSUFFRCxHQUFHLEdBQUc7QUFBQSxFQUNQO0FBQUEsRUFFUSxvQkFBb0IsWUFBb0IsZUFBb0M7QUFFbkYsU0FBSyxlQUFlLEtBQUssRUFBRSxVQUFVLFlBQVksT0FBTyxjQUFjLENBQUM7QUFFdkUsWUFBUSxLQUFLLGVBQWUsUUFBUTtBQUFBLE1BQ25DLEtBQUs7QUFDSixjQUFNLGFBQWEsWUFBWTtBQUFBLE1BQ2hDLEtBQUs7QUFFSixhQUFLLDZCQUE2QixLQUFLLHFCQUFxQixPQUFPLElBQUksU0FBUyxlQUFlLHlEQUF5RCxhQUFhLENBQUM7QUFDdEs7QUFBQSxNQUNELFNBQVM7QUFDUixjQUFNLG9CQUFvQixLQUFLLGVBQWUsSUFBSSxDQUFDLEVBQUUsTUFBTSxNQUFNLEtBQUssRUFBRSxLQUFLLElBQUk7QUFDakYsYUFBSyw2QkFBNkIsS0FBSyxxQkFBcUIsT0FBTyxJQUFJLFNBQVMsY0FBYyx1REFBdUQsaUJBQWlCLENBQUM7QUFBQSxNQUN4SztBQUFBLElBQ0Q7QUFFQSxTQUFLLHdCQUF3QjtBQUU3QixRQUFJLElBQUksU0FBUztBQUNoQixVQUFJLFFBQVE7QUFBQSxJQUNiO0FBQUEsRUFDRDtBQUFBLEVBRVEsa0JBQXdCO0FBQy9CLFFBQUksS0FBSyw0QkFBNEI7QUFDcEMsV0FBSywyQkFBMkIsUUFBUTtBQUN4QyxXQUFLLDZCQUE2QjtBQUFBLElBQ25DO0FBQ0EsU0FBSyxxQkFBcUIsT0FBTztBQUNqQyxTQUFLLGlCQUFpQixDQUFDO0FBQ3ZCLFFBQUksT0FBTztBQUFBLEVBQ1o7QUFBQSxFQUVPLDRCQUE0QixtQkFBMkIsUUFBd0M7QUFDckcsU0FBSyxLQUFLLG1FQUFtRSxpQkFBaUIsRUFBRTtBQUNoRyxVQUFNLGNBQWMsS0FBSyxtQkFBbUIsaUJBQWlCO0FBQzdELFFBQUksWUFBWSxXQUFXLEdBQUc7QUFDN0IsV0FBSyxLQUFLLDBCQUEwQixpQkFBaUIsRUFBRTtBQUFBLElBQ3hELE9BQU87QUFDTixXQUFLO0FBQUEsUUFBWSxZQUFZLENBQUM7QUFBQSxRQUFHO0FBQUE7QUFBQSxRQUFnQztBQUFBLE1BQUs7QUFBQSxJQUN2RTtBQUFBLEVBQ0Q7QUFBQSxFQUVVLFVBQVUsR0FBbUIsUUFBMkM7QUFDakYsV0FBTyxLQUFLO0FBQUEsTUFBWSxLQUFLLHFCQUFxQixDQUFDO0FBQUEsTUFBRztBQUFBO0FBQUEsTUFBZ0M7QUFBQSxJQUFLO0FBQUEsRUFDNUY7QUFBQSxFQUVVLHdCQUF3QixHQUFtQixRQUEyQztBQUMvRixVQUFNLGFBQWEsS0FBSyxxQkFBcUIsQ0FBQztBQUM5QyxVQUFNLENBQUMsY0FBZSxJQUFJLFdBQVcsZ0NBQWdDO0FBRXJFLFFBQUksZ0JBQWdCO0FBRW5CLFVBQUksS0FBSyx1QkFBdUIsSUFBSSxjQUFjLEdBQUc7QUFDcEQsYUFBSyxLQUFLLDhCQUE4QixjQUFjLG9EQUFvRDtBQUMxRyxhQUFLLHlCQUF5QixzQkFBc0I7QUFDcEQsYUFBSyxtQ0FBbUMsT0FBTztBQUMvQyxhQUFLLHlCQUF5QjtBQUM5QixlQUFPO0FBQUEsTUFDUjtBQUVBLFdBQUsseUJBQXlCLHNCQUFzQjtBQUVwRCxVQUFJLEtBQUssMkJBQTJCLE1BQU07QUFFekMsYUFBSyxLQUFLLGdEQUFnRCxjQUFjLEdBQUc7QUFDM0UsYUFBSyx5QkFBeUI7QUFDOUIsYUFBSyxtQ0FBbUMsYUFBYSxNQUFNO0FBQzFELGVBQUssS0FBSyxrREFBa0Q7QUFDNUQsZUFBSyx5QkFBeUI7QUFBQSxRQUMvQixHQUFHLEdBQUc7QUFDTixlQUFPO0FBQUEsTUFDUjtBQUVBLFVBQUksbUJBQW1CLEtBQUssd0JBQXdCO0FBRW5ELGFBQUssS0FBSyx1Q0FBdUMsY0FBYyxJQUFJLGNBQWMsRUFBRTtBQUNuRixhQUFLLG1DQUFtQyxPQUFPO0FBQy9DLGFBQUsseUJBQXlCO0FBQzlCLGVBQU8sS0FBSztBQUFBLFVBQVk7QUFBQSxVQUFZO0FBQUE7QUFBQSxVQUFnQztBQUFBLFFBQUk7QUFBQSxNQUN6RTtBQUVBLFdBQUssS0FBSyx3REFBd0QsS0FBSyxzQkFBc0IsSUFBSSxjQUFjLEVBQUU7QUFDakgsV0FBSyxtQ0FBbUMsT0FBTztBQUMvQyxXQUFLLHlCQUF5QjtBQUM5QixhQUFPO0FBQUEsSUFDUjtBQUlBLFVBQU0sQ0FBQyxVQUFXLElBQUksV0FBVyxVQUFVO0FBQzNDLFNBQUsseUJBQXlCLElBQUksc0JBQXNCLFVBQVU7QUFFbEUsUUFBSSxLQUFLLDJCQUEyQixNQUFNO0FBQ3pDLFdBQUssS0FBSyxpREFBaUQ7QUFBQSxJQUM1RDtBQUNBLFNBQUssbUNBQW1DLE9BQU87QUFDL0MsU0FBSyx5QkFBeUI7QUFDOUIsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLFlBQVksY0FBa0MsUUFBa0MsdUJBQXVCLE9BQWdCO0FBQzlILFFBQUksdUJBQXVCO0FBRTNCLFFBQUksYUFBYSxrQkFBa0IsR0FBRztBQUNyQyxjQUFRLEtBQUsscURBQXFEO0FBQ2xFLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxtQkFBa0M7QUFDdEMsUUFBSSxnQkFBaUM7QUFFckMsUUFBSSxzQkFBc0I7QUFJekIsWUFBTSxDQUFDLGVBQWdCLElBQUksYUFBYSxnQ0FBZ0M7QUFDeEUseUJBQW1CO0FBQ25CLHNCQUFnQixrQkFBa0IsQ0FBQyxlQUFlLElBQUksQ0FBQztBQUFBLElBQ3hELE9BQU87QUFDTixPQUFDLGdCQUFpQixJQUFJLGFBQWEsa0JBQWtCO0FBQ3JELHNCQUFnQixLQUFLLGVBQWUsSUFBSSxDQUFDLEVBQUUsU0FBUyxNQUFNLFFBQVE7QUFBQSxJQUNuRTtBQUVBLFFBQUkscUJBQXFCLE1BQU07QUFDOUIsV0FBSyxLQUFLLDBEQUEwRDtBQUVwRSxhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sZUFBZSxLQUFLLG1CQUFtQixXQUFXLE1BQU07QUFDOUQsVUFBTSxnQkFBZ0IsYUFBYSxTQUFTO0FBRTVDLFVBQU0sZ0JBQWdCLEtBQUssYUFBYSxFQUFFLFFBQVEsY0FBYyxlQUFlLGdCQUFnQjtBQUUvRixZQUFRLGNBQWMsTUFBTTtBQUFBLE1BRTNCLEtBQUssV0FBVyxjQUFjO0FBRTdCLGFBQUssWUFBWSxNQUFNLDhCQUE4QixlQUFlLDRCQUE0QjtBQUVoRyxZQUFJLEtBQUssYUFBYTtBQUNyQixnQkFBTSxxQkFBcUIsS0FBSyxlQUFlLElBQUksQ0FBQyxFQUFFLE1BQU0sTUFBTSxLQUFLLEVBQUUsS0FBSyxJQUFJO0FBQ2xGLGVBQUssS0FBSyxpREFBaUQsa0JBQWtCLEtBQUssYUFBYSxJQUFJO0FBQ25HLGVBQUsscUJBQXFCLE9BQU8sSUFBSSxTQUFTLGlCQUFpQixvREFBb0Qsb0JBQW9CLGFBQWEsR0FBRztBQUFBLFlBQUUsV0FBVyxLQUFLO0FBQUE7QUFBQSxVQUFlLENBQUM7QUFDekwsZUFBSyxnQkFBZ0I7QUFFckIsaUNBQXVCO0FBQUEsUUFDeEI7QUFDQSxlQUFPO0FBQUEsTUFDUjtBQUFBLE1BRUEsS0FBSyxXQUFXLGtCQUFrQjtBQUVqQyxhQUFLLFlBQVksTUFBTSw4QkFBOEIsZUFBZSxvREFBb0Q7QUFFeEgsK0JBQXVCO0FBQ3ZCLGFBQUssb0JBQW9CLGtCQUFrQixhQUFhO0FBQ3hELGFBQUssS0FBSyxLQUFLLGVBQWUsV0FBVyxJQUFJLG1DQUFtQyxrQ0FBa0M7QUFDbEgsZUFBTztBQUFBLE1BQ1I7QUFBQSxNQUVBLEtBQUssV0FBVyxTQUFTO0FBRXhCLGFBQUssWUFBWSxNQUFNLDhCQUE4QixlQUFlLDJCQUEyQixjQUFjLFNBQVMsSUFBSTtBQUUxSCxZQUFJLGNBQWMsY0FBYyxRQUFRLGNBQWMsY0FBYyxJQUFJO0FBRXZFLGNBQUksS0FBSyxhQUFhO0FBQ3JCLGtCQUFNLHFCQUFxQixLQUFLLGVBQWUsSUFBSSxDQUFDLEVBQUUsTUFBTSxNQUFNLEtBQUssRUFBRSxLQUFLLElBQUk7QUFDbEYsaUJBQUssS0FBSywyQ0FBMkMsa0JBQWtCLEtBQUssYUFBYSxJQUFJO0FBQzdGLGlCQUFLLHFCQUFxQixPQUFPLElBQUksU0FBUyxpQkFBaUIsb0RBQW9ELG9CQUFvQixhQUFhLEdBQUc7QUFBQSxjQUFFLFdBQVcsS0FBSztBQUFBO0FBQUEsWUFBZSxDQUFDO0FBQ3pMLGlCQUFLLGdCQUFnQjtBQUNyQixtQ0FBdUI7QUFBQSxVQUN4QjtBQUFBLFFBRUQsT0FBTztBQUNOLGNBQUksS0FBSyxhQUFhO0FBQ3JCLGlCQUFLLGdCQUFnQjtBQUFBLFVBQ3RCO0FBRUEsY0FBSSxDQUFDLGNBQWMsVUFBVTtBQUM1QixtQ0FBdUI7QUFBQSxVQUN4QjtBQUVBLGVBQUssS0FBSyxzQkFBc0IsY0FBYyxTQUFTLEdBQUc7QUFDMUQsZUFBSyxpQ0FBaUMsY0FBYztBQUNwRCxjQUFJO0FBQ0gsZ0JBQUksT0FBTyxjQUFjLGdCQUFnQixhQUFhO0FBQ3JELG1CQUFLLGdCQUFnQixlQUFlLGNBQWMsU0FBUyxFQUFFLEtBQUssUUFBVyxTQUFPLEtBQUsscUJBQXFCLEtBQUssR0FBRyxDQUFDO0FBQUEsWUFDeEgsT0FBTztBQUNOLG1CQUFLLGdCQUFnQixlQUFlLGNBQWMsV0FBVyxjQUFjLFdBQVcsRUFBRSxLQUFLLFFBQVcsU0FBTyxLQUFLLHFCQUFxQixLQUFLLEdBQUcsQ0FBQztBQUFBLFlBQ25KO0FBQUEsVUFDRCxVQUFFO0FBQ0QsaUJBQUssaUNBQWlDO0FBQUEsVUFDdkM7QUFFQSxjQUFJLENBQUMsbUJBQW1CLEtBQUssY0FBYyxTQUFTLEdBQUc7QUFDdEQsaUJBQUssa0JBQWtCLFdBQWdGLDJCQUEyQixFQUFFLElBQUksY0FBYyxXQUFXLE1BQU0sY0FBYyxRQUFRLGFBQWEscUJBQXFCLEtBQUssT0FBVSxDQUFDO0FBQUEsVUFDaFA7QUFBQSxRQUNEO0FBRUEsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBSUEsK0JBQStCLE9BQWdDO0FBQzlELFFBQUksTUFBTSxXQUFXLE1BQU0sU0FBUztBQUVuQyxhQUFPO0FBQUEsSUFDUjtBQUdBLFFBQUssTUFBTSxXQUFXLFFBQVEsUUFBUSxNQUFNLFdBQVcsUUFBUSxRQUMxRCxNQUFNLFdBQVcsUUFBUSxVQUFVLE1BQU0sV0FBVyxRQUFRLFFBQVM7QUFDekUsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBRUEsTUFBTSx5QkFBTixNQUFNLHVCQUFzQjtBQUFBLEVBUzNCLFlBQVksUUFBOEI7QUFDekMsU0FBSyxXQUFXLFNBQVMsT0FBTyxVQUFVO0FBQzFDLFNBQUssWUFBWSxTQUFTLE9BQU8sV0FBVztBQUM1QyxTQUFLLFVBQVUsU0FBUyxPQUFPLFNBQVM7QUFDeEMsU0FBSyxXQUFXLFNBQVMsT0FBTyxVQUFVO0FBQUEsRUFDM0M7QUFBQSxFQUVBLElBQUksVUFBK0I7QUFDbEMsWUFBUSxVQUFVO0FBQUEsTUFDakIsS0FBSztBQUFRLGVBQU8sS0FBSztBQUFBLE1BQ3pCLEtBQUs7QUFBUyxlQUFPLEtBQUs7QUFBQSxNQUMxQixLQUFLO0FBQU8sZUFBTyxLQUFLO0FBQUEsTUFDeEIsS0FBSztBQUFRLGVBQU8sS0FBSztBQUFBLElBQzFCO0FBQUEsRUFDRDtBQUNEO0FBeEJNLHVCQUVTLFFBQVEsSUFBSSx1QkFBc0IsSUFBSTtBQUZyRCxJQUFNLHdCQUFOOyIsCiAgIm5hbWVzIjogW10KfQo=
