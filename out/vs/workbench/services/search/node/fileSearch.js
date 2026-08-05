import * as childProcess from "child_process";
import * as fs from "fs";
import * as path from "../../../../base/common/path.js";
import { StringDecoder } from "string_decoder";
import * as arrays from "../../../../base/common/arrays.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import * as glob from "../../../../base/common/glob.js";
import * as normalization from "../../../../base/common/normalization.js";
import { isEqualOrParent } from "../../../../base/common/extpath.js";
import * as platform from "../../../../base/common/platform.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import * as strings from "../../../../base/common/strings.js";
import * as types from "../../../../base/common/types.js";
import { Promises } from "../../../../base/node/pfs.js";
import { isFilePatternMatch, hasSiblingFn } from "../common/search.js";
import { spawnRipgrepCmd } from "./ripgrepFileSearch.js";
import { prepareQuery } from "../../../../base/common/fuzzyScorer.js";
const killCmds = /* @__PURE__ */ new Set();
process.on("exit", () => {
  killCmds.forEach((cmd) => cmd());
});
class FileWalker {
  constructor(config) {
    this.normalizedFilePatternLowercase = null;
    this.maxFilesize = null;
    this.isCanceled = false;
    this.fileWalkSW = null;
    this.cmdSW = null;
    this.cmdResultCount = 0;
    this.config = config;
    this.filePattern = config.filePattern || "";
    this.includePattern = config.includePattern && glob.parse(config.includePattern);
    this.maxResults = config.maxResults || null;
    this.exists = !!config.exists;
    this.walkedPaths = /* @__PURE__ */ Object.create(null);
    this.resultCount = 0;
    this.isLimitHit = false;
    this.directoriesWalked = 0;
    this.filesWalked = 0;
    this.errors = [];
    if (this.filePattern) {
      this.normalizedFilePatternLowercase = config.shouldGlobMatchFilePattern ? null : prepareQuery(this.filePattern).normalizedLowercase;
    }
    this.globalExcludePattern = config.excludePattern && glob.parse(config.excludePattern);
    this.folderExcludePatterns = /* @__PURE__ */ new Map();
    config.folderQueries.forEach((folderQuery) => {
      const folderExcludeExpression = {};
      folderQuery.excludePattern?.forEach((excludePattern) => {
        Object.assign(folderExcludeExpression, excludePattern.pattern || {}, this.config.excludePattern || {});
      });
      if (!folderQuery.excludePattern?.length) {
        Object.assign(folderExcludeExpression, this.config.excludePattern || {});
      }
      const fqPath = folderQuery.folder.fsPath;
      config.folderQueries.map((rootFolderQuery) => rootFolderQuery.folder.fsPath).filter((rootFolder) => rootFolder !== fqPath).forEach((otherRootFolder) => {
        if (isEqualOrParent(otherRootFolder, fqPath)) {
          folderExcludeExpression[path.relative(fqPath, otherRootFolder)] = true;
        }
      });
      this.folderExcludePatterns.set(fqPath, new AbsoluteAndRelativeParsedExpression(folderExcludeExpression, fqPath));
    });
  }
  cancel() {
    this.isCanceled = true;
    killCmds.forEach((cmd) => cmd());
  }
  walk(folderQueries, extraFiles, numThreads, onResult, onMessage, done) {
    this.fileWalkSW = StopWatch.create(false);
    if (this.isCanceled) {
      return done(null, this.isLimitHit);
    }
    extraFiles.forEach((extraFilePath) => {
      const basename = path.basename(extraFilePath.fsPath);
      if (this.globalExcludePattern && this.globalExcludePattern(extraFilePath.fsPath, basename)) {
        return;
      }
      this.matchFile(onResult, { relativePath: extraFilePath.fsPath, searchPath: void 0 });
    });
    this.cmdSW = StopWatch.create(false);
    this.parallel(folderQueries, (folderQuery, rootFolderDone) => {
      this.call(this.cmdTraversal, this, folderQuery, numThreads, onResult, onMessage, (err) => {
        if (err) {
          const errorMessage = toErrorMessage(err);
          console.error(errorMessage);
          this.errors.push(errorMessage);
          rootFolderDone(err, void 0);
        } else {
          rootFolderDone(null, void 0);
        }
      });
    }, (errors, _result) => {
      this.fileWalkSW.stop();
      const err = errors ? arrays.coalesce(errors)[0] : null;
      done(err, this.isLimitHit);
    });
  }
  parallel(list, fn, callback) {
    const results = new Array(list.length);
    const errors = new Array(list.length);
    let didErrorOccur = false;
    let doneCount = 0;
    if (list.length === 0) {
      return callback(null, []);
    }
    list.forEach((item, index) => {
      fn(item, (error, result) => {
        if (error) {
          didErrorOccur = true;
          results[index] = null;
          errors[index] = error;
        } else {
          results[index] = result;
          errors[index] = null;
        }
        if (++doneCount === list.length) {
          return callback(didErrorOccur ? errors : null, results);
        }
      });
    });
  }
  call(fun, that, ...args) {
    try {
      fun.apply(that, args);
    } catch (e) {
      args[args.length - 1](e);
    }
  }
  cmdTraversal(folderQuery, numThreads, onResult, onMessage, cb) {
    const rootFolder = folderQuery.folder.fsPath;
    const isMac = platform.isMacintosh;
    const killCmd = () => cmd && cmd.kill();
    killCmds.add(killCmd);
    let done = (err) => {
      killCmds.delete(killCmd);
      done = () => {
      };
      cb(err);
    };
    let leftover = "";
    const tree = this.initDirectoryTree();
    const ripgrep = spawnRipgrepCmd(this.config, folderQuery, this.config.includePattern, this.folderExcludePatterns.get(folderQuery.folder.fsPath).expression, numThreads);
    const cmd = ripgrep.cmd;
    const noSiblingsClauses = !Object.keys(ripgrep.siblingClauses).length;
    const escapedArgs = ripgrep.rgArgs.args.map((arg) => arg.match(/^-/) ? arg : `'${arg}'`).join(" ");
    let rgCmd = `${ripgrep.rgDiskPath} ${escapedArgs}
 - cwd: ${ripgrep.cwd}`;
    if (ripgrep.rgArgs.siblingClauses) {
      rgCmd += `
 - Sibling clauses: ${JSON.stringify(ripgrep.rgArgs.siblingClauses)}`;
    }
    onMessage({ message: rgCmd });
    this.cmdResultCount = 0;
    this.collectStdout(cmd, "utf8", onMessage, (err, stdout, last) => {
      if (err) {
        done(err);
        return;
      }
      if (this.isLimitHit) {
        done();
        return;
      }
      const normalized = leftover + (isMac ? normalization.normalizeNFC(stdout || "") : stdout);
      const relativeFiles = normalized.split("\n");
      if (last) {
        const n = relativeFiles.length;
        relativeFiles[n - 1] = relativeFiles[n - 1].trim();
        if (!relativeFiles[n - 1]) {
          relativeFiles.pop();
        }
      } else {
        leftover = relativeFiles.pop() || "";
      }
      if (relativeFiles.length && relativeFiles[0].indexOf("\n") !== -1) {
        done(new Error("Splitting up files failed"));
        return;
      }
      this.cmdResultCount += relativeFiles.length;
      if (noSiblingsClauses) {
        for (const relativePath of relativeFiles) {
          this.matchFile(onResult, { base: rootFolder, relativePath, searchPath: this.getSearchPath(folderQuery, relativePath) });
          if (this.isLimitHit) {
            killCmd();
            break;
          }
        }
        if (last || this.isLimitHit) {
          done();
        }
        return;
      }
      this.addDirectoryEntries(folderQuery, tree, rootFolder, relativeFiles, onResult);
      if (last) {
        this.matchDirectoryTree(tree, rootFolder, onResult);
        done();
      }
    });
  }
  /**
   * Public for testing.
   */
  spawnFindCmd(folderQuery) {
    const excludePattern = this.folderExcludePatterns.get(folderQuery.folder.fsPath);
    const basenames = excludePattern.getBasenameTerms();
    const pathTerms = excludePattern.getPathTerms();
    const args = ["-L", "."];
    if (basenames.length || pathTerms.length) {
      args.push("-not", "(", "(");
      for (const basename of basenames) {
        args.push("-name", basename);
        args.push("-o");
      }
      for (const path2 of pathTerms) {
        args.push("-path", path2);
        args.push("-o");
      }
      args.pop();
      args.push(")", "-prune", ")");
    }
    args.push("-type", "f");
    return childProcess.spawn("find", args, { cwd: folderQuery.folder.fsPath });
  }
  /**
   * Public for testing.
   */
  readStdout(cmd, encoding, cb) {
    let all = "";
    this.collectStdout(cmd, encoding, () => {
    }, (err, stdout, last) => {
      if (err) {
        cb(err);
        return;
      }
      all += stdout;
      if (last) {
        cb(null, all);
      }
    });
  }
  collectStdout(cmd, encoding, onMessage, cb) {
    let onData = (err, stdout, last) => {
      if (err || last) {
        onData = () => {
        };
        this.cmdSW?.stop();
      }
      cb(err, stdout, last);
    };
    let gotData = false;
    if (cmd.stdout) {
      this.forwardData(cmd.stdout, encoding, onData);
      cmd.stdout.once("data", () => gotData = true);
    } else {
      onMessage({ message: "stdout is null" });
    }
    let stderr;
    if (cmd.stderr) {
      stderr = this.collectData(cmd.stderr);
    } else {
      onMessage({ message: "stderr is null" });
    }
    cmd.on("error", (err) => {
      onData(err);
    });
    cmd.on("close", (code) => {
      let stderrText;
      if (!gotData && (stderrText = this.decodeData(stderr, encoding)) && rgErrorMsgForDisplay(stderrText)) {
        onData(new Error(`command failed with error code ${code}: ${this.decodeData(stderr, encoding)}`));
      } else {
        if (this.exists && code === 0) {
          this.isLimitHit = true;
        }
        onData(null, "", true);
      }
    });
  }
  forwardData(stream, encoding, cb) {
    const decoder = new StringDecoder(encoding);
    stream.on("data", (data) => {
      cb(null, decoder.write(data));
    });
    return decoder;
  }
  collectData(stream) {
    const buffers = [];
    stream.on("data", (data) => {
      buffers.push(data);
    });
    return buffers;
  }
  decodeData(buffers, encoding) {
    const decoder = new StringDecoder(encoding);
    return buffers.map((buffer) => decoder.write(buffer)).join("");
  }
  initDirectoryTree() {
    const tree = {
      rootEntries: [],
      pathToEntries: /* @__PURE__ */ Object.create(null)
    };
    tree.pathToEntries["."] = tree.rootEntries;
    return tree;
  }
  addDirectoryEntries(folderQuery, { pathToEntries }, base, relativeFiles, onResult) {
    if (relativeFiles.indexOf(this.filePattern) !== -1) {
      this.matchFile(onResult, {
        base,
        relativePath: this.filePattern,
        searchPath: this.getSearchPath(folderQuery, this.filePattern)
      });
    }
    const add = (relativePath) => {
      const basename = path.basename(relativePath);
      const dirname = path.dirname(relativePath);
      let entries = pathToEntries[dirname];
      if (!entries) {
        entries = pathToEntries[dirname] = [];
        add(dirname);
      }
      entries.push({
        base,
        relativePath,
        basename,
        searchPath: this.getSearchPath(folderQuery, relativePath)
      });
    };
    relativeFiles.forEach(add);
  }
  matchDirectoryTree({ rootEntries, pathToEntries }, rootFolder, onResult) {
    const self = this;
    const excludePattern = this.folderExcludePatterns.get(rootFolder);
    const filePattern = this.filePattern;
    function matchDirectory(entries) {
      self.directoriesWalked++;
      const hasSibling = hasSiblingFn(() => entries.map((entry) => entry.basename));
      for (let i = 0, n = entries.length; i < n; i++) {
        const entry = entries[i];
        const { relativePath, basename } = entry;
        if (excludePattern.test(relativePath, basename, filePattern !== basename ? hasSibling : void 0)) {
          continue;
        }
        const sub = pathToEntries[relativePath];
        if (sub) {
          matchDirectory(sub);
        } else {
          self.filesWalked++;
          if (relativePath === filePattern) {
            continue;
          }
          self.matchFile(onResult, entry);
        }
        if (self.isLimitHit) {
          break;
        }
      }
    }
    matchDirectory(rootEntries);
  }
  getStats() {
    return {
      cmdTime: this.cmdSW.elapsed(),
      fileWalkTime: this.fileWalkSW.elapsed(),
      directoriesWalked: this.directoriesWalked,
      filesWalked: this.filesWalked,
      cmdResultCount: this.cmdResultCount
    };
  }
  doWalk(folderQuery, relativeParentPath, files, onResult, done) {
    const rootFolder = folderQuery.folder;
    const hasSibling = hasSiblingFn(() => files);
    this.parallel(files, (file, clb) => {
      if (this.isCanceled || this.isLimitHit) {
        return clb(null);
      }
      const currentRelativePath = relativeParentPath ? [relativeParentPath, file].join(path.sep) : file;
      if (this.folderExcludePatterns.get(folderQuery.folder.fsPath).test(currentRelativePath, file, this.config.filePattern !== file ? hasSibling : void 0)) {
        return clb(null);
      }
      const currentAbsolutePath = [rootFolder.fsPath, currentRelativePath].join(path.sep);
      fs.lstat(currentAbsolutePath, (error, lstat) => {
        if (error || this.isCanceled || this.isLimitHit) {
          return clb(null);
        }
        this.statLinkIfNeeded(currentAbsolutePath, lstat, (error2, stat) => {
          if (error2 || this.isCanceled || this.isLimitHit) {
            return clb(null);
          }
          if (stat.isDirectory()) {
            this.directoriesWalked++;
            return this.realPathIfNeeded(currentAbsolutePath, lstat, (error3, realpath) => {
              if (error3 || this.isCanceled || this.isLimitHit) {
                return clb(null);
              }
              realpath = realpath || "";
              if (this.walkedPaths[realpath]) {
                return clb(null);
              }
              this.walkedPaths[realpath] = true;
              return Promises.readdir(currentAbsolutePath).then((children) => {
                if (this.isCanceled || this.isLimitHit) {
                  return clb(null);
                }
                this.doWalk(folderQuery, currentRelativePath, children, onResult, (err) => clb(err || null));
              }, (error4) => {
                clb(null);
              });
            });
          } else {
            this.filesWalked++;
            if (currentRelativePath === this.filePattern) {
              return clb(null, void 0);
            }
            if (this.maxFilesize && types.isNumber(stat.size) && stat.size > this.maxFilesize) {
              return clb(null, void 0);
            }
            this.matchFile(onResult, {
              base: rootFolder.fsPath,
              relativePath: currentRelativePath,
              searchPath: this.getSearchPath(folderQuery, currentRelativePath)
            });
          }
          return clb(null, void 0);
        });
      });
    }, (error) => {
      const filteredErrors = error ? arrays.coalesce(error) : error;
      return done(filteredErrors && filteredErrors.length > 0 ? filteredErrors[0] : void 0);
    });
  }
  matchFile(onResult, candidate) {
    if (this.isFileMatch(candidate) && (!this.includePattern || this.includePattern(candidate.relativePath, path.basename(candidate.relativePath)))) {
      this.resultCount++;
      if (this.exists || this.maxResults && this.resultCount > this.maxResults) {
        this.isLimitHit = true;
      }
      if (!this.isLimitHit) {
        onResult(candidate);
      }
    }
  }
  isFileMatch(candidate) {
    if (this.filePattern) {
      if (this.filePattern === "*") {
        return true;
      }
      if (this.normalizedFilePatternLowercase) {
        return isFilePatternMatch(candidate, this.normalizedFilePatternLowercase);
      } else if (this.filePattern) {
        return isFilePatternMatch(candidate, this.filePattern, false);
      }
    }
    return true;
  }
  statLinkIfNeeded(path2, lstat, clb) {
    if (lstat.isSymbolicLink()) {
      return fs.stat(path2, clb);
    }
    return clb(null, lstat);
  }
  realPathIfNeeded(path2, lstat, clb) {
    if (lstat.isSymbolicLink()) {
      return fs.realpath(path2, (error, realpath) => {
        if (error) {
          return clb(error);
        }
        return clb(null, realpath);
      });
    }
    return clb(null, path2);
  }
  /**
   * If we're searching for files in multiple workspace folders, then better prepend the
   * name of the workspace folder to the path of the file. This way we'll be able to
   * better filter files that are all on the top of a workspace folder and have all the
   * same name. A typical example are `package.json` or `README.md` files.
   */
  getSearchPath(folderQuery, relativePath) {
    if (folderQuery.folderName) {
      return path.join(folderQuery.folderName, relativePath);
    }
    return relativePath;
  }
}
class Engine {
  constructor(config, numThreads) {
    this.folderQueries = config.folderQueries;
    this.extraFiles = config.extraFileResources || [];
    this.numThreads = numThreads;
    this.walker = new FileWalker(config);
  }
  search(onResult, onProgress, done) {
    this.walker.walk(this.folderQueries, this.extraFiles, this.numThreads, onResult, onProgress, (err, isLimitHit) => {
      done(err, {
        limitHit: isLimitHit,
        stats: this.walker.getStats(),
        messages: []
      });
    });
  }
  cancel() {
    this.walker.cancel();
  }
}
class AbsoluteAndRelativeParsedExpression {
  constructor(expression, root) {
    this.expression = expression;
    this.root = root;
    this.init(expression);
  }
  /**
   * Split the IExpression into its absolute and relative components, and glob.parse them separately.
   */
  init(expr) {
    let absoluteGlobExpr;
    let relativeGlobExpr;
    Object.keys(expr).filter((key) => expr[key]).forEach((key) => {
      if (path.isAbsolute(key)) {
        absoluteGlobExpr = absoluteGlobExpr || glob.getEmptyExpression();
        absoluteGlobExpr[key] = expr[key];
      } else {
        relativeGlobExpr = relativeGlobExpr || glob.getEmptyExpression();
        relativeGlobExpr[key] = expr[key];
      }
    });
    this.absoluteParsedExpr = absoluteGlobExpr && glob.parse(absoluteGlobExpr, { trimForExclusions: true });
    this.relativeParsedExpr = relativeGlobExpr && glob.parse(relativeGlobExpr, { trimForExclusions: true });
  }
  test(_path, basename, hasSibling) {
    return this.relativeParsedExpr && this.relativeParsedExpr(_path, basename, hasSibling) || this.absoluteParsedExpr && this.absoluteParsedExpr(path.join(this.root, _path), basename, hasSibling);
  }
  getBasenameTerms() {
    const basenameTerms = [];
    if (this.absoluteParsedExpr) {
      basenameTerms.push(...glob.getBasenameTerms(this.absoluteParsedExpr));
    }
    if (this.relativeParsedExpr) {
      basenameTerms.push(...glob.getBasenameTerms(this.relativeParsedExpr));
    }
    return basenameTerms;
  }
  getPathTerms() {
    const pathTerms = [];
    if (this.absoluteParsedExpr) {
      pathTerms.push(...glob.getPathTerms(this.absoluteParsedExpr));
    }
    if (this.relativeParsedExpr) {
      pathTerms.push(...glob.getPathTerms(this.relativeParsedExpr));
    }
    return pathTerms;
  }
}
function rgErrorMsgForDisplay(msg) {
  const lines = msg.trim().split("\n");
  const firstLine = lines[0].trim();
  if (firstLine.startsWith("Error parsing regex")) {
    return firstLine;
  }
  if (firstLine.startsWith("regex parse error")) {
    return strings.uppercaseFirstLetter(lines[lines.length - 1].trim());
  }
  if (firstLine.startsWith("error parsing glob") || firstLine.startsWith("unsupported encoding")) {
    return firstLine.charAt(0).toUpperCase() + firstLine.substr(1);
  }
  if (firstLine === `Literal '\\n' not allowed.`) {
    return `Literal '\\n' currently not supported`;
  }
  if (firstLine.startsWith("Literal ")) {
    return firstLine;
  }
  return void 0;
}
export {
  Engine,
  FileWalker
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL25vZGUvZmlsZVNlYXJjaC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGNoaWxkUHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBSZWFkYWJsZSB9IGZyb20gJ3N0cmVhbSc7XG5pbXBvcnQgeyBTdHJpbmdEZWNvZGVyIH0gZnJvbSAnc3RyaW5nX2RlY29kZXInO1xuaW1wb3J0ICogYXMgYXJyYXlzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyB0b0Vycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9yTWVzc2FnZS5qcyc7XG5pbXBvcnQgKiBhcyBnbG9iIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2dsb2IuanMnO1xuaW1wb3J0ICogYXMgbm9ybWFsaXphdGlvbiBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ub3JtYWxpemF0aW9uLmpzJztcbmltcG9ydCB7IGlzRXF1YWxPclBhcmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V4dHBhdGguanMnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgU3RvcFdhdGNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RvcHdhdGNoLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgKiBhcyB0eXBlcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgUHJvbWlzZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL25vZGUvcGZzLmpzJztcbmltcG9ydCB7IElGaWxlUXVlcnksIElGb2xkZXJRdWVyeSwgSVByb2dyZXNzTWVzc2FnZSwgSVNlYXJjaEVuZ2luZVN0YXRzLCBJUmF3RmlsZU1hdGNoLCBJU2VhcmNoRW5naW5lLCBJU2VhcmNoRW5naW5lU3VjY2VzcywgaXNGaWxlUGF0dGVybk1hdGNoLCBoYXNTaWJsaW5nRm4gfSBmcm9tICcuLi9jb21tb24vc2VhcmNoLmpzJztcbmltcG9ydCB7IHNwYXduUmlwZ3JlcENtZCB9IGZyb20gJy4vcmlwZ3JlcEZpbGVTZWFyY2guanMnO1xuaW1wb3J0IHsgcHJlcGFyZVF1ZXJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZnV6enlTY29yZXIuanMnO1xuXG5pbnRlcmZhY2UgSURpcmVjdG9yeUVudHJ5IGV4dGVuZHMgSVJhd0ZpbGVNYXRjaCB7XG5cdGJhc2U6IHN0cmluZztcblx0YmFzZW5hbWU6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIElEaXJlY3RvcnlUcmVlIHtcblx0cm9vdEVudHJpZXM6IElEaXJlY3RvcnlFbnRyeVtdO1xuXHRwYXRoVG9FbnRyaWVzOiB7IFtyZWxhdGl2ZVBhdGg6IHN0cmluZ106IElEaXJlY3RvcnlFbnRyeVtdIH07XG59XG5cbmNvbnN0IGtpbGxDbWRzID0gbmV3IFNldDwoKSA9PiB2b2lkPigpO1xucHJvY2Vzcy5vbignZXhpdCcsICgpID0+IHtcblx0a2lsbENtZHMuZm9yRWFjaChjbWQgPT4gY21kKCkpO1xufSk7XG5cbmV4cG9ydCBjbGFzcyBGaWxlV2Fsa2VyIHtcblx0cHJpdmF0ZSBjb25maWc6IElGaWxlUXVlcnk7XG5cdHByaXZhdGUgZmlsZVBhdHRlcm46IHN0cmluZztcblx0cHJpdmF0ZSBub3JtYWxpemVkRmlsZVBhdHRlcm5Mb3dlcmNhc2U6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGluY2x1ZGVQYXR0ZXJuOiBnbG9iLlBhcnNlZEV4cHJlc3Npb24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgbWF4UmVzdWx0czogbnVtYmVyIHwgbnVsbDtcblx0cHJpdmF0ZSBleGlzdHM6IGJvb2xlYW47XG5cdHByaXZhdGUgbWF4RmlsZXNpemU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGlzTGltaXRIaXQ6IGJvb2xlYW47XG5cdHByaXZhdGUgcmVzdWx0Q291bnQ6IG51bWJlcjtcblx0cHJpdmF0ZSBpc0NhbmNlbGVkID0gZmFsc2U7XG5cdHByaXZhdGUgZmlsZVdhbGtTVzogU3RvcFdhdGNoIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgZGlyZWN0b3JpZXNXYWxrZWQ6IG51bWJlcjtcblx0cHJpdmF0ZSBmaWxlc1dhbGtlZDogbnVtYmVyO1xuXHRwcml2YXRlIGVycm9yczogc3RyaW5nW107XG5cdHByaXZhdGUgY21kU1c6IFN0b3BXYXRjaCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGNtZFJlc3VsdENvdW50OiBudW1iZXIgPSAwO1xuXG5cdHByaXZhdGUgZm9sZGVyRXhjbHVkZVBhdHRlcm5zOiBNYXA8c3RyaW5nLCBBYnNvbHV0ZUFuZFJlbGF0aXZlUGFyc2VkRXhwcmVzc2lvbj47XG5cdHByaXZhdGUgZ2xvYmFsRXhjbHVkZVBhdHRlcm46IGdsb2IuUGFyc2VkRXhwcmVzc2lvbiB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHdhbGtlZFBhdGhzOiB7IFtwYXRoOiBzdHJpbmddOiBib29sZWFuIH07XG5cblx0Y29uc3RydWN0b3IoY29uZmlnOiBJRmlsZVF1ZXJ5KSB7XG5cdFx0dGhpcy5jb25maWcgPSBjb25maWc7XG5cdFx0dGhpcy5maWxlUGF0dGVybiA9IGNvbmZpZy5maWxlUGF0dGVybiB8fCAnJztcblx0XHR0aGlzLmluY2x1ZGVQYXR0ZXJuID0gY29uZmlnLmluY2x1ZGVQYXR0ZXJuICYmIGdsb2IucGFyc2UoY29uZmlnLmluY2x1ZGVQYXR0ZXJuKTtcblx0XHR0aGlzLm1heFJlc3VsdHMgPSBjb25maWcubWF4UmVzdWx0cyB8fCBudWxsO1xuXHRcdHRoaXMuZXhpc3RzID0gISFjb25maWcuZXhpc3RzO1xuXHRcdHRoaXMud2Fsa2VkUGF0aHMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdHRoaXMucmVzdWx0Q291bnQgPSAwO1xuXHRcdHRoaXMuaXNMaW1pdEhpdCA9IGZhbHNlO1xuXHRcdHRoaXMuZGlyZWN0b3JpZXNXYWxrZWQgPSAwO1xuXHRcdHRoaXMuZmlsZXNXYWxrZWQgPSAwO1xuXHRcdHRoaXMuZXJyb3JzID0gW107XG5cblx0XHRpZiAodGhpcy5maWxlUGF0dGVybikge1xuXHRcdFx0dGhpcy5ub3JtYWxpemVkRmlsZVBhdHRlcm5Mb3dlcmNhc2UgPSBjb25maWcuc2hvdWxkR2xvYk1hdGNoRmlsZVBhdHRlcm4gPyBudWxsIDogcHJlcGFyZVF1ZXJ5KHRoaXMuZmlsZVBhdHRlcm4pLm5vcm1hbGl6ZWRMb3dlcmNhc2U7XG5cdFx0fVxuXG5cdFx0dGhpcy5nbG9iYWxFeGNsdWRlUGF0dGVybiA9IGNvbmZpZy5leGNsdWRlUGF0dGVybiAmJiBnbG9iLnBhcnNlKGNvbmZpZy5leGNsdWRlUGF0dGVybik7XG5cdFx0dGhpcy5mb2xkZXJFeGNsdWRlUGF0dGVybnMgPSBuZXcgTWFwPHN0cmluZywgQWJzb2x1dGVBbmRSZWxhdGl2ZVBhcnNlZEV4cHJlc3Npb24+KCk7XG5cblx0XHRjb25maWcuZm9sZGVyUXVlcmllcy5mb3JFYWNoKGZvbGRlclF1ZXJ5ID0+IHtcblx0XHRcdGNvbnN0IGZvbGRlckV4Y2x1ZGVFeHByZXNzaW9uOiBnbG9iLklFeHByZXNzaW9uID0ge307IC8vIHRvZG86IGNvbnNpZGVyIGV4Y2x1ZGUgYmFzZVVSSVxuXG5cdFx0XHRmb2xkZXJRdWVyeS5leGNsdWRlUGF0dGVybj8uZm9yRWFjaChleGNsdWRlUGF0dGVybiA9PiB7XG5cdFx0XHRcdE9iamVjdC5hc3NpZ24oZm9sZGVyRXhjbHVkZUV4cHJlc3Npb24sIGV4Y2x1ZGVQYXR0ZXJuLnBhdHRlcm4gfHwge30sIHRoaXMuY29uZmlnLmV4Y2x1ZGVQYXR0ZXJuIHx8IHt9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoIWZvbGRlclF1ZXJ5LmV4Y2x1ZGVQYXR0ZXJuPy5sZW5ndGgpIHtcblx0XHRcdFx0T2JqZWN0LmFzc2lnbihmb2xkZXJFeGNsdWRlRXhwcmVzc2lvbiwgdGhpcy5jb25maWcuZXhjbHVkZVBhdHRlcm4gfHwge30pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBBZGQgZXhjbHVkZXMgZm9yIG90aGVyIHJvb3QgZm9sZGVyc1xuXHRcdFx0Y29uc3QgZnFQYXRoID0gZm9sZGVyUXVlcnkuZm9sZGVyLmZzUGF0aDtcblx0XHRcdGNvbmZpZy5mb2xkZXJRdWVyaWVzXG5cdFx0XHRcdC5tYXAocm9vdEZvbGRlclF1ZXJ5ID0+IHJvb3RGb2xkZXJRdWVyeS5mb2xkZXIuZnNQYXRoKVxuXHRcdFx0XHQuZmlsdGVyKHJvb3RGb2xkZXIgPT4gcm9vdEZvbGRlciAhPT0gZnFQYXRoKVxuXHRcdFx0XHQuZm9yRWFjaChvdGhlclJvb3RGb2xkZXIgPT4ge1xuXHRcdFx0XHRcdC8vIEV4Y2x1ZGUgbmVzdGVkIHJvb3QgZm9sZGVyc1xuXHRcdFx0XHRcdGlmIChpc0VxdWFsT3JQYXJlbnQob3RoZXJSb290Rm9sZGVyLCBmcVBhdGgpKSB7XG5cdFx0XHRcdFx0XHRmb2xkZXJFeGNsdWRlRXhwcmVzc2lvbltwYXRoLnJlbGF0aXZlKGZxUGF0aCwgb3RoZXJSb290Rm9sZGVyKV0gPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuZm9sZGVyRXhjbHVkZVBhdHRlcm5zLnNldChmcVBhdGgsIG5ldyBBYnNvbHV0ZUFuZFJlbGF0aXZlUGFyc2VkRXhwcmVzc2lvbihmb2xkZXJFeGNsdWRlRXhwcmVzc2lvbiwgZnFQYXRoKSk7XG5cdFx0fSk7XG5cdH1cblxuXHRjYW5jZWwoKTogdm9pZCB7XG5cdFx0dGhpcy5pc0NhbmNlbGVkID0gdHJ1ZTtcblx0XHRraWxsQ21kcy5mb3JFYWNoKGNtZCA9PiBjbWQoKSk7XG5cdH1cblxuXHR3YWxrKGZvbGRlclF1ZXJpZXM6IElGb2xkZXJRdWVyeVtdLCBleHRyYUZpbGVzOiBVUklbXSwgbnVtVGhyZWFkczogbnVtYmVyIHwgdW5kZWZpbmVkLCBvblJlc3VsdDogKHJlc3VsdDogSVJhd0ZpbGVNYXRjaCkgPT4gdm9pZCwgb25NZXNzYWdlOiAobWVzc2FnZTogSVByb2dyZXNzTWVzc2FnZSkgPT4gdm9pZCwgZG9uZTogKGVycm9yOiBFcnJvciB8IG51bGwsIGlzTGltaXRIaXQ6IGJvb2xlYW4pID0+IHZvaWQpOiB2b2lkIHtcblx0XHR0aGlzLmZpbGVXYWxrU1cgPSBTdG9wV2F0Y2guY3JlYXRlKGZhbHNlKTtcblxuXHRcdC8vIFN1cHBvcnQgdGhhdCB0aGUgZmlsZSBwYXR0ZXJuIGlzIGEgZnVsbCBwYXRoIHRvIGEgZmlsZSB0aGF0IGV4aXN0c1xuXHRcdGlmICh0aGlzLmlzQ2FuY2VsZWQpIHtcblx0XHRcdHJldHVybiBkb25lKG51bGwsIHRoaXMuaXNMaW1pdEhpdCk7XG5cdFx0fVxuXG5cdFx0Ly8gRm9yIGVhY2ggZXh0cmEgZmlsZVxuXHRcdGV4dHJhRmlsZXMuZm9yRWFjaChleHRyYUZpbGVQYXRoID0+IHtcblx0XHRcdGNvbnN0IGJhc2VuYW1lID0gcGF0aC5iYXNlbmFtZShleHRyYUZpbGVQYXRoLmZzUGF0aCk7XG5cdFx0XHRpZiAodGhpcy5nbG9iYWxFeGNsdWRlUGF0dGVybiAmJiB0aGlzLmdsb2JhbEV4Y2x1ZGVQYXR0ZXJuKGV4dHJhRmlsZVBhdGguZnNQYXRoLCBiYXNlbmFtZSkpIHtcblx0XHRcdFx0cmV0dXJuOyAvLyBleGNsdWRlZFxuXHRcdFx0fVxuXG5cdFx0XHQvLyBGaWxlOiBDaGVjayBmb3IgbWF0Y2ggb24gZmlsZSBwYXR0ZXJuIGFuZCBpbmNsdWRlIHBhdHRlcm5cblx0XHRcdHRoaXMubWF0Y2hGaWxlKG9uUmVzdWx0LCB7IHJlbGF0aXZlUGF0aDogZXh0cmFGaWxlUGF0aC5mc1BhdGggLyogbm8gd29ya3NwYWNlIHJlbGF0aXZlIHBhdGggKi8sIHNlYXJjaFBhdGg6IHVuZGVmaW5lZCB9KTtcblx0XHR9KTtcblxuXHRcdHRoaXMuY21kU1cgPSBTdG9wV2F0Y2guY3JlYXRlKGZhbHNlKTtcblxuXHRcdC8vIEZvciBlYWNoIHJvb3QgZm9sZGVyXG5cdFx0dGhpcy5wYXJhbGxlbDxJRm9sZGVyUXVlcnksIHZvaWQ+KGZvbGRlclF1ZXJpZXMsIChmb2xkZXJRdWVyeTogSUZvbGRlclF1ZXJ5LCByb290Rm9sZGVyRG9uZTogKGVycjogRXJyb3IgfCBudWxsLCByZXN1bHQ6IHZvaWQpID0+IHZvaWQpID0+IHtcblx0XHRcdHRoaXMuY2FsbCh0aGlzLmNtZFRyYXZlcnNhbCwgdGhpcywgZm9sZGVyUXVlcnksIG51bVRocmVhZHMsIG9uUmVzdWx0LCBvbk1lc3NhZ2UsIChlcnI/OiBFcnJvcikgPT4ge1xuXHRcdFx0XHRpZiAoZXJyKSB7XG5cdFx0XHRcdFx0Y29uc3QgZXJyb3JNZXNzYWdlID0gdG9FcnJvck1lc3NhZ2UoZXJyKTtcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKGVycm9yTWVzc2FnZSk7XG5cdFx0XHRcdFx0dGhpcy5lcnJvcnMucHVzaChlcnJvck1lc3NhZ2UpO1xuXHRcdFx0XHRcdHJvb3RGb2xkZXJEb25lKGVyciwgdW5kZWZpbmVkKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyb290Rm9sZGVyRG9uZShudWxsLCB1bmRlZmluZWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9LCAoZXJyb3JzLCBfcmVzdWx0KSA9PiB7XG5cdFx0XHR0aGlzLmZpbGVXYWxrU1chLnN0b3AoKTtcblx0XHRcdGNvbnN0IGVyciA9IGVycm9ycyA/IGFycmF5cy5jb2FsZXNjZShlcnJvcnMpWzBdIDogbnVsbDtcblx0XHRcdGRvbmUoZXJyLCB0aGlzLmlzTGltaXRIaXQpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBwYXJhbGxlbDxULCBFPihsaXN0OiBUW10sIGZuOiAoaXRlbTogVCwgY2FsbGJhY2s6IChlcnI6IEVycm9yIHwgbnVsbCwgcmVzdWx0OiBFIHwgbnVsbCkgPT4gdm9pZCkgPT4gdm9pZCwgY2FsbGJhY2s6IChlcnI6IEFycmF5PEVycm9yIHwgbnVsbD4gfCBudWxsLCByZXN1bHQ6IEVbXSkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGNvbnN0IHJlc3VsdHMgPSBuZXcgQXJyYXkobGlzdC5sZW5ndGgpO1xuXHRcdGNvbnN0IGVycm9ycyA9IG5ldyBBcnJheTxFcnJvciB8IG51bGw+KGxpc3QubGVuZ3RoKTtcblx0XHRsZXQgZGlkRXJyb3JPY2N1ciA9IGZhbHNlO1xuXHRcdGxldCBkb25lQ291bnQgPSAwO1xuXG5cdFx0aWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gY2FsbGJhY2sobnVsbCwgW10pO1xuXHRcdH1cblxuXHRcdGxpc3QuZm9yRWFjaCgoaXRlbSwgaW5kZXgpID0+IHtcblx0XHRcdGZuKGl0ZW0sIChlcnJvciwgcmVzdWx0KSA9PiB7XG5cdFx0XHRcdGlmIChlcnJvcikge1xuXHRcdFx0XHRcdGRpZEVycm9yT2NjdXIgPSB0cnVlO1xuXHRcdFx0XHRcdHJlc3VsdHNbaW5kZXhdID0gbnVsbDtcblx0XHRcdFx0XHRlcnJvcnNbaW5kZXhdID0gZXJyb3I7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzdWx0c1tpbmRleF0gPSByZXN1bHQ7XG5cdFx0XHRcdFx0ZXJyb3JzW2luZGV4XSA9IG51bGw7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoKytkb25lQ291bnQgPT09IGxpc3QubGVuZ3RoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGNhbGxiYWNrKGRpZEVycm9yT2NjdXIgPyBlcnJvcnMgOiBudWxsLCByZXN1bHRzKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGNhbGw8RiBleHRlbmRzIEZ1bmN0aW9uPihmdW46IEYsIHRoYXQ6IGFueSwgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHR0cnkge1xuXHRcdFx0ZnVuLmFwcGx5KHRoYXQsIGFyZ3MpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGFyZ3NbYXJncy5sZW5ndGggLSAxXShlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNtZFRyYXZlcnNhbChmb2xkZXJRdWVyeTogSUZvbGRlclF1ZXJ5LCBudW1UaHJlYWRzOiBudW1iZXIgfCB1bmRlZmluZWQsIG9uUmVzdWx0OiAocmVzdWx0OiBJUmF3RmlsZU1hdGNoKSA9PiB2b2lkLCBvbk1lc3NhZ2U6IChtZXNzYWdlOiBJUHJvZ3Jlc3NNZXNzYWdlKSA9PiB2b2lkLCBjYjogKGVycj86IEVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0Y29uc3Qgcm9vdEZvbGRlciA9IGZvbGRlclF1ZXJ5LmZvbGRlci5mc1BhdGg7XG5cdFx0Y29uc3QgaXNNYWMgPSBwbGF0Zm9ybS5pc01hY2ludG9zaDtcblxuXHRcdGNvbnN0IGtpbGxDbWQgPSAoKSA9PiBjbWQgJiYgY21kLmtpbGwoKTtcblx0XHRraWxsQ21kcy5hZGQoa2lsbENtZCk7XG5cblx0XHRsZXQgZG9uZSA9IChlcnI/OiBFcnJvcikgPT4ge1xuXHRcdFx0a2lsbENtZHMuZGVsZXRlKGtpbGxDbWQpO1xuXHRcdFx0ZG9uZSA9ICgpID0+IHsgfTtcblx0XHRcdGNiKGVycik7XG5cdFx0fTtcblx0XHRsZXQgbGVmdG92ZXIgPSAnJztcblx0XHRjb25zdCB0cmVlID0gdGhpcy5pbml0RGlyZWN0b3J5VHJlZSgpO1xuXG5cdFx0Y29uc3QgcmlwZ3JlcCA9IHNwYXduUmlwZ3JlcENtZCh0aGlzLmNvbmZpZywgZm9sZGVyUXVlcnksIHRoaXMuY29uZmlnLmluY2x1ZGVQYXR0ZXJuLCB0aGlzLmZvbGRlckV4Y2x1ZGVQYXR0ZXJucy5nZXQoZm9sZGVyUXVlcnkuZm9sZGVyLmZzUGF0aCkhLmV4cHJlc3Npb24sIG51bVRocmVhZHMpO1xuXHRcdGNvbnN0IGNtZCA9IHJpcGdyZXAuY21kO1xuXHRcdGNvbnN0IG5vU2libGluZ3NDbGF1c2VzID0gIU9iamVjdC5rZXlzKHJpcGdyZXAuc2libGluZ0NsYXVzZXMpLmxlbmd0aDtcblxuXHRcdGNvbnN0IGVzY2FwZWRBcmdzID0gcmlwZ3JlcC5yZ0FyZ3MuYXJnc1xuXHRcdFx0Lm1hcChhcmcgPT4gYXJnLm1hdGNoKC9eLS8pID8gYXJnIDogYCcke2FyZ30nYClcblx0XHRcdC5qb2luKCcgJyk7XG5cblx0XHRsZXQgcmdDbWQgPSBgJHtyaXBncmVwLnJnRGlza1BhdGh9ICR7ZXNjYXBlZEFyZ3N9XFxuIC0gY3dkOiAke3JpcGdyZXAuY3dkfWA7XG5cdFx0aWYgKHJpcGdyZXAucmdBcmdzLnNpYmxpbmdDbGF1c2VzKSB7XG5cdFx0XHRyZ0NtZCArPSBgXFxuIC0gU2libGluZyBjbGF1c2VzOiAke0pTT04uc3RyaW5naWZ5KHJpcGdyZXAucmdBcmdzLnNpYmxpbmdDbGF1c2VzKX1gO1xuXHRcdH1cblx0XHRvbk1lc3NhZ2UoeyBtZXNzYWdlOiByZ0NtZCB9KTtcblxuXHRcdHRoaXMuY21kUmVzdWx0Q291bnQgPSAwO1xuXHRcdHRoaXMuY29sbGVjdFN0ZG91dChjbWQsICd1dGY4Jywgb25NZXNzYWdlLCAoZXJyOiBFcnJvciB8IG51bGwsIHN0ZG91dD86IHN0cmluZywgbGFzdD86IGJvb2xlYW4pID0+IHtcblx0XHRcdGlmIChlcnIpIHtcblx0XHRcdFx0ZG9uZShlcnIpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5pc0xpbWl0SGl0KSB7XG5cdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBNYWM6IHVzZXMgTkZEIHVuaWNvZGUgZm9ybSBvbiBkaXNrLCBidXQgd2Ugd2FudCBORkNcblx0XHRcdGNvbnN0IG5vcm1hbGl6ZWQgPSBsZWZ0b3ZlciArIChpc01hYyA/IG5vcm1hbGl6YXRpb24ubm9ybWFsaXplTkZDKHN0ZG91dCB8fCAnJykgOiBzdGRvdXQpO1xuXHRcdFx0Y29uc3QgcmVsYXRpdmVGaWxlcyA9IG5vcm1hbGl6ZWQuc3BsaXQoJ1xcbicpO1xuXG5cdFx0XHRpZiAobGFzdCkge1xuXHRcdFx0XHRjb25zdCBuID0gcmVsYXRpdmVGaWxlcy5sZW5ndGg7XG5cdFx0XHRcdHJlbGF0aXZlRmlsZXNbbiAtIDFdID0gcmVsYXRpdmVGaWxlc1tuIC0gMV0udHJpbSgpO1xuXHRcdFx0XHRpZiAoIXJlbGF0aXZlRmlsZXNbbiAtIDFdKSB7XG5cdFx0XHRcdFx0cmVsYXRpdmVGaWxlcy5wb3AoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGVmdG92ZXIgPSByZWxhdGl2ZUZpbGVzLnBvcCgpIHx8ICcnO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVsYXRpdmVGaWxlcy5sZW5ndGggJiYgcmVsYXRpdmVGaWxlc1swXS5pbmRleE9mKCdcXG4nKSAhPT0gLTEpIHtcblx0XHRcdFx0ZG9uZShuZXcgRXJyb3IoJ1NwbGl0dGluZyB1cCBmaWxlcyBmYWlsZWQnKSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5jbWRSZXN1bHRDb3VudCArPSByZWxhdGl2ZUZpbGVzLmxlbmd0aDtcblxuXHRcdFx0aWYgKG5vU2libGluZ3NDbGF1c2VzKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgcmVsYXRpdmVQYXRoIG9mIHJlbGF0aXZlRmlsZXMpIHtcblx0XHRcdFx0XHR0aGlzLm1hdGNoRmlsZShvblJlc3VsdCwgeyBiYXNlOiByb290Rm9sZGVyLCByZWxhdGl2ZVBhdGgsIHNlYXJjaFBhdGg6IHRoaXMuZ2V0U2VhcmNoUGF0aChmb2xkZXJRdWVyeSwgcmVsYXRpdmVQYXRoKSB9KTtcblx0XHRcdFx0XHRpZiAodGhpcy5pc0xpbWl0SGl0KSB7XG5cdFx0XHRcdFx0XHRraWxsQ21kKCk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGxhc3QgfHwgdGhpcy5pc0xpbWl0SGl0KSB7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUT0RPOiBPcHRpbWl6ZSBzaWJsaW5ncyBjbGF1c2VzIHdpdGggcmlwZ3JlcCBoZXJlLlxuXHRcdFx0dGhpcy5hZGREaXJlY3RvcnlFbnRyaWVzKGZvbGRlclF1ZXJ5LCB0cmVlLCByb290Rm9sZGVyLCByZWxhdGl2ZUZpbGVzLCBvblJlc3VsdCk7XG5cblx0XHRcdGlmIChsYXN0KSB7XG5cdFx0XHRcdHRoaXMubWF0Y2hEaXJlY3RvcnlUcmVlKHRyZWUsIHJvb3RGb2xkZXIsIG9uUmVzdWx0KTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFB1YmxpYyBmb3IgdGVzdGluZy5cblx0ICovXG5cdHNwYXduRmluZENtZChmb2xkZXJRdWVyeTogSUZvbGRlclF1ZXJ5KSB7XG5cdFx0Y29uc3QgZXhjbHVkZVBhdHRlcm4gPSB0aGlzLmZvbGRlckV4Y2x1ZGVQYXR0ZXJucy5nZXQoZm9sZGVyUXVlcnkuZm9sZGVyLmZzUGF0aCkhO1xuXHRcdGNvbnN0IGJhc2VuYW1lcyA9IGV4Y2x1ZGVQYXR0ZXJuLmdldEJhc2VuYW1lVGVybXMoKTtcblx0XHRjb25zdCBwYXRoVGVybXMgPSBleGNsdWRlUGF0dGVybi5nZXRQYXRoVGVybXMoKTtcblx0XHRjb25zdCBhcmdzID0gWyctTCcsICcuJ107XG5cdFx0aWYgKGJhc2VuYW1lcy5sZW5ndGggfHwgcGF0aFRlcm1zLmxlbmd0aCkge1xuXHRcdFx0YXJncy5wdXNoKCctbm90JywgJygnLCAnKCcpO1xuXHRcdFx0Zm9yIChjb25zdCBiYXNlbmFtZSBvZiBiYXNlbmFtZXMpIHtcblx0XHRcdFx0YXJncy5wdXNoKCctbmFtZScsIGJhc2VuYW1lKTtcblx0XHRcdFx0YXJncy5wdXNoKCctbycpO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCBwYXRoIG9mIHBhdGhUZXJtcykge1xuXHRcdFx0XHRhcmdzLnB1c2goJy1wYXRoJywgcGF0aCk7XG5cdFx0XHRcdGFyZ3MucHVzaCgnLW8nKTtcblx0XHRcdH1cblx0XHRcdGFyZ3MucG9wKCk7XG5cdFx0XHRhcmdzLnB1c2goJyknLCAnLXBydW5lJywgJyknKTtcblx0XHR9XG5cdFx0YXJncy5wdXNoKCctdHlwZScsICdmJyk7XG5cdFx0cmV0dXJuIGNoaWxkUHJvY2Vzcy5zcGF3bignZmluZCcsIGFyZ3MsIHsgY3dkOiBmb2xkZXJRdWVyeS5mb2xkZXIuZnNQYXRoIH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFB1YmxpYyBmb3IgdGVzdGluZy5cblx0ICovXG5cdHJlYWRTdGRvdXQoY21kOiBjaGlsZFByb2Nlc3MuQ2hpbGRQcm9jZXNzLCBlbmNvZGluZzogQnVmZmVyRW5jb2RpbmcsIGNiOiAoZXJyOiBFcnJvciB8IG51bGwsIHN0ZG91dD86IHN0cmluZykgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGxldCBhbGwgPSAnJztcblx0XHR0aGlzLmNvbGxlY3RTdGRvdXQoY21kLCBlbmNvZGluZywgKCkgPT4geyB9LCAoZXJyOiBFcnJvciB8IG51bGwsIHN0ZG91dD86IHN0cmluZywgbGFzdD86IGJvb2xlYW4pID0+IHtcblx0XHRcdGlmIChlcnIpIHtcblx0XHRcdFx0Y2IoZXJyKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRhbGwgKz0gc3Rkb3V0O1xuXHRcdFx0aWYgKGxhc3QpIHtcblx0XHRcdFx0Y2IobnVsbCwgYWxsKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgY29sbGVjdFN0ZG91dChjbWQ6IGNoaWxkUHJvY2Vzcy5DaGlsZFByb2Nlc3MsIGVuY29kaW5nOiBCdWZmZXJFbmNvZGluZywgb25NZXNzYWdlOiAobWVzc2FnZTogSVByb2dyZXNzTWVzc2FnZSkgPT4gdm9pZCwgY2I6IChlcnI6IEVycm9yIHwgbnVsbCwgc3Rkb3V0Pzogc3RyaW5nLCBsYXN0PzogYm9vbGVhbikgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGxldCBvbkRhdGEgPSAoZXJyOiBFcnJvciB8IG51bGwsIHN0ZG91dD86IHN0cmluZywgbGFzdD86IGJvb2xlYW4pID0+IHtcblx0XHRcdGlmIChlcnIgfHwgbGFzdCkge1xuXHRcdFx0XHRvbkRhdGEgPSAoKSA9PiB7IH07XG5cblx0XHRcdFx0dGhpcy5jbWRTVz8uc3RvcCgpO1xuXHRcdFx0fVxuXHRcdFx0Y2IoZXJyLCBzdGRvdXQsIGxhc3QpO1xuXHRcdH07XG5cblx0XHRsZXQgZ290RGF0YSA9IGZhbHNlO1xuXHRcdGlmIChjbWQuc3Rkb3V0KSB7XG5cdFx0XHQvLyBTaG91bGQgYmUgbm9uLW51bGwsIGJ1dCAjMzgxOTVcblx0XHRcdHRoaXMuZm9yd2FyZERhdGEoY21kLnN0ZG91dCwgZW5jb2RpbmcsIG9uRGF0YSk7XG5cdFx0XHRjbWQuc3Rkb3V0Lm9uY2UoJ2RhdGEnLCAoKSA9PiBnb3REYXRhID0gdHJ1ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG9uTWVzc2FnZSh7IG1lc3NhZ2U6ICdzdGRvdXQgaXMgbnVsbCcgfSk7XG5cdFx0fVxuXG5cdFx0bGV0IHN0ZGVycjogQnVmZmVyW107XG5cdFx0aWYgKGNtZC5zdGRlcnIpIHtcblx0XHRcdC8vIFNob3VsZCBiZSBub24tbnVsbCwgYnV0ICMzODE5NVxuXHRcdFx0c3RkZXJyID0gdGhpcy5jb2xsZWN0RGF0YShjbWQuc3RkZXJyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0b25NZXNzYWdlKHsgbWVzc2FnZTogJ3N0ZGVyciBpcyBudWxsJyB9KTtcblx0XHR9XG5cblx0XHRjbWQub24oJ2Vycm9yJywgKGVycjogRXJyb3IpID0+IHtcblx0XHRcdG9uRGF0YShlcnIpO1xuXHRcdH0pO1xuXG5cdFx0Y21kLm9uKCdjbG9zZScsIChjb2RlOiBudW1iZXIpID0+IHtcblx0XHRcdC8vIHJpcGdyZXAgcmV0dXJucyBjb2RlPTEgd2hlbiBubyByZXN1bHRzIGFyZSBmb3VuZFxuXHRcdFx0bGV0IHN0ZGVyclRleHQ6IHN0cmluZztcblx0XHRcdGlmICghZ290RGF0YSAmJiAoc3RkZXJyVGV4dCA9IHRoaXMuZGVjb2RlRGF0YShzdGRlcnIsIGVuY29kaW5nKSkgJiYgcmdFcnJvck1zZ0ZvckRpc3BsYXkoc3RkZXJyVGV4dCkpIHtcblx0XHRcdFx0b25EYXRhKG5ldyBFcnJvcihgY29tbWFuZCBmYWlsZWQgd2l0aCBlcnJvciBjb2RlICR7Y29kZX06ICR7dGhpcy5kZWNvZGVEYXRhKHN0ZGVyciwgZW5jb2RpbmcpfWApKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICh0aGlzLmV4aXN0cyAmJiBjb2RlID09PSAwKSB7XG5cdFx0XHRcdFx0dGhpcy5pc0xpbWl0SGl0ID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRvbkRhdGEobnVsbCwgJycsIHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBmb3J3YXJkRGF0YShzdHJlYW06IFJlYWRhYmxlLCBlbmNvZGluZzogQnVmZmVyRW5jb2RpbmcsIGNiOiAoZXJyOiBFcnJvciB8IG51bGwsIHN0ZG91dD86IHN0cmluZykgPT4gdm9pZCk6IFN0cmluZ0RlY29kZXIge1xuXHRcdGNvbnN0IGRlY29kZXIgPSBuZXcgU3RyaW5nRGVjb2RlcihlbmNvZGluZyk7XG5cdFx0c3RyZWFtLm9uKCdkYXRhJywgKGRhdGE6IEJ1ZmZlcikgPT4ge1xuXHRcdFx0Y2IobnVsbCwgZGVjb2Rlci53cml0ZShkYXRhKSk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGRlY29kZXI7XG5cdH1cblxuXHRwcml2YXRlIGNvbGxlY3REYXRhKHN0cmVhbTogUmVhZGFibGUpOiBCdWZmZXJbXSB7XG5cdFx0Y29uc3QgYnVmZmVyczogQnVmZmVyW10gPSBbXTtcblx0XHRzdHJlYW0ub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiB7XG5cdFx0XHRidWZmZXJzLnB1c2goZGF0YSk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGJ1ZmZlcnM7XG5cdH1cblxuXHRwcml2YXRlIGRlY29kZURhdGEoYnVmZmVyczogQnVmZmVyW10sIGVuY29kaW5nOiBCdWZmZXJFbmNvZGluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgZGVjb2RlciA9IG5ldyBTdHJpbmdEZWNvZGVyKGVuY29kaW5nKTtcblx0XHRyZXR1cm4gYnVmZmVycy5tYXAoYnVmZmVyID0+IGRlY29kZXIud3JpdGUoYnVmZmVyKSkuam9pbignJyk7XG5cdH1cblxuXHRwcml2YXRlIGluaXREaXJlY3RvcnlUcmVlKCk6IElEaXJlY3RvcnlUcmVlIHtcblx0XHRjb25zdCB0cmVlOiBJRGlyZWN0b3J5VHJlZSA9IHtcblx0XHRcdHJvb3RFbnRyaWVzOiBbXSxcblx0XHRcdHBhdGhUb0VudHJpZXM6IE9iamVjdC5jcmVhdGUobnVsbClcblx0XHR9O1xuXHRcdHRyZWUucGF0aFRvRW50cmllc1snLiddID0gdHJlZS5yb290RW50cmllcztcblx0XHRyZXR1cm4gdHJlZTtcblx0fVxuXG5cdHByaXZhdGUgYWRkRGlyZWN0b3J5RW50cmllcyhmb2xkZXJRdWVyeTogSUZvbGRlclF1ZXJ5LCB7IHBhdGhUb0VudHJpZXMgfTogSURpcmVjdG9yeVRyZWUsIGJhc2U6IHN0cmluZywgcmVsYXRpdmVGaWxlczogc3RyaW5nW10sIG9uUmVzdWx0OiAocmVzdWx0OiBJUmF3RmlsZU1hdGNoKSA9PiB2b2lkKSB7XG5cdFx0Ly8gU3VwcG9ydCByZWxhdGl2ZSBwYXRocyB0byBmaWxlcyBmcm9tIGEgcm9vdCByZXNvdXJjZSAoaWdub3JlcyBleGNsdWRlcylcblx0XHRpZiAocmVsYXRpdmVGaWxlcy5pbmRleE9mKHRoaXMuZmlsZVBhdHRlcm4pICE9PSAtMSkge1xuXHRcdFx0dGhpcy5tYXRjaEZpbGUob25SZXN1bHQsIHtcblx0XHRcdFx0YmFzZSxcblx0XHRcdFx0cmVsYXRpdmVQYXRoOiB0aGlzLmZpbGVQYXR0ZXJuLFxuXHRcdFx0XHRzZWFyY2hQYXRoOiB0aGlzLmdldFNlYXJjaFBhdGgoZm9sZGVyUXVlcnksIHRoaXMuZmlsZVBhdHRlcm4pXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCBhZGQgPSAocmVsYXRpdmVQYXRoOiBzdHJpbmcpID0+IHtcblx0XHRcdGNvbnN0IGJhc2VuYW1lID0gcGF0aC5iYXNlbmFtZShyZWxhdGl2ZVBhdGgpO1xuXHRcdFx0Y29uc3QgZGlybmFtZSA9IHBhdGguZGlybmFtZShyZWxhdGl2ZVBhdGgpO1xuXHRcdFx0bGV0IGVudHJpZXMgPSBwYXRoVG9FbnRyaWVzW2Rpcm5hbWVdO1xuXHRcdFx0aWYgKCFlbnRyaWVzKSB7XG5cdFx0XHRcdGVudHJpZXMgPSBwYXRoVG9FbnRyaWVzW2Rpcm5hbWVdID0gW107XG5cdFx0XHRcdGFkZChkaXJuYW1lKTtcblx0XHRcdH1cblx0XHRcdGVudHJpZXMucHVzaCh7XG5cdFx0XHRcdGJhc2UsXG5cdFx0XHRcdHJlbGF0aXZlUGF0aCxcblx0XHRcdFx0YmFzZW5hbWUsXG5cdFx0XHRcdHNlYXJjaFBhdGg6IHRoaXMuZ2V0U2VhcmNoUGF0aChmb2xkZXJRdWVyeSwgcmVsYXRpdmVQYXRoKSxcblx0XHRcdH0pO1xuXHRcdH07XG5cdFx0cmVsYXRpdmVGaWxlcy5mb3JFYWNoKGFkZCk7XG5cdH1cblxuXHRwcml2YXRlIG1hdGNoRGlyZWN0b3J5VHJlZSh7IHJvb3RFbnRyaWVzLCBwYXRoVG9FbnRyaWVzIH06IElEaXJlY3RvcnlUcmVlLCByb290Rm9sZGVyOiBzdHJpbmcsIG9uUmVzdWx0OiAocmVzdWx0OiBJUmF3RmlsZU1hdGNoKSA9PiB2b2lkKSB7XG5cdFx0Y29uc3Qgc2VsZiA9IHRoaXM7XG5cdFx0Y29uc3QgZXhjbHVkZVBhdHRlcm4gPSB0aGlzLmZvbGRlckV4Y2x1ZGVQYXR0ZXJucy5nZXQocm9vdEZvbGRlcikhO1xuXHRcdGNvbnN0IGZpbGVQYXR0ZXJuID0gdGhpcy5maWxlUGF0dGVybjtcblx0XHRmdW5jdGlvbiBtYXRjaERpcmVjdG9yeShlbnRyaWVzOiBJRGlyZWN0b3J5RW50cnlbXSkge1xuXHRcdFx0c2VsZi5kaXJlY3Rvcmllc1dhbGtlZCsrO1xuXHRcdFx0Y29uc3QgaGFzU2libGluZyA9IGhhc1NpYmxpbmdGbigoKSA9PiBlbnRyaWVzLm1hcChlbnRyeSA9PiBlbnRyeS5iYXNlbmFtZSkpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIG4gPSBlbnRyaWVzLmxlbmd0aDsgaSA8IG47IGkrKykge1xuXHRcdFx0XHRjb25zdCBlbnRyeSA9IGVudHJpZXNbaV07XG5cdFx0XHRcdGNvbnN0IHsgcmVsYXRpdmVQYXRoLCBiYXNlbmFtZSB9ID0gZW50cnk7XG5cblx0XHRcdFx0Ly8gQ2hlY2sgZXhjbHVkZSBwYXR0ZXJuXG5cdFx0XHRcdC8vIElmIHRoZSB1c2VyIHNlYXJjaGVzIGZvciB0aGUgZXhhY3QgZmlsZSBuYW1lLCB3ZSBhZGp1c3QgdGhlIGdsb2IgbWF0Y2hpbmdcblx0XHRcdFx0Ly8gdG8gaWdub3JlIGZpbHRlcmluZyBieSBzaWJsaW5ncyBiZWNhdXNlIHRoZSB1c2VyIHNlZW1zIHRvIGtub3cgd2hhdCB0aGV5XG5cdFx0XHRcdC8vIGFyZSBzZWFyY2hpbmcgZm9yIGFuZCB3ZSB3YW50IHRvIGluY2x1ZGUgdGhlIHJlc3VsdCBpbiB0aGF0IGNhc2UgYW55d2F5XG5cdFx0XHRcdGlmIChleGNsdWRlUGF0dGVybi50ZXN0KHJlbGF0aXZlUGF0aCwgYmFzZW5hbWUsIGZpbGVQYXR0ZXJuICE9PSBiYXNlbmFtZSA/IGhhc1NpYmxpbmcgOiB1bmRlZmluZWQpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBzdWIgPSBwYXRoVG9FbnRyaWVzW3JlbGF0aXZlUGF0aF07XG5cdFx0XHRcdGlmIChzdWIpIHtcblx0XHRcdFx0XHRtYXRjaERpcmVjdG9yeShzdWIpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNlbGYuZmlsZXNXYWxrZWQrKztcblx0XHRcdFx0XHRpZiAocmVsYXRpdmVQYXRoID09PSBmaWxlUGF0dGVybikge1xuXHRcdFx0XHRcdFx0Y29udGludWU7IC8vIGlnbm9yZSBmaWxlIGlmIGl0cyBwYXRoIG1hdGNoZXMgd2l0aCB0aGUgZmlsZSBwYXR0ZXJuIGJlY2F1c2UgdGhhdCBpcyBhbHJlYWR5IG1hdGNoZWQgYWJvdmVcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRzZWxmLm1hdGNoRmlsZShvblJlc3VsdCwgZW50cnkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHNlbGYuaXNMaW1pdEhpdCkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdG1hdGNoRGlyZWN0b3J5KHJvb3RFbnRyaWVzKTtcblx0fVxuXG5cdGdldFN0YXRzKCk6IElTZWFyY2hFbmdpbmVTdGF0cyB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGNtZFRpbWU6IHRoaXMuY21kU1chLmVsYXBzZWQoKSxcblx0XHRcdGZpbGVXYWxrVGltZTogdGhpcy5maWxlV2Fsa1NXIS5lbGFwc2VkKCksXG5cdFx0XHRkaXJlY3Rvcmllc1dhbGtlZDogdGhpcy5kaXJlY3Rvcmllc1dhbGtlZCxcblx0XHRcdGZpbGVzV2Fsa2VkOiB0aGlzLmZpbGVzV2Fsa2VkLFxuXHRcdFx0Y21kUmVzdWx0Q291bnQ6IHRoaXMuY21kUmVzdWx0Q291bnRcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBkb1dhbGsoZm9sZGVyUXVlcnk6IElGb2xkZXJRdWVyeSwgcmVsYXRpdmVQYXJlbnRQYXRoOiBzdHJpbmcsIGZpbGVzOiBzdHJpbmdbXSwgb25SZXN1bHQ6IChyZXN1bHQ6IElSYXdGaWxlTWF0Y2gpID0+IHZvaWQsIGRvbmU6IChlcnJvcj86IEVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0Y29uc3Qgcm9vdEZvbGRlciA9IGZvbGRlclF1ZXJ5LmZvbGRlcjtcblxuXHRcdC8vIEV4ZWN1dGUgdGFza3Mgb24gZWFjaCBmaWxlIGluIHBhcmFsbGVsIHRvIG9wdGltaXplIHRocm91Z2hwdXRcblx0XHRjb25zdCBoYXNTaWJsaW5nID0gaGFzU2libGluZ0ZuKCgpID0+IGZpbGVzKTtcblx0XHR0aGlzLnBhcmFsbGVsKGZpbGVzLCAoZmlsZTogc3RyaW5nLCBjbGI6IChlcnJvcjogRXJyb3IgfCBudWxsLCBfPzogYW55KSA9PiB2b2lkKTogdm9pZCA9PiB7XG5cblx0XHRcdC8vIENoZWNrIGNhbmNlbGVkXG5cdFx0XHRpZiAodGhpcy5pc0NhbmNlbGVkIHx8IHRoaXMuaXNMaW1pdEhpdCkge1xuXHRcdFx0XHRyZXR1cm4gY2xiKG51bGwpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBDaGVjayBleGNsdWRlIHBhdHRlcm5cblx0XHRcdC8vIElmIHRoZSB1c2VyIHNlYXJjaGVzIGZvciB0aGUgZXhhY3QgZmlsZSBuYW1lLCB3ZSBhZGp1c3QgdGhlIGdsb2IgbWF0Y2hpbmdcblx0XHRcdC8vIHRvIGlnbm9yZSBmaWx0ZXJpbmcgYnkgc2libGluZ3MgYmVjYXVzZSB0aGUgdXNlciBzZWVtcyB0byBrbm93IHdoYXQgdGhleVxuXHRcdFx0Ly8gYXJlIHNlYXJjaGluZyBmb3IgYW5kIHdlIHdhbnQgdG8gaW5jbHVkZSB0aGUgcmVzdWx0IGluIHRoYXQgY2FzZSBhbnl3YXlcblx0XHRcdGNvbnN0IGN1cnJlbnRSZWxhdGl2ZVBhdGggPSByZWxhdGl2ZVBhcmVudFBhdGggPyBbcmVsYXRpdmVQYXJlbnRQYXRoLCBmaWxlXS5qb2luKHBhdGguc2VwKSA6IGZpbGU7XG5cdFx0XHRpZiAodGhpcy5mb2xkZXJFeGNsdWRlUGF0dGVybnMuZ2V0KGZvbGRlclF1ZXJ5LmZvbGRlci5mc1BhdGgpIS50ZXN0KGN1cnJlbnRSZWxhdGl2ZVBhdGgsIGZpbGUsIHRoaXMuY29uZmlnLmZpbGVQYXR0ZXJuICE9PSBmaWxlID8gaGFzU2libGluZyA6IHVuZGVmaW5lZCkpIHtcblx0XHRcdFx0cmV0dXJuIGNsYihudWxsKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gVXNlIGxzdGF0IHRvIGRldGVjdCBsaW5rc1xuXHRcdFx0Y29uc3QgY3VycmVudEFic29sdXRlUGF0aCA9IFtyb290Rm9sZGVyLmZzUGF0aCwgY3VycmVudFJlbGF0aXZlUGF0aF0uam9pbihwYXRoLnNlcCk7XG5cdFx0XHRmcy5sc3RhdChjdXJyZW50QWJzb2x1dGVQYXRoLCAoZXJyb3IsIGxzdGF0KSA9PiB7XG5cdFx0XHRcdGlmIChlcnJvciB8fCB0aGlzLmlzQ2FuY2VsZWQgfHwgdGhpcy5pc0xpbWl0SGl0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGNsYihudWxsKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIElmIHRoZSBwYXRoIGlzIGEgbGluaywgd2UgbXVzdCBpbnN0ZWFkIHVzZSBmcy5zdGF0KCkgdG8gZmluZCBvdXQgaWYgdGhlXG5cdFx0XHRcdC8vIGxpbmsgaXMgYSBkaXJlY3Rvcnkgb3Igbm90IGJlY2F1c2UgbHN0YXQgd2lsbCBhbHdheXMgcmV0dXJuIHRoZSBzdGF0IG9mXG5cdFx0XHRcdC8vIHRoZSBsaW5rIHdoaWNoIGlzIGFsd2F5cyBhIGZpbGUuXG5cdFx0XHRcdHRoaXMuc3RhdExpbmtJZk5lZWRlZChjdXJyZW50QWJzb2x1dGVQYXRoLCBsc3RhdCwgKGVycm9yLCBzdGF0KSA9PiB7XG5cdFx0XHRcdFx0aWYgKGVycm9yIHx8IHRoaXMuaXNDYW5jZWxlZCB8fCB0aGlzLmlzTGltaXRIaXQpIHtcblx0XHRcdFx0XHRcdHJldHVybiBjbGIobnVsbCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gRGlyZWN0b3J5OiBGb2xsb3cgZGlyZWN0b3JpZXNcblx0XHRcdFx0XHRpZiAoc3RhdC5pc0RpcmVjdG9yeSgpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmRpcmVjdG9yaWVzV2Fsa2VkKys7XG5cblx0XHRcdFx0XHRcdC8vIHRvIHJlYWxseSBwcmV2ZW50IGxvb3BzIHdpdGggbGlua3Mgd2UgbmVlZCB0byByZXNvbHZlIHRoZSByZWFsIHBhdGggb2YgdGhlbVxuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMucmVhbFBhdGhJZk5lZWRlZChjdXJyZW50QWJzb2x1dGVQYXRoLCBsc3RhdCwgKGVycm9yLCByZWFscGF0aCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRpZiAoZXJyb3IgfHwgdGhpcy5pc0NhbmNlbGVkIHx8IHRoaXMuaXNMaW1pdEhpdCkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBjbGIobnVsbCk7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRyZWFscGF0aCA9IHJlYWxwYXRoIHx8ICcnO1xuXHRcdFx0XHRcdFx0XHRpZiAodGhpcy53YWxrZWRQYXRoc1tyZWFscGF0aF0pIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gY2xiKG51bGwpOyAvLyBlc2NhcGUgd2hlbiB0aGVyZSBhcmUgY3ljbGVzIChjYW4gaGFwcGVuIHdpdGggc3ltbGlua3MpXG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHR0aGlzLndhbGtlZFBhdGhzW3JlYWxwYXRoXSA9IHRydWU7IC8vIHJlbWVtYmVyIGFzIHdhbGtlZFxuXG5cdFx0XHRcdFx0XHRcdC8vIENvbnRpbnVlIHdhbGtpbmdcblx0XHRcdFx0XHRcdFx0cmV0dXJuIFByb21pc2VzLnJlYWRkaXIoY3VycmVudEFic29sdXRlUGF0aCkudGhlbihjaGlsZHJlbiA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHRoaXMuaXNDYW5jZWxlZCB8fCB0aGlzLmlzTGltaXRIaXQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiBjbGIobnVsbCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5kb1dhbGsoZm9sZGVyUXVlcnksIGN1cnJlbnRSZWxhdGl2ZVBhdGgsIGNoaWxkcmVuLCBvblJlc3VsdCwgZXJyID0+IGNsYihlcnIgfHwgbnVsbCkpO1xuXHRcdFx0XHRcdFx0XHR9LCBlcnJvciA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0Y2xiKG51bGwpO1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIEZpbGU6IENoZWNrIGZvciBtYXRjaCBvbiBmaWxlIHBhdHRlcm4gYW5kIGluY2x1ZGUgcGF0dGVyblxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5maWxlc1dhbGtlZCsrO1xuXHRcdFx0XHRcdFx0aWYgKGN1cnJlbnRSZWxhdGl2ZVBhdGggPT09IHRoaXMuZmlsZVBhdHRlcm4pIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGNsYihudWxsLCB1bmRlZmluZWQpOyAvLyBpZ25vcmUgZmlsZSBpZiBpdHMgcGF0aCBtYXRjaGVzIHdpdGggdGhlIGZpbGUgcGF0dGVybiBiZWNhdXNlIGNoZWNrRmlsZVBhdHRlcm5SZWxhdGl2ZU1hdGNoKCkgdGFrZXMgY2FyZSBvZiB0aG9zZVxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRpZiAodGhpcy5tYXhGaWxlc2l6ZSAmJiB0eXBlcy5pc051bWJlcihzdGF0LnNpemUpICYmIHN0YXQuc2l6ZSA+IHRoaXMubWF4RmlsZXNpemUpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGNsYihudWxsLCB1bmRlZmluZWQpOyAvLyBpZ25vcmUgZmlsZSBpZiBtYXggZmlsZSBzaXplIGlzIGhpdFxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHR0aGlzLm1hdGNoRmlsZShvblJlc3VsdCwge1xuXHRcdFx0XHRcdFx0XHRiYXNlOiByb290Rm9sZGVyLmZzUGF0aCxcblx0XHRcdFx0XHRcdFx0cmVsYXRpdmVQYXRoOiBjdXJyZW50UmVsYXRpdmVQYXRoLFxuXHRcdFx0XHRcdFx0XHRzZWFyY2hQYXRoOiB0aGlzLmdldFNlYXJjaFBhdGgoZm9sZGVyUXVlcnksIGN1cnJlbnRSZWxhdGl2ZVBhdGgpLFxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gVW53aW5kXG5cdFx0XHRcdFx0cmV0dXJuIGNsYihudWxsLCB1bmRlZmluZWQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0sIChlcnJvcjogQXJyYXk8RXJyb3IgfCBudWxsPiB8IG51bGwpOiB2b2lkID0+IHtcblx0XHRcdGNvbnN0IGZpbHRlcmVkRXJyb3JzID0gZXJyb3IgPyBhcnJheXMuY29hbGVzY2UoZXJyb3IpIDogZXJyb3I7IC8vIGZpbmQgYW55IGVycm9yIGJ5IHJlbW92aW5nIG51bGwgdmFsdWVzIGZpcnN0XG5cdFx0XHRyZXR1cm4gZG9uZShmaWx0ZXJlZEVycm9ycyAmJiBmaWx0ZXJlZEVycm9ycy5sZW5ndGggPiAwID8gZmlsdGVyZWRFcnJvcnNbMF0gOiB1bmRlZmluZWQpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBtYXRjaEZpbGUob25SZXN1bHQ6IChyZXN1bHQ6IElSYXdGaWxlTWF0Y2gpID0+IHZvaWQsIGNhbmRpZGF0ZTogSVJhd0ZpbGVNYXRjaCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzRmlsZU1hdGNoKGNhbmRpZGF0ZSkgJiYgKCF0aGlzLmluY2x1ZGVQYXR0ZXJuIHx8IHRoaXMuaW5jbHVkZVBhdHRlcm4oY2FuZGlkYXRlLnJlbGF0aXZlUGF0aCwgcGF0aC5iYXNlbmFtZShjYW5kaWRhdGUucmVsYXRpdmVQYXRoKSkpKSB7XG5cdFx0XHR0aGlzLnJlc3VsdENvdW50Kys7XG5cblx0XHRcdGlmICh0aGlzLmV4aXN0cyB8fCAodGhpcy5tYXhSZXN1bHRzICYmIHRoaXMucmVzdWx0Q291bnQgPiB0aGlzLm1heFJlc3VsdHMpKSB7XG5cdFx0XHRcdHRoaXMuaXNMaW1pdEhpdCA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5pc0xpbWl0SGl0KSB7XG5cdFx0XHRcdG9uUmVzdWx0KGNhbmRpZGF0ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBpc0ZpbGVNYXRjaChjYW5kaWRhdGU6IElSYXdGaWxlTWF0Y2gpOiBib29sZWFuIHtcblx0XHQvLyBDaGVjayBmb3Igc2VhcmNoIHBhdHRlcm5cblx0XHRpZiAodGhpcy5maWxlUGF0dGVybikge1xuXHRcdFx0aWYgKHRoaXMuZmlsZVBhdHRlcm4gPT09ICcqJykge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gc3VwcG9ydCB0aGUgYWxsLW1hdGNoaW5nIHdpbGRjYXJkXG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLm5vcm1hbGl6ZWRGaWxlUGF0dGVybkxvd2VyY2FzZSkge1xuXHRcdFx0XHRyZXR1cm4gaXNGaWxlUGF0dGVybk1hdGNoKGNhbmRpZGF0ZSwgdGhpcy5ub3JtYWxpemVkRmlsZVBhdHRlcm5Mb3dlcmNhc2UpO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLmZpbGVQYXR0ZXJuKSB7XG5cdFx0XHRcdHJldHVybiBpc0ZpbGVQYXR0ZXJuTWF0Y2goY2FuZGlkYXRlLCB0aGlzLmZpbGVQYXR0ZXJuLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gTm8gcGF0dGVybnMgbWVhbnMgd2UgbWF0Y2ggYWxsXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRMaW5rSWZOZWVkZWQocGF0aDogc3RyaW5nLCBsc3RhdDogZnMuU3RhdHMsIGNsYjogKGVycm9yOiBFcnJvciB8IG51bGwsIHN0YXQ6IGZzLlN0YXRzKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0aWYgKGxzdGF0LmlzU3ltYm9saWNMaW5rKCkpIHtcblx0XHRcdHJldHVybiBmcy5zdGF0KHBhdGgsIGNsYik7IC8vIHN0YXQgdGhlIHRhcmdldCB0aGUgbGluayBwb2ludHMgdG9cblx0XHR9XG5cblx0XHRyZXR1cm4gY2xiKG51bGwsIGxzdGF0KTsgLy8gbm90IGEgbGluaywgc28gdGhlIHN0YXQgaXMgYWxyZWFkeSBvayBmb3IgdXNcblx0fVxuXG5cdHByaXZhdGUgcmVhbFBhdGhJZk5lZWRlZChwYXRoOiBzdHJpbmcsIGxzdGF0OiBmcy5TdGF0cywgY2xiOiAoZXJyb3I6IEVycm9yIHwgbnVsbCwgcmVhbHBhdGg/OiBzdHJpbmcpID0+IHZvaWQpOiB2b2lkIHtcblx0XHRpZiAobHN0YXQuaXNTeW1ib2xpY0xpbmsoKSkge1xuXHRcdFx0cmV0dXJuIGZzLnJlYWxwYXRoKHBhdGgsIChlcnJvciwgcmVhbHBhdGgpID0+IHtcblx0XHRcdFx0aWYgKGVycm9yKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGNsYihlcnJvcik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gY2xiKG51bGwsIHJlYWxwYXRoKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBjbGIobnVsbCwgcGF0aCk7XG5cdH1cblxuXHQvKipcblx0ICogSWYgd2UncmUgc2VhcmNoaW5nIGZvciBmaWxlcyBpbiBtdWx0aXBsZSB3b3Jrc3BhY2UgZm9sZGVycywgdGhlbiBiZXR0ZXIgcHJlcGVuZCB0aGVcblx0ICogbmFtZSBvZiB0aGUgd29ya3NwYWNlIGZvbGRlciB0byB0aGUgcGF0aCBvZiB0aGUgZmlsZS4gVGhpcyB3YXkgd2UnbGwgYmUgYWJsZSB0b1xuXHQgKiBiZXR0ZXIgZmlsdGVyIGZpbGVzIHRoYXQgYXJlIGFsbCBvbiB0aGUgdG9wIG9mIGEgd29ya3NwYWNlIGZvbGRlciBhbmQgaGF2ZSBhbGwgdGhlXG5cdCAqIHNhbWUgbmFtZS4gQSB0eXBpY2FsIGV4YW1wbGUgYXJlIGBwYWNrYWdlLmpzb25gIG9yIGBSRUFETUUubWRgIGZpbGVzLlxuXHQgKi9cblx0cHJpdmF0ZSBnZXRTZWFyY2hQYXRoKGZvbGRlclF1ZXJ5OiBJRm9sZGVyUXVlcnksIHJlbGF0aXZlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRpZiAoZm9sZGVyUXVlcnkuZm9sZGVyTmFtZSkge1xuXHRcdFx0cmV0dXJuIHBhdGguam9pbihmb2xkZXJRdWVyeS5mb2xkZXJOYW1lLCByZWxhdGl2ZVBhdGgpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVsYXRpdmVQYXRoO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFbmdpbmUgaW1wbGVtZW50cyBJU2VhcmNoRW5naW5lPElSYXdGaWxlTWF0Y2g+IHtcblx0cHJpdmF0ZSBmb2xkZXJRdWVyaWVzOiBJRm9sZGVyUXVlcnlbXTtcblx0cHJpdmF0ZSBleHRyYUZpbGVzOiBVUklbXTtcblx0cHJpdmF0ZSB3YWxrZXI6IEZpbGVXYWxrZXI7XG5cdHByaXZhdGUgbnVtVGhyZWFkcz86IG51bWJlcjtcblxuXHRjb25zdHJ1Y3Rvcihjb25maWc6IElGaWxlUXVlcnksIG51bVRocmVhZHM/OiBudW1iZXIpIHtcblx0XHR0aGlzLmZvbGRlclF1ZXJpZXMgPSBjb25maWcuZm9sZGVyUXVlcmllcztcblx0XHR0aGlzLmV4dHJhRmlsZXMgPSBjb25maWcuZXh0cmFGaWxlUmVzb3VyY2VzIHx8IFtdO1xuXHRcdHRoaXMubnVtVGhyZWFkcyA9IG51bVRocmVhZHM7XG5cblx0XHR0aGlzLndhbGtlciA9IG5ldyBGaWxlV2Fsa2VyKGNvbmZpZyk7XG5cdH1cblxuXHRzZWFyY2gob25SZXN1bHQ6IChyZXN1bHQ6IElSYXdGaWxlTWF0Y2gpID0+IHZvaWQsIG9uUHJvZ3Jlc3M6IChwcm9ncmVzczogSVByb2dyZXNzTWVzc2FnZSkgPT4gdm9pZCwgZG9uZTogKGVycm9yOiBFcnJvciB8IG51bGwsIGNvbXBsZXRlOiBJU2VhcmNoRW5naW5lU3VjY2VzcykgPT4gdm9pZCk6IHZvaWQge1xuXHRcdHRoaXMud2Fsa2VyLndhbGsodGhpcy5mb2xkZXJRdWVyaWVzLCB0aGlzLmV4dHJhRmlsZXMsIHRoaXMubnVtVGhyZWFkcywgb25SZXN1bHQsIG9uUHJvZ3Jlc3MsIChlcnI6IEVycm9yIHwgbnVsbCwgaXNMaW1pdEhpdDogYm9vbGVhbikgPT4ge1xuXHRcdFx0ZG9uZShlcnIsIHtcblx0XHRcdFx0bGltaXRIaXQ6IGlzTGltaXRIaXQsXG5cdFx0XHRcdHN0YXRzOiB0aGlzLndhbGtlci5nZXRTdGF0cygpLFxuXHRcdFx0XHRtZXNzYWdlczogW10sXG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdGNhbmNlbCgpOiB2b2lkIHtcblx0XHR0aGlzLndhbGtlci5jYW5jZWwoKTtcblx0fVxufVxuXG4vKipcbiAqIFRoaXMgY2xhc3MgZXhpc3RzIHRvIHByb3ZpZGUgb25lIGludGVyZmFjZSBvbiB0b3Agb2YgdHdvIFBhcnNlZEV4cHJlc3Npb25zLCBvbmUgZm9yIGFic29sdXRlIGV4cHJlc3Npb25zIGFuZCBvbmUgZm9yIHJlbGF0aXZlIGV4cHJlc3Npb25zLlxuICogVGhlIGFic29sdXRlIGFuZCByZWxhdGl2ZSBleHByZXNzaW9ucyBkb24ndCBcImhhdmVcIiB0byBiZSBrZXB0IHNlcGFyYXRlLCBidXQgdGhpcyBrZWVwcyB1cyBmcm9tIGhhdmluZyB0byBwYXRoLmpvaW4gZXZlcnkgc2luZ2xlXG4gKiBmaWxlIHNlYXJjaGVkLCBpdCdzIG9ubHkgdXNlZCBmb3IgYSB0ZXh0IHNlYXJjaCB3aXRoIGEgc2VhcmNoUGF0aFxuICovXG5jbGFzcyBBYnNvbHV0ZUFuZFJlbGF0aXZlUGFyc2VkRXhwcmVzc2lvbiB7XG5cdHByaXZhdGUgYWJzb2x1dGVQYXJzZWRFeHByOiBnbG9iLlBhcnNlZEV4cHJlc3Npb24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVsYXRpdmVQYXJzZWRFeHByOiBnbG9iLlBhcnNlZEV4cHJlc3Npb24gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IocHVibGljIGV4cHJlc3Npb246IGdsb2IuSUV4cHJlc3Npb24sIHByaXZhdGUgcm9vdDogc3RyaW5nKSB7XG5cdFx0dGhpcy5pbml0KGV4cHJlc3Npb24pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNwbGl0IHRoZSBJRXhwcmVzc2lvbiBpbnRvIGl0cyBhYnNvbHV0ZSBhbmQgcmVsYXRpdmUgY29tcG9uZW50cywgYW5kIGdsb2IucGFyc2UgdGhlbSBzZXBhcmF0ZWx5LlxuXHQgKi9cblx0cHJpdmF0ZSBpbml0KGV4cHI6IGdsb2IuSUV4cHJlc3Npb24pOiB2b2lkIHtcblx0XHRsZXQgYWJzb2x1dGVHbG9iRXhwcjogZ2xvYi5JRXhwcmVzc2lvbiB8IHVuZGVmaW5lZDtcblx0XHRsZXQgcmVsYXRpdmVHbG9iRXhwcjogZ2xvYi5JRXhwcmVzc2lvbiB8IHVuZGVmaW5lZDtcblx0XHRPYmplY3Qua2V5cyhleHByKVxuXHRcdFx0LmZpbHRlcihrZXkgPT4gZXhwcltrZXldKVxuXHRcdFx0LmZvckVhY2goa2V5ID0+IHtcblx0XHRcdFx0aWYgKHBhdGguaXNBYnNvbHV0ZShrZXkpKSB7XG5cdFx0XHRcdFx0YWJzb2x1dGVHbG9iRXhwciA9IGFic29sdXRlR2xvYkV4cHIgfHwgZ2xvYi5nZXRFbXB0eUV4cHJlc3Npb24oKTtcblx0XHRcdFx0XHRhYnNvbHV0ZUdsb2JFeHByW2tleV0gPSBleHByW2tleV07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVsYXRpdmVHbG9iRXhwciA9IHJlbGF0aXZlR2xvYkV4cHIgfHwgZ2xvYi5nZXRFbXB0eUV4cHJlc3Npb24oKTtcblx0XHRcdFx0XHRyZWxhdGl2ZUdsb2JFeHByW2tleV0gPSBleHByW2tleV07XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0dGhpcy5hYnNvbHV0ZVBhcnNlZEV4cHIgPSBhYnNvbHV0ZUdsb2JFeHByICYmIGdsb2IucGFyc2UoYWJzb2x1dGVHbG9iRXhwciwgeyB0cmltRm9yRXhjbHVzaW9uczogdHJ1ZSB9KTtcblx0XHR0aGlzLnJlbGF0aXZlUGFyc2VkRXhwciA9IHJlbGF0aXZlR2xvYkV4cHIgJiYgZ2xvYi5wYXJzZShyZWxhdGl2ZUdsb2JFeHByLCB7IHRyaW1Gb3JFeGNsdXNpb25zOiB0cnVlIH0pO1xuXHR9XG5cblx0dGVzdChfcGF0aDogc3RyaW5nLCBiYXNlbmFtZT86IHN0cmluZywgaGFzU2libGluZz86IChuYW1lOiBzdHJpbmcpID0+IGJvb2xlYW4gfCBQcm9taXNlPGJvb2xlYW4+KTogc3RyaW5nIHwgUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB8IHVuZGVmaW5lZCB8IG51bGwge1xuXHRcdHJldHVybiAodGhpcy5yZWxhdGl2ZVBhcnNlZEV4cHIgJiYgdGhpcy5yZWxhdGl2ZVBhcnNlZEV4cHIoX3BhdGgsIGJhc2VuYW1lLCBoYXNTaWJsaW5nKSkgfHxcblx0XHRcdCh0aGlzLmFic29sdXRlUGFyc2VkRXhwciAmJiB0aGlzLmFic29sdXRlUGFyc2VkRXhwcihwYXRoLmpvaW4odGhpcy5yb290LCBfcGF0aCksIGJhc2VuYW1lLCBoYXNTaWJsaW5nKSk7XG5cdH1cblxuXHRnZXRCYXNlbmFtZVRlcm1zKCk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCBiYXNlbmFtZVRlcm1zOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGlmICh0aGlzLmFic29sdXRlUGFyc2VkRXhwcikge1xuXHRcdFx0YmFzZW5hbWVUZXJtcy5wdXNoKC4uLmdsb2IuZ2V0QmFzZW5hbWVUZXJtcyh0aGlzLmFic29sdXRlUGFyc2VkRXhwcikpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnJlbGF0aXZlUGFyc2VkRXhwcikge1xuXHRcdFx0YmFzZW5hbWVUZXJtcy5wdXNoKC4uLmdsb2IuZ2V0QmFzZW5hbWVUZXJtcyh0aGlzLnJlbGF0aXZlUGFyc2VkRXhwcikpO1xuXHRcdH1cblxuXHRcdHJldHVybiBiYXNlbmFtZVRlcm1zO1xuXHR9XG5cblx0Z2V0UGF0aFRlcm1zKCk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCBwYXRoVGVybXM6IHN0cmluZ1tdID0gW107XG5cdFx0aWYgKHRoaXMuYWJzb2x1dGVQYXJzZWRFeHByKSB7XG5cdFx0XHRwYXRoVGVybXMucHVzaCguLi5nbG9iLmdldFBhdGhUZXJtcyh0aGlzLmFic29sdXRlUGFyc2VkRXhwcikpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnJlbGF0aXZlUGFyc2VkRXhwcikge1xuXHRcdFx0cGF0aFRlcm1zLnB1c2goLi4uZ2xvYi5nZXRQYXRoVGVybXModGhpcy5yZWxhdGl2ZVBhcnNlZEV4cHIpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcGF0aFRlcm1zO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHJnRXJyb3JNc2dGb3JEaXNwbGF5KG1zZzogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0Y29uc3QgbGluZXMgPSBtc2cudHJpbSgpLnNwbGl0KCdcXG4nKTtcblx0Y29uc3QgZmlyc3RMaW5lID0gbGluZXNbMF0udHJpbSgpO1xuXG5cdGlmIChmaXJzdExpbmUuc3RhcnRzV2l0aCgnRXJyb3IgcGFyc2luZyByZWdleCcpKSB7XG5cdFx0cmV0dXJuIGZpcnN0TGluZTtcblx0fVxuXG5cdGlmIChmaXJzdExpbmUuc3RhcnRzV2l0aCgncmVnZXggcGFyc2UgZXJyb3InKSkge1xuXHRcdHJldHVybiBzdHJpbmdzLnVwcGVyY2FzZUZpcnN0TGV0dGVyKGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdLnRyaW0oKSk7XG5cdH1cblxuXHRpZiAoZmlyc3RMaW5lLnN0YXJ0c1dpdGgoJ2Vycm9yIHBhcnNpbmcgZ2xvYicpIHx8XG5cdFx0Zmlyc3RMaW5lLnN0YXJ0c1dpdGgoJ3Vuc3VwcG9ydGVkIGVuY29kaW5nJykpIHtcblx0XHQvLyBVcHBlcmNhc2UgZmlyc3QgbGV0dGVyXG5cdFx0cmV0dXJuIGZpcnN0TGluZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGZpcnN0TGluZS5zdWJzdHIoMSk7XG5cdH1cblxuXHRpZiAoZmlyc3RMaW5lID09PSBgTGl0ZXJhbCAnXFxcXG4nIG5vdCBhbGxvd2VkLmApIHtcblx0XHQvLyBJIHdvbid0IGxvY2FsaXplIHRoaXMgYmVjYXVzZSBub25lIG9mIHRoZSBSaXBncmVwIGVycm9yIG1lc3NhZ2VzIGFyZSBsb2NhbGl6ZWRcblx0XHRyZXR1cm4gYExpdGVyYWwgJ1xcXFxuJyBjdXJyZW50bHkgbm90IHN1cHBvcnRlZGA7XG5cdH1cblxuXHRpZiAoZmlyc3RMaW5lLnN0YXJ0c1dpdGgoJ0xpdGVyYWwgJykpIHtcblx0XHQvLyBPdGhlciB1bnN1cHBvcnRlZCBjaGFyc1xuXHRcdHJldHVybiBmaXJzdExpbmU7XG5cdH1cblxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxrQkFBa0I7QUFDOUIsWUFBWSxRQUFRO0FBQ3BCLFlBQVksVUFBVTtBQUV0QixTQUFTLHFCQUFxQjtBQUM5QixZQUFZLFlBQVk7QUFDeEIsU0FBUyxzQkFBc0I7QUFDL0IsWUFBWSxVQUFVO0FBQ3RCLFlBQVksbUJBQW1CO0FBQy9CLFNBQVMsdUJBQXVCO0FBQ2hDLFlBQVksY0FBYztBQUMxQixTQUFTLGlCQUFpQjtBQUMxQixZQUFZLGFBQWE7QUFDekIsWUFBWSxXQUFXO0FBRXZCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQTZILG9CQUFvQixvQkFBb0I7QUFDckssU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxvQkFBb0I7QUFZN0IsTUFBTSxXQUFXLG9CQUFJLElBQWdCO0FBQ3JDLFFBQVEsR0FBRyxRQUFRLE1BQU07QUFDeEIsV0FBUyxRQUFRLFNBQU8sSUFBSSxDQUFDO0FBQzlCLENBQUM7QUFFTSxNQUFNLFdBQVc7QUFBQSxFQXVCdkIsWUFBWSxRQUFvQjtBQXBCaEMsU0FBUSxpQ0FBZ0Q7QUFJeEQsU0FBUSxjQUE2QjtBQUdyQyxTQUFRLGFBQWE7QUFDckIsU0FBUSxhQUErQjtBQUl2QyxTQUFRLFFBQTBCO0FBQ2xDLFNBQVEsaUJBQXlCO0FBUWhDLFNBQUssU0FBUztBQUNkLFNBQUssY0FBYyxPQUFPLGVBQWU7QUFDekMsU0FBSyxpQkFBaUIsT0FBTyxrQkFBa0IsS0FBSyxNQUFNLE9BQU8sY0FBYztBQUMvRSxTQUFL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
