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
import { diffSets } from "../../../base/common/collections.js";
import { Emitter } from "../../../base/common/event.js";
import { assertIsDefined } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { MainContext, TabInputKind, TabModelOperationKind } from "./extHost.protocol.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import * as typeConverters from "./extHostTypeConverters.js";
import { ChatEditorTabInput, CustomEditorTabInput, InteractiveWindowInput, NotebookDiffEditorTabInput, NotebookEditorTabInput, TerminalEditorTabInput, TextDiffTabInput, TextMergeTabInput, TextTabInput, WebviewEditorTabInput, TextMultiDiffTabInput } from "./extHostTypes.js";
const IExtHostEditorTabs = createDecorator("IExtHostEditorTabs");
class ExtHostEditorTab {
  constructor(dto, parentGroup, activeTabIdGetter) {
    this._activeTabIdGetter = activeTabIdGetter;
    this._parentGroup = parentGroup;
    this.acceptDtoUpdate(dto);
  }
  get apiObject() {
    if (!this._apiObject) {
      const that = this;
      const obj = {
        get isActive() {
          return that._dto.id === that._activeTabIdGetter();
        },
        get label() {
          return that._dto.label;
        },
        get input() {
          return that._input;
        },
        get isDirty() {
          return that._dto.isDirty;
        },
        get isPinned() {
          return that._dto.isPinned;
        },
        get isPreview() {
          return that._dto.isPreview;
        },
        get group() {
          return that._parentGroup.apiObject;
        }
      };
      this._apiObject = Object.freeze(obj);
    }
    return this._apiObject;
  }
  get tabId() {
    return this._dto.id;
  }
  acceptDtoUpdate(dto) {
    this._dto = dto;
    this._input = this._initInput();
  }
  _initInput() {
    switch (this._dto.input.kind) {
      case TabInputKind.TextInput:
        return new TextTabInput(URI.revive(this._dto.input.uri));
      case TabInputKind.TextDiffInput:
        return new TextDiffTabInput(URI.revive(this._dto.input.original), URI.revive(this._dto.input.modified));
      case TabInputKind.TextMergeInput:
        return new TextMergeTabInput(URI.revive(this._dto.input.base), URI.revive(this._dto.input.input1), URI.revive(this._dto.input.input2), URI.revive(this._dto.input.result));
      case TabInputKind.CustomEditorInput:
        return new CustomEditorTabInput(URI.revive(this._dto.input.uri), this._dto.input.viewType);
      case TabInputKind.WebviewEditorInput:
        return new WebviewEditorTabInput(this._dto.input.viewType);
      case TabInputKind.NotebookInput:
        return new NotebookEditorTabInput(URI.revive(this._dto.input.uri), this._dto.input.notebookType);
      case TabInputKind.NotebookDiffInput:
        return new NotebookDiffEditorTabInput(URI.revive(this._dto.input.original), URI.revive(this._dto.input.modified), this._dto.input.notebookType);
      case TabInputKind.TerminalEditorInput:
        return new TerminalEditorTabInput();
      case TabInputKind.InteractiveEditorInput:
        return new InteractiveWindowInput(URI.revive(this._dto.input.uri), URI.revive(this._dto.input.inputBoxUri));
      case TabInputKind.ChatEditorInput:
        return new ChatEditorTabInput();
      case TabInputKind.MultiDiffEditorInput:
        return new TextMultiDiffTabInput(this._dto.input.diffEditors.map((diff) => new TextDiffTabInput(URI.revive(diff.original), URI.revive(diff.modified))));
      default:
        return void 0;
    }
  }
}
class ExtHostEditorTabGroup {
  constructor(dto, activeGroupIdGetter) {
    this._tabs = [];
    this._activeTabId = "";
    this._dto = dto;
    this._activeGroupIdGetter = activeGroupIdGetter;
    for (const tabDto of dto.tabs) {
      if (tabDto.isActive) {
        this._activeTabId = tabDto.id;
      }
      this._tabs.push(new ExtHostEditorTab(tabDto, this, () => this.activeTabId()));
    }
  }
  get apiObject() {
    if (!this._apiObject) {
      const that = this;
      const obj = {
        get isActive() {
          return that._dto.groupId === that._activeGroupIdGetter();
        },
        get viewColumn() {
          return typeConverters.ViewColumn.to(that._dto.viewColumn);
        },
        get activeTab() {
          return that._tabs.find((tab) => tab.tabId === that._activeTabId)?.apiObject;
        },
        get tabs() {
          return Object.freeze(that._tabs.map((tab) => tab.apiObject));
        }
      };
      this._apiObject = Object.freeze(obj);
    }
    return this._apiObject;
  }
  get groupId() {
    return this._dto.groupId;
  }
  get tabs() {
    return this._tabs;
  }
  acceptGroupDtoUpdate(dto) {
    this._dto = dto;
  }
  acceptTabOperation(operation) {
    if (operation.kind === TabModelOperationKind.TAB_OPEN) {
      const tab2 = new ExtHostEditorTab(operation.tabDto, this, () => this.activeTabId());
      this._tabs.splice(operation.index, 0, tab2);
      if (operation.tabDto.isActive) {
        this._activeTabId = tab2.tabId;
      }
      return tab2;
    } else if (operation.kind === TabModelOperationKind.TAB_CLOSE) {
      const tab2 = this._tabs.splice(operation.index, 1)[0];
      if (!tab2) {
        throw new Error(`Tab close updated received for index ${operation.index} which does not exist`);
      }
      if (tab2.tabId === this._activeTabId) {
        this._activeTabId = "";
      }
      return tab2;
    } else if (operation.kind === TabModelOperationKind.TAB_MOVE) {
      if (operation.oldIndex === void 0) {
        throw new Error("Invalid old index on move IPC");
      }
      const tab2 = this._tabs.splice(operation.oldIndex, 1)[0];
      if (!tab2) {
        throw new Error(`Tab move updated received for index ${operation.oldIndex} which does not exist`);
      }
      this._tabs.splice(operation.index, 0, tab2);
      return tab2;
    }
    const tab = this._tabs.find((extHostTab) => extHostTab.tabId === operation.tabDto.id);
    if (!tab) {
      throw new Error("INVALID tab");
    }
    if (operation.tabDto.isActive) {
      this._activeTabId = operation.tabDto.id;
    } else if (this._activeTabId === operation.tabDto.id && !operation.tabDto.isActive) {
      this._activeTabId = "";
    }
    tab.acceptDtoUpdate(operation.tabDto);
    return tab;
  }
  // Not a getter since it must be a function to be used as a callback for the tabs
  activeTabId() {
    return this._activeTabId;
  }
}
let ExtHostEditorTabs = class {
  constructor(extHostRpc) {
    this._onDidChangeTabs = new Emitter();
    this._onDidChangeTabGroups = new Emitter();
    this._extHostTabGroups = [];
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadEditorTabs);
  }
  get tabGroups() {
    if (!this._apiObject) {
      const that = this;
      const obj = {
        // never changes -> simple value
        onDidChangeTabGroups: that._onDidChangeTabGroups.event,
        onDidChangeTabs: that._onDidChangeTabs.event,
        // dynamic -> getters
        get all() {
          return Object.freeze(that._extHostTabGroups.map((group) => group.apiObject));
        },
        get activeTabGroup() {
          const activeTabGroupId = that._activeGroupId;
          const activeTabGroup = assertIsDefined(that._extHostTabGroups.find((candidate) => candidate.groupId === activeTabGroupId)?.apiObject);
          return activeTabGroup;
        },
        close: async (tabOrTabGroup, preserveFocus) => {
          const tabsOrTabGroups = Array.isArray(tabOrTabGroup) ? tabOrTabGroup : [tabOrTabGroup];
          if (!tabsOrTabGroups.length) {
            return true;
          }
          if (isTabGroup(tabsOrTabGroups[0])) {
            return this._closeGroups(tabsOrTabGroups, preserveFocus);
          } else {
            return this._closeTabs(tabsOrTabGroups, preserveFocus);
          }
        }
        // move: async (tab: vscode.Tab, viewColumn: ViewColumn, index: number, preserveFocus?: boolean) => {
        // 	const extHostTab = this._findExtHostTabFromApi(tab);
        // 	if (!extHostTab) {
        // 		throw new Error('Invalid tab');
        // 	}
        // 	this._proxy.$moveTab(extHostTab.tabId, index, typeConverters.ViewColumn.from(viewColumn), preserveFocus);
        // 	return;
        // }
      };
      this._apiObject = Object.freeze(obj);
    }
    return this._apiObject;
  }
  $acceptEditorTabModel(tabGroups) {
    const groupIdsBefore = new Set(this._extHostTabGroups.map((group) => group.groupId));
    const groupIdsAfter = new Set(tabGroups.map((dto) => dto.groupId));
    const diff = diffSets(groupIdsBefore, groupIdsAfter);
    const closed = this._extHostTabGroups.filter((group) => diff.removed.includes(group.groupId)).map((group) => group.apiObject);
    const opened = [];
    const changed = [];
    this._extHostTabGroups = tabGroups.map((tabGroup) => {
      const group = new ExtHostEditorTabGroup(tabGroup, () => this._activeGroupId);
      if (diff.added.includes(group.groupId)) {
        opened.push(group.apiObject);
      } else {
        changed.push(group.apiObject);
      }
      return group;
    });
    const activeTabGroupId = assertIsDefined(tabGroups.find((group) => group.isActive === true)?.groupId);
    if (activeTabGroupId !== void 0 && this._activeGroupId !== activeTabGroupId) {
      this._activeGroupId = activeTabGroupId;
    }
    this._onDidChangeTabGroups.fire(Object.freeze({ opened, closed, changed }));
  }
  $acceptTabGroupUpdate(groupDto) {
    const group = this._extHostTabGroups.find((group2) => group2.groupId === groupDto.groupId);
    if (!group) {
      throw new Error("Update Group IPC call received before group creation.");
    }
    group.acceptGroupDtoUpdate(groupDto);
    if (groupDto.isActive) {
      this._activeGroupId = groupDto.groupId;
    }
    this._onDidChangeTabGroups.fire(Object.freeze({ changed: [group.apiObject], opened: [], closed: [] }));
  }
  $acceptTabOperation(operation) {
    const group = this._extHostTabGroups.find((group2) => group2.groupId === operation.groupId);
    if (!group) {
      throw new Error("Update Tabs IPC call received before group creation.");
    }
    const tab = group.acceptTabOperation(operation);
    switch (operation.kind) {
      case TabModelOperationKind.TAB_OPEN:
        this._onDidChangeTabs.fire(Object.freeze({
          opened: [tab.apiObject],
          closed: [],
          changed: []
        }));
        return;
      case TabModelOperationKind.TAB_CLOSE:
        this._onDidChangeTabs.fire(Object.freeze({
          opened: [],
          closed: [tab.apiObject],
          changed: []
        }));
        return;
      case TabModelOperationKind.TAB_MOVE:
      case TabModelOperationKind.TAB_UPDATE:
        this._onDidChangeTabs.fire(Object.freeze({
          opened: [],
          closed: [],
          changed: [tab.apiObject]
        }));
        return;
    }
  }
  _findExtHostTabFromApi(apiTab) {
    for (const group of this._extHostTabGroups) {
      for (const tab of group.tabs) {
        if (tab.apiObject === apiTab) {
          return tab;
        }
      }
    }
    return;
  }
  _findExtHostTabGroupFromApi(apiTabGroup) {
    return this._extHostTabGroups.find((candidate) => candidate.apiObject === apiTabGroup);
  }
  async _closeTabs(tabs, preserveFocus) {
    const extHostTabIds = [];
    for (const tab of tabs) {
      const extHostTab = this._findExtHostTabFromApi(tab);
      if (!extHostTab) {
        throw new Error("Tab close: Invalid tab not found!");
      }
      extHostTabIds.push(extHostTab.tabId);
    }
    return this._proxy.$closeTab(extHostTabIds, preserveFocus);
  }
  async _closeGroups(groups, preserverFoucs) {
    const extHostGroupIds = [];
    for (const group of groups) {
      const extHostGroup = this._findExtHostTabGroupFromApi(group);
      if (!extHostGroup) {
        throw new Error("Group close: Invalid group not found!");
      }
      extHostGroupIds.push(extHostGroup.groupId);
    }
    return this._proxy.$closeGroup(extHostGroupIds, preserverFoucs);
  }
};
ExtHostEditorTabs = __decorateClass([
  __decorateParam(0, IExtHostRpcService)
], ExtHostEditorTabs);
function isTabGroup(obj) {
  const tabGroup = obj;
  if (tabGroup.tabs !== void 0) {
    return true;
  }
  return false;
}
export {
  ExtHostEditorTabs,
  IExtHostEditorTabs
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0RWRpdG9yVGFicy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGRpZmZTZXRzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY29sbGVjdGlvbnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGFzc2VydElzRGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JUYWJEdG8sIElFZGl0b3JUYWJHcm91cER0bywgSUV4dEhvc3RFZGl0b3JUYWJzU2hhcGUsIE1haW5Db250ZXh0LCBNYWluVGhyZWFkRWRpdG9yVGFic1NoYXBlLCBUYWJJbnB1dEtpbmQsIFRhYk1vZGVsT3BlcmF0aW9uS2luZCwgVGFiT3BlcmF0aW9uIH0gZnJvbSAnLi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IElFeHRIb3N0UnBjU2VydmljZSB9IGZyb20gJy4vZXh0SG9zdFJwY1NlcnZpY2UuanMnO1xuaW1wb3J0ICogYXMgdHlwZUNvbnZlcnRlcnMgZnJvbSAnLi9leHRIb3N0VHlwZUNvbnZlcnRlcnMuanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRvclRhYklucHV0LCBDdXN0b21FZGl0b3JUYWJJbnB1dCwgSW50ZXJhY3RpdmVXaW5kb3dJbnB1dCwgTm90ZWJvb2tEaWZmRWRpdG9yVGFiSW5wdXQsIE5vdGVib29rRWRpdG9yVGFiSW5wdXQsIFRlcm1pbmFsRWRpdG9yVGFiSW5wdXQsIFRleHREaWZmVGFiSW5wdXQsIFRleHRNZXJnZVRhYklucHV0LCBUZXh0VGFiSW5wdXQsIFdlYnZpZXdFZGl0b3JUYWJJbnB1dCwgVGV4dE11bHRpRGlmZlRhYklucHV0IH0gZnJvbSAnLi9leHRIb3N0VHlwZXMuanMnO1xuaW1wb3J0IHR5cGUgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcblxuZXhwb3J0IGludGVyZmFjZSBJRXh0SG9zdEVkaXRvclRhYnMgZXh0ZW5kcyBJRXh0SG9zdEVkaXRvclRhYnNTaGFwZSB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0dGFiR3JvdXBzOiB2c2NvZGUuVGFiR3JvdXBzO1xufVxuXG5leHBvcnQgY29uc3QgSUV4dEhvc3RFZGl0b3JUYWJzID0gY3JlYXRlRGVjb3JhdG9yPElFeHRIb3N0RWRpdG9yVGFicz4oJ0lFeHRIb3N0RWRpdG9yVGFicycpO1xuXG50eXBlIEFueVRhYklucHV0ID0gVGV4dFRhYklucHV0IHwgVGV4dERpZmZUYWJJbnB1dCB8IFRleHRNdWx0aURpZmZUYWJJbnB1dCB8IEN1c3RvbUVkaXRvclRhYklucHV0IHwgTm90ZWJvb2tFZGl0b3JUYWJJbnB1dCB8IE5vdGVib29rRGlmZkVkaXRvclRhYklucHV0IHwgV2Vidmlld0VkaXRvclRhYklucHV0IHwgVGVybWluYWxFZGl0b3JUYWJJbnB1dCB8IEludGVyYWN0aXZlV2luZG93SW5wdXQgfCBDaGF0RWRpdG9yVGFiSW5wdXQ7XG5cbmNsYXNzIEV4dEhvc3RFZGl0b3JUYWIge1xuXHRwcml2YXRlIF9hcGlPYmplY3Q6IHZzY29kZS5UYWIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2R0byE6IElFZGl0b3JUYWJEdG87XG5cdHByaXZhdGUgX2lucHV0OiBBbnlUYWJJbnB1dCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfcGFyZW50R3JvdXA6IEV4dEhvc3RFZGl0b3JUYWJHcm91cDtcblx0cHJpdmF0ZSByZWFkb25seSBfYWN0aXZlVGFiSWRHZXR0ZXI6ICgpID0+IHN0cmluZztcblxuXHRjb25zdHJ1Y3RvcihkdG86IElFZGl0b3JUYWJEdG8sIHBhcmVudEdyb3VwOiBFeHRIb3N0RWRpdG9yVGFiR3JvdXAsIGFjdGl2ZVRhYklkR2V0dGVyOiAoKSA9PiBzdHJpbmcpIHtcblx0XHR0aGlzLl9hY3RpdmVUYWJJZEdldHRlciA9IGFjdGl2ZVRhYklkR2V0dGVyO1xuXHRcdHRoaXMuX3BhcmVudEdyb3VwID0gcGFyZW50R3JvdXA7XG5cdFx0dGhpcy5hY2NlcHREdG9VcGRhdGUoZHRvKTtcblx0fVxuXG5cdGdldCBhcGlPYmplY3QoKTogdnNjb2RlLlRhYiB7XG5cdFx0aWYgKCF0aGlzLl9hcGlPYmplY3QpIHtcblx0XHRcdC8vIERvbid0IHdhbnQgdG8gbG9zZSByZWZlcmVuY2UgdG8gcGFyZW50IGB0aGlzYCBpbiB0aGUgZ2V0dGVyc1xuXHRcdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0XHRjb25zdCBvYmo6IHZzY29kZS5UYWIgPSB7XG5cdFx0XHRcdGdldCBpc0FjdGl2ZSgpIHtcblx0XHRcdFx0XHQvLyBXZSB1c2UgYSBnZXR0ZXIgZnVuY3Rpb24gaGVyZSB0byBhbHdheXMgZW5zdXJlIGF0IG1vc3QgMSBhY3RpdmUgdGFiIHBlciBncm91cCBhbmQgcHJldmVudCBpdGVyYXRpb24gZm9yIGJlaW5nIHJlcXVpcmVkXG5cdFx0XHRcdFx0cmV0dXJuIHRoYXQuX2R0by5pZCA9PT0gdGhhdC5fYWN0aXZlVGFiSWRHZXR0ZXIoKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0Z2V0IGxhYmVsKCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGF0Ll9kdG8ubGFiZWw7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldCBpbnB1dCgpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhhdC5faW5wdXQ7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldCBpc0RpcnR5KCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGF0Ll9kdG8uaXNEaXJ0eTtcblx0XHRcdFx0fSxcblx0XHRcdFx0Z2V0IGlzUGlubmVkKCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGF0Ll9kdG8uaXNQaW5uZWQ7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldCBpc1ByZXZpZXcoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoYXQuX2R0by5pc1ByZXZpZXc7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldCBncm91cCgpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhhdC5fcGFyZW50R3JvdXAuYXBpT2JqZWN0O1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fYXBpT2JqZWN0ID0gT2JqZWN0LmZyZWV6ZTx2c2NvZGUuVGFiPihvYmopO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fYXBpT2JqZWN0O1xuXHR9XG5cblx0Z2V0IHRhYklkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX2R0by5pZDtcblx0fVxuXG5cdGFjY2VwdER0b1VwZGF0ZShkdG86IElFZGl0b3JUYWJEdG8pIHtcblx0XHR0aGlzLl9kdG8gPSBkdG87XG5cdFx0dGhpcy5faW5wdXQgPSB0aGlzLl9pbml0SW5wdXQoKTtcblx0fVxuXG5cdHByaXZhdGUgX2luaXRJbnB1dCgpIHtcblx0XHRzd2l0Y2ggKHRoaXMuX2R0by5pbnB1dC5raW5kKSB7XG5cdFx0XHRjYXNlIFRhYklucHV0S2luZC5UZXh0SW5wdXQ6XG5cdFx0XHRcdHJldHVybiBuZXcgVGV4dFRhYklucHV0KFVSSS5yZXZpdmUodGhpcy5fZHRvLmlucHV0LnVyaSkpO1xuXHRcdFx0Y2FzZSBUYWJJbnB1dEtpbmQuVGV4dERpZmZJbnB1dDpcblx0XHRcdFx0cmV0dXJuIG5ldyBUZXh0RGlmZlRhYklucHV0KFVSSS5yZXZpdmUodGhpcy5fZHRvLmlucHV0Lm9yaWdpbmFsKSwgVVJJLnJldml2ZSh0aGlzLl9kdG8uaW5wdXQubW9kaWZpZWQpKTtcblx0XHRcdGNhc2UgVGFiSW5wdXRLaW5kLlRleHRNZXJnZUlucHV0OlxuXHRcdFx0XHRyZXR1cm4gbmV3IFRleHRNZXJnZVRhYklucHV0KFVSSS5yZXZpdmUodGhpcy5fZHRvLmlucHV0LmJhc2UpLCBVUkkucmV2aXZlKHRoaXMuX2R0by5pbnB1dC5pbnB1dDEpLCBVUkkucmV2aXZlKHRoaXMuX2R0by5pbnB1dC5pbnB1dDIpLCBVUkkucmV2aXZlKHRoaXMuX2R0by5pbnB1dC5yZXN1bHQpKTtcblx0XHRcdGNhc2UgVGFiSW5wdXRLaW5kLkN1c3RvbUVkaXRvcklucHV0OlxuXHRcdFx0XHRyZXR1cm4gbmV3IEN1c3RvbUVkaXRvclRhYklucHV0KFVSSS5yZXZpdmUodGhpcy5fZHRvLmlucHV0LnVyaSksIHRoaXMuX2R0by5pbnB1dC52aWV3VHlwZSk7XG5cdFx0XHRjYXNlIFRhYklucHV0S2luZC5XZWJ2aWV3RWRpdG9ySW5wdXQ6XG5cdFx0XHRcdHJldHVybiBuZXcgV2Vidmlld0VkaXRvclRhYklucHV0KHRoaXMuX2R0by5pbnB1dC52aWV3VHlwZSk7XG5cdFx0XHRjYXNlIFRhYklucHV0S2luZC5Ob3RlYm9va0lucHV0OlxuXHRcdFx0XHRyZXR1cm4gbmV3IE5vdGVib29rRWRpdG9yVGFiSW5wdXQoVVJJLnJldml2ZSh0aGlzLl9kdG8uaW5wdXQudXJpKSwgdGhpcy5fZHRvLmlucHV0Lm5vdGVib29rVHlwZSk7XG5cdFx0XHRjYXNlIFRhYklucHV0S2luZC5Ob3RlYm9va0RpZmZJbnB1dDpcblx0XHRcdFx0cmV0dXJuIG5ldyBOb3RlYm9va0RpZmZFZGl0b3JUYWJJbnB1dChVUkkucmV2aXZlKHRoaXMuX2R0by5pbnB1dC5vcmlnaW5hbCksIFVSSS5yZXZpdmUodGhpcy5fZHRvLmlucHV0Lm1vZGlmaWVkKSwgdGhpcy5fZHRvLmlucHV0Lm5vdGVib29rVHlwZSk7XG5cdFx0XHRjYXNlIFRhYklucHV0S2luZC5UZXJtaW5hbEVkaXRvcklucHV0OlxuXHRcdFx0XHRyZXR1cm4gbmV3IFRlcm1pbmFsRWRpdG9yVGFiSW5wdXQoKTtcblx0XHRcdGNhc2UgVGFiSW5wdXRLaW5kLkludGVyYWN0aXZlRWRpdG9ySW5wdXQ6XG5cdFx0XHRcdHJldHVybiBuZXcgSW50ZXJhY3RpdmVXaW5kb3dJbnB1dChVUkkucmV2aXZlKHRoaXMuX2R0by5pbnB1dC51cmkpLCBVUkkucmV2aXZlKHRoaXMuX2R0by5pbnB1dC5pbnB1dEJveFVyaSkpO1xuXHRcdFx0Y2FzZSBUYWJJbnB1dEtpbmQuQ2hhdEVkaXRvcklucHV0OlxuXHRcdFx0XHRyZXR1cm4gbmV3IENoYXRFZGl0b3JUYWJJbnB1dCgpO1xuXHRcdFx0Y2FzZSBUYWJJbnB1dEtpbmQuTXVsdGlEaWZmRWRpdG9ySW5wdXQ6XG5cdFx0XHRcdHJldHVybiBuZXcgVGV4dE11bHRpRGlmZlRhYklucHV0KHRoaXMuX2R0by5pbnB1dC5kaWZmRWRpdG9ycy5tYXAoZGlmZiA9PiBuZXcgVGV4dERpZmZUYWJJbnB1dChVUkkucmV2aXZlKGRpZmYub3JpZ2luYWwpLCBVUkkucmV2aXZlKGRpZmYubW9kaWZpZWQpKSkpO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgRXh0SG9zdEVkaXRvclRhYkdyb3VwIHtcblxuXHRwcml2YXRlIF9hcGlPYmplY3Q6IHZzY29kZS5UYWJHcm91cCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZHRvOiBJRWRpdG9yVGFiR3JvdXBEdG87XG5cdHByaXZhdGUgX3RhYnM6IEV4dEhvc3RFZGl0b3JUYWJbXSA9IFtdO1xuXHRwcml2YXRlIF9hY3RpdmVUYWJJZDogc3RyaW5nID0gJyc7XG5cdHByaXZhdGUgX2FjdGl2ZUdyb3VwSWRHZXR0ZXI6ICgpID0+IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3RvcihkdG86IElFZGl0b3JUYWJHcm91cER0bywgYWN0aXZlR3JvdXBJZEdldHRlcjogKCkgPT4gbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fZHRvID0gZHRvO1xuXHRcdHRoaXMuX2FjdGl2ZUdyb3VwSWRHZXR0ZXIgPSBhY3RpdmVHcm91cElkR2V0dGVyO1xuXHRcdC8vIENvbnN0cnVjdCBhbGwgdGFicyBmcm9tIHRoZSBnaXZlbiBkdG9cblx0XHRmb3IgKGNvbnN0IHRhYkR0byBvZiBkdG8udGFicykge1xuXHRcdFx0aWYgKHRhYkR0by5pc0FjdGl2ZSkge1xuXHRcdFx0XHR0aGlzLl9hY3RpdmVUYWJJZCA9IHRhYkR0by5pZDtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3RhYnMucHVzaChuZXcgRXh0SG9zdEVkaXRvclRhYih0YWJEdG8sIHRoaXMsICgpID0+IHRoaXMuYWN0aXZlVGFiSWQoKSkpO1xuXHRcdH1cblx0fVxuXG5cdGdldCBhcGlPYmplY3QoKTogdnNjb2RlLlRhYkdyb3VwIHtcblx0XHRpZiAoIXRoaXMuX2FwaU9iamVjdCkge1xuXHRcdFx0Ly8gRG9uJ3Qgd2FudCB0byBsb3NlIHJlZmVyZW5jZSB0byBwYXJlbnQgYHRoaXNgIGluIHRoZSBnZXR0ZXJzXG5cdFx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRcdGNvbnN0IG9iajogdnNjb2RlLlRhYkdyb3VwID0ge1xuXHRcdFx0XHRnZXQgaXNBY3RpdmUoKSB7XG5cdFx0XHRcdFx0Ly8gV2UgdXNlIGEgZ2V0dGVyIGZ1bmN0aW9uIGhlcmUgdG8gYWx3YXlzIGVuc3VyZSBhdCBtb3N0IDEgYWN0aXZlIGdyb3VwIGFuZCBwcmV2ZW50IGl0ZXJhdGlvbiBmb3IgYmVpbmcgcmVxdWlyZWRcblx0XHRcdFx0XHRyZXR1cm4gdGhhdC5fZHRvLmdyb3VwSWQgPT09IHRoYXQuX2FjdGl2ZUdyb3VwSWRHZXR0ZXIoKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0Z2V0IHZpZXdDb2x1bW4oKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHR5cGVDb252ZXJ0ZXJzLlZpZXdDb2x1bW4udG8odGhhdC5fZHRvLnZpZXdDb2x1bW4pO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXQgYWN0aXZlVGFiKCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGF0Ll90YWJzLmZpbmQodGFiID0+IHRhYi50YWJJZCA9PT0gdGhhdC5fYWN0aXZlVGFiSWQpPy5hcGlPYmplY3Q7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldCB0YWJzKCkge1xuXHRcdFx0XHRcdHJldHVybiBPYmplY3QuZnJlZXplKHRoYXQuX3RhYnMubWFwKHRhYiA9PiB0YWIuYXBpT2JqZWN0KSk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHR0aGlzLl9hcGlPYmplY3QgPSBPYmplY3QuZnJlZXplPHZzY29kZS5UYWJHcm91cD4ob2JqKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2FwaU9iamVjdDtcblx0fVxuXG5cdGdldCBncm91cElkKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2R0by5ncm91cElkO1xuXHR9XG5cblx0Z2V0IHRhYnMoKTogRXh0SG9zdEVkaXRvclRhYltdIHtcblx0XHRyZXR1cm4gdGhpcy5fdGFicztcblx0fVxuXG5cdGFjY2VwdEdyb3VwRHRvVXBkYXRlKGR0bzogSUVkaXRvclRhYkdyb3VwRHRvKSB7XG5cdFx0dGhpcy5fZHRvID0gZHRvO1xuXHR9XG5cblx0YWNjZXB0VGFiT3BlcmF0aW9uKG9wZXJhdGlvbjogVGFiT3BlcmF0aW9uKTogRXh0SG9zdEVkaXRvclRhYiB7XG5cdFx0Ly8gSW4gdGhlIG9wZW4gY2FzZSB3ZSBhZGQgdGhlIHRhYiB0byB0aGUgZ3JvdXBcblx0XHRpZiAob3BlcmF0aW9uLmtpbmQgPT09IFRhYk1vZGVsT3BlcmF0aW9uS2luZC5UQUJfT1BFTikge1xuXHRcdFx0Y29uc3QgdGFiID0gbmV3IEV4dEhvc3RFZGl0b3JUYWIob3BlcmF0aW9uLnRhYkR0bywgdGhpcywgKCkgPT4gdGhpcy5hY3RpdmVUYWJJZCgpKTtcblx0XHRcdC8vIEluc2VydCB0YWIgYXQgZWRpdG9yIGluZGV4XG5cdFx0XHR0aGlzLl90YWJzLnNwbGljZShvcGVyYXRpb24uaW5kZXgsIDAsIHRhYik7XG5cdFx0XHRpZiAob3BlcmF0aW9uLnRhYkR0by5pc0FjdGl2ZSkge1xuXHRcdFx0XHR0aGlzLl9hY3RpdmVUYWJJZCA9IHRhYi50YWJJZDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0YWI7XG5cdFx0fSBlbHNlIGlmIChvcGVyYXRpb24ua2luZCA9PT0gVGFiTW9kZWxPcGVyYXRpb25LaW5kLlRBQl9DTE9TRSkge1xuXHRcdFx0Y29uc3QgdGFiID0gdGhpcy5fdGFicy5zcGxpY2Uob3BlcmF0aW9uLmluZGV4LCAxKVswXTtcblx0XHRcdGlmICghdGFiKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgVGFiIGNsb3NlIHVwZGF0ZWQgcmVjZWl2ZWQgZm9yIGluZGV4ICR7b3BlcmF0aW9uLmluZGV4fSB3aGljaCBkb2VzIG5vdCBleGlzdGApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRhYi50YWJJZCA9PT0gdGhpcy5fYWN0aXZlVGFiSWQpIHtcblx0XHRcdFx0dGhpcy5fYWN0aXZlVGFiSWQgPSAnJztcblx0XHRcdH1cblx0XHRcdHJldHVybiB0YWI7XG5cdFx0fSBlbHNlIGlmIChvcGVyYXRpb24ua2luZCA9PT0gVGFiTW9kZWxPcGVyYXRpb25LaW5kLlRBQl9NT1ZFKSB7XG5cdFx0XHRpZiAob3BlcmF0aW9uLm9sZEluZGV4ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIG9sZCBpbmRleCBvbiBtb3ZlIElQQycpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gU3BsaWNlIHRvIHJlbW92ZSBhdCBvbGQgaW5kZXggYW5kIGluc2VydCBhdCBuZXcgaW5kZXggPT09IG1vdmluZyB0aGUgdGFiXG5cdFx0XHRjb25zdCB0YWIgPSB0aGlzLl90YWJzLnNwbGljZShvcGVyYXRpb24ub2xkSW5kZXgsIDEpWzBdO1xuXHRcdFx0aWYgKCF0YWIpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBUYWIgbW92ZSB1cGRhdGVkIHJlY2VpdmVkIGZvciBpbmRleCAke29wZXJhdGlvbi5vbGRJbmRleH0gd2hpY2ggZG9lcyBub3QgZXhpc3RgKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3RhYnMuc3BsaWNlKG9wZXJhdGlvbi5pbmRleCwgMCwgdGFiKTtcblx0XHRcdHJldHVybiB0YWI7XG5cdFx0fVxuXHRcdGNvbnN0IHRhYiA9IHRoaXMuX3RhYnMuZmluZChleHRIb3N0VGFiID0+IGV4dEhvc3RUYWIudGFiSWQgPT09IG9wZXJhdGlvbi50YWJEdG8uaWQpO1xuXHRcdGlmICghdGFiKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0lOVkFMSUQgdGFiJyk7XG5cdFx0fVxuXHRcdGlmIChvcGVyYXRpb24udGFiRHRvLmlzQWN0aXZlKSB7XG5cdFx0XHR0aGlzLl9hY3RpdmVUYWJJZCA9IG9wZXJhdGlvbi50YWJEdG8uaWQ7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9hY3RpdmVUYWJJZCA9PT0gb3BlcmF0aW9uLnRhYkR0by5pZCAmJiAhb3BlcmF0aW9uLnRhYkR0by5pc0FjdGl2ZSkge1xuXHRcdFx0Ly8gRXZlbnRzIGFyZW4ndCBndWFyYW50ZWVkIHRvIGJlIGluIG9yZGVyIHNvIGlmIHdlIHJlY2VpdmUgYSBkdG8gdGhhdCBtYXRjaGVzIHRoZSBhY3RpdmUgdGFiIGlkXG5cdFx0XHQvLyBidXQgaXNuJ3QgYWN0aXZlIHdlIG1hcmsgdGhlIGFjdGl2ZSB0YWIgaWQgYXMgZW1wdHkuIFRoaXMgcHJldmVudCBvbkRpZEFjdGl2ZVRhYkNoYW5nZSBmcm9tXG5cdFx0XHQvLyBmaXJpbmcgaW5jb3JyZWN0bHlcblx0XHRcdHRoaXMuX2FjdGl2ZVRhYklkID0gJyc7XG5cdFx0fVxuXHRcdHRhYi5hY2NlcHREdG9VcGRhdGUob3BlcmF0aW9uLnRhYkR0byk7XG5cdFx0cmV0dXJuIHRhYjtcblx0fVxuXG5cdC8vIE5vdCBhIGdldHRlciBzaW5jZSBpdCBtdXN0IGJlIGEgZnVuY3Rpb24gdG8gYmUgdXNlZCBhcyBhIGNhbGxiYWNrIGZvciB0aGUgdGFic1xuXHRhY3RpdmVUYWJJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9hY3RpdmVUYWJJZDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRXh0SG9zdEVkaXRvclRhYnMgaW1wbGVtZW50cyBJRXh0SG9zdEVkaXRvclRhYnMge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IE1haW5UaHJlYWRFZGl0b3JUYWJzU2hhcGU7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlVGFicyA9IG5ldyBFbWl0dGVyPHZzY29kZS5UYWJDaGFuZ2VFdmVudD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VUYWJHcm91cHMgPSBuZXcgRW1pdHRlcjx2c2NvZGUuVGFiR3JvdXBDaGFuZ2VFdmVudD4oKTtcblxuXHQvLyBIYXZlIHRvIHVzZSAhIGJlY2F1c2UgdGhpcyBnZXRzIGluaXRpYWxpemVkIHZpYSBhbiBSUEMgcHJveHlcblx0cHJpdmF0ZSBfYWN0aXZlR3JvdXBJZCE6IG51bWJlcjtcblxuXHRwcml2YXRlIF9leHRIb3N0VGFiR3JvdXBzOiBFeHRIb3N0RWRpdG9yVGFiR3JvdXBbXSA9IFtdO1xuXG5cdHByaXZhdGUgX2FwaU9iamVjdDogdnNjb2RlLlRhYkdyb3VwcyB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3RvcihASUV4dEhvc3RScGNTZXJ2aWNlIGV4dEhvc3RScGM6IElFeHRIb3N0UnBjU2VydmljZSkge1xuXHRcdHRoaXMuX3Byb3h5ID0gZXh0SG9zdFJwYy5nZXRQcm94eShNYWluQ29udGV4dC5NYWluVGhyZWFkRWRpdG9yVGFicyk7XG5cdH1cblxuXHRnZXQgdGFiR3JvdXBzKCk6IHZzY29kZS5UYWJHcm91cHMge1xuXHRcdGlmICghdGhpcy5fYXBpT2JqZWN0KSB7XG5cdFx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRcdGNvbnN0IG9iajogdnNjb2RlLlRhYkdyb3VwcyA9IHtcblx0XHRcdFx0Ly8gbmV2ZXIgY2hhbmdlcyAtPiBzaW1wbGUgdmFsdWVcblx0XHRcdFx0b25EaWRDaGFuZ2VUYWJHcm91cHM6IHRoYXQuX29uRGlkQ2hhbmdlVGFiR3JvdXBzLmV2ZW50LFxuXHRcdFx0XHRvbkRpZENoYW5nZVRhYnM6IHRoYXQuX29uRGlkQ2hhbmdlVGFicy5ldmVudCxcblx0XHRcdFx0Ly8gZHluYW1pYyAtPiBnZXR0ZXJzXG5cdFx0XHRcdGdldCBhbGwoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIE9iamVjdC5mcmVlemUodGhhdC5fZXh0SG9zdFRhYkdyb3Vwcy5tYXAoZ3JvdXAgPT4gZ3JvdXAuYXBpT2JqZWN0KSk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldCBhY3RpdmVUYWJHcm91cCgpIHtcblx0XHRcdFx0XHRjb25zdCBhY3RpdmVUYWJHcm91cElkID0gdGhhdC5fYWN0aXZlR3JvdXBJZDtcblx0XHRcdFx0XHRjb25zdCBhY3RpdmVUYWJHcm91cCA9IGFzc2VydElzRGVmaW5lZCh0aGF0Ll9leHRIb3N0VGFiR3JvdXBzLmZpbmQoY2FuZGlkYXRlID0+IGNhbmRpZGF0ZS5ncm91cElkID09PSBhY3RpdmVUYWJHcm91cElkKT8uYXBpT2JqZWN0KTtcblx0XHRcdFx0XHRyZXR1cm4gYWN0aXZlVGFiR3JvdXA7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNsb3NlOiBhc3luYyAodGFiT3JUYWJHcm91cDogdnNjb2RlLlRhYiB8IHJlYWRvbmx5IHZzY29kZS5UYWJbXSB8IHZzY29kZS5UYWJHcm91cCB8IHJlYWRvbmx5IHZzY29kZS5UYWJHcm91cFtdLCBwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbikgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHRhYnNPclRhYkdyb3VwcyA9IEFycmF5LmlzQXJyYXkodGFiT3JUYWJHcm91cCkgPyB0YWJPclRhYkdyb3VwIDogW3RhYk9yVGFiR3JvdXBdO1xuXHRcdFx0XHRcdGlmICghdGFic09yVGFiR3JvdXBzLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vIENoZWNrIHdoaWNoIHR5cGUgd2FzIHBhc3NlZCBpbiBhbmQgY2FsbCB0aGUgYXBwcm9wcmlhdGUgY2xvc2Vcblx0XHRcdFx0XHQvLyBDYXN0aW5nIGlzIG5lZWRlZCBhcyB0eXBlc2NyaXB0IGRvZXNuJ3Qgc2VlbSB0byBpbmZlciBlbm91Z2ggZnJvbSB0aGlzXG5cdFx0XHRcdFx0aWYgKGlzVGFiR3JvdXAodGFic09yVGFiR3JvdXBzWzBdKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuX2Nsb3NlR3JvdXBzKHRhYnNPclRhYkdyb3VwcyBhcyB2c2NvZGUuVGFiR3JvdXBbXSwgcHJlc2VydmVGb2N1cyk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLl9jbG9zZVRhYnModGFic09yVGFiR3JvdXBzIGFzIHZzY29kZS5UYWJbXSwgcHJlc2VydmVGb2N1cyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQvLyBtb3ZlOiBhc3luYyAodGFiOiB2c2NvZGUuVGFiLCB2aWV3Q29sdW1uOiBWaWV3Q29sdW1uLCBpbmRleDogbnVtYmVyLCBwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbikgPT4ge1xuXHRcdFx0XHQvLyBcdGNvbnN0IGV4dEhvc3RUYWIgPSB0aGlzLl9maW5kRXh0SG9zdFRhYkZyb21BcGkodGFiKTtcblx0XHRcdFx0Ly8gXHRpZiAoIWV4dEhvc3RUYWIpIHtcblx0XHRcdFx0Ly8gXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCB0YWInKTtcblx0XHRcdFx0Ly8gXHR9XG5cdFx0XHRcdC8vIFx0dGhpcy5fcHJveHkuJG1vdmVUYWIoZXh0SG9zdFRhYi50YWJJZCwgaW5kZXgsIHR5cGVDb252ZXJ0ZXJzLlZpZXdDb2x1bW4uZnJvbSh2aWV3Q29sdW1uKSwgcHJlc2VydmVGb2N1cyk7XG5cdFx0XHRcdC8vIFx0cmV0dXJuO1xuXHRcdFx0XHQvLyB9XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fYXBpT2JqZWN0ID0gT2JqZWN0LmZyZWV6ZShvYmopO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fYXBpT2JqZWN0O1xuXHR9XG5cblx0JGFjY2VwdEVkaXRvclRhYk1vZGVsKHRhYkdyb3VwczogSUVkaXRvclRhYkdyb3VwRHRvW10pOiB2b2lkIHtcblxuXHRcdGNvbnN0IGdyb3VwSWRzQmVmb3JlID0gbmV3IFNldCh0aGlzLl9leHRIb3N0VGFiR3JvdXBzLm1hcChncm91cCA9PiBncm91cC5ncm91cElkKSk7XG5cdFx0Y29uc3QgZ3JvdXBJZHNBZnRlciA9IG5ldyBTZXQodGFiR3JvdXBzLm1hcChkdG8gPT4gZHRvLmdyb3VwSWQpKTtcblx0XHRjb25zdCBkaWZmID0gZGlmZlNldHMoZ3JvdXBJZHNCZWZvcmUsIGdyb3VwSWRzQWZ0ZXIpO1xuXG5cdFx0Y29uc3QgY2xvc2VkOiB2c2NvZGUuVGFiR3JvdXBbXSA9IHRoaXMuX2V4dEhvc3RUYWJHcm91cHMuZmlsdGVyKGdyb3VwID0+IGRpZmYucmVtb3ZlZC5pbmNsdWRlcyhncm91cC5ncm91cElkKSkubWFwKGdyb3VwID0+IGdyb3VwLmFwaU9iamVjdCk7XG5cdFx0Y29uc3Qgb3BlbmVkOiB2c2NvZGUuVGFiR3JvdXBbXSA9IFtdO1xuXHRcdGNvbnN0IGNoYW5nZWQ6IHZzY29kZS5UYWJHcm91cFtdID0gW107XG5cblxuXHRcdHRoaXMuX2V4dEhvc3RUYWJHcm91cHMgPSB0YWJHcm91cHMubWFwKHRhYkdyb3VwID0+IHtcblx0XHRcdGNvbnN0IGdyb3VwID0gbmV3IEV4dEhvc3RFZGl0b3JUYWJHcm91cCh0YWJHcm91cCwgKCkgPT4gdGhpcy5fYWN0aXZlR3JvdXBJZCk7XG5cdFx0XHRpZiAoZGlmZi5hZGRlZC5pbmNsdWRlcyhncm91cC5ncm91cElkKSkge1xuXHRcdFx0XHRvcGVuZWQucHVzaChncm91cC5hcGlPYmplY3QpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y2hhbmdlZC5wdXNoKGdyb3VwLmFwaU9iamVjdCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZ3JvdXA7XG5cdFx0fSk7XG5cblx0XHQvLyBTZXQgdGhlIGFjdGl2ZSB0YWIgZ3JvdXAgaWRcblx0XHRjb25zdCBhY3RpdmVUYWJHcm91cElkID0gYXNzZXJ0SXNEZWZpbmVkKHRhYkdyb3Vwcy5maW5kKGdyb3VwID0+IGdyb3VwLmlzQWN0aXZlID09PSB0cnVlKT8uZ3JvdXBJZCk7XG5cdFx0aWYgKGFjdGl2ZVRhYkdyb3VwSWQgIT09IHVuZGVmaW5lZCAmJiB0aGlzLl9hY3RpdmVHcm91cElkICE9PSBhY3RpdmVUYWJHcm91cElkKSB7XG5cdFx0XHR0aGlzLl9hY3RpdmVHcm91cElkID0gYWN0aXZlVGFiR3JvdXBJZDtcblx0XHR9XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VUYWJHcm91cHMuZmlyZShPYmplY3QuZnJlZXplKHsgb3BlbmVkLCBjbG9zZWQsIGNoYW5nZWQgfSkpO1xuXHR9XG5cblx0JGFjY2VwdFRhYkdyb3VwVXBkYXRlKGdyb3VwRHRvOiBJRWRpdG9yVGFiR3JvdXBEdG8pIHtcblx0XHRjb25zdCBncm91cCA9IHRoaXMuX2V4dEhvc3RUYWJHcm91cHMuZmluZChncm91cCA9PiBncm91cC5ncm91cElkID09PSBncm91cER0by5ncm91cElkKTtcblx0XHRpZiAoIWdyb3VwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VwZGF0ZSBHcm91cCBJUEMgY2FsbCByZWNlaXZlZCBiZWZvcmUgZ3JvdXAgY3JlYXRpb24uJyk7XG5cdFx0fVxuXHRcdGdyb3VwLmFjY2VwdEdyb3VwRHRvVXBkYXRlKGdyb3VwRHRvKTtcblx0XHRpZiAoZ3JvdXBEdG8uaXNBY3RpdmUpIHtcblx0XHRcdHRoaXMuX2FjdGl2ZUdyb3VwSWQgPSBncm91cER0by5ncm91cElkO1xuXHRcdH1cblx0XHR0aGlzLl9vbkRpZENoYW5nZVRhYkdyb3Vwcy5maXJlKE9iamVjdC5mcmVlemUoeyBjaGFuZ2VkOiBbZ3JvdXAuYXBpT2JqZWN0XSwgb3BlbmVkOiBbXSwgY2xvc2VkOiBbXSB9KSk7XG5cdH1cblxuXHQkYWNjZXB0VGFiT3BlcmF0aW9uKG9wZXJhdGlvbjogVGFiT3BlcmF0aW9uKSB7XG5cdFx0Y29uc3QgZ3JvdXAgPSB0aGlzLl9leHRIb3N0VGFiR3JvdXBzLmZpbmQoZ3JvdXAgPT4gZ3JvdXAuZ3JvdXBJZCA9PT0gb3BlcmF0aW9uLmdyb3VwSWQpO1xuXHRcdGlmICghZ3JvdXApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignVXBkYXRlIFRhYnMgSVBDIGNhbGwgcmVjZWl2ZWQgYmVmb3JlIGdyb3VwIGNyZWF0aW9uLicpO1xuXHRcdH1cblx0XHRjb25zdCB0YWIgPSBncm91cC5hY2NlcHRUYWJPcGVyYXRpb24ob3BlcmF0aW9uKTtcblxuXHRcdC8vIENvbnN0cnVjdCB0aGUgdGFiIGNoYW5nZSBldmVudCBiYXNlZCBvbiB0aGUgb3BlcmF0aW9uXG5cdFx0c3dpdGNoIChvcGVyYXRpb24ua2luZCkge1xuXHRcdFx0Y2FzZSBUYWJNb2RlbE9wZXJhdGlvbktpbmQuVEFCX09QRU46XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVGFicy5maXJlKE9iamVjdC5mcmVlemUoe1xuXHRcdFx0XHRcdG9wZW5lZDogW3RhYi5hcGlPYmplY3RdLFxuXHRcdFx0XHRcdGNsb3NlZDogW10sXG5cdFx0XHRcdFx0Y2hhbmdlZDogW11cblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHRjYXNlIFRhYk1vZGVsT3BlcmF0aW9uS2luZC5UQUJfQ0xPU0U6XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVGFicy5maXJlKE9iamVjdC5mcmVlemUoe1xuXHRcdFx0XHRcdG9wZW5lZDogW10sXG5cdFx0XHRcdFx0Y2xvc2VkOiBbdGFiLmFwaU9iamVjdF0sXG5cdFx0XHRcdFx0Y2hhbmdlZDogW11cblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHRjYXNlIFRhYk1vZGVsT3BlcmF0aW9uS2luZC5UQUJfTU9WRTpcblx0XHRcdGNhc2UgVGFiTW9kZWxPcGVyYXRpb25LaW5kLlRBQl9VUERBVEU6XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVGFicy5maXJlKE9iamVjdC5mcmVlemUoe1xuXHRcdFx0XHRcdG9wZW5lZDogW10sXG5cdFx0XHRcdFx0Y2xvc2VkOiBbXSxcblx0XHRcdFx0XHRjaGFuZ2VkOiBbdGFiLmFwaU9iamVjdF1cblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZmluZEV4dEhvc3RUYWJGcm9tQXBpKGFwaVRhYjogdnNjb2RlLlRhYik6IEV4dEhvc3RFZGl0b3JUYWIgfCB1bmRlZmluZWQge1xuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgdGhpcy5fZXh0SG9zdFRhYkdyb3Vwcykge1xuXHRcdFx0Zm9yIChjb25zdCB0YWIgb2YgZ3JvdXAudGFicykge1xuXHRcdFx0XHRpZiAodGFiLmFwaU9iamVjdCA9PT0gYXBpVGFiKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRhYjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm47XG5cdH1cblxuXHRwcml2YXRlIF9maW5kRXh0SG9zdFRhYkdyb3VwRnJvbUFwaShhcGlUYWJHcm91cDogdnNjb2RlLlRhYkdyb3VwKTogRXh0SG9zdEVkaXRvclRhYkdyb3VwIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fZXh0SG9zdFRhYkdyb3Vwcy5maW5kKGNhbmRpZGF0ZSA9PiBjYW5kaWRhdGUuYXBpT2JqZWN0ID09PSBhcGlUYWJHcm91cCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jbG9zZVRhYnModGFiczogdnNjb2RlLlRhYltdLCBwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IGV4dEhvc3RUYWJJZHM6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChjb25zdCB0YWIgb2YgdGFicykge1xuXHRcdFx0Y29uc3QgZXh0SG9zdFRhYiA9IHRoaXMuX2ZpbmRFeHRIb3N0VGFiRnJvbUFwaSh0YWIpO1xuXHRcdFx0aWYgKCFleHRIb3N0VGFiKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignVGFiIGNsb3NlOiBJbnZhbGlkIHRhYiBub3QgZm91bmQhJyk7XG5cdFx0XHR9XG5cdFx0XHRleHRIb3N0VGFiSWRzLnB1c2goZXh0SG9zdFRhYi50YWJJZCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9wcm94eS4kY2xvc2VUYWIoZXh0SG9zdFRhYklkcywgcHJlc2VydmVGb2N1cyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jbG9zZUdyb3Vwcyhncm91cHM6IHZzY29kZS5UYWJHcm91cFtdLCBwcmVzZXJ2ZXJGb3Vjcz86IGJvb2xlYW4pOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCBleHRIb3N0R3JvdXBJZHM6IG51bWJlcltdID0gW107XG5cdFx0Zm9yIChjb25zdCBncm91cCBvZiBncm91cHMpIHtcblx0XHRcdGNvbnN0IGV4dEhvc3RHcm91cCA9IHRoaXMuX2ZpbmRFeHRIb3N0VGFiR3JvdXBGcm9tQXBpKGdyb3VwKTtcblx0XHRcdGlmICghZXh0SG9zdEdyb3VwKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignR3JvdXAgY2xvc2U6IEludmFsaWQgZ3JvdXAgbm90IGZvdW5kIScpO1xuXHRcdFx0fVxuXHRcdFx0ZXh0SG9zdEdyb3VwSWRzLnB1c2goZXh0SG9zdEdyb3VwLmdyb3VwSWQpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJGNsb3NlR3JvdXAoZXh0SG9zdEdyb3VwSWRzLCBwcmVzZXJ2ZXJGb3Vjcyk7XG5cdH1cbn1cblxuLy8jcmVnaW9uIFV0aWxzXG5mdW5jdGlvbiBpc1RhYkdyb3VwKG9iajogdW5rbm93bik6IG9iaiBpcyB2c2NvZGUuVGFiR3JvdXAge1xuXHRjb25zdCB0YWJHcm91cCA9IG9iaiBhcyB2c2NvZGUuVGFiR3JvdXA7XG5cdGlmICh0YWJHcm91cC50YWJzICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRyZXR1cm4gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsV0FBVztBQUNwQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFxRSxhQUF3QyxjQUFjLDZCQUEyQztBQUN0SyxTQUFTLDBCQUEwQjtBQUNuQyxZQUFZLG9CQUFvQjtBQUNoQyxTQUFTLG9CQUFvQixzQkFBc0Isd0JBQXdCLDRCQUE0Qix3QkFBd0Isd0JBQXdCLGtCQUFrQixtQkFBbUIsY0FBYyx1QkFBdUIsNkJBQTZCO0FBUXZQLE1BQU0scUJBQXFCLGdCQUFvQyxvQkFBb0I7QUFJMUYsTUFBTSxpQkFBaUI7QUFBQSxFQU90QixZQUFZLEtBQW9CLGFBQW9DLG1CQUFpQztBQUNwRyxTQUFLLHFCQUFxQjtBQUMxQixTQUFLLGVBQWU7QUFDcEIsU0FBSyxnQkFBZ0IsR0FBRztBQUFBLEVBQ3pCO0FBQUEsRUFFQSxJQUFJLFlBQXdCO0FBQzNCLFFBQUksQ0FBQyxLQUFLLFlBQVk7QUFFckIsWUFBTSxPQUFPO0FBQ2IsWUFBTSxNQUFrQjtBQUFBLFFBQ3ZCLElBQUksV0FBVztBQUVkLGlCQUFPLEtBQUssS0FBSyxPQUFPLEtBQUssbUJBQW1CO0FBQUEsUUFDakQ7QUFBQSxRQUNB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QSxNQUNELEtBQUssc0JBQXNCO0FBQUEsTUFDM0IsS0FBSyxzQkFBc0I7QUFDMUIsYUFBSyxpQkFBaUIsS0FBSyxPQUFPLE9BQU87QUFBQSxVQUN4QyxRQUFRLENBQUM7QUFBQSxVQUNULFFBQVEsQ0FBQztBQUFBLFVBQ1QsU0FBUyxDQUFDLElBQUksU0FBUztBQUFBLFFBQ3hCLENBQUMsQ0FBQztBQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLHVCQUF1QixRQUFrRDtBQUNoRixlQUFXLFNBQVMsS0FBSyxtQkFBbUI7QUFDM0MsaUJBQVcsT0FBTyxNQUFNLE1BQU07QUFDN0IsWUFBSSxJQUFJLGNBQWMsUUFBUTtBQUM3QixpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUNBO0FBQUEsRUFDRDtBQUFBLEVBRVEsNEJBQTRCLGFBQWlFO0FBQ3BHLFdBQU8sS0FBSyxrQkFBa0IsS0FBSyxlQUFhLFVBQVUsY0FBYyxXQUFXO0FBQUEsRUFDcEY7QUFBQSxFQUVBLE1BQWMsV0FBVyxNQUFvQixlQUEyQztBQUN2RixVQUFNLGdCQUEwQixDQUFDO0FBQ2pDLGVBQVcsT0FBTyxNQUFNO0FBQ3ZCLFlBQU0sYUFBYSxLQUFLLHVCQUF1QixHQUFHO0FBQ2xELFVBQUksQ0FBQyxZQUFZO0FBQ2hCLGNBQU0sSUFBSSxNQUFNLG1DQUFtQztBQUFBLE1BQ3BEO0FBQ0Esb0JBQWMsS0FBSyxXQUFXLEtBQUs7QUFBQSxJQUNwQztBQUNBLFdBQU8sS0FBSyxPQUFPLFVBQVUsZUFBZSxhQUFhO0FBQUEsRUFDMUQ7QUFBQSxFQUVBLE1BQWMsYUFBYSxRQUEyQixnQkFBNEM7QUFDakcsVUFBTSxrQkFBNEIsQ0FBQztBQUNuQyxlQUFXLFNBQVMsUUFBUTtBQUMzQixZQUFNLGVBQWUsS0FBSyw0QkFBNEIsS0FBSztBQUMzRCxVQUFJLENBQUMsY0FBYztBQUNsQixjQUFNLElBQUksTUFBTSx1Q0FBdUM7QUFBQSxNQUN4RDtBQUNBLHNCQUFnQixLQUFLLGFBQWEsT0FBTztBQUFBLElBQzFDO0FBQ0EsV0FBTyxLQUFLLE9BQU8sWUFBWSxpQkFBaUIsY0FBYztBQUFBLEVBQy9EO0FBQ0Q7QUE5S2Esb0JBQU47QUFBQSxFQWNPO0FBQUEsR0FkRDtBQWlMYixTQUFTLFdBQVcsS0FBc0M7QUFDekQsUUFBTSxXQUFXO0FBQ2pCLE1BQUksU0FBUyxTQUFTLFFBQVc7QUFDaEMsV0FBTztBQUFBLEVBQ1I7QUFDQSxTQUFPO0FBQ1I7IiwKICAibmFtZXMiOiBbInRhYiIsICJncm91cCJdCn0K
