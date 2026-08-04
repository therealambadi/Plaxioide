var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Disposable } from "../../../../base/common/lifecycle.js";
import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { MAX_CHILDREN_URIs_PAGE, MAX_DIRSTR_CHARS_TOTAL_BEGINNING, MAX_DIRSTR_CHARS_TOTAL_TOOL } from "./prompt/prompts.js";
const MAX_FILES_TOTAL = 1e3;
const START_MAX_DEPTH = 3;
const START_MAX_ITEMS_PER_DIR = 20;
const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_MAX_ITEMS_PER_DIR = 3;
const IDirectoryStrService = createDecorator("voidDirectoryStrService");
const shouldExcludeDirectory = (name) => {
  if (name === ".git" || name === "node_modules" || name.startsWith(".") || name === "dist" || name === "build" || name === "out" || name === "bin" || name === "coverage" || name === "__pycache__" || name === "env" || name === "venv" || name === "tmp" || name === "temp" || name === "artifacts" || name === "target" || name === "obj" || name === "vendor" || name === "logs" || name === "cache" || name === "resource" || name === "resources") {
    return true;
  }
  if (name.match(/\bout\b/)) return true;
  if (name.match(/\bbuild\b/)) return true;
  return false;
};
const computeDirectoryTree1Deep = async (fileService, rootURI, pageNumber = 1) => {
  const stat = await fileService.resolve(rootURI, { resolveMetadata: false });
  if (!stat.isDirectory) {
    return { children: null, hasNextPage: false, hasPrevPage: false, itemsRemaining: 0 };
  }
  const nChildren = stat.children?.length ?? 0;
  const fromChildIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1);
  const toChildIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1;
  const listChildren = stat.children?.slice(fromChildIdx, toChildIdx + 1);
  const children = listChildren?.map((child) => ({
    name: child.name,
    uri: child.resource,
    isDirectory: child.isDirectory,
    isSymbolicLink: child.isSymbolicLink
  })) ?? [];
  const hasNextPage = nChildren - 1 > toChildIdx;
  const hasPrevPage = pageNumber > 1;
  const itemsRemaining = Math.max(0, nChildren - (toChildIdx + 1));
  return {
    children,
    hasNextPage,
    hasPrevPage,
    itemsRemaining
  };
};
const stringifyDirectoryTree1Deep = (params, result) => {
  if (!result.children) {
    return `Error: ${params.uri} is not a directory`;
  }
  let output = "";
  const entries = result.children;
  if (!result.hasPrevPage) {
    output += `${params.uri.fsPath}
`;
  }
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1 && !result.hasNextPage;
    const prefix = isLast ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ";
    output += `${prefix}${entry.name}${entry.isDirectory ? "/" : ""}${entry.isSymbolicLink ? " (symbolic link)" : ""}
`;
  }
  if (result.hasNextPage) {
    output += `\u2514\u2500\u2500 (${result.itemsRemaining} results remaining...)
`;
  }
  return output;
};
const resolveChildren = async (children, fileService) => {
  const res = await fileService.resolveAll(children ?? []);
  const stats = res.map((s) => s.success ? s.stat : null).filter((s) => !!s);
  return stats;
};
const computeAndStringifyDirectoryTree = async (eItem, fileService, MAX_CHARS, fileCount = { count: 0 }, options = {}) => {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const currentDepth = options.currentDepth ?? 0;
  const maxItemsPerDir = options.maxItemsPerDir ?? DEFAULT_MAX_ITEMS_PER_DIR;
  if (currentDepth > maxDepth) {
    return { content: "", wasCutOff: true };
  }
  if (fileCount.count >= MAX_FILES_TOTAL) {
    return { content: "", wasCutOff: true };
  }
  if (MAX_CHARS <= 0) {
    return { content: "", wasCutOff: true };
  }
  fileCount.count++;
  const nodeLine = `${eItem.name}${eItem.isDirectory ? "/" : ""}${eItem.isSymbolicLink ? " (symbolic link)" : ""}
`;
  if (nodeLine.length > MAX_CHARS) {
    return { content: "", wasCutOff: true };
  }
  let content = nodeLine;
  let wasCutOff = false;
  let remainingChars = MAX_CHARS - nodeLine.length;
  const isGitIgnoredDirectory = eItem.isDirectory && shouldExcludeDirectory(eItem.name);
  if (eItem.isDirectory && !isGitIgnoredDirectory) {
    const eChildren = await resolveChildren(eItem.children, fileService);
    if (eChildren && eChildren.length > 0) {
      const { childrenContent, childrenCutOff } = await renderChildrenCombined(
        eChildren,
        remainingChars,
        "",
        fileService,
        fileCount,
        { maxDepth, currentDepth, maxItemsPerDir }
        // Pass maxItemsPerDir to the render function
      );
      content += childrenContent;
      wasCutOff = childrenCutOff;
    }
  }
  return { content, wasCutOff };
};
const renderChildrenCombined = async (children, maxChars, parentPrefix, fileService, fileCount, options) => {
  const { maxDepth, currentDepth } = options;
  const maxItemsPerDir = currentDepth === 0 ? Infinity : options.maxItemsPerDir ?? DEFAULT_MAX_ITEMS_PER_DIR;
  const nextDepth = currentDepth + 1;
  let childrenContent = "";
  let childrenCutOff = false;
  let remainingChars = maxChars;
  if (nextDepth > maxDepth) {
    return { childrenContent: "", childrenCutOff: true };
  }
  const itemsToProcess = maxItemsPerDir === Infinity ? children : children.slice(0, maxItemsPerDir);
  const hasMoreItems = children.length > itemsToProcess.length;
  for (let i = 0; i < itemsToProcess.length; i++) {
    if (fileCount.count >= MAX_FILES_TOTAL) {
      childrenCutOff = true;
      break;
    }
    const child = itemsToProcess[i];
    const isLast = i === itemsToProcess.length - 1 && !hasMoreItems;
    const branchSymbol = isLast ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ";
    const childLine = `${parentPrefix}${branchSymbol}${child.name}${child.isDirectory ? "/" : ""}${child.isSymbolicLink ? " (symbolic link)" : ""}
`;
    if (childLine.length > remainingChars) {
      childrenCutOff = true;
      break;
    }
    childrenContent += childLine;
    remainingChars -= childLine.length;
    fileCount.count++;
    const nextLevelPrefix = parentPrefix + (isLast ? "    " : "\u2502   ");
    const isGitIgnoredDirectory = child.isDirectory && shouldExcludeDirectory(child.name);
    if (child.isDirectory && !isGitIgnoredDirectory) {
      const eChildren = await resolveChildren(child.children, fileService);
      if (eChildren && eChildren.length > 0) {
        const {
          childrenContent: grandChildrenContent,
          childrenCutOff: grandChildrenCutOff
        } = await renderChildrenCombined(
          eChildren,
          remainingChars,
          nextLevelPrefix,
          fileService,
          fileCount,
          { maxDepth, currentDepth: nextDepth, maxItemsPerDir }
        );
        if (grandChildrenContent.length > 0) {
          childrenContent += grandChildrenContent;
          remainingChars -= grandChildrenContent.length;
        }
        if (grandChildrenCutOff) {
          childrenCutOff = true;
        }
      }
    }
  }
  if (hasMoreItems) {
    const remainingCount = children.length - itemsToProcess.length;
    const truncatedLine = `${parentPrefix}\u2514\u2500\u2500 (${remainingCount} more items not shown...)
`;
    if (truncatedLine.length <= remainingChars) {
      childrenContent += truncatedLine;
      remainingChars -= truncatedLine.length;
    }
    childrenCutOff = true;
  }
  return { childrenContent, childrenCutOff };
};
async function getAllUrisInDirectory(directoryUri, maxResults, fileService) {
  const result = [];
  async function visitAll(folderStat) {
    if (result.length >= maxResults) {
      return false;
    }
    try {
      if (!folderStat.isDirectory || !folderStat.children) {
        return true;
      }
      const eChildren = await resolveChildren(folderStat.children, fileService);
      for (const child of eChildren) {
        if (!child.isDirectory) {
          result.push(child.resource);
          if (result.length >= maxResults) {
            return false;
          }
        }
      }
      for (const child of eChildren) {
        const isGitIgnored = shouldExcludeDirectory(child.name);
        if (child.isDirectory && !isGitIgnored) {
          const shouldContinue = await visitAll(child);
          if (!shouldContinue) {
            return false;
          }
        }
      }
      return true;
    } catch (error) {
      console.error(`Error processing directory ${folderStat.resource.fsPath}: ${error}`);
      return true;
    }
  }
  const rootStat = await fileService.resolve(directoryUri);
  await visitAll(rootStat);
  return result;
}
let DirectoryStrService = class extends Disposable {
  constructor(workspaceContextService, fileService) {
    super();
    this.workspaceContextService = workspaceContextService;
    this.fileService = fileService;
  }
  async getAllURIsInDirectory(uri, opts) {
    return getAllUrisInDirectory(uri, opts.maxResults, this.fileService);
  }
  async getDirectoryStrTool(uri) {
    const eRoot = await this.fileService.resolve(uri);
    if (!eRoot) throw new Error(`The folder ${uri.fsPath} does not exist.`);
    const maxItemsPerDir = START_MAX_ITEMS_PER_DIR;
    const { content: initialContent, wasCutOff: initialCutOff } = await computeAndStringifyDirectoryTree(
      eRoot,
      this.fileService,
      MAX_DIRSTR_CHARS_TOTAL_TOOL,
      { count: 0 },
      { maxDepth: START_MAX_DEPTH, currentDepth: 0, maxItemsPerDir }
    );
    let content, wasCutOff;
    if (initialCutOff) {
      const result = await computeAndStringifyDirectoryTree(
        eRoot,
        this.fileService,
        MAX_DIRSTR_CHARS_TOTAL_TOOL,
        { count: 0 },
        { maxDepth: DEFAULT_MAX_DEPTH, currentDepth: 0, maxItemsPerDir: DEFAULT_MAX_ITEMS_PER_DIR }
      );
      content = result.content;
      wasCutOff = result.wasCutOff;
    } else {
      content = initialContent;
      wasCutOff = initialCutOff;
    }
    let c = content.substring(0, MAX_DIRSTR_CHARS_TOTAL_TOOL);
    c = `Directory of ${uri.fsPath}:
${content}`;
    if (wasCutOff) c = `${c}
...Result was truncated...`;
    return c;
  }
  async getAllDirectoriesStr({ cutOffMessage }) {
    // Cache directory string for 30 seconds to avoid expensive re-scans on every message
    const now = Date.now();
    if (this._dirStrCache && this._dirStrCacheKey === cutOffMessage && (now - this._dirStrCacheTime) < 30000) {
      return this._dirStrCache;
    }
    let str = "";
    let cutOff = false;
    const folders = this.workspaceContextService.getWorkspace().folders;
    if (folders.length === 0)
      return "(NO WORKSPACE OPEN)";
    const startMaxItemsPerDir = START_MAX_ITEMS_PER_DIR;
    for (let i = 0; i < folders.length; i += 1) {
      if (i > 0) str += "\n";
      const f = folders[i];
      str += `Directory of ${f.uri.fsPath}:
`;
      const rootURI = f.uri;
      const eRoot = await this.fileService.resolve(rootURI);
      if (!eRoot) continue;
      const { content: initialContent, wasCutOff: initialCutOff } = await computeAndStringifyDirectoryTree(
        eRoot,
        this.fileService,
        MAX_DIRSTR_CHARS_TOTAL_BEGINNING - str.length,
        { count: 0 },
        { maxDepth: START_MAX_DEPTH, currentDepth: 0, maxItemsPerDir: startMaxItemsPerDir }
      );
      let content, wasCutOff;
      if (initialCutOff) {
        const result = await computeAndStringifyDirectoryTree(
          eRoot,
          this.fileService,
          MAX_DIRSTR_CHARS_TOTAL_BEGINNING - str.length,
          { count: 0 },
          { maxDepth: DEFAULT_MAX_DEPTH, currentDepth: 0, maxItemsPerDir: DEFAULT_MAX_ITEMS_PER_DIR }
        );
        content = result.content;
        wasCutOff = result.wasCutOff;
      } else {
        content = initialContent;
        wasCutOff = initialCutOff;
      }
      str += content;
      if (wasCutOff) {
        cutOff = true;
        break;
      }
    }
    const ans = cutOff ? `${str.trimEnd()}
${cutOffMessage}` : str;
    this._dirStrCache = ans;
    this._dirStrCacheKey = cutOffMessage;
    this._dirStrCacheTime = now;
    return ans;
  }
};
DirectoryStrService = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, IFileService)
], DirectoryStrService);
registerSingleton(IDirectoryStrService, DirectoryStrService, InstantiationType.Delayed);
export {
  IDirectoryStrService,
  computeDirectoryTree1Deep,
  getAllUrisInDirectory,
  stringifyDirectoryTree1Deep
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2NvbW1vbi9kaXJlY3RvcnlTdHJTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IDIwMjUgR2xhc3MgRGV2dG9vbHMsIEluYy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wLiBTZWUgTElDRU5TRS50eHQgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJTaW5nbGV0b24sIEluc3RhbnRpYXRpb25UeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSwgSUZpbGVTdGF0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFNoYWxsb3dEaXJlY3RvcnlJdGVtLCBCdWlsdGluVG9vbENhbGxQYXJhbXMsIEJ1aWx0aW5Ub29sUmVzdWx0VHlwZSB9IGZyb20gJy4vdG9vbHNTZXJ2aWNlVHlwZXMuanMnO1xuaW1wb3J0IHsgTUFYX0NISUxEUkVOX1VSSXNfUEFHRSwgTUFYX0RJUlNUUl9DSEFSU19UT1RBTF9CRUdJTk5JTkcsIE1BWF9ESVJTVFJfQ0hBUlNfVE9UQUxfVE9PTCB9IGZyb20gJy4vcHJvbXB0L3Byb21wdHMuanMnO1xuXG5cbmNvbnN0IE1BWF9GSUxFU19UT1RBTCA9IDEwMDA7XG5cblxuY29uc3QgU1RBUlRfTUFYX0RFUFRIID0gSW5maW5pdHk7XG5jb25zdCBTVEFSVF9NQVhfSVRFTVNfUEVSX0RJUiA9IEluZmluaXR5OyAvLyBBZGQgc3RhcnQgdmFsdWUgYXMgSW5maW5pdHlcblxuY29uc3QgREVGQVVMVF9NQVhfREVQVEggPSAzO1xuY29uc3QgREVGQVVMVF9NQVhfSVRFTVNfUEVSX0RJUiA9IDM7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSURpcmVjdG9yeVN0clNlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0Z2V0RGlyZWN0b3J5U3RyVG9vbCh1cmk6IFVSSSk6IFByb21pc2U8c3RyaW5nPlxuXHRnZXRBbGxEaXJlY3Rvcmllc1N0cihvcHRzOiB7IGN1dE9mZk1lc3NhZ2U6IHN0cmluZyB9KTogUHJvbWlzZTxzdHJpbmc+XG5cblx0Z2V0QWxsVVJJc0luRGlyZWN0b3J5KHVyaTogVVJJLCBvcHRzOiB7IG1heFJlc3VsdHM6IG51bWJlciB9KTogUHJvbWlzZTxVUklbXT5cblxufVxuZXhwb3J0IGNvbnN0IElEaXJlY3RvcnlTdHJTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElEaXJlY3RvcnlTdHJTZXJ2aWNlPigndm9pZERpcmVjdG9yeVN0clNlcnZpY2UnKTtcblxuXG5cblxuLy8gQ2hlY2sgaWYgaXQncyBhIGtub3duIGZpbHRlcmVkIHR5cGUgbGlrZSAuZ2l0XG5jb25zdCBzaG91bGRFeGNsdWRlRGlyZWN0b3J5ID0gKG5hbWU6IHN0cmluZykgPT4ge1xuXHRpZiAobmFtZSA9PT0gJy5naXQnIHx8XG5cdFx0bmFtZSA9PT0gJ25vZGVfbW9kdWxlcycgfHxcblx0XHRuYW1lLnN0YXJ0c1dpdGgoJy4nKSB8fFxuXHRcdG5hbWUgPT09ICdkaXN0JyB8fFxuXHRcdG5hbWUgPT09ICdidWlsZCcgfHxcblx0XHRuYW1lID09PSAnb3V0JyB8fFxuXHRcdG5hbWUgPT09ICdiaW4nIHx8XG5cdFx0bmFtZSA9PT0gJ2NvdmVyYWdlJyB8fFxuXHRcdG5hbWUgPT09ICdfX3B5Y2FjaGVfXycgfHxcblx0XHRuYW1lID09PSAnZW52JyB8fFxuXHRcdG5hbWUgPT09ICd2ZW52JyB8fFxuXHRcdG5hbWUgPT09ICd0bXAnIHx8XG5cdFx0bmFtZSA9PT0gJ3RlbXAnIHx8XG5cdFx0bmFtZSA9PT0gJ2FydGlmYWN0cycgfHxcblx0XHRuYW1lID09PSAndGFyZ2V0JyB8fFxuXHRcdG5hbWUgPT09ICdvYmonIHx8XG5cdFx0bmFtZSA9PT0gJ3ZlbmRvcicgfHxcblx0XHRuYW1lID09PSAnbG9ncycgfHxcblx0XHRuYW1lID09PSAnY2FjaGUnIHx8XG5cdFx0bmFtZSA9PT0gJ3Jlc291cmNlJyB8fFxuXHRcdG5hbWUgPT09ICdyZXNvdXJjZXMnXG5cblx0KSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRpZiAobmFtZS5tYXRjaCgvXFxib3V0XFxiLykpIHJldHVybiB0cnVlXG5cdGlmIChuYW1lLm1hdGNoKC9cXGJidWlsZFxcYi8pKSByZXR1cm4gdHJ1ZVxuXG5cdHJldHVybiBmYWxzZTtcbn1cblxuLy8gLS0tLS0tLS0tLSBPTkUgTEFZRVIgREVFUCAtLS0tLS0tLS0tXG5cbmV4cG9ydCBjb25zdCBjb21wdXRlRGlyZWN0b3J5VHJlZTFEZWVwID0gYXN5bmMgKFxuXHRmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRyb290VVJJOiBVUkksXG5cdHBhZ2VOdW1iZXI6IG51bWJlciA9IDEsXG4pOiBQcm9taXNlPEJ1aWx0aW5Ub29sUmVzdWx0VHlwZVsnbHNfZGlyJ10+ID0+IHtcblx0Y29uc3Qgc3RhdCA9IGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUocm9vdFVSSSwgeyByZXNvbHZlTWV0YWRhdGE6IGZhbHNlIH0pO1xuXHRpZiAoIXN0YXQuaXNEaXJlY3RvcnkpIHtcblx0XHRyZXR1cm4geyBjaGlsZHJlbjogbnVsbCwgaGFzTmV4dFBhZ2U6IGZhbHNlLCBoYXNQcmV2UGFnZTogZmFsc2UsIGl0ZW1zUmVtYWluaW5nOiAwIH07XG5cdH1cblxuXHRjb25zdCBuQ2hpbGRyZW4gPSBzdGF0LmNoaWxkcmVuPy5sZW5ndGggPz8gMDtcblxuXHRjb25zdCBmcm9tQ2hpbGRJZHggPSBNQVhfQ0hJTERSRU5fVVJJc19QQUdFICogKHBhZ2VOdW1iZXIgLSAxKTtcblx0Y29uc3QgdG9DaGlsZElkeCA9IE1BWF9DSElMRFJFTl9VUklzX1BBR0UgKiBwYWdlTnVtYmVyIC0gMTsgLy8gSU5DTFVTSVZFXG5cdGNvbnN0IGxpc3RDaGlsZHJlbiA9IHN0YXQuY2hpbGRyZW4/LnNsaWNlKGZyb21DaGlsZElkeCwgdG9DaGlsZElkeCArIDEpO1xuXG5cdGNvbnN0IGNoaWxkcmVuOiBTaGFsbG93RGlyZWN0b3J5SXRlbVtdID0gbGlzdENoaWxkcmVuPy5tYXAoY2hpbGQgPT4gKHtcblx0XHRuYW1lOiBjaGlsZC5uYW1lLFxuXHRcdHVyaTogY2hpbGQucmVzb3VyY2UsXG5cdFx0aXNEaXJlY3Rvcnk6IGNoaWxkLmlzRGlyZWN0b3J5LFxuXHRcdGlzU3ltYm9saWNMaW5rOiBjaGlsZC5pc1N5bWJvbGljTGlua1xuXHR9KSkgPz8gW107XG5cblx0Y29uc3QgaGFzTmV4dFBhZ2UgPSAobkNoaWxkcmVuIC0gMSkgPiB0b0NoaWxkSWR4O1xuXHRjb25zdCBoYXNQcmV2UGFnZSA9IHBhZ2VOdW1iZXIgPiAxO1xuXHRjb25zdCBpdGVtc1JlbWFpbmluZyA9IE1hdGgubWF4KDAsIG5DaGlsZHJlbiAtICh0b0NoaWxkSWR4ICsgMSkpO1xuXG5cdHJldHVybiB7XG5cdFx0Y2hpbGRyZW4sXG5cdFx0aGFzTmV4dFBhZ2UsXG5cdFx0aGFzUHJldlBhZ2UsXG5cdFx0aXRlbXNSZW1haW5pbmdcblx0fTtcbn07XG5cbmV4cG9ydCBjb25zdCBzdHJpbmdpZnlEaXJlY3RvcnlUcmVlMURlZXAgPSAocGFyYW1zOiBCdWlsdGluVG9vbENhbGxQYXJhbXNbJ2xzX2RpciddLCByZXN1bHQ6IEJ1aWx0aW5Ub29sUmVzdWx0VHlwZVsnbHNfZGlyJ10pOiBzdHJpbmcgPT4ge1xuXHRpZiAoIXJlc3VsdC5jaGlsZHJlbikge1xuXHRcdHJldHVybiBgRXJyb3I6ICR7cGFyYW1zLnVyaX0gaXMgbm90IGEgZGlyZWN0b3J5YDtcblx0fVxuXG5cdGxldCBvdXRwdXQgPSAnJztcblx0Y29uc3QgZW50cmllcyA9IHJlc3VsdC5jaGlsZHJlbjtcblxuXHRpZiAoIXJlc3VsdC5oYXNQcmV2UGFnZSkgeyAvLyBpcyBmaXJzdCBwYWdlXG5cdFx0b3V0cHV0ICs9IGAke3BhcmFtcy51cmkuZnNQYXRofVxcbmA7XG5cdH1cblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGVudHJpZXMubGVuZ3RoOyBpKyspIHtcblx0XHRjb25zdCBlbnRyeSA9IGVudHJpZXNbaV07XG5cdFx0Y29uc3QgaXNMYXN0ID0gaSA9PT0gZW50cmllcy5sZW5ndGggLSAxICYmICFyZXN1bHQuaGFzTmV4dFBhZ2U7XG5cdFx0Y29uc3QgcHJlZml4ID0gaXNMYXN0ID8gJ1x1MjUxNFx1MjUwMFx1MjUwMCAnIDogJ1x1MjUxQ1x1MjUwMFx1MjUwMCAnO1xuXG5cdFx0b3V0cHV0ICs9IGAke3ByZWZpeH0ke2VudHJ5Lm5hbWV9JHtlbnRyeS5pc0RpcmVjdG9yeSA/ICcvJyA6ICcnfSR7ZW50cnkuaXNTeW1ib2xpY0xpbmsgPyAnIChzeW1ib2xpYyBsaW5rKScgOiAnJ31cXG5gO1xuXHR9XG5cblx0aWYgKHJlc3VsdC5oYXNOZXh0UGFnZSkge1xuXHRcdG91dHB1dCArPSBgXHUyNTE0XHUyNTAwXHUyNTAwICgke3Jlc3VsdC5pdGVtc1JlbWFpbmluZ30gcmVzdWx0cyByZW1haW5pbmcuLi4pXFxuYDtcblx0fVxuXG5cdHJldHVybiBvdXRwdXQ7XG59O1xuXG5cbi8vIC0tLS0tLS0tLS0gSU4gR0VORVJBTCAtLS0tLS0tLS0tXG5cbmNvbnN0IHJlc29sdmVDaGlsZHJlbiA9IGFzeW5jIChjaGlsZHJlbjogdW5kZWZpbmVkIHwgSUZpbGVTdGF0W10sIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UpOiBQcm9taXNlPElGaWxlU3RhdFtdPiA9PiB7XG5cdGNvbnN0IHJlcyA9IGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmVBbGwoY2hpbGRyZW4gPz8gW10pXG5cdGNvbnN0IHN0YXRzID0gcmVzLm1hcChzID0+IHMuc3VjY2VzcyA/IHMuc3RhdCA6IG51bGwpLmZpbHRlcihzID0+ICEhcylcblx0cmV0dXJuIHN0YXRzXG59XG5cbi8vIFJlbW92ZSB0aGUgb2xkIGNvbXB1dGVEaXJlY3RvcnlUcmVlIGZ1bmN0aW9uIGFuZCByZXBsYWNlIHdpdGggYSBjb21iaW5lZCB2ZXJzaW9uIHRoYXQgaGFuZGxlcyBib3RoIGNvbXB1dGF0aW9uIGFuZCByZW5kZXJpbmdcbmNvbnN0IGNvbXB1dGVBbmRTdHJpbmdpZnlEaXJlY3RvcnlUcmVlID0gYXN5bmMgKFxuXHRlSXRlbTogSUZpbGVTdGF0LFxuXHRmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRNQVhfQ0hBUlM6IG51bWJlcixcblx0ZmlsZUNvdW50OiB7IGNvdW50OiBudW1iZXIgfSA9IHsgY291bnQ6IDAgfSxcblx0b3B0aW9uczogeyBtYXhEZXB0aD86IG51bWJlciwgY3VycmVudERlcHRoPzogbnVtYmVyLCBtYXhJdGVtc1BlckRpcj86IG51bWJlciB9ID0ge31cbik6IFByb21pc2U8eyBjb250ZW50OiBzdHJpbmcsIHdhc0N1dE9mZjogYm9vbGVhbiB9PiA9PiB7XG5cdC8vIFNldCBkZWZhdWx0IHZhbHVlcyBmb3Igb3B0aW9uc1xuXHRjb25zdCBtYXhEZXB0aCA9IG9wdGlvbnMubWF4RGVwdGggPz8gREVGQVVMVF9NQVhfREVQVEg7XG5cdGNvbnN0IGN1cnJlbnREZXB0aCA9IG9wdGlvbnMuY3VycmVudERlcHRoID8/IDA7XG5cdGNvbnN0IG1heEl0ZW1zUGVyRGlyID0gb3B0aW9ucy5tYXhJdGVtc1BlckRpciA/PyBERUZBVUxUX01BWF9JVEVNU19QRVJfRElSO1xuXG5cdC8vIENoZWNrIGlmIHdlJ3ZlIHJlYWNoZWQgdGhlIG1heCBkZXB0aFxuXHRpZiAoY3VycmVudERlcHRoID4gbWF4RGVwdGgpIHtcblx0XHRyZXR1cm4geyBjb250ZW50OiAnJywgd2FzQ3V0T2ZmOiB0cnVlIH07XG5cdH1cblxuXHQvLyBDaGVjayBpZiB3ZSd2ZSByZWFjaGVkIHRoZSBmaWxlIGxpbWl0XG5cdGlmIChmaWxlQ291bnQuY291bnQgPj0gTUFYX0ZJTEVTX1RPVEFMKSB7XG5cdFx0cmV0dXJuIHsgY29udGVudDogJycsIHdhc0N1dE9mZjogdHJ1ZSB9O1xuXHR9XG5cblx0Ly8gSWYgd2UncmUgYWxyZWFkeSBleGNlZWRpbmcgdGhlIG1heCBjaGFyYWN0ZXJzLCByZXR1cm4gaW1tZWRpYXRlbHlcblx0aWYgKE1BWF9DSEFSUyA8PSAwKSB7XG5cdFx0cmV0dXJuIHsgY29udGVudDogJycsIHdhc0N1dE9mZjogdHJ1ZSB9O1xuXHR9XG5cblx0Ly8gSW5jcmVtZW50IGZpbGUgY291bnRcblx0ZmlsZUNvdW50LmNvdW50Kys7XG5cblx0Ly8gQWRkIHRoZSByb290IG5vZGUgZmlyc3QgKHdpdGhvdXQgdHJlZSBjaGFyYWN0ZXJzKVxuXHRjb25zdCBub2RlTGluZSA9IGAke2VJdGVtLm5hbWV9JHtlSXRlbS5pc0RpcmVjdG9yeSA/ICcvJyA6ICcnfSR7ZUl0ZW0uaXNTeW1ib2xpY0xpbmsgPyAnIChzeW1ib2xpYyBsaW5rKScgOiAnJ31cXG5gO1xuXG5cdGlmIChub2RlTGluZS5sZW5ndGggPiBNQVhfQ0hBUlMpIHtcblx0XHRyZXR1cm4geyBjb250ZW50OiAnJywgd2FzQ3V0T2ZmOiB0cnVlIH07XG5cdH1cblxuXHRsZXQgY29udGVudCA9IG5vZGVMaW5lO1xuXHRsZXQgd2FzQ3V0T2ZmID0gZmFsc2U7XG5cdGxldCByZW1haW5pbmdDaGFycyA9IE1BWF9DSEFSUyAtIG5vZGVMaW5lLmxlbmd0aDtcblxuXHQvLyBDaGVjayBpZiBpdCdzIGEgZGlyZWN0b3J5IHdlIHNob3VsZCBza2lwXG5cdGNvbnN0IGlzR2l0SWdub3JlZERpcmVjdG9yeSA9IGVJdGVtLmlzRGlyZWN0b3J5ICYmIHNob3VsZEV4Y2x1ZGVEaXJlY3RvcnkoZUl0ZW0ubmFtZSk7XG5cblxuXHQvLyBGZXRjaCBhbmQgcHJvY2VzcyBjaGlsZHJlbiBpZiBub3QgYSBmaWx0ZXJlZCBkaXJlY3Rvcnlcblx0aWYgKGVJdGVtLmlzRGlyZWN0b3J5ICYmICFpc0dpdElnbm9yZWREaXJlY3RvcnkpIHtcblx0XHQvLyBGZXRjaCBjaGlsZHJlbiB3aXRoIE1vZGlmaWVkIHNvcnQgb3JkZXIgdG8gc2hvdyByZWNlbnRseSBtb2RpZmllZCBmaXJzdFxuXHRcdGNvbnN0IGVDaGlsZHJlbiA9IGF3YWl0IHJlc29sdmVDaGlsZHJlbihlSXRlbS5jaGlsZHJlbiwgZmlsZVNlcnZpY2UpXG5cblx0XHQvLyBUaGVuIHJlY3Vyc2l2ZWx5IGFkZCBhbGwgY2hpbGRyZW4gd2l0aCBwcm9wZXIgdHJlZSBmb3JtYXR0aW5nXG5cdFx0aWYgKGVDaGlsZHJlbiAmJiBlQ2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3QgeyBjaGlsZHJlbkNvbnRlbnQsIGNoaWxkcmVuQ3V0T2ZmIH0gPSBhd2FpdCByZW5kZXJDaGlsZHJlbkNvbWJpbmVkKFxuXHRcdFx0XHRlQ2hpbGRyZW4sXG5cdFx0XHRcdHJlbWFpbmluZ0NoYXJzLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0ZmlsZVNlcnZpY2UsXG5cdFx0XHRcdGZpbGVDb3VudCxcblx0XHRcdFx0eyBtYXhEZXB0aCwgY3VycmVudERlcHRoLCBtYXhJdGVtc1BlckRpciB9IC8vIFBhc3MgbWF4SXRlbXNQZXJEaXIgdG8gdGhlIHJlbmRlciBmdW5jdGlvblxuXHRcdFx0KTtcblx0XHRcdGNvbnRlbnQgKz0gY2hpbGRyZW5Db250ZW50O1xuXHRcdFx0d2FzQ3V0T2ZmID0gY2hpbGRyZW5DdXRPZmY7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHsgY29udGVudCwgd2FzQ3V0T2ZmIH07XG59O1xuXG4vLyBIZWxwZXIgZnVuY3Rpb24gdG8gcmVuZGVyIGNoaWxkcmVuIHdpdGggcHJvcGVyIHRyZWUgZm9ybWF0dGluZ1xuY29uc3QgcmVuZGVyQ2hpbGRyZW5Db21iaW5lZCA9IGFzeW5jIChcblx0Y2hpbGRyZW46IElGaWxlU3RhdFtdLFxuXHRtYXhDaGFyczogbnVtYmVyLFxuXHRwYXJlbnRQcmVmaXg6IHN0cmluZyxcblx0ZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0ZmlsZUNvdW50OiB7IGNvdW50OiBudW1iZXIgfSxcblx0b3B0aW9uczogeyBtYXhEZXB0aDogbnVtYmVyLCBjdXJyZW50RGVwdGg6IG51bWJlciwgbWF4SXRlbXNQZXJEaXI/OiBudW1iZXIgfVxuKTogUHJvbWlzZTx7IGNoaWxkcmVuQ29udGVudDogc3RyaW5nLCBjaGlsZHJlbkN1dE9mZjogYm9vbGVhbiB9PiA9PiB7XG5cdGNvbnN0IHsgbWF4RGVwdGgsIGN1cnJlbnREZXB0aCB9ID0gb3B0aW9uczsgLy8gUmVtb3ZlIG1heEl0ZW1zUGVyRGlyIGZyb20gZGVzdHJ1Y3R1cmluZ1xuXHQvLyBHZXQgbWF4SXRlbXNQZXJEaXIgc2VwYXJhdGVseSBhbmQgbWFrZSBzdXJlIHdlIHVzZSBpdFxuXHQvLyBGb3IgZmlyc3QgbGV2ZWwgKGN1cnJlbnREZXB0aCA9IDApLCBhbHdheXMgdXNlIEluZmluaXR5IHJlZ2FyZGxlc3Mgb2Ygd2hhdCB3YXMgcGFzc2VkXG5cdGNvbnN0IG1heEl0ZW1zUGVyRGlyID0gY3VycmVudERlcHRoID09PSAwID9cblx0XHRJbmZpbml0eSA6XG5cdFx0KG9wdGlvbnMubWF4SXRlbXNQZXJEaXIgPz8gREVGQVVMVF9NQVhfSVRFTVNfUEVSX0RJUik7XG5cdGNvbnN0IG5leHREZXB0aCA9IGN1cnJlbnREZXB0aCArIDE7XG5cblx0bGV0IGNoaWxkcmVuQ29udGVudCA9ICcnO1xuXHRsZXQgY2hpbGRyZW5DdXRPZmYgPSBmYWxzZTtcblx0bGV0IHJlbWFpbmluZ0NoYXJzID0gbWF4Q2hhcnM7XG5cblx0Ly8gQ2hlY2sgaWYgd2UndmUgcmVhY2hlZCBtYXggZGVwdGhcblx0aWYgKG5leHREZXB0aCA+IG1heERlcHRoKSB7XG5cdFx0cmV0dXJuIHsgY2hpbGRyZW5Db250ZW50OiAnJywgY2hpbGRyZW5DdXRPZmY6IHRydWUgfTtcblx0fVxuXG5cdC8vIEFwcGx5IG1heEl0ZW1zUGVyRGlyIGxpbWl0IC0gb25seSBwcm9jZXNzIHRoZSBzcGVjaWZpZWQgbnVtYmVyIG9mIGl0ZW1zXG5cdGNvbnN0IGl0ZW1zVG9Qcm9jZXNzID0gbWF4SXRlbXNQZXJEaXIgPT09IEluZmluaXR5ID8gY2hpbGRyZW4gOiBjaGlsZHJlbi5zbGljZSgwLCBtYXhJdGVtc1BlckRpcik7XG5cdGNvbnN0IGhhc01vcmVJdGVtcyA9IGNoaWxkcmVuLmxlbmd0aCA+IGl0ZW1zVG9Qcm9jZXNzLmxlbmd0aDtcblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGl0ZW1zVG9Qcm9jZXNzLmxlbmd0aDsgaSsrKSB7XG5cdFx0Ly8gQ2hlY2sgaWYgd2UndmUgcmVhY2hlZCB0aGUgZmlsZSBsaW1pdFxuXHRcdGlmIChmaWxlQ291bnQuY291bnQgPj0gTUFYX0ZJTEVTX1RPVEFMKSB7XG5cdFx0XHRjaGlsZHJlbkN1dE9mZiA9IHRydWU7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRjb25zdCBjaGlsZCA9IGl0ZW1zVG9Qcm9jZXNzW2ldO1xuXHRcdGNvbnN0IGlzTGFzdCA9IChpID09PSBpdGVtc1RvUHJvY2Vzcy5sZW5ndGggLSAxKSAmJiAhaGFzTW9yZUl0ZW1zO1xuXG5cdFx0Ly8gQ3JlYXRlIHRoZSB0cmVlIGJyYW5jaCBzeW1ib2xzXG5cdFx0Y29uc3QgYnJhbmNoU3ltYm9sID0gaXNMYXN0ID8gJ1x1MjUxNFx1MjUwMFx1MjUwMCAnIDogJ1x1MjUxQ1x1MjUwMFx1MjUwMCAnO1xuXHRcdGNvbnN0IGNoaWxkTGluZSA9IGAke3BhcmVudFByZWZpeH0ke2JyYW5jaFN5bWJvbH0ke2NoaWxkLm5hbWV9JHtjaGlsZC5pc0RpcmVjdG9yeSA/ICcvJyA6ICcnfSR7Y2hpbGQuaXNTeW1ib2xpY0xpbmsgPyAnIChzeW1ib2xpYyBsaW5rKScgOiAnJ31cXG5gO1xuXG5cdFx0Ly8gQ2hlY2sgaWYgYWRkaW5nIHRoaXMgbGluZSB3b3VsZCBleGNlZWQgdGhlIGxpbWl0XG5cdFx0aWYgKGNoaWxkTGluZS5sZW5ndGggPiByZW1haW5pbmdDaGFycykge1xuXHRcdFx0Y2hpbGRyZW5DdXRPZmYgPSB0cnVlO1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0Y2hpbGRyZW5Db250ZW50ICs9IGNoaWxkTGluZTtcblx0XHRyZW1haW5pbmdDaGFycyAtPSBjaGlsZExpbmUubGVuZ3RoO1xuXHRcdGZpbGVDb3VudC5jb3VudCsrO1xuXG5cdFx0Y29uc3QgbmV4dExldmVsUHJlZml4ID0gcGFyZW50UHJlZml4ICsgKGlzTGFzdCA/ICcgICAgJyA6ICdcdTI1MDIgICAnKTtcblxuXHRcdC8vIFNraXAgcHJvY2Vzc2luZyBjaGlsZHJlbiBmb3IgZ2l0IGlnbm9yZWQgZGlyZWN0b3JpZXNcblx0XHRjb25zdCBpc0dpdElnbm9yZWREaXJlY3RvcnkgPSBjaGlsZC5pc0RpcmVjdG9yeSAmJiBzaG91bGRFeGNsdWRlRGlyZWN0b3J5KGNoaWxkLm5hbWUpO1xuXG5cdFx0Ly8gQ3JlYXRlIHRoZSBwcmVmaXggZm9yIHRoZSBuZXh0IGxldmVsIChjb250aW51YXRpb24gbGluZSBvciBzcGFjZSlcblx0XHRpZiAoY2hpbGQuaXNEaXJlY3RvcnkgJiYgIWlzR2l0SWdub3JlZERpcmVjdG9yeSkge1xuXHRcdFx0Ly8gRmV0Y2ggY2hpbGRyZW4gd2l0aCBNb2RpZmllZCBzb3J0IG9yZGVyIHRvIHNob3cgcmVjZW50bHkgbW9kaWZpZWQgZmlyc3Rcblx0XHRcdGNvbnN0IGVDaGlsZHJlbiA9IGF3YWl0IHJlc29sdmVDaGlsZHJlbihjaGlsZC5jaGlsZHJlbiwgZmlsZVNlcnZpY2UpXG5cblx0XHRcdGlmIChlQ2hpbGRyZW4gJiYgZUNoaWxkcmVuLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Y29uc3Qge1xuXHRcdFx0XHRcdGNoaWxkcmVuQ29udGVudDogZ3JhbmRDaGlsZHJlbkNvbnRlbnQsXG5cdFx0XHRcdFx0Y2hpbGRyZW5DdXRPZmY6IGdyYW5kQ2hpbGRyZW5DdXRPZmZcblx0XHRcdFx0fSA9IGF3YWl0IHJlbmRlckNoaWxkcmVuQ29tYmluZWQoXG5cdFx0XHRcdFx0ZUNoaWxkcmVuLFxuXHRcdFx0XHRcdHJlbWFpbmluZ0NoYXJzLFxuXHRcdFx0XHRcdG5leHRMZXZlbFByZWZpeCxcblx0XHRcdFx0XHRmaWxlU2VydmljZSxcblx0XHRcdFx0XHRmaWxlQ291bnQsXG5cdFx0XHRcdFx0eyBtYXhEZXB0aCwgY3VycmVudERlcHRoOiBuZXh0RGVwdGgsIG1heEl0ZW1zUGVyRGlyIH1cblx0XHRcdFx0KTtcblxuXHRcdFx0XHRpZiAoZ3JhbmRDaGlsZHJlbkNvbnRlbnQubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdGNoaWxkcmVuQ29udGVudCArPSBncmFuZENoaWxkcmVuQ29udGVudDtcblx0XHRcdFx0XHRyZW1haW5pbmdDaGFycyAtPSBncmFuZENoaWxkcmVuQ29udGVudC5sZW5ndGg7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoZ3JhbmRDaGlsZHJlbkN1dE9mZikge1xuXHRcdFx0XHRcdGNoaWxkcmVuQ3V0T2ZmID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIEFkZCBhIG1lc3NhZ2UgaWYgd2UgdHJ1bmNhdGVkIHRoZSBpdGVtcyBkdWUgdG8gbWF4SXRlbXNQZXJEaXJcblx0aWYgKGhhc01vcmVJdGVtcykge1xuXHRcdGNvbnN0IHJlbWFpbmluZ0NvdW50ID0gY2hpbGRyZW4ubGVuZ3RoIC0gaXRlbXNUb1Byb2Nlc3MubGVuZ3RoO1xuXHRcdGNvbnN0IHRydW5jYXRlZExpbmUgPSBgJHtwYXJlbnRQcmVmaXh9XHUyNTE0XHUyNTAwXHUyNTAwICgke3JlbWFpbmluZ0NvdW50fSBtb3JlIGl0ZW1zIG5vdCBzaG93bi4uLilcXG5gO1xuXG5cdFx0aWYgKHRydW5jYXRlZExpbmUubGVuZ3RoIDw9IHJlbWFpbmluZ0NoYXJzKSB7XG5cdFx0XHRjaGlsZHJlbkNvbnRlbnQgKz0gdHJ1bmNhdGVkTGluZTtcblx0XHRcdHJlbWFpbmluZ0NoYXJzIC09IHRydW5jYXRlZExpbmUubGVuZ3RoO1xuXHRcdH1cblx0XHRjaGlsZHJlbkN1dE9mZiA9IHRydWU7XG5cdH1cblxuXHRyZXR1cm4geyBjaGlsZHJlbkNvbnRlbnQsIGNoaWxkcmVuQ3V0T2ZmIH07XG59O1xuXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gRk9MREVSUyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRBbGxVcmlzSW5EaXJlY3RvcnkoXG5cdGRpcmVjdG9yeVVyaTogVVJJLFxuXHRtYXhSZXN1bHRzOiBudW1iZXIsXG5cdGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG4pOiBQcm9taXNlPFVSSVtdPiB7XG5cdGNvbnN0IHJlc3VsdDogVVJJW10gPSBbXTtcblxuXHQvLyBIZWxwZXIgZnVuY3Rpb24gdG8gcmVjdXJzaXZlbHkgY29sbGVjdCBVUklzXG5cdGFzeW5jIGZ1bmN0aW9uIHZpc2l0QWxsKGZvbGRlclN0YXQ6IElGaWxlU3RhdCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdC8vIFN0b3AgaWYgd2UndmUgcmVhY2hlZCB0aGUgbGltaXRcblx0XHRpZiAocmVzdWx0Lmxlbmd0aCA+PSBtYXhSZXN1bHRzKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblxuXHRcdFx0aWYgKCFmb2xkZXJTdGF0LmlzRGlyZWN0b3J5IHx8ICFmb2xkZXJTdGF0LmNoaWxkcmVuKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBlQ2hpbGRyZW4gPSBhd2FpdCByZXNvbHZlQ2hpbGRyZW4oZm9sZGVyU3RhdC5jaGlsZHJlbiwgZmlsZVNlcnZpY2UpXG5cblx0XHRcdC8vIFByb2Nlc3MgZmlsZXMgZmlyc3QgKGNvbW1vbiBjb252ZW50aW9uIHRvIGxpc3QgZmlsZXMgYmVmb3JlIGRpcmVjdG9yaWVzKVxuXHRcdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBlQ2hpbGRyZW4pIHtcblx0XHRcdFx0aWYgKCFjaGlsZC5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKGNoaWxkLnJlc291cmNlKTtcblxuXHRcdFx0XHRcdC8vIENoZWNrIGlmIHdlJ3ZlIGhpdCB0aGUgbGltaXRcblx0XHRcdFx0XHRpZiAocmVzdWx0Lmxlbmd0aCA+PSBtYXhSZXN1bHRzKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRoZW4gcHJvY2VzcyBkaXJlY3RvcmllcyByZWN1cnNpdmVseVxuXHRcdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBlQ2hpbGRyZW4pIHtcblx0XHRcdFx0Y29uc3QgaXNHaXRJZ25vcmVkID0gc2hvdWxkRXhjbHVkZURpcmVjdG9yeShjaGlsZC5uYW1lKVxuXHRcdFx0XHRpZiAoY2hpbGQuaXNEaXJlY3RvcnkgJiYgIWlzR2l0SWdub3JlZCkge1xuXHRcdFx0XHRcdGNvbnN0IHNob3VsZENvbnRpbnVlID0gYXdhaXQgdmlzaXRBbGwoY2hpbGQpO1xuXHRcdFx0XHRcdGlmICghc2hvdWxkQ29udGludWUpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoYEVycm9yIHByb2Nlc3NpbmcgZGlyZWN0b3J5ICR7Zm9sZGVyU3RhdC5yZXNvdXJjZS5mc1BhdGh9OiAke2Vycm9yfWApO1xuXHRcdFx0cmV0dXJuIHRydWU7IC8vIENvbnRpbnVlIGRlc3BpdGUgZXJyb3JzIGluIGEgc3BlY2lmaWMgZGlyZWN0b3J5XG5cdFx0fVxuXHR9XG5cblx0Y29uc3Qgcm9vdFN0YXQgPSBhd2FpdCBmaWxlU2VydmljZS5yZXNvbHZlKGRpcmVjdG9yeVVyaSlcblx0YXdhaXQgdmlzaXRBbGwocm9vdFN0YXQpO1xuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuXG5jbGFzcyBEaXJlY3RvcnlTdHJTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElEaXJlY3RvcnlTdHJTZXJ2aWNlIHtcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0YXN5bmMgZ2V0QWxsVVJJc0luRGlyZWN0b3J5KHVyaTogVVJJLCBvcHRzOiB7IG1heFJlc3VsdHM6IG51bWJlciB9KTogUHJvbWlzZTxVUklbXT4ge1xuXHRcdHJldHVybiBnZXRBbGxVcmlzSW5EaXJlY3RvcnkodXJpLCBvcHRzLm1heFJlc3VsdHMsIHRoaXMuZmlsZVNlcnZpY2UpXG5cdH1cblxuXHRhc3luYyBnZXREaXJlY3RvcnlTdHJUb29sKHVyaTogVVJJKSB7XG5cdFx0Y29uc3QgZVJvb3QgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlc29sdmUodXJpKVxuXHRcdGlmICghZVJvb3QpIHRocm93IG5ldyBFcnJvcihgVGhlIGZvbGRlciAke3VyaS5mc1BhdGh9IGRvZXMgbm90IGV4aXN0LmApXG5cblx0XHRjb25zdCBtYXhJdGVtc1BlckRpciA9IFNUQVJUX01BWF9JVEVNU19QRVJfRElSOyAvLyBVc2UgU1RBUlRfTUFYX0lURU1TX1BFUl9ESVJcblxuXHRcdC8vIEZpcnN0IHRyeSB3aXRoIFNUQVJUX01BWF9ERVBUSFxuXHRcdGNvbnN0IHsgY29udGVudDogaW5pdGlhbENvbnRlbnQsIHdhc0N1dE9mZjogaW5pdGlhbEN1dE9mZiB9ID0gYXdhaXQgY29tcHV0ZUFuZFN0cmluZ2lmeURpcmVjdG9yeVRyZWUoXG5cdFx0XHRlUm9vdCxcblx0XHRcdHRoaXMuZmlsZVNlcnZpY2UsXG5cdFx0XHRNQVhfRElSU1RSX0NIQVJTX1RPVEFMX1RPT0wsXG5cdFx0XHR7IGNvdW50OiAwIH0sXG5cdFx0XHR7IG1heERlcHRoOiBTVEFSVF9NQVhfREVQVEgsIGN1cnJlbnREZXB0aDogMCwgbWF4SXRlbXNQZXJEaXIgfVxuXHRcdCk7XG5cblx0XHQvLyBJZiBjdXQgb2ZmLCB0cnkgYWdhaW4gd2l0aCBERUZBVUxUX01BWF9ERVBUSCBhbmQgREVGQVVMVF9NQVhfSVRFTVNfUEVSX0RJUlxuXHRcdGxldCBjb250ZW50LCB3YXNDdXRPZmY7XG5cdFx0aWYgKGluaXRpYWxDdXRPZmYpIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNvbXB1dGVBbmRTdHJpbmdpZnlEaXJlY3RvcnlUcmVlKFxuXHRcdFx0XHRlUm9vdCxcblx0XHRcdFx0dGhpcy5maWxlU2VydmljZSxcblx0XHRcdFx0TUFYX0RJUlNUUl9DSEFSU19UT1RBTF9UT09MLFxuXHRcdFx0XHR7IGNvdW50OiAwIH0sXG5cdFx0XHRcdHsgbWF4RGVwdGg6IERFRkFVTFRfTUFYX0RFUFRILCBjdXJyZW50RGVwdGg6IDAsIG1heEl0ZW1zUGVyRGlyOiBERUZBVUxUX01BWF9JVEVNU19QRVJfRElSIH1cblx0XHRcdCk7XG5cdFx0XHRjb250ZW50ID0gcmVzdWx0LmNvbnRlbnQ7XG5cdFx0XHR3YXNDdXRPZmYgPSByZXN1bHQud2FzQ3V0T2ZmO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb250ZW50ID0gaW5pdGlhbENvbnRlbnQ7XG5cdFx0XHR3YXNDdXRPZmYgPSBpbml0aWFsQ3V0T2ZmO1xuXHRcdH1cblxuXHRcdGxldCBjID0gY29udGVudC5zdWJzdHJpbmcoMCwgTUFYX0RJUlNUUl9DSEFSU19UT1RBTF9UT09MKVxuXHRcdGMgPSBgRGlyZWN0b3J5IG9mICR7dXJpLmZzUGF0aH06XFxuJHtjb250ZW50fWBcblx0XHRpZiAod2FzQ3V0T2ZmKSBjID0gYCR7Y31cXG4uLi5SZXN1bHQgd2FzIHRydW5jYXRlZC4uLmBcblxuXHRcdHJldHVybiBjXG5cdH1cblxuXHRhc3luYyBnZXRBbGxEaXJlY3Rvcmllc1N0cih7IGN1dE9mZk1lc3NhZ2UsIH06IHsgY3V0T2ZmTWVzc2FnZTogc3RyaW5nLCB9KSB7XG5cdFx0bGV0IHN0cjogc3RyaW5nID0gJyc7XG5cdFx0bGV0IGN1dE9mZiA9IGZhbHNlO1xuXHRcdGNvbnN0IGZvbGRlcnMgPSB0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnM7XG5cdFx0aWYgKGZvbGRlcnMubGVuZ3RoID09PSAwKVxuXHRcdFx0cmV0dXJuICcoTk8gV09SS1NQQUNFIE9QRU4pJztcblxuXHRcdC8vIFVzZSBTVEFSVF9NQVhfSVRFTVNfUEVSX0RJUiBpZiBub3Qgc3BlY2lmaWVkXG5cdFx0Y29uc3Qgc3RhcnRNYXhJdGVtc1BlckRpciA9IFNUQVJUX01BWF9JVEVNU19QRVJfRElSO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBmb2xkZXJzLmxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRpZiAoaSA+IDApIHN0ciArPSAnXFxuJztcblxuXHRcdFx0Ly8gdGhpcyBwcmlvcml0aXplcyBmaWxsaW5nIDFzdCB3b3Jrc3BhY2UgYmVmb3JlIGFueSBvdGhlciwgZXRjXG5cdFx0XHRjb25zdCBmID0gZm9sZGVyc1tpXTtcblx0XHRcdHN0ciArPSBgRGlyZWN0b3J5IG9mICR7Zi51cmkuZnNQYXRofTpcXG5gO1xuXHRcdFx0Y29uc3Qgcm9vdFVSSSA9IGYudXJpO1xuXG5cdFx0XHRjb25zdCBlUm9vdCA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVzb2x2ZShyb290VVJJKVxuXHRcdFx0aWYgKCFlUm9vdCkgY29udGludWU7XG5cblx0XHRcdC8vIEZpcnN0IHRyeSB3aXRoIFNUQVJUX01BWF9ERVBUSCBhbmQgc3RhcnRNYXhJdGVtc1BlckRpclxuXHRcdFx0Y29uc3QgeyBjb250ZW50OiBpbml0aWFsQ29udGVudCwgd2FzQ3V0T2ZmOiBpbml0aWFsQ3V0T2ZmIH0gPSBhd2FpdCBjb21wdXRlQW5kU3RyaW5naWZ5RGlyZWN0b3J5VHJlZShcblx0XHRcdFx0ZVJvb3QsXG5cdFx0XHRcdHRoaXMuZmlsZVNlcnZpY2UsXG5cdFx0XHRcdE1BWF9ESVJTVFJfQ0hBUlNfVE9UQUxfQkVHSU5OSU5HIC0gc3RyLmxlbmd0aCxcblx0XHRcdFx0eyBjb3VudDogMCB9LFxuXHRcdFx0XHR7IG1heERlcHRoOiBTVEFSVF9NQVhfREVQVEgsIGN1cnJlbnREZXB0aDogMCwgbWF4SXRlbXNQZXJEaXI6IHN0YXJ0TWF4SXRlbXNQZXJEaXIgfVxuXHRcdFx0KTtcblxuXHRcdFx0Ly8gSWYgY3V0IG9mZiwgdHJ5IGFnYWluIHdpdGggREVGQVVMVF9NQVhfREVQVEggYW5kIERFRkFVTFRfTUFYX0lURU1TX1BFUl9ESVJcblx0XHRcdGxldCBjb250ZW50LCB3YXNDdXRPZmY7XG5cdFx0XHRpZiAoaW5pdGlhbEN1dE9mZikge1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBjb21wdXRlQW5kU3RyaW5naWZ5RGlyZWN0b3J5VHJlZShcblx0XHRcdFx0XHRlUm9vdCxcblx0XHRcdFx0XHR0aGlzLmZpbGVTZXJ2aWNlLFxuXHRcdFx0XHRcdE1BWF9ESVJTVFJfQ0hBUlNfVE9UQUxfQkVHSU5OSU5HIC0gc3RyLmxlbmd0aCxcblx0XHRcdFx0XHR7IGNvdW50OiAwIH0sXG5cdFx0XHRcdFx0eyBtYXhEZXB0aDogREVGQVVMVF9NQVhfREVQVEgsIGN1cnJlbnREZXB0aDogMCwgbWF4SXRlbXNQZXJEaXI6IERFRkFVTFRfTUFYX0lURU1TX1BFUl9ESVIgfVxuXHRcdFx0XHQpO1xuXHRcdFx0XHRjb250ZW50ID0gcmVzdWx0LmNvbnRlbnQ7XG5cdFx0XHRcdHdhc0N1dE9mZiA9IHJlc3VsdC53YXNDdXRPZmY7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb250ZW50ID0gaW5pdGlhbENvbnRlbnQ7XG5cdFx0XHRcdHdhc0N1dE9mZiA9IGluaXRpYWxDdXRPZmY7XG5cdFx0XHR9XG5cblx0XHRcdHN0ciArPSBjb250ZW50O1xuXHRcdFx0aWYgKHdhc0N1dE9mZikge1xuXHRcdFx0XHRjdXRPZmYgPSB0cnVlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBhbnMgPSBjdXRPZmYgPyBgJHtzdHIudHJpbUVuZCgpfVxcbiR7Y3V0T2ZmTWVzc2FnZX1gIDogc3RyXG5cdFx0cmV0dXJuIGFuc1xuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElEaXJlY3RvcnlTdHJTZXJ2aWNlLCBEaXJlY3RvcnlTdHJTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMs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
