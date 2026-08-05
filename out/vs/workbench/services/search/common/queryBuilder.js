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
import * as arrays from "../../../../base/common/arrays.js";
import * as collections from "../../../../base/common/collections.js";
import * as glob from "../../../../base/common/glob.js";
import { untildify } from "../../../../base/common/labels.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { Schemas } from "../../../../base/common/network.js";
import * as path from "../../../../base/common/path.js";
import { isEqual, basename, relativePath, isAbsolutePath } from "../../../../base/common/resources.js";
import * as strings from "../../../../base/common/strings.js";
import { assertIsDefined, isDefined } from "../../../../base/common/types.js";
import { URI, URI as uri } from "../../../../base/common/uri.js";
import { isMultilineRegexSource } from "../../../../editor/common/model/textModelSearch.js";
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService, toWorkspaceFolder, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IEditorGroupsService } from "../../editor/common/editorGroupsService.js";
import { IPathService } from "../../path/common/pathService.js";
import { getExcludes, pathIncludedInQuery, QueryType } from "./search.js";
function isISearchPatternBuilder(object) {
  return typeof object === "object" && "uri" in object && "pattern" in object;
}
function globPatternToISearchPatternBuilder(globPattern) {
  if (typeof globPattern === "string") {
    return {
      pattern: globPattern
    };
  }
  return {
    pattern: globPattern.pattern,
    uri: globPattern.baseUri
  };
}
let QueryBuilder = class {
  constructor(configurationService, workspaceContextService, editorGroupsService, logService, pathService, uriIdentityService) {
    this.configurationService = configurationService;
    this.workspaceContextService = workspaceContextService;
    this.editorGroupsService = editorGroupsService;
    this.logService = logService;
    this.pathService = pathService;
    this.uriIdentityService = uriIdentityService;
  }
  aiText(contentPattern, folderResources, options = {}) {
    const commonQuery = this.commonQuery(folderResources?.map(toWorkspaceFolder), options);
    return {
      ...commonQuery,
      type: QueryType.aiText,
      contentPattern
    };
  }
  text(contentPattern, folderResources, options = {}) {
    contentPattern = this.getContentPattern(contentPattern, options);
    const searchConfig = this.configurationService.getValue();
    const fallbackToPCRE = folderResources && folderResources.some((folder) => {
      const folderConfig = this.configurationService.getValue({ resource: folder });
      return !folderConfig.search.useRipgrep;
    });
    const commonQuery = this.commonQuery(folderResources?.map(toWorkspaceFolder), options);
    return {
      ...commonQuery,
      type: QueryType.Text,
      contentPattern,
      previewOptions: options.previewOptions,
      maxFileSize: options.maxFileSize,
      usePCRE2: searchConfig.search.usePCRE2 || fallbackToPCRE || false,
      surroundingContext: options.surroundingContext,
      userDisabledExcludesAndIgnoreFiles: options.disregardExcludeSettings && options.disregardIgnoreFiles
    };
  }
  /**
   * Adjusts input pattern for config
   */
  getContentPattern(inputPattern, options) {
    const searchConfig = this.configurationService.getValue();
    if (inputPattern.isRegExp) {
      inputPattern.pattern = inputPattern.pattern.replace(/\r?\n/g, "\\n");
    }
    const newPattern = {
      ...inputPattern,
      wordSeparators: searchConfig.editor.wordSeparators
    };
    if (this.isCaseSensitive(inputPattern, options)) {
      newPattern.isCaseSensitive = true;
    }
    if (this.isMultiline(inputPattern)) {
      newPattern.isMultiline = true;
    }
    if (options.notebookSearchConfig?.includeMarkupInput) {
      if (!newPattern.notebookInfo) {
        newPattern.notebookInfo = {};
      }
      newPattern.notebookInfo.isInNotebookMarkdownInput = options.notebookSearchConfig.includeMarkupInput;
    }
    if (options.notebookSearchConfig?.includeMarkupPreview) {
      if (!newPattern.notebookInfo) {
        newPattern.notebookInfo = {};
      }
      newPattern.notebookInfo.isInNotebookMarkdownPreview = options.notebookSearchConfig.includeMarkupPreview;
    }
    if (options.notebookSearchConfig?.includeCodeInput) {
      if (!newPattern.notebookInfo) {
        newPattern.notebookInfo = {};
      }
      newPattern.notebookInfo.isInNotebookCellInput = options.notebookSearchConfig.includeCodeInput;
    }
    if (options.notebookSearchConfig?.includeOutput) {
      if (!newPattern.notebookInfo) {
        newPattern.notebookInfo = {};
      }
      newPattern.notebookInfo.isInNotebookCellOutput = options.notebookSearchConfig.includeOutput;
    }
    return newPattern;
  }
  file(folders, options = {}) {
    const commonQuery = this.commonQuery(folders, options);
    return {
      ...commonQuery,
      type: QueryType.File,
      filePattern: options.filePattern ? options.filePattern.trim() : options.filePattern,
      exists: options.exists,
      sortByScore: options.sortByScore,
      cacheKey: options.cacheKey,
      shouldGlobMatchFilePattern: options.shouldGlobSearch
    };
  }
  handleIncludeExclude(pattern, expandPatterns) {
    if (!pattern) {
      return {};
    }
    if (Array.isArray(pattern)) {
      pattern = pattern.filter((p) => p.length > 0).map(normalizeSlashes);
      if (!pattern.length) {
        return {};
      }
    } else {
      pattern = normalizeSlashes(pattern);
    }
    return expandPatterns ? this.parseSearchPaths(pattern) : { pattern: patternListToIExpression(...Array.isArray(pattern) ? pattern : [pattern]) };
  }
  commonQuery(folderResources = [], options = {}) {
    let excludePatterns = Array.isArray(options.excludePattern) ? options.excludePattern.map((p) => p.pattern).flat() : options.excludePattern;
    excludePatterns = excludePatterns?.length === 1 ? excludePatterns[0] : excludePatterns;
    const includeSearchPathsInfo = this.handleIncludeExclude(options.includePattern, options.expandPatterns);
    const excludeSearchPathsInfo = this.handleIncludeExclude(excludePatterns, options.expandPatterns);
    const includeFolderName = folderResources.length > 1;
    const folderQueries = (includeSearchPathsInfo.searchPaths && includeSearchPathsInfo.searchPaths.length ? includeSearchPathsInfo.searchPaths.map((searchPath) => this.getFolderQueryForSearchPath(searchPath, options, excludeSearchPathsInfo)) : folderResources.map((folder) => this.getFolderQueryForRoot(folder, options, excludeSearchPathsInfo, includeFolderName))).filter((query) => !!query);
    const queryProps = {
      _reason: options._reason,
      folderQueries,
      usingSearchPaths: !!(includeSearchPathsInfo.searchPaths && includeSearchPathsInfo.searchPaths.length),
      extraFileResources: options.extraFileResources,
      excludePattern: excludeSearchPathsInfo.pattern,
      includePattern: includeSearchPathsInfo.pattern,
      onlyOpenEditors: options.onlyOpenEditors,
      maxResults: options.maxResults,
      onlyFileScheme: options.onlyFileScheme
    };
    if (options.onlyOpenEditors) {
      const openEditors = arrays.coalesce(this.editorGroupsService.groups.flatMap((group) => group.editors.map((editor) => editor.resource)));
      this.logService.trace("QueryBuilder#commonQuery - openEditor URIs", JSON.stringify(openEditors));
      const openEditorsInQuery = openEditors.filter((editor) => pathIncludedInQuery(queryProps, editor.fsPath));
      const openEditorsQueryProps = this.commonQueryFromFileList(openEditorsInQuery);
      this.logService.trace("QueryBuilder#commonQuery - openEditor Query", JSON.stringify(openEditorsQueryProps));
      return { ...queryProps, ...openEditorsQueryProps };
    }
    const extraFileResources = options.extraFileResources && options.extraFileResources.filter((extraFile) => pathIncludedInQuery(queryProps, extraFile.fsPath));
    queryProps.extraFileResources = extraFileResources && extraFileResources.length ? extraFileResources : void 0;
    return queryProps;
  }
  commonQueryFromFileList(files) {
    const folderQueries = [];
    const foldersToSearch = new ResourceMap();
    const includePattern = {};
    let hasIncludedFile = false;
    files.forEach((file) => {
      if (file.scheme === Schemas.walkThrough) {
        return;
      }
      const providerExists = isAbsolutePath(file);
      if (providerExists) {
        const searchRoot = this.workspaceContextService.getWorkspaceFolder(file)?.uri ?? this.uriIdentityService.extUri.dirname(file);
        let folderQuery = foldersToSearch.get(searchRoot);
        if (!folderQuery) {
          hasIncludedFile = true;
          folderQuery = { folder: searchRoot, includePattern: {} };
          folderQueries.push(folderQuery);
          foldersToSearch.set(searchRoot, folderQuery);
        }
        const relPath = path.relative(searchRoot.fsPath, file.fsPath);
        assertIsDefined(folderQuery.includePattern)[relPath.replace(/\\/g, "/")] = true;
      } else {
        if (file.fsPath) {
          hasIncludedFile = true;
          includePattern[file.fsPath] = true;
        }
      }
    });
    return {
      folderQueries,
      includePattern,
      usingSearchPaths: true,
      excludePattern: hasIncludedFile ? void 0 : { "**/*": true }
    };
  }
  /**
   * Resolve isCaseSensitive flag based on the query and the isSmartCase flag, for search providers that don't support smart case natively.
   */
  isCaseSensitive(contentPattern, options) {
    if (options.isSmartCase) {
      if (contentPattern.isRegExp) {
        if (strings.containsUppercaseCharacter(contentPattern.pattern, true)) {
          return true;
        }
      } else if (strings.containsUppercaseCharacter(contentPattern.pattern)) {
        return true;
      }
    }
    return !!contentPattern.isCaseSensitive;
  }
  isMultiline(contentPattern) {
    if (contentPattern.isMultiline) {
      return true;
    }
    if (contentPattern.isRegExp && isMultilineRegexSource(contentPattern.pattern)) {
      return true;
    }
    if (contentPattern.pattern.indexOf("\n") >= 0) {
      return true;
    }
    return !!contentPattern.isMultiline;
  }
  /**
   * Take the includePattern as seen in the search viewlet, and split into components that look like searchPaths, and
   * glob patterns. Glob patterns are expanded from 'foo/bar' to '{foo/bar/**, **\/foo/bar}.
   *
   * Public for test.
   */
  parseSearchPaths(pattern) {
    const isSearchPath = (segment) => {
      return path.isAbsolute(segment) || /^\.\.?([\/\\]|$)/.test(segment);
    };
    const patterns = Array.isArray(pattern) ? pattern : splitGlobPattern(pattern);
    const segments = patterns.map((segment) => {
      const userHome = this.pathService.resolvedUserHome;
      if (userHome) {
        return untildify(segment, userHome.scheme === Schemas.file ? userHome.fsPath : userHome.path);
      }
      return segment;
    });
    const groups = collections.groupBy(
      segments,
      (segment) => isSearchPath(segment) ? "searchPaths" : "exprSegments"
    );
    const expandedExprSegments = (groups.exprSegments || []).map((s) => strings.rtrim(s, "/")).map((s) => strings.rtrim(s, "\\")).map((p) => {
      if (p[0] === ".") {
        p = "*" + p;
      }
      return expandGlobalGlob(p);
    });
    const result = {};
    const searchPaths = this.expandSearchPathPatterns(groups.searchPaths || []);
    if (searchPaths && searchPaths.length) {
      result.searchPaths = searchPaths;
    }
    const exprSegments = expandedExprSegments.flat();
    const includePattern = patternListToIExpression(...exprSegments);
    if (includePattern) {
      result.pattern = includePattern;
    }
    return result;
  }
  getExcludesForFolder(folderConfig, options) {
    return options.disregardExcludeSettings ? void 0 : getExcludes(folderConfig, !options.disregardSearchExcludeSettings);
  }
  /**
   * Split search paths (./ or ../ or absolute paths in the includePatterns) into absolute paths and globs applied to those paths
   */
  expandSearchPathPatterns(searchPaths) {
    if (!searchPaths || !searchPaths.length) {
      return [];
    }
    const expandedSearchPaths = searchPaths.flatMap((searchPath) => {
      let { pathPortion, globPortion } = splitGlobFromPath(searchPath);
      if (globPortion) {
        globPortion = normalizeGlobPattern(globPortion);
      }
      const oneExpanded = this.expandOneSearchPath(pathPortion);
      return oneExpanded.flatMap((oneExpandedResult) => this.resolveOneSearchPathPattern(oneExpandedResult, globPortion));
    });
    const searchPathPatternMap = /* @__PURE__ */ new Map();
    expandedSearchPaths.forEach((oneSearchPathPattern) => {
      const key = oneSearchPathPattern.searchPath.toString();
      const existing = searchPathPatternMap.get(key);
      if (existing) {
        if (oneSearchPathPattern.pattern) {
          existing.pattern = existing.pattern || {};
          existing.pattern[oneSearchPathPattern.pattern] = true;
        }
      } else {
        searchPathPatternMap.set(key, {
          searchPath: oneSearchPathPattern.searchPath,
          pattern: oneSearchPathPattern.pattern ? patternListToIExpression(oneSearchPathPattern.pattern) : void 0
        });
      }
    });
    return Array.from(searchPathPatternMap.values());
  }
  /**
   * Takes a searchPath like `./a/foo` or `../a/foo` and expands it to absolute paths for all the workspaces it matches.
   */
  expandOneSearchPath(searchPath) {
    if (path.isAbsolute(searchPath)) {
      const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
      if (workspaceFolders[0] && workspaceFolders[0].uri.scheme !== Schemas.file) {
        return [{
          searchPath: workspaceFolders[0].uri.with({ path: searchPath })
        }];
      }
      return [{
        searchPath: uri.file(path.normalize(searchPath))
      }];
    }
    if (this.workspaceContextService.getWorkbenchState() === WorkbenchState.FOLDER) {
      const workspaceUri = this.workspaceContextService.getWorkspace().folders[0].uri;
      searchPath = normalizeSlashes(searchPath);
      if (searchPath.startsWith("../") || searchPath === "..") {
        const resolvedPath = path.posix.resolve(workspaceUri.path, searchPath);
        return [{
          searchPath: workspaceUri.with({ path: resolvedPath })
        }];
      }
      const cleanedPattern = normalizeGlobPattern(searchPath);
      return [{
        searchPath: workspaceUri,
        pattern: cleanedPattern
      }];
    } else if (searchPath === "./" || searchPath === ".\\") {
      return [];
    } else {
      const searchPathWithoutDotSlash = searchPath.replace(/^\.[\/\\]/, "");
      const folders = this.workspaceContextService.getWorkspace().folders;
      const folderMatches = folders.map((folder) => {
        const match = searchPathWithoutDotSlash.match(new RegExp(`^${strings.escapeRegExpCharacters(folder.name)}(?:/(.*)|$)`));
        return match ? {
          match,
          folder
        } : null;
      }).filter(isDefined);
      if (folderMatches.length) {
        return folderMatches.map((match) => {
          const patternMatch = match.match[1];
          return {
            searchPath: match.folder.uri,
            pattern: patternMatch && normalizeGlobPattern(patternMatch)
          };
        });
      } else {
        const probableWorkspaceFolderNameMatch = searchPath.match(/\.[\/\\](.+)[\/\\]?/);
        const probableWorkspaceFolderName = probableWorkspaceFolderNameMatch ? probableWorkspaceFolderNameMatch[1] : searchPath;
        const searchPathNotFoundError = nls.localize("search.noWorkspaceWithName", "Workspace folder does not exist: {0}", probableWorkspaceFolderName);
        throw new Error(searchPathNotFoundError);
      }
    }
  }
  resolveOneSearchPathPattern(oneExpandedResult, globPortion) {
    const pattern = oneExpandedResult.pattern && globPortion ? `${oneExpandedResult.pattern}/${globPortion}` : oneExpandedResult.pattern || globPortion;
    const results = [
      {
        searchPath: oneExpandedResult.searchPath,
        pattern
      }
    ];
    if (pattern && !pattern.endsWith("**")) {
      results.push({
        searchPath: oneExpandedResult.searchPath,
        pattern: pattern + "/**"
      });
    }
    return results;
  }
  getFolderQueryForSearchPath(searchPath, options, searchPathExcludes) {
    const rootConfig = this.getFolderQueryForRoot(toWorkspaceFolder(searchPath.searchPath), options, searchPathExcludes, false);
    if (!rootConfig) {
      return null;
    }
    return {
      ...rootConfig,
      ...{
        includePattern: searchPath.pattern
      }
    };
  }
  getFolderQueryForRoot(folder, options, searchPathExcludes, includeFolderName) {
    let thisFolderExcludeSearchPathPattern;
    const folderUri = URI.isUri(folder) ? folder : folder.uri;
    let excludeFolderRoots = options.excludePattern?.map((excludePattern2) => {
      const excludeRoot = options.excludePattern && isISearchPatternBuilder(excludePattern2) ? excludePattern2.uri : void 0;
      const shouldUseExcludeRoot = !excludeRoot || !(URI.isUri(folder) && this.uriIdentityService.extUri.isEqual(folder, excludeRoot));
      return shouldUseExcludeRoot ? excludeRoot : void 0;
    });
    if (!excludeFolderRoots?.length) {
      excludeFolderRoots = [void 0];
    }
    if (searchPathExcludes.searchPaths) {
      const thisFolderExcludeSearchPath = searchPathExcludes.searchPaths.filter((sp) => isEqual(sp.searchPath, folderUri))[0];
      if (thisFolderExcludeSearchPath && !thisFolderExcludeSearchPath.pattern) {
        return null;
      } else if (thisFolderExcludeSearchPath) {
        thisFolderExcludeSearchPathPattern = thisFolderExcludeSearchPath.pattern;
      }
    }
    const folderConfig = this.configurationService.getValue({ resource: folderUri });
    const settingExcludes = this.getExcludesForFolder(folderConfig, options);
    const excludePattern = {
      ...settingExcludes || {},
      ...thisFolderExcludeSearchPathPattern || {}
    };
    const folderName = URI.isUri(folder) ? basename(folder) : folder.name;
    const excludePatternRet = excludeFolderRoots.map((excludeFolderRoot) => {
      return Object.keys(excludePattern).length > 0 ? {
        folder: excludeFolderRoot,
        pattern: excludePattern
      } : void 0;
    }).filter((e) => e);
    return {
      folder: folderUri,
      folderName: includeFolderName ? folderName : void 0,
      excludePattern: excludePatternRet,
      fileEncoding: folderConfig.files && folderConfig.files.encoding,
      disregardIgnoreFiles: typeof options.disregardIgnoreFiles === "boolean" ? options.disregardIgnoreFiles : !folderConfig.search.useIgnoreFiles,
      disregardGlobalIgnoreFiles: typeof options.disregardGlobalIgnoreFiles === "boolean" ? options.disregardGlobalIgnoreFiles : !folderConfig.search.useGlobalIgnoreFiles,
      disregardParentIgnoreFiles: typeof options.disregardParentIgnoreFiles === "boolean" ? options.disregardParentIgnoreFiles : !folderConfig.search.useParentIgnoreFiles,
      ignoreSymlinks: typeof options.ignoreSymlinks === "boolean" ? options.ignoreSymlinks : !folderConfig.search.followSymlinks
    };
  }
};
QueryBuilder = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IEditorGroupsService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IPathService),
  __decorateParam(5, IUriIdentityService)
], QueryBuilder);
function splitGlobFromPath(searchPath) {
  const globCharMatch = searchPath.match(/[\*\{\}\(\)\[\]\?]/);
  if (globCharMatch) {
    const globCharIdx = globCharMatch.index;
    const lastSlashMatch = searchPath.substr(0, globCharIdx).match(/[/|\\][^/\\]*$/);
    if (lastSlashMatch) {
      let pathPortion = searchPath.substr(0, lastSlashMatch.index);
      if (!pathPortion.match(/[/\\]/)) {
        pathPortion += "/";
      }
      return {
        pathPortion,
        globPortion: searchPath.substr((lastSlashMatch.index || 0) + 1)
      };
    }
  }
  return {
    pathPortion: searchPath
  };
}
function patternListToIExpression(...patterns) {
  return patterns.length ? patterns.reduce((glob2, cur) => {
    glob2[cur] = true;
    return glob2;
  }, /* @__PURE__ */ Object.create(null)) : void 0;
}
function splitGlobPattern(pattern) {
  return glob.splitGlobAware(pattern, ",").map((s) => s.trim()).filter((s) => !!s.length);
}
function expandGlobalGlob(pattern) {
  const patterns = [
    `**/${pattern}/**`,
    `**/${pattern}`
  ];
  return patterns.map((p) => p.replace(/\*\*\/\*\*/g, "**"));
}
function normalizeSlashes(pattern) {
  return pattern.replace(/\\/g, "/");
}
function normalizeGlobPattern(pattern) {
  return normalizeSlashes(pattern).replace(/^\.\//, "").replace(/\/+$/g, "");
}
function escapeGlobPattern(path2) {
  return path2.replace(/([?*[\]])/g, "[$1]");
}
function resolveResourcesForSearchIncludes(resources, contextService) {
  resources = arrays.distinct(resources, (resource) => resource.toString());
  const folderPaths = [];
  const workspace = contextService.getWorkspace();
  if (resources) {
    resources.forEach((resource) => {
      let folderPath;
      if (contextService.getWorkbenchState() === WorkbenchState.FOLDER) {
        folderPath = relativePath(workspace.folders[0].uri, resource);
        if (folderPath && folderPath !== ".") {
          folderPath = "./" + folderPath;
        }
      } else {
        const owningFolder = contextService.getWorkspaceFolder(resource);
        if (owningFolder) {
          const owningRootName = owningFolder.name;
          const isUniqueFolder = workspace.folders.filter((folder) => folder.name === owningRootName).length === 1;
          if (isUniqueFolder) {
            const relPath = relativePath(owningFolder.uri, resource);
            if (relPath === "") {
              folderPath = `./${owningFolder.name}`;
            } else {
              folderPath = `./${owningFolder.name}/${relPath}`;
            }
          } else {
            folderPath = resource.fsPath;
          }
        }
      }
      if (folderPath) {
        folderPaths.push(escapeGlobPattern(folderPath));
      }
    });
  }
  return folderPaths;
}
export {
  QueryBuilder,
  globPatternToISearchPatternBuilder,
  isISearchPatternBuilder,
  resolveResourcesForSearchIncludes
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL2NvbW1vbi9xdWVyeUJ1aWxkZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBhcnJheXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCAqIGFzIGNvbGxlY3Rpb25zIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZ2xvYi5qcyc7XG5pbXBvcnQgeyB1bnRpbGRpZnkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9sYWJlbHMuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IGlzRXF1YWwsIGJhc2VuYW1lLCByZWxhdGl2ZVBhdGgsIGlzQWJzb2x1dGVQYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBhc3NlcnRJc0RlZmluZWQsIGlzRGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSwgVVJJIGFzIHVyaSwgVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBpc011bHRpbGluZVJlZ2V4U291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWxTZWFyY2guanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIElXb3Jrc3BhY2VGb2xkZXJEYXRhLCB0b1dvcmtzcGFjZUZvbGRlciwgV29ya2JlbmNoU3RhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUGF0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wYXRoL2NvbW1vbi9wYXRoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFeGNsdWRlR2xvYlBhdHRlcm4sIGdldEV4Y2x1ZGVzLCBJQUlUZXh0UXVlcnksIElDb21tb25RdWVyeVByb3BzLCBJRmlsZVF1ZXJ5LCBJRm9sZGVyUXVlcnksIElQYXR0ZXJuSW5mbywgSVNlYXJjaENvbmZpZ3VyYXRpb24sIElUZXh0UXVlcnksIElUZXh0U2VhcmNoUHJldmlld09wdGlvbnMsIHBhdGhJbmNsdWRlZEluUXVlcnksIFF1ZXJ5VHlwZSB9IGZyb20gJy4vc2VhcmNoLmpzJztcbmltcG9ydCB7IEdsb2JQYXR0ZXJuIH0gZnJvbSAnLi9zZWFyY2hFeHRUeXBlcy5qcyc7XG5cbi8qKlxuICogT25lIGZvbGRlciB0byBzZWFyY2ggYW5kIGEgZ2xvYiBleHByZXNzaW9uIHRoYXQgc2hvdWxkIGJlIGFwcGxpZWQuXG4gKi9cbmludGVyZmFjZSBJT25lU2VhcmNoUGF0aFBhdHRlcm4ge1xuXHRzZWFyY2hQYXRoOiB1cmk7XG5cdHBhdHRlcm4/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogT25lIGZvbGRlciB0byBzZWFyY2ggYW5kIGEgc2V0IG9mIGdsb2IgZXhwcmVzc2lvbnMgdGhhdCBzaG91bGQgYmUgYXBwbGllZC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJU2VhcmNoUGF0aFBhdHRlcm4ge1xuXHRzZWFyY2hQYXRoOiB1cmk7XG5cdHBhdHRlcm4/OiBnbG9iLklFeHByZXNzaW9uO1xufVxuXG50eXBlIElTZWFyY2hQYXRoUGF0dGVybkJ1aWxkZXIgPSBzdHJpbmcgfCBzdHJpbmdbXTtcblxuZXhwb3J0IGludGVyZmFjZSBJU2VhcmNoUGF0dGVybkJ1aWxkZXI8VSBleHRlbmRzIFVyaUNvbXBvbmVudHM+IHtcblx0dXJpPzogVTtcblx0cGF0dGVybjogSVNlYXJjaFBhdGhQYXR0ZXJuQnVpbGRlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzSVNlYXJjaFBhdHRlcm5CdWlsZGVyPFUgZXh0ZW5kcyBVcmlDb21wb25lbnRzPihvYmplY3Q6IElTZWFyY2hQYXR0ZXJuQnVpbGRlcjxVPiB8IElTZWFyY2hQYXRoUGF0dGVybkJ1aWxkZXIpOiBvYmplY3QgaXMgSVNlYXJjaFBhdHRlcm5CdWlsZGVyPFU+IHtcblx0cmV0dXJuICh0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JyAmJiAndXJpJyBpbiBvYmplY3QgJiYgJ3BhdHRlcm4nIGluIG9iamVjdCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnbG9iUGF0dGVyblRvSVNlYXJjaFBhdHRlcm5CdWlsZGVyKGdsb2JQYXR0ZXJuOiBHbG9iUGF0dGVybik6IElTZWFyY2hQYXR0ZXJuQnVpbGRlcjxVUkk+IHtcblxuXHRpZiAodHlwZW9mIGdsb2JQYXR0ZXJuID09PSAnc3RyaW5nJykge1xuXHRcdHJldHVybiB7XG5cdFx0XHRwYXR0ZXJuOiBnbG9iUGF0dGVyblxuXHRcdH07XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdHBhdHRlcm46IGdsb2JQYXR0ZXJuLnBhdHRlcm4sXG5cdFx0dXJpOiBnbG9iUGF0dGVybi5iYXNlVXJpXG5cdH07XG59XG5cbi8qKlxuICogQSBzZXQgb2Ygc2VhcmNoIHBhdGhzIGFuZCBhIHNldCBvZiBnbG9iIGV4cHJlc3Npb25zIHRoYXQgc2hvdWxkIGJlIGFwcGxpZWQuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSVNlYXJjaFBhdGhzSW5mbyB7XG5cdHNlYXJjaFBhdGhzPzogSVNlYXJjaFBhdGhQYXR0ZXJuW107XG5cdHBhdHRlcm4/OiBnbG9iLklFeHByZXNzaW9uO1xufVxuXG5pbnRlcmZhY2UgSUNvbW1vblF1ZXJ5QnVpbGRlck9wdGlvbnM8VSBleHRlbmRzIFVyaUNvbXBvbmVudHMgPSBVUkk+IHtcblx0X3JlYXNvbj86IHN0cmluZztcblx0ZXhjbHVkZVBhdHRlcm4/OiBJU2VhcmNoUGF0dGVybkJ1aWxkZXI8VT5bXTtcblx0aW5jbHVkZVBhdHRlcm4/OiBJU2VhcmNoUGF0aFBhdHRlcm5CdWlsZGVyO1xuXHRleHRyYUZpbGVSZXNvdXJjZXM/OiBVW107XG5cblx0LyoqIFBhcnNlIHRoZSBzcGVjaWFsIC4vIHN5bnRheCBzdXBwb3J0ZWQgYnkgdGhlIHNlYXJjaHZpZXcsIGFuZCBleHBhbmQgZm9vIHRvICoqIC9mb28gKi9cblx0ZXhwYW5kUGF0dGVybnM/OiBib29sZWFuO1xuXG5cdG1heFJlc3VsdHM/OiBudW1iZXI7XG5cdG1heEZpbGVTaXplPzogbnVtYmVyO1xuXHRkaXNyZWdhcmRJZ25vcmVGaWxlcz86IGJvb2xlYW47XG5cdGRpc3JlZ2FyZEdsb2JhbElnbm9yZUZpbGVzPzogYm9vbGVhbjtcblx0ZGlzcmVnYXJkUGFyZW50SWdub3JlRmlsZXM/OiBib29sZWFuO1xuXHRkaXNyZWdhcmRFeGNsdWRlU2V0dGluZ3M/OiBib29sZWFuO1xuXHRkaXNyZWdhcmRTZWFyY2hFeGNsdWRlU2V0dGluZ3M/OiBib29sZWFuO1xuXHRpZ25vcmVTeW1saW5rcz86IGJvb2xlYW47XG5cdG9ubHlPcGVuRWRpdG9ycz86IGJvb2xlYW47XG5cdG9ubHlGaWxlU2NoZW1lPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZVF1ZXJ5QnVpbGRlck9wdGlvbnM8VSBleHRlbmRzIFVyaUNvbXBvbmVudHMgPSBVUkk+IGV4dGVuZHMgSUNvbW1vblF1ZXJ5QnVpbGRlck9wdGlvbnM8VT4ge1xuXHRmaWxlUGF0dGVybj86IHN0cmluZztcblx0ZXhpc3RzPzogYm9vbGVhbjtcblx0c29ydEJ5U2NvcmU/OiBib29sZWFuO1xuXHRjYWNoZUtleT86IHN0cmluZztcblx0c2hvdWxkR2xvYlNlYXJjaD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRleHRRdWVyeUJ1aWxkZXJPcHRpb25zPFUgZXh0ZW5kcyBVcmlDb21wb25lbnRzID0gVVJJPiBleHRlbmRzIElDb21tb25RdWVyeUJ1aWxkZXJPcHRpb25zPFU+IHtcblx0cHJldmlld09wdGlvbnM/OiBJVGV4dFNlYXJjaFByZXZpZXdPcHRpb25zO1xuXHRmaWxlRW5jb2Rpbmc/OiBzdHJpbmc7XG5cdHN1cnJvdW5kaW5nQ29udGV4dD86IG51bWJlcjtcblx0aXNTbWFydENhc2U/OiBib29sZWFuO1xuXHRub3RlYm9va1NlYXJjaENvbmZpZz86IHtcblx0XHRpbmNsdWRlTWFya3VwSW5wdXQ6IGJvb2xlYW47XG5cdFx0aW5jbHVkZU1hcmt1cFByZXZpZXc6IGJvb2xlYW47XG5cdFx0aW5jbHVkZUNvZGVJbnB1dDogYm9vbGVhbjtcblx0XHRpbmNsdWRlT3V0cHV0OiBib29sZWFuO1xuXHR9O1xufVxuXG5leHBvcnQgY2xhc3MgUXVlcnlCdWlsZGVyIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JHcm91cHNTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVBhdGhTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcGF0aFNlcnZpY2U6IElQYXRoU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZVxuXHQpIHtcblx0fVxuXG5cdGFpVGV4dChjb250ZW50UGF0dGVybjogc3RyaW5nLCBmb2xkZXJSZXNvdXJjZXM/OiB1cmlbXSwgb3B0aW9uczogSVRleHRRdWVyeUJ1aWxkZXJPcHRpb25zID0ge30pOiBJQUlUZXh0UXVlcnkge1xuXHRcdGNvbnN0IGNvbW1vblF1ZXJ5ID0gdGhpcy5jb21tb25RdWVyeShmb2xkZXJSZXNvdXJjZXM/Lm1hcCh0b1dvcmtzcGFjZUZvbGRlciksIG9wdGlvbnMpO1xuXHRcdHJldHVybiB7XG5cdFx0XHQuLi5jb21tb25RdWVyeSxcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5haVRleHQsXG5cdFx0XHRjb250ZW50UGF0dGVybixcblx0XHR9O1xuXHR9XG5cblx0dGV4dChjb250ZW50UGF0dGVybjogSVBhdHRlcm5JbmZvLCBmb2xkZXJSZXNvdXJjZXM/OiB1cmlbXSwgb3B0aW9uczogSVRleHRRdWVyeUJ1aWxkZXJPcHRpb25zID0ge30pOiBJVGV4dFF1ZXJ5IHtcblx0XHRjb250ZW50UGF0dGVybiA9IHRoaXMuZ2V0Q29udGVudFBhdHRlcm4oY29udGVudFBhdHRlcm4sIG9wdGlvbnMpO1xuXHRcdGNvbnN0IHNlYXJjaENvbmZpZyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVNlYXJjaENvbmZpZ3VyYXRpb24+KCk7XG5cblx0XHRjb25zdCBmYWxsYmFja1RvUENSRSA9IGZvbGRlclJlc291cmNlcyAmJiBmb2xkZXJSZXNvdXJjZXMuc29tZShmb2xkZXIgPT4ge1xuXHRcdFx0Y29uc3QgZm9sZGVyQ29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJU2VhcmNoQ29uZmlndXJhdGlvbj4oeyByZXNvdXJjZTogZm9sZGVyIH0pO1xuXHRcdFx0cmV0dXJuICFmb2xkZXJDb25maWcuc2VhcmNoLnVzZVJpcGdyZXA7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBjb21tb25RdWVyeSA9IHRoaXMuY29tbW9uUXVlcnkoZm9sZGVyUmVzb3VyY2VzPy5tYXAodG9Xb3Jrc3BhY2VGb2xkZXIpLCBvcHRpb25zKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4uY29tbW9uUXVlcnksXG5cdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dCxcblx0XHRcdGNvbnRlbnRQYXR0ZXJuLFxuXHRcdFx0cHJldmlld09wdGlvbnM6IG9wdGlvbnMucHJldmlld09wdGlvbnMsXG5cdFx0XHRtYXhGaWxlU2l6ZTogb3B0aW9ucy5tYXhGaWxlU2l6ZSxcblx0XHRcdHVzZVBDUkUyOiBzZWFyY2hDb25maWcuc2VhcmNoLnVzZVBDUkUyIHx8IGZhbGxiYWNrVG9QQ1JFIHx8IGZhbHNlLFxuXHRcdFx0c3Vycm91bmRpbmdDb250ZXh0OiBvcHRpb25zLnN1cnJvdW5kaW5nQ29udGV4dCxcblx0XHRcdHVzZXJEaXNhYmxlZEV4Y2x1ZGVzQW5kSWdub3JlRmlsZXM6IG9wdGlvbnMuZGlzcmVnYXJkRXhjbHVkZVNldHRpbmdzICYmIG9wdGlvbnMuZGlzcmVnYXJkSWdub3JlRmlsZXMsXG5cblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIEFkanVzdHMgaW5wdXQgcGF0dGVybiBmb3IgY29uZmlnXG5cdCAqL1xuXHRwcml2YXRlIGdldENvbnRlbnRQYXR0ZXJuKGlucHV0UGF0dGVybjogSVBhdHRlcm5JbmZvLCBvcHRpb25zOiBJVGV4dFF1ZXJ5QnVpbGRlck9wdGlvbnMpOiBJUGF0dGVybkluZm8ge1xuXHRcdGNvbnN0IHNlYXJjaENvbmZpZyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVNlYXJjaENvbmZpZ3VyYXRpb24+KCk7XG5cblx0XHRpZiAoaW5wdXRQYXR0ZXJuLmlzUmVnRXhwKSB7XG5cdFx0XHRpbnB1dFBhdHRlcm4ucGF0dGVybiA9IGlucHV0UGF0dGVybi5wYXR0ZXJuLnJlcGxhY2UoL1xccj9cXG4vZywgJ1xcXFxuJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV3UGF0dGVybiA9IHtcblx0XHRcdC4uLmlucHV0UGF0dGVybixcblx0XHRcdHdvcmRTZXBhcmF0b3JzOiBzZWFyY2hDb25maWcuZWRpdG9yLndvcmRTZXBhcmF0b3JzXG5cdFx0fTtcblxuXHRcdGlmICh0aGlzLmlzQ2FzZVNlbnNpdGl2ZShpbnB1dFBhdHRlcm4sIG9wdGlvbnMpKSB7XG5cdFx0XHRuZXdQYXR0ZXJuLmlzQ2FzZVNlbnNpdGl2ZSA9IHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaXNNdWx0aWxpbmUoaW5wdXRQYXR0ZXJuKSkge1xuXHRcdFx0bmV3UGF0dGVybi5pc011bHRpbGluZSA9IHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnMubm90ZWJvb2tTZWFyY2hDb25maWc/LmluY2x1ZGVNYXJrdXBJbnB1dCkge1xuXHRcdFx0aWYgKCFuZXdQYXR0ZXJuLm5vdGVib29rSW5mbykge1xuXHRcdFx0XHRuZXdQYXR0ZXJuLm5vdGVib29rSW5mbyA9IHt9O1xuXHRcdFx0fVxuXHRcdFx0bmV3UGF0dGVybi5ub3RlYm9va0luZm8uaXNJbk5vdGVib29rTWFya2Rvd25JbnB1dCA9IG9wdGlvbnMubm90ZWJvb2tTZWFyY2hDb25maWcuaW5jbHVkZU1hcmt1cElucHV0O1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zLm5vdGVib29rU2VhcmNoQ29uZmlnPy5pbmNsdWRlTWFya3VwUHJldmlldykge1xuXHRcdFx0aWYgKCFuZXdQYXR0ZXJuLm5vdGVib29rSW5mbykge1xuXHRcdFx0XHRuZXdQYXR0ZXJuLm5vdGVib29rSW5mbyA9IHt9O1xuXHRcdFx0fVxuXHRcdFx0bmV3UGF0dGVybi5ub3RlYm9va0luZm8uaXNJbk5vdGVib29rTWFya2Rvd25QcmV2aWV3ID0gb3B0aW9ucy5ub3RlYm9va1NlYXJjaENvbmZpZy5pbmNsdWRlTWFya3VwUHJldmlldztcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucy5ub3RlYm9va1NlYXJjaENvbmZpZz8uaW5jbHVkZUNvZGVJbnB1dCkge1xuXHRcdFx0aWYgKCFuZXdQYXR0ZXJuLm5vdGVib29rSW5mbykge1xuXHRcdFx0XHRuZXdQYXR0ZXJuLm5vdGVib29rSW5mbyA9IHt9O1xuXHRcdFx0fVxuXHRcdFx0bmV3UGF0dGVybi5ub3RlYm9va0luZm8uaXNJbk5vdGVib29rQ2VsbElucHV0ID0gb3B0aW9ucy5ub3RlYm9va1NlYXJjaENvbmZpZy5pbmNsdWRlQ29kZUlucHV0O1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zLm5vdGVib29rU2VhcmNoQ29uZmlnPy5pbmNsdWRlT3V0cHV0KSB7XG5cdFx0XHRpZiAoIW5ld1BhdHRlcm4ubm90ZWJvb2tJbmZvKSB7XG5cdFx0XHRcdG5ld1BhdHRlcm4ubm90ZWJvb2tJbmZvID0ge307XG5cdFx0XHR9XG5cdFx0XHRuZXdQYXR0ZXJuLm5vdGVib29rSW5mby5pc0luTm90ZWJvb2tDZWxsT3V0cHV0ID0gb3B0aW9ucy5ub3RlYm9va1NlYXJjaENvbmZpZy5pbmNsdWRlT3V0cHV0O1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXdQYXR0ZXJuO1xuXHR9XG5cblx0ZmlsZShmb2xkZXJzOiAoSVdvcmtzcGFjZUZvbGRlckRhdGEgfCBVUkkpW10sIG9wdGlvbnM6IElGaWxlUXVlcnlCdWlsZGVyT3B0aW9ucyA9IHt9KTogSUZpbGVRdWVyeSB7XG5cdFx0Y29uc3QgY29tbW9uUXVlcnkgPSB0aGlzLmNvbW1vblF1ZXJ5KGZvbGRlcnMsIG9wdGlvbnMpO1xuXHRcdHJldHVybiB7XG5cdFx0XHQuLi5jb21tb25RdWVyeSxcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXHRcdFx0ZmlsZVBhdHRlcm46IG9wdGlvbnMuZmlsZVBhdHRlcm5cblx0XHRcdFx0PyBvcHRpb25zLmZpbGVQYXR0ZXJuLnRyaW0oKVxuXHRcdFx0XHQ6IG9wdGlvbnMuZmlsZVBhdHRlcm4sXG5cdFx0XHRleGlzdHM6IG9wdGlvbnMuZXhpc3RzLFxuXHRcdFx0c29ydEJ5U2NvcmU6IG9wdGlvbnMuc29ydEJ5U2NvcmUsXG5cdFx0XHRjYWNoZUtleTogb3B0aW9ucy5jYWNoZUtleSxcblx0XHRcdHNob3VsZEdsb2JNYXRjaEZpbGVQYXR0ZXJuOiBvcHRpb25zLnNob3VsZEdsb2JTZWFyY2hcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVJbmNsdWRlRXhjbHVkZShwYXR0ZXJuOiBzdHJpbmcgfCBzdHJpbmdbXSB8IHVuZGVmaW5lZCwgZXhwYW5kUGF0dGVybnM6IGJvb2xlYW4gfCB1bmRlZmluZWQpOiBJU2VhcmNoUGF0aHNJbmZvIHtcblx0XHRpZiAoIXBhdHRlcm4pIHtcblx0XHRcdHJldHVybiB7fTtcblx0XHR9XG5cblx0XHRpZiAoQXJyYXkuaXNBcnJheShwYXR0ZXJuKSkge1xuXHRcdFx0cGF0dGVybiA9IHBhdHRlcm4uZmlsdGVyKHAgPT4gcC5sZW5ndGggPiAwKS5tYXAobm9ybWFsaXplU2xhc2hlcyk7XG5cdFx0XHRpZiAoIXBhdHRlcm4ubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybiB7fTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0cGF0dGVybiA9IG5vcm1hbGl6ZVNsYXNoZXMocGF0dGVybik7XG5cdFx0fVxuXHRcdHJldHVybiBleHBhbmRQYXR0ZXJuc1xuXHRcdFx0PyB0aGlzLnBhcnNlU2VhcmNoUGF0aHMocGF0dGVybilcblx0XHRcdDogeyBwYXR0ZXJuOiBwYXR0ZXJuTGlzdFRvSUV4cHJlc3Npb24oLi4uKEFycmF5LmlzQXJyYXkocGF0dGVybikgPyBwYXR0ZXJuIDogW3BhdHRlcm5dKSkgfTtcblx0fVxuXG5cdHByaXZhdGUgY29tbW9uUXVlcnkoZm9sZGVyUmVzb3VyY2VzOiAoSVdvcmtzcGFjZUZvbGRlckRhdGEgfCBVUkkpW10gPSBbXSwgb3B0aW9uczogSUNvbW1vblF1ZXJ5QnVpbGRlck9wdGlvbnMgPSB7fSk6IElDb21tb25RdWVyeVByb3BzPHVyaT4ge1xuXG5cdFx0bGV0IGV4Y2x1ZGVQYXR0ZXJuczogc3RyaW5nIHwgc3RyaW5nW10gfCB1bmRlZmluZWQgPSBBcnJheS5pc0FycmF5KG9wdGlvbnMuZXhjbHVkZVBhdHRlcm4pID8gb3B0aW9ucy5leGNsdWRlUGF0dGVybi5tYXAocCA9PiBwLnBhdHRlcm4pLmZsYXQoKSA6IG9wdGlvbnMuZXhjbHVkZVBhdHRlcm47XG5cdFx0ZXhjbHVkZVBhdHRlcm5zID0gZXhjbHVkZVBhdHRlcm5zPy5sZW5ndGggPT09IDEgPyBleGNsdWRlUGF0dGVybnNbMF0gOiBleGNsdWRlUGF0dGVybnM7XG5cdFx0Y29uc3QgaW5jbHVkZVNlYXJjaFBhdGhzSW5mbzogSVNlYXJjaFBhdGhzSW5mbyA9IHRoaXMuaGFuZGxlSW5jbHVkZUV4Y2x1ZGUob3B0aW9ucy5pbmNsdWRlUGF0dGVybiwgb3B0aW9ucy5leHBhbmRQYXR0ZXJucyk7XG5cdFx0Y29uc3QgZXhjbHVkZVNlYXJjaFBhdGhzSW5mbzogSVNlYXJjaFBhdGhzSW5mbyA9IHRoaXMuaGFuZGxlSW5jbHVkZUV4Y2x1ZGUoZXhjbHVkZVBhdHRlcm5zLCBvcHRpb25zLmV4cGFuZFBhdHRlcm5zKTtcblxuXHRcdC8vIEJ1aWxkIGZvbGRlclF1ZXJpZXMgZnJvbSBzZWFyY2hQYXRocywgaWYgZ2l2ZW4sIG90aGVyd2lzZSBmb2xkZXJSZXNvdXJjZXNcblx0XHRjb25zdCBpbmNsdWRlRm9sZGVyTmFtZSA9IGZvbGRlclJlc291cmNlcy5sZW5ndGggPiAxO1xuXHRcdGNvbnN0IGZvbGRlclF1ZXJpZXMgPSAoaW5jbHVkZVNlYXJjaFBhdGhzSW5mby5zZWFyY2hQYXRocyAmJiBpbmNsdWRlU2VhcmNoUGF0aHNJbmZvLnNlYXJjaFBhdGhzLmxlbmd0aCA/XG5cdFx0XHRpbmNsdWRlU2VhcmNoUGF0aHNJbmZvLnNlYXJjaFBhdGhzLm1hcChzZWFyY2hQYXRoID0+IHRoaXMuZ2V0Rm9sZGVyUXVlcnlGb3JTZWFyY2hQYXRoKHNlYXJjaFBhdGgsIG9wdGlvbnMsIGV4Y2x1ZGVTZWFyY2hQYXRoc0luZm8pKSA6XG5cdFx0XHRmb2xkZXJSZXNvdXJjZXMubWFwKGZvbGRlciA9PiB0aGlzLmdldEZvbGRlclF1ZXJ5Rm9yUm9vdChmb2xkZXIsIG9wdGlvbnMsIGV4Y2x1ZGVTZWFyY2hQYXRoc0luZm8sIGluY2x1ZGVGb2xkZXJOYW1lKSkpXG5cdFx0XHQuZmlsdGVyKHF1ZXJ5ID0+ICEhcXVlcnkpIGFzIElGb2xkZXJRdWVyeVtdO1xuXG5cdFx0Y29uc3QgcXVlcnlQcm9wczogSUNvbW1vblF1ZXJ5UHJvcHM8dXJpPiA9IHtcblx0XHRcdF9yZWFzb246IG9wdGlvbnMuX3JlYXNvbixcblx0XHRcdGZvbGRlclF1ZXJpZXMsXG5cdFx0XHR1c2luZ1NlYXJjaFBhdGhzOiAhIShpbmNsdWRlU2VhcmNoUGF0aHNJbmZvLnNlYXJjaFBhdGhzICYmIGluY2x1ZGVTZWFyY2hQYXRoc0luZm8uc2VhcmNoUGF0aHMubGVuZ3RoKSxcblx0XHRcdGV4dHJhRmlsZVJlc291cmNlczogb3B0aW9ucy5leHRyYUZpbGVSZXNvdXJjZXMsXG5cblx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiBleGNsdWRlU2VhcmNoUGF0aHNJbmZvLnBhdHRlcm4sXG5cdFx0XHRpbmNsdWRlUGF0dGVybjogaW5jbHVkZVNlYXJjaFBhdGhzSW5mby5wYXR0ZXJuLFxuXHRcdFx0b25seU9wZW5FZGl0b3JzOiBvcHRpb25zLm9ubHlPcGVuRWRpdG9ycyxcblx0XHRcdG1heFJlc3VsdHM6IG9wdGlvbnMubWF4UmVzdWx0cyxcblx0XHRcdG9ubHlGaWxlU2NoZW1lOiBvcHRpb25zLm9ubHlGaWxlU2NoZW1lXG5cdFx0fTtcblxuXHRcdGlmIChvcHRpb25zLm9ubHlPcGVuRWRpdG9ycykge1xuXHRcdFx0Y29uc3Qgb3BlbkVkaXRvcnMgPSBhcnJheXMuY29hbGVzY2UodGhpcy5lZGl0b3JHcm91cHNTZXJ2aWNlLmdyb3Vwcy5mbGF0TWFwKGdyb3VwID0+IGdyb3VwLmVkaXRvcnMubWFwKGVkaXRvciA9PiBlZGl0b3IucmVzb3VyY2UpKSk7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ1F1ZXJ5QnVpbGRlciNjb21tb25RdWVyeSAtIG9wZW5FZGl0b3IgVVJJcycsIEpTT04uc3RyaW5naWZ5KG9wZW5FZGl0b3JzKSk7XG5cdFx0XHRjb25zdCBvcGVuRWRpdG9yc0luUXVlcnkgPSBvcGVuRWRpdG9ycy5maWx0ZXIoZWRpdG9yID0+IHBhdGhJbmNsdWRlZEluUXVlcnkocXVlcnlQcm9wcywgZWRpdG9yLmZzUGF0aCkpO1xuXHRcdFx0Y29uc3Qgb3BlbkVkaXRvcnNRdWVyeVByb3BzID0gdGhpcy5jb21tb25RdWVyeUZyb21GaWxlTGlzdChvcGVuRWRpdG9yc0luUXVlcnkpO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdRdWVyeUJ1aWxkZXIjY29tbW9uUXVlcnkgLSBvcGVuRWRpdG9yIFF1ZXJ5JywgSlNPTi5zdHJpbmdpZnkob3BlbkVkaXRvcnNRdWVyeVByb3BzKSk7XG5cdFx0XHRyZXR1cm4geyAuLi5xdWVyeVByb3BzLCAuLi5vcGVuRWRpdG9yc1F1ZXJ5UHJvcHMgfTtcblx0XHR9XG5cblx0XHQvLyBGaWx0ZXIgZXh0cmFGaWxlUmVzb3VyY2VzIGFnYWluc3QgZ2xvYmFsIGluY2x1ZGUvZXhjbHVkZSBwYXR0ZXJucyAtIHRoZXkgYXJlIGFscmVhZHkgZXhwZWN0ZWQgdG8gbm90IGJlbG9uZyB0byBhIHdvcmtzcGFjZVxuXHRcdGNvbnN0IGV4dHJhRmlsZVJlc291cmNlcyA9IG9wdGlvbnMuZXh0cmFGaWxlUmVzb3VyY2VzICYmIG9wdGlvbnMuZXh0cmFGaWxlUmVzb3VyY2VzLmZpbHRlcihleHRyYUZpbGUgPT4gcGF0aEluY2x1ZGVkSW5RdWVyeShxdWVyeVByb3BzLCBleHRyYUZpbGUuZnNQYXRoKSk7XG5cdFx0cXVlcnlQcm9wcy5leHRyYUZpbGVSZXNvdXJjZXMgPSBleHRyYUZpbGVSZXNvdXJjZXMgJiYgZXh0cmFGaWxlUmVzb3VyY2VzLmxlbmd0aCA/IGV4dHJhRmlsZVJlc291cmNlcyA6IHVuZGVmaW5lZDtcblxuXHRcdHJldHVybiBxdWVyeVByb3BzO1xuXHR9XG5cblx0cHJpdmF0ZSBjb21tb25RdWVyeUZyb21GaWxlTGlzdChmaWxlczogVVJJW10pOiBJQ29tbW9uUXVlcnlQcm9wczxVUkk+IHtcblx0XHRjb25zdCBmb2xkZXJRdWVyaWVzOiBJRm9sZGVyUXVlcnlbXSA9IFtdO1xuXHRcdGNvbnN0IGZvbGRlcnNUb1NlYXJjaDogUmVzb3VyY2VNYXA8SUZvbGRlclF1ZXJ5PiA9IG5ldyBSZXNvdXJjZU1hcCgpO1xuXHRcdGNvbnN0IGluY2x1ZGVQYXR0ZXJuOiBnbG9iLklFeHByZXNzaW9uID0ge307XG5cdFx0bGV0IGhhc0luY2x1ZGVkRmlsZSA9IGZhbHNlO1xuXHRcdGZpbGVzLmZvckVhY2goZmlsZSA9PiB7XG5cdFx0XHRpZiAoZmlsZS5zY2hlbWUgPT09IFNjaGVtYXMud2Fsa1Rocm91Z2gpIHsgcmV0dXJuOyB9XG5cblx0XHRcdGNvbnN0IHByb3ZpZGVyRXhpc3RzID0gaXNBYnNvbHV0ZVBhdGgoZmlsZSk7XG5cdFx0XHQvLyBTcGVjaWFsIGNhc2UgdXNlcmRhdGEgYXMgd2UgZG9uJ3QgaGF2ZSBhIHNlYXJjaCBwcm92aWRlciBmb3IgaXQsIGJ1dCBpdCBjYW4gYmUgc2VhcmNoZWQuXG5cdFx0XHRpZiAocHJvdmlkZXJFeGlzdHMpIHtcblxuXHRcdFx0XHRjb25zdCBzZWFyY2hSb290ID0gdGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2VGb2xkZXIoZmlsZSk/LnVyaSA/PyB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuZGlybmFtZShmaWxlKTtcblxuXHRcdFx0XHRsZXQgZm9sZGVyUXVlcnkgPSBmb2xkZXJzVG9TZWFyY2guZ2V0KHNlYXJjaFJvb3QpO1xuXHRcdFx0XHRpZiAoIWZvbGRlclF1ZXJ5KSB7XG5cdFx0XHRcdFx0aGFzSW5jbHVkZWRGaWxlID0gdHJ1ZTtcblx0XHRcdFx0XHRmb2xkZXJRdWVyeSA9IHsgZm9sZGVyOiBzZWFyY2hSb290LCBpbmNsdWRlUGF0dGVybjoge30gfTtcblx0XHRcdFx0XHRmb2xkZXJRdWVyaWVzLnB1c2goZm9sZGVyUXVlcnkpO1xuXHRcdFx0XHRcdGZvbGRlcnNUb1NlYXJjaC5zZXQoc2VhcmNoUm9vdCwgZm9sZGVyUXVlcnkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmVsUGF0aCA9IHBhdGgucmVsYXRpdmUoc2VhcmNoUm9vdC5mc1BhdGgsIGZpbGUuZnNQYXRoKTtcblx0XHRcdFx0YXNzZXJ0SXNEZWZpbmVkKGZvbGRlclF1ZXJ5LmluY2x1ZGVQYXR0ZXJuKVtyZWxQYXRoLnJlcGxhY2UoL1xcXFwvZywgJy8nKV0gPSB0cnVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGZpbGUuZnNQYXRoKSB7XG5cdFx0XHRcdFx0aGFzSW5jbHVkZWRGaWxlID0gdHJ1ZTtcblx0XHRcdFx0XHRpbmNsdWRlUGF0dGVybltmaWxlLmZzUGF0aF0gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Zm9sZGVyUXVlcmllcyxcblx0XHRcdGluY2x1ZGVQYXR0ZXJuLFxuXHRcdFx0dXNpbmdTZWFyY2hQYXRoczogdHJ1ZSxcblx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiBoYXNJbmNsdWRlZEZpbGUgPyB1bmRlZmluZWQgOiB7ICcqKi8qJzogdHJ1ZSB9XG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXNvbHZlIGlzQ2FzZVNlbnNpdGl2ZSBmbGFnIGJhc2VkIG9uIHRoZSBxdWVyeSBhbmQgdGhlIGlzU21hcnRDYXNlIGZsYWcsIGZvciBzZWFyY2ggcHJvdmlkZXJzIHRoYXQgZG9uJ3Qgc3VwcG9ydCBzbWFydCBjYXNlIG5hdGl2ZWx5LlxuXHQgKi9cblx0cHJpdmF0ZSBpc0Nhc2VTZW5zaXRpdmUoY29udGVudFBhdHRlcm46IElQYXR0ZXJuSW5mbywgb3B0aW9uczogSVRleHRRdWVyeUJ1aWxkZXJPcHRpb25zKTogYm9vbGVhbiB7XG5cdFx0aWYgKG9wdGlvbnMuaXNTbWFydENhc2UpIHtcblx0XHRcdGlmIChjb250ZW50UGF0dGVybi5pc1JlZ0V4cCkge1xuXHRcdFx0XHQvLyBDb25zaWRlciBpdCBjYXNlIHNlbnNpdGl2ZSBpZiBpdCBjb250YWlucyBhbiB1bmVzY2FwZWQgY2FwaXRhbCBsZXR0ZXJcblx0XHRcdFx0aWYgKHN0cmluZ3MuY29udGFpbnNVcHBlcmNhc2VDaGFyYWN0ZXIoY29udGVudFBhdHRlcm4ucGF0dGVybiwgdHJ1ZSkpIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChzdHJpbmdzLmNvbnRhaW5zVXBwZXJjYXNlQ2hhcmFjdGVyKGNvbnRlbnRQYXR0ZXJuLnBhdHRlcm4pKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiAhIWNvbnRlbnRQYXR0ZXJuLmlzQ2FzZVNlbnNpdGl2ZTtcblx0fVxuXG5cdHByaXZhdGUgaXNNdWx0aWxpbmUoY29udGVudFBhdHRlcm46IElQYXR0ZXJuSW5mbyk6IGJvb2xlYW4ge1xuXHRcdGlmIChjb250ZW50UGF0dGVybi5pc011bHRpbGluZSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbnRlbnRQYXR0ZXJuLmlzUmVnRXhwICYmIGlzTXVsdGlsaW5lUmVnZXhTb3VyY2UoY29udGVudFBhdHRlcm4ucGF0dGVybikpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChjb250ZW50UGF0dGVybi5wYXR0ZXJuLmluZGV4T2YoJ1xcbicpID49IDApIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiAhIWNvbnRlbnRQYXR0ZXJuLmlzTXVsdGlsaW5lO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRha2UgdGhlIGluY2x1ZGVQYXR0ZXJuIGFzIHNlZW4gaW4gdGhlIHNlYXJjaCB2aWV3bGV0LCBhbmQgc3BsaXQgaW50byBjb21wb25lbnRzIHRoYXQgbG9vayBsaWtlIHNlYXJjaFBhdGhzLCBhbmRcblx0ICogZ2xvYiBwYXR0ZXJucy4gR2xvYiBwYXR0ZXJucyBhcmUgZXhwYW5kZWQgZnJvbSAnZm9vL2JhcicgdG8gJ3tmb28vYmFyLyoqLCAqKlxcL2Zvby9iYXJ9LlxuXHQgKlxuXHQgKiBQdWJsaWMgZm9yIHRlc3QuXG5cdCAqL1xuXHRwYXJzZVNlYXJjaFBhdGhzKHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdKTogSVNlYXJjaFBhdGhzSW5mbyB7XG5cdFx0Y29uc3QgaXNTZWFyY2hQYXRoID0gKHNlZ21lbnQ6IHN0cmluZykgPT4ge1xuXHRcdFx0Ly8gQSBzZWdtZW50IGlzIGEgc2VhcmNoIHBhdGggaWYgaXQgaXMgYW4gYWJzb2x1dGUgcGF0aCBvciBzdGFydHMgd2l0aCAuLywgLi4vLCAuXFwsIG9yIC4uXFxcblx0XHRcdHJldHVybiBwYXRoLmlzQWJzb2x1dGUoc2VnbWVudCkgfHwgL15cXC5cXC4/KFtcXC9cXFxcXXwkKS8udGVzdChzZWdtZW50KTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgcGF0dGVybnMgPSBBcnJheS5pc0FycmF5KHBhdHRlcm4pID8gcGF0dGVybiA6IHNwbGl0R2xvYlBhdHRlcm4ocGF0dGVybik7XG5cdFx0Y29uc3Qgc2VnbWVudHMgPSBwYXR0ZXJuc1xuXHRcdFx0Lm1hcChzZWdtZW50ID0+IHtcblx0XHRcdFx0Y29uc3QgdXNlckhvbWUgPSB0aGlzLnBhdGhTZXJ2aWNlLnJlc29sdmVkVXNlckhvbWU7XG5cdFx0XHRcdGlmICh1c2VySG9tZSkge1xuXHRcdFx0XHRcdHJldHVybiB1bnRpbGRpZnkoc2VnbWVudCwgdXNlckhvbWUuc2NoZW1lID09PSBTY2hlbWFzLmZpbGUgPyB1c2VySG9tZS5mc1BhdGggOiB1c2VySG9tZS5wYXRoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBzZWdtZW50O1xuXHRcdFx0fSk7XG5cdFx0Y29uc3QgZ3JvdXBzID0gY29sbGVjdGlvbnMuZ3JvdXBCeShzZWdtZW50cyxcblx0XHRcdHNlZ21lbnQgPT4gaXNTZWFyY2hQYXRoKHNlZ21lbnQpID8gJ3NlYXJjaFBhdGhzJyA6ICdleHByU2VnbWVudHMnKTtcblxuXHRcdGNvbnN0IGV4cGFuZGVkRXhwclNlZ21lbnRzID0gKGdyb3Vwcy5leHByU2VnbWVudHMgfHwgW10pXG5cdFx0XHQubWFwKHMgPT4gc3RyaW5ncy5ydHJpbShzLCAnLycpKVxuXHRcdFx0Lm1hcChzID0+IHN0cmluZ3MucnRyaW0ocywgJ1xcXFwnKSlcblx0XHRcdC5tYXAocCA9PiB7XG5cdFx0XHRcdGlmIChwWzBdID09PSAnLicpIHtcblx0XHRcdFx0XHRwID0gJyonICsgcDsgLy8gY29udmVydCBcIi5qc1wiIHRvIFwiKi5qc1wiXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZXhwYW5kR2xvYmFsR2xvYihwKTtcblx0XHRcdH0pO1xuXG5cdFx0Y29uc3QgcmVzdWx0OiBJU2VhcmNoUGF0aHNJbmZvID0ge307XG5cdFx0Y29uc3Qgc2VhcmNoUGF0aHMgPSB0aGlzLmV4cGFuZFNlYXJjaFBhdGhQYXR0ZXJucyhncm91cHMuc2VhcmNoUGF0aHMgfHwgW10pO1xuXHRcdGlmIChzZWFyY2hQYXRocyAmJiBzZWFyY2hQYXRocy5sZW5ndGgpIHtcblx0XHRcdHJlc3VsdC5zZWFyY2hQYXRocyA9IHNlYXJjaFBhdGhzO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4cHJTZWdtZW50cyA9IGV4cGFuZGVkRXhwclNlZ21lbnRzLmZsYXQoKTtcblx0XHRjb25zdCBpbmNsdWRlUGF0dGVybiA9IHBhdHRlcm5MaXN0VG9JRXhwcmVzc2lvbiguLi5leHByU2VnbWVudHMpO1xuXHRcdGlmIChpbmNsdWRlUGF0dGVybikge1xuXHRcdFx0cmVzdWx0LnBhdHRlcm4gPSBpbmNsdWRlUGF0dGVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRFeGNsdWRlc0ZvckZvbGRlcihmb2xkZXJDb25maWc6IElTZWFyY2hDb25maWd1cmF0aW9uLCBvcHRpb25zOiBJQ29tbW9uUXVlcnlCdWlsZGVyT3B0aW9ucyk6IGdsb2IuSUV4cHJlc3Npb24gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBvcHRpb25zLmRpc3JlZ2FyZEV4Y2x1ZGVTZXR0aW5ncyA/XG5cdFx0XHR1bmRlZmluZWQgOlxuXHRcdFx0Z2V0RXhjbHVkZXMoZm9sZGVyQ29uZmlnLCAhb3B0aW9ucy5kaXNyZWdhcmRTZWFyY2hFeGNsdWRlU2V0dGluZ3MpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNwbGl0IHNlYXJjaCBwYXRocyAoLi8gb3IgLi4vIG9yIGFic29sdXRlIHBhdGhzIGluIHRoZSBpbmNsdWRlUGF0dGVybnMpIGludG8gYWJzb2x1dGUgcGF0aHMgYW5kIGdsb2JzIGFwcGxpZWQgdG8gdGhvc2UgcGF0aHNcblx0ICovXG5cdHByaXZhdGUgZXhwYW5kU2VhcmNoUGF0aFBhdHRlcm5zKHNlYXJjaFBhdGhzOiBzdHJpbmdbXSk6IElTZWFyY2hQYXRoUGF0dGVybltdIHtcblx0XHRpZiAoIXNlYXJjaFBhdGhzIHx8ICFzZWFyY2hQYXRocy5sZW5ndGgpIHtcblx0XHRcdC8vIE5vIHdvcmtzcGFjZSA9PiBpZ25vcmUgc2VhcmNoIHBhdGhzXG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXhwYW5kZWRTZWFyY2hQYXRocyA9IHNlYXJjaFBhdGhzLmZsYXRNYXAoc2VhcmNoUGF0aCA9PiB7XG5cdFx0XHQvLyAxIG9wZW4gZm9sZGVyID0+IGp1c3QgcmVzb2x2ZSB0aGUgc2VhcmNoIHBhdGhzIHRvIGFic29sdXRlIHBhdGhzXG5cdFx0XHRsZXQgeyBwYXRoUG9ydGlvbiwgZ2xvYlBvcnRpb24gfSA9IHNwbGl0R2xvYkZyb21QYXRoKHNlYXJjaFBhdGgpO1xuXG5cdFx0XHRpZiAoZ2xvYlBvcnRpb24pIHtcblx0XHRcdFx0Z2xvYlBvcnRpb24gPSBub3JtYWxpemVHbG9iUGF0dGVybihnbG9iUG9ydGlvbik7XG5cdFx0XHR9XG5cblx0XHRcdC8vIE9uZSBwYXRoUG9ydGlvbiB0byBtdWx0aXBsZSBleHBhbmRlZCBzZWFyY2ggcGF0aHMgKGUuZy4gZHVwbGljYXRlIG1hdGNoaW5nIHdvcmtzcGFjZSBmb2xkZXJzKVxuXHRcdFx0Y29uc3Qgb25lRXhwYW5kZWQgPSB0aGlzLmV4cGFuZE9uZVNlYXJjaFBhdGgocGF0aFBvcnRpb24pO1xuXG5cdFx0XHQvLyBFeHBhbmRlZCBzZWFyY2ggcGF0aHMgdG8gbXVsdGlwbGUgcmVzb2x2ZWQgcGF0dGVybnMgKHdpdGggKiogYW5kIHdpdGhvdXQpXG5cdFx0XHRyZXR1cm4gb25lRXhwYW5kZWQuZmxhdE1hcChvbmVFeHBhbmRlZFJlc3VsdCA9PiB0aGlzLnJlc29sdmVPbmVTZWFyY2hQYXRoUGF0dGVybihvbmVFeHBhbmRlZFJlc3VsdCwgZ2xvYlBvcnRpb24pKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IHNlYXJjaFBhdGhQYXR0ZXJuTWFwID0gbmV3IE1hcDxzdHJpbmcsIElTZWFyY2hQYXRoUGF0dGVybj4oKTtcblx0XHRleHBhbmRlZFNlYXJjaFBhdGhzLmZvckVhY2gob25lU2VhcmNoUGF0aFBhdHRlcm4gPT4ge1xuXHRcdFx0Y29uc3Qga2V5ID0gb25lU2VhcmNoUGF0aFBhdHRlcm4uc2VhcmNoUGF0aC50b1N0cmluZygpO1xuXHRcdFx0Y29uc3QgZXhpc3RpbmcgPSBzZWFyY2hQYXRoUGF0dGVybk1hcC5nZXQoa2V5KTtcblx0XHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0XHRpZiAob25lU2VhcmNoUGF0aFBhdHRlcm4ucGF0dGVybikge1xuXHRcdFx0XHRcdGV4aXN0aW5nLnBhdHRlcm4gPSBleGlzdGluZy5wYXR0ZXJuIHx8IHt9O1xuXHRcdFx0XHRcdGV4aXN0aW5nLnBhdHRlcm5bb25lU2VhcmNoUGF0aFBhdHRlcm4ucGF0dGVybl0gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzZWFyY2hQYXRoUGF0dGVybk1hcC5zZXQoa2V5LCB7XG5cdFx0XHRcdFx0c2VhcmNoUGF0aDogb25lU2VhcmNoUGF0aFBhdHRlcm4uc2VhcmNoUGF0aCxcblx0XHRcdFx0XHRwYXR0ZXJuOiBvbmVTZWFyY2hQYXRoUGF0dGVybi5wYXR0ZXJuID8gcGF0dGVybkxpc3RUb0lFeHByZXNzaW9uKG9uZVNlYXJjaFBhdGhQYXR0ZXJuLnBhdHRlcm4pIDogdW5kZWZpbmVkXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIEFycmF5LmZyb20oc2VhcmNoUGF0aFBhdHRlcm5NYXAudmFsdWVzKCkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRha2VzIGEgc2VhcmNoUGF0aCBsaWtlIGAuL2EvZm9vYCBvciBgLi4vYS9mb29gIGFuZCBleHBhbmRzIGl0IHRvIGFic29sdXRlIHBhdGhzIGZvciBhbGwgdGhlIHdvcmtzcGFjZXMgaXQgbWF0Y2hlcy5cblx0ICovXG5cdHByaXZhdGUgZXhwYW5kT25lU2VhcmNoUGF0aChzZWFyY2hQYXRoOiBzdHJpbmcpOiBJT25lU2VhcmNoUGF0aFBhdHRlcm5bXSB7XG5cdFx0aWYgKHBhdGguaXNBYnNvbHV0ZShzZWFyY2hQYXRoKSkge1xuXHRcdFx0Y29uc3Qgd29ya3NwYWNlRm9sZGVycyA9IHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycztcblx0XHRcdGlmICh3b3Jrc3BhY2VGb2xkZXJzWzBdICYmIHdvcmtzcGFjZUZvbGRlcnNbMF0udXJpLnNjaGVtZSAhPT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRcdHJldHVybiBbe1xuXHRcdFx0XHRcdHNlYXJjaFBhdGg6IHdvcmtzcGFjZUZvbGRlcnNbMF0udXJpLndpdGgoeyBwYXRoOiBzZWFyY2hQYXRoIH0pXG5cdFx0XHRcdH1dO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBDdXJyZW50bHkgb25seSBsb2NhbCByZXNvdXJjZXMgY2FuIGJlIHNlYXJjaGVkIGZvciB3aXRoIGFic29sdXRlIHNlYXJjaCBwYXRocy5cblx0XHRcdC8vIFRPRE8gY29udmVydCB0aGlzIHRvIGEgd29ya3NwYWNlIGZvbGRlciArIHBhdHRlcm4sIHNvIGV4Y2x1ZGVzIHdpbGwgYmUgcmVzb2x2ZWQgcHJvcGVybHkgZm9yIGFuIGFic29sdXRlIHBhdGggaW5zaWRlIGEgd29ya3NwYWNlIGZvbGRlclxuXHRcdFx0cmV0dXJuIFt7XG5cdFx0XHRcdHNlYXJjaFBhdGg6IHVyaS5maWxlKHBhdGgubm9ybWFsaXplKHNlYXJjaFBhdGgpKVxuXHRcdFx0fV07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuRk9MREVSKSB7XG5cdFx0XHRjb25zdCB3b3Jrc3BhY2VVcmkgPSB0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnNbMF0udXJpO1xuXG5cdFx0XHRzZWFyY2hQYXRoID0gbm9ybWFsaXplU2xhc2hlcyhzZWFyY2hQYXRoKTtcblx0XHRcdGlmIChzZWFyY2hQYXRoLnN0YXJ0c1dpdGgoJy4uLycpIHx8IHNlYXJjaFBhdGggPT09ICcuLicpIHtcblx0XHRcdFx0Y29uc3QgcmVzb2x2ZWRQYXRoID0gcGF0aC5wb3NpeC5yZXNvbHZlKHdvcmtzcGFjZVVyaS5wYXRoLCBzZWFyY2hQYXRoKTtcblx0XHRcdFx0cmV0dXJuIFt7XG5cdFx0XHRcdFx0c2VhcmNoUGF0aDogd29ya3NwYWNlVXJpLndpdGgoeyBwYXRoOiByZXNvbHZlZFBhdGggfSlcblx0XHRcdFx0fV07XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNsZWFuZWRQYXR0ZXJuID0gbm9ybWFsaXplR2xvYlBhdHRlcm4oc2VhcmNoUGF0aCk7XG5cdFx0XHRyZXR1cm4gW3tcblx0XHRcdFx0c2VhcmNoUGF0aDogd29ya3NwYWNlVXJpLFxuXHRcdFx0XHRwYXR0ZXJuOiBjbGVhbmVkUGF0dGVyblxuXHRcdFx0fV07XG5cdFx0fSBlbHNlIGlmIChzZWFyY2hQYXRoID09PSAnLi8nIHx8IHNlYXJjaFBhdGggPT09ICcuXFxcXCcpIHtcblx0XHRcdHJldHVybiBbXTsgLy8gLi8gb3IgLi8qKi9mb28gbWFrZXMgc2Vuc2UgZm9yIHNpbmdsZS1mb2xkZXIgYnV0IG5vdCBtdWx0aS1mb2xkZXIgd29ya3NwYWNlc1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBzZWFyY2hQYXRoV2l0aG91dERvdFNsYXNoID0gc2VhcmNoUGF0aC5yZXBsYWNlKC9eXFwuW1xcL1xcXFxdLywgJycpO1xuXHRcdFx0Y29uc3QgZm9sZGVycyA9IHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycztcblx0XHRcdGNvbnN0IGZvbGRlck1hdGNoZXMgPSBmb2xkZXJzLm1hcChmb2xkZXIgPT4ge1xuXHRcdFx0XHRjb25zdCBtYXRjaCA9IHNlYXJjaFBhdGhXaXRob3V0RG90U2xhc2gubWF0Y2gobmV3IFJlZ0V4cChgXiR7c3RyaW5ncy5lc2NhcGVSZWdFeHBDaGFyYWN0ZXJzKGZvbGRlci5uYW1lKX0oPzovKC4qKXwkKWApKTtcblx0XHRcdFx0cmV0dXJuIG1hdGNoID8ge1xuXHRcdFx0XHRcdG1hdGNoLFxuXHRcdFx0XHRcdGZvbGRlclxuXHRcdFx0XHR9IDogbnVsbDtcblx0XHRcdH0pLmZpbHRlcihpc0RlZmluZWQpO1xuXG5cdFx0XHRpZiAoZm9sZGVyTWF0Y2hlcy5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuIGZvbGRlck1hdGNoZXMubWFwKG1hdGNoID0+IHtcblx0XHRcdFx0XHRjb25zdCBwYXR0ZXJuTWF0Y2ggPSBtYXRjaC5tYXRjaFsxXTtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0c2VhcmNoUGF0aDogbWF0Y2guZm9sZGVyLnVyaSxcblx0XHRcdFx0XHRcdHBhdHRlcm46IHBhdHRlcm5NYXRjaCAmJiBub3JtYWxpemVHbG9iUGF0dGVybihwYXR0ZXJuTWF0Y2gpXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBwcm9iYWJsZVdvcmtzcGFjZUZvbGRlck5hbWVNYXRjaCA9IHNlYXJjaFBhdGgubWF0Y2goL1xcLltcXC9cXFxcXSguKylbXFwvXFxcXF0/Lyk7XG5cdFx0XHRcdGNvbnN0IHByb2JhYmxlV29ya3NwYWNlRm9sZGVyTmFtZSA9IHByb2JhYmxlV29ya3NwYWNlRm9sZGVyTmFtZU1hdGNoID8gcHJvYmFibGVXb3Jrc3BhY2VGb2xkZXJOYW1lTWF0Y2hbMV0gOiBzZWFyY2hQYXRoO1xuXG5cdFx0XHRcdC8vIE5vIHJvb3QgZm9sZGVyIHdpdGggbmFtZVxuXHRcdFx0XHRjb25zdCBzZWFyY2hQYXRoTm90Rm91bmRFcnJvciA9IG5scy5sb2NhbGl6ZSgnc2VhcmNoLm5vV29ya3NwYWNlV2l0aE5hbWUnLCBcIldvcmtzcGFjZSBmb2xkZXIgZG9lcyBub3QgZXhpc3Q6IHswfVwiLCBwcm9iYWJsZVdvcmtzcGFjZUZvbGRlck5hbWUpO1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3Ioc2VhcmNoUGF0aE5vdEZvdW5kRXJyb3IpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVzb2x2ZU9uZVNlYXJjaFBhdGhQYXR0ZXJuKG9uZUV4cGFuZGVkUmVzdWx0OiBJT25lU2VhcmNoUGF0aFBhdHRlcm4sIGdsb2JQb3J0aW9uPzogc3RyaW5nKTogSU9uZVNlYXJjaFBhdGhQYXR0ZXJuW10ge1xuXHRcdGNvbnN0IHBhdHRlcm4gPSBvbmVFeHBhbmRlZFJlc3VsdC5wYXR0ZXJuICYmIGdsb2JQb3J0aW9uID9cblx0XHRcdGAke29uZUV4cGFuZGVkUmVzdWx0LnBhdHRlcm59LyR7Z2xvYlBvcnRpb259YCA6XG5cdFx0XHRvbmVFeHBhbmRlZFJlc3VsdC5wYXR0ZXJuIHx8IGdsb2JQb3J0aW9uO1xuXG5cdFx0Y29uc3QgcmVzdWx0cyA9IFtcblx0XHRcdHtcblx0XHRcdFx0c2VhcmNoUGF0aDogb25lRXhwYW5kZWRSZXN1bHQuc2VhcmNoUGF0aCxcblx0XHRcdFx0cGF0dGVyblxuXHRcdFx0fV07XG5cblx0XHRpZiAocGF0dGVybiAmJiAhcGF0dGVybi5lbmRzV2l0aCgnKionKSkge1xuXHRcdFx0cmVzdWx0cy5wdXNoKHtcblx0XHRcdFx0c2VhcmNoUGF0aDogb25lRXhwYW5kZWRSZXN1bHQuc2VhcmNoUGF0aCxcblx0XHRcdFx0cGF0dGVybjogcGF0dGVybiArICcvKionXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0cztcblx0fVxuXG5cdHByaXZhdGUgZ2V0Rm9sZGVyUXVlcnlGb3JTZWFyY2hQYXRoKHNlYXJjaFBhdGg6IElTZWFyY2hQYXRoUGF0dGVybiwgb3B0aW9uczogSUNvbW1vblF1ZXJ5QnVpbGRlck9wdGlvbnMsIHNlYXJjaFBhdGhFeGNsdWRlczogSVNlYXJjaFBhdGhzSW5mbyk6IElGb2xkZXJRdWVyeSB8IG51bGwge1xuXHRcdGNvbnN0IHJvb3RDb25maWcgPSB0aGlzLmdldEZvbGRlclF1ZXJ5Rm9yUm9vdCh0b1dvcmtzcGFjZUZvbGRlcihzZWFyY2hQYXRoLnNlYXJjaFBhdGgpLCBvcHRpb25zLCBzZWFyY2hQYXRoRXhjbHVkZXMsIGZhbHNlKTtcblx0XHRpZiAoIXJvb3RDb25maWcpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHQuLi5yb290Q29uZmlnLFxuXHRcdFx0Li4ue1xuXHRcdFx0XHRpbmNsdWRlUGF0dGVybjogc2VhcmNoUGF0aC5wYXR0ZXJuXG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Rm9sZGVyUXVlcnlGb3JSb290KGZvbGRlcjogKElXb3Jrc3BhY2VGb2xkZXJEYXRhIHwgVVJJKSwgb3B0aW9uczogSUNvbW1vblF1ZXJ5QnVpbGRlck9wdGlvbnMsIHNlYXJjaFBhdGhFeGNsdWRlczogSVNlYXJjaFBhdGhzSW5mbywgaW5jbHVkZUZvbGRlck5hbWU6IGJvb2xlYW4pOiBJRm9sZGVyUXVlcnkgfCBudWxsIHtcblx0XHRsZXQgdGhpc0ZvbGRlckV4Y2x1ZGVTZWFyY2hQYXRoUGF0dGVybjogZ2xvYi5JRXhwcmVzc2lvbiB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBmb2xkZXJVcmkgPSBVUkkuaXNVcmkoZm9sZGVyKSA/IGZvbGRlciA6IGZvbGRlci51cmk7XG5cblx0XHQvLyBvbmx5IHVzZSBleGNsdWRlIHJvb3QgaWYgaXQgaXMgZGlmZmVyZW50IGZyb20gdGhlIGZvbGRlciByb290XG5cdFx0bGV0IGV4Y2x1ZGVGb2xkZXJSb290cyA9IG9wdGlvbnMuZXhjbHVkZVBhdHRlcm4/Lm1hcChleGNsdWRlUGF0dGVybiA9PiB7XG5cdFx0XHRjb25zdCBleGNsdWRlUm9vdCA9IG9wdGlvbnMuZXhjbHVkZVBhdHRlcm4gJiYgaXNJU2VhcmNoUGF0dGVybkJ1aWxkZXIoZXhjbHVkZVBhdHRlcm4pID8gZXhjbHVkZVBhdHRlcm4udXJpIDogdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3Qgc2hvdWxkVXNlRXhjbHVkZVJvb3QgPSAoIWV4Y2x1ZGVSb290IHx8ICEoVVJJLmlzVXJpKGZvbGRlcikgJiYgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoZm9sZGVyLCBleGNsdWRlUm9vdCkpKTtcblx0XHRcdHJldHVybiBzaG91bGRVc2VFeGNsdWRlUm9vdCA/IGV4Y2x1ZGVSb290IDogdW5kZWZpbmVkO1xuXHRcdH0pO1xuXG5cdFx0aWYgKCFleGNsdWRlRm9sZGVyUm9vdHM/Lmxlbmd0aCkge1xuXHRcdFx0ZXhjbHVkZUZvbGRlclJvb3RzID0gW3VuZGVmaW5lZF07XG5cdFx0fVxuXG5cdFx0aWYgKHNlYXJjaFBhdGhFeGNsdWRlcy5zZWFyY2hQYXRocykge1xuXHRcdFx0Y29uc3QgdGhpc0ZvbGRlckV4Y2x1ZGVTZWFyY2hQYXRoID0gc2VhcmNoUGF0aEV4Y2x1ZGVzLnNlYXJjaFBhdGhzLmZpbHRlcihzcCA9PiBpc0VxdWFsKHNwLnNlYXJjaFBhdGgsIGZvbGRlclVyaSkpWzBdO1xuXHRcdFx0aWYgKHRoaXNGb2xkZXJFeGNsdWRlU2VhcmNoUGF0aCAmJiAhdGhpc0ZvbGRlckV4Y2x1ZGVTZWFyY2hQYXRoLnBhdHRlcm4pIHtcblx0XHRcdFx0Ly8gZW50aXJlIGZvbGRlciBpcyBleGNsdWRlZFxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH0gZWxzZSBpZiAodGhpc0ZvbGRlckV4Y2x1ZGVTZWFyY2hQYXRoKSB7XG5cdFx0XHRcdHRoaXNGb2xkZXJFeGNsdWRlU2VhcmNoUGF0aFBhdHRlcm4gPSB0aGlzRm9sZGVyRXhjbHVkZVNlYXJjaFBhdGgucGF0dGVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBmb2xkZXJDb25maWcgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElTZWFyY2hDb25maWd1cmF0aW9uPih7IHJlc291cmNlOiBmb2xkZXJVcmkgfSk7XG5cdFx0Y29uc3Qgc2V0dGluZ0V4Y2x1ZGVzID0gdGhpcy5nZXRFeGNsdWRlc0ZvckZvbGRlcihmb2xkZXJDb25maWcsIG9wdGlvbnMpO1xuXHRcdGNvbnN0IGV4Y2x1ZGVQYXR0ZXJuOiBnbG9iLklFeHByZXNzaW9uID0ge1xuXHRcdFx0Li4uKHNldHRpbmdFeGNsdWRlcyB8fCB7fSksXG5cdFx0XHQuLi4odGhpc0ZvbGRlckV4Y2x1ZGVTZWFyY2hQYXRoUGF0dGVybiB8fCB7fSlcblx0XHR9O1xuXG5cdFx0Y29uc3QgZm9sZGVyTmFtZSA9IFVSSS5pc1VyaShmb2xkZXIpID8gYmFzZW5hbWUoZm9sZGVyKSA6IGZvbGRlci5uYW1lO1xuXG5cdFx0Y29uc3QgZXhjbHVkZVBhdHRlcm5SZXQ6IEV4Y2x1ZGVHbG9iUGF0dGVybltdID0gZXhjbHVkZUZvbGRlclJvb3RzLm1hcChleGNsdWRlRm9sZGVyUm9vdCA9PiB7XG5cdFx0XHRyZXR1cm4gT2JqZWN0LmtleXMoZXhjbHVkZVBhdHRlcm4pLmxlbmd0aCA+IDAgPyB7XG5cdFx0XHRcdGZvbGRlcjogZXhjbHVkZUZvbGRlclJvb3QsXG5cdFx0XHRcdHBhdHRlcm46IGV4Y2x1ZGVQYXR0ZXJuXG5cdFx0XHR9IHNhdGlzZmllcyBFeGNsdWRlR2xvYlBhdHRlcm4gOiB1bmRlZmluZWQ7XG5cdFx0fSkuZmlsdGVyKChlKSA9PiBlKSBhcyBFeGNsdWRlR2xvYlBhdHRlcm5bXTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRmb2xkZXI6IGZvbGRlclVyaSxcblx0XHRcdGZvbGRlck5hbWU6IGluY2x1ZGVGb2xkZXJOYW1lID8gZm9sZGVyTmFtZSA6IHVuZGVmaW5lZCxcblx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiBleGNsdWRlUGF0dGVyblJldCxcblx0XHRcdGZpbGVFbmNvZGluZzogZm9sZGVyQ29uZmlnLmZpbGVzICYmIGZvbGRlckNvbmZpZy5maWxlcy5lbmNvZGluZyxcblx0XHRcdGRpc3JlZ2FyZElnbm9yZUZpbGVzOiB0eXBlb2Ygb3B0aW9ucy5kaXNyZWdhcmRJZ25vcmVGaWxlcyA9PT0gJ2Jvb2xlYW4nID8gb3B0aW9ucy5kaXNyZWdhcmRJZ25vcmVGaWxlcyA6ICFmb2xkZXJDb25maWcuc2VhcmNoLnVzZUlnbm9yZUZpbGVzLFxuXHRcdFx0ZGlzcmVnYXJkR2xvYmFsSWdub3JlRmlsZXM6IHR5cGVvZiBvcHRpb25zLmRpc3JlZ2FyZEdsb2JhbElnbm9yZUZpbGVzID09PSAnYm9vbGVhbicgPyBvcHRpb25zLmRpc3JlZ2FyZEdsb2JhbElnbm9yZUZpbGVzIDogIWZvbGRlckNvbmZpZy5zZWFyY2gudXNlR2xvYmFsSWdub3JlRmlsZXMsXG5cdFx0XHRkaXNyZWdhcmRQYXJlbnRJZ25vcmVGaWxlczogdHlwZW9mIG9wdGlvbnMuZGlzcmVnYXJkUGFyZW50SWdub3JlRmlsZXMgPT09ICdib29sZWFuJyA/IG9wdGlvbnMuZGlzcmVnYXJkUGFyZW50SWdub3JlRmlsZXMgOiAhZm9sZGVyQ29uZmlnLnNlYXJjaC51c2VQYXJlbnRJZ25vcmVGaWxlcyxcblx0XHRcdGlnbm9yZVN5bWxpbmtzOiB0eXBlb2Ygb3B0aW9ucy5pZ25vcmVTeW1saW5rcyA9PT0gJ2Jvb2xlYW4nID8gb3B0aW9ucy5pZ25vcmVTeW1saW5rcyA6ICFmb2xkZXJDb25maWcuc2VhcmNoLmZvbGxvd1N5bWxpbmtzLFxuXHRcdH07XG5cdH1cbn1cblxuZnVuY3Rpb24gc3BsaXRHbG9iRnJvbVBhdGgoc2VhcmNoUGF0aDogc3RyaW5nKTogeyBwYXRoUG9ydGlvbjogc3RyaW5nOyBnbG9iUG9ydGlvbj86IHN0cmluZyB9IHtcblx0Y29uc3QgZ2xvYkNoYXJNYXRjaCA9IHNlYXJjaFBhdGgubWF0Y2goL1tcXCpcXHtcXH1cXChcXClcXFtcXF1cXD9dLyk7XG5cdGlmIChnbG9iQ2hhck1hdGNoKSB7XG5cdFx0Y29uc3QgZ2xvYkNoYXJJZHggPSBnbG9iQ2hhck1hdGNoLmluZGV4O1xuXHRcdGNvbnN0IGxhc3RTbGFzaE1hdGNoID0gc2VhcmNoUGF0aC5zdWJzdHIoMCwgZ2xvYkNoYXJJZHgpLm1hdGNoKC9bL3xcXFxcXVteL1xcXFxdKiQvKTtcblx0XHRpZiAobGFzdFNsYXNoTWF0Y2gpIHtcblx0XHRcdGxldCBwYXRoUG9ydGlvbiA9IHNlYXJjaFBhdGguc3Vic3RyKDAsIGxhc3RTbGFzaE1hdGNoLmluZGV4KTtcblx0XHRcdGlmICghcGF0aFBvcnRpb24ubWF0Y2goL1svXFxcXF0vKSkge1xuXHRcdFx0XHQvLyBJZiB0aGUgbGFzdCBzbGFzaCB3YXMgdGhlIG9ubHkgc2xhc2gsIHRoZW4gd2Ugbm93IGhhdmUgJycgb3IgJ0M6JyBvciAnLicuIEFwcGVuZCBhIHNsYXNoLlxuXHRcdFx0XHRwYXRoUG9ydGlvbiArPSAnLyc7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHBhdGhQb3J0aW9uLFxuXHRcdFx0XHRnbG9iUG9ydGlvbjogc2VhcmNoUGF0aC5zdWJzdHIoKGxhc3RTbGFzaE1hdGNoLmluZGV4IHx8IDApICsgMSlcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0Ly8gTm8gZ2xvYiBjaGFyLCBvciBtYWxmb3JtZWRcblx0cmV0dXJuIHtcblx0XHRwYXRoUG9ydGlvbjogc2VhcmNoUGF0aFxuXHR9O1xufVxuXG5mdW5jdGlvbiBwYXR0ZXJuTGlzdFRvSUV4cHJlc3Npb24oLi4ucGF0dGVybnM6IHN0cmluZ1tdKTogZ2xvYi5JRXhwcmVzc2lvbiB8IHVuZGVmaW5lZCB7XG5cdHJldHVybiBwYXR0ZXJucy5sZW5ndGggP1xuXHRcdHBhdHRlcm5zLnJlZHVjZSgoZ2xvYiwgY3VyKSA9PiB7IGdsb2JbY3VyXSA9IHRydWU7IHJldHVybiBnbG9iOyB9LCBPYmplY3QuY3JlYXRlKG51bGwpKSA6XG5cdFx0dW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBzcGxpdEdsb2JQYXR0ZXJuKHBhdHRlcm46IHN0cmluZyk6IHN0cmluZ1tdIHtcblx0cmV0dXJuIGdsb2Iuc3BsaXRHbG9iQXdhcmUocGF0dGVybiwgJywnKVxuXHRcdC5tYXAocyA9PiBzLnRyaW0oKSlcblx0XHQuZmlsdGVyKHMgPT4gISFzLmxlbmd0aCk7XG59XG5cbi8qKlxuICogTm90ZSAtIHdlIHVzZWQge30gaGVyZSBwcmV2aW91c2x5IGJ1dCByaXBncmVwIGNhbid0IGhhbmRsZSBuZXN0ZWQge30gcGF0dGVybnMuIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMzI3NjFcbiAqL1xuZnVuY3Rpb24gZXhwYW5kR2xvYmFsR2xvYihwYXR0ZXJuOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG5cdGNvbnN0IHBhdHRlcm5zID0gW1xuXHRcdGAqKi8ke3BhdHRlcm59LyoqYCxcblx0XHRgKiovJHtwYXR0ZXJufWBcblx0XTtcblxuXHRyZXR1cm4gcGF0dGVybnMubWFwKHAgPT4gcC5yZXBsYWNlKC9cXCpcXCpcXC9cXCpcXCovZywgJyoqJykpO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVTbGFzaGVzKHBhdHRlcm46IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBwYXR0ZXJuLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbn1cblxuLyoqXG4gKiBOb3JtYWxpemUgc2xhc2hlcywgcmVtb3ZlIGAuL2AgYW5kIHRyYWlsaW5nIHNsYXNoZXNcbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplR2xvYlBhdHRlcm4ocGF0dGVybjogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIG5vcm1hbGl6ZVNsYXNoZXMocGF0dGVybilcblx0XHQucmVwbGFjZSgvXlxcLlxcLy8sICcnKVxuXHRcdC5yZXBsYWNlKC9cXC8rJC9nLCAnJyk7XG59XG5cbi8qKlxuICogRXNjYXBlcyBhIHBhdGggZm9yIHVzZSBhcyBhIGdsb2IgcGF0dGVybiB0aGF0IHdvdWxkIG1hdGNoIHRoZSBpbnB1dCBwcmVjaXNlbHkuXG4gKiBDaGFyYWN0ZXJzICc/JywgJyonLCAnWycsIGFuZCAnXScgYXJlIGVzY2FwZWQgaW50byBjaGFyYWN0ZXIgcmFuZ2UgZ2xvYiBzeW50YXhcbiAqIChmb3IgZXhhbXBsZSwgJz8nIGJlY29tZXMgJ1s/XScpLlxuICogTk9URTogVGhpcyBpbXBsZW1lbnRhdGlvbiBtYWtlcyBubyBzcGVjaWFsIGNhc2VzIGZvciBVTkMgcGF0aHMuIEZvciBleGFtcGxlLFxuICogZ2l2ZW4gdGhlIGlucHV0IFwiLy8/L0M6L0E/LnR4dFwiLCB0aGlzIHdvdWxkIHByb2R1Y2Ugb3V0cHV0ICcvL1s/XS9DOi9BWz9dLnR4dCcsXG4gKiB3aGljaCBtYXkgbm90IGJlIGRlc2lyYWJsZSBpbiBzb21lIGNhc2VzLiBVc2Ugd2l0aCBjYXV0aW9uIGlmIFVOQyBwYXRocyBjb3VsZCBiZSBleHBlY3RlZC5cbiAqL1xuZnVuY3Rpb24gZXNjYXBlR2xvYlBhdHRlcm4ocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIHBhdGgucmVwbGFjZSgvKFs/KltcXF1dKS9nLCAnWyQxXScpO1xufVxuXG4vKipcbiAqIENvbnN0cnVjdCBhbiBpbmNsdWRlIHBhdHRlcm4gZnJvbSBhIGxpc3Qgb2YgZm9sZGVycyB1cmlzIHRvIHNlYXJjaCBpbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVSZXNvdXJjZXNGb3JTZWFyY2hJbmNsdWRlcyhyZXNvdXJjZXM6IFVSSVtdLCBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTogc3RyaW5nW10ge1xuXHRyZXNvdXJjZXMgPSBhcnJheXMuZGlzdGluY3QocmVzb3VyY2VzLCByZXNvdXJjZSA9PiByZXNvdXJjZS50b1N0cmluZygpKTtcblxuXHRjb25zdCBmb2xkZXJQYXRoczogc3RyaW5nW10gPSBbXTtcblx0Y29uc3Qgd29ya3NwYWNlID0gY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCk7XG5cblx0aWYgKHJlc291cmNlcykge1xuXHRcdHJlc291cmNlcy5mb3JFYWNoKHJlc291cmNlID0+IHtcblx0XHRcdGxldCBmb2xkZXJQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuRk9MREVSKSB7XG5cdFx0XHRcdC8vIFNob3cgcmVsYXRpdmUgcGF0aCBmcm9tIHRoZSByb290IGZvciBzaW5nbGUtcm9vdCBtb2RlXG5cdFx0XHRcdGZvbGRlclBhdGggPSByZWxhdGl2ZVBhdGgod29ya3NwYWNlLmZvbGRlcnNbMF0udXJpLCByZXNvdXJjZSk7IC8vIGFsd2F5cyB1c2VzIGZvcndhcmQgc2xhc2hlc1xuXHRcdFx0XHRpZiAoZm9sZGVyUGF0aCAmJiBmb2xkZXJQYXRoICE9PSAnLicpIHtcblx0XHRcdFx0XHRmb2xkZXJQYXRoID0gJy4vJyArIGZvbGRlclBhdGg7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IG93bmluZ0ZvbGRlciA9IGNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZUZvbGRlcihyZXNvdXJjZSk7XG5cdFx0XHRcdGlmIChvd25pbmdGb2xkZXIpIHtcblx0XHRcdFx0XHRjb25zdCBvd25pbmdSb290TmFtZSA9IG93bmluZ0ZvbGRlci5uYW1lO1xuXHRcdFx0XHRcdC8vIElmIHRoaXMgcm9vdCBpcyB0aGUgb25seSBvbmUgd2l0aCBpdHMgYmFzZW5hbWUsIHVzZSBhIHJlbGF0aXZlIC4vIHBhdGguIElmIHRoZXJlIGlzIGFub3RoZXIsIHVzZSBhbiBhYnNvbHV0ZSBwYXRoXG5cdFx0XHRcdFx0Y29uc3QgaXNVbmlxdWVGb2xkZXIgPSB3b3Jrc3BhY2UuZm9sZGVycy5maWx0ZXIoZm9sZGVyID0+IGZvbGRlci5uYW1lID09PSBvd25pbmdSb290TmFtZSkubGVuZ3RoID09PSAxO1xuXHRcdFx0XHRcdGlmIChpc1VuaXF1ZUZvbGRlcikge1xuXHRcdFx0XHRcdFx0Y29uc3QgcmVsUGF0aCA9IHJlbGF0aXZlUGF0aChvd25pbmdGb2xkZXIudXJpLCByZXNvdXJjZSk7IC8vIGFsd2F5cyB1c2VzIGZvcndhcmQgc2xhc2hlc1xuXHRcdFx0XHRcdFx0aWYgKHJlbFBhdGggPT09ICcnKSB7XG5cdFx0XHRcdFx0XHRcdGZvbGRlclBhdGggPSBgLi8ke293bmluZ0ZvbGRlci5uYW1lfWA7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRmb2xkZXJQYXRoID0gYC4vJHtvd25pbmdGb2xkZXIubmFtZX0vJHtyZWxQYXRofWA7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGZvbGRlclBhdGggPSByZXNvdXJjZS5mc1BhdGg7IC8vIFRPRE8gcm9iOiBoYW5kbGUgbm9uLWZpbGUgVVJJc1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZm9sZGVyUGF0aCkge1xuXHRcdFx0XHRmb2xkZXJQYXRocy5wdXNoKGVzY2FwZUdsb2JQYXR0ZXJuKGZvbGRlclBhdGgpKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXHRyZXR1cm4gZm9sZGVyUGF0aHM7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksWUFBWTtBQUN4QixZQUFZLGlCQUFpQjtBQUM3QixZQUFZLFVBQVU7QUFDdEIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxlQUFlO0FBQ3hCLFlBQVksVUFBVTtBQUN0QixTQUFTLFNBQVMsVUFBVSxjQUFjLHNCQUFzQjtBQUNoRSxZQUFZLGFBQWE7QUFDekIsU0FBUyxpQkFBaUIsaUJBQWlCO0FBQzNDLFNBQVMs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
