import assert from "assert";
import { KeyChord, KeyCode, KeyMod, ScanCode, ScanCodeUtils } from "../../../../../base/common/keyCodes.js";
import { KeyCodeChord, decodeKeybinding, createSimpleKeybinding, ScanCodeChord, Keybinding } from "../../../../../base/common/keybindings.js";
import { UserSettingsLabelProvider } from "../../../../../base/common/keybindingLabels.js";
import { OperatingSystem } from "../../../../../base/common/platform.js";
import { USLayoutResolvedKeybinding } from "../../../../../platform/keybinding/common/usLayoutResolvedKeybinding.js";
import { MacLinuxKeyboardMapper } from "../../common/macLinuxKeyboardMapper.js";
import { assertMapping, assertResolveKeyboardEvent, assertResolveKeybinding, readRawMapping } from "./keyboardMapperTestUtils.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
const WRITE_FILE_IF_DIFFERENT = false;
async function createKeyboardMapper(isUSStandard, file, mapAltGrToCtrlAlt, OS) {
  const rawMappings = await readRawMapping(file);
  return new MacLinuxKeyboardMapper(isUSStandard, rawMappings, mapAltGrToCtrlAlt, OS);
}
suite("keyboardMapper - MAC de_ch", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let mapper;
  suiteSetup(async () => {
    const _mapper = await createKeyboardMapper(false, "mac_de_ch", false, OperatingSystem.Macintosh);
    mapper = _mapper;
  });
  test("mapping", () => {
    return assertMapping(WRITE_FILE_IF_DIFFERENT, mapper, "mac_de_ch.txt");
  });
  function assertKeybindingTranslation(kb, expected) {
    _assertKeybindingTranslation(mapper, OperatingSystem.Macintosh, kb, expected);
  }
  function _assertResolveKeybinding(k, expected) {
    assertResolveKeybinding(mapper, decodeKeybinding(k, OperatingSystem.Macintosh), expected);
  }
  test("kb => hw", () => {
    assertKeybindingTranslation(KeyMod.CtrlCmd | KeyCode.Digit1, "cmd+Digit1");
    assertKeybindingTranslation(KeyMod.CtrlCmd | KeyCode.KeyB, "cmd+KeyB");
    assertKeybindingTranslation(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyB, "shift+cmd+KeyB");
    assertKeybindingTranslation(KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyMod.WinCtrl | KeyCode.KeyB, "ctrl+shift+alt+cmd+KeyB");
    assertKeybindingTranslation(KeyMod.CtrlCmd | KeyCode.KeyZ, "cmd+KeyY");
    assertKeybindingTranslation(KeyMod.CtrlCmd | KeyCode.KeyY, "cmd+KeyZ");
    assertKeybindingTranslation(KeyMod.CtrlCmd | KeyCode.Slash, "shift+cmd+Digit7");
  });
  test("resolveKeybinding Cmd+A", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.KeyA,
      [{
        label: "\u2318A",
        ariaLabel: "Command+A",
        electronAccelerator: "Cmd+A",
        userSettingsLabel: "cmd+a",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["meta+[KeyA]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Cmd+B", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.KeyB,
      [{
        label: "\u2318B",
        ariaLabel: "Command+B",
        electronAccelerator: "Cmd+B",
        userSettingsLabel: "cmd+b",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["meta+[KeyB]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Cmd+Z", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.KeyZ,
      [{
        label: "\u2318Z",
        ariaLabel: "Command+Z",
        electronAccelerator: "Cmd+Z",
        userSettingsLabel: "cmd+z",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["meta+[KeyY]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeyboardEvent Cmd+[KeyY]", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: true,
        altGraphKey: false,
        keyCode: -1,
        code: "KeyY"
      },
      {
        label: "\u2318Z",
        ariaLabel: "Command+Z",
        electronAccelerator: "Cmd+Z",
        userSettingsLabel: "cmd+z",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["meta+[KeyY]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("resolveKeybinding Cmd+]", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.BracketRight,
      [{
        label: "\u2303\u2325\u23186",
        ariaLabel: "Control+Option+Command+6",
        electronAccelerator: "Ctrl+Alt+Cmd+6",
        userSettingsLabel: "ctrl+alt+cmd+6",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+alt+meta+[Digit6]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeyboardEvent Cmd+[BracketRight]", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: true,
        altGraphKey: false,
        keyCode: -1,
        code: "BracketRight"
      },
      {
        label: "\u2318\xA8",
        ariaLabel: "Command+\xA8",
        electronAccelerator: null,
        userSettingsLabel: "cmd+[BracketRight]",
        isWYSIWYG: false,
        isMultiChord: false,
        dispatchParts: ["meta+[BracketRight]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("resolveKeybinding Shift+]", () => {
    _assertResolveKeybinding(
      KeyMod.Shift | KeyCode.BracketRight,
      [{
        label: "\u2303\u23259",
        ariaLabel: "Control+Option+9",
        electronAccelerator: "Ctrl+Alt+9",
        userSettingsLabel: "ctrl+alt+9",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+alt+[Digit9]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Cmd+/", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.Slash,
      [{
        label: "\u21E7\u23187",
        ariaLabel: "Shift+Command+7",
        electronAccelerator: "Shift+Cmd+7",
        userSettingsLabel: "shift+cmd+7",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["shift+meta+[Digit7]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Cmd+Shift+/", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Slash,
      [{
        label: "\u21E7\u2318'",
        ariaLabel: "Shift+Command+'",
        electronAccelerator: null,
        userSettingsLabel: "shift+cmd+[Minus]",
        isWYSIWYG: false,
        isMultiChord: false,
        dispatchParts: ["shift+meta+[Minus]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Cmd+K Cmd+\\", () => {
    _assertResolveKeybinding(
      KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Backslash),
      [{
        label: "\u2318K \u2303\u21E7\u2325\u23187",
        ariaLabel: "Command+K Control+Shift+Option+Command+7",
        electronAccelerator: null,
        userSettingsLabel: "cmd+k ctrl+shift+alt+cmd+7",
        isWYSIWYG: true,
        isMultiChord: true,
        dispatchParts: ["meta+[KeyK]", "ctrl+shift+alt+meta+[Digit7]"],
        singleModifierDispatchParts: [null, null]
      }]
    );
  });
  test("resolveKeybinding Cmd+K Cmd+=", () => {
    _assertResolveKeybinding(
      KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Equal),
      [{
        label: "\u2318K \u21E7\u23180",
        ariaLabel: "Command+K Shift+Command+0",
        electronAccelerator: null,
        userSettingsLabel: "cmd+k shift+cmd+0",
        isWYSIWYG: true,
        isMultiChord: true,
        dispatchParts: ["meta+[KeyK]", "shift+meta+[Digit0]"],
        singleModifierDispatchParts: [null, null]
      }]
    );
  });
  test("resolveKeybinding Cmd+DownArrow", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.DownArrow,
      [{
        label: "\u2318\u2193",
        ariaLabel: "Command+DownArrow",
        electronAccelerator: "Cmd+Down",
        userSettingsLabel: "cmd+down",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["meta+[ArrowDown]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Cmd+NUMPAD_0", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.Numpad0,
      [{
        label: "\u2318NumPad0",
        ariaLabel: "Command+NumPad0",
        electronAccelerator: null,
        userSettingsLabel: "cmd+numpad0",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["meta+[Numpad0]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+Home", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.Home,
      [{
        label: "\u2318Home",
        ariaLabel: "Command+Home",
        electronAccelerator: "Cmd+Home",
        userSettingsLabel: "cmd+home",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["meta+[Home]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeyboardEvent Ctrl+[Home]", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: true,
        altGraphKey: false,
        keyCode: -1,
        code: "Home"
      },
      {
        label: "\u2318Home",
        ariaLabel: "Command+Home",
        electronAccelerator: "Cmd+Home",
        userSettingsLabel: "cmd+home",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["meta+[Home]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("resolveUserBinding Cmd+[Comma] Cmd+/", () => {
    assertResolveKeybinding(
      mapper,
      new Keybinding([
        new ScanCodeChord(false, false, false, true, ScanCode.Comma),
        new KeyCodeChord(false, false, false, true, KeyCode.Slash)
      ]),
      [{
        label: "\u2318, \u21E7\u23187",
        ariaLabel: "Command+, Shift+Command+7",
        electronAccelerator: null,
        userSettingsLabel: "cmd+[Comma] shift+cmd+7",
        isWYSIWYG: false,
        isMultiChord: true,
        dispatchParts: ["meta+[Comma]", "shift+meta+[Digit7]"],
        singleModifierDispatchParts: [null, null]
      }]
    );
  });
  test("resolveKeyboardEvent Single Modifier MetaLeft+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: true,
        altGraphKey: false,
        keyCode: -1,
        code: "MetaLeft"
      },
      {
        label: "\u2318",
        ariaLabel: "Command",
        electronAccelerator: null,
        userSettingsLabel: "cmd",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: ["meta"]
      }
    );
  });
  test("resolveKeyboardEvent Single Modifier MetaRight+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: true,
        altGraphKey: false,
        keyCode: -1,
        code: "MetaRight"
      },
      {
        label: "\u2318",
        ariaLabel: "Command",
        electronAccelerator: null,
        userSettingsLabel: "cmd",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: ["meta"]
      }
    );
  });
});
suite("keyboardMapper - MAC en_us", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let mapper;
  suiteSetup(async () => {
    const _mapper = await createKeyboardMapper(true, "mac_en_us", false, OperatingSystem.Macintosh);
    mapper = _mapper;
  });
  test("mapping", () => {
    return assertMapping(WRITE_FILE_IF_DIFFERENT, mapper, "mac_en_us.txt");
  });
  test("resolveUserBinding Cmd+[Comma] Cmd+/", () => {
    assertResolveKeybinding(
      mapper,
      new Keybinding([
        new ScanCodeChord(false, false, false, true, ScanCode.Comma),
        new KeyCodeChord(false, false, false, true, KeyCode.Slash)
      ]),
      [{
        label: "\u2318, \u2318/",
        ariaLabel: "Command+, Command+/",
        electronAccelerator: null,
        userSettingsLabel: "cmd+, cmd+/",
        isWYSIWYG: true,
        isMultiChord: true,
        dispatchParts: ["meta+[Comma]", "meta+[Slash]"],
        singleModifierDispatchParts: [null, null]
      }]
    );
  });
  test("resolveKeyboardEvent Single Modifier MetaLeft+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: true,
        altGraphKey: false,
        keyCode: -1,
        code: "MetaLeft"
      },
      {
        label: "\u2318",
        ariaLabel: "Command",
        electronAccelerator: null,
        userSettingsLabel: "cmd",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: ["meta"]
      }
    );
  });
  test("resolveKeyboardEvent Single Modifier MetaRight+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: true,
        altGraphKey: false,
        keyCode: -1,
        code: "MetaRight"
      },
      {
        label: "\u2318",
        ariaLabel: "Command",
        electronAccelerator: null,
        userSettingsLabel: "cmd",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: ["meta"]
      }
    );
  });
  test("resolveKeyboardEvent mapAltGrToCtrlAlt AltGr+Z", async () => {
    const mapper2 = await createKeyboardMapper(true, "mac_en_us", true, OperatingSystem.Macintosh);
    assertResolveKeyboardEvent(
      mapper2,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: true,
        keyCode: -1,
        code: "KeyZ"
      },
      {
        label: "\u2303\u2325Z",
        ariaLabel: "Control+Option+Z",
        electronAccelerator: "Ctrl+Alt+Z",
        userSettingsLabel: "ctrl+alt+z",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+alt+[KeyZ]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
});
suite("keyboardMapper - LINUX de_ch", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let mapper;
  suiteSetup(async () => {
    const _mapper = await createKeyboardMapper(false, "linux_de_ch", false, OperatingSystem.Linux);
    mapper = _mapper;
  });
  test("mapping", () => {
    return assertMapping(WRITE_FILE_IF_DIFFERENT, mapper, "linux_de_ch.txt");
  });
  function assertKeybindingTranslation(kb, expected) {
    _assertKeybindingTranslation(mapper, OperatingSystem.Linux, kb, expected);
  }
  function _assertResolveKeybinding(k, expected) {
    assertResolveKeybinding(mapper, decodeKeybinding(k, OperatingSystem.Linux), expected);
  }
  test("kb => hw", () => {
    assertKeybindingTranslation(KeyMod.CtrlCmd | KeyCode.Digit1, "ctrl+Digit1");
    assertKeybindingTranslation(KeyMod.CtrlCmd | KeyCode.KeyB, "ctrl+KeyB");
    assertKeybindingTranslation(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyB, "ctrl+shift+KeyB");
    assertKeybindingTranslation(KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyMod.WinCtrl | KeyCode.KeyB, "ctrl+shift+alt+meta+KeyB");
    assertKeybindingTranslation(KeyMod.CtrlCmd | KeyCode.KeyZ, "ctrl+KeyY");
    assertKeybindingTranslation(KeyMod.CtrlCmd | KeyCode.KeyY, "ctrl+KeyZ");
    assertKeybindingTranslation(KeyMod.CtrlCmd | KeyCode.Slash, "ctrl+shift+Digit7");
  });
  test("resolveKeybinding Ctrl+A", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.KeyA,
      [{
        label: "Ctrl+A",
        ariaLabel: "Control+A",
        electronAccelerator: "Ctrl+A",
        userSettingsLabel: "ctrl+a",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[KeyA]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+Z", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.KeyZ,
      [{
        label: "Ctrl+Z",
        ariaLabel: "Control+Z",
        electronAccelerator: "Ctrl+Z",
        userSettingsLabel: "ctrl+z",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[KeyY]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeyboardEvent Ctrl+[KeyY]", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "KeyY"
      },
      {
        label: "Ctrl+Z",
        ariaLabel: "Control+Z",
        electronAccelerator: "Ctrl+Z",
        userSettingsLabel: "ctrl+z",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[KeyY]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("resolveKeybinding Ctrl+]", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.BracketRight,
      []
    );
  });
  test("resolveKeyboardEvent Ctrl+[BracketRight]", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "BracketRight"
      },
      {
        label: "Ctrl+\xA8",
        ariaLabel: "Control+\xA8",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+[BracketRight]",
        isWYSIWYG: false,
        isMultiChord: false,
        dispatchParts: ["ctrl+[BracketRight]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("resolveKeybinding Shift+]", () => {
    _assertResolveKeybinding(
      KeyMod.Shift | KeyCode.BracketRight,
      [{
        label: "Ctrl+Alt+0",
        ariaLabel: "Control+Alt+0",
        electronAccelerator: "Ctrl+Alt+0",
        userSettingsLabel: "ctrl+alt+0",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+alt+[Digit0]"],
        singleModifierDispatchParts: [null]
      }, {
        label: "Ctrl+Alt+$",
        ariaLabel: "Control+Alt+$",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+alt+[Backslash]",
        isWYSIWYG: false,
        isMultiChord: false,
        dispatchParts: ["ctrl+alt+[Backslash]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+/", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.Slash,
      [{
        label: "Ctrl+Shift+7",
        ariaLabel: "Control+Shift+7",
        electronAccelerator: "Ctrl+Shift+7",
        userSettingsLabel: "ctrl+shift+7",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+shift+[Digit7]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+Shift+/", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Slash,
      [{
        label: "Ctrl+Shift+'",
        ariaLabel: "Control+Shift+'",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+shift+[Minus]",
        isWYSIWYG: false,
        isMultiChord: false,
        dispatchParts: ["ctrl+shift+[Minus]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+K Ctrl+\\", () => {
    _assertResolveKeybinding(
      KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Backslash),
      []
    );
  });
  test("resolveKeybinding Ctrl+K Ctrl+=", () => {
    _assertResolveKeybinding(
      KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Equal),
      [{
        label: "Ctrl+K Ctrl+Shift+0",
        ariaLabel: "Control+K Control+Shift+0",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+k ctrl+shift+0",
        isWYSIWYG: true,
        isMultiChord: true,
        dispatchParts: ["ctrl+[KeyK]", "ctrl+shift+[Digit0]"],
        singleModifierDispatchParts: [null, null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+DownArrow", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.DownArrow,
      [{
        label: "Ctrl+DownArrow",
        ariaLabel: "Control+DownArrow",
        electronAccelerator: "Ctrl+Down",
        userSettingsLabel: "ctrl+down",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[ArrowDown]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+NUMPAD_0", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.Numpad0,
      [{
        label: "Ctrl+NumPad0",
        ariaLabel: "Control+NumPad0",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+numpad0",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[Numpad0]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+Home", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.Home,
      [{
        label: "Ctrl+Home",
        ariaLabel: "Control+Home",
        electronAccelerator: "Ctrl+Home",
        userSettingsLabel: "ctrl+home",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[Home]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeyboardEvent Ctrl+[Home]", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "Home"
      },
      {
        label: "Ctrl+Home",
        ariaLabel: "Control+Home",
        electronAccelerator: "Ctrl+Home",
        userSettingsLabel: "ctrl+home",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[Home]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("resolveKeyboardEvent Ctrl+[KeyX]", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "KeyX"
      },
      {
        label: "Ctrl+X",
        ariaLabel: "Control+X",
        electronAccelerator: "Ctrl+X",
        userSettingsLabel: "ctrl+x",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[KeyX]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("resolveUserBinding Ctrl+[Comma] Ctrl+/", () => {
    assertResolveKeybinding(
      mapper,
      new Keybinding([
        new ScanCodeChord(true, false, false, false, ScanCode.Comma),
        new KeyCodeChord(true, false, false, false, KeyCode.Slash)
      ]),
      [{
        label: "Ctrl+, Ctrl+Shift+7",
        ariaLabel: "Control+, Control+Shift+7",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+[Comma] ctrl+shift+7",
        isWYSIWYG: false,
        isMultiChord: true,
        dispatchParts: ["ctrl+[Comma]", "ctrl+shift+[Digit7]"],
        singleModifierDispatchParts: [null, null]
      }]
    );
  });
  test("resolveKeyboardEvent Single Modifier ControlLeft+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "ControlLeft"
      },
      {
        label: "Ctrl",
        ariaLabel: "Control",
        electronAccelerator: null,
        userSettingsLabel: "ctrl",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: ["ctrl"]
      }
    );
  });
  test("resolveKeyboardEvent Single Modifier ControlRight+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "ControlRight"
      },
      {
        label: "Ctrl",
        ariaLabel: "Control",
        electronAccelerator: null,
        userSettingsLabel: "ctrl",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: ["ctrl"]
      }
    );
  });
});
suite("keyboardMapper - LINUX en_us", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let mapper;
  suiteSetup(async () => {
    const _mapper = await createKeyboardMapper(true, "linux_en_us", false, OperatingSystem.Linux);
    mapper = _mapper;
  });
  test("mapping", () => {
    return assertMapping(WRITE_FILE_IF_DIFFERENT, mapper, "linux_en_us.txt");
  });
  function _assertResolveKeybinding(k, expected) {
    assertResolveKeybinding(mapper, decodeKeybinding(k, OperatingSystem.Linux), expected);
  }
  test("resolveKeybinding Ctrl+A", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.KeyA,
      [{
        label: "Ctrl+A",
        ariaLabel: "Control+A",
        electronAccelerator: "Ctrl+A",
        userSettingsLabel: "ctrl+a",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[KeyA]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+Z", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.KeyZ,
      [{
        label: "Ctrl+Z",
        ariaLabel: "Control+Z",
        electronAccelerator: "Ctrl+Z",
        userSettingsLabel: "ctrl+z",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[KeyZ]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeyboardEvent Ctrl+[KeyZ]", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "KeyZ"
      },
      {
        label: "Ctrl+Z",
        ariaLabel: "Control+Z",
        electronAccelerator: "Ctrl+Z",
        userSettingsLabel: "ctrl+z",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[KeyZ]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("resolveKeybinding Ctrl+]", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.BracketRight,
      [{
        label: "Ctrl+]",
        ariaLabel: "Control+]",
        electronAccelerator: "Ctrl+]",
        userSettingsLabel: "ctrl+]",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[BracketRight]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeyboardEvent Ctrl+[BracketRight]", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "BracketRight"
      },
      {
        label: "Ctrl+]",
        ariaLabel: "Control+]",
        electronAccelerator: "Ctrl+]",
        userSettingsLabel: "ctrl+]",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[BracketRight]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("resolveKeybinding Shift+]", () => {
    _assertResolveKeybinding(
      KeyMod.Shift | KeyCode.BracketRight,
      [{
        label: "Shift+]",
        ariaLabel: "Shift+]",
        electronAccelerator: "Shift+]",
        userSettingsLabel: "shift+]",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["shift+[BracketRight]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+/", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.Slash,
      [{
        label: "Ctrl+/",
        ariaLabel: "Control+/",
        electronAccelerator: "Ctrl+/",
        userSettingsLabel: "ctrl+/",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[Slash]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+Shift+/", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Slash,
      [{
        label: "Ctrl+Shift+/",
        ariaLabel: "Control+Shift+/",
        electronAccelerator: "Ctrl+Shift+/",
        userSettingsLabel: "ctrl+shift+/",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+shift+[Slash]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+K Ctrl+\\", () => {
    _assertResolveKeybinding(
      KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Backslash),
      [{
        label: "Ctrl+K Ctrl+\\",
        ariaLabel: "Control+K Control+\\",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+k ctrl+\\",
        isWYSIWYG: true,
        isMultiChord: true,
        dispatchParts: ["ctrl+[KeyK]", "ctrl+[Backslash]"],
        singleModifierDispatchParts: [null, null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+K Ctrl+=", () => {
    _assertResolveKeybinding(
      KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Equal),
      [{
        label: "Ctrl+K Ctrl+=",
        ariaLabel: "Control+K Control+=",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+k ctrl+=",
        isWYSIWYG: true,
        isMultiChord: true,
        dispatchParts: ["ctrl+[KeyK]", "ctrl+[Equal]"],
        singleModifierDispatchParts: [null, null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+DownArrow", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.DownArrow,
      [{
        label: "Ctrl+DownArrow",
        ariaLabel: "Control+DownArrow",
        electronAccelerator: "Ctrl+Down",
        userSettingsLabel: "ctrl+down",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[ArrowDown]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+NUMPAD_0", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.Numpad0,
      [{
        label: "Ctrl+NumPad0",
        ariaLabel: "Control+NumPad0",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+numpad0",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[Numpad0]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+Home", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.Home,
      [{
        label: "Ctrl+Home",
        ariaLabel: "Control+Home",
        electronAccelerator: "Ctrl+Home",
        userSettingsLabel: "ctrl+home",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[Home]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeyboardEvent Ctrl+[Home]", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "Home"
      },
      {
        label: "Ctrl+Home",
        ariaLabel: "Control+Home",
        electronAccelerator: "Ctrl+Home",
        userSettingsLabel: "ctrl+home",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[Home]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("resolveKeybinding Ctrl+Shift+,", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Comma,
      [{
        label: "Ctrl+Shift+,",
        ariaLabel: "Control+Shift+,",
        electronAccelerator: "Ctrl+Shift+,",
        userSettingsLabel: "ctrl+shift+,",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+shift+[Comma]"],
        singleModifierDispatchParts: [null]
      }, {
        label: "Ctrl+<",
        ariaLabel: "Control+<",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+[IntlBackslash]",
        isWYSIWYG: false,
        isMultiChord: false,
        dispatchParts: ["ctrl+[IntlBackslash]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("issue #23393: resolveKeybinding Ctrl+Enter", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.Enter,
      [{
        label: "Ctrl+Enter",
        ariaLabel: "Control+Enter",
        electronAccelerator: "Ctrl+Enter",
        userSettingsLabel: "ctrl+enter",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[Enter]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("issue #23393: resolveKeyboardEvent Ctrl+[NumpadEnter]", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "NumpadEnter"
      },
      {
        label: "Ctrl+Enter",
        ariaLabel: "Control+Enter",
        electronAccelerator: "Ctrl+Enter",
        userSettingsLabel: "ctrl+enter",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[Enter]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("resolveUserBinding Ctrl+[Comma] Ctrl+/", () => {
    assertResolveKeybinding(
      mapper,
      new Keybinding([
        new ScanCodeChord(true, false, false, false, ScanCode.Comma),
        new KeyCodeChord(true, false, false, false, KeyCode.Slash)
      ]),
      [{
        label: "Ctrl+, Ctrl+/",
        ariaLabel: "Control+, Control+/",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+, ctrl+/",
        isWYSIWYG: true,
        isMultiChord: true,
        dispatchParts: ["ctrl+[Comma]", "ctrl+[Slash]"],
        singleModifierDispatchParts: [null, null]
      }]
    );
  });
  test("resolveUserBinding Ctrl+[Comma]", () => {
    assertResolveKeybinding(
      mapper,
      new Keybinding([
        new ScanCodeChord(true, false, false, false, ScanCode.Comma)
      ]),
      [{
        label: "Ctrl+,",
        ariaLabel: "Control+,",
        electronAccelerator: "Ctrl+,",
        userSettingsLabel: "ctrl+,",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[Comma]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeyboardEvent Single Modifier ControlLeft+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "ControlLeft"
      },
      {
        label: "Ctrl",
        ariaLabel: "Control",
        electronAccelerator: null,
        userSettingsLabel: "ctrl",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: ["ctrl"]
      }
    );
  });
  test("resolveKeyboardEvent Single Modifier ControlRight+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "ControlRight"
      },
      {
        label: "Ctrl",
        ariaLabel: "Control",
        electronAccelerator: null,
        userSettingsLabel: "ctrl",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: ["ctrl"]
      }
    );
  });
  test("resolveKeyboardEvent Single Modifier ShiftLeft+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "ShiftLeft"
      },
      {
        label: "Shift",
        ariaLabel: "Shift",
        electronAccelerator: null,
        userSettingsLabel: "shift",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: ["shift"]
      }
    );
  });
  test("resolveKeyboardEvent Single Modifier ShiftRight+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "ShiftRight"
      },
      {
        label: "Shift",
        ariaLabel: "Shift",
        electronAccelerator: null,
        userSettingsLabel: "shift",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: ["shift"]
      }
    );
  });
  test("resolveKeyboardEvent Single Modifier AltLeft+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: true,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "AltLeft"
      },
      {
        label: "Alt",
        ariaLabel: "Alt",
        electronAccelerator: null,
        userSettingsLabel: "alt",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: ["alt"]
      }
    );
  });
  test("resolveKeyboardEvent Single Modifier AltRight+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: true,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "AltRight"
      },
      {
        label: "Alt",
        ariaLabel: "Alt",
        electronAccelerator: null,
        userSettingsLabel: "alt",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: ["alt"]
      }
    );
  });
  test("resolveKeyboardEvent Single Modifier MetaLeft+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: true,
        altGraphKey: false,
        keyCode: -1,
        code: "MetaLeft"
      },
      {
        label: "Super",
        ariaLabel: "Super",
        electronAccelerator: null,
        userSettingsLabel: "meta",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: ["meta"]
      }
    );
  });
  test("resolveKeyboardEvent Single Modifier MetaRight+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: true,
        altGraphKey: false,
        keyCode: -1,
        code: "MetaRight"
      },
      {
        label: "Super",
        ariaLabel: "Super",
        electronAccelerator: null,
        userSettingsLabel: "meta",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: ["meta"]
      }
    );
  });
  test("resolveKeyboardEvent Only Modifiers Ctrl+Shift+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "ShiftLeft"
      },
      {
        label: "Ctrl+Shift",
        ariaLabel: "Control+Shift",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+shift",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("resolveKeyboardEvent mapAltGrToCtrlAlt AltGr+Z", async () => {
    const mapper2 = await createKeyboardMapper(true, "linux_en_us", true, OperatingSystem.Linux);
    assertResolveKeyboardEvent(
      mapper2,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: true,
        keyCode: -1,
        code: "KeyZ"
      },
      {
        label: "Ctrl+Alt+Z",
        ariaLabel: "Control+Alt+Z",
        electronAccelerator: "Ctrl+Alt+Z",
        userSettingsLabel: "ctrl+alt+z",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+alt+[KeyZ]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
});
suite("keyboardMapper", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("issue #23706: Linux UK layout: Ctrl + Apostrophe also toggles terminal", () => {
    const mapper = new MacLinuxKeyboardMapper(false, {
      "Backquote": {
        "value": "`",
        "withShift": "\xAC",
        "withAltGr": "|",
        "withShiftAltGr": "|"
      }
    }, false, OperatingSystem.Linux);
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "Backquote"
      },
      {
        label: "Ctrl+`",
        ariaLabel: "Control+`",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+`",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[Backquote]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("issue #24064: NumLock/NumPad keys stopped working in 1.11 on Linux", () => {
    const mapper = new MacLinuxKeyboardMapper(false, {}, false, OperatingSystem.Linux);
    function assertNumpadKeyboardEvent(keyCode, code, label, electronAccelerator, userSettingsLabel, dispatch) {
      assertResolveKeyboardEvent(
        mapper,
        {
          _standardKeyboardEventBrand: true,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          metaKey: false,
          altGraphKey: false,
          keyCode,
          code
        },
        {
          label,
          ariaLabel: label,
          electronAccelerator,
          userSettingsLabel,
          isWYSIWYG: true,
          isMultiChord: false,
          dispatchParts: [dispatch],
          singleModifierDispatchParts: [null]
        }
      );
    }
    assertNumpadKeyboardEvent(KeyCode.End, "Numpad1", "End", "End", "end", "[End]");
    assertNumpadKeyboardEvent(KeyCode.DownArrow, "Numpad2", "DownArrow", "Down", "down", "[ArrowDown]");
    assertNumpadKeyboardEvent(KeyCode.PageDown, "Numpad3", "PageDown", "PageDown", "pagedown", "[PageDown]");
    assertNumpadKeyboardEvent(KeyCode.LeftArrow, "Numpad4", "LeftArrow", "Left", "left", "[ArrowLeft]");
    assertNumpadKeyboardEvent(KeyCode.Unknown, "Numpad5", "NumPad5", null, "numpad5", "[Numpad5]");
    assertNumpadKeyboardEvent(KeyCode.RightArrow, "Numpad6", "RightArrow", "Right", "right", "[ArrowRight]");
    assertNumpadKeyboardEvent(KeyCode.Home, "Numpad7", "Home", "Home", "home", "[Home]");
    assertNumpadKeyboardEvent(KeyCode.UpArrow, "Numpad8", "UpArrow", "Up", "up", "[ArrowUp]");
    assertNumpadKeyboardEvent(KeyCode.PageUp, "Numpad9", "PageUp", "PageUp", "pageup", "[PageUp]");
    assertNumpadKeyboardEvent(KeyCode.Insert, "Numpad0", "Insert", "Insert", "insert", "[Insert]");
    assertNumpadKeyboardEvent(KeyCode.Delete, "NumpadDecimal", "Delete", "Delete", "delete", "[Delete]");
  });
  test("issue #24107: Delete, Insert, Home, End, PgUp, PgDn, and arrow keys no longer work editor in 1.11", () => {
    const mapper = new MacLinuxKeyboardMapper(false, {}, false, OperatingSystem.Linux);
    function assertKeyboardEvent(keyCode, code, label, electronAccelerator, userSettingsLabel, dispatch) {
      assertResolveKeyboardEvent(
        mapper,
        {
          _standardKeyboardEventBrand: true,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          metaKey: false,
          altGraphKey: false,
          keyCode,
          code
        },
        {
          label,
          ariaLabel: label,
          electronAccelerator,
          userSettingsLabel,
          isWYSIWYG: true,
          isMultiChord: false,
          dispatchParts: [dispatch],
          singleModifierDispatchParts: [null]
        }
      );
    }
    assertKeyboardEvent(KeyCode.UpArrow, "Lang3", "UpArrow", "Up", "up", "[ArrowUp]");
    assertKeyboardEvent(KeyCode.DownArrow, "NumpadEnter", "DownArrow", "Down", "down", "[ArrowDown]");
    assertKeyboardEvent(KeyCode.LeftArrow, "Convert", "LeftArrow", "Left", "left", "[ArrowLeft]");
    assertKeyboardEvent(KeyCode.RightArrow, "NonConvert", "RightArrow", "Right", "right", "[ArrowRight]");
    assertKeyboardEvent(KeyCode.Delete, "PrintScreen", "Delete", "Delete", "delete", "[Delete]");
    assertKeyboardEvent(KeyCode.Insert, "NumpadDivide", "Insert", "Insert", "insert", "[Insert]");
    assertKeyboardEvent(KeyCode.End, "Unknown", "End", "End", "end", "[End]");
    assertKeyboardEvent(KeyCode.Home, "IntlRo", "Home", "Home", "home", "[Home]");
    assertKeyboardEvent(KeyCode.PageDown, "ControlRight", "PageDown", "PageDown", "pagedown", "[PageDown]");
    assertKeyboardEvent(KeyCode.PageUp, "Lang4", "PageUp", "PageUp", "pageup", "[PageUp]");
    assertKeyboardEvent(KeyCode.PageDown, "ControlRight", "PageDown", "PageDown", "pagedown", "[PageDown]");
    assertKeyboardEvent(KeyCode.PageUp, "Lang4", "PageUp", "PageUp", "pageup", "[PageUp]");
    assertKeyboardEvent(KeyCode.End, "", "End", "End", "end", "[End]");
    assertKeyboardEvent(KeyCode.Home, "IntlRo", "Home", "Home", "home", "[Home]");
    assertKeyboardEvent(KeyCode.Delete, "PrintScreen", "Delete", "Delete", "delete", "[Delete]");
    assertKeyboardEvent(KeyCode.Insert, "NumpadDivide", "Insert", "Insert", "insert", "[Insert]");
    assertKeyboardEvent(KeyCode.RightArrow, "NonConvert", "RightArrow", "Right", "right", "[ArrowRight]");
    assertKeyboardEvent(KeyCode.LeftArrow, "Convert", "LeftArrow", "Left", "left", "[ArrowLeft]");
    assertKeyboardEvent(KeyCode.DownArrow, "NumpadEnter", "DownArrow", "Down", "down", "[ArrowDown]");
    assertKeyboardEvent(KeyCode.UpArrow, "Lang3", "UpArrow", "Up", "up", "[ArrowUp]");
  });
});
suite("keyboardMapper - LINUX ru", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let mapper;
  suiteSetup(async () => {
    const _mapper = await createKeyboardMapper(false, "linux_ru", false, OperatingSystem.Linux);
    mapper = _mapper;
  });
  test("mapping", () => {
    return assertMapping(WRITE_FILE_IF_DIFFERENT, mapper, "linux_ru.txt");
  });
  function _assertResolveKeybinding(k, expected) {
    assertResolveKeybinding(mapper, decodeKeybinding(k, OperatingSystem.Linux), expected);
  }
  test("resolveKeybinding Ctrl+S", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.KeyS,
      [{
        label: "Ctrl+S",
        ariaLabel: "Control+S",
        electronAccelerator: "Ctrl+S",
        userSettingsLabel: "ctrl+s",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+[KeyS]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
});
suite("keyboardMapper - LINUX en_uk", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let mapper;
  suiteSetup(async () => {
    const _mapper = await createKeyboardMapper(false, "linux_en_uk", false, OperatingSystem.Linux);
    mapper = _mapper;
  });
  test("mapping", () => {
    return assertMapping(WRITE_FILE_IF_DIFFERENT, mapper, "linux_en_uk.txt");
  });
  test("issue #24522: resolveKeyboardEvent Ctrl+Alt+[Minus]", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: true,
        metaKey: false,
        altGraphKey: false,
        keyCode: -1,
        code: "Minus"
      },
      {
        label: "Ctrl+Alt+-",
        ariaLabel: "Control+Alt+-",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+alt+[Minus]",
        isWYSIWYG: false,
        isMultiChord: false,
        dispatchParts: ["ctrl+alt+[Minus]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
});
suite("keyboardMapper - MAC zh_hant", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let mapper;
  suiteSetup(async () => {
    const _mapper = await createKeyboardMapper(false, "mac_zh_hant", false, OperatingSystem.Macintosh);
    mapper = _mapper;
  });
  test("mapping", () => {
    return assertMapping(WRITE_FILE_IF_DIFFERENT, mapper, "mac_zh_hant.txt");
  });
  function _assertResolveKeybinding(k, expected) {
    assertResolveKeybinding(mapper, decodeKeybinding(k, OperatingSystem.Macintosh), expected);
  }
  test("issue #28237 resolveKeybinding Cmd+C", () => {
    _assertResolveKeybinding(
      KeyMod.CtrlCmd | KeyCode.KeyC,
      [{
        label: "\u2318C",
        ariaLabel: "Command+C",
        electronAccelerator: "Cmd+C",
        userSettingsLabel: "cmd+c",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["meta+[KeyC]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
});
suite("keyboardMapper - MAC zh_hant2", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let mapper;
  suiteSetup(async () => {
    const _mapper = await createKeyboardMapper(false, "mac_zh_hant2", false, OperatingSystem.Macintosh);
    mapper = _mapper;
  });
  test("mapping", () => {
    return assertMapping(WRITE_FILE_IF_DIFFERENT, mapper, "mac_zh_hant2.txt");
  });
});
function _assertKeybindingTranslation(mapper, OS, kb, _expected) {
  let expected;
  if (typeof _expected === "string") {
    expected = [_expected];
  } else if (Array.isArray(_expected)) {
    expected = _expected;
  } else {
    expected = [];
  }
  const runtimeKeybinding = createSimpleKeybinding(kb, OS);
  const keybindingLabel = new USLayoutResolvedKeybinding([runtimeKeybinding], OS).getUserSettingsLabel();
  const actualHardwareKeypresses = mapper.keyCodeChordToScanCodeChord(runtimeKeybinding);
  if (actualHardwareKeypresses.length === 0) {
    assert.deepStrictEqual([], expected, `simpleKeybindingToHardwareKeypress -- "${keybindingLabel}" -- actual: "[]" -- expected: "${expected}"`);
    return;
  }
  const actual = actualHardwareKeypresses.map((k) => UserSettingsLabelProvider.toLabel(OS, [k], (keybinding) => ScanCodeUtils.toString(keybinding.scanCode)));
  assert.deepStrictEqual(actual, expected, `simpleKeybindingToHardwareKeypress -- "${keybindingLabel}" -- actual: "${actual}" -- expected: "${expected}"`);
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMva2V5YmluZGluZy90ZXN0L25vZGUvbWFjTGludXhLZXlib2FyZE1hcHBlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgS2V5Q2hvcmQsIEtleUNvZGUsIEtleU1vZCwgU2NhbkNvZGUsIFNjYW5Db2RlVXRpbHMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlQ2hvcmQsIGRlY29kZUtleWJpbmRpbmcsIGNyZWF0ZVNpbXBsZUtleWJpbmRpbmcsIFNjYW5Db2RlQ2hvcmQsIEtleWJpbmRpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXliaW5kaW5ncy5qcyc7XG5pbXBvcnQgeyBVc2VyU2V0dGluZ3NMYWJlbFByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5YmluZGluZ0xhYmVscy5qcyc7XG5pbXBvcnQgeyBPcGVyYXRpbmdTeXN0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBVU0xheW91dFJlc29sdmVkS2V5YmluZGluZyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL3VzTGF5b3V0UmVzb2x2ZWRLZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IE1hY0xpbnV4S2V5Ym9hcmRNYXBwZXIgfSBmcm9tICcuLi8uLi9jb21tb24vbWFjTGludXhLZXlib2FyZE1hcHBlci5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZWRLZXliaW5kaW5nLCBhc3NlcnRNYXBwaW5nLCBhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudCwgYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcsIHJlYWRSYXdNYXBwaW5nIH0gZnJvbSAnLi9rZXlib2FyZE1hcHBlclRlc3RVdGlscy5qcyc7XG5pbXBvcnQgeyBJTWFjTGludXhLZXlib2FyZE1hcHBpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXlib2FyZExheW91dC9jb21tb24va2V5Ym9hcmRMYXlvdXQuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbmNvbnN0IFdSSVRFX0ZJTEVfSUZfRElGRkVSRU5UID0gZmFsc2U7XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUtleWJvYXJkTWFwcGVyKGlzVVNTdGFuZGFyZDogYm9vbGVhbiwgZmlsZTogc3RyaW5nLCBtYXBBbHRHclRvQ3RybEFsdDogYm9vbGVhbiwgT1M6IE9wZXJhdGluZ1N5c3RlbSk6IFByb21pc2U8TWFjTGludXhLZXlib2FyZE1hcHBlcj4ge1xuXHRjb25zdCByYXdNYXBwaW5ncyA9IGF3YWl0IHJlYWRSYXdNYXBwaW5nPElNYWNMaW51eEtleWJvYXJkTWFwcGluZz4oZmlsZSk7XG5cdHJldHVybiBuZXcgTWFjTGludXhLZXlib2FyZE1hcHBlcihpc1VTU3RhbmRhcmQsIHJhd01hcHBpbmdzLCBtYXBBbHRHclRvQ3RybEFsdCwgT1MpO1xufVxuXG5zdWl0ZSgna2V5Ym9hcmRNYXBwZXIgLSBNQUMgZGVfY2gnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IG1hcHBlcjogTWFjTGludXhLZXlib2FyZE1hcHBlcjtcblxuXHRzdWl0ZVNldHVwKGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBfbWFwcGVyID0gYXdhaXQgY3JlYXRlS2V5Ym9hcmRNYXBwZXIoZmFsc2UsICdtYWNfZGVfY2gnLCBmYWxzZSwgT3BlcmF0aW5nU3lzdGVtLk1hY2ludG9zaCk7XG5cdFx0bWFwcGVyID0gX21hcHBlcjtcblx0fSk7XG5cblx0dGVzdCgnbWFwcGluZycsICgpID0+IHtcblx0XHRyZXR1cm4gYXNzZXJ0TWFwcGluZyhXUklURV9GSUxFX0lGX0RJRkZFUkVOVCwgbWFwcGVyLCAnbWFjX2RlX2NoLnR4dCcpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBhc3NlcnRLZXliaW5kaW5nVHJhbnNsYXRpb24oa2I6IG51bWJlciwgZXhwZWN0ZWQ6IHN0cmluZyB8IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0X2Fzc2VydEtleWJpbmRpbmdUcmFuc2xhdGlvbihtYXBwZXIsIE9wZXJhdGluZ1N5c3RlbS5NYWNpbnRvc2gsIGtiLCBleHBlY3RlZCk7XG5cdH1cblxuXHRmdW5jdGlvbiBfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoazogbnVtYmVyLCBleHBlY3RlZDogSVJlc29sdmVkS2V5YmluZGluZ1tdKTogdm9pZCB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcobWFwcGVyLCBkZWNvZGVLZXliaW5kaW5nKGssIE9wZXJhdGluZ1N5c3RlbS5NYWNpbnRvc2gpISwgZXhwZWN0ZWQpO1xuXHR9XG5cblx0dGVzdCgna2IgPT4gaHcnLCAoKSA9PiB7XG5cdFx0Ly8gdW5jaGFuZ2VkXG5cdFx0YXNzZXJ0S2V5YmluZGluZ1RyYW5zbGF0aW9uKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5EaWdpdDEsICdjbWQrRGlnaXQxJyk7XG5cdFx0YXNzZXJ0S2V5YmluZGluZ1RyYW5zbGF0aW9uKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlCLCAnY21kK0tleUInKTtcblx0XHRhc3NlcnRLZXliaW5kaW5nVHJhbnNsYXRpb24oS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleUIsICdzaGlmdCtjbWQrS2V5QicpO1xuXHRcdGFzc2VydEtleWJpbmRpbmdUcmFuc2xhdGlvbihLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleU1vZC5BbHQgfCBLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuS2V5QiwgJ2N0cmwrc2hpZnQrYWx0K2NtZCtLZXlCJyk7XG5cblx0XHQvLyBmbGlwcyBZIGFuZCBaXG5cdFx0YXNzZXJ0S2V5YmluZGluZ1RyYW5zbGF0aW9uKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlaLCAnY21kK0tleVknKTtcblx0XHRhc3NlcnRLZXliaW5kaW5nVHJhbnNsYXRpb24oS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVksICdjbWQrS2V5WicpO1xuXG5cdFx0Ly8gQ3RybCsvXG5cdFx0YXNzZXJ0S2V5YmluZGluZ1RyYW5zbGF0aW9uKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5TbGFzaCwgJ3NoaWZ0K2NtZCtEaWdpdDcnKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ21kK0EnLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUEsXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ1x1MjMxOEEnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb21tYW5kK0EnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ21kK0EnLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2NtZCthJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ21ldGErW0tleUFdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDbWQrQicsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5Qixcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiAnXHUyMzE4QicsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbW1hbmQrQicsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDbWQrQicsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY21kK2InLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnbWV0YStbS2V5Ql0nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIENtZCtaJywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlaLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdcdTIzMThaJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29tbWFuZCtaJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogJ0NtZCtaJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjbWQreicsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydtZXRhK1tLZXlZXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgQ21kK1tLZXlZXScsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiBmYWxzZSxcblx0XHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0XHRtZXRhS2V5OiB0cnVlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdGtleUNvZGU6IC0xLFxuXHRcdFx0XHRjb2RlOiAnS2V5WSdcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnXHUyMzE4WicsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbW1hbmQrWicsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDbWQrWicsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY21kK3onLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnbWV0YStbS2V5WV0nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ21kK10nLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkJyYWNrZXRSaWdodCxcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiAnXHUyMzAzXHUyMzI1XHUyMzE4NicsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrT3B0aW9uK0NvbW1hbmQrNicsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDdHJsK0FsdCtDbWQrNicsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCthbHQrY21kKzYnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCthbHQrbWV0YStbRGlnaXQ2XSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgQ21kK1tCcmFja2V0UmlnaHRdJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IGZhbHNlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IHRydWUsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogLTEsXG5cdFx0XHRcdGNvZGU6ICdCcmFja2V0UmlnaHQnXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ1x1MjMxOFx1MDBBOCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbW1hbmQrXHUwMEE4Jyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjbWQrW0JyYWNrZXRSaWdodF0nLFxuXHRcdFx0XHRpc1dZU0lXWUc6IGZhbHNlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ21ldGErW0JyYWNrZXRSaWdodF0nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgU2hpZnQrXScsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkJyYWNrZXRSaWdodCxcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiAnXHUyMzAzXHUyMzI1OScsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrT3B0aW9uKzknLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtBbHQrOScsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCthbHQrOScsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK2FsdCtbRGlnaXQ5XSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ21kKy8nLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlNsYXNoLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdcdTIxRTdcdTIzMTg3Jyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnU2hpZnQrQ29tbWFuZCs3Jyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogJ1NoaWZ0K0NtZCs3Jyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdzaGlmdCtjbWQrNycsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydzaGlmdCttZXRhK1tEaWdpdDddJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDbWQrU2hpZnQrLycsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuU2xhc2gsXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ1x1MjFFN1x1MjMxOFxcJycsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ1NoaWZ0K0NvbW1hbmQrXFwnJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdzaGlmdCtjbWQrW01pbnVzXScsXG5cdFx0XHRcdGlzV1lTSVdZRzogZmFsc2UsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnc2hpZnQrbWV0YStbTWludXNdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDbWQrSyBDbWQrXFxcXCcsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkJhY2tzbGFzaCksXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ1x1MjMxOEsgXHUyMzAzXHUyMUU3XHUyMzI1XHUyMzE4NycsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbW1hbmQrSyBDb250cm9sK1NoaWZ0K09wdGlvbitDb21tYW5kKzcnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2NtZCtrIGN0cmwrc2hpZnQrYWx0K2NtZCs3Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IHRydWUsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnbWV0YStbS2V5S10nLCAnY3RybCtzaGlmdCthbHQrbWV0YStbRGlnaXQ3XSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsLCBudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ21kK0sgQ21kKz0nLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5FcXVhbCksXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ1x1MjMxOEsgXHUyMUU3XHUyMzE4MCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbW1hbmQrSyBTaGlmdCtDb21tYW5kKzAnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2NtZCtrIHNoaWZ0K2NtZCswJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IHRydWUsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnbWV0YStbS2V5S10nLCAnc2hpZnQrbWV0YStbRGlnaXQwXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsLCBudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ21kK0Rvd25BcnJvdycsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRG93bkFycm93LFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdcdTIzMThcdTIxOTMnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb21tYW5kK0Rvd25BcnJvdycsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDbWQrRG93bicsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY21kK2Rvd24nLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnbWV0YStbQXJyb3dEb3duXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ21kK05VTVBBRF8wJywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5OdW1wYWQwLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdcdTIzMThOdW1QYWQwJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29tbWFuZCtOdW1QYWQwJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjbWQrbnVtcGFkMCcsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydtZXRhK1tOdW1wYWQwXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ3RybCtIb21lJywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Ib21lLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdcdTIzMThIb21lJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29tbWFuZCtIb21lJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogJ0NtZCtIb21lJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjbWQraG9tZScsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydtZXRhK1tIb21lXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgQ3RybCtbSG9tZV0nLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHR7XG5cdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0Y3RybEtleTogZmFsc2UsXG5cdFx0XHRcdHNoaWZ0S2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogdHJ1ZSxcblx0XHRcdFx0YWx0R3JhcGhLZXk6IGZhbHNlLFxuXHRcdFx0XHRrZXlDb2RlOiAtMSxcblx0XHRcdFx0Y29kZTogJ0hvbWUnXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ1x1MjMxOEhvbWUnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb21tYW5kK0hvbWUnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ21kK0hvbWUnLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2NtZCtob21lJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ21ldGErW0hvbWVdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVVc2VyQmluZGluZyBDbWQrW0NvbW1hXSBDbWQrLycsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdG1hcHBlcixcblx0XHRcdG5ldyBLZXliaW5kaW5nKFtcblx0XHRcdFx0bmV3IFNjYW5Db2RlQ2hvcmQoZmFsc2UsIGZhbHNlLCBmYWxzZSwgdHJ1ZSwgU2NhbkNvZGUuQ29tbWEpLFxuXHRcdFx0XHRuZXcgS2V5Q29kZUNob3JkKGZhbHNlLCBmYWxzZSwgZmFsc2UsIHRydWUsIEtleUNvZGUuU2xhc2gpLFxuXHRcdFx0XSksXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ1x1MjMxOCwgXHUyMUU3XHUyMzE4NycsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbW1hbmQrLCBTaGlmdCtDb21tYW5kKzcnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2NtZCtbQ29tbWFdIHNoaWZ0K2NtZCs3Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiBmYWxzZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiB0cnVlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ21ldGErW0NvbW1hXScsICdzaGlmdCttZXRhK1tEaWdpdDddJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGwsIG51bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBTaW5nbGUgTW9kaWZpZXIgTWV0YUxlZnQrJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IGZhbHNlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IHRydWUsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogLTEsXG5cdFx0XHRcdGNvZGU6ICdNZXRhTGVmdCdcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnXHUyMzE4Jyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29tbWFuZCcsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY21kJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogWydtZXRhJ10sXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgU2luZ2xlIE1vZGlmaWVyIE1ldGFSaWdodCsnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHR7XG5cdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0Y3RybEtleTogZmFsc2UsXG5cdFx0XHRcdHNoaWZ0S2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogdHJ1ZSxcblx0XHRcdFx0YWx0R3JhcGhLZXk6IGZhbHNlLFxuXHRcdFx0XHRrZXlDb2RlOiAtMSxcblx0XHRcdFx0Y29kZTogJ01ldGFSaWdodCdcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnXHUyMzE4Jyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29tbWFuZCcsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY21kJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogWydtZXRhJ10sXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ2tleWJvYXJkTWFwcGVyIC0gTUFDIGVuX3VzJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGxldCBtYXBwZXI6IE1hY0xpbnV4S2V5Ym9hcmRNYXBwZXI7XG5cblx0c3VpdGVTZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgX21hcHBlciA9IGF3YWl0IGNyZWF0ZUtleWJvYXJkTWFwcGVyKHRydWUsICdtYWNfZW5fdXMnLCBmYWxzZSwgT3BlcmF0aW5nU3lzdGVtLk1hY2ludG9zaCk7XG5cdFx0bWFwcGVyID0gX21hcHBlcjtcblx0fSk7XG5cblx0dGVzdCgnbWFwcGluZycsICgpID0+IHtcblx0XHRyZXR1cm4gYXNzZXJ0TWFwcGluZyhXUklURV9GSUxFX0lGX0RJRkZFUkVOVCwgbWFwcGVyLCAnbWFjX2VuX3VzLnR4dCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlVXNlckJpbmRpbmcgQ21kK1tDb21tYV0gQ21kKy8nLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHRuZXcgS2V5YmluZGluZyhbXG5cdFx0XHRcdG5ldyBTY2FuQ29kZUNob3JkKGZhbHNlLCBmYWxzZSwgZmFsc2UsIHRydWUsIFNjYW5Db2RlLkNvbW1hKSxcblx0XHRcdFx0bmV3IEtleUNvZGVDaG9yZChmYWxzZSwgZmFsc2UsIGZhbHNlLCB0cnVlLCBLZXlDb2RlLlNsYXNoKSxcblx0XHRcdF0pLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdcdTIzMTgsIFx1MjMxOC8nLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb21tYW5kKywgQ29tbWFuZCsvJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjbWQrLCBjbWQrLycsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiB0cnVlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ21ldGErW0NvbW1hXScsICdtZXRhK1tTbGFzaF0nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbCwgbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXlib2FyZEV2ZW50IFNpbmdsZSBNb2RpZmllciBNZXRhTGVmdCsnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHR7XG5cdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0Y3RybEtleTogZmFsc2UsXG5cdFx0XHRcdHNoaWZ0S2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogdHJ1ZSxcblx0XHRcdFx0YWx0R3JhcGhLZXk6IGZhbHNlLFxuXHRcdFx0XHRrZXlDb2RlOiAtMSxcblx0XHRcdFx0Y29kZTogJ01ldGFMZWZ0J1xuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6ICdcdTIzMTgnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb21tYW5kJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjbWQnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbJ21ldGEnXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBTaW5nbGUgTW9kaWZpZXIgTWV0YVJpZ2h0KycsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiBmYWxzZSxcblx0XHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0XHRtZXRhS2V5OiB0cnVlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdGtleUNvZGU6IC0xLFxuXHRcdFx0XHRjb2RlOiAnTWV0YVJpZ2h0J1xuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6ICdcdTIzMTgnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb21tYW5kJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjbWQnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbJ21ldGEnXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBtYXBBbHRHclRvQ3RybEFsdCBBbHRHcitaJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1hcHBlciA9IGF3YWl0IGNyZWF0ZUtleWJvYXJkTWFwcGVyKHRydWUsICdtYWNfZW5fdXMnLCB0cnVlLCBPcGVyYXRpbmdTeXN0ZW0uTWFjaW50b3NoKTtcblxuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IGZhbHNlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogdHJ1ZSxcblx0XHRcdFx0a2V5Q29kZTogLTEsXG5cdFx0XHRcdGNvZGU6ICdLZXlaJ1xuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6ICdcdTIzMDNcdTIzMjVaJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtPcHRpb24rWicsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDdHJsK0FsdCtaJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK2FsdCt6Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrYWx0K1tLZXlaXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgna2V5Ym9hcmRNYXBwZXIgLSBMSU5VWCBkZV9jaCcsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgbWFwcGVyOiBNYWNMaW51eEtleWJvYXJkTWFwcGVyO1xuXG5cdHN1aXRlU2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IF9tYXBwZXIgPSBhd2FpdCBjcmVhdGVLZXlib2FyZE1hcHBlcihmYWxzZSwgJ2xpbnV4X2RlX2NoJywgZmFsc2UsIE9wZXJhdGluZ1N5c3RlbS5MaW51eCk7XG5cdFx0bWFwcGVyID0gX21hcHBlcjtcblx0fSk7XG5cblx0dGVzdCgnbWFwcGluZycsICgpID0+IHtcblx0XHRyZXR1cm4gYXNzZXJ0TWFwcGluZyhXUklURV9GSUxFX0lGX0RJRkZFUkVOVCwgbWFwcGVyLCAnbGludXhfZGVfY2gudHh0Jyk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGFzc2VydEtleWJpbmRpbmdUcmFuc2xhdGlvbihrYjogbnVtYmVyLCBleHBlY3RlZDogc3RyaW5nIHwgc3RyaW5nW10pOiB2b2lkIHtcblx0XHRfYXNzZXJ0S2V5YmluZGluZ1RyYW5zbGF0aW9uKG1hcHBlciwgT3BlcmF0aW5nU3lzdGVtLkxpbnV4LCBrYiwgZXhwZWN0ZWQpO1xuXHR9XG5cblx0ZnVuY3Rpb24gX2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKGs6IG51bWJlciwgZXhwZWN0ZWQ6IElSZXNvbHZlZEtleWJpbmRpbmdbXSk6IHZvaWQge1xuXHRcdGFzc2VydFJlc29sdmVLZXliaW5kaW5nKG1hcHBlciwgZGVjb2RlS2V5YmluZGluZyhrLCBPcGVyYXRpbmdTeXN0ZW0uTGludXgpISwgZXhwZWN0ZWQpO1xuXHR9XG5cblx0dGVzdCgna2IgPT4gaHcnLCAoKSA9PiB7XG5cdFx0Ly8gdW5jaGFuZ2VkXG5cdFx0YXNzZXJ0S2V5YmluZGluZ1RyYW5zbGF0aW9uKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5EaWdpdDEsICdjdHJsK0RpZ2l0MScpO1xuXHRcdGFzc2VydEtleWJpbmRpbmdUcmFuc2xhdGlvbihLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5QiwgJ2N0cmwrS2V5QicpO1xuXHRcdGFzc2VydEtleWJpbmRpbmdUcmFuc2xhdGlvbihLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5QiwgJ2N0cmwrc2hpZnQrS2V5QicpO1xuXHRcdGFzc2VydEtleWJpbmRpbmdUcmFuc2xhdGlvbihLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleU1vZC5BbHQgfCBLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuS2V5QiwgJ2N0cmwrc2hpZnQrYWx0K21ldGErS2V5QicpO1xuXG5cdFx0Ly8gZmxpcHMgWSBhbmQgWlxuXHRcdGFzc2VydEtleWJpbmRpbmdUcmFuc2xhdGlvbihLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5WiwgJ2N0cmwrS2V5WScpO1xuXHRcdGFzc2VydEtleWJpbmRpbmdUcmFuc2xhdGlvbihLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5WSwgJ2N0cmwrS2V5WicpO1xuXG5cdFx0Ly8gQ3RybCsvXG5cdFx0YXNzZXJ0S2V5YmluZGluZ1RyYW5zbGF0aW9uKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5TbGFzaCwgJ2N0cmwrc2hpZnQrRGlnaXQ3Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIEN0cmwrQScsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5QSxcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtBJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtBJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogJ0N0cmwrQScsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCthJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrW0tleUFdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDdHJsK1onLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVosXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrWicsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrWicsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDdHJsK1onLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwreicsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK1tLZXlZXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgQ3RybCtbS2V5WV0nLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHR7XG5cdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0Y3RybEtleTogdHJ1ZSxcblx0XHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0XHRtZXRhS2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0R3JhcGhLZXk6IGZhbHNlLFxuXHRcdFx0XHRrZXlDb2RlOiAtMSxcblx0XHRcdFx0Y29kZTogJ0tleVknXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrWicsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrWicsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDdHJsK1onLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwreicsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK1tLZXlZXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDdHJsK10nLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkJyYWNrZXRSaWdodCxcblx0XHRcdFtdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgQ3RybCtbQnJhY2tldFJpZ2h0XScsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiB0cnVlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdGtleUNvZGU6IC0xLFxuXHRcdFx0XHRjb2RlOiAnQnJhY2tldFJpZ2h0J1xuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6ICdDdHJsK1x1MDBBOCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrXHUwMEE4Jyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK1tCcmFja2V0UmlnaHRdJyxcblx0XHRcdFx0aXNXWVNJV1lHOiBmYWxzZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK1tCcmFja2V0UmlnaHRdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIFNoaWZ0K10nLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5CcmFja2V0UmlnaHQsXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrQWx0KzAnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK0FsdCswJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogJ0N0cmwrQWx0KzAnLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrYWx0KzAnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCthbHQrW0RpZ2l0MF0nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtBbHQrJCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrQWx0KyQnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrYWx0K1tCYWNrc2xhc2hdJyxcblx0XHRcdFx0aXNXWVNJV1lHOiBmYWxzZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK2FsdCtbQmFja3NsYXNoXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ3RybCsvJywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5TbGFzaCxcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtTaGlmdCs3Jyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtTaGlmdCs3Jyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogJ0N0cmwrU2hpZnQrNycsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCtzaGlmdCs3Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrc2hpZnQrW0RpZ2l0N10nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIEN0cmwrU2hpZnQrLycsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuU2xhc2gsXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrU2hpZnQrXFwnJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtTaGlmdCtcXCcnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrc2hpZnQrW01pbnVzXScsXG5cdFx0XHRcdGlzV1lTSVdZRzogZmFsc2UsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtzaGlmdCtbTWludXNdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDdHJsK0sgQ3RybCtcXFxcJywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQmFja3NsYXNoKSxcblx0XHRcdFtdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ3RybCtLIEN0cmwrPScsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkVxdWFsKSxcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtLIEN0cmwrU2hpZnQrMCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrSyBDb250cm9sK1NoaWZ0KzAnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrayBjdHJsK3NoaWZ0KzAnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogdHJ1ZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK1tLZXlLXScsICdjdHJsK3NoaWZ0K1tEaWdpdDBdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGwsIG51bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDdHJsK0Rvd25BcnJvdycsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRG93bkFycm93LFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsK0Rvd25BcnJvdycsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrRG93bkFycm93Jyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogJ0N0cmwrRG93bicsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCtkb3duJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrW0Fycm93RG93bl0nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIEN0cmwrTlVNUEFEXzAnLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLk51bXBhZDAsXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrTnVtUGFkMCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrTnVtUGFkMCcsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCtudW1wYWQwJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrW051bXBhZDBdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDdHJsK0hvbWUnLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkhvbWUsXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrSG9tZScsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrSG9tZScsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDdHJsK0hvbWUnLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwraG9tZScsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK1tIb21lXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgQ3RybCtbSG9tZV0nLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHR7XG5cdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0Y3RybEtleTogdHJ1ZSxcblx0XHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0XHRtZXRhS2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0R3JhcGhLZXk6IGZhbHNlLFxuXHRcdFx0XHRrZXlDb2RlOiAtMSxcblx0XHRcdFx0Y29kZTogJ0hvbWUnXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrSG9tZScsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrSG9tZScsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDdHJsK0hvbWUnLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwraG9tZScsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK1tIb21lXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBDdHJsK1tLZXlYXScsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiB0cnVlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdGtleUNvZGU6IC0xLFxuXHRcdFx0XHRjb2RlOiAnS2V5WCdcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtYJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtYJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogJ0N0cmwrWCcsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCt4Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrW0tleVhdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVVc2VyQmluZGluZyBDdHJsK1tDb21tYV0gQ3RybCsvJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0bWFwcGVyLCBuZXcgS2V5YmluZGluZyhbXG5cdFx0XHRcdG5ldyBTY2FuQ29kZUNob3JkKHRydWUsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIFNjYW5Db2RlLkNvbW1hKSxcblx0XHRcdFx0bmV3IEtleUNvZGVDaG9yZCh0cnVlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBLZXlDb2RlLlNsYXNoKSxcblx0XHRcdF0pLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsKywgQ3RybCtTaGlmdCs3Jyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCssIENvbnRyb2wrU2hpZnQrNycsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCtbQ29tbWFdIGN0cmwrc2hpZnQrNycsXG5cdFx0XHRcdGlzV1lTSVdZRzogZmFsc2UsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogdHJ1ZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK1tDb21tYV0nLCAnY3RybCtzaGlmdCtbRGlnaXQ3XSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsLCBudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgU2luZ2xlIE1vZGlmaWVyIENvbnRyb2xMZWZ0KycsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiB0cnVlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdGtleUNvZGU6IC0xLFxuXHRcdFx0XHRjb2RlOiAnQ29udHJvbExlZnQnXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogWydjdHJsJ10sXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgU2luZ2xlIE1vZGlmaWVyIENvbnRyb2xSaWdodCsnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHR7XG5cdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0Y3RybEtleTogdHJ1ZSxcblx0XHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0XHRtZXRhS2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0R3JhcGhLZXk6IGZhbHNlLFxuXHRcdFx0XHRrZXlDb2RlOiAtMSxcblx0XHRcdFx0Y29kZTogJ0NvbnRyb2xSaWdodCdcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbJ2N0cmwnXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgna2V5Ym9hcmRNYXBwZXIgLSBMSU5VWCBlbl91cycsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgbWFwcGVyOiBNYWNMaW51eEtleWJvYXJkTWFwcGVyO1xuXG5cdHN1aXRlU2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IF9tYXBwZXIgPSBhd2FpdCBjcmVhdGVLZXlib2FyZE1hcHBlcih0cnVlLCAnbGludXhfZW5fdXMnLCBmYWxzZSwgT3BlcmF0aW5nU3lzdGVtLkxpbnV4KTtcblx0XHRtYXBwZXIgPSBfbWFwcGVyO1xuXHR9KTtcblxuXHR0ZXN0KCdtYXBwaW5nJywgKCkgPT4ge1xuXHRcdHJldHVybiBhc3NlcnRNYXBwaW5nKFdSSVRFX0ZJTEVfSUZfRElGRkVSRU5ULCBtYXBwZXIsICdsaW51eF9lbl91cy50eHQnKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gX2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKGs6IG51bWJlciwgZXhwZWN0ZWQ6IElSZXNvbHZlZEtleWJpbmRpbmdbXSk6IHZvaWQge1xuXHRcdGFzc2VydFJlc29sdmVLZXliaW5kaW5nKG1hcHBlciwgZGVjb2RlS2V5YmluZGluZyhrLCBPcGVyYXRpbmdTeXN0ZW0uTGludXgpISwgZXhwZWN0ZWQpO1xuXHR9XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ3RybCtBJywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlBLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsK0EnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK0EnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtBJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK2EnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtbS2V5QV0nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIEN0cmwrWicsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5Wixcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtaJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtaJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogJ0N0cmwrWicsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCt6Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrW0tleVpdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBDdHJsK1tLZXlaXScsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiB0cnVlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdGtleUNvZGU6IC0xLFxuXHRcdFx0XHRjb2RlOiAnS2V5Widcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtaJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtaJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogJ0N0cmwrWicsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCt6Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrW0tleVpdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIEN0cmwrXScsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQnJhY2tldFJpZ2h0LFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsK10nLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK10nLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtdJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK10nLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtbQnJhY2tldFJpZ2h0XSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgQ3RybCtbQnJhY2tldFJpZ2h0XScsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiB0cnVlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdGtleUNvZGU6IC0xLFxuXHRcdFx0XHRjb2RlOiAnQnJhY2tldFJpZ2h0J1xuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6ICdDdHJsK10nLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK10nLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtdJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK10nLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtbQnJhY2tldFJpZ2h0XSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBTaGlmdCtdJywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdEtleU1vZC5TaGlmdCB8IEtleUNvZGUuQnJhY2tldFJpZ2h0LFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdTaGlmdCtdJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnU2hpZnQrXScsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdTaGlmdCtdJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdzaGlmdCtdJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ3NoaWZ0K1tCcmFja2V0UmlnaHRdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDdHJsKy8nLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlNsYXNoLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsKy8nLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sKy8nLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCsvJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsKy8nLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtbU2xhc2hdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDdHJsK1NoaWZ0Ky8nLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlNsYXNoLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsK1NoaWZ0Ky8nLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK1NoaWZ0Ky8nLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtTaGlmdCsvJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK3NoaWZ0Ky8nLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtzaGlmdCtbU2xhc2hdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDdHJsK0sgQ3RybCtcXFxcJywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQmFja3NsYXNoKSxcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtLIEN0cmwrXFxcXCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrSyBDb250cm9sK1xcXFwnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrayBjdHJsK1xcXFwnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogdHJ1ZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK1tLZXlLXScsICdjdHJsK1tCYWNrc2xhc2hdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGwsIG51bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDdHJsK0sgQ3RybCs9JywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRXF1YWwpLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsK0sgQ3RybCs9Jyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtLIENvbnRyb2wrPScsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCtrIGN0cmwrPScsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiB0cnVlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrW0tleUtdJywgJ2N0cmwrW0VxdWFsXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsLCBudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ3RybCtEb3duQXJyb3cnLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkRvd25BcnJvdyxcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtEb3duQXJyb3cnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK0Rvd25BcnJvdycsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDdHJsK0Rvd24nLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrZG93bicsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK1tBcnJvd0Rvd25dJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDdHJsK05VTVBBRF8wJywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5OdW1wYWQwLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsK051bVBhZDAnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK051bVBhZDAnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrbnVtcGFkMCcsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK1tOdW1wYWQwXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ3RybCtIb21lJywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Ib21lLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsK0hvbWUnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK0hvbWUnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtIb21lJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK2hvbWUnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtbSG9tZV0nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXlib2FyZEV2ZW50IEN0cmwrW0hvbWVdJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IHRydWUsXG5cdFx0XHRcdHNoaWZ0S2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogLTEsXG5cdFx0XHRcdGNvZGU6ICdIb21lJ1xuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6ICdDdHJsK0hvbWUnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK0hvbWUnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtIb21lJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK2hvbWUnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtbSG9tZV0nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ3RybCtTaGlmdCssJywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5Db21tYSxcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtTaGlmdCssJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtTaGlmdCssJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogJ0N0cmwrU2hpZnQrLCcsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCtzaGlmdCssJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrc2hpZnQrW0NvbW1hXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH0sIHtcblx0XHRcdFx0bGFiZWw6ICdDdHJsKzwnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sKzwnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrW0ludGxCYWNrc2xhc2hdJyxcblx0XHRcdFx0aXNXWVNJV1lHOiBmYWxzZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK1tJbnRsQmFja3NsYXNoXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzIzMzkzOiByZXNvbHZlS2V5YmluZGluZyBDdHJsK0VudGVyJywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5FbnRlcixcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtFbnRlcicsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrRW50ZXInLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtFbnRlcicsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCtlbnRlcicsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK1tFbnRlcl0nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyMzM5MzogcmVzb2x2ZUtleWJvYXJkRXZlbnQgQ3RybCtbTnVtcGFkRW50ZXJdJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IHRydWUsXG5cdFx0XHRcdHNoaWZ0S2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogLTEsXG5cdFx0XHRcdGNvZGU6ICdOdW1wYWRFbnRlcidcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtFbnRlcicsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrRW50ZXInLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtFbnRlcicsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCtlbnRlcicsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK1tFbnRlcl0nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZVVzZXJCaW5kaW5nIEN0cmwrW0NvbW1hXSBDdHJsKy8nLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRtYXBwZXIsIG5ldyBLZXliaW5kaW5nKFtcblx0XHRcdFx0bmV3IFNjYW5Db2RlQ2hvcmQodHJ1ZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgU2NhbkNvZGUuQ29tbWEpLFxuXHRcdFx0XHRuZXcgS2V5Q29kZUNob3JkKHRydWUsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIEtleUNvZGUuU2xhc2gpLFxuXHRcdFx0XSksXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrLCBDdHJsKy8nLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sKywgQ29udHJvbCsvJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsKywgY3RybCsvJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IHRydWUsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtbQ29tbWFdJywgJ2N0cmwrW1NsYXNoXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsLCBudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZVVzZXJCaW5kaW5nIEN0cmwrW0NvbW1hXScsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdG1hcHBlciwgbmV3IEtleWJpbmRpbmcoW1xuXHRcdFx0XHRuZXcgU2NhbkNvZGVDaG9yZCh0cnVlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBTY2FuQ29kZS5Db21tYSlcblx0XHRcdF0pLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsKywnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sKywnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCssJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsKywnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtbQ29tbWFdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBTaW5nbGUgTW9kaWZpZXIgQ29udHJvbExlZnQrJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IHRydWUsXG5cdFx0XHRcdHNoaWZ0S2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogLTEsXG5cdFx0XHRcdGNvZGU6ICdDb250cm9sTGVmdCdcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbJ2N0cmwnXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBTaW5nbGUgTW9kaWZpZXIgQ29udHJvbFJpZ2h0KycsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiB0cnVlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdGtleUNvZGU6IC0xLFxuXHRcdFx0XHRjb2RlOiAnQ29udHJvbFJpZ2h0J1xuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6ICdDdHJsJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCcsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCcsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFsnY3RybCddLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXlib2FyZEV2ZW50IFNpbmdsZSBNb2RpZmllciBTaGlmdExlZnQrJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IGZhbHNlLFxuXHRcdFx0XHRzaGlmdEtleTogdHJ1ZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogLTEsXG5cdFx0XHRcdGNvZGU6ICdTaGlmdExlZnQnXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ1NoaWZ0Jyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnU2hpZnQnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ3NoaWZ0Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogWydzaGlmdCddLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXlib2FyZEV2ZW50IFNpbmdsZSBNb2RpZmllciBTaGlmdFJpZ2h0KycsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiBmYWxzZSxcblx0XHRcdFx0c2hpZnRLZXk6IHRydWUsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdGtleUNvZGU6IC0xLFxuXHRcdFx0XHRjb2RlOiAnU2hpZnRSaWdodCdcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnU2hpZnQnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdTaGlmdCcsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnc2hpZnQnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbJ3NoaWZ0J10sXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgU2luZ2xlIE1vZGlmaWVyIEFsdExlZnQrJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IGZhbHNlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogdHJ1ZSxcblx0XHRcdFx0bWV0YUtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogLTEsXG5cdFx0XHRcdGNvZGU6ICdBbHRMZWZ0J1xuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6ICdBbHQnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdBbHQnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2FsdCcsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFsnYWx0J10sXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgU2luZ2xlIE1vZGlmaWVyIEFsdFJpZ2h0KycsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiBmYWxzZSxcblx0XHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRLZXk6IHRydWUsXG5cdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdGtleUNvZGU6IC0xLFxuXHRcdFx0XHRjb2RlOiAnQWx0UmlnaHQnXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ0FsdCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0FsdCcsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnYWx0Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogWydhbHQnXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBTaW5nbGUgTW9kaWZpZXIgTWV0YUxlZnQrJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IGZhbHNlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IHRydWUsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogLTEsXG5cdFx0XHRcdGNvZGU6ICdNZXRhTGVmdCdcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnU3VwZXInLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdTdXBlcicsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnbWV0YScsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFsnbWV0YSddLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXlib2FyZEV2ZW50IFNpbmdsZSBNb2RpZmllciBNZXRhUmlnaHQrJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IGZhbHNlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IHRydWUsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogLTEsXG5cdFx0XHRcdGNvZGU6ICdNZXRhUmlnaHQnXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ1N1cGVyJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnU3VwZXInLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ21ldGEnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbJ21ldGEnXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBPbmx5IE1vZGlmaWVycyBDdHJsK1NoaWZ0KycsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiB0cnVlLFxuXHRcdFx0XHRzaGlmdEtleTogdHJ1ZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogLTEsXG5cdFx0XHRcdGNvZGU6ICdTaGlmdExlZnQnXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrU2hpZnQnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK1NoaWZ0Jyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK3NoaWZ0Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXlib2FyZEV2ZW50IG1hcEFsdEdyVG9DdHJsQWx0IEFsdEdyK1onLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbWFwcGVyID0gYXdhaXQgY3JlYXRlS2V5Ym9hcmRNYXBwZXIodHJ1ZSwgJ2xpbnV4X2VuX3VzJywgdHJ1ZSwgT3BlcmF0aW5nU3lzdGVtLkxpbnV4KTtcblxuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IGZhbHNlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogdHJ1ZSxcblx0XHRcdFx0a2V5Q29kZTogLTEsXG5cdFx0XHRcdGNvZGU6ICdLZXlaJ1xuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6ICdDdHJsK0FsdCtaJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtBbHQrWicsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDdHJsK0FsdCtaJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK2FsdCt6Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrYWx0K1tLZXlaXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgna2V5Ym9hcmRNYXBwZXInLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnaXNzdWUgIzIzNzA2OiBMaW51eCBVSyBsYXlvdXQ6IEN0cmwgKyBBcG9zdHJvcGhlIGFsc28gdG9nZ2xlcyB0ZXJtaW5hbCcsICgpID0+IHtcblx0XHRjb25zdCBtYXBwZXIgPSBuZXcgTWFjTGludXhLZXlib2FyZE1hcHBlcihmYWxzZSwge1xuXHRcdFx0J0JhY2txdW90ZSc6IHtcblx0XHRcdFx0J3ZhbHVlJzogJ2AnLFxuXHRcdFx0XHQnd2l0aFNoaWZ0JzogJ1x1MDBBQycsXG5cdFx0XHRcdCd3aXRoQWx0R3InOiAnfCcsXG5cdFx0XHRcdCd3aXRoU2hpZnRBbHRHcic6ICd8J1xuXHRcdFx0fVxuXHRcdH0sIGZhbHNlLCBPcGVyYXRpbmdTeXN0ZW0uTGludXgpO1xuXG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHR7XG5cdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0Y3RybEtleTogdHJ1ZSxcblx0XHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0XHRtZXRhS2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0R3JhcGhLZXk6IGZhbHNlLFxuXHRcdFx0XHRrZXlDb2RlOiAtMSxcblx0XHRcdFx0Y29kZTogJ0JhY2txdW90ZSdcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtgJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtgJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK2AnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtbQmFja3F1b3RlXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMjQwNjQ6IE51bUxvY2svTnVtUGFkIGtleXMgc3RvcHBlZCB3b3JraW5nIGluIDEuMTEgb24gTGludXgnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbWFwcGVyID0gbmV3IE1hY0xpbnV4S2V5Ym9hcmRNYXBwZXIoZmFsc2UsIHt9LCBmYWxzZSwgT3BlcmF0aW5nU3lzdGVtLkxpbnV4KTtcblxuXHRcdGZ1bmN0aW9uIGFzc2VydE51bXBhZEtleWJvYXJkRXZlbnQoa2V5Q29kZTogS2V5Q29kZSwgY29kZTogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCBlbGVjdHJvbkFjY2VsZXJhdG9yOiBzdHJpbmcgfCBudWxsLCB1c2VyU2V0dGluZ3NMYWJlbDogc3RyaW5nLCBkaXNwYXRjaDogc3RyaW5nKTogdm9pZCB7XG5cdFx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdFx0bWFwcGVyLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRcdGN0cmxLZXk6IGZhbHNlLFxuXHRcdFx0XHRcdHNoaWZ0S2V5OiBmYWxzZSxcblx0XHRcdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0XHRrZXlDb2RlOiBrZXlDb2RlLFxuXHRcdFx0XHRcdGNvZGU6IGNvZGVcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBsYWJlbCxcblx0XHRcdFx0XHRhcmlhTGFiZWw6IGxhYmVsLFxuXHRcdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IGVsZWN0cm9uQWNjZWxlcmF0b3IsXG5cdFx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6IHVzZXJTZXR0aW5nc0xhYmVsLFxuXHRcdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRcdGRpc3BhdGNoUGFydHM6IFtkaXNwYXRjaF0sXG5cdFx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0TnVtcGFkS2V5Ym9hcmRFdmVudChLZXlDb2RlLkVuZCwgJ051bXBhZDEnLCAnRW5kJywgJ0VuZCcsICdlbmQnLCAnW0VuZF0nKTtcblx0XHRhc3NlcnROdW1wYWRLZXlib2FyZEV2ZW50KEtleUNvZGUuRG93bkFycm93LCAnTnVtcGFkMicsICdEb3duQXJyb3cnLCAnRG93bicsICdkb3duJywgJ1tBcnJvd0Rvd25dJyk7XG5cdFx0YXNzZXJ0TnVtcGFkS2V5Ym9hcmRFdmVudChLZXlDb2RlLlBhZ2VEb3duLCAnTnVtcGFkMycsICdQYWdlRG93bicsICdQYWdlRG93bicsICdwYWdlZG93bicsICdbUGFnZURvd25dJyk7XG5cdFx0YXNzZXJ0TnVtcGFkS2V5Ym9hcmRFdmVudChLZXlDb2RlLkxlZnRBcnJvdywgJ051bXBhZDQnLCAnTGVmdEFycm93JywgJ0xlZnQnLCAnbGVmdCcsICdbQXJyb3dMZWZ0XScpO1xuXHRcdGFzc2VydE51bXBhZEtleWJvYXJkRXZlbnQoS2V5Q29kZS5Vbmtub3duLCAnTnVtcGFkNScsICdOdW1QYWQ1JywgbnVsbCwgJ251bXBhZDUnLCAnW051bXBhZDVdJyk7XG5cdFx0YXNzZXJ0TnVtcGFkS2V5Ym9hcmRFdmVudChLZXlDb2RlLlJpZ2h0QXJyb3csICdOdW1wYWQ2JywgJ1JpZ2h0QXJyb3cnLCAnUmlnaHQnLCAncmlnaHQnLCAnW0Fycm93UmlnaHRdJyk7XG5cdFx0YXNzZXJ0TnVtcGFkS2V5Ym9hcmRFdmVudChLZXlDb2RlLkhvbWUsICdOdW1wYWQ3JywgJ0hvbWUnLCAnSG9tZScsICdob21lJywgJ1tIb21lXScpO1xuXHRcdGFzc2VydE51bXBhZEtleWJvYXJkRXZlbnQoS2V5Q29kZS5VcEFycm93LCAnTnVtcGFkOCcsICdVcEFycm93JywgJ1VwJywgJ3VwJywgJ1tBcnJvd1VwXScpO1xuXHRcdGFzc2VydE51bXBhZEtleWJvYXJkRXZlbnQoS2V5Q29kZS5QYWdlVXAsICdOdW1wYWQ5JywgJ1BhZ2VVcCcsICdQYWdlVXAnLCAncGFnZXVwJywgJ1tQYWdlVXBdJyk7XG5cdFx0YXNzZXJ0TnVtcGFkS2V5Ym9hcmRFdmVudChLZXlDb2RlLkluc2VydCwgJ051bXBhZDAnLCAnSW5zZXJ0JywgJ0luc2VydCcsICdpbnNlcnQnLCAnW0luc2VydF0nKTtcblx0XHRhc3NlcnROdW1wYWRLZXlib2FyZEV2ZW50KEtleUNvZGUuRGVsZXRlLCAnTnVtcGFkRGVjaW1hbCcsICdEZWxldGUnLCAnRGVsZXRlJywgJ2RlbGV0ZScsICdbRGVsZXRlXScpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMjQxMDc6IERlbGV0ZSwgSW5zZXJ0LCBIb21lLCBFbmQsIFBnVXAsIFBnRG4sIGFuZCBhcnJvdyBrZXlzIG5vIGxvbmdlciB3b3JrIGVkaXRvciBpbiAxLjExJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1hcHBlciA9IG5ldyBNYWNMaW51eEtleWJvYXJkTWFwcGVyKGZhbHNlLCB7fSwgZmFsc2UsIE9wZXJhdGluZ1N5c3RlbS5MaW51eCk7XG5cblx0XHRmdW5jdGlvbiBhc3NlcnRLZXlib2FyZEV2ZW50KGtleUNvZGU6IEtleUNvZGUsIGNvZGU6IHN0cmluZywgbGFiZWw6IHN0cmluZywgZWxlY3Ryb25BY2NlbGVyYXRvcjogc3RyaW5nLCB1c2VyU2V0dGluZ3NMYWJlbDogc3RyaW5nLCBkaXNwYXRjaDogc3RyaW5nKTogdm9pZCB7XG5cdFx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdFx0bWFwcGVyLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRcdGN0cmxLZXk6IGZhbHNlLFxuXHRcdFx0XHRcdHNoaWZ0S2V5OiBmYWxzZSxcblx0XHRcdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0XHRrZXlDb2RlOiBrZXlDb2RlLFxuXHRcdFx0XHRcdGNvZGU6IGNvZGVcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBsYWJlbCxcblx0XHRcdFx0XHRhcmlhTGFiZWw6IGxhYmVsLFxuXHRcdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IGVsZWN0cm9uQWNjZWxlcmF0b3IsXG5cdFx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6IHVzZXJTZXR0aW5nc0xhYmVsLFxuXHRcdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRcdGRpc3BhdGNoUGFydHM6IFtkaXNwYXRjaF0sXG5cdFx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzI0MTA3I2lzc3VlY29tbWVudC0yOTIzMTg0OTdcblx0XHRhc3NlcnRLZXlib2FyZEV2ZW50KEtleUNvZGUuVXBBcnJvdywgJ0xhbmczJywgJ1VwQXJyb3cnLCAnVXAnLCAndXAnLCAnW0Fycm93VXBdJyk7XG5cdFx0YXNzZXJ0S2V5Ym9hcmRFdmVudChLZXlDb2RlLkRvd25BcnJvdywgJ051bXBhZEVudGVyJywgJ0Rvd25BcnJvdycsICdEb3duJywgJ2Rvd24nLCAnW0Fycm93RG93bl0nKTtcblx0XHRhc3NlcnRLZXlib2FyZEV2ZW50KEtleUNvZGUuTGVmdEFycm93LCAnQ29udmVydCcsICdMZWZ0QXJyb3cnLCAnTGVmdCcsICdsZWZ0JywgJ1tBcnJvd0xlZnRdJyk7XG5cdFx0YXNzZXJ0S2V5Ym9hcmRFdmVudChLZXlDb2RlLlJpZ2h0QXJyb3csICdOb25Db252ZXJ0JywgJ1JpZ2h0QXJyb3cnLCAnUmlnaHQnLCAncmlnaHQnLCAnW0Fycm93UmlnaHRdJyk7XG5cdFx0YXNzZXJ0S2V5Ym9hcmRFdmVudChLZXlDb2RlLkRlbGV0ZSwgJ1ByaW50U2NyZWVuJywgJ0RlbGV0ZScsICdEZWxldGUnLCAnZGVsZXRlJywgJ1tEZWxldGVdJyk7XG5cdFx0YXNzZXJ0S2V5Ym9hcmRFdmVudChLZXlDb2RlLkluc2VydCwgJ051bXBhZERpdmlkZScsICdJbnNlcnQnLCAnSW5zZXJ0JywgJ2luc2VydCcsICdbSW5zZXJ0XScpO1xuXHRcdGFzc2VydEtleWJvYXJkRXZlbnQoS2V5Q29kZS5FbmQsICdVbmtub3duJywgJ0VuZCcsICdFbmQnLCAnZW5kJywgJ1tFbmRdJyk7XG5cdFx0YXNzZXJ0S2V5Ym9hcmRFdmVudChLZXlDb2RlLkhvbWUsICdJbnRsUm8nLCAnSG9tZScsICdIb21lJywgJ2hvbWUnLCAnW0hvbWVdJyk7XG5cdFx0YXNzZXJ0S2V5Ym9hcmRFdmVudChLZXlDb2RlLlBhZ2VEb3duLCAnQ29udHJvbFJpZ2h0JywgJ1BhZ2VEb3duJywgJ1BhZ2VEb3duJywgJ3BhZ2Vkb3duJywgJ1tQYWdlRG93bl0nKTtcblx0XHRhc3NlcnRLZXlib2FyZEV2ZW50KEtleUNvZGUuUGFnZVVwLCAnTGFuZzQnLCAnUGFnZVVwJywgJ1BhZ2VVcCcsICdwYWdldXAnLCAnW1BhZ2VVcF0nKTtcblxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8yNDEwNyNpc3N1ZWNvbW1lbnQtMjkyMzIzOTI0XG5cdFx0YXNzZXJ0S2V5Ym9hcmRFdmVudChLZXlDb2RlLlBhZ2VEb3duLCAnQ29udHJvbFJpZ2h0JywgJ1BhZ2VEb3duJywgJ1BhZ2VEb3duJywgJ3BhZ2Vkb3duJywgJ1tQYWdlRG93bl0nKTtcblx0XHRhc3NlcnRLZXlib2FyZEV2ZW50KEtleUNvZGUuUGFnZVVwLCAnTGFuZzQnLCAnUGFnZVVwJywgJ1BhZ2VVcCcsICdwYWdldXAnLCAnW1BhZ2VVcF0nKTtcblx0XHRhc3NlcnRLZXlib2FyZEV2ZW50KEtleUNvZGUuRW5kLCAnJywgJ0VuZCcsICdFbmQnLCAnZW5kJywgJ1tFbmRdJyk7XG5cdFx0YXNzZXJ0S2V5Ym9hcmRFdmVudChLZXlDb2RlLkhvbWUsICdJbnRsUm8nLCAnSG9tZScsICdIb21lJywgJ2hvbWUnLCAnW0hvbWVdJyk7XG5cdFx0YXNzZXJ0S2V5Ym9hcmRFdmVudChLZXlDb2RlLkRlbGV0ZSwgJ1ByaW50U2NyZWVuJywgJ0RlbGV0ZScsICdEZWxldGUnLCAnZGVsZXRlJywgJ1tEZWxldGVdJyk7XG5cdFx0YXNzZXJ0S2V5Ym9hcmRFdmVudChLZXlDb2RlLkluc2VydCwgJ051bXBhZERpdmlkZScsICdJbnNlcnQnLCAnSW5zZXJ0JywgJ2luc2VydCcsICdbSW5zZXJ0XScpO1xuXHRcdGFzc2VydEtleWJvYXJkRXZlbnQoS2V5Q29kZS5SaWdodEFycm93LCAnTm9uQ29udmVydCcsICdSaWdodEFycm93JywgJ1JpZ2h0JywgJ3JpZ2h0JywgJ1tBcnJvd1JpZ2h0XScpO1xuXHRcdGFzc2VydEtleWJvYXJkRXZlbnQoS2V5Q29kZS5MZWZ0QXJyb3csICdDb252ZXJ0JywgJ0xlZnRBcnJvdycsICdMZWZ0JywgJ2xlZnQnLCAnW0Fycm93TGVmdF0nKTtcblx0XHRhc3NlcnRLZXlib2FyZEV2ZW50KEtleUNvZGUuRG93bkFycm93LCAnTnVtcGFkRW50ZXInLCAnRG93bkFycm93JywgJ0Rvd24nLCAnZG93bicsICdbQXJyb3dEb3duXScpO1xuXHRcdGFzc2VydEtleWJvYXJkRXZlbnQoS2V5Q29kZS5VcEFycm93LCAnTGFuZzMnLCAnVXBBcnJvdycsICdVcCcsICd1cCcsICdbQXJyb3dVcF0nKTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ2tleWJvYXJkTWFwcGVyIC0gTElOVVggcnUnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IG1hcHBlcjogTWFjTGludXhLZXlib2FyZE1hcHBlcjtcblxuXHRzdWl0ZVNldHVwKGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBfbWFwcGVyID0gYXdhaXQgY3JlYXRlS2V5Ym9hcmRNYXBwZXIoZmFsc2UsICdsaW51eF9ydScsIGZhbHNlLCBPcGVyYXRpbmdTeXN0ZW0uTGludXgpO1xuXHRcdG1hcHBlciA9IF9tYXBwZXI7XG5cdH0pO1xuXG5cdHRlc3QoJ21hcHBpbmcnLCAoKSA9PiB7XG5cdFx0cmV0dXJuIGFzc2VydE1hcHBpbmcoV1JJVEVfRklMRV9JRl9ESUZGRVJFTlQsIG1hcHBlciwgJ2xpbnV4X3J1LnR4dCcpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoazogbnVtYmVyLCBleHBlY3RlZDogSVJlc29sdmVkS2V5YmluZGluZ1tdKTogdm9pZCB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcobWFwcGVyLCBkZWNvZGVLZXliaW5kaW5nKGssIE9wZXJhdGluZ1N5c3RlbS5MaW51eCkhLCBleHBlY3RlZCk7XG5cdH1cblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDdHJsK1MnLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVMsXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrUycsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrUycsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDdHJsK1MnLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrcycsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK1tLZXlTXSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ2tleWJvYXJkTWFwcGVyIC0gTElOVVggZW5fdWsnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IG1hcHBlcjogTWFjTGludXhLZXlib2FyZE1hcHBlcjtcblxuXHRzdWl0ZVNldHVwKGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBfbWFwcGVyID0gYXdhaXQgY3JlYXRlS2V5Ym9hcmRNYXBwZXIoZmFsc2UsICdsaW51eF9lbl91aycsIGZhbHNlLCBPcGVyYXRpbmdTeXN0ZW0uTGludXgpO1xuXHRcdG1hcHBlciA9IF9tYXBwZXI7XG5cdH0pO1xuXG5cdHRlc3QoJ21hcHBpbmcnLCAoKSA9PiB7XG5cdFx0cmV0dXJuIGFzc2VydE1hcHBpbmcoV1JJVEVfRklMRV9JRl9ESUZGRVJFTlQsIG1hcHBlciwgJ2xpbnV4X2VuX3VrLnR4dCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMjQ1MjI6IHJlc29sdmVLZXlib2FyZEV2ZW50IEN0cmwrQWx0K1tNaW51c10nLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHR7XG5cdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0Y3RybEtleTogdHJ1ZSxcblx0XHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRLZXk6IHRydWUsXG5cdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdGtleUNvZGU6IC0xLFxuXHRcdFx0XHRjb2RlOiAnTWludXMnXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrQWx0Ky0nLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK0FsdCstJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK2FsdCtbTWludXNdJyxcblx0XHRcdFx0aXNXWVNJV1lHOiBmYWxzZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK2FsdCtbTWludXNdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdrZXlib2FyZE1hcHBlciAtIE1BQyB6aF9oYW50JywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGxldCBtYXBwZXI6IE1hY0xpbnV4S2V5Ym9hcmRNYXBwZXI7XG5cblx0c3VpdGVTZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgX21hcHBlciA9IGF3YWl0IGNyZWF0ZUtleWJvYXJkTWFwcGVyKGZhbHNlLCAnbWFjX3poX2hhbnQnLCBmYWxzZSwgT3BlcmF0aW5nU3lzdGVtLk1hY2ludG9zaCk7XG5cdFx0bWFwcGVyID0gX21hcHBlcjtcblx0fSk7XG5cblx0dGVzdCgnbWFwcGluZycsICgpID0+IHtcblx0XHRyZXR1cm4gYXNzZXJ0TWFwcGluZyhXUklURV9GSUxFX0lGX0RJRkZFUkVOVCwgbWFwcGVyLCAnbWFjX3poX2hhbnQudHh0Jyk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhrOiBudW1iZXIsIGV4cGVjdGVkOiBJUmVzb2x2ZWRLZXliaW5kaW5nW10pOiB2b2lkIHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5YmluZGluZyhtYXBwZXIsIGRlY29kZUtleWJpbmRpbmcoaywgT3BlcmF0aW5nU3lzdGVtLk1hY2ludG9zaCkhLCBleHBlY3RlZCk7XG5cdH1cblxuXHR0ZXN0KCdpc3N1ZSAjMjgyMzcgcmVzb2x2ZUtleWJpbmRpbmcgQ21kK0MnLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUMsXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ1x1MjMxOEMnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb21tYW5kK0MnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ21kK0MnLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2NtZCtjJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ21ldGErW0tleUNdJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgna2V5Ym9hcmRNYXBwZXIgLSBNQUMgemhfaGFudDInLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IG1hcHBlcjogTWFjTGludXhLZXlib2FyZE1hcHBlcjtcblxuXHRzdWl0ZVNldHVwKGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBfbWFwcGVyID0gYXdhaXQgY3JlYXRlS2V5Ym9hcmRNYXBwZXIoZmFsc2UsICdtYWNfemhfaGFudDInLCBmYWxzZSwgT3BlcmF0aW5nU3lzdGVtLk1hY2ludG9zaCk7XG5cdFx0bWFwcGVyID0gX21hcHBlcjtcblx0fSk7XG5cblx0dGVzdCgnbWFwcGluZycsICgpID0+IHtcblx0XHRyZXR1cm4gYXNzZXJ0TWFwcGluZyhXUklURV9GSUxFX0lGX0RJRkZFUkVOVCwgbWFwcGVyLCAnbWFjX3poX2hhbnQyLnR4dCcpO1xuXHR9KTtcbn0pO1xuXG5mdW5jdGlvbiBfYXNzZXJ0S2V5YmluZGluZ1RyYW5zbGF0aW9uKG1hcHBlcjogTWFjTGludXhLZXlib2FyZE1hcHBlciwgT1M6IE9wZXJhdGluZ1N5c3RlbSwga2I6IG51bWJlciwgX2V4cGVjdGVkOiBzdHJpbmcgfCBzdHJpbmdbXSk6IHZvaWQge1xuXHRsZXQgZXhwZWN0ZWQ6IHN0cmluZ1tdO1xuXHRpZiAodHlwZW9mIF9leHBlY3RlZCA9PT0gJ3N0cmluZycpIHtcblx0XHRleHBlY3RlZCA9IFtfZXhwZWN0ZWRdO1xuXHR9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoX2V4cGVjdGVkKSkge1xuXHRcdGV4cGVjdGVkID0gX2V4cGVjdGVkO1xuXHR9IGVsc2Uge1xuXHRcdGV4cGVjdGVkID0gW107XG5cdH1cblxuXHRjb25zdCBydW50aW1lS2V5YmluZGluZyA9IGNyZWF0ZVNpbXBsZUtleWJpbmRpbmcoa2IsIE9TKTtcblxuXHRjb25zdCBrZXliaW5kaW5nTGFiZWwgPSBuZXcgVVNMYXlvdXRSZXNvbHZlZEtleWJpbmRpbmcoW3J1bnRpbWVLZXliaW5kaW5nXSwgT1MpLmdldFVzZXJTZXR0aW5nc0xhYmVsKCk7XG5cblx0Y29uc3QgYWN0dWFsSGFyZHdhcmVLZXlwcmVzc2VzID0gbWFwcGVyLmtleUNvZGVDaG9yZFRvU2NhbkNvZGVDaG9yZChydW50aW1lS2V5YmluZGluZyk7XG5cdGlmIChhY3R1YWxIYXJkd2FyZUtleXByZXNzZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbXSwgZXhwZWN0ZWQsIGBzaW1wbGVLZXliaW5kaW5nVG9IYXJkd2FyZUtleXByZXNzIC0tIFwiJHtrZXliaW5kaW5nTGFiZWx9XCIgLS0gYWN0dWFsOiBcIltdXCIgLS0gZXhwZWN0ZWQ6IFwiJHtleHBlY3RlZH1cImApO1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IGFjdHVhbCA9IGFjdHVhbEhhcmR3YXJlS2V5cHJlc3Nlc1xuXHRcdC5tYXAoayA9PiBVc2VyU2V0dGluZ3NMYWJlbFByb3ZpZGVyLnRvTGFiZWwoT1MsIFtrXSwgKGtleWJpbmRpbmcpID0+IFNjYW5Db2RlVXRpbHMudG9TdHJpbmcoa2V5YmluZGluZy5zY2FuQ29kZSkpKTtcblx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBgc2ltcGxlS2V5YmluZGluZ1RvSGFyZHdhcmVLZXlwcmVzcyAtLSBcIiR7a2V5YmluZGluZ0xhYmVsfVwiIC0tIGFjdHVhbDogXCIke2FjdHVhbH1cIiAtLSBleHBlY3RlZDogXCIke2V4cGVjdGVkfVwiYCk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFP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
