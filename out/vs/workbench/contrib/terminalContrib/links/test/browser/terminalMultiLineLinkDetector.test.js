import { isWindows, OperatingSystem } from "../../../../../../base/common/platform.js";
import { format } from "../../../../../../base/common/strings.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../../platform/configuration/test/common/testConfigurationService.js";
import { TestInstantiationService } from "../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { TerminalBuiltinLinkType } from "../../browser/links.js";
import { assertLinkHelper } from "./linkTestUtils.js";
import { timeout } from "../../../../../../base/common/async.js";
import { strictEqual } from "assert";
import { TerminalLinkResolver } from "../../browser/terminalLinkResolver.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { createFileStat } from "../../../../../test/common/workbenchTestServices.js";
import { URI } from "../../../../../../base/common/uri.js";
import { NullLogService } from "../../../../../../platform/log/common/log.js";
import { ITerminalLogService } from "../../../../../../platform/terminal/common/terminal.js";
import { TerminalMultiLineLinkDetector } from "../../browser/terminalMultiLineLinkDetector.js";
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
  // 5: file content...                         [#181837]
  //   5:3  error                               [#181837]
  { urlFormat: "{0}\r\n{1}:foo", line: "5" },
  { urlFormat: "{0}\r\n{1}: foo", line: "5" },
  { urlFormat: "{0}\r\n5:another link\r\n{1}:{2} foo", line: "5", column: "3" },
  { urlFormat: "{0}\r\n  {1}:{2} foo", line: "5", column: "3" },
  { urlFormat: "{0}\r\n  5:6  error  another one\r\n  {1}:{2}  error", line: "5", column: "3" },
  { urlFormat: `{0}\r
  5:6  error  ${"a".repeat(80)}\r
  {1}:{2}  error`, line: "5", column: "3" },
  // @@ ... <to-file-range> @@ content...       [#182878]   (tests check the entire line, so they don't include the line content at the end of the last @@)
  { urlFormat: "+++ b/{0}\r\n@@ -7,6 +{1},7 @@", line: "5" },
  { urlFormat: "+++ b/{0}\r\n@@ -1,1 +1,1 @@\r\nfoo\r\nbar\r\n@@ -7,6 +{1},7 @@", line: "5" }
];
suite("Workbench - TerminalMultiLineLinkDetector", () => {
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
  async function assertLinksMain(link, resource) {
    const uri = resource ?? URI.file(link);
    const lines = link.split("\r\n");
    const lastLine = lines.at(-1);
    let lineCount = 0;
    for (const line of lines) {
      lineCount += Math.max(Math.ceil(line.length / 80), 1);
    }
    await assertLinks(TerminalBuiltinLinkType.LocalFile, link, [{ uri, range: [[1, lineCount], [lastLine.length, lineCount]] }]);
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
  suite("macOS/Linux", () => {
    setup(() => {
      detector = instantiationService.createInstance(TerminalMultiLineLinkDetector, xterm, {
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
          test(`should detect in "${escapeMultilineTestName(formattedLink)}"`, async () => {
            validResources = [resource];
            await assertLinksMain(formattedLink, resource);
          });
        }
      });
    }
  });
  if (isWindows) {
    suite("Windows", () => {
      setup(() => {
        detector = instantiationService.createInstance(TerminalMultiLineLinkDetector, xterm, {
          initialCwd: "C:\\Parent\\Cwd",
          os: OperatingSystem.Windows,
          remoteAuthority: void 0,
          userHome: "C:\\Home"
        }, resolver);
      });
      for (const l of windowsLinks) {
        const baseLink = typeof l === "string" ? l : l.link;
        const resource = typeof l === "string" ? URI.file(l) : l.resource;
        suite(`Link "${baseLink}"`, () => {
          for (let i = 0; i < supportedLinkFormats.length; i++) {
            const linkFormat = supportedLinkFormats[i];
            const formattedLink = format(linkFormat.urlFormat, baseLink, linkFormat.line, linkFormat.column);
            test(`should detect in "${escapeMultilineTestName(formattedLink)}"`, async () => {
              validResources = [resource];
              await assertLinksMain(formattedLink, resource);
            });
          }
        });
      }
    });
  }
});
function escapeMultilineTestName(text) {
  return text.replaceAll("\r\n", "\\r\\n");
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvbGlua3MvdGVzdC9icm93c2VyL3Rlcm1pbmFsTXVsdGlMaW5lTGlua0RldGVjdG9yLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBpc1dpbmRvd3MsIE9wZXJhdGluZ1N5c3RlbSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGZvcm1hdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvbGlua3MuanMnO1xuaW1wb3J0IHsgYXNzZXJ0TGlua0hlbHBlciB9IGZyb20gJy4vbGlua1Rlc3RVdGlscy5qcyc7XG5pbXBvcnQgdHlwZSB7IFRlcm1pbmFsIH0gZnJvbSAnQHh0ZXJtL3h0ZXJtJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBzdHJpY3RFcXVhbCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBUZXJtaW5hbExpbmtSZXNvbHZlciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdGVybWluYWxMaW5rUmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IGNyZWF0ZUZpbGVTdGF0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxNdWx0aUxpbmVMaW5rRGV0ZWN0b3IgfSBmcm9tICcuLi8uLi9icm93c2VyL3Rlcm1pbmFsTXVsdGlMaW5lTGlua0RldGVjdG9yLmpzJztcbmltcG9ydCB7IGltcG9ydEFNRE5vZGVNb2R1bGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9hbWRYLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5jb25zdCB1bml4TGlua3M6IChzdHJpbmcgfCB7IGxpbms6IHN0cmluZzsgcmVzb3VyY2U6IFVSSSB9KVtdID0gW1xuXHQvLyBBYnNvbHV0ZVxuXHQnL2ZvbycsXG5cdCcvZm9vL2JhcicsXG5cdCcvZm9vL1tiYXJdJyxcblx0Jy9mb28vW2Jhcl0uYmF6Jyxcblx0Jy9mb28vW2Jhcl0vYmF6Jyxcblx0Jy9mb28vYmFyK21vcmUnLFxuXHQvLyBVc2VyIGhvbWVcblx0eyBsaW5rOiAnfi9mb28nLCByZXNvdXJjZTogVVJJLmZpbGUoJy9ob21lL2ZvbycpIH0sXG5cdC8vIFJlbGF0aXZlXG5cdHsgbGluazogJy4vZm9vJywgcmVzb3VyY2U6IFVSSS5maWxlKCcvcGFyZW50L2N3ZC9mb28nKSB9LFxuXHR7IGxpbms6ICcuLyRmb28nLCByZXNvdXJjZTogVVJJLmZpbGUoJy9wYXJlbnQvY3dkLyRmb28nKSB9LFxuXHR7IGxpbms6ICcuLi9mb28nLCByZXNvdXJjZTogVVJJLmZpbGUoJy9wYXJlbnQvZm9vJykgfSxcblx0eyBsaW5rOiAnZm9vL2JhcicsIHJlc291cmNlOiBVUkkuZmlsZSgnL3BhcmVudC9jd2QvZm9vL2JhcicpIH0sXG5cdHsgbGluazogJ2Zvby9iYXIrbW9yZScsIHJlc291cmNlOiBVUkkuZmlsZSgnL3BhcmVudC9jd2QvZm9vL2Jhcittb3JlJykgfSxcbl07XG5cbmNvbnN0IHdpbmRvd3NMaW5rczogKHN0cmluZyB8IHsgbGluazogc3RyaW5nOyByZXNvdXJjZTogVVJJIH0pW10gPSBbXG5cdC8vIEFic29sdXRlXG5cdCdjOlxcXFxmb28nLFxuXHR7IGxpbms6ICdcXFxcXFxcXD9cXFxcQzpcXFxcZm9vJywgcmVzb3VyY2U6IFVSSS5maWxlKCdDOlxcXFxmb28nKSB9LFxuXHQnYzovZm9vJyxcblx0J2M6L2Zvby9iYXInLFxuXHQnYzpcXFxcZm9vXFxcXGJhcicsXG5cdCdjOlxcXFxmb29cXFxcYmFyK21vcmUnLFxuXHQnYzpcXFxcZm9vL2JhclxcXFxiYXonLFxuXHQvLyBVc2VyIGhvbWVcblx0eyBsaW5rOiAnflxcXFxmb28nLCByZXNvdXJjZTogVVJJLmZpbGUoJ0M6XFxcXEhvbWVcXFxcZm9vJykgfSxcblx0eyBsaW5rOiAnfi9mb28nLCByZXNvdXJjZTogVVJJLmZpbGUoJ0M6XFxcXEhvbWVcXFxcZm9vJykgfSxcblx0Ly8gUmVsYXRpdmVcblx0eyBsaW5rOiAnLlxcXFxmb28nLCByZXNvdXJjZTogVVJJLmZpbGUoJ0M6XFxcXFBhcmVudFxcXFxDd2RcXFxcZm9vJykgfSxcblx0eyBsaW5rOiAnLi9mb28nLCByZXNvdXJjZTogVVJJLmZpbGUoJ0M6XFxcXFBhcmVudFxcXFxDd2RcXFxcZm9vJykgfSxcblx0eyBsaW5rOiAnLi8kZm9vJywgcmVzb3VyY2U6IFVSSS5maWxlKCdDOlxcXFxQYXJlbnRcXFxcQ3dkXFxcXCRmb28nKSB9LFxuXHR7IGxpbms6ICcuLlxcXFxmb28nLCByZXNvdXJjZTogVVJJLmZpbGUoJ0M6XFxcXFBhcmVudFxcXFxmb28nKSB9LFxuXHR7IGxpbms6ICdmb28vYmFyJywgcmVzb3VyY2U6IFVSSS5maWxlKCdDOlxcXFxQYXJlbnRcXFxcQ3dkXFxcXGZvb1xcXFxiYXInKSB9LFxuXHR7IGxpbms6ICdmb28vYmFyJywgcmVzb3VyY2U6IFVSSS5maWxlKCdDOlxcXFxQYXJlbnRcXFxcQ3dkXFxcXGZvb1xcXFxiYXInKSB9LFxuXHR7IGxpbms6ICdmb28vW2Jhcl0nLCByZXNvdXJjZTogVVJJLmZpbGUoJ0M6XFxcXFBhcmVudFxcXFxDd2RcXFxcZm9vXFxcXFtiYXJdJykgfSxcblx0eyBsaW5rOiAnZm9vL1tiYXJdLmJheicsIHJlc291cmNlOiBVUkkuZmlsZSgnQzpcXFxcUGFyZW50XFxcXEN3ZFxcXFxmb29cXFxcW2Jhcl0uYmF6JykgfSxcblx0eyBsaW5rOiAnZm9vL1tiYXJdL2JheicsIHJlc291cmNlOiBVUkkuZmlsZSgnQzpcXFxcUGFyZW50XFxcXEN3ZFxcXFxmb29cXFxcW2Jhcl0vYmF6JykgfSxcblx0eyBsaW5rOiAnZm9vXFxcXGJhcicsIHJlc291cmNlOiBVUkkuZmlsZSgnQzpcXFxcUGFyZW50XFxcXEN3ZFxcXFxmb29cXFxcYmFyJykgfSxcblx0eyBsaW5rOiAnZm9vXFxcXFtiYXJdLmJheicsIHJlc291cmNlOiBVUkkuZmlsZSgnQzpcXFxcUGFyZW50XFxcXEN3ZFxcXFxmb29cXFxcW2Jhcl0uYmF6JykgfSxcblx0eyBsaW5rOiAnZm9vXFxcXFtiYXJdXFxcXGJheicsIHJlc291cmNlOiBVUkkuZmlsZSgnQzpcXFxcUGFyZW50XFxcXEN3ZFxcXFxmb29cXFxcW2Jhcl1cXFxcYmF6JykgfSxcblx0eyBsaW5rOiAnZm9vXFxcXGJhcittb3JlJywgcmVzb3VyY2U6IFVSSS5maWxlKCdDOlxcXFxQYXJlbnRcXFxcQ3dkXFxcXGZvb1xcXFxiYXIrbW9yZScpIH0sXG5dO1xuXG5pbnRlcmZhY2UgTGlua0Zvcm1hdEluZm8ge1xuXHR1cmxGb3JtYXQ6IHN0cmluZztcblx0LyoqXG5cdCAqIFRoZSBzdGFydCBvZmZzZXQgdG8gdGhlIGJ1ZmZlciByYW5nZSB0aGF0IGlzIG5vdCBpbiB0aGUgYWN0dWFsIGxpbmsgKGJ1dCBpcyBpbiB0aGUgbWF0Y2hlZFxuXHQgKiBhcmVhLlxuXHQgKi9cblx0bGlua0NlbGxTdGFydE9mZnNldD86IG51bWJlcjtcblx0LyoqXG5cdCAqIFRoZSBlbmQgb2Zmc2V0IHRvIHRoZSBidWZmZXIgcmFuZ2UgdGhhdCBpcyBub3QgaW4gdGhlIGFjdHVhbCBsaW5rIChidXQgaXMgaW4gdGhlIG1hdGNoZWRcblx0ICogYXJlYS5cblx0ICovXG5cdGxpbmtDZWxsRW5kT2Zmc2V0PzogbnVtYmVyO1xuXHRsaW5lPzogc3RyaW5nO1xuXHRjb2x1bW4/OiBzdHJpbmc7XG59XG5cbmNvbnN0IHN1cHBvcnRlZExpbmtGb3JtYXRzOiBMaW5rRm9ybWF0SW5mb1tdID0gW1xuXHQvLyA1OiBmaWxlIGNvbnRlbnQuLi4gICAgICAgICAgICAgICAgICAgICAgICAgWyMxODE4MzddXG5cdC8vICAgNTozICBlcnJvciAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbIzE4MTgzN11cblx0eyB1cmxGb3JtYXQ6ICd7MH1cXHJcXG57MX06Zm9vJywgbGluZTogJzUnIH0sXG5cdHsgdXJsRm9ybWF0OiAnezB9XFxyXFxuezF9OiBmb28nLCBsaW5lOiAnNScgfSxcblx0eyB1cmxGb3JtYXQ6ICd7MH1cXHJcXG41OmFub3RoZXIgbGlua1xcclxcbnsxfTp7Mn0gZm9vJywgbGluZTogJzUnLCBjb2x1bW46ICczJyB9LFxuXHR7IHVybEZvcm1hdDogJ3swfVxcclxcbiAgezF9OnsyfSBmb28nLCBsaW5lOiAnNScsIGNvbHVtbjogJzMnIH0sXG5cdHsgdXJsRm9ybWF0OiAnezB9XFxyXFxuICA1OjYgIGVycm9yICBhbm90aGVyIG9uZVxcclxcbiAgezF9OnsyfSAgZXJyb3InLCBsaW5lOiAnNScsIGNvbHVtbjogJzMnIH0sXG5cdHsgdXJsRm9ybWF0OiBgezB9XFxyXFxuICA1OjYgIGVycm9yICAkeydhJy5yZXBlYXQoODApfVxcclxcbiAgezF9OnsyfSAgZXJyb3JgLCBsaW5lOiAnNScsIGNvbHVtbjogJzMnIH0sXG5cblx0Ly8gQEAgLi4uIDx0by1maWxlLXJhbmdlPiBAQCBjb250ZW50Li4uICAgICAgIFsjMTgyODc4XSAgICh0ZXN0cyBjaGVjayB0aGUgZW50aXJlIGxpbmUsIHNvIHRoZXkgZG9uJ3QgaW5jbHVkZSB0aGUgbGluZSBjb250ZW50IGF0IHRoZSBlbmQgb2YgdGhlIGxhc3QgQEApXG5cdHsgdXJsRm9ybWF0OiAnKysrIGIvezB9XFxyXFxuQEAgLTcsNiArezF9LDcgQEAnLCBsaW5lOiAnNScgfSxcblx0eyB1cmxGb3JtYXQ6ICcrKysgYi97MH1cXHJcXG5AQCAtMSwxICsxLDEgQEBcXHJcXG5mb29cXHJcXG5iYXJcXHJcXG5AQCAtNyw2ICt7MX0sNyBAQCcsIGxpbmU6ICc1JyB9LFxuXTtcblxuc3VpdGUoJ1dvcmtiZW5jaCAtIFRlcm1pbmFsTXVsdGlMaW5lTGlua0RldGVjdG9yJywgKCkgPT4ge1xuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRsZXQgY29uZmlndXJhdGlvblNlcnZpY2U6IFRlc3RDb25maWd1cmF0aW9uU2VydmljZTtcblx0bGV0IGRldGVjdG9yOiBUZXJtaW5hbE11bHRpTGluZUxpbmtEZXRlY3Rvcjtcblx0bGV0IHJlc29sdmVyOiBUZXJtaW5hbExpbmtSZXNvbHZlcjtcblx0bGV0IHh0ZXJtOiBUZXJtaW5hbDtcblx0bGV0IHZhbGlkUmVzb3VyY2VzOiBVUklbXTtcblxuXHRhc3luYyBmdW5jdGlvbiBhc3NlcnRMaW5rcyhcblx0XHR0eXBlOiBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZSxcblx0XHR0ZXh0OiBzdHJpbmcsXG5cdFx0ZXhwZWN0ZWQ6ICh7IHVyaTogVVJJOyByYW5nZTogW251bWJlciwgbnVtYmVyXVtdIH0pW11cblx0KSB7XG5cdFx0bGV0IHRvO1xuXHRcdGNvbnN0IHJhY2UgPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0YXNzZXJ0TGlua0hlbHBlcih0ZXh0LCBleHBlY3RlZCwgZGV0ZWN0b3IsIHR5cGUpLnRoZW4oKCkgPT4gJ3N1Y2Nlc3MnKSxcblx0XHRcdCh0byA9IHRpbWVvdXQoMikpLnRoZW4oKCkgPT4gJ3RpbWVvdXQnKVxuXHRcdF0pO1xuXHRcdHN0cmljdEVxdWFsKHJhY2UsICdzdWNjZXNzJywgYEF3YWl0aW5nIGxpbmsgYXNzZXJ0aW9uIGZvciBcIiR7dGV4dH1cIiB0aW1lZCBvdXRgKTtcblx0XHR0by5jYW5jZWwoKTtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIGFzc2VydExpbmtzTWFpbihsaW5rOiBzdHJpbmcsIHJlc291cmNlPzogVVJJKSB7XG5cdFx0Y29uc3QgdXJpID0gcmVzb3VyY2UgPz8gVVJJLmZpbGUobGluayk7XG5cdFx0Y29uc3QgbGluZXMgPSBsaW5rLnNwbGl0KCdcXHJcXG4nKTtcblx0XHRjb25zdCBsYXN0TGluZSA9IGxpbmVzLmF0KC0xKSE7XG5cdFx0Ly8gQ291bnQgbGluZXMsIGFjY291bnRpbmcgZm9yIHdyYXBwaW5nXG5cdFx0bGV0IGxpbmVDb3VudCA9IDA7XG5cdFx0Zm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG5cdFx0XHRsaW5lQ291bnQgKz0gTWF0aC5tYXgoTWF0aC5jZWlsKGxpbmUubGVuZ3RoIC8gODApLCAxKTtcblx0XHR9XG5cdFx0YXdhaXQgYXNzZXJ0TGlua3MoVGVybWluYWxCdWlsdGluTGlua1R5cGUuTG9jYWxGaWxlLCBsaW5rLCBbeyB1cmksIHJhbmdlOiBbWzEsIGxpbmVDb3VudF0sIFtsYXN0TGluZS5sZW5ndGgsIGxpbmVDb3VudF1dIH1dKTtcblx0fVxuXG5cdHNldHVwKGFzeW5jICgpID0+IHtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0b3JlLmFkZChuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCkpO1xuXHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRmlsZVNlcnZpY2UsIHtcblx0XHRcdGFzeW5jIHN0YXQocmVzb3VyY2UpIHtcblx0XHRcdFx0aWYgKCF2YWxpZFJlc291cmNlcy5tYXAoZSA9PiBlLnBhdGgpLmluY2x1ZGVzKHJlc291cmNlLnBhdGgpKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdEb2VzblxcJ3QgZXhpc3QnKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gY3JlYXRlRmlsZVN0YXQocmVzb3VyY2UpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRlcm1pbmFsTG9nU2VydmljZSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdHJlc29sdmVyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMaW5rUmVzb2x2ZXIpO1xuXHRcdHZhbGlkUmVzb3VyY2VzID0gW107XG5cblx0XHRjb25zdCBUZXJtaW5hbEN0b3IgPSAoYXdhaXQgaW1wb3J0QU1ETm9kZU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAeHRlcm0veHRlcm0nKT4oJ0B4dGVybS94dGVybScsICdsaWIveHRlcm0uanMnKSkuVGVybWluYWw7XG5cdFx0eHRlcm0gPSBuZXcgVGVybWluYWxDdG9yKHsgYWxsb3dQcm9wb3NlZEFwaTogdHJ1ZSwgY29sczogODAsIHJvd3M6IDMwIH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnbWFjT1MvTGludXgnLCAoKSA9PiB7XG5cdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0ZGV0ZWN0b3IgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbE11bHRpTGluZUxpbmtEZXRlY3RvciwgeHRlcm0sIHtcblx0XHRcdFx0aW5pdGlhbEN3ZDogJy9wYXJlbnQvY3dkJyxcblx0XHRcdFx0b3M6IE9wZXJhdGluZ1N5c3RlbS5MaW51eCxcblx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5OiB1bmRlZmluZWQsXG5cdFx0XHRcdHVzZXJIb21lOiAnL2hvbWUnLFxuXHRcdFx0XHRiYWNrZW5kOiB1bmRlZmluZWRcblx0XHRcdH0sIHJlc29sdmVyKTtcblx0XHR9KTtcblxuXHRcdGZvciAoY29uc3QgbCBvZiB1bml4TGlua3MpIHtcblx0XHRcdGNvbnN0IGJhc2VMaW5rID0gdHlwZW9mIGwgPT09ICdzdHJpbmcnID8gbCA6IGwubGluaztcblx0XHRcdGNvbnN0IHJlc291cmNlID0gdHlwZW9mIGwgPT09ICdzdHJpbmcnID8gVVJJLmZpbGUobCkgOiBsLnJlc291cmNlO1xuXHRcdFx0c3VpdGUoYExpbms6ICR7YmFzZUxpbmt9YCwgKCkgPT4ge1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHN1cHBvcnRlZExpbmtGb3JtYXRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0Y29uc3QgbGlua0Zvcm1hdCA9IHN1cHBvcnRlZExpbmtGb3JtYXRzW2ldO1xuXHRcdFx0XHRcdGNvbnN0IGZvcm1hdHRlZExpbmsgPSBmb3JtYXQobGlua0Zvcm1hdC51cmxGb3JtYXQsIGJhc2VMaW5rLCBsaW5rRm9ybWF0LmxpbmUsIGxpbmtGb3JtYXQuY29sdW1uKTtcblx0XHRcdFx0XHR0ZXN0KGBzaG91bGQgZGV0ZWN0IGluIFwiJHtlc2NhcGVNdWx0aWxpbmVUZXN0TmFtZShmb3JtYXR0ZWRMaW5rKX1cImAsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdHZhbGlkUmVzb3VyY2VzID0gW3Jlc291cmNlXTtcblx0XHRcdFx0XHRcdGF3YWl0IGFzc2VydExpbmtzTWFpbihmb3JtYXR0ZWRMaW5rLCByZXNvdXJjZSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fSk7XG5cblx0Ly8gT25seSB0ZXN0IHRoZXNlIHdoZW4gb24gV2luZG93cyBiZWNhdXNlIHRoZXJlIGlzIHNwZWNpYWwgYmVoYXZpb3IgYXJvdW5kIHJlcGxhY2luZyBzZXBhcmF0b3JzXG5cdC8vIGluIFVSSSB0aGF0IGNhbm5vdCBiZSBjaGFuZ2VkXG5cdGlmIChpc1dpbmRvd3MpIHtcblx0XHRzdWl0ZSgnV2luZG93cycsICgpID0+IHtcblx0XHRcdHNldHVwKCgpID0+IHtcblx0XHRcdFx0ZGV0ZWN0b3IgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbE11bHRpTGluZUxpbmtEZXRlY3RvciwgeHRlcm0sIHtcblx0XHRcdFx0XHRpbml0aWFsQ3dkOiAnQzpcXFxcUGFyZW50XFxcXEN3ZCcsXG5cdFx0XHRcdFx0b3M6IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzLFxuXHRcdFx0XHRcdHJlbW90ZUF1dGhvcml0eTogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHVzZXJIb21lOiAnQzpcXFxcSG9tZScsXG5cdFx0XHRcdH0sIHJlc29sdmVyKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGwgb2Ygd2luZG93c0xpbmtzKSB7XG5cdFx0XHRcdGNvbnN0IGJhc2VMaW5rID0gdHlwZW9mIGwgPT09ICdzdHJpbmcnID8gbCA6IGwubGluaztcblx0XHRcdFx0Y29uc3QgcmVzb3VyY2UgPSB0eXBlb2YgbCA9PT0gJ3N0cmluZycgPyBVUkkuZmlsZShsKSA6IGwucmVzb3VyY2U7XG5cdFx0XHRcdHN1aXRlKGBMaW5rIFwiJHtiYXNlTGlua31cImAsICgpID0+IHtcblx0XHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHN1cHBvcnRlZExpbmtGb3JtYXRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBsaW5rRm9ybWF0ID0gc3VwcG9ydGVkTGlua0Zvcm1hdHNbaV07XG5cdFx0XHRcdFx0XHRjb25zdCBmb3JtYXR0ZWRMaW5rID0gZm9ybWF0KGxpbmtGb3JtYXQudXJsRm9ybWF0LCBiYXNlTGluaywgbGlua0Zvcm1hdC5saW5lLCBsaW5rRm9ybWF0LmNvbHVtbik7XG5cdFx0XHRcdFx0XHR0ZXN0KGBzaG91bGQgZGV0ZWN0IGluIFwiJHtlc2NhcGVNdWx0aWxpbmVUZXN0TmFtZShmb3JtYXR0ZWRMaW5rKX1cImAsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdFx0dmFsaWRSZXNvdXJjZXMgPSBbcmVzb3VyY2VdO1xuXHRcdFx0XHRcdFx0XHRhd2FpdCBhc3NlcnRMaW5rc01haW4oZm9ybWF0dGVkTGluaywgcmVzb3VyY2UpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufSk7XG5cbmZ1bmN0aW9uIGVzY2FwZU11bHRpbGluZVRlc3ROYW1lKHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiB0ZXh0LnJlcGxhY2VBbGwoJ1xcclxcbicsICdcXFxcclxcXFxuJyk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLFdBQVcsdUJBQXVCO0FBQzNDLFNBQVMsY0FBYztBQUN2QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsK0NBQStDO0FBRXhELE1BQU0sWUFBMEQ7QUFBQTtBQUFBLEVBRS9EO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQTtBQUFBLEVBRUEsRUFBRSxNQUFNLFNBQVMsVUFBVSxJQUFJLEtBQUssV0FBVyxFQUFFO0FBQUE7QUFBQSxFQUVqRCxFQUFFLE1BQU0sU0FBUyxVQUFVLElBQUksS0FBSyxpQkFBaUIsRUFBRTtBQUFBLEVBQ3ZELEVBQUUsTUFBTSxVQUFVLFVBQVUsSUFBSSxLQUFLLGtCQUFrQixFQUFFO0FBQUEs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
