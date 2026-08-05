import * as fs from "fs";
import { tmpdir } from "os";
import { getRandomTestPath } from "./testUtils.js";
import { Promises } from "../../node/pfs.js";
import { SnapshotContext, assertSnapshot } from "../common/snapshot.js";
import { URI } from "../../common/uri.js";
import * as path from "path";
import { assertThrowsAsync, ensureNoDisposablesAreLeakedInTestSuite } from "../common/utils.js";
suite("snapshot", () => {
  let testDir;
  ensureNoDisposablesAreLeakedInTestSuite();
  setup(function() {
    testDir = getRandomTestPath(tmpdir(), "vsctests", "snapshot");
    return fs.promises.mkdir(testDir, { recursive: true });
  });
  teardown(function() {
    return Promises.rm(testDir);
  });
  const makeContext = (test2) => {
    return new class extends SnapshotContext {
      constructor() {
        super(test2);
        this.snapshotsDir = URI.file(testDir);
      }
    }();
  };
  const snapshotFileTree = async () => {
    let str = "";
    const printDir = async (dir, indent) => {
      const children = await Promises.readdir(dir);
      for (const child of children) {
        const p = path.join(dir, child);
        if ((await fs.promises.stat(p)).isFile()) {
          const content = await fs.promises.readFile(p, "utf-8");
          str += `${" ".repeat(indent)}${child}:
`;
          for (const line of content.split("\n")) {
            str += `${" ".repeat(indent + 2)}${line}
`;
          }
        } else {
          str += `${" ".repeat(indent)}${child}/
`;
          await printDir(p, indent + 2);
        }
      }
    };
    await printDir(testDir, 0);
    await assertSnapshot(str);
  };
  test("creates a snapshot", async () => {
    const ctx = makeContext({
      file: "foo/bar",
      fullTitle: () => "hello world!"
    });
    await ctx.assert({ cool: true });
    await snapshotFileTree();
  });
  test("validates a snapshot", async () => {
    const ctx1 = makeContext({
      file: "foo/bar",
      fullTitle: () => "hello world!"
    });
    await ctx1.assert({ cool: true });
    const ctx2 = makeContext({
      file: "foo/bar",
      fullTitle: () => "hello world!"
    });
    await ctx2.assert({ cool: true });
    const ctx3 = makeContext({
      file: "foo/bar",
      fullTitle: () => "hello world!"
    });
    await assertThrowsAsync(() => ctx3.assert({ cool: false }));
  });
  test("cleans up old snapshots", async () => {
    const ctx1 = makeContext({
      file: "foo/bar",
      fullTitle: () => "hello world!"
    });
    await ctx1.assert({ cool: true });
    await ctx1.assert({ nifty: true });
    await ctx1.assert({ customName: 1 }, { name: "thirdTest", extension: "txt" });
    await ctx1.assert({ customName: 2 }, { name: "fourthTest" });
    await snapshotFileTree();
    const ctx2 = makeContext({
      file: "foo/bar",
      fullTitle: () => "hello world!"
    });
    await ctx2.assert({ cool: true });
    await ctx2.assert({ customName: 1 }, { name: "thirdTest" });
    await ctx2.removeOldSnapshots();
    await snapshotFileTree();
  });
  test("formats object nicely", async () => {
    const circular = {};
    circular.a = circular;
    await assertSnapshot([
      1,
      true,
      void 0,
      null,
      123n,
      Symbol("heyo"),
      "hello",
      { hello: "world" },
      circular,
      /* @__PURE__ */ new Map([["hello", 1], ["goodbye", 2]]),
      /* @__PURE__ */ new Set([1, 2, 3]),
      function helloWorld() {
      },
      /hello/g,
      new Array(10).fill("long string".repeat(10)),
      { [Symbol.for("debug.description")]() {
        return `Range [1 -> 5]`;
      } }
    ]);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3Qvbm9kZS9zbmFwc2hvdC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgdG1wZGlyIH0gZnJvbSAnb3MnO1xuaW1wb3J0IHsgZ2V0UmFuZG9tVGVzdFBhdGggfSBmcm9tICcuL3Rlc3RVdGlscy5qcyc7XG5pbXBvcnQgeyBQcm9taXNlcyB9IGZyb20gJy4uLy4uL25vZGUvcGZzLmpzJztcbmltcG9ydCB7IFNuYXBzaG90Q29udGV4dCwgYXNzZXJ0U25hcHNob3QgfSBmcm9tICcuLi9jb21tb24vc25hcHNob3QuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgYXNzZXJ0VGhyb3dzQXN5bmMsIGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uL2NvbW1vbi91dGlscy5qcyc7XG5cbi8vIHRlc3RzIGZvciBzbmFwc2hvdCBhcmUgaW4gTm9kZSBzbyB0aGF0IHdlIGNhbiB1c2UgbmF0aXZlIEZTIG9wZXJhdGlvbnMgdG9cbi8vIHNldCB1cCBhbmQgdmFsaWRhdGUgdGhpbmdzLlxuLy9cbi8vIFVzZXMgc25hcHNob3RzIGZvciB0ZXN0aW5nIHNuYXBzaG90cy4gSXQncyBzbmFwY2VwdGlvbiFcblxuc3VpdGUoJ3NuYXBzaG90JywgKCkgPT4ge1xuXHRsZXQgdGVzdERpcjogc3RyaW5nO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHNldHVwKGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0RGlyID0gZ2V0UmFuZG9tVGVzdFBhdGgodG1wZGlyKCksICd2c2N0ZXN0cycsICdzbmFwc2hvdCcpO1xuXHRcdHJldHVybiBmcy5wcm9taXNlcy5ta2Rpcih0ZXN0RGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblx0fSk7XG5cblx0dGVhcmRvd24oZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiBQcm9taXNlcy5ybSh0ZXN0RGlyKTtcblx0fSk7XG5cblx0Y29uc3QgbWFrZUNvbnRleHQgPSAodGVzdDogUGFydGlhbDxNb2NoYS5UZXN0PiB8IHVuZGVmaW5lZCkgPT4ge1xuXHRcdHJldHVybiBuZXcgY2xhc3MgZXh0ZW5kcyBTbmFwc2hvdENvbnRleHQge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHRlc3QgYXMgTW9jaGEuVGVzdCk7XG5cdFx0XHRcdHRoaXMuc25hcHNob3RzRGlyID0gVVJJLmZpbGUodGVzdERpcik7XG5cdFx0XHR9XG5cdFx0fTtcblx0fTtcblxuXHRjb25zdCBzbmFwc2hvdEZpbGVUcmVlID0gYXN5bmMgKCkgPT4ge1xuXHRcdGxldCBzdHIgPSAnJztcblxuXHRcdGNvbnN0IHByaW50RGlyID0gYXN5bmMgKGRpcjogc3RyaW5nLCBpbmRlbnQ6IG51bWJlcikgPT4ge1xuXHRcdFx0Y29uc3QgY2hpbGRyZW4gPSBhd2FpdCBQcm9taXNlcy5yZWFkZGlyKGRpcik7XG5cdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG5cdFx0XHRcdGNvbnN0IHAgPSBwYXRoLmpvaW4oZGlyLCBjaGlsZCk7XG5cdFx0XHRcdGlmICgoYXdhaXQgZnMucHJvbWlzZXMuc3RhdChwKSkuaXNGaWxlKCkpIHtcblx0XHRcdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgZnMucHJvbWlzZXMucmVhZEZpbGUocCwgJ3V0Zi04Jyk7XG5cdFx0XHRcdFx0c3RyICs9IGAkeycgJy5yZXBlYXQoaW5kZW50KX0ke2NoaWxkfTpcXG5gO1xuXHRcdFx0XHRcdGZvciAoY29uc3QgbGluZSBvZiBjb250ZW50LnNwbGl0KCdcXG4nKSkge1xuXHRcdFx0XHRcdFx0c3RyICs9IGAkeycgJy5yZXBlYXQoaW5kZW50ICsgMil9JHtsaW5lfVxcbmA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHN0ciArPSBgJHsnICcucmVwZWF0KGluZGVudCl9JHtjaGlsZH0vXFxuYDtcblx0XHRcdFx0XHRhd2FpdCBwcmludERpcihwLCBpbmRlbnQgKyAyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRhd2FpdCBwcmludERpcih0ZXN0RGlyLCAwKTtcblx0XHRhd2FpdCBhc3NlcnRTbmFwc2hvdChzdHIpO1xuXHR9O1xuXG5cdHRlc3QoJ2NyZWF0ZXMgYSBzbmFwc2hvdCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjdHggPSBtYWtlQ29udGV4dCh7XG5cdFx0XHRmaWxlOiAnZm9vL2JhcicsXG5cdFx0XHRmdWxsVGl0bGU6ICgpID0+ICdoZWxsbyB3b3JsZCEnXG5cdFx0fSk7XG5cblx0XHRhd2FpdCBjdHguYXNzZXJ0KHsgY29vbDogdHJ1ZSB9KTtcblx0XHRhd2FpdCBzbmFwc2hvdEZpbGVUcmVlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3ZhbGlkYXRlcyBhIHNuYXBzaG90JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGN0eDEgPSBtYWtlQ29udGV4dCh7XG5cdFx0XHRmaWxlOiAnZm9vL2JhcicsXG5cdFx0XHRmdWxsVGl0bGU6ICgpID0+ICdoZWxsbyB3b3JsZCEnXG5cdFx0fSk7XG5cblx0XHRhd2FpdCBjdHgxLmFzc2VydCh7IGNvb2w6IHRydWUgfSk7XG5cblx0XHRjb25zdCBjdHgyID0gbWFrZUNvbnRleHQoe1xuXHRcdFx0ZmlsZTogJ2Zvby9iYXInLFxuXHRcdFx0ZnVsbFRpdGxlOiAoKSA9PiAnaGVsbG8gd29ybGQhJ1xuXHRcdH0pO1xuXG5cdFx0Ly8gc2hvdWxkIHBhc3M6XG5cdFx0YXdhaXQgY3R4Mi5hc3NlcnQoeyBjb29sOiB0cnVlIH0pO1xuXG5cdFx0Y29uc3QgY3R4MyA9IG1ha2VDb250ZXh0KHtcblx0XHRcdGZpbGU6ICdmb28vYmFyJyxcblx0XHRcdGZ1bGxUaXRsZTogKCkgPT4gJ2hlbGxvIHdvcmxkISdcblx0XHR9KTtcblxuXHRcdC8vIHNob3VsZCBmYWlsOlxuXHRcdGF3YWl0IGFzc2VydFRocm93c0FzeW5jKCgpID0+IGN0eDMuYXNzZXJ0KHsgY29vbDogZmFsc2UgfSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdjbGVhbnMgdXAgb2xkIHNuYXBzaG90cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjdHgxID0gbWFrZUNvbnRleHQoe1xuXHRcdFx0ZmlsZTogJ2Zvby9iYXInLFxuXHRcdFx0ZnVsbFRpdGxlOiAoKSA9PiAnaGVsbG8gd29ybGQhJ1xuXHRcdH0pO1xuXG5cdFx0YXdhaXQgY3R4MS5hc3NlcnQoeyBjb29sOiB0cnVlIH0pO1xuXHRcdGF3YWl0IGN0eDEuYXNzZXJ0KHsgbmlmdHk6IHRydWUgfSk7XG5cdFx0YXdhaXQgY3R4MS5hc3NlcnQoeyBjdXN0b21OYW1lOiAxIH0sIHsgbmFtZTogJ3RoaXJkVGVzdCcsIGV4dGVuc2lvbjogJ3R4dCcgfSk7XG5cdFx0YXdhaXQgY3R4MS5hc3NlcnQoeyBjdXN0b21OYW1lOiAyIH0sIHsgbmFtZTogJ2ZvdXJ0aFRlc3QnIH0pO1xuXG5cdFx0YXdhaXQgc25hcHNob3RGaWxlVHJlZSgpO1xuXG5cdFx0Y29uc3QgY3R4MiA9IG1ha2VDb250ZXh0KHtcblx0XHRcdGZpbGU6ICdmb28vYmFyJyxcblx0XHRcdGZ1bGxUaXRsZTogKCkgPT4gJ2hlbGxvIHdvcmxkISdcblx0XHR9KTtcblxuXHRcdGF3YWl0IGN0eDIuYXNzZXJ0KHsgY29vbDogdHJ1ZSB9KTtcblx0XHRhd2FpdCBjdHgyLmFzc2VydCh7IGN1c3RvbU5hbWU6IDEgfSwgeyBuYW1lOiAndGhpcmRUZXN0JyB9KTtcblx0XHRhd2FpdCBjdHgyLnJlbW92ZU9sZFNuYXBzaG90cygpO1xuXG5cdFx0YXdhaXQgc25hcHNob3RGaWxlVHJlZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdmb3JtYXRzIG9iamVjdCBuaWNlbHknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY2lyY3VsYXI6IGFueSA9IHt9O1xuXHRcdGNpcmN1bGFyLmEgPSBjaXJjdWxhcjtcblxuXHRcdGF3YWl0IGFzc2VydFNuYXBzaG90KFtcblx0XHRcdDEsXG5cdFx0XHR0cnVlLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0bnVsbCxcblx0XHRcdDEyM24sXG5cdFx0XHRTeW1ib2woJ2hleW8nKSxcblx0XHRcdCdoZWxsbycsXG5cdFx0XHR7IGhlbGxvOiAnd29ybGQnIH0sXG5cdFx0XHRjaXJjdWxhcixcblx0XHRcdG5ldyBNYXAoW1snaGVsbG8nLCAxXSwgWydnb29kYnllJywgMl1dKSxcblx0XHRcdG5ldyBTZXQoWzEsIDIsIDNdKSxcblx0XHRcdGZ1bmN0aW9uIGhlbGxvV29ybGQoKSB7IH0sXG5cdFx0XHQvaGVsbG8vZyxcblx0XHRcdG5ldyBBcnJheSgxMCkuZmlsbCgnbG9uZyBzdHJpbmcnLnJlcGVhdCgxMCkpLFxuXHRcdFx0eyBbU3ltYm9sLmZvcignZGVidWcuZGVzY3JpcHRpb24nKV0oKSB7IHJldHVybiBgUmFuZ2UgWzEgLT4gNV1gOyB9IH0sXG5cdFx0XSk7XG5cdH0pO1xufSk7XG4iXSwK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
