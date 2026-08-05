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
import * as nls from "../../../../nls.js";
import { IRemoteExplorerService, REMOTE_EXPLORER_TYPE_KEY } from "../../../services/remote/common/remoteExplorerService.js";
import { isStringArray } from "../../../../base/common/types.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { VIEWLET_ID } from "./remoteExplorer.js";
import { getVirtualWorkspaceLocation } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { Disposable, DisposableMap } from "../../../../base/common/lifecycle.js";
const SELECTED_REMOTE_IN_EXPLORER = new RawContextKey("selectedRemoteInExplorer", "");
let SwitchRemoteViewItem = class extends Disposable {
  constructor(contextKeyService, remoteExplorerService, environmentService, storageService, workspaceContextService) {
    super();
    this.contextKeyService = contextKeyService;
    this.remoteExplorerService = remoteExplorerService;
    this.environmentService = environmentService;
    this.storageService = storageService;
    this.workspaceContextService = workspaceContextService;
    this.completedRemotes = this._register(new DisposableMap());
    this.selectedRemoteContext = SELECTED_REMOTE_IN_EXPLORER.bindTo(contextKeyService);
    this.switchRemoteMenu = MenuId.for("workbench.remote.menu.switchRemoteMenu");
    this._register(MenuRegistry.appendMenuItem(MenuId.ViewContainerTitle, {
      submenu: this.switchRemoteMenu,
      title: nls.localize("switchRemote.label", "Switch Remote"),
      group: "navigation",
      when: ContextKeyExpr.equals("viewContainer", VIEWLET_ID),
      order: 1,
      isSelection: true
    }));
    this._register(remoteExplorerService.onDidChangeTargetType((e) => {
      this.select(e);
    }));
  }
  setSelectionForConnection() {
    let isSetForConnection = false;
    if (this.completedRemotes.size > 0) {
      let authority;
      const remoteAuthority = this.environmentService.remoteAuthority;
      let virtualWorkspace;
      if (!remoteAuthority) {
        virtualWorkspace = getVirtualWorkspaceLocation(this.workspaceContextService.getWorkspace())?.scheme;
      }
      isSetForConnection = true;
      const explorerType = remoteAuthority ? [remoteAuthority.split("+")[0]] : virtualWorkspace ? [virtualWorkspace] : this.storageService.get(REMOTE_EXPLORER_TYPE_KEY, StorageScope.WORKSPACE)?.split(",") ?? this.storageService.get(REMOTE_EXPLORER_TYPE_KEY, StorageScope.PROFILE)?.split(",");
      if (explorerType !== void 0) {
        authority = this.getAuthorityForExplorerType(explorerType);
      }
      if (authority) {
        this.select(authority);
      }
    }
    return isSetForConnection;
  }
  select(authority) {
    this.selectedRemoteContext.set(authority[0]);
    this.remoteExplorerService.targetType = authority;
  }
  getAuthorityForExplorerType(explorerType) {
    let authority;
    for (const option of this.completedRemotes) {
      for (const authorityOption of option[1].authority) {
        for (const explorerOption of explorerType) {
          if (authorityOption === explorerOption) {
            authority = option[1].authority;
            break;
          } else if (option[1].virtualWorkspace === explorerOption) {
            authority = option[1].authority;
            break;
          }
        }
      }
    }
    return authority;
  }
  removeOptionItems(views) {
    for (const view of views) {
      if (view.group && view.group.startsWith("targets") && view.remoteAuthority && (!view.when || this.contextKeyService.contextMatchesRules(view.when))) {
        const authority = isStringArray(view.remoteAuthority) ? view.remoteAuthority : [view.remoteAuthority];
        this.completedRemotes.deleteAndDispose(authority[0]);
      }
    }
  }
  createOptionItems(views) {
    const startingCount = this.completedRemotes.size;
    for (const view of views) {
      if (view.group && view.group.startsWith("targets") && view.remoteAuthority && (!view.when || this.contextKeyService.contextMatchesRules(view.when))) {
        const text = view.name;
        const authority = isStringArray(view.remoteAuthority) ? view.remoteAuthority : [view.remoteAuthority];
        if (this.completedRemotes.has(authority[0])) {
          continue;
        }
        const thisCapture = this;
        const action = registerAction2(class extends Action2 {
          constructor() {
            super({
              id: `workbench.action.remoteExplorer.show.${authority[0]}`,
              title: text,
              toggled: SELECTED_REMOTE_IN_EXPLORER.isEqualTo(authority[0]),
              menu: {
                id: thisCapture.switchRemoteMenu
              }
            });
          }
          async run() {
            thisCapture.select(authority);
          }
        });
        this.completedRemotes.set(authority[0], { text: text.value, authority, virtualWorkspace: view.virtualWorkspace, dispose: () => action.dispose() });
      }
    }
    if (this.completedRemotes.size > startingCount) {
      this.setSelectionForConnection();
    }
  }
};
SwitchRemoteViewItem = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IRemoteExplorerService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IWorkspaceContextService)
], SwitchRemoteViewItem);
export {
  SELECTED_REMOTE_IN_EXPLORER,
  SwitchRemoteViewItem
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9yZW1vdGUvYnJvd3Nlci9leHBsb3JlclZpZXdJdGVtcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUV4cGxvcmVyU2VydmljZSwgUkVNT1RFX0VYUExPUkVSX1RZUEVfS0VZIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVFeHBsb3JlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVNlbGVjdE9wdGlvbkl0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc2VsZWN0Qm94L3NlbGVjdEJveC5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgaXNTdHJpbmdBcnJheSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSwgUmF3Q29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgTWVudUlkLCBNZW51UmVnaXN0cnksIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgVklFV0xFVF9JRCB9IGZyb20gJy4vcmVtb3RlRXhwbG9yZXIuanMnO1xuaW1wb3J0IHsgZ2V0VmlydHVhbFdvcmtzcGFjZUxvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi92aXJ0dWFsV29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuXG5pbnRlcmZhY2UgSVJlbW90ZVNlbGVjdEl0ZW0gZXh0ZW5kcyBJU2VsZWN0T3B0aW9uSXRlbSB7XG5cdGF1dGhvcml0eTogc3RyaW5nW107XG5cdHZpcnR1YWxXb3Jrc3BhY2U/OiBzdHJpbmc7XG5cdGRpc3Bvc2UoKTogdm9pZDtcbn1cblxuZXhwb3J0IGNvbnN0IFNFTEVDVEVEX1JFTU9URV9JTl9FWFBMT1JFUiA9IG5ldyBSYXdDb250ZXh0S2V5PHN0cmluZz4oJ3NlbGVjdGVkUmVtb3RlSW5FeHBsb3JlcicsICcnKTtcblxuZXhwb3J0IGNsYXNzIFN3aXRjaFJlbW90ZVZpZXdJdGVtIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgc3dpdGNoUmVtb3RlTWVudTogTWVudUlkO1xuXHRwcml2YXRlIGNvbXBsZXRlZFJlbW90ZXM6IERpc3Bvc2FibGVNYXA8c3RyaW5nLCBJUmVtb3RlU2VsZWN0SXRlbT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZU1hcCgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBzZWxlY3RlZFJlbW90ZUNvbnRleHQ6IElDb250ZXh0S2V5PHN0cmluZz47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElSZW1vdGVFeHBsb3JlclNlcnZpY2UgcHJpdmF0ZSByZW1vdGVFeHBsb3JlclNlcnZpY2U6IElSZW1vdGVFeHBsb3JlclNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnNlbGVjdGVkUmVtb3RlQ29udGV4dCA9IFNFTEVDVEVEX1JFTU9URV9JTl9FWFBMT1JFUi5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5zd2l0Y2hSZW1vdGVNZW51ID0gTWVudUlkLmZvcignd29ya2JlbmNoLnJlbW90ZS5tZW51LnN3aXRjaFJlbW90ZU1lbnUnKTtcblx0XHR0aGlzLl9yZWdpc3RlcihNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLlZpZXdDb250YWluZXJUaXRsZSwge1xuXHRcdFx0c3VibWVudTogdGhpcy5zd2l0Y2hSZW1vdGVNZW51LFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnc3dpdGNoUmVtb3RlLmxhYmVsJywgXCJTd2l0Y2ggUmVtb3RlXCIpLFxuXHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlld0NvbnRhaW5lcicsIFZJRVdMRVRfSUQpLFxuXHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRpc1NlbGVjdGlvbjogdHJ1ZVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihyZW1vdGVFeHBsb3JlclNlcnZpY2Uub25EaWRDaGFuZ2VUYXJnZXRUeXBlKGUgPT4ge1xuXHRcdFx0dGhpcy5zZWxlY3QoZSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHVibGljIHNldFNlbGVjdGlvbkZvckNvbm5lY3Rpb24oKTogYm9vbGVhbiB7XG5cdFx0bGV0IGlzU2V0Rm9yQ29ubmVjdGlvbiA9IGZhbHNlO1xuXHRcdGlmICh0aGlzLmNvbXBsZXRlZFJlbW90ZXMuc2l6ZSA+IDApIHtcblx0XHRcdGxldCBhdXRob3JpdHk6IHN0cmluZ1tdIHwgdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgcmVtb3RlQXV0aG9yaXR5ID0gdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5O1xuXHRcdFx0bGV0IHZpcnR1YWxXb3Jrc3BhY2U6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdGlmICghcmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHRcdHZpcnR1YWxXb3Jrc3BhY2UgPSBnZXRWaXJ0dWFsV29ya3NwYWNlTG9jYXRpb24odGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKSk/LnNjaGVtZTtcblx0XHRcdH1cblx0XHRcdGlzU2V0Rm9yQ29ubmVjdGlvbiA9IHRydWU7XG5cdFx0XHRjb25zdCBleHBsb3JlclR5cGU6IHN0cmluZ1tdIHwgdW5kZWZpbmVkID0gcmVtb3RlQXV0aG9yaXR5ID8gW3JlbW90ZUF1dGhvcml0eS5zcGxpdCgnKycpWzBdXVxuXHRcdFx0XHQ6ICh2aXJ0dWFsV29ya3NwYWNlID8gW3ZpcnR1YWxXb3Jrc3BhY2VdXG5cdFx0XHRcdFx0OiAodGhpcy5zdG9yYWdlU2VydmljZS5nZXQoUkVNT1RFX0VYUExPUkVSX1RZUEVfS0VZLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKT8uc3BsaXQoJywnKSA/PyB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChSRU1PVEVfRVhQTE9SRVJfVFlQRV9LRVksIFN0b3JhZ2VTY29wZS5QUk9GSUxFKT8uc3BsaXQoJywnKSkpO1xuXHRcdFx0aWYgKGV4cGxvcmVyVHlwZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGF1dGhvcml0eSA9IHRoaXMuZ2V0QXV0aG9yaXR5Rm9yRXhwbG9yZXJUeXBlKGV4cGxvcmVyVHlwZSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoYXV0aG9yaXR5KSB7XG5cdFx0XHRcdHRoaXMuc2VsZWN0KGF1dGhvcml0eSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBpc1NldEZvckNvbm5lY3Rpb247XG5cdH1cblxuXHRwcml2YXRlIHNlbGVjdChhdXRob3JpdHk6IHN0cmluZ1tdKSB7XG5cdFx0dGhpcy5zZWxlY3RlZFJlbW90ZUNvbnRleHQuc2V0KGF1dGhvcml0eVswXSk7XG5cdFx0dGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UudGFyZ2V0VHlwZSA9IGF1dGhvcml0eTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QXV0aG9yaXR5Rm9yRXhwbG9yZXJUeXBlKGV4cGxvcmVyVHlwZTogc3RyaW5nW10pOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IGF1dGhvcml0eTogc3RyaW5nW10gfCB1bmRlZmluZWQ7XG5cdFx0Zm9yIChjb25zdCBvcHRpb24gb2YgdGhpcy5jb21wbGV0ZWRSZW1vdGVzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGF1dGhvcml0eU9wdGlvbiBvZiBvcHRpb25bMV0uYXV0aG9yaXR5KSB7XG5cdFx0XHRcdGZvciAoY29uc3QgZXhwbG9yZXJPcHRpb24gb2YgZXhwbG9yZXJUeXBlKSB7XG5cdFx0XHRcdFx0aWYgKGF1dGhvcml0eU9wdGlvbiA9PT0gZXhwbG9yZXJPcHRpb24pIHtcblx0XHRcdFx0XHRcdGF1dGhvcml0eSA9IG9wdGlvblsxXS5hdXRob3JpdHk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9IGVsc2UgaWYgKG9wdGlvblsxXS52aXJ0dWFsV29ya3NwYWNlID09PSBleHBsb3Jlck9wdGlvbikge1xuXHRcdFx0XHRcdFx0YXV0aG9yaXR5ID0gb3B0aW9uWzFdLmF1dGhvcml0eTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gYXV0aG9yaXR5O1xuXHR9XG5cblx0cHVibGljIHJlbW92ZU9wdGlvbkl0ZW1zKHZpZXdzOiBJVmlld0Rlc2NyaXB0b3JbXSkge1xuXHRcdGZvciAoY29uc3QgdmlldyBvZiB2aWV3cykge1xuXHRcdFx0aWYgKHZpZXcuZ3JvdXAgJiYgdmlldy5ncm91cC5zdGFydHNXaXRoKCd0YXJnZXRzJykgJiYgdmlldy5yZW1vdGVBdXRob3JpdHkgJiYgKCF2aWV3LndoZW4gfHwgdGhpcy5jb250ZXh0S2V5U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKHZpZXcud2hlbikpKSB7XG5cdFx0XHRcdGNvbnN0IGF1dGhvcml0eSA9IGlzU3RyaW5nQXJyYXkodmlldy5yZW1vdGVBdXRob3JpdHkpID8gdmlldy5yZW1vdGVBdXRob3JpdHkgOiBbdmlldy5yZW1vdGVBdXRob3JpdHldO1xuXHRcdFx0XHR0aGlzLmNvbXBsZXRlZFJlbW90ZXMuZGVsZXRlQW5kRGlzcG9zZShhdXRob3JpdHlbMF0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBjcmVhdGVPcHRpb25JdGVtcyh2aWV3czogSVZpZXdEZXNjcmlwdG9yW10pIHtcblx0XHRjb25zdCBzdGFydGluZ0NvdW50ID0gdGhpcy5jb21wbGV0ZWRSZW1vdGVzLnNpemU7XG5cdFx0Zm9yIChjb25zdCB2aWV3IG9mIHZpZXdzKSB7XG5cdFx0XHRpZiAodmlldy5ncm91cCAmJiB2aWV3Lmdyb3VwLnN0YXJ0c1dpdGgoJ3RhcmdldHMnKSAmJiB2aWV3LnJlbW90ZUF1dGhvcml0eSAmJiAoIXZpZXcud2hlbiB8fCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXModmlldy53aGVuKSkpIHtcblx0XHRcdFx0Y29uc3QgdGV4dCA9IHZpZXcubmFtZTtcblx0XHRcdFx0Y29uc3QgYXV0aG9yaXR5ID0gaXNTdHJpbmdBcnJheSh2aWV3LnJlbW90ZUF1dGhvcml0eSkgPyB2aWV3LnJlbW90ZUF1dGhvcml0eSA6IFt2aWV3LnJlbW90ZUF1dGhvcml0eV07XG5cdFx0XHRcdGlmICh0aGlzLmNvbXBsZXRlZFJlbW90ZXMuaGFzKGF1dGhvcml0eVswXSkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCB0aGlzQ2FwdHVyZSA9IHRoaXM7XG5cdFx0XHRcdGNvbnN0IGFjdGlvbiA9IHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdFx0XHRpZDogYHdvcmtiZW5jaC5hY3Rpb24ucmVtb3RlRXhwbG9yZXIuc2hvdy4ke2F1dGhvcml0eVswXX1gLFxuXHRcdFx0XHRcdFx0XHR0aXRsZTogdGV4dCxcblx0XHRcdFx0XHRcdFx0dG9nZ2xlZDogU0VMRUNURURfUkVNT1RFX0lOX0VYUExPUkVSLmlzRXF1YWxUbyhhdXRob3JpdHlbMF0pLFxuXHRcdFx0XHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0XHRcdFx0aWQ6IHRoaXNDYXB0dXJlLnN3aXRjaFJlbW90ZU1lbnVcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0XHRcdHRoaXNDYXB0dXJlLnNlbGVjdChhdXRob3JpdHkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRoaXMuY29tcGxldGVkUmVtb3Rlcy5zZXQoYXV0aG9yaXR5WzBdLCB7IHRleHQ6IHRleHQudmFsdWUsIGF1dGhvcml0eSwgdmlydHVhbFdvcmtzcGFjZTogdmlldy52aXJ0dWFsV29ya3NwYWNlLCBkaXNwb3NlOiAoKSA9PiBhY3Rpb24uZGlzcG9zZSgpIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAodGhpcy5jb21wbGV0ZWRSZW1vdGVzLnNpemUgPiBzdGFydGluZ0NvdW50KSB7XG5cdFx0XHR0aGlzLnNldFNlbGVjdGlvbkZvckNvbm5lY3Rpb24oKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsd0JBQXdCLGdDQUFnQztBQUdqRSxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLG9DQUFvQztBQUM3QyxTQUFTLGlCQUFpQixvQkFBb0I7QUFDOUMsU0FBUyxnQkFBNkIsb0JBQW9CLHFCQUFxQjtBQUMvRSxTQUFTLFNBQVMsUUFBUSxjQUFjLHVCQUF1QjtBQUMvRCxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLG1DQUFtQztBQUM1QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLFlBQVkscUJBQXFCO0FBUW5DLE1BQU0sOEJBQThCLElBQUksY0FBc0IsNEJBQTRCLEVBQUU7QUFFNUYsSUFBTSx1QkFBTixjQUFtQyxXQUFXO0FBQUEsRUFLcEQsWUFDc0MsbUJBQ0wsdUJBQ00sb0JBQ0osZ0JBQ1MseUJBQzFDO0FBQ0QsVUFBTTtBQU4rQjtBQUNMO0FBQ007QUFDSjtBQUNTO0FBUjVDLFNBQVEsbUJBQTZELEtBQUssVUFBVSxJQUFJLGNBQWMsQ0FBQztBQVd0RyxTQUFLLHdCQUF3Qiw0QkFBNEIsT0FBTyxpQkFBaUI7QUFFakYsU0FBSyxtQkFBbUIsT0FBTyxJQUFJLHdDQUF3QztBQUMzRSxTQUFLLFVBQVUsYUFBYSxlQUFlLE9BQU8sb0JBQW9CO0FBQUEsTUFDckUsU0FBUyxLQUFLO0FBQUEsTUFDZCxPQUFPLElBQUksU0FBUyxzQkFBc0IsZUFBZTtBQUFBLE1BQ3pELE9BQU87QUFBQSxNQUNQLE1BQU0sZUFBZSxPQUFPLGlCQUFpQixVQUFVO0FBQUEsTUFDdkQsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLElBQ2QsQ0FBQyxDQUFDO0FBQ0YsU0FBSyxVQUFVLHNCQUFzQixzQkFBc0IsT0FBSztBQUMvRCxXQUFLLE9BQU8sQ0FBQztBQUFBLElBQ2QsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRU8sNEJBQXFDO0FBQzNDLFFBQUkscUJBQXFCO0FBQ3pCLFFBQUksS0FBSyxpQkFBaUIsT0FBTyxHQUFHO0FBQ25DLFVBQUk7QUFDSixZQUFNLGtCQUFrQixLQUFLLG1CQUFtQjtBQUNoRCxVQUFJO0FBQ0osVUFBSSxDQUFDLGlCQUFpQjtBQUNyQiwyQkFBbUIsNEJBQTRCLEtBQUssd0JBQXdCLGFBQWEsQ0FBQyxHQUFHO0FBQUEsTUFDOUY7QUFDQSwyQkFBcUI7QUFDckIsWUFBTSxlQUFxQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsTUFBTSxHQUFHLEVBQUUsQ0FBQyxDQUFDLElBQ3ZGLG1CQUFtQixDQUFDLGdCQUFnQixJQUNuQyxLQUFLLGVBQWUsSUFBSSwwQkFBMEIsYUFBYSxTQUFTLEdBQUcsTUFBTSxHQUFHLEtBQUssS0FBSyxlQUFlLElBQUksMEJBQTBCLGFBQWEsT0FBTyxHQUFHLE1BQU0sR0FBRztBQUNoTCxVQUFJLGlCQUFpQixRQUFXO0FBQy9CLG9CQUFZLEtBQUssNEJBQTRCLFlBQVk7QUFBQSxNQUMxRDtBQUNBLFVBQUksV0FBVztBQUNkLGFBQUssT0FBTyxTQUFTO0FBQUEsTUFDdEI7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLE9BQU8sV0FBcUI7QUFDbkMsU0FBSyxzQkFBc0IsSUFBSSxVQUFVLENBQUMsQ0FBQztBQUMzQyxTQUFLLHNCQUFzQixhQUFhO0FBQUEsRUFDekM7QUFBQSxFQUVRLDRCQUE0QixjQUE4QztBQUNqRixRQUFJO0FBQ0osZUFBVyxVQUFVLEtBQUssa0JBQWtCO0FBQzNDLGlCQUFXLG1CQUFtQixPQUFPLENBQUMsRUFBRSxXQUFXO0FBQ2xELG1CQUFXLGtCQUFrQixjQUFjO0FBQzFDLGNBQUksb0JBQW9CLGdCQUFnQjtBQUN2Qyx3QkFBWSxPQUFPLENBQUMsRUFBRTtBQUN0QjtBQUFBLFVBQ0QsV0FBVyxPQUFPLENBQUMsRUFBRSxxQkFBcUIsZ0JBQWdCO0FBQ3pELHdCQUFZLE9BQU8sQ0FBQyxFQUFFO0FBQ3RCO0FBQUEsVUFDRDtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxrQkFBa0IsT0FBMEI7QUFDbEQsZUFBVyxRQUFRLE9BQU87QUFDekIsVUFBSSxLQUFLLFNBQVMsS0FBSyxNQUFNLFdBQVcsU0FBUyxLQUFLLEtBQUssb0JBQW9CLENBQUMsS0FBSyxRQUFRLEtBQUssa0JBQWtCLG9CQUFvQixLQUFLLElBQUksSUFBSTtBQUNwSixjQUFNLFlBQVksY0FBYyxLQUFLLGVBQWUsSUFBSSxLQUFLLGtCQUFrQixDQUFDLEtBQUssZUFBZTtBQUNwRyxhQUFLLGlCQUFpQixpQkFBaUIsVUFBVSxDQUFDLENBQUM7QUFBQSxNQUNwRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFTyxrQkFBa0IsT0FBMEI7QUFDbEQsVUFBTSxnQkFBZ0IsS0FBSyxpQkFBaUI7QUFDNUMsZUFBVyxRQUFRLE9BQU87QUFDekIsVUFBSSxLQUFLLFNBQVMsS0FBSyxNQUFNLFdBQVcsU0FBUyxLQUFLLEtBQUssb0JBQW9CLENBQUMsS0FBSyxRQUFRLEtBQUssa0JBQWtCLG9CQUFvQixLQUFLLElBQUksSUFBSTtBQUNwSixjQUFNLE9BQU8sS0FBSztBQUNsQixjQUFNLFlBQVksY0FBYyxLQUFLLGVBQWUsSUFBSSxLQUFLLGtCQUFrQixDQUFDLEtBQUssZUFBZTtBQUNwRyxZQUFJLEtBQUssaUJBQWlCLElBQUksVUFBVSxDQUFDLENBQUMsR0FBRztBQUM1QztBQUFBLFFBQ0Q7QUFDQSxjQUFNLGNBQWM7QUFDcEIsY0FBTSxTQUFTLGdCQUFnQixjQUFjLFFBQVE7QUFBQSxVQUNwRCxjQUFjO0FBQ2Isa0JBQU07QUFBQSxjQUNMLElBQUksd0NBQXdDLFVBQVUsQ0FBQyxDQUFDO0FBQUEsY0FDeEQsT0FBTztBQUFBLGNBQ1AsU0FBUyw0QkFBNEIsVUFBVSxVQUFVLENBQUMsQ0FBQztBQUFBLGNBQzNELE1BQU07QUFBQSxnQkFDTCxJQUFJLFlBQVk7QUFBQSxjQUNqQjtBQUFBLFlBQ0QsQ0FBQztBQUFBLFVBQ0Y7QUFBQSxVQUNBLE1BQU0sTUFBcUI7QUFDMUIsd0JBQVksT0FBTyxTQUFTO0FBQUEsVUFDN0I7QUFBQSxRQUNELENBQUM7QUFDRCxhQUFLLGlCQUFpQixJQUFJLFVBQVUsQ0FBQyxHQUFHLEVBQUUsTUFBTSxLQUFLLE9BQU8sV0FBVyxrQkFBa0IsS0FBSyxrQkFBa0IsU0FBUyxNQUFNLE9BQU8sUUFBUSxFQUFFLENBQUM7QUFBQSxNQUNsSjtBQUFBLElBQ0Q7QUFDQSxRQUFJLEtBQUssaUJBQWlCLE9BQU8sZUFBZTtBQUMvQyxXQUFLLDBCQUEwQjtBQUFBLElBQ2hDO0FBQUEsRUFDRDtBQUNEO0FBcEhhLHVCQUFOO0FBQUEsRUFNSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVZVOyIsCiAgIm5hbWVzIjogW10KfQo=
