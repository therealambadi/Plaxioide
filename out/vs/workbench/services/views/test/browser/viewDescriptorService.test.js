import * as nls from "../../../../../nls.js";
import assert from "assert";
import { Extensions as ViewContainerExtensions, ViewContainerLocation, ViewContainerLocationToString } from "../../../../common/views.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
import { SyncDescriptor } from "../../../../../platform/instantiation/common/descriptors.js";
import { ViewDescriptorService } from "../../browser/viewDescriptorService.js";
import { assertIsDefined } from "../../../../../base/common/types.js";
import { ContextKeyService } from "../../../../../platform/contextkey/browser/contextKeyService.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { compare } from "../../../../../base/common/strings.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
const ViewsRegistry = Registry.as(ViewContainerExtensions.ViewsRegistry);
const ViewContainersRegistry = Registry.as(ViewContainerExtensions.ViewContainersRegistry);
const viewContainerIdPrefix = "testViewContainer";
const sidebarContainer = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
const panelContainer = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Panel);
suite("ViewDescriptorService", () => {
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  let instantiationService;
  setup(() => {
    disposables.add(instantiationService = workbenchInstantiationService(void 0, disposables));
    instantiationService.stub(IContextKeyService, disposables.add(instantiationService.createInstance(ContextKeyService)));
  });
  teardown(() => {
    for (const viewContainer of ViewContainersRegistry.all) {
      if (viewContainer.id.startsWith(viewContainerIdPrefix)) {
        ViewsRegistry.deregisterViews(ViewsRegistry.getViews(viewContainer), viewContainer);
      }
    }
  });
  function aViewDescriptorService() {
    return disposables.add(instantiationService.createInstance(ViewDescriptorService));
  }
  test("Empty Containers", function() {
    const testObject = aViewDescriptorService();
    const sidebarViews = testObject.getViewContainerModel(sidebarContainer);
    const panelViews = testObject.getViewContainerModel(panelContainer);
    assert.strictEqual(sidebarViews.allViewDescriptors.length, 0, "The sidebar container should have no views yet.");
    assert.strictEqual(panelViews.allViewDescriptors.length, 0, "The panel container should have no views yet.");
  });
  test("Register/Deregister", () => {
    const testObject = aViewDescriptorService();
    const viewDescriptors = [
      {
        id: "view1",
        ctorDescriptor: null,
        name: nls.localize2("Test View 1", "Test View 1"),
        canMoveView: true
      },
      {
        id: "view2",
        ctorDescriptor: null,
        name: nls.localize2("Test View 2", "Test View 2"),
        canMoveView: true
      },
      {
        id: "view3",
        ctorDescriptor: null,
        name: nls.localize2("Test View 3", "Test View 3"),
        canMoveView: true
      }
    ];
    ViewsRegistry.registerViews(viewDescriptors.slice(0, 2), sidebarContainer);
    ViewsRegistry.registerViews(viewDescriptors.slice(2), panelContainer);
    let sidebarViews = testObject.getViewContainerModel(sidebarContainer);
    let panelViews = testObject.getViewContainerModel(panelContainer);
    assert.strictEqual(sidebarViews.activeViewDescriptors.length, 2, "Sidebar should have 2 views");
    assert.strictEqual(panelViews.activeViewDescriptors.length, 1, "Panel should have 1 view");
    ViewsRegistry.deregisterViews(viewDescriptors.slice(0, 2), sidebarContainer);
    ViewsRegistry.deregisterViews(viewDescriptors.slice(2), panelContainer);
    sidebarViews = testObject.getViewContainerModel(sidebarContainer);
    panelViews = testObject.getViewContainerModel(panelContainer);
    assert.strictEqual(sidebarViews.activeViewDescriptors.length, 0, "Sidebar should have no views");
    assert.strictEqual(panelViews.activeViewDescriptors.length, 0, "Panel should have no views");
  });
  test("move views to existing containers", async function() {
    const testObject = aViewDescriptorService();
    const viewDescriptors = [
      {
        id: "view1",
        ctorDescriptor: null,
        name: nls.localize2("Test View 1", "Test View 1"),
        canMoveView: true
      },
      {
        id: "view2",
        ctorDescriptor: null,
        name: nls.localize2("Test View 2", "Test View 2"),
        canMoveView: true
      },
      {
        id: "view3",
        ctorDescriptor: null,
        name: nls.localize2("Test View 3", "Test View 3"),
        canMoveView: true
      }
    ];
    ViewsRegistry.registerViews(viewDescriptors.slice(0, 2), sidebarContainer);
    ViewsRegistry.registerViews(viewDescriptors.slice(2), panelContainer);
    testObject.moveViewsToContainer(viewDescriptors.slice(2), sidebarContainer);
    testObject.moveViewsToContainer(viewDescriptors.slice(0, 2), panelContainer);
    const sidebarViews = testObject.getViewContainerModel(sidebarContainer);
    const panelViews = testObject.getViewContainerModel(panelContainer);
    assert.strictEqual(sidebarViews.activeViewDescriptors.length, 1, "Sidebar should have 2 views");
    assert.strictEqual(panelViews.activeViewDescriptors.length, 2, "Panel should have 1 view");
    assert.notStrictEqual(sidebarViews.activeViewDescriptors.indexOf(viewDescriptors[2]), -1, `Sidebar should have ${viewDescriptors[2].name.value}`);
    assert.notStrictEqual(panelViews.activeViewDescriptors.indexOf(viewDescriptors[0]), -1, `Panel should have ${viewDescriptors[0].name.value}`);
    assert.notStrictEqual(panelViews.activeViewDescriptors.indexOf(viewDescriptors[1]), -1, `Panel should have ${viewDescriptors[1].name.value}`);
  });
  test("move views to generated containers", async function() {
    const testObject = aViewDescriptorService();
    const viewDescriptors = [
      {
        id: "view1",
        ctorDescriptor: null,
        name: nls.localize2("Test View 1", "Test View 1"),
        canMoveView: true
      },
      {
        id: "view2",
        ctorDescriptor: null,
        name: nls.localize2("Test View 2", "Test View 2"),
        canMoveView: true
      },
      {
        id: "view3",
        ctorDescriptor: null,
        name: nls.localize2("Test View 3", "Test View 3"),
        canMoveView: true
      }
    ];
    ViewsRegistry.registerViews(viewDescriptors.slice(0, 2), sidebarContainer);
    ViewsRegistry.registerViews(viewDescriptors.slice(2), panelContainer);
    testObject.moveViewToLocation(viewDescriptors[0], ViewContainerLocation.Panel);
    testObject.moveViewToLocation(viewDescriptors[2], ViewContainerLocation.Sidebar);
    let sidebarViews = testObject.getViewContainerModel(sidebarContainer);
    let panelViews = testObject.getViewContainerModel(panelContainer);
    assert.strictEqual(sidebarViews.activeViewDescriptors.length, 1, "Sidebar container should have 1 view");
    assert.strictEqual(panelViews.activeViewDescriptors.length, 0, "Panel container should have no views");
    const generatedPanel = assertIsDefined(testObject.getViewContainerByViewId(viewDescriptors[0].id));
    const generatedSidebar = assertIsDefined(testObject.getViewContainerByViewId(viewDescriptors[2].id));
    assert.strictEqual(testObject.getViewContainerLocation(generatedPanel), ViewContainerLocation.Panel, "Generated Panel should be in located in the panel");
    assert.strictEqual(testObject.getViewContainerLocation(generatedSidebar), ViewContainerLocation.Sidebar, "Generated Sidebar should be in located in the sidebar");
    assert.strictEqual(testObject.getViewContainerLocation(generatedPanel), testObject.getViewLocationById(viewDescriptors[0].id), "Panel view location and container location should match");
    assert.strictEqual(testObject.getViewContainerLocation(generatedSidebar), testObject.getViewLocationById(viewDescriptors[2].id), "Sidebar view location and container location should match");
    assert.strictEqual(testObject.getDefaultContainerById(viewDescriptors[2].id), panelContainer, `${viewDescriptors[2].name.value} has wrong default container`);
    assert.strictEqual(testObject.getDefaultContainerById(viewDescriptors[0].id), sidebarContainer, `${viewDescriptors[0].name.value} has wrong default container`);
    testObject.moveViewToLocation(viewDescriptors[0], ViewContainerLocation.Sidebar);
    testObject.moveViewToLocation(viewDescriptors[2], ViewContainerLocation.Panel);
    sidebarViews = testObject.getViewContainerModel(sidebarContainer);
    panelViews = testObject.getViewContainerModel(panelContainer);
    assert.strictEqual(sidebarViews.activeViewDescriptors.length, 1, "Sidebar should have 2 views");
    assert.strictEqual(panelViews.activeViewDescriptors.length, 0, "Panel should have 1 view");
    assert.strictEqual(testObject.getViewLocationById(viewDescriptors[0].id), ViewContainerLocation.Sidebar, "View should be located in the sidebar");
    assert.strictEqual(testObject.getViewLocationById(viewDescriptors[2].id), ViewContainerLocation.Panel, "View should be located in the panel");
  });
  test("move view events", async function() {
    const testObject = aViewDescriptorService();
    const viewDescriptors = [
      {
        id: "view1",
        ctorDescriptor: null,
        name: nls.localize2("Test View 1", "Test View 1"),
        canMoveView: true
      },
      {
        id: "view2",
        ctorDescriptor: null,
        name: nls.localize2("Test View 2", "Test View 2"),
        canMoveView: true
      },
      {
        id: "view3",
        ctorDescriptor: null,
        name: nls.localize2("Test View 3", "Test View 3"),
        canMoveView: true
      }
    ];
    let expectedSequence = "";
    let actualSequence = "";
    const containerMoveString = (view, from, to) => {
      return `Moved ${view.id} from ${from.id} to ${to.id}
`;
    };
    const locationMoveString = (view, from, to) => {
      return `Moved ${view.id} from ${from === ViewContainerLocation.Sidebar ? "Sidebar" : "Panel"} to ${to === ViewContainerLocation.Sidebar ? "Sidebar" : "Panel"}
`;
    };
    disposables.add(testObject.onDidChangeContainer(({ views, from, to }) => {
      views.forEach((view) => {
        actualSequence += containerMoveString(view, from, to);
      });
    }));
    disposables.add(testObject.onDidChangeLocation(({ views, from, to }) => {
      views.forEach((view) => {
        actualSequence += locationMoveString(view, from, to);
      });
    }));
    ViewsRegistry.registerViews(viewDescriptors.slice(0, 2), sidebarContainer);
    ViewsRegistry.registerViews(viewDescriptors.slice(2), panelContainer);
    expectedSequence += locationMoveString(viewDescriptors[0], ViewContainerLocation.Sidebar, ViewContainerLocation.Panel);
    testObject.moveViewToLocation(viewDescriptors[0], ViewContainerLocation.Panel);
    expectedSequence += containerMoveString(viewDescriptors[0], sidebarContainer, testObject.getViewContainerByViewId(viewDescriptors[0].id));
    expectedSequence += locationMoveString(viewDescriptors[2], ViewContainerLocation.Panel, ViewContainerLocation.Sidebar);
    testObject.moveViewToLocation(viewDescriptors[2], ViewContainerLocation.Sidebar);
    expectedSequence += containerMoveString(viewDescriptors[2], panelContainer, testObject.getViewContainerByViewId(viewDescriptors[2].id));
    expectedSequence += locationMoveString(viewDescriptors[0], ViewContainerLocation.Panel, ViewContainerLocation.Sidebar);
    expectedSequence += containerMoveString(viewDescriptors[0], testObject.getViewContainerByViewId(viewDescriptors[0].id), sidebarContainer);
    testObject.moveViewsToContainer([viewDescriptors[0]], sidebarContainer);
    expectedSequence += locationMoveString(viewDescriptors[2], ViewContainerLocation.Sidebar, ViewContainerLocation.Panel);
    expectedSequence += containerMoveString(viewDescriptors[2], testObject.getViewContainerByViewId(viewDescriptors[2].id), panelContainer);
    testObject.moveViewsToContainer([viewDescriptors[2]], panelContainer);
    expectedSequence += locationMoveString(viewDescriptors[0], ViewContainerLocation.Sidebar, ViewContainerLocation.Panel);
    expectedSequence += containerMoveString(viewDescriptors[0], sidebarContainer, panelContainer);
    testObject.moveViewsToContainer([viewDescriptors[0]], panelContainer);
    expectedSequence += locationMoveString(viewDescriptors[2], ViewContainerLocation.Panel, ViewContainerLocation.Sidebar);
    expectedSequence += containerMoveString(viewDescriptors[2], panelContainer, sidebarContainer);
    testObject.moveViewsToContainer([viewDescriptors[2]], sidebarContainer);
    expectedSequence += locationMoveString(viewDescriptors[1], ViewContainerLocation.Sidebar, ViewContainerLocation.Panel);
    expectedSequence += locationMoveString(viewDescriptors[2], ViewContainerLocation.Sidebar, ViewContainerLocation.Panel);
    expectedSequence += containerMoveString(viewDescriptors[1], sidebarContainer, panelContainer);
    expectedSequence += containerMoveString(viewDescriptors[2], sidebarContainer, panelContainer);
    testObject.moveViewsToContainer([viewDescriptors[1], viewDescriptors[2]], panelContainer);
    assert.strictEqual(actualSequence, expectedSequence, "Event sequence not matching expected sequence");
  });
  test("reset", async function() {
    const testObject = aViewDescriptorService();
    const viewDescriptors = [
      {
        id: "view1",
        ctorDescriptor: null,
        name: nls.localize2("Test View 1", "Test View 1"),
        canMoveView: true,
        order: 1
      },
      {
        id: "view2",
        ctorDescriptor: null,
        name: nls.localize2("Test View 2", "Test View 2"),
        canMoveView: true,
        order: 2
      },
      {
        id: "view3",
        ctorDescriptor: null,
        name: nls.localize2("Test View 3", "Test View 3"),
        canMoveView: true,
        order: 3
      }
    ];
    ViewsRegistry.registerViews(viewDescriptors.slice(0, 2), sidebarContainer);
    ViewsRegistry.registerViews(viewDescriptors.slice(2), panelContainer);
    testObject.moveViewToLocation(viewDescriptors[0], ViewContainerLocation.Panel);
    testObject.moveViewsToContainer([viewDescriptors[1]], panelContainer);
    testObject.moveViewToLocation(viewDescriptors[2], ViewContainerLocation.Sidebar);
    const generatedPanel = assertIsDefined(testObject.getViewContainerByViewId(viewDescriptors[0].id));
    const generatedSidebar = assertIsDefined(testObject.getViewContainerByViewId(viewDescriptors[2].id));
    testObject.reset();
    const sidebarViews = testObject.getViewContainerModel(sidebarContainer);
    assert.deepStrictEqual(sidebarViews.allViewDescriptors.map((v) => v.id), ["view1", "view2"]);
    const panelViews = testObject.getViewContainerModel(panelContainer);
    assert.deepStrictEqual(panelViews.allViewDescriptors.map((v) => v.id), ["view3"]);
    const actual = JSON.parse(instantiationService.get(IStorageService).get("views.customizations", StorageScope.PROFILE));
    assert.deepStrictEqual(actual, { viewContainerLocations: {}, viewLocations: {}, viewContainerBadgeEnablementStates: {} });
    assert.deepStrictEqual(testObject.getViewContainerById(generatedPanel.id), null);
    assert.deepStrictEqual(testObject.getViewContainerById(generatedSidebar.id), null);
  });
  test("initialize with custom locations", async function() {
    const storageService = instantiationService.get(IStorageService);
    const viewContainer1 = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const generateViewContainer1 = `workbench.views.service.${ViewContainerLocationToString(ViewContainerLocation.Sidebar)}.${generateUuid()}`;
    const viewsCustomizations = {
      viewContainerLocations: {
        [generateViewContainer1]: ViewContainerLocation.Sidebar,
        [viewContainer1.id]: ViewContainerLocation.AuxiliaryBar
      },
      viewLocations: {
        "view1": generateViewContainer1
      }
    };
    storageService.store("views.customizations", JSON.stringify(viewsCustomizations), StorageScope.PROFILE, StorageTarget.USER);
    const viewDescriptors = [
      {
        id: "view1",
        ctorDescriptor: null,
        name: nls.localize2("Test View 1", "Test View 1"),
        canMoveView: true
      },
      {
        id: "view2",
        ctorDescriptor: null,
        name: nls.localize2("Test View 2", "Test View 2"),
        canMoveView: true
      },
      {
        id: "view3",
        ctorDescriptor: null,
        name: nls.localize2("Test View 3", "Test View 3"),
        canMoveView: true
      },
      {
        id: "view4",
        ctorDescriptor: null,
        name: nls.localize2("Test View 4", "Test View 4"),
        canMoveView: true
      }
    ];
    ViewsRegistry.registerViews(viewDescriptors.slice(0, 3), sidebarContainer);
    ViewsRegistry.registerViews(viewDescriptors.slice(3), viewContainer1);
    const testObject = aViewDescriptorService();
    const sidebarViews = testObject.getViewContainerModel(sidebarContainer);
    assert.deepStrictEqual(sidebarViews.allViewDescriptors.map((v) => v.id), ["view2", "view3"]);
    const generatedViewContainerViews = testObject.getViewContainerModel(testObject.getViewContainerById(generateViewContainer1));
    assert.deepStrictEqual(generatedViewContainerViews.allViewDescriptors.map((v) => v.id), ["view1"]);
    const viewContainer1Views = testObject.getViewContainerModel(viewContainer1);
    assert.deepStrictEqual(testObject.getViewContainerLocation(viewContainer1), ViewContainerLocation.AuxiliaryBar);
    assert.deepStrictEqual(viewContainer1Views.allViewDescriptors.map((v) => v.id), ["view4"]);
  });
  test("storage change", async function() {
    const testObject = aViewDescriptorService();
    const viewContainer1 = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const generateViewContainer1 = `workbench.views.service.${ViewContainerLocationToString(ViewContainerLocation.Sidebar)}.${generateUuid()}`;
    const viewDescriptors = [
      {
        id: "view1",
        ctorDescriptor: null,
        name: nls.localize2("Test View 1", "Test View 1"),
        canMoveView: true
      },
      {
        id: "view2",
        ctorDescriptor: null,
        name: nls.localize2("Test View 2", "Test View 2"),
        canMoveView: true
      },
      {
        id: "view3",
        ctorDescriptor: null,
        name: nls.localize2("Test View 3", "Test View 3"),
        canMoveView: true
      },
      {
        id: "view4",
        ctorDescriptor: null,
        name: nls.localize2("Test View 4", "Test View 4"),
        canMoveView: true
      }
    ];
    ViewsRegistry.registerViews(viewDescriptors.slice(0, 3), sidebarContainer);
    ViewsRegistry.registerViews(viewDescriptors.slice(3), viewContainer1);
    const viewsCustomizations = {
      viewContainerLocations: {
        [generateViewContainer1]: ViewContainerLocation.Sidebar,
        [viewContainer1.id]: ViewContainerLocation.AuxiliaryBar
      },
      viewLocations: {
        "view1": generateViewContainer1
      }
    };
    instantiationService.get(IStorageService).store("views.customizations", JSON.stringify(viewsCustomizations), StorageScope.PROFILE, StorageTarget.USER);
    const sidebarViews = testObject.getViewContainerModel(sidebarContainer);
    assert.deepStrictEqual(sidebarViews.allViewDescriptors.map((v) => v.id), ["view2", "view3"]);
    const generatedViewContainerViews = testObject.getViewContainerModel(testObject.getViewContainerById(generateViewContainer1));
    assert.deepStrictEqual(generatedViewContainerViews.allViewDescriptors.map((v) => v.id), ["view1"]);
    const viewContainer1Views = testObject.getViewContainerModel(viewContainer1);
    assert.deepStrictEqual(testObject.getViewContainerLocation(viewContainer1), ViewContainerLocation.AuxiliaryBar);
    assert.deepStrictEqual(viewContainer1Views.allViewDescriptors.map((v) => v.id), ["view4"]);
  });
  test("orphan views", async function() {
    const storageService = instantiationService.get(IStorageService);
    const viewsCustomizations = {
      viewContainerLocations: {},
      viewLocations: {
        "view1": `${viewContainerIdPrefix}-${generateUuid()}`
      }
    };
    storageService.store("views.customizations", JSON.stringify(viewsCustomizations), StorageScope.PROFILE, StorageTarget.USER);
    const viewDescriptors = [
      {
        id: "view1",
        ctorDescriptor: null,
        name: nls.localize2("Test View 1", "Test View 1"),
        canMoveView: true,
        order: 1
      },
      {
        id: "view2",
        ctorDescriptor: null,
        name: nls.localize2("Test View 2", "Test View 2"),
        canMoveView: true,
        order: 2
      },
      {
        id: "view3",
        ctorDescriptor: null,
        name: nls.localize2("Test View 3", "Test View 3"),
        canMoveView: true,
        order: 3
      }
    ];
    ViewsRegistry.registerViews(viewDescriptors, sidebarContainer);
    const testObject = aViewDescriptorService();
    const sidebarViews = testObject.getViewContainerModel(sidebarContainer);
    assert.deepStrictEqual(sidebarViews.allViewDescriptors.map((v) => v.id), ["view2", "view3"]);
    testObject.whenExtensionsRegistered();
    assert.deepStrictEqual(sidebarViews.allViewDescriptors.map((v) => v.id), ["view1", "view2", "view3"]);
  });
  test("orphan view containers", async function() {
    const storageService = instantiationService.get(IStorageService);
    const generatedViewContainerId = `workbench.views.service.${ViewContainerLocationToString(ViewContainerLocation.Sidebar)}.${generateUuid()}`;
    const viewsCustomizations = {
      viewContainerLocations: {
        [generatedViewContainerId]: ViewContainerLocation.Sidebar
      },
      viewLocations: {}
    };
    storageService.store("views.customizations", JSON.stringify(viewsCustomizations), StorageScope.PROFILE, StorageTarget.USER);
    const viewDescriptors = [
      {
        id: "view1",
        ctorDescriptor: null,
        name: nls.localize2("Test View 1", "Test View 1"),
        canMoveView: true,
        order: 1
      }
    ];
    ViewsRegistry.registerViews(viewDescriptors, sidebarContainer);
    const testObject = aViewDescriptorService();
    testObject.whenExtensionsRegistered();
    assert.deepStrictEqual(testObject.getViewContainerById(generatedViewContainerId), null);
    assert.deepStrictEqual(testObject.isViewContainerRemovedPermanently(generatedViewContainerId), true);
    const actual = JSON.parse(storageService.get("views.customizations", StorageScope.PROFILE));
    assert.deepStrictEqual(actual, { viewContainerLocations: {}, viewLocations: {}, viewContainerBadgeEnablementStates: {} });
  });
  test("custom locations take precedence when default view container of views change", async function() {
    const storageService = instantiationService.get(IStorageService);
    const viewContainer1 = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const generateViewContainer1 = `workbench.views.service.${ViewContainerLocationToString(ViewContainerLocation.Sidebar)}.${generateUuid()}`;
    const viewsCustomizations = {
      viewContainerLocations: {
        [generateViewContainer1]: ViewContainerLocation.Sidebar,
        [viewContainer1.id]: ViewContainerLocation.AuxiliaryBar
      },
      viewLocations: {
        "view1": generateViewContainer1
      }
    };
    storageService.store("views.customizations", JSON.stringify(viewsCustomizations), StorageScope.PROFILE, StorageTarget.USER);
    const viewDescriptors = [
      {
        id: "view1",
        ctorDescriptor: null,
        name: nls.localize2("Test View 1", "Test View 1"),
        canMoveView: true
      },
      {
        id: "view2",
        ctorDescriptor: null,
        name: nls.localize2("Test View 2", "Test View 2"),
        canMoveView: true
      },
      {
        id: "view3",
        ctorDescriptor: null,
        name: nls.localize2("Test View 3", "Test View 3"),
        canMoveView: true
      },
      {
        id: "view4",
        ctorDescriptor: null,
        name: nls.localize2("Test View 4", "Test View 4"),
        canMoveView: true
      }
    ];
    ViewsRegistry.registerViews(viewDescriptors.slice(0, 3), sidebarContainer);
    ViewsRegistry.registerViews(viewDescriptors.slice(3), viewContainer1);
    const testObject = aViewDescriptorService();
    ViewsRegistry.moveViews([viewDescriptors[0], viewDescriptors[1]], panelContainer);
    const sidebarViews = testObject.getViewContainerModel(sidebarContainer);
    assert.deepStrictEqual(sidebarViews.allViewDescriptors.map((v) => v.id), ["view3"]);
    const panelViews = testObject.getViewContainerModel(panelContainer);
    assert.deepStrictEqual(panelViews.allViewDescriptors.map((v) => v.id), ["view2"]);
    const generatedViewContainerViews = testObject.getViewContainerModel(testObject.getViewContainerById(generateViewContainer1));
    assert.deepStrictEqual(generatedViewContainerViews.allViewDescriptors.map((v) => v.id), ["view1"]);
    const viewContainer1Views = testObject.getViewContainerModel(viewContainer1);
    assert.deepStrictEqual(testObject.getViewContainerLocation(viewContainer1), ViewContainerLocation.AuxiliaryBar);
    assert.deepStrictEqual(viewContainer1Views.allViewDescriptors.map((v) => v.id), ["view4"]);
  });
  test("view containers with not existing views are not removed from customizations", async function() {
    const storageService = instantiationService.get(IStorageService);
    const viewContainer1 = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const generateViewContainer1 = `workbench.views.service.${ViewContainerLocationToString(ViewContainerLocation.Sidebar)}.${generateUuid()}`;
    const viewsCustomizations = {
      viewContainerLocations: {
        [generateViewContainer1]: ViewContainerLocation.Sidebar,
        [viewContainer1.id]: ViewContainerLocation.AuxiliaryBar
      },
      viewLocations: {
        "view5": generateViewContainer1
      }
    };
    storageService.store("views.customizations", JSON.stringify(viewsCustomizations), StorageScope.PROFILE, StorageTarget.USER);
    const viewDescriptors = [
      {
        id: "view1",
        ctorDescriptor: null,
        name: nls.localize2("Test View 1", "Test View 1"),
        canMoveView: true
      }
    ];
    ViewsRegistry.registerViews(viewDescriptors, viewContainer1);
    const testObject = aViewDescriptorService();
    testObject.whenExtensionsRegistered();
    const viewContainer1Views = testObject.getViewContainerModel(viewContainer1);
    assert.deepStrictEqual(testObject.getViewContainerLocation(viewContainer1), ViewContainerLocation.AuxiliaryBar);
    assert.deepStrictEqual(viewContainer1Views.allViewDescriptors.map((v) => v.id), ["view1"]);
    const actual = JSON.parse(storageService.get("views.customizations", StorageScope.PROFILE));
    assert.deepStrictEqual(actual, viewsCustomizations);
  });
  test("storage change also updates locations even if views do not exists and views are registered later", async function() {
    const storageService = instantiationService.get(IStorageService);
    const testObject = aViewDescriptorService();
    const generateViewContainerId = `workbench.views.service.${ViewContainerLocationToString(ViewContainerLocation.AuxiliaryBar)}.${generateUuid()}`;
    const viewsCustomizations = {
      viewContainerLocations: {
        [generateViewContainerId]: ViewContainerLocation.AuxiliaryBar
      },
      viewLocations: {
        "view1": generateViewContainerId
      }
    };
    storageService.store("views.customizations", JSON.stringify(viewsCustomizations), StorageScope.PROFILE, StorageTarget.USER);
    const viewContainer = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const viewDescriptors = [
      {
        id: "view1",
        ctorDescriptor: null,
        name: nls.localize2("Test View 1", "Test View 1"),
        canMoveView: true
      },
      {
        id: "view2",
        ctorDescriptor: null,
        name: nls.localize2("Test View 2", "Test View 2"),
        canMoveView: true
      }
    ];
    ViewsRegistry.registerViews(viewDescriptors, viewContainer);
    testObject.whenExtensionsRegistered();
    const viewContainer1Views = testObject.getViewContainerModel(viewContainer);
    assert.deepStrictEqual(viewContainer1Views.allViewDescriptors.map((v) => v.id), ["view2"]);
    const generateViewContainer = testObject.getViewContainerById(generateViewContainerId);
    assert.deepStrictEqual(testObject.getViewContainerLocation(generateViewContainer), ViewContainerLocation.AuxiliaryBar);
    const generatedViewContainerModel = testObject.getViewContainerModel(generateViewContainer);
    assert.deepStrictEqual(generatedViewContainerModel.allViewDescriptors.map((v) => v.id), ["view1"]);
  });
  test("storage change move views and retain visibility state", async function() {
    const storageService = instantiationService.get(IStorageService);
    const testObject = aViewDescriptorService();
    const viewContainer = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const viewDescriptors = [
      {
        id: "view1",
        ctorDescriptor: null,
        name: nls.localize2("Test View 1", "Test View 1"),
        canMoveView: true,
        canToggleVisibility: true
      },
      {
        id: "view2",
        ctorDescriptor: null,
        name: nls.localize2("Test View 2", "Test View 2"),
        canMoveView: true
      }
    ];
    ViewsRegistry.registerViews(viewDescriptors, viewContainer);
    testObject.whenExtensionsRegistered();
    const viewContainer1Views = testObject.getViewContainerModel(viewContainer);
    viewContainer1Views.setVisible("view1", false);
    const generateViewContainerId = `workbench.views.service.${ViewContainerLocationToString(ViewContainerLocation.AuxiliaryBar)}.${generateUuid()}`;
    const viewsCustomizations = {
      viewContainerLocations: {
        [generateViewContainerId]: ViewContainerLocation.AuxiliaryBar
      },
      viewLocations: {
        "view1": generateViewContainerId
      }
    };
    storageService.store("views.customizations", JSON.stringify(viewsCustomizations), StorageScope.PROFILE, StorageTarget.USER);
    const generateViewContainer = testObject.getViewContainerById(generateViewContainerId);
    const generatedViewContainerModel = testObject.getViewContainerModel(generateViewContainer);
    assert.deepStrictEqual(viewContainer1Views.allViewDescriptors.map((v) => v.id), ["view2"]);
    assert.deepStrictEqual(testObject.getViewContainerLocation(generateViewContainer), ViewContainerLocation.AuxiliaryBar);
    assert.deepStrictEqual(generatedViewContainerModel.allViewDescriptors.map((v) => v.id), ["view1"]);
    storageService.store("views.customizations", JSON.stringify({}), StorageScope.PROFILE, StorageTarget.USER);
    assert.deepStrictEqual(viewContainer1Views.allViewDescriptors.map((v) => v.id).sort((a, b) => compare(a, b)), ["view1", "view2"]);
    assert.deepStrictEqual(viewContainer1Views.visibleViewDescriptors.map((v) => v.id), ["view2"]);
    assert.deepStrictEqual(generatedViewContainerModel.allViewDescriptors.map((v) => v.id), []);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdmlld3MvdGVzdC9icm93c2VyL3ZpZXdEZXNjcmlwdG9yU2VydmljZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBJVmlld3NSZWdpc3RyeSwgSVZpZXdEZXNjcmlwdG9yLCBJVmlld0NvbnRhaW5lcnNSZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBWaWV3Q29udGFpbmVyRXh0ZW5zaW9ucywgVmlld0NvbnRhaW5lckxvY2F0aW9uLCBWaWV3Q29udGFpbmVyLCBWaWV3Q29udGFpbmVyTG9jYXRpb25Ub1N0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBWaWV3RGVzY3JpcHRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL3ZpZXdEZXNjcmlwdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvYnJvd3Nlci9jb250ZXh0S2V5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IGNvbXBhcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5jb25zdCBWaWV3c1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVZpZXdzUmVnaXN0cnk+KFZpZXdDb250YWluZXJFeHRlbnNpb25zLlZpZXdzUmVnaXN0cnkpO1xuY29uc3QgVmlld0NvbnRhaW5lcnNSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElWaWV3Q29udGFpbmVyc1JlZ2lzdHJ5PihWaWV3Q29udGFpbmVyRXh0ZW5zaW9ucy5WaWV3Q29udGFpbmVyc1JlZ2lzdHJ5KTtcbmNvbnN0IHZpZXdDb250YWluZXJJZFByZWZpeCA9ICd0ZXN0Vmlld0NvbnRhaW5lcic7XG5jb25zdCBzaWRlYmFyQ29udGFpbmVyID0gVmlld0NvbnRhaW5lcnNSZWdpc3RyeS5yZWdpc3RlclZpZXdDb250YWluZXIoeyBpZDogYCR7dmlld0NvbnRhaW5lcklkUHJlZml4fS0ke2dlbmVyYXRlVXVpZCgpfWAsIHRpdGxlOiBubHMubG9jYWxpemUyKCd0ZXN0JywgJ3Rlc3QnKSwgY3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcig8YW55Pnt9KSB9LCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5jb25zdCBwYW5lbENvbnRhaW5lciA9IFZpZXdDb250YWluZXJzUmVnaXN0cnkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHsgaWQ6IGAke3ZpZXdDb250YWluZXJJZFByZWZpeH0tJHtnZW5lcmF0ZVV1aWQoKX1gLCB0aXRsZTogbmxzLmxvY2FsaXplMigndGVzdCcsICd0ZXN0JyksIGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoPGFueT57fSkgfSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsKTtcblxuc3VpdGUoJ1ZpZXdEZXNjcmlwdG9yU2VydmljZScsICgpID0+IHtcblxuXHRjb25zdCBkaXNwb3NhYmxlcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXHRsZXQgaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBkaXNwb3NhYmxlcykpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnRleHRLZXlTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udGV4dEtleVNlcnZpY2UpKSk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRmb3IgKGNvbnN0IHZpZXdDb250YWluZXIgb2YgVmlld0NvbnRhaW5lcnNSZWdpc3RyeS5hbGwpIHtcblx0XHRcdGlmICh2aWV3Q29udGFpbmVyLmlkLnN0YXJ0c1dpdGgodmlld0NvbnRhaW5lcklkUHJlZml4KSkge1xuXHRcdFx0XHRWaWV3c1JlZ2lzdHJ5LmRlcmVnaXN0ZXJWaWV3cyhWaWV3c1JlZ2lzdHJ5LmdldFZpZXdzKHZpZXdDb250YWluZXIpLCB2aWV3Q29udGFpbmVyKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGFWaWV3RGVzY3JpcHRvclNlcnZpY2UoKTogVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHtcblx0XHRyZXR1cm4gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFZpZXdEZXNjcmlwdG9yU2VydmljZSkpO1xuXHR9XG5cblx0dGVzdCgnRW1wdHkgQ29udGFpbmVycycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYVZpZXdEZXNjcmlwdG9yU2VydmljZSgpO1xuXHRcdGNvbnN0IHNpZGViYXJWaWV3cyA9IHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHNpZGViYXJDb250YWluZXIpO1xuXHRcdGNvbnN0IHBhbmVsVmlld3MgPSB0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJNb2RlbChwYW5lbENvbnRhaW5lcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNpZGViYXJWaWV3cy5hbGxWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAwLCAnVGhlIHNpZGViYXIgY29udGFpbmVyIHNob3VsZCBoYXZlIG5vIHZpZXdzIHlldC4nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxWaWV3cy5hbGxWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAwLCAnVGhlIHBhbmVsIGNvbnRhaW5lciBzaG91bGQgaGF2ZSBubyB2aWV3cyB5ZXQuJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ1JlZ2lzdGVyL0RlcmVnaXN0ZXInLCAoKSA9PiB7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGFWaWV3RGVzY3JpcHRvclNlcnZpY2UoKTtcblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcnM6IElWaWV3RGVzY3JpcHRvcltdID0gW1xuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3ZpZXcxJyxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMScsICdUZXN0IFZpZXcgMScpLFxuXHRcdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICd2aWV3MicsXG5cdFx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDInLCAnVGVzdCBWaWV3IDInKSxcblx0XHRcdFx0Y2FuTW92ZVZpZXc6IHRydWVcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAndmlldzMnLFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAzJywgJ1Rlc3QgVmlldyAzJyksXG5cdFx0XHRcdGNhbk1vdmVWaWV3OiB0cnVlXG5cdFx0XHR9XG5cdFx0XTtcblxuXHRcdFZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3cyh2aWV3RGVzY3JpcHRvcnMuc2xpY2UoMCwgMiksIHNpZGViYXJDb250YWluZXIpO1xuXHRcdFZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3cyh2aWV3RGVzY3JpcHRvcnMuc2xpY2UoMiksIHBhbmVsQ29udGFpbmVyKTtcblxuXHRcdGxldCBzaWRlYmFyVmlld3MgPSB0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJNb2RlbChzaWRlYmFyQ29udGFpbmVyKTtcblx0XHRsZXQgcGFuZWxWaWV3cyA9IHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHBhbmVsQ29udGFpbmVyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaWRlYmFyVmlld3MuYWN0aXZlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMiwgJ1NpZGViYXIgc2hvdWxkIGhhdmUgMiB2aWV3cycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFZpZXdzLmFjdGl2ZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGgsIDEsICdQYW5lbCBzaG91bGQgaGF2ZSAxIHZpZXcnKTtcblxuXHRcdFZpZXdzUmVnaXN0cnkuZGVyZWdpc3RlclZpZXdzKHZpZXdEZXNjcmlwdG9ycy5zbGljZSgwLCAyKSwgc2lkZWJhckNvbnRhaW5lcik7XG5cdFx0Vmlld3NSZWdpc3RyeS5kZXJlZ2lzdGVyVmlld3Modmlld0Rlc2NyaXB0b3JzLnNsaWNlKDIpLCBwYW5lbENvbnRhaW5lcik7XG5cblx0XHRzaWRlYmFyVmlld3MgPSB0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJNb2RlbChzaWRlYmFyQ29udGFpbmVyKTtcblx0XHRwYW5lbFZpZXdzID0gdGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyTW9kZWwocGFuZWxDb250YWluZXIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNpZGViYXJWaWV3cy5hY3RpdmVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAwLCAnU2lkZWJhciBzaG91bGQgaGF2ZSBubyB2aWV3cycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFZpZXdzLmFjdGl2ZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGgsIDAsICdQYW5lbCBzaG91bGQgaGF2ZSBubyB2aWV3cycpO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHZpZXdzIHRvIGV4aXN0aW5nIGNvbnRhaW5lcnMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGFWaWV3RGVzY3JpcHRvclNlcnZpY2UoKTtcblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcnM6IElWaWV3RGVzY3JpcHRvcltdID0gW1xuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3ZpZXcxJyxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMScsICdUZXN0IFZpZXcgMScpLFxuXHRcdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICd2aWV3MicsXG5cdFx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDInLCAnVGVzdCBWaWV3IDInKSxcblx0XHRcdFx0Y2FuTW92ZVZpZXc6IHRydWVcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAndmlldzMnLFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAzJywgJ1Rlc3QgVmlldyAzJyksXG5cdFx0XHRcdGNhbk1vdmVWaWV3OiB0cnVlXG5cdFx0XHR9XG5cdFx0XTtcblxuXHRcdFZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3cyh2aWV3RGVzY3JpcHRvcnMuc2xpY2UoMCwgMiksIHNpZGViYXJDb250YWluZXIpO1xuXHRcdFZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3cyh2aWV3RGVzY3JpcHRvcnMuc2xpY2UoMiksIHBhbmVsQ29udGFpbmVyKTtcblxuXHRcdHRlc3RPYmplY3QubW92ZVZpZXdzVG9Db250YWluZXIodmlld0Rlc2NyaXB0b3JzLnNsaWNlKDIpLCBzaWRlYmFyQ29udGFpbmVyKTtcblx0XHR0ZXN0T2JqZWN0Lm1vdmVWaWV3c1RvQ29udGFpbmVyKHZpZXdEZXNjcmlwdG9ycy5zbGljZSgwLCAyKSwgcGFuZWxDb250YWluZXIpO1xuXG5cdFx0Y29uc3Qgc2lkZWJhclZpZXdzID0gdGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyTW9kZWwoc2lkZWJhckNvbnRhaW5lcik7XG5cdFx0Y29uc3QgcGFuZWxWaWV3cyA9IHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHBhbmVsQ29udGFpbmVyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaWRlYmFyVmlld3MuYWN0aXZlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMSwgJ1NpZGViYXIgc2hvdWxkIGhhdmUgMiB2aWV3cycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFZpZXdzLmFjdGl2ZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGgsIDIsICdQYW5lbCBzaG91bGQgaGF2ZSAxIHZpZXcnKTtcblxuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChzaWRlYmFyVmlld3MuYWN0aXZlVmlld0Rlc2NyaXB0b3JzLmluZGV4T2Yodmlld0Rlc2NyaXB0b3JzWzJdKSwgLTEsIGBTaWRlYmFyIHNob3VsZCBoYXZlICR7dmlld0Rlc2NyaXB0b3JzWzJdLm5hbWUudmFsdWV9YCk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHBhbmVsVmlld3MuYWN0aXZlVmlld0Rlc2NyaXB0b3JzLmluZGV4T2Yodmlld0Rlc2NyaXB0b3JzWzBdKSwgLTEsIGBQYW5lbCBzaG91bGQgaGF2ZSAke3ZpZXdEZXNjcmlwdG9yc1swXS5uYW1lLnZhbHVlfWApO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChwYW5lbFZpZXdzLmFjdGl2ZVZpZXdEZXNjcmlwdG9ycy5pbmRleE9mKHZpZXdEZXNjcmlwdG9yc1sxXSksIC0xLCBgUGFuZWwgc2hvdWxkIGhhdmUgJHt2aWV3RGVzY3JpcHRvcnNbMV0ubmFtZS52YWx1ZX1gKTtcblx0fSk7XG5cblx0dGVzdCgnbW92ZSB2aWV3cyB0byBnZW5lcmF0ZWQgY29udGFpbmVycycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYVZpZXdEZXNjcmlwdG9yU2VydmljZSgpO1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yczogSVZpZXdEZXNjcmlwdG9yW10gPSBbXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAndmlldzEnLFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAxJywgJ1Rlc3QgVmlldyAxJyksXG5cdFx0XHRcdGNhbk1vdmVWaWV3OiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3ZpZXcyJyxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMicsICdUZXN0IFZpZXcgMicpLFxuXHRcdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICd2aWV3MycsXG5cdFx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDMnLCAnVGVzdCBWaWV3IDMnKSxcblx0XHRcdFx0Y2FuTW92ZVZpZXc6IHRydWVcblx0XHRcdH1cblx0XHRdO1xuXG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKHZpZXdEZXNjcmlwdG9ycy5zbGljZSgwLCAyKSwgc2lkZWJhckNvbnRhaW5lcik7XG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKHZpZXdEZXNjcmlwdG9ycy5zbGljZSgyKSwgcGFuZWxDb250YWluZXIpO1xuXG5cdFx0dGVzdE9iamVjdC5tb3ZlVmlld1RvTG9jYXRpb24odmlld0Rlc2NyaXB0b3JzWzBdLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwpO1xuXHRcdHRlc3RPYmplY3QubW92ZVZpZXdUb0xvY2F0aW9uKHZpZXdEZXNjcmlwdG9yc1syXSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXG5cdFx0bGV0IHNpZGViYXJWaWV3cyA9IHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHNpZGViYXJDb250YWluZXIpO1xuXHRcdGxldCBwYW5lbFZpZXdzID0gdGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyTW9kZWwocGFuZWxDb250YWluZXIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNpZGViYXJWaWV3cy5hY3RpdmVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAxLCAnU2lkZWJhciBjb250YWluZXIgc2hvdWxkIGhhdmUgMSB2aWV3Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsVmlld3MuYWN0aXZlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMCwgJ1BhbmVsIGNvbnRhaW5lciBzaG91bGQgaGF2ZSBubyB2aWV3cycpO1xuXG5cdFx0Y29uc3QgZ2VuZXJhdGVkUGFuZWwgPSBhc3NlcnRJc0RlZmluZWQodGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyQnlWaWV3SWQodmlld0Rlc2NyaXB0b3JzWzBdLmlkKSk7XG5cdFx0Y29uc3QgZ2VuZXJhdGVkU2lkZWJhciA9IGFzc2VydElzRGVmaW5lZCh0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJCeVZpZXdJZCh2aWV3RGVzY3JpcHRvcnNbMl0uaWQpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJMb2NhdGlvbihnZW5lcmF0ZWRQYW5lbCksIFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCwgJ0dlbmVyYXRlZCBQYW5lbCBzaG91bGQgYmUgaW4gbG9jYXRlZCBpbiB0aGUgcGFuZWwnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24oZ2VuZXJhdGVkU2lkZWJhciksIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyLCAnR2VuZXJhdGVkIFNpZGViYXIgc2hvdWxkIGJlIGluIGxvY2F0ZWQgaW4gdGhlIHNpZGViYXInKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJMb2NhdGlvbihnZW5lcmF0ZWRQYW5lbCksIHRlc3RPYmplY3QuZ2V0Vmlld0xvY2F0aW9uQnlJZCh2aWV3RGVzY3JpcHRvcnNbMF0uaWQpLCAnUGFuZWwgdmlldyBsb2NhdGlvbiBhbmQgY29udGFpbmVyIGxvY2F0aW9uIHNob3VsZCBtYXRjaCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJMb2NhdGlvbihnZW5lcmF0ZWRTaWRlYmFyKSwgdGVzdE9iamVjdC5nZXRWaWV3TG9jYXRpb25CeUlkKHZpZXdEZXNjcmlwdG9yc1syXS5pZCksICdTaWRlYmFyIHZpZXcgbG9jYXRpb24gYW5kIGNvbnRhaW5lciBsb2NhdGlvbiBzaG91bGQgbWF0Y2gnKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmdldERlZmF1bHRDb250YWluZXJCeUlkKHZpZXdEZXNjcmlwdG9yc1syXS5pZCksIHBhbmVsQ29udGFpbmVyLCBgJHt2aWV3RGVzY3JpcHRvcnNbMl0ubmFtZS52YWx1ZX0gaGFzIHdyb25nIGRlZmF1bHQgY29udGFpbmVyYCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3QuZ2V0RGVmYXVsdENvbnRhaW5lckJ5SWQodmlld0Rlc2NyaXB0b3JzWzBdLmlkKSwgc2lkZWJhckNvbnRhaW5lciwgYCR7dmlld0Rlc2NyaXB0b3JzWzBdLm5hbWUudmFsdWV9IGhhcyB3cm9uZyBkZWZhdWx0IGNvbnRhaW5lcmApO1xuXG5cdFx0dGVzdE9iamVjdC5tb3ZlVmlld1RvTG9jYXRpb24odmlld0Rlc2NyaXB0b3JzWzBdLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5cdFx0dGVzdE9iamVjdC5tb3ZlVmlld1RvTG9jYXRpb24odmlld0Rlc2NyaXB0b3JzWzJdLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwpO1xuXG5cdFx0c2lkZWJhclZpZXdzID0gdGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyTW9kZWwoc2lkZWJhckNvbnRhaW5lcik7XG5cdFx0cGFuZWxWaWV3cyA9IHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHBhbmVsQ29udGFpbmVyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaWRlYmFyVmlld3MuYWN0aXZlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMSwgJ1NpZGViYXIgc2hvdWxkIGhhdmUgMiB2aWV3cycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFZpZXdzLmFjdGl2ZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGgsIDAsICdQYW5lbCBzaG91bGQgaGF2ZSAxIHZpZXcnKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmdldFZpZXdMb2NhdGlvbkJ5SWQodmlld0Rlc2NyaXB0b3JzWzBdLmlkKSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIsICdWaWV3IHNob3VsZCBiZSBsb2NhdGVkIGluIHRoZSBzaWRlYmFyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3QuZ2V0Vmlld0xvY2F0aW9uQnlJZCh2aWV3RGVzY3JpcHRvcnNbMl0uaWQpLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwsICdWaWV3IHNob3VsZCBiZSBsb2NhdGVkIGluIHRoZSBwYW5lbCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIHZpZXcgZXZlbnRzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBhVmlld0Rlc2NyaXB0b3JTZXJ2aWNlKCk7XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3JzOiBJVmlld0Rlc2NyaXB0b3JbXSA9IFtcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICd2aWV3MScsXG5cdFx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDEnLCAnVGVzdCBWaWV3IDEnKSxcblx0XHRcdFx0Y2FuTW92ZVZpZXc6IHRydWVcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAndmlldzInLFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAyJywgJ1Rlc3QgVmlldyAyJyksXG5cdFx0XHRcdGNhbk1vdmVWaWV3OiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3ZpZXczJyxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMycsICdUZXN0IFZpZXcgMycpLFxuXHRcdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZVxuXHRcdFx0fVxuXHRcdF07XG5cblx0XHRsZXQgZXhwZWN0ZWRTZXF1ZW5jZSA9ICcnO1xuXHRcdGxldCBhY3R1YWxTZXF1ZW5jZSA9ICcnO1xuXG5cdFx0Y29uc3QgY29udGFpbmVyTW92ZVN0cmluZyA9ICh2aWV3OiBJVmlld0Rlc2NyaXB0b3IsIGZyb206IFZpZXdDb250YWluZXIsIHRvOiBWaWV3Q29udGFpbmVyKSA9PiB7XG5cdFx0XHRyZXR1cm4gYE1vdmVkICR7dmlldy5pZH0gZnJvbSAke2Zyb20uaWR9IHRvICR7dG8uaWR9XFxuYDtcblx0XHR9O1xuXG5cdFx0Y29uc3QgbG9jYXRpb25Nb3ZlU3RyaW5nID0gKHZpZXc6IElWaWV3RGVzY3JpcHRvciwgZnJvbTogVmlld0NvbnRhaW5lckxvY2F0aW9uLCB0bzogVmlld0NvbnRhaW5lckxvY2F0aW9uKSA9PiB7XG5cdFx0XHRyZXR1cm4gYE1vdmVkICR7dmlldy5pZH0gZnJvbSAke2Zyb20gPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyID8gJ1NpZGViYXInIDogJ1BhbmVsJ30gdG8gJHt0byA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIgPyAnU2lkZWJhcicgOiAnUGFuZWwnfVxcbmA7XG5cdFx0fTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodGVzdE9iamVjdC5vbkRpZENoYW5nZUNvbnRhaW5lcigoeyB2aWV3cywgZnJvbSwgdG8gfSkgPT4ge1xuXHRcdFx0dmlld3MuZm9yRWFjaCh2aWV3ID0+IHtcblx0XHRcdFx0YWN0dWFsU2VxdWVuY2UgKz0gY29udGFpbmVyTW92ZVN0cmluZyh2aWV3LCBmcm9tLCB0byk7XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQodGVzdE9iamVjdC5vbkRpZENoYW5nZUxvY2F0aW9uKCh7IHZpZXdzLCBmcm9tLCB0byB9KSA9PiB7XG5cdFx0XHR2aWV3cy5mb3JFYWNoKHZpZXcgPT4ge1xuXHRcdFx0XHRhY3R1YWxTZXF1ZW5jZSArPSBsb2NhdGlvbk1vdmVTdHJpbmcodmlldywgZnJvbSwgdG8pO1xuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKHZpZXdEZXNjcmlwdG9ycy5zbGljZSgwLCAyKSwgc2lkZWJhckNvbnRhaW5lcik7XG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKHZpZXdEZXNjcmlwdG9ycy5zbGljZSgyKSwgcGFuZWxDb250YWluZXIpO1xuXG5cdFx0ZXhwZWN0ZWRTZXF1ZW5jZSArPSBsb2NhdGlvbk1vdmVTdHJpbmcodmlld0Rlc2NyaXB0b3JzWzBdLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhciwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsKTtcblx0XHR0ZXN0T2JqZWN0Lm1vdmVWaWV3VG9Mb2NhdGlvbih2aWV3RGVzY3JpcHRvcnNbMF0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCk7XG5cdFx0ZXhwZWN0ZWRTZXF1ZW5jZSArPSBjb250YWluZXJNb3ZlU3RyaW5nKHZpZXdEZXNjcmlwdG9yc1swXSwgc2lkZWJhckNvbnRhaW5lciwgdGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyQnlWaWV3SWQodmlld0Rlc2NyaXB0b3JzWzBdLmlkKSEpO1xuXG5cdFx0ZXhwZWN0ZWRTZXF1ZW5jZSArPSBsb2NhdGlvbk1vdmVTdHJpbmcodmlld0Rlc2NyaXB0b3JzWzJdLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwsIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHR0ZXN0T2JqZWN0Lm1vdmVWaWV3VG9Mb2NhdGlvbih2aWV3RGVzY3JpcHRvcnNbMl0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHRleHBlY3RlZFNlcXVlbmNlICs9IGNvbnRhaW5lck1vdmVTdHJpbmcodmlld0Rlc2NyaXB0b3JzWzJdLCBwYW5lbENvbnRhaW5lciwgdGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyQnlWaWV3SWQodmlld0Rlc2NyaXB0b3JzWzJdLmlkKSEpO1xuXG5cdFx0ZXhwZWN0ZWRTZXF1ZW5jZSArPSBsb2NhdGlvbk1vdmVTdHJpbmcodmlld0Rlc2NyaXB0b3JzWzBdLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwsIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHRleHBlY3RlZFNlcXVlbmNlICs9IGNvbnRhaW5lck1vdmVTdHJpbmcodmlld0Rlc2NyaXB0b3JzWzBdLCB0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJCeVZpZXdJZCh2aWV3RGVzY3JpcHRvcnNbMF0uaWQpISwgc2lkZWJhckNvbnRhaW5lcik7XG5cdFx0dGVzdE9iamVjdC5tb3ZlVmlld3NUb0NvbnRhaW5lcihbdmlld0Rlc2NyaXB0b3JzWzBdXSwgc2lkZWJhckNvbnRhaW5lcik7XG5cblx0XHRleHBlY3RlZFNlcXVlbmNlICs9IGxvY2F0aW9uTW92ZVN0cmluZyh2aWV3RGVzY3JpcHRvcnNbMl0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwpO1xuXHRcdGV4cGVjdGVkU2VxdWVuY2UgKz0gY29udGFpbmVyTW92ZVN0cmluZyh2aWV3RGVzY3JpcHRvcnNbMl0sIHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKHZpZXdEZXNjcmlwdG9yc1syXS5pZCkhLCBwYW5lbENvbnRhaW5lcik7XG5cdFx0dGVzdE9iamVjdC5tb3ZlVmlld3NUb0NvbnRhaW5lcihbdmlld0Rlc2NyaXB0b3JzWzJdXSwgcGFuZWxDb250YWluZXIpO1xuXG5cdFx0ZXhwZWN0ZWRTZXF1ZW5jZSArPSBsb2NhdGlvbk1vdmVTdHJpbmcodmlld0Rlc2NyaXB0b3JzWzBdLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhciwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsKTtcblx0XHRleHBlY3RlZFNlcXVlbmNlICs9IGNvbnRhaW5lck1vdmVTdHJpbmcodmlld0Rlc2NyaXB0b3JzWzBdLCBzaWRlYmFyQ29udGFpbmVyLCBwYW5lbENvbnRhaW5lcik7XG5cdFx0dGVzdE9iamVjdC5tb3ZlVmlld3NUb0NvbnRhaW5lcihbdmlld0Rlc2NyaXB0b3JzWzBdXSwgcGFuZWxDb250YWluZXIpO1xuXG5cdFx0ZXhwZWN0ZWRTZXF1ZW5jZSArPSBsb2NhdGlvbk1vdmVTdHJpbmcodmlld0Rlc2NyaXB0b3JzWzJdLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwsIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHRleHBlY3RlZFNlcXVlbmNlICs9IGNvbnRhaW5lck1vdmVTdHJpbmcodmlld0Rlc2NyaXB0b3JzWzJdLCBwYW5lbENvbnRhaW5lciwgc2lkZWJhckNvbnRhaW5lcik7XG5cdFx0dGVzdE9iamVjdC5tb3ZlVmlld3NUb0NvbnRhaW5lcihbdmlld0Rlc2NyaXB0b3JzWzJdXSwgc2lkZWJhckNvbnRhaW5lcik7XG5cblx0XHRleHBlY3RlZFNlcXVlbmNlICs9IGxvY2F0aW9uTW92ZVN0cmluZyh2aWV3RGVzY3JpcHRvcnNbMV0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwpO1xuXHRcdGV4cGVjdGVkU2VxdWVuY2UgKz0gbG9jYXRpb25Nb3ZlU3RyaW5nKHZpZXdEZXNjcmlwdG9yc1syXSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIsIFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCk7XG5cdFx0ZXhwZWN0ZWRTZXF1ZW5jZSArPSBjb250YWluZXJNb3ZlU3RyaW5nKHZpZXdEZXNjcmlwdG9yc1sxXSwgc2lkZWJhckNvbnRhaW5lciwgcGFuZWxDb250YWluZXIpO1xuXHRcdGV4cGVjdGVkU2VxdWVuY2UgKz0gY29udGFpbmVyTW92ZVN0cmluZyh2aWV3RGVzY3JpcHRvcnNbMl0sIHNpZGViYXJDb250YWluZXIsIHBhbmVsQ29udGFpbmVyKTtcblx0XHR0ZXN0T2JqZWN0Lm1vdmVWaWV3c1RvQ29udGFpbmVyKFt2aWV3RGVzY3JpcHRvcnNbMV0sIHZpZXdEZXNjcmlwdG9yc1syXV0sIHBhbmVsQ29udGFpbmVyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWxTZXF1ZW5jZSwgZXhwZWN0ZWRTZXF1ZW5jZSwgJ0V2ZW50IHNlcXVlbmNlIG5vdCBtYXRjaGluZyBleHBlY3RlZCBzZXF1ZW5jZScpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNldCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYVZpZXdEZXNjcmlwdG9yU2VydmljZSgpO1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yczogSVZpZXdEZXNjcmlwdG9yW10gPSBbXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAndmlldzEnLFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAxJywgJ1Rlc3QgVmlldyAxJyksXG5cdFx0XHRcdGNhbk1vdmVWaWV3OiB0cnVlLFxuXHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICd2aWV3MicsXG5cdFx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDInLCAnVGVzdCBWaWV3IDInKSxcblx0XHRcdFx0Y2FuTW92ZVZpZXc6IHRydWUsXG5cdFx0XHRcdG9yZGVyOiAyXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3ZpZXczJyxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMycsICdUZXN0IFZpZXcgMycpLFxuXHRcdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZSxcblx0XHRcdFx0b3JkZXI6IDNcblx0XHRcdH1cblx0XHRdO1xuXG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKHZpZXdEZXNjcmlwdG9ycy5zbGljZSgwLCAyKSwgc2lkZWJhckNvbnRhaW5lcik7XG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKHZpZXdEZXNjcmlwdG9ycy5zbGljZSgyKSwgcGFuZWxDb250YWluZXIpO1xuXG5cdFx0dGVzdE9iamVjdC5tb3ZlVmlld1RvTG9jYXRpb24odmlld0Rlc2NyaXB0b3JzWzBdLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwpO1xuXHRcdHRlc3RPYmplY3QubW92ZVZpZXdzVG9Db250YWluZXIoW3ZpZXdEZXNjcmlwdG9yc1sxXV0sIHBhbmVsQ29udGFpbmVyKTtcblx0XHR0ZXN0T2JqZWN0Lm1vdmVWaWV3VG9Mb2NhdGlvbih2aWV3RGVzY3JpcHRvcnNbMl0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblxuXHRcdGNvbnN0IGdlbmVyYXRlZFBhbmVsID0gYXNzZXJ0SXNEZWZpbmVkKHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKHZpZXdEZXNjcmlwdG9yc1swXS5pZCkpO1xuXHRcdGNvbnN0IGdlbmVyYXRlZFNpZGViYXIgPSBhc3NlcnRJc0RlZmluZWQodGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyQnlWaWV3SWQodmlld0Rlc2NyaXB0b3JzWzJdLmlkKSk7XG5cblx0XHR0ZXN0T2JqZWN0LnJlc2V0KCk7XG5cblx0XHRjb25zdCBzaWRlYmFyVmlld3MgPSB0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJNb2RlbChzaWRlYmFyQ29udGFpbmVyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNpZGViYXJWaWV3cy5hbGxWaWV3RGVzY3JpcHRvcnMubWFwKHYgPT4gdi5pZCksIFsndmlldzEnLCAndmlldzInXSk7XG5cdFx0Y29uc3QgcGFuZWxWaWV3cyA9IHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHBhbmVsQ29udGFpbmVyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBhbmVsVmlld3MuYWxsVmlld0Rlc2NyaXB0b3JzLm1hcCh2ID0+IHYuaWQpLCBbJ3ZpZXczJ10pO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gSlNPTi5wYXJzZShpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVN0b3JhZ2VTZXJ2aWNlKS5nZXQoJ3ZpZXdzLmN1c3RvbWl6YXRpb25zJywgU3RvcmFnZVNjb3BlLlBST0ZJTEUpISk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIHsgdmlld0NvbnRhaW5lckxvY2F0aW9uczoge30sIHZpZXdMb2NhdGlvbnM6IHt9LCB2aWV3Q29udGFpbmVyQmFkZ2VFbmFibGVtZW50U3RhdGVzOiB7fSB9KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyQnlJZChnZW5lcmF0ZWRQYW5lbC5pZCksIG51bGwpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyQnlJZChnZW5lcmF0ZWRTaWRlYmFyLmlkKSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luaXRpYWxpemUgd2l0aCBjdXN0b20gbG9jYXRpb25zJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHN0b3JhZ2VTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElTdG9yYWdlU2VydmljZSk7XG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lcjEgPSBWaWV3Q29udGFpbmVyc1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld0NvbnRhaW5lcih7IGlkOiBgJHt2aWV3Q29udGFpbmVySWRQcmVmaXh9LSR7Z2VuZXJhdGVVdWlkKCl9YCwgdGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3Rlc3QnLCAndGVzdCcpLCBjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKDxhbnk+e30pIH0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHRjb25zdCBnZW5lcmF0ZVZpZXdDb250YWluZXIxID0gYHdvcmtiZW5jaC52aWV3cy5zZXJ2aWNlLiR7Vmlld0NvbnRhaW5lckxvY2F0aW9uVG9TdHJpbmcoVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpfS4ke2dlbmVyYXRlVXVpZCgpfWA7XG5cdFx0Y29uc3Qgdmlld3NDdXN0b21pemF0aW9ucyA9IHtcblx0XHRcdHZpZXdDb250YWluZXJMb2NhdGlvbnM6IHtcblx0XHRcdFx0W2dlbmVyYXRlVmlld0NvbnRhaW5lcjFdOiBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcixcblx0XHRcdFx0W3ZpZXdDb250YWluZXIxLmlkXTogVmlld0NvbnRhaW5lckxvY2F0aW9uLkF1eGlsaWFyeUJhclxuXHRcdFx0fSxcblx0XHRcdHZpZXdMb2NhdGlvbnM6IHtcblx0XHRcdFx0J3ZpZXcxJzogZ2VuZXJhdGVWaWV3Q29udGFpbmVyMVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ3ZpZXdzLmN1c3RvbWl6YXRpb25zJywgSlNPTi5zdHJpbmdpZnkodmlld3NDdXN0b21pemF0aW9ucyksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3JzOiBJVmlld0Rlc2NyaXB0b3JbXSA9IFtcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICd2aWV3MScsXG5cdFx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDEnLCAnVGVzdCBWaWV3IDEnKSxcblx0XHRcdFx0Y2FuTW92ZVZpZXc6IHRydWVcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAndmlldzInLFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAyJywgJ1Rlc3QgVmlldyAyJyksXG5cdFx0XHRcdGNhbk1vdmVWaWV3OiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3ZpZXczJyxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMycsICdUZXN0IFZpZXcgMycpLFxuXHRcdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICd2aWV3NCcsXG5cdFx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDQnLCAnVGVzdCBWaWV3IDQnKSxcblx0XHRcdFx0Y2FuTW92ZVZpZXc6IHRydWVcblx0XHRcdH1cblx0XHRdO1xuXG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKHZpZXdEZXNjcmlwdG9ycy5zbGljZSgwLCAzKSwgc2lkZWJhckNvbnRhaW5lcik7XG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKHZpZXdEZXNjcmlwdG9ycy5zbGljZSgzKSwgdmlld0NvbnRhaW5lcjEpO1xuXG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGFWaWV3RGVzY3JpcHRvclNlcnZpY2UoKTtcblxuXHRcdGNvbnN0IHNpZGViYXJWaWV3cyA9IHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHNpZGViYXJDb250YWluZXIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2lkZWJhclZpZXdzLmFsbFZpZXdEZXNjcmlwdG9ycy5tYXAodiA9PiB2LmlkKSwgWyd2aWV3MicsICd2aWV3MyddKTtcblxuXHRcdGNvbnN0IGdlbmVyYXRlZFZpZXdDb250YWluZXJWaWV3cyA9IHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lckJ5SWQoZ2VuZXJhdGVWaWV3Q29udGFpbmVyMSkhKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdlbmVyYXRlZFZpZXdDb250YWluZXJWaWV3cy5hbGxWaWV3RGVzY3JpcHRvcnMubWFwKHYgPT4gdi5pZCksIFsndmlldzEnXSk7XG5cblx0XHRjb25zdCB2aWV3Q29udGFpbmVyMVZpZXdzID0gdGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyTW9kZWwodmlld0NvbnRhaW5lcjEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24odmlld0NvbnRhaW5lcjEpLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdDb250YWluZXIxVmlld3MuYWxsVmlld0Rlc2NyaXB0b3JzLm1hcCh2ID0+IHYuaWQpLCBbJ3ZpZXc0J10pO1xuXHR9KTtcblxuXHR0ZXN0KCdzdG9yYWdlIGNoYW5nZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYVZpZXdEZXNjcmlwdG9yU2VydmljZSgpO1xuXG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lcjEgPSBWaWV3Q29udGFpbmVyc1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld0NvbnRhaW5lcih7IGlkOiBgJHt2aWV3Q29udGFpbmVySWRQcmVmaXh9LSR7Z2VuZXJhdGVVdWlkKCl9YCwgdGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3Rlc3QnLCAndGVzdCcpLCBjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKDxhbnk+e30pIH0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHRjb25zdCBnZW5lcmF0ZVZpZXdDb250YWluZXIxID0gYHdvcmtiZW5jaC52aWV3cy5zZXJ2aWNlLiR7Vmlld0NvbnRhaW5lckxvY2F0aW9uVG9TdHJpbmcoVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpfS4ke2dlbmVyYXRlVXVpZCgpfWA7XG5cblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcnM6IElWaWV3RGVzY3JpcHRvcltdID0gW1xuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3ZpZXcxJyxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMScsICdUZXN0IFZpZXcgMScpLFxuXHRcdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICd2aWV3MicsXG5cdFx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDInLCAnVGVzdCBWaWV3IDInKSxcblx0XHRcdFx0Y2FuTW92ZVZpZXc6IHRydWVcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAndmlldzMnLFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAzJywgJ1Rlc3QgVmlldyAzJyksXG5cdFx0XHRcdGNhbk1vdmVWaWV3OiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3ZpZXc0Jyxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgNCcsICdUZXN0IFZpZXcgNCcpLFxuXHRcdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZVxuXHRcdFx0fVxuXHRcdF07XG5cblx0XHRWaWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3Modmlld0Rlc2NyaXB0b3JzLnNsaWNlKDAsIDMpLCBzaWRlYmFyQ29udGFpbmVyKTtcblx0XHRWaWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3Modmlld0Rlc2NyaXB0b3JzLnNsaWNlKDMpLCB2aWV3Q29udGFpbmVyMSk7XG5cblx0XHRjb25zdCB2aWV3c0N1c3RvbWl6YXRpb25zID0ge1xuXHRcdFx0dmlld0NvbnRhaW5lckxvY2F0aW9uczoge1xuXHRcdFx0XHRbZ2VuZXJhdGVWaWV3Q29udGFpbmVyMV06IFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyLFxuXHRcdFx0XHRbdmlld0NvbnRhaW5lcjEuaWRdOiBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyXG5cdFx0XHR9LFxuXHRcdFx0dmlld0xvY2F0aW9uczoge1xuXHRcdFx0XHQndmlldzEnOiBnZW5lcmF0ZVZpZXdDb250YWluZXIxXG5cdFx0XHR9XG5cdFx0fTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVN0b3JhZ2VTZXJ2aWNlKS5zdG9yZSgndmlld3MuY3VzdG9taXphdGlvbnMnLCBKU09OLnN0cmluZ2lmeSh2aWV3c0N1c3RvbWl6YXRpb25zKSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cblx0XHRjb25zdCBzaWRlYmFyVmlld3MgPSB0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJNb2RlbChzaWRlYmFyQ29udGFpbmVyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNpZGViYXJWaWV3cy5hbGxWaWV3RGVzY3JpcHRvcnMubWFwKHYgPT4gdi5pZCksIFsndmlldzInLCAndmlldzMnXSk7XG5cblx0XHRjb25zdCBnZW5lcmF0ZWRWaWV3Q29udGFpbmVyVmlld3MgPSB0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJNb2RlbCh0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJCeUlkKGdlbmVyYXRlVmlld0NvbnRhaW5lcjEpISk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZW5lcmF0ZWRWaWV3Q29udGFpbmVyVmlld3MuYWxsVmlld0Rlc2NyaXB0b3JzLm1hcCh2ID0+IHYuaWQpLCBbJ3ZpZXcxJ10pO1xuXG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lcjFWaWV3cyA9IHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHZpZXdDb250YWluZXIxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHZpZXdDb250YWluZXIxKSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLkF1eGlsaWFyeUJhcik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Q29udGFpbmVyMVZpZXdzLmFsbFZpZXdEZXNjcmlwdG9ycy5tYXAodiA9PiB2LmlkKSwgWyd2aWV3NCddKTtcblx0fSk7XG5cblx0dGVzdCgnb3JwaGFuIHZpZXdzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHN0b3JhZ2VTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElTdG9yYWdlU2VydmljZSk7XG5cdFx0Y29uc3Qgdmlld3NDdXN0b21pemF0aW9ucyA9IHtcblx0XHRcdHZpZXdDb250YWluZXJMb2NhdGlvbnM6IHt9LFxuXHRcdFx0dmlld0xvY2F0aW9uczoge1xuXHRcdFx0XHQndmlldzEnOiBgJHt2aWV3Q29udGFpbmVySWRQcmVmaXh9LSR7Z2VuZXJhdGVVdWlkKCl9YFxuXHRcdFx0fVxuXHRcdH07XG5cdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ3ZpZXdzLmN1c3RvbWl6YXRpb25zJywgSlNPTi5zdHJpbmdpZnkodmlld3NDdXN0b21pemF0aW9ucyksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3JzOiBJVmlld0Rlc2NyaXB0b3JbXSA9IFtcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICd2aWV3MScsXG5cdFx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDEnLCAnVGVzdCBWaWV3IDEnKSxcblx0XHRcdFx0Y2FuTW92ZVZpZXc6IHRydWUsXG5cdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3ZpZXcyJyxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMicsICdUZXN0IFZpZXcgMicpLFxuXHRcdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZSxcblx0XHRcdFx0b3JkZXI6IDJcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAndmlldzMnLFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAzJywgJ1Rlc3QgVmlldyAzJyksXG5cdFx0XHRcdGNhbk1vdmVWaWV3OiB0cnVlLFxuXHRcdFx0XHRvcmRlcjogM1xuXHRcdFx0fVxuXHRcdF07XG5cblx0XHRWaWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3Modmlld0Rlc2NyaXB0b3JzLCBzaWRlYmFyQ29udGFpbmVyKTtcblxuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBhVmlld0Rlc2NyaXB0b3JTZXJ2aWNlKCk7XG5cblx0XHRjb25zdCBzaWRlYmFyVmlld3MgPSB0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJNb2RlbChzaWRlYmFyQ29udGFpbmVyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNpZGViYXJWaWV3cy5hbGxWaWV3RGVzY3JpcHRvcnMubWFwKHYgPT4gdi5pZCksIFsndmlldzInLCAndmlldzMnXSk7XG5cblx0XHR0ZXN0T2JqZWN0LndoZW5FeHRlbnNpb25zUmVnaXN0ZXJlZCgpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2lkZWJhclZpZXdzLmFsbFZpZXdEZXNjcmlwdG9ycy5tYXAodiA9PiB2LmlkKSwgWyd2aWV3MScsICd2aWV3MicsICd2aWV3MyddKTtcblx0fSk7XG5cblx0dGVzdCgnb3JwaGFuIHZpZXcgY29udGFpbmVycycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzdG9yYWdlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJU3RvcmFnZVNlcnZpY2UpO1xuXHRcdGNvbnN0IGdlbmVyYXRlZFZpZXdDb250YWluZXJJZCA9IGB3b3JrYmVuY2gudmlld3Muc2VydmljZS4ke1ZpZXdDb250YWluZXJMb2NhdGlvblRvU3RyaW5nKFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKX0uJHtnZW5lcmF0ZVV1aWQoKX1gO1xuXHRcdGNvbnN0IHZpZXdzQ3VzdG9taXphdGlvbnMgPSB7XG5cdFx0XHR2aWV3Q29udGFpbmVyTG9jYXRpb25zOiB7XG5cdFx0XHRcdFtnZW5lcmF0ZWRWaWV3Q29udGFpbmVySWRdOiBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhclxuXHRcdFx0fSxcblx0XHRcdHZpZXdMb2NhdGlvbnM6IHt9XG5cdFx0fTtcblx0XHRzdG9yYWdlU2VydmljZS5zdG9yZSgndmlld3MuY3VzdG9taXphdGlvbnMnLCBKU09OLnN0cmluZ2lmeSh2aWV3c0N1c3RvbWl6YXRpb25zKSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcnM6IElWaWV3RGVzY3JpcHRvcltdID0gW1xuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3ZpZXcxJyxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMScsICdUZXN0IFZpZXcgMScpLFxuXHRcdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZSxcblx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdH1cblx0XHRdO1xuXG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKHZpZXdEZXNjcmlwdG9ycywgc2lkZWJhckNvbnRhaW5lcik7XG5cblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYVZpZXdEZXNjcmlwdG9yU2VydmljZSgpO1xuXHRcdHRlc3RPYmplY3Qud2hlbkV4dGVuc2lvbnNSZWdpc3RlcmVkKCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lckJ5SWQoZ2VuZXJhdGVkVmlld0NvbnRhaW5lcklkKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmlzVmlld0NvbnRhaW5lclJlbW92ZWRQZXJtYW5lbnRseShnZW5lcmF0ZWRWaWV3Q29udGFpbmVySWQpLCB0cnVlKTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IEpTT04ucGFyc2Uoc3RvcmFnZVNlcnZpY2UuZ2V0KCd2aWV3cy5jdXN0b21pemF0aW9ucycsIFN0b3JhZ2VTY29wZS5QUk9GSUxFKSEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7IHZpZXdDb250YWluZXJMb2NhdGlvbnM6IHt9LCB2aWV3TG9jYXRpb25zOiB7fSwgdmlld0NvbnRhaW5lckJhZGdlRW5hYmxlbWVudFN0YXRlczoge30gfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2N1c3RvbSBsb2NhdGlvbnMgdGFrZSBwcmVjZWRlbmNlIHdoZW4gZGVmYXVsdCB2aWV3IGNvbnRhaW5lciBvZiB2aWV3cyBjaGFuZ2UnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgc3RvcmFnZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRjb25zdCB2aWV3Q29udGFpbmVyMSA9IFZpZXdDb250YWluZXJzUmVnaXN0cnkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHsgaWQ6IGAke3ZpZXdDb250YWluZXJJZFByZWZpeH0tJHtnZW5lcmF0ZVV1aWQoKX1gLCB0aXRsZTogbmxzLmxvY2FsaXplMigndGVzdCcsICd0ZXN0JyksIGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoPGFueT57fSkgfSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdGNvbnN0IGdlbmVyYXRlVmlld0NvbnRhaW5lcjEgPSBgd29ya2JlbmNoLnZpZXdzLnNlcnZpY2UuJHtWaWV3Q29udGFpbmVyTG9jYXRpb25Ub1N0cmluZyhWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcil9LiR7Z2VuZXJhdGVVdWlkKCl9YDtcblx0XHRjb25zdCB2aWV3c0N1c3RvbWl6YXRpb25zID0ge1xuXHRcdFx0dmlld0NvbnRhaW5lckxvY2F0aW9uczoge1xuXHRcdFx0XHRbZ2VuZXJhdGVWaWV3Q29udGFpbmVyMV06IFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyLFxuXHRcdFx0XHRbdmlld0NvbnRhaW5lcjEuaWRdOiBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyXG5cdFx0XHR9LFxuXHRcdFx0dmlld0xvY2F0aW9uczoge1xuXHRcdFx0XHQndmlldzEnOiBnZW5lcmF0ZVZpZXdDb250YWluZXIxXG5cdFx0XHR9XG5cdFx0fTtcblx0XHRzdG9yYWdlU2VydmljZS5zdG9yZSgndmlld3MuY3VzdG9taXphdGlvbnMnLCBKU09OLnN0cmluZ2lmeSh2aWV3c0N1c3RvbWl6YXRpb25zKSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcnM6IElWaWV3RGVzY3JpcHRvcltdID0gW1xuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3ZpZXcxJyxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMScsICdUZXN0IFZpZXcgMScpLFxuXHRcdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICd2aWV3MicsXG5cdFx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDInLCAnVGVzdCBWaWV3IDInKSxcblx0XHRcdFx0Y2FuTW92ZVZpZXc6IHRydWVcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAndmlldzMnLFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAzJywgJ1Rlc3QgVmlldyAzJyksXG5cdFx0XHRcdGNhbk1vdmVWaWV3OiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3ZpZXc0Jyxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgNCcsICdUZXN0IFZpZXcgNCcpLFxuXHRcdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZVxuXHRcdFx0fVxuXHRcdF07XG5cblx0XHRWaWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3Modmlld0Rlc2NyaXB0b3JzLnNsaWNlKDAsIDMpLCBzaWRlYmFyQ29udGFpbmVyKTtcblx0XHRWaWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3Modmlld0Rlc2NyaXB0b3JzLnNsaWNlKDMpLCB2aWV3Q29udGFpbmVyMSk7XG5cblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYVZpZXdEZXNjcmlwdG9yU2VydmljZSgpO1xuXHRcdFZpZXdzUmVnaXN0cnkubW92ZVZpZXdzKFt2aWV3RGVzY3JpcHRvcnNbMF0sIHZpZXdEZXNjcmlwdG9yc1sxXV0sIHBhbmVsQ29udGFpbmVyKTtcblxuXHRcdGNvbnN0IHNpZGViYXJWaWV3cyA9IHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHNpZGViYXJDb250YWluZXIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2lkZWJhclZpZXdzLmFsbFZpZXdEZXNjcmlwdG9ycy5tYXAodiA9PiB2LmlkKSwgWyd2aWV3MyddKTtcblxuXHRcdGNvbnN0IHBhbmVsVmlld3MgPSB0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJNb2RlbChwYW5lbENvbnRhaW5lcik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwYW5lbFZpZXdzLmFsbFZpZXdEZXNjcmlwdG9ycy5tYXAodiA9PiB2LmlkKSwgWyd2aWV3MiddKTtcblxuXHRcdGNvbnN0IGdlbmVyYXRlZFZpZXdDb250YWluZXJWaWV3cyA9IHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lckJ5SWQoZ2VuZXJhdGVWaWV3Q29udGFpbmVyMSkhKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdlbmVyYXRlZFZpZXdDb250YWluZXJWaWV3cy5hbGxWaWV3RGVzY3JpcHRvcnMubWFwKHYgPT4gdi5pZCksIFsndmlldzEnXSk7XG5cblx0XHRjb25zdCB2aWV3Q29udGFpbmVyMVZpZXdzID0gdGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyTW9kZWwodmlld0NvbnRhaW5lcjEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24odmlld0NvbnRhaW5lcjEpLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdDb250YWluZXIxVmlld3MuYWxsVmlld0Rlc2NyaXB0b3JzLm1hcCh2ID0+IHYuaWQpLCBbJ3ZpZXc0J10pO1xuXHR9KTtcblxuXHR0ZXN0KCd2aWV3IGNvbnRhaW5lcnMgd2l0aCBub3QgZXhpc3Rpbmcgdmlld3MgYXJlIG5vdCByZW1vdmVkIGZyb20gY3VzdG9taXphdGlvbnMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgc3RvcmFnZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRjb25zdCB2aWV3Q29udGFpbmVyMSA9IFZpZXdDb250YWluZXJzUmVnaXN0cnkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHsgaWQ6IGAke3ZpZXdDb250YWluZXJJZFByZWZpeH0tJHtnZW5lcmF0ZVV1aWQoKX1gLCB0aXRsZTogbmxzLmxvY2FsaXplMigndGVzdCcsICd0ZXN0JyksIGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoPGFueT57fSkgfSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdGNvbnN0IGdlbmVyYXRlVmlld0NvbnRhaW5lcjEgPSBgd29ya2JlbmNoLnZpZXdzLnNlcnZpY2UuJHtWaWV3Q29udGFpbmVyTG9jYXRpb25Ub1N0cmluZyhWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcil9LiR7Z2VuZXJhdGVVdWlkKCl9YDtcblx0XHRjb25zdCB2aWV3c0N1c3RvbWl6YXRpb25zID0ge1xuXHRcdFx0dmlld0NvbnRhaW5lckxvY2F0aW9uczoge1xuXHRcdFx0XHRbZ2VuZXJhdGVWaWV3Q29udGFpbmVyMV06IFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyLFxuXHRcdFx0XHRbdmlld0NvbnRhaW5lcjEuaWRdOiBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyXG5cdFx0XHR9LFxuXHRcdFx0dmlld0xvY2F0aW9uczoge1xuXHRcdFx0XHQndmlldzUnOiBnZW5lcmF0ZVZpZXdDb250YWluZXIxXG5cdFx0XHR9XG5cdFx0fTtcblx0XHRzdG9yYWdlU2VydmljZS5zdG9yZSgndmlld3MuY3VzdG9taXphdGlvbnMnLCBKU09OLnN0cmluZ2lmeSh2aWV3c0N1c3RvbWl6YXRpb25zKSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcnM6IElWaWV3RGVzY3JpcHRvcltdID0gW1xuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3ZpZXcxJyxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMScsICdUZXN0IFZpZXcgMScpLFxuXHRcdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZVxuXHRcdFx0fVxuXHRcdF07XG5cblx0XHRWaWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3Modmlld0Rlc2NyaXB0b3JzLCB2aWV3Q29udGFpbmVyMSk7XG5cblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYVZpZXdEZXNjcmlwdG9yU2VydmljZSgpO1xuXHRcdHRlc3RPYmplY3Qud2hlbkV4dGVuc2lvbnNSZWdpc3RlcmVkKCk7XG5cblx0XHRjb25zdCB2aWV3Q29udGFpbmVyMVZpZXdzID0gdGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyTW9kZWwodmlld0NvbnRhaW5lcjEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24odmlld0NvbnRhaW5lcjEpLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdDb250YWluZXIxVmlld3MuYWxsVmlld0Rlc2NyaXB0b3JzLm1hcCh2ID0+IHYuaWQpLCBbJ3ZpZXcxJ10pO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gSlNPTi5wYXJzZShzdG9yYWdlU2VydmljZS5nZXQoJ3ZpZXdzLmN1c3RvbWl6YXRpb25zJywgU3RvcmFnZVNjb3BlLlBST0ZJTEUpISk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIHZpZXdzQ3VzdG9taXphdGlvbnMpO1xuXHR9KTtcblxuXHR0ZXN0KCdzdG9yYWdlIGNoYW5nZSBhbHNvIHVwZGF0ZXMgbG9jYXRpb25zIGV2ZW4gaWYgdmlld3MgZG8gbm90IGV4aXN0cyBhbmQgdmlld3MgYXJlIHJlZ2lzdGVyZWQgbGF0ZXInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgc3RvcmFnZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYVZpZXdEZXNjcmlwdG9yU2VydmljZSgpO1xuXG5cdFx0Y29uc3QgZ2VuZXJhdGVWaWV3Q29udGFpbmVySWQgPSBgd29ya2JlbmNoLnZpZXdzLnNlcnZpY2UuJHtWaWV3Q29udGFpbmVyTG9jYXRpb25Ub1N0cmluZyhWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyKX0uJHtnZW5lcmF0ZVV1aWQoKX1gO1xuXHRcdGNvbnN0IHZpZXdzQ3VzdG9taXphdGlvbnMgPSB7XG5cdFx0XHR2aWV3Q29udGFpbmVyTG9jYXRpb25zOiB7XG5cdFx0XHRcdFtnZW5lcmF0ZVZpZXdDb250YWluZXJJZF06IFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIsXG5cdFx0XHR9LFxuXHRcdFx0dmlld0xvY2F0aW9uczoge1xuXHRcdFx0XHQndmlldzEnOiBnZW5lcmF0ZVZpZXdDb250YWluZXJJZFxuXHRcdFx0fVxuXHRcdH07XG5cdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ3ZpZXdzLmN1c3RvbWl6YXRpb25zJywgSlNPTi5zdHJpbmdpZnkodmlld3NDdXN0b21pemF0aW9ucyksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lciA9IFZpZXdDb250YWluZXJzUmVnaXN0cnkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHsgaWQ6IGAke3ZpZXdDb250YWluZXJJZFByZWZpeH0tJHtnZW5lcmF0ZVV1aWQoKX1gLCB0aXRsZTogbmxzLmxvY2FsaXplMigndGVzdCcsICd0ZXN0JyksIGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoPGFueT57fSkgfSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yczogSVZpZXdEZXNjcmlwdG9yW10gPSBbXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAndmlldzEnLFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAxJywgJ1Rlc3QgVmlldyAxJyksXG5cdFx0XHRcdGNhbk1vdmVWaWV3OiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3ZpZXcyJyxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMicsICdUZXN0IFZpZXcgMicpLFxuXHRcdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZVxuXHRcdFx0fVxuXHRcdF07XG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKHZpZXdEZXNjcmlwdG9ycywgdmlld0NvbnRhaW5lcik7XG5cblx0XHR0ZXN0T2JqZWN0LndoZW5FeHRlbnNpb25zUmVnaXN0ZXJlZCgpO1xuXG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lcjFWaWV3cyA9IHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHZpZXdDb250YWluZXIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld0NvbnRhaW5lcjFWaWV3cy5hbGxWaWV3RGVzY3JpcHRvcnMubWFwKHYgPT4gdi5pZCksIFsndmlldzInXSk7XG5cblx0XHRjb25zdCBnZW5lcmF0ZVZpZXdDb250YWluZXIgPSB0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJCeUlkKGdlbmVyYXRlVmlld0NvbnRhaW5lcklkKSE7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJMb2NhdGlvbihnZW5lcmF0ZVZpZXdDb250YWluZXIpLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyKTtcblx0XHRjb25zdCBnZW5lcmF0ZWRWaWV3Q29udGFpbmVyTW9kZWwgPSB0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJNb2RlbChnZW5lcmF0ZVZpZXdDb250YWluZXIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2VuZXJhdGVkVmlld0NvbnRhaW5lck1vZGVsLmFsbFZpZXdEZXNjcmlwdG9ycy5tYXAodiA9PiB2LmlkKSwgWyd2aWV3MSddKTtcblx0fSk7XG5cblx0dGVzdCgnc3RvcmFnZSBjaGFuZ2UgbW92ZSB2aWV3cyBhbmQgcmV0YWluIHZpc2liaWxpdHkgc3RhdGUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgc3RvcmFnZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYVZpZXdEZXNjcmlwdG9yU2VydmljZSgpO1xuXG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lciA9IFZpZXdDb250YWluZXJzUmVnaXN0cnkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHsgaWQ6IGAke3ZpZXdDb250YWluZXJJZFByZWZpeH0tJHtnZW5lcmF0ZVV1aWQoKX1gLCB0aXRsZTogbmxzLmxvY2FsaXplMigndGVzdCcsICd0ZXN0JyksIGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoPGFueT57fSkgfSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yczogSVZpZXdEZXNjcmlwdG9yW10gPSBbXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAndmlldzEnLFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAxJywgJ1Rlc3QgVmlldyAxJyksXG5cdFx0XHRcdGNhbk1vdmVWaWV3OiB0cnVlLFxuXHRcdFx0XHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3ZpZXcyJyxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMicsICdUZXN0IFZpZXcgMicpLFxuXHRcdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZVxuXHRcdFx0fVxuXHRcdF07XG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKHZpZXdEZXNjcmlwdG9ycywgdmlld0NvbnRhaW5lcik7XG5cblx0XHR0ZXN0T2JqZWN0LndoZW5FeHRlbnNpb25zUmVnaXN0ZXJlZCgpO1xuXG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lcjFWaWV3cyA9IHRlc3RPYmplY3QuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHZpZXdDb250YWluZXIpO1xuXHRcdHZpZXdDb250YWluZXIxVmlld3Muc2V0VmlzaWJsZSgndmlldzEnLCBmYWxzZSk7XG5cblx0XHRjb25zdCBnZW5lcmF0ZVZpZXdDb250YWluZXJJZCA9IGB3b3JrYmVuY2gudmlld3Muc2VydmljZS4ke1ZpZXdDb250YWluZXJMb2NhdGlvblRvU3RyaW5nKFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIpfS4ke2dlbmVyYXRlVXVpZCgpfWA7XG5cdFx0Y29uc3Qgdmlld3NDdXN0b21pemF0aW9ucyA9IHtcblx0XHRcdHZpZXdDb250YWluZXJMb2NhdGlvbnM6IHtcblx0XHRcdFx0W2dlbmVyYXRlVmlld0NvbnRhaW5lcklkXTogVmlld0NvbnRhaW5lckxvY2F0aW9uLkF1eGlsaWFyeUJhcixcblx0XHRcdH0sXG5cdFx0XHR2aWV3TG9jYXRpb25zOiB7XG5cdFx0XHRcdCd2aWV3MSc6IGdlbmVyYXRlVmlld0NvbnRhaW5lcklkXG5cdFx0XHR9XG5cdFx0fTtcblx0XHRzdG9yYWdlU2VydmljZS5zdG9yZSgndmlld3MuY3VzdG9taXphdGlvbnMnLCBKU09OLnN0cmluZ2lmeSh2aWV3c0N1c3RvbWl6YXRpb25zKSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cblx0XHRjb25zdCBnZW5lcmF0ZVZpZXdDb250YWluZXIgPSB0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJCeUlkKGdlbmVyYXRlVmlld0NvbnRhaW5lcklkKSE7XG5cdFx0Y29uc3QgZ2VuZXJhdGVkVmlld0NvbnRhaW5lck1vZGVsID0gdGVzdE9iamVjdC5nZXRWaWV3Q29udGFpbmVyTW9kZWwoZ2VuZXJhdGVWaWV3Q29udGFpbmVyKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlld0NvbnRhaW5lcjFWaWV3cy5hbGxWaWV3RGVzY3JpcHRvcnMubWFwKHYgPT4gdi5pZCksIFsndmlldzInXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmdldFZpZXdDb250YWluZXJMb2NhdGlvbihnZW5lcmF0ZVZpZXdDb250YWluZXIpLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdlbmVyYXRlZFZpZXdDb250YWluZXJNb2RlbC5hbGxWaWV3RGVzY3JpcHRvcnMubWFwKHYgPT4gdi5pZCksIFsndmlldzEnXSk7XG5cblx0XHRzdG9yYWdlU2VydmljZS5zdG9yZSgndmlld3MuY3VzdG9taXphdGlvbnMnLCBKU09OLnN0cmluZ2lmeSh7fSksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aWV3Q29udGFpbmVyMVZpZXdzLmFsbFZpZXdEZXNjcmlwdG9ycy5tYXAodiA9PiB2LmlkKS5zb3J0KChhLCBiKSA9PiBjb21wYXJlKGEsIGIpKSwgWyd2aWV3MScsICd2aWV3MiddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpZXdDb250YWluZXIxVmlld3MudmlzaWJsZVZpZXdEZXNjcmlwdG9ycy5tYXAodiA9PiB2LmlkKSwgWyd2aWV3MiddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdlbmVyYXRlZFZpZXdDb250YWluZXJNb2RlbC5hbGxWaWV3RGVzY3JpcHRvcnMubWFwKHYgPT4gdi5pZCksIFtdKTtcblx0fSk7XG5cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxTQUFTO0FBQ3JCLE9BQU8sWUFBWTtBQUNuQixTQUFtRSxjQUFjLHlCQUF5Qix1QkFBc0MscUNBQXFDO0FBQ3JMLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMscUNBQXFDO0FBRTlDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZUFBZTtBQUN4QixTQUFTLCtDQUErQztBQUV4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
