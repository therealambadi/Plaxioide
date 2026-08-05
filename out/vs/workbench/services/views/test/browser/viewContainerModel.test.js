import * as nls from "../../../../../nls.js";
import assert from "assert";
import * as sinon from "sinon";
import { Extensions as ViewContainerExtensions, ViewContainerLocation } from "../../../../common/views.js";
import { dispose } from "../../../../../base/common/lifecycle.js";
import { move } from "../../../../../base/common/arrays.js";
import { workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { ContextKeyService } from "../../../../../platform/contextkey/browser/contextKeyService.js";
import { ViewDescriptorService } from "../../browser/viewDescriptorService.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { SyncDescriptor } from "../../../../../platform/instantiation/common/descriptors.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { Event } from "../../../../../base/common/event.js";
import { getViewsStateStorageId } from "../../common/viewContainerModel.js";
import { runWithFakedTimers } from "../../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
const ViewContainerRegistry = Registry.as(ViewContainerExtensions.ViewContainersRegistry);
const ViewsRegistry = Registry.as(ViewContainerExtensions.ViewsRegistry);
class ViewDescriptorSequence {
  constructor(model) {
    this.disposables = [];
    this.elements = [...model.visibleViewDescriptors];
    model.onDidAddVisibleViewDescriptors((added) => added.forEach(({ viewDescriptor, index }) => this.elements.splice(index, 0, viewDescriptor)), null, this.disposables);
    model.onDidRemoveVisibleViewDescriptors((removed) => removed.sort((a, b) => b.index - a.index).forEach(({ index }) => this.elements.splice(index, 1)), null, this.disposables);
    model.onDidMoveVisibleViewDescriptors(({ from, to }) => move(this.elements, from.index, to.index), null, this.disposables);
  }
  dispose() {
    this.disposables = dispose(this.disposables);
  }
}
suite("ViewContainerModel", () => {
  let container;
  const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();
  let contextKeyService;
  let viewDescriptorService;
  let storageService;
  setup(() => {
    const instantiationService = workbenchInstantiationService(void 0, disposableStore);
    contextKeyService = disposableStore.add(instantiationService.createInstance(ContextKeyService));
    instantiationService.stub(IContextKeyService, contextKeyService);
    storageService = instantiationService.get(IStorageService);
    viewDescriptorService = disposableStore.add(instantiationService.createInstance(ViewDescriptorService));
  });
  teardown(() => {
    ViewsRegistry.deregisterViews(ViewsRegistry.getViews(container), container);
    ViewContainerRegistry.deregisterViewContainer(container);
  });
  test("empty model", function() {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
  });
  test("register/unregister", () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
    const viewDescriptor = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1")
    };
    ViewsRegistry.registerViews([viewDescriptor], container);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 1);
    assert.strictEqual(target.elements.length, 1);
    assert.deepStrictEqual(testObject.visibleViewDescriptors[0], viewDescriptor);
    assert.deepStrictEqual(target.elements[0], viewDescriptor);
    ViewsRegistry.deregisterViews([viewDescriptor], container);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
  });
  test("when contexts", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
    const viewDescriptor = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1"),
      when: ContextKeyExpr.equals("showview1", true)
    };
    ViewsRegistry.registerViews([viewDescriptor], container);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0, "view should not appear since context isnt in");
    assert.strictEqual(target.elements.length, 0);
    const key = contextKeyService.createKey("showview1", false);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0, "view should still not appear since showview1 isnt true");
    assert.strictEqual(target.elements.length, 0);
    key.set(true);
    await new Promise((c) => setTimeout(c, 30));
    assert.strictEqual(testObject.visibleViewDescriptors.length, 1, "view should appear");
    assert.strictEqual(target.elements.length, 1);
    assert.deepStrictEqual(testObject.visibleViewDescriptors[0], viewDescriptor);
    assert.strictEqual(target.elements[0], viewDescriptor);
    key.set(false);
    await new Promise((c) => setTimeout(c, 30));
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0, "view should disappear");
    assert.strictEqual(target.elements.length, 0);
    ViewsRegistry.deregisterViews([viewDescriptor], container);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0, "view should not be there anymore");
    assert.strictEqual(target.elements.length, 0);
    key.set(true);
    await new Promise((c) => setTimeout(c, 30));
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0, "view should not be there anymore");
    assert.strictEqual(target.elements.length, 0);
  }));
  test("when contexts - multiple", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    const view1 = { id: "view1", ctorDescriptor: null, name: nls.localize2("Test View 1", "Test View 1") };
    const view2 = { id: "view2", ctorDescriptor: null, name: nls.localize2("Test View 2", "Test View 2"), when: ContextKeyExpr.equals("showview2", true) };
    ViewsRegistry.registerViews([view1, view2], container);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view1], "only view1 should be visible");
    assert.deepStrictEqual(target.elements, [view1], "only view1 should be visible");
    const key = contextKeyService.createKey("showview2", false);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view1], "still only view1 should be visible");
    assert.deepStrictEqual(target.elements, [view1], "still only view1 should be visible");
    key.set(true);
    await new Promise((c) => setTimeout(c, 30));
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view1, view2], "both views should be visible");
    assert.deepStrictEqual(target.elements, [view1, view2], "both views should be visible");
    ViewsRegistry.deregisterViews([view1, view2], container);
  }));
  test("when contexts - multiple 2", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    const view1 = { id: "view1", ctorDescriptor: null, name: nls.localize2("Test View 1", "Test View 1"), when: ContextKeyExpr.equals("showview1", true) };
    const view2 = { id: "view2", ctorDescriptor: null, name: nls.localize2("Test View 2", "Test View 2") };
    ViewsRegistry.registerViews([view1, view2], container);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view2], "only view2 should be visible");
    assert.deepStrictEqual(target.elements, [view2], "only view2 should be visible");
    const key = contextKeyService.createKey("showview1", false);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view2], "still only view2 should be visible");
    assert.deepStrictEqual(target.elements, [view2], "still only view2 should be visible");
    key.set(true);
    await new Promise((c) => setTimeout(c, 30));
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view1, view2], "both views should be visible");
    assert.deepStrictEqual(target.elements, [view1, view2], "both views should be visible");
    ViewsRegistry.deregisterViews([view1, view2], container);
  }));
  test("setVisible", () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    const view1 = { id: "view1", ctorDescriptor: null, name: nls.localize2("Test View 1", "Test View 1"), canToggleVisibility: true };
    const view2 = { id: "view2", ctorDescriptor: null, name: nls.localize2("Test View 2", "Test View 2"), canToggleVisibility: true };
    const view3 = { id: "view3", ctorDescriptor: null, name: nls.localize2("Test View 3", "Test View 3"), canToggleVisibility: true };
    ViewsRegistry.registerViews([view1, view2, view3], container);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view1, view2, view3]);
    assert.deepStrictEqual(target.elements, [view1, view2, view3]);
    testObject.setVisible("view2", true);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view1, view2, view3], "nothing should happen");
    assert.deepStrictEqual(target.elements, [view1, view2, view3]);
    testObject.setVisible("view2", false);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view1, view3], "view2 should hide");
    assert.deepStrictEqual(target.elements, [view1, view3]);
    testObject.setVisible("view1", false);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view3], "view1 should hide");
    assert.deepStrictEqual(target.elements, [view3]);
    testObject.setVisible("view3", false);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [], "view3 shoud hide");
    assert.deepStrictEqual(target.elements, []);
    testObject.setVisible("view1", true);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view1], "view1 should show");
    assert.deepStrictEqual(target.elements, [view1]);
    testObject.setVisible("view3", true);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view1, view3], "view3 should show");
    assert.deepStrictEqual(target.elements, [view1, view3]);
    testObject.setVisible("view2", true);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view1, view2, view3], "view2 should show");
    assert.deepStrictEqual(target.elements, [view1, view2, view3]);
    ViewsRegistry.deregisterViews([view1, view2, view3], container);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, []);
    assert.deepStrictEqual(target.elements, []);
  });
  test("move", () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    const view1 = { id: "view1", ctorDescriptor: null, name: nls.localize2("Test View 1", "Test View 1") };
    const view2 = { id: "view2", ctorDescriptor: null, name: nls.localize2("Test View 2", "Test View 2") };
    const view3 = { id: "view3", ctorDescriptor: null, name: nls.localize2("Test View 3", "Test View 3") };
    ViewsRegistry.registerViews([view1, view2, view3], container);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view1, view2, view3], "model views should be OK");
    assert.deepStrictEqual(target.elements, [view1, view2, view3], "sql views should be OK");
    testObject.move("view3", "view1");
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view3, view1, view2], "view3 should go to the front");
    assert.deepStrictEqual(target.elements, [view3, view1, view2]);
    testObject.move("view1", "view2");
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view3, view2, view1], "view1 should go to the end");
    assert.deepStrictEqual(target.elements, [view3, view2, view1]);
    testObject.move("view1", "view3");
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view1, view3, view2], "view1 should go to the front");
    assert.deepStrictEqual(target.elements, [view1, view3, view2]);
    testObject.move("view2", "view3");
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view1, view2, view3], "view2 should go to the middle");
    assert.deepStrictEqual(target.elements, [view1, view2, view3]);
  });
  test("view states", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    storageService.store(`${container.id}.state.hidden`, JSON.stringify([{ id: "view1", isHidden: true }]), StorageScope.PROFILE, StorageTarget.MACHINE);
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
    const viewDescriptor = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1")
    };
    ViewsRegistry.registerViews([viewDescriptor], container);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0, "view should not appear since it was set not visible in view state");
    assert.strictEqual(target.elements.length, 0);
  }));
  test("view states and when contexts", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    storageService.store(`${container.id}.state.hidden`, JSON.stringify([{ id: "view1", isHidden: true }]), StorageScope.PROFILE, StorageTarget.MACHINE);
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
    const viewDescriptor = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1"),
      when: ContextKeyExpr.equals("showview1", true)
    };
    ViewsRegistry.registerViews([viewDescriptor], container);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0, "view should not appear since context isnt in");
    assert.strictEqual(target.elements.length, 0);
    const key = contextKeyService.createKey("showview1", false);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0, "view should still not appear since showview1 isnt true");
    assert.strictEqual(target.elements.length, 0);
    key.set(true);
    await new Promise((c) => setTimeout(c, 30));
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0, "view should still not appear since it was set not visible in view state");
    assert.strictEqual(target.elements.length, 0);
  }));
  test("view states and when contexts multiple views", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    storageService.store(`${container.id}.state.hidden`, JSON.stringify([{ id: "view1", isHidden: true }]), StorageScope.PROFILE, StorageTarget.MACHINE);
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
    const view1 = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1"),
      when: ContextKeyExpr.equals("showview", true)
    };
    const view2 = {
      id: "view2",
      ctorDescriptor: null,
      name: nls.localize2("Test View 2", "Test View 2")
    };
    const view3 = {
      id: "view3",
      ctorDescriptor: null,
      name: nls.localize2("Test View 3", "Test View 3"),
      when: ContextKeyExpr.equals("showview", true)
    };
    ViewsRegistry.registerViews([view1, view2, view3], container);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view2], "Only view2 should be visible");
    assert.deepStrictEqual(target.elements, [view2]);
    const key = contextKeyService.createKey("showview", false);
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view2], "Only view2 should be visible");
    assert.deepStrictEqual(target.elements, [view2]);
    key.set(true);
    await new Promise((c) => setTimeout(c, 30));
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view2, view3], "view3 should be visible");
    assert.deepStrictEqual(target.elements, [view2, view3]);
    key.set(false);
    await new Promise((c) => setTimeout(c, 30));
    assert.deepStrictEqual(testObject.visibleViewDescriptors, [view2], "Only view2 should be visible");
    assert.deepStrictEqual(target.elements, [view2]);
  }));
  test("remove event is not triggered if view was hidden and removed", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    const viewDescriptor = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1"),
      when: ContextKeyExpr.equals("showview1", true),
      canToggleVisibility: true
    };
    ViewsRegistry.registerViews([viewDescriptor], container);
    const key = contextKeyService.createKey("showview1", true);
    await new Promise((c) => setTimeout(c, 30));
    assert.strictEqual(testObject.visibleViewDescriptors.length, 1, "view should appear after context is set");
    assert.strictEqual(target.elements.length, 1);
    testObject.setVisible("view1", false);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0, "view should disappear after setting visibility to false");
    assert.strictEqual(target.elements.length, 0);
    const targetEvent = sinon.spy();
    disposableStore.add(testObject.onDidRemoveVisibleViewDescriptors(targetEvent));
    key.set(false);
    await new Promise((c) => setTimeout(c, 30));
    assert.ok(!targetEvent.called, "remove event should not be called since it is already hidden");
  }));
  test("add event is not triggered if view was set visible (when visible) and not active", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    const viewDescriptor = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1"),
      when: ContextKeyExpr.equals("showview1", true),
      canToggleVisibility: true
    };
    const key = contextKeyService.createKey("showview1", true);
    key.set(false);
    ViewsRegistry.registerViews([viewDescriptor], container);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
    const targetEvent = sinon.spy();
    disposableStore.add(testObject.onDidAddVisibleViewDescriptors(targetEvent));
    testObject.setVisible("view1", true);
    assert.ok(!targetEvent.called, "add event should not be called since it is already visible");
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
  }));
  test("remove event is not triggered if view was hidden and not active", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    const viewDescriptor = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1"),
      when: ContextKeyExpr.equals("showview1", true),
      canToggleVisibility: true
    };
    const key = contextKeyService.createKey("showview1", true);
    key.set(false);
    ViewsRegistry.registerViews([viewDescriptor], container);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
    const targetEvent = sinon.spy();
    disposableStore.add(testObject.onDidAddVisibleViewDescriptors(targetEvent));
    testObject.setVisible("view1", false);
    assert.ok(!targetEvent.called, "add event should not be called since it is disabled");
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
  }));
  test("add event is not triggered if view was set visible (when not visible) and not active", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    const viewDescriptor = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1"),
      when: ContextKeyExpr.equals("showview1", true),
      canToggleVisibility: true
    };
    const key = contextKeyService.createKey("showview1", true);
    key.set(false);
    ViewsRegistry.registerViews([viewDescriptor], container);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
    testObject.setVisible("view1", false);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
    const targetEvent = sinon.spy();
    disposableStore.add(testObject.onDidAddVisibleViewDescriptors(targetEvent));
    testObject.setVisible("view1", true);
    assert.ok(!targetEvent.called, "add event should not be called since it is disabled");
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
  }));
  test("added view descriptors are in ascending order in the event", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    ViewsRegistry.registerViews([{
      id: "view5",
      ctorDescriptor: null,
      name: nls.localize2("Test View 5", "Test View 5"),
      canToggleVisibility: true,
      order: 5
    }, {
      id: "view2",
      ctorDescriptor: null,
      name: nls.localize2("Test View 2", "Test View 2"),
      canToggleVisibility: true,
      order: 2
    }], container);
    assert.strictEqual(target.elements.length, 2);
    assert.strictEqual(target.elements[0].id, "view2");
    assert.strictEqual(target.elements[1].id, "view5");
    ViewsRegistry.registerViews([{
      id: "view4",
      ctorDescriptor: null,
      name: nls.localize2("Test View 4", "Test View 4"),
      canToggleVisibility: true,
      order: 4
    }, {
      id: "view3",
      ctorDescriptor: null,
      name: nls.localize2("Test View 3", "Test View 3"),
      canToggleVisibility: true,
      order: 3
    }, {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1"),
      canToggleVisibility: true,
      order: 1
    }], container);
    assert.strictEqual(target.elements.length, 5);
    assert.strictEqual(target.elements[0].id, "view1");
    assert.strictEqual(target.elements[1].id, "view2");
    assert.strictEqual(target.elements[2].id, "view3");
    assert.strictEqual(target.elements[3].id, "view4");
    assert.strictEqual(target.elements[4].id, "view5");
  }));
  test("add event is triggered only once when view is set visible while it is set active", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    const viewDescriptor = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1"),
      when: ContextKeyExpr.equals("showview1", true),
      canToggleVisibility: true
    };
    const key = contextKeyService.createKey("showview1", true);
    key.set(false);
    ViewsRegistry.registerViews([viewDescriptor], container);
    testObject.setVisible("view1", false);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
    const targetEvent = sinon.spy();
    disposableStore.add(testObject.onDidAddVisibleViewDescriptors(targetEvent));
    disposableStore.add(Event.once(testObject.onDidChangeActiveViewDescriptors)(() => testObject.setVisible("view1", true)));
    key.set(true);
    await new Promise((c) => setTimeout(c, 30));
    assert.strictEqual(targetEvent.callCount, 1);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 1);
    assert.strictEqual(target.elements.length, 1);
    assert.strictEqual(target.elements[0].id, "view1");
  }));
  test("add event is not triggered only when view is set hidden while it is set active", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    const viewDescriptor = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1"),
      when: ContextKeyExpr.equals("showview1", true),
      canToggleVisibility: true
    };
    const key = contextKeyService.createKey("showview1", true);
    key.set(false);
    ViewsRegistry.registerViews([viewDescriptor], container);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
    const targetEvent = sinon.spy();
    disposableStore.add(testObject.onDidAddVisibleViewDescriptors(targetEvent));
    disposableStore.add(Event.once(testObject.onDidChangeActiveViewDescriptors)(() => testObject.setVisible("view1", false)));
    key.set(true);
    await new Promise((c) => setTimeout(c, 30));
    assert.strictEqual(targetEvent.callCount, 0);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
    assert.strictEqual(target.elements.length, 0);
  }));
  test("#142087: view descriptor visibility is not reset", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const viewDescriptor = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1"),
      canToggleVisibility: true
    };
    storageService.store(getViewsStateStorageId("test.state"), JSON.stringify([{
      id: viewDescriptor.id,
      isHidden: true,
      order: void 0
    }]), StorageScope.PROFILE, StorageTarget.USER);
    ViewsRegistry.registerViews([viewDescriptor], container);
    assert.strictEqual(testObject.isVisible(viewDescriptor.id), false);
    assert.strictEqual(testObject.activeViewDescriptors[0].id, viewDescriptor.id);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
  }));
  test("remove event is triggered properly if multiple views are hidden at the same time", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    const viewDescriptor1 = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1"),
      canToggleVisibility: true
    };
    const viewDescriptor2 = {
      id: "view2",
      ctorDescriptor: null,
      name: nls.localize2("Test View 2", "Test View 2"),
      canToggleVisibility: true
    };
    const viewDescriptor3 = {
      id: "view3",
      ctorDescriptor: null,
      name: nls.localize2("Test View 3", "Test View 3"),
      canToggleVisibility: true
    };
    ViewsRegistry.registerViews([viewDescriptor1, viewDescriptor2, viewDescriptor3], container);
    const remomveEvent = sinon.spy();
    disposableStore.add(testObject.onDidRemoveVisibleViewDescriptors(remomveEvent));
    const addEvent = sinon.spy();
    disposableStore.add(testObject.onDidAddVisibleViewDescriptors(addEvent));
    storageService.store(getViewsStateStorageId("test.state"), JSON.stringify([{
      id: viewDescriptor1.id,
      isHidden: false,
      order: void 0
    }, {
      id: viewDescriptor2.id,
      isHidden: true,
      order: void 0
    }, {
      id: viewDescriptor3.id,
      isHidden: true,
      order: void 0
    }]), StorageScope.PROFILE, StorageTarget.USER);
    assert.ok(!addEvent.called, "add event should not be called");
    assert.ok(remomveEvent.calledOnce, "remove event should be called");
    assert.deepStrictEqual(remomveEvent.args[0][0], [{
      viewDescriptor: viewDescriptor3,
      index: 2
    }, {
      viewDescriptor: viewDescriptor2,
      index: 1
    }]);
    assert.strictEqual(target.elements.length, 1);
    assert.strictEqual(target.elements[0].id, viewDescriptor1.id);
  }));
  test("add event is triggered properly if multiple views are hidden at the same time", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    const viewDescriptor1 = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1"),
      canToggleVisibility: true
    };
    const viewDescriptor2 = {
      id: "view2",
      ctorDescriptor: null,
      name: nls.localize2("Test View 2", "Test View 2"),
      canToggleVisibility: true
    };
    const viewDescriptor3 = {
      id: "view3",
      ctorDescriptor: null,
      name: nls.localize2("Test View 3", "Test View 3"),
      canToggleVisibility: true
    };
    ViewsRegistry.registerViews([viewDescriptor1, viewDescriptor2, viewDescriptor3], container);
    testObject.setVisible(viewDescriptor1.id, false);
    testObject.setVisible(viewDescriptor3.id, false);
    const removeEvent = sinon.spy();
    disposableStore.add(testObject.onDidRemoveVisibleViewDescriptors(removeEvent));
    const addEvent = sinon.spy();
    disposableStore.add(testObject.onDidAddVisibleViewDescriptors(addEvent));
    storageService.store(getViewsStateStorageId("test.state"), JSON.stringify([{
      id: viewDescriptor1.id,
      isHidden: false,
      order: void 0
    }, {
      id: viewDescriptor2.id,
      isHidden: false,
      order: void 0
    }, {
      id: viewDescriptor3.id,
      isHidden: false,
      order: void 0
    }]), StorageScope.PROFILE, StorageTarget.USER);
    assert.ok(!removeEvent.called, "remove event should not be called");
    assert.ok(addEvent.calledOnce, "add event should be called once");
    assert.deepStrictEqual(addEvent.args[0][0], [{
      viewDescriptor: viewDescriptor1,
      index: 0,
      collapsed: false,
      size: void 0
    }, {
      viewDescriptor: viewDescriptor3,
      index: 2,
      collapsed: false,
      size: void 0
    }]);
    assert.strictEqual(target.elements.length, 3);
    assert.strictEqual(target.elements[0].id, viewDescriptor1.id);
    assert.strictEqual(target.elements[1].id, viewDescriptor2.id);
    assert.strictEqual(target.elements[2].id, viewDescriptor3.id);
  }));
  test("add and remove events are triggered properly if multiple views are hidden and added at the same time", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    const target = disposableStore.add(new ViewDescriptorSequence(testObject));
    const viewDescriptor1 = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1"),
      canToggleVisibility: true
    };
    const viewDescriptor2 = {
      id: "view2",
      ctorDescriptor: null,
      name: nls.localize2("Test View 2", "Test View 2"),
      canToggleVisibility: true
    };
    const viewDescriptor3 = {
      id: "view3",
      ctorDescriptor: null,
      name: nls.localize2("Test View 3", "Test View 3"),
      canToggleVisibility: true
    };
    const viewDescriptor4 = {
      id: "view4",
      ctorDescriptor: null,
      name: nls.localize2("Test View 4", "Test View 4"),
      canToggleVisibility: true
    };
    ViewsRegistry.registerViews([viewDescriptor1, viewDescriptor2, viewDescriptor3, viewDescriptor4], container);
    testObject.setVisible(viewDescriptor1.id, false);
    const removeEvent = sinon.spy();
    disposableStore.add(testObject.onDidRemoveVisibleViewDescriptors(removeEvent));
    const addEvent = sinon.spy();
    disposableStore.add(testObject.onDidAddVisibleViewDescriptors(addEvent));
    storageService.store(getViewsStateStorageId("test.state"), JSON.stringify([{
      id: viewDescriptor1.id,
      isHidden: false,
      order: void 0
    }, {
      id: viewDescriptor2.id,
      isHidden: true,
      order: void 0
    }, {
      id: viewDescriptor3.id,
      isHidden: false,
      order: void 0
    }, {
      id: viewDescriptor4.id,
      isHidden: true,
      order: void 0
    }]), StorageScope.PROFILE, StorageTarget.USER);
    assert.ok(removeEvent.calledOnce, "remove event should be called once");
    assert.deepStrictEqual(removeEvent.args[0][0], [{
      viewDescriptor: viewDescriptor4,
      index: 2
    }, {
      viewDescriptor: viewDescriptor2,
      index: 0
    }]);
    assert.ok(addEvent.calledOnce, "add event should be called once");
    assert.deepStrictEqual(addEvent.args[0][0], [{
      viewDescriptor: viewDescriptor1,
      index: 0,
      collapsed: false,
      size: void 0
    }]);
    assert.strictEqual(target.elements.length, 2);
    assert.strictEqual(target.elements[0].id, viewDescriptor1.id);
    assert.strictEqual(target.elements[1].id, viewDescriptor3.id);
  }));
  test("newly added view descriptor is hidden if it was toggled hidden in storage before adding", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    container = ViewContainerRegistry.registerViewContainer({ id: "test", title: nls.localize2("test", "test"), ctorDescriptor: new SyncDescriptor({}) }, ViewContainerLocation.Sidebar);
    const viewDescriptor = {
      id: "view1",
      ctorDescriptor: null,
      name: nls.localize2("Test View 1", "Test View 1"),
      canToggleVisibility: true
    };
    storageService.store(getViewsStateStorageId("test.state"), JSON.stringify([{
      id: viewDescriptor.id,
      isHidden: false,
      order: void 0
    }]), StorageScope.PROFILE, StorageTarget.USER);
    const testObject = viewDescriptorService.getViewContainerModel(container);
    storageService.store(getViewsStateStorageId("test.state"), JSON.stringify([{
      id: viewDescriptor.id,
      isHidden: true,
      order: void 0
    }]), StorageScope.PROFILE, StorageTarget.USER);
    ViewsRegistry.registerViews([viewDescriptor], container);
    assert.strictEqual(testObject.isVisible(viewDescriptor.id), false);
    assert.strictEqual(testObject.activeViewDescriptors[0].id, viewDescriptor.id);
    assert.strictEqual(testObject.visibleViewDescriptors.length, 0);
  }));
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdmlld3MvdGVzdC9icm93c2VyL3ZpZXdDb250YWluZXJNb2RlbC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBzaW5vbiBmcm9tICdzaW5vbic7XG5pbXBvcnQgeyBJVmlld3NSZWdpc3RyeSwgSVZpZXdEZXNjcmlwdG9yLCBJVmlld0NvbnRhaW5lcnNSZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBWaWV3Q29udGFpbmVyRXh0ZW5zaW9ucywgVmlld0NvbnRhaW5lckxvY2F0aW9uLCBJVmlld0NvbnRhaW5lck1vZGVsLCBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBWaWV3Q29udGFpbmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCBkaXNwb3NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IG1vdmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9icm93c2VyL2NvbnRleHRLZXlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFZpZXdEZXNjcmlwdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgZ2V0Vmlld3NTdGF0ZVN0b3JhZ2VJZCB9IGZyb20gJy4uLy4uL2NvbW1vbi92aWV3Q29udGFpbmVyTW9kZWwuanMnO1xuaW1wb3J0IHsgcnVuV2l0aEZha2VkVGltZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi90aW1lVHJhdmVsU2NoZWR1bGVyLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5jb25zdCBWaWV3Q29udGFpbmVyUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJVmlld0NvbnRhaW5lcnNSZWdpc3RyeT4oVmlld0NvbnRhaW5lckV4dGVuc2lvbnMuVmlld0NvbnRhaW5lcnNSZWdpc3RyeSk7XG5jb25zdCBWaWV3c1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVZpZXdzUmVnaXN0cnk+KFZpZXdDb250YWluZXJFeHRlbnNpb25zLlZpZXdzUmVnaXN0cnkpO1xuXG5jbGFzcyBWaWV3RGVzY3JpcHRvclNlcXVlbmNlIHtcblxuXHRyZWFkb25seSBlbGVtZW50czogSVZpZXdEZXNjcmlwdG9yW107XG5cdHByaXZhdGUgZGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlW10gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihtb2RlbDogSVZpZXdDb250YWluZXJNb2RlbCkge1xuXHRcdHRoaXMuZWxlbWVudHMgPSBbLi4ubW9kZWwudmlzaWJsZVZpZXdEZXNjcmlwdG9yc107XG5cdFx0bW9kZWwub25EaWRBZGRWaXNpYmxlVmlld0Rlc2NyaXB0b3JzKGFkZGVkID0+IGFkZGVkLmZvckVhY2goKHsgdmlld0Rlc2NyaXB0b3IsIGluZGV4IH0pID0+IHRoaXMuZWxlbWVudHMuc3BsaWNlKGluZGV4LCAwLCB2aWV3RGVzY3JpcHRvcikpLCBudWxsLCB0aGlzLmRpc3Bvc2FibGVzKTtcblx0XHRtb2RlbC5vbkRpZFJlbW92ZVZpc2libGVWaWV3RGVzY3JpcHRvcnMocmVtb3ZlZCA9PiByZW1vdmVkLnNvcnQoKGEsIGIpID0+IGIuaW5kZXggLSBhLmluZGV4KS5mb3JFYWNoKCh7IGluZGV4IH0pID0+IHRoaXMuZWxlbWVudHMuc3BsaWNlKGluZGV4LCAxKSksIG51bGwsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHRcdG1vZGVsLm9uRGlkTW92ZVZpc2libGVWaWV3RGVzY3JpcHRvcnMoKHsgZnJvbSwgdG8gfSkgPT4gbW92ZSh0aGlzLmVsZW1lbnRzLCBmcm9tLmluZGV4LCB0by5pbmRleCksIG51bGwsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLmRpc3Bvc2FibGVzID0gZGlzcG9zZSh0aGlzLmRpc3Bvc2FibGVzKTtcblx0fVxufVxuXG5zdWl0ZSgnVmlld0NvbnRhaW5lck1vZGVsJywgKCkgPT4ge1xuXG5cdGxldCBjb250YWluZXI6IFZpZXdDb250YWluZXI7XG5cdGNvbnN0IGRpc3Bvc2FibGVTdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXHRsZXQgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZTtcblx0bGV0IHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZTtcblx0bGV0IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2U7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIGRpc3Bvc2FibGVTdG9yZSk7XG5cdFx0Y29udGV4dEtleVNlcnZpY2UgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnRleHRLZXlTZXJ2aWNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udGV4dEtleVNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRzdG9yYWdlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJU3RvcmFnZVNlcnZpY2UpO1xuXHRcdHZpZXdEZXNjcmlwdG9yU2VydmljZSA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVmlld0Rlc2NyaXB0b3JTZXJ2aWNlKSk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRWaWV3c1JlZ2lzdHJ5LmRlcmVnaXN0ZXJWaWV3cyhWaWV3c1JlZ2lzdHJ5LmdldFZpZXdzKGNvbnRhaW5lciksIGNvbnRhaW5lcik7XG5cdFx0Vmlld0NvbnRhaW5lclJlZ2lzdHJ5LmRlcmVnaXN0ZXJWaWV3Q29udGFpbmVyKGNvbnRhaW5lcik7XG5cdH0pO1xuXG5cdHRlc3QoJ2VtcHR5IG1vZGVsJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnRhaW5lciA9IFZpZXdDb250YWluZXJSZWdpc3RyeS5yZWdpc3RlclZpZXdDb250YWluZXIoeyBpZDogJ3Rlc3QnLCB0aXRsZTogbmxzLmxvY2FsaXplMigndGVzdCcsICd0ZXN0JyksIGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoPGFueT57fSkgfSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKGNvbnRhaW5lcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3QudmlzaWJsZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGgsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWdpc3Rlci91bnJlZ2lzdGVyJywgKCkgPT4ge1xuXHRcdGNvbnRhaW5lciA9IFZpZXdDb250YWluZXJSZWdpc3RyeS5yZWdpc3RlclZpZXdDb250YWluZXIoeyBpZDogJ3Rlc3QnLCB0aXRsZTogbmxzLmxvY2FsaXplMigndGVzdCcsICd0ZXN0JyksIGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoPGFueT57fSkgfSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKGNvbnRhaW5lcik7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVmlld0Rlc2NyaXB0b3JTZXF1ZW5jZSh0ZXN0T2JqZWN0KSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cy5sZW5ndGgsIDApO1xuXG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3I6IElWaWV3RGVzY3JpcHRvciA9IHtcblx0XHRcdGlkOiAndmlldzEnLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDEnLCAnVGVzdCBWaWV3IDEnKVxuXHRcdH07XG5cblx0XHRWaWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3MoW3ZpZXdEZXNjcmlwdG9yXSwgY29udGFpbmVyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnNbMF0sIHZpZXdEZXNjcmlwdG9yKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50c1swXSwgdmlld0Rlc2NyaXB0b3IpO1xuXG5cdFx0Vmlld3NSZWdpc3RyeS5kZXJlZ2lzdGVyVmlld3MoW3ZpZXdEZXNjcmlwdG9yXSwgY29udGFpbmVyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3doZW4gY29udGV4dHMnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRjb250YWluZXIgPSBWaWV3Q29udGFpbmVyUmVnaXN0cnkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHsgaWQ6ICd0ZXN0JywgdGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3Rlc3QnLCAndGVzdCcpLCBjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKDxhbnk+e30pIH0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXIpO1xuXHRcdGNvbnN0IHRhcmdldCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFZpZXdEZXNjcmlwdG9yU2VxdWVuY2UodGVzdE9iamVjdCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLmxlbmd0aCwgMCk7XG5cblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcjogSVZpZXdEZXNjcmlwdG9yID0ge1xuXHRcdFx0aWQ6ICd2aWV3MScsXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMScsICdUZXN0IFZpZXcgMScpLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdzaG93dmlldzEnLCB0cnVlKVxuXHRcdH07XG5cblx0XHRWaWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3MoW3ZpZXdEZXNjcmlwdG9yXSwgY29udGFpbmVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMCwgJ3ZpZXcgc2hvdWxkIG5vdCBhcHBlYXIgc2luY2UgY29udGV4dCBpc250IGluJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cy5sZW5ndGgsIDApO1xuXG5cdFx0Y29uc3Qga2V5ID0gY29udGV4dEtleVNlcnZpY2UuY3JlYXRlS2V5PGJvb2xlYW4+KCdzaG93dmlldzEnLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3QudmlzaWJsZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGgsIDAsICd2aWV3IHNob3VsZCBzdGlsbCBub3QgYXBwZWFyIHNpbmNlIHNob3d2aWV3MSBpc250IHRydWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLmxlbmd0aCwgMCk7XG5cblx0XHRrZXkuc2V0KHRydWUpO1xuXHRcdGF3YWl0IG5ldyBQcm9taXNlKGMgPT4gc2V0VGltZW91dChjLCAzMCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAxLCAndmlldyBzaG91bGQgYXBwZWFyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzWzBdLCB2aWV3RGVzY3JpcHRvcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50c1swXSwgdmlld0Rlc2NyaXB0b3IpO1xuXG5cdFx0a2V5LnNldChmYWxzZSk7XG5cdFx0YXdhaXQgbmV3IFByb21pc2UoYyA9PiBzZXRUaW1lb3V0KGMsIDMwKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3QudmlzaWJsZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGgsIDAsICd2aWV3IHNob3VsZCBkaXNhcHBlYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLmxlbmd0aCwgMCk7XG5cblx0XHRWaWV3c1JlZ2lzdHJ5LmRlcmVnaXN0ZXJWaWV3cyhbdmlld0Rlc2NyaXB0b3JdLCBjb250YWluZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAwLCAndmlldyBzaG91bGQgbm90IGJlIHRoZXJlIGFueW1vcmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLmxlbmd0aCwgMCk7XG5cblx0XHRrZXkuc2V0KHRydWUpO1xuXHRcdGF3YWl0IG5ldyBQcm9taXNlKGMgPT4gc2V0VGltZW91dChjLCAzMCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAwLCAndmlldyBzaG91bGQgbm90IGJlIHRoZXJlIGFueW1vcmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLmxlbmd0aCwgMCk7XG5cdH0pKTtcblxuXHR0ZXN0KCd3aGVuIGNvbnRleHRzIC0gbXVsdGlwbGUnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRjb250YWluZXIgPSBWaWV3Q29udGFpbmVyUmVnaXN0cnkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHsgaWQ6ICd0ZXN0JywgdGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3Rlc3QnLCAndGVzdCcpLCBjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKDxhbnk+e30pIH0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXIpO1xuXHRcdGNvbnN0IHRhcmdldCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFZpZXdEZXNjcmlwdG9yU2VxdWVuY2UodGVzdE9iamVjdCkpO1xuXHRcdGNvbnN0IHZpZXcxOiBJVmlld0Rlc2NyaXB0b3IgPSB7IGlkOiAndmlldzEnLCBjdG9yRGVzY3JpcHRvcjogbnVsbCEsIG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAxJywgJ1Rlc3QgVmlldyAxJykgfTtcblx0XHRjb25zdCB2aWV3MjogSVZpZXdEZXNjcmlwdG9yID0geyBpZDogJ3ZpZXcyJywgY3RvckRlc2NyaXB0b3I6IG51bGwhLCBuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMicsICdUZXN0IFZpZXcgMicpLCB3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3Nob3d2aWV3MicsIHRydWUpIH07XG5cblx0XHRWaWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3MoW3ZpZXcxLCB2aWV3Ml0sIGNvbnRhaW5lcik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMsIFt2aWV3MV0sICdvbmx5IHZpZXcxIHNob3VsZCBiZSB2aXNpYmxlJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHMsIFt2aWV3MV0sICdvbmx5IHZpZXcxIHNob3VsZCBiZSB2aXNpYmxlJyk7XG5cblx0XHRjb25zdCBrZXkgPSBjb250ZXh0S2V5U2VydmljZS5jcmVhdGVLZXk8Ym9vbGVhbj4oJ3Nob3d2aWV3MicsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QudmlzaWJsZVZpZXdEZXNjcmlwdG9ycywgW3ZpZXcxXSwgJ3N0aWxsIG9ubHkgdmlldzEgc2hvdWxkIGJlIHZpc2libGUnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cywgW3ZpZXcxXSwgJ3N0aWxsIG9ubHkgdmlldzEgc2hvdWxkIGJlIHZpc2libGUnKTtcblxuXHRcdGtleS5zZXQodHJ1ZSk7XG5cdFx0YXdhaXQgbmV3IFByb21pc2UoYyA9PiBzZXRUaW1lb3V0KGMsIDMwKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMsIFt2aWV3MSwgdmlldzJdLCAnYm90aCB2aWV3cyBzaG91bGQgYmUgdmlzaWJsZScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLCBbdmlldzEsIHZpZXcyXSwgJ2JvdGggdmlld3Mgc2hvdWxkIGJlIHZpc2libGUnKTtcblxuXHRcdFZpZXdzUmVnaXN0cnkuZGVyZWdpc3RlclZpZXdzKFt2aWV3MSwgdmlldzJdLCBjb250YWluZXIpO1xuXHR9KSk7XG5cblx0dGVzdCgnd2hlbiBjb250ZXh0cyAtIG11bHRpcGxlIDInLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRjb250YWluZXIgPSBWaWV3Q29udGFpbmVyUmVnaXN0cnkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHsgaWQ6ICd0ZXN0JywgdGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3Rlc3QnLCAndGVzdCcpLCBjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKDxhbnk+e30pIH0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXIpO1xuXHRcdGNvbnN0IHRhcmdldCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFZpZXdEZXNjcmlwdG9yU2VxdWVuY2UodGVzdE9iamVjdCkpO1xuXHRcdGNvbnN0IHZpZXcxOiBJVmlld0Rlc2NyaXB0b3IgPSB7IGlkOiAndmlldzEnLCBjdG9yRGVzY3JpcHRvcjogbnVsbCEsIG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAxJywgJ1Rlc3QgVmlldyAxJyksIHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygnc2hvd3ZpZXcxJywgdHJ1ZSkgfTtcblx0XHRjb25zdCB2aWV3MjogSVZpZXdEZXNjcmlwdG9yID0geyBpZDogJ3ZpZXcyJywgY3RvckRlc2NyaXB0b3I6IG51bGwhLCBuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMicsICdUZXN0IFZpZXcgMicpIH07XG5cblx0XHRWaWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3MoW3ZpZXcxLCB2aWV3Ml0sIGNvbnRhaW5lcik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMsIFt2aWV3Ml0sICdvbmx5IHZpZXcyIHNob3VsZCBiZSB2aXNpYmxlJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHMsIFt2aWV3Ml0sICdvbmx5IHZpZXcyIHNob3VsZCBiZSB2aXNpYmxlJyk7XG5cblx0XHRjb25zdCBrZXkgPSBjb250ZXh0S2V5U2VydmljZS5jcmVhdGVLZXk8Ym9vbGVhbj4oJ3Nob3d2aWV3MScsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QudmlzaWJsZVZpZXdEZXNjcmlwdG9ycywgW3ZpZXcyXSwgJ3N0aWxsIG9ubHkgdmlldzIgc2hvdWxkIGJlIHZpc2libGUnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cywgW3ZpZXcyXSwgJ3N0aWxsIG9ubHkgdmlldzIgc2hvdWxkIGJlIHZpc2libGUnKTtcblxuXHRcdGtleS5zZXQodHJ1ZSk7XG5cdFx0YXdhaXQgbmV3IFByb21pc2UoYyA9PiBzZXRUaW1lb3V0KGMsIDMwKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMsIFt2aWV3MSwgdmlldzJdLCAnYm90aCB2aWV3cyBzaG91bGQgYmUgdmlzaWJsZScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLCBbdmlldzEsIHZpZXcyXSwgJ2JvdGggdmlld3Mgc2hvdWxkIGJlIHZpc2libGUnKTtcblxuXHRcdFZpZXdzUmVnaXN0cnkuZGVyZWdpc3RlclZpZXdzKFt2aWV3MSwgdmlldzJdLCBjb250YWluZXIpO1xuXHR9KSk7XG5cblx0dGVzdCgnc2V0VmlzaWJsZScsICgpID0+IHtcblx0XHRjb250YWluZXIgPSBWaWV3Q29udGFpbmVyUmVnaXN0cnkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHsgaWQ6ICd0ZXN0JywgdGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3Rlc3QnLCAndGVzdCcpLCBjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKDxhbnk+e30pIH0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXIpO1xuXHRcdGNvbnN0IHRhcmdldCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFZpZXdEZXNjcmlwdG9yU2VxdWVuY2UodGVzdE9iamVjdCkpO1xuXHRcdGNvbnN0IHZpZXcxOiBJVmlld0Rlc2NyaXB0b3IgPSB7IGlkOiAndmlldzEnLCBjdG9yRGVzY3JpcHRvcjogbnVsbCEsIG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAxJywgJ1Rlc3QgVmlldyAxJyksIGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWUgfTtcblx0XHRjb25zdCB2aWV3MjogSVZpZXdEZXNjcmlwdG9yID0geyBpZDogJ3ZpZXcyJywgY3RvckRlc2NyaXB0b3I6IG51bGwhLCBuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMicsICdUZXN0IFZpZXcgMicpLCBjYW5Ub2dnbGVWaXNpYmlsaXR5OiB0cnVlIH07XG5cdFx0Y29uc3QgdmlldzM6IElWaWV3RGVzY3JpcHRvciA9IHsgaWQ6ICd2aWV3MycsIGN0b3JEZXNjcmlwdG9yOiBudWxsISwgbmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDMnLCAnVGVzdCBWaWV3IDMnKSwgY2FuVG9nZ2xlVmlzaWJpbGl0eTogdHJ1ZSB9O1xuXG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKFt2aWV3MSwgdmlldzIsIHZpZXczXSwgY29udGFpbmVyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QudmlzaWJsZVZpZXdEZXNjcmlwdG9ycywgW3ZpZXcxLCB2aWV3MiwgdmlldzNdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cywgW3ZpZXcxLCB2aWV3MiwgdmlldzNdKTtcblxuXHRcdHRlc3RPYmplY3Quc2V0VmlzaWJsZSgndmlldzInLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QudmlzaWJsZVZpZXdEZXNjcmlwdG9ycywgW3ZpZXcxLCB2aWV3MiwgdmlldzNdLCAnbm90aGluZyBzaG91bGQgaGFwcGVuJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHMsIFt2aWV3MSwgdmlldzIsIHZpZXczXSk7XG5cblx0XHR0ZXN0T2JqZWN0LnNldFZpc2libGUoJ3ZpZXcyJywgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLCBbdmlldzEsIHZpZXczXSwgJ3ZpZXcyIHNob3VsZCBoaWRlJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHMsIFt2aWV3MSwgdmlldzNdKTtcblxuXHRcdHRlc3RPYmplY3Quc2V0VmlzaWJsZSgndmlldzEnLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMsIFt2aWV3M10sICd2aWV3MSBzaG91bGQgaGlkZScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLCBbdmlldzNdKTtcblxuXHRcdHRlc3RPYmplY3Quc2V0VmlzaWJsZSgndmlldzMnLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMsIFtdLCAndmlldzMgc2hvdWQgaGlkZScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLCBbXSk7XG5cblx0XHR0ZXN0T2JqZWN0LnNldFZpc2libGUoJ3ZpZXcxJywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMsIFt2aWV3MV0sICd2aWV3MSBzaG91bGQgc2hvdycpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLCBbdmlldzFdKTtcblxuXHRcdHRlc3RPYmplY3Quc2V0VmlzaWJsZSgndmlldzMnLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QudmlzaWJsZVZpZXdEZXNjcmlwdG9ycywgW3ZpZXcxLCB2aWV3M10sICd2aWV3MyBzaG91bGQgc2hvdycpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLCBbdmlldzEsIHZpZXczXSk7XG5cblx0XHR0ZXN0T2JqZWN0LnNldFZpc2libGUoJ3ZpZXcyJywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMsIFt2aWV3MSwgdmlldzIsIHZpZXczXSwgJ3ZpZXcyIHNob3VsZCBzaG93Jyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHMsIFt2aWV3MSwgdmlldzIsIHZpZXczXSk7XG5cblx0XHRWaWV3c1JlZ2lzdHJ5LmRlcmVnaXN0ZXJWaWV3cyhbdmlldzEsIHZpZXcyLCB2aWV3M10sIGNvbnRhaW5lcik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlJywgKCkgPT4ge1xuXHRcdGNvbnRhaW5lciA9IFZpZXdDb250YWluZXJSZWdpc3RyeS5yZWdpc3RlclZpZXdDb250YWluZXIoeyBpZDogJ3Rlc3QnLCB0aXRsZTogbmxzLmxvY2FsaXplMigndGVzdCcsICd0ZXN0JyksIGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoPGFueT57fSkgfSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKGNvbnRhaW5lcik7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVmlld0Rlc2NyaXB0b3JTZXF1ZW5jZSh0ZXN0T2JqZWN0KSk7XG5cdFx0Y29uc3QgdmlldzE6IElWaWV3RGVzY3JpcHRvciA9IHsgaWQ6ICd2aWV3MScsIGN0b3JEZXNjcmlwdG9yOiBudWxsISwgbmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDEnLCAnVGVzdCBWaWV3IDEnKSB9O1xuXHRcdGNvbnN0IHZpZXcyOiBJVmlld0Rlc2NyaXB0b3IgPSB7IGlkOiAndmlldzInLCBjdG9yRGVzY3JpcHRvcjogbnVsbCEsIG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAyJywgJ1Rlc3QgVmlldyAyJykgfTtcblx0XHRjb25zdCB2aWV3MzogSVZpZXdEZXNjcmlwdG9yID0geyBpZDogJ3ZpZXczJywgY3RvckRlc2NyaXB0b3I6IG51bGwhLCBuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMycsICdUZXN0IFZpZXcgMycpIH07XG5cblx0XHRWaWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3MoW3ZpZXcxLCB2aWV3MiwgdmlldzNdLCBjb250YWluZXIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLCBbdmlldzEsIHZpZXcyLCB2aWV3M10sICdtb2RlbCB2aWV3cyBzaG91bGQgYmUgT0snKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cywgW3ZpZXcxLCB2aWV3MiwgdmlldzNdLCAnc3FsIHZpZXdzIHNob3VsZCBiZSBPSycpO1xuXG5cdFx0dGVzdE9iamVjdC5tb3ZlKCd2aWV3MycsICd2aWV3MScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLCBbdmlldzMsIHZpZXcxLCB2aWV3Ml0sICd2aWV3MyBzaG91bGQgZ28gdG8gdGhlIGZyb250Jyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHMsIFt2aWV3MywgdmlldzEsIHZpZXcyXSk7XG5cblx0XHR0ZXN0T2JqZWN0Lm1vdmUoJ3ZpZXcxJywgJ3ZpZXcyJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMsIFt2aWV3MywgdmlldzIsIHZpZXcxXSwgJ3ZpZXcxIHNob3VsZCBnbyB0byB0aGUgZW5kJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHMsIFt2aWV3MywgdmlldzIsIHZpZXcxXSk7XG5cblx0XHR0ZXN0T2JqZWN0Lm1vdmUoJ3ZpZXcxJywgJ3ZpZXczJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMsIFt2aWV3MSwgdmlldzMsIHZpZXcyXSwgJ3ZpZXcxIHNob3VsZCBnbyB0byB0aGUgZnJvbnQnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cywgW3ZpZXcxLCB2aWV3MywgdmlldzJdKTtcblxuXHRcdHRlc3RPYmplY3QubW92ZSgndmlldzInLCAndmlldzMnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QudmlzaWJsZVZpZXdEZXNjcmlwdG9ycywgW3ZpZXcxLCB2aWV3MiwgdmlldzNdLCAndmlldzIgc2hvdWxkIGdvIHRvIHRoZSBtaWRkbGUnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cywgW3ZpZXcxLCB2aWV3MiwgdmlldzNdKTtcblx0fSk7XG5cblx0dGVzdCgndmlldyBzdGF0ZXMnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRzdG9yYWdlU2VydmljZS5zdG9yZShgJHtjb250YWluZXIuaWR9LnN0YXRlLmhpZGRlbmAsIEpTT04uc3RyaW5naWZ5KFt7IGlkOiAndmlldzEnLCBpc0hpZGRlbjogdHJ1ZSB9XSksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdGNvbnRhaW5lciA9IFZpZXdDb250YWluZXJSZWdpc3RyeS5yZWdpc3RlclZpZXdDb250YWluZXIoeyBpZDogJ3Rlc3QnLCB0aXRsZTogbmxzLmxvY2FsaXplMigndGVzdCcsICd0ZXN0JyksIGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoPGFueT57fSkgfSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKGNvbnRhaW5lcik7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVmlld0Rlc2NyaXB0b3JTZXF1ZW5jZSh0ZXN0T2JqZWN0KSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cy5sZW5ndGgsIDApO1xuXG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3I6IElWaWV3RGVzY3JpcHRvciA9IHtcblx0XHRcdGlkOiAndmlldzEnLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDEnLCAnVGVzdCBWaWV3IDEnKVxuXHRcdH07XG5cblx0XHRWaWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3MoW3ZpZXdEZXNjcmlwdG9yXSwgY29udGFpbmVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMCwgJ3ZpZXcgc2hvdWxkIG5vdCBhcHBlYXIgc2luY2UgaXQgd2FzIHNldCBub3QgdmlzaWJsZSBpbiB2aWV3IHN0YXRlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cy5sZW5ndGgsIDApO1xuXHR9KSk7XG5cblx0dGVzdCgndmlldyBzdGF0ZXMgYW5kIHdoZW4gY29udGV4dHMnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRzdG9yYWdlU2VydmljZS5zdG9yZShgJHtjb250YWluZXIuaWR9LnN0YXRlLmhpZGRlbmAsIEpTT04uc3RyaW5naWZ5KFt7IGlkOiAndmlldzEnLCBpc0hpZGRlbjogdHJ1ZSB9XSksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdGNvbnRhaW5lciA9IFZpZXdDb250YWluZXJSZWdpc3RyeS5yZWdpc3RlclZpZXdDb250YWluZXIoeyBpZDogJ3Rlc3QnLCB0aXRsZTogbmxzLmxvY2FsaXplMigndGVzdCcsICd0ZXN0JyksIGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoPGFueT57fSkgfSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKGNvbnRhaW5lcik7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVmlld0Rlc2NyaXB0b3JTZXF1ZW5jZSh0ZXN0T2JqZWN0KSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cy5sZW5ndGgsIDApO1xuXG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3I6IElWaWV3RGVzY3JpcHRvciA9IHtcblx0XHRcdGlkOiAndmlldzEnLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDEnLCAnVGVzdCBWaWV3IDEnKSxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygnc2hvd3ZpZXcxJywgdHJ1ZSlcblx0XHR9O1xuXG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKFt2aWV3RGVzY3JpcHRvcl0sIGNvbnRhaW5lcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3QudmlzaWJsZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGgsIDAsICd2aWV3IHNob3VsZCBub3QgYXBwZWFyIHNpbmNlIGNvbnRleHQgaXNudCBpbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHMubGVuZ3RoLCAwKTtcblxuXHRcdGNvbnN0IGtleSA9IGNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZUtleTxib29sZWFuPignc2hvd3ZpZXcxJywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAwLCAndmlldyBzaG91bGQgc3RpbGwgbm90IGFwcGVhciBzaW5jZSBzaG93dmlldzEgaXNudCB0cnVlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cy5sZW5ndGgsIDApO1xuXG5cdFx0a2V5LnNldCh0cnVlKTtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZShjID0+IHNldFRpbWVvdXQoYywgMzApKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMCwgJ3ZpZXcgc2hvdWxkIHN0aWxsIG5vdCBhcHBlYXIgc2luY2UgaXQgd2FzIHNldCBub3QgdmlzaWJsZSBpbiB2aWV3IHN0YXRlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cy5sZW5ndGgsIDApO1xuXHR9KSk7XG5cblx0dGVzdCgndmlldyBzdGF0ZXMgYW5kIHdoZW4gY29udGV4dHMgbXVsdGlwbGUgdmlld3MnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRzdG9yYWdlU2VydmljZS5zdG9yZShgJHtjb250YWluZXIuaWR9LnN0YXRlLmhpZGRlbmAsIEpTT04uc3RyaW5naWZ5KFt7IGlkOiAndmlldzEnLCBpc0hpZGRlbjogdHJ1ZSB9XSksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdGNvbnRhaW5lciA9IFZpZXdDb250YWluZXJSZWdpc3RyeS5yZWdpc3RlclZpZXdDb250YWluZXIoeyBpZDogJ3Rlc3QnLCB0aXRsZTogbmxzLmxvY2FsaXplMigndGVzdCcsICd0ZXN0JyksIGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoPGFueT57fSkgfSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKGNvbnRhaW5lcik7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVmlld0Rlc2NyaXB0b3JTZXF1ZW5jZSh0ZXN0T2JqZWN0KSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cy5sZW5ndGgsIDApO1xuXG5cdFx0Y29uc3QgdmlldzE6IElWaWV3RGVzY3JpcHRvciA9IHtcblx0XHRcdGlkOiAndmlldzEnLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDEnLCAnVGVzdCBWaWV3IDEnKSxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygnc2hvd3ZpZXcnLCB0cnVlKVxuXHRcdH07XG5cdFx0Y29uc3QgdmlldzI6IElWaWV3RGVzY3JpcHRvciA9IHtcblx0XHRcdGlkOiAndmlldzInLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDInLCAnVGVzdCBWaWV3IDInKSxcblx0XHR9O1xuXHRcdGNvbnN0IHZpZXczOiBJVmlld0Rlc2NyaXB0b3IgPSB7XG5cdFx0XHRpZDogJ3ZpZXczJyxcblx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAzJywgJ1Rlc3QgVmlldyAzJyksXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3Nob3d2aWV3JywgdHJ1ZSlcblx0XHR9O1xuXG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKFt2aWV3MSwgdmlldzIsIHZpZXczXSwgY29udGFpbmVyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QudmlzaWJsZVZpZXdEZXNjcmlwdG9ycywgW3ZpZXcyXSwgJ09ubHkgdmlldzIgc2hvdWxkIGJlIHZpc2libGUnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cywgW3ZpZXcyXSk7XG5cblx0XHRjb25zdCBrZXkgPSBjb250ZXh0S2V5U2VydmljZS5jcmVhdGVLZXk8Ym9vbGVhbj4oJ3Nob3d2aWV3JywgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLCBbdmlldzJdLCAnT25seSB2aWV3MiBzaG91bGQgYmUgdmlzaWJsZScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLCBbdmlldzJdKTtcblxuXHRcdGtleS5zZXQodHJ1ZSk7XG5cdFx0YXdhaXQgbmV3IFByb21pc2UoYyA9PiBzZXRUaW1lb3V0KGMsIDMwKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMsIFt2aWV3MiwgdmlldzNdLCAndmlldzMgc2hvdWxkIGJlIHZpc2libGUnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cywgW3ZpZXcyLCB2aWV3M10pO1xuXG5cdFx0a2V5LnNldChmYWxzZSk7XG5cdFx0YXdhaXQgbmV3IFByb21pc2UoYyA9PiBzZXRUaW1lb3V0KGMsIDMwKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMsIFt2aWV3Ml0sICdPbmx5IHZpZXcyIHNob3VsZCBiZSB2aXNpYmxlJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHMsIFt2aWV3Ml0pO1xuXHR9KSk7XG5cblx0dGVzdCgncmVtb3ZlIGV2ZW50IGlzIG5vdCB0cmlnZ2VyZWQgaWYgdmlldyB3YXMgaGlkZGVuIGFuZCByZW1vdmVkJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29udGFpbmVyID0gVmlld0NvbnRhaW5lclJlZ2lzdHJ5LnJlZ2lzdGVyVmlld0NvbnRhaW5lcih7IGlkOiAndGVzdCcsIHRpdGxlOiBubHMubG9jYWxpemUyKCd0ZXN0JywgJ3Rlc3QnKSwgY3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcig8YW55Pnt9KSB9LCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwoY29udGFpbmVyKTtcblx0XHRjb25zdCB0YXJnZXQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBWaWV3RGVzY3JpcHRvclNlcXVlbmNlKHRlc3RPYmplY3QpKTtcblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcjogSVZpZXdEZXNjcmlwdG9yID0ge1xuXHRcdFx0aWQ6ICd2aWV3MScsXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMScsICdUZXN0IFZpZXcgMScpLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdzaG93dmlldzEnLCB0cnVlKSxcblx0XHRcdGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWVcblx0XHR9O1xuXG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKFt2aWV3RGVzY3JpcHRvcl0sIGNvbnRhaW5lcik7XG5cblx0XHRjb25zdCBrZXkgPSBjb250ZXh0S2V5U2VydmljZS5jcmVhdGVLZXk8Ym9vbGVhbj4oJ3Nob3d2aWV3MScsIHRydWUpO1xuXHRcdGF3YWl0IG5ldyBQcm9taXNlKGMgPT4gc2V0VGltZW91dChjLCAzMCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAxLCAndmlldyBzaG91bGQgYXBwZWFyIGFmdGVyIGNvbnRleHQgaXMgc2V0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cy5sZW5ndGgsIDEpO1xuXG5cdFx0dGVzdE9iamVjdC5zZXRWaXNpYmxlKCd2aWV3MScsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMCwgJ3ZpZXcgc2hvdWxkIGRpc2FwcGVhciBhZnRlciBzZXR0aW5nIHZpc2liaWxpdHkgdG8gZmFsc2UnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLmxlbmd0aCwgMCk7XG5cblx0XHRjb25zdCB0YXJnZXRFdmVudCA9IHNpbm9uLnNweSgpO1xuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQodGVzdE9iamVjdC5vbkRpZFJlbW92ZVZpc2libGVWaWV3RGVzY3JpcHRvcnModGFyZ2V0RXZlbnQpKTtcblx0XHRrZXkuc2V0KGZhbHNlKTtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZShjID0+IHNldFRpbWVvdXQoYywgMzApKTtcblx0XHRhc3NlcnQub2soIXRhcmdldEV2ZW50LmNhbGxlZCwgJ3JlbW92ZSBldmVudCBzaG91bGQgbm90IGJlIGNhbGxlZCBzaW5jZSBpdCBpcyBhbHJlYWR5IGhpZGRlbicpO1xuXHR9KSk7XG5cblx0dGVzdCgnYWRkIGV2ZW50IGlzIG5vdCB0cmlnZ2VyZWQgaWYgdmlldyB3YXMgc2V0IHZpc2libGUgKHdoZW4gdmlzaWJsZSkgYW5kIG5vdCBhY3RpdmUnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRjb250YWluZXIgPSBWaWV3Q29udGFpbmVyUmVnaXN0cnkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHsgaWQ6ICd0ZXN0JywgdGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3Rlc3QnLCAndGVzdCcpLCBjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKDxhbnk+e30pIH0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXIpO1xuXHRcdGNvbnN0IHRhcmdldCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFZpZXdEZXNjcmlwdG9yU2VxdWVuY2UodGVzdE9iamVjdCkpO1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yOiBJVmlld0Rlc2NyaXB0b3IgPSB7XG5cdFx0XHRpZDogJ3ZpZXcxJyxcblx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAxJywgJ1Rlc3QgVmlldyAxJyksXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3Nob3d2aWV3MScsIHRydWUpLFxuXHRcdFx0Y2FuVG9nZ2xlVmlzaWJpbGl0eTogdHJ1ZVxuXHRcdH07XG5cblx0XHRjb25zdCBrZXkgPSBjb250ZXh0S2V5U2VydmljZS5jcmVhdGVLZXk8Ym9vbGVhbj4oJ3Nob3d2aWV3MScsIHRydWUpO1xuXHRcdGtleS5zZXQoZmFsc2UpO1xuXHRcdFZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3cyhbdmlld0Rlc2NyaXB0b3JdLCBjb250YWluZXIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3QudmlzaWJsZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHMubGVuZ3RoLCAwKTtcblxuXHRcdGNvbnN0IHRhcmdldEV2ZW50ID0gc2lub24uc3B5KCk7XG5cdFx0ZGlzcG9zYWJsZVN0b3JlLmFkZCh0ZXN0T2JqZWN0Lm9uRGlkQWRkVmlzaWJsZVZpZXdEZXNjcmlwdG9ycyh0YXJnZXRFdmVudCkpO1xuXHRcdHRlc3RPYmplY3Quc2V0VmlzaWJsZSgndmlldzEnLCB0cnVlKTtcblx0XHRhc3NlcnQub2soIXRhcmdldEV2ZW50LmNhbGxlZCwgJ2FkZCBldmVudCBzaG91bGQgbm90IGJlIGNhbGxlZCBzaW5jZSBpdCBpcyBhbHJlYWR5IHZpc2libGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cy5sZW5ndGgsIDApO1xuXHR9KSk7XG5cblx0dGVzdCgncmVtb3ZlIGV2ZW50IGlzIG5vdCB0cmlnZ2VyZWQgaWYgdmlldyB3YXMgaGlkZGVuIGFuZCBub3QgYWN0aXZlJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29udGFpbmVyID0gVmlld0NvbnRhaW5lclJlZ2lzdHJ5LnJlZ2lzdGVyVmlld0NvbnRhaW5lcih7IGlkOiAndGVzdCcsIHRpdGxlOiBubHMubG9jYWxpemUyKCd0ZXN0JywgJ3Rlc3QnKSwgY3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcig8YW55Pnt9KSB9LCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwoY29udGFpbmVyKTtcblx0XHRjb25zdCB0YXJnZXQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBWaWV3RGVzY3JpcHRvclNlcXVlbmNlKHRlc3RPYmplY3QpKTtcblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcjogSVZpZXdEZXNjcmlwdG9yID0ge1xuXHRcdFx0aWQ6ICd2aWV3MScsXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMScsICdUZXN0IFZpZXcgMScpLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdzaG93dmlldzEnLCB0cnVlKSxcblx0XHRcdGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWVcblx0XHR9O1xuXG5cdFx0Y29uc3Qga2V5ID0gY29udGV4dEtleVNlcnZpY2UuY3JlYXRlS2V5PGJvb2xlYW4+KCdzaG93dmlldzEnLCB0cnVlKTtcblx0XHRrZXkuc2V0KGZhbHNlKTtcblx0XHRWaWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3MoW3ZpZXdEZXNjcmlwdG9yXSwgY29udGFpbmVyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLmxlbmd0aCwgMCk7XG5cblx0XHRjb25zdCB0YXJnZXRFdmVudCA9IHNpbm9uLnNweSgpO1xuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQodGVzdE9iamVjdC5vbkRpZEFkZFZpc2libGVWaWV3RGVzY3JpcHRvcnModGFyZ2V0RXZlbnQpKTtcblx0XHR0ZXN0T2JqZWN0LnNldFZpc2libGUoJ3ZpZXcxJywgZmFsc2UpO1xuXHRcdGFzc2VydC5vayghdGFyZ2V0RXZlbnQuY2FsbGVkLCAnYWRkIGV2ZW50IHNob3VsZCBub3QgYmUgY2FsbGVkIHNpbmNlIGl0IGlzIGRpc2FibGVkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3QudmlzaWJsZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHMubGVuZ3RoLCAwKTtcblx0fSkpO1xuXG5cdHRlc3QoJ2FkZCBldmVudCBpcyBub3QgdHJpZ2dlcmVkIGlmIHZpZXcgd2FzIHNldCB2aXNpYmxlICh3aGVuIG5vdCB2aXNpYmxlKSBhbmQgbm90IGFjdGl2ZScsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnRhaW5lciA9IFZpZXdDb250YWluZXJSZWdpc3RyeS5yZWdpc3RlclZpZXdDb250YWluZXIoeyBpZDogJ3Rlc3QnLCB0aXRsZTogbmxzLmxvY2FsaXplMigndGVzdCcsICd0ZXN0JyksIGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoPGFueT57fSkgfSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKGNvbnRhaW5lcik7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVmlld0Rlc2NyaXB0b3JTZXF1ZW5jZSh0ZXN0T2JqZWN0KSk7XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3I6IElWaWV3RGVzY3JpcHRvciA9IHtcblx0XHRcdGlkOiAndmlldzEnLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDEnLCAnVGVzdCBWaWV3IDEnKSxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygnc2hvd3ZpZXcxJywgdHJ1ZSksXG5cdFx0XHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiB0cnVlXG5cdFx0fTtcblxuXHRcdGNvbnN0IGtleSA9IGNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZUtleTxib29sZWFuPignc2hvd3ZpZXcxJywgdHJ1ZSk7XG5cdFx0a2V5LnNldChmYWxzZSk7XG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKFt2aWV3RGVzY3JpcHRvcl0sIGNvbnRhaW5lcik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cy5sZW5ndGgsIDApO1xuXG5cdFx0dGVzdE9iamVjdC5zZXRWaXNpYmxlKCd2aWV3MScsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cy5sZW5ndGgsIDApO1xuXG5cdFx0Y29uc3QgdGFyZ2V0RXZlbnQgPSBzaW5vbi5zcHkoKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKHRlc3RPYmplY3Qub25EaWRBZGRWaXNpYmxlVmlld0Rlc2NyaXB0b3JzKHRhcmdldEV2ZW50KSk7XG5cdFx0dGVzdE9iamVjdC5zZXRWaXNpYmxlKCd2aWV3MScsIHRydWUpO1xuXHRcdGFzc2VydC5vayghdGFyZ2V0RXZlbnQuY2FsbGVkLCAnYWRkIGV2ZW50IHNob3VsZCBub3QgYmUgY2FsbGVkIHNpbmNlIGl0IGlzIGRpc2FibGVkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3QudmlzaWJsZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHMubGVuZ3RoLCAwKTtcblx0fSkpO1xuXG5cdHRlc3QoJ2FkZGVkIHZpZXcgZGVzY3JpcHRvcnMgYXJlIGluIGFzY2VuZGluZyBvcmRlciBpbiB0aGUgZXZlbnQnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRjb250YWluZXIgPSBWaWV3Q29udGFpbmVyUmVnaXN0cnkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHsgaWQ6ICd0ZXN0JywgdGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3Rlc3QnLCAndGVzdCcpLCBjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKDxhbnk+e30pIH0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXIpO1xuXHRcdGNvbnN0IHRhcmdldCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFZpZXdEZXNjcmlwdG9yU2VxdWVuY2UodGVzdE9iamVjdCkpO1xuXG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKFt7XG5cdFx0XHRpZDogJ3ZpZXc1Jyxcblx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyA1JywgJ1Rlc3QgVmlldyA1JyksXG5cdFx0XHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiB0cnVlLFxuXHRcdFx0b3JkZXI6IDVcblx0XHR9LCB7XG5cdFx0XHRpZDogJ3ZpZXcyJyxcblx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAyJywgJ1Rlc3QgVmlldyAyJyksXG5cdFx0XHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiB0cnVlLFxuXHRcdFx0b3JkZXI6IDJcblx0XHR9XSwgY29udGFpbmVyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzWzBdLmlkLCAndmlldzInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzWzFdLmlkLCAndmlldzUnKTtcblxuXHRcdFZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3cyhbe1xuXHRcdFx0aWQ6ICd2aWV3NCcsXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgNCcsICdUZXN0IFZpZXcgNCcpLFxuXHRcdFx0Y2FuVG9nZ2xlVmlzaWJpbGl0eTogdHJ1ZSxcblx0XHRcdG9yZGVyOiA0XG5cdFx0fSwge1xuXHRcdFx0aWQ6ICd2aWV3MycsXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMycsICdUZXN0IFZpZXcgMycpLFxuXHRcdFx0Y2FuVG9nZ2xlVmlzaWJpbGl0eTogdHJ1ZSxcblx0XHRcdG9yZGVyOiAzXG5cdFx0fSwge1xuXHRcdFx0aWQ6ICd2aWV3MScsXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMScsICdUZXN0IFZpZXcgMScpLFxuXHRcdFx0Y2FuVG9nZ2xlVmlzaWJpbGl0eTogdHJ1ZSxcblx0XHRcdG9yZGVyOiAxXG5cdFx0fV0sIGNvbnRhaW5lcik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLmxlbmd0aCwgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50c1swXS5pZCwgJ3ZpZXcxJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50c1sxXS5pZCwgJ3ZpZXcyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50c1syXS5pZCwgJ3ZpZXczJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50c1szXS5pZCwgJ3ZpZXc0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50c1s0XS5pZCwgJ3ZpZXc1Jyk7XG5cdH0pKTtcblxuXHR0ZXN0KCdhZGQgZXZlbnQgaXMgdHJpZ2dlcmVkIG9ubHkgb25jZSB3aGVuIHZpZXcgaXMgc2V0IHZpc2libGUgd2hpbGUgaXQgaXMgc2V0IGFjdGl2ZScsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnRhaW5lciA9IFZpZXdDb250YWluZXJSZWdpc3RyeS5yZWdpc3RlclZpZXdDb250YWluZXIoeyBpZDogJ3Rlc3QnLCB0aXRsZTogbmxzLmxvY2FsaXplMigndGVzdCcsICd0ZXN0JyksIGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoPGFueT57fSkgfSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKGNvbnRhaW5lcik7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVmlld0Rlc2NyaXB0b3JTZXF1ZW5jZSh0ZXN0T2JqZWN0KSk7XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3I6IElWaWV3RGVzY3JpcHRvciA9IHtcblx0XHRcdGlkOiAndmlldzEnLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDEnLCAnVGVzdCBWaWV3IDEnKSxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygnc2hvd3ZpZXcxJywgdHJ1ZSksXG5cdFx0XHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiB0cnVlXG5cdFx0fTtcblxuXHRcdGNvbnN0IGtleSA9IGNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZUtleTxib29sZWFuPignc2hvd3ZpZXcxJywgdHJ1ZSk7XG5cdFx0a2V5LnNldChmYWxzZSk7XG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKFt2aWV3RGVzY3JpcHRvcl0sIGNvbnRhaW5lcik7XG5cdFx0dGVzdE9iamVjdC5zZXRWaXNpYmxlKCd2aWV3MScsIGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLmxlbmd0aCwgMCk7XG5cblx0XHRjb25zdCB0YXJnZXRFdmVudCA9IHNpbm9uLnNweSgpO1xuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQodGVzdE9iamVjdC5vbkRpZEFkZFZpc2libGVWaWV3RGVzY3JpcHRvcnModGFyZ2V0RXZlbnQpKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKEV2ZW50Lm9uY2UodGVzdE9iamVjdC5vbkRpZENoYW5nZUFjdGl2ZVZpZXdEZXNjcmlwdG9ycykoKCkgPT4gdGVzdE9iamVjdC5zZXRWaXNpYmxlKCd2aWV3MScsIHRydWUpKSk7XG5cdFx0a2V5LnNldCh0cnVlKTtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZShjID0+IHNldFRpbWVvdXQoYywgMzApKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0RXZlbnQuY2FsbENvdW50LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50cy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHNbMF0uaWQsICd2aWV3MScpO1xuXHR9KSk7XG5cblx0dGVzdCgnYWRkIGV2ZW50IGlzIG5vdCB0cmlnZ2VyZWQgb25seSB3aGVuIHZpZXcgaXMgc2V0IGhpZGRlbiB3aGlsZSBpdCBpcyBzZXQgYWN0aXZlJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29udGFpbmVyID0gVmlld0NvbnRhaW5lclJlZ2lzdHJ5LnJlZ2lzdGVyVmlld0NvbnRhaW5lcih7IGlkOiAndGVzdCcsIHRpdGxlOiBubHMubG9jYWxpemUyKCd0ZXN0JywgJ3Rlc3QnKSwgY3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcig8YW55Pnt9KSB9LCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwoY29udGFpbmVyKTtcblx0XHRjb25zdCB0YXJnZXQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBWaWV3RGVzY3JpcHRvclNlcXVlbmNlKHRlc3RPYmplY3QpKTtcblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcjogSVZpZXdEZXNjcmlwdG9yID0ge1xuXHRcdFx0aWQ6ICd2aWV3MScsXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMScsICdUZXN0IFZpZXcgMScpLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdzaG93dmlldzEnLCB0cnVlKSxcblx0XHRcdGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWVcblx0XHR9O1xuXG5cdFx0Y29uc3Qga2V5ID0gY29udGV4dEtleVNlcnZpY2UuY3JlYXRlS2V5PGJvb2xlYW4+KCdzaG93dmlldzEnLCB0cnVlKTtcblx0XHRrZXkuc2V0KGZhbHNlKTtcblx0XHRWaWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3MoW3ZpZXdEZXNjcmlwdG9yXSwgY29udGFpbmVyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLmxlbmd0aCwgMCk7XG5cblx0XHRjb25zdCB0YXJnZXRFdmVudCA9IHNpbm9uLnNweSgpO1xuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQodGVzdE9iamVjdC5vbkRpZEFkZFZpc2libGVWaWV3RGVzY3JpcHRvcnModGFyZ2V0RXZlbnQpKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKEV2ZW50Lm9uY2UodGVzdE9iamVjdC5vbkRpZENoYW5nZUFjdGl2ZVZpZXdEZXNjcmlwdG9ycykoKCkgPT4gdGVzdE9iamVjdC5zZXRWaXNpYmxlKCd2aWV3MScsIGZhbHNlKSkpO1xuXHRcdGtleS5zZXQodHJ1ZSk7XG5cdFx0YXdhaXQgbmV3IFByb21pc2UoYyA9PiBzZXRUaW1lb3V0KGMsIDMwKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldEV2ZW50LmNhbGxDb3VudCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3QudmlzaWJsZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHMubGVuZ3RoLCAwKTtcblx0fSkpO1xuXG5cdHRlc3QoJyMxNDIwODc6IHZpZXcgZGVzY3JpcHRvciB2aXNpYmlsaXR5IGlzIG5vdCByZXNldCcsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnRhaW5lciA9IFZpZXdDb250YWluZXJSZWdpc3RyeS5yZWdpc3RlclZpZXdDb250YWluZXIoeyBpZDogJ3Rlc3QnLCB0aXRsZTogbmxzLmxvY2FsaXplMigndGVzdCcsICd0ZXN0JyksIGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoPGFueT57fSkgfSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKGNvbnRhaW5lcik7XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3I6IElWaWV3RGVzY3JpcHRvciA9IHtcblx0XHRcdGlkOiAndmlldzEnLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDEnLCAnVGVzdCBWaWV3IDEnKSxcblx0XHRcdGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWVcblx0XHR9O1xuXG5cdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoZ2V0Vmlld3NTdGF0ZVN0b3JhZ2VJZCgndGVzdC5zdGF0ZScpLCBKU09OLnN0cmluZ2lmeShbe1xuXHRcdFx0aWQ6IHZpZXdEZXNjcmlwdG9yLmlkLFxuXHRcdFx0aXNIaWRkZW46IHRydWUsXG5cdFx0XHRvcmRlcjogdW5kZWZpbmVkXG5cdFx0fV0pLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblxuXHRcdFZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3cyhbdmlld0Rlc2NyaXB0b3JdLCBjb250YWluZXIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3QuaXNWaXNpYmxlKHZpZXdEZXNjcmlwdG9yLmlkKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmFjdGl2ZVZpZXdEZXNjcmlwdG9yc1swXS5pZCwgdmlld0Rlc2NyaXB0b3IuaWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnZpc2libGVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoLCAwKTtcblx0fSkpO1xuXG5cdHRlc3QoJ3JlbW92ZSBldmVudCBpcyB0cmlnZ2VyZWQgcHJvcGVybHkgaWYgbXVsdGlwbGUgdmlld3MgYXJlIGhpZGRlbiBhdCB0aGUgc2FtZSB0aW1lJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29udGFpbmVyID0gVmlld0NvbnRhaW5lclJlZ2lzdHJ5LnJlZ2lzdGVyVmlld0NvbnRhaW5lcih7IGlkOiAndGVzdCcsIHRpdGxlOiBubHMubG9jYWxpemUyKCd0ZXN0JywgJ3Rlc3QnKSwgY3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcig8YW55Pnt9KSB9LCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwoY29udGFpbmVyKTtcblx0XHRjb25zdCB0YXJnZXQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBWaWV3RGVzY3JpcHRvclNlcXVlbmNlKHRlc3RPYmplY3QpKTtcblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcjE6IElWaWV3RGVzY3JpcHRvciA9IHtcblx0XHRcdGlkOiAndmlldzEnLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDEnLCAnVGVzdCBWaWV3IDEnKSxcblx0XHRcdGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWVcblx0XHR9O1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yMjogSVZpZXdEZXNjcmlwdG9yID0ge1xuXHRcdFx0aWQ6ICd2aWV3MicsXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMicsICdUZXN0IFZpZXcgMicpLFxuXHRcdFx0Y2FuVG9nZ2xlVmlzaWJpbGl0eTogdHJ1ZVxuXHRcdH07XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3IzOiBJVmlld0Rlc2NyaXB0b3IgPSB7XG5cdFx0XHRpZDogJ3ZpZXczJyxcblx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAzJywgJ1Rlc3QgVmlldyAzJyksXG5cdFx0XHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiB0cnVlXG5cdFx0fTtcblxuXHRcdFZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3cyhbdmlld0Rlc2NyaXB0b3IxLCB2aWV3RGVzY3JpcHRvcjIsIHZpZXdEZXNjcmlwdG9yM10sIGNvbnRhaW5lcik7XG5cblx0XHRjb25zdCByZW1vbXZlRXZlbnQgPSBzaW5vbi5zcHkoKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKHRlc3RPYmplY3Qub25EaWRSZW1vdmVWaXNpYmxlVmlld0Rlc2NyaXB0b3JzKHJlbW9tdmVFdmVudCkpO1xuXG5cdFx0Y29uc3QgYWRkRXZlbnQgPSBzaW5vbi5zcHkoKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKHRlc3RPYmplY3Qub25EaWRBZGRWaXNpYmxlVmlld0Rlc2NyaXB0b3JzKGFkZEV2ZW50KSk7XG5cblx0XHRzdG9yYWdlU2VydmljZS5zdG9yZShnZXRWaWV3c1N0YXRlU3RvcmFnZUlkKCd0ZXN0LnN0YXRlJyksIEpTT04uc3RyaW5naWZ5KFt7XG5cdFx0XHRpZDogdmlld0Rlc2NyaXB0b3IxLmlkLFxuXHRcdFx0aXNIaWRkZW46IGZhbHNlLFxuXHRcdFx0b3JkZXI6IHVuZGVmaW5lZFxuXHRcdH0sIHtcblx0XHRcdGlkOiB2aWV3RGVzY3JpcHRvcjIuaWQsXG5cdFx0XHRpc0hpZGRlbjogdHJ1ZSxcblx0XHRcdG9yZGVyOiB1bmRlZmluZWRcblx0XHR9LCB7XG5cdFx0XHRpZDogdmlld0Rlc2NyaXB0b3IzLmlkLFxuXHRcdFx0aXNIaWRkZW46IHRydWUsXG5cdFx0XHRvcmRlcjogdW5kZWZpbmVkXG5cdFx0fV0pLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblxuXHRcdGFzc2VydC5vayghYWRkRXZlbnQuY2FsbGVkLCAnYWRkIGV2ZW50IHNob3VsZCBub3QgYmUgY2FsbGVkJyk7XG5cdFx0YXNzZXJ0Lm9rKHJlbW9tdmVFdmVudC5jYWxsZWRPbmNlLCAncmVtb3ZlIGV2ZW50IHNob3VsZCBiZSBjYWxsZWQnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlbW9tdmVFdmVudC5hcmdzWzBdWzBdLCBbe1xuXHRcdFx0dmlld0Rlc2NyaXB0b3I6IHZpZXdEZXNjcmlwdG9yMyxcblx0XHRcdGluZGV4OiAyXG5cdFx0fSwge1xuXHRcdFx0dmlld0Rlc2NyaXB0b3I6IHZpZXdEZXNjcmlwdG9yMixcblx0XHRcdGluZGV4OiAxXG5cdFx0fV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzWzBdLmlkLCB2aWV3RGVzY3JpcHRvcjEuaWQpO1xuXHR9KSk7XG5cblx0dGVzdCgnYWRkIGV2ZW50IGlzIHRyaWdnZXJlZCBwcm9wZXJseSBpZiBtdWx0aXBsZSB2aWV3cyBhcmUgaGlkZGVuIGF0IHRoZSBzYW1lIHRpbWUnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRjb250YWluZXIgPSBWaWV3Q29udGFpbmVyUmVnaXN0cnkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHsgaWQ6ICd0ZXN0JywgdGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3Rlc3QnLCAndGVzdCcpLCBjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKDxhbnk+e30pIH0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXIpO1xuXHRcdGNvbnN0IHRhcmdldCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFZpZXdEZXNjcmlwdG9yU2VxdWVuY2UodGVzdE9iamVjdCkpO1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yMTogSVZpZXdEZXNjcmlwdG9yID0ge1xuXHRcdFx0aWQ6ICd2aWV3MScsXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMScsICdUZXN0IFZpZXcgMScpLFxuXHRcdFx0Y2FuVG9nZ2xlVmlzaWJpbGl0eTogdHJ1ZVxuXHRcdH07XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3IyOiBJVmlld0Rlc2NyaXB0b3IgPSB7XG5cdFx0XHRpZDogJ3ZpZXcyJyxcblx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAyJywgJ1Rlc3QgVmlldyAyJyksXG5cdFx0XHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiB0cnVlXG5cdFx0fTtcblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcjM6IElWaWV3RGVzY3JpcHRvciA9IHtcblx0XHRcdGlkOiAndmlldzMnLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDMnLCAnVGVzdCBWaWV3IDMnKSxcblx0XHRcdGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWVcblx0XHR9O1xuXG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKFt2aWV3RGVzY3JpcHRvcjEsIHZpZXdEZXNjcmlwdG9yMiwgdmlld0Rlc2NyaXB0b3IzXSwgY29udGFpbmVyKTtcblx0XHR0ZXN0T2JqZWN0LnNldFZpc2libGUodmlld0Rlc2NyaXB0b3IxLmlkLCBmYWxzZSk7XG5cdFx0dGVzdE9iamVjdC5zZXRWaXNpYmxlKHZpZXdEZXNjcmlwdG9yMy5pZCwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgcmVtb3ZlRXZlbnQgPSBzaW5vbi5zcHkoKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKHRlc3RPYmplY3Qub25EaWRSZW1vdmVWaXNpYmxlVmlld0Rlc2NyaXB0b3JzKHJlbW92ZUV2ZW50KSk7XG5cblx0XHRjb25zdCBhZGRFdmVudCA9IHNpbm9uLnNweSgpO1xuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQodGVzdE9iamVjdC5vbkRpZEFkZFZpc2libGVWaWV3RGVzY3JpcHRvcnMoYWRkRXZlbnQpKTtcblxuXHRcdHN0b3JhZ2VTZXJ2aWNlLnN0b3JlKGdldFZpZXdzU3RhdGVTdG9yYWdlSWQoJ3Rlc3Quc3RhdGUnKSwgSlNPTi5zdHJpbmdpZnkoW3tcblx0XHRcdGlkOiB2aWV3RGVzY3JpcHRvcjEuaWQsXG5cdFx0XHRpc0hpZGRlbjogZmFsc2UsXG5cdFx0XHRvcmRlcjogdW5kZWZpbmVkXG5cdFx0fSwge1xuXHRcdFx0aWQ6IHZpZXdEZXNjcmlwdG9yMi5pZCxcblx0XHRcdGlzSGlkZGVuOiBmYWxzZSxcblx0XHRcdG9yZGVyOiB1bmRlZmluZWRcblx0XHR9LCB7XG5cdFx0XHRpZDogdmlld0Rlc2NyaXB0b3IzLmlkLFxuXHRcdFx0aXNIaWRkZW46IGZhbHNlLFxuXHRcdFx0b3JkZXI6IHVuZGVmaW5lZFxuXHRcdH1dKSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cblx0XHRhc3NlcnQub2soIXJlbW92ZUV2ZW50LmNhbGxlZCwgJ3JlbW92ZSBldmVudCBzaG91bGQgbm90IGJlIGNhbGxlZCcpO1xuXG5cdFx0YXNzZXJ0Lm9rKGFkZEV2ZW50LmNhbGxlZE9uY2UsICdhZGQgZXZlbnQgc2hvdWxkIGJlIGNhbGxlZCBvbmNlJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhZGRFdmVudC5hcmdzWzBdWzBdLCBbe1xuXHRcdFx0dmlld0Rlc2NyaXB0b3I6IHZpZXdEZXNjcmlwdG9yMSxcblx0XHRcdGluZGV4OiAwLFxuXHRcdFx0Y29sbGFwc2VkOiBmYWxzZSxcblx0XHRcdHNpemU6IHVuZGVmaW5lZFxuXHRcdH0sIHtcblx0XHRcdHZpZXdEZXNjcmlwdG9yOiB2aWV3RGVzY3JpcHRvcjMsXG5cdFx0XHRpbmRleDogMixcblx0XHRcdGNvbGxhcHNlZDogZmFsc2UsXG5cdFx0XHRzaXplOiB1bmRlZmluZWRcblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLmxlbmd0aCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50c1swXS5pZCwgdmlld0Rlc2NyaXB0b3IxLmlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzWzFdLmlkLCB2aWV3RGVzY3JpcHRvcjIuaWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXJnZXQuZWxlbWVudHNbMl0uaWQsIHZpZXdEZXNjcmlwdG9yMy5pZCk7XG5cdH0pKTtcblxuXHR0ZXN0KCdhZGQgYW5kIHJlbW92ZSBldmVudHMgYXJlIHRyaWdnZXJlZCBwcm9wZXJseSBpZiBtdWx0aXBsZSB2aWV3cyBhcmUgaGlkZGVuIGFuZCBhZGRlZCBhdCB0aGUgc2FtZSB0aW1lJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29udGFpbmVyID0gVmlld0NvbnRhaW5lclJlZ2lzdHJ5LnJlZ2lzdGVyVmlld0NvbnRhaW5lcih7IGlkOiAndGVzdCcsIHRpdGxlOiBubHMubG9jYWxpemUyKCd0ZXN0JywgJ3Rlc3QnKSwgY3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcig8YW55Pnt9KSB9LCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwoY29udGFpbmVyKTtcblx0XHRjb25zdCB0YXJnZXQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBWaWV3RGVzY3JpcHRvclNlcXVlbmNlKHRlc3RPYmplY3QpKTtcblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcjE6IElWaWV3RGVzY3JpcHRvciA9IHtcblx0XHRcdGlkOiAndmlldzEnLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDEnLCAnVGVzdCBWaWV3IDEnKSxcblx0XHRcdGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWVcblx0XHR9O1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yMjogSVZpZXdEZXNjcmlwdG9yID0ge1xuXHRcdFx0aWQ6ICd2aWV3MicsXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbnVsbCEsXG5cdFx0XHRuYW1lOiBubHMubG9jYWxpemUyKCdUZXN0IFZpZXcgMicsICdUZXN0IFZpZXcgMicpLFxuXHRcdFx0Y2FuVG9nZ2xlVmlzaWJpbGl0eTogdHJ1ZVxuXHRcdH07XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3IzOiBJVmlld0Rlc2NyaXB0b3IgPSB7XG5cdFx0XHRpZDogJ3ZpZXczJyxcblx0XHRcdGN0b3JEZXNjcmlwdG9yOiBudWxsISxcblx0XHRcdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ1Rlc3QgVmlldyAzJywgJ1Rlc3QgVmlldyAzJyksXG5cdFx0XHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiB0cnVlXG5cdFx0fTtcblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcjQ6IElWaWV3RGVzY3JpcHRvciA9IHtcblx0XHRcdGlkOiAndmlldzQnLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDQnLCAnVGVzdCBWaWV3IDQnKSxcblx0XHRcdGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWVcblx0XHR9O1xuXG5cdFx0Vmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKFt2aWV3RGVzY3JpcHRvcjEsIHZpZXdEZXNjcmlwdG9yMiwgdmlld0Rlc2NyaXB0b3IzLCB2aWV3RGVzY3JpcHRvcjRdLCBjb250YWluZXIpO1xuXHRcdHRlc3RPYmplY3Quc2V0VmlzaWJsZSh2aWV3RGVzY3JpcHRvcjEuaWQsIGZhbHNlKTtcblxuXHRcdGNvbnN0IHJlbW92ZUV2ZW50ID0gc2lub24uc3B5KCk7XG5cdFx0ZGlzcG9zYWJsZVN0b3JlLmFkZCh0ZXN0T2JqZWN0Lm9uRGlkUmVtb3ZlVmlzaWJsZVZpZXdEZXNjcmlwdG9ycyhyZW1vdmVFdmVudCkpO1xuXG5cdFx0Y29uc3QgYWRkRXZlbnQgPSBzaW5vbi5zcHkoKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKHRlc3RPYmplY3Qub25EaWRBZGRWaXNpYmxlVmlld0Rlc2NyaXB0b3JzKGFkZEV2ZW50KSk7XG5cblx0XHRzdG9yYWdlU2VydmljZS5zdG9yZShnZXRWaWV3c1N0YXRlU3RvcmFnZUlkKCd0ZXN0LnN0YXRlJyksIEpTT04uc3RyaW5naWZ5KFt7XG5cdFx0XHRpZDogdmlld0Rlc2NyaXB0b3IxLmlkLFxuXHRcdFx0aXNIaWRkZW46IGZhbHNlLFxuXHRcdFx0b3JkZXI6IHVuZGVmaW5lZFxuXHRcdH0sIHtcblx0XHRcdGlkOiB2aWV3RGVzY3JpcHRvcjIuaWQsXG5cdFx0XHRpc0hpZGRlbjogdHJ1ZSxcblx0XHRcdG9yZGVyOiB1bmRlZmluZWRcblx0XHR9LCB7XG5cdFx0XHRpZDogdmlld0Rlc2NyaXB0b3IzLmlkLFxuXHRcdFx0aXNIaWRkZW46IGZhbHNlLFxuXHRcdFx0b3JkZXI6IHVuZGVmaW5lZFxuXHRcdH0sIHtcblx0XHRcdGlkOiB2aWV3RGVzY3JpcHRvcjQuaWQsXG5cdFx0XHRpc0hpZGRlbjogdHJ1ZSxcblx0XHRcdG9yZGVyOiB1bmRlZmluZWRcblx0XHR9XSksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXG5cdFx0YXNzZXJ0Lm9rKHJlbW92ZUV2ZW50LmNhbGxlZE9uY2UsICdyZW1vdmUgZXZlbnQgc2hvdWxkIGJlIGNhbGxlZCBvbmNlJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZW1vdmVFdmVudC5hcmdzWzBdWzBdLCBbe1xuXHRcdFx0dmlld0Rlc2NyaXB0b3I6IHZpZXdEZXNjcmlwdG9yNCxcblx0XHRcdGluZGV4OiAyXG5cdFx0fSwge1xuXHRcdFx0dmlld0Rlc2NyaXB0b3I6IHZpZXdEZXNjcmlwdG9yMixcblx0XHRcdGluZGV4OiAwXG5cdFx0fV0pO1xuXG5cdFx0YXNzZXJ0Lm9rKGFkZEV2ZW50LmNhbGxlZE9uY2UsICdhZGQgZXZlbnQgc2hvdWxkIGJlIGNhbGxlZCBvbmNlJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhZGRFdmVudC5hcmdzWzBdWzBdLCBbe1xuXHRcdFx0dmlld0Rlc2NyaXB0b3I6IHZpZXdEZXNjcmlwdG9yMSxcblx0XHRcdGluZGV4OiAwLFxuXHRcdFx0Y29sbGFwc2VkOiBmYWxzZSxcblx0XHRcdHNpemU6IHVuZGVmaW5lZFxuXHRcdH1dKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC5lbGVtZW50c1swXS5pZCwgdmlld0Rlc2NyaXB0b3IxLmlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LmVsZW1lbnRzWzFdLmlkLCB2aWV3RGVzY3JpcHRvcjMuaWQpO1xuXHR9KSk7XG5cblx0dGVzdCgnbmV3bHkgYWRkZWQgdmlldyBkZXNjcmlwdG9yIGlzIGhpZGRlbiBpZiBpdCB3YXMgdG9nZ2xlZCBoaWRkZW4gaW4gc3RvcmFnZSBiZWZvcmUgYWRkaW5nJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29udGFpbmVyID0gVmlld0NvbnRhaW5lclJlZ2lzdHJ5LnJlZ2lzdGVyVmlld0NvbnRhaW5lcih7IGlkOiAndGVzdCcsIHRpdGxlOiBubHMubG9jYWxpemUyKCd0ZXN0JywgJ3Rlc3QnKSwgY3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcig8YW55Pnt9KSB9LCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3I6IElWaWV3RGVzY3JpcHRvciA9IHtcblx0XHRcdGlkOiAndmlldzEnLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG51bGwhLFxuXHRcdFx0bmFtZTogbmxzLmxvY2FsaXplMignVGVzdCBWaWV3IDEnLCAnVGVzdCBWaWV3IDEnKSxcblx0XHRcdGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWVcblx0XHR9O1xuXHRcdHN0b3JhZ2VTZXJ2aWNlLnN0b3JlKGdldFZpZXdzU3RhdGVTdG9yYWdlSWQoJ3Rlc3Quc3RhdGUnKSwgSlNPTi5zdHJpbmdpZnkoW3tcblx0XHRcdGlkOiB2aWV3RGVzY3JpcHRvci5pZCxcblx0XHRcdGlzSGlkZGVuOiBmYWxzZSxcblx0XHRcdG9yZGVyOiB1bmRlZmluZWRcblx0XHR9XSksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwoY29udGFpbmVyKTtcblxuXHRcdHN0b3JhZ2VTZXJ2aWNlLnN0b3JlKGdldFZpZXdzU3RhdGVTdG9yYWdlSWQoJ3Rlc3Quc3RhdGUnKSwgSlNPTi5zdHJpbmdpZnkoW3tcblx0XHRcdGlkOiB2aWV3RGVzY3JpcHRvci5pZCxcblx0XHRcdGlzSGlkZGVuOiB0cnVlLFxuXHRcdFx0b3JkZXI6IHVuZGVmaW5lZFxuXHRcdH1dKSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cblx0XHRWaWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3MoW3ZpZXdEZXNjcmlwdG9yXSwgY29udGFpbmVyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmlzVmlzaWJsZSh2aWV3RGVzY3JpcHRvci5pZCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5hY3RpdmVWaWV3RGVzY3JpcHRvcnNbMF0uaWQsIHZpZXdEZXNjcmlwdG9yLmlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCwgMCk7XG5cdH0pKTtcblxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFNBQVM7QUFDckIsT0FBTyxZQUFZO0FBQ25CLFlBQVksV0FBVztBQUN2QixTQUFtRSxjQUFjLHlCQUF5Qiw2QkFBeUY7QUFDbk0sU0FBc0IsZUFBZTtBQUNyQyxTQUFTLFlBQVk7QUFDckIsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyxnQkFBZ0IsMEJBQTBCO0FBRW5ELFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMsYUFBYTtBQUN0QixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLCtDQUErQztBQUV4RCxNQUFNLHdCQUF3QixTQUFTLEdBQTRCLHdCQUF3QixzQkFBc0I7QUFDakgsTUFBTSxnQkFBZ0IsU0FBUyxHQUFtQix3QkFBd0IsYUFBYTtBQUV2RixNQUFNLHVCQUF1QjtBQUFBLEVBSzVCLFlBQVksT0FBNEI7QUFGeEMsU0FBUSxjQUE2QixDQUFDO0FBR3JDLFNBQUssV0FBVyxDQUFDLEdBQUcsTUFBTSxzQkFBc0I7QUFDaEQsVUFBTSwrQkFBK0IsV0FBUyxNQUFNLFFBQVEsQ0FBQyxFQUFFLGdCQUFnQixNQUFNLE1BQU0sS0FBSyxTQUFTLE9BQU8sT0FBTyxHQUFHLGNBQWMsQ0FBQyxHQUFHLE1BQU0sS0FBSyxXQUFXO0FBQ2xLLFVBQU0sa0NBQWtDLGFBQVcsUUFBUSxLQUFLLENBQUMsR0FBRyxNQUFNLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLE1BQU0sS0FBSyxTQUFTLE9BQU8sT0FBTyxDQUFDLENBQUMsR0FBRyxNQUFNLEtBQUssV0FBVztBQUMzSyxVQUFNLGdDQUFnQyxDQUFDLEVBQUUsTUFBTSxHQUFHLE1BQU0sS0FBSyxLQUFLLFVBQVUsS0FBSyxPQUFPLEdBQUcsS0FBSyxHQUFHLE1BQU0sS0FBSyxXQUFXO0FBQUEsRUFDMUg7QUFBQSxFQUVBLFVBQVU7QUFDVCxTQUFLLGNBQWMsUUFBUSxLQUFLLFdBQVc7QUFBQSxFQUM1QztBQUNEO0FBRUEsTUFBTSxzQkFBc0IsTUFBTTtBQUVqQyxNQUFJO0FBQ0osUUFBTSxrQkFBa0Isd0NBQXdDO0FBQ2hFLE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUVKLFFBQU0sTUFBTTtBQUNYLFVBQU0sdUJBQWlELDhCQUE4QixRQUFXLGVBQWU7QUFDL0csd0JBQW9CLGdCQUFnQixJQUFJLHFCQUFxQixlQUFlLGlCQUFpQixDQUFDO0FBQzlGLHlCQUFxQixLQUFLLG9CQUFvQixpQkFBaUI7QUFDL0QscUJBQWlCLHFCQUFxQixJQUFJLGVBQWU7QUFDekQsNEJBQXdCLGdCQUFnQixJQUFJLHFCQUFxQixlQUFlLHFCQUFxQixDQUFDO0FBQUEsRUFDdkcsQ0FBQztBQUVELFdBQVMsTUFBTTtBQUNkLGtCQUFjLGdCQUFnQixjQUFjLFNBQVMsU0FBUyxHQUFHLFNBQVM7QUFDMUUsMEJBQXNCLHdCQUF3QixTQUFTO0FBQUEsRUFDeEQsQ0FBQztBQUVELE9BQUssZUFBZSxXQUFZO0FBQy9CLGdCQUFZLHNCQUFzQixzQkFBc0IsRUFBRSxJQUFJLFFBQVEsT0FBTyxJQUFJLFVBQVUsUUFBUSxNQUFNLEdBQUcsZ0JBQWdCLElBQUksZUFBb0IsQ0FBQyxDQUFDLEVBQUUsR0FBRyxzQkFBc0IsT0FBTztBQUN4TCxVQUFNLGFBQWEsc0JBQXNCLHNCQUFzQixTQUFTO0FBQ3hFLFdBQU8sWUFBWSxXQUFXLHVCQUF1QixRQUFRLENBQUM7QUFBQSxFQUMvRCxDQUFDO0FBRUQsT0FBSyx1QkFBdUIsTUFBTTtBQUNqQyxnQkFBWSxzQkFBc0Isc0JBQXNCLEVBQUUsSUFBSSxRQUFRLE9BQU8sSUFBSSxVQUFVLFFBQVEsTUFBTSxHQUFHLGdCQUFnQixJQUFJLGVBQW9CLENBQUMsQ0FBQyxFQUFFLEdBQUcsc0JBQXNCLE9BQU87QUFDeEwsVUFBTSxhQUFhLHNCQUFzQixzQkFBc0IsU0FBUztBQUN4RSxVQUFNLFNBQVMsZ0JBQWdCLElBQUksSUFBSSx1QkFBdUIsVUFBVSxDQUFDO0FBRXpFLFdBQU8sWUFBWSxXQUFXLHVCQUF1QixRQUFRLENBQUM7QUFDOUQsV0FBTyxZQUFZLE9BQU8sU0FBUyxRQUFRLENBQUM7QUFFNUMsVUFBTSxpQkFBa0M7QUFBQSxNQUN2QyxJQUFJO0FBQUEsTUFDSixnQkFBZ0I7QUFBQSxNQUNoQixNQUFNLElBQUksVUFBVSxlQUFlLGFBQWE7QUFBQSxJQUNqRDtBQUVBLGtCQUFjLGNBQWMsQ0FBQyxjQUFjLEdBQUcsU0FBUztBQUV2RCxXQUFPLFlBQVksV0FBVyx1QkFBdUIsUUFBUSxDQUFDO0FBQzlELFdBQU8sWUFBWSxPQUFPLFNBQVMsUUFBUSxDQUFDO0FBQzVDLFdBQU8sZ0JBQWdCLFdBQVcsdUJBQXVCLENBQUMsR0FBRyxjQUFjO0FBQzNFLFdBQU8sZ0JBQWdCLE9BQU8sU0FBUyxDQUFDLEdBQUcsY0FBYztBQUV6RCxrQkFBYyxnQkFBZ0IsQ0FBQyxjQUFjLEdBQUcsU0FBUztBQUV6RCxXQUFPLFlBQVksV0FBVyx1QkFBdUIsUUFBUSxDQUFDO0FBQzlELFdBQU8sWUFBWSxPQUFPLFNBQVMsUUFBUSxDQUFDO0FBQUEsRUFDN0MsQ0FBQztBQUVELE9BQUssaUJBQWlCLE1BQU0sbUJBQXlCLEVBQUUsZUFBZSxLQUFLLEdBQUcsWUFBWTtBQUN6RixnQkFBWSxzQkFBc0Isc0JBQXNCLEVBQUUsSUFBSSxRQUFRLE9BQU8sSUFBSSxVQUFVLFFBQVEsTUFBTSxHQUFHLGdCQUFnQixJQUFJLGVBQW9CLENBQUMsQ0FBQyxFQUFFLEdBQUcsc0JBQXNCLE9BQU87QUFDeEwsVUFBTSxhQUFhLHNCQUFzQixzQkFBc0IsU0FBUztBQUN4RSxVQUFNLFNBQVMsZ0JBQWdCLElBQUksSUFBSSx1QkFBdUIsVUFBVSxDQUFDO0FBQ3pFLFdBQU8sWUFBWSxXQUFXLHVCQUF1QixRQUFRLENBQUM7QUFDOUQsV0FBTyxZQUFZLE9BQU8sU0FBUyxRQUFRLENBQUM7QUFFNUMsVUFBTSxpQkFBa0M7QUFBQSxNQUN2QyxJQUFJO0FBQUEsTUFDSixnQkFBZ0I7QUFBQSxNQUNoQixNQUFNLElBQUksVUFBVSxlQUFlLGFBQWE7QUFBQSxNQUNoRCxNQUFNLGVBQWUsT0FBTyxhQUFhLElBQUk7QUFBQSxJQUM5QztBQUVBLGtCQUFjLGNBQWMsQ0FBQyxjQUFjLEdBQUcsU0FBUztBQUN2RCxXQUFPLFlBQVksV0FBVyx1QkFBdUIsUUFBUSxHQUFHLDhDQUE4QztBQUM5RyxXQUFPLFlBQVksT0FBTyxTQUFTLFFBQVEsQ0FBQztBQUU1QyxVQUFNLE1BQU0sa0JBQWtCLFVBQW1CLGFBQWEsS0FBSztBQUNuRSxXQUFPLFlBQVksV0FBVyx1QkFBdUIsUUFBUSxHQUFHLHdEQUF3RDtBQUN4SCxXQUFPLFlBQVksT0FBTyxTQUFTLFFBQVEsQ0FBQztBQUU1QyxRQUFJLElBQUksSUFBSTtBQUNaLFVBQU0sSUFBSSxRQUFRLE9BQUssV0FBVyxHQUFHLEVBQUUsQ0FBQztBQUN4QyxXQUFPLFlBQVksV0FBVyx1QkFBdUIsUUFBUSxHQUFHLG9CQUFvQjtBQUNwRixXQUFPLFlBQVksT0FBTyxTQUFTLFFBQVEsQ0FBQztBQUM1QyxXQUFPLGdCQUFnQixXQUFXLHVCQUF1QixDQUFDLEdBQUcsY0FBYztBQUMzRSxXQUFPLFlBQVksT0FBTyxTQUFTLENBQUMsR0FBRyxjQUFjO0FBRXJELFFBQUksSUFBSSxLQUFLO0FBQ2IsVUFBTSxJQUFJLFFBQVEsT0FBSyxXQUFXLEdBQUcsRUFBRSxDQUFDO0FBQ3hDLFdBQU8sWUFBWSxXQUFXLHVCQUF1QixRQUFRLEdBQUcsdUJBQXVCO0FBQ3ZGLFdBQU8sWUFBWSxPQUFPLFNBQVMsUUFBUSxDQUFDO0FBRTVDLGtCQUFjLGdCQUFnQixDQUFDLGNBQWMsR0FBRyxTQUFTO0FBQ3pELFdBQU8sWUFBWSxXQUFXLHVCQUF1QixRQUFRLEdBQUcsa0NBQWtDO0FBQ2xHLFdBQU8sWUFBWSxPQUFPLFNBQVMsUUFBUSxDQUFDO0FBRTVDLFFBQUksSUFBSSxJQUFJO0FBQ1osVUFBTSxJQUFJLFFBQVEsT0FBSyxXQUFXLEdBQUcsRUFBRSxDQUFDO0FBQ3hDLFdBQU8sWUFBWSxXQUFXLHVCQUF1QixRQUFRLEdBQUcsa0NBQWtDO0FBQ2xHLFdBQU8sWUFBWSxPQUFPLFNBQVMsUUFBUSxDQUFDO0FBQUEsRUFDN0MsQ0FBQyxDQUFDO0FBRUYsT0FBSyw0QkFBNEIsTUFBTSxtQkFBeUIsRUFBRSxlQUFlLEtBQUssR0FBRyxZQUFZO0FBQ3BHLGdCQUFZLHNCQUFzQixzQkFBc0IsRUFBRSxJQUFJLFFBQVEsT0FBTyxJQUFJLFVBQVUsUUFBUSxNQUFNLEdBQUcsZ0JBQWdCLElBQUksZUFBb0IsQ0FBQyxDQUFDLEVBQUUsR0FBRyxzQkFBc0IsT0FBTztBQUN4TCxVQUFNLGFBQWEsc0JBQXNCLHNCQUFzQixTQUFTO0FBQ3hFLFVBQU0sU0FBUyxnQkFBZ0IsSUFBSSxJQUFJLHVCQUF1QixVQUFVLENBQUM7QUFDekUsVUFBTSxRQUF5QixFQUFFLElBQUksU0FBUyxnQkFBZ0IsTUFBTyxNQUFNLElBQUksVUFBVSxlQUFlLGFBQWEsRUFBRTtBQUN2SCxVQUFNLFFBQXlCLEVBQUUsSUFBSSxTQUFTLGdCQUFnQixNQUFPLE1BQU0sSUFBSSxVQUFVLGVBQWUsYUFBYSxHQUFHLE1BQU0sZUFBZSxPQUFPLGFBQWEsSUFBSSxFQUFFO0FBRXZLLGtCQUFjLGNBQWMsQ0FBQyxPQUFPLEtBQUssR0FBRyxTQUFTO0FBQ3JELFdBQU8sZ0JBQWdCLFdBQVcsd0JBQXdCLENBQUMsS0FBSyxHQUFHLDhCQUE4QjtBQUNqRyxXQUFPLGdCQUFnQixPQUFPLFVBQVUsQ0FBQyxLQUFLLEdBQUcsOEJBQThCO0FBRS9FLFVBQU0sTUFBTSxrQkFBa0IsVUFBbUIsYUFBYSxLQUFLO0FBQ25FLFdBQU8sZ0JBQWdCLFdBQVcsd0JBQXdCLENBQUMsS0FBSyxHQUFHLG9DQUFvQztBQUN2RyxXQUFPLGdCQUFnQixPQUFPLFVBQVUsQ0FBQyxLQUFLLEdBQUcsb0NBQW9DO0FBRXJGLFFBQUksSUFBSSxJQUFJO0FBQ1osVUFBTSxJQUFJLFFBQVEsT0FBSyxXQUFXLEdBQUcsRUFBRSxDQUFDO0FBQ3hDLFdBQU8sZ0JBQWdCLFdBQVcsd0JBQXdCLENBQUMsT0FBTyxLQUFLLEdBQUcsOEJBQThCO0FBQ3hHLFdBQU8sZ0JBQWdCLE9BQU8sVUFBVSxDQUFDLE9BQU8sS0FBSyxHQUFHLDhCQUE4QjtBQUV0RixrQkFBYyxnQkFBZ0IsQ0FBQyxPQUFPLEtBQUssR0FBRyxTQUFTO0FBQUEsRUFDeEQsQ0FBQyxDQUFDO0FBRUYsT0FBSyw4QkFBOEIsTUFBTSxtQkFBeUIsRUFBRSxlQUFlLEtBQUssR0FBRyxZQUFZO0FBQ3RHLGdCQUFZLHNCQUFzQixzQkFBc0IsRUFBRSxJQUFJLFFBQVEsT0FBTyxJQUFJLFVBQVUsUUFBUSxNQUFNLEdBQUcsZ0JBQWdCLElBQUksZUFBb0IsQ0FBQyxDQUFDLEVBQUUsR0FBRyxzQkFBc0IsT0FBTztBQUN4TCxVQUFNLGFBQWEsc0JBQXNCLHNCQUFzQixTQUFTO0FBQ3hFLFVBQU0sU0FBUyxnQkFBZ0IsSUFBSSxJQUFJLHVCQUF1QixVQUFVLENBQUM7QUFDekUsVUFBTSxRQUF5QixFQUFFLElBQUksU0FBUyxnQkFBZ0IsTUFBTyxNQUFNLElBQUksVUFBVSxlQUFlLGFBQWEsR0FBRyxNQUFNLGVBQWUsT0FBTyxhQUFhLElBQUksRUFBRTtBQUN2SyxVQUFNLFFBQXlCLEVBQUUsSUFBSSxTQUFTLGdCQUFnQixNQUFPLE1BQU0sSUFBSSxVQUFVLGVBQWUsYUFBYSxFQUFFO0FBRXZILGtCQUFjLGNBQWMsQ0FBQyxPQUFPLEtBQUssR0FBRyxTQUFTO0FBQ3JELFdBQU8sZ0JBQWdCLFdBQVcsd0JBQXdCLENBQUMsS0FBSyxHQUFHLDhCQUE4QjtBQUNqRyxXQUFPLGdCQUFnQixPQUFPLFVBQVUsQ0FBQyxLQUFLLEdBQUcsOEJBQThCO0FBRS9FLFVBQU0sTUFBTSxrQkFBa0IsVUFBbUIsYUFBYSxLQUFLO0FBQ25FLFdBQU8sZ0JBQWdCLFdBQVcsd0JBQXdCLENBQUMsS0FBSyxHQUFHLG9DQUFvQztBQUN2RyxXQUFPLGdCQUFnQixPQUFPLFVBQVUsQ0FBQyxLQUFLLEdBQUcsb0NBQW9DO0FBRXJGLFFBQUksSUFBSSxJQUFJO0FBQ1osVUFBTSxJQUFJLFFBQVEsT0FBSyxXQUFXLEdBQUcsRUFBRSxDQUFDO0FBQ3hDLFdBQU8sZ0JBQWdCLFdBQVcsd0JBQXdCLENBQUMsT0FBTyxLQUFLLEdBQUcsOEJBQThCO0FBQ3hHLFdBQU8sZ0JBQWdCLE9BQU8sVUFBVSxDQUFDLE9BQU8sS0FBSyxHQUFHLDhCQUE4QjtBQUV0RixrQkFBYyxnQkFBZ0IsQ0FBQyxPQUFPLEtBQUssR0FBRyxTQUFTO0FBQUEsRUFDeEQsQ0FBQyxDQUFDO0FBRUYsT0FBSyxjQUFjLE1BQU07QUFDeEIsZ0JBQVksc0JBQXNCLHNCQUFzQixFQUFFLElBQUksUUFBUSxPQUFPLElBQUksVUFBVSxRQUFRLE1BQU0sR0FBRyxnQkFBZ0IsSUFBSSxlQUFvQixDQUFDLENBQUMsRUFBRSxHQUFHLHNCQUFzQixPQUFPO0FBQ3hMLFVBQU0sYUFBYSxzQkFBc0Isc0JBQXNCLFNBQVM7QUFDeEUsVUFBTSxTQUFTLGdCQUFnQixJQUFJLElBQUksdUJBQXVCLFVBQVUsQ0FBQztBQUN6RSxVQUFNLFFBQXlCLEVBQUUsSUFBSSxTQUFTLGdCQUFnQixNQUFPLE1BQU0sSUFBSSxVQUFVLGVBQWUsYUFBYSxHQUFHLHFCQUFxQixLQUFLO0FBQ2xKLFVBQU0sUUFBeUIsRUFBRSxJQUFJLFNBQVMsZ0JBQWdCLE1BQU8sTUFBTSxJQUFJLFVBQVUsZUFBZSxhQUFhLEdBQUcscUJBQXFCLEtBQUs7QUFDbEosVUFBTSxRQUF5QixFQUFFLElBQUksU0FBUyxnQkFBZ0IsTUFBTyxNQUFNLElBQUksVUFBVSxlQUFlLGFBQWEsR0FBRyxxQkFBcUIsS0FBSztBQUVsSixrQkFBYyxjQUFjLENBQUMsT0FBTyxPQUFPLEtBQUssR0FBRyxTQUFTO0FBQzVELFdBQU8sZ0JBQWdCLFdBQVcsd0JBQXdCLENBQUMsT0FBTyxPQUFPLEtBQUssQ0FBQztBQUMvRSxXQUFPLGdCQUFnQixPQUFPLFVBQVUsQ0FBQyxPQUFPLE9BQU8sS0FBSyxDQUFDO0FBRTdELGVBQVcsV0FBVyxTQUFTLElBQUk7QUFDbkMsV0FBTyxnQkFBZ0IsV0FBVyx3QkFBd0IsQ0FBQyxPQUFPLE9BQU8sS0FBSyxHQUFHLHVCQUF1QjtBQUN4RyxXQUFPLGdCQUFnQixPQUFPLFVBQVUsQ0FBQyxPQUFPLE9BQU8sS0FBSyxDQUFDO0FBRTdELGVBQVcsV0FBVyxTQUFTLEtBQUs7QUFDcEMsV0FBTyxnQkFBZ0IsV0FBVyx3QkFBd0IsQ0FBQyxPQUFPLEtBQUssR0FBRyxtQkFBbUI7QUFDN0YsV0FBTyxnQkFBZ0IsT0FBTyxVQUFVLENBQUMsT0FBTyxLQUFLLENBQUM7QUFFdEQsZUFBVyxXQUFXLFNBQVMsS0FBSztBQUNwQyxXQUFPLGdCQUFnQixXQUFXLHdCQUF3QixDQUFDLEtBQUssR0FBRyxtQkFBbUI7QUFDdEYsV0FBTyxnQkFBZ0IsT0FBTyxVQUFVLENBQUMsS0FBSyxDQUFDO0FBRS9DLGVBQVcsV0FBVyxTQUFTLEtBQUs7QUFDcEMsV0FBTyxnQkFBZ0IsV0FBVyx3QkFBd0IsQ0FBQyxHQUFHLGtCQUFrQjtBQUNoRixXQUFPLGdCQUFnQixPQUFPLFVBQVUsQ0FBQyxDQUFDO0FBRTFDLGVBQVcsV0FBVyxTQUFTLElBQUk7QUFDbkMsV0FBTyxnQkFBZ0IsV0FBVyx3QkFBd0IsQ0FBQyxLQUFLLEdBQUcsbUJBQW1CO0FBQ3RGLFdBQU8sZ0JBQWdCLE9BQU8sVUFBVSxDQUFDLEtBQUssQ0FBQztBQUUvQyxlQUFXLFdBQVcsU0FBUyxJQUFJO0FBQ25DLFdBQU8sZ0JBQWdCLFdBQVcsd0JBQXdCLENBQUMsT0FBTyxLQUFLLEdBQUcsbUJBQW1CO0FBQzdGLFdBQU8sZ0JBQWdCLE9BQU8sVUFBVSxDQUFDLE9BQU8sS0FBSyxDQUFDO0FBRXRELGVBQVcsV0FBVyxTQUFTLElBQUk7QUFDbkMsV0FBTyxnQkFBZ0IsV0FBVyx3QkFBd0IsQ0FBQyxPQUFPLE9BQU8sS0FBSyxHQUFHLG1CQUFtQjtBQUNwRyxXQUFPLGdCQUFnQixPQUFPLFVBQVUsQ0FBQyxPQUFPLE9BQU8sS0FBSyxDQUFDO0FBRTdELGtCQUFjLGdCQUFnQixDQUFDLE9BQU8sT0FBTyxLQUFLLEdBQUcsU0FBUztBQUM5RCxXQUFPLGdCQUFnQixXQUFXLHdCQUF3QixDQUFDLENBQUM7QUFDNUQsV0FBTyxnQkFBZ0IsT0FBTyxVQUFVLENBQUMsQ0FBQztBQUFBLEVBQzNDLENBQUM7QUFFRCxPQUFLLFFBQVEsTUFBTTtBQUNsQixnQkFBWSxzQkFBc0Isc0JBQXNCLEVBQUUsSUFBSSxRQUFRLE9BQU8sSUFBSSxVQUFVLFFBQVEsTUFBTSxHQUFHLGdCQUFnQixJQUFJLGVBQW9CLENBQUMsQ0FBQyxFQUFFLEdBQUcsc0JBQXNCLE9BQU87QUFDeEwsVUFBTSxhQUFhLHNCQUFzQixzQkFBc0IsU0FBUztBQUN4RSxVQUFNLFNBQVMsZ0JBQWdCLElBQUksSUFBSSx1QkFBdUIsVUFBVSxDQUFDO0FBQ3pFLFVBQU0sUUFBeUIsRUFBRSxJQUFJLFNBQVMsZ0JBQWdCLE1BQU8sTUFBTSxJQUFJLFVBQVUsZUFBZSxhQUFhLEVBQUU7QUFDdkgsVUFBTSxRQUF5QixFQUFFLElBQUksU0FBUyxnQkFBZ0IsTUFBTyxNQUFNLElBQUksVUFBVSxlQUFlLGFBQWEsRUFBRTtBQUN2SCxVQUFNLFFBQXlCLEVBQUUsSUFBSSxTQUFTLGdCQUFnQixNQUFPLE1BQU0sSUFBSSxVQUFVLGVBQWUsYUFBYSxFQUFFO0FBRXZILGtCQUFjLGNBQWMsQ0FBQyxPQUFPLE9BQU8sS0FBSyxHQUFHLFNBQVM7QUFDNUQsV0FBTyxnQkFBZ0IsV0FBVyx3QkFBd0IsQ0FBQyxPQUFPLE9BQU8sS0FBSyxHQUFHLDBCQUEwQjtBQUMzRyxXQUFPLGdCQUFnQixPQUFPLFVBQVUsQ0FBQyxPQUFPLE9BQU8sS0FBSyxHQUFHLHdCQUF3QjtBQUV2RixlQUFXLEtBQUssU0FBUyxPQUFPO0FBQ2hDLFdBQU8sZ0JBQWdCLFdBQVcsd0JBQXdCLENBQUMsT0FBTyxPQUFPLEtBQUssR0FBRyw4QkFBOEI7QUFDL0csV0FBTyxnQkFBZ0IsT0FBTyxVQUFVLENBQUMsT0FBTyxPQUFPLEtBQUssQ0FBQztBQUU3RCxlQUFXLEtBQUssU0FBUyxPQUFPO0FBQ2hDLFdBQU8sZ0JBQWdCLFdBQVcsd0JBQXdCLENBQUMsT0FBTyxPQUFPLEtBQUssR0FBRyw0QkFBNEI7QUFDN0csV0FBTyxnQkFBZ0IsT0FBTyxVQUFVLENBQUMsT0FBTyxPQUFPLEtBQUssQ0FBQztBQUU3RCxlQUFXLEtBQUssU0FBUyxPQUFPO0FBQ2hDLFdBQU8sZ0JBQWdCLFdBQVcsd0JBQXdCLENBQUMsT0FBTyxPQUFPLEtBQUssR0FBRyw4QkFBOEI7QUFDL0csV0FBTyxnQkFBZ0IsT0FBTyxVQUFVLENBQUMsT0FBTyxPQUFPLEtBQUssQ0FBQztBQUU3RCxlQUFXLEtBQUssU0FBUyxPQUFPO0FBQ2hDLFdBQU8sZ0JBQWdCLFdBQVcsd0JBQXdCLENBQUMsT0FBTyxPQUFPLEtBQUssR0FBRywrQkFBK0I7QUFDaEgsV0FBTyxnQkFBZ0IsT0FBTyxVQUFVLENBQUMsT0FBTyxPQUFPLEtBQUssQ0FBQztBQUFBLEVBQzlELENBQUM7QUFFRCxPQUFLLGVBQWUsTUFBTSxtQkFBeUIsRUFBRSxlQUFlLEtBQUssR0FBRyxZQUFZO0FBQ3ZGLG1CQUFlLE1BQU0sR0FBRyxVQUFVLEVBQUUsaUJBQWlCLEtBQUssVUFBVSxDQUFDLEVBQUUsSUFBSSxTQUFTLFVBQVUsS0FBSyxDQUFDLENBQUMsR0FBRyxhQUFhLFNBQVMsY0FBYyxPQUFPO0FBQ25KLGdCQUFZLHNCQUFzQixzQkFBc0IsRUFBRSxJQUFJLFFBQVEsT0FBTyxJQUFJLFVBQVUsUUFBUSxNQUFNLEdBQUcsZ0JBQWdCLElBQUksZUFBb0IsQ0FBQyxDQUFDLEVBQUUsR0FBRyxzQkFBc0IsT0FBTztBQUN4TCxVQUFNLGFBQWEsc0JBQXNCLHNCQUFzQixTQUFTO0FBQ3hFLFVBQU0sU0FBUyxnQkFBZ0IsSUFBSSxJQUFJLHVCQUF1QixVQUFVLENBQUM7QUFFekUsV0FBTyxZQUFZLFdBQVcsdUJBQXVCLFFBQVEsQ0FBQztBQUM5RCxXQUFPLFlBQVksT0FBTyxTQUFTLFFBQVEsQ0FBQztBQUU1QyxVQUFNLGlCQUFrQztBQUFBLE1BQ3ZDLElBQUk7QUFBQSxNQUNKLGdCQUFnQjtBQUFBLE1BQ2hCLE1BQU0sSUFBSSxVQUFVLGVBQWUsYUFBYTtBQUFBLElBQ2pEO0FBRUEsa0JBQWMsY0FBYyxDQUFDLGNBQWMsR0FBRyxTQUFTO0FBQ3ZELFdBQU8sWUFBWSxXQUFXLHVCQUF1QixRQUFRLEdBQUcsbUVBQW1FO0FBQ25JLFdBQU8sWUFBWSxPQUFPLFNBQVMsUUFBUSxDQUFDO0FBQUEsRUFDN0MsQ0FBQyxDQUFDO0FBRUYsT0FBSyxpQ0FBaUMsTUFBTSxtQkFBeUIsRUFBRSxlQUFlLEtBQUssR0FBRyxZQUFZO0FBQ3pHLG1CQUFlLE1BQU0sR0FBRyxVQUFVLEVBQUUsaUJBQWlCLEtBQUssVUFBVSxDQUFDLEVBQUUsSUFBSSxTQUFTLFVBQVUsS0FBSyxDQUFDLENBQUMsR0FBRyxhQUFhLFNBQVMsY0FBYyxPQUFPO0FBQ25KLGdCQUFZLHNCQUFzQixzQkFBc0IsRUFBRSxJQUFJLFFBQVEsT0FBTyxJQUFJLFVBQVUsUUFBUSxNQUFNLEdBQUcsZ0JBQWdCLElBQUksZUFBb0IsQ0FBQyxDQUFDLEVBQUUsR0FBRyxzQkFBc0IsT0FBTztBQUN4TCxVQUFNLGFBQWEsc0JBQXNCLHNCQUFzQixTQUFTO0FBQ3hFLFVBQU0sU0FBUyxnQkFBZ0IsSUFBSSxJQUFJLHVCQUF1QixVQUFVLENBQUM7QUFFekUsV0FBTyxZQUFZLFdBQVcsdUJBQXVCLFFBQVEsQ0FBQztBQUM5RCxXQUFPLFlBQVksT0FBTyxTQUFTLFFBQVEsQ0FBQztBQUU1QyxVQUFNLGlCQUFrQztBQUFBLE1BQ3ZDLElBQUk7QUFBQSxNQUNKLGdCQUFnQjtBQUFBLE1BQ2hCLE1BQU0sSUFBSSxVQUFVLGVBQWUsYUFBYTtBQUFBLE1BQ2hELE1BQU0sZUFBZSxPQUFPLGFBQWEsSUFBSTtBQUFBLElBQzlDO0FBRUEsa0JBQWMsY0FBYyxDQUFDLGNBQWMsR0FBRyxTQUFTO0FBQ3ZELFdBQU8sWUFBWSxXQUFXLHVCQUF1QixRQUFRLEdBQUcsOENBQThDO0FBQzlHLFdBQU8sWUFBWSxPQUFPLFNBQVMsUUFBUSxDQUFDO0FBRTVDLFVBQU0sTUFBTSxrQkFBa0IsVUFBbUIsYUFBYSxLQUFLO0FBQ25FLFdBQU8sWUFBWSxXQUFXLHVCQUF1QixRQUFRLEdBQUcsd0RBQXdEO0FBQ3hILFdBQU8sWUFBWSxPQUFPLFNBQVMsUUFBUSxDQUFDO0FBRTVDLFFBQUksSUFBSSxJQUFJO0FBQ1osVUFBTSxJQUFJLFFBQVEsT0FBSyxXQUFXLEdBQUcsRUFBRSxDQUFDO0FBQ3hDLFdBQU8sWUFBWSxXQUFXLHVCQUF1QixRQUFRLEdBQUcseUVBQXlFO0FBQ3pJLFdBQU8sWUFBWSxPQUFPLFNBQVMsUUFBUSxDQUFDO0FBQUEsRUFDN0MsQ0FBQyxDQUFDO0FBRUYsT0FBSyxnREFBZ0QsTUFBTSxtQkFBeUIsRUFBRSxlQUFlLEtBQUssR0FBRyxZQUFZO0FBQ3hILG1CQUFlLE1BQU0sR0FBRyxVQUFVLEVBQUUsaUJBQWlCLEtBQUssVUFBVSxDQUFDLEVBQUUsSUFBSSxTQUFTLFVBQVUsS0FBSyxDQUFDLENBQUMsR0FBRyxhQUFhLFNBQVMsY0FBYyxPQUFPO0FBQ25KLGdCQUFZLHNCQUFzQixzQkFBc0IsRUFBRSxJQUFJLFFBQVEsT0FBTyxJQUFJLFVBQVUsUUFBUSxNQUFNLEdBQUcsZ0JBQWdCLElBQUksZUFBb0IsQ0FBQyxDQUFDLEVBQUUsR0FBRyxzQkFBc0IsT0FBTztBQUN4TCxVQUFNLGFBQWEsc0JBQXNCLHNCQUFzQixTQUFTO0FBQ3hFLFVBQU0sU0FBUyxnQkFBZ0IsSUFBSSxJQUFJLHVCQUF1QixVQUFVLENBQUM7QUFFekUsV0FBTyxZQUFZLFdBQVcsdUJBQXVCLFFBQVEsQ0FBQztBQUM5RCxXQUFPLFlBQVksT0FBTyxTQUFTLFFBQVEsQ0FBQztBQUU1QyxVQUFNLFFBQXlCO0FBQUEsTUFDOUIsSUFBSTtBQUFBLE1BQ0osZ0JBQWdCO0FBQUEsTUFDaEIsTUFBTSxJQUFJLFVBQVUsZUFBZSxhQUFhO0FBQUEsTUFDaEQsTUFBTSxlQUFlLE9BQU8sWUFBWSxJQUFJO0FBQUEsSUFDN0M7QUFDQSxVQUFNLFFBQXlCO0FBQUEsTUFDOUIsSUFBSTtBQUFBLE1BQ0osZ0JBQWdCO0FBQUEsTUFDaEIsTUFBTSxJQUFJLFVBQVUsZUFBZSxhQUFhO0FBQUEsSUFDakQ7QUFDQSxVQUFNLFFBQXlCO0FBQUEsTUFDOUIsSUFBSTtBQUFBLE1BQ0osZ0JBQWdCO0FBQUEsTUFDaEIsTUFBTSxJQUFJLFVBQVUsZUFBZSxhQUFhO0FBQUEsTUFDaEQsTUFBTSxlQUFlLE9BQU8sWUFBWSxJQUFJO0FBQUEsSUFDN0M7QUFFQSxrQkFBYyxjQUFjLENBQUMsT0FBTyxPQUFPLEtBQUssR0FBRyxTQUFTO0FBQzVELFdBQU8sZ0JBQWdCLFdBQVcsd0JBQXdCLENBQUMsS0FBSyxHQUFHLDhCQUE4QjtBQUNqRyxXQUFPLGdCQUFnQixPQUFPLFVBQVUsQ0FBQyxLQUFLLENBQUM7QUFFL0MsVUFBTSxNQUFNLGtCQUFrQixVQUFtQixZQUFZLEtBQUs7QUFDbEUsV0FBTyxnQkFBZ0IsV0FBVyx3QkFBd0IsQ0FBQyxLQUFLLEdBQUcsOEJBQThCO0FBQ2pHLFdBQU8sZ0JBQWdCLE9BQU8sVUFBVSxDQUFDLEtBQUssQ0FBQztBQUUvQyxRQUFJLElBQUksSUFBSTtBQUNaLFVBQU0sSUFBSSxRQUFRLE9BQUssV0FBVyxHQUFHLEVBQUUsQ0FBQztBQUN4QyxXQUFPLGdCQUFnQixXQUFXLHdCQUF3QixDQUFDLE9BQU8sS0FBSyxHQUFHLHlCQUF5QjtBQUNuRyxXQUFPLGdCQUFnQixPQUFPLFVBQVUsQ0FBQyxPQUFPLEtBQUssQ0FBQztBQUV0RCxRQUFJLElBQUksS0FBSztBQUNiLFVBQU0sSUFBSSxRQUFRLE9BQUssV0FBVyxHQUFHLEVBQUUsQ0FBQztBQUN4QyxXQUFPLGdCQUFnQixXQUFXLHdCQUF3QixDQUFDLEtBQUssR0FBRyw4QkFBOEI7QUFDakcsV0FBTyxnQkFBZ0IsT0FBTyxVQUFVLENBQUMsS0FBSyxDQUFDO0FBQUEsRUFDaEQsQ0FBQyxDQUFDO0FBRUYsT0FBSyxnRUFBZ0UsTUFBTSxtQkFBeUIsRUFBRSxlQUFlLEtBQUssR0FBRyxZQUFZO0FBQ3hJLGdCQUFZLHNCQUFzQixzQkFBc0IsRUFBRSxJQUFJLFFBQVEsT0FBTyxJQUFJLFVBQVUsUUFBUSxNQUFNLEdBQUcsZ0JBQWdCLElBQUksZUFBb0IsQ0FBQyxDQUFDLEVBQUUsR0FBRyxzQkFBc0IsT0FBTztBQUN4TCxVQUFNLGFBQWEsc0JBQXNCLHNCQUFzQixTQUFTO0FBQ3hFLFVBQU0sU0FBUyxnQkFBZ0IsSUFBSSxJQUFJLHVCQUF1QixVQUFVLENBQUM7QUFDekUsVUFBTSxpQkFBa0M7QUFBQSxNQUN2QyxJQUFJO0FBQUEsTUFDSixnQkFBZ0I7QUFBQSxNQUNoQixNQUFNLElBQUksVUFBVSxlQUFlLGFBQWE7QUFBQSxNQUNoRCxNQUFNLGVBQWUsT0FBTyxhQUFhLElBQUk7QUFBQSxNQUM3QyxxQkFBcUI7QUFBQSxJQUN0QjtBQUVBLGtCQUFjLGNBQWMsQ0FBQyxjQUFjLEdBQUcsU0FBUztBQUV2RCxVQUFNLE1BQU0sa0JBQWtCLFVBQW1CLGFBQWEsSUFBSTtBQUNsRSxVQUFNLElBQUksUUFBUSxPQUFLLFdBQVcsR0FBRyxFQUFFLENBQUM7QUFDeEMsV0FBTyxZQUFZLFdBQVcsdUJBQXVCLFFBQVEsR0FBRyx5Q0FBeUM7QUFDekcsV0FBTyxZQUFZLE9BQU8sU0FBUyxRQUFRLENBQUM7QUFFNUMsZUFBVyxXQUFXLFNBQVMsS0FBSztBQUNwQyxXQUFPLFlBQVksV0FBVyx1QkFBdUIsUUFBUSxHQUFHLHlEQUF5RDtBQUN6SCxXQUFPLFlBQVksT0FBTyxTQUFTLFFBQVEsQ0FBQztBQUU1QyxVQUFNLGNBQWMsTUFBTSxJQUFJO0FBQzlCLG9CQUFnQixJQUFJLFdBQVcsa0NBQWtDLFdBQVcsQ0FBQztBQUM3RSxRQUFJLElBQUksS0FBSztBQUNiLFVBQU0sSUFBSSxRQUFRLE9BQUssV0FBVyxHQUFHLEVBQUUsQ0FBQztBQUN4QyxXQUFPLEdBQUcsQ0FBQyxZQUFZLFFBQVEsOERBQThEO0FBQUEsRUFDOUYsQ0FBQyxDQUFDO0FBRUYsT0FBSyxvRkFBb0YsTUFBTSxtQkFBeUIsRUFBRSxlQUFlLEtBQUssR0FBRyxZQUFZO0FBQzVKLGdCQUFZLHNCQUFzQixzQkFBc0IsRUFBRSxJQUFJLFFBQVEsT0FBTyxJQUFJLFVBQVUsUUFBUSxNQUFNLEdBQUcsZ0JBQWdCLElBQUksZUFBb0IsQ0FBQyxDQUFDLEVBQUUsR0FBRyxzQkFBc0IsT0FBTztBQUN4TCxVQUFNLGFBQWEsc0JBQXNCLHNCQUFzQixTQUFTO0FBQ3hFLFVBQU0sU0FBUyxnQkFBZ0IsSUFBSSxJQUFJLHVCQUF1QixVQUFVLENBQUM7QUFDekUsVUFBTSxpQkFBa0M7QUFBQSxNQUN2QyxJQUFJO0FBQUEsTUFDSixnQkFBZ0I7QUFBQSxNQUNoQixNQUFNLElBQUksVUFBVSxlQUFlLGFBQWE7QUFBQSxNQUNoRCxNQUFNLGVBQWUsT0FBTyxhQUFhLElBQUk7QUFBQSxNQUM3QyxxQkFBcUI7QUFBQSxJQUN0QjtBQUVBLFVBQU0sTUFBTSxrQkFBa0IsVUFBbUIsYUFBYSxJQUFJO0FBQ2xFLFFBQUksSUFBSSxLQUFLO0FBQ2Isa0JBQWMsY0FBYyxDQUFDLGNBQWMsR0FBRyxTQUFTO0FBRXZELFdBQU8sWUFBWSxXQUFXLHVCQUF1QixRQUFRLENBQUM7QUFDOUQsV0FBTyxZQUFZLE9BQU8sU0FBUyxRQUFRLENBQUM7QUFFNUMsVUFBTSxjQUFjLE1BQU0sSUFBSTtBQUM5QixvQkFBZ0IsSUFBSSxXQUFXLCtCQUErQixXQUFXLENBQUM7QUFDMUUsZUFBVyxXQUFXLFNBQVMsSUFBSTtBQUNuQyxXQUFPLEdBQUcsQ0FBQyxZQUFZLFFBQVEsNERBQTREO0FBQzNGLFdBQU8sWUFBWSxXQUFXLHVCQUF1QixRQUFRLENBQUM7QUFDOUQsV0FBTyxZQUFZLE9BQU8sU0FBUyxRQUFRLENBQUM7QUFBQSxFQUM3QyxDQUFDLENBQUM7QUFFRixPQUFLLG1FQUFtRSxNQUFNLG1CQUF5QixFQUFFLGVBQWUsS0FBSyxHQUFHLFlBQVk7QUFDM0ksZ0JBQVksc0JBQXNCLHNCQUFzQixFQUFFLElBQUksUUFBUSxPQUFPLElBQUksVUFBVSxRQUFRLE1BQU0sR0FBRyxnQkFBZ0IsSUFBSSxlQUFvQixDQUFDLENBQUMsRUFBRSxHQUFHLHNCQUFzQixPQUFPO0FBQ3hMLFVBQU0sYUFBYSxzQkFBc0Isc0JBQXNCLFNBQVM7QUFDeEUsVUFBTSxTQUFTLGdCQUFnQixJQUFJLElBQUksdUJBQXVCLFVBQVUsQ0FBQztBQUN6RSxVQUFNLGlCQUFrQztBQUFBLE1BQ3ZDLElBQUk7QUFBQSxNQUNKLGdCQUFnQjtBQUFBLE1BQ2hCLE1BQU0sSUFBSSxVQUFVLGVBQWUsYUFBYTtBQUFBLE1BQ2hELE1BQU0sZUFBZSxPQUFPLGFBQWEsSUFBSTtBQUFBLE1BQzdDLHFCQUFxQjtBQUFBLElBQ3RCO0FBRUEsVUFBTSxNQUFNLGtCQUFrQixVQUFtQixhQUFhLElBQUk7QUFDbEUsUUFBSSxJQUFJLEtBQUs7QUFDYixrQkFBYyxjQUFjLENBQUMsY0FBYyxHQUFHLFNBQVM7QUFFdkQsV0FBTyxZQUFZLFdBQVcsdUJBQXVCLFFBQVEsQ0FBQztBQUM5RCxXQUFPLFlBQVksT0FBTyxTQUFTLFFBQVEsQ0FBQztBQUU1QyxVQUFNLGNBQWMsTUFBTSxJQUFJO0FBQzlCLG9CQUFnQixJQUFJLFdBQVcsK0JBQStCLFdBQVcsQ0FBQztBQUMxRSxlQUFXLFdBQVcsU0FBUyxLQUFLO0FBQ3BDLFdBQU8sR0FBRyxDQUFDLFlBQVksUUFBUSxxREFBcUQ7QUFDcEYsV0FBTyxZQUFZLFdBQVcsdUJBQXVCLFFBQVEsQ0FBQztBQUM5RCxXQUFPLFlBQVksT0FBTyxTQUFTLFFBQVEsQ0FBQztBQUFBLEVBQzdDLENBQUMsQ0FBQztBQUVGLE9BQUssd0ZBQXdGLE1BQU0sbUJBQXlCLEVBQUUsZUFBZSxLQUFLLEdBQUcsWUFBWTtBQUNoSyxnQkFBWSxzQkFBc0Isc0JBQXNCLEVBQUUsSUFBSSxRQUFRLE9BQU8sSUFBSSxVQUFVLFFBQVEsTUFBTSxHQUFHLGdCQUFnQixJQUFJLGVBQW9CLENBQUMsQ0FBQyxFQUFFLEdBQUcsc0JBQXNCLE9BQU87QUFDeEwsVUFBTSxhQUFhLHNCQUFzQixzQkFBc0IsU0FBUztBQUN4RSxVQUFNLFNBQVMsZ0JBQWdCLElBQUksSUFBSSx1QkFBdUIsVUFBVSxDQUFDO0FBQ3pFLFVBQU0saUJBQWtDO0FBQUEsTUFDdkMsSUFBSTtBQUFBLE1BQ0osZ0JBQWdCO0FBQUEsTUFDaEIsTUFBTSxJQUFJLFVBQVUsZUFBZSxhQUFhO0FBQUEsTUFDaEQsTUFBTSxlQUFlLE9BQU8sYUFBYSxJQUFJO0FBQUEsTUFDN0MscUJBQXFCO0FBQUEsSUFDdEI7QUFFQSxVQUFNLE1BQU0sa0JBQWtCLFVBQW1CLGFBQWEsSUFBSTtBQUNsRSxRQUFJLElBQUksS0FBSztBQUNiLGtCQUFjLGNBQWMsQ0FBQyxjQUFjLEdBQUcsU0FBUztBQUV2RCxXQUFPLFlBQVksV0FBVyx1QkFBdUIsUUFBUSxDQUFDO0FBQzlELFdBQU8sWUFBWSxPQUFPLFNBQVMsUUFBUSxDQUFDO0FBRTVDLGVBQVcsV0FBVyxTQUFTLEtBQUs7QUFDcEMsV0FBTyxZQUFZLFdBQVcsdUJBQXVCLFFBQVEsQ0FBQztBQUM5RCxXQUFPLFlBQVksT0FBTyxTQUFTLFFBQVEsQ0FBQztBQUU1QyxVQUFNLGNBQWMsTUFBTSxJQUFJO0FBQzlCLG9CQUFnQixJQUFJLFdBQVcsK0JBQStCLFdBQVcsQ0FBQztBQUMxRSxlQUFXLFdBQVcsU0FBUyxJQUFJO0FBQ25DLFdBQU8sR0FBRyxDQUFDLFlBQVksUUFBUSxxREFBcUQ7QUFDcEYsV0FBTyxZQUFZLFdBQVcsdUJBQXVCLFFBQVEsQ0FBQztBQUM5RCxXQUFPLFlBQVksT0FBTyxTQUFTLFFBQVEsQ0FBQztBQUFBLEVBQzdDLENBQUMsQ0FBQztBQUVGLE9BQUssOERBQThELE1BQU0sbUJBQXlCLEVBQUUsZUFBZSxLQUFLLEdBQUcsWUFBWTtBQUN0SSxnQkFBWSxzQkFBc0Isc0JBQXNCLEVBQUUsSUFBSSxRQUFRLE9BQU8sSUFBSSxVQUFVLFFBQVEsTUFBTSxHQUFHLGdCQUFnQixJQUFJLGVBQW9CLENBQUMsQ0FBQyxFQUFFLEdBQUcsc0JBQXNCLE9BQU87QUFDeEwsVUFBTSxhQUFhLHNCQUFzQixzQkFBc0IsU0FBUztBQUN4RSxVQUFNLFNBQVMsZ0JBQWdCLElBQUksSUFBSSx1QkFBdUIsVUFBVSxDQUFDO0FBRXpFLGtCQUFjLGNBQWMsQ0FBQztBQUFBLE1BQzVCLElBQUk7QUFBQSxNQUNKLGdCQUFnQjtBQUFBLE1BQ2hCLE1BQU0sSUFBSSxVQUFVLGVBQWUsYUFBYTtBQUFBLE1BQ2hELHFCQUFxQjtBQUFBLE1BQ3JCLE9BQU87QUFBQSxJQUNSLEdBQUc7QUFBQSxNQUNGLElBQUk7QUFBQSxNQUNKLGdCQUFnQjtBQUFBLE1BQ2hCLE1BQU0sSUFBSSxVQUFVLGVBQWUsYUFBYTtBQUFBLE1BQ2hELHFCQUFxQjtBQUFBLE1BQ3JCLE9BQU87QUFBQSxJQUNSLENBQUMsR0FBRyxTQUFTO0FBRWIsV0FBTyxZQUFZLE9BQU8sU0FBUyxRQUFRLENBQUM7QUFDNUMsV0FBTyxZQUFZLE9BQU8sU0FBUyxDQUFDLEVBQUUsSUFBSSxPQUFPO0FBQ2pELFdBQU8sWUFBWSxPQUFPLFNBQVMsQ0FBQyxFQUFFLElBQUksT0FBTztBQUVqRCxrQkFBYyxjQUFjLENBQUM7QUFBQSxNQUM1QixJQUFJO0FBQUEsTUFDSixnQkFBZ0I7QUFBQSxNQUNoQixNQUFNLElBQUksVUFBVSxlQUFlLGFBQWE7QUFBQSxNQUNoRCxxQkFBcUI7QUFBQSxNQUNyQixPQUFPO0FBQUEsSUFDUixHQUFHO0FBQUEsTUFDRixJQUFJO0FBQUEsTUFDSixnQkFBZ0I7QUFBQSxNQUNoQixNQUFNLElBQUksVUFBVSxlQUFlLGFBQWE7QUFBQSxNQUNoRCxxQkFBcUI7QUFBQSxNQUNyQixPQUFPO0FBQUEsSUFDUixHQUFHO0FBQUEsTUFDRixJQUFJO0FBQUEsTUFDSixnQkFBZ0I7QUFBQSxNQUNoQixNQUFNLElBQUksVUFBVSxlQUFlLGFBQWE7QUFBQSxNQUNoRCxxQkFBcUI7QUFBQSxNQUNyQixPQUFPO0FBQUEsSUFDUixDQUFDLEdBQUcsU0FBUztBQUViLFdBQU8sWUFBWSxPQUFPLFNBQVMsUUFBUSxDQUFDO0FBQzVDLFdBQU8sWUFBWSxPQUFPLFNBQVMsQ0FBQyxFQUFFLElBQUksT0FBTztBQUNqRCxXQUFPLFlBQVksT0FBTyxTQUFTLENBQUMsRUFBRSxJQUFJLE9BQU87QUFDakQsV0FBTyxZQUFZLE9BQU8sU0FBUyxDQUFDLEVBQUUsSUFBSSxPQUFPO0FBQ2pELFdBQU8sWUFBWSxPQUFPLFNBQVMsQ0FBQyxFQUFFLElBQUksT0FBTztBQUNqRCxXQUFPLFlBQVksT0FBTyxTQUFTLENBQUMsRUFBRSxJQUFJLE9BQU87QUFBQSxFQUNsRCxDQUFDLENBQUM7QUFFRixPQUFLLG9GQUFvRixNQUFNLG1CQUF5QixFQUFFLGVBQWUsS0FBSyxHQUFHLFlBQVk7QUFDNUosZ0JBQVksc0JBQXNCLHNCQUFzQixFQUFFLElBQUksUUFBUSxPQUFPLElBQUksVUFBVSxRQUFRLE1BQU0sR0FBRyxnQkFBZ0IsSUFBSSxlQUFvQixDQUFDLENBQUMsRUFBRSxHQUFHLHNCQUFzQixPQUFPO0FBQ3hMLFVBQU0sYUFBYSxzQkFBc0Isc0JBQXNCLFNBQVM7QUFDeEUsVUFBTSxTQUFTLGdCQUFnQixJQUFJLElBQUksdUJBQXVCLFVBQVUsQ0FBQztBQUN6RSxVQUFNLGlCQUFrQztBQUFBLE1BQ3ZDLElBQUk7QUFBQSxNQUNKLGdCQUFnQjtBQUFBLE1BQ2hCLE1BQU0sSUFBSSxVQUFVLGVBQWUsYUFBYTtBQUFBLE1BQ2hELE1BQU0sZUFBZSxPQUFPLGFBQWEsSUFBSTtBQUFBLE1BQzdDLHFCQUFxQjtBQUFBLElBQ3RCO0FBRUEsVUFBTSxNQUFNLGtCQUFrQixVQUFtQixhQUFhLElBQUk7QUFDbEUsUUFBSSxJQUFJLEtBQUs7QUFDYixrQkFBYyxjQUFjLENBQUMsY0FBYyxHQUFHLFNBQVM7QUFDdkQsZUFBVyxXQUFXLFNBQVMsS0FBSztBQUVwQyxXQUFPLFlBQVksV0FBVyx1QkFBdUIsUUFBUSxDQUFDO0FBQzlELFdBQU8sWUFBWSxPQUFPLFNBQVMsUUFBUSxDQUFDO0FBRTVDLFVBQU0sY0FBYyxNQUFNLElBQUk7QUFDOUIsb0JBQWdCLElBQUksV0FBVywrQkFBK0IsV0FBVyxDQUFDO0FBQzFFLG9CQUFnQixJQUFJLE1BQU0sS0FBSyxXQUFXLGdDQUFnQyxFQUFFLE1BQU0sV0FBVyxXQUFXLFNBQVMsSUFBSSxDQUFDLENBQUM7QUFDdkgsUUFBSSxJQUFJLElBQUk7QUFDWixVQUFNLElBQUksUUFBUSxPQUFLLFdBQVcsR0FBRyxFQUFFLENBQUM7QUFDeEMsV0FBTyxZQUFZLFlBQVksV0FBVyxDQUFDO0FBQzNDLFdBQU8sWUFBWSxXQUFXLHVCQUF1QixRQUFRLENBQUM7QUFDOUQsV0FBTyxZQUFZLE9BQU8sU0FBUyxRQUFRLENBQUM7QUFDNUMsV0FBTyxZQUFZLE9BQU8sU0FBUyxDQUFDLEVBQUUsSUFBSSxPQUFPO0FBQUEsRUFDbEQsQ0FBQyxDQUFDO0FBRUYsT0FBSyxrRkFBa0YsTUFBTSxtQkFBeUIsRUFBRSxlQUFlLEtBQUssR0FBRyxZQUFZO0FBQzFKLGdCQUFZLHNCQUFzQixzQkFBc0IsRUFBRSxJQUFJLFFBQVEsT0FBTyxJQUFJLFVBQVUsUUFBUSxNQUFNLEdBQUcsZ0JBQWdCLElBQUksZUFBb0IsQ0FBQyxDQUFDLEVBQUUsR0FBRyxzQkFBc0IsT0FBTztBQUN4TCxVQUFNLGFBQWEsc0JBQXNCLHNCQUFzQixTQUFTO0FBQ3hFLFVBQU0sU0FBUyxnQkFBZ0IsSUFBSSxJQUFJLHVCQUF1QixVQUFVLENBQUM7QUFDekUsVUFBTSxpQkFBa0M7QUFBQSxNQUN2QyxJQUFJO0FBQUEsTUFDSixnQkFBZ0I7QUFBQSxNQUNoQixNQUFNLElBQUksVUFBVSxlQUFlLGFBQWE7QUFBQSxNQUNoRCxNQUFNLGVBQWUsT0FBTyxhQUFhLElBQUk7QUFBQSxNQUM3QyxxQkFBcUI7QUFBQSxJQUN0QjtBQUVBLFVBQU0sTUFBTSxrQkFBa0IsVUFBbUIsYUFBYSxJQUFJO0FBQ2xFLFFBQUksSUFBSSxLQUFLO0FBQ2Isa0JBQWMsY0FBYyxDQUFDLGNBQWMsR0FBRyxTQUFTO0FBRXZELFdBQU8sWUFBWSxXQUFXLHVCQUF1QixRQUFRLENBQUM7QUFDOUQsV0FBTyxZQUFZLE9BQU8sU0FBUyxRQUFRLENBQUM7QUFFNUMsVUFBTSxjQUFjLE1BQU0sSUFBSTtBQUM5QixvQkFBZ0IsSUFBSSxXQUFXLCtCQUErQixXQUFXLENBQUM7QUFDMUUsb0JBQWdCLElBQUksTUFBTSxLQUFLLFdBQVcsZ0NBQWdDLEVBQUUsTUFBTSxXQUFXLFdBQVcsU0FBUyxLQUFLLENBQUMsQ0FBQztBQUN4SCxRQUFJLElBQUksSUFBSTtBQUNaLFVBQU0sSUFBSSxRQUFRLE9BQUssV0FBVyxHQUFHLEVBQUUsQ0FBQztBQUN4QyxXQUFPLFlBQVksWUFBWSxXQUFXLENBQUM7QUFDM0MsV0FBTyxZQUFZLFdBQVcsdUJBQXVCLFFBQVEsQ0FBQztBQUM5RCxXQUFPLFlBQVksT0FBTyxTQUFTLFFBQVEsQ0FBQztBQUFBLEVBQzdDLENBQUMsQ0FBQztBQUVGLE9BQUssb0RBQW9ELE1BQU0sbUJBQXlCLEVBQUUsZUFBZSxLQUFLLEdBQUcsWUFBWTtBQUM1SCxnQkFBWSxzQkFBc0Isc0JBQXNCLEVBQUUsSUFBSSxRQUFRLE9BQU8sSUFBSSxVQUFVLFFBQVEsTUFBTSxHQUFHLGdCQUFnQixJQUFJLGVBQW9CLENBQUMsQ0FBQyxFQUFFLEdBQUcsc0JBQXNCLE9BQU87QUFDeEwsVUFBTSxhQUFhLHNCQUFzQixzQkFBc0IsU0FBUztBQUN4RSxVQUFNLGlCQUFrQztBQUFBLE1BQ3ZDLElBQUk7QUFBQSxNQUNKLGdCQUFnQjtBQUFBLE1BQ2hCLE1BQU0sSUFBSSxVQUFVLGVBQWUsYUFBYTtBQUFBLE1BQ2hELHFCQUFxQjtBQUFBLElBQ3RCO0FBRUEsbUJBQWUsTUFBTSx1QkFBdUIsWUFBWSxHQUFHLEtBQUssVUFBVSxDQUFDO0FBQUEsTUFDMUUsSUFBSSxlQUFlO0FBQUEsTUFDbkIsVUFBVTtBQUFBLE1BQ1YsT0FBTztBQUFBLElBQ1IsQ0FBQyxDQUFDLEdBQUcsYUFBYSxTQUFTLGNBQWMsSUFBSTtBQUU3QyxrQkFBYyxjQUFjLENBQUMsY0FBYyxHQUFHLFNBQVM7QUFFdkQsV0FBTyxZQUFZLFdBQVcsVUFBVSxlQUFlLEVBQUUsR0FBRyxLQUFLO0FBQ2pFLFdBQU8sWUFBWSxXQUFXLHNCQUFzQixDQUFDLEVBQUUsSUFBSSxlQUFlLEVBQUU7QUFDNUUsV0FBTyxZQUFZLFdBQVcsdUJBQXVCLFFBQVEsQ0FBQztBQUFBLEVBQy9ELENBQUMsQ0FBQztBQUVGLE9BQUssb0ZBQW9GLE1BQU0sbUJBQXlCLEVBQUUsZUFBZSxLQUFLLEdBQUcsWUFBWTtBQUM1SixnQkFBWSxzQkFBc0Isc0JBQXNCLEVBQUUsSUFBSSxRQUFRLE9BQU8sSUFBSSxVQUFVLFFBQVEsTUFBTSxHQUFHLGdCQUFnQixJQUFJLGVBQW9CLENBQUMsQ0FBQyxFQUFFLEdBQUcsc0JBQXNCLE9BQU87QUFDeEwsVUFBTSxhQUFhLHNCQUFzQixzQkFBc0IsU0FBUztBQUN4RSxVQUFNLFNBQVMsZ0JBQWdCLElBQUksSUFBSSx1QkFBdUIsVUFBVSxDQUFDO0FBQ3pFLFVBQU0sa0JBQW1DO0FBQUEsTUFDeEMsSUFBSTtBQUFBLE1BQ0osZ0JBQWdCO0FBQUEsTUFDaEIsTUFBTSxJQUFJLFVBQVUsZUFBZSxhQUFhO0FBQUEsTUFDaEQscUJBQXFCO0FBQUEsSUFDdEI7QUFDQSxVQUFNLGtCQUFtQztBQUFBLE1BQ3hDLElBQUk7QUFBQSxNQUNKLGdCQUFnQjtBQUFBLE1BQ2hCLE1BQU0sSUFBSSxVQUFVLGVBQWUsYUFBYTtBQUFBLE1BQ2hELHFCQUFxQjtBQUFBLElBQ3RCO0FBQ0EsVUFBTSxrQkFBbUM7QUFBQSxNQUN4QyxJQUFJO0FBQUEsTUFDSixnQkFBZ0I7QUFBQSxNQUNoQixNQUFNLElBQUksVUFBVSxlQUFlLGFBQWE7QUFBQSxNQUNoRCxxQkFBcUI7QUFBQSxJQUN0QjtBQUVBLGtCQUFjLGNBQWMsQ0FBQyxpQkFBaUIsaUJBQWlCLGVBQWUsR0FBRyxTQUFTO0FBRTFGLFVBQU0sZUFBZSxNQUFNLElBQUk7QUFDL0Isb0JBQWdCLElBQUksV0FBVyxrQ0FBa0MsWUFBWSxDQUFDO0FBRTlFLFVBQU0sV0FBVyxNQUFNLElBQUk7QUFDM0Isb0JBQWdCLElBQUksV0FBVywrQkFBK0IsUUFBUSxDQUFDO0FBRXZFLG1CQUFlLE1BQU0sdUJBQXVCLFlBQVksR0FBRyxLQUFLLFVBQVUsQ0FBQztBQUFBLE1BQzFFLElBQUksZ0JBQWdCO0FBQUEsTUFDcEIsVUFBVTtBQUFBLE1BQ1YsT0FBTztBQUFBLElBQ1IsR0FBRztBQUFBLE1BQ0YsSUFBSSxnQkFBZ0I7QUFBQSxNQUNwQixVQUFVO0FBQUEsTUFDVixPQUFPO0FBQUEsSUFDUixHQUFHO0FBQUEsTUFDRixJQUFJLGdCQUFnQjtBQUFBLE1BQ3BCLFVBQVU7QUFBQSxNQUNWLE9BQU87QUFBQSxJQUNSLENBQUMsQ0FBQyxHQUFHLGFBQWEsU0FBUyxjQUFjLElBQUk7QUFFN0MsV0FBTyxHQUFHLENBQUMsU0FBUyxRQUFRLGdDQUFnQztBQUM1RCxXQUFPLEdBQUcsYUFBYSxZQUFZLCtCQUErQjtBQUNsRSxXQUFPLGdCQUFnQixhQUFhLEtBQUssQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDO0FBQUEsTUFDaEQsZ0JBQWdCO0FBQUEsTUFDaEIsT0FBTztBQUFBLElBQ1IsR0FBRztBQUFBLE1BQ0YsZ0JBQWdCO0FBQUEsTUFDaEIsT0FBTztBQUFBLElBQ1IsQ0FBQyxDQUFDO0FBQ0YsV0FBTyxZQUFZLE9BQU8sU0FBUyxRQUFRLENBQUM7QUFDNUMsV0FBTyxZQUFZLE9BQU8sU0FBUyxDQUFDLEVBQUUsSUFBSSxnQkFBZ0IsRUFBRTtBQUFBLEVBQzdELENBQUMsQ0FBQztBQUVGLE9BQUssaUZBQWlGLE1BQU0sbUJBQXlCLEVBQUUsZUFBZSxLQUFLLEdBQUcsWUFBWTtBQUN6SixnQkFBWSxzQkFBc0Isc0JBQXNCLEVBQUUsSUFBSSxRQUFRLE9BQU8sSUFBSSxVQUFVLFFBQVEsTUFBTSxHQUFHLGdCQUFnQixJQUFJLGVBQW9CLENBQUMsQ0FBQyxFQUFFLEdBQUcsc0JBQXNCLE9BQU87QUFDeEwsVUFBTSxhQUFhLHNCQUFzQixzQkFBc0IsU0FBUztBQUN4RSxVQUFNLFNBQVMsZ0JBQWdCLElBQUksSUFBSSx1QkFBdUIsVUFBVSxDQUFDO0FBQ3pFLFVBQU0sa0JBQW1DO0FBQUEsTUFDeEMsSUFBSTtBQUFBLE1BQ0osZ0JBQWdCO0FBQUEsTUFDaEIsTUFBTSxJQUFJLFVBQVUsZUFBZSxhQUFhO0FBQUEsTUFDaEQscUJBQXFCO0FBQUEsSUFDdEI7QUFDQSxVQUFNLGtCQUFtQztBQUFBLE1BQ3hDLElBQUk7QUFBQSxNQUNKLGdCQUFnQjtBQUFBLE1BQ2hCLE1BQU0sSUFBSSxVQUFVLGVBQWUsYUFBYTtBQUFBLE1BQ2hELHFCQUFxQjtBQUFBLElBQ3RCO0FBQ0EsVUFBTSxrQkFBbUM7QUFBQSxNQUN4QyxJQUFJO0FBQUEsTUFDSixnQkFBZ0I7QUFBQSxNQUNoQixNQUFNLElBQUksVUFBVSxlQUFlLGFBQWE7QUFBQSxNQUNoRCxxQkFBcUI7QUFBQSxJQUN0QjtBQUVBLGtCQUFjLGNBQWMsQ0FBQyxpQkFBaUIsaUJBQWlCLGVBQWUsR0FBRyxTQUFTO0FBQzFGLGVBQVcsV0FBVyxnQkFBZ0IsSUFBSSxLQUFLO0FBQy9DLGVBQVcsV0FBVyxnQkFBZ0IsSUFBSSxLQUFLO0FBRS9DLFVBQU0sY0FBYyxNQUFNLElBQUk7QUFDOUIsb0JBQWdCLElBQUksV0FBVyxrQ0FBa0MsV0FBVyxDQUFDO0FBRTdFLFVBQU0sV0FBVyxNQUFNLElBQUk7QUFDM0Isb0JBQWdCLElBQUksV0FBVywrQkFBK0IsUUFBUSxDQUFDO0FBRXZFLG1CQUFlLE1BQU0sdUJBQXVCLFlBQVksR0FBRyxLQUFLLFVBQVUsQ0FBQztBQUFBLE1BQzFFLElBQUksZ0JBQWdCO0FBQUEsTUFDcEIsVUFBVTtBQUFBLE1BQ1YsT0FBTztBQUFBLElBQ1IsR0FBRztBQUFBLE1BQ0YsSUFBSSxnQkFBZ0I7QUFBQSxNQUNwQixVQUFVO0FBQUEsTUFDVixPQUFPO0FBQUEsSUFDUixHQUFHO0FBQUEsTUFDRixJQUFJLGdCQUFnQjtBQUFBLE1BQ3BCLFVBQVU7QUFBQSxNQUNWLE9BQU87QUFBQSxJQUNSLENBQUMsQ0FBQyxHQUFHLGFBQWEsU0FBUyxjQUFjLElBQUk7QUFFN0MsV0FBTyxHQUFHLENBQUMsWUFBWSxRQUFRLG1DQUFtQztBQUVsRSxXQUFPLEdBQUcsU0FBUyxZQUFZLGlDQUFpQztBQUNoRSxXQUFPLGdCQUFnQixTQUFTLEtBQUssQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDO0FBQUEsTUFDNUMsZ0JBQWdCO0FBQUEsTUFDaEIsT0FBTztBQUFBLE1BQ1AsV0FBVztBQUFBLE1BQ1gsTUFBTTtBQUFBLElBQ1AsR0FBRztBQUFBLE1BQ0YsZ0JBQWdCO0FBQUEsTUFDaEIsT0FBTztBQUFBLE1BQ1AsV0FBVztBQUFBLE1BQ1gsTUFBTTtBQUFBLElBQ1AsQ0FBQyxDQUFDO0FBRUYsV0FBTyxZQUFZLE9BQU8sU0FBUyxRQUFRLENBQUM7QUFDNUMsV0FBTyxZQUFZLE9BQU8sU0FBUyxDQUFDLEVBQUUsSUFBSSxnQkFBZ0IsRUFBRTtBQUM1RCxXQUFPLFlBQVksT0FBTyxTQUFTLENBQUMsRUFBRSxJQUFJLGdCQUFnQixFQUFFO0FBQzVELFdBQU8sWUFBWSxPQUFPLFNBQVMsQ0FBQyxFQUFFLElBQUksZ0JBQWdCLEVBQUU7QUFBQSxFQUM3RCxDQUFDLENBQUM7QUFFRixPQUFLLHdHQUF3RyxNQUFNLG1CQUF5QixFQUFFLGVBQWUsS0FBSyxHQUFHLFlBQVk7QUFDaEwsZ0JBQVksc0JBQXNCLHNCQUFzQixFQUFFLElBQUksUUFBUSxPQUFPLElBQUksVUFBVSxRQUFRLE1BQU0sR0FBRyxnQkFBZ0IsSUFBSSxlQUFvQixDQUFDLENBQUMsRUFBRSxHQUFHLHNCQUFzQixPQUFPO0FBQ3hMLFVBQU0sYUFBYSxzQkFBc0Isc0JBQXNCLFNBQVM7QUFDeEUsVUFBTSxTQUFTLGdCQUFnQixJQUFJLElBQUksdUJBQXVCLFVBQVUsQ0FBQztBQUN6RSxVQUFNLGtCQUFtQztBQUFBLE1BQ3hDLElBQUk7QUFBQSxNQUNKLGdCQUFnQjtBQUFBLE1BQ2hCLE1BQU0sSUFBSSxVQUFVLGVBQWUsYUFBYTtBQUFBLE1BQ2hELHFCQUFxQjtBQUFBLElBQ3RCO0FBQ0EsVUFBTSxrQkFBbUM7QUFBQSxNQUN4QyxJQUFJO0FBQUEsTUFDSixnQkFBZ0I7QUFBQSxNQUNoQixNQUFNLElBQUksVUFBVSxlQUFlLGFBQWE7QUFBQSxNQUNoRCxxQkFBcUI7QUFBQSxJQUN0QjtBQUNBLFVBQU0sa0JBQW1DO0FBQUEsTUFDeEMsSUFBSTtBQUFBLE1BQ0osZ0JBQWdCO0FBQUEsTUFDaEIsTUFBTSxJQUFJLFVBQVUsZUFBZSxhQUFhO0FBQUEsTUFDaEQscUJBQXFCO0FBQUEsSUFDdEI7QUFDQSxVQUFNLGtCQUFtQztBQUFBLE1BQ3hDLElBQUk7QUFBQSxNQUNKLGdCQUFnQjtBQUFBLE1BQ2hCLE1BQU0sSUFBSSxVQUFVLGVBQWUsYUFBYTtBQUFBLE1BQ2hELHFCQUFxQjtBQUFBLElBQ3RCO0FBRUEsa0JBQWMsY0FBYyxDQUFDLGlCQUFpQixpQkFBaUIsaUJBQWlCLGVBQWUsR0FBRyxTQUFTO0FBQzNHLGVBQVcsV0FBVyxnQkFBZ0IsSUFBSSxLQUFLO0FBRS9DLFVBQU0sY0FBYyxNQUFNLElBQUk7QUFDOUIsb0JBQWdCLElBQUksV0FBVyxrQ0FBa0MsV0FBVyxDQUFDO0FBRTdFLFVBQU0sV0FBVyxNQUFNLElBQUk7QUFDM0Isb0JBQWdCLElBQUksV0FBVywrQkFBK0IsUUFBUSxDQUFDO0FBRXZFLG1CQUFlLE1BQU0sdUJBQXVCLFlBQVksR0FBRyxLQUFLLFVBQVUsQ0FBQztBQUFBLE1BQzFFLElBQUksZ0JBQWdCO0FBQUEsTUFDcEIsVUFBVTtBQUFBLE1BQ1YsT0FBTztBQUFBLElBQ1IsR0FBRztBQUFBLE1BQ0YsSUFBSSxnQkFBZ0I7QUFBQSxNQUNwQixVQUFVO0FBQUEsTUFDVixPQUFPO0FBQUEsSUFDUixHQUFHO0FBQUEsTUFDRixJQUFJLGdCQUFnQjtBQUFBLE1BQ3BCLFVBQVU7QUFBQSxNQUNWLE9BQU87QUFBQSxJQUNSLEdBQUc7QUFBQSxNQUNGLElBQUksZ0JBQWdCO0FBQUEsTUFDcEIsVUFBVTtBQUFBLE1BQ1YsT0FBTztBQUFBLElBQ1IsQ0FBQyxDQUFDLEdBQUcsYUFBYSxTQUFTLGNBQWMsSUFBSTtBQUU3QyxXQUFPLEdBQUcsWUFBWSxZQUFZLG9DQUFvQztBQUN0RSxXQUFPLGdCQUFnQixZQUFZLEtBQUssQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDO0FBQUEsTUFDL0MsZ0JBQWdCO0FBQUEsTUFDaEIsT0FBTztBQUFBLElBQ1IsR0FBRztBQUFBLE1BQ0YsZ0JBQWdCO0FBQUEsTUFDaEIsT0FBTztBQUFBLElBQ1IsQ0FBQyxDQUFDO0FBRUYsV0FBTyxHQUFHLFNBQVMsWUFBWSxpQ0FBaUM7QUFDaEUsV0FBTyxnQkFBZ0IsU0FBUyxLQUFLLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQztBQUFBLE1BQzVDLGdCQUFnQjtBQUFBLE1BQ2hCLE9BQU87QUFBQSxNQUNQLFdBQVc7QUFBQSxNQUNYLE1BQU07QUFBQSxJQUNQLENBQUMsQ0FBQztBQUNGLFdBQU8sWUFBWSxPQUFPLFNBQVMsUUFBUSxDQUFDO0FBQzVDLFdBQU8sWUFBWSxPQUFPLFNBQVMsQ0FBQyxFQUFFLElBQUksZ0JBQWdCLEVBQUU7QUFDNUQsV0FBTyxZQUFZLE9BQU8sU0FBUyxDQUFDLEVBQUUsSUFBSSxnQkFBZ0IsRUFBRTtBQUFBLEVBQzdELENBQUMsQ0FBQztBQUVGLE9BQUssMkZBQTJGLE1BQU0sbUJBQXlCLEVBQUUsZUFBZSxLQUFLLEdBQUcsWUFBWTtBQUNuSyxnQkFBWSxzQkFBc0Isc0JBQXNCLEVBQUUsSUFBSSxRQUFRLE9BQU8sSUFBSSxVQUFVLFFBQVEsTUFBTSxHQUFHLGdCQUFnQixJQUFJLGVBQW9CLENBQUMsQ0FBQyxFQUFFLEdBQUcsc0JBQXNCLE9BQU87QUFDeEwsVUFBTSxpQkFBa0M7QUFBQSxNQUN2QyxJQUFJO0FBQUEsTUFDSixnQkFBZ0I7QUFBQSxNQUNoQixNQUFNLElBQUksVUFBVSxlQUFlLGFBQWE7QUFBQSxNQUNoRCxxQkFBcUI7QUFBQSxJQUN0QjtBQUNBLG1CQUFlLE1BQU0sdUJBQXVCLFlBQVksR0FBRyxLQUFLLFVBQVUsQ0FBQztBQUFBLE1BQzFFLElBQUksZUFBZTtBQUFBLE1BQ25CLFVBQVU7QUFBQSxNQUNWLE9BQU87QUFBQSxJQUNSLENBQUMsQ0FBQyxHQUFHLGFBQWEsU0FBUyxjQUFjLElBQUk7QUFFN0MsVUFBTSxhQUFhLHNCQUFzQixzQkFBc0IsU0FBUztBQUV4RSxtQkFBZSxNQUFNLHVCQUF1QixZQUFZLEdBQUcsS0FBSyxVQUFVLENBQUM7QUFBQSxNQUMxRSxJQUFJLGVBQWU7QUFBQSxNQUNuQixVQUFVO0FBQUEsTUFDVixPQUFPO0FBQUEsSUFDUixDQUFDLENBQUMsR0FBRyxhQUFhLFNBQVMsY0FBYyxJQUFJO0FBRTdDLGtCQUFjLGNBQWMsQ0FBQyxjQUFjLEdBQUcsU0FBUztBQUV2RCxXQUFPLFlBQVksV0FBVyxVQUFVLGVBQWUsRUFBRSxHQUFHLEtBQUs7QUFDakUsV0FBTyxZQUFZLFdBQVcsc0JBQXNCLENBQUMsRUFBRSxJQUFJLGVBQWUsRUFBRTtBQUM1RSxXQUFPLFlBQVksV0FBVyx1QkFBdUIsUUFBUSxDQUFDO0FBQUEsRUFDL0QsQ0FBQyxDQUFDO0FBRUgsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
