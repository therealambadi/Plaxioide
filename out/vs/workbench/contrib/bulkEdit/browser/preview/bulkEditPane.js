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
import { ButtonBar } from "../../../../../base/browser/ui/button/button.js";
import { CachedFunction, LRUCachedFunction } from "../../../../../base/common/cache.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import "./bulkEdit.css";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../nls.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { WorkbenchAsyncDataTree } from "../../../../../platform/list/browser/listService.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { defaultButtonStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { ResourceLabels } from "../../../../browser/labels.js";
import { ViewPane } from "../../../../browser/parts/views/viewPane.js";
import { IViewDescriptorService } from "../../../../common/views.js";
import { BulkEditPreviewProvider, BulkFileOperations, BulkFileOperationType } from "./bulkEditPreview.js";
import { BulkEditAccessibilityProvider, BulkEditDataSource, BulkEditDelegate, BulkEditIdentityProvider, BulkEditNaviLabelProvider, BulkEditSorter, CategoryElement, CategoryElementRenderer, compareBulkFileOperations, FileElement, FileElementRenderer, TextEditElement, TextEditElementRenderer } from "./bulkEditTree.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../../services/editor/common/editorService.js";
var State = /* @__PURE__ */ ((State2) => {
  State2["Data"] = "data";
  State2["Message"] = "message";
  return State2;
})(State || {});
let BulkEditPane = class extends ViewPane {
  constructor(options, _instaService, _editorService, _labelService, _textModelService, _dialogService, _contextMenuService, _storageService, contextKeyService, viewDescriptorService, keybindingService, contextMenuService, configurationService, openerService, themeService, hoverService) {
    super(
      { ...options, titleMenuId: MenuId.BulkEditTitle },
      keybindingService,
      contextMenuService,
      configurationService,
      contextKeyService,
      viewDescriptorService,
      _instaService,
      openerService,
      themeService,
      hoverService
    );
    this._instaService = _instaService;
    this._editorService = _editorService;
    this._labelService = _labelService;
    this._textModelService = _textModelService;
    this._dialogService = _dialogService;
    this._contextMenuService = _contextMenuService;
    this._storageService = _storageService;
    this._treeViewStates = /* @__PURE__ */ new Map();
    this._disposables = new DisposableStore();
    this._sessionDisposables = new DisposableStore();
    this._computeResourceDiffEditorInputs = new LRUCachedFunction(async (fileOperations) => {
      const computeDiffEditorInput = new CachedFunction(async (fileOperation) => {
        const fileOperationUri = fileOperation.uri;
        const previewUri = this._currentProvider.asPreviewUri(fileOperationUri);
        if (fileOperation.type & BulkFileOperationType.Delete) {
          return {
            original: { resource: URI.revive(previewUri) },
            modified: { resource: void 0 },
            goToFileResource: fileOperation.uri
          };
        } else {
          let leftResource;
          try {
            (await this._textModelService.createModelReference(fileOperationUri)).dispose();
            leftResource = fileOperationUri;
          } catch {
            leftResource = BulkEditPreviewProvider.emptyPreview;
          }
          return {
            original: { resource: URI.revive(leftResource) },
            modified: { resource: URI.revive(previewUri) },
            goToFileResource: leftResource
          };
        }
      });
      const sortedFileOperations = fileOperations.slice().sort(compareBulkFileOperations);
      const resources = [];
      for (const operation of sortedFileOperations) {
        resources.push(await computeDiffEditorInput.get(operation));
      }
      const getResourceDiffEditorInputIdOfOperation = async (operation) => {
        const resource = await computeDiffEditorInput.get(operation);
        return { original: resource.original.resource, modified: resource.modified.resource };
      };
      return {
        resources,
        getResourceDiffEditorInputIdOfOperation
      };
    });
    this.element.classList.add("bulk-edit-panel", "show-file-icons");
    this._ctxHasCategories = BulkEditPane.ctxHasCategories.bindTo(contextKeyService);
    this._ctxGroupByFile = BulkEditPane.ctxGroupByFile.bindTo(contextKeyService);
    this._ctxHasCheckedChanges = BulkEditPane.ctxHasCheckedChanges.bindTo(contextKeyService);
  }
  dispose() {
    this._tree.dispose();
    this._disposables.dispose();
    super.dispose();
  }
  renderBody(parent) {
    super.renderBody(parent);
    const resourceLabels = this._instaService.createInstance(
      ResourceLabels,
      { onDidChangeVisibility: this.onDidChangeBodyVisibility }
    );
    this._disposables.add(resourceLabels);
    const contentContainer = document.createElement("div");
    contentContainer.className = "content";
    parent.appendChild(contentContainer);
    const treeContainer = document.createElement("div");
    contentContainer.appendChild(treeContainer);
    this._treeDataSource = this._instaService.createInstance(BulkEditDataSource);
    this._treeDataSource.groupByFile = this._storageService.getBoolean(BulkEditPane._memGroupByFile, StorageScope.PROFILE, true);
    this._ctxGroupByFile.set(this._treeDataSource.groupByFile);
    this._tree = this._instaService.createInstance(
      WorkbenchAsyncDataTree,
      this.id,
      treeContainer,
      new BulkEditDelegate(),
      [this._instaService.createInstance(TextEditElementRenderer), this._instaService.createInstance(FileElementRenderer, resourceLabels), this._instaService.createInstance(CategoryElementRenderer)],
      this._treeDataSource,
      {
        accessibilityProvider: this._instaService.createInstance(BulkEditAccessibilityProvider),
        identityProvider: new BulkEditIdentityProvider(),
        expandOnlyOnTwistieClick: true,
        multipleSelectionSupport: false,
        keyboardNavigationLabelProvider: new BulkEditNaviLabelProvider(),
        sorter: new BulkEditSorter(),
        selectionNavigation: true
      }
    );
    this._disposables.add(this._tree.onContextMenu(this._onContextMenu, this));
    this._disposables.add(this._tree.onDidOpen((e) => this._openElementInMultiDiffEditor(e)));
    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "buttons";
    contentContainer.appendChild(buttonsContainer);
    const buttonBar = new ButtonBar(buttonsContainer);
    this._disposables.add(buttonBar);
    const btnConfirm = buttonBar.addButton({ supportIcons: true, ...defaultButtonStyles });
    btnConfirm.label = localize("ok", "Apply");
    btnConfirm.onDidClick(() => this.accept(), this, this._disposables);
    const btnCancel = buttonBar.addButton({ ...defaultButtonStyles, secondary: true });
    btnCancel.label = localize("cancel", "Discard");
    btnCancel.onDidClick(() => this.discard(), this, this._disposables);
    this._message = document.createElement("span");
    this._message.className = "message";
    this._message.innerText = localize("empty.msg", "Invoke a code action, like rename, to see a preview of its changes here.");
    parent.appendChild(this._message);
    this._setState("message" /* Message */);
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    const treeHeight = height - 50;
    this._tree.getHTMLElement().parentElement.style.height = `${treeHeight}px`;
    this._tree.layout(treeHeight, width);
  }
  _setState(state) {
    this.element.dataset["state"] = state;
  }
  async setInput(edit, token) {
    this._setState("data" /* Data */);
    this._sessionDisposables.clear();
    this._treeViewStates.clear();
    if (this._currentResolve) {
      this._currentResolve(void 0);
      this._currentResolve = void 0;
    }
    const input = await this._instaService.invokeFunction(BulkFileOperations.create, edit);
    this._currentProvider = this._instaService.createInstance(BulkEditPreviewProvider, input);
    this._sessionDisposables.add(this._currentProvider);
    this._sessionDisposables.add(input);
    const hasCategories = input.categories.length > 1;
    this._ctxHasCategories.set(hasCategories);
    this._treeDataSource.groupByFile = !hasCategories || this._treeDataSource.groupByFile;
    this._ctxHasCheckedChanges.set(input.checked.checkedCount > 0);
    this._currentInput = input;
    return new Promise((resolve) => {
      token.onCancellationRequested(() => resolve(void 0));
      this._currentResolve = resolve;
      this._setTreeInput(input);
      this._sessionDisposables.add(input.checked.onDidChange(() => {
        this._tree.updateChildren();
        this._ctxHasCheckedChanges.set(input.checked.checkedCount > 0);
      }));
    });
  }
  hasInput() {
    return Boolean(this._currentInput);
  }
  async _setTreeInput(input) {
    const viewState = this._treeViewStates.get(this._treeDataSource.groupByFile);
    await this._tree.setInput(input, viewState);
    this._tree.domFocus();
    if (viewState) {
      return;
    }
    const expand = [...this._tree.getNode(input).children].slice(0, 10);
    while (expand.length > 0) {
      const { element } = expand.shift();
      if (element instanceof FileElement) {
        await this._tree.expand(element, true);
      }
      if (element instanceof CategoryElement) {
        await this._tree.expand(element, true);
        expand.push(...this._tree.getNode(element).children);
      }
    }
  }
  accept() {
    const conflicts = this._currentInput?.conflicts.list();
    if (!conflicts || conflicts.length === 0) {
      this._done(true);
      return;
    }
    let message;
    if (conflicts.length === 1) {
      message = localize("conflict.1", "Cannot apply refactoring because '{0}' has changed in the meantime.", this._labelService.getUriLabel(conflicts[0], { relative: true }));
    } else {
      message = localize("conflict.N", "Cannot apply refactoring because {0} other files have changed in the meantime.", conflicts.length);
    }
    this._dialogService.warn(message).finally(() => this._done(false));
  }
  discard() {
    this._done(false);
  }
  _done(accept) {
    this._currentResolve?.(accept ? this._currentInput?.getWorkspaceEdit() : void 0);
    this._currentInput = void 0;
    this._setState("message" /* Message */);
    this._sessionDisposables.clear();
  }
  toggleChecked() {
    const [first] = this._tree.getFocus();
    if ((first instanceof FileElement || first instanceof TextEditElement) && !first.isDisabled()) {
      first.setChecked(!first.isChecked());
    } else if (first instanceof CategoryElement) {
      first.setChecked(!first.isChecked());
    }
  }
  groupByFile() {
    if (!this._treeDataSource.groupByFile) {
      this.toggleGrouping();
    }
  }
  groupByType() {
    if (this._treeDataSource.groupByFile) {
      this.toggleGrouping();
    }
  }
  toggleGrouping() {
    const input = this._tree.getInput();
    if (input) {
      const oldViewState = this._tree.getViewState();
      this._treeViewStates.set(this._treeDataSource.groupByFile, oldViewState);
      this._treeDataSource.groupByFile = !this._treeDataSource.groupByFile;
      this._setTreeInput(input);
      this._storageService.store(BulkEditPane._memGroupByFile, this._treeDataSource.groupByFile, StorageScope.PROFILE, StorageTarget.USER);
      this._ctxGroupByFile.set(this._treeDataSource.groupByFile);
    }
  }
  async _openElementInMultiDiffEditor(e) {
    const fileOperations = this._currentInput?.fileOperations;
    if (!fileOperations) {
      return;
    }
    let selection = void 0;
    let fileElement;
    if (e.element instanceof TextEditElement) {
      fileElement = e.element.parent;
      selection = e.element.edit.textEdit.textEdit.range;
    } else if (e.element instanceof FileElement) {
      fileElement = e.element;
      selection = e.element.edit.textEdits[0]?.textEdit.textEdit.range;
    } else {
      return;
    }
    const result = await this._computeResourceDiffEditorInputs.get(fileOperations);
    const resourceId = await result.getResourceDiffEditorInputIdOfOperation(fileElement.edit);
    const options = {
      ...e.editorOptions,
      viewState: {
        revealData: {
          resource: resourceId,
          range: selection
        }
      }
    };
    const multiDiffSource = URI.from({ scheme: BulkEditPane.Schema });
    const label = "Refactor Preview";
    this._editorService.openEditor({
      multiDiffSource,
      label,
      options,
      isTransient: true,
      description: label,
      resources: result.resources
    }, e.sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
  }
  _onContextMenu(e) {
    this._contextMenuService.showContextMenu({
      menuId: MenuId.BulkEditContext,
      contextKeyService: this.contextKeyService,
      getAnchor: () => e.anchor
    });
  }
};
BulkEditPane.ID = "refactorPreview";
BulkEditPane.Schema = "vscode-bulkeditpreview-multieditor";
BulkEditPane.ctxHasCategories = new RawContextKey("refactorPreview.hasCategories", false);
BulkEditPane.ctxGroupByFile = new RawContextKey("refactorPreview.groupByFile", true);
BulkEditPane.ctxHasCheckedChanges = new RawContextKey("refactorPreview.hasCheckedChanges", true);
BulkEditPane._memGroupByFile = `${BulkEditPane.ID}.groupByFile`;
BulkEditPane = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, ILabelService),
  __decorateParam(4, ITextModelService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IViewDescriptorService),
  __decorateParam(10, IKeybindingService),
  __decorateParam(11, IContextMenuService),
  __decorateParam(12, IConfigurationService),
  __decorateParam(13, IOpenerService),
  __decorateParam(14, IThemeService),
  __decorateParam(15, IHoverService)
], BulkEditPane);
export {
  BulkEditPane
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9idWxrRWRpdC9icm93c2VyL3ByZXZpZXcvYnVsa0VkaXRQYW5lLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQnV0dG9uQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2J1dHRvbi9idXR0b24uanMnO1xuaW1wb3J0IHR5cGUgeyBJQXN5bmNEYXRhVHJlZVZpZXdTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL2FzeW5jRGF0YVRyZWUuanMnO1xuaW1wb3J0IHsgSVRyZWVDb250ZXh0TWVudUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBDYWNoZWRGdW5jdGlvbiwgTFJVQ2FjaGVkRnVuY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYWNoZS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBGdXp6eVNjb3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTXV0YWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgJy4vYnVsa0VkaXQuY3NzJztcbmltcG9ydCB7IFJlc291cmNlRWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2J1bGtFZGl0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTXVsdGlEaWZmRWRpdG9yT3B0aW9ucywgSU11bHRpRGlmZlJlc291cmNlSWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvbXVsdGlEaWZmRWRpdG9yL211bHRpRGlmZkVkaXRvcldpZGdldEltcGwuanMnO1xuaW1wb3J0IHsgSVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJT3BlbkV2ZW50LCBXb3JrYmVuY2hBc3luY0RhdGFUcmVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IGRlZmF1bHRCdXR0b25TdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VMYWJlbHMgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2xhYmVscy5qcyc7XG5pbXBvcnQgeyBWaWV3UGFuZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgSVZpZXdsZXRWaWV3T3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld3NWaWV3bGV0LmpzJztcbmltcG9ydCB7IElNdWx0aURpZmZFZGl0b3JSZXNvdXJjZSwgSVJlc291cmNlRGlmZkVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IEJ1bGtFZGl0UHJldmlld1Byb3ZpZGVyLCBCdWxrRmlsZU9wZXJhdGlvbiwgQnVsa0ZpbGVPcGVyYXRpb25zLCBCdWxrRmlsZU9wZXJhdGlvblR5cGUgfSBmcm9tICcuL2J1bGtFZGl0UHJldmlldy5qcyc7XG5pbXBvcnQgeyBCdWxrRWRpdEFjY2Vzc2liaWxpdHlQcm92aWRlciwgQnVsa0VkaXREYXRhU291cmNlLCBCdWxrRWRpdERlbGVnYXRlLCBCdWxrRWRpdEVsZW1lbnQsIEJ1bGtFZGl0SWRlbnRpdHlQcm92aWRlciwgQnVsa0VkaXROYXZpTGFiZWxQcm92aWRlciwgQnVsa0VkaXRTb3J0ZXIsIENhdGVnb3J5RWxlbWVudCwgQ2F0ZWdvcnlFbGVtZW50UmVuZGVyZXIsIGNvbXBhcmVCdWxrRmlsZU9wZXJhdGlvbnMsIEZpbGVFbGVtZW50LCBGaWxlRWxlbWVudFJlbmRlcmVyLCBUZXh0RWRpdEVsZW1lbnQsIFRleHRFZGl0RWxlbWVudFJlbmRlcmVyIH0gZnJvbSAnLi9idWxrRWRpdFRyZWUuanMnO1xuaW1wb3J0IHsgQUNUSVZFX0dST1VQLCBJRWRpdG9yU2VydmljZSwgU0lERV9HUk9VUCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5cbmNvbnN0IGVudW0gU3RhdGUge1xuXHREYXRhID0gJ2RhdGEnLFxuXHRNZXNzYWdlID0gJ21lc3NhZ2UnXG59XG5cbmV4cG9ydCBjbGFzcyBCdWxrRWRpdFBhbmUgZXh0ZW5kcyBWaWV3UGFuZSB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3JlZmFjdG9yUHJldmlldyc7XG5cdHN0YXRpYyByZWFkb25seSBTY2hlbWEgPSAndnNjb2RlLWJ1bGtlZGl0cHJldmlldy1tdWx0aWVkaXRvcic7XG5cblx0c3RhdGljIHJlYWRvbmx5IGN0eEhhc0NhdGVnb3JpZXMgPSBuZXcgUmF3Q29udGV4dEtleSgncmVmYWN0b3JQcmV2aWV3Lmhhc0NhdGVnb3JpZXMnLCBmYWxzZSk7XG5cdHN0YXRpYyByZWFkb25seSBjdHhHcm91cEJ5RmlsZSA9IG5ldyBSYXdDb250ZXh0S2V5KCdyZWZhY3RvclByZXZpZXcuZ3JvdXBCeUZpbGUnLCB0cnVlKTtcblx0c3RhdGljIHJlYWRvbmx5IGN0eEhhc0NoZWNrZWRDaGFuZ2VzID0gbmV3IFJhd0NvbnRleHRLZXkoJ3JlZmFjdG9yUHJldmlldy5oYXNDaGVja2VkQ2hhbmdlcycsIHRydWUpO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9tZW1Hcm91cEJ5RmlsZSA9IGAke3RoaXMuSUR9Lmdyb3VwQnlGaWxlYDtcblxuXHRwcml2YXRlIF90cmVlITogV29ya2JlbmNoQXN5bmNEYXRhVHJlZTxCdWxrRmlsZU9wZXJhdGlvbnMsIEJ1bGtFZGl0RWxlbWVudCwgRnV6enlTY29yZT47XG5cdHByaXZhdGUgX3RyZWVEYXRhU291cmNlITogQnVsa0VkaXREYXRhU291cmNlO1xuXHRwcml2YXRlIF90cmVlVmlld1N0YXRlcyA9IG5ldyBNYXA8Ym9vbGVhbiwgSUFzeW5jRGF0YVRyZWVWaWV3U3RhdGU+KCk7XG5cdHByaXZhdGUgX21lc3NhZ2UhOiBIVE1MU3BhbkVsZW1lbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY3R4SGFzQ2F0ZWdvcmllczogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2N0eEdyb3VwQnlGaWxlOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfY3R4SGFzQ2hlY2tlZENoYW5nZXM6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zZXNzaW9uRGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgX2N1cnJlbnRSZXNvbHZlPzogKGVkaXQ/OiBSZXNvdXJjZUVkaXRbXSkgPT4gdm9pZDtcblx0cHJpdmF0ZSBfY3VycmVudElucHV0PzogQnVsa0ZpbGVPcGVyYXRpb25zO1xuXHRwcml2YXRlIF9jdXJyZW50UHJvdmlkZXI/OiBCdWxrRWRpdFByZXZpZXdQcm92aWRlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRvcHRpb25zOiBJVmlld2xldFZpZXdPcHRpb25zLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFTZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2RpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoXG5cdFx0XHR7IC4uLm9wdGlvbnMsIHRpdGxlTWVudUlkOiBNZW51SWQuQnVsa0VkaXRUaXRsZSB9LFxuXHRcdFx0a2V5YmluZGluZ1NlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCB2aWV3RGVzY3JpcHRvclNlcnZpY2UsIF9pbnN0YVNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIHRoZW1lU2VydmljZSwgaG92ZXJTZXJ2aWNlXG5cdFx0KTtcblxuXHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdidWxrLWVkaXQtcGFuZWwnLCAnc2hvdy1maWxlLWljb25zJyk7XG5cdFx0dGhpcy5fY3R4SGFzQ2F0ZWdvcmllcyA9IEJ1bGtFZGl0UGFuZS5jdHhIYXNDYXRlZ29yaWVzLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fY3R4R3JvdXBCeUZpbGUgPSBCdWxrRWRpdFBhbmUuY3R4R3JvdXBCeUZpbGUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9jdHhIYXNDaGVja2VkQ2hhbmdlcyA9IEJ1bGtFZGl0UGFuZS5jdHhIYXNDaGVja2VkQ2hhbmdlcy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl90cmVlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlckJvZHkocGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlckJvZHkocGFyZW50KTtcblxuXHRcdGNvbnN0IHJlc291cmNlTGFiZWxzID0gdGhpcy5faW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0UmVzb3VyY2VMYWJlbHMsXG5cdFx0XHR7IG9uRGlkQ2hhbmdlVmlzaWJpbGl0eTogdGhpcy5vbkRpZENoYW5nZUJvZHlWaXNpYmlsaXR5IH1cblx0XHQpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChyZXNvdXJjZUxhYmVscyk7XG5cblx0XHRjb25zdCBjb250ZW50Q29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29udGVudENvbnRhaW5lci5jbGFzc05hbWUgPSAnY29udGVudCc7XG5cdFx0cGFyZW50LmFwcGVuZENoaWxkKGNvbnRlbnRDb250YWluZXIpO1xuXG5cdFx0Ly8gdHJlZVxuXHRcdGNvbnN0IHRyZWVDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRjb250ZW50Q29udGFpbmVyLmFwcGVuZENoaWxkKHRyZWVDb250YWluZXIpO1xuXG5cdFx0dGhpcy5fdHJlZURhdGFTb3VyY2UgPSB0aGlzLl9pbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQnVsa0VkaXREYXRhU291cmNlKTtcblx0XHR0aGlzLl90cmVlRGF0YVNvdXJjZS5ncm91cEJ5RmlsZSA9IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldEJvb2xlYW4oQnVsa0VkaXRQYW5lLl9tZW1Hcm91cEJ5RmlsZSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIHRydWUpO1xuXHRcdHRoaXMuX2N0eEdyb3VwQnlGaWxlLnNldCh0aGlzLl90cmVlRGF0YVNvdXJjZS5ncm91cEJ5RmlsZSk7XG5cblx0XHR0aGlzLl90cmVlID0gdGhpcy5faW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0V29ya2JlbmNoQXN5bmNEYXRhVHJlZTxCdWxrRmlsZU9wZXJhdGlvbnMsIEJ1bGtFZGl0RWxlbWVudCwgRnV6enlTY29yZT4sIHRoaXMuaWQsIHRyZWVDb250YWluZXIsXG5cdFx0XHRuZXcgQnVsa0VkaXREZWxlZ2F0ZSgpLFxuXHRcdFx0W3RoaXMuX2luc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RWRpdEVsZW1lbnRSZW5kZXJlciksIHRoaXMuX2luc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShGaWxlRWxlbWVudFJlbmRlcmVyLCByZXNvdXJjZUxhYmVscyksIHRoaXMuX2luc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShDYXRlZ29yeUVsZW1lbnRSZW5kZXJlcildLFxuXHRcdFx0dGhpcy5fdHJlZURhdGFTb3VyY2UsXG5cdFx0XHR7XG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogdGhpcy5faW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEJ1bGtFZGl0QWNjZXNzaWJpbGl0eVByb3ZpZGVyKSxcblx0XHRcdFx0aWRlbnRpdHlQcm92aWRlcjogbmV3IEJ1bGtFZGl0SWRlbnRpdHlQcm92aWRlcigpLFxuXHRcdFx0XHRleHBhbmRPbmx5T25Ud2lzdGllQ2xpY2s6IHRydWUsXG5cdFx0XHRcdG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRcdGtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI6IG5ldyBCdWxrRWRpdE5hdmlMYWJlbFByb3ZpZGVyKCksXG5cdFx0XHRcdHNvcnRlcjogbmV3IEJ1bGtFZGl0U29ydGVyKCksXG5cdFx0XHRcdHNlbGVjdGlvbk5hdmlnYXRpb246IHRydWVcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX3RyZWUub25Db250ZXh0TWVudSh0aGlzLl9vbkNvbnRleHRNZW51LCB0aGlzKSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX3RyZWUub25EaWRPcGVuKGUgPT4gdGhpcy5fb3BlbkVsZW1lbnRJbk11bHRpRGlmZkVkaXRvcihlKSkpO1xuXG5cdFx0Ly8gYnV0dG9uc1xuXHRcdGNvbnN0IGJ1dHRvbnNDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRidXR0b25zQ29udGFpbmVyLmNsYXNzTmFtZSA9ICdidXR0b25zJztcblx0XHRjb250ZW50Q29udGFpbmVyLmFwcGVuZENoaWxkKGJ1dHRvbnNDb250YWluZXIpO1xuXHRcdGNvbnN0IGJ1dHRvbkJhciA9IG5ldyBCdXR0b25CYXIoYnV0dG9uc0NvbnRhaW5lcik7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKGJ1dHRvbkJhcik7XG5cblx0XHRjb25zdCBidG5Db25maXJtID0gYnV0dG9uQmFyLmFkZEJ1dHRvbih7IHN1cHBvcnRJY29uczogdHJ1ZSwgLi4uZGVmYXVsdEJ1dHRvblN0eWxlcyB9KTtcblx0XHRidG5Db25maXJtLmxhYmVsID0gbG9jYWxpemUoJ29rJywgJ0FwcGx5Jyk7XG5cdFx0YnRuQ29uZmlybS5vbkRpZENsaWNrKCgpID0+IHRoaXMuYWNjZXB0KCksIHRoaXMsIHRoaXMuX2Rpc3Bvc2FibGVzKTtcblxuXHRcdGNvbnN0IGJ0bkNhbmNlbCA9IGJ1dHRvbkJhci5hZGRCdXR0b24oeyAuLi5kZWZhdWx0QnV0dG9uU3R5bGVzLCBzZWNvbmRhcnk6IHRydWUgfSk7XG5cdFx0YnRuQ2FuY2VsLmxhYmVsID0gbG9jYWxpemUoJ2NhbmNlbCcsICdEaXNjYXJkJyk7XG5cdFx0YnRuQ2FuY2VsLm9uRGlkQ2xpY2soKCkgPT4gdGhpcy5kaXNjYXJkKCksIHRoaXMsIHRoaXMuX2Rpc3Bvc2FibGVzKTtcblxuXHRcdC8vIG1lc3NhZ2Vcblx0XHR0aGlzLl9tZXNzYWdlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdHRoaXMuX21lc3NhZ2UuY2xhc3NOYW1lID0gJ21lc3NhZ2UnO1xuXHRcdHRoaXMuX21lc3NhZ2UuaW5uZXJUZXh0ID0gbG9jYWxpemUoJ2VtcHR5Lm1zZycsIFwiSW52b2tlIGEgY29kZSBhY3Rpb24sIGxpa2UgcmVuYW1lLCB0byBzZWUgYSBwcmV2aWV3IG9mIGl0cyBjaGFuZ2VzIGhlcmUuXCIpO1xuXHRcdHBhcmVudC5hcHBlbmRDaGlsZCh0aGlzLl9tZXNzYWdlKTtcblxuXHRcdC8vXG5cdFx0dGhpcy5fc2V0U3RhdGUoU3RhdGUuTWVzc2FnZSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgbGF5b3V0Qm9keShoZWlnaHQ6IG51bWJlciwgd2lkdGg6IG51bWJlcik6IHZvaWQge1xuXHRcdHN1cGVyLmxheW91dEJvZHkoaGVpZ2h0LCB3aWR0aCk7XG5cdFx0Y29uc3QgdHJlZUhlaWdodCA9IGhlaWdodCAtIDUwO1xuXHRcdHRoaXMuX3RyZWUuZ2V0SFRNTEVsZW1lbnQoKS5wYXJlbnRFbGVtZW50IS5zdHlsZS5oZWlnaHQgPSBgJHt0cmVlSGVpZ2h0fXB4YDtcblx0XHR0aGlzLl90cmVlLmxheW91dCh0cmVlSGVpZ2h0LCB3aWR0aCk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRTdGF0ZShzdGF0ZTogU3RhdGUpOiB2b2lkIHtcblx0XHR0aGlzLmVsZW1lbnQuZGF0YXNldFsnc3RhdGUnXSA9IHN0YXRlO1xuXHR9XG5cblx0YXN5bmMgc2V0SW5wdXQoZWRpdDogUmVzb3VyY2VFZGl0W10sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8UmVzb3VyY2VFZGl0W10gfCB1bmRlZmluZWQ+IHtcblx0XHR0aGlzLl9zZXRTdGF0ZShTdGF0ZS5EYXRhKTtcblx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR0aGlzLl90cmVlVmlld1N0YXRlcy5jbGVhcigpO1xuXG5cdFx0aWYgKHRoaXMuX2N1cnJlbnRSZXNvbHZlKSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50UmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0dGhpcy5fY3VycmVudFJlc29sdmUgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5wdXQgPSBhd2FpdCB0aGlzLl9pbnN0YVNlcnZpY2UuaW52b2tlRnVuY3Rpb24oQnVsa0ZpbGVPcGVyYXRpb25zLmNyZWF0ZSwgZWRpdCk7XG5cdFx0dGhpcy5fY3VycmVudFByb3ZpZGVyID0gdGhpcy5faW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEJ1bGtFZGl0UHJldmlld1Byb3ZpZGVyLCBpbnB1dCk7XG5cdFx0dGhpcy5fc2Vzc2lvbkRpc3Bvc2FibGVzLmFkZCh0aGlzLl9jdXJyZW50UHJvdmlkZXIpO1xuXHRcdHRoaXMuX3Nlc3Npb25EaXNwb3NhYmxlcy5hZGQoaW5wdXQpO1xuXG5cdFx0Ly9cblx0XHRjb25zdCBoYXNDYXRlZ29yaWVzID0gaW5wdXQuY2F0ZWdvcmllcy5sZW5ndGggPiAxO1xuXHRcdHRoaXMuX2N0eEhhc0NhdGVnb3JpZXMuc2V0KGhhc0NhdGVnb3JpZXMpO1xuXHRcdHRoaXMuX3RyZWVEYXRhU291cmNlLmdyb3VwQnlGaWxlID0gIWhhc0NhdGVnb3JpZXMgfHwgdGhpcy5fdHJlZURhdGFTb3VyY2UuZ3JvdXBCeUZpbGU7XG5cdFx0dGhpcy5fY3R4SGFzQ2hlY2tlZENoYW5nZXMuc2V0KGlucHV0LmNoZWNrZWQuY2hlY2tlZENvdW50ID4gMCk7XG5cblx0XHR0aGlzLl9jdXJyZW50SW5wdXQgPSBpbnB1dDtcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZTxSZXNvdXJjZUVkaXRbXSB8IHVuZGVmaW5lZD4ocmVzb2x2ZSA9PiB7XG5cblx0XHRcdHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHJlc29sdmUodW5kZWZpbmVkKSk7XG5cblx0XHRcdHRoaXMuX2N1cnJlbnRSZXNvbHZlID0gcmVzb2x2ZTtcblx0XHRcdHRoaXMuX3NldFRyZWVJbnB1dChpbnB1dCk7XG5cblx0XHRcdC8vIHJlZnJlc2ggd2hlbiBjaGVjayBzdGF0ZSBjaGFuZ2VzXG5cdFx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuYWRkKGlucHV0LmNoZWNrZWQub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl90cmVlLnVwZGF0ZUNoaWxkcmVuKCk7XG5cdFx0XHRcdHRoaXMuX2N0eEhhc0NoZWNrZWRDaGFuZ2VzLnNldChpbnB1dC5jaGVja2VkLmNoZWNrZWRDb3VudCA+IDApO1xuXHRcdFx0fSkpO1xuXHRcdH0pO1xuXHR9XG5cblx0aGFzSW5wdXQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIEJvb2xlYW4odGhpcy5fY3VycmVudElucHV0KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3NldFRyZWVJbnB1dChpbnB1dDogQnVsa0ZpbGVPcGVyYXRpb25zKSB7XG5cblx0XHRjb25zdCB2aWV3U3RhdGUgPSB0aGlzLl90cmVlVmlld1N0YXRlcy5nZXQodGhpcy5fdHJlZURhdGFTb3VyY2UuZ3JvdXBCeUZpbGUpO1xuXHRcdGF3YWl0IHRoaXMuX3RyZWUuc2V0SW5wdXQoaW5wdXQsIHZpZXdTdGF0ZSk7XG5cdFx0dGhpcy5fdHJlZS5kb21Gb2N1cygpO1xuXG5cdFx0aWYgKHZpZXdTdGF0ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIGFzeW5jIGV4cGFuZEFsbCAobWF4PTEwKSBpcyB0aGUgZGVmYXVsdCB3aGVuIG5vIHZpZXcgc3RhdGUgaXMgZ2l2ZW5cblx0XHRjb25zdCBleHBhbmQgPSBbLi4udGhpcy5fdHJlZS5nZXROb2RlKGlucHV0KS5jaGlsZHJlbl0uc2xpY2UoMCwgMTApO1xuXHRcdHdoaWxlIChleHBhbmQubGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3QgeyBlbGVtZW50IH0gPSBleHBhbmQuc2hpZnQoKSE7XG5cdFx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEZpbGVFbGVtZW50KSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX3RyZWUuZXhwYW5kKGVsZW1lbnQsIHRydWUpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBDYXRlZ29yeUVsZW1lbnQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fdHJlZS5leHBhbmQoZWxlbWVudCwgdHJ1ZSk7XG5cdFx0XHRcdGV4cGFuZC5wdXNoKC4uLnRoaXMuX3RyZWUuZ2V0Tm9kZShlbGVtZW50KS5jaGlsZHJlbik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YWNjZXB0KCk6IHZvaWQge1xuXG5cdFx0Y29uc3QgY29uZmxpY3RzID0gdGhpcy5fY3VycmVudElucHV0Py5jb25mbGljdHMubGlzdCgpO1xuXG5cdFx0aWYgKCFjb25mbGljdHMgfHwgY29uZmxpY3RzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5fZG9uZSh0cnVlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgbWVzc2FnZTogc3RyaW5nO1xuXHRcdGlmIChjb25mbGljdHMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRtZXNzYWdlID0gbG9jYWxpemUoJ2NvbmZsaWN0LjEnLCBcIkNhbm5vdCBhcHBseSByZWZhY3RvcmluZyBiZWNhdXNlICd7MH0nIGhhcyBjaGFuZ2VkIGluIHRoZSBtZWFudGltZS5cIiwgdGhpcy5fbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGNvbmZsaWN0c1swXSwgeyByZWxhdGl2ZTogdHJ1ZSB9KSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1lc3NhZ2UgPSBsb2NhbGl6ZSgnY29uZmxpY3QuTicsIFwiQ2Fubm90IGFwcGx5IHJlZmFjdG9yaW5nIGJlY2F1c2UgezB9IG90aGVyIGZpbGVzIGhhdmUgY2hhbmdlZCBpbiB0aGUgbWVhbnRpbWUuXCIsIGNvbmZsaWN0cy5sZW5ndGgpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2RpYWxvZ1NlcnZpY2Uud2FybihtZXNzYWdlKS5maW5hbGx5KCgpID0+IHRoaXMuX2RvbmUoZmFsc2UpKTtcblx0fVxuXG5cdGRpc2NhcmQoKSB7XG5cdFx0dGhpcy5fZG9uZShmYWxzZSk7XG5cdH1cblxuXHRwcml2YXRlIF9kb25lKGFjY2VwdDogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX2N1cnJlbnRSZXNvbHZlPy4oYWNjZXB0ID8gdGhpcy5fY3VycmVudElucHV0Py5nZXRXb3Jrc3BhY2VFZGl0KCkgOiB1bmRlZmluZWQpO1xuXHRcdHRoaXMuX2N1cnJlbnRJbnB1dCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9zZXRTdGF0ZShTdGF0ZS5NZXNzYWdlKTtcblx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fVxuXG5cdHRvZ2dsZUNoZWNrZWQoKSB7XG5cdFx0Y29uc3QgW2ZpcnN0XSA9IHRoaXMuX3RyZWUuZ2V0Rm9jdXMoKTtcblx0XHRpZiAoKGZpcnN0IGluc3RhbmNlb2YgRmlsZUVsZW1lbnQgfHwgZmlyc3QgaW5zdGFuY2VvZiBUZXh0RWRpdEVsZW1lbnQpICYmICFmaXJzdC5pc0Rpc2FibGVkKCkpIHtcblx0XHRcdGZpcnN0LnNldENoZWNrZWQoIWZpcnN0LmlzQ2hlY2tlZCgpKTtcblx0XHR9IGVsc2UgaWYgKGZpcnN0IGluc3RhbmNlb2YgQ2F0ZWdvcnlFbGVtZW50KSB7XG5cdFx0XHRmaXJzdC5zZXRDaGVja2VkKCFmaXJzdC5pc0NoZWNrZWQoKSk7XG5cdFx0fVxuXHR9XG5cblx0Z3JvdXBCeUZpbGUoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl90cmVlRGF0YVNvdXJjZS5ncm91cEJ5RmlsZSkge1xuXHRcdFx0dGhpcy50b2dnbGVHcm91cGluZygpO1xuXHRcdH1cblx0fVxuXG5cdGdyb3VwQnlUeXBlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl90cmVlRGF0YVNvdXJjZS5ncm91cEJ5RmlsZSkge1xuXHRcdFx0dGhpcy50b2dnbGVHcm91cGluZygpO1xuXHRcdH1cblx0fVxuXG5cdHRvZ2dsZUdyb3VwaW5nKCkge1xuXHRcdGNvbnN0IGlucHV0ID0gdGhpcy5fdHJlZS5nZXRJbnB1dCgpO1xuXHRcdGlmIChpbnB1dCkge1xuXG5cdFx0XHQvLyAoMSkgY2FwdHVyZSB2aWV3IHN0YXRlXG5cdFx0XHRjb25zdCBvbGRWaWV3U3RhdGUgPSB0aGlzLl90cmVlLmdldFZpZXdTdGF0ZSgpO1xuXHRcdFx0dGhpcy5fdHJlZVZpZXdTdGF0ZXMuc2V0KHRoaXMuX3RyZWVEYXRhU291cmNlLmdyb3VwQnlGaWxlLCBvbGRWaWV3U3RhdGUpO1xuXG5cdFx0XHQvLyAoMikgdG9nZ2xlIGFuZCB1cGRhdGVcblx0XHRcdHRoaXMuX3RyZWVEYXRhU291cmNlLmdyb3VwQnlGaWxlID0gIXRoaXMuX3RyZWVEYXRhU291cmNlLmdyb3VwQnlGaWxlO1xuXHRcdFx0dGhpcy5fc2V0VHJlZUlucHV0KGlucHV0KTtcblxuXHRcdFx0Ly8gKDMpIHJlbWVtYmVyIHByZWZlcmVuY2Vcblx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKEJ1bGtFZGl0UGFuZS5fbWVtR3JvdXBCeUZpbGUsIHRoaXMuX3RyZWVEYXRhU291cmNlLmdyb3VwQnlGaWxlLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0XHRcdHRoaXMuX2N0eEdyb3VwQnlGaWxlLnNldCh0aGlzLl90cmVlRGF0YVNvdXJjZS5ncm91cEJ5RmlsZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfb3BlbkVsZW1lbnRJbk11bHRpRGlmZkVkaXRvcihlOiBJT3BlbkV2ZW50PEJ1bGtFZGl0RWxlbWVudCB8IHVuZGVmaW5lZD4pOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdGNvbnN0IGZpbGVPcGVyYXRpb25zID0gdGhpcy5fY3VycmVudElucHV0Py5maWxlT3BlcmF0aW9ucztcblx0XHRpZiAoIWZpbGVPcGVyYXRpb25zKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IHNlbGVjdGlvbjogSVJhbmdlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGxldCBmaWxlRWxlbWVudDogRmlsZUVsZW1lbnQ7XG5cdFx0aWYgKGUuZWxlbWVudCBpbnN0YW5jZW9mIFRleHRFZGl0RWxlbWVudCkge1xuXHRcdFx0ZmlsZUVsZW1lbnQgPSBlLmVsZW1lbnQucGFyZW50O1xuXHRcdFx0c2VsZWN0aW9uID0gZS5lbGVtZW50LmVkaXQudGV4dEVkaXQudGV4dEVkaXQucmFuZ2U7XG5cdFx0fSBlbHNlIGlmIChlLmVsZW1lbnQgaW5zdGFuY2VvZiBGaWxlRWxlbWVudCkge1xuXHRcdFx0ZmlsZUVsZW1lbnQgPSBlLmVsZW1lbnQ7XG5cdFx0XHRzZWxlY3Rpb24gPSBlLmVsZW1lbnQuZWRpdC50ZXh0RWRpdHNbMF0/LnRleHRFZGl0LnRleHRFZGl0LnJhbmdlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBpbnZhbGlkIGV2ZW50XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5fY29tcHV0ZVJlc291cmNlRGlmZkVkaXRvcklucHV0cy5nZXQoZmlsZU9wZXJhdGlvbnMpO1xuXHRcdGNvbnN0IHJlc291cmNlSWQgPSBhd2FpdCByZXN1bHQuZ2V0UmVzb3VyY2VEaWZmRWRpdG9ySW5wdXRJZE9mT3BlcmF0aW9uKGZpbGVFbGVtZW50LmVkaXQpO1xuXHRcdGNvbnN0IG9wdGlvbnM6IE11dGFibGU8SU11bHRpRGlmZkVkaXRvck9wdGlvbnM+ID0ge1xuXHRcdFx0Li4uZS5lZGl0b3JPcHRpb25zLFxuXHRcdFx0dmlld1N0YXRlOiB7XG5cdFx0XHRcdHJldmVhbERhdGE6IHtcblx0XHRcdFx0XHRyZXNvdXJjZTogcmVzb3VyY2VJZCxcblx0XHRcdFx0XHRyYW5nZTogc2VsZWN0aW9uLFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRjb25zdCBtdWx0aURpZmZTb3VyY2UgPSBVUkkuZnJvbSh7IHNjaGVtZTogQnVsa0VkaXRQYW5lLlNjaGVtYSB9KTtcblx0XHRjb25zdCBsYWJlbCA9ICdSZWZhY3RvciBQcmV2aWV3Jztcblx0XHR0aGlzLl9lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0bXVsdGlEaWZmU291cmNlLFxuXHRcdFx0bGFiZWwsXG5cdFx0XHRvcHRpb25zLFxuXHRcdFx0aXNUcmFuc2llbnQ6IHRydWUsXG5cdFx0XHRkZXNjcmlwdGlvbjogbGFiZWwsXG5cdFx0XHRyZXNvdXJjZXM6IHJlc3VsdC5yZXNvdXJjZXNcblx0XHR9LCBlLnNpZGVCeVNpZGUgPyBTSURFX0dST1VQIDogQUNUSVZFX0dST1VQKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbXB1dGVSZXNvdXJjZURpZmZFZGl0b3JJbnB1dHMgPSBuZXcgTFJVQ2FjaGVkRnVuY3Rpb248XG5cdFx0QnVsa0ZpbGVPcGVyYXRpb25bXSxcblx0XHRQcm9taXNlPHsgcmVzb3VyY2VzOiBJTXVsdGlEaWZmRWRpdG9yUmVzb3VyY2VbXTsgZ2V0UmVzb3VyY2VEaWZmRWRpdG9ySW5wdXRJZE9mT3BlcmF0aW9uOiAob3BlcmF0aW9uOiBCdWxrRmlsZU9wZXJhdGlvbikgPT4gUHJvbWlzZTxJTXVsdGlEaWZmUmVzb3VyY2VJZD4gfT5cblx0Pihhc3luYyAoZmlsZU9wZXJhdGlvbnMpID0+IHtcblx0XHRjb25zdCBjb21wdXRlRGlmZkVkaXRvcklucHV0ID0gbmV3IENhY2hlZEZ1bmN0aW9uPEJ1bGtGaWxlT3BlcmF0aW9uLCBQcm9taXNlPElNdWx0aURpZmZFZGl0b3JSZXNvdXJjZT4+KGFzeW5jIChmaWxlT3BlcmF0aW9uKSA9PiB7XG5cdFx0XHRjb25zdCBmaWxlT3BlcmF0aW9uVXJpID0gZmlsZU9wZXJhdGlvbi51cmk7XG5cdFx0XHRjb25zdCBwcmV2aWV3VXJpID0gdGhpcy5fY3VycmVudFByb3ZpZGVyIS5hc1ByZXZpZXdVcmkoZmlsZU9wZXJhdGlvblVyaSk7XG5cdFx0XHQvLyBkZWxldGVcblx0XHRcdGlmIChmaWxlT3BlcmF0aW9uLnR5cGUgJiBCdWxrRmlsZU9wZXJhdGlvblR5cGUuRGVsZXRlKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0b3JpZ2luYWw6IHsgcmVzb3VyY2U6IFVSSS5yZXZpdmUocHJldmlld1VyaSkgfSxcblx0XHRcdFx0XHRtb2RpZmllZDogeyByZXNvdXJjZTogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdFx0Z29Ub0ZpbGVSZXNvdXJjZTogZmlsZU9wZXJhdGlvbi51cmksXG5cdFx0XHRcdH0gc2F0aXNmaWVzIElNdWx0aURpZmZFZGl0b3JSZXNvdXJjZTtcblxuXHRcdFx0fVxuXHRcdFx0Ly8gcmVuYW1lLCBjcmVhdGUsIGVkaXRzXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0bGV0IGxlZnRSZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdChhd2FpdCB0aGlzLl90ZXh0TW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKGZpbGVPcGVyYXRpb25VcmkpKS5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0bGVmdFJlc291cmNlID0gZmlsZU9wZXJhdGlvblVyaTtcblx0XHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdFx0bGVmdFJlc291cmNlID0gQnVsa0VkaXRQcmV2aWV3UHJvdmlkZXIuZW1wdHlQcmV2aWV3O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0b3JpZ2luYWw6IHsgcmVzb3VyY2U6IFVSSS5yZXZpdmUobGVmdFJlc291cmNlKSB9LFxuXHRcdFx0XHRcdG1vZGlmaWVkOiB7IHJlc291cmNlOiBVUkkucmV2aXZlKHByZXZpZXdVcmkpIH0sXG5cdFx0XHRcdFx0Z29Ub0ZpbGVSZXNvdXJjZTogbGVmdFJlc291cmNlLFxuXHRcdFx0XHR9IHNhdGlzZmllcyBJTXVsdGlEaWZmRWRpdG9yUmVzb3VyY2U7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBzb3J0ZWRGaWxlT3BlcmF0aW9ucyA9IGZpbGVPcGVyYXRpb25zLnNsaWNlKCkuc29ydChjb21wYXJlQnVsa0ZpbGVPcGVyYXRpb25zKTtcblx0XHRjb25zdCByZXNvdXJjZXM6IElSZXNvdXJjZURpZmZFZGl0b3JJbnB1dFtdID0gW107XG5cdFx0Zm9yIChjb25zdCBvcGVyYXRpb24gb2Ygc29ydGVkRmlsZU9wZXJhdGlvbnMpIHtcblx0XHRcdHJlc291cmNlcy5wdXNoKGF3YWl0IGNvbXB1dGVEaWZmRWRpdG9ySW5wdXQuZ2V0KG9wZXJhdGlvbikpO1xuXHRcdH1cblx0XHRjb25zdCBnZXRSZXNvdXJjZURpZmZFZGl0b3JJbnB1dElkT2ZPcGVyYXRpb24gPSBhc3luYyAob3BlcmF0aW9uOiBCdWxrRmlsZU9wZXJhdGlvbik6IFByb21pc2U8SU11bHRpRGlmZlJlc291cmNlSWQ+ID0+IHtcblx0XHRcdGNvbnN0IHJlc291cmNlID0gYXdhaXQgY29tcHV0ZURpZmZFZGl0b3JJbnB1dC5nZXQob3BlcmF0aW9uKTtcblx0XHRcdHJldHVybiB7IG9yaWdpbmFsOiByZXNvdXJjZS5vcmlnaW5hbC5yZXNvdXJjZSwgbW9kaWZpZWQ6IHJlc291cmNlLm1vZGlmaWVkLnJlc291cmNlIH07XG5cdFx0fTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzb3VyY2VzLFxuXHRcdFx0Z2V0UmVzb3VyY2VEaWZmRWRpdG9ySW5wdXRJZE9mT3BlcmF0aW9uXG5cdFx0fTtcblx0fSk7XG5cblx0cHJpdmF0ZSBfb25Db250ZXh0TWVudShlOiBJVHJlZUNvbnRleHRNZW51RXZlbnQ8YW55Pik6IHZvaWQge1xuXG5cdFx0dGhpcy5fY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRtZW51SWQ6IE1lbnVJZC5CdWxrRWRpdENvbnRleHQsXG5cdFx0XHRjb250ZXh0S2V5U2VydmljZTogdGhpcy5jb250ZXh0S2V5U2VydmljZSxcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gZS5hbmNob3Jcblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGlCQUFpQjtBQUcxQixTQUFTLGdCQUFnQix5QkFBeUI7QUFHbEQsU0FBUyx1QkFBdUI7QUFFaEMsU0FBUyxXQUFXO0FBQ3BCLE9BQU87QUFJUCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGNBQWM7QUFDdkIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBc0Isb0JBQW9CLHFCQUFxQjtBQUMvRCxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHNCQUFzQjtBQUMvQixT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
