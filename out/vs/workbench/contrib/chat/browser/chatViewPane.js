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
import { $, getWindow } from "../../../../base/browser/dom.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { MarshalledId } from "../../../../base/common/marshallingIds.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { editorBackground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ViewPane } from "../../../browser/parts/views/viewPane.js";
import { Memento } from "../../../common/memento.js";
import { SIDE_BAR_FOREGROUND } from "../../../common/theme.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IChatAgentService } from "../common/chatAgents.js";
import { ChatContextKeys } from "../common/chatContextKeys.js";
import { ChatModelInitState } from "../common/chatModel.js";
import { CHAT_PROVIDER_ID } from "../common/chatParticipantContribTypes.js";
import { IChatService } from "../common/chatService.js";
import { ChatAgentLocation, ChatMode } from "../common/constants.js";
import { ChatWidget } from "./chatWidget.js";
import { ChatViewWelcomeController } from "./viewsWelcome/chatViewWelcomeController.js";
const CHAT_SIDEBAR_OLD_VIEW_PANEL_ID = "workbench.panel.chatSidebar";
const CHAT_SIDEBAR_PANEL_ID = "workbench.panel.chat";
const CHAT_EDITING_SIDEBAR_PANEL_ID = "workbench.panel.chatEditing";
let ChatViewPane = class extends ViewPane {
  constructor(chatOptions, options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, storageService, chatService, chatAgentService, logService, layoutService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.chatOptions = chatOptions;
    this.storageService = storageService;
    this.chatService = chatService;
    this.chatAgentService = chatAgentService;
    this.logService = logService;
    this.layoutService = layoutService;
    this.modelDisposables = this._register(new DisposableStore());
    this.defaultParticipantRegistrationFailed = false;
    this.didUnregisterProvider = false;
    this.memento = new Memento("interactive-session-view-" + CHAT_PROVIDER_ID + (this.chatOptions.location === ChatAgentLocation.EditingSession ? `-edits` : ""), this.storageService);
    this.viewState = this.memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    if (this.chatService.unifiedViewEnabled && this.chatOptions.location === ChatAgentLocation.Panel && !this.viewState.hasMigratedCurrentSession) {
      const editsMemento = new Memento("interactive-session-view-" + CHAT_PROVIDER_ID + `-edits`, this.storageService);
      const lastEditsState = editsMemento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
      if (lastEditsState.sessionId) {
        this.logService.trace(`ChatViewPane: last edits session was ${lastEditsState.sessionId}`);
        if (!this.chatService.isPersistedSessionEmpty(lastEditsState.sessionId)) {
          this.logService.info(`ChatViewPane: migrating ${lastEditsState.sessionId} to unified view`);
          this.viewState.sessionId = lastEditsState.sessionId;
          this.viewState.inputValue = lastEditsState.inputValue;
          this.viewState.inputState = {
            ...lastEditsState.inputState,
            chatMode: lastEditsState.inputState?.chatMode ?? ChatMode.Edit
          };
          this.viewState.hasMigratedCurrentSession = true;
        }
      }
    }
    this._register(this.chatAgentService.onDidChangeAgents(() => {
      if (this.chatAgentService.getDefaultAgent(this.chatOptions?.location)) {
        if (!this._widget?.viewModel && !this._restoringSession) {
          const info = this.getTransferredOrPersistedSessionInfo();
          this._restoringSession = (info.sessionId ? this.chatService.getOrRestoreSession(info.sessionId) : Promise.resolve(void 0)).then(async (model) => {
            const wasVisible = this._widget.visible;
            try {
              this._widget.setVisible(false);
              await this.updateModel(model, info.inputValue || info.mode ? { inputState: { chatMode: info.mode }, inputValue: info.inputValue } : void 0);
              this.defaultParticipantRegistrationFailed = false;
              this.didUnregisterProvider = false;
              this._onDidChangeViewWelcomeState.fire();
            } finally {
              this.widget.setVisible(wasVisible);
            }
          });
          this._restoringSession.finally(() => this._restoringSession = void 0);
        }
      } else if (this._widget?.viewModel?.initState === ChatModelInitState.Initialized) {
        this.didUnregisterProvider = true;
      }
      this._onDidChangeViewWelcomeState.fire();
    }));
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(ChatContextKeys.SetupViewKeys)) {
        this._onDidChangeViewWelcomeState.fire();
      }
    }));
  }
  get widget() {
    return this._widget;
  }
  getActionsContext() {
    return this.widget?.viewModel ? {
      sessionId: this.widget.viewModel.sessionId,
      $mid: MarshalledId.ChatViewContext
    } : void 0;
  }
  async updateModel(model, viewState) {
    this.modelDisposables.clear();
    model = model ?? (this.chatService.transferredSessionData?.sessionId && this.chatService.transferredSessionData?.location === this.chatOptions.location ? await this.chatService.getOrRestoreSession(this.chatService.transferredSessionData.sessionId) : this.chatService.startSession(this.chatOptions.location, CancellationToken.None));
    if (!model) {
      throw new Error("Could not start chat session");
    }
    if (viewState) {
      this.updateViewState(viewState);
    }
    this.viewState.sessionId = model.sessionId;
    this._widget.setModel(model, { ...this.viewState });
    this.updateActions();
  }
  shouldShowWelcome() {
    const showSetup = this.contextKeyService.contextMatchesRules(ChatContextKeys.SetupViewCondition);
    const noPersistedSessions = !this.chatService.hasSessions();
    const hasCoreAgent = this.chatAgentService.getAgents().some((agent) => agent.isCore && agent.locations.includes(this.chatOptions.location));
    const shouldShow = !hasCoreAgent && (this.didUnregisterProvider || !this._widget?.viewModel && noPersistedSessions || this.defaultParticipantRegistrationFailed || showSetup);
    this.logService.trace(`ChatViewPane#shouldShowWelcome(${this.chatOptions.location}) = ${shouldShow}: hasCoreAgent=${hasCoreAgent} didUnregister=${this.didUnregisterProvider} || noViewModel=${!this._widget?.viewModel} && noPersistedSessions=${noPersistedSessions} || defaultParticipantRegistrationFailed=${this.defaultParticipantRegistrationFailed} || showSetup=${showSetup}`);
    return !!shouldShow;
  }
  getTransferredOrPersistedSessionInfo() {
    if (this.chatService.transferredSessionData?.location === this.chatOptions.location) {
      const sessionId = this.chatService.transferredSessionData.sessionId;
      return {
        sessionId,
        inputValue: this.chatService.transferredSessionData.inputValue,
        mode: this.chatService.transferredSessionData.mode
      };
    } else {
      return { sessionId: this.viewState.sessionId };
    }
  }
  async renderBody(parent) {
    try {
      super.renderBody(parent);
      this._register(this.instantiationService.createInstance(ChatViewWelcomeController, parent, this, this.chatOptions.location));
      const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, this.scopedContextKeyService])));
      const locationBasedColors = this.getLocationBasedColors();
      const editorOverflowNode = this.layoutService.getContainer(getWindow(parent)).appendChild($(".chat-editor-overflow.monaco-editor"));
      this._register({ dispose: () => editorOverflowNode.remove() });
      this._widget = this._register(scopedInstantiationService.createInstance(
        ChatWidget,
        this.chatOptions.location,
        { viewId: this.id },
        {
          autoScroll: (mode) => mode !== ChatMode.Ask,
          renderFollowups: this.chatOptions.location === ChatAgentLocation.Panel,
          supportsFileReferences: true,
          supportsAdditionalParticipants: this.chatOptions.location === ChatAgentLocation.Panel,
          rendererOptions: {
            renderTextEditsAsSummary: (uri) => {
              return this.chatService.isEditingLocation(this.chatOptions.location);
            },
            referencesExpandedWhenEmptyResponse: !this.chatService.isEditingLocation(this.chatOptions.location),
            progressMessageAtBottomOfResponse: (mode) => mode !== ChatMode.Ask
          },
          editorOverflowWidgetsDomNode: editorOverflowNode,
          enableImplicitContext: this.chatOptions.location === ChatAgentLocation.Panel || this.chatService.isEditingLocation(this.chatOptions.location),
          enableWorkingSet: this.chatService.isEditingLocation(this.chatOptions.location) ? "explicit" : void 0,
          supportsChangingModes: this.chatService.isEditingLocation(this.chatOptions.location)
        },
        {
          listForeground: SIDE_BAR_FOREGROUND,
          listBackground: locationBasedColors.background,
          overlayBackground: locationBasedColors.overlayBackground,
          inputEditorBackground: locationBasedColors.background,
          resultEditorBackground: editorBackground
        }
      ));
      this._register(this.onDidChangeBodyVisibility((visible) => {
        this._widget.setVisible(visible);
      }));
      this._register(this._widget.onDidClear(() => this.clear()));
      this._widget.render(parent);
      const info = this.getTransferredOrPersistedSessionInfo();
      const disposeListener = this._register(this.chatService.onDidDisposeSession((e) => {
        if (e.reason === "initializationFailed") {
          this.defaultParticipantRegistrationFailed = true;
          disposeListener?.dispose();
          this._onDidChangeViewWelcomeState.fire();
        }
      }));
      const model = info.sessionId ? await this.chatService.getOrRestoreSession(info.sessionId) : void 0;
      await this.updateModel(model, info.inputValue || info.mode ? { inputState: { chatMode: info.mode }, inputValue: info.inputValue } : void 0);
    } catch (e) {
      this.logService.error(e);
      throw e;
    }
  }
  acceptInput(query) {
    this._widget.acceptInput(query);
  }
  async clear() {
    if (this.widget.viewModel) {
      await this.chatService.clearSession(this.widget.viewModel.sessionId);
    }
    this.updateViewState();
    await this.updateModel(void 0);
    this.updateActions();
  }
  async loadSession(sessionId, viewState) {
    if (this.widget.viewModel) {
      await this.chatService.clearSession(this.widget.viewModel.sessionId);
    }
    const newModel = await this.chatService.getOrRestoreSession(sessionId);
    await this.updateModel(newModel, viewState);
  }
  focusInput() {
    this._widget.focusInput();
  }
  focus() {
    super.focus();
    this._widget.focusInput();
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this._widget.layout(height, width);
  }
  saveState() {
    if (this._widget) {
      this._widget.saveState();
      this.updateViewState();
      this.memento.saveMemento();
    }
    super.saveState();
  }
  updateViewState(viewState) {
    const newViewState = viewState ?? this._widget.getViewState();
    for (const [key, value] of Object.entries(newViewState)) {
      this.viewState[key] = value;
    }
  }
};
ChatViewPane = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IViewDescriptorService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IThemeService),
  __decorateParam(10, IHoverService),
  __decorateParam(11, IStorageService),
  __decorateParam(12, IChatService),
  __decorateParam(13, IChatAgentService),
  __decorateParam(14, ILogService),
  __decorateParam(15, ILayoutService)
], ChatViewPane);
export {
  CHAT_EDITING_SIDEBAR_PANEL_ID,
  CHAT_SIDEBAR_OLD_VIEW_PANEL_ID,
  CHAT_SIDEBAR_PANEL_ID,
  ChatViewPane
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFZpZXdQYW5lLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgJCwgZ2V0V2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTWFyc2hhbGxlZElkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFyc2hhbGxpbmdJZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgU2VydmljZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElMYXlvdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IGVkaXRvckJhY2tncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVmlld1BhbmVPcHRpb25zLCBWaWV3UGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgTWVtZW50byB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tZW1lbnRvLmpzJztcbmltcG9ydCB7IFNJREVfQkFSX0ZPUkVHUk9VTkQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdGhlbWUuanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJQ2hhdFZpZXdUaXRsZUFjdGlvbkNvbnRleHQgfSBmcm9tICcuLi9jb21tb24vY2hhdEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuLi9jb21tb24vY2hhdENvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IENoYXRNb2RlbEluaXRTdGF0ZSwgSUNoYXRNb2RlbCB9IGZyb20gJy4uL2NvbW1vbi9jaGF0TW9kZWwuanMnO1xuaW1wb3J0IHsgQ0hBVF9QUk9WSURFUl9JRCB9IGZyb20gJy4uL2NvbW1vbi9jaGF0UGFydGljaXBhbnRDb250cmliVHlwZXMuanMnO1xuaW1wb3J0IHsgSUNoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENoYXRBZ2VudExvY2F0aW9uLCBDaGF0TW9kZSB9IGZyb20gJy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQ2hhdFdpZGdldCwgSUNoYXRWaWV3U3RhdGUgfSBmcm9tICcuL2NoYXRXaWRnZXQuanMnO1xuaW1wb3J0IHsgQ2hhdFZpZXdXZWxjb21lQ29udHJvbGxlciwgSVZpZXdXZWxjb21lRGVsZWdhdGUgfSBmcm9tICcuL3ZpZXdzV2VsY29tZS9jaGF0Vmlld1dlbGNvbWVDb250cm9sbGVyLmpzJztcblxuaW50ZXJmYWNlIElWaWV3UGFuZVN0YXRlIGV4dGVuZHMgSUNoYXRWaWV3U3RhdGUge1xuXHRzZXNzaW9uSWQ/OiBzdHJpbmc7XG5cdGhhc01pZ3JhdGVkQ3VycmVudFNlc3Npb24/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY29uc3QgQ0hBVF9TSURFQkFSX09MRF9WSUVXX1BBTkVMX0lEID0gJ3dvcmtiZW5jaC5wYW5lbC5jaGF0U2lkZWJhcic7XG5leHBvcnQgY29uc3QgQ0hBVF9TSURFQkFSX1BBTkVMX0lEID0gJ3dvcmtiZW5jaC5wYW5lbC5jaGF0JztcbmV4cG9ydCBjb25zdCBDSEFUX0VESVRJTkdfU0lERUJBUl9QQU5FTF9JRCA9ICd3b3JrYmVuY2gucGFuZWwuY2hhdEVkaXRpbmcnO1xuZXhwb3J0IGNsYXNzIENoYXRWaWV3UGFuZSBleHRlbmRzIFZpZXdQYW5lIGltcGxlbWVudHMgSVZpZXdXZWxjb21lRGVsZWdhdGUge1xuXHRwcml2YXRlIF93aWRnZXQhOiBDaGF0V2lkZ2V0O1xuXHRnZXQgd2lkZ2V0KCk6IENoYXRXaWRnZXQgeyByZXR1cm4gdGhpcy5fd2lkZ2V0OyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBtb2RlbERpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSBtZW1lbnRvOiBNZW1lbnRvO1xuXHRwcml2YXRlIHJlYWRvbmx5IHZpZXdTdGF0ZTogSVZpZXdQYW5lU3RhdGU7XG5cdHByaXZhdGUgZGVmYXVsdFBhcnRpY2lwYW50UmVnaXN0cmF0aW9uRmFpbGVkID0gZmFsc2U7XG5cdHByaXZhdGUgZGlkVW5yZWdpc3RlclByb3ZpZGVyID0gZmFsc2U7XG5cblx0cHJpdmF0ZSBfcmVzdG9yaW5nU2Vzc2lvbjogUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNoYXRPcHRpb25zOiB7IGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCB8IENoYXRBZ2VudExvY2F0aW9uLkVkaXRpbmdTZXNzaW9uIH0sXG5cdFx0b3B0aW9uczogSVZpZXdQYW5lT3B0aW9ucyxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUNoYXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdFNlcnZpY2U6IElDaGF0U2VydmljZSxcblx0XHRASUNoYXRBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0QWdlbnRTZXJ2aWNlOiBJQ2hhdEFnZW50U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUxheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYXlvdXRTZXJ2aWNlOiBJTGF5b3V0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIob3B0aW9ucywga2V5YmluZGluZ1NlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCB2aWV3RGVzY3JpcHRvclNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIGhvdmVyU2VydmljZSk7XG5cblx0XHQvLyBWaWV3IHN0YXRlIGZvciB0aGUgVmlld1BhbmUgaXMgY3VycmVudGx5IGdsb2JhbCBwZXItcHJvdmlkZXIgYmFzaWNhbGx5LCBidXQgc29tZSBvdGhlciBzdHJpY3RseSBwZXItbW9kZWwgc3RhdGUgd2lsbCByZXF1aXJlIGEgc2VwYXJhdGUgbWVtZW50by5cblx0XHR0aGlzLm1lbWVudG8gPSBuZXcgTWVtZW50bygnaW50ZXJhY3RpdmUtc2Vzc2lvbi12aWV3LScgKyBDSEFUX1BST1ZJREVSX0lEICsgKHRoaXMuY2hhdE9wdGlvbnMubG9jYXRpb24gPT09IENoYXRBZ2VudExvY2F0aW9uLkVkaXRpbmdTZXNzaW9uID8gYC1lZGl0c2AgOiAnJyksIHRoaXMuc3RvcmFnZVNlcnZpY2UpO1xuXHRcdHRoaXMudmlld1N0YXRlID0gdGhpcy5tZW1lbnRvLmdldE1lbWVudG8oU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKSBhcyBJVmlld1BhbmVTdGF0ZTtcblxuXHRcdGlmICh0aGlzLmNoYXRTZXJ2aWNlLnVuaWZpZWRWaWV3RW5hYmxlZCAmJiB0aGlzLmNoYXRPcHRpb25zLmxvY2F0aW9uID09PSBDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCAmJiAhdGhpcy52aWV3U3RhdGUuaGFzTWlncmF0ZWRDdXJyZW50U2Vzc2lvbikge1xuXHRcdFx0Y29uc3QgZWRpdHNNZW1lbnRvID0gbmV3IE1lbWVudG8oJ2ludGVyYWN0aXZlLXNlc3Npb24tdmlldy0nICsgQ0hBVF9QUk9WSURFUl9JRCArIGAtZWRpdHNgLCB0aGlzLnN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGxhc3RFZGl0c1N0YXRlID0gZWRpdHNNZW1lbnRvLmdldE1lbWVudG8oU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKSBhcyBJVmlld1BhbmVTdGF0ZTtcblx0XHRcdGlmIChsYXN0RWRpdHNTdGF0ZS5zZXNzaW9uSWQpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBDaGF0Vmlld1BhbmU6IGxhc3QgZWRpdHMgc2Vzc2lvbiB3YXMgJHtsYXN0RWRpdHNTdGF0ZS5zZXNzaW9uSWR9YCk7XG5cdFx0XHRcdGlmICghdGhpcy5jaGF0U2VydmljZS5pc1BlcnNpc3RlZFNlc3Npb25FbXB0eShsYXN0RWRpdHNTdGF0ZS5zZXNzaW9uSWQpKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYENoYXRWaWV3UGFuZTogbWlncmF0aW5nICR7bGFzdEVkaXRzU3RhdGUuc2Vzc2lvbklkfSB0byB1bmlmaWVkIHZpZXdgKTtcblx0XHRcdFx0XHR0aGlzLnZpZXdTdGF0ZS5zZXNzaW9uSWQgPSBsYXN0RWRpdHNTdGF0ZS5zZXNzaW9uSWQ7XG5cdFx0XHRcdFx0dGhpcy52aWV3U3RhdGUuaW5wdXRWYWx1ZSA9IGxhc3RFZGl0c1N0YXRlLmlucHV0VmFsdWU7XG5cdFx0XHRcdFx0dGhpcy52aWV3U3RhdGUuaW5wdXRTdGF0ZSA9IHtcblx0XHRcdFx0XHRcdC4uLmxhc3RFZGl0c1N0YXRlLmlucHV0U3RhdGUsXG5cdFx0XHRcdFx0XHRjaGF0TW9kZTogbGFzdEVkaXRzU3RhdGUuaW5wdXRTdGF0ZT8uY2hhdE1vZGUgPz8gQ2hhdE1vZGUuRWRpdFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0dGhpcy52aWV3U3RhdGUuaGFzTWlncmF0ZWRDdXJyZW50U2Vzc2lvbiA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNoYXRBZ2VudFNlcnZpY2Uub25EaWRDaGFuZ2VBZ2VudHMoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuY2hhdEFnZW50U2VydmljZS5nZXREZWZhdWx0QWdlbnQodGhpcy5jaGF0T3B0aW9ucz8ubG9jYXRpb24pKSB7XG5cdFx0XHRcdGlmICghdGhpcy5fd2lkZ2V0Py52aWV3TW9kZWwgJiYgIXRoaXMuX3Jlc3RvcmluZ1Nlc3Npb24pIHtcblx0XHRcdFx0XHRjb25zdCBpbmZvID0gdGhpcy5nZXRUcmFuc2ZlcnJlZE9yUGVyc2lzdGVkU2Vzc2lvbkluZm8oKTtcblx0XHRcdFx0XHR0aGlzLl9yZXN0b3JpbmdTZXNzaW9uID1cblx0XHRcdFx0XHRcdChpbmZvLnNlc3Npb25JZCA/IHRoaXMuY2hhdFNlcnZpY2UuZ2V0T3JSZXN0b3JlU2Vzc2lvbihpbmZvLnNlc3Npb25JZCkgOiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKSkudGhlbihhc3luYyBtb2RlbCA9PiB7XG5cdFx0XHRcdFx0XHRcdC8vIFRoZSB3aWRnZXQgbWF5IGJlIGhpZGRlbiBhdCB0aGlzIHBvaW50LCBiZWNhdXNlIHdlbGNvbWUgdmlld3Mgd2VyZSBhbGxvd2VkLiBVc2Ugc2V0VmlzaWJsZSB0b1xuXHRcdFx0XHRcdFx0XHQvLyBhdm9pZCBkb2luZyBhIHJlbmRlciB3aGlsZSB0aGUgd2lkZ2V0IGlzIGhpZGRlbi4gVGhpcyBpcyBjaGFuZ2luZyB0aGUgY29uZGl0aW9uIGluIGBzaG91bGRTaG93V2VsY29tZWBcblx0XHRcdFx0XHRcdFx0Ly8gc28gaXQgc2hvdWxkIGZpcmUgb25EaWRDaGFuZ2VWaWV3V2VsY29tZVN0YXRlLlxuXHRcdFx0XHRcdFx0XHRjb25zdCB3YXNWaXNpYmxlID0gdGhpcy5fd2lkZ2V0LnZpc2libGU7XG5cdFx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5fd2lkZ2V0LnNldFZpc2libGUoZmFsc2UpO1xuXHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMudXBkYXRlTW9kZWwobW9kZWwsIGluZm8uaW5wdXRWYWx1ZSB8fCBpbmZvLm1vZGUgPyB7IGlucHV0U3RhdGU6IHsgY2hhdE1vZGU6IGluZm8ubW9kZSB9LCBpbnB1dFZhbHVlOiBpbmZvLmlucHV0VmFsdWUgfSA6IHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5kZWZhdWx0UGFydGljaXBhbnRSZWdpc3RyYXRpb25GYWlsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmRpZFVucmVnaXN0ZXJQcm92aWRlciA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVmlld1dlbGNvbWVTdGF0ZS5maXJlKCk7XG5cdFx0XHRcdFx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy53aWRnZXQuc2V0VmlzaWJsZSh3YXNWaXNpYmxlKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0dGhpcy5fcmVzdG9yaW5nU2Vzc2lvbi5maW5hbGx5KCgpID0+IHRoaXMuX3Jlc3RvcmluZ1Nlc3Npb24gPSB1bmRlZmluZWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuX3dpZGdldD8udmlld01vZGVsPy5pbml0U3RhdGUgPT09IENoYXRNb2RlbEluaXRTdGF0ZS5Jbml0aWFsaXplZCkge1xuXHRcdFx0XHQvLyBNb2RlbCBpcyBpbml0aWFsaXplZCwgYW5kIHRoZSBkZWZhdWx0IGFnZW50IGRpc2FwcGVhcmVkLCBzbyBzaG93IHdlbGNvbWUgdmlld1xuXHRcdFx0XHR0aGlzLmRpZFVucmVnaXN0ZXJQcm92aWRlciA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVmlld1dlbGNvbWVTdGF0ZS5maXJlKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb250ZXh0S2V5U2VydmljZS5vbkRpZENoYW5nZUNvbnRleHQoZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzU29tZShDaGF0Q29udGV4dEtleXMuU2V0dXBWaWV3S2V5cykpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VWaWV3V2VsY29tZVN0YXRlLmZpcmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRBY3Rpb25zQ29udGV4dCgpOiBJQ2hhdFZpZXdUaXRsZUFjdGlvbkNvbnRleHQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLndpZGdldD8udmlld01vZGVsID8ge1xuXHRcdFx0c2Vzc2lvbklkOiB0aGlzLndpZGdldC52aWV3TW9kZWwuc2Vzc2lvbklkLFxuXHRcdFx0JG1pZDogTWFyc2hhbGxlZElkLkNoYXRWaWV3Q29udGV4dFxuXHRcdH0gOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZU1vZGVsKG1vZGVsPzogSUNoYXRNb2RlbCB8IHVuZGVmaW5lZCwgdmlld1N0YXRlPzogSUNoYXRWaWV3U3RhdGUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLm1vZGVsRGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdG1vZGVsID0gbW9kZWwgPz8gKHRoaXMuY2hhdFNlcnZpY2UudHJhbnNmZXJyZWRTZXNzaW9uRGF0YT8uc2Vzc2lvbklkICYmIHRoaXMuY2hhdFNlcnZpY2UudHJhbnNmZXJyZWRTZXNzaW9uRGF0YT8ubG9jYXRpb24gPT09IHRoaXMuY2hhdE9wdGlvbnMubG9jYXRpb25cblx0XHRcdD8gYXdhaXQgdGhpcy5jaGF0U2VydmljZS5nZXRPclJlc3RvcmVTZXNzaW9uKHRoaXMuY2hhdFNlcnZpY2UudHJhbnNmZXJyZWRTZXNzaW9uRGF0YS5zZXNzaW9uSWQpXG5cdFx0XHQ6IHRoaXMuY2hhdFNlcnZpY2Uuc3RhcnRTZXNzaW9uKHRoaXMuY2hhdE9wdGlvbnMubG9jYXRpb24sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBzdGFydCBjaGF0IHNlc3Npb24nKTtcblx0XHR9XG5cblx0XHRpZiAodmlld1N0YXRlKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVZpZXdTdGF0ZSh2aWV3U3RhdGUpO1xuXHRcdH1cblxuXHRcdHRoaXMudmlld1N0YXRlLnNlc3Npb25JZCA9IG1vZGVsLnNlc3Npb25JZDtcblx0XHR0aGlzLl93aWRnZXQuc2V0TW9kZWwobW9kZWwsIHsgLi4udGhpcy52aWV3U3RhdGUgfSk7XG5cblx0XHQvLyBVcGRhdGUgdGhlIHRvb2xiYXIgY29udGV4dCB3aXRoIG5ldyBzZXNzaW9uSWRcblx0XHR0aGlzLnVwZGF0ZUFjdGlvbnMoKTtcblx0fVxuXG5cdG92ZXJyaWRlIHNob3VsZFNob3dXZWxjb21lKCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHNob3dTZXR1cCA9IHRoaXMuY29udGV4dEtleVNlcnZpY2UuY29udGV4dE1hdGNoZXNSdWxlcyhDaGF0Q29udGV4dEtleXMuU2V0dXBWaWV3Q29uZGl0aW9uKTtcblx0XHRjb25zdCBub1BlcnNpc3RlZFNlc3Npb25zID0gIXRoaXMuY2hhdFNlcnZpY2UuaGFzU2Vzc2lvbnMoKTtcblx0XHRjb25zdCBoYXNDb3JlQWdlbnQgPSB0aGlzLmNoYXRBZ2VudFNlcnZpY2UuZ2V0QWdlbnRzKCkuc29tZShhZ2VudCA9PiBhZ2VudC5pc0NvcmUgJiYgYWdlbnQubG9jYXRpb25zLmluY2x1ZGVzKHRoaXMuY2hhdE9wdGlvbnMubG9jYXRpb24pKTtcblx0XHRjb25zdCBzaG91bGRTaG93ID0gIWhhc0NvcmVBZ2VudCAmJiAodGhpcy5kaWRVbnJlZ2lzdGVyUHJvdmlkZXIgfHwgIXRoaXMuX3dpZGdldD8udmlld01vZGVsICYmIG5vUGVyc2lzdGVkU2Vzc2lvbnMgfHwgdGhpcy5kZWZhdWx0UGFydGljaXBhbnRSZWdpc3RyYXRpb25GYWlsZWQgfHwgc2hvd1NldHVwKTtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYENoYXRWaWV3UGFuZSNzaG91bGRTaG93V2VsY29tZSgke3RoaXMuY2hhdE9wdGlvbnMubG9jYXRpb259KSA9ICR7c2hvdWxkU2hvd306IGhhc0NvcmVBZ2VudD0ke2hhc0NvcmVBZ2VudH0gZGlkVW5yZWdpc3Rlcj0ke3RoaXMuZGlkVW5yZWdpc3RlclByb3ZpZGVyfSB8fCBub1ZpZXdNb2RlbD0keyF0aGlzLl93aWRnZXQ/LnZpZXdNb2RlbH0gJiYgbm9QZXJzaXN0ZWRTZXNzaW9ucz0ke25vUGVyc2lzdGVkU2Vzc2lvbnN9IHx8IGRlZmF1bHRQYXJ0aWNpcGFudFJlZ2lzdHJhdGlvbkZhaWxlZD0ke3RoaXMuZGVmYXVsdFBhcnRpY2lwYW50UmVnaXN0cmF0aW9uRmFpbGVkfSB8fCBzaG93U2V0dXA9JHtzaG93U2V0dXB9YCk7XG5cdFx0cmV0dXJuICEhc2hvdWxkU2hvdztcblx0fVxuXG5cdHByaXZhdGUgZ2V0VHJhbnNmZXJyZWRPclBlcnNpc3RlZFNlc3Npb25JbmZvKCk6IHsgc2Vzc2lvbklkPzogc3RyaW5nOyBpbnB1dFZhbHVlPzogc3RyaW5nOyBtb2RlPzogQ2hhdE1vZGUgfSB7XG5cdFx0aWYgKHRoaXMuY2hhdFNlcnZpY2UudHJhbnNmZXJyZWRTZXNzaW9uRGF0YT8ubG9jYXRpb24gPT09IHRoaXMuY2hhdE9wdGlvbnMubG9jYXRpb24pIHtcblx0XHRcdGNvbnN0IHNlc3Npb25JZCA9IHRoaXMuY2hhdFNlcnZpY2UudHJhbnNmZXJyZWRTZXNzaW9uRGF0YS5zZXNzaW9uSWQ7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRzZXNzaW9uSWQsXG5cdFx0XHRcdGlucHV0VmFsdWU6IHRoaXMuY2hhdFNlcnZpY2UudHJhbnNmZXJyZWRTZXNzaW9uRGF0YS5pbnB1dFZhbHVlLFxuXHRcdFx0XHRtb2RlOiB0aGlzLmNoYXRTZXJ2aWNlLnRyYW5zZmVycmVkU2Vzc2lvbkRhdGEubW9kZVxuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHsgc2Vzc2lvbklkOiB0aGlzLnZpZXdTdGF0ZS5zZXNzaW9uSWQgfTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgcmVuZGVyQm9keShwYXJlbnQ6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdHN1cGVyLnJlbmRlckJvZHkocGFyZW50KTtcblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0Vmlld1dlbGNvbWVDb250cm9sbGVyLCBwYXJlbnQsIHRoaXMsIHRoaXMuY2hhdE9wdGlvbnMubG9jYXRpb24pKTtcblxuXHRcdFx0Y29uc3Qgc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCB0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlXSkpKTtcblx0XHRcdGNvbnN0IGxvY2F0aW9uQmFzZWRDb2xvcnMgPSB0aGlzLmdldExvY2F0aW9uQmFzZWRDb2xvcnMoKTtcblx0XHRcdGNvbnN0IGVkaXRvck92ZXJmbG93Tm9kZSA9IHRoaXMubGF5b3V0U2VydmljZS5nZXRDb250YWluZXIoZ2V0V2luZG93KHBhcmVudCkpLmFwcGVuZENoaWxkKCQoJy5jaGF0LWVkaXRvci1vdmVyZmxvdy5tb25hY28tZWRpdG9yJykpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoeyBkaXNwb3NlOiAoKSA9PiBlZGl0b3JPdmVyZmxvd05vZGUucmVtb3ZlKCkgfSk7XG5cblx0XHRcdHRoaXMuX3dpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRDaGF0V2lkZ2V0LFxuXHRcdFx0XHR0aGlzLmNoYXRPcHRpb25zLmxvY2F0aW9uLFxuXHRcdFx0XHR7IHZpZXdJZDogdGhpcy5pZCB9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0YXV0b1Njcm9sbDogbW9kZSA9PiBtb2RlICE9PSBDaGF0TW9kZS5Bc2ssXG5cdFx0XHRcdFx0cmVuZGVyRm9sbG93dXBzOiB0aGlzLmNoYXRPcHRpb25zLmxvY2F0aW9uID09PSBDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCxcblx0XHRcdFx0XHRzdXBwb3J0c0ZpbGVSZWZlcmVuY2VzOiB0cnVlLFxuXHRcdFx0XHRcdHN1cHBvcnRzQWRkaXRpb25hbFBhcnRpY2lwYW50czogdGhpcy5jaGF0T3B0aW9ucy5sb2NhdGlvbiA9PT0gQ2hhdEFnZW50TG9jYXRpb24uUGFuZWwsXG5cdFx0XHRcdFx0cmVuZGVyZXJPcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRyZW5kZXJUZXh0RWRpdHNBc1N1bW1hcnk6ICh1cmkpID0+IHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuY2hhdFNlcnZpY2UuaXNFZGl0aW5nTG9jYXRpb24odGhpcy5jaGF0T3B0aW9ucy5sb2NhdGlvbik7XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0cmVmZXJlbmNlc0V4cGFuZGVkV2hlbkVtcHR5UmVzcG9uc2U6ICF0aGlzLmNoYXRTZXJ2aWNlLmlzRWRpdGluZ0xvY2F0aW9uKHRoaXMuY2hhdE9wdGlvbnMubG9jYXRpb24pLFxuXHRcdFx0XHRcdFx0cHJvZ3Jlc3NNZXNzYWdlQXRCb3R0b21PZlJlc3BvbnNlOiBtb2RlID0+IG1vZGUgIT09IENoYXRNb2RlLkFzayxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGVkaXRvck92ZXJmbG93V2lkZ2V0c0RvbU5vZGU6IGVkaXRvck92ZXJmbG93Tm9kZSxcblx0XHRcdFx0XHRlbmFibGVJbXBsaWNpdENvbnRleHQ6IHRoaXMuY2hhdE9wdGlvbnMubG9jYXRpb24gPT09IENoYXRBZ2VudExvY2F0aW9uLlBhbmVsIHx8IHRoaXMuY2hhdFNlcnZpY2UuaXNFZGl0aW5nTG9jYXRpb24odGhpcy5jaGF0T3B0aW9ucy5sb2NhdGlvbiksXG5cdFx0XHRcdFx0ZW5hYmxlV29ya2luZ1NldDogdGhpcy5jaGF0U2VydmljZS5pc0VkaXRpbmdMb2NhdGlvbih0aGlzLmNoYXRPcHRpb25zLmxvY2F0aW9uKSA/ICdleHBsaWNpdCcgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0c3VwcG9ydHNDaGFuZ2luZ01vZGVzOiB0aGlzLmNoYXRTZXJ2aWNlLmlzRWRpdGluZ0xvY2F0aW9uKHRoaXMuY2hhdE9wdGlvbnMubG9jYXRpb24pLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGlzdEZvcmVncm91bmQ6IFNJREVfQkFSX0ZPUkVHUk9VTkQsXG5cdFx0XHRcdFx0bGlzdEJhY2tncm91bmQ6IGxvY2F0aW9uQmFzZWRDb2xvcnMuYmFja2dyb3VuZCxcblx0XHRcdFx0XHRvdmVybGF5QmFja2dyb3VuZDogbG9jYXRpb25CYXNlZENvbG9ycy5vdmVybGF5QmFja2dyb3VuZCxcblx0XHRcdFx0XHRpbnB1dEVkaXRvckJhY2tncm91bmQ6IGxvY2F0aW9uQmFzZWRDb2xvcnMuYmFja2dyb3VuZCxcblx0XHRcdFx0XHRyZXN1bHRFZGl0b3JCYWNrZ3JvdW5kOiBlZGl0b3JCYWNrZ3JvdW5kLFxuXG5cdFx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRDaGFuZ2VCb2R5VmlzaWJpbGl0eSh2aXNpYmxlID0+IHtcblx0XHRcdFx0dGhpcy5fd2lkZ2V0LnNldFZpc2libGUodmlzaWJsZSk7XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl93aWRnZXQub25EaWRDbGVhcigoKSA9PiB0aGlzLmNsZWFyKCkpKTtcblx0XHRcdHRoaXMuX3dpZGdldC5yZW5kZXIocGFyZW50KTtcblxuXHRcdFx0Y29uc3QgaW5mbyA9IHRoaXMuZ2V0VHJhbnNmZXJyZWRPclBlcnNpc3RlZFNlc3Npb25JbmZvKCk7XG5cdFx0XHRjb25zdCBkaXNwb3NlTGlzdGVuZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmNoYXRTZXJ2aWNlLm9uRGlkRGlzcG9zZVNlc3Npb24oKGUpID0+IHtcblx0XHRcdFx0Ly8gUmVuZGVyIHRoZSB3ZWxjb21lIHZpZXcgaWYgcHJvdmlkZXIgcmVnaXN0cmF0aW9uIGZhaWxzLCBlZyB3aGVuIHNpZ25lZCBvdXQuIFRoaXMgYWN0aXZhdGVzIGZvciBhbnkgc2Vzc2lvbiwgYnV0IHRoZSBwcm9ibGVtIGlzIHRoZSBzYW1lIHJlZ2FyZGxlc3Ncblx0XHRcdFx0aWYgKGUucmVhc29uID09PSAnaW5pdGlhbGl6YXRpb25GYWlsZWQnKSB7XG5cdFx0XHRcdFx0dGhpcy5kZWZhdWx0UGFydGljaXBhbnRSZWdpc3RyYXRpb25GYWlsZWQgPSB0cnVlO1xuXHRcdFx0XHRcdGRpc3Bvc2VMaXN0ZW5lcj8uZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVmlld1dlbGNvbWVTdGF0ZS5maXJlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHRcdGNvbnN0IG1vZGVsID0gaW5mby5zZXNzaW9uSWQgPyBhd2FpdCB0aGlzLmNoYXRTZXJ2aWNlLmdldE9yUmVzdG9yZVNlc3Npb24oaW5mby5zZXNzaW9uSWQpIDogdW5kZWZpbmVkO1xuXG5cdFx0XHRhd2FpdCB0aGlzLnVwZGF0ZU1vZGVsKG1vZGVsLCBpbmZvLmlucHV0VmFsdWUgfHwgaW5mby5tb2RlID8geyBpbnB1dFN0YXRlOiB7IGNoYXRNb2RlOiBpbmZvLm1vZGUgfSwgaW5wdXRWYWx1ZTogaW5mby5pbnB1dFZhbHVlIH0gOiB1bmRlZmluZWQpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlKTtcblx0XHRcdHRocm93IGU7XG5cdFx0fVxuXHR9XG5cblx0YWNjZXB0SW5wdXQocXVlcnk/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl93aWRnZXQuYWNjZXB0SW5wdXQocXVlcnkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjbGVhcigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy53aWRnZXQudmlld01vZGVsKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmNoYXRTZXJ2aWNlLmNsZWFyU2Vzc2lvbih0aGlzLndpZGdldC52aWV3TW9kZWwuc2Vzc2lvbklkKTtcblx0XHR9XG5cblx0XHQvLyBHcmFiIHRoZSB3aWRnZXQncyBsYXRlc3QgdmlldyBzdGF0ZSBiZWNhdXNlIGl0IHdpbGwgYmUgbG9hZGVkIGJhY2sgaW50byB0aGUgd2lkZ2V0XG5cdFx0dGhpcy51cGRhdGVWaWV3U3RhdGUoKTtcblx0XHRhd2FpdCB0aGlzLnVwZGF0ZU1vZGVsKHVuZGVmaW5lZCk7XG5cblx0XHQvLyBVcGRhdGUgdGhlIHRvb2xiYXIgY29udGV4dCB3aXRoIG5ldyBzZXNzaW9uSWRcblx0XHR0aGlzLnVwZGF0ZUFjdGlvbnMoKTtcblx0fVxuXG5cdGFzeW5jIGxvYWRTZXNzaW9uKHNlc3Npb25JZDogc3RyaW5nLCB2aWV3U3RhdGU/OiBJQ2hhdFZpZXdTdGF0ZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLndpZGdldC52aWV3TW9kZWwpIHtcblx0XHRcdGF3YWl0IHRoaXMuY2hhdFNlcnZpY2UuY2xlYXJTZXNzaW9uKHRoaXMud2lkZ2V0LnZpZXdNb2RlbC5zZXNzaW9uSWQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5ld01vZGVsID0gYXdhaXQgdGhpcy5jaGF0U2VydmljZS5nZXRPclJlc3RvcmVTZXNzaW9uKHNlc3Npb25JZCk7XG5cdFx0YXdhaXQgdGhpcy51cGRhdGVNb2RlbChuZXdNb2RlbCwgdmlld1N0YXRlKTtcblx0fVxuXG5cdGZvY3VzSW5wdXQoKTogdm9pZCB7XG5cdFx0dGhpcy5fd2lkZ2V0LmZvY3VzSW5wdXQoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGZvY3VzKCk6IHZvaWQge1xuXHRcdHN1cGVyLmZvY3VzKCk7XG5cdFx0dGhpcy5fd2lkZ2V0LmZvY3VzSW5wdXQoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBsYXlvdXRCb2R5KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0c3VwZXIubGF5b3V0Qm9keShoZWlnaHQsIHdpZHRoKTtcblx0XHR0aGlzLl93aWRnZXQubGF5b3V0KGhlaWdodCwgd2lkdGgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2F2ZVN0YXRlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl93aWRnZXQpIHtcblx0XHRcdC8vIFNpbmNlIGlucHV0IGhpc3RvcnkgaXMgcGVyLXByb3ZpZGVyLCB0aGlzIGlzIGhhbmRsZWQgYnkgYSBzZXBhcmF0ZSBzZXJ2aWNlIGFuZCBub3QgdGhlIG1lbWVudG8gaGVyZS5cblx0XHRcdC8vIFRPRE8gbXVsdGlwbGUgY2hhdCB2aWV3cyB3aWxsIG92ZXJ3cml0ZSBlYWNoIG90aGVyXG5cdFx0XHR0aGlzLl93aWRnZXQuc2F2ZVN0YXRlKCk7XG5cblx0XHRcdHRoaXMudXBkYXRlVmlld1N0YXRlKCk7XG5cdFx0XHR0aGlzLm1lbWVudG8uc2F2ZU1lbWVudG8oKTtcblx0XHR9XG5cblx0XHRzdXBlci5zYXZlU3RhdGUoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlVmlld1N0YXRlKHZpZXdTdGF0ZT86IElDaGF0Vmlld1N0YXRlKTogdm9pZCB7XG5cdFx0Y29uc3QgbmV3Vmlld1N0YXRlID0gdmlld1N0YXRlID8/IHRoaXMuX3dpZGdldC5nZXRWaWV3U3RhdGUoKTtcblx0XHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhuZXdWaWV3U3RhdGUpKSB7XG5cdFx0XHQvLyBBc3NpZ24gYWxsIHByb3BzIHRvIHRoZSBtZW1lbnRvIHNvIHRoZXkgZ2V0IHNhdmVkXG5cdFx0XHQodGhpcy52aWV3U3RhdGUgYXMgYW55KVtrZXldID0gdmFsdWU7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsR0FBRyxpQkFBaUI7QUFDN0IsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBMkIsZ0JBQWdCO0FBQzNDLFNBQVMsZUFBZTtBQUN4QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDhCQUE4QjtBQUV2QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDBCQUFzQztBQUMvQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1CQUFtQixnQkFBZ0I7QUFDNUMsU0FBUyxrQkFBa0M7QUFDM0MsU0FBUyxpQ0FBdUQ7QUFPekQsTUFBTSxpQ0FBaUM7QUFDdkMsTUFBTSx3QkFBd0I7QUFDOUIsTUFBTSxnQ0FBZ0M7QUFDdEMsSUFBTSxlQUFOLGNBQTJCLFNBQXlDO0FBQUEsRUFZMUUsWUFDa0IsYUFDakIsU0FDb0IsbUJBQ0Msb0JBQ0Usc0JBQ0gsbUJBQ0ksdUJBQ0Qsc0JBQ1AsZUFDRCxjQUNBLGNBQ21CLGdCQUNILGFBQ0ssa0JBQ04sWUFDRyxlQUNoQztBQUNELFVBQU0sU0FBUyxtQkFBbUIsb0JBQW9CLHNCQUFzQixtQkFBbUIsdUJBQXVCLHNCQUFzQixlQUFlLGNBQWMsWUFBWTtBQWpCcEs7QUFXaUI7QUFDSDtBQUNLO0FBQ047QUFDRztBQXhCbEMsU0FBaUIsbUJBQW1CLEtBQUssVUFBVSxJQUFJLGdCQUFnQixDQUFDO0FBR3hFLFNBQVEsdUNBQXVDO0FBQy9DLFNBQVEsd0JBQXdCO0FBeUIvQixTQUFLLFVBQVUsSUFBSSxRQUFRLDhCQUE4QixvQkFBb0IsS0FBSyxZQUFZLGFBQWEsa0JBQWtCLGlCQUFpQixXQUFXLEtBQUssS0FBSyxjQUFjO0FBQ2pMLFNBQUssWUFBWSxLQUFLLFFBQVEsV0FBVyxhQUFhLFdBQVcsY0FBYyxPQUFPO0FBRXRGLFFBQUksS0FBSyxZQUFZLHNCQUFzQixLQUFLLFlBQVksYUFBYSxrQkFBa0IsU0FBUyxDQUFDLEtBQUssVUFBVSwyQkFBMkI7QUFDOUksWUFBTSxlQUFlLElBQUksUUFBUSw4QkFBOEIsbUJBQW1CLFVBQVUsS0FBSyxjQUFjO0FBQy9HLFlBQU0saUJBQWlCLGFBQWEsV0FBVyxhQUFhLFdBQVcsY0FBYyxPQUFPO0FBQzVGLFVBQUksZUFBZSxXQUFXO0FBQzdCLGFBQUssV0FBVyxNQUFNLHdDQUF3QyxlQUFlLFNBQVMsRUFBRTtBQUN4RixZQUFJLENBQUMsS0FBSyxZQUFZLHdCQUF3QixlQUFlLFNBQVMsR0FBRztBQUN4RSxlQUFLLFdBQVcsS0FBSywyQkFBMkIsZUFBZSxTQUFTLGtCQUFrQjtBQUMxRixlQUFLLFVBQVUsWUFBWSxlQUFlO0FBQzFDLGVBQUssVUFBVSxhQUFhLGVBQWU7QUFDM0MsZUFBSyxVQUFVLGFBQWE7QUFBQSxZQUMzQixHQUFHLGVBQWU7QUFBQSxZQUNsQixVQUFVLGVBQWUsWUFBWSxZQUFZLFNBQVM7QUFBQSxVQUMzRDtBQUNBLGVBQUssVUFBVSw0QkFBNEI7QUFBQSxRQUM1QztBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsU0FBSyxVQUFVLEtBQUssaUJBQWlCLGtCQUFrQixNQUFNO0FBQzVELFVBQUksS0FBSyxpQkFBaUIsZ0JBQWdCLEtBQUssYUFBYSxRQUFRLEdBQUc7QUFDdEUsWUFBSSxDQUFDLEtBQUssU0FBUyxhQUFhLENBQUMsS0FBSyxtQkFBbUI7QUFDeEQsZ0JBQU0sT0FBTyxLQUFLLHFDQUFxQztBQUN2RCxlQUFLLHFCQUNILEtBQUssWUFBWSxLQUFLLFlBQVksb0JBQW9CLEtBQUssU0FBUyxJQUFJLFFBQVEsUUFBUSxNQUFTLEdBQUcsS0FBSyxPQUFNLFVBQVM7QUFJeEgsa0JBQU0sYUFBYSxLQUFLLFFBQVE7QUFDaEMsZ0JBQUk7QUFDSCxtQkFBSyxRQUFRLFdBQVcsS0FBSztBQUM3QixvQkFBTSxLQUFLLFlBQVksT0FBTyxLQUFLLGNBQWMsS0FBSyxPQUFPLEVBQUUsWUFBWSxFQUFFLFVBQVUsS0FBSyxLQUFLLEdBQUcsWUFBWSxLQUFLLFdBQVcsSUFBSSxNQUFTO0FBQzdJLG1CQUFLLHVDQUF1QztBQUM1QyxtQkFBSyx3QkFBd0I7QUFDN0IsbUJBQUssNkJBQTZCLEtBQUs7QUFBQSxZQUN4QyxVQUFFO0FBQ0QsbUJBQUssT0FBTyxXQUFXLFVBQVU7QUFBQSxZQUNsQztBQUFBLFVBQ0QsQ0FBQztBQUNGLGVBQUssa0JBQWtCLFFBQVEsTUFBTSxLQUFLLG9CQUFvQixNQUFTO0FBQUEsUUFDeEU7QUFBQSxNQUNELFdBQVcsS0FBSyxTQUFTLFdBQVcsY0FBYyxtQkFBbUIsYUFBYTtBQUVqRixhQUFLLHdCQUF3QjtBQUFBLE1BQzlCO0FBRUEsV0FBSyw2QkFBNkIsS0FBSztBQUFBLElBQ3hDLENBQUMsQ0FBQztBQUVGLFNBQUssVUFBVSxLQUFLLGtCQUFrQixtQkFBbUIsT0FBSztBQUM3RCxVQUFJLEVBQUUsWUFBWSxnQkFBZ0IsYUFBYSxHQUFHO0FBQ2pELGFBQUssNkJBQTZCLEtBQUs7QUFBQSxNQUN4QztBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBdkZBLElBQUksU0FBcUI7QUFBRSxXQUFPLEtBQUs7QUFBQSxFQUFTO0FBQUEsRUF5RnZDLG9CQUE2RDtBQUNyRSxXQUFPLEtBQUssUUFBUSxZQUFZO0FBQUEsTUFDL0IsV0FBVyxLQUFLLE9BQU8sVUFBVTtBQUFBLE1BQ2pDLE1BQU0sYUFBYTtBQUFBLElBQ3BCLElBQUk7QUFBQSxFQUNMO0FBQUEsRUFFQSxNQUFjLFlBQVksT0FBZ0MsV0FBMkM7QUFDcEcsU0FBSyxpQkFBaUIsTUFBTTtBQUU1QixZQUFRLFVBQVUsS0FBSyxZQUFZLHdCQUF3QixhQUFhLEtBQUssWUFBWSx3QkFBd0IsYUFBYSxLQUFLLFlBQVksV0FDNUksTUFBTSxLQUFLLFlBQVksb0JBQW9CLEtBQUssWUFBWSx1QkFBdUIsU0FBUyxJQUM1RixLQUFLLFlBQVksYUFBYSxLQUFLLFlBQVksVUFBVSxrQkFBa0IsSUFBSTtBQUNsRixRQUFJLENBQUMsT0FBTztBQUNYLFlBQU0sSUFBSSxNQUFNLDhCQUE4QjtBQUFBLElBQy9DO0FBRUEsUUFBSSxXQUFXO0FBQ2QsV0FBSyxnQkFBZ0IsU0FBUztBQUFBLElBQy9CO0FBRUEsU0FBSyxVQUFVLFlBQVksTUFBTTtBQUNqQyxTQUFLLFFBQVEsU0FBUyxPQUFPLEVBQUUsR0FBRyxLQUFLLFVBQVUsQ0FBQztBQUdsRCxTQUFLLGNBQWM7QUFBQSxFQUNwQjtBQUFBLEVBRVMsb0JBQTZCO0FBQ3JDLFVBQU0sWUFBWSxLQUFLLGtCQUFrQixvQkFBb0IsZ0JBQWdCLGtCQUFrQjtBQUMvRixVQUFNLHNCQUFzQixDQUFDLEtBQUssWUFBWSxZQUFZO0FBQzFELFVBQU0sZUFBZSxLQUFLLGlCQUFpQixVQUFVLEVBQUUsS0FBSyxXQUFTLE1BQU0sVUFBVSxNQUFNLFVBQVUsU0FBUyxLQUFLLFlBQVksUUFBUSxDQUFDO0FBQ3hJLFVBQU0sYUFBYSxDQUFDLGlCQUFpQixLQUFLLHlCQUF5QixDQUFDLEtBQUssU0FBUyxhQUFhLHVCQUF1QixLQUFLLHdDQUF3QztBQUNuSyxTQUFLLFdBQVcsTUFBTSxrQ0FBa0MsS0FBSyxZQUFZLFFBQVEsT0FBTyxVQUFVLGtCQUFrQixZQUFZLGtCQUFrQixLQUFLLHFCQUFxQixtQkFBbUIsQ0FBQyxLQUFLLFNBQVMsU0FBUywyQkFBMkIsbUJBQW1CLDRDQUE0QyxLQUFLLG9DQUFvQyxpQkFBaUIsU0FBUyxFQUFFO0FBQ3RYLFdBQU8sQ0FBQyxDQUFDO0FBQUEsRUFDVjtBQUFBLEVBRVEsdUNBQXFHO0FBQzVHLFFBQUksS0FBSyxZQUFZLHdCQUF3QixhQUFhLEtBQUssWUFBWSxVQUFVO0FBQ3BGLFlBQU0sWUFBWSxLQUFLLFlBQVksdUJBQXVCO0FBQzFELGFBQU87QUFBQSxRQUNOO0FBQUEsUUFDQSxZQUFZLEtBQUssWUFBWSx1QkFBdUI7QUFBQSxRQUNwRCxNQUFNLEtBQUssWUFBWSx1QkFBdUI7QUFBQSxNQUMvQztBQUFBLElBQ0QsT0FBTztBQUNOLGFBQU8sRUFBRSxXQUFXLEtBQUssVUFBVSxVQUFVO0FBQUEsSUFDOUM7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUF5QixXQUFXLFFBQW9DO0FBQ3ZFLFFBQUk7QUFDSCxZQUFNLFdBQVcsTUFBTTtBQUV2QixXQUFLLFVBQVUsS0FBSyxxQkFBcUIsZUFBZSwyQkFBMkIsUUFBUSxNQUFNLEtBQUssWUFBWSxRQUFRLENBQUM7QUFFM0gsWUFBTSw2QkFBNkIsS0FBSyxVQUFVLEtBQUsscUJBQXFCLFlBQVksSUFBSSxrQkFBa0IsQ0FBQyxvQkFBb0IsS0FBSyx1QkFBdUIsQ0FBQyxDQUFDLENBQUM7QUFDbEssWUFBTSxzQkFBc0IsS0FBSyx1QkFBdUI7QUFDeEQsWUFBTSxxQkFBcUIsS0FBSyxjQUFjLGFBQWEsVUFBVSxNQUFNLENBQUMsRUFBRSxZQUFZLEVBQUUscUNBQXFDLENBQUM7QUFDbEksV0FBSyxVQUFVLEVBQUUsU0FBUyxNQUFNLG1CQUFtQixPQUFPLEVBQUUsQ0FBQztBQUU3RCxXQUFLLFVBQVUsS0FBSyxVQUFVLDJCQUEyQjtBQUFBLFFBQ3hEO0FBQUEsUUFDQSxLQUFLLFlBQVk7QUFBQSxRQUNqQixFQUFFLFFBQVEsS0FBSyxHQUFHO0FBQUEsUUFDbEI7QUFBQSxVQUNDLFlBQVksVUFBUSxTQUFTLFNBQVM7QUFBQSxVQUN0QyxpQkFBaUIsS0FBSyxZQUFZLGFBQWEsa0JBQWtCO0FBQUEsVUFDakUsd0JBQXdCO0FBQUEsVUFDeEIsZ0NBQWdDLEtBQUssWUFBWSxhQUFhLGtCQUFrQjtBQUFBLFVBQ2hGLGlCQUFpQjtBQUFBLFlBQ2hCLDBCQUEwQixDQUFDLFFBQVE7QUFDbEMscUJBQU8sS0FBSyxZQUFZLGtCQUFrQixLQUFLLFlBQVksUUFBUTtBQUFBLFlBQ3BFO0FBQUEsWUFDQSxxQ0FBcUMsQ0FBQyxLQUFLLFlBQVksa0JBQWtCLEtBQUssWUFBWSxRQUFRO0FBQUEsWUFDbEcsbUNBQW1DLFVBQVEsU0FBUyxTQUFTO0FBQUEsVUFDOUQ7QUFBQSxVQUNBLDhCQUE4QjtBQUFBLFVBQzlCLHVCQUF1QixLQUFLLFlBQVksYUFBYSxrQkFBa0IsU0FBUyxLQUFLLFlBQVksa0JBQWtCLEtBQUssWUFBWSxRQUFRO0FBQUEsVUFDNUksa0JBQWtCLEtBQUssWUFBWSxrQkFBa0IsS0FBSyxZQUFZLFFBQVEsSUFBSSxhQUFhO0FBQUEsVUFDL0YsdUJBQXVCLEtBQUssWUFBWSxrQkFBa0IsS0FBSyxZQUFZLFFBQVE7QUFBQSxRQUNwRjtBQUFBLFFBQ0E7QUFBQSxVQUNDLGdCQUFnQjtBQUFBLFVBQ2hCLGdCQUFnQixvQkFBb0I7QUFBQSxVQUNwQyxtQkFBbUIsb0JBQW9CO0FBQUEsVUFDdkMsdUJBQXVCLG9CQUFvQjtBQUFBLFVBQzNDLHdCQUF3QjtBQUFBLFFBRXpCO0FBQUEsTUFBQyxDQUFDO0FBQ0gsV0FBSyxVQUFVLEtBQUssMEJBQTBCLGFBQVc7QUFDeEQsYUFBSyxRQUFRLFdBQVcsT0FBTztBQUFBLE1BQ2hDLENBQUMsQ0FBQztBQUNGLFdBQUssVUFBVSxLQUFLLFFBQVEsV0FBVyxNQUFNLEtBQUssTUFBTSxDQUFDLENBQUM7QUFDMUQsV0FBSyxRQUFRLE9BQU8sTUFBTTtBQUUxQixZQUFNLE9BQU8sS0FBSyxxQ0FBcUM7QUFDdkQsWUFBTSxrQkFBa0IsS0FBSyxVQUFVLEtBQUssWUFBWSxvQkFBb0IsQ0FBQyxNQUFNO0FBRWxGLFlBQUksRUFBRSxXQUFXLHdCQUF3QjtBQUN4QyxlQUFLLHVDQUF1QztBQUM1QywyQkFBaUIsUUFBUTtBQUN6QixlQUFLLDZCQUE2QixLQUFLO0FBQUEsUUFDeEM7QUFBQSxNQUNELENBQUMsQ0FBQztBQUNGLFlBQU0sUUFBUSxLQUFLLFlBQVksTUFBTSxLQUFLLFlBQVksb0JBQW9CLEtBQUssU0FBUyxJQUFJO0FBRTVGLFlBQU0sS0FBSyxZQUFZLE9BQU8sS0FBSyxjQUFjLEtBQUssT0FBTyxFQUFFLFlBQVksRUFBRSxVQUFVLEtBQUssS0FBSyxHQUFHLFlBQVksS0FBSyxXQUFXLElBQUksTUFBUztBQUFBLElBQzlJLFNBQVMsR0FBRztBQUNYLFdBQUssV0FBVyxNQUFNLENBQUM7QUFDdkIsWUFBTTtBQUFBLElBQ1A7QUFBQSxFQUNEO0FBQUEsRUFFQSxZQUFZLE9BQXNCO0FBQ2pDLFNBQUssUUFBUSxZQUFZLEtBQUs7QUFBQSxFQUMvQjtBQUFBLEVBRUEsTUFBYyxRQUF1QjtBQUNwQyxRQUFJLEtBQUssT0FBTyxXQUFXO0FBQzFCLFlBQU0sS0FBSyxZQUFZLGFBQWEsS0FBSyxPQUFPLFVBQVUsU0FBUztBQUFBLElBQ3BFO0FBR0EsU0FBSyxnQkFBZ0I7QUFDckIsVUFBTSxLQUFLLFlBQVksTUFBUztBQUdoQyxTQUFLLGNBQWM7QUFBQSxFQUNwQjtBQUFBLEVBRUEsTUFBTSxZQUFZLFdBQW1CLFdBQTJDO0FBQy9FLFFBQUksS0FBSyxPQUFPLFdBQVc7QUFDMUIsWUFBTSxLQUFLLFlBQVksYUFBYSxLQUFLLE9BQU8sVUFBVSxTQUFTO0FBQUEsSUFDcEU7QUFFQSxVQUFNLFdBQVcsTUFBTSxLQUFLLFlBQVksb0JBQW9CLFNBQVM7QUFDckUsVUFBTSxLQUFLLFlBQVksVUFBVSxTQUFTO0FBQUEsRUFDM0M7QUFBQSxFQUVBLGFBQW1CO0FBQ2xCLFNBQUssUUFBUSxXQUFXO0FBQUEsRUFDekI7QUFBQSxFQUVTLFFBQWM7QUFDdEIsVUFBTSxNQUFNO0FBQ1osU0FBSyxRQUFRLFdBQVc7QUFBQSxFQUN6QjtBQUFBLEVBRW1CLFdBQVcsUUFBZ0IsT0FBcUI7QUFDbEUsVUFBTSxXQUFXLFFBQVEsS0FBSztBQUM5QixTQUFLLFFBQVEsT0FBTyxRQUFRLEtBQUs7QUFBQSxFQUNsQztBQUFBLEVBRVMsWUFBa0I7QUFDMUIsUUFBSSxLQUFLLFNBQVM7QUFHakIsV0FBSyxRQUFRLFVBQVU7QUFFdkIsV0FBSyxnQkFBZ0I7QUFDckIsV0FBSyxRQUFRLFlBQVk7QUFBQSxJQUMxQjtBQUVBLFVBQU0sVUFBVTtBQUFBLEVBQ2pCO0FBQUEsRUFFUSxnQkFBZ0IsV0FBa0M7QUFDekQsVUFBTSxlQUFlLGFBQWEsS0FBSyxRQUFRLGFBQWE7QUFDNUQsZUFBVyxDQUFDLEtBQUssS0FBSyxLQUFLLE9BQU8sUUFBUSxZQUFZLEdBQUc7QUFFeEQsTUFBQyxLQUFLLFVBQWtCLEdBQUcsSUFBSTtBQUFBLElBQ2hDO0FBQUEsRUFDRDtBQUNEO0FBelFhLGVBQU47QUFBQSxFQWVKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBNUJVOyIsCiAgIm5hbWVzIjogW10KfQo=
