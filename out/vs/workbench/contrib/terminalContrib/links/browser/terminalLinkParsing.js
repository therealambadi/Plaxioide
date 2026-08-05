import { Lazy } from "../../../../../base/common/lazy.js";
import { OperatingSystem } from "../../../../../base/common/platform.js";
const linkSuffixRegexEol = new Lazy(() => generateLinkSuffixRegex(true));
const linkSuffixRegex = new Lazy(() => generateLinkSuffixRegex(false));
function generateLinkSuffixRegex(eolOnly) {
  let ri = 0;
  let ci = 0;
  let rei = 0;
  let cei = 0;
  function r() {
    return `(?<row${ri++}>\\d+)`;
  }
  function c() {
    return `(?<col${ci++}>\\d+)`;
  }
  function re() {
    return `(?<rowEnd${rei++}>\\d+)`;
  }
  function ce() {
    return `(?<colEnd${cei++}>\\d+)`;
  }
  const eolSuffix = eolOnly ? "$" : "";
  const lineAndColumnRegexClauses = [
    // foo:339
    // foo:339:12
    // foo:339:12-789
    // foo:339:12-341.789
    // foo:339.12
    // foo 339
    // foo 339:12                              [#140780]
    // foo 339.12
    // foo#339
    // foo#339:12                              [#190288]
    // foo#339.12
    // foo, 339                                [#217927]
    // "foo",339
    // "foo",339:12
    // "foo",339.12
    // "foo",339.12-789
    // "foo",339.12-341.789
    `(?::|#| |['"],|, )${r()}([:.]${c()}(?:-(?:${re()}\\.)?${ce()})?)?` + eolSuffix,
    // The quotes below are optional           [#171652]
    // "foo", line 339                         [#40468]
    // "foo", line 339, col 12
    // "foo", line 339, column 12
    // "foo":line 339
    // "foo":line 339, col 12
    // "foo":line 339, column 12
    // "foo": line 339
    // "foo": line 339, col 12
    // "foo": line 339, column 12
    // "foo" on line 339
    // "foo" on line 339, col 12
    // "foo" on line 339, column 12
    // "foo" line 339 column 12
    // "foo", line 339, character 12           [#171880]
    // "foo", line 339, characters 12-789      [#171880]
    // "foo", lines 339-341                    [#171880]
    // "foo", lines 339-341, characters 12-789 [#178287]
    `['"]?(?:,? |: ?| on )lines? ${r()}(?:-${re()})?(?:,? (?:col(?:umn)?|characters?) ${c()}(?:-${ce()})?)?` + eolSuffix,
    // () and [] are interchangeable
    // foo(339)
    // foo(339,12)
    // foo(339, 12)
    // foo (339)
    // foo (339,12)
    // foo (339, 12)
    // foo: (339)
    // foo: (339,12)
    // foo: (339, 12)
    // foo(339:12)                             [#229842]
    // foo (339:12)                            [#229842]
    `:? ?[\\[\\(]${r()}(?:(?:, ?|:)${c()})?[\\]\\)]` + eolSuffix
  ];
  const suffixClause = lineAndColumnRegexClauses.join("|").replace(/ /g, `[${"\xA0"} ]`);
  return new RegExp(`(${suffixClause})`, eolOnly ? void 0 : "g");
}
function removeLinkSuffix(link) {
  const suffix = getLinkSuffix(link)?.suffix;
  if (!suffix) {
    return link;
  }
  return link.substring(0, suffix.index);
}
function removeLinkQueryString(link) {
  const start = link.startsWith("\\\\?\\") ? 4 : 0;
  const index = link.indexOf("?", start);
  if (index === -1) {
    return link;
  }
  return link.substring(0, index);
}
function detectLinkSuffixes(line) {
  let match;
  const results = [];
  linkSuffixRegex.value.lastIndex = 0;
  while ((match = linkSuffixRegex.value.exec(line)) !== null) {
    const suffix = toLinkSuffix(match);
    if (suffix === null) {
      break;
    }
    results.push(suffix);
  }
  return results;
}
function getLinkSuffix(link) {
  return toLinkSuffix(linkSuffixRegexEol.value.exec(link));
}
function toLinkSuffix(match) {
  const groups = match?.groups;
  if (!groups || match.length < 1) {
    return null;
  }
  return {
    row: parseIntOptional(groups.row0 || groups.row1 || groups.row2),
    col: parseIntOptional(groups.col0 || groups.col1 || groups.col2),
    rowEnd: parseIntOptional(groups.rowEnd0 || groups.rowEnd1 || groups.rowEnd2),
    colEnd: parseIntOptional(groups.colEnd0 || groups.colEnd1 || groups.colEnd2),
    suffix: { index: match.index, text: match[0] }
  };
}
function parseIntOptional(value) {
  if (value === void 0) {
    return value;
  }
  return parseInt(value);
}
const linkWithSuffixPathCharacters = /(?<path>(?:file:\/\/\/)?[^\s\|<>\[\({][^\s\|<>]*)$/;
function detectLinks(line, os) {
  const results = detectLinksViaSuffix(line);
  const noSuffixPaths = detectPathsNoSuffix(line, os);
  binaryInsertList(results, noSuffixPaths);
  return results;
}
function binaryInsertList(list, newItems) {
  if (list.length === 0) {
    list.push(...newItems);
  }
  for (const item of newItems) {
    binaryInsert(list, item, 0, list.length);
  }
}
function binaryInsert(list, newItem, low, high) {
  if (list.length === 0) {
    list.push(newItem);
    return;
  }
  if (low > high) {
    return;
  }
  const mid = Math.floor((low + high) / 2);
  if (mid >= list.length || newItem.path.index < list[mid].path.index && (mid === 0 || newItem.path.index > list[mid - 1].path.index)) {
    if (mid >= list.length || newItem.path.index + newItem.path.text.length < list[mid].path.index && (mid === 0 || newItem.path.index > list[mid - 1].path.index + list[mid - 1].path.text.length)) {
      list.splice(mid, 0, newItem);
    }
    return;
  }
  if (newItem.path.index > list[mid].path.index) {
    binaryInsert(list, newItem, mid + 1, high);
  } else {
    binaryInsert(list, newItem, low, mid - 1);
  }
}
function detectLinksViaSuffix(line) {
  const results = [];
  const suffixes = detectLinkSuffixes(line);
  for (const suffix of suffixes) {
    const beforeSuffix = line.substring(0, suffix.suffix.index);
    const possiblePathMatch = beforeSuffix.match(linkWithSuffixPathCharacters);
    if (possiblePathMatch && possiblePathMatch.index !== void 0 && possiblePathMatch.groups?.path) {
      let linkStartIndex = possiblePathMatch.index;
      let path = possiblePathMatch.groups.path;
      let prefix = void 0;
      const prefixMatch = path.match(/^(?<prefix>['"]+)/);
      if (prefixMatch?.groups?.prefix) {
        prefix = {
          index: linkStartIndex,
          text: prefixMatch.groups.prefix
        };
        path = path.substring(prefix.text.length);
        if (path.trim().length === 0) {
          continue;
        }
        if (prefixMatch.groups.prefix.length > 1) {
          if (suffix.suffix.text[0].match(/['"]/) && prefixMatch.groups.prefix[prefixMatch.groups.prefix.length - 1] === suffix.suffix.text[0]) {
            const trimPrefixAmount = prefixMatch.groups.prefix.length - 1;
            prefix.index += trimPrefixAmount;
            prefix.text = prefixMatch.groups.prefix[prefixMatch.groups.prefix.length - 1];
            linkStartIndex += trimPrefixAmount;
          }
        }
      }
      results.push({
        path: {
          index: linkStartIndex + (prefix?.text.length || 0),
          text: path
        },
        prefix,
        suffix
      });
    }
  }
  return results;
}
var RegexPathConstants = /* @__PURE__ */ ((RegexPathConstants2) => {
  RegexPathConstants2["PathPrefix"] = "(?:\\.\\.?|\\~|file://)";
  RegexPathConstants2["PathSeparatorClause"] = "\\/";
  RegexPathConstants2["ExcludedPathCharactersClause"] = "[^\\0<>\\?\\s!`&*()'\":;\\\\]";
  RegexPathConstants2["ExcludedStartPathCharactersClause"] = "[^\\0<>\\?\\s!`&*()\\[\\]'\":;\\\\]";
  RegexPathConstants2["WinOtherPathPrefix"] = "\\.\\.?|\\~";
  RegexPathConstants2["WinPathSeparatorClause"] = "(?:\\\\|\\/)";
  RegexPathConstants2["WinExcludedPathCharactersClause"] = "[^\\0<>\\?\\|\\/\\s!`&*()'\":;]";
  RegexPathConstants2["WinExcludedStartPathCharactersClause"] = "[^\\0<>\\?\\|\\/\\s!`&*()\\[\\]'\":;]";
  return RegexPathConstants2;
})(RegexPathConstants || {});
const unixLocalLinkClause = "(?:(?:(?:\\.\\.?|\\~|file://)|(?:[^\\0<>\\?\\s!`&*()\\[\\]'\":;\\\\][^\\0<>\\?\\s!`&*()'\":;\\\\]*))?(?:\\/(?:[^\\0<>\\?\\s!`&*()'\":;\\\\])+)+)";
const winDrivePrefix = "(?:\\\\\\\\\\?\\\\|file:\\/\\/\\/)?[a-zA-Z]:";
const winLocalLinkClause = `(?:(?:(?:${winDrivePrefix}|${"\\.\\.?|\\~" /* WinOtherPathPrefix */})|(?:[^\\0<>\\?\\|\\/\\s!\`&*()\\[\\]'":;][^\\0<>\\?\\|\\/\\s!\`&*()'":;]*))?(?:(?:\\\\|\\/)(?:[^\\0<>\\?\\|\\/\\s!\`&*()'":;])+)+)`;
function detectPathsNoSuffix(line, os) {
  const results = [];
  const regex = new RegExp(os === OperatingSystem.Windows ? winLocalLinkClause : unixLocalLinkClause, "g");
  let match;
  while ((match = regex.exec(line)) !== null) {
    let text = match[0];
    let index = match.index;
    if (!text) {
      break;
    }
    if (
      // --- a/foo/bar
      // +++ b/foo/bar
      (line.startsWith("--- a/") || line.startsWith("+++ b/")) && index === 4 || // diff --git a/foo/bar b/foo/bar
      line.startsWith("diff --git") && (text.startsWith("a/") || text.startsWith("b/"))
    ) {
      text = text.substring(2);
      index += 2;
    }
    results.push({
      path: {
        index,
        text
      },
      prefix: void 0,
      suffix: void 0
    });
  }
  return results;
}
export {
  detectLinkSuffixes,
  detectLinks,
  getLinkSuffix,
  removeLinkQueryString,
  removeLinkSuffix,
  toLinkSuffix,
  winDrivePrefix
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvbGlua3MvYnJvd3Nlci90ZXJtaW5hbExpbmtQYXJzaW5nLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuLyoqXG4gKiBUaGlzIG1vZHVsZSBpcyByZXNwb25zaWJsZSBmb3IgcGFyc2luZyBwb3NzaWJsZSBsaW5rcyBvdXQgb2YgbGluZXMgd2l0aCBvbmx5IGFjY2VzcyB0byB0aGUgbGluZVxuICogdGV4dCBhbmQgdGhlIHRhcmdldCBvcGVyYXRpbmcgc3lzdGVtLCBpZS4gaXQgZG9lcyBub3QgZG8gYW55IHZhbGlkYXRpb24gdGhhdCBwYXRocyBhY3R1YWxseVxuICogZXhpc3QuXG4gKi9cblxuaW1wb3J0IHsgTGF6eSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhenkuanMnO1xuaW1wb3J0IHsgT3BlcmF0aW5nU3lzdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElQYXJzZWRMaW5rIHtcblx0cGF0aDogSUxpbmtQYXJ0aWFsUmFuZ2U7XG5cdHByZWZpeD86IElMaW5rUGFydGlhbFJhbmdlO1xuXHRzdWZmaXg/OiBJTGlua1N1ZmZpeDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTGlua1N1ZmZpeCB7XG5cdHJvdzogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRjb2w6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0cm93RW5kOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdGNvbEVuZDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRzdWZmaXg6IElMaW5rUGFydGlhbFJhbmdlO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElMaW5rUGFydGlhbFJhbmdlIHtcblx0aW5kZXg6IG51bWJlcjtcblx0dGV4dDogc3RyaW5nO1xufVxuXG4vKipcbiAqIEEgcmVnZXggdGhhdCBleHRyYWN0cyB0aGUgbGluayBzdWZmaXggd2hpY2ggY29udGFpbnMgbGluZSBhbmQgY29sdW1uIGluZm9ybWF0aW9uLiBUaGUgbGluayBzdWZmaXhcbiAqIG11c3QgdGVybWluYXRlIGF0IHRoZSBlbmQgb2YgbGluZS5cbiAqL1xuY29uc3QgbGlua1N1ZmZpeFJlZ2V4RW9sID0gbmV3IExhenk8UmVnRXhwPigoKSA9PiBnZW5lcmF0ZUxpbmtTdWZmaXhSZWdleCh0cnVlKSk7XG4vKipcbiAqIEEgcmVnZXggdGhhdCBleHRyYWN0cyB0aGUgbGluayBzdWZmaXggd2hpY2ggY29udGFpbnMgbGluZSBhbmQgY29sdW1uIGluZm9ybWF0aW9uLlxuICovXG5jb25zdCBsaW5rU3VmZml4UmVnZXggPSBuZXcgTGF6eTxSZWdFeHA+KCgpID0+IGdlbmVyYXRlTGlua1N1ZmZpeFJlZ2V4KGZhbHNlKSk7XG5cbmZ1bmN0aW9uIGdlbmVyYXRlTGlua1N1ZmZpeFJlZ2V4KGVvbE9ubHk6IGJvb2xlYW4pIHtcblx0bGV0IHJpID0gMDtcblx0bGV0IGNpID0gMDtcblx0bGV0IHJlaSA9IDA7XG5cdGxldCBjZWkgPSAwO1xuXHRmdW5jdGlvbiByKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGAoPzxyb3cke3JpKyt9PlxcXFxkKylgO1xuXHR9XG5cdGZ1bmN0aW9uIGMoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYCg/PGNvbCR7Y2krK30+XFxcXGQrKWA7XG5cdH1cblx0ZnVuY3Rpb24gcmUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYCg/PHJvd0VuZCR7cmVpKyt9PlxcXFxkKylgO1xuXHR9XG5cdGZ1bmN0aW9uIGNlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGAoPzxjb2xFbmQke2NlaSsrfT5cXFxcZCspYDtcblx0fVxuXG5cdGNvbnN0IGVvbFN1ZmZpeCA9IGVvbE9ubHkgPyAnJCcgOiAnJztcblxuXHQvLyBUaGUgY29tbWVudHMgaW4gdGhlIHJlZ2V4IGJlbG93IHVzZSByZWFsIHN0cmluZ3MvbnVtYmVycyBmb3IgYmV0dGVyIHJlYWRhYmlsaXR5LCBoZXJlJ3Ncblx0Ly8gdGhlIGxlZ2VuZDpcblx0Ly8gLSBQYXRoICAgID0gZm9vXG5cdC8vIC0gUm93ICAgICA9IDMzOVxuXHQvLyAtIENvbCAgICAgPSAxMlxuXHQvLyAtIFJvd0VuZCAgPSAzNDFcblx0Ly8gLSBDb2xFbmQgID0gNzg5XG5cdC8vXG5cdC8vIFRoZXNlIGFsbCBzdXBwb3J0IHNpbmdsZSBxdW90ZSAnIGluIHRoZSBwbGFjZSBvZiBcIiBhbmQgW10gaW4gdGhlIHBsYWNlIG9mICgpXG5cdC8vXG5cdC8vIFNlZSB0aGUgdGVzdHMgZm9yIGFuIGV4aGF1c3RpdmUgbGlzdCBvZiBhbGwgc3VwcG9ydGVkIGZvcm1hdHNcblx0Y29uc3QgbGluZUFuZENvbHVtblJlZ2V4Q2xhdXNlcyA9IFtcblx0XHQvLyBmb286MzM5XG5cdFx0Ly8gZm9vOjMzOToxMlxuXHRcdC8vIGZvbzozMzk6MTItNzg5XG5cdFx0Ly8gZm9vOjMzOToxMi0zNDEuNzg5XG5cdFx0Ly8gZm9vOjMzOS4xMlxuXHRcdC8vIGZvbyAzMzlcblx0XHQvLyBmb28gMzM5OjEyICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWyMxNDA3ODBdXG5cdFx0Ly8gZm9vIDMzOS4xMlxuXHRcdC8vIGZvbyMzMzlcblx0XHQvLyBmb28jMzM5OjEyICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWyMxOTAyODhdXG5cdFx0Ly8gZm9vIzMzOS4xMlxuXHRcdC8vIGZvbywgMzM5ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbIzIxNzkyN11cblx0XHQvLyBcImZvb1wiLDMzOVxuXHRcdC8vIFwiZm9vXCIsMzM5OjEyXG5cdFx0Ly8gXCJmb29cIiwzMzkuMTJcblx0XHQvLyBcImZvb1wiLDMzOS4xMi03ODlcblx0XHQvLyBcImZvb1wiLDMzOS4xMi0zNDEuNzg5XG5cdFx0YCg/Ojp8I3wgfFsnXCJdLHwsICkke3IoKX0oWzouXSR7YygpfSg/Oi0oPzoke3JlKCl9XFxcXC4pPyR7Y2UoKX0pPyk/YCArIGVvbFN1ZmZpeCxcblx0XHQvLyBUaGUgcXVvdGVzIGJlbG93IGFyZSBvcHRpb25hbCAgICAgICAgICAgWyMxNzE2NTJdXG5cdFx0Ly8gXCJmb29cIiwgbGluZSAzMzkgICAgICAgICAgICAgICAgICAgICAgICAgWyM0MDQ2OF1cblx0XHQvLyBcImZvb1wiLCBsaW5lIDMzOSwgY29sIDEyXG5cdFx0Ly8gXCJmb29cIiwgbGluZSAzMzksIGNvbHVtbiAxMlxuXHRcdC8vIFwiZm9vXCI6bGluZSAzMzlcblx0XHQvLyBcImZvb1wiOmxpbmUgMzM5LCBjb2wgMTJcblx0XHQvLyBcImZvb1wiOmxpbmUgMzM5LCBjb2x1bW4gMTJcblx0XHQvLyBcImZvb1wiOiBsaW5lIDMzOVxuXHRcdC8vIFwiZm9vXCI6IGxpbmUgMzM5LCBjb2wgMTJcblx0XHQvLyBcImZvb1wiOiBsaW5lIDMzOSwgY29sdW1uIDEyXG5cdFx0Ly8gXCJmb29cIiBvbiBsaW5lIDMzOVxuXHRcdC8vIFwiZm9vXCIgb24gbGluZSAzMzksIGNvbCAxMlxuXHRcdC8vIFwiZm9vXCIgb24gbGluZSAzMzksIGNvbHVtbiAxMlxuXHRcdC8vIFwiZm9vXCIgbGluZSAzMzkgY29sdW1uIDEyXG5cdFx0Ly8gXCJmb29cIiwgbGluZSAzMzksIGNoYXJhY3RlciAxMiAgICAgICAgICAgWyMxNzE4ODBdXG5cdFx0Ly8gXCJmb29cIiwgbGluZSAzMzksIGNoYXJhY3RlcnMgMTItNzg5ICAgICAgWyMxNzE4ODBdXG5cdFx0Ly8gXCJmb29cIiwgbGluZXMgMzM5LTM0MSAgICAgICAgICAgICAgICAgICAgWyMxNzE4ODBdXG5cdFx0Ly8gXCJmb29cIiwgbGluZXMgMzM5LTM0MSwgY2hhcmFjdGVycyAxMi03ODkgWyMxNzgyODddXG5cdFx0YFsnXCJdPyg/Oiw/IHw6ID98IG9uIClsaW5lcz8gJHtyKCl9KD86LSR7cmUoKX0pPyg/Oiw/ICg/OmNvbCg/OnVtbik/fGNoYXJhY3RlcnM/KSAke2MoKX0oPzotJHtjZSgpfSk/KT9gICsgZW9sU3VmZml4LFxuXHRcdC8vICgpIGFuZCBbXSBhcmUgaW50ZXJjaGFuZ2VhYmxlXG5cdFx0Ly8gZm9vKDMzOSlcblx0XHQvLyBmb28oMzM5LDEyKVxuXHRcdC8vIGZvbygzMzksIDEyKVxuXHRcdC8vIGZvbyAoMzM5KVxuXHRcdC8vIGZvbyAoMzM5LDEyKVxuXHRcdC8vIGZvbyAoMzM5LCAxMilcblx0XHQvLyBmb286ICgzMzkpXG5cdFx0Ly8gZm9vOiAoMzM5LDEyKVxuXHRcdC8vIGZvbzogKDMzOSwgMTIpXG5cdFx0Ly8gZm9vKDMzOToxMikgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsjMjI5ODQyXVxuXHRcdC8vIGZvbyAoMzM5OjEyKSAgICAgICAgICAgICAgICAgICAgICAgICAgICBbIzIyOTg0Ml1cblx0XHRgOj8gP1tcXFxcW1xcXFwoXSR7cigpfSg/Oig/OiwgP3w6KSR7YygpfSk/W1xcXFxdXFxcXCldYCArIGVvbFN1ZmZpeCxcblx0XTtcblxuXHRjb25zdCBzdWZmaXhDbGF1c2UgPSBsaW5lQW5kQ29sdW1uUmVnZXhDbGF1c2VzXG5cdFx0Ly8gSm9pbiBhbGwgY2xhdXNlcyB0b2dldGhlclxuXHRcdC5qb2luKCd8Jylcblx0XHQvLyBDb252ZXJ0IHNwYWNlcyB0byBhbGxvdyB0aGUgbm9uLWJyZWFraW5nIHNwYWNlIGNoYXIgKGFzY2lpIDE2MClcblx0XHQucmVwbGFjZSgvIC9nLCBgWyR7J1xcdTAwQTAnfSBdYCk7XG5cblx0cmV0dXJuIG5ldyBSZWdFeHAoYCgke3N1ZmZpeENsYXVzZX0pYCwgZW9sT25seSA/IHVuZGVmaW5lZCA6ICdnJyk7XG59XG5cbi8qKlxuICogUmVtb3ZlcyB0aGUgb3B0aW9uYWwgbGluayBzdWZmaXggd2hpY2ggY29udGFpbnMgbGluZSBhbmQgY29sdW1uIGluZm9ybWF0aW9uLlxuICogQHBhcmFtIGxpbmsgVGhlIGxpbmsgdG8gdXNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlTGlua1N1ZmZpeChsaW5rOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRjb25zdCBzdWZmaXggPSBnZXRMaW5rU3VmZml4KGxpbmspPy5zdWZmaXg7XG5cdGlmICghc3VmZml4KSB7XG5cdFx0cmV0dXJuIGxpbms7XG5cdH1cblx0cmV0dXJuIGxpbmsuc3Vic3RyaW5nKDAsIHN1ZmZpeC5pbmRleCk7XG59XG5cbi8qKlxuICogUmVtb3ZlcyBhbnkgcXVlcnkgc3RyaW5nIGZyb20gdGhlIGxpbmsuXG4gKiBAcGFyYW0gbGluayBUaGUgbGluayB0byB1c2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVMaW5rUXVlcnlTdHJpbmcobGluazogc3RyaW5nKTogc3RyaW5nIHtcblx0Ly8gU2tpcCA/IGluIFVOQyBwYXRoc1xuXHRjb25zdCBzdGFydCA9IGxpbmsuc3RhcnRzV2l0aCgnXFxcXFxcXFw/XFxcXCcpID8gNCA6IDA7XG5cdGNvbnN0IGluZGV4ID0gbGluay5pbmRleE9mKCc/Jywgc3RhcnQpO1xuXHRpZiAoaW5kZXggPT09IC0xKSB7XG5cdFx0cmV0dXJuIGxpbms7XG5cdH1cblx0cmV0dXJuIGxpbmsuc3Vic3RyaW5nKDAsIGluZGV4KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRldGVjdExpbmtTdWZmaXhlcyhsaW5lOiBzdHJpbmcpOiBJTGlua1N1ZmZpeFtdIHtcblx0Ly8gRmluZCBhbGwgc3VmZml4ZXMgb24gdGhlIGxpbmUuIFNpbmNlIHRoZSByZWdleCBnbG9iYWwgZmxhZyBpcyB1c2VkLCBsYXN0SW5kZXggd2lsbCBiZSB1cGRhdGVkXG5cdC8vIGluIHBsYWNlIHN1Y2ggdGhhdCB0aGVyZSBhcmUgbm8gb3ZlcmxhcHBpbmcgbWF0Y2hlcy5cblx0bGV0IG1hdGNoOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuXHRjb25zdCByZXN1bHRzOiBJTGlua1N1ZmZpeFtdID0gW107XG5cdGxpbmtTdWZmaXhSZWdleC52YWx1ZS5sYXN0SW5kZXggPSAwO1xuXHR3aGlsZSAoKG1hdGNoID0gbGlua1N1ZmZpeFJlZ2V4LnZhbHVlLmV4ZWMobGluZSkpICE9PSBudWxsKSB7XG5cdFx0Y29uc3Qgc3VmZml4ID0gdG9MaW5rU3VmZml4KG1hdGNoKTtcblx0XHRpZiAoc3VmZml4ID09PSBudWxsKSB7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdFx0cmVzdWx0cy5wdXNoKHN1ZmZpeCk7XG5cdH1cblx0cmV0dXJuIHJlc3VsdHM7XG59XG5cbi8qKlxuICogUmV0dXJucyB0aGUgb3B0aW9uYWwgbGluayBzdWZmaXggd2hpY2ggY29udGFpbnMgbGluZSBhbmQgY29sdW1uIGluZm9ybWF0aW9uLlxuICogQHBhcmFtIGxpbmsgVGhlIGxpbmsgdG8gcGFyc2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRMaW5rU3VmZml4KGxpbms6IHN0cmluZyk6IElMaW5rU3VmZml4IHwgbnVsbCB7XG5cdHJldHVybiB0b0xpbmtTdWZmaXgobGlua1N1ZmZpeFJlZ2V4RW9sLnZhbHVlLmV4ZWMobGluaykpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9MaW5rU3VmZml4KG1hdGNoOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsKTogSUxpbmtTdWZmaXggfCBudWxsIHtcblx0Y29uc3QgZ3JvdXBzID0gbWF0Y2g/Lmdyb3Vwcztcblx0aWYgKCFncm91cHMgfHwgbWF0Y2gubGVuZ3RoIDwgMSkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cdHJldHVybiB7XG5cdFx0cm93OiBwYXJzZUludE9wdGlvbmFsKGdyb3Vwcy5yb3cwIHx8IGdyb3Vwcy5yb3cxIHx8IGdyb3Vwcy5yb3cyKSxcblx0XHRjb2w6IHBhcnNlSW50T3B0aW9uYWwoZ3JvdXBzLmNvbDAgfHwgZ3JvdXBzLmNvbDEgfHwgZ3JvdXBzLmNvbDIpLFxuXHRcdHJvd0VuZDogcGFyc2VJbnRPcHRpb25hbChncm91cHMucm93RW5kMCB8fCBncm91cHMucm93RW5kMSB8fCBncm91cHMucm93RW5kMiksXG5cdFx0Y29sRW5kOiBwYXJzZUludE9wdGlvbmFsKGdyb3Vwcy5jb2xFbmQwIHx8IGdyb3Vwcy5jb2xFbmQxIHx8IGdyb3Vwcy5jb2xFbmQyKSxcblx0XHRzdWZmaXg6IHsgaW5kZXg6IG1hdGNoLmluZGV4LCB0ZXh0OiBtYXRjaFswXSB9XG5cdH07XG59XG5cbmZ1bmN0aW9uIHBhcnNlSW50T3B0aW9uYWwodmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG5cdHJldHVybiBwYXJzZUludCh2YWx1ZSk7XG59XG5cbi8vIFRoaXMgZGVmaW5lcyB2YWxpZCBwYXRoIGNoYXJhY3RlcnMgZm9yIGEgbGluayB3aXRoIGEgc3VmZml4LCB0aGUgZmlyc3QgYFtdYCBvZiB0aGUgcmVnZXggaW5jbHVkZXNcbi8vIGNoYXJhY3RlcnMgdGhlIHBhdGggaXMgbm90IGFsbG93ZWQgdG8gX3N0YXJ0XyB3aXRoLCB0aGUgc2Vjb25kIGBbXWAgaW5jbHVkZXMgY2hhcmFjdGVycyBub3Rcbi8vIGFsbG93ZWQgYXQgYWxsIGluIHRoZSBwYXRoLiBJZiB0aGUgY2hhcmFjdGVycyBzaG93IHVwIGluIGJvdGggcmVnZXhlcyB0aGUgbGluayB3aWxsIHN0b3AgYXQgdGhhdFxuLy8gY2hhcmFjdGVyLCBvdGhlcndpc2UgaXQgd2lsbCBzdG9wIGF0IGEgc3BhY2UgY2hhcmFjdGVyLlxuY29uc3QgbGlua1dpdGhTdWZmaXhQYXRoQ2hhcmFjdGVycyA9IC8oPzxwYXRoPig/OmZpbGU6XFwvXFwvXFwvKT9bXlxcc1xcfDw+XFxbXFwoe11bXlxcc1xcfDw+XSopJC87XG5cbmV4cG9ydCBmdW5jdGlvbiBkZXRlY3RMaW5rcyhsaW5lOiBzdHJpbmcsIG9zOiBPcGVyYXRpbmdTeXN0ZW0pIHtcblx0Ly8gMTogRGV0ZWN0IGFsbCBsaW5rcyBvbiBsaW5lIHZpYSBzdWZmaXhlcyBmaXJzdFxuXHRjb25zdCByZXN1bHRzID0gZGV0ZWN0TGlua3NWaWFTdWZmaXgobGluZSk7XG5cblx0Ly8gMjogRGV0ZWN0IGFsbCBsaW5rcyB3aXRob3V0IHN1ZmZpeGVzIGFuZCBtZXJnZSBub24tY29uZmxpY3RpbmcgcmFuZ2VzIGludG8gdGhlIHJlc3VsdHNcblx0Y29uc3Qgbm9TdWZmaXhQYXRocyA9IGRldGVjdFBhdGhzTm9TdWZmaXgobGluZSwgb3MpO1xuXHRiaW5hcnlJbnNlcnRMaXN0KHJlc3VsdHMsIG5vU3VmZml4UGF0aHMpO1xuXG5cdHJldHVybiByZXN1bHRzO1xufVxuXG5mdW5jdGlvbiBiaW5hcnlJbnNlcnRMaXN0KGxpc3Q6IElQYXJzZWRMaW5rW10sIG5ld0l0ZW1zOiBJUGFyc2VkTGlua1tdKSB7XG5cdGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuXHRcdGxpc3QucHVzaCguLi5uZXdJdGVtcyk7XG5cdH1cblx0Zm9yIChjb25zdCBpdGVtIG9mIG5ld0l0ZW1zKSB7XG5cdFx0YmluYXJ5SW5zZXJ0KGxpc3QsIGl0ZW0sIDAsIGxpc3QubGVuZ3RoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBiaW5hcnlJbnNlcnQobGlzdDogSVBhcnNlZExpbmtbXSwgbmV3SXRlbTogSVBhcnNlZExpbmssIGxvdzogbnVtYmVyLCBoaWdoOiBudW1iZXIpIHtcblx0aWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG5cdFx0bGlzdC5wdXNoKG5ld0l0ZW0pO1xuXHRcdHJldHVybjtcblx0fVxuXHRpZiAobG93ID4gaGlnaCkge1xuXHRcdHJldHVybjtcblx0fVxuXHQvLyBGaW5kIHRoZSBpbmRleCB3aGVyZSB0aGUgbmV3SXRlbSB3b3VsZCBiZSBpbnNlcnRlZFxuXHRjb25zdCBtaWQgPSBNYXRoLmZsb29yKChsb3cgKyBoaWdoKSAvIDIpO1xuXHRpZiAoXG5cdFx0bWlkID49IGxpc3QubGVuZ3RoIHx8XG5cdFx0KG5ld0l0ZW0ucGF0aC5pbmRleCA8IGxpc3RbbWlkXS5wYXRoLmluZGV4ICYmIChtaWQgPT09IDAgfHwgbmV3SXRlbS5wYXRoLmluZGV4ID4gbGlzdFttaWQgLSAxXS5wYXRoLmluZGV4KSlcblx0KSB7XG5cdFx0Ly8gQ2hlY2sgaWYgaXQgY29uZmxpY3RzIHdpdGggYW4gZXhpc3RpbmcgbGluayBiZWZvcmUgYWRkaW5nXG5cdFx0aWYgKFxuXHRcdFx0bWlkID49IGxpc3QubGVuZ3RoIHx8XG5cdFx0XHQobmV3SXRlbS5wYXRoLmluZGV4ICsgbmV3SXRlbS5wYXRoLnRleHQubGVuZ3RoIDwgbGlzdFttaWRdLnBhdGguaW5kZXggJiYgKG1pZCA9PT0gMCB8fCBuZXdJdGVtLnBhdGguaW5kZXggPiBsaXN0W21pZCAtIDFdLnBhdGguaW5kZXggKyBsaXN0W21pZCAtIDFdLnBhdGgudGV4dC5sZW5ndGgpKVxuXHRcdCkge1xuXHRcdFx0bGlzdC5zcGxpY2UobWlkLCAwLCBuZXdJdGVtKTtcblx0XHR9XG5cdFx0cmV0dXJuO1xuXHR9XG5cdGlmIChuZXdJdGVtLnBhdGguaW5kZXggPiBsaXN0W21pZF0ucGF0aC5pbmRleCkge1xuXHRcdGJpbmFyeUluc2VydChsaXN0LCBuZXdJdGVtLCBtaWQgKyAxLCBoaWdoKTtcblx0fSBlbHNlIHtcblx0XHRiaW5hcnlJbnNlcnQobGlzdCwgbmV3SXRlbSwgbG93LCBtaWQgLSAxKTtcblx0fVxufVxuXG5mdW5jdGlvbiBkZXRlY3RMaW5rc1ZpYVN1ZmZpeChsaW5lOiBzdHJpbmcpOiBJUGFyc2VkTGlua1tdIHtcblx0Y29uc3QgcmVzdWx0czogSVBhcnNlZExpbmtbXSA9IFtdO1xuXG5cdC8vIDE6IERldGVjdCBsaW5rIHN1ZmZpeGVzIG9uIHRoZSBsaW5lXG5cdGNvbnN0IHN1ZmZpeGVzID0gZGV0ZWN0TGlua1N1ZmZpeGVzKGxpbmUpO1xuXHRmb3IgKGNvbnN0IHN1ZmZpeCBvZiBzdWZmaXhlcykge1xuXHRcdGNvbnN0IGJlZm9yZVN1ZmZpeCA9IGxpbmUuc3Vic3RyaW5nKDAsIHN1ZmZpeC5zdWZmaXguaW5kZXgpO1xuXHRcdGNvbnN0IHBvc3NpYmxlUGF0aE1hdGNoID0gYmVmb3JlU3VmZml4Lm1hdGNoKGxpbmtXaXRoU3VmZml4UGF0aENoYXJhY3RlcnMpO1xuXHRcdGlmIChwb3NzaWJsZVBhdGhNYXRjaCAmJiBwb3NzaWJsZVBhdGhNYXRjaC5pbmRleCAhPT0gdW5kZWZpbmVkICYmIHBvc3NpYmxlUGF0aE1hdGNoLmdyb3Vwcz8ucGF0aCkge1xuXHRcdFx0bGV0IGxpbmtTdGFydEluZGV4ID0gcG9zc2libGVQYXRoTWF0Y2guaW5kZXg7XG5cdFx0XHRsZXQgcGF0aCA9IHBvc3NpYmxlUGF0aE1hdGNoLmdyb3Vwcy5wYXRoO1xuXHRcdFx0Ly8gRXh0cmFjdCBhIHBhdGggcHJlZml4IGlmIGl0IGV4aXN0cyAobm90IHBhcnQgb2YgdGhlIHBhdGgsIGJ1dCBwYXJ0IG9mIHRoZSB1bmRlcmxpbmVkXG5cdFx0XHQvLyBzZWN0aW9uKVxuXHRcdFx0bGV0IHByZWZpeDogSUxpbmtQYXJ0aWFsUmFuZ2UgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBwcmVmaXhNYXRjaCA9IHBhdGgubWF0Y2goL14oPzxwcmVmaXg+WydcIl0rKS8pO1xuXHRcdFx0aWYgKHByZWZpeE1hdGNoPy5ncm91cHM/LnByZWZpeCkge1xuXHRcdFx0XHRwcmVmaXggPSB7XG5cdFx0XHRcdFx0aW5kZXg6IGxpbmtTdGFydEluZGV4LFxuXHRcdFx0XHRcdHRleHQ6IHByZWZpeE1hdGNoLmdyb3Vwcy5wcmVmaXhcblx0XHRcdFx0fTtcblx0XHRcdFx0cGF0aCA9IHBhdGguc3Vic3RyaW5nKHByZWZpeC50ZXh0Lmxlbmd0aCk7XG5cblx0XHRcdFx0Ly8gRG9uJ3QgYWxsb3cgc3VmZml4IGxpbmtzIHRvIGJlIHJldHVybmVkIHdoZW4gdGhlIGxpbmsgaXRzZWxmIGlzIHRoZSBlbXB0eSBzdHJpbmdcblx0XHRcdFx0aWYgKHBhdGgudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gSWYgdGhlcmUgYXJlIG11bHRpcGxlIGNoYXJhY3RlcnMgaW4gdGhlIHByZWZpeCwgdHJpbSB0aGUgcHJlZml4IGlmIHRoZSBfZmlyc3RfXG5cdFx0XHRcdC8vIHN1ZmZpeCBjaGFyYWN0ZXIgaXMgdGhlIHNhbWUgYXMgdGhlIGxhc3QgcHJlZml4IGNoYXJhY3Rlci4gRm9yIGV4YW1wbGUsIGZvciB0aGVcblx0XHRcdFx0Ly8gdGV4dCBgZWNobyBcIidmb28nIG9uIGxpbmUgMVwiYDpcblx0XHRcdFx0Ly9cblx0XHRcdFx0Ly8gLSBQcmVmaXg9J1xuXHRcdFx0XHQvLyAtIFBhdGg9Zm9vXG5cdFx0XHRcdC8vIC0gU3VmZml4PScgb24gbGluZSAxXG5cdFx0XHRcdC8vXG5cdFx0XHRcdC8vIElmIHRoaXMgZmFpbHMgb24gYSBtdWx0aS1jaGFyYWN0ZXIgcHJlZml4LCBqdXN0IGtlZXAgdGhlIG9yaWdpbmFsLlxuXHRcdFx0XHRpZiAocHJlZml4TWF0Y2guZ3JvdXBzLnByZWZpeC5sZW5ndGggPiAxKSB7XG5cdFx0XHRcdFx0aWYgKHN1ZmZpeC5zdWZmaXgudGV4dFswXS5tYXRjaCgvWydcIl0vKSAmJiBwcmVmaXhNYXRjaC5ncm91cHMucHJlZml4W3ByZWZpeE1hdGNoLmdyb3Vwcy5wcmVmaXgubGVuZ3RoIC0gMV0gPT09IHN1ZmZpeC5zdWZmaXgudGV4dFswXSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgdHJpbVByZWZpeEFtb3VudCA9IHByZWZpeE1hdGNoLmdyb3Vwcy5wcmVmaXgubGVuZ3RoIC0gMTtcblx0XHRcdFx0XHRcdHByZWZpeC5pbmRleCArPSB0cmltUHJlZml4QW1vdW50O1xuXHRcdFx0XHRcdFx0cHJlZml4LnRleHQgPSBwcmVmaXhNYXRjaC5ncm91cHMucHJlZml4W3ByZWZpeE1hdGNoLmdyb3Vwcy5wcmVmaXgubGVuZ3RoIC0gMV07XG5cdFx0XHRcdFx0XHRsaW5rU3RhcnRJbmRleCArPSB0cmltUHJlZml4QW1vdW50O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmVzdWx0cy5wdXNoKHtcblx0XHRcdFx0cGF0aDoge1xuXHRcdFx0XHRcdGluZGV4OiBsaW5rU3RhcnRJbmRleCArIChwcmVmaXg/LnRleHQubGVuZ3RoIHx8IDApLFxuXHRcdFx0XHRcdHRleHQ6IHBhdGhcblx0XHRcdFx0fSxcblx0XHRcdFx0cHJlZml4LFxuXHRcdFx0XHRzdWZmaXhcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiByZXN1bHRzO1xufVxuXG5lbnVtIFJlZ2V4UGF0aENvbnN0YW50cyB7XG5cdFBhdGhQcmVmaXggPSAnKD86XFxcXC5cXFxcLj98XFxcXH58ZmlsZTpcXC9cXC8pJyxcblx0UGF0aFNlcGFyYXRvckNsYXVzZSA9ICdcXFxcLycsXG5cdC8vICdcIjo7IGFyZSBhbGxvd2VkIGluIHBhdGhzIGJ1dCB0aGV5IGFyZSBvZnRlbiBzZXBhcmF0b3JzIHNvIGlnbm9yZSB0aGVtXG5cdC8vIEFsc28gZGlzYWxsb3cgXFxcXCB0byBwcmV2ZW50IGEgY2F0YXN0cm9waWMgYmFja3RyYWNraW5nIGNhc2UgIzI0Nzk1XG5cdEV4Y2x1ZGVkUGF0aENoYXJhY3RlcnNDbGF1c2UgPSAnW15cXFxcMDw+XFxcXD9cXFxccyFgJiooKVxcJ1wiOjtcXFxcXFxcXF0nLFxuXHRFeGNsdWRlZFN0YXJ0UGF0aENoYXJhY3RlcnNDbGF1c2UgPSAnW15cXFxcMDw+XFxcXD9cXFxccyFgJiooKVxcXFxbXFxcXF1cXCdcIjo7XFxcXFxcXFxdJyxcblxuXHRXaW5PdGhlclBhdGhQcmVmaXggPSAnXFxcXC5cXFxcLj98XFxcXH4nLFxuXHRXaW5QYXRoU2VwYXJhdG9yQ2xhdXNlID0gJyg/OlxcXFxcXFxcfFxcXFwvKScsXG5cdFdpbkV4Y2x1ZGVkUGF0aENoYXJhY3RlcnNDbGF1c2UgPSAnW15cXFxcMDw+XFxcXD9cXFxcfFxcXFwvXFxcXHMhYCYqKClcXCdcIjo7XScsXG5cdFdpbkV4Y2x1ZGVkU3RhcnRQYXRoQ2hhcmFjdGVyc0NsYXVzZSA9ICdbXlxcXFwwPD5cXFxcP1xcXFx8XFxcXC9cXFxccyFgJiooKVxcXFxbXFxcXF1cXCdcIjo7XScsXG59XG5cbi8qKlxuICogQSByZWdleCB0aGF0IG1hdGNoZXMgbm9uLVdpbmRvd3MgcGF0aHMsIHN1Y2ggYXMgYC9mb29gLCBgfi9mb29gLCBgLi9mb29gLCBgLi4vZm9vYCBhbmRcbiAqIGBmb28vYmFyYC5cbiAqL1xuY29uc3QgdW5peExvY2FsTGlua0NsYXVzZSA9ICcoPzooPzonICsgUmVnZXhQYXRoQ29uc3RhbnRzLlBhdGhQcmVmaXggKyAnfCg/OicgKyBSZWdleFBhdGhDb25zdGFudHMuRXhjbHVkZWRTdGFydFBhdGhDaGFyYWN0ZXJzQ2xhdXNlICsgUmVnZXhQYXRoQ29uc3RhbnRzLkV4Y2x1ZGVkUGF0aENoYXJhY3RlcnNDbGF1c2UgKyAnKikpPyg/OicgKyBSZWdleFBhdGhDb25zdGFudHMuUGF0aFNlcGFyYXRvckNsYXVzZSArICcoPzonICsgUmVnZXhQYXRoQ29uc3RhbnRzLkV4Y2x1ZGVkUGF0aENoYXJhY3RlcnNDbGF1c2UgKyAnKSspKyknO1xuXG4vKipcbiAqIEEgcmVnZXggY2xhdXNlIHRoYXQgbWF0Y2hlcyB0aGUgc3RhcnQgb2YgYW4gYWJzb2x1dGUgcGF0aCBvbiBXaW5kb3dzLCBzdWNoIGFzOiBgQzpgLCBgYzpgLFxuICogYGZpbGU6Ly8vYzpgICh1cmkpIGFuZCBgXFxcXD9cXEM6YCAoVU5DIHBhdGgpLlxuICovXG5leHBvcnQgY29uc3Qgd2luRHJpdmVQcmVmaXggPSAnKD86XFxcXFxcXFxcXFxcXFxcXFxcXFw/XFxcXFxcXFx8ZmlsZTpcXFxcL1xcXFwvXFxcXC8pP1thLXpBLVpdOic7XG5cbi8qKlxuICogQSByZWdleCB0aGF0IG1hdGNoZXMgV2luZG93cyBwYXRocywgc3VjaCBhcyBgXFxcXD9cXGM6XFxmb29gLCBgYzpcXGZvb2AsIGB+XFxmb29gLCBgLlxcZm9vYCwgYC4uXFxmb29gXG4gKiBhbmQgYGZvb1xcYmFyYC5cbiAqL1xuY29uc3Qgd2luTG9jYWxMaW5rQ2xhdXNlID0gJyg/Oig/OicgKyBgKD86JHt3aW5Ecml2ZVByZWZpeH18JHtSZWdleFBhdGhDb25zdGFudHMuV2luT3RoZXJQYXRoUHJlZml4fSlgICsgJ3woPzonICsgUmVnZXhQYXRoQ29uc3RhbnRzLldpbkV4Y2x1ZGVkU3RhcnRQYXRoQ2hhcmFjdGVyc0NsYXVzZSArIFJlZ2V4UGF0aENvbnN0YW50cy5XaW5FeGNsdWRlZFBhdGhDaGFyYWN0ZXJzQ2xhdXNlICsgJyopKT8oPzonICsgUmVnZXhQYXRoQ29uc3RhbnRzLldpblBhdGhTZXBhcmF0b3JDbGF1c2UgKyAnKD86JyArIFJlZ2V4UGF0aENvbnN0YW50cy5XaW5FeGNsdWRlZFBhdGhDaGFyYWN0ZXJzQ2xhdXNlICsgJykrKSspJztcblxuZnVuY3Rpb24gZGV0ZWN0UGF0aHNOb1N1ZmZpeChsaW5lOiBzdHJpbmcsIG9zOiBPcGVyYXRpbmdTeXN0ZW0pOiBJUGFyc2VkTGlua1tdIHtcblx0Y29uc3QgcmVzdWx0czogSVBhcnNlZExpbmtbXSA9IFtdO1xuXG5cdGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChvcyA9PT0gT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MgPyB3aW5Mb2NhbExpbmtDbGF1c2UgOiB1bml4TG9jYWxMaW5rQ2xhdXNlLCAnZycpO1xuXHRsZXQgbWF0Y2g7XG5cdHdoaWxlICgobWF0Y2ggPSByZWdleC5leGVjKGxpbmUpKSAhPT0gbnVsbCkge1xuXHRcdGxldCB0ZXh0ID0gbWF0Y2hbMF07XG5cdFx0bGV0IGluZGV4ID0gbWF0Y2guaW5kZXg7XG5cdFx0aWYgKCF0ZXh0KSB7XG5cdFx0XHQvLyBTb21ldGhpbmcgbWF0Y2hlZCBidXQgZG9lcyBub3QgY29tcGx5IHdpdGggdGhlIGdpdmVuIG1hdGNoIGluZGV4LCBzaW5jZSB0aGlzIHdvdWxkXG5cdFx0XHQvLyBtb3N0IGxpa2VseSBhIGJ1ZyB0aGUgcmVnZXggaXRzZWxmIHdlIHNpbXBseSBkbyBub3RoaW5nIGhlcmVcblx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdC8vIEFkanVzdCB0aGUgbGluayByYW5nZSB0byBleGNsdWRlIGEvIGFuZCBiLyBpZiBpdCBsb29rcyBsaWtlIGEgZ2l0IGRpZmZcblx0XHRpZiAoXG5cdFx0XHQvLyAtLS0gYS9mb28vYmFyXG5cdFx0XHQvLyArKysgYi9mb28vYmFyXG5cdFx0XHQoKGxpbmUuc3RhcnRzV2l0aCgnLS0tIGEvJykgfHwgbGluZS5zdGFydHNXaXRoKCcrKysgYi8nKSkgJiYgaW5kZXggPT09IDQpIHx8XG5cdFx0XHQvLyBkaWZmIC0tZ2l0IGEvZm9vL2JhciBiL2Zvby9iYXJcblx0XHRcdChsaW5lLnN0YXJ0c1dpdGgoJ2RpZmYgLS1naXQnKSAmJiAodGV4dC5zdGFydHNXaXRoKCdhLycpIHx8IHRleHQuc3RhcnRzV2l0aCgnYi8nKSkpXG5cdFx0KSB7XG5cdFx0XHR0ZXh0ID0gdGV4dC5zdWJzdHJpbmcoMik7XG5cdFx0XHRpbmRleCArPSAyO1xuXHRcdH1cblxuXHRcdHJlc3VsdHMucHVzaCh7XG5cdFx0XHRwYXRoOiB7XG5cdFx0XHRcdGluZGV4LFxuXHRcdFx0XHR0ZXh0XG5cdFx0XHR9LFxuXHRcdFx0cHJlZml4OiB1bmRlZmluZWQsXG5cdFx0XHRzdWZmaXg6IHVuZGVmaW5lZFxuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIHJlc3VsdHM7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFXQSxTQUFTLFlBQVk7QUFDckIsU0FBUyx1QkFBdUI7QUF5QmhDLE1BQU0scUJBQXFCLElBQUksS0FBYSxNQUFNLHdCQUF3QixJQUFJLENBQUM7QUFJL0UsTUFBTSxrQkFBa0IsSUFBSSxLQUFhLE1BQU0sd0JBQXdCLEtBQUssQ0FBQztBQUU3RSxTQUFTLHdCQUF3QixTQUFrQjtBQUNsRCxNQUFJLEtBQUs7QUFDVCxNQUFJLEtBQUs7QUFDVCxNQUFJLE1BQU07QUFDVixNQUFJLE1BQU07QUFDVixXQUFTLElBQVk7QUFDcEIsV0FBTyxTQUFTLElBQUk7QUFBQSxFQUNyQjtBQUNBLFdBQVMsSUFBWTtBQUNwQixXQUFPLFNBQVMsSUFBSTtBQUFBLEVBQ3JCO0FBQ0EsV0FBUyxLQUFhO0FBQ3JCLFdBQU8sWUFBWSxLQUFLO0FBQUEsRUFDekI7QUFDQSxXQUFTLEtBQWE7QUFDckIsV0FBTyxZQUFZLEtBQUs7QUFBQSxFQUN6QjtBQUVBLFFBQU0sWUFBWSxVQUFVLE1BQU07QUFhbEMsUUFBTSw0QkFBNEI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFrQmpDLHFCQUFxQixFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsVUFBVSxHQUFHLENBQUMsUUFBUSxHQUFHLENBQUMsU0FBUztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBbUJ0RSwrQkFBK0IsRUFBRSxDQUFDLE9BQU8sR0FBRyxDQUFDLHVDQUF1QyxFQUFFLENBQUMsT0FBTyxHQUFHLENBQUMsU0FBUztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBYTNHLGVBQWUsRUFBRSxDQUFDLGVBQWUsRUFBRSxDQUFDLGVBQWU7QUFBQSxFQUNwRDtBQUVBLFFBQU0sZUFBZSwwQkFFbkIsS0FBSyxHQUFHLEVBRVIsUUFBUSxNQUFNLElBQUksTUFBUSxJQUFJO0FBRWhDLFNBQU8sSUFBSSxPQUFPLElBQUksWUFBWSxLQUFLLFVBQVUsU0FBWSxHQUFHO0FBQ2pFO0FBTU8sU0FBUyxpQkFBaUIsTUFBc0I7QUFDdEQsUUFBTSxTQUFTLGNBQWMsSUFBSSxHQUFHO0FBQ3BDLE1BQUksQ0FBQyxRQUFRO0FBQ1osV0FBTztBQUFBLEVBQ1I7QUFDQSxTQUFPLEtBQUssVUFBVSxHQUFHLE9BQU8sS0FBSztBQUN0QztBQU1PLFNBQVMsc0JBQXNCLE1BQXNCO0FBRTNELFFBQU0sUUFBUSxLQUFLLFdBQVcsU0FBUyxJQUFJLElBQUk7QUFDL0MsUUFBTSxRQUFRLEtBQUssUUFBUSxLQUFLLEtBQUs7QUFDckMsTUFBSSxVQUFVLElBQUk7QUFDakIsV0FBTztBQUFBLEVBQ1I7QUFDQSxTQUFPLEtBQUssVUFBVSxHQUFHLEtBQUs7QUFDL0I7QUFFTyxTQUFTLG1CQUFtQixNQUE2QjtBQUcvRCxNQUFJO0FBQ0osUUFBTSxVQUF5QixDQUFDO0FBQ2hDLGtCQUFnQixNQUFNLFlBQVk7QUFDbEMsVUFBUSxRQUFRLGdCQUFnQixNQUFNLEtBQUssSUFBSSxPQUFPLE1BQU07QUFDM0QsVUFBTSxTQUFTLGFBQWEsS0FBSztBQUNqQyxRQUFJLFdBQVcsTUFBTTtBQUNwQjtBQUFBLElBQ0Q7QUFDQSxZQUFRLEtBQUssTUFBTTtBQUFBLEVBQ3BCO0FBQ0EsU0FBTztBQUNSO0FBTU8sU0FBUyxjQUFjLE1BQWtDO0FBQy9ELFNBQU8sYUFBYSxtQkFBbUIsTUFBTSxLQUFLLElBQUksQ0FBQztBQUN4RDtBQUVPLFNBQVMsYUFBYSxPQUFtRDtBQUMvRSxRQUFNLFNBQVMsT0FBTztBQUN0QixNQUFJLENBQUMsVUFBVSxNQUFNLFNBQVMsR0FBRztBQUNoQyxXQUFPO0FBQUEsRUFDUjtBQUNBLFNBQU87QUFBQSxJQUNOLEtBQUssaUJBQWlCLE9BQU8sUUFBUSxPQUFPLFFBQVEsT0FBTyxJQUFJO0FBQUEsSUFDL0QsS0FBSyxpQkFBaUIsT0FBTyxRQUFRLE9BQU8sUUFBUSxPQUFPLElBQUk7QUFBQSxJQUMvRCxRQUFRLGlCQUFpQixPQUFPLFdBQVcsT0FBTyxXQUFXLE9BQU8sT0FBTztBQUFBLElBQzNFLFFBQVEsaUJBQWlCLE9BQU8sV0FBVyxPQUFPLFdBQVcsT0FBTyxPQUFPO0FBQUEsSUFDM0UsUUFBUSxFQUFFLE9BQU8sTUFBTSxPQUFPLE1BQU0sTUFBTSxDQUFDLEVBQUU7QUFBQSxFQUM5QztBQUNEO0FBRUEsU0FBUyxpQkFBaUIsT0FBK0M7QUFDeEUsTUFBSSxVQUFVLFFBQVc7QUFDeEIsV0FBTztBQUFBLEVBQ1I7QUFDQSxTQUFPLFNBQVMsS0FBSztBQUN0QjtBQU1BLE1BQU0sK0JBQStCO0FBRTlCLFNBQVMsWUFBWSxNQUFjLElBQXFCO0FBRTlELFFBQU0sVUFBVSxxQkFBcUIsSUFBSTtBQUd6QyxRQUFNLGdCQUFnQixvQkFBb0IsTUFBTSxFQUFFO0FBQ2xELG1CQUFpQixTQUFTLGFBQWE7QUFFdkMsU0FBTztBQUNSO0FBRUEsU0FBUyxpQkFBaUIsTUFBcUIsVUFBeUI7QUFDdkUsTUFBSSxLQUFLLFdBQVcsR0FBRztBQUN0QixTQUFLLEtBQUssR0FBRyxRQUFRO0FBQUEsRUFDdEI7QUFDQSxhQUFXLFFBQVEsVUFBVTtBQUM1QixpQkFBYSxNQUFNLE1BQU0sR0FBRyxLQUFLLE1BQU07QUFBQSxFQUN4QztBQUNEO0FBRUEsU0FBUyxhQUFhLE1BQXFCLFNBQXNCLEtBQWEsTUFBYztBQUMzRixNQUFJLEtBQUssV0FBVyxHQUFHO0FBQ3RCLFNBQUssS0FBSyxPQUFPO0FBQ2pCO0FBQUEsRUFDRDtBQUNBLE1BQUksTUFBTSxNQUFNO0FBQ2Y7QUFBQSxFQUNEO0FBRUEsUUFBTSxNQUFNLEtBQUssT0FBTyxNQUFNLFFBQVEsQ0FBQztBQUN2QyxNQUNDLE9BQU8sS0FBSyxVQUNYLFFBQVEsS0FBSyxRQUFRLEtBQUssR0FBRyxFQUFFLEtBQUssVUFBVSxRQUFRLEtBQUssUUFBUSxLQUFLLFFBQVEsS0FBSyxNQUFNLENBQUMsRUFBRSxLQUFLLFFBQ25HO0FBRUQsUUFDQyxPQUFPLEtBQUssVUFDWCxRQUFRLEtBQUssUUFBUSxRQUFRLEtBQUssS0FBSyxTQUFTLEtBQUssR0FBRyxFQUFFLEtBQUssVUFBVSxRQUFRLEtBQUssUUFBUSxLQUFLLFFBQVEsS0FBSyxNQUFNLENBQUMsRUFBRSxLQUFLLFFBQVEsS0FBSyxNQUFNLENBQUMsRUFBRSxLQUFLLEtBQUssU0FDOUo7QUFDRCxXQUFLLE9BQU8sS0FBSyxHQUFHLE9BQU87QUFBQSxJQUM1QjtBQUNBO0FBQUEsRUFDRDtBQUNBLE1BQUksUUFBUSxLQUFLLFFBQVEsS0FBSyxHQUFHLEVBQUUsS0FBSyxPQUFPO0FBQzlDLGlCQUFhLE1BQU0sU0FBUyxNQUFNLEdBQUcsSUFBSTtBQUFBLEVBQzFDLE9BQU87QUFDTixpQkFBYSxNQUFNLFNBQVMsS0FBSyxNQUFNLENBQUM7QUFBQSxFQUN6QztBQUNEO0FBRUEsU0FBUyxxQkFBcUIsTUFBNkI7QUFDMUQsUUFBTSxVQUF5QixDQUFDO0FBR2hDLFFBQU0sV0FBVyxtQkFBbUIsSUFBSTtBQUN4QyxhQUFXLFVBQVUsVUFBVTtBQUM5QixVQUFNLGVBQWUsS0FBSyxVQUFVLEdBQUcsT0FBTyxPQUFPLEtBQUs7QUFDMUQsVUFBTSxvQkFBb0IsYUFBYSxNQUFNLDRCQUE0QjtBQUN6RSxRQUFJLHFCQUFxQixrQkFBa0IsVUFBVSxVQUFhLGtCQUFrQixRQUFRLE1BQU07QUFDakcsVUFBSSxpQkFBaUIsa0JBQWtCO0FBQ3ZDLFVBQUksT0FBTyxrQkFBa0IsT0FBTztBQUdwQyxVQUFJLFNBQXdDO0FBQzVDLFlBQU0sY0FBYyxLQUFLLE1BQU0sbUJBQW1CO0FBQ2xELFVBQUksYUFBYSxRQUFRLFFBQVE7QUFDaEMsaUJBQVM7QUFBQSxVQUNSLE9BQU87QUFBQSxVQUNQLE1BQU0sWUFBWSxPQUFPO0FBQUEsUUFDMUI7QUFDQSxlQUFPLEtBQUssVUFBVSxPQUFPLEtBQUssTUFBTTtBQUd4QyxZQUFJLEtBQUssS0FBSyxFQUFFLFdBQVcsR0FBRztBQUM3QjtBQUFBLFFBQ0Q7QUFXQSxZQUFJLFlBQVksT0FBTyxPQUFPLFNBQVMsR0FBRztBQUN6QyxjQUFJLE9BQU8sT0FBTyxLQUFLLENBQUMsRUFBRSxNQUFNLE1BQU0sS0FBSyxZQUFZLE9BQU8sT0FBTyxZQUFZLE9BQU8sT0FBTyxTQUFTLENBQUMsTUFBTSxPQUFPLE9BQU8sS0FBSyxDQUFDLEdBQUc7QUFDckksa0JBQU0sbUJBQW1CLFlBQVksT0FBTyxPQUFPLFNBQVM7QUFDNUQsbUJBQU8sU0FBUztBQUNoQixtQkFBTyxPQUFPLFlBQVksT0FBTyxPQUFPLFlBQVksT0FBTyxPQUFPLFNBQVMsQ0FBQztBQUM1RSw4QkFBa0I7QUFBQSxVQUNuQjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQ0EsY0FBUSxLQUFLO0FBQUEsUUFDWixNQUFNO0FBQUEsVUFDTCxPQUFPLGtCQUFrQixRQUFRLEtBQUssVUFBVTtBQUFBLFVBQ2hELE1BQU07QUFBQSxRQUNQO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGO0FBQUEsRUFDRDtBQUVBLFNBQU87QUFDUjtBQUVBLElBQUsscUJBQUwsa0JBQUtBLHdCQUFMO0FBQ0MsRUFBQUEsb0JBQUEsZ0JBQWE7QUFDYixFQUFBQSxvQkFBQSx5QkFBc0I7QUFHdEIsRUFBQUEsb0JBQUEsa0NBQStCO0FBQy9CLEVBQUFBLG9CQUFBLHVDQUFvQztBQUVwQyxFQUFBQSxvQkFBQSx3QkFBcUI7QUFDckIsRUFBQUEsb0JBQUEsNEJBQXlCO0FBQ3pCLEVBQUFBLG9CQUFBLHFDQUFrQztBQUNsQyxFQUFBQSxvQkFBQSwwQ0FBdUM7QUFYbkMsU0FBQUE7QUFBQSxHQUFBO0FBa0JMLE1BQU0sc0JBQXNCO0FBTXJCLE1BQU0saUJBQWlCO0FBTTlCLE1BQU0scUJBQXFCLFlBQWlCLGNBQWMsSUFBSSxzQ0FBcUM7QUFFbkcsU0FBUyxvQkFBb0IsTUFBYyxJQUFvQztBQUM5RSxRQUFNLFVBQXlCLENBQUM7QUFFaEMsUUFBTSxRQUFRLElBQUksT0FBTyxPQUFPLGdCQUFnQixVQUFVLHFCQUFxQixxQkFBcUIsR0FBRztBQUN2RyxNQUFJO0FBQ0osVUFBUSxRQUFRLE1BQU0sS0FBSyxJQUFJLE9BQU8sTUFBTTtBQUMzQyxRQUFJLE9BQU8sTUFBTSxDQUFDO0FBQ2xCLFFBQUksUUFBUSxNQUFNO0FBQ2xCLFFBQUksQ0FBQyxNQUFNO0FBR1Y7QUFBQSxJQUNEO0FBR0E7QUFBQTtBQUFBO0FBQUEsT0FHRyxLQUFLLFdBQVcsUUFBUSxLQUFLLEtBQUssV0FBVyxRQUFRLE1BQU0sVUFBVTtBQUFBLE1BRXRFLEtBQUssV0FBVyxZQUFZLE1BQU0sS0FBSyxXQUFXLElBQUksS0FBSyxLQUFLLFdBQVcsSUFBSTtBQUFBLE1BQy9FO0FBQ0QsYUFBTyxLQUFLLFVBQVUsQ0FBQztBQUN2QixlQUFTO0FBQUEsSUFDVjtBQUVBLFlBQVEsS0FBSztBQUFBLE1BQ1osTUFBTTtBQUFBLFFBQ0w7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsUUFBUTtBQUFBLE1BQ1IsUUFBUTtBQUFBLElBQ1QsQ0FBQztBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQ1I7IiwKICAibmFtZXMiOiBbIlJlZ2V4UGF0aENvbnN0YW50cyJdCn0K
