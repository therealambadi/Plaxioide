import { CharCode } from "../../../../base/common/charCode.js";
import { KeyCode, KeyCodeUtils, IMMUTABLE_CODE_TO_KEY_CODE, ScanCode, ScanCodeUtils, NATIVE_WINDOWS_KEY_CODE_TO_KEY_CODE } from "../../../../base/common/keyCodes.js";
import { KeyCodeChord, ScanCodeChord } from "../../../../base/common/keybindings.js";
import { UILabelProvider } from "../../../../base/common/keybindingLabels.js";
import { OperatingSystem } from "../../../../base/common/platform.js";
import { BaseResolvedKeybinding } from "../../../../platform/keybinding/common/baseResolvedKeybinding.js";
import { toEmptyArrayIfContainsNull } from "../../../../platform/keybinding/common/resolvedKeybindingItem.js";
const LOG = false;
function log(str) {
  if (LOG) {
    console.info(str);
  }
}
class WindowsNativeResolvedKeybinding extends BaseResolvedKeybinding {
  constructor(mapper, chords) {
    super(OperatingSystem.Windows, chords);
    this._mapper = mapper;
  }
  _getLabel(chord) {
    if (chord.isDuplicateModifierCase()) {
      return "";
    }
    return this._mapper.getUILabelForKeyCode(chord.keyCode);
  }
  _getUSLabelForKeybinding(chord) {
    if (chord.isDuplicateModifierCase()) {
      return "";
    }
    return KeyCodeUtils.toString(chord.keyCode);
  }
  getUSLabel() {
    return UILabelProvider.toLabel(this._os, this._chords, (keybinding) => this._getUSLabelForKeybinding(keybinding));
  }
  _getAriaLabel(chord) {
    if (chord.isDuplicateModifierCase()) {
      return "";
    }
    return this._mapper.getAriaLabelForKeyCode(chord.keyCode);
  }
  _getElectronAccelerator(chord) {
    return this._mapper.getElectronAcceleratorForKeyBinding(chord);
  }
  _getUserSettingsLabel(chord) {
    if (chord.isDuplicateModifierCase()) {
      return "";
    }
    const result = this._mapper.getUserSettingsLabelForKeyCode(chord.keyCode);
    return result ? result.toLowerCase() : result;
  }
  _isWYSIWYG(chord) {
    return this.__isWYSIWYG(chord.keyCode);
  }
  __isWYSIWYG(keyCode) {
    if (keyCode === KeyCode.LeftArrow || keyCode === KeyCode.UpArrow || keyCode === KeyCode.RightArrow || keyCode === KeyCode.DownArrow) {
      return true;
    }
    const ariaLabel = this._mapper.getAriaLabelForKeyCode(keyCode);
    const userSettingsLabel = this._mapper.getUserSettingsLabelForKeyCode(keyCode);
    return ariaLabel === userSettingsLabel;
  }
  _getChordDispatch(chord) {
    if (chord.isModifierKey()) {
      return null;
    }
    let result = "";
    if (chord.ctrlKey) {
      result += "ctrl+";
    }
    if (chord.shiftKey) {
      result += "shift+";
    }
    if (chord.altKey) {
      result += "alt+";
    }
    if (chord.metaKey) {
      result += "meta+";
    }
    result += KeyCodeUtils.toString(chord.keyCode);
    return result;
  }
  _getSingleModifierChordDispatch(chord) {
    if (chord.keyCode === KeyCode.Ctrl && !chord.shiftKey && !chord.altKey && !chord.metaKey) {
      return "ctrl";
    }
    if (chord.keyCode === KeyCode.Shift && !chord.ctrlKey && !chord.altKey && !chord.metaKey) {
      return "shift";
    }
    if (chord.keyCode === KeyCode.Alt && !chord.ctrlKey && !chord.shiftKey && !chord.metaKey) {
      return "alt";
    }
    if (chord.keyCode === KeyCode.Meta && !chord.ctrlKey && !chord.shiftKey && !chord.altKey) {
      return "meta";
    }
    return null;
  }
  static getProducedCharCode(chord, mapping) {
    if (!mapping) {
      return null;
    }
    if (chord.ctrlKey && chord.shiftKey && chord.altKey) {
      return mapping.withShiftAltGr;
    }
    if (chord.ctrlKey && chord.altKey) {
      return mapping.withAltGr;
    }
    if (chord.shiftKey) {
      return mapping.withShift;
    }
    return mapping.value;
  }
  static getProducedChar(chord, mapping) {
    const char = this.getProducedCharCode(chord, mapping);
    if (char === null || char.length === 0) {
      return " --- ";
    }
    return "  " + char + "  ";
  }
}
class WindowsKeyboardMapper {
  constructor(_isUSStandard, rawMappings, _mapAltGrToCtrlAlt) {
    this._isUSStandard = _isUSStandard;
    this._mapAltGrToCtrlAlt = _mapAltGrToCtrlAlt;
    this._keyCodeToLabel = [];
    this._scanCodeToKeyCode = [];
    this._keyCodeToLabel = [];
    this._keyCodeExists = [];
    this._keyCodeToLabel[KeyCode.Unknown] = KeyCodeUtils.toString(KeyCode.Unknown);
    for (let scanCode = ScanCode.None; scanCode < ScanCode.MAX_VALUE; scanCode++) {
      const immutableKeyCode = IMMUTABLE_CODE_TO_KEY_CODE[scanCode];
      if (immutableKeyCode !== KeyCode.DependsOnKbLayout) {
        this._scanCodeToKeyCode[scanCode] = immutableKeyCode;
        this._keyCodeToLabel[immutableKeyCode] = KeyCodeUtils.toString(immutableKeyCode);
        this._keyCodeExists[immutableKeyCode] = true;
      }
    }
    const producesLetter = [];
    let producesLetters = false;
    this._codeInfo = [];
    for (const strCode in rawMappings) {
      if (rawMappings.hasOwnProperty(strCode)) {
        const scanCode = ScanCodeUtils.toEnum(strCode);
        if (scanCode === ScanCode.None) {
          log(`Unknown scanCode ${strCode} in mapping.`);
          continue;
        }
        const rawMapping = rawMappings[strCode];
        const immutableKeyCode = IMMUTABLE_CODE_TO_KEY_CODE[scanCode];
        if (immutableKeyCode !== KeyCode.DependsOnKbLayout) {
          const keyCode2 = NATIVE_WINDOWS_KEY_CODE_TO_KEY_CODE[rawMapping.vkey] || KeyCode.Unknown;
          if (keyCode2 === KeyCode.Unknown || immutableKeyCode === keyCode2) {
            continue;
          }
          if (scanCode !== ScanCode.NumpadComma) {
            continue;
          }
        }
        const value = rawMapping.value;
        const withShift = rawMapping.withShift;
        const withAltGr = rawMapping.withAltGr;
        const withShiftAltGr = rawMapping.withShiftAltGr;
        const keyCode = NATIVE_WINDOWS_KEY_CODE_TO_KEY_CODE[rawMapping.vkey] || KeyCode.Unknown;
        const mapping = {
          scanCode,
          keyCode,
          value,
          withShift,
          withAltGr,
          withShiftAltGr
        };
        this._codeInfo[scanCode] = mapping;
        this._scanCodeToKeyCode[scanCode] = keyCode;
        if (keyCode === KeyCode.Unknown) {
          continue;
        }
        this._keyCodeExists[keyCode] = true;
        if (value.length === 0) {
          this._keyCodeToLabel[keyCode] = null;
        } else if (value.length > 1) {
          this._keyCodeToLabel[keyCode] = value;
        } else {
          const charCode = value.charCodeAt(0);
          if (charCode >= CharCode.a && charCode <= CharCode.z) {
            const upperCaseValue = CharCode.A + (charCode - CharCode.a);
            producesLetter[upperCaseValue] = true;
            producesLetters = true;
            this._keyCodeToLabel[keyCode] = String.fromCharCode(CharCode.A + (charCode - CharCode.a));
          } else if (charCode >= CharCode.A && charCode <= CharCode.Z) {
            producesLetter[charCode] = true;
            producesLetters = true;
            this._keyCodeToLabel[keyCode] = value;
          } else {
            this._keyCodeToLabel[keyCode] = value;
          }
        }
      }
    }
    const _registerLetterIfMissing = (charCode, keyCode) => {
      if (!producesLetter[charCode]) {
        this._keyCodeToLabel[keyCode] = String.fromCharCode(charCode);
      }
    };
    _registerLetterIfMissing(CharCode.A, KeyCode.KeyA);
    _registerLetterIfMissing(CharCode.B, KeyCode.KeyB);
    _registerLetterIfMissing(CharCode.C, KeyCode.KeyC);
    _registerLetterIfMissing(CharCode.D, KeyCode.KeyD);
    _registerLetterIfMissing(CharCode.E, KeyCode.KeyE);
    _registerLetterIfMissing(CharCode.F, KeyCode.KeyF);
    _registerLetterIfMissing(CharCode.G, KeyCode.KeyG);
    _registerLetterIfMissing(CharCode.H, KeyCode.KeyH);
    _registerLetterIfMissing(CharCode.I, KeyCode.KeyI);
    _registerLetterIfMissing(CharCode.J, KeyCode.KeyJ);
    _registerLetterIfMissing(CharCode.K, KeyCode.KeyK);
    _registerLetterIfMissing(CharCode.L, KeyCode.KeyL);
    _registerLetterIfMissing(CharCode.M, KeyCode.KeyM);
    _registerLetterIfMissing(CharCode.N, KeyCode.KeyN);
    _registerLetterIfMissing(CharCode.O, KeyCode.KeyO);
    _registerLetterIfMissing(CharCode.P, KeyCode.KeyP);
    _registerLetterIfMissing(CharCode.Q, KeyCode.KeyQ);
    _registerLetterIfMissing(CharCode.R, KeyCode.KeyR);
    _registerLetterIfMissing(CharCode.S, KeyCode.KeyS);
    _registerLetterIfMissing(CharCode.T, KeyCode.KeyT);
    _registerLetterIfMissing(CharCode.U, KeyCode.KeyU);
    _registerLetterIfMissing(CharCode.V, KeyCode.KeyV);
    _registerLetterIfMissing(CharCode.W, KeyCode.KeyW);
    _registerLetterIfMissing(CharCode.X, KeyCode.KeyX);
    _registerLetterIfMissing(CharCode.Y, KeyCode.KeyY);
    _registerLetterIfMissing(CharCode.Z, KeyCode.KeyZ);
    if (!producesLetters) {
      const _registerLabel = (keyCode, charCode) => {
        this._keyCodeToLabel[keyCode] = String.fromCharCode(charCode);
      };
      _registerLabel(KeyCode.Semicolon, CharCode.Semicolon);
      _registerLabel(KeyCode.Equal, CharCode.Equals);
      _registerLabel(KeyCode.Comma, CharCode.Comma);
      _registerLabel(KeyCode.Minus, CharCode.Dash);
      _registerLabel(KeyCode.Period, CharCode.Period);
      _registerLabel(KeyCode.Slash, CharCode.Slash);
      _registerLabel(KeyCode.Backquote, CharCode.BackTick);
      _registerLabel(KeyCode.BracketLeft, CharCode.OpenSquareBracket);
      _registerLabel(KeyCode.Backslash, CharCode.Backslash);
      _registerLabel(KeyCode.BracketRight, CharCode.CloseSquareBracket);
      _registerLabel(KeyCode.Quote, CharCode.SingleQuote);
    }
  }
  dumpDebugInfo() {
    const result = [];
    const immutableSamples = [
      ScanCode.ArrowUp,
      ScanCode.Numpad0
    ];
    let cnt = 0;
    result.push(`-----------------------------------------------------------------------------------------------------------------------------------------`);
    for (let scanCode = ScanCode.None; scanCode < ScanCode.MAX_VALUE; scanCode++) {
      if (IMMUTABLE_CODE_TO_KEY_CODE[scanCode] !== KeyCode.DependsOnKbLayout) {
        if (immutableSamples.indexOf(scanCode) === -1) {
          continue;
        }
      }
      if (cnt % 6 === 0) {
        result.push(`|       HW Code combination      |  Key  |    KeyCode combination    |          UI label         |        User settings       | WYSIWYG |`);
        result.push(`-----------------------------------------------------------------------------------------------------------------------------------------`);
      }
      cnt++;
      const mapping = this._codeInfo[scanCode];
      const strCode = ScanCodeUtils.toString(scanCode);
      const mods = [0, 2, 5, 7];
      for (const mod of mods) {
        const ctrlKey = mod & 1 ? true : false;
        const shiftKey = mod & 2 ? true : false;
        const altKey = mod & 4 ? true : false;
        const scanCodeChord = new ScanCodeChord(ctrlKey, shiftKey, altKey, false, scanCode);
        const keyCodeChord = this._resolveChord(scanCodeChord);
        const strKeyCode = keyCodeChord ? KeyCodeUtils.toString(keyCodeChord.keyCode) : null;
        const resolvedKb = keyCodeChord ? new WindowsNativeResolvedKeybinding(this, [keyCodeChord]) : null;
        const outScanCode = `${ctrlKey ? "Ctrl+" : ""}${shiftKey ? "Shift+" : ""}${altKey ? "Alt+" : ""}${strCode}`;
        const ariaLabel = resolvedKb ? resolvedKb.getAriaLabel() : null;
        const outUILabel = ariaLabel ? ariaLabel.replace(/Control\+/, "Ctrl+") : null;
        const outUserSettings = resolvedKb ? resolvedKb.getUserSettingsLabel() : null;
        const outKey = WindowsNativeResolvedKeybinding.getProducedChar(scanCodeChord, mapping);
        const outKb = strKeyCode ? `${ctrlKey ? "Ctrl+" : ""}${shiftKey ? "Shift+" : ""}${altKey ? "Alt+" : ""}${strKeyCode}` : null;
        const isWYSIWYG = resolvedKb ? resolvedKb.isWYSIWYG() : false;
        const outWYSIWYG = isWYSIWYG ? "       " : "   NO  ";
        result.push(`| ${this._leftPad(outScanCode, 30)} | ${outKey} | ${this._leftPad(outKb, 25)} | ${this._leftPad(outUILabel, 25)} |  ${this._leftPad(outUserSettings, 25)} | ${outWYSIWYG} |`);
      }
      result.push(`-----------------------------------------------------------------------------------------------------------------------------------------`);
    }
    return result.join("\n");
  }
  _leftPad(str, cnt) {
    if (str === null) {
      str = "null";
    }
    while (str.length < cnt) {
      str = " " + str;
    }
    return str;
  }
  getUILabelForKeyCode(keyCode) {
    return this._getLabelForKeyCode(keyCode);
  }
  getAriaLabelForKeyCode(keyCode) {
    return this._getLabelForKeyCode(keyCode);
  }
  getUserSettingsLabelForKeyCode(keyCode) {
    if (this._isUSStandard) {
      return KeyCodeUtils.toUserSettingsUS(keyCode);
    }
    return KeyCodeUtils.toUserSettingsGeneral(keyCode);
  }
  getElectronAcceleratorForKeyBinding(chord) {
    return KeyCodeUtils.toElectronAccelerator(chord.keyCode);
  }
  _getLabelForKeyCode(keyCode) {
    return this._keyCodeToLabel[keyCode] || KeyCodeUtils.toString(KeyCode.Unknown);
  }
  resolveKeyboardEvent(keyboardEvent) {
    const ctrlKey = keyboardEvent.ctrlKey || this._mapAltGrToCtrlAlt && keyboardEvent.altGraphKey;
    const altKey = keyboardEvent.altKey || this._mapAltGrToCtrlAlt && keyboardEvent.altGraphKey;
    const chord = new KeyCodeChord(ctrlKey, keyboardEvent.shiftKey, altKey, keyboardEvent.metaKey, keyboardEvent.keyCode);
    return new WindowsNativeResolvedKeybinding(this, [chord]);
  }
  _resolveChord(chord) {
    if (!chord) {
      return null;
    }
    if (chord instanceof KeyCodeChord) {
      if (!this._keyCodeExists[chord.keyCode]) {
        return null;
      }
      return chord;
    }
    const keyCode = this._scanCodeToKeyCode[chord.scanCode] || KeyCode.Unknown;
    if (keyCode === KeyCode.Unknown || !this._keyCodeExists[keyCode]) {
      return null;
    }
    return new KeyCodeChord(chord.ctrlKey, chord.shiftKey, chord.altKey, chord.metaKey, keyCode);
  }
  resolveKeybinding(keybinding) {
    const chords = toEmptyArrayIfContainsNull(keybinding.chords.map((chord) => this._resolveChord(chord)));
    if (chords.length > 0) {
      return [new WindowsNativeResolvedKeybinding(this, chords)];
    }
    return [];
  }
}
export {
  WindowsKeyboardMapper,
  WindowsNativeResolvedKeybinding
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMva2V5YmluZGluZy9jb21tb24vd2luZG93c0tleWJvYXJkTWFwcGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2hhckNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jaGFyQ29kZS5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlLCBLZXlDb2RlVXRpbHMsIElNTVVUQUJMRV9DT0RFX1RPX0tFWV9DT0RFLCBTY2FuQ29kZSwgU2NhbkNvZGVVdGlscywgTkFUSVZFX1dJTkRPV1NfS0VZX0NPREVfVE9fS0VZX0NPREUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBSZXNvbHZlZEtleWJpbmRpbmcsIEtleUNvZGVDaG9yZCwgU2luZ2xlTW9kaWZpZXJDaG9yZCwgU2NhbkNvZGVDaG9yZCwgS2V5YmluZGluZywgQ2hvcmQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXliaW5kaW5ncy5qcyc7XG5pbXBvcnQgeyBVSUxhYmVsUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXliaW5kaW5nTGFiZWxzLmpzJztcbmltcG9ydCB7IE9wZXJhdGluZ1N5c3RlbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJS2V5Ym9hcmRNYXBwZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXlib2FyZExheW91dC9jb21tb24va2V5Ym9hcmRNYXBwZXIuanMnO1xuaW1wb3J0IHsgQmFzZVJlc29sdmVkS2V5YmluZGluZyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2Jhc2VSZXNvbHZlZEtleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgdG9FbXB0eUFycmF5SWZDb250YWluc051bGwgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9yZXNvbHZlZEtleWJpbmRpbmdJdGVtLmpzJztcbmltcG9ydCB7IElXaW5kb3dzS2V5Ym9hcmRNYXBwaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5Ym9hcmRMYXlvdXQvY29tbW9uL2tleWJvYXJkTGF5b3V0LmpzJztcblxuY29uc3QgTE9HID0gZmFsc2U7XG5mdW5jdGlvbiBsb2coc3RyOiBzdHJpbmcpOiB2b2lkIHtcblx0aWYgKExPRykge1xuXHRcdGNvbnNvbGUuaW5mbyhzdHIpO1xuXHR9XG59XG5cblxuZXhwb3J0IGludGVyZmFjZSBJU2NhbkNvZGVNYXBwaW5nIHtcblx0c2NhbkNvZGU6IFNjYW5Db2RlO1xuXHRrZXlDb2RlOiBLZXlDb2RlO1xuXHR2YWx1ZTogc3RyaW5nO1xuXHR3aXRoU2hpZnQ6IHN0cmluZztcblx0d2l0aEFsdEdyOiBzdHJpbmc7XG5cdHdpdGhTaGlmdEFsdEdyOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBXaW5kb3dzTmF0aXZlUmVzb2x2ZWRLZXliaW5kaW5nIGV4dGVuZHMgQmFzZVJlc29sdmVkS2V5YmluZGluZzxLZXlDb2RlQ2hvcmQ+IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9tYXBwZXI6IFdpbmRvd3NLZXlib2FyZE1hcHBlcjtcblxuXHRjb25zdHJ1Y3RvcihtYXBwZXI6IFdpbmRvd3NLZXlib2FyZE1hcHBlciwgY2hvcmRzOiBLZXlDb2RlQ2hvcmRbXSkge1xuXHRcdHN1cGVyKE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzLCBjaG9yZHMpO1xuXHRcdHRoaXMuX21hcHBlciA9IG1hcHBlcjtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0TGFiZWwoY2hvcmQ6IEtleUNvZGVDaG9yZCk6IHN0cmluZyB8IG51bGwge1xuXHRcdGlmIChjaG9yZC5pc0R1cGxpY2F0ZU1vZGlmaWVyQ2FzZSgpKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tYXBwZXIuZ2V0VUlMYWJlbEZvcktleUNvZGUoY2hvcmQua2V5Q29kZSk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRVU0xhYmVsRm9yS2V5YmluZGluZyhjaG9yZDogS2V5Q29kZUNob3JkKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0aWYgKGNob3JkLmlzRHVwbGljYXRlTW9kaWZpZXJDYXNlKCkpIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cdFx0cmV0dXJuIEtleUNvZGVVdGlscy50b1N0cmluZyhjaG9yZC5rZXlDb2RlKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRVU0xhYmVsKCk6IHN0cmluZyB8IG51bGwge1xuXHRcdHJldHVybiBVSUxhYmVsUHJvdmlkZXIudG9MYWJlbCh0aGlzLl9vcywgdGhpcy5fY2hvcmRzLCAoa2V5YmluZGluZykgPT4gdGhpcy5fZ2V0VVNMYWJlbEZvcktleWJpbmRpbmcoa2V5YmluZGluZykpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRBcmlhTGFiZWwoY2hvcmQ6IEtleUNvZGVDaG9yZCk6IHN0cmluZyB8IG51bGwge1xuXHRcdGlmIChjaG9yZC5pc0R1cGxpY2F0ZU1vZGlmaWVyQ2FzZSgpKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tYXBwZXIuZ2V0QXJpYUxhYmVsRm9yS2V5Q29kZShjaG9yZC5rZXlDb2RlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0RWxlY3Ryb25BY2NlbGVyYXRvcihjaG9yZDogS2V5Q29kZUNob3JkKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuX21hcHBlci5nZXRFbGVjdHJvbkFjY2VsZXJhdG9yRm9yS2V5QmluZGluZyhjaG9yZCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldFVzZXJTZXR0aW5nc0xhYmVsKGNob3JkOiBLZXlDb2RlQ2hvcmQpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRpZiAoY2hvcmQuaXNEdXBsaWNhdGVNb2RpZmllckNhc2UoKSkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9tYXBwZXIuZ2V0VXNlclNldHRpbmdzTGFiZWxGb3JLZXlDb2RlKGNob3JkLmtleUNvZGUpO1xuXHRcdHJldHVybiAocmVzdWx0ID8gcmVzdWx0LnRvTG93ZXJDYXNlKCkgOiByZXN1bHQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9pc1dZU0lXWUcoY2hvcmQ6IEtleUNvZGVDaG9yZCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9faXNXWVNJV1lHKGNob3JkLmtleUNvZGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfX2lzV1lTSVdZRyhrZXlDb2RlOiBLZXlDb2RlKTogYm9vbGVhbiB7XG5cdFx0aWYgKFxuXHRcdFx0a2V5Q29kZSA9PT0gS2V5Q29kZS5MZWZ0QXJyb3dcblx0XHRcdHx8IGtleUNvZGUgPT09IEtleUNvZGUuVXBBcnJvd1xuXHRcdFx0fHwga2V5Q29kZSA9PT0gS2V5Q29kZS5SaWdodEFycm93XG5cdFx0XHR8fCBrZXlDb2RlID09PSBLZXlDb2RlLkRvd25BcnJvd1xuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGNvbnN0IGFyaWFMYWJlbCA9IHRoaXMuX21hcHBlci5nZXRBcmlhTGFiZWxGb3JLZXlDb2RlKGtleUNvZGUpO1xuXHRcdGNvbnN0IHVzZXJTZXR0aW5nc0xhYmVsID0gdGhpcy5fbWFwcGVyLmdldFVzZXJTZXR0aW5nc0xhYmVsRm9yS2V5Q29kZShrZXlDb2RlKTtcblx0XHRyZXR1cm4gKGFyaWFMYWJlbCA9PT0gdXNlclNldHRpbmdzTGFiZWwpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRDaG9yZERpc3BhdGNoKGNob3JkOiBLZXlDb2RlQ2hvcmQpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRpZiAoY2hvcmQuaXNNb2RpZmllcktleSgpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0bGV0IHJlc3VsdCA9ICcnO1xuXG5cdFx0aWYgKGNob3JkLmN0cmxLZXkpIHtcblx0XHRcdHJlc3VsdCArPSAnY3RybCsnO1xuXHRcdH1cblx0XHRpZiAoY2hvcmQuc2hpZnRLZXkpIHtcblx0XHRcdHJlc3VsdCArPSAnc2hpZnQrJztcblx0XHR9XG5cdFx0aWYgKGNob3JkLmFsdEtleSkge1xuXHRcdFx0cmVzdWx0ICs9ICdhbHQrJztcblx0XHR9XG5cdFx0aWYgKGNob3JkLm1ldGFLZXkpIHtcblx0XHRcdHJlc3VsdCArPSAnbWV0YSsnO1xuXHRcdH1cblx0XHRyZXN1bHQgKz0gS2V5Q29kZVV0aWxzLnRvU3RyaW5nKGNob3JkLmtleUNvZGUpO1xuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0U2luZ2xlTW9kaWZpZXJDaG9yZERpc3BhdGNoKGNob3JkOiBLZXlDb2RlQ2hvcmQpOiBTaW5nbGVNb2RpZmllckNob3JkIHwgbnVsbCB7XG5cdFx0aWYgKGNob3JkLmtleUNvZGUgPT09IEtleUNvZGUuQ3RybCAmJiAhY2hvcmQuc2hpZnRLZXkgJiYgIWNob3JkLmFsdEtleSAmJiAhY2hvcmQubWV0YUtleSkge1xuXHRcdFx0cmV0dXJuICdjdHJsJztcblx0XHR9XG5cdFx0aWYgKGNob3JkLmtleUNvZGUgPT09IEtleUNvZGUuU2hpZnQgJiYgIWNob3JkLmN0cmxLZXkgJiYgIWNob3JkLmFsdEtleSAmJiAhY2hvcmQubWV0YUtleSkge1xuXHRcdFx0cmV0dXJuICdzaGlmdCc7XG5cdFx0fVxuXHRcdGlmIChjaG9yZC5rZXlDb2RlID09PSBLZXlDb2RlLkFsdCAmJiAhY2hvcmQuY3RybEtleSAmJiAhY2hvcmQuc2hpZnRLZXkgJiYgIWNob3JkLm1ldGFLZXkpIHtcblx0XHRcdHJldHVybiAnYWx0Jztcblx0XHR9XG5cdFx0aWYgKGNob3JkLmtleUNvZGUgPT09IEtleUNvZGUuTWV0YSAmJiAhY2hvcmQuY3RybEtleSAmJiAhY2hvcmQuc2hpZnRLZXkgJiYgIWNob3JkLmFsdEtleSkge1xuXHRcdFx0cmV0dXJuICdtZXRhJztcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBnZXRQcm9kdWNlZENoYXJDb2RlKGNob3JkOiBTY2FuQ29kZUNob3JkLCBtYXBwaW5nOiBJU2NhbkNvZGVNYXBwaW5nKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0aWYgKCFtYXBwaW5nKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0aWYgKGNob3JkLmN0cmxLZXkgJiYgY2hvcmQuc2hpZnRLZXkgJiYgY2hvcmQuYWx0S2V5KSB7XG5cdFx0XHRyZXR1cm4gbWFwcGluZy53aXRoU2hpZnRBbHRHcjtcblx0XHR9XG5cdFx0aWYgKGNob3JkLmN0cmxLZXkgJiYgY2hvcmQuYWx0S2V5KSB7XG5cdFx0XHRyZXR1cm4gbWFwcGluZy53aXRoQWx0R3I7XG5cdFx0fVxuXHRcdGlmIChjaG9yZC5zaGlmdEtleSkge1xuXHRcdFx0cmV0dXJuIG1hcHBpbmcud2l0aFNoaWZ0O1xuXHRcdH1cblx0XHRyZXR1cm4gbWFwcGluZy52YWx1ZTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZ2V0UHJvZHVjZWRDaGFyKGNob3JkOiBTY2FuQ29kZUNob3JkLCBtYXBwaW5nOiBJU2NhbkNvZGVNYXBwaW5nKTogc3RyaW5nIHtcblx0XHRjb25zdCBjaGFyID0gdGhpcy5nZXRQcm9kdWNlZENoYXJDb2RlKGNob3JkLCBtYXBwaW5nKTtcblx0XHRpZiAoY2hhciA9PT0gbnVsbCB8fCBjaGFyLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuICcgLS0tICc7XG5cdFx0fVxuXHRcdHJldHVybiAnICAnICsgY2hhciArICcgICc7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFdpbmRvd3NLZXlib2FyZE1hcHBlciBpbXBsZW1lbnRzIElLZXlib2FyZE1hcHBlciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY29kZUluZm86IElTY2FuQ29kZU1hcHBpbmdbXTtcblx0cHJpdmF0ZSByZWFkb25seSBfc2NhbkNvZGVUb0tleUNvZGU6IEtleUNvZGVbXTtcblx0cHJpdmF0ZSByZWFkb25seSBfa2V5Q29kZVRvTGFiZWw6IEFycmF5PHN0cmluZyB8IG51bGw+ID0gW107XG5cdHByaXZhdGUgcmVhZG9ubHkgX2tleUNvZGVFeGlzdHM6IGJvb2xlYW5bXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9pc1VTU3RhbmRhcmQ6IGJvb2xlYW4sXG5cdFx0cmF3TWFwcGluZ3M6IElXaW5kb3dzS2V5Ym9hcmRNYXBwaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX21hcEFsdEdyVG9DdHJsQWx0OiBib29sZWFuXG5cdCkge1xuXHRcdHRoaXMuX3NjYW5Db2RlVG9LZXlDb2RlID0gW107XG5cdFx0dGhpcy5fa2V5Q29kZVRvTGFiZWwgPSBbXTtcblx0XHR0aGlzLl9rZXlDb2RlRXhpc3RzID0gW107XG5cdFx0dGhpcy5fa2V5Q29kZVRvTGFiZWxbS2V5Q29kZS5Vbmtub3duXSA9IEtleUNvZGVVdGlscy50b1N0cmluZyhLZXlDb2RlLlVua25vd24pO1xuXG5cdFx0Zm9yIChsZXQgc2NhbkNvZGUgPSBTY2FuQ29kZS5Ob25lOyBzY2FuQ29kZSA8IFNjYW5Db2RlLk1BWF9WQUxVRTsgc2NhbkNvZGUrKykge1xuXHRcdFx0Y29uc3QgaW1tdXRhYmxlS2V5Q29kZSA9IElNTVVUQUJMRV9DT0RFX1RPX0tFWV9DT0RFW3NjYW5Db2RlXTtcblx0XHRcdGlmIChpbW11dGFibGVLZXlDb2RlICE9PSBLZXlDb2RlLkRlcGVuZHNPbktiTGF5b3V0KSB7XG5cdFx0XHRcdHRoaXMuX3NjYW5Db2RlVG9LZXlDb2RlW3NjYW5Db2RlXSA9IGltbXV0YWJsZUtleUNvZGU7XG5cdFx0XHRcdHRoaXMuX2tleUNvZGVUb0xhYmVsW2ltbXV0YWJsZUtleUNvZGVdID0gS2V5Q29kZVV0aWxzLnRvU3RyaW5nKGltbXV0YWJsZUtleUNvZGUpO1xuXHRcdFx0XHR0aGlzLl9rZXlDb2RlRXhpc3RzW2ltbXV0YWJsZUtleUNvZGVdID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBwcm9kdWNlc0xldHRlcjogYm9vbGVhbltdID0gW107XG5cdFx0bGV0IHByb2R1Y2VzTGV0dGVycyA9IGZhbHNlO1xuXG5cdFx0dGhpcy5fY29kZUluZm8gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHN0ckNvZGUgaW4gcmF3TWFwcGluZ3MpIHtcblx0XHRcdGlmIChyYXdNYXBwaW5ncy5oYXNPd25Qcm9wZXJ0eShzdHJDb2RlKSkge1xuXHRcdFx0XHRjb25zdCBzY2FuQ29kZSA9IFNjYW5Db2RlVXRpbHMudG9FbnVtKHN0ckNvZGUpO1xuXHRcdFx0XHRpZiAoc2NhbkNvZGUgPT09IFNjYW5Db2RlLk5vbmUpIHtcblx0XHRcdFx0XHRsb2coYFVua25vd24gc2NhbkNvZGUgJHtzdHJDb2RlfSBpbiBtYXBwaW5nLmApO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHJhd01hcHBpbmcgPSByYXdNYXBwaW5nc1tzdHJDb2RlXTtcblxuXHRcdFx0XHRjb25zdCBpbW11dGFibGVLZXlDb2RlID0gSU1NVVRBQkxFX0NPREVfVE9fS0VZX0NPREVbc2NhbkNvZGVdO1xuXHRcdFx0XHRpZiAoaW1tdXRhYmxlS2V5Q29kZSAhPT0gS2V5Q29kZS5EZXBlbmRzT25LYkxheW91dCkge1xuXHRcdFx0XHRcdGNvbnN0IGtleUNvZGUgPSBOQVRJVkVfV0lORE9XU19LRVlfQ09ERV9UT19LRVlfQ09ERVtyYXdNYXBwaW5nLnZrZXldIHx8IEtleUNvZGUuVW5rbm93bjtcblx0XHRcdFx0XHRpZiAoa2V5Q29kZSA9PT0gS2V5Q29kZS5Vbmtub3duIHx8IGltbXV0YWJsZUtleUNvZGUgPT09IGtleUNvZGUpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoc2NhbkNvZGUgIT09IFNjYW5Db2RlLk51bXBhZENvbW1hKSB7XG5cdFx0XHRcdFx0XHQvLyBMb29rcyBsaWtlIFNjYW5Db2RlLk51bXBhZENvbW1hIGRvZXNuJ3QgYWx3YXlzIG1hcCB0byBLZXlDb2RlLk5VTVBBRF9TRVBBUkFUT1Jcblx0XHRcdFx0XHRcdC8vIGUuZy4gb24gUE9SIC0gUFRCXG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IHJhd01hcHBpbmcudmFsdWU7XG5cdFx0XHRcdGNvbnN0IHdpdGhTaGlmdCA9IHJhd01hcHBpbmcud2l0aFNoaWZ0O1xuXHRcdFx0XHRjb25zdCB3aXRoQWx0R3IgPSByYXdNYXBwaW5nLndpdGhBbHRHcjtcblx0XHRcdFx0Y29uc3Qgd2l0aFNoaWZ0QWx0R3IgPSByYXdNYXBwaW5nLndpdGhTaGlmdEFsdEdyO1xuXHRcdFx0XHRjb25zdCBrZXlDb2RlID0gTkFUSVZFX1dJTkRPV1NfS0VZX0NPREVfVE9fS0VZX0NPREVbcmF3TWFwcGluZy52a2V5XSB8fCBLZXlDb2RlLlVua25vd247XG5cblx0XHRcdFx0Y29uc3QgbWFwcGluZzogSVNjYW5Db2RlTWFwcGluZyA9IHtcblx0XHRcdFx0XHRzY2FuQ29kZTogc2NhbkNvZGUsXG5cdFx0XHRcdFx0a2V5Q29kZToga2V5Q29kZSxcblx0XHRcdFx0XHR2YWx1ZTogdmFsdWUsXG5cdFx0XHRcdFx0d2l0aFNoaWZ0OiB3aXRoU2hpZnQsXG5cdFx0XHRcdFx0d2l0aEFsdEdyOiB3aXRoQWx0R3IsXG5cdFx0XHRcdFx0d2l0aFNoaWZ0QWx0R3I6IHdpdGhTaGlmdEFsdEdyLFxuXHRcdFx0XHR9O1xuXHRcdFx0XHR0aGlzLl9jb2RlSW5mb1tzY2FuQ29kZV0gPSBtYXBwaW5nO1xuXHRcdFx0XHR0aGlzLl9zY2FuQ29kZVRvS2V5Q29kZVtzY2FuQ29kZV0gPSBrZXlDb2RlO1xuXG5cdFx0XHRcdGlmIChrZXlDb2RlID09PSBLZXlDb2RlLlVua25vd24pIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9rZXlDb2RlRXhpc3RzW2tleUNvZGVdID0gdHJ1ZTtcblxuXHRcdFx0XHRpZiAodmFsdWUubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0Ly8gVGhpcyBrZXkgZG9lcyBub3QgcHJvZHVjZSBzdHJpbmdzXG5cdFx0XHRcdFx0dGhpcy5fa2V5Q29kZVRvTGFiZWxba2V5Q29kZV0gPSBudWxsO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZWxzZSBpZiAodmFsdWUubGVuZ3RoID4gMSkge1xuXHRcdFx0XHRcdC8vIFRoaXMga2V5IHByb2R1Y2VzIGEgbGV0dGVyIHJlcHJlc2VudGFibGUgd2l0aCBtdWx0aXBsZSBVVEYtMTYgY29kZSB1bml0cy5cblx0XHRcdFx0XHR0aGlzLl9rZXlDb2RlVG9MYWJlbFtrZXlDb2RlXSA9IHZhbHVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgY2hhckNvZGUgPSB2YWx1ZS5jaGFyQ29kZUF0KDApO1xuXG5cdFx0XHRcdFx0aWYgKGNoYXJDb2RlID49IENoYXJDb2RlLmEgJiYgY2hhckNvZGUgPD0gQ2hhckNvZGUueikge1xuXHRcdFx0XHRcdFx0Y29uc3QgdXBwZXJDYXNlVmFsdWUgPSBDaGFyQ29kZS5BICsgKGNoYXJDb2RlIC0gQ2hhckNvZGUuYSk7XG5cdFx0XHRcdFx0XHRwcm9kdWNlc0xldHRlclt1cHBlckNhc2VWYWx1ZV0gPSB0cnVlO1xuXHRcdFx0XHRcdFx0cHJvZHVjZXNMZXR0ZXJzID0gdHJ1ZTtcblx0XHRcdFx0XHRcdHRoaXMuX2tleUNvZGVUb0xhYmVsW2tleUNvZGVdID0gU3RyaW5nLmZyb21DaGFyQ29kZShDaGFyQ29kZS5BICsgKGNoYXJDb2RlIC0gQ2hhckNvZGUuYSkpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGVsc2UgaWYgKGNoYXJDb2RlID49IENoYXJDb2RlLkEgJiYgY2hhckNvZGUgPD0gQ2hhckNvZGUuWikge1xuXHRcdFx0XHRcdFx0cHJvZHVjZXNMZXR0ZXJbY2hhckNvZGVdID0gdHJ1ZTtcblx0XHRcdFx0XHRcdHByb2R1Y2VzTGV0dGVycyA9IHRydWU7XG5cdFx0XHRcdFx0XHR0aGlzLl9rZXlDb2RlVG9MYWJlbFtrZXlDb2RlXSA9IHZhbHVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5fa2V5Q29kZVRvTGFiZWxba2V5Q29kZV0gPSB2YWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBIYW5kbGUga2V5Ym9hcmQgbGF5b3V0cyB3aGVyZSBsYXRpbiBjaGFyYWN0ZXJzIGFyZSBub3QgcHJvZHVjZWQgZS5nLiBDeXJpbGxpY1xuXHRcdGNvbnN0IF9yZWdpc3RlckxldHRlcklmTWlzc2luZyA9IChjaGFyQ29kZTogQ2hhckNvZGUsIGtleUNvZGU6IEtleUNvZGUpOiB2b2lkID0+IHtcblx0XHRcdGlmICghcHJvZHVjZXNMZXR0ZXJbY2hhckNvZGVdKSB7XG5cdFx0XHRcdHRoaXMuX2tleUNvZGVUb0xhYmVsW2tleUNvZGVdID0gU3RyaW5nLmZyb21DaGFyQ29kZShjaGFyQ29kZSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuQSwgS2V5Q29kZS5LZXlBKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuQiwgS2V5Q29kZS5LZXlCKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuQywgS2V5Q29kZS5LZXlDKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuRCwgS2V5Q29kZS5LZXlEKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuRSwgS2V5Q29kZS5LZXlFKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuRiwgS2V5Q29kZS5LZXlGKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuRywgS2V5Q29kZS5LZXlHKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuSCwgS2V5Q29kZS5LZXlIKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuSSwgS2V5Q29kZS5LZXlJKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuSiwgS2V5Q29kZS5LZXlKKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuSywgS2V5Q29kZS5LZXlLKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuTCwgS2V5Q29kZS5LZXlMKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuTSwgS2V5Q29kZS5LZXlNKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuTiwgS2V5Q29kZS5LZXlOKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuTywgS2V5Q29kZS5LZXlPKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuUCwgS2V5Q29kZS5LZXlQKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuUSwgS2V5Q29kZS5LZXlRKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuUiwgS2V5Q29kZS5LZXlSKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuUywgS2V5Q29kZS5LZXlTKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuVCwgS2V5Q29kZS5LZXlUKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuVSwgS2V5Q29kZS5LZXlVKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuViwgS2V5Q29kZS5LZXlWKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuVywgS2V5Q29kZS5LZXlXKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuWCwgS2V5Q29kZS5LZXlYKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuWSwgS2V5Q29kZS5LZXlZKTtcblx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuWiwgS2V5Q29kZS5LZXlaKTtcblxuXHRcdGlmICghcHJvZHVjZXNMZXR0ZXJzKSB7XG5cdFx0XHQvLyBTaW5jZSB0aGlzIGtleWJvYXJkIGxheW91dCBwcm9kdWNlcyBubyBsYXRpbiBsZXR0ZXJzIGF0IGFsbCwgbW9zdCBvZiB0aGUgVUkgd2lsbCB1c2UgdGhlXG5cdFx0XHQvLyBVUyBrYiBsYXlvdXQgZXF1aXZhbGVudCBmb3IgVUkgbGFiZWxzLCBzbyBhbHNvIHRyeSB0byByZW5kZXIgb3RoZXIga2V5cyB3aXRoIHRoZSBVUyBsYWJlbHNcblx0XHRcdC8vIGZvciBjb25zaXN0ZW5jeS4uLlxuXHRcdFx0Y29uc3QgX3JlZ2lzdGVyTGFiZWwgPSAoa2V5Q29kZTogS2V5Q29kZSwgY2hhckNvZGU6IENoYXJDb2RlKTogdm9pZCA9PiB7XG5cdFx0XHRcdC8vIGNvbnN0IGV4aXN0aW5nTGFiZWwgPSB0aGlzLl9rZXlDb2RlVG9MYWJlbFtrZXlDb2RlXTtcblx0XHRcdFx0Ly8gY29uc3QgZXhpc3RpbmdDaGFyQ29kZSA9IChleGlzdGluZ0xhYmVsID8gZXhpc3RpbmdMYWJlbC5jaGFyQ29kZUF0KDApIDogQ2hhckNvZGUuTnVsbCk7XG5cdFx0XHRcdC8vIGlmIChleGlzdGluZ0NoYXJDb2RlIDwgMzIgfHwgZXhpc3RpbmdDaGFyQ29kZSA+IDEyNikge1xuXHRcdFx0XHR0aGlzLl9rZXlDb2RlVG9MYWJlbFtrZXlDb2RlXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUoY2hhckNvZGUpO1xuXHRcdFx0XHQvLyB9XG5cdFx0XHR9O1xuXHRcdFx0X3JlZ2lzdGVyTGFiZWwoS2V5Q29kZS5TZW1pY29sb24sIENoYXJDb2RlLlNlbWljb2xvbik7XG5cdFx0XHRfcmVnaXN0ZXJMYWJlbChLZXlDb2RlLkVxdWFsLCBDaGFyQ29kZS5FcXVhbHMpO1xuXHRcdFx0X3JlZ2lzdGVyTGFiZWwoS2V5Q29kZS5Db21tYSwgQ2hhckNvZGUuQ29tbWEpO1xuXHRcdFx0X3JlZ2lzdGVyTGFiZWwoS2V5Q29kZS5NaW51cywgQ2hhckNvZGUuRGFzaCk7XG5cdFx0XHRfcmVnaXN0ZXJMYWJlbChLZXlDb2RlLlBlcmlvZCwgQ2hhckNvZGUuUGVyaW9kKTtcblx0XHRcdF9yZWdpc3RlckxhYmVsKEtleUNvZGUuU2xhc2gsIENoYXJDb2RlLlNsYXNoKTtcblx0XHRcdF9yZWdpc3RlckxhYmVsKEtleUNvZGUuQmFja3F1b3RlLCBDaGFyQ29kZS5CYWNrVGljayk7XG5cdFx0XHRfcmVnaXN0ZXJMYWJlbChLZXlDb2RlLkJyYWNrZXRMZWZ0LCBDaGFyQ29kZS5PcGVuU3F1YXJlQnJhY2tldCk7XG5cdFx0XHRfcmVnaXN0ZXJMYWJlbChLZXlDb2RlLkJhY2tzbGFzaCwgQ2hhckNvZGUuQmFja3NsYXNoKTtcblx0XHRcdF9yZWdpc3RlckxhYmVsKEtleUNvZGUuQnJhY2tldFJpZ2h0LCBDaGFyQ29kZS5DbG9zZVNxdWFyZUJyYWNrZXQpO1xuXHRcdFx0X3JlZ2lzdGVyTGFiZWwoS2V5Q29kZS5RdW90ZSwgQ2hhckNvZGUuU2luZ2xlUXVvdGUpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBkdW1wRGVidWdJbmZvKCk6IHN0cmluZyB7XG5cdFx0Y29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0Y29uc3QgaW1tdXRhYmxlU2FtcGxlcyA9IFtcblx0XHRcdFNjYW5Db2RlLkFycm93VXAsXG5cdFx0XHRTY2FuQ29kZS5OdW1wYWQwXG5cdFx0XTtcblxuXHRcdGxldCBjbnQgPSAwO1xuXHRcdHJlc3VsdC5wdXNoKGAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLWApO1xuXHRcdGZvciAobGV0IHNjYW5Db2RlID0gU2NhbkNvZGUuTm9uZTsgc2NhbkNvZGUgPCBTY2FuQ29kZS5NQVhfVkFMVUU7IHNjYW5Db2RlKyspIHtcblx0XHRcdGlmIChJTU1VVEFCTEVfQ09ERV9UT19LRVlfQ09ERVtzY2FuQ29kZV0gIT09IEtleUNvZGUuRGVwZW5kc09uS2JMYXlvdXQpIHtcblx0XHRcdFx0aWYgKGltbXV0YWJsZVNhbXBsZXMuaW5kZXhPZihzY2FuQ29kZSkgPT09IC0xKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGNudCAlIDYgPT09IDApIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goYHwgICAgICAgSFcgQ29kZSBjb21iaW5hdGlvbiAgICAgIHwgIEtleSAgfCAgICBLZXlDb2RlIGNvbWJpbmF0aW9uICAgIHwgICAgICAgICAgVUkgbGFiZWwgICAgICAgICB8ICAgICAgICBVc2VyIHNldHRpbmdzICAgICAgIHwgV1lTSVdZRyB8YCk7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLWApO1xuXHRcdFx0fVxuXHRcdFx0Y250Kys7XG5cblx0XHRcdGNvbnN0IG1hcHBpbmcgPSB0aGlzLl9jb2RlSW5mb1tzY2FuQ29kZV07XG5cdFx0XHRjb25zdCBzdHJDb2RlID0gU2NhbkNvZGVVdGlscy50b1N0cmluZyhzY2FuQ29kZSk7XG5cblx0XHRcdGNvbnN0IG1vZHMgPSBbMGIwMDAsIDBiMDEwLCAwYjEwMSwgMGIxMTFdO1xuXHRcdFx0Zm9yIChjb25zdCBtb2Qgb2YgbW9kcykge1xuXHRcdFx0XHRjb25zdCBjdHJsS2V5ID0gKG1vZCAmIDBiMDAxKSA/IHRydWUgOiBmYWxzZTtcblx0XHRcdFx0Y29uc3Qgc2hpZnRLZXkgPSAobW9kICYgMGIwMTApID8gdHJ1ZSA6IGZhbHNlO1xuXHRcdFx0XHRjb25zdCBhbHRLZXkgPSAobW9kICYgMGIxMDApID8gdHJ1ZSA6IGZhbHNlO1xuXHRcdFx0XHRjb25zdCBzY2FuQ29kZUNob3JkID0gbmV3IFNjYW5Db2RlQ2hvcmQoY3RybEtleSwgc2hpZnRLZXksIGFsdEtleSwgZmFsc2UsIHNjYW5Db2RlKTtcblx0XHRcdFx0Y29uc3Qga2V5Q29kZUNob3JkID0gdGhpcy5fcmVzb2x2ZUNob3JkKHNjYW5Db2RlQ2hvcmQpO1xuXHRcdFx0XHRjb25zdCBzdHJLZXlDb2RlID0gKGtleUNvZGVDaG9yZCA/IEtleUNvZGVVdGlscy50b1N0cmluZyhrZXlDb2RlQ2hvcmQua2V5Q29kZSkgOiBudWxsKTtcblx0XHRcdFx0Y29uc3QgcmVzb2x2ZWRLYiA9IChrZXlDb2RlQ2hvcmQgPyBuZXcgV2luZG93c05hdGl2ZVJlc29sdmVkS2V5YmluZGluZyh0aGlzLCBba2V5Q29kZUNob3JkXSkgOiBudWxsKTtcblxuXHRcdFx0XHRjb25zdCBvdXRTY2FuQ29kZSA9IGAke2N0cmxLZXkgPyAnQ3RybCsnIDogJyd9JHtzaGlmdEtleSA/ICdTaGlmdCsnIDogJyd9JHthbHRLZXkgPyAnQWx0KycgOiAnJ30ke3N0ckNvZGV9YDtcblx0XHRcdFx0Y29uc3QgYXJpYUxhYmVsID0gKHJlc29sdmVkS2IgPyByZXNvbHZlZEtiLmdldEFyaWFMYWJlbCgpIDogbnVsbCk7XG5cdFx0XHRcdGNvbnN0IG91dFVJTGFiZWwgPSAoYXJpYUxhYmVsID8gYXJpYUxhYmVsLnJlcGxhY2UoL0NvbnRyb2xcXCsvLCAnQ3RybCsnKSA6IG51bGwpO1xuXHRcdFx0XHRjb25zdCBvdXRVc2VyU2V0dGluZ3MgPSAocmVzb2x2ZWRLYiA/IHJlc29sdmVkS2IuZ2V0VXNlclNldHRpbmdzTGFiZWwoKSA6IG51bGwpO1xuXHRcdFx0XHRjb25zdCBvdXRLZXkgPSBXaW5kb3dzTmF0aXZlUmVzb2x2ZWRLZXliaW5kaW5nLmdldFByb2R1Y2VkQ2hhcihzY2FuQ29kZUNob3JkLCBtYXBwaW5nKTtcblx0XHRcdFx0Y29uc3Qgb3V0S2IgPSAoc3RyS2V5Q29kZSA/IGAke2N0cmxLZXkgPyAnQ3RybCsnIDogJyd9JHtzaGlmdEtleSA/ICdTaGlmdCsnIDogJyd9JHthbHRLZXkgPyAnQWx0KycgOiAnJ30ke3N0cktleUNvZGV9YCA6IG51bGwpO1xuXHRcdFx0XHRjb25zdCBpc1dZU0lXWUcgPSAocmVzb2x2ZWRLYiA/IHJlc29sdmVkS2IuaXNXWVNJV1lHKCkgOiBmYWxzZSk7XG5cdFx0XHRcdGNvbnN0IG91dFdZU0lXWUcgPSAoaXNXWVNJV1lHID8gJyAgICAgICAnIDogJyAgIE5PICAnKTtcblx0XHRcdFx0cmVzdWx0LnB1c2goYHwgJHt0aGlzLl9sZWZ0UGFkKG91dFNjYW5Db2RlLCAzMCl9IHwgJHtvdXRLZXl9IHwgJHt0aGlzLl9sZWZ0UGFkKG91dEtiLCAyNSl9IHwgJHt0aGlzLl9sZWZ0UGFkKG91dFVJTGFiZWwsIDI1KX0gfCAgJHt0aGlzLl9sZWZ0UGFkKG91dFVzZXJTZXR0aW5ncywgMjUpfSB8ICR7b3V0V1lTSVdZR30gfGApO1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0LnB1c2goYC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tYCk7XG5cdFx0fVxuXG5cblx0XHRyZXR1cm4gcmVzdWx0LmpvaW4oJ1xcbicpO1xuXHR9XG5cblx0cHJpdmF0ZSBfbGVmdFBhZChzdHI6IHN0cmluZyB8IG51bGwsIGNudDogbnVtYmVyKTogc3RyaW5nIHtcblx0XHRpZiAoc3RyID09PSBudWxsKSB7XG5cdFx0XHRzdHIgPSAnbnVsbCc7XG5cdFx0fVxuXHRcdHdoaWxlIChzdHIubGVuZ3RoIDwgY250KSB7XG5cdFx0XHRzdHIgPSAnICcgKyBzdHI7XG5cdFx0fVxuXHRcdHJldHVybiBzdHI7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VUlMYWJlbEZvcktleUNvZGUoa2V5Q29kZTogS2V5Q29kZSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX2dldExhYmVsRm9yS2V5Q29kZShrZXlDb2RlKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRBcmlhTGFiZWxGb3JLZXlDb2RlKGtleUNvZGU6IEtleUNvZGUpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9nZXRMYWJlbEZvcktleUNvZGUoa2V5Q29kZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VXNlclNldHRpbmdzTGFiZWxGb3JLZXlDb2RlKGtleUNvZGU6IEtleUNvZGUpOiBzdHJpbmcge1xuXHRcdGlmICh0aGlzLl9pc1VTU3RhbmRhcmQpIHtcblx0XHRcdHJldHVybiBLZXlDb2RlVXRpbHMudG9Vc2VyU2V0dGluZ3NVUyhrZXlDb2RlKTtcblx0XHR9XG5cdFx0cmV0dXJuIEtleUNvZGVVdGlscy50b1VzZXJTZXR0aW5nc0dlbmVyYWwoa2V5Q29kZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RWxlY3Ryb25BY2NlbGVyYXRvckZvcktleUJpbmRpbmcoY2hvcmQ6IEtleUNvZGVDaG9yZCk6IHN0cmluZyB8IG51bGwge1xuXHRcdHJldHVybiBLZXlDb2RlVXRpbHMudG9FbGVjdHJvbkFjY2VsZXJhdG9yKGNob3JkLmtleUNvZGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0TGFiZWxGb3JLZXlDb2RlKGtleUNvZGU6IEtleUNvZGUpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9rZXlDb2RlVG9MYWJlbFtrZXlDb2RlXSB8fCBLZXlDb2RlVXRpbHMudG9TdHJpbmcoS2V5Q29kZS5Vbmtub3duKTtcblx0fVxuXG5cdHB1YmxpYyByZXNvbHZlS2V5Ym9hcmRFdmVudChrZXlib2FyZEV2ZW50OiBJS2V5Ym9hcmRFdmVudCk6IFdpbmRvd3NOYXRpdmVSZXNvbHZlZEtleWJpbmRpbmcge1xuXHRcdGNvbnN0IGN0cmxLZXkgPSBrZXlib2FyZEV2ZW50LmN0cmxLZXkgfHwgKHRoaXMuX21hcEFsdEdyVG9DdHJsQWx0ICYmIGtleWJvYXJkRXZlbnQuYWx0R3JhcGhLZXkpO1xuXHRcdGNvbnN0IGFsdEtleSA9IGtleWJvYXJkRXZlbnQuYWx0S2V5IHx8ICh0aGlzLl9tYXBBbHRHclRvQ3RybEFsdCAmJiBrZXlib2FyZEV2ZW50LmFsdEdyYXBoS2V5KTtcblx0XHRjb25zdCBjaG9yZCA9IG5ldyBLZXlDb2RlQ2hvcmQoY3RybEtleSwga2V5Ym9hcmRFdmVudC5zaGlmdEtleSwgYWx0S2V5LCBrZXlib2FyZEV2ZW50Lm1ldGFLZXksIGtleWJvYXJkRXZlbnQua2V5Q29kZSk7XG5cdFx0cmV0dXJuIG5ldyBXaW5kb3dzTmF0aXZlUmVzb2x2ZWRLZXliaW5kaW5nKHRoaXMsIFtjaG9yZF0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVzb2x2ZUNob3JkKGNob3JkOiBDaG9yZCB8IG51bGwpOiBLZXlDb2RlQ2hvcmQgfCBudWxsIHtcblx0XHRpZiAoIWNob3JkKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0aWYgKGNob3JkIGluc3RhbmNlb2YgS2V5Q29kZUNob3JkKSB7XG5cdFx0XHRpZiAoIXRoaXMuX2tleUNvZGVFeGlzdHNbY2hvcmQua2V5Q29kZV0pIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gY2hvcmQ7XG5cdFx0fVxuXHRcdGNvbnN0IGtleUNvZGUgPSB0aGlzLl9zY2FuQ29kZVRvS2V5Q29kZVtjaG9yZC5zY2FuQ29kZV0gfHwgS2V5Q29kZS5Vbmtub3duO1xuXHRcdGlmIChrZXlDb2RlID09PSBLZXlDb2RlLlVua25vd24gfHwgIXRoaXMuX2tleUNvZGVFeGlzdHNba2V5Q29kZV0pIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IEtleUNvZGVDaG9yZChjaG9yZC5jdHJsS2V5LCBjaG9yZC5zaGlmdEtleSwgY2hvcmQuYWx0S2V5LCBjaG9yZC5tZXRhS2V5LCBrZXlDb2RlKTtcblx0fVxuXG5cdHB1YmxpYyByZXNvbHZlS2V5YmluZGluZyhrZXliaW5kaW5nOiBLZXliaW5kaW5nKTogUmVzb2x2ZWRLZXliaW5kaW5nW10ge1xuXHRcdGNvbnN0IGNob3JkczogS2V5Q29kZUNob3JkW10gPSB0b0VtcHR5QXJyYXlJZkNvbnRhaW5zTnVsbChrZXliaW5kaW5nLmNob3Jkcy5tYXAoY2hvcmQgPT4gdGhpcy5fcmVzb2x2ZUNob3JkKGNob3JkKSkpO1xuXHRcdGlmIChjaG9yZHMubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuIFtuZXcgV2luZG93c05hdGl2ZVJlc29sdmVkS2V5YmluZGluZyh0aGlzLCBjaG9yZHMpXTtcblx0XHR9XG5cdFx0cmV0dXJu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
