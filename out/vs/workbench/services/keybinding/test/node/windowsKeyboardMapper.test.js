import { KeyChord, KeyCode, KeyMod, ScanCode } from "../../../../../base/common/keyCodes.js";
import { KeyCodeChord, decodeKeybinding, ScanCodeChord, Keybinding } from "../../../../../base/common/keybindings.js";
import { OperatingSystem } from "../../../../../base/common/platform.js";
import { WindowsKeyboardMapper } from "../../common/windowsKeyboardMapper.js";
import { assertMapping, assertResolveKeyboardEvent, assertResolveKeybinding, readRawMapping } from "./keyboardMapperTestUtils.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
const WRITE_FILE_IF_DIFFERENT = false;
async function createKeyboardMapper(isUSStandard, file, mapAltGrToCtrlAlt) {
  const rawMappings = await readRawMapping(file);
  return new WindowsKeyboardMapper(isUSStandard, rawMappings, mapAltGrToCtrlAlt);
}
function _assertResolveKeybinding(mapper, k, expected) {
  const keyBinding = decodeKeybinding(k, OperatingSystem.Windows);
  assertResolveKeybinding(mapper, keyBinding, expected);
}
suite("keyboardMapper - WINDOWS de_ch", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let mapper;
  suiteSetup(async () => {
    mapper = await createKeyboardMapper(false, "win_de_ch", false);
  });
  test("mapping", () => {
    return assertMapping(WRITE_FILE_IF_DIFFERENT, mapper, "win_de_ch.txt");
  });
  test("resolveKeybinding Ctrl+A", () => {
    _assertResolveKeybinding(
      mapper,
      KeyMod.CtrlCmd | KeyCode.KeyA,
      [{
        label: "Ctrl+A",
        ariaLabel: "Control+A",
        electronAccelerator: "Ctrl+A",
        userSettingsLabel: "ctrl+a",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+A"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+Z", () => {
    _assertResolveKeybinding(
      mapper,
      KeyMod.CtrlCmd | KeyCode.KeyZ,
      [{
        label: "Ctrl+Z",
        ariaLabel: "Control+Z",
        electronAccelerator: "Ctrl+Z",
        userSettingsLabel: "ctrl+z",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+Z"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeyboardEvent Ctrl+Z", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: KeyCode.KeyZ,
        code: null
      },
      {
        label: "Ctrl+Z",
        ariaLabel: "Control+Z",
        electronAccelerator: "Ctrl+Z",
        userSettingsLabel: "ctrl+z",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+Z"],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("resolveKeybinding Ctrl+]", () => {
    _assertResolveKeybinding(
      mapper,
      KeyMod.CtrlCmd | KeyCode.BracketRight,
      [{
        label: "Ctrl+^",
        ariaLabel: "Control+^",
        electronAccelerator: "Ctrl+]",
        userSettingsLabel: "ctrl+oem_6",
        isWYSIWYG: false,
        isMultiChord: false,
        dispatchParts: ["ctrl+]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeyboardEvent Ctrl+]", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: KeyCode.BracketRight,
        code: null
      },
      {
        label: "Ctrl+^",
        ariaLabel: "Control+^",
        electronAccelerator: "Ctrl+]",
        userSettingsLabel: "ctrl+oem_6",
        isWYSIWYG: false,
        isMultiChord: false,
        dispatchParts: ["ctrl+]"],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("resolveKeybinding Shift+]", () => {
    _assertResolveKeybinding(
      mapper,
      KeyMod.Shift | KeyCode.BracketRight,
      [{
        label: "Shift+^",
        ariaLabel: "Shift+^",
        electronAccelerator: "Shift+]",
        userSettingsLabel: "shift+oem_6",
        isWYSIWYG: false,
        isMultiChord: false,
        dispatchParts: ["shift+]"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+/", () => {
    _assertResolveKeybinding(
      mapper,
      KeyMod.CtrlCmd | KeyCode.Slash,
      [{
        label: "Ctrl+\xA7",
        ariaLabel: "Control+\xA7",
        electronAccelerator: "Ctrl+/",
        userSettingsLabel: "ctrl+oem_2",
        isWYSIWYG: false,
        isMultiChord: false,
        dispatchParts: ["ctrl+/"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+Shift+/", () => {
    _assertResolveKeybinding(
      mapper,
      KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Slash,
      [{
        label: "Ctrl+Shift+\xA7",
        ariaLabel: "Control+Shift+\xA7",
        electronAccelerator: "Ctrl+Shift+/",
        userSettingsLabel: "ctrl+shift+oem_2",
        isWYSIWYG: false,
        isMultiChord: false,
        dispatchParts: ["ctrl+shift+/"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+K Ctrl+\\", () => {
    _assertResolveKeybinding(
      mapper,
      KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Backslash),
      [{
        label: "Ctrl+K Ctrl+\xE4",
        ariaLabel: "Control+K Control+\xE4",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+k ctrl+oem_5",
        isWYSIWYG: false,
        isMultiChord: true,
        dispatchParts: ["ctrl+K", "ctrl+\\"],
        singleModifierDispatchParts: [null, null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+K Ctrl+=", () => {
    _assertResolveKeybinding(
      mapper,
      KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Equal),
      []
    );
  });
  test("resolveKeybinding Ctrl+DownArrow", () => {
    _assertResolveKeybinding(
      mapper,
      KeyMod.CtrlCmd | KeyCode.DownArrow,
      [{
        label: "Ctrl+DownArrow",
        ariaLabel: "Control+DownArrow",
        electronAccelerator: "Ctrl+Down",
        userSettingsLabel: "ctrl+down",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+DownArrow"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+NUMPAD_0", () => {
    _assertResolveKeybinding(
      mapper,
      KeyMod.CtrlCmd | KeyCode.Numpad0,
      [{
        label: "Ctrl+NumPad0",
        ariaLabel: "Control+NumPad0",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+numpad0",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+NumPad0"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Ctrl+Home", () => {
    _assertResolveKeybinding(
      mapper,
      KeyMod.CtrlCmd | KeyCode.Home,
      [{
        label: "Ctrl+Home",
        ariaLabel: "Control+Home",
        electronAccelerator: "Ctrl+Home",
        userSettingsLabel: "ctrl+home",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+Home"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeyboardEvent Ctrl+Home", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: KeyCode.Home,
        code: null
      },
      {
        label: "Ctrl+Home",
        ariaLabel: "Control+Home",
        electronAccelerator: "Ctrl+Home",
        userSettingsLabel: "ctrl+home",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+Home"],
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
        label: "Ctrl+, Ctrl+\xA7",
        ariaLabel: "Control+, Control+\xA7",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+oem_comma ctrl+oem_2",
        isWYSIWYG: false,
        isMultiChord: true,
        dispatchParts: ["ctrl+,", "ctrl+/"],
        singleModifierDispatchParts: [null, null]
      }]
    );
  });
  test("resolveKeyboardEvent Single Modifier Ctrl+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: KeyCode.Ctrl,
        code: null
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
suite("keyboardMapper - WINDOWS en_us", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let mapper;
  suiteSetup(async () => {
    mapper = await createKeyboardMapper(true, "win_en_us", false);
  });
  test("mapping", () => {
    return assertMapping(WRITE_FILE_IF_DIFFERENT, mapper, "win_en_us.txt");
  });
  test("resolveKeybinding Ctrl+K Ctrl+\\", () => {
    _assertResolveKeybinding(
      mapper,
      KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Backslash),
      [{
        label: "Ctrl+K Ctrl+\\",
        ariaLabel: "Control+K Control+\\",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+k ctrl+\\",
        isWYSIWYG: true,
        isMultiChord: true,
        dispatchParts: ["ctrl+K", "ctrl+\\"],
        singleModifierDispatchParts: [null, null]
      }]
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
        dispatchParts: ["ctrl+,", "ctrl+/"],
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
        dispatchParts: ["ctrl+,"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeyboardEvent Single Modifier Ctrl+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: KeyCode.Ctrl,
        code: null
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
  test("resolveKeyboardEvent Single Modifier Shift+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: KeyCode.Shift,
        code: null
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
  test("resolveKeyboardEvent Single Modifier Alt+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: true,
        metaKey: false,
        altGraphKey: false,
        keyCode: KeyCode.Alt,
        code: null
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
  test("resolveKeyboardEvent Single Modifier Meta+", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: true,
        altGraphKey: false,
        keyCode: KeyCode.Meta,
        code: null
      },
      {
        label: "Windows",
        ariaLabel: "Windows",
        electronAccelerator: null,
        userSettingsLabel: "win",
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
        keyCode: KeyCode.Shift,
        code: null
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
    const mapper2 = await createKeyboardMapper(true, "win_en_us", true);
    assertResolveKeyboardEvent(
      mapper2,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: true,
        keyCode: KeyCode.KeyZ,
        code: null
      },
      {
        label: "Ctrl+Alt+Z",
        ariaLabel: "Control+Alt+Z",
        electronAccelerator: "Ctrl+Alt+Z",
        userSettingsLabel: "ctrl+alt+z",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+alt+Z"],
        singleModifierDispatchParts: [null]
      }
    );
  });
});
suite("keyboardMapper - WINDOWS por_ptb", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let mapper;
  suiteSetup(async () => {
    mapper = await createKeyboardMapper(false, "win_por_ptb", false);
  });
  test("mapping", () => {
    return assertMapping(WRITE_FILE_IF_DIFFERENT, mapper, "win_por_ptb.txt");
  });
  test("resolveKeyboardEvent Ctrl+[IntlRo]", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: KeyCode.ABNT_C1,
        code: null
      },
      {
        label: "Ctrl+/",
        ariaLabel: "Control+/",
        electronAccelerator: "Ctrl+ABNT_C1",
        userSettingsLabel: "ctrl+abnt_c1",
        isWYSIWYG: false,
        isMultiChord: false,
        dispatchParts: ["ctrl+ABNT_C1"],
        singleModifierDispatchParts: [null]
      }
    );
  });
  test("resolveKeyboardEvent Ctrl+[NumpadComma]", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        altGraphKey: false,
        keyCode: KeyCode.ABNT_C2,
        code: null
      },
      {
        label: "Ctrl+.",
        ariaLabel: "Control+.",
        electronAccelerator: "Ctrl+ABNT_C2",
        userSettingsLabel: "ctrl+abnt_c2",
        isWYSIWYG: false,
        isMultiChord: false,
        dispatchParts: ["ctrl+ABNT_C2"],
        singleModifierDispatchParts: [null]
      }
    );
  });
});
suite("keyboardMapper - WINDOWS ru", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let mapper;
  suiteSetup(async () => {
    mapper = await createKeyboardMapper(false, "win_ru", false);
  });
  test("mapping", () => {
    return assertMapping(WRITE_FILE_IF_DIFFERENT, mapper, "win_ru.txt");
  });
  test("issue ##24361: resolveKeybinding Ctrl+K Ctrl+K", () => {
    _assertResolveKeybinding(
      mapper,
      KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyK),
      [{
        label: "Ctrl+K Ctrl+K",
        ariaLabel: "Control+K Control+K",
        electronAccelerator: null,
        userSettingsLabel: "ctrl+k ctrl+k",
        isWYSIWYG: true,
        isMultiChord: true,
        dispatchParts: ["ctrl+K", "ctrl+K"],
        singleModifierDispatchParts: [null, null]
      }]
    );
  });
});
suite("keyboardMapper - misc", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("issue #23513: Toggle Sidebar Visibility and Go to Line display same key mapping in Arabic keyboard", () => {
    const mapper = new WindowsKeyboardMapper(false, {
      "KeyB": {
        "vkey": "VK_B",
        "value": "\u0644\u0627",
        "withShift": "\u0644\u0622",
        "withAltGr": "",
        "withShiftAltGr": ""
      },
      "KeyG": {
        "vkey": "VK_G",
        "value": "\u0644",
        "withShift": "\u0644\u0623",
        "withAltGr": "",
        "withShiftAltGr": ""
      }
    }, false);
    _assertResolveKeybinding(
      mapper,
      KeyMod.CtrlCmd | KeyCode.KeyB,
      [{
        label: "Ctrl+B",
        ariaLabel: "Control+B",
        electronAccelerator: "Ctrl+B",
        userSettingsLabel: "ctrl+b",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["ctrl+B"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMva2V5YmluZGluZy90ZXN0L25vZGUvd2luZG93c0tleWJvYXJkTWFwcGVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBLZXlDaG9yZCwgS2V5Q29kZSwgS2V5TW9kLCBTY2FuQ29kZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IEtleUNvZGVDaG9yZCwgZGVjb2RlS2V5YmluZGluZywgU2NhbkNvZGVDaG9yZCwgS2V5YmluZGluZyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleWJpbmRpbmdzLmpzJztcbmltcG9ydCB7IE9wZXJhdGluZ1N5c3RlbSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFdpbmRvd3NLZXlib2FyZE1hcHBlciB9IGZyb20gJy4uLy4uL2NvbW1vbi93aW5kb3dzS2V5Ym9hcmRNYXBwZXIuanMnO1xuaW1wb3J0IHsgSVJlc29sdmVkS2V5YmluZGluZywgYXNzZXJ0TWFwcGluZywgYXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQsIGFzc2VydFJlc29sdmVLZXliaW5kaW5nLCByZWFkUmF3TWFwcGluZyB9IGZyb20gJy4va2V5Ym9hcmRNYXBwZXJUZXN0VXRpbHMuanMnO1xuaW1wb3J0IHsgSVdpbmRvd3NLZXlib2FyZE1hcHBpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXlib2FyZExheW91dC9jb21tb24va2V5Ym9hcmRMYXlvdXQuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbmNvbnN0IFdSSVRFX0ZJTEVfSUZfRElGRkVSRU5UID0gZmFsc2U7XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUtleWJvYXJkTWFwcGVyKGlzVVNTdGFuZGFyZDogYm9vbGVhbiwgZmlsZTogc3RyaW5nLCBtYXBBbHRHclRvQ3RybEFsdDogYm9vbGVhbik6IFByb21pc2U8V2luZG93c0tleWJvYXJkTWFwcGVyPiB7XG5cdGNvbnN0IHJhd01hcHBpbmdzID0gYXdhaXQgcmVhZFJhd01hcHBpbmc8SVdpbmRvd3NLZXlib2FyZE1hcHBpbmc+KGZpbGUpO1xuXHRyZXR1cm4gbmV3IFdpbmRvd3NLZXlib2FyZE1hcHBlcihpc1VTU3RhbmRhcmQsIHJhd01hcHBpbmdzLCBtYXBBbHRHclRvQ3RybEFsdCk7XG59XG5cbmZ1bmN0aW9uIF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhtYXBwZXI6IFdpbmRvd3NLZXlib2FyZE1hcHBlciwgazogbnVtYmVyLCBleHBlY3RlZDogSVJlc29sdmVkS2V5YmluZGluZ1tdKTogdm9pZCB7XG5cdGNvbnN0IGtleUJpbmRpbmcgPSBkZWNvZGVLZXliaW5kaW5nKGssIE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzKTtcblx0YXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcobWFwcGVyLCBrZXlCaW5kaW5nISwgZXhwZWN0ZWQpO1xufVxuXG5zdWl0ZSgna2V5Ym9hcmRNYXBwZXIgLSBXSU5ET1dTIGRlX2NoJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGxldCBtYXBwZXI6IFdpbmRvd3NLZXlib2FyZE1hcHBlcjtcblxuXHRzdWl0ZVNldHVwKGFzeW5jICgpID0+IHtcblx0XHRtYXBwZXIgPSBhd2FpdCBjcmVhdGVLZXlib2FyZE1hcHBlcihmYWxzZSwgJ3dpbl9kZV9jaCcsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnbWFwcGluZycsICgpID0+IHtcblx0XHRyZXR1cm4gYXNzZXJ0TWFwcGluZyhXUklURV9GSUxFX0lGX0RJRkZFUkVOVCwgbWFwcGVyLCAnd2luX2RlX2NoLnR4dCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDdHJsK0EnLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUEsXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrQScsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrQScsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDdHJsK0EnLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrYScsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK0EnXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIEN0cmwrWicsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHRLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5Wixcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtaJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtaJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogJ0N0cmwrWicsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCt6Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrWiddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgQ3RybCtaJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IHRydWUsXG5cdFx0XHRcdHNoaWZ0S2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogS2V5Q29kZS5LZXlaLFxuXHRcdFx0XHRjb2RlOiBudWxsIVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6ICdDdHJsK1onLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK1onLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtaJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK3onLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtaJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIEN0cmwrXScsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHRLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQnJhY2tldFJpZ2h0LFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsK14nLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK14nLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtdJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK29lbV82Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiBmYWxzZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK10nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXlib2FyZEV2ZW50IEN0cmwrXScsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiB0cnVlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdGtleUNvZGU6IEtleUNvZGUuQnJhY2tldFJpZ2h0LFxuXHRcdFx0XHRjb2RlOiBudWxsIVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6ICdDdHJsK14nLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK14nLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtdJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK29lbV82Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiBmYWxzZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK10nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgU2hpZnQrXScsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHRLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkJyYWNrZXRSaWdodCxcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiAnU2hpZnQrXicsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ1NoaWZ0K14nLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnU2hpZnQrXScsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnc2hpZnQrb2VtXzYnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IGZhbHNlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ3NoaWZ0K10nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIEN0cmwrLycsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHRLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuU2xhc2gsXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrXHUwMEE3Jyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtcdTAwQTcnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCsvJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK29lbV8yJyxcblx0XHRcdFx0aXNXWVNJV1lHOiBmYWxzZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsKy8nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIEN0cmwrU2hpZnQrLycsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHRLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuU2xhc2gsXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrU2hpZnQrXHUwMEE3Jyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtTaGlmdCtcdTAwQTcnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtTaGlmdCsvJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK3NoaWZ0K29lbV8yJyxcblx0XHRcdFx0aXNXWVNJV1lHOiBmYWxzZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK3NoaWZ0Ky8nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIEN0cmwrSyBDdHJsK1xcXFwnLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0S2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5CYWNrc2xhc2gpLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsK0sgQ3RybCtcdTAwRTQnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK0sgQ29udHJvbCtcdTAwRTQnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrayBjdHJsK29lbV81Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiBmYWxzZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiB0cnVlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrSycsICdjdHJsK1xcXFwnXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbCwgbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIEN0cmwrSyBDdHJsKz0nLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0S2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5FcXVhbCksXG5cdFx0XHRbXVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIEN0cmwrRG93bkFycm93JywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdG1hcHBlcixcblx0XHRcdEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Eb3duQXJyb3csXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrRG93bkFycm93Jyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtEb3duQXJyb3cnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtEb3duJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK2Rvd24nLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtEb3duQXJyb3cnXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIEN0cmwrTlVNUEFEXzAnLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLk51bXBhZDAsXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrTnVtUGFkMCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrTnVtUGFkMCcsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCtudW1wYWQwJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrTnVtUGFkMCddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ3RybCtIb21lJywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdG1hcHBlcixcblx0XHRcdEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Ib21lLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsK0hvbWUnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK0hvbWUnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtIb21lJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK2hvbWUnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtIb21lJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBDdHJsK0hvbWUnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHR7XG5cdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0Y3RybEtleTogdHJ1ZSxcblx0XHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0XHRtZXRhS2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0R3JhcGhLZXk6IGZhbHNlLFxuXHRcdFx0XHRrZXlDb2RlOiBLZXlDb2RlLkhvbWUsXG5cdFx0XHRcdGNvZGU6IG51bGwhXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrSG9tZScsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrSG9tZScsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDdHJsK0hvbWUnLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwraG9tZScsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK0hvbWUnXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZVVzZXJCaW5kaW5nIEN0cmwrW0NvbW1hXSBDdHJsKy8nLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRtYXBwZXIsIG5ldyBLZXliaW5kaW5nKFtcblx0XHRcdFx0bmV3IFNjYW5Db2RlQ2hvcmQodHJ1ZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgU2NhbkNvZGUuQ29tbWEpLFxuXHRcdFx0XHRuZXcgS2V5Q29kZUNob3JkKHRydWUsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIEtleUNvZGUuU2xhc2gpLFxuXHRcdFx0XSksXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrLCBDdHJsK1x1MDBBNycsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrLCBDb250cm9sK1x1MDBBNycsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCtvZW1fY29tbWEgY3RybCtvZW1fMicsXG5cdFx0XHRcdGlzV1lTSVdZRzogZmFsc2UsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogdHJ1ZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsKywnLCAnY3RybCsvJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGwsIG51bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBTaW5nbGUgTW9kaWZpZXIgQ3RybCsnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHR7XG5cdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0Y3RybEtleTogdHJ1ZSxcblx0XHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0XHRtZXRhS2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0R3JhcGhLZXk6IGZhbHNlLFxuXHRcdFx0XHRrZXlDb2RlOiBLZXlDb2RlLkN0cmwsXG5cdFx0XHRcdGNvZGU6IG51bGwhXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogWydjdHJsJ10sXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ2tleWJvYXJkTWFwcGVyIC0gV0lORE9XUyBlbl91cycsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgbWFwcGVyOiBXaW5kb3dzS2V5Ym9hcmRNYXBwZXI7XG5cblx0c3VpdGVTZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0bWFwcGVyID0gYXdhaXQgY3JlYXRlS2V5Ym9hcmRNYXBwZXIodHJ1ZSwgJ3dpbl9lbl91cycsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnbWFwcGluZycsICgpID0+IHtcblx0XHRyZXR1cm4gYXNzZXJ0TWFwcGluZyhXUklURV9GSUxFX0lGX0RJRkZFUkVOVCwgbWFwcGVyLCAnd2luX2VuX3VzLnR4dCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDdHJsK0sgQ3RybCtcXFxcJywgKCkgPT4ge1xuXHRcdF9hc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdG1hcHBlcixcblx0XHRcdEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQmFja3NsYXNoKSxcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtLIEN0cmwrXFxcXCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrSyBDb250cm9sK1xcXFwnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrayBjdHJsK1xcXFwnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogdHJ1ZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK0snLCAnY3RybCtcXFxcJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGwsIG51bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlVXNlckJpbmRpbmcgQ3RybCtbQ29tbWFdIEN0cmwrLycsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5YmluZGluZyhcblx0XHRcdG1hcHBlciwgbmV3IEtleWJpbmRpbmcoW1xuXHRcdFx0XHRuZXcgU2NhbkNvZGVDaG9yZCh0cnVlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBTY2FuQ29kZS5Db21tYSksXG5cdFx0XHRcdG5ldyBLZXlDb2RlQ2hvcmQodHJ1ZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgS2V5Q29kZS5TbGFzaCksXG5cdFx0XHRdKSxcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCssIEN0cmwrLycsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrLCBDb250cm9sKy8nLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrLCBjdHJsKy8nLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogdHJ1ZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsKywnLCAnY3RybCsvJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGwsIG51bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlVXNlckJpbmRpbmcgQ3RybCtbQ29tbWFdJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0bWFwcGVyLCBuZXcgS2V5YmluZGluZyhbXG5cdFx0XHRcdG5ldyBTY2FuQ29kZUNob3JkKHRydWUsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIFNjYW5Db2RlLkNvbW1hKSxcblx0XHRcdF0pLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsKywnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sKywnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCssJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsKywnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCssJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBTaW5nbGUgTW9kaWZpZXIgQ3RybCsnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHR7XG5cdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0Y3RybEtleTogdHJ1ZSxcblx0XHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0XHRtZXRhS2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0R3JhcGhLZXk6IGZhbHNlLFxuXHRcdFx0XHRrZXlDb2RlOiBLZXlDb2RlLkN0cmwsXG5cdFx0XHRcdGNvZGU6IG51bGwhXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogWydjdHJsJ10sXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgU2luZ2xlIE1vZGlmaWVyIFNoaWZ0KycsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiBmYWxzZSxcblx0XHRcdFx0c2hpZnRLZXk6IHRydWUsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdGtleUNvZGU6IEtleUNvZGUuU2hpZnQsXG5cdFx0XHRcdGNvZGU6IG51bGwhXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ1NoaWZ0Jyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnU2hpZnQnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ3NoaWZ0Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogWydzaGlmdCddLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXlib2FyZEV2ZW50IFNpbmdsZSBNb2RpZmllciBBbHQrJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IGZhbHNlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogdHJ1ZSxcblx0XHRcdFx0bWV0YUtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogS2V5Q29kZS5BbHQsXG5cdFx0XHRcdGNvZGU6IG51bGwhXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ0FsdCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0FsdCcsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnYWx0Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogWydhbHQnXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBTaW5nbGUgTW9kaWZpZXIgTWV0YSsnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHR7XG5cdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0Y3RybEtleTogZmFsc2UsXG5cdFx0XHRcdHNoaWZ0S2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogdHJ1ZSxcblx0XHRcdFx0YWx0R3JhcGhLZXk6IGZhbHNlLFxuXHRcdFx0XHRrZXlDb2RlOiBLZXlDb2RlLk1ldGEsXG5cdFx0XHRcdGNvZGU6IG51bGwhXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ1dpbmRvd3MnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdXaW5kb3dzJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICd3aW4nLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbJ21ldGEnXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBPbmx5IE1vZGlmaWVycyBDdHJsK1NoaWZ0KycsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiB0cnVlLFxuXHRcdFx0XHRzaGlmdEtleTogdHJ1ZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogS2V5Q29kZS5TaGlmdCxcblx0XHRcdFx0Y29kZTogbnVsbCFcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtTaGlmdCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrU2hpZnQnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrc2hpZnQnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgbWFwQWx0R3JUb0N0cmxBbHQgQWx0R3IrWicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBtYXBwZXIgPSBhd2FpdCBjcmVhdGVLZXlib2FyZE1hcHBlcih0cnVlLCAnd2luX2VuX3VzJywgdHJ1ZSk7XG5cblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiBmYWxzZSxcblx0XHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0XHRtZXRhS2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0R3JhcGhLZXk6IHRydWUsXG5cdFx0XHRcdGtleUNvZGU6IEtleUNvZGUuS2V5Wixcblx0XHRcdFx0Y29kZTogbnVsbCFcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtBbHQrWicsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrQWx0K1onLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtBbHQrWicsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCthbHQreicsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK2FsdCtaJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdrZXlib2FyZE1hcHBlciAtIFdJTkRPV1MgcG9yX3B0YicsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgbWFwcGVyOiBXaW5kb3dzS2V5Ym9hcmRNYXBwZXI7XG5cblx0c3VpdGVTZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0bWFwcGVyID0gYXdhaXQgY3JlYXRlS2V5Ym9hcmRNYXBwZXIoZmFsc2UsICd3aW5fcG9yX3B0YicsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnbWFwcGluZycsICgpID0+IHtcblx0XHRyZXR1cm4gYXNzZXJ0TWFwcGluZyhXUklURV9GSUxFX0lGX0RJRkZFUkVOVCwgbWFwcGVyLCAnd2luX3Bvcl9wdGIudHh0Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXlib2FyZEV2ZW50IEN0cmwrW0ludGxSb10nLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHR7XG5cdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0Y3RybEtleTogdHJ1ZSxcblx0XHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0XHRtZXRhS2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0R3JhcGhLZXk6IGZhbHNlLFxuXHRcdFx0XHRrZXlDb2RlOiBLZXlDb2RlLkFCTlRfQzEsXG5cdFx0XHRcdGNvZGU6IG51bGwhXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrLycsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrLycsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDdHJsK0FCTlRfQzEnLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrYWJudF9jMScsXG5cdFx0XHRcdGlzV1lTSVdZRzogZmFsc2UsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtBQk5UX0MxJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXlib2FyZEV2ZW50IEN0cmwrW051bXBhZENvbW1hXScsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiB0cnVlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdGtleUNvZGU6IEtleUNvZGUuQUJOVF9DMixcblx0XHRcdFx0Y29kZTogbnVsbCFcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCsuJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCsuJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogJ0N0cmwrQUJOVF9DMicsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCthYm50X2MyJyxcblx0XHRcdFx0aXNXWVNJV1lHOiBmYWxzZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK0FCTlRfQzInXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ2tleWJvYXJkTWFwcGVyIC0gV0lORE9XUyBydScsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgbWFwcGVyOiBXaW5kb3dzS2V5Ym9hcmRNYXBwZXI7XG5cblx0c3VpdGVTZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0bWFwcGVyID0gYXdhaXQgY3JlYXRlS2V5Ym9hcmRNYXBwZXIoZmFsc2UsICd3aW5fcnUnLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21hcHBpbmcnLCAoKSA9PiB7XG5cdFx0cmV0dXJuIGFzc2VydE1hcHBpbmcoV1JJVEVfRklMRV9JRl9ESUZGRVJFTlQsIG1hcHBlciwgJ3dpbl9ydS50eHQnKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIyMyNDM2MTogcmVzb2x2ZUtleWJpbmRpbmcgQ3RybCtLIEN0cmwrSycsICgpID0+IHtcblx0XHRfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHRLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUspLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsK0sgQ3RybCtLJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtLIENvbnRyb2wrSycsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCtrIGN0cmwraycsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiB0cnVlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrSycsICdjdHJsK0snXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbCwgbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdrZXlib2FyZE1hcHBlciAtIG1pc2MnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnaXNzdWUgIzIzNTEzOiBUb2dnbGUgU2lkZWJhciBWaXNpYmlsaXR5IGFuZCBHbyB0byBMaW5lIGRpc3BsYXkgc2FtZSBrZXkgbWFwcGluZyBpbiBBcmFiaWMga2V5Ym9hcmQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbWFwcGVyID0gbmV3IFdpbmRvd3NLZXlib2FyZE1hcHBlcihmYWxzZSwge1xuXHRcdFx0J0tleUInOiB7XG5cdFx0XHRcdCd2a2V5JzogJ1ZLX0InLFxuXHRcdFx0XHQndmFsdWUnOiAnXHUwNjQ0XHUwNjI3Jyxcblx0XHRcdFx0J3dpdGhTaGlmdCc6ICdcdTA2NDRcdTA2MjInLFxuXHRcdFx0XHQnd2l0aEFsdEdyJzogJycsXG5cdFx0XHRcdCd3aXRoU2hpZnRBbHRHcic6ICcnXG5cdFx0XHR9LFxuXHRcdFx0J0tleUcnOiB7XG5cdFx0XHRcdCd2a2V5JzogJ1ZLX0cnLFxuXHRcdFx0XHQndmFsdWUnOiAnXHUwNjQ0Jyxcblx0XHRcdFx0J3dpdGhTaGlmdCc6ICdcdTA2NDRcdTA2MjMnLFxuXHRcdFx0XHQnd2l0aEFsdEdyJzogJycsXG5cdFx0XHRcdCd3aXRoU2hpZnRBbHRHcic6ICcnXG5cdFx0XHR9XG5cdFx0fSwgZmFsc2UpO1xuXG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUIsXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrQicsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrQicsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDdHJsK0InLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrYicsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK0InXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLFVBQVUsU0FBUyxRQUFRLGdCQUFnQjtBQUNwRCxTQUFTLGNBQWMsa0JBQWtCLGVBQWUsa0JBQWtCO0FBQzFFLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQThCLGVBQWUsNEJBQTRCLHlCQUF5QixzQkFBc0I7QUFFeEgsU0FBUywrQ0FBK0M7QUFFeEQsTUFBTSwwQkFBMEI7QUFFaEMsZUFBZSxxQkFBcUIsY0FBdUIsTUFBYyxtQkFBNEQ7QUFDcEksUUFBTSxjQUFjLE1BQU0sZUFBd0MsSUFBSTtBQUN0RSxTQUFPLElBQUksc0JBQXNCLGNBQWMsYUFBYSxpQkFBaUI7QUFDOUU7QUFFQSxTQUFTLHlCQUF5QixRQUErQixHQUFXLFVBQXVDO0FBQ2xILFFBQU0sYUFBYSxpQkFBaUIsR0FBRyxnQkFBZ0IsT0FBTztBQUM5RCwwQkFBd0IsUUFBUSxZQUFhLFFBQVE7QUFDdEQ7QUFFQSxNQUFNLGtDQUFrQyxNQUFNO0FBRTdDLDBDQUF3QztBQUV4QyxNQUFJO0FBRUosYUFBVyxZQUFZO0FBQ3RCLGFBQVMsTUFBTSxxQkFBcUIsT0FBTyxhQUFhLEtBQUs7QUFBQSxFQUM5RCxDQUFDO0FBRUQsT0FBSyxXQUFXLE1BQU07QUFDckIsV0FBTyxjQUFjLHlC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
