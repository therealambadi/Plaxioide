import { createWriteStream, promises } from "fs";
import { createCancelablePromise, Sequencer } from "../common/async.js";
import * as path from "../common/path.js";
import { assertIsDefined } from "../common/types.js";
import { Promises } from "./pfs.js";
import * as nls from "../../nls.js";
const CorruptZipMessage = "end of central directory record signature not found";
const CORRUPT_ZIP_PATTERN = new RegExp(CorruptZipMessage);
class ExtractError extends Error {
  constructor(type, cause) {
    let message = cause.message;
    switch (type) {
      case "CorruptZip":
        message = `Corrupt ZIP: ${message}`;
        break;
    }
    super(message);
    this.type = type;
    this.cause = cause;
  }
}
function modeFromEntry(entry) {
  const attr = entry.externalFileAttributes >> 16 || 33188;
  return [
    448,
    56,
    7
    /* S_IRWXO */
  ].map((mask) => attr & mask).reduce(
    (a, b) => a + b,
    attr & 61440
    /* S_IFMT */
  );
}
function toExtractError(err) {
  if (err instanceof ExtractError) {
    return err;
  }
  let type = void 0;
  if (CORRUPT_ZIP_PATTERN.test(err.message)) {
    type = "CorruptZip";
  }
  return new ExtractError(type, err);
}
function extractEntry(stream, fileName, mode, targetPath, options, token) {
  const dirName = path.dirname(fileName);
  const targetDirName = path.join(targetPath, dirName);
  if (!targetDirName.startsWith(targetPath)) {
    return Promise.reject(new Error(nls.localize("invalid file", "Error extracting {0}. Invalid file.", fileName)));
  }
  const targetFileName = path.join(targetPath, fileName);
  let istream;
  token.onCancellationRequested(() => {
    istream?.destroy();
  });
  return Promise.resolve(promises.mkdir(targetDirName, { recursive: true })).then(() => new Promise((c, e) => {
    if (token.isCancellationRequested) {
      return;
    }
    try {
      istream = createWriteStream(targetFileName, { mode });
      istream.once("close", () => c());
      istream.once("error", e);
      stream.once("error", e);
      stream.pipe(istream);
    } catch (error) {
      e(error);
    }
  }));
}
function extractZip(zipfile, targetPath, options, token) {
  let last = createCancelablePromise(() => Promise.resolve());
  let extractedEntriesCount = 0;
  const listener = token.onCancellationRequested(() => {
    last.cancel();
    zipfile.close();
  });
  return new Promise((c, e) => {
    const throttler = new Sequencer();
    const readNextEntry = (token2) => {
      if (token2.isCancellationRequested) {
        return;
      }
      extractedEntriesCount++;
      zipfile.readEntry();
    };
    zipfile.once("error", e);
    zipfile.once("close", () => last.then(() => {
      if (token.isCancellationRequested || zipfile.entryCount === extractedEntriesCount) {
        c();
      } else {
        e(new ExtractError("Incomplete", new Error(nls.localize("incompleteExtract", "Incomplete. Found {0} of {1} entries", extractedEntriesCount, zipfile.entryCount))));
      }
    }, e));
    zipfile.readEntry();
    zipfile.on("entry", (entry) => {
      if (token.isCancellationRequested) {
        return;
      }
      if (!options.sourcePathRegex.test(entry.fileName)) {
        readNextEntry(token);
        return;
      }
      const fileName = entry.fileName.replace(options.sourcePathRegex, "");
      if (/\/$/.test(fileName)) {
        const targetFileName = path.join(targetPath, fileName);
        last = createCancelablePromise((token2) => promises.mkdir(targetFileName, { recursive: true }).then(() => readNextEntry(token2)).then(void 0, e));
        return;
      }
      const stream = openZipStream(zipfile, entry);
      const mode = modeFromEntry(entry);
      last = createCancelablePromise((token2) => throttler.queue(() => stream.then((stream2) => extractEntry(stream2, fileName, mode, targetPath, options, token2).then(() => readNextEntry(token2)))).then(null, e));
    });
  }).finally(() => listener.dispose());
}
async function openZip(zipFile, lazy = false) {
  const { open } = await import("yauzl");
  return new Promise((resolve, reject) => {
    open(zipFile, lazy ? { lazyEntries: true } : void 0, (error, zipfile) => {
      if (error) {
        reject(toExtractError(error));
      } else {
        resolve(assertIsDefined(zipfile));
      }
    });
  });
}
function openZipStream(zipFile, entry) {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error) {
        reject(toExtractError(error));
      } else {
        resolve(assertIsDefined(stream));
      }
    });
  });
}
async function zip(zipPath, files) {
  const { ZipFile } = await import("yazl");
  return new Promise((c, e) => {
    const zip2 = new ZipFile();
    files.forEach((f) => {
      if (f.contents) {
        zip2.addBuffer(typeof f.contents === "string" ? Buffer.from(f.contents, "utf8") : f.contents, f.path);
      } else if (f.localPath) {
        zip2.addFile(f.localPath, f.path);
      }
    });
    zip2.end();
    const zipStream = createWriteStream(zipPath);
    zip2.outputStream.pipe(zipStream);
    zip2.outputStream.once("error", e);
    zipStream.once("error", e);
    zipStream.once("finish", () => c(zipPath));
  });
}
function extract(zipPath, targetPath, options = {}, token) {
  const sourcePathRegex = new RegExp(options.sourcePath ? `^${options.sourcePath}` : "");
  let promise = openZip(zipPath, true);
  if (options.overwrite) {
    promise = promise.then((zipfile) => Promises.rm(targetPath).then(() => zipfile));
  }
  return promise.then((zipfile) => extractZip(zipfile, targetPath, { sourcePathRegex }, token));
}
function read(zipPath, filePath) {
  return openZip(zipPath).then((zipfile) => {
    return new Promise((c, e) => {
      zipfile.on("entry", (entry) => {
        if (entry.fileName === filePath) {
          openZipStream(zipfile, entry).then((stream) => c(stream), (err) => e(err));
        }
      });
      zipfile.once("close", () => e(new Error(nls.localize("notFound", "{0} not found inside zip.", filePath))));
    });
  });
}
function buffer(zipPath, filePath) {
  return read(zipPath, filePath).then((stream) => {
    return new Promise((c, e) => {
      const buffers = [];
      stream.once("error", e);
      stream.on("data", (b) => buffers.push(b));
      stream.on("end", () => c(Buffer.concat(buffers)));
    });
  });
}
export {
  CorruptZipMessage,
  ExtractError,
  buffer,
  extract,
  zip
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL25vZGUvemlwLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgY3JlYXRlV3JpdGVTdHJlYW0sIFdyaXRlU3RyZWFtLCBwcm9taXNlcyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IFJlYWRhYmxlIH0gZnJvbSAnc3RyZWFtJztcbmltcG9ydCB7IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlLCBTZXF1ZW5jZXIgfSBmcm9tICcuLi9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnLi4vY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkIH0gZnJvbSAnLi4vY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFByb21pc2VzIH0gZnJvbSAnLi9wZnMuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uL25scy5qcyc7XG5pbXBvcnQgdHlwZSB7IEVudHJ5LCBaaXBGaWxlIH0gZnJvbSAneWF1emwnO1xuXG5leHBvcnQgY29uc3QgQ29ycnVwdFppcE1lc3NhZ2U6IHN0cmluZyA9ICdlbmQgb2YgY2VudHJhbCBkaXJlY3RvcnkgcmVjb3JkIHNpZ25hdHVyZSBub3QgZm91bmQnO1xuY29uc3QgQ09SUlVQVF9aSVBfUEFUVEVSTiA9IG5ldyBSZWdFeHAoQ29ycnVwdFppcE1lc3NhZ2UpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElFeHRyYWN0T3B0aW9ucyB7XG5cdG92ZXJ3cml0ZT86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFNvdXJjZSBwYXRoIHdpdGhpbiB0aGUgWklQIGFyY2hpdmUuIE9ubHkgdGhlIGZpbGVzIGNvbnRhaW5lZCBpbiB0aGlzXG5cdCAqIHBhdGggd2lsbCBiZSBleHRyYWN0ZWQuXG5cdCAqL1xuXHRzb3VyY2VQYXRoPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSU9wdGlvbnMge1xuXHRzb3VyY2VQYXRoUmVnZXg6IFJlZ0V4cDtcbn1cblxuZXhwb3J0IHR5cGUgRXh0cmFjdEVycm9yVHlwZSA9ICdDb3JydXB0WmlwJyB8ICdJbmNvbXBsZXRlJztcblxuZXhwb3J0IGNsYXNzIEV4dHJhY3RFcnJvciBleHRlbmRzIEVycm9yIHtcblxuXHRyZWFkb25seSB0eXBlPzogRXh0cmFjdEVycm9yVHlwZTtcblxuXHRjb25zdHJ1Y3Rvcih0eXBlOiBFeHRyYWN0RXJyb3JUeXBlIHwgdW5kZWZpbmVkLCBjYXVzZTogRXJyb3IpIHtcblx0XHRsZXQgbWVzc2FnZSA9IGNhdXNlLm1lc3NhZ2U7XG5cblx0XHRzd2l0Y2ggKHR5cGUpIHtcblx0XHRcdGNhc2UgJ0NvcnJ1cHRaaXAnOiBtZXNzYWdlID0gYENvcnJ1cHQgWklQOiAke21lc3NhZ2V9YDsgYnJlYWs7XG5cdFx0fVxuXG5cdFx0c3VwZXIobWVzc2FnZSk7XG5cdFx0dGhpcy50eXBlID0gdHlwZTtcblx0XHR0aGlzLmNhdXNlID0gY2F1c2U7XG5cdH1cbn1cblxuZnVuY3Rpb24gbW9kZUZyb21FbnRyeShlbnRyeTogRW50cnkpIHtcblx0Y29uc3QgYXR0ciA9IGVudHJ5LmV4dGVybmFsRmlsZUF0dHJpYnV0ZXMgPj4gMTYgfHwgMzMxODg7XG5cblx0cmV0dXJuIFs0NDggLyogU19JUldYVSAqLywgNTYgLyogU19JUldYRyAqLywgNyAvKiBTX0lSV1hPICovXVxuXHRcdC5tYXAobWFzayA9PiBhdHRyICYgbWFzaylcblx0XHQucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgYXR0ciAmIDYxNDQwIC8qIFNfSUZNVCAqLyk7XG59XG5cbmZ1bmN0aW9uIHRvRXh0cmFjdEVycm9yKGVycjogRXJyb3IpOiBFeHRyYWN0RXJyb3Ige1xuXHRpZiAoZXJyIGluc3RhbmNlb2YgRXh0cmFjdEVycm9yKSB7XG5cdFx0cmV0dXJuIGVycjtcblx0fVxuXG5cdGxldCB0eXBlOiBFeHRyYWN0RXJyb3JUeXBlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGlmIChDT1JSVVBUX1pJUF9QQVRURVJOLnRlc3QoZXJyLm1lc3NhZ2UpKSB7XG5cdFx0dHlwZSA9ICdDb3JydXB0WmlwJztcblx0fVxuXG5cdHJldHVybiBuZXcgRXh0cmFjdEVycm9yKHR5cGUsIGVycik7XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RFbnRyeShzdHJlYW06IFJlYWRhYmxlLCBmaWxlTmFtZTogc3RyaW5nLCBtb2RlOiBudW1iZXIsIHRhcmdldFBhdGg6IHN0cmluZywgb3B0aW9uczogSU9wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRjb25zdCBkaXJOYW1lID0gcGF0aC5kaXJuYW1lKGZpbGVOYW1lKTtcblx0Y29uc3QgdGFyZ2V0RGlyTmFtZSA9IHBhdGguam9pbih0YXJnZXRQYXRoLCBkaXJOYW1lKTtcblx0aWYgKCF0YXJnZXREaXJOYW1lLnN0YXJ0c1dpdGgodGFyZ2V0UGF0aCkpIHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZCBmaWxlJywgXCJFcnJvciBleHRyYWN0aW5nIHswfS4gSW52YWxpZCBmaWxlLlwiLCBmaWxlTmFtZSkpKTtcblx0fVxuXHRjb25zdCB0YXJnZXRGaWxlTmFtZSA9IHBhdGguam9pbih0YXJnZXRQYXRoLCBmaWxlTmFtZSk7XG5cblx0bGV0IGlzdHJlYW06IFdyaXRlU3RyZWFtO1xuXG5cdHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHtcblx0XHRpc3RyZWFtPy5kZXN0cm95KCk7XG5cdH0pO1xuXG5cdHJldHVybiBQcm9taXNlLnJlc29sdmUocHJvbWlzZXMubWtkaXIodGFyZ2V0RGlyTmFtZSwgeyByZWN1cnNpdmU6IHRydWUgfSkpLnRoZW4oKCkgPT4gbmV3IFByb21pc2U8dm9pZD4oKGMsIGUpID0+IHtcblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0aXN0cmVhbSA9IGNyZWF0ZVdyaXRlU3RyZWFtKHRhcmdldEZpbGVOYW1lLCB7IG1vZGUgfSk7XG5cdFx0XHRpc3RyZWFtLm9uY2UoJ2Nsb3NlJywgKCkgPT4gYygpKTtcblx0XHRcdGlzdHJlYW0ub25jZSgnZXJyb3InLCBlKTtcblx0XHRcdHN0cmVhbS5vbmNlKCdlcnJvcicsIGUpO1xuXHRcdFx0c3RyZWFtLnBpcGUoaXN0cmVhbSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGUoZXJyb3IpO1xuXHRcdH1cblx0fSkpO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0WmlwKHppcGZpbGU6IFppcEZpbGUsIHRhcmdldFBhdGg6IHN0cmluZywgb3B0aW9uczogSU9wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRsZXQgbGFzdCA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlPHZvaWQ+KCgpID0+IFByb21pc2UucmVzb2x2ZSgpKTtcblx0bGV0IGV4dHJhY3RlZEVudHJpZXNDb3VudCA9IDA7XG5cblx0Y29uc3QgbGlzdGVuZXIgPSB0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB7XG5cdFx0bGFzdC5jYW5jZWwoKTtcblx0XHR6aXBmaWxlLmNsb3NlKCk7XG5cdH0pO1xuXG5cdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigoYywgZSkgPT4ge1xuXHRcdGNvbnN0IHRocm90dGxlciA9IG5ldyBTZXF1ZW5jZXIoKTtcblxuXHRcdGNvbnN0IHJlYWROZXh0RW50cnkgPSAodG9rZW46IENhbmNlbGxhdGlvblRva2VuKSA9PiB7XG5cdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRleHRyYWN0ZWRFbnRyaWVzQ291bnQrKztcblx0XHRcdHppcGZpbGUucmVhZEVudHJ5KCk7XG5cdFx0fTtcblxuXHRcdHppcGZpbGUub25jZSgnZXJyb3InLCBlKTtcblx0XHR6aXBmaWxlLm9uY2UoJ2Nsb3NlJywgKCkgPT4gbGFzdC50aGVuKCgpID0+IHtcblx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCB8fCB6aXBmaWxlLmVudHJ5Q291bnQgPT09IGV4dHJhY3RlZEVudHJpZXNDb3VudCkge1xuXHRcdFx0XHRjKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRlKG5ldyBFeHRyYWN0RXJyb3IoJ0luY29tcGxldGUnLCBuZXcgRXJyb3IobmxzLmxvY2FsaXplKCdpbmNvbXBsZXRlRXh0cmFjdCcsIFwiSW5jb21wbGV0ZS4gRm91bmQgezB9IG9mIHsxfSBlbnRyaWVzXCIsIGV4dHJhY3RlZEVudHJpZXNDb3VudCwgemlwZmlsZS5lbnRyeUNvdW50KSkpKTtcblx0XHRcdH1cblx0XHR9LCBlKSk7XG5cdFx0emlwZmlsZS5yZWFkRW50cnkoKTtcblx0XHR6aXBmaWxlLm9uKCdlbnRyeScsIChlbnRyeTogRW50cnkpID0+IHtcblxuXHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFvcHRpb25zLnNvdXJjZVBhdGhSZWdleC50ZXN0KGVudHJ5LmZpbGVOYW1lKSkge1xuXHRcdFx0XHRyZWFkTmV4dEVudHJ5KHRva2VuKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBmaWxlTmFtZSA9IGVudHJ5LmZpbGVOYW1lLnJlcGxhY2Uob3B0aW9ucy5zb3VyY2VQYXRoUmVnZXgsICcnKTtcblxuXHRcdFx0Ly8gZGlyZWN0b3J5IGZpbGUgbmFtZXMgZW5kIHdpdGggJy8nXG5cdFx0XHRpZiAoL1xcLyQvLnRlc3QoZmlsZU5hbWUpKSB7XG5cdFx0XHRcdGNvbnN0IHRhcmdldEZpbGVOYW1lID0gcGF0aC5qb2luKHRhcmdldFBhdGgsIGZpbGVOYW1lKTtcblx0XHRcdFx0bGFzdCA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKHRva2VuID0+IHByb21pc2VzLm1rZGlyKHRhcmdldEZpbGVOYW1lLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KS50aGVuKCgpID0+IHJlYWROZXh0RW50cnkodG9rZW4pKS50aGVuKHVuZGVmaW5lZCwgZSkpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHN0cmVhbSA9IG9wZW5aaXBTdHJlYW0oemlwZmlsZSwgZW50cnkpO1xuXHRcdFx0Y29uc3QgbW9kZSA9IG1vZGVGcm9tRW50cnkoZW50cnkpO1xuXG5cdFx0XHRsYXN0ID0gY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UodG9rZW4gPT4gdGhyb3R0bGVyLnF1ZXVlKCgpID0+IHN0cmVhbS50aGVuKHN0cmVhbSA9PiBleHRyYWN0RW50cnkoc3RyZWFtLCBmaWxlTmFtZSwgbW9kZSwgdGFyZ2V0UGF0aCwgb3B0aW9ucywgdG9rZW4pLnRoZW4oKCkgPT4gcmVhZE5leHRFbnRyeSh0b2tlbikpKSkudGhlbihudWxsLCBlKSk7XG5cdFx0fSk7XG5cdH0pLmZpbmFsbHkoKCkgPT4gbGlzdGVuZXIuZGlzcG9zZSgpKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gb3BlblppcCh6aXBGaWxlOiBzdHJpbmcsIGxhenk6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8WmlwRmlsZT4ge1xuXHRjb25zdCB7IG9wZW4gfSA9IGF3YWl0IGltcG9ydCgneWF1emwnKTtcblxuXHRyZXR1cm4gbmV3IFByb21pc2U8WmlwRmlsZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdG9wZW4oemlwRmlsZSwgbGF6eSA/IHsgbGF6eUVudHJpZXM6IHRydWUgfSA6IHVuZGVmaW5lZCEsIChlcnJvcjogRXJyb3IgfCBudWxsLCB6aXBmaWxlPzogWmlwRmlsZSkgPT4ge1xuXHRcdFx0aWYgKGVycm9yKSB7XG5cdFx0XHRcdHJlamVjdCh0b0V4dHJhY3RFcnJvcihlcnJvcikpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzb2x2ZShhc3NlcnRJc0RlZmluZWQoemlwZmlsZSkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcbn1cblxuZnVuY3Rpb24gb3BlblppcFN0cmVhbSh6aXBGaWxlOiBaaXBGaWxlLCBlbnRyeTogRW50cnkpOiBQcm9taXNlPFJlYWRhYmxlPiB7XG5cdHJldHVybiBuZXcgUHJvbWlzZTxSZWFkYWJsZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdHppcEZpbGUub3BlblJlYWRTdHJlYW0oZW50cnksIChlcnJvcjogRXJyb3IgfCBudWxsLCBzdHJlYW0/OiBSZWFkYWJsZSkgPT4ge1xuXHRcdFx0aWYgKGVycm9yKSB7XG5cdFx0XHRcdHJlamVjdCh0b0V4dHJhY3RFcnJvcihlcnJvcikpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzb2x2ZShhc3NlcnRJc0RlZmluZWQoc3RyZWFtKSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlIHtcblx0cGF0aDogc3RyaW5nO1xuXHRjb250ZW50cz86IEJ1ZmZlciB8IHN0cmluZztcblx0bG9jYWxQYXRoPzogc3RyaW5nO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gemlwKHppcFBhdGg6IHN0cmluZywgZmlsZXM6IElGaWxlW10pOiBQcm9taXNlPHN0cmluZz4ge1xuXHRjb25zdCB7IFppcEZpbGUgfSA9IGF3YWl0IGltcG9ydCgneWF6bCcpO1xuXG5cdHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KChjLCBlKSA9PiB7XG5cdFx0Y29uc3QgemlwID0gbmV3IFppcEZpbGUoKTtcblx0XHRmaWxlcy5mb3JFYWNoKGYgPT4ge1xuXHRcdFx0aWYgKGYuY29udGVudHMpIHtcblx0XHRcdFx0emlwLmFkZEJ1ZmZlcih0eXBlb2YgZi5jb250ZW50cyA9PT0gJ3N0cmluZycgPyBCdWZmZXIuZnJvbShmLmNvbnRlbnRzLCAndXRmOCcpIDogZi5jb250ZW50cywgZi5wYXRoKTtcblx0XHRcdH0gZWxzZSBpZiAoZi5sb2NhbFBhdGgpIHtcblx0XHRcdFx0emlwLmFkZEZpbGUoZi5sb2NhbFBhdGgsIGYucGF0aCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0emlwLmVuZCgpO1xuXG5cdFx0Y29uc3QgemlwU3RyZWFtID0gY3JlYXRlV3JpdGVTdHJlYW0oemlwUGF0aCk7XG5cdFx0emlwLm91dHB1dFN0cmVhbS5waXBlKHppcFN0cmVhbSk7XG5cblx0XHR6aXAub3V0cHV0U3RyZWFtLm9uY2UoJ2Vycm9yJywgZSk7XG5cdFx0emlwU3RyZWFtLm9uY2UoJ2Vycm9yJywgZSk7XG5cdFx0emlwU3RyZWFtLm9uY2UoJ2ZpbmlzaCcsICgpID0+IGMoemlwUGF0aCkpO1xuXHR9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3QoemlwUGF0aDogc3RyaW5nLCB0YXJnZXRQYXRoOiBzdHJpbmcsIG9wdGlvbnM6IElFeHRyYWN0T3B0aW9ucyA9IHt9LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0Y29uc3Qgc291cmNlUGF0aFJlZ2V4ID0gbmV3IFJlZ0V4cChvcHRpb25zLnNvdXJjZVBhdGggPyBgXiR7b3B0aW9ucy5zb3VyY2VQYXRofWAgOiAnJyk7XG5cblx0bGV0IHByb21pc2UgPSBvcGVuWmlwKHppcFBhdGgsIHRydWUpO1xuXG5cdGlmIChvcHRpb25zLm92ZXJ3cml0ZSkge1xuXHRcdHByb21pc2UgPSBwcm9taXNlLnRoZW4oemlwZmlsZSA9PiBQcm9taXNlcy5ybSh0YXJnZXRQYXRoKS50aGVuKCgpID0+IHppcGZpbGUpKTtcblx0fVxuXG5cdHJldHVybiBwcm9taXNlLnRoZW4oemlwZmlsZSA9PiBleHRyYWN0WmlwKHppcGZpbGUsIHRhcmdldFBhdGgsIHsgc291cmNlUGF0aFJlZ2V4IH0sIHRva2VuKSk7XG59XG5cbmZ1bmN0aW9uIHJlYWQoemlwUGF0aDogc3RyaW5nLCBmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxSZWFkYWJsZT4ge1xuXHRyZXR1cm4gb3BlblppcCh6aXBQYXRoKS50aGVuKHppcGZpbGUgPT4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTxSZWFkYWJsZT4oKGMsIGUpID0+IHtcblx0XHRcdHppcGZpbGUub24oJ2VudHJ5JywgKGVudHJ5OiBFbnRyeSkgPT4ge1xuXHRcdFx0XHRpZiAoZW50cnkuZmlsZU5hbWUgPT09IGZpbGVQYXRoKSB7XG5cdFx0XHRcdFx0b3BlblppcFN0cmVhbSh6aXBmaWxlLCBlbnRyeSkudGhlbihzdHJlYW0gPT4gYyhzdHJlYW0pLCBlcnIgPT4gZShlcnIpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHppcGZpbGUub25jZSgnY2xvc2UnLCAoKSA9PiBlKG5ldyBFcnJvcihubHMubG9jYWxpemUoJ25vdEZvdW5kJywgXCJ7MH0gbm90IGZvdW5kIGluc2lkZSB6aXAuXCIsIGZpbGVQYXRoKSkpKTtcblx0XHR9KTtcblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWZmZXIoemlwUGF0aDogc3RyaW5nLCBmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxCdWZmZXI+IHtcblx0cmV0dXJuIHJlYWQoemlwUGF0aCwgZmlsZVBhdGgpLnRoZW4oc3RyZWFtID0+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8QnVmZmVyPigoYywgZSkgPT4ge1xuXHRcdFx0Y29uc3QgYnVmZmVyczogQnVmZmVyW10gPSBbXTtcblx0XHRcdHN0cmVhbS5vbmNlKCdlcnJvcicsIGUpO1xuXHRcdFx0c3RyZWFtLm9uKCdkYXRhJywgKGI6IEJ1ZmZlcikgPT4gYnVmZmVycy5wdXNoKGIpKTtcblx0XHRcdHN0cmVhbS5vbignZW5kJywgKCkgPT4gYyhCdWZmZXIuY29uY2F0KGJ1ZmZlcnMpKSk7XG5cdFx0fSk7XG5cdH0pO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxtQkFBZ0MsZ0JBQWdCO0FBRXpELFNBQVMseUJBQXlCLGlCQUFpQjtBQUVuRCxZQUFZLFVBQVU7QUFDdEIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxnQkFBZ0I7QUFDekIsWUFBWSxTQUFTO0FBR2QsTUFBTSxvQkFBNEI7QUFDekMsTUFBTSxzQkFBc0IsSUFBSSxPQUFPLGlCQUFpQjtBQWtCakQsTUFBTSxxQkFBcUIsTUFBTTtBQUFBLEVBSXZDLFlBQVksTUFBb0MsT0FBYztBQUM3RCxRQUFJLFVBQVUsTUFBTTtBQUVwQixZQUFRLE1BQU07QUFBQSxNQUNiLEtBQUs7QUFBYyxrQkFBVSxnQkFBZ0IsT0FBTztBQUFJO0FBQUEsSUFDekQ7QUFFQSxVQUFNLE9BQU87QUFDYixTQUFLLE9BQU87QUFDWixTQUFLLFFBQVE7QUFBQSxFQUNkO0FBQ0Q7QUFFQSxTQUFTLGNBQWMsT0FBYztBQUNwQyxRQUFNLE9BQU8sTUFBTSwwQkFBMEIsTUFBTTtBQUVuRCxTQUFPO0FBQUEsSUFBQztBQUFBLElBQW1CO0FBQUEsSUFBa0I7QUFBQTtBQUFBLEVBQWUsRUFDMUQsSUFBSSxVQUFRLE9BQU8sSUFBSSxFQUN2QjtBQUFBLElBQU8sQ0FBQyxHQUFHLE1BQU0sSUFBSTtBQUFBLElBQUcsT0FBTztBQUFBO0FB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
