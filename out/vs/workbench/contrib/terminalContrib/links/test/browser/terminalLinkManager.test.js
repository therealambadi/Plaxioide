import { deepStrictEqual, strictEqual } from "assert";
import { equals } from "../../../../../../base/common/arrays.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../../platform/configuration/test/common/testConfigurationService.js";
import { ContextMenuService } from "../../../../../../platform/contextview/browser/contextMenuService.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { TestInstantiationService } from "../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { ILogService, NullLogService } from "../../../../../../platform/log/common/log.js";
import { IStorageService } from "../../../../../../platform/storage/common/storage.js";
import { IThemeService } from "../../../../../../platform/theme/common/themeService.js";
import { TestThemeService } from "../../../../../../platform/theme/test/common/testThemeService.js";
import { IViewDescriptorService } from "../../../../../common/views.js";
import { TerminalLinkManager } from "../../browser/terminalLinkManager.js";
import { TestViewDescriptorService } from "../../../../terminal/test/browser/xterm/xtermTerminal.test.js";
import { TestStorageService } from "../../../../../test/common/workbenchTestServices.js";
import { TerminalLinkResolver } from "../../browser/terminalLinkResolver.js";
import { importAMDNodeModule } from "../../../../../../amdX.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
const defaultTerminalConfig = {
  fontFamily: "monospace",
  fontWeight: "normal",
  fontWeightBold: "normal",
  gpuAcceleration: "off",
  scrollback: 1e3,
  fastScrollSensitivity: 2,
  mouseWheelScrollSensitivity: 1,
  unicodeVersion: "11",
  wordSeparators: " ()[]{}',\"`\u2500\u2018\u2019\u201C\u201D"
};
class TestLinkManager extends TerminalLinkManager {
  async _getLinksForType(y, type) {
    switch (type) {
      case "word":
        return this._links?.wordLinks?.[y] ? [this._links?.wordLinks?.[y]] : void 0;
      case "url":
        return this._links?.webLinks?.[y] ? [this._links?.webLinks?.[y]] : void 0;
      case "localFile":
        return this._links?.fileLinks?.[y] ? [this._links?.fileLinks?.[y]] : void 0;
    }
  }
  setLinks(links) {
    this._links = links;
  }
}
suite("TerminalLinkManager", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let instantiationService;
  let configurationService;
  let themeService;
  let viewDescriptorService;
  let xterm;
  let linkManager;
  setup(async () => {
    configurationService = new TestConfigurationService({
      editor: {
        fastScrollSensitivity: 2,
        mouseWheelScrollSensitivity: 1
      },
      terminal: {
        integrated: defaultTerminalConfig
      }
    });
    themeService = new TestThemeService();
    viewDescriptorService = new TestViewDescriptorService();
    instantiationService = store.add(new TestInstantiationService());
    instantiationService.stub(IContextMenuService, store.add(instantiationService.createInstance(ContextMenuService)));
    instantiationService.stub(IConfigurationService, configurationService);
    instantiationService.stub(ILogService, new NullLogService());
    instantiationService.stub(IStorageService, store.add(new TestStorageService()));
    instantiationService.stub(IThemeService, themeService);
    instantiationService.stub(IViewDescriptorService, viewDescriptorService);
    const TerminalCtor = (await importAMDNodeModule("@xterm/xterm", "lib/xterm.js")).Terminal;
    xterm = store.add(new TerminalCtor({ allowProposedApi: true, cols: 80, rows: 30 }));
    linkManager = store.add(instantiationService.createInstance(TestLinkManager, xterm, upcastPartial({
      get initialCwd() {
        return "";
      }
    }), {
      get(capability) {
        return void 0;
      }
    }, instantiationService.createInstance(TerminalLinkResolver)));
  });
  suite("registerExternalLinkProvider", () => {
    test("should not leak disposables if the link manager is already disposed", () => {
      linkManager.externalProvideLinksCb = async () => void 0;
      linkManager.dispose();
      linkManager.externalProvideLinksCb = async () => void 0;
    });
  });
  suite("getLinks and open recent link", () => {
    test("should return no links", async () => {
      const links = await linkManager.getLinks();
      equals(links.viewport.webLinks, []);
      equals(links.viewport.wordLinks, []);
      equals(links.viewport.fileLinks, []);
      const webLink = await linkManager.openRecentLink("url");
      strictEqual(webLink, void 0);
      const fileLink = await linkManager.openRecentLink("localFile");
      strictEqual(fileLink, void 0);
    });
    test("should return word links in order", async () => {
      const link1 = {
        range: {
          start: { x: 1, y: 1 },
          end: { x: 14, y: 1 }
        },
        text: "1_\u6211\u662F\u5B66\u751F.txt",
        activate: () => Promise.resolve("")
      };
      const link2 = {
        range: {
          start: { x: 1, y: 1 },
          end: { x: 14, y: 1 }
        },
        text: "2_\u6211\u662F\u5B66\u751F.txt",
        activate: () => Promise.resolve("")
      };
      linkManager.setLinks({ wordLinks: [link1, link2] });
      const links = await linkManager.getLinks();
      deepStrictEqual(links.viewport.wordLinks?.[0].text, link2.text);
      deepStrictEqual(links.viewport.wordLinks?.[1].text, link1.text);
      const webLink = await linkManager.openRecentLink("url");
      strictEqual(webLink, void 0);
      const fileLink = await linkManager.openRecentLink("localFile");
      strictEqual(fileLink, void 0);
    });
    test("should return web links in order", async () => {
      const link1 = {
        range: { start: { x: 5, y: 1 }, end: { x: 40, y: 1 } },
        text: "https://foo.bar/[this is foo site 1]",
        activate: () => Promise.resolve("")
      };
      const link2 = {
        range: { start: { x: 5, y: 2 }, end: { x: 40, y: 2 } },
        text: "https://foo.bar/[this is foo site 2]",
        activate: () => Promise.resolve("")
      };
      linkManager.setLinks({ webLinks: [link1, link2] });
      const links = await linkManager.getLinks();
      deepStrictEqual(links.viewport.webLinks?.[0].text, link2.text);
      deepStrictEqual(links.viewport.webLinks?.[1].text, link1.text);
      const webLink = await linkManager.openRecentLink("url");
      strictEqual(webLink, link2);
      const fileLink = await linkManager.openRecentLink("localFile");
      strictEqual(fileLink, void 0);
    });
    test("should return file links in order", async () => {
      const link1 = {
        range: { start: { x: 1, y: 1 }, end: { x: 32, y: 1 } },
        text: "file:///C:/users/test/file_1.txt",
        activate: () => Promise.resolve("")
      };
      const link2 = {
        range: { start: { x: 1, y: 2 }, end: { x: 32, y: 2 } },
        text: "file:///C:/users/test/file_2.txt",
        activate: () => Promise.resolve("")
      };
      linkManager.setLinks({ fileLinks: [link1, link2] });
      const links = await linkManager.getLinks();
      deepStrictEqual(links.viewport.fileLinks?.[0].text, link2.text);
      deepStrictEqual(links.viewport.fileLinks?.[1].text, link1.text);
      const webLink = await linkManager.openRecentLink("url");
      strictEqual(webLink, void 0);
      linkManager.setLinks({ fileLinks: [link2] });
      const fileLink = await linkManager.openRecentLink("localFile");
      strictEqual(fileLink, link2);
    });
  });
});
function upcastPartial(v) {
  return v;
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvbGlua3MvdGVzdC9icm93c2VyL3Rlcm1pbmFsTGlua01hbmFnZXIudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGRlZXBTdHJpY3RFcXVhbCwgc3RyaWN0RXF1YWwgfSBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dE1lbnVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlLCBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdFRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL3Rlc3QvY29tbW9uL3Rlc3RUaGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJRGV0ZWN0ZWRMaW5rcywgVGVybWluYWxMaW5rTWFuYWdlciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdGVybWluYWxMaW5rTWFuYWdlci5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxDYXBhYmlsaXR5SW1wbE1hcCwgSVRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlLCBUZXJtaW5hbENhcGFiaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxDb25maWd1cmF0aW9uLCBJVGVybWluYWxQcm9jZXNzTWFuYWdlciB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBUZXN0Vmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVybWluYWwvdGVzdC9icm93c2VyL3h0ZXJtL3h0ZXJtVGVybWluYWwudGVzdC5qcyc7XG5pbXBvcnQgeyBUZXN0U3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHR5cGUgeyBJTGluaywgVGVybWluYWwgfSBmcm9tICdAeHRlcm0veHRlcm0nO1xuaW1wb3J0IHsgVGVybWluYWxMaW5rUmVzb2x2ZXIgfSBmcm9tICcuLi8uLi9icm93c2VyL3Rlcm1pbmFsTGlua1Jlc29sdmVyLmpzJztcbmltcG9ydCB7IGltcG9ydEFNRE5vZGVNb2R1bGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9hbWRYLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5jb25zdCBkZWZhdWx0VGVybWluYWxDb25maWc6IFBhcnRpYWw8SVRlcm1pbmFsQ29uZmlndXJhdGlvbj4gPSB7XG5cdGZvbnRGYW1pbHk6ICdtb25vc3BhY2UnLFxuXHRmb250V2VpZ2h0OiAnbm9ybWFsJyxcblx0Zm9udFdlaWdodEJvbGQ6ICdub3JtYWwnLFxuXHRncHVBY2NlbGVyYXRpb246ICdvZmYnLFxuXHRzY3JvbGxiYWNrOiAxMDAwLFxuXHRmYXN0U2Nyb2xsU2Vuc2l0aXZpdHk6IDIsXG5cdG1vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eTogMSxcblx0dW5pY29kZVZlcnNpb246ICcxMScsXG5cdHdvcmRTZXBhcmF0b3JzOiAnICgpW117fVxcJyxcImBcdTI1MDBcdTIwMThcdTIwMTlcdTIwMUNcdTIwMUQnXG59O1xuXG5jbGFzcyBUZXN0TGlua01hbmFnZXIgZXh0ZW5kcyBUZXJtaW5hbExpbmtNYW5hZ2VyIHtcblx0cHJpdmF0ZSBfbGlua3M6IElEZXRlY3RlZExpbmtzIHwgdW5kZWZpbmVkO1xuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgX2dldExpbmtzRm9yVHlwZSh5OiBudW1iZXIsIHR5cGU6ICd3b3JkJyB8ICd1cmwnIHwgJ2xvY2FsRmlsZScpOiBQcm9taXNlPElMaW5rW10gfCB1bmRlZmluZWQ+IHtcblx0XHRzd2l0Y2ggKHR5cGUpIHtcblx0XHRcdGNhc2UgJ3dvcmQnOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5fbGlua3M/LndvcmRMaW5rcz8uW3ldID8gW3RoaXMuX2xpbmtzPy53b3JkTGlua3M/Llt5XV0gOiB1bmRlZmluZWQ7XG5cdFx0XHRjYXNlICd1cmwnOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5fbGlua3M/LndlYkxpbmtzPy5beV0gPyBbdGhpcy5fbGlua3M/LndlYkxpbmtzPy5beV1dIDogdW5kZWZpbmVkO1xuXHRcdFx0Y2FzZSAnbG9jYWxGaWxlJzpcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2xpbmtzPy5maWxlTGlua3M/Llt5XSA/IFt0aGlzLl9saW5rcz8uZmlsZUxpbmtzPy5beV1dIDogdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXHRzZXRMaW5rcyhsaW5rczogSURldGVjdGVkTGlua3MpOiB2b2lkIHtcblx0XHR0aGlzLl9saW5rcyA9IGxpbmtzO1xuXHR9XG59XG5cbnN1aXRlKCdUZXJtaW5hbExpbmtNYW5hZ2VyJywgKCkgPT4ge1xuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRsZXQgY29uZmlndXJhdGlvblNlcnZpY2U6IFRlc3RDb25maWd1cmF0aW9uU2VydmljZTtcblx0bGV0IHRoZW1lU2VydmljZTogVGVzdFRoZW1lU2VydmljZTtcblx0bGV0IHZpZXdEZXNjcmlwdG9yU2VydmljZTogVGVzdFZpZXdEZXNjcmlwdG9yU2VydmljZTtcblx0bGV0IHh0ZXJtOiBUZXJtaW5hbDtcblx0bGV0IGxpbmtNYW5hZ2VyOiBUZXN0TGlua01hbmFnZXI7XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7XG5cdFx0XHRlZGl0b3I6IHtcblx0XHRcdFx0ZmFzdFNjcm9sbFNlbnNpdGl2aXR5OiAyLFxuXHRcdFx0XHRtb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHk6IDFcblx0XHRcdH0gYXMgUGFydGlhbDxJRWRpdG9yT3B0aW9ucz4sXG5cdFx0XHR0ZXJtaW5hbDoge1xuXHRcdFx0XHRpbnRlZ3JhdGVkOiBkZWZhdWx0VGVybWluYWxDb25maWdcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGVtZVNlcnZpY2UgPSBuZXcgVGVzdFRoZW1lU2VydmljZSgpO1xuXHRcdHZpZXdEZXNjcmlwdG9yU2VydmljZSA9IG5ldyBUZXN0Vmlld0Rlc2NyaXB0b3JTZXJ2aWNlKCk7XG5cblx0XHRpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0b3JlLmFkZChuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnRleHRNZW51U2VydmljZSwgc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnRleHRNZW51U2VydmljZSkpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb25maWd1cmF0aW9uU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUxvZ1NlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTdG9yYWdlU2VydmljZSwgc3RvcmUuYWRkKG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRoZW1lU2VydmljZSwgdGhlbWVTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3RGVzY3JpcHRvclNlcnZpY2UsIHZpZXdEZXNjcmlwdG9yU2VydmljZSk7XG5cblx0XHRjb25zdCBUZXJtaW5hbEN0b3IgPSAoYXdhaXQgaW1wb3J0QU1ETm9kZU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAeHRlcm0veHRlcm0nKT4oJ0B4dGVybS94dGVybScsICdsaWIveHRlcm0uanMnKSkuVGVybWluYWw7XG5cdFx0eHRlcm0gPSBzdG9yZS5hZGQobmV3IFRlcm1pbmFsQ3Rvcih7IGFsbG93UHJvcG9zZWRBcGk6IHRydWUsIGNvbHM6IDgwLCByb3dzOiAzMCB9KSk7XG5cdFx0bGlua01hbmFnZXIgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdExpbmtNYW5hZ2VyLCB4dGVybSwgdXBjYXN0UGFydGlhbDxJVGVybWluYWxQcm9jZXNzTWFuYWdlcj4oe1xuXHRcdFx0Z2V0IGluaXRpYWxDd2QoKSB7XG5cdFx0XHRcdHJldHVybiAnJztcblx0XHRcdH1cblx0XHR9KSwge1xuXHRcdFx0Z2V0PFQgZXh0ZW5kcyBUZXJtaW5hbENhcGFiaWxpdHk+KGNhcGFiaWxpdHk6IFQpOiBJVGVybWluYWxDYXBhYmlsaXR5SW1wbE1hcFtUXSB8IHVuZGVmaW5lZCB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSBhcyBQYXJ0aWFsPElUZXJtaW5hbENhcGFiaWxpdHlTdG9yZT4gYXMgYW55LCBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExpbmtSZXNvbHZlcikpKTtcblx0fSk7XG5cblx0c3VpdGUoJ3JlZ2lzdGVyRXh0ZXJuYWxMaW5rUHJvdmlkZXInLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIG5vdCBsZWFrIGRpc3Bvc2FibGVzIGlmIHRoZSBsaW5rIG1hbmFnZXIgaXMgYWxyZWFkeSBkaXNwb3NlZCcsICgpID0+IHtcblx0XHRcdGxpbmtNYW5hZ2VyLmV4dGVybmFsUHJvdmlkZUxpbmtzQ2IgPSBhc3luYyAoKSA9PiB1bmRlZmluZWQ7XG5cdFx0XHRsaW5rTWFuYWdlci5kaXNwb3NlKCk7XG5cdFx0XHRsaW5rTWFuYWdlci5leHRlcm5hbFByb3ZpZGVMaW5rc0NiID0gYXN5bmMgKCkgPT4gdW5kZWZpbmVkO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnZ2V0TGlua3MgYW5kIG9wZW4gcmVjZW50IGxpbmsnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIHJldHVybiBubyBsaW5rcycsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGxpbmtzID0gYXdhaXQgbGlua01hbmFnZXIuZ2V0TGlua3MoKTtcblx0XHRcdGVxdWFscyhsaW5rcy52aWV3cG9ydC53ZWJMaW5rcywgW10pO1xuXHRcdFx0ZXF1YWxzKGxpbmtzLnZpZXdwb3J0LndvcmRMaW5rcywgW10pO1xuXHRcdFx0ZXF1YWxzKGxpbmtzLnZpZXdwb3J0LmZpbGVMaW5rcywgW10pO1xuXHRcdFx0Y29uc3Qgd2ViTGluayA9IGF3YWl0IGxpbmtNYW5hZ2VyLm9wZW5SZWNlbnRMaW5rKCd1cmwnKTtcblx0XHRcdHN0cmljdEVxdWFsKHdlYkxpbmssIHVuZGVmaW5lZCk7XG5cdFx0XHRjb25zdCBmaWxlTGluayA9IGF3YWl0IGxpbmtNYW5hZ2VyLm9wZW5SZWNlbnRMaW5rKCdsb2NhbEZpbGUnKTtcblx0XHRcdHN0cmljdEVxdWFsKGZpbGVMaW5rLCB1bmRlZmluZWQpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCByZXR1cm4gd29yZCBsaW5rcyBpbiBvcmRlcicsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGxpbmsxID0ge1xuXHRcdFx0XHRyYW5nZToge1xuXHRcdFx0XHRcdHN0YXJ0OiB7IHg6IDEsIHk6IDEgfSwgZW5kOiB7IHg6IDE0LCB5OiAxIH1cblx0XHRcdFx0fSxcblx0XHRcdFx0dGV4dDogJzFfXHU2MjExXHU2NjJGXHU1QjY2XHU3NTFGLnR4dCcsXG5cdFx0XHRcdGFjdGl2YXRlOiAoKSA9PiBQcm9taXNlLnJlc29sdmUoJycpXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgbGluazIgPSB7XG5cdFx0XHRcdHJhbmdlOiB7XG5cdFx0XHRcdFx0c3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogMTQsIHk6IDEgfVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR0ZXh0OiAnMl9cdTYyMTFcdTY2MkZcdTVCNjZcdTc1MUYudHh0Jyxcblx0XHRcdFx0YWN0aXZhdGU6ICgpID0+IFByb21pc2UucmVzb2x2ZSgnJylcblx0XHRcdH07XG5cdFx0XHRsaW5rTWFuYWdlci5zZXRMaW5rcyh7IHdvcmRMaW5rczogW2xpbmsxLCBsaW5rMl0gfSk7XG5cdFx0XHRjb25zdCBsaW5rcyA9IGF3YWl0IGxpbmtNYW5hZ2VyLmdldExpbmtzKCk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwobGlua3Mudmlld3BvcnQud29yZExpbmtzPy5bMF0udGV4dCwgbGluazIudGV4dCk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwobGlua3Mudmlld3BvcnQud29yZExpbmtzPy5bMV0udGV4dCwgbGluazEudGV4dCk7XG5cdFx0XHRjb25zdCB3ZWJMaW5rID0gYXdhaXQgbGlua01hbmFnZXIub3BlblJlY2VudExpbmsoJ3VybCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwod2ViTGluaywgdW5kZWZpbmVkKTtcblx0XHRcdGNvbnN0IGZpbGVMaW5rID0gYXdhaXQgbGlua01hbmFnZXIub3BlblJlY2VudExpbmsoJ2xvY2FsRmlsZScpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZmlsZUxpbmssIHVuZGVmaW5lZCk7XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIHJldHVybiB3ZWIgbGlua3MgaW4gb3JkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBsaW5rMSA9IHtcblx0XHRcdFx0cmFuZ2U6IHsgc3RhcnQ6IHsgeDogNSwgeTogMSB9LCBlbmQ6IHsgeDogNDAsIHk6IDEgfSB9LFxuXHRcdFx0XHR0ZXh0OiAnaHR0cHM6Ly9mb28uYmFyL1t0aGlzIGlzIGZvbyBzaXRlIDFdJyxcblx0XHRcdFx0YWN0aXZhdGU6ICgpID0+IFByb21pc2UucmVzb2x2ZSgnJylcblx0XHRcdH07XG5cdFx0XHRjb25zdCBsaW5rMiA9IHtcblx0XHRcdFx0cmFuZ2U6IHsgc3RhcnQ6IHsgeDogNSwgeTogMiB9LCBlbmQ6IHsgeDogNDAsIHk6IDIgfSB9LFxuXHRcdFx0XHR0ZXh0OiAnaHR0cHM6Ly9mb28uYmFyL1t0aGlzIGlzIGZvbyBzaXRlIDJdJyxcblx0XHRcdFx0YWN0aXZhdGU6ICgpID0+IFByb21pc2UucmVzb2x2ZSgnJylcblx0XHRcdH07XG5cdFx0XHRsaW5rTWFuYWdlci5zZXRMaW5rcyh7IHdlYkxpbmtzOiBbbGluazEsIGxpbmsyXSB9KTtcblx0XHRcdGNvbnN0IGxpbmtzID0gYXdhaXQgbGlua01hbmFnZXIuZ2V0TGlua3MoKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChsaW5rcy52aWV3cG9ydC53ZWJMaW5rcz8uWzBdLnRleHQsIGxpbmsyLnRleHQpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKGxpbmtzLnZpZXdwb3J0LndlYkxpbmtzPy5bMV0udGV4dCwgbGluazEudGV4dCk7XG5cdFx0XHRjb25zdCB3ZWJMaW5rID0gYXdhaXQgbGlua01hbmFnZXIub3BlblJlY2VudExpbmsoJ3VybCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwod2ViTGluaywgbGluazIpO1xuXHRcdFx0Y29uc3QgZmlsZUxpbmsgPSBhd2FpdCBsaW5rTWFuYWdlci5vcGVuUmVjZW50TGluaygnbG9jYWxGaWxlJyk7XG5cdFx0XHRzdHJpY3RFcXVhbChmaWxlTGluaywgdW5kZWZpbmVkKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgcmV0dXJuIGZpbGUgbGlua3MgaW4gb3JkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBsaW5rMSA9IHtcblx0XHRcdFx0cmFuZ2U6IHsgc3RhcnQ6IHsgeDogMSwgeTogMSB9LCBlbmQ6IHsgeDogMzIsIHk6IDEgfSB9LFxuXHRcdFx0XHR0ZXh0OiAnZmlsZTovLy9DOi91c2Vycy90ZXN0L2ZpbGVfMS50eHQnLFxuXHRcdFx0XHRhY3RpdmF0ZTogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKCcnKVxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGxpbmsyID0ge1xuXHRcdFx0XHRyYW5nZTogeyBzdGFydDogeyB4OiAxLCB5OiAyIH0sIGVuZDogeyB4OiAzMiwgeTogMiB9IH0sXG5cdFx0XHRcdHRleHQ6ICdmaWxlOi8vL0M6L3VzZXJzL3Rlc3QvZmlsZV8yLnR4dCcsXG5cdFx0XHRcdGFjdGl2YXRlOiAoKSA9PiBQcm9taXNlLnJlc29sdmUoJycpXG5cdFx0XHR9O1xuXHRcdFx0bGlua01hbmFnZXIuc2V0TGlua3MoeyBmaWxlTGlua3M6IFtsaW5rMSwgbGluazJdIH0pO1xuXHRcdFx0Y29uc3QgbGlua3MgPSBhd2FpdCBsaW5rTWFuYWdlci5nZXRMaW5rcygpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKGxpbmtzLnZpZXdwb3J0LmZpbGVMaW5rcz8uWzBdLnRleHQsIGxpbmsyLnRleHQpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKGxpbmtzLnZpZXdwb3J0LmZpbGVMaW5rcz8uWzFdLnRleHQsIGxpbmsxLnRleHQpO1xuXHRcdFx0Y29uc3Qgd2ViTGluayA9IGF3YWl0IGxpbmtNYW5hZ2VyLm9wZW5SZWNlbnRMaW5rKCd1cmwnKTtcblx0XHRcdHN0cmljdEVxdWFsKHdlYkxpbmssIHVuZGVmaW5lZCk7XG5cdFx0XHRsaW5rTWFuYWdlci5zZXRMaW5rcyh7IGZpbGVMaW5rczogW2xpbmsyXSB9KTtcblx0XHRcdGNvbnN0IGZpbGVMaW5rID0gYXdhaXQgbGlua01hbmFnZXIub3BlblJlY2VudExpbmsoJ2xvY2FsRmlsZScpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZmlsZUxpbmssIGxpbmsyKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbmZ1bmN0aW9uIHVwY2FzdFBhcnRpYWw8VD4odjogUGFydGlhbDxUPik6IFQge1xuXHRyZXR1cm4gdiBhcyBUO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxpQkFBaUIsbUJBQW1CO0FBQzdDLFNBQVMsY0FBYztBQUV2QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGFBQWEsc0JBQXNCO0FBQzVDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQXlCLDJCQUEyQjtBQUdwRCxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLDBCQUEwQjtBQUVuQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLCtDQUErQztBQUV4RCxNQUFNLHdCQUF5RDtBQUFBLEVBQzlELFlBQVk7QUFBQSxFQUNaLFlBQVk7QUFBQSxFQUNaLGdCQUFnQjtBQUFBLEVBQ2hCLGlCQUFpQjtBQUFBLEVBQ2pCLFlBQVk7QUFBQSxFQUNaLHVCQUF1QjtBQUFBLEVBQ3ZCLDZCQUE2QjtBQUFBLEVBQzdCLGdCQUFnQjtBQUFBLEVBQ2hCLGdCQUFnQjtBQUNqQjtBQUVBLE1BQU0sd0JBQXdCLG9CQUFvQjtBQUFBLEVBRWpELE1BQXlCLGlCQUFpQixHQUFXLE1BQWtFO0FBQ3RILFlBQVEsTUFBTTtBQUFBLE1BQ2IsS0FBSztBQUNKLGVBQU8sS0FBSyxRQUFRLFlBQVksQ0FBQyxJQUFJLENBQUMsS0FBSyxRQUFRLFlBQVksQ0FBQyxDQUFDLElBQUk7QUFBQSxNQUN0RSxLQUFLO0FBQ0osZUFBTyxLQUFLLFFBQVEsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLFFBQVEsV0FBVyxDQUFDLENBQUMsSUFBSTtBQUFBLE1BQ3BFLEtBQUs7QUFDSixlQUFPLEtBQUssUUFBUSxZQUFZLENBQUMsSUFBSSxDQUFDLEtBQUssUUFBUSxZQUFZLENBQUMsQ0FBQyxJQUFJO0FBQUEsSUFDdkU7QUFBQSxFQUNEO0FBQUEsRUFDQSxTQUFTLE9BQTZCO0FBQ3JDLFNBQUssU0FBUztBQUFBLEVBQ2Y7QUFDRDtBQUVBLE1BQU0sdUJBQXVCLE1BQU07QUFDbEMsUUFBTSxRQUFRLHdDQUF3QztBQUV0RCxNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFFSixRQUFNLFlBQVk7QUFDakIsMkJBQXVCLElBQUkseUJBQXlCO0FBQUEsTUFDbkQsUUFBUTtBQUFBLFFBQ1AsdUJBQXVCO0FBQUEsUUFDdkIsNkJBQTZCO0FBQUEsTUFDOUI7QUFBQSxNQUNBLFVBQVU7QUFBQSxRQUNULFlBQVk7QUFBQSxNQUNiO0FBQUEsSUFDRCxDQUFDO0FBQ0QsbUJBQWUsSUFBSSxpQkFBaUI7QUFDcEMsNEJBQXdCLElBQUksMEJBQTBCO0FBRXRELDJCQUF1QixNQUFNLElBQUksSUFBSSx5QkFBeUIsQ0FBQztBQUMvRCx5QkFBcUIsS0FBSyxxQkFBcUIsTUFBTSxJQUFJLHFCQUFxQixlQUFlLGtCQUFrQixDQUFDLENBQUM7QUFDakgseUJBQXFCLEtBQUssdUJBQXVCLG9CQUFvQjtBQUNyRSx5QkFBcUIsS0FBSyxhQUFhLElBQUksZUFBZSxDQUFDO0FBQzNELHlCQUFxQixLQUFLLGlCQUFpQixNQUFNLElBQUksSUFBSSxtQkFBbUIsQ0FBQyxDQUFDO0FBQzlFLHlCQUFxQixLQUFLLGVBQWUsWUFBWTtBQUNyRCx5QkFBcUIsS0FBSyx3QkFBd0IscUJBQXFCO0FBRXZFLFVBQU0sZ0JBQWdCLE1BQU0sb0JBQW1ELGdCQUFnQixjQUFjLEdBQUc7QUFDaEgsWUFBUSxNQUFNLElBQUksSUFBSSxhQUFhLEVBQUUsa0JBQWtCLE1BQU0sTUFBTSxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUM7QUFDbEYsa0JBQWMsTUFBTSxJQUFJLHFCQUFxQixlQUFlLGlCQUFpQixPQUFPLGNBQXVDO0FBQUEsTUFDMUgsSUFBSSxhQUFhO0FBQ2hCLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRCxDQUFDLEdBQUc7QUFBQSxNQUNILElBQWtDLFlBQTBEO0FBQzNGLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRCxHQUErQyxxQkFBcUIsZUFBZSxvQkFBb0IsQ0FBQyxDQUFDO0FBQUEsRUFDMUcsQ0FBQztBQUVELFFBQU0sZ0NBQWdDLE1BQU07QUFDM0MsU0FBSyx1RUFBdUUsTUFBTTtBQUNqRixrQkFBWSx5QkFBeUIsWUFBWTtBQUNqRCxrQkFBWSxRQUFRO0FBQ3BCLGtCQUFZLHlCQUF5QixZQUFZO0FBQUEsSUFDbEQsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELFFBQU0saUNBQWlDLE1BQU07QUFDNUMsU0FBSywwQkFBMEIsWUFBWTtBQUMxQyxZQUFNLFFBQVEsTUFBTSxZQUFZLFNBQVM7QUFDekMsYUFBTyxNQUFNLFNBQVMsVUFBVSxDQUFDLENBQUM7QUFDbEMsYUFBTyxNQUFNLFNBQVMsV0FBVyxDQUFDLENBQUM7QUFDbkMsYUFBTyxNQUFNLFNBQVMsV0FBVyxDQUFDLENBQUM7QUFDbkMsWUFBTSxVQUFVLE1BQU0sWUFBWSxlQUFlLEtBQUs7QUFDdEQsa0JBQVksU0FBUyxNQUFTO0FBQzlCLFlBQU0sV0FBVyxNQUFNLFlBQVksZUFBZSxXQUFXO0FBQzdELGtCQUFZLFVBQVUsTUFBUztBQUFBLElBQ2hDLENBQUM7QUFDRCxTQUFLLHFDQUFxQyxZQUFZO0FBQ3JELFlBQU0sUUFBUTtBQUFBLFFBQ2IsT0FBTztBQUFBLFVBQ04sT0FBTyxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLEtBQUssRUFBRSxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDM0M7QUFBQSxRQUNBLE1BQU07QUFBQSxRQUNOLFVBQVUsTUFBTSxRQUFRLFFBQVEsRUFBRTtBQUFBLE1BQ25DO0FBQ0EsWUFBTSxRQUFRO0FBQUEsUUFDYixPQUFPO0FBQUEsVUFDTixPQUFPLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsS0FBSyxFQUFFLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUMzQztBQUFBLFFBQ0EsTUFBTTtBQUFBLFFBQ04sVUFBVSxNQUFNLFFBQVEsUUFBUSxFQUFFO0FBQUEsTUFDbkM7QUFDQSxrQkFBWSxTQUFTLEVBQUUsV0FBVyxDQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7QUFDbEQsWUFBTSxRQUFRLE1BQU0sWUFBWSxTQUFTO0FBQ3pDLHNCQUFnQixNQUFNLFNBQVMsWUFBWSxDQUFDLEVBQUUsTUFBTSxNQUFNLElBQUk7QUFDOUQsc0JBQWdCLE1BQU0sU0FBUyxZQUFZLENBQUMsRUFBRSxNQUFNLE1BQU0sSUFBSTtBQUM5RCxZQUFNLFVBQVUsTUFBTSxZQUFZLGVBQWUsS0FBSztBQUN0RCxrQkFBWSxTQUFTLE1BQVM7QUFDOUIsWUFBTSxXQUFXLE1BQU0sWUFBWSxlQUFlLFdBQVc7QUFDN0Qsa0JBQVksVUFBVSxNQUFTO0FBQUEsSUFDaEMsQ0FBQztBQUNELFNBQUssb0NBQW9DLFlBQVk7QUFDcEQsWUFBTSxRQUFRO0FBQUEsUUFDYixPQUFPLEVBQUUsT0FBTyxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxLQUFLLEVBQUUsR0FBRyxJQUFJLEdBQUcsRUFBRSxFQUFFO0FBQUEsUUFDckQsTUFBTTtBQUFBLFFBQ04sVUFBVSxNQUFNLFFBQVEsUUFBUSxFQUFFO0FBQUEsTUFDbkM7QUFDQSxZQUFNLFFBQVE7QUFBQSxRQUNiLE9BQU8sRUFBRSxPQUFPLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLEtBQUssRUFBRSxHQUFHLElBQUksR0FBRyxFQUFFLEVBQUU7QUFBQSxRQUNyRCxNQUFNO0FBQUEsUUFDTixVQUFVLE1BQU0sUUFBUSxRQUFRLEVBQUU7QUFBQSxNQUNuQztBQUNBLGtCQUFZLFNBQVMsRUFBRSxVQUFVLENBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztBQUNqRCxZQUFNLFFBQVEsTUFBTSxZQUFZLFNBQVM7QUFDekMsc0JBQWdCLE1BQU0sU0FBUyxXQUFXLENBQUMsRUFBRSxNQUFNLE1BQU0sSUFBSTtBQUM3RCxzQkFBZ0IsTUFBTSxTQUFTLFdBQVcsQ0FBQyxFQUFFLE1BQU0sTUFBTSxJQUFJO0FBQzdELFlBQU0sVUFBVSxNQUFNLFlBQVksZUFBZSxLQUFLO0FBQ3RELGtCQUFZLFNBQVMsS0FBSztBQUMxQixZQUFNLFdBQVcsTUFBTSxZQUFZLGVBQWUsV0FBVztBQUM3RCxrQkFBWSxVQUFVLE1BQVM7QUFBQSxJQUNoQyxDQUFDO0FBQ0QsU0FBSyxxQ0FBcUMsWUFBWTtBQUNyRCxZQUFNLFFBQVE7QUFBQSxRQUNiLE9BQU8sRUFBRSxPQUFPLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLEtBQUssRUFBRSxHQUFHLElBQUksR0FBRyxFQUFFLEVBQUU7QUFBQSxRQUNyRCxNQUFNO0FBQUEsUUFDTixVQUFVLE1BQU0sUUFBUSxRQUFRLEVBQUU7QUFBQSxNQUNuQztBQUNBLFlBQU0sUUFBUTtBQUFBLFFBQ2IsT0FBTyxFQUFFLE9BQU8sRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsS0FBSyxFQUFFLEdBQUcsSUFBSSxHQUFHLEVBQUUsRUFBRTtBQUFBLFFBQ3JELE1BQU07QUFBQSxRQUNOLFVBQVUsTUFBTSxRQUFRLFFBQVEsRUFBRTtBQUFBLE1BQ25DO0FBQ0Esa0JBQVksU0FBUyxFQUFFLFdBQVcsQ0FBQyxPQUFPLEtBQUssRUFBRSxDQUFDO0FBQ2xELFlBQU0sUUFBUSxNQUFNLFlBQVksU0FBUztBQUN6QyxzQkFBZ0IsTUFBTSxTQUFTLFlBQVksQ0FBQyxFQUFFLE1BQU0sTUFBTSxJQUFJO0FBQzlELHNCQUFnQixNQUFNLFNBQVMsWUFBWSxDQUFDLEVBQUUsTUFBTSxNQUFNLElBQUk7QUFDOUQsWUFBTSxVQUFVLE1BQU0sWUFBWSxlQUFlLEtBQUs7QUFDdEQsa0JBQVksU0FBUyxNQUFTO0FBQzlCLGtCQUFZLFNBQVMsRUFBRSxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDM0MsWUFBTSxXQUFXLE1BQU0sWUFBWSxlQUFlLFdBQVc7QUFDN0Qsa0JBQVksVUFBVSxLQUFLO0FBQUEsSUFDNUIsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUNGLENBQUM7QUFDRCxTQUFTLGNBQWlCLEdBQWtCO0FBQzNDLFNBQU87QUFDUjsiLAogICJuYW1lcyI6IFtdCn0K
