import { assertNever } from "../../../../../base/common/assert.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { diffSets } from "../../../../../base/common/collections.js";
import { Event } from "../../../../../base/common/event.js";
import { Iterable } from "../../../../../base/common/iterator.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { IExtensionsWorkbenchService } from "../../../extensions/common/extensions.js";
import { AddConfigurationAction } from "../../../mcp/browser/mcpCommands.js";
import { IMcpService, McpConnectionState } from "../../../mcp/common/mcpTypes.js";
import { ChatContextKeys } from "../../common/chatContextKeys.js";
import { isResponseVM } from "../../common/chatViewModel.js";
import { ChatMode } from "../../common/constants.js";
import { ILanguageModelToolsService } from "../../common/languageModelToolsService.js";
import { IChatWidgetService } from "../chat.js";
import { CHAT_CATEGORY } from "./chatActions.js";
const AcceptToolConfirmationActionId = "workbench.action.chat.acceptTool";
class AcceptToolConfirmation extends Action2 {
  constructor() {
    super({
      id: AcceptToolConfirmationActionId,
      title: localize2("chat.accept", "Accept"),
      f1: false,
      category: CHAT_CATEGORY,
      keybinding: {
        when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.Editing.hasToolConfirmation),
        primary: KeyMod.CtrlCmd | KeyCode.Enter,
        // Override chatEditor.action.accept
        weight: KeybindingWeight.WorkbenchContrib + 1
      }
    });
  }
  run(accessor, ...args) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const widget = chatWidgetService.lastFocusedWidget;
    const lastItem = widget?.viewModel?.getItems().at(-1);
    if (!isResponseVM(lastItem)) {
      return;
    }
    const unconfirmedToolInvocation = lastItem.model.response.value.find((item) => item.kind === "toolInvocation" && !item.isConfirmed);
    if (unconfirmedToolInvocation) {
      unconfirmedToolInvocation.confirmed.complete(true);
    }
    widget?.focusInput();
  }
}
const _AttachToolsAction = class _AttachToolsAction extends Action2 {
  constructor() {
    super({
      id: _AttachToolsAction.id,
      title: localize("label", "Select Tools..."),
      icon: Codicon.tools,
      f1: false,
      category: CHAT_CATEGORY,
      precondition: ChatContextKeys.chatMode.isEqualTo(ChatMode.Agent),
      menu: {
        when: ChatContextKeys.chatMode.isEqualTo(ChatMode.Agent),
        id: MenuId.ChatInputAttachmentToolbar,
        group: "navigation",
        order: 1
      },
      keybinding: {
        when: ContextKeyExpr.and(ChatContextKeys.inChatInput, ChatContextKeys.chatMode.isEqualTo(ChatMode.Agent)),
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Slash,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  async run(accessor, ...args) {
    const quickPickService = accessor.get(IQuickInputService);
    const mcpService = accessor.get(IMcpService);
    const toolsService = accessor.get(ILanguageModelToolsService);
    const extensionService = accessor.get(IExtensionService);
    const chatWidgetService = accessor.get(IChatWidgetService);
    const telemetryService = accessor.get(ITelemetryService);
    const commandService = accessor.get(ICommandService);
    const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
    let widget = chatWidgetService.lastFocusedWidget;
    if (!widget) {
      let isChatActionContext2 = function(obj) {
        return obj && typeof obj === "object" && obj.widget;
      };
      var isChatActionContext = isChatActionContext2;
      const context = args[0];
      if (isChatActionContext2(context)) {
        widget = context.widget;
      }
    }
    if (!widget) {
      return;
    }
    const mcpServerByTool = /* @__PURE__ */ new Map();
    for (const server of mcpService.servers.get()) {
      for (const tool of server.tools.get()) {
        mcpServerByTool.set(tool.id, server);
      }
    }
    let BucketOrdinal;
    ((BucketOrdinal2) => {
      BucketOrdinal2[BucketOrdinal2["Extension"] = 0] = "Extension";
      BucketOrdinal2[BucketOrdinal2["Mcp"] = 1] = "Mcp";
      BucketOrdinal2[BucketOrdinal2["Other"] = 2] = "Other";
    })(BucketOrdinal || (BucketOrdinal = {}));
    const addMcpPick = { type: "item", label: localize("addServer", "Add MCP Server..."), iconClass: ThemeIcon.asClassName(Codicon.add), pickable: false, run: () => commandService.executeCommand(AddConfigurationAction.ID) };
    const addExpPick = { type: "item", label: localize("addExtension", "Install Extension..."), iconClass: ThemeIcon.asClassName(Codicon.add), pickable: false, run: () => extensionWorkbenchService.openSearch("@tag:language-model-tools") };
    const addPick = {
      type: "item",
      label: localize("addAny", "Add More Tools..."),
      iconClass: ThemeIcon.asClassName(Codicon.add),
      pickable: false,
      run: async () => {
        const pick = await quickPickService.pick(
          [addMcpPick, addExpPick],
          {
            canPickMany: false,
            title: localize("noTools", "Add tools to chat")
          }
        );
        pick?.run();
      }
    };
    const defaultBucket = {
      type: "item",
      children: [],
      label: localize("defaultBucketLabel", "Other Tools"),
      source: { type: "internal" },
      ordinal: 2 /* Other */,
      picked: true
    };
    const nowSelectedTools = new Set(widget.input.selectedToolsModel.tools.get());
    const toolBuckets = /* @__PURE__ */ new Map();
    for (const tool of toolsService.getTools()) {
      if (!tool.supportsToolPicker) {
        continue;
      }
      let bucket;
      if (tool.source.type === "mcp") {
        const mcpServer = mcpServerByTool.get(tool.id);
        if (!mcpServer) {
          continue;
        }
        bucket = toolBuckets.get(mcpServer.definition.id) ?? {
          type: "item",
          label: localize("mcplabel", "MCP Server: {0}", mcpServer?.definition.label),
          status: localize("mcpstatus", "From {0} ({1})", mcpServer.collection.label, McpConnectionState.toString(mcpServer.connectionState.get())),
          ordinal: 1 /* Mcp */,
          source: tool.source,
          picked: false,
          children: []
        };
        toolBuckets.set(mcpServer.definition.id, bucket);
      } else if (tool.source.type === "extension") {
        const extensionId = tool.source.extensionId;
        const ext = extensionService.extensions.find((value) => ExtensionIdentifier.equals(value.identifier, extensionId));
        if (!ext) {
          continue;
        }
        bucket = toolBuckets.get(ExtensionIdentifier.toKey(extensionId)) ?? {
          type: "item",
          label: ext.displayName ?? ext.name,
          ordinal: 0 /* Extension */,
          picked: false,
          source: tool.source,
          children: []
        };
        toolBuckets.set(ExtensionIdentifier.toKey(ext.identifier), bucket);
      } else if (tool.source.type === "internal") {
        bucket = defaultBucket;
      } else {
        assertNever(tool.source);
      }
      const picked = nowSelectedTools.has(tool);
      bucket.children.push({
        tool,
        parent: bucket,
        type: "item",
        label: tool.displayName,
        description: tool.userDescription,
        picked,
        indented: true
      });
      if (picked) {
        bucket.picked = true;
      }
    }
    function isBucketPick(obj) {
      return Boolean(obj.children);
    }
    function isToolPick(obj) {
      return Boolean(obj.tool);
    }
    function isAddPick(obj) {
      return Boolean(obj.run);
    }
    const store = new DisposableStore();
    const picks = [];
    for (const bucket of Array.from(toolBuckets.values()).sort((a, b) => a.ordinal - b.ordinal)) {
      picks.push({
        type: "separator",
        label: bucket.status
      });
      picks.push(bucket);
      picks.push(...bucket.children);
    }
    const picker = store.add(quickPickService.createQuickPick({ useSeparators: true }));
    picker.placeholder = localize("placeholder", "Select tools that are available to chat");
    picker.canSelectMany = true;
    picker.keepScrollPosition = true;
    picker.matchOnDescription = true;
    if (picks.length === 0) {
      picker.placeholder = localize("noTools", "Add tools to chat");
      picker.canSelectMany = false;
      picks.push(
        addMcpPick,
        addExpPick
      );
    } else {
      picks.push(
        { type: "separator" },
        addPick
      );
    }
    let lastSelectedItems = /* @__PURE__ */ new Set();
    let ignoreEvent = false;
    const _update = () => {
      ignoreEvent = true;
      try {
        const items = picks.filter((p) => p.type === "item" && Boolean(p.picked));
        lastSelectedItems = new Set(items);
        picker.selectedItems = items;
        const disableBuckets = [];
        const disableTools = [];
        for (const item of picks) {
          if (item.type === "item" && !item.picked) {
            if (isBucketPick(item)) {
              disableBuckets.push(item.source);
            } else if (isToolPick(item) && item.parent.picked) {
              disableTools.push(item.tool);
            }
          }
        }
        widget.input.selectedToolsModel.update(disableBuckets, disableTools);
      } finally {
        ignoreEvent = false;
      }
    };
    _update();
    picker.items = picks;
    picker.show();
    store.add(picker.onDidChangeSelection((selectedPicks) => {
      if (ignoreEvent) {
        return;
      }
      const addPick2 = selectedPicks.find(isAddPick);
      if (addPick2) {
        addPick2.run();
        picker.hide();
        return;
      }
      const { added, removed } = diffSets(lastSelectedItems, new Set(selectedPicks));
      for (const item of added) {
        item.picked = true;
        if (isBucketPick(item)) {
          for (const toolPick of item.children) {
            toolPick.picked = true;
          }
        } else if (isToolPick(item)) {
          item.parent.picked = true;
        }
      }
      for (const item of removed) {
        item.picked = false;
        if (isBucketPick(item)) {
          for (const toolPick of item.children) {
            toolPick.picked = false;
          }
        } else if (isToolPick(item) && item.parent.children.every((child) => !child.picked)) {
          item.parent.picked = false;
        }
      }
      _update();
    }));
    store.add(picker.onDidAccept(() => {
      picker.activeItems.find(isAddPick)?.run();
    }));
    await Promise.race([Event.toPromise(Event.any(picker.onDidAccept, picker.onDidHide))]);
    telemetryService.publicLog2("chat/selectedTools", {
      enabled: widget.input.selectedToolsModel.tools.get().length,
      total: Iterable.length(toolsService.getTools())
    });
    store.dispose();
  }
};
_AttachToolsAction.id = "workbench.action.chat.attachTools";
let AttachToolsAction = _AttachToolsAction;
function registerChatToolActions() {
  registerAction2(AcceptToolConfirmation);
  registerAction2(AttachToolsAction);
}
export {
  AcceptToolConfirmationActionId,
  AttachToolsAction,
  registerChatToolActions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0VG9vbEFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBhc3NlcnROZXZlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Fzc2VydC5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgZGlmZlNldHMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0sIElRdWlja1BpY2tTZXBhcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgQWRkQ29uZmlndXJhdGlvbkFjdGlvbiB9IGZyb20gJy4uLy4uLy4uL21jcC9icm93c2VyL21jcENvbW1hbmRzLmpzJztcbmltcG9ydCB7IElNY3BTZXJ2aWNlLCBJTWNwU2VydmVyLCBNY3BDb25uZWN0aW9uU3RhdGUgfSBmcm9tICcuLi8uLi8uLi9tY3AvY29tbW9uL21jcFR5cGVzLmpzJztcbmltcG9ydCB7IENoYXRDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0Q29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSUNoYXRUb29sSW52b2NhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc1Jlc3BvbnNlVk0gfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBDaGF0TW9kZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UsIElUb29sRGF0YSwgVG9vbERhdGFTb3VyY2UgfSBmcm9tICcuLi8uLi9jb21tb24vbGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2hhdFdpZGdldCwgSUNoYXRXaWRnZXRTZXJ2aWNlIH0gZnJvbSAnLi4vY2hhdC5qcyc7XG5pbXBvcnQgeyBDSEFUX0NBVEVHT1JZIH0gZnJvbSAnLi9jaGF0QWN0aW9ucy5qcyc7XG5cblxudHlwZSBTZWxlY3RlZFRvb2xEYXRhID0ge1xuXHRlbmFibGVkOiBudW1iZXI7XG5cdHRvdGFsOiBudW1iZXI7XG59O1xudHlwZSBTZWxlY3RlZFRvb2xDbGFzc2lmaWNhdGlvbiA9IHtcblx0b3duZXI6ICdjb25ub3I0MzEyJztcblx0Y29tbWVudDogJ0RldGFpbHMgdGhlIGNhcGFiaWxpdGllcyBvZiB0aGUgTUNQIHNlcnZlcic7XG5cdGVuYWJsZWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdOdW1iZXIgb2YgZW5hYmxlZCBjaGF0IHRvb2xzJyB9O1xuXHR0b3RhbDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ051bWJlciBvZiB0b3RhbCBjaGF0IHRvb2xzJyB9O1xufTtcblxuZXhwb3J0IGNvbnN0IEFjY2VwdFRvb2xDb25maXJtYXRpb25BY3Rpb25JZCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuYWNjZXB0VG9vbCc7XG5cbmNsYXNzIEFjY2VwdFRvb2xDb25maXJtYXRpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEFjY2VwdFRvb2xDb25maXJtYXRpb25BY3Rpb25JZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2NoYXQuYWNjZXB0JywgXCJBY2NlcHRcIiksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5pbkNoYXRTZXNzaW9uLCBDaGF0Q29udGV4dEtleXMuRWRpdGluZy5oYXNUb29sQ29uZmlybWF0aW9uKSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkVudGVyLFxuXHRcdFx0XHQvLyBPdmVycmlkZSBjaGF0RWRpdG9yLmFjdGlvbi5hY2NlcHRcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyAxLFxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRjb25zdCBjaGF0V2lkZ2V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFdpZGdldFNlcnZpY2UpO1xuXHRcdGNvbnN0IHdpZGdldCA9IGNoYXRXaWRnZXRTZXJ2aWNlLmxhc3RGb2N1c2VkV2lkZ2V0O1xuXHRcdGNvbnN0IGxhc3RJdGVtID0gd2lkZ2V0Py52aWV3TW9kZWw/LmdldEl0ZW1zKCkuYXQoLTEpO1xuXHRcdGlmICghaXNSZXNwb25zZVZNKGxhc3RJdGVtKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVuY29uZmlybWVkVG9vbEludm9jYXRpb24gPSBsYXN0SXRlbS5tb2RlbC5yZXNwb25zZS52YWx1ZS5maW5kKChpdGVtKTogaXRlbSBpcyBJQ2hhdFRvb2xJbnZvY2F0aW9uID0+IGl0ZW0ua2luZCA9PT0gJ3Rvb2xJbnZvY2F0aW9uJyAmJiAhaXRlbS5pc0NvbmZpcm1lZCk7XG5cdFx0aWYgKHVuY29uZmlybWVkVG9vbEludm9jYXRpb24pIHtcblx0XHRcdHVuY29uZmlybWVkVG9vbEludm9jYXRpb24uY29uZmlybWVkLmNvbXBsZXRlKHRydWUpO1xuXHRcdH1cblxuXHRcdC8vIFJldHVybiBmb2N1cyB0byB0aGUgY2hhdCBpbnB1dCwgaW4gY2FzZSBpdCB3YXMgaW4gdGhlIHRvb2wgY29uZmlybWF0aW9uIGVkaXRvclxuXHRcdHdpZGdldD8uZm9jdXNJbnB1dCgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBBdHRhY2hUb29sc0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBpZCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuYXR0YWNoVG9vbHMnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBBdHRhY2hUb29sc0FjdGlvbi5pZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnbGFiZWwnLCBcIlNlbGVjdCBUb29scy4uLlwiKSxcblx0XHRcdGljb246IENvZGljb24udG9vbHMsXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ2hhdENvbnRleHRLZXlzLmNoYXRNb2RlLmlzRXF1YWxUbyhDaGF0TW9kZS5BZ2VudCksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdHdoZW46IENoYXRDb250ZXh0S2V5cy5jaGF0TW9kZS5pc0VxdWFsVG8oQ2hhdE1vZGUuQWdlbnQpLFxuXHRcdFx0XHRpZDogTWVudUlkLkNoYXRJbnB1dEF0dGFjaG1lbnRUb29sYmFyLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0fSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5pbkNoYXRJbnB1dCwgQ2hhdENvbnRleHRLZXlzLmNoYXRNb2RlLmlzRXF1YWxUbyhDaGF0TW9kZS5BZ2VudCkpLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuU2xhc2gsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHRjb25zdCBxdWlja1BpY2tTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0Y29uc3QgbWNwU2VydmljZSA9IGFjY2Vzc29yLmdldChJTWNwU2VydmljZSk7XG5cdFx0Y29uc3QgdG9vbHNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlKTtcblx0XHRjb25zdCBleHRlbnNpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBjaGF0V2lkZ2V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFdpZGdldFNlcnZpY2UpO1xuXHRcdGNvbnN0IHRlbGVtZXRyeVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRlbGVtZXRyeVNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uV29ya2JlbmNoU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UpO1xuXG5cdFx0bGV0IHdpZGdldCA9IGNoYXRXaWRnZXRTZXJ2aWNlLmxhc3RGb2N1c2VkV2lkZ2V0O1xuXHRcdGlmICghd2lkZ2V0KSB7XG5cdFx0XHR0eXBlIENoYXRBY3Rpb25Db250ZXh0ID0geyB3aWRnZXQ6IElDaGF0V2lkZ2V0IH07XG5cdFx0XHRmdW5jdGlvbiBpc0NoYXRBY3Rpb25Db250ZXh0KG9iajogYW55KTogb2JqIGlzIENoYXRBY3Rpb25Db250ZXh0IHtcblx0XHRcdFx0cmV0dXJuIG9iaiAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0JyAmJiAob2JqIGFzIENoYXRBY3Rpb25Db250ZXh0KS53aWRnZXQ7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBjb250ZXh0ID0gYXJnc1swXTtcblx0XHRcdGlmIChpc0NoYXRBY3Rpb25Db250ZXh0KGNvbnRleHQpKSB7XG5cdFx0XHRcdHdpZGdldCA9IGNvbnRleHQud2lkZ2V0O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghd2lkZ2V0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWNwU2VydmVyQnlUb29sID0gbmV3IE1hcDxzdHJpbmcsIElNY3BTZXJ2ZXI+KCk7XG5cdFx0Zm9yIChjb25zdCBzZXJ2ZXIgb2YgbWNwU2VydmljZS5zZXJ2ZXJzLmdldCgpKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHRvb2wgb2Ygc2VydmVyLnRvb2xzLmdldCgpKSB7XG5cdFx0XHRcdG1jcFNlcnZlckJ5VG9vbC5zZXQodG9vbC5pZCwgc2VydmVyKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBlbnVtIEJ1Y2tldE9yZGluYWwgeyBFeHRlbnNpb24sIE1jcCwgT3RoZXIgfVxuXHRcdHR5cGUgQnVja2V0UGljayA9IElRdWlja1BpY2tJdGVtICYgeyBwaWNrZWQ6IGJvb2xlYW47IG9yZGluYWw6IEJ1Y2tldE9yZGluYWw7IHN0YXR1cz86IHN0cmluZzsgY2hpbGRyZW46IFRvb2xQaWNrW107IHNvdXJjZTogVG9vbERhdGFTb3VyY2UgfTtcblx0XHR0eXBlIFRvb2xQaWNrID0gSVF1aWNrUGlja0l0ZW0gJiB7IHBpY2tlZDogYm9vbGVhbjsgdG9vbDogSVRvb2xEYXRhOyBwYXJlbnQ6IEJ1Y2tldFBpY2sgfTtcblx0XHR0eXBlIEFkZFBpY2sgPSBJUXVpY2tQaWNrSXRlbSAmIHsgcGlja2FibGU6IGZhbHNlOyBydW46ICgpID0+IHZvaWQgfTtcblx0XHR0eXBlIE15UGljayA9IFRvb2xQaWNrIHwgQnVja2V0UGljayB8IEFkZFBpY2s7XG5cblx0XHRjb25zdCBhZGRNY3BQaWNrOiBBZGRQaWNrID0geyB0eXBlOiAnaXRlbScsIGxhYmVsOiBsb2NhbGl6ZSgnYWRkU2VydmVyJywgXCJBZGQgTUNQIFNlcnZlci4uLlwiKSwgaWNvbkNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5hZGQpLCBwaWNrYWJsZTogZmFsc2UsIHJ1bjogKCkgPT4gY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoQWRkQ29uZmlndXJhdGlvbkFjdGlvbi5JRCkgfTtcblx0XHRjb25zdCBhZGRFeHBQaWNrOiBBZGRQaWNrID0geyB0eXBlOiAnaXRlbScsIGxhYmVsOiBsb2NhbGl6ZSgnYWRkRXh0ZW5zaW9uJywgXCJJbnN0YWxsIEV4dGVuc2lvbi4uLlwiKSwgaWNvbkNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5hZGQpLCBwaWNrYWJsZTogZmFsc2UsIHJ1bjogKCkgPT4gZXh0ZW5zaW9uV29ya2JlbmNoU2VydmljZS5vcGVuU2VhcmNoKCdAdGFnOmxhbmd1YWdlLW1vZGVsLXRvb2xzJykgfTtcblx0XHRjb25zdCBhZGRQaWNrOiBBZGRQaWNrID0ge1xuXHRcdFx0dHlwZTogJ2l0ZW0nLCBsYWJlbDogbG9jYWxpemUoJ2FkZEFueScsIFwiQWRkIE1vcmUgVG9vbHMuLi5cIiksIGljb25DbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uYWRkKSwgcGlja2FibGU6IGZhbHNlLCBydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgcGljayA9IGF3YWl0IHF1aWNrUGlja1NlcnZpY2UucGljayhcblx0XHRcdFx0XHRbYWRkTWNwUGljaywgYWRkRXhwUGlja10sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0Y2FuUGlja01hbnk6IGZhbHNlLFxuXHRcdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdub1Rvb2xzJywgXCJBZGQgdG9vbHMgdG8gY2hhdFwiKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0KTtcblx0XHRcdFx0cGljaz8ucnVuKCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IGRlZmF1bHRCdWNrZXQ6IEJ1Y2tldFBpY2sgPSB7XG5cdFx0XHR0eXBlOiAnaXRlbScsXG5cdFx0XHRjaGlsZHJlbjogW10sXG5cdFx0XHRsYWJlbDogbG9jYWxpemUoJ2RlZmF1bHRCdWNrZXRMYWJlbCcsIFwiT3RoZXIgVG9vbHNcIiksXG5cdFx0XHRzb3VyY2U6IHsgdHlwZTogJ2ludGVybmFsJyB9LFxuXHRcdFx0b3JkaW5hbDogQnVja2V0T3JkaW5hbC5PdGhlcixcblx0XHRcdHBpY2tlZDogdHJ1ZSxcblx0XHR9O1xuXG5cdFx0Y29uc3Qgbm93U2VsZWN0ZWRUb29scyA9IG5ldyBTZXQod2lkZ2V0LmlucHV0LnNlbGVjdGVkVG9vbHNNb2RlbC50b29scy5nZXQoKSk7XG5cdFx0Y29uc3QgdG9vbEJ1Y2tldHMgPSBuZXcgTWFwPHN0cmluZywgQnVja2V0UGljaz4oKTtcblxuXHRcdGZvciAoY29uc3QgdG9vbCBvZiB0b29sc1NlcnZpY2UuZ2V0VG9vbHMoKSkge1xuXHRcdFx0aWYgKCF0b29sLnN1cHBvcnRzVG9vbFBpY2tlcikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0bGV0IGJ1Y2tldDogQnVja2V0UGljaztcblxuXHRcdFx0aWYgKHRvb2wuc291cmNlLnR5cGUgPT09ICdtY3AnKSB7XG5cdFx0XHRcdGNvbnN0IG1jcFNlcnZlciA9IG1jcFNlcnZlckJ5VG9vbC5nZXQodG9vbC5pZCk7XG5cdFx0XHRcdGlmICghbWNwU2VydmVyKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnVja2V0ID0gdG9vbEJ1Y2tldHMuZ2V0KG1jcFNlcnZlci5kZWZpbml0aW9uLmlkKSA/PyB7XG5cdFx0XHRcdFx0dHlwZTogJ2l0ZW0nLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnbWNwbGFiZWwnLCBcIk1DUCBTZXJ2ZXI6IHswfVwiLCBtY3BTZXJ2ZXI/LmRlZmluaXRpb24ubGFiZWwpLFxuXHRcdFx0XHRcdHN0YXR1czogbG9jYWxpemUoJ21jcHN0YXR1cycsIFwiRnJvbSB7MH0gKHsxfSlcIiwgbWNwU2VydmVyLmNvbGxlY3Rpb24ubGFiZWwsIE1jcENvbm5lY3Rpb25TdGF0ZS50b1N0cmluZyhtY3BTZXJ2ZXIuY29ubmVjdGlvblN0YXRlLmdldCgpKSksXG5cdFx0XHRcdFx0b3JkaW5hbDogQnVja2V0T3JkaW5hbC5NY3AsXG5cdFx0XHRcdFx0c291cmNlOiB0b29sLnNvdXJjZSxcblx0XHRcdFx0XHRwaWNrZWQ6IGZhbHNlLFxuXHRcdFx0XHRcdGNoaWxkcmVuOiBbXVxuXHRcdFx0XHR9O1xuXHRcdFx0XHR0b29sQnVja2V0cy5zZXQobWNwU2VydmVyLmRlZmluaXRpb24uaWQsIGJ1Y2tldCk7XG5cdFx0XHR9IGVsc2UgaWYgKHRvb2wuc291cmNlLnR5cGUgPT09ICdleHRlbnNpb24nKSB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbklkID0gdG9vbC5zb3VyY2UuZXh0ZW5zaW9uSWQ7XG5cdFx0XHRcdGNvbnN0IGV4dCA9IGV4dGVuc2lvblNlcnZpY2UuZXh0ZW5zaW9ucy5maW5kKHZhbHVlID0+IEV4dGVuc2lvbklkZW50aWZpZXIuZXF1YWxzKHZhbHVlLmlkZW50aWZpZXIsIGV4dGVuc2lvbklkKSk7XG5cdFx0XHRcdGlmICghZXh0KSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRidWNrZXQgPSB0b29sQnVja2V0cy5nZXQoRXh0ZW5zaW9uSWRlbnRpZmllci50b0tleShleHRlbnNpb25JZCkpID8/IHtcblx0XHRcdFx0XHR0eXBlOiAnaXRlbScsXG5cdFx0XHRcdFx0bGFiZWw6IGV4dC5kaXNwbGF5TmFtZSA/PyBleHQubmFtZSxcblx0XHRcdFx0XHRvcmRpbmFsOiBCdWNrZXRPcmRpbmFsLkV4dGVuc2lvbixcblx0XHRcdFx0XHRwaWNrZWQ6IGZhbHNlLFxuXHRcdFx0XHRcdHNvdXJjZTogdG9vbC5zb3VyY2UsXG5cdFx0XHRcdFx0Y2hpbGRyZW46IFtdXG5cdFx0XHRcdH07XG5cdFx0XHRcdHRvb2xCdWNrZXRzLnNldChFeHRlbnNpb25JZGVudGlmaWVyLnRvS2V5KGV4dC5pZGVudGlmaWVyKSwgYnVja2V0KTtcblx0XHRcdH0gZWxzZSBpZiAodG9vbC5zb3VyY2UudHlwZSA9PT0gJ2ludGVybmFsJykge1xuXHRcdFx0XHRidWNrZXQgPSBkZWZhdWx0QnVja2V0O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXNzZXJ0TmV2ZXIodG9vbC5zb3VyY2UpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBwaWNrZWQgPSBub3dTZWxlY3RlZFRvb2xzLmhhcyh0b29sKTtcblxuXHRcdFx0YnVja2V0LmNoaWxkcmVuLnB1c2goe1xuXHRcdFx0XHR0b29sLFxuXHRcdFx0XHRwYXJlbnQ6IGJ1Y2tldCxcblx0XHRcdFx0dHlwZTogJ2l0ZW0nLFxuXHRcdFx0XHRsYWJlbDogdG9vbC5kaXNwbGF5TmFtZSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IHRvb2wudXNlckRlc2NyaXB0aW9uLFxuXHRcdFx0XHRwaWNrZWQsXG5cdFx0XHRcdGluZGVudGVkOiB0cnVlLFxuXHRcdFx0fSk7XG5cblx0XHRcdGlmIChwaWNrZWQpIHtcblx0XHRcdFx0YnVja2V0LnBpY2tlZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gaXNCdWNrZXRQaWNrKG9iajogYW55KTogb2JqIGlzIEJ1Y2tldFBpY2sge1xuXHRcdFx0cmV0dXJuIEJvb2xlYW4oKG9iaiBhcyBCdWNrZXRQaWNrKS5jaGlsZHJlbik7XG5cdFx0fVxuXHRcdGZ1bmN0aW9uIGlzVG9vbFBpY2sob2JqOiBhbnkpOiBvYmogaXMgVG9vbFBpY2sge1xuXHRcdFx0cmV0dXJuIEJvb2xlYW4oKG9iaiBhcyBUb29sUGljaykudG9vbCk7XG5cdFx0fVxuXHRcdGZ1bmN0aW9uIGlzQWRkUGljayhvYmo6IGFueSk6IG9iaiBpcyBBZGRQaWNrIHtcblx0XHRcdHJldHVybiBCb29sZWFuKChvYmogYXMgQWRkUGljaykucnVuKTtcblx0XHR9XG5cblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGNvbnN0IHBpY2tzOiAoTXlQaWNrIHwgSVF1aWNrUGlja1NlcGFyYXRvcilbXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBidWNrZXQgb2YgQXJyYXkuZnJvbSh0b29sQnVja2V0cy52YWx1ZXMoKSkuc29ydCgoYSwgYikgPT4gYS5vcmRpbmFsIC0gYi5vcmRpbmFsKSkge1xuXHRcdFx0cGlja3MucHVzaCh7XG5cdFx0XHRcdHR5cGU6ICdzZXBhcmF0b3InLFxuXHRcdFx0XHRsYWJlbDogYnVja2V0LnN0YXR1c1xuXHRcdFx0fSk7XG5cblx0XHRcdHBpY2tzLnB1c2goYnVja2V0KTtcblx0XHRcdHBpY2tzLnB1c2goLi4uYnVja2V0LmNoaWxkcmVuKTtcblx0XHR9XG5cblx0XHRjb25zdCBwaWNrZXIgPSBzdG9yZS5hZGQocXVpY2tQaWNrU2VydmljZS5jcmVhdGVRdWlja1BpY2s8TXlQaWNrPih7IHVzZVNlcGFyYXRvcnM6IHRydWUgfSkpO1xuXHRcdHBpY2tlci5wbGFjZWhvbGRlciA9IGxvY2FsaXplKCdwbGFjZWhvbGRlcicsIFwiU2VsZWN0IHRvb2xzIHRoYXQgYXJlIGF2YWlsYWJsZSB0byBjaGF0XCIpO1xuXHRcdHBpY2tlci5jYW5TZWxlY3RNYW55ID0gdHJ1ZTtcblx0XHRwaWNrZXIua2VlcFNjcm9sbFBvc2l0aW9uID0gdHJ1ZTtcblx0XHRwaWNrZXIubWF0Y2hPbkRlc2NyaXB0aW9uID0gdHJ1ZTtcblxuXHRcdGlmIChwaWNrcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHBpY2tlci5wbGFjZWhvbGRlciA9IGxvY2FsaXplKCdub1Rvb2xzJywgXCJBZGQgdG9vbHMgdG8gY2hhdFwiKTtcblx0XHRcdHBpY2tlci5jYW5TZWxlY3RNYW55ID0gZmFsc2U7XG5cdFx0XHRwaWNrcy5wdXNoKFxuXHRcdFx0XHRhZGRNY3BQaWNrLFxuXHRcdFx0XHRhZGRFeHBQaWNrLFxuXHRcdFx0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cGlja3MucHVzaChcblx0XHRcdFx0eyB0eXBlOiAnc2VwYXJhdG9yJyB9LFxuXHRcdFx0XHRhZGRQaWNrLFxuXHRcdFx0KTtcblx0XHR9XG5cblxuXHRcdGxldCBsYXN0U2VsZWN0ZWRJdGVtcyA9IG5ldyBTZXQ8TXlQaWNrPigpO1xuXHRcdGxldCBpZ25vcmVFdmVudCA9IGZhbHNlO1xuXG5cdFx0Y29uc3QgX3VwZGF0ZSA9ICgpID0+IHtcblx0XHRcdGlnbm9yZUV2ZW50ID0gdHJ1ZTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGl0ZW1zID0gcGlja3MuZmlsdGVyKChwKTogcCBpcyBNeVBpY2sgPT4gcC50eXBlID09PSAnaXRlbScgJiYgQm9vbGVhbihwLnBpY2tlZCkpO1xuXHRcdFx0XHRsYXN0U2VsZWN0ZWRJdGVtcyA9IG5ldyBTZXQoaXRlbXMpO1xuXHRcdFx0XHRwaWNrZXIuc2VsZWN0ZWRJdGVtcyA9IGl0ZW1zO1xuXG5cdFx0XHRcdGNvbnN0IGRpc2FibGVCdWNrZXRzOiBUb29sRGF0YVNvdXJjZVtdID0gW107XG5cdFx0XHRcdGNvbnN0IGRpc2FibGVUb29sczogSVRvb2xEYXRhW10gPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCBpdGVtIG9mIHBpY2tzKSB7XG5cdFx0XHRcdFx0aWYgKGl0ZW0udHlwZSA9PT0gJ2l0ZW0nICYmICFpdGVtLnBpY2tlZCkge1xuXHRcdFx0XHRcdFx0aWYgKGlzQnVja2V0UGljayhpdGVtKSkge1xuXHRcdFx0XHRcdFx0XHRkaXNhYmxlQnVja2V0cy5wdXNoKGl0ZW0uc291cmNlKTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoaXNUb29sUGljayhpdGVtKSAmJiBpdGVtLnBhcmVudC5waWNrZWQpIHtcblx0XHRcdFx0XHRcdFx0ZGlzYWJsZVRvb2xzLnB1c2goaXRlbS50b29sKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR3aWRnZXQuaW5wdXQuc2VsZWN0ZWRUb29sc01vZGVsLnVwZGF0ZShkaXNhYmxlQnVja2V0cywgZGlzYWJsZVRvb2xzKTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdGlnbm9yZUV2ZW50ID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdF91cGRhdGUoKTtcblx0XHRwaWNrZXIuaXRlbXMgPSBwaWNrcztcblx0XHRwaWNrZXIuc2hvdygpO1xuXG5cdFx0c3RvcmUuYWRkKHBpY2tlci5vbkRpZENoYW5nZVNlbGVjdGlvbihzZWxlY3RlZFBpY2tzID0+IHtcblx0XHRcdGlmIChpZ25vcmVFdmVudCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGFkZFBpY2sgPSBzZWxlY3RlZFBpY2tzLmZpbmQoaXNBZGRQaWNrKTtcblx0XHRcdGlmIChhZGRQaWNrKSB7XG5cdFx0XHRcdGFkZFBpY2sucnVuKCk7XG5cdFx0XHRcdHBpY2tlci5oaWRlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgeyBhZGRlZCwgcmVtb3ZlZCB9ID0gZGlmZlNldHMobGFzdFNlbGVjdGVkSXRlbXMsIG5ldyBTZXQoc2VsZWN0ZWRQaWNrcykpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgYWRkZWQpIHtcblx0XHRcdFx0aXRlbS5waWNrZWQgPSB0cnVlO1xuXG5cdFx0XHRcdGlmIChpc0J1Y2tldFBpY2soaXRlbSkpIHtcblx0XHRcdFx0XHQvLyBhZGQgc2VydmVyIC0+IGFkZCBiYWNrIHRvb2xzXG5cdFx0XHRcdFx0Zm9yIChjb25zdCB0b29sUGljayBvZiBpdGVtLmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0XHR0b29sUGljay5waWNrZWQgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChpc1Rvb2xQaWNrKGl0ZW0pKSB7XG5cdFx0XHRcdFx0Ly8gYWRkIHNlcnZlciB3aGVuIHRvb2wgaXMgcGlja2VkXG5cdFx0XHRcdFx0aXRlbS5wYXJlbnQucGlja2VkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgcmVtb3ZlZCkge1xuXHRcdFx0XHRpdGVtLnBpY2tlZCA9IGZhbHNlO1xuXG5cdFx0XHRcdGlmIChpc0J1Y2tldFBpY2soaXRlbSkpIHtcblx0XHRcdFx0XHQvLyByZW1vdmVkIHNlcnZlciAtPiByZW1vdmUgdG9vbHNcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHRvb2xQaWNrIG9mIGl0ZW0uY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRcdHRvb2xQaWNrLnBpY2tlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChpc1Rvb2xQaWNrKGl0ZW0pICYmIGl0ZW0ucGFyZW50LmNoaWxkcmVuLmV2ZXJ5KGNoaWxkID0+ICFjaGlsZC5waWNrZWQpKSB7XG5cdFx0XHRcdFx0Ly8gcmVtb3ZlIExBU1QgdG9vbCAtPiByZW1vdmUgc2VydmVyXG5cdFx0XHRcdFx0aXRlbS5wYXJlbnQucGlja2VkID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0X3VwZGF0ZSgpO1xuXHRcdH0pKTtcblxuXHRcdHN0b3JlLmFkZChwaWNrZXIub25EaWRBY2NlcHQoKCkgPT4ge1xuXHRcdFx0cGlja2VyLmFjdGl2ZUl0ZW1zLmZpbmQoaXNBZGRQaWNrKT8ucnVuKCk7XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgUHJvbWlzZS5yYWNlKFtFdmVudC50b1Byb21pc2UoRXZlbnQuYW55KHBpY2tlci5vbkRpZEFjY2VwdCwgcGlja2VyLm9uRGlkSGlkZSkpXSk7XG5cdFx0dGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFNlbGVjdGVkVG9vbERhdGEsIFNlbGVjdGVkVG9vbENsYXNzaWZpY2F0aW9uPignY2hhdC9zZWxlY3RlZFRvb2xzJywge1xuXHRcdFx0ZW5hYmxlZDogd2lkZ2V0LmlucHV0LnNlbGVjdGVkVG9vbHNNb2RlbC50b29scy5nZXQoKS5sZW5ndGgsXG5cdFx0XHR0b3RhbDogSXRlcmFibGUubGVuZ3RoKHRvb2xzU2VydmljZS5nZXRUb29scygpKSxcblx0XHR9KTtcblx0XHRzdG9yZS5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyQ2hhdFRvb2xBY3Rpb25zKCkge1xuXHRyZWdpc3RlckFjdGlvbjIoQWNjZXB0VG9vbENvbmZpcm1hdGlvbik7XG5cdHJlZ2lzdGVyQWN0aW9uMihBdHRhY2hUb29sc0FjdGlvbik7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsU0FBUyxjQUFjO0FBQ2hDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsaUJBQWlCO0FBRTFCLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUyxTQUFTLFFBQVEsdUJBQXVCO0FBQ2pELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMEJBQStEO0FBQ3hFLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsYUFBeUIsMEJBQTBCO0FBQzVELFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsa0NBQTZEO0FBQ3RFLFNBQXNCLDBCQUEwQjtBQUNoRCxTQUFTLHFCQUFxQjtBQWN2QixNQUFNLGlDQUFpQztBQUU5QyxNQUFNLCtCQUErQixRQUFRO0FBQUEsRUFDNUMsY0FBYztBQUNiLFVBQU07QUFBQSxNQUNMLElBQUk7QUFBQSxNQUNKLE9BQU8sVUFBVSxlQUFlLFFBQVE7QUFBQSxNQUN4QyxJQUFJO0FBQUEsTUFDSixVQUFVO0FBQUEsTUFDVixZQUFZO0FBQUEsUUFDWCxNQUFNLGVBQWUsSUFBSSxnQkFBZ0IsZUFBZSxnQkFBZ0IsUUFBUSxtQkFBbUI7QUFBQSxRQUNuRyxTQUFTLE9BQU8sVUFBVSxRQUFRO0FBQUE7QUFBQSxRQUVsQyxRQUFRLGlCQUFp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
