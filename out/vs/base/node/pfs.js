import * as fs from "fs";
import { tmpdir } from "os";
import { promisify } from "util";
import { ResourceQueue, timeout } from "../common/async.js";
import { isEqualOrParent, isRootOrDriveLetter, randomPath } from "../common/extpath.js";
import { normalizeNFC } from "../common/normalization.js";
import { join } from "../common/path.js";
import { isLinux, isMacintosh, isWindows } from "../common/platform.js";
import { extUriBiasedIgnorePathCase } from "../common/resources.js";
import { URI } from "../common/uri.js";
var RimRafMode = /* @__PURE__ */ ((RimRafMode2) => {
  RimRafMode2[RimRafMode2["UNLINK"] = 0] = "UNLINK";
  RimRafMode2[RimRafMode2["MOVE"] = 1] = "MOVE";
  return RimRafMode2;
})(RimRafMode || {});
async function rimraf(path, mode = 0 /* UNLINK */, moveToPath) {
  if (isRootOrDriveLetter(path)) {
    throw new Error("rimraf - will refuse to recursively delete root");
  }
  if (mode === 0 /* UNLINK */) {
    return rimrafUnlink(path);
  }
  return rimrafMove(path, moveToPath);
}
async function rimrafMove(path, moveToPath = randomPath(tmpdir())) {
  try {
    try {
      await fs.promises.rename(path, moveToPath);
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }
      return rimrafUnlink(path);
    }
    rimrafUnlink(moveToPath).catch((error) => {
    });
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}
async function rimrafUnlink(path) {
  return fs.promises.rm(path, { recursive: true, force: true, maxRetries: 3 });
}
function rimrafSync(path) {
  if (isRootOrDriveLetter(path)) {
    throw new Error("rimraf - will refuse to recursively delete root");
  }
  fs.rmSync(path, { recursive: true, force: true, maxRetries: 3 });
}
async function readdir(path, options) {
  return handleDirectoryChildren(await (options ? safeReaddirWithFileTypes(path) : fs.promises.readdir(path)));
}
async function safeReaddirWithFileTypes(path) {
  try {
    return await fs.promises.readdir(path, { withFileTypes: true });
  } catch (error) {
    console.warn("[node.js fs] readdir with filetypes failed with error: ", error);
  }
  const result = [];
  const children = await readdir(path);
  for (const child of children) {
    let isFile = false;
    let isDirectory = false;
    let isSymbolicLink = false;
    try {
      const lstat = await fs.promises.lstat(join(path, child));
      isFile = lstat.isFile();
      isDirectory = lstat.isDirectory();
      isSymbolicLink = lstat.isSymbolicLink();
    } catch (error) {
      console.warn("[node.js fs] unexpected error from lstat after readdir: ", error);
    }
    result.push({
      name: child,
      isFile: () => isFile,
      isDirectory: () => isDirectory,
      isSymbolicLink: () => isSymbolicLink
    });
  }
  return result;
}
function readdirSync(path) {
  return handleDirectoryChildren(fs.readdirSync(path));
}
function handleDirectoryChildren(children) {
  return children.map((child) => {
    if (typeof child === "string") {
      return isMacintosh ? normalizeNFC(child) : child;
    }
    child.name = isMacintosh ? normalizeNFC(child.name) : child.name;
    return child;
  });
}
async function readDirsInDir(dirPath) {
  const children = await readdir(dirPath);
  const directories = [];
  for (const child of children) {
    if (await SymlinkSupport.existsDirectory(join(dirPath, child))) {
      directories.push(child);
    }
  }
  return directories;
}
function whenDeleted(path, intervalMs = 1e3) {
  return new Promise((resolve) => {
    let running = false;
    const interval = setInterval(() => {
      if (!running) {
        running = true;
        fs.access(path, (err) => {
          running = false;
          if (err) {
            clearInterval(interval);
            resolve(void 0);
          }
        });
      }
    }, intervalMs);
  });
}
var SymlinkSupport;
((SymlinkSupport2) => {
  async function stat(path) {
    let lstats;
    try {
      lstats = await fs.promises.lstat(path);
      if (!lstats.isSymbolicLink()) {
        return { stat: lstats };
      }
    } catch (error) {
    }
    try {
      const stats = await fs.promises.stat(path);
      return { stat: stats, symbolicLink: lstats?.isSymbolicLink() ? { dangling: false } : void 0 };
    } catch (error) {
      if (error.code === "ENOENT" && lstats) {
        return { stat: lstats, symbolicLink: { dangling: true } };
      }
      if (isWindows && error.code === "EACCES") {
        try {
          const stats = await fs.promises.stat(await fs.promises.readlink(path));
          return { stat: stats, symbolicLink: { dangling: false } };
        } catch (error2) {
          if (error2.code === "ENOENT" && lstats) {
            return { stat: lstats, symbolicLink: { dangling: true } };
          }
          throw error2;
        }
      }
      throw error;
    }
  }
  SymlinkSupport2.stat = stat;
  async function existsFile(path) {
    try {
      const { stat: stat2, symbolicLink } = await SymlinkSupport2.stat(path);
      return stat2.isFile() && symbolicLink?.dangling !== true;
    } catch (error) {
    }
    return false;
  }
  SymlinkSupport2.existsFile = existsFile;
  async function existsDirectory(path) {
    try {
      const { stat: stat2, symbolicLink } = await SymlinkSupport2.stat(path);
      return stat2.isDirectory() && symbolicLink?.dangling !== true;
    } catch (error) {
    }
    return false;
  }
  SymlinkSupport2.existsDirectory = existsDirectory;
})(SymlinkSupport || (SymlinkSupport = {}));
const writeQueues = new ResourceQueue();
function writeFile(path, data, options) {
  return writeQueues.queueFor(URI.file(path), () => {
    const ensuredOptions = ensureWriteOptions(options);
    return new Promise((resolve, reject) => doWriteFileAndFlush(path, data, ensuredOptions, (error) => error ? reject(error) : resolve()));
  }, extUriBiasedIgnorePathCase);
}
let canFlush = true;
function configureFlushOnWrite(enabled) {
  canFlush = enabled;
}
function doWriteFileAndFlush(path, data, options, callback) {
  if (!canFlush) {
    return fs.writeFile(path, data, { mode: options.mode, flag: options.flag }, callback);
  }
  fs.open(path, options.flag, options.mode, (openError, fd) => {
    if (openError) {
      return callback(openError);
    }
    fs.writeFile(fd, data, (writeError) => {
      if (writeError) {
        return fs.close(fd, () => callback(writeError));
      }
      fs.fdatasync(fd, (syncError) => {
        if (syncError) {
          console.warn("[node.js fs] fdatasync is now disabled for this session because it failed: ", syncError);
          configureFlushOnWrite(false);
        }
        return fs.close(fd, (closeError) => callback(closeError));
      });
    });
  });
}
function writeFileSync(path, data, options) {
  const ensuredOptions = ensureWriteOptions(options);
  if (!canFlush) {
    return fs.writeFileSync(path, data, { mode: ensuredOptions.mode, flag: ensuredOptions.flag });
  }
  const fd = fs.openSync(path, ensuredOptions.flag, ensuredOptions.mode);
  try {
    fs.writeFileSync(fd, data);
    try {
      fs.fdatasyncSync(fd);
    } catch (syncError) {
      console.warn("[node.js fs] fdatasyncSync is now disabled for this session because it failed: ", syncError);
      configureFlushOnWrite(false);
    }
  } finally {
    fs.closeSync(fd);
  }
}
function ensureWriteOptions(options) {
  if (!options) {
    return { mode: 438, flag: "w" };
  }
  return {
    mode: typeof options.mode === "number" ? options.mode : 438,
    flag: typeof options.flag === "string" ? options.flag : "w"
  };
}
async function rename(source, target, windowsRetryTimeout = 6e4) {
  if (source === target) {
    return;
  }
  try {
    if (isWindows && typeof windowsRetryTimeout === "number") {
      await renameWithRetry(source, target, Date.now(), windowsRetryTimeout);
    } else {
      await fs.promises.rename(source, target);
    }
  } catch (error) {
    if (source.toLowerCase() !== target.toLowerCase() && error.code === "EXDEV" || source.endsWith(".")) {
      await copy(source, target, {
        preserveSymlinks: false
        /* copying to another device */
      });
      await rimraf(source, 1 /* MOVE */);
    } else {
      throw error;
    }
  }
}
async function renameWithRetry(source, target, startTime, retryTimeout, attempt = 0) {
  try {
    return await fs.promises.rename(source, target);
  } catch (error) {
    if (error.code !== "EACCES" && error.code !== "EPERM" && error.code !== "EBUSY") {
      throw error;
    }
    if (Date.now() - startTime >= retryTimeout) {
      console.error(`[node.js fs] rename failed after ${attempt} retries with error: ${error}`);
      throw error;
    }
    if (attempt === 0) {
      let abortRetry = false;
      try {
        const { stat } = await SymlinkSupport.stat(target);
        if (!stat.isFile()) {
          abortRetry = true;
        }
      } catch (error2) {
      }
      if (abortRetry) {
        throw error;
      }
    }
    await timeout(Math.min(100, attempt * 10));
    return renameWithRetry(source, target, startTime, retryTimeout, attempt + 1);
  }
}
async function copy(source, target, options) {
  return doCopy(source, target, { root: { source, target }, options, handledSourcePaths: /* @__PURE__ */ new Set() });
}
const COPY_MODE_MASK = 511;
async function doCopy(source, target, payload) {
  if (payload.handledSourcePaths.has(source)) {
    return;
  } else {
    payload.handledSourcePaths.add(source);
  }
  const { stat, symbolicLink } = await SymlinkSupport.stat(source);
  if (symbolicLink) {
    if (payload.options.preserveSymlinks) {
      try {
        return await doCopySymlink(source, target, payload);
      } catch (error) {
      }
    }
    if (symbolicLink.dangling) {
      return;
    }
  }
  if (stat.isDirectory()) {
    return doCopyDirectory(source, target, stat.mode & COPY_MODE_MASK, payload);
  } else {
    return doCopyFile(source, target, stat.mode & COPY_MODE_MASK);
  }
}
async function doCopyDirectory(source, target, mode, payload) {
  await fs.promises.mkdir(target, { recursive: true, mode });
  const files = await readdir(source);
  for (const file of files) {
    await doCopy(join(source, file), join(target, file), payload);
  }
}
async function doCopyFile(source, target, mode) {
  await fs.promises.copyFile(source, target);
  await fs.promises.chmod(target, mode);
}
async function doCopySymlink(source, target, payload) {
  let linkTarget = await fs.promises.readlink(source);
  if (isEqualOrParent(linkTarget, payload.root.source, !isLinux)) {
    linkTarget = join(payload.root.target, linkTarget.substr(payload.root.source.length + 1));
  }
  await fs.promises.symlink(linkTarget, target);
}
const Promises = new class {
  //#region Implemented by node.js
  get read() {
    return (fd, buffer, offset, length, position) => {
      return new Promise((resolve, reject) => {
        fs.read(fd, buffer, offset, length, position, (err, bytesRead, buffer2) => {
          if (err) {
            return reject(err);
          }
          return resolve({ bytesRead, buffer: buffer2 });
        });
      });
    };
  }
  get write() {
    return (fd, buffer, offset, length, position) => {
      return new Promise((resolve, reject) => {
        fs.write(fd, buffer, offset, length, position, (err, bytesWritten, buffer2) => {
          if (err) {
            return reject(err);
          }
          return resolve({ bytesWritten, buffer: buffer2 });
        });
      });
    };
  }
  get fdatasync() {
    return promisify(fs.fdatasync);
  }
  // not exposed as API in 20.x yet
  get open() {
    return promisify(fs.open);
  }
  // changed to return `FileHandle` in promise API
  get close() {
    return promisify(fs.close);
  }
  // not exposed as API due to the `FileHandle` return type of `open`
  get realpath() {
    return promisify(fs.realpath);
  }
  // `fs.promises.realpath` will use `fs.realpath.native` which we do not want
  get ftruncate() {
    return promisify(fs.ftruncate);
  }
  // not exposed as API in 20.x yet
  //#endregion
  //#region Implemented by us
  async exists(path) {
    try {
      await fs.promises.access(path);
      return true;
    } catch {
      return false;
    }
  }
  get readdir() {
    return readdir;
  }
  get readDirsInDir() {
    return readDirsInDir;
  }
  get writeFile() {
    return writeFile;
  }
  get rm() {
    return rimraf;
  }
  get rename() {
    return rename;
  }
  get copy() {
    return copy;
  }
  //#endregion
}();
export {
  Promises,
  RimRafMode,
  SymlinkSupport,
  configureFlushOnWrite,
  readdirSync,
  rimrafSync,
  whenDeleted,
  writeFileSync
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL25vZGUvcGZzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgdG1wZGlyIH0gZnJvbSAnb3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgeyBSZXNvdXJjZVF1ZXVlLCB0aW1lb3V0IH0gZnJvbSAnLi4vY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IGlzRXF1YWxPclBhcmVudCwgaXNSb290T3JEcml2ZUxldHRlciwgcmFuZG9tUGF0aCB9IGZyb20gJy4uL2NvbW1vbi9leHRwYXRoLmpzJztcbmltcG9ydCB7IG5vcm1hbGl6ZU5GQyB9IGZyb20gJy4uL2NvbW1vbi9ub3JtYWxpemF0aW9uLmpzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICcuLi9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4LCBpc01hY2ludG9zaCwgaXNXaW5kb3dzIH0gZnJvbSAnLi4vY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlIH0gZnJvbSAnLi4vY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi9jb21tb24vdXJpLmpzJztcblxuLy8jcmVnaW9uIHJpbXJhZlxuXG5leHBvcnQgZW51bSBSaW1SYWZNb2RlIHtcblxuXHQvKipcblx0ICogU2xvdyB2ZXJzaW9uIHRoYXQgdW5saW5rcyBlYWNoIGZpbGUgYW5kIGZvbGRlci5cblx0ICovXG5cdFVOTElOSyxcblxuXHQvKipcblx0ICogRmFzdCB2ZXJzaW9uIHRoYXQgZmlyc3QgbW92ZXMgdGhlIGZpbGUvZm9sZGVyXG5cdCAqIGludG8gYSB0ZW1wIGRpcmVjdG9yeSBhbmQgdGhlbiBkZWxldGVzIHRoYXRcblx0ICogd2l0aG91dCB3YWl0aW5nIGZvciBpdC5cblx0ICovXG5cdE1PVkVcbn1cblxuLyoqXG4gKiBBbGxvd3MgdG8gZGVsZXRlIHRoZSBwcm92aWRlZCBwYXRoIChlaXRoZXIgZmlsZSBvciBmb2xkZXIpIHJlY3Vyc2l2ZWx5XG4gKiB3aXRoIHRoZSBvcHRpb25zOlxuICogLSBgVU5MSU5LYDogZGlyZWN0IHJlbW92YWwgZnJvbSBkaXNrXG4gKiAtIGBNT1ZFYDogZmFzdGVyIHZhcmlhbnQgdGhhdCBmaXJzdCBtb3ZlcyB0aGUgdGFyZ2V0IHRvIHRlbXAgZGlyIGFuZCB0aGVuXG4gKiAgICAgICAgICAgZGVsZXRlcyBpdCBpbiB0aGUgYmFja2dyb3VuZCB3aXRob3V0IHdhaXRpbmcgZm9yIHRoYXQgdG8gZmluaXNoLlxuICogICAgICAgICAgIHRoZSBvcHRpb25hbCBgbW92ZVRvUGF0aGAgYWxsb3dzIHRvIG92ZXJyaWRlIHdoZXJlIHRvIHJlbmFtZSB0aGVcbiAqICAgICAgICAgICBwYXRoIHRvIGJlZm9yZSBkZWxldGluZyBpdC5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcmltcmFmKHBhdGg6IHN0cmluZywgbW9kZTogUmltUmFmTW9kZS5VTkxJTkspOiBQcm9taXNlPHZvaWQ+O1xuYXN5bmMgZnVuY3Rpb24gcmltcmFmKHBhdGg6IHN0cmluZywgbW9kZTogUmltUmFmTW9kZS5NT1ZFLCBtb3ZlVG9QYXRoPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPjtcbmFzeW5jIGZ1bmN0aW9uIHJpbXJhZihwYXRoOiBzdHJpbmcsIG1vZGU/OiBSaW1SYWZNb2RlLCBtb3ZlVG9QYXRoPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPjtcbmFzeW5jIGZ1bmN0aW9uIHJpbXJhZihwYXRoOiBzdHJpbmcsIG1vZGUgPSBSaW1SYWZNb2RlLlVOTElOSywgbW92ZVRvUGF0aD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRpZiAoaXNSb290T3JEcml2ZUxldHRlcihwYXRoKSkge1xuXHRcdHRocm93IG5ldyBFcnJvcigncmltcmFmIC0gd2lsbCByZWZ1c2UgdG8gcmVjdXJzaXZlbHkgZGVsZXRlIHJvb3QnKTtcblx0fVxuXG5cdC8vIGRlbGV0ZTogdmlhIHJtXG5cdGlmIChtb2RlID09PSBSaW1SYWZNb2RlLlVOTElOSykge1xuXHRcdHJldHVybiByaW1yYWZVbmxpbmsocGF0aCk7XG5cdH1cblxuXHQvLyBkZWxldGU6IHZpYSBtb3ZlXG5cdHJldHVybiByaW1yYWZNb3ZlKHBhdGgsIG1vdmVUb1BhdGgpO1xufVxuXG5hc3luYyBmdW5jdGlvbiByaW1yYWZNb3ZlKHBhdGg6IHN0cmluZywgbW92ZVRvUGF0aCA9IHJhbmRvbVBhdGgodG1wZGlyKCkpKTogUHJvbWlzZTx2b2lkPiB7XG5cdHRyeSB7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IGZzLnByb21pc2VzLnJlbmFtZShwYXRoLCBtb3ZlVG9QYXRoKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0aWYgKGVycm9yLmNvZGUgPT09ICdFTk9FTlQnKSB7XG5cdFx0XHRcdHJldHVybjsgLy8gaWdub3JlIC0gcGF0aCB0byBkZWxldGUgZGlkIG5vdCBleGlzdFxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmltcmFmVW5saW5rKHBhdGgpOyAvLyBvdGhlcndpc2UgZmFsbGJhY2sgdG8gdW5saW5rXG5cdFx0fVxuXG5cdFx0Ly8gRGVsZXRlIGJ1dCBkbyBub3QgcmV0dXJuIGFzIHByb21pc2Vcblx0XHRyaW1yYWZVbmxpbmsobW92ZVRvUGF0aCkuY2F0Y2goZXJyb3IgPT4gey8qIGlnbm9yZSAqLyB9KTtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRpZiAoZXJyb3IuY29kZSAhPT0gJ0VOT0VOVCcpIHtcblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH1cblx0fVxufVxuXG5hc3luYyBmdW5jdGlvbiByaW1yYWZVbmxpbmsocGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdHJldHVybiBmcy5wcm9taXNlcy5ybShwYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUsIG1heFJldHJpZXM6IDMgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByaW1yYWZTeW5jKHBhdGg6IHN0cmluZyk6IHZvaWQge1xuXHRpZiAoaXNSb290T3JEcml2ZUxldHRlcihwYXRoKSkge1xuXHRcdHRocm93IG5ldyBFcnJvcigncmltcmFmIC0gd2lsbCByZWZ1c2UgdG8gcmVjdXJzaXZlbHkgZGVsZXRlIHJvb3QnKTtcblx0fVxuXG5cdGZzLnJtU3luYyhwYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUsIG1heFJldHJpZXM6IDMgfSk7XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gcmVhZGRpciB3aXRoIE5GQyBzdXBwb3J0IChtYWNvcylcblxuZXhwb3J0IGludGVyZmFjZSBJRGlyZW50IHtcblx0bmFtZTogc3RyaW5nO1xuXG5cdGlzRmlsZSgpOiBib29sZWFuO1xuXHRpc0RpcmVjdG9yeSgpOiBib29sZWFuO1xuXHRpc1N5bWJvbGljTGluaygpOiBib29sZWFuO1xufVxuXG4vKipcbiAqIERyb3AtaW4gcmVwbGFjZW1lbnQgb2YgYGZzLnJlYWRkaXJgIHdpdGggc3VwcG9ydFxuICogZm9yIGNvbnZlcnRpbmcgZnJvbSBtYWNPUyBORkQgdW5pY29uIGZvcm0gdG8gTkZDXG4gKiAoaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2lzc3Vlcy8yMTY1KVxuICovXG5hc3luYyBmdW5jdGlvbiByZWFkZGlyKHBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+O1xuYXN5bmMgZnVuY3Rpb24gcmVhZGRpcihwYXRoOiBzdHJpbmcsIG9wdGlvbnM6IHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTogUHJvbWlzZTxJRGlyZW50W10+O1xuYXN5bmMgZnVuY3Rpb24gcmVhZGRpcihwYXRoOiBzdHJpbmcsIG9wdGlvbnM/OiB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk6IFByb21pc2U8KHN0cmluZyB8IElEaXJlbnQpW10+IHtcblx0cmV0dXJuIGhhbmRsZURpcmVjdG9yeUNoaWxkcmVuKGF3YWl0IChvcHRpb25zID8gc2FmZVJlYWRkaXJXaXRoRmlsZVR5cGVzKHBhdGgpIDogZnMucHJvbWlzZXMucmVhZGRpcihwYXRoKSkpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzYWZlUmVhZGRpcldpdGhGaWxlVHlwZXMocGF0aDogc3RyaW5nKTogUHJvbWlzZTxJRGlyZW50W10+IHtcblx0dHJ5IHtcblx0XHRyZXR1cm4gYXdhaXQgZnMucHJvbWlzZXMucmVhZGRpcihwYXRoLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk7XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0Y29uc29sZS53YXJuKCdbbm9kZS5qcyBmc10gcmVhZGRpciB3aXRoIGZpbGV0eXBlcyBmYWlsZWQgd2l0aCBlcnJvcjogJywgZXJyb3IpO1xuXHR9XG5cblx0Ly8gRmFsbGJhY2sgdG8gbWFudWFsbHkgcmVhZGluZyBhbmQgcmVzb2x2aW5nIGVhY2hcblx0Ly8gY2hpbGRyZW4gb2YgdGhlIGZvbGRlciBpbiBjYXNlIHdlIGhpdCBhbiBlcnJvclxuXHQvLyBwcmV2aW91c2x5LlxuXHQvLyBUaGlzIGNhbiBvbmx5IHJlYWxseSBoYXBwZW4gb24gZXhvdGljIGZpbGUgc3lzdGVtc1xuXHQvLyBzdWNoIGFzIGV4cGxhaW5lZCBpbiAjMTE1NjQ1IHdoZXJlIHdlIGdldCBlbnRyaWVzXG5cdC8vIGZyb20gYHJlYWRkaXJgIHRoYXQgd2UgY2FuIGxhdGVyIG5vdCBgbHN0YXRgLlxuXHRjb25zdCByZXN1bHQ6IElEaXJlbnRbXSA9IFtdO1xuXHRjb25zdCBjaGlsZHJlbiA9IGF3YWl0IHJlYWRkaXIocGF0aCk7XG5cdGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pIHtcblx0XHRsZXQgaXNGaWxlID0gZmFsc2U7XG5cdFx0bGV0IGlzRGlyZWN0b3J5ID0gZmFsc2U7XG5cdFx0bGV0IGlzU3ltYm9saWNMaW5rID0gZmFsc2U7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgbHN0YXQgPSBhd2FpdCBmcy5wcm9taXNlcy5sc3RhdChqb2luKHBhdGgsIGNoaWxkKSk7XG5cblx0XHRcdGlzRmlsZSA9IGxzdGF0LmlzRmlsZSgpO1xuXHRcdFx0aXNEaXJlY3RvcnkgPSBsc3RhdC5pc0RpcmVjdG9yeSgpO1xuXHRcdFx0aXNTeW1ib2xpY0xpbmsgPSBsc3RhdC5pc1N5bWJvbGljTGluaygpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRjb25zb2xlLndhcm4oJ1tub2RlLmpzIGZzXSB1bmV4cGVjdGVkIGVycm9yIGZyb20gbHN0YXQgYWZ0ZXIgcmVhZGRpcjogJywgZXJyb3IpO1xuXHRcdH1cblxuXHRcdHJlc3VsdC5wdXNoKHtcblx0XHRcdG5hbWU6IGNoaWxkLFxuXHRcdFx0aXNGaWxlOiAoKSA9PiBpc0ZpbGUsXG5cdFx0XHRpc0RpcmVjdG9yeTogKCkgPT4gaXNEaXJlY3RvcnksXG5cdFx0XHRpc1N5bWJvbGljTGluazogKCkgPT4gaXNTeW1ib2xpY0xpbmtcblx0XHR9KTtcblx0fVxuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogRHJvcC1pbiByZXBsYWNlbWVudCBvZiBgZnMucmVhZGRpclN5bmNgIHdpdGggc3VwcG9ydFxuICogZm9yIGNvbnZlcnRpbmcgZnJvbSBtYWNPUyBORkQgdW5pY29uIGZvcm0gdG8gTkZDXG4gKiAoaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2lzc3Vlcy8yMTY1KVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVhZGRpclN5bmMocGF0aDogc3RyaW5nKTogc3RyaW5nW10ge1xuXHRyZXR1cm4gaGFuZGxlRGlyZWN0b3J5Q2hpbGRyZW4oZnMucmVhZGRpclN5bmMocGF0aCkpO1xufVxuXG5mdW5jdGlvbiBoYW5kbGVEaXJlY3RvcnlDaGlsZHJlbihjaGlsZHJlbjogc3RyaW5nW10pOiBzdHJpbmdbXTtcbmZ1bmN0aW9uIGhhbmRsZURpcmVjdG9yeUNoaWxkcmVuKGNoaWxkcmVuOiBJRGlyZW50W10pOiBJRGlyZW50W107XG5mdW5jdGlvbiBoYW5kbGVEaXJlY3RvcnlDaGlsZHJlbihjaGlsZHJlbjogKHN0cmluZyB8IElEaXJlbnQpW10pOiAoc3RyaW5nIHwgSURpcmVudClbXTtcbmZ1bmN0aW9uIGhhbmRsZURpcmVjdG9yeUNoaWxkcmVuKGNoaWxkcmVuOiAoc3RyaW5nIHwgSURpcmVudClbXSk6IChzdHJpbmcgfCBJRGlyZW50KVtdIHtcblx0cmV0dXJuIGNoaWxkcmVuLm1hcChjaGlsZCA9PiB7XG5cblx0XHQvLyBNYWM6IHVzZXMgTkZEIHVuaWNvZGUgZm9ybSBvbiBkaXNrLCBidXQgd2Ugd2FudCBORkNcblx0XHQvLyBTZWUgYWxzbyBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvaXNzdWVzLzIxNjVcblxuXHRcdGlmICh0eXBlb2YgY2hpbGQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gaXNNYWNpbnRvc2ggPyBub3JtYWxpemVORkMoY2hpbGQpIDogY2hpbGQ7XG5cdFx0fVxuXG5cdFx0Y2hpbGQubmFtZSA9IGlzTWFjaW50b3NoID8gbm9ybWFsaXplTkZDKGNoaWxkLm5hbWUpIDogY2hpbGQubmFtZTtcblxuXHRcdHJldHVybiBjaGlsZDtcblx0fSk7XG59XG5cbi8qKlxuICogQSBjb252ZW5pZW5jZSBtZXRob2QgdG8gcmVhZCBhbGwgY2hpbGRyZW4gb2YgYSBwYXRoIHRoYXRcbiAqIGFyZSBkaXJlY3Rvcmllcy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcmVhZERpcnNJbkRpcihkaXJQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG5cdGNvbnN0IGNoaWxkcmVuID0gYXdhaXQgcmVhZGRpcihkaXJQYXRoKTtcblx0Y29uc3QgZGlyZWN0b3JpZXM6IHN0cmluZ1tdID0gW107XG5cblx0Zm9yIChjb25zdCBjaGlsZCBvZiBjaGlsZHJlbikge1xuXHRcdGlmIChhd2FpdCBTeW1saW5rU3VwcG9ydC5leGlzdHNEaXJlY3Rvcnkoam9pbihkaXJQYXRoLCBjaGlsZCkpKSB7XG5cdFx0XHRkaXJlY3Rvcmllcy5wdXNoKGNoaWxkKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gZGlyZWN0b3JpZXM7XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gd2hlbkRlbGV0ZWQoKVxuXG4vKipcbiAqIEEgYFByb21pc2VgIHRoYXQgcmVzb2x2ZXMgd2hlbiB0aGUgcHJvdmlkZWQgYHBhdGhgXG4gKiBpcyBkZWxldGVkIGZyb20gZGlzay5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdoZW5EZWxldGVkKHBhdGg6IHN0cmluZywgaW50ZXJ2YWxNcyA9IDEwMDApOiBQcm9taXNlPHZvaWQ+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4ge1xuXHRcdGxldCBydW5uaW5nID0gZmFsc2U7XG5cdFx0Y29uc3QgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHRpZiAoIXJ1bm5pbmcpIHtcblx0XHRcdFx0cnVubmluZyA9IHRydWU7XG5cdFx0XHRcdGZzLmFjY2VzcyhwYXRoLCBlcnIgPT4ge1xuXHRcdFx0XHRcdHJ1bm5pbmcgPSBmYWxzZTtcblxuXHRcdFx0XHRcdGlmIChlcnIpIHtcblx0XHRcdFx0XHRcdGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSwgaW50ZXJ2YWxNcyk7XG5cdH0pO1xufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIE1ldGhvZHMgd2l0aCBzeW1ib2xpYyBsaW5rcyBzdXBwb3J0XG5cbmV4cG9ydCBuYW1lc3BhY2UgU3ltbGlua1N1cHBvcnQge1xuXG5cdGV4cG9ydCBpbnRlcmZhY2UgSVN0YXRzIHtcblxuXHRcdC8vIFRoZSBzdGF0cyBvZiB0aGUgZmlsZS4gSWYgdGhlIGZpbGUgaXMgYSBzeW1ib2xpY1xuXHRcdC8vIGxpbmssIHRoZSBzdGF0cyB3aWxsIGJlIG9mIHRoYXQgdGFyZ2V0IGZpbGUgYW5kXG5cdFx0Ly8gbm90IHRoZSBsaW5rIGl0c2VsZi5cblx0XHQvLyBJZiB0aGUgZmlsZSBpcyBhIHN5bWJvbGljIGxpbmsgcG9pbnRpbmcgdG8gYSBub25cblx0XHQvLyBleGlzdGluZyBmaWxlLCB0aGUgc3RhdCB3aWxsIGJlIG9mIHRoZSBsaW5rIGFuZFxuXHRcdC8vIHRoZSBgZGFuZ2xpbmdgIGZsYWcgd2lsbCBpbmRpY2F0ZSB0aGlzLlxuXHRcdHN0YXQ6IGZzLlN0YXRzO1xuXG5cdFx0Ly8gV2lsbCBiZSBwcm92aWRlZCBpZiB0aGUgcmVzb3VyY2UgaXMgYSBzeW1ib2xpYyBsaW5rXG5cdFx0Ly8gb24gZGlzay4gVXNlIHRoZSBgZGFuZ2xpbmdgIGZsYWcgdG8gZmluZCBvdXQgaWYgaXRcblx0XHQvLyBwb2ludHMgdG8gYSByZXNvdXJjZSB0aGF0IGRvZXMgbm90IGV4aXN0IG9uIGRpc2suXG5cdFx0c3ltYm9saWNMaW5rPzogeyBkYW5nbGluZzogYm9vbGVhbiB9O1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlc29sdmVzIHRoZSBgZnMuU3RhdHNgIG9mIHRoZSBwcm92aWRlZCBwYXRoLiBJZiB0aGUgcGF0aCBpcyBhXG5cdCAqIHN5bWJvbGljIGxpbmssIHRoZSBgZnMuU3RhdHNgIHdpbGwgYmUgZnJvbSB0aGUgdGFyZ2V0IGl0IHBvaW50c1xuXHQgKiB0by4gSWYgdGhlIHRhcmdldCBkb2VzIG5vdCBleGlzdCwgYGRhbmdsaW5nOiB0cnVlYCB3aWxsIGJlIHJldHVybmVkXG5cdCAqIGFzIGBzeW1ib2xpY0xpbmtgIHZhbHVlLlxuXHQgKi9cblx0ZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHN0YXQocGF0aDogc3RyaW5nKTogUHJvbWlzZTxJU3RhdHM+IHtcblxuXHRcdC8vIEZpcnN0IHN0YXQgdGhlIGxpbmtcblx0XHRsZXQgbHN0YXRzOiBmcy5TdGF0cyB8IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0bHN0YXRzID0gYXdhaXQgZnMucHJvbWlzZXMubHN0YXQocGF0aCk7XG5cblx0XHRcdC8vIFJldHVybiBlYXJseSBpZiB0aGUgc3RhdCBpcyBub3QgYSBzeW1ib2xpYyBsaW5rIGF0IGFsbFxuXHRcdFx0aWYgKCFsc3RhdHMuaXNTeW1ib2xpY0xpbmsoKSkge1xuXHRcdFx0XHRyZXR1cm4geyBzdGF0OiBsc3RhdHMgfTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0LyogaWdub3JlIC0gdXNlIHN0YXQoKSBpbnN0ZWFkICovXG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlIHN0YXQgaXMgYSBzeW1ib2xpYyBsaW5rIG9yIGZhaWxlZCB0byBzdGF0LCB1c2UgZnMuc3RhdCgpXG5cdFx0Ly8gd2hpY2ggZm9yIHN5bWJvbGljIGxpbmtzIHdpbGwgc3RhdCB0aGUgdGFyZ2V0IHRoZXkgcG9pbnQgdG9cblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5wcm9taXNlcy5zdGF0KHBhdGgpO1xuXG5cdFx0XHRyZXR1cm4geyBzdGF0OiBzdGF0cywgc3ltYm9saWNMaW5rOiBsc3RhdHM/LmlzU3ltYm9saWNMaW5rKCkgPyB7IGRhbmdsaW5nOiBmYWxzZSB9IDogdW5kZWZpbmVkIH07XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0Ly8gSWYgdGhlIGxpbmsgcG9pbnRzIHRvIGEgbm9uZXhpc3RlbnQgZmlsZSB3ZSBzdGlsbCB3YW50XG5cdFx0XHQvLyB0byByZXR1cm4gaXQgYXMgcmVzdWx0IHdoaWxlIHNldHRpbmcgZGFuZ2xpbmc6IHRydWUgZmxhZ1xuXHRcdFx0aWYgKGVycm9yLmNvZGUgPT09ICdFTk9FTlQnICYmIGxzdGF0cykge1xuXHRcdFx0XHRyZXR1cm4geyBzdGF0OiBsc3RhdHMsIHN5bWJvbGljTGluazogeyBkYW5nbGluZzogdHJ1ZSB9IH07XG5cdFx0XHR9XG5cblx0XHRcdC8vIFdpbmRvd3M6IHdvcmthcm91bmQgYSBub2RlLmpzIGJ1ZyB3aGVyZSByZXBhcnNlIHBvaW50c1xuXHRcdFx0Ly8gYXJlIG5vdCBzdXBwb3J0ZWQgKGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9pc3N1ZXMvMzY3OTApXG5cdFx0XHRpZiAoaXNXaW5kb3dzICYmIGVycm9yLmNvZGUgPT09ICdFQUNDRVMnKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5wcm9taXNlcy5zdGF0KGF3YWl0IGZzLnByb21pc2VzLnJlYWRsaW5rKHBhdGgpKTtcblxuXHRcdFx0XHRcdHJldHVybiB7IHN0YXQ6IHN0YXRzLCBzeW1ib2xpY0xpbms6IHsgZGFuZ2xpbmc6IGZhbHNlIH0gfTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0XHRcdC8vIElmIHRoZSBsaW5rIHBvaW50cyB0byBhIG5vbmV4aXN0ZW50IGZpbGUgd2Ugc3RpbGwgd2FudFxuXHRcdFx0XHRcdC8vIHRvIHJldHVybiBpdCBhcyByZXN1bHQgd2hpbGUgc2V0dGluZyBkYW5nbGluZzogdHJ1ZSBmbGFnXG5cdFx0XHRcdFx0aWYgKGVycm9yLmNvZGUgPT09ICdFTk9FTlQnICYmIGxzdGF0cykge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHsgc3RhdDogbHN0YXRzLCBzeW1ib2xpY0xpbms6IHsgZGFuZ2xpbmc6IHRydWUgfSB9O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBGaWd1cmVzIG91dCBpZiB0aGUgYHBhdGhgIGV4aXN0cyBhbmQgaXMgYSBmaWxlIHdpdGggc3VwcG9ydFxuXHQgKiBmb3Igc3ltbGlua3MuXG5cdCAqXG5cdCAqIE5vdGU6IHRoaXMgd2lsbCByZXR1cm4gYGZhbHNlYCBmb3IgYSBzeW1saW5rIHRoYXQgZXhpc3RzIG9uXG5cdCAqIGRpc2sgYnV0IGlzIGRhbmdsaW5nIChwb2ludGluZyB0byBhIG5vbmV4aXN0ZW50IHBhdGgpLlxuXHQgKlxuXHQgKiBVc2UgYGV4aXN0c2AgaWYgeW91IG9ubHkgY2FyZSBhYm91dCB0aGUgcGF0aCBleGlzdGluZyBvbiBkaXNrXG5cdCAqIG9yIG5vdCB3aXRob3V0IHN1cHBvcnQgZm9yIHN5bWJvbGljIGxpbmtzLlxuXHQgKi9cblx0ZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4aXN0c0ZpbGUocGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHsgc3RhdCwgc3ltYm9saWNMaW5rIH0gPSBhd2FpdCBTeW1saW5rU3VwcG9ydC5zdGF0KHBhdGgpO1xuXG5cdFx0XHRyZXR1cm4gc3RhdC5pc0ZpbGUoKSAmJiBzeW1ib2xpY0xpbms/LmRhbmdsaW5nICE9PSB0cnVlO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHQvLyBJZ25vcmUsIHBhdGggbWlnaHQgbm90IGV4aXN0XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIEZpZ3VyZXMgb3V0IGlmIHRoZSBgcGF0aGAgZXhpc3RzIGFuZCBpcyBhIGRpcmVjdG9yeSB3aXRoIHN1cHBvcnQgZm9yXG5cdCAqIHN5bWxpbmtzLlxuXHQgKlxuXHQgKiBOb3RlOiB0aGlzIHdpbGwgcmV0dXJuIGBmYWxzZWAgZm9yIGEgc3ltbGluayB0aGF0IGV4aXN0cyBvblxuXHQgKiBkaXNrIGJ1dCBpcyBkYW5nbGluZyAocG9pbnRpbmcgdG8gYSBub25leGlzdGVudCBwYXRoKS5cblx0ICpcblx0ICogVXNlIGBleGlzdHNgIGlmIHlvdSBvbmx5IGNhcmUgYWJvdXQgdGhlIHBhdGggZXhpc3Rpbmcgb24gZGlza1xuXHQgKiBvciBub3Qgd2l0aG91dCBzdXBwb3J0IGZvciBzeW1ib2xpYyBsaW5rcy5cblx0ICovXG5cdGV4cG9ydCBhc3luYyBmdW5jdGlvbiBleGlzdHNEaXJlY3RvcnkocGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHsgc3RhdCwgc3ltYm9saWNMaW5rIH0gPSBhd2FpdCBTeW1saW5rU3VwcG9ydC5zdGF0KHBhdGgpO1xuXG5cdFx0XHRyZXR1cm4gc3RhdC5pc0RpcmVjdG9yeSgpICYmIHN5bWJvbGljTGluaz8uZGFuZ2xpbmcgIT09IHRydWU7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8vIElnbm9yZSwgcGF0aCBtaWdodCBub3QgZXhpc3Rcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBXcml0ZSBGaWxlXG5cbi8vIEFjY29yZGluZyB0byBub2RlLmpzIGRvY3MgKGh0dHBzOi8vbm9kZWpzLm9yZy9kb2NzL3YxNC4xNi4wL2FwaS9mcy5odG1sI2ZzX2ZzX3dyaXRlZmlsZV9maWxlX2RhdGFfb3B0aW9uc19jYWxsYmFjaylcbi8vIGl0IGlzIG5vdCBzYWZlIHRvIGNhbGwgd3JpdGVGaWxlKCkgb24gdGhlIHNhbWUgcGF0aCBtdWx0aXBsZSB0aW1lcyB3aXRob3V0IHdhaXRpbmcgZm9yIHRoZSBjYWxsYmFjayB0byByZXR1cm4uXG4vLyBUaGVyZWZvciB3ZSB1c2UgYSBRdWV1ZSBvbiB0aGUgcGF0aCB0aGF0IGlzIGdpdmVuIHRvIHVzIHRvIHNlcXVlbnRpYWxpemUgY2FsbHMgdG8gdGhlIHNhbWUgcGF0aCBwcm9wZXJseS5cbmNvbnN0IHdyaXRlUXVldWVzID0gbmV3IFJlc291cmNlUXVldWUoKTtcblxuLyoqXG4gKiBTYW1lIGFzIGBmcy53cml0ZUZpbGVgIGJ1dCB3aXRoIGFuIGFkZGl0aW9uYWwgY2FsbCB0b1xuICogYGZzLmZkYXRhc3luY2AgYWZ0ZXIgd3JpdGluZyB0byBlbnN1cmUgY2hhbmdlcyBhcmVcbiAqIGZsdXNoZWQgdG8gZGlzay5cbiAqXG4gKiBJbiBhZGRpdGlvbiwgbXVsdGlwbGUgd3JpdGVzIHRvIHRoZSBzYW1lIHBhdGggYXJlIHF1ZXVlZC5cbiAqL1xuZnVuY3Rpb24gd3JpdGVGaWxlKHBhdGg6IHN0cmluZywgZGF0YTogc3RyaW5nLCBvcHRpb25zPzogSVdyaXRlRmlsZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuZnVuY3Rpb24gd3JpdGVGaWxlKHBhdGg6IHN0cmluZywgZGF0YTogQnVmZmVyLCBvcHRpb25zPzogSVdyaXRlRmlsZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuZnVuY3Rpb24gd3JpdGVGaWxlKHBhdGg6IHN0cmluZywgZGF0YTogVWludDhBcnJheSwgb3B0aW9ucz86IElXcml0ZUZpbGVPcHRpb25zKTogUHJvbWlzZTx2b2lkPjtcbmZ1bmN0aW9uIHdyaXRlRmlsZShwYXRoOiBzdHJpbmcsIGRhdGE6IHN0cmluZyB8IEJ1ZmZlciB8IFVpbnQ4QXJyYXksIG9wdGlvbnM/OiBJV3JpdGVGaWxlT3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG5mdW5jdGlvbiB3cml0ZUZpbGUocGF0aDogc3RyaW5nLCBkYXRhOiBzdHJpbmcgfCBCdWZmZXIgfCBVaW50OEFycmF5LCBvcHRpb25zPzogSVdyaXRlRmlsZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0cmV0dXJuIHdyaXRlUXVldWVzLnF1ZXVlRm9yKFVSSS5maWxlKHBhdGgpLCAoKSA9PiB7XG5cdFx0Y29uc3QgZW5zdXJlZE9wdGlvbnMgPSBlbnN1cmVXcml0ZU9wdGlvbnMob3B0aW9ucyk7XG5cblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4gZG9Xcml0ZUZpbGVBbmRGbHVzaChwYXRoLCBkYXRhLCBlbnN1cmVkT3B0aW9ucywgZXJyb3IgPT4gZXJyb3IgPyByZWplY3QoZXJyb3IpIDogcmVzb2x2ZSgpKSk7XG5cdH0sIGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlKTtcbn1cblxuaW50ZXJmYWNlIElXcml0ZUZpbGVPcHRpb25zIHtcblx0bW9kZT86IG51bWJlcjtcblx0ZmxhZz86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIElFbnN1cmVkV3JpdGVGaWxlT3B0aW9ucyBleHRlbmRzIElXcml0ZUZpbGVPcHRpb25zIHtcblx0bW9kZTogbnVtYmVyO1xuXHRmbGFnOiBzdHJpbmc7XG59XG5cbmxldCBjYW5GbHVzaCA9IHRydWU7XG5leHBvcnQgZnVuY3Rpb24gY29uZmlndXJlRmx1c2hPbldyaXRlKGVuYWJsZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0Y2FuRmx1c2ggPSBlbmFibGVkO1xufVxuXG4vLyBDYWxscyBmcy53cml0ZUZpbGUoKSBmb2xsb3dlZCBieSBhIGZzLnN5bmMoKSBjYWxsIHRvIGZsdXNoIHRoZSBjaGFuZ2VzIHRvIGRpc2tcbi8vIFdlIGRvIHRoaXMgaW4gY2FzZXMgd2hlcmUgd2Ugd2FudCB0byBtYWtlIHN1cmUgdGhlIGRhdGEgaXMgcmVhbGx5IG9uIGRpc2sgYW5kXG4vLyBub3QgaW4gc29tZSBjYWNoZS5cbi8vXG4vLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2Jsb2IvdjUuMTAuMC9saWIvZnMuanMjTDExOTRcbmZ1bmN0aW9uIGRvV3JpdGVGaWxlQW5kRmx1c2gocGF0aDogc3RyaW5nLCBkYXRhOiBzdHJpbmcgfCBCdWZmZXIgfCBVaW50OEFycmF5LCBvcHRpb25zOiBJRW5zdXJlZFdyaXRlRmlsZU9wdGlvbnMsIGNhbGxiYWNrOiAoZXJyb3I6IEVycm9yIHwgbnVsbCkgPT4gdm9pZCk6IHZvaWQge1xuXHRpZiAoIWNhbkZsdXNoKSB7XG5cdFx0cmV0dXJuIGZzLndyaXRlRmlsZShwYXRoLCBkYXRhLCB7IG1vZGU6IG9wdGlvbnMubW9kZSwgZmxhZzogb3B0aW9ucy5mbGFnIH0sIGNhbGxiYWNrKTtcblx0fVxuXG5cdC8vIE9wZW4gdGhlIGZpbGUgd2l0aCBzYW1lIGZsYWdzIGFuZCBtb2RlIGFzIGZzLndyaXRlRmlsZSgpXG5cdGZzLm9wZW4ocGF0aCwgb3B0aW9ucy5mbGFnLCBvcHRpb25zLm1vZGUsIChvcGVuRXJyb3IsIGZkKSA9PiB7XG5cdFx0aWYgKG9wZW5FcnJvcikge1xuXHRcdFx0cmV0dXJuIGNhbGxiYWNrKG9wZW5FcnJvcik7XG5cdFx0fVxuXG5cdFx0Ly8gSXQgaXMgdmFsaWQgdG8gcGFzcyBhIGZkIGhhbmRsZSB0byBmcy53cml0ZUZpbGUoKSBhbmQgdGhpcyB3aWxsIGtlZXAgdGhlIGhhbmRsZSBvcGVuIVxuXHRcdGZzLndyaXRlRmlsZShmZCwgZGF0YSwgd3JpdGVFcnJvciA9PiB7XG5cdFx0XHRpZiAod3JpdGVFcnJvcikge1xuXHRcdFx0XHRyZXR1cm4gZnMuY2xvc2UoZmQsICgpID0+IGNhbGxiYWNrKHdyaXRlRXJyb3IpKTsgLy8gc3RpbGwgbmVlZCB0byBjbG9zZSB0aGUgaGFuZGxlIG9uIGVycm9yIVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBGbHVzaCBjb250ZW50cyAobm90IG1ldGFkYXRhKSBvZiB0aGUgZmlsZSB0byBkaXNrXG5cdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvOTU4OVxuXHRcdFx0ZnMuZmRhdGFzeW5jKGZkLCAoc3luY0Vycm9yOiBFcnJvciB8IG51bGwpID0+IHtcblxuXHRcdFx0XHQvLyBJbiBzb21lIGV4b3RpYyBzZXR1cHMgaXQgaXMgd2VsbCBwb3NzaWJsZSB0aGF0IG5vZGUgZmFpbHMgdG8gc3luY1xuXHRcdFx0XHQvLyBJbiB0aGF0IGNhc2Ugd2UgZGlzYWJsZSBmbHVzaGluZyBhbmQgd2FybiB0byB0aGUgY29uc29sZVxuXHRcdFx0XHRpZiAoc3luY0Vycm9yKSB7XG5cdFx0XHRcdFx0Y29uc29sZS53YXJuKCdbbm9kZS5qcyBmc10gZmRhdGFzeW5jIGlzIG5vdyBkaXNhYmxlZCBmb3IgdGhpcyBzZXNzaW9uIGJlY2F1c2UgaXQgZmFpbGVkOiAnLCBzeW5jRXJyb3IpO1xuXHRcdFx0XHRcdGNvbmZpZ3VyZUZsdXNoT25Xcml0ZShmYWxzZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZnMuY2xvc2UoZmQsIGNsb3NlRXJyb3IgPT4gY2FsbGJhY2soY2xvc2VFcnJvcikpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xufVxuXG4vKipcbiAqIFNhbWUgYXMgYGZzLndyaXRlRmlsZVN5bmNgIGJ1dCB3aXRoIGFuIGFkZGl0aW9uYWwgY2FsbCB0b1xuICogYGZzLmZkYXRhc3luY1N5bmNgIGFmdGVyIHdyaXRpbmcgdG8gZW5zdXJlIGNoYW5nZXMgYXJlXG4gKiBmbHVzaGVkIHRvIGRpc2suXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUZpbGVTeW5jKHBhdGg6IHN0cmluZywgZGF0YTogc3RyaW5nIHwgQnVmZmVyLCBvcHRpb25zPzogSVdyaXRlRmlsZU9wdGlvbnMpOiB2b2lkIHtcblx0Y29uc3QgZW5zdXJlZE9wdGlvbnMgPSBlbnN1cmVXcml0ZU9wdGlvbnMob3B0aW9ucyk7XG5cblx0aWYgKCFjYW5GbHVzaCkge1xuXHRcdHJldHVybiBmcy53cml0ZUZpbGVTeW5jKHBhdGgsIGRhdGEsIHsgbW9kZTogZW5zdXJlZE9wdGlvbnMubW9kZSwgZmxhZzogZW5zdXJlZE9wdGlvbnMuZmxhZyB9KTtcblx0fVxuXG5cdC8vIE9wZW4gdGhlIGZpbGUgd2l0aCBzYW1lIGZsYWdzIGFuZCBtb2RlIGFzIGZzLndyaXRlRmlsZSgpXG5cdGNvbnN0IGZkID0gZnMub3BlblN5bmMocGF0aCwgZW5zdXJlZE9wdGlvbnMuZmxhZywgZW5zdXJlZE9wdGlvbnMubW9kZSk7XG5cblx0dHJ5IHtcblxuXHRcdC8vIEl0IGlzIHZhbGlkIHRvIHBhc3MgYSBmZCBoYW5kbGUgdG8gZnMud3JpdGVGaWxlKCkgYW5kIHRoaXMgd2lsbCBrZWVwIHRoZSBoYW5kbGUgb3BlbiFcblx0XHRmcy53cml0ZUZpbGVTeW5jKGZkLCBkYXRhKTtcblxuXHRcdC8vIEZsdXNoIGNvbnRlbnRzIChub3QgbWV0YWRhdGEpIG9mIHRoZSBmaWxlIHRvIGRpc2tcblx0XHR0cnkge1xuXHRcdFx0ZnMuZmRhdGFzeW5jU3luYyhmZCk7IC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy85NTg5XG5cdFx0fSBjYXRjaCAoc3luY0Vycm9yKSB7XG5cdFx0XHRjb25zb2xlLndhcm4oJ1tub2RlLmpzIGZzXSBmZGF0YXN5bmNTeW5jIGlzIG5vdyBkaXNhYmxlZCBmb3IgdGhpcyBzZXNzaW9uIGJlY2F1c2UgaXQgZmFpbGVkOiAnLCBzeW5jRXJyb3IpO1xuXHRcdFx0Y29uZmlndXJlRmx1c2hPbldyaXRlKGZhbHNlKTtcblx0XHR9XG5cdH0gZmluYWxseSB7XG5cdFx0ZnMuY2xvc2VTeW5jKGZkKTtcblx0fVxufVxuXG5mdW5jdGlvbiBlbnN1cmVXcml0ZU9wdGlvbnMob3B0aW9ucz86IElXcml0ZUZpbGVPcHRpb25zKTogSUVuc3VyZWRXcml0ZUZpbGVPcHRpb25zIHtcblx0aWYgKCFvcHRpb25zKSB7XG5cdFx0cmV0dXJuIHsgbW9kZTogMG82NjYgLyogZGVmYXVsdCBub2RlLmpzIG1vZGUgZm9yIGZpbGVzICovLCBmbGFnOiAndycgfTtcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0bW9kZTogdHlwZW9mIG9wdGlvbnMubW9kZSA9PT0gJ251bWJlcicgPyBvcHRpb25zLm1vZGUgOiAwbzY2NiAvKiBkZWZhdWx0IG5vZGUuanMgbW9kZSBmb3IgZmlsZXMgKi8sXG5cdFx0ZmxhZzogdHlwZW9mIG9wdGlvbnMuZmxhZyA9PT0gJ3N0cmluZycgPyBvcHRpb25zLmZsYWcgOiAndydcblx0fTtcbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBNb3ZlIC8gQ29weVxuXG4vKipcbiAqIEEgZHJvcC1pbiByZXBsYWNlbWVudCBmb3IgYGZzLnJlbmFtZWAgdGhhdDpcbiAqIC0gYWxsb3dzIHRvIG1vdmUgYWNyb3NzIG11bHRpcGxlIGRpc2tzXG4gKiAtIGF0dGVtcHRzIHRvIHJldHJ5IHRoZSBvcGVyYXRpb24gZm9yIGNlcnRhaW4gZXJyb3IgY29kZXMgb24gV2luZG93c1xuICovXG5hc3luYyBmdW5jdGlvbiByZW5hbWUoc291cmNlOiBzdHJpbmcsIHRhcmdldDogc3RyaW5nLCB3aW5kb3dzUmV0cnlUaW1lb3V0OiBudW1iZXIgfCBmYWxzZSA9IDYwMDAwKTogUHJvbWlzZTx2b2lkPiB7XG5cdGlmIChzb3VyY2UgPT09IHRhcmdldCkge1xuXHRcdHJldHVybjsgIC8vIHNpbXVsYXRlIG5vZGUuanMgYmVoYXZpb3VyIGhlcmUgYW5kIGRvIGEgbm8tb3AgaWYgcGF0aHMgbWF0Y2hcblx0fVxuXG5cdHRyeSB7XG5cdFx0aWYgKGlzV2luZG93cyAmJiB0eXBlb2Ygd2luZG93c1JldHJ5VGltZW91dCA9PT0gJ251bWJlcicpIHtcblx0XHRcdC8vIE9uIFdpbmRvd3MsIGEgcmVuYW1lIGNhbiBmYWlsIHdoZW4gZWl0aGVyIHNvdXJjZSBvciB0YXJnZXRcblx0XHRcdC8vIGlzIGxvY2tlZCBieSBBViBzb2Z0d2FyZS5cblx0XHRcdGF3YWl0IHJlbmFtZVdpdGhSZXRyeShzb3VyY2UsIHRhcmdldCwgRGF0ZS5ub3coKSwgd2luZG93c1JldHJ5VGltZW91dCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGF3YWl0IGZzLnByb21pc2VzLnJlbmFtZShzb3VyY2UsIHRhcmdldCk7XG5cdFx0fVxuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdC8vIEluIHR3byBjYXNlcyB3ZSBmYWxsYmFjayB0byBjbGFzc2ljIGNvcHkgYW5kIGRlbGV0ZTpcblx0XHQvL1xuXHRcdC8vIDEuKSBUaGUgRVhERVYgZXJyb3IgaW5kaWNhdGVzIHRoYXQgc291cmNlIGFuZCB0YXJnZXQgYXJlIG9uIGRpZmZlcmVudCBkZXZpY2VzXG5cdFx0Ly8gSW4gdGhpcyBjYXNlLCBmYWxsYmFjayB0byB1c2luZyBhIGNvcHkoKSBvcGVyYXRpb24gYXMgdGhlcmUgaXMgbm8gd2F5IHRvXG5cdFx0Ly8gcmVuYW1lKCkgYmV0d2VlbiBkaWZmZXJlbnQgZGV2aWNlcy5cblx0XHQvL1xuXHRcdC8vIDIuKSBUaGUgdXNlciB0cmllcyB0byByZW5hbWUgYSBmaWxlL2ZvbGRlciB0aGF0IGVuZHMgd2l0aCBhIGRvdC4gVGhpcyBpcyBub3Rcblx0XHQvLyByZWFsbHkgcG9zc2libGUgdG8gbW92ZSB0aGVuLCBhdCBsZWFzdCBvbiBVTkMgZGV2aWNlcy5cblx0XHRpZiAoc291cmNlLnRvTG93ZXJDYXNlKCkgIT09IHRhcmdldC50b0xvd2VyQ2FzZSgpICYmIGVycm9yLmNvZGUgPT09ICdFWERFVicgfHwgc291cmNlLmVuZHNXaXRoKCcuJykpIHtcblx0XHRcdGF3YWl0IGNvcHkoc291cmNlLCB0YXJnZXQsIHsgcHJlc2VydmVTeW1saW5rczogZmFsc2UgLyogY29weWluZyB0byBhbm90aGVyIGRldmljZSAqLyB9KTtcblx0XHRcdGF3YWl0IHJpbXJhZihzb3VyY2UsIFJpbVJhZk1vZGUuTU9WRSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH1cblx0fVxufVxuXG5hc3luYyBmdW5jdGlvbiByZW5hbWVXaXRoUmV0cnkoc291cmNlOiBzdHJpbmcsIHRhcmdldDogc3RyaW5nLCBzdGFydFRpbWU6IG51bWJlciwgcmV0cnlUaW1lb3V0OiBudW1iZXIsIGF0dGVtcHQgPSAwKTogUHJvbWlzZTx2b2lkPiB7XG5cdHRyeSB7XG5cdFx0cmV0dXJuIGF3YWl0IGZzLnByb21pc2VzLnJlbmFtZShzb3VyY2UsIHRhcmdldCk7XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0aWYgKGVycm9yLmNvZGUgIT09ICdFQUNDRVMnICYmIGVycm9yLmNvZGUgIT09ICdFUEVSTScgJiYgZXJyb3IuY29kZSAhPT0gJ0VCVVNZJykge1xuXHRcdFx0dGhyb3cgZXJyb3I7IC8vIG9ubHkgZm9yIGVycm9ycyB3ZSB0aGluayBhcmUgdGVtcG9yYXJ5XG5cdFx0fVxuXG5cdFx0aWYgKERhdGUubm93KCkgLSBzdGFydFRpbWUgPj0gcmV0cnlUaW1lb3V0KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGBbbm9kZS5qcyBmc10gcmVuYW1lIGZhaWxlZCBhZnRlciAke2F0dGVtcHR9IHJldHJpZXMgd2l0aCBlcnJvcjogJHtlcnJvcn1gKTtcblxuXHRcdFx0dGhyb3cgZXJyb3I7IC8vIGdpdmUgdXAgYWZ0ZXIgY29uZmlndXJhYmxlIHRpbWVvdXRcblx0XHR9XG5cblx0XHRpZiAoYXR0ZW1wdCA9PT0gMCkge1xuXHRcdFx0bGV0IGFib3J0UmV0cnkgPSBmYWxzZTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHsgc3RhdCB9ID0gYXdhaXQgU3ltbGlua1N1cHBvcnQuc3RhdCh0YXJnZXQpO1xuXHRcdFx0XHRpZiAoIXN0YXQuaXNGaWxlKCkpIHtcblx0XHRcdFx0XHRhYm9ydFJldHJ5ID0gdHJ1ZTsgLy8gaWYgdGFyZ2V0IGlzIG5vdCBhIGZpbGUsIEVQRVJNIGVycm9yIG1heSBiZSByYWlzZWQgYW5kIHdlIHNob3VsZCBub3QgYXR0ZW1wdCB0byByZXRyeVxuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHQvLyBJZ25vcmVcblx0XHRcdH1cblxuXHRcdFx0aWYgKGFib3J0UmV0cnkpIHtcblx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRGVsYXkgd2l0aCBpbmNyZW1lbnRhbCBiYWNrb2ZmIHVwIHRvIDEwMG1zXG5cdFx0YXdhaXQgdGltZW91dChNYXRoLm1pbigxMDAsIGF0dGVtcHQgKiAxMCkpO1xuXG5cdFx0Ly8gQXR0ZW1wdCBhZ2FpblxuXHRcdHJldHVybiByZW5hbWVXaXRoUmV0cnkoc291cmNlLCB0YXJnZXQsIHN0YXJ0VGltZSwgcmV0cnlUaW1lb3V0LCBhdHRlbXB0ICsgMSk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElDb3B5UGF5bG9hZCB7XG5cdHJlYWRvbmx5IHJvb3Q6IHsgc291cmNlOiBzdHJpbmc7IHRhcmdldDogc3RyaW5nIH07XG5cdHJlYWRvbmx5IG9wdGlvbnM6IHsgcHJlc2VydmVTeW1saW5rczogYm9vbGVhbiB9O1xuXHRyZWFkb25seSBoYW5kbGVkU291cmNlUGF0aHM6IFNldDxzdHJpbmc+O1xufVxuXG4vKipcbiAqIFJlY3Vyc2l2ZWx5IGNvcGllcyBhbGwgb2YgYHNvdXJjZWAgdG8gYHRhcmdldGAuXG4gKlxuICogVGhlIG9wdGlvbnMgYHByZXNlcnZlU3ltbGlua3NgIGNvbmZpZ3VyZXMgaG93IHN5bWJvbGljXG4gKiBsaW5rcyBzaG91bGQgYmUgaGFuZGxlZCB3aGVuIGVuY291bnRlcmVkLiBTZXQgdG9cbiAqIGBmYWxzZWAgdG8gbm90IHByZXNlcnZlIHRoZW0gYW5kIGB0cnVlYCBvdGhlcndpc2UuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGNvcHkoc291cmNlOiBzdHJpbmcsIHRhcmdldDogc3RyaW5nLCBvcHRpb25zOiB7IHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4gfSk6IFByb21pc2U8dm9pZD4ge1xuXHRyZXR1cm4gZG9Db3B5KHNvdXJjZSwgdGFyZ2V0LCB7IHJvb3Q6IHsgc291cmNlLCB0YXJnZXQgfSwgb3B0aW9ucywgaGFuZGxlZFNvdXJjZVBhdGhzOiBuZXcgU2V0PHN0cmluZz4oKSB9KTtcbn1cblxuLy8gV2hlbiBjb3B5aW5nIGEgZmlsZSBvciBmb2xkZXIsIHdlIHdhbnQgdG8gcHJlc2VydmUgdGhlIG1vZGVcbi8vIGl0IGhhZCBhbmQgYXMgc3VjaCBwcm92aWRlIGl0IHdoZW4gY3JlYXRpbmcuIEhvd2V2ZXIsIG1vZGVzXG4vLyBjYW4gZ28gYmV5b25kIHdoYXQgd2UgZXhwZWN0IChzZWUgbGluayBiZWxvdyksIHNvIHdlIG1hc2sgaXQuXG4vLyAoaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlLXYwLngtYXJjaGl2ZS9pc3N1ZXMvMzA0NSNpc3N1ZWNvbW1lbnQtNDg2MjU4OClcbmNvbnN0IENPUFlfTU9ERV9NQVNLID0gMG83Nzc7XG5cbmFzeW5jIGZ1bmN0aW9uIGRvQ29weShzb3VyY2U6IHN0cmluZywgdGFyZ2V0OiBzdHJpbmcsIHBheWxvYWQ6IElDb3B5UGF5bG9hZCk6IFByb21pc2U8dm9pZD4ge1xuXG5cdC8vIEtlZXAgdHJhY2sgb2YgcGF0aHMgYWxyZWFkeSBjb3BpZWQgdG8gcHJldmVudFxuXHQvLyBjeWNsZXMgZnJvbSBzeW1ib2xpYyBsaW5rcyB0byBjYXVzZSBpc3N1ZXNcblx0aWYgKHBheWxvYWQuaGFuZGxlZFNvdXJjZVBhdGhzLmhhcyhzb3VyY2UpKSB7XG5cdFx0cmV0dXJuO1xuXHR9IGVsc2Uge1xuXHRcdHBheWxvYWQuaGFuZGxlZFNvdXJjZVBhdGhzLmFkZChzb3VyY2UpO1xuXHR9XG5cblx0Y29uc3QgeyBzdGF0LCBzeW1ib2xpY0xpbmsgfSA9IGF3YWl0IFN5bWxpbmtTdXBwb3J0LnN0YXQoc291cmNlKTtcblxuXHQvLyBTeW1saW5rXG5cdGlmIChzeW1ib2xpY0xpbmspIHtcblxuXHRcdC8vIFRyeSB0byByZS1jcmVhdGUgdGhlIHN5bWxpbmsgdW5sZXNzIGBwcmVzZXJ2ZVN5bWxpbmtzOiBmYWxzZWBcblx0XHRpZiAocGF5bG9hZC5vcHRpb25zLnByZXNlcnZlU3ltbGlua3MpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHJldHVybiBhd2FpdCBkb0NvcHlTeW1saW5rKHNvdXJjZSwgdGFyZ2V0LCBwYXlsb2FkKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdC8vIGluIGFueSBjYXNlIG9mIGFuIGVycm9yIGZhbGxiYWNrIHRvIG5vcm1hbCBjb3B5IHZpYSBkZXJlZmVyZW5jaW5nXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHN5bWJvbGljTGluay5kYW5nbGluZykge1xuXHRcdFx0cmV0dXJuOyAvLyBza2lwIGRhbmdsaW5nIHN5bWJvbGljIGxpbmtzIGZyb20gaGVyZSBvbiAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzExMTYyMSlcblx0XHR9XG5cdH1cblxuXHQvLyBGb2xkZXJcblx0aWYgKHN0YXQuaXNEaXJlY3RvcnkoKSkge1xuXHRcdHJldHVybiBkb0NvcHlEaXJlY3Rvcnkoc291cmNlLCB0YXJnZXQsIHN0YXQubW9kZSAmIENPUFlfTU9ERV9NQVNLLCBwYXlsb2FkKTtcblx0fVxuXG5cdC8vIEZpbGUgb3IgZmlsZS1saWtlXG5cdGVsc2Uge1xuXHRcdHJldHVybiBkb0NvcHlGaWxlKHNvdXJjZSwgdGFyZ2V0LCBzdGF0Lm1vZGUgJiBDT1BZX01PREVfTUFTSyk7XG5cdH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZG9Db3B5RGlyZWN0b3J5KHNvdXJjZTogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZywgbW9kZTogbnVtYmVyLCBwYXlsb2FkOiBJQ29weVBheWxvYWQpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHQvLyBDcmVhdGUgZm9sZGVyXG5cdGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHRhcmdldCwgeyByZWN1cnNpdmU6IHRydWUsIG1vZGUgfSk7XG5cblx0Ly8gQ29weSBlYWNoIGZpbGUgcmVjdXJzaXZlbHlcblx0Y29uc3QgZmlsZXMgPSBhd2FpdCByZWFkZGlyKHNvdXJjZSk7XG5cdGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuXHRcdGF3YWl0IGRvQ29weShqb2luKHNvdXJjZSwgZmlsZSksIGpvaW4odGFyZ2V0LCBmaWxlKSwgcGF5bG9hZCk7XG5cdH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZG9Db3B5RmlsZShzb3VyY2U6IHN0cmluZywgdGFyZ2V0OiBzdHJpbmcsIG1vZGU6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXG5cdC8vIENvcHkgZmlsZVxuXHRhd2FpdCBmcy5wcm9taXNlcy5jb3B5RmlsZShzb3VyY2UsIHRhcmdldCk7XG5cblx0Ly8gcmVzdG9yZSBtb2RlIChodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvaXNzdWVzLzExMDQpXG5cdGF3YWl0IGZzLnByb21pc2VzLmNobW9kKHRhcmdldCwgbW9kZSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRvQ29weVN5bWxpbmsoc291cmNlOiBzdHJpbmcsIHRhcmdldDogc3RyaW5nLCBwYXlsb2FkOiBJQ29weVBheWxvYWQpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHQvLyBGaWd1cmUgb3V0IGxpbmsgdGFyZ2V0XG5cdGxldCBsaW5rVGFyZ2V0ID0gYXdhaXQgZnMucHJvbWlzZXMucmVhZGxpbmsoc291cmNlKTtcblxuXHQvLyBTcGVjaWFsIGNhc2U6IHRoZSBzeW1saW5rIHBvaW50cyB0byBhIHRhcmdldCB0aGF0IGlzXG5cdC8vIGFjdHVhbGx5IHdpdGhpbiB0aGUgcGF0aCB0aGF0IGlzIGJlaW5nIGNvcGllZC4gSW4gdGhhdFxuXHQvLyBjYXNlIHdlIHdhbnQgdGhlIHN5bWxpbmsgdG8gcG9pbnQgdG8gdGhlIHRhcmdldCBhbmRcblx0Ly8gbm90IHRoZSBzb3VyY2Vcblx0aWYgKGlzRXF1YWxPclBhcmVudChsaW5rVGFyZ2V0LCBwYXlsb2FkLnJvb3Quc291cmNlLCAhaXNMaW51eCkpIHtcblx0XHRsaW5rVGFyZ2V0ID0gam9pbihwYXlsb2FkLnJvb3QudGFyZ2V0LCBsaW5rVGFyZ2V0LnN1YnN0cihwYXlsb2FkLnJvb3Quc291cmNlLmxlbmd0aCArIDEpKTtcblx0fVxuXG5cdC8vIENyZWF0ZSBzeW1saW5rXG5cdGF3YWl0IGZzLnByb21pc2VzLnN5bWxpbmsobGlua1RhcmdldCwgdGFyZ2V0KTtcbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBQcm9taXNlIGJhc2VkIGZzIG1ldGhvZHNcblxuLyoqXG4gKiBTb21lIGxvdyBsZXZlbCBgZnNgIG1ldGhvZHMgcHJvdmlkZWQgYXMgYFByb21pc2VzYCBzaW1pbGFyIHRvXG4gKiBgZnMucHJvbWlzZXNgIGJ1dCB3aXRoIG5vdGFibGUgZGlmZmVyZW5jZXMsIGVpdGhlciBpbXBsZW1lbnRlZFxuICogYnkgdXMgb3IgYnkgcmVzdG9yaW5nIHRoZSBvcmlnaW5hbCBjYWxsYmFjayBiYXNlZCBiZWhhdmlvci5cbiAqXG4gKiBBdCBsZWFzdCBgcmVhbHBhdGhgIGlzIGltcGxlbWVudGVkIGRpZmZlcmVudGx5IGluIHRoZSBwcm9taXNlXG4gKiBiYXNlZCBpbXBsZW1lbnRhdGlvbiBjb21wYXJlZCB0byB0aGUgY2FsbGJhY2sgYmFzZWQgb25lLiBUaGVcbiAqIHByb21pc2UgYmFzZWQgaW1wbGVtZW50YXRpb24gYWN0dWFsbHkgY2FsbHMgYGZzLnJlYWxwYXRoLm5hdGl2ZWAuXG4gKiAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzExODU2MilcbiAqL1xuZXhwb3J0IGNvbnN0IFByb21pc2VzID0gbmV3IGNsYXNzIHtcblxuXHQvLyNyZWdpb24gSW1wbGVtZW50ZWQgYnkgbm9kZS5qc1xuXG5cdGdldCByZWFkKCkge1xuXG5cdFx0Ly8gTm90IHVzaW5nIGBwcm9taXNpZnlgIGhlcmUgZm9yIGEgcmVhc29uOiB0aGUgcmV0dXJuXG5cdFx0Ly8gdHlwZSBpcyBub3QgYW4gb2JqZWN0IGFzIGluZGljYXRlZCBieSBUeXBlU2NyaXB0IGJ1dFxuXHRcdC8vIGp1c3QgdGhlIGJ5dGVzIHJlYWQsIHNvIHdlIGNyZWF0ZSBvdXIgb3duIHdyYXBwZXIuXG5cblx0XHRyZXR1cm4gKGZkOiBudW1iZXIsIGJ1ZmZlcjogVWludDhBcnJheSwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbjogbnVtYmVyIHwgbnVsbCkgPT4ge1xuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPHsgYnl0ZXNSZWFkOiBudW1iZXI7IGJ1ZmZlcjogVWludDhBcnJheSB9PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdGZzLnJlYWQoZmQsIGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgsIHBvc2l0aW9uLCAoZXJyLCBieXRlc1JlYWQsIGJ1ZmZlcikgPT4ge1xuXHRcdFx0XHRcdGlmIChlcnIpIHtcblx0XHRcdFx0XHRcdHJldHVybiByZWplY3QoZXJyKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gcmVzb2x2ZSh7IGJ5dGVzUmVhZCwgYnVmZmVyIH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH07XG5cdH1cblxuXHRnZXQgd3JpdGUoKSB7XG5cblx0XHQvLyBOb3QgdXNpbmcgYHByb21pc2lmeWAgaGVyZSBmb3IgYSByZWFzb246IHRoZSByZXR1cm5cblx0XHQvLyB0eXBlIGlzIG5vdCBhbiBvYmplY3QgYXMgaW5kaWNhdGVkIGJ5IFR5cGVTY3JpcHQgYnV0XG5cdFx0Ly8ganVzdCB0aGUgYnl0ZXMgd3JpdHRlbiwgc28gd2UgY3JlYXRlIG91ciBvd24gd3JhcHBlci5cblxuXHRcdHJldHVybiAoZmQ6IG51bWJlciwgYnVmZmVyOiBVaW50OEFycmF5LCBvZmZzZXQ6IG51bWJlciB8IHVuZGVmaW5lZCB8IG51bGwsIGxlbmd0aDogbnVtYmVyIHwgdW5kZWZpbmVkIHwgbnVsbCwgcG9zaXRpb246IG51bWJlciB8IHVuZGVmaW5lZCB8IG51bGwpID0+IHtcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZTx7IGJ5dGVzV3JpdHRlbjogbnVtYmVyOyBidWZmZXI6IFVpbnQ4QXJyYXkgfT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRmcy53cml0ZShmZCwgYnVmZmVyLCBvZmZzZXQsIGxlbmd0aCwgcG9zaXRpb24sIChlcnIsIGJ5dGVzV3JpdHRlbiwgYnVmZmVyKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGVycikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHJlamVjdChlcnIpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiByZXNvbHZlKHsgYnl0ZXNXcml0dGVuLCBidWZmZXIgfSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fTtcblx0fVxuXG5cdGdldCBmZGF0YXN5bmMoKSB7IHJldHVybiBwcm9taXNpZnkoZnMuZmRhdGFzeW5jKTsgfSAvLyBub3QgZXhwb3NlZCBhcyBBUEkgaW4gMjAueCB5ZXRcblxuXHRnZXQgb3BlbigpIHsgcmV0dXJuIHByb21pc2lmeShmcy5vcGVuKTsgfSBcdFx0XHQvLyBjaGFuZ2VkIHRvIHJldHVybiBgRmlsZUhhbmRsZWAgaW4gcHJvbWlzZSBBUElcblx0Z2V0IGNsb3NlKCkgeyByZXR1cm4gcHJvbWlzaWZ5KGZzLmNsb3NlKTsgfSBcdFx0Ly8gbm90IGV4cG9zZWQgYXMgQVBJIGR1ZSB0byB0aGUgYEZpbGVIYW5kbGVgIHJldHVybiB0eXBlIG9mIGBvcGVuYFxuXG5cdGdldCByZWFscGF0aCgpIHsgcmV0dXJuIHByb21pc2lmeShmcy5yZWFscGF0aCk7IH1cdC8vIGBmcy5wcm9taXNlcy5yZWFscGF0aGAgd2lsbCB1c2UgYGZzLnJlYWxwYXRoLm5hdGl2ZWAgd2hpY2ggd2UgZG8gbm90IHdhbnRcblxuXHRnZXQgZnRydW5jYXRlKCkgeyByZXR1cm4gcHJvbWlzaWZ5KGZzLmZ0cnVuY2F0ZSk7IH0gLy8gbm90IGV4cG9zZWQgYXMgQVBJIGluIDIwLnggeWV0XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIEltcGxlbWVudGVkIGJ5IHVzXG5cblx0YXN5bmMgZXhpc3RzKHBhdGg6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBmcy5wcm9taXNlcy5hY2Nlc3MocGF0aCk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdGdldCByZWFkZGlyKCkgeyByZXR1cm4gcmVhZGRpcjsgfVxuXHRnZXQgcmVhZERpcnNJbkRpcigpIHsgcmV0dXJuIHJlYWREaXJzSW5EaXI7IH1cblxuXHRnZXQgd3JpdGVGaWxlKCkgeyByZXR1cm4gd3JpdGVGaWxlOyB9XG5cblx0Z2V0IHJtKCkgeyByZXR1cm4gcmltcmFmOyB9XG5cblx0Z2V0IHJlbmFtZSgpIHsgcmV0dXJuIHJlbmFtZTsgfVxuXHRnZXQgY29weSgpIHsgcmV0dXJuIGNvcHk7IH1cblxuXHQvLyNlbmRyZWdpb25cbn07XG5cbi8vI2VuZHJlZ2lvblxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxRQUFRO0FBQ3BCLFNBQVMsY0FBYztBQUN2QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGVBQWUsZUFBZTtBQUN2QyxTQUFTLGlCQUFpQixxQkFBcUIsa0JBQWtCO0FBQ2pFLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsWUFBWTtBQUNyQixTQUFTLFNBQVMsYUFBYSxpQkFBaUI7QUFDaEQsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyxXQUFXO0FBSWIsSUFBSyxhQUFMLGtCQUFLQSxnQkFBTDtBQUtOLEVBQUFBLHdCQUFBO0FBT0EsRUFBQUEsd0JBQUE7QUFaVyxTQUFBQTtBQUFBLEdBQUE7QUEyQlosZUFBZSxPQUFPLE1BQWMsT0FBTyxnQkFBbUIsWUFBb0M7QUFDakcsTUFBSSxvQkFBb0IsSUFBSSxHQUFHO0FBQzlCLFVBQU0sSUFBSSxNQUFNLGlEQUFpRDtBQUFBLEVBQ2xFO0FBR0EsTUFBSSxTQUFTLGdCQUFtQjtBQUMvQixXQUFPLGFBQWEsSUFBSTtBQUFBLEVBQ3pCO0FBR0EsU0FBTyxXQUFXLE1BQU0sVUFBVTtBQUNuQztBQUVBLGVBQWUsV0FBVyxNQUFjLGFBQWEsV0FBVyxPQUFPLENBQUMsR0FBa0I7QUFDekYsTUFBSTtBQUNILFFBQUk7QUFDSCxZQUFNLEdBQUcsU0FBUyxPQUFPLE1BQU0sVUFBVTtBQUFBLElBQzFDLFNBQVMsT0FBTztBQUNmLFVBQUksTUFBTSxTQUFTLFVBQVU7QUFDNUI7QUFBQSxNQUNEO0FBRUEsYUFBTyxhQUFhLElBQUk7QUFBQSxJQUN6QjtBQUdBLGlCQUFhLFVBQVUsRUFBRSxNQUFNLFdBQVM7QUFBQSxJQUFjLENBQUM7QUFBQSxFQUN4RCxTQUFTLE9BQU87QUFDZixR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
