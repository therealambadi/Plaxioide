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
var _a, _b;
import * as dom from "../../../../../base/browser/dom.js";
import { coalesce } from "../../../../../base/common/arrays.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { matchesSomeScheme, Schemas } from "../../../../../base/common/network.js";
import { basename } from "../../../../../base/common/path.js";
import { basenameOrAuthority, isEqualAuthority } from "../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../../nls.js";
import { getFlatContextMenuActions } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { MenuWorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { Action2, IMenuService, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { FileKind } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { WorkbenchList } from "../../../../../platform/list/browser/listService.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { fillEditorsDragData } from "../../../../browser/dnd.js";
import { ResourceLabels } from "../../../../browser/labels.js";
import { ColorScheme } from "../../../../browser/web.api.js";
import { ResourceContextKey } from "../../../../common/contextkeys.js";
import { SETTINGS_AUTHORITY } from "../../../../services/preferences/common/preferences.js";
import { createFileIconThemableTreeContainerScope } from "../../../files/browser/views/explorerView.js";
import { ExplorerFolderContext } from "../../../files/common/files.js";
import { chatEditingWidgetFileStateContextKey, WorkingSetEntryState } from "../../common/chatEditingService.js";
import { ChatResponseReferencePartStatusKind } from "../../common/chatService.js";
import { IChatVariablesService } from "../../common/chatVariables.js";
import { IChatWidgetService } from "../chat.js";
import { ChatCollapsibleContentPart } from "./chatCollapsibleContentPart.js";
import { ResourcePool } from "./chatCollections.js";
const $ = dom.$;
let ChatCollapsibleListContentPart = class extends ChatCollapsibleContentPart {
  constructor(data, labelOverride, context, contentReferencesListPool, openerService, menuService, instantiationService, contextMenuService) {
    super(labelOverride ?? (data.length > 1 ? localize("usedReferencesPlural", "Used {0} references", data.length) : localize("usedReferencesSingular", "Used {0} reference", 1)), context);
    this.data = data;
    this.contentReferencesListPool = contentReferencesListPool;
    this.openerService = openerService;
    this.menuService = menuService;
    this.instantiationService = instantiationService;
    this.contextMenuService = contextMenuService;
  }
  initContent() {
    const ref = this._register(this.contentReferencesListPool.get());
    const list = ref.object;
    this._register(list.onDidOpen((e) => {
      if (e.element && "reference" in e.element && typeof e.element.reference === "object") {
        const uriOrLocation = "variableName" in e.element.reference ? e.element.reference.value : e.element.reference;
        const uri = URI.isUri(uriOrLocation) ? uriOrLocation : uriOrLocation?.uri;
        if (uri) {
          this.openerService.open(
            uri,
            {
              fromUserGesture: true,
              editorOptions: {
                ...e.editorOptions,
                ...{
                  selection: uriOrLocation && "range" in uriOrLocation ? uriOrLocation.range : void 0
                }
              }
            }
          );
        }
      }
    }));
    this._register(list.onContextMenu((e) => {
      dom.EventHelper.stop(e.browserEvent, true);
      const uri = e.element && getResourceForElement(e.element);
      if (!uri) {
        return;
      }
      this.contextMenuService.showContextMenu({
        getAnchor: () => e.anchor,
        getActions: () => {
          const menu = this.menuService.getMenuActions(MenuId.ChatAttachmentsContext, list.contextKeyService, { shouldForwardArgs: true, arg: uri });
          return getFlatContextMenuActions(menu);
        }
      });
    }));
    const resourceContextKey = this._register(this.instantiationService.createInstance(ResourceContextKey));
    this._register(list.onDidChangeFocus((e) => {
      resourceContextKey.reset();
      const element = e.elements.length ? e.elements[0] : void 0;
      const uri = element && getResourceForElement(element);
      resourceContextKey.set(uri ?? null);
    }));
    const maxItemsShown = 6;
    const itemsShown = Math.min(this.data.length, maxItemsShown);
    const height = itemsShown * 22;
    list.layout(height);
    list.getHTMLElement().style.height = `${height}px`;
    list.splice(0, list.length, this.data);
    return list.getHTMLElement().parentElement;
  }
  hasSameContent(other, followingContent, element) {
    return other.kind === "references" && other.references.length === this.data.length && !!followingContent.length === this.hasFollowingContent;
  }
};
ChatCollapsibleListContentPart = __decorateClass([
  __decorateParam(4, IOpenerService),
  __decorateParam(5, IMenuService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IContextMenuService)
], ChatCollapsibleListContentPart);
let ChatUsedReferencesListContentPart = class extends ChatCollapsibleListContentPart {
  constructor(data, labelOverride, context, contentReferencesListPool, options, openerService, menuService, instantiationService, contextMenuService) {
    super(data, labelOverride, context, contentReferencesListPool, openerService, menuService, instantiationService, contextMenuService);
    this.options = options;
    if (data.length === 0) {
      dom.hide(this.domNode);
    }
  }
  isExpanded() {
    const element = this.context.element;
    return element.usedReferencesExpanded ?? !!(this.options.expandedWhenEmptyResponse && element.response.value.length === 0);
  }
  setExpanded(value) {
    const element = this.context.element;
    element.usedReferencesExpanded = !this.isExpanded();
  }
};
ChatUsedReferencesListContentPart = __decorateClass([
  __decorateParam(5, IOpenerService),
  __decorateParam(6, IMenuService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IContextMenuService)
], ChatUsedReferencesListContentPart);
let CollapsibleListPool = class extends Disposable {
  constructor(_onDidChangeVisibility, menuId, instantiationService, themeService, labelService) {
    super();
    this._onDidChangeVisibility = _onDidChangeVisibility;
    this.menuId = menuId;
    this.instantiationService = instantiationService;
    this.themeService = themeService;
    this.labelService = labelService;
    this._pool = this._register(new ResourcePool(() => this.listFactory()));
  }
  get inUse() {
    return this._pool.inUse;
  }
  listFactory() {
    const resourceLabels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this._onDidChangeVisibility }));
    const container = $(".chat-used-context-list");
    this._register(createFileIconThemableTreeContainerScope(container, this.themeService));
    const list = this.instantiationService.createInstance(
      WorkbenchList,
      "ChatListRenderer",
      container,
      new CollapsibleListDelegate(),
      [this.instantiationService.createInstance(CollapsibleListRenderer, resourceLabels, this.menuId)],
      {
        alwaysConsumeMouseWheel: false,
        accessibilityProvider: {
          getAriaLabel: (element) => {
            if (element.kind === "warning") {
              return element.content.value;
            }
            const reference = element.reference;
            if (typeof reference === "string") {
              return reference;
            } else if ("variableName" in reference) {
              return reference.variableName;
            } else if (URI.isUri(reference)) {
              return basename(reference.path);
            } else {
              return basename(reference.uri.path);
            }
          },
          getWidgetAriaLabel: () => localize("chatCollapsibleList", "Collapsible Chat List")
        },
        dnd: {
          getDragURI: (element) => getResourceForElement(element)?.toString() ?? null,
          getDragLabel: (elements, originalEvent) => {
            const uris = coalesce(elements.map(getResourceForElement));
            if (!uris.length) {
              return void 0;
            } else if (uris.length === 1) {
              return this.labelService.getUriLabel(uris[0], { relative: true });
            } else {
              return `${uris.length}`;
            }
          },
          dispose: () => {
          },
          onDragOver: () => false,
          drop: () => {
          },
          onDragStart: (data, originalEvent) => {
            try {
              const elements = data.getData();
              const uris = coalesce(elements.map(getResourceForElement));
              this.instantiationService.invokeFunction((accessor) => fillEditorsDragData(accessor, uris, originalEvent));
            } catch {
            }
          }
        }
      }
    );
    return list;
  }
  get() {
    const object = this._pool.get();
    let stale = false;
    return {
      object,
      isStale: () => stale,
      dispose: () => {
        stale = true;
        this._pool.release(object);
      }
    };
  }
};
CollapsibleListPool = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, ILabelService)
], CollapsibleListPool);
class CollapsibleListDelegate {
  getHeight(element) {
    return 22;
  }
  getTemplateId(element) {
    return CollapsibleListRenderer.TEMPLATE_ID;
  }
}
let CollapsibleListRenderer = class {
  constructor(labels, menuId, themeService, productService, instantiationService, contextKeyService) {
    this.labels = labels;
    this.menuId = menuId;
    this.themeService = themeService;
    this.productService = productService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.templateId = CollapsibleListRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const templateDisposables = new DisposableStore();
    const label = templateDisposables.add(this.labels.create(container, { supportHighlights: true, supportIcons: true }));
    let toolbar;
    let actionBarContainer;
    let contextKeyService;
    if (this.menuId) {
      actionBarContainer = $(".chat-collapsible-list-action-bar");
      contextKeyService = templateDisposables.add(this.contextKeyService.createScoped(actionBarContainer));
      const scopedInstantiationService = templateDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
      toolbar = templateDisposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, actionBarContainer, this.menuId, { menuOptions: { shouldForwardArgs: true, arg: void 0 } }));
      label.element.appendChild(actionBarContainer);
    }
    return { templateDisposables, label, toolbar, actionBarContainer, contextKeyService };
  }
  getReferenceIcon(data) {
    if (ThemeIcon.isThemeIcon(data.iconPath)) {
      return data.iconPath;
    } else {
      return this.themeService.getColorTheme().type === ColorScheme.DARK && data.iconPath?.dark ? data.iconPath?.dark : data.iconPath?.light;
    }
  }
  renderElement(data, index, templateData, height) {
    if (data.kind === "warning") {
      templateData.label.setResource({ name: data.content.value }, { icon: Codicon.warning });
      return;
    }
    const reference = data.reference;
    const icon = this.getReferenceIcon(data);
    templateData.label.element.style.display = "flex";
    let arg;
    if (typeof reference === "object" && "variableName" in reference) {
      if (reference.value) {
        const uri = URI.isUri(reference.value) ? reference.value : reference.value.uri;
        templateData.label.setResource(
          {
            resource: uri,
            name: basenameOrAuthority(uri),
            description: `#${reference.variableName}`,
            range: "range" in reference.value ? reference.value.range : void 0
          },
          { icon, title: data.options?.status?.description ?? data.title }
        );
      } else if (reference.variableName.startsWith("kernelVariable")) {
        const variable = reference.variableName.split(":")[1];
        const asVariableName = `${variable}`;
        const label = `Kernel variable`;
        templateData.label.setLabel(label, asVariableName, { title: data.options?.status?.description });
      } else {
        templateData.label.setLabel("Unknown variable type");
      }
    } else if (typeof reference === "string") {
      templateData.label.setLabel(reference, void 0, { iconPath: URI.isUri(icon) ? icon : void 0, title: data.options?.status?.description ?? data.title });
    } else {
      const uri = "uri" in reference ? reference.uri : reference;
      arg = uri;
      const extraClasses = data.excluded ? ["excluded"] : [];
      if (uri.scheme === "https" && isEqualAuthority(uri.authority, "github.com") && uri.path.includes("/tree/")) {
        const label = uri.path.split("/").slice(1, 3).join("/");
        const description = uri.path.split("/").slice(5).join("/");
        templateData.label.setResource({ resource: uri, name: label, description }, { icon: Codicon.github, title: data.title, strikethrough: data.excluded, extraClasses });
      } else if (uri.scheme === this.productService.urlProtocol && isEqualAuthority(uri.authority, SETTINGS_AUTHORITY)) {
        const settingId = uri.path.substring(1);
        templateData.label.setResource({ resource: uri, name: settingId }, { icon: Codicon.settingsGear, title: localize("setting.hover", "Open setting '{0}'", settingId), strikethrough: data.excluded, extraClasses });
      } else if (matchesSomeScheme(uri, Schemas.mailto, Schemas.http, Schemas.https)) {
        templateData.label.setResource({ resource: uri, name: uri.toString() }, { icon: icon ?? Codicon.globe, title: data.options?.status?.description ?? data.title ?? uri.toString(), strikethrough: data.excluded, extraClasses });
      } else {
        templateData.label.setFile(uri, {
          fileKind: FileKind.FILE,
          // Should not have this live-updating data on a historical reference
          fileDecorations: void 0,
          range: "range" in reference ? reference.range : void 0,
          title: data.options?.status?.description ?? data.title,
          strikethrough: data.excluded,
          extraClasses
        });
      }
    }
    for (const selector of [".monaco-icon-suffix-container", ".monaco-icon-name-container"]) {
      const element = templateData.label.element.querySelector(selector);
      if (element) {
        if (data.options?.status?.kind === ChatResponseReferencePartStatusKind.Omitted || data.options?.status?.kind === ChatResponseReferencePartStatusKind.Partial) {
          element.classList.add("warning");
        } else {
          element.classList.remove("warning");
        }
      }
    }
    if (data.state !== void 0) {
      if (templateData.actionBarContainer) {
        if (data.state === WorkingSetEntryState.Modified && !templateData.actionBarContainer.classList.contains("modified")) {
          templateData.actionBarContainer.classList.add("modified");
          templateData.label.element.querySelector(".monaco-icon-name-container")?.classList.add("modified");
        } else if (data.state !== WorkingSetEntryState.Modified) {
          templateData.actionBarContainer.classList.remove("modified");
          templateData.label.element.querySelector(".monaco-icon-name-container")?.classList.remove("modified");
        }
      }
      if (templateData.toolbar) {
        templateData.toolbar.context = arg;
      }
      if (templateData.contextKeyService) {
        if (data.state !== void 0) {
          chatEditingWidgetFileStateContextKey.bindTo(templateData.contextKeyService).set(data.state);
        }
      }
    }
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
CollapsibleListRenderer.TEMPLATE_ID = "chatCollapsibleListRenderer";
CollapsibleListRenderer = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IProductService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextKeyService)
], CollapsibleListRenderer);
function getResourceForElement(element) {
  if (element.kind === "warning") {
    return null;
  }
  const { reference } = element;
  if (typeof reference === "string" || "variableName" in reference) {
    return null;
  } else if (URI.isUri(reference)) {
    return reference;
  } else {
    return reference.uri;
  }
}
registerAction2((_a = class extends Action2 {
  constructor() {
    super({
      id: _a.id,
      title: {
        ...localize2("addToChat", "Add File to Chat")
      },
      f1: false,
      menu: [{
        id: MenuId.ChatAttachmentsContext,
        group: "chat",
        order: 1,
        when: ContextKeyExpr.and(ResourceContextKey.IsFileSystemResource, ExplorerFolderContext.negate())
      }]
    });
  }
  async run(accessor, resource) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const variablesService = accessor.get(IChatVariablesService);
    if (!resource) {
      return;
    }
    const widget = chatWidgetService.lastFocusedWidget;
    if (!widget) {
      return;
    }
    variablesService.attachContext("file", resource, widget.location);
  }
}, _a.id = "workbench.action.chat.addToChatAction", _a));
registerAction2((_b = class extends Action2 {
  constructor() {
    super({
      id: _b.id,
      title: {
        ...localize2("copyLink", "Copy Link")
      },
      f1: false,
      menu: [{
        id: MenuId.ChatAttachmentsContext,
        group: "chat",
        order: 0,
        when: ContextKeyExpr.or(ResourceContextKey.Scheme.isEqualTo(Schemas.http), ResourceContextKey.Scheme.isEqualTo(Schemas.https))
      }]
    });
  }
  async run(accessor, resource) {
    await accessor.get(IClipboardService).writeResources([resource]);
  }
}, _b.id = "workbench.action.chat.copyLink", _b));
export {
  $,
  ChatCollapsibleListContentPart,
  ChatUsedReferencesListContentPart,
  CollapsibleListPool
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy9jaGF0UmVmZXJlbmNlc0NvbnRlbnRQYXJ0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSUxpc3RSZW5kZXJlciwgSUxpc3RWaXJ0dWFsRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IGNvYWxlc2NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBtYXRjaGVzU29tZVNjaGVtZSwgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lT3JBdXRob3JpdHksIGlzRXF1YWxBdXRob3JpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGdldEZsYXRDb250ZXh0TWVudUFjdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgTWVudVdvcmtiZW5jaFRvb2xCYXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBJTWVudVNlcnZpY2UsIE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBGaWxlS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hMaXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZmlsbEVkaXRvcnNEcmFnRGF0YSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvZG5kLmpzJztcbmltcG9ydCB7IElSZXNvdXJjZUxhYmVsLCBSZXNvdXJjZUxhYmVscyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvbGFiZWxzLmpzJztcbmltcG9ydCB7IENvbG9yU2NoZW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci93ZWIuYXBpLmpzJztcbmltcG9ydCB7IFJlc291cmNlQ29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBTRVRUSU5HU19BVVRIT1JJVFkgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRmlsZUljb25UaGVtYWJsZVRyZWVDb250YWluZXJTY29wZSB9IGZyb20gJy4uLy4uLy4uL2ZpbGVzL2Jyb3dzZXIvdmlld3MvZXhwbG9yZXJWaWV3LmpzJztcbmltcG9ydCB7IEV4cGxvcmVyRm9sZGVyQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBjaGF0RWRpdGluZ1dpZGdldEZpbGVTdGF0ZUNvbnRleHRLZXksIFdvcmtpbmdTZXRFbnRyeVN0YXRlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRFZGl0aW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0UmVzcG9uc2VSZWZlcmVuY2VQYXJ0U3RhdHVzS2luZCwgSUNoYXRDb250ZW50UmVmZXJlbmNlLCBJQ2hhdFdhcm5pbmdNZXNzYWdlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDaGF0VmFyaWFibGVzU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0VmFyaWFibGVzLmpzJztcbmltcG9ydCB7IElDaGF0UmVuZGVyZXJDb250ZW50LCBJQ2hhdFJlc3BvbnNlVmlld01vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgQ2hhdFRyZWVJdGVtLCBJQ2hhdFdpZGdldFNlcnZpY2UgfSBmcm9tICcuLi9jaGF0LmpzJztcbmltcG9ydCB7IENoYXRDb2xsYXBzaWJsZUNvbnRlbnRQYXJ0IH0gZnJvbSAnLi9jaGF0Q29sbGFwc2libGVDb250ZW50UGFydC5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZVJlZmVyZW5jZSwgUmVzb3VyY2VQb29sIH0gZnJvbSAnLi9jaGF0Q29sbGVjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNoYXRDb250ZW50UGFydFJlbmRlckNvbnRleHQgfSBmcm9tICcuL2NoYXRDb250ZW50UGFydHMuanMnO1xuXG5leHBvcnQgY29uc3QgJCA9IGRvbS4kO1xuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0UmVmZXJlbmNlTGlzdEl0ZW0gZXh0ZW5kcyBJQ2hhdENvbnRlbnRSZWZlcmVuY2Uge1xuXHR0aXRsZT86IHN0cmluZztcblx0ZGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cdHN0YXRlPzogV29ya2luZ1NldEVudHJ5U3RhdGU7XG5cdGV4Y2x1ZGVkPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IHR5cGUgSUNoYXRDb2xsYXBzaWJsZUxpc3RJdGVtID0gSUNoYXRSZWZlcmVuY2VMaXN0SXRlbSB8IElDaGF0V2FybmluZ01lc3NhZ2U7XG5cbmV4cG9ydCBjbGFzcyBDaGF0Q29sbGFwc2libGVMaXN0Q29udGVudFBhcnQgZXh0ZW5kcyBDaGF0Q29sbGFwc2libGVDb250ZW50UGFydCB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBkYXRhOiBSZWFkb25seUFycmF5PElDaGF0Q29sbGFwc2libGVMaXN0SXRlbT4sXG5cdFx0bGFiZWxPdmVycmlkZTogSU1hcmtkb3duU3RyaW5nIHwgc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdGNvbnRleHQ6IElDaGF0Q29udGVudFBhcnRSZW5kZXJDb250ZXh0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGVudFJlZmVyZW5jZXNMaXN0UG9vbDogQ29sbGFwc2libGVMaXN0UG9vbCxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIobGFiZWxPdmVycmlkZSA/PyAoZGF0YS5sZW5ndGggPiAxID9cblx0XHRcdGxvY2FsaXplKCd1c2VkUmVmZXJlbmNlc1BsdXJhbCcsIFwiVXNlZCB7MH0gcmVmZXJlbmNlc1wiLCBkYXRhLmxlbmd0aCkgOlxuXHRcdFx0bG9jYWxpemUoJ3VzZWRSZWZlcmVuY2VzU2luZ3VsYXInLCBcIlVzZWQgezB9IHJlZmVyZW5jZVwiLCAxKSksIGNvbnRleHQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGluaXRDb250ZW50KCk6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCByZWYgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbnRlbnRSZWZlcmVuY2VzTGlzdFBvb2wuZ2V0KCkpO1xuXHRcdGNvbnN0IGxpc3QgPSByZWYub2JqZWN0O1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIobGlzdC5vbkRpZE9wZW4oKGUpID0+IHtcblx0XHRcdGlmIChlLmVsZW1lbnQgJiYgJ3JlZmVyZW5jZScgaW4gZS5lbGVtZW50ICYmIHR5cGVvZiBlLmVsZW1lbnQucmVmZXJlbmNlID09PSAnb2JqZWN0Jykge1xuXHRcdFx0XHRjb25zdCB1cmlPckxvY2F0aW9uID0gJ3ZhcmlhYmxlTmFtZScgaW4gZS5lbGVtZW50LnJlZmVyZW5jZSA/IGUuZWxlbWVudC5yZWZlcmVuY2UudmFsdWUgOiBlLmVsZW1lbnQucmVmZXJlbmNlO1xuXHRcdFx0XHRjb25zdCB1cmkgPSBVUkkuaXNVcmkodXJpT3JMb2NhdGlvbikgPyB1cmlPckxvY2F0aW9uIDpcblx0XHRcdFx0XHR1cmlPckxvY2F0aW9uPy51cmk7XG5cdFx0XHRcdGlmICh1cmkpIHtcblx0XHRcdFx0XHR0aGlzLm9wZW5lclNlcnZpY2Uub3Blbihcblx0XHRcdFx0XHRcdHVyaSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0ZnJvbVVzZXJHZXN0dXJlOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRlZGl0b3JPcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdFx0Li4uZS5lZGl0b3JPcHRpb25zLFxuXHRcdFx0XHRcdFx0XHRcdC4uLntcblx0XHRcdFx0XHRcdFx0XHRcdHNlbGVjdGlvbjogdXJpT3JMb2NhdGlvbiAmJiAncmFuZ2UnIGluIHVyaU9yTG9jYXRpb24gPyB1cmlPckxvY2F0aW9uLnJhbmdlIDogdW5kZWZpbmVkXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGxpc3Qub25Db250ZXh0TWVudShlID0+IHtcblx0XHRcdGRvbS5FdmVudEhlbHBlci5zdG9wKGUuYnJvd3NlckV2ZW50LCB0cnVlKTtcblxuXHRcdFx0Y29uc3QgdXJpID0gZS5lbGVtZW50ICYmIGdldFJlc291cmNlRm9yRWxlbWVudChlLmVsZW1lbnQpO1xuXHRcdFx0aWYgKCF1cmkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0XHRnZXRBbmNob3I6ICgpID0+IGUuYW5jaG9yLFxuXHRcdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbWVudSA9IHRoaXMubWVudVNlcnZpY2UuZ2V0TWVudUFjdGlvbnMoTWVudUlkLkNoYXRBdHRhY2htZW50c0NvbnRleHQsIGxpc3QuY29udGV4dEtleVNlcnZpY2UsIHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUsIGFyZzogdXJpIH0pO1xuXHRcdFx0XHRcdHJldHVybiBnZXRGbGF0Q29udGV4dE1lbnVBY3Rpb25zKG1lbnUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCByZXNvdXJjZUNvbnRleHRLZXkgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlc291cmNlQ29udGV4dEtleSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGxpc3Qub25EaWRDaGFuZ2VGb2N1cyhlID0+IHtcblx0XHRcdHJlc291cmNlQ29udGV4dEtleS5yZXNldCgpO1xuXHRcdFx0Y29uc3QgZWxlbWVudCA9IGUuZWxlbWVudHMubGVuZ3RoID8gZS5lbGVtZW50c1swXSA6IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IHVyaSA9IGVsZW1lbnQgJiYgZ2V0UmVzb3VyY2VGb3JFbGVtZW50KGVsZW1lbnQpO1xuXHRcdFx0cmVzb3VyY2VDb250ZXh0S2V5LnNldCh1cmkgPz8gbnVsbCk7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgbWF4SXRlbXNTaG93biA9IDY7XG5cdFx0Y29uc3QgaXRlbXNTaG93biA9IE1hdGgubWluKHRoaXMuZGF0YS5sZW5ndGgsIG1heEl0ZW1zU2hvd24pO1xuXHRcdGNvbnN0IGhlaWdodCA9IGl0ZW1zU2hvd24gKiAyMjtcblx0XHRsaXN0LmxheW91dChoZWlnaHQpO1xuXHRcdGxpc3QuZ2V0SFRNTEVsZW1lbnQoKS5zdHlsZS5oZWlnaHQgPSBgJHtoZWlnaHR9cHhgO1xuXHRcdGxpc3Quc3BsaWNlKDAsIGxpc3QubGVuZ3RoLCB0aGlzLmRhdGEpO1xuXG5cdFx0cmV0dXJuIGxpc3QuZ2V0SFRNTEVsZW1lbnQoKS5wYXJlbnRFbGVtZW50ITtcblx0fVxuXG5cdGhhc1NhbWVDb250ZW50KG90aGVyOiBJQ2hhdFJlbmRlcmVyQ29udGVudCwgZm9sbG93aW5nQ29udGVudDogSUNoYXRSZW5kZXJlckNvbnRlbnRbXSwgZWxlbWVudDogQ2hhdFRyZWVJdGVtKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIG90aGVyLmtpbmQgPT09ICdyZWZlcmVuY2VzJyAmJiBvdGhlci5yZWZlcmVuY2VzLmxlbmd0aCA9PT0gdGhpcy5kYXRhLmxlbmd0aCAmJiAoISFmb2xsb3dpbmdDb250ZW50Lmxlbmd0aCA9PT0gdGhpcy5oYXNGb2xsb3dpbmdDb250ZW50KTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0VXNlZFJlZmVyZW5jZXNMaXN0T3B0aW9ucyB7XG5cdGV4cGFuZGVkV2hlbkVtcHR5UmVzcG9uc2U/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgQ2hhdFVzZWRSZWZlcmVuY2VzTGlzdENvbnRlbnRQYXJ0IGV4dGVuZHMgQ2hhdENvbGxhcHNpYmxlTGlzdENvbnRlbnRQYXJ0IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0ZGF0YTogUmVhZG9ubHlBcnJheTxJQ2hhdENvbGxhcHNpYmxlTGlzdEl0ZW0+LFxuXHRcdGxhYmVsT3ZlcnJpZGU6IElNYXJrZG93blN0cmluZyB8IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRjb250ZXh0OiBJQ2hhdENvbnRlbnRQYXJ0UmVuZGVyQ29udGV4dCxcblx0XHRjb250ZW50UmVmZXJlbmNlc0xpc3RQb29sOiBDb2xsYXBzaWJsZUxpc3RQb29sLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczogSUNoYXRVc2VkUmVmZXJlbmNlc0xpc3RPcHRpb25zLFxuXHRcdEBJT3BlbmVyU2VydmljZSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoZGF0YSwgbGFiZWxPdmVycmlkZSwgY29udGV4dCwgY29udGVudFJlZmVyZW5jZXNMaXN0UG9vbCwgb3BlbmVyU2VydmljZSwgbWVudVNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UpO1xuXHRcdGlmIChkYXRhLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0ZG9tLmhpZGUodGhpcy5kb21Ob2RlKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgaXNFeHBhbmRlZCgpOiBib29sZWFuIHtcblx0XHRjb25zdCBlbGVtZW50ID0gdGhpcy5jb250ZXh0LmVsZW1lbnQgYXMgSUNoYXRSZXNwb25zZVZpZXdNb2RlbDtcblx0XHRyZXR1cm4gZWxlbWVudC51c2VkUmVmZXJlbmNlc0V4cGFuZGVkID8/ICEhKFxuXHRcdFx0dGhpcy5vcHRpb25zLmV4cGFuZGVkV2hlbkVtcHR5UmVzcG9uc2UgJiYgZWxlbWVudC5yZXNwb25zZS52YWx1ZS5sZW5ndGggPT09IDBcblx0XHQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHNldEV4cGFuZGVkKHZhbHVlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IHRoaXMuY29udGV4dC5lbGVtZW50IGFzIElDaGF0UmVzcG9uc2VWaWV3TW9kZWw7XG5cdFx0ZWxlbWVudC51c2VkUmVmZXJlbmNlc0V4cGFuZGVkID0gIXRoaXMuaXNFeHBhbmRlZCgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDb2xsYXBzaWJsZUxpc3RQb29sIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgX3Bvb2w6IFJlc291cmNlUG9vbDxXb3JrYmVuY2hMaXN0PElDaGF0Q29sbGFwc2libGVMaXN0SXRlbT4+O1xuXG5cdHB1YmxpYyBnZXQgaW5Vc2UoKTogUmVhZG9ubHlTZXQ8V29ya2JlbmNoTGlzdDxJQ2hhdENvbGxhcHNpYmxlTGlzdEl0ZW0+PiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Bvb2wuaW5Vc2U7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIF9vbkRpZENoYW5nZVZpc2liaWxpdHk6IEV2ZW50PGJvb2xlYW4+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbWVudUlkOiBNZW51SWQgfCB1bmRlZmluZWQsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcG9vbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSZXNvdXJjZVBvb2woKCkgPT4gdGhpcy5saXN0RmFjdG9yeSgpKSk7XG5cdH1cblxuXHRwcml2YXRlIGxpc3RGYWN0b3J5KCk6IFdvcmtiZW5jaExpc3Q8SUNoYXRDb2xsYXBzaWJsZUxpc3RJdGVtPiB7XG5cdFx0Y29uc3QgcmVzb3VyY2VMYWJlbHMgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlc291cmNlTGFiZWxzLCB7IG9uRGlkQ2hhbmdlVmlzaWJpbGl0eTogdGhpcy5fb25EaWRDaGFuZ2VWaXNpYmlsaXR5IH0pKTtcblxuXHRcdGNvbnN0IGNvbnRhaW5lciA9ICQoJy5jaGF0LXVzZWQtY29udGV4dC1saXN0Jyk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY3JlYXRlRmlsZUljb25UaGVtYWJsZVRyZWVDb250YWluZXJTY29wZShjb250YWluZXIsIHRoaXMudGhlbWVTZXJ2aWNlKSk7XG5cblx0XHRjb25zdCBsaXN0ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFdvcmtiZW5jaExpc3Q8SUNoYXRDb2xsYXBzaWJsZUxpc3RJdGVtPixcblx0XHRcdCdDaGF0TGlzdFJlbmRlcmVyJyxcblx0XHRcdGNvbnRhaW5lcixcblx0XHRcdG5ldyBDb2xsYXBzaWJsZUxpc3REZWxlZ2F0ZSgpLFxuXHRcdFx0W3RoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29sbGFwc2libGVMaXN0UmVuZGVyZXIsIHJlc291cmNlTGFiZWxzLCB0aGlzLm1lbnVJZCldLFxuXHRcdFx0e1xuXHRcdFx0XHRhbHdheXNDb25zdW1lTW91c2VXaGVlbDogZmFsc2UsXG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjoge1xuXHRcdFx0XHRcdGdldEFyaWFMYWJlbDogKGVsZW1lbnQ6IElDaGF0Q29sbGFwc2libGVMaXN0SXRlbSkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGVsZW1lbnQua2luZCA9PT0gJ3dhcm5pbmcnKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBlbGVtZW50LmNvbnRlbnQudmFsdWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjb25zdCByZWZlcmVuY2UgPSBlbGVtZW50LnJlZmVyZW5jZTtcblx0XHRcdFx0XHRcdGlmICh0eXBlb2YgcmVmZXJlbmNlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcmVmZXJlbmNlO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICgndmFyaWFibGVOYW1lJyBpbiByZWZlcmVuY2UpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHJlZmVyZW5jZS52YXJpYWJsZU5hbWU7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKFVSSS5pc1VyaShyZWZlcmVuY2UpKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBiYXNlbmFtZShyZWZlcmVuY2UucGF0aCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gYmFzZW5hbWUocmVmZXJlbmNlLnVyaS5wYXRoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXG5cdFx0XHRcdFx0Z2V0V2lkZ2V0QXJpYUxhYmVsOiAoKSA9PiBsb2NhbGl6ZSgnY2hhdENvbGxhcHNpYmxlTGlzdCcsIFwiQ29sbGFwc2libGUgQ2hhdCBMaXN0XCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRuZDoge1xuXHRcdFx0XHRcdGdldERyYWdVUkk6IChlbGVtZW50OiBJQ2hhdENvbGxhcHNpYmxlTGlzdEl0ZW0pID0+IGdldFJlc291cmNlRm9yRWxlbWVudChlbGVtZW50KT8udG9TdHJpbmcoKSA/PyBudWxsLFxuXHRcdFx0XHRcdGdldERyYWdMYWJlbDogKGVsZW1lbnRzLCBvcmlnaW5hbEV2ZW50KSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCB1cmlzOiBVUklbXSA9IGNvYWxlc2NlKGVsZW1lbnRzLm1hcChnZXRSZXNvdXJjZUZvckVsZW1lbnQpKTtcblx0XHRcdFx0XHRcdGlmICghdXJpcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAodXJpcy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHVyaXNbMF0sIHsgcmVsYXRpdmU6IHRydWUgfSk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gYCR7dXJpcy5sZW5ndGh9YDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHsgfSxcblx0XHRcdFx0XHRvbkRyYWdPdmVyOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0XHRkcm9wOiAoKSA9PiB7IH0sXG5cdFx0XHRcdFx0b25EcmFnU3RhcnQ6IChkYXRhLCBvcmlnaW5hbEV2ZW50KSA9PiB7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBlbGVtZW50cyA9IGRhdGEuZ2V0RGF0YSgpIGFzIElDaGF0Q29sbGFwc2libGVMaXN0SXRlbVtdO1xuXHRcdFx0XHRcdFx0XHRjb25zdCB1cmlzOiBVUklbXSA9IGNvYWxlc2NlKGVsZW1lbnRzLm1hcChnZXRSZXNvdXJjZUZvckVsZW1lbnQpKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBmaWxsRWRpdG9yc0RyYWdEYXRhKGFjY2Vzc29yLCB1cmlzLCBvcmlnaW5hbEV2ZW50KSk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0XHRcdFx0Ly8gbm9vcFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblxuXHRcdHJldHVybiBsaXN0O1xuXHR9XG5cblx0Z2V0KCk6IElEaXNwb3NhYmxlUmVmZXJlbmNlPFdvcmtiZW5jaExpc3Q8SUNoYXRDb2xsYXBzaWJsZUxpc3RJdGVtPj4ge1xuXHRcdGNvbnN0IG9iamVjdCA9IHRoaXMuX3Bvb2wuZ2V0KCk7XG5cdFx0bGV0IHN0YWxlID0gZmFsc2U7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG9iamVjdCxcblx0XHRcdGlzU3RhbGU6ICgpID0+IHN0YWxlLFxuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHRzdGFsZSA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX3Bvb2wucmVsZWFzZShvYmplY3QpO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cbn1cblxuY2xhc3MgQ29sbGFwc2libGVMaXN0RGVsZWdhdGUgaW1wbGVtZW50cyBJTGlzdFZpcnR1YWxEZWxlZ2F0ZTxJQ2hhdENvbGxhcHNpYmxlTGlzdEl0ZW0+IHtcblx0Z2V0SGVpZ2h0KGVsZW1lbnQ6IElDaGF0Q29sbGFwc2libGVMaXN0SXRlbSk6IG51bWJlciB7XG5cdFx0cmV0dXJuIDIyO1xuXHR9XG5cblx0Z2V0VGVtcGxhdGVJZChlbGVtZW50OiBJQ2hhdENvbGxhcHNpYmxlTGlzdEl0ZW0pOiBzdHJpbmcge1xuXHRcdHJldHVybiBDb2xsYXBzaWJsZUxpc3RSZW5kZXJlci5URU1QTEFURV9JRDtcblx0fVxufVxuXG5pbnRlcmZhY2UgSUNvbGxhcHNpYmxlTGlzdFRlbXBsYXRlIHtcblx0cmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U/OiBJQ29udGV4dEtleVNlcnZpY2U7XG5cdHJlYWRvbmx5IGxhYmVsOiBJUmVzb3VyY2VMYWJlbDtcblx0cmVhZG9ubHkgdGVtcGxhdGVEaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXHR0b29sYmFyOiBNZW51V29ya2JlbmNoVG9vbEJhciB8IHVuZGVmaW5lZDtcblx0YWN0aW9uQmFyQ29udGFpbmVyPzogSFRNTEVsZW1lbnQ7XG59XG5cbmNsYXNzIENvbGxhcHNpYmxlTGlzdFJlbmRlcmVyIGltcGxlbWVudHMgSUxpc3RSZW5kZXJlcjxJQ2hhdENvbGxhcHNpYmxlTGlzdEl0ZW0sIElDb2xsYXBzaWJsZUxpc3RUZW1wbGF0ZT4ge1xuXHRzdGF0aWMgVEVNUExBVEVfSUQgPSAnY2hhdENvbGxhcHNpYmxlTGlzdFJlbmRlcmVyJztcblx0cmVhZG9ubHkgdGVtcGxhdGVJZDogc3RyaW5nID0gQ29sbGFwc2libGVMaXN0UmVuZGVyZXIuVEVNUExBVEVfSUQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBsYWJlbHM6IFJlc291cmNlTGFiZWxzLFxuXHRcdHByaXZhdGUgbWVudUlkOiBNZW51SWQgfCB1bmRlZmluZWQsXG5cdFx0QElUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdCkgeyB9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElDb2xsYXBzaWJsZUxpc3RUZW1wbGF0ZSB7XG5cdFx0Y29uc3QgdGVtcGxhdGVEaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBsYWJlbCA9IHRlbXBsYXRlRGlzcG9zYWJsZXMuYWRkKHRoaXMubGFiZWxzLmNyZWF0ZShjb250YWluZXIsIHsgc3VwcG9ydEhpZ2hsaWdodHM6IHRydWUsIHN1cHBvcnRJY29uczogdHJ1ZSB9KSk7XG5cblx0XHRsZXQgdG9vbGJhcjtcblx0XHRsZXQgYWN0aW9uQmFyQ29udGFpbmVyO1xuXHRcdGxldCBjb250ZXh0S2V5U2VydmljZTtcblx0XHRpZiAodGhpcy5tZW51SWQpIHtcblx0XHRcdGFjdGlvbkJhckNvbnRhaW5lciA9ICQoJy5jaGF0LWNvbGxhcHNpYmxlLWxpc3QtYWN0aW9uLWJhcicpO1xuXHRcdFx0Y29udGV4dEtleVNlcnZpY2UgPSB0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZCh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZChhY3Rpb25CYXJDb250YWluZXIpKTtcblx0XHRcdGNvbnN0IHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlID0gdGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVDaGlsZChuZXcgU2VydmljZUNvbGxlY3Rpb24oW0lDb250ZXh0S2V5U2VydmljZSwgY29udGV4dEtleVNlcnZpY2VdKSkpO1xuXHRcdFx0dG9vbGJhciA9IHRlbXBsYXRlRGlzcG9zYWJsZXMuYWRkKHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVXb3JrYmVuY2hUb29sQmFyLCBhY3Rpb25CYXJDb250YWluZXIsIHRoaXMubWVudUlkLCB7IG1lbnVPcHRpb25zOiB7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlLCBhcmc6IHVuZGVmaW5lZCB9IH0pKTtcblx0XHRcdGxhYmVsLmVsZW1lbnQuYXBwZW5kQ2hpbGQoYWN0aW9uQmFyQ29udGFpbmVyKTtcblx0XHR9XG5cblx0XHRyZXR1cm4geyB0ZW1wbGF0ZURpc3Bvc2FibGVzLCBsYWJlbCwgdG9vbGJhciwgYWN0aW9uQmFyQ29udGFpbmVyLCBjb250ZXh0S2V5U2VydmljZSB9O1xuXHR9XG5cblxuXHRwcml2YXRlIGdldFJlZmVyZW5jZUljb24oZGF0YTogSUNoYXRDb250ZW50UmVmZXJlbmNlKTogVVJJIHwgVGhlbWVJY29uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoVGhlbWVJY29uLmlzVGhlbWVJY29uKGRhdGEuaWNvblBhdGgpKSB7XG5cdFx0XHRyZXR1cm4gZGF0YS5pY29uUGF0aDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMudGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKS50eXBlID09PSBDb2xvclNjaGVtZS5EQVJLICYmIGRhdGEuaWNvblBhdGg/LmRhcmtcblx0XHRcdFx0PyBkYXRhLmljb25QYXRoPy5kYXJrXG5cdFx0XHRcdDogZGF0YS5pY29uUGF0aD8ubGlnaHQ7XG5cdFx0fVxuXHR9XG5cblx0cmVuZGVyRWxlbWVudChkYXRhOiBJQ2hhdENvbGxhcHNpYmxlTGlzdEl0ZW0sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSUNvbGxhcHNpYmxlTGlzdFRlbXBsYXRlLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmIChkYXRhLmtpbmQgPT09ICd3YXJuaW5nJykge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmxhYmVsLnNldFJlc291cmNlKHsgbmFtZTogZGF0YS5jb250ZW50LnZhbHVlIH0sIHsgaWNvbjogQ29kaWNvbi53YXJuaW5nIH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlZmVyZW5jZSA9IGRhdGEucmVmZXJlbmNlO1xuXHRcdGNvbnN0IGljb24gPSB0aGlzLmdldFJlZmVyZW5jZUljb24oZGF0YSk7XG5cdFx0dGVtcGxhdGVEYXRhLmxhYmVsLmVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdmbGV4Jztcblx0XHRsZXQgYXJnOiBVUkkgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHR5cGVvZiByZWZlcmVuY2UgPT09ICdvYmplY3QnICYmICd2YXJpYWJsZU5hbWUnIGluIHJlZmVyZW5jZSkge1xuXHRcdFx0aWYgKHJlZmVyZW5jZS52YWx1ZSkge1xuXHRcdFx0XHRjb25zdCB1cmkgPSBVUkkuaXNVcmkocmVmZXJlbmNlLnZhbHVlKSA/IHJlZmVyZW5jZS52YWx1ZSA6IHJlZmVyZW5jZS52YWx1ZS51cmk7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5zZXRSZXNvdXJjZShcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRyZXNvdXJjZTogdXJpLFxuXHRcdFx0XHRcdFx0bmFtZTogYmFzZW5hbWVPckF1dGhvcml0eSh1cmkpLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGAjJHtyZWZlcmVuY2UudmFyaWFibGVOYW1lfWAsXG5cdFx0XHRcdFx0XHRyYW5nZTogJ3JhbmdlJyBpbiByZWZlcmVuY2UudmFsdWUgPyByZWZlcmVuY2UudmFsdWUucmFuZ2UgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0fSwgeyBpY29uLCB0aXRsZTogZGF0YS5vcHRpb25zPy5zdGF0dXM/LmRlc2NyaXB0aW9uID8/IGRhdGEudGl0bGUgfSk7XG5cdFx0XHR9IGVsc2UgaWYgKHJlZmVyZW5jZS52YXJpYWJsZU5hbWUuc3RhcnRzV2l0aCgna2VybmVsVmFyaWFibGUnKSkge1xuXHRcdFx0XHRjb25zdCB2YXJpYWJsZSA9IHJlZmVyZW5jZS52YXJpYWJsZU5hbWUuc3BsaXQoJzonKVsxXTtcblx0XHRcdFx0Y29uc3QgYXNWYXJpYWJsZU5hbWUgPSBgJHt2YXJpYWJsZX1gO1xuXHRcdFx0XHRjb25zdCBsYWJlbCA9IGBLZXJuZWwgdmFyaWFibGVgO1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuc2V0TGFiZWwobGFiZWwsIGFzVmFyaWFibGVOYW1lLCB7IHRpdGxlOiBkYXRhLm9wdGlvbnM/LnN0YXR1cz8uZGVzY3JpcHRpb24gfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBOb3RoaW5nIGVsc2UgaXMgZXhwZWN0ZWQgdG8gZmFsbCBpbnRvIGhlcmVcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmxhYmVsLnNldExhYmVsKCdVbmtub3duIHZhcmlhYmxlIHR5cGUnKTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKHR5cGVvZiByZWZlcmVuY2UgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuc2V0TGFiZWwocmVmZXJlbmNlLCB1bmRlZmluZWQsIHsgaWNvblBhdGg6IFVSSS5pc1VyaShpY29uKSA/IGljb24gOiB1bmRlZmluZWQsIHRpdGxlOiBkYXRhLm9wdGlvbnM/LnN0YXR1cz8uZGVzY3JpcHRpb24gPz8gZGF0YS50aXRsZSB9KTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCB1cmkgPSAndXJpJyBpbiByZWZlcmVuY2UgPyByZWZlcmVuY2UudXJpIDogcmVmZXJlbmNlO1xuXHRcdFx0YXJnID0gdXJpO1xuXHRcdFx0Y29uc3QgZXh0cmFDbGFzc2VzID0gZGF0YS5leGNsdWRlZCA/IFsnZXhjbHVkZWQnXSA6IFtdO1xuXHRcdFx0aWYgKHVyaS5zY2hlbWUgPT09ICdodHRwcycgJiYgaXNFcXVhbEF1dGhvcml0eSh1cmkuYXV0aG9yaXR5LCAnZ2l0aHViLmNvbScpICYmIHVyaS5wYXRoLmluY2x1ZGVzKCcvdHJlZS8nKSkge1xuXHRcdFx0XHQvLyBQYXJzZSBhIG5pY2VyIGxhYmVsIGZvciBHaXRIdWIgVVJJcyB0aGF0IHBvaW50IGF0IGEgcGFydGljdWxhciBjb21taXQgKyBmaWxlXG5cdFx0XHRcdGNvbnN0IGxhYmVsID0gdXJpLnBhdGguc3BsaXQoJy8nKS5zbGljZSgxLCAzKS5qb2luKCcvJyk7XG5cdFx0XHRcdGNvbnN0IGRlc2NyaXB0aW9uID0gdXJpLnBhdGguc3BsaXQoJy8nKS5zbGljZSg1KS5qb2luKCcvJyk7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5zZXRSZXNvdXJjZSh7IHJlc291cmNlOiB1cmksIG5hbWU6IGxhYmVsLCBkZXNjcmlwdGlvbiB9LCB7IGljb246IENvZGljb24uZ2l0aHViLCB0aXRsZTogZGF0YS50aXRsZSwgc3RyaWtldGhyb3VnaDogZGF0YS5leGNsdWRlZCwgZXh0cmFDbGFzc2VzIH0pO1xuXHRcdFx0fSBlbHNlIGlmICh1cmkuc2NoZW1lID09PSB0aGlzLnByb2R1Y3RTZXJ2aWNlLnVybFByb3RvY29sICYmIGlzRXF1YWxBdXRob3JpdHkodXJpLmF1dGhvcml0eSwgU0VUVElOR1NfQVVUSE9SSVRZKSkge1xuXHRcdFx0XHQvLyBhIG5pY2VyIGxhYmVsIGZvciBzZXR0aW5ncyBVUklzXG5cdFx0XHRcdGNvbnN0IHNldHRpbmdJZCA9IHVyaS5wYXRoLnN1YnN0cmluZygxKTtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmxhYmVsLnNldFJlc291cmNlKHsgcmVzb3VyY2U6IHVyaSwgbmFtZTogc2V0dGluZ0lkIH0sIHsgaWNvbjogQ29kaWNvbi5zZXR0aW5nc0dlYXIsIHRpdGxlOiBsb2NhbGl6ZSgnc2V0dGluZy5ob3ZlcicsIFwiT3BlbiBzZXR0aW5nICd7MH0nXCIsIHNldHRpbmdJZCksIHN0cmlrZXRocm91Z2g6IGRhdGEuZXhjbHVkZWQsIGV4dHJhQ2xhc3NlcyB9KTtcblx0XHRcdH0gZWxzZSBpZiAobWF0Y2hlc1NvbWVTY2hlbWUodXJpLCBTY2hlbWFzLm1haWx0bywgU2NoZW1hcy5odHRwLCBTY2hlbWFzLmh0dHBzKSkge1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuc2V0UmVzb3VyY2UoeyByZXNvdXJjZTogdXJpLCBuYW1lOiB1cmkudG9TdHJpbmcoKSB9LCB7IGljb246IGljb24gPz8gQ29kaWNvbi5nbG9iZSwgdGl0bGU6IGRhdGEub3B0aW9ucz8uc3RhdHVzPy5kZXNjcmlwdGlvbiA/PyBkYXRhLnRpdGxlID8/IHVyaS50b1N0cmluZygpLCBzdHJpa2V0aHJvdWdoOiBkYXRhLmV4Y2x1ZGVkLCBleHRyYUNsYXNzZXMgfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuc2V0RmlsZSh1cmksIHtcblx0XHRcdFx0XHRmaWxlS2luZDogRmlsZUtpbmQuRklMRSxcblx0XHRcdFx0XHQvLyBTaG91bGQgbm90IGhhdmUgdGhpcyBsaXZlLXVwZGF0aW5nIGRhdGEgb24gYSBoaXN0b3JpY2FsIHJlZmVyZW5jZVxuXHRcdFx0XHRcdGZpbGVEZWNvcmF0aW9uczogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHJhbmdlOiAncmFuZ2UnIGluIHJlZmVyZW5jZSA/IHJlZmVyZW5jZS5yYW5nZSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHR0aXRsZTogZGF0YS5vcHRpb25zPy5zdGF0dXM/LmRlc2NyaXB0aW9uID8/IGRhdGEudGl0bGUsXG5cdFx0XHRcdFx0c3RyaWtldGhyb3VnaDogZGF0YS5leGNsdWRlZCxcblx0XHRcdFx0XHRleHRyYUNsYXNzZXNcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBzZWxlY3RvciBvZiBbJy5tb25hY28taWNvbi1zdWZmaXgtY29udGFpbmVyJywgJy5tb25hY28taWNvbi1uYW1lLWNvbnRhaW5lciddKSB7XG5cdFx0XHRjb25zdCBlbGVtZW50ID0gdGVtcGxhdGVEYXRhLmxhYmVsLmVsZW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG5cdFx0XHRpZiAoZWxlbWVudCkge1xuXHRcdFx0XHRpZiAoZGF0YS5vcHRpb25zPy5zdGF0dXM/LmtpbmQgPT09IENoYXRSZXNwb25zZVJlZmVyZW5jZVBhcnRTdGF0dXNLaW5kLk9taXR0ZWQgfHwgZGF0YS5vcHRpb25zPy5zdGF0dXM/LmtpbmQgPT09IENoYXRSZXNwb25zZVJlZmVyZW5jZVBhcnRTdGF0dXNLaW5kLlBhcnRpYWwpIHtcblx0XHRcdFx0XHRlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3dhcm5pbmcnKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRlbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ3dhcm5pbmcnKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChkYXRhLnN0YXRlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmICh0ZW1wbGF0ZURhdGEuYWN0aW9uQmFyQ29udGFpbmVyKSB7XG5cdFx0XHRcdGlmIChkYXRhLnN0YXRlID09PSBXb3JraW5nU2V0RW50cnlTdGF0ZS5Nb2RpZmllZCAmJiAhdGVtcGxhdGVEYXRhLmFjdGlvbkJhckNvbnRhaW5lci5jbGFzc0xpc3QuY29udGFpbnMoJ21vZGlmaWVkJykpIHtcblx0XHRcdFx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9uQmFyQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ21vZGlmaWVkJyk7XG5cdFx0XHRcdFx0dGVtcGxhdGVEYXRhLmxhYmVsLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLm1vbmFjby1pY29uLW5hbWUtY29udGFpbmVyJyk/LmNsYXNzTGlzdC5hZGQoJ21vZGlmaWVkJyk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoZGF0YS5zdGF0ZSAhPT0gV29ya2luZ1NldEVudHJ5U3RhdGUuTW9kaWZpZWQpIHtcblx0XHRcdFx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9uQmFyQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ21vZGlmaWVkJyk7XG5cdFx0XHRcdFx0dGVtcGxhdGVEYXRhLmxhYmVsLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLm1vbmFjby1pY29uLW5hbWUtY29udGFpbmVyJyk/LmNsYXNzTGlzdC5yZW1vdmUoJ21vZGlmaWVkJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICh0ZW1wbGF0ZURhdGEudG9vbGJhcikge1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEudG9vbGJhci5jb250ZXh0ID0gYXJnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRlbXBsYXRlRGF0YS5jb250ZXh0S2V5U2VydmljZSkge1xuXHRcdFx0XHRpZiAoZGF0YS5zdGF0ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0Y2hhdEVkaXRpbmdXaWRnZXRGaWxlU3RhdGVDb250ZXh0S2V5LmJpbmRUbyh0ZW1wbGF0ZURhdGEuY29udGV4dEtleVNlcnZpY2UpLnNldChkYXRhLnN0YXRlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElDb2xsYXBzaWJsZUxpc3RUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS50ZW1wbGF0ZURpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRSZXNvdXJjZUZvckVsZW1lbnQoZWxlbWVudDogSUNoYXRDb2xsYXBzaWJsZUxpc3RJdGVtKTogVVJJIHwgbnVsbCB7XG5cdGlmIChlbGVtZW50LmtpbmQgPT09ICd3YXJuaW5nJykge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cdGNvbnN0IHsgcmVmZXJlbmNlIH0gPSBlbGVtZW50O1xuXHRpZiAodHlwZW9mIHJlZmVyZW5jZSA9PT0gJ3N0cmluZycgfHwgJ3ZhcmlhYmxlTmFtZScgaW4gcmVmZXJlbmNlKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH0gZWxzZSBpZiAoVVJJLmlzVXJpKHJlZmVyZW5jZSkpIHtcblx0XHRyZXR1cm4gcmVmZXJlbmNlO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiByZWZlcmVuY2UudXJpO1xuXHR9XG59XG5cbi8vI3JlZ2lvbiBSZXNvdXJjZSBjb250ZXh0IG1lbnVcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEFkZFRvQ2hhdEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBpZCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuYWRkVG9DaGF0QWN0aW9uJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQWRkVG9DaGF0QWN0aW9uLmlkLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubG9jYWxpemUyKCdhZGRUb0NoYXQnLCBcIkFkZCBGaWxlIHRvIENoYXRcIiksXG5cdFx0XHR9LFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0QXR0YWNobWVudHNDb250ZXh0LFxuXHRcdFx0XHRncm91cDogJ2NoYXQnLFxuXHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFJlc291cmNlQ29udGV4dEtleS5Jc0ZpbGVTeXN0ZW1SZXNvdXJjZSwgRXhwbG9yZXJGb2xkZXJDb250ZXh0Lm5lZ2F0ZSgpKSxcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHJlc291cmNlOiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjaGF0V2lkZ2V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFdpZGdldFNlcnZpY2UpO1xuXHRcdGNvbnN0IHZhcmlhYmxlc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRWYXJpYWJsZXNTZXJ2aWNlKTtcblxuXHRcdGlmICghcmVzb3VyY2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB3aWRnZXQgPSBjaGF0V2lkZ2V0U2VydmljZS5sYXN0Rm9jdXNlZFdpZGdldDtcblx0XHRpZiAoIXdpZGdldCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHZhcmlhYmxlc1NlcnZpY2UuYXR0YWNoQ29udGV4dCgnZmlsZScsIHJlc291cmNlLCB3aWRnZXQubG9jYXRpb24pO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIE9wZW5DaGF0UmVmZXJlbmNlTGlua0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBpZCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuY29weUxpbmsnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBPcGVuQ2hhdFJlZmVyZW5jZUxpbmtBY3Rpb24uaWQsXG5cdFx0XHR0aXRsZToge1xuXHRcdFx0XHQuLi5sb2NhbGl6ZTIoJ2NvcHlMaW5rJywgXCJDb3B5IExpbmtcIiksXG5cdFx0XHR9LFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0QXR0YWNobWVudHNDb250ZXh0LFxuXHRcdFx0XHRncm91cDogJ2NoYXQnLFxuXHRcdFx0XHRvcmRlcjogMCxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoUmVzb3VyY2VDb250ZXh0S2V5LlNjaGVtZS5pc0VxdWFsVG8oU2NoZW1hcy5odHRwKSwgUmVzb3VyY2VDb250ZXh0S2V5LlNjaGVtZS5pc0VxdWFsVG8oU2NoZW1hcy5odHRwcykpLFxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgcmVzb3VyY2U6IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IGFjY2Vzc29yLmdldChJQ2xpcGJvYXJkU2VydmljZSkud3JpdGVSZXNvdXJjZXMoW3Jlc291cmNlXSk7XG5cdH1cbn0pO1xuXG4vLyNlbmRyZWdpb25cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBQUE7QUFLQSxZQUFZLFNBQVM7QUFFckIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxlQUFlO0FBR3hCLFNBQVMsWUFBWSx1QkFBdUI7QUFDNUMsU0FBUyxtQkFBbUIsZUFBZTtBQUMzQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHFCQUFxQix3QkFBd0I7QUFDdEQsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxTQUFTLGNBQWMsUUFBUSx1QkFBdUI7QUFDL0QsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxnQkFBZ0IsMEJBQTBCO0FBQ25ELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNkJBQStDO0FBQ3hELFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQXlCLHNCQUFzQjtBQUMvQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGdEQUFnRDtBQUN6RCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNDQUFzQyw0QkFBNEI7QUFDM0UsU0FBUywyQ0FBdUY7QUFDaEcsU0FBUyw2QkFBNkI7QUFFdEMsU0FBdUIsMEJBQTBCO0FBQ2pELFNBQVMsa0NBQWtDO0FBQzNDLFNBQStCLG9CQUFvQjtBQUc1QyxNQUFNLElBQUksSUFBSTtBQVdkLElBQU0saUNBQU4sY0FBNkMsMkJBQTJCO0FBQUEsRUFFOUUsWUFDa0IsTUFDakIsZUFDQSxTQUNpQiwyQkFDZ0IsZUFDRixhQUNTLHNCQUNGLG9CQUNyQztBQUNELFVBQU0sa0JBQWtCLEtBQUssU0FBUyxJQUNyQyxTQUFTLHdCQUF3Qix1QkFBdUIsS0FBSyxNQUFNLElBQ25FLFNBQVMsMEJBQTBCLHNCQUFzQixDQUFDLElBQUksT0FBTztBQVhyRDtBQUdBO0FBQ2dCO0FBQ0Y7QUFDUztBQUNGO0FBQUEsRUFLdkM7QUFBQSxFQUVtQixjQUEyQjtBQUM3QyxVQUFNLE1BQU0sS0FBSyxVQUFVLEtBQUssMEJBQTBCLElBQUksQ0FBQztBQUMvRCxVQUFNLE9BQU8sSUFBSTtBQUVqQixTQUFLLFVBQVUsS0FBSyxVQUFVLENBQUMsTUFBTTtBQUNwQyxVQUFJLEVBQUUsV0FBVyxlQUFlLEVBQUUsV0FBVyxPQUFPLEVBQUUsUUFBUSxjQUFjLFVBQVU7QUFDckYsY0FBTSxnQkFBZ0Isa0JBQWtCLEVBQUUsUUFBUSxZQUFZLEVBQUUsUUFBUSxVQUFVLFFBQVEsRUFBRSxRQUFRO0FBQ3BHLGNBQU0sTUFBTSxJQUFJLE1BQU0sYUFBYSxJQUFJLGdCQUN0QyxlQUFlO0FBQ2hCLFlBQUksS0FBSztBQUNSLGVBQUssY0FBYztBQUFBLFlBQ2xCO0FBQUEsWUFDQTtBQUFBLGNBQ0MsaUJBQWlCO0FBQUEsY0FDakIsZUFBZTtBQUFBLGdCQUNkLEdBQUcsRUFBRTtBQUFBLGdCQUNMLEdBQUc7QUFBQSxrQkFDRixXQUFXLGlCQUFpQixXQUFXLGdCQUFnQixjQUFjLFFBQVE7QUFBQSxnQkFDOUU7QUFBQSxjQUNEO0FBQUEsWUFDRDtBQUFBLFVBQUM7QUFBQSxRQUNIO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsU0FBSyxVQUFVLEtBQUssY0FBYyxPQUFLO0FBQ3RDLFVBQUksWUFBWSxLQUFLLEVBQUUsY0FBYyxJQUFJO0FBRXpDLFlBQU0sTUFBTSxFQUFFLFdBQVcsc0JBQXNCLEVBQUUsT0FBTztBQUN4RCxVQUFJLENBQUMsS0FBSztBQUNUO0FBQUEsTUFDRDtBQUVBLFdBQUssbUJBQW1CLGdCQUFnQjtBQUFBLFFBQ3ZDLFdBQVcsTUFBTSxFQUFFO0FBQUEsUUFDbkIsWUFBWSxNQUFNO0FBQ2pCLGdCQUFNLE9BQU8sS0FBSyxZQUFZLGVBQWUsT0FBTyx3QkFBd0IsS0FBSyxtQkFBbUIsRUFBRSxtQkFBbUIsTUFBTSxLQUFLLElBQUksQ0FBQztBQUN6SSxpQkFBTywwQkFBMEIsSUFBSTtBQUFBLFFBQ3RDO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRixDQUFDLENBQUM7QUFFRixVQUFNLHFCQUFxQixLQUFLLFVBQVUsS0FBSyxxQkFBcUIsZUFBZSxrQkFBa0IsQ0FBQztBQUN0RyxTQUFLLFVBQVUsS0FBSyxpQkFBaUIsT0FBSztBQUN6Qyx5QkFBbUIsTUFBTTtBQUN6QixZQUFNLFVBQVUsRUFBRSxTQUFTLFNBQVMsRUFBRSxTQUFTLENBQUMsSUFBSTtBQUNwRCxZQUFNLE1BQU0sV0FBVyxzQkFBc0IsT0FBTztBQUNwRCx5QkFBbUIsSUFBSSxPQUFPLElBQUk7QUFBQSxJQUNuQyxDQUFDLENBQUM7QUFFRixVQUFNLGdCQUFnQjtBQUN0QixVQUFNLGFBQWEsS0FBSyxJQUFJLEtBQUssS0FBSyxRQUFRLGFBQWE7QUFDM0QsVUFBTSxTQUFTLGFBQWE7QUFDNUIsU0FBSyxPQUFPLE1BQU07QUFDbEIsU0FBSyxlQUFlLEVBQUUsTUFBTSxTQUFTLEdBQUcsTUFBTTtBQUM5QyxTQUFLLE9BQU8sR0FBRyxLQUFLLFFBQVEsS0FBSyxJQUFJO0FBRXJDLFdBQU8sS0FBSyxlQUFlLEVBQUU7QUFBQSxFQUM5QjtBQUFBLEVBRUEsZUFBZSxPQUE2QixrQkFBMEMsU0FBZ0M7QUFDckgsV0FBTyxNQUFNLFNBQVMsZ0JBQWdCLE1BQU0sV0FBVyxXQUFXLEtBQUssS0FBSyxVQUFXLENBQUMsQ0FBQyxpQkFBaUIsV0FBVyxLQUFLO0FBQUEsRUFDM0g7QUFDRDtBQWhGYSxpQ0FBTjtBQUFBLEVBT0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVZVO0FBc0ZOLElBQU0sb0NBQU4sY0FBZ0QsK0JBQStCO0FBQUEsRUFDckYsWUFDQyxNQUNBLGVBQ0EsU0FDQSwyQkFDaUIsU0FDRCxlQUNGLGFBQ1Msc0JBQ0Ysb0JBQ3BCO0FBQ0QsVUFBTSxNQUFNLGVBQWUsU0FBUywyQkFBMkIsZUFBZSxhQUFhLHNCQUFzQixrQkFBa0I7QUFObEg7QUFPakIsUUFBSSxLQUFLLFdBQVcsR0FBRztBQUN0QixVQUFJLEtBQUssS0FBSyxPQUFPO0FBQUEsSUFDdEI7QUFBQSxFQUNEO0FBQUEsRUFFbUIsYUFBc0I7QUFDeEMsVUFBTSxVQUFVLEtBQUssUUFBUTtBQUM3QixXQUFPLFFBQVEsMEJBQTBCLENBQUMsRUFDekMsS0FBSyxRQUFRLDZCQUE2QixRQUFRLFNBQVMsTUFBTSxXQUFXO0FBQUEsRUFFOUU7QUFBQSxFQUVtQixZQUFZLE9BQXNCO0FBQ3BELFVBQU0sVUFBVSxLQUFLLFFBQVE7QUFDN0IsWUFBUSx5QkFBeUIsQ0FBQyxLQUFLLFdBQVc7QUFBQSxFQUNuRDtBQUNEO0FBN0JhLG9DQUFOO0FBQUEsRUFPSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBVlU7QUErQk4sSUFBTSxzQkFBTixjQUFrQyxXQUFXO0FBQUEsRUFPbkQsWUFDUyx3QkFDUyxRQUN1QixzQkFDUixjQUNBLGNBQy9CO0FBQ0QsVUFBTTtBQU5FO0FBQ1M7QUFDdUI7QUFDUjtBQUNBO0FBR2hDLFNBQUssUUFBUSxLQUFLLFVBQVUsSUFBSSxhQUFhLE1BQU0sS0FBSyxZQUFZLENBQUMsQ0FBQztBQUFBLEVBQ3ZFO0FBQUEsRUFiQSxJQUFXLFFBQThEO0FBQ3hFLFdBQU8sS0FBSyxNQUFNO0FBQUEsRUFDbkI7QUFBQSxFQWFRLGNBQXVEO0FBQzlELFVBQU0saUJBQWlCLEtBQUssVUFBVSxLQUFLLHFCQUFxQixlQUFlLGdCQUFnQixFQUFFLHVCQUF1QixLQUFLLHVCQUF1QixDQUFDLENBQUM7QUFFdEosVUFBTSxZQUFZLEVBQUUseUJBQXlCO0FBQzdDLFNBQUssVUFBVSx5Q0FBeUMsV0FBVyxLQUFLLFlBQVksQ0FBQztBQUVyRixVQUFNLE9BQU8sS0FBSyxxQkFBcUI7QUFBQSxNQUN0QztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxJQUFJLHdCQUF3QjtBQUFBLE1BQzVCLENBQUMsS0FBSyxxQkFBcUIsZUFBZSx5QkFBeUIsZ0JBQWdCLEtBQUssTUFBTSxDQUFDO0FBQUEsTUFDL0Y7QUFBQSxRQUNDLHlCQUF5QjtBQUFBLFFBQ3pCLHVCQUF1QjtBQUFBLFVBQ3RCLGNBQWMsQ0FBQyxZQUFzQztBQUNwRCxnQkFBSSxRQUFRLFNBQVMsV0FBVztBQUMvQixxQkFBTyxRQUFRLFFBQVE7QUFBQSxZQUN4QjtBQUNBLGtCQUFNLFlBQVksUUFBUTtBQUMxQixnQkFBSSxPQUFPLGNBQWMsVUFBVTtBQUNsQyxxQkFBTztBQUFBLFlBQ1IsV0FBVyxrQkFBa0IsV0FBVztBQUN2QyxxQkFBTyxVQUFVO0FBQUEsWUFDbEIsV0FBVyxJQUFJLE1BQU0sU0FBUyxHQUFHO0FBQ2hDLHFCQUFPLFNBQVMsVUFBVSxJQUFJO0FBQUEsWUFDL0IsT0FBTztBQUNOLHFCQUFPLFNBQVMsVUFBVSxJQUFJLElBQUk7QUFBQSxZQUNuQztBQUFBLFVBQ0Q7QUFBQSxVQUVBLG9CQUFvQixNQUFNLFNBQVMsdUJBQXVCLHVCQUF1QjtBQUFBLFFBQ2xGO0FBQUEsUUFDQSxLQUFLO0FBQUEsVUFDSixZQUFZLENBQUMsWUFBc0Msc0JBQXNCLE9BQU8sR0FBRyxTQUFTLEtBQUs7QUFBQSxVQUNqRyxjQUFjLENBQUMsVUFBVSxrQkFBa0I7QUFDMUMsa0JBQU0sT0FBYyxTQUFTLFNBQVMsSUFBSSxxQkFBcUIsQ0FBQztBQUNoRSxnQkFBSSxDQUFDLEtBQUssUUFBUTtBQUNqQixxQkFBTztBQUFBLFlBQ1IsV0FBVyxLQUFLLFdBQVcsR0FBRztBQUM3QixxQkFBTyxLQUFLLGFBQWEsWUFBWSxLQUFLLENBQUMsR0FBRyxFQUFFLFVBQVUsS0FBSyxDQUFDO0FBQUEsWUFDakUsT0FBTztBQUNOLHFCQUFPLEdBQUcsS0FBSyxNQUFNO0FBQUEsWUFDdEI7QUFBQSxVQUNEO0FBQUEsVUFDQSxTQUFTLE1BQU07QUFBQSxVQUFFO0FBQUEsVUFDakIsWUFBWSxNQUFNO0FBQUEsVUFDbEIsTUFBTSxNQUFNO0FBQUEsVUFBRTtBQUFBLFVBQ2QsYUFBYSxDQUFDLE1BQU0sa0JBQWtCO0FBQ3JDLGdCQUFJO0FBQ0gsb0JBQU0sV0FBVyxLQUFLLFFBQVE7QUFDOUIsb0JBQU0sT0FBYyxTQUFTLFNBQVMsSUFBSSxxQkFBcUIsQ0FBQztBQUNoRSxtQkFBSyxxQkFBcUIsZUFBZSxjQUFZLG9CQUFvQixVQUFVLE1BQU0sYUFBYSxDQUFDO0FBQUEsWUFDeEcsUUFBUTtBQUFBLFlBRVI7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUFDO0FBRUYsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQXFFO0FBQ3BFLFVBQU0sU0FBUyxLQUFLLE1BQU0sSUFBSTtBQUM5QixRQUFJLFFBQVE7QUFDWixXQUFPO0FBQUEsTUFDTjtBQUFBLE1BQ0EsU0FBUyxNQUFNO0FBQUEsTUFDZixTQUFTLE1BQU07QUFDZCxnQkFBUTtBQUNSLGFBQUssTUFBTSxRQUFRLE1BQU07QUFBQSxNQUMxQjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7QUE3RmEsc0JBQU47QUFBQSxFQVVKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVpVO0FBK0ZiLE1BQU0sd0JBQWtGO0FBQUEsRUFDdkYsVUFBVSxTQUEyQztBQUNwRCxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsY0FBYyxTQUEyQztBQUN4RCxXQUFPLHdCQUF3QjtBQUFBLEVBQ2hDO0FBQ0Q7QUFVQSxJQUFNLDBCQUFOLE1BQTJHO0FBQUEsRUFJMUcsWUFDUyxRQUNBLFFBQ3dCLGNBQ0UsZ0JBQ00sc0JBQ0gsbUJBQ3BDO0FBTk87QUFDQTtBQUN3QjtBQUNFO0FBQ007QUFDSDtBQVJ0QyxTQUFTLGFBQXFCLHdCQUF3QjtBQUFBLEVBU2xEO0FBQUEsRUFFSixlQUFlLFdBQWtEO0FBQ2hFLFVBQU0sc0JBQXNCLElBQUksZ0JBQWdCO0FBQ2hELFVBQU0sUUFBUSxvQkFBb0IsSUFBSSxLQUFLLE9BQU8sT0FBTyxXQUFXLEVBQUUsbUJBQW1CLE1BQU0sY0FBYyxLQUFLLENBQUMsQ0FBQztBQUVwSCxRQUFJO0FBQ0osUUFBSTtBQUNKLFFBQUk7QUFDSixRQUFJLEtBQUssUUFBUTtBQUNoQiwyQkFBcUIsRUFBRSxtQ0FBbUM7QUFDMUQsMEJBQW9CLG9CQUFvQixJQUFJLEtBQUssa0JBQWtCLGFBQWEsa0JBQWtCLENBQUM7QUFDbkcsWUFBTSw2QkFBNkIsb0JBQW9CLElBQUksS0FBSyxxQkFBcUIsWUFBWSxJQUFJLGtCQUFrQixDQUFDLG9CQUFvQixpQkFBaUIsQ0FBQyxDQUFDLENBQUM7QUFDaEssZ0JBQVUsb0JBQW9CLElBQUksMkJBQTJCLGVBQWUsc0JBQXNCLG9CQUFvQixLQUFLLFFBQVEsRUFBRSxhQUFhLEVBQUUsbUJBQW1CLE1BQU0sS0FBSyxPQUFVLEVBQUUsQ0FBQyxDQUFDO0FBQ2hNLFlBQU0sUUFBUSxZQUFZLGtCQUFrQjtBQUFBLElBQzdDO0FBRUEsV0FBTyxFQUFFLHFCQUFxQixPQUFPLFNBQVMsb0JBQW9CLGtCQUFrQjtBQUFBLEVBQ3JGO0FBQUEsRUFHUSxpQkFBaUIsTUFBMEQ7QUFDbEYsUUFBSSxVQUFVLFlBQVksS0FBSyxRQUFRLEdBQUc7QUFDekMsYUFBTyxLQUFLO0FBQUEsSUFDYixPQUFPO0FBQ04sYUFBTyxLQUFLLGFBQWEsY0FBYyxFQUFFLFNBQVMsWUFBWSxRQUFRLEtBQUssVUFBVSxPQUNsRixLQUFLLFVBQVUsT0FDZixLQUFLLFVBQVU7QUFBQSxJQUNuQjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLGNBQWMsTUFBZ0MsT0FBZSxjQUF3QyxRQUFrQztBQUN0SSxRQUFJLEtBQUssU0FBUyxXQUFXO0FBQzVCLG1CQUFhLE1BQU0sWUFBWSxFQUFFLE1BQU0sS0FBSyxRQUFRLE1BQU0sR0FBRyxFQUFFLE1BQU0sUUFBUSxRQUFRLENBQUM7QUFDdEY7QUFBQSxJQUNEO0FBRUEsVUFBTSxZQUFZLEtBQUs7QUFDdkIsVUFBTSxPQUFPLEtBQUssaUJBQWlCLElBQUk7QUFDdkMsaUJBQWEsTUFBTSxRQUFRLE1BQU0sVUFBVTtBQUMzQyxRQUFJO0FBQ0osUUFBSSxPQUFPLGNBQWMsWUFBWSxrQkFBa0IsV0FBVztBQUNqRSxVQUFJLFVBQVUsT0FBTztBQUNwQixjQUFNLE1BQU0sSUFBSSxNQUFNLFVBQVUsS0FBSyxJQUFJLFVBQVUsUUFBUSxVQUFVLE1BQU07QUFDM0UscUJBQWEsTUFBTTtBQUFBLFVBQ2xCO0FBQUEsWUFDQyxVQUFVO0FBQUEsWUFDVixNQUFNLG9CQUFvQixHQUFHO0FBQUEsWUFDN0IsYUFBYSxJQUFJLFVBQVUsWUFBWTtBQUFBLFlBQ3ZDLE9BQU8sV0FBVyxVQUFVLFFBQVEsVUFBVSxNQUFNLFFBQVE7QUFBQSxVQUM3RDtBQUFBLFVBQUcsRUFBRSxNQUFNLE9BQU8sS0FBSyxTQUFTLFFBQVEsZUFBZSxLQUFLLE1BQU07QUFBQSxRQUFDO0FBQUEsTUFDckUsV0FBVyxVQUFVLGFBQWEsV0FBVyxnQkFBZ0IsR0FBRztBQUMvRCxjQUFNLFdBQVcsVUFBVSxhQUFhLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDcEQsY0FBTSxpQkFBaUIsR0FBRyxRQUFRO0FBQ2xDLGNBQU0sUUFBUTtBQUNkLHFCQUFhLE1BQU0sU0FBUyxPQUFPLGdCQUFnQixFQUFFLE9BQU8sS0FBSyxTQUFTLFFBQVEsWUFBWSxDQUFDO0FBQUEsTUFDaEcsT0FBTztBQUVOLHFCQUFhLE1BQU0sU0FBUyx1QkFBdUI7QUFBQSxNQUNwRDtBQUFBLElBQ0QsV0FBVyxPQUFPLGNBQWMsVUFBVTtBQUN6QyxtQkFBYSxNQUFNLFNBQVMsV0FBVyxRQUFXLEVBQUUsVUFBVSxJQUFJLE1BQU0sSUFBSSxJQUFJLE9BQU8sUUFBVyxPQUFPLEtBQUssU0FBUyxRQUFRLGVBQWUsS0FBSyxNQUFNLENBQUM7QUFBQSxJQUUzSixPQUFPO0FBQ04sWUFBTSxNQUFNLFNBQVMsWUFBWSxVQUFVLE1BQU07QUFDakQsWUFBTTtBQUNOLFlBQU0sZUFBZSxLQUFLLFdBQVcsQ0FBQyxVQUFVLElBQUksQ0FBQztBQUNyRCxVQUFJLElBQUksV0FBVyxXQUFXLGlCQUFpQixJQUFJLFdBQVcsWUFBWSxLQUFLLElBQUksS0FBSyxTQUFTLFFBQVEsR0FBRztBQUUzRyxjQUFNLFFBQVEsSUFBSSxLQUFLLE1BQU0sR0FBRyxFQUFFLE1BQU0sR0FBRyxDQUFDLEVBQUUsS0FBSyxHQUFHO0FBQ3RELGNBQU0sY0FBYyxJQUFJLEtBQUssTUFBTSxHQUFHLEVBQUUsTUFBTSxDQUFDLEVBQUUsS0FBSyxHQUFHO0FBQ3pELHFCQUFhLE1BQU0sWUFBWSxFQUFFLFVBQVUsS0FBSyxNQUFNLE9BQU8sWUFBWSxHQUFHLEVBQUUsTUFBTSxRQUFRLFFBQVEsT0FBTyxLQUFLLE9BQU8sZUFBZSxLQUFLLFVBQVUsYUFBYSxDQUFDO0FBQUEsTUFDcEssV0FBVyxJQUFJLFdBQVcsS0FBSyxlQUFlLGVBQWUsaUJBQWlCLElBQUksV0FBVyxrQkFBa0IsR0FBRztBQUVqSCxjQUFNLFlBQVksSUFBSSxLQUFLLFVBQVUsQ0FBQztBQUN0QyxxQkFBYSxNQUFNLFlBQVksRUFBRSxVQUFVLEtBQUssTUFBTSxVQUFVLEdBQUcsRUFBRSxNQUFNLFFBQVEsY0FBYyxPQUFPLFNBQVMsaUJBQWlCLHNCQUFzQixTQUFTLEdBQUcsZUFBZSxLQUFLLFVBQVUsYUFBYSxDQUFDO0FBQUEsTUFDak4sV0FBVyxrQkFBa0IsS0FBSyxRQUFRLFFBQVEsUUFBUSxNQUFNLFFBQVEsS0FBSyxHQUFHO0FBQy9FLHFCQUFhLE1BQU0sWUFBWSxFQUFFLFVBQVUsS0FBSyxNQUFNLElBQUksU0FBUyxFQUFFLEdBQUcsRUFBRSxNQUFNLFFBQVEsUUFBUSxPQUFPLE9BQU8sS0FBSyxTQUFTLFFBQVEsZUFBZSxLQUFLLFNBQVMsSUFBSSxTQUFTLEdBQUcsZUFBZSxLQUFLLFVBQVUsYUFBYSxDQUFDO0FBQUEsTUFDOU4sT0FBTztBQUNOLHFCQUFhLE1BQU0sUUFBUSxLQUFLO0FBQUEsVUFDL0IsVUFBVSxTQUFTO0FBQUE7QUFBQSxVQUVuQixpQkFBaUI7QUFBQSxVQUNqQixPQUFPLFdBQVcsWUFBWSxVQUFVLFFBQVE7QUFBQSxVQUNoRCxPQUFPLEtBQUssU0FBUyxRQUFRLGVBQWUsS0FBSztBQUFBLFVBQ2pELGVBQWUsS0FBSztBQUFBLFVBQ3BCO0FBQUEsUUFDRCxDQUFDO0FBQUEsTUFDRjtBQUFBLElBQ0Q7QUFFQSxlQUFXLFlBQVksQ0FBQyxpQ0FBaUMsNkJBQTZCLEdBQUc7QUFDeEYsWUFBTSxVQUFVLGFBQWEsTUFBTSxRQUFRLGNBQWMsUUFBUTtBQUNqRSxVQUFJLFNBQVM7QUFDWixZQUFJLEtBQUssU0FBUyxRQUFRLFNBQVMsb0NBQW9DLFdBQVcsS0FBSyxTQUFTLFFBQVEsU0FBUyxvQ0FBb0MsU0FBUztBQUM3SixrQkFBUSxVQUFVLElBQUksU0FBUztBQUFBLFFBQ2hDLE9BQU87QUFDTixrQkFBUSxVQUFVLE9BQU8sU0FBUztBQUFBLFFBQ25DO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxRQUFJLEtBQUssVUFBVSxRQUFXO0FBQzdCLFVBQUksYUFBYSxvQkFBb0I7QUFDcEMsWUFBSSxLQUFLLFVBQVUscUJBQXFCLFlBQVksQ0FBQyxhQUFhLG1CQUFtQixVQUFVLFNBQVMsVUFBVSxHQUFHO0FBQ3BILHVCQUFhLG1CQUFtQixVQUFVLElBQUksVUFBVTtBQUN4RCx1QkFBYSxNQUFNLFFBQVEsY0FBYyw2QkFBNkIsR0FBRyxVQUFVLElBQUksVUFBVTtBQUFBLFFBQ2xHLFdBQVcsS0FBSyxVQUFVLHFCQUFxQixVQUFVO0FBQ3hELHVCQUFhLG1CQUFtQixVQUFVLE9BQU8sVUFBVTtBQUMzRCx1QkFBYSxNQUFNLFFBQVEsY0FBYyw2QkFBNkIsR0FBRyxVQUFVLE9BQU8sVUFBVTtBQUFBLFFBQ3JHO0FBQUEsTUFDRDtBQUNBLFVBQUksYUFBYSxTQUFTO0FBQ3pCLHFCQUFhLFFBQVEsVUFBVTtBQUFBLE1BQ2hDO0FBQ0EsVUFBSSxhQUFhLG1CQUFtQjtBQUNuQyxZQUFJLEtBQUssVUFBVSxRQUFXO0FBQzdCLCtDQUFxQyxPQUFPLGFBQWEsaUJBQWlCLEVBQUUsSUFBSSxLQUFLLEtBQUs7QUFBQSxRQUMzRjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRUEsZ0JBQWdCLGNBQThDO0FBQzdELGlCQUFhLG9CQUFvQixRQUFRO0FBQUEsRUFDMUM7QUFDRDtBQXpJTSx3QkFDRSxjQUFjO0FBRGhCLDBCQUFOO0FBQUEsRUFPRztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBVkc7QUEySU4sU0FBUyxzQkFBc0IsU0FBK0M7QUFDN0UsTUFBSSxRQUFRLFNBQVMsV0FBVztBQUMvQixXQUFPO0FBQUEsRUFDUjtBQUNBLFFBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsTUFBSSxPQUFPLGNBQWMsWUFBWSxrQkFBa0IsV0FBVztBQUNqRSxXQUFPO0FBQUEsRUFDUixXQUFXLElBQUksTUFBTSxTQUFTLEdBQUc7QUFDaEMsV0FBTztBQUFBLEVBQ1IsT0FBTztBQUNOLFdBQU8sVUFBVTtBQUFBLEVBQ2xCO0FBQ0Q7QUFJQSxpQkFBZ0IsbUJBQThCLFFBQVE7QUFBQSxFQUlyRCxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSSxHQUFnQjtBQUFBLE1BQ3BCLE9BQU87QUFBQSxRQUNOLEdBQUcsVUFBVSxhQUFhLGtCQUFrQjtBQUFBLE1BQzdDO0FBQUEsTUFDQSxJQUFJO0FBQUEsTUFDSixNQUFNLENBQUM7QUFBQSxRQUNOLElBQUksT0FBTztBQUFBLFFBQ1gsT0FBTztBQUFBLFFBQ1AsT0FBTztBQUFBLFFBQ1AsTUFBTSxlQUFlLElBQUksbUJBQW1CLHNCQUFzQixzQkFBc0IsT0FBTyxDQUFDO0FBQUEsTUFDakcsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQWUsSUFBSSxVQUE0QixVQUE4QjtBQUM1RSxVQUFNLG9CQUFvQixTQUFTLElBQUksa0JBQWtCO0FBQ3pELFVBQU0sbUJBQW1CLFNBQVMsSUFBSSxxQkFBcUI7QUFFM0QsUUFBSSxDQUFDLFVBQVU7QUFDZDtBQUFBLElBQ0Q7QUFFQSxVQUFNLFNBQVMsa0JBQWtCO0FBQ2pDLFFBQUksQ0FBQyxRQUFRO0FBQ1o7QUFBQSxJQUNEO0FBRUEscUJBQWlCLGNBQWMsUUFBUSxVQUFVLE9BQU8sUUFBUTtBQUFBLEVBQ2pFO0FBQ0QsR0FuQ2dCLEdBRUMsS0FBSyx5Q0FGTixHQW1DZjtBQUVELGlCQUFnQixtQkFBMEMsUUFBUTtBQUFBLEVBSWpFLGNBQWM7QUFDYixVQUFNO0FBQUEsTUFDTCxJQUFJLEdBQTRCO0FBQUEsTUFDaEMsT0FBTztBQUFBLFFBQ04sR0FBRyxVQUFVLFlBQVksV0FBVztBQUFBLE1BQ3JDO0FBQUEsTUFDQSxJQUFJO0FBQUEsTUFDSixNQUFNLENBQUM7QUFBQSxRQUNOLElBQUksT0FBTztBQUFBLFFBQ1gsT0FBTztBQUFBLFFBQ1AsT0FBTztBQUFBLFFBQ1AsTUFBTSxlQUFlLEdBQUcsbUJBQW1CLE9BQU8sVUFBVSxRQUFRLElBQUksR0FBRyxtQkFBbUIsT0FBTyxVQUFVLFFBQVEsS0FBSyxDQUFDO0FBQUEsTUFDOUgsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQWUsSUFBSSxVQUE0QixVQUE4QjtBQUM1RSxVQUFNLFNBQVMsSUFBSSxpQkFBaUIsRUFBRSxlQUFlLENBQUMsUUFBUSxDQUFDO0FBQUEsRUFDaEU7QUFDRCxHQXZCZ0IsR0FFQyxLQUFLLGtDQUZOLEdBdUJmOyIsCiAgIm5hbWVzIjogW10KfQo=
