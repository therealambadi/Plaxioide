import assert from "assert";
import { URI } from "../../../../base/common/uri.js";
import { mock } from "../../../../base/test/common/mock.js";
import { TabInputKind, TabModelOperationKind } from "../../common/extHost.protocol.js";
import { ExtHostEditorTabs } from "../../common/extHostEditorTabs.js";
import { SingleProxyRPCProtocol } from "../common/testRPCProtocol.js";
import { TextMergeTabInput, TextTabInput } from "../../common/extHostTypes.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
suite("ExtHostEditorTabs", function() {
  const defaultTabDto = {
    id: "uniquestring",
    input: { kind: TabInputKind.TextInput, uri: URI.parse("file://abc/def.txt") },
    isActive: true,
    isDirty: true,
    isPinned: true,
    isPreview: false,
    label: "label1"
  };
  function createTabDto(dto) {
    return { ...defaultTabDto, ...dto };
  }
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  test("Ensure empty model throws when accessing active group", function() {
    const extHostEditorTabs = new ExtHostEditorTabs(
      SingleProxyRPCProtocol(new class extends mock() {
        // override/implement $moveTab or $closeTab
      }())
    );
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 0);
    assert.throws(() => extHostEditorTabs.tabGroups.activeTabGroup);
  });
  test("single tab", function() {
    const extHostEditorTabs = new ExtHostEditorTabs(
      SingleProxyRPCProtocol(new class extends mock() {
        // override/implement $moveTab or $closeTab
      }())
    );
    const tab = createTabDto({
      id: "uniquestring",
      isActive: true,
      isDirty: true,
      isPinned: true,
      label: "label1"
    });
    extHostEditorTabs.$acceptEditorTabModel([{
      isActive: true,
      viewColumn: 0,
      groupId: 12,
      tabs: [tab]
    }]);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    const [first] = extHostEditorTabs.tabGroups.all;
    assert.ok(first.activeTab);
    assert.strictEqual(first.tabs.indexOf(first.activeTab), 0);
    {
      extHostEditorTabs.$acceptEditorTabModel([{
        isActive: true,
        viewColumn: 0,
        groupId: 12,
        tabs: [tab]
      }]);
      assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
      const [first2] = extHostEditorTabs.tabGroups.all;
      assert.ok(first2.activeTab);
      assert.strictEqual(first2.tabs.indexOf(first2.activeTab), 0);
    }
  });
  test("Empty tab group", function() {
    const extHostEditorTabs = new ExtHostEditorTabs(
      SingleProxyRPCProtocol(new class extends mock() {
        // override/implement $moveTab or $closeTab
      }())
    );
    extHostEditorTabs.$acceptEditorTabModel([{
      isActive: true,
      viewColumn: 0,
      groupId: 12,
      tabs: []
    }]);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    const [first] = extHostEditorTabs.tabGroups.all;
    assert.strictEqual(first.activeTab, void 0);
    assert.strictEqual(first.tabs.length, 0);
  });
  test("Ensure tabGroup change events fires", function() {
    const extHostEditorTabs = new ExtHostEditorTabs(
      SingleProxyRPCProtocol(new class extends mock() {
        // override/implement $moveTab or $closeTab
      }())
    );
    let count = 0;
    store.add(extHostEditorTabs.tabGroups.onDidChangeTabGroups(() => count++));
    assert.strictEqual(count, 0);
    extHostEditorTabs.$acceptEditorTabModel([{
      isActive: true,
      viewColumn: 0,
      groupId: 12,
      tabs: []
    }]);
    assert.ok(extHostEditorTabs.tabGroups.activeTabGroup);
    const activeTabGroup = extHostEditorTabs.tabGroups.activeTabGroup;
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    assert.strictEqual(activeTabGroup.tabs.length, 0);
    assert.strictEqual(count, 1);
  });
  test("Check TabGroupChangeEvent properties", function() {
    const extHostEditorTabs = new ExtHostEditorTabs(
      SingleProxyRPCProtocol(new class extends mock() {
        // override/implement $moveTab or $closeTab
      }())
    );
    const group1Data = {
      isActive: true,
      viewColumn: 0,
      groupId: 12,
      tabs: []
    };
    const group2Data = { ...group1Data, groupId: 13 };
    const events = [];
    store.add(extHostEditorTabs.tabGroups.onDidChangeTabGroups((e) => events.push(e)));
    extHostEditorTabs.$acceptEditorTabModel([group1Data]);
    assert.deepStrictEqual(events, [{
      changed: [],
      closed: [],
      opened: [extHostEditorTabs.tabGroups.activeTabGroup]
    }]);
    events.length = 0;
    extHostEditorTabs.$acceptEditorTabModel([{ ...group1Data, isActive: false }, group2Data]);
    assert.deepStrictEqual(events, [{
      changed: [extHostEditorTabs.tabGroups.all[0]],
      closed: [],
      opened: [extHostEditorTabs.tabGroups.all[1]]
    }]);
    events.length = 0;
    extHostEditorTabs.$acceptEditorTabModel([group1Data, { ...group2Data, isActive: false }]);
    assert.deepStrictEqual(events, [{
      changed: extHostEditorTabs.tabGroups.all,
      closed: [],
      opened: []
    }]);
    events.length = 0;
    const oldActiveGroup = extHostEditorTabs.tabGroups.activeTabGroup;
    extHostEditorTabs.$acceptEditorTabModel([group2Data]);
    assert.deepStrictEqual(events, [{
      changed: extHostEditorTabs.tabGroups.all,
      closed: [oldActiveGroup],
      opened: []
    }]);
  });
  test("Ensure reference equality for activeTab and activeGroup", function() {
    const extHostEditorTabs = new ExtHostEditorTabs(
      SingleProxyRPCProtocol(new class extends mock() {
        // override/implement $moveTab or $closeTab
      }())
    );
    const tab = createTabDto({
      id: "uniquestring",
      isActive: true,
      isDirty: true,
      isPinned: true,
      label: "label1",
      editorId: "default"
    });
    extHostEditorTabs.$acceptEditorTabModel([{
      isActive: true,
      viewColumn: 0,
      groupId: 12,
      tabs: [tab]
    }]);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    const [first] = extHostEditorTabs.tabGroups.all;
    assert.ok(first.activeTab);
    assert.strictEqual(first.tabs.indexOf(first.activeTab), 0);
    assert.strictEqual(first.activeTab, first.tabs[0]);
    assert.strictEqual(extHostEditorTabs.tabGroups.activeTabGroup, first);
  });
  test("TextMergeTabInput surfaces in the UI", function() {
    const extHostEditorTabs = new ExtHostEditorTabs(
      SingleProxyRPCProtocol(new class extends mock() {
        // override/implement $moveTab or $closeTab
      }())
    );
    const tab = createTabDto({
      input: {
        kind: TabInputKind.TextMergeInput,
        base: URI.from({ scheme: "test", path: "base" }),
        input1: URI.from({ scheme: "test", path: "input1" }),
        input2: URI.from({ scheme: "test", path: "input2" }),
        result: URI.from({ scheme: "test", path: "result" })
      }
    });
    extHostEditorTabs.$acceptEditorTabModel([{
      isActive: true,
      viewColumn: 0,
      groupId: 12,
      tabs: [tab]
    }]);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    const [first] = extHostEditorTabs.tabGroups.all;
    assert.ok(first.activeTab);
    assert.strictEqual(first.tabs.indexOf(first.activeTab), 0);
    assert.ok(first.activeTab.input instanceof TextMergeTabInput);
  });
  test("Ensure reference stability", function() {
    const extHostEditorTabs = new ExtHostEditorTabs(
      SingleProxyRPCProtocol(new class extends mock() {
        // override/implement $moveTab or $closeTab
      }())
    );
    const tabDto = createTabDto();
    extHostEditorTabs.$acceptEditorTabModel([{
      isActive: true,
      viewColumn: 0,
      groupId: 12,
      tabs: [tabDto]
    }]);
    let all = extHostEditorTabs.tabGroups.all.map((group) => group.tabs).flat();
    assert.strictEqual(all.length, 1);
    const apiTab1 = all[0];
    assert.ok(apiTab1.input instanceof TextTabInput);
    assert.strictEqual(tabDto.input.kind, TabInputKind.TextInput);
    const dtoResource = tabDto.input.uri;
    assert.strictEqual(apiTab1.input.uri.toString(), URI.revive(dtoResource).toString());
    assert.strictEqual(apiTab1.isDirty, true);
    const tabDto2 = { ...tabDto, isDirty: false };
    extHostEditorTabs.$acceptTabOperation({
      kind: TabModelOperationKind.TAB_UPDATE,
      index: 0,
      tabDto: tabDto2,
      groupId: 12
    });
    all = extHostEditorTabs.tabGroups.all.map((group) => group.tabs).flat();
    assert.strictEqual(all.length, 1);
    const apiTab2 = all[0];
    assert.ok(apiTab1.input instanceof TextTabInput);
    assert.strictEqual(apiTab1.input.uri.toString(), URI.revive(dtoResource).toString());
    assert.strictEqual(apiTab2.isDirty, false);
    assert.strictEqual(apiTab1 === apiTab2, true);
  });
  test("Tab.isActive working", function() {
    const extHostEditorTabs = new ExtHostEditorTabs(
      SingleProxyRPCProtocol(new class extends mock() {
        // override/implement $moveTab or $closeTab
      }())
    );
    const tabDtoAAA = createTabDto({
      id: "AAA",
      isActive: true,
      isDirty: true,
      isPinned: true,
      label: "label1",
      input: { kind: TabInputKind.TextInput, uri: URI.parse("file://abc/AAA.txt") },
      editorId: "default"
    });
    const tabDtoBBB = createTabDto({
      id: "BBB",
      isActive: false,
      isDirty: true,
      isPinned: true,
      label: "label1",
      input: { kind: TabInputKind.TextInput, uri: URI.parse("file://abc/BBB.txt") },
      editorId: "default"
    });
    extHostEditorTabs.$acceptEditorTabModel([{
      isActive: true,
      viewColumn: 0,
      groupId: 12,
      tabs: [tabDtoAAA, tabDtoBBB]
    }]);
    const all = extHostEditorTabs.tabGroups.all.map((group) => group.tabs).flat();
    assert.strictEqual(all.length, 2);
    const activeTab1 = extHostEditorTabs.tabGroups.activeTabGroup?.activeTab;
    assert.ok(activeTab1?.input instanceof TextTabInput);
    assert.strictEqual(tabDtoAAA.input.kind, TabInputKind.TextInput);
    const dtoAAAResource = tabDtoAAA.input.uri;
    assert.strictEqual(activeTab1?.input?.uri.toString(), URI.revive(dtoAAAResource)?.toString());
    assert.strictEqual(activeTab1?.isActive, true);
    extHostEditorTabs.$acceptTabOperation({
      groupId: 12,
      index: 1,
      kind: TabModelOperationKind.TAB_UPDATE,
      tabDto: { ...tabDtoBBB, isActive: true }
      /// BBB is now active
    });
    const activeTab2 = extHostEditorTabs.tabGroups.activeTabGroup?.activeTab;
    assert.ok(activeTab2?.input instanceof TextTabInput);
    assert.strictEqual(tabDtoBBB.input.kind, TabInputKind.TextInput);
    const dtoBBBResource = tabDtoBBB.input.uri;
    assert.strictEqual(activeTab2?.input?.uri.toString(), URI.revive(dtoBBBResource)?.toString());
    assert.strictEqual(activeTab2?.isActive, true);
    assert.strictEqual(activeTab1?.isActive, false);
  });
  test("vscode.window.tagGroups is immutable", function() {
    const extHostEditorTabs = new ExtHostEditorTabs(
      SingleProxyRPCProtocol(new class extends mock() {
        // override/implement $moveTab or $closeTab
      }())
    );
    assert.throws(() => {
      extHostEditorTabs.tabGroups.activeTabGroup = void 0;
    });
    assert.throws(() => {
      extHostEditorTabs.tabGroups.all.length = 0;
    });
    assert.throws(() => {
      extHostEditorTabs.tabGroups.onDidChangeActiveTabGroup = void 0;
    });
    assert.throws(() => {
      extHostEditorTabs.tabGroups.onDidChangeTabGroups = void 0;
    });
  });
  test("Ensure close is called with all tab ids", function() {
    const closedTabIds = [];
    const extHostEditorTabs = new ExtHostEditorTabs(
      SingleProxyRPCProtocol(new class extends mock() {
        // override/implement $moveTab or $closeTab
        async $closeTab(tabIds, preserveFocus) {
          closedTabIds.push(tabIds);
          return true;
        }
      }())
    );
    const tab = createTabDto({
      id: "uniquestring",
      isActive: true,
      isDirty: true,
      isPinned: true,
      label: "label1",
      editorId: "default"
    });
    extHostEditorTabs.$acceptEditorTabModel([{
      isActive: true,
      viewColumn: 0,
      groupId: 12,
      tabs: [tab]
    }]);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    const activeTab = extHostEditorTabs.tabGroups.activeTabGroup?.activeTab;
    assert.ok(activeTab);
    extHostEditorTabs.tabGroups.close(activeTab, false);
    assert.strictEqual(closedTabIds.length, 1);
    assert.deepStrictEqual(closedTabIds[0], ["uniquestring"]);
    extHostEditorTabs.tabGroups.close([activeTab], false);
    assert.strictEqual(closedTabIds.length, 2);
    assert.deepStrictEqual(closedTabIds[1], ["uniquestring"]);
  });
  test("Update tab only sends tab change event", async function() {
    const closedTabIds = [];
    const extHostEditorTabs = new ExtHostEditorTabs(
      SingleProxyRPCProtocol(new class extends mock() {
        // override/implement $moveTab or $closeTab
        async $closeTab(tabIds, preserveFocus) {
          closedTabIds.push(tabIds);
          return true;
        }
      }())
    );
    const tabDto = createTabDto({
      id: "uniquestring",
      isActive: true,
      isDirty: true,
      isPinned: true,
      label: "label1",
      editorId: "default"
    });
    extHostEditorTabs.$acceptEditorTabModel([{
      isActive: true,
      viewColumn: 0,
      groupId: 12,
      tabs: [tabDto]
    }]);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.map((g) => g.tabs).flat().length, 1);
    const tab = extHostEditorTabs.tabGroups.all[0].tabs[0];
    const p = new Promise((resolve) => store.add(extHostEditorTabs.tabGroups.onDidChangeTabs(resolve)));
    extHostEditorTabs.$acceptTabOperation({
      groupId: 12,
      index: 0,
      kind: TabModelOperationKind.TAB_UPDATE,
      tabDto: { ...tabDto, label: "NEW LABEL" }
    });
    const changedTab = (await p).changed[0];
    assert.ok(tab === changedTab);
    assert.strictEqual(changedTab.label, "NEW LABEL");
  });
  test("Active tab", function() {
    const extHostEditorTabs = new ExtHostEditorTabs(
      SingleProxyRPCProtocol(new class extends mock() {
        // override/implement $moveTab or $closeTab
      }())
    );
    const tab1 = createTabDto({
      id: "uniquestring",
      isActive: true,
      isDirty: true,
      isPinned: true,
      label: "label1"
    });
    const tab2 = createTabDto({
      isActive: false,
      id: "uniquestring2"
    });
    const tab3 = createTabDto({
      isActive: false,
      id: "uniquestring3"
    });
    extHostEditorTabs.$acceptEditorTabModel([{
      isActive: true,
      viewColumn: 0,
      groupId: 12,
      tabs: [tab1, tab2, tab3]
    }]);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.map((g) => g.tabs).flat().length, 3);
    assert.strictEqual(extHostEditorTabs.tabGroups.activeTabGroup?.activeTab, extHostEditorTabs.tabGroups.activeTabGroup?.tabs[0]);
    tab1.isActive = false;
    tab2.isActive = true;
    extHostEditorTabs.$acceptTabOperation({
      groupId: 12,
      index: 0,
      kind: TabModelOperationKind.TAB_UPDATE,
      tabDto: tab1
    });
    extHostEditorTabs.$acceptTabOperation({
      groupId: 12,
      index: 1,
      kind: TabModelOperationKind.TAB_UPDATE,
      tabDto: tab2
    });
    assert.strictEqual(extHostEditorTabs.tabGroups.activeTabGroup?.activeTab, extHostEditorTabs.tabGroups.activeTabGroup?.tabs[1]);
    tab3.isActive = true;
    extHostEditorTabs.$acceptEditorTabModel([{
      isActive: true,
      viewColumn: 0,
      groupId: 12,
      tabs: [tab3]
    }]);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.map((g) => g.tabs).flat().length, 1);
    assert.strictEqual(extHostEditorTabs.tabGroups.activeTabGroup?.activeTab, extHostEditorTabs.tabGroups.activeTabGroup?.tabs[0]);
    extHostEditorTabs.$acceptEditorTabModel([{
      isActive: true,
      viewColumn: 0,
      groupId: 12,
      tabs: []
    }]);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.map((g) => g.tabs).flat().length, 0);
    assert.strictEqual(extHostEditorTabs.tabGroups.activeTabGroup?.activeTab, void 0);
  });
  test("Tab operations patches open and close correctly", function() {
    const extHostEditorTabs = new ExtHostEditorTabs(
      SingleProxyRPCProtocol(new class extends mock() {
        // override/implement $moveTab or $closeTab
      }())
    );
    const tab1 = createTabDto({
      id: "uniquestring",
      isActive: true,
      label: "label1"
    });
    const tab2 = createTabDto({
      isActive: false,
      id: "uniquestring2",
      label: "label2"
    });
    const tab3 = createTabDto({
      isActive: false,
      id: "uniquestring3",
      label: "label3"
    });
    extHostEditorTabs.$acceptEditorTabModel([{
      isActive: true,
      viewColumn: 0,
      groupId: 12,
      tabs: [tab1, tab2, tab3]
    }]);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.map((g) => g.tabs).flat().length, 3);
    extHostEditorTabs.$acceptTabOperation({
      groupId: 12,
      index: 1,
      kind: TabModelOperationKind.TAB_CLOSE,
      tabDto: tab2
    });
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.map((g) => g.tabs).flat().length, 2);
    extHostEditorTabs.$acceptTabOperation({
      groupId: 12,
      index: 0,
      kind: TabModelOperationKind.TAB_CLOSE,
      tabDto: tab1
    });
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.map((g) => g.tabs).flat().length, 1);
    tab3.isActive = true;
    extHostEditorTabs.$acceptTabOperation({
      groupId: 12,
      index: 0,
      kind: TabModelOperationKind.TAB_UPDATE,
      tabDto: tab3
    });
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.map((g) => g.tabs).flat().length, 1);
    assert.strictEqual(extHostEditorTabs.tabGroups.all[0]?.activeTab?.label, "label3");
    extHostEditorTabs.$acceptTabOperation({
      groupId: 12,
      index: 1,
      kind: TabModelOperationKind.TAB_OPEN,
      tabDto: tab2
    });
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.map((g) => g.tabs).flat().length, 2);
    assert.strictEqual(extHostEditorTabs.tabGroups.all[0]?.tabs[1]?.label, "label2");
  });
  test("Tab operations patches move correctly", function() {
    const extHostEditorTabs = new ExtHostEditorTabs(
      SingleProxyRPCProtocol(new class extends mock() {
        // override/implement $moveTab or $closeTab
      }())
    );
    const tab1 = createTabDto({
      id: "uniquestring",
      isActive: true,
      label: "label1"
    });
    const tab2 = createTabDto({
      isActive: false,
      id: "uniquestring2",
      label: "label2"
    });
    const tab3 = createTabDto({
      isActive: false,
      id: "uniquestring3",
      label: "label3"
    });
    extHostEditorTabs.$acceptEditorTabModel([{
      isActive: true,
      viewColumn: 0,
      groupId: 12,
      tabs: [tab1, tab2, tab3]
    }]);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.map((g) => g.tabs).flat().length, 3);
    extHostEditorTabs.$acceptTabOperation({
      groupId: 12,
      index: 0,
      oldIndex: 1,
      kind: TabModelOperationKind.TAB_MOVE,
      tabDto: tab2
    });
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.map((g) => g.tabs).flat().length, 3);
    assert.strictEqual(extHostEditorTabs.tabGroups.all[0]?.tabs[0]?.label, "label2");
    extHostEditorTabs.$acceptTabOperation({
      groupId: 12,
      index: 1,
      oldIndex: 2,
      kind: TabModelOperationKind.TAB_MOVE,
      tabDto: tab3
    });
    assert.strictEqual(extHostEditorTabs.tabGroups.all.length, 1);
    assert.strictEqual(extHostEditorTabs.tabGroups.all.map((g) => g.tabs).flat().length, 3);
    assert.strictEqual(extHostEditorTabs.tabGroups.all[0]?.tabs[1]?.label, "label3");
    assert.strictEqual(extHostEditorTabs.tabGroups.all[0]?.tabs[0]?.label, "label2");
    assert.strictEqual(extHostEditorTabs.tabGroups.all[0]?.tabs[2]?.label, "label1");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0RWRpdG9yVGFicy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHR5cGUgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IElFZGl0b3JUYWJEdG8sIElFZGl0b3JUYWJHcm91cER0bywgTWFpblRocmVhZEVkaXRvclRhYnNTaGFwZSwgVGFiSW5wdXRLaW5kLCBUYWJNb2RlbE9wZXJhdGlvbktpbmQsIFRleHRJbnB1dER0byB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IEV4dEhvc3RFZGl0b3JUYWJzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RFZGl0b3JUYWJzLmpzJztcbmltcG9ydCB7IFNpbmdsZVByb3h5UlBDUHJvdG9jb2wgfSBmcm9tICcuLi9jb21tb24vdGVzdFJQQ1Byb3RvY29sLmpzJztcbmltcG9ydCB7IFRleHRNZXJnZVRhYklucHV0LCBUZXh0VGFiSW5wdXQgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdFR5cGVzLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5zdWl0ZSgnRXh0SG9zdEVkaXRvclRhYnMnLCBmdW5jdGlvbiAoKSB7XG5cblx0Y29uc3QgZGVmYXVsdFRhYkR0bzogSUVkaXRvclRhYkR0byA9IHtcblx0XHRpZDogJ3VuaXF1ZXN0cmluZycsXG5cdFx0aW5wdXQ6IHsga2luZDogVGFiSW5wdXRLaW5kLlRleHRJbnB1dCwgdXJpOiBVUkkucGFyc2UoJ2ZpbGU6Ly9hYmMvZGVmLnR4dCcpIH0sXG5cdFx0aXNBY3RpdmU6IHRydWUsXG5cdFx0aXNEaXJ0eTogdHJ1ZSxcblx0XHRpc1Bpbm5lZDogdHJ1ZSxcblx0XHRpc1ByZXZpZXc6IGZhbHNlLFxuXHRcdGxhYmVsOiAnbGFiZWwxJyxcblx0fTtcblxuXHRmdW5jdGlvbiBjcmVhdGVUYWJEdG8oZHRvPzogUGFydGlhbDxJRWRpdG9yVGFiRHRvPik6IElFZGl0b3JUYWJEdG8ge1xuXHRcdHJldHVybiB7IC4uLmRlZmF1bHRUYWJEdG8sIC4uLmR0byB9O1xuXHR9XG5cblx0Y29uc3Qgc3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdFbnN1cmUgZW1wdHkgbW9kZWwgdGhyb3dzIHdoZW4gYWNjZXNzaW5nIGFjdGl2ZSBncm91cCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBleHRIb3N0RWRpdG9yVGFicyA9IG5ldyBFeHRIb3N0RWRpdG9yVGFicyhcblx0XHRcdFNpbmdsZVByb3h5UlBDUHJvdG9jb2wobmV3IGNsYXNzIGV4dGVuZHMgbW9jazxNYWluVGhyZWFkRWRpdG9yVGFic1NoYXBlPigpIHtcblx0XHRcdFx0Ly8gb3ZlcnJpZGUvaW1wbGVtZW50ICRtb3ZlVGFiIG9yICRjbG9zZVRhYlxuXHRcdFx0fSlcblx0XHQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hbGwubGVuZ3RoLCAwKTtcblx0XHQvLyBBY3RpdmUgZ3JvdXAgc2hvdWxkIG5ldmVyIGJlIHVuZGVmaW5lZCAodGhlcmUgaXMgYWx3YXlzIGFuIGFjdGl2ZSBncm91cCkuIEVuc3VyZSBhY2Nlc3NpbmcgaXQgdW5kZWZpbmVkIHRocm93cy5cblx0XHQvLyBUT0RPIEBscmFtb3MxNSBBZGQgYSB0aHJvdyBvbiB0aGUgbWFpbiBzaWRlIHdoZW4gYSBtb2RlbCBpcyBzZW50IHdpdGhvdXQgYW4gYWN0aXZlIGdyb3VwXG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWN0aXZlVGFiR3JvdXApO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW5nbGUgdGFiJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgZXh0SG9zdEVkaXRvclRhYnMgPSBuZXcgRXh0SG9zdEVkaXRvclRhYnMoXG5cdFx0XHRTaW5nbGVQcm94eVJQQ1Byb3RvY29sKG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8TWFpblRocmVhZEVkaXRvclRhYnNTaGFwZT4oKSB7XG5cdFx0XHRcdC8vIG92ZXJyaWRlL2ltcGxlbWVudCAkbW92ZVRhYiBvciAkY2xvc2VUYWJcblx0XHRcdH0pXG5cdFx0KTtcblxuXHRcdGNvbnN0IHRhYjogSUVkaXRvclRhYkR0byA9IGNyZWF0ZVRhYkR0byh7XG5cdFx0XHRpZDogJ3VuaXF1ZXN0cmluZycsXG5cdFx0XHRpc0FjdGl2ZTogdHJ1ZSxcblx0XHRcdGlzRGlydHk6IHRydWUsXG5cdFx0XHRpc1Bpbm5lZDogdHJ1ZSxcblx0XHRcdGxhYmVsOiAnbGFiZWwxJyxcblx0XHR9KTtcblxuXHRcdGV4dEhvc3RFZGl0b3JUYWJzLiRhY2NlcHRFZGl0b3JUYWJNb2RlbChbe1xuXHRcdFx0aXNBY3RpdmU6IHRydWUsXG5cdFx0XHR2aWV3Q29sdW1uOiAwLFxuXHRcdFx0Z3JvdXBJZDogMTIsXG5cdFx0XHR0YWJzOiBbdGFiXVxuXHRcdH1dKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbC5sZW5ndGgsIDEpO1xuXHRcdGNvbnN0IFtmaXJzdF0gPSBleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsO1xuXHRcdGFzc2VydC5vayhmaXJzdC5hY3RpdmVUYWIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC50YWJzLmluZGV4T2YoZmlyc3QuYWN0aXZlVGFiKSwgMCk7XG5cblx0XHR7XG5cdFx0XHRleHRIb3N0RWRpdG9yVGFicy4kYWNjZXB0RWRpdG9yVGFiTW9kZWwoW3tcblx0XHRcdFx0aXNBY3RpdmU6IHRydWUsXG5cdFx0XHRcdHZpZXdDb2x1bW46IDAsXG5cdFx0XHRcdGdyb3VwSWQ6IDEyLFxuXHRcdFx0XHR0YWJzOiBbdGFiXVxuXHRcdFx0fV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hbGwubGVuZ3RoLCAxKTtcblx0XHRcdGNvbnN0IFtmaXJzdF0gPSBleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsO1xuXHRcdFx0YXNzZXJ0Lm9rKGZpcnN0LmFjdGl2ZVRhYik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QudGFicy5pbmRleE9mKGZpcnN0LmFjdGl2ZVRhYiksIDApO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnRW1wdHkgdGFiIGdyb3VwJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGV4dEhvc3RFZGl0b3JUYWJzID0gbmV3IEV4dEhvc3RFZGl0b3JUYWJzKFxuXHRcdFx0U2luZ2xlUHJveHlSUENQcm90b2NvbChuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPE1haW5UaHJlYWRFZGl0b3JUYWJzU2hhcGU+KCkge1xuXHRcdFx0XHQvLyBvdmVycmlkZS9pbXBsZW1lbnQgJG1vdmVUYWIgb3IgJGNsb3NlVGFiXG5cdFx0XHR9KVxuXHRcdCk7XG5cblx0XHRleHRIb3N0RWRpdG9yVGFicy4kYWNjZXB0RWRpdG9yVGFiTW9kZWwoW3tcblx0XHRcdGlzQWN0aXZlOiB0cnVlLFxuXHRcdFx0dmlld0NvbHVtbjogMCxcblx0XHRcdGdyb3VwSWQ6IDEyLFxuXHRcdFx0dGFiczogW11cblx0XHR9XSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hbGwubGVuZ3RoLCAxKTtcblx0XHRjb25zdCBbZmlyc3RdID0gZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QuYWN0aXZlVGFiLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC50YWJzLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0Vuc3VyZSB0YWJHcm91cCBjaGFuZ2UgZXZlbnRzIGZpcmVzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGV4dEhvc3RFZGl0b3JUYWJzID0gbmV3IEV4dEhvc3RFZGl0b3JUYWJzKFxuXHRcdFx0U2luZ2xlUHJveHlSUENQcm90b2NvbChuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPE1haW5UaHJlYWRFZGl0b3JUYWJzU2hhcGU+KCkge1xuXHRcdFx0XHQvLyBvdmVycmlkZS9pbXBsZW1lbnQgJG1vdmVUYWIgb3IgJGNsb3NlVGFiXG5cdFx0XHR9KVxuXHRcdCk7XG5cblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdHN0b3JlLmFkZChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMub25EaWRDaGFuZ2VUYWJHcm91cHMoKCkgPT4gY291bnQrKykpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAwKTtcblxuXHRcdGV4dEhvc3RFZGl0b3JUYWJzLiRhY2NlcHRFZGl0b3JUYWJNb2RlbChbe1xuXHRcdFx0aXNBY3RpdmU6IHRydWUsXG5cdFx0XHR2aWV3Q29sdW1uOiAwLFxuXHRcdFx0Z3JvdXBJZDogMTIsXG5cdFx0XHR0YWJzOiBbXVxuXHRcdH1dKTtcblx0XHRhc3NlcnQub2soZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFjdGl2ZVRhYkdyb3VwKTtcblx0XHRjb25zdCBhY3RpdmVUYWJHcm91cDogdnNjb2RlLlRhYkdyb3VwID0gZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFjdGl2ZVRhYkdyb3VwO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGl2ZVRhYkdyb3VwLnRhYnMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdDaGVjayBUYWJHcm91cENoYW5nZUV2ZW50IHByb3BlcnRpZXMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZXh0SG9zdEVkaXRvclRhYnMgPSBuZXcgRXh0SG9zdEVkaXRvclRhYnMoXG5cdFx0XHRTaW5nbGVQcm94eVJQQ1Byb3RvY29sKG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8TWFpblRocmVhZEVkaXRvclRhYnNTaGFwZT4oKSB7XG5cdFx0XHRcdC8vIG92ZXJyaWRlL2ltcGxlbWVudCAkbW92ZVRhYiBvciAkY2xvc2VUYWJcblx0XHRcdH0pXG5cdFx0KTtcblxuXHRcdGNvbnN0IGdyb3VwMURhdGE6IElFZGl0b3JUYWJHcm91cER0byA9IHtcblx0XHRcdGlzQWN0aXZlOiB0cnVlLFxuXHRcdFx0dmlld0NvbHVtbjogMCxcblx0XHRcdGdyb3VwSWQ6IDEyLFxuXHRcdFx0dGFiczogW11cblx0XHR9O1xuXHRcdGNvbnN0IGdyb3VwMkRhdGE6IElFZGl0b3JUYWJHcm91cER0byA9IHsgLi4uZ3JvdXAxRGF0YSwgZ3JvdXBJZDogMTMgfTtcblxuXHRcdGNvbnN0IGV2ZW50czogdnNjb2RlLlRhYkdyb3VwQ2hhbmdlRXZlbnRbXSA9IFtdO1xuXHRcdHN0b3JlLmFkZChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMub25EaWRDaGFuZ2VUYWJHcm91cHMoZSA9PiBldmVudHMucHVzaChlKSkpO1xuXHRcdC8vIE9QRU5cblx0XHRleHRIb3N0RWRpdG9yVGFicy4kYWNjZXB0RWRpdG9yVGFiTW9kZWwoW2dyb3VwMURhdGFdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGV2ZW50cywgW3tcblx0XHRcdGNoYW5nZWQ6IFtdLFxuXHRcdFx0Y2xvc2VkOiBbXSxcblx0XHRcdG9wZW5lZDogW2V4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hY3RpdmVUYWJHcm91cF1cblx0XHR9XSk7XG5cblx0XHQvLyBPUEVOLCBDSEFOR0Vcblx0XHRldmVudHMubGVuZ3RoID0gMDtcblx0XHRleHRIb3N0RWRpdG9yVGFicy4kYWNjZXB0RWRpdG9yVGFiTW9kZWwoW3sgLi4uZ3JvdXAxRGF0YSwgaXNBY3RpdmU6IGZhbHNlIH0sIGdyb3VwMkRhdGFdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGV2ZW50cywgW3tcblx0XHRcdGNoYW5nZWQ6IFtleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsWzBdXSxcblx0XHRcdGNsb3NlZDogW10sXG5cdFx0XHRvcGVuZWQ6IFtleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsWzFdXVxuXHRcdH1dKTtcblxuXHRcdC8vIENIQU5HRVxuXHRcdGV2ZW50cy5sZW5ndGggPSAwO1xuXHRcdGV4dEhvc3RFZGl0b3JUYWJzLiRhY2NlcHRFZGl0b3JUYWJNb2RlbChbZ3JvdXAxRGF0YSwgeyAuLi5ncm91cDJEYXRhLCBpc0FjdGl2ZTogZmFsc2UgfV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZXZlbnRzLCBbe1xuXHRcdFx0Y2hhbmdlZDogZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbCxcblx0XHRcdGNsb3NlZDogW10sXG5cdFx0XHRvcGVuZWQ6IFtdXG5cdFx0fV0pO1xuXG5cdFx0Ly8gQ0xPU0UsIENIQU5HRVxuXHRcdGV2ZW50cy5sZW5ndGggPSAwO1xuXHRcdGNvbnN0IG9sZEFjdGl2ZUdyb3VwID0gZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFjdGl2ZVRhYkdyb3VwO1xuXHRcdGV4dEhvc3RFZGl0b3JUYWJzLiRhY2NlcHRFZGl0b3JUYWJNb2RlbChbZ3JvdXAyRGF0YV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZXZlbnRzLCBbe1xuXHRcdFx0Y2hhbmdlZDogZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbCxcblx0XHRcdGNsb3NlZDogW29sZEFjdGl2ZUdyb3VwXSxcblx0XHRcdG9wZW5lZDogW11cblx0XHR9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0Vuc3VyZSByZWZlcmVuY2UgZXF1YWxpdHkgZm9yIGFjdGl2ZVRhYiBhbmQgYWN0aXZlR3JvdXAnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZXh0SG9zdEVkaXRvclRhYnMgPSBuZXcgRXh0SG9zdEVkaXRvclRhYnMoXG5cdFx0XHRTaW5nbGVQcm94eVJQQ1Byb3RvY29sKG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8TWFpblRocmVhZEVkaXRvclRhYnNTaGFwZT4oKSB7XG5cdFx0XHRcdC8vIG92ZXJyaWRlL2ltcGxlbWVudCAkbW92ZVRhYiBvciAkY2xvc2VUYWJcblx0XHRcdH0pXG5cdFx0KTtcblx0XHRjb25zdCB0YWIgPSBjcmVhdGVUYWJEdG8oe1xuXHRcdFx0aWQ6ICd1bmlxdWVzdHJpbmcnLFxuXHRcdFx0aXNBY3RpdmU6IHRydWUsXG5cdFx0XHRpc0RpcnR5OiB0cnVlLFxuXHRcdFx0aXNQaW5uZWQ6IHRydWUsXG5cdFx0XHRsYWJlbDogJ2xhYmVsMScsXG5cdFx0XHRlZGl0b3JJZDogJ2RlZmF1bHQnLFxuXHRcdH0pO1xuXG5cdFx0ZXh0SG9zdEVkaXRvclRhYnMuJGFjY2VwdEVkaXRvclRhYk1vZGVsKFt7XG5cdFx0XHRpc0FjdGl2ZTogdHJ1ZSxcblx0XHRcdHZpZXdDb2x1bW46IDAsXG5cdFx0XHRncm91cElkOiAxMixcblx0XHRcdHRhYnM6IFt0YWJdXG5cdFx0fV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsLmxlbmd0aCwgMSk7XG5cdFx0Y29uc3QgW2ZpcnN0XSA9IGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hbGw7XG5cdFx0YXNzZXJ0Lm9rKGZpcnN0LmFjdGl2ZVRhYik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnRhYnMuaW5kZXhPZihmaXJzdC5hY3RpdmVUYWIpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QuYWN0aXZlVGFiLCBmaXJzdC50YWJzWzBdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFjdGl2ZVRhYkdyb3VwLCBmaXJzdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RleHRNZXJnZVRhYklucHV0IHN1cmZhY2VzIGluIHRoZSBVSScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGV4dEhvc3RFZGl0b3JUYWJzID0gbmV3IEV4dEhvc3RFZGl0b3JUYWJzKFxuXHRcdFx0U2luZ2xlUHJveHlSUENQcm90b2NvbChuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPE1haW5UaHJlYWRFZGl0b3JUYWJzU2hhcGU+KCkge1xuXHRcdFx0XHQvLyBvdmVycmlkZS9pbXBsZW1lbnQgJG1vdmVUYWIgb3IgJGNsb3NlVGFiXG5cdFx0XHR9KVxuXHRcdCk7XG5cblx0XHRjb25zdCB0YWI6IElFZGl0b3JUYWJEdG8gPSBjcmVhdGVUYWJEdG8oe1xuXHRcdFx0aW5wdXQ6IHtcblx0XHRcdFx0a2luZDogVGFiSW5wdXRLaW5kLlRleHRNZXJnZUlucHV0LFxuXHRcdFx0XHRiYXNlOiBVUkkuZnJvbSh7IHNjaGVtZTogJ3Rlc3QnLCBwYXRoOiAnYmFzZScgfSksXG5cdFx0XHRcdGlucHV0MTogVVJJLmZyb20oeyBzY2hlbWU6ICd0ZXN0JywgcGF0aDogJ2lucHV0MScgfSksXG5cdFx0XHRcdGlucHV0MjogVVJJLmZyb20oeyBzY2hlbWU6ICd0ZXN0JywgcGF0aDogJ2lucHV0MicgfSksXG5cdFx0XHRcdHJlc3VsdDogVVJJLmZyb20oeyBzY2hlbWU6ICd0ZXN0JywgcGF0aDogJ3Jlc3VsdCcgfSksXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRleHRIb3N0RWRpdG9yVGFicy4kYWNjZXB0RWRpdG9yVGFiTW9kZWwoW3tcblx0XHRcdGlzQWN0aXZlOiB0cnVlLFxuXHRcdFx0dmlld0NvbHVtbjogMCxcblx0XHRcdGdyb3VwSWQ6IDEyLFxuXHRcdFx0dGFiczogW3RhYl1cblx0XHR9XSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hbGwubGVuZ3RoLCAxKTtcblx0XHRjb25zdCBbZmlyc3RdID0gZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbDtcblx0XHRhc3NlcnQub2soZmlyc3QuYWN0aXZlVGFiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QudGFicy5pbmRleE9mKGZpcnN0LmFjdGl2ZVRhYiksIDApO1xuXHRcdGFzc2VydC5vayhmaXJzdC5hY3RpdmVUYWIuaW5wdXQgaW5zdGFuY2VvZiBUZXh0TWVyZ2VUYWJJbnB1dCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0Vuc3VyZSByZWZlcmVuY2Ugc3RhYmlsaXR5JywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgZXh0SG9zdEVkaXRvclRhYnMgPSBuZXcgRXh0SG9zdEVkaXRvclRhYnMoXG5cdFx0XHRTaW5nbGVQcm94eVJQQ1Byb3RvY29sKG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8TWFpblRocmVhZEVkaXRvclRhYnNTaGFwZT4oKSB7XG5cdFx0XHRcdC8vIG92ZXJyaWRlL2ltcGxlbWVudCAkbW92ZVRhYiBvciAkY2xvc2VUYWJcblx0XHRcdH0pXG5cdFx0KTtcblx0XHRjb25zdCB0YWJEdG8gPSBjcmVhdGVUYWJEdG8oKTtcblxuXHRcdC8vIHNpbmdsZSBkaXJ0eSB0YWJcblxuXHRcdGV4dEhvc3RFZGl0b3JUYWJzLiRhY2NlcHRFZGl0b3JUYWJNb2RlbChbe1xuXHRcdFx0aXNBY3RpdmU6IHRydWUsXG5cdFx0XHR2aWV3Q29sdW1uOiAwLFxuXHRcdFx0Z3JvdXBJZDogMTIsXG5cdFx0XHR0YWJzOiBbdGFiRHRvXVxuXHRcdH1dKTtcblx0XHRsZXQgYWxsID0gZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbC5tYXAoZ3JvdXAgPT4gZ3JvdXAudGFicykuZmxhdCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhbGwubGVuZ3RoLCAxKTtcblx0XHRjb25zdCBhcGlUYWIxID0gYWxsWzBdO1xuXHRcdGFzc2VydC5vayhhcGlUYWIxLmlucHV0IGluc3RhbmNlb2YgVGV4dFRhYklucHV0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFiRHRvLmlucHV0LmtpbmQsIFRhYklucHV0S2luZC5UZXh0SW5wdXQpO1xuXHRcdGNvbnN0IGR0b1Jlc291cmNlID0gKHRhYkR0by5pbnB1dCBhcyBUZXh0SW5wdXREdG8pLnVyaTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXBpVGFiMS5pbnB1dC51cmkudG9TdHJpbmcoKSwgVVJJLnJldml2ZShkdG9SZXNvdXJjZSkudG9TdHJpbmcoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwaVRhYjEuaXNEaXJ0eSwgdHJ1ZSk7XG5cblxuXHRcdC8vIE5PVCBESVJUWSBhbnltb3JlXG5cblx0XHRjb25zdCB0YWJEdG8yOiBJRWRpdG9yVGFiRHRvID0geyAuLi50YWJEdG8sIGlzRGlydHk6IGZhbHNlIH07XG5cdFx0Ly8gQWNjZXB0IGEgc2ltcGxlIHVwZGF0ZVxuXHRcdGV4dEhvc3RFZGl0b3JUYWJzLiRhY2NlcHRUYWJPcGVyYXRpb24oe1xuXHRcdFx0a2luZDogVGFiTW9kZWxPcGVyYXRpb25LaW5kLlRBQl9VUERBVEUsXG5cdFx0XHRpbmRleDogMCxcblx0XHRcdHRhYkR0bzogdGFiRHRvMixcblx0XHRcdGdyb3VwSWQ6IDEyXG5cdFx0fSk7XG5cblx0XHRhbGwgPSBleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsLm1hcChncm91cCA9PiBncm91cC50YWJzKS5mbGF0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFsbC5sZW5ndGgsIDEpO1xuXHRcdGNvbnN0IGFwaVRhYjIgPSBhbGxbMF07XG5cdFx0YXNzZXJ0Lm9rKGFwaVRhYjEuaW5wdXQgaW5zdGFuY2VvZiBUZXh0VGFiSW5wdXQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcGlUYWIxLmlucHV0LnVyaS50b1N0cmluZygpLCBVUkkucmV2aXZlKGR0b1Jlc291cmNlKS50b1N0cmluZygpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXBpVGFiMi5pc0RpcnR5LCBmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXBpVGFiMSA9PT0gYXBpVGFiMiwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RhYi5pc0FjdGl2ZSB3b3JraW5nJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgZXh0SG9zdEVkaXRvclRhYnMgPSBuZXcgRXh0SG9zdEVkaXRvclRhYnMoXG5cdFx0XHRTaW5nbGVQcm94eVJQQ1Byb3RvY29sKG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8TWFpblRocmVhZEVkaXRvclRhYnNTaGFwZT4oKSB7XG5cdFx0XHRcdC8vIG92ZXJyaWRlL2ltcGxlbWVudCAkbW92ZVRhYiBvciAkY2xvc2VUYWJcblx0XHRcdH0pXG5cdFx0KTtcblx0XHRjb25zdCB0YWJEdG9BQUEgPSBjcmVhdGVUYWJEdG8oe1xuXHRcdFx0aWQ6ICdBQUEnLFxuXHRcdFx0aXNBY3RpdmU6IHRydWUsXG5cdFx0XHRpc0RpcnR5OiB0cnVlLFxuXHRcdFx0aXNQaW5uZWQ6IHRydWUsXG5cdFx0XHRsYWJlbDogJ2xhYmVsMScsXG5cdFx0XHRpbnB1dDogeyBraW5kOiBUYWJJbnB1dEtpbmQuVGV4dElucHV0LCB1cmk6IFVSSS5wYXJzZSgnZmlsZTovL2FiYy9BQUEudHh0JykgfSxcblx0XHRcdGVkaXRvcklkOiAnZGVmYXVsdCdcblx0XHR9KTtcblxuXHRcdGNvbnN0IHRhYkR0b0JCQiA9IGNyZWF0ZVRhYkR0byh7XG5cdFx0XHRpZDogJ0JCQicsXG5cdFx0XHRpc0FjdGl2ZTogZmFsc2UsXG5cdFx0XHRpc0RpcnR5OiB0cnVlLFxuXHRcdFx0aXNQaW5uZWQ6IHRydWUsXG5cdFx0XHRsYWJlbDogJ2xhYmVsMScsXG5cdFx0XHRpbnB1dDogeyBraW5kOiBUYWJJbnB1dEtpbmQuVGV4dElucHV0LCB1cmk6IFVSSS5wYXJzZSgnZmlsZTovL2FiYy9CQkIudHh0JykgfSxcblx0XHRcdGVkaXRvcklkOiAnZGVmYXVsdCdcblx0XHR9KTtcblxuXHRcdC8vIHNpbmdsZSBkaXJ0eSB0YWJcblxuXHRcdGV4dEhvc3RFZGl0b3JUYWJzLiRhY2NlcHRFZGl0b3JUYWJNb2RlbChbe1xuXHRcdFx0aXNBY3RpdmU6IHRydWUsXG5cdFx0XHR2aWV3Q29sdW1uOiAwLFxuXHRcdFx0Z3JvdXBJZDogMTIsXG5cdFx0XHR0YWJzOiBbdGFiRHRvQUFBLCB0YWJEdG9CQkJdXG5cdFx0fV0pO1xuXG5cdFx0Y29uc3QgYWxsID0gZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbC5tYXAoZ3JvdXAgPT4gZ3JvdXAudGFicykuZmxhdCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhbGwubGVuZ3RoLCAyKTtcblxuXHRcdGNvbnN0IGFjdGl2ZVRhYjEgPSBleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWN0aXZlVGFiR3JvdXA/LmFjdGl2ZVRhYjtcblx0XHRhc3NlcnQub2soYWN0aXZlVGFiMT8uaW5wdXQgaW5zdGFuY2VvZiBUZXh0VGFiSW5wdXQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YWJEdG9BQUEuaW5wdXQua2luZCwgVGFiSW5wdXRLaW5kLlRleHRJbnB1dCk7XG5cdFx0Y29uc3QgZHRvQUFBUmVzb3VyY2UgPSAodGFiRHRvQUFBLmlucHV0IGFzIFRleHRJbnB1dER0bykudXJpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3RpdmVUYWIxPy5pbnB1dD8udXJpLnRvU3RyaW5nKCksIFVSSS5yZXZpdmUoZHRvQUFBUmVzb3VyY2UpPy50b1N0cmluZygpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aXZlVGFiMT8uaXNBY3RpdmUsIHRydWUpO1xuXG5cdFx0ZXh0SG9zdEVkaXRvclRhYnMuJGFjY2VwdFRhYk9wZXJhdGlvbih7XG5cdFx0XHRncm91cElkOiAxMixcblx0XHRcdGluZGV4OiAxLFxuXHRcdFx0a2luZDogVGFiTW9kZWxPcGVyYXRpb25LaW5kLlRBQl9VUERBVEUsXG5cdFx0XHR0YWJEdG86IHsgLi4udGFiRHRvQkJCLCBpc0FjdGl2ZTogdHJ1ZSB9IC8vLyBCQkIgaXMgbm93IGFjdGl2ZVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgYWN0aXZlVGFiMiA9IGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hY3RpdmVUYWJHcm91cD8uYWN0aXZlVGFiO1xuXHRcdGFzc2VydC5vayhhY3RpdmVUYWIyPy5pbnB1dCBpbnN0YW5jZW9mIFRleHRUYWJJbnB1dCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhYkR0b0JCQi5pbnB1dC5raW5kLCBUYWJJbnB1dEtpbmQuVGV4dElucHV0KTtcblx0XHRjb25zdCBkdG9CQkJSZXNvdXJjZSA9ICh0YWJEdG9CQkIuaW5wdXQgYXMgVGV4dElucHV0RHRvKS51cmk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGl2ZVRhYjI/LmlucHV0Py51cmkudG9TdHJpbmcoKSwgVVJJLnJldml2ZShkdG9CQkJSZXNvdXJjZSk/LnRvU3RyaW5nKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3RpdmVUYWIyPy5pc0FjdGl2ZSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGl2ZVRhYjE/LmlzQWN0aXZlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3ZzY29kZS53aW5kb3cudGFnR3JvdXBzIGlzIGltbXV0YWJsZScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGV4dEhvc3RFZGl0b3JUYWJzID0gbmV3IEV4dEhvc3RFZGl0b3JUYWJzKFxuXHRcdFx0U2luZ2xlUHJveHlSUENQcm90b2NvbChuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPE1haW5UaHJlYWRFZGl0b3JUYWJzU2hhcGU+KCkge1xuXHRcdFx0XHQvLyBvdmVycmlkZS9pbXBsZW1lbnQgJG1vdmVUYWIgb3IgJGNsb3NlVGFiXG5cdFx0XHR9KVxuXHRcdCk7XG5cblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdC8vIEB0cy1leHBlY3QtZXJyb3Igd3JpdGUgdG8gcmVhZG9ubHkgcHJvcFxuXHRcdFx0ZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFjdGl2ZVRhYkdyb3VwID0gdW5kZWZpbmVkO1xuXHRcdH0pO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0Ly8gQHRzLWV4cGVjdC1lcnJvciB3cml0ZSB0byByZWFkb25seSBwcm9wXG5cdFx0XHRleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsLmxlbmd0aCA9IDA7XG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHQvLyBAdHMtZXhwZWN0LWVycm9yIHdyaXRlIHRvIHJlYWRvbmx5IHByb3Bcblx0XHRcdGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5vbkRpZENoYW5nZUFjdGl2ZVRhYkdyb3VwID0gdW5kZWZpbmVkO1xuXHRcdH0pO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0Ly8gQHRzLWV4cGVjdC1lcnJvciB3cml0ZSB0byByZWFkb25seSBwcm9wXG5cdFx0XHRleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMub25EaWRDaGFuZ2VUYWJHcm91cHMgPSB1bmRlZmluZWQ7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0Vuc3VyZSBjbG9zZSBpcyBjYWxsZWQgd2l0aCBhbGwgdGFiIGlkcycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBjbG9zZWRUYWJJZHM6IHN0cmluZ1tdW10gPSBbXTtcblx0XHRjb25zdCBleHRIb3N0RWRpdG9yVGFicyA9IG5ldyBFeHRIb3N0RWRpdG9yVGFicyhcblx0XHRcdFNpbmdsZVByb3h5UlBDUHJvdG9jb2wobmV3IGNsYXNzIGV4dGVuZHMgbW9jazxNYWluVGhyZWFkRWRpdG9yVGFic1NoYXBlPigpIHtcblx0XHRcdFx0Ly8gb3ZlcnJpZGUvaW1wbGVtZW50ICRtb3ZlVGFiIG9yICRjbG9zZVRhYlxuXHRcdFx0XHRvdmVycmlkZSBhc3luYyAkY2xvc2VUYWIodGFiSWRzOiBzdHJpbmdbXSwgcHJlc2VydmVGb2N1cz86IGJvb2xlYW4pIHtcblx0XHRcdFx0XHRjbG9zZWRUYWJJZHMucHVzaCh0YWJJZHMpO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdCk7XG5cdFx0Y29uc3QgdGFiOiBJRWRpdG9yVGFiRHRvID0gY3JlYXRlVGFiRHRvKHtcblx0XHRcdGlkOiAndW5pcXVlc3RyaW5nJyxcblx0XHRcdGlzQWN0aXZlOiB0cnVlLFxuXHRcdFx0aXNEaXJ0eTogdHJ1ZSxcblx0XHRcdGlzUGlubmVkOiB0cnVlLFxuXHRcdFx0bGFiZWw6ICdsYWJlbDEnLFxuXHRcdFx0ZWRpdG9ySWQ6ICdkZWZhdWx0J1xuXHRcdH0pO1xuXG5cdFx0ZXh0SG9zdEVkaXRvclRhYnMuJGFjY2VwdEVkaXRvclRhYk1vZGVsKFt7XG5cdFx0XHRpc0FjdGl2ZTogdHJ1ZSxcblx0XHRcdHZpZXdDb2x1bW46IDAsXG5cdFx0XHRncm91cElkOiAxMixcblx0XHRcdHRhYnM6IFt0YWJdXG5cdFx0fV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsLmxlbmd0aCwgMSk7XG5cdFx0Y29uc3QgYWN0aXZlVGFiID0gZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFjdGl2ZVRhYkdyb3VwPy5hY3RpdmVUYWI7XG5cdFx0YXNzZXJ0Lm9rKGFjdGl2ZVRhYik7XG5cdFx0ZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmNsb3NlKGFjdGl2ZVRhYiwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjbG9zZWRUYWJJZHMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNsb3NlZFRhYklkc1swXSwgWyd1bmlxdWVzdHJpbmcnXSk7XG5cdFx0Ly8gQ2xvc2Ugd2l0aCBhcnJheVxuXHRcdGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5jbG9zZShbYWN0aXZlVGFiXSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjbG9zZWRUYWJJZHMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNsb3NlZFRhYklkc1sxXSwgWyd1bmlxdWVzdHJpbmcnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1VwZGF0ZSB0YWIgb25seSBzZW5kcyB0YWIgY2hhbmdlIGV2ZW50JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGNsb3NlZFRhYklkczogc3RyaW5nW11bXSA9IFtdO1xuXHRcdGNvbnN0IGV4dEhvc3RFZGl0b3JUYWJzID0gbmV3IEV4dEhvc3RFZGl0b3JUYWJzKFxuXHRcdFx0U2luZ2xlUHJveHlSUENQcm90b2NvbChuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPE1haW5UaHJlYWRFZGl0b3JUYWJzU2hhcGU+KCkge1xuXHRcdFx0XHQvLyBvdmVycmlkZS9pbXBsZW1lbnQgJG1vdmVUYWIgb3IgJGNsb3NlVGFiXG5cdFx0XHRcdG92ZXJyaWRlIGFzeW5jICRjbG9zZVRhYih0YWJJZHM6IHN0cmluZ1tdLCBwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbikge1xuXHRcdFx0XHRcdGNsb3NlZFRhYklkcy5wdXNoKHRhYklkcyk7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0KTtcblx0XHRjb25zdCB0YWJEdG86IElFZGl0b3JUYWJEdG8gPSBjcmVhdGVUYWJEdG8oe1xuXHRcdFx0aWQ6ICd1bmlxdWVzdHJpbmcnLFxuXHRcdFx0aXNBY3RpdmU6IHRydWUsXG5cdFx0XHRpc0RpcnR5OiB0cnVlLFxuXHRcdFx0aXNQaW5uZWQ6IHRydWUsXG5cdFx0XHRsYWJlbDogJ2xhYmVsMScsXG5cdFx0XHRlZGl0b3JJZDogJ2RlZmF1bHQnXG5cdFx0fSk7XG5cblx0XHRleHRIb3N0RWRpdG9yVGFicy4kYWNjZXB0RWRpdG9yVGFiTW9kZWwoW3tcblx0XHRcdGlzQWN0aXZlOiB0cnVlLFxuXHRcdFx0dmlld0NvbHVtbjogMCxcblx0XHRcdGdyb3VwSWQ6IDEyLFxuXHRcdFx0dGFiczogW3RhYkR0b11cblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbC5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsLm1hcChnID0+IGcudGFicykuZmxhdCgpLmxlbmd0aCwgMSk7XG5cblx0XHRjb25zdCB0YWIgPSBleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsWzBdLnRhYnNbMF07XG5cblxuXHRcdGNvbnN0IHAgPSBuZXcgUHJvbWlzZTx2c2NvZGUuVGFiQ2hhbmdlRXZlbnQ+KHJlc29sdmUgPT4gc3RvcmUuYWRkKGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5vbkRpZENoYW5nZVRhYnMocmVzb2x2ZSkpKTtcblxuXHRcdGV4dEhvc3RFZGl0b3JUYWJzLiRhY2NlcHRUYWJPcGVyYXRpb24oe1xuXHRcdFx0Z3JvdXBJZDogMTIsXG5cdFx0XHRpbmRleDogMCxcblx0XHRcdGtpbmQ6IFRhYk1vZGVsT3BlcmF0aW9uS2luZC5UQUJfVVBEQVRFLFxuXHRcdFx0dGFiRHRvOiB7IC4uLnRhYkR0bywgbGFiZWw6ICdORVcgTEFCRUwnIH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGNoYW5nZWRUYWIgPSAoYXdhaXQgcCkuY2hhbmdlZFswXTtcblxuXHRcdGFzc2VydC5vayh0YWIgPT09IGNoYW5nZWRUYWIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGFuZ2VkVGFiLmxhYmVsLCAnTkVXIExBQkVMJyk7XG5cblx0fSk7XG5cblx0dGVzdCgnQWN0aXZlIHRhYicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGV4dEhvc3RFZGl0b3JUYWJzID0gbmV3IEV4dEhvc3RFZGl0b3JUYWJzKFxuXHRcdFx0U2luZ2xlUHJveHlSUENQcm90b2NvbChuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPE1haW5UaHJlYWRFZGl0b3JUYWJzU2hhcGU+KCkge1xuXHRcdFx0XHQvLyBvdmVycmlkZS9pbXBsZW1lbnQgJG1vdmVUYWIgb3IgJGNsb3NlVGFiXG5cdFx0XHR9KVxuXHRcdCk7XG5cblx0XHRjb25zdCB0YWIxOiBJRWRpdG9yVGFiRHRvID0gY3JlYXRlVGFiRHRvKHtcblx0XHRcdGlkOiAndW5pcXVlc3RyaW5nJyxcblx0XHRcdGlzQWN0aXZlOiB0cnVlLFxuXHRcdFx0aXNEaXJ0eTogdHJ1ZSxcblx0XHRcdGlzUGlubmVkOiB0cnVlLFxuXHRcdFx0bGFiZWw6ICdsYWJlbDEnLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdGFiMjogSUVkaXRvclRhYkR0byA9IGNyZWF0ZVRhYkR0byh7XG5cdFx0XHRpc0FjdGl2ZTogZmFsc2UsXG5cdFx0XHRpZDogJ3VuaXF1ZXN0cmluZzInLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdGFiMzogSUVkaXRvclRhYkR0byA9IGNyZWF0ZVRhYkR0byh7XG5cdFx0XHRpc0FjdGl2ZTogZmFsc2UsXG5cdFx0XHRpZDogJ3VuaXF1ZXN0cmluZzMnLFxuXHRcdH0pO1xuXG5cdFx0ZXh0SG9zdEVkaXRvclRhYnMuJGFjY2VwdEVkaXRvclRhYk1vZGVsKFt7XG5cdFx0XHRpc0FjdGl2ZTogdHJ1ZSxcblx0XHRcdHZpZXdDb2x1bW46IDAsXG5cdFx0XHRncm91cElkOiAxMixcblx0XHRcdHRhYnM6IFt0YWIxLCB0YWIyLCB0YWIzXVxuXHRcdH1dKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hbGwubWFwKGcgPT4gZy50YWJzKS5mbGF0KCkubGVuZ3RoLCAzKTtcblxuXHRcdC8vIEFjdGl2ZSB0YWIgaXMgY29ycmVjdFxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWN0aXZlVGFiR3JvdXA/LmFjdGl2ZVRhYiwgZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFjdGl2ZVRhYkdyb3VwPy50YWJzWzBdKTtcblxuXHRcdC8vIFN3aXRjaGluZyBhY3RpdmUgdGFiIHdvcmtzXG5cdFx0dGFiMS5pc0FjdGl2ZSA9IGZhbHNlO1xuXHRcdHRhYjIuaXNBY3RpdmUgPSB0cnVlO1xuXHRcdGV4dEhvc3RFZGl0b3JUYWJzLiRhY2NlcHRUYWJPcGVyYXRpb24oe1xuXHRcdFx0Z3JvdXBJZDogMTIsXG5cdFx0XHRpbmRleDogMCxcblx0XHRcdGtpbmQ6IFRhYk1vZGVsT3BlcmF0aW9uS2luZC5UQUJfVVBEQVRFLFxuXHRcdFx0dGFiRHRvOiB0YWIxXG5cdFx0fSk7XG5cdFx0ZXh0SG9zdEVkaXRvclRhYnMuJGFjY2VwdFRhYk9wZXJhdGlvbih7XG5cdFx0XHRncm91cElkOiAxMixcblx0XHRcdGluZGV4OiAxLFxuXHRcdFx0a2luZDogVGFiTW9kZWxPcGVyYXRpb25LaW5kLlRBQl9VUERBVEUsXG5cdFx0XHR0YWJEdG86IHRhYjJcblx0XHR9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFjdGl2ZVRhYkdyb3VwPy5hY3RpdmVUYWIsIGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hY3RpdmVUYWJHcm91cD8udGFic1sxXSk7XG5cblx0XHQvL0Nsb3NpbmcgdGFicyBvdXQgd29ya3Ncblx0XHR0YWIzLmlzQWN0aXZlID0gdHJ1ZTtcblx0XHRleHRIb3N0RWRpdG9yVGFicy4kYWNjZXB0RWRpdG9yVGFiTW9kZWwoW3tcblx0XHRcdGlzQWN0aXZlOiB0cnVlLFxuXHRcdFx0dmlld0NvbHVtbjogMCxcblx0XHRcdGdyb3VwSWQ6IDEyLFxuXHRcdFx0dGFiczogW3RhYjNdXG5cdFx0fV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hbGwubWFwKGcgPT4gZy50YWJzKS5mbGF0KCkubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFjdGl2ZVRhYkdyb3VwPy5hY3RpdmVUYWIsIGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hY3RpdmVUYWJHcm91cD8udGFic1swXSk7XG5cblx0XHQvLyBDbG9zaW5nIG91dCBhbGwgdGFicyByZXR1cm5zIHVuZGVmaW5lIGFjdGl2ZSB0YWJcblx0XHRleHRIb3N0RWRpdG9yVGFicy4kYWNjZXB0RWRpdG9yVGFiTW9kZWwoW3tcblx0XHRcdGlzQWN0aXZlOiB0cnVlLFxuXHRcdFx0dmlld0NvbHVtbjogMCxcblx0XHRcdGdyb3VwSWQ6IDEyLFxuXHRcdFx0dGFiczogW11cblx0XHR9XSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hbGwubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbC5tYXAoZyA9PiBnLnRhYnMpLmZsYXQoKS5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWN0aXZlVGFiR3JvdXA/LmFjdGl2ZVRhYiwgdW5kZWZpbmVkKTtcblx0fSk7XG5cblx0dGVzdCgnVGFiIG9wZXJhdGlvbnMgcGF0Y2hlcyBvcGVuIGFuZCBjbG9zZSBjb3JyZWN0bHknLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZXh0SG9zdEVkaXRvclRhYnMgPSBuZXcgRXh0SG9zdEVkaXRvclRhYnMoXG5cdFx0XHRTaW5nbGVQcm94eVJQQ1Byb3RvY29sKG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8TWFpblRocmVhZEVkaXRvclRhYnNTaGFwZT4oKSB7XG5cdFx0XHRcdC8vIG92ZXJyaWRlL2ltcGxlbWVudCAkbW92ZVRhYiBvciAkY2xvc2VUYWJcblx0XHRcdH0pXG5cdFx0KTtcblxuXHRcdGNvbnN0IHRhYjE6IElFZGl0b3JUYWJEdG8gPSBjcmVhdGVUYWJEdG8oe1xuXHRcdFx0aWQ6ICd1bmlxdWVzdHJpbmcnLFxuXHRcdFx0aXNBY3RpdmU6IHRydWUsXG5cdFx0XHRsYWJlbDogJ2xhYmVsMScsXG5cdFx0fSk7XG5cblx0XHRjb25zdCB0YWIyOiBJRWRpdG9yVGFiRHRvID0gY3JlYXRlVGFiRHRvKHtcblx0XHRcdGlzQWN0aXZlOiBmYWxzZSxcblx0XHRcdGlkOiAndW5pcXVlc3RyaW5nMicsXG5cdFx0XHRsYWJlbDogJ2xhYmVsMicsXG5cdFx0fSk7XG5cblx0XHRjb25zdCB0YWIzOiBJRWRpdG9yVGFiRHRvID0gY3JlYXRlVGFiRHRvKHtcblx0XHRcdGlzQWN0aXZlOiBmYWxzZSxcblx0XHRcdGlkOiAndW5pcXVlc3RyaW5nMycsXG5cdFx0XHRsYWJlbDogJ2xhYmVsMycsXG5cdFx0fSk7XG5cblx0XHRleHRIb3N0RWRpdG9yVGFicy4kYWNjZXB0RWRpdG9yVGFiTW9kZWwoW3tcblx0XHRcdGlzQWN0aXZlOiB0cnVlLFxuXHRcdFx0dmlld0NvbHVtbjogMCxcblx0XHRcdGdyb3VwSWQ6IDEyLFxuXHRcdFx0dGFiczogW3RhYjEsIHRhYjIsIHRhYjNdXG5cdFx0fV0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hbGwubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbC5tYXAoZyA9PiBnLnRhYnMpLmZsYXQoKS5sZW5ndGgsIDMpO1xuXG5cdFx0Ly8gQ2xvc2UgdGFiIDJcblx0XHRleHRIb3N0RWRpdG9yVGFicy4kYWNjZXB0VGFiT3BlcmF0aW9uKHtcblx0XHRcdGdyb3VwSWQ6IDEyLFxuXHRcdFx0aW5kZXg6IDEsXG5cdFx0XHRraW5kOiBUYWJNb2RlbE9wZXJhdGlvbktpbmQuVEFCX0NMT1NFLFxuXHRcdFx0dGFiRHRvOiB0YWIyXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hbGwubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbC5tYXAoZyA9PiBnLnRhYnMpLmZsYXQoKS5sZW5ndGgsIDIpO1xuXG5cdFx0Ly8gQ2xvc2UgYWN0aXZlIHRhYiBhbmQgdXBkYXRlIHRhYiAzIHRvIGJlIGFjdGl2ZVxuXHRcdGV4dEhvc3RFZGl0b3JUYWJzLiRhY2NlcHRUYWJPcGVyYXRpb24oe1xuXHRcdFx0Z3JvdXBJZDogMTIsXG5cdFx0XHRpbmRleDogMCxcblx0XHRcdGtpbmQ6IFRhYk1vZGVsT3BlcmF0aW9uS2luZC5UQUJfQ0xPU0UsXG5cdFx0XHR0YWJEdG86IHRhYjFcblx0XHR9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbC5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsLm1hcChnID0+IGcudGFicykuZmxhdCgpLmxlbmd0aCwgMSk7XG5cdFx0dGFiMy5pc0FjdGl2ZSA9IHRydWU7XG5cdFx0ZXh0SG9zdEVkaXRvclRhYnMuJGFjY2VwdFRhYk9wZXJhdGlvbih7XG5cdFx0XHRncm91cElkOiAxMixcblx0XHRcdGluZGV4OiAwLFxuXHRcdFx0a2luZDogVGFiTW9kZWxPcGVyYXRpb25LaW5kLlRBQl9VUERBVEUsXG5cdFx0XHR0YWJEdG86IHRhYjNcblx0XHR9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbC5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsLm1hcChnID0+IGcudGFicykuZmxhdCgpLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hbGxbMF0/LmFjdGl2ZVRhYj8ubGFiZWwsICdsYWJlbDMnKTtcblxuXHRcdC8vIE9wZW4gdGFiIDIgYmFja1xuXHRcdGV4dEhvc3RFZGl0b3JUYWJzLiRhY2NlcHRUYWJPcGVyYXRpb24oe1xuXHRcdFx0Z3JvdXBJZDogMTIsXG5cdFx0XHRpbmRleDogMSxcblx0XHRcdGtpbmQ6IFRhYk1vZGVsT3BlcmF0aW9uS2luZC5UQUJfT1BFTixcblx0XHRcdHRhYkR0bzogdGFiMlxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hbGwubWFwKGcgPT4gZy50YWJzKS5mbGF0KCkubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbFswXT8udGFic1sxXT8ubGFiZWwsICdsYWJlbDInKTtcblx0fSk7XG5cblx0dGVzdCgnVGFiIG9wZXJhdGlvbnMgcGF0Y2hlcyBtb3ZlIGNvcnJlY3RseScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBleHRIb3N0RWRpdG9yVGFicyA9IG5ldyBFeHRIb3N0RWRpdG9yVGFicyhcblx0XHRcdFNpbmdsZVByb3h5UlBDUHJvdG9jb2wobmV3IGNsYXNzIGV4dGVuZHMgbW9jazxNYWluVGhyZWFkRWRpdG9yVGFic1NoYXBlPigpIHtcblx0XHRcdFx0Ly8gb3ZlcnJpZGUvaW1wbGVtZW50ICRtb3ZlVGFiIG9yICRjbG9zZVRhYlxuXHRcdFx0fSlcblx0XHQpO1xuXG5cdFx0Y29uc3QgdGFiMTogSUVkaXRvclRhYkR0byA9IGNyZWF0ZVRhYkR0byh7XG5cdFx0XHRpZDogJ3VuaXF1ZXN0cmluZycsXG5cdFx0XHRpc0FjdGl2ZTogdHJ1ZSxcblx0XHRcdGxhYmVsOiAnbGFiZWwxJyxcblx0XHR9KTtcblxuXHRcdGNvbnN0IHRhYjI6IElFZGl0b3JUYWJEdG8gPSBjcmVhdGVUYWJEdG8oe1xuXHRcdFx0aXNBY3RpdmU6IGZhbHNlLFxuXHRcdFx0aWQ6ICd1bmlxdWVzdHJpbmcyJyxcblx0XHRcdGxhYmVsOiAnbGFiZWwyJyxcblx0XHR9KTtcblxuXHRcdGNvbnN0IHRhYjM6IElFZGl0b3JUYWJEdG8gPSBjcmVhdGVUYWJEdG8oe1xuXHRcdFx0aXNBY3RpdmU6IGZhbHNlLFxuXHRcdFx0aWQ6ICd1bmlxdWVzdHJpbmczJyxcblx0XHRcdGxhYmVsOiAnbGFiZWwzJyxcblx0XHR9KTtcblxuXHRcdGV4dEhvc3RFZGl0b3JUYWJzLiRhY2NlcHRFZGl0b3JUYWJNb2RlbChbe1xuXHRcdFx0aXNBY3RpdmU6IHRydWUsXG5cdFx0XHR2aWV3Q29sdW1uOiAwLFxuXHRcdFx0Z3JvdXBJZDogMTIsXG5cdFx0XHR0YWJzOiBbdGFiMSwgdGFiMiwgdGFiM11cblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbC5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsLm1hcChnID0+IGcudGFicykuZmxhdCgpLmxlbmd0aCwgMyk7XG5cblx0XHQvLyBNb3ZlIHRhYiAyIHRvIGluZGV4IDBcblx0XHRleHRIb3N0RWRpdG9yVGFicy4kYWNjZXB0VGFiT3BlcmF0aW9uKHtcblx0XHRcdGdyb3VwSWQ6IDEyLFxuXHRcdFx0aW5kZXg6IDAsXG5cdFx0XHRvbGRJbmRleDogMSxcblx0XHRcdGtpbmQ6IFRhYk1vZGVsT3BlcmF0aW9uS2luZC5UQUJfTU9WRSxcblx0XHRcdHRhYkR0bzogdGFiMlxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hbGwubWFwKGcgPT4gZy50YWJzKS5mbGF0KCkubGVuZ3RoLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbFswXT8udGFic1swXT8ubGFiZWwsICdsYWJlbDInKTtcblxuXHRcdC8vIE1vdmUgdGFiIDMgdG8gaW5kZXggMVxuXHRcdGV4dEhvc3RFZGl0b3JUYWJzLiRhY2NlcHRUYWJPcGVyYXRpb24oe1xuXHRcdFx0Z3JvdXBJZDogMTIsXG5cdFx0XHRpbmRleDogMSxcblx0XHRcdG9sZEluZGV4OiAyLFxuXHRcdFx0a2luZDogVGFiTW9kZWxPcGVyYXRpb25LaW5kLlRBQl9NT1ZFLFxuXHRcdFx0dGFiRHRvOiB0YWIzXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcy5hbGwubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXh0SG9zdEVkaXRvclRhYnMudGFiR3JvdXBzLmFsbC5tYXAoZyA9PiBnLnRhYnMpLmZsYXQoKS5sZW5ndGgsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsWzBdPy50YWJzWzFdPy5sYWJlbCwgJ2xhYmVsMycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsWzBdPy50YWJzWzBdPy5sYWJlbCwgJ2xhYmVsMicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHRIb3N0RWRpdG9yVGFicy50YWJHcm91cHMuYWxsWzBdPy50YWJzWzJdPy5sYWJlbCwgJ2xhYmVsMScpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsT0FBTyxZQUFZO0FBQ25CLFNBQVMsV0FBVztBQUNwQixTQUFTLFlBQVk7QUFDckIsU0FBdUUsY0FBYyw2QkFBMkM7QUFDaEksU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxtQkFBbUIsb0JBQW9CO0FBQ2hELFNBQVMsK0NBQStDO0FBRXhELE1BQU0scUJBQXFCLFdBQVk7QUFFdEMsUUFBTSxnQkFBK0I7QUFBQSxJQUNwQyxJQUFJO0FBQUEsSUFDSixPQUFPLEVBQUUsTUFBTSxhQUFhLFdBQVcsS0FBSyxJQUFJLE1BQU0sb0JBQW9CLEVBQUU7QUFBQSxJQUM1RSxVQUFVO0FBQUEsSUFDVixTQUFTO0FBQUEsSUFDVCxVQUFVO0FBQUEsSUFDVixXQUFXO0FBQUEsSUFDWCxPQUFPO0FBQUEsRUFDUjtBQUVBLFdBQVMsYUFBYSxLQUE2QztBQUNsRSxXQUFPLEVBQUUsR0FBRyxlQUFlLEdBQUcsSUFBSTtBQUFBLEVBQ25DO0FBRUEsUUFBTSxRQUFRLHdDQUF3QztBQUV0RCxP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
