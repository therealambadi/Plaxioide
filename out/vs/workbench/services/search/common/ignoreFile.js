import * as glob from "../../../../base/common/glob.js";
class IgnoreFile {
  constructor(contents, location, parent) {
    this.location = location;
    this.parent = parent;
    if (location[location.length - 1] === "\\") {
      throw Error("Unexpected path format, do not use trailing backslashes");
    }
    if (location[location.length - 1] !== "/") {
      location += "/";
    }
    this.isPathIgnored = this.parseIgnoreFile(contents, this.location, this.parent);
  }
  /**
   * Updates the contents of the ignorefile. Preservering the location and parent
   * @param contents The new contents of the gitignore file
   */
  updateContents(contents) {
    this.isPathIgnored = this.parseIgnoreFile(contents, this.location, this.parent);
  }
  /**
   * Returns true if a path in a traversable directory has not been ignored.
   *
   * Note: For performance reasons this does not check if the parent directories have been ignored,
   * so it should always be used in tandem with `shouldTraverseDir` when walking a directory.
   *
   * In cases where a path must be tested in isolation, `isArbitraryPathIncluded` should be used.
   */
  isPathIncludedInTraversal(path, isDir) {
    if (path[0] !== "/" || path[path.length - 1] === "/") {
      throw Error("Unexpected path format, expectred to begin with slash and end without. got:" + path);
    }
    const ignored = this.isPathIgnored(path, isDir);
    return !ignored;
  }
  /**
   * Returns true if an arbitrary path has not been ignored.
   * This is an expensive operation and should only be used ouside of traversals.
   */
  isArbitraryPathIgnored(path, isDir) {
    if (path[0] !== "/" || path[path.length - 1] === "/") {
      throw Error("Unexpected path format, expectred to begin with slash and end without. got:" + path);
    }
    const segments = path.split("/").filter((x) => x);
    let ignored = false;
    let walkingPath = "";
    for (let i = 0; i < segments.length; i++) {
      const isLast = i === segments.length - 1;
      const segment = segments[i];
      walkingPath = walkingPath + "/" + segment;
      if (!this.isPathIncludedInTraversal(walkingPath, isLast ? isDir : true)) {
        ignored = true;
        break;
      }
    }
    return ignored;
  }
  gitignoreLinesToExpression(lines, dirPath, trimForExclusions) {
    const includeLines = lines.map((line) => this.gitignoreLineToGlob(line, dirPath));
    const includeExpression = /* @__PURE__ */ Object.create(null);
    for (const line of includeLines) {
      includeExpression[line] = true;
    }
    return glob.parse(includeExpression, { trimForExclusions });
  }
  parseIgnoreFile(ignoreContents, dirPath, parent) {
    const contentLines = ignoreContents.split("\n").map((line) => line.trim()).filter((line) => line && line[0] !== "#");
    const fileLines = contentLines.filter((line) => !line.endsWith("/"));
    const fileIgnoreLines = fileLines.filter((line) => !line.includes("!"));
    const isFileIgnored = this.gitignoreLinesToExpression(fileIgnoreLines, dirPath, true);
    const fileIncludeLines = fileLines.filter((line) => line.includes("!")).map((line) => line.replace(/!/g, ""));
    const isFileIncluded = this.gitignoreLinesToExpression(fileIncludeLines, dirPath, false);
    const dirIgnoreLines = contentLines.filter((line) => !line.includes("!"));
    const isDirIgnored = this.gitignoreLinesToExpression(dirIgnoreLines, dirPath, true);
    const dirIncludeLines = contentLines.filter((line) => line.includes("!")).map((line) => line.replace(/!/g, ""));
    const isDirIncluded = this.gitignoreLinesToExpression(dirIncludeLines, dirPath, false);
    const isPathIgnored = (path, isDir) => {
      if (!path.startsWith(dirPath)) {
        return false;
      }
      if (isDir && isDirIgnored(path) && !isDirIncluded(path)) {
        return true;
      }
      if (isFileIgnored(path) && !isFileIncluded(path)) {
        return true;
      }
      if (parent) {
        return parent.isPathIgnored(path, isDir);
      }
      return false;
    };
    return isPathIgnored;
  }
  gitignoreLineToGlob(line, dirPath) {
    const firstSep = line.indexOf("/");
    if (firstSep === -1 || firstSep === line.length - 1) {
      line = "**/" + line;
    } else {
      if (firstSep === 0) {
        if (dirPath.slice(-1) === "/") {
          line = line.slice(1);
        }
      } else {
        if (dirPath.slice(-1) !== "/") {
          line = "/" + line;
        }
      }
      line = dirPath + line;
    }
    return line;
  }
}
export {
  IgnoreFile
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL2NvbW1vbi9pZ25vcmVGaWxlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZ2xvYiBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9nbG9iLmpzJztcblxuXG5leHBvcnQgY2xhc3MgSWdub3JlRmlsZSB7XG5cblx0cHJpdmF0ZSBpc1BhdGhJZ25vcmVkOiAocGF0aDogc3RyaW5nLCBpc0RpcjogYm9vbGVhbiwgcGFyZW50PzogSWdub3JlRmlsZSkgPT4gYm9vbGVhbjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250ZW50czogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbG9jYXRpb246IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHBhcmVudD86IElnbm9yZUZpbGUpIHtcblx0XHRpZiAobG9jYXRpb25bbG9jYXRpb24ubGVuZ3RoIC0gMV0gPT09ICdcXFxcJykge1xuXHRcdFx0dGhyb3cgRXJyb3IoJ1VuZXhwZWN0ZWQgcGF0aCBmb3JtYXQsIGRvIG5vdCB1c2UgdHJhaWxpbmcgYmFja3NsYXNoZXMnKTtcblx0XHR9XG5cdFx0aWYgKGxvY2F0aW9uW2xvY2F0aW9uLmxlbmd0aCAtIDFdICE9PSAnLycpIHtcblx0XHRcdGxvY2F0aW9uICs9ICcvJztcblx0XHR9XG5cdFx0dGhpcy5pc1BhdGhJZ25vcmVkID0gdGhpcy5wYXJzZUlnbm9yZUZpbGUoY29udGVudHMsIHRoaXMubG9jYXRpb24sIHRoaXMucGFyZW50KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBVcGRhdGVzIHRoZSBjb250ZW50cyBvZiB0aGUgaWdub3JlZmlsZS4gUHJlc2VydmVyaW5nIHRoZSBsb2NhdGlvbiBhbmQgcGFyZW50XG5cdCAqIEBwYXJhbSBjb250ZW50cyBUaGUgbmV3IGNvbnRlbnRzIG9mIHRoZSBnaXRpZ25vcmUgZmlsZVxuXHQgKi9cblx0dXBkYXRlQ29udGVudHMoY29udGVudHM6IHN0cmluZykge1xuXHRcdHRoaXMuaXNQYXRoSWdub3JlZCA9IHRoaXMucGFyc2VJZ25vcmVGaWxlKGNvbnRlbnRzLCB0aGlzLmxvY2F0aW9uLCB0aGlzLnBhcmVudCk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB0cnVlIGlmIGEgcGF0aCBpbiBhIHRyYXZlcnNhYmxlIGRpcmVjdG9yeSBoYXMgbm90IGJlZW4gaWdub3JlZC5cblx0ICpcblx0ICogTm90ZTogRm9yIHBlcmZvcm1hbmNlIHJlYXNvbnMgdGhpcyBkb2VzIG5vdCBjaGVjayBpZiB0aGUgcGFyZW50IGRpcmVjdG9yaWVzIGhhdmUgYmVlbiBpZ25vcmVkLFxuXHQgKiBzbyBpdCBzaG91bGQgYWx3YXlzIGJlIHVzZWQgaW4gdGFuZGVtIHdpdGggYHNob3VsZFRyYXZlcnNlRGlyYCB3aGVuIHdhbGtpbmcgYSBkaXJlY3RvcnkuXG5cdCAqXG5cdCAqIEluIGNhc2VzIHdoZXJlIGEgcGF0aCBtdXN0IGJlIHRlc3RlZCBpbiBpc29sYXRpb24sIGBpc0FyYml0cmFyeVBhdGhJbmNsdWRlZGAgc2hvdWxkIGJlIHVzZWQuXG5cdCAqL1xuXHRpc1BhdGhJbmNsdWRlZEluVHJhdmVyc2FsKHBhdGg6IHN0cmluZywgaXNEaXI6IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRpZiAocGF0aFswXSAhPT0gJy8nIHx8IHBhdGhbcGF0aC5sZW5ndGggLSAxXSA9PT0gJy8nKSB7XG5cdFx0XHR0aHJvdyBFcnJvcignVW5leHBlY3RlZCBwYXRoIGZvcm1hdCwgZXhwZWN0cmVkIHRvIGJlZ2luIHdpdGggc2xhc2ggYW5kIGVuZCB3aXRob3V0LiBnb3Q6JyArIHBhdGgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlnbm9yZWQgPSB0aGlzLmlzUGF0aElnbm9yZWQocGF0aCwgaXNEaXIpO1xuXG5cdFx0cmV0dXJuICFpZ25vcmVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdHJ1ZSBpZiBhbiBhcmJpdHJhcnkgcGF0aCBoYXMgbm90IGJlZW4gaWdub3JlZC5cblx0ICogVGhpcyBpcyBhbiBleHBlbnNpdmUgb3BlcmF0aW9uIGFuZCBzaG91bGQgb25seSBiZSB1c2VkIG91c2lkZSBvZiB0cmF2ZXJzYWxzLlxuXHQgKi9cblx0aXNBcmJpdHJhcnlQYXRoSWdub3JlZChwYXRoOiBzdHJpbmcsIGlzRGlyOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0aWYgKHBhdGhbMF0gIT09ICcvJyB8fCBwYXRoW3BhdGgubGVuZ3RoIC0gMV0gPT09ICcvJykge1xuXHRcdFx0dGhyb3cgRXJyb3IoJ1VuZXhwZWN0ZWQgcGF0aCBmb3JtYXQsIGV4cGVjdHJlZCB0byBiZWdpbiB3aXRoIHNsYXNoIGFuZCBlbmQgd2l0aG91dC4gZ290OicgKyBwYXRoKTtcblx0XHR9XG5cblx0XHRjb25zdCBzZWdtZW50cyA9IHBhdGguc3BsaXQoJy8nKS5maWx0ZXIoeCA9PiB4KTtcblx0XHRsZXQgaWdub3JlZCA9IGZhbHNlO1xuXG5cdFx0bGV0IHdhbGtpbmdQYXRoID0gJyc7XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHNlZ21lbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBpc0xhc3QgPSBpID09PSBzZWdtZW50cy5sZW5ndGggLSAxO1xuXHRcdFx0Y29uc3Qgc2VnbWVudCA9IHNlZ21lbnRzW2ldO1xuXG5cdFx0XHR3YWxraW5nUGF0aCA9IHdhbGtpbmdQYXRoICsgJy8nICsgc2VnbWVudDtcblxuXHRcdFx0aWYgKCF0aGlzLmlzUGF0aEluY2x1ZGVkSW5UcmF2ZXJzYWwod2Fsa2luZ1BhdGgsIGlzTGFzdCA/IGlzRGlyIDogdHJ1ZSkpIHtcblx0XHRcdFx0aWdub3JlZCA9IHRydWU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBpZ25vcmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBnaXRpZ25vcmVMaW5lc1RvRXhwcmVzc2lvbihsaW5lczogc3RyaW5nW10sIGRpclBhdGg6IHN0cmluZywgdHJpbUZvckV4Y2x1c2lvbnM6IGJvb2xlYW4pOiBnbG9iLlBhcnNlZEV4cHJlc3Npb24ge1xuXHRcdGNvbnN0IGluY2x1ZGVMaW5lcyA9IGxpbmVzLm1hcChsaW5lID0+IHRoaXMuZ2l0aWdub3JlTGluZVRvR2xvYihsaW5lLCBkaXJQYXRoKSk7XG5cblx0XHRjb25zdCBpbmNsdWRlRXhwcmVzc2lvbjogZ2xvYi5JRXhwcmVzc2lvbiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0Zm9yIChjb25zdCBsaW5lIG9mIGluY2x1ZGVMaW5lcykge1xuXHRcdFx0aW5jbHVkZUV4cHJlc3Npb25bbGluZV0gPSB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBnbG9iLnBhcnNlKGluY2x1ZGVFeHByZXNzaW9uLCB7IHRyaW1Gb3JFeGNsdXNpb25zIH0pO1xuXHR9XG5cblxuXHRwcml2YXRlIHBhcnNlSWdub3JlRmlsZShpZ25vcmVDb250ZW50czogc3RyaW5nLCBkaXJQYXRoOiBzdHJpbmcsIHBhcmVudDogSWdub3JlRmlsZSB8IHVuZGVmaW5lZCk6IChwYXRoOiBzdHJpbmcsIGlzRGlyOiBib29sZWFuKSA9PiBib29sZWFuIHtcblx0XHRjb25zdCBjb250ZW50TGluZXMgPSBpZ25vcmVDb250ZW50c1xuXHRcdFx0LnNwbGl0KCdcXG4nKVxuXHRcdFx0Lm1hcChsaW5lID0+IGxpbmUudHJpbSgpKVxuXHRcdFx0LmZpbHRlcihsaW5lID0+IGxpbmUgJiYgbGluZVswXSAhPT0gJyMnKTtcblxuXHRcdC8vIFB1bGwgb3V0IGFsbCB0aGUgbGluZXMgdGhhdCBlbmQgd2l0aCBgL2AsIHRob3NlIG9ubHkgYXBwbHkgdG8gZGlyZWN0b3JpZXNcblx0XHRjb25zdCBmaWxlTGluZXMgPSBjb250ZW50TGluZXMuZmlsdGVyKGxpbmUgPT4gIWxpbmUuZW5kc1dpdGgoJy8nKSk7XG5cblx0XHRjb25zdCBmaWxlSWdub3JlTGluZXMgPSBmaWxlTGluZXMuZmlsdGVyKGxpbmUgPT4gIWxpbmUuaW5jbHVkZXMoJyEnKSk7XG5cdFx0Y29uc3QgaXNGaWxlSWdub3JlZCA9IHRoaXMuZ2l0aWdub3JlTGluZXNUb0V4cHJlc3Npb24oZmlsZUlnbm9yZUxpbmVzLCBkaXJQYXRoLCB0cnVlKTtcblxuXHRcdC8vIFRPRE86IFNsaWdodCBoYWNrLi4uIHRoaXMgbmFpZXZlIGFwcHJvYWNoIG1heSByZWludHJvZHVjZSB0b28gbWFueSBmaWxlcyBpbiBjYXNlcyBvZiB3ZWlyZGx5IGNvbXBsZXggLmdpdGlnbm9yZXNcblx0XHRjb25zdCBmaWxlSW5jbHVkZUxpbmVzID0gZmlsZUxpbmVzLmZpbHRlcihsaW5lID0+IGxpbmUuaW5jbHVkZXMoJyEnKSkubWFwKGxpbmUgPT4gbGluZS5yZXBsYWNlKC8hL2csICcnKSk7XG5cdFx0Y29uc3QgaXNGaWxlSW5jbHVkZWQgPSB0aGlzLmdpdGlnbm9yZUxpbmVzVG9FeHByZXNzaW9uKGZpbGVJbmNsdWRlTGluZXMsIGRpclBhdGgsIGZhbHNlKTtcblxuXHRcdC8vIFdoZW4gY2hlY2tpbmcgaWYgYSBkaXIgaXMgaWdub3JlZCB3ZSBjYW4gdXNlIGFsbCBsaW5lc1xuXHRcdGNvbnN0IGRpcklnbm9yZUxpbmVzID0gY29udGVudExpbmVzLmZpbHRlcihsaW5lID0+ICFsaW5lLmluY2x1ZGVzKCchJykpO1xuXHRcdGNvbnN0IGlzRGlySWdub3JlZCA9IHRoaXMuZ2l0aWdub3JlTGluZXNUb0V4cHJlc3Npb24oZGlySWdub3JlTGluZXMsIGRpclBhdGgsIHRydWUpO1xuXG5cdFx0Ly8gU2FtZSBoYWNrLlxuXHRcdGNvbnN0IGRpckluY2x1ZGVMaW5lcyA9IGNvbnRlbnRMaW5lcy5maWx0ZXIobGluZSA9PiBsaW5lLmluY2x1ZGVzKCchJykpLm1hcChsaW5lID0+IGxpbmUucmVwbGFjZSgvIS9nLCAnJykpO1xuXHRcdGNvbnN0IGlzRGlySW5jbHVkZWQgPSB0aGlzLmdpdGlnbm9yZUxpbmVzVG9FeHByZXNzaW9uKGRpckluY2x1ZGVMaW5lcywgZGlyUGF0aCwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgaXNQYXRoSWdub3JlZCA9IChwYXRoOiBzdHJpbmcsIGlzRGlyOiBib29sZWFuKSA9PiB7XG5cdFx0XHRpZiAoIXBhdGguc3RhcnRzV2l0aChkaXJQYXRoKSkgeyByZXR1cm4gZmFsc2U7IH1cblx0XHRcdGlmIChpc0RpciAmJiBpc0Rpcklnbm9yZWQocGF0aCkgJiYgIWlzRGlySW5jbHVkZWQocGF0aCkpIHsgcmV0dXJuIHRydWU7IH1cblx0XHRcdGlmIChpc0ZpbGVJZ25vcmVkKHBhdGgpICYmICFpc0ZpbGVJbmNsdWRlZChwYXRoKSkgeyByZXR1cm4gdHJ1ZTsgfVxuXG5cdFx0XHRpZiAocGFyZW50KSB7IHJldHVybiBwYXJlbnQuaXNQYXRoSWdub3JlZChwYXRoLCBpc0Rpcik7IH1cblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH07XG5cblx0XHRyZXR1cm4gaXNQYXRoSWdub3JlZDtcblx0fVxuXG5cdHByaXZhdGUgZ2l0aWdub3JlTGluZVRvR2xvYihsaW5lOiBzdHJpbmcsIGRpclBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgZmlyc3RTZXAgPSBsaW5lLmluZGV4T2YoJy8nKTtcblx0XHRpZiAoZmlyc3RTZXAgPT09IC0xIHx8IGZpcnN0U2VwID09PSBsaW5lLmxlbmd0aCAtIDEpIHtcblx0XHRcdGxpbmUgPSAnKiovJyArIGxpbmU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChmaXJzdFNlcCA9PT0gMCkge1xuXHRcdFx0XHRpZiAoZGlyUGF0aC5zbGljZSgtMSkgPT09ICcvJykge1xuXHRcdFx0XHRcdGxpbmUgPSBsaW5lLnNsaWNlKDEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoZGlyUGF0aC5zbGljZSgtMSkgIT09ICcvJykge1xuXHRcdFx0XHRcdGxpbmUgPSAnLycgKyBsaW5lO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRsaW5lID0gZGlyUGF0aCArIGxpbmU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxpbmU7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksVUFBVTtBQUdmLE1BQU0sV0FBVztBQUFBLEVBSXZCLFlBQ0MsVUFDaUIsVUFDQSxRQUFxQjtBQURyQjtBQUNBO0FBQ2pCLFFBQUksU0FBUyxTQUFTLFNBQVMsQ0FBQyxNQUFNLE1BQU07QUFDM0MsWUFBTSxNQUFNLHlEQUF5RDtBQUFBLElBQ3RFO0FBQ0EsUUFBSSxTQUFTLFNBQVMsU0FBUyxDQUFDLE1BQU0sS0FBSztBQUMxQyxrQkFBWTtBQUFBLElBQ2I7QUFDQSxTQUFLLGdCQUFnQixLQUFLLGdCQUFnQixVQUFVLEtBQUssVUFBVSxLQUFLLE1BQU07QUFBQSxFQUMvRTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFNQSxlQUFlLFVBQWtCO0FBQ2hDLFNBQUssZ0JBQWdCLEtBQUssZ0JBQWdCLFVBQVUsS0FBSyxVQUFVLEtBQUssTUFBTTtBQUFBLEVBQy9FO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBVUEsMEJBQTBCLE1BQWMsT0FBeUI7QUFDaEUsUUFBSSxLQUFLLENBQUMsTUFBTSxPQUFPLEtBQUssS0FBSyxTQUFTLENBQUMsTUFBTSxLQUFLO0FBQ3JELFlBQU0sTUFBTSxnRkFBZ0YsSUFBSTtBQUFBLElBQ2pHO0FBRUEsVUFBTSxVQUFVLEtBQUssY0FBYyxNQUFNLEtBQUs7QUFFOUMsV0FBTyxDQUFDO0FBQUEsRUFDVDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFNQSx1QkFBdUIsTUFBYyxPQUF5QjtBQUM3RCxRQUFJLEtBQUssQ0FBQyxNQUFNLE9BQU8sS0FBSyxLQUFLLFNBQVMsQ0FBQyxNQUFNLEtBQUs7QUFDckQsWUFBTSxNQUFNLGdGQUFnRixJQUFJO0FBQUEsSUFDakc7QUFFQSxVQUFNLFdBQVcsS0FBSyxNQUFNLEdBQUcsRUFBRSxPQUFPLE9BQUssQ0FBQztBQUM5QyxRQUFJLFVBQVU7QUFFZCxRQUFJLGNBQWM7QUFFbEIsYUFBUyxJQUFJLEdBQUcsSUFBSSxTQUFTLFFBQVEsS0FBSztBQUN6QyxZQUFNLFNBQVMsTUFBTSxTQUFTLFNBQVM7QUFDdkMsWUFBTSxVQUFVLFNBQVMsQ0FBQztBQUUxQixvQkFBYyxjQUFjLE1BQU07QUFFbEMsVUFBSSxDQUFDLEtBQUssMEJBQTBCLGFBQWEsU0FBUyxRQUFRLElBQUksR0FBRztBQUN4RSxrQkFBVTtBQUNWO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsMkJBQTJCLE9BQWlCLFNBQWlCLG1CQUFtRDtBQUN2SCxVQUFNLGVBQWUsTUFBTSxJQUFJLFVBQVEsS0FBSyxvQkFBb0IsTUFBTSxPQUFPLENBQUM7QUFFOUUsVUFBTSxvQkFBc0MsdUJBQU8sT0FBTyxJQUFJO0FBQzlELGVBQVcsUUFBUSxjQUFjO0FBQ2hDLHdCQUFrQixJQUFJLElBQUk7QUFBQSxJQUMzQjtBQUVBLFdBQU8sS0FBSyxNQUFNLG1CQUFtQixFQUFFLGtCQUFrQixDQUFDO0FBQUEsRUFDM0Q7QUFBQSxFQUdRLGdCQUFnQixnQkFBd0IsU0FBaUIsUUFBMkU7QUFDM0ksVUFBTSxlQUFlLGVBQ25CLE1BQU0sSUFBSSxFQUNWLElBQUksVUFBUSxLQUFLLEtBQUssQ0FBQyxFQUN2QixPQUFPLFVBQVEsUUFBUSxLQUFLLENBQUMsTUFBTSxHQUFHO0FBR3hDLFVBQU0sWUFBWSxhQUFhLE9BQU8sVUFBUSxDQUFDLEtBQUssU0FBUyxHQUFHLENBQUM7QUFFakUsVUFBTSxrQkFBa0IsVUFBVSxPQUFPLFVBQVEsQ0FBQyxLQUFLLFNBQVMsR0FBRyxDQUFDO0FBQ3BFLFVBQU0sZ0JBQWdCLEtBQUssMkJBQTJCLGlCQUFpQixTQUFTLElBQUk7QUFHcEYsVUFBTSxtQkFBbUIsVUFBVSxPQUFPLFVBQVEsS0FBSyxTQUFTLEdBQUcsQ0FBQyxFQUFFLElBQUksVUFBUSxLQUFLLFFBQVEsTUFBTSxFQUFFLENBQUM7QUFDeEcsVUFBTSxpQkFBaUIsS0FBSywyQkFBMkIsa0JBQWtCLFNBQVMsS0FBSztBQUd2RixVQUFNLGlCQUFpQixhQUFhLE9BQU8sVUFBUSxDQUFDLEtBQUssU0FBUyxHQUFHLENBQUM7QUFDdEUsVUFBTSxlQUFlLEtBQUssMkJBQTJCLGdCQUFnQixTQUFTLElBQUk7QUFHbEYsVUFBTSxrQkFBa0IsYUFBYSxPQUFPLFVBQVEsS0FBSyxTQUFTLEdBQUcsQ0FBQyxFQUFFLElBQUksVUFBUSxLQUFLLFFBQVEsTUFBTSxFQUFFLENBQUM7QUFDMUcsVUFBTSxnQkFBZ0IsS0FBSywyQkFBMkIsaUJBQWlCLFNBQVMsS0FBSztBQUVyRixVQUFNLGdCQUFnQixDQUFDLE1BQWMsVUFBbUI7QUFDdkQsVUFBSSxDQUFDLEtBQUssV0FBVyxPQUFPLEdBQUc7QUFBRSxlQUFPO0FBQUEsTUFBTztBQUMvQyxVQUFJLFNBQVMsYUFBYSxJQUFJLEtBQUssQ0FBQyxjQUFjLElBQUksR0FBRztBQUFFLGVBQU87QUFBQSxNQUFNO0FBQ3hFLFVBQUksY0FBYyxJQUFJLEtBQUssQ0FBQyxlQUFlLElBQUksR0FBRztBQUFFLGVBQU87QUFBQSxNQUFNO0FBRWpFLFVBQUksUUFBUTtBQUFFLGVBQU8sT0FBTyxjQUFjLE1BQU0sS0FBSztBQUFBLE1BQUc7QUFFeEQsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsb0JBQW9CLE1BQWMsU0FBeUI7QUFDbEUsVUFBTSxXQUFXLEtBQUssUUFBUSxHQUFHO0FBQ2pDLFFBQUksYUFBYSxNQUFNLGFBQWEsS0FBSyxTQUFTLEdBQUc7QUFDcEQsYUFBTyxRQUFRO0FBQUEsSUFDaEIsT0FBTztBQUNOLFVBQUksYUFBYSxHQUFHO0FBQ25CLFlBQUksUUFBUSxNQUFNLEVBQUUsTUFBTSxLQUFLO0FBQzlCLGlCQUFPLEtBQUssTUFBTSxDQUFDO0FBQUEsUUFDcEI7QUFBQSxNQUNELE9BQU87QUFDTixZQUFJLFFBQVEsTUFBTSxFQUFFLE1BQU0sS0FBSztBQUM5QixpQkFBTyxNQUFNO0FBQUEsUUFDZDtBQUFBLE1BQ0Q7QUFDQSxhQUFPLFVBQVU7QUFBQSxJQUNsQjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQ0Q7IiwKICAibmFtZXMiOiBbXQp9Cg==
