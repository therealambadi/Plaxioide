import assert from "assert";
import * as path from "../../../../../base/common/path.js";
import * as platform from "../../../../../base/common/platform.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { QueryType } from "../../common/search.js";
import { Engine as FileSearchEngine, FileWalker } from "../../node/fileSearch.js";
import { flakySuite } from "../../../../../base/test/node/testUtils.js";
import { FileAccess } from "../../../../../base/common/network.js";
const TEST_FIXTURES = path.normalize(FileAccess.asFileUri("vs/workbench/services/search/test/node/fixtures").fsPath);
const EXAMPLES_FIXTURES = URI.file(path.join(TEST_FIXTURES, "examples"));
const MORE_FIXTURES = URI.file(path.join(TEST_FIXTURES, "more"));
const TEST_ROOT_FOLDER = { folder: URI.file(TEST_FIXTURES) };
const ROOT_FOLDER_QUERY = [
  TEST_ROOT_FOLDER
];
const ROOT_FOLDER_QUERY_36438 = [
  { folder: URI.file(path.normalize(FileAccess.asFileUri("vs/workbench/services/search/test/node/fixtures2/36438").fsPath)) }
];
const MULTIROOT_QUERIES = [
  { folder: EXAMPLES_FIXTURES },
  { folder: MORE_FIXTURES }
];
flakySuite("FileSearchEngine", () => {
  test("Files: *.js", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      filePattern: "*.js"
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 4);
      done();
    });
  });
  test("Files: maxResults", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      maxResults: 1
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 1);
      done();
    });
  });
  test("Files: maxResults without Ripgrep", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      maxResults: 1
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 1);
      done();
    });
  });
  test("Files: exists", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      includePattern: { "**/file.txt": true },
      exists: true
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error, complete) => {
      assert.ok(!error);
      assert.strictEqual(count, 0);
      assert.ok(complete.limitHit);
      done();
    });
  });
  test("Files: not exists", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      includePattern: { "**/nofile.txt": true },
      exists: true
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error, complete) => {
      assert.ok(!error);
      assert.strictEqual(count, 0);
      assert.ok(!complete.limitHit);
      done();
    });
  });
  test("Files: exists without Ripgrep", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      includePattern: { "**/file.txt": true },
      exists: true
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error, complete) => {
      assert.ok(!error);
      assert.strictEqual(count, 0);
      assert.ok(complete.limitHit);
      done();
    });
  });
  test("Files: not exists without Ripgrep", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      includePattern: { "**/nofile.txt": true },
      exists: true
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error, complete) => {
      assert.ok(!error);
      assert.strictEqual(count, 0);
      assert.ok(!complete.limitHit);
      done();
    });
  });
  test("Files: examples/com*", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      filePattern: path.join("examples", "com*")
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 1);
      done();
    });
  });
  test("Files: examples (fuzzy)", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      filePattern: "xl"
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 7);
      done();
    });
  });
  test("Files: multiroot", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: MULTIROOT_QUERIES,
      filePattern: "file"
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 3);
      done();
    });
  });
  test("Files: multiroot with includePattern and maxResults", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: MULTIROOT_QUERIES,
      maxResults: 1,
      includePattern: {
        "*.txt": true,
        "*.js": true
      }
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error, complete) => {
      assert.ok(!error);
      assert.strictEqual(count, 1);
      done();
    });
  });
  test("Files: multiroot with includePattern and exists", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: MULTIROOT_QUERIES,
      exists: true,
      includePattern: {
        "*.txt": true,
        "*.js": true
      }
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error, complete) => {
      assert.ok(!error);
      assert.strictEqual(count, 0);
      assert.ok(complete.limitHit);
      done();
    });
  });
  test("Files: NPE (CamelCase)", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      filePattern: "NullPE"
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 1);
      done();
    });
  });
  test("Files: *.*", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      filePattern: "*.*"
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 14);
      done();
    });
  });
  test("Files: *.as", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      filePattern: "*.as"
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 0);
      done();
    });
  });
  test("Files: *.* without derived", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      filePattern: "site.*",
      excludePattern: { "**/*.css": { "when": "$(basename).less" } }
    });
    let count = 0;
    let res;
    engine.search((result) => {
      if (result) {
        count++;
      }
      res = result;
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 1);
      assert.strictEqual(path.basename(res.relativePath), "site.less");
      done();
    });
  });
  test("Files: *.* exclude folder without wildcard", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      filePattern: "*.*",
      excludePattern: { "examples": true }
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 8);
      done();
    });
  });
  test("Files: exclude folder without wildcard #36438", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY_36438,
      excludePattern: { "modules": true }
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 1);
      done();
    });
  });
  test("Files: include folder without wildcard #36438", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY_36438,
      includePattern: { "modules/**": true }
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 1);
      done();
    });
  });
  test("Files: *.* exclude folder with leading wildcard", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      filePattern: "*.*",
      excludePattern: { "**/examples": true }
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 8);
      done();
    });
  });
  test("Files: *.* exclude folder with trailing wildcard", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      filePattern: "*.*",
      excludePattern: { "examples/**": true }
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 8);
      done();
    });
  });
  test("Files: *.* exclude with unicode", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      filePattern: "*.*",
      excludePattern: { "**/\xFCm laut\u6C49\u8BED": true }
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 13);
      done();
    });
  });
  test("Files: *.* include with unicode", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      filePattern: "*.*",
      includePattern: { "**/\xFCm laut\u6C49\u8BED/*": true }
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 1);
      done();
    });
  });
  test("Files: multiroot with exclude", function(done) {
    const folderQueries = [
      {
        folder: EXAMPLES_FIXTURES,
        excludePattern: [{
          pattern: { "**/anotherfile.txt": true }
        }]
      },
      {
        folder: MORE_FIXTURES,
        excludePattern: [{
          pattern: {
            "**/file.txt": true
          }
        }]
      }
    ];
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries,
      filePattern: "*"
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 5);
      done();
    });
  });
  test("Files: Unicode and Spaces", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      filePattern: "\u6C49\u8BED"
    });
    let count = 0;
    let res;
    engine.search((result) => {
      if (result) {
        count++;
      }
      res = result;
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 1);
      assert.strictEqual(path.basename(res.relativePath), "\u6C49\u8BED.txt");
      done();
    });
  });
  test("Files: no results", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      filePattern: "nofilematch"
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 0);
      done();
    });
  });
  test("Files: relative path matched once", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      filePattern: path.normalize(path.join("examples", "company.js"))
    });
    let count = 0;
    let res;
    engine.search((result) => {
      if (result) {
        count++;
      }
      res = result;
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 1);
      assert.strictEqual(path.basename(res.relativePath), "company.js");
      done();
    });
  });
  test("Files: Include pattern, single files", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      includePattern: {
        "site.css": true,
        "examples/company.js": true,
        "examples/subfolder/subfile.txt": true
      }
    });
    const res = [];
    engine.search((result) => {
      res.push(result);
    }, () => {
    }, (error) => {
      assert.ok(!error);
      const basenames = res.map((r) => path.basename(r.relativePath));
      assert.ok(basenames.indexOf("site.css") !== -1, `site.css missing in ${JSON.stringify(basenames)}`);
      assert.ok(basenames.indexOf("company.js") !== -1, `company.js missing in ${JSON.stringify(basenames)}`);
      assert.ok(basenames.indexOf("subfile.txt") !== -1, `subfile.txt missing in ${JSON.stringify(basenames)}`);
      done();
    });
  });
  test("Files: extraFiles only", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: [],
      extraFileResources: [
        URI.file(path.normalize(path.join(FileAccess.asFileUri("vs/workbench/services/search/test/node/fixtures").fsPath, "site.css"))),
        URI.file(path.normalize(path.join(FileAccess.asFileUri("vs/workbench/services/search/test/node/fixtures").fsPath, "examples", "company.js"))),
        URI.file(path.normalize(path.join(FileAccess.asFileUri("vs/workbench/services/search/test/node/fixtures").fsPath, "index.html")))
      ],
      filePattern: "*.js"
    });
    let count = 0;
    let res;
    engine.search((result) => {
      if (result) {
        count++;
      }
      res = result;
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 1);
      assert.strictEqual(path.basename(res.relativePath), "company.js");
      done();
    });
  });
  test("Files: extraFiles only (with include)", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: [],
      extraFileResources: [
        URI.file(path.normalize(path.join(FileAccess.asFileUri("vs/workbench/services/search/test/node/fixtures").fsPath, "site.css"))),
        URI.file(path.normalize(path.join(FileAccess.asFileUri("vs/workbench/services/search/test/node/fixtures").fsPath, "examples", "company.js"))),
        URI.file(path.normalize(path.join(FileAccess.asFileUri("vs/workbench/services/search/test/node/fixtures").fsPath, "index.html")))
      ],
      filePattern: "*.*",
      includePattern: { "**/*.css": true }
    });
    let count = 0;
    let res;
    engine.search((result) => {
      if (result) {
        count++;
      }
      res = result;
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 1);
      assert.strictEqual(path.basename(res.relativePath), "site.css");
      done();
    });
  });
  test("Files: extraFiles only (with exclude)", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: [],
      extraFileResources: [
        URI.file(path.normalize(path.join(FileAccess.asFileUri("vs/workbench/services/search/test/node/fixtures").fsPath, "site.css"))),
        URI.file(path.normalize(path.join(FileAccess.asFileUri("vs/workbench/services/search/test/node/fixtures").fsPath, "examples", "company.js"))),
        URI.file(path.normalize(path.join(FileAccess.asFileUri("vs/workbench/services/search/test/node/fixtures").fsPath, "index.html")))
      ],
      filePattern: "*.*",
      excludePattern: { "**/*.css": true }
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 2);
      done();
    });
  });
  test("Files: no dupes in nested folders", function(done) {
    const engine = new FileSearchEngine({
      type: QueryType.File,
      folderQueries: [
        { folder: EXAMPLES_FIXTURES },
        { folder: joinPath(EXAMPLES_FIXTURES, "subfolder") }
      ],
      filePattern: "subfile.txt"
    });
    let count = 0;
    engine.search((result) => {
      if (result) {
        count++;
      }
    }, () => {
    }, (error) => {
      assert.ok(!error);
      assert.strictEqual(count, 1);
      done();
    });
  });
});
flakySuite("FileWalker", () => {
  (platform.isWindows ? test.skip : test)("Find: exclude subfolder", function(done) {
    const file0 = "./more/file.txt";
    const file1 = "./examples/subfolder/subfile.txt";
    const walker = new FileWalker({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      excludePattern: { "**/something": true }
    });
    const cmd1 = walker.spawnFindCmd(TEST_ROOT_FOLDER);
    walker.readStdout(cmd1, "utf8", (err1, stdout1) => {
      assert.strictEqual(err1, null);
      assert.notStrictEqual(stdout1.split("\n").indexOf(file0), -1, stdout1);
      assert.notStrictEqual(stdout1.split("\n").indexOf(file1), -1, stdout1);
      const walker2 = new FileWalker({
        type: QueryType.File,
        folderQueries: ROOT_FOLDER_QUERY,
        excludePattern: { "**/subfolder": true }
      });
      const cmd2 = walker2.spawnFindCmd(TEST_ROOT_FOLDER);
      walker2.readStdout(cmd2, "utf8", (err2, stdout2) => {
        assert.strictEqual(err2, null);
        assert.notStrictEqual(stdout1.split("\n").indexOf(file0), -1, stdout1);
        assert.strictEqual(stdout2.split("\n").indexOf(file1), -1, stdout2);
        done();
      });
    });
  });
  (platform.isWindows ? test.skip : test)("Find: folder excludes", function(done) {
    const folderQueries = [
      {
        folder: URI.file(TEST_FIXTURES),
        excludePattern: [{
          pattern: { "**/subfolder": true }
        }]
      }
    ];
    const file0 = "./more/file.txt";
    const file1 = "./examples/subfolder/subfile.txt";
    const walker = new FileWalker({ type: QueryType.File, folderQueries });
    const cmd1 = walker.spawnFindCmd(folderQueries[0]);
    walker.readStdout(cmd1, "utf8", (err1, stdout1) => {
      assert.strictEqual(err1, null);
      assert(outputContains(stdout1, file0), stdout1);
      assert(!outputContains(stdout1, file1), stdout1);
      done();
    });
  });
  (platform.isWindows ? test.skip : test)("Find: exclude multiple folders", function(done) {
    const file0 = "./index.html";
    const file1 = "./examples/small.js";
    const file2 = "./more/file.txt";
    const walker = new FileWalker({ type: QueryType.File, folderQueries: ROOT_FOLDER_QUERY, excludePattern: { "**/something": true } });
    const cmd1 = walker.spawnFindCmd(TEST_ROOT_FOLDER);
    walker.readStdout(cmd1, "utf8", (err1, stdout1) => {
      assert.strictEqual(err1, null);
      assert.notStrictEqual(stdout1.split("\n").indexOf(file0), -1, stdout1);
      assert.notStrictEqual(stdout1.split("\n").indexOf(file1), -1, stdout1);
      assert.notStrictEqual(stdout1.split("\n").indexOf(file2), -1, stdout1);
      const walker2 = new FileWalker({ type: QueryType.File, folderQueries: ROOT_FOLDER_QUERY, excludePattern: { "{**/examples,**/more}": true } });
      const cmd2 = walker2.spawnFindCmd(TEST_ROOT_FOLDER);
      walker2.readStdout(cmd2, "utf8", (err2, stdout2) => {
        assert.strictEqual(err2, null);
        assert.notStrictEqual(stdout1.split("\n").indexOf(file0), -1, stdout1);
        assert.strictEqual(stdout2.split("\n").indexOf(file1), -1, stdout2);
        assert.strictEqual(stdout2.split("\n").indexOf(file2), -1, stdout2);
        done();
      });
    });
  });
  (platform.isWindows ? test.skip : test)("Find: exclude folder path suffix", function(done) {
    const file0 = "./examples/company.js";
    const file1 = "./examples/subfolder/subfile.txt";
    const walker = new FileWalker({ type: QueryType.File, folderQueries: ROOT_FOLDER_QUERY, excludePattern: { "**/examples/something": true } });
    const cmd1 = walker.spawnFindCmd(TEST_ROOT_FOLDER);
    walker.readStdout(cmd1, "utf8", (err1, stdout1) => {
      assert.strictEqual(err1, null);
      assert.notStrictEqual(stdout1.split("\n").indexOf(file0), -1, stdout1);
      assert.notStrictEqual(stdout1.split("\n").indexOf(file1), -1, stdout1);
      const walker2 = new FileWalker({ type: QueryType.File, folderQueries: ROOT_FOLDER_QUERY, excludePattern: { "**/examples/subfolder": true } });
      const cmd2 = walker2.spawnFindCmd(TEST_ROOT_FOLDER);
      walker2.readStdout(cmd2, "utf8", (err2, stdout2) => {
        assert.strictEqual(err2, null);
        assert.notStrictEqual(stdout1.split("\n").indexOf(file0), -1, stdout1);
        assert.strictEqual(stdout2.split("\n").indexOf(file1), -1, stdout2);
        done();
      });
    });
  });
  (platform.isWindows ? test.skip : test)("Find: exclude subfolder path suffix", function(done) {
    const file0 = "./examples/subfolder/subfile.txt";
    const file1 = "./examples/subfolder/anotherfolder/anotherfile.txt";
    const walker = new FileWalker({ type: QueryType.File, folderQueries: ROOT_FOLDER_QUERY, excludePattern: { "**/subfolder/something": true } });
    const cmd1 = walker.spawnFindCmd(TEST_ROOT_FOLDER);
    walker.readStdout(cmd1, "utf8", (err1, stdout1) => {
      assert.strictEqual(err1, null);
      assert.notStrictEqual(stdout1.split("\n").indexOf(file0), -1, stdout1);
      assert.notStrictEqual(stdout1.split("\n").indexOf(file1), -1, stdout1);
      const walker2 = new FileWalker({ type: QueryType.File, folderQueries: ROOT_FOLDER_QUERY, excludePattern: { "**/subfolder/anotherfolder": true } });
      const cmd2 = walker2.spawnFindCmd(TEST_ROOT_FOLDER);
      walker2.readStdout(cmd2, "utf8", (err2, stdout2) => {
        assert.strictEqual(err2, null);
        assert.notStrictEqual(stdout1.split("\n").indexOf(file0), -1, stdout1);
        assert.strictEqual(stdout2.split("\n").indexOf(file1), -1, stdout2);
        done();
      });
    });
  });
  (platform.isWindows ? test.skip : test)("Find: exclude folder path", function(done) {
    const file0 = "./examples/company.js";
    const file1 = "./examples/subfolder/subfile.txt";
    const walker = new FileWalker({ type: QueryType.File, folderQueries: ROOT_FOLDER_QUERY, excludePattern: { "examples/something": true } });
    const cmd1 = walker.spawnFindCmd(TEST_ROOT_FOLDER);
    walker.readStdout(cmd1, "utf8", (err1, stdout1) => {
      assert.strictEqual(err1, null);
      assert.notStrictEqual(stdout1.split("\n").indexOf(file0), -1, stdout1);
      assert.notStrictEqual(stdout1.split("\n").indexOf(file1), -1, stdout1);
      const walker2 = new FileWalker({ type: QueryType.File, folderQueries: ROOT_FOLDER_QUERY, excludePattern: { "examples/subfolder": true } });
      const cmd2 = walker2.spawnFindCmd(TEST_ROOT_FOLDER);
      walker2.readStdout(cmd2, "utf8", (err2, stdout2) => {
        assert.strictEqual(err2, null);
        assert.notStrictEqual(stdout1.split("\n").indexOf(file0), -1, stdout1);
        assert.strictEqual(stdout2.split("\n").indexOf(file1), -1, stdout2);
        done();
      });
    });
  });
  (platform.isWindows ? test.skip : test)("Find: exclude combination of paths", function(done) {
    const filesIn = [
      "./examples/subfolder/subfile.txt",
      "./examples/company.js",
      "./index.html"
    ];
    const filesOut = [
      "./examples/subfolder/anotherfolder/anotherfile.txt",
      "./more/file.txt"
    ];
    const walker = new FileWalker({
      type: QueryType.File,
      folderQueries: ROOT_FOLDER_QUERY,
      excludePattern: {
        "**/subfolder/anotherfolder": true,
        "**/something/else": true,
        "**/more": true,
        "**/andmore": true
      }
    });
    const cmd1 = walker.spawnFindCmd(TEST_ROOT_FOLDER);
    walker.readStdout(cmd1, "utf8", (err1, stdout1) => {
      assert.strictEqual(err1, null);
      for (const fileIn of filesIn) {
        assert.notStrictEqual(stdout1.split("\n").indexOf(fileIn), -1, stdout1);
      }
      for (const fileOut of filesOut) {
        assert.strictEqual(stdout1.split("\n").indexOf(fileOut), -1, stdout1);
      }
      done();
    });
  });
  function outputContains(stdout, ...files) {
    const lines = stdout.split("\n");
    return files.every((file) => lines.indexOf(file) >= 0);
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL3Rlc3Qvbm9kZS9zZWFyY2guaW50ZWdyYXRpb25UZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJRm9sZGVyUXVlcnksIFF1ZXJ5VHlwZSwgSVJhd0ZpbGVNYXRjaCB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgRW5naW5lIGFzIEZpbGVTZWFyY2hFbmdpbmUsIEZpbGVXYWxrZXIgfSBmcm9tICcuLi8uLi9ub2RlL2ZpbGVTZWFyY2guanMnO1xuaW1wb3J0IHsgZmxha3lTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9ub2RlL3Rlc3RVdGlscy5qcyc7XG5pbXBvcnQgeyBGaWxlQWNjZXNzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5cbmNvbnN0IFRFU1RfRklYVFVSRVMgPSBwYXRoLm5vcm1hbGl6ZShGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvd29ya2JlbmNoL3NlcnZpY2VzL3NlYXJjaC90ZXN0L25vZGUvZml4dHVyZXMnKS5mc1BhdGgpO1xuY29uc3QgRVhBTVBMRVNfRklYVFVSRVMgPSBVUkkuZmlsZShwYXRoLmpvaW4oVEVTVF9GSVhUVVJFUywgJ2V4YW1wbGVzJykpO1xuY29uc3QgTU9SRV9GSVhUVVJFUyA9IFVSSS5maWxlKHBhdGguam9pbihURVNUX0ZJWFRVUkVTLCAnbW9yZScpKTtcbmNvbnN0IFRFU1RfUk9PVF9GT0xERVI6IElGb2xkZXJRdWVyeSA9IHsgZm9sZGVyOiBVUkkuZmlsZShURVNUX0ZJWFRVUkVTKSB9O1xuY29uc3QgUk9PVF9GT0xERVJfUVVFUlk6IElGb2xkZXJRdWVyeVtdID0gW1xuXHRURVNUX1JPT1RfRk9MREVSXG5dO1xuXG5jb25zdCBST09UX0ZPTERFUl9RVUVSWV8zNjQzODogSUZvbGRlclF1ZXJ5W10gPSBbXG5cdHsgZm9sZGVyOiBVUkkuZmlsZShwYXRoLm5vcm1hbGl6ZShGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvd29ya2JlbmNoL3NlcnZpY2VzL3NlYXJjaC90ZXN0L25vZGUvZml4dHVyZXMyLzM2NDM4JykuZnNQYXRoKSkgfVxuXTtcblxuY29uc3QgTVVMVElST09UX1FVRVJJRVM6IElGb2xkZXJRdWVyeVtdID0gW1xuXHR7IGZvbGRlcjogRVhBTVBMRVNfRklYVFVSRVMgfSxcblx0eyBmb2xkZXI6IE1PUkVfRklYVFVSRVMgfVxuXTtcblxuZmxha3lTdWl0ZSgnRmlsZVNlYXJjaEVuZ2luZScsICgpID0+IHtcblxuXHR0ZXN0KCdGaWxlczogKi5qcycsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGZpbGVQYXR0ZXJuOiAnKi5qcydcblx0XHR9KTtcblxuXHRcdGxldCBjb3VudCA9IDA7XG5cdFx0ZW5naW5lLnNlYXJjaCgocmVzdWx0KSA9PiB7XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGNvdW50Kys7XG5cdFx0XHR9XG5cdFx0fSwgKCkgPT4geyB9LCAoZXJyb3IpID0+IHtcblx0XHRcdGFzc2VydC5vayghZXJyb3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCA0KTtcblx0XHRcdGRvbmUoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRmlsZXM6IG1heFJlc3VsdHMnLCBmdW5jdGlvbiAoZG9uZTogKCkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IGVuZ2luZSA9IG5ldyBGaWxlU2VhcmNoRW5naW5lKHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdFx0XHRtYXhSZXN1bHRzOiAxXG5cdFx0fSk7XG5cblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGVuZ2luZS5zZWFyY2goKHJlc3VsdCkgPT4ge1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRjb3VudCsrO1xuXHRcdFx0fVxuXHRcdH0sICgpID0+IHsgfSwgKGVycm9yKSA9PiB7XG5cdFx0XHRhc3NlcnQub2soIWVycm9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMSk7XG5cdFx0XHRkb25lKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGVzOiBtYXhSZXN1bHRzIHdpdGhvdXQgUmlwZ3JlcCcsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdG1heFJlc3VsdHM6IDEsXG5cdFx0fSk7XG5cblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGVuZ2luZS5zZWFyY2goKHJlc3VsdCkgPT4ge1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRjb3VudCsrO1xuXHRcdFx0fVxuXHRcdH0sICgpID0+IHsgfSwgKGVycm9yKSA9PiB7XG5cdFx0XHRhc3NlcnQub2soIWVycm9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMSk7XG5cdFx0XHRkb25lKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGVzOiBleGlzdHMnLCBmdW5jdGlvbiAoZG9uZTogKCkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IGVuZ2luZSA9IG5ldyBGaWxlU2VhcmNoRW5naW5lKHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdFx0XHRpbmNsdWRlUGF0dGVybjogeyAnKiovZmlsZS50eHQnOiB0cnVlIH0sXG5cdFx0XHRleGlzdHM6IHRydWVcblx0XHR9KTtcblxuXHRcdGxldCBjb3VudCA9IDA7XG5cdFx0ZW5naW5lLnNlYXJjaCgocmVzdWx0KSA9PiB7XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGNvdW50Kys7XG5cdFx0XHR9XG5cdFx0fSwgKCkgPT4geyB9LCAoZXJyb3IsIGNvbXBsZXRlKSA9PiB7XG5cdFx0XHRhc3NlcnQub2soIWVycm9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMCk7XG5cdFx0XHRhc3NlcnQub2soY29tcGxldGUubGltaXRIaXQpO1xuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlczogbm90IGV4aXN0cycsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGluY2x1ZGVQYXR0ZXJuOiB7ICcqKi9ub2ZpbGUudHh0JzogdHJ1ZSB9LFxuXHRcdFx0ZXhpc3RzOiB0cnVlXG5cdFx0fSk7XG5cblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGVuZ2luZS5zZWFyY2goKHJlc3VsdCkgPT4ge1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRjb3VudCsrO1xuXHRcdFx0fVxuXHRcdH0sICgpID0+IHsgfSwgKGVycm9yLCBjb21wbGV0ZSkgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKCFlcnJvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDApO1xuXHRcdFx0YXNzZXJ0Lm9rKCFjb21wbGV0ZS5saW1pdEhpdCk7XG5cdFx0XHRkb25lKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGVzOiBleGlzdHMgd2l0aG91dCBSaXBncmVwJywgZnVuY3Rpb24gKGRvbmU6ICgpID0+IHZvaWQpIHtcblx0XHRjb25zdCBlbmdpbmUgPSBuZXcgRmlsZVNlYXJjaEVuZ2luZSh7XG5cdFx0XHR0eXBlOiBRdWVyeVR5cGUuRmlsZSxcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLFxuXHRcdFx0aW5jbHVkZVBhdHRlcm46IHsgJyoqL2ZpbGUudHh0JzogdHJ1ZSB9LFxuXHRcdFx0ZXhpc3RzOiB0cnVlLFxuXHRcdH0pO1xuXG5cdFx0bGV0IGNvdW50ID0gMDtcblx0XHRlbmdpbmUuc2VhcmNoKChyZXN1bHQpID0+IHtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0Y291bnQrKztcblx0XHRcdH1cblx0XHR9LCAoKSA9PiB7IH0sIChlcnJvciwgY29tcGxldGUpID0+IHtcblx0XHRcdGFzc2VydC5vayghZXJyb3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAwKTtcblx0XHRcdGFzc2VydC5vayhjb21wbGV0ZS5saW1pdEhpdCk7XG5cdFx0XHRkb25lKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGVzOiBub3QgZXhpc3RzIHdpdGhvdXQgUmlwZ3JlcCcsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGluY2x1ZGVQYXR0ZXJuOiB7ICcqKi9ub2ZpbGUudHh0JzogdHJ1ZSB9LFxuXHRcdFx0ZXhpc3RzOiB0cnVlLFxuXHRcdH0pO1xuXG5cdFx0bGV0IGNvdW50ID0gMDtcblx0XHRlbmdpbmUuc2VhcmNoKChyZXN1bHQpID0+IHtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0Y291bnQrKztcblx0XHRcdH1cblx0XHR9LCAoKSA9PiB7IH0sIChlcnJvciwgY29tcGxldGUpID0+IHtcblx0XHRcdGFzc2VydC5vayghZXJyb3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAwKTtcblx0XHRcdGFzc2VydC5vayghY29tcGxldGUubGltaXRIaXQpO1xuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlczogZXhhbXBsZXMvY29tKicsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGZpbGVQYXR0ZXJuOiBwYXRoLmpvaW4oJ2V4YW1wbGVzJywgJ2NvbSonKVxuXHRcdH0pO1xuXG5cdFx0bGV0IGNvdW50ID0gMDtcblx0XHRlbmdpbmUuc2VhcmNoKChyZXN1bHQpID0+IHtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0Y291bnQrKztcblx0XHRcdH1cblx0XHR9LCAoKSA9PiB7IH0sIChlcnJvcikgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKCFlcnJvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDEpO1xuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlczogZXhhbXBsZXMgKGZ1enp5KScsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGZpbGVQYXR0ZXJuOiAneGwnXG5cdFx0fSk7XG5cblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGVuZ2luZS5zZWFyY2goKHJlc3VsdCkgPT4ge1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRjb3VudCsrO1xuXHRcdFx0fVxuXHRcdH0sICgpID0+IHsgfSwgKGVycm9yKSA9PiB7XG5cdFx0XHRhc3NlcnQub2soIWVycm9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgNyk7XG5cdFx0XHRkb25lKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGVzOiBtdWx0aXJvb3QnLCBmdW5jdGlvbiAoZG9uZTogKCkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IGVuZ2luZSA9IG5ldyBGaWxlU2VhcmNoRW5naW5lKHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXHRcdFx0Zm9sZGVyUXVlcmllczogTVVMVElST09UX1FVRVJJRVMsXG5cdFx0XHRmaWxlUGF0dGVybjogJ2ZpbGUnXG5cdFx0fSk7XG5cblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGVuZ2luZS5zZWFyY2goKHJlc3VsdCkgPT4ge1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRjb3VudCsrO1xuXHRcdFx0fVxuXHRcdH0sICgpID0+IHsgfSwgKGVycm9yKSA9PiB7XG5cdFx0XHRhc3NlcnQub2soIWVycm9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMyk7XG5cdFx0XHRkb25lKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGVzOiBtdWx0aXJvb3Qgd2l0aCBpbmNsdWRlUGF0dGVybiBhbmQgbWF4UmVzdWx0cycsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBNVUxUSVJPT1RfUVVFUklFUyxcblx0XHRcdG1heFJlc3VsdHM6IDEsXG5cdFx0XHRpbmNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHQnKi50eHQnOiB0cnVlLFxuXHRcdFx0XHQnKi5qcyc6IHRydWVcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGVuZ2luZS5zZWFyY2goKHJlc3VsdCkgPT4ge1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRjb3VudCsrO1xuXHRcdFx0fVxuXHRcdH0sICgpID0+IHsgfSwgKGVycm9yLCBjb21wbGV0ZSkgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKCFlcnJvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDEpO1xuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlczogbXVsdGlyb290IHdpdGggaW5jbHVkZVBhdHRlcm4gYW5kIGV4aXN0cycsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBNVUxUSVJPT1RfUVVFUklFUyxcblx0XHRcdGV4aXN0czogdHJ1ZSxcblx0XHRcdGluY2x1ZGVQYXR0ZXJuOiB7XG5cdFx0XHRcdCcqLnR4dCc6IHRydWUsXG5cdFx0XHRcdCcqLmpzJzogdHJ1ZVxuXHRcdFx0fSxcblx0XHR9KTtcblxuXHRcdGxldCBjb3VudCA9IDA7XG5cdFx0ZW5naW5lLnNlYXJjaCgocmVzdWx0KSA9PiB7XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGNvdW50Kys7XG5cdFx0XHR9XG5cdFx0fSwgKCkgPT4geyB9LCAoZXJyb3IsIGNvbXBsZXRlKSA9PiB7XG5cdFx0XHRhc3NlcnQub2soIWVycm9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMCk7XG5cdFx0XHRhc3NlcnQub2soY29tcGxldGUubGltaXRIaXQpO1xuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlczogTlBFIChDYW1lbENhc2UpJywgZnVuY3Rpb24gKGRvbmU6ICgpID0+IHZvaWQpIHtcblx0XHRjb25zdCBlbmdpbmUgPSBuZXcgRmlsZVNlYXJjaEVuZ2luZSh7XG5cdFx0XHR0eXBlOiBRdWVyeVR5cGUuRmlsZSxcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLFxuXHRcdFx0ZmlsZVBhdHRlcm46ICdOdWxsUEUnXG5cdFx0fSk7XG5cblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGVuZ2luZS5zZWFyY2goKHJlc3VsdCkgPT4ge1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRjb3VudCsrO1xuXHRcdFx0fVxuXHRcdH0sICgpID0+IHsgfSwgKGVycm9yKSA9PiB7XG5cdFx0XHRhc3NlcnQub2soIWVycm9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMSk7XG5cdFx0XHRkb25lKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGVzOiAqLionLCBmdW5jdGlvbiAoZG9uZTogKCkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IGVuZ2luZSA9IG5ldyBGaWxlU2VhcmNoRW5naW5lKHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdFx0XHRmaWxlUGF0dGVybjogJyouKidcblx0XHR9KTtcblxuXHRcdGxldCBjb3VudCA9IDA7XG5cdFx0ZW5naW5lLnNlYXJjaCgocmVzdWx0KSA9PiB7XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGNvdW50Kys7XG5cdFx0XHR9XG5cdFx0fSwgKCkgPT4geyB9LCAoZXJyb3IpID0+IHtcblx0XHRcdGFzc2VydC5vayghZXJyb3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAxNCk7XG5cdFx0XHRkb25lKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGVzOiAqLmFzJywgZnVuY3Rpb24gKGRvbmU6ICgpID0+IHZvaWQpIHtcblx0XHRjb25zdCBlbmdpbmUgPSBuZXcgRmlsZVNlYXJjaEVuZ2luZSh7XG5cdFx0XHR0eXBlOiBRdWVyeVR5cGUuRmlsZSxcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLFxuXHRcdFx0ZmlsZVBhdHRlcm46ICcqLmFzJ1xuXHRcdH0pO1xuXG5cdFx0bGV0IGNvdW50ID0gMDtcblx0XHRlbmdpbmUuc2VhcmNoKChyZXN1bHQpID0+IHtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0Y291bnQrKztcblx0XHRcdH1cblx0XHR9LCAoKSA9PiB7IH0sIChlcnJvcikgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKCFlcnJvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDApO1xuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlczogKi4qIHdpdGhvdXQgZGVyaXZlZCcsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGZpbGVQYXR0ZXJuOiAnc2l0ZS4qJyxcblx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiB7ICcqKi8qLmNzcyc6IHsgJ3doZW4nOiAnJChiYXNlbmFtZSkubGVzcycgfSB9XG5cdFx0fSk7XG5cblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGxldCByZXM6IElSYXdGaWxlTWF0Y2g7XG5cdFx0ZW5naW5lLnNlYXJjaCgocmVzdWx0KSA9PiB7XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGNvdW50Kys7XG5cdFx0XHR9XG5cdFx0XHRyZXMgPSByZXN1bHQ7XG5cdFx0fSwgKCkgPT4geyB9LCAoZXJyb3IpID0+IHtcblx0XHRcdGFzc2VydC5vayghZXJyb3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXRoLmJhc2VuYW1lKHJlcy5yZWxhdGl2ZVBhdGgpLCAnc2l0ZS5sZXNzJyk7XG5cdFx0XHRkb25lKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGVzOiAqLiogZXhjbHVkZSBmb2xkZXIgd2l0aG91dCB3aWxkY2FyZCcsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGZpbGVQYXR0ZXJuOiAnKi4qJyxcblx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiB7ICdleGFtcGxlcyc6IHRydWUgfVxuXHRcdH0pO1xuXG5cdFx0bGV0IGNvdW50ID0gMDtcblx0XHRlbmdpbmUuc2VhcmNoKChyZXN1bHQpID0+IHtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0Y291bnQrKztcblx0XHRcdH1cblx0XHR9LCAoKSA9PiB7IH0sIChlcnJvcikgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKCFlcnJvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDgpO1xuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlczogZXhjbHVkZSBmb2xkZXIgd2l0aG91dCB3aWxkY2FyZCAjMzY0MzgnLCBmdW5jdGlvbiAoZG9uZTogKCkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IGVuZ2luZSA9IG5ldyBGaWxlU2VhcmNoRW5naW5lKHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUllfMzY0MzgsXG5cdFx0XHRleGNsdWRlUGF0dGVybjogeyAnbW9kdWxlcyc6IHRydWUgfVxuXHRcdH0pO1xuXG5cdFx0bGV0IGNvdW50ID0gMDtcblx0XHRlbmdpbmUuc2VhcmNoKChyZXN1bHQpID0+IHtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0Y291bnQrKztcblx0XHRcdH1cblx0XHR9LCAoKSA9PiB7IH0sIChlcnJvcikgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKCFlcnJvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDEpO1xuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlczogaW5jbHVkZSBmb2xkZXIgd2l0aG91dCB3aWxkY2FyZCAjMzY0MzgnLCBmdW5jdGlvbiAoZG9uZTogKCkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IGVuZ2luZSA9IG5ldyBGaWxlU2VhcmNoRW5naW5lKHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUllfMzY0MzgsXG5cdFx0XHRpbmNsdWRlUGF0dGVybjogeyAnbW9kdWxlcy8qKic6IHRydWUgfVxuXHRcdH0pO1xuXG5cdFx0bGV0IGNvdW50ID0gMDtcblx0XHRlbmdpbmUuc2VhcmNoKChyZXN1bHQpID0+IHtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0Y291bnQrKztcblx0XHRcdH1cblx0XHR9LCAoKSA9PiB7IH0sIChlcnJvcikgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKCFlcnJvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDEpO1xuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlczogKi4qIGV4Y2x1ZGUgZm9sZGVyIHdpdGggbGVhZGluZyB3aWxkY2FyZCcsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGZpbGVQYXR0ZXJuOiAnKi4qJyxcblx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiB7ICcqKi9leGFtcGxlcyc6IHRydWUgfVxuXHRcdH0pO1xuXG5cdFx0bGV0IGNvdW50ID0gMDtcblx0XHRlbmdpbmUuc2VhcmNoKChyZXN1bHQpID0+IHtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0Y291bnQrKztcblx0XHRcdH1cblx0XHR9LCAoKSA9PiB7IH0sIChlcnJvcikgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKCFlcnJvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDgpO1xuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlczogKi4qIGV4Y2x1ZGUgZm9sZGVyIHdpdGggdHJhaWxpbmcgd2lsZGNhcmQnLCBmdW5jdGlvbiAoZG9uZTogKCkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IGVuZ2luZSA9IG5ldyBGaWxlU2VhcmNoRW5naW5lKHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdFx0XHRmaWxlUGF0dGVybjogJyouKicsXG5cdFx0XHRleGNsdWRlUGF0dGVybjogeyAnZXhhbXBsZXMvKionOiB0cnVlIH1cblx0XHR9KTtcblxuXHRcdGxldCBjb3VudCA9IDA7XG5cdFx0ZW5naW5lLnNlYXJjaCgocmVzdWx0KSA9PiB7XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGNvdW50Kys7XG5cdFx0XHR9XG5cdFx0fSwgKCkgPT4geyB9LCAoZXJyb3IpID0+IHtcblx0XHRcdGFzc2VydC5vayghZXJyb3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCA4KTtcblx0XHRcdGRvbmUoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRmlsZXM6ICouKiBleGNsdWRlIHdpdGggdW5pY29kZScsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGZpbGVQYXR0ZXJuOiAnKi4qJyxcblx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiB7ICcqKi9cdTAwRkNtIGxhdXRcdTZDNDlcdThCRUQnOiB0cnVlIH1cblx0XHR9KTtcblxuXHRcdGxldCBjb3VudCA9IDA7XG5cdFx0ZW5naW5lLnNlYXJjaCgocmVzdWx0KSA9PiB7XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGNvdW50Kys7XG5cdFx0XHR9XG5cdFx0fSwgKCkgPT4geyB9LCAoZXJyb3IpID0+IHtcblx0XHRcdGFzc2VydC5vayghZXJyb3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAxMyk7XG5cdFx0XHRkb25lKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGVzOiAqLiogaW5jbHVkZSB3aXRoIHVuaWNvZGUnLCBmdW5jdGlvbiAoZG9uZTogKCkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IGVuZ2luZSA9IG5ldyBGaWxlU2VhcmNoRW5naW5lKHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdFx0XHRmaWxlUGF0dGVybjogJyouKicsXG5cdFx0XHRpbmNsdWRlUGF0dGVybjogeyAnKiovXHUwMEZDbSBsYXV0XHU2QzQ5XHU4QkVELyonOiB0cnVlIH1cblx0XHR9KTtcblxuXHRcdGxldCBjb3VudCA9IDA7XG5cdFx0ZW5naW5lLnNlYXJjaCgocmVzdWx0KSA9PiB7XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGNvdW50Kys7XG5cdFx0XHR9XG5cdFx0fSwgKCkgPT4geyB9LCAoZXJyb3IpID0+IHtcblx0XHRcdGFzc2VydC5vayghZXJyb3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAxKTtcblx0XHRcdGRvbmUoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRmlsZXM6IG11bHRpcm9vdCB3aXRoIGV4Y2x1ZGUnLCBmdW5jdGlvbiAoZG9uZTogKCkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IGZvbGRlclF1ZXJpZXM6IElGb2xkZXJRdWVyeVtdID0gW1xuXHRcdFx0e1xuXHRcdFx0XHRmb2xkZXI6IEVYQU1QTEVTX0ZJWFRVUkVTLFxuXHRcdFx0XHRleGNsdWRlUGF0dGVybjogW3tcblx0XHRcdFx0XHRwYXR0ZXJuOiB7ICcqKi9hbm90aGVyZmlsZS50eHQnOiB0cnVlIH1cblx0XHRcdFx0fV1cblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGZvbGRlcjogTU9SRV9GSVhUVVJFUyxcblx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IFt7XG5cdFx0XHRcdFx0cGF0dGVybjoge1xuXHRcdFx0XHRcdFx0JyoqL2ZpbGUudHh0JzogdHJ1ZVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fV1cblx0XHRcdH1cblx0XHRdO1xuXG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzLFxuXHRcdFx0ZmlsZVBhdHRlcm46ICcqJ1xuXHRcdH0pO1xuXG5cdFx0bGV0IGNvdW50ID0gMDtcblx0XHRlbmdpbmUuc2VhcmNoKChyZXN1bHQpID0+IHtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0Y291bnQrKztcblx0XHRcdH1cblx0XHR9LCAoKSA9PiB7IH0sIChlcnJvcikgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKCFlcnJvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDUpO1xuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlczogVW5pY29kZSBhbmQgU3BhY2VzJywgZnVuY3Rpb24gKGRvbmU6ICgpID0+IHZvaWQpIHtcblx0XHRjb25zdCBlbmdpbmUgPSBuZXcgRmlsZVNlYXJjaEVuZ2luZSh7XG5cdFx0XHR0eXBlOiBRdWVyeVR5cGUuRmlsZSxcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLFxuXHRcdFx0ZmlsZVBhdHRlcm46ICdcdTZDNDlcdThCRUQnXG5cdFx0fSk7XG5cblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGxldCByZXM6IElSYXdGaWxlTWF0Y2g7XG5cdFx0ZW5naW5lLnNlYXJjaCgocmVzdWx0KSA9PiB7XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGNvdW50Kys7XG5cdFx0XHR9XG5cdFx0XHRyZXMgPSByZXN1bHQ7XG5cdFx0fSwgKCkgPT4geyB9LCAoZXJyb3IpID0+IHtcblx0XHRcdGFzc2VydC5vayghZXJyb3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXRoLmJhc2VuYW1lKHJlcy5yZWxhdGl2ZVBhdGgpLCAnXHU2QzQ5XHU4QkVELnR4dCcpO1xuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlczogbm8gcmVzdWx0cycsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGZpbGVQYXR0ZXJuOiAnbm9maWxlbWF0Y2gnXG5cdFx0fSk7XG5cblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdGVuZ2luZS5zZWFyY2goKHJlc3VsdCkgPT4ge1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRjb3VudCsrO1xuXHRcdFx0fVxuXHRcdH0sICgpID0+IHsgfSwgKGVycm9yKSA9PiB7XG5cdFx0XHRhc3NlcnQub2soIWVycm9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMCk7XG5cdFx0XHRkb25lKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGVzOiByZWxhdGl2ZSBwYXRoIG1hdGNoZWQgb25jZScsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGZpbGVQYXR0ZXJuOiBwYXRoLm5vcm1hbGl6ZShwYXRoLmpvaW4oJ2V4YW1wbGVzJywgJ2NvbXBhbnkuanMnKSlcblx0XHR9KTtcblxuXHRcdGxldCBjb3VudCA9IDA7XG5cdFx0bGV0IHJlczogSVJhd0ZpbGVNYXRjaDtcblx0XHRlbmdpbmUuc2VhcmNoKChyZXN1bHQpID0+IHtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0Y291bnQrKztcblx0XHRcdH1cblx0XHRcdHJlcyA9IHJlc3VsdDtcblx0XHR9LCAoKSA9PiB7IH0sIChlcnJvcikgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKCFlcnJvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhdGguYmFzZW5hbWUocmVzLnJlbGF0aXZlUGF0aCksICdjb21wYW55LmpzJyk7XG5cdFx0XHRkb25lKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGVzOiBJbmNsdWRlIHBhdHRlcm4sIHNpbmdsZSBmaWxlcycsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGluY2x1ZGVQYXR0ZXJuOiB7XG5cdFx0XHRcdCdzaXRlLmNzcyc6IHRydWUsXG5cdFx0XHRcdCdleGFtcGxlcy9jb21wYW55LmpzJzogdHJ1ZSxcblx0XHRcdFx0J2V4YW1wbGVzL3N1YmZvbGRlci9zdWJmaWxlLnR4dCc6IHRydWVcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHJlczogSVJhd0ZpbGVNYXRjaFtdID0gW107XG5cdFx0ZW5naW5lLnNlYXJjaCgocmVzdWx0KSA9PiB7XG5cdFx0XHRyZXMucHVzaChyZXN1bHQpO1xuXHRcdH0sICgpID0+IHsgfSwgKGVycm9yKSA9PiB7XG5cdFx0XHRhc3NlcnQub2soIWVycm9yKTtcblx0XHRcdGNvbnN0IGJhc2VuYW1lcyA9IHJlcy5tYXAociA9PiBwYXRoLmJhc2VuYW1lKHIucmVsYXRpdmVQYXRoKSk7XG5cdFx0XHRhc3NlcnQub2soYmFzZW5hbWVzLmluZGV4T2YoJ3NpdGUuY3NzJykgIT09IC0xLCBgc2l0ZS5jc3MgbWlzc2luZyBpbiAke0pTT04uc3RyaW5naWZ5KGJhc2VuYW1lcyl9YCk7XG5cdFx0XHRhc3NlcnQub2soYmFzZW5hbWVzLmluZGV4T2YoJ2NvbXBhbnkuanMnKSAhPT0gLTEsIGBjb21wYW55LmpzIG1pc3NpbmcgaW4gJHtKU09OLnN0cmluZ2lmeShiYXNlbmFtZXMpfWApO1xuXHRcdFx0YXNzZXJ0Lm9rKGJhc2VuYW1lcy5pbmRleE9mKCdzdWJmaWxlLnR4dCcpICE9PSAtMSwgYHN1YmZpbGUudHh0IG1pc3NpbmcgaW4gJHtKU09OLnN0cmluZ2lmeShiYXNlbmFtZXMpfWApO1xuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlczogZXh0cmFGaWxlcyBvbmx5JywgZnVuY3Rpb24gKGRvbmU6ICgpID0+IHZvaWQpIHtcblx0XHRjb25zdCBlbmdpbmUgPSBuZXcgRmlsZVNlYXJjaEVuZ2luZSh7XG5cdFx0XHR0eXBlOiBRdWVyeVR5cGUuRmlsZSxcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFtdLFxuXHRcdFx0ZXh0cmFGaWxlUmVzb3VyY2VzOiBbXG5cdFx0XHRcdFVSSS5maWxlKHBhdGgubm9ybWFsaXplKHBhdGguam9pbihGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvd29ya2JlbmNoL3NlcnZpY2VzL3NlYXJjaC90ZXN0L25vZGUvZml4dHVyZXMnKS5mc1BhdGgsICdzaXRlLmNzcycpKSksXG5cdFx0XHRcdFVSSS5maWxlKHBhdGgubm9ybWFsaXplKHBhdGguam9pbihGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvd29ya2JlbmNoL3NlcnZpY2VzL3NlYXJjaC90ZXN0L25vZGUvZml4dHVyZXMnKS5mc1BhdGgsICdleGFtcGxlcycsICdjb21wYW55LmpzJykpKSxcblx0XHRcdFx0VVJJLmZpbGUocGF0aC5ub3JtYWxpemUocGF0aC5qb2luKEZpbGVBY2Nlc3MuYXNGaWxlVXJpKCd2cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL3Rlc3Qvbm9kZS9maXh0dXJlcycpLmZzUGF0aCwgJ2luZGV4Lmh0bWwnKSkpXG5cdFx0XHRdLFxuXHRcdFx0ZmlsZVBhdHRlcm46ICcqLmpzJ1xuXHRcdH0pO1xuXG5cdFx0bGV0IGNvdW50ID0gMDtcblx0XHRsZXQgcmVzOiBJUmF3RmlsZU1hdGNoO1xuXHRcdGVuZ2luZS5zZWFyY2goKHJlc3VsdCkgPT4ge1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRjb3VudCsrO1xuXHRcdFx0fVxuXHRcdFx0cmVzID0gcmVzdWx0O1xuXHRcdH0sICgpID0+IHsgfSwgKGVycm9yKSA9PiB7XG5cdFx0XHRhc3NlcnQub2soIWVycm9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGF0aC5iYXNlbmFtZShyZXMucmVsYXRpdmVQYXRoKSwgJ2NvbXBhbnkuanMnKTtcblx0XHRcdGRvbmUoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRmlsZXM6IGV4dHJhRmlsZXMgb25seSAod2l0aCBpbmNsdWRlKScsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZW5naW5lID0gbmV3IEZpbGVTZWFyY2hFbmdpbmUoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBbXSxcblx0XHRcdGV4dHJhRmlsZVJlc291cmNlczogW1xuXHRcdFx0XHRVUkkuZmlsZShwYXRoLm5vcm1hbGl6ZShwYXRoLmpvaW4oRmlsZUFjY2Vzcy5hc0ZpbGVVcmkoJ3ZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9zZWFyY2gvdGVzdC9ub2RlL2ZpeHR1cmVzJykuZnNQYXRoLCAnc2l0ZS5jc3MnKSkpLFxuXHRcdFx0XHRVUkkuZmlsZShwYXRoLm5vcm1hbGl6ZShwYXRoLmpvaW4oRmlsZUFjY2Vzcy5hc0ZpbGVVcmkoJ3ZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9zZWFyY2gvdGVzdC9ub2RlL2ZpeHR1cmVzJykuZnNQYXRoLCAnZXhhbXBsZXMnLCAnY29tcGFueS5qcycpKSksXG5cdFx0XHRcdFVSSS5maWxlKHBhdGgubm9ybWFsaXplKHBhdGguam9pbihGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvd29ya2JlbmNoL3NlcnZpY2VzL3NlYXJjaC90ZXN0L25vZGUvZml4dHVyZXMnKS5mc1BhdGgsICdpbmRleC5odG1sJykpKVxuXHRcdFx0XSxcblx0XHRcdGZpbGVQYXR0ZXJuOiAnKi4qJyxcblx0XHRcdGluY2x1ZGVQYXR0ZXJuOiB7ICcqKi8qLmNzcyc6IHRydWUgfVxuXHRcdH0pO1xuXG5cdFx0bGV0IGNvdW50ID0gMDtcblx0XHRsZXQgcmVzOiBJUmF3RmlsZU1hdGNoO1xuXHRcdGVuZ2luZS5zZWFyY2goKHJlc3VsdCkgPT4ge1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRjb3VudCsrO1xuXHRcdFx0fVxuXHRcdFx0cmVzID0gcmVzdWx0O1xuXHRcdH0sICgpID0+IHsgfSwgKGVycm9yKSA9PiB7XG5cdFx0XHRhc3NlcnQub2soIWVycm9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGF0aC5iYXNlbmFtZShyZXMucmVsYXRpdmVQYXRoKSwgJ3NpdGUuY3NzJyk7XG5cdFx0XHRkb25lKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGVzOiBleHRyYUZpbGVzIG9ubHkgKHdpdGggZXhjbHVkZSknLCBmdW5jdGlvbiAoZG9uZTogKCkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IGVuZ2luZSA9IG5ldyBGaWxlU2VhcmNoRW5naW5lKHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXHRcdFx0Zm9sZGVyUXVlcmllczogW10sXG5cdFx0XHRleHRyYUZpbGVSZXNvdXJjZXM6IFtcblx0XHRcdFx0VVJJLmZpbGUocGF0aC5ub3JtYWxpemUocGF0aC5qb2luKEZpbGVBY2Nlc3MuYXNGaWxlVXJpKCd2cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL3Rlc3Qvbm9kZS9maXh0dXJlcycpLmZzUGF0aCwgJ3NpdGUuY3NzJykpKSxcblx0XHRcdFx0VVJJLmZpbGUocGF0aC5ub3JtYWxpemUocGF0aC5qb2luKEZpbGVBY2Nlc3MuYXNGaWxlVXJpKCd2cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL3Rlc3Qvbm9kZS9maXh0dXJlcycpLmZzUGF0aCwgJ2V4YW1wbGVzJywgJ2NvbXBhbnkuanMnKSkpLFxuXHRcdFx0XHRVUkkuZmlsZShwYXRoLm5vcm1hbGl6ZShwYXRoLmpvaW4oRmlsZUFjY2Vzcy5hc0ZpbGVVcmkoJ3ZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9zZWFyY2gvdGVzdC9ub2RlL2ZpeHR1cmVzJykuZnNQYXRoLCAnaW5kZXguaHRtbCcpKSlcblx0XHRcdF0sXG5cdFx0XHRmaWxlUGF0dGVybjogJyouKicsXG5cdFx0XHRleGNsdWRlUGF0dGVybjogeyAnKiovKi5jc3MnOiB0cnVlIH1cblx0XHR9KTtcblxuXHRcdGxldCBjb3VudCA9IDA7XG5cdFx0ZW5naW5lLnNlYXJjaCgocmVzdWx0KSA9PiB7XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGNvdW50Kys7XG5cdFx0XHR9XG5cdFx0fSwgKCkgPT4geyB9LCAoZXJyb3IpID0+IHtcblx0XHRcdGFzc2VydC5vayghZXJyb3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAyKTtcblx0XHRcdGRvbmUoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRmlsZXM6IG5vIGR1cGVzIGluIG5lc3RlZCBmb2xkZXJzJywgZnVuY3Rpb24gKGRvbmU6ICgpID0+IHZvaWQpIHtcblx0XHRjb25zdCBlbmdpbmUgPSBuZXcgRmlsZVNlYXJjaEVuZ2luZSh7XG5cdFx0XHR0eXBlOiBRdWVyeVR5cGUuRmlsZSxcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFtcblx0XHRcdFx0eyBmb2xkZXI6IEVYQU1QTEVTX0ZJWFRVUkVTIH0sXG5cdFx0XHRcdHsgZm9sZGVyOiBqb2luUGF0aChFWEFNUExFU19GSVhUVVJFUywgJ3N1YmZvbGRlcicpIH1cblx0XHRcdF0sXG5cdFx0XHRmaWxlUGF0dGVybjogJ3N1YmZpbGUudHh0J1xuXHRcdH0pO1xuXG5cdFx0bGV0IGNvdW50ID0gMDtcblx0XHRlbmdpbmUuc2VhcmNoKChyZXN1bHQpID0+IHtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0Y291bnQrKztcblx0XHRcdH1cblx0XHR9LCAoKSA9PiB7IH0sIChlcnJvcikgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKCFlcnJvcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDEpO1xuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5mbGFreVN1aXRlKCdGaWxlV2Fsa2VyJywgKCkgPT4ge1xuXG5cdChwbGF0Zm9ybS5pc1dpbmRvd3MgPyB0ZXN0LnNraXAgOiB0ZXN0KSgnRmluZDogZXhjbHVkZSBzdWJmb2xkZXInLCBmdW5jdGlvbiAoZG9uZTogKCkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IGZpbGUwID0gJy4vbW9yZS9maWxlLnR4dCc7XG5cdFx0Y29uc3QgZmlsZTEgPSAnLi9leGFtcGxlcy9zdWJmb2xkZXIvc3ViZmlsZS50eHQnO1xuXG5cdFx0Y29uc3Qgd2Fsa2VyID0gbmV3IEZpbGVXYWxrZXIoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiB7ICcqKi9zb21ldGhpbmcnOiB0cnVlIH1cblx0XHR9KTtcblx0XHRjb25zdCBjbWQxID0gd2Fsa2VyLnNwYXduRmluZENtZChURVNUX1JPT1RfRk9MREVSKTtcblx0XHR3YWxrZXIucmVhZFN0ZG91dChjbWQxLCAndXRmOCcsIChlcnIxLCBzdGRvdXQxKSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXJyMSwgbnVsbCk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoc3Rkb3V0MSEuc3BsaXQoJ1xcbicpLmluZGV4T2YoZmlsZTApLCAtMSwgc3Rkb3V0MSk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoc3Rkb3V0MSEuc3BsaXQoJ1xcbicpLmluZGV4T2YoZmlsZTEpLCAtMSwgc3Rkb3V0MSk7XG5cblx0XHRcdGNvbnN0IHdhbGtlciA9IG5ldyBGaWxlV2Fsa2VyKHtcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLFxuXHRcdFx0XHRleGNsdWRlUGF0dGVybjogeyAnKiovc3ViZm9sZGVyJzogdHJ1ZSB9XG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IGNtZDIgPSB3YWxrZXIuc3Bhd25GaW5kQ21kKFRFU1RfUk9PVF9GT0xERVIpO1xuXHRcdFx0d2Fsa2VyLnJlYWRTdGRvdXQoY21kMiwgJ3V0ZjgnLCAoZXJyMiwgc3Rkb3V0MikgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXJyMiwgbnVsbCk7XG5cdFx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChzdGRvdXQxIS5zcGxpdCgnXFxuJykuaW5kZXhPZihmaWxlMCksIC0xLCBzdGRvdXQxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0ZG91dDIhLnNwbGl0KCdcXG4nKS5pbmRleE9mKGZpbGUxKSwgLTEsIHN0ZG91dDIpO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0KHBsYXRmb3JtLmlzV2luZG93cyA/IHRlc3Quc2tpcCA6IHRlc3QpKCdGaW5kOiBmb2xkZXIgZXhjbHVkZXMnLCBmdW5jdGlvbiAoZG9uZTogKCkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IGZvbGRlclF1ZXJpZXM6IElGb2xkZXJRdWVyeVtdID0gW1xuXHRcdFx0e1xuXHRcdFx0XHRmb2xkZXI6IFVSSS5maWxlKFRFU1RfRklYVFVSRVMpLFxuXHRcdFx0XHRleGNsdWRlUGF0dGVybjogW3tcblx0XHRcdFx0XHRwYXR0ZXJuOiB7ICcqKi9zdWJmb2xkZXInOiB0cnVlIH1cblx0XHRcdFx0fV1cblx0XHRcdH1cblx0XHRdO1xuXG5cdFx0Y29uc3QgZmlsZTAgPSAnLi9tb3JlL2ZpbGUudHh0Jztcblx0XHRjb25zdCBmaWxlMSA9ICcuL2V4YW1wbGVzL3N1YmZvbGRlci9zdWJmaWxlLnR4dCc7XG5cblx0XHRjb25zdCB3YWxrZXIgPSBuZXcgRmlsZVdhbGtlcih7IHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLCBmb2xkZXJRdWVyaWVzIH0pO1xuXHRcdGNvbnN0IGNtZDEgPSB3YWxrZXIuc3Bhd25GaW5kQ21kKGZvbGRlclF1ZXJpZXNbMF0pO1xuXHRcdHdhbGtlci5yZWFkU3Rkb3V0KGNtZDEsICd1dGY4JywgKGVycjEsIHN0ZG91dDEpID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnIxLCBudWxsKTtcblx0XHRcdGFzc2VydChvdXRwdXRDb250YWlucyhzdGRvdXQxISwgZmlsZTApLCBzdGRvdXQxKTtcblx0XHRcdGFzc2VydCghb3V0cHV0Q29udGFpbnMoc3Rkb3V0MSEsIGZpbGUxKSwgc3Rkb3V0MSk7XG5cdFx0XHRkb25lKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdChwbGF0Zm9ybS5pc1dpbmRvd3MgPyB0ZXN0LnNraXAgOiB0ZXN0KSgnRmluZDogZXhjbHVkZSBtdWx0aXBsZSBmb2xkZXJzJywgZnVuY3Rpb24gKGRvbmU6ICgpID0+IHZvaWQpIHtcblx0XHRjb25zdCBmaWxlMCA9ICcuL2luZGV4Lmh0bWwnO1xuXHRcdGNvbnN0IGZpbGUxID0gJy4vZXhhbXBsZXMvc21hbGwuanMnO1xuXHRcdGNvbnN0IGZpbGUyID0gJy4vbW9yZS9maWxlLnR4dCc7XG5cblx0XHRjb25zdCB3YWxrZXIgPSBuZXcgRmlsZVdhbGtlcih7IHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLCBmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSwgZXhjbHVkZVBhdHRlcm46IHsgJyoqL3NvbWV0aGluZyc6IHRydWUgfSB9KTtcblx0XHRjb25zdCBjbWQxID0gd2Fsa2VyLnNwYXduRmluZENtZChURVNUX1JPT1RfRk9MREVSKTtcblx0XHR3YWxrZXIucmVhZFN0ZG91dChjbWQxLCAndXRmOCcsIChlcnIxLCBzdGRvdXQxKSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXJyMSwgbnVsbCk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoc3Rkb3V0MSEuc3BsaXQoJ1xcbicpLmluZGV4T2YoZmlsZTApLCAtMSwgc3Rkb3V0MSk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoc3Rkb3V0MSEuc3BsaXQoJ1xcbicpLmluZGV4T2YoZmlsZTEpLCAtMSwgc3Rkb3V0MSk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoc3Rkb3V0MSEuc3BsaXQoJ1xcbicpLmluZGV4T2YoZmlsZTIpLCAtMSwgc3Rkb3V0MSk7XG5cblx0XHRcdGNvbnN0IHdhbGtlciA9IG5ldyBGaWxlV2Fsa2VyKHsgdHlwZTogUXVlcnlUeXBlLkZpbGUsIGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLCBleGNsdWRlUGF0dGVybjogeyAneyoqL2V4YW1wbGVzLCoqL21vcmV9JzogdHJ1ZSB9IH0pO1xuXHRcdFx0Y29uc3QgY21kMiA9IHdhbGtlci5zcGF3bkZpbmRDbWQoVEVTVF9ST09UX0ZPTERFUik7XG5cdFx0XHR3YWxrZXIucmVhZFN0ZG91dChjbWQyLCAndXRmOCcsIChlcnIyLCBzdGRvdXQyKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnIyLCBudWxsKTtcblx0XHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHN0ZG91dDEhLnNwbGl0KCdcXG4nKS5pbmRleE9mKGZpbGUwKSwgLTEsIHN0ZG91dDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3Rkb3V0MiEuc3BsaXQoJ1xcbicpLmluZGV4T2YoZmlsZTEpLCAtMSwgc3Rkb3V0Mik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGRvdXQyIS5zcGxpdCgnXFxuJykuaW5kZXhPZihmaWxlMiksIC0xLCBzdGRvdXQyKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdChwbGF0Zm9ybS5pc1dpbmRvd3MgPyB0ZXN0LnNraXAgOiB0ZXN0KSgnRmluZDogZXhjbHVkZSBmb2xkZXIgcGF0aCBzdWZmaXgnLCBmdW5jdGlvbiAoZG9uZTogKCkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IGZpbGUwID0gJy4vZXhhbXBsZXMvY29tcGFueS5qcyc7XG5cdFx0Y29uc3QgZmlsZTEgPSAnLi9leGFtcGxlcy9zdWJmb2xkZXIvc3ViZmlsZS50eHQnO1xuXG5cdFx0Y29uc3Qgd2Fsa2VyID0gbmV3IEZpbGVXYWxrZXIoeyB0eXBlOiBRdWVyeVR5cGUuRmlsZSwgZm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksIGV4Y2x1ZGVQYXR0ZXJuOiB7ICcqKi9leGFtcGxlcy9zb21ldGhpbmcnOiB0cnVlIH0gfSk7XG5cdFx0Y29uc3QgY21kMSA9IHdhbGtlci5zcGF3bkZpbmRDbWQoVEVTVF9ST09UX0ZPTERFUik7XG5cdFx0d2Fsa2VyLnJlYWRTdGRvdXQoY21kMSwgJ3V0ZjgnLCAoZXJyMSwgc3Rkb3V0MSkgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVycjEsIG51bGwpO1xuXHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHN0ZG91dDEhLnNwbGl0KCdcXG4nKS5pbmRleE9mKGZpbGUwKSwgLTEsIHN0ZG91dDEpO1xuXHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHN0ZG91dDEhLnNwbGl0KCdcXG4nKS5pbmRleE9mKGZpbGUxKSwgLTEsIHN0ZG91dDEpO1xuXG5cdFx0XHRjb25zdCB3YWxrZXIgPSBuZXcgRmlsZVdhbGtlcih7IHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLCBmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSwgZXhjbHVkZVBhdHRlcm46IHsgJyoqL2V4YW1wbGVzL3N1YmZvbGRlcic6IHRydWUgfSB9KTtcblx0XHRcdGNvbnN0IGNtZDIgPSB3YWxrZXIuc3Bhd25GaW5kQ21kKFRFU1RfUk9PVF9GT0xERVIpO1xuXHRcdFx0d2Fsa2VyLnJlYWRTdGRvdXQoY21kMiwgJ3V0ZjgnLCAoZXJyMiwgc3Rkb3V0MikgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXJyMiwgbnVsbCk7XG5cdFx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChzdGRvdXQxIS5zcGxpdCgnXFxuJykuaW5kZXhPZihmaWxlMCksIC0xLCBzdGRvdXQxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0ZG91dDIhLnNwbGl0KCdcXG4nKS5pbmRleE9mKGZpbGUxKSwgLTEsIHN0ZG91dDIpO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0KHBsYXRmb3JtLmlzV2luZG93cyA/IHRlc3Quc2tpcCA6IHRlc3QpKCdGaW5kOiBleGNsdWRlIHN1YmZvbGRlciBwYXRoIHN1ZmZpeCcsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZmlsZTAgPSAnLi9leGFtcGxlcy9zdWJmb2xkZXIvc3ViZmlsZS50eHQnO1xuXHRcdGNvbnN0IGZpbGUxID0gJy4vZXhhbXBsZXMvc3ViZm9sZGVyL2Fub3RoZXJmb2xkZXIvYW5vdGhlcmZpbGUudHh0JztcblxuXHRcdGNvbnN0IHdhbGtlciA9IG5ldyBGaWxlV2Fsa2VyKHsgdHlwZTogUXVlcnlUeXBlLkZpbGUsIGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLCBleGNsdWRlUGF0dGVybjogeyAnKiovc3ViZm9sZGVyL3NvbWV0aGluZyc6IHRydWUgfSB9KTtcblx0XHRjb25zdCBjbWQxID0gd2Fsa2VyLnNwYXduRmluZENtZChURVNUX1JPT1RfRk9MREVSKTtcblx0XHR3YWxrZXIucmVhZFN0ZG91dChjbWQxLCAndXRmOCcsIChlcnIxLCBzdGRvdXQxKSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXJyMSwgbnVsbCk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoc3Rkb3V0MSEuc3BsaXQoJ1xcbicpLmluZGV4T2YoZmlsZTApLCAtMSwgc3Rkb3V0MSk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoc3Rkb3V0MSEuc3BsaXQoJ1xcbicpLmluZGV4T2YoZmlsZTEpLCAtMSwgc3Rkb3V0MSk7XG5cblx0XHRcdGNvbnN0IHdhbGtlciA9IG5ldyBGaWxlV2Fsa2VyKHsgdHlwZTogUXVlcnlUeXBlLkZpbGUsIGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLCBleGNsdWRlUGF0dGVybjogeyAnKiovc3ViZm9sZGVyL2Fub3RoZXJmb2xkZXInOiB0cnVlIH0gfSk7XG5cdFx0XHRjb25zdCBjbWQyID0gd2Fsa2VyLnNwYXduRmluZENtZChURVNUX1JPT1RfRk9MREVSKTtcblx0XHRcdHdhbGtlci5yZWFkU3Rkb3V0KGNtZDIsICd1dGY4JywgKGVycjIsIHN0ZG91dDIpID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVycjIsIG51bGwpO1xuXHRcdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoc3Rkb3V0MSEuc3BsaXQoJ1xcbicpLmluZGV4T2YoZmlsZTApLCAtMSwgc3Rkb3V0MSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGRvdXQyIS5zcGxpdCgnXFxuJykuaW5kZXhPZihmaWxlMSksIC0xLCBzdGRvdXQyKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdChwbGF0Zm9ybS5pc1dpbmRvd3MgPyB0ZXN0LnNraXAgOiB0ZXN0KSgnRmluZDogZXhjbHVkZSBmb2xkZXIgcGF0aCcsIGZ1bmN0aW9uIChkb25lOiAoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3QgZmlsZTAgPSAnLi9leGFtcGxlcy9jb21wYW55LmpzJztcblx0XHRjb25zdCBmaWxlMSA9ICcuL2V4YW1wbGVzL3N1YmZvbGRlci9zdWJmaWxlLnR4dCc7XG5cblx0XHRjb25zdCB3YWxrZXIgPSBuZXcgRmlsZVdhbGtlcih7IHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLCBmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSwgZXhjbHVkZVBhdHRlcm46IHsgJ2V4YW1wbGVzL3NvbWV0aGluZyc6IHRydWUgfSB9KTtcblx0XHRjb25zdCBjbWQxID0gd2Fsa2VyLnNwYXduRmluZENtZChURVNUX1JPT1RfRk9MREVSKTtcblx0XHR3YWxrZXIucmVhZFN0ZG91dChjbWQxLCAndXRmOCcsIChlcnIxLCBzdGRvdXQxKSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXJyMSwgbnVsbCk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoc3Rkb3V0MSEuc3BsaXQoJ1xcbicpLmluZGV4T2YoZmlsZTApLCAtMSwgc3Rkb3V0MSk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoc3Rkb3V0MSEuc3BsaXQoJ1xcbicpLmluZGV4T2YoZmlsZTEpLCAtMSwgc3Rkb3V0MSk7XG5cblx0XHRcdGNvbnN0IHdhbGtlciA9IG5ldyBGaWxlV2Fsa2VyKHsgdHlwZTogUXVlcnlUeXBlLkZpbGUsIGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLCBleGNsdWRlUGF0dGVybjogeyAnZXhhbXBsZXMvc3ViZm9sZGVyJzogdHJ1ZSB9IH0pO1xuXHRcdFx0Y29uc3QgY21kMiA9IHdhbGtlci5zcGF3bkZpbmRDbWQoVEVTVF9ST09UX0ZPTERFUik7XG5cdFx0XHR3YWxrZXIucmVhZFN0ZG91dChjbWQyLCAndXRmOCcsIChlcnIyLCBzdGRvdXQyKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnIyLCBudWxsKTtcblx0XHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHN0ZG91dDEhLnNwbGl0KCdcXG4nKS5pbmRleE9mKGZpbGUwKSwgLTEsIHN0ZG91dDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3Rkb3V0MiEuc3BsaXQoJ1xcbicpLmluZGV4T2YoZmlsZTEpLCAtMSwgc3Rkb3V0Mik7XG5cdFx0XHRcdGRvbmUoKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHQocGxhdGZvcm0uaXNXaW5kb3dzID8gdGVzdC5za2lwIDogdGVzdCkoJ0ZpbmQ6IGV4Y2x1ZGUgY29tYmluYXRpb24gb2YgcGF0aHMnLCBmdW5jdGlvbiAoZG9uZTogKCkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IGZpbGVzSW4gPSBbXG5cdFx0XHQnLi9leGFtcGxlcy9zdWJmb2xkZXIvc3ViZmlsZS50eHQnLFxuXHRcdFx0Jy4vZXhhbXBsZXMvY29tcGFueS5qcycsXG5cdFx0XHQnLi9pbmRleC5odG1sJ1xuXHRcdF07XG5cdFx0Y29uc3QgZmlsZXNPdXQgPSBbXG5cdFx0XHQnLi9leGFtcGxlcy9zdWJmb2xkZXIvYW5vdGhlcmZvbGRlci9hbm90aGVyZmlsZS50eHQnLFxuXHRcdFx0Jy4vbW9yZS9maWxlLnR4dCdcblx0XHRdO1xuXG5cdFx0Y29uc3Qgd2Fsa2VyID0gbmV3IEZpbGVXYWxrZXIoe1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiB7XG5cdFx0XHRcdCcqKi9zdWJmb2xkZXIvYW5vdGhlcmZvbGRlcic6IHRydWUsXG5cdFx0XHRcdCcqKi9zb21ldGhpbmcvZWxzZSc6IHRydWUsXG5cdFx0XHRcdCcqKi9tb3JlJzogdHJ1ZSxcblx0XHRcdFx0JyoqL2FuZG1vcmUnOiB0cnVlXG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0Y29uc3QgY21kMSA9IHdhbGtlci5zcGF3bkZpbmRDbWQoVEVTVF9ST09UX0ZPTERFUik7XG5cdFx0d2Fsa2VyLnJlYWRTdGRvdXQoY21kMSwgJ3V0ZjgnLCAoZXJyMSwgc3Rkb3V0MSkgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVycjEsIG51bGwpO1xuXHRcdFx0Zm9yIChjb25zdCBmaWxlSW4gb2YgZmlsZXNJbikge1xuXHRcdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoc3Rkb3V0MSEuc3BsaXQoJ1xcbicpLmluZGV4T2YoZmlsZUluKSwgLTEsIHN0ZG91dDEpO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCBmaWxlT3V0IG9mIGZpbGVzT3V0KSB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGRvdXQxIS5zcGxpdCgnXFxuJykuaW5kZXhPZihmaWxlT3V0KSwgLTEsIHN0ZG91dDEpO1xuXHRcdFx0fVxuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBvdXRwdXRDb250YWlucyhzdGRvdXQ6IHN0cmluZywgLi4uZmlsZXM6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgbGluZXMgPSBzdGRvdXQuc3BsaXQoJ1xcbicpO1xuXHRcdHJldHVybiBmaWxlcy5ldmVyeShmaWxlID0+IGxpbmVzLmluZGV4T2YoZmlsZSkgPj0gMCk7XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFlBQVksVUFBVTtBQUN0QixZQUFZLGNBQWM7QUFDMUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxXQUFXO0FBQ3BCLFNBQXVCLGlCQUFnQztBQUN2RCxTQUFTLFVBQVUsa0JBQWtCLGtCQUFrQjtBQUN2RCxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGtCQUFrQjtBQUUzQixNQUFNLGdCQUFnQixL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UUFBTyxhQUFhLGdCQUFnQjtBQUNqRCxNQUFBQSxRQUFPLFdBQVcsTUFBTSxRQUFRLENBQUMsTUFBTSxZQUFZO0FBQ2xELGVBQU8sWUFBWSxNQUFNLElBQUk7QUFDN0IsZUFBTyxlQUFlLFFBQVMsTUFBTSxJQUFJLEVBQUUsUUFBUSxLQUFLLEdBQUcsSUFBSSxPQUFPO0FBQ3RFLGVBQU8sWUFBWSxRQUFTLE1BQU0sSUFBSSxFQUFFLFFBQVEsS0FBSyxHQUFHLElBQUksT0FBTztBQUNuRSxhQUFLO0FBQUEsTUFDTixDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsR0FBQyxTQUFTLFlBQVksS0FBSyxPQUFPLE1BQU0sc0NBQXNDLFNBQVUsTUFBa0I7QUFDekcsVUFBTSxVQUFVO0FBQUEsTUFDZjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUNBLFVBQU0sV0FBVztBQUFBLE1BQ2hCO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFFQSxVQUFNLFNBQVMsSUFBSSxXQUFXO0FBQUEsTUFDN0IsTUFBTSxVQUFVO0FBQUEsTUFDaEIsZUFBZTtBQUFBLE1BQ2YsZ0JBQWdCO0FBQUEsUUFDZiw4QkFBOEI7QUFBQSxRQUM5QixxQkFBcUI7QUFBQSxRQUNyQixXQUFXO0FBQUEsUUFDWCxjQUFjO0FBQUEsTUFDZjtBQUFBLElBQ0QsQ0FBQztBQUNELFVBQU0sT0FBTyxPQUFPLGFBQWEsZ0JBQWdCO0FBQ2pELFdBQU8sV0FBVyxNQUFNLFFBQVEsQ0FBQyxNQUFNLFlBQVk7QUFDbEQsYUFBTyxZQUFZLE1BQU0sSUFBSTtBQUM3QixpQkFBVyxVQUFVLFNBQVM7QUFDN0IsZUFBTyxlQUFlLFFBQVMsTUFBTSxJQUFJLEVBQUUsUUFBUSxNQUFNLEdBQUcsSUFBSSxPQUFPO0FBQUEsTUFDeEU7QUFDQSxpQkFBVyxXQUFXLFVBQVU7QUFDL0IsZUFBTyxZQUFZLFFBQVMsTUFBTSxJQUFJLEVBQUUsUUFBUSxPQUFPLEdBQUcsSUFBSSxPQUFPO0FBQUEsTUFDdEU7QUFDQSxXQUFLO0FBQUEsSUFDTixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsV0FBUyxlQUFlLFdBQW1CLE9BQTBCO0FBQ3BFLFVBQU0sUUFBUSxPQUFPLE1BQU0sSUFBSTtBQUMvQixXQUFPLE1BQU0sTUFBTSxVQUFRLE1BQU0sUUFBUSxJQUFJLEtBQUssQ0FBQztBQUFBLEVBQ3BEO0FBQ0QsQ0FBQzsiLAogICJuYW1lcyI6IFsid2Fsa2VyIl0KfQo=
