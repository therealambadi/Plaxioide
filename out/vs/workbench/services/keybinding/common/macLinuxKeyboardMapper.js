import { CharCode } from "../../../../base/common/charCode.js";
import { KeyCode, KeyCodeUtils, IMMUTABLE_CODE_TO_KEY_CODE, IMMUTABLE_KEY_CODE_TO_CODE, ScanCode, ScanCodeUtils } from "../../../../base/common/keyCodes.js";
import { KeyCodeChord, ScanCodeChord } from "../../../../base/common/keybindings.js";
import { OperatingSystem } from "../../../../base/common/platform.js";
import { BaseResolvedKeybinding } from "../../../../platform/keybinding/common/baseResolvedKeybinding.js";
const CHAR_CODE_TO_KEY_CODE = [];
class NativeResolvedKeybinding extends BaseResolvedKeybinding {
  constructor(mapper, os, chords) {
    super(os, chords);
    this._mapper = mapper;
  }
  _getLabel(chord) {
    return this._mapper.getUILabelForScanCodeChord(chord);
  }
  _getAriaLabel(chord) {
    return this._mapper.getAriaLabelForScanCodeChord(chord);
  }
  _getElectronAccelerator(chord) {
    return this._mapper.getElectronAcceleratorLabelForScanCodeChord(chord);
  }
  _getUserSettingsLabel(chord) {
    return this._mapper.getUserSettingsLabelForScanCodeChord(chord);
  }
  _isWYSIWYG(binding) {
    if (!binding) {
      return true;
    }
    if (IMMUTABLE_CODE_TO_KEY_CODE[binding.scanCode] !== KeyCode.DependsOnKbLayout) {
      return true;
    }
    const a = this._mapper.getAriaLabelForScanCodeChord(binding);
    const b = this._mapper.getUserSettingsLabelForScanCodeChord(binding);
    if (!a && !b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    return a.toLowerCase() === b.toLowerCase();
  }
  _getChordDispatch(chord) {
    return this._mapper.getDispatchStrForScanCodeChord(chord);
  }
  _getSingleModifierChordDispatch(chord) {
    if ((chord.scanCode === ScanCode.ControlLeft || chord.scanCode === ScanCode.ControlRight) && !chord.shiftKey && !chord.altKey && !chord.metaKey) {
      return "ctrl";
    }
    if ((chord.scanCode === ScanCode.AltLeft || chord.scanCode === ScanCode.AltRight) && !chord.ctrlKey && !chord.shiftKey && !chord.metaKey) {
      return "alt";
    }
    if ((chord.scanCode === ScanCode.ShiftLeft || chord.scanCode === ScanCode.ShiftRight) && !chord.ctrlKey && !chord.altKey && !chord.metaKey) {
      return "shift";
    }
    if ((chord.scanCode === ScanCode.MetaLeft || chord.scanCode === ScanCode.MetaRight) && !chord.ctrlKey && !chord.shiftKey && !chord.altKey) {
      return "meta";
    }
    return null;
  }
}
class ScanCodeCombo {
  constructor(ctrlKey, shiftKey, altKey, scanCode) {
    this.ctrlKey = ctrlKey;
    this.shiftKey = shiftKey;
    this.altKey = altKey;
    this.scanCode = scanCode;
  }
  toString() {
    return `${this.ctrlKey ? "Ctrl+" : ""}${this.shiftKey ? "Shift+" : ""}${this.altKey ? "Alt+" : ""}${ScanCodeUtils.toString(this.scanCode)}`;
  }
  equals(other) {
    return this.ctrlKey === other.ctrlKey && this.shiftKey === other.shiftKey && this.altKey === other.altKey && this.scanCode === other.scanCode;
  }
  getProducedCharCode(mapping) {
    if (!mapping) {
      return "";
    }
    if (this.ctrlKey && this.shiftKey && this.altKey) {
      return mapping.withShiftAltGr;
    }
    if (this.ctrlKey && this.altKey) {
      return mapping.withAltGr;
    }
    if (this.shiftKey) {
      return mapping.withShift;
    }
    return mapping.value;
  }
  getProducedChar(mapping) {
    const charCode = MacLinuxKeyboardMapper.getCharCode(this.getProducedCharCode(mapping));
    if (charCode === 0) {
      return " --- ";
    }
    if (charCode >= CharCode.U_Combining_Grave_Accent && charCode <= CharCode.U_Combining_Latin_Small_Letter_X) {
      return "U+" + charCode.toString(16);
    }
    return "  " + String.fromCharCode(charCode) + "  ";
  }
}
class KeyCodeCombo {
  constructor(ctrlKey, shiftKey, altKey, keyCode) {
    this.ctrlKey = ctrlKey;
    this.shiftKey = shiftKey;
    this.altKey = altKey;
    this.keyCode = keyCode;
  }
  toString() {
    return `${this.ctrlKey ? "Ctrl+" : ""}${this.shiftKey ? "Shift+" : ""}${this.altKey ? "Alt+" : ""}${KeyCodeUtils.toString(this.keyCode)}`;
  }
}
class ScanCodeKeyCodeMapper {
  constructor() {
    /**
     * ScanCode combination => KeyCode combination.
     * Only covers relevant modifiers ctrl, shift, alt (since meta does not influence the mappings).
     */
    this._scanCodeToKeyCode = [];
    /**
     * inverse of `_scanCodeToKeyCode`.
     * KeyCode combination => ScanCode combination.
     * Only covers relevant modifiers ctrl, shift, alt (since meta does not influence the mappings).
     */
    this._keyCodeToScanCode = [];
    this._scanCodeToKeyCode = [];
    this._keyCodeToScanCode = [];
  }
  registrationComplete() {
    this._moveToEnd(ScanCode.IntlHash);
    this._moveToEnd(ScanCode.IntlBackslash);
  }
  _moveToEnd(scanCode) {
    for (let mod = 0; mod < 8; mod++) {
      const encodedKeyCodeCombos = this._scanCodeToKeyCode[(scanCode << 3) + mod];
      if (!encodedKeyCodeCombos) {
        continue;
      }
      for (let i = 0, len = encodedKeyCodeCombos.length; i < len; i++) {
        const encodedScanCodeCombos = this._keyCodeToScanCode[encodedKeyCodeCombos[i]];
        if (encodedScanCodeCombos.length === 1) {
          continue;
        }
        for (let j = 0, len2 = encodedScanCodeCombos.length; j < len2; j++) {
          const entry = encodedScanCodeCombos[j];
          const entryScanCode = entry >>> 3;
          if (entryScanCode === scanCode) {
            for (let k = j + 1; k < len2; k++) {
              encodedScanCodeCombos[k - 1] = encodedScanCodeCombos[k];
            }
            encodedScanCodeCombos[len2 - 1] = entry;
          }
        }
      }
    }
  }
  registerIfUnknown(scanCodeCombo, keyCodeCombo) {
    if (keyCodeCombo.keyCode === KeyCode.Unknown) {
      return;
    }
    const scanCodeComboEncoded = this._encodeScanCodeCombo(scanCodeCombo);
    const keyCodeComboEncoded = this._encodeKeyCodeCombo(keyCodeCombo);
    const keyCodeIsDigit = keyCodeCombo.keyCode >= KeyCode.Digit0 && keyCodeCombo.keyCode <= KeyCode.Digit9;
    const keyCodeIsLetter = keyCodeCombo.keyCode >= KeyCode.KeyA && keyCodeCombo.keyCode <= KeyCode.KeyZ;
    const existingKeyCodeCombos = this._scanCodeToKeyCode[scanCodeComboEncoded];
    if (keyCodeIsDigit || keyCodeIsLetter) {
      if (existingKeyCodeCombos) {
        for (let i = 0, len = existingKeyCodeCombos.length; i < len; i++) {
          if (existingKeyCodeCombos[i] === keyCodeComboEncoded) {
            return;
          }
        }
      }
    } else {
      if (existingKeyCodeCombos && existingKeyCodeCombos.length !== 0) {
        return;
      }
    }
    this._scanCodeToKeyCode[scanCodeComboEncoded] = this._scanCodeToKeyCode[scanCodeComboEncoded] || [];
    this._scanCodeToKeyCode[scanCodeComboEncoded].unshift(keyCodeComboEncoded);
    this._keyCodeToScanCode[keyCodeComboEncoded] = this._keyCodeToScanCode[keyCodeComboEncoded] || [];
    this._keyCodeToScanCode[keyCodeComboEncoded].unshift(scanCodeComboEncoded);
  }
  lookupKeyCodeCombo(keyCodeCombo) {
    const keyCodeComboEncoded = this._encodeKeyCodeCombo(keyCodeCombo);
    const scanCodeCombosEncoded = this._keyCodeToScanCode[keyCodeComboEncoded];
    if (!scanCodeCombosEncoded || scanCodeCombosEncoded.length === 0) {
      return [];
    }
    const result = [];
    for (let i = 0, len = scanCodeCombosEncoded.length; i < len; i++) {
      const scanCodeComboEncoded = scanCodeCombosEncoded[i];
      const ctrlKey = scanCodeComboEncoded & 1 ? true : false;
      const shiftKey = scanCodeComboEncoded & 2 ? true : false;
      const altKey = scanCodeComboEncoded & 4 ? true : false;
      const scanCode = scanCodeComboEncoded >>> 3;
      result[i] = new ScanCodeCombo(ctrlKey, shiftKey, altKey, scanCode);
    }
    return result;
  }
  lookupScanCodeCombo(scanCodeCombo) {
    const scanCodeComboEncoded = this._encodeScanCodeCombo(scanCodeCombo);
    const keyCodeCombosEncoded = this._scanCodeToKeyCode[scanCodeComboEncoded];
    if (!keyCodeCombosEncoded || keyCodeCombosEncoded.length === 0) {
      return [];
    }
    const result = [];
    for (let i = 0, len = keyCodeCombosEncoded.length; i < len; i++) {
      const keyCodeComboEncoded = keyCodeCombosEncoded[i];
      const ctrlKey = keyCodeComboEncoded & 1 ? true : false;
      const shiftKey = keyCodeComboEncoded & 2 ? true : false;
      const altKey = keyCodeComboEncoded & 4 ? true : false;
      const keyCode = keyCodeComboEncoded >>> 3;
      result[i] = new KeyCodeCombo(ctrlKey, shiftKey, altKey, keyCode);
    }
    return result;
  }
  guessStableKeyCode(scanCode) {
    if (scanCode >= ScanCode.Digit1 && scanCode <= ScanCode.Digit0) {
      switch (scanCode) {
        case ScanCode.Digit1:
          return KeyCode.Digit1;
        case ScanCode.Digit2:
          return KeyCode.Digit2;
        case ScanCode.Digit3:
          return KeyCode.Digit3;
        case ScanCode.Digit4:
          return KeyCode.Digit4;
        case ScanCode.Digit5:
          return KeyCode.Digit5;
        case ScanCode.Digit6:
          return KeyCode.Digit6;
        case ScanCode.Digit7:
          return KeyCode.Digit7;
        case ScanCode.Digit8:
          return KeyCode.Digit8;
        case ScanCode.Digit9:
          return KeyCode.Digit9;
        case ScanCode.Digit0:
          return KeyCode.Digit0;
      }
    }
    const keyCodeCombos1 = this.lookupScanCodeCombo(new ScanCodeCombo(false, false, false, scanCode));
    const keyCodeCombos2 = this.lookupScanCodeCombo(new ScanCodeCombo(false, true, false, scanCode));
    if (keyCodeCombos1.length === 1 && keyCodeCombos2.length === 1) {
      const shiftKey1 = keyCodeCombos1[0].shiftKey;
      const keyCode1 = keyCodeCombos1[0].keyCode;
      const shiftKey2 = keyCodeCombos2[0].shiftKey;
      const keyCode2 = keyCodeCombos2[0].keyCode;
      if (keyCode1 === keyCode2 && shiftKey1 !== shiftKey2) {
        return keyCode1;
      }
    }
    return KeyCode.DependsOnKbLayout;
  }
  _encodeScanCodeCombo(scanCodeCombo) {
    return this._encode(scanCodeCombo.ctrlKey, scanCodeCombo.shiftKey, scanCodeCombo.altKey, scanCodeCombo.scanCode);
  }
  _encodeKeyCodeCombo(keyCodeCombo) {
    return this._encode(keyCodeCombo.ctrlKey, keyCodeCombo.shiftKey, keyCodeCombo.altKey, keyCodeCombo.keyCode);
  }
  _encode(ctrlKey, shiftKey, altKey, principal) {
    return ((ctrlKey ? 1 : 0) << 0 | (shiftKey ? 1 : 0) << 1 | (altKey ? 1 : 0) << 2 | principal << 3) >>> 0;
  }
}
class MacLinuxKeyboardMapper {
  constructor(_isUSStandard, rawMappings, _mapAltGrToCtrlAlt, _OS) {
    this._isUSStandard = _isUSStandard;
    this._mapAltGrToCtrlAlt = _mapAltGrToCtrlAlt;
    this._OS = _OS;
    /**
     * UI label for a ScanCode.
     */
    this._scanCodeToLabel = [];
    /**
     * Dispatching string for a ScanCode.
     */
    this._scanCodeToDispatch = [];
    this._codeInfo = [];
    this._scanCodeKeyCodeMapper = new ScanCodeKeyCodeMapper();
    this._scanCodeToLabel = [];
    this._scanCodeToDispatch = [];
    const _registerIfUnknown = (hwCtrlKey, hwShiftKey, hwAltKey, scanCode, kbCtrlKey, kbShiftKey, kbAltKey, keyCode) => {
      this._scanCodeKeyCodeMapper.registerIfUnknown(
        new ScanCodeCombo(hwCtrlKey ? true : false, hwShiftKey ? true : false, hwAltKey ? true : false, scanCode),
        new KeyCodeCombo(kbCtrlKey ? true : false, kbShiftKey ? true : false, kbAltKey ? true : false, keyCode)
      );
    };
    const _registerAllCombos = (_ctrlKey, _shiftKey, _altKey, scanCode, keyCode) => {
      for (let ctrlKey = _ctrlKey; ctrlKey <= 1; ctrlKey++) {
        for (let shiftKey = _shiftKey; shiftKey <= 1; shiftKey++) {
          for (let altKey = _altKey; altKey <= 1; altKey++) {
            _registerIfUnknown(
              ctrlKey,
              shiftKey,
              altKey,
              scanCode,
              ctrlKey,
              shiftKey,
              altKey,
              keyCode
            );
          }
        }
      }
    };
    for (let scanCode = ScanCode.None; scanCode < ScanCode.MAX_VALUE; scanCode++) {
      this._scanCodeToLabel[scanCode] = null;
    }
    for (let scanCode = ScanCode.None; scanCode < ScanCode.MAX_VALUE; scanCode++) {
      this._scanCodeToDispatch[scanCode] = null;
    }
    for (let scanCode = ScanCode.None; scanCode < ScanCode.MAX_VALUE; scanCode++) {
      const keyCode = IMMUTABLE_CODE_TO_KEY_CODE[scanCode];
      if (keyCode !== KeyCode.DependsOnKbLayout) {
        _registerAllCombos(0, 0, 0, scanCode, keyCode);
        this._scanCodeToLabel[scanCode] = KeyCodeUtils.toString(keyCode);
        if (keyCode === KeyCode.Unknown || keyCode === KeyCode.Ctrl || keyCode === KeyCode.Meta || keyCode === KeyCode.Alt || keyCode === KeyCode.Shift) {
          this._scanCodeToDispatch[scanCode] = null;
        } else {
          this._scanCodeToDispatch[scanCode] = `[${ScanCodeUtils.toString(scanCode)}]`;
        }
      }
    }
    const missingLatinLettersOverride = {};
    {
      const producesLatinLetter = [];
      for (const strScanCode in rawMappings) {
        if (rawMappings.hasOwnProperty(strScanCode)) {
          const scanCode = ScanCodeUtils.toEnum(strScanCode);
          if (scanCode === ScanCode.None) {
            continue;
          }
          if (IMMUTABLE_CODE_TO_KEY_CODE[scanCode] !== KeyCode.DependsOnKbLayout) {
            continue;
          }
          const rawMapping = rawMappings[strScanCode];
          const value = MacLinuxKeyboardMapper.getCharCode(rawMapping.value);
          if (value >= CharCode.a && value <= CharCode.z) {
            const upperCaseValue = CharCode.A + (value - CharCode.a);
            producesLatinLetter[upperCaseValue] = true;
          }
        }
      }
      const _registerLetterIfMissing = (charCode, scanCode, value, withShift) => {
        if (!producesLatinLetter[charCode]) {
          missingLatinLettersOverride[ScanCodeUtils.toString(scanCode)] = {
            value,
            withShift,
            withAltGr: "",
            withShiftAltGr: ""
          };
        }
      };
      _registerLetterIfMissing(CharCode.A, ScanCode.KeyA, "a", "A");
      _registerLetterIfMissing(CharCode.B, ScanCode.KeyB, "b", "B");
      _registerLetterIfMissing(CharCode.C, ScanCode.KeyC, "c", "C");
      _registerLetterIfMissing(CharCode.D, ScanCode.KeyD, "d", "D");
      _registerLetterIfMissing(CharCode.E, ScanCode.KeyE, "e", "E");
      _registerLetterIfMissing(CharCode.F, ScanCode.KeyF, "f", "F");
      _registerLetterIfMissing(CharCode.G, ScanCode.KeyG, "g", "G");
      _registerLetterIfMissing(CharCode.H, ScanCode.KeyH, "h", "H");
      _registerLetterIfMissing(CharCode.I, ScanCode.KeyI, "i", "I");
      _registerLetterIfMissing(CharCode.J, ScanCode.KeyJ, "j", "J");
      _registerLetterIfMissing(CharCode.K, ScanCode.KeyK, "k", "K");
      _registerLetterIfMissing(CharCode.L, ScanCode.KeyL, "l", "L");
      _registerLetterIfMissing(CharCode.M, ScanCode.KeyM, "m", "M");
      _registerLetterIfMissing(CharCode.N, ScanCode.KeyN, "n", "N");
      _registerLetterIfMissing(CharCode.O, ScanCode.KeyO, "o", "O");
      _registerLetterIfMissing(CharCode.P, ScanCode.KeyP, "p", "P");
      _registerLetterIfMissing(CharCode.Q, ScanCode.KeyQ, "q", "Q");
      _registerLetterIfMissing(CharCode.R, ScanCode.KeyR, "r", "R");
      _registerLetterIfMissing(CharCode.S, ScanCode.KeyS, "s", "S");
      _registerLetterIfMissing(CharCode.T, ScanCode.KeyT, "t", "T");
      _registerLetterIfMissing(CharCode.U, ScanCode.KeyU, "u", "U");
      _registerLetterIfMissing(CharCode.V, ScanCode.KeyV, "v", "V");
      _registerLetterIfMissing(CharCode.W, ScanCode.KeyW, "w", "W");
      _registerLetterIfMissing(CharCode.X, ScanCode.KeyX, "x", "X");
      _registerLetterIfMissing(CharCode.Y, ScanCode.KeyY, "y", "Y");
      _registerLetterIfMissing(CharCode.Z, ScanCode.KeyZ, "z", "Z");
    }
    const mappings = [];
    let mappingsLen = 0;
    for (const strScanCode in rawMappings) {
      if (rawMappings.hasOwnProperty(strScanCode)) {
        const scanCode = ScanCodeUtils.toEnum(strScanCode);
        if (scanCode === ScanCode.None) {
          continue;
        }
        if (IMMUTABLE_CODE_TO_KEY_CODE[scanCode] !== KeyCode.DependsOnKbLayout) {
          continue;
        }
        this._codeInfo[scanCode] = rawMappings[strScanCode];
        const rawMapping = missingLatinLettersOverride[strScanCode] || rawMappings[strScanCode];
        const value = MacLinuxKeyboardMapper.getCharCode(rawMapping.value);
        const withShift = MacLinuxKeyboardMapper.getCharCode(rawMapping.withShift);
        const withAltGr = MacLinuxKeyboardMapper.getCharCode(rawMapping.withAltGr);
        const withShiftAltGr = MacLinuxKeyboardMapper.getCharCode(rawMapping.withShiftAltGr);
        const mapping = {
          scanCode,
          value,
          withShift,
          withAltGr,
          withShiftAltGr
        };
        mappings[mappingsLen++] = mapping;
        this._scanCodeToDispatch[scanCode] = `[${ScanCodeUtils.toString(scanCode)}]`;
        if (value >= CharCode.a && value <= CharCode.z) {
          const upperCaseValue = CharCode.A + (value - CharCode.a);
          this._scanCodeToLabel[scanCode] = String.fromCharCode(upperCaseValue);
        } else if (value >= CharCode.A && value <= CharCode.Z) {
          this._scanCodeToLabel[scanCode] = String.fromCharCode(value);
        } else if (value) {
          this._scanCodeToLabel[scanCode] = String.fromCharCode(value);
        } else {
          this._scanCodeToLabel[scanCode] = null;
        }
      }
    }
    for (let i = mappings.length - 1; i >= 0; i--) {
      const mapping = mappings[i];
      const scanCode = mapping.scanCode;
      const withShiftAltGr = mapping.withShiftAltGr;
      if (withShiftAltGr === mapping.withAltGr || withShiftAltGr === mapping.withShift || withShiftAltGr === mapping.value) {
        continue;
      }
      const kb = MacLinuxKeyboardMapper._charCodeToKb(withShiftAltGr);
      if (!kb) {
        continue;
      }
      const kbShiftKey = kb.shiftKey;
      const keyCode = kb.keyCode;
      if (kbShiftKey) {
        _registerIfUnknown(1, 1, 1, scanCode, 0, 1, 0, keyCode);
      } else {
        _registerIfUnknown(1, 1, 1, scanCode, 0, 0, 0, keyCode);
      }
    }
    for (let i = mappings.length - 1; i >= 0; i--) {
      const mapping = mappings[i];
      const scanCode = mapping.scanCode;
      const withAltGr = mapping.withAltGr;
      if (withAltGr === mapping.withShift || withAltGr === mapping.value) {
        continue;
      }
      const kb = MacLinuxKeyboardMapper._charCodeToKb(withAltGr);
      if (!kb) {
        continue;
      }
      const kbShiftKey = kb.shiftKey;
      const keyCode = kb.keyCode;
      if (kbShiftKey) {
        _registerIfUnknown(1, 0, 1, scanCode, 0, 1, 0, keyCode);
      } else {
        _registerIfUnknown(1, 0, 1, scanCode, 0, 0, 0, keyCode);
      }
    }
    for (let i = mappings.length - 1; i >= 0; i--) {
      const mapping = mappings[i];
      const scanCode = mapping.scanCode;
      const withShift = mapping.withShift;
      if (withShift === mapping.value) {
        continue;
      }
      const kb = MacLinuxKeyboardMapper._charCodeToKb(withShift);
      if (!kb) {
        continue;
      }
      const kbShiftKey = kb.shiftKey;
      const keyCode = kb.keyCode;
      if (kbShiftKey) {
        _registerIfUnknown(0, 1, 0, scanCode, 0, 1, 0, keyCode);
        _registerIfUnknown(0, 1, 1, scanCode, 0, 1, 1, keyCode);
        _registerIfUnknown(1, 1, 0, scanCode, 1, 1, 0, keyCode);
        _registerIfUnknown(1, 1, 1, scanCode, 1, 1, 1, keyCode);
      } else {
        _registerIfUnknown(0, 1, 0, scanCode, 0, 0, 0, keyCode);
        _registerIfUnknown(0, 1, 0, scanCode, 0, 1, 0, keyCode);
        _registerIfUnknown(0, 1, 1, scanCode, 0, 0, 1, keyCode);
        _registerIfUnknown(0, 1, 1, scanCode, 0, 1, 1, keyCode);
        _registerIfUnknown(1, 1, 0, scanCode, 1, 0, 0, keyCode);
        _registerIfUnknown(1, 1, 0, scanCode, 1, 1, 0, keyCode);
        _registerIfUnknown(1, 1, 1, scanCode, 1, 0, 1, keyCode);
        _registerIfUnknown(1, 1, 1, scanCode, 1, 1, 1, keyCode);
      }
    }
    for (let i = mappings.length - 1; i >= 0; i--) {
      const mapping = mappings[i];
      const scanCode = mapping.scanCode;
      const kb = MacLinuxKeyboardMapper._charCodeToKb(mapping.value);
      if (!kb) {
        continue;
      }
      const kbShiftKey = kb.shiftKey;
      const keyCode = kb.keyCode;
      if (kbShiftKey) {
        _registerIfUnknown(0, 0, 0, scanCode, 0, 1, 0, keyCode);
        _registerIfUnknown(0, 0, 1, scanCode, 0, 1, 1, keyCode);
        _registerIfUnknown(1, 0, 0, scanCode, 1, 1, 0, keyCode);
        _registerIfUnknown(1, 0, 1, scanCode, 1, 1, 1, keyCode);
      } else {
        _registerIfUnknown(0, 0, 0, scanCode, 0, 0, 0, keyCode);
        _registerIfUnknown(0, 0, 1, scanCode, 0, 0, 1, keyCode);
        _registerIfUnknown(0, 1, 0, scanCode, 0, 1, 0, keyCode);
        _registerIfUnknown(0, 1, 1, scanCode, 0, 1, 1, keyCode);
        _registerIfUnknown(1, 0, 0, scanCode, 1, 0, 0, keyCode);
        _registerIfUnknown(1, 0, 1, scanCode, 1, 0, 1, keyCode);
        _registerIfUnknown(1, 1, 0, scanCode, 1, 1, 0, keyCode);
        _registerIfUnknown(1, 1, 1, scanCode, 1, 1, 1, keyCode);
      }
    }
    _registerAllCombos(0, 0, 0, ScanCode.Digit1, KeyCode.Digit1);
    _registerAllCombos(0, 0, 0, ScanCode.Digit2, KeyCode.Digit2);
    _registerAllCombos(0, 0, 0, ScanCode.Digit3, KeyCode.Digit3);
    _registerAllCombos(0, 0, 0, ScanCode.Digit4, KeyCode.Digit4);
    _registerAllCombos(0, 0, 0, ScanCode.Digit5, KeyCode.Digit5);
    _registerAllCombos(0, 0, 0, ScanCode.Digit6, KeyCode.Digit6);
    _registerAllCombos(0, 0, 0, ScanCode.Digit7, KeyCode.Digit7);
    _registerAllCombos(0, 0, 0, ScanCode.Digit8, KeyCode.Digit8);
    _registerAllCombos(0, 0, 0, ScanCode.Digit9, KeyCode.Digit9);
    _registerAllCombos(0, 0, 0, ScanCode.Digit0, KeyCode.Digit0);
    this._scanCodeKeyCodeMapper.registrationComplete();
  }
  dumpDebugInfo() {
    const result = [];
    const immutableSamples = [
      ScanCode.ArrowUp,
      ScanCode.Numpad0
    ];
    let cnt = 0;
    result.push(`isUSStandard: ${this._isUSStandard}`);
    result.push(`----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------`);
    for (let scanCode = ScanCode.None; scanCode < ScanCode.MAX_VALUE; scanCode++) {
      if (IMMUTABLE_CODE_TO_KEY_CODE[scanCode] !== KeyCode.DependsOnKbLayout) {
        if (immutableSamples.indexOf(scanCode) === -1) {
          continue;
        }
      }
      if (cnt % 4 === 0) {
        result.push(`|       HW Code combination      |  Key  |    KeyCode combination    | Pri |          UI label         |         User settings          |    Electron accelerator   |       Dispatching string       | WYSIWYG |`);
        result.push(`----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------`);
      }
      cnt++;
      const mapping = this._codeInfo[scanCode];
      for (let mod = 0; mod < 8; mod++) {
        const hwCtrlKey = mod & 1 ? true : false;
        const hwShiftKey = mod & 2 ? true : false;
        const hwAltKey = mod & 4 ? true : false;
        const scanCodeCombo = new ScanCodeCombo(hwCtrlKey, hwShiftKey, hwAltKey, scanCode);
        const resolvedKb = this.resolveKeyboardEvent({
          _standardKeyboardEventBrand: true,
          ctrlKey: scanCodeCombo.ctrlKey,
          shiftKey: scanCodeCombo.shiftKey,
          altKey: scanCodeCombo.altKey,
          metaKey: false,
          altGraphKey: false,
          keyCode: KeyCode.DependsOnKbLayout,
          code: ScanCodeUtils.toString(scanCode)
        });
        const outScanCodeCombo = scanCodeCombo.toString();
        const outKey = scanCodeCombo.getProducedChar(mapping);
        const ariaLabel = resolvedKb.getAriaLabel();
        const outUILabel = ariaLabel ? ariaLabel.replace(/Control\+/, "Ctrl+") : null;
        const outUserSettings = resolvedKb.getUserSettingsLabel();
        const outElectronAccelerator = resolvedKb.getElectronAccelerator();
        const outDispatchStr = resolvedKb.getDispatchChords()[0];
        const isWYSIWYG = resolvedKb ? resolvedKb.isWYSIWYG() : false;
        const outWYSIWYG = isWYSIWYG ? "       " : "   NO  ";
        const kbCombos = this._scanCodeKeyCodeMapper.lookupScanCodeCombo(scanCodeCombo);
        if (kbCombos.length === 0) {
          result.push(`| ${this._leftPad(outScanCodeCombo, 30)} | ${outKey} | ${this._leftPad("", 25)} | ${this._leftPad("", 3)} | ${this._leftPad(outUILabel, 25)} | ${this._leftPad(outUserSettings, 30)} | ${this._leftPad(outElectronAccelerator, 25)} | ${this._leftPad(outDispatchStr, 30)} | ${outWYSIWYG} |`);
        } else {
          for (let i = 0, len = kbCombos.length; i < len; i++) {
            const kbCombo = kbCombos[i];
            let colPriority;
            const scanCodeCombos = this._scanCodeKeyCodeMapper.lookupKeyCodeCombo(kbCombo);
            if (scanCodeCombos.length === 1) {
              colPriority = "";
            } else {
              let priority = -1;
              for (let j = 0; j < scanCodeCombos.length; j++) {
                if (scanCodeCombos[j].equals(scanCodeCombo)) {
                  priority = j + 1;
                  break;
                }
              }
              colPriority = String(priority);
            }
            const outKeybinding = kbCombo.toString();
            if (i === 0) {
              result.push(`| ${this._leftPad(outScanCodeCombo, 30)} | ${outKey} | ${this._leftPad(outKeybinding, 25)} | ${this._leftPad(colPriority, 3)} | ${this._leftPad(outUILabel, 25)} | ${this._leftPad(outUserSettings, 30)} | ${this._leftPad(outElectronAccelerator, 25)} | ${this._leftPad(outDispatchStr, 30)} | ${outWYSIWYG} |`);
            } else {
              result.push(`| ${this._leftPad("", 30)} |       | ${this._leftPad(outKeybinding, 25)} | ${this._leftPad(colPriority, 3)} | ${this._leftPad("", 25)} | ${this._leftPad("", 30)} | ${this._leftPad("", 25)} | ${this._leftPad("", 30)} |         |`);
            }
          }
        }
      }
      result.push(`----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------`);
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
  keyCodeChordToScanCodeChord(chord) {
    if (chord.keyCode === KeyCode.Enter) {
      return [new ScanCodeChord(chord.ctrlKey, chord.shiftKey, chord.altKey, chord.metaKey, ScanCode.Enter)];
    }
    const scanCodeCombos = this._scanCodeKeyCodeMapper.lookupKeyCodeCombo(
      new KeyCodeCombo(chord.ctrlKey, chord.shiftKey, chord.altKey, chord.keyCode)
    );
    const result = [];
    for (let i = 0, len = scanCodeCombos.length; i < len; i++) {
      const scanCodeCombo = scanCodeCombos[i];
      result[i] = new ScanCodeChord(scanCodeCombo.ctrlKey, scanCodeCombo.shiftKey, scanCodeCombo.altKey, chord.metaKey, scanCodeCombo.scanCode);
    }
    return result;
  }
  getUILabelForScanCodeChord(chord) {
    if (!chord) {
      return null;
    }
    if (chord.isDuplicateModifierCase()) {
      return "";
    }
    if (this._OS === OperatingSystem.Macintosh) {
      switch (chord.scanCode) {
        case ScanCode.ArrowLeft:
          return "\u2190";
        case ScanCode.ArrowUp:
          return "\u2191";
        case ScanCode.ArrowRight:
          return "\u2192";
        case ScanCode.ArrowDown:
          return "\u2193";
      }
    }
    return this._scanCodeToLabel[chord.scanCode];
  }
  getAriaLabelForScanCodeChord(chord) {
    if (!chord) {
      return null;
    }
    if (chord.isDuplicateModifierCase()) {
      return "";
    }
    return this._scanCodeToLabel[chord.scanCode];
  }
  getDispatchStrForScanCodeChord(chord) {
    const codeDispatch = this._scanCodeToDispatch[chord.scanCode];
    if (!codeDispatch) {
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
    result += codeDispatch;
    return result;
  }
  getUserSettingsLabelForScanCodeChord(chord) {
    if (!chord) {
      return null;
    }
    if (chord.isDuplicateModifierCase()) {
      return "";
    }
    const immutableKeyCode = IMMUTABLE_CODE_TO_KEY_CODE[chord.scanCode];
    if (immutableKeyCode !== KeyCode.DependsOnKbLayout) {
      return KeyCodeUtils.toUserSettingsUS(immutableKeyCode).toLowerCase();
    }
    const constantKeyCode = this._scanCodeKeyCodeMapper.guessStableKeyCode(chord.scanCode);
    if (constantKeyCode !== KeyCode.DependsOnKbLayout) {
      const reverseChords = this.keyCodeChordToScanCodeChord(new KeyCodeChord(chord.ctrlKey, chord.shiftKey, chord.altKey, chord.metaKey, constantKeyCode));
      for (let i = 0, len = reverseChords.length; i < len; i++) {
        const reverseChord = reverseChords[i];
        if (reverseChord.scanCode === chord.scanCode) {
          return KeyCodeUtils.toUserSettingsUS(constantKeyCode).toLowerCase();
        }
      }
    }
    return this._scanCodeToDispatch[chord.scanCode];
  }
  getElectronAcceleratorLabelForScanCodeChord(chord) {
    if (!chord) {
      return null;
    }
    const immutableKeyCode = IMMUTABLE_CODE_TO_KEY_CODE[chord.scanCode];
    if (immutableKeyCode !== KeyCode.DependsOnKbLayout) {
      return KeyCodeUtils.toElectronAccelerator(immutableKeyCode);
    }
    const constantKeyCode = this._scanCodeKeyCodeMapper.guessStableKeyCode(chord.scanCode);
    if (this._OS === OperatingSystem.Linux && !this._isUSStandard) {
      const isOEMKey = constantKeyCode === KeyCode.Semicolon || constantKeyCode === KeyCode.Equal || constantKeyCode === KeyCode.Comma || constantKeyCode === KeyCode.Minus || constantKeyCode === KeyCode.Period || constantKeyCode === KeyCode.Slash || constantKeyCode === KeyCode.Backquote || constantKeyCode === KeyCode.BracketLeft || constantKeyCode === KeyCode.Backslash || constantKeyCode === KeyCode.BracketRight;
      if (isOEMKey) {
        return null;
      }
    }
    if (constantKeyCode !== KeyCode.DependsOnKbLayout) {
      return KeyCodeUtils.toElectronAccelerator(constantKeyCode);
    }
    return null;
  }
  _toResolvedKeybinding(chordParts) {
    if (chordParts.length === 0) {
      return [];
    }
    const result = [];
    this._generateResolvedKeybindings(chordParts, 0, [], result);
    return result;
  }
  _generateResolvedKeybindings(chordParts, currentIndex, previousParts, result) {
    const chordPart = chordParts[currentIndex];
    const isFinalIndex = currentIndex === chordParts.length - 1;
    for (let i = 0, len = chordPart.length; i < len; i++) {
      const chords = [...previousParts, chordPart[i]];
      if (isFinalIndex) {
        result.push(new NativeResolvedKeybinding(this, this._OS, chords));
      } else {
        this._generateResolvedKeybindings(chordParts, currentIndex + 1, chords, result);
      }
    }
  }
  resolveKeyboardEvent(keyboardEvent) {
    let code = ScanCodeUtils.toEnum(keyboardEvent.code);
    if (code === ScanCode.NumpadEnter) {
      code = ScanCode.Enter;
    }
    const keyCode = keyboardEvent.keyCode;
    if (keyCode === KeyCode.LeftArrow || keyCode === KeyCode.UpArrow || keyCode === KeyCode.RightArrow || keyCode === KeyCode.DownArrow || keyCode === KeyCode.Delete || keyCode === KeyCode.Insert || keyCode === KeyCode.Home || keyCode === KeyCode.End || keyCode === KeyCode.PageDown || keyCode === KeyCode.PageUp || keyCode === KeyCode.Backspace) {
      const immutableScanCode = IMMUTABLE_KEY_CODE_TO_CODE[keyCode];
      if (immutableScanCode !== ScanCode.DependsOnKbLayout) {
        code = immutableScanCode;
      }
    } else {
      if (code === ScanCode.Numpad1 || code === ScanCode.Numpad2 || code === ScanCode.Numpad3 || code === ScanCode.Numpad4 || code === ScanCode.Numpad5 || code === ScanCode.Numpad6 || code === ScanCode.Numpad7 || code === ScanCode.Numpad8 || code === ScanCode.Numpad9 || code === ScanCode.Numpad0 || code === ScanCode.NumpadDecimal) {
        if (keyCode >= 0) {
          const immutableScanCode = IMMUTABLE_KEY_CODE_TO_CODE[keyCode];
          if (immutableScanCode !== ScanCode.DependsOnKbLayout) {
            code = immutableScanCode;
          }
        }
      }
    }
    const ctrlKey = keyboardEvent.ctrlKey || this._mapAltGrToCtrlAlt && keyboardEvent.altGraphKey;
    const altKey = keyboardEvent.altKey || this._mapAltGrToCtrlAlt && keyboardEvent.altGraphKey;
    const chord = new ScanCodeChord(ctrlKey, keyboardEvent.shiftKey, altKey, keyboardEvent.metaKey, code);
    return new NativeResolvedKeybinding(this, this._OS, [chord]);
  }
  _resolveChord(chord) {
    if (!chord) {
      return [];
    }
    if (chord instanceof ScanCodeChord) {
      return [chord];
    }
    return this.keyCodeChordToScanCodeChord(chord);
  }
  resolveKeybinding(keybinding) {
    const chords = keybinding.chords.map((chord) => this._resolveChord(chord));
    return this._toResolvedKeybinding(chords);
  }
  static _redirectCharCode(charCode) {
    switch (charCode) {
      // allow-any-unicode-next-line
      // CJK: 。 「 」 【 】 ； ，
      // map: . [ ] [ ] ; ,
      case CharCode.U_IDEOGRAPHIC_FULL_STOP:
        return CharCode.Period;
      case CharCode.U_LEFT_CORNER_BRACKET:
        return CharCode.OpenSquareBracket;
      case CharCode.U_RIGHT_CORNER_BRACKET:
        return CharCode.CloseSquareBracket;
      case CharCode.U_LEFT_BLACK_LENTICULAR_BRACKET:
        return CharCode.OpenSquareBracket;
      case CharCode.U_RIGHT_BLACK_LENTICULAR_BRACKET:
        return CharCode.CloseSquareBracket;
      case CharCode.U_FULLWIDTH_SEMICOLON:
        return CharCode.Semicolon;
      case CharCode.U_FULLWIDTH_COMMA:
        return CharCode.Comma;
    }
    return charCode;
  }
  static _charCodeToKb(charCode) {
    charCode = this._redirectCharCode(charCode);
    if (charCode < CHAR_CODE_TO_KEY_CODE.length) {
      return CHAR_CODE_TO_KEY_CODE[charCode];
    }
    return null;
  }
  /**
   * Attempt to map a combining character to a regular one that renders the same way.
   *
   * https://www.compart.com/en/unicode/bidiclass/NSM
   */
  static getCharCode(char) {
    if (char.length === 0) {
      return 0;
    }
    const charCode = char.charCodeAt(0);
    switch (charCode) {
      case CharCode.U_Combining_Grave_Accent:
        return CharCode.U_GRAVE_ACCENT;
      case CharCode.U_Combining_Acute_Accent:
        return CharCode.U_ACUTE_ACCENT;
      case CharCode.U_Combining_Circumflex_Accent:
        return CharCode.U_CIRCUMFLEX;
      case CharCode.U_Combining_Tilde:
        return CharCode.U_SMALL_TILDE;
      case CharCode.U_Combining_Macron:
        return CharCode.U_MACRON;
      case CharCode.U_Combining_Overline:
        return CharCode.U_OVERLINE;
      case CharCode.U_Combining_Breve:
        return CharCode.U_BREVE;
      case CharCode.U_Combining_Dot_Above:
        return CharCode.U_DOT_ABOVE;
      case CharCode.U_Combining_Diaeresis:
        return CharCode.U_DIAERESIS;
      case CharCode.U_Combining_Ring_Above:
        return CharCode.U_RING_ABOVE;
      case CharCode.U_Combining_Double_Acute_Accent:
        return CharCode.U_DOUBLE_ACUTE_ACCENT;
    }
    return charCode;
  }
}
(function() {
  function define(charCode, keyCode, shiftKey) {
    for (let i = CHAR_CODE_TO_KEY_CODE.length; i < charCode; i++) {
      CHAR_CODE_TO_KEY_CODE[i] = null;
    }
    CHAR_CODE_TO_KEY_CODE[charCode] = { keyCode, shiftKey };
  }
  for (let chCode = CharCode.A; chCode <= CharCode.Z; chCode++) {
    define(chCode, KeyCode.KeyA + (chCode - CharCode.A), true);
  }
  for (let chCode = CharCode.a; chCode <= CharCode.z; chCode++) {
    define(chCode, KeyCode.KeyA + (chCode - CharCode.a), false);
  }
  define(CharCode.Semicolon, KeyCode.Semicolon, false);
  define(CharCode.Colon, KeyCode.Semicolon, true);
  define(CharCode.Equals, KeyCode.Equal, false);
  define(CharCode.Plus, KeyCode.Equal, true);
  define(CharCode.Comma, KeyCode.Comma, false);
  define(CharCode.LessThan, KeyCode.Comma, true);
  define(CharCode.Dash, KeyCode.Minus, false);
  define(CharCode.Underline, KeyCode.Minus, true);
  define(CharCode.Period, KeyCode.Period, false);
  define(CharCode.GreaterThan, KeyCode.Period, true);
  define(CharCode.Slash, KeyCode.Slash, false);
  define(CharCode.QuestionMark, KeyCode.Slash, true);
  define(CharCode.BackTick, KeyCode.Backquote, false);
  define(CharCode.Tilde, KeyCode.Backquote, true);
  define(CharCode.OpenSquareBracket, KeyCode.BracketLeft, false);
  define(CharCode.OpenCurlyBrace, KeyCode.BracketLeft, true);
  define(CharCode.Backslash, KeyCode.Backslash, false);
  define(CharCode.Pipe, KeyCode.Backslash, true);
  define(CharCode.CloseSquareBracket, KeyCode.BracketRight, false);
  define(CharCode.CloseCurlyBrace, KeyCode.BracketRight, true);
  define(CharCode.SingleQuote, KeyCode.Quote, false);
  define(CharCode.DoubleQuote, KeyCode.Quote, true);
})();
export {
  MacLinuxKeyboardMapper,
  NativeResolvedKeybinding
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMva2V5YmluZGluZy9jb21tb24vbWFjTGludXhLZXlib2FyZE1hcHBlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENoYXJDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2hhckNvZGUuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5Q29kZVV0aWxzLCBJTU1VVEFCTEVfQ09ERV9UT19LRVlfQ09ERSwgSU1NVVRBQkxFX0tFWV9DT0RFX1RPX0NPREUsIFNjYW5Db2RlLCBTY2FuQ29kZVV0aWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgUmVzb2x2ZWRLZXliaW5kaW5nLCBLZXlDb2RlQ2hvcmQsIFNpbmdsZU1vZGlmaWVyQ2hvcmQsIFNjYW5Db2RlQ2hvcmQsIEtleWJpbmRpbmcsIENob3JkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5YmluZGluZ3MuanMnO1xuaW1wb3J0IHsgT3BlcmF0aW5nU3lzdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSUtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElLZXlib2FyZE1hcHBlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJvYXJkTGF5b3V0L2NvbW1vbi9rZXlib2FyZE1hcHBlci5qcyc7XG5pbXBvcnQgeyBCYXNlUmVzb2x2ZWRLZXliaW5kaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24vYmFzZVJlc29sdmVkS2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJTWFjTGludXhLZXlib2FyZE1hcHBpbmcsIElNYWNMaW51eEtleU1hcHBpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXlib2FyZExheW91dC9jb21tb24va2V5Ym9hcmRMYXlvdXQuanMnO1xuXG4vKipcbiAqIEEgbWFwIGZyb20gY2hhcmFjdGVyIHRvIGtleSBjb2Rlcy5cbiAqIGUuZy4gQ29udGFpbnMgZW50cmllcyBzdWNoIGFzOlxuICogIC0gJy8nID0+IHsga2V5Q29kZTogS2V5Q29kZS5VU19TTEFTSCwgc2hpZnRLZXk6IGZhbHNlIH1cbiAqICAtICc/JyA9PiB7IGtleUNvZGU6IEtleUNvZGUuVVNfU0xBU0gsIHNoaWZ0S2V5OiB0cnVlIH1cbiAqL1xuY29uc3QgQ0hBUl9DT0RFX1RPX0tFWV9DT0RFOiAoeyBrZXlDb2RlOiBLZXlDb2RlOyBzaGlmdEtleTogYm9vbGVhbiB9IHwgbnVsbClbXSA9IFtdO1xuXG5leHBvcnQgY2xhc3MgTmF0aXZlUmVzb2x2ZWRLZXliaW5kaW5nIGV4dGVuZHMgQmFzZVJlc29sdmVkS2V5YmluZGluZzxTY2FuQ29kZUNob3JkPiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbWFwcGVyOiBNYWNMaW51eEtleWJvYXJkTWFwcGVyO1xuXG5cdGNvbnN0cnVjdG9yKG1hcHBlcjogTWFjTGludXhLZXlib2FyZE1hcHBlciwgb3M6IE9wZXJhdGluZ1N5c3RlbSwgY2hvcmRzOiBTY2FuQ29kZUNob3JkW10pIHtcblx0XHRzdXBlcihvcywgY2hvcmRzKTtcblx0XHR0aGlzLl9tYXBwZXIgPSBtYXBwZXI7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldExhYmVsKGNob3JkOiBTY2FuQ29kZUNob3JkKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuX21hcHBlci5nZXRVSUxhYmVsRm9yU2NhbkNvZGVDaG9yZChjaG9yZCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldEFyaWFMYWJlbChjaG9yZDogU2NhbkNvZGVDaG9yZCk6IHN0cmluZyB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl9tYXBwZXIuZ2V0QXJpYUxhYmVsRm9yU2NhbkNvZGVDaG9yZChjaG9yZCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldEVsZWN0cm9uQWNjZWxlcmF0b3IoY2hvcmQ6IFNjYW5Db2RlQ2hvcmQpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fbWFwcGVyLmdldEVsZWN0cm9uQWNjZWxlcmF0b3JMYWJlbEZvclNjYW5Db2RlQ2hvcmQoY2hvcmQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRVc2VyU2V0dGluZ3NMYWJlbChjaG9yZDogU2NhbkNvZGVDaG9yZCk6IHN0cmluZyB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl9tYXBwZXIuZ2V0VXNlclNldHRpbmdzTGFiZWxGb3JTY2FuQ29kZUNob3JkKGNob3JkKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfaXNXWVNJV1lHKGJpbmRpbmc6IFNjYW5Db2RlQ2hvcmQgfCBudWxsKTogYm9vbGVhbiB7XG5cdFx0aWYgKCFiaW5kaW5nKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKElNTVVUQUJMRV9DT0RFX1RPX0tFWV9DT0RFW2JpbmRpbmcuc2NhbkNvZGVdICE9PSBLZXlDb2RlLkRlcGVuZHNPbktiTGF5b3V0KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0Y29uc3QgYSA9IHRoaXMuX21hcHBlci5nZXRBcmlhTGFiZWxGb3JTY2FuQ29kZUNob3JkKGJpbmRpbmcpO1xuXHRcdGNvbnN0IGIgPSB0aGlzLl9tYXBwZXIuZ2V0VXNlclNldHRpbmdzTGFiZWxGb3JTY2FuQ29kZUNob3JkKGJpbmRpbmcpO1xuXG5cdFx0aWYgKCFhICYmICFiKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKCFhIHx8ICFiKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiAoYS50b0xvd2VyQ2FzZSgpID09PSBiLnRvTG93ZXJDYXNlKCkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRDaG9yZERpc3BhdGNoKGNob3JkOiBTY2FuQ29kZUNob3JkKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuX21hcHBlci5nZXREaXNwYXRjaFN0ckZvclNjYW5Db2RlQ2hvcmQoY2hvcmQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRTaW5nbGVNb2RpZmllckNob3JkRGlzcGF0Y2goY2hvcmQ6IFNjYW5Db2RlQ2hvcmQpOiBTaW5nbGVNb2RpZmllckNob3JkIHwgbnVsbCB7XG5cdFx0aWYgKChjaG9yZC5zY2FuQ29kZSA9PT0gU2NhbkNvZGUuQ29udHJvbExlZnQgfHwgY2hvcmQuc2NhbkNvZGUgPT09IFNjYW5Db2RlLkNvbnRyb2xSaWdodCkgJiYgIWNob3JkLnNoaWZ0S2V5ICYmICFjaG9yZC5hbHRLZXkgJiYgIWNob3JkLm1ldGFLZXkpIHtcblx0XHRcdHJldHVybiAnY3RybCc7XG5cdFx0fVxuXHRcdGlmICgoY2hvcmQuc2NhbkNvZGUgPT09IFNjYW5Db2RlLkFsdExlZnQgfHwgY2hvcmQuc2NhbkNvZGUgPT09IFNjYW5Db2RlLkFsdFJpZ2h0KSAmJiAhY2hvcmQuY3RybEtleSAmJiAhY2hvcmQuc2hpZnRLZXkgJiYgIWNob3JkLm1ldGFLZXkpIHtcblx0XHRcdHJldHVybiAnYWx0Jztcblx0XHR9XG5cdFx0aWYgKChjaG9yZC5zY2FuQ29kZSA9PT0gU2NhbkNvZGUuU2hpZnRMZWZ0IHx8IGNob3JkLnNjYW5Db2RlID09PSBTY2FuQ29kZS5TaGlmdFJpZ2h0KSAmJiAhY2hvcmQuY3RybEtleSAmJiAhY2hvcmQuYWx0S2V5ICYmICFjaG9yZC5tZXRhS2V5KSB7XG5cdFx0XHRyZXR1cm4gJ3NoaWZ0Jztcblx0XHR9XG5cdFx0aWYgKChjaG9yZC5zY2FuQ29kZSA9PT0gU2NhbkNvZGUuTWV0YUxlZnQgfHwgY2hvcmQuc2NhbkNvZGUgPT09IFNjYW5Db2RlLk1ldGFSaWdodCkgJiYgIWNob3JkLmN0cmxLZXkgJiYgIWNob3JkLnNoaWZ0S2V5ICYmICFjaG9yZC5hbHRLZXkpIHtcblx0XHRcdHJldHVybiAnbWV0YSc7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG59XG5cbmludGVyZmFjZSBJU2NhbkNvZGVNYXBwaW5nIHtcblx0c2NhbkNvZGU6IFNjYW5Db2RlO1xuXHR2YWx1ZTogbnVtYmVyO1xuXHR3aXRoU2hpZnQ6IG51bWJlcjtcblx0d2l0aEFsdEdyOiBudW1iZXI7XG5cdHdpdGhTaGlmdEFsdEdyOiBudW1iZXI7XG59XG5cbmNsYXNzIFNjYW5Db2RlQ29tYm8ge1xuXHRwdWJsaWMgcmVhZG9ubHkgY3RybEtleTogYm9vbGVhbjtcblx0cHVibGljIHJlYWRvbmx5IHNoaWZ0S2V5OiBib29sZWFuO1xuXHRwdWJsaWMgcmVhZG9ubHkgYWx0S2V5OiBib29sZWFuO1xuXHRwdWJsaWMgcmVhZG9ubHkgc2NhbkNvZGU6IFNjYW5Db2RlO1xuXG5cdGNvbnN0cnVjdG9yKGN0cmxLZXk6IGJvb2xlYW4sIHNoaWZ0S2V5OiBib29sZWFuLCBhbHRLZXk6IGJvb2xlYW4sIHNjYW5Db2RlOiBTY2FuQ29kZSkge1xuXHRcdHRoaXMuY3RybEtleSA9IGN0cmxLZXk7XG5cdFx0dGhpcy5zaGlmdEtleSA9IHNoaWZ0S2V5O1xuXHRcdHRoaXMuYWx0S2V5ID0gYWx0S2V5O1xuXHRcdHRoaXMuc2NhbkNvZGUgPSBzY2FuQ29kZTtcblx0fVxuXG5cdHB1YmxpYyB0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdHJldHVybiBgJHt0aGlzLmN0cmxLZXkgPyAnQ3RybCsnIDogJyd9JHt0aGlzLnNoaWZ0S2V5ID8gJ1NoaWZ0KycgOiAnJ30ke3RoaXMuYWx0S2V5ID8gJ0FsdCsnIDogJyd9JHtTY2FuQ29kZVV0aWxzLnRvU3RyaW5nKHRoaXMuc2NhbkNvZGUpfWA7XG5cdH1cblxuXHRwdWJsaWMgZXF1YWxzKG90aGVyOiBTY2FuQ29kZUNvbWJvKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIChcblx0XHRcdHRoaXMuY3RybEtleSA9PT0gb3RoZXIuY3RybEtleVxuXHRcdFx0JiYgdGhpcy5zaGlmdEtleSA9PT0gb3RoZXIuc2hpZnRLZXlcblx0XHRcdCYmIHRoaXMuYWx0S2V5ID09PSBvdGhlci5hbHRLZXlcblx0XHRcdCYmIHRoaXMuc2NhbkNvZGUgPT09IG90aGVyLnNjYW5Db2RlXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0UHJvZHVjZWRDaGFyQ29kZShtYXBwaW5nOiBJTWFjTGludXhLZXlNYXBwaW5nKTogc3RyaW5nIHtcblx0XHRpZiAoIW1hcHBpbmcpIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cdFx0aWYgKHRoaXMuY3RybEtleSAmJiB0aGlzLnNoaWZ0S2V5ICYmIHRoaXMuYWx0S2V5KSB7XG5cdFx0XHRyZXR1cm4gbWFwcGluZy53aXRoU2hpZnRBbHRHcjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuY3RybEtleSAmJiB0aGlzLmFsdEtleSkge1xuXHRcdFx0cmV0dXJuIG1hcHBpbmcud2l0aEFsdEdyO1xuXHRcdH1cblx0XHRpZiAodGhpcy5zaGlmdEtleSkge1xuXHRcdFx0cmV0dXJuIG1hcHBpbmcud2l0aFNoaWZ0O1xuXHRcdH1cblx0XHRyZXR1cm4gbWFwcGluZy52YWx1ZTtcblx0fVxuXG5cdHB1YmxpYyBnZXRQcm9kdWNlZENoYXIobWFwcGluZzogSU1hY0xpbnV4S2V5TWFwcGluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgY2hhckNvZGUgPSBNYWNMaW51eEtleWJvYXJkTWFwcGVyLmdldENoYXJDb2RlKHRoaXMuZ2V0UHJvZHVjZWRDaGFyQ29kZShtYXBwaW5nKSk7XG5cdFx0aWYgKGNoYXJDb2RlID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gJyAtLS0gJztcblx0XHR9XG5cdFx0aWYgKGNoYXJDb2RlID49IENoYXJDb2RlLlVfQ29tYmluaW5nX0dyYXZlX0FjY2VudCAmJiBjaGFyQ29kZSA8PSBDaGFyQ29kZS5VX0NvbWJpbmluZ19MYXRpbl9TbWFsbF9MZXR0ZXJfWCkge1xuXHRcdFx0Ly8gY29tYmluaW5nXG5cdFx0XHRyZXR1cm4gJ1UrJyArIGNoYXJDb2RlLnRvU3RyaW5nKDE2KTtcblx0XHR9XG5cdFx0cmV0dXJuICcgICcgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGNoYXJDb2RlKSArICcgICc7XG5cdH1cbn1cblxuY2xhc3MgS2V5Q29kZUNvbWJvIHtcblx0cHVibGljIHJlYWRvbmx5IGN0cmxLZXk6IGJvb2xlYW47XG5cdHB1YmxpYyByZWFkb25seSBzaGlmdEtleTogYm9vbGVhbjtcblx0cHVibGljIHJlYWRvbmx5IGFsdEtleTogYm9vbGVhbjtcblx0cHVibGljIHJlYWRvbmx5IGtleUNvZGU6IEtleUNvZGU7XG5cblx0Y29uc3RydWN0b3IoY3RybEtleTogYm9vbGVhbiwgc2hpZnRLZXk6IGJvb2xlYW4sIGFsdEtleTogYm9vbGVhbiwga2V5Q29kZTogS2V5Q29kZSkge1xuXHRcdHRoaXMuY3RybEtleSA9IGN0cmxLZXk7XG5cdFx0dGhpcy5zaGlmdEtleSA9IHNoaWZ0S2V5O1xuXHRcdHRoaXMuYWx0S2V5ID0gYWx0S2V5O1xuXHRcdHRoaXMua2V5Q29kZSA9IGtleUNvZGU7XG5cdH1cblxuXHRwdWJsaWMgdG9TdHJpbmcoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYCR7dGhpcy5jdHJsS2V5ID8gJ0N0cmwrJyA6ICcnfSR7dGhpcy5zaGlmdEtleSA/ICdTaGlmdCsnIDogJyd9JHt0aGlzLmFsdEtleSA/ICdBbHQrJyA6ICcnfSR7S2V5Q29kZVV0aWxzLnRvU3RyaW5nKHRoaXMua2V5Q29kZSl9YDtcblx0fVxufVxuXG5jbGFzcyBTY2FuQ29kZUtleUNvZGVNYXBwZXIge1xuXG5cdC8qKlxuXHQgKiBTY2FuQ29kZSBjb21iaW5hdGlvbiA9PiBLZXlDb2RlIGNvbWJpbmF0aW9uLlxuXHQgKiBPbmx5IGNvdmVycyByZWxldmFudCBtb2RpZmllcnMgY3RybCwgc2hpZnQsIGFsdCAoc2luY2UgbWV0YSBkb2VzIG5vdCBpbmZsdWVuY2UgdGhlIG1hcHBpbmdzKS5cblx0ICovXG5cdHByaXZhdGUgcmVhZG9ubHkgX3NjYW5Db2RlVG9LZXlDb2RlOiBudW1iZXJbXVtdID0gW107XG5cdC8qKlxuXHQgKiBpbnZlcnNlIG9mIGBfc2NhbkNvZGVUb0tleUNvZGVgLlxuXHQgKiBLZXlDb2RlIGNvbWJpbmF0aW9uID0+IFNjYW5Db2RlIGNvbWJpbmF0aW9uLlxuXHQgKiBPbmx5IGNvdmVycyByZWxldmFudCBtb2RpZmllcnMgY3RybCwgc2hpZnQsIGFsdCAoc2luY2UgbWV0YSBkb2VzIG5vdCBpbmZsdWVuY2UgdGhlIG1hcHBpbmdzKS5cblx0ICovXG5cdHByaXZhdGUgcmVhZG9ubHkgX2tleUNvZGVUb1NjYW5Db2RlOiBudW1iZXJbXVtdID0gW107XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5fc2NhbkNvZGVUb0tleUNvZGUgPSBbXTtcblx0XHR0aGlzLl9rZXlDb2RlVG9TY2FuQ29kZSA9IFtdO1xuXHR9XG5cblx0cHVibGljIHJlZ2lzdHJhdGlvbkNvbXBsZXRlKCk6IHZvaWQge1xuXHRcdC8vIEludGxIYXNoIGFuZCBJbnRsQmFja3NsYXNoIGFyZSByYXJlIGtleXMsIHNvIGVuc3VyZSB0aGV5IGRvbid0IGVuZCB1cCBiZWluZyB0aGUgcHJlZmVycmVkLi4uXG5cdFx0dGhpcy5fbW92ZVRvRW5kKFNjYW5Db2RlLkludGxIYXNoKTtcblx0XHR0aGlzLl9tb3ZlVG9FbmQoU2NhbkNvZGUuSW50bEJhY2tzbGFzaCk7XG5cdH1cblxuXHRwcml2YXRlIF9tb3ZlVG9FbmQoc2NhbkNvZGU6IFNjYW5Db2RlKTogdm9pZCB7XG5cdFx0Zm9yIChsZXQgbW9kID0gMDsgbW9kIDwgODsgbW9kKyspIHtcblx0XHRcdGNvbnN0IGVuY29kZWRLZXlDb2RlQ29tYm9zID0gdGhpcy5fc2NhbkNvZGVUb0tleUNvZGVbKHNjYW5Db2RlIDw8IDMpICsgbW9kXTtcblx0XHRcdGlmICghZW5jb2RlZEtleUNvZGVDb21ib3MpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gZW5jb2RlZEtleUNvZGVDb21ib3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgZW5jb2RlZFNjYW5Db2RlQ29tYm9zID0gdGhpcy5fa2V5Q29kZVRvU2NhbkNvZGVbZW5jb2RlZEtleUNvZGVDb21ib3NbaV1dO1xuXHRcdFx0XHRpZiAoZW5jb2RlZFNjYW5Db2RlQ29tYm9zLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAobGV0IGogPSAwLCBsZW4gPSBlbmNvZGVkU2NhbkNvZGVDb21ib3MubGVuZ3RoOyBqIDwgbGVuOyBqKyspIHtcblx0XHRcdFx0XHRjb25zdCBlbnRyeSA9IGVuY29kZWRTY2FuQ29kZUNvbWJvc1tqXTtcblx0XHRcdFx0XHRjb25zdCBlbnRyeVNjYW5Db2RlID0gKGVudHJ5ID4+PiAzKTtcblx0XHRcdFx0XHRpZiAoZW50cnlTY2FuQ29kZSA9PT0gc2NhbkNvZGUpIHtcblx0XHRcdFx0XHRcdC8vIE1vdmUgdGhpcyBlbnRyeSB0byB0aGUgZW5kXG5cdFx0XHRcdFx0XHRmb3IgKGxldCBrID0gaiArIDE7IGsgPCBsZW47IGsrKykge1xuXHRcdFx0XHRcdFx0XHRlbmNvZGVkU2NhbkNvZGVDb21ib3NbayAtIDFdID0gZW5jb2RlZFNjYW5Db2RlQ29tYm9zW2tdO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZW5jb2RlZFNjYW5Db2RlQ29tYm9zW2xlbiAtIDFdID0gZW50cnk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHJlZ2lzdGVySWZVbmtub3duKHNjYW5Db2RlQ29tYm86IFNjYW5Db2RlQ29tYm8sIGtleUNvZGVDb21ibzogS2V5Q29kZUNvbWJvKTogdm9pZCB7XG5cdFx0aWYgKGtleUNvZGVDb21iby5rZXlDb2RlID09PSBLZXlDb2RlLlVua25vd24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgc2NhbkNvZGVDb21ib0VuY29kZWQgPSB0aGlzLl9lbmNvZGVTY2FuQ29kZUNvbWJvKHNjYW5Db2RlQ29tYm8pO1xuXHRcdGNvbnN0IGtleUNvZGVDb21ib0VuY29kZWQgPSB0aGlzLl9lbmNvZGVLZXlDb2RlQ29tYm8oa2V5Q29kZUNvbWJvKTtcblxuXHRcdGNvbnN0IGtleUNvZGVJc0RpZ2l0ID0gKGtleUNvZGVDb21iby5rZXlDb2RlID49IEtleUNvZGUuRGlnaXQwICYmIGtleUNvZGVDb21iby5rZXlDb2RlIDw9IEtleUNvZGUuRGlnaXQ5KTtcblx0XHRjb25zdCBrZXlDb2RlSXNMZXR0ZXIgPSAoa2V5Q29kZUNvbWJvLmtleUNvZGUgPj0gS2V5Q29kZS5LZXlBICYmIGtleUNvZGVDb21iby5rZXlDb2RlIDw9IEtleUNvZGUuS2V5Wik7XG5cblx0XHRjb25zdCBleGlzdGluZ0tleUNvZGVDb21ib3MgPSB0aGlzLl9zY2FuQ29kZVRvS2V5Q29kZVtzY2FuQ29kZUNvbWJvRW5jb2RlZF07XG5cblx0XHQvLyBBbGxvdyBhIHNjYW4gY29kZSB0byBtYXAgdG8gbXVsdGlwbGUga2V5IGNvZGVzIGlmIGl0IGlzIGEgZGlnaXQgb3IgYSBsZXR0ZXIga2V5IGNvZGVcblx0XHRpZiAoa2V5Q29kZUlzRGlnaXQgfHwga2V5Q29kZUlzTGV0dGVyKSB7XG5cdFx0XHQvLyBPbmx5IGNoZWNrIHRoYXQgd2UgZG9uJ3QgaW5zZXJ0IHRoZSBzYW1lIGVudHJ5IHR3aWNlXG5cdFx0XHRpZiAoZXhpc3RpbmdLZXlDb2RlQ29tYm9zKSB7XG5cdFx0XHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBleGlzdGluZ0tleUNvZGVDb21ib3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0XHRpZiAoZXhpc3RpbmdLZXlDb2RlQ29tYm9zW2ldID09PSBrZXlDb2RlQ29tYm9FbmNvZGVkKSB7XG5cdFx0XHRcdFx0XHQvLyBhdm9pZCBkdXBsaWNhdGVzXG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIERvbid0IGFsbG93IG11bHRpcGxlc1xuXHRcdFx0aWYgKGV4aXN0aW5nS2V5Q29kZUNvbWJvcyAmJiBleGlzdGluZ0tleUNvZGVDb21ib3MubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9zY2FuQ29kZVRvS2V5Q29kZVtzY2FuQ29kZUNvbWJvRW5jb2RlZF0gPSB0aGlzLl9zY2FuQ29kZVRvS2V5Q29kZVtzY2FuQ29kZUNvbWJvRW5jb2RlZF0gfHwgW107XG5cdFx0dGhpcy5fc2NhbkNvZGVUb0tleUNvZGVbc2NhbkNvZGVDb21ib0VuY29kZWRdLnVuc2hpZnQoa2V5Q29kZUNvbWJvRW5jb2RlZCk7XG5cblx0XHR0aGlzLl9rZXlDb2RlVG9TY2FuQ29kZVtrZXlDb2RlQ29tYm9FbmNvZGVkXSA9IHRoaXMuX2tleUNvZGVUb1NjYW5Db2RlW2tleUNvZGVDb21ib0VuY29kZWRdIHx8IFtdO1xuXHRcdHRoaXMuX2tleUNvZGVUb1NjYW5Db2RlW2tleUNvZGVDb21ib0VuY29kZWRdLnVuc2hpZnQoc2NhbkNvZGVDb21ib0VuY29kZWQpO1xuXHR9XG5cblx0cHVibGljIGxvb2t1cEtleUNvZGVDb21ibyhrZXlDb2RlQ29tYm86IEtleUNvZGVDb21ibyk6IFNjYW5Db2RlQ29tYm9bXSB7XG5cdFx0Y29uc3Qga2V5Q29kZUNvbWJvRW5jb2RlZCA9IHRoaXMuX2VuY29kZUtleUNvZGVDb21ibyhrZXlDb2RlQ29tYm8pO1xuXHRcdGNvbnN0IHNjYW5Db2RlQ29tYm9zRW5jb2RlZCA9IHRoaXMuX2tleUNvZGVUb1NjYW5Db2RlW2tleUNvZGVDb21ib0VuY29kZWRdO1xuXHRcdGlmICghc2NhbkNvZGVDb21ib3NFbmNvZGVkIHx8IHNjYW5Db2RlQ29tYm9zRW5jb2RlZC5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQ6IFNjYW5Db2RlQ29tYm9bXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBzY2FuQ29kZUNvbWJvc0VuY29kZWQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHNjYW5Db2RlQ29tYm9FbmNvZGVkID0gc2NhbkNvZGVDb21ib3NFbmNvZGVkW2ldO1xuXG5cdFx0XHRjb25zdCBjdHJsS2V5ID0gKHNjYW5Db2RlQ29tYm9FbmNvZGVkICYgMGIwMDEpID8gdHJ1ZSA6IGZhbHNlO1xuXHRcdFx0Y29uc3Qgc2hpZnRLZXkgPSAoc2NhbkNvZGVDb21ib0VuY29kZWQgJiAwYjAxMCkgPyB0cnVlIDogZmFsc2U7XG5cdFx0XHRjb25zdCBhbHRLZXkgPSAoc2NhbkNvZGVDb21ib0VuY29kZWQgJiAwYjEwMCkgPyB0cnVlIDogZmFsc2U7XG5cdFx0XHRjb25zdCBzY2FuQ29kZTogU2NhbkNvZGUgPSAoc2NhbkNvZGVDb21ib0VuY29kZWQgPj4+IDMpO1xuXG5cdFx0XHRyZXN1bHRbaV0gPSBuZXcgU2NhbkNvZGVDb21ibyhjdHJsS2V5LCBzaGlmdEtleSwgYWx0S2V5LCBzY2FuQ29kZSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgbG9va3VwU2NhbkNvZGVDb21ibyhzY2FuQ29kZUNvbWJvOiBTY2FuQ29kZUNvbWJvKTogS2V5Q29kZUNvbWJvW10ge1xuXHRcdGNvbnN0IHNjYW5Db2RlQ29tYm9FbmNvZGVkID0gdGhpcy5fZW5jb2RlU2NhbkNvZGVDb21ibyhzY2FuQ29kZUNvbWJvKTtcblx0XHRjb25zdCBrZXlDb2RlQ29tYm9zRW5jb2RlZCA9IHRoaXMuX3NjYW5Db2RlVG9LZXlDb2RlW3NjYW5Db2RlQ29tYm9FbmNvZGVkXTtcblx0XHRpZiAoIWtleUNvZGVDb21ib3NFbmNvZGVkIHx8IGtleUNvZGVDb21ib3NFbmNvZGVkLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdDogS2V5Q29kZUNvbWJvW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0ga2V5Q29kZUNvbWJvc0VuY29kZWQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGtleUNvZGVDb21ib0VuY29kZWQgPSBrZXlDb2RlQ29tYm9zRW5jb2RlZFtpXTtcblxuXHRcdFx0Y29uc3QgY3RybEtleSA9IChrZXlDb2RlQ29tYm9FbmNvZGVkICYgMGIwMDEpID8gdHJ1ZSA6IGZhbHNlO1xuXHRcdFx0Y29uc3Qgc2hpZnRLZXkgPSAoa2V5Q29kZUNvbWJvRW5jb2RlZCAmIDBiMDEwKSA/IHRydWUgOiBmYWxzZTtcblx0XHRcdGNvbnN0IGFsdEtleSA9IChrZXlDb2RlQ29tYm9FbmNvZGVkICYgMGIxMDApID8gdHJ1ZSA6IGZhbHNlO1xuXHRcdFx0Y29uc3Qga2V5Q29kZTogS2V5Q29kZSA9IChrZXlDb2RlQ29tYm9FbmNvZGVkID4+PiAzKTtcblxuXHRcdFx0cmVzdWx0W2ldID0gbmV3IEtleUNvZGVDb21ibyhjdHJsS2V5LCBzaGlmdEtleSwgYWx0S2V5LCBrZXlDb2RlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBndWVzc1N0YWJsZUtleUNvZGUoc2NhbkNvZGU6IFNjYW5Db2RlKTogS2V5Q29kZSB7XG5cdFx0aWYgKHNjYW5Db2RlID49IFNjYW5Db2RlLkRpZ2l0MSAmJiBzY2FuQ29kZSA8PSBTY2FuQ29kZS5EaWdpdDApIHtcblx0XHRcdC8vIGRpZ2l0cyBhcmUgb2tcblx0XHRcdHN3aXRjaCAoc2NhbkNvZGUpIHtcblx0XHRcdFx0Y2FzZSBTY2FuQ29kZS5EaWdpdDE6IHJldHVybiBLZXlDb2RlLkRpZ2l0MTtcblx0XHRcdFx0Y2FzZSBTY2FuQ29kZS5EaWdpdDI6IHJldHVybiBLZXlDb2RlLkRpZ2l0Mjtcblx0XHRcdFx0Y2FzZSBTY2FuQ29kZS5EaWdpdDM6IHJldHVybiBLZXlDb2RlLkRpZ2l0Mztcblx0XHRcdFx0Y2FzZSBTY2FuQ29kZS5EaWdpdDQ6IHJldHVybiBLZXlDb2RlLkRpZ2l0NDtcblx0XHRcdFx0Y2FzZSBTY2FuQ29kZS5EaWdpdDU6IHJldHVybiBLZXlDb2RlLkRpZ2l0NTtcblx0XHRcdFx0Y2FzZSBTY2FuQ29kZS5EaWdpdDY6IHJldHVybiBLZXlDb2RlLkRpZ2l0Njtcblx0XHRcdFx0Y2FzZSBTY2FuQ29kZS5EaWdpdDc6IHJldHVybiBLZXlDb2RlLkRpZ2l0Nztcblx0XHRcdFx0Y2FzZSBTY2FuQ29kZS5EaWdpdDg6IHJldHVybiBLZXlDb2RlLkRpZ2l0ODtcblx0XHRcdFx0Y2FzZSBTY2FuQ29kZS5EaWdpdDk6IHJldHVybiBLZXlDb2RlLkRpZ2l0OTtcblx0XHRcdFx0Y2FzZSBTY2FuQ29kZS5EaWdpdDA6IHJldHVybiBLZXlDb2RlLkRpZ2l0MDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBMb29rdXAgdGhlIHNjYW5Db2RlIHdpdGggYW5kIHdpdGhvdXQgc2hpZnQgYW5kIHNlZSBpZiB0aGUga2V5Q29kZSBpcyBzdGFibGVcblx0XHRjb25zdCBrZXlDb2RlQ29tYm9zMSA9IHRoaXMubG9va3VwU2NhbkNvZGVDb21ibyhuZXcgU2NhbkNvZGVDb21ibyhmYWxzZSwgZmFsc2UsIGZhbHNlLCBzY2FuQ29kZSkpO1xuXHRcdGNvbnN0IGtleUNvZGVDb21ib3MyID0gdGhpcy5sb29rdXBTY2FuQ29kZUNvbWJvKG5ldyBTY2FuQ29kZUNvbWJvKGZhbHNlLCB0cnVlLCBmYWxzZSwgc2NhbkNvZGUpKTtcblx0XHRpZiAoa2V5Q29kZUNvbWJvczEubGVuZ3RoID09PSAxICYmIGtleUNvZGVDb21ib3MyLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0Y29uc3Qgc2hpZnRLZXkxID0ga2V5Q29kZUNvbWJvczFbMF0uc2hpZnRLZXk7XG5cdFx0XHRjb25zdCBrZXlDb2RlMSA9IGtleUNvZGVDb21ib3MxWzBdLmtleUNvZGU7XG5cdFx0XHRjb25zdCBzaGlmdEtleTIgPSBrZXlDb2RlQ29tYm9zMlswXS5zaGlmdEtleTtcblx0XHRcdGNvbnN0IGtleUNvZGUyID0ga2V5Q29kZUNvbWJvczJbMF0ua2V5Q29kZTtcblx0XHRcdGlmIChrZXlDb2RlMSA9PT0ga2V5Q29kZTIgJiYgc2hpZnRLZXkxICE9PSBzaGlmdEtleTIpIHtcblx0XHRcdFx0Ly8gVGhpcyBsb29rcyBsaWtlIGEgc3RhYmxlIG1hcHBpbmdcblx0XHRcdFx0cmV0dXJuIGtleUNvZGUxO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBLZXlDb2RlLkRlcGVuZHNPbktiTGF5b3V0O1xuXHR9XG5cblx0cHJpdmF0ZSBfZW5jb2RlU2NhbkNvZGVDb21ibyhzY2FuQ29kZUNvbWJvOiBTY2FuQ29kZUNvbWJvKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fZW5jb2RlKHNjYW5Db2RlQ29tYm8uY3RybEtleSwgc2NhbkNvZGVDb21iby5zaGlmdEtleSwgc2NhbkNvZGVDb21iby5hbHRLZXksIHNjYW5Db2RlQ29tYm8uc2NhbkNvZGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZW5jb2RlS2V5Q29kZUNvbWJvKGtleUNvZGVDb21ibzogS2V5Q29kZUNvbWJvKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fZW5jb2RlKGtleUNvZGVDb21iby5jdHJsS2V5LCBrZXlDb2RlQ29tYm8uc2hpZnRLZXksIGtleUNvZGVDb21iby5hbHRLZXksIGtleUNvZGVDb21iby5rZXlDb2RlKTtcblx0fVxuXG5cdHByaXZhdGUgX2VuY29kZShjdHJsS2V5OiBib29sZWFuLCBzaGlmdEtleTogYm9vbGVhbiwgYWx0S2V5OiBib29sZWFuLCBwcmluY2lwYWw6IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIChcblx0XHRcdCgoY3RybEtleSA/IDEgOiAwKSA8PCAwKVxuXHRcdFx0fCAoKHNoaWZ0S2V5ID8gMSA6IDApIDw8IDEpXG5cdFx0XHR8ICgoYWx0S2V5ID8gMSA6IDApIDw8IDIpXG5cdFx0XHR8IHByaW5jaXBhbCA8PCAzXG5cdFx0KSA+Pj4gMDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTWFjTGludXhLZXlib2FyZE1hcHBlciBpbXBsZW1lbnRzIElLZXlib2FyZE1hcHBlciB7XG5cblx0LyoqXG5cdCAqIHVzZWQgb25seSBmb3IgZGVidWcgcHVycG9zZXMuXG5cdCAqL1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jb2RlSW5mbzogSU1hY0xpbnV4S2V5TWFwcGluZ1tdO1xuXHQvKipcblx0ICogTWFwcyBTY2FuQ29kZSBjb21ib3MgPC0+IEtleUNvZGUgY29tYm9zLlxuXHQgKi9cblx0cHJpdmF0ZSByZWFkb25seSBfc2NhbkNvZGVLZXlDb2RlTWFwcGVyOiBTY2FuQ29kZUtleUNvZGVNYXBwZXI7XG5cdC8qKlxuXHQgKiBVSSBsYWJlbCBmb3IgYSBTY2FuQ29kZS5cblx0ICovXG5cdHByaXZhdGUgcmVhZG9ubHkgX3NjYW5Db2RlVG9MYWJlbDogQXJyYXk8c3RyaW5nIHwgbnVsbD4gPSBbXTtcblx0LyoqXG5cdCAqIERpc3BhdGNoaW5nIHN0cmluZyBmb3IgYSBTY2FuQ29kZS5cblx0ICovXG5cdHByaXZhdGUgcmVhZG9ubHkgX3NjYW5Db2RlVG9EaXNwYXRjaDogQXJyYXk8c3RyaW5nIHwgbnVsbD4gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9pc1VTU3RhbmRhcmQ6IGJvb2xlYW4sXG5cdFx0cmF3TWFwcGluZ3M6IElNYWNMaW51eEtleWJvYXJkTWFwcGluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tYXBBbHRHclRvQ3RybEFsdDogYm9vbGVhbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9PUzogT3BlcmF0aW5nU3lzdGVtLFxuXHQpIHtcblx0XHR0aGlzLl9jb2RlSW5mbyA9IFtdO1xuXHRcdHRoaXMuX3NjYW5Db2RlS2V5Q29kZU1hcHBlciA9IG5ldyBTY2FuQ29kZUtleUNvZGVNYXBwZXIoKTtcblx0XHR0aGlzLl9zY2FuQ29kZVRvTGFiZWwgPSBbXTtcblx0XHR0aGlzLl9zY2FuQ29kZVRvRGlzcGF0Y2ggPSBbXTtcblxuXHRcdGNvbnN0IF9yZWdpc3RlcklmVW5rbm93biA9IChcblx0XHRcdGh3Q3RybEtleTogMCB8IDEsIGh3U2hpZnRLZXk6IDAgfCAxLCBod0FsdEtleTogMCB8IDEsIHNjYW5Db2RlOiBTY2FuQ29kZSxcblx0XHRcdGtiQ3RybEtleTogMCB8IDEsIGtiU2hpZnRLZXk6IDAgfCAxLCBrYkFsdEtleTogMCB8IDEsIGtleUNvZGU6IEtleUNvZGUsXG5cdFx0KTogdm9pZCA9PiB7XG5cdFx0XHR0aGlzLl9zY2FuQ29kZUtleUNvZGVNYXBwZXIucmVnaXN0ZXJJZlVua25vd24oXG5cdFx0XHRcdG5ldyBTY2FuQ29kZUNvbWJvKGh3Q3RybEtleSA/IHRydWUgOiBmYWxzZSwgaHdTaGlmdEtleSA/IHRydWUgOiBmYWxzZSwgaHdBbHRLZXkgPyB0cnVlIDogZmFsc2UsIHNjYW5Db2RlKSxcblx0XHRcdFx0bmV3IEtleUNvZGVDb21ibyhrYkN0cmxLZXkgPyB0cnVlIDogZmFsc2UsIGtiU2hpZnRLZXkgPyB0cnVlIDogZmFsc2UsIGtiQWx0S2V5ID8gdHJ1ZSA6IGZhbHNlLCBrZXlDb2RlKVxuXHRcdFx0KTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgX3JlZ2lzdGVyQWxsQ29tYm9zID0gKF9jdHJsS2V5OiAwIHwgMSwgX3NoaWZ0S2V5OiAwIHwgMSwgX2FsdEtleTogMCB8IDEsIHNjYW5Db2RlOiBTY2FuQ29kZSwga2V5Q29kZTogS2V5Q29kZSk6IHZvaWQgPT4ge1xuXHRcdFx0Zm9yIChsZXQgY3RybEtleSA9IF9jdHJsS2V5OyBjdHJsS2V5IDw9IDE7IGN0cmxLZXkrKykge1xuXHRcdFx0XHRmb3IgKGxldCBzaGlmdEtleSA9IF9zaGlmdEtleTsgc2hpZnRLZXkgPD0gMTsgc2hpZnRLZXkrKykge1xuXHRcdFx0XHRcdGZvciAobGV0IGFsdEtleSA9IF9hbHRLZXk7IGFsdEtleSA8PSAxOyBhbHRLZXkrKykge1xuXHRcdFx0XHRcdFx0X3JlZ2lzdGVySWZVbmtub3duKFxuXHRcdFx0XHRcdFx0XHRjdHJsS2V5LCBzaGlmdEtleSwgYWx0S2V5LCBzY2FuQ29kZSxcblx0XHRcdFx0XHRcdFx0Y3RybEtleSwgc2hpZnRLZXksIGFsdEtleSwga2V5Q29kZVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gSW5pdGlhbGl6ZSBgX3NjYW5Db2RlVG9MYWJlbGBcblx0XHRmb3IgKGxldCBzY2FuQ29kZSA9IFNjYW5Db2RlLk5vbmU7IHNjYW5Db2RlIDwgU2NhbkNvZGUuTUFYX1ZBTFVFOyBzY2FuQ29kZSsrKSB7XG5cdFx0XHR0aGlzLl9zY2FuQ29kZVRvTGFiZWxbc2NhbkNvZGVdID0gbnVsbDtcblx0XHR9XG5cblx0XHQvLyBJbml0aWFsaXplIGBfc2NhbkNvZGVUb0Rpc3BhdGNoYFxuXHRcdGZvciAobGV0IHNjYW5Db2RlID0gU2NhbkNvZGUuTm9uZTsgc2NhbkNvZGUgPCBTY2FuQ29kZS5NQVhfVkFMVUU7IHNjYW5Db2RlKyspIHtcblx0XHRcdHRoaXMuX3NjYW5Db2RlVG9EaXNwYXRjaFtzY2FuQ29kZV0gPSBudWxsO1xuXHRcdH1cblxuXHRcdC8vIEhhbmRsZSBpbW11dGFibGUgbWFwcGluZ3Ncblx0XHRmb3IgKGxldCBzY2FuQ29kZSA9IFNjYW5Db2RlLk5vbmU7IHNjYW5Db2RlIDwgU2NhbkNvZGUuTUFYX1ZBTFVFOyBzY2FuQ29kZSsrKSB7XG5cdFx0XHRjb25zdCBrZXlDb2RlID0gSU1NVVRBQkxFX0NPREVfVE9fS0VZX0NPREVbc2NhbkNvZGVdO1xuXHRcdFx0aWYgKGtleUNvZGUgIT09IEtleUNvZGUuRGVwZW5kc09uS2JMYXlvdXQpIHtcblx0XHRcdFx0X3JlZ2lzdGVyQWxsQ29tYm9zKDAsIDAsIDAsIHNjYW5Db2RlLCBrZXlDb2RlKTtcblx0XHRcdFx0dGhpcy5fc2NhbkNvZGVUb0xhYmVsW3NjYW5Db2RlXSA9IEtleUNvZGVVdGlscy50b1N0cmluZyhrZXlDb2RlKTtcblxuXHRcdFx0XHRpZiAoa2V5Q29kZSA9PT0gS2V5Q29kZS5Vbmtub3duIHx8IGtleUNvZGUgPT09IEtleUNvZGUuQ3RybCB8fCBrZXlDb2RlID09PSBLZXlDb2RlLk1ldGEgfHwga2V5Q29kZSA9PT0gS2V5Q29kZS5BbHQgfHwga2V5Q29kZSA9PT0gS2V5Q29kZS5TaGlmdCkge1xuXHRcdFx0XHRcdHRoaXMuX3NjYW5Db2RlVG9EaXNwYXRjaFtzY2FuQ29kZV0gPSBudWxsOyAvLyBjYW5ub3QgZGlzcGF0Y2ggb24gdGhpcyBTY2FuQ29kZVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuX3NjYW5Db2RlVG9EaXNwYXRjaFtzY2FuQ29kZV0gPSBgWyR7U2NhbkNvZGVVdGlscy50b1N0cmluZyhzY2FuQ29kZSl9XWA7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBUcnkgdG8gaWRlbnRpZnkga2V5Ym9hcmQgbGF5b3V0cyB3aGVyZSBjaGFyYWN0ZXJzIEEtWiBhcmUgbWlzc2luZ1xuXHRcdC8vIGFuZCBmb3JjaWJseSBtYXAgdGhlbSB0byB0aGVpciBjb3JyZXNwb25kaW5nIHNjYW4gY29kZXMgaWYgdGhhdCBpcyB0aGUgY2FzZVxuXHRcdGNvbnN0IG1pc3NpbmdMYXRpbkxldHRlcnNPdmVycmlkZTogeyBbc2NhbkNvZGU6IHN0cmluZ106IElNYWNMaW51eEtleU1hcHBpbmcgfSA9IHt9O1xuXG5cdFx0e1xuXHRcdFx0Y29uc3QgcHJvZHVjZXNMYXRpbkxldHRlcjogYm9vbGVhbltdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IHN0clNjYW5Db2RlIGluIHJhd01hcHBpbmdzKSB7XG5cdFx0XHRcdGlmIChyYXdNYXBwaW5ncy5oYXNPd25Qcm9wZXJ0eShzdHJTY2FuQ29kZSkpIHtcblx0XHRcdFx0XHRjb25zdCBzY2FuQ29kZSA9IFNjYW5Db2RlVXRpbHMudG9FbnVtKHN0clNjYW5Db2RlKTtcblx0XHRcdFx0XHRpZiAoc2NhbkNvZGUgPT09IFNjYW5Db2RlLk5vbmUpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoSU1NVVRBQkxFX0NPREVfVE9fS0VZX0NPREVbc2NhbkNvZGVdICE9PSBLZXlDb2RlLkRlcGVuZHNPbktiTGF5b3V0KSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCByYXdNYXBwaW5nID0gcmF3TWFwcGluZ3Nbc3RyU2NhbkNvZGVdO1xuXHRcdFx0XHRcdGNvbnN0IHZhbHVlID0gTWFjTGludXhLZXlib2FyZE1hcHBlci5nZXRDaGFyQ29kZShyYXdNYXBwaW5nLnZhbHVlKTtcblxuXHRcdFx0XHRcdGlmICh2YWx1ZSA+PSBDaGFyQ29kZS5hICYmIHZhbHVlIDw9IENoYXJDb2RlLnopIHtcblx0XHRcdFx0XHRcdGNvbnN0IHVwcGVyQ2FzZVZhbHVlID0gQ2hhckNvZGUuQSArICh2YWx1ZSAtIENoYXJDb2RlLmEpO1xuXHRcdFx0XHRcdFx0cHJvZHVjZXNMYXRpbkxldHRlclt1cHBlckNhc2VWYWx1ZV0gPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcgPSAoY2hhckNvZGU6IENoYXJDb2RlLCBzY2FuQ29kZTogU2NhbkNvZGUsIHZhbHVlOiBzdHJpbmcsIHdpdGhTaGlmdDogc3RyaW5nKTogdm9pZCA9PiB7XG5cdFx0XHRcdGlmICghcHJvZHVjZXNMYXRpbkxldHRlcltjaGFyQ29kZV0pIHtcblx0XHRcdFx0XHRtaXNzaW5nTGF0aW5MZXR0ZXJzT3ZlcnJpZGVbU2NhbkNvZGVVdGlscy50b1N0cmluZyhzY2FuQ29kZSldID0ge1xuXHRcdFx0XHRcdFx0dmFsdWU6IHZhbHVlLFxuXHRcdFx0XHRcdFx0d2l0aFNoaWZ0OiB3aXRoU2hpZnQsXG5cdFx0XHRcdFx0XHR3aXRoQWx0R3I6ICcnLFxuXHRcdFx0XHRcdFx0d2l0aFNoaWZ0QWx0R3I6ICcnXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0Ly8gRW5zdXJlIGxldHRlcnMgYXJlIG1hcHBlZFxuXHRcdFx0X3JlZ2lzdGVyTGV0dGVySWZNaXNzaW5nKENoYXJDb2RlLkEsIFNjYW5Db2RlLktleUEsICdhJywgJ0EnKTtcblx0XHRcdF9yZWdpc3RlckxldHRlcklmTWlzc2luZyhDaGFyQ29kZS5CLCBTY2FuQ29kZS5LZXlCLCAnYicsICdCJyk7XG5cdFx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuQywgU2NhbkNvZGUuS2V5QywgJ2MnLCAnQycpO1xuXHRcdFx0X3JlZ2lzdGVyTGV0dGVySWZNaXNzaW5nKENoYXJDb2RlLkQsIFNjYW5Db2RlLktleUQsICdkJywgJ0QnKTtcblx0XHRcdF9yZWdpc3RlckxldHRlcklmTWlzc2luZyhDaGFyQ29kZS5FLCBTY2FuQ29kZS5LZXlFLCAnZScsICdFJyk7XG5cdFx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuRiwgU2NhbkNvZGUuS2V5RiwgJ2YnLCAnRicpO1xuXHRcdFx0X3JlZ2lzdGVyTGV0dGVySWZNaXNzaW5nKENoYXJDb2RlLkcsIFNjYW5Db2RlLktleUcsICdnJywgJ0cnKTtcblx0XHRcdF9yZWdpc3RlckxldHRlcklmTWlzc2luZyhDaGFyQ29kZS5ILCBTY2FuQ29kZS5LZXlILCAnaCcsICdIJyk7XG5cdFx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuSSwgU2NhbkNvZGUuS2V5SSwgJ2knLCAnSScpO1xuXHRcdFx0X3JlZ2lzdGVyTGV0dGVySWZNaXNzaW5nKENoYXJDb2RlLkosIFNjYW5Db2RlLktleUosICdqJywgJ0onKTtcblx0XHRcdF9yZWdpc3RlckxldHRlcklmTWlzc2luZyhDaGFyQ29kZS5LLCBTY2FuQ29kZS5LZXlLLCAnaycsICdLJyk7XG5cdFx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuTCwgU2NhbkNvZGUuS2V5TCwgJ2wnLCAnTCcpO1xuXHRcdFx0X3JlZ2lzdGVyTGV0dGVySWZNaXNzaW5nKENoYXJDb2RlLk0sIFNjYW5Db2RlLktleU0sICdtJywgJ00nKTtcblx0XHRcdF9yZWdpc3RlckxldHRlcklmTWlzc2luZyhDaGFyQ29kZS5OLCBTY2FuQ29kZS5LZXlOLCAnbicsICdOJyk7XG5cdFx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuTywgU2NhbkNvZGUuS2V5TywgJ28nLCAnTycpO1xuXHRcdFx0X3JlZ2lzdGVyTGV0dGVySWZNaXNzaW5nKENoYXJDb2RlLlAsIFNjYW5Db2RlLktleVAsICdwJywgJ1AnKTtcblx0XHRcdF9yZWdpc3RlckxldHRlcklmTWlzc2luZyhDaGFyQ29kZS5RLCBTY2FuQ29kZS5LZXlRLCAncScsICdRJyk7XG5cdFx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuUiwgU2NhbkNvZGUuS2V5UiwgJ3InLCAnUicpO1xuXHRcdFx0X3JlZ2lzdGVyTGV0dGVySWZNaXNzaW5nKENoYXJDb2RlLlMsIFNjYW5Db2RlLktleVMsICdzJywgJ1MnKTtcblx0XHRcdF9yZWdpc3RlckxldHRlcklmTWlzc2luZyhDaGFyQ29kZS5ULCBTY2FuQ29kZS5LZXlULCAndCcsICdUJyk7XG5cdFx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuVSwgU2NhbkNvZGUuS2V5VSwgJ3UnLCAnVScpO1xuXHRcdFx0X3JlZ2lzdGVyTGV0dGVySWZNaXNzaW5nKENoYXJDb2RlLlYsIFNjYW5Db2RlLktleVYsICd2JywgJ1YnKTtcblx0XHRcdF9yZWdpc3RlckxldHRlcklmTWlzc2luZyhDaGFyQ29kZS5XLCBTY2FuQ29kZS5LZXlXLCAndycsICdXJyk7XG5cdFx0XHRfcmVnaXN0ZXJMZXR0ZXJJZk1pc3NpbmcoQ2hhckNvZGUuWCwgU2NhbkNvZGUuS2V5WCwgJ3gnLCAnWCcpO1xuXHRcdFx0X3JlZ2lzdGVyTGV0dGVySWZNaXNzaW5nKENoYXJDb2RlLlksIFNjYW5Db2RlLktleVksICd5JywgJ1knKTtcblx0XHRcdF9yZWdpc3RlckxldHRlcklmTWlzc2luZyhDaGFyQ29kZS5aLCBTY2FuQ29kZS5LZXlaLCAneicsICdaJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWFwcGluZ3M6IElTY2FuQ29kZU1hcHBpbmdbXSA9IFtdO1xuXHRcdGxldCBtYXBwaW5nc0xlbiA9IDA7XG5cdFx0Zm9yIChjb25zdCBzdHJTY2FuQ29kZSBpbiByYXdNYXBwaW5ncykge1xuXHRcdFx0aWYgKHJhd01hcHBpbmdzLmhhc093blByb3BlcnR5KHN0clNjYW5Db2RlKSkge1xuXHRcdFx0XHRjb25zdCBzY2FuQ29kZSA9IFNjYW5Db2RlVXRpbHMudG9FbnVtKHN0clNjYW5Db2RlKTtcblx0XHRcdFx0aWYgKHNjYW5Db2RlID09PSBTY2FuQ29kZS5Ob25lKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKElNTVVUQUJMRV9DT0RFX1RPX0tFWV9DT0RFW3NjYW5Db2RlXSAhPT0gS2V5Q29kZS5EZXBlbmRzT25LYkxheW91dCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5fY29kZUluZm9bc2NhbkNvZGVdID0gcmF3TWFwcGluZ3Nbc3RyU2NhbkNvZGVdO1xuXG5cdFx0XHRcdGNvbnN0IHJhd01hcHBpbmcgPSBtaXNzaW5nTGF0aW5MZXR0ZXJzT3ZlcnJpZGVbc3RyU2NhbkNvZGVdIHx8IHJhd01hcHBpbmdzW3N0clNjYW5Db2RlXTtcblx0XHRcdFx0Y29uc3QgdmFsdWUgPSBNYWNMaW51eEtleWJvYXJkTWFwcGVyLmdldENoYXJDb2RlKHJhd01hcHBpbmcudmFsdWUpO1xuXHRcdFx0XHRjb25zdCB3aXRoU2hpZnQgPSBNYWNMaW51eEtleWJvYXJkTWFwcGVyLmdldENoYXJDb2RlKHJhd01hcHBpbmcud2l0aFNoaWZ0KTtcblx0XHRcdFx0Y29uc3Qgd2l0aEFsdEdyID0gTWFjTGludXhLZXlib2FyZE1hcHBlci5nZXRDaGFyQ29kZShyYXdNYXBwaW5nLndpdGhBbHRHcik7XG5cdFx0XHRcdGNvbnN0IHdpdGhTaGlmdEFsdEdyID0gTWFjTGludXhLZXlib2FyZE1hcHBlci5nZXRDaGFyQ29kZShyYXdNYXBwaW5nLndpdGhTaGlmdEFsdEdyKTtcblxuXHRcdFx0XHRjb25zdCBtYXBwaW5nOiBJU2NhbkNvZGVNYXBwaW5nID0ge1xuXHRcdFx0XHRcdHNjYW5Db2RlOiBzY2FuQ29kZSxcblx0XHRcdFx0XHR2YWx1ZTogdmFsdWUsXG5cdFx0XHRcdFx0d2l0aFNoaWZ0OiB3aXRoU2hpZnQsXG5cdFx0XHRcdFx0d2l0aEFsdEdyOiB3aXRoQWx0R3IsXG5cdFx0XHRcdFx0d2l0aFNoaWZ0QWx0R3I6IHdpdGhTaGlmdEFsdEdyLFxuXHRcdFx0XHR9O1xuXHRcdFx0XHRtYXBwaW5nc1ttYXBwaW5nc0xlbisrXSA9IG1hcHBpbmc7XG5cblx0XHRcdFx0dGhpcy5fc2NhbkNvZGVUb0Rpc3BhdGNoW3NjYW5Db2RlXSA9IGBbJHtTY2FuQ29kZVV0aWxzLnRvU3RyaW5nKHNjYW5Db2RlKX1dYDtcblxuXHRcdFx0XHRpZiAodmFsdWUgPj0gQ2hhckNvZGUuYSAmJiB2YWx1ZSA8PSBDaGFyQ29kZS56KSB7XG5cdFx0XHRcdFx0Y29uc3QgdXBwZXJDYXNlVmFsdWUgPSBDaGFyQ29kZS5BICsgKHZhbHVlIC0gQ2hhckNvZGUuYSk7XG5cdFx0XHRcdFx0dGhpcy5fc2NhbkNvZGVUb0xhYmVsW3NjYW5Db2RlXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUodXBwZXJDYXNlVmFsdWUpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHZhbHVlID49IENoYXJDb2RlLkEgJiYgdmFsdWUgPD0gQ2hhckNvZGUuWikge1xuXHRcdFx0XHRcdHRoaXMuX3NjYW5Db2RlVG9MYWJlbFtzY2FuQ29kZV0gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHZhbHVlKTtcblx0XHRcdFx0fSBlbHNlIGlmICh2YWx1ZSkge1xuXHRcdFx0XHRcdHRoaXMuX3NjYW5Db2RlVG9MYWJlbFtzY2FuQ29kZV0gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHZhbHVlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLl9zY2FuQ29kZVRvTGFiZWxbc2NhbkNvZGVdID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEhhbmRsZSBhbGwgYHdpdGhTaGlmdEFsdEdyYCBlbnRyaWVzXG5cdFx0Zm9yIChsZXQgaSA9IG1hcHBpbmdzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRjb25zdCBtYXBwaW5nID0gbWFwcGluZ3NbaV07XG5cdFx0XHRjb25zdCBzY2FuQ29kZSA9IG1hcHBpbmcuc2NhbkNvZGU7XG5cdFx0XHRjb25zdCB3aXRoU2hpZnRBbHRHciA9IG1hcHBpbmcud2l0aFNoaWZ0QWx0R3I7XG5cdFx0XHRpZiAod2l0aFNoaWZ0QWx0R3IgPT09IG1hcHBpbmcud2l0aEFsdEdyIHx8IHdpdGhTaGlmdEFsdEdyID09PSBtYXBwaW5nLndpdGhTaGlmdCB8fCB3aXRoU2hpZnRBbHRHciA9PT0gbWFwcGluZy52YWx1ZSkge1xuXHRcdFx0XHQvLyBoYW5kbGVkIGJlbG93XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3Qga2IgPSBNYWNMaW51eEtleWJvYXJkTWFwcGVyLl9jaGFyQ29kZVRvS2Iod2l0aFNoaWZ0QWx0R3IpO1xuXHRcdFx0aWYgKCFrYikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGtiU2hpZnRLZXkgPSBrYi5zaGlmdEtleTtcblx0XHRcdGNvbnN0IGtleUNvZGUgPSBrYi5rZXlDb2RlO1xuXG5cdFx0XHRpZiAoa2JTaGlmdEtleSkge1xuXHRcdFx0XHQvLyBDdHJsK1NoaWZ0K0FsdCtTY2FuQ29kZSA9PiBTaGlmdCtLZXlDb2RlXG5cdFx0XHRcdF9yZWdpc3RlcklmVW5rbm93bigxLCAxLCAxLCBzY2FuQ29kZSwgMCwgMSwgMCwga2V5Q29kZSk7IC8vICAgICAgIEN0cmwrQWx0K1NjYW5Db2RlID0+ICAgICAgICAgIFNoaWZ0K0tleUNvZGVcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIEN0cmwrU2hpZnQrQWx0K1NjYW5Db2RlID0+IEtleUNvZGVcblx0XHRcdFx0X3JlZ2lzdGVySWZVbmtub3duKDEsIDEsIDEsIHNjYW5Db2RlLCAwLCAwLCAwLCBrZXlDb2RlKTsgLy8gICAgICAgQ3RybCtBbHQrU2NhbkNvZGUgPT4gICAgICAgICAgICAgICAgS2V5Q29kZVxuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBIYW5kbGUgYWxsIGB3aXRoQWx0R3JgIGVudHJpZXNcblx0XHRmb3IgKGxldCBpID0gbWFwcGluZ3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdGNvbnN0IG1hcHBpbmcgPSBtYXBwaW5nc1tpXTtcblx0XHRcdGNvbnN0IHNjYW5Db2RlID0gbWFwcGluZy5zY2FuQ29kZTtcblx0XHRcdGNvbnN0IHdpdGhBbHRHciA9IG1hcHBpbmcud2l0aEFsdEdyO1xuXHRcdFx0aWYgKHdpdGhBbHRHciA9PT0gbWFwcGluZy53aXRoU2hpZnQgfHwgd2l0aEFsdEdyID09PSBtYXBwaW5nLnZhbHVlKSB7XG5cdFx0XHRcdC8vIGhhbmRsZWQgYmVsb3dcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBrYiA9IE1hY0xpbnV4S2V5Ym9hcmRNYXBwZXIuX2NoYXJDb2RlVG9LYih3aXRoQWx0R3IpO1xuXHRcdFx0aWYgKCFrYikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGtiU2hpZnRLZXkgPSBrYi5zaGlmdEtleTtcblx0XHRcdGNvbnN0IGtleUNvZGUgPSBrYi5rZXlDb2RlO1xuXG5cdFx0XHRpZiAoa2JTaGlmdEtleSkge1xuXHRcdFx0XHQvLyBDdHJsK0FsdCtTY2FuQ29kZSA9PiBTaGlmdCtLZXlDb2RlXG5cdFx0XHRcdF9yZWdpc3RlcklmVW5rbm93bigxLCAwLCAxLCBzY2FuQ29kZSwgMCwgMSwgMCwga2V5Q29kZSk7IC8vICAgICAgIEN0cmwrQWx0K1NjYW5Db2RlID0+ICAgICAgICAgIFNoaWZ0K0tleUNvZGVcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIEN0cmwrQWx0K1NjYW5Db2RlID0+IEtleUNvZGVcblx0XHRcdFx0X3JlZ2lzdGVySWZVbmtub3duKDEsIDAsIDEsIHNjYW5Db2RlLCAwLCAwLCAwLCBrZXlDb2RlKTsgLy8gICAgICAgQ3RybCtBbHQrU2NhbkNvZGUgPT4gICAgICAgICAgICAgICAgS2V5Q29kZVxuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBIYW5kbGUgYWxsIGB3aXRoU2hpZnRgIGVudHJpZXNcblx0XHRmb3IgKGxldCBpID0gbWFwcGluZ3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdGNvbnN0IG1hcHBpbmcgPSBtYXBwaW5nc1tpXTtcblx0XHRcdGNvbnN0IHNjYW5Db2RlID0gbWFwcGluZy5zY2FuQ29kZTtcblx0XHRcdGNvbnN0IHdpdGhTaGlmdCA9IG1hcHBpbmcud2l0aFNoaWZ0O1xuXHRcdFx0aWYgKHdpdGhTaGlmdCA9PT0gbWFwcGluZy52YWx1ZSkge1xuXHRcdFx0XHQvLyBoYW5kbGVkIGJlbG93XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3Qga2IgPSBNYWNMaW51eEtleWJvYXJkTWFwcGVyLl9jaGFyQ29kZVRvS2Iod2l0aFNoaWZ0KTtcblx0XHRcdGlmICgha2IpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBrYlNoaWZ0S2V5ID0ga2Iuc2hpZnRLZXk7XG5cdFx0XHRjb25zdCBrZXlDb2RlID0ga2Iua2V5Q29kZTtcblxuXHRcdFx0aWYgKGtiU2hpZnRLZXkpIHtcblx0XHRcdFx0Ly8gU2hpZnQrU2NhbkNvZGUgPT4gU2hpZnQrS2V5Q29kZVxuXHRcdFx0XHRfcmVnaXN0ZXJJZlVua25vd24oMCwgMSwgMCwgc2NhbkNvZGUsIDAsIDEsIDAsIGtleUNvZGUpOyAvLyAgICAgICAgICBTaGlmdCtTY2FuQ29kZSA9PiAgICAgICAgICBTaGlmdCtLZXlDb2RlXG5cdFx0XHRcdF9yZWdpc3RlcklmVW5rbm93bigwLCAxLCAxLCBzY2FuQ29kZSwgMCwgMSwgMSwga2V5Q29kZSk7IC8vICAgICAgU2hpZnQrQWx0K1NjYW5Db2RlID0+ICAgICAgU2hpZnQrQWx0K0tleUNvZGVcblx0XHRcdFx0X3JlZ2lzdGVySWZVbmtub3duKDEsIDEsIDAsIHNjYW5Db2RlLCAxLCAxLCAwLCBrZXlDb2RlKTsgLy8gICAgIEN0cmwrU2hpZnQrU2NhbkNvZGUgPT4gICAgIEN0cmwrU2hpZnQrS2V5Q29kZVxuXHRcdFx0XHRfcmVnaXN0ZXJJZlVua25vd24oMSwgMSwgMSwgc2NhbkNvZGUsIDEsIDEsIDEsIGtleUNvZGUpOyAvLyBDdHJsK1NoaWZ0K0FsdCtTY2FuQ29kZSA9PiBDdHJsK1NoaWZ0K0FsdCtLZXlDb2RlXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBTaGlmdCtTY2FuQ29kZSA9PiBLZXlDb2RlXG5cdFx0XHRcdF9yZWdpc3RlcklmVW5rbm93bigwLCAxLCAwLCBzY2FuQ29kZSwgMCwgMCwgMCwga2V5Q29kZSk7IC8vICAgICAgICAgIFNoaWZ0K1NjYW5Db2RlID0+ICAgICAgICAgICAgICAgIEtleUNvZGVcblx0XHRcdFx0X3JlZ2lzdGVySWZVbmtub3duKDAsIDEsIDAsIHNjYW5Db2RlLCAwLCAxLCAwLCBrZXlDb2RlKTsgLy8gICAgICAgICAgU2hpZnQrU2NhbkNvZGUgPT4gICAgICAgICAgU2hpZnQrS2V5Q29kZVxuXHRcdFx0XHRfcmVnaXN0ZXJJZlVua25vd24oMCwgMSwgMSwgc2NhbkNvZGUsIDAsIDAsIDEsIGtleUNvZGUpOyAvLyAgICAgIFNoaWZ0K0FsdCtTY2FuQ29kZSA9PiAgICAgICAgICAgIEFsdCtLZXlDb2RlXG5cdFx0XHRcdF9yZWdpc3RlcklmVW5rbm93bigwLCAxLCAxLCBzY2FuQ29kZSwgMCwgMSwgMSwga2V5Q29kZSk7IC8vICAgICAgU2hpZnQrQWx0K1NjYW5Db2RlID0+ICAgICAgU2hpZnQrQWx0K0tleUNvZGVcblx0XHRcdFx0X3JlZ2lzdGVySWZVbmtub3duKDEsIDEsIDAsIHNjYW5Db2RlLCAxLCAwLCAwLCBrZXlDb2RlKTsgLy8gICAgIEN0cmwrU2hpZnQrU2NhbkNvZGUgPT4gICAgICAgICAgIEN0cmwrS2V5Q29kZVxuXHRcdFx0XHRfcmVnaXN0ZXJJZlVua25vd24oMSwgMSwgMCwgc2NhbkNvZGUsIDEsIDEsIDAsIGtleUNvZGUpOyAvLyAgICAgQ3RybCtTaGlmdCtTY2FuQ29kZSA9PiAgICAgQ3RybCtTaGlmdCtLZXlDb2RlXG5cdFx0XHRcdF9yZWdpc3RlcklmVW5rbm93bigxLCAxLCAxLCBzY2FuQ29kZSwgMSwgMCwgMSwga2V5Q29kZSk7IC8vIEN0cmwrU2hpZnQrQWx0K1NjYW5Db2RlID0+ICAgICAgIEN0cmwrQWx0K0tleUNvZGVcblx0XHRcdFx0X3JlZ2lzdGVySWZVbmtub3duKDEsIDEsIDEsIHNjYW5Db2RlLCAxLCAxLCAxLCBrZXlDb2RlKTsgLy8gQ3RybCtTaGlmdCtBbHQrU2NhbkNvZGUgPT4gQ3RybCtTaGlmdCtBbHQrS2V5Q29kZVxuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBIYW5kbGUgYWxsIGB2YWx1ZWAgZW50cmllc1xuXHRcdGZvciAobGV0IGkgPSBtYXBwaW5ncy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0Y29uc3QgbWFwcGluZyA9IG1hcHBpbmdzW2ldO1xuXHRcdFx0Y29uc3Qgc2NhbkNvZGUgPSBtYXBwaW5nLnNjYW5Db2RlO1xuXHRcdFx0Y29uc3Qga2IgPSBNYWNMaW51eEtleWJvYXJkTWFwcGVyLl9jaGFyQ29kZVRvS2IobWFwcGluZy52YWx1ZSk7XG5cdFx0XHRpZiAoIWtiKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3Qga2JTaGlmdEtleSA9IGtiLnNoaWZ0S2V5O1xuXHRcdFx0Y29uc3Qga2V5Q29kZSA9IGtiLmtleUNvZGU7XG5cblx0XHRcdGlmIChrYlNoaWZ0S2V5KSB7XG5cdFx0XHRcdC8vIFNjYW5Db2RlID0+IFNoaWZ0K0tleUNvZGVcblx0XHRcdFx0X3JlZ2lzdGVySWZVbmtub3duKDAsIDAsIDAsIHNjYW5Db2RlLCAwLCAxLCAwLCBrZXlDb2RlKTsgLy8gICAgICAgICAgICAgICAgU2NhbkNvZGUgPT4gICAgICAgICAgU2hpZnQrS2V5Q29kZVxuXHRcdFx0XHRfcmVnaXN0ZXJJZlVua25vd24oMCwgMCwgMSwgc2NhbkNvZGUsIDAsIDEsIDEsIGtleUNvZGUpOyAvLyAgICAgICAgICAgIEFsdCtTY2FuQ29kZSA9PiAgICAgIFNoaWZ0K0FsdCtLZXlDb2RlXG5cdFx0XHRcdF9yZWdpc3RlcklmVW5rbm93bigxLCAwLCAwLCBzY2FuQ29kZSwgMSwgMSwgMCwga2V5Q29kZSk7IC8vICAgICAgICAgICBDdHJsK1NjYW5Db2RlID0+ICAgICBDdHJsK1NoaWZ0K0tleUNvZGVcblx0XHRcdFx0X3JlZ2lzdGVySWZVbmtub3duKDEsIDAsIDEsIHNjYW5Db2RlLCAxLCAxLCAxLCBrZXlDb2RlKTsgLy8gICAgICAgQ3RybCtBbHQrU2NhbkNvZGUgPT4gQ3RybCtTaGlmdCtBbHQrS2V5Q29kZVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gU2NhbkNvZGUgPT4gS2V5Q29kZVxuXHRcdFx0XHRfcmVnaXN0ZXJJZlVua25vd24oMCwgMCwgMCwgc2NhbkNvZGUsIDAsIDAsIDAsIGtleUNvZGUpOyAvLyAgICAgICAgICAgICAgICBTY2FuQ29kZSA9PiAgICAgICAgICAgICAgICBLZXlDb2RlXG5cdFx0XHRcdF9yZWdpc3RlcklmVW5rbm93bigwLCAwLCAxLCBzY2FuQ29kZSwgMCwgMCwgMSwga2V5Q29kZSk7IC8vICAgICAgICAgICAgQWx0K1NjYW5Db2RlID0+ICAgICAgICAgICAgQWx0K0tleUNvZGVcblx0XHRcdFx0X3JlZ2lzdGVySWZVbmtub3duKDAsIDEsIDAsIHNjYW5Db2RlLCAwLCAxLCAwLCBrZXlDb2RlKTsgLy8gICAgICAgICAgU2hpZnQrU2NhbkNvZGUgPT4gICAgICAgICAgU2hpZnQrS2V5Q29kZVxuXHRcdFx0XHRfcmVnaXN0ZXJJZlVua25vd24oMCwgMSwgMSwgc2NhbkNvZGUsIDAsIDEsIDEsIGtleUNvZGUpOyAvLyAgICAgIFNoaWZ0K0FsdCtTY2FuQ29kZSA9PiAgICAgIFNoaWZ0K0FsdCtLZXlDb2RlXG5cdFx0XHRcdF9yZWdpc3RlcklmVW5rbm93bigxLCAwLCAwLCBzY2FuQ29kZSwgMSwgMCwgMCwga2V5Q29kZSk7IC8vICAgICAgICAgICBDdHJsK1NjYW5Db2RlID0+ICAgICAgICAgICBDdHJsK0tleUNvZGVcblx0XHRcdFx0X3JlZ2lzdGVySWZVbmtub3duKDEsIDAsIDEsIHNjYW5Db2RlLCAxLCAwLCAxLCBrZXlDb2RlKTsgLy8gICAgICAgQ3RybCtBbHQrU2NhbkNvZGUgPT4gICAgICAgQ3RybCtBbHQrS2V5Q29kZVxuXHRcdFx0XHRfcmVnaXN0ZXJJZlVua25vd24oMSwgMSwgMCwgc2NhbkNvZGUsIDEsIDEsIDAsIGtleUNvZGUpOyAvLyAgICAgQ3RybCtTaGlmdCtTY2FuQ29kZSA9PiAgICAgQ3RybCtTaGlmdCtLZXlDb2RlXG5cdFx0XHRcdF9yZWdpc3RlcklmVW5rbm93bigxLCAxLCAxLCBzY2FuQ29kZSwgMSwgMSwgMSwga2V5Q29kZSk7IC8vIEN0cmwrU2hpZnQrQWx0K1NjYW5Db2RlID0+IEN0cmwrU2hpZnQrQWx0K0tleUNvZGVcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gSGFuZGxlIGFsbCBsZWZ0LW92ZXIgYXZhaWxhYmxlIGRpZ2l0c1xuXHRcdF9yZWdpc3RlckFsbENvbWJvcygwLCAwLCAwLCBTY2FuQ29kZS5EaWdpdDEsIEtleUNvZGUuRGlnaXQxKTtcblx0XHRfcmVnaXN0ZXJBbGxDb21ib3MoMCwgMCwgMCwgU2NhbkNvZGUuRGlnaXQyLCBLZXlDb2RlLkRpZ2l0Mik7XG5cdFx0X3JlZ2lzdGVyQWxsQ29tYm9zKDAsIDAsIDAsIFNjYW5Db2RlLkRpZ2l0MywgS2V5Q29kZS5EaWdpdDMpO1xuXHRcdF9yZWdpc3RlckFsbENvbWJvcygwLCAwLCAwLCBTY2FuQ29kZS5EaWdpdDQsIEtleUNvZGUuRGlnaXQ0KTtcblx0XHRfcmVnaXN0ZXJBbGxDb21ib3MoMCwgMCwgMCwgU2NhbkNvZGUuRGlnaXQ1LCBLZXlDb2RlLkRpZ2l0NSk7XG5cdFx0X3JlZ2lzdGVyQWxsQ29tYm9zKDAsIDAsIDAsIFNjYW5Db2RlLkRpZ2l0NiwgS2V5Q29kZS5EaWdpdDYpO1xuXHRcdF9yZWdpc3RlckFsbENvbWJvcygwLCAwLCAwLCBTY2FuQ29kZS5EaWdpdDcsIEtleUNvZGUuRGlnaXQ3KTtcblx0XHRfcmVnaXN0ZXJBbGxDb21ib3MoMCwgMCwgMCwgU2NhbkNvZGUuRGlnaXQ4LCBLZXlDb2RlLkRpZ2l0OCk7XG5cdFx0X3JlZ2lzdGVyQWxsQ29tYm9zKDAsIDAsIDAsIFNjYW5Db2RlLkRpZ2l0OSwgS2V5Q29kZS5EaWdpdDkpO1xuXHRcdF9yZWdpc3RlckFsbENvbWJvcygwLCAwLCAwLCBTY2FuQ29kZS5EaWdpdDAsIEtleUNvZGUuRGlnaXQwKTtcblxuXHRcdHRoaXMuX3NjYW5Db2RlS2V5Q29kZU1hcHBlci5yZWdpc3RyYXRpb25Db21wbGV0ZSgpO1xuXHR9XG5cblx0cHVibGljIGR1bXBEZWJ1Z0luZm8oKTogc3RyaW5nIHtcblx0XHRjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG5cblx0XHRjb25zdCBpbW11dGFibGVTYW1wbGVzID0gW1xuXHRcdFx0U2NhbkNvZGUuQXJyb3dVcCxcblx0XHRcdFNjYW5Db2RlLk51bXBhZDBcblx0XHRdO1xuXG5cdFx0bGV0IGNudCA9IDA7XG5cdFx0cmVzdWx0LnB1c2goYGlzVVNTdGFuZGFyZDogJHt0aGlzLl9pc1VTU3RhbmRhcmR9YCk7XG5cdFx0cmVzdWx0LnB1c2goYC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1gKTtcblx0XHRmb3IgKGxldCBzY2FuQ29kZSA9IFNjYW5Db2RlLk5vbmU7IHNjYW5Db2RlIDwgU2NhbkNvZGUuTUFYX1ZBTFVFOyBzY2FuQ29kZSsrKSB7XG5cdFx0XHRpZiAoSU1NVVRBQkxFX0NPREVfVE9fS0VZX0NPREVbc2NhbkNvZGVdICE9PSBLZXlDb2RlLkRlcGVuZHNPbktiTGF5b3V0KSB7XG5cdFx0XHRcdGlmIChpbW11dGFibGVTYW1wbGVzLmluZGV4T2Yoc2NhbkNvZGUpID09PSAtMSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjbnQgJSA0ID09PSAwKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGB8ICAgICAgIEhXIENvZGUgY29tYmluYXRpb24gICAgICB8ICBLZXkgIHwgICAgS2V5Q29kZSBjb21iaW5hdGlvbiAgICB8IFByaSB8ICAgICAgICAgIFVJIGxhYmVsICAgICAgICAgfCAgICAgICAgIFVzZXIgc2V0dGluZ3MgICAgICAgICAgfCAgICBFbGVjdHJvbiBhY2NlbGVyYXRvciAgIHwgICAgICAgRGlzcGF0Y2hpbmcgc3RyaW5nICAgICAgIHwgV1lTSVdZRyB8YCk7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tYCk7XG5cdFx0XHR9XG5cdFx0XHRjbnQrKztcblxuXHRcdFx0Y29uc3QgbWFwcGluZyA9IHRoaXMuX2NvZGVJbmZvW3NjYW5Db2RlXTtcblxuXHRcdFx0Zm9yIChsZXQgbW9kID0gMDsgbW9kIDwgODsgbW9kKyspIHtcblx0XHRcdFx0Y29uc3QgaHdDdHJsS2V5ID0gKG1vZCAmIDBiMDAxKSA/IHRydWUgOiBmYWxzZTtcblx0XHRcdFx0Y29uc3QgaHdTaGlmdEtleSA9IChtb2QgJiAwYjAxMCkgPyB0cnVlIDogZmFsc2U7XG5cdFx0XHRcdGNvbnN0IGh3QWx0S2V5ID0gKG1vZCAmIDBiMTAwKSA/IHRydWUgOiBmYWxzZTtcblx0XHRcdFx0Y29uc3Qgc2NhbkNvZGVDb21ibyA9IG5ldyBTY2FuQ29kZUNvbWJvKGh3Q3RybEtleSwgaHdTaGlmdEtleSwgaHdBbHRLZXksIHNjYW5Db2RlKTtcblx0XHRcdFx0Y29uc3QgcmVzb2x2ZWRLYiA9IHRoaXMucmVzb2x2ZUtleWJvYXJkRXZlbnQoe1xuXHRcdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0XHRjdHJsS2V5OiBzY2FuQ29kZUNvbWJvLmN0cmxLZXksXG5cdFx0XHRcdFx0c2hpZnRLZXk6IHNjYW5Db2RlQ29tYm8uc2hpZnRLZXksXG5cdFx0XHRcdFx0YWx0S2V5OiBzY2FuQ29kZUNvbWJvLmFsdEtleSxcblx0XHRcdFx0XHRtZXRhS2V5OiBmYWxzZSxcblx0XHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdFx0a2V5Q29kZTogS2V5Q29kZS5EZXBlbmRzT25LYkxheW91dCxcblx0XHRcdFx0XHRjb2RlOiBTY2FuQ29kZVV0aWxzLnRvU3RyaW5nKHNjYW5Db2RlKVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb25zdCBvdXRTY2FuQ29kZUNvbWJvID0gc2NhbkNvZGVDb21iby50b1N0cmluZygpO1xuXHRcdFx0XHRjb25zdCBvdXRLZXkgPSBzY2FuQ29kZUNvbWJvLmdldFByb2R1Y2VkQ2hhcihtYXBwaW5nKTtcblx0XHRcdFx0Y29uc3QgYXJpYUxhYmVsID0gcmVzb2x2ZWRLYi5nZXRBcmlhTGFiZWwoKTtcblx0XHRcdFx0Y29uc3Qgb3V0VUlMYWJlbCA9IChhcmlhTGFiZWwgPyBhcmlhTGFiZWwucmVwbGFjZSgvQ29udHJvbFxcKy8sICdDdHJsKycpIDogbnVsbCk7XG5cdFx0XHRcdGNvbnN0IG91dFVzZXJTZXR0aW5ncyA9IHJlc29sdmVkS2IuZ2V0VXNlclNldHRpbmdzTGFiZWwoKTtcblx0XHRcdFx0Y29uc3Qgb3V0RWxlY3Ryb25BY2NlbGVyYXRvciA9IHJlc29sdmVkS2IuZ2V0RWxlY3Ryb25BY2NlbGVyYXRvcigpO1xuXHRcdFx0XHRjb25zdCBvdXREaXNwYXRjaFN0ciA9IHJlc29sdmVkS2IuZ2V0RGlzcGF0Y2hDaG9yZHMoKVswXTtcblxuXHRcdFx0XHRjb25zdCBpc1dZU0lXWUcgPSAocmVzb2x2ZWRLYiA/IHJlc29sdmVkS2IuaXNXWVNJV1lHKCkgOiBmYWxzZSk7XG5cdFx0XHRcdGNvbnN0IG91dFdZU0lXWUcgPSAoaXNXWVNJV1lHID8gJyAgICAgICAnIDogJyAgIE5PICAnKTtcblxuXHRcdFx0XHRjb25zdCBrYkNvbWJvcyA9IHRoaXMuX3NjYW5Db2RlS2V5Q29kZU1hcHBlci5sb29rdXBTY2FuQ29kZUNvbWJvKHNjYW5Db2RlQ29tYm8pO1xuXHRcdFx0XHRpZiAoa2JDb21ib3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2goYHwgJHt0aGlzLl9sZWZ0UGFkKG91dFNjYW5Db2RlQ29tYm8sIDMwKX0gfCAke291dEtleX0gfCAke3RoaXMuX2xlZnRQYWQoJycsIDI1KX0gfCAke3RoaXMuX2xlZnRQYWQoJycsIDMpfSB8ICR7dGhpcy5fbGVmdFBhZChvdXRVSUxhYmVsLCAyNSl9IHwgJHt0aGlzLl9sZWZ0UGFkKG91dFVzZXJTZXR0aW5ncywgMzApfSB8ICR7dGhpcy5fbGVmdFBhZChvdXRFbGVjdHJvbkFjY2VsZXJhdG9yLCAyNSl9IHwgJHt0aGlzLl9sZWZ0UGFkKG91dERpc3BhdGNoU3RyLCAzMCl9IHwgJHtvdXRXWVNJV1lHfSB8YCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGtiQ29tYm9zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBrYkNvbWJvID0ga2JDb21ib3NbaV07XG5cdFx0XHRcdFx0XHQvLyBmaW5kIG91dCB0aGUgcHJpb3JpdHkgb2YgdGhpcyBzY2FuIGNvZGUgZm9yIHRoaXMga2V5IGNvZGVcblx0XHRcdFx0XHRcdGxldCBjb2xQcmlvcml0eTogc3RyaW5nO1xuXG5cdFx0XHRcdFx0XHRjb25zdCBzY2FuQ29kZUNvbWJvcyA9IHRoaXMuX3NjYW5Db2RlS2V5Q29kZU1hcHBlci5sb29rdXBLZXlDb2RlQ29tYm8oa2JDb21ibyk7XG5cdFx0XHRcdFx0XHRpZiAoc2NhbkNvZGVDb21ib3MubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdFx0XHRcdC8vIG5vIG5lZWQgZm9yIHByaW9yaXR5LCB0aGlzIGtleSBjb2RlIGNvbWJvIG1hcHMgdG8gcHJlY2lzZWx5IHRoaXMgc2NhbiBjb2RlIGNvbWJvXG5cdFx0XHRcdFx0XHRcdGNvbFByaW9yaXR5ID0gJyc7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRsZXQgcHJpb3JpdHkgPSAtMTtcblx0XHRcdFx0XHRcdFx0Zm9yIChsZXQgaiA9IDA7IGogPCBzY2FuQ29kZUNvbWJvcy5sZW5ndGg7IGorKykge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChzY2FuQ29kZUNvbWJvc1tqXS5lcXVhbHMoc2NhbkNvZGVDb21ibykpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHByaW9yaXR5ID0gaiArIDE7XG5cdFx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0Y29sUHJpb3JpdHkgPSBTdHJpbmcocHJpb3JpdHkpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRjb25zdCBvdXRLZXliaW5kaW5nID0ga2JDb21iby50b1N0cmluZygpO1xuXHRcdFx0XHRcdFx0aWYgKGkgPT09IDApIHtcblx0XHRcdFx0XHRcdFx0cmVzdWx0LnB1c2goYHwgJHt0aGlzLl9sZWZ0UGFkKG91dFNjYW5Db2RlQ29tYm8sIDMwKX0gfCAke291dEtleX0gfCAke3RoaXMuX2xlZnRQYWQob3V0S2V5YmluZGluZywgMjUpfSB8ICR7dGhpcy5fbGVmdFBhZChjb2xQcmlvcml0eSwgMyl9IHwgJHt0aGlzLl9sZWZ0UGFkKG91dFVJTGFiZWwsIDI1KX0gfCAke3RoaXMuX2xlZnRQYWQob3V0VXNlclNldHRpbmdzLCAzMCl9IHwgJHt0aGlzLl9sZWZ0UGFkKG91dEVsZWN0cm9uQWNjZWxlcmF0b3IsIDI1KX0gfCAke3RoaXMuX2xlZnRQYWQob3V0RGlzcGF0Y2hTdHIsIDMwKX0gfCAke291dFdZU0lXWUd9IHxgKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdC8vIHNlY29uZGFyeSBrZXliaW5kaW5nc1xuXHRcdFx0XHRcdFx0XHRyZXN1bHQucHVzaChgfCAke3RoaXMuX2xlZnRQYWQoJycsIDMwKX0gfCAgICAgICB8ICR7dGhpcy5fbGVmdFBhZChvdXRLZXliaW5kaW5nLCAyNSl9IHwgJHt0aGlzLl9sZWZ0UGFkKGNvbFByaW9yaXR5LCAzKX0gfCAke3RoaXMuX2xlZnRQYWQoJycsIDI1KX0gfCAke3RoaXMuX2xlZnRQYWQoJycsIDMwKX0gfCAke3RoaXMuX2xlZnRQYWQoJycsIDI1KX0gfCAke3RoaXMuX2xlZnRQYWQoJycsIDMwKX0gfCAgICAgICAgIHxgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0fVxuXHRcdFx0cmVzdWx0LnB1c2goYC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1gKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0LmpvaW4oJ1xcbicpO1xuXHR9XG5cblx0cHJpdmF0ZSBfbGVmdFBhZChzdHI6IHN0cmluZyB8IG51bGwsIGNudDogbnVtYmVyKTogc3RyaW5nIHtcblx0XHRpZiAoc3RyID09PSBudWxsKSB7XG5cdFx0XHRzdHIgPSAnbnVsbCc7XG5cdFx0fVxuXHRcdHdoaWxlIChzdHIubGVuZ3RoIDwgY250KSB7XG5cdFx0XHRzdHIgPSAnICcgKyBzdHI7XG5cdFx0fVxuXHRcdHJldHVybiBzdHI7XG5cdH1cblxuXHRwdWJsaWMga2V5Q29kZUNob3JkVG9TY2FuQ29kZUNob3JkKGNob3JkOiBLZXlDb2RlQ2hvcmQpOiBTY2FuQ29kZUNob3JkW10ge1xuXHRcdC8vIEF2b2lkIGRvdWJsZSBFbnRlciBiaW5kaW5ncyAoYm90aCBTY2FuQ29kZS5OdW1wYWRFbnRlciBhbmQgU2NhbkNvZGUuRW50ZXIgcG9pbnQgdG8gS2V5Q29kZS5FbnRlcilcblx0XHRpZiAoY2hvcmQua2V5Q29kZSA9PT0gS2V5Q29kZS5FbnRlcikge1xuXHRcdFx0cmV0dXJuIFtuZXcgU2NhbkNvZGVDaG9yZChjaG9yZC5jdHJsS2V5LCBjaG9yZC5zaGlmdEtleSwgY2hvcmQuYWx0S2V5LCBjaG9yZC5tZXRhS2V5LCBTY2FuQ29kZS5FbnRlcildO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNjYW5Db2RlQ29tYm9zID0gdGhpcy5fc2NhbkNvZGVLZXlDb2RlTWFwcGVyLmxvb2t1cEtleUNvZGVDb21ibyhcblx0XHRcdG5ldyBLZXlDb2RlQ29tYm8oY2hvcmQuY3RybEtleSwgY2hvcmQuc2hpZnRLZXksIGNob3JkLmFsdEtleSwgY2hvcmQua2V5Q29kZSlcblx0XHQpO1xuXG5cdFx0Y29uc3QgcmVzdWx0OiBTY2FuQ29kZUNob3JkW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gc2NhbkNvZGVDb21ib3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHNjYW5Db2RlQ29tYm8gPSBzY2FuQ29kZUNvbWJvc1tpXTtcblx0XHRcdHJlc3VsdFtpXSA9IG5ldyBTY2FuQ29kZUNob3JkKHNjYW5Db2RlQ29tYm8uY3RybEtleSwgc2NhbkNvZGVDb21iby5zaGlmdEtleSwgc2NhbkNvZGVDb21iby5hbHRLZXksIGNob3JkLm1ldGFLZXksIHNjYW5Db2RlQ29tYm8uc2NhbkNvZGUpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGdldFVJTGFiZWxGb3JTY2FuQ29kZUNob3JkKGNob3JkOiBTY2FuQ29kZUNob3JkIHwgbnVsbCk6IHN0cmluZyB8IG51bGwge1xuXHRcdGlmICghY2hvcmQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRpZiAoY2hvcmQuaXNEdXBsaWNhdGVNb2RpZmllckNhc2UoKSkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fT1MgPT09IE9wZXJhdGluZ1N5c3RlbS5NYWNpbnRvc2gpIHtcblx0XHRcdHN3aXRjaCAoY2hvcmQuc2NhbkNvZGUpIHtcblx0XHRcdFx0Y2FzZSBTY2FuQ29kZS5BcnJvd0xlZnQ6XG5cdFx0XHRcdFx0cmV0dXJuICdcdTIxOTAnO1xuXHRcdFx0XHRjYXNlIFNjYW5Db2RlLkFycm93VXA6XG5cdFx0XHRcdFx0cmV0dXJuICdcdTIxOTEnO1xuXHRcdFx0XHRjYXNlIFNjYW5Db2RlLkFycm93UmlnaHQ6XG5cdFx0XHRcdFx0cmV0dXJuICdcdTIxOTInO1xuXHRcdFx0XHRjYXNlIFNjYW5Db2RlLkFycm93RG93bjpcblx0XHRcdFx0XHRyZXR1cm4gJ1x1MjE5Myc7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9zY2FuQ29kZVRvTGFiZWxbY2hvcmQuc2NhbkNvZGVdO1xuXHR9XG5cblx0cHVibGljIGdldEFyaWFMYWJlbEZvclNjYW5Db2RlQ2hvcmQoY2hvcmQ6IFNjYW5Db2RlQ2hvcmQgfCBudWxsKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0aWYgKCFjaG9yZCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGlmIChjaG9yZC5pc0R1cGxpY2F0ZU1vZGlmaWVyQ2FzZSgpKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9zY2FuQ29kZVRvTGFiZWxbY2hvcmQuc2NhbkNvZGVdO1xuXHR9XG5cblx0cHVibGljIGdldERpc3BhdGNoU3RyRm9yU2NhbkNvZGVDaG9yZChjaG9yZDogU2NhbkNvZGVDaG9yZCk6IHN0cmluZyB8IG51bGwge1xuXHRcdGNvbnN0IGNvZGVEaXNwYXRjaCA9IHRoaXMuX3NjYW5Db2RlVG9EaXNwYXRjaFtjaG9yZC5zY2FuQ29kZV07XG5cdFx0aWYgKCFjb2RlRGlzcGF0Y2gpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRsZXQgcmVzdWx0ID0gJyc7XG5cblx0XHRpZiAoY2hvcmQuY3RybEtleSkge1xuXHRcdFx0cmVzdWx0ICs9ICdjdHJsKyc7XG5cdFx0fVxuXHRcdGlmIChjaG9yZC5zaGlmdEtleSkge1xuXHRcdFx0cmVzdWx0ICs9ICdzaGlmdCsnO1xuXHRcdH1cblx0XHRpZiAoY2hvcmQuYWx0S2V5KSB7XG5cdFx0XHRyZXN1bHQgKz0gJ2FsdCsnO1xuXHRcdH1cblx0XHRpZiAoY2hvcmQubWV0YUtleSkge1xuXHRcdFx0cmVzdWx0ICs9ICdtZXRhKyc7XG5cdFx0fVxuXHRcdHJlc3VsdCArPSBjb2RlRGlzcGF0Y2g7XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGdldFVzZXJTZXR0aW5nc0xhYmVsRm9yU2NhbkNvZGVDaG9yZChjaG9yZDogU2NhbkNvZGVDaG9yZCB8IG51bGwpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRpZiAoIWNob3JkKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0aWYgKGNob3JkLmlzRHVwbGljYXRlTW9kaWZpZXJDYXNlKCkpIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cblx0XHRjb25zdCBpbW11dGFibGVLZXlDb2RlID0gSU1NVVRBQkxFX0NPREVfVE9fS0VZX0NPREVbY2hvcmQuc2NhbkNvZGVdO1xuXHRcdGlmIChpbW11dGFibGVLZXlDb2RlICE9PSBLZXlDb2RlLkRlcGVuZHNPbktiTGF5b3V0KSB7XG5cdFx0XHRyZXR1cm4gS2V5Q29kZVV0aWxzLnRvVXNlclNldHRpbmdzVVMoaW1tdXRhYmxlS2V5Q29kZSkudG9Mb3dlckNhc2UoKTtcblx0XHR9XG5cblx0XHQvLyBDaGVjayBpZiB0aGlzIHNjYW5Db2RlIGFsd2F5cyBtYXBzIHRvIHRoZSBzYW1lIGtleUNvZGUgYW5kIGJhY2tcblx0XHRjb25zdCBjb25zdGFudEtleUNvZGU6IEtleUNvZGUgPSB0aGlzLl9zY2FuQ29kZUtleUNvZGVNYXBwZXIuZ3Vlc3NTdGFibGVLZXlDb2RlKGNob3JkLnNjYW5Db2RlKTtcblx0XHRpZiAoY29uc3RhbnRLZXlDb2RlICE9PSBLZXlDb2RlLkRlcGVuZHNPbktiTGF5b3V0KSB7XG5cdFx0XHQvLyBWZXJpZnkgdGhhdCB0aGlzIGlzIGEgZ29vZCBrZXkgY29kZSB0aGF0IGNhbiBiZSBtYXBwZWQgYmFjayB0byB0aGUgc2FtZSBzY2FuIGNvZGVcblx0XHRcdGNvbnN0IHJldmVyc2VDaG9yZHMgPSB0aGlzLmtleUNvZGVDaG9yZFRvU2NhbkNvZGVDaG9yZChuZXcgS2V5Q29kZUNob3JkKGNob3JkLmN0cmxLZXksIGNob3JkLnNoaWZ0S2V5LCBjaG9yZC5hbHRLZXksIGNob3JkLm1ldGFLZXksIGNvbnN0YW50S2V5Q29kZSkpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHJldmVyc2VDaG9yZHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgcmV2ZXJzZUNob3JkID0gcmV2ZXJzZUNob3Jkc1tpXTtcblx0XHRcdFx0aWYgKHJldmVyc2VDaG9yZC5zY2FuQ29kZSA9PT0gY2hvcmQuc2NhbkNvZGUpIHtcblx0XHRcdFx0XHRyZXR1cm4gS2V5Q29kZVV0aWxzLnRvVXNlclNldHRpbmdzVVMoY29uc3RhbnRLZXlDb2RlKS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3NjYW5Db2RlVG9EaXNwYXRjaFtjaG9yZC5zY2FuQ29kZV07XG5cdH1cblxuXHRwdWJsaWMgZ2V0RWxlY3Ryb25BY2NlbGVyYXRvckxhYmVsRm9yU2NhbkNvZGVDaG9yZChjaG9yZDogU2NhbkNvZGVDaG9yZCB8IG51bGwpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRpZiAoIWNob3JkKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBpbW11dGFibGVLZXlDb2RlID0gSU1NVVRBQkxFX0NPREVfVE9fS0VZX0NPREVbY2hvcmQuc2NhbkNvZGVdO1xuXHRcdGlmIChpbW11dGFibGVLZXlDb2RlICE9PSBLZXlDb2RlLkRlcGVuZHNPbktiTGF5b3V0KSB7XG5cdFx0XHRyZXR1cm4gS2V5Q29kZVV0aWxzLnRvRWxlY3Ryb25BY2NlbGVyYXRvcihpbW11dGFibGVLZXlDb2RlKTtcblx0XHR9XG5cblx0XHQvLyBDaGVjayBpZiB0aGlzIHNjYW5Db2RlIGFsd2F5cyBtYXBzIHRvIHRoZSBzYW1lIGtleUNvZGUgYW5kIGJhY2tcblx0XHRjb25zdCBjb25zdGFudEtleUNvZGU6IEtleUNvZGUgPSB0aGlzLl9zY2FuQ29kZUtleUNvZGVNYXBwZXIuZ3Vlc3NTdGFibGVLZXlDb2RlKGNob3JkLnNjYW5Db2RlKTtcblxuXHRcdGlmICh0aGlzLl9PUyA9PT0gT3BlcmF0aW5nU3lzdGVtLkxpbnV4ICYmICF0aGlzLl9pc1VTU3RhbmRhcmQpIHtcblx0XHRcdC8vIFtFbGVjdHJvbiBBY2NlbGVyYXRvcnNdIE9uIExpbnV4LCBFbGVjdHJvbiBkb2VzIG5vdCBoYW5kbGUgY29ycmVjdGx5IE9FTSBrZXlzLlxuXHRcdFx0Ly8gd2hlbiB1c2luZyBhIGRpZmZlcmVudCBrZXlib2FyZCBsYXlvdXQgdGhhbiBVUyBTdGFuZGFyZC5cblx0XHRcdC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjM3MDZcblx0XHRcdC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9wdWxsLzEzNDg5MCNpc3N1ZWNvbW1lbnQtOTQxNjcxNzkxXG5cdFx0XHRjb25zdCBpc09FTUtleSA9IChcblx0XHRcdFx0Y29uc3RhbnRLZXlDb2RlID09PSBLZXlDb2RlLlNlbWljb2xvblxuXHRcdFx0XHR8fCBjb25zdGFudEtleUNvZGUgPT09IEtleUNvZGUuRXF1YWxcblx0XHRcdFx0fHwgY29uc3RhbnRLZXlDb2RlID09PSBLZXlDb2RlLkNvbW1hXG5cdFx0XHRcdHx8IGNvbnN0YW50S2V5Q29kZSA9PT0gS2V5Q29kZS5NaW51c1xuXHRcdFx0XHR8fCBjb25zdGFudEtleUNvZGUgPT09IEtleUNvZGUuUGVyaW9kXG5cdFx0XHRcdHx8IGNvbnN0YW50S2V5Q29kZSA9PT0gS2V5Q29kZS5TbGFzaFxuXHRcdFx0XHR8fCBjb25zdGFudEtleUNvZGUgPT09IEtleUNvZGUuQmFja3F1b3RlXG5cdFx0XHRcdHx8IGNvbnN0YW50S2V5Q29kZSA9PT0gS2V5Q29kZS5CcmFja2V0TGVmdFxuXHRcdFx0XHR8fCBjb25zdGFudEtleUNvZGUgPT09IEtleUNvZGUuQmFja3NsYXNoXG5cdFx0XHRcdHx8IGNvbnN0YW50S2V5Q29kZSA9PT0gS2V5Q29kZS5CcmFja2V0UmlnaHRcblx0XHRcdCk7XG5cblx0XHRcdGlmIChpc09FTUtleSkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoY29uc3RhbnRLZXlDb2RlICE9PSBLZXlDb2RlLkRlcGVuZHNPbktiTGF5b3V0KSB7XG5cdFx0XHRyZXR1cm4gS2V5Q29kZVV0aWxzLnRvRWxlY3Ryb25BY2NlbGVyYXRvcihjb25zdGFudEtleUNvZGUpO1xuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBfdG9SZXNvbHZlZEtleWJpbmRpbmcoY2hvcmRQYXJ0czogU2NhbkNvZGVDaG9yZFtdW10pOiBOYXRpdmVSZXNvbHZlZEtleWJpbmRpbmdbXSB7XG5cdFx0aWYgKGNob3JkUGFydHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHRcdGNvbnN0IHJlc3VsdDogTmF0aXZlUmVzb2x2ZWRLZXliaW5kaW5nW10gPSBbXTtcblx0XHR0aGlzLl9nZW5lcmF0ZVJlc29sdmVkS2V5YmluZGluZ3MoY2hvcmRQYXJ0cywgMCwgW10sIHJlc3VsdCk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgX2dlbmVyYXRlUmVzb2x2ZWRLZXliaW5kaW5ncyhjaG9yZFBhcnRzOiBTY2FuQ29kZUNob3JkW11bXSwgY3VycmVudEluZGV4OiBudW1iZXIsIHByZXZpb3VzUGFydHM6IFNjYW5Db2RlQ2hvcmRbXSwgcmVzdWx0OiBOYXRpdmVSZXNvbHZlZEtleWJpbmRpbmdbXSkge1xuXHRcdGNvbnN0IGNob3JkUGFydCA9IGNob3JkUGFydHNbY3VycmVudEluZGV4XTtcblx0XHRjb25zdCBpc0ZpbmFsSW5kZXggPSBjdXJyZW50SW5kZXggPT09IGNob3JkUGFydHMubGVuZ3RoIC0gMTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gY2hvcmRQYXJ0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBjaG9yZHMgPSBbLi4ucHJldmlvdXNQYXJ0cywgY2hvcmRQYXJ0W2ldXTtcblx0XHRcdGlmIChpc0ZpbmFsSW5kZXgpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2gobmV3IE5hdGl2ZVJlc29sdmVkS2V5YmluZGluZyh0aGlzLCB0aGlzLl9PUywgY2hvcmRzKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9nZW5lcmF0ZVJlc29sdmVkS2V5YmluZGluZ3MoY2hvcmRQYXJ0cywgY3VycmVudEluZGV4ICsgMSwgY2hvcmRzLCByZXN1bHQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyByZXNvbHZlS2V5Ym9hcmRFdmVudChrZXlib2FyZEV2ZW50OiBJS2V5Ym9hcmRFdmVudCk6IE5hdGl2ZVJlc29sdmVkS2V5YmluZGluZyB7XG5cdFx0bGV0IGNvZGUgPSBTY2FuQ29kZVV0aWxzLnRvRW51bShrZXlib2FyZEV2ZW50LmNvZGUpO1xuXG5cdFx0Ly8gVHJlYXQgTnVtcGFkRW50ZXIgYXMgRW50ZXJcblx0XHRpZiAoY29kZSA9PT0gU2NhbkNvZGUuTnVtcGFkRW50ZXIpIHtcblx0XHRcdGNvZGUgPSBTY2FuQ29kZS5FbnRlcjtcblx0XHR9XG5cblx0XHRjb25zdCBrZXlDb2RlID0ga2V5Ym9hcmRFdmVudC5rZXlDb2RlO1xuXG5cdFx0aWYgKFxuXHRcdFx0KGtleUNvZGUgPT09IEtleUNvZGUuTGVmdEFycm93KVxuXHRcdFx0fHwgKGtleUNvZGUgPT09IEtleUNvZGUuVXBBcnJvdylcblx0XHRcdHx8IChrZXlDb2RlID09PSBLZXlDb2RlLlJpZ2h0QXJyb3cpXG5cdFx0XHR8fCAoa2V5Q29kZSA9PT0gS2V5Q29kZS5Eb3duQXJyb3cpXG5cdFx0XHR8fCAoa2V5Q29kZSA9PT0gS2V5Q29kZS5EZWxldGUpXG5cdFx0XHR8fCAoa2V5Q29kZSA9PT0gS2V5Q29kZS5JbnNlcnQpXG5cdFx0XHR8fCAoa2V5Q29kZSA9PT0gS2V5Q29kZS5Ib21lKVxuXHRcdFx0fHwgKGtleUNvZGUgPT09IEtleUNvZGUuRW5kKVxuXHRcdFx0fHwgKGtleUNvZGUgPT09IEtleUNvZGUuUGFnZURvd24pXG5cdFx0XHR8fCAoa2V5Q29kZSA9PT0gS2V5Q29kZS5QYWdlVXApXG5cdFx0XHR8fCAoa2V5Q29kZSA9PT0gS2V5Q29kZS5CYWNrc3BhY2UpXG5cdFx0KSB7XG5cdFx0XHQvLyBcIkRpc3BhdGNoXCIgb24ga2V5Q29kZSBmb3IgdGhlc2Uga2V5IGNvZGVzIHRvIHdvcmthcm91bmQgaXNzdWVzIHdpdGggcmVtb3RlIGRlc2t0b3Bpbmcgc29mdHdhcmVcblx0XHRcdC8vIHdoZXJlIHRoZSBzY2FuIGNvZGVzIGFwcGVhciB0byBiZSBpbmNvcnJlY3QgKHNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjQxMDcpXG5cdFx0XHRjb25zdCBpbW11dGFibGVTY2FuQ29kZSA9IElNTVVUQUJMRV9LRVlfQ09ERV9UT19DT0RFW2tleUNvZGVdO1xuXHRcdFx0aWYgKGltbXV0YWJsZVNjYW5Db2RlICE9PSBTY2FuQ29kZS5EZXBlbmRzT25LYkxheW91dCkge1xuXHRcdFx0XHRjb2RlID0gaW1tdXRhYmxlU2NhbkNvZGU7XG5cdFx0XHR9XG5cblx0XHR9IGVsc2Uge1xuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdChjb2RlID09PSBTY2FuQ29kZS5OdW1wYWQxKVxuXHRcdFx0XHR8fCAoY29kZSA9PT0gU2NhbkNvZGUuTnVtcGFkMilcblx0XHRcdFx0fHwgKGNvZGUgPT09IFNjYW5Db2RlLk51bXBhZDMpXG5cdFx0XHRcdHx8IChjb2RlID09PSBTY2FuQ29kZS5OdW1wYWQ0KVxuXHRcdFx0XHR8fCAoY29kZSA9PT0gU2NhbkNvZGUuTnVtcGFkNSlcblx0XHRcdFx0fHwgKGNvZGUgPT09IFNjYW5Db2RlLk51bXBhZDYpXG5cdFx0XHRcdHx8IChjb2RlID09PSBTY2FuQ29kZS5OdW1wYWQ3KVxuXHRcdFx0XHR8fCAoY29kZSA9PT0gU2NhbkNvZGUuTnVtcGFkOClcblx0XHRcdFx0fHwgKGNvZGUgPT09IFNjYW5Db2RlLk51bXBhZDkpXG5cdFx0XHRcdHx8IChjb2RlID09PSBTY2FuQ29kZS5OdW1wYWQwKVxuXHRcdFx0XHR8fCAoY29kZSA9PT0gU2NhbkNvZGUuTnVtcGFkRGVjaW1hbClcblx0XHRcdCkge1xuXHRcdFx0XHQvLyBcIkRpc3BhdGNoXCIgb24ga2V5Q29kZSBmb3IgYWxsIG51bXBhZCBrZXlzIGluIG9yZGVyIGZvciBOdW1Mb2NrIHRvIHdvcmsgY29ycmVjdGx5XG5cdFx0XHRcdGlmIChrZXlDb2RlID49IDApIHtcblx0XHRcdFx0XHRjb25zdCBpbW11dGFibGVTY2FuQ29kZSA9IElNTVVUQUJMRV9LRVlfQ09ERV9UT19DT0RFW2tleUNvZGVdO1xuXHRcdFx0XHRcdGlmIChpbW11dGFibGVTY2FuQ29kZSAhPT0gU2NhbkNvZGUuRGVwZW5kc09uS2JMYXlvdXQpIHtcblx0XHRcdFx0XHRcdGNvZGUgPSBpbW11dGFibGVTY2FuQ29kZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBjdHJsS2V5ID0ga2V5Ym9hcmRFdmVudC5jdHJsS2V5IHx8ICh0aGlzLl9tYXBBbHRHclRvQ3RybEFsdCAmJiBrZXlib2FyZEV2ZW50LmFsdEdyYXBoS2V5KTtcblx0XHRjb25zdCBhbHRLZXkgPSBrZXlib2FyZEV2ZW50LmFsdEtleSB8fCAodGhpcy5fbWFwQWx0R3JUb0N0cmxBbHQgJiYga2V5Ym9hcmRFdmVudC5hbHRHcmFwaEtleSk7XG5cdFx0Y29uc3QgY2hvcmQgPSBuZXcgU2NhbkNvZGVDaG9yZChjdHJsS2V5LCBrZXlib2FyZEV2ZW50LnNoaWZ0S2V5LCBhbHRLZXksIGtleWJvYXJkRXZlbnQubWV0YUtleSwgY29kZSk7XG5cdFx0cmV0dXJuIG5ldyBOYXRpdmVSZXNvbHZlZEtleWJpbmRpbmcodGhpcywgdGhpcy5fT1MsIFtjaG9yZF0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVzb2x2ZUNob3JkKGNob3JkOiBDaG9yZCB8IG51bGwpOiBTY2FuQ29kZUNob3JkW10ge1xuXHRcdGlmICghY2hvcmQpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0aWYgKGNob3JkIGluc3RhbmNlb2YgU2NhbkNvZGVDaG9yZCkge1xuXHRcdFx0cmV0dXJuIFtjaG9yZF07XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmtleUNvZGVDaG9yZFRvU2NhbkNvZGVDaG9yZChjaG9yZCk7XG5cdH1cblxuXHRwdWJsaWMgcmVzb2x2ZUtleWJpbmRpbmcoa2V5YmluZGluZzogS2V5YmluZGluZyk6IFJlc29sdmVkS2V5YmluZGluZ1tdIHtcblx0XHRjb25zdCBjaG9yZHM6IFNjYW5Db2RlQ2hvcmRbXVtdID0ga2V5YmluZGluZy5jaG9yZHMubWFwKGNob3JkID0+IHRoaXMuX3Jlc29sdmVDaG9yZChjaG9yZCkpO1xuXHRcdHJldHVybiB0aGlzLl90b1Jlc29sdmVkS2V5YmluZGluZyhjaG9yZHMpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3JlZGlyZWN0Q2hhckNvZGUoY2hhckNvZGU6IG51bWJlcik6IG51bWJlciB7XG5cdFx0c3dpdGNoIChjaGFyQ29kZSkge1xuXHRcdFx0Ly8gYWxsb3ctYW55LXVuaWNvZGUtbmV4dC1saW5lXG5cdFx0XHQvLyBDSks6IFx1MzAwMiBcdTMwMEMgXHUzMDBEIFx1MzAxMCBcdTMwMTEgXHVGRjFCIFx1RkYwQ1xuXHRcdFx0Ly8gbWFwOiAuIFsgXSBbIF0gOyAsXG5cdFx0XHRjYXNlIENoYXJDb2RlLlVfSURFT0dSQVBISUNfRlVMTF9TVE9QOiByZXR1cm4gQ2hhckNvZGUuUGVyaW9kO1xuXHRcdFx0Y2FzZSBDaGFyQ29kZS5VX0xFRlRfQ09STkVSX0JSQUNLRVQ6IHJldHVybiBDaGFyQ29kZS5PcGVuU3F1YXJlQnJhY2tldDtcblx0XHRcdGNhc2UgQ2hhckNvZGUuVV9SSUdIVF9DT1JORVJfQlJBQ0tFVDogcmV0dXJuIENoYXJDb2RlLkNsb3NlU3F1YXJlQnJhY2tldDtcblx0XHRcdGNhc2UgQ2hhckNvZGUuVV9MRUZUX0JMQUNLX0xFTlRJQ1VMQVJfQlJBQ0tFVDogcmV0dXJuIENoYXJDb2RlLk9wZW5TcXVhcmVCcmFja2V0O1xuXHRcdFx0Y2FzZSBDaGFyQ29kZS5VX1JJR0hUX0JMQUNLX0xFTlRJQ1VMQVJfQlJBQ0tFVDogcmV0dXJuIENoYXJDb2RlLkNsb3NlU3F1YXJlQnJhY2tldDtcblx0XHRcdGNhc2UgQ2hhckNvZGUuVV9GVUxMV0lEVEhfU0VNSUNPTE9OOiByZXR1cm4gQ2hhckNvZGUuU2VtaWNvbG9uO1xuXHRcdFx0Y2FzZSBDaGFyQ29kZS5VX0ZVTExXSURUSF9DT01NQTogcmV0dXJuIENoYXJDb2RlLkNvbW1hO1xuXHRcdH1cblx0XHRyZXR1cm4gY2hhckNvZGU7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfY2hhckNvZGVUb0tiKGNoYXJDb2RlOiBudW1iZXIpOiB7IGtleUNvZGU6IEtleUNvZGU7IHNoaWZ0S2V5OiBib29sZWFuIH0gfCBudWxsIHtcblx0XHRjaGFyQ29kZSA9IHRoaXMuX3JlZGlyZWN0Q2hhckNvZGUoY2hhckNvZGUpO1xuXHRcdGlmIChjaGFyQ29kZSA8IENIQVJfQ09ERV9UT19LRVlfQ09ERS5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBDSEFSX0NPREVfVE9fS0VZX0NPREVbY2hhckNvZGVdO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBBdHRlbXB0IHRvIG1hcCBhIGNvbWJpbmluZyBjaGFyYWN0ZXIgdG8gYSByZWd1bGFyIG9uZSB0aGF0IHJlbmRlcnMgdGhlIHNhbWUgd2F5LlxuXHQgKlxuXHQgKiBodHRwczovL3d3dy5jb21wYXJ0LmNvbS9lbi91bmljb2RlL2JpZGljbGFzcy9OU01cblx0ICovXG5cdHB1YmxpYyBzdGF0aWMgZ2V0Q2hhckNvZGUoY2hhcjogc3RyaW5nKTogbnVtYmVyIHtcblx0XHRpZiAoY2hhci5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblx0XHRjb25zdCBjaGFyQ29kZSA9IGNoYXIuY2hhckNvZGVBdCgwKTtcblx0XHRzd2l0Y2ggKGNoYXJDb2RlKSB7XG5cdFx0XHRjYXNlIENoYXJDb2RlLlVfQ29tYmluaW5nX0dyYXZlX0FjY2VudDogcmV0dXJuIENoYXJDb2RlLlVfR1JBVkVfQUNDRU5UO1xuXHRcdFx0Y2FzZSBDaGFyQ29kZS5VX0NvbWJpbmluZ19BY3V0ZV9BY2NlbnQ6IHJldHVybiBDaGFyQ29kZS5VX0FDVVRFX0FDQ0VOVDtcblx0XHRcdGNhc2UgQ2hhckNvZGUuVV9Db21iaW5pbmdfQ2lyY3VtZmxleF9BY2NlbnQ6IHJldHVybiBDaGFyQ29kZS5VX0NJUkNVTUZMRVg7XG5cdFx0XHRjYXNlIENoYXJDb2RlLlVfQ29tYmluaW5nX1RpbGRlOiByZXR1cm4gQ2hhckNvZGUuVV9TTUFMTF9USUxERTtcblx0XHRcdGNhc2UgQ2hhckNvZGUuVV9Db21iaW5pbmdfTWFjcm9uOiByZXR1cm4gQ2hhckNvZGUuVV9NQUNST047XG5cdFx0XHRjYXNlIENoYXJDb2RlLlVfQ29tYmluaW5nX092ZXJsaW5lOiByZXR1cm4gQ2hhckNvZGUuVV9PVkVSTElORTtcblx0XHRcdGNhc2UgQ2hhckNvZGUuVV9Db21iaW5pbmdfQnJldmU6IHJldHVybiBDaGFyQ29kZS5VX0JSRVZFO1xuXHRcdFx0Y2FzZSBDaGFyQ29kZS5VX0NvbWJpbmluZ19Eb3RfQWJvdmU6IHJldHVybiBDaGFyQ29kZS5VX0RPVF9BQk9WRTtcblx0XHRcdGNhc2UgQ2hhckNvZGUuVV9Db21iaW5pbmdfRGlhZXJlc2lzOiByZXR1cm4gQ2hhckNvZGUuVV9ESUFFUkVTSVM7XG5cdFx0XHRjYXNlIENoYXJDb2RlLlVfQ29tYmluaW5nX1JpbmdfQWJvdmU6IHJldHVybiBDaGFyQ29kZS5VX1JJTkdfQUJPVkU7XG5cdFx0XHRjYXNlIENoYXJDb2RlLlVfQ29tYmluaW5nX0RvdWJsZV9BY3V0ZV9BY2NlbnQ6IHJldHVybiBDaGFyQ29kZS5VX0RPVUJMRV9BQ1VURV9BQ0NFTlQ7XG5cdFx0fVxuXHRcdHJldHVybiBjaGFyQ29kZTtcblx0fVxufVxuXG4oZnVuY3Rpb24gKCkge1xuXHRmdW5jdGlvbiBkZWZpbmUoY2hhckNvZGU6IG51bWJlciwga2V5Q29kZTogS2V5Q29kZSwgc2hpZnRLZXk6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRmb3IgKGxldCBpID0gQ0hBUl9DT0RFX1RPX0tFWV9DT0RFLmxlbmd0aDsgaSA8IGNoYXJDb2RlOyBpKyspIHtcblx0XHRcdENIQVJfQ09ERV9UT19LRVlfQ09ERVtpXSA9IG51bGw7XG5cdFx0fVxuXHRcdENIQVJfQ09ERV9UT19LRVlfQ09ERVtjaGFyQ29kZV0gPSB7IGtleUNvZGU6IGtleUNvZGUsIHNoaWZ0S2V5OiBzaGlmdEtleSB9O1xuXHR9XG5cblx0Zm9yIChsZXQgY2hDb2RlID0gQ2hhckNvZGUuQTsgY2hDb2RlIDw9IENoYXJDb2RlLlo7IGNoQ29kZSsrKSB7XG5cdFx0ZGVmaW5lKGNoQ29kZSwgS2V5Q29kZS5LZXlBICsgKGNoQ29kZSAtIENoYXJDb2RlLkEpLCB0cnVlKTtcblx0fVxuXG5cdGZvciAobGV0IGNoQ29kZSA9IENoYXJDb2RlLmE7IGNoQ29kZSA8PSBDaGFyQ29kZS56OyBjaENvZGUrKykge1xuXHRcdGRlZmluZShjaENvZGUsIEtleUNvZGUuS2V5QSArIChjaENvZGUgLSBDaGFyQ29kZS5hKSwgZmFsc2UpO1xuXHR9XG5cblx0ZGVmaW5lKENoYXJDb2RlLlNlbWljb2xvbiwgS2V5Q29kZS5TZW1pY29sb24sIGZhbHNlKTtcblx0ZGVmaW5lKENoYXJDb2RlLkNvbG9uLCBLZXlDb2RlLlNlbWljb2xvbiwgdHJ1ZSk7XG5cblx0ZGVmaW5lKENoYXJDb2RlLkVxdWFscywgS2V5Q29kZS5FcXVhbCwgZmFsc2UpO1xuXHRkZWZpbmUoQ2hhckNvZGUuUGx1cywgS2V5Q29kZS5FcXVhbCwgdHJ1ZSk7XG5cblx0ZGVmaW5lKENoYXJDb2RlLkNvbW1hLCBLZXlDb2RlLkNvbW1hLCBmYWxzZSk7XG5cdGRlZmluZShDaGFyQ29kZS5MZXNzVGhhbiwgS2V5Q29kZS5Db21tYSwgdHJ1ZSk7XG5cblx0ZGVmaW5lKENoYXJDb2RlLkRhc2gsIEtleUNvZGUuTWludXMsIGZhbHNlKTtcblx0ZGVmaW5lKENoYXJDb2RlLlVuZGVybGluZSwgS2V5Q29kZS5NaW51cywgdHJ1ZSk7XG5cblx0ZGVmaW5lKENoYXJDb2RlLlBlcmlvZCwgS2V5Q29kZS5QZXJpb2QsIGZhbHNlKTtcblx0ZGVmaW5lKENoYXJDb2RlLkdyZWF0ZXJUaGFuLCBLZXlDb2RlLlBlcmlvZCwgdHJ1ZSk7XG5cblx0ZGVmaW5lKENoYXJDb2RlLlNsYXNoLCBLZXlDb2RlLlNsYXNoLCBmYWxzZSk7XG5cdGRlZmluZShDaGFyQ29kZS5RdWVzdGlvbk1hcmssIEtleUNvZGUuU2xhc2gsIHRydWUpO1xuXG5cdGRlZmluZShDaGFyQ29kZS5CYWNrVGljaywgS2V5Q29kZS5CYWNrcXVvdGUsIGZhbHNlKTtcblx0ZGVmaW5lKENoYXJDb2RlLlRpbGRlLCBLZXlDb2RlLkJhY2txdW90ZSwgdHJ1ZSk7XG5cblx0ZGVmaW5lKENoYXJDb2RlLk9wZW5TcXVhcmVCcmFja2V0LCBLZXlDb2RlLkJyYWNrZXRMZWZ0LCBmYWxzZSk7XG5cdGRlZmluZShDaGFyQ29kZS5PcGVuQ3VybHlCcmFjZSwgS2V5Q29kZS5CcmFja2V0TGVmdCwgdHJ1ZSk7XG5cblx0ZGVmaW5lKENoYXJDb2RlLkJhY2tzbGFzaCwgS2V5Q29kZS5CYWNrc2xhc2gsIGZhbHNlKTtcblx0ZGVmaW5lKENoYXJDb2RlLlBpcGUsIEtleUNvZGUuQmFja3NsYXNoLCB0cnVlKTtcblxuXHRkZWZpbmUoQ2hhckNvZGUuQ2xvc2VTcXVhcmVCcmFja2V0LCBLZXlDb2RlLkJyYWNrZXRSaWdodCwgZmFsc2UpO1xuXHRkZWZpbmUoQ2hhckNvZGUuQ2xvc2VDdXJseUJyYWNlLCBLZXlDb2RlLkJyYWNrZXRSaWdodCwgdHJ1ZSk7XG5cblx0ZGVmaW5lKENoYXJDb2RlLlNpbmdsZVF1b3RlLCBLZXlDb2RlLlF1b3RlLCBmYWxzZSk7XG5cdGRlZmluZShDaGFyQ29kZS5Eb3VibGVRdW90ZSwgS2V5Q29kZS5RdW90ZSwgdHJ1ZSk7XG59KSgpO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxTQUFTLGNBQWMsNEJBQTRCLDRCQUE0QixVQUFVLHFCQUFxQjtBQUN2SCxTQUE2QixjQUFtQyxxQkFBd0M7QUFDeEcsU0FBUyx1QkFBdUI7QUFHaEMsU0FBUyw4QkFBOEI7QUFTdkMsTUFBTSx3QkFBNEUsQ0FBQztBQUU1RSxNQUFNLGlDQUFpQyx1QkFBc0M7QUFBQSxFQUluRixZQUFZLFFBQWdDLElBQXFCLFFBQXlCO0FBQ3pGLFVBQU0sSUFBSSxNQUFNO0FBQ2hCLFNBQUssVUFBVTtBQUFBLEVBQ2hCO0FBQUEsRUFFVSxVQUFVLE9BQXFDO0FBQ3hELFdBQU8sS0FBSyxRQUFRLDJCQUEyQixLQUFLO0FBQUEsRUFDckQ7QUFBQSxFQUVVLGNBQWMsT0FBcUM7QUFDNUQsV0FBTyxLQUFLLFFBQVEsNkJBQTZCLEtBQUs7QUFBQSxFQUN2RDtBQUFBLEVBRVUsd0JBQXdCLE9BQXFDO0FBQ3RFLFdBQU8sS0FBSyxRQUFRLDRDQUE0QyxLQUFLO0FBQUEsRUFDdEU7QUFBQSxFQUVVLHNCQUFzQixPQUFxQztBQUNwRSxXQUFPLEtBQUssUUFBUSxxQ0FBcUMsS0FBSztBQUFBLEVBQy9EO0FBQUEsRUFFVSxXQUFXLFNBQXdDO0FBQzVELFFBQUksQ0FBQyxTQUFTO0FBQ2IsYUFBTztBQUFBLElBQ1I7QUFDQSxRQUFJLDJCQUEyQixRQUFRLFFBQVEsTUFBTSxRQUFRLG1CQUFtQjtBQUMvRSxhQUFPO0FBQUEsSUFDUjtBQUNBLFVBQU0sSUFBSSxLQUFLLFFBQVEsNkJBQTZCLE9BQU87QUFDM0QsVUFBTSxJQUFJLEtBQUssUUFBUSxxQ0FBcUMsT0FBTztB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
