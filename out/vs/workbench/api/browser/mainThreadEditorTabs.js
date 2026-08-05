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
import { Event } from "../../../base/common/event.js";
import { DisposableMap, DisposableStore } from "../../../base/common/lifecycle.js";
import { isEqual } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { ExtHostContext, MainContext, TabInputKind, TabModelOperationKind } from "../common/extHost.protocol.js";
import { EditorResourceAccessor, GroupModelChangeKind, SideBySideEditor } from "../../common/editor.js";
import { DiffEditorInput } from "../../common/editor/diffEditorInput.js";
import { isGroupEditorMoveEvent } from "../../common/editor/editorGroupModel.js";
import { SideBySideEditorInput } from "../../common/editor/sideBySideEditorInput.js";
import { AbstractTextResourceEditorInput } from "../../common/editor/textResourceEditorInput.js";
import { ChatEditorInput } from "../../contrib/chat/browser/chatEditorInput.js";
import { CustomEditorInput } from "../../contrib/customEditor/browser/customEditorInput.js";
import { InteractiveEditorInput } from "../../contrib/interactive/browser/interactiveEditorInput.js";
import { MergeEditorInput } from "../../contrib/mergeEditor/browser/mergeEditorInput.js";
import { MultiDiffEditorInput } from "../../contrib/multiDiffEditor/browser/multiDiffEditorInput.js";
import { NotebookEditorInput } from "../../contrib/notebook/common/notebookEditorInput.js";
import { TerminalEditorInput } from "../../contrib/terminal/browser/terminalEditorInput.js";
import { WebviewInput } from "../../contrib/webviewPanel/browser/webviewEditorInput.js";
import { columnToEditorGroup, editorGroupToColumn } from "../../services/editor/common/editorGroupColumn.js";
import { GroupDirection, IEditorGroupsService, preferredSideBySideGroupDirection } from "../../services/editor/common/editorGroupsService.js";
import { IEditorService, SIDE_GROUP } from "../../services/editor/common/editorService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
let MainThreadEditorTabs = class {
  constructor(extHostContext, _editorGroupsService, _configurationService, _logService, editorService) {
    this._editorGroupsService = _editorGroupsService;
    this._configurationService = _configurationService;
    this._logService = _logService;
    this._dispoables = new DisposableStore();
    // List of all groups and their corresponding tabs, this is **the** model
    this._tabGroupModel = [];
    // Lookup table for finding group by id
    this._groupLookup = /* @__PURE__ */ new Map();
    // Lookup table for finding tab by id
    this._tabInfoLookup = /* @__PURE__ */ new Map();
    // Tracks the currently open MultiDiffEditorInputs to listen to resource changes
    this._multiDiffEditorInputListeners = new DisposableMap();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostEditorTabs);
    this._dispoables.add(editorService.onDidEditorsChange((event) => {
      try {
        this._updateTabsModel(event);
      } catch {
        this._logService.error("Failed to update model, rebuilding");
        this._createTabsModel();
      }
    }));
    this._dispoables.add(this._multiDiffEditorInputListeners);
    this._dispoables.add(this._editorGroupsService.onDidAddGroup(() => this._createTabsModel()));
    this._dispoables.add(this._editorGroupsService.onDidRemoveGroup(() => this._createTabsModel()));
    this._editorGroupsService.whenReady.then(() => this._createTabsModel());
  }
  dispose() {
    this._groupLookup.clear();
    this._tabInfoLookup.clear();
    this._dispoables.dispose();
  }
  /**
   * Creates a tab object with the correct properties
   * @param editor The editor input represented by the tab
   * @param group The group the tab is in
   * @returns A tab object
   */
  _buildTabObject(group, editor, editorIndex) {
    const editorId = editor.editorId;
    const tab = {
      id: this._generateTabId(editor, group.id),
      label: editor.getName(),
      editorId,
      input: this._editorInputToDto(editor),
      isPinned: group.isSticky(editorIndex),
      isPreview: !group.isPinned(editorIndex),
      isActive: group.isActive(editor),
      isDirty: editor.isDirty()
    };
    return tab;
  }
  _editorInputToDto(editor) {
    if (editor instanceof MergeEditorInput) {
      return {
        kind: TabInputKind.TextMergeInput,
        base: editor.base,
        input1: editor.input1.uri,
        input2: editor.input2.uri,
        result: editor.resource
      };
    }
    if (editor instanceof AbstractTextResourceEditorInput) {
      return {
        kind: TabInputKind.TextInput,
        uri: editor.resource
      };
    }
    if (editor instanceof SideBySideEditorInput && !(editor instanceof DiffEditorInput)) {
      const primaryResource = editor.primary.resource;
      const secondaryResource = editor.secondary.resource;
      if (editor.primary instanceof AbstractTextResourceEditorInput && editor.secondary instanceof AbstractTextResourceEditorInput && isEqual(primaryResource, secondaryResource) && primaryResource && secondaryResource) {
        return {
          kind: TabInputKind.TextInput,
          uri: primaryResource
        };
      }
      return { kind: TabInputKind.UnknownInput };
    }
    if (editor instanceof NotebookEditorInput) {
      return {
        kind: TabInputKind.NotebookInput,
        notebookType: editor.viewType,
        uri: editor.resource
      };
    }
    if (editor instanceof CustomEditorInput) {
      return {
        kind: TabInputKind.CustomEditorInput,
        viewType: editor.viewType,
        uri: editor.resource
      };
    }
    if (editor instanceof WebviewInput) {
      return {
        kind: TabInputKind.WebviewEditorInput,
        viewType: editor.viewType
      };
    }
    if (editor instanceof TerminalEditorInput) {
      return {
        kind: TabInputKind.TerminalEditorInput
      };
    }
    if (editor instanceof DiffEditorInput) {
      if (editor.modified instanceof AbstractTextResourceEditorInput && editor.original instanceof AbstractTextResourceEditorInput) {
        return {
          kind: TabInputKind.TextDiffInput,
          modified: editor.modified.resource,
          original: editor.original.resource
        };
      }
      if (editor.modified instanceof NotebookEditorInput && editor.original instanceof NotebookEditorInput) {
        return {
          kind: TabInputKind.NotebookDiffInput,
          notebookType: editor.original.viewType,
          modified: editor.modified.resource,
          original: editor.original.resource
        };
      }
    }
    if (editor instanceof InteractiveEditorInput) {
      return {
        kind: TabInputKind.InteractiveEditorInput,
        uri: editor.resource,
        inputBoxUri: editor.inputResource
      };
    }
    if (editor instanceof ChatEditorInput) {
      return {
        kind: TabInputKind.ChatEditorInput
      };
    }
    if (editor instanceof MultiDiffEditorInput) {
      const diffEditors = [];
      for (const resource of editor?.resources.get() ?? []) {
        if (resource.originalUri && resource.modifiedUri) {
          diffEditors.push({
            kind: TabInputKind.TextDiffInput,
            original: resource.originalUri,
            modified: resource.modifiedUri
          });
        }
      }
      return {
        kind: TabInputKind.MultiDiffEditorInput,
        diffEditors
      };
    }
    return { kind: TabInputKind.UnknownInput };
  }
  /**
   * Generates a unique id for a tab
   * @param editor The editor input
   * @param groupId The group id
   * @returns A unique identifier for a specific tab
   */
  _generateTabId(editor, groupId) {
    let resourceString;
    const resource = EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.BOTH });
    if (resource instanceof URI) {
      resourceString = resource.toString();
    } else {
      resourceString = `${resource?.primary?.toString()}-${resource?.secondary?.toString()}`;
    }
    return `${groupId}~${editor.editorId}-${editor.typeId}-${resourceString} `;
  }
  /**
   * Called whenever a group activates, updates the model by marking the group as active an notifies the extension host
   */
  _onDidGroupActivate() {
    const activeGroupId = this._editorGroupsService.activeGroup.id;
    const activeGroup = this._groupLookup.get(activeGroupId);
    if (activeGroup) {
      activeGroup.isActive = true;
      this._proxy.$acceptTabGroupUpdate(activeGroup);
    }
  }
  /**
   * Called when the tab label changes
   * @param groupId The id of the group the tab exists in
   * @param editorInput The editor input represented by the tab
   */
  _onDidTabLabelChange(groupId, editorInput, editorIndex) {
    const tabId = this._generateTabId(editorInput, groupId);
    const tabInfo = this._tabInfoLookup.get(tabId);
    if (tabInfo) {
      tabInfo.tab.label = editorInput.getName();
      this._proxy.$acceptTabOperation({
        groupId,
        index: editorIndex,
        tabDto: tabInfo.tab,
        kind: TabModelOperationKind.TAB_UPDATE
      });
    } else {
      this._logService.error("Invalid model for label change, rebuilding");
      this._createTabsModel();
    }
  }
  /**
   * Called when a new tab is opened
   * @param groupId The id of the group the tab is being created in
   * @param editorInput The editor input being opened
   * @param editorIndex The index of the editor within that group
   */
  _onDidTabOpen(groupId, editorInput, editorIndex) {
    const group = this._editorGroupsService.getGroup(groupId);
    const groupInModel = this._groupLookup.get(groupId) !== void 0;
    if (!group || !groupInModel) {
      this._createTabsModel();
      return;
    }
    const tabs = this._groupLookup.get(groupId)?.tabs;
    if (!tabs) {
      return;
    }
    const tabObject = this._buildTabObject(group, editorInput, editorIndex);
    tabs.splice(editorIndex, 0, tabObject);
    const tabId = this._generateTabId(editorInput, groupId);
    this._tabInfoLookup.set(tabId, { group, editorInput, tab: tabObject });
    if (editorInput instanceof MultiDiffEditorInput) {
      this._multiDiffEditorInputListeners.set(editorInput, Event.fromObservableLight(editorInput.resources)(() => {
        const tabInfo = this._tabInfoLookup.get(tabId);
        if (!tabInfo) {
          return;
        }
        tabInfo.tab = this._buildTabObject(group, editorInput, editorIndex);
        this._proxy.$acceptTabOperation({
          groupId,
          index: editorIndex,
          tabDto: tabInfo.tab,
          kind: TabModelOperationKind.TAB_UPDATE
        });
      }));
    }
    this._proxy.$acceptTabOperation({
      groupId,
      index: editorIndex,
      tabDto: tabObject,
      kind: TabModelOperationKind.TAB_OPEN
    });
  }
  /**
   * Called when a tab is closed
   * @param groupId The id of the group the tab is being removed from
   * @param editorIndex The index of the editor within that group
   */
  _onDidTabClose(groupId, editorIndex) {
    const group = this._editorGroupsService.getGroup(groupId);
    const tabs = this._groupLookup.get(groupId)?.tabs;
    if (!group || !tabs) {
      this._createTabsModel();
      return;
    }
    const removedTab = tabs.splice(editorIndex, 1);
    if (removedTab.length === 0) {
      return;
    }
    this._tabInfoLookup.delete(removedTab[0]?.id ?? "");
    if (removedTab[0]?.input instanceof MultiDiffEditorInput) {
      this._multiDiffEditorInputListeners.deleteAndDispose(removedTab[0]?.input);
    }
    this._proxy.$acceptTabOperation({
      groupId,
      index: editorIndex,
      tabDto: removedTab[0],
      kind: TabModelOperationKind.TAB_CLOSE
    });
  }
  /**
   * Called when the active tab changes
   * @param groupId The id of the group the tab is contained in
   * @param editorIndex The index of the tab
   */
  _onDidTabActiveChange(groupId, editorIndex) {
    const tabs = this._groupLookup.get(groupId)?.tabs;
    if (!tabs) {
      return;
    }
    const activeTab = tabs[editorIndex];
    activeTab.isActive = true;
    this._proxy.$acceptTabOperation({
      groupId,
      index: editorIndex,
      tabDto: activeTab,
      kind: TabModelOperationKind.TAB_UPDATE
    });
  }
  /**
   * Called when the dirty indicator on the tab changes
   * @param groupId The id of the group the tab is in
   * @param editorIndex The index of the tab
   * @param editor The editor input represented by the tab
   */
  _onDidTabDirty(groupId, editorIndex, editor) {
    const tabId = this._generateTabId(editor, groupId);
    const tabInfo = this._tabInfoLookup.get(tabId);
    if (!tabInfo) {
      this._logService.error("Invalid model for dirty change, rebuilding");
      this._createTabsModel();
      return;
    }
    tabInfo.tab.isDirty = editor.isDirty();
    this._proxy.$acceptTabOperation({
      groupId,
      index: editorIndex,
      tabDto: tabInfo.tab,
      kind: TabModelOperationKind.TAB_UPDATE
    });
  }
  /**
   * Called when the tab is pinned/unpinned
   * @param groupId The id of the group the tab is in
   * @param editorIndex The index of the tab
   * @param editor The editor input represented by the tab
   */
  _onDidTabPinChange(groupId, editorIndex, editor) {
    const tabId = this._generateTabId(editor, groupId);
    const tabInfo = this._tabInfoLookup.get(tabId);
    const group = tabInfo?.group;
    const tab = tabInfo?.tab;
    if (!group || !tab) {
      this._logService.error("Invalid model for sticky change, rebuilding");
      this._createTabsModel();
      return;
    }
    tab.isPinned = group.isSticky(editorIndex);
    this._proxy.$acceptTabOperation({
      groupId,
      index: editorIndex,
      tabDto: tab,
      kind: TabModelOperationKind.TAB_UPDATE
    });
  }
  /**
  * Called when the tab is preview / unpreviewed
  * @param groupId The id of the group the tab is in
  * @param editorIndex The index of the tab
  * @param editor The editor input represented by the tab
  */
  _onDidTabPreviewChange(groupId, editorIndex, editor) {
    const tabId = this._generateTabId(editor, groupId);
    const tabInfo = this._tabInfoLookup.get(tabId);
    const group = tabInfo?.group;
    const tab = tabInfo?.tab;
    if (!group || !tab) {
      this._logService.error("Invalid model for sticky change, rebuilding");
      this._createTabsModel();
      return;
    }
    tab.isPreview = !group.isPinned(editorIndex);
    this._proxy.$acceptTabOperation({
      kind: TabModelOperationKind.TAB_UPDATE,
      groupId,
      tabDto: tab,
      index: editorIndex
    });
  }
  _onDidTabMove(groupId, editorIndex, oldEditorIndex, editor) {
    const tabs = this._groupLookup.get(groupId)?.tabs;
    if (!tabs) {
      this._logService.error("Invalid model for move change, rebuilding");
      this._createTabsModel();
      return;
    }
    const removedTab = tabs.splice(oldEditorIndex, 1);
    if (removedTab.length === 0) {
      return;
    }
    tabs.splice(editorIndex, 0, removedTab[0]);
    this._proxy.$acceptTabOperation({
      kind: TabModelOperationKind.TAB_MOVE,
      groupId,
      tabDto: removedTab[0],
      index: editorIndex,
      oldIndex: oldEditorIndex
    });
  }
  /**
   * Builds the model from scratch based on the current state of the editor service.
   */
  _createTabsModel() {
    if (this._editorGroupsService.groups.length === 0) {
      return;
    }
    this._tabGroupModel = [];
    this._groupLookup.clear();
    this._tabInfoLookup.clear();
    let tabs = [];
    for (const group of this._editorGroupsService.groups) {
      const currentTabGroupModel = {
        groupId: group.id,
        isActive: group.id === this._editorGroupsService.activeGroup.id,
        viewColumn: editorGroupToColumn(this._editorGroupsService, group),
        tabs: []
      };
      group.editors.forEach((editor, editorIndex) => {
        const tab = this._buildTabObject(group, editor, editorIndex);
        tabs.push(tab);
        this._tabInfoLookup.set(this._generateTabId(editor, group.id), {
          group,
          tab,
          editorInput: editor
        });
      });
      currentTabGroupModel.tabs = tabs;
      this._tabGroupModel.push(currentTabGroupModel);
      this._groupLookup.set(group.id, currentTabGroupModel);
      tabs = [];
    }
    this._proxy.$acceptEditorTabModel(this._tabGroupModel);
  }
  // TODOD @lramos15 Remove this after done finishing the tab model code
  // private _eventToString(event: IEditorsChangeEvent | IEditorsMoveEvent): string {
  // 	let eventString = '';
  // 	switch (event.kind) {
  // 		case GroupModelChangeKind.GROUP_INDEX: eventString += 'GROUP_INDEX'; break;
  // 		case GroupModelChangeKind.EDITOR_ACTIVE: eventString += 'EDITOR_ACTIVE'; break;
  // 		case GroupModelChangeKind.EDITOR_PIN: eventString += 'EDITOR_PIN'; break;
  // 		case GroupModelChangeKind.EDITOR_OPEN: eventString += 'EDITOR_OPEN'; break;
  // 		case GroupModelChangeKind.EDITOR_CLOSE: eventString += 'EDITOR_CLOSE'; break;
  // 		case GroupModelChangeKind.EDITOR_MOVE: eventString += 'EDITOR_MOVE'; break;
  // 		case GroupModelChangeKind.EDITOR_LABEL: eventString += 'EDITOR_LABEL'; break;
  // 		case GroupModelChangeKind.GROUP_ACTIVE: eventString += 'GROUP_ACTIVE'; break;
  // 		case GroupModelChangeKind.GROUP_LOCKED: eventString += 'GROUP_LOCKED'; break;
  // 		case GroupModelChangeKind.EDITOR_DIRTY: eventString += 'EDITOR_DIRTY'; break;
  // 		case GroupModelChangeKind.EDITOR_STICKY: eventString += 'EDITOR_STICKY'; break;
  // 		default: eventString += `UNKNOWN: ${event.kind}`; break;
  // 	}
  // 	return eventString;
  // }
  /**
   * The main handler for the tab events
   * @param events The list of events to process
   */
  _updateTabsModel(changeEvent) {
    const event = changeEvent.event;
    const groupId = changeEvent.groupId;
    switch (event.kind) {
      case GroupModelChangeKind.GROUP_ACTIVE:
        if (groupId === this._editorGroupsService.activeGroup.id) {
          this._onDidGroupActivate();
          break;
        } else {
          return;
        }
      case GroupModelChangeKind.EDITOR_LABEL:
        if (event.editor !== void 0 && event.editorIndex !== void 0) {
          this._onDidTabLabelChange(groupId, event.editor, event.editorIndex);
          break;
        }
      case GroupModelChangeKind.EDITOR_OPEN:
        if (event.editor !== void 0 && event.editorIndex !== void 0) {
          this._onDidTabOpen(groupId, event.editor, event.editorIndex);
          break;
        }
      case GroupModelChangeKind.EDITOR_CLOSE:
        if (event.editorIndex !== void 0) {
          this._onDidTabClose(groupId, event.editorIndex);
          break;
        }
      case GroupModelChangeKind.EDITOR_ACTIVE:
        if (event.editorIndex !== void 0) {
          this._onDidTabActiveChange(groupId, event.editorIndex);
          break;
        }
      case GroupModelChangeKind.EDITOR_DIRTY:
        if (event.editorIndex !== void 0 && event.editor !== void 0) {
          this._onDidTabDirty(groupId, event.editorIndex, event.editor);
          break;
        }
      case GroupModelChangeKind.EDITOR_STICKY:
        if (event.editorIndex !== void 0 && event.editor !== void 0) {
          this._onDidTabPinChange(groupId, event.editorIndex, event.editor);
          break;
        }
      case GroupModelChangeKind.EDITOR_PIN:
        if (event.editorIndex !== void 0 && event.editor !== void 0) {
          this._onDidTabPreviewChange(groupId, event.editorIndex, event.editor);
          break;
        }
      case GroupModelChangeKind.EDITOR_TRANSIENT:
        break;
      case GroupModelChangeKind.EDITOR_MOVE:
        if (isGroupEditorMoveEvent(event) && event.editor && event.editorIndex !== void 0 && event.oldEditorIndex !== void 0) {
          this._onDidTabMove(groupId, event.editorIndex, event.oldEditorIndex, event.editor);
          break;
        }
      default:
        this._createTabsModel();
    }
  }
  //#region Messages received from Ext Host
  $moveTab(tabId, index, viewColumn, preserveFocus) {
    const groupId = columnToEditorGroup(this._editorGroupsService, this._configurationService, viewColumn);
    const tabInfo = this._tabInfoLookup.get(tabId);
    const tab = tabInfo?.tab;
    if (!tab) {
      throw new Error(`Attempted to close tab with id ${tabId} which does not exist`);
    }
    let targetGroup;
    const sourceGroup = this._editorGroupsService.getGroup(tabInfo.group.id);
    if (!sourceGroup) {
      return;
    }
    if (this._groupLookup.get(groupId) === void 0) {
      let direction = GroupDirection.RIGHT;
      if (viewColumn === SIDE_GROUP) {
        direction = preferredSideBySideGroupDirection(this._configurationService);
      }
      targetGroup = this._editorGroupsService.addGroup(this._editorGroupsService.groups[this._editorGroupsService.groups.length - 1], direction);
    } else {
      targetGroup = this._editorGroupsService.getGroup(groupId);
    }
    if (!targetGroup) {
      return;
    }
    if (index < 0 || index > targetGroup.editors.length) {
      index = targetGroup.editors.length;
    }
    const editorInput = tabInfo?.editorInput;
    if (!editorInput) {
      return;
    }
    sourceGroup.moveEditor(editorInput, targetGroup, { index, preserveFocus });
    return;
  }
  async $closeTab(tabIds, preserveFocus) {
    const groups = /* @__PURE__ */ new Map();
    for (const tabId of tabIds) {
      const tabInfo = this._tabInfoLookup.get(tabId);
      const tab = tabInfo?.tab;
      const group = tabInfo?.group;
      const editorTab = tabInfo?.editorInput;
      if (!group || !tab || !tabInfo || !editorTab) {
        continue;
      }
      const groupEditors = groups.get(group);
      if (!groupEditors) {
        groups.set(group, [editorTab]);
      } else {
        groupEditors.push(editorTab);
      }
    }
    const results = [];
    for (const [group, editors] of groups) {
      results.push(await group.closeEditors(editors, { preserveFocus }));
    }
    return results.every((result) => result);
  }
  async $closeGroup(groupIds, preserveFocus) {
    const groupCloseResults = [];
    for (const groupId of groupIds) {
      const group = this._editorGroupsService.getGroup(groupId);
      if (group) {
        groupCloseResults.push(await group.closeAllEditors());
        if (group.count === 0 && this._editorGroupsService.getGroup(group.id)) {
          this._editorGroupsService.removeGroup(group);
        }
      }
    }
    return groupCloseResults.every((result) => result);
  }
  //#endregion
};
MainThreadEditorTabs = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadEditorTabs),
  __decorateParam(1, IEditorGroupsService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IEditorService)
], MainThreadEditorTabs);
export {
  MainThreadEditorTabs
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZEVkaXRvclRhYnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVNYXAsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgQW55SW5wdXREdG8sIEV4dEhvc3RDb250ZXh0LCBJRWRpdG9yVGFiRHRvLCBJRWRpdG9yVGFiR3JvdXBEdG8sIElFeHRIb3N0RWRpdG9yVGFic1NoYXBlLCBNYWluQ29udGV4dCwgTWFpblRocmVhZEVkaXRvclRhYnNTaGFwZSwgVGFiSW5wdXRLaW5kLCBUYWJNb2RlbE9wZXJhdGlvbktpbmQsIFRleHREaWZmSW5wdXREdG8gfSBmcm9tICcuLi9jb21tb24vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLCBHcm91cE1vZGVsQ2hhbmdlS2luZCwgU2lkZUJ5U2lkZUVkaXRvciB9IGZyb20gJy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vY29tbW9uL2VkaXRvci9kaWZmRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgaXNHcm91cEVkaXRvck1vdmVFdmVudCB9IGZyb20gJy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9yR3JvdXBNb2RlbC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgU2lkZUJ5U2lkZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vY29tbW9uL2VkaXRvci9zaWRlQnlTaWRlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uL2NvbW1vbi9lZGl0b3IvdGV4dFJlc291cmNlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IEN1c3RvbUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vY29udHJpYi9jdXN0b21FZGl0b3IvYnJvd3Nlci9jdXN0b21FZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJbnRlcmFjdGl2ZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vY29udHJpYi9pbnRlcmFjdGl2ZS9icm93c2VyL2ludGVyYWN0aXZlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgTWVyZ2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uL2NvbnRyaWIvbWVyZ2VFZGl0b3IvYnJvd3Nlci9tZXJnZUVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IE11bHRpRGlmZkVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vY29udHJpYi9tdWx0aURpZmZFZGl0b3IvYnJvd3Nlci9tdWx0aURpZmZFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0VkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vY29udHJpYi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgV2Vidmlld0lucHV0IH0gZnJvbSAnLi4vLi4vY29udHJpYi93ZWJ2aWV3UGFuZWwvYnJvd3Nlci93ZWJ2aWV3RWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgY29sdW1uVG9FZGl0b3JHcm91cCwgRWRpdG9yR3JvdXBDb2x1bW4sIGVkaXRvckdyb3VwVG9Db2x1bW4gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3VwQ29sdW1uLmpzJztcbmltcG9ydCB7IEdyb3VwRGlyZWN0aW9uLCBJRWRpdG9yR3JvdXAsIElFZGl0b3JHcm91cHNTZXJ2aWNlLCBwcmVmZXJyZWRTaWRlQnlTaWRlR3JvdXBEaXJlY3Rpb24gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvcnNDaGFuZ2VFdmVudCwgSUVkaXRvclNlcnZpY2UsIFNJREVfR1JPVVAgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZXh0SG9zdE5hbWVkQ3VzdG9tZXIsIElFeHRIb3N0Q29udGV4dCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dEhvc3RDdXN0b21lcnMuanMnO1xuXG5pbnRlcmZhY2UgVGFiSW5mbyB7XG5cdHRhYjogSUVkaXRvclRhYkR0bztcblx0Z3JvdXA6IElFZGl0b3JHcm91cDtcblx0ZWRpdG9ySW5wdXQ6IEVkaXRvcklucHV0O1xufVxuQGV4dEhvc3ROYW1lZEN1c3RvbWVyKE1haW5Db250ZXh0Lk1haW5UaHJlYWRFZGl0b3JUYWJzKVxuZXhwb3J0IGNsYXNzIE1haW5UaHJlYWRFZGl0b3JUYWJzIGltcGxlbWVudHMgTWFpblRocmVhZEVkaXRvclRhYnNTaGFwZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9hYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IElFeHRIb3N0RWRpdG9yVGFic1NoYXBlO1xuXHQvLyBMaXN0IG9mIGFsbCBncm91cHMgYW5kIHRoZWlyIGNvcnJlc3BvbmRpbmcgdGFicywgdGhpcyBpcyAqKnRoZSoqIG1vZGVsXG5cdHByaXZhdGUgX3RhYkdyb3VwTW9kZWw6IElFZGl0b3JUYWJHcm91cER0b1tdID0gW107XG5cdC8vIExvb2t1cCB0YWJsZSBmb3IgZmluZGluZyBncm91cCBieSBpZFxuXHRwcml2YXRlIHJlYWRvbmx5IF9ncm91cExvb2t1cDogTWFwPG51bWJlciwgSUVkaXRvclRhYkdyb3VwRHRvPiA9IG5ldyBNYXAoKTtcblx0Ly8gTG9va3VwIHRhYmxlIGZvciBmaW5kaW5nIHRhYiBieSBpZFxuXHRwcml2YXRlIHJlYWRvbmx5IF90YWJJbmZvTG9va3VwOiBNYXA8c3RyaW5nLCBUYWJJbmZvPiA9IG5ldyBNYXAoKTtcblx0Ly8gVHJhY2tzIHRoZSBjdXJyZW50bHkgb3BlbiBNdWx0aURpZmZFZGl0b3JJbnB1dHMgdG8gbGlzdGVuIHRvIHJlc291cmNlIGNoYW5nZXNcblx0cHJpdmF0ZSByZWFkb25seSBfbXVsdGlEaWZmRWRpdG9ySW5wdXRMaXN0ZW5lcnM6IERpc3Bvc2FibGVNYXA8TXVsdGlEaWZmRWRpdG9ySW5wdXQ+ID0gbmV3IERpc3Bvc2FibGVNYXAoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRleHRIb3N0Q29udGV4dDogSUV4dEhvc3RDb250ZXh0LFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JHcm91cHNTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZVxuXHQpIHtcblxuXHRcdHRoaXMuX3Byb3h5ID0gZXh0SG9zdENvbnRleHQuZ2V0UHJveHkoRXh0SG9zdENvbnRleHQuRXh0SG9zdEVkaXRvclRhYnMpO1xuXG5cdFx0Ly8gTWFpbiBsaXN0ZW5lciB3aGljaCByZXNwb25kcyB0byBldmVudHMgZnJvbSB0aGUgZWRpdG9yIHNlcnZpY2Vcblx0XHR0aGlzLl9kaXNwb2FibGVzLmFkZChlZGl0b3JTZXJ2aWNlLm9uRGlkRWRpdG9yc0NoYW5nZSgoZXZlbnQpID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZVRhYnNNb2RlbChldmVudCk7XG5cdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcignRmFpbGVkIHRvIHVwZGF0ZSBtb2RlbCwgcmVidWlsZGluZycpO1xuXHRcdFx0XHR0aGlzLl9jcmVhdGVUYWJzTW9kZWwoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9kaXNwb2FibGVzLmFkZCh0aGlzLl9tdWx0aURpZmZFZGl0b3JJbnB1dExpc3RlbmVycyk7XG5cblx0XHQvLyBTdHJ1Y3R1cmFsIGdyb3VwIGNoYW5nZXMgKGFkZCwgcmVtb3ZlLCBtb3ZlLCBldGMpIGFyZSBkaWZmaWN1bHQgdG8gcGF0Y2guXG5cdFx0Ly8gU2luY2UgdGhleSBoYXBwZW4gaW5mcmVxdWVudGx5IHdlIGp1c3QgcmVidWlsZCB0aGUgZW50aXJlIG1vZGVsXG5cdFx0dGhpcy5fZGlzcG9hYmxlcy5hZGQodGhpcy5fZWRpdG9yR3JvdXBzU2VydmljZS5vbkRpZEFkZEdyb3VwKCgpID0+IHRoaXMuX2NyZWF0ZVRhYnNNb2RlbCgpKSk7XG5cdFx0dGhpcy5fZGlzcG9hYmxlcy5hZGQodGhpcy5fZWRpdG9yR3JvdXBzU2VydmljZS5vbkRpZFJlbW92ZUdyb3VwKCgpID0+IHRoaXMuX2NyZWF0ZVRhYnNNb2RlbCgpKSk7XG5cblx0XHQvLyBPbmNlIGV2ZXJ5dGhpbmcgaXMgcmVhZCBnbyBhaGVhZCBhbmQgaW5pdGlhbGl6ZSB0aGUgbW9kZWxcblx0XHR0aGlzLl9lZGl0b3JHcm91cHNTZXJ2aWNlLndoZW5SZWFkeS50aGVuKCgpID0+IHRoaXMuX2NyZWF0ZVRhYnNNb2RlbCgpKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZ3JvdXBMb29rdXAuY2xlYXIoKTtcblx0XHR0aGlzLl90YWJJbmZvTG9va3VwLmNsZWFyKCk7XG5cdFx0dGhpcy5fZGlzcG9hYmxlcy5kaXNwb3NlKCk7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIHRhYiBvYmplY3Qgd2l0aCB0aGUgY29ycmVjdCBwcm9wZXJ0aWVzXG5cdCAqIEBwYXJhbSBlZGl0b3IgVGhlIGVkaXRvciBpbnB1dCByZXByZXNlbnRlZCBieSB0aGUgdGFiXG5cdCAqIEBwYXJhbSBncm91cCBUaGUgZ3JvdXAgdGhlIHRhYiBpcyBpblxuXHQgKiBAcmV0dXJucyBBIHRhYiBvYmplY3Rcblx0ICovXG5cdHByaXZhdGUgX2J1aWxkVGFiT2JqZWN0KGdyb3VwOiBJRWRpdG9yR3JvdXAsIGVkaXRvcjogRWRpdG9ySW5wdXQsIGVkaXRvckluZGV4OiBudW1iZXIpOiBJRWRpdG9yVGFiRHRvIHtcblx0XHRjb25zdCBlZGl0b3JJZCA9IGVkaXRvci5lZGl0b3JJZDtcblx0XHRjb25zdCB0YWI6IElFZGl0b3JUYWJEdG8gPSB7XG5cdFx0XHRpZDogdGhpcy5fZ2VuZXJhdGVUYWJJZChlZGl0b3IsIGdyb3VwLmlkKSxcblx0XHRcdGxhYmVsOiBlZGl0b3IuZ2V0TmFtZSgpLFxuXHRcdFx0ZWRpdG9ySWQsXG5cdFx0XHRpbnB1dDogdGhpcy5fZWRpdG9ySW5wdXRUb0R0byhlZGl0b3IpLFxuXHRcdFx0aXNQaW5uZWQ6IGdyb3VwLmlzU3RpY2t5KGVkaXRvckluZGV4KSxcblx0XHRcdGlzUHJldmlldzogIWdyb3VwLmlzUGlubmVkKGVkaXRvckluZGV4KSxcblx0XHRcdGlzQWN0aXZlOiBncm91cC5pc0FjdGl2ZShlZGl0b3IpLFxuXHRcdFx0aXNEaXJ0eTogZWRpdG9yLmlzRGlydHkoKVxuXHRcdH07XG5cdFx0cmV0dXJuIHRhYjtcblx0fVxuXG5cdHByaXZhdGUgX2VkaXRvcklucHV0VG9EdG8oZWRpdG9yOiBFZGl0b3JJbnB1dCk6IEFueUlucHV0RHRvIHtcblxuXHRcdGlmIChlZGl0b3IgaW5zdGFuY2VvZiBNZXJnZUVkaXRvcklucHV0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRraW5kOiBUYWJJbnB1dEtpbmQuVGV4dE1lcmdlSW5wdXQsXG5cdFx0XHRcdGJhc2U6IGVkaXRvci5iYXNlLFxuXHRcdFx0XHRpbnB1dDE6IGVkaXRvci5pbnB1dDEudXJpLFxuXHRcdFx0XHRpbnB1dDI6IGVkaXRvci5pbnB1dDIudXJpLFxuXHRcdFx0XHRyZXN1bHQ6IGVkaXRvci5yZXNvdXJjZVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoZWRpdG9yIGluc3RhbmNlb2YgQWJzdHJhY3RUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0a2luZDogVGFiSW5wdXRLaW5kLlRleHRJbnB1dCxcblx0XHRcdFx0dXJpOiBlZGl0b3IucmVzb3VyY2Vcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKGVkaXRvciBpbnN0YW5jZW9mIFNpZGVCeVNpZGVFZGl0b3JJbnB1dCAmJiAhKGVkaXRvciBpbnN0YW5jZW9mIERpZmZFZGl0b3JJbnB1dCkpIHtcblx0XHRcdGNvbnN0IHByaW1hcnlSZXNvdXJjZSA9IGVkaXRvci5wcmltYXJ5LnJlc291cmNlO1xuXHRcdFx0Y29uc3Qgc2Vjb25kYXJ5UmVzb3VyY2UgPSBlZGl0b3Iuc2Vjb25kYXJ5LnJlc291cmNlO1xuXHRcdFx0Ly8gSWYgc2lkZSBieSBzaWRlIGVkaXRvciB3aXRoIHNhbWUgcmVzb3VyY2Ugb24gYm90aCBzaWRlcyB0cmVhdCBpdCBhcyBhIHNpbmd1bGFyIHRhYiBraW5kXG5cdFx0XHRpZiAoZWRpdG9yLnByaW1hcnkgaW5zdGFuY2VvZiBBYnN0cmFjdFRleHRSZXNvdXJjZUVkaXRvcklucHV0XG5cdFx0XHRcdCYmIGVkaXRvci5zZWNvbmRhcnkgaW5zdGFuY2VvZiBBYnN0cmFjdFRleHRSZXNvdXJjZUVkaXRvcklucHV0XG5cdFx0XHRcdCYmIGlzRXF1YWwocHJpbWFyeVJlc291cmNlLCBzZWNvbmRhcnlSZXNvdXJjZSlcblx0XHRcdFx0JiYgcHJpbWFyeVJlc291cmNlXG5cdFx0XHRcdCYmIHNlY29uZGFyeVJlc291cmNlXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRraW5kOiBUYWJJbnB1dEtpbmQuVGV4dElucHV0LFxuXHRcdFx0XHRcdHVyaTogcHJpbWFyeVJlc291cmNlXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4geyBraW5kOiBUYWJJbnB1dEtpbmQuVW5rbm93bklucHV0IH07XG5cdFx0fVxuXG5cdFx0aWYgKGVkaXRvciBpbnN0YW5jZW9mIE5vdGVib29rRWRpdG9ySW5wdXQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGtpbmQ6IFRhYklucHV0S2luZC5Ob3RlYm9va0lucHV0LFxuXHRcdFx0XHRub3RlYm9va1R5cGU6IGVkaXRvci52aWV3VHlwZSxcblx0XHRcdFx0dXJpOiBlZGl0b3IucmVzb3VyY2Vcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKGVkaXRvciBpbnN0YW5jZW9mIEN1c3RvbUVkaXRvcklucHV0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRraW5kOiBUYWJJbnB1dEtpbmQuQ3VzdG9tRWRpdG9ySW5wdXQsXG5cdFx0XHRcdHZpZXdUeXBlOiBlZGl0b3Iudmlld1R5cGUsXG5cdFx0XHRcdHVyaTogZWRpdG9yLnJlc291cmNlLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoZWRpdG9yIGluc3RhbmNlb2YgV2Vidmlld0lucHV0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRraW5kOiBUYWJJbnB1dEtpbmQuV2Vidmlld0VkaXRvcklucHV0LFxuXHRcdFx0XHR2aWV3VHlwZTogZWRpdG9yLnZpZXdUeXBlXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChlZGl0b3IgaW5zdGFuY2VvZiBUZXJtaW5hbEVkaXRvcklucHV0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRraW5kOiBUYWJJbnB1dEtpbmQuVGVybWluYWxFZGl0b3JJbnB1dFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoZWRpdG9yIGluc3RhbmNlb2YgRGlmZkVkaXRvcklucHV0KSB7XG5cdFx0XHRpZiAoZWRpdG9yLm1vZGlmaWVkIGluc3RhbmNlb2YgQWJzdHJhY3RUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCAmJiBlZGl0b3Iub3JpZ2luYWwgaW5zdGFuY2VvZiBBYnN0cmFjdFRleHRSZXNvdXJjZUVkaXRvcklucHV0KSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0a2luZDogVGFiSW5wdXRLaW5kLlRleHREaWZmSW5wdXQsXG5cdFx0XHRcdFx0bW9kaWZpZWQ6IGVkaXRvci5tb2RpZmllZC5yZXNvdXJjZSxcblx0XHRcdFx0XHRvcmlnaW5hbDogZWRpdG9yLm9yaWdpbmFsLnJlc291cmNlXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRpZiAoZWRpdG9yLm1vZGlmaWVkIGluc3RhbmNlb2YgTm90ZWJvb2tFZGl0b3JJbnB1dCAmJiBlZGl0b3Iub3JpZ2luYWwgaW5zdGFuY2VvZiBOb3RlYm9va0VkaXRvcklucHV0KSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0a2luZDogVGFiSW5wdXRLaW5kLk5vdGVib29rRGlmZklucHV0LFxuXHRcdFx0XHRcdG5vdGVib29rVHlwZTogZWRpdG9yLm9yaWdpbmFsLnZpZXdUeXBlLFxuXHRcdFx0XHRcdG1vZGlmaWVkOiBlZGl0b3IubW9kaWZpZWQucmVzb3VyY2UsXG5cdFx0XHRcdFx0b3JpZ2luYWw6IGVkaXRvci5vcmlnaW5hbC5yZXNvdXJjZVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChlZGl0b3IgaW5zdGFuY2VvZiBJbnRlcmFjdGl2ZUVkaXRvcklucHV0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRraW5kOiBUYWJJbnB1dEtpbmQuSW50ZXJhY3RpdmVFZGl0b3JJbnB1dCxcblx0XHRcdFx0dXJpOiBlZGl0b3IucmVzb3VyY2UsXG5cdFx0XHRcdGlucHV0Qm94VXJpOiBlZGl0b3IuaW5wdXRSZXNvdXJjZVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoZWRpdG9yIGluc3RhbmNlb2YgQ2hhdEVkaXRvcklucHV0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRraW5kOiBUYWJJbnB1dEtpbmQuQ2hhdEVkaXRvcklucHV0LFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoZWRpdG9yIGluc3RhbmNlb2YgTXVsdGlEaWZmRWRpdG9ySW5wdXQpIHtcblx0XHRcdGNvbnN0IGRpZmZFZGl0b3JzOiBUZXh0RGlmZklucHV0RHRvW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgcmVzb3VyY2Ugb2YgKGVkaXRvcj8ucmVzb3VyY2VzLmdldCgpID8/IFtdKSkge1xuXHRcdFx0XHRpZiAocmVzb3VyY2Uub3JpZ2luYWxVcmkgJiYgcmVzb3VyY2UubW9kaWZpZWRVcmkpIHtcblx0XHRcdFx0XHRkaWZmRWRpdG9ycy5wdXNoKHtcblx0XHRcdFx0XHRcdGtpbmQ6IFRhYklucHV0S2luZC5UZXh0RGlmZklucHV0LFxuXHRcdFx0XHRcdFx0b3JpZ2luYWw6IHJlc291cmNlLm9yaWdpbmFsVXJpLFxuXHRcdFx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLm1vZGlmaWVkVXJpXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0a2luZDogVGFiSW5wdXRLaW5kLk11bHRpRGlmZkVkaXRvcklucHV0LFxuXHRcdFx0XHRkaWZmRWRpdG9yc1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4geyBraW5kOiBUYWJJbnB1dEtpbmQuVW5rbm93bklucHV0IH07XG5cdH1cblxuXHQvKipcblx0ICogR2VuZXJhdGVzIGEgdW5pcXVlIGlkIGZvciBhIHRhYlxuXHQgKiBAcGFyYW0gZWRpdG9yIFRoZSBlZGl0b3IgaW5wdXRcblx0ICogQHBhcmFtIGdyb3VwSWQgVGhlIGdyb3VwIGlkXG5cdCAqIEByZXR1cm5zIEEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIGEgc3BlY2lmaWMgdGFiXG5cdCAqL1xuXHRwcml2YXRlIF9nZW5lcmF0ZVRhYklkKGVkaXRvcjogRWRpdG9ySW5wdXQsIGdyb3VwSWQ6IG51bWJlcikge1xuXHRcdGxldCByZXNvdXJjZVN0cmluZzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdC8vIFByb3Blcmx5IGdldCB0aGUgcmVzb3VyY2UgYW5kIGFjY291bnQgZm9yIHNpZGUgYnkgc2lkZSBlZGl0b3JzXG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldENhbm9uaWNhbFVyaShlZGl0b3IsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQk9USCB9KTtcblx0XHRpZiAocmVzb3VyY2UgaW5zdGFuY2VvZiBVUkkpIHtcblx0XHRcdHJlc291cmNlU3RyaW5nID0gcmVzb3VyY2UudG9TdHJpbmcoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzb3VyY2VTdHJpbmcgPSBgJHtyZXNvdXJjZT8ucHJpbWFyeT8udG9TdHJpbmcoKX0tJHtyZXNvdXJjZT8uc2Vjb25kYXJ5Py50b1N0cmluZygpfWA7XG5cdFx0fVxuXHRcdHJldHVybiBgJHtncm91cElkfX4ke2VkaXRvci5lZGl0b3JJZH0tJHtlZGl0b3IudHlwZUlkfS0ke3Jlc291cmNlU3RyaW5nfSBgO1xuXHR9XG5cblx0LyoqXG5cdCAqIENhbGxlZCB3aGVuZXZlciBhIGdyb3VwIGFjdGl2YXRlcywgdXBkYXRlcyB0aGUgbW9kZWwgYnkgbWFya2luZyB0aGUgZ3JvdXAgYXMgYWN0aXZlIGFuIG5vdGlmaWVzIHRoZSBleHRlbnNpb24gaG9zdFxuXHQgKi9cblx0cHJpdmF0ZSBfb25EaWRHcm91cEFjdGl2YXRlKCkge1xuXHRcdGNvbnN0IGFjdGl2ZUdyb3VwSWQgPSB0aGlzLl9lZGl0b3JHcm91cHNTZXJ2aWNlLmFjdGl2ZUdyb3VwLmlkO1xuXHRcdGNvbnN0IGFjdGl2ZUdyb3VwID0gdGhpcy5fZ3JvdXBMb29rdXAuZ2V0KGFjdGl2ZUdyb3VwSWQpO1xuXHRcdGlmIChhY3RpdmVHcm91cCkge1xuXHRcdFx0Ly8gT2sgbm90IHRvIGxvb3AgYXMgZXh0aG9zdCBhY2NlcHRzIGxhc3QgYWN0aXZlIGdyb3VwXG5cdFx0XHRhY3RpdmVHcm91cC5pc0FjdGl2ZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9wcm94eS4kYWNjZXB0VGFiR3JvdXBVcGRhdGUoYWN0aXZlR3JvdXApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBDYWxsZWQgd2hlbiB0aGUgdGFiIGxhYmVsIGNoYW5nZXNcblx0ICogQHBhcmFtIGdyb3VwSWQgVGhlIGlkIG9mIHRoZSBncm91cCB0aGUgdGFiIGV4aXN0cyBpblxuXHQgKiBAcGFyYW0gZWRpdG9ySW5wdXQgVGhlIGVkaXRvciBpbnB1dCByZXByZXNlbnRlZCBieSB0aGUgdGFiXG5cdCAqL1xuXHRwcml2YXRlIF9vbkRpZFRhYkxhYmVsQ2hhbmdlKGdyb3VwSWQ6IG51bWJlciwgZWRpdG9ySW5wdXQ6IEVkaXRvcklucHV0LCBlZGl0b3JJbmRleDogbnVtYmVyKSB7XG5cdFx0Y29uc3QgdGFiSWQgPSB0aGlzLl9nZW5lcmF0ZVRhYklkKGVkaXRvcklucHV0LCBncm91cElkKTtcblx0XHRjb25zdCB0YWJJbmZvID0gdGhpcy5fdGFiSW5mb0xvb2t1cC5nZXQodGFiSWQpO1xuXHRcdC8vIElmIHRhYiBpcyBmb3VuZCBwYXRjaCwgZWxzZSByZWJ1aWxkXG5cdFx0aWYgKHRhYkluZm8pIHtcblx0XHRcdHRhYkluZm8udGFiLmxhYmVsID0gZWRpdG9ySW5wdXQuZ2V0TmFtZSgpO1xuXHRcdFx0dGhpcy5fcHJveHkuJGFjY2VwdFRhYk9wZXJhdGlvbih7XG5cdFx0XHRcdGdyb3VwSWQsXG5cdFx0XHRcdGluZGV4OiBlZGl0b3JJbmRleCxcblx0XHRcdFx0dGFiRHRvOiB0YWJJbmZvLnRhYixcblx0XHRcdFx0a2luZDogVGFiTW9kZWxPcGVyYXRpb25LaW5kLlRBQl9VUERBVEVcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKCdJbnZhbGlkIG1vZGVsIGZvciBsYWJlbCBjaGFuZ2UsIHJlYnVpbGRpbmcnKTtcblx0XHRcdHRoaXMuX2NyZWF0ZVRhYnNNb2RlbCgpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBDYWxsZWQgd2hlbiBhIG5ldyB0YWIgaXMgb3BlbmVkXG5cdCAqIEBwYXJhbSBncm91cElkIFRoZSBpZCBvZiB0aGUgZ3JvdXAgdGhlIHRhYiBpcyBiZWluZyBjcmVhdGVkIGluXG5cdCAqIEBwYXJhbSBlZGl0b3JJbnB1dCBUaGUgZWRpdG9yIGlucHV0IGJlaW5nIG9wZW5lZFxuXHQgKiBAcGFyYW0gZWRpdG9ySW5kZXggVGhlIGluZGV4IG9mIHRoZSBlZGl0b3Igd2l0aGluIHRoYXQgZ3JvdXBcblx0ICovXG5cdHByaXZhdGUgX29uRGlkVGFiT3Blbihncm91cElkOiBudW1iZXIsIGVkaXRvcklucHV0OiBFZGl0b3JJbnB1dCwgZWRpdG9ySW5kZXg6IG51bWJlcikge1xuXHRcdGNvbnN0IGdyb3VwID0gdGhpcy5fZWRpdG9yR3JvdXBzU2VydmljZS5nZXRHcm91cChncm91cElkKTtcblx0XHQvLyBFdmVuIGlmIHRoZSBlZGl0b3Igc2VydmljZSBrbm93cyBhYm91dCB0aGUgZ3JvdXAgdGhlIGdyb3VwIG1pZ2h0IG5vdCBleGlzdCB5ZXQgaW4gb3VyIG1vZGVsXG5cdFx0Y29uc3QgZ3JvdXBJbk1vZGVsID0gdGhpcy5fZ3JvdXBMb29rdXAuZ2V0KGdyb3VwSWQpICE9PSB1bmRlZmluZWQ7XG5cdFx0Ly8gTWVhbnMgYSBuZXcgZ3JvdXAgd2FzIGxpa2VseSBjcmVhdGVkIHNvIHdlIHJlYnVpbGQgdGhlIG1vZGVsXG5cdFx0aWYgKCFncm91cCB8fCAhZ3JvdXBJbk1vZGVsKSB7XG5cdFx0XHR0aGlzLl9jcmVhdGVUYWJzTW9kZWwoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgdGFicyA9IHRoaXMuX2dyb3VwTG9va3VwLmdldChncm91cElkKT8udGFicztcblx0XHRpZiAoIXRhYnMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gU3BsaWNlIHRhYiBpbnRvIGdyb3VwIGF0IGluZGV4IGVkaXRvckluZGV4XG5cdFx0Y29uc3QgdGFiT2JqZWN0ID0gdGhpcy5fYnVpbGRUYWJPYmplY3QoZ3JvdXAsIGVkaXRvcklucHV0LCBlZGl0b3JJbmRleCk7XG5cdFx0dGFicy5zcGxpY2UoZWRpdG9ySW5kZXgsIDAsIHRhYk9iamVjdCk7XG5cdFx0Ly8gVXBkYXRlIGxvb2t1cFxuXHRcdGNvbnN0IHRhYklkID0gdGhpcy5fZ2VuZXJhdGVUYWJJZChlZGl0b3JJbnB1dCwgZ3JvdXBJZCk7XG5cdFx0dGhpcy5fdGFiSW5mb0xvb2t1cC5zZXQodGFiSWQsIHsgZ3JvdXAsIGVkaXRvcklucHV0LCB0YWI6IHRhYk9iamVjdCB9KTtcblxuXHRcdGlmIChlZGl0b3JJbnB1dCBpbnN0YW5jZW9mIE11bHRpRGlmZkVkaXRvcklucHV0KSB7XG5cdFx0XHR0aGlzLl9tdWx0aURpZmZFZGl0b3JJbnB1dExpc3RlbmVycy5zZXQoZWRpdG9ySW5wdXQsIEV2ZW50LmZyb21PYnNlcnZhYmxlTGlnaHQoZWRpdG9ySW5wdXQucmVzb3VyY2VzKSgoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRhYkluZm8gPSB0aGlzLl90YWJJbmZvTG9va3VwLmdldCh0YWJJZCk7XG5cdFx0XHRcdGlmICghdGFiSW5mbykge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0YWJJbmZvLnRhYiA9IHRoaXMuX2J1aWxkVGFiT2JqZWN0KGdyb3VwLCBlZGl0b3JJbnB1dCwgZWRpdG9ySW5kZXgpO1xuXHRcdFx0XHR0aGlzLl9wcm94eS4kYWNjZXB0VGFiT3BlcmF0aW9uKHtcblx0XHRcdFx0XHRncm91cElkLFxuXHRcdFx0XHRcdGluZGV4OiBlZGl0b3JJbmRleCxcblx0XHRcdFx0XHR0YWJEdG86IHRhYkluZm8udGFiLFxuXHRcdFx0XHRcdGtpbmQ6IFRhYk1vZGVsT3BlcmF0aW9uS2luZC5UQUJfVVBEQVRFXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3Byb3h5LiRhY2NlcHRUYWJPcGVyYXRpb24oe1xuXHRcdFx0Z3JvdXBJZCxcblx0XHRcdGluZGV4OiBlZGl0b3JJbmRleCxcblx0XHRcdHRhYkR0bzogdGFiT2JqZWN0LFxuXHRcdFx0a2luZDogVGFiTW9kZWxPcGVyYXRpb25LaW5kLlRBQl9PUEVOXG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogQ2FsbGVkIHdoZW4gYSB0YWIgaXMgY2xvc2VkXG5cdCAqIEBwYXJhbSBncm91cElkIFRoZSBpZCBvZiB0aGUgZ3JvdXAgdGhlIHRhYiBpcyBiZWluZyByZW1vdmVkIGZyb21cblx0ICogQHBhcmFtIGVkaXRvckluZGV4IFRoZSBpbmRleCBvZiB0aGUgZWRpdG9yIHdpdGhpbiB0aGF0IGdyb3VwXG5cdCAqL1xuXHRwcml2YXRlIF9vbkRpZFRhYkNsb3NlKGdyb3VwSWQ6IG51bWJlciwgZWRpdG9ySW5kZXg6IG51bWJlcikge1xuXHRcdGNvbnN0IGdyb3VwID0gdGhpcy5fZWRpdG9yR3JvdXBzU2VydmljZS5nZXRHcm91cChncm91cElkKTtcblx0XHRjb25zdCB0YWJzID0gdGhpcy5fZ3JvdXBMb29rdXAuZ2V0KGdyb3VwSWQpPy50YWJzO1xuXHRcdC8vIFNvbWV0aGluZyBpcyB3cm9uZyB3aXRoIHRoZSBtb2RlbCBzdGF0ZSBzbyB3ZSByZWJ1aWxkXG5cdFx0aWYgKCFncm91cCB8fCAhdGFicykge1xuXHRcdFx0dGhpcy5fY3JlYXRlVGFic01vZGVsKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIFNwbGljZSB0YWIgaW50byBncm91cCBhdCBpbmRleCBlZGl0b3JJbmRleFxuXHRcdGNvbnN0IHJlbW92ZWRUYWIgPSB0YWJzLnNwbGljZShlZGl0b3JJbmRleCwgMSk7XG5cblx0XHQvLyBJbmRleCBtdXN0IG5vIGxvbmdlciBiZSB2YWxpZCBzbyB3ZSByZXR1cm4gcHJlbWF0dXJlbHlcblx0XHRpZiAocmVtb3ZlZFRhYi5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgbG9va3VwXG5cdFx0dGhpcy5fdGFiSW5mb0xvb2t1cC5kZWxldGUocmVtb3ZlZFRhYlswXT8uaWQgPz8gJycpO1xuXG5cdFx0aWYgKHJlbW92ZWRUYWJbMF0/LmlucHV0IGluc3RhbmNlb2YgTXVsdGlEaWZmRWRpdG9ySW5wdXQpIHtcblx0XHRcdHRoaXMuX211bHRpRGlmZkVkaXRvcklucHV0TGlzdGVuZXJzLmRlbGV0ZUFuZERpc3Bvc2UocmVtb3ZlZFRhYlswXT8uaW5wdXQpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3Byb3h5LiRhY2NlcHRUYWJPcGVyYXRpb24oe1xuXHRcdFx0Z3JvdXBJZCxcblx0XHRcdGluZGV4OiBlZGl0b3JJbmRleCxcblx0XHRcdHRhYkR0bzogcmVtb3ZlZFRhYlswXSxcblx0XHRcdGtpbmQ6IFRhYk1vZGVsT3BlcmF0aW9uS2luZC5UQUJfQ0xPU0Vcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDYWxsZWQgd2hlbiB0aGUgYWN0aXZlIHRhYiBjaGFuZ2VzXG5cdCAqIEBwYXJhbSBncm91cElkIFRoZSBpZCBvZiB0aGUgZ3JvdXAgdGhlIHRhYiBpcyBjb250YWluZWQgaW5cblx0ICogQHBhcmFtIGVkaXRvckluZGV4IFRoZSBpbmRleCBvZiB0aGUgdGFiXG5cdCAqL1xuXHRwcml2YXRlIF9vbkRpZFRhYkFjdGl2ZUNoYW5nZShncm91cElkOiBudW1iZXIsIGVkaXRvckluZGV4OiBudW1iZXIpIHtcblx0XHQvLyBUT0RPIEBscmFtb3MxNSB1c2UgdGhlIHRhYiBsb29rdXAgaGVyZSBpZiBwb3NzaWJsZS4gRG8gd2UgaGF2ZSBhbiBlZGl0b3IgaW5wdXQ/IVxuXHRcdGNvbnN0IHRhYnMgPSB0aGlzLl9ncm91cExvb2t1cC5nZXQoZ3JvdXBJZCk/LnRhYnM7XG5cdFx0aWYgKCF0YWJzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGFjdGl2ZVRhYiA9IHRhYnNbZWRpdG9ySW5kZXhdO1xuXHRcdC8vIE5vIG5lZWQgdG8gbG9vcCBvdmVyIGFzIHRoZSBleHRob3N0IHVzZXMgdGhlIG1vc3QgcmVjZW50bHkgbWFya2VkIGFjdGl2ZSB0YWJcblx0XHRhY3RpdmVUYWIuaXNBY3RpdmUgPSB0cnVlO1xuXHRcdC8vIFNlbmQgRFRPIHVwZGF0ZSB0byB0aGUgZXh0aG9zdFxuXHRcdHRoaXMuX3Byb3h5LiRhY2NlcHRUYWJPcGVyYXRpb24oe1xuXHRcdFx0Z3JvdXBJZCxcblx0XHRcdGluZGV4OiBlZGl0b3JJbmRleCxcblx0XHRcdHRhYkR0bzogYWN0aXZlVGFiLFxuXHRcdFx0a2luZDogVGFiTW9kZWxPcGVyYXRpb25LaW5kLlRBQl9VUERBVEVcblx0XHR9KTtcblxuXHR9XG5cblx0LyoqXG5cdCAqIENhbGxlZCB3aGVuIHRoZSBkaXJ0eSBpbmRpY2F0b3Igb24gdGhlIHRhYiBjaGFuZ2VzXG5cdCAqIEBwYXJhbSBncm91cElkIFRoZSBpZCBvZiB0aGUgZ3JvdXAgdGhlIHRhYiBpcyBpblxuXHQgKiBAcGFyYW0gZWRpdG9ySW5kZXggVGhlIGluZGV4IG9mIHRoZSB0YWJcblx0ICogQHBhcmFtIGVkaXRvciBUaGUgZWRpdG9yIGlucHV0IHJlcHJlc2VudGVkIGJ5IHRoZSB0YWJcblx0ICovXG5cdHByaXZhdGUgX29uRGlkVGFiRGlydHkoZ3JvdXBJZDogbnVtYmVyLCBlZGl0b3JJbmRleDogbnVtYmVyLCBlZGl0b3I6IEVkaXRvcklucHV0KSB7XG5cdFx0Y29uc3QgdGFiSWQgPSB0aGlzLl9nZW5lcmF0ZVRhYklkKGVkaXRvciwgZ3JvdXBJZCk7XG5cdFx0Y29uc3QgdGFiSW5mbyA9IHRoaXMuX3RhYkluZm9Mb29rdXAuZ2V0KHRhYklkKTtcblx0XHQvLyBTb21ldGhpbmcgd3Jvbmcgd2l0aCB0aGUgbW9kZWwgc3RhdGUgc28gd2UgcmVidWlsZFxuXHRcdGlmICghdGFiSW5mbykge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcignSW52YWxpZCBtb2RlbCBmb3IgZGlydHkgY2hhbmdlLCByZWJ1aWxkaW5nJyk7XG5cdFx0XHR0aGlzLl9jcmVhdGVUYWJzTW9kZWwoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGFiSW5mby50YWIuaXNEaXJ0eSA9IGVkaXRvci5pc0RpcnR5KCk7XG5cdFx0dGhpcy5fcHJveHkuJGFjY2VwdFRhYk9wZXJhdGlvbih7XG5cdFx0XHRncm91cElkLFxuXHRcdFx0aW5kZXg6IGVkaXRvckluZGV4LFxuXHRcdFx0dGFiRHRvOiB0YWJJbmZvLnRhYixcblx0XHRcdGtpbmQ6IFRhYk1vZGVsT3BlcmF0aW9uS2luZC5UQUJfVVBEQVRFXG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogQ2FsbGVkIHdoZW4gdGhlIHRhYiBpcyBwaW5uZWQvdW5waW5uZWRcblx0ICogQHBhcmFtIGdyb3VwSWQgVGhlIGlkIG9mIHRoZSBncm91cCB0aGUgdGFiIGlzIGluXG5cdCAqIEBwYXJhbSBlZGl0b3JJbmRleCBUaGUgaW5kZXggb2YgdGhlIHRhYlxuXHQgKiBAcGFyYW0gZWRpdG9yIFRoZSBlZGl0b3IgaW5wdXQgcmVwcmVzZW50ZWQgYnkgdGhlIHRhYlxuXHQgKi9cblx0cHJpdmF0ZSBfb25EaWRUYWJQaW5DaGFuZ2UoZ3JvdXBJZDogbnVtYmVyLCBlZGl0b3JJbmRleDogbnVtYmVyLCBlZGl0b3I6IEVkaXRvcklucHV0KSB7XG5cdFx0Y29uc3QgdGFiSWQgPSB0aGlzLl9nZW5lcmF0ZVRhYklkKGVkaXRvciwgZ3JvdXBJZCk7XG5cdFx0Y29uc3QgdGFiSW5mbyA9IHRoaXMuX3RhYkluZm9Mb29rdXAuZ2V0KHRhYklkKTtcblx0XHRjb25zdCBncm91cCA9IHRhYkluZm8/Lmdyb3VwO1xuXHRcdGNvbnN0IHRhYiA9IHRhYkluZm8/LnRhYjtcblx0XHQvLyBTb21ldGhpbmcgd3Jvbmcgd2l0aCB0aGUgbW9kZWwgc3RhdGUgc28gd2UgcmVidWlsZFxuXHRcdGlmICghZ3JvdXAgfHwgIXRhYikge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcignSW52YWxpZCBtb2RlbCBmb3Igc3RpY2t5IGNoYW5nZSwgcmVidWlsZGluZycpO1xuXHRcdFx0dGhpcy5fY3JlYXRlVGFic01vZGVsKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIFdoZXRoZXIgb3Igbm90IHRoZSB0YWIgaGFzIHRoZSBwaW4gaWNvbiAoaW50ZXJuYWxseSBpdCdzIGNhbGxlZCBzdGlja3kpXG5cdFx0dGFiLmlzUGlubmVkID0gZ3JvdXAuaXNTdGlja3koZWRpdG9ySW5kZXgpO1xuXHRcdHRoaXMuX3Byb3h5LiRhY2NlcHRUYWJPcGVyYXRpb24oe1xuXHRcdFx0Z3JvdXBJZCxcblx0XHRcdGluZGV4OiBlZGl0b3JJbmRleCxcblx0XHRcdHRhYkR0bzogdGFiLFxuXHRcdFx0a2luZDogVGFiTW9kZWxPcGVyYXRpb25LaW5kLlRBQl9VUERBVEVcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuICogQ2FsbGVkIHdoZW4gdGhlIHRhYiBpcyBwcmV2aWV3IC8gdW5wcmV2aWV3ZWRcbiAqIEBwYXJhbSBncm91cElkIFRoZSBpZCBvZiB0aGUgZ3JvdXAgdGhlIHRhYiBpcyBpblxuICogQHBhcmFtIGVkaXRvckluZGV4IFRoZSBpbmRleCBvZiB0aGUgdGFiXG4gKiBAcGFyYW0gZWRpdG9yIFRoZSBlZGl0b3IgaW5wdXQgcmVwcmVzZW50ZWQgYnkgdGhlIHRhYlxuICovXG5cdHByaXZhdGUgX29uRGlkVGFiUHJldmlld0NoYW5nZShncm91cElkOiBudW1iZXIsIGVkaXRvckluZGV4OiBudW1iZXIsIGVkaXRvcjogRWRpdG9ySW5wdXQpIHtcblx0XHRjb25zdCB0YWJJZCA9IHRoaXMuX2dlbmVyYXRlVGFiSWQoZWRpdG9yLCBncm91cElkKTtcblx0XHRjb25zdCB0YWJJbmZvID0gdGhpcy5fdGFiSW5mb0xvb2t1cC5nZXQodGFiSWQpO1xuXHRcdGNvbnN0IGdyb3VwID0gdGFiSW5mbz8uZ3JvdXA7XG5cdFx0Y29uc3QgdGFiID0gdGFiSW5mbz8udGFiO1xuXHRcdC8vIFNvbWV0aGluZyB3cm9uZyB3aXRoIHRoZSBtb2RlbCBzdGF0ZSBzbyB3ZSByZWJ1aWxkXG5cdFx0aWYgKCFncm91cCB8fCAhdGFiKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKCdJbnZhbGlkIG1vZGVsIGZvciBzdGlja3kgY2hhbmdlLCByZWJ1aWxkaW5nJyk7XG5cdFx0XHR0aGlzLl9jcmVhdGVUYWJzTW9kZWwoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gV2hldGhlciBvciBub3QgdGhlIHRhYiBoYXMgdGhlIHBpbiBpY29uIChpbnRlcm5hbGx5IGl0J3MgY2FsbGVkIHBpbm5lZClcblx0XHR0YWIuaXNQcmV2aWV3ID0gIWdyb3VwLmlzUGlubmVkKGVkaXRvckluZGV4KTtcblx0XHR0aGlzLl9wcm94eS4kYWNjZXB0VGFiT3BlcmF0aW9uKHtcblx0XHRcdGtpbmQ6IFRhYk1vZGVsT3BlcmF0aW9uS2luZC5UQUJfVVBEQVRFLFxuXHRcdFx0Z3JvdXBJZCxcblx0XHRcdHRhYkR0bzogdGFiLFxuXHRcdFx0aW5kZXg6IGVkaXRvckluZGV4XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkRpZFRhYk1vdmUoZ3JvdXBJZDogbnVtYmVyLCBlZGl0b3JJbmRleDogbnVtYmVyLCBvbGRFZGl0b3JJbmRleDogbnVtYmVyLCBlZGl0b3I6IEVkaXRvcklucHV0KSB7XG5cdFx0Y29uc3QgdGFicyA9IHRoaXMuX2dyb3VwTG9va3VwLmdldChncm91cElkKT8udGFicztcblx0XHQvLyBTb21ldGhpbmcgd3Jvbmcgd2l0aCB0aGUgbW9kZWwgc3RhdGUgc28gd2UgcmVidWlsZFxuXHRcdGlmICghdGFicykge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcignSW52YWxpZCBtb2RlbCBmb3IgbW92ZSBjaGFuZ2UsIHJlYnVpbGRpbmcnKTtcblx0XHRcdHRoaXMuX2NyZWF0ZVRhYnNNb2RlbCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIE1vdmUgdGFiIGZyb20gb2xkIGluZGV4IHRvIG5ldyBpbmRleFxuXHRcdGNvbnN0IHJlbW92ZWRUYWIgPSB0YWJzLnNwbGljZShvbGRFZGl0b3JJbmRleCwgMSk7XG5cdFx0aWYgKHJlbW92ZWRUYWIubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRhYnMuc3BsaWNlKGVkaXRvckluZGV4LCAwLCByZW1vdmVkVGFiWzBdKTtcblxuXHRcdC8vIE5vdGlmeSBleHRob3N0IG9mIG1vdmVcblx0XHR0aGlzLl9wcm94eS4kYWNjZXB0VGFiT3BlcmF0aW9uKHtcblx0XHRcdGtpbmQ6IFRhYk1vZGVsT3BlcmF0aW9uS2luZC5UQUJfTU9WRSxcblx0XHRcdGdyb3VwSWQsXG5cdFx0XHR0YWJEdG86IHJlbW92ZWRUYWJbMF0sXG5cdFx0XHRpbmRleDogZWRpdG9ySW5kZXgsXG5cdFx0XHRvbGRJbmRleDogb2xkRWRpdG9ySW5kZXhcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBCdWlsZHMgdGhlIG1vZGVsIGZyb20gc2NyYXRjaCBiYXNlZCBvbiB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgZWRpdG9yIHNlcnZpY2UuXG5cdCAqL1xuXHRwcml2YXRlIF9jcmVhdGVUYWJzTW9kZWwoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2VkaXRvckdyb3Vwc1NlcnZpY2UuZ3JvdXBzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuOyAvLyBza2lwIHRoaXMgaW52YWxpZCBzdGF0ZSwgaXQgbWF5IGhhcHBlbiB3aGVuIHRoZSBlbnRpcmUgZWRpdG9yIGFyZWEgaXMgdHJhbnNpdGlvbmluZyB0byBvdGhlciBzdGF0ZSAoXCJlZGl0b3Igd29ya2luZyBzZXRzXCIpXG5cdFx0fVxuXG5cdFx0dGhpcy5fdGFiR3JvdXBNb2RlbCA9IFtdO1xuXHRcdHRoaXMuX2dyb3VwTG9va3VwLmNsZWFyKCk7XG5cdFx0dGhpcy5fdGFiSW5mb0xvb2t1cC5jbGVhcigpO1xuXHRcdGxldCB0YWJzOiBJRWRpdG9yVGFiRHRvW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGdyb3VwIG9mIHRoaXMuX2VkaXRvckdyb3Vwc1NlcnZpY2UuZ3JvdXBzKSB7XG5cdFx0XHRjb25zdCBjdXJyZW50VGFiR3JvdXBNb2RlbDogSUVkaXRvclRhYkdyb3VwRHRvID0ge1xuXHRcdFx0XHRncm91cElkOiBncm91cC5pZCxcblx0XHRcdFx0aXNBY3RpdmU6IGdyb3VwLmlkID09PSB0aGlzLl9lZGl0b3JHcm91cHNTZXJ2aWNlLmFjdGl2ZUdyb3VwLmlkLFxuXHRcdFx0XHR2aWV3Q29sdW1uOiBlZGl0b3JHcm91cFRvQ29sdW1uKHRoaXMuX2VkaXRvckdyb3Vwc1NlcnZpY2UsIGdyb3VwKSxcblx0XHRcdFx0dGFiczogW11cblx0XHRcdH07XG5cdFx0XHRncm91cC5lZGl0b3JzLmZvckVhY2goKGVkaXRvciwgZWRpdG9ySW5kZXgpID0+IHtcblx0XHRcdFx0Y29uc3QgdGFiID0gdGhpcy5fYnVpbGRUYWJPYmplY3QoZ3JvdXAsIGVkaXRvciwgZWRpdG9ySW5kZXgpO1xuXHRcdFx0XHR0YWJzLnB1c2godGFiKTtcblx0XHRcdFx0Ly8gQWRkIGluZm9ybWF0aW9uIGFib3V0IHRoZSB0YWIgdG8gdGhlIGxvb2t1cFxuXHRcdFx0XHR0aGlzLl90YWJJbmZvTG9va3VwLnNldCh0aGlzLl9nZW5lcmF0ZVRhYklkKGVkaXRvciwgZ3JvdXAuaWQpLCB7XG5cdFx0XHRcdFx0Z3JvdXAsXG5cdFx0XHRcdFx0dGFiLFxuXHRcdFx0XHRcdGVkaXRvcklucHV0OiBlZGl0b3Jcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdGN1cnJlbnRUYWJHcm91cE1vZGVsLnRhYnMgPSB0YWJzO1xuXHRcdFx0dGhpcy5fdGFiR3JvdXBNb2RlbC5wdXNoKGN1cnJlbnRUYWJHcm91cE1vZGVsKTtcblx0XHRcdHRoaXMuX2dyb3VwTG9va3VwLnNldChncm91cC5pZCwgY3VycmVudFRhYkdyb3VwTW9kZWwpO1xuXHRcdFx0dGFicyA9IFtdO1xuXHRcdH1cblx0XHQvLyBub3RpZnkgdGhlIGV4dCBob3N0IG9mIHRoZSBuZXcgbW9kZWxcblx0XHR0aGlzLl9wcm94eS4kYWNjZXB0RWRpdG9yVGFiTW9kZWwodGhpcy5fdGFiR3JvdXBNb2RlbCk7XG5cdH1cblxuXHQvLyBUT0RPRCBAbHJhbW9zMTUgUmVtb3ZlIHRoaXMgYWZ0ZXIgZG9uZSBmaW5pc2hpbmcgdGhlIHRhYiBtb2RlbCBjb2RlXG5cdC8vIHByaXZhdGUgX2V2ZW50VG9TdHJpbmcoZXZlbnQ6IElFZGl0b3JzQ2hhbmdlRXZlbnQgfCBJRWRpdG9yc01vdmVFdmVudCk6IHN0cmluZyB7XG5cdC8vIFx0bGV0IGV2ZW50U3RyaW5nID0gJyc7XG5cdC8vIFx0c3dpdGNoIChldmVudC5raW5kKSB7XG5cdC8vIFx0XHRjYXNlIEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkdST1VQX0lOREVYOiBldmVudFN0cmluZyArPSAnR1JPVVBfSU5ERVgnOyBicmVhaztcblx0Ly8gXHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0FDVElWRTogZXZlbnRTdHJpbmcgKz0gJ0VESVRPUl9BQ1RJVkUnOyBicmVhaztcblx0Ly8gXHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX1BJTjogZXZlbnRTdHJpbmcgKz0gJ0VESVRPUl9QSU4nOyBicmVhaztcblx0Ly8gXHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX09QRU46IGV2ZW50U3RyaW5nICs9ICdFRElUT1JfT1BFTic7IGJyZWFrO1xuXHQvLyBcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfQ0xPU0U6IGV2ZW50U3RyaW5nICs9ICdFRElUT1JfQ0xPU0UnOyBicmVhaztcblx0Ly8gXHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX01PVkU6IGV2ZW50U3RyaW5nICs9ICdFRElUT1JfTU9WRSc7IGJyZWFrO1xuXHQvLyBcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfTEFCRUw6IGV2ZW50U3RyaW5nICs9ICdFRElUT1JfTEFCRUwnOyBicmVhaztcblx0Ly8gXHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuR1JPVVBfQUNUSVZFOiBldmVudFN0cmluZyArPSAnR1JPVVBfQUNUSVZFJzsgYnJlYWs7XG5cdC8vIFx0XHRjYXNlIEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkdST1VQX0xPQ0tFRDogZXZlbnRTdHJpbmcgKz0gJ0dST1VQX0xPQ0tFRCc7IGJyZWFrO1xuXHQvLyBcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfRElSVFk6IGV2ZW50U3RyaW5nICs9ICdFRElUT1JfRElSVFknOyBicmVhaztcblx0Ly8gXHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX1NUSUNLWTogZXZlbnRTdHJpbmcgKz0gJ0VESVRPUl9TVElDS1knOyBicmVhaztcblx0Ly8gXHRcdGRlZmF1bHQ6IGV2ZW50U3RyaW5nICs9IGBVTktOT1dOOiAke2V2ZW50LmtpbmR9YDsgYnJlYWs7XG5cdC8vIFx0fVxuXHQvLyBcdHJldHVybiBldmVudFN0cmluZztcblx0Ly8gfVxuXG5cdC8qKlxuXHQgKiBUaGUgbWFpbiBoYW5kbGVyIGZvciB0aGUgdGFiIGV2ZW50c1xuXHQgKiBAcGFyYW0gZXZlbnRzIFRoZSBsaXN0IG9mIGV2ZW50cyB0byBwcm9jZXNzXG5cdCAqL1xuXHRwcml2YXRlIF91cGRhdGVUYWJzTW9kZWwoY2hhbmdlRXZlbnQ6IElFZGl0b3JzQ2hhbmdlRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBldmVudCA9IGNoYW5nZUV2ZW50LmV2ZW50O1xuXHRcdGNvbnN0IGdyb3VwSWQgPSBjaGFuZ2VFdmVudC5ncm91cElkO1xuXHRcdHN3aXRjaCAoZXZlbnQua2luZCkge1xuXHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5HUk9VUF9BQ1RJVkU6XG5cdFx0XHRcdGlmIChncm91cElkID09PSB0aGlzLl9lZGl0b3JHcm91cHNTZXJ2aWNlLmFjdGl2ZUdyb3VwLmlkKSB7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRHcm91cEFjdGl2YXRlKCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRjYXNlIEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9MQUJFTDpcblx0XHRcdFx0aWYgKGV2ZW50LmVkaXRvciAhPT0gdW5kZWZpbmVkICYmIGV2ZW50LmVkaXRvckluZGV4ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZFRhYkxhYmVsQ2hhbmdlKGdyb3VwSWQsIGV2ZW50LmVkaXRvciwgZXZlbnQuZWRpdG9ySW5kZXgpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRjYXNlIEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9PUEVOOlxuXHRcdFx0XHRpZiAoZXZlbnQuZWRpdG9yICE9PSB1bmRlZmluZWQgJiYgZXZlbnQuZWRpdG9ySW5kZXggIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkVGFiT3Blbihncm91cElkLCBldmVudC5lZGl0b3IsIGV2ZW50LmVkaXRvckluZGV4KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfQ0xPU0U6XG5cdFx0XHRcdGlmIChldmVudC5lZGl0b3JJbmRleCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRUYWJDbG9zZShncm91cElkLCBldmVudC5lZGl0b3JJbmRleCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0FDVElWRTpcblx0XHRcdFx0aWYgKGV2ZW50LmVkaXRvckluZGV4ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZFRhYkFjdGl2ZUNoYW5nZShncm91cElkLCBldmVudC5lZGl0b3JJbmRleCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0RJUlRZOlxuXHRcdFx0XHRpZiAoZXZlbnQuZWRpdG9ySW5kZXggIT09IHVuZGVmaW5lZCAmJiBldmVudC5lZGl0b3IgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkVGFiRGlydHkoZ3JvdXBJZCwgZXZlbnQuZWRpdG9ySW5kZXgsIGV2ZW50LmVkaXRvcik7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX1NUSUNLWTpcblx0XHRcdFx0aWYgKGV2ZW50LmVkaXRvckluZGV4ICE9PSB1bmRlZmluZWQgJiYgZXZlbnQuZWRpdG9yICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZFRhYlBpbkNoYW5nZShncm91cElkLCBldmVudC5lZGl0b3JJbmRleCwgZXZlbnQuZWRpdG9yKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfUElOOlxuXHRcdFx0XHRpZiAoZXZlbnQuZWRpdG9ySW5kZXggIT09IHVuZGVmaW5lZCAmJiBldmVudC5lZGl0b3IgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkVGFiUHJldmlld0NoYW5nZShncm91cElkLCBldmVudC5lZGl0b3JJbmRleCwgZXZlbnQuZWRpdG9yKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfVFJBTlNJRU5UOlxuXHRcdFx0XHQvLyBDdXJyZW50bHkgbm90IGV4cG9zZWQgaW4gdGhlIEFQSVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX01PVkU6XG5cdFx0XHRcdGlmIChpc0dyb3VwRWRpdG9yTW92ZUV2ZW50KGV2ZW50KSAmJiBldmVudC5lZGl0b3IgJiYgZXZlbnQuZWRpdG9ySW5kZXggIT09IHVuZGVmaW5lZCAmJiBldmVudC5vbGRFZGl0b3JJbmRleCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRUYWJNb3ZlKGdyb3VwSWQsIGV2ZW50LmVkaXRvckluZGV4LCBldmVudC5vbGRFZGl0b3JJbmRleCwgZXZlbnQuZWRpdG9yKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0Ly8gSWYgaXQncyBub3QgYW4gb3B0aW1pemVkIGNhc2Ugd2UgcmVidWlsZCB0aGUgdGFicyBtb2RlbCBmcm9tIHNjcmF0Y2hcblx0XHRcdFx0dGhpcy5fY3JlYXRlVGFic01vZGVsKCk7XG5cdFx0fVxuXHR9XG5cdC8vI3JlZ2lvbiBNZXNzYWdlcyByZWNlaXZlZCBmcm9tIEV4dCBIb3N0XG5cdCRtb3ZlVGFiKHRhYklkOiBzdHJpbmcsIGluZGV4OiBudW1iZXIsIHZpZXdDb2x1bW46IEVkaXRvckdyb3VwQ29sdW1uLCBwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IGdyb3VwSWQgPSBjb2x1bW5Ub0VkaXRvckdyb3VwKHRoaXMuX2VkaXRvckdyb3Vwc1NlcnZpY2UsIHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLCB2aWV3Q29sdW1uKTtcblx0XHRjb25zdCB0YWJJbmZvID0gdGhpcy5fdGFiSW5mb0xvb2t1cC5nZXQodGFiSWQpO1xuXHRcdGNvbnN0IHRhYiA9IHRhYkluZm8/LnRhYjtcblx0XHRpZiAoIXRhYikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBBdHRlbXB0ZWQgdG8gY2xvc2UgdGFiIHdpdGggaWQgJHt0YWJJZH0gd2hpY2ggZG9lcyBub3QgZXhpc3RgKTtcblx0XHR9XG5cdFx0bGV0IHRhcmdldEdyb3VwOiBJRWRpdG9yR3JvdXAgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3Qgc291cmNlR3JvdXAgPSB0aGlzLl9lZGl0b3JHcm91cHNTZXJ2aWNlLmdldEdyb3VwKHRhYkluZm8uZ3JvdXAuaWQpO1xuXHRcdGlmICghc291cmNlR3JvdXApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gSWYgZ3JvdXAgaW5kZXggaXMgb3V0IG9mIGJvdW5kcyB0aGVuIHdlIG1ha2UgYSBuZXcgb25lIHRoYXQncyB0byB0aGUgcmlnaHQgb2YgdGhlIGxhc3QgZ3JvdXBcblx0XHRpZiAodGhpcy5fZ3JvdXBMb29rdXAuZ2V0KGdyb3VwSWQpID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGxldCBkaXJlY3Rpb24gPSBHcm91cERpcmVjdGlvbi5SSUdIVDtcblx0XHRcdC8vIE1ha2Ugc3VyZSB3ZSByZXNwZWN0IHRoZSB1c2VyJ3MgcHJlZmVycmVkIHNpZGUgZGlyZWN0aW9uXG5cdFx0XHRpZiAodmlld0NvbHVtbiA9PT0gU0lERV9HUk9VUCkge1xuXHRcdFx0XHRkaXJlY3Rpb24gPSBwcmVmZXJyZWRTaWRlQnlTaWRlR3JvdXBEaXJlY3Rpb24odGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdFx0fVxuXHRcdFx0dGFyZ2V0R3JvdXAgPSB0aGlzLl9lZGl0b3JHcm91cHNTZXJ2aWNlLmFkZEdyb3VwKHRoaXMuX2VkaXRvckdyb3Vwc1NlcnZpY2UuZ3JvdXBzW3RoaXMuX2VkaXRvckdyb3Vwc1NlcnZpY2UuZ3JvdXBzLmxlbmd0aCAtIDFdLCBkaXJlY3Rpb24pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0YXJnZXRHcm91cCA9IHRoaXMuX2VkaXRvckdyb3Vwc1NlcnZpY2UuZ2V0R3JvdXAoZ3JvdXBJZCk7XG5cdFx0fVxuXHRcdGlmICghdGFyZ2V0R3JvdXApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBTaW1pbGFyIGxvZ2ljIHRvIGlmIGluZGV4IGlzIG91dCBvZiBib3VuZHMgd2UgcGxhY2UgaXQgYXQgdGhlIGVuZFxuXHRcdGlmIChpbmRleCA8IDAgfHwgaW5kZXggPiB0YXJnZXRHcm91cC5lZGl0b3JzLmxlbmd0aCkge1xuXHRcdFx0aW5kZXggPSB0YXJnZXRHcm91cC5lZGl0b3JzLmxlbmd0aDtcblx0XHR9XG5cdFx0Ly8gRmluZCB0aGUgY29ycmVjdCBFZGl0b3JJbnB1dCB1c2luZyB0aGUgdGFiIGluZm9cblx0XHRjb25zdCBlZGl0b3JJbnB1dCA9IHRhYkluZm8/LmVkaXRvcklucHV0O1xuXHRcdGlmICghZWRpdG9ySW5wdXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gTW92ZSB0aGUgZWRpdG9yIHRvIHRoZSB0YXJnZXQgZ3JvdXBcblx0XHRzb3VyY2VHcm91cC5tb3ZlRWRpdG9yKGVkaXRvcklucHV0LCB0YXJnZXRHcm91cCwgeyBpbmRleCwgcHJlc2VydmVGb2N1cyB9KTtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRhc3luYyAkY2xvc2VUYWIodGFiSWRzOiBzdHJpbmdbXSwgcHJlc2VydmVGb2N1cz86IGJvb2xlYW4pOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCBncm91cHM6IE1hcDxJRWRpdG9yR3JvdXAsIEVkaXRvcklucHV0W10+ID0gbmV3IE1hcCgpO1xuXHRcdGZvciAoY29uc3QgdGFiSWQgb2YgdGFiSWRzKSB7XG5cdFx0XHRjb25zdCB0YWJJbmZvID0gdGhpcy5fdGFiSW5mb0xvb2t1cC5nZXQodGFiSWQpO1xuXHRcdFx0Y29uc3QgdGFiID0gdGFiSW5mbz8udGFiO1xuXHRcdFx0Y29uc3QgZ3JvdXAgPSB0YWJJbmZvPy5ncm91cDtcblx0XHRcdGNvbnN0IGVkaXRvclRhYiA9IHRhYkluZm8/LmVkaXRvcklucHV0O1xuXHRcdFx0Ly8gSWYgbm90IGZvdW5kIHNraXBcblx0XHRcdGlmICghZ3JvdXAgfHwgIXRhYiB8fCAhdGFiSW5mbyB8fCAhZWRpdG9yVGFiKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZ3JvdXBFZGl0b3JzID0gZ3JvdXBzLmdldChncm91cCk7XG5cdFx0XHRpZiAoIWdyb3VwRWRpdG9ycykge1xuXHRcdFx0XHRncm91cHMuc2V0KGdyb3VwLCBbZWRpdG9yVGFiXSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRncm91cEVkaXRvcnMucHVzaChlZGl0b3JUYWIpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBMb29wIG92ZXIga2V5cyBvZiB0aGUgZ3JvdXBzIG1hcCBhbmQgY2FsbCBjbG9zZUVkaXRvcnNcblx0XHRjb25zdCByZXN1bHRzOiBib29sZWFuW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IFtncm91cCwgZWRpdG9yc10gb2YgZ3JvdXBzKSB7XG5cdFx0XHRyZXN1bHRzLnB1c2goYXdhaXQgZ3JvdXAuY2xvc2VFZGl0b3JzKGVkaXRvcnMsIHsgcHJlc2VydmVGb2N1cyB9KSk7XG5cdFx0fVxuXHRcdC8vIFRPRE8gQGpyaWVrZW4gVGhpcyBpc24ndCBxdWl0ZSByaWdodCBob3cgY2FuIHdlIHNheSB0cnVlIGZvciBzb21lIGJ1dCBub3Qgb3RoZXJzP1xuXHRcdHJldHVybiByZXN1bHRzLmV2ZXJ5KHJlc3VsdCA9PiByZXN1bHQpO1xuXHR9XG5cblx0YXN5bmMgJGNsb3NlR3JvdXAoZ3JvdXBJZHM6IG51bWJlcltdLCBwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IGdyb3VwQ2xvc2VSZXN1bHRzOiBib29sZWFuW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGdyb3VwSWQgb2YgZ3JvdXBJZHMpIHtcblx0XHRcdGNvbnN0IGdyb3VwID0gdGhpcy5fZWRpdG9yR3JvdXBzU2VydmljZS5nZXRHcm91cChncm91cElkKTtcblx0XHRcdGlmIChncm91cCkge1xuXHRcdFx0XHRncm91cENsb3NlUmVzdWx0cy5wdXNoKGF3YWl0IGdyb3VwLmNsb3NlQWxsRWRpdG9ycygpKTtcblx0XHRcdFx0Ly8gTWFrZSBzdXJlIGdyb3VwIGlzIGVtcHR5IGJ1dCBzdGlsbCB0aGVyZSBiZWZvcmUgcmVtb3ZpbmcgaXRcblx0XHRcdFx0aWYgKGdyb3VwLmNvdW50ID09PSAwICYmIHRoaXMuX2VkaXRvckdyb3Vwc1NlcnZpY2UuZ2V0R3JvdXAoZ3JvdXAuaWQpKSB7XG5cdFx0XHRcdFx0dGhpcy5fZWRpdG9yR3JvdXBzU2VydmljZS5yZW1vdmVHcm91cChncm91cCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGdyb3VwQ2xvc2VSZXN1bHRzLmV2ZXJ5KHJlc3VsdCA9PiByZXN1bHQpO1xuXHR9XG5cdC8vI2VuZHJlZ2lvblxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGFBQWE7QUFDdEIsU0FBUyxlQUFlLHVCQUF1QjtBQUMvQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQXNCLGdCQUE0RSxhQUF3QyxjQUFjLDZCQUErQztBQUN2TSxTQUFTLHdCQUF3QixzQkFBc0Isd0JBQXdCO0FBQy9FLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsOEJBQThCO0FBRXZDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsdUNBQXVDO0FBQ2hELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMscUJBQXdDLDJCQUEyQjtBQUM1RSxTQUFTLGdCQUE4QixzQkFBc0IseUNBQXlDO0FBQ3RHLFNBQThCLGdCQUFnQixrQkFBa0I7QUFDaEUsU0FBUyw0QkFBNkM7QUFRL0MsSUFBTSx1QkFBTixNQUFnRTtBQUFBLEVBYXRFLFlBQ0MsZ0JBQ3VDLHNCQUNDLHVCQUNWLGFBQ2QsZUFDZjtBQUpzQztBQUNDO0FBQ1Y7QUFmL0IsU0FBaUIsY0FBYyxJQUFJLGdCQUFnQjtBQUduRDtBQUFBLFNBQVEsaUJBQXVDLENBQUM7QUFFaEQ7QUFBQSxTQUFpQixlQUFnRCxvQkFBSSxJQUFJO0FBRXpFO0FBQUEsU0FBaUIsaUJBQXVDLG9CQUFJLElBQUk7QUFFaEU7QUFBQSxTQUFpQixpQ0FBc0UsSUFBSSxjQUFjO0FBVXhH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
