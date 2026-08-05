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
import * as resources from "../../../base/common/resources.js";
import { isFalsyOrWhitespace } from "../../../base/common/strings.js";
import { localize } from "../../../nls.js";
import { ContextKeyExpr } from "../../../platform/contextkey/common/contextkey.js";
import { ExtensionIdentifier, ExtensionIdentifierSet } from "../../../platform/extensions/common/extensions.js";
import { SyncDescriptor } from "../../../platform/instantiation/common/descriptors.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { Registry } from "../../../platform/registry/common/platform.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { Extensions as ViewletExtensions } from "../../browser/panecomposite.js";
import { CustomTreeView, TreeViewPane } from "../../browser/parts/views/treeView.js";
import { ViewPaneContainer } from "../../browser/parts/views/viewPaneContainer.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../common/contributions.js";
import { Extensions as ViewContainerExtensions, ViewContainerLocation } from "../../common/views.js";
import { VIEWLET_ID as DEBUG } from "../../contrib/debug/common/debug.js";
import { VIEWLET_ID as EXPLORER } from "../../contrib/files/common/files.js";
import { VIEWLET_ID as REMOTE } from "../../contrib/remote/browser/remoteExplorer.js";
import { VIEWLET_ID as SCM } from "../../contrib/scm/common/scm.js";
import { WebviewViewPane } from "../../contrib/webviewView/browser/webviewViewPane.js";
import { isProposedApiEnabled } from "../../services/extensions/common/extensions.js";
import { ExtensionsRegistry } from "../../services/extensions/common/extensionsRegistry.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { Extensions as ExtensionFeaturesRegistryExtensions } from "../../services/extensionManagement/common/extensionFeatures.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { MarkdownString } from "../../../base/common/htmlContent.js";
const viewsContainerSchema = {
  type: "object",
  properties: {
    id: {
      description: localize({ key: "vscode.extension.contributes.views.containers.id", comment: ["Contribution refers to those that an extension contributes to VS Code through an extension/contribution point. "] }, "Unique id used to identify the container in which views can be contributed using 'views' contribution point"),
      type: "string",
      pattern: "^[a-zA-Z0-9_-]+$"
    },
    title: {
      description: localize("vscode.extension.contributes.views.containers.title", "Human readable string used to render the container"),
      type: "string"
    },
    icon: {
      description: localize("vscode.extension.contributes.views.containers.icon", "Path to the container icon. Icons are 24x24 centered on a 50x40 block and have a fill color of 'rgb(215, 218, 224)' or '#d7dae0'. It is recommended that icons be in SVG, though any image file type is accepted."),
      type: "string"
    }
  },
  required: ["id", "title", "icon"]
};
const viewsContainersContribution = {
  description: localize("vscode.extension.contributes.viewsContainers", "Contributes views containers to the editor"),
  type: "object",
  properties: {
    "activitybar": {
      description: localize("views.container.activitybar", "Contribute views containers to Activity Bar"),
      type: "array",
      items: viewsContainerSchema
    },
    "panel": {
      description: localize("views.container.panel", "Contribute views containers to Panel"),
      type: "array",
      items: viewsContainerSchema
    }
  },
  additionalProperties: false
};
var ViewType = /* @__PURE__ */ ((ViewType2) => {
  ViewType2["Tree"] = "tree";
  ViewType2["Webview"] = "webview";
  return ViewType2;
})(ViewType || {});
var InitialVisibility = /* @__PURE__ */ ((InitialVisibility2) => {
  InitialVisibility2["Visible"] = "visible";
  InitialVisibility2["Hidden"] = "hidden";
  InitialVisibility2["Collapsed"] = "collapsed";
  return InitialVisibility2;
})(InitialVisibility || {});
const viewDescriptor = {
  type: "object",
  required: ["id", "name", "icon"],
  defaultSnippets: [{ body: { id: "${1:id}", name: "${2:name}", icon: "${3:icon}" } }],
  properties: {
    type: {
      markdownDescription: localize("vscode.extension.contributes.view.type", "Type of the view. This can either be `tree` for a tree view based view or `webview` for a webview based view. The default is `tree`."),
      type: "string",
      enum: [
        "tree",
        "webview"
      ],
      markdownEnumDescriptions: [
        localize("vscode.extension.contributes.view.tree", "The view is backed by a `TreeView` created by `createTreeView`."),
        localize("vscode.extension.contributes.view.webview", "The view is backed by a `WebviewView` registered by `registerWebviewViewProvider`.")
      ]
    },
    id: {
      markdownDescription: localize("vscode.extension.contributes.view.id", "Identifier of the view. This should be unique across all views. It is recommended to include your extension id as part of the view id. Use this to register a data provider through `vscode.window.registerTreeDataProviderForView` API. Also to trigger activating your extension by registering `onView:${id}` event to `activationEvents`."),
      type: "string"
    },
    name: {
      description: localize("vscode.extension.contributes.view.name", "The human-readable name of the view. Will be shown"),
      type: "string"
    },
    when: {
      description: localize("vscode.extension.contributes.view.when", "Condition which must be true to show this view"),
      type: "string"
    },
    icon: {
      description: localize("vscode.extension.contributes.view.icon", "Path to the view icon. View icons are displayed when the name of the view cannot be shown. It is recommended that icons be in SVG, though any image file type is accepted."),
      type: "string"
    },
    contextualTitle: {
      description: localize("vscode.extension.contributes.view.contextualTitle", "Human-readable context for when the view is moved out of its original location. By default, the view's container name will be used."),
      type: "string"
    },
    visibility: {
      description: localize("vscode.extension.contributes.view.initialState", "Initial state of the view when the extension is first installed. Once the user has changed the view state by collapsing, moving, or hiding the view, the initial state will not be used again."),
      type: "string",
      enum: [
        "visible",
        "hidden",
        "collapsed"
      ],
      default: "visible",
      enumDescriptions: [
        localize("vscode.extension.contributes.view.initialState.visible", "The default initial state for the view. In most containers the view will be expanded, however; some built-in containers (explorer, scm, and debug) show all contributed views collapsed regardless of the `visibility`."),
        localize("vscode.extension.contributes.view.initialState.hidden", "The view will not be shown in the view container, but will be discoverable through the views menu and other view entry points and can be un-hidden by the user."),
        localize("vscode.extension.contributes.view.initialState.collapsed", "The view will show in the view container, but will be collapsed.")
      ]
    },
    initialSize: {
      type: "number",
      description: localize("vscode.extension.contributs.view.size", "The initial size of the view. The size will behave like the css 'flex' property, and will set the initial size when the view is first shown. In the side bar, this is the height of the view. This value is only respected when the same extension owns both the view and the view container.")
    },
    accessibilityHelpContent: {
      type: "string",
      markdownDescription: localize("vscode.extension.contributes.view.accessibilityHelpContent", "When the accessibility help dialog is invoked in this view, this content will be presented to the user as a markdown string. Keybindings will be resolved when provided in the format of <keybinding:commandId>. If there is no keybinding, that will be indicated and this command will be included in a quickpick for easy configuration.")
    }
  }
};
const remoteViewDescriptor = {
  type: "object",
  required: ["id", "name"],
  properties: {
    id: {
      description: localize("vscode.extension.contributes.view.id", "Identifier of the view. This should be unique across all views. It is recommended to include your extension id as part of the view id. Use this to register a data provider through `vscode.window.registerTreeDataProviderForView` API. Also to trigger activating your extension by registering `onView:${id}` event to `activationEvents`."),
      type: "string"
    },
    name: {
      description: localize("vscode.extension.contributes.view.name", "The human-readable name of the view. Will be shown"),
      type: "string"
    },
    when: {
      description: localize("vscode.extension.contributes.view.when", "Condition which must be true to show this view"),
      type: "string"
    },
    group: {
      description: localize("vscode.extension.contributes.view.group", "Nested group in the viewlet"),
      type: "string"
    },
    remoteName: {
      description: localize("vscode.extension.contributes.view.remoteName", "The name of the remote type associated with this view"),
      type: ["string", "array"],
      items: {
        type: "string"
      }
    }
  }
};
const viewsContribution = {
  description: localize("vscode.extension.contributes.views", "Contributes views to the editor"),
  type: "object",
  properties: {
    "explorer": {
      description: localize("views.explorer", "Contributes views to Explorer container in the Activity bar"),
      type: "array",
      items: viewDescriptor,
      default: []
    },
    "debug": {
      description: localize("views.debug", "Contributes views to Debug container in the Activity bar"),
      type: "array",
      items: viewDescriptor,
      default: []
    },
    "scm": {
      description: localize("views.scm", "Contributes views to SCM container in the Activity bar"),
      type: "array",
      items: viewDescriptor,
      default: []
    },
    "test": {
      description: localize("views.test", "Contributes views to Test container in the Activity bar"),
      type: "array",
      items: viewDescriptor,
      default: []
    },
    "remote": {
      description: localize("views.remote", "Contributes views to Remote container in the Activity bar. To contribute to this container, enableProposedApi needs to be turned on"),
      type: "array",
      items: remoteViewDescriptor,
      default: []
    }
  },
  additionalProperties: {
    description: localize("views.contributed", "Contributes views to contributed views container"),
    type: "array",
    items: viewDescriptor,
    default: []
  }
};
const viewsContainersExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "viewsContainers",
  jsonSchema: viewsContainersContribution
});
const viewsExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "views",
  deps: [viewsContainersExtensionPoint],
  jsonSchema: viewsContribution,
  activationEventsGenerator: (viewExtensionPointTypeArray, result) => {
    for (const viewExtensionPointType of viewExtensionPointTypeArray) {
      for (const viewDescriptors of Object.values(viewExtensionPointType)) {
        for (const viewDescriptor2 of viewDescriptors) {
          if (viewDescriptor2.id) {
            result.push(`onView:${viewDescriptor2.id}`);
          }
        }
      }
    }
  }
});
const CUSTOM_VIEWS_START_ORDER = 7;
let ViewsExtensionHandler = class {
  constructor(instantiationService, logService) {
    this.instantiationService = instantiationService;
    this.logService = logService;
    this.viewContainersRegistry = Registry.as(ViewContainerExtensions.ViewContainersRegistry);
    this.viewsRegistry = Registry.as(ViewContainerExtensions.ViewsRegistry);
    this.handleAndRegisterCustomViewContainers();
    this.handleAndRegisterCustomViews();
  }
  handleAndRegisterCustomViewContainers() {
    viewsContainersExtensionPoint.setHandler((extensions, { added, removed }) => {
      if (removed.length) {
        this.removeCustomViewContainers(removed);
      }
      if (added.length) {
        this.addCustomViewContainers(added, this.viewContainersRegistry.all);
      }
    });
  }
  addCustomViewContainers(extensionPoints, existingViewContainers) {
    const viewContainersRegistry = Registry.as(ViewContainerExtensions.ViewContainersRegistry);
    let activityBarOrder = CUSTOM_VIEWS_START_ORDER + viewContainersRegistry.all.filter((v) => !!v.extensionId && viewContainersRegistry.getViewContainerLocation(v) === ViewContainerLocation.Sidebar).length;
    let panelOrder = 5 + viewContainersRegistry.all.filter((v) => !!v.extensionId && viewContainersRegistry.getViewContainerLocation(v) === ViewContainerLocation.Panel).length + 1;
    for (const { value, collector, description } of extensionPoints) {
      Object.entries(value).forEach(([key, value2]) => {
        if (!this.isValidViewsContainer(value2, collector)) {
          return;
        }
        switch (key) {
          case "activitybar":
            activityBarOrder = this.registerCustomViewContainers(value2, description, activityBarOrder, existingViewContainers, ViewContainerLocation.Sidebar);
            break;
          case "panel":
            panelOrder = this.registerCustomViewContainers(value2, description, panelOrder, existingViewContainers, ViewContainerLocation.Panel);
            break;
        }
      });
    }
  }
  removeCustomViewContainers(extensionPoints) {
    const viewContainersRegistry = Registry.as(ViewContainerExtensions.ViewContainersRegistry);
    const removedExtensions = extensionPoints.reduce((result, e) => {
      result.add(e.description.identifier);
      return result;
    }, new ExtensionIdentifierSet());
    for (const viewContainer of viewContainersRegistry.all) {
      if (viewContainer.extensionId && removedExtensions.has(viewContainer.extensionId)) {
        const views = this.viewsRegistry.getViews(viewContainer);
        if (views.length) {
          this.viewsRegistry.moveViews(views, this.getDefaultViewContainer());
        }
        this.deregisterCustomViewContainer(viewContainer);
      }
    }
  }
  isValidViewsContainer(viewsContainersDescriptors, collector) {
    if (!Array.isArray(viewsContainersDescriptors)) {
      collector.error(localize("viewcontainer requirearray", "views containers must be an array"));
      return false;
    }
    for (const descriptor of viewsContainersDescriptors) {
      if (typeof descriptor.id !== "string" && isFalsyOrWhitespace(descriptor.id)) {
        collector.error(localize("requireidstring", "property `{0}` is mandatory and must be of type `string` with non-empty value. Only alphanumeric characters, '_', and '-' are allowed.", "id"));
        return false;
      }
      if (!/^[a-z0-9_-]+$/i.test(descriptor.id)) {
        collector.error(localize("requireidstring", "property `{0}` is mandatory and must be of type `string` with non-empty value. Only alphanumeric characters, '_', and '-' are allowed.", "id"));
        return false;
      }
      if (typeof descriptor.title !== "string") {
        collector.error(localize("requirestring", "property `{0}` is mandatory and must be of type `string`", "title"));
        return false;
      }
      if (typeof descriptor.icon !== "string") {
        collector.error(localize("requirestring", "property `{0}` is mandatory and must be of type `string`", "icon"));
        return false;
      }
      if (isFalsyOrWhitespace(descriptor.title)) {
        collector.warn(localize("requirenonemptystring", "property `{0}` is mandatory and must be of type `string` with non-empty value", "title"));
        return true;
      }
    }
    return true;
  }
  registerCustomViewContainers(containers, extension, order, existingViewContainers, location) {
    containers.forEach((descriptor) => {
      const themeIcon = ThemeIcon.fromString(descriptor.icon);
      const icon = themeIcon || resources.joinPath(extension.extensionLocation, descriptor.icon);
      const id = `workbench.view.extension.${descriptor.id}`;
      const title = descriptor.title || id;
      const viewContainer = this.registerCustomViewContainer(id, title, icon, order++, extension.identifier, location);
      if (existingViewContainers.length) {
        const viewsToMove = [];
        for (const existingViewContainer of existingViewContainers) {
          if (viewContainer !== existingViewContainer) {
            viewsToMove.push(...this.viewsRegistry.getViews(existingViewContainer).filter((view) => view.originalContainerId === descriptor.id));
          }
        }
        if (viewsToMove.length) {
          this.viewsRegistry.moveViews(viewsToMove, viewContainer);
        }
      }
    });
    return order;
  }
  registerCustomViewContainer(id, title, icon, order, extensionId, location) {
    let viewContainer = this.viewContainersRegistry.get(id);
    if (!viewContainer) {
      viewContainer = this.viewContainersRegistry.registerViewContainer({
        id,
        title: { value: title, original: title },
        extensionId,
        ctorDescriptor: new SyncDescriptor(
          ViewPaneContainer,
          [id, { mergeViewWithContainerWhenSingleView: true }]
        ),
        hideIfEmpty: true,
        order,
        icon
      }, location);
    }
    return viewContainer;
  }
  deregisterCustomViewContainer(viewContainer) {
    this.viewContainersRegistry.deregisterViewContainer(viewContainer);
    Registry.as(ViewletExtensions.Viewlets).deregisterPaneComposite(viewContainer.id);
  }
  handleAndRegisterCustomViews() {
    viewsExtensionPoint.setHandler((extensions, { added, removed }) => {
      if (removed.length) {
        this.removeViews(removed);
      }
      if (added.length) {
        this.addViews(added);
      }
    });
  }
  addViews(extensions) {
    const viewIds = /* @__PURE__ */ new Set();
    const allViewDescriptors = [];
    for (const extension of extensions) {
      const { value, collector } = extension;
      Object.entries(value).forEach(([key, value2]) => {
        if (!this.isValidViewDescriptors(value2, collector)) {
          return;
        }
        if (key === "remote" && !isProposedApiEnabled(extension.description, "contribViewsRemote")) {
          collector.warn(localize("ViewContainerRequiresProposedAPI", `View container '{0}' requires 'enabledApiProposals: ["contribViewsRemote"]' to be added to 'Remote'.`, key));
          return;
        }
        const viewContainer = this.getViewContainer(key);
        if (!viewContainer) {
          collector.warn(localize("ViewContainerDoesnotExist", "View container '{0}' does not exist and all views registered to it will be added to 'Explorer'.", key));
        }
        const container = viewContainer || this.getDefaultViewContainer();
        const viewDescriptors = [];
        for (let index = 0; index < value2.length; index++) {
          const item = value2[index];
          if (viewIds.has(item.id)) {
            collector.error(localize("duplicateView1", "Cannot register multiple views with same id `{0}`", item.id));
            continue;
          }
          if (this.viewsRegistry.getView(item.id) !== null) {
            collector.error(localize("duplicateView2", "A view with id `{0}` is already registered.", item.id));
            continue;
          }
          const order = ExtensionIdentifier.equals(extension.description.identifier, container.extensionId) ? index + 1 : container.viewOrderDelegate ? container.viewOrderDelegate.getOrder(item.group) : void 0;
          let icon;
          if (typeof item.icon === "string") {
            icon = ThemeIcon.fromString(item.icon) || resources.joinPath(extension.description.extensionLocation, item.icon);
          }
          const initialVisibility = this.convertInitialVisibility(item.visibility);
          const type = this.getViewType(item.type);
          if (!type) {
            collector.error(localize("unknownViewType", "Unknown view type `{0}`.", item.type));
            continue;
          }
          let weight = void 0;
          if (typeof item.initialSize === "number") {
            if (container.extensionId?.value === extension.description.identifier.value) {
              weight = item.initialSize;
            } else {
              this.logService.warn(`${extension.description.identifier.value} tried to set the view size of ${item.id} but it was ignored because the view container does not belong to it.`);
            }
          }
          let accessibilityHelpContent;
          if (isProposedApiEnabled(extension.description, "contribAccessibilityHelpContent") && item.accessibilityHelpContent) {
            accessibilityHelpContent = new MarkdownString(item.accessibilityHelpContent);
          }
          const viewDescriptor2 = {
            type,
            ctorDescriptor: type === "tree" /* Tree */ ? new SyncDescriptor(TreeViewPane) : new SyncDescriptor(WebviewViewPane),
            id: item.id,
            name: { value: item.name, original: item.name },
            when: ContextKeyExpr.deserialize(item.when),
            containerIcon: icon || viewContainer?.icon,
            containerTitle: item.contextualTitle || viewContainer && (typeof viewContainer.title === "string" ? viewContainer.title : viewContainer.title.value),
            canToggleVisibility: true,
            canMoveView: viewContainer?.id !== REMOTE,
            treeView: type === "tree" /* Tree */ ? this.instantiationService.createInstance(CustomTreeView, item.id, item.name, extension.description.identifier.value) : void 0,
            collapsed: this.showCollapsed(container) || initialVisibility === "collapsed" /* Collapsed */,
            order,
            extensionId: extension.description.identifier,
            originalContainerId: key,
            group: item.group,
            remoteAuthority: item.remoteName || item.remoteAuthority,
            // TODO@roblou - delete after remote extensions are updated
            virtualWorkspace: item.virtualWorkspace,
            hideByDefault: initialVisibility === "hidden" /* Hidden */,
            workspace: viewContainer?.id === REMOTE ? true : void 0,
            weight,
            accessibilityHelpContent
          };
          viewIds.add(viewDescriptor2.id);
          viewDescriptors.push(viewDescriptor2);
        }
        allViewDescriptors.push({ viewContainer: container, views: viewDescriptors });
      });
    }
    this.viewsRegistry.registerViews2(allViewDescriptors);
  }
  getViewType(type) {
    if (type === "webview" /* Webview */) {
      return "webview" /* Webview */;
    }
    if (!type || type === "tree" /* Tree */) {
      return "tree" /* Tree */;
    }
    return void 0;
  }
  getDefaultViewContainer() {
    return this.viewContainersRegistry.get(EXPLORER);
  }
  removeViews(extensions) {
    const removedExtensions = extensions.reduce((result, e) => {
      result.add(e.description.identifier);
      return result;
    }, new ExtensionIdentifierSet());
    for (const viewContainer of this.viewContainersRegistry.all) {
      const removedViews = this.viewsRegistry.getViews(viewContainer).filter((v) => v.extensionId && removedExtensions.has(v.extensionId));
      if (removedViews.length) {
        this.viewsRegistry.deregisterViews(removedViews, viewContainer);
        for (const view of removedViews) {
          const anyView = view;
          if (anyView.treeView) {
            anyView.treeView.dispose();
          }
        }
      }
    }
  }
  convertInitialVisibility(value) {
    if (Object.values(InitialVisibility).includes(value)) {
      return value;
    }
    return void 0;
  }
  isValidViewDescriptors(viewDescriptors, collector) {
    if (!Array.isArray(viewDescriptors)) {
      collector.error(localize("requirearray", "views must be an array"));
      return false;
    }
    for (const descriptor of viewDescriptors) {
      if (typeof descriptor.id !== "string") {
        collector.error(localize("requirestring", "property `{0}` is mandatory and must be of type `string`", "id"));
        return false;
      }
      if (typeof descriptor.name !== "string") {
        collector.error(localize("requirestring", "property `{0}` is mandatory and must be of type `string`", "name"));
        return false;
      }
      if (descriptor.when && typeof descriptor.when !== "string") {
        collector.error(localize("optstring", "property `{0}` can be omitted or must be of type `string`", "when"));
        return false;
      }
      if (descriptor.icon && typeof descriptor.icon !== "string") {
        collector.error(localize("optstring", "property `{0}` can be omitted or must be of type `string`", "icon"));
        return false;
      }
      if (descriptor.contextualTitle && typeof descriptor.contextualTitle !== "string") {
        collector.error(localize("optstring", "property `{0}` can be omitted or must be of type `string`", "contextualTitle"));
        return false;
      }
      if (descriptor.visibility && !this.convertInitialVisibility(descriptor.visibility)) {
        collector.error(localize("optenum", "property `{0}` can be omitted or must be one of {1}", "visibility", Object.values(InitialVisibility).join(", ")));
        return false;
      }
    }
    return true;
  }
  getViewContainer(value) {
    switch (value) {
      case "explorer":
        return this.viewContainersRegistry.get(EXPLORER);
      case "debug":
        return this.viewContainersRegistry.get(DEBUG);
      case "scm":
        return this.viewContainersRegistry.get(SCM);
      case "remote":
        return this.viewContainersRegistry.get(REMOTE);
      default:
        return this.viewContainersRegistry.get(`workbench.view.extension.${value}`);
    }
  }
  showCollapsed(container) {
    switch (container.id) {
      case EXPLORER:
      case SCM:
      case DEBUG:
        return true;
    }
    return false;
  }
};
ViewsExtensionHandler.ID = "workbench.contrib.viewsExtensionHandler";
ViewsExtensionHandler = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ILogService)
], ViewsExtensionHandler);
class ViewContainersDataRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.viewsContainers;
  }
  render(manifest) {
    const contrib = manifest.contributes?.viewsContainers || {};
    const viewContainers = Object.keys(contrib).reduce((result, location) => {
      const viewContainersForLocation = contrib[location];
      result.push(...viewContainersForLocation.map((viewContainer) => ({ ...viewContainer, location })));
      return result;
    }, []);
    if (!viewContainers.length) {
      return { data: { headers: [], rows: [] }, dispose: () => {
      } };
    }
    const headers = [
      localize("view container id", "ID"),
      localize("view container title", "Title"),
      localize("view container location", "Where")
    ];
    const rows = viewContainers.sort((a, b) => a.id.localeCompare(b.id)).map((viewContainer) => {
      return [
        viewContainer.id,
        viewContainer.title,
        viewContainer.location
      ];
    });
    return {
      data: {
        headers,
        rows
      },
      dispose: () => {
      }
    };
  }
}
class ViewsDataRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.views;
  }
  render(manifest) {
    const contrib = manifest.contributes?.views || {};
    const views = Object.keys(contrib).reduce((result, location) => {
      const viewsForLocation = contrib[location];
      result.push(...viewsForLocation.map((view) => ({ ...view, location })));
      return result;
    }, []);
    if (!views.length) {
      return { data: { headers: [], rows: [] }, dispose: () => {
      } };
    }
    const headers = [
      localize("view id", "ID"),
      localize("view name title", "Name"),
      localize("view container location", "Where")
    ];
    const rows = views.sort((a, b) => a.id.localeCompare(b.id)).map((view) => {
      return [
        view.id,
        view.name,
        view.location
      ];
    });
    return {
      data: {
        headers,
        rows
      },
      dispose: () => {
      }
    };
  }
}
Registry.as(ExtensionFeaturesRegistryExtensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "viewsContainers",
  label: localize("viewsContainers", "View Containers"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(ViewContainersDataRenderer)
});
Registry.as(ExtensionFeaturesRegistryExtensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "views",
  label: localize("views", "Views"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(ViewsDataRenderer)
});
registerWorkbenchContribution2(ViewsExtensionHandler.ID, ViewsExtensionHandler, WorkbenchPhase.BlockStartup);
export {
  viewsContainersContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvdmlld3NFeHRlbnNpb25Qb2ludC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElKU09OU2NoZW1hIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vanNvblNjaGVtYS5qcyc7XG5pbXBvcnQgKiBhcyByZXNvdXJjZXMgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGlzRmFsc3lPcldoaXRlc3BhY2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciwgRXh0ZW5zaW9uSWRlbnRpZmllclNldCwgSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBJRXh0ZW5zaW9uTWFuaWZlc3QgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucyBhcyBWaWV3bGV0RXh0ZW5zaW9ucywgUGFuZUNvbXBvc2l0ZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9wYW5lY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IEN1c3RvbVRyZWVWaWV3LCBUcmVlVmlld1BhbmUgfSBmcm9tICcuLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3RyZWVWaWV3LmpzJztcbmltcG9ydCB7IFZpZXdQYW5lQ29udGFpbmVyIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZUNvbnRhaW5lci5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZSwgcmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucyBhcyBWaWV3Q29udGFpbmVyRXh0ZW5zaW9ucywgSUN1c3RvbVZpZXdEZXNjcmlwdG9yLCBJVmlld0NvbnRhaW5lcnNSZWdpc3RyeSwgSVZpZXdEZXNjcmlwdG9yLCBJVmlld3NSZWdpc3RyeSwgVmlld0NvbnRhaW5lciwgVmlld0NvbnRhaW5lckxvY2F0aW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IFZJRVdMRVRfSUQgYXMgREVCVUcgfSBmcm9tICcuLi8uLi9jb250cmliL2RlYnVnL2NvbW1vbi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBWSUVXTEVUX0lEIGFzIEVYUExPUkVSIH0gZnJvbSAnLi4vLi4vY29udHJpYi9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgVklFV0xFVF9JRCBhcyBSRU1PVEUgfSBmcm9tICcuLi8uLi9jb250cmliL3JlbW90ZS9icm93c2VyL3JlbW90ZUV4cGxvcmVyLmpzJztcbmltcG9ydCB7IFZJRVdMRVRfSUQgYXMgU0NNIH0gZnJvbSAnLi4vLi4vY29udHJpYi9zY20vY29tbW9uL3NjbS5qcyc7XG5pbXBvcnQgeyBXZWJ2aWV3Vmlld1BhbmUgfSBmcm9tICcuLi8uLi9jb250cmliL3dlYnZpZXdWaWV3L2Jyb3dzZXIvd2Vidmlld1ZpZXdQYW5lLmpzJztcbmltcG9ydCB7IGlzUHJvcG9zZWRBcGlFbmFibGVkIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25NZXNzYWdlQ29sbGVjdG9yLCBFeHRlbnNpb25zUmVnaXN0cnksIElFeHRlbnNpb25Qb2ludCwgSUV4dGVuc2lvblBvaW50VXNlciB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25GZWF0dXJlVGFibGVSZW5kZXJlciwgSVJlbmRlcmVkRGF0YSwgSVRhYmxlRGF0YSwgSVJvd0RhdGEsIElFeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIEV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnlFeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJVXNlckZyaWVuZGx5Vmlld3NDb250YWluZXJEZXNjcmlwdG9yIHtcblx0aWQ6IHN0cmluZztcblx0dGl0bGU6IHN0cmluZztcblx0aWNvbjogc3RyaW5nO1xufVxuXG5jb25zdCB2aWV3c0NvbnRhaW5lclNjaGVtYTogSUpTT05TY2hlbWEgPSB7XG5cdHR5cGU6ICdvYmplY3QnLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0aWQ6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSh7IGtleTogJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMudmlld3MuY29udGFpbmVycy5pZCcsIGNvbW1lbnQ6IFsnQ29udHJpYnV0aW9uIHJlZmVycyB0byB0aG9zZSB0aGF0IGFuIGV4dGVuc2lvbiBjb250cmlidXRlcyB0byBWUyBDb2RlIHRocm91Z2ggYW4gZXh0ZW5zaW9uL2NvbnRyaWJ1dGlvbiBwb2ludC4gJ10gfSwgXCJVbmlxdWUgaWQgdXNlZCB0byBpZGVudGlmeSB0aGUgY29udGFpbmVyIGluIHdoaWNoIHZpZXdzIGNhbiBiZSBjb250cmlidXRlZCB1c2luZyAndmlld3MnIGNvbnRyaWJ1dGlvbiBwb2ludFwiKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0cGF0dGVybjogJ15bYS16QS1aMC05Xy1dKyQnXG5cdFx0fSxcblx0XHR0aXRsZToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnZpZXdzLmNvbnRhaW5lcnMudGl0bGUnLCAnSHVtYW4gcmVhZGFibGUgc3RyaW5nIHVzZWQgdG8gcmVuZGVyIHRoZSBjb250YWluZXInKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0fSxcblx0XHRpY29uOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMudmlld3MuY29udGFpbmVycy5pY29uJywgXCJQYXRoIHRvIHRoZSBjb250YWluZXIgaWNvbi4gSWNvbnMgYXJlIDI0eDI0IGNlbnRlcmVkIG9uIGEgNTB4NDAgYmxvY2sgYW5kIGhhdmUgYSBmaWxsIGNvbG9yIG9mICdyZ2IoMjE1LCAyMTgsIDIyNCknIG9yICcjZDdkYWUwJy4gSXQgaXMgcmVjb21tZW5kZWQgdGhhdCBpY29ucyBiZSBpbiBTVkcsIHRob3VnaCBhbnkgaW1hZ2UgZmlsZSB0eXBlIGlzIGFjY2VwdGVkLlwiKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0fVxuXHR9LFxuXHRyZXF1aXJlZDogWydpZCcsICd0aXRsZScsICdpY29uJ11cbn07XG5cbmV4cG9ydCBjb25zdCB2aWV3c0NvbnRhaW5lcnNDb250cmlidXRpb246IElKU09OU2NoZW1hID0ge1xuXHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMudmlld3NDb250YWluZXJzJywgJ0NvbnRyaWJ1dGVzIHZpZXdzIGNvbnRhaW5lcnMgdG8gdGhlIGVkaXRvcicpLFxuXHR0eXBlOiAnb2JqZWN0Jyxcblx0cHJvcGVydGllczoge1xuXHRcdCdhY3Rpdml0eWJhcic6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndmlld3MuY29udGFpbmVyLmFjdGl2aXR5YmFyJywgXCJDb250cmlidXRlIHZpZXdzIGNvbnRhaW5lcnMgdG8gQWN0aXZpdHkgQmFyXCIpLFxuXHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdGl0ZW1zOiB2aWV3c0NvbnRhaW5lclNjaGVtYVxuXHRcdH0sXG5cdFx0J3BhbmVsJzoge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2aWV3cy5jb250YWluZXIucGFuZWwnLCBcIkNvbnRyaWJ1dGUgdmlld3MgY29udGFpbmVycyB0byBQYW5lbFwiKSxcblx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRpdGVtczogdmlld3NDb250YWluZXJTY2hlbWFcblx0XHR9XG5cdH0sXG5cdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZVxufTtcblxuZW51bSBWaWV3VHlwZSB7XG5cdFRyZWUgPSAndHJlZScsXG5cdFdlYnZpZXcgPSAnd2Vidmlldydcbn1cblxuXG5pbnRlcmZhY2UgSVVzZXJGcmllbmRseVZpZXdEZXNjcmlwdG9yIHtcblx0dHlwZT86IFZpZXdUeXBlO1xuXG5cdGlkOiBzdHJpbmc7XG5cdG5hbWU6IHN0cmluZztcblx0d2hlbj86IHN0cmluZztcblxuXHRpY29uPzogc3RyaW5nO1xuXHRjb250ZXh0dWFsVGl0bGU/OiBzdHJpbmc7XG5cdHZpc2liaWxpdHk/OiBzdHJpbmc7XG5cblx0aW5pdGlhbFNpemU/OiBudW1iZXI7XG5cblx0Ly8gRnJvbSAncmVtb3RlVmlld0Rlc2NyaXB0b3InIHR5cGVcblx0Z3JvdXA/OiBzdHJpbmc7XG5cdHJlbW90ZU5hbWU/OiBzdHJpbmcgfCBzdHJpbmdbXTtcblx0dmlydHVhbFdvcmtzcGFjZT86IHN0cmluZztcblxuXHRhY2Nlc3NpYmlsaXR5SGVscENvbnRlbnQ/OiBzdHJpbmc7XG59XG5cbmVudW0gSW5pdGlhbFZpc2liaWxpdHkge1xuXHRWaXNpYmxlID0gJ3Zpc2libGUnLFxuXHRIaWRkZW4gPSAnaGlkZGVuJyxcblx0Q29sbGFwc2VkID0gJ2NvbGxhcHNlZCdcbn1cblxuY29uc3Qgdmlld0Rlc2NyaXB0b3I6IElKU09OU2NoZW1hID0ge1xuXHR0eXBlOiAnb2JqZWN0Jyxcblx0cmVxdWlyZWQ6IFsnaWQnLCAnbmFtZScsICdpY29uJ10sXG5cdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogeyBpZDogJyR7MTppZH0nLCBuYW1lOiAnJHsyOm5hbWV9JywgaWNvbjogJyR7MzppY29ufScgfSB9XSxcblx0cHJvcGVydGllczoge1xuXHRcdHR5cGU6IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnZpZXcudHlwZScsIFwiVHlwZSBvZiB0aGUgdmlldy4gVGhpcyBjYW4gZWl0aGVyIGJlIGB0cmVlYCBmb3IgYSB0cmVlIHZpZXcgYmFzZWQgdmlldyBvciBgd2Vidmlld2AgZm9yIGEgd2VidmlldyBiYXNlZCB2aWV3LiBUaGUgZGVmYXVsdCBpcyBgdHJlZWAuXCIpLFxuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbXG5cdFx0XHRcdCd0cmVlJyxcblx0XHRcdFx0J3dlYnZpZXcnLFxuXHRcdFx0XSxcblx0XHRcdG1hcmtkb3duRW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy52aWV3LnRyZWUnLCBcIlRoZSB2aWV3IGlzIGJhY2tlZCBieSBhIGBUcmVlVmlld2AgY3JlYXRlZCBieSBgY3JlYXRlVHJlZVZpZXdgLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMudmlldy53ZWJ2aWV3JywgXCJUaGUgdmlldyBpcyBiYWNrZWQgYnkgYSBgV2Vidmlld1ZpZXdgIHJlZ2lzdGVyZWQgYnkgYHJlZ2lzdGVyV2Vidmlld1ZpZXdQcm92aWRlcmAuXCIpLFxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0aWQ6IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnZpZXcuaWQnLCAnSWRlbnRpZmllciBvZiB0aGUgdmlldy4gVGhpcyBzaG91bGQgYmUgdW5pcXVlIGFjcm9zcyBhbGwgdmlld3MuIEl0IGlzIHJlY29tbWVuZGVkIHRvIGluY2x1ZGUgeW91ciBleHRlbnNpb24gaWQgYXMgcGFydCBvZiB0aGUgdmlldyBpZC4gVXNlIHRoaXMgdG8gcmVnaXN0ZXIgYSBkYXRhIHByb3ZpZGVyIHRocm91Z2ggYHZzY29kZS53aW5kb3cucmVnaXN0ZXJUcmVlRGF0YVByb3ZpZGVyRm9yVmlld2AgQVBJLiBBbHNvIHRvIHRyaWdnZXIgYWN0aXZhdGluZyB5b3VyIGV4dGVuc2lvbiBieSByZWdpc3RlcmluZyBgb25WaWV3OiR7aWR9YCBldmVudCB0byBgYWN0aXZhdGlvbkV2ZW50c2AuJyksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdH0sXG5cdFx0bmFtZToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnZpZXcubmFtZScsICdUaGUgaHVtYW4tcmVhZGFibGUgbmFtZSBvZiB0aGUgdmlldy4gV2lsbCBiZSBzaG93bicpLFxuXHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHR9LFxuXHRcdHdoZW46IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy52aWV3LndoZW4nLCAnQ29uZGl0aW9uIHdoaWNoIG11c3QgYmUgdHJ1ZSB0byBzaG93IHRoaXMgdmlldycpLFxuXHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHR9LFxuXHRcdGljb246IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy52aWV3Lmljb24nLCBcIlBhdGggdG8gdGhlIHZpZXcgaWNvbi4gVmlldyBpY29ucyBhcmUgZGlzcGxheWVkIHdoZW4gdGhlIG5hbWUgb2YgdGhlIHZpZXcgY2Fubm90IGJlIHNob3duLiBJdCBpcyByZWNvbW1lbmRlZCB0aGF0IGljb25zIGJlIGluIFNWRywgdGhvdWdoIGFueSBpbWFnZSBmaWxlIHR5cGUgaXMgYWNjZXB0ZWQuXCIpLFxuXHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHR9LFxuXHRcdGNvbnRleHR1YWxUaXRsZToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnZpZXcuY29udGV4dHVhbFRpdGxlJywgXCJIdW1hbi1yZWFkYWJsZSBjb250ZXh0IGZvciB3aGVuIHRoZSB2aWV3IGlzIG1vdmVkIG91dCBvZiBpdHMgb3JpZ2luYWwgbG9jYXRpb24uIEJ5IGRlZmF1bHQsIHRoZSB2aWV3J3MgY29udGFpbmVyIG5hbWUgd2lsbCBiZSB1c2VkLlwiKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0fSxcblx0XHR2aXNpYmlsaXR5OiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMudmlldy5pbml0aWFsU3RhdGUnLCBcIkluaXRpYWwgc3RhdGUgb2YgdGhlIHZpZXcgd2hlbiB0aGUgZXh0ZW5zaW9uIGlzIGZpcnN0IGluc3RhbGxlZC4gT25jZSB0aGUgdXNlciBoYXMgY2hhbmdlZCB0aGUgdmlldyBzdGF0ZSBieSBjb2xsYXBzaW5nLCBtb3ZpbmcsIG9yIGhpZGluZyB0aGUgdmlldywgdGhlIGluaXRpYWwgc3RhdGUgd2lsbCBub3QgYmUgdXNlZCBhZ2Fpbi5cIiksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFtcblx0XHRcdFx0J3Zpc2libGUnLFxuXHRcdFx0XHQnaGlkZGVuJyxcblx0XHRcdFx0J2NvbGxhcHNlZCdcblx0XHRcdF0sXG5cdFx0XHRkZWZhdWx0OiAndmlzaWJsZScsXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnZpZXcuaW5pdGlhbFN0YXRlLnZpc2libGUnLCBcIlRoZSBkZWZhdWx0IGluaXRpYWwgc3RhdGUgZm9yIHRoZSB2aWV3LiBJbiBtb3N0IGNvbnRhaW5lcnMgdGhlIHZpZXcgd2lsbCBiZSBleHBhbmRlZCwgaG93ZXZlcjsgc29tZSBidWlsdC1pbiBjb250YWluZXJzIChleHBsb3Jlciwgc2NtLCBhbmQgZGVidWcpIHNob3cgYWxsIGNvbnRyaWJ1dGVkIHZpZXdzIGNvbGxhcHNlZCByZWdhcmRsZXNzIG9mIHRoZSBgdmlzaWJpbGl0eWAuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy52aWV3LmluaXRpYWxTdGF0ZS5oaWRkZW4nLCBcIlRoZSB2aWV3IHdpbGwgbm90IGJlIHNob3duIGluIHRoZSB2aWV3IGNvbnRhaW5lciwgYnV0IHdpbGwgYmUgZGlzY292ZXJhYmxlIHRocm91Z2ggdGhlIHZpZXdzIG1lbnUgYW5kIG90aGVyIHZpZXcgZW50cnkgcG9pbnRzIGFuZCBjYW4gYmUgdW4taGlkZGVuIGJ5IHRoZSB1c2VyLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMudmlldy5pbml0aWFsU3RhdGUuY29sbGFwc2VkJywgXCJUaGUgdmlldyB3aWxsIHNob3cgaW4gdGhlIHZpZXcgY29udGFpbmVyLCBidXQgd2lsbCBiZSBjb2xsYXBzZWQuXCIpXG5cdFx0XHRdXG5cdFx0fSxcblx0XHRpbml0aWFsU2l6ZToge1xuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0cy52aWV3LnNpemUnLCBcIlRoZSBpbml0aWFsIHNpemUgb2YgdGhlIHZpZXcuIFRoZSBzaXplIHdpbGwgYmVoYXZlIGxpa2UgdGhlIGNzcyAnZmxleCcgcHJvcGVydHksIGFuZCB3aWxsIHNldCB0aGUgaW5pdGlhbCBzaXplIHdoZW4gdGhlIHZpZXcgaXMgZmlyc3Qgc2hvd24uIEluIHRoZSBzaWRlIGJhciwgdGhpcyBpcyB0aGUgaGVpZ2h0IG9mIHRoZSB2aWV3LiBUaGlzIHZhbHVlIGlzIG9ubHkgcmVzcGVjdGVkIHdoZW4gdGhlIHNhbWUgZXh0ZW5zaW9uIG93bnMgYm90aCB0aGUgdmlldyBhbmQgdGhlIHZpZXcgY29udGFpbmVyLlwiKSxcblx0XHR9LFxuXHRcdGFjY2Vzc2liaWxpdHlIZWxwQ29udGVudDoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy52aWV3LmFjY2Vzc2liaWxpdHlIZWxwQ29udGVudCcsIFwiV2hlbiB0aGUgYWNjZXNzaWJpbGl0eSBoZWxwIGRpYWxvZyBpcyBpbnZva2VkIGluIHRoaXMgdmlldywgdGhpcyBjb250ZW50IHdpbGwgYmUgcHJlc2VudGVkIHRvIHRoZSB1c2VyIGFzIGEgbWFya2Rvd24gc3RyaW5nLiBLZXliaW5kaW5ncyB3aWxsIGJlIHJlc29sdmVkIHdoZW4gcHJvdmlkZWQgaW4gdGhlIGZvcm1hdCBvZiA8a2V5YmluZGluZzpjb21tYW5kSWQ+LiBJZiB0aGVyZSBpcyBubyBrZXliaW5kaW5nLCB0aGF0IHdpbGwgYmUgaW5kaWNhdGVkIGFuZCB0aGlzIGNvbW1hbmQgd2lsbCBiZSBpbmNsdWRlZCBpbiBhIHF1aWNrcGljayBmb3IgZWFzeSBjb25maWd1cmF0aW9uLlwiKVxuXHRcdH1cblx0fVxufTtcblxuY29uc3QgcmVtb3RlVmlld0Rlc2NyaXB0b3I6IElKU09OU2NoZW1hID0ge1xuXHR0eXBlOiAnb2JqZWN0Jyxcblx0cmVxdWlyZWQ6IFsnaWQnLCAnbmFtZSddLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0aWQ6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy52aWV3LmlkJywgJ0lkZW50aWZpZXIgb2YgdGhlIHZpZXcuIFRoaXMgc2hvdWxkIGJlIHVuaXF1ZSBhY3Jvc3MgYWxsIHZpZXdzLiBJdCBpcyByZWNvbW1lbmRlZCB0byBpbmNsdWRlIHlvdXIgZXh0ZW5zaW9uIGlkIGFzIHBhcnQgb2YgdGhlIHZpZXcgaWQuIFVzZSB0aGlzIHRvIHJlZ2lzdGVyIGEgZGF0YSBwcm92aWRlciB0aHJvdWdoIGB2c2NvZGUud2luZG93LnJlZ2lzdGVyVHJlZURhdGFQcm92aWRlckZvclZpZXdgIEFQSS4gQWxzbyB0byB0cmlnZ2VyIGFjdGl2YXRpbmcgeW91ciBleHRlbnNpb24gYnkgcmVnaXN0ZXJpbmcgYG9uVmlldzoke2lkfWAgZXZlbnQgdG8gYGFjdGl2YXRpb25FdmVudHNgLicpLFxuXHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHR9LFxuXHRcdG5hbWU6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy52aWV3Lm5hbWUnLCAnVGhlIGh1bWFuLXJlYWRhYmxlIG5hbWUgb2YgdGhlIHZpZXcuIFdpbGwgYmUgc2hvd24nKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0fSxcblx0XHR3aGVuOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMudmlldy53aGVuJywgJ0NvbmRpdGlvbiB3aGljaCBtdXN0IGJlIHRydWUgdG8gc2hvdyB0aGlzIHZpZXcnKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0fSxcblx0XHRncm91cDoge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnZpZXcuZ3JvdXAnLCAnTmVzdGVkIGdyb3VwIGluIHRoZSB2aWV3bGV0JyksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdH0sXG5cdFx0cmVtb3RlTmFtZToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnZpZXcucmVtb3RlTmFtZScsICdUaGUgbmFtZSBvZiB0aGUgcmVtb3RlIHR5cGUgYXNzb2NpYXRlZCB3aXRoIHRoaXMgdmlldycpLFxuXHRcdFx0dHlwZTogWydzdHJpbmcnLCAnYXJyYXknXSxcblx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59O1xuY29uc3Qgdmlld3NDb250cmlidXRpb246IElKU09OU2NoZW1hID0ge1xuXHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMudmlld3MnLCBcIkNvbnRyaWJ1dGVzIHZpZXdzIHRvIHRoZSBlZGl0b3JcIiksXG5cdHR5cGU6ICdvYmplY3QnLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0J2V4cGxvcmVyJzoge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2aWV3cy5leHBsb3JlcicsIFwiQ29udHJpYnV0ZXMgdmlld3MgdG8gRXhwbG9yZXIgY29udGFpbmVyIGluIHRoZSBBY3Rpdml0eSBiYXJcIiksXG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0aXRlbXM6IHZpZXdEZXNjcmlwdG9yLFxuXHRcdFx0ZGVmYXVsdDogW11cblx0XHR9LFxuXHRcdCdkZWJ1Zyc6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndmlld3MuZGVidWcnLCBcIkNvbnRyaWJ1dGVzIHZpZXdzIHRvIERlYnVnIGNvbnRhaW5lciBpbiB0aGUgQWN0aXZpdHkgYmFyXCIpLFxuXHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdGl0ZW1zOiB2aWV3RGVzY3JpcHRvcixcblx0XHRcdGRlZmF1bHQ6IFtdXG5cdFx0fSxcblx0XHQnc2NtJzoge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2aWV3cy5zY20nLCBcIkNvbnRyaWJ1dGVzIHZpZXdzIHRvIFNDTSBjb250YWluZXIgaW4gdGhlIEFjdGl2aXR5IGJhclwiKSxcblx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRpdGVtczogdmlld0Rlc2NyaXB0b3IsXG5cdFx0XHRkZWZhdWx0OiBbXVxuXHRcdH0sXG5cdFx0J3Rlc3QnOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZpZXdzLnRlc3QnLCBcIkNvbnRyaWJ1dGVzIHZpZXdzIHRvIFRlc3QgY29udGFpbmVyIGluIHRoZSBBY3Rpdml0eSBiYXJcIiksXG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0aXRlbXM6IHZpZXdEZXNjcmlwdG9yLFxuXHRcdFx0ZGVmYXVsdDogW11cblx0XHR9LFxuXHRcdCdyZW1vdGUnOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZpZXdzLnJlbW90ZScsIFwiQ29udHJpYnV0ZXMgdmlld3MgdG8gUmVtb3RlIGNvbnRhaW5lciBpbiB0aGUgQWN0aXZpdHkgYmFyLiBUbyBjb250cmlidXRlIHRvIHRoaXMgY29udGFpbmVyLCBlbmFibGVQcm9wb3NlZEFwaSBuZWVkcyB0byBiZSB0dXJuZWQgb25cIiksXG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0aXRlbXM6IHJlbW90ZVZpZXdEZXNjcmlwdG9yLFxuXHRcdFx0ZGVmYXVsdDogW11cblx0XHR9XG5cdH0sXG5cdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2aWV3cy5jb250cmlidXRlZCcsIFwiQ29udHJpYnV0ZXMgdmlld3MgdG8gY29udHJpYnV0ZWQgdmlld3MgY29udGFpbmVyXCIpLFxuXHRcdHR5cGU6ICdhcnJheScsXG5cdFx0aXRlbXM6IHZpZXdEZXNjcmlwdG9yLFxuXHRcdGRlZmF1bHQ6IFtdXG5cdH1cbn07XG5cbnR5cGUgVmlld0NvbnRhaW5lckV4dGVuc2lvblBvaW50VHlwZSA9IHsgW2xvYzogc3RyaW5nXTogSVVzZXJGcmllbmRseVZpZXdzQ29udGFpbmVyRGVzY3JpcHRvcltdIH07XG5jb25zdCB2aWV3c0NvbnRhaW5lcnNFeHRlbnNpb25Qb2ludDogSUV4dGVuc2lvblBvaW50PFZpZXdDb250YWluZXJFeHRlbnNpb25Qb2ludFR5cGU+ID0gRXh0ZW5zaW9uc1JlZ2lzdHJ5LnJlZ2lzdGVyRXh0ZW5zaW9uUG9pbnQ8Vmlld0NvbnRhaW5lckV4dGVuc2lvblBvaW50VHlwZT4oe1xuXHRleHRlbnNpb25Qb2ludDogJ3ZpZXdzQ29udGFpbmVycycsXG5cdGpzb25TY2hlbWE6IHZpZXdzQ29udGFpbmVyc0NvbnRyaWJ1dGlvblxufSk7XG5cbnR5cGUgVmlld0V4dGVuc2lvblBvaW50VHlwZSA9IHsgW2xvYzogc3RyaW5nXTogSVVzZXJGcmllbmRseVZpZXdEZXNjcmlwdG9yW10gfTtcbmNvbnN0IHZpZXdzRXh0ZW5zaW9uUG9pbnQ6IElFeHRlbnNpb25Qb2ludDxWaWV3RXh0ZW5zaW9uUG9pbnRUeXBlPiA9IEV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PFZpZXdFeHRlbnNpb25Qb2ludFR5cGU+KHtcblx0ZXh0ZW5zaW9uUG9pbnQ6ICd2aWV3cycsXG5cdGRlcHM6IFt2aWV3c0NvbnRhaW5lcnNFeHRlbnNpb25Qb2ludF0sXG5cdGpzb25TY2hlbWE6IHZpZXdzQ29udHJpYnV0aW9uLFxuXHRhY3RpdmF0aW9uRXZlbnRzR2VuZXJhdG9yOiAodmlld0V4dGVuc2lvblBvaW50VHlwZUFycmF5LCByZXN1bHQpID0+IHtcblx0XHRmb3IgKGNvbnN0IHZpZXdFeHRlbnNpb25Qb2ludFR5cGUgb2Ygdmlld0V4dGVuc2lvblBvaW50VHlwZUFycmF5KSB7XG5cdFx0XHRmb3IgKGNvbnN0IHZpZXdEZXNjcmlwdG9ycyBvZiBPYmplY3QudmFsdWVzKHZpZXdFeHRlbnNpb25Qb2ludFR5cGUpKSB7XG5cdFx0XHRcdGZvciAoY29uc3Qgdmlld0Rlc2NyaXB0b3Igb2Ygdmlld0Rlc2NyaXB0b3JzKSB7XG5cdFx0XHRcdFx0aWYgKHZpZXdEZXNjcmlwdG9yLmlkKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQucHVzaChgb25WaWV3OiR7dmlld0Rlc2NyaXB0b3IuaWR9YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcblxuY29uc3QgQ1VTVE9NX1ZJRVdTX1NUQVJUX09SREVSID0gNztcblxuY2xhc3MgVmlld3NFeHRlbnNpb25IYW5kbGVyIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLnZpZXdzRXh0ZW5zaW9uSGFuZGxlcic7XG5cblx0cHJpdmF0ZSB2aWV3Q29udGFpbmVyc1JlZ2lzdHJ5OiBJVmlld0NvbnRhaW5lcnNSZWdpc3RyeTtcblx0cHJpdmF0ZSB2aWV3c1JlZ2lzdHJ5OiBJVmlld3NSZWdpc3RyeTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0XHR0aGlzLnZpZXdDb250YWluZXJzUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJVmlld0NvbnRhaW5lcnNSZWdpc3RyeT4oVmlld0NvbnRhaW5lckV4dGVuc2lvbnMuVmlld0NvbnRhaW5lcnNSZWdpc3RyeSk7XG5cdFx0dGhpcy52aWV3c1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVZpZXdzUmVnaXN0cnk+KFZpZXdDb250YWluZXJFeHRlbnNpb25zLlZpZXdzUmVnaXN0cnkpO1xuXHRcdHRoaXMuaGFuZGxlQW5kUmVnaXN0ZXJDdXN0b21WaWV3Q29udGFpbmVycygpO1xuXHRcdHRoaXMuaGFuZGxlQW5kUmVnaXN0ZXJDdXN0b21WaWV3cygpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVBbmRSZWdpc3RlckN1c3RvbVZpZXdDb250YWluZXJzKCkge1xuXHRcdHZpZXdzQ29udGFpbmVyc0V4dGVuc2lvblBvaW50LnNldEhhbmRsZXIoKGV4dGVuc2lvbnMsIHsgYWRkZWQsIHJlbW92ZWQgfSkgPT4ge1xuXHRcdFx0aWYgKHJlbW92ZWQubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMucmVtb3ZlQ3VzdG9tVmlld0NvbnRhaW5lcnMocmVtb3ZlZCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoYWRkZWQubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMuYWRkQ3VzdG9tVmlld0NvbnRhaW5lcnMoYWRkZWQsIHRoaXMudmlld0NvbnRhaW5lcnNSZWdpc3RyeS5hbGwpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRDdXN0b21WaWV3Q29udGFpbmVycyhleHRlbnNpb25Qb2ludHM6IHJlYWRvbmx5IElFeHRlbnNpb25Qb2ludFVzZXI8Vmlld0NvbnRhaW5lckV4dGVuc2lvblBvaW50VHlwZT5bXSwgZXhpc3RpbmdWaWV3Q29udGFpbmVyczogVmlld0NvbnRhaW5lcltdKTogdm9pZCB7XG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lcnNSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElWaWV3Q29udGFpbmVyc1JlZ2lzdHJ5PihWaWV3Q29udGFpbmVyRXh0ZW5zaW9ucy5WaWV3Q29udGFpbmVyc1JlZ2lzdHJ5KTtcblx0XHRsZXQgYWN0aXZpdHlCYXJPcmRlciA9IENVU1RPTV9WSUVXU19TVEFSVF9PUkRFUiArIHZpZXdDb250YWluZXJzUmVnaXN0cnkuYWxsLmZpbHRlcih2ID0+ICEhdi5leHRlbnNpb25JZCAmJiB2aWV3Q29udGFpbmVyc1JlZ2lzdHJ5LmdldFZpZXdDb250YWluZXJMb2NhdGlvbih2KSA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpLmxlbmd0aDtcblx0XHRsZXQgcGFuZWxPcmRlciA9IDUgKyB2aWV3Q29udGFpbmVyc1JlZ2lzdHJ5LmFsbC5maWx0ZXIodiA9PiAhIXYuZXh0ZW5zaW9uSWQgJiYgdmlld0NvbnRhaW5lcnNSZWdpc3RyeS5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24odikgPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCkubGVuZ3RoICsgMTtcblx0XHRmb3IgKGNvbnN0IHsgdmFsdWUsIGNvbGxlY3RvciwgZGVzY3JpcHRpb24gfSBvZiBleHRlbnNpb25Qb2ludHMpIHtcblx0XHRcdE9iamVjdC5lbnRyaWVzKHZhbHVlKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLmlzVmFsaWRWaWV3c0NvbnRhaW5lcih2YWx1ZSwgY29sbGVjdG9yKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzd2l0Y2ggKGtleSkge1xuXHRcdFx0XHRcdGNhc2UgJ2FjdGl2aXR5YmFyJzpcblx0XHRcdFx0XHRcdGFjdGl2aXR5QmFyT3JkZXIgPSB0aGlzLnJlZ2lzdGVyQ3VzdG9tVmlld0NvbnRhaW5lcnModmFsdWUsIGRlc2NyaXB0aW9uLCBhY3Rpdml0eUJhck9yZGVyLCBleGlzdGluZ1ZpZXdDb250YWluZXJzLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICdwYW5lbCc6XG5cdFx0XHRcdFx0XHRwYW5lbE9yZGVyID0gdGhpcy5yZWdpc3RlckN1c3RvbVZpZXdDb250YWluZXJzKHZhbHVlLCBkZXNjcmlwdGlvbiwgcGFuZWxPcmRlciwgZXhpc3RpbmdWaWV3Q29udGFpbmVycywgVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZUN1c3RvbVZpZXdDb250YWluZXJzKGV4dGVuc2lvblBvaW50czogcmVhZG9ubHkgSUV4dGVuc2lvblBvaW50VXNlcjxWaWV3Q29udGFpbmVyRXh0ZW5zaW9uUG9pbnRUeXBlPltdKTogdm9pZCB7XG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lcnNSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElWaWV3Q29udGFpbmVyc1JlZ2lzdHJ5PihWaWV3Q29udGFpbmVyRXh0ZW5zaW9ucy5WaWV3Q29udGFpbmVyc1JlZ2lzdHJ5KTtcblx0XHRjb25zdCByZW1vdmVkRXh0ZW5zaW9uczogRXh0ZW5zaW9uSWRlbnRpZmllclNldCA9IGV4dGVuc2lvblBvaW50cy5yZWR1Y2UoKHJlc3VsdCwgZSkgPT4geyByZXN1bHQuYWRkKGUuZGVzY3JpcHRpb24uaWRlbnRpZmllcik7IHJldHVybiByZXN1bHQ7IH0sIG5ldyBFeHRlbnNpb25JZGVudGlmaWVyU2V0KCkpO1xuXHRcdGZvciAoY29uc3Qgdmlld0NvbnRhaW5lciBvZiB2aWV3Q29udGFpbmVyc1JlZ2lzdHJ5LmFsbCkge1xuXHRcdFx0aWYgKHZpZXdDb250YWluZXIuZXh0ZW5zaW9uSWQgJiYgcmVtb3ZlZEV4dGVuc2lvbnMuaGFzKHZpZXdDb250YWluZXIuZXh0ZW5zaW9uSWQpKSB7XG5cdFx0XHRcdC8vIG1vdmUgYWxsIHZpZXdzIGluIHRoaXMgY29udGFpbmVyIGludG8gZGVmYXVsdCB2aWV3IGNvbnRhaW5lclxuXHRcdFx0XHRjb25zdCB2aWV3cyA9IHRoaXMudmlld3NSZWdpc3RyeS5nZXRWaWV3cyh2aWV3Q29udGFpbmVyKTtcblx0XHRcdFx0aWYgKHZpZXdzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHRoaXMudmlld3NSZWdpc3RyeS5tb3ZlVmlld3Modmlld3MsIHRoaXMuZ2V0RGVmYXVsdFZpZXdDb250YWluZXIoKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5kZXJlZ2lzdGVyQ3VzdG9tVmlld0NvbnRhaW5lcih2aWV3Q29udGFpbmVyKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGlzVmFsaWRWaWV3c0NvbnRhaW5lcih2aWV3c0NvbnRhaW5lcnNEZXNjcmlwdG9yczogSVVzZXJGcmllbmRseVZpZXdzQ29udGFpbmVyRGVzY3JpcHRvcltdLCBjb2xsZWN0b3I6IEV4dGVuc2lvbk1lc3NhZ2VDb2xsZWN0b3IpOiBib29sZWFuIHtcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkodmlld3NDb250YWluZXJzRGVzY3JpcHRvcnMpKSB7XG5cdFx0XHRjb2xsZWN0b3IuZXJyb3IobG9jYWxpemUoJ3ZpZXdjb250YWluZXIgcmVxdWlyZWFycmF5JywgXCJ2aWV3cyBjb250YWluZXJzIG11c3QgYmUgYW4gYXJyYXlcIikpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgZGVzY3JpcHRvciBvZiB2aWV3c0NvbnRhaW5lcnNEZXNjcmlwdG9ycykge1xuXHRcdFx0aWYgKHR5cGVvZiBkZXNjcmlwdG9yLmlkICE9PSAnc3RyaW5nJyAmJiBpc0ZhbHN5T3JXaGl0ZXNwYWNlKGRlc2NyaXB0b3IuaWQpKSB7XG5cdFx0XHRcdGNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgncmVxdWlyZWlkc3RyaW5nJywgXCJwcm9wZXJ0eSBgezB9YCBpcyBtYW5kYXRvcnkgYW5kIG11c3QgYmUgb2YgdHlwZSBgc3RyaW5nYCB3aXRoIG5vbi1lbXB0eSB2YWx1ZS4gT25seSBhbHBoYW51bWVyaWMgY2hhcmFjdGVycywgJ18nLCBhbmQgJy0nIGFyZSBhbGxvd2VkLlwiLCAnaWQnKSk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICghKC9eW2EtejAtOV8tXSskL2kudGVzdChkZXNjcmlwdG9yLmlkKSkpIHtcblx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKGxvY2FsaXplKCdyZXF1aXJlaWRzdHJpbmcnLCBcInByb3BlcnR5IGB7MH1gIGlzIG1hbmRhdG9yeSBhbmQgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdgIHdpdGggbm9uLWVtcHR5IHZhbHVlLiBPbmx5IGFscGhhbnVtZXJpYyBjaGFyYWN0ZXJzLCAnXycsIGFuZCAnLScgYXJlIGFsbG93ZWQuXCIsICdpZCcpKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHR5cGVvZiBkZXNjcmlwdG9yLnRpdGxlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRjb2xsZWN0b3IuZXJyb3IobG9jYWxpemUoJ3JlcXVpcmVzdHJpbmcnLCBcInByb3BlcnR5IGB7MH1gIGlzIG1hbmRhdG9yeSBhbmQgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdgXCIsICd0aXRsZScpKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHR5cGVvZiBkZXNjcmlwdG9yLmljb24gIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgncmVxdWlyZXN0cmluZycsIFwicHJvcGVydHkgYHswfWAgaXMgbWFuZGF0b3J5IGFuZCBtdXN0IGJlIG9mIHR5cGUgYHN0cmluZ2BcIiwgJ2ljb24nKSk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmIChpc0ZhbHN5T3JXaGl0ZXNwYWNlKGRlc2NyaXB0b3IudGl0bGUpKSB7XG5cdFx0XHRcdGNvbGxlY3Rvci53YXJuKGxvY2FsaXplKCdyZXF1aXJlbm9uZW1wdHlzdHJpbmcnLCBcInByb3BlcnR5IGB7MH1gIGlzIG1hbmRhdG9yeSBhbmQgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdgIHdpdGggbm9uLWVtcHR5IHZhbHVlXCIsICd0aXRsZScpKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyQ3VzdG9tVmlld0NvbnRhaW5lcnMoY29udGFpbmVyczogSVVzZXJGcmllbmRseVZpZXdzQ29udGFpbmVyRGVzY3JpcHRvcltdLCBleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgb3JkZXI6IG51bWJlciwgZXhpc3RpbmdWaWV3Q29udGFpbmVyczogVmlld0NvbnRhaW5lcltdLCBsb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uKTogbnVtYmVyIHtcblx0XHRjb250YWluZXJzLmZvckVhY2goZGVzY3JpcHRvciA9PiB7XG5cdFx0XHRjb25zdCB0aGVtZUljb24gPSBUaGVtZUljb24uZnJvbVN0cmluZyhkZXNjcmlwdG9yLmljb24pO1xuXG5cdFx0XHRjb25zdCBpY29uID0gdGhlbWVJY29uIHx8IHJlc291cmNlcy5qb2luUGF0aChleHRlbnNpb24uZXh0ZW5zaW9uTG9jYXRpb24sIGRlc2NyaXB0b3IuaWNvbik7XG5cdFx0XHRjb25zdCBpZCA9IGB3b3JrYmVuY2gudmlldy5leHRlbnNpb24uJHtkZXNjcmlwdG9yLmlkfWA7XG5cdFx0XHRjb25zdCB0aXRsZSA9IGRlc2NyaXB0b3IudGl0bGUgfHwgaWQ7XG5cdFx0XHRjb25zdCB2aWV3Q29udGFpbmVyID0gdGhpcy5yZWdpc3RlckN1c3RvbVZpZXdDb250YWluZXIoaWQsIHRpdGxlLCBpY29uLCBvcmRlcisrLCBleHRlbnNpb24uaWRlbnRpZmllciwgbG9jYXRpb24pO1xuXG5cdFx0XHQvLyBNb3ZlIHRob3NlIHZpZXdzIHRoYXQgYmVsb25ncyB0byB0aGlzIGNvbnRhaW5lclxuXHRcdFx0aWYgKGV4aXN0aW5nVmlld0NvbnRhaW5lcnMubGVuZ3RoKSB7XG5cdFx0XHRcdGNvbnN0IHZpZXdzVG9Nb3ZlOiBJVmlld0Rlc2NyaXB0b3JbXSA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGV4aXN0aW5nVmlld0NvbnRhaW5lciBvZiBleGlzdGluZ1ZpZXdDb250YWluZXJzKSB7XG5cdFx0XHRcdFx0aWYgKHZpZXdDb250YWluZXIgIT09IGV4aXN0aW5nVmlld0NvbnRhaW5lcikge1xuXHRcdFx0XHRcdFx0dmlld3NUb01vdmUucHVzaCguLi50aGlzLnZpZXdzUmVnaXN0cnkuZ2V0Vmlld3MoZXhpc3RpbmdWaWV3Q29udGFpbmVyKS5maWx0ZXIodmlldyA9PiAodmlldyBhcyBJQ3VzdG9tVmlld0Rlc2NyaXB0b3IpLm9yaWdpbmFsQ29udGFpbmVySWQgPT09IGRlc2NyaXB0b3IuaWQpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHZpZXdzVG9Nb3ZlLmxlbmd0aCkge1xuXHRcdFx0XHRcdHRoaXMudmlld3NSZWdpc3RyeS5tb3ZlVmlld3Modmlld3NUb01vdmUsIHZpZXdDb250YWluZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuIG9yZGVyO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckN1c3RvbVZpZXdDb250YWluZXIoaWQ6IHN0cmluZywgdGl0bGU6IHN0cmluZywgaWNvbjogVVJJIHwgVGhlbWVJY29uLCBvcmRlcjogbnVtYmVyLCBleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciB8IHVuZGVmaW5lZCwgbG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbik6IFZpZXdDb250YWluZXIge1xuXHRcdGxldCB2aWV3Q29udGFpbmVyID0gdGhpcy52aWV3Q29udGFpbmVyc1JlZ2lzdHJ5LmdldChpZCk7XG5cblx0XHRpZiAoIXZpZXdDb250YWluZXIpIHtcblxuXHRcdFx0dmlld0NvbnRhaW5lciA9IHRoaXMudmlld0NvbnRhaW5lcnNSZWdpc3RyeS5yZWdpc3RlclZpZXdDb250YWluZXIoe1xuXHRcdFx0XHRpZCxcblx0XHRcdFx0dGl0bGU6IHsgdmFsdWU6IHRpdGxlLCBvcmlnaW5hbDogdGl0bGUgfSxcblx0XHRcdFx0ZXh0ZW5zaW9uSWQsXG5cdFx0XHRcdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoXG5cdFx0XHRcdFx0Vmlld1BhbmVDb250YWluZXIsXG5cdFx0XHRcdFx0W2lkLCB7IG1lcmdlVmlld1dpdGhDb250YWluZXJXaGVuU2luZ2xlVmlldzogdHJ1ZSB9XVxuXHRcdFx0XHQpLFxuXHRcdFx0XHRoaWRlSWZFbXB0eTogdHJ1ZSxcblx0XHRcdFx0b3JkZXIsXG5cdFx0XHRcdGljb24sXG5cdFx0XHR9LCBsb2NhdGlvbik7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gdmlld0NvbnRhaW5lcjtcblx0fVxuXG5cdHByaXZhdGUgZGVyZWdpc3RlckN1c3RvbVZpZXdDb250YWluZXIodmlld0NvbnRhaW5lcjogVmlld0NvbnRhaW5lcik6IHZvaWQge1xuXHRcdHRoaXMudmlld0NvbnRhaW5lcnNSZWdpc3RyeS5kZXJlZ2lzdGVyVmlld0NvbnRhaW5lcih2aWV3Q29udGFpbmVyKTtcblx0XHRSZWdpc3RyeS5hczxQYW5lQ29tcG9zaXRlUmVnaXN0cnk+KFZpZXdsZXRFeHRlbnNpb25zLlZpZXdsZXRzKS5kZXJlZ2lzdGVyUGFuZUNvbXBvc2l0ZSh2aWV3Q29udGFpbmVyLmlkKTtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlQW5kUmVnaXN0ZXJDdXN0b21WaWV3cygpIHtcblx0XHR2aWV3c0V4dGVuc2lvblBvaW50LnNldEhhbmRsZXIoKGV4dGVuc2lvbnMsIHsgYWRkZWQsIHJlbW92ZWQgfSkgPT4ge1xuXHRcdFx0aWYgKHJlbW92ZWQubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMucmVtb3ZlVmlld3MocmVtb3ZlZCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoYWRkZWQubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMuYWRkVmlld3MoYWRkZWQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRWaWV3cyhleHRlbnNpb25zOiByZWFkb25seSBJRXh0ZW5zaW9uUG9pbnRVc2VyPFZpZXdFeHRlbnNpb25Qb2ludFR5cGU+W10pOiB2b2lkIHtcblx0XHRjb25zdCB2aWV3SWRzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdGNvbnN0IGFsbFZpZXdEZXNjcmlwdG9yczogeyB2aWV3czogSVZpZXdEZXNjcmlwdG9yW107IHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIgfVtdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBleHRlbnNpb25zKSB7XG5cdFx0XHRjb25zdCB7IHZhbHVlLCBjb2xsZWN0b3IgfSA9IGV4dGVuc2lvbjtcblxuXHRcdFx0T2JqZWN0LmVudHJpZXModmFsdWUpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuXHRcdFx0XHRpZiAoIXRoaXMuaXNWYWxpZFZpZXdEZXNjcmlwdG9ycyh2YWx1ZSwgY29sbGVjdG9yKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChrZXkgPT09ICdyZW1vdGUnICYmICFpc1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24uZGVzY3JpcHRpb24sICdjb250cmliVmlld3NSZW1vdGUnKSkge1xuXHRcdFx0XHRcdGNvbGxlY3Rvci53YXJuKGxvY2FsaXplKCdWaWV3Q29udGFpbmVyUmVxdWlyZXNQcm9wb3NlZEFQSScsIFwiVmlldyBjb250YWluZXIgJ3swfScgcmVxdWlyZXMgJ2VuYWJsZWRBcGlQcm9wb3NhbHM6IFtcXFwiY29udHJpYlZpZXdzUmVtb3RlXFxcIl0nIHRvIGJlIGFkZGVkIHRvICdSZW1vdGUnLlwiLCBrZXkpKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB2aWV3Q29udGFpbmVyID0gdGhpcy5nZXRWaWV3Q29udGFpbmVyKGtleSk7XG5cdFx0XHRcdGlmICghdmlld0NvbnRhaW5lcikge1xuXHRcdFx0XHRcdGNvbGxlY3Rvci53YXJuKGxvY2FsaXplKCdWaWV3Q29udGFpbmVyRG9lc25vdEV4aXN0JywgXCJWaWV3IGNvbnRhaW5lciAnezB9JyBkb2VzIG5vdCBleGlzdCBhbmQgYWxsIHZpZXdzIHJlZ2lzdGVyZWQgdG8gaXQgd2lsbCBiZSBhZGRlZCB0byAnRXhwbG9yZXInLlwiLCBrZXkpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBjb250YWluZXIgPSB2aWV3Q29udGFpbmVyIHx8IHRoaXMuZ2V0RGVmYXVsdFZpZXdDb250YWluZXIoKTtcblx0XHRcdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3JzOiBJQ3VzdG9tVmlld0Rlc2NyaXB0b3JbXSA9IFtdO1xuXG5cdFx0XHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB2YWx1ZS5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdFx0XHRjb25zdCBpdGVtID0gdmFsdWVbaW5kZXhdO1xuXHRcdFx0XHRcdC8vIHZhbGlkYXRlXG5cdFx0XHRcdFx0aWYgKHZpZXdJZHMuaGFzKGl0ZW0uaWQpKSB7XG5cdFx0XHRcdFx0XHRjb2xsZWN0b3IuZXJyb3IobG9jYWxpemUoJ2R1cGxpY2F0ZVZpZXcxJywgXCJDYW5ub3QgcmVnaXN0ZXIgbXVsdGlwbGUgdmlld3Mgd2l0aCBzYW1lIGlkIGB7MH1gXCIsIGl0ZW0uaWQpKTtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAodGhpcy52aWV3c1JlZ2lzdHJ5LmdldFZpZXcoaXRlbS5pZCkgIT09IG51bGwpIHtcblx0XHRcdFx0XHRcdGNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgnZHVwbGljYXRlVmlldzInLCBcIkEgdmlldyB3aXRoIGlkIGB7MH1gIGlzIGFscmVhZHkgcmVnaXN0ZXJlZC5cIiwgaXRlbS5pZCkpO1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3Qgb3JkZXIgPSBFeHRlbnNpb25JZGVudGlmaWVyLmVxdWFscyhleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllciwgY29udGFpbmVyLmV4dGVuc2lvbklkKVxuXHRcdFx0XHRcdFx0PyBpbmRleCArIDFcblx0XHRcdFx0XHRcdDogY29udGFpbmVyLnZpZXdPcmRlckRlbGVnYXRlXG5cdFx0XHRcdFx0XHRcdD8gY29udGFpbmVyLnZpZXdPcmRlckRlbGVnYXRlLmdldE9yZGVyKGl0ZW0uZ3JvdXApXG5cdFx0XHRcdFx0XHRcdDogdW5kZWZpbmVkO1xuXG5cdFx0XHRcdFx0bGV0IGljb246IFRoZW1lSWNvbiB8IFVSSSB8IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRpZiAodHlwZW9mIGl0ZW0uaWNvbiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdGljb24gPSBUaGVtZUljb24uZnJvbVN0cmluZyhpdGVtLmljb24pIHx8IHJlc291cmNlcy5qb2luUGF0aChleHRlbnNpb24uZGVzY3JpcHRpb24uZXh0ZW5zaW9uTG9jYXRpb24sIGl0ZW0uaWNvbik7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgaW5pdGlhbFZpc2liaWxpdHkgPSB0aGlzLmNvbnZlcnRJbml0aWFsVmlzaWJpbGl0eShpdGVtLnZpc2liaWxpdHkpO1xuXG5cdFx0XHRcdFx0Y29uc3QgdHlwZSA9IHRoaXMuZ2V0Vmlld1R5cGUoaXRlbS50eXBlKTtcblx0XHRcdFx0XHRpZiAoIXR5cGUpIHtcblx0XHRcdFx0XHRcdGNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgndW5rbm93blZpZXdUeXBlJywgXCJVbmtub3duIHZpZXcgdHlwZSBgezB9YC5cIiwgaXRlbS50eXBlKSk7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRsZXQgd2VpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBpdGVtLmluaXRpYWxTaXplID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdFx0aWYgKGNvbnRhaW5lci5leHRlbnNpb25JZD8udmFsdWUgPT09IGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5pZGVudGlmaWVyLnZhbHVlKSB7XG5cdFx0XHRcdFx0XHRcdHdlaWdodCA9IGl0ZW0uaW5pdGlhbFNpemU7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybihgJHtleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZX0gdHJpZWQgdG8gc2V0IHRoZSB2aWV3IHNpemUgb2YgJHtpdGVtLmlkfSBidXQgaXQgd2FzIGlnbm9yZWQgYmVjYXVzZSB0aGUgdmlldyBjb250YWluZXIgZG9lcyBub3QgYmVsb25nIHRvIGl0LmApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGxldCBhY2Nlc3NpYmlsaXR5SGVscENvbnRlbnQ7XG5cdFx0XHRcdFx0aWYgKGlzUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbi5kZXNjcmlwdGlvbiwgJ2NvbnRyaWJBY2Nlc3NpYmlsaXR5SGVscENvbnRlbnQnKSAmJiBpdGVtLmFjY2Vzc2liaWxpdHlIZWxwQ29udGVudCkge1xuXHRcdFx0XHRcdFx0YWNjZXNzaWJpbGl0eUhlbHBDb250ZW50ID0gbmV3IE1hcmtkb3duU3RyaW5nKGl0ZW0uYWNjZXNzaWJpbGl0eUhlbHBDb250ZW50KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcjogSUN1c3RvbVZpZXdEZXNjcmlwdG9yID0ge1xuXHRcdFx0XHRcdFx0dHlwZTogdHlwZSxcblx0XHRcdFx0XHRcdGN0b3JEZXNjcmlwdG9yOiB0eXBlID09PSBWaWV3VHlwZS5UcmVlID8gbmV3IFN5bmNEZXNjcmlwdG9yKFRyZWVWaWV3UGFuZSkgOiBuZXcgU3luY0Rlc2NyaXB0b3IoV2Vidmlld1ZpZXdQYW5lKSxcblx0XHRcdFx0XHRcdGlkOiBpdGVtLmlkLFxuXHRcdFx0XHRcdFx0bmFtZTogeyB2YWx1ZTogaXRlbS5uYW1lLCBvcmlnaW5hbDogaXRlbS5uYW1lIH0sXG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZShpdGVtLndoZW4pLFxuXHRcdFx0XHRcdFx0Y29udGFpbmVySWNvbjogaWNvbiB8fCB2aWV3Q29udGFpbmVyPy5pY29uLFxuXHRcdFx0XHRcdFx0Y29udGFpbmVyVGl0bGU6IGl0ZW0uY29udGV4dHVhbFRpdGxlIHx8ICh2aWV3Q29udGFpbmVyICYmICh0eXBlb2Ygdmlld0NvbnRhaW5lci50aXRsZSA9PT0gJ3N0cmluZycgPyB2aWV3Q29udGFpbmVyLnRpdGxlIDogdmlld0NvbnRhaW5lci50aXRsZS52YWx1ZSkpLFxuXHRcdFx0XHRcdFx0Y2FuVG9nZ2xlVmlzaWJpbGl0eTogdHJ1ZSxcblx0XHRcdFx0XHRcdGNhbk1vdmVWaWV3OiB2aWV3Q29udGFpbmVyPy5pZCAhPT0gUkVNT1RFLFxuXHRcdFx0XHRcdFx0dHJlZVZpZXc6IHR5cGUgPT09IFZpZXdUeXBlLlRyZWUgPyB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEN1c3RvbVRyZWVWaWV3LCBpdGVtLmlkLCBpdGVtLm5hbWUsIGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5pZGVudGlmaWVyLnZhbHVlKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGNvbGxhcHNlZDogdGhpcy5zaG93Q29sbGFwc2VkKGNvbnRhaW5lcikgfHwgaW5pdGlhbFZpc2liaWxpdHkgPT09IEluaXRpYWxWaXNpYmlsaXR5LkNvbGxhcHNlZCxcblx0XHRcdFx0XHRcdG9yZGVyOiBvcmRlcixcblx0XHRcdFx0XHRcdGV4dGVuc2lvbklkOiBleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllcixcblx0XHRcdFx0XHRcdG9yaWdpbmFsQ29udGFpbmVySWQ6IGtleSxcblx0XHRcdFx0XHRcdGdyb3VwOiBpdGVtLmdyb3VwLFxuXHRcdFx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5OiBpdGVtLnJlbW90ZU5hbWUgfHwgKDxhbnk+aXRlbSkucmVtb3RlQXV0aG9yaXR5LCAvLyBUT0RPQHJvYmxvdSAtIGRlbGV0ZSBhZnRlciByZW1vdGUgZXh0ZW5zaW9ucyBhcmUgdXBkYXRlZFxuXHRcdFx0XHRcdFx0dmlydHVhbFdvcmtzcGFjZTogaXRlbS52aXJ0dWFsV29ya3NwYWNlLFxuXHRcdFx0XHRcdFx0aGlkZUJ5RGVmYXVsdDogaW5pdGlhbFZpc2liaWxpdHkgPT09IEluaXRpYWxWaXNpYmlsaXR5LkhpZGRlbixcblx0XHRcdFx0XHRcdHdvcmtzcGFjZTogdmlld0NvbnRhaW5lcj8uaWQgPT09IFJFTU9URSA/IHRydWUgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHR3ZWlnaHQsXG5cdFx0XHRcdFx0XHRhY2Nlc3NpYmlsaXR5SGVscENvbnRlbnRcblx0XHRcdFx0XHR9O1xuXG5cblx0XHRcdFx0XHR2aWV3SWRzLmFkZCh2aWV3RGVzY3JpcHRvci5pZCk7XG5cdFx0XHRcdFx0dmlld0Rlc2NyaXB0b3JzLnB1c2godmlld0Rlc2NyaXB0b3IpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YWxsVmlld0Rlc2NyaXB0b3JzLnB1c2goeyB2aWV3Q29udGFpbmVyOiBjb250YWluZXIsIHZpZXdzOiB2aWV3RGVzY3JpcHRvcnMgfSk7XG5cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHRoaXMudmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzMihhbGxWaWV3RGVzY3JpcHRvcnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRWaWV3VHlwZSh0eXBlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBWaWV3VHlwZSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHR5cGUgPT09IFZpZXdUeXBlLldlYnZpZXcpIHtcblx0XHRcdHJldHVybiBWaWV3VHlwZS5XZWJ2aWV3O1xuXHRcdH1cblx0XHRpZiAoIXR5cGUgfHwgdHlwZSA9PT0gVmlld1R5cGUuVHJlZSkge1xuXHRcdFx0cmV0dXJuIFZpZXdUeXBlLlRyZWU7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGdldERlZmF1bHRWaWV3Q29udGFpbmVyKCk6IFZpZXdDb250YWluZXIge1xuXHRcdHJldHVybiB0aGlzLnZpZXdDb250YWluZXJzUmVnaXN0cnkuZ2V0KEVYUExPUkVSKSE7XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZVZpZXdzKGV4dGVuc2lvbnM6IHJlYWRvbmx5IElFeHRlbnNpb25Qb2ludFVzZXI8Vmlld0V4dGVuc2lvblBvaW50VHlwZT5bXSk6IHZvaWQge1xuXHRcdGNvbnN0IHJlbW92ZWRFeHRlbnNpb25zOiBFeHRlbnNpb25JZGVudGlmaWVyU2V0ID0gZXh0ZW5zaW9ucy5yZWR1Y2UoKHJlc3VsdCwgZSkgPT4geyByZXN1bHQuYWRkKGUuZGVzY3JpcHRpb24uaWRlbnRpZmllcik7IHJldHVybiByZXN1bHQ7IH0sIG5ldyBFeHRlbnNpb25JZGVudGlmaWVyU2V0KCkpO1xuXHRcdGZvciAoY29uc3Qgdmlld0NvbnRhaW5lciBvZiB0aGlzLnZpZXdDb250YWluZXJzUmVnaXN0cnkuYWxsKSB7XG5cdFx0XHRjb25zdCByZW1vdmVkVmlld3MgPSB0aGlzLnZpZXdzUmVnaXN0cnkuZ2V0Vmlld3Modmlld0NvbnRhaW5lcikuZmlsdGVyKHYgPT4gKHYgYXMgSUN1c3RvbVZpZXdEZXNjcmlwdG9yKS5leHRlbnNpb25JZCAmJiByZW1vdmVkRXh0ZW5zaW9ucy5oYXMoKHYgYXMgSUN1c3RvbVZpZXdEZXNjcmlwdG9yKS5leHRlbnNpb25JZCkpO1xuXHRcdFx0aWYgKHJlbW92ZWRWaWV3cy5sZW5ndGgpIHtcblx0XHRcdFx0dGhpcy52aWV3c1JlZ2lzdHJ5LmRlcmVnaXN0ZXJWaWV3cyhyZW1vdmVkVmlld3MsIHZpZXdDb250YWluZXIpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHZpZXcgb2YgcmVtb3ZlZFZpZXdzKSB7XG5cdFx0XHRcdFx0Y29uc3QgYW55VmlldyA9IHZpZXcgYXMgSUN1c3RvbVZpZXdEZXNjcmlwdG9yO1xuXHRcdFx0XHRcdGlmIChhbnlWaWV3LnRyZWVWaWV3KSB7XG5cdFx0XHRcdFx0XHRhbnlWaWV3LnRyZWVWaWV3LmRpc3Bvc2UoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNvbnZlcnRJbml0aWFsVmlzaWJpbGl0eSh2YWx1ZTogYW55KTogSW5pdGlhbFZpc2liaWxpdHkgfCB1bmRlZmluZWQge1xuXHRcdGlmIChPYmplY3QudmFsdWVzKEluaXRpYWxWaXNpYmlsaXR5KS5pbmNsdWRlcyh2YWx1ZSkpIHtcblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgaXNWYWxpZFZpZXdEZXNjcmlwdG9ycyh2aWV3RGVzY3JpcHRvcnM6IElVc2VyRnJpZW5kbHlWaWV3RGVzY3JpcHRvcltdLCBjb2xsZWN0b3I6IEV4dGVuc2lvbk1lc3NhZ2VDb2xsZWN0b3IpOiBib29sZWFuIHtcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkodmlld0Rlc2NyaXB0b3JzKSkge1xuXHRcdFx0Y29sbGVjdG9yLmVycm9yKGxvY2FsaXplKCdyZXF1aXJlYXJyYXknLCBcInZpZXdzIG11c3QgYmUgYW4gYXJyYXlcIikpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgZGVzY3JpcHRvciBvZiB2aWV3RGVzY3JpcHRvcnMpIHtcblx0XHRcdGlmICh0eXBlb2YgZGVzY3JpcHRvci5pZCAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKGxvY2FsaXplKCdyZXF1aXJlc3RyaW5nJywgXCJwcm9wZXJ0eSBgezB9YCBpcyBtYW5kYXRvcnkgYW5kIG11c3QgYmUgb2YgdHlwZSBgc3RyaW5nYFwiLCAnaWQnKSk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICh0eXBlb2YgZGVzY3JpcHRvci5uYW1lICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRjb2xsZWN0b3IuZXJyb3IobG9jYWxpemUoJ3JlcXVpcmVzdHJpbmcnLCBcInByb3BlcnR5IGB7MH1gIGlzIG1hbmRhdG9yeSBhbmQgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdgXCIsICduYW1lJykpO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZGVzY3JpcHRvci53aGVuICYmIHR5cGVvZiBkZXNjcmlwdG9yLndoZW4gIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgnb3B0c3RyaW5nJywgXCJwcm9wZXJ0eSBgezB9YCBjYW4gYmUgb21pdHRlZCBvciBtdXN0IGJlIG9mIHR5cGUgYHN0cmluZ2BcIiwgJ3doZW4nKSk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmIChkZXNjcmlwdG9yLmljb24gJiYgdHlwZW9mIGRlc2NyaXB0b3IuaWNvbiAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKGxvY2FsaXplKCdvcHRzdHJpbmcnLCBcInByb3BlcnR5IGB7MH1gIGNhbiBiZSBvbWl0dGVkIG9yIG11c3QgYmUgb2YgdHlwZSBgc3RyaW5nYFwiLCAnaWNvbicpKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGRlc2NyaXB0b3IuY29udGV4dHVhbFRpdGxlICYmIHR5cGVvZiBkZXNjcmlwdG9yLmNvbnRleHR1YWxUaXRsZSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKGxvY2FsaXplKCdvcHRzdHJpbmcnLCBcInByb3BlcnR5IGB7MH1gIGNhbiBiZSBvbWl0dGVkIG9yIG11c3QgYmUgb2YgdHlwZSBgc3RyaW5nYFwiLCAnY29udGV4dHVhbFRpdGxlJykpO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZGVzY3JpcHRvci52aXNpYmlsaXR5ICYmICF0aGlzLmNvbnZlcnRJbml0aWFsVmlzaWJpbGl0eShkZXNjcmlwdG9yLnZpc2liaWxpdHkpKSB7XG5cdFx0XHRcdGNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgnb3B0ZW51bScsIFwicHJvcGVydHkgYHswfWAgY2FuIGJlIG9taXR0ZWQgb3IgbXVzdCBiZSBvbmUgb2YgezF9XCIsICd2aXNpYmlsaXR5JywgT2JqZWN0LnZhbHVlcyhJbml0aWFsVmlzaWJpbGl0eSkuam9pbignLCAnKSkpO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGdldFZpZXdDb250YWluZXIodmFsdWU6IHN0cmluZyk6IFZpZXdDb250YWluZXIgfCB1bmRlZmluZWQge1xuXHRcdHN3aXRjaCAodmFsdWUpIHtcblx0XHRcdGNhc2UgJ2V4cGxvcmVyJzogcmV0dXJuIHRoaXMudmlld0NvbnRhaW5lcnNSZWdpc3RyeS5nZXQoRVhQTE9SRVIpO1xuXHRcdFx0Y2FzZSAnZGVidWcnOiByZXR1cm4gdGhpcy52aWV3Q29udGFpbmVyc1JlZ2lzdHJ5LmdldChERUJVRyk7XG5cdFx0XHRjYXNlICdzY20nOiByZXR1cm4gdGhpcy52aWV3Q29udGFpbmVyc1JlZ2lzdHJ5LmdldChTQ00pO1xuXHRcdFx0Y2FzZSAncmVtb3RlJzogcmV0dXJuIHRoaXMudmlld0NvbnRhaW5lcnNSZWdpc3RyeS5nZXQoUkVNT1RFKTtcblx0XHRcdGRlZmF1bHQ6IHJldHVybiB0aGlzLnZpZXdDb250YWluZXJzUmVnaXN0cnkuZ2V0KGB3b3JrYmVuY2gudmlldy5leHRlbnNpb24uJHt2YWx1ZX1gKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNob3dDb2xsYXBzZWQoY29udGFpbmVyOiBWaWV3Q29udGFpbmVyKTogYm9vbGVhbiB7XG5cdFx0c3dpdGNoIChjb250YWluZXIuaWQpIHtcblx0XHRcdGNhc2UgRVhQTE9SRVI6XG5cdFx0XHRjYXNlIFNDTTpcblx0XHRcdGNhc2UgREVCVUc6XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuY2xhc3MgVmlld0NvbnRhaW5lcnNEYXRhUmVuZGVyZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUV4dGVuc2lvbkZlYXR1cmVUYWJsZVJlbmRlcmVyIHtcblxuXHRyZWFkb25seSB0eXBlID0gJ3RhYmxlJztcblxuXHRzaG91bGRSZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIW1hbmlmZXN0LmNvbnRyaWJ1dGVzPy52aWV3c0NvbnRhaW5lcnM7XG5cdH1cblxuXHRyZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IElSZW5kZXJlZERhdGE8SVRhYmxlRGF0YT4ge1xuXHRcdGNvbnN0IGNvbnRyaWIgPSBtYW5pZmVzdC5jb250cmlidXRlcz8udmlld3NDb250YWluZXJzIHx8IHt9O1xuXG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lcnMgPSBPYmplY3Qua2V5cyhjb250cmliKS5yZWR1Y2UoKHJlc3VsdCwgbG9jYXRpb24pID0+IHtcblx0XHRcdGNvbnN0IHZpZXdDb250YWluZXJzRm9yTG9jYXRpb24gPSBjb250cmliW2xvY2F0aW9uXTtcblx0XHRcdHJlc3VsdC5wdXNoKC4uLnZpZXdDb250YWluZXJzRm9yTG9jYXRpb24ubWFwKHZpZXdDb250YWluZXIgPT4gKHsgLi4udmlld0NvbnRhaW5lciwgbG9jYXRpb24gfSkpKTtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSwgW10gYXMgQXJyYXk8eyBpZDogc3RyaW5nOyB0aXRsZTogc3RyaW5nOyBsb2NhdGlvbjogc3RyaW5nIH0+KTtcblxuXHRcdGlmICghdmlld0NvbnRhaW5lcnMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4geyBkYXRhOiB7IGhlYWRlcnM6IFtdLCByb3dzOiBbXSB9LCBkaXNwb3NlOiAoKSA9PiB7IH0gfTtcblx0XHR9XG5cblx0XHRjb25zdCBoZWFkZXJzID0gW1xuXHRcdFx0bG9jYWxpemUoJ3ZpZXcgY29udGFpbmVyIGlkJywgXCJJRFwiKSxcblx0XHRcdGxvY2FsaXplKCd2aWV3IGNvbnRhaW5lciB0aXRsZScsIFwiVGl0bGVcIiksXG5cdFx0XHRsb2NhbGl6ZSgndmlldyBjb250YWluZXIgbG9jYXRpb24nLCBcIldoZXJlXCIpLFxuXHRcdF07XG5cblx0XHRjb25zdCByb3dzOiBJUm93RGF0YVtdW10gPSB2aWV3Q29udGFpbmVyc1xuXHRcdFx0LnNvcnQoKGEsIGIpID0+IGEuaWQubG9jYWxlQ29tcGFyZShiLmlkKSlcblx0XHRcdC5tYXAodmlld0NvbnRhaW5lciA9PiB7XG5cdFx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFx0dmlld0NvbnRhaW5lci5pZCxcblx0XHRcdFx0XHR2aWV3Q29udGFpbmVyLnRpdGxlLFxuXHRcdFx0XHRcdHZpZXdDb250YWluZXIubG9jYXRpb25cblx0XHRcdFx0XTtcblx0XHRcdH0pO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGRhdGE6IHtcblx0XHRcdFx0aGVhZGVycyxcblx0XHRcdFx0cm93c1xuXHRcdFx0fSxcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHsgfVxuXHRcdH07XG5cdH1cbn1cblxuY2xhc3MgVmlld3NEYXRhUmVuZGVyZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUV4dGVuc2lvbkZlYXR1cmVUYWJsZVJlbmRlcmVyIHtcblxuXHRyZWFkb25seSB0eXBlID0gJ3RhYmxlJztcblxuXHRzaG91bGRSZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIW1hbmlmZXN0LmNvbnRyaWJ1dGVzPy52aWV3cztcblx0fVxuXG5cdHJlbmRlcihtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0KTogSVJlbmRlcmVkRGF0YTxJVGFibGVEYXRhPiB7XG5cdFx0Y29uc3QgY29udHJpYiA9IG1hbmlmZXN0LmNvbnRyaWJ1dGVzPy52aWV3cyB8fCB7fTtcblxuXHRcdGNvbnN0IHZpZXdzID0gT2JqZWN0LmtleXMoY29udHJpYikucmVkdWNlKChyZXN1bHQsIGxvY2F0aW9uKSA9PiB7XG5cdFx0XHRjb25zdCB2aWV3c0ZvckxvY2F0aW9uID0gY29udHJpYltsb2NhdGlvbl07XG5cdFx0XHRyZXN1bHQucHVzaCguLi52aWV3c0ZvckxvY2F0aW9uLm1hcCh2aWV3ID0+ICh7IC4uLnZpZXcsIGxvY2F0aW9uIH0pKSk7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0sIFtdIGFzIEFycmF5PHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nOyBsb2NhdGlvbjogc3RyaW5nIH0+KTtcblxuXHRcdGlmICghdmlld3MubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4geyBkYXRhOiB7IGhlYWRlcnM6IFtdLCByb3dzOiBbXSB9LCBkaXNwb3NlOiAoKSA9PiB7IH0gfTtcblx0XHR9XG5cblx0XHRjb25zdCBoZWFkZXJzID0gW1xuXHRcdFx0bG9jYWxpemUoJ3ZpZXcgaWQnLCBcIklEXCIpLFxuXHRcdFx0bG9jYWxpemUoJ3ZpZXcgbmFtZSB0aXRsZScsIFwiTmFtZVwiKSxcblx0XHRcdGxvY2FsaXplKCd2aWV3IGNvbnRhaW5lciBsb2NhdGlvbicsIFwiV2hlcmVcIiksXG5cdFx0XTtcblxuXHRcdGNvbnN0IHJvd3M6IElSb3dEYXRhW11bXSA9IHZpZXdzXG5cdFx0XHQuc29ydCgoYSwgYikgPT4gYS5pZC5sb2NhbGVDb21wYXJlKGIuaWQpKVxuXHRcdFx0Lm1hcCh2aWV3ID0+IHtcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHR2aWV3LmlkLFxuXHRcdFx0XHRcdHZpZXcubmFtZSxcblx0XHRcdFx0XHR2aWV3LmxvY2F0aW9uXG5cdFx0XHRcdF07XG5cdFx0XHR9KTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRkYXRhOiB7XG5cdFx0XHRcdGhlYWRlcnMsXG5cdFx0XHRcdHJvd3Ncblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7IH1cblx0XHR9O1xuXHR9XG59XG5cblJlZ2lzdHJ5LmFzPElFeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5PihFeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5RXh0ZW5zaW9ucy5FeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5KS5yZWdpc3RlckV4dGVuc2lvbkZlYXR1cmUoe1xuXHRpZDogJ3ZpZXdzQ29udGFpbmVycycsXG5cdGxhYmVsOiBsb2NhbGl6ZSgndmlld3NDb250YWluZXJzJywgXCJWaWV3IENvbnRhaW5lcnNcIiksXG5cdGFjY2Vzczoge1xuXHRcdGNhblRvZ2dsZTogZmFsc2Vcblx0fSxcblx0cmVuZGVyZXI6IG5ldyBTeW5jRGVzY3JpcHRvcihWaWV3Q29udGFpbmVyc0RhdGFSZW5kZXJlciksXG59KTtcblxuUmVnaXN0cnkuYXM8SUV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnk+KEV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnlFeHRlbnNpb25zLkV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnkpLnJlZ2lzdGVyRXh0ZW5zaW9uRmVhdHVyZSh7XG5cdGlkOiAndmlld3MnLFxuXHRsYWJlbDogbG9jYWxpemUoJ3ZpZXdzJywgXCJWaWV3c1wiKSxcblx0YWNjZXNzOiB7XG5cdFx0Y2FuVG9nZ2xlOiBmYWxzZVxuXHR9LFxuXHRyZW5kZXJlcjogbmV3IFN5bmNEZXNjcmlwdG9yKFZpZXdzRGF0YVJlbmRlcmVyKSxcbn0pO1xuXG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoVmlld3NFeHRlbnNpb25IYW5kbGVyLklELCBWaWV3c0V4dGVuc2lvbkhhbmRsZXIsIFdvcmtiZW5jaFBoYXNlLkJsb2NrU3RhcnR1cCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFlBQVksZUFBZTtBQUMzQixTQUFTLDJCQUEyQjtBQUVwQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHFCQUFxQiw4QkFBeUU7QUFDdkcsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxjQUFjLHlCQUFnRDtBQUN2RSxTQUFTLGdCQUFnQixvQkFBb0I7QUFDN0MsU0FBUyx5QkFBeUI7QUFDbEMsU0FBaUMsZ0JBQWdCLHNDQUFzQztBQUN2RixTQUFTLGNBQWMseUJBQXlILDZCQUE2QjtBQUM3SyxTQUFTLGNBQWMsYUFBYTtBQUNwQyxTQUFTLGNBQWMsZ0JBQWdCO0FBQ3ZDLFNBQVMsY0FBYyxjQUFjO0FBQ3JDLFNBQVMsY0FBYyxXQUFXO0FBQ2xDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQW9DLDBCQUFnRTtBQUNwRyxTQUFTLG1CQUFtQjtBQUM1QixTQUEwRyxjQUFjLDJDQUEyQztBQUNuSyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHNCQUFzQjtBQVEvQixNQUFNLHVCQUFvQztBQUFBLEVBQ3pDLE1BQU07QUFBQSxFQUNOLFlBQVk7QUFBQSxJQUNYLElBQUk7QUFBQSxNQUNILGFBQWEsU0FBUyxFQUFFLEtBQUssb0RBQW9ELFNBQVMsQ0FBQyxpSEFBaUgsRUFBRSxHQUFHLDZHQUE2RztBQUFBLE1BQzlULE1BQU07QUFBQSxNQUNOLFNBQVM7QUFBQSxJQUNWO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTixhQUFhLFNBQVMsdURBQXVELG9EQUFvRDtBQUFBLE1BQ2pJLE1BQU07QUFBQSxJQUNQO0FBQUEsSUFDQSxNQUFNO0FBQUEsTUFDTCxhQUFhLFNBQVMsc0RBQXNELG1OQUFtTjtBQUFBLE1BQy9SLE1BQU07QUFBQSxJQUNQO0FBQUEsRUFDRDtBQUFBLEVBQ0EsVUFBVSxDQUFDLE1BQU0sU0FBUyxNQUFNO0FBQ2pDO0FBRU8sTUFBTSw4QkFBMkM7QUFBQSxFQUN2RCxhQUFhLFNBQVMsZ0RBQWdELDRDQUE0QztBQUFBLEVBQ2xILE1BQU07QUFBQSxFQUNOLFlBQVk7QUFBQSxJQUNYLGVBQWU7QUFBQSxNQUNkLGFBQWEsU0FBUywrQkFBK0IsNkNBQTZDO0FBQUEsTUFDbEcsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLElBQ1I7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNSLGFBQWEsU0FBUyx5QkFBeUIsc0NBQXNDO0FBQUEsTUFDckYsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLElBQ1I7QUFBQSxFQUNEO0FBQUEsRUFDQSxzQkFBc0I7QUFDdkI7QUFFQSxJQUFLLFdBQUwsa0JBQUtBLGNBQUw7QUFDQyxFQUFBQSxVQUFBLFVBQU87QUFDUCxFQUFBQSxVQUFBLGFBQVU7QUFGTixTQUFBQTtBQUFBLEdBQUE7QUEyQkwsSUFBSyxvQkFBTCxrQkFBS0MsdUJBQUw7QUFDQyxFQUFBQSxtQkFBQSxhQUFVO0FBQ1YsRUFBQUEsbUJBQUEsWUFBUztBQUNULEVBQUFBLG1CQUFBLGVBQVk7QUFIUixTQUFBQTtBQUFBLEdBQUE7QUFNTCxNQUFNLGlCQUE4QjtBQUFBLEVBQ25DLE1BQU07QUFBQSxFQUNOLFVBQVUsQ0FBQyxNQUFNLFFBQVEsTUFBTTtBQUFBLEVBQy9CLGlCQUFpQixDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksV0FBVyxNQUFNLGFBQWEsTUFBTSxZQUFZLEVBQUUsQ0FBQztBQUFBLEVBQ25GLFlBQVk7QUFBQSxJQUNYLE1BQU07QUFBQSxNQUNMLHFCQUFxQixTQUFTLDBDQUEwQyxzSUFBc0k7QUFBQSxNQUM5TSxNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsUUFDTDtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSwwQkFBMEI7QUFBQSxRQUN6QixTQUFTLDBDQUEwQyxpRUFBaUU7QUFBQSxRQUNwSCxTQUFTLDZDQUE2QyxvRkFBb0Y7QUFBQSxNQUMzSTtBQUFBLElBQ0Q7QUFBQSxJQUNBLElBQUk7QUFBQSxNQUNILHFCQUFxQixTQUFTLHdDQUF3QywrVUFBK1U7QUFBQSxNQUNyWixNQUFNO0FBQUEsSUFDUDtBQUFBLElBQ0EsTUFBTTtBQUFBLE1BQ0wsYUFBYSxTQUFTLDBDQUEwQyxvREFBb0Q7QUFBQSxNQUNwSCxNQUFNO0FBQUEsSUFDUDtBQUFBLElBQ0EsTUFBTTtBQUFBLE1BQ0wsYUFBYSxTQUFTLDBDQUEwQyxnREFBZ0Q7QUFBQSxNQUNoSCxNQUFNO0FBQUEsSUFDUDtBQUFBLElBQ0EsTUFBTTtBQUFBLE1BQ0wsYUFBYSxTQUFTLDBDQUEwQyw0S0FBNEs7QUFBQSxNQUM1TyxNQUFNO0FBQUEsSUFDUDtBQUFBLElBQ0EsaUJBQWlCO0FBQUEsTUFDaEIsYUFBYSxTQUFTLHFEQUFxRCxxSUFBcUk7QUFBQSxNQUNoTixNQUFNO0FBQUEsSUFDUDtBQUFBLElBQ0EsWUFBWTtBQUFBLE1BQ1gsYUFBYSxTQUFTLGtEQUFrRCxnTUFBZ007QUFBQSxNQUN4USxNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsUUFDTDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsU0FBUztBQUFBLE1BQ1Qsa0JBQWtCO0FBQUEsUUFDakIsU0FBUywwREFBMEQseU5BQXlOO0FBQUEsUUFDNVIsU0FBUyx5REFBeUQsaUtBQWlLO0FBQUEsUUFDbk8sU0FBUyw0REFBNEQsa0VBQWtFO0FBQUEsTUFDeEk7QUFBQSxJQUNEO0FBQUEsSUFDQSxhQUFhO0FBQUEsTUFDWixNQUFNO0FBQUEsTUFDTixhQUFhLFNBQVMseUNBQXlDLCtSQUErUjtBQUFBLElBQy9WO0FBQUEsSUFDQSwwQkFBMEI7QUFBQSxNQUN6QixNQUFNO0FBQUEsTUFDTixxQkFBcUIsU0FBUyw4REFBOEQsNlVBQTZVO0FBQUEsSUFDMWE7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxNQUFNLHVCQUFvQztBQUFBLEVBQ3pDLE1BQU07QUFBQSxFQUNOLFVBQVUsQ0FBQyxNQUFNLE1BQU07QUFBQSxFQUN2QixZQUFZO0FBQUEsSUFDWCxJQUFJO0FBQUEsTUFDSCxhQUFhLFNBQVMsd0NBQXdDLCtVQUErVTtBQUFBLE1BQzdZLE1BQU07QUFBQSxJQUNQO0FBQUEsSUFDQSxNQUFNO0FBQUEsTUFDTCxhQUFhLFNBQVMsMENBQTBDLG9EQUFvRDtBQUFBLE1BQ3BILE1BQU07QUFBQSxJQUNQO0FBQUEsSUFDQSxNQUFNO0FBQUEsTUFDTCxhQUFhLFNBQVMsMENBQTBDLGdEQUFnRDtBQUFBLE1BQ2hILE1BQU07QUFBQSxJQUNQO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTixhQUFhLFNBQVMsMkNBQTJDLDZCQUE2QjtBQUFBLE1BQzlGLE1BQU07QUFBQSxJQUNQO0FBQUEsSUFDQSxZQUFZO0FBQUEsTUFDWCxhQUFhLFNBQVMsZ0RBQWdELHVEQUF1RDtBQUFBLE1BQzdILE1BQU0sQ0FBQyxVQUFVLE9BQU87QUFBQSxNQUN4QixPQUFPO0FBQUEsUUFDTixNQUFNO0FBQUEsTUFDUDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7QUFDQSxNQUFNLG9CQUFpQztBQUFBLEVBQ3RDLGFBQWEsU0FBUyxzQ0FBc0MsaUNBQWlDO0FBQUEsRUFDN0YsTUFBTTtBQUFBLEVBQ04sWUFBWTtBQUFBLElBQ1gsWUFBWTtBQUFBLE1BQ1gsYUFBYSxTQUFTLGtCQUFrQiw2REFBNkQ7QUFBQSxNQUNyRyxNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLENBQUM7QUFBQSxJQUNYO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUixhQUFhLFNBQVMsZUFBZSwwREFBMEQ7QUFBQSxNQUMvRixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLENBQUM7QUFBQSxJQUNYO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTixhQUFhLFNBQVMsYUFBYSx3REFBd0Q7QUFBQSxNQUMzRixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLENBQUM7QUFBQSxJQUNYO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDUCxhQUFhLFNBQVMsY0FBYyx5REFBeUQ7QUFBQSxNQUM3RixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLENBQUM7QUFBQSxJQUNYO0FBQUEsSUFDQSxVQUFVO0FBQUEsTUFDVCxhQUFhLFNBQVMsZ0JBQWdCLHFJQUFxSTtBQUFBLE1BQzNLLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLFNBQVMsQ0FBQztBQUFBLElBQ1g7QUFBQSxFQUNEO0FBQUEsRUFDQSxzQkFBc0I7QUFBQSxJQUNyQixhQUFhLFNBQVMscUJBQXFCLGtEQUFrRDtBQUFBLElBQzdGLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFNBQVMsQ0FBQztBQUFBLEVBQ1g7QUFDRDtBQUdBLE1BQU0sZ0NBQWtGLG1CQUFtQix1QkFBd0Q7QUFBQSxFQUNsSyxnQkFBZ0I7QUFBQSxFQUNoQixZQUFZO0FBQ2IsQ0FBQztBQUdELE1BQU0sc0JBQStELG1CQUFtQix1QkFBK0M7QUFBQSxFQUN0SSxnQkFBZ0I7QUFBQSxFQUNoQixNQUFNLENBQUMsNkJBQTZCO0FBQUEsRUFDcEMsWUFBWTtBQUFBLEVBQ1osMkJBQTJCLENBQUMsNkJBQTZCLFdBQVc7QUFDbkUsZUFBVywwQkFBMEIsNkJBQTZCO0FBQ2pFLGlCQUFXLG1CQUFtQixPQUFPLE9BQU8sc0JBQXNCLEdBQUc7QUFDcEUsbUJBQVdDLG1CQUFrQixpQkFBaUI7QUFDN0MsY0FBSUEsZ0JBQWUsSUFBSTtBQUN0QixtQkFBTyxLQUFLLFVBQVVBLGdCQUFlLEVBQUUsRUFBRTtBQUFBLFVBQzFDO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNELENBQUM7QUFFRCxNQUFNLDJCQUEyQjtBQUVqQyxJQUFNLHdCQUFOLE1BQThEO0FBQUEsRUFPN0QsWUFDeUMsc0JBQ1YsWUFDN0I7QUFGdUM7QUFDVjtBQUU5QixTQUFLLHlCQUF5QixTQUFTLEdBQTRCLHdCQUF3QixzQkFBc0I7QUFDakgsU0FBSyxnQkFBZ0IsU0FBUyxHQUFtQix3QkFBd0IsYUFBYTtBQUN0RixTQUFLLHNDQUFzQztBQUMzQyxTQUFLLDZCQUE2QjtBQUFBLEVBQ25DO0FBQUEsRUFFUSx3Q0FBd0M7QUFDL0Msa0NBQThCLFdBQVcsQ0FBQyxZQUFZLEVBQUUsT0FBTyxRQUFRLE1BQU07QUFDNUUsVUFBSSxRQUFRLFFBQVE7QUFDbkIsYUFBSywyQkFBMkIsT0FBTztBQUFBLE1BQ3hDO0FBQ0EsVUFBSSxNQUFNLFFBQVE7QUFDakIsYUFBSyx3QkFBd0IsT0FBTyxLQUFLLHVCQUF1QixHQUFHO0FBQUEsTUFDcEU7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFUSx3QkFBd0IsaUJBQWtGLHdCQUErQztBQUNoSyxVQUFNLHlCQUF5QixTQUFTLEdBQTRCLHdCQUF3QixzQkFBc0I7QUFDbEgsUUFBSSxtQkFBbUIsMkJBQTJCLHVCQUF1QixJQUFJLE9BQU8sT0FBSyxDQUFDLENBQUMsRUFBRSxlQUFlLHVCQUF1Qix5QkFBeUIsQ0FBQyxNQUFNLHNCQUFzQixPQUFPLEVBQUU7QUFDbE0sUUFBSSxhQUFhLElBQUksdUJBQXVCLElBQUksT0FBTyxPQUFLLENBQUMsQ0FBQyxFQUFFLGVBQWUsdUJBQXVCLHlCQUF5QixDQUFDLE1BQU0sc0JBQXNCLEtBQUssRUFBRSxTQUFTO0FBQzVLLGVBQVcsRUFBRSxPQUFPLFdBQVcsWUFBWSxLQUFLLGlCQUFpQjtBQUNoRSxhQUFPLFFBQVEsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDLEtBQUtDLE1BQUssTUFBTTtBQUMvQyxZQUFJLENBQUMsS0FBSyxzQkFBc0JBLFFBQU8sU0FBUyxHQUFHO0FBQ2xEO0FBQUEsUUFDRDtBQUNBLGdCQUFRLEtBQUs7QUFBQSxVQUNaLEtBQUs7QUFDSiwrQkFBbUIsS0FBSyw2QkFBNkJBLFFBQU8sYUFBYSxrQkFBa0Isd0JBQXdCLHNCQUFzQixPQUFPO0FBQ2hKO0FBQUEsVUFDRCxLQUFLO0FBQ0oseUJBQWEsS0FBSyw2QkFBNkJBLFFBQU8sYUFBYSxZQUFZLHdCQUF3QixzQkFBc0IsS0FBSztBQUNsSTtBQUFBLFFBQ0Y7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGO0FBQUEsRUFDRDtBQUFBLEVBRVEsMkJBQTJCLGlCQUF3RjtBQUMxSCxVQUFNLHlCQUF5QixTQUFTLEdBQTRCLHdCQUF3QixzQkFBc0I7QUFDbEgsVUFBTSxvQkFBNEMsZ0JBQWdCLE9BQU8sQ0FBQyxRQUFRLE1BQU07QUFBRSxhQUFPLElBQUksRUFBRSxZQUFZLFVBQVU7QUFBRyxhQUFPO0FBQUEsSUFBUSxHQUFHLElBQUksdUJBQXVCLENBQUM7QUFDOUssZUFBVyxpQkFBaUIsdUJBQXVCLEtBQUs7QUFDdkQsVUFBSSxjQUFjLGVBQWUsa0JBQWtCLElBQUksY0FBYyxXQUFXLEdBQUc7QUFFbEYsY0FBTSxRQUFRLEtBQUssY0FBYyxTQUFTLGFBQWE7QUFDdkQsWUFBSSxNQUFNLFFBQVE7QUFDakIsZUFBSyxjQUFjLFVBQVUsT0FBTyxLQUFLLHdCQUF3QixDQUFDO0FBQUEsUUFDbkU7QUFDQSxhQUFLLDhCQUE4QixhQUFhO0FBQUEsTUFDakQ7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRVEsc0JBQXNCLDRCQUFxRSxXQUErQztBQUNqSixRQUFJLENBQUMsTUFBTSxRQUFRLDBCQUEwQixHQUFHO0FBQy9DLGdCQUFVLE1BQU0sU0FBUyw4QkFBOEIsbUNBQW1DLENBQUM7QUFDM0YsYUFBTztBQUFBLElBQ1I7QUFFQSxlQUFXLGNBQWMsNEJBQTRCO0FBQ3BELFVBQUksT0FBTyxXQUFXLE9BQU8sWUFBWSxvQkFBb0IsV0FBVyxFQUFFLEdBQUc7QUFDNUUsa0JBQVUsTUFBTSxTQUFTLG1CQUFtQiwwSUFBMEksSUFBSSxDQUFDO0FBQzNMLGVBQU87QUFBQSxNQUNSO0FBQ0EsVUFBSSxDQUFFLGlCQUFpQixLQUFLLFdBQVcsRUFBRSxHQUFJO0FBQzVDLGtCQUFVLE1BQU0sU0FBUyxtQkFBbUIsMElBQTBJLElBQUksQ0FBQztBQUMzTCxlQUFPO0FBQUEsTUFDUjtBQUNBLFVBQUksT0FBTyxXQUFXLFVBQVUsVUFBVTtBQUN6QyxrQkFBVSxNQUFNLFNBQVMsaUJBQWlCLDREQUE0RCxPQUFPLENBQUM7QUFDOUcsZUFBTztBQUFBLE1BQ1I7QUFDQSxVQUFJLE9BQU8sV0FBVyxTQUFTLFVBQVU7QUFDeEMsa0JBQVUsTUFBTSxTQUFTLGlCQUFpQiw0REFBNEQsTUFBTSxDQUFDO0FBQzdHLGVBQU87QUFBQSxNQUNSO0FBQ0EsVUFBSSxvQkFBb0IsV0FBVyxLQUFLLEdBQUc7QUFDMUMsa0JBQVUsS0FBSyxTQUFTLHlCQUF5QixpRkFBaUYsT0FBTyxDQUFDO0FBQzFJLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRDtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSw2QkFBNkIsWUFBcUQsV0FBa0MsT0FBZSx3QkFBeUMsVUFBeUM7QUFDNU4sZUFBVyxRQUFRLGdCQUFjO0FBQ2hDLFlBQU0sWUFBWSxVQUFVLFdBQVcsV0FBVyxJQUFJO0FBRXRELFlBQU0sT0FBTyxhQUFhLFVBQVUsU0FBUyxVQUFVLG1CQUFtQixXQUFXLElBQUk7QUFDekYsWUFBTSxLQUFLLDRCQUE0QixXQUFXLEVBQUU7QUFDcEQsWUFBTSxRQUFRLFdBQVcsU0FBUztBQUNsQyxZQUFNLGdCQUFnQixLQUFLLDRCQUE0QixJQUFJLE9BQU8sTUFBTSxTQUFTLFVBQVUsWUFBWSxRQUFRO0FBRy9HLFVBQUksdUJBQXVCLFFBQVE7QUFDbEMsY0FBTSxjQUFpQyxDQUFDO0FBQ3hDLG1CQUFXLHlCQUF5Qix3QkFBd0I7QUFDM0QsY0FBSSxrQkFBa0IsdUJBQXVCO0FBQzVDLHdCQUFZLEtBQUssR0FBRyxLQUFLLGNBQWMsU0FBUyxxQkFBcUIsRUFBRSxPQUFPLFVBQVMsS0FBK0Isd0JBQXdCLFdBQVcsRUFBRSxDQUFDO0FBQUEsVUFDN0o7QUFBQSxRQUNEO0FBQ0EsWUFBSSxZQUFZLFFBQVE7QUFDdkIsZUFBSyxjQUFjLFVBQVUsYUFBYSxhQUFhO0FBQUEsUUFDeEQ7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBQ0QsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLDRCQUE0QixJQUFZLE9BQWUsTUFBdUIsT0FBZSxhQUE4QyxVQUFnRDtBQUNsTSxRQUFJLGdCQUFnQixLQUFLLHVCQUF1QixJQUFJLEVBQUU7QUFFdEQsUUFBSSxDQUFDLGVBQWU7QUFFbkIsc0JBQWdCLEtBQUssdUJBQXVCLHNCQUFzQjtBQUFBLFFBQ2pFO0FBQUEsUUFDQSxPQUFPLEVBQUUsT0FBTyxPQUFPLFVBQVUsTUFBTTtBQUFBLFFBQ3ZDO0FBQUEsUUFDQSxnQkFBZ0IsSUFBSTtBQUFBLFVBQ25CO0FBQUEsVUFDQSxDQUFDLElBQUksRUFBRSxzQ0FBc0MsS0FBSyxDQUFDO0FBQUEsUUFDcEQ7QUFBQSxRQUNBLGFBQWE7QUFBQSxRQUNiO0FBQUEsUUFDQTtBQUFBLE1BQ0QsR0FBRyxRQUFRO0FBQUEsSUFFWjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSw4QkFBOEIsZUFBb0M7QUFDekUsU0FBSyx1QkFBdUIsd0JBQXdCLGFBQWE7QUFDakUsYUFBUyxHQUEwQixrQkFBa0IsUUFBUSxFQUFFLHdCQUF3QixjQUFjLEVBQUU7QUFBQSxFQUN4RztBQUFBLEVBRVEsK0JBQStCO0FBQ3RDLHdCQUFvQixXQUFXLENBQUMsWUFBWSxFQUFFLE9BQU8sUUFBUSxNQUFNO0FBQ2xFLFVBQUksUUFBUSxRQUFRO0FBQ25CLGFBQUssWUFBWSxPQUFPO0FBQUEsTUFDekI7QUFDQSxVQUFJLE1BQU0sUUFBUTtBQUNqQixhQUFLLFNBQVMsS0FBSztBQUFBLE1BQ3BCO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRVEsU0FBUyxZQUEwRTtBQUMxRixVQUFNLFVBQXVCLG9CQUFJLElBQVk7QUFDN0MsVUFBTSxxQkFBbUYsQ0FBQztBQUUxRixlQUFXLGFBQWEsWUFBWTtBQUNuQyxZQUFNLEVBQUUsT0FBTyxVQUFVLElBQUk7QUFFN0IsYUFBTyxRQUFRLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQyxLQUFLQSxNQUFLLE1BQU07QUFDL0MsWUFBSSxDQUFDLEtBQUssdUJBQXVCQSxRQUFPLFNBQVMsR0FBRztBQUNuRDtBQUFBLFFBQ0Q7QUFFQSxZQUFJLFFBQVEsWUFBWSxDQUFDLHFCQUFxQixVQUFVLGFBQWEsb0JBQW9CLEdBQUc7QUFDM0Ysb0JBQVUsS0FBSyxTQUFTLG9DQUFvQyx3R0FBMEcsR0FBRyxDQUFDO0FBQzFLO0FBQUEsUUFDRDtBQUVBLGNBQU0sZ0JBQWdCLEtBQUssaUJBQWlCLEdBQUc7QUFDL0MsWUFBSSxDQUFDLGVBQWU7QUFDbkIsb0JBQVUsS0FBSyxTQUFTLDZCQUE2QixtR0FBbUcsR0FBRyxDQUFDO0FBQUEsUUFDN0o7QUFDQSxjQUFNLFlBQVksaUJBQWlCLEtBQUssd0JBQXdCO0FBQ2hFLGNBQU0sa0JBQTJDLENBQUM7QUFFbEQsaUJBQVMsUUFBUSxHQUFHLFFBQVFBLE9BQU0sUUFBUSxTQUFTO0FBQ2xELGdCQUFNLE9BQU9BLE9BQU0sS0FBSztBQUV4QixjQUFJLFFBQVEsSUFBSSxLQUFLLEVBQUUsR0FBRztBQUN6QixzQkFBVSxNQUFNLFNBQVMsa0JBQWtCLHFEQUFxRCxLQUFLLEVBQUUsQ0FBQztBQUN4RztBQUFBLFVBQ0Q7QUFDQSxjQUFJLEtBQUssY0FBYyxRQUFRLEtBQUssRUFBRSxNQUFNLE1BQU07QUFDakQsc0JBQVUsTUFBTSxTQUFTLGtCQUFrQiwrQ0FBK0MsS0FBSyxFQUFFLENBQUM7QUFDbEc7QUFBQSxVQUNEO0FBRUEsZ0JBQU0sUUFBUSxvQkFBb0IsT0FBTyxVQUFVLFlBQVksWUFBWSxVQUFVLFdBQVcsSUFDN0YsUUFBUSxJQUNSLFVBQVUsb0JBQ1QsVUFBVSxrQkFBa0IsU0FBUyxLQUFLLEtBQUssSUFDL0M7QUFFSixjQUFJO0FBQ0osY0FBSSxPQUFPLEtBQUssU0FBUyxVQUFVO0FBQ2xDLG1CQUFPLFVBQVUsV0FBVyxLQUFLLElBQUksS0FBSyxVQUFVLFNBQVMsVUFBVSxZQUFZLG1CQUFtQixLQUFLLElBQUk7QUFBQSxVQUNoSDtBQUVBLGdCQUFNLG9CQUFvQixLQUFLLHlCQUF5QixLQUFLLFVBQVU7QUFFdkUsZ0JBQU0sT0FBTyxLQUFLLFlBQVksS0FBSyxJQUFJO0FBQ3ZDLGNBQUksQ0FBQyxNQUFNO0FBQ1Ysc0JBQVUsTUFBTSxTQUFTLG1CQUFtQiw0QkFBNEIsS0FBSyxJQUFJLENBQUM7QUFDbEY7QUFBQSxVQUNEO0FBRUEsY0FBSSxTQUE2QjtBQUNqQyxjQUFJLE9BQU8sS0FBSyxnQkFBZ0IsVUFBVTtBQUN6QyxnQkFBSSxVQUFVLGFBQWEsVUFBVSxVQUFVLFlBQVksV0FBVyxPQUFPO0FBQzVFLHVCQUFTLEtBQUs7QUFBQSxZQUNmLE9BQU87QUFDTixtQkFBSyxXQUFXLEtBQUssR0FBRyxVQUFVLFlBQVksV0FBVyxLQUFLLGtDQUFrQyxLQUFLLEVBQUUsdUVBQXVFO0FBQUEsWUFDL0s7QUFBQSxVQUNEO0FBRUEsY0FBSTtBQUNKLGNBQUkscUJBQXFCLFVBQVUsYUFBYSxpQ0FBaUMsS0FBSyxLQUFLLDBCQUEwQjtBQUNwSCx1Q0FBMkIsSUFBSSxlQUFlLEtBQUssd0JBQXdCO0FBQUEsVUFDNUU7QUFFQSxnQkFBTUQsa0JBQXdDO0FBQUEsWUFDN0M7QUFBQSxZQUNBLGdCQUFnQixTQUFTLG9CQUFnQixJQUFJLGVBQWUsWUFBWSxJQUFJLElBQUksZUFBZSxlQUFlO0FBQUEsWUFDOUcsSUFBSSxLQUFLO0FBQUEsWUFDVCxNQUFNLEVBQUUsT0FBTyxLQUFLLE1BQU0sVUFBVSxLQUFLLEtBQUs7QUFBQSxZQUM5QyxNQUFNLGVBQWUsWUFBWSxLQUFLLElBQUk7QUFBQSxZQUMxQyxlQUFlLFFBQVEsZUFBZTtBQUFBLFlBQ3RDLGdCQUFnQixLQUFLLG1CQUFvQixrQkFBa0IsT0FBTyxjQUFjLFVBQVUsV0FBVyxjQUFjLFFBQVEsY0FBYyxNQUFNO0FBQUEsWUFDL0kscUJBQXFCO0FBQUEsWUFDckIsYUFBYSxlQUFlLE9BQU87QUFBQSxZQUNuQyxVQUFVLFNBQVMsb0JBQWdCLEtBQUsscUJBQXFCLGVBQWUsZ0JBQWdCLEtBQUssSUFBSSxLQUFLLE1BQU0sVUFBVSxZQUFZLFdBQVcsS0FBSyxJQUFJO0FBQUEsWUFDMUosV0FBVyxLQUFLLGNBQWMsU0FBUyxLQUFLLHNCQUFzQjtBQUFBLFlBQ2xFO0FBQUEsWUFDQSxhQUFhLFVBQVUsWUFBWTtBQUFBLFlBQ25DLHFCQUFxQjtBQUFBLFlBQ3JCLE9BQU8sS0FBSztBQUFBLFlBQ1osaUJBQWlCLEtBQUssY0FBb0IsS0FBTTtBQUFBO0FBQUEsWUFDaEQsa0JBQWtCLEtBQUs7QUFBQSxZQUN2QixlQUFlLHNCQUFzQjtBQUFBLFlBQ3JDLFdBQVcsZUFBZSxPQUFPLFNBQVMsT0FBTztBQUFBLFlBQ2pEO0FBQUEsWUFDQTtBQUFBLFVBQ0Q7QUFHQSxrQkFBUSxJQUFJQSxnQkFBZSxFQUFFO0FBQzdCLDBCQUFnQixLQUFLQSxlQUFjO0FBQUEsUUFDcEM7QUFFQSwyQkFBbUIsS0FBSyxFQUFFLGVBQWUsV0FBVyxPQUFPLGdCQUFnQixDQUFDO0FBQUEsTUFFN0UsQ0FBQztBQUFBLElBQ0Y7QUFFQSxTQUFLLGNBQWMsZUFBZSxrQkFBa0I7QUFBQSxFQUNyRDtBQUFBLEVBRVEsWUFBWSxNQUFnRDtBQUNuRSxRQUFJLFNBQVMseUJBQWtCO0FBQzlCLGFBQU87QUFBQSxJQUNSO0FBQ0EsUUFBSSxDQUFDLFFBQVEsU0FBUyxtQkFBZTtBQUNwQyxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSwwQkFBeUM7QUFDaEQsV0FBTyxLQUFLLHVCQUF1QixJQUFJLFFBQVE7QUFBQSxFQUNoRDtBQUFBLEVBRVEsWUFBWSxZQUEwRTtBQUM3RixVQUFNLG9CQUE0QyxXQUFXLE9BQU8sQ0FBQyxRQUFRLE1BQU07QUFBRSxhQUFPLElBQUksRUFBRSxZQUFZLFVBQVU7QUFBRyxhQUFPO0FBQUEsSUFBUSxHQUFHLElBQUksdUJBQXVCLENBQUM7QUFDekssZUFBVyxpQkFBaUIsS0FBSyx1QkFBdUIsS0FBSztBQUM1RCxZQUFNLGVBQWUsS0FBSyxjQUFjLFNBQVMsYUFBYSxFQUFFLE9BQU8sT0FBTSxFQUE0QixlQUFlLGtCQUFrQixJQUFLLEVBQTRCLFdBQVcsQ0FBQztBQUN2TCxVQUFJLGFBQWEsUUFBUTtBQUN4QixhQUFLLGNBQWMsZ0JBQWdCLGNBQWMsYUFBYTtBQUM5RCxtQkFBVyxRQUFRLGNBQWM7QUFDaEMsZ0JBQU0sVUFBVTtBQUNoQixjQUFJLFFBQVEsVUFBVTtBQUNyQixvQkFBUSxTQUFTLFFBQVE7QUFBQSxVQUMxQjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLHlCQUF5QixPQUEyQztBQUMzRSxRQUFJLE9BQU8sT0FBTyxpQkFBaUIsRUFBRSxTQUFTLEtBQUssR0FBRztBQUNyRCxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSx1QkFBdUIsaUJBQWdELFdBQStDO0FBQzdILFFBQUksQ0FBQyxNQUFNLFFBQVEsZUFBZSxHQUFHO0FBQ3BDLGdCQUFVLE1BQU0sU0FBUyxnQkFBZ0Isd0JBQXdCLENBQUM7QUFDbEUsYUFBTztBQUFBLElBQ1I7QUFFQSxlQUFXLGNBQWMsaUJBQWlCO0FBQ3pDLFVBQUksT0FBTyxXQUFXLE9BQU8sVUFBVTtBQUN0QyxrQkFBVSxNQUFNLFNBQVMsaUJBQWlCLDREQUE0RCxJQUFJLENBQUM7QUFDM0csZUFBTztBQUFBLE1BQ1I7QUFDQSxVQUFJLE9BQU8sV0FBVyxTQUFTLFVBQVU7QUFDeEMsa0JBQVUsTUFBTSxTQUFTLGlCQUFpQiw0REFBNEQsTUFBTSxDQUFDO0FBQzdHLGVBQU87QUFBQSxNQUNSO0FBQ0EsVUFBSSxXQUFXLFFBQVEsT0FBTyxXQUFXLFNBQVMsVUFBVTtBQUMzRCxrQkFBVSxNQUFNLFNBQVMsYUFBYSw2REFBNkQsTUFBTSxDQUFDO0FBQzFHLGVBQU87QUFBQSxNQUNSO0FBQ0EsVUFBSSxXQUFXLFFBQVEsT0FBTyxXQUFXLFNBQVMsVUFBVTtBQUMzRCxrQkFBVSxNQUFNLFNBQVMsYUFBYSw2REFBNkQsTUFBTSxDQUFDO0FBQzFHLGVBQU87QUFBQSxNQUNSO0FBQ0EsVUFBSSxXQUFXLG1CQUFtQixPQUFPLFdBQVcsb0JBQW9CLFVBQVU7QUFDakYsa0JBQVUsTUFBTSxTQUFTLGFBQWEsNkRBQTZELGlCQUFpQixDQUFDO0FBQ3JILGVBQU87QUFBQSxNQUNSO0FBQ0EsVUFBSSxXQUFXLGNBQWMsQ0FBQyxLQUFLLHlCQUF5QixXQUFXLFVBQVUsR0FBRztBQUNuRixrQkFBVSxNQUFNLFNBQVMsV0FBVyx1REFBdUQsY0FBYyxPQUFPLE9BQU8saUJBQWlCLEVBQUUsS0FBSyxJQUFJLENBQUMsQ0FBQztBQUNySixlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsaUJBQWlCLE9BQTBDO0FBQ2xFLFlBQVEsT0FBTztBQUFBLE1BQ2QsS0FBSztBQUFZLGVBQU8sS0FBSyx1QkFBdUIsSUFBSSxRQUFRO0FBQUEsTUFDaEUsS0FBSztBQUFTLGVBQU8sS0FBSyx1QkFBdUIsSUFBSSxLQUFLO0FBQUEsTUFDMUQsS0FBSztBQUFPLGVBQU8sS0FBSyx1QkFBdUIsSUFBSSxHQUFHO0FBQUEsTUFDdEQsS0FBSztBQUFVLGVBQU8sS0FBSyx1QkFBdUIsSUFBSSxNQUFNO0FBQUEsTUFDNUQ7QUFBUyxlQUFPLEtBQUssdUJBQXVCLElBQUksNEJBQTRCLEtBQUssRUFBRTtBQUFBLElBQ3BGO0FBQUEsRUFDRDtBQUFBLEVBRVEsY0FBYyxXQUFtQztBQUN4RCxZQUFRLFVBQVUsSUFBSTtBQUFBLE1BQ3JCLEtBQUs7QUFBQSxNQUNMLEtBQUs7QUFBQSxNQUNMLEtBQUs7QUFDSixlQUFPO0FBQUEsSUFDVDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUF0V00sc0JBRVcsS0FBSztBQUZoQix3QkFBTjtBQUFBLEVBUUc7QUFBQSxFQUNBO0FBQUEsR0FURztBQXdXTixNQUFNLG1DQUFtQyxXQUFxRDtBQUFBLEVBQTlGO0FBQUE7QUFFQyxTQUFTLE9BQU87QUFBQTtBQUFBLEVBRWhCLGFBQWEsVUFBdUM7QUFDbkQsV0FBTyxDQUFDLENBQUMsU0FBUyxhQUFhO0FBQUEsRUFDaEM7QUFBQSxFQUVBLE9BQU8sVUFBeUQ7QUFDL0QsVUFBTSxVQUFVLFNBQVMsYUFBYSxtQkFBbUIsQ0FBQztBQUUxRCxVQUFNLGlCQUFpQixPQUFPLEtBQUssT0FBTyxFQUFFLE9BQU8sQ0FBQyxRQUFRLGFBQWE7QUFDeEUsWUFBTSw0QkFBNEIsUUFBUSxRQUFRO0FBQ2xELGFBQU8sS0FBSyxHQUFHLDBCQUEwQixJQUFJLG9CQUFrQixFQUFFLEdBQUcsZUFBZSxTQUFTLEVBQUUsQ0FBQztBQUMvRixhQUFPO0FBQUEsSUFDUixHQUFHLENBQUMsQ0FBMkQ7QUFFL0QsUUFBSSxDQUFDLGVBQWUsUUFBUTtBQUMzQixhQUFPLEVBQUUsTUFBTSxFQUFFLFNBQVMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxFQUFFLEdBQUcsU0FBUyxNQUFNO0FBQUEsTUFBRSxFQUFFO0FBQUEsSUFDOUQ7QUFFQSxVQUFNLFVBQVU7QUFBQSxNQUNmLFNBQVMscUJBQXFCLElBQUk7QUFBQSxNQUNsQyxTQUFTLHdCQUF3QixPQUFPO0FBQUEsTUFDeEMsU0FBUywyQkFBMkIsT0FBTztBQUFBLElBQzVDO0FBRUEsVUFBTSxPQUFxQixlQUN6QixLQUFLLENBQUMsR0FBRyxNQUFNLEVBQUUsR0FBRyxjQUFjLEVBQUUsRUFBRSxDQUFDLEVBQ3ZDLElBQUksbUJBQWlCO0FBQ3JCLGFBQU87QUFBQSxRQUNOLGNBQWM7QUFBQSxRQUNkLGNBQWM7QUFBQSxRQUNkLGNBQWM7QUFBQSxNQUNmO0FBQUEsSUFDRCxDQUFDO0FBRUYsV0FBTztBQUFBLE1BQ04sTUFBTTtBQUFBLFFBQ0w7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsU0FBUyxNQUFNO0FBQUEsTUFBRTtBQUFBLElBQ2xCO0FBQUEsRUFDRDtBQUNEO0FBRUEsTUFBTSwwQkFBMEIsV0FBcUQ7QUFBQSxFQUFyRjtBQUFBO0FBRUMsU0FBUyxPQUFPO0FBQUE7QUFBQSxFQUVoQixhQUFhLFVBQXVDO0FBQ25ELFdBQU8sQ0FBQyxDQUFDLFNBQVMsYUFBYTtBQUFBLEVBQ2hDO0FBQUEsRUFFQSxPQUFPLFVBQXlEO0FBQy9ELFVBQU0sVUFBVSxTQUFTLGFBQWEsU0FBUyxDQUFDO0FBRWhELFVBQU0sUUFBUSxPQUFPLEtBQUssT0FBTyxFQUFFLE9BQU8sQ0FBQyxRQUFRLGFBQWE7QUFDL0QsWUFBTSxtQkFBbUIsUUFBUSxRQUFRO0FBQ3pDLGFBQU8sS0FBSyxHQUFHLGlCQUFpQixJQUFJLFdBQVMsRUFBRSxHQUFHLE1BQU0sU0FBUyxFQUFFLENBQUM7QUFDcEUsYUFBTztBQUFBLElBQ1IsR0FBRyxDQUFDLENBQTBEO0FBRTlELFFBQUksQ0FBQyxNQUFNLFFBQVE7QUFDbEIsYUFBTyxFQUFFLE1BQU0sRUFBRSxTQUFTLENBQUMsR0FBRyxNQUFNLENBQUMsRUFBRSxHQUFHLFNBQVMsTUFBTTtBQUFBLE1BQUUsRUFBRTtBQUFBLElBQzlEO0FBRUEsVUFBTSxVQUFVO0FBQUEsTUFDZixTQUFTLFdBQVcsSUFBSTtBQUFBLE1BQ3hCLFNBQVMsbUJBQW1CLE1BQU07QUFBQSxNQUNsQyxTQUFTLDJCQUEyQixPQUFPO0FBQUEsSUFDNUM7QUFFQSxVQUFNLE9BQXFCLE1BQ3pCLEtBQUssQ0FBQyxHQUFHLE1BQU0sRUFBRSxHQUFHLGNBQWMsRUFBRSxFQUFFLENBQUMsRUFDdkMsSUFBSSxVQUFRO0FBQ1osYUFBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsS0FBSztBQUFBLFFBQ0wsS0FBSztBQUFBLE1BQ047QUFBQSxJQUNELENBQUM7QUFFRixXQUFPO0FBQUEsTUFDTixNQUFNO0FBQUEsUUFDTDtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxTQUFTLE1BQU07QUFBQSxNQUFFO0FBQUEsSUFDbEI7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxTQUFTLEdBQStCLG9DQUFvQyx5QkFBeUIsRUFBRSx5QkFBeUI7QUFBQSxFQUMvSCxJQUFJO0FBQUEsRUFDSixPQUFPLFNBQVMsbUJBQW1CLGlCQUFpQjtBQUFBLEVBQ3BELFFBQVE7QUFBQSxJQUNQLFdBQVc7QUFBQSxFQUNaO0FBQUEsRUFDQSxVQUFVLElBQUksZUFBZSwwQkFBMEI7QUFDeEQsQ0FBQztBQUVELFNBQVMsR0FBK0Isb0NBQW9DLHlCQUF5QixFQUFFLHlCQUF5QjtBQUFBLEVBQy9ILElBQUk7QUFBQSxFQUNKLE9BQU8sU0FBUyxTQUFTLE9BQU87QUFBQSxFQUNoQyxRQUFRO0FBQUEsSUFDUCxXQUFXO0FBQUEsRUFDWjtBQUFBLEVBQ0EsVUFBVSxJQUFJLGVBQWUsaUJBQWlCO0FBQy9DLENBQUM7QUFFRCwrQkFBK0Isc0JBQXNCLElBQUksdUJBQXVCLGVBQWUsWUFBWTsiLAogICJuYW1lcyI6IFsiVmlld1R5cGUiLCAiSW5pdGlhbFZpc2liaWxpdHkiLCAidmlld0Rlc2NyaXB0b3IiLCAidmFsdWUiXQp9Cg==
