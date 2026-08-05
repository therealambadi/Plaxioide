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
import * as DOM from "../../../../base/browser/dom.js";
import { CountBadge } from "../../../../base/browser/ui/countBadge/countBadge.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import * as paths from "../../../../base/common/path.js";
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { FileKind } from "../../../../platform/files/common/files.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { isEqual } from "../../../../base/common/resources.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { defaultCountBadgeStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { SearchContext } from "../common/constants.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { isSearchTreeMatch, isSearchTreeFileMatch, isSearchTreeFolderMatch, isTextSearchHeading, isSearchTreeFolderMatchWorkspaceRoot, isSearchTreeFolderMatchNoRoot, isPlainTextSearchHeading } from "./searchTreeModel/searchTreeCommon.js";
import { isSearchTreeAIFileMatch } from "./AISearch/aiSearchModelBase.js";
const _SearchDelegate = class _SearchDelegate {
  getHeight(element) {
    return _SearchDelegate.ITEM_HEIGHT;
  }
  getTemplateId(element) {
    if (isSearchTreeFolderMatch(element)) {
      return FolderMatchRenderer.TEMPLATE_ID;
    } else if (isSearchTreeFileMatch(element)) {
      return FileMatchRenderer.TEMPLATE_ID;
    } else if (isSearchTreeMatch(element)) {
      return MatchRenderer.TEMPLATE_ID;
    } else if (isTextSearchHeading(element)) {
      return TextSearchResultRenderer.TEMPLATE_ID;
    }
    console.error("Invalid search tree element", element);
    throw new Error("Invalid search tree element");
  }
};
_SearchDelegate.ITEM_HEIGHT = 22;
let SearchDelegate = _SearchDelegate;
let TextSearchResultRenderer = class extends Disposable {
  constructor(labels, contextService, instantiationService, contextKeyService) {
    super();
    this.labels = labels;
    this.contextService = contextService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.templateId = TextSearchResultRenderer.TEMPLATE_ID;
  }
  disposeCompressedElements(node, index, templateData, height) {
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const textSearchResultElement = DOM.append(container, DOM.$(".textsearchresult"));
    const label = this.labels.create(textSearchResultElement, { supportDescriptionHighlights: true, supportHighlights: true, supportIcons: true });
    disposables.add(label);
    const actionBarContainer = DOM.append(textSearchResultElement, DOM.$(".actionBarContainer"));
    const contextKeyServiceMain = disposables.add(this.contextKeyService.createScoped(container));
    const instantiationService = disposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyServiceMain])));
    const actions = disposables.add(instantiationService.createInstance(MenuWorkbenchToolBar, actionBarContainer, MenuId.SearchActionMenu, {
      menuOptions: {
        shouldForwardArgs: true
      },
      highlightToggledItems: true,
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      toolbarOptions: {
        primaryGroup: (g) => /^inline/.test(g)
      }
    }));
    return { label, disposables, actions, contextKeyService: contextKeyServiceMain };
  }
  async renderElement(node, index, templateData, height) {
    if (isPlainTextSearchHeading(node.element)) {
      templateData.label.setLabel(nls.localize("searchFolderMatch.plainText.label", "Text Results"));
      SearchContext.AIResultsTitle.bindTo(templateData.contextKeyService).set(false);
      SearchContext.MatchFocusKey.bindTo(templateData.contextKeyService).set(false);
      SearchContext.FileFocusKey.bindTo(templateData.contextKeyService).set(false);
      SearchContext.FolderFocusKey.bindTo(templateData.contextKeyService).set(false);
    } else {
      let aiName = "Copilot";
      try {
        aiName = await node.element.parent().searchModel.getAITextResultProviderName() || "Copilot";
      } catch {
      }
      const localizedLabel = nls.localize({
        key: "searchFolderMatch.aiText.label",
        comment: ["This is displayed before the AI text search results, where {0} will be in the place of the AI name (ie: Copilot)"]
      }, "{0} Results", aiName);
      templateData.label.setLabel(`$(${Codicon.copilot.id}) ${localizedLabel}`);
      SearchContext.AIResultsTitle.bindTo(templateData.contextKeyService).set(true);
      SearchContext.MatchFocusKey.bindTo(templateData.contextKeyService).set(false);
      SearchContext.FileFocusKey.bindTo(templateData.contextKeyService).set(false);
      SearchContext.FolderFocusKey.bindTo(templateData.contextKeyService).set(false);
    }
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
  renderCompressedElements(node, index, templateData, height) {
  }
};
TextSearchResultRenderer.TEMPLATE_ID = "textResultMatch";
TextSearchResultRenderer = __decorateClass([
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextKeyService)
], TextSearchResultRenderer);
let FolderMatchRenderer = class extends Disposable {
  constructor(searchView, labels, contextService, labelService, instantiationService, contextKeyService) {
    super();
    this.searchView = searchView;
    this.labels = labels;
    this.contextService = contextService;
    this.labelService = labelService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.templateId = FolderMatchRenderer.TEMPLATE_ID;
  }
  renderCompressedElements(node, index, templateData, height) {
    const compressed = node.element;
    const folder = compressed.elements[compressed.elements.length - 1];
    const label = compressed.elements.map((e) => e.name());
    if (folder.resource) {
      const fileKind = isSearchTreeFolderMatchWorkspaceRoot(folder) ? FileKind.ROOT_FOLDER : FileKind.FOLDER;
      templateData.label.setResource({ resource: folder.resource, name: label }, {
        fileKind,
        separator: this.labelService.getSeparator(folder.resource.scheme)
      });
    } else {
      templateData.label.setLabel(nls.localize("searchFolderMatch.other.label", "Other files"));
    }
    this.renderFolderDetails(folder, templateData);
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const folderMatchElement = DOM.append(container, DOM.$(".foldermatch"));
    const label = this.labels.create(folderMatchElement, { supportDescriptionHighlights: true, supportHighlights: true });
    disposables.add(label);
    const badge = new CountBadge(DOM.append(folderMatchElement, DOM.$(".badge")), {}, defaultCountBadgeStyles);
    disposables.add(badge);
    const actionBarContainer = DOM.append(folderMatchElement, DOM.$(".actionBarContainer"));
    const elementDisposables = new DisposableStore();
    disposables.add(elementDisposables);
    const contextKeyServiceMain = disposables.add(this.contextKeyService.createScoped(container));
    SearchContext.AIResultsTitle.bindTo(contextKeyServiceMain).set(false);
    SearchContext.MatchFocusKey.bindTo(contextKeyServiceMain).set(false);
    SearchContext.FileFocusKey.bindTo(contextKeyServiceMain).set(false);
    SearchContext.FolderFocusKey.bindTo(contextKeyServiceMain).set(true);
    const instantiationService = disposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyServiceMain])));
    const actions = disposables.add(instantiationService.createInstance(MenuWorkbenchToolBar, actionBarContainer, MenuId.SearchActionMenu, {
      menuOptions: {
        shouldForwardArgs: true
      },
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      toolbarOptions: {
        primaryGroup: (g) => /^inline/.test(g)
      }
    }));
    return {
      label,
      badge,
      actions,
      disposables,
      elementDisposables,
      contextKeyService: contextKeyServiceMain
    };
  }
  renderElement(node, index, templateData) {
    const folderMatch = node.element;
    if (folderMatch.resource) {
      const workspaceFolder = this.contextService.getWorkspaceFolder(folderMatch.resource);
      if (workspaceFolder && isEqual(workspaceFolder.uri, folderMatch.resource)) {
        templateData.label.setFile(folderMatch.resource, { fileKind: FileKind.ROOT_FOLDER, hidePath: true });
      } else {
        templateData.label.setFile(folderMatch.resource, { fileKind: FileKind.FOLDER, hidePath: this.searchView.isTreeLayoutViewVisible });
      }
    } else {
      templateData.label.setLabel(nls.localize("searchFolderMatch.other.label", "Other files"));
    }
    SearchContext.IsEditableItemKey.bindTo(templateData.contextKeyService).set(!folderMatch.hasOnlyReadOnlyMatches());
    templateData.elementDisposables.add(folderMatch.onChange(() => {
      SearchContext.IsEditableItemKey.bindTo(templateData.contextKeyService).set(!folderMatch.hasOnlyReadOnlyMatches());
    }));
    this.renderFolderDetails(folderMatch, templateData);
  }
  disposeElement(element, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeCompressedElements(node, index, templateData, height) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
  renderFolderDetails(folder, templateData) {
    const count = folder.recursiveMatchCount();
    templateData.badge.setCount(count);
    templateData.badge.setTitleFormat(count > 1 ? nls.localize("searchFileMatches", "{0} files found", count) : nls.localize("searchFileMatch", "{0} file found", count));
    templateData.actions.context = { viewer: this.searchView.getControl(), element: folder };
  }
};
FolderMatchRenderer.TEMPLATE_ID = "folderMatch";
FolderMatchRenderer = __decorateClass([
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, ILabelService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextKeyService)
], FolderMatchRenderer);
let FileMatchRenderer = class extends Disposable {
  constructor(searchView, labels, contextService, configurationService, instantiationService, contextKeyService) {
    super();
    this.searchView = searchView;
    this.labels = labels;
    this.contextService = contextService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.templateId = FileMatchRenderer.TEMPLATE_ID;
  }
  renderCompressedElements(node, index, templateData, height) {
    throw new Error("Should never happen since node is incompressible.");
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elementDisposables = new DisposableStore();
    disposables.add(elementDisposables);
    const fileMatchElement = DOM.append(container, DOM.$(".filematch"));
    const label = this.labels.create(fileMatchElement);
    disposables.add(label);
    const badge = new CountBadge(DOM.append(fileMatchElement, DOM.$(".badge")), {}, defaultCountBadgeStyles);
    disposables.add(badge);
    const actionBarContainer = DOM.append(fileMatchElement, DOM.$(".actionBarContainer"));
    const contextKeyServiceMain = disposables.add(this.contextKeyService.createScoped(container));
    SearchContext.AIResultsTitle.bindTo(contextKeyServiceMain).set(false);
    SearchContext.MatchFocusKey.bindTo(contextKeyServiceMain).set(false);
    SearchContext.FileFocusKey.bindTo(contextKeyServiceMain).set(true);
    SearchContext.FolderFocusKey.bindTo(contextKeyServiceMain).set(false);
    const instantiationService = disposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyServiceMain])));
    const actions = disposables.add(instantiationService.createInstance(MenuWorkbenchToolBar, actionBarContainer, MenuId.SearchActionMenu, {
      menuOptions: {
        shouldForwardArgs: true
      },
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      toolbarOptions: {
        primaryGroup: (g) => /^inline/.test(g)
      }
    }));
    return {
      el: fileMatchElement,
      label,
      badge,
      actions,
      disposables,
      elementDisposables,
      contextKeyService: contextKeyServiceMain
    };
  }
  renderElement(node, index, templateData) {
    const fileMatch = node.element;
    templateData.el.setAttribute("data-resource", fileMatch.resource.toString());
    const decorationConfig = this.configurationService.getValue("search").decorations;
    templateData.label.setFile(fileMatch.resource, { range: isSearchTreeAIFileMatch(fileMatch) ? fileMatch.getFullRange() : void 0, hidePath: this.searchView.isTreeLayoutViewVisible && !isSearchTreeFolderMatchNoRoot(fileMatch.parent()), hideIcon: false, fileDecorations: { colors: decorationConfig.colors, badges: decorationConfig.badges } });
    const count = fileMatch.count();
    templateData.badge.setCount(count);
    templateData.badge.setTitleFormat(count > 1 ? nls.localize("searchMatches", "{0} matches found", count) : nls.localize("searchMatch", "{0} match found", count));
    templateData.actions.context = { viewer: this.searchView.getControl(), element: fileMatch };
    SearchContext.IsEditableItemKey.bindTo(templateData.contextKeyService).set(!fileMatch.hasOnlyReadOnlyMatches());
    templateData.elementDisposables.add(fileMatch.onChange(() => {
      SearchContext.IsEditableItemKey.bindTo(templateData.contextKeyService).set(!fileMatch.hasOnlyReadOnlyMatches());
    }));
    const twistieContainer = templateData.el.parentElement?.parentElement?.querySelector(".monaco-tl-twistie");
    twistieContainer?.classList.add("force-twistie");
  }
  disposeElement(element, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
};
FileMatchRenderer.TEMPLATE_ID = "fileMatch";
FileMatchRenderer = __decorateClass([
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextKeyService)
], FileMatchRenderer);
let MatchRenderer = class extends Disposable {
  constructor(searchView, contextService, configurationService, instantiationService, contextKeyService, hoverService) {
    super();
    this.searchView = searchView;
    this.contextService = contextService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.hoverService = hoverService;
    this.templateId = MatchRenderer.TEMPLATE_ID;
  }
  renderCompressedElements(node, index, templateData, height) {
    throw new Error("Should never happen since node is incompressible.");
  }
  renderTemplate(container) {
    container.classList.add("linematch");
    const lineNumber = DOM.append(container, DOM.$("span.matchLineNum"));
    const parent = DOM.append(container, DOM.$("a.plain.match"));
    const before = DOM.append(parent, DOM.$("span"));
    const match = DOM.append(parent, DOM.$("span.findInFileMatch"));
    const replace = DOM.append(parent, DOM.$("span.replaceMatch"));
    const after = DOM.append(parent, DOM.$("span"));
    const actionBarContainer = DOM.append(container, DOM.$("span.actionBarContainer"));
    const disposables = new DisposableStore();
    const contextKeyServiceMain = disposables.add(this.contextKeyService.createScoped(container));
    SearchContext.AIResultsTitle.bindTo(contextKeyServiceMain).set(false);
    SearchContext.MatchFocusKey.bindTo(contextKeyServiceMain).set(true);
    SearchContext.FileFocusKey.bindTo(contextKeyServiceMain).set(false);
    SearchContext.FolderFocusKey.bindTo(contextKeyServiceMain).set(false);
    const instantiationService = disposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyServiceMain])));
    const actions = disposables.add(instantiationService.createInstance(MenuWorkbenchToolBar, actionBarContainer, MenuId.SearchActionMenu, {
      menuOptions: {
        shouldForwardArgs: true
      },
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      toolbarOptions: {
        primaryGroup: (g) => /^inline/.test(g)
      }
    }));
    return {
      parent,
      before,
      match,
      replace,
      after,
      lineNumber,
      actions,
      disposables,
      contextKeyService: contextKeyServiceMain
    };
  }
  renderElement(node, index, templateData) {
    const match = node.element;
    const preview = match.preview();
    const replace = this.searchView.model.isReplaceActive() && !!this.searchView.model.replaceString && !match.isReadonly;
    templateData.before.textContent = preview.before;
    templateData.match.textContent = preview.inside;
    templateData.match.classList.toggle("replace", replace);
    templateData.replace.textContent = replace ? match.replaceString : "";
    templateData.after.textContent = preview.after;
    const title = (preview.fullBefore + (replace ? match.replaceString : preview.inside) + preview.after).trim().substr(0, 999);
    templateData.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), templateData.parent, title));
    SearchContext.IsEditableItemKey.bindTo(templateData.contextKeyService).set(!match.isReadonly);
    const numLines = match.range().endLineNumber - match.range().startLineNumber;
    const extraLinesStr = numLines > 0 ? `+${numLines}` : "";
    const showLineNumbers = this.configurationService.getValue("search").showLineNumbers;
    const lineNumberStr = showLineNumbers ? `${match.range().startLineNumber}:` : "";
    templateData.lineNumber.classList.toggle("show", numLines > 0 || showLineNumbers);
    templateData.lineNumber.textContent = lineNumberStr + extraLinesStr;
    templateData.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), templateData.lineNumber, this.getMatchTitle(match, showLineNumbers)));
    templateData.actions.context = { viewer: this.searchView.getControl(), element: match };
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
  getMatchTitle(match, showLineNumbers) {
    const startLine = match.range().startLineNumber;
    const numLines = match.range().endLineNumber - match.range().startLineNumber;
    const lineNumStr = showLineNumbers ? nls.localize("lineNumStr", "From line {0}", startLine, numLines) + " " : "";
    const numLinesStr = numLines > 0 ? "+ " + nls.localize("numLinesStr", "{0} more lines", numLines) : "";
    return lineNumStr + numLinesStr;
  }
};
MatchRenderer.TEMPLATE_ID = "match";
MatchRenderer = __decorateClass([
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IHoverService)
], MatchRenderer);
let SearchAccessibilityProvider = class {
  constructor(searchView, labelService) {
    this.searchView = searchView;
    this.labelService = labelService;
  }
  getWidgetAriaLabel() {
    return nls.localize("search", "Search");
  }
  getAriaLabel(element) {
    if (isSearchTreeFolderMatch(element)) {
      const count = element.allDownstreamFileMatches().reduce((total, current) => total + current.count(), 0);
      return element.resource ? nls.localize("folderMatchAriaLabel", "{0} matches in folder root {1}, Search result", count, element.name()) : nls.localize("otherFilesAriaLabel", "{0} matches outside of the workspace, Search result", count);
    }
    if (isSearchTreeFileMatch(element)) {
      const path = this.labelService.getUriLabel(element.resource, { relative: true }) || element.resource.fsPath;
      return nls.localize("fileMatchAriaLabel", "{0} matches in file {1} of folder {2}, Search result", element.count(), element.name(), paths.dirname(path));
    }
    if (isSearchTreeMatch(element)) {
      const match = element;
      const searchModel = this.searchView.model;
      const replace = searchModel.isReplaceActive() && !!searchModel.replaceString;
      const matchString = match.getMatchString();
      const range = match.range();
      const matchText = match.text().substr(0, range.endColumn + 150);
      if (replace) {
        return nls.localize("replacePreviewResultAria", "'{0}' at column {1} replace {2} with {3}", matchText, range.startColumn, matchString, match.replaceString);
      }
      return nls.localize("searchResultAria", "'{0}' at column {1} found {2}", matchText, range.startColumn, matchString);
    }
    return null;
  }
};
SearchAccessibilityProvider = __decorateClass([
  __decorateParam(1, ILabelService)
], SearchAccessibilityProvider);
export {
  FileMatchRenderer,
  FolderMatchRenderer,
  MatchRenderer,
  SearchAccessibilityProvider,
  SearchDelegate,
  TextSearchResultRenderer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hSZXN1bHRzVmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIERPTSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IENvdW50QmFkZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvY291bnRCYWRnZS9jb3VudEJhZGdlLmpzJztcbmltcG9ydCB7IElMaXN0VmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBJTGlzdEFjY2Vzc2liaWxpdHlQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RXaWRnZXQuanMnO1xuaW1wb3J0IHsgSVRyZWVOb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0ICogYXMgcGF0aHMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgRmlsZUtpbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJU2VhcmNoQ29uZmlndXJhdGlvblByb3BlcnRpZXMgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9zZWFyY2gvY29tbW9uL3NlYXJjaC5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJUmVzb3VyY2VMYWJlbCwgUmVzb3VyY2VMYWJlbHMgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2xhYmVscy5qcyc7XG5pbXBvcnQgeyBTZWFyY2hWaWV3IH0gZnJvbSAnLi9zZWFyY2hWaWV3LmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL29iamVjdFRyZWUuanMnO1xuaW1wb3J0IHsgSUNvbXByZXNzZWRUcmVlTm9kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL2NvbXByZXNzZWRPYmplY3RUcmVlTW9kZWwuanMnO1xuaW1wb3J0IHsgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEhpZGRlbkl0ZW1TdHJhdGVneSwgTWVudVdvcmtiZW5jaFRvb2xCYXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBJU2VhcmNoQWN0aW9uQ29udGV4dCB9IGZyb20gJy4vc2VhcmNoQWN0aW9uc1JlbW92ZVJlcGxhY2UuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IGRlZmF1bHRDb3VudEJhZGdlU3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCB7IFNlYXJjaENvbnRleHQgfSBmcm9tICcuLi9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGVGYWN0b3J5LmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBJU2VhcmNoVHJlZU1hdGNoLCBpc1NlYXJjaFRyZWVNYXRjaCwgUmVuZGVyYWJsZU1hdGNoLCBJVGV4dFNlYXJjaEhlYWRpbmcsIElTZWFyY2hUcmVlRm9sZGVyTWF0Y2gsIElTZWFyY2hUcmVlRmlsZU1hdGNoLCBpc1NlYXJjaFRyZWVGaWxlTWF0Y2gsIGlzU2VhcmNoVHJlZUZvbGRlck1hdGNoLCBpc1RleHRTZWFyY2hIZWFkaW5nLCBJU2VhcmNoTW9kZWwsIGlzU2VhcmNoVHJlZUZvbGRlck1hdGNoV29ya3NwYWNlUm9vdCwgaXNTZWFyY2hUcmVlRm9sZGVyTWF0Y2hOb1Jvb3QsIGlzUGxhaW5UZXh0U2VhcmNoSGVhZGluZyB9IGZyb20gJy4vc2VhcmNoVHJlZU1vZGVsL3NlYXJjaFRyZWVDb21tb24uanMnO1xuaW1wb3J0IHsgaXNTZWFyY2hUcmVlQUlGaWxlTWF0Y2ggfSBmcm9tICcuL0FJU2VhcmNoL2FpU2VhcmNoTW9kZWxCYXNlLmpzJztcblxuaW50ZXJmYWNlIElGb2xkZXJNYXRjaFRlbXBsYXRlIHtcblx0bGFiZWw6IElSZXNvdXJjZUxhYmVsO1xuXHRiYWRnZTogQ291bnRCYWRnZTtcblx0YWN0aW9uczogTWVudVdvcmtiZW5jaFRvb2xCYXI7XG5cdGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGVsZW1lbnREaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXHRjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlO1xufVxuXG5pbnRlcmZhY2UgSVRleHRTZWFyY2hSZXN1bHRUZW1wbGF0ZSB7XG5cdGxhYmVsOiBJUmVzb3VyY2VMYWJlbDtcblx0ZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0YWN0aW9uczogTWVudVdvcmtiZW5jaFRvb2xCYXI7XG5cdGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2U7XG59XG5cbmludGVyZmFjZSBJRmlsZU1hdGNoVGVtcGxhdGUge1xuXHRlbDogSFRNTEVsZW1lbnQ7XG5cdGxhYmVsOiBJUmVzb3VyY2VMYWJlbDtcblx0YmFkZ2U6IENvdW50QmFkZ2U7XG5cdGFjdGlvbnM6IE1lbnVXb3JrYmVuY2hUb29sQmFyO1xuXHRkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXHRlbGVtZW50RGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0Y29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZTtcbn1cblxuaW50ZXJmYWNlIElNYXRjaFRlbXBsYXRlIHtcblx0bGluZU51bWJlcjogSFRNTEVsZW1lbnQ7XG5cdHBhcmVudDogSFRNTEVsZW1lbnQ7XG5cdGJlZm9yZTogSFRNTEVsZW1lbnQ7XG5cdG1hdGNoOiBIVE1MRWxlbWVudDtcblx0cmVwbGFjZTogSFRNTEVsZW1lbnQ7XG5cdGFmdGVyOiBIVE1MRWxlbWVudDtcblx0YWN0aW9uczogTWVudVdvcmtiZW5jaFRvb2xCYXI7XG5cdGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2U7XG59XG5cbmV4cG9ydCBjbGFzcyBTZWFyY2hEZWxlZ2F0ZSBpbXBsZW1lbnRzIElMaXN0VmlydHVhbERlbGVnYXRlPFJlbmRlcmFibGVNYXRjaD4ge1xuXG5cdHB1YmxpYyBzdGF0aWMgSVRFTV9IRUlHSFQgPSAyMjtcblxuXHRnZXRIZWlnaHQoZWxlbWVudDogUmVuZGVyYWJsZU1hdGNoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gU2VhcmNoRGVsZWdhdGUuSVRFTV9IRUlHSFQ7XG5cdH1cblxuXHRnZXRUZW1wbGF0ZUlkKGVsZW1lbnQ6IFJlbmRlcmFibGVNYXRjaCk6IHN0cmluZyB7XG5cdFx0aWYgKGlzU2VhcmNoVHJlZUZvbGRlck1hdGNoKGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gRm9sZGVyTWF0Y2hSZW5kZXJlci5URU1QTEFURV9JRDtcblx0XHR9IGVsc2UgaWYgKGlzU2VhcmNoVHJlZUZpbGVNYXRjaChlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIEZpbGVNYXRjaFJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXHRcdH0gZWxzZSBpZiAoaXNTZWFyY2hUcmVlTWF0Y2goZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiBNYXRjaFJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXHRcdH0gZWxzZSBpZiAoaXNUZXh0U2VhcmNoSGVhZGluZyhlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIFRleHRTZWFyY2hSZXN1bHRSZW5kZXJlci5URU1QTEFURV9JRDtcblx0XHR9XG5cblx0XHRjb25zb2xlLmVycm9yKCdJbnZhbGlkIHNlYXJjaCB0cmVlIGVsZW1lbnQnLCBlbGVtZW50KTtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc2VhcmNoIHRyZWUgZWxlbWVudCcpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXh0U2VhcmNoUmVzdWx0UmVuZGVyZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlcjxJVGV4dFNlYXJjaEhlYWRpbmcsIGFueSwgSVRleHRTZWFyY2hSZXN1bHRUZW1wbGF0ZT4ge1xuXHRzdGF0aWMgcmVhZG9ubHkgVEVNUExBVEVfSUQgPSAndGV4dFJlc3VsdE1hdGNoJztcblxuXHRyZWFkb25seSB0ZW1wbGF0ZUlkID0gVGV4dFNlYXJjaFJlc3VsdFJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgbGFiZWxzOiBSZXNvdXJjZUxhYmVscyxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByb3RlY3RlZCBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cdGRpc3Bvc2VDb21wcmVzc2VkRWxlbWVudHM/KG5vZGU6IElUcmVlTm9kZTxJQ29tcHJlc3NlZFRyZWVOb2RlPElUZXh0U2VhcmNoSGVhZGluZz4sIGFueT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVRleHRTZWFyY2hSZXN1bHRUZW1wbGF0ZSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblxuXHR9XG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJVGV4dFNlYXJjaFJlc3VsdFRlbXBsYXRlIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCB0ZXh0U2VhcmNoUmVzdWx0RWxlbWVudCA9IERPTS5hcHBlbmQoY29udGFpbmVyLCBET00uJCgnLnRleHRzZWFyY2hyZXN1bHQnKSk7XG5cdFx0Y29uc3QgbGFiZWwgPSB0aGlzLmxhYmVscy5jcmVhdGUodGV4dFNlYXJjaFJlc3VsdEVsZW1lbnQsIHsgc3VwcG9ydERlc2NyaXB0aW9uSGlnaGxpZ2h0czogdHJ1ZSwgc3VwcG9ydEhpZ2hsaWdodHM6IHRydWUsIHN1cHBvcnRJY29uczogdHJ1ZSB9KTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFiZWwpO1xuXG5cdFx0Y29uc3QgYWN0aW9uQmFyQ29udGFpbmVyID0gRE9NLmFwcGVuZCh0ZXh0U2VhcmNoUmVzdWx0RWxlbWVudCwgRE9NLiQoJy5hY3Rpb25CYXJDb250YWluZXInKSk7XG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2VNYWluID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlU2NvcGVkKGNvbnRhaW5lcikpO1xuXG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVDaGlsZChuZXcgU2VydmljZUNvbGxlY3Rpb24oW0lDb250ZXh0S2V5U2VydmljZSwgY29udGV4dEtleVNlcnZpY2VNYWluXSkpKTtcblx0XHRjb25zdCBhY3Rpb25zID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVXb3JrYmVuY2hUb29sQmFyLCBhY3Rpb25CYXJDb250YWluZXIsIE1lbnVJZC5TZWFyY2hBY3Rpb25NZW51LCB7XG5cdFx0XHRtZW51T3B0aW9uczoge1xuXHRcdFx0XHRzaG91bGRGb3J3YXJkQXJnczogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdGhpZ2hsaWdodFRvZ2dsZWRJdGVtczogdHJ1ZSxcblx0XHRcdGhpZGRlbkl0ZW1TdHJhdGVneTogSGlkZGVuSXRlbVN0cmF0ZWd5Lklnbm9yZSxcblx0XHRcdHRvb2xiYXJPcHRpb25zOiB7XG5cdFx0XHRcdHByaW1hcnlHcm91cDogKGc6IHN0cmluZykgPT4gL15pbmxpbmUvLnRlc3QoZyksXG5cdFx0XHR9LFxuXHRcdH0pKTtcblx0XHRyZXR1cm4geyBsYWJlbCwgZGlzcG9zYWJsZXMsIGFjdGlvbnMsIGNvbnRleHRLZXlTZXJ2aWNlOiBjb250ZXh0S2V5U2VydmljZU1haW4gfTtcblx0fVxuXG5cdGFzeW5jIHJlbmRlckVsZW1lbnQobm9kZTogSVRyZWVOb2RlPElUZXh0U2VhcmNoSGVhZGluZywgYW55PiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJRm9sZGVyTWF0Y2hUZW1wbGF0ZSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoaXNQbGFpblRleHRTZWFyY2hIZWFkaW5nKG5vZGUuZWxlbWVudCkpIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5zZXRMYWJlbChubHMubG9jYWxpemUoJ3NlYXJjaEZvbGRlck1hdGNoLnBsYWluVGV4dC5sYWJlbCcsIFwiVGV4dCBSZXN1bHRzXCIpKTtcblx0XHRcdFNlYXJjaENvbnRleHQuQUlSZXN1bHRzVGl0bGUuYmluZFRvKHRlbXBsYXRlRGF0YS5jb250ZXh0S2V5U2VydmljZSkuc2V0KGZhbHNlKTtcblx0XHRcdFNlYXJjaENvbnRleHQuTWF0Y2hGb2N1c0tleS5iaW5kVG8odGVtcGxhdGVEYXRhLmNvbnRleHRLZXlTZXJ2aWNlKS5zZXQoZmFsc2UpO1xuXHRcdFx0U2VhcmNoQ29udGV4dC5GaWxlRm9jdXNLZXkuYmluZFRvKHRlbXBsYXRlRGF0YS5jb250ZXh0S2V5U2VydmljZSkuc2V0KGZhbHNlKTtcblx0XHRcdFNlYXJjaENvbnRleHQuRm9sZGVyRm9jdXNLZXkuYmluZFRvKHRlbXBsYXRlRGF0YS5jb250ZXh0S2V5U2VydmljZSkuc2V0KGZhbHNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGV0IGFpTmFtZSA9ICdDb3BpbG90Jztcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGFpTmFtZSA9IChhd2FpdCBub2RlLmVsZW1lbnQucGFyZW50KCkuc2VhcmNoTW9kZWwuZ2V0QUlUZXh0UmVzdWx0UHJvdmlkZXJOYW1lKCkpIHx8ICdDb3BpbG90Jztcblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHQvLyBpZ25vcmVcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbG9jYWxpemVkTGFiZWwgPSBubHMubG9jYWxpemUoe1xuXHRcdFx0XHRrZXk6ICdzZWFyY2hGb2xkZXJNYXRjaC5haVRleHQubGFiZWwnLFxuXHRcdFx0XHRjb21tZW50OiBbJ1RoaXMgaXMgZGlzcGxheWVkIGJlZm9yZSB0aGUgQUkgdGV4dCBzZWFyY2ggcmVzdWx0cywgd2hlcmUgezB9IHdpbGwgYmUgaW4gdGhlIHBsYWNlIG9mIHRoZSBBSSBuYW1lIChpZTogQ29waWxvdCknXVxuXHRcdFx0fSwgJ3swfSBSZXN1bHRzJywgYWlOYW1lKTtcblxuXHRcdFx0Ly8gdG9kbzogbWFrZSBpY29uIGV4dGVuc2lvbi1jb250cmlidXRlZC5cblx0XHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5zZXRMYWJlbChgJCgke0NvZGljb24uY29waWxvdC5pZH0pICR7bG9jYWxpemVkTGFiZWx9YCk7XG5cblx0XHRcdFNlYXJjaENvbnRleHQuQUlSZXN1bHRzVGl0bGUuYmluZFRvKHRlbXBsYXRlRGF0YS5jb250ZXh0S2V5U2VydmljZSkuc2V0KHRydWUpO1xuXHRcdFx0U2VhcmNoQ29udGV4dC5NYXRjaEZvY3VzS2V5LmJpbmRUbyh0ZW1wbGF0ZURhdGEuY29udGV4dEtleVNlcnZpY2UpLnNldChmYWxzZSk7XG5cdFx0XHRTZWFyY2hDb250ZXh0LkZpbGVGb2N1c0tleS5iaW5kVG8odGVtcGxhdGVEYXRhLmNvbnRleHRLZXlTZXJ2aWNlKS5zZXQoZmFsc2UpO1xuXHRcdFx0U2VhcmNoQ29udGV4dC5Gb2xkZXJGb2N1c0tleS5iaW5kVG8odGVtcGxhdGVEYXRhLmNvbnRleHRLZXlTZXJ2aWNlKS5zZXQoZmFsc2UpO1xuXHRcdH1cblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElGb2xkZXJNYXRjaFRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHJlbmRlckNvbXByZXNzZWRFbGVtZW50cyhub2RlOiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxJVGV4dFNlYXJjaEhlYWRpbmc+LCBhbnk+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElUZXh0U2VhcmNoUmVzdWx0VGVtcGxhdGUsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdH1cblxufVxuZXhwb3J0IGNsYXNzIEZvbGRlck1hdGNoUmVuZGVyZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlcjxJU2VhcmNoVHJlZUZvbGRlck1hdGNoLCBhbnksIElGb2xkZXJNYXRjaFRlbXBsYXRlPiB7XG5cdHN0YXRpYyByZWFkb25seSBURU1QTEFURV9JRCA9ICdmb2xkZXJNYXRjaCc7XG5cblx0cmVhZG9ubHkgdGVtcGxhdGVJZCA9IEZvbGRlck1hdGNoUmVuZGVyZXIuVEVNUExBVEVfSUQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBzZWFyY2hWaWV3OiBTZWFyY2hWaWV3LFxuXHRcdHByaXZhdGUgbGFiZWxzOiBSZXNvdXJjZUxhYmVscyxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByb3RlY3RlZCBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cmVuZGVyQ29tcHJlc3NlZEVsZW1lbnRzKG5vZGU6IElUcmVlTm9kZTxJQ29tcHJlc3NlZFRyZWVOb2RlPElTZWFyY2hUcmVlRm9sZGVyTWF0Y2g+LCBhbnk+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElGb2xkZXJNYXRjaFRlbXBsYXRlLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbXByZXNzZWQgPSBub2RlLmVsZW1lbnQ7XG5cdFx0Y29uc3QgZm9sZGVyID0gY29tcHJlc3NlZC5lbGVtZW50c1tjb21wcmVzc2VkLmVsZW1lbnRzLmxlbmd0aCAtIDFdO1xuXHRcdGNvbnN0IGxhYmVsID0gY29tcHJlc3NlZC5lbGVtZW50cy5tYXAoZSA9PiBlLm5hbWUoKSk7XG5cblx0XHRpZiAoZm9sZGVyLnJlc291cmNlKSB7XG5cdFx0XHRjb25zdCBmaWxlS2luZCA9IChpc1NlYXJjaFRyZWVGb2xkZXJNYXRjaFdvcmtzcGFjZVJvb3QoZm9sZGVyKSkgPyBGaWxlS2luZC5ST09UX0ZPTERFUiA6IEZpbGVLaW5kLkZPTERFUjtcblx0XHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5zZXRSZXNvdXJjZSh7IHJlc291cmNlOiBmb2xkZXIucmVzb3VyY2UsIG5hbWU6IGxhYmVsIH0sIHtcblx0XHRcdFx0ZmlsZUtpbmQsXG5cdFx0XHRcdHNlcGFyYXRvcjogdGhpcy5sYWJlbFNlcnZpY2UuZ2V0U2VwYXJhdG9yKGZvbGRlci5yZXNvdXJjZS5zY2hlbWUpLFxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5zZXRMYWJlbChubHMubG9jYWxpemUoJ3NlYXJjaEZvbGRlck1hdGNoLm90aGVyLmxhYmVsJywgXCJPdGhlciBmaWxlc1wiKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5yZW5kZXJGb2xkZXJEZXRhaWxzKGZvbGRlciwgdGVtcGxhdGVEYXRhKTtcblx0fVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJRm9sZGVyTWF0Y2hUZW1wbGF0ZSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBmb2xkZXJNYXRjaEVsZW1lbnQgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgRE9NLiQoJy5mb2xkZXJtYXRjaCcpKTtcblx0XHRjb25zdCBsYWJlbCA9IHRoaXMubGFiZWxzLmNyZWF0ZShmb2xkZXJNYXRjaEVsZW1lbnQsIHsgc3VwcG9ydERlc2NyaXB0aW9uSGlnaGxpZ2h0czogdHJ1ZSwgc3VwcG9ydEhpZ2hsaWdodHM6IHRydWUgfSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhYmVsKTtcblx0XHRjb25zdCBiYWRnZSA9IG5ldyBDb3VudEJhZGdlKERPTS5hcHBlbmQoZm9sZGVyTWF0Y2hFbGVtZW50LCBET00uJCgnLmJhZGdlJykpLCB7fSwgZGVmYXVsdENvdW50QmFkZ2VTdHlsZXMpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChiYWRnZSk7XG5cdFx0Y29uc3QgYWN0aW9uQmFyQ29udGFpbmVyID0gRE9NLmFwcGVuZChmb2xkZXJNYXRjaEVsZW1lbnQsIERPTS4kKCcuYWN0aW9uQmFyQ29udGFpbmVyJykpO1xuXG5cdFx0Y29uc3QgZWxlbWVudERpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChlbGVtZW50RGlzcG9zYWJsZXMpO1xuXG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2VNYWluID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlU2NvcGVkKGNvbnRhaW5lcikpO1xuXHRcdFNlYXJjaENvbnRleHQuQUlSZXN1bHRzVGl0bGUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlTWFpbikuc2V0KGZhbHNlKTtcblx0XHRTZWFyY2hDb250ZXh0Lk1hdGNoRm9jdXNLZXkuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlTWFpbikuc2V0KGZhbHNlKTtcblx0XHRTZWFyY2hDb250ZXh0LkZpbGVGb2N1c0tleS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2VNYWluKS5zZXQoZmFsc2UpO1xuXHRcdFNlYXJjaENvbnRleHQuRm9sZGVyRm9jdXNLZXkuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlTWFpbikuc2V0KHRydWUpO1xuXG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVDaGlsZChuZXcgU2VydmljZUNvbGxlY3Rpb24oW0lDb250ZXh0S2V5U2VydmljZSwgY29udGV4dEtleVNlcnZpY2VNYWluXSkpKTtcblx0XHRjb25zdCBhY3Rpb25zID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVXb3JrYmVuY2hUb29sQmFyLCBhY3Rpb25CYXJDb250YWluZXIsIE1lbnVJZC5TZWFyY2hBY3Rpb25NZW51LCB7XG5cdFx0XHRtZW51T3B0aW9uczoge1xuXHRcdFx0XHRzaG91bGRGb3J3YXJkQXJnczogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdGhpZGRlbkl0ZW1TdHJhdGVneTogSGlkZGVuSXRlbVN0cmF0ZWd5Lklnbm9yZSxcblx0XHRcdHRvb2xiYXJPcHRpb25zOiB7XG5cdFx0XHRcdHByaW1hcnlHcm91cDogKGc6IHN0cmluZykgPT4gL15pbmxpbmUvLnRlc3QoZyksXG5cdFx0XHR9LFxuXHRcdH0pKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRsYWJlbCxcblx0XHRcdGJhZGdlLFxuXHRcdFx0YWN0aW9ucyxcblx0XHRcdGRpc3Bvc2FibGVzLFxuXHRcdFx0ZWxlbWVudERpc3Bvc2FibGVzLFxuXHRcdFx0Y29udGV4dEtleVNlcnZpY2U6IGNvbnRleHRLZXlTZXJ2aWNlTWFpblxuXHRcdH07XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KG5vZGU6IElUcmVlTm9kZTxJU2VhcmNoVHJlZUZvbGRlck1hdGNoLCBhbnk+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElGb2xkZXJNYXRjaFRlbXBsYXRlKTogdm9pZCB7XG5cdFx0Y29uc3QgZm9sZGVyTWF0Y2ggPSBub2RlLmVsZW1lbnQ7XG5cdFx0aWYgKGZvbGRlck1hdGNoLnJlc291cmNlKSB7XG5cdFx0XHRjb25zdCB3b3Jrc3BhY2VGb2xkZXIgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZUZvbGRlcihmb2xkZXJNYXRjaC5yZXNvdXJjZSk7XG5cdFx0XHRpZiAod29ya3NwYWNlRm9sZGVyICYmIGlzRXF1YWwod29ya3NwYWNlRm9sZGVyLnVyaSwgZm9sZGVyTWF0Y2gucmVzb3VyY2UpKSB7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5zZXRGaWxlKGZvbGRlck1hdGNoLnJlc291cmNlLCB7IGZpbGVLaW5kOiBGaWxlS2luZC5ST09UX0ZPTERFUiwgaGlkZVBhdGg6IHRydWUgfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuc2V0RmlsZShmb2xkZXJNYXRjaC5yZXNvdXJjZSwgeyBmaWxlS2luZDogRmlsZUtpbmQuRk9MREVSLCBoaWRlUGF0aDogdGhpcy5zZWFyY2hWaWV3LmlzVHJlZUxheW91dFZpZXdWaXNpYmxlIH0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuc2V0TGFiZWwobmxzLmxvY2FsaXplKCdzZWFyY2hGb2xkZXJNYXRjaC5vdGhlci5sYWJlbCcsIFwiT3RoZXIgZmlsZXNcIikpO1xuXHRcdH1cblxuXHRcdFNlYXJjaENvbnRleHQuSXNFZGl0YWJsZUl0ZW1LZXkuYmluZFRvKHRlbXBsYXRlRGF0YS5jb250ZXh0S2V5U2VydmljZSkuc2V0KCFmb2xkZXJNYXRjaC5oYXNPbmx5UmVhZE9ubHlNYXRjaGVzKCkpO1xuXG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQoZm9sZGVyTWF0Y2gub25DaGFuZ2UoKCkgPT4ge1xuXHRcdFx0U2VhcmNoQ29udGV4dC5Jc0VkaXRhYmxlSXRlbUtleS5iaW5kVG8odGVtcGxhdGVEYXRhLmNvbnRleHRLZXlTZXJ2aWNlKS5zZXQoIWZvbGRlck1hdGNoLmhhc09ubHlSZWFkT25seU1hdGNoZXMoKSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5yZW5kZXJGb2xkZXJEZXRhaWxzKGZvbGRlck1hdGNoLCB0ZW1wbGF0ZURhdGEpO1xuXHR9XG5cblx0ZGlzcG9zZUVsZW1lbnQoZWxlbWVudDogSVRyZWVOb2RlPFJlbmRlcmFibGVNYXRjaCwgYW55PiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJRm9sZGVyTWF0Y2hUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fVxuXG5cdGRpc3Bvc2VDb21wcmVzc2VkRWxlbWVudHMobm9kZTogSVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8SVNlYXJjaFRyZWVGb2xkZXJNYXRjaD4sIGFueT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSUZvbGRlck1hdGNoVGVtcGxhdGUsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSUZvbGRlck1hdGNoVGVtcGxhdGUpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJGb2xkZXJEZXRhaWxzKGZvbGRlcjogSVNlYXJjaFRyZWVGb2xkZXJNYXRjaCwgdGVtcGxhdGVEYXRhOiBJRm9sZGVyTWF0Y2hUZW1wbGF0ZSkge1xuXHRcdGNvbnN0IGNvdW50ID0gZm9sZGVyLnJlY3Vyc2l2ZU1hdGNoQ291bnQoKTtcblx0XHR0ZW1wbGF0ZURhdGEuYmFkZ2Uuc2V0Q291bnQoY291bnQpO1xuXHRcdHRlbXBsYXRlRGF0YS5iYWRnZS5zZXRUaXRsZUZvcm1hdChjb3VudCA+IDEgPyBubHMubG9jYWxpemUoJ3NlYXJjaEZpbGVNYXRjaGVzJywgXCJ7MH0gZmlsZXMgZm91bmRcIiwgY291bnQpIDogbmxzLmxvY2FsaXplKCdzZWFyY2hGaWxlTWF0Y2gnLCBcInswfSBmaWxlIGZvdW5kXCIsIGNvdW50KSk7XG5cblx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9ucy5jb250ZXh0ID0geyB2aWV3ZXI6IHRoaXMuc2VhcmNoVmlldy5nZXRDb250cm9sKCksIGVsZW1lbnQ6IGZvbGRlciB9IHNhdGlzZmllcyBJU2VhcmNoQWN0aW9uQ29udGV4dDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRmlsZU1hdGNoUmVuZGVyZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlcjxJU2VhcmNoVHJlZUZpbGVNYXRjaCwgYW55LCBJRmlsZU1hdGNoVGVtcGxhdGU+IHtcblx0c3RhdGljIHJlYWRvbmx5IFRFTVBMQVRFX0lEID0gJ2ZpbGVNYXRjaCc7XG5cblx0cmVhZG9ubHkgdGVtcGxhdGVJZCA9IEZpbGVNYXRjaFJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgc2VhcmNoVmlldzogU2VhcmNoVmlldyxcblx0XHRwcml2YXRlIGxhYmVsczogUmVzb3VyY2VMYWJlbHMsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcm90ZWN0ZWQgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHJlbmRlckNvbXByZXNzZWRFbGVtZW50cyhub2RlOiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxJU2VhcmNoVHJlZUZpbGVNYXRjaD4sIGFueT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSUZpbGVNYXRjaFRlbXBsYXRlLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRocm93IG5ldyBFcnJvcignU2hvdWxkIG5ldmVyIGhhcHBlbiBzaW5jZSBub2RlIGlzIGluY29tcHJlc3NpYmxlLicpO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElGaWxlTWF0Y2hUZW1wbGF0ZSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgZWxlbWVudERpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChlbGVtZW50RGlzcG9zYWJsZXMpO1xuXHRcdGNvbnN0IGZpbGVNYXRjaEVsZW1lbnQgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgRE9NLiQoJy5maWxlbWF0Y2gnKSk7XG5cdFx0Y29uc3QgbGFiZWwgPSB0aGlzLmxhYmVscy5jcmVhdGUoZmlsZU1hdGNoRWxlbWVudCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhYmVsKTtcblx0XHRjb25zdCBiYWRnZSA9IG5ldyBDb3VudEJhZGdlKERPTS5hcHBlbmQoZmlsZU1hdGNoRWxlbWVudCwgRE9NLiQoJy5iYWRnZScpKSwge30sIGRlZmF1bHRDb3VudEJhZGdlU3R5bGVzKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoYmFkZ2UpO1xuXHRcdGNvbnN0IGFjdGlvbkJhckNvbnRhaW5lciA9IERPTS5hcHBlbmQoZmlsZU1hdGNoRWxlbWVudCwgRE9NLiQoJy5hY3Rpb25CYXJDb250YWluZXInKSk7XG5cblx0XHRjb25zdCBjb250ZXh0S2V5U2VydmljZU1haW4gPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5jb250ZXh0S2V5U2VydmljZS5jcmVhdGVTY29wZWQoY29udGFpbmVyKSk7XG5cdFx0U2VhcmNoQ29udGV4dC5BSVJlc3VsdHNUaXRsZS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2VNYWluKS5zZXQoZmFsc2UpO1xuXHRcdFNlYXJjaENvbnRleHQuTWF0Y2hGb2N1c0tleS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2VNYWluKS5zZXQoZmFsc2UpO1xuXHRcdFNlYXJjaENvbnRleHQuRmlsZUZvY3VzS2V5LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZU1haW4pLnNldCh0cnVlKTtcblx0XHRTZWFyY2hDb250ZXh0LkZvbGRlckZvY3VzS2V5LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZU1haW4pLnNldChmYWxzZSk7XG5cblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZU1haW5dKSkpO1xuXHRcdGNvbnN0IGFjdGlvbnMgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWVudVdvcmtiZW5jaFRvb2xCYXIsIGFjdGlvbkJhckNvbnRhaW5lciwgTWVudUlkLlNlYXJjaEFjdGlvbk1lbnUsIHtcblx0XHRcdG1lbnVPcHRpb25zOiB7XG5cdFx0XHRcdHNob3VsZEZvcndhcmRBcmdzOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0aGlkZGVuSXRlbVN0cmF0ZWd5OiBIaWRkZW5JdGVtU3RyYXRlZ3kuSWdub3JlLFxuXHRcdFx0dG9vbGJhck9wdGlvbnM6IHtcblx0XHRcdFx0cHJpbWFyeUdyb3VwOiAoZzogc3RyaW5nKSA9PiAvXmlubGluZS8udGVzdChnKSxcblx0XHRcdH0sXG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGVsOiBmaWxlTWF0Y2hFbGVtZW50LFxuXHRcdFx0bGFiZWwsXG5cdFx0XHRiYWRnZSxcblx0XHRcdGFjdGlvbnMsXG5cdFx0XHRkaXNwb3NhYmxlcyxcblx0XHRcdGVsZW1lbnREaXNwb3NhYmxlcyxcblx0XHRcdGNvbnRleHRLZXlTZXJ2aWNlOiBjb250ZXh0S2V5U2VydmljZU1haW5cblx0XHR9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8SVNlYXJjaFRyZWVGaWxlTWF0Y2gsIGFueT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSUZpbGVNYXRjaFRlbXBsYXRlKTogdm9pZCB7XG5cdFx0Y29uc3QgZmlsZU1hdGNoID0gbm9kZS5lbGVtZW50O1xuXHRcdHRlbXBsYXRlRGF0YS5lbC5zZXRBdHRyaWJ1dGUoJ2RhdGEtcmVzb3VyY2UnLCBmaWxlTWF0Y2gucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHRjb25zdCBkZWNvcmF0aW9uQ29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJU2VhcmNoQ29uZmlndXJhdGlvblByb3BlcnRpZXM+KCdzZWFyY2gnKS5kZWNvcmF0aW9ucztcblx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuc2V0RmlsZShmaWxlTWF0Y2gucmVzb3VyY2UsIHsgcmFuZ2U6IGlzU2VhcmNoVHJlZUFJRmlsZU1hdGNoKGZpbGVNYXRjaCkgPyBmaWxlTWF0Y2guZ2V0RnVsbFJhbmdlKCkgOiB1bmRlZmluZWQsIGhpZGVQYXRoOiB0aGlzLnNlYXJjaFZpZXcuaXNUcmVlTGF5b3V0Vmlld1Zpc2libGUgJiYgIShpc1NlYXJjaFRyZWVGb2xkZXJNYXRjaE5vUm9vdChmaWxlTWF0Y2gucGFyZW50KCkpKSwgaGlkZUljb246IGZhbHNlLCBmaWxlRGVjb3JhdGlvbnM6IHsgY29sb3JzOiBkZWNvcmF0aW9uQ29uZmlnLmNvbG9ycywgYmFkZ2VzOiBkZWNvcmF0aW9uQ29uZmlnLmJhZGdlcyB9IH0pO1xuXHRcdGNvbnN0IGNvdW50ID0gZmlsZU1hdGNoLmNvdW50KCk7XG5cdFx0dGVtcGxhdGVEYXRhLmJhZGdlLnNldENvdW50KGNvdW50KTtcblx0XHR0ZW1wbGF0ZURhdGEuYmFkZ2Uuc2V0VGl0bGVGb3JtYXQoY291bnQgPiAxID8gbmxzLmxvY2FsaXplKCdzZWFyY2hNYXRjaGVzJywgXCJ7MH0gbWF0Y2hlcyBmb3VuZFwiLCBjb3VudCkgOiBubHMubG9jYWxpemUoJ3NlYXJjaE1hdGNoJywgXCJ7MH0gbWF0Y2ggZm91bmRcIiwgY291bnQpKTtcblxuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25zLmNvbnRleHQgPSB7IHZpZXdlcjogdGhpcy5zZWFyY2hWaWV3LmdldENvbnRyb2woKSwgZWxlbWVudDogZmlsZU1hdGNoIH0gc2F0aXNmaWVzIElTZWFyY2hBY3Rpb25Db250ZXh0O1xuXG5cdFx0U2VhcmNoQ29udGV4dC5Jc0VkaXRhYmxlSXRlbUtleS5iaW5kVG8odGVtcGxhdGVEYXRhLmNvbnRleHRLZXlTZXJ2aWNlKS5zZXQoIWZpbGVNYXRjaC5oYXNPbmx5UmVhZE9ubHlNYXRjaGVzKCkpO1xuXG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQoZmlsZU1hdGNoLm9uQ2hhbmdlKCgpID0+IHtcblx0XHRcdFNlYXJjaENvbnRleHQuSXNFZGl0YWJsZUl0ZW1LZXkuYmluZFRvKHRlbXBsYXRlRGF0YS5jb250ZXh0S2V5U2VydmljZSkuc2V0KCFmaWxlTWF0Y2guaGFzT25seVJlYWRPbmx5TWF0Y2hlcygpKTtcblx0XHR9KSk7XG5cblx0XHQvLyB3aGVuIGhpZGVzRXhwbG9yZXJBcnJvd3M6IHRydWUsIHRoZW4gdGhlIGZpbGUgbm9kZXMgc2hvdWxkIHN0aWxsIGhhdmUgYSB0d2lzdGllIGJlY2F1c2UgaXQgd291bGQgb3RoZXJ3aXNlXG5cdFx0Ly8gYmUgaGFyZCB0byB0ZWxsIHdoZXRoZXIgdGhlIG5vZGUgaXMgY29sbGFwc2VkIG9yIGV4cGFuZGVkLlxuXHRcdGNvbnN0IHR3aXN0aWVDb250YWluZXIgPSB0ZW1wbGF0ZURhdGEuZWwucGFyZW50RWxlbWVudD8ucGFyZW50RWxlbWVudD8ucXVlcnlTZWxlY3RvcignLm1vbmFjby10bC10d2lzdGllJyk7XG5cdFx0dHdpc3RpZUNvbnRhaW5lcj8uY2xhc3NMaXN0LmFkZCgnZm9yY2UtdHdpc3RpZScpO1xuXHR9XG5cblx0ZGlzcG9zZUVsZW1lbnQoZWxlbWVudDogSVRyZWVOb2RlPFJlbmRlcmFibGVNYXRjaCwgYW55PiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJRmlsZU1hdGNoVGVtcGxhdGUpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJRmlsZU1hdGNoVGVtcGxhdGUpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNYXRjaFJlbmRlcmVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElDb21wcmVzc2libGVUcmVlUmVuZGVyZXI8SVNlYXJjaFRyZWVNYXRjaCwgdm9pZCwgSU1hdGNoVGVtcGxhdGU+IHtcblx0c3RhdGljIHJlYWRvbmx5IFRFTVBMQVRFX0lEID0gJ21hdGNoJztcblxuXHRyZWFkb25seSB0ZW1wbGF0ZUlkID0gTWF0Y2hSZW5kZXJlci5URU1QTEFURV9JRDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHNlYXJjaFZpZXc6IFNlYXJjaFZpZXcsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcm90ZWN0ZWQgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cdHJlbmRlckNvbXByZXNzZWRFbGVtZW50cyhub2RlOiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxJU2VhcmNoVHJlZU1hdGNoPiwgdm9pZD4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSU1hdGNoVGVtcGxhdGUsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdTaG91bGQgbmV2ZXIgaGFwcGVuIHNpbmNlIG5vZGUgaXMgaW5jb21wcmVzc2libGUuJyk7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSU1hdGNoVGVtcGxhdGUge1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdsaW5lbWF0Y2gnKTtcblxuXHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgRE9NLiQoJ3NwYW4ubWF0Y2hMaW5lTnVtJykpO1xuXHRcdGNvbnN0IHBhcmVudCA9IERPTS5hcHBlbmQoY29udGFpbmVyLCBET00uJCgnYS5wbGFpbi5tYXRjaCcpKTtcblx0XHRjb25zdCBiZWZvcmUgPSBET00uYXBwZW5kKHBhcmVudCwgRE9NLiQoJ3NwYW4nKSk7XG5cdFx0Y29uc3QgbWF0Y2ggPSBET00uYXBwZW5kKHBhcmVudCwgRE9NLiQoJ3NwYW4uZmluZEluRmlsZU1hdGNoJykpO1xuXHRcdGNvbnN0IHJlcGxhY2UgPSBET00uYXBwZW5kKHBhcmVudCwgRE9NLiQoJ3NwYW4ucmVwbGFjZU1hdGNoJykpO1xuXHRcdGNvbnN0IGFmdGVyID0gRE9NLmFwcGVuZChwYXJlbnQsIERPTS4kKCdzcGFuJykpO1xuXHRcdGNvbnN0IGFjdGlvbkJhckNvbnRhaW5lciA9IERPTS5hcHBlbmQoY29udGFpbmVyLCBET00uJCgnc3Bhbi5hY3Rpb25CYXJDb250YWluZXInKSk7XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlTWFpbiA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZChjb250YWluZXIpKTtcblx0XHRTZWFyY2hDb250ZXh0LkFJUmVzdWx0c1RpdGxlLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZU1haW4pLnNldChmYWxzZSk7XG5cdFx0U2VhcmNoQ29udGV4dC5NYXRjaEZvY3VzS2V5LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZU1haW4pLnNldCh0cnVlKTtcblx0XHRTZWFyY2hDb250ZXh0LkZpbGVGb2N1c0tleS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2VNYWluKS5zZXQoZmFsc2UpO1xuXHRcdFNlYXJjaENvbnRleHQuRm9sZGVyRm9jdXNLZXkuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlTWFpbikuc2V0KGZhbHNlKTtcblxuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlQ2hpbGQobmV3IFNlcnZpY2VDb2xsZWN0aW9uKFtJQ29udGV4dEtleVNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlTWFpbl0pKSk7XG5cdFx0Y29uc3QgYWN0aW9ucyA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51V29ya2JlbmNoVG9vbEJhciwgYWN0aW9uQmFyQ29udGFpbmVyLCBNZW51SWQuU2VhcmNoQWN0aW9uTWVudSwge1xuXHRcdFx0bWVudU9wdGlvbnM6IHtcblx0XHRcdFx0c2hvdWxkRm9yd2FyZEFyZ3M6IHRydWVcblx0XHRcdH0sXG5cdFx0XHRoaWRkZW5JdGVtU3RyYXRlZ3k6IEhpZGRlbkl0ZW1TdHJhdGVneS5JZ25vcmUsXG5cdFx0XHR0b29sYmFyT3B0aW9uczoge1xuXHRcdFx0XHRwcmltYXJ5R3JvdXA6IChnOiBzdHJpbmcpID0+IC9eaW5saW5lLy50ZXN0KGcpLFxuXHRcdFx0fSxcblx0XHR9KSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cGFyZW50LFxuXHRcdFx0YmVmb3JlLFxuXHRcdFx0bWF0Y2gsXG5cdFx0XHRyZXBsYWNlLFxuXHRcdFx0YWZ0ZXIsXG5cdFx0XHRsaW5lTnVtYmVyLFxuXHRcdFx0YWN0aW9ucyxcblx0XHRcdGRpc3Bvc2FibGVzLFxuXHRcdFx0Y29udGV4dEtleVNlcnZpY2U6IGNvbnRleHRLZXlTZXJ2aWNlTWFpblxuXHRcdH07XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KG5vZGU6IElUcmVlTm9kZTxJU2VhcmNoVHJlZU1hdGNoLCBhbnk+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElNYXRjaFRlbXBsYXRlKTogdm9pZCB7XG5cdFx0Y29uc3QgbWF0Y2ggPSBub2RlLmVsZW1lbnQ7XG5cdFx0Y29uc3QgcHJldmlldyA9IG1hdGNoLnByZXZpZXcoKTtcblx0XHRjb25zdCByZXBsYWNlID0gdGhpcy5zZWFyY2hWaWV3Lm1vZGVsLmlzUmVwbGFjZUFjdGl2ZSgpICYmXG5cdFx0XHQhIXRoaXMuc2VhcmNoVmlldy5tb2RlbC5yZXBsYWNlU3RyaW5nICYmXG5cdFx0XHQhbWF0Y2guaXNSZWFkb25seTtcblxuXHRcdHRlbXBsYXRlRGF0YS5iZWZvcmUudGV4dENvbnRlbnQgPSBwcmV2aWV3LmJlZm9yZTtcblx0XHR0ZW1wbGF0ZURhdGEubWF0Y2gudGV4dENvbnRlbnQgPSBwcmV2aWV3Lmluc2lkZTtcblx0XHR0ZW1wbGF0ZURhdGEubWF0Y2guY2xhc3NMaXN0LnRvZ2dsZSgncmVwbGFjZScsIHJlcGxhY2UpO1xuXHRcdHRlbXBsYXRlRGF0YS5yZXBsYWNlLnRleHRDb250ZW50ID0gcmVwbGFjZSA/IG1hdGNoLnJlcGxhY2VTdHJpbmcgOiAnJztcblx0XHR0ZW1wbGF0ZURhdGEuYWZ0ZXIudGV4dENvbnRlbnQgPSBwcmV2aWV3LmFmdGVyO1xuXG5cdFx0Y29uc3QgdGl0bGUgPSAocHJldmlldy5mdWxsQmVmb3JlICsgKHJlcGxhY2UgPyBtYXRjaC5yZXBsYWNlU3RyaW5nIDogcHJldmlldy5pbnNpZGUpICsgcHJldmlldy5hZnRlcikudHJpbSgpLnN1YnN0cigwLCA5OTkpO1xuXHRcdHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlcy5hZGQodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIHRlbXBsYXRlRGF0YS5wYXJlbnQsIHRpdGxlKSk7XG5cblx0XHRTZWFyY2hDb250ZXh0LklzRWRpdGFibGVJdGVtS2V5LmJpbmRUbyh0ZW1wbGF0ZURhdGEuY29udGV4dEtleVNlcnZpY2UpLnNldCghbWF0Y2guaXNSZWFkb25seSk7XG5cblx0XHRjb25zdCBudW1MaW5lcyA9IG1hdGNoLnJhbmdlKCkuZW5kTGluZU51bWJlciAtIG1hdGNoLnJhbmdlKCkuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdGNvbnN0IGV4dHJhTGluZXNTdHIgPSBudW1MaW5lcyA+IDAgPyBgKyR7bnVtTGluZXN9YCA6ICcnO1xuXG5cdFx0Y29uc3Qgc2hvd0xpbmVOdW1iZXJzID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJU2VhcmNoQ29uZmlndXJhdGlvblByb3BlcnRpZXM+KCdzZWFyY2gnKS5zaG93TGluZU51bWJlcnM7XG5cdFx0Y29uc3QgbGluZU51bWJlclN0ciA9IHNob3dMaW5lTnVtYmVycyA/IGAke21hdGNoLnJhbmdlKCkuc3RhcnRMaW5lTnVtYmVyfTpgIDogJyc7XG5cdFx0dGVtcGxhdGVEYXRhLmxpbmVOdW1iZXIuY2xhc3NMaXN0LnRvZ2dsZSgnc2hvdycsIChudW1MaW5lcyA+IDApIHx8IHNob3dMaW5lTnVtYmVycyk7XG5cblx0XHR0ZW1wbGF0ZURhdGEubGluZU51bWJlci50ZXh0Q29udGVudCA9IGxpbmVOdW1iZXJTdHIgKyBleHRyYUxpbmVzU3RyO1xuXHRcdHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlcy5hZGQodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIHRlbXBsYXRlRGF0YS5saW5lTnVtYmVyLCB0aGlzLmdldE1hdGNoVGl0bGUobWF0Y2gsIHNob3dMaW5lTnVtYmVycykpKTtcblxuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25zLmNvbnRleHQgPSB7IHZpZXdlcjogdGhpcy5zZWFyY2hWaWV3LmdldENvbnRyb2woKSwgZWxlbWVudDogbWF0Y2ggfSBzYXRpc2ZpZXMgSVNlYXJjaEFjdGlvbkNvbnRleHQ7XG5cblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElNYXRjaFRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0TWF0Y2hUaXRsZShtYXRjaDogSVNlYXJjaFRyZWVNYXRjaCwgc2hvd0xpbmVOdW1iZXJzOiBib29sZWFuKTogc3RyaW5nIHtcblx0XHRjb25zdCBzdGFydExpbmUgPSBtYXRjaC5yYW5nZSgpLnN0YXJ0TGluZU51bWJlcjtcblx0XHRjb25zdCBudW1MaW5lcyA9IG1hdGNoLnJhbmdlKCkuZW5kTGluZU51bWJlciAtIG1hdGNoLnJhbmdlKCkuc3RhcnRMaW5lTnVtYmVyO1xuXG5cdFx0Y29uc3QgbGluZU51bVN0ciA9IHNob3dMaW5lTnVtYmVycyA/XG5cdFx0XHRubHMubG9jYWxpemUoJ2xpbmVOdW1TdHInLCBcIkZyb20gbGluZSB7MH1cIiwgc3RhcnRMaW5lLCBudW1MaW5lcykgKyAnICcgOlxuXHRcdFx0Jyc7XG5cblx0XHRjb25zdCBudW1MaW5lc1N0ciA9IG51bUxpbmVzID4gMCA/XG5cdFx0XHQnKyAnICsgbmxzLmxvY2FsaXplKCdudW1MaW5lc1N0cicsIFwiezB9IG1vcmUgbGluZXNcIiwgbnVtTGluZXMpIDpcblx0XHRcdCcnO1xuXG5cdFx0cmV0dXJuIGxpbmVOdW1TdHIgKyBudW1MaW5lc1N0cjtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2VhcmNoQWNjZXNzaWJpbGl0eVByb3ZpZGVyIGltcGxlbWVudHMgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8UmVuZGVyYWJsZU1hdGNoPiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBzZWFyY2hWaWV3OiBTZWFyY2hWaWV3LFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlXG5cdCkge1xuXHR9XG5cblx0Z2V0V2lkZ2V0QXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnc2VhcmNoJywgXCJTZWFyY2hcIik7XG5cdH1cblxuXHRnZXRBcmlhTGFiZWwoZWxlbWVudDogUmVuZGVyYWJsZU1hdGNoKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0aWYgKGlzU2VhcmNoVHJlZUZvbGRlck1hdGNoKGVsZW1lbnQpKSB7XG5cdFx0XHRjb25zdCBjb3VudCA9IGVsZW1lbnQuYWxsRG93bnN0cmVhbUZpbGVNYXRjaGVzKCkucmVkdWNlKCh0b3RhbCwgY3VycmVudCkgPT4gdG90YWwgKyBjdXJyZW50LmNvdW50KCksIDApO1xuXHRcdFx0cmV0dXJuIGVsZW1lbnQucmVzb3VyY2UgP1xuXHRcdFx0XHRubHMubG9jYWxpemUoJ2ZvbGRlck1hdGNoQXJpYUxhYmVsJywgXCJ7MH0gbWF0Y2hlcyBpbiBmb2xkZXIgcm9vdCB7MX0sIFNlYXJjaCByZXN1bHRcIiwgY291bnQsIGVsZW1lbnQubmFtZSgpKSA6XG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnb3RoZXJGaWxlc0FyaWFMYWJlbCcsIFwiezB9IG1hdGNoZXMgb3V0c2lkZSBvZiB0aGUgd29ya3NwYWNlLCBTZWFyY2ggcmVzdWx0XCIsIGNvdW50KTtcblx0XHR9XG5cblx0XHRpZiAoaXNTZWFyY2hUcmVlRmlsZU1hdGNoKGVsZW1lbnQpKSB7XG5cdFx0XHRjb25zdCBwYXRoID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoZWxlbWVudC5yZXNvdXJjZSwgeyByZWxhdGl2ZTogdHJ1ZSB9KSB8fCBlbGVtZW50LnJlc291cmNlLmZzUGF0aDtcblxuXHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnZmlsZU1hdGNoQXJpYUxhYmVsJywgXCJ7MH0gbWF0Y2hlcyBpbiBmaWxlIHsxfSBvZiBmb2xkZXIgezJ9LCBTZWFyY2ggcmVzdWx0XCIsIGVsZW1lbnQuY291bnQoKSwgZWxlbWVudC5uYW1lKCksIHBhdGhzLmRpcm5hbWUocGF0aCkpO1xuXHRcdH1cblxuXHRcdGlmIChpc1NlYXJjaFRyZWVNYXRjaChlbGVtZW50KSkge1xuXHRcdFx0Y29uc3QgbWF0Y2ggPSA8SVNlYXJjaFRyZWVNYXRjaD5lbGVtZW50O1xuXHRcdFx0Y29uc3Qgc2VhcmNoTW9kZWw6IElTZWFyY2hNb2RlbCA9IHRoaXMuc2VhcmNoVmlldy5tb2RlbDtcblx0XHRcdGNvbnN0IHJlcGxhY2UgPSBzZWFyY2hNb2RlbC5pc1JlcGxhY2VBY3RpdmUoKSAmJiAhIXNlYXJjaE1vZGVsLnJlcGxhY2VTdHJpbmc7XG5cdFx0XHRjb25zdCBtYXRjaFN0cmluZyA9IG1hdGNoLmdldE1hdGNoU3RyaW5nKCk7XG5cdFx0XHRjb25zdCByYW5nZSA9IG1hdGNoLnJhbmdlKCk7XG5cdFx0XHRjb25zdCBtYXRjaFRleHQgPSBtYXRjaC50ZXh0KCkuc3Vic3RyKDAsIHJhbmdlLmVuZENvbHVtbiArIDE1MCk7XG5cdFx0XHRpZiAocmVwbGFjZSkge1xuXHRcdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdyZXBsYWNlUHJldmlld1Jlc3VsdEFyaWEnLCBcIid7MH0nIGF0IGNvbHVtbiB7MX0gcmVwbGFjZSB7Mn0gd2l0aCB7M31cIiwgbWF0Y2hUZXh0LCByYW5nZS5zdGFydENvbHVtbiwgbWF0Y2hTdHJpbmcsIG1hdGNoLnJlcGxhY2VTdHJpbmcpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdzZWFyY2hSZXN1bHRBcmlhJywgXCInezB9JyBhdCBjb2x1bW4gezF9IGZvdW5kIHsyfVwiLCBtYXRjaFRleHQsIHJhbmdlLnN0YXJ0Q29sdW1uLCBtYXRjaFN0cmluZyk7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLGtCQUFrQjtBQUkzQixTQUFTLFlBQVksdUJBQXVCO0FBQzVDLFlBQVksV0FBVztBQUN2QixZQUFZLFNBQVM7QUFDckIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxxQkFBcUI7QUFFOUIsU0FBUyxnQ0FBZ0M7QUFHekMsU0FBUyxlQUFlO0FBR3hCLFNBQVMsY0FBYztBQUN2QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG9CQUFvQiw0QkFBNEI7QUFFekQsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxlQUFlO0FBQ3hCLFNBQTJCLG1CQUFzRyx1QkFBdUIseUJBQXlCLHFCQUFtQyxzQ0FBc0MsK0JBQStCLGdDQUFnQztBQUN6VCxTQUFTLCtCQUErQjtBQXdDakMsTUFBTSxrQkFBTixNQUFNLGdCQUFnRTtBQUFBLEVBSTVFLFVBQVUsU0FBa0M7QUFDM0MsV0FBTyxnQkFBZTtBQUFBLEVBQ3ZCO0FBQUEsRUFFQSxjQUFjLFNBQWtDO0FBQy9DLFFBQUksd0JBQXdCLE9BQU8sR0FBRztBQUNyQyxhQUFPLG9CQUFvQjtBQUFBLElBQzVCLFdBQVcsc0JBQXNCLE9BQU8sR0FBRztBQUMxQyxh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
