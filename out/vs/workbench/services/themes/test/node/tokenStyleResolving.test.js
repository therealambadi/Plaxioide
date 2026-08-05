import { ColorThemeData } from "../../common/colorThemeData.js";
import assert from "assert";
import { TokenStyle, getTokenClassificationRegistry } from "../../../../../platform/theme/common/tokenClassificationRegistry.js";
import { Color } from "../../../../../base/common/color.js";
import { isString } from "../../../../../base/common/types.js";
import { FileService } from "../../../../../platform/files/common/fileService.js";
import { NullLogService } from "../../../../../platform/log/common/log.js";
import { DiskFileSystemProvider } from "../../../../../platform/files/node/diskFileSystemProvider.js";
import { FileAccess, Schemas } from "../../../../../base/common/network.js";
import { ExtensionResourceLoaderService } from "../../../../../platform/extensionResourceLoader/common/extensionResourceLoaderService.js";
import { mock, TestProductService } from "../../../../test/common/workbenchTestServices.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { ExtensionGalleryManifestService } from "../../../../../platform/extensionManagement/common/extensionGalleryManifestService.js";
const undefinedStyle = { bold: void 0, underline: void 0, italic: void 0 };
const unsetStyle = { bold: false, underline: false, italic: false };
function ts(foreground, styleFlags) {
  const foregroundColor = isString(foreground) ? Color.fromHex(foreground) : void 0;
  return new TokenStyle(foregroundColor, styleFlags?.bold, styleFlags?.underline, styleFlags?.strikethrough, styleFlags?.italic);
}
function tokenStyleAsString(ts2) {
  if (!ts2) {
    return "tokenstyle-undefined";
  }
  let str = ts2.foreground ? ts2.foreground.toString() : "no-foreground";
  if (ts2.bold !== void 0) {
    str += ts2.bold ? "+B" : "-B";
  }
  if (ts2.underline !== void 0) {
    str += ts2.underline ? "+U" : "-U";
  }
  if (ts2.italic !== void 0) {
    str += ts2.italic ? "+I" : "-I";
  }
  return str;
}
function assertTokenStyle(actual, expected, message) {
  assert.strictEqual(tokenStyleAsString(actual), tokenStyleAsString(expected), message);
}
function assertTokenStyleMetaData(colorIndex, actual, expected, message = "") {
  if (expected === void 0 || expected === null || actual === void 0) {
    assert.strictEqual(actual, expected, message);
    return;
  }
  assert.strictEqual(actual.bold, expected.bold, "bold " + message);
  assert.strictEqual(actual.italic, expected.italic, "italic " + message);
  assert.strictEqual(actual.underline, expected.underline, "underline " + message);
  const actualForegroundIndex = actual.foreground;
  if (actualForegroundIndex && expected.foreground) {
    assert.strictEqual(colorIndex[actualForegroundIndex], Color.Format.CSS.formatHexA(expected.foreground, true).toUpperCase(), "foreground " + message);
  } else {
    assert.strictEqual(actualForegroundIndex, expected.foreground || 0, "foreground " + message);
  }
}
function assertTokenStyles(themeData, expected, language = "typescript") {
  const colorIndex = themeData.tokenColorMap;
  for (const qualifiedClassifier in expected) {
    const [type, ...modifiers] = qualifiedClassifier.split(".");
    const expectedTokenStyle = expected[qualifiedClassifier];
    const tokenStyleMetaData = themeData.getTokenStyleMetadata(type, modifiers, language);
    assertTokenStyleMetaData(colorIndex, tokenStyleMetaData, expectedTokenStyle, qualifiedClassifier);
  }
}
suite("Themes - TokenStyleResolving", () => {
  const fileService = new FileService(new NullLogService());
  const requestService = new (mock())();
  const storageService = new (mock())();
  const environmentService = new (mock())();
  const configurationService = new (mock())();
  const extensionResourceLoaderService = new ExtensionResourceLoaderService(fileService, storageService, TestProductService, environmentService, configurationService, new ExtensionGalleryManifestService(TestProductService), requestService, new NullLogService());
  const diskFileSystemProvider = new DiskFileSystemProvider(new NullLogService());
  fileService.registerProvider(Schemas.file, diskFileSystemProvider);
  teardown(() => {
    diskFileSystemProvider.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("color defaults", async () => {
    const themeData = ColorThemeData.createUnloadedTheme("foo");
    themeData.location = FileAccess.asFileUri("vs/workbench/services/themes/test/node/color-theme.json");
    await themeData.ensureLoaded(extensionResourceLoaderService);
    assert.strictEqual(themeData.isLoaded, true);
    assertTokenStyles(themeData, {
      "comment": ts("#000000", undefinedStyle),
      "variable": ts("#111111", unsetStyle),
      "type": ts("#333333", { bold: false, underline: true, italic: false }),
      "function": ts("#333333", unsetStyle),
      "string": ts("#444444", undefinedStyle),
      "number": ts("#555555", undefinedStyle),
      "keyword": ts("#666666", undefinedStyle)
    });
  });
  test("resolveScopes", async () => {
    const themeData = ColorThemeData.createLoadedEmptyTheme("test", "test");
    const customTokenColors = {
      textMateRules: [
        {
          scope: "variable",
          settings: {
            fontStyle: "",
            foreground: "#F8F8F2"
          }
        },
        {
          scope: "keyword.operator",
          settings: {
            fontStyle: "italic bold underline",
            foreground: "#F92672"
          }
        },
        {
          scope: "storage",
          settings: {
            fontStyle: "italic",
            foreground: "#F92672"
          }
        },
        {
          scope: ["storage.type", "meta.structure.dictionary.json string.quoted.double.json"],
          settings: {
            foreground: "#66D9EF"
          }
        },
        {
          scope: "entity.name.type, entity.name.class, entity.name.namespace, entity.name.scope-resolution",
          settings: {
            fontStyle: "underline",
            foreground: "#A6E22E"
          }
        }
      ]
    };
    themeData.setCustomTokenColors(customTokenColors);
    let tokenStyle;
    const defaultTokenStyle = void 0;
    tokenStyle = themeData.resolveScopes([["variable"]]);
    assertTokenStyle(tokenStyle, ts("#F8F8F2", unsetStyle), "variable");
    tokenStyle = themeData.resolveScopes([["keyword.operator"]]);
    assertTokenStyle(tokenStyle, ts("#F92672", { italic: true, bold: true, underline: true }), "keyword");
    tokenStyle = themeData.resolveScopes([["keyword"]]);
    assertTokenStyle(tokenStyle, defaultTokenStyle, "keyword");
    tokenStyle = themeData.resolveScopes([["keyword.operator"]]);
    assertTokenStyle(tokenStyle, ts("#F92672", { italic: true, bold: true, underline: true }), "keyword.operator");
    tokenStyle = themeData.resolveScopes([["keyword.operators"]]);
    assertTokenStyle(tokenStyle, defaultTokenStyle, "keyword.operators");
    tokenStyle = themeData.resolveScopes([["storage"]]);
    assertTokenStyle(tokenStyle, ts("#F92672", { italic: true, bold: false, underline: false }), "storage");
    tokenStyle = themeData.resolveScopes([["storage.type"]]);
    assertTokenStyle(tokenStyle, ts("#66D9EF", { italic: true, bold: false, underline: false }), "storage.type");
    tokenStyle = themeData.resolveScopes([["entity.name.class"]]);
    assertTokenStyle(tokenStyle, ts("#A6E22E", { italic: false, bold: false, underline: true }), "entity.name.class");
    tokenStyle = themeData.resolveScopes([["meta.structure.dictionary.json", "string.quoted.double.json"]]);
    assertTokenStyle(tokenStyle, ts("#66D9EF", void 0), "json property");
    tokenStyle = themeData.resolveScopes([["source.json", "meta.structure.dictionary.json", "string.quoted.double.json"]]);
    assertTokenStyle(tokenStyle, ts("#66D9EF", void 0), "json property");
    tokenStyle = themeData.resolveScopes([["keyword"], ["storage.type"], ["entity.name.class"]]);
    assertTokenStyle(tokenStyle, ts("#66D9EF", { italic: true, bold: false, underline: false }), "storage.type");
  });
  test("resolveScopes - match most specific", async () => {
    const themeData = ColorThemeData.createLoadedEmptyTheme("test", "test");
    const customTokenColors = {
      textMateRules: [
        {
          scope: "entity.name.type",
          settings: {
            fontStyle: "underline",
            foreground: "#A6E22E"
          }
        },
        {
          scope: "entity.name.type.class",
          settings: {
            foreground: "#FF00FF"
          }
        },
        {
          scope: "entity.name",
          settings: {
            foreground: "#FFFFFF"
          }
        }
      ]
    };
    themeData.setCustomTokenColors(customTokenColors);
    const tokenStyle = themeData.resolveScopes([["entity.name.type.class"]]);
    assertTokenStyle(tokenStyle, ts("#FF00FF", { italic: false, bold: false, underline: true }), "entity.name.type.class");
  });
  test("rule matching", async () => {
    const themeData = ColorThemeData.createLoadedEmptyTheme("test", "test");
    themeData.setCustomColors({ "editor.foreground": "#000000" });
    themeData.setCustomSemanticTokenColors({
      enabled: true,
      rules: {
        "type": "#ff0000",
        "class": { foreground: "#0000ff", italic: true },
        "*.static": { bold: true },
        "*.declaration": { italic: true },
        "*.async.static": { italic: true, underline: true },
        "*.async": { foreground: "#000fff", underline: true }
      }
    });
    assertTokenStyles(themeData, {
      "type": ts("#ff0000", undefinedStyle),
      "type.static": ts("#ff0000", { bold: true }),
      "type.static.declaration": ts("#ff0000", { bold: true, italic: true }),
      "class": ts("#0000ff", { italic: true }),
      "class.static.declaration": ts("#0000ff", { bold: true, italic: true }),
      "class.declaration": ts("#0000ff", { italic: true }),
      "class.declaration.async": ts("#000fff", { underline: true, italic: true }),
      "class.declaration.async.static": ts("#000fff", { italic: true, underline: true, bold: true })
    });
  });
  test("super type", async () => {
    const registry = getTokenClassificationRegistry();
    registry.registerTokenType("myTestInterface", "A type just for testing", "interface");
    registry.registerTokenType("myTestSubInterface", "A type just for testing", "myTestInterface");
    try {
      const themeData = ColorThemeData.createLoadedEmptyTheme("test", "test");
      themeData.setCustomColors({ "editor.foreground": "#000000" });
      themeData.setCustomSemanticTokenColors({
        enabled: true,
        rules: {
          "interface": "#ff0000",
          "myTestInterface": { italic: true },
          "interface.static": { bold: true }
        }
      });
      assertTokenStyles(themeData, { "myTestSubInterface": ts("#ff0000", { italic: true }) });
      assertTokenStyles(themeData, { "myTestSubInterface.static": ts("#ff0000", { italic: true, bold: true }) });
      themeData.setCustomSemanticTokenColors({
        enabled: true,
        rules: {
          "interface": "#ff0000",
          "myTestInterface": { foreground: "#ff00ff", italic: true }
        }
      });
      assertTokenStyles(themeData, { "myTestSubInterface": ts("#ff00ff", { italic: true }) });
    } finally {
      registry.deregisterTokenType("myTestInterface");
      registry.deregisterTokenType("myTestSubInterface");
    }
  });
  test("language", async () => {
    try {
      const themeData = ColorThemeData.createLoadedEmptyTheme("test", "test");
      themeData.setCustomColors({ "editor.foreground": "#000000" });
      themeData.setCustomSemanticTokenColors({
        enabled: true,
        rules: {
          "interface": "#fff000",
          "interface:java": "#ff0000",
          "interface.static": { bold: true },
          "interface.static:typescript": { italic: true }
        }
      });
      assertTokenStyles(themeData, { "interface": ts("#ff0000", void 0) }, "java");
      assertTokenStyles(themeData, { "interface": ts("#fff000", void 0) }, "typescript");
      assertTokenStyles(themeData, { "interface.static": ts("#ff0000", { bold: true }) }, "java");
      assertTokenStyles(themeData, { "interface.static": ts("#fff000", { bold: true, italic: true }) }, "typescript");
    } finally {
    }
  });
  test("language - scope resolving", async () => {
    const registry = getTokenClassificationRegistry();
    const numberOfDefaultRules = registry.getTokenStylingDefaultRules().length;
    registry.registerTokenStyleDefault(registry.parseTokenSelector("type", "typescript1"), { scopesToProbe: [["entity.name.type.ts1"]] });
    registry.registerTokenStyleDefault(registry.parseTokenSelector("type:javascript1"), { scopesToProbe: [["entity.name.type.js1"]] });
    try {
      const themeData = ColorThemeData.createLoadedEmptyTheme("test", "test");
      themeData.setCustomColors({ "editor.foreground": "#000000" });
      themeData.setCustomTokenColors({
        textMateRules: [
          {
            scope: "entity.name.type",
            settings: { foreground: "#aa0000" }
          },
          {
            scope: "entity.name.type.ts1",
            settings: { foreground: "#bb0000" }
          }
        ]
      });
      assertTokenStyles(themeData, { "type": ts("#aa0000", void 0) }, "javascript1");
      assertTokenStyles(themeData, { "type": ts("#bb0000", void 0) }, "typescript1");
    } finally {
      registry.deregisterTokenStyleDefault(registry.parseTokenSelector("type", "typescript1"));
      registry.deregisterTokenStyleDefault(registry.parseTokenSelector("type:javascript1"));
      assert.strictEqual(registry.getTokenStylingDefaultRules().length, numberOfDefaultRules);
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGhlbWVzL3Rlc3Qvbm9kZS90b2tlblN0eWxlUmVzb2x2aW5nLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDb2xvclRoZW1lRGF0YSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb2xvclRoZW1lRGF0YS5qcyc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBJVG9rZW5Db2xvckN1c3RvbWl6YXRpb25zIH0gZnJvbSAnLi4vLi4vY29tbW9uL3dvcmtiZW5jaFRoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUb2tlblN0eWxlLCBnZXRUb2tlbkNsYXNzaWZpY2F0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sb3IuanMnO1xuaW1wb3J0IHsgaXNTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IERpc2tGaWxlU3lzdGVtUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9ub2RlL2Rpc2tGaWxlU3lzdGVtUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgRmlsZUFjY2VzcywgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXIvY29tbW9uL2V4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVG9rZW5TdHlsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbW9jaywgVGVzdFByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IElSZXF1ZXN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZS5qcyc7XG5cbmNvbnN0IHVuZGVmaW5lZFN0eWxlID0geyBib2xkOiB1bmRlZmluZWQsIHVuZGVybGluZTogdW5kZWZpbmVkLCBpdGFsaWM6IHVuZGVmaW5lZCB9O1xuY29uc3QgdW5zZXRTdHlsZSA9IHsgYm9sZDogZmFsc2UsIHVuZGVybGluZTogZmFsc2UsIGl0YWxpYzogZmFsc2UgfTtcblxuZnVuY3Rpb24gdHMoZm9yZWdyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkLCBzdHlsZUZsYWdzOiB7IGJvbGQ/OiBib29sZWFuOyB1bmRlcmxpbmU/OiBib29sZWFuOyBzdHJpa2V0aHJvdWdoPzogYm9vbGVhbjsgaXRhbGljPzogYm9vbGVhbiB9IHwgdW5kZWZpbmVkKTogVG9rZW5TdHlsZSB7XG5cdGNvbnN0IGZvcmVncm91bmRDb2xvciA9IGlzU3RyaW5nKGZvcmVncm91bmQpID8gQ29sb3IuZnJvbUhleChmb3JlZ3JvdW5kKSA6IHVuZGVmaW5lZDtcblx0cmV0dXJuIG5ldyBUb2tlblN0eWxlKGZvcmVncm91bmRDb2xvciwgc3R5bGVGbGFncz8uYm9sZCwgc3R5bGVGbGFncz8udW5kZXJsaW5lLCBzdHlsZUZsYWdzPy5zdHJpa2V0aHJvdWdoLCBzdHlsZUZsYWdzPy5pdGFsaWMpO1xufVxuXG5mdW5jdGlvbiB0b2tlblN0eWxlQXNTdHJpbmcodHM6IFRva2VuU3R5bGUgfCB1bmRlZmluZWQgfCBudWxsKSB7XG5cdGlmICghdHMpIHtcblx0XHRyZXR1cm4gJ3Rva2Vuc3R5bGUtdW5kZWZpbmVkJztcblx0fVxuXHRsZXQgc3RyID0gdHMuZm9yZWdyb3VuZCA/IHRzLmZvcmVncm91bmQudG9TdHJpbmcoKSA6ICduby1mb3JlZ3JvdW5kJztcblx0aWYgKHRzLmJvbGQgIT09IHVuZGVmaW5lZCkge1xuXHRcdHN0ciArPSB0cy5ib2xkID8gJytCJyA6ICctQic7XG5cdH1cblx0aWYgKHRzLnVuZGVybGluZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0c3RyICs9IHRzLnVuZGVybGluZSA/ICcrVScgOiAnLVUnO1xuXHR9XG5cdGlmICh0cy5pdGFsaWMgIT09IHVuZGVmaW5lZCkge1xuXHRcdHN0ciArPSB0cy5pdGFsaWMgPyAnK0knIDogJy1JJztcblx0fVxuXHRyZXR1cm4gc3RyO1xufVxuXG5mdW5jdGlvbiBhc3NlcnRUb2tlblN0eWxlKGFjdHVhbDogVG9rZW5TdHlsZSB8IHVuZGVmaW5lZCB8IG51bGwsIGV4cGVjdGVkOiBUb2tlblN0eWxlIHwgdW5kZWZpbmVkIHwgbnVsbCwgbWVzc2FnZT86IHN0cmluZykge1xuXHRhc3NlcnQuc3RyaWN0RXF1YWwodG9rZW5TdHlsZUFzU3RyaW5nKGFjdHVhbCksIHRva2VuU3R5bGVBc1N0cmluZyhleHBlY3RlZCksIG1lc3NhZ2UpO1xufVxuXG5mdW5jdGlvbiBhc3NlcnRUb2tlblN0eWxlTWV0YURhdGEoY29sb3JJbmRleDogc3RyaW5nW10sIGFjdHVhbDogSVRva2VuU3R5bGUgfCB1bmRlZmluZWQsIGV4cGVjdGVkOiBUb2tlblN0eWxlIHwgdW5kZWZpbmVkIHwgbnVsbCwgbWVzc2FnZSA9ICcnKSB7XG5cdGlmIChleHBlY3RlZCA9PT0gdW5kZWZpbmVkIHx8IGV4cGVjdGVkID09PSBudWxsIHx8IGFjdHVhbCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UpO1xuXHRcdHJldHVybjtcblx0fVxuXHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmJvbGQsIGV4cGVjdGVkLmJvbGQsICdib2xkICcgKyBtZXNzYWdlKTtcblx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5pdGFsaWMsIGV4cGVjdGVkLml0YWxpYywgJ2l0YWxpYyAnICsgbWVzc2FnZSk7XG5cdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwudW5kZXJsaW5lLCBleHBlY3RlZC51bmRlcmxpbmUsICd1bmRlcmxpbmUgJyArIG1lc3NhZ2UpO1xuXG5cdGNvbnN0IGFjdHVhbEZvcmVncm91bmRJbmRleCA9IGFjdHVhbC5mb3JlZ3JvdW5kO1xuXHRpZiAoYWN0dWFsRm9yZWdyb3VuZEluZGV4ICYmIGV4cGVjdGVkLmZvcmVncm91bmQpIHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29sb3JJbmRleFthY3R1YWxGb3JlZ3JvdW5kSW5kZXhdLCBDb2xvci5Gb3JtYXQuQ1NTLmZvcm1hdEhleEEoZXhwZWN0ZWQuZm9yZWdyb3VuZCwgdHJ1ZSkudG9VcHBlckNhc2UoKSwgJ2ZvcmVncm91bmQgJyArIG1lc3NhZ2UpO1xuXHR9IGVsc2Uge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWxGb3JlZ3JvdW5kSW5kZXgsIGV4cGVjdGVkLmZvcmVncm91bmQgfHwgMCwgJ2ZvcmVncm91bmQgJyArIG1lc3NhZ2UpO1xuXHR9XG59XG5cblxuZnVuY3Rpb24gYXNzZXJ0VG9rZW5TdHlsZXModGhlbWVEYXRhOiBDb2xvclRoZW1lRGF0YSwgZXhwZWN0ZWQ6IHsgW3F1YWxpZmllZENsYXNzaWZpZXI6IHN0cmluZ106IFRva2VuU3R5bGUgfSwgbGFuZ3VhZ2UgPSAndHlwZXNjcmlwdCcpIHtcblx0Y29uc3QgY29sb3JJbmRleCA9IHRoZW1lRGF0YS50b2tlbkNvbG9yTWFwO1xuXG5cdGZvciAoY29uc3QgcXVhbGlmaWVkQ2xhc3NpZmllciBpbiBleHBlY3RlZCkge1xuXHRcdGNvbnN0IFt0eXBlLCAuLi5tb2RpZmllcnNdID0gcXVhbGlmaWVkQ2xhc3NpZmllci5zcGxpdCgnLicpO1xuXG5cdFx0Y29uc3QgZXhwZWN0ZWRUb2tlblN0eWxlID0gZXhwZWN0ZWRbcXVhbGlmaWVkQ2xhc3NpZmllcl07XG5cblx0XHRjb25zdCB0b2tlblN0eWxlTWV0YURhdGEgPSB0aGVtZURhdGEuZ2V0VG9rZW5TdHlsZU1ldGFkYXRhKHR5cGUsIG1vZGlmaWVycywgbGFuZ3VhZ2UpO1xuXHRcdGFzc2VydFRva2VuU3R5bGVNZXRhRGF0YShjb2xvckluZGV4LCB0b2tlblN0eWxlTWV0YURhdGEsIGV4cGVjdGVkVG9rZW5TdHlsZSwgcXVhbGlmaWVkQ2xhc3NpZmllcik7XG5cdH1cbn1cblxuc3VpdGUoJ1RoZW1lcyAtIFRva2VuU3R5bGVSZXNvbHZpbmcnLCAoKSA9PiB7XG5cdGNvbnN0IGZpbGVTZXJ2aWNlID0gbmV3IEZpbGVTZXJ2aWNlKG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0Y29uc3QgcmVxdWVzdFNlcnZpY2UgPSBuZXcgKG1vY2s8SVJlcXVlc3RTZXJ2aWNlPigpKSgpO1xuXHRjb25zdCBzdG9yYWdlU2VydmljZSA9IG5ldyAobW9jazxJU3RvcmFnZVNlcnZpY2U+KCkpKCk7XG5cdGNvbnN0IGVudmlyb25tZW50U2VydmljZSA9IG5ldyAobW9jazxJRW52aXJvbm1lbnRTZXJ2aWNlPigpKSgpO1xuXHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyAobW9jazxJQ29uZmlndXJhdGlvblNlcnZpY2U+KCkpKCk7XG5cblx0Y29uc3QgZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlID0gbmV3IEV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZShmaWxlU2VydmljZSwgc3RvcmFnZVNlcnZpY2UsIFRlc3RQcm9kdWN0U2VydmljZSwgZW52aXJvbm1lbnRTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgbmV3IEV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UoVGVzdFByb2R1Y3RTZXJ2aWNlKSwgcmVxdWVzdFNlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblxuXHRjb25zdCBkaXNrRmlsZVN5c3RlbVByb3ZpZGVyID0gbmV3IERpc2tGaWxlU3lzdGVtUHJvdmlkZXIobmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRmaWxlU2VydmljZS5yZWdpc3RlclByb3ZpZGVyKFNjaGVtYXMuZmlsZSwgZGlza0ZpbGVTeXN0ZW1Qcm92aWRlcik7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc2tGaWxlU3lzdGVtUHJvdmlkZXIuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdjb2xvciBkZWZhdWx0cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0aGVtZURhdGEgPSBDb2xvclRoZW1lRGF0YS5jcmVhdGVVbmxvYWRlZFRoZW1lKCdmb28nKTtcblx0XHR0aGVtZURhdGEubG9jYXRpb24gPSBGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvd29ya2JlbmNoL3NlcnZpY2VzL3RoZW1lcy90ZXN0L25vZGUvY29sb3ItdGhlbWUuanNvbicpO1xuXHRcdGF3YWl0IHRoZW1lRGF0YS5lbnN1cmVMb2FkZWQoZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGVtZURhdGEuaXNMb2FkZWQsIHRydWUpO1xuXG5cdFx0YXNzZXJ0VG9rZW5TdHlsZXModGhlbWVEYXRhLCB7XG5cdFx0XHQnY29tbWVudCc6IHRzKCcjMDAwMDAwJywgdW5kZWZpbmVkU3R5bGUpLFxuXHRcdFx0J3ZhcmlhYmxlJzogdHMoJyMxMTExMTEnLCB1bnNldFN0eWxlKSxcblx0XHRcdCd0eXBlJzogdHMoJyMzMzMzMzMnLCB7IGJvbGQ6IGZhbHNlLCB1bmRlcmxpbmU6IHRydWUsIGl0YWxpYzogZmFsc2UgfSksXG5cdFx0XHQnZnVuY3Rpb24nOiB0cygnIzMzMzMzMycsIHVuc2V0U3R5bGUpLFxuXHRcdFx0J3N0cmluZyc6IHRzKCcjNDQ0NDQ0JywgdW5kZWZpbmVkU3R5bGUpLFxuXHRcdFx0J251bWJlcic6IHRzKCcjNTU1NTU1JywgdW5kZWZpbmVkU3R5bGUpLFxuXHRcdFx0J2tleXdvcmQnOiB0cygnIzY2NjY2NicsIHVuZGVmaW5lZFN0eWxlKVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlU2NvcGVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRoZW1lRGF0YSA9IENvbG9yVGhlbWVEYXRhLmNyZWF0ZUxvYWRlZEVtcHR5VGhlbWUoJ3Rlc3QnLCAndGVzdCcpO1xuXG5cdFx0Y29uc3QgY3VzdG9tVG9rZW5Db2xvcnM6IElUb2tlbkNvbG9yQ3VzdG9taXphdGlvbnMgPSB7XG5cdFx0XHR0ZXh0TWF0ZVJ1bGVzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzY29wZTogJ3ZhcmlhYmxlJyxcblx0XHRcdFx0XHRzZXR0aW5nczoge1xuXHRcdFx0XHRcdFx0Zm9udFN0eWxlOiAnJyxcblx0XHRcdFx0XHRcdGZvcmVncm91bmQ6ICcjRjhGOEYyJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHNjb3BlOiAna2V5d29yZC5vcGVyYXRvcicsXG5cdFx0XHRcdFx0c2V0dGluZ3M6IHtcblx0XHRcdFx0XHRcdGZvbnRTdHlsZTogJ2l0YWxpYyBib2xkIHVuZGVybGluZScsXG5cdFx0XHRcdFx0XHRmb3JlZ3JvdW5kOiAnI0Y5MjY3Midcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzY29wZTogJ3N0b3JhZ2UnLFxuXHRcdFx0XHRcdHNldHRpbmdzOiB7XG5cdFx0XHRcdFx0XHRmb250U3R5bGU6ICdpdGFsaWMnLFxuXHRcdFx0XHRcdFx0Zm9yZWdyb3VuZDogJyNGOTI2NzInXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0c2NvcGU6IFsnc3RvcmFnZS50eXBlJywgJ21ldGEuc3RydWN0dXJlLmRpY3Rpb25hcnkuanNvbiBzdHJpbmcucXVvdGVkLmRvdWJsZS5qc29uJ10sXG5cdFx0XHRcdFx0c2V0dGluZ3M6IHtcblx0XHRcdFx0XHRcdGZvcmVncm91bmQ6ICcjNjZEOUVGJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHNjb3BlOiAnZW50aXR5Lm5hbWUudHlwZSwgZW50aXR5Lm5hbWUuY2xhc3MsIGVudGl0eS5uYW1lLm5hbWVzcGFjZSwgZW50aXR5Lm5hbWUuc2NvcGUtcmVzb2x1dGlvbicsXG5cdFx0XHRcdFx0c2V0dGluZ3M6IHtcblx0XHRcdFx0XHRcdGZvbnRTdHlsZTogJ3VuZGVybGluZScsXG5cdFx0XHRcdFx0XHRmb3JlZ3JvdW5kOiAnI0E2RTIyRSdcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRdXG5cdFx0fTtcblxuXHRcdHRoZW1lRGF0YS5zZXRDdXN0b21Ub2tlbkNvbG9ycyhjdXN0b21Ub2tlbkNvbG9ycyk7XG5cblx0XHRsZXQgdG9rZW5TdHlsZTtcblx0XHRjb25zdCBkZWZhdWx0VG9rZW5TdHlsZSA9IHVuZGVmaW5lZDtcblxuXHRcdHRva2VuU3R5bGUgPSB0aGVtZURhdGEucmVzb2x2ZVNjb3BlcyhbWyd2YXJpYWJsZSddXSk7XG5cdFx0YXNzZXJ0VG9rZW5TdHlsZSh0b2tlblN0eWxlLCB0cygnI0Y4RjhGMicsIHVuc2V0U3R5bGUpLCAndmFyaWFibGUnKTtcblxuXHRcdHRva2VuU3R5bGUgPSB0aGVtZURhdGEucmVzb2x2ZVNjb3BlcyhbWydrZXl3b3JkLm9wZXJhdG9yJ11dKTtcblx0XHRhc3NlcnRUb2tlblN0eWxlKHRva2VuU3R5bGUsIHRzKCcjRjkyNjcyJywgeyBpdGFsaWM6IHRydWUsIGJvbGQ6IHRydWUsIHVuZGVybGluZTogdHJ1ZSB9KSwgJ2tleXdvcmQnKTtcblxuXHRcdHRva2VuU3R5bGUgPSB0aGVtZURhdGEucmVzb2x2ZVNjb3BlcyhbWydrZXl3b3JkJ11dKTtcblx0XHRhc3NlcnRUb2tlblN0eWxlKHRva2VuU3R5bGUsIGRlZmF1bHRUb2tlblN0eWxlLCAna2V5d29yZCcpO1xuXG5cdFx0dG9rZW5TdHlsZSA9IHRoZW1lRGF0YS5yZXNvbHZlU2NvcGVzKFtbJ2tleXdvcmQub3BlcmF0b3InXV0pO1xuXHRcdGFzc2VydFRva2VuU3R5bGUodG9rZW5TdHlsZSwgdHMoJyNGOTI2NzInLCB7IGl0YWxpYzogdHJ1ZSwgYm9sZDogdHJ1ZSwgdW5kZXJsaW5lOiB0cnVlIH0pLCAna2V5d29yZC5vcGVyYXRvcicpO1xuXG5cdFx0dG9rZW5TdHlsZSA9IHRoZW1lRGF0YS5yZXNvbHZlU2NvcGVzKFtbJ2tleXdvcmQub3BlcmF0b3JzJ11dKTtcblx0XHRhc3NlcnRUb2tlblN0eWxlKHRva2VuU3R5bGUsIGRlZmF1bHRUb2tlblN0eWxlLCAna2V5d29yZC5vcGVyYXRvcnMnKTtcblxuXHRcdHRva2VuU3R5bGUgPSB0aGVtZURhdGEucmVzb2x2ZVNjb3BlcyhbWydzdG9yYWdlJ11dKTtcblx0XHRhc3NlcnRUb2tlblN0eWxlKHRva2VuU3R5bGUsIHRzKCcjRjkyNjcyJywgeyBpdGFsaWM6IHRydWUsIGJvbGQ6IGZhbHNlLCB1bmRlcmxpbmU6IGZhbHNlIH0pLCAnc3RvcmFnZScpO1xuXG5cdFx0dG9rZW5TdHlsZSA9IHRoZW1lRGF0YS5yZXNvbHZlU2NvcGVzKFtbJ3N0b3JhZ2UudHlwZSddXSk7XG5cdFx0YXNzZXJ0VG9rZW5TdHlsZSh0b2tlblN0eWxlLCB0cygnIzY2RDlFRicsIHsgaXRhbGljOiB0cnVlLCBib2xkOiBmYWxzZSwgdW5kZXJsaW5lOiBmYWxzZSB9KSwgJ3N0b3JhZ2UudHlwZScpO1xuXG5cdFx0dG9rZW5TdHlsZSA9IHRoZW1lRGF0YS5yZXNvbHZlU2NvcGVzKFtbJ2VudGl0eS5uYW1lLmNsYXNzJ11dKTtcblx0XHRhc3NlcnRUb2tlblN0eWxlKHRva2VuU3R5bGUsIHRzKCcjQTZFMjJFJywgeyBpdGFsaWM6IGZhbHNlLCBib2xkOiBmYWxzZSwgdW5kZXJsaW5lOiB0cnVlIH0pLCAnZW50aXR5Lm5hbWUuY2xhc3MnKTtcblxuXHRcdHRva2VuU3R5bGUgPSB0aGVtZURhdGEucmVzb2x2ZVNjb3BlcyhbWydtZXRhLnN0cnVjdHVyZS5kaWN0aW9uYXJ5Lmpzb24nLCAnc3RyaW5nLnF1b3RlZC5kb3VibGUuanNvbiddXSk7XG5cdFx0YXNzZXJ0VG9rZW5TdHlsZSh0b2tlblN0eWxlLCB0cygnIzY2RDlFRicsIHVuZGVmaW5lZCksICdqc29uIHByb3BlcnR5Jyk7XG5cblx0XHR0b2tlblN0eWxlID0gdGhlbWVEYXRhLnJlc29sdmVTY29wZXMoW1snc291cmNlLmpzb24nLCAnbWV0YS5zdHJ1Y3R1cmUuZGljdGlvbmFyeS5qc29uJywgJ3N0cmluZy5xdW90ZWQuZG91YmxlLmpzb24nXV0pO1xuXHRcdGFzc2VydFRva2VuU3R5bGUodG9rZW5TdHlsZSwgdHMoJyM2NkQ5RUYnLCB1bmRlZmluZWQpLCAnanNvbiBwcm9wZXJ0eScpO1xuXG5cdFx0dG9rZW5TdHlsZSA9IHRoZW1lRGF0YS5yZXNvbHZlU2NvcGVzKFtbJ2tleXdvcmQnXSwgWydzdG9yYWdlLnR5cGUnXSwgWydlbnRpdHkubmFtZS5jbGFzcyddXSk7XG5cdFx0YXNzZXJ0VG9rZW5TdHlsZSh0b2tlblN0eWxlLCB0cygnIzY2RDlFRicsIHsgaXRhbGljOiB0cnVlLCBib2xkOiBmYWxzZSwgdW5kZXJsaW5lOiBmYWxzZSB9KSwgJ3N0b3JhZ2UudHlwZScpO1xuXG5cdH0pO1xuXG5cblx0dGVzdCgncmVzb2x2ZVNjb3BlcyAtIG1hdGNoIG1vc3Qgc3BlY2lmaWMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgdGhlbWVEYXRhID0gQ29sb3JUaGVtZURhdGEuY3JlYXRlTG9hZGVkRW1wdHlUaGVtZSgndGVzdCcsICd0ZXN0Jyk7XG5cblx0XHRjb25zdCBjdXN0b21Ub2tlbkNvbG9yczogSVRva2VuQ29sb3JDdXN0b21pemF0aW9ucyA9IHtcblx0XHRcdHRleHRNYXRlUnVsZXM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHNjb3BlOiAnZW50aXR5Lm5hbWUudHlwZScsXG5cdFx0XHRcdFx0c2V0dGluZ3M6IHtcblx0XHRcdFx0XHRcdGZvbnRTdHlsZTogJ3VuZGVybGluZScsXG5cdFx0XHRcdFx0XHRmb3JlZ3JvdW5kOiAnI0E2RTIyRSdcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzY29wZTogJ2VudGl0eS5uYW1lLnR5cGUuY2xhc3MnLFxuXHRcdFx0XHRcdHNldHRpbmdzOiB7XG5cdFx0XHRcdFx0XHRmb3JlZ3JvdW5kOiAnI0ZGMDBGRidcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzY29wZTogJ2VudGl0eS5uYW1lJyxcblx0XHRcdFx0XHRzZXR0aW5nczoge1xuXHRcdFx0XHRcdFx0Zm9yZWdyb3VuZDogJyNGRkZGRkYnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XVxuXHRcdH07XG5cblx0XHR0aGVtZURhdGEuc2V0Q3VzdG9tVG9rZW5Db2xvcnMoY3VzdG9tVG9rZW5Db2xvcnMpO1xuXG5cdFx0Y29uc3QgdG9rZW5TdHlsZSA9IHRoZW1lRGF0YS5yZXNvbHZlU2NvcGVzKFtbJ2VudGl0eS5uYW1lLnR5cGUuY2xhc3MnXV0pO1xuXHRcdGFzc2VydFRva2VuU3R5bGUodG9rZW5TdHlsZSwgdHMoJyNGRjAwRkYnLCB7IGl0YWxpYzogZmFsc2UsIGJvbGQ6IGZhbHNlLCB1bmRlcmxpbmU6IHRydWUgfSksICdlbnRpdHkubmFtZS50eXBlLmNsYXNzJyk7XG5cblx0fSk7XG5cblxuXHR0ZXN0KCdydWxlIG1hdGNoaW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRoZW1lRGF0YSA9IENvbG9yVGhlbWVEYXRhLmNyZWF0ZUxvYWRlZEVtcHR5VGhlbWUoJ3Rlc3QnLCAndGVzdCcpO1xuXHRcdHRoZW1lRGF0YS5zZXRDdXN0b21Db2xvcnMoeyAnZWRpdG9yLmZvcmVncm91bmQnOiAnIzAwMDAwMCcgfSk7XG5cdFx0dGhlbWVEYXRhLnNldEN1c3RvbVNlbWFudGljVG9rZW5Db2xvcnMoe1xuXHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdHJ1bGVzOiB7XG5cdFx0XHRcdCd0eXBlJzogJyNmZjAwMDAnLFxuXHRcdFx0XHQnY2xhc3MnOiB7IGZvcmVncm91bmQ6ICcjMDAwMGZmJywgaXRhbGljOiB0cnVlIH0sXG5cdFx0XHRcdCcqLnN0YXRpYyc6IHsgYm9sZDogdHJ1ZSB9LFxuXHRcdFx0XHQnKi5kZWNsYXJhdGlvbic6IHsgaXRhbGljOiB0cnVlIH0sXG5cdFx0XHRcdCcqLmFzeW5jLnN0YXRpYyc6IHsgaXRhbGljOiB0cnVlLCB1bmRlcmxpbmU6IHRydWUgfSxcblx0XHRcdFx0JyouYXN5bmMnOiB7IGZvcmVncm91bmQ6ICcjMDAwZmZmJywgdW5kZXJsaW5lOiB0cnVlIH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGFzc2VydFRva2VuU3R5bGVzKHRoZW1lRGF0YSwge1xuXHRcdFx0J3R5cGUnOiB0cygnI2ZmMDAwMCcsIHVuZGVmaW5lZFN0eWxlKSxcblx0XHRcdCd0eXBlLnN0YXRpYyc6IHRzKCcjZmYwMDAwJywgeyBib2xkOiB0cnVlIH0pLFxuXHRcdFx0J3R5cGUuc3RhdGljLmRlY2xhcmF0aW9uJzogdHMoJyNmZjAwMDAnLCB7IGJvbGQ6IHRydWUsIGl0YWxpYzogdHJ1ZSB9KSxcblx0XHRcdCdjbGFzcyc6IHRzKCcjMDAwMGZmJywgeyBpdGFsaWM6IHRydWUgfSksXG5cdFx0XHQnY2xhc3Muc3RhdGljLmRlY2xhcmF0aW9uJzogdHMoJyMwMDAwZmYnLCB7IGJvbGQ6IHRydWUsIGl0YWxpYzogdHJ1ZSwgfSksXG5cdFx0XHQnY2xhc3MuZGVjbGFyYXRpb24nOiB0cygnIzAwMDBmZicsIHsgaXRhbGljOiB0cnVlIH0pLFxuXHRcdFx0J2NsYXNzLmRlY2xhcmF0aW9uLmFzeW5jJzogdHMoJyMwMDBmZmYnLCB7IHVuZGVybGluZTogdHJ1ZSwgaXRhbGljOiB0cnVlIH0pLFxuXHRcdFx0J2NsYXNzLmRlY2xhcmF0aW9uLmFzeW5jLnN0YXRpYyc6IHRzKCcjMDAwZmZmJywgeyBpdGFsaWM6IHRydWUsIHVuZGVybGluZTogdHJ1ZSwgYm9sZDogdHJ1ZSB9KSxcblx0XHR9KTtcblxuXHR9KTtcblxuXHR0ZXN0KCdzdXBlciB0eXBlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlZ2lzdHJ5ID0gZ2V0VG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5KCk7XG5cblx0XHRyZWdpc3RyeS5yZWdpc3RlclRva2VuVHlwZSgnbXlUZXN0SW50ZXJmYWNlJywgJ0EgdHlwZSBqdXN0IGZvciB0ZXN0aW5nJywgJ2ludGVyZmFjZScpO1xuXHRcdHJlZ2lzdHJ5LnJlZ2lzdGVyVG9rZW5UeXBlKCdteVRlc3RTdWJJbnRlcmZhY2UnLCAnQSB0eXBlIGp1c3QgZm9yIHRlc3RpbmcnLCAnbXlUZXN0SW50ZXJmYWNlJyk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdGhlbWVEYXRhID0gQ29sb3JUaGVtZURhdGEuY3JlYXRlTG9hZGVkRW1wdHlUaGVtZSgndGVzdCcsICd0ZXN0Jyk7XG5cdFx0XHR0aGVtZURhdGEuc2V0Q3VzdG9tQ29sb3JzKHsgJ2VkaXRvci5mb3JlZ3JvdW5kJzogJyMwMDAwMDAnIH0pO1xuXHRcdFx0dGhlbWVEYXRhLnNldEN1c3RvbVNlbWFudGljVG9rZW5Db2xvcnMoe1xuXHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRydWxlczoge1xuXHRcdFx0XHRcdCdpbnRlcmZhY2UnOiAnI2ZmMDAwMCcsXG5cdFx0XHRcdFx0J215VGVzdEludGVyZmFjZSc6IHsgaXRhbGljOiB0cnVlIH0sXG5cdFx0XHRcdFx0J2ludGVyZmFjZS5zdGF0aWMnOiB7IGJvbGQ6IHRydWUgfVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0VG9rZW5TdHlsZXModGhlbWVEYXRhLCB7ICdteVRlc3RTdWJJbnRlcmZhY2UnOiB0cygnI2ZmMDAwMCcsIHsgaXRhbGljOiB0cnVlIH0pIH0pO1xuXHRcdFx0YXNzZXJ0VG9rZW5TdHlsZXModGhlbWVEYXRhLCB7ICdteVRlc3RTdWJJbnRlcmZhY2Uuc3RhdGljJzogdHMoJyNmZjAwMDAnLCB7IGl0YWxpYzogdHJ1ZSwgYm9sZDogdHJ1ZSB9KSB9KTtcblxuXHRcdFx0dGhlbWVEYXRhLnNldEN1c3RvbVNlbWFudGljVG9rZW5Db2xvcnMoe1xuXHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRydWxlczoge1xuXHRcdFx0XHRcdCdpbnRlcmZhY2UnOiAnI2ZmMDAwMCcsXG5cdFx0XHRcdFx0J215VGVzdEludGVyZmFjZSc6IHsgZm9yZWdyb3VuZDogJyNmZjAwZmYnLCBpdGFsaWM6IHRydWUgfVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdGFzc2VydFRva2VuU3R5bGVzKHRoZW1lRGF0YSwgeyAnbXlUZXN0U3ViSW50ZXJmYWNlJzogdHMoJyNmZjAwZmYnLCB7IGl0YWxpYzogdHJ1ZSB9KSB9KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0cmVnaXN0cnkuZGVyZWdpc3RlclRva2VuVHlwZSgnbXlUZXN0SW50ZXJmYWNlJyk7XG5cdFx0XHRyZWdpc3RyeS5kZXJlZ2lzdGVyVG9rZW5UeXBlKCdteVRlc3RTdWJJbnRlcmZhY2UnKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2xhbmd1YWdlJywgYXN5bmMgKCkgPT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCB0aGVtZURhdGEgPSBDb2xvclRoZW1lRGF0YS5jcmVhdGVMb2FkZWRFbXB0eVRoZW1lKCd0ZXN0JywgJ3Rlc3QnKTtcblx0XHRcdHRoZW1lRGF0YS5zZXRDdXN0b21Db2xvcnMoeyAnZWRpdG9yLmZvcmVncm91bmQnOiAnIzAwMDAwMCcgfSk7XG5cdFx0XHR0aGVtZURhdGEuc2V0Q3VzdG9tU2VtYW50aWNUb2tlbkNvbG9ycyh7XG5cdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdHJ1bGVzOiB7XG5cdFx0XHRcdFx0J2ludGVyZmFjZSc6ICcjZmZmMDAwJyxcblx0XHRcdFx0XHQnaW50ZXJmYWNlOmphdmEnOiAnI2ZmMDAwMCcsXG5cdFx0XHRcdFx0J2ludGVyZmFjZS5zdGF0aWMnOiB7IGJvbGQ6IHRydWUgfSxcblx0XHRcdFx0XHQnaW50ZXJmYWNlLnN0YXRpYzp0eXBlc2NyaXB0JzogeyBpdGFsaWM6IHRydWUgfVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0VG9rZW5TdHlsZXModGhlbWVEYXRhLCB7ICdpbnRlcmZhY2UnOiB0cygnI2ZmMDAwMCcsIHVuZGVmaW5lZCkgfSwgJ2phdmEnKTtcblx0XHRcdGFzc2VydFRva2VuU3R5bGVzKHRoZW1lRGF0YSwgeyAnaW50ZXJmYWNlJzogdHMoJyNmZmYwMDAnLCB1bmRlZmluZWQpIH0sICd0eXBlc2NyaXB0Jyk7XG5cdFx0XHRhc3NlcnRUb2tlblN0eWxlcyh0aGVtZURhdGEsIHsgJ2ludGVyZmFjZS5zdGF0aWMnOiB0cygnI2ZmMDAwMCcsIHsgYm9sZDogdHJ1ZSB9KSB9LCAnamF2YScpO1xuXHRcdFx0YXNzZXJ0VG9rZW5TdHlsZXModGhlbWVEYXRhLCB7ICdpbnRlcmZhY2Uuc3RhdGljJzogdHMoJyNmZmYwMDAnLCB7IGJvbGQ6IHRydWUsIGl0YWxpYzogdHJ1ZSB9KSB9LCAndHlwZXNjcmlwdCcpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdsYW5ndWFnZSAtIHNjb3BlIHJlc29sdmluZycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZWdpc3RyeSA9IGdldFRva2VuQ2xhc3NpZmljYXRpb25SZWdpc3RyeSgpO1xuXG5cdFx0Y29uc3QgbnVtYmVyT2ZEZWZhdWx0UnVsZXMgPSByZWdpc3RyeS5nZXRUb2tlblN0eWxpbmdEZWZhdWx0UnVsZXMoKS5sZW5ndGg7XG5cblx0XHRyZWdpc3RyeS5yZWdpc3RlclRva2VuU3R5bGVEZWZhdWx0KHJlZ2lzdHJ5LnBhcnNlVG9rZW5TZWxlY3RvcigndHlwZScsICd0eXBlc2NyaXB0MScpLCB7IHNjb3Blc1RvUHJvYmU6IFtbJ2VudGl0eS5uYW1lLnR5cGUudHMxJ11dIH0pO1xuXHRcdHJlZ2lzdHJ5LnJlZ2lzdGVyVG9rZW5TdHlsZURlZmF1bHQocmVnaXN0cnkucGFyc2VUb2tlblNlbGVjdG9yKCd0eXBlOmphdmFzY3JpcHQxJyksIHsgc2NvcGVzVG9Qcm9iZTogW1snZW50aXR5Lm5hbWUudHlwZS5qczEnXV0gfSk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdGhlbWVEYXRhID0gQ29sb3JUaGVtZURhdGEuY3JlYXRlTG9hZGVkRW1wdHlUaGVtZSgndGVzdCcsICd0ZXN0Jyk7XG5cdFx0XHR0aGVtZURhdGEuc2V0Q3VzdG9tQ29sb3JzKHsgJ2VkaXRvci5mb3JlZ3JvdW5kJzogJyMwMDAwMDAnIH0pO1xuXHRcdFx0dGhlbWVEYXRhLnNldEN1c3RvbVRva2VuQ29sb3JzKHtcblx0XHRcdFx0dGV4dE1hdGVSdWxlczogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHNjb3BlOiAnZW50aXR5Lm5hbWUudHlwZScsXG5cdFx0XHRcdFx0XHRzZXR0aW5nczogeyBmb3JlZ3JvdW5kOiAnI2FhMDAwMCcgfVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0c2NvcGU6ICdlbnRpdHkubmFtZS50eXBlLnRzMScsXG5cdFx0XHRcdFx0XHRzZXR0aW5nczogeyBmb3JlZ3JvdW5kOiAnI2JiMDAwMCcgfVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydFRva2VuU3R5bGVzKHRoZW1lRGF0YSwgeyAndHlwZSc6IHRzKCcjYWEwMDAwJywgdW5kZWZpbmVkKSB9LCAnamF2YXNjcmlwdDEnKTtcblx0XHRcdGFzc2VydFRva2VuU3R5bGVzKHRoZW1lRGF0YSwgeyAndHlwZSc6IHRzKCcjYmIwMDAwJywgdW5kZWZpbmVkKSB9LCAndHlwZXNjcmlwdDEnKTtcblxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRyZWdpc3RyeS5kZXJlZ2lzdGVyVG9rZW5TdHlsZURlZmF1bHQocmVnaXN0cnkucGFyc2VUb2tlblNlbGVjdG9yKCd0eXBlJywgJ3R5cGVzY3JpcHQxJykpO1xuXHRcdFx0cmVnaXN0cnkuZGVyZWdpc3RlclRva2VuU3R5bGVEZWZhdWx0KHJlZ2lzdHJ5LnBhcnNlVG9rZW5TZWxlY3RvcigndHlwZTpqYXZhc2NyaXB0MScpKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldFRva2VuU3R5bGluZ0RlZmF1bHRSdWxlcygpLmxlbmd0aCwgbnVtYmVyT2ZEZWZhdWx0UnVsZXMpO1xuXHRcdH1cblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsc0JBQXNCO0FBQy9CLE9BQU8sWUFBWTtBQUVuQixTQUFTLFlBQVksc0NBQXNDO0FBQzNELFNBQVMsYUFBYTtBQUN0QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLFlBQVksZUFBZTtBQUNwQyxTQUFTLHNDQUFzQztBQUUvQyxTQUFTLE1BQU0sMEJBQTBCO0FBS3pDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsdUNBQXVDO0FBRWhELE1BQU0saUJBQWlCLEVBQUUsTUFBTSxRQUFXLFdBQVcsUUFBVyxRQUFRLE9BQVU7QUFDbEYsTUFBTSxhQUFhLEVBQUUsTUFBTSxPQUFPLFdBQVcsT0FBTyxRQUFRLE1BQU07QUFFbEUsU0FBUyxHQUFHLFlBQWdDLFlBQXdIO0FBQ25LLFFBQU0sa0JBQWtCLFNBQVMsVUFBVSxJQUFJLE1BQU0sUUFBUSxVQUFVLElBQUk7QUFDM0UsU0FBTyxJQUFJLFdBQVcsaUJBQWlCLFlBQVksTUFBTSxZQUFZLFdBQVcsWUFBWSxlQUFl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
