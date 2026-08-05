import { isWindows, OperatingSystem } from "../../../../../../base/common/platform.js";
import { format } from "../../../../../../base/common/strings.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../../platform/configuration/test/common/testConfigurationService.js";
import { TestInstantiationService } from "../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { TerminalBuiltinLinkType } from "../../browser/links.js";
import { TerminalLocalLinkDetector } from "../../browser/terminalLocalLinkDetector.js";
import { TerminalCapabilityStore } from "../../../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js";
import { assertLinkHelper } from "./linkTestUtils.js";
import { timeout } from "../../../../../../base/common/async.js";
import { strictEqual } from "assert";
import { TerminalLinkResolver } from "../../browser/terminalLinkResolver.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { createFileStat } from "../../../../../test/common/workbenchTestServices.js";
import { URI } from "../../../../../../base/common/uri.js";
import { NullLogService } from "../../../../../../platform/log/common/log.js";
import { ITerminalLogService } from "../../../../../../platform/terminal/common/terminal.js";
import { importAMDNodeModule } from "../../../../../../amdX.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
const unixLinks = [
  // Absolute
  "/foo",
  "/foo/bar",
  "/foo/[bar]",
  "/foo/[bar].baz",
  "/foo/[bar]/baz",
  "/foo/bar+more",
  // URI file://
  { link: "file:///foo", resource: URI.file("/foo") },
  { link: "file:///foo/bar", resource: URI.file("/foo/bar") },
  { link: "file:///foo/bar%20baz", resource: URI.file("/foo/bar baz") },
  // User home
  { link: "~/foo", resource: URI.file("/home/foo") },
  // Relative
  { link: "./foo", resource: URI.file("/parent/cwd/foo") },
  { link: "./$foo", resource: URI.file("/parent/cwd/$foo") },
  { link: "../foo", resource: URI.file("/parent/foo") },
  { link: "foo/bar", resource: URI.file("/parent/cwd/foo/bar") },
  { link: "foo/bar+more", resource: URI.file("/parent/cwd/foo/bar+more") }
];
const windowsLinks = [
  // Absolute
  "c:\\foo",
  { link: "\\\\?\\C:\\foo", resource: URI.file("C:\\foo") },
  "c:/foo",
  "c:/foo/bar",
  "c:\\foo\\bar",
  "c:\\foo\\bar+more",
  "c:\\foo/bar\\baz",
  // URI file://
  { link: "file:///c:/foo", resource: URI.file("c:\\foo") },
  { link: "file:///c:/foo/bar", resource: URI.file("c:\\foo\\bar") },
  { link: "file:///c:/foo/bar%20baz", resource: URI.file("c:\\foo\\bar baz") },
  // User home
  { link: "~\\foo", resource: URI.file("C:\\Home\\foo") },
  { link: "~/foo", resource: URI.file("C:\\Home\\foo") },
  // Relative
  { link: ".\\foo", resource: URI.file("C:\\Parent\\Cwd\\foo") },
  { link: "./foo", resource: URI.file("C:\\Parent\\Cwd\\foo") },
  { link: "./$foo", resource: URI.file("C:\\Parent\\Cwd\\$foo") },
  { link: "..\\foo", resource: URI.file("C:\\Parent\\foo") },
  { link: "foo/bar", resource: URI.file("C:\\Parent\\Cwd\\foo\\bar") },
  { link: "foo/bar", resource: URI.file("C:\\Parent\\Cwd\\foo\\bar") },
  { link: "foo/[bar]", resource: URI.file("C:\\Parent\\Cwd\\foo\\[bar]") },
  { link: "foo/[bar].baz", resource: URI.file("C:\\Parent\\Cwd\\foo\\[bar].baz") },
  { link: "foo/[bar]/baz", resource: URI.file("C:\\Parent\\Cwd\\foo\\[bar]/baz") },
  { link: "foo\\bar", resource: URI.file("C:\\Parent\\Cwd\\foo\\bar") },
  { link: "foo\\[bar].baz", resource: URI.file("C:\\Parent\\Cwd\\foo\\[bar].baz") },
  { link: "foo\\[bar]\\baz", resource: URI.file("C:\\Parent\\Cwd\\foo\\[bar]\\baz") },
  { link: "foo\\bar+more", resource: URI.file("C:\\Parent\\Cwd\\foo\\bar+more") }
];
const supportedLinkFormats = [
  { urlFormat: "{0}" },
  { urlFormat: '{0}" on line {1}', line: "5" },
  { urlFormat: '{0}" on line {1}, column {2}', line: "5", column: "3" },
  { urlFormat: '{0}":line {1}', line: "5" },
  { urlFormat: '{0}":line {1}, column {2}', line: "5", column: "3" },
  { urlFormat: '{0}": line {1}', line: "5" },
  { urlFormat: '{0}": line {1}, col {2}', line: "5", column: "3" },
  { urlFormat: "{0}({1})", line: "5" },
  { urlFormat: "{0} ({1})", line: "5" },
  { urlFormat: "{0}, {1}", line: "5" },
  { urlFormat: "{0}({1},{2})", line: "5", column: "3" },
  { urlFormat: "{0} ({1},{2})", line: "5", column: "3" },
  { urlFormat: "{0}: ({1},{2})", line: "5", column: "3" },
  { urlFormat: "{0}({1}, {2})", line: "5", column: "3" },
  { urlFormat: "{0} ({1}, {2})", line: "5", column: "3" },
  { urlFormat: "{0}: ({1}, {2})", line: "5", column: "3" },
  { urlFormat: "{0}({1}:{2})", line: "5", column: "3" },
  { urlFormat: "{0} ({1}:{2})", line: "5", column: "3" },
  { urlFormat: "{0}:{1}", line: "5" },
  { urlFormat: "{0}:{1}:{2}", line: "5", column: "3" },
  { urlFormat: "{0} {1}:{2}", line: "5", column: "3" },
  { urlFormat: "{0}[{1}]", line: "5" },
  { urlFormat: "{0} [{1}]", line: "5" },
  { urlFormat: "{0}[{1},{2}]", line: "5", column: "3" },
  { urlFormat: "{0} [{1},{2}]", line: "5", column: "3" },
  { urlFormat: "{0}: [{1},{2}]", line: "5", column: "3" },
  { urlFormat: "{0}[{1}, {2}]", line: "5", column: "3" },
  { urlFormat: "{0} [{1}, {2}]", line: "5", column: "3" },
  { urlFormat: "{0}: [{1}, {2}]", line: "5", column: "3" },
  { urlFormat: "{0}[{1}:{2}]", line: "5", column: "3" },
  { urlFormat: "{0} [{1}:{2}]", line: "5", column: "3" },
  { urlFormat: '{0}",{1}', line: "5" },
  { urlFormat: "{0}',{1}", line: "5" },
  { urlFormat: "{0}#{1}", line: "5" },
  { urlFormat: "{0}#{1}:{2}", line: "5", column: "5" }
];
const windowsFallbackLinks = [
  "C:\\foo bar",
  "C:\\foo bar\\baz",
  "C:\\foo\\bar baz",
  "C:\\foo/bar baz"
];
const supportedFallbackLinkFormats = [
  // Python style error: File "<path>", line <line>
  { urlFormat: 'File "{0}"', linkCellStartOffset: 5 },
  { urlFormat: 'File "{0}", line {1}', line: "5", linkCellStartOffset: 5 },
  // Unknown tool #200166: FILE  <path>:<line>:<col>
  { urlFormat: " FILE  {0}", linkCellStartOffset: 7 },
  { urlFormat: " FILE  {0}:{1}", line: "5", linkCellStartOffset: 7 },
  { urlFormat: " FILE  {0}:{1}:{2}", line: "5", column: "3", linkCellStartOffset: 7 },
  // Some C++ compile error formats
  { urlFormat: "{0}({1}) :", line: "5", linkCellEndOffset: -2 },
  { urlFormat: "{0}({1},{2}) :", line: "5", column: "3", linkCellEndOffset: -2 },
  { urlFormat: "{0}({1}, {2}) :", line: "5", column: "3", linkCellEndOffset: -2 },
  { urlFormat: "{0}({1}):", line: "5", linkCellEndOffset: -1 },
  { urlFormat: "{0}({1},{2}):", line: "5", column: "3", linkCellEndOffset: -1 },
  { urlFormat: "{0}({1}, {2}):", line: "5", column: "3", linkCellEndOffset: -1 },
  { urlFormat: "{0}:{1} :", line: "5", linkCellEndOffset: -2 },
  { urlFormat: "{0}:{1}:{2} :", line: "5", column: "3", linkCellEndOffset: -2 },
  { urlFormat: "{0}:{1}:", line: "5", linkCellEndOffset: -1 },
  { urlFormat: "{0}:{1}:{2}:", line: "5", column: "3", linkCellEndOffset: -1 },
  // Cmd prompt
  { urlFormat: "{0}>", linkCellEndOffset: -1 },
  // The whole line is the path
  { urlFormat: "{0}" }
];
suite("Workbench - TerminalLocalLinkDetector", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let instantiationService;
  let configurationService;
  let detector;
  let resolver;
  let xterm;
  let validResources;
  async function assertLinks(type, text, expected) {
    let to;
    const race = await Promise.race([
      assertLinkHelper(text, expected, detector, type).then(() => "success"),
      (to = timeout(2)).then(() => "timeout")
    ]);
    strictEqual(race, "success", `Awaiting link assertion for "${text}" timed out`);
    to.cancel();
  }
  async function assertLinksWithWrapped(link, resource) {
    const uri = resource ?? URI.file(link);
    await assertLinks(TerminalBuiltinLinkType.LocalFile, link, [{ uri, range: [[1, 1], [link.length, 1]] }]);
    await assertLinks(TerminalBuiltinLinkType.LocalFile, ` ${link} `, [{ uri, range: [[2, 1], [link.length + 1, 1]] }]);
    await assertLinks(TerminalBuiltinLinkType.LocalFile, `(${link})`, [{ uri, range: [[2, 1], [link.length + 1, 1]] }]);
    await assertLinks(TerminalBuiltinLinkType.LocalFile, `[${link}]`, [{ uri, range: [[2, 1], [link.length + 1, 1]] }]);
  }
  setup(async () => {
    instantiationService = store.add(new TestInstantiationService());
    configurationService = new TestConfigurationService();
    instantiationService.stub(IConfigurationService, configurationService);
    instantiationService.stub(IFileService, {
      async stat(resource) {
        if (!validResources.map((e) => e.path).includes(resource.path)) {
          throw new Error("Doesn't exist");
        }
        return createFileStat(resource);
      }
    });
    instantiationService.stub(ITerminalLogService, new NullLogService());
    resolver = instantiationService.createInstance(TerminalLinkResolver);
    validResources = [];
    const TerminalCtor = (await importAMDNodeModule("@xterm/xterm", "lib/xterm.js")).Terminal;
    xterm = new TerminalCtor({ allowProposedApi: true, cols: 80, rows: 30 });
  });
  suite("platform independent", () => {
    setup(() => {
      detector = instantiationService.createInstance(TerminalLocalLinkDetector, xterm, store.add(new TerminalCapabilityStore()), {
        initialCwd: "/parent/cwd",
        os: OperatingSystem.Linux,
        remoteAuthority: void 0,
        userHome: "/home",
        backend: void 0
      }, resolver);
    });
    test("should support multiple link results", async () => {
      validResources = [
        URI.file("/parent/cwd/foo"),
        URI.file("/parent/cwd/bar")
      ];
      await assertLinks(TerminalBuiltinLinkType.LocalFile, "./foo ./bar", [
        { range: [[1, 1], [5, 1]], uri: URI.file("/parent/cwd/foo") },
        { range: [[7, 1], [11, 1]], uri: URI.file("/parent/cwd/bar") }
      ]);
    });
    test("should support trimming extra quotes", async () => {
      validResources = [URI.file("/parent/cwd/foo")];
      await assertLinks(TerminalBuiltinLinkType.LocalFile, '"foo"" on line 5', [
        { range: [[1, 1], [16, 1]], uri: URI.file("/parent/cwd/foo") }
      ]);
    });
    test("should support trimming extra square brackets", async () => {
      validResources = [URI.file("/parent/cwd/foo")];
      await assertLinks(TerminalBuiltinLinkType.LocalFile, '"foo]" on line 5', [
        { range: [[1, 1], [16, 1]], uri: URI.file("/parent/cwd/foo") }
      ]);
    });
  });
  suite("macOS/Linux", () => {
    setup(() => {
      detector = instantiationService.createInstance(TerminalLocalLinkDetector, xterm, store.add(new TerminalCapabilityStore()), {
        initialCwd: "/parent/cwd",
        os: OperatingSystem.Linux,
        remoteAuthority: void 0,
        userHome: "/home",
        backend: void 0
      }, resolver);
    });
    for (const l of unixLinks) {
      const baseLink = typeof l === "string" ? l : l.link;
      const resource = typeof l === "string" ? URI.file(l) : l.resource;
      suite(`Link: ${baseLink}`, () => {
        for (let i = 0; i < supportedLinkFormats.length; i++) {
          const linkFormat = supportedLinkFormats[i];
          const formattedLink = format(linkFormat.urlFormat, baseLink, linkFormat.line, linkFormat.column);
          test(`should detect in "${formattedLink}"`, async () => {
            validResources = [resource];
            await assertLinksWithWrapped(formattedLink, resource);
          });
        }
      });
    }
    test("Git diff links", async () => {
      validResources = [URI.file("/parent/cwd/foo/bar")];
      await assertLinks(TerminalBuiltinLinkType.LocalFile, `diff --git a/foo/bar b/foo/bar`, [
        { uri: validResources[0], range: [[14, 1], [20, 1]] },
        { uri: validResources[0], range: [[24, 1], [30, 1]] }
      ]);
      await assertLinks(TerminalBuiltinLinkType.LocalFile, `--- a/foo/bar`, [{ uri: validResources[0], range: [[7, 1], [13, 1]] }]);
      await assertLinks(TerminalBuiltinLinkType.LocalFile, `+++ b/foo/bar`, [{ uri: validResources[0], range: [[7, 1], [13, 1]] }]);
    });
  });
  if (isWindows) {
    suite("Windows", () => {
      const wslUnixToWindowsPathMap = /* @__PURE__ */ new Map();
      setup(() => {
        detector = instantiationService.createInstance(TerminalLocalLinkDetector, xterm, store.add(new TerminalCapabilityStore()), {
          initialCwd: "C:\\Parent\\Cwd",
          os: OperatingSystem.Windows,
          remoteAuthority: void 0,
          userHome: "C:\\Home",
          backend: {
            async getWslPath(original, direction) {
              if (direction === "unix-to-win") {
                return wslUnixToWindowsPathMap.get(original) ?? original;
              }
              return original;
            }
          }
        }, resolver);
        wslUnixToWindowsPathMap.clear();
      });
      for (const l of windowsLinks) {
        const baseLink = typeof l === "string" ? l : l.link;
        const resource = typeof l === "string" ? URI.file(l) : l.resource;
        suite(`Link "${baseLink}"`, () => {
          for (let i = 0; i < supportedLinkFormats.length; i++) {
            const linkFormat = supportedLinkFormats[i];
            const formattedLink = format(linkFormat.urlFormat, baseLink, linkFormat.line, linkFormat.column);
            test(`should detect in "${formattedLink}"`, async () => {
              validResources = [resource];
              await assertLinksWithWrapped(formattedLink, resource);
            });
          }
        });
      }
      for (const l of windowsFallbackLinks) {
        const baseLink = typeof l === "string" ? l : l.link;
        const resource = typeof l === "string" ? URI.file(l) : l.resource;
        suite(`Fallback link "${baseLink}"`, () => {
          for (let i = 0; i < supportedFallbackLinkFormats.length; i++) {
            const linkFormat = supportedFallbackLinkFormats[i];
            const formattedLink = format(linkFormat.urlFormat, baseLink, linkFormat.line, linkFormat.column);
            const linkCellStartOffset = linkFormat.linkCellStartOffset ?? 0;
            const linkCellEndOffset = linkFormat.linkCellEndOffset ?? 0;
            test(`should detect in "${formattedLink}"`, async () => {
              validResources = [resource];
              await assertLinks(TerminalBuiltinLinkType.LocalFile, formattedLink, [{ uri: resource, range: [[1 + linkCellStartOffset, 1], [formattedLink.length + linkCellEndOffset, 1]] }]);
            });
          }
        });
      }
      test("Git diff links", async () => {
        const resource = URI.file("C:\\Parent\\Cwd\\foo\\bar");
        validResources = [resource];
        await assertLinks(TerminalBuiltinLinkType.LocalFile, `diff --git a/foo/bar b/foo/bar`, [
          { uri: resource, range: [[14, 1], [20, 1]] },
          { uri: resource, range: [[24, 1], [30, 1]] }
        ]);
        await assertLinks(TerminalBuiltinLinkType.LocalFile, `--- a/foo/bar`, [{ uri: resource, range: [[7, 1], [13, 1]] }]);
        await assertLinks(TerminalBuiltinLinkType.LocalFile, `+++ b/foo/bar`, [{ uri: resource, range: [[7, 1], [13, 1]] }]);
      });
      suite("WSL", () => {
        test("Unix -> Windows /mnt/ style links", async () => {
          wslUnixToWindowsPathMap.set("/mnt/c/foo/bar", "C:\\foo\\bar");
          validResources = [URI.file("C:\\foo\\bar")];
          await assertLinksWithWrapped("/mnt/c/foo/bar", validResources[0]);
        });
        test("Windows -> Unix \\\\wsl$\\ style links", async () => {
          validResources = [URI.file("\\\\wsl$\\Debian\\home\\foo\\bar")];
          await assertLinksWithWrapped("\\\\wsl$\\Debian\\home\\foo\\bar");
        });
        test("Windows -> Unix \\\\wsl.localhost\\ style links", async () => {
          validResources = [URI.file("\\\\wsl.localhost\\Debian\\home\\foo\\bar")];
          await assertLinksWithWrapped("\\\\wsl.localhost\\Debian\\home\\foo\\bar");
        });
      });
    });
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvbGlua3MvdGVzdC9icm93c2VyL3Rlcm1pbmFsTG9jYWxMaW5rRGV0ZWN0b3IudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGlzV2luZG93cywgT3BlcmF0aW5nU3lzdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZm9ybWF0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9saW5rcy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbExvY2FsTGlua0RldGVjdG9yIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci90ZXJtaW5hbExvY2FsTGlua0RldGVjdG9yLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy90ZXJtaW5hbENhcGFiaWxpdHlTdG9yZS5qcyc7XG5pbXBvcnQgeyBhc3NlcnRMaW5rSGVscGVyIH0gZnJvbSAnLi9saW5rVGVzdFV0aWxzLmpzJztcbmltcG9ydCB0eXBlIHsgVGVybWluYWwgfSBmcm9tICdAeHRlcm0veHRlcm0nO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IHN0cmljdEVxdWFsIH0gZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFRlcm1pbmFsTGlua1Jlc29sdmVyIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci90ZXJtaW5hbExpbmtSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRmlsZVN0YXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBpbXBvcnRBTUROb2RlTW9kdWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYW1kWC5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcblxuY29uc3QgdW5peExpbmtzOiAoc3RyaW5nIHwgeyBsaW5rOiBzdHJpbmc7IHJlc291cmNlOiBVUkkgfSlbXSA9IFtcblx0Ly8gQWJzb2x1dGVcblx0Jy9mb28nLFxuXHQnL2Zvby9iYXInLFxuXHQnL2Zvby9bYmFyXScsXG5cdCcvZm9vL1tiYXJdLmJheicsXG5cdCcvZm9vL1tiYXJdL2JheicsXG5cdCcvZm9vL2Jhcittb3JlJyxcblx0Ly8gVVJJIGZpbGU6Ly9cblx0eyBsaW5rOiAnZmlsZTovLy9mb28nLCByZXNvdXJjZTogVVJJLmZpbGUoJy9mb28nKSB9LFxuXHR7IGxpbms6ICdmaWxlOi8vL2Zvby9iYXInLCByZXNvdXJjZTogVVJJLmZpbGUoJy9mb28vYmFyJykgfSxcblx0eyBsaW5rOiAnZmlsZTovLy9mb28vYmFyJTIwYmF6JywgcmVzb3VyY2U6IFVSSS5maWxlKCcvZm9vL2JhciBiYXonKSB9LFxuXHQvLyBVc2VyIGhvbWVcblx0eyBsaW5rOiAnfi9mb28nLCByZXNvdXJjZTogVVJJLmZpbGUoJy9ob21lL2ZvbycpIH0sXG5cdC8vIFJlbGF0aXZlXG5cdHsgbGluazogJy4vZm9vJywgcmVzb3VyY2U6IFVSSS5maWxlKCcvcGFyZW50L2N3ZC9mb28nKSB9LFxuXHR7IGxpbms6ICcuLyRmb28nLCByZXNvdXJjZTogVVJJLmZpbGUoJy9wYXJlbnQvY3dkLyRmb28nKSB9LFxuXHR7IGxpbms6ICcuLi9mb28nLCByZXNvdXJjZTogVVJJLmZpbGUoJy9wYXJlbnQvZm9vJykgfSxcblx0eyBsaW5rOiAnZm9vL2JhcicsIHJlc291cmNlOiBVUkkuZmlsZSgnL3BhcmVudC9jd2QvZm9vL2JhcicpIH0sXG5cdHsgbGluazogJ2Zvby9iYXIrbW9yZScsIHJlc291cmNlOiBVUkkuZmlsZSgnL3BhcmVudC9jd2QvZm9vL2Jhcittb3JlJykgfSxcbl07XG5cbmNvbnN0IHdpbmRvd3NMaW5rczogKHN0cmluZyB8IHsgbGluazogc3RyaW5nOyByZXNvdXJjZTogVVJJIH0pW10gPSBbXG5cdC8vIEFic29sdXRlXG5cdCdjOlxcXFxmb28nLFxuXHR7IGxpbms6ICdcXFxcXFxcXD9cXFxcQzpcXFxcZm9vJywgcmVzb3VyY2U6IFVSSS5maWxlKCdDOlxcXFxmb28nKSB9LFxuXHQnYzovZm9vJyxcblx0J2M6L2Zvby9iYXInLFxuXHQnYzpcXFxcZm9vXFxcXGJhcicsXG5cdCdjOlxcXFxmb29cXFxcYmFyK21vcmUnLFxuXHQnYzpcXFxcZm9vL2JhclxcXFxiYXonLFxuXHQvLyBVUkkgZmlsZTovL1xuXHR7IGxpbms6ICdmaWxlOi8vL2M6L2ZvbycsIHJlc291cmNlOiBVUkkuZmlsZSgnYzpcXFxcZm9vJykgfSxcblx0eyBsaW5rOiAnZmlsZTovLy9jOi9mb28vYmFyJywgcmVzb3VyY2U6IFVSSS5maWxlKCdjOlxcXFxmb29cXFxcYmFyJykgfSxcblx0eyBsaW5rOiAnZmlsZTovLy9jOi9mb28vYmFyJTIwYmF6JywgcmVzb3VyY2U6IFVSSS5maWxlKCdjOlxcXFxmb29cXFxcYmFyIGJheicpIH0sXG5cdC8vIFVzZXIgaG9tZVxuXHR7IGxpbms6ICd+XFxcXGZvbycsIHJlc291cmNlOiBVUkkuZmlsZSgnQzpcXFxcSG9tZVxcXFxmb28nKSB9LFxuXHR7IGxpbms6ICd+L2ZvbycsIHJlc291cmNlOiBVUkkuZmlsZSgnQzpcXFxcSG9tZVxcXFxmb28nKSB9LFxuXHQvLyBSZWxhdGl2ZVxuXHR7IGxpbms6ICcuXFxcXGZvbycsIHJlc291cmNlOiBVUkkuZmlsZSgnQzpcXFxcUGFyZW50XFxcXEN3ZFxcXFxmb28nKSB9LFxuXHR7IGxpbms6ICcuL2ZvbycsIHJlc291cmNlOiBVUkkuZmlsZSgnQzpcXFxcUGFyZW50XFxcXEN3ZFxcXFxmb28nKSB9LFxuXHR7IGxpbms6ICcuLyRmb28nLCByZXNvdXJjZTogVVJJLmZpbGUoJ0M6XFxcXFBhcmVudFxcXFxDd2RcXFxcJGZvbycpIH0sXG5cdHsgbGluazogJy4uXFxcXGZvbycsIHJlc291cmNlOiBVUkkuZmlsZSgnQzpcXFxcUGFyZW50XFxcXGZvbycpIH0sXG5cdHsgbGluazogJ2Zvby9iYXInLCByZXNvdXJjZTogVVJJLmZpbGUoJ0M6XFxcXFBhcmVudFxcXFxDd2RcXFxcZm9vXFxcXGJhcicpIH0sXG5cdHsgbGluazogJ2Zvby9iYXInLCByZXNvdXJjZTogVVJJLmZpbGUoJ0M6XFxcXFBhcmVudFxcXFxDd2RcXFxcZm9vXFxcXGJhcicpIH0sXG5cdHsgbGluazogJ2Zvby9bYmFyXScsIHJlc291cmNlOiBVUkkuZmlsZSgnQzpcXFxcUGFyZW50XFxcXEN3ZFxcXFxmb29cXFxcW2Jhcl0nKSB9LFxuXHR7IGxpbms6ICdmb28vW2Jhcl0uYmF6JywgcmVzb3VyY2U6IFVSSS5maWxlKCdDOlxcXFxQYXJlbnRcXFxcQ3dkXFxcXGZvb1xcXFxbYmFyXS5iYXonKSB9LFxuXHR7IGxpbms6ICdmb28vW2Jhcl0vYmF6JywgcmVzb3VyY2U6IFVSSS5maWxlKCdDOlxcXFxQYXJlbnRcXFxcQ3dkXFxcXGZvb1xcXFxbYmFyXS9iYXonKSB9LFxuXHR7IGxpbms6ICdmb29cXFxcYmFyJywgcmVzb3VyY2U6IFVSSS5maWxlKCdDOlxcXFxQYXJlbnRcXFxcQ3dkXFxcXGZvb1xcXFxiYXInKSB9LFxuXHR7IGxpbms6ICdmb29cXFxcW2Jhcl0uYmF6JywgcmVzb3VyY2U6IFVSSS5maWxlKCdDOlxcXFxQYXJlbnRcXFxcQ3dkXFxcXGZvb1xcXFxbYmFyXS5iYXonKSB9LFxuXHR7IGxpbms6ICdmb29cXFxcW2Jhcl1cXFxcYmF6JywgcmVzb3VyY2U6IFVSSS5maWxlKCdDOlxcXFxQYXJlbnRcXFxcQ3dkXFxcXGZvb1xcXFxbYmFyXVxcXFxiYXonKSB9LFxuXHR7IGxpbms6ICdmb29cXFxcYmFyK21vcmUnLCByZXNvdXJjZTogVVJJLmZpbGUoJ0M6XFxcXFBhcmVudFxcXFxDd2RcXFxcZm9vXFxcXGJhcittb3JlJykgfSxcbl07XG5cbmludGVyZmFjZSBMaW5rRm9ybWF0SW5mbyB7XG5cdHVybEZvcm1hdDogc3RyaW5nO1xuXHQvKipcblx0ICogVGhlIHN0YXJ0IG9mZnNldCB0byB0aGUgYnVmZmVyIHJhbmdlIHRoYXQgaXMgbm90IGluIHRoZSBhY3R1YWwgbGluayAoYnV0IGlzIGluIHRoZSBtYXRjaGVkXG5cdCAqIGFyZWEuXG5cdCAqL1xuXHRsaW5rQ2VsbFN0YXJ0T2Zmc2V0PzogbnVtYmVyO1xuXHQvKipcblx0ICogVGhlIGVuZCBvZmZzZXQgdG8gdGhlIGJ1ZmZlciByYW5nZSB0aGF0IGlzIG5vdCBpbiB0aGUgYWN0dWFsIGxpbmsgKGJ1dCBpcyBpbiB0aGUgbWF0Y2hlZFxuXHQgKiBhcmVhLlxuXHQgKi9cblx0bGlua0NlbGxFbmRPZmZzZXQ/OiBudW1iZXI7XG5cdGxpbmU/OiBzdHJpbmc7XG5cdGNvbHVtbj86IHN0cmluZztcbn1cblxuY29uc3Qgc3VwcG9ydGVkTGlua0Zvcm1hdHM6IExpbmtGb3JtYXRJbmZvW10gPSBbXG5cdHsgdXJsRm9ybWF0OiAnezB9JyB9LFxuXHR7IHVybEZvcm1hdDogJ3swfVwiIG9uIGxpbmUgezF9JywgbGluZTogJzUnIH0sXG5cdHsgdXJsRm9ybWF0OiAnezB9XCIgb24gbGluZSB7MX0sIGNvbHVtbiB7Mn0nLCBsaW5lOiAnNScsIGNvbHVtbjogJzMnIH0sXG5cdHsgdXJsRm9ybWF0OiAnezB9XCI6bGluZSB7MX0nLCBsaW5lOiAnNScgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH1cIjpsaW5lIHsxfSwgY29sdW1uIHsyfScsIGxpbmU6ICc1JywgY29sdW1uOiAnMycgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH1cIjogbGluZSB7MX0nLCBsaW5lOiAnNScgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH1cIjogbGluZSB7MX0sIGNvbCB7Mn0nLCBsaW5lOiAnNScsIGNvbHVtbjogJzMnIH0sXG5cdHsgdXJsRm9ybWF0OiAnezB9KHsxfSknLCBsaW5lOiAnNScgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH0gKHsxfSknLCBsaW5lOiAnNScgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH0sIHsxfScsIGxpbmU6ICc1JyB9LFxuXHR7IHVybEZvcm1hdDogJ3swfSh7MX0sezJ9KScsIGxpbmU6ICc1JywgY29sdW1uOiAnMycgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH0gKHsxfSx7Mn0pJywgbGluZTogJzUnLCBjb2x1bW46ICczJyB9LFxuXHR7IHVybEZvcm1hdDogJ3swfTogKHsxfSx7Mn0pJywgbGluZTogJzUnLCBjb2x1bW46ICczJyB9LFxuXHR7IHVybEZvcm1hdDogJ3swfSh7MX0sIHsyfSknLCBsaW5lOiAnNScsIGNvbHVtbjogJzMnIH0sXG5cdHsgdXJsRm9ybWF0OiAnezB9ICh7MX0sIHsyfSknLCBsaW5lOiAnNScsIGNvbHVtbjogJzMnIH0sXG5cdHsgdXJsRm9ybWF0OiAnezB9OiAoezF9LCB7Mn0pJywgbGluZTogJzUnLCBjb2x1bW46ICczJyB9LFxuXHR7IHVybEZvcm1hdDogJ3swfSh7MX06ezJ9KScsIGxpbmU6ICc1JywgY29sdW1uOiAnMycgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH0gKHsxfTp7Mn0pJywgbGluZTogJzUnLCBjb2x1bW46ICczJyB9LFxuXHR7IHVybEZvcm1hdDogJ3swfTp7MX0nLCBsaW5lOiAnNScgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH06ezF9OnsyfScsIGxpbmU6ICc1JywgY29sdW1uOiAnMycgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH0gezF9OnsyfScsIGxpbmU6ICc1JywgY29sdW1uOiAnMycgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH1bezF9XScsIGxpbmU6ICc1JyB9LFxuXHR7IHVybEZvcm1hdDogJ3swfSBbezF9XScsIGxpbmU6ICc1JyB9LFxuXHR7IHVybEZvcm1hdDogJ3swfVt7MX0sezJ9XScsIGxpbmU6ICc1JywgY29sdW1uOiAnMycgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH0gW3sxfSx7Mn1dJywgbGluZTogJzUnLCBjb2x1bW46ICczJyB9LFxuXHR7IHVybEZvcm1hdDogJ3swfTogW3sxfSx7Mn1dJywgbGluZTogJzUnLCBjb2x1bW46ICczJyB9LFxuXHR7IHVybEZvcm1hdDogJ3swfVt7MX0sIHsyfV0nLCBsaW5lOiAnNScsIGNvbHVtbjogJzMnIH0sXG5cdHsgdXJsRm9ybWF0OiAnezB9IFt7MX0sIHsyfV0nLCBsaW5lOiAnNScsIGNvbHVtbjogJzMnIH0sXG5cdHsgdXJsRm9ybWF0OiAnezB9OiBbezF9LCB7Mn1dJywgbGluZTogJzUnLCBjb2x1bW46ICczJyB9LFxuXHR7IHVybEZvcm1hdDogJ3swfVt7MX06ezJ9XScsIGxpbmU6ICc1JywgY29sdW1uOiAnMycgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH0gW3sxfTp7Mn1dJywgbGluZTogJzUnLCBjb2x1bW46ICczJyB9LFxuXHR7IHVybEZvcm1hdDogJ3swfVwiLHsxfScsIGxpbmU6ICc1JyB9LFxuXHR7IHVybEZvcm1hdDogJ3swfVxcJyx7MX0nLCBsaW5lOiAnNScgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH0jezF9JywgbGluZTogJzUnIH0sXG5cdHsgdXJsRm9ybWF0OiAnezB9I3sxfTp7Mn0nLCBsaW5lOiAnNScsIGNvbHVtbjogJzUnIH1cbl07XG5cbmNvbnN0IHdpbmRvd3NGYWxsYmFja0xpbmtzOiAoc3RyaW5nIHwgeyBsaW5rOiBzdHJpbmc7IHJlc291cmNlOiBVUkkgfSlbXSA9IFtcblx0J0M6XFxcXGZvbyBiYXInLFxuXHQnQzpcXFxcZm9vIGJhclxcXFxiYXonLFxuXHQnQzpcXFxcZm9vXFxcXGJhciBiYXonLFxuXHQnQzpcXFxcZm9vL2JhciBiYXonXG5dO1xuXG5jb25zdCBzdXBwb3J0ZWRGYWxsYmFja0xpbmtGb3JtYXRzOiBMaW5rRm9ybWF0SW5mb1tdID0gW1xuXHQvLyBQeXRob24gc3R5bGUgZXJyb3I6IEZpbGUgXCI8cGF0aD5cIiwgbGluZSA8bGluZT5cblx0eyB1cmxGb3JtYXQ6ICdGaWxlIFwiezB9XCInLCBsaW5rQ2VsbFN0YXJ0T2Zmc2V0OiA1IH0sXG5cdHsgdXJsRm9ybWF0OiAnRmlsZSBcInswfVwiLCBsaW5lIHsxfScsIGxpbmU6ICc1JywgbGlua0NlbGxTdGFydE9mZnNldDogNSB9LFxuXHQvLyBVbmtub3duIHRvb2wgIzIwMDE2NjogRklMRSAgPHBhdGg+OjxsaW5lPjo8Y29sPlxuXHR7IHVybEZvcm1hdDogJyBGSUxFICB7MH0nLCBsaW5rQ2VsbFN0YXJ0T2Zmc2V0OiA3IH0sXG5cdHsgdXJsRm9ybWF0OiAnIEZJTEUgIHswfTp7MX0nLCBsaW5lOiAnNScsIGxpbmtDZWxsU3RhcnRPZmZzZXQ6IDcgfSxcblx0eyB1cmxGb3JtYXQ6ICcgRklMRSAgezB9OnsxfTp7Mn0nLCBsaW5lOiAnNScsIGNvbHVtbjogJzMnLCBsaW5rQ2VsbFN0YXJ0T2Zmc2V0OiA3IH0sXG5cdC8vIFNvbWUgQysrIGNvbXBpbGUgZXJyb3IgZm9ybWF0c1xuXHR7IHVybEZvcm1hdDogJ3swfSh7MX0pIDonLCBsaW5lOiAnNScsIGxpbmtDZWxsRW5kT2Zmc2V0OiAtMiB9LFxuXHR7IHVybEZvcm1hdDogJ3swfSh7MX0sezJ9KSA6JywgbGluZTogJzUnLCBjb2x1bW46ICczJywgbGlua0NlbGxFbmRPZmZzZXQ6IC0yIH0sXG5cdHsgdXJsRm9ybWF0OiAnezB9KHsxfSwgezJ9KSA6JywgbGluZTogJzUnLCBjb2x1bW46ICczJywgbGlua0NlbGxFbmRPZmZzZXQ6IC0yIH0sXG5cdHsgdXJsRm9ybWF0OiAnezB9KHsxfSk6JywgbGluZTogJzUnLCBsaW5rQ2VsbEVuZE9mZnNldDogLTEgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH0oezF9LHsyfSk6JywgbGluZTogJzUnLCBjb2x1bW46ICczJywgbGlua0NlbGxFbmRPZmZzZXQ6IC0xIH0sXG5cdHsgdXJsRm9ybWF0OiAnezB9KHsxfSwgezJ9KTonLCBsaW5lOiAnNScsIGNvbHVtbjogJzMnLCBsaW5rQ2VsbEVuZE9mZnNldDogLTEgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH06ezF9IDonLCBsaW5lOiAnNScsIGxpbmtDZWxsRW5kT2Zmc2V0OiAtMiB9LFxuXHR7IHVybEZvcm1hdDogJ3swfTp7MX06ezJ9IDonLCBsaW5lOiAnNScsIGNvbHVtbjogJzMnLCBsaW5rQ2VsbEVuZE9mZnNldDogLTIgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH06ezF9OicsIGxpbmU6ICc1JywgbGlua0NlbGxFbmRPZmZzZXQ6IC0xIH0sXG5cdHsgdXJsRm9ybWF0OiAnezB9OnsxfTp7Mn06JywgbGluZTogJzUnLCBjb2x1bW46ICczJywgbGlua0NlbGxFbmRPZmZzZXQ6IC0xIH0sXG5cdC8vIENtZCBwcm9tcHRcblx0eyB1cmxGb3JtYXQ6ICd7MH0+JywgbGlua0NlbGxFbmRPZmZzZXQ6IC0xIH0sXG5cdC8vIFRoZSB3aG9sZSBsaW5lIGlzIHRoZSBwYXRoXG5cdHsgdXJsRm9ybWF0OiAnezB9JyB9LFxuXTtcblxuc3VpdGUoJ1dvcmtiZW5jaCAtIFRlcm1pbmFsTG9jYWxMaW5rRGV0ZWN0b3InLCAoKSA9PiB7XG5cdGNvbnN0IHN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBjb25maWd1cmF0aW9uU2VydmljZTogVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlO1xuXHRsZXQgZGV0ZWN0b3I6IFRlcm1pbmFsTG9jYWxMaW5rRGV0ZWN0b3I7XG5cdGxldCByZXNvbHZlcjogVGVybWluYWxMaW5rUmVzb2x2ZXI7XG5cdGxldCB4dGVybTogVGVybWluYWw7XG5cdGxldCB2YWxpZFJlc291cmNlczogVVJJW107XG5cblx0YXN5bmMgZnVuY3Rpb24gYXNzZXJ0TGlua3MoXG5cdFx0dHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGUsXG5cdFx0dGV4dDogc3RyaW5nLFxuXHRcdGV4cGVjdGVkOiAoeyB1cmk6IFVSSTsgcmFuZ2U6IFtudW1iZXIsIG51bWJlcl1bXSB9KVtdXG5cdCkge1xuXHRcdGxldCB0bztcblx0XHRjb25zdCByYWNlID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdGFzc2VydExpbmtIZWxwZXIodGV4dCwgZXhwZWN0ZWQsIGRldGVjdG9yLCB0eXBlKS50aGVuKCgpID0+ICdzdWNjZXNzJyksXG5cdFx0XHQodG8gPSB0aW1lb3V0KDIpKS50aGVuKCgpID0+ICd0aW1lb3V0Jylcblx0XHRdKTtcblx0XHRzdHJpY3RFcXVhbChyYWNlLCAnc3VjY2VzcycsIGBBd2FpdGluZyBsaW5rIGFzc2VydGlvbiBmb3IgXCIke3RleHR9XCIgdGltZWQgb3V0YCk7XG5cdFx0dG8uY2FuY2VsKCk7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBhc3NlcnRMaW5rc1dpdGhXcmFwcGVkKGxpbms6IHN0cmluZywgcmVzb3VyY2U/OiBVUkkpIHtcblx0XHRjb25zdCB1cmkgPSByZXNvdXJjZSA/PyBVUkkuZmlsZShsaW5rKTtcblx0XHRhd2FpdCBhc3NlcnRMaW5rcyhUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5Mb2NhbEZpbGUsIGxpbmssIFt7IHVyaSwgcmFuZ2U6IFtbMSwgMV0sIFtsaW5rLmxlbmd0aCwgMV1dIH1dKTtcblx0XHRhd2FpdCBhc3NlcnRMaW5rcyhUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5Mb2NhbEZpbGUsIGAgJHtsaW5rfSBgLCBbeyB1cmksIHJhbmdlOiBbWzIsIDFdLCBbbGluay5sZW5ndGggKyAxLCAxXV0gfV0pO1xuXHRcdGF3YWl0IGFzc2VydExpbmtzKFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLkxvY2FsRmlsZSwgYCgke2xpbmt9KWAsIFt7IHVyaSwgcmFuZ2U6IFtbMiwgMV0sIFtsaW5rLmxlbmd0aCArIDEsIDFdXSB9XSk7XG5cdFx0YXdhaXQgYXNzZXJ0TGlua3MoVGVybWluYWxCdWlsdGluTGlua1R5cGUuTG9jYWxGaWxlLCBgWyR7bGlua31dYCwgW3sgdXJpLCByYW5nZTogW1syLCAxXSwgW2xpbmsubGVuZ3RoICsgMSwgMV1dIH1dKTtcblx0fVxuXG5cdHNldHVwKGFzeW5jICgpID0+IHtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0b3JlLmFkZChuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCkpO1xuXHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRmlsZVNlcnZpY2UsIHtcblx0XHRcdGFzeW5jIHN0YXQocmVzb3VyY2UpIHtcblx0XHRcdFx0aWYgKCF2YWxpZFJlc291cmNlcy5tYXAoZSA9PiBlLnBhdGgpLmluY2x1ZGVzKHJlc291cmNlLnBhdGgpKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdEb2VzblxcJ3QgZXhpc3QnKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gY3JlYXRlRmlsZVN0YXQocmVzb3VyY2UpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRlcm1pbmFsTG9nU2VydmljZSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdHJlc29sdmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMaW5rUmVzb2x2ZXIpO1xuXHRcdHZhbGlkUmVzb3VyY2VzID0gW107XG5cblx0XHRjb25zdCBUZXJtaW5hbEN0b3IgPSAoYXdhaXQgaW1wb3J0QU1ETm9kZU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAeHRlcm0veHRlcm0nKT4oJ0B4dGVybS94dGVybScsICdsaWIveHRlcm0uanMnKSkuVGVybWluYWw7XG5cdFx0eHRlcm0gPSBuZXcgVGVybWluYWxDdG9yKHsgYWxsb3dQcm9wb3NlZEFwaTogdHJ1ZSwgY29sczogODAsIHJvd3M6IDMwIH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgncGxhdGZvcm0gaW5kZXBlbmRlbnQnLCAoKSA9PiB7XG5cdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0ZGV0ZWN0b3IgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExvY2FsTGlua0RldGVjdG9yLCB4dGVybSwgc3RvcmUuYWRkKG5ldyBUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSgpKSwge1xuXHRcdFx0XHRpbml0aWFsQ3dkOiAnL3BhcmVudC9jd2QnLFxuXHRcdFx0XHRvczogT3BlcmF0aW5nU3lzdGVtLkxpbnV4LFxuXHRcdFx0XHRyZW1vdGVBdXRob3JpdHk6IHVuZGVmaW5lZCxcblx0XHRcdFx0dXNlckhvbWU6ICcvaG9tZScsXG5cdFx0XHRcdGJhY2tlbmQ6IHVuZGVmaW5lZFxuXHRcdFx0fSwgcmVzb2x2ZXIpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIHN1cHBvcnQgbXVsdGlwbGUgbGluayByZXN1bHRzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0dmFsaWRSZXNvdXJjZXMgPSBbXG5cdFx0XHRcdFVSSS5maWxlKCcvcGFyZW50L2N3ZC9mb28nKSxcblx0XHRcdFx0VVJJLmZpbGUoJy9wYXJlbnQvY3dkL2JhcicpXG5cdFx0XHRdO1xuXHRcdFx0YXdhaXQgYXNzZXJ0TGlua3MoVGVybWluYWxCdWlsdGluTGlua1R5cGUuTG9jYWxGaWxlLCAnLi9mb28gLi9iYXInLCBbXG5cdFx0XHRcdHsgcmFuZ2U6IFtbMSwgMV0sIFs1LCAxXV0sIHVyaTogVVJJLmZpbGUoJy9wYXJlbnQvY3dkL2ZvbycpIH0sXG5cdFx0XHRcdHsgcmFuZ2U6IFtbNywgMV0sIFsxMSwgMV1dLCB1cmk6IFVSSS5maWxlKCcvcGFyZW50L2N3ZC9iYXInKSB9XG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBzdXBwb3J0IHRyaW1taW5nIGV4dHJhIHF1b3RlcycsIGFzeW5jICgpID0+IHtcblx0XHRcdHZhbGlkUmVzb3VyY2VzID0gW1VSSS5maWxlKCcvcGFyZW50L2N3ZC9mb28nKV07XG5cdFx0XHRhd2FpdCBhc3NlcnRMaW5rcyhUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5Mb2NhbEZpbGUsICdcImZvb1wiXCIgb24gbGluZSA1JywgW1xuXHRcdFx0XHR7IHJhbmdlOiBbWzEsIDFdLCBbMTYsIDFdXSwgdXJpOiBVUkkuZmlsZSgnL3BhcmVudC9jd2QvZm9vJykgfVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgc3VwcG9ydCB0cmltbWluZyBleHRyYSBzcXVhcmUgYnJhY2tldHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHR2YWxpZFJlc291cmNlcyA9IFtVUkkuZmlsZSgnL3BhcmVudC9jd2QvZm9vJyldO1xuXHRcdFx0YXdhaXQgYXNzZXJ0TGlua3MoVGVybWluYWxCdWlsdGluTGlua1R5cGUuTG9jYWxGaWxlLCAnXCJmb29dXCIgb24gbGluZSA1JywgW1xuXHRcdFx0XHR7IHJhbmdlOiBbWzEsIDFdLCBbMTYsIDFdXSwgdXJpOiBVUkkuZmlsZSgnL3BhcmVudC9jd2QvZm9vJykgfVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdtYWNPUy9MaW51eCcsICgpID0+IHtcblx0XHRzZXR1cCgoKSA9PiB7XG5cdFx0XHRkZXRlY3RvciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsTG9jYWxMaW5rRGV0ZWN0b3IsIHh0ZXJtLCBzdG9yZS5hZGQobmV3IFRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlKCkpLCB7XG5cdFx0XHRcdGluaXRpYWxDd2Q6ICcvcGFyZW50L2N3ZCcsXG5cdFx0XHRcdG9zOiBPcGVyYXRpbmdTeXN0ZW0uTGludXgsXG5cdFx0XHRcdHJlbW90ZUF1dGhvcml0eTogdW5kZWZpbmVkLFxuXHRcdFx0XHR1c2VySG9tZTogJy9ob21lJyxcblx0XHRcdFx0YmFja2VuZDogdW5kZWZpbmVkXG5cdFx0XHR9LCByZXNvbHZlcik7XG5cdFx0fSk7XG5cblx0XHRmb3IgKGNvbnN0IGwgb2YgdW5peExpbmtzKSB7XG5cdFx0XHRjb25zdCBiYXNlTGluayA9IHR5cGVvZiBsID09PSAnc3RyaW5nJyA/IGwgOiBsLmxpbms7XG5cdFx0XHRjb25zdCByZXNvdXJjZSA9IHR5cGVvZiBsID09PSAnc3RyaW5nJyA/IFVSSS5maWxlKGwpIDogbC5yZXNvdXJjZTtcblx0XHRcdHN1aXRlKGBMaW5rOiAke2Jhc2VMaW5rfWAsICgpID0+IHtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzdXBwb3J0ZWRMaW5rRm9ybWF0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGNvbnN0IGxpbmtGb3JtYXQgPSBzdXBwb3J0ZWRMaW5rRm9ybWF0c1tpXTtcblx0XHRcdFx0XHRjb25zdCBmb3JtYXR0ZWRMaW5rID0gZm9ybWF0KGxpbmtGb3JtYXQudXJsRm9ybWF0LCBiYXNlTGluaywgbGlua0Zvcm1hdC5saW5lLCBsaW5rRm9ybWF0LmNvbHVtbik7XG5cdFx0XHRcdFx0dGVzdChgc2hvdWxkIGRldGVjdCBpbiBcIiR7Zm9ybWF0dGVkTGlua31cImAsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdHZhbGlkUmVzb3VyY2VzID0gW3Jlc291cmNlXTtcblx0XHRcdFx0XHRcdGF3YWl0IGFzc2VydExpbmtzV2l0aFdyYXBwZWQoZm9ybWF0dGVkTGluaywgcmVzb3VyY2UpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHR0ZXN0KCdHaXQgZGlmZiBsaW5rcycsIGFzeW5jICgpID0+IHtcblx0XHRcdHZhbGlkUmVzb3VyY2VzID0gW1VSSS5maWxlKCcvcGFyZW50L2N3ZC9mb28vYmFyJyldO1xuXHRcdFx0YXdhaXQgYXNzZXJ0TGlua3MoVGVybWluYWxCdWlsdGluTGlua1R5cGUuTG9jYWxGaWxlLCBgZGlmZiAtLWdpdCBhL2Zvby9iYXIgYi9mb28vYmFyYCwgW1xuXHRcdFx0XHR7IHVyaTogdmFsaWRSZXNvdXJjZXNbMF0sIHJhbmdlOiBbWzE0LCAxXSwgWzIwLCAxXV0gfSxcblx0XHRcdFx0eyB1cmk6IHZhbGlkUmVzb3VyY2VzWzBdLCByYW5nZTogW1syNCwgMV0sIFszMCwgMV1dIH1cblx0XHRcdF0pO1xuXHRcdFx0YXdhaXQgYXNzZXJ0TGlua3MoVGVybWluYWxCdWlsdGluTGlua1R5cGUuTG9jYWxGaWxlLCBgLS0tIGEvZm9vL2JhcmAsIFt7IHVyaTogdmFsaWRSZXNvdXJjZXNbMF0sIHJhbmdlOiBbWzcsIDFdLCBbMTMsIDFdXSB9XSk7XG5cdFx0XHRhd2FpdCBhc3NlcnRMaW5rcyhUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5Mb2NhbEZpbGUsIGArKysgYi9mb28vYmFyYCwgW3sgdXJpOiB2YWxpZFJlc291cmNlc1swXSwgcmFuZ2U6IFtbNywgMV0sIFsxMywgMV1dIH1dKTtcblx0XHR9KTtcblx0fSk7XG5cblx0Ly8gT25seSB0ZXN0IHRoZXNlIHdoZW4gb24gV2luZG93cyBiZWNhdXNlIHRoZXJlIGlzIHNwZWNpYWwgYmVoYXZpb3IgYXJvdW5kIHJlcGxhY2luZyBzZXBhcmF0b3JzXG5cdC8vIGluIFVSSSB0aGF0IGNhbm5vdCBiZSBjaGFuZ2VkXG5cdGlmIChpc1dpbmRvd3MpIHtcblx0XHRzdWl0ZSgnV2luZG93cycsICgpID0+IHtcblx0XHRcdGNvbnN0IHdzbFVuaXhUb1dpbmRvd3NQYXRoTWFwOiBNYXA8c3RyaW5nLCBzdHJpbmc+ID0gbmV3IE1hcCgpO1xuXG5cdFx0XHRzZXR1cCgoKSA9PiB7XG5cdFx0XHRcdGRldGVjdG9yID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbExpbmtEZXRlY3RvciwgeHRlcm0sIHN0b3JlLmFkZChuZXcgVGVybWluYWxDYXBhYmlsaXR5U3RvcmUoKSksIHtcblx0XHRcdFx0XHRpbml0aWFsQ3dkOiAnQzpcXFxcUGFyZW50XFxcXEN3ZCcsXG5cdFx0XHRcdFx0b3M6IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzLFxuXHRcdFx0XHRcdHJlbW90ZUF1dGhvcml0eTogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHVzZXJIb21lOiAnQzpcXFxcSG9tZScsXG5cdFx0XHRcdFx0YmFja2VuZDoge1xuXHRcdFx0XHRcdFx0YXN5bmMgZ2V0V3NsUGF0aChvcmlnaW5hbDogc3RyaW5nLCBkaXJlY3Rpb246ICd1bml4LXRvLXdpbicgfCAnd2luLXRvLXVuaXgnKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChkaXJlY3Rpb24gPT09ICd1bml4LXRvLXdpbicpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3NsVW5peFRvV2luZG93c1BhdGhNYXAuZ2V0KG9yaWdpbmFsKSA/PyBvcmlnaW5hbDtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gb3JpZ2luYWw7XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSwgcmVzb2x2ZXIpO1xuXHRcdFx0XHR3c2xVbml4VG9XaW5kb3dzUGF0aE1hcC5jbGVhcigpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGZvciAoY29uc3QgbCBvZiB3aW5kb3dzTGlua3MpIHtcblx0XHRcdFx0Y29uc3QgYmFzZUxpbmsgPSB0eXBlb2YgbCA9PT0gJ3N0cmluZycgPyBsIDogbC5saW5rO1xuXHRcdFx0XHRjb25zdCByZXNvdXJjZSA9IHR5cGVvZiBsID09PSAnc3RyaW5nJyA/IFVSSS5maWxlKGwpIDogbC5yZXNvdXJjZTtcblx0XHRcdFx0c3VpdGUoYExpbmsgXCIke2Jhc2VMaW5rfVwiYCwgKCkgPT4ge1xuXHRcdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc3VwcG9ydGVkTGlua0Zvcm1hdHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdGNvbnN0IGxpbmtGb3JtYXQgPSBzdXBwb3J0ZWRMaW5rRm9ybWF0c1tpXTtcblx0XHRcdFx0XHRcdGNvbnN0IGZvcm1hdHRlZExpbmsgPSBmb3JtYXQobGlua0Zvcm1hdC51cmxGb3JtYXQsIGJhc2VMaW5rLCBsaW5rRm9ybWF0LmxpbmUsIGxpbmtGb3JtYXQuY29sdW1uKTtcblx0XHRcdFx0XHRcdHRlc3QoYHNob3VsZCBkZXRlY3QgaW4gXCIke2Zvcm1hdHRlZExpbmt9XCJgLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHZhbGlkUmVzb3VyY2VzID0gW3Jlc291cmNlXTtcblx0XHRcdFx0XHRcdFx0YXdhaXQgYXNzZXJ0TGlua3NXaXRoV3JhcHBlZChmb3JtYXR0ZWRMaW5rLCByZXNvdXJjZSk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IGwgb2Ygd2luZG93c0ZhbGxiYWNrTGlua3MpIHtcblx0XHRcdFx0Y29uc3QgYmFzZUxpbmsgPSB0eXBlb2YgbCA9PT0gJ3N0cmluZycgPyBsIDogbC5saW5rO1xuXHRcdFx0XHRjb25zdCByZXNvdXJjZSA9IHR5cGVvZiBsID09PSAnc3RyaW5nJyA/IFVSSS5maWxlKGwpIDogbC5yZXNvdXJjZTtcblx0XHRcdFx0c3VpdGUoYEZhbGxiYWNrIGxpbmsgXCIke2Jhc2VMaW5rfVwiYCwgKCkgPT4ge1xuXHRcdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc3VwcG9ydGVkRmFsbGJhY2tMaW5rRm9ybWF0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0Y29uc3QgbGlua0Zvcm1hdCA9IHN1cHBvcnRlZEZhbGxiYWNrTGlua0Zvcm1hdHNbaV07XG5cdFx0XHRcdFx0XHRjb25zdCBmb3JtYXR0ZWRMaW5rID0gZm9ybWF0KGxpbmtGb3JtYXQudXJsRm9ybWF0LCBiYXNlTGluaywgbGlua0Zvcm1hdC5saW5lLCBsaW5rRm9ybWF0LmNvbHVtbik7XG5cdFx0XHRcdFx0XHRjb25zdCBsaW5rQ2VsbFN0YXJ0T2Zmc2V0ID0gbGlua0Zvcm1hdC5saW5rQ2VsbFN0YXJ0T2Zmc2V0ID8/IDA7XG5cdFx0XHRcdFx0XHRjb25zdCBsaW5rQ2VsbEVuZE9mZnNldCA9IGxpbmtGb3JtYXQubGlua0NlbGxFbmRPZmZzZXQgPz8gMDtcblx0XHRcdFx0XHRcdHRlc3QoYHNob3VsZCBkZXRlY3QgaW4gXCIke2Zvcm1hdHRlZExpbmt9XCJgLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHZhbGlkUmVzb3VyY2VzID0gW3Jlc291cmNlXTtcblx0XHRcdFx0XHRcdFx0YXdhaXQgYXNzZXJ0TGlua3MoVGVybWluYWxCdWlsdGluTGlua1R5cGUuTG9jYWxGaWxlLCBmb3JtYXR0ZWRMaW5rLCBbeyB1cmk6IHJlc291cmNlLCByYW5nZTogW1sxICsgbGlua0NlbGxTdGFydE9mZnNldCwgMV0sIFtmb3JtYXR0ZWRMaW5rLmxlbmd0aCArIGxpbmtDZWxsRW5kT2Zmc2V0LCAxXV0gfV0pO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0dGVzdCgnR2l0IGRpZmYgbGlua3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJ0M6XFxcXFBhcmVudFxcXFxDd2RcXFxcZm9vXFxcXGJhcicpO1xuXHRcdFx0XHR2YWxpZFJlc291cmNlcyA9IFtyZXNvdXJjZV07XG5cdFx0XHRcdGF3YWl0IGFzc2VydExpbmtzKFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLkxvY2FsRmlsZSwgYGRpZmYgLS1naXQgYS9mb28vYmFyIGIvZm9vL2JhcmAsIFtcblx0XHRcdFx0XHR7IHVyaTogcmVzb3VyY2UsIHJhbmdlOiBbWzE0LCAxXSwgWzIwLCAxXV0gfSxcblx0XHRcdFx0XHR7IHVyaTogcmVzb3VyY2UsIHJhbmdlOiBbWzI0LCAxXSwgWzMwLCAxXV0gfVxuXHRcdFx0XHRdKTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0TGlua3MoVGVybWluYWxCdWlsdGluTGlua1R5cGUuTG9jYWxGaWxlLCBgLS0tIGEvZm9vL2JhcmAsIFt7IHVyaTogcmVzb3VyY2UsIHJhbmdlOiBbWzcsIDFdLCBbMTMsIDFdXSB9XSk7XG5cdFx0XHRcdGF3YWl0IGFzc2VydExpbmtzKFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLkxvY2FsRmlsZSwgYCsrKyBiL2Zvby9iYXJgLCBbeyB1cmk6IHJlc291cmNlLCByYW5nZTogW1s3LCAxXSwgWzEzLCAxXV0gfV0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHN1aXRlKCdXU0wnLCAoKSA9PiB7XG5cdFx0XHRcdHRlc3QoJ1VuaXggLT4gV2luZG93cyAvbW50LyBzdHlsZSBsaW5rcycsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHR3c2xVbml4VG9XaW5kb3dzUGF0aE1hcC5zZXQoJy9tbnQvYy9mb28vYmFyJywgJ0M6XFxcXGZvb1xcXFxiYXInKTtcblx0XHRcdFx0XHR2YWxpZFJlc291cmNlcyA9IFtVUkkuZmlsZSgnQzpcXFxcZm9vXFxcXGJhcicpXTtcblx0XHRcdFx0XHRhd2FpdCBhc3NlcnRMaW5rc1dpdGhXcmFwcGVkKCcvbW50L2MvZm9vL2JhcicsIHZhbGlkUmVzb3VyY2VzWzBdKTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGVzdCgnV2luZG93cyAtPiBVbml4IFxcXFxcXFxcd3NsJFxcXFwgc3R5bGUgbGlua3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0dmFsaWRSZXNvdXJjZXMgPSBbVVJJLmZpbGUoJ1xcXFxcXFxcd3NsJFxcXFxEZWJpYW5cXFxcaG9tZVxcXFxmb29cXFxcYmFyJyldO1xuXHRcdFx0XHRcdGF3YWl0IGFzc2VydExpbmtzV2l0aFdyYXBwZWQoJ1xcXFxcXFxcd3NsJFxcXFxEZWJpYW5cXFxcaG9tZVxcXFxmb29cXFxcYmFyJyk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRlc3QoJ1dpbmRvd3MgLT4gVW5peCBcXFxcXFxcXHdzbC5sb2NhbGhvc3RcXFxcIHN0eWxlIGxpbmtzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHZhbGlkUmVzb3VyY2VzID0gW1VSSS5maWxlKCdcXFxcXFxcXHdzbC5sb2NhbGhvc3RcXFxcRGViaWFuXFxcXGhvbWVcXFxcZm9vXFxcXGJhcicpXTtcblx0XHRcdFx0XHRhd2FpdCBhc3NlcnRMaW5rc1dpdGhXcmFwcGVkKCdcXFxcXFxcXHdzbC5sb2NhbGhvc3RcXFxcRGViaWFuXFxcXGhvbWVcXFxcZm9vXFxcXGJhcicpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsV0FBVyx1QkFBdUI7QUFDM0MsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsd0JBQXdCO0FBRWpDLFNBQVMsZUFBZTtBQUN4QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFdBQVc7QUFDcEIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUywyQkFBMkI7QUFDcEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUywrQ0FBK0M7QUFFeEQsTUFBTSxZQUEwRDtBQUFBO0FBQUEsRUFFL0Q7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBO0FBQUEsRUFFQSxFQUFFLE1BQU0sZUFBZSxVQUFVLElBQUksS0FBSyxNQUFNLEVBQUU7QUFB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
