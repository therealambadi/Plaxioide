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
import { Disposable, DisposableMap, DisposableStore } from "../../../base/common/lifecycle.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { Extensions, ResolvableTreeItem, NoTreeViewError } from "../../common/views.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { distinct } from "../../../base/common/arrays.js";
import { INotificationService } from "../../../platform/notification/common/notification.js";
import { isUndefinedOrNull, isNumber } from "../../../base/common/types.js";
import { Registry } from "../../../platform/registry/common/platform.js";
import { IExtensionService } from "../../services/extensions/common/extensions.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { createStringDataTransferItem, VSDataTransfer } from "../../../base/common/dataTransfer.js";
import { DataTransferFileCache } from "../common/shared/dataTransferCache.js";
import * as typeConvert from "../common/extHostTypeConverters.js";
import { IViewsService } from "../../services/views/common/viewsService.js";
let MainThreadTreeViews = class extends Disposable {
  constructor(extHostContext, viewsService, notificationService, extensionService, logService) {
    super();
    this.viewsService = viewsService;
    this.notificationService = notificationService;
    this.extensionService = extensionService;
    this.logService = logService;
    this._dataProviders = this._register(new DisposableMap());
    this._dndControllers = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostTreeViews);
  }
  async $registerTreeViewDataProvider(treeViewId, options) {
    this.logService.trace("MainThreadTreeViews#$registerTreeViewDataProvider", treeViewId, options);
    this.extensionService.whenInstalledExtensionsRegistered().then(() => {
      const dataProvider = new TreeViewDataProvider(treeViewId, this._proxy, this.notificationService);
      const disposables = new DisposableStore();
      this._dataProviders.set(treeViewId, { dataProvider, dispose: () => disposables.dispose() });
      const dndController = options.hasHandleDrag || options.hasHandleDrop ? new TreeViewDragAndDropController(treeViewId, options.dropMimeTypes, options.dragMimeTypes, options.hasHandleDrag, this._proxy) : void 0;
      const viewer = this.getTreeView(treeViewId);
      if (viewer) {
        viewer.showCollapseAllAction = options.showCollapseAll;
        viewer.canSelectMany = options.canSelectMany;
        viewer.manuallyManageCheckboxes = options.manuallyManageCheckboxes;
        viewer.dragAndDropController = dndController;
        if (dndController) {
          this._dndControllers.set(treeViewId, dndController);
        }
        viewer.dataProvider = dataProvider;
        this.registerListeners(treeViewId, viewer, disposables);
        this._proxy.$setVisible(treeViewId, viewer.visible);
      } else {
        this.notificationService.error("No view is registered with id: " + treeViewId);
      }
    });
  }
  $reveal(treeViewId, itemInfo, options) {
    this.logService.trace("MainThreadTreeViews#$reveal", treeViewId, itemInfo?.item, itemInfo?.parentChain, options);
    return this.viewsService.openView(treeViewId, options.focus).then(() => {
      const viewer = this.getTreeView(treeViewId);
      if (viewer && itemInfo) {
        return this.reveal(viewer, this._dataProviders.get(treeViewId).dataProvider, itemInfo.item, itemInfo.parentChain, options);
      }
      return void 0;
    });
  }
  $refresh(treeViewId, itemsToRefreshByHandle) {
    this.logService.trace("MainThreadTreeViews#$refresh", treeViewId, itemsToRefreshByHandle);
    const viewer = this.getTreeView(treeViewId);
    const dataProvider = this._dataProviders.get(treeViewId);
    if (viewer && dataProvider) {
      const itemsToRefresh = dataProvider.dataProvider.getItemsToRefresh(itemsToRefreshByHandle);
      return viewer.refresh(itemsToRefresh.items.length ? itemsToRefresh.items : void 0, itemsToRefresh.checkboxes.length ? itemsToRefresh.checkboxes : void 0);
    }
    return Promise.resolve();
  }
  $setMessage(treeViewId, message) {
    this.logService.trace("MainThreadTreeViews#$setMessage", treeViewId, message.toString());
    const viewer = this.getTreeView(treeViewId);
    if (viewer) {
      viewer.message = message;
    }
  }
  $setTitle(treeViewId, title, description) {
    this.logService.trace("MainThreadTreeViews#$setTitle", treeViewId, title, description);
    const viewer = this.getTreeView(treeViewId);
    if (viewer) {
      viewer.title = title;
      viewer.description = description;
    }
  }
  $setBadge(treeViewId, badge) {
    this.logService.trace("MainThreadTreeViews#$setBadge", treeViewId, badge?.value, badge?.tooltip);
    const viewer = this.getTreeView(treeViewId);
    if (viewer) {
      viewer.badge = badge;
    }
  }
  $resolveDropFileData(destinationViewId, requestId, dataItemId) {
    const controller = this._dndControllers.get(destinationViewId);
    if (!controller) {
      throw new Error("Unknown tree");
    }
    return controller.resolveDropFileData(requestId, dataItemId);
  }
  async $disposeTree(treeViewId) {
    const viewer = this.getTreeView(treeViewId);
    if (viewer) {
      viewer.dataProvider = void 0;
    }
    this._dataProviders.deleteAndDispose(treeViewId);
  }
  async reveal(treeView, dataProvider, itemIn, parentChain, options) {
    options = options ? options : { select: false, focus: false };
    const select = isUndefinedOrNull(options.select) ? false : options.select;
    const focus = isUndefinedOrNull(options.focus) ? false : options.focus;
    let expand = Math.min(isNumber(options.expand) ? options.expand : options.expand === true ? 1 : 0, 3);
    if (dataProvider.isEmpty()) {
      await treeView.refresh();
    }
    for (const parent of parentChain) {
      const parentItem = dataProvider.getItem(parent.handle);
      if (parentItem) {
        await treeView.expand(parentItem);
      }
    }
    const item = dataProvider.getItem(itemIn.handle);
    if (item) {
      await treeView.reveal(item);
      if (select) {
        treeView.setSelection([item]);
      }
      if (focus === false) {
        treeView.setFocus();
      } else if (focus) {
        treeView.setFocus(item);
      }
      let itemsToExpand = [item];
      for (; itemsToExpand.length > 0 && expand > 0; expand--) {
        await treeView.expand(itemsToExpand);
        itemsToExpand = itemsToExpand.reduce((result, itemValue) => {
          const item2 = dataProvider.getItem(itemValue.handle);
          if (item2 && item2.children && item2.children.length) {
            result.push(...item2.children);
          }
          return result;
        }, []);
      }
    }
  }
  registerListeners(treeViewId, treeView, disposables) {
    disposables.add(treeView.onDidExpandItem((item) => this._proxy.$setExpanded(treeViewId, item.handle, true)));
    disposables.add(treeView.onDidCollapseItem((item) => this._proxy.$setExpanded(treeViewId, item.handle, false)));
    disposables.add(treeView.onDidChangeSelectionAndFocus((items) => this._proxy.$setSelectionAndFocus(treeViewId, items.selection.map(({ handle }) => handle), items.focus.handle)));
    disposables.add(treeView.onDidChangeVisibility((isVisible) => this._proxy.$setVisible(treeViewId, isVisible)));
    disposables.add(treeView.onDidChangeCheckboxState((items) => {
      this._proxy.$changeCheckboxState(treeViewId, items.map((item) => {
        return { treeItemHandle: item.handle, newState: item.checkbox?.isChecked ?? false };
      }));
    }));
  }
  getTreeView(treeViewId) {
    const viewDescriptor = Registry.as(Extensions.ViewsRegistry).getView(treeViewId);
    return viewDescriptor ? viewDescriptor.treeView : null;
  }
  dispose() {
    for (const dataprovider of this._dataProviders) {
      const treeView = this.getTreeView(dataprovider[0]);
      if (treeView) {
        treeView.dataProvider = void 0;
      }
    }
    this._dataProviders.dispose();
    this._dndControllers.clear();
    super.dispose();
  }
};
MainThreadTreeViews = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadTreeViews),
  __decorateParam(1, IViewsService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, ILogService)
], MainThreadTreeViews);
class TreeViewDragAndDropController {
  constructor(treeViewId, dropMimeTypes, dragMimeTypes, hasWillDrop, _proxy) {
    this.treeViewId = treeViewId;
    this.dropMimeTypes = dropMimeTypes;
    this.dragMimeTypes = dragMimeTypes;
    this.hasWillDrop = hasWillDrop;
    this._proxy = _proxy;
    this.dataTransfersCache = new DataTransferFileCache();
  }
  async handleDrop(dataTransfer, targetTreeItem, token, operationUuid, sourceTreeId, sourceTreeItemHandles) {
    const request = this.dataTransfersCache.add(dataTransfer);
    try {
      const dataTransferDto = await typeConvert.DataTransfer.fromList(dataTransfer);
      if (token.isCancellationRequested) {
        return;
      }
      return await this._proxy.$handleDrop(this.treeViewId, request.id, dataTransferDto, targetTreeItem?.handle, token, operationUuid, sourceTreeId, sourceTreeItemHandles);
    } finally {
      request.dispose();
    }
  }
  async handleDrag(sourceTreeItemHandles, operationUuid, token) {
    if (!this.hasWillDrop) {
      return;
    }
    const additionalDataTransferDTO = await this._proxy.$handleDrag(this.treeViewId, sourceTreeItemHandles, operationUuid, token);
    if (!additionalDataTransferDTO) {
      return;
    }
    const additionalDataTransfer = new VSDataTransfer();
    additionalDataTransferDTO.items.forEach(([type, item]) => {
      additionalDataTransfer.replace(type, createStringDataTransferItem(item.asString));
    });
    return additionalDataTransfer;
  }
  resolveDropFileData(requestId, dataItemId) {
    return this.dataTransfersCache.resolveFileData(requestId, dataItemId);
  }
}
class TreeViewDataProvider {
  constructor(treeViewId, _proxy, notificationService) {
    this.treeViewId = treeViewId;
    this._proxy = _proxy;
    this.notificationService = notificationService;
    this.itemsMap = /* @__PURE__ */ new Map();
    this.hasResolve = this._proxy.$hasResolve(this.treeViewId);
  }
  async getChildren(treeItem) {
    const batches = await this.getChildrenBatch(treeItem ? [treeItem] : void 0);
    return batches?.[0];
  }
  getChildrenBatch(treeItems) {
    if (!treeItems) {
      this.itemsMap.clear();
    }
    return this._proxy.$getChildren(this.treeViewId, treeItems ? treeItems.map((item) => item.handle) : void 0).then(
      (children) => {
        const convertedChildren = this.convertTransferChildren(treeItems ?? [], children);
        return this.postGetChildren(convertedChildren);
      },
      (err) => {
        if (!NoTreeViewError.is(err)) {
          this.notificationService.error(err);
        }
        return [];
      }
    );
  }
  convertTransferChildren(parents, children) {
    const convertedChildren = Array(parents.length);
    if (children) {
      for (const childGroup of children) {
        const childGroupIndex = childGroup[0];
        convertedChildren[childGroupIndex] = childGroup.slice(1);
      }
    }
    return convertedChildren;
  }
  getItemsToRefresh(itemsToRefreshByHandle) {
    const itemsToRefresh = [];
    const checkboxesToRefresh = [];
    if (itemsToRefreshByHandle) {
      for (const newTreeItemHandle of Object.keys(itemsToRefreshByHandle)) {
        const currentTreeItem = this.getItem(newTreeItemHandle);
        if (currentTreeItem) {
          const newTreeItem = itemsToRefreshByHandle[newTreeItemHandle];
          if (currentTreeItem.checkbox?.isChecked !== newTreeItem.checkbox?.isChecked) {
            checkboxesToRefresh.push(currentTreeItem);
          }
          this.updateTreeItem(currentTreeItem, newTreeItem);
          if (newTreeItemHandle === newTreeItem.handle) {
            itemsToRefresh.push(currentTreeItem);
          } else {
            this.itemsMap.delete(newTreeItemHandle);
            this.itemsMap.set(currentTreeItem.handle, currentTreeItem);
            const parent = newTreeItem.parentHandle ? this.itemsMap.get(newTreeItem.parentHandle) : null;
            if (parent) {
              itemsToRefresh.push(parent);
            }
          }
        }
      }
    }
    return { items: itemsToRefresh, checkboxes: checkboxesToRefresh };
  }
  getItem(treeItemHandle) {
    return this.itemsMap.get(treeItemHandle);
  }
  isEmpty() {
    return this.itemsMap.size === 0;
  }
  async postGetChildren(elementGroups) {
    if (elementGroups === void 0) {
      return void 0;
    }
    const resultGroups = [];
    const hasResolve = await this.hasResolve;
    if (elementGroups) {
      for (const elements of elementGroups) {
        const result = [];
        resultGroups.push(result);
        if (!elements) {
          continue;
        }
        for (const element of elements) {
          const resolvable = new ResolvableTreeItem(element, hasResolve ? (token) => {
            return this._proxy.$resolve(this.treeViewId, element.handle, token);
          } : void 0);
          this.itemsMap.set(element.handle, resolvable);
          result.push(resolvable);
        }
      }
    }
    return resultGroups;
  }
  updateTreeItem(current, treeItem) {
    treeItem.children = treeItem.children ? treeItem.children : void 0;
    if (current) {
      const properties = distinct([
        ...Object.keys(current instanceof ResolvableTreeItem ? current.asTreeItem() : current),
        ...Object.keys(treeItem)
      ]);
      for (const property of properties) {
        current[property] = treeItem[property];
      }
      if (current instanceof ResolvableTreeItem) {
        current.resetResolve();
      }
    }
  }
}
export {
  MainThreadTreeViews
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZFRyZWVWaWV3cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVNYXAsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0Q29udGV4dCwgTWFpblRocmVhZFRyZWVWaWV3c1NoYXBlLCBFeHRIb3N0VHJlZVZpZXdzU2hhcGUsIE1haW5Db250ZXh0LCBDaGVja2JveFVwZGF0ZSB9IGZyb20gJy4uL2NvbW1vbi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IElUcmVlSXRlbSwgSVRyZWVWaWV3LCBJVmlld3NSZWdpc3RyeSwgSVRyZWVWaWV3RGVzY3JpcHRvciwgSVJldmVhbE9wdGlvbnMsIEV4dGVuc2lvbnMsIFJlc29sdmFibGVUcmVlSXRlbSwgSVRyZWVWaWV3RHJhZ0FuZERyb3BDb250cm9sbGVyLCBJVmlld0JhZGdlLCBOb1RyZWVWaWV3RXJyb3IsIElUcmVlVmlld0RhdGFQcm92aWRlciB9IGZyb20gJy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBleHRIb3N0TmFtZWRDdXN0b21lciwgSUV4dEhvc3RDb250ZXh0IH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0SG9zdEN1c3RvbWVycy5qcyc7XG5pbXBvcnQgeyBkaXN0aW5jdCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IGlzVW5kZWZpbmVkT3JOdWxsLCBpc051bWJlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IGNyZWF0ZVN0cmluZ0RhdGFUcmFuc2Zlckl0ZW0sIFZTRGF0YVRyYW5zZmVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZGF0YVRyYW5zZmVyLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IERhdGFUcmFuc2ZlckZpbGVDYWNoZSB9IGZyb20gJy4uL2NvbW1vbi9zaGFyZWQvZGF0YVRyYW5zZmVyQ2FjaGUuanMnO1xuaW1wb3J0ICogYXMgdHlwZUNvbnZlcnQgZnJvbSAnLi4vY29tbW9uL2V4dEhvc3RUeXBlQ29udmVydGVycy5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5cbkBleHRIb3N0TmFtZWRDdXN0b21lcihNYWluQ29udGV4dC5NYWluVGhyZWFkVHJlZVZpZXdzKVxuZXhwb3J0IGNsYXNzIE1haW5UaHJlYWRUcmVlVmlld3MgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgTWFpblRocmVhZFRyZWVWaWV3c1NoYXBlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm94eTogRXh0SG9zdFRyZWVWaWV3c1NoYXBlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kYXRhUHJvdmlkZXJzOiBEaXNwb3NhYmxlTWFwPHN0cmluZywgeyBkYXRhUHJvdmlkZXI6IFRyZWVWaWV3RGF0YVByb3ZpZGVyOyBkaXNwb3NlOiAoKSA9PiB2b2lkIH0+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVNYXA8c3RyaW5nLCB7IGRhdGFQcm92aWRlcjogVHJlZVZpZXdEYXRhUHJvdmlkZXI7IGRpc3Bvc2U6ICgpID0+IHZvaWQgfT4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RuZENvbnRyb2xsZXJzID0gbmV3IE1hcDxzdHJpbmcsIFRyZWVWaWV3RHJhZ0FuZERyb3BDb250cm9sbGVyPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGV4dEhvc3RDb250ZXh0OiBJRXh0SG9zdENvbnRleHQsXG5cdFx0QElWaWV3c1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB2aWV3c1NlcnZpY2U6IElWaWV3c1NlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9wcm94eSA9IGV4dEhvc3RDb250ZXh0LmdldFByb3h5KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RUcmVlVmlld3MpO1xuXHR9XG5cblx0YXN5bmMgJHJlZ2lzdGVyVHJlZVZpZXdEYXRhUHJvdmlkZXIodHJlZVZpZXdJZDogc3RyaW5nLCBvcHRpb25zOiB7IHNob3dDb2xsYXBzZUFsbDogYm9vbGVhbjsgY2FuU2VsZWN0TWFueTogYm9vbGVhbjsgZHJvcE1pbWVUeXBlczogc3RyaW5nW107IGRyYWdNaW1lVHlwZXM6IHN0cmluZ1tdOyBoYXNIYW5kbGVEcmFnOiBib29sZWFuOyBoYXNIYW5kbGVEcm9wOiBib29sZWFuOyBtYW51YWxseU1hbmFnZUNoZWNrYm94ZXM6IGJvb2xlYW4gfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnTWFpblRocmVhZFRyZWVWaWV3cyMkcmVnaXN0ZXJUcmVlVmlld0RhdGFQcm92aWRlcicsIHRyZWVWaWV3SWQsIG9wdGlvbnMpO1xuXG5cdFx0dGhpcy5leHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpLnRoZW4oKCkgPT4ge1xuXHRcdFx0Y29uc3QgZGF0YVByb3ZpZGVyID0gbmV3IFRyZWVWaWV3RGF0YVByb3ZpZGVyKHRyZWVWaWV3SWQsIHRoaXMuX3Byb3h5LCB0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHR0aGlzLl9kYXRhUHJvdmlkZXJzLnNldCh0cmVlVmlld0lkLCB7IGRhdGFQcm92aWRlciwgZGlzcG9zZTogKCkgPT4gZGlzcG9zYWJsZXMuZGlzcG9zZSgpIH0pO1xuXHRcdFx0Y29uc3QgZG5kQ29udHJvbGxlciA9IChvcHRpb25zLmhhc0hhbmRsZURyYWcgfHwgb3B0aW9ucy5oYXNIYW5kbGVEcm9wKVxuXHRcdFx0XHQ/IG5ldyBUcmVlVmlld0RyYWdBbmREcm9wQ29udHJvbGxlcih0cmVlVmlld0lkLCBvcHRpb25zLmRyb3BNaW1lVHlwZXMsIG9wdGlvbnMuZHJhZ01pbWVUeXBlcywgb3B0aW9ucy5oYXNIYW5kbGVEcmFnLCB0aGlzLl9wcm94eSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCB2aWV3ZXIgPSB0aGlzLmdldFRyZWVWaWV3KHRyZWVWaWV3SWQpO1xuXHRcdFx0aWYgKHZpZXdlcikge1xuXHRcdFx0XHQvLyBPcmRlciBpcyBpbXBvcnRhbnQgaGVyZS4gVGhlIGludGVybmFsIHRyZWUgaXNuJ3QgY3JlYXRlZCB1bnRpbCB0aGUgZGF0YVByb3ZpZGVyIGlzIHNldC5cblx0XHRcdFx0Ly8gU2V0IGFsbCBvdGhlciBwcm9wZXJ0aWVzIGZpcnN0IVxuXHRcdFx0XHR2aWV3ZXIuc2hvd0NvbGxhcHNlQWxsQWN0aW9uID0gb3B0aW9ucy5zaG93Q29sbGFwc2VBbGw7XG5cdFx0XHRcdHZpZXdlci5jYW5TZWxlY3RNYW55ID0gb3B0aW9ucy5jYW5TZWxlY3RNYW55O1xuXHRcdFx0XHR2aWV3ZXIubWFudWFsbHlNYW5hZ2VDaGVja2JveGVzID0gb3B0aW9ucy5tYW51YWxseU1hbmFnZUNoZWNrYm94ZXM7XG5cdFx0XHRcdHZpZXdlci5kcmFnQW5kRHJvcENvbnRyb2xsZXIgPSBkbmRDb250cm9sbGVyO1xuXHRcdFx0XHRpZiAoZG5kQ29udHJvbGxlcikge1xuXHRcdFx0XHRcdHRoaXMuX2RuZENvbnRyb2xsZXJzLnNldCh0cmVlVmlld0lkLCBkbmRDb250cm9sbGVyKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR2aWV3ZXIuZGF0YVByb3ZpZGVyID0gZGF0YVByb3ZpZGVyO1xuXHRcdFx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKHRyZWVWaWV3SWQsIHZpZXdlciwgZGlzcG9zYWJsZXMpO1xuXHRcdFx0XHR0aGlzLl9wcm94eS4kc2V0VmlzaWJsZSh0cmVlVmlld0lkLCB2aWV3ZXIudmlzaWJsZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IoJ05vIHZpZXcgaXMgcmVnaXN0ZXJlZCB3aXRoIGlkOiAnICsgdHJlZVZpZXdJZCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHQkcmV2ZWFsKHRyZWVWaWV3SWQ6IHN0cmluZywgaXRlbUluZm86IHsgaXRlbTogSVRyZWVJdGVtOyBwYXJlbnRDaGFpbjogSVRyZWVJdGVtW10gfSB8IHVuZGVmaW5lZCwgb3B0aW9uczogSVJldmVhbE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ01haW5UaHJlYWRUcmVlVmlld3MjJHJldmVhbCcsIHRyZWVWaWV3SWQsIGl0ZW1JbmZvPy5pdGVtLCBpdGVtSW5mbz8ucGFyZW50Q2hhaW4sIG9wdGlvbnMpO1xuXG5cdFx0cmV0dXJuIHRoaXMudmlld3NTZXJ2aWNlLm9wZW5WaWV3KHRyZWVWaWV3SWQsIG9wdGlvbnMuZm9jdXMpXG5cdFx0XHQudGhlbigoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHZpZXdlciA9IHRoaXMuZ2V0VHJlZVZpZXcodHJlZVZpZXdJZCk7XG5cdFx0XHRcdGlmICh2aWV3ZXIgJiYgaXRlbUluZm8pIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5yZXZlYWwodmlld2VyLCB0aGlzLl9kYXRhUHJvdmlkZXJzLmdldCh0cmVlVmlld0lkKSEuZGF0YVByb3ZpZGVyLCBpdGVtSW5mby5pdGVtLCBpdGVtSW5mby5wYXJlbnRDaGFpbiwgb3B0aW9ucyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0pO1xuXHR9XG5cblx0JHJlZnJlc2godHJlZVZpZXdJZDogc3RyaW5nLCBpdGVtc1RvUmVmcmVzaEJ5SGFuZGxlOiB7IFt0cmVlSXRlbUhhbmRsZTogc3RyaW5nXTogSVRyZWVJdGVtIH0pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ01haW5UaHJlYWRUcmVlVmlld3MjJHJlZnJlc2gnLCB0cmVlVmlld0lkLCBpdGVtc1RvUmVmcmVzaEJ5SGFuZGxlKTtcblxuXHRcdGNvbnN0IHZpZXdlciA9IHRoaXMuZ2V0VHJlZVZpZXcodHJlZVZpZXdJZCk7XG5cdFx0Y29uc3QgZGF0YVByb3ZpZGVyID0gdGhpcy5fZGF0YVByb3ZpZGVycy5nZXQodHJlZVZpZXdJZCk7XG5cdFx0aWYgKHZpZXdlciAmJiBkYXRhUHJvdmlkZXIpIHtcblx0XHRcdGNvbnN0IGl0ZW1zVG9SZWZyZXNoID0gZGF0YVByb3ZpZGVyLmRhdGFQcm92aWRlci5nZXRJdGVtc1RvUmVmcmVzaChpdGVtc1RvUmVmcmVzaEJ5SGFuZGxlKTtcblx0XHRcdHJldHVybiB2aWV3ZXIucmVmcmVzaChpdGVtc1RvUmVmcmVzaC5pdGVtcy5sZW5ndGggPyBpdGVtc1RvUmVmcmVzaC5pdGVtcyA6IHVuZGVmaW5lZCwgaXRlbXNUb1JlZnJlc2guY2hlY2tib3hlcy5sZW5ndGggPyBpdGVtc1RvUmVmcmVzaC5jaGVja2JveGVzIDogdW5kZWZpbmVkKTtcblx0XHR9XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHR9XG5cblx0JHNldE1lc3NhZ2UodHJlZVZpZXdJZDogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcgfCBJTWFya2Rvd25TdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ01haW5UaHJlYWRUcmVlVmlld3MjJHNldE1lc3NhZ2UnLCB0cmVlVmlld0lkLCBtZXNzYWdlLnRvU3RyaW5nKCkpO1xuXG5cdFx0Y29uc3Qgdmlld2VyID0gdGhpcy5nZXRUcmVlVmlldyh0cmVlVmlld0lkKTtcblx0XHRpZiAodmlld2VyKSB7XG5cdFx0XHR2aWV3ZXIubWVzc2FnZSA9IG1lc3NhZ2U7XG5cdFx0fVxuXHR9XG5cblx0JHNldFRpdGxlKHRyZWVWaWV3SWQ6IHN0cmluZywgdGl0bGU6IHN0cmluZywgZGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnTWFpblRocmVhZFRyZWVWaWV3cyMkc2V0VGl0bGUnLCB0cmVlVmlld0lkLCB0aXRsZSwgZGVzY3JpcHRpb24pO1xuXG5cdFx0Y29uc3Qgdmlld2VyID0gdGhpcy5nZXRUcmVlVmlldyh0cmVlVmlld0lkKTtcblx0XHRpZiAodmlld2VyKSB7XG5cdFx0XHR2aWV3ZXIudGl0bGUgPSB0aXRsZTtcblx0XHRcdHZpZXdlci5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuXHRcdH1cblx0fVxuXG5cdCRzZXRCYWRnZSh0cmVlVmlld0lkOiBzdHJpbmcsIGJhZGdlOiBJVmlld0JhZGdlIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdNYWluVGhyZWFkVHJlZVZpZXdzIyRzZXRCYWRnZScsIHRyZWVWaWV3SWQsIGJhZGdlPy52YWx1ZSwgYmFkZ2U/LnRvb2x0aXApO1xuXG5cdFx0Y29uc3Qgdmlld2VyID0gdGhpcy5nZXRUcmVlVmlldyh0cmVlVmlld0lkKTtcblx0XHRpZiAodmlld2VyKSB7XG5cdFx0XHR2aWV3ZXIuYmFkZ2UgPSBiYWRnZTtcblx0XHR9XG5cdH1cblxuXHQkcmVzb2x2ZURyb3BGaWxlRGF0YShkZXN0aW5hdGlvblZpZXdJZDogc3RyaW5nLCByZXF1ZXN0SWQ6IG51bWJlciwgZGF0YUl0ZW1JZDogc3RyaW5nKTogUHJvbWlzZTxWU0J1ZmZlcj4ge1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLl9kbmRDb250cm9sbGVycy5nZXQoZGVzdGluYXRpb25WaWV3SWQpO1xuXHRcdGlmICghY29udHJvbGxlcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdVbmtub3duIHRyZWUnKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNvbnRyb2xsZXIucmVzb2x2ZURyb3BGaWxlRGF0YShyZXF1ZXN0SWQsIGRhdGFJdGVtSWQpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRkaXNwb3NlVHJlZSh0cmVlVmlld0lkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB2aWV3ZXIgPSB0aGlzLmdldFRyZWVWaWV3KHRyZWVWaWV3SWQpO1xuXHRcdGlmICh2aWV3ZXIpIHtcblx0XHRcdHZpZXdlci5kYXRhUHJvdmlkZXIgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZGF0YVByb3ZpZGVycy5kZWxldGVBbmREaXNwb3NlKHRyZWVWaWV3SWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXZlYWwodHJlZVZpZXc6IElUcmVlVmlldywgZGF0YVByb3ZpZGVyOiBUcmVlVmlld0RhdGFQcm92aWRlciwgaXRlbUluOiBJVHJlZUl0ZW0sIHBhcmVudENoYWluOiBJVHJlZUl0ZW1bXSwgb3B0aW9uczogSVJldmVhbE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRvcHRpb25zID0gb3B0aW9ucyA/IG9wdGlvbnMgOiB7IHNlbGVjdDogZmFsc2UsIGZvY3VzOiBmYWxzZSB9O1xuXHRcdGNvbnN0IHNlbGVjdCA9IGlzVW5kZWZpbmVkT3JOdWxsKG9wdGlvbnMuc2VsZWN0KSA/IGZhbHNlIDogb3B0aW9ucy5zZWxlY3Q7XG5cdFx0Y29uc3QgZm9jdXMgPSBpc1VuZGVmaW5lZE9yTnVsbChvcHRpb25zLmZvY3VzKSA/IGZhbHNlIDogb3B0aW9ucy5mb2N1cztcblx0XHRsZXQgZXhwYW5kID0gTWF0aC5taW4oaXNOdW1iZXIob3B0aW9ucy5leHBhbmQpID8gb3B0aW9ucy5leHBhbmQgOiBvcHRpb25zLmV4cGFuZCA9PT0gdHJ1ZSA/IDEgOiAwLCAzKTtcblxuXHRcdGlmIChkYXRhUHJvdmlkZXIuaXNFbXB0eSgpKSB7XG5cdFx0XHQvLyBSZWZyZXNoIGlmIGVtcHR5XG5cdFx0XHRhd2FpdCB0cmVlVmlldy5yZWZyZXNoKCk7XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgcGFyZW50IG9mIHBhcmVudENoYWluKSB7XG5cdFx0XHRjb25zdCBwYXJlbnRJdGVtID0gZGF0YVByb3ZpZGVyLmdldEl0ZW0ocGFyZW50LmhhbmRsZSk7XG5cdFx0XHRpZiAocGFyZW50SXRlbSkge1xuXHRcdFx0XHRhd2FpdCB0cmVlVmlldy5leHBhbmQocGFyZW50SXRlbSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IGl0ZW0gPSBkYXRhUHJvdmlkZXIuZ2V0SXRlbShpdGVtSW4uaGFuZGxlKTtcblx0XHRpZiAoaXRlbSkge1xuXHRcdFx0YXdhaXQgdHJlZVZpZXcucmV2ZWFsKGl0ZW0pO1xuXHRcdFx0aWYgKHNlbGVjdCkge1xuXHRcdFx0XHR0cmVlVmlldy5zZXRTZWxlY3Rpb24oW2l0ZW1dKTtcblx0XHRcdH1cblx0XHRcdGlmIChmb2N1cyA9PT0gZmFsc2UpIHtcblx0XHRcdFx0dHJlZVZpZXcuc2V0Rm9jdXMoKTtcblx0XHRcdH0gZWxzZSBpZiAoZm9jdXMpIHtcblx0XHRcdFx0dHJlZVZpZXcuc2V0Rm9jdXMoaXRlbSk7XG5cdFx0XHR9XG5cdFx0XHRsZXQgaXRlbXNUb0V4cGFuZCA9IFtpdGVtXTtcblx0XHRcdGZvciAoOyBpdGVtc1RvRXhwYW5kLmxlbmd0aCA+IDAgJiYgZXhwYW5kID4gMDsgZXhwYW5kLS0pIHtcblx0XHRcdFx0YXdhaXQgdHJlZVZpZXcuZXhwYW5kKGl0ZW1zVG9FeHBhbmQpO1xuXHRcdFx0XHRpdGVtc1RvRXhwYW5kID0gaXRlbXNUb0V4cGFuZC5yZWR1Y2UoKHJlc3VsdCwgaXRlbVZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgaXRlbSA9IGRhdGFQcm92aWRlci5nZXRJdGVtKGl0ZW1WYWx1ZS5oYW5kbGUpO1xuXHRcdFx0XHRcdGlmIChpdGVtICYmIGl0ZW0uY2hpbGRyZW4gJiYgaXRlbS5jaGlsZHJlbi5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKC4uLml0ZW0uY2hpbGRyZW4pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0XHR9LCBbXSBhcyBJVHJlZUl0ZW1bXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycyh0cmVlVmlld0lkOiBzdHJpbmcsIHRyZWVWaWV3OiBJVHJlZVZpZXcsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiB2b2lkIHtcblx0XHRkaXNwb3NhYmxlcy5hZGQodHJlZVZpZXcub25EaWRFeHBhbmRJdGVtKGl0ZW0gPT4gdGhpcy5fcHJveHkuJHNldEV4cGFuZGVkKHRyZWVWaWV3SWQsIGl0ZW0uaGFuZGxlLCB0cnVlKSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0cmVlVmlldy5vbkRpZENvbGxhcHNlSXRlbShpdGVtID0+IHRoaXMuX3Byb3h5LiRzZXRFeHBhbmRlZCh0cmVlVmlld0lkLCBpdGVtLmhhbmRsZSwgZmFsc2UpKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRyZWVWaWV3Lm9uRGlkQ2hhbmdlU2VsZWN0aW9uQW5kRm9jdXMoaXRlbXMgPT4gdGhpcy5fcHJveHkuJHNldFNlbGVjdGlvbkFuZEZvY3VzKHRyZWVWaWV3SWQsIGl0ZW1zLnNlbGVjdGlvbi5tYXAoKHsgaGFuZGxlIH0pID0+IGhhbmRsZSksIGl0ZW1zLmZvY3VzLmhhbmRsZSkpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodHJlZVZpZXcub25EaWRDaGFuZ2VWaXNpYmlsaXR5KGlzVmlzaWJsZSA9PiB0aGlzLl9wcm94eS4kc2V0VmlzaWJsZSh0cmVlVmlld0lkLCBpc1Zpc2libGUpKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRyZWVWaWV3Lm9uRGlkQ2hhbmdlQ2hlY2tib3hTdGF0ZShpdGVtcyA9PiB7XG5cdFx0XHR0aGlzLl9wcm94eS4kY2hhbmdlQ2hlY2tib3hTdGF0ZSh0cmVlVmlld0lkLCA8Q2hlY2tib3hVcGRhdGVbXT5pdGVtcy5tYXAoaXRlbSA9PiB7XG5cdFx0XHRcdHJldHVybiB7IHRyZWVJdGVtSGFuZGxlOiBpdGVtLmhhbmRsZSwgbmV3U3RhdGU6IGl0ZW0uY2hlY2tib3g/LmlzQ2hlY2tlZCA/PyBmYWxzZSB9O1xuXHRcdFx0fSkpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0VHJlZVZpZXcodHJlZVZpZXdJZDogc3RyaW5nKTogSVRyZWVWaWV3IHwgbnVsbCB7XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3I6IElUcmVlVmlld0Rlc2NyaXB0b3IgPSA8SVRyZWVWaWV3RGVzY3JpcHRvcj5SZWdpc3RyeS5hczxJVmlld3NSZWdpc3RyeT4oRXh0ZW5zaW9ucy5WaWV3c1JlZ2lzdHJ5KS5nZXRWaWV3KHRyZWVWaWV3SWQpO1xuXHRcdHJldHVybiB2aWV3RGVzY3JpcHRvciA/IHZpZXdEZXNjcmlwdG9yLnRyZWVWaWV3IDogbnVsbDtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBkYXRhcHJvdmlkZXIgb2YgdGhpcy5fZGF0YVByb3ZpZGVycykge1xuXHRcdFx0Y29uc3QgdHJlZVZpZXcgPSB0aGlzLmdldFRyZWVWaWV3KGRhdGFwcm92aWRlclswXSk7XG5cdFx0XHRpZiAodHJlZVZpZXcpIHtcblx0XHRcdFx0dHJlZVZpZXcuZGF0YVByb3ZpZGVyID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9kYXRhUHJvdmlkZXJzLmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMuX2RuZENvbnRyb2xsZXJzLmNsZWFyKCk7XG5cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxudHlwZSBUcmVlSXRlbUhhbmRsZSA9IHN0cmluZztcblxuY2xhc3MgVHJlZVZpZXdEcmFnQW5kRHJvcENvbnRyb2xsZXIgaW1wbGVtZW50cyBJVHJlZVZpZXdEcmFnQW5kRHJvcENvbnRyb2xsZXIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGF0YVRyYW5zZmVyc0NhY2hlID0gbmV3IERhdGFUcmFuc2ZlckZpbGVDYWNoZSgpO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgdHJlZVZpZXdJZDogc3RyaW5nLFxuXHRcdHJlYWRvbmx5IGRyb3BNaW1lVHlwZXM6IHN0cmluZ1tdLFxuXHRcdHJlYWRvbmx5IGRyYWdNaW1lVHlwZXM6IHN0cmluZ1tdLFxuXHRcdHJlYWRvbmx5IGhhc1dpbGxEcm9wOiBib29sZWFuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBFeHRIb3N0VHJlZVZpZXdzU2hhcGUpIHsgfVxuXG5cdGFzeW5jIGhhbmRsZURyb3AoZGF0YVRyYW5zZmVyOiBWU0RhdGFUcmFuc2ZlciwgdGFyZ2V0VHJlZUl0ZW06IElUcmVlSXRlbSB8IHVuZGVmaW5lZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuLFxuXHRcdG9wZXJhdGlvblV1aWQ/OiBzdHJpbmcsIHNvdXJjZVRyZWVJZD86IHN0cmluZywgc291cmNlVHJlZUl0ZW1IYW5kbGVzPzogc3RyaW5nW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCByZXF1ZXN0ID0gdGhpcy5kYXRhVHJhbnNmZXJzQ2FjaGUuYWRkKGRhdGFUcmFuc2Zlcik7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGRhdGFUcmFuc2ZlckR0byA9IGF3YWl0IHR5cGVDb252ZXJ0LkRhdGFUcmFuc2Zlci5mcm9tTGlzdChkYXRhVHJhbnNmZXIpO1xuXHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJldHVybiBhd2FpdCB0aGlzLl9wcm94eS4kaGFuZGxlRHJvcCh0aGlzLnRyZWVWaWV3SWQsIHJlcXVlc3QuaWQsIGRhdGFUcmFuc2ZlckR0bywgdGFyZ2V0VHJlZUl0ZW0/LmhhbmRsZSwgdG9rZW4sIG9wZXJhdGlvblV1aWQsIHNvdXJjZVRyZWVJZCwgc291cmNlVHJlZUl0ZW1IYW5kbGVzKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0cmVxdWVzdC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgaGFuZGxlRHJhZyhzb3VyY2VUcmVlSXRlbUhhbmRsZXM6IHN0cmluZ1tdLCBvcGVyYXRpb25VdWlkOiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VlNEYXRhVHJhbnNmZXIgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMuaGFzV2lsbERyb3ApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgYWRkaXRpb25hbERhdGFUcmFuc2ZlckRUTyA9IGF3YWl0IHRoaXMuX3Byb3h5LiRoYW5kbGVEcmFnKHRoaXMudHJlZVZpZXdJZCwgc291cmNlVHJlZUl0ZW1IYW5kbGVzLCBvcGVyYXRpb25VdWlkLCB0b2tlbik7XG5cdFx0aWYgKCFhZGRpdGlvbmFsRGF0YVRyYW5zZmVyRFRPKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWRkaXRpb25hbERhdGFUcmFuc2ZlciA9IG5ldyBWU0RhdGFUcmFuc2ZlcigpO1xuXHRcdGFkZGl0aW9uYWxEYXRhVHJhbnNmZXJEVE8uaXRlbXMuZm9yRWFjaCgoW3R5cGUsIGl0ZW1dKSA9PiB7XG5cdFx0XHRhZGRpdGlvbmFsRGF0YVRyYW5zZmVyLnJlcGxhY2UodHlwZSwgY3JlYXRlU3RyaW5nRGF0YVRyYW5zZmVySXRlbShpdGVtLmFzU3RyaW5nKSk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGFkZGl0aW9uYWxEYXRhVHJhbnNmZXI7XG5cdH1cblxuXHRwdWJsaWMgcmVzb2x2ZURyb3BGaWxlRGF0YShyZXF1ZXN0SWQ6IG51bWJlciwgZGF0YUl0ZW1JZDogc3RyaW5nKTogUHJvbWlzZTxWU0J1ZmZlcj4ge1xuXHRcdHJldHVybiB0aGlzLmRhdGFUcmFuc2ZlcnNDYWNoZS5yZXNvbHZlRmlsZURhdGEocmVxdWVzdElkLCBkYXRhSXRlbUlkKTtcblx0fVxufVxuXG5jbGFzcyBUcmVlVmlld0RhdGFQcm92aWRlciBpbXBsZW1lbnRzIElUcmVlVmlld0RhdGFQcm92aWRlciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBpdGVtc01hcDogTWFwPFRyZWVJdGVtSGFuZGxlLCBJVHJlZUl0ZW0+ID0gbmV3IE1hcDxUcmVlSXRlbUhhbmRsZSwgSVRyZWVJdGVtPigpO1xuXHRwcml2YXRlIGhhc1Jlc29sdmU6IFByb21pc2U8Ym9vbGVhbj47XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSB0cmVlVmlld0lkOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IEV4dEhvc3RUcmVlVmlld3NTaGFwZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuaGFzUmVzb2x2ZSA9IHRoaXMuX3Byb3h5LiRoYXNSZXNvbHZlKHRoaXMudHJlZVZpZXdJZCk7XG5cdH1cblxuXHRhc3luYyBnZXRDaGlsZHJlbih0cmVlSXRlbT86IElUcmVlSXRlbSk6IFByb21pc2U8SVRyZWVJdGVtW10gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBiYXRjaGVzID0gYXdhaXQgdGhpcy5nZXRDaGlsZHJlbkJhdGNoKHRyZWVJdGVtID8gW3RyZWVJdGVtXSA6IHVuZGVmaW5lZCk7XG5cdFx0cmV0dXJuIGJhdGNoZXM/LlswXTtcblx0fVxuXG5cdGdldENoaWxkcmVuQmF0Y2godHJlZUl0ZW1zPzogSVRyZWVJdGVtW10pOiBQcm9taXNlPElUcmVlSXRlbVtdW10gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRyZWVJdGVtcykge1xuXHRcdFx0dGhpcy5pdGVtc01hcC5jbGVhcigpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJGdldENoaWxkcmVuKHRoaXMudHJlZVZpZXdJZCwgdHJlZUl0ZW1zID8gdHJlZUl0ZW1zLm1hcChpdGVtID0+IGl0ZW0uaGFuZGxlKSA6IHVuZGVmaW5lZClcblx0XHRcdC50aGVuKFxuXHRcdFx0XHRjaGlsZHJlbiA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgY29udmVydGVkQ2hpbGRyZW4gPSB0aGlzLmNvbnZlcnRUcmFuc2ZlckNoaWxkcmVuKHRyZWVJdGVtcyA/PyBbXSwgY2hpbGRyZW4pO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLnBvc3RHZXRDaGlsZHJlbihjb252ZXJ0ZWRDaGlsZHJlbik7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGVyciA9PiB7XG5cdFx0XHRcdFx0Ly8gSXQgY2FuIGhhcHBlbiB0aGF0IGEgdHJlZSB2aWV3IGlzIGRpc3Bvc2VkIHJpZ2h0IGFzIGBnZXRDaGlsZHJlbmAgaXMgY2FsbGVkLiBUaGlzIHJlc3VsdHMgaW4gYW4gZXJyb3IgYmVjYXVzZSB0aGUgZGF0YSBwcm92aWRlciBnZXRzIHJlbW92ZWQuXG5cdFx0XHRcdFx0Ly8gVGhlIHRyZWUgd2lsbCBzaG9ydGx5IGdldCBjbGVhbmVkIHVwIGluIHRoaXMgY2FzZS4gV2UganVzdCBuZWVkIHRvIGhhbmRsZSB0aGUgZXJyb3IgaGVyZS5cblx0XHRcdFx0XHRpZiAoIU5vVHJlZVZpZXdFcnJvci5pcyhlcnIpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IoZXJyKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgY29udmVydFRyYW5zZmVyQ2hpbGRyZW4ocGFyZW50czogSVRyZWVJdGVtW10sIGNoaWxkcmVuOiAobnVtYmVyIHwgSVRyZWVJdGVtKVtdW10gfCB1bmRlZmluZWQpIHtcblx0XHRjb25zdCBjb252ZXJ0ZWRDaGlsZHJlbjogKElUcmVlSXRlbVtdIHwgdW5kZWZpbmVkKVtdID0gQXJyYXkocGFyZW50cy5sZW5ndGgpO1xuXHRcdGlmIChjaGlsZHJlbikge1xuXHRcdFx0Zm9yIChjb25zdCBjaGlsZEdyb3VwIG9mIGNoaWxkcmVuKSB7XG5cdFx0XHRcdGNvbnN0IGNoaWxkR3JvdXBJbmRleCA9IGNoaWxkR3JvdXBbMF0gYXMgbnVtYmVyO1xuXHRcdFx0XHRjb252ZXJ0ZWRDaGlsZHJlbltjaGlsZEdyb3VwSW5kZXhdID0gY2hpbGRHcm91cC5zbGljZSgxKSBhcyBJVHJlZUl0ZW1bXTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGNvbnZlcnRlZENoaWxkcmVuO1xuXHR9XG5cblx0Z2V0SXRlbXNUb1JlZnJlc2goaXRlbXNUb1JlZnJlc2hCeUhhbmRsZTogeyBbdHJlZUl0ZW1IYW5kbGU6IHN0cmluZ106IElUcmVlSXRlbSB9KTogeyBpdGVtczogSVRyZWVJdGVtW107IGNoZWNrYm94ZXM6IElUcmVlSXRlbVtdIH0ge1xuXHRcdGNvbnN0IGl0ZW1zVG9SZWZyZXNoOiBJVHJlZUl0ZW1bXSA9IFtdO1xuXHRcdGNvbnN0IGNoZWNrYm94ZXNUb1JlZnJlc2g6IElUcmVlSXRlbVtdID0gW107XG5cdFx0aWYgKGl0ZW1zVG9SZWZyZXNoQnlIYW5kbGUpIHtcblx0XHRcdGZvciAoY29uc3QgbmV3VHJlZUl0ZW1IYW5kbGUgb2YgT2JqZWN0LmtleXMoaXRlbXNUb1JlZnJlc2hCeUhhbmRsZSkpIHtcblx0XHRcdFx0Y29uc3QgY3VycmVudFRyZWVJdGVtID0gdGhpcy5nZXRJdGVtKG5ld1RyZWVJdGVtSGFuZGxlKTtcblx0XHRcdFx0aWYgKGN1cnJlbnRUcmVlSXRlbSkgeyAvLyBSZWZyZXNoIG9ubHkgaWYgdGhlIGl0ZW0gZXhpc3RzXG5cdFx0XHRcdFx0Y29uc3QgbmV3VHJlZUl0ZW0gPSBpdGVtc1RvUmVmcmVzaEJ5SGFuZGxlW25ld1RyZWVJdGVtSGFuZGxlXTtcblx0XHRcdFx0XHRpZiAoY3VycmVudFRyZWVJdGVtLmNoZWNrYm94Py5pc0NoZWNrZWQgIT09IG5ld1RyZWVJdGVtLmNoZWNrYm94Py5pc0NoZWNrZWQpIHtcblx0XHRcdFx0XHRcdGNoZWNrYm94ZXNUb1JlZnJlc2gucHVzaChjdXJyZW50VHJlZUl0ZW0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvLyBVcGRhdGUgdGhlIGN1cnJlbnQgaXRlbSB3aXRoIHJlZnJlc2hlZCBpdGVtXG5cdFx0XHRcdFx0dGhpcy51cGRhdGVUcmVlSXRlbShjdXJyZW50VHJlZUl0ZW0sIG5ld1RyZWVJdGVtKTtcblx0XHRcdFx0XHRpZiAobmV3VHJlZUl0ZW1IYW5kbGUgPT09IG5ld1RyZWVJdGVtLmhhbmRsZSkge1xuXHRcdFx0XHRcdFx0aXRlbXNUb1JlZnJlc2gucHVzaChjdXJyZW50VHJlZUl0ZW0pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHQvLyBVcGRhdGUgbWFwcyB3aGVuIGhhbmRsZSBpcyBjaGFuZ2VkIGFuZCByZWZyZXNoIHBhcmVudFxuXHRcdFx0XHRcdFx0dGhpcy5pdGVtc01hcC5kZWxldGUobmV3VHJlZUl0ZW1IYW5kbGUpO1xuXHRcdFx0XHRcdFx0dGhpcy5pdGVtc01hcC5zZXQoY3VycmVudFRyZWVJdGVtLmhhbmRsZSwgY3VycmVudFRyZWVJdGVtKTtcblx0XHRcdFx0XHRcdGNvbnN0IHBhcmVudCA9IG5ld1RyZWVJdGVtLnBhcmVudEhhbmRsZSA/IHRoaXMuaXRlbXNNYXAuZ2V0KG5ld1RyZWVJdGVtLnBhcmVudEhhbmRsZSkgOiBudWxsO1xuXHRcdFx0XHRcdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0XHRcdFx0XHRpdGVtc1RvUmVmcmVzaC5wdXNoKHBhcmVudCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB7IGl0ZW1zOiBpdGVtc1RvUmVmcmVzaCwgY2hlY2tib3hlczogY2hlY2tib3hlc1RvUmVmcmVzaCB9O1xuXHR9XG5cblx0Z2V0SXRlbSh0cmVlSXRlbUhhbmRsZTogc3RyaW5nKTogSVRyZWVJdGVtIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5pdGVtc01hcC5nZXQodHJlZUl0ZW1IYW5kbGUpO1xuXHR9XG5cblx0aXNFbXB0eSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5pdGVtc01hcC5zaXplID09PSAwO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBwb3N0R2V0Q2hpbGRyZW4oZWxlbWVudEdyb3VwczogKElUcmVlSXRlbVtdIHwgdW5kZWZpbmVkKVtdIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxSZXNvbHZhYmxlVHJlZUl0ZW1bXVtdIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKGVsZW1lbnRHcm91cHMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0R3JvdXBzOiBSZXNvbHZhYmxlVHJlZUl0ZW1bXVtdID0gW107XG5cdFx0Y29uc3QgaGFzUmVzb2x2ZSA9IGF3YWl0IHRoaXMuaGFzUmVzb2x2ZTtcblx0XHRpZiAoZWxlbWVudEdyb3Vwcykge1xuXHRcdFx0Zm9yIChjb25zdCBlbGVtZW50cyBvZiBlbGVtZW50R3JvdXBzKSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdDogUmVzb2x2YWJsZVRyZWVJdGVtW10gPSBbXTtcblx0XHRcdFx0cmVzdWx0R3JvdXBzLnB1c2gocmVzdWx0KTtcblx0XHRcdFx0aWYgKCFlbGVtZW50cykge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuXHRcdFx0XHRcdGNvbnN0IHJlc29sdmFibGUgPSBuZXcgUmVzb2x2YWJsZVRyZWVJdGVtKGVsZW1lbnQsIGhhc1Jlc29sdmUgPyAodG9rZW4pID0+IHtcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLl9wcm94eS4kcmVzb2x2ZSh0aGlzLnRyZWVWaWV3SWQsIGVsZW1lbnQuaGFuZGxlLCB0b2tlbik7XG5cdFx0XHRcdFx0fSA6IHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0dGhpcy5pdGVtc01hcC5zZXQoZWxlbWVudC5oYW5kbGUsIHJlc29sdmFibGUpO1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKHJlc29sdmFibGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHRHcm91cHM7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVRyZWVJdGVtKGN1cnJlbnQ6IElUcmVlSXRlbSwgdHJlZUl0ZW06IElUcmVlSXRlbSk6IHZvaWQge1xuXHRcdHRyZWVJdGVtLmNoaWxkcmVuID0gdHJlZUl0ZW0uY2hpbGRyZW4gPyB0cmVlSXRlbS5jaGlsZHJlbiA6IHVuZGVmaW5lZDtcblx0XHRpZiAoY3VycmVudCkge1xuXHRcdFx0Y29uc3QgcHJvcGVydGllcyA9IGRpc3RpbmN0KFsuLi5PYmplY3Qua2V5cyhjdXJyZW50IGluc3RhbmNlb2YgUmVzb2x2YWJsZVRyZWVJdGVtID8gY3VycmVudC5hc1RyZWVJdGVtKCkgOiBjdXJyZW50KSxcblx0XHRcdC4uLk9iamVjdC5rZXlzKHRyZWVJdGVtKV0pO1xuXHRcdFx0Zm9yIChjb25zdCBwcm9wZXJ0eSBvZiBwcm9wZXJ0aWVzKSB7XG5cdFx0XHRcdCg8YW55PmN1cnJlbnQpW3Byb3BlcnR5XSA9ICg8YW55PnRyZWVJdGVtKVtwcm9wZXJ0eV07XG5cdFx0XHR9XG5cdFx0XHRpZiAoY3VycmVudCBpbnN0YW5jZW9mIFJlc29sdmFibGVUcmVlSXRlbSkge1xuXHRcdFx0XHRjdXJyZW50LnJlc2V0UmVzb2x2ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFlBQVksZUFBZSx1QkFBdUI7QUFDM0QsU0FBUyxnQkFBaUUsbUJBQW1DO0FBQzdHLFNBQW9GLFlBQVksb0JBQWdFLHVCQUE4QztBQUM5TSxTQUFTLDRCQUE2QztBQUN0RCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLG1CQUFtQixnQkFBZ0I7QUFDNUMsU0FB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
