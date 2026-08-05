import assert from "assert";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { isURLDomainTrusted } from "../../common/trustedDomains.js";
function linkAllowedByRules(link, rules) {
  assert.ok(isURLDomainTrusted(URI.parse(link), rules), `Link
${link}
 should be allowed by rules
${JSON.stringify(rules)}`);
}
function linkNotAllowedByRules(link, rules) {
  assert.ok(!isURLDomainTrusted(URI.parse(link), rules), `Link
${link}
 should NOT be allowed by rules
${JSON.stringify(rules)}`);
}
suite("Link protection domain matching", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("simple", () => {
    linkNotAllowedByRules("https://x.org", []);
    linkAllowedByRules("https://x.org", ["https://x.org"]);
    linkAllowedByRules("https://x.org/foo", ["https://x.org"]);
    linkNotAllowedByRules("https://x.org", ["http://x.org"]);
    linkNotAllowedByRules("http://x.org", ["https://x.org"]);
    linkNotAllowedByRules("https://www.x.org", ["https://x.org"]);
    linkAllowedByRules("https://www.x.org", ["https://www.x.org", "https://y.org"]);
  });
  test("localhost", () => {
    linkAllowedByRules("https://127.0.0.1", []);
    linkAllowedByRules("https://127.0.0.1:3000", []);
    linkAllowedByRules("https://localhost", []);
    linkAllowedByRules("https://localhost:3000", []);
  });
  test("* star", () => {
    linkAllowedByRules("https://a.x.org", ["https://*.x.org"]);
    linkAllowedByRules("https://a.b.x.org", ["https://*.x.org"]);
  });
  test("no scheme", () => {
    linkAllowedByRules("https://a.x.org", ["a.x.org"]);
    linkAllowedByRules("https://a.x.org", ["*.x.org"]);
    linkAllowedByRules("https://a.b.x.org", ["*.x.org"]);
    linkAllowedByRules("https://x.org", ["*.x.org"]);
  });
  test("sub paths", () => {
    linkAllowedByRules("https://x.org/foo", ["https://x.org/foo"]);
    linkAllowedByRules("https://x.org/foo/bar", ["https://x.org/foo"]);
    linkAllowedByRules("https://x.org/foo", ["https://x.org/foo/"]);
    linkAllowedByRules("https://x.org/foo/bar", ["https://x.org/foo/"]);
    linkAllowedByRules("https://x.org/foo", ["x.org/foo"]);
    linkAllowedByRules("https://x.org/foo", ["*.org/foo"]);
    linkNotAllowedByRules("https://x.org/bar", ["https://x.org/foo"]);
    linkNotAllowedByRules("https://x.org/bar", ["x.org/foo"]);
    linkNotAllowedByRules("https://x.org/bar", ["*.org/foo"]);
    linkAllowedByRules("https://x.org/foo/bar", ["https://x.org/foo"]);
    linkNotAllowedByRules("https://x.org/foo2", ["https://x.org/foo"]);
    linkNotAllowedByRules("https://www.x.org/foo", ["https://x.org/foo"]);
    linkNotAllowedByRules("https://a.x.org/bar", ["https://*.x.org/foo"]);
    linkNotAllowedByRules("https://a.b.x.org/bar", ["https://*.x.org/foo"]);
    linkAllowedByRules("https://github.com", ["https://github.com/foo/bar", "https://github.com"]);
  });
  test("ports", () => {
    linkNotAllowedByRules("https://x.org:8080/foo/bar", ["https://x.org:8081/foo"]);
    linkAllowedByRules("https://x.org:8080/foo/bar", ["https://x.org:*/foo"]);
    linkAllowedByRules("https://x.org/foo/bar", ["https://x.org:*/foo"]);
    linkAllowedByRules("https://x.org:8080/foo/bar", ["https://x.org:8080/foo"]);
  });
  test("ip addresses", () => {
    linkAllowedByRules("http://192.168.1.7/", ["http://192.168.1.7/"]);
    linkAllowedByRules("http://192.168.1.7/", ["http://192.168.1.7"]);
    linkAllowedByRules("http://192.168.1.7/", ["http://192.168.1.*"]);
    linkNotAllowedByRules("http://192.168.1.7:3000/", ["http://192.168.*.6:*"]);
    linkAllowedByRules("http://192.168.1.7:3000/", ["http://192.168.1.7:3000/"]);
    linkAllowedByRules("http://192.168.1.7:3000/", ["http://192.168.1.7:*"]);
    linkAllowedByRules("http://192.168.1.7:3000/", ["http://192.168.1.*:*"]);
    linkNotAllowedByRules("http://192.168.1.7:3000/", ["http://192.168.*.6:*"]);
  });
  test("scheme match", () => {
    linkAllowedByRules("http://192.168.1.7/", ["http://*"]);
    linkAllowedByRules("http://twitter.com", ["http://*"]);
    linkAllowedByRules("http://twitter.com/hello", ["http://*"]);
    linkNotAllowedByRules("https://192.168.1.7/", ["http://*"]);
    linkNotAllowedByRules("https://twitter.com/", ["http://*"]);
  });
  test("case normalization", () => {
    linkAllowedByRules("https://github.com/microsoft/vscode/issues/new", ["https://github.com/microsoft"]);
    linkAllowedByRules("https://github.com/microsoft/vscode/issues/new", ["https://github.com/microsoft"]);
  });
  test("ignore query & fragment - https://github.com/microsoft/vscode/issues/156839", () => {
    linkAllowedByRules("https://github.com/login/oauth/authorize?foo=4", ["https://github.com/login/oauth/authorize"]);
    linkAllowedByRules("https://github.com/login/oauth/authorize#foo", ["https://github.com/login/oauth/authorize"]);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi91cmwvdGVzdC9icm93c2VyL3RydXN0ZWREb21haW5zLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5cbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IGlzVVJMRG9tYWluVHJ1c3RlZCB9IGZyb20gJy4uLy4uL2NvbW1vbi90cnVzdGVkRG9tYWlucy5qcyc7XG5cbmZ1bmN0aW9uIGxpbmtBbGxvd2VkQnlSdWxlcyhsaW5rOiBzdHJpbmcsIHJ1bGVzOiBzdHJpbmdbXSkge1xuXHRhc3NlcnQub2soaXNVUkxEb21haW5UcnVzdGVkKFVSSS5wYXJzZShsaW5rKSwgcnVsZXMpLCBgTGlua1xcbiR7bGlua31cXG4gc2hvdWxkIGJlIGFsbG93ZWQgYnkgcnVsZXNcXG4ke0pTT04uc3RyaW5naWZ5KHJ1bGVzKX1gKTtcbn1cbmZ1bmN0aW9uIGxpbmtOb3RBbGxvd2VkQnlSdWxlcyhsaW5rOiBzdHJpbmcsIHJ1bGVzOiBzdHJpbmdbXSkge1xuXHRhc3NlcnQub2soIWlzVVJMRG9tYWluVHJ1c3RlZChVUkkucGFyc2UobGluayksIHJ1bGVzKSwgYExpbmtcXG4ke2xpbmt9XFxuIHNob3VsZCBOT1QgYmUgYWxsb3dlZCBieSBydWxlc1xcbiR7SlNPTi5zdHJpbmdpZnkocnVsZXMpfWApO1xufVxuXG5zdWl0ZSgnTGluayBwcm90ZWN0aW9uIGRvbWFpbiBtYXRjaGluZycsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cdHRlc3QoJ3NpbXBsZScsICgpID0+IHtcblx0XHRsaW5rTm90QWxsb3dlZEJ5UnVsZXMoJ2h0dHBzOi8veC5vcmcnLCBbXSk7XG5cblx0XHRsaW5rQWxsb3dlZEJ5UnVsZXMoJ2h0dHBzOi8veC5vcmcnLCBbJ2h0dHBzOi8veC5vcmcnXSk7XG5cdFx0bGlua0FsbG93ZWRCeVJ1bGVzKCdodHRwczovL3gub3JnL2ZvbycsIFsnaHR0cHM6Ly94Lm9yZyddKTtcblxuXHRcdGxpbmtOb3RBbGxvd2VkQnlSdWxlcygnaHR0cHM6Ly94Lm9yZycsIFsnaHR0cDovL3gub3JnJ10pO1xuXHRcdGxpbmtOb3RBbGxvd2VkQnlSdWxlcygnaHR0cDovL3gub3JnJywgWydodHRwczovL3gub3JnJ10pO1xuXG5cdFx0bGlua05vdEFsbG93ZWRCeVJ1bGVzKCdodHRwczovL3d3dy54Lm9yZycsIFsnaHR0cHM6Ly94Lm9yZyddKTtcblxuXHRcdGxpbmtBbGxvd2VkQnlSdWxlcygnaHR0cHM6Ly93d3cueC5vcmcnLCBbJ2h0dHBzOi8vd3d3Lngub3JnJywgJ2h0dHBzOi8veS5vcmcnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xvY2FsaG9zdCcsICgpID0+IHtcblx0XHRsaW5rQWxsb3dlZEJ5UnVsZXMoJ2h0dHBzOi8vMTI3LjAuMC4xJywgW10pO1xuXHRcdGxpbmtBbGxvd2VkQnlSdWxlcygnaHR0cHM6Ly8xMjcuMC4wLjE6MzAwMCcsIFtdKTtcblx0XHRsaW5rQWxsb3dlZEJ5UnVsZXMoJ2h0dHBzOi8vbG9jYWxob3N0JywgW10pO1xuXHRcdGxpbmtBbGxvd2VkQnlSdWxlcygnaHR0cHM6Ly9sb2NhbGhvc3Q6MzAwMCcsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnKiBzdGFyJywgKCkgPT4ge1xuXHRcdGxpbmtBbGxvd2VkQnlSdWxlcygnaHR0cHM6Ly9hLngub3JnJywgWydodHRwczovLyoueC5vcmcnXSk7XG5cdFx0bGlua0FsbG93ZWRCeVJ1bGVzKCdodHRwczovL2EuYi54Lm9yZycsIFsnaHR0cHM6Ly8qLngub3JnJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdubyBzY2hlbWUnLCAoKSA9PiB7XG5cdFx0bGlua0FsbG93ZWRCeVJ1bGVzKCdodHRwczovL2EueC5vcmcnLCBbJ2EueC5vcmcnXSk7XG5cdFx0bGlua0FsbG93ZWRCeVJ1bGVzKCdodHRwczovL2EueC5vcmcnLCBbJyoueC5vcmcnXSk7XG5cdFx0bGlua0FsbG93ZWRCeVJ1bGVzKCdodHRwczovL2EuYi54Lm9yZycsIFsnKi54Lm9yZyddKTtcblx0XHRsaW5rQWxsb3dlZEJ5UnVsZXMoJ2h0dHBzOi8veC5vcmcnLCBbJyoueC5vcmcnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N1YiBwYXRocycsICgpID0+IHtcblx0XHRsaW5rQWxsb3dlZEJ5UnVsZXMoJ2h0dHBzOi8veC5vcmcvZm9vJywgWydodHRwczovL3gub3JnL2ZvbyddKTtcblx0XHRsaW5rQWxsb3dlZEJ5UnVsZXMoJ2h0dHBzOi8veC5vcmcvZm9vL2JhcicsIFsnaHR0cHM6Ly94Lm9yZy9mb28nXSk7XG5cblx0XHRsaW5rQWxsb3dlZEJ5UnVsZXMoJ2h0dHBzOi8veC5vcmcvZm9vJywgWydodHRwczovL3gub3JnL2Zvby8nXSk7XG5cdFx0bGlua0FsbG93ZWRCeVJ1bGVzKCdodHRwczovL3gub3JnL2Zvby9iYXInLCBbJ2h0dHBzOi8veC5vcmcvZm9vLyddKTtcblxuXHRcdGxpbmtBbGxvd2VkQnlSdWxlcygnaHR0cHM6Ly94Lm9yZy9mb28nLCBbJ3gub3JnL2ZvbyddKTtcblx0XHRsaW5rQWxsb3dlZEJ5UnVsZXMoJ2h0dHBzOi8veC5vcmcvZm9vJywgWycqLm9yZy9mb28nXSk7XG5cblx0XHRsaW5rTm90QWxsb3dlZEJ5UnVsZXMoJ2h0dHBzOi8veC5vcmcvYmFyJywgWydodHRwczovL3gub3JnL2ZvbyddKTtcblx0XHRsaW5rTm90QWxsb3dlZEJ5UnVsZXMoJ2h0dHBzOi8veC5vcmcvYmFyJywgWyd4Lm9yZy9mb28nXSk7XG5cdFx0bGlua05vdEFsbG93ZWRCeVJ1bGVzKCdodHRwczovL3gub3JnL2JhcicsIFsnKi5vcmcvZm9vJ10pO1xuXG5cdFx0bGlua0FsbG93ZWRCeVJ1bGVzKCdodHRwczovL3gub3JnL2Zvby9iYXInLCBbJ2h0dHBzOi8veC5vcmcvZm9vJ10pO1xuXHRcdGxpbmtOb3RBbGxvd2VkQnlSdWxlcygnaHR0cHM6Ly94Lm9yZy9mb28yJywgWydodHRwczovL3gub3JnL2ZvbyddKTtcblxuXHRcdGxpbmtOb3RBbGxvd2VkQnlSdWxlcygnaHR0cHM6Ly93d3cueC5vcmcvZm9vJywgWydodHRwczovL3gub3JnL2ZvbyddKTtcblxuXHRcdGxpbmtOb3RBbGxvd2VkQnlSdWxlcygnaHR0cHM6Ly9hLngub3JnL2JhcicsIFsnaHR0cHM6Ly8qLngub3JnL2ZvbyddKTtcblx0XHRsaW5rTm90QWxsb3dlZEJ5UnVsZXMoJ2h0dHBzOi8vYS5iLngub3JnL2JhcicsIFsnaHR0cHM6Ly8qLngub3JnL2ZvbyddKTtcblxuXHRcdGxpbmtBbGxvd2VkQnlSdWxlcygnaHR0cHM6Ly9naXRodWIuY29tJywgWydodHRwczovL2dpdGh1Yi5jb20vZm9vL2JhcicsICdodHRwczovL2dpdGh1Yi5jb20nXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BvcnRzJywgKCkgPT4ge1xuXHRcdGxpbmtOb3RBbGxvd2VkQnlSdWxlcygnaHR0cHM6Ly94Lm9yZzo4MDgwL2Zvby9iYXInLCBbJ2h0dHBzOi8veC5vcmc6ODA4MS9mb28nXSk7XG5cdFx0bGlua0FsbG93ZWRCeVJ1bGVzKCdodHRwczovL3gub3JnOjgwODAvZm9vL2JhcicsIFsnaHR0cHM6Ly94Lm9yZzoqL2ZvbyddKTtcblx0XHRsaW5rQWxsb3dlZEJ5UnVsZXMoJ2h0dHBzOi8veC5vcmcvZm9vL2JhcicsIFsnaHR0cHM6Ly94Lm9yZzoqL2ZvbyddKTtcblx0XHRsaW5rQWxsb3dlZEJ5UnVsZXMoJ2h0dHBzOi8veC5vcmc6ODA4MC9mb28vYmFyJywgWydodHRwczovL3gub3JnOjgwODAvZm9vJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdpcCBhZGRyZXNzZXMnLCAoKSA9PiB7XG5cdFx0bGlua0FsbG93ZWRCeVJ1bGVzKCdodHRwOi8vMTkyLjE2OC4xLjcvJywgWydodHRwOi8vMTkyLjE2OC4xLjcvJ10pO1xuXHRcdGxpbmtBbGxvd2VkQnlSdWxlcygnaHR0cDovLzE5Mi4xNjguMS43LycsIFsnaHR0cDovLzE5Mi4xNjguMS43J10pO1xuXHRcdGxpbmtBbGxvd2VkQnlSdWxlcygnaHR0cDovLzE5Mi4xNjguMS43LycsIFsnaHR0cDovLzE5Mi4xNjguMS4qJ10pO1xuXG5cdFx0bGlua05vdEFsbG93ZWRCeVJ1bGVzKCdodHRwOi8vMTkyLjE2OC4xLjc6MzAwMC8nLCBbJ2h0dHA6Ly8xOTIuMTY4LiouNjoqJ10pO1xuXHRcdGxpbmtBbGxvd2VkQnlSdWxlcygnaHR0cDovLzE5Mi4xNjguMS43OjMwMDAvJywgWydodHRwOi8vMTkyLjE2OC4xLjc6MzAwMC8nXSk7XG5cdFx0bGlua0FsbG93ZWRCeVJ1bGVzKCdodHRwOi8vMTkyLjE2OC4xLjc6MzAwMC8nLCBbJ2h0dHA6Ly8xOTIuMTY4LjEuNzoqJ10pO1xuXHRcdGxpbmtBbGxvd2VkQnlSdWxlcygnaHR0cDovLzE5Mi4xNjguMS43OjMwMDAvJywgWydodHRwOi8vMTkyLjE2OC4xLio6KiddKTtcblx0XHRsaW5rTm90QWxsb3dlZEJ5UnVsZXMoJ2h0dHA6Ly8xOTIuMTY4LjEuNzozMDAwLycsIFsnaHR0cDovLzE5Mi4xNjguKi42OionXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NjaGVtZSBtYXRjaCcsICgpID0+IHtcblx0XHRsaW5rQWxsb3dlZEJ5UnVsZXMoJ2h0dHA6Ly8xOTIuMTY4LjEuNy8nLCBbJ2h0dHA6Ly8qJ10pO1xuXHRcdGxpbmtBbGxvd2VkQnlSdWxlcygnaHR0cDovL3R3aXR0ZXIuY29tJywgWydodHRwOi8vKiddKTtcblx0XHRsaW5rQWxsb3dlZEJ5UnVsZXMoJ2h0dHA6Ly90d2l0dGVyLmNvbS9oZWxsbycsIFsnaHR0cDovLyonXSk7XG5cdFx0bGlua05vdEFsbG93ZWRCeVJ1bGVzKCdodHRwczovLzE5Mi4xNjguMS43LycsIFsnaHR0cDovLyonXSk7XG5cdFx0bGlua05vdEFsbG93ZWRCeVJ1bGVzKCdodHRwczovL3R3aXR0ZXIuY29tLycsIFsnaHR0cDovLyonXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Nhc2Ugbm9ybWFsaXphdGlvbicsICgpID0+IHtcblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvOTkyOTRcblx0XHRsaW5rQWxsb3dlZEJ5UnVsZXMoJ2h0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy9uZXcnLCBbJ2h0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQnXSk7XG5cdFx0bGlua0FsbG93ZWRCeVJ1bGVzKCdodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvbmV3JywgWydodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0J10pO1xuXHR9KTtcblxuXHR0ZXN0KCdpZ25vcmUgcXVlcnkgJiBmcmFnbWVudCAtIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNTY4MzknLCAoKSA9PiB7XG5cdFx0bGlua0FsbG93ZWRCeVJ1bGVzKCdodHRwczovL2dpdGh1Yi5jb20vbG9naW4vb2F1dGgvYXV0aG9yaXplP2Zvbz00JywgWydodHRwczovL2dpdGh1Yi5jb20vbG9naW4vb2F1dGgvYXV0aG9yaXplJ10pO1xuXHRcdGxpbmtBbGxvd2VkQnlSdWxlcygnaHR0cHM6Ly9naXRodWIuY29tL2xvZ2luL29hdXRoL2F1dGhvcml6ZSNmb28nLCBbJ2h0dHBzOi8vZ2l0aHViLmNvbS9sb2dpbi9vYXV0aC9hdXRob3JpemUnXSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFFbkIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsMEJBQTBCO0FBRW5DLFNBQVMsbUJBQW1CLE1BQWMsT0FBaUI7QUFDMUQsU0FBTyxHQUFHLG1CQUFtQixJQUFJLE1BQU0sSUFBSSxHQUFHLEtBQUssR0FBRztBQUFBLEVBQVMsSUFBSTtBQUFBO0FBQUEsRUFBa0MsS0FBSyxVQUFVLEtBQUssQ0FBQyxFQUFFO0FBQzdIO0FBQ0EsU0FBUyxzQkFBc0IsTUFBYyxPQUFpQjtBQUM3RCxTQUFPLEdBQUcsQ0FBQyxtQkFBbUIsSUFBSSxNQUFNLElBQUksR0FBRyxLQUFLLEdBQUc7QUFBQSxFQUFTLElBQUk7QUFBQTtBQUFBLEVBQXNDLEtBQUssVUFBVSxLQUFLLENBQUMsRUFBRTtBQUNsSTtBQUVBLE1BQU0sbUNBQW1DLE1BQU07QUFDOUMsMENBQXdDO0FBQ3hDLE9BQUssVUFBVSxNQUFNO0FBQ3BCLDBCQUFzQixpQkFBaUIsQ0FBQyxDQUFDO0FBRXpDLHVCQUFtQixpQkFBaUIsQ0FBQyxlQUFlLENBQUM7QUFDckQsdUJBQW1CLHFCQUFxQixDQUFDLGVBQWUsQ0FBQztBQUV6RCwwQkFBc0IsaUJBQWlCLENBQUMsY0FBYyxDQUFDO0FBQ3ZELDBCQUFzQixnQkFBZ0IsQ0FBQyxlQUFlLENBQUM7QUFFdkQsMEJBQXNCLHFCQUFxQixDQUFDLGVBQWUsQ0FBQztBQUU1RCx1QkFBbUIs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
