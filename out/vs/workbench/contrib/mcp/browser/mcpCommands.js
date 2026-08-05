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
import { h } from "../../../../base/browser/dom.js";
import { assertNever } from "../../../../base/common/assert.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { groupBy } from "../../../../base/common/collections.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun, derived } from "../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../nls.js";
import { IActionViewItemService } from "../../../../platform/actions/browser/actionViewItemService.js";
import { MenuEntryActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, MenuId, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { spinningLoading } from "../../../../platform/theme/common/iconRegistry.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { ActiveEditorContext, ResourceContextKey } from "../../../common/contextkeys.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ChatContextKeys } from "../../chat/common/chatContextKeys.js";
import { ChatMode } from "../../chat/common/constants.js";
import { TEXT_FILE_EDITOR_ID } from "../../files/common/files.js";
import { McpContextKeys } from "../common/mcpContextKeys.js";
import { IMcpRegistry } from "../common/mcpRegistryTypes.js";
import { IMcpService, LazyCollectionState, McpConnectionState, McpServerToolsState } from "../common/mcpTypes.js";
import { McpAddConfigurationCommand } from "./mcpCommandsAddConfiguration.js";
import { McpUrlHandler } from "./mcpUrlHandler.js";
const category = {
  original: "MCP",
  value: "MCP"
};
const _ListMcpServerCommand = class _ListMcpServerCommand extends Action2 {
  constructor() {
    super({
      id: _ListMcpServerCommand.id,
      title: localize2("mcp.list", "List Servers"),
      icon: Codicon.server,
      category,
      f1: true,
      menu: {
        when: ContextKeyExpr.and(
          ContextKeyExpr.or(McpContextKeys.hasUnknownTools, McpContextKeys.hasServersWithErrors),
          ChatContextKeys.chatMode.isEqualTo(ChatMode.Agent)
        ),
        id: MenuId.ChatInputAttachmentToolbar,
        group: "navigation",
        order: 0
      }
    });
  }
  async run(accessor) {
    const mcpService = accessor.get(IMcpService);
    const commandService = accessor.get(ICommandService);
    const quickInput = accessor.get(IQuickInputService);
    const store = new DisposableStore();
    const pick = quickInput.createQuickPick({ useSeparators: true });
    pick.placeholder = localize("mcp.selectServer", "Select an MCP Server");
    store.add(pick);
    store.add(autorun((reader) => {
      const servers = groupBy(mcpService.servers.read(reader).slice().sort((a, b) => (a.collection.presentation?.order || 0) - (b.collection.presentation?.order || 0)), (s) => s.collection.id);
      const firstRun = pick.items.length === 0;
      pick.items = [
        { id: "$add", label: localize("mcp.addServer", "Add Server"), description: localize("mcp.addServer.description", "Add a new server configuration"), alwaysShow: true, iconClass: ThemeIcon.asClassName(Codicon.add) },
        ...Object.values(servers).filter((s) => s.length).flatMap((servers2) => [
          { type: "separator", label: servers2[0].collection.label, id: servers2[0].collection.id },
          ...servers2.map((server) => ({
            id: server.definition.id,
            label: server.definition.label,
            description: McpConnectionState.toString(server.connectionState.read(reader))
          }))
        ])
      ];
      if (firstRun && pick.items.length > 3) {
        pick.activeItems = pick.items.slice(2, 3);
      }
    }));
    const picked = await new Promise((resolve) => {
      store.add(pick.onDidAccept(() => {
        resolve(pick.activeItems[0]);
      }));
      store.add(pick.onDidHide(() => {
        resolve(void 0);
      }));
      pick.show();
    });
    store.dispose();
    if (!picked) {
    } else if (picked.id === "$add") {
      commandService.executeCommand(AddConfigurationAction.ID);
    } else {
      commandService.executeCommand(McpServerOptionsCommand.id, picked.id);
    }
  }
};
_ListMcpServerCommand.id = "workbench.mcp.listServer";
let ListMcpServerCommand = _ListMcpServerCommand;
const _McpServerOptionsCommand = class _McpServerOptionsCommand extends Action2 {
  constructor() {
    super({
      id: _McpServerOptionsCommand.id,
      title: localize2("mcp.options", "Server Options"),
      category,
      f1: false
    });
  }
  async run(accessor, id) {
    const mcpService = accessor.get(IMcpService);
    const quickInputService = accessor.get(IQuickInputService);
    const mcpRegistry = accessor.get(IMcpRegistry);
    const editorService = accessor.get(IEditorService);
    const server = mcpService.servers.get().find((s) => s.definition.id === id);
    if (!server) {
      return;
    }
    const collection = mcpRegistry.collections.get().find((c) => c.id === server.collection.id);
    const serverDefinition = collection?.serverDefinitions.get().find((s) => s.id === server.definition.id);
    const items = [];
    const serverState = server.connectionState.get();
    if (McpConnectionState.canBeStarted(serverState.state)) {
      items.push({
        label: localize("mcp.start", "Start Server"),
        action: "start"
      });
    } else {
      items.push({
        label: localize("mcp.stop", "Stop Server"),
        action: "stop"
      });
      items.push({
        label: localize("mcp.restart", "Restart Server"),
        action: "restart"
      });
    }
    items.push({
      label: localize("mcp.showOutput", "Show Output"),
      action: "showOutput"
    });
    const configTarget = serverDefinition?.presentation?.origin || collection?.presentation?.origin;
    if (configTarget) {
      items.push({
        label: localize("mcp.config", "Show Configuration"),
        action: "config"
      });
    }
    const pick = await quickInputService.pick(items, {
      title: server.definition.label,
      placeHolder: localize("mcp.selectAction", "Select Server Action")
    });
    if (!pick) {
      return;
    }
    switch (pick.action) {
      case "start":
        await server.start(true);
        server.showOutput();
        break;
      case "stop":
        await server.stop();
        break;
      case "restart":
        await server.stop();
        await server.start(true);
        break;
      case "showOutput":
        server.showOutput();
        break;
      case "config":
        editorService.openEditor({
          resource: URI.isUri(configTarget) ? configTarget : configTarget.uri,
          options: { selection: URI.isUri(configTarget) ? void 0 : configTarget.range }
        });
        break;
      default:
        assertNever(pick.action);
    }
  }
};
_McpServerOptionsCommand.id = "workbench.mcp.serverOptions";
let McpServerOptionsCommand = _McpServerOptionsCommand;
let MCPServerActionRendering = class extends Disposable {
  constructor(actionViewItemService, mcpService, instaService, commandService) {
    super();
    let DisplayedState;
    ((DisplayedState2) => {
      DisplayedState2[DisplayedState2["None"] = 0] = "None";
      DisplayedState2[DisplayedState2["NewTools"] = 1] = "NewTools";
      DisplayedState2[DisplayedState2["Error"] = 2] = "Error";
      DisplayedState2[DisplayedState2["Refreshing"] = 3] = "Refreshing";
    })(DisplayedState || (DisplayedState = {}));
    const displayedState = derived((reader) => {
      const servers = mcpService.servers.read(reader);
      const serversPerState = [];
      for (const server of servers) {
        let thisState = 0 /* None */;
        switch (server.toolsState.read(reader)) {
          case McpServerToolsState.Unknown:
            if (server.trusted.read(reader) === false) {
              thisState = 0 /* None */;
            } else {
              thisState = server.connectionState.read(reader).state === McpConnectionState.Kind.Error ? 2 /* Error */ : 1 /* NewTools */;
            }
            break;
          case McpServerToolsState.RefreshingFromUnknown:
            thisState = 3 /* Refreshing */;
            break;
          default:
            thisState = server.connectionState.read(reader).state === McpConnectionState.Kind.Error ? 2 /* Error */ : 0 /* None */;
            break;
        }
        serversPerState[thisState] ??= [];
        serversPerState[thisState].push(server);
      }
      const unknownServerStates = mcpService.lazyCollectionState.read(reader);
      if (unknownServerStates === LazyCollectionState.LoadingUnknown) {
        serversPerState[3 /* Refreshing */] ??= [];
      } else if (unknownServerStates === LazyCollectionState.HasUnknown) {
        serversPerState[1 /* NewTools */] ??= [];
      }
      const maxState = serversPerState.length - 1;
      return { state: maxState, servers: serversPerState[maxState] || [] };
    });
    this._store.add(actionViewItemService.register(MenuId.ChatInputAttachmentToolbar, ListMcpServerCommand.id, (action, options) => {
      if (!(action instanceof MenuItemAction)) {
        return void 0;
      }
      return instaService.createInstance(class extends MenuEntryActionViewItem {
        render(container) {
          super.render(container);
          container.classList.add("chat-mcp");
          const action2 = h("button.chat-mcp-action", [h("span@icon")]);
          this._register(autorun((r) => {
            const { state } = displayedState.read(r);
            const { root, icon } = action2;
            this.updateTooltip();
            container.classList.toggle("chat-mcp-has-action", state !== 0 /* None */);
            if (!root.parentElement) {
              container.appendChild(root);
            }
            root.ariaLabel = this.getLabelForState(displayedState.read(r));
            root.className = "chat-mcp-action";
            icon.className = "";
            if (state === 1 /* NewTools */) {
              root.classList.add("chat-mcp-action-new");
              icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.refresh));
            } else if (state === 2 /* Error */) {
              root.classList.add("chat-mcp-action-error");
              icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.warning));
            } else if (state === 3 /* Refreshing */) {
              root.classList.add("chat-mcp-action-refreshing");
              icon.classList.add(...ThemeIcon.asClassNameArray(spinningLoading));
            } else {
              root.remove();
            }
          }));
        }
        async onClick(e) {
          e.preventDefault();
          e.stopPropagation();
          const { state, servers } = displayedState.get();
          if (state === 1 /* NewTools */) {
            servers.forEach((server) => server.start());
            mcpService.activateCollections();
          } else if (state === 3 /* Refreshing */) {
            servers.at(-1)?.showOutput();
          } else if (state === 2 /* Error */) {
            const server = servers.at(-1);
            if (server) {
              commandService.executeCommand(McpServerOptionsCommand.id, server.definition.id);
            }
          } else {
            commandService.executeCommand(ListMcpServerCommand.id);
          }
        }
        getTooltip() {
          return this.getLabelForState() || super.getTooltip();
        }
        getLabelForState({ state, servers } = displayedState.get()) {
          if (state === 1 /* NewTools */) {
            return localize("mcp.newTools", "New tools available ({0})", servers.length || 1);
          } else if (state === 2 /* Error */) {
            return localize("mcp.toolError", "Error loading {0} tool(s)", servers.length || 1);
          } else if (state === 3 /* Refreshing */) {
            return localize("mcp.toolRefresh", "Discovering tools...");
          } else {
            return null;
          }
        }
      }, action, { ...options, keybindingNotRenderedWithLabel: true });
    }, Event.fromObservable(displayedState)));
  }
};
MCPServerActionRendering.ID = "workbench.contrib.mcp.discovery";
MCPServerActionRendering = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IMcpService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ICommandService)
], MCPServerActionRendering);
const _ResetMcpTrustCommand = class _ResetMcpTrustCommand extends Action2 {
  constructor() {
    super({
      id: _ResetMcpTrustCommand.ID,
      title: localize2("mcp.resetTrust", "Reset Trust"),
      category,
      f1: true,
      precondition: McpContextKeys.toolsCount.greater(0)
    });
  }
  run(accessor) {
    const mcpService = accessor.get(IMcpRegistry);
    mcpService.resetTrust();
  }
};
_ResetMcpTrustCommand.ID = "workbench.mcp.resetTrust";
let ResetMcpTrustCommand = _ResetMcpTrustCommand;
const _ResetMcpCachedTools = class _ResetMcpCachedTools extends Action2 {
  constructor() {
    super({
      id: _ResetMcpCachedTools.ID,
      title: localize2("mcp.resetCachedTools", "Reset Cached Tools"),
      category,
      f1: true,
      precondition: McpContextKeys.toolsCount.greater(0)
    });
  }
  run(accessor) {
    const mcpService = accessor.get(IMcpService);
    mcpService.resetCaches();
  }
};
_ResetMcpCachedTools.ID = "workbench.mcp.resetCachedTools";
let ResetMcpCachedTools = _ResetMcpCachedTools;
const _AddConfigurationAction = class _AddConfigurationAction extends Action2 {
  constructor() {
    super({
      id: _AddConfigurationAction.ID,
      title: localize2("mcp.addConfiguration", "Add Server..."),
      metadata: {
        description: localize2("mcp.addConfiguration.description", "Installs a new Model Context protocol to the mcp.json settings")
      },
      category,
      f1: true,
      menu: {
        id: MenuId.EditorContent,
        when: ContextKeyExpr.and(
          ContextKeyExpr.regex(ResourceContextKey.Path.key, /\.vscode[/\\]mcp\.json$/),
          ActiveEditorContext.isEqualTo(TEXT_FILE_EDITOR_ID)
        )
      }
    });
  }
  async run(accessor, configUri) {
    return accessor.get(IInstantiationService).createInstance(McpAddConfigurationCommand, configUri).run();
  }
};
_AddConfigurationAction.ID = "workbench.mcp.addConfiguration";
let AddConfigurationAction = _AddConfigurationAction;
const _RemoveStoredInput = class _RemoveStoredInput extends Action2 {
  constructor() {
    super({
      id: _RemoveStoredInput.ID,
      title: localize2("mcp.resetCachedTools", "Reset Cached Tools"),
      category,
      f1: false
    });
  }
  run(accessor, scope, id) {
    accessor.get(IMcpRegistry).clearSavedInputs(scope, id);
  }
};
_RemoveStoredInput.ID = "workbench.mcp.removeStoredInput";
let RemoveStoredInput = _RemoveStoredInput;
const _EditStoredInput = class _EditStoredInput extends Action2 {
  constructor() {
    super({
      id: _EditStoredInput.ID,
      title: localize2("mcp.editStoredInput", "Edit Stored Input"),
      category,
      f1: false
    });
  }
  run(accessor, inputId, uri, configSection, target) {
    const workspaceFolder = uri && accessor.get(IWorkspaceContextService).getWorkspaceFolder(uri);
    accessor.get(IMcpRegistry).editSavedInput(inputId, workspaceFolder || void 0, configSection, target);
  }
};
_EditStoredInput.ID = "workbench.mcp.editStoredInput";
let EditStoredInput = _EditStoredInput;
const _ShowOutput = class _ShowOutput extends Action2 {
  constructor() {
    super({
      id: _ShowOutput.ID,
      title: localize2("mcp.command.showOutput", "Show Output"),
      category,
      f1: false
    });
  }
  run(accessor, serverId) {
    accessor.get(IMcpService).servers.get().find((s) => s.definition.id === serverId)?.showOutput();
  }
};
_ShowOutput.ID = "workbench.mcp.showOutput";
let ShowOutput = _ShowOutput;
const _RestartServer = class _RestartServer extends Action2 {
  constructor() {
    super({
      id: _RestartServer.ID,
      title: localize2("mcp.command.restartServer", "Restart Server"),
      category,
      f1: false
    });
  }
  async run(accessor, serverId) {
    const s = accessor.get(IMcpService).servers.get().find((s2) => s2.definition.id === serverId);
    s?.showOutput();
    await s?.stop();
    await s?.start();
  }
};
_RestartServer.ID = "workbench.mcp.restartServer";
let RestartServer = _RestartServer;
const _StartServer = class _StartServer extends Action2 {
  constructor() {
    super({
      id: _StartServer.ID,
      title: localize2("mcp.command.startServer", "Start Server"),
      category,
      f1: false
    });
  }
  async run(accessor, serverId) {
    const s = accessor.get(IMcpService).servers.get().find((s2) => s2.definition.id === serverId);
    await s?.start();
  }
};
_StartServer.ID = "workbench.mcp.startServer";
let StartServer = _StartServer;
const _StopServer = class _StopServer extends Action2 {
  constructor() {
    super({
      id: _StopServer.ID,
      title: localize2("mcp.command.stopServer", "Stop Server"),
      category,
      f1: false
    });
  }
  async run(accessor, serverId) {
    const s = accessor.get(IMcpService).servers.get().find((s2) => s2.definition.id === serverId);
    await s?.stop();
  }
};
_StopServer.ID = "workbench.mcp.stopServer";
let StopServer = _StopServer;
const _InstallFromActivation = class _InstallFromActivation extends Action2 {
  constructor() {
    super({
      id: _InstallFromActivation.ID,
      title: localize2("mcp.command.installFromActivation", "Install..."),
      category,
      f1: false,
      menu: {
        id: MenuId.EditorContent,
        when: ContextKeyExpr.equals("resourceScheme", McpUrlHandler.scheme)
      }
    });
  }
  async run(accessor, uri) {
    const addConfigHelper = accessor.get(IInstantiationService).createInstance(McpAddConfigurationCommand, void 0);
    addConfigHelper.pickForUrlHandler(uri);
  }
};
_InstallFromActivation.ID = "workbench.mcp.installFromActivation";
let InstallFromActivation = _InstallFromActivation;
export {
  AddConfigurationAction,
  EditStoredInput,
  InstallFromActivation,
  ListMcpServerCommand,
  MCPServerActionRendering,
  McpServerOptionsCommand,
  RemoveStoredInput,
  ResetMcpCachedTools,
  ResetMcpTrustCommand,
  RestartServer,
  ShowOutput,
  StartServer,
  StopServer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvYnJvd3Nlci9tY3BDb21tYW5kcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IGFzc2VydE5ldmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXNzZXJ0LmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBncm91cEJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sbGVjdGlvbnMuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1biwgZGVyaXZlZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJTG9jYWxpemVkU3RyaW5nLCBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElBY3Rpb25WaWV3SXRlbVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvYWN0aW9uVmlld0l0ZW1TZXJ2aWNlLmpzJztcbmltcG9ydCB7IE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIE1lbnVJZCwgTWVudUl0ZW1BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtLCBJUXVpY2tQaWNrU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBTdG9yYWdlU2NvcGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IHNwaW5uaW5nTG9hZGluZyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgQWN0aXZlRWRpdG9yQ29udGV4dCwgUmVzb3VyY2VDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuLi8uLi9jaGF0L2NvbW1vbi9jaGF0Q29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgQ2hhdE1vZGUgfSBmcm9tICcuLi8uLi9jaGF0L2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVEVYVF9GSUxFX0VESVRPUl9JRCB9IGZyb20gJy4uLy4uL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBNY3BDb250ZXh0S2V5cyB9IGZyb20gJy4uL2NvbW1vbi9tY3BDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJTWNwUmVnaXN0cnkgfSBmcm9tICcuLi9jb21tb24vbWNwUmVnaXN0cnlUeXBlcy5qcyc7XG5pbXBvcnQgeyBJTWNwU2VydmVyLCBJTWNwU2VydmljZSwgTGF6eUNvbGxlY3Rpb25TdGF0ZSwgTWNwQ29ubmVjdGlvblN0YXRlLCBNY3BTZXJ2ZXJUb29sc1N0YXRlIH0gZnJvbSAnLi4vY29tbW9uL21jcFR5cGVzLmpzJztcbmltcG9ydCB7IE1jcEFkZENvbmZpZ3VyYXRpb25Db21tYW5kIH0gZnJvbSAnLi9tY3BDb21tYW5kc0FkZENvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgTWNwVXJsSGFuZGxlciB9IGZyb20gJy4vbWNwVXJsSGFuZGxlci5qcyc7XG5cbi8vIGFjcm95bm1zIGRvIG5vdCBnZXQgbG9jYWxpemVkXG5jb25zdCBjYXRlZ29yeTogSUxvY2FsaXplZFN0cmluZyA9IHtcblx0b3JpZ2luYWw6ICdNQ1AnLFxuXHR2YWx1ZTogJ01DUCcsXG59O1xuXG5leHBvcnQgY2xhc3MgTGlzdE1jcFNlcnZlckNvbW1hbmQgZXh0ZW5kcyBBY3Rpb24yIHtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBpZCA9ICd3b3JrYmVuY2gubWNwLmxpc3RTZXJ2ZXInO1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogTGlzdE1jcFNlcnZlckNvbW1hbmQuaWQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtY3AubGlzdCcsICdMaXN0IFNlcnZlcnMnKSxcblx0XHRcdGljb246IENvZGljb24uc2VydmVyLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdENvbnRleHRLZXlFeHByLm9yKE1jcENvbnRleHRLZXlzLmhhc1Vua25vd25Ub29scywgTWNwQ29udGV4dEtleXMuaGFzU2VydmVyc1dpdGhFcnJvcnMpLFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5jaGF0TW9kZS5pc0VxdWFsVG8oQ2hhdE1vZGUuQWdlbnQpXG5cdFx0XHRcdCksXG5cdFx0XHRcdGlkOiBNZW51SWQuQ2hhdElucHV0QXR0YWNobWVudFRvb2xiYXIsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAwXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Y29uc3QgbWNwU2VydmljZSA9IGFjY2Vzc29yLmdldChJTWNwU2VydmljZSk7XG5cdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblx0XHRjb25zdCBxdWlja0lucHV0ID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cblx0XHR0eXBlIEl0ZW1UeXBlID0geyBpZDogc3RyaW5nIH0gJiBJUXVpY2tQaWNrSXRlbTtcblxuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHBpY2sgPSBxdWlja0lucHV0LmNyZWF0ZVF1aWNrUGljazxJdGVtVHlwZT4oeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0pO1xuXHRcdHBpY2sucGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgnbWNwLnNlbGVjdFNlcnZlcicsICdTZWxlY3QgYW4gTUNQIFNlcnZlcicpO1xuXG5cdFx0c3RvcmUuYWRkKHBpY2spO1xuXG5cdFx0c3RvcmUuYWRkKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdGNvbnN0IHNlcnZlcnMgPSBncm91cEJ5KG1jcFNlcnZpY2Uuc2VydmVycy5yZWFkKHJlYWRlcikuc2xpY2UoKS5zb3J0KChhLCBiKSA9PiAoYS5jb2xsZWN0aW9uLnByZXNlbnRhdGlvbj8ub3JkZXIgfHwgMCkgLSAoYi5jb2xsZWN0aW9uLnByZXNlbnRhdGlvbj8ub3JkZXIgfHwgMCkpLCBzID0+IHMuY29sbGVjdGlvbi5pZCk7XG5cdFx0XHRjb25zdCBmaXJzdFJ1biA9IHBpY2suaXRlbXMubGVuZ3RoID09PSAwO1xuXHRcdFx0cGljay5pdGVtcyA9IFtcblx0XHRcdFx0eyBpZDogJyRhZGQnLCBsYWJlbDogbG9jYWxpemUoJ21jcC5hZGRTZXJ2ZXInLCAnQWRkIFNlcnZlcicpLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21jcC5hZGRTZXJ2ZXIuZGVzY3JpcHRpb24nLCAnQWRkIGEgbmV3IHNlcnZlciBjb25maWd1cmF0aW9uJyksIGFsd2F5c1Nob3c6IHRydWUsIGljb25DbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uYWRkKSB9LFxuXHRcdFx0XHQuLi5PYmplY3QudmFsdWVzKHNlcnZlcnMpLmZpbHRlcihzID0+IHMubGVuZ3RoKS5mbGF0TWFwKChzZXJ2ZXJzKTogKEl0ZW1UeXBlIHwgSVF1aWNrUGlja1NlcGFyYXRvcilbXSA9PiBbXG5cdFx0XHRcdFx0eyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IHNlcnZlcnNbMF0uY29sbGVjdGlvbi5sYWJlbCwgaWQ6IHNlcnZlcnNbMF0uY29sbGVjdGlvbi5pZCB9LFxuXHRcdFx0XHRcdC4uLnNlcnZlcnMubWFwKHNlcnZlciA9PiAoe1xuXHRcdFx0XHRcdFx0aWQ6IHNlcnZlci5kZWZpbml0aW9uLmlkLFxuXHRcdFx0XHRcdFx0bGFiZWw6IHNlcnZlci5kZWZpbml0aW9uLmxhYmVsLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IE1jcENvbm5lY3Rpb25TdGF0ZS50b1N0cmluZyhzZXJ2ZXIuY29ubmVjdGlvblN0YXRlLnJlYWQocmVhZGVyKSksXG5cdFx0XHRcdFx0fSkpLFxuXHRcdFx0XHRdKSxcblx0XHRcdF07XG5cblx0XHRcdGlmIChmaXJzdFJ1biAmJiBwaWNrLml0ZW1zLmxlbmd0aCA+IDMpIHtcblx0XHRcdFx0cGljay5hY3RpdmVJdGVtcyA9IHBpY2suaXRlbXMuc2xpY2UoMiwgMykgYXMgSXRlbVR5cGVbXTsgLy8gc2VsZWN0IHRoZSBmaXJzdCBzZXJ2ZXIgYnkgZGVmYXVsdFxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXG5cdFx0Y29uc3QgcGlja2VkID0gYXdhaXQgbmV3IFByb21pc2U8SXRlbVR5cGUgfCB1bmRlZmluZWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0c3RvcmUuYWRkKHBpY2sub25EaWRBY2NlcHQoKCkgPT4ge1xuXHRcdFx0XHRyZXNvbHZlKHBpY2suYWN0aXZlSXRlbXNbMF0pO1xuXHRcdFx0fSkpO1xuXHRcdFx0c3RvcmUuYWRkKHBpY2sub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0fSkpO1xuXHRcdFx0cGljay5zaG93KCk7XG5cdFx0fSk7XG5cblx0XHRzdG9yZS5kaXNwb3NlKCk7XG5cblx0XHRpZiAoIXBpY2tlZCkge1xuXHRcdFx0Ly8gbm8tb3Bcblx0XHR9IGVsc2UgaWYgKHBpY2tlZC5pZCA9PT0gJyRhZGQnKSB7XG5cdFx0XHRjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChBZGRDb25maWd1cmF0aW9uQWN0aW9uLklEKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoTWNwU2VydmVyT3B0aW9uc0NvbW1hbmQuaWQsIHBpY2tlZC5pZCk7XG5cdFx0fVxuXHR9XG59XG5cblxuZXhwb3J0IGNsYXNzIE1jcFNlcnZlck9wdGlvbnNDb21tYW5kIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IGlkID0gJ3dvcmtiZW5jaC5tY3Auc2VydmVyT3B0aW9ucyc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IE1jcFNlcnZlck9wdGlvbnNDb21tYW5kLmlkLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbWNwLm9wdGlvbnMnLCAnU2VydmVyIE9wdGlvbnMnKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBpZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbWNwU2VydmljZSA9IGFjY2Vzc29yLmdldChJTWNwU2VydmljZSk7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBtY3BSZWdpc3RyeSA9IGFjY2Vzc29yLmdldChJTWNwUmVnaXN0cnkpO1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IHNlcnZlciA9IG1jcFNlcnZpY2Uuc2VydmVycy5nZXQoKS5maW5kKHMgPT4gcy5kZWZpbml0aW9uLmlkID09PSBpZCk7XG5cdFx0aWYgKCFzZXJ2ZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblxuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBtY3BSZWdpc3RyeS5jb2xsZWN0aW9ucy5nZXQoKS5maW5kKGMgPT4gYy5pZCA9PT0gc2VydmVyLmNvbGxlY3Rpb24uaWQpO1xuXHRcdGNvbnN0IHNlcnZlckRlZmluaXRpb24gPSBjb2xsZWN0aW9uPy5zZXJ2ZXJEZWZpbml0aW9ucy5nZXQoKS5maW5kKHMgPT4gcy5pZCA9PT0gc2VydmVyLmRlZmluaXRpb24uaWQpO1xuXG5cdFx0aW50ZXJmYWNlIEFjdGlvbkl0ZW0gZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdFx0XHRhY3Rpb246ICdzdGFydCcgfCAnc3RvcCcgfCAncmVzdGFydCcgfCAnc2hvd091dHB1dCcgfCAnY29uZmlnJztcblx0XHR9XG5cblx0XHRjb25zdCBpdGVtczogQWN0aW9uSXRlbVtdID0gW107XG5cdFx0Y29uc3Qgc2VydmVyU3RhdGUgPSBzZXJ2ZXIuY29ubmVjdGlvblN0YXRlLmdldCgpO1xuXG5cdFx0Ly8gT25seSBzaG93IHN0YXJ0IHdoZW4gc2VydmVyIGlzIHN0b3BwZWQgb3IgaW4gZXJyb3Igc3RhdGVcblx0XHRpZiAoTWNwQ29ubmVjdGlvblN0YXRlLmNhbkJlU3RhcnRlZChzZXJ2ZXJTdGF0ZS5zdGF0ZSkpIHtcblx0XHRcdGl0ZW1zLnB1c2goe1xuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ21jcC5zdGFydCcsICdTdGFydCBTZXJ2ZXInKSxcblx0XHRcdFx0YWN0aW9uOiAnc3RhcnQnXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aXRlbXMucHVzaCh7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnbWNwLnN0b3AnLCAnU3RvcCBTZXJ2ZXInKSxcblx0XHRcdFx0YWN0aW9uOiAnc3RvcCdcblx0XHRcdH0pO1xuXHRcdFx0aXRlbXMucHVzaCh7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnbWNwLnJlc3RhcnQnLCAnUmVzdGFydCBTZXJ2ZXInKSxcblx0XHRcdFx0YWN0aW9uOiAncmVzdGFydCdcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGl0ZW1zLnB1c2goe1xuXHRcdFx0bGFiZWw6IGxvY2FsaXplKCdtY3Auc2hvd091dHB1dCcsICdTaG93IE91dHB1dCcpLFxuXHRcdFx0YWN0aW9uOiAnc2hvd091dHB1dCdcblx0XHR9KTtcblxuXHRcdGNvbnN0IGNvbmZpZ1RhcmdldCA9IHNlcnZlckRlZmluaXRpb24/LnByZXNlbnRhdGlvbj8ub3JpZ2luIHx8IGNvbGxlY3Rpb24/LnByZXNlbnRhdGlvbj8ub3JpZ2luO1xuXHRcdGlmIChjb25maWdUYXJnZXQpIHtcblx0XHRcdGl0ZW1zLnB1c2goe1xuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ21jcC5jb25maWcnLCAnU2hvdyBDb25maWd1cmF0aW9uJyksXG5cdFx0XHRcdGFjdGlvbjogJ2NvbmZpZycsXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCBwaWNrID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhpdGVtcywge1xuXHRcdFx0dGl0bGU6IHNlcnZlci5kZWZpbml0aW9uLmxhYmVsLFxuXHRcdFx0cGxhY2VIb2xkZXI6IGxvY2FsaXplKCdtY3Auc2VsZWN0QWN0aW9uJywgJ1NlbGVjdCBTZXJ2ZXIgQWN0aW9uJylcblx0XHR9KTtcblxuXHRcdGlmICghcGljaykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHN3aXRjaCAocGljay5hY3Rpb24pIHtcblx0XHRcdGNhc2UgJ3N0YXJ0Jzpcblx0XHRcdFx0YXdhaXQgc2VydmVyLnN0YXJ0KHRydWUpO1xuXHRcdFx0XHRzZXJ2ZXIuc2hvd091dHB1dCgpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ3N0b3AnOlxuXHRcdFx0XHRhd2FpdCBzZXJ2ZXIuc3RvcCgpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ3Jlc3RhcnQnOlxuXHRcdFx0XHRhd2FpdCBzZXJ2ZXIuc3RvcCgpO1xuXHRcdFx0XHRhd2FpdCBzZXJ2ZXIuc3RhcnQodHJ1ZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnc2hvd091dHB1dCc6XG5cdFx0XHRcdHNlcnZlci5zaG93T3V0cHV0KCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnY29uZmlnJzpcblx0XHRcdFx0ZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdFx0XHRyZXNvdXJjZTogVVJJLmlzVXJpKGNvbmZpZ1RhcmdldCkgPyBjb25maWdUYXJnZXQgOiBjb25maWdUYXJnZXQhLnVyaSxcblx0XHRcdFx0XHRvcHRpb25zOiB7IHNlbGVjdGlvbjogVVJJLmlzVXJpKGNvbmZpZ1RhcmdldCkgPyB1bmRlZmluZWQgOiBjb25maWdUYXJnZXQhLnJhbmdlIH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0YXNzZXJ0TmV2ZXIocGljay5hY3Rpb24pO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTUNQU2VydmVyQWN0aW9uUmVuZGVyaW5nIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLm1jcC5kaXNjb3ZlcnknO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQWN0aW9uVmlld0l0ZW1TZXJ2aWNlIGFjdGlvblZpZXdJdGVtU2VydmljZTogSUFjdGlvblZpZXdJdGVtU2VydmljZSxcblx0XHRASU1jcFNlcnZpY2UgbWNwU2VydmljZTogSU1jcFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YVNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBlbnVtIERpc3BsYXllZFN0YXRlIHtcblx0XHRcdE5vbmUsXG5cdFx0XHROZXdUb29scyxcblx0XHRcdEVycm9yLFxuXHRcdFx0UmVmcmVzaGluZyxcblx0XHR9XG5cblxuXG5cdFx0Y29uc3QgZGlzcGxheWVkU3RhdGUgPSBkZXJpdmVkKChyZWFkZXIpID0+IHtcblx0XHRcdGNvbnN0IHNlcnZlcnMgPSBtY3BTZXJ2aWNlLnNlcnZlcnMucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3Qgc2VydmVyc1BlclN0YXRlOiBJTWNwU2VydmVyW11bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBzZXJ2ZXIgb2Ygc2VydmVycykge1xuXHRcdFx0XHRsZXQgdGhpc1N0YXRlID0gRGlzcGxheWVkU3RhdGUuTm9uZTtcblx0XHRcdFx0c3dpdGNoIChzZXJ2ZXIudG9vbHNTdGF0ZS5yZWFkKHJlYWRlcikpIHtcblx0XHRcdFx0XHRjYXNlIE1jcFNlcnZlclRvb2xzU3RhdGUuVW5rbm93bjpcblx0XHRcdFx0XHRcdGlmIChzZXJ2ZXIudHJ1c3RlZC5yZWFkKHJlYWRlcikgPT09IGZhbHNlKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXNTdGF0ZSA9IERpc3BsYXllZFN0YXRlLk5vbmU7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR0aGlzU3RhdGUgPSBzZXJ2ZXIuY29ubmVjdGlvblN0YXRlLnJlYWQocmVhZGVyKS5zdGF0ZSA9PT0gTWNwQ29ubmVjdGlvblN0YXRlLktpbmQuRXJyb3IgPyBEaXNwbGF5ZWRTdGF0ZS5FcnJvciA6IERpc3BsYXllZFN0YXRlLk5ld1Rvb2xzO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSBNY3BTZXJ2ZXJUb29sc1N0YXRlLlJlZnJlc2hpbmdGcm9tVW5rbm93bjpcblx0XHRcdFx0XHRcdHRoaXNTdGF0ZSA9IERpc3BsYXllZFN0YXRlLlJlZnJlc2hpbmc7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdFx0dGhpc1N0YXRlID0gc2VydmVyLmNvbm5lY3Rpb25TdGF0ZS5yZWFkKHJlYWRlcikuc3RhdGUgPT09IE1jcENvbm5lY3Rpb25TdGF0ZS5LaW5kLkVycm9yID8gRGlzcGxheWVkU3RhdGUuRXJyb3IgOiBEaXNwbGF5ZWRTdGF0ZS5Ob25lO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRzZXJ2ZXJzUGVyU3RhdGVbdGhpc1N0YXRlXSA/Pz0gW107XG5cdFx0XHRcdHNlcnZlcnNQZXJTdGF0ZVt0aGlzU3RhdGVdLnB1c2goc2VydmVyKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgdW5rbm93blNlcnZlclN0YXRlcyA9IG1jcFNlcnZpY2UubGF6eUNvbGxlY3Rpb25TdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAodW5rbm93blNlcnZlclN0YXRlcyA9PT0gTGF6eUNvbGxlY3Rpb25TdGF0ZS5Mb2FkaW5nVW5rbm93bikge1xuXHRcdFx0XHRzZXJ2ZXJzUGVyU3RhdGVbRGlzcGxheWVkU3RhdGUuUmVmcmVzaGluZ10gPz89IFtdO1xuXHRcdFx0fSBlbHNlIGlmICh1bmtub3duU2VydmVyU3RhdGVzID09PSBMYXp5Q29sbGVjdGlvblN0YXRlLkhhc1Vua25vd24pIHtcblx0XHRcdFx0c2VydmVyc1BlclN0YXRlW0Rpc3BsYXllZFN0YXRlLk5ld1Rvb2xzXSA/Pz0gW107XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1heFN0YXRlID0gKHNlcnZlcnNQZXJTdGF0ZS5sZW5ndGggLSAxKSBhcyBEaXNwbGF5ZWRTdGF0ZTtcblx0XHRcdHJldHVybiB7IHN0YXRlOiBtYXhTdGF0ZSwgc2VydmVyczogc2VydmVyc1BlclN0YXRlW21heFN0YXRlXSB8fCBbXSB9O1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5fc3RvcmUuYWRkKGFjdGlvblZpZXdJdGVtU2VydmljZS5yZWdpc3RlcihNZW51SWQuQ2hhdElucHV0QXR0YWNobWVudFRvb2xiYXIsIExpc3RNY3BTZXJ2ZXJDb21tYW5kLmlkLCAoYWN0aW9uLCBvcHRpb25zKSA9PiB7XG5cdFx0XHRpZiAoIShhY3Rpb24gaW5zdGFuY2VvZiBNZW51SXRlbUFjdGlvbikpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShjbGFzcyBleHRlbmRzIE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtIHtcblxuXHRcdFx0XHRvdmVycmlkZSByZW5kZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXG5cdFx0XHRcdFx0c3VwZXIucmVuZGVyKGNvbnRhaW5lcik7XG5cdFx0XHRcdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2NoYXQtbWNwJyk7XG5cblx0XHRcdFx0XHRjb25zdCBhY3Rpb24gPSBoKCdidXR0b24uY2hhdC1tY3AtYWN0aW9uJywgW2goJ3NwYW5AaWNvbicpXSk7XG5cblx0XHRcdFx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHIgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgeyBzdGF0ZSB9ID0gZGlzcGxheWVkU3RhdGUucmVhZChyKTtcblx0XHRcdFx0XHRcdGNvbnN0IHsgcm9vdCwgaWNvbiB9ID0gYWN0aW9uO1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVUb29sdGlwKCk7XG5cdFx0XHRcdFx0XHRjb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnY2hhdC1tY3AtaGFzLWFjdGlvbicsIHN0YXRlICE9PSBEaXNwbGF5ZWRTdGF0ZS5Ob25lKTtcblxuXHRcdFx0XHRcdFx0aWYgKCFyb290LnBhcmVudEVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHJvb3QpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRyb290LmFyaWFMYWJlbCA9IHRoaXMuZ2V0TGFiZWxGb3JTdGF0ZShkaXNwbGF5ZWRTdGF0ZS5yZWFkKHIpKTtcblx0XHRcdFx0XHRcdHJvb3QuY2xhc3NOYW1lID0gJ2NoYXQtbWNwLWFjdGlvbic7XG5cdFx0XHRcdFx0XHRpY29uLmNsYXNzTmFtZSA9ICcnO1xuXHRcdFx0XHRcdFx0aWYgKHN0YXRlID09PSBEaXNwbGF5ZWRTdGF0ZS5OZXdUb29scykge1xuXHRcdFx0XHRcdFx0XHRyb290LmNsYXNzTGlzdC5hZGQoJ2NoYXQtbWNwLWFjdGlvbi1uZXcnKTtcblx0XHRcdFx0XHRcdFx0aWNvbi5jbGFzc0xpc3QuYWRkKC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KENvZGljb24ucmVmcmVzaCkpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChzdGF0ZSA9PT0gRGlzcGxheWVkU3RhdGUuRXJyb3IpIHtcblx0XHRcdFx0XHRcdFx0cm9vdC5jbGFzc0xpc3QuYWRkKCdjaGF0LW1jcC1hY3Rpb24tZXJyb3InKTtcblx0XHRcdFx0XHRcdFx0aWNvbi5jbGFzc0xpc3QuYWRkKC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KENvZGljb24ud2FybmluZykpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChzdGF0ZSA9PT0gRGlzcGxheWVkU3RhdGUuUmVmcmVzaGluZykge1xuXHRcdFx0XHRcdFx0XHRyb290LmNsYXNzTGlzdC5hZGQoJ2NoYXQtbWNwLWFjdGlvbi1yZWZyZXNoaW5nJyk7XG5cdFx0XHRcdFx0XHRcdGljb24uY2xhc3NMaXN0LmFkZCguLi5UaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShzcGlubmluZ0xvYWRpbmcpKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHJvb3QucmVtb3ZlKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0b3ZlcnJpZGUgYXN5bmMgb25DbGljayhlOiBNb3VzZUV2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblx0XHRcdFx0XHRjb25zdCB7IHN0YXRlLCBzZXJ2ZXJzIH0gPSBkaXNwbGF5ZWRTdGF0ZS5nZXQoKTtcblx0XHRcdFx0XHRpZiAoc3RhdGUgPT09IERpc3BsYXllZFN0YXRlLk5ld1Rvb2xzKSB7XG5cdFx0XHRcdFx0XHRzZXJ2ZXJzLmZvckVhY2goc2VydmVyID0+IHNlcnZlci5zdGFydCgpKTtcblx0XHRcdFx0XHRcdG1jcFNlcnZpY2UuYWN0aXZhdGVDb2xsZWN0aW9ucygpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoc3RhdGUgPT09IERpc3BsYXllZFN0YXRlLlJlZnJlc2hpbmcpIHtcblx0XHRcdFx0XHRcdHNlcnZlcnMuYXQoLTEpPy5zaG93T3V0cHV0KCk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChzdGF0ZSA9PT0gRGlzcGxheWVkU3RhdGUuRXJyb3IpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHNlcnZlciA9IHNlcnZlcnMuYXQoLTEpO1xuXHRcdFx0XHRcdFx0aWYgKHNlcnZlcikge1xuXHRcdFx0XHRcdFx0XHRjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChNY3BTZXJ2ZXJPcHRpb25zQ29tbWFuZC5pZCwgc2VydmVyLmRlZmluaXRpb24uaWQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChMaXN0TWNwU2VydmVyQ29tbWFuZC5pZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldFRvb2x0aXAoKTogc3RyaW5nIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5nZXRMYWJlbEZvclN0YXRlKCkgfHwgc3VwZXIuZ2V0VG9vbHRpcCgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cHJpdmF0ZSBnZXRMYWJlbEZvclN0YXRlKHsgc3RhdGUsIHNlcnZlcnMgfSA9IGRpc3BsYXllZFN0YXRlLmdldCgpKSB7XG5cdFx0XHRcdFx0aWYgKHN0YXRlID09PSBEaXNwbGF5ZWRTdGF0ZS5OZXdUb29scykge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdtY3AubmV3VG9vbHMnLCBcIk5ldyB0b29scyBhdmFpbGFibGUgKHswfSlcIiwgc2VydmVycy5sZW5ndGggfHwgMSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChzdGF0ZSA9PT0gRGlzcGxheWVkU3RhdGUuRXJyb3IpIHtcblx0XHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgnbWNwLnRvb2xFcnJvcicsIFwiRXJyb3IgbG9hZGluZyB7MH0gdG9vbChzKVwiLCBzZXJ2ZXJzLmxlbmd0aCB8fCAxKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHN0YXRlID09PSBEaXNwbGF5ZWRTdGF0ZS5SZWZyZXNoaW5nKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ21jcC50b29sUmVmcmVzaCcsIFwiRGlzY292ZXJpbmcgdG9vbHMuLi5cIik7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cblx0XHRcdH0sIGFjdGlvbiwgeyAuLi5vcHRpb25zLCBrZXliaW5kaW5nTm90UmVuZGVyZWRXaXRoTGFiZWw6IHRydWUgfSk7XG5cblx0XHR9LCBFdmVudC5mcm9tT2JzZXJ2YWJsZShkaXNwbGF5ZWRTdGF0ZSkpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVzZXRNY3BUcnVzdENvbW1hbmQgZXh0ZW5kcyBBY3Rpb24yIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5tY3AucmVzZXRUcnVzdCc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFJlc2V0TWNwVHJ1c3RDb21tYW5kLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbWNwLnJlc2V0VHJ1c3QnLCBcIlJlc2V0IFRydXN0XCIpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogTWNwQ29udGV4dEtleXMudG9vbHNDb3VudC5ncmVhdGVyKDApLFxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3QgbWNwU2VydmljZSA9IGFjY2Vzc29yLmdldChJTWNwUmVnaXN0cnkpO1xuXHRcdG1jcFNlcnZpY2UucmVzZXRUcnVzdCgpO1xuXHR9XG59XG5cblxuZXhwb3J0IGNsYXNzIFJlc2V0TWNwQ2FjaGVkVG9vbHMgZXh0ZW5kcyBBY3Rpb24yIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5tY3AucmVzZXRDYWNoZWRUb29scyc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFJlc2V0TWNwQ2FjaGVkVG9vbHMuSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtY3AucmVzZXRDYWNoZWRUb29scycsIFwiUmVzZXQgQ2FjaGVkIFRvb2xzXCIpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogTWNwQ29udGV4dEtleXMudG9vbHNDb3VudC5ncmVhdGVyKDApLFxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3QgbWNwU2VydmljZSA9IGFjY2Vzc29yLmdldChJTWNwU2VydmljZSk7XG5cdFx0bWNwU2VydmljZS5yZXNldENhY2hlcygpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBBZGRDb25maWd1cmF0aW9uQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2gubWNwLmFkZENvbmZpZ3VyYXRpb24nO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBBZGRDb25maWd1cmF0aW9uQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbWNwLmFkZENvbmZpZ3VyYXRpb24nLCBcIkFkZCBTZXJ2ZXIuLi5cIiksXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUyKCdtY3AuYWRkQ29uZmlndXJhdGlvbi5kZXNjcmlwdGlvbicsIFwiSW5zdGFsbHMgYSBuZXcgTW9kZWwgQ29udGV4dCBwcm90b2NvbCB0byB0aGUgbWNwLmpzb24gc2V0dGluZ3NcIiksXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5FZGl0b3JDb250ZW50LFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0Q29udGV4dEtleUV4cHIucmVnZXgoUmVzb3VyY2VDb250ZXh0S2V5LlBhdGgua2V5LCAvXFwudnNjb2RlWy9cXFxcXW1jcFxcLmpzb24kLyksXG5cdFx0XHRcdFx0QWN0aXZlRWRpdG9yQ29udGV4dC5pc0VxdWFsVG8oVEVYVF9GSUxFX0VESVRPUl9JRClcblx0XHRcdFx0KVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb25maWdVcmk/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSkuY3JlYXRlSW5zdGFuY2UoTWNwQWRkQ29uZmlndXJhdGlvbkNvbW1hbmQsIGNvbmZpZ1VyaSkucnVuKCk7XG5cdH1cbn1cblxuXG5leHBvcnQgY2xhc3MgUmVtb3ZlU3RvcmVkSW5wdXQgZXh0ZW5kcyBBY3Rpb24yIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5tY3AucmVtb3ZlU3RvcmVkSW5wdXQnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBSZW1vdmVTdG9yZWRJbnB1dC5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21jcC5yZXNldENhY2hlZFRvb2xzJywgXCJSZXNldCBDYWNoZWQgVG9vbHNcIiksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgc2NvcGU6IFN0b3JhZ2VTY29wZSwgaWQ/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRhY2Nlc3Nvci5nZXQoSU1jcFJlZ2lzdHJ5KS5jbGVhclNhdmVkSW5wdXRzKHNjb3BlLCBpZCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEVkaXRTdG9yZWRJbnB1dCBleHRlbmRzIEFjdGlvbjIge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLm1jcC5lZGl0U3RvcmVkSW5wdXQnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBFZGl0U3RvcmVkSW5wdXQuSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtY3AuZWRpdFN0b3JlZElucHV0JywgXCJFZGl0IFN0b3JlZCBJbnB1dFwiKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBpbnB1dElkOiBzdHJpbmcsIHVyaTogVVJJIHwgdW5kZWZpbmVkLCBjb25maWdTZWN0aW9uOiBzdHJpbmcsIHRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldCk6IHZvaWQge1xuXHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlciA9IHVyaSAmJiBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKS5nZXRXb3Jrc3BhY2VGb2xkZXIodXJpKTtcblx0XHRhY2Nlc3Nvci5nZXQoSU1jcFJlZ2lzdHJ5KS5lZGl0U2F2ZWRJbnB1dChpbnB1dElkLCB3b3Jrc3BhY2VGb2xkZXIgfHwgdW5kZWZpbmVkLCBjb25maWdTZWN0aW9uLCB0YXJnZXQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTaG93T3V0cHV0IGV4dGVuZHMgQWN0aW9uMiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2gubWNwLnNob3dPdXRwdXQnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTaG93T3V0cHV0LklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbWNwLmNvbW1hbmQuc2hvd091dHB1dCcsIFwiU2hvdyBPdXRwdXRcIiksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgc2VydmVySWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGFjY2Vzc29yLmdldChJTWNwU2VydmljZSkuc2VydmVycy5nZXQoKS5maW5kKHMgPT4gcy5kZWZpbml0aW9uLmlkID09PSBzZXJ2ZXJJZCk/LnNob3dPdXRwdXQoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVzdGFydFNlcnZlciBleHRlbmRzIEFjdGlvbjIge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLm1jcC5yZXN0YXJ0U2VydmVyJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogUmVzdGFydFNlcnZlci5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21jcC5jb21tYW5kLnJlc3RhcnRTZXJ2ZXInLCBcIlJlc3RhcnQgU2VydmVyXCIpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHNlcnZlcklkOiBzdHJpbmcpIHtcblx0XHRjb25zdCBzID0gYWNjZXNzb3IuZ2V0KElNY3BTZXJ2aWNlKS5zZXJ2ZXJzLmdldCgpLmZpbmQocyA9PiBzLmRlZmluaXRpb24uaWQgPT09IHNlcnZlcklkKTtcblx0XHRzPy5zaG93T3V0cHV0KCk7XG5cdFx0YXdhaXQgcz8uc3RvcCgpO1xuXHRcdGF3YWl0IHM/LnN0YXJ0KCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFN0YXJ0U2VydmVyIGV4dGVuZHMgQWN0aW9uMiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2gubWNwLnN0YXJ0U2VydmVyJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU3RhcnRTZXJ2ZXIuSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtY3AuY29tbWFuZC5zdGFydFNlcnZlcicsIFwiU3RhcnQgU2VydmVyXCIpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHNlcnZlcklkOiBzdHJpbmcpIHtcblx0XHRjb25zdCBzID0gYWNjZXNzb3IuZ2V0KElNY3BTZXJ2aWNlKS5zZXJ2ZXJzLmdldCgpLmZpbmQocyA9PiBzLmRlZmluaXRpb24uaWQgPT09IHNlcnZlcklkKTtcblx0XHRhd2FpdCBzPy5zdGFydCgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTdG9wU2VydmVyIGV4dGVuZHMgQWN0aW9uMiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2gubWNwLnN0b3BTZXJ2ZXInO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTdG9wU2VydmVyLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbWNwLmNvbW1hbmQuc3RvcFNlcnZlcicsIFwiU3RvcCBTZXJ2ZXJcIiksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgc2VydmVySWQ6IHN0cmluZykge1xuXHRcdGNvbnN0IHMgPSBhY2Nlc3Nvci5nZXQoSU1jcFNlcnZpY2UpLnNlcnZlcnMuZ2V0KCkuZmluZChzID0+IHMuZGVmaW5pdGlvbi5pZCA9PT0gc2VydmVySWQpO1xuXHRcdGF3YWl0IHM/LnN0b3AoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSW5zdGFsbEZyb21BY3RpdmF0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2gubWNwLmluc3RhbGxGcm9tQWN0aXZhdGlvbic7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEluc3RhbGxGcm9tQWN0aXZhdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21jcC5jb21tYW5kLmluc3RhbGxGcm9tQWN0aXZhdGlvbicsIFwiSW5zdGFsbC4uLlwiKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvckNvbnRlbnQsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygncmVzb3VyY2VTY2hlbWUnLCBNY3BVcmxIYW5kbGVyLnNjaGVtZSlcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgdXJpOiBVUkkpIHtcblx0XHRjb25zdCBhZGRDb25maWdIZWxwZXIgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKS5jcmVhdGVJbnN0YW5jZShNY3BBZGRDb25maWd1cmF0aW9uQ29tbWFuZCwgdW5kZWZpbmVkKTtcblx0XHRhZGRDb25maWdIZWxwZXIucGlja0ZvclVybEhhbmRsZXIodXJpKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFNBQVM7QUFDbEIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFTLFNBQVMsZUFBZTtBQUNqQyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLFdBQVc7QUFDcEIsU0FBMkIsVUFBVSxpQkFBaUI7QUFDdEQsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxTQUFTLFFBQVEsc0JBQXNCO0FBQ2hELFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsNkJBQStDO0FBQ3hELFNBQVMsMEJBQStEO0FBRXhFLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMscUJBQXFCLDBCQUEwQjtBQUV4RCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG9CQUFvQjtBQUM3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S0FBSztBQUFBLEVBQ2Y7QUFDRDtBQWhCYSxZQUNJLEtBQUs7QUFEZixJQUFNLGFBQU47QUFrQkEsTUFBTSx5QkFBTixNQUFNLCtCQUE4QixRQUFRO0FBQUEsRUFHbEQsY0FBYztBQUNiLFVBQU07QUFBQSxNQUNMLElBQUksdUJBQXNCO0FBQUEsTUFDMUIsT0FBTyxVQUFVLHFDQUFxQyxZQUFZO0FBQUEsTUFDbEU7QUFBQSxNQUNBLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxRQUNMLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTSxlQUFlLE9BQU8sa0JBQWtCLGNBQWMsTUFBTTtBQUFBLE1BQ25FO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBTSxJQUFJLFVBQTRCLEtBQVU7QUFDL0MsVUFBTSxrQkFBa0IsU0FBUyxJQUFJLHFCQUFxQixFQUFFLGVBQWUsNEJBQTRCLE1BQVM7QUFDaEgsb0JBQWdCLGtCQUFrQixHQUFHO0FBQUEsRUFDdEM7QUFDRDtBQXBCYSx1QkFDSSxLQUFLO0FBRGYsSUFBTSx3QkFBTjsiLAogICJuYW1lcyI6IFsic2VydmVycyIsICJEaXNwbGF5ZWRTdGF0ZSIsICJhY3Rpb24iLCAicyJdCn0K
