import { notStrictEqual, ok, strictEqual } from "assert";
import { getActiveWindow } from "../../../../../base/browser/dom.js";
import { mainWindow } from "../../../../../base/browser/window.js";
import { isLinux } from "../../../../../base/common/platform.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { EDITOR_FONT_DEFAULTS } from "../../../../../editor/common/config/editorOptions.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { ITerminalConfigurationService, LinuxDistro } from "../../browser/terminal.js";
import { TestTerminalConfigurationService, workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
suite("Workbench - TerminalConfigurationService", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let configurationService;
  let terminalConfigurationService;
  setup(() => {
    const instantiationService = workbenchInstantiationService(void 0, store);
    configurationService = instantiationService.get(IConfigurationService);
    terminalConfigurationService = instantiationService.get(ITerminalConfigurationService);
  });
  suite("config", () => {
    test("should update on any change to terminal.integrated", () => {
      const originalConfig = terminalConfigurationService.config;
      configurationService.onDidChangeConfigurationEmitter.fire({
        affectsConfiguration: (configuration) => configuration.startsWith("terminal.integrated"),
        affectedKeys: /* @__PURE__ */ new Set(["terminal.integrated.fontWeight"]),
        change: null,
        source: ConfigurationTarget.USER
      });
      notStrictEqual(terminalConfigurationService.config, originalConfig, "Object reference must change");
    });
    suite("onConfigChanged", () => {
      test("should fire on any change to terminal.integrated", async () => {
        await new Promise((r) => {
          store.add(terminalConfigurationService.onConfigChanged(() => r()));
          configurationService.onDidChangeConfigurationEmitter.fire({
            affectsConfiguration: (configuration) => configuration.startsWith("terminal.integrated"),
            affectedKeys: /* @__PURE__ */ new Set(["terminal.integrated.fontWeight"]),
            change: null,
            source: ConfigurationTarget.USER
          });
        });
      });
    });
  });
  function createTerminalConfigationService(config, linuxDistro) {
    const instantiationService = new TestInstantiationService();
    instantiationService.set(IConfigurationService, new TestConfigurationService(config));
    const terminalConfigurationService2 = store.add(instantiationService.createInstance(TestTerminalConfigurationService));
    instantiationService.set(ITerminalConfigurationService, terminalConfigurationService2);
    terminalConfigurationService2.setPanelContainer(mainWindow.document.body);
    if (linuxDistro) {
      terminalConfigurationService2.fontMetrics.linuxDistro = linuxDistro;
    }
    return terminalConfigurationService2;
  }
  suite("getFont", () => {
    test("fontFamily", () => {
      const terminalConfigurationService2 = createTerminalConfigationService({
        editor: { fontFamily: "foo" },
        terminal: { integrated: { fontFamily: "bar" } }
      });
      ok(terminalConfigurationService2.getFont(getActiveWindow()).fontFamily.startsWith("bar"), "terminal.integrated.fontFamily should be selected over editor.fontFamily");
    });
    test("fontFamily (Linux Fedora)", () => {
      const terminalConfigurationService2 = createTerminalConfigationService({
        editor: { fontFamily: "foo" },
        terminal: { integrated: { fontFamily: null } }
      }, LinuxDistro.Fedora);
      ok(terminalConfigurationService2.getFont(getActiveWindow()).fontFamily.startsWith("'DejaVu Sans Mono'"), "Fedora should have its font overridden when terminal.integrated.fontFamily not set");
    });
    test("fontFamily (Linux Ubuntu)", () => {
      const terminalConfigurationService2 = createTerminalConfigationService({
        editor: { fontFamily: "foo" },
        terminal: { integrated: { fontFamily: null } }
      }, LinuxDistro.Ubuntu);
      ok(terminalConfigurationService2.getFont(getActiveWindow()).fontFamily.startsWith("'Ubuntu Mono'"), "Ubuntu should have its font overridden when terminal.integrated.fontFamily not set");
    });
    test("fontFamily (Linux Unknown)", () => {
      const terminalConfigurationService2 = createTerminalConfigationService({
        editor: { fontFamily: "foo" },
        terminal: { integrated: { fontFamily: null } }
      });
      ok(terminalConfigurationService2.getFont(getActiveWindow()).fontFamily.startsWith("foo"), "editor.fontFamily should be the fallback when terminal.integrated.fontFamily not set");
    });
    test("fontSize 10", () => {
      const terminalConfigurationService2 = createTerminalConfigationService({
        editor: {
          fontFamily: "foo",
          fontSize: 9
        },
        terminal: {
          integrated: {
            fontFamily: "bar",
            fontSize: 10
          }
        }
      });
      strictEqual(terminalConfigurationService2.getFont(getActiveWindow()).fontSize, 10, "terminal.integrated.fontSize should be selected over editor.fontSize");
    });
    test("fontSize 0", () => {
      let terminalConfigurationService2 = createTerminalConfigationService({
        editor: {
          fontFamily: "foo"
        },
        terminal: {
          integrated: {
            fontFamily: null,
            fontSize: 0
          }
        }
      }, LinuxDistro.Ubuntu);
      strictEqual(terminalConfigurationService2.getFont(getActiveWindow()).fontSize, 8, "The minimum terminal font size (with adjustment) should be used when terminal.integrated.fontSize less than it");
      terminalConfigurationService2 = createTerminalConfigationService({
        editor: {
          fontFamily: "foo"
        },
        terminal: {
          integrated: {
            fontFamily: null,
            fontSize: 0
          }
        }
      });
      strictEqual(terminalConfigurationService2.getFont(getActiveWindow()).fontSize, 6, "The minimum terminal font size should be used when terminal.integrated.fontSize less than it");
    });
    test("fontSize 1500", () => {
      const terminalConfigurationService2 = createTerminalConfigationService({
        editor: {
          fontFamily: "foo"
        },
        terminal: {
          integrated: {
            fontFamily: 0,
            fontSize: 1500
          }
        }
      });
      strictEqual(terminalConfigurationService2.getFont(getActiveWindow()).fontSize, 100, "The maximum terminal font size should be used when terminal.integrated.fontSize more than it");
    });
    test("fontSize null", () => {
      let terminalConfigurationService2 = createTerminalConfigationService({
        editor: {
          fontFamily: "foo"
        },
        terminal: {
          integrated: {
            fontFamily: 0,
            fontSize: null
          }
        }
      }, LinuxDistro.Ubuntu);
      strictEqual(terminalConfigurationService2.getFont(getActiveWindow()).fontSize, EDITOR_FONT_DEFAULTS.fontSize + 2, "The default editor font size (with adjustment) should be used when terminal.integrated.fontSize is not set");
      terminalConfigurationService2 = createTerminalConfigationService({
        editor: {
          fontFamily: "foo"
        },
        terminal: {
          integrated: {
            fontFamily: 0,
            fontSize: null
          }
        }
      });
      strictEqual(terminalConfigurationService2.getFont(getActiveWindow()).fontSize, EDITOR_FONT_DEFAULTS.fontSize, "The default editor font size should be used when terminal.integrated.fontSize is not set");
    });
    test("lineHeight 2", () => {
      const terminalConfigurationService2 = createTerminalConfigationService({
        editor: {
          fontFamily: "foo",
          lineHeight: 1
        },
        terminal: {
          integrated: {
            fontFamily: 0,
            lineHeight: 2
          }
        }
      });
      strictEqual(terminalConfigurationService2.getFont(getActiveWindow()).lineHeight, 2, "terminal.integrated.lineHeight should be selected over editor.lineHeight");
    });
    test("lineHeight 0", () => {
      const terminalConfigurationService2 = createTerminalConfigationService({
        editor: {
          fontFamily: "foo",
          lineHeight: 1
        },
        terminal: {
          integrated: {
            fontFamily: 0,
            lineHeight: 0
          }
        }
      });
      strictEqual(terminalConfigurationService2.getFont(getActiveWindow()).lineHeight, isLinux ? 1.1 : 1, "editor.lineHeight should be the default when terminal.integrated.lineHeight not set");
    });
  });
  suite("configFontIsMonospace", () => {
    test("isMonospace monospace", () => {
      const terminalConfigurationService2 = createTerminalConfigationService({
        terminal: {
          integrated: {
            fontFamily: "monospace"
          }
        }
      });
      strictEqual(terminalConfigurationService2.configFontIsMonospace(), true, "monospace is monospaced");
    });
    test("isMonospace sans-serif", () => {
      const terminalConfigurationService2 = createTerminalConfigationService({
        terminal: {
          integrated: {
            fontFamily: "sans-serif"
          }
        }
      });
      strictEqual(terminalConfigurationService2.configFontIsMonospace(), false, "sans-serif is not monospaced");
    });
    test("isMonospace serif", () => {
      const terminalConfigurationService2 = createTerminalConfigationService({
        terminal: {
          integrated: {
            fontFamily: "serif"
          }
        }
      });
      strictEqual(terminalConfigurationService2.configFontIsMonospace(), false, "serif is not monospaced");
    });
    test("isMonospace monospace falls back to editor.fontFamily", () => {
      const terminalConfigurationService2 = createTerminalConfigationService({
        editor: {
          fontFamily: "monospace"
        },
        terminal: {
          integrated: {
            fontFamily: null
          }
        }
      });
      strictEqual(terminalConfigurationService2.configFontIsMonospace(), true, "monospace is monospaced");
    });
    test("isMonospace sans-serif falls back to editor.fontFamily", () => {
      const terminalConfigurationService2 = createTerminalConfigationService({
        editor: {
          fontFamily: "sans-serif"
        },
        terminal: {
          integrated: {
            fontFamily: null
          }
        }
      });
      strictEqual(terminalConfigurationService2.configFontIsMonospace(), false, "sans-serif is not monospaced");
    });
    test("isMonospace serif falls back to editor.fontFamily", () => {
      const terminalConfigurationService2 = createTerminalConfigationService({
        editor: {
          fontFamily: "serif"
        },
        terminal: {
          integrated: {
            fontFamily: null
          }
        }
      });
      strictEqual(terminalConfigurationService2.configFontIsMonospace(), false, "serif is not monospaced");
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2Jyb3dzZXIvdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbm90U3RyaWN0RXF1YWwsIG9rLCBzdHJpY3RFcXVhbCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBnZXRBY3RpdmVXaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IGlzTGludXggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IEVESVRPUl9GT05UX0RFRkFVTFRTIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uVGFyZ2V0LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLCBMaW51eERpc3RybyB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdGVybWluYWwuanMnO1xuaW1wb3J0IHsgVGVzdFRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UsIHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5cbnN1aXRlKCdXb3JrYmVuY2ggLSBUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlJywgKCkgPT4ge1xuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGxldCBjb25maWd1cmF0aW9uU2VydmljZTogVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlO1xuXHRsZXQgdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZTogSVRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2U7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBzdG9yZSk7XG5cdFx0Y29uZmlndXJhdGlvblNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSBhcyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2U7XG5cdFx0dGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdjb25maWcnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIHVwZGF0ZSBvbiBhbnkgY2hhbmdlIHRvIHRlcm1pbmFsLmludGVncmF0ZWQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBvcmlnaW5hbENvbmZpZyA9IHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnO1xuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uRW1pdHRlci5maXJlKHtcblx0XHRcdFx0YWZmZWN0c0NvbmZpZ3VyYXRpb246IGNvbmZpZ3VyYXRpb24gPT4gY29uZmlndXJhdGlvbi5zdGFydHNXaXRoKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkJyksXG5cdFx0XHRcdGFmZmVjdGVkS2V5czogbmV3IFNldChbJ3Rlcm1pbmFsLmludGVncmF0ZWQuZm9udFdlaWdodCddKSxcblx0XHRcdFx0Y2hhbmdlOiBudWxsISxcblx0XHRcdFx0c291cmNlOiBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJcblx0XHRcdH0pO1xuXHRcdFx0bm90U3RyaWN0RXF1YWwodGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcsIG9yaWdpbmFsQ29uZmlnLCAnT2JqZWN0IHJlZmVyZW5jZSBtdXN0IGNoYW5nZScpO1xuXHRcdH0pO1xuXG5cdFx0c3VpdGUoJ29uQ29uZmlnQ2hhbmdlZCcsICgpID0+IHtcblx0XHRcdHRlc3QoJ3Nob3VsZCBmaXJlIG9uIGFueSBjaGFuZ2UgdG8gdGVybWluYWwuaW50ZWdyYXRlZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ociA9PiB7XG5cdFx0XHRcdFx0c3RvcmUuYWRkKHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2Uub25Db25maWdDaGFuZ2VkKCgpID0+IHIoKSkpO1xuXHRcdFx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbkVtaXR0ZXIuZmlyZSh7XG5cdFx0XHRcdFx0XHRhZmZlY3RzQ29uZmlndXJhdGlvbjogY29uZmlndXJhdGlvbiA9PiBjb25maWd1cmF0aW9uLnN0YXJ0c1dpdGgoJ3Rlcm1pbmFsLmludGVncmF0ZWQnKSxcblx0XHRcdFx0XHRcdGFmZmVjdGVkS2V5czogbmV3IFNldChbJ3Rlcm1pbmFsLmludGVncmF0ZWQuZm9udFdlaWdodCddKSxcblx0XHRcdFx0XHRcdGNoYW5nZTogbnVsbCEsXG5cdFx0XHRcdFx0XHRzb3VyY2U6IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUlxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBjcmVhdGVUZXJtaW5hbENvbmZpZ2F0aW9uU2VydmljZShjb25maWc6IGFueSwgbGludXhEaXN0cm8/OiBMaW51eERpc3Rybyk6IElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlIHtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKGNvbmZpZykpO1xuXHRcdGNvbnN0IHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zZXQoSVRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UsIHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2Uuc2V0UGFuZWxDb250YWluZXIobWFpbldpbmRvdy5kb2N1bWVudC5ib2R5KTtcblx0XHRpZiAobGludXhEaXN0cm8pIHtcblx0XHRcdHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuZm9udE1ldHJpY3MubGludXhEaXN0cm8gPSBsaW51eERpc3Rybztcblx0XHR9XG5cdFx0cmV0dXJuIHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2U7XG5cdH1cblxuXHRzdWl0ZSgnZ2V0Rm9udCcsICgpID0+IHtcblx0XHR0ZXN0KCdmb250RmFtaWx5JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSA9IGNyZWF0ZVRlcm1pbmFsQ29uZmlnYXRpb25TZXJ2aWNlKHtcblx0XHRcdFx0ZWRpdG9yOiB7IGZvbnRGYW1pbHk6ICdmb28nIH0sXG5cdFx0XHRcdHRlcm1pbmFsOiB7IGludGVncmF0ZWQ6IHsgZm9udEZhbWlseTogJ2JhcicgfSB9XG5cdFx0XHR9KTtcblx0XHRcdG9rKHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuZ2V0Rm9udChnZXRBY3RpdmVXaW5kb3coKSkuZm9udEZhbWlseS5zdGFydHNXaXRoKCdiYXInKSwgJ3Rlcm1pbmFsLmludGVncmF0ZWQuZm9udEZhbWlseSBzaG91bGQgYmUgc2VsZWN0ZWQgb3ZlciBlZGl0b3IuZm9udEZhbWlseScpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZm9udEZhbWlseSAoTGludXggRmVkb3JhKScsICgpID0+IHtcblx0XHRcdGNvbnN0IHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UgPSBjcmVhdGVUZXJtaW5hbENvbmZpZ2F0aW9uU2VydmljZSh7XG5cdFx0XHRcdGVkaXRvcjogeyBmb250RmFtaWx5OiAnZm9vJyB9LFxuXHRcdFx0XHR0ZXJtaW5hbDogeyBpbnRlZ3JhdGVkOiB7IGZvbnRGYW1pbHk6IG51bGwgfSB9XG5cdFx0XHR9LCBMaW51eERpc3Ryby5GZWRvcmEpO1xuXHRcdFx0b2sodGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5nZXRGb250KGdldEFjdGl2ZVdpbmRvdygpKS5mb250RmFtaWx5LnN0YXJ0c1dpdGgoJ1xcJ0RlamFWdSBTYW5zIE1vbm9cXCcnKSwgJ0ZlZG9yYSBzaG91bGQgaGF2ZSBpdHMgZm9udCBvdmVycmlkZGVuIHdoZW4gdGVybWluYWwuaW50ZWdyYXRlZC5mb250RmFtaWx5IG5vdCBzZXQnKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2ZvbnRGYW1pbHkgKExpbnV4IFVidW50dSknLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlID0gY3JlYXRlVGVybWluYWxDb25maWdhdGlvblNlcnZpY2Uoe1xuXHRcdFx0XHRlZGl0b3I6IHsgZm9udEZhbWlseTogJ2ZvbycgfSxcblx0XHRcdFx0dGVybWluYWw6IHsgaW50ZWdyYXRlZDogeyBmb250RmFtaWx5OiBudWxsIH0gfVxuXHRcdFx0fSwgTGludXhEaXN0cm8uVWJ1bnR1KTtcblx0XHRcdG9rKHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuZ2V0Rm9udChnZXRBY3RpdmVXaW5kb3coKSkuZm9udEZhbWlseS5zdGFydHNXaXRoKCdcXCdVYnVudHUgTW9ub1xcJycpLCAnVWJ1bnR1IHNob3VsZCBoYXZlIGl0cyBmb250IG92ZXJyaWRkZW4gd2hlbiB0ZXJtaW5hbC5pbnRlZ3JhdGVkLmZvbnRGYW1pbHkgbm90IHNldCcpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZm9udEZhbWlseSAoTGludXggVW5rbm93biknLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlID0gY3JlYXRlVGVybWluYWxDb25maWdhdGlvblNlcnZpY2Uoe1xuXHRcdFx0XHRlZGl0b3I6IHsgZm9udEZhbWlseTogJ2ZvbycgfSxcblx0XHRcdFx0dGVybWluYWw6IHsgaW50ZWdyYXRlZDogeyBmb250RmFtaWx5OiBudWxsIH0gfVxuXHRcdFx0fSk7XG5cdFx0XHRvayh0ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldEZvbnQoZ2V0QWN0aXZlV2luZG93KCkpLmZvbnRGYW1pbHkuc3RhcnRzV2l0aCgnZm9vJyksICdlZGl0b3IuZm9udEZhbWlseSBzaG91bGQgYmUgdGhlIGZhbGxiYWNrIHdoZW4gdGVybWluYWwuaW50ZWdyYXRlZC5mb250RmFtaWx5IG5vdCBzZXQnKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2ZvbnRTaXplIDEwJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSA9IGNyZWF0ZVRlcm1pbmFsQ29uZmlnYXRpb25TZXJ2aWNlKHtcblx0XHRcdFx0ZWRpdG9yOiB7XG5cdFx0XHRcdFx0Zm9udEZhbWlseTogJ2ZvbycsXG5cdFx0XHRcdFx0Zm9udFNpemU6IDlcblx0XHRcdFx0fSxcblx0XHRcdFx0dGVybWluYWw6IHtcblx0XHRcdFx0XHRpbnRlZ3JhdGVkOiB7XG5cdFx0XHRcdFx0XHRmb250RmFtaWx5OiAnYmFyJyxcblx0XHRcdFx0XHRcdGZvbnRTaXplOiAxMFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldEZvbnQoZ2V0QWN0aXZlV2luZG93KCkpLmZvbnRTaXplLCAxMCwgJ3Rlcm1pbmFsLmludGVncmF0ZWQuZm9udFNpemUgc2hvdWxkIGJlIHNlbGVjdGVkIG92ZXIgZWRpdG9yLmZvbnRTaXplJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdmb250U2l6ZSAwJywgKCkgPT4ge1xuXHRcdFx0bGV0IHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UgPSBjcmVhdGVUZXJtaW5hbENvbmZpZ2F0aW9uU2VydmljZSh7XG5cdFx0XHRcdGVkaXRvcjoge1xuXHRcdFx0XHRcdGZvbnRGYW1pbHk6ICdmb28nXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHRlcm1pbmFsOiB7XG5cdFx0XHRcdFx0aW50ZWdyYXRlZDoge1xuXHRcdFx0XHRcdFx0Zm9udEZhbWlseTogbnVsbCxcblx0XHRcdFx0XHRcdGZvbnRTaXplOiAwXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LCBMaW51eERpc3Ryby5VYnVudHUpO1xuXHRcdFx0c3RyaWN0RXF1YWwodGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5nZXRGb250KGdldEFjdGl2ZVdpbmRvdygpKS5mb250U2l6ZSwgOCwgJ1RoZSBtaW5pbXVtIHRlcm1pbmFsIGZvbnQgc2l6ZSAod2l0aCBhZGp1c3RtZW50KSBzaG91bGQgYmUgdXNlZCB3aGVuIHRlcm1pbmFsLmludGVncmF0ZWQuZm9udFNpemUgbGVzcyB0aGFuIGl0Jyk7XG5cblx0XHRcdHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UgPSBjcmVhdGVUZXJtaW5hbENvbmZpZ2F0aW9uU2VydmljZSh7XG5cdFx0XHRcdGVkaXRvcjoge1xuXHRcdFx0XHRcdGZvbnRGYW1pbHk6ICdmb28nXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHRlcm1pbmFsOiB7XG5cdFx0XHRcdFx0aW50ZWdyYXRlZDoge1xuXHRcdFx0XHRcdFx0Zm9udEZhbWlseTogbnVsbCxcblx0XHRcdFx0XHRcdGZvbnRTaXplOiAwXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHN0cmljdEVxdWFsKHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuZ2V0Rm9udChnZXRBY3RpdmVXaW5kb3coKSkuZm9udFNpemUsIDYsICdUaGUgbWluaW11bSB0ZXJtaW5hbCBmb250IHNpemUgc2hvdWxkIGJlIHVzZWQgd2hlbiB0ZXJtaW5hbC5pbnRlZ3JhdGVkLmZvbnRTaXplIGxlc3MgdGhhbiBpdCcpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZm9udFNpemUgMTUwMCcsICgpID0+IHtcblx0XHRcdGNvbnN0IHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UgPSBjcmVhdGVUZXJtaW5hbENvbmZpZ2F0aW9uU2VydmljZSh7XG5cdFx0XHRcdGVkaXRvcjoge1xuXHRcdFx0XHRcdGZvbnRGYW1pbHk6ICdmb28nXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHRlcm1pbmFsOiB7XG5cdFx0XHRcdFx0aW50ZWdyYXRlZDoge1xuXHRcdFx0XHRcdFx0Zm9udEZhbWlseTogMCxcblx0XHRcdFx0XHRcdGZvbnRTaXplOiAxNTAwXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHN0cmljdEVxdWFsKHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuZ2V0Rm9udChnZXRBY3RpdmVXaW5kb3coKSkuZm9udFNpemUsIDEwMCwgJ1RoZSBtYXhpbXVtIHRlcm1pbmFsIGZvbnQgc2l6ZSBzaG91bGQgYmUgdXNlZCB3aGVuIHRlcm1pbmFsLmludGVncmF0ZWQuZm9udFNpemUgbW9yZSB0aGFuIGl0Jyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdmb250U2l6ZSBudWxsJywgKCkgPT4ge1xuXHRcdFx0bGV0IHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UgPSBjcmVhdGVUZXJtaW5hbENvbmZpZ2F0aW9uU2VydmljZSh7XG5cdFx0XHRcdGVkaXRvcjoge1xuXHRcdFx0XHRcdGZvbnRGYW1pbHk6ICdmb28nXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHRlcm1pbmFsOiB7XG5cdFx0XHRcdFx0aW50ZWdyYXRlZDoge1xuXHRcdFx0XHRcdFx0Zm9udEZhbWlseTogMCxcblx0XHRcdFx0XHRcdGZvbnRTaXplOiBudWxsXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LCBMaW51eERpc3Ryby5VYnVudHUpO1xuXHRcdFx0c3RyaWN0RXF1YWwodGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5nZXRGb250KGdldEFjdGl2ZVdpbmRvdygpKS5mb250U2l6ZSwgRURJVE9SX0ZPTlRfREVGQVVMVFMuZm9udFNpemUgKyAyLCAnVGhlIGRlZmF1bHQgZWRpdG9yIGZvbnQgc2l6ZSAod2l0aCBhZGp1c3RtZW50KSBzaG91bGQgYmUgdXNlZCB3aGVuIHRlcm1pbmFsLmludGVncmF0ZWQuZm9udFNpemUgaXMgbm90IHNldCcpO1xuXG5cdFx0XHR0ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlID0gY3JlYXRlVGVybWluYWxDb25maWdhdGlvblNlcnZpY2Uoe1xuXHRcdFx0XHRlZGl0b3I6IHtcblx0XHRcdFx0XHRmb250RmFtaWx5OiAnZm9vJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR0ZXJtaW5hbDoge1xuXHRcdFx0XHRcdGludGVncmF0ZWQ6IHtcblx0XHRcdFx0XHRcdGZvbnRGYW1pbHk6IDAsXG5cdFx0XHRcdFx0XHRmb250U2l6ZTogbnVsbFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldEZvbnQoZ2V0QWN0aXZlV2luZG93KCkpLmZvbnRTaXplLCBFRElUT1JfRk9OVF9ERUZBVUxUUy5mb250U2l6ZSwgJ1RoZSBkZWZhdWx0IGVkaXRvciBmb250IHNpemUgc2hvdWxkIGJlIHVzZWQgd2hlbiB0ZXJtaW5hbC5pbnRlZ3JhdGVkLmZvbnRTaXplIGlzIG5vdCBzZXQnKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2xpbmVIZWlnaHQgMicsICgpID0+IHtcblx0XHRcdGNvbnN0IHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UgPSBjcmVhdGVUZXJtaW5hbENvbmZpZ2F0aW9uU2VydmljZSh7XG5cdFx0XHRcdGVkaXRvcjoge1xuXHRcdFx0XHRcdGZvbnRGYW1pbHk6ICdmb28nLFxuXHRcdFx0XHRcdGxpbmVIZWlnaHQ6IDFcblx0XHRcdFx0fSxcblx0XHRcdFx0dGVybWluYWw6IHtcblx0XHRcdFx0XHRpbnRlZ3JhdGVkOiB7XG5cdFx0XHRcdFx0XHRmb250RmFtaWx5OiAwLFxuXHRcdFx0XHRcdFx0bGluZUhlaWdodDogMlxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldEZvbnQoZ2V0QWN0aXZlV2luZG93KCkpLmxpbmVIZWlnaHQsIDIsICd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmxpbmVIZWlnaHQgc2hvdWxkIGJlIHNlbGVjdGVkIG92ZXIgZWRpdG9yLmxpbmVIZWlnaHQnKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2xpbmVIZWlnaHQgMCcsICgpID0+IHtcblx0XHRcdGNvbnN0IHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UgPSBjcmVhdGVUZXJtaW5hbENvbmZpZ2F0aW9uU2VydmljZSh7XG5cdFx0XHRcdGVkaXRvcjoge1xuXHRcdFx0XHRcdGZvbnRGYW1pbHk6ICdmb28nLFxuXHRcdFx0XHRcdGxpbmVIZWlnaHQ6IDFcblx0XHRcdFx0fSxcblx0XHRcdFx0dGVybWluYWw6IHtcblx0XHRcdFx0XHRpbnRlZ3JhdGVkOiB7XG5cdFx0XHRcdFx0XHRmb250RmFtaWx5OiAwLFxuXHRcdFx0XHRcdFx0bGluZUhlaWdodDogMFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldEZvbnQoZ2V0QWN0aXZlV2luZG93KCkpLmxpbmVIZWlnaHQsIGlzTGludXggPyAxLjEgOiAxLCAnZWRpdG9yLmxpbmVIZWlnaHQgc2hvdWxkIGJlIHRoZSBkZWZhdWx0IHdoZW4gdGVybWluYWwuaW50ZWdyYXRlZC5saW5lSGVpZ2h0IG5vdCBzZXQnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ2NvbmZpZ0ZvbnRJc01vbm9zcGFjZScsICgpID0+IHtcblx0XHR0ZXN0KCdpc01vbm9zcGFjZSBtb25vc3BhY2UnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlID0gY3JlYXRlVGVybWluYWxDb25maWdhdGlvblNlcnZpY2Uoe1xuXHRcdFx0XHR0ZXJtaW5hbDoge1xuXHRcdFx0XHRcdGludGVncmF0ZWQ6IHtcblx0XHRcdFx0XHRcdGZvbnRGYW1pbHk6ICdtb25vc3BhY2UnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0c3RyaWN0RXF1YWwodGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWdGb250SXNNb25vc3BhY2UoKSwgdHJ1ZSwgJ21vbm9zcGFjZSBpcyBtb25vc3BhY2VkJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpc01vbm9zcGFjZSBzYW5zLXNlcmlmJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSA9IGNyZWF0ZVRlcm1pbmFsQ29uZmlnYXRpb25TZXJ2aWNlKHtcblx0XHRcdFx0dGVybWluYWw6IHtcblx0XHRcdFx0XHRpbnRlZ3JhdGVkOiB7XG5cdFx0XHRcdFx0XHRmb250RmFtaWx5OiAnc2Fucy1zZXJpZidcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0c3RyaWN0RXF1YWwodGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWdGb250SXNNb25vc3BhY2UoKSwgZmFsc2UsICdzYW5zLXNlcmlmIGlzIG5vdCBtb25vc3BhY2VkJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpc01vbm9zcGFjZSBzZXJpZicsICgpID0+IHtcblx0XHRcdGNvbnN0IHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UgPSBjcmVhdGVUZXJtaW5hbENvbmZpZ2F0aW9uU2VydmljZSh7XG5cdFx0XHRcdHRlcm1pbmFsOiB7XG5cdFx0XHRcdFx0aW50ZWdyYXRlZDoge1xuXHRcdFx0XHRcdFx0Zm9udEZhbWlseTogJ3NlcmlmJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZ0ZvbnRJc01vbm9zcGFjZSgpLCBmYWxzZSwgJ3NlcmlmIGlzIG5vdCBtb25vc3BhY2VkJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpc01vbm9zcGFjZSBtb25vc3BhY2UgZmFsbHMgYmFjayB0byBlZGl0b3IuZm9udEZhbWlseScsICgpID0+IHtcblx0XHRcdGNvbnN0IHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UgPSBjcmVhdGVUZXJtaW5hbENvbmZpZ2F0aW9uU2VydmljZSh7XG5cdFx0XHRcdGVkaXRvcjoge1xuXHRcdFx0XHRcdGZvbnRGYW1pbHk6ICdtb25vc3BhY2UnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHRlcm1pbmFsOiB7XG5cdFx0XHRcdFx0aW50ZWdyYXRlZDoge1xuXHRcdFx0XHRcdFx0Zm9udEZhbWlseTogbnVsbFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRzdHJpY3RFcXVhbCh0ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZ0ZvbnRJc01vbm9zcGFjZSgpLCB0cnVlLCAnbW9ub3NwYWNlIGlzIG1vbm9zcGFjZWQnKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2lzTW9ub3NwYWNlIHNhbnMtc2VyaWYgZmFsbHMgYmFjayB0byBlZGl0b3IuZm9udEZhbWlseScsICgpID0+IHtcblx0XHRcdGNvbnN0IHRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UgPSBjcmVhdGVUZXJtaW5hbENvbmZpZ2F0aW9uU2VydmljZSh7XG5cdFx0XHRcdGVkaXRvcjoge1xuXHRcdFx0XHRcdGZvbnRGYW1pbHk6ICdzYW5zLXNlcmlmJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR0ZXJtaW5hbDoge1xuXHRcdFx0XHRcdGludGVncmF0ZWQ6IHtcblx0XHRcdFx0XHRcdGZvbnRGYW1pbHk6IG51bGxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0c3RyaWN0RXF1YWwodGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWdGb250SXNNb25vc3BhY2UoKSwgZmFsc2UsICdzYW5zLXNlcmlmIGlzIG5vdCBtb25vc3BhY2VkJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpc01vbm9zcGFjZSBzZXJpZiBmYWxscyBiYWNrIHRvIGVkaXRvci5mb250RmFtaWx5JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSA9IGNyZWF0ZVRlcm1pbmFsQ29uZmlnYXRpb25TZXJ2aWNlKHtcblx0XHRcdFx0ZWRpdG9yOiB7XG5cdFx0XHRcdFx0Zm9udEZhbWlseTogJ3NlcmlmJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR0ZXJtaW5hbDoge1xuXHRcdFx0XHRcdGludGVncmF0ZWQ6IHtcblx0XHRcdFx0XHRcdGZvbnRGYW1pbHk6IG51bGxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0c3RyaWN0RXF1YWwodGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWdGb250SXNNb25vc3BhY2UoKSwgZmFsc2UsICdzZXJpZiBpcyBub3QgbW9ub3NwYWNlZCcpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxnQkFBZ0IsSUFBSSxtQkFBbUI7QUFDaEQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsNEJBQTRCO0FB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QUssMEJBQTBCLE1BQU07QUFDcEMsWUFBTUEsZ0NBQStCLGlDQUFpQztBQUFBLFFBQ3JFLFVBQVU7QUFBQSxVQUNULFlBQVk7QUFBQSxZQUNYLFlBQVk7QUFBQSxVQUNiO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELGtCQUFZQSw4QkFBNkIsc0JBQXNCLEdBQUcsT0FBTyw4QkFBOEI7QUFBQSxJQUN4RyxDQUFDO0FBRUQsU0FBSyxxQkFBcUIsTUFBTTtBQUMvQixZQUFNQSxnQ0FBK0IsaUNBQWlDO0FBQUEsUUFDckUsVUFBVTtBQUFBLFVBQ1QsWUFBWTtBQUFBLFlBQ1gsWUFBWTtBQUFBLFVBQ2I7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQ0Qsa0JBQVlBLDhCQUE2QixzQkFBc0IsR0FBRyxPQUFPLHlCQUF5QjtBQUFBLElBQ25HLENBQUM7QUFFRCxTQUFLLHlEQUF5RCxNQUFNO0FBQ25FLFlBQU1BLGdDQUErQixpQ0FBaUM7QUFBQSxRQUNyRSxRQUFRO0FBQUEsVUFDUCxZQUFZO0FBQUEsUUFDYjtBQUFBLFFBQ0EsVUFBVTtBQUFBLFVBQ1QsWUFBWTtBQUFBLFlBQ1gsWUFBWTtBQUFBLFVBQ2I7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQ0Qsa0JBQVlBLDhCQUE2QixzQkFBc0IsR0FBRyxNQUFNLHlCQUF5QjtBQUFBLElBQ2xHLENBQUM7QUFFRCxTQUFLLDBEQUEwRCxNQUFNO0FBQ3BFLFlBQU1BLGdDQUErQixpQ0FBaUM7QUFBQSxRQUNyRSxRQUFRO0FBQUEsVUFDUCxZQUFZO0FBQUEsUUFDYjtBQUFBLFFBQ0EsVUFBVTtBQUFBLFVBQ1QsWUFBWTtBQUFBLFlBQ1gsWUFBWTtBQUFBLFVBQ2I7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQ0Qsa0JBQVlBLDhCQUE2QixzQkFBc0IsR0FBRyxPQUFPLDhCQUE4QjtBQUFBLElBQ3hHLENBQUM7QUFFRCxTQUFLLHFEQUFxRCxNQUFNO0FBQy9ELFlBQU1BLGdDQUErQixpQ0FBaUM7QUFBQSxRQUNyRSxRQUFRO0FBQUEsVUFDUCxZQUFZO0FBQUEsUUFDYjtBQUFBLFFBQ0EsVUFBVTtBQUFBLFVBQ1QsWUFBWTtBQUFBLFlBQ1gsWUFBWTtBQUFBLFVBQ2I7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQ0Qsa0JBQVlBLDhCQUE2QixzQkFBc0IsR0FBRyxPQUFPLHlCQUF5QjtBQUFBLElBQ25HLENBQUM7QUFBQSxFQUNGLENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJ0ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlIl0KfQo=
