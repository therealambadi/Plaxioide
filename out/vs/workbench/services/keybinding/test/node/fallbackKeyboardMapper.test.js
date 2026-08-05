import { KeyChord, KeyCode, KeyMod, ScanCode } from "../../../../../base/common/keyCodes.js";
import { KeyCodeChord, decodeKeybinding, ScanCodeChord, Keybinding } from "../../../../../base/common/keybindings.js";
import { OperatingSystem } from "../../../../../base/common/platform.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { FallbackKeyboardMapper } from "../../common/fallbackKeyboardMapper.js";
import { assertResolveKeyboardEvent, assertResolveKeybinding } from "./keyboardMapperTestUtils.js";
suite("keyboardMapper - MAC fallback", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const mapper = new FallbackKeyboardMapper(false, OperatingSystem.Macintosh);
  function _assertResolveKeybinding(k, expected) {
    assertResolveKeybinding(mapper, decodeKeybinding(k, OperatingSystem.Macintosh), expected);
  }
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
        dispatchParts: ["meta+Z"],
        singleModifierDispatchParts: [null]
      }]
    );
  });
  test("resolveKeybinding Cmd+K Cmd+=", () => {
    _assertResolveKeybinding(
      KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Equal),
      [{
        label: "\u2318K \u2318=",
        ariaLabel: "Command+K Command+=",
        electronAccelerator: null,
        userSettingsLabel: "cmd+k cmd+=",
        isWYSIWYG: true,
        isMultiChord: true,
        dispatchParts: ["meta+K", "meta+="],
        singleModifierDispatchParts: [null, null]
      }]
    );
  });
  test("resolveKeyboardEvent Cmd+Z", () => {
    assertResolveKeyboardEvent(
      mapper,
      {
        _standardKeyboardEventBrand: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: true,
        altGraphKey: false,
        keyCode: KeyCode.KeyZ,
        code: null
      },
      {
        label: "\u2318Z",
        ariaLabel: "Command+Z",
        electronAccelerator: "Cmd+Z",
        userSettingsLabel: "cmd+z",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: ["meta+Z"],
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
        label: "\u2318, \u2318/",
        ariaLabel: "Command+, Command+/",
        electronAccelerator: null,
        userSettingsLabel: "cmd+, cmd+/",
        isWYSIWYG: true,
        isMultiChord: true,
        dispatchParts: ["meta+,", "meta+/"],
        singleModifierDispatchParts: [null, null]
      }]
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
        label: "\u21E7",
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
        label: "\u2325",
        ariaLabel: "Option",
        electronAccelerator: null,
        userSettingsLabel: "alt",
        isWYSIWYG: true,
        isMultiChord: false,
        dispatchParts: [null],
        singleModifierDispatchParts: ["alt"]
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
        label: "\u2303\u21E7",
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
  test("resolveKeyboardEvent mapAltGrToCtrlAlt AltGr+Z", () => {
    const mapper2 = new FallbackKeyboardMapper(true, OperatingSystem.Macintosh);
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
        label: "\u2303\u2325Z",
        ariaLabel: "Control+Option+Z",
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
suite("keyboardMapper - LINUX fallback", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const mapper = new FallbackKeyboardMapper(false, OperatingSystem.Linux);
  function _assertResolveKeybinding(k, expected) {
    assertResolveKeybinding(mapper, decodeKeybinding(k, OperatingSystem.Linux), expected);
  }
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
        dispatchParts: ["ctrl+Z"],
        singleModifierDispatchParts: [null]
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
        dispatchParts: ["ctrl+K", "ctrl+="],
        singleModifierDispatchParts: [null, null]
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
  test("resolveKeyboardEvent mapAltGrToCtrlAlt AltGr+Z", () => {
    const mapper2 = new FallbackKeyboardMapper(true, OperatingSystem.Linux);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMva2V5YmluZGluZy90ZXN0L25vZGUvZmFsbGJhY2tLZXlib2FyZE1hcHBlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgS2V5Q2hvcmQsIEtleUNvZGUsIEtleU1vZCwgU2NhbkNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlQ2hvcmQsIGRlY29kZUtleWJpbmRpbmcsIFNjYW5Db2RlQ2hvcmQsIEtleWJpbmRpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXliaW5kaW5ncy5qcyc7XG5pbXBvcnQgeyBPcGVyYXRpbmdTeXN0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IEZhbGxiYWNrS2V5Ym9hcmRNYXBwZXIgfSBmcm9tICcuLi8uLi9jb21tb24vZmFsbGJhY2tLZXlib2FyZE1hcHBlci5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZWRLZXliaW5kaW5nLCBhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudCwgYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcgfSBmcm9tICcuL2tleWJvYXJkTWFwcGVyVGVzdFV0aWxzLmpzJztcblxuc3VpdGUoJ2tleWJvYXJkTWFwcGVyIC0gTUFDIGZhbGxiYWNrJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGNvbnN0IG1hcHBlciA9IG5ldyBGYWxsYmFja0tleWJvYXJkTWFwcGVyKGZhbHNlLCBPcGVyYXRpbmdTeXN0ZW0uTWFjaW50b3NoKTtcblxuXHRmdW5jdGlvbiBfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoazogbnVtYmVyLCBleHBlY3RlZDogSVJlc29sdmVkS2V5YmluZGluZ1tdKTogdm9pZCB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcobWFwcGVyLCBkZWNvZGVLZXliaW5kaW5nKGssIE9wZXJhdGluZ1N5c3RlbS5NYWNpbnRvc2gpISwgZXhwZWN0ZWQpO1xuXHR9XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ21kK1onLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVosXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ1x1MjMxOFonLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb21tYW5kK1onLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ21kK1onLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2NtZCt6Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ21ldGErWiddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJpbmRpbmcgQ21kK0sgQ21kKz0nLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5FcXVhbCksXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ1x1MjMxOEsgXHUyMzE4PScsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbW1hbmQrSyBDb21tYW5kKz0nLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2NtZCtrIGNtZCs9Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IHRydWUsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnbWV0YStLJywgJ21ldGErPSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsLCBudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgQ21kK1onLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHR7XG5cdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0Y3RybEtleTogZmFsc2UsXG5cdFx0XHRcdHNoaWZ0S2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogdHJ1ZSxcblx0XHRcdFx0YWx0R3JhcGhLZXk6IGZhbHNlLFxuXHRcdFx0XHRrZXlDb2RlOiBLZXlDb2RlLktleVosXG5cdFx0XHRcdGNvZGU6IG51bGwhXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ1x1MjMxOFonLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb21tYW5kK1onLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ21kK1onLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2NtZCt6Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ21ldGErWiddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlVXNlckJpbmRpbmcgQ21kK1tDb21tYV0gQ21kKy8nLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRtYXBwZXIsIG5ldyBLZXliaW5kaW5nKFtcblx0XHRcdFx0bmV3IFNjYW5Db2RlQ2hvcmQoZmFsc2UsIGZhbHNlLCBmYWxzZSwgdHJ1ZSwgU2NhbkNvZGUuQ29tbWEpLFxuXHRcdFx0XHRuZXcgS2V5Q29kZUNob3JkKGZhbHNlLCBmYWxzZSwgZmFsc2UsIHRydWUsIEtleUNvZGUuU2xhc2gpLFxuXHRcdFx0XSksXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ1x1MjMxOCwgXHUyMzE4LycsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbW1hbmQrLCBDb21tYW5kKy8nLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2NtZCssIGNtZCsvJyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IHRydWUsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnbWV0YSssJywgJ21ldGErLyddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsLCBudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgU2luZ2xlIE1vZGlmaWVyIE1ldGErJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IGZhbHNlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IHRydWUsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogS2V5Q29kZS5NZXRhLFxuXHRcdFx0XHRjb2RlOiBudWxsIVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6ICdcdTIzMTgnLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb21tYW5kJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjbWQnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbJ21ldGEnXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBTaW5nbGUgTW9kaWZpZXIgU2hpZnQrJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IGZhbHNlLFxuXHRcdFx0XHRzaGlmdEtleTogdHJ1ZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogS2V5Q29kZS5TaGlmdCxcblx0XHRcdFx0Y29kZTogbnVsbCFcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnXHUyMUU3Jyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnU2hpZnQnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ3NoaWZ0Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogWydzaGlmdCddLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXlib2FyZEV2ZW50IFNpbmdsZSBNb2RpZmllciBBbHQrJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IGZhbHNlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogdHJ1ZSxcblx0XHRcdFx0bWV0YUtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogS2V5Q29kZS5BbHQsXG5cdFx0XHRcdGNvZGU6IG51bGwhXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ1x1MjMyNScsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ09wdGlvbicsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnYWx0Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IGZhbHNlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogWydhbHQnXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBPbmx5IE1vZGlmaWVycyBDdHJsK1NoaWZ0KycsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiB0cnVlLFxuXHRcdFx0XHRzaGlmdEtleTogdHJ1ZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogS2V5Q29kZS5TaGlmdCxcblx0XHRcdFx0Y29kZTogbnVsbCFcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnXHUyMzAzXHUyMUU3Jyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCtTaGlmdCcsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCtzaGlmdCcsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBtYXBBbHRHclRvQ3RybEFsdCBBbHRHcitaJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1hcHBlciA9IG5ldyBGYWxsYmFja0tleWJvYXJkTWFwcGVyKHRydWUsIE9wZXJhdGluZ1N5c3RlbS5NYWNpbnRvc2gpO1xuXG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJvYXJkRXZlbnQoXG5cdFx0XHRtYXBwZXIsXG5cdFx0XHR7XG5cdFx0XHRcdF9zdGFuZGFyZEtleWJvYXJkRXZlbnRCcmFuZDogdHJ1ZSxcblx0XHRcdFx0Y3RybEtleTogZmFsc2UsXG5cdFx0XHRcdHNoaWZ0S2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiB0cnVlLFxuXHRcdFx0XHRrZXlDb2RlOiBLZXlDb2RlLktleVosXG5cdFx0XHRcdGNvZGU6IG51bGwhXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogJ1x1MjMwM1x1MjMyNVonLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK09wdGlvbitaJyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogJ0N0cmwrQWx0K1onLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrYWx0K3onLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCthbHQrWiddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgna2V5Ym9hcmRNYXBwZXIgLSBMSU5VWCBmYWxsYmFjaycsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRjb25zdCBtYXBwZXIgPSBuZXcgRmFsbGJhY2tLZXlib2FyZE1hcHBlcihmYWxzZSwgT3BlcmF0aW5nU3lzdGVtLkxpbnV4KTtcblxuXHRmdW5jdGlvbiBfYXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoazogbnVtYmVyLCBleHBlY3RlZDogSVJlc29sdmVkS2V5YmluZGluZ1tdKTogdm9pZCB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcobWFwcGVyLCBkZWNvZGVLZXliaW5kaW5nKGssIE9wZXJhdGluZ1N5c3RlbS5MaW51eCkhLCBleHBlY3RlZCk7XG5cdH1cblxuXHR0ZXN0KCdyZXNvbHZlS2V5YmluZGluZyBDdHJsK1onLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVosXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrWicsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrWicsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDdHJsK1onLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwreicsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK1onXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXliaW5kaW5nIEN0cmwrSyBDdHJsKz0nLCAoKSA9PiB7XG5cdFx0X2Fzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0S2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5FcXVhbCksXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrSyBDdHJsKz0nLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK0sgQ29udHJvbCs9Jyxcblx0XHRcdFx0ZWxlY3Ryb25BY2NlbGVyYXRvcjogbnVsbCxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK2sgY3RybCs9Jyxcblx0XHRcdFx0aXNXWVNJV1lHOiB0cnVlLFxuXHRcdFx0XHRpc011bHRpQ2hvcmQ6IHRydWUsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtLJywgJ2N0cmwrPSddLFxuXHRcdFx0XHRzaW5nbGVNb2RpZmllckRpc3BhdGNoUGFydHM6IFtudWxsLCBudWxsXSxcblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUtleWJvYXJkRXZlbnQgQ3RybCtaJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXlib2FyZEV2ZW50KFxuXHRcdFx0bWFwcGVyLFxuXHRcdFx0e1xuXHRcdFx0XHRfc3RhbmRhcmRLZXlib2FyZEV2ZW50QnJhbmQ6IHRydWUsXG5cdFx0XHRcdGN0cmxLZXk6IHRydWUsXG5cdFx0XHRcdHNoaWZ0S2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0S2V5OiBmYWxzZSxcblx0XHRcdFx0bWV0YUtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEdyYXBoS2V5OiBmYWxzZSxcblx0XHRcdFx0a2V5Q29kZTogS2V5Q29kZS5LZXlaLFxuXHRcdFx0XHRjb2RlOiBudWxsIVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6ICdDdHJsK1onLFxuXHRcdFx0XHRhcmlhTGFiZWw6ICdDb250cm9sK1onLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtaJyxcblx0XHRcdFx0dXNlclNldHRpbmdzTGFiZWw6ICdjdHJsK3onLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFsnY3RybCtaJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVVc2VyQmluZGluZyBDdHJsK1tDb21tYV0gQ3RybCsvJywgKCkgPT4ge1xuXHRcdGFzc2VydFJlc29sdmVLZXliaW5kaW5nKFxuXHRcdFx0bWFwcGVyLCBuZXcgS2V5YmluZGluZyhbXG5cdFx0XHRcdG5ldyBTY2FuQ29kZUNob3JkKHRydWUsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIFNjYW5Db2RlLkNvbW1hKSxcblx0XHRcdFx0bmV3IEtleUNvZGVDaG9yZCh0cnVlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBLZXlDb2RlLlNsYXNoKSxcblx0XHRcdF0pLFxuXHRcdFx0W3tcblx0XHRcdFx0bGFiZWw6ICdDdHJsKywgQ3RybCsvJyxcblx0XHRcdFx0YXJpYUxhYmVsOiAnQ29udHJvbCssIENvbnRyb2wrLycsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6IG51bGwsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCssIGN0cmwrLycsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiB0cnVlLFxuXHRcdFx0XHRkaXNwYXRjaFBhcnRzOiBbJ2N0cmwrLCcsICdjdHJsKy8nXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbCwgbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVVc2VyQmluZGluZyBDdHJsK1tDb21tYV0nLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmVzb2x2ZUtleWJpbmRpbmcoXG5cdFx0XHRtYXBwZXIsIG5ldyBLZXliaW5kaW5nKFtcblx0XHRcdFx0bmV3IFNjYW5Db2RlQ2hvcmQodHJ1ZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgU2NhbkNvZGUuQ29tbWEpLFxuXHRcdFx0XSksXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogJ0N0cmwrLCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrLCcsXG5cdFx0XHRcdGVsZWN0cm9uQWNjZWxlcmF0b3I6ICdDdHJsKywnLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwrLCcsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsKywnXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbbnVsbF0sXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVLZXlib2FyZEV2ZW50IFNpbmdsZSBNb2RpZmllciBDdHJsKycsICgpID0+IHtcblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiB0cnVlLFxuXHRcdFx0XHRzaGlmdEtleTogZmFsc2UsXG5cdFx0XHRcdGFsdEtleTogZmFsc2UsXG5cdFx0XHRcdG1ldGFLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRHcmFwaEtleTogZmFsc2UsXG5cdFx0XHRcdGtleUNvZGU6IEtleUNvZGUuQ3RybCxcblx0XHRcdFx0Y29kZTogbnVsbCFcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCcsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wnLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiBudWxsLFxuXHRcdFx0XHR1c2VyU2V0dGluZ3NMYWJlbDogJ2N0cmwnLFxuXHRcdFx0XHRpc1dZU0lXWUc6IHRydWUsXG5cdFx0XHRcdGlzTXVsdGlDaG9yZDogZmFsc2UsXG5cdFx0XHRcdGRpc3BhdGNoUGFydHM6IFtudWxsXSxcblx0XHRcdFx0c2luZ2xlTW9kaWZpZXJEaXNwYXRjaFBhcnRzOiBbJ2N0cmwnXSxcblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlS2V5Ym9hcmRFdmVudCBtYXBBbHRHclRvQ3RybEFsdCBBbHRHcitaJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1hcHBlciA9IG5ldyBGYWxsYmFja0tleWJvYXJkTWFwcGVyKHRydWUsIE9wZXJhdGluZ1N5c3RlbS5MaW51eCk7XG5cblx0XHRhc3NlcnRSZXNvbHZlS2V5Ym9hcmRFdmVudChcblx0XHRcdG1hcHBlcixcblx0XHRcdHtcblx0XHRcdFx0X3N0YW5kYXJkS2V5Ym9hcmRFdmVudEJyYW5kOiB0cnVlLFxuXHRcdFx0XHRjdHJsS2V5OiBmYWxzZSxcblx0XHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0XHRtZXRhS2V5OiBmYWxzZSxcblx0XHRcdFx0YWx0R3JhcGhLZXk6IHRydWUsXG5cdFx0XHRcdGtleUNvZGU6IEtleUNvZGUuS2V5Wixcblx0XHRcdFx0Y29kZTogbnVsbCFcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnQ3RybCtBbHQrWicsXG5cdFx0XHRcdGFyaWFMYWJlbDogJ0NvbnRyb2wrQWx0K1onLFxuXHRcdFx0XHRlbGVjdHJvbkFjY2VsZXJhdG9yOiAnQ3RybCtBbHQrWicsXG5cdFx0XHRcdHVzZXJTZXR0aW5nc0xhYmVsOiAnY3RybCthbHQreicsXG5cdFx0XHRcdGlzV1lTSVdZRzogdHJ1ZSxcblx0XHRcdFx0aXNNdWx0aUNob3JkOiBmYWxzZSxcblx0XHRcdFx0ZGlzcGF0Y2hQYXJ0czogWydjdHJsK2FsdCtaJ10sXG5cdFx0XHRcdHNpbmdsZU1vZGlmaWVyRGlzcGF0Y2hQYXJ0czogW251bGxdLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLFVBQVUsU0FBUyxRQUFRLGdCQUFnQjtBQUNwRCxTQUFTLGNBQWMsa0JBQWtCLGVBQWUsa0JBQWtCO0FBQzFFLFNBQVMsdUJB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
