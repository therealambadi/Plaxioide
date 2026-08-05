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
import { compareFileNames } from "../../../../base/common/comparers.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { createMatches } from "../../../../base/common/filters.js";
import * as glob from "../../../../base/common/glob.js";
import { DisposableStore, MutableDisposable, Disposable } from "../../../../base/common/lifecycle.js";
import { posix, relative } from "../../../../base/common/path.js";
import { basename, dirname, isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import "./media/breadcrumbscontrol.css";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { FileKind, IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchDataTree, WorkbenchAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { breadcrumbsPickerBackground, widgetBorder, widgetShadow } from "../../../../platform/theme/common/colorRegistry.js";
import { isWorkspace, isWorkspaceFolder, IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { ResourceLabels, DEFAULT_LABELS_CONTAINER } from "../../labels.js";
import { BreadcrumbsConfig } from "./breadcrumbs.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { localize } from "../../../../nls.js";
import { IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
let BreadcrumbsPicker = class {
  constructor(parent, resource, _instantiationService, _themeService, _configurationService) {
    this.resource = resource;
    this._instantiationService = _instantiationService;
    this._themeService = _themeService;
    this._configurationService = _configurationService;
    this._disposables = new DisposableStore();
    this._fakeEvent = new UIEvent("fakeEvent");
    this._onWillPickElement = new Emitter();
    this.onWillPickElement = this._onWillPickElement.event;
    this._previewDispoables = new MutableDisposable();
    this._domNode = document.createElement("div");
    this._domNode.className = "monaco-breadcrumbs-picker show-file-icons";
    parent.appendChild(this._domNode);
  }
  dispose() {
    this._disposables.dispose();
    this._previewDispoables.dispose();
    this._onWillPickElement.dispose();
    this._domNode.remove();
    setTimeout(() => this._tree.dispose(), 0);
  }
  async show(input, maxHeight, width, arrowSize, arrowOffset) {
    const theme = this._themeService.getColorTheme();
    const color = theme.getColor(breadcrumbsPickerBackground);
    this._arrow = document.createElement("div");
    this._arrow.className = "arrow";
    this._arrow.style.borderColor = `transparent transparent ${color ? color.toString() : ""}`;
    this._domNode.appendChild(this._arrow);
    this._treeContainer = document.createElement("div");
    this._treeContainer.style.background = color ? color.toString() : "";
    this._treeContainer.style.paddingTop = "2px";
    this._treeContainer.style.borderRadius = "3px";
    this._treeContainer.style.boxShadow = `0 0 8px 2px ${this._themeService.getColorTheme().getColor(widgetShadow)}`;
    this._treeContainer.style.border = `1px solid ${this._themeService.getColorTheme().getColor(widgetBorder)}`;
    this._domNode.appendChild(this._treeContainer);
    this._layoutInfo = { maxHeight, width, arrowSize, arrowOffset, inputHeight: 0 };
    this._tree = this._createTree(this._treeContainer, input);
    this._disposables.add(this._tree.onDidOpen(async (e) => {
      const { element, editorOptions, sideBySide } = e;
      const didReveal = await this._revealElement(element, { ...editorOptions, preserveFocus: false }, sideBySide);
      if (!didReveal) {
        return;
      }
    }));
    this._disposables.add(this._tree.onDidChangeFocus((e) => {
      this._previewDispoables.value = this._previewElement(e.elements[0]);
    }));
    this._disposables.add(this._tree.onDidChangeContentHeight(() => {
      this._layout();
    }));
    this._domNode.focus();
    try {
      await this._setInput(input);
      this._layout();
    } catch (err) {
      onUnexpectedError(err);
    }
  }
  _layout() {
    const headerHeight = 2 * this._layoutInfo.arrowSize;
    const treeHeight = Math.min(this._layoutInfo.maxHeight - headerHeight, this._tree.contentHeight);
    const totalHeight = treeHeight + headerHeight;
    this._domNode.style.height = `${totalHeight}px`;
    this._domNode.style.width = `${this._layoutInfo.width}px`;
    this._arrow.style.top = `-${2 * this._layoutInfo.arrowSize}px`;
    this._arrow.style.borderWidth = `${this._layoutInfo.arrowSize}px`;
    this._arrow.style.marginLeft = `${this._layoutInfo.arrowOffset}px`;
    this._treeContainer.style.height = `${treeHeight}px`;
    this._treeContainer.style.width = `${this._layoutInfo.width}px`;
    this._tree.layout(treeHeight, this._layoutInfo.width);
  }
  restoreViewState() {
  }
};
BreadcrumbsPicker = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, IConfigurationService)
], BreadcrumbsPicker);
class FileVirtualDelegate {
  getHeight(_element) {
    return 22;
  }
  getTemplateId(_element) {
    return "FileStat";
  }
}
class FileIdentityProvider {
  getId(element) {
    if (URI.isUri(element)) {
      return element.toString();
    } else if (isWorkspace(element)) {
      return element.id;
    } else if (isWorkspaceFolder(element)) {
      return element.uri.toString();
    } else {
      return element.resource.toString();
    }
  }
}
let FileDataSource = class {
  constructor(_fileService) {
    this._fileService = _fileService;
  }
  hasChildren(element) {
    return URI.isUri(element) || isWorkspace(element) || isWorkspaceFolder(element) || element.isDirectory;
  }
  async getChildren(element) {
    if (isWorkspace(element)) {
      return element.folders;
    }
    let uri;
    if (isWorkspaceFolder(element)) {
      uri = element.uri;
    } else if (URI.isUri(element)) {
      uri = element;
    } else {
      uri = element.resource;
    }
    const stat = await this._fileService.resolve(uri);
    return stat.children ?? [];
  }
};
FileDataSource = __decorateClass([
  __decorateParam(0, IFileService)
], FileDataSource);
let FileRenderer = class {
  constructor(_labels, _configService) {
    this._labels = _labels;
    this._configService = _configService;
    this.templateId = "FileStat";
  }
  renderTemplate(container) {
    return this._labels.create(container, { supportHighlights: true });
  }
  renderElement(node, index, templateData) {
    const fileDecorations = this._configService.getValue("explorer.decorations");
    const { element } = node;
    let resource;
    let fileKind;
    if (isWorkspaceFolder(element)) {
      resource = element.uri;
      fileKind = FileKind.ROOT_FOLDER;
    } else {
      resource = element.resource;
      fileKind = element.isDirectory ? FileKind.FOLDER : FileKind.FILE;
    }
    templateData.setFile(resource, {
      fileKind,
      hidePath: true,
      fileDecorations,
      matches: createMatches(node.filterData),
      extraClasses: ["picker-item"]
    });
  }
  disposeTemplate(templateData) {
    templateData.dispose();
  }
};
FileRenderer = __decorateClass([
  __decorateParam(1, IConfigurationService)
], FileRenderer);
class FileNavigationLabelProvider {
  getKeyboardNavigationLabel(element) {
    return element.name;
  }
}
class FileAccessibilityProvider {
  getWidgetAriaLabel() {
    return localize("breadcrumbs", "Breadcrumbs");
  }
  getAriaLabel(element) {
    return element.name;
  }
}
let FileFilter = class {
  constructor(_workspaceService, configService) {
    this._workspaceService = _workspaceService;
    this._cachedExpressions = /* @__PURE__ */ new Map();
    this._disposables = new DisposableStore();
    const config = BreadcrumbsConfig.FileExcludes.bindTo(configService);
    const update = () => {
      _workspaceService.getWorkspace().folders.forEach((folder) => {
        const excludesConfig = config.getValue({ resource: folder.uri });
        if (!excludesConfig) {
          return;
        }
        const adjustedConfig = {};
        for (const pattern in excludesConfig) {
          if (typeof excludesConfig[pattern] !== "boolean") {
            continue;
          }
          const patternAbs = pattern.indexOf("**/") !== 0 ? posix.join(folder.uri.path, pattern) : pattern;
          adjustedConfig[patternAbs] = excludesConfig[pattern];
        }
        this._cachedExpressions.set(folder.uri.toString(), glob.parse(adjustedConfig));
      });
    };
    update();
    this._disposables.add(config);
    this._disposables.add(config.onDidChange(update));
    this._disposables.add(_workspaceService.onDidChangeWorkspaceFolders(update));
  }
  dispose() {
    this._disposables.dispose();
  }
  filter(element, _parentVisibility) {
    if (isWorkspaceFolder(element)) {
      return true;
    }
    const folder = this._workspaceService.getWorkspaceFolder(element.resource);
    if (!folder || !this._cachedExpressions.has(folder.uri.toString())) {
      return true;
    }
    const expression = this._cachedExpressions.get(folder.uri.toString());
    return !expression(relative(folder.uri.path, element.resource.path), basename(element.resource));
  }
};
FileFilter = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, IConfigurationService)
], FileFilter);
class FileSorter {
  compare(a, b) {
    if (isWorkspaceFolder(a) && isWorkspaceFolder(b)) {
      return a.index - b.index;
    }
    if (a.isDirectory === b.isDirectory) {
      return compareFileNames(a.name, b.name);
    } else if (a.isDirectory) {
      return -1;
    } else {
      return 1;
    }
  }
}
let BreadcrumbsFilePicker = class extends BreadcrumbsPicker {
  constructor(parent, resource, instantiationService, themeService, configService, _workspaceService, _editorService) {
    super(parent, resource, instantiationService, themeService, configService);
    this._workspaceService = _workspaceService;
    this._editorService = _editorService;
  }
  _createTree(container) {
    this._treeContainer.classList.add("file-icon-themable-tree");
    this._treeContainer.classList.add("show-file-icons");
    const onFileIconThemeChange = (fileIconTheme) => {
      this._treeContainer.classList.toggle("align-icons-and-twisties", fileIconTheme.hasFileIcons && !fileIconTheme.hasFolderIcons);
      this._treeContainer.classList.toggle("hide-arrows", fileIconTheme.hidesExplorerArrows === true);
    };
    this._disposables.add(this._themeService.onDidFileIconThemeChange(onFileIconThemeChange));
    onFileIconThemeChange(this._themeService.getFileIconTheme());
    const labels = this._instantiationService.createInstance(
      ResourceLabels,
      DEFAULT_LABELS_CONTAINER
      /* TODO@Jo visibility propagation */
    );
    this._disposables.add(labels);
    return this._instantiationService.createInstance(
      WorkbenchAsyncDataTree,
      "BreadcrumbsFilePicker",
      container,
      new FileVirtualDelegate(),
      [this._instantiationService.createInstance(FileRenderer, labels)],
      this._instantiationService.createInstance(FileDataSource),
      {
        multipleSelectionSupport: false,
        sorter: new FileSorter(),
        filter: this._instantiationService.createInstance(FileFilter),
        identityProvider: new FileIdentityProvider(),
        keyboardNavigationLabelProvider: new FileNavigationLabelProvider(),
        accessibilityProvider: this._instantiationService.createInstance(FileAccessibilityProvider),
        showNotFoundMessage: false,
        overrideStyles: {
          listBackground: breadcrumbsPickerBackground
        }
      }
    );
  }
  async _setInput(element) {
    const { uri, kind } = element;
    let input;
    if (kind === FileKind.ROOT_FOLDER) {
      input = this._workspaceService.getWorkspace();
    } else {
      input = dirname(uri);
    }
    const tree = this._tree;
    await tree.setInput(input);
    let focusElement;
    for (const { element: element2 } of tree.getNode().children) {
      if (isWorkspaceFolder(element2) && isEqual(element2.uri, uri)) {
        focusElement = element2;
        break;
      } else if (isEqual(element2.resource, uri)) {
        focusElement = element2;
        break;
      }
    }
    if (focusElement) {
      tree.reveal(focusElement, 0.5);
      tree.setFocus([focusElement], this._fakeEvent);
    }
    tree.domFocus();
  }
  _previewElement(_element) {
    return Disposable.None;
  }
  async _revealElement(element, options, sideBySide) {
    if (!isWorkspaceFolder(element) && element.isFile) {
      this._onWillPickElement.fire();
      await this._editorService.openEditor({ resource: element.resource, options }, sideBySide ? SIDE_GROUP : void 0);
      return true;
    }
    return false;
  }
};
BreadcrumbsFilePicker = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, IEditorService)
], BreadcrumbsFilePicker);
let OutlineTreeSorter = class {
  constructor(comparator, uri, configService) {
    this.comparator = comparator;
    this._order = configService.getValue(uri, "breadcrumbs.symbolSortOrder");
  }
  compare(a, b) {
    if (this._order === "name") {
      return this.comparator.compareByName(a, b);
    } else if (this._order === "type") {
      return this.comparator.compareByType(a, b);
    } else {
      return this.comparator.compareByPosition(a, b);
    }
  }
};
OutlineTreeSorter = __decorateClass([
  __decorateParam(2, ITextResourceConfigurationService)
], OutlineTreeSorter);
class BreadcrumbsOutlinePicker extends BreadcrumbsPicker {
  _createTree(container, input) {
    const { config } = input.outline;
    return this._instantiationService.createInstance(
      WorkbenchDataTree,
      "BreadcrumbsOutlinePicker",
      container,
      config.delegate,
      config.renderers,
      config.treeDataSource,
      {
        ...config.options,
        sorter: this._instantiationService.createInstance(OutlineTreeSorter, config.comparator, void 0),
        collapseByDefault: true,
        expandOnlyOnTwistieClick: true,
        multipleSelectionSupport: false,
        showNotFoundMessage: false
      }
    );
  }
  _setInput(input) {
    const viewState = input.outline.captureViewState();
    this.restoreViewState = () => {
      viewState.dispose();
    };
    const tree = this._tree;
    tree.setInput(input.outline);
    if (input.element !== input.outline) {
      tree.reveal(input.element, 0.5);
      tree.setFocus([input.element], this._fakeEvent);
    }
    tree.domFocus();
    return Promise.resolve();
  }
  _previewElement(element) {
    const outline = this._tree.getInput();
    return outline.preview(element);
  }
  async _revealElement(element, options, sideBySide) {
    this._onWillPickElement.fire();
    const outline = this._tree.getInput();
    await outline.reveal(element, options, sideBySide, false);
    return true;
  }
}
export {
  BreadcrumbsFilePicker,
  BreadcrumbsOutlinePicker,
  BreadcrumbsPicker,
  FileSorter
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvYnJlYWRjcnVtYnNQaWNrZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBjb21wYXJlRmlsZU5hbWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29tcGFyZXJzLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgY3JlYXRlTWF0Y2hlcywgRnV6enlTY29yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2ZpbHRlcnMuanMnO1xuaW1wb3J0ICogYXMgZ2xvYiBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9nbG9iLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIE11dGFibGVEaXNwb3NhYmxlLCBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHBvc2l4LCByZWxhdGl2ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGRpcm5hbWUsIGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAnLi9tZWRpYS9icmVhZGNydW1ic2NvbnRyb2wuY3NzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgRmlsZUtpbmQsIElGaWxlU2VydmljZSwgSUZpbGVTdGF0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoRGF0YVRyZWUsIFdvcmtiZW5jaEFzeW5jRGF0YVRyZWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgYnJlYWRjcnVtYnNQaWNrZXJCYWNrZ3JvdW5kLCB3aWRnZXRCb3JkZXIsIHdpZGdldFNoYWRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGlzV29ya3NwYWNlLCBpc1dvcmtzcGFjZUZvbGRlciwgSVdvcmtzcGFjZSwgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBJV29ya3NwYWNlRm9sZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VMYWJlbHMsIElSZXNvdXJjZUxhYmVsLCBERUZBVUxUX0xBQkVMU19DT05UQUlORVIgfSBmcm9tICcuLi8uLi9sYWJlbHMuanMnO1xuaW1wb3J0IHsgQnJlYWRjcnVtYnNDb25maWcgfSBmcm9tICcuL2JyZWFkY3J1bWJzLmpzJztcbmltcG9ydCB7IE91dGxpbmVFbGVtZW50MiwgRmlsZUVsZW1lbnQgfSBmcm9tICcuL2JyZWFkY3J1bWJzTW9kZWwuanMnO1xuaW1wb3J0IHsgSUFzeW5jRGF0YVNvdXJjZSwgSVRyZWVSZW5kZXJlciwgSVRyZWVOb2RlLCBJVHJlZUZpbHRlciwgVHJlZVZpc2liaWxpdHksIElUcmVlU29ydGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBJSWRlbnRpdHlQcm92aWRlciwgSUxpc3RWaXJ0dWFsRGVsZWdhdGUsIElLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBJRmlsZUljb25UaGVtZSwgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0V2lkZ2V0LmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElPdXRsaW5lLCBJT3V0bGluZUNvbXBhcmF0b3IgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9vdXRsaW5lL2Jyb3dzZXIvb3V0bGluZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlLCBTSURFX0dST1VQIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvdGV4dFJlc291cmNlQ29uZmlndXJhdGlvbi5qcyc7XG5cbmludGVyZmFjZSBJTGF5b3V0SW5mbyB7XG5cdG1heEhlaWdodDogbnVtYmVyO1xuXHR3aWR0aDogbnVtYmVyO1xuXHRhcnJvd1NpemU6IG51bWJlcjtcblx0YXJyb3dPZmZzZXQ6IG51bWJlcjtcblx0aW5wdXRIZWlnaHQ6IG51bWJlcjtcbn1cblxudHlwZSBUcmVlPEksIEU+ID0gV29ya2JlbmNoRGF0YVRyZWU8SSwgRSwgRnV6enlTY29yZT4gfCBXb3JrYmVuY2hBc3luY0RhdGFUcmVlPEksIEUsIEZ1enp5U2NvcmU+O1xuXG5leHBvcnQgaW50ZXJmYWNlIFNlbGVjdEV2ZW50IHtcblx0dGFyZ2V0OiBhbnk7XG5cdGJyb3dzZXJFdmVudDogVUlFdmVudDtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJyZWFkY3J1bWJzUGlja2VyIHtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX2Rpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX2RvbU5vZGU6IEhUTUxEaXZFbGVtZW50O1xuXHRwcm90ZWN0ZWQgX2Fycm93ITogSFRNTERpdkVsZW1lbnQ7XG5cdHByb3RlY3RlZCBfdHJlZUNvbnRhaW5lciE6IEhUTUxEaXZFbGVtZW50O1xuXHRwcm90ZWN0ZWQgX3RyZWUhOiBUcmVlPGFueSwgYW55Pjtcblx0cHJvdGVjdGVkIF9mYWtlRXZlbnQgPSBuZXcgVUlFdmVudCgnZmFrZUV2ZW50Jyk7XG5cdHByb3RlY3RlZCBfbGF5b3V0SW5mbyE6IElMYXlvdXRJbmZvO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25XaWxsUGlja0VsZW1lbnQgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbldpbGxQaWNrRWxlbWVudDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbldpbGxQaWNrRWxlbWVudC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9wcmV2aWV3RGlzcG9hYmxlcyA9IG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHBhcmVudDogSFRNTEVsZW1lbnQsXG5cdFx0cHJvdGVjdGVkIHJlc291cmNlOiBVUkksXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IF90aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuX2RvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTmFtZSA9ICdtb25hY28tYnJlYWRjcnVtYnMtcGlja2VyIHNob3ctZmlsZS1pY29ucyc7XG5cdFx0cGFyZW50LmFwcGVuZENoaWxkKHRoaXMuX2RvbU5vZGUpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fcHJldmlld0Rpc3BvYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX29uV2lsbFBpY2tFbGVtZW50LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9kb21Ob2RlLnJlbW92ZSgpO1xuXHRcdHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fdHJlZS5kaXNwb3NlKCksIDApOyAvLyB0cmVlIGNhbm5vdCBiZSBkaXNwb3NlZCB3aGlsZSBiZWluZyBvcGVuZWQuLi5cblx0fVxuXG5cdGFzeW5jIHNob3coaW5wdXQ6IGFueSwgbWF4SGVpZ2h0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIsIGFycm93U2l6ZTogbnVtYmVyLCBhcnJvd09mZnNldDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHRjb25zdCB0aGVtZSA9IHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCk7XG5cdFx0Y29uc3QgY29sb3IgPSB0aGVtZS5nZXRDb2xvcihicmVhZGNydW1ic1BpY2tlckJhY2tncm91bmQpO1xuXG5cdFx0dGhpcy5fYXJyb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9hcnJvdy5jbGFzc05hbWUgPSAnYXJyb3cnO1xuXHRcdHRoaXMuX2Fycm93LnN0eWxlLmJvcmRlckNvbG9yID0gYHRyYW5zcGFyZW50IHRyYW5zcGFyZW50ICR7Y29sb3IgPyBjb2xvci50b1N0cmluZygpIDogJyd9YDtcblx0XHR0aGlzLl9kb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMuX2Fycm93KTtcblxuXHRcdHRoaXMuX3RyZWVDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl90cmVlQ29udGFpbmVyLnN0eWxlLmJhY2tncm91bmQgPSBjb2xvciA/IGNvbG9yLnRvU3RyaW5nKCkgOiAnJztcblx0XHR0aGlzLl90cmVlQ29udGFpbmVyLnN0eWxlLnBhZGRpbmdUb3AgPSAnMnB4Jztcblx0XHR0aGlzLl90cmVlQ29udGFpbmVyLnN0eWxlLmJvcmRlclJhZGl1cyA9ICczcHgnO1xuXHRcdHRoaXMuX3RyZWVDb250YWluZXIuc3R5bGUuYm94U2hhZG93ID0gYDAgMCA4cHggMnB4ICR7dGhpcy5fdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKS5nZXRDb2xvcih3aWRnZXRTaGFkb3cpfWA7XG5cdFx0dGhpcy5fdHJlZUNvbnRhaW5lci5zdHlsZS5ib3JkZXIgPSBgMXB4IHNvbGlkICR7dGhpcy5fdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKS5nZXRDb2xvcih3aWRnZXRCb3JkZXIpfWA7XG5cdFx0dGhpcy5fZG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLl90cmVlQ29udGFpbmVyKTtcblxuXHRcdHRoaXMuX2xheW91dEluZm8gPSB7IG1heEhlaWdodCwgd2lkdGgsIGFycm93U2l6ZSwgYXJyb3dPZmZzZXQsIGlucHV0SGVpZ2h0OiAwIH07XG5cdFx0dGhpcy5fdHJlZSA9IHRoaXMuX2NyZWF0ZVRyZWUodGhpcy5fdHJlZUNvbnRhaW5lciwgaW5wdXQpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX3RyZWUub25EaWRPcGVuKGFzeW5jIGUgPT4ge1xuXHRcdFx0Y29uc3QgeyBlbGVtZW50LCBlZGl0b3JPcHRpb25zLCBzaWRlQnlTaWRlIH0gPSBlO1xuXHRcdFx0Y29uc3QgZGlkUmV2ZWFsID0gYXdhaXQgdGhpcy5fcmV2ZWFsRWxlbWVudChlbGVtZW50LCB7IC4uLmVkaXRvck9wdGlvbnMsIHByZXNlcnZlRm9jdXM6IGZhbHNlIH0sIHNpZGVCeVNpZGUpO1xuXHRcdFx0aWYgKCFkaWRSZXZlYWwpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fdHJlZS5vbkRpZENoYW5nZUZvY3VzKGUgPT4ge1xuXHRcdFx0dGhpcy5fcHJldmlld0Rpc3BvYWJsZXMudmFsdWUgPSB0aGlzLl9wcmV2aWV3RWxlbWVudChlLmVsZW1lbnRzWzBdKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX3RyZWUub25EaWRDaGFuZ2VDb250ZW50SGVpZ2h0KCgpID0+IHtcblx0XHRcdHRoaXMuX2xheW91dCgpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2RvbU5vZGUuZm9jdXMoKTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5fc2V0SW5wdXQoaW5wdXQpO1xuXHRcdFx0dGhpcy5fbGF5b3V0KCk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlcnIpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBfbGF5b3V0KCk6IHZvaWQge1xuXG5cdFx0Y29uc3QgaGVhZGVySGVpZ2h0ID0gMiAqIHRoaXMuX2xheW91dEluZm8uYXJyb3dTaXplO1xuXHRcdGNvbnN0IHRyZWVIZWlnaHQgPSBNYXRoLm1pbih0aGlzLl9sYXlvdXRJbmZvLm1heEhlaWdodCAtIGhlYWRlckhlaWdodCwgdGhpcy5fdHJlZS5jb250ZW50SGVpZ2h0KTtcblx0XHRjb25zdCB0b3RhbEhlaWdodCA9IHRyZWVIZWlnaHQgKyBoZWFkZXJIZWlnaHQ7XG5cblx0XHR0aGlzLl9kb21Ob2RlLnN0eWxlLmhlaWdodCA9IGAke3RvdGFsSGVpZ2h0fXB4YDtcblx0XHR0aGlzLl9kb21Ob2RlLnN0eWxlLndpZHRoID0gYCR7dGhpcy5fbGF5b3V0SW5mby53aWR0aH1weGA7XG5cdFx0dGhpcy5fYXJyb3cuc3R5bGUudG9wID0gYC0kezIgKiB0aGlzLl9sYXlvdXRJbmZvLmFycm93U2l6ZX1weGA7XG5cdFx0dGhpcy5fYXJyb3cuc3R5bGUuYm9yZGVyV2lkdGggPSBgJHt0aGlzLl9sYXlvdXRJbmZvLmFycm93U2l6ZX1weGA7XG5cdFx0dGhpcy5fYXJyb3cuc3R5bGUubWFyZ2luTGVmdCA9IGAke3RoaXMuX2xheW91dEluZm8uYXJyb3dPZmZzZXR9cHhgO1xuXHRcdHRoaXMuX3RyZWVDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7dHJlZUhlaWdodH1weGA7XG5cdFx0dGhpcy5fdHJlZUNvbnRhaW5lci5zdHlsZS53aWR0aCA9IGAke3RoaXMuX2xheW91dEluZm8ud2lkdGh9cHhgO1xuXHRcdHRoaXMuX3RyZWUubGF5b3V0KHRyZWVIZWlnaHQsIHRoaXMuX2xheW91dEluZm8ud2lkdGgpO1xuXHR9XG5cblx0cmVzdG9yZVZpZXdTdGF0ZSgpOiB2b2lkIHsgfVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBfc2V0SW5wdXQoZWxlbWVudDogRmlsZUVsZW1lbnQgfCBPdXRsaW5lRWxlbWVudDIpOiBQcm9taXNlPHZvaWQ+O1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX2NyZWF0ZVRyZWUoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgaW5wdXQ6IGFueSk6IFRyZWU8YW55LCBhbnk+O1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX3ByZXZpZXdFbGVtZW50KGVsZW1lbnQ6IGFueSk6IElEaXNwb3NhYmxlO1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX3JldmVhbEVsZW1lbnQoZWxlbWVudDogYW55LCBvcHRpb25zOiBJRWRpdG9yT3B0aW9ucywgc2lkZUJ5U2lkZTogYm9vbGVhbik6IFByb21pc2U8Ym9vbGVhbj47XG5cbn1cblxuLy8jcmVnaW9uIC0gRmlsZXNcblxuY2xhc3MgRmlsZVZpcnR1YWxEZWxlZ2F0ZSBpbXBsZW1lbnRzIElMaXN0VmlydHVhbERlbGVnYXRlPElGaWxlU3RhdCB8IElXb3Jrc3BhY2VGb2xkZXI+IHtcblx0Z2V0SGVpZ2h0KF9lbGVtZW50OiBJRmlsZVN0YXQgfCBJV29ya3NwYWNlRm9sZGVyKSB7XG5cdFx0cmV0dXJuIDIyO1xuXHR9XG5cdGdldFRlbXBsYXRlSWQoX2VsZW1lbnQ6IElGaWxlU3RhdCB8IElXb3Jrc3BhY2VGb2xkZXIpOiBzdHJpbmcge1xuXHRcdHJldHVybiAnRmlsZVN0YXQnO1xuXHR9XG59XG5cbmNsYXNzIEZpbGVJZGVudGl0eVByb3ZpZGVyIGltcGxlbWVudHMgSUlkZW50aXR5UHJvdmlkZXI8SVdvcmtzcGFjZSB8IElXb3Jrc3BhY2VGb2xkZXIgfCBJRmlsZVN0YXQgfCBVUkk+IHtcblx0Z2V0SWQoZWxlbWVudDogSVdvcmtzcGFjZSB8IElXb3Jrc3BhY2VGb2xkZXIgfCBJRmlsZVN0YXQgfCBVUkkpOiB7IHRvU3RyaW5nKCk6IHN0cmluZyB9IHtcblx0XHRpZiAoVVJJLmlzVXJpKGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudC50b1N0cmluZygpO1xuXHRcdH0gZWxzZSBpZiAoaXNXb3Jrc3BhY2UoZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiBlbGVtZW50LmlkO1xuXHRcdH0gZWxzZSBpZiAoaXNXb3Jrc3BhY2VGb2xkZXIoZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiBlbGVtZW50LnVyaS50b1N0cmluZygpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudC5yZXNvdXJjZS50b1N0cmluZygpO1xuXHRcdH1cblx0fVxufVxuXG5cbmNsYXNzIEZpbGVEYXRhU291cmNlIGltcGxlbWVudHMgSUFzeW5jRGF0YVNvdXJjZTxJV29ya3NwYWNlIHwgVVJJLCBJV29ya3NwYWNlRm9sZGVyIHwgSUZpbGVTdGF0PiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9maWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdGhhc0NoaWxkcmVuKGVsZW1lbnQ6IElXb3Jrc3BhY2UgfCBVUkkgfCBJV29ya3NwYWNlRm9sZGVyIHwgSUZpbGVTdGF0KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIFVSSS5pc1VyaShlbGVtZW50KVxuXHRcdFx0fHwgaXNXb3Jrc3BhY2UoZWxlbWVudClcblx0XHRcdHx8IGlzV29ya3NwYWNlRm9sZGVyKGVsZW1lbnQpXG5cdFx0XHR8fCBlbGVtZW50LmlzRGlyZWN0b3J5O1xuXHR9XG5cblx0YXN5bmMgZ2V0Q2hpbGRyZW4oZWxlbWVudDogSVdvcmtzcGFjZSB8IFVSSSB8IElXb3Jrc3BhY2VGb2xkZXIgfCBJRmlsZVN0YXQpOiBQcm9taXNlPChJV29ya3NwYWNlRm9sZGVyIHwgSUZpbGVTdGF0KVtdPiB7XG5cdFx0aWYgKGlzV29ya3NwYWNlKGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudC5mb2xkZXJzO1xuXHRcdH1cblx0XHRsZXQgdXJpOiBVUkk7XG5cdFx0aWYgKGlzV29ya3NwYWNlRm9sZGVyKGVsZW1lbnQpKSB7XG5cdFx0XHR1cmkgPSBlbGVtZW50LnVyaTtcblx0XHR9IGVsc2UgaWYgKFVSSS5pc1VyaShlbGVtZW50KSkge1xuXHRcdFx0dXJpID0gZWxlbWVudDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dXJpID0gZWxlbWVudC5yZXNvdXJjZTtcblx0XHR9XG5cdFx0Y29uc3Qgc3RhdCA9IGF3YWl0IHRoaXMuX2ZpbGVTZXJ2aWNlLnJlc29sdmUodXJpKTtcblx0XHRyZXR1cm4gc3RhdC5jaGlsZHJlbiA/PyBbXTtcblx0fVxufVxuXG5jbGFzcyBGaWxlUmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPElGaWxlU3RhdCB8IElXb3Jrc3BhY2VGb2xkZXIsIEZ1enp5U2NvcmUsIElSZXNvdXJjZUxhYmVsPiB7XG5cblx0cmVhZG9ubHkgdGVtcGxhdGVJZDogc3RyaW5nID0gJ0ZpbGVTdGF0JztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9sYWJlbHM6IFJlc291cmNlTGFiZWxzLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlnU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHsgfVxuXG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElSZXNvdXJjZUxhYmVsIHtcblx0XHRyZXR1cm4gdGhpcy5fbGFiZWxzLmNyZWF0ZShjb250YWluZXIsIHsgc3VwcG9ydEhpZ2hsaWdodHM6IHRydWUgfSk7XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KG5vZGU6IElUcmVlTm9kZTxJV29ya3NwYWNlRm9sZGVyIHwgSUZpbGVTdGF0LCBbbnVtYmVyLCBudW1iZXIsIG51bWJlcl0+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElSZXNvdXJjZUxhYmVsKTogdm9pZCB7XG5cdFx0Y29uc3QgZmlsZURlY29yYXRpb25zID0gdGhpcy5fY29uZmlnU2VydmljZS5nZXRWYWx1ZTx7IGNvbG9yczogYm9vbGVhbjsgYmFkZ2VzOiBib29sZWFuIH0+KCdleHBsb3Jlci5kZWNvcmF0aW9ucycpO1xuXHRcdGNvbnN0IHsgZWxlbWVudCB9ID0gbm9kZTtcblx0XHRsZXQgcmVzb3VyY2U6IFVSSTtcblx0XHRsZXQgZmlsZUtpbmQ6IEZpbGVLaW5kO1xuXHRcdGlmIChpc1dvcmtzcGFjZUZvbGRlcihlbGVtZW50KSkge1xuXHRcdFx0cmVzb3VyY2UgPSBlbGVtZW50LnVyaTtcblx0XHRcdGZpbGVLaW5kID0gRmlsZUtpbmQuUk9PVF9GT0xERVI7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc291cmNlID0gZWxlbWVudC5yZXNvdXJjZTtcblx0XHRcdGZpbGVLaW5kID0gZWxlbWVudC5pc0RpcmVjdG9yeSA/IEZpbGVLaW5kLkZPTERFUiA6IEZpbGVLaW5kLkZJTEU7XG5cdFx0fVxuXHRcdHRlbXBsYXRlRGF0YS5zZXRGaWxlKHJlc291cmNlLCB7XG5cdFx0XHRmaWxlS2luZCxcblx0XHRcdGhpZGVQYXRoOiB0cnVlLFxuXHRcdFx0ZmlsZURlY29yYXRpb25zOiBmaWxlRGVjb3JhdGlvbnMsXG5cdFx0XHRtYXRjaGVzOiBjcmVhdGVNYXRjaGVzKG5vZGUuZmlsdGVyRGF0YSksXG5cdFx0XHRleHRyYUNsYXNzZXM6IFsncGlja2VyLWl0ZW0nXVxuXHRcdH0pO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSVJlc291cmNlTGFiZWwpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIEZpbGVOYXZpZ2F0aW9uTGFiZWxQcm92aWRlciBpbXBsZW1lbnRzIElLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyPElXb3Jrc3BhY2VGb2xkZXIgfCBJRmlsZVN0YXQ+IHtcblxuXHRnZXRLZXlib2FyZE5hdmlnYXRpb25MYWJlbChlbGVtZW50OiBJV29ya3NwYWNlRm9sZGVyIHwgSUZpbGVTdGF0KTogeyB0b1N0cmluZygpOiBzdHJpbmcgfSB7XG5cdFx0cmV0dXJuIGVsZW1lbnQubmFtZTtcblx0fVxufVxuXG5jbGFzcyBGaWxlQWNjZXNzaWJpbGl0eVByb3ZpZGVyIGltcGxlbWVudHMgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8SVdvcmtzcGFjZUZvbGRlciB8IElGaWxlU3RhdD4ge1xuXG5cdGdldFdpZGdldEFyaWFMYWJlbCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgnYnJlYWRjcnVtYnMnLCBcIkJyZWFkY3J1bWJzXCIpO1xuXHR9XG5cblx0Z2V0QXJpYUxhYmVsKGVsZW1lbnQ6IElXb3Jrc3BhY2VGb2xkZXIgfCBJRmlsZVN0YXQpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRyZXR1cm4gZWxlbWVudC5uYW1lO1xuXHR9XG59XG5cbmNsYXNzIEZpbGVGaWx0ZXIgaW1wbGVtZW50cyBJVHJlZUZpbHRlcjxJV29ya3NwYWNlRm9sZGVyIHwgSUZpbGVTdGF0PiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY2FjaGVkRXhwcmVzc2lvbnMgPSBuZXcgTWFwPHN0cmluZywgZ2xvYi5QYXJzZWRFeHByZXNzaW9uPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3dvcmtzcGFjZVNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ1NlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0Y29uc3QgY29uZmlnID0gQnJlYWRjcnVtYnNDb25maWcuRmlsZUV4Y2x1ZGVzLmJpbmRUbyhjb25maWdTZXJ2aWNlKTtcblx0XHRjb25zdCB1cGRhdGUgPSAoKSA9PiB7XG5cdFx0XHRfd29ya3NwYWNlU2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzLmZvckVhY2goZm9sZGVyID0+IHtcblx0XHRcdFx0Y29uc3QgZXhjbHVkZXNDb25maWcgPSBjb25maWcuZ2V0VmFsdWUoeyByZXNvdXJjZTogZm9sZGVyLnVyaSB9KTtcblx0XHRcdFx0aWYgKCFleGNsdWRlc0NvbmZpZykge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBhZGp1c3QgcGF0dGVybnMgdG8gYmUgYWJzb2x1dGUgaW4gY2FzZSB0aGV5IGFyZW4ndFxuXHRcdFx0XHQvLyBmcmVlIGZsb2F0aW5nICgqKi8pXG5cdFx0XHRcdGNvbnN0IGFkanVzdGVkQ29uZmlnOiBnbG9iLklFeHByZXNzaW9uID0ge307XG5cdFx0XHRcdGZvciAoY29uc3QgcGF0dGVybiBpbiBleGNsdWRlc0NvbmZpZykge1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgZXhjbHVkZXNDb25maWdbcGF0dGVybl0gIT09ICdib29sZWFuJykge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHBhdHRlcm5BYnMgPSBwYXR0ZXJuLmluZGV4T2YoJyoqLycpICE9PSAwXG5cdFx0XHRcdFx0XHQ/IHBvc2l4LmpvaW4oZm9sZGVyLnVyaS5wYXRoLCBwYXR0ZXJuKVxuXHRcdFx0XHRcdFx0OiBwYXR0ZXJuO1xuXG5cdFx0XHRcdFx0YWRqdXN0ZWRDb25maWdbcGF0dGVybkFic10gPSBleGNsdWRlc0NvbmZpZ1twYXR0ZXJuXTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9jYWNoZWRFeHByZXNzaW9ucy5zZXQoZm9sZGVyLnVyaS50b1N0cmluZygpLCBnbG9iLnBhcnNlKGFkanVzdGVkQ29uZmlnKSk7XG5cdFx0XHR9KTtcblx0XHR9O1xuXHRcdHVwZGF0ZSgpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChjb25maWcpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChjb25maWcub25EaWRDaGFuZ2UodXBkYXRlKSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKF93b3Jrc3BhY2VTZXJ2aWNlLm9uRGlkQ2hhbmdlV29ya3NwYWNlRm9sZGVycyh1cGRhdGUpKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0ZmlsdGVyKGVsZW1lbnQ6IElXb3Jrc3BhY2VGb2xkZXIgfCBJRmlsZVN0YXQsIF9wYXJlbnRWaXNpYmlsaXR5OiBUcmVlVmlzaWJpbGl0eSk6IGJvb2xlYW4ge1xuXHRcdGlmIChpc1dvcmtzcGFjZUZvbGRlcihlbGVtZW50KSkge1xuXHRcdFx0Ly8gbm90IGEgZmlsZVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGNvbnN0IGZvbGRlciA9IHRoaXMuX3dvcmtzcGFjZVNlcnZpY2UuZ2V0V29ya3NwYWNlRm9sZGVyKGVsZW1lbnQucmVzb3VyY2UpO1xuXHRcdGlmICghZm9sZGVyIHx8ICF0aGlzLl9jYWNoZWRFeHByZXNzaW9ucy5oYXMoZm9sZGVyLnVyaS50b1N0cmluZygpKSkge1xuXHRcdFx0Ly8gbm8gZm9sZGVyIG9yIG5vIGZpbGVyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBleHByZXNzaW9uID0gdGhpcy5fY2FjaGVkRXhwcmVzc2lvbnMuZ2V0KGZvbGRlci51cmkudG9TdHJpbmcoKSkhO1xuXHRcdHJldHVybiAhZXhwcmVzc2lvbihyZWxhdGl2ZShmb2xkZXIudXJpLnBhdGgsIGVsZW1lbnQucmVzb3VyY2UucGF0aCksIGJhc2VuYW1lKGVsZW1lbnQucmVzb3VyY2UpKTtcblx0fVxufVxuXG5cbmV4cG9ydCBjbGFzcyBGaWxlU29ydGVyIGltcGxlbWVudHMgSVRyZWVTb3J0ZXI8SUZpbGVTdGF0IHwgSVdvcmtzcGFjZUZvbGRlcj4ge1xuXHRjb21wYXJlKGE6IElGaWxlU3RhdCB8IElXb3Jrc3BhY2VGb2xkZXIsIGI6IElGaWxlU3RhdCB8IElXb3Jrc3BhY2VGb2xkZXIpOiBudW1iZXIge1xuXHRcdGlmIChpc1dvcmtzcGFjZUZvbGRlcihhKSAmJiBpc1dvcmtzcGFjZUZvbGRlcihiKSkge1xuXHRcdFx0cmV0dXJuIGEuaW5kZXggLSBiLmluZGV4O1xuXHRcdH1cblx0XHRpZiAoKGEgYXMgSUZpbGVTdGF0KS5pc0RpcmVjdG9yeSA9PT0gKGIgYXMgSUZpbGVTdGF0KS5pc0RpcmVjdG9yeSkge1xuXHRcdFx0Ly8gc2FtZSB0eXBlIC0+IGNvbXBhcmUgb24gbmFtZXNcblx0XHRcdHJldHVybiBjb21wYXJlRmlsZU5hbWVzKGEubmFtZSwgYi5uYW1lKTtcblx0XHR9IGVsc2UgaWYgKChhIGFzIElGaWxlU3RhdCkuaXNEaXJlY3RvcnkpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBCcmVhZGNydW1ic0ZpbGVQaWNrZXIgZXh0ZW5kcyBCcmVhZGNydW1ic1BpY2tlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cGFyZW50OiBIVE1MRWxlbWVudCxcblx0XHRyZXNvdXJjZTogVVJJLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWdTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF93b3Jrc3BhY2VTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihwYXJlbnQsIHJlc291cmNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBjb25maWdTZXJ2aWNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfY3JlYXRlVHJlZShjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG5cblx0XHQvLyB0cmVlIGljb24gdGhlbWUgc3BlY2lhbHNcblx0XHR0aGlzLl90cmVlQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2ZpbGUtaWNvbi10aGVtYWJsZS10cmVlJyk7XG5cdFx0dGhpcy5fdHJlZUNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdzaG93LWZpbGUtaWNvbnMnKTtcblx0XHRjb25zdCBvbkZpbGVJY29uVGhlbWVDaGFuZ2UgPSAoZmlsZUljb25UaGVtZTogSUZpbGVJY29uVGhlbWUpID0+IHtcblx0XHRcdHRoaXMuX3RyZWVDb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnYWxpZ24taWNvbnMtYW5kLXR3aXN0aWVzJywgZmlsZUljb25UaGVtZS5oYXNGaWxlSWNvbnMgJiYgIWZpbGVJY29uVGhlbWUuaGFzRm9sZGVySWNvbnMpO1xuXHRcdFx0dGhpcy5fdHJlZUNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdoaWRlLWFycm93cycsIGZpbGVJY29uVGhlbWUuaGlkZXNFeHBsb3JlckFycm93cyA9PT0gdHJ1ZSk7XG5cdFx0fTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fdGhlbWVTZXJ2aWNlLm9uRGlkRmlsZUljb25UaGVtZUNoYW5nZShvbkZpbGVJY29uVGhlbWVDaGFuZ2UpKTtcblx0XHRvbkZpbGVJY29uVGhlbWVDaGFuZ2UodGhpcy5fdGhlbWVTZXJ2aWNlLmdldEZpbGVJY29uVGhlbWUoKSk7XG5cblx0XHRjb25zdCBsYWJlbHMgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvdXJjZUxhYmVscywgREVGQVVMVF9MQUJFTFNfQ09OVEFJTkVSIC8qIFRPRE9ASm8gdmlzaWJpbGl0eSBwcm9wYWdhdGlvbiAqLyk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKGxhYmVscyk7XG5cblx0XHRyZXR1cm4gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRXb3JrYmVuY2hBc3luY0RhdGFUcmVlPElXb3Jrc3BhY2UgfCBVUkksIElXb3Jrc3BhY2VGb2xkZXIgfCBJRmlsZVN0YXQsIEZ1enp5U2NvcmU+LFxuXHRcdFx0J0JyZWFkY3J1bWJzRmlsZVBpY2tlcicsXG5cdFx0XHRjb250YWluZXIsXG5cdFx0XHRuZXcgRmlsZVZpcnR1YWxEZWxlZ2F0ZSgpLFxuXHRcdFx0W3RoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEZpbGVSZW5kZXJlciwgbGFiZWxzKV0sXG5cdFx0XHR0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShGaWxlRGF0YVNvdXJjZSksXG5cdFx0XHR7XG5cdFx0XHRcdG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRcdHNvcnRlcjogbmV3IEZpbGVTb3J0ZXIoKSxcblx0XHRcdFx0ZmlsdGVyOiB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShGaWxlRmlsdGVyKSxcblx0XHRcdFx0aWRlbnRpdHlQcm92aWRlcjogbmV3IEZpbGVJZGVudGl0eVByb3ZpZGVyKCksXG5cdFx0XHRcdGtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI6IG5ldyBGaWxlTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXIoKSxcblx0XHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShGaWxlQWNjZXNzaWJpbGl0eVByb3ZpZGVyKSxcblx0XHRcdFx0c2hvd05vdEZvdW5kTWVzc2FnZTogZmFsc2UsXG5cdFx0XHRcdG92ZXJyaWRlU3R5bGVzOiB7XG5cdFx0XHRcdFx0bGlzdEJhY2tncm91bmQ6IGJyZWFkY3J1bWJzUGlja2VyQmFja2dyb3VuZFxuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgX3NldElucHV0KGVsZW1lbnQ6IEZpbGVFbGVtZW50IHwgT3V0bGluZUVsZW1lbnQyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgeyB1cmksIGtpbmQgfSA9IChlbGVtZW50IGFzIEZpbGVFbGVtZW50KTtcblx0XHRsZXQgaW5wdXQ6IElXb3Jrc3BhY2UgfCBVUkk7XG5cdFx0aWYgKGtpbmQgPT09IEZpbGVLaW5kLlJPT1RfRk9MREVSKSB7XG5cdFx0XHRpbnB1dCA9IHRoaXMuX3dvcmtzcGFjZVNlcnZpY2UuZ2V0V29ya3NwYWNlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlucHV0ID0gZGlybmFtZSh1cmkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRyZWUgPSB0aGlzLl90cmVlIGFzIFdvcmtiZW5jaEFzeW5jRGF0YVRyZWU8SVdvcmtzcGFjZSB8IFVSSSwgSVdvcmtzcGFjZUZvbGRlciB8IElGaWxlU3RhdCwgRnV6enlTY29yZT47XG5cdFx0YXdhaXQgdHJlZS5zZXRJbnB1dChpbnB1dCk7XG5cdFx0bGV0IGZvY3VzRWxlbWVudDogSVdvcmtzcGFjZUZvbGRlciB8IElGaWxlU3RhdCB8IHVuZGVmaW5lZDtcblx0XHRmb3IgKGNvbnN0IHsgZWxlbWVudCB9IG9mIHRyZWUuZ2V0Tm9kZSgpLmNoaWxkcmVuKSB7XG5cdFx0XHRpZiAoaXNXb3Jrc3BhY2VGb2xkZXIoZWxlbWVudCkgJiYgaXNFcXVhbChlbGVtZW50LnVyaSwgdXJpKSkge1xuXHRcdFx0XHRmb2N1c0VsZW1lbnQgPSBlbGVtZW50O1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH0gZWxzZSBpZiAoaXNFcXVhbCgoZWxlbWVudCBhcyBJRmlsZVN0YXQpLnJlc291cmNlLCB1cmkpKSB7XG5cdFx0XHRcdGZvY3VzRWxlbWVudCA9IGVsZW1lbnQgYXMgSUZpbGVTdGF0O1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGZvY3VzRWxlbWVudCkge1xuXHRcdFx0dHJlZS5yZXZlYWwoZm9jdXNFbGVtZW50LCAwLjUpO1xuXHRcdFx0dHJlZS5zZXRGb2N1cyhbZm9jdXNFbGVtZW50XSwgdGhpcy5fZmFrZUV2ZW50KTtcblx0XHR9XG5cdFx0dHJlZS5kb21Gb2N1cygpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9wcmV2aWV3RWxlbWVudChfZWxlbWVudDogYW55KTogSURpc3Bvc2FibGUge1xuXHRcdHJldHVybiBEaXNwb3NhYmxlLk5vbmU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgX3JldmVhbEVsZW1lbnQoZWxlbWVudDogSUZpbGVTdGF0IHwgSVdvcmtzcGFjZUZvbGRlciwgb3B0aW9uczogSUVkaXRvck9wdGlvbnMsIHNpZGVCeVNpZGU6IGJvb2xlYW4pOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAoIWlzV29ya3NwYWNlRm9sZGVyKGVsZW1lbnQpICYmIGVsZW1lbnQuaXNGaWxlKSB7XG5cdFx0XHR0aGlzLl9vbldpbGxQaWNrRWxlbWVudC5maXJlKCk7XG5cdFx0XHRhd2FpdCB0aGlzLl9lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZTogZWxlbWVudC5yZXNvdXJjZSwgb3B0aW9ucyB9LCBzaWRlQnlTaWRlID8gU0lERV9HUk9VUCA6IHVuZGVmaW5lZCk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIC0gT3V0bGluZVxuXG5jbGFzcyBPdXRsaW5lVHJlZVNvcnRlcjxFPiBpbXBsZW1lbnRzIElUcmVlU29ydGVyPEU+IHtcblxuXHRwcml2YXRlIF9vcmRlcjogJ25hbWUnIHwgJ3R5cGUnIHwgJ3Bvc2l0aW9uJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIGNvbXBhcmF0b3I6IElPdXRsaW5lQ29tcGFyYXRvcjxFPixcblx0XHR1cmk6IFVSSSB8IHVuZGVmaW5lZCxcblx0XHRASVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ1NlcnZpY2U6IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5fb3JkZXIgPSBjb25maWdTZXJ2aWNlLmdldFZhbHVlKHVyaSwgJ2JyZWFkY3J1bWJzLnN5bWJvbFNvcnRPcmRlcicpO1xuXHR9XG5cblx0Y29tcGFyZShhOiBFLCBiOiBFKTogbnVtYmVyIHtcblx0XHRpZiAodGhpcy5fb3JkZXIgPT09ICduYW1lJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuY29tcGFyYXRvci5jb21wYXJlQnlOYW1lKGEsIGIpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5fb3JkZXIgPT09ICd0eXBlJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuY29tcGFyYXRvci5jb21wYXJlQnlUeXBlKGEsIGIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jb21wYXJhdG9yLmNvbXBhcmVCeVBvc2l0aW9uKGEsIGIpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQnJlYWRjcnVtYnNPdXRsaW5lUGlja2VyIGV4dGVuZHMgQnJlYWRjcnVtYnNQaWNrZXIge1xuXG5cdHByb3RlY3RlZCBfY3JlYXRlVHJlZShjb250YWluZXI6IEhUTUxFbGVtZW50LCBpbnB1dDogT3V0bGluZUVsZW1lbnQyKSB7XG5cblx0XHRjb25zdCB7IGNvbmZpZyB9ID0gaW5wdXQub3V0bGluZTtcblxuXHRcdHJldHVybiB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFdvcmtiZW5jaERhdGFUcmVlPElPdXRsaW5lPGFueT4sIGFueSwgRnV6enlTY29yZT4sXG5cdFx0XHQnQnJlYWRjcnVtYnNPdXRsaW5lUGlja2VyJyxcblx0XHRcdGNvbnRhaW5lcixcblx0XHRcdGNvbmZpZy5kZWxlZ2F0ZSxcblx0XHRcdGNvbmZpZy5yZW5kZXJlcnMsXG5cdFx0XHRjb25maWcudHJlZURhdGFTb3VyY2UsXG5cdFx0XHR7XG5cdFx0XHRcdC4uLmNvbmZpZy5vcHRpb25zLFxuXHRcdFx0XHRzb3J0ZXI6IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE91dGxpbmVUcmVlU29ydGVyLCBjb25maWcuY29tcGFyYXRvciwgdW5kZWZpbmVkKSxcblx0XHRcdFx0Y29sbGFwc2VCeURlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdGV4cGFuZE9ubHlPblR3aXN0aWVDbGljazogdHJ1ZSxcblx0XHRcdFx0bXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0OiBmYWxzZSxcblx0XHRcdFx0c2hvd05vdEZvdW5kTWVzc2FnZTogZmFsc2Vcblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9zZXRJbnB1dChpbnB1dDogT3V0bGluZUVsZW1lbnQyKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHRjb25zdCB2aWV3U3RhdGUgPSBpbnB1dC5vdXRsaW5lLmNhcHR1cmVWaWV3U3RhdGUoKTtcblx0XHR0aGlzLnJlc3RvcmVWaWV3U3RhdGUgPSAoKSA9PiB7IHZpZXdTdGF0ZS5kaXNwb3NlKCk7IH07XG5cblx0XHRjb25zdCB0cmVlID0gdGhpcy5fdHJlZSBhcyBXb3JrYmVuY2hEYXRhVHJlZTxJT3V0bGluZTxhbnk+LCBhbnksIEZ1enp5U2NvcmU+O1xuXG5cdFx0dHJlZS5zZXRJbnB1dChpbnB1dC5vdXRsaW5lKTtcblx0XHRpZiAoaW5wdXQuZWxlbWVudCAhPT0gaW5wdXQub3V0bGluZSkge1xuXHRcdFx0dHJlZS5yZXZlYWwoaW5wdXQuZWxlbWVudCwgMC41KTtcblx0XHRcdHRyZWUuc2V0Rm9jdXMoW2lucHV0LmVsZW1lbnRdLCB0aGlzLl9mYWtlRXZlbnQpO1xuXHRcdH1cblx0XHR0cmVlLmRvbUZvY3VzKCk7XG5cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX3ByZXZpZXdFbGVtZW50KGVsZW1lbnQ6IGFueSk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBvdXRsaW5lOiBJT3V0bGluZTxhbnk+ID0gdGhpcy5fdHJlZS5nZXRJbnB1dCgpO1xuXHRcdHJldHVybiBvdXRsaW5lLnByZXZpZXcoZWxlbWVudCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgX3JldmVhbEVsZW1lbnQoZWxlbWVudDogYW55LCBvcHRpb25zOiBJRWRpdG9yT3B0aW9ucywgc2lkZUJ5U2lkZTogYm9vbGVhbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHRoaXMuX29uV2lsbFBpY2tFbGVtZW50LmZpcmUoKTtcblx0XHRjb25zdCBvdXRsaW5lOiBJT3V0bGluZTxhbnk+ID0gdGhpcy5fdHJlZS5nZXRJbnB1dCgpO1xuXHRcdGF3YWl0IG91dGxpbmUucmV2ZWFsKGVsZW1lbnQsIG9wdGlvbnMsIHNpZGVCeVNpZGUsIGZhbHNlKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFzQjtBQUMvQixTQUFTLHFCQUFpQztBQUMxQyxZQUFZLFVBQVU7QUFDdEIsU0FBc0IsaUJBQWlCLG1CQUFtQixrQkFBa0I7QUFDNUUsU0FBUyxPQUFPLGdCQUFnQjtBQUNoQyxTQUFTLFVBQVUsU0FBUyxlQUFlO0FBQzNDLFNBQVMsV0FBVztBQUNwQixPQUFPO0FBQ1AsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxVQUFVLG9CQUErQjtBQUNsRCxTQUFTLDZC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
